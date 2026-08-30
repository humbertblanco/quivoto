import { eq } from "drizzle-orm";
import { municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { fetchJson } from "../lib/http";
import { withRun } from "../lib/run";

/**
 * J20 — el que Wikidata sap dels 947, i només això.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PER QUÈ AQUESTA FEINA NO AGAFA NI LA POBLACIÓ NI L'ALCALDE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Wikidata té una fitxa per a cada municipi català i és temptador buidar-la
 * sencera. Seria un error, i els dos casos que ho demostren estan comprovats
 * contra la font:
 *
 *   · **P1082 (població).** És una sèrie col·laborativa i no verificada. A
 *     Molló hi ha un punt de població datat el **2039**. Una xifra que ve del
 *     futur no és un detall graciós: és la prova que ningú no la revisa. El
 *     padró oficial ja l'ingereix J18 i és el que hem de publicar.
 *   · **P6 (cap de govern).** Un **28 %** de les fitxes porta l'alcalde
 *     desactualitzat. Nosaltres tenim el cens de càrrecs electes de la font
 *     oficial: publicar-hi al costat un nom de Wikidata només serviria per
 *     posar-nos a dubtar de tots dos.
 *
 * El que sí que aporta Wikidata és el que ningú més ens dona amb els 947
 * complets i amb una llicència que permet republicar-ho:
 *
 *   · La **fotografia** (P18): 947 de 947.
 *   · L'**escut** (P94): 879 de 947.
 *   · L'identificador de **relació d'OpenStreetMap** (P402): 947 de 947, que és
 *     el que enllaça cada municipi amb el seu polígon real.
 *   · L'enllaç a l'**article de la Viquipedia** catalana: 947 de 947.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * L'APARELLAMENT: PEL CODI INE, MAI PEL NOM
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Els 947 municipis (Q33146843) porten tots el codi INE a P772, sense cap
 * duplicat, i coincideix amb el nostre `ine5` (= `codi_ens[0:5]`). Això vol dir
 * que l'aparellament és determinista i que aquí **no es compara ni un sol nom**.
 * Amb els noms hi hauria Sant Quirze del Vallès contra Sant Quirze Safaja, i el
 * pitjor error possible d'aquest projecte és penjar la foto d'un poble a la
 * fitxa d'un altre. Si un INE no lliga, o si dos ítems de Wikidata se'l
 * reparteixen, no s'endevina res: es desa com a incidència i aquell municipi es
 * queda sense fila.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LES DADES SÓN CC0; LES IMATGES, NO
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Wikidata publica les seves dades en CC0, i per això el QID, el codi INE, la
 * relació d'OSM i el sitelink es poden desar sense més. Les **imatges** no van
 * amb la llicència de Wikidata sinó amb la que hi hagi posat qui les va pujar a
 * Commons, fitxer a fitxer: l'escut de Ripoll és CC BY-SA 4.0, de Kilo567.
 * Publicar-lo sense el nom i sense la llicència seria incomplir-la.
 *
 * Per això cada fitxer es consulta a l'API de Commons
 * (`action=query&prop=imageinfo&iiprop=extmetadata`) i **només es desa el que
 * és lliure**, amb autor i llicència. Si la llicència no es pot llegir, la
 * imatge es descarta: no saber-la no és permís, és desconeixement, i el que es
 * descarta queda escrit a la fitxa amb el motiu perquè es pugui revisar.
 *
 * El **text** de la Viquipedia no s'incrusta enlloc, només s'hi enllaça. És
 * CC BY-SA 4.0, i el share-alike obligaria a etiquetar aquell tros de pàgina
 * amb una llicència diferent de la resta; a més és text col·laboratiu que
 * nosaltres no hem verificat, i aquí no publiquem res que no puguem comprovar.
 *
 * Fonts: https://query.wikidata.org/sparql (CC0) i
 * https://commons.wikimedia.org/w/api.php (llicència per fitxer).
 */

export const KIND = "wikidata";

const FONT = "Wikidata (wikidata.org)";
const FONT_IMATGES = "Wikimedia Commons (commons.wikimedia.org)";

const ENDPOINT_SPARQL = "https://query.wikidata.org/sparql";
const API_COMMONS = "https://commons.wikimedia.org/w/api.php";

/**
 * Wikidata exigeix un User-Agent que identifiqui qui pregunta i deixa sense
 * servei els anònims. El client d'`lib/http` ja n'envia un amb el nom del
 * projecte i una adreça de contacte, i per això aquí no se n'escriu cap altre.
 */

/**
 * L'API de Commons accepta 50 títols per crida. Preguntar-los d'un en un
 * voldria dir 1.826 peticions per a una cosa que se'n menja 37.
 */
const FITXERS_PER_CRIDA = 50;

/**
 * Pausa entre crides a Commons. No és per por del bloqueig: és que aquesta
 * feina completa són poques desenes de peticions i no hi ha cap pressa que
 * justifiqui martellejar un servei que ens dona les imatges de franc.
 */
const PAUSA_MS = 400;

// ─────────────────────────────────────────────────────────────────────────────
// Tipus
// ─────────────────────────────────────────────────────────────────────────────

/** Una fila de la consulta SPARQL, ja agrupada per ítem. */
export type FilaWikidata = {
  /** Q… de l'ítem. */
  qid: string;
  /** Codi INE de 5 xifres tal com el publica P772, ja normalitzat. */
  ine5: string;
  /** Títol del fitxer de Commons de la fotografia (P18), o `null`. */
  imatge: string | null;
  /** Títol del fitxer de Commons de l'escut (P94), o `null`. */
  escut: string | null;
  /** Identificador de relació d'OpenStreetMap (P402), o `null`. */
  osm: string | null;
  /** URL de l'article a la Viquipedia catalana, o `null`. */
  viquipedia: string | null;
};

/** Una imatge de Commons que hem comprovat que es pot republicar. */
export type ImatgeCommons = {
  /** Títol del fitxer, tal com l'anomena Commons («File:Ripoll escut.svg»). */
  fitxer: string;
  /** URL del fitxer original. */
  url: string;
  /** Pàgina de descripció: on va a parar l'atribució. */
  pagina: string;
  /** Codi de llicència llegible per màquina («cc-by-sa-4.0», «cc0»…). */
  llicencia: string;
  /** Etiqueta humana de la llicència («CC BY-SA 4.0»). */
  llicenciaNom: string;
  /** Autor en text pla; `null` si Commons no en declara cap. */
  autor: string | null;
};

/** Un fitxer que no es publica, i per què. També és informació. */
export type ImatgeDescartada = {
  fitxer: string;
  /** Codi de llicència llegit, o `null` si no se n'ha pogut llegir cap. */
  llicencia: string | null;
  motiu: string;
};

export type FitxaWikidata = {
  font: string;
  fontImatges: string;
  /** Les dades de Wikidata són CC0; les imatges porten la seva, per fitxer. */
  llicenciaDades: string;
  qid: string;
  url: string;
  ine5: string;
  /** Data d'extracció: sense data, cap dada no entra a la fitxa. */
  descarregat: string;
  imatge: ImatgeCommons | null;
  escut: ImatgeCommons | null;
  osmRelacio: string | null;
  osmUrl: string | null;
  /** Només l'enllaç: el text de la Viquipedia no s'incrusta mai. */
  viquipedia: string | null;
  descartats: ImatgeDescartada[];
};

/** El resultat de mirar un fitxer a Commons. */
export type ResultatFitxer =
  | { ok: true; imatge: ImatgeCommons }
  | { ok: false; descartada: ImatgeDescartada };

// ─────────────────────────────────────────────────────────────────────────────
// La consulta
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Una sola consulta per als 947. Tot el que no és el codi INE va dins d'un
 * OPTIONAL: si demà algú esborra l'escut d'un municipi, el que ha de passar és
 * que aquell municipi es quedi sense escut, no que la consulta retorni 946
 * files i no ho digui ningú.
 */
export const CONSULTA_SPARQL = [
  "PREFIX schema: <http://schema.org/>",
  "SELECT ?item ?ine ?imatge ?escut ?osm ?article WHERE {",
  "  ?item wdt:P31 wd:Q33146843 ; wdt:P772 ?ine .",
  "  OPTIONAL { ?item wdt:P18 ?imatge }",
  "  OPTIONAL { ?item wdt:P94 ?escut }",
  "  OPTIONAL { ?item wdt:P402 ?osm }",
  "  OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://ca.wikipedia.org/> }",
  "}",
].join("\n");

export function urlConsulta(consulta: string = CONSULTA_SPARQL): string {
  return `${ENDPOINT_SPARQL}?format=json&query=${encodeURIComponent(consulta)}`;
}

/** URL de la crida a Commons per a un grup de títols de fitxer. */
export function urlCommons(fitxers: readonly string[]): string {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    // Sense això Commons torna les 30 i escaig metadades de cada fitxer.
    iiextmetadatafilter: "License|LicenseShortName|Artist|AttributionRequired",
    titles: fitxers.join("|"),
  });
  return `${API_COMMONS}?${params.toString()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lectura de la resposta SPARQL
// ─────────────────────────────────────────────────────────────────────────────

type BindingSparql = Record<string, { value?: unknown } | undefined>;

const valorBinding = (b: BindingSparql, clau: string): string | null => {
  const v = b[clau]?.value;
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
};

/** El QID a partir de l'URI de l'ítem: `http://www.wikidata.org/entity/Q14320`. */
const qidDeUri = (uri: string): string | null => uri.match(/\/(Q\d+)$/)?.[1] ?? null;

