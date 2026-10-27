import { municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { DATASETS, socrataAll } from "../adapters/socrata";
import { fetchJson, sleep } from "../lib/http";
import { normalize } from "../lib/text";
import { withRun, type Run } from "../lib/run";
import { clauEns, llegeixRegistre } from "./j39-subvencions-ens";

/** Una fila del registre d'ens tal com la llegeix `llegeixRegistre` de la J39. */
type FilaRegistre = Parameters<typeof llegeixRegistre>[0][number];

/**
 * J42 — què fan, a la pràctica, els consells comarcals i les diputacions:
 * els serveis socials bàsics que presten i com contracten.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA PREGUNTA
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * La fitxa d'un ens supramunicipal ja diu qui hi seu (J38), què gasta (J38) i
 * què reparteix als ajuntaments (J39). Li falten dues coses que un veí entén
 * sense saber què és un consell comarcal: **quina feina fa per la gent** i
 * **com compra el que compra**. Aquesta feina en desa les dues, a partir de
 * quatre conjunts del portal de dades obertes de la Generalitat (Socrata), i
 * sempre amb consultes agregades al servidor.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. ELS SERVEIS SOCIALS BÀSICS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * La Llei 12/2007, de serveis socials, organitza la porta d'entrada als serveis
 * socials en **àrees bàsiques** (ABSS): cada municipi de més de 20.000
 * habitants n'és una, i els municipis més petits s'agrupen per comarques, que
 * gestiona el consell comarcal. És la feina més visible d'un consell: el
 * treballador social del poble, l'ajuda a domicili, la teleassistència.
 *
 * Dos conjunts del Departament de Drets Socials i Inclusió, del 2018 al 2024,
 * amb una fila per àrea bàsica i any (109 àrees l'any, 744 files):
 *
 *   · `fvnd-jbxf` — **persones ateses** pels serveis socials bàsics, per sexe.
 *     Una persona compta un cop l'any, faci servir un servei o deu: és gent,
 *     no visites.
 *   · `qvkp-qkzs` — **servei d'ajuda a domicili** (SAD): persones ateses i hores
 *     fetes, separant l'ajuda social (vulnerabilitat, risc) de la de
 *     dependència (la que prescriu un Pla Individual d'Atenció).
 *
 * El mateix departament publica el nombre d'equips bàsics (`n727-iuzr`), però
 * la xifra salta de manera inversemblant d'un any a l'altre (Banyoles passa
 * d'1 equip el 2023 a 20 el 2024) i no es fa servir. Pressupost per àrea no
 * n'hi ha a cap conjunt obert.
 *
 * **La clau i el seu parany.** Cada fila porta `codi_idescat_eacat`, que és el
 * codi d'ens sense el zero del davant als municipis de Barcelona
 * (`801930008` = Barcelona). Als municipis el codi és fiable. **Als consells
 * no ho és**: el 2022, a `fvnd-jbxf`, cada codi comarcal porta les xifres i el
 * nom de la comarca següent per ordre alfabètic (al codi del Bages hi ha «Baix
 * Camp» i les persones del Baix Camp; al de l'Aran hi ha «Bages»). Comprovat
 * el 27-10-2026 comparant cada xifra amb la dels anys veïns: **el nom diu la
 * veritat, el codi no**. Per això les files de codi comarcal (`81…`) es lliguen
 * al consell **pel nom** de la comarca, i quan nom i codi no coincideixen es
 * deixa anotat com a incidència. A `qvkp-qkzs` el 2022 està ben alineat, però
 * la regla és la mateixa per als dos conjunts.
 *
 * **Quan no ho gestiona el consell.** En tres comarques la font posa l'àrea
 * bàsica a nom d'un consorci: el Consorci d'Acció Social de la Garrotxa
 * (`9801810007`, «CAS Garrotxa» i després «Garrotxa»), el Consorci de Benestar
 * Social del Ripollès (`9832860009`) i, des del 2023, el Consorci d'Osona de
 * Serveis Socials (`9822340003`). Aquestes xifres van a la fitxa del consell
 * de la comarca **dient qui les dona** (`gestor`), perquè són les de l'àrea
 * bàsica comarcal, però la pàgina no pot dir que les presti el consell sol.
 * Un consorci o una mancomunitat el nom de la qual no és el de la comarca (la
 * Mancomunitat La Plana, a Osona, que és una àrea bàsica a part) no s'hi suma:
 * es desa a `altresArees`, perquè la pàgina pugui dir que a la comarca n'hi ha
 * una altra. El Conselh Generau d'Aran té àrea pròpia però no és cap dels 40
 * consells, i aquí no es desa.
 *
 * **Un zero que no és un zero.** La font diu que «la cel·la buida equival a
 * dada no informada», però a la pràctica també hi escriu zeros: Martorell (més
 * de 28.000 habitants) passa de 4.793 persones ateses el 2022 a 0 el 2023 i a
 * 2.707 el 2024; el Montsià i la Terra Alta, igual el 2023. Una àrea bàsica
 * que atén milers de persones l'any no n'atén zero: quan **totes** les
 * persones d'una fila són zero, es desa `null` i es marca a
 * `zeroLlegitComBuit`, perquè la pàgina ho pugui explicar. Un zero en un sol
 * sexe, o un zero de SAD social amb dependència, és un recompte i es respecta.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 2. COM CONTRACTA
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `hb6v-jcbf` és el Registre públic de contractes: una fila per expedient (o
 * per lot) de tots els òrgans de contractació de Catalunya, amb
 * `id_organisme_contractant` = el codi d'ens de 10 xifres. Els 44 ens hi són
 * amb el seu codi; no cal el PSCP (`ybgg-dgi6`), que porta el codi INE de
 * l'ajuntament i no identifica els consells.
 *
 * Es compten les files de `situaci_contractual` «adjudicació» i «menor»: els
 * contractes nous. Les pròrrogues, modificacions i liquidacions són moments de
 * la vida d'un contracte que ja hi és, i comptar-les el duplicaria. L'any és
 * `exercici`, que el registre defineix com l'any d'inici d'execució. Per a cada
 * ens i any: quants contractes, quant s'hi ha adjudicat, i com es reparteixen
 * per tipus (obres, serveis, subministraments…) i per procediment, agrupat en
 * obert, menor, negociat, basat en acord marc i la resta.
 *
 * El gruix de dades és del 2021 ençà, i desigual: la Diputació de Barcelona hi
 * inscriu desenes de milers de contractes menors l'any, i alguns consells cap
 * (l'Alta Ribagorça no hi té res). Per això cada any porta `contractes` tal com
 * surt, sense omplir forats, i l'any en curs es marca com a incomplet.
 *
 * **Cap rànquing d'empreses.** La font porta el nom de cada adjudicatari i
 * seria fàcil dir a qui contracta més cada ens. La regla de la casa, escrita a
 * la J10, és que això no es fa: assenyala negocis concrets i no respon cap
 * pregunta del veí sobre l'ens. Les consultes **ni tan sols demanen** la
 * columna `adjudicatari`; qui vulgui el detall té l'enllaç a la font.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ON ES DESA
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   · Per a cada diputació i consell, al municipi seu (`6nei-4b44.codi_municipi`,
 *     com la J39), kind `serveisEns:<codiEns>` → `ServeisEnsDesats`. Girona,
 *     Lleida i Tarragona són seu de dos ens, i per això el codi va al kind.
 *   · Per a cada àrea bàsica que és un municipi, al municipi mateix, kind
 *     `serveisSocialsBasics` → `ServeisSocialsDesats`.
 *
 * Ritme: una crida cada dos segons; les agregacions del registre de contractes
 * (3,6 milions de files) triguen uns 40 segons cadascuna.
 */

const BASE = "https://analisi.transparenciacatalunya.cat/resource";

export const SSB_PERSONES = "fvnd-jbxf";
export const SSB_SAD = "qvkp-qkzs";
export const REGISTRE_CONTRACTES = "hb6v-jcbf";

export const PREFIX_KIND_SERVEIS_ENS = "serveisEns:";
export const KIND_SERVEIS_SOCIALS_BASICS = "serveisSocialsBasics";

/** Els anys que publiquen els conjunts de serveis socials (comprovat el 27-10-2026). */
export const PRIMER_ANY_SSB = 2018;

/** Des de quin any es miren els contractes: abans el registre en té molt pocs. */
export const PRIMER_ANY_CONTRACTES = 2021;

const LLICENCIA_GENCAT =
  "Condicions d'ús del portal de Dades Obertes de Catalunya: reutilització amb atribució i sense alterar el sentit";

export const FONT_SSB_PERSONES = {
  nom: "Persones ateses pels serveis socials bàsics, Departament de Drets Socials i Inclusió",
  url: `https://analisi.transparenciacatalunya.cat/d/${SSB_PERSONES}`,
  llicencia: LLICENCIA_GENCAT,
} as const;

export const FONT_SSB_SAD = {
  nom: "Servei d'ajuda a domicili (SAD), Departament de Drets Socials i Inclusió",
  url: `https://analisi.transparenciacatalunya.cat/d/${SSB_SAD}`,
  llicencia: LLICENCIA_GENCAT,
} as const;

export const FONT_CONTRACTES = {
  nom: "Registre públic de contractes, Departament d'Economia i Finances",
  url: `https://analisi.transparenciacatalunya.cat/d/${REGISTRE_CONTRACTES}`,
  llicencia: LLICENCIA_GENCAT,
} as const;

/** On es pot mirar cada contracte, amb l'adjudicatari: la pàgina hi enllaça en comptes de fer llistes d'empreses. */
export const DETALL_CONTRACTES = "https://contractaciopublica.cat/";

// ─────────────────────────────────────────────────────────────────────────────
// El que es desa
// ─────────────────────────────────────────────────────────────────────────────

/** Una font tal com la cita la pàgina, amb la data de consulta (`AAAA-MM-DD`). */
export type FontServeis = { nom: string; url: string; llicencia: string | null; consultat: string | null };

/** Persones i hores d'una modalitat del servei d'ajuda a domicili; `null` vol dir no informat. */
export type ModalitatSad = { persones: number | null; hores: number | null };

/** Qui dona la dada d'una àrea bàsica quan no és l'ens de la fitxa: un consorci, sobretot. */
export type GestorAbss = { codiEns: string; nom: string };

/**
 * Un any d'una àrea bàsica de serveis socials. Tots els anys de la sèrie hi
 * són, tant si la font en té fila com si no: un any sense fila té tot a `null`.
 */
export type AnyAbss = {
  any: number;
  /** Persones ateses pels serveis socials bàsics aquell any (cada persona, un cop). */
  persones: number | null;
  sadSocial: ModalitatSad;
  sadDependencia: ModalitatSad;
  /** Qui dona la dada, si no és l'ens mateix; `null` quan és l'ens (o quan no hi ha dada). */
  gestor: GestorAbss | null;
  /** Cert si la font hi escriu zero persones en tots els sexes, i per això s'ha desat `null`. */
  zeroLlegitComBuit: boolean;
  /**
   * Cert si la fila de persones d'aquest any portava el codi d'una altra
   * comarca i s'ha lligat pel nom (el 2022). La lectura pel nom és la bona
   * (vegeu la capçalera), però algunes d'aquestes xifres surten molt lluny de
   * les dels anys veïns, i la pàgina ho ha de poder dir.
   */
  codiNoQuadra: boolean;
};

/**
 * Les xifres d'una àrea bàsica, la sèrie sencera. Es desa tal qual al municipi
 * (kind `serveisSocialsBasics`) i dins `ServeisEnsDesats.serveisSocials` per
 * als consells.
 */
export type ServeisSocialsDesats = {
  /** El codi d'ens de 10 xifres de l'àrea: el del municipi o el del consell. */
  codiEns: string;
  nom: string;
  /** De l'antic al recent, un per any des del 2018. */
  anys: AnyAbss[];
  fonts: FontServeis[];
};

/** Una altra àrea bàsica dins la comarca d'un consell que no és del consell (la Mancomunitat La Plana). */
export type AltraArea = { codiEns: string; nom: string; any: number; persones: number | null };

/** Els procediments, agrupats perquè es puguin llegir: la font en té una quinzena de variants. */
export type ProcedimentContracte = "obert" | "menor" | "negociat" | "acordMarc" | "altres";

export const PROCEDIMENTS: readonly ProcedimentContracte[] = ["obert", "menor", "negociat", "acordMarc", "altres"];

/** Una partició d'un any de contractes: quants i quant. */
export type TrosContractes = { contractes: number; import: number };

/** Un any de contractes d'un ens. */
export type AnyContractesEns = {
  any: number;
  /** Fals per a l'any en curs: el registre s'omple amb retard i comparar-lo enganya. */
  complet: boolean;
  /** Contractes nous inscrits (adjudicacions i menors; un lot compta com un contracte). */
  contractes: number;
  /** Suma de l'import d'adjudicació; `null` si cap fila de l'any no en porta. */
  import: number | null;
  /** Contractes de l'any que no porten import: no sumen, però hi són. */
  senseImport: number;
  /** Sempre els cinc procediments, en l'ordre de `PROCEDIMENTS`, encara que siguin zero. */
  perProcediment: ({ procediment: ProcedimentContracte } & TrosContractes)[];
  /** Per tipus de contracte, tal com l'escriu la font, de més a menys import. */
  perTipus: ({ tipus: string } & TrosContractes)[];
  /** Els textos de procediment que han caigut a «altres», perquè es puguin revisar. */
  procedimentsAltres: string[];
};

export type ContractacioEnsDesada = {
  /** De l'antic al recent, des del 2021; només els anys amb algun contracte inscrit. */
  anys: AnyContractesEns[];
  font: FontServeis;
  /** On es pot consultar cada contracte. */
  detall: string;
};

export type TipusEnsServeis = "diputacio" | "consell";

/**
 * El que es desa per a cada ens, al municipi seu, amb el kind
 * `serveisEns:<codiEns>`. Les diputacions no tenen àrea bàsica: el seu
 * `serveisSocials` és sempre `null`.
 */
export type ServeisEnsDesats = {
  codiEns: string;
  ens: string;
  tipus: TipusEnsServeis;
  /** L'àrea bàsica comarcal (només consells); `null` si la font no en té cap fila. */
  serveisSocials: ServeisSocialsDesats | null;
  /** Les altres àrees bàsiques no municipals de la comarca, que no són del consell. */
  altresArees: AltraArea[];
  /** `null` si el registre no té cap contracte de l'ens des del 2021. */
  contractacio: ContractacioEnsDesada | null;
  consultat: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Serveis socials: llegir una fila
// ─────────────────────────────────────────────────────────────────────────────

/** Una fila de `fvnd-jbxf` o de `qvkp-qkzs` tal com la torna el Socrata: tot text, i els buits absents. */
export type FilaSsb = { codi_idescat_eacat?: string; nom_ens_local?: string; any?: string; [camp: string]: string | undefined };

/** El codi d'ens de 10 xifres; la font en treu el zero del davant als municipis de Barcelona. */
export function codi10(codi: unknown): string {
  const text = String(codi ?? "").trim();
  return /^\d{1,10}$/.test(text) ? text.padStart(10, "0") : "";
}

/** Un número no negatiu del Socrata, que arriba com a text; `null` si no n'és cap. */
export function numero(text: string | number | null | undefined): number | null {
  if (text === null || text === undefined || String(text).trim() === "") return null;
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Les hores, arrodonides a l'hora: la font porta centèsimes que no diuen res a ningú. */
const hores = (n: number | null): number | null => (n === null ? null : Math.round(n));

/**
 * La suma dels camps informats d'una fila; `null` si no n'hi ha cap
 * d'informat. Els anys 2018-2021 no porten la columna de persones no
 * binàries, i un camp absent no és un zero: simplement no suma.
 */
export function sumaCamps(fila: FilaSsb, camps: readonly string[]): number | null {
  let suma: number | null = null;
  for (const c of camps) {
    const n = numero(fila[c]);
    if (n !== null) suma = (suma ?? 0) + n;
  }
  return suma;
}

const CAMPS_PERSONES = ["homes", "dones", "no_binaris"] as const;
const CAMPS_SAD_SOCIAL = ["atenci_social_homes", "atenci_social_dones", "atenci_social_no_binaris"] as const;
const CAMPS_SAD_SOCIAL_HORES = ["hores_d_atenci_social_homes", "hores_d_atenci_social_dones", "hores_d_atenci_social_no_binaris"] as const;
const CAMPS_SAD_DEP = ["atenci_a_la_depend_ncia_homes", "atenci_a_la_depend_ncia_dones", "atenci_a_la_depend_ncia_no_binaris"] as const;
/** Els noms de columna que el Socrata ha escapçat: `…_depend` són els homes i `…_depend_1` les dones. */
const CAMPS_SAD_DEP_HORES = ["hores_d_atenci_a_la_depend", "hores_d_atenci_a_la_depend_1", "hores_d_atenci_a_la_depend_ncia_no_binaris"] as const;

/**
 * Les persones ateses d'una fila de `fvnd-jbxf`. Si la font hi escriu zero a
 * tots els sexes, es torna `null` amb `zero` cert: vegeu la capçalera.
 */
export function personesDeLaFila(fila: FilaSsb): { persones: number | null; zero: boolean } {
  const persones = sumaCamps(fila, CAMPS_PERSONES);
  return persones === 0 ? { persones: null, zero: true } : { persones, zero: false };
}

/**
 * El SAD d'una fila de `qvkp-qkzs`. La mateixa regla del zero, però sobre la
 * fila sencera: si persones i hores de les dues modalitats són totes zero, la
 * fila és un no informat. Un zero en una sola modalitat (el Conselh Generau
 * d'Aran el 2022: catorze persones de SAD social i cap de dependència) és un
 * recompte i es respecta.
 */
export function sadDeLaFila(fila: FilaSsb): { sadSocial: ModalitatSad; sadDependencia: ModalitatSad; zero: boolean } {
  const sadSocial = { persones: sumaCamps(fila, CAMPS_SAD_SOCIAL), hores: hores(sumaCamps(fila, CAMPS_SAD_SOCIAL_HORES)) };
  const sadDependencia = { persones: sumaCamps(fila, CAMPS_SAD_DEP), hores: hores(sumaCamps(fila, CAMPS_SAD_DEP_HORES)) };
  const valors = [sadSocial.persones, sadSocial.hores, sadDependencia.persones, sadDependencia.hores];
  if (valors.some((v) => v !== null) && valors.every((v) => v === null || v === 0)) {
    const buit = { persones: null, hores: null };
    return { sadSocial: buit, sadDependencia: { ...buit }, zero: true };
  }
  return { sadSocial, sadDependencia, zero: false };
}

/** Un any sense cap dada: el que hi ha a la sèrie quan la font no en té fila. */
export function anyBuit(any: number): AnyAbss {
  return {
    any,
    persones: null,
    sadSocial: { persones: null, hores: null },
    sadDependencia: { persones: null, hores: null },
    gestor: null,
    zeroLlegitComBuit: false,
    codiNoQuadra: false,
  };
}

/** Els anys de la sèrie, del 2018 a l'últim que publica la font. */
export function anysSerie(darrer: number, primer = PRIMER_ANY_SSB): number[] {
  return darrer < primer ? [] : Array.from({ length: darrer - primer + 1 }, (_, i) => primer + i);
}

// ─────────────────────────────────────────────────────────────────────────────
// Serveis socials: de qui és cada fila
// ─────────────────────────────────────────────────────────────────────────────

/** El que cal saber del registre d'ens per decidir de qui és una àrea bàsica. */
export type CatalegAbss = {
  /** Els codis d'ens (10 xifres) dels municipis de la nostra base. */
  municipis: ReadonlySet<string>;
  /** Clau de comarca (`clauComarca`) → codi d'ens del seu consell. */
  consellPerClau: ReadonlyMap<string, string>;
  /** Els consorcis i mancomunitats del registre que surten a la font, amb la comarca del registre. */
  altresEns: ReadonlyMap<string, { nom: string; codiComarca: string | null }>;
};

export type AreaResolta =
  | { mena: "municipi"; codiEns: string }
  | { mena: "consell"; codiEns: string; gestor: GestorAbss | null; codiNoQuadra: boolean }
  | { mena: "altra"; codiEns: string; nom: string; consell: string | null }
  | { mena: "fora"; motiu: string };

/**
 * La clau d'una comarca a partir del nom que en dona la font: «Alt Camp»,
 * «Pla de l'Estany», «CAS Garrotxa», «CBS Ripollès». Es treuen les sigles dels
 * consorcis i es reaprofita la clau de la J39, que ja sap menjar-se articles i
 * preposicions; així «Pla de l'Estany» i «Consell Comarcal del Pla de
 * l'Estany» donen el mateix, `pla estany`.
 */
export function clauComarca(nom: string): string | null {
  const net = nom.replace(/ /g, " ").trim().replace(/^(CAS|CBS)\s+/i, "");
  if (!net) return null;
  const clau = clauEns(`Consell Comarcal ${net}`);
  return clau ? clau.slice("consell:".length) : null;
}

/**
 * De qui és una fila. Per ordre:
 *
 *   1. Si el codi és d'un municipi, és del municipi: als municipis el codi és fiable.
 *   2. Si el codi és de la sèrie comarcal (`81…`), és del consell **que diu el
 *      nom**, no el codi (el 2022 van desplaçats). Si nom i codi no coincideixen
 *      es marca `codiNoQuadra`. Si el nom no és de cap consell (l'Aran), fora.
 *   3. Si el codi és d'un consorci o mancomunitat del registre i el seu nom és el
 *      de la comarca on el registre el situa, és l'àrea comarcal gestionada per
 *      aquell ens: va al consell, amb el `gestor`. Si no (la Mancomunitat La
 *      Plana), és una altra àrea de la comarca.
 *   4. Qualsevol altra cosa, fora, amb el motiu.
 */
export function resolArea(fila: FilaSsb, cat: CatalegAbss): AreaResolta {
  const codi = codi10(fila.codi_idescat_eacat);
  const nom = (fila.nom_ens_local ?? "").replace(/ /g, " ").trim();
  if (!codi) return { mena: "fora", motiu: `fila sense codi (${nom || "sense nom"})` };
  if (cat.municipis.has(codi)) return { mena: "municipi", codiEns: codi };
  const clau = clauComarca(nom);
  const consell = clau ? cat.consellPerClau.get(clau) : undefined;
  if (codi.startsWith("81")) {
    if (!consell) return { mena: "fora", motiu: `${nom || codi}: no és l'àrea de cap consell comarcal` };
    return { mena: "consell", codiEns: consell, gestor: null, codiNoQuadra: consell !== codi };
  }
  const altre = cat.altresEns.get(codi);
  if (altre) {
    if (consell && (altre.codiComarca === null || altre.codiComarca === consell)) {
      return { mena: "consell", codiEns: consell, gestor: { codiEns: codi, nom: altre.nom }, codiNoQuadra: false };
    }
    return { mena: "altra", codiEns: codi, nom: altre.nom, consell: altre.codiComarca };
  }
  return { mena: "fora", motiu: `${nom || "sense nom"} (${codi}): codi que no és al registre d'ens` };
}

// ─────────────────────────────────────────────────────────────────────────────
// Serveis socials: plegar les files en sèries
// ─────────────────────────────────────────────────────────────────────────────

/** Les incidències del plegat, perquè la feina les anoti. */
export type IncidenciesAbss = {
  /** Files de codi comarcal on el nom diu una comarca i el codi una altra. */
  codiNoQuadra: { conjunt: string; any: number; codi: string; nom: string; consell: string }[];
  /** Dues files del mateix conjunt per a la mateixa àrea i any: es queda la primera. */
  repetides: { conjunt: string; any: number; area: string }[];
  /** Files que no són de cap municipi ni de cap consell. */
  fora: { conjunt: string; any: number; motiu: string }[];
};

export type PlegatAbss = {
  /** Per codi d'ens de l'àrea (municipi o consell): la sèrie, un any per posició de `anys`. */
  arees: Map<string, { mena: "municipi" | "consell"; nom: string; anys: AnyAbss[] }>;
  /** Per codi de consell: les altres àrees no municipals de la comarca. */
  altres: Map<string, AltraArea[]>;
  incidencies: IncidenciesAbss;
};

/**
 * Plega les files dels dos conjunts en una sèrie per àrea bàsica. `anys` mana:
 * una fila d'un any que no hi és s'ignora, i un any sense fila queda buit.
 *
 * El nom de l'àrea és el de la primera fila que la porta, i al consell el
 * reescriu la feina amb el del registre. Si el conjunt de persones i el del SAD
 * no diuen el mateix gestor el mateix any, mana el de persones, també quan diu
 * que és el consell mateix. Per això es llegeixen primer les persones.
 */
export function plegaAbss(
  anys: readonly number[],
  persones: readonly FilaSsb[],
  sad: readonly FilaSsb[],
  cat: CatalegAbss,
): PlegatAbss {
  const posicio = new Map(anys.map((a, i) => [a, i]));
  const arees: PlegatAbss["arees"] = new Map();
  const altresPerCodi = new Map<string, { consell: string | null; nom: string; perAny: Map<number, number | null> }>();
  const incidencies: IncidenciesAbss = { codiNoQuadra: [], repetides: [], fora: [] };
  const vistes = new Set<string>();
  const ambPersones = new Set<string>();

  const llegeix = (conjunt: string, files: readonly FilaSsb[], aplica: (a: AnyAbss, f: FilaSsb) => void): void => {
    for (const f of files) {
      const any = numero(f.any);
      const i = any === null ? undefined : posicio.get(any);
      if (any === null || i === undefined) continue;
      const area = resolArea(f, cat);
      if (area.mena === "fora") {
        incidencies.fora.push({ conjunt, any, motiu: area.motiu });
        continue;
      }
      if (area.mena === "altra") {
        const acc = altresPerCodi.get(area.codiEns) ?? { consell: area.consell, nom: area.nom, perAny: new Map() };
        if (conjunt === SSB_PERSONES) acc.perAny.set(any, personesDeLaFila(f).persones);
        altresPerCodi.set(area.codiEns, acc);
        continue;
      }
      const clau = `${conjunt}|${area.codiEns}|${any}`;
      if (vistes.has(clau)) {
        incidencies.repetides.push({ conjunt, any, area: area.codiEns });
        continue;
      }
      vistes.add(clau);
      if (area.mena === "consell" && area.codiNoQuadra) {
        incidencies.codiNoQuadra.push({ conjunt, any, codi: codi10(f.codi_idescat_eacat), nom: f.nom_ens_local ?? "", consell: area.codiEns });
      }
      let serie = arees.get(area.codiEns);
      if (!serie) {
        serie = { mena: area.mena, nom: (f.nom_ens_local ?? "").replace(/ /g, " ").trim(), anys: anys.map(anyBuit) };
        arees.set(area.codiEns, serie);
      }
      const a = serie.anys[i]!;
      // El gestor el diu la fila de persones; la del SAD només l'omple si aquell
      // any no hi ha fila de persones (Osona 2022: persones a nom del consell,
      // SAD a nom del consorci).
      const clauAny = `${area.codiEns}|${any}`;
      if (area.mena === "consell") {
        if (conjunt === SSB_PERSONES) {
          a.gestor = area.gestor;
          ambPersones.add(clauAny);
        } else if (!ambPersones.has(clauAny) && a.gestor === null) a.gestor = area.gestor;
      }
      if (area.mena === "consell" && area.codiNoQuadra && conjunt === SSB_PERSONES) a.codiNoQuadra = true;
      aplica(a, f);
    }
  };

  llegeix(SSB_PERSONES, persones, (a, f) => {
    const { persones: n, zero } = personesDeLaFila(f);
    a.persones = n;
    a.zeroLlegitComBuit = zero;
  });
  llegeix(SSB_SAD, sad, (a, f) => {
    const { sadSocial, sadDependencia } = sadDeLaFila(f);
    a.sadSocial = sadSocial;
    a.sadDependencia = sadDependencia;
  });

  const altres: PlegatAbss["altres"] = new Map();
  for (const [codiEns, acc] of altresPerCodi) {
    if (!acc.consell) continue;
    // L'últim any amb persones informades; si no n'hi ha cap, l'últim any amb fila.
    const ambDada = [...acc.perAny].filter(([, n]) => n !== null).sort((x, y) => y[0] - x[0]);
    const [any, n] = ambDada[0] ?? [...acc.perAny].sort((x, y) => y[0] - x[0])[0] ?? [anys[anys.length - 1]!, null];
    const llista = altres.get(acc.consell) ?? [];
    llista.push({ codiEns, nom: acc.nom, any, persones: n });
    altres.set(acc.consell, llista);
  }
  return { arees, altres, incidencies };
}

// ─────────────────────────────────────────────────────────────────────────────
// Contractes: classificar i plegar
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El grup d'un procediment. Els textos són els que el registre feia servir el
 * 27-10-2026 per als 44 ens:
 *
 *   · **obert**: «Obert» (i les variants simplificades, si n'apareixen). Qualsevol
 *     empresa s'hi pot presentar.
 *   · **menor**: «Menor», o la fila ve de la situació «menor». Per llei, sense
 *     concurrència obligatòria i amb un import màxim baix.
 *   · **negociat**: «Negociat sense publicitat», «Licitació amb negociació».
 *   · **acordMarc**: «Basat en acord marc», «Específic de sistema dinàmic de
 *     contractació». La competència es va fer abans, a l'acord marc o al
 *     sistema; aquí es tria entre les empreses que ja hi són.
 *   · **altres**: restringit, emergències, adjudicacions directes no menors,
 *     concurs de projectes, instruccions internes, i qualsevol text nou.
 */
export function grupProcediment(procediment: string | null | undefined, situacio?: string | null): ProcedimentContracte {
  const p = normalize(procediment ?? "");
  if (normalize(situacio ?? "") === "menor" || p === "menor") return "menor";
  if (p.startsWith("obert")) return "obert";
  if (/\bnegocia(t|cio)\b/.test(p)) return "negociat";
  if (/acord marc|sistema dinamic/.test(p)) return "acordMarc";
  return "altres";
}

/** Els tipus de contracte amb el nom escrit com cal: la font els numera, en majúscules i sovint sense accents. */
const NOMS_TIPUS: Readonly<Record<string, string>> = {
  obres: "Obres",
  subministraments: "Subministraments",
  serveis: "Serveis",
  "administratiu especial": "Administratiu especial",
  "concessio de serveis": "Concessió de serveis",
  "concessio d obres": "Concessió d'obres",
  "concessio d obres publiques": "Concessió d'obres públiques",
  "gestio de serveis publics": "Gestió de serveis públics",
  "privat d administracio publica": "Privat de l'Administració",
  "col laboracio entre el sector public i el sector privat": "Col·laboració publicoprivada",
};

/** «5. SERVEIS» → «Serveis»; un tipus desconegut queda en minúscules amb la primera lletra gran. */
export function nomTipus(tipus: string | null | undefined): string {
  const net = (tipus ?? "").replace(/^\s*\d+\s*[.)-]\s*/, "").replace(/\s+/g, " ").trim();
  if (!net) return "Sense tipus";
  const conegut = NOMS_TIPUS[normalize(net)];
  if (conegut) return conegut;
  const minuscules = net.toLocaleLowerCase("ca");
  return minuscules.charAt(0).toLocaleUpperCase("ca") + minuscules.slice(1);
}

/** Una suma del registre ja llegida: un ens, un any, un procediment i un tipus. */
export type FilaContractes = {
  ens: string;
  any: number;
  situacio: string | null;
  procediment: string | null;
  tipus: string | null;
  contractes: number;
  /** Suma dels imports informats; `null` si cap fila del grup no en porta. */
  import: number | null;
  /** Quantes files del grup porten import. */
  ambImport: number;
};

/** Un import en euros arrodonit al cèntim, per no arrossegar els decimals de la suma en coma flotant. */
const centims = (x: number): number => Math.round(x * 100) / 100;

/**
 * Plega les sumes d'un ens en anys: total, import, procediments (sempre els
 * cinc, en ordre) i tipus (de més a menys import, empat per nom). Un any sense
 * cap fila no hi surt: la sèrie del registre comença quan l'ens hi comença a
 * inscriure, i un any absent es diu a la pàgina com a «no hi consta».
 */
export function plegaContractes(files: readonly FilaContractes[], anyEnCurs: number): AnyContractesEns[] {
  const perAny = new Map<number, FilaContractes[]>();
  for (const f of files) perAny.set(f.any, [...(perAny.get(f.any) ?? []), f]);
  return [...perAny.keys()]
    .sort((a, b) => a - b)
    .map((any) => {
      const grup = perAny.get(any)!;
      const procediments = new Map(PROCEDIMENTS.map((p) => [p, { contractes: 0, import: 0 }]));
      const tipus = new Map<string, TrosContractes>();
      const altres = new Set<string>();
      let contractes = 0;
      let suma = 0;
      let ambImport = 0;
      for (const f of grup) {
        const g = grupProcediment(f.procediment, f.situacio);
        if (g === "altres" && f.procediment) altres.add(f.procediment.trim());
        const imp = f.import ?? 0;
        const p = procediments.get(g)!;
        p.contractes += f.contractes;
        p.import += imp;
        const nom = nomTipus(f.tipus);
        const t = tipus.get(nom) ?? { contractes: 0, import: 0 };
        t.contractes += f.contractes;
        t.import += imp;
        tipus.set(nom, t);
        contractes += f.contractes;
        suma += imp;
        ambImport += f.ambImport;
      }
      return {
        any,
        complet: any < anyEnCurs,
        contractes,
        import: ambImport > 0 ? centims(suma) : null,
        senseImport: Math.max(0, contractes - ambImport),
        perProcediment: PROCEDIMENTS.map((procediment) => {
          const p = procediments.get(procediment)!;
          return { procediment, contractes: p.contractes, import: centims(p.import) };
        }),
        perTipus: [...tipus]
          .map(([nom, t]) => ({ tipus: nom, contractes: t.contractes, import: centims(t.import) }))
          .sort((a, b) => b.import - a.import || a.tipus.localeCompare(b.tipus, "ca")),
        procedimentsAltres: [...altres].sort((a, b) => a.localeCompare(b, "ca")),
      };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Les consultes al Socrata
// ─────────────────────────────────────────────────────────────────────────────

/** Una consulta agregada, com les de la J39. */
export type ConsultaAgregada = { select: string; where: string; group: string; order: string };

const PAGINA = 5_000;

/** La pausa abans de cada crida: el portal torna 429 si se l'apreta. */
const PAUSA_MS = 2_000;

/** Les agregacions sobre el registre de contractes triguen uns 40 s (comprovat el 27-10-2026). */
const TEMPS_MAXIM_MS = 300_000;

export function urlConsulta(dataset: string, c: ConsultaAgregada, limit: number, offset: number): string {
  const url = new URL(`${BASE}/${dataset}.json`);
  url.searchParams.set("$select", c.select);
  url.searchParams.set("$where", c.where);
  url.searchParams.set("$group", c.group);
  // Amb $group, l'ordre ha de ser de columnes agrupades; sense ordre estable
  // la paginació pot repetir o saltar files.
  url.searchParams.set("$order", c.order);
  url.searchParams.set("$limit", String(limit));
  url.searchParams.set("$offset", String(offset));
  return url.toString();
}

async function agregat<T>(dataset: string, c: ConsultaAgregada): Promise<T[]> {
  const files: T[] = [];
  for (let offset = 0; ; offset += PAGINA) {
    await sleep(PAUSA_MS);
    const pagina = await fetchJson<T[]>(urlConsulta(dataset, c, PAGINA, offset), { timeoutMs: TEMPS_MAXIM_MS });
    files.push(...pagina);
    if (pagina.length < PAGINA) return files;
  }
}

/**
 * Els contractes nous dels ens demanats, sumats per ens, any, situació,
 * procediment i tipus. **No es demana la columna `adjudicatari`**: aquesta
 * feina no ha de poder fer cap llista d'empreses ni per error. Els lots
 * deserts (`lot_desert = 'Si'`) no són cap contracte i es deixen fora.
 */
export function consultaContractes(codis: readonly string[], primer: number, darrer: number): ConsultaAgregada {
  const llista = codis.map((c) => `'${c.replace(/\D/g, "")}'`).join(",");
  return {
    select:
      "id_organisme_contractant as ens, exercici as any, situaci_contractual as situacio, " +
      "procediment_adjudicacio as procediment, tipus_contracte as tipus, " +
      "count(*) as contractes, sum(import_adjudicacio) as import, count(import_adjudicacio) as amb_import",
    where:
      `id_organisme_contractant in (${llista}) AND situaci_contractual in ('adjudicació','menor') ` +
      `AND exercici >= ${primer} AND exercici <= ${darrer} AND (lot_desert IS NULL OR lot_desert != 'Si')`,
    group: "ens, any, situacio, procediment, tipus",
    order: "ens, any, situacio, procediment, tipus",
  };
}

/** Una suma del registre tal com la torna el Socrata: tot text, i els buits absents. */
export type FilaContractesSocrata = {
  ens?: string;
  any?: string;
  situacio?: string;
  procediment?: string;
  tipus?: string;
  contractes?: string;
  import?: string;
  amb_import?: string;
};

/** Llegeix una suma del registre; `null` si no porta ens, any o recompte. */
export function llegeixFilaContractes(f: FilaContractesSocrata): FilaContractes | null {
  const ens = codi10(f.ens);
  const any = numero(f.any);
  const contractes = numero(f.contractes);
  if (!ens || any === null || contractes === null) return null;
  const ambImport = numero(f.amb_import) ?? 0;
  return {
    ens,
    any,
    situacio: f.situacio ?? null,
    procediment: f.procediment ?? null,
    tipus: f.tipus ?? null,
    contractes,
    import: ambImport > 0 ? numero(f.import) : null,
    ambImport,
  };
}

type FilaRegistreAbss = { codi_ens?: string; nom_complert?: string; codcomarca?: string; nomtipus?: string };

/** Els consorcis i mancomunitats del registre que surten com a àrea bàsica, amb la seva comarca. */
async function socrataAltresEns(codis: readonly string[]): Promise<FilaRegistreAbss[]> {
  if (codis.length === 0) return [];
  return socrataAll<FilaRegistreAbss>(DATASETS.ensLocals, {
    select: "codi_ens,nom_complert,codcomarca,nomtipus",
    where: `codi_ens in (${codis.map((c) => `'${c}'`).join(",")})`,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// La feina
// ─────────────────────────────────────────────────────────────────────────────

const fontAmb = (f: { nom: string; url: string; llicencia: string }, consultat: string): FontServeis => ({ ...f, consultat });

export async function j42ServeisEns(db: Db): Promise<unknown> {
  let resum: Record<string, unknown> = {};
  await withRun(db, "J42 serveis socials bàsics i contractació de diputacions i consells", async (run) => {
    const avui = new Date();
    const consultat = avui.toISOString().slice(0, 10);
    const anyEnCurs = avui.getUTCFullYear();

    const perCodiEns = new Map<string, { id: number; name: string }>();
    for (const m of await db.select().from(municipalities)) perCodiEns.set(codi10(m.codiEns), { id: m.id, name: m.name });

    // ── Els 44 ens, del registre, amb la mateixa regla que la J39 ────────────
    const registre = llegeixRegistre(
      await socrataAll<FilaRegistre>(DATASETS.ensLocals, {
        select: "codi_ens,nomtipus,nom_complert,cif,codi_municipi,dissolt",
        where: "nomtipus in ('Comarques','Províncies')",
      }),
    ).ens;
    if (registre.length !== 44) {
      await run.issue({ kind: "serveis_ens_registre_inesperat", severity: "alta", detail: { ens: registre.length, esperats: 44 } });
    }
    const consellPerClau = new Map<string, string>();
    for (const e of registre) {
      const clau = e.tipus === "consell" ? clauEns(e.nom) : null;
      if (clau) consellPerClau.set(clau.slice("consell:".length), e.codiEns);
    }

    // ── Serveis socials bàsics ────────────────────────────────────────────────
    await sleep(PAUSA_MS);
    const persones = await socrataAll<FilaSsb>(SSB_PERSONES);
    await sleep(PAUSA_MS);
    const sad = await socrataAll<FilaSsb>(SSB_SAD);
    const darrerSsb = Math.max(...[...persones, ...sad].map((f) => numero(f.any) ?? 0));
    const anys = anysSerie(darrerSsb);
    run.rowsIn += persones.length + sad.length;

    // Els codis que no són ni de municipi ni de la sèrie comarcal: consorcis i mancomunitats.
    const codisAltres = [...new Set([...persones, ...sad].map((f) => codi10(f.codi_idescat_eacat)))]
      .filter((c) => c && !perCodiEns.has(c) && !c.startsWith("81"));
    await sleep(PAUSA_MS);
    const altresEns = new Map(
      (await socrataAltresEns(codisAltres)).map((f) => [
        codi10(f.codi_ens),
        { nom: (f.nom_complert ?? "").trim(), codiComarca: f.codcomarca ? codi10(f.codcomarca) : null },
      ]),
    );
    const plegat = plegaAbss(anys, persones, sad, { municipis: new Set(perCodiEns.keys()), consellPerClau, altresEns });
    await anotaIncidenciesAbss(run, plegat.incidencies);

    const fontsSsb = [fontAmb(FONT_SSB_PERSONES, consultat), fontAmb(FONT_SSB_SAD, consultat)];
    let municipisDesats = 0;
    for (const [codiEns, area] of plegat.arees) {
      if (area.mena !== "municipi") continue;
      const m = perCodiEns.get(codiEns)!;
      const dades: ServeisSocialsDesats = { codiEns, nom: m.name, anys: area.anys, fonts: fontsSsb };
      await desa(db, m.id, KIND_SERVEIS_SOCIALS_BASICS, dades);
      municipisDesats += 1;
    }
    run.rowsOut += municipisDesats;
    run.say(`Serveis socials ${anys[0]}-${darrerSsb}: ${municipisDesats} àrees bàsiques municipals desades`);

    // ── Contractes ────────────────────────────────────────────────────────────
    const filesContractes = (
      await agregat<FilaContractesSocrata>(
        REGISTRE_CONTRACTES,
        consultaContractes(registre.map((e) => e.codiEns), PRIMER_ANY_CONTRACTES, anyEnCurs),
      )
    )
      .map(llegeixFilaContractes)
      .filter((f): f is FilaContractes => f !== null);
    run.rowsIn += filesContractes.length;
    run.say(`Registre de contractes: ${filesContractes.length} sumes per ens, any, procediment i tipus (${PRIMER_ANY_CONTRACTES}-${anyEnCurs})`);

    // ── Una fila per ens, a la seu ───────────────────────────────────────────
    const ambSsb: string[] = [];
    const senseSsb: string[] = [];
    const ambContractes: string[] = [];
    const senseContractes: string[] = [];
    for (const ens of registre) {
      const seu = ens.seuCodiEns ? perCodiEns.get(ens.seuCodiEns) : undefined;
      if (!seu) {
        await run.issue({ kind: "serveis_ens_sense_seu", severity: "alta", entity: ens.nom, detail: { seu: ens.seuCodiEns } });
        continue;
      }
      const area = ens.tipus === "consell" ? plegat.arees.get(ens.codiEns) : undefined;
      const serveisSocials: ServeisSocialsDesats | null = area
        ? { codiEns: ens.codiEns, nom: ens.nom, anys: area.anys, fonts: fontsSsb }
        : null;
      if (ens.tipus === "consell") (serveisSocials?.anys.some((a) => a.persones !== null) ? ambSsb : senseSsb).push(ens.nom);
      const anysContractes = plegaContractes(filesContractes.filter((f) => f.ens === ens.codiEns), anyEnCurs);
      (anysContractes.length > 0 ? ambContractes : senseContractes).push(ens.nom);
      const dades: ServeisEnsDesats = {
        codiEns: ens.codiEns,
        ens: ens.nom,
        tipus: ens.tipus,
        serveisSocials,
        altresArees: plegat.altres.get(ens.codiEns) ?? [],
        contractacio:
          anysContractes.length > 0
            ? { anys: anysContractes, font: fontAmb(FONT_CONTRACTES, consultat), detall: DETALL_CONTRACTES }
            : null,
        consultat,
      };
      await desa(db, seu.id, `${PREFIX_KIND_SERVEIS_ENS}${ens.codiEns}`, dades);
      run.rowsOut += 1;
    }

    const consells = registre.filter((e) => e.tipus === "consell").length;
    run.say(`${ambSsb.length}/${consells} consells amb persones ateses a l'àrea bàsica comarcal`);
    if (senseSsb.length > 0) run.say(`Sense dades de serveis socials: ${senseSsb.join(", ")}`);
    run.say(`${ambContractes.length}/${registre.length} ens amb contractes inscrits des del ${PRIMER_ANY_CONTRACTES}`);
    if (senseContractes.length > 0) run.say(`Sense cap contracte inscrit: ${senseContractes.join(", ")}`);

    resum = {
      anysSsb: anys,
      municipisAbss: municipisDesats,
      consellsAmbSsb: ambSsb.length,
      senseSsb,
      ensAmbContractes: ambContractes.length,
      senseContractes,
      codisQueNoQuadren: plegat.incidencies.codiNoQuadra.length,
      consultat,
    };
    return resum;
  });
  return resum;
}

/** Anota el que el plegat ha trobat estrany: una incidència per mena, amb el detall. */
async function anotaIncidenciesAbss(run: Run, inc: IncidenciesAbss): Promise<void> {
  if (inc.codiNoQuadra.length > 0) {
    await run.issue({
      kind: "serveis_socials_codi_no_quadra",
      severity: "baixa",
      detail: { files: inc.codiNoQuadra, regla: "es lliga pel nom de la comarca, no pel codi" },
    });
    run.say(`${inc.codiNoQuadra.length} files de codi comarcal amb el nom d'una altra comarca: lligades pel nom`);
  }
  if (inc.repetides.length > 0) {
    await run.issue({ kind: "serveis_socials_repetides", severity: "mitjana", detail: { files: inc.repetides } });
  }
  if (inc.fora.length > 0) {
    const motius = [...new Set(inc.fora.map((f) => f.motiu))];
    run.say(`Fora de cap fitxa: ${motius.join(" · ")}`);
  }
}

async function desa(db: Db, municipalityId: number, kind: string, data: unknown): Promise<void> {
  await db
    .insert(municipalityMetrics)
    .values({ municipalityId, kind, data })
    .onConflictDoUpdate({
      target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
      set: { data, computedAt: new Date() },
    });
}
