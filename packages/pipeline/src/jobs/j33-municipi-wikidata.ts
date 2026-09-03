import { eq } from "drizzle-orm";
import { municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { fetchJson } from "../lib/http";
import { withRun } from "../lib/run";
import { KIND as KIND_WIKIDATA, fitxerCommons, type FitxaWikidata } from "./j20-wikidata";
import { dataCurtaIso, qidDeUri, trossos, urlConsulta } from "./j21-trajectoria-electes";
import { continuacioDe, llegeixImageinfo, urlImageinfo, type ResultatRetrat } from "./j28-fotos-exalcaldes";

/**
 * J33 — dues curiositats de Wikidata per municipi: amb qui està agermanat i
 * qui hi ha nascut.
 *
 * Són les dues dades que la fitxa municipal no té de cap font oficial i que
 * Wikidata sí que té estructurades per als 947:
 *
 *   · **Els agermanaments** (P190 a l'element del municipi): la ciutat, el
 *     seu país (P17) i, quan algú l'ha posada, la data d'inici (P580) o de
 *     final (P582) de l'agermanament.
 *   · **Les persones nascudes al municipi** (P19 = el municipi, i P31 =
 *     ésser humà, que deixa fora personatges de ficció i gossos famosos): el
 *     nom, les dates de naixement (P569) i mort (P570), l'ocupació (P106),
 *     la fotografia (P18) i si tenen article a la Viquipèdia en català.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DOTZE PERSONES, I EL TOTAL AL COSTAT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Wikidata situa **14.442 persones** nascudes a Barcelona i **560** a Badalona
 * (consultat el 03-09-2026). Arrossegar-ho tot faria 947 fitxes que no es
 * poden ni desar ni llegir, i la pàgina no en pot ensenyar més d'una dotzena.
 * Es desen les **12 amb més enllaços d'entrada** (`wikibase:sitelinks`, el
 * nombre d'edicions de la Wikipedia que en tenen article), i **el total** que
 * Wikidata situa al municipi, perquè la pàgina pugui dir «12 de les 560»: la
 * xifra de cobertura és part del fet, no una nota al peu.
 *
 * Els enllaços d'entrada no mesuren importància: mesuren de quantes
 * Wikipedies té article, i això afavoreix esportistes d'equips que juguen
 * competicions internacionals. A Badalona, les dotze primeres són nedadores,
 * futbolistes i jugadors de bàsquet. La pàgina ho ha de dir amb aquestes
 * paraules; el criteri és el que és i no s'hi afegeix cap correcció editorial.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * RITME: TRES PASSADES, PERQUÈ UN «LIMIT PER GRUP» NO EXISTEIX A SPARQL
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Els agermanaments es demanen per lots de 40 municipis, com J31: són poques
 * files per municipi. Les persones no es poden demanar igual —SPARQL no té
 * manera de dir «les 12 primeres de cada municipi»— i per això es fa en tres
 * passades:
 *
 *   1. **Un recompte** per lots de 40: quantes persones té cada municipi.
 *   2. **Els municipis amb 12 o menys**, agrupats en lots que sumin com a
 *      màxim unes 240 persones: una sola consulta els porta tots sencers.
 *   3. **Els municipis amb més de 12**, un per consulta, amb `ORDER BY
 *      DESC(?sitelinks) LIMIT 12` en una subconsulta. Va en subconsulta
 *      perquè les ocupacions (P106) i les fotografies múltiples multipliquen
 *      les files, i un LIMIT a fora retallaria persones senceres.
 *
 * Són unes 300 consultes en total, amb la pausa de J21 i J28 i els reintents
 * de `fetchJson`, que respecta el 429 de WDQS.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA CARA: LLICÈNCIA PER FITXER, I LA MINIATURA DE COMMONS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Les dades de Wikidata són CC0; les fotografies no: cada fitxer de Commons
 * porta la llicència que hi va posar qui el va pujar. Cada P18 es consulta a
 * l'API de Commons amb la mateixa llista tancada de llicències lliures que
 * J20 i J28, i **només es desa la que és lliure**, amb autor, llicència i
 * pàgina del fitxer, que és el que el crèdit ha d'escriure. El títol del
 * fitxer es desa sempre, també quan la llicència no permet publicar-lo: és
 * la dada, i el motiu del descart queda a les incidències.
 *
 * A diferència de J28, la imatge **no es baixa**: es desa la URL de la
 * miniatura de 120 px que Commons ja serveix i la pàgina l'enllaça d'allà.
 * J28 baixa 230 retrats; aquí en serien fins a uns deu mil, per a un bloc
 * de curiositats. Commons permet enllaçar-hi les miniatures, i la fitxa
 * porta tot el que caldria —títol, llicència, autor— per baixar-les un dia
 * com fa J28 si es decideix.
 *
 * Fonts: https://query.wikidata.org/sparql (dades CC0 1.0) i
 * https://commons.wikimedia.org/w/api.php (llicència per fitxer).
 */

export const KIND = "curiositatsWikidata";

const FONT = "Wikidata (wikidata.org)";
const FONT_IMATGES = "Wikimedia Commons (commons.wikimedia.org)";
const LLICENCIA_DADES = "CC0 1.0";

/** Quantes persones es desen per municipi. */
export const MAX_NASCUTS = 12;

/** Municipis per consulta d'agermanaments i de recompte. */
const MUNICIPIS_PER_CRIDA = 40;

/** Persones (segons el recompte) que pot sumar un lot de municipis petits. */
export const PERSONES_PER_LOT = 240;

/** Títols per crida a l'API de Commons, que n'accepta 50. */
const FITXERS_PER_CRIDA = 50;

/** Amplada de la miniatura: la cara de la fitxa fa 52 px, i 120 en cobreix el doble. */
export const AMPLADA_CARA = 120;

/** Pausa entre consultes SPARQL, la mateixa que J21, J28 i J31. */
const PAUSA_SPARQL_MS = 600;

/** Pausa entre crides a Commons, la mateixa que J20. */
const PAUSA_COMMONS_MS = 400;

// ─────────────────────────────────────────────────────────────────────────────
// El que es desa
// ─────────────────────────────────────────────────────────────────────────────

/** Un agermanament tal com el declara Wikidata a l'element del municipi. */
export type AgermanamentWikidata = {
  /** QID de la ciutat agermanada. */
  qid: string;
  nom: string;
  url: string;
  /** Etiqueta en català del país (P17 de la ciutat); `null` si no consta. */
  pais: string | null;
  paisQid: string | null;
  /** Inici (P580) en `AAAA-MM-DD`; `null` si la declaració no en porta. */
  inici: string | null;
  /** Final (P582): un agermanament acabat es desa tal com és, sense amagar-lo. */
  fi: string | null;
};

/** Una fotografia de Commons que hem comprovat que es pot republicar. */
export type ImatgePersona = {
  fitxer: string;
  /** Miniatura d'`AMPLADA_CARA` px, servida per Commons. */
  miniaturaUrl: string;
  /** Pàgina de descripció del fitxer: on va a parar l'atribució. */
  paginaFitxer: string;
  autor: string | null;
  llicencia: { codi: string; nom: string; url: string | null };
};

/** Una persona nascuda al municipi, segons Wikidata. */
export type PersonaNascuda = {
  qid: string;
  nom: string;
  url: string;
  /** URL de l'article a la Viquipèdia en català, o `null`. */
  viquipedia: string | null;
  /** Naixement (P569) i mort (P570) en `AAAA-MM-DD`; Wikidata sol tenir només l'any, i llavors és l'1 de gener. */
  naixement: string | null;
  defuncio: string | null;
  /** La primera ocupació (P106) amb etiqueta; la resta, a `ocupacions`. */
  ocupacio: string | null;
  ocupacions: string[];
  /** Enllaços d'entrada: en quantes edicions de la Wikipedia té article. És el criteri d'ordre. */
  enllacos: number;
  /** Títol del fitxer de Commons de la fotografia (P18), tingui la llicència que tingui. */
  fitxer: string | null;
  /** La fotografia només quan la llicència permet publicar-la. */
  imatge: ImatgePersona | null;
};

export type FitxaCuriositatsWikidata = {
  font: string;
  fontImatges: string;
  llicenciaDades: string;
  /** Data de consulta en ISO: sense data, cap dada no entra a la fitxa. */
  consultat: string;
  qidMunicipi: string;
  url: string;
  ine5: string;
  agermanaments: AgermanamentWikidata[];
  nascuts: {
    /** Quantes persones situa Wikidata al municipi, comptades abans de retallar. */
    total: number;
    /** Les que es desen, de més a menys enllaços d'entrada. */
    persones: PersonaNascuda[];
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Les consultes
// ─────────────────────────────────────────────────────────────────────────────

const VALUES = (qids: readonly string[]): string => `  VALUES ?muni { ${qids.map((q) => `wd:${q}`).join(" ")} }`;

/**
 * Els agermanaments (P190) d'un lot de municipis, amb el país de cada ciutat
 * i les dates que la declaració porti. Les declaracions obsoletes queden fora,
 * com a J31: són les que algú ha marcat com a errònies.
 */
export function consultaAgermanaments(qidsMunicipis: readonly string[]): string {
  return [
    "SELECT ?muni ?ciutat ?ciutatLabel ?pais ?paisLabel ?inici ?fi WHERE {",
    VALUES(qidsMunicipis),
    "  ?muni p:P190 ?st .",
    "  ?st ps:P190 ?ciutat ; wikibase:rank ?rang .",
    "  FILTER(?rang != wikibase:DeprecatedRank)",
    "  OPTIONAL { ?st pq:P580 ?inici }",
    "  OPTIONAL { ?st pq:P582 ?fi }",
    "  OPTIONAL { ?ciutat wdt:P17 ?pais }",
    '  SERVICE wikibase:label { bd:serviceParam wikibase:language "ca,es,en". }',
    "}",
  ].join("\n");
}

/** Quantes persones (P31 = Q5) tenen el lloc de naixement (P19) a cada municipi del lot. */
export function consultaRecompteNascuts(qidsMunicipis: readonly string[]): string {
  return [
    "SELECT ?muni (COUNT(DISTINCT ?persona) AS ?total) WHERE {",
    VALUES(qidsMunicipis),
    "  ?persona wdt:P19 ?muni ; wdt:P31 wd:Q5 .",
    "} GROUP BY ?muni",
  ].join("\n");
}

/**
 * Les persones nascudes als municipis del lot, amb el que en cal a la fitxa.
 *
 * Amb `limit` la selecció de persones va en una subconsulta ordenada pels
 * enllaços d'entrada: és l'única manera que el límit compti persones i no
 * files, perquè les ocupacions i les fotografies múltiples les multipliquen.
 * El límit és global i no per municipi, i per això només té sentit amb un
 * municipi al lot; sense `limit` es porten totes, per als municipis petits.
 *
 * L'article de la Viquipèdia surt del graf de sitelinks (`schema:about`), que
 * és on Wikidata desa a quines edicions té article cada element.
 */
export function consultaNascuts(qidsMunicipis: readonly string[], limit: number | null): string {
  const seleccio = [
    VALUES(qidsMunicipis),
    "  ?persona wdt:P19 ?muni ; wdt:P31 wd:Q5 ; wikibase:sitelinks ?sitelinks .",
  ];
  return [
    "SELECT ?muni ?persona ?personaLabel ?sitelinks ?naixement ?defuncio ?imatge ?article ?ocupacio ?ocupacioLabel WHERE {",
    ...(limit === null
      ? seleccio
      : ["  { SELECT ?muni ?persona ?sitelinks WHERE {", ...seleccio.map((l) => `  ${l}`), `  } ORDER BY DESC(?sitelinks) LIMIT ${limit} }`]),
    "  OPTIONAL { ?persona wdt:P569 ?naixement }",
    "  OPTIONAL { ?persona wdt:P570 ?defuncio }",
    "  OPTIONAL { ?persona wdt:P18 ?imatge }",
    "  OPTIONAL { ?persona wdt:P106 ?ocupacio }",
    "  OPTIONAL { ?article schema:about ?persona ; schema:isPartOf <https://ca.wikipedia.org/> }",
    '  SERVICE wikibase:label { bd:serviceParam wikibase:language "ca,es,en". }',
    "}",
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Lectura de les respostes
// ─────────────────────────────────────────────────────────────────────────────

type BindingSparql = Record<string, { value?: unknown } | undefined>;

const valor = (b: BindingSparql, clau: string): string | null => {
  const v = b[clau]?.value;
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
};

const bindings = (json: unknown): BindingSparql[] => {
  const b = (json as { results?: { bindings?: BindingSparql[] } })?.results?.bindings;
  return Array.isArray(b) ? b : [];
};

/** El servei d'etiquetes torna el QID quan no en troba cap: això no és un nom. */
const etiqueta = (b: BindingSparql, clau: string): string | null => {
  const v = valor(b, clau);
  return v === null || /^Q\d+$/.test(v) ? null : v;
};

const urlEntitat = (qid: string): string => `https://www.wikidata.org/wiki/${qid}`;

/**
 * Un agermanament per declaració. Una ciutat amb dos països (n'hi ha, per
 * canvis de frontera) surt en dues files i es queda la primera.
 */
export function parseAgermanaments(json: unknown): Map<string, AgermanamentWikidata[]> {
  const perMunicipi = new Map<string, Map<string, AgermanamentWikidata>>();
  for (const b of bindings(json)) {
    const muni = qidDeUri(valor(b, "muni"));
    const qid = qidDeUri(valor(b, "ciutat"));
    const nom = etiqueta(b, "ciutatLabel");
    if (muni === null || qid === null || nom === null) continue;
    const grup = perMunicipi.get(muni) ?? new Map<string, AgermanamentWikidata>();
    perMunicipi.set(muni, grup);
    if (grup.has(qid)) continue;
    grup.set(qid, {
      qid,
      nom,
      url: urlEntitat(qid),
      pais: etiqueta(b, "paisLabel"),
      paisQid: qidDeUri(valor(b, "pais")),
      inici: dataCurtaIso(valor(b, "inici")),
      fi: dataCurtaIso(valor(b, "fi")),
    });
  }
  const resultat = new Map<string, AgermanamentWikidata[]>();
  for (const [muni, grup] of perMunicipi) resultat.set(muni, ordenaAgermanaments([...grup.values()]));
  return resultat;
}

/** Per data d'inici, els més antics primer; els sense data, al final i per nom. */
export function ordenaAgermanaments(llista: readonly AgermanamentWikidata[]): AgermanamentWikidata[] {
  return [...llista].sort((a, b) => {
    if (a.inici === null) return b.inici === null ? a.nom.localeCompare(b.nom, "ca") : 1;
    if (b.inici === null) return -1;
    return a.inici.localeCompare(b.inici) || a.nom.localeCompare(b.nom, "ca");
  });
}

/** El recompte per municipi; un municipi que no surt a la resposta té zero persones. */
export function parseRecompte(json: unknown): Map<string, number> {
  const resultat = new Map<string, number>();
  for (const b of bindings(json)) {
    const muni = qidDeUri(valor(b, "muni"));
    const total = Number(valor(b, "total"));
    if (muni === null || !Number.isInteger(total) || total < 0) continue;
    resultat.set(muni, total);
  }
  return resultat;
}

/**
 * Una persona per QID i municipi. Les files repetides —una per ocupació, una
 * per fotografia— només hi afegeixen l'ocupació que faltava; la primera
 * fotografia és la que es queda, que és el que fa J28. Sense etiqueta en cap
 * dels tres idiomes la persona no es pot escriure i queda fora: el total del
 * recompte, que és el que diu la cobertura, ja l'ha comptada.
 */
export function parseNascuts(json: unknown): Map<string, PersonaNascuda[]> {
  const perMunicipi = new Map<string, Map<string, PersonaNascuda>>();
  for (const b of bindings(json)) {
    const muni = qidDeUri(valor(b, "muni"));
    const qid = qidDeUri(valor(b, "persona"));
    const nom = etiqueta(b, "personaLabel");
    if (muni === null || qid === null || nom === null) continue;
    const grup = perMunicipi.get(muni) ?? new Map<string, PersonaNascuda>();
    perMunicipi.set(muni, grup);
    const ocupacio = etiqueta(b, "ocupacioLabel");
    const previa = grup.get(qid);
    if (previa !== undefined) {
      if (ocupacio !== null && !previa.ocupacions.includes(ocupacio)) previa.ocupacions.push(ocupacio);
      previa.ocupacio ??= ocupacio;
      previa.fitxer ??= fitxerCommons(valor(b, "imatge"));
      previa.viquipedia ??= valor(b, "article");
      previa.naixement ??= dataCurtaIso(valor(b, "naixement"));
      previa.defuncio ??= dataCurtaIso(valor(b, "defuncio"));
      continue;
    }
    const enllacos = Number(valor(b, "sitelinks"));
    grup.set(qid, {
      qid,
      nom,
      url: urlEntitat(qid),
      viquipedia: valor(b, "article"),
      naixement: dataCurtaIso(valor(b, "naixement")),
      defuncio: dataCurtaIso(valor(b, "defuncio")),
      ocupacio,
      ocupacions: ocupacio === null ? [] : [ocupacio],
      enllacos: Number.isFinite(enllacos) ? enllacos : 0,
      fitxer: fitxerCommons(valor(b, "imatge")),
      imatge: null,
    });
  }
  const resultat = new Map<string, PersonaNascuda[]>();
  for (const [muni, grup] of perMunicipi) resultat.set(muni, primersNascuts([...grup.values()]));
  return resultat;
}

/** Els `quants` amb més enllaços d'entrada; a igualtat, per nom, perquè l'ordre sigui reproduïble. */
export function primersNascuts(persones: readonly PersonaNascuda[], quants: number = MAX_NASCUTS): PersonaNascuda[] {
  return [...persones]
    .sort((a, b) => b.enllacos - a.enllacos || a.nom.localeCompare(b.nom, "ca"))
    .slice(0, quants);
}

// ─────────────────────────────────────────────────────────────────────────────
// Els lots de la segona i la tercera passada
// ─────────────────────────────────────────────────────────────────────────────

export type LotsNascuts = {
  /** Municipis amb `max` persones o menys, agrupats perquè cada lot no passi de `perLot` persones. */
  petits: string[][];
  /** Municipis amb més de `max`: un per consulta, amb límit. */
  grans: string[];
};

/**
 * Reparteix els municipis segons el recompte. Els que no tenen cap persona no
 * van enlloc: no cal preguntar res per saber que la llista és buida. Un
 * municipi petit que tot sol passés de `perLot` no existeix per definició
 * (`max` és molt menor), i el lot que s'omple es tanca abans d'afegir-lo.
 */
export function lotsNascuts(
  qids: readonly string[],
  recompte: ReadonlyMap<string, number>,
  max: number = MAX_NASCUTS,
  perLot: number = PERSONES_PER_LOT,
): LotsNascuts {
  const petits: string[][] = [];
  const grans: string[] = [];
  let lot: string[] = [];
  let suma = 0;
  for (const qid of qids) {
    const total = recompte.get(qid) ?? 0;
    if (total === 0) continue;
    if (total > max) {
      grans.push(qid);
      continue;
    }
    if (suma + total > perLot && lot.length > 0) {
      petits.push(lot);
      lot = [];
      suma = 0;
    }
    lot.push(qid);
    suma += total;
  }
  if (lot.length > 0) petits.push(lot);
  return { petits, grans };
}

// ─────────────────────────────────────────────────────────────────────────────
// La fitxa que es desa
// ─────────────────────────────────────────────────────────────────────────────

/** Una fotografia de Commons que ha passat la llicència, en la forma que es desa. */
export function imatgePersona(resultat: ResultatRetrat | undefined): ImatgePersona | null {
  if (resultat === undefined || !resultat.ok) return null;
  const r = resultat.retrat;
  return { fitxer: r.fitxer, miniaturaUrl: r.miniaturaUrl, paginaFitxer: r.paginaFitxer, autor: r.autor, llicencia: r.llicencia };
}

export function fitxaCuriositatsWikidata(
  muni: { qid: string; ine5: string },
  agermanaments: readonly AgermanamentWikidata[],
  nascuts: { total: number; persones: readonly PersonaNascuda[] },
  consultat: string,
): FitxaCuriositatsWikidata {
  return {
    font: FONT,
    fontImatges: FONT_IMATGES,
    llicenciaDades: LLICENCIA_DADES,
    consultat,
    qidMunicipi: muni.qid,
    url: urlEntitat(muni.qid),
    ine5: muni.ine5,
    agermanaments: ordenaAgermanaments(agermanaments),
    nascuts: { total: nascuts.total, persones: primersNascuts(nascuts.persones) },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// El job
// ─────────────────────────────────────────────────────────────────────────────

export type OpcionsJ33 = {
  /** Qui fa les consultes SPARQL; només per a les proves, que no han de tocar la xarxa. */
  consulta?: (url: string) => Promise<unknown>;
  /** Qui crida l'API de Commons; ídem. */
  consultaCommons?: (url: string) => Promise<unknown>;
  /** Quants municipis com a màxim, per provar-ho amb pocs. */
  limit?: number;
};

export async function j33MunicipiWikidata(db: Db, options: OpcionsJ33 = {}): Promise<void> {
  await withRun(db, "j33-municipi-wikidata", async (run) => {
    const consulta = options.consulta ?? ((url: string) => fetchJson<unknown>(url, { delayMs: PAUSA_SPARQL_MS }));
    const consultaCommons =
      options.consultaCommons ?? ((url: string) => fetchJson<unknown>(url, { delayMs: PAUSA_COMMONS_MS }));
    const consultat = new Date().toISOString().slice(0, 10);

    // 1. Els QID dels municipis, de J20. No es torna a aparellar res.
    const fitxesJ20 = await db
      .select({ municipalityId: municipalityMetrics.municipalityId, data: municipalityMetrics.data })
      .from(municipalityMetrics)
      .where(eq(municipalityMetrics.kind, KIND_WIKIDATA));
    if (fitxesJ20.length === 0) throw new Error("no hi ha cap fitxa de Wikidata: cal executar J20 abans");
    const munis = new Map((await db.select({ id: municipalities.id, ine5: municipalities.ine5 }).from(municipalities)).map((m) => [m.id, m]));
    const perQid = new Map<string, { municipalityId: number; qid: string; ine5: string }>();
    for (const f of fitxesJ20) {
      const qid = (f.data as FitxaWikidata)?.qid;
      const muni = munis.get(f.municipalityId);
      if (typeof qid !== "string" || muni === undefined) continue;
      perQid.set(qid, { municipalityId: f.municipalityId, qid, ine5: muni.ine5 });
    }
    const llista = [...perQid.values()].slice(0, options.limit ?? Infinity);
    const qids = llista.map((m) => m.qid);
    run.rowsIn = llista.length;
    run.say(`${llista.length} municipis amb QID (de ${fitxesJ20.length} fitxes de J20)`);

    // 2. Els agermanaments, per lots.
    const agermanaments = new Map<string, AgermanamentWikidata[]>();
    let crides = 0;
    for (const lot of trossos(qids, MUNICIPIS_PER_CRIDA)) {
      const json = await consulta(urlConsulta(consultaAgermanaments(lot)));
      crides += 1;
      for (const [muni, llistaMuni] of parseAgermanaments(json)) agermanaments.set(muni, llistaMuni);
    }
    run.say(`${crides} consultes d'agermanaments · ${agermanaments.size} municipis amb algun`);

    // 3. Les persones: recompte, els municipis petits en lots i els grans d'un en un.
    const recompte = new Map<string, number>();
    for (const lot of trossos(qids, MUNICIPIS_PER_CRIDA)) {
      const json = await consulta(urlConsulta(consultaRecompteNascuts(lot)));
      crides += 1;
      for (const [muni, total] of parseRecompte(json)) recompte.set(muni, total);
    }
    const lots = lotsNascuts(qids, recompte);
    const nascuts = new Map<string, PersonaNascuda[]>();
    for (const lot of lots.petits) {
      const json = await consulta(urlConsulta(consultaNascuts(lot, null)));
      crides += 1;
      for (const [muni, persones] of parseNascuts(json)) nascuts.set(muni, persones);
    }
    for (const qid of lots.grans) {
      const json = await consulta(urlConsulta(consultaNascuts([qid], MAX_NASCUTS)));
      crides += 1;
      for (const [muni, persones] of parseNascuts(json)) nascuts.set(muni, persones);
    }
    const totalPersones = [...recompte.values()].reduce((a, b) => a + b, 0);
    run.say(
      `${crides} consultes SPARQL en total · ${recompte.size} municipis amb alguna persona nascuda (${totalPersones} en total) · ${lots.petits.length} lots de petits · ${lots.grans.length} grans d'un en un`,
    );

    // 4. La llicència de cada fotografia, a Commons, en lots de 50 títols.
    const llicencies = new Map<string, ResultatRetrat>();
    const titols = [...new Set([...nascuts.values()].flat().flatMap((p) => (p.fitxer === null ? [] : [p.fitxer])))];
    let cridesCommons = 0;
    for (const grup of trossos(titols, FITXERS_PER_CRIDA)) {
      try {
        // Una resposta amb `continue` és una resposta a mitges: es torna a
        // demanar fins que arriba sencera, amb un límit de voltes per no
        // quedar-s'hi. El que no arribi es descarta com a «no tornat».
        const respostes: unknown[] = [];
        let continuacio: Record<string, string> | null = null;
        do {
          const json = await consultaCommons(urlImageinfo(grup, AMPLADA_CARA, continuacio ?? undefined));
          cridesCommons += 1;
          respostes.push(json);
          continuacio = continuacioDe(json);
        } while (continuacio !== null && respostes.length < 5);
        for (const [titol, resultat] of llegeixImageinfo(respostes, grup)) llicencies.set(titol, resultat);
      } catch (error) {
        // Un lot que peta no s'endú la feina: les seves cares queden sense
        // llicència i, per tant, sense publicar. La propera execució hi torna.
        await run.issue({
          kind: "commons_llicencia_error",
          severity: "mitjana",
          detail: { fitxers: grup.length, primer: grup[0] ?? null, error: String(error) },
        });
      }
    }
    run.say(`${titols.length} fotografies a comprovar · ${cridesCommons} crides a l'API de Commons`);

    // 5. Una fitxa per municipi, també per als que no tenen res: que quedi
    //    constància que s'ha mirat i quan.
    let totalAgermanaments = 0;
    let totalDesats = 0;
    let ambCara = 0;
    let ambViquipedia = 0;
    const perMotiu = new Map<string, number>();
    for (const muni of llista) {
      const persones = (nascuts.get(muni.qid) ?? []).map((p) => {
        const resultat = p.fitxer === null ? undefined : llicencies.get(p.fitxer);
        if (resultat !== undefined && !resultat.ok) perMotiu.set(resultat.motiu, (perMotiu.get(resultat.motiu) ?? 0) + 1);
        return { ...p, imatge: imatgePersona(resultat) };
      });
      const data = fitxaCuriositatsWikidata(
        muni,
        agermanaments.get(muni.qid) ?? [],
        { total: recompte.get(muni.qid) ?? 0, persones },
        consultat,
      );
      totalAgermanaments += data.agermanaments.length;
      totalDesats += data.nascuts.persones.length;
      ambCara += data.nascuts.persones.filter((p) => p.imatge !== null).length;
      ambViquipedia += data.nascuts.persones.filter((p) => p.viquipedia !== null).length;
      await db
        .insert(municipalityMetrics)
        .values({ municipalityId: muni.municipalityId, kind: KIND, data })
        .onConflictDoUpdate({
          target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
          set: { data, computedAt: new Date() },
        });
      run.rowsOut += 1;
    }
    if (perMotiu.size > 0) {
      await run.issue({
        kind: "commons_cares_descartades",
        severity: "baixa",
        detail: { perMotiu: Object.fromEntries(perMotiu) },
      });
    }
    run.say(
      `${totalAgermanaments} agermanaments · ${totalDesats} persones desades (de ${totalPersones}) · ${ambCara} amb cara publicable · ${ambViquipedia} amb article a la Viquipèdia`,
    );
    return {
      font: FONT,
      consultat,
      municipis: llista.length,
      crides,
      cridesCommons,
      agermanaments: totalAgermanaments,
      personesTotal: totalPersones,
      personesDesades: totalDesats,
      ambCara,
      ambViquipedia,
      caresDescartades: Object.fromEntries(perMotiu),
    };
  });
}