/**
 * El codi INE, normalitzat a 5 xifres. P772 el publica com a text i hi ha
 * hagut valors amb espais; els municipis de menys de 10.000 comencen per zero i
 * qualsevol pas per un número se'l menjaria.
 */
export function normalitzaIne(brut: string | null): string | null {
  if (brut === null) return null;
  const xifres = brut.replace(/\D/g, "");
  if (xifres.length === 0 || xifres.length > 5) return null;
  return xifres.padStart(5, "0");
}

/**
 * El títol del fitxer de Commons a partir de l'URL que retorna SPARQL, que és
 * de la forma `http://commons.wikimedia.org/wiki/Special:FilePath/Escut de
 * Ripoll.svg`. Cal desfer el percent-encoding i tornar els guions baixos a
 * espais, perquè el títol que espera l'API és el llegible.
 */
export function fitxerCommons(url: string | null): string | null {
  if (url === null) return null;
  const cua = url.match(/Special:FilePath\/(.+)$/)?.[1];
  if (cua === undefined) return null;
  let nom: string;
  try {
    nom = decodeURIComponent(cua);
  } catch {
    // Un percent-encoding trencat vol dir que no sabem de quin fitxer parlem, i
    // demanar-lo malament a Commons només duria una llicència que no és la seva.
    return null;
  }
  return titolNormalitzat(nom);
}

