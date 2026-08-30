import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { mayors, municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { fetchImatge } from "../adapters/seue";
import { fetchJson, sleep } from "../lib/http";
import { normalizePersonName } from "../lib/text";
import { withRun } from "../lib/run";
import { urlLlicencia } from "../publish/escut";
import { directoriFotos } from "./j11-fotos";
import { fitxerCommons, textPla, titolNormalitzat, veredicteLlicencia } from "./j20-wikidata";
import {
  KIND as KIND_TRAJECTORIA,
  qidDeUri,
  trossos,
  urlConsulta,
  type FitxaTrajectoria,
} from "./j21-trajectoria-electes";

/**
 * J28 — la cara dels exalcaldes, de Wikimedia Commons.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PER QUÈ AQUÍ SÍ QUE ES VA A WIKIMEDIA, QUAN PER ALS ALCALDES D'ARA ES VA DIR QUE NO
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * La política de fotografies del projecte (docs/metodologia/05) ordena les
 * fonts: primer el retrat oficial de l'ajuntament, i **només quan no n'hi ha
 * cap**, Wikimedia Commons amb l'autor i la llicència al peu. Per als alcaldes
 * d'ara hi ha retrat oficial a la seu electrònica, i per això `FONTS-AOC.md` va
 * descartar Wikidata com a font de cares: en tenia 134 quan la seu en donava
 * centenars. Per als **exalcaldes** no hi ha cap portal oficial que en publiqui
 * la cara —qui va plegar el 1995 no és a cap cartipàs—, i Wikimedia és
 * exactament la font que la política reserva per a aquest cas.
 *
 * Consultat contra WDQS el 30-08-2026, sobre les 2.921 persones que J21 ja va
 * aparellar: **362 tenen fotografia (P18)**, i d'aquestes **133 encara tenen un
 * mandat obert** —els alcaldes d'ara, que aquí queden fora— i **229 només en
 * tenen de tancats**. O sigui que la feina és d'uns 230 retrats, i no dels 947:
 * la pàgina que els ensenya ho ha de dir amb aquestes xifres al costat.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUI QUEDA FORA, I PER QUÈ NO ES MIRA A WIKIDATA SINÓ A CASA
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * L'alcalde en actiu es coneix per la font oficial, no per si Wikidata li ha
 * tancat el mandat: el 28 % de les fitxes de municipi porten l'alcalde
 * desactualitzat (J20 ho va mesurar) i amb les persones no és millor. Per això
 * es compara amb el que ja tenim: el nom d'alcaldia del padró de la Generalitat
 * (`municipalities.mayorName`) i l'última fila del mandat 2023-2027 del nostre
 * historial. Qui lliga amb qualsevol dels dos, en qualsevol municipi on hagi
 * manat, **no es baixa**: té el retrat oficial, i el de Commons només serviria
 * per posar-hi al costat una cara de fa quinze anys.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA LLICÈNCIA MANA, I LA LLISTA ÉS LA DE J20
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Cada fitxer es consulta a l'API de Commons i només es desa el que és lliure
 * segons **la mateixa llista tancada que J20** (CC0, domini públic, CC BY i CC
 * BY-SA). Un cas que hi cau, comprovat: els retrats que la Generalitat va pujar
 * a Commons van amb la plantilla «Attribution», que no porta codi de llicència
 * llegible per màquina; sense codi no hi ha permís, és desconeixement, i es
 * descarten amb el motiu escrit. Si un dia es decideix acceptar-los, el lloc
 * de fer-ho és la llista de J20 i no una excepció aquí.
 *
 * Els SVG i els TIFF tampoc no es baixen: un retrat en vector no existeix, i el
 * TIFF que Commons converteix a JPEG per fer-ne la miniatura no és el fitxer
 * que la pàgina de descripció descriu.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ES DEMANA LA MINIATURA, NO L'ORIGINAL, I ES DESA A CASA
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Es demana `iiurlwidth=240` a l'API i es baixa el que Commons ja té renderitzat
 * a aquesta mida: la pàgina no ensenya cap retrat més gran de 56 px i no té cap
 * sentit fer servir 6 MB d'original per a 48 px de cara. El fitxer es desa a
 * `web/public/observatori/fotos/wikimedia/<QID>.<format>` tal com arriba —JPEG,
 * PNG o WebP; no es reconverteix—, amb un `.json` al costat que porta l'autor,
 * la llicència i la pàgina del fitxer: un directori de cares sense la seva
 * atribució, si algú se'l copia, és un directori que incompleix la llicència
 * de totes.
 *
 * Dues coses que l'API diu i que no es creuen a cegues, comprovades el
 * 30-08-2026: quan l'original fa menys de 240 px, `thumburl` és l'original i
 * `thumbwidth` diu 240 igualment (139 × 140 reportat com a 240 × 242); i
 * `thumburl` porta paràmetres de seguiment (`?utm_source=…`) que no formen
 * part del fitxer. Per això les mides es llegeixen dels bytes que arriben i
 * la URL es neteja abans de demanar-la.
 *
 * **Idempotent**: si el fitxer hi és i el `.json` del costat diu que ve del
 * mateix fitxer de Commons, no es demana ni la llicència ni la imatge. Una
 * segona execució són només les consultes SPARQL, que són les que diuen si a
 * algú li han canviat la foto.
 *
 * **Respectuós**: una petició cada cop, en sèrie, amb pausa entremig i amb
 * l'User-Agent del projecte. Uns 20 SPARQL, uns 8 a l'API de Commons i uns 230
 * fitxers, una sola vegada.
 *
 * Fonts: https://query.wikidata.org/sparql (dades CC0 1.0) i
 * https://commons.wikimedia.org/w/api.php (llicència per fitxer).
 */

export const KIND = "fotosExalcaldes";

const FONT = "Wikidata (wikidata.org)";
const FONT_IMATGES = "Wikimedia Commons (commons.wikimedia.org)";
const LLICENCIA_DADES = "CC0 1.0";

const API_COMMONS = "https://commons.wikimedia.org/w/api.php";

/** El mandat en curs del nostre historial: qui hi surt últim té retrat oficial. */
export const TERME_ACTUAL = "2023-2027";

/**
 * Quants QID caben a un VALUES. Amb 100 la consulta és de tres propietats i
 * respon en un segon; J21 en posa 300 per a càrrecs i perfil, però aquí no cal
 * apurar i un lot més curt és un lot que es reintenta més barat.
 */
const QIDS_PER_CRIDA = 100;

/** L'API de Commons accepta 50 títols per crida, com a J20. */
const FITXERS_PER_CRIDA = 50;

/** Amplada que es demana a Commons. La pàgina no en dibuixa cap més gran de 56 px. */
export const AMPLADA = 240;

/** Pausa entre consultes SPARQL, la mateixa que J21. */
const PAUSA_SPARQL_MS = 600;

/** Pausa entre crides a l'API de Commons, la mateixa que J20. */
const PAUSA_COMMONS_MS = 400;

/** Pausa entre descàrregues: mig segon són dues peticions per segon com a màxim. */
const PAUSA_BAIXADA_MS = 500;

/** Si Commons falla de manera sostinguda val més plegar i continuar un altre dia. */
const ERRORS_SEGUITS_MAXIM = 20;

// ─────────────────────────────────────────────────────────────────────────────
// Tipus
// ─────────────────────────────────────────────────────────────────────────────

export type FormatRetrat = "jpg" | "png" | "webp";

/** Una persona amb retrat, tal com es desa a la fitxa de cada municipi. */
export type PersonaFoto = {
  qid: string;
  nom: string;
  /** Any de naixement (P569) i de defunció (P570), si Wikidata els té. */
  naixement: number | null;
  defuncio: number | null;
  /** Camí públic: `/observatori/fotos/wikimedia/Q14320.jpg`. */
  cami: string;
  format: FormatRetrat;
  /** Mides reals del fitxer desat, llegides dels bytes. */
  amplada: number;
  alcada: number;
  /** Títol a Commons, que és el que identifica l'obra. */
  fitxer: string;
  /** Pàgina de descripció: l'enllaç obligatori de l'atribució. */
  paginaFitxer: string;
  autor: string | null;
  llicencia: { codi: string; nom: string; url: string | null };
};

/** Un retrat que no es publica, i per què. També és informació. */
export type FotoDescartada = {
  qid: string;
  nom: string;
  fitxer: string | null;
  llicencia: string | null;
  motiu: string;
};

export type FitxaFotosExalcaldes = {
  font: string;
  fontImatges: string;
  llicenciaDades: string;
  /** Data de la consulta: sense data, cap dada no entra a la fitxa. */
  consultat: string;
  ine5: string;
  /** Exalcaldes d'aquest municipi a Wikidata, un cop tret l'alcalde d'ara. */
  totalPersones: number;
  ambFoto: number;
  persones: PersonaFoto[];
  descartades: FotoDescartada[];
};

/** El `.json` que viatja amb el fitxer. El nom i els anys els posa cada execució. */
export type RetratDesat = Omit<PersonaFoto, "nom" | "naixement" | "defuncio"> & {
  font: string;
  descarregat: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// On van i com es diuen
// ─────────────────────────────────────────────────────────────────────────────

const CARPETA = "wikimedia";

/** Dins de la sortida de fotos de J11, en un directori a part: `fotos/wikimedia/`. */
export function directoriRetrats(arrel?: string): string {
  return join(directoriFotos(arrel), CARPETA);
}

/**
 * El nom és el **QID**: és l'única clau que la persona porta a totes les fitxes
 * municipals on surt, i la que no canvia si un dia se li corregeix el nom.
 */
export function camiPublicRetrat(qid: string, format: FormatRetrat): string {
  return `/observatori/fotos/${CARPETA}/${qid}.${format}`;
}

export function camiCreditRetrat(qid: string, arrel?: string): string {
  return join(directoriRetrats(arrel), `${qid}.json`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Qui queda fora: l'alcalde d'ara
// ─────────────────────────────────────────────────────────────────────────────

export type FilaMandatActual = {
  municipalityId: number;
  name: string;
  tookOfficeOn: string | null;
};

/**
 * Els noms normalitzats de qui mana ara a cada municipi.
 *
 * Dues fonts, i s'ajunten: el nom d'alcaldia del padró de la Generalitat i
 * l'**última** fila del mandat 2023-2027 del nostre historial. L'última, i no
 * totes: quan hi ha hagut un relleu a mig mandat, la primera fila és algú que
 * ja ha plegat i que, per tant, és un exalcalde com qualsevol altre. Si cap
 * fila no porta data no es pot saber quina és l'última, i llavors s'hi queden
 * totes, que és l'error prudent: un retrat de menys i no una cara de Commons
 * al costat del retrat oficial.
 */
export function alcaldesActuals(
  files: readonly FilaMandatActual[],
  munis: readonly { id: number; mayorName: string | null }[],
): Map<number, Set<string>> {
  const actuals = new Map<number, Set<string>>();
  const afegeix = (municipalityId: number, nom: string): void => {
    const clau = normalizePersonName(nom);
    if (clau === "") return;
    const grup = actuals.get(municipalityId);
    if (grup === undefined) actuals.set(municipalityId, new Set([clau]));
    else grup.add(clau);
  };

  for (const muni of munis) {
    if (muni.mayorName !== null) afegeix(muni.id, muni.mayorName);
  }

  const perMunicipi = new Map<number, FilaMandatActual[]>();
  for (const fila of files) {
    const grup = perMunicipi.get(fila.municipalityId);
    if (grup === undefined) perMunicipi.set(fila.municipalityId, [fila]);
    else grup.push(fila);
  }
  for (const [municipalityId, grup] of perMunicipi) {
    const ambData = grup.filter((f) => f.tookOfficeOn !== null);
    if (ambData.length === 0) {
      for (const fila of grup) afegeix(municipalityId, fila.name);
      continue;
    }
    ambData.sort((a, b) => b.tookOfficeOn!.localeCompare(a.tookOfficeOn!));
    afegeix(municipalityId, ambData[0]!.name);
  }
  return actuals;
}

/** Una persona de J21 amb els municipis on surt, per saber si en algun mana ara. */
export type Candidat = { qid: string; nom: string; municipis: Set<number> };

export function esAlcaldeActual(
  candidat: Candidat,
  actuals: ReadonlyMap<number, ReadonlySet<string>>,
): boolean {
  const clau = normalizePersonName(candidat.nom);
  if (clau === "") return false;
  for (const municipalityId of candidat.municipis) {
    if (actuals.get(municipalityId)?.has(clau)) return true;
  }
  return false;
}

/**
 * Els candidats a retrat: cada persona de cada fitxa de J21, una sola vegada i
 * amb tots els municipis on hi surt. Qui ha manat a dos pobles és a dues
 * fitxes, i el retrat s'ha de baixar un cop i publicar-se a totes dues.
 */
export function candidats(
  fitxes: readonly { municipalityId: number; fitxa: FitxaTrajectoria }[],
): Map<string, Candidat> {
  const perQid = new Map<string, Candidat>();
  for (const { municipalityId, fitxa } of fitxes) {
    if (!Array.isArray(fitxa?.persones)) continue;
    for (const p of fitxa.persones) {
      if (typeof p?.qid !== "string" || typeof p?.nom !== "string") continue;
      const previ = perQid.get(p.qid);
      if (previ === undefined) {
        perQid.set(p.qid, { qid: p.qid, nom: p.nom, municipis: new Set([municipalityId]) });
      } else previ.municipis.add(municipalityId);
    }
  }
  return perQid;
}

// ─────────────────────────────────────────────────────────────────────────────
// La consulta a Wikidata
// ─────────────────────────────────────────────────────────────────────────────

/**
 * La fotografia (P18) i, ja que hi som, els anys de naixement i de defunció:
 * J21 desa la data de naixement però no la de defunció, i un retrat d'algú que
 * ja no hi és demana poder-ho dir. P18 **no** va dins d'OPTIONAL a posta: de
 * les persones sense fotografia no ens cal res, i deixar-les fora és el que fa
 * que la resposta sigui de desenes de files i no de centenars.
 */
export function consultaFotos(qids: readonly string[]): string {
  return [
    "SELECT ?persona ?imatge ?naixement ?defuncio WHERE {",
    `  VALUES ?persona { ${qids.map((q) => `wd:${q}`).join(" ")} }`,
    "  ?persona wdt:P18 ?imatge .",
    "  OPTIONAL { ?persona wdt:P569 ?naixement }",
    "  OPTIONAL { ?persona wdt:P570 ?defuncio }",
    "}",
  ].join("\n");
}

type BindingSparql = Record<string, { value?: unknown } | undefined>;

const valor = (b: BindingSparql, clau: string): string | null => {
  const v = b[clau]?.value;
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
};

/** L'any d'una data de Wikidata, que ve amb hora i pot ser negativa. */
export const anyDe = (brut: string | null): number | null => {
  if (brut === null) return null;
  const any = Number(brut.match(/^(-?\d{4})-/)?.[1]);
  return Number.isFinite(any) && any > 0 ? any : null;
};

export type FotoWikidata = {
  qid: string;
  /** Títol normalitzat del fitxer de Commons: «File:Nom.jpg». */
  fitxer: string;
  naixement: number | null;
  defuncio: number | null;
};

/**
 * Una fila per persona. Dues fotografies a P18 multipliquen les files i es
 * queda la primera: `wdt:` ja torna la de rang preferent quan n'hi ha, i entre
 * dues del mateix rang triar-ne una és tan bo com triar l'altra.
 */
export function parseFotos(json: unknown): FotoWikidata[] {
  const brut = (json as { results?: { bindings?: BindingSparql[] } })?.results?.bindings;
  if (!Array.isArray(brut)) return [];
  const perQid = new Map<string, FotoWikidata>();
  for (const b of brut) {
    const qid = qidDeUri(valor(b, "persona"));
    const fitxer = fitxerCommons(valor(b, "imatge"));
    if (qid === null || fitxer === null || fitxer === "") continue;
    const previ = perQid.get(qid);
    if (previ !== undefined) {
      previ.naixement ??= anyDe(valor(b, "naixement"));
      previ.defuncio ??= anyDe(valor(b, "defuncio"));
      continue;
    }
    perQid.set(qid, {
      qid,
      fitxer,
      naixement: anyDe(valor(b, "naixement")),
      defuncio: anyDe(valor(b, "defuncio")),
    });
  }
  return [...perQid.values()];
}

// ─────────────────────────────────────────────────────────────────────────────
// L'API de Commons: llicència, autor i miniatura
// ─────────────────────────────────────────────────────────────────────────────

/** URL de la crida a Commons per a un grup de títols, amb la miniatura demanada. */
export function urlImageinfo(fitxers: readonly string[], amplada: number = AMPLADA): string {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    prop: "imageinfo",
    iiprop: "url|mime|extmetadata",
    iiurlwidth: String(amplada),
    iiextmetadatafilter: "License|LicenseShortName|LicenseUrl|Artist|AttributionRequired",
    titles: fitxers.join("|"),
  });
  return `${API_COMMONS}?${params.toString()}`;
}

/** Els formats que es publiquen tal com arriben. La resta es descarta amb motiu. */
const MIMES_PUBLICABLES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * La URL de la miniatura sense la cua de seguiment que l'API hi enganxa
 * (`?utm_source=commons.wikimedia.org&utm_campaign=imageinfo…`). No forma part
 * del fitxer i no hi ha cap raó per dir-li a Wikimedia des d'on el demanem.
 */
export function netejaUrl(url: string): string {
  return url.split("?")[0] ?? url;
}

/** Un retrat que hem comprovat que es pot republicar, encara per baixar. */
export type RetratCommons = {
  fitxer: string;
  paginaFitxer: string;
  miniaturaUrl: string;
  mime: string;
  autor: string | null;
  llicencia: { codi: string; nom: string; url: string | null };
};

export type ResultatRetrat =
  | { ok: true; retrat: RetratCommons }
  | { ok: false; llicencia: string | null; motiu: string };

type PaginaCommons = {
  title?: unknown;
  missing?: unknown;
  imageinfo?: {
    url?: unknown;
    descriptionurl?: unknown;
    thumburl?: unknown;
    mime?: unknown;
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
 * Llegeix una resposta de l'API de Commons i decideix, fitxer a fitxer, si el
 * retrat es pot publicar. L'ordre de les comprovacions és el de la seguretat:
 * primer la llicència, que és la que decideix si tenim permís; després el
 * format, que decideix si el que ens donen és el fitxer que la pàgina descriu;
 * i al final la miniatura, sense la qual no hi ha res a baixar. Els títols
 * demanats que la resposta no menciona també compten, com a J20.
 */
export function llegeixImageinfo(
  json: unknown,
  demanats: readonly string[],
): Map<string, ResultatRetrat> {
  const brut = (json as { query?: { pages?: unknown } })?.query?.pages;
  const pagines: PaginaCommons[] = Array.isArray(brut) ? (brut as PaginaCommons[]) : [];
  const resultats = new Map<string, ResultatRetrat>();

  for (const pagina of pagines) {
    const titol = typeof pagina.title === "string" ? titolNormalitzat(pagina.title) : "";
    if (titol === "") continue;
    const info = Array.isArray(pagina.imageinfo) ? pagina.imageinfo[0] : undefined;
    const extra = info?.extmetadata;
    const codi = metadada(extra, "License");

    const veredicte = veredicteLlicencia(codi);
    if (!veredicte.lliure) {
      resultats.set(titol, { ok: false, llicencia: codi, motiu: veredicte.motiu });
      continue;
    }

    const mime = typeof info?.mime === "string" ? info.mime : null;
    if (mime === null || !MIMES_PUBLICABLES.has(mime)) {
      resultats.set(titol, {
        ok: false,
        llicencia: codi,
        motiu: `format no publicable: ${mime ?? "desconegut"}`,
      });
      continue;
    }

    const miniatura = typeof info?.thumburl === "string" ? info.thumburl : null;
    const pagina2 = typeof info?.descriptionurl === "string" ? info.descriptionurl : null;
    if (miniatura === null || pagina2 === null) {
      resultats.set(titol, { ok: false, llicencia: codi, motiu: "Commons no en dona la miniatura" });
      continue;
    }

    resultats.set(titol, {
      ok: true,
      retrat: {
        fitxer: titol,
        paginaFitxer: pagina2,
        miniaturaUrl: netejaUrl(miniatura),
        mime,
        autor: textPla(metadada(extra, "Artist")),
        llicencia: {
          codi: veredicte.codi,
          nom: metadada(extra, "LicenseShortName") ?? veredicte.codi.toUpperCase(),
          // Commons dona l'enllaç quan la plantilla el porta; si no, es dedueix
          // del codi, i si tampoc no es pot, el crèdit anirà sense enllaç.
          url: metadada(extra, "LicenseUrl") ?? urlLlicencia(veredicte.codi),
        },
      },
    });
  }

  for (const demanat of demanats) {
    const titol = titolNormalitzat(demanat);
    if (!resultats.has(titol)) {
      resultats.set(titol, { ok: false, llicencia: null, motiu: "Commons no coneix aquest fitxer" });
    }
  }
  return resultats;
}

// ─────────────────────────────────────────────────────────────────────────────
// Els bytes que arriben: format i mides
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El format pels primers bytes i no per l'extensió ni pel `mime` de l'API: el
 * fitxer que es desa és el que ha arribat, i el nom que se li posa ha de dir
 * la veritat sobre el que hi ha a dins.
 */
export function formatDelsBytes(bytes: Uint8Array): FormatRetrat | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  ) {
    return "png";
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "webp";
  return null;
}

const ascii = (bytes: Uint8Array, de: number, a: number): string =>
  String.fromCharCode(...bytes.subarray(de, a));

const be16 = (b: Uint8Array, i: number): number => ((b[i] ?? 0) << 8) | (b[i + 1] ?? 0);
const be32 = (b: Uint8Array, i: number): number =>
  ((b[i] ?? 0) * 0x1000000) + (((b[i + 1] ?? 0) << 16) | ((b[i + 2] ?? 0) << 8) | (b[i + 3] ?? 0));
const le16 = (b: Uint8Array, i: number): number => (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8);
const le24 = (b: Uint8Array, i: number): number =>
  (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8) | ((b[i + 2] ?? 0) << 16);

export type Mides = { amplada: number; alcada: number };

/**
 * Les mides llegides de la capçalera del fitxer. Es fa aquí i no amb `sips`
 * com J11 i J26 per dues raons: aquesta feina no reconverteix res i no
 * necessita cap eina d'imatge, i l'API de Commons no és de fiar en això —quan
 * l'original és més petit que la miniatura demanada, diu 240 igualment.
 */
export function midesImatge(bytes: Uint8Array): Mides | null {
  const format = formatDelsBytes(bytes);
  if (format === "png") {
    if (bytes.length < 24 || ascii(bytes, 12, 16) !== "IHDR") return null;
    return valida({ amplada: be32(bytes, 16), alcada: be32(bytes, 20) });
  }
  if (format === "jpg") return midesJpeg(bytes);
  if (format === "webp") return midesWebp(bytes);
  return null;
}

const valida = (m: Mides): Mides | null =>
  m.amplada > 0 && m.alcada > 0 && m.amplada < 100_000 && m.alcada < 100_000 ? m : null;

/** Recorre els segments fins al primer SOF, que és el que porta les mides. */
function midesJpeg(bytes: Uint8Array): Mides | null {
  let i = 2;
  while (i + 3 < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marcador = bytes[i + 1] ?? 0;
    // Farciment: pot haver-hi més d'un 0xFF seguit abans del marcador.
    if (marcador === 0xff) {
      i += 1;
      continue;
    }
    // Sense cos: SOI, EOI, RSTn i TEM.
    if (marcador === 0xd8 || marcador === 0xd9 || marcador === 0x01 || (marcador >= 0xd0 && marcador <= 0xd7)) {
      i += 2;
      continue;
    }
    const esSof =
      marcador >= 0xc0 && marcador <= 0xcf && marcador !== 0xc4 && marcador !== 0xc8 && marcador !== 0xcc;
    if (esSof) {
      if (i + 8 >= bytes.length) return null;
      return valida({ alcada: be16(bytes, i + 5), amplada: be16(bytes, i + 7) });
    }
    const llargada = be16(bytes, i + 2);
    if (llargada < 2) return null;
    i += 2 + llargada;
  }
  return null;
}

/** Les tres variants del contenidor WebP: VP8 (amb pèrdua), VP8L (sense) i VP8X (estès). */
function midesWebp(bytes: Uint8Array): Mides | null {
  if (bytes.length < 30) return null;
  const tros = ascii(bytes, 12, 16);
  if (tros === "VP8 ") return valida({ amplada: le16(bytes, 26) & 0x3fff, alcada: le16(bytes, 28) & 0x3fff });
  if (tros === "VP8L") {
    const b1 = bytes[21] ?? 0;
    const b2 = bytes[22] ?? 0;
    const b3 = bytes[23] ?? 0;
    const b4 = bytes[24] ?? 0;
    return valida({
      amplada: 1 + (b1 | ((b2 & 0x3f) << 8)),
      alcada: 1 + ((b2 >> 6) | (b3 << 2) | ((b4 & 0x0f) << 10)),
    });
  }
  if (tros === "VP8X") return valida({ amplada: 1 + le24(bytes, 24), alcada: 1 + le24(bytes, 27) });
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Idempotència i descàrrega
// ─────────────────────────────────────────────────────────────────────────────

async function existeix(cami: string): Promise<boolean> {
  try {
    return (await stat(cami)).size > 0;
  } catch {
    return false;
  }
}

/** El crèdit desat al costat del retrat, si hi és i es pot llegir. */
export async function retratDesat(qid: string, arrel?: string): Promise<RetratDesat | null> {
  try {
    const brut = JSON.parse(await readFile(camiCreditRetrat(qid, arrel), "utf8")) as RetratDesat;
    return typeof brut?.fitxer === "string" && typeof brut?.cami === "string" && typeof brut?.format === "string"
      ? brut
      : null;
  } catch {
    return null;
  }
}

/**
 * Serveix el que ja hi ha? Només si és el **mateix fitxer de Commons**: el nom
 * local és el QID i no canvia mai, de manera que una fotografia substituïda a
 * Wikidata passaria desapercebuda per sempre si només es mirés que el fitxer
 * existeix.
 */
export function serveixElQueHiHa(previ: RetratDesat | null, fitxer: string): boolean {
  return previ !== null && titolNormalitzat(previ.fitxer) === titolNormalitzat(fitxer);
}

export type Estat = "desada" | "ja-hi-era" | "sense-resposta" | "illegible";

export type ResultatBaixada = { estat: Estat; retrat: RetratDesat | null };

/**
 * Baixa la miniatura i la desa amb el seu crèdit al costat. Tot el que decideix
 * és a les funcions pures de sobre; aquí només hi ha l'entrada i la sortida,
 * que és el que no es pot provar sense xarxa.
 */
export async function baixaRetrat(
  retrat: RetratCommons,
  qid: string,
  descarregat: string,
  arrel?: string,
): Promise<ResultatBaixada> {
  const carpeta = directoriRetrats(arrel);
  const bytes = await fetchImatge(retrat.miniaturaUrl);
  if (bytes === null) return { estat: "sense-resposta", retrat: null };

  const format = formatDelsBytes(bytes);
  const mides = midesImatge(bytes);
  if (format === null || mides === null) return { estat: "illegible", retrat: null };

  await mkdir(carpeta, { recursive: true });
  await writeFile(join(carpeta, `${qid}.${format}`), bytes);
  // Si el format ha canviat respecte de l'execució anterior, el fitxer vell
  // no s'ha de quedar: seria una cara sense crèdit que la digui.
  for (const altre of ["jpg", "png", "webp"] as const) {
    if (altre !== format) await rm(join(carpeta, `${qid}.${altre}`), { force: true });
  }

  const desat: RetratDesat = {
    qid,
    cami: camiPublicRetrat(qid, format),
    format,
    amplada: mides.amplada,
    alcada: mides.alcada,
    fitxer: retrat.fitxer,
    paginaFitxer: retrat.paginaFitxer,
    autor: retrat.autor,
    llicencia: retrat.llicencia,
    font: FONT_IMATGES,
    descarregat,
  };
  await writeFile(camiCreditRetrat(qid, arrel), `${JSON.stringify(desat, null, 2)}\n`, "utf8");
  return { estat: "desada", retrat: desat };
}

// ─────────────────────────────────────────────────────────────────────────────
// La fitxa que es desa
// ─────────────────────────────────────────────────────────────────────────────

export function personaFoto(
  candidat: { qid: string; nom: string },
  foto: { naixement: number | null; defuncio: number | null },
  desat: RetratDesat,
): PersonaFoto {
  return {
    qid: candidat.qid,
    nom: candidat.nom,
    naixement: foto.naixement,
    defuncio: foto.defuncio,
    cami: desat.cami,
    format: desat.format,
    amplada: desat.amplada,
    alcada: desat.alcada,
    fitxer: desat.fitxer,
    paginaFitxer: desat.paginaFitxer,
    autor: desat.autor,
    llicencia: desat.llicencia,
  };
}

export function fitxaFotosExalcaldes(
  ine5: string,
  totalPersones: number,
  persones: readonly PersonaFoto[],
  descartades: readonly FotoDescartada[],
  consultat: string,
): FitxaFotosExalcaldes {
  return {
    font: FONT,
    fontImatges: FONT_IMATGES,
    llicenciaDades: LLICENCIA_DADES,
    consultat,
    ine5,
    totalPersones,
    ambFoto: persones.length,
    persones: [...persones].sort((a, b) => a.nom.localeCompare(b.nom, "ca")),
    descartades: [...descartades],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// La feina
// ─────────────────────────────────────────────────────────────────────────────

export type OpcionsJ28 = {
  /** Arrel del repositori; només per a les proves. */
  arrel?: string;
  /** Torna a demanar llicència i fitxer de tothom, ignorant el que hi ha desat. */
  forca?: boolean;
  /** Quantes descàrregues com a màxim, per provar-ho amb poques. */
  limit?: number;
};

export async function j28FotosExalcaldes(db: Db, options: OpcionsJ28 = {}): Promise<void> {
  await withRun(db, "j28-fotos-exalcaldes", async (run) => {
    await mkdir(directoriRetrats(options.arrel), { recursive: true });
    run.say(`retrats a ${directoriRetrats(options.arrel)}`);

    // 1. Qui hi ha: les persones de les 947 fitxes de J21, deduplicades per QID.
    const fitxes = (
      await db
        .select({ municipalityId: municipalityMetrics.municipalityId, data: municipalityMetrics.data })
        .from(municipalityMetrics)
        .where(eq(municipalityMetrics.kind, KIND_TRAJECTORIA))
    ).map((f) => ({ municipalityId: f.municipalityId, fitxa: f.data as FitxaTrajectoria }));
    if (fitxes.length === 0) throw new Error("no hi ha cap fitxa de trajectòria: cal executar J21 abans");
    const tots = candidats(fitxes);
    run.rowsIn = tots.size;
    run.say(`${fitxes.length} fitxes de J21 · ${tots.size} persones amb QID`);

    // 2. Qui mana ara queda fora: té retrat oficial.
    const munis = await db
      .select({ id: municipalities.id, ine5: municipalities.ine5, name: municipalities.name, mayorName: municipalities.mayorName })
      .from(municipalities);
    const perId = new Map(munis.map((m) => [m.id, m]));
    const actuals = alcaldesActuals(
      (
        await db
          .select({ municipalityId: mayors.municipalityId, name: mayors.name, tookOfficeOn: mayors.tookOfficeOn })
          .from(mayors)
          .where(eq(mayors.term, TERME_ACTUAL))
      ).map((f) => ({ municipalityId: f.municipalityId, name: f.name, tookOfficeOn: f.tookOfficeOn })),
      munis,
    );
    const exalcaldes: Candidat[] = [];
    let exclososActuals = 0;
    for (const candidat of tots.values()) {
      if (esAlcaldeActual(candidat, actuals)) exclososActuals += 1;
      else exalcaldes.push(candidat);
    }
    run.say(`${exclososActuals} alcaldes d'ara fora (tenen retrat oficial) · ${exalcaldes.length} exalcaldes a mirar`);

    // 3. Qui té fotografia a Wikidata, en lots de 100 QID.
    const fotos = new Map<string, FotoWikidata>();
    let cridesSparql = 0;
    for (const lot of trossos(exalcaldes.map((c) => c.qid), QIDS_PER_CRIDA)) {
      const json = await fetchJson<unknown>(urlConsulta(consultaFotos(lot)), { delayMs: PAUSA_SPARQL_MS });
      cridesSparql += 1;
      for (const foto of parseFotos(json)) fotos.set(foto.qid, foto);
    }
    run.say(`${cridesSparql} consultes SPARQL · ${fotos.size} exalcaldes amb fotografia a Wikidata`);

    // 4. Memòria: el que ja és a disc i ve del mateix fitxer no es torna a demanar.
    const desats = new Map<string, RetratDesat>();
    const pendents: { candidat: Candidat; foto: FotoWikidata }[] = [];
    for (const foto of fotos.values()) {
      const candidat = tots.get(foto.qid)!;
      const previ = options.forca ? null : await retratDesat(foto.qid, options.arrel);
      if (
        serveixElQueHiHa(previ, foto.fitxer) &&
        (await existeix(join(directoriRetrats(options.arrel), `${foto.qid}.${previ!.format}`)))
      ) {
        desats.set(foto.qid, previ!);
      } else pendents.push({ candidat, foto });
    }
    run.say(`${desats.size} retrats ja a disc · ${pendents.length} fitxers per comprovar a Commons`);

    // 5. Llicència, autor i miniatura, en lots de 50 títols.
    const llicencies = new Map<string, ResultatRetrat>();
    const titols = [...new Set(pendents.map((p) => p.foto.fitxer))];
    let cridesCommons = 0;
    for (const grup of trossos(titols, FITXERS_PER_CRIDA)) {
      try {
        const json = await fetchJson<unknown>(urlImageinfo(grup), { delayMs: PAUSA_COMMONS_MS });
        cridesCommons += 1;
        for (const [titol, resultat] of llegeixImageinfo(json, grup)) llicencies.set(titol, resultat);
      } catch (error) {
        // Un lot que peta no s'endú la feina: els seus fitxers queden sense
        // llicència i, per tant, sense publicar. La propera execució hi torna.
        await run.issue({
          kind: "commons_llicencia_error",
          severity: "mitjana",
          detail: { fitxers: grup.length, primer: grup[0] ?? null, error: String(error) },
        });
      }
    }
    run.say(`${cridesCommons} crides a l'API de Commons`);

    // 6. Les descàrregues, una a una, amb pausa.
    const consultat = new Date().toISOString().slice(0, 10);
    const descartadesPerQid = new Map<string, FotoDescartada>();
    const perMotiu = new Map<string, number>();
    const c = { desades: 0, senseResposta: 0, illegibles: 0, errors: 0, peticions: 0 };
    let errorsSeguits = 0;
    let baixades = 0;

    for (const { candidat, foto } of pendents) {
      const resultat = llicencies.get(foto.fitxer) ?? {
        ok: false as const,
        llicencia: null,
        motiu: "llicència no consultada",
      };
      if (!resultat.ok) {
        const descartada = { qid: candidat.qid, nom: candidat.nom, fitxer: foto.fitxer, llicencia: resultat.llicencia, motiu: resultat.motiu };
        descartadesPerQid.set(candidat.qid, descartada);
        perMotiu.set(resultat.motiu, (perMotiu.get(resultat.motiu) ?? 0) + 1);
        await run.issue({
          kind: "commons_retrat_descartat",
          severity: "baixa",
          municipalityId: [...candidat.municipis][0],
          entity: candidat.qid,
          detail: descartada,
        });
        continue;
      }
      if (options.limit !== undefined && baixades >= options.limit) break;

      try {
        const { estat, retrat } = await baixaRetrat(resultat.retrat, candidat.qid, consultat, options.arrel);
        c.peticions += 1;
        baixades += 1;
        if (estat === "desada" && retrat !== null) {
          c.desades += 1;
          desats.set(candidat.qid, retrat);
        } else {
          if (estat === "sense-resposta") c.senseResposta += 1;
          else c.illegibles += 1;
          await run.issue({
            kind: "retrat_exalcalde_no_desat",
            severity: "baixa",
            municipalityId: [...candidat.municipis][0],
            entity: candidat.qid,
            detail: { nom: candidat.nom, fitxer: foto.fitxer, estat, url: resultat.retrat.miniaturaUrl },
          });
        }
        errorsSeguits = 0;
        await sleep(PAUSA_BAIXADA_MS);
      } catch (error) {
        c.errors += 1;
        errorsSeguits += 1;
        await run.issue({
          kind: "retrat_exalcalde_error",
          severity: "baixa",
          municipalityId: [...candidat.municipis][0],
          entity: candidat.qid,
          detail: { nom: candidat.nom, fitxer: foto.fitxer, error: String(error) },
        });
        if (errorsSeguits >= ERRORS_SEGUITS_MAXIM) {
          run.say(`${errorsSeguits} errors seguits: s'atura per no insistir-hi`);
          break;
        }
      }
    }
    run.say(`${c.desades} retrats nous · ${c.senseResposta} sense resposta · ${c.illegibles} il·legibles · ${c.errors} errors · ${c.peticions} descàrregues`);
    if (perMotiu.size > 0) {
      run.say(`descartats: ${[...perMotiu].map(([motiu, n]) => `${n} ${motiu}`).join(" · ")}`);
    }

    // 7. Per municipi: qui hi té cara i qui no, i per què.
    const exalcaldesPerQid = new Map(exalcaldes.map((c) => [c.qid, c]));
    let municipisAmbFoto = 0;
    for (const { municipalityId, fitxa } of fitxes) {
      const muni = perId.get(municipalityId);
      if (muni === undefined || !Array.isArray(fitxa?.persones)) continue;
      const persones: PersonaFoto[] = [];
      const descartades: FotoDescartada[] = [];
      let totalPersones = 0;
      for (const p of fitxa.persones) {
        const candidat = exalcaldesPerQid.get(p.qid);
        if (candidat === undefined) continue;
        totalPersones += 1;
        const foto = fotos.get(p.qid);
        const desat = desats.get(p.qid);
        if (foto !== undefined && desat !== undefined) persones.push(personaFoto(candidat, foto, desat));
        const descartada = descartadesPerQid.get(p.qid);
        if (descartada !== undefined) descartades.push(descartada);
      }
      if (persones.length > 0) municipisAmbFoto += 1;
      const data = fitxaFotosExalcaldes(muni.ine5, totalPersones, persones, descartades, consultat);
      await db
        .insert(municipalityMetrics)
        .values({ municipalityId, kind: KIND, data })
        .onConflictDoUpdate({
          target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
          set: { data, computedAt: new Date() },
        });
      run.rowsOut += 1;
    }

    run.say(`${desats.size} exalcaldes amb retrat publicable · ${municipisAmbFoto} municipis amb alguna cara`);
    return {
      font: FONT,
      fontImatges: FONT_IMATGES,
      consultat,
      persones: tots.size,
      exclososActuals,
      exalcaldes: exalcaldes.length,
      ambFotoWikidata: fotos.size,
      ambRetrat: desats.size,
      descartades: descartadesPerQid.size,
      perMotiu: Object.fromEntries(perMotiu),
      municipisAmbFoto,
      crides: cridesSparql + cridesCommons + c.peticions,
      ...c,
    };
  });
}
