import { and, eq } from "drizzle-orm";
import {
  candidacies, candidatures, councilTerms, councillorMandates, municipalities, municipalityMetrics, people,
  politicalGroups, type Db,
} from "@quivoto/db";
import { BRANDS_BY_ID, siglesFamily } from "@quivoto/shared-schemas/brands";
import { HttpError, sleep } from "../lib/http";
import { nomLlegible, normalizePersonName } from "../lib/text";
import { withRun } from "../lib/run";
import { OCUPACIO_POLITIC, dataCurtaIso, normalitzaIne, qidDeUri, trossos } from "./j21-trajectoria-electes";

/**
 * J27 — qui són els que seuen als plens, segons Wikidata.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÈ FALTAVA
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * J21 pregunta a Wikidata per les **alcaldies** des del 1979, i ho fa per una
 * posició que ja és del municipi («alcalde de Reus»): l'aparellament és quasi
 * determinista. Però la pàgina de cada persona del ple no la mira només qui
 * busca l'alcalde: la mira qui busca l'alcaldable que va perdre, o la regidora
 * que abans havia estat diputada. Elisenda Alamany va anar de número dos d'ERC
 * a Barcelona el 2023, seu al ple i porta el grup, i la seva pàgina deia el
 * mateix que la del número dinou d'una llista qualsevol: on seu, i prou.
 *
 * Aquesta feina agafa **tothom que seu als 947 plens del mandat 2023-2027**
 * (`councillor_mandates`, ~9.150 persones), amb els caps de llista del 2023
 * marcats i cercats primer, i busca a Wikidata qui són: ofici, any de
 * naixement, partit, càrrecs amb dates i article a la Viquipèdia. És l'única
 * informació de perfil que no tenim de cap font oficial i que és pública per
 * la mateixa raó que el càrrec ho és.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PER NOM, I PER AIXÒ AMB MÉS PORS QUE J21
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * No hi ha cap posició de Wikidata que digui «regidora de Vic pel grup d'ERC
 * des del 2023»: aquí **s'ha de buscar pel nom**, i buscar per nom és trobar
 * homònims. Per això un nom que lliga no és mai prou. La fitxa trobada ha de
 * dir, a més, alguna cosa que la lligui amb el municipi o amb la candidatura:
 *
 *   1. **Un càrrec en aquest municipi** (P39 amb P1001 → P772 igual al nostre
 *      codi INE): «regidor de l'Ajuntament de Barcelona», «alcalde de Vic».
 *   2. **Haver-hi nascut o viure-hi** (P19 o P551 amb el mateix codi INE).
 *   3. **El mateix partit** (P102 de la mateixa família que les sigles de la
 *      llista o del grup) **i un peu a Catalunya**: nascut o resident a
 *      Catalunya, o algun càrrec l'àmbit del qual és a Catalunya.
 *
 * Si cap fitxa amb aquell nom no compleix res d'això, no s'aparella. Si en
 * compleixen dues, tampoc: una fitxa penjada de la persona equivocada és pitjor
 * que cap, i encara més en una pàgina que porta el nom al títol. I quan una
 * mateixa fitxa de Wikidata lliga amb dues persones de dos municipis pel
 * criteri fluix del partit, es descarta per a totes dues: un «Josep Puig» d'ERC
 * nascut a Catalunya pot ser qualsevol dels dos.
 *
 * El que J21 ja sap —els alcaldes— no es repeteix aquí: la pàgina de la persona
 * prefereix la fitxa de J21 quan en té, i la d'aquesta feina omple els altres.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LES CONSULTES, I PER QUÈ VAN PER POST
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Tres, com a J21, i en lots amb VALUES:
 *
 *   · **Cerca** per etiqueta i àlies (`rdfs:label|skos:altLabel`) en català i
 *     castellà, de les formes del nom que podem preveure: el nom sencer, sense
 *     el segon cognom i amb la «i» entre els dos. La comparació d'una etiqueta
 *     és exacta i sensible als accents: un nom que el registre escriu sense
 *     accent i Wikidata amb no lliga, i la feina ho compta en comptes de
 *     forçar-ho. El registre d'electes no separa nom i cognoms, i per això les
 *     formes curtes es dedueixen dels mots: quan la deducció s'equivoca, la
 *     forma no lliga amb ningú i no passa res, perquè el nom sol no aparella.
 *   · **Perfil** dels ítems trobats: naixement, lloc de naixement i residència
 *     (amb el codi INE i si és a Catalunya), partit, ofici i articles.
 *   · **Càrrecs** (P39) amb dates i l'àmbit (P1001), que és el que dona el codi
 *     INE del municipi del càrrec.
 *
 * Van per **POST** i no per GET com J20 i J21. Comprovat el 30-08-2026 contra
 * query.wikidata.org: un GET amb 150 literals (7,5 kB d'URL) respon **431**, i
 * amb 110 encara passa; un POST amb 600 literals respon 200 en 1,3 s. Amb cent
 * persones per lot i sis literals per persona són uns 92 lots de cerca per als
 * 9.150 electes, més uns trenta de perfil i càrrecs: **uns 125 crides amb
 * pausa, uns cinc minuts**. No és un job de «fitxa a fitxa» i va a mà:
 * `pnpm ingest j27`.
 *
 * Font: https://query.wikidata.org/sparql. Les dades de Wikidata són **CC0
 * 1.0**, i la fitxa en desa la llicència i la data d'extracció perquè sense
 * data cap dada no entra a la pàgina.
 */