/**
 * Commons tracta els guions baixos com a espais i sempre posa la inicial en
 * majúscula. Normalitzem igual a l'anada i a la tornada: és l'única manera de
 * fer coincidir el que hem demanat amb el que ens contesta.
 */
export function titolNormalitzat(nom: string): string {
  const net = nom.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  const sensePrefix = net.replace(/^(File|Fitxer|Image|Imatge):\s*/i, "");
  if (sensePrefix === "") return "";
  return `File:${sensePrefix.charAt(0).toUpperCase()}${sensePrefix.slice(1)}`;
}

/**
 * Agrupa les files de SPARQL per ítem. Un OPTIONAL que troba dos valors —dues
 * fotografies, posem— multiplica les files, i sense agrupar-les tindríem el
 * mateix municipi dues vegades. Es queda el primer valor de cada propietat i el
 * segon es descarta en silenci: triar-ne un és igual de bo que triar l'altre,
 * i el que importa és no duplicar el municipi.
 */
export function parseSparql(json: unknown): FilaWikidata[] {
  const bindings = (json as { results?: { bindings?: BindingSparql[] } })?.results?.bindings;
  if (!Array.isArray(bindings)) return [];

  const perQid = new Map<string, FilaWikidata>();
  for (const b of bindings) {
    const uri = valorBinding(b, "item");
    const qid = uri === null ? null : qidDeUri(uri);
    const ine5 = normalitzaIne(valorBinding(b, "ine"));
    // Sense QID o sense INE no hi ha res a aparellar: la fila no serveix.
    if (qid === null || ine5 === null) continue;

    const previa = perQid.get(qid);
    const fila: FilaWikidata = previa ?? {
      qid,
      ine5,
      imatge: null,
      escut: null,
      osm: null,
      viquipedia: null,
    };
    fila.imatge ??= fitxerCommons(valorBinding(b, "imatge"));
    fila.escut ??= fitxerCommons(valorBinding(b, "escut"));
    fila.osm ??= valorBinding(b, "osm");
    fila.viquipedia ??= valorBinding(b, "article");
    if (previa === undefined) perQid.set(qid, fila);
  }
  return [...perQid.values()];
}

