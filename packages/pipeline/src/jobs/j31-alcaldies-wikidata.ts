import { eq } from "drizzle-orm";
import { municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { fetchJson } from "../lib/http";
import { normalize } from "../lib/text";
import { withRun } from "../lib/run";
import { KIND as KIND_WIKIDATA, fitxerCommons, type FitxaWikidata } from "./j20-wikidata";
import { dataCurtaIso, qidDeUri, trossos, urlConsulta } from "./j21-trajectoria-electes";

/**
 * J31 — les alcaldies segons Wikidata, per omplir els forats de la Generalitat.
 *
 * L'historial d'alcaldes i alcaldesses 1979-2027 de la Generalitat és la font
 * oficial, però té forats que es veuen a simple vista a les ciutats grans. A
 * Badalona hi consta **una** alcaldia per mandat quan n'hi va haver dues o
 * tres: el 2015-2019 hi van ser Dolors Sabater (fins a la moció de censura del
 * 2018) i Àlex Pastor; el 2019-2023, Pastor (que va dimitir l'abril del 2020),
 * Aïda Llauradó de manera interina, Xavier García Albiol i, per moció de
 * censura, Rubén Guijarro. I el partit hi surt retallat («BADALONA EN COM»).
 *
 * Wikidata sí que ho té, i ho té estructurat: a l'element del municipi, cada
 * alcaldia és una declaració de **P6** (cap de govern) amb qualificadors
 * **P580** (inici), **P582** (fi) i, quan algú s'hi ha entretingut, **P1534**
 * (causa del final: dimissió, moció de censura, defunció…). De cada persona
 * se'n treu el partit (**P102**) i la fotografia (**P18**).
 *
 * Aquest job **només descarrega i desa**: una fitxa per municipi a
 * `municipality_metrics` amb `kind = "alcaldiesWikidata"`. La fusió amb
 * l'historial oficial és feina de `derive/alcaldies.ts`, que la crida
 * `derive/mayor-changes.ts`: així el que ve de Wikidata queda desat tal com
 * és, i es pot canviar el criteri de fusió sense tornar a consultar res.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * D'ON SURTEN ELS QID DELS MUNICIPIS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * De la fitxa de J20 (`kind = "wikidata"`), que ja va aparellar els 947
 * municipis pel codi INE (P772) i en va desar el QID. No es torna a fer:
 * si J20 no s'ha executat, aquest job s'atura i ho diu.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * RITME
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Lots de 40 municipis per consulta: cada municipi té una dotzena de
 * declaracions de P6, i amb els partits múltiples d'alguna persona la resposta
 * es queda en uns centenars de files. Són unes 25 consultes en total, amb la
 * mateixa pausa que J21 i J28 i amb els reintents de `fetchJson`, que ja
 * respecta el 429 de WDQS.
 *
 * Fonts: https://query.wikidata.org/sparql (dades CC0 1.0).
 */

export const KIND = "alcaldiesWikidata";

const FONT = "Wikidata (wikidata.org)";
const LLICENCIA_DADES = "CC0 1.0";

/** Municipis per consulta SPARQL. */
const MUNICIPIS_PER_CRIDA = 40;

/** Pausa entre consultes SPARQL, la mateixa que J21 i J28. */
const PAUSA_SPARQL_MS = 600;

/** Abans d'això no hi ha ajuntaments democràtics, i la Generalitat tampoc no hi arriba. */
const ANY_INICIAL = 1979;

// ─────────────────────────────────────────────────────────────────────────────
// El que es desa
// ─────────────────────────────────────────────────────────────────────────────

/** Una alcaldia tal com la declara Wikidata a l'element del municipi. */
export type AlcaldiaWikidata = {
  /** QID de la persona. */
  qid: string;
  nom: string;
  /** Inici (P580) en `AAAA-MM-DD`; `null` si la declaració no en porta. */
  inici: string | null;
  /** Fi (P582) en `AAAA-MM-DD`; `null` si encara hi és o si no consta. */
  fi: string | null;
  /** Etiqueta en català de la causa del final (P1534), si algú l'ha posada. */
  motiuFinal: string | null;
  motiuFinalQid: string | null;
  /** El càrrec o el rol diuen que va ser una alcaldia interina o en funcions. */
  interina: boolean;
  /** Etiqueta en català del partit (P102) de la persona; el primer si en té més d'un. */
  partit: string | null;
  partitQid: string | null;
  /** Tots els partits que Wikidata li atribueix, per si el primer no és el del mandat. */
  partits: string[];
  /** Títol del fitxer de Commons de la fotografia (P18), o `null`. */
  imatge: string | null;
};

export type FitxaAlcaldiesWikidata = {
  font: string;
  llicenciaDades: string;
  /** Data de consulta en ISO: sense data, cap dada no entra a la fitxa. */
  consultat: string;
  qidMunicipi: string;
  url: string;
  ine5: string;
  /** Cronològiques, de la més antiga a la més recent; les sense inici, al final. */
  alcaldies: AlcaldiaWikidata[];
};

// ─────────────────────────────────────────────────────────────────────────────
// La consulta
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Totes les alcaldies (P6) d'un lot de municipis, amb els qualificadors que
 * expliquen el relleu i el que de la persona ens cal a la fitxa.
 *
 * Les declaracions **obsoletes** (rang deprecated) queden fora: són les que
 * algú ha marcat com a errònies, i no volem ressuscitar-les. Les etiquetes
 * vénen del servei d'etiquetes amb el català primer i el castellà i l'anglès
 * de recanvi, perquè un partit sense etiqueta en català val més que cap.
 *
 * El rol (P2868) i el càrrec concret (P39 com a qualificador) hi són per
 * detectar les alcaldies interines o en funcions: Wikidata no té una manera
 * única de dir-ho i es mira l'etiqueta de totes dues.
 */
export function consultaAlcaldies(qidsMunicipis: readonly string[]): string {
  return [
    "SELECT ?muni ?persona ?personaLabel ?inici ?fi ?causa ?causaLabel ?rolLabel ?carrecLabel ?partit ?partitLabel ?imatge WHERE {",
    `  VALUES ?muni { ${qidsMunicipis.map((q) => `wd:${q}`).join(" ")} }`,
    "  ?muni p:P6 ?st .",
    "  ?st ps:P6 ?persona ; wikibase:rank ?rang .",
    "  FILTER(?rang != wikibase:DeprecatedRank)",
    "  OPTIONAL { ?st pq:P580 ?inici }",
    "  OPTIONAL { ?st pq:P582 ?fi }",
    "  OPTIONAL { ?st pq:P1534 ?causa }",
    "  OPTIONAL { ?st pq:P2868 ?rol }",
    "  OPTIONAL { ?st pq:P39 ?carrec }",
    "  OPTIONAL { ?persona wdt:P102 ?partit }",
    "  OPTIONAL { ?persona wdt:P18 ?imatge }",
    '  SERVICE wikibase:label { bd:serviceParam wikibase:language "ca,es,en". }',
    "}",
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Lectura de la resposta
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

/**
 * Quan el servei d'etiquetes no en troba cap, torna el QID com a etiqueta
 * («Q12345»): això no és un nom i es tracta com si no n'hi hagués.
 */
const etiqueta = (b: BindingSparql, clau: string): string | null => {
  const v = valor(b, clau);
  return v === null || /^Q\d+$/.test(v) ? null : v;
};

/** Diu «interí», «interina», «en funcions», «accidental» o «acting»: alcaldia interina. */
export function esInterina(...etiquetes: (string | null)[]): boolean {
  return etiquetes.some((e) => e !== null && /\b(interi|interina|interino|en funcions|accidental|acting|en funciones)\b/.test(normalize(e)));
}

/**
 * De cada fila de SPARQL, una alcaldia per declaració. Una persona amb dos
 * partits o dues fotografies surt en dues o quatre files: la clau és
 * municipi + persona + inici, i les files repetides només hi afegeixen el
 * partit que faltava. El primer partit que arriba és el que es publica com a
 * `partit`; la resta queden a `partits` perquè la fusió pugui mirar-s'ho.
 */
export function parseAlcaldies(json: unknown): Map<string, AlcaldiaWikidata[]> {
  const perMunicipi = new Map<string, Map<string, AlcaldiaWikidata>>();
  for (const b of bindings(json)) {
    const muni = qidDeUri(valor(b, "muni"));
    const qid = qidDeUri(valor(b, "persona"));
    const nom = etiqueta(b, "personaLabel");
    if (muni === null || qid === null || nom === null) continue;
    const inici = dataCurtaIso(valor(b, "inici"));
    const clau = `${qid}|${inici ?? ""}`;
    const grup = perMunicipi.get(muni) ?? new Map<string, AlcaldiaWikidata>();
    perMunicipi.set(muni, grup);
    const partit = etiqueta(b, "partitLabel");
    const partitQid = qidDeUri(valor(b, "partit"));
    const previa = grup.get(clau);
    if (previa !== undefined) {
      if (partit !== null && !previa.partits.includes(partit)) previa.partits.push(partit);
      if (previa.partit === null && partit !== null) {
        previa.partit = partit;
        previa.partitQid = partitQid;
      }
      if (previa.imatge === null) previa.imatge = fitxerCommons(valor(b, "imatge"));
      if (previa.fi === null) previa.fi = dataCurtaIso(valor(b, "fi"));
      if (previa.motiuFinal === null) {
        previa.motiuFinal = etiqueta(b, "causaLabel");
        previa.motiuFinalQid = qidDeUri(valor(b, "causa"));
      }
      previa.interina = previa.interina || esInterina(etiqueta(b, "rolLabel"), etiqueta(b, "carrecLabel"));
      continue;
    }
    grup.set(clau, {
      qid,
      nom,
      inici,
      fi: dataCurtaIso(valor(b, "fi")),
      motiuFinal: etiqueta(b, "causaLabel"),
      motiuFinalQid: qidDeUri(valor(b, "causa")),
      interina: esInterina(etiqueta(b, "rolLabel"), etiqueta(b, "carrecLabel")),
      partit,
      partitQid: partit === null ? null : partitQid,
      partits: partit === null ? [] : [partit],
      imatge: fitxerCommons(valor(b, "imatge")),
    });
  }
  const resultat = new Map<string, AlcaldiaWikidata[]>();
  for (const [muni, grup] of perMunicipi) resultat.set(muni, ordenaAlcaldies([...grup.values()]));
  return resultat;
}

/** Cronològiques; les que no tenen inici, al final, que no es poden situar. */
export function ordenaAlcaldies(alcaldies: readonly AlcaldiaWikidata[]): AlcaldiaWikidata[] {
  return [...alcaldies].sort((a, b) => {
    if (a.inici === null) return b.inici === null ? a.nom.localeCompare(b.nom) : 1;
    if (b.inici === null) return -1;
    return a.inici.localeCompare(b.inici) || a.nom.localeCompare(b.nom);
  });
}

/**
 * Les alcaldies que ens interessen: des del 1979. Wikidata té alcaldes
 * franquistes i de la República a molts municipis, i aquí no hi pinten res:
 * l'historial que completem comença amb les primeres municipals democràtiques.
 * Les que no tenen inici es queden, perquè la fusió decideixi què en fa.
 */
export function desDelInici(alcaldies: readonly AlcaldiaWikidata[]): AlcaldiaWikidata[] {
  return alcaldies.filter((a) => a.inici === null || Number(a.inici.slice(0, 4)) >= ANY_INICIAL);
}

export function fitxaAlcaldiesWikidata(
  muni: { qid: string; ine5: string },
  alcaldies: readonly AlcaldiaWikidata[],
  consultat: string,
): FitxaAlcaldiesWikidata {
  return {
    font: FONT,
    llicenciaDades: LLICENCIA_DADES,
    consultat,
    qidMunicipi: muni.qid,
    url: `https://www.wikidata.org/wiki/${muni.qid}`,
    ine5: muni.ine5,
    alcaldies: ordenaAlcaldies(desDelInici(alcaldies)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// El job
// ─────────────────────────────────────────────────────────────────────────────

export type OpcionsJ31 = {
  /** Qui fa la consulta; només per a les proves, que no han de tocar la xarxa. */
  consulta?: (url: string) => Promise<unknown>;
  /** Quants municipis com a màxim, per provar-ho amb pocs. */
  limit?: number;
};

export async function j31AlcaldiesWikidata(db: Db, options: OpcionsJ31 = {}): Promise<void> {
  await withRun(db, "j31-alcaldies-wikidata", async (run) => {
    const consulta = options.consulta ?? ((url: string) => fetchJson<unknown>(url, { delayMs: PAUSA_SPARQL_MS }));
    const consultat = new Date().toISOString().slice(0, 10);

    // 1. Els QID dels municipis, de J20.
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
    run.rowsIn = llista.length;
    run.say(`${llista.length} municipis amb QID (de ${fitxesJ20.length} fitxes de J20)`);

    // 2. Les alcaldies, per lots.
    const alcaldies = new Map<string, AlcaldiaWikidata[]>();
    let crides = 0;
    for (const lot of trossos(llista.map((m) => m.qid), MUNICIPIS_PER_CRIDA)) {
      const json = await consulta(urlConsulta(consultaAlcaldies(lot)));
      crides += 1;
      for (const [muni, llistaMuni] of parseAlcaldies(json)) alcaldies.set(muni, llistaMuni);
    }
    run.say(`${crides} consultes SPARQL · ${alcaldies.size} municipis amb alguna alcaldia a Wikidata`);

    // 3. Una fitxa per municipi, també per als que no en tenen cap: que quedi
    //    constància que s'ha mirat i quan.
    let totalAlcaldies = 0;
    let ambMotiu = 0;
    let interines = 0;
    let senseInici = 0;
    for (const muni of llista) {
      const data = fitxaAlcaldiesWikidata(muni, alcaldies.get(muni.qid) ?? [], consultat);
      totalAlcaldies += data.alcaldies.length;
      ambMotiu += data.alcaldies.filter((a) => a.motiuFinal !== null).length;
      interines += data.alcaldies.filter((a) => a.interina).length;
      senseInici += data.alcaldies.filter((a) => a.inici === null).length;
      await db
        .insert(municipalityMetrics)
        .values({ municipalityId: muni.municipalityId, kind: KIND, data })
        .onConflictDoUpdate({
          target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
          set: { data, computedAt: new Date() },
        });
      run.rowsOut += 1;
    }
    run.say(`${totalAlcaldies} alcaldies des del ${ANY_INICIAL} · ${ambMotiu} amb motiu del final · ${interines} interines · ${senseInici} sense data d'inici`);
    return { font: FONT, consultat, municipis: llista.length, crides, alcaldies: totalAlcaldies, ambMotiu, interines, senseInici };
  });
}