/**
 * La clau de la mètrica. Va néixer per als caps de llista i ara hi ha tot el
 * ple; es conserva perquè és el que llegeix la publicació, i cada persona
 * porta `capDeLlista` per distingir-los.
 */
export const KIND = "capsDeLlista";

export const ELECCIO = "M20231";

const FONT = "Wikidata (wikidata.org)";
const ENDPOINT_SPARQL = "https://query.wikidata.org/sparql";
const LLICENCIA = "CC0 1.0";

/** Catalunya, per saber si un lloc o l'àmbit d'un càrrec hi cau a dins. */
export const CATALUNYA = "Q5705";

/** Quantes persones per consulta de cerca: fins a sis literals cadascuna, per POST. */
const NOMS_PER_CRIDA = 100;

/** Quants QID per consulta de perfil o de càrrecs. El mateix llindar que J21. */
const QIDS_PER_CRIDA = 300;

/** Pausa entre crides. Són poc més de cent i cap pressa: el servei ens les dona de franc. */
const PAUSA_MS = 600;

/**
 * El mateix User-Agent que `lib/http`, que Wikidata exigeix per servir clients
 * que no siguin anònims. Es repeteix aquí perquè `fetchJson()` només fa GET i
 * aquestes consultes no hi caben; el dia que `lib/http` sàpiga fer POST,
 * aquesta constant i `consultaWdqs()` sobren.
 */
const USER_AGENT = "quivoto/0.1 (brúixola electoral municipal; hola@quivoto.cat)";

/**
 * Una consulta SPARQL per POST, amb els mateixos reintents i la mateixa espera
 * creixent que `fetchJson()`: WDQS torna 429 i 503 quan va carregat, i un 4xx
 * que no sigui 429 no millorarà reintentant.
 */
export async function consultaWdqs<T>(consulta: string, options: { retries?: number; delayMs?: number } = {}): Promise<T> {
  const { retries = 4, delayMs = 0 } = options;
  if (delayMs > 0) await sleep(delayMs);
  const url = `${ENDPOINT_SPARQL}?format=json`;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded",
          "user-agent": USER_AGENT,
        },
        body: `query=${encodeURIComponent(consulta)}`,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new HttpError(response.status, url, await response.text().catch(() => ""));
      }
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      if (error instanceof HttpError && error.status < 500 && error.status !== 429) throw error;
      if (attempt === retries) break;
      await sleep(500 * 2 ** attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

// ─────────────────────────────────────────────────────────────────────────────
// Els noms i les seves formes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Les formes amb què Wikidata pot tenir escrit aquest nom.
 *
 * El registre d'electes el dona sencer i amb els dos cognoms; Wikidata
 * l'etiqueta com el porta la premsa: sovint amb un sol cognom («Elisenda
 * Alamany») o amb la «i» entre els dos («Elisenda Alamany i Gutiérrez»). Com
 * que el registre no separa nom i cognoms, les formes curtes es dedueixen dels
 * mots —l'últim és el segon cognom— i quan la deducció s'equivoca («Joan Pere
 * Coll» no té segon cognom) la forma no lliga amb ningú i no passa res: el nom
 * sol no aparella mai. Cada forma passa per `nomLlegible()` perquè el registre
 * escriu en majúscules i les etiquetes són sensibles a la caixa.
 */
export function variantsDelNom(nom: string): string[] {
  const net = nomLlegible(nom.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim());
  if (net === "") return [];
  const formes = [net];
  const mots = net.split(" ");
  if (mots.length >= 3 && !/^i$/i.test(mots[mots.length - 2]!)) {
    formes.push(mots.slice(0, -1).join(" "));
    formes.push(`${mots.slice(0, -1).join(" ")} i ${mots[mots.length - 1]}`);
  }
  return [...new Set(formes)];
}

/** Un literal SPARQL entre cometes, amb el que hi ha a dins escapat. */
const literal = (text: string, lang: string): string =>
  `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"@${lang}`;

/**
 * La cerca per etiqueta. `skos:altLabel` hi entra perquè l'àlies és justament
 * on Wikidata desa «Elisenda Alamany» quan l'etiqueta és el nom sencer; només
 * persones (P31 = Q5), que és el que treu els carrers i les escoles que porten
 * el nom d'algú.
 */