// ─────────────────────────────────────────────────────────────────────────────
// L'aparellament per codi INE
// ─────────────────────────────────────────────────────────────────────────────

export type Municipi = { id: number; ine5: string; name: string };

export type Aparellament = {
  parelles: { municipalityId: number; nom: string; fila: FilaWikidata }[];
  /** Municipis nostres sense cap ítem de Wikidata amb aquell INE. */
  senseWikidata: Municipi[];
  /** Ítems de Wikidata amb un INE que no és de cap municipi nostre. */
  orfes: FilaWikidata[];
  /** INE que dos ítems o més es reparteixen: no se n'aparella cap. */
  ambigus: { ine5: string; qids: string[] }[];
};

/**
 * Aparella per codi INE i prou. No hi ha cap comparació de noms, ni cap
 * aproximació, ni cap desempat per proximitat: si un INE no lliga o el porten
 * dos ítems, aquell municipi es queda sense fila i la incidència ho diu. Una
 * foto a la fitxa equivocada seria pitjor que no tenir-ne cap.
 */
export function aparellaPerIne(
  files: readonly FilaWikidata[],
  munis: readonly Municipi[],
): Aparellament {
  const perIne = new Map<string, FilaWikidata[]>();
  for (const fila of files) {
    const grup = perIne.get(fila.ine5);
    if (grup === undefined) perIne.set(fila.ine5, [fila]);
    else grup.push(fila);
  }

  const parelles: Aparellament["parelles"] = [];
  const senseWikidata: Municipi[] = [];
  const ambigus: Aparellament["ambigus"] = [];
  const consumits = new Set<string>();

  for (const muni of munis) {
    const grup = perIne.get(muni.ine5);
    if (grup === undefined || grup.length === 0) {
      senseWikidata.push(muni);
      continue;
    }
    consumits.add(muni.ine5);
    if (grup.length > 1) {
      ambigus.push({ ine5: muni.ine5, qids: grup.map((f) => f.qid) });
      senseWikidata.push(muni);
      continue;
    }
    parelles.push({ municipalityId: muni.id, nom: muni.name, fila: grup[0]! });
  }

  const orfes = files.filter((f) => !consumits.has(f.ine5));
  return { parelles, senseWikidata, orfes, ambigus };
}

// ─────────────────────────────────────────────────────────────────────────────
// El filtre de llicència
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Les llicències que permeten republicar la imatge en aquest lloc, citant
 * l'autor. La llista és **tancada a propòsit**: qualsevol codi que no hi sigui
 * es descarta, encara que sonés lliure. El cost d'equivocar-se cap al costat
 * prudent és un escut menys; cap a l'altre, publicar una imatge que no podem.
 *
 *   · `cc0` i el domini públic (`pd-*`): sense condicions.
 *   · `cc-by-*` i `cc-by-sa-*`: cal l'autor i el nom de la llicència, i per això
 *     tots dos es desen a la fitxa i la fitxa els ha d'ensenyar.
 *
 * Queden fora, entre d'altres, la GFDL —que obligaria a reproduir el text
 * sencer de la llicència al costat de cada escut— i qualsevol cosa amb `nc`
 * (no comercial) o `nd` (sense obra derivada).
 */
const PATRONS_LLIURES: RegExp[] = [
  /^cc0(-1\.0)?$/,
  /^cc-pd(-mark)?$/,
  /^pd$/,
  /^pd-[a-z0-9._-]+$/,
  /^public[ -]?domain$/,
  /^cc-by(-sa)?-\d(\.\d+)?([,\d.]*)?$/,
];

