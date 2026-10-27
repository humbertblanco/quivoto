import { municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { DATASETS, socrataAll } from "../adapters/socrata";
import { fetchJson, sleep } from "../lib/http";
import { normalize } from "../lib/text";
import { withRun } from "../lib/run";

/**
 * J39 — els diners que cada diputació i cada consell comarcal donen als
 * ajuntaments del seu territori, any per any, segons el RAISC.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA PREGUNTA I LA FONT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * La fitxa d'un ens supramunicipal explica qui hi seu i quant gasta. El que un
 * veí vol saber, però, és més concret: «quant li ha donat la diputació al meu
 * ajuntament?». La resposta pública és el Registre de subvencions i ajuts de
 * Catalunya (RAISC, `s9xt-n979`), on cada administració catalana anota les
 * concessions que fa: qui la dona (`entitat_oo_aa_o_departament_1`), a qui
 * (`cif_beneficiari`), quant (`import_subvenci_pr_stec_ajut`), quan
 * (`data_concessi`) i per quina convocatòria (`t_tol_convocat_ria_catal`).
 * `administraci_codi` 002 són les diputacions i 003 els consells comarcals.
 *
 * El conjunt té més de 23 milions de files. **No se'n baixa mai cap fila
 * crua**: totes les consultes són agregades al servidor
 * (`$select=…,sum(…),count(*)&$group=…`), paginades i amb una pausa entre
 * crides, perquè el portal torna 429 si se l'apreta i les agregacions grosses
 * triguen més d'un minut a respondre.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUI ÉS L'ENS: EL NOM DEL CONCEDENT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * El RAISC no porta el CIF del concedent, només el nom i un codi propi
 * (`DPBCN`, `CC007`…). Es lliga amb el registre d'ens locals (`6nei-4b44`)
 * pel nom, reduït a una clau: «Consell Comarcal de l'Alt Camp» i «CONSELL
 * COMARCAL ALT CAMP» són tots dos `consell:alt camp`. Vegeu `clauEns()`.
 *
 * **Només compta l'ens mateix, no els seus organismes.** Cada diputació té
 * organismes autònoms, patronats, fundacions i consorcis adscrits que també
 * concedeixen ajuts i que el RAISC posa a la mateixa administració, amb
 * l'ens com a «departament o entitat d'adscripció». Els que hi havia el
 * 27-10-2026 (2023-2025, amb concessions a ajuntaments o sense):
 *
 *   · Diputació de Barcelona: Institut del Teatre; consorcis de les Drassanes
 *     Reials i Museu Marítim, de l'Espai Natural de les Guilleries-Savassona,
 *     del Parc Agrari del Baix Llobregat i del Parc de la Serralada de Marina.
 *   · Diputació de Girona: Dipsalut (Organisme Autònom de Salut Pública), que
 *     dona 2,6-3,9 M€ l'any a més de 200 ajuntaments; SEMEGA; Conservatori
 *     Isaac Albéniz.
 *   · Diputació de Lleida: Institut d'Estudis Ilerdencs (3,5-4,5 M€ l'any a
 *     uns 230 ajuntaments); Patronat de Promoció Econòmica; Patronat de
 *     Turisme Terres de Lleida.
 *   · Diputació de Tarragona: Patronat de Turisme.
 *   · Consells: Consorci de Benestar Social Gironès-Salt (Gironès), Consorci
 *     d'Osona de Serveis Socials (Osona), Consorci per a la Promoció dels
 *     Municipis del Moianès (Moianès).
 *
 * Fora, per tres raons: un organisme té pressupost, òrgans i sovint una
 * finalitat pròpia (sumar Dipsalut a la Diputació de Girona barreja salut
 * pública amb cooperació local sense dir-ho); un consorci el comparteixen
 * diverses administracions i els seus diners no són només de l'ens; i la regla
 * de la casa és que no se sumen pagadors diferents. Els noms dels que s'han
 * deixat fora es desen a `agenciesExcloses`, perquè la pàgina ho pugui dir.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUI ÉS L'AJUNTAMENT: EL CIF
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * El beneficiari es lliga pel CIF amb els 947 ajuntaments del registre d'ens
 * locals (`6nei-4b44`, `nomtipus = Municipis`), i d'allà, pel codi d'ens de 10
 * xifres, amb `municipalities.codiEns`. Només ajuntaments: els ajuts als
 * consells comarcals, a les EMD, als consorcis, a entitats o a persones no hi
 * són. Un CIF d'ajuntament és `P` + província (08/17/25/43) + municipi (3) +
 * `00` + control, i aquest patró es fa servir al servidor per retallar la
 * consulta abans que el creuament exacte, que es fa aquí.
 *
 * Només es compten els ajuntaments **del territori de l'ens** (la província de
 * la diputació, la comarca del consell, segons `codiprov` i `codcomarca` del
 * registre). Les poques concessions fora del territori (la Diputació de
 * Barcelona a Viladrau, que és d'Osona però de la província de Girona; el
 * Consell d'Osona a un municipi del Lluçanès) queden com a incidència i no a
 * la fitxa.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ELS ANYS, I PER QUÈ UN BUIT NO ÉS UN ZERO
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * L'any és el de la **data de concessió**, no el de la convocatòria: la
 * Diputació de Barcelona concedeix el 2025 part de la «Convocatòria
 * instrumental 2024». Es guarden els tres últims anys complets (avui
 * 2023-2025); l'any en curs no, perquè el RAISC s'omple amb mesos de retard i
 * un any a mitges sembla una retallada que no és.
 *
 * `perAjuntament` porta **tots** els municipis del territori, i cada any és
 * l'import concedit o `null`. `null` vol dir «no consta cap concessió
 * registrada al RAISC», no «zero euros»: l'absència al registre pot ser que no
 * n'hi hagués, que l'ens no l'hagi registrada, o que l'hagi registrada sense
 * beneficiari publicable. Mai no s'escriu un 0 per una absència.
 *
 * Els avisos que la pàgina ha de dir, perquè la font és desigual:
 *
 *   · **Dotze consells no hi registren res** entre el 2023 i el 2025 (32 dels
 *     44 ens sí): Alta Ribagorça, Baix Camp, Conca de Barberà, Garrotxa,
 *     Montsià, Noguera, Pallars Jussà, Pallars Sobirà, Pla d'Urgell, Segarra,
 *     Terra Alta i Urgell. `concessionsEns` a zero ho distingeix de «registra,
 *     però no a ajuntaments».
 *   · **La Diputació de Tarragona registra gairebé tot sense beneficiari**
 *     («Benef. no publicable», p. ex. el Pla ImpulsDipta 2024-2027): el 2024,
 *     181 M€ en 6.460 concessions sense nom i 0,5 M€ amb nom; només 16
 *     ajuntaments hi surten. `noPublicable` en dona l'import.
 *   · Els consells donen sobretot ajuts a persones (beques, menjador), i als
 *     ajuntaments en registren poc.
 *   · Els títols de les convocatòries el RAISC els desa sense accents.
 */

/** El conjunt de concessions del RAISC al portal de la Generalitat. */
export const RAISC = "s9xt-n979";

const BASE = "https://analisi.transparenciacatalunya.cat/resource";

export const PREFIX_KIND_SUBVENCIONS = "subvencionsEns:";

/** Quantes convocatòries es guarden per ens, les que més reparteixen l'últim any complet. */
export const MAX_CONVOCATORIES = 8;

/** El text amb què el RAISC amaga el beneficiari quan no el pot publicar. */
export const BENEFICIARI_NO_PUBLICABLE = "Benef. no publicable";

export const FONT_RAISC = {
  nom: "Concessions del RAISC (Registre de subvencions i ajuts de Catalunya), Generalitat de Catalunya",
  url: `https://analisi.transparenciacatalunya.cat/d/${RAISC}`,
  llicencia:
    "Condicions d'ús del portal de Dades Obertes de Catalunya: reutilització amb atribució i sense alterar el sentit",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// El que es desa
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El que la J39 desa per a cada ens, al municipi seu, amb el kind
 * `subvencionsEns:<codiEns>`. El carregador de les fitxes en fa
 * `SubvencionsEns` (de `publish/ens-tipus.ts`) posant-hi el slug, el nom i la
 * població de cada municipi.
 *
 * Els dos camps del final (`concessionsEns` i `noPublicable`) no eren al
 * contracte inicial, i per això són opcionals: el carregador els pot ignorar.
 * Els afegeix aquesta feina perquè, sense ells, la pàgina no pot distingir
 * «aquest ens no registra res al RAISC» de «registra, però no a ajuntaments»,
 * ni dir quants diners registra sense beneficiari.
 */
export type SubvencionsEnsDesades = {
  codiEns: string;
  ens: string;
  /** Els exercicis, de l'antic al recent: els tres últims anys complets. */
  anys: number[];
  /**
   * Tots els ajuntaments del territori. `imports` va alineat amb `anys`; `null`
   * vol dir «no consta cap concessió registrada al RAISC», mai zero euros.
   */
  perAjuntament: { municipalityId: number; imports: (number | null)[] }[];
  /** Les convocatòries que més han donat als ajuntaments l'últim any complet. */
  convocatories: { titol: string; import: number; concessions: number }[];
  /** Els organismes de l'ens que el RAISC hi adscriu i que aquí no es compten. */
  agenciesExcloses: string[];
  font: { nom: string; url: string; llicencia: string | null; consultat: string | null };
  /**
   * Concessions que l'ens mateix registra cada any, a qualsevol beneficiari
   * (alineat amb `anys`). Aquí un 0 és un recompte de veritat: el RAISC no té
   * cap fila d'aquest ens aquell any.
   */
  concessionsEns?: number[];
  /** Import i concessions que l'ens registra amb «Benef. no publicable», per any. */
  noPublicable?: { import: number; concessions: number }[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Funcions pures: noms, CIF, anys, plegat
// ─────────────────────────────────────────────────────────────────────────────

export type TipusEnsSubvencions = "diputacio" | "consell";

/**
 * Els articles i preposicions que es mengen a la clau. Es treuen a tot arreu,
 * no només al principi, perquè hi ha qui escriu «PLA ESTANY» i qui escriu «Pla
 * de l'Estany». Entre els 44 ens no hi ha cap parell que, sense articles,
 * quedi igual (Urgell, Alt Urgell i Pla d'Urgell continuen sent tres).
 */
const ARTICLES = new Set(["de", "del", "dels", "d", "la", "les", "l", "el", "els"]);

/**
 * La clau d'un ens a partir del nom, igual per al registre i per al RAISC:
 * «Consell Comarcal de l'Alt Camp» i «CONSELL COMARCAL ALT CAMP» donen
 * `consell:alt camp`; «Diputació de Barcelona», `diputacio:barcelona`. Un nom
 * que no és ni de consell comarcal ni de diputació (un patronat, el Conselh
 * Generau d'Aran) dona `null`.
 */
export function clauEns(nom: string): string | null {
  const net = normalize(nom);
  const consell = /^consell comarcal\b(.*)$/.exec(net);
  const diputacio = /^diputacio(?: provincial)?\b(.*)$/.exec(net);
  const [tipus, resta] = consell ? ["consell", consell[1]!] : diputacio ? ["diputacio", diputacio[1]!] : [null, ""];
  if (!tipus) return null;
  const paraules = resta.split(" ").filter((p) => p && !ARTICLES.has(p));
  return paraules.length > 0 ? `${tipus}:${paraules.join(" ")}` : null;
}

/**
 * Un CIF net: majúscules, sense espais, punts, guions ni barres. Si no té la
 * forma d'un NIF de persona jurídica (lletra, set xifres, control) torna
 * `null`; així «Benef. no publicable» o «Persona física» no lliguen amb res.
 */
export function normalitzaCif(text: string | null | undefined): string | null {
  if (!text) return null;
  const net = text.toUpperCase().replace(/[\s.\-/]/g, "");
  return /^[A-Z]\d{7}[A-Z0-9]$/.test(net) ? net : null;
}

/** Els tres últims anys complets respecte d'una data: el 27-10-2026 són 2023, 2024 i 2025. */
export function anysComplets(avui: Date, quants = 3): number[] {
  const darrer = avui.getUTCFullYear() - 1;
  return Array.from({ length: quants }, (_, i) => darrer - quants + 1 + i);
}

/** Un import en euros arrodonit al cèntim, per no arrossegar els decimals de la suma en coma flotant. */
const centims = (x: number): number => Math.round(x * 100) / 100;

/** Un número del Socrata, que arriba com a text; `null` si no ho és. */
export function numero(text: string | number | null | undefined): number | null {
  if (text === null || text === undefined || text === "") return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/** Un ens del registre (`6nei-4b44`), reduït al que cal aquí. */
export type EnsRegistre = {
  codiEns: string;
  nom: string;
  tipus: TipusEnsSubvencions;
  /** El codi d'ens del municipi seu (`codi_municipi`), 10 xifres. */
  seuCodiEns: string | null;
};

/** Un ajuntament del registre, amb el que el situa dins una província i una comarca. */
export type AjuntamentRegistre = {
  codiEns: string;
  cif: string;
  /** El codi d'ens de la província (`codiprov`), que és el de la seva diputació. */
  codiProvincia: string | null;
  /** El codi d'ens de la comarca (`codcomarca`), que és el del seu consell. */
  codiComarca: string | null;
};

/** Cert si l'ajuntament és del territori de l'ens: la seva província o la seva comarca. */
export function esDelTerritori(ens: Pick<EnsRegistre, "codiEns" | "tipus">, a: AjuntamentRegistre): boolean {
  return ens.tipus === "diputacio" ? a.codiProvincia === ens.codiEns : a.codiComarca === ens.codiEns;
}

export type Concedent = { ens: EnsRegistre; agencia: boolean };

/**
 * A qui pertany una fila del RAISC. Si el concedent és un ens del registre, és
 * l'ens mateix. Si no ho és però l'entitat d'adscripció sí, és un organisme
 * seu (que no es compta, però s'anota). Si no és ni una cosa ni l'altra, no és
 * de cap dels 44.
 */
export function classificaConcedent(
  concedent: string | null | undefined,
  adscripcio: string | null | undefined,
  perClau: ReadonlyMap<string, EnsRegistre>,
): Concedent | null {
  const propi = concedent ? clauEns(concedent) : null;
  if (propi && perClau.has(propi)) return { ens: perClau.get(propi)!, agencia: false };
  const pare = adscripcio ? clauEns(adscripcio) : null;
  if (pare && perClau.has(pare)) return { ens: perClau.get(pare)!, agencia: true };
  return null;
}

/** L'índex per clau del registre. Dos ens amb la mateixa clau seria un error de dades, i es diu. */
export function indexaEns(ens: readonly EnsRegistre[]): { perClau: Map<string, EnsRegistre>; repetides: string[] } {
  const perClau = new Map<string, EnsRegistre>();
  const repetides: string[] = [];
  for (const e of ens) {
    const clau = clauEns(e.nom);
    if (!clau) continue;
    if (perClau.has(clau)) repetides.push(clau);
    else perClau.set(clau, e);
  }
  return { perClau, repetides };
}

/** Una suma del RAISC ja atribuïda a un ajuntament: un CIF, un any, un import. */
export type ImportAnual = { cif: string; any: number; import: number };

/**
 * Plega les sumes del RAISC d'un ens en la forma desada: una fila per a cada
 * ajuntament del territori, amb un import per any o `null` si no n'hi consta
 * cap. Les sumes d'ajuntaments que no són del territori tornen a part, perquè
 * la feina les anoti com a incidència. Els anys que no són a `anys` s'ignoren.
 */
export function plegaPerAjuntament(
  anys: readonly number[],
  files: readonly ImportAnual[],
  territori: readonly { cif: string; municipalityId: number }[],
): { perAjuntament: SubvencionsEnsDesades["perAjuntament"]; foraDelTerritori: ImportAnual[] } {
  const posicio = new Map(anys.map((a, i) => [a, i]));
  const perCif = new Map<string, (number | null)[]>();
  for (const t of territori) perCif.set(t.cif, anys.map(() => null));
  const foraDelTerritori: ImportAnual[] = [];
  for (const f of files) {
    const i = posicio.get(f.any);
    if (i === undefined) continue;
    const imports = perCif.get(f.cif);
    if (!imports) {
      foraDelTerritori.push(f);
      continue;
    }
    imports[i] = centims((imports[i] ?? 0) + f.import);
  }
  const perAjuntament = territori
    .map((t) => ({ municipalityId: t.municipalityId, imports: perCif.get(t.cif)! }))
    .sort((a, b) => a.municipalityId - b.municipalityId);
  return { perAjuntament, foraDelTerritori };
}

/** Una suma per convocatòria i ajuntament, de l'últim any complet. */
export type FilaConvocatoria = { titol: string | null; import: number; concessions: number };

const SENSE_TITOL = "(convocatòria sense títol al RAISC)";

/**
 * Les `n` convocatòries que més han donat, plegades pel títol (amb els espais
 * col·lapsats, perquè el RAISC n'escriu alguns amb dobles espais). Empat
 * d'import: per ordre alfabètic, perquè la llista surti sempre igual.
 */
export function topConvocatories(files: readonly FilaConvocatoria[], n = MAX_CONVOCATORIES): SubvencionsEnsDesades["convocatories"] {
  const perTitol = new Map<string, { import: number; concessions: number }>();
  for (const f of files) {
    const titol = f.titol?.replace(/\s+/g, " ").trim() || SENSE_TITOL;
    const acc = perTitol.get(titol) ?? { import: 0, concessions: 0 };
    acc.import += f.import;
    acc.concessions += f.concessions;
    perTitol.set(titol, acc);
  }
  return [...perTitol]
    .map(([titol, v]) => ({ titol, import: centims(v.import), concessions: v.concessions }))
    .sort((a, b) => b.import - a.import || a.titol.localeCompare(b.titol, "ca"))
    .slice(0, n);
}

// ─────────────────────────────────────────────────────────────────────────────
// Les consultes al Socrata
// ─────────────────────────────────────────────────────────────────────────────

/** Una consulta agregada: tot el que es demana al RAISC passa per aquí. */
export type ConsultaAgregada = { select: string; where: string; group: string; order: string };

/** Les files per pàgina. Les agregacions en donen poques: la més grossa, unes 4.700 per als tres anys. */
const PAGINA = 5_000;

/**
 * La pausa abans de cada crida. El portal torna 429 si se l'apreta, i aquestes
 * consultes recorren centenars de milers de files cadascuna.
 */
const PAUSA_MS = 2_000;

/**
 * El temps màxim d'una crida. Una agregació sobre tres anys de diputacions i
 * consells triga d'1 a 3 minuts a respondre (comprovat el 27-10-2026), molt
 * més que els 60 s per defecte de `fetchJson`.
 */
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

async function agregat<T>(c: ConsultaAgregada): Promise<T[]> {
  const files: T[] = [];
  for (let offset = 0; ; offset += PAGINA) {
    const pagina = await fetchJson<T[]>(urlConsulta(RAISC, c, PAGINA, offset), { timeoutMs: TEMPS_MAXIM_MS });
    files.push(...pagina);
    if (pagina.length < PAGINA) return files;
    await sleep(PAUSA_MS);
  }
}

/** Diputacions (002) i consells comarcals (003), concedits dins els anys demanats. */
export function filtreAnys(anys: readonly number[]): string {
  const primer = Math.min(...anys);
  const darrer = Math.max(...anys);
  return (
    "administraci_codi in ('002','003') " +
    `AND data_concessi >= '${primer}-01-01T00:00:00' AND data_concessi < '${darrer + 1}-01-01T00:00:00'`
  );
}

/**
 * El patró del CIF d'un ajuntament (`P` + província + municipi + `00` +
 * control). Retalla la consulta al servidor; el creuament exacte amb els 947
 * CIF del registre es fa després, aquí.
 */
export const PATRO_AJUNTAMENT =
  "(" + ["08", "17", "25", "43"].map((p) => `cif_beneficiari like 'P${p}___00_'`).join(" OR ") + ")";

const CONCEDENT = "entitat_oo_aa_o_departament_1 as concedent, departament_o_entitat_local_d_adscripci_ as adscripcio";
const ANY = "date_extract_y(data_concessi) as any";
const SUMA = "sum(import_subvenci_pr_stec_ajut) as import, count(*) as concessions";

/** Q1. Import per concedent, ajuntament i any. */
export function consultaPerAjuntament(anys: readonly number[]): ConsultaAgregada {
  return {
    select: `${CONCEDENT}, cif_beneficiari as cif, ${ANY}, ${SUMA}`,
    where: `${filtreAnys(anys)} AND ${PATRO_AJUNTAMENT}`,
    group: "concedent, adscripcio, cif, any",
    order: "concedent, adscripcio, cif, any",
  };
}

/** Q2. Import per concedent, convocatòria i ajuntament, l'últim any complet. */
export function consultaConvocatories(any: number): ConsultaAgregada {
  return {
    select: `${CONCEDENT}, t_tol_convocat_ria_catal as titol, t_tol_convocat_ria_castell as titol_es, cif_beneficiari as cif, ${SUMA}`,
    where: `${filtreAnys([any])} AND ${PATRO_AJUNTAMENT}`,
    group: "concedent, adscripcio, titol, titol_es, cif",
    order: "concedent, adscripcio, titol, titol_es, cif",
  };
}

/** Q3. Totes les concessions per concedent i any, a qualsevol beneficiari (o Q4, només les amagades). */
export function consultaTotals(anys: readonly number[], nomesNoPublicables = false): ConsultaAgregada {
  const amagat = nomesNoPublicables ? ` AND cif_beneficiari = '${BENEFICIARI_NO_PUBLICABLE}'` : "";
  return {
    select: `${CONCEDENT}, ${ANY}, ${SUMA}`,
    where: `${filtreAnys(anys)}${amagat}`,
    group: "concedent, adscripcio, any",
    order: "concedent, adscripcio, any",
  };
}

/** Una fila agregada tal com la torna el Socrata: tot text, i els buits absents. */
export type FilaRaisc = {
  concedent?: string;
  adscripcio?: string;
  cif?: string;
  titol?: string;
  titol_es?: string;
  any?: string;
  import?: string;
  concessions?: string;
};

type FilaRegistre = {
  codi_ens?: string;
  nomtipus?: string;
  nom_complert?: string;
  cif?: string;
  codi_municipi?: string;
  codiprov?: string;
  codcomarca?: string;
  dissolt?: string;
};

const codi10 = (codi: unknown): string => String(codi ?? "").padStart(10, "0");

/**
 * Del registre d'ens locals, els 44 ens (les quatre diputacions i els consells
 * comarcals vius) i els 947 ajuntaments amb el seu CIF. De les «Comarques» del
 * registre només són consells les que es diuen «Consell Comarcal…»: la
 * Comarca del Barcelonès (consell dissolt el 2019), la del Lluçanès (sense
 * consell fins al 2027) i el Conselh Generau d'Aran (elecció directa) no ho són.
 */
export function llegeixRegistre(files: readonly FilaRegistre[]): { ens: EnsRegistre[]; ajuntaments: AjuntamentRegistre[] } {
  const ens: EnsRegistre[] = [];
  const ajuntaments: AjuntamentRegistre[] = [];
  for (const f of files) {
    if (f.dissolt === "S" || !f.codi_ens || !f.nom_complert) continue;
    const nom = f.nom_complert.trim();
    const seuCodiEns = f.codi_municipi ? codi10(f.codi_municipi) : null;
    if (f.nomtipus === "Províncies") ens.push({ codiEns: codi10(f.codi_ens), nom, tipus: "diputacio", seuCodiEns });
    else if (f.nomtipus === "Comarques" && clauEns(nom)?.startsWith("consell:"))
      ens.push({ codiEns: codi10(f.codi_ens), nom, tipus: "consell", seuCodiEns });
    else if (f.nomtipus === "Municipis") {
      const cif = normalitzaCif(f.cif);
      if (!cif) continue;
      ajuntaments.push({
        codiEns: codi10(f.codi_ens),
        cif,
        codiProvincia: f.codiprov ? codi10(f.codiprov) : null,
        codiComarca: f.codcomarca ? codi10(f.codcomarca) : null,
      });
    }
  }
  ens.sort((a, b) => a.codiEns.localeCompare(b.codiEns));
  return { ens, ajuntaments };
}

/** El que s'acumula per a cada ens mentre es llegeixen les quatre consultes. */
type Acumulat = {
  concessionsEns: number[];
  noPublicable: { import: number; concessions: number }[];
  agencies: Set<string>;
  imports: ImportAnual[];
  convocatories: FilaConvocatoria[];
};

// ─────────────────────────────────────────────────────────────────────────────
// La feina
// ─────────────────────────────────────────────────────────────────────────────

export async function j39SubvencionsEns(db: Db): Promise<unknown> {
  let resum: Record<string, unknown> = {};
  await withRun(db, "J39 subvencions de diputacions i consells als ajuntaments (RAISC)", async (run) => {
    const consultat = new Date().toISOString().slice(0, 10);
    const anys = anysComplets(new Date());
    const darrer = anys[anys.length - 1]!;
    const posicio = new Map(anys.map((a, i) => [a, i]));

    const perCodiEns = new Map<string, number>();
    for (const m of await db.select().from(municipalities)) perCodiEns.set(codi10(m.codiEns), m.id);

    const registre = llegeixRegistre(await socrataRegistre());
    const { perClau, repetides } = indexaEns(registre.ens);
    if (registre.ens.length !== 44 || repetides.length > 0) {
      await run.issue({
        kind: "subvencions_ens_registre_inesperat",
        severity: "alta",
        detail: { ens: registre.ens.length, esperats: 44, clausRepetides: repetides },
      });
    }
    const ajuntamentPerCif = new Map(registre.ajuntaments.map((a) => [a.cif, a]));
    run.say(`${registre.ens.length} ens al registre · ${registre.ajuntaments.length} ajuntaments amb CIF · anys ${anys.join(", ")}`);

    // Les quatre consultes, una darrere l'altra i amb pausa: en paral·lel el
    // portal torna 429.
    await sleep(PAUSA_MS);
    const totals = await agregat<FilaRaisc>(consultaTotals(anys));
    await sleep(PAUSA_MS);
    const amagats = await agregat<FilaRaisc>(consultaTotals(anys, true));
    await sleep(PAUSA_MS);
    const perAjuntament = await agregat<FilaRaisc>(consultaPerAjuntament(anys));
    await sleep(PAUSA_MS);
    const perConvocatoria = await agregat<FilaRaisc>(consultaConvocatories(darrer));
    run.rowsIn = totals.length + amagats.length + perAjuntament.length + perConvocatoria.length;
    run.say(
      `RAISC: ${totals.length} sumes per concedent i any, ${amagats.length} sense beneficiari publicable, ` +
        `${perAjuntament.length} per ajuntament i any, ${perConvocatoria.length} per convocatòria (${darrer})`,
    );

    const acumulat = new Map<string, Acumulat>();
    for (const e of registre.ens) {
      acumulat.set(e.codiEns, {
        concessionsEns: anys.map(() => 0),
        noPublicable: anys.map(() => ({ import: 0, concessions: 0 })),
        agencies: new Set(),
        imports: [],
        convocatories: [],
      });
    }
    const senseEns = new Map<string, number>();
    const atribueix = (f: FilaRaisc): { acc: Acumulat; ens: EnsRegistre } | null => {
      const c = classificaConcedent(f.concedent, f.adscripcio, perClau);
      if (!c) {
        const nom = f.concedent ?? "(sense nom)";
        senseEns.set(nom, (senseEns.get(nom) ?? 0) + (numero(f.concessions) ?? 0));
        return null;
      }
      const acc = acumulat.get(c.ens.codiEns)!;
      if (c.agencia) {
        if (f.concedent) acc.agencies.add(f.concedent.trim());
        return null;
      }
      return { acc, ens: c.ens };
    };

    for (const f of totals) {
      const a = atribueix(f);
      const i = posicio.get(numero(f.any) ?? NaN);
      if (a && i !== undefined) a.acc.concessionsEns[i]! += numero(f.concessions) ?? 0;
    }
    for (const f of amagats) {
      const a = atribueix(f);
      const i = posicio.get(numero(f.any) ?? NaN);
      if (!a || i === undefined) continue;
      const np = a.acc.noPublicable[i]!;
      np.import = centims(np.import + (numero(f.import) ?? 0));
      np.concessions += numero(f.concessions) ?? 0;
    }

    // Les sumes que passen el patró del CIF però no són de cap ajuntament (una
    // EMD, la diputació mateixa) o que no porten import es compten i prou.
    let noAjuntament = 0;
    let senseImport = 0;
    for (const f of perAjuntament) {
      const a = atribueix(f);
      if (!a) continue;
      const cif = normalitzaCif(f.cif);
      const any = numero(f.any);
      const imp = numero(f.import);
      if (!cif || !ajuntamentPerCif.has(cif)) noAjuntament += 1;
      else if (any === null || imp === null) senseImport += 1;
      else a.acc.imports.push({ cif, any, import: imp });
    }
    for (const f of perConvocatoria) {
      const a = atribueix(f);
      if (!a) continue;
      const cif = normalitzaCif(f.cif);
      const ajuntament = cif ? ajuntamentPerCif.get(cif) : undefined;
      const imp = numero(f.import);
      // Només els ajuntaments del territori, com la taula: si no, la llista de
      // convocatòries i la taula dirien coses diferents.
      if (!ajuntament || imp === null || !esDelTerritori(a.ens, ajuntament)) continue;
      a.acc.convocatories.push({ titol: f.titol ?? f.titol_es ?? null, import: imp, concessions: numero(f.concessions) ?? 0 });
    }
    if (noAjuntament + senseImport > 0) run.say(`${noAjuntament} sumes amb CIF que no és d'ajuntament · ${senseImport} sense import`);

    const font = { ...FONT_RAISC, consultat };
    const ambRegistres: string[] = [];
    const senseRegistres: string[] = [];
    const fora: Record<string, unknown>[] = [];
    for (const ens of registre.ens) {
      const acc = acumulat.get(ens.codiEns)!;
      const seu = ens.seuCodiEns ? perCodiEns.get(ens.seuCodiEns) : undefined;
      if (seu === undefined) {
        await run.issue({ kind: "subvencions_ens_sense_seu", severity: "alta", entity: ens.nom, detail: { seu: ens.seuCodiEns } });
        continue;
      }
      const territori: { cif: string; municipalityId: number }[] = [];
      for (const a of registre.ajuntaments) {
        if (!esDelTerritori(ens, a)) continue;
        const municipalityId = perCodiEns.get(a.codiEns);
        if (municipalityId === undefined) {
          await run.issue({ kind: "subvencions_ens_municipi_desconegut", entity: ens.nom, detail: { codiEns: a.codiEns, cif: a.cif } });
        } else territori.push({ cif: a.cif, municipalityId });
      }
      const plegat = plegaPerAjuntament(anys, acc.imports, territori);
      if (plegat.foraDelTerritori.length > 0) {
        const detall = plegat.foraDelTerritori.map((f) => ({ ...f, codiEns: ajuntamentPerCif.get(f.cif)?.codiEns ?? null }));
        fora.push({ ens: ens.nom, files: detall });
        await run.issue({ kind: "subvencions_ens_fora_del_territori", severity: "baixa", entity: ens.nom, detail: { files: detall } });
      }
      (acc.concessionsEns.some((n) => n > 0) ? ambRegistres : senseRegistres).push(ens.nom);

      const dades: SubvencionsEnsDesades = {
        codiEns: ens.codiEns,
        ens: ens.nom,
        anys,
        perAjuntament: plegat.perAjuntament,
        convocatories: topConvocatories(acc.convocatories),
        agenciesExcloses: [...acc.agencies].sort((a, b) => a.localeCompare(b, "ca")),
        font,
        concessionsEns: acc.concessionsEns,
        noPublicable: acc.noPublicable,
      };
      await desa(db, seu, `${PREFIX_KIND_SUBVENCIONS}${ens.codiEns}`, dades);
      run.rowsOut += 1;
      const ambImport = plegat.perAjuntament.filter((p) => p.imports.some((x) => x !== null)).length;
      run.say(`${ens.nom}: ${ambImport}/${territori.length} ajuntaments amb alguna concessió · ${acc.agencies.size} organismes fora`);
    }

    const senseEnsMostra = [...senseEns].sort((a, b) => b[1] - a[1]).slice(0, 20);
    if (senseEns.size > 0) {
      await run.issue({
        kind: "subvencions_ens_concedent_desconegut",
        severity: "mitjana",
        detail: { concedents: Object.fromEntries(senseEnsMostra) },
      });
    }
    run.say(`${ambRegistres.length}/${registre.ens.length} ens amb alguna concessió pròpia al RAISC (${anys.join("-")})`);
    if (senseRegistres.length > 0) run.say(`Sense cap registre: ${senseRegistres.join(", ")}`);
    if (senseEns.size > 0) run.say(`Concedents sense ens: ${senseEnsMostra.map(([n]) => n).join(" · ")}`);

    resum = {
      anys,
      ens: run.rowsOut,
      ambRegistres: ambRegistres.length,
      senseRegistres,
      concedentsSenseEns: senseEnsMostra.map(([n]) => n),
      foraDelTerritori: fora.length,
      consultat,
    };
    return resum;
  });
  return resum;
}

/** El registre d'ens locals: diputacions, comarques i municipis, en una sola consulta. */
async function socrataRegistre(): Promise<FilaRegistre[]> {
  return socrataAll<FilaRegistre>(DATASETS.ensLocals, {
    select: "codi_ens,nomtipus,nom_complert,cif,codi_municipi,codiprov,codcomarca,dissolt",
    where: "nomtipus in ('Comarques','Províncies','Municipis')",
  });
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