export function consultaCerca(variants: readonly string[]): string {
  const literals = variants.flatMap((v) => [literal(v, "ca"), literal(v, "es")]);
  return [
    "SELECT DISTINCT ?persona ?nom WHERE {",
    `  VALUES ?nom { ${literals.join(" ")} }`,
    "  ?persona rdfs:label|skos:altLabel ?nom .",
    "  ?persona wdt:P31 wd:Q5 .",
    "}",
  ].join("\n");
}

/**
 * El perfil. Cada lloc porta el seu codi INE (P772) si és un municipi, i si
 * cau a Catalunya seguint la cadena administrativa (P131*): és el que permet
 * distingir la regidora de Vic d'una homònima de Múrcia.
 */
export function consultaPerfil(qids: readonly string[]): string {
  return [
    "PREFIX schema: <http://schema.org/>",
    "SELECT ?persona ?etiqueta ?etiquetaEs ?naixement ?naixIne ?naixCat ?resIne ?resCat",
    "       ?partit ?partitNom ?ocupacio ?ocupacioNom ?articleCa ?articleEs WHERE {",
    `  VALUES ?persona { ${qids.map((q) => `wd:${q}`).join(" ")} }`,
    '  OPTIONAL { ?persona rdfs:label ?etiqueta FILTER(lang(?etiqueta) = "ca") }',
    '  OPTIONAL { ?persona rdfs:label ?etiquetaEs FILTER(lang(?etiquetaEs) = "es") }',
    "  OPTIONAL { ?persona wdt:P569 ?naixement }",
    "  OPTIONAL {",
    "    ?persona wdt:P19 ?naix .",
    "    OPTIONAL { ?naix wdt:P772 ?naixIne }",
    `    BIND(EXISTS { ?naix wdt:P131* wd:${CATALUNYA} } AS ?naixCat)`,
    "  }",
    "  OPTIONAL {",
    "    ?persona wdt:P551 ?res .",
    "    OPTIONAL { ?res wdt:P772 ?resIne }",
    `    BIND(EXISTS { ?res wdt:P131* wd:${CATALUNYA} } AS ?resCat)`,
    "  }",
    "  OPTIONAL {",
    "    ?persona wdt:P102 ?partit .",
    '    ?partit rdfs:label ?partitNom FILTER(lang(?partitNom) = "ca")',
    "  }",
    "  OPTIONAL {",
    "    ?persona wdt:P106 ?ocupacio .",
    '    ?ocupacio rdfs:label ?ocupacioNom FILTER(lang(?ocupacioNom) = "ca")',
    "  }",
    "  OPTIONAL { ?articleCa schema:about ?persona ; schema:isPartOf <https://ca.wikipedia.org/> }",
    "  OPTIONAL { ?articleEs schema:about ?persona ; schema:isPartOf <https://es.wikipedia.org/> }",
    "}",
  ].join("\n");
}

/**
 * Els càrrecs, tots: aquí no es treuen les alcaldies com fa J21, perquè «va ser
 * alcaldessa de Vic del 2011 al 2015» és justament el que respon qui és.
 * L'àmbit (P1001) és el que dona el codi INE del municipi del càrrec.
 */