/** Marques que descarten el fitxer encara que la resta del codi sembli lliure. */
const PATRONS_PROHIBITS: RegExp[] = [/(^|-)nc(-|$)/, /(^|-)nd(-|$)/, /fair/, /noncommercial/];

export type Veredicte = { lliure: true; codi: string } | { lliure: false; motiu: string };

/**
 * Decideix si un codi de llicència de Commons permet republicar el fitxer.
 * L'ordre és el que compta: primer es mira si hi ha res que la prohibeixi i
 * només després si és a la llista de lliures, perquè `cc-by-nc-sa-4.0` conté
 * `cc-by` i sense aquest ordre s'esmunyiria.
 */
export function veredicteLlicencia(codi: string | null | undefined): Veredicte {
  if (typeof codi !== "string" || codi.trim() === "") {
    return { lliure: false, motiu: "Commons no en publica el codi de llicència" };
  }
  const net = codi.trim().toLowerCase();
  if (PATRONS_PROHIBITS.some((p) => p.test(net))) {
    return { lliure: false, motiu: `llicència no lliure: ${net}` };
  }
  if (PATRONS_LLIURES.some((p) => p.test(net))) return { lliure: true, codi: net };
  return { lliure: false, motiu: `llicència no reconeguda com a lliure: ${net}` };
}

/**
 * L'autor arriba com a HTML («<a href="…">Kilo567</a>») perquè a Commons és un
 * camp de text lliure. A la fitxa hi ha d'anar el nom, no l'etiqueta.
 */
export function textPla(html: string | null | undefined): string | null {
  if (typeof html !== "string") return null;
  const net = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
  return net === "" ? null : net;
}

type PaginaCommons = {
  title?: unknown;
  missing?: unknown;
  imageinfo?: {
    url?: unknown;
    descriptionurl?: unknown;
    extmetadata?: Record<string, { value?: unknown } | undefined>;
  }[];
};

const metadada = (
  extra: Record<string, { value?: unknown } | undefined> | undefined,
  clau: string,
): string | null => {
  const v = extra?.[clau]?.value;
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
};

/**
 * Llegeix una resposta de l'API de Commons i decideix, fitxer a fitxer, si es
 * pot publicar. Els títols demanats es passen a part perquè el que **no** torna
 * la resposta també compta: un fitxer que Commons no coneix no és un fitxer
 * sense problema, és un fitxer del qual no en sabem la llicència.
 */
export function llegeixLlicencies(
  json: unknown,
  demanats: readonly string[],
): Map<string, ResultatFitxer> {
  const brut = (json as { query?: { pages?: unknown } })?.query?.pages;
  const pagines: PaginaCommons[] = Array.isArray(brut) ? (brut as PaginaCommons[]) : [];

  const resultats = new Map<string, ResultatFitxer>();
  for (const pagina of pagines) {
    const titol = typeof pagina.title === "string" ? titolNormalitzat(pagina.title) : "";
    if (titol === "") continue;

    const info = Array.isArray(pagina.imageinfo) ? pagina.imageinfo[0] : undefined;
    const extra = info?.extmetadata;
    const codi = metadada(extra, "License");
    const veredicte = veredicteLlicencia(codi);
    if (!veredicte.lliure) {
      resultats.set(titol, {
        ok: false,
        descartada: { fitxer: titol, llicencia: codi, motiu: veredicte.motiu },
      });
      continue;
    }

    const url = typeof info?.url === "string" ? info.url : null;
    const descripcio = typeof info?.descriptionurl === "string" ? info.descriptionurl : null;
    if (url === null || descripcio === null) {
      // Sense URL no hi ha imatge, i sense pàgina de descripció no hi ha on
      // enviar l'atribució que la llicència obliga a fer.
      resultats.set(titol, {
        ok: false,
        descartada: { fitxer: titol, llicencia: codi, motiu: "Commons no en dona l'URL" },
      });
      continue;
    }

    resultats.set(titol, {
      ok: true,
      imatge: {
        fitxer: titol,
        url,
        pagina: descripcio,
        llicencia: veredicte.codi,
        llicenciaNom: metadada(extra, "LicenseShortName") ?? veredicte.codi.toUpperCase(),
        autor: textPla(metadada(extra, "Artist")),
      },
    });
  }

  for (const demanat of demanats) {
    const titol = titolNormalitzat(demanat);
    if (resultats.has(titol)) continue;
    resultats.set(titol, {
      ok: false,
      descartada: { fitxer: titol, llicencia: null, motiu: "Commons no coneix aquest fitxer" },
    });
  }
  return resultats;
}