export function consultaCarrecs(qids: readonly string[]): string {
  return [
    "SELECT ?persona ?carrec ?etiqueta ?inici ?fi ?ine ?cat WHERE {",
    `  VALUES ?persona { ${qids.map((q) => `wd:${q}`).join(" ")} }`,
    "  ?persona p:P39 ?st .",
    "  ?st ps:P39 ?carrec .",
    "  OPTIONAL { ?st pq:P580 ?inici }",
    "  OPTIONAL { ?st pq:P582 ?fi }",
    '  OPTIONAL { ?carrec rdfs:label ?etiqueta FILTER(lang(?etiqueta) = "ca") }',
    "  OPTIONAL {",
    "    ?carrec wdt:P1001 ?ambit .",
    "    OPTIONAL { ?ambit wdt:P772 ?ine }",
    `    BIND(EXISTS { ?ambit wdt:P131* wd:${CATALUNYA} } AS ?cat)`,
    "  }",
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

const cert = (b: BindingSparql, clau: string): boolean => valor(b, clau) === "true";

const bindings = (json: unknown): BindingSparql[] => {
  const b = (json as { results?: { bindings?: BindingSparql[] } })?.results?.bindings;
  return Array.isArray(b) ? b : [];
};

export type Trobat = { qid: string; nom: string };

export function parseCerca(json: unknown): Trobat[] {
  const files: Trobat[] = [];
  const vistos = new Set<string>();
  for (const b of bindings(json)) {
    const qid = qidDeUri(valor(b, "persona"));
    const nom = valor(b, "nom");
    if (qid === null || nom === null) continue;
    const clau = `${qid}|${nom}`;
    if (vistos.has(clau)) continue;
    vistos.add(clau);
    files.push({ qid, nom });
  }
  return files;
}

export type PerfilCap = {
  qid: string;
  etiqueta: string | null;
  /** Només l'any: el dia de naixement d'algú no té cap relleu per al control d'un ple. */
  naixement: number | null;
  /** Codis INE dels llocs de naixement i de residència, quan són municipis. */
  llocs: string[];
  /** Si algun d'aquells llocs és a Catalunya. */
  catalunya: boolean;
  partits: string[];
  ocupacions: string[];
  articleCa: string | null;
  articleEs: string | null;
};

export function parsePerfil(json: unknown): PerfilCap[] {
  const perQid = new Map<string, PerfilCap & { ocupacionsVistes: Set<string> }>();
  for (const b of bindings(json)) {
    const qid = qidDeUri(valor(b, "persona"));
    if (qid === null) continue;
    let perfil = perQid.get(qid);
    if (perfil === undefined) {
      perfil = {
        qid, etiqueta: null, naixement: null, llocs: [], catalunya: false, partits: [],
        ocupacions: [], articleCa: null, articleEs: null, ocupacionsVistes: new Set(),
      };
      perQid.set(qid, perfil);
    }
    perfil.etiqueta ??= valor(b, "etiqueta") ?? valor(b, "etiquetaEs");
    const naixement = dataCurtaIso(valor(b, "naixement"));
    if (naixement !== null && perfil.naixement === null) perfil.naixement = Number(naixement.slice(0, 4));
    for (const clau of ["naixIne", "resIne"]) {
      const ine5 = normalitzaIne(valor(b, clau));
      if (ine5 !== null && !perfil.llocs.includes(ine5)) perfil.llocs.push(ine5);
    }
    if (cert(b, "naixCat") || cert(b, "resCat")) perfil.catalunya = true;
    const partit = valor(b, "partitNom");
    if (partit !== null && !perfil.partits.includes(partit)) perfil.partits.push(partit);
    const ocupacioQid = qidDeUri(valor(b, "ocupacio"));
    const ocupacio = valor(b, "ocupacioNom");
    // «Polític» no diu res de ningú que segui en un ple: és la política mateixa.
    if (ocupacioQid !== null && ocupacioQid !== OCUPACIO_POLITIC && ocupacio !== null) {
      if (!perfil.ocupacionsVistes.has(ocupacioQid)) {
        perfil.ocupacionsVistes.add(ocupacioQid);
        perfil.ocupacions.push(ocupacio);
      }
    }
    perfil.articleCa ??= valor(b, "articleCa");
    perfil.articleEs ??= valor(b, "articleEs");
  }
  return [...perQid.values()].map(({ ocupacionsVistes: _v, ...perfil }) => perfil);
}

export type CarrecCap = {
  qid: string;
  carrecQid: string;
  /** L'etiqueta catalana, o `null` si el càrrec no en té: llavors no es publica. */
  carrec: string | null;
  inici: string | null;
  fi: string | null;
  /** El codi INE del municipi de l'àmbit del càrrec, si l'àmbit és un municipi. */
  ine5: string | null;
  /** Si l'àmbit del càrrec és a Catalunya. */
  catalunya: boolean;
};

export function parseCarrecs(json: unknown): CarrecCap[] {
  const files: CarrecCap[] = [];
  const vistos = new Set<string>();
  for (const b of bindings(json)) {
    const qid = qidDeUri(valor(b, "persona"));
    const carrecQid = qidDeUri(valor(b, "carrec"));
    if (qid === null || carrecQid === null) continue;
    const inici = dataCurtaIso(valor(b, "inici"));
    const clau = `${qid}|${carrecQid}|${inici ?? ""}`;
    if (vistos.has(clau)) continue;
    vistos.add(clau);
    files.push({
      qid,
      carrecQid,
      carrec: valor(b, "etiqueta"),
      inici,
      fi: dataCurtaIso(valor(b, "fi")),
      ine5: normalitzaIne(valor(b, "ine")),
      catalunya: cert(b, "cat"),
    });
  }
  return files;
}

// ─────────────────────────────────────────────────────────────────────────────
// L'aparellament
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Les etiquetes catalanes amb què Wikidata anomena els partits, portades a la
 * família de sigles del projecte. `siglesFamily()` sap llegir sigles i no noms
 * llargs —«PSC» sí, «Partit dels Socialistes de Catalunya» no—, i per això
 * aquí hi ha les formes llargues i després es prova amb ella.
 */
const PARTITS_WIKIDATA: ReadonlyArray<[RegExp, string]> = [
  [/esquerra republicana/, "erc"],
  [/socialistes de catalunya|partit socialista obrer|psoe/, "psc"],
  [/junts per catalunya|junts pel sí|^junts$/, "junts"],
  [/candidatura d'unitat popular|^cup$/, "cup"],
  [/en comú|comuns|iniciativa per catalunya|esquerra unida i alternativa/, "comuns"],
  [/partit popular|partido popular|aliança popular/, "pp"],
  [/^vox$/, "vox"],
  [/ciutadans|ciudadanos/, "cs"],
  [/partit demòcrata europeu català|partit nacionalista de catalunya/, "pdecat"],
  [/aliança catalana/, "aliancacat"],
  [/convergència democràtica de catalunya|convergència i unió|unió democràtica de catalunya/, "ciu"],
  [/^podem$|^podemos$/, "podem"],
];

export function familiaDelPartit(nom: string): string | null {
  const net = nom.trim().toLowerCase();
  if (net === "") return null;
  for (const [patro, familia] of PARTITS_WIKIDATA) {
    if (patro.test(net)) return familia;
  }
  return siglesFamily(nom);
}

/**
 * Dues famílies són el mateix partit, o l'una ve de l'altra: Junts i el PDeCAT
 * surten tots dos de CiU, i qui va encapçalar una llista de Junts el 2023
 * consta sovint a Wikidata amb el partit d'abans.
 */
export function mateixaFamilia(a: string, b: string): boolean {
  if (a === b) return true;
  const llinatgeA = BRANDS_BY_ID.get(a)?.lineage ?? null;
  const llinatgeB = BRANDS_BY_ID.get(b)?.lineage ?? null;
  return llinatgeA === b || llinatgeB === a || (llinatgeA !== null && llinatgeA === llinatgeB);
}

/** Una persona del ple, tal com la busca aquesta feina. */
export type Electe = {
  municipalityId: number;
  ine5: string;
  municipi: string;
  /** El nom tal com el dona el registre d'electes, que és la clau amb què es creua. */
  nom: string;
  /** Les sigles amb què es va presentar, o el grup del registre si no les tenim. */
  sigles: string;
  /** La família de la llista, o `null` si és local o no la sabem: llavors el partit no decideix res. */
  familia: string | null;
  /** Si va encapçalar la seva llista el 2023. */
  capDeLlista: boolean;
  /** El càrrec al ple, tal com el dona el registre. */
  carrec: string | null;
};

export type Candidat = { qid: string; perfil: PerfilCap | null; carrecs: CarrecCap[] };

export type Motiu = "carrec-al-municipi" | "lloc-al-municipi" | "partit-i-catalunya";

/** Què lliga aquesta fitxa amb aquesta persona, del criteri més fort al més fluix. */
export function evidencia(electe: Electe, candidat: Candidat): Motiu | null {
  if (candidat.carrecs.some((c) => c.ine5 === electe.ine5)) return "carrec-al-municipi";
  const perfil = candidat.perfil;
  if (perfil?.llocs.includes(electe.ine5)) return "lloc-al-municipi";
  if (electe.familia === null || electe.familia === "local" || perfil === null) return null;
  const delPartit = perfil.partits.some((p) => {
    const f = familiaDelPartit(p);
    return f !== null && mateixaFamilia(f, electe.familia!);
  });
  if (!delPartit) return null;
  const aCatalunya = perfil.catalunya || candidat.carrecs.some((c) => c.catalunya);
  return aCatalunya ? "partit-i-catalunya" : null;
}

export type Aparellament =
  | { ok: true; qid: string; motiu: Motiu }
  | { ok: false; motiu: string; qids: string[] };

/**
 * Tria, entre les fitxes amb aquest nom, la que és aquesta persona. Una i
 * només una: amb cap no s'inventa res, i amb dues no es tria.
 */
export function aparella(electe: Electe, candidats: readonly Candidat[]): Aparellament {
  if (candidats.length === 0) return { ok: false, motiu: "cap fitxa amb aquest nom", qids: [] };
  const lliguen = candidats
    .map((c) => ({ qid: c.qid, motiu: evidencia(electe, c) }))
    .filter((c): c is { qid: string; motiu: Motiu } => c.motiu !== null);
  if (lliguen.length === 1) return { ok: true, qid: lliguen[0]!.qid, motiu: lliguen[0]!.motiu };
  if (lliguen.length === 0) {
    return {
      ok: false,
      motiu: "cap fitxa amb aquest nom no lliga amb el municipi ni amb el partit",
      qids: candidats.map((c) => c.qid),
    };
  }
  return { ok: false, motiu: "més d'una fitxa amb aquest nom lliga", qids: lliguen.map((c) => c.qid) };
}

/**
 * La mateixa fitxa de Wikidata no pot ser dues persones.
 *
 * Pel criteri del partit, un «Josep Puig» d'ERC nascut a Catalunya lliga amb
 * tots els Josep Puig que seguin en un ple per ERC: si en surten dos, no sabem
 * quin és, i es descarta per a tots dos. Pels criteris del municipi no cal: la
 * fitxa diu de quin poble és, i ho pot dir de dos si ha estat regidor a tots dos.
 */
export function desambiguaGlobal<T extends { aparellament: Aparellament }>(files: readonly T[]): T[] {
  const perQid = new Map<string, number>();
  for (const f of files) {
    if (f.aparellament.ok && f.aparellament.motiu === "partit-i-catalunya") {
      perQid.set(f.aparellament.qid, (perQid.get(f.aparellament.qid) ?? 0) + 1);
    }
  }
  return files.map((f) => {
    if (!f.aparellament.ok || f.aparellament.motiu !== "partit-i-catalunya") return f;
    if ((perQid.get(f.aparellament.qid) ?? 0) <= 1) return f;
    return {
      ...f,
      aparellament: {
        ok: false,
        motiu: "la mateixa fitxa lliga amb més d'una persona pel partit",
        qids: [f.aparellament.qid],
      },
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// La fitxa que es desa
// ─────────────────────────────────────────────────────────────────────────────

export type PersonaCap = {
  /** El nom tal com el dona el registre d'electes, que és la clau amb què es creua. */
  nom: string;
  normalitzat: string;
  sigles: string;
  /** Si va encapçalar la seva llista el 2023. */
  capDeLlista: boolean;
  qid: string;
  url: string;
  /** El nom tal com l'etiqueta Wikidata, per si el vol comprovar algú. */
  etiqueta: string | null;
  naixement: number | null;
  ocupacio: string[];
  partit: string | null;
  carrecs: { qid: string; nom: string; inici: string | null; fi: string | null; alMunicipi: boolean }[];
  article: { ca: string | null; es: string | null };
  motiu: Motiu;
};

export type FitxaCapsDeLlista = {
  font: string;
  url: string;
  llicenciaDades: string;
  /** Data d'extracció: sense data, cap dada no entra a la pàgina. */
  consultat: string;
  ine5: string;
  eleccio: string;
  /** Persones del ple buscades en aquest municipi, quantes encapçalaven llista, i quantes tenen fitxa. */
  buscats: number;
  capsDeLlista: number;
  trobats: number;
  persones: PersonaCap[];
  /** Els que tenien alguna fitxa amb el seu nom i no s'ha pogut dir quina, amb el motiu. */
  descartats: { nom: string; sigles: string; motiu: string; qids: string[] }[];
};

export function fitxaCapsDeLlista(
  ine5: string,
  files: readonly { electe: Electe; candidats: Candidat[]; aparellament: Aparellament }[],
  consultat: string,
): FitxaCapsDeLlista {
  const persones: PersonaCap[] = [];
  const descartats: FitxaCapsDeLlista["descartats"] = [];
  for (const { electe, candidats, aparellament } of files) {
    if (!aparellament.ok) {
      if (aparellament.qids.length > 0) {
        descartats.push({ nom: electe.nom, sigles: electe.sigles, motiu: aparellament.motiu, qids: aparellament.qids });
      }
      continue;
    }
    const triat = candidats.find((c) => c.qid === aparellament.qid);
    if (triat === undefined) continue;
    const perfil = triat.perfil;
    persones.push({
      nom: electe.nom,
      normalitzat: normalizePersonName(electe.nom),
      sigles: electe.sigles,
      capDeLlista: electe.capDeLlista,
      qid: triat.qid,
      url: `https://www.wikidata.org/wiki/${triat.qid}`,
      etiqueta: perfil?.etiqueta ?? null,
      naixement: perfil?.naixement ?? null,
      ocupacio: perfil?.ocupacions ?? [],
      partit: perfil?.partits[0] ?? null,
      carrecs: triat.carrecs
        .filter((c): c is CarrecCap & { carrec: string } => c.carrec !== null)
        .map((c) => ({ qid: c.carrecQid, nom: c.carrec, inici: c.inici, fi: c.fi, alMunicipi: c.ine5 === ine5 }))
        .sort((a, b) => (b.inici ?? "").localeCompare(a.inici ?? "")),
      article: { ca: perfil?.articleCa ?? null, es: perfil?.articleEs ?? null },
      motiu: aparellament.motiu,
    });
  }
  return {
    font: FONT,
    url: ENDPOINT_SPARQL,
    llicenciaDades: LLICENCIA,
    consultat,
    ine5,
    eleccio: ELECCIO,
    buscats: files.length,
    capsDeLlista: files.filter((f) => f.electe.capDeLlista).length,
    trobats: persones.length,
    persones,
    descartats,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// La feina
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Qui seu als plens del mandat, amb el que en sabem de la seva llista.
 *
 * El registre d'electes (J3) dona el nom, el càrrec i el grup; les candidatures
 * proclamades (J4) diuen si encapçalava la llista i amb quines sigles. Es
 * creuen per identificador de persona, que J3 i J4 comparteixen quan el nom
 * normalitza igual, i si no, pel nom normalitzat dins del mateix municipi.
 */
export async function carregaElectes(db: Db): Promise<Electe[]> {
  const mandats = await db
    .select({
      municipalityId: councillorMandates.municipalityId,
      ine5: municipalities.ine5,
      municipi: municipalities.name,
      personId: councillorMandates.personId,
      nom: people.fullName,
      carrec: councillorMandates.role,
      partyRaw: councillorMandates.partyRaw,
      grupBrand: politicalGroups.brandId,
      grupNom: politicalGroups.name,
    })
    .from(councillorMandates)
    .innerJoin(councilTerms, eq(councilTerms.id, councillorMandates.termId))
    .innerJoin(people, eq(people.id, councillorMandates.personId))
    .innerJoin(municipalities, eq(municipalities.id, councillorMandates.municipalityId))
    .leftJoin(politicalGroups, eq(politicalGroups.id, councillorMandates.groupId))
    .where(eq(councilTerms.electionId, ELECCIO));

  const proclamats = await db
    .select({
      municipalityId: candidatures.municipalityId,
      personId: candidacies.personId,
      nom: people.fullName,
      sigles: candidatures.sigles,
      brandId: candidatures.brandId,
      capDeLlista: candidacies.isHead,
    })
    .from(candidacies)
    .innerJoin(candidatures, eq(candidatures.id, candidacies.candidatureId))
    .innerJoin(people, eq(people.id, candidacies.personId))
    .where(and(eq(candidatures.electionId, ELECCIO), eq(candidacies.kind, "Titular")));

  type Proclamat = (typeof proclamats)[number];
  const perPersona = new Map<string, Proclamat | null>();
  const perNom = new Map<string, Proclamat | null>();
  const posa = (map: Map<string, Proclamat | null>, clau: string, p: Proclamat): void => {
    // Un nom que lligui amb dues candidatures del mateix municipi no decideix res.
    map.set(clau, map.has(clau) ? null : p);
  };
  for (const p of proclamats) {
    posa(perPersona, `${p.municipalityId}|${p.personId}`, p);
    posa(perNom, `${p.municipalityId}|${normalizePersonName(p.nom)}`, p);
  }

  const electes: Electe[] = mandats.map((m) => {
    const candidatura =
      perPersona.get(`${m.municipalityId}|${m.personId}`) ??
      perNom.get(`${m.municipalityId}|${normalizePersonName(m.nom)}`) ??
      null;
    const sigles = candidatura?.sigles ?? m.partyRaw ?? m.grupNom ?? "";
    return {
      municipalityId: m.municipalityId,
      ine5: m.ine5,
      municipi: m.municipi,
      nom: m.nom,
      sigles,
      familia: candidatura?.brandId ?? m.grupBrand ?? (sigles === "" ? null : siglesFamily(sigles)),
      capDeLlista: candidatura?.capDeLlista ?? false,
      carrec: m.carrec,
    };
  });
  // Els caps de llista primer: són els que més gent busca, i si la feina
  // s'interromp a mitges, són els que ja estan cercats.
  return electes.sort((a, b) => Number(b.capDeLlista) - Number(a.capDeLlista));
}

export async function j27CapsDeLlista(db: Db): Promise<void> {
  await withRun(db, "j27-caps-de-llista", async (run) => {
    const electes = await carregaElectes(db);
    run.rowsIn = electes.length;
    const caps = electes.filter((e) => e.capDeLlista).length;
    run.say(`${electes.length} persones als plens del mandat · ${caps} van encapçalar la seva llista el 2023`);
    if (electes.length === 0) throw new Error("no hi ha ningú als plens: executa J3 i J4 abans que J27");

    // 1. La cerca per nom, en lots. Les fitxes trobades es lliguen a cada
    //    persona per la forma normalitzada del nom, que és com es creua tot el
    //    projecte.
    const candidatsPerElecte = new Map<Electe, Set<string>>();
    let crides = 0;
    for (const lot of trossos(electes, NOMS_PER_CRIDA)) {
      const variantsPerElecte = new Map(lot.map((e) => [e, variantsDelNom(e.nom)]));
      const variants = [...new Set([...variantsPerElecte.values()].flat())];
      const trobats = parseCerca(await consultaWdqs<unknown>(consultaCerca(variants), { delayMs: PAUSA_MS }));
      crides += 1;
      const perNom = new Map<string, Set<string>>();
      for (const t of trobats) {
        const clau = normalizePersonName(t.nom);
        const grup = perNom.get(clau) ?? new Set<string>();
        grup.add(t.qid);
        perNom.set(clau, grup);
      }
      for (const [electe, formes] of variantsPerElecte) {
        const qids = new Set<string>();
        for (const forma of formes) {
          for (const qid of perNom.get(normalizePersonName(forma)) ?? []) qids.add(qid);
        }
        candidatsPerElecte.set(electe, qids);
      }
      if (crides % 20 === 0) run.say(`  ${crides} lots de cerca…`);
    }
    const qids = [...new Set([...candidatsPerElecte.values()].flatMap((s) => [...s]))];
    run.say(`${crides} crides de cerca · ${qids.length} fitxes de Wikidata amb algun d'aquests noms`);

    // 2. El perfil i els càrrecs de totes les fitxes trobades, en lots de 300.
    const perfils = new Map<string, PerfilCap>();
    const carrecs = new Map<string, CarrecCap[]>();
    for (const lot of trossos(qids, QIDS_PER_CRIDA)) {
      for (const p of parsePerfil(await consultaWdqs<unknown>(consultaPerfil(lot), { delayMs: PAUSA_MS }))) {
        perfils.set(p.qid, p);
      }
      for (const c of parseCarrecs(await consultaWdqs<unknown>(consultaCarrecs(lot), { delayMs: PAUSA_MS }))) {
        const llista = carrecs.get(c.qid) ?? [];
        llista.push(c);
        carrecs.set(c.qid, llista);
      }
      crides += 2;
    }
    run.say(`${crides} crides en total · ${perfils.size} perfils · ${carrecs.size} persones amb càrrecs`);

    // 3. L'aparellament, primer persona a persona i després contra tots els altres.
    const aparellats = desambiguaGlobal(
      electes.map((electe) => {
        const candidats: Candidat[] = [...(candidatsPerElecte.get(electe) ?? [])].map((qid) => ({
          qid,
          perfil: perfils.get(qid) ?? null,
          carrecs: carrecs.get(qid) ?? [],
        }));
        return { electe, candidats, aparellament: aparella(electe, candidats) };
      }),
    );

    const perMunicipi = new Map<number, typeof aparellats>();
    for (const fila of aparellats) {
      const grup = perMunicipi.get(fila.electe.municipalityId);
      if (grup === undefined) perMunicipi.set(fila.electe.municipalityId, [fila]);
      else grup.push(fila);
    }

    const consultat = new Date().toISOString().slice(0, 10);
    const comptador = { trobats: 0, capsTrobats: 0, senseFitxa: 0, senseLligam: 0, ambigus: 0 };
    const perMotiu = new Map<Motiu, number>();
    for (const [municipalityId, delMunicipi] of perMunicipi) {
      for (const { electe, aparellament } of delMunicipi) {
        if (aparellament.ok) {
          comptador.trobats += 1;
          if (electe.capDeLlista) comptador.capsTrobats += 1;
          perMotiu.set(aparellament.motiu, (perMotiu.get(aparellament.motiu) ?? 0) + 1);
          continue;
        }
        if (aparellament.qids.length === 0) {
          comptador.senseFitxa += 1;
          continue;
        }
        // Una fitxa amb el nom que no s'ha pogut lligar és una cosa per mirar,
        // no un error: sovint és la persona i Wikidata no diu de quin poble és.
        const ambigu = /més d'una/.test(aparellament.motiu);
        if (ambigu) comptador.ambigus += 1;
        else comptador.senseLligam += 1;
        await run.issue({
          kind: ambigu ? "wikidata_electe_ambigu" : "wikidata_electe_sense_lligam",
          severity: "baixa",
          municipalityId,
          entity: electe.nom,
          detail: {
            sigles: electe.sigles, municipi: electe.municipi, capDeLlista: electe.capDeLlista,
            motiu: aparellament.motiu, qids: aparellament.qids,
          },
        });
      }
      const ine5 = delMunicipi[0]!.electe.ine5;
      const fitxa = fitxaCapsDeLlista(ine5, delMunicipi, consultat);
      await db
        .insert(municipalityMetrics)
        .values({ municipalityId, kind: KIND, data: fitxa })
        .onConflictDoUpdate({
          target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
          set: { data: fitxa, computedAt: new Date() },
        });
      run.rowsOut += 1;
    }

    run.say(
      `${comptador.trobats} persones amb fitxa de Wikidata ` +
        `(${((100 * comptador.trobats) / electes.length).toFixed(1)} %), ${comptador.capsTrobats} d'elles caps de llista · ` +
        `${comptador.senseFitxa} sense cap fitxa amb el nom · ${comptador.senseLligam} amb fitxa que no lliga · ` +
        `${comptador.ambigus} ambigus`,
    );
    run.say(
      `pel càrrec al municipi: ${perMotiu.get("carrec-al-municipi") ?? 0} · pel lloc: ` +
        `${perMotiu.get("lloc-al-municipi") ?? 0} · pel partit i Catalunya: ${perMotiu.get("partit-i-catalunya") ?? 0}`,
    );

    return {
      font: FONT,
      llicenciaDades: LLICENCIA,
      consultat,
      electes: electes.length,
      capsDeLlista: caps,
      fitxesAmbElNom: qids.length,
      crides,
      municipisAmbFitxa: perMunicipi.size,
      perMotiu: Object.fromEntries(perMotiu),
      ...comptador,
    };
  });
}