// ─────────────────────────────────────────────────────────────────────────────
// La fitxa que es desa
// ─────────────────────────────────────────────────────────────────────────────

export function urlOsm(relacio: string | null): string | null {
  return relacio === null ? null : `https://www.openstreetmap.org/relation/${relacio}`;
}

/**
 * Munta la fila que es desa a `municipality_metrics`. Tot el que no ha passat
 * el filtre de llicència hi consta a `descartats`: si un dia la fitxa d'un
 * municipi no ensenya escut, aquí hi ha escrit per què.
 */
export function fitxaWikidata(
  fila: FilaWikidata,
  llicencies: ReadonlyMap<string, ResultatFitxer>,
  descarregat: string,
): FitxaWikidata {
  const descartats: ImatgeDescartada[] = [];
  const resol = (fitxer: string | null): ImatgeCommons | null => {
    if (fitxer === null) return null;
    const resultat = llicencies.get(titolNormalitzat(fitxer));
    if (resultat === undefined) {
      // No s'ha arribat a mirar: no és permís, és desconeixement.
      descartats.push({ fitxer, llicencia: null, motiu: "llicència no consultada" });
      return null;
    }
    if (!resultat.ok) {
      descartats.push(resultat.descartada);
      return null;
    }
    return resultat.imatge;
  };

  const imatge = resol(fila.imatge);
  const escut = resol(fila.escut);
  return {
    font: FONT,
    fontImatges: FONT_IMATGES,
    llicenciaDades: "CC0 1.0",
    qid: fila.qid,
    url: `https://www.wikidata.org/wiki/${fila.qid}`,
    ine5: fila.ine5,
    descarregat,
    imatge,
    escut,
    osmRelacio: fila.osm,
    osmUrl: urlOsm(fila.osm),
    viquipedia: fila.viquipedia,
    descartats,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// La feina
// ─────────────────────────────────────────────────────────────────────────────

export function trossos<T>(items: readonly T[], mida: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += mida) out.push(items.slice(i, i + mida));
  return out;
}

/**
 * Les llicències que ja tenim desades d'una execució anterior. És el que fa que
 * una segona passada no torni a demanar a Commons els 1.826 fitxers: la
 * llicència d'una imatge no canvia gairebé mai, i quan canvia el que fa és
 * afegir-se'n una de compatible.
 *
 * Els **descartats** no s'hi guarden a posta. Són quatre, i si algú arregla la
 * llicència d'un escut a Commons volem que la propera execució ho vegi; posar
 * el «no» a la memòria cau el faria etern.
 */
export function memoriaPrevia(
  fitxes: readonly FitxaWikidata[],
): Map<string, ResultatFitxer> {
  const cau = new Map<string, ResultatFitxer>();
  for (const fitxa of fitxes) {
    for (const imatge of [fitxa.imatge, fitxa.escut]) {
      if (imatge === null) continue;
      cau.set(titolNormalitzat(imatge.fitxer), { ok: true, imatge });
    }
  }
  return cau;
}

export type OpcionsJ20 = {
  /** Torna a preguntar totes les llicències, ignorant el que ja hi ha desat. */
  forca?: boolean;
};

export async function j20Wikidata(db: Db, options: OpcionsJ20 = {}): Promise<void> {
  await withRun(db, "j20-wikidata", async (run) => {
    const munis: Municipi[] = (
      await db
        .select({ id: municipalities.id, ine5: municipalities.ine5, name: municipalities.name })
        .from(municipalities)
    ).map((m) => ({ id: m.id, ine5: m.ine5, name: m.name }));
    run.say(`${munis.length} municipis a aparellar`);

    // Una sola consulta per als 947: és el tracte que WDQS espera i el que fa
    // que aquesta feina no hagi de sortir de l'ordre normal d'ingesta.
    const files = parseSparql(await fetchJson<unknown>(urlConsulta()));
    run.rowsIn = files.length;
    run.say(`${files.length} municipis catalans amb codi INE a Wikidata`);

    const { parelles, senseWikidata, orfes, ambigus } = aparellaPerIne(files, munis);
    run.say(
      `${parelles.length} aparellats per INE · ${senseWikidata.length} sense ítem · ` +
        `${orfes.length} ítems orfes · ${ambigus.length} INE ambigus`,
    );

    for (const muni of senseWikidata) {
      await run.issue({
        kind: "wikidata_ine_no_lliga",
        severity: "baixa",
        municipalityId: muni.id,
        detail: { ine5: muni.ine5, nom: muni.name },
      });
    }
    for (const orfe of orfes) {
      await run.issue({
        kind: "wikidata_ine_desconegut",
        severity: "baixa",
        entity: orfe.qid,
        detail: { ine5: orfe.ine5, qid: orfe.qid },
      });
    }
    for (const ambigu of ambigus) {
      // Dos ítems amb el mateix INE: no se n'aparella cap. Endevinar-ne un
      // seria posar la foto d'un poble a la fitxa d'un altre.
      await run.issue({
        kind: "wikidata_ine_duplicat",
        severity: "alta",
        detail: ambigu,
      });
    }

    // Memòria del que ja sabem, per no tornar a preguntar-ho.
    const previes: FitxaWikidata[] = options.forca
      ? []
      : (
          await db
            .select({ data: municipalityMetrics.data })
            .from(municipalityMetrics)
            .where(eq(municipalityMetrics.kind, KIND))
        ).map((r) => r.data as FitxaWikidata);
    const llicencies = memoriaPrevia(previes);
    if (llicencies.size > 0) run.say(`${llicencies.size} llicències ja sabudes d'abans`);

    const pendents = [
      ...new Set(
        parelles
          .flatMap(({ fila }) => [fila.imatge, fila.escut])
          .flatMap((f) => (f === null ? [] : [titolNormalitzat(f)]))
          .filter((f) => f !== "" && !llicencies.has(f)),
      ),
    ];
    run.say(`${pendents.length} fitxers de Commons per comprovar`);

    let crides = 0;
    for (const grup of trossos(pendents, FITXERS_PER_CRIDA)) {
      try {
        const json = await fetchJson<unknown>(urlCommons(grup), { delayMs: PAUSA_MS });
        crides += 1;
        for (const [titol, resultat] of llegeixLlicencies(json, grup)) {
          llicencies.set(titol, resultat);
        }
      } catch (error) {
        /*
         * Un grup que peta no pot endur-se la feina sencera: els 50 fitxers es
         * queden sense llicència i, per tant, sense publicar, que és el
         * comportament segur. La propera execució els tornarà a demanar perquè
         * la memòria cau només recorda els «sí».
         */
        await run.issue({
          kind: "commons_llicencia_error",
          severity: "mitjana",
          detail: { fitxers: grup.length, primer: grup[0] ?? null, error: String(error) },
        });
      }
    }
    run.say(`${crides} crides a l'API de Commons`);

    const descarregat = new Date().toISOString().slice(0, 10);
    const comptador = {
      ambImatge: 0,
      ambEscut: 0,
      ambOsm: 0,
      ambViquipedia: 0,
      imatgesDescartades: 0,
    };

    for (const { municipalityId, nom, fila } of parelles) {
      const fitxa = fitxaWikidata(fila, llicencies, descarregat);
      if (fitxa.imatge !== null) comptador.ambImatge += 1;
      if (fitxa.escut !== null) comptador.ambEscut += 1;
      if (fitxa.osmRelacio !== null) comptador.ambOsm += 1;
      if (fitxa.viquipedia !== null) comptador.ambViquipedia += 1;
      comptador.imatgesDescartades += fitxa.descartats.length;

      for (const descartada of fitxa.descartats) {
        await run.issue({
          kind: "commons_imatge_descartada",
          severity: "baixa",
          municipalityId,
          detail: { nom, ...descartada },
        });
      }

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
      `${comptador.ambImatge} amb fotografia · ${comptador.ambEscut} amb escut · ` +
        `${comptador.ambOsm} amb relació d'OSM · ${comptador.ambViquipedia} amb article`,
    );
    return { ...comptador, crides, aparellats: parelles.length, descarregat };
  });
}
