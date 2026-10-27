import { municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { ckanSql } from "../adapters/aoc";
import { DATASETS, socrataAll } from "../adapters/socrata";
import { esAlcaldia, PLENS } from "./j14-electes-cost";
import { LLICENCIA_DIBA, LLICENCIA_SEUE, llegeixBarcelona, llegeixTaula, URL_ALTS_CARRECS } from "./j24-diputacions";
import { nomsLliguenAmbInicials } from "./j30-sous-consells";
import { fetchText } from "../adapters/seue";
import { sleep } from "../lib/http";
import { normalize, normalizePersonName } from "../lib/text";
import { withRun, type Run } from "../lib/run";
import {
  KIND_CONSELL,
  KIND_DIPUTACIO,
  type CapitolDesat,
  type EnsDesat,
  type FinancesDesades,
  type FontEns,
  type MembreDesat,
  type ProgramaDesat,
  type RolEns,
  type TipusEns,
} from "../publish/ens-tipus";

/**
 * J38 — les fitxes de les quatre diputacions i dels quaranta consells
 * comarcals: qui hi seu, d'on ve cadascú, quant gasten i en què.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PER QUÈ UNA FEINA NOVA SI LA J24 I LA J30 JA VISITEN AQUESTS ENS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * La J24 i la J30 miren els ens supramunicipals des del municipi: busquen quin
 * regidor de cada ajuntament cobra també d'una diputació o d'un consell, i ho
 * desen a la fitxa del municipi. El que mai no han fet és mirar l'ens **com a
 * ens**: el ple sencer, amb els que no són regidors de cap municipi que
 * tinguem lligat, la presidència, els comptes de quinze anys i, a les
 * diputacions, els districtes electorals amb què es reparteixen els escons.
 * Això és el que llegeix aquesta feina, i ho desa amb la forma del contracte
 * `EnsDesat` (`publish/ens-tipus.ts`) al municipi que n'és la seu.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LES FONTS, COMPROVADES UNA A UNA EL 27-10-2026
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   · **Registre d'ens locals** (`6nei-4b44`): nom, seu, CIF, gerent, web i
 *     fitxa del Municat. Hi surten 47 ens de tipus «Comarques» i «Províncies»;
 *     tres no tenen ple que llegir i no es publiquen: la Comarca del Barcelonès
 *     (el consell es va dissoldre el 2019, encara que el registre digui
 *     `dissolt = N`), el Conselh Generau d'Aran (règim propi, elecció directa)
 *     i el Lluçanès (comarca sense consell fins després del 2027).
 *   · **Composició dels plens** (`nm3n-3vbj`): 1.158 files per als 44 ens que
 *     queden. Els 40 consells, Lleida i Tarragona hi tenen noms; **Barcelona
 *     (51) i Girona (27) només hi tenen files buides**, que diuen quants escons
 *     hi ha però no qui els ocupa. Els noms d'aquestes dues surten de les
 *     mateixes pàgines que ja llegeix la J24 (la de retribucions de diba.cat i
 *     la taula d'alts càrrecs de la seu-e `ddgi`), amb els seus lectors i no
 *     amb uns de nous. El partit i el municipi d'aquests diputats surten de
 *     les pàgines de l'ens mateix quan el ple municipal no els diu: les fitxes
 *     dels 51 diputats de diba.cat (`URL_PLE_DIBA`) i la pàgina de grups
 *     polítics de ddgi.cat (`URL_GRUPS_DDGI`).
 *   · **Municipis i districtes** (`ehvx-5ty7`): de cada municipi, el codi de
 *     la seva comarca i de la seva província —que són exactament els codis
 *     d'ens del consell i de la diputació— i el `partit_electoral`, que són els
 *     partits judicials del 1979 que la LOREG (art. 204.3) fa servir de
 *     districtes. Amb codis i no amb noms: «Alt Camp» i «l'Alt Camp» no lliguen,
 *     «8100170005» i «8100170005» sí.
 *   · **Comptes** (CKAN de l'AOC, CC0): la liquidació per capítols, la despesa
 *     per programes i el deute viu, del 2010 al 2025. Les diputacions i els
 *     consells hi són com qualsevol ajuntament.
 *   · **Símbols** (`2zbw-miu8`): l'escut o l'emblema oficial, quan l'ens en té
 *     de propi (dues diputacions i una vintena de consells). Les banderes no
 *     s'hi prenen: no fan de segell a cap capçalera.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TRES PARANYS DE LA FONT DE PLENS, TROBATS MIRANT-LA
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   · **La Diputació de Tarragona escriu «President» a vint dels seus 27
 *     diputats**: el camp porta la presidència de l'àrea o de l'organisme que
 *     cadascú presideix, no el càrrec al ple. Quan un ple té més d'una
 *     presidència, el càrrec es corregeix amb la taula d'alts càrrecs de la seu
 *     de l'ens (la mateixa de la J24), i la presidència és la persona que el
 *     registre d'ens locals diu que presideix. La resta queden com a membres.
 *   · **«Alcalde President» vol dir president del consell.** Set consells
 *     l'escriuen així (la Selva, el Ripollès, la Noguera…); comprovat contra
 *     el registre d'ens locals, en tots set és qui el presideix.
 *   · **Els buits no sempre són buits**: hi ha files amb «-» al nom, al càrrec
 *     i al partit (l'Alt Camp), i noms escrits «Cognoms, Nom» (el Gironès). El
 *     «-» és un escó vacant i compta com a escó; el nom girat es posa dret
 *     perquè es pugui aparellar i llegir. I hi ha files sense nom però amb el
 *     càrrec i el partit (dues al Montsià): són escons d'aquell partit amb la
 *     persona per saber, i es desen com a membres amb el nom buit
 *     (`NOM_NO_PUBLICAT`) perquè la composició i el repartiment quadrin.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL QUE S'HI DESA I EL QUE NO
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   · **Un buit és un buit.** Un capítol que la liquidació no porta és `null`,
 *     no zero; un any sense cap fila no hi és. Un deute que l'ens no declara no
 *     es converteix en «sense deute».
 *   · **El municipi de cada membre, només si és segur.** Primer pel camp
 *     `municipi_representa` del registre de plens (que només omplen dinou
 *     consells), resolt pel nom dins del territori de l'ens. Si no n'hi ha, per
 *     un aparellament de nom **únic** amb els regidors actuals dels municipis
 *     del territori: exacte, i si no, per inicial amb la regla de la J30. Si el
 *     nom pot ser de dues persones, no és de cap.
 *   · **El partit, de l'ens o del ple municipal, i dit d'on surt.** Quan el
 *     registre de plens no el porta (Barcelona i Girona), es pren el del grup
 *     municipal de la persona, i `partitFont` ho diu.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Fonts
// ─────────────────────────────────────────────────────────────────────────────

/** Municipis amb comarca, província i districte electoral (LOREG 204.3). */
export const MUNICIPIS_TERRITORI = "ehvx-5ty7";

/** Escuts, emblemes i banderes oficials dels ens locals. */
export const SIMBOLS = "2zbw-miu8";

/** CKAN de l'AOC: liquidació per capítols, per programes, i endeutament. */
export const LIQUIDACIO_CAPITOLS = "81f18313-547f-4c87-adbd-c6ce873cb406";
export const LIQUIDACIO_PROGRAMES = "5b96829f-d724-4059-a38a-abf514830558";
export const DEUTE_VIU = "34db8dc5-ad5e-4bf0-83cc-537cd8671342";

/**
 * La sèrie de comptes. El 2010 és el primer any de debò de la liquidació (vegeu
 * la J6) i el 2025 l'últim que el portal publica; comprovat el 27-10-2026 que
 * hi ha 45 ens supramunicipals cada any del 2010 al 2024 i 43 el 2025, que
 * encara s'està liquidant.
 */
export const PRIMER_ANY = 2010;
export const ULTIM_ANY = 2025;

/**
 * Quants exercicis enrere es busca la despesa per programes. Se'n desa només
 * l'últim que l'ens tingui, i quatre anys és prou marge perquè un ens que
 * encara no ha liquidat el 2025 surti amb el 2024.
 */
const ANYS_PROGRAMES = 4;

/** El datastore de l'AOC talla en silenci a 32.000 files (vegeu la J15). */
const SOSTRE_CKAN = 31_900;

/** Entre crida i crida a Socrata i a CKAN: sense pressa, que la font és gratis. */
const PAUSA_MS = 400;

/**
 * Els ens del registre que no tenen ple que llegir. Van per codi i no per nom
 * perquè el registre en canvia l'ortografia sense avisar.
 */
export const ENS_EXCLOSOS: Readonly<Record<string, string>> = {
  "8101360009": "Comarca del Barcelonès: el consell es va dissoldre el 2019 (Llei 1/2019)",
  "8103980001": "Conselh Generau d'Aran: règim propi i elecció directa, fora del registre de plens",
  "8104300000": "Lluçanès: comarca sense consell fins després de les municipals del 2027",
};

/**
 * Els ítems de Wikidata de les quatre diputacions, comprovats a mà. Dels
 * consells no se'n desa cap: els ítems que hi ha barregen sovint la comarca i
 * el consell, i un aparellament dubtós no és un aparellament.
 */
export const WIKIDATA_DIPUTACIONS: Readonly<Record<string, string>> = {
  "8000840003": "Q1607008",
  "8001760009": "Q8560221",
  "8002550006": "Q8560240",
  "8004330008": "Q11917314",
};

const LLICENCIA_GENERALITAT =
  "Condicions d'ús del portal de Dades Obertes de Catalunya: reutilització amb atribució i sense alterar el sentit";
const LLICENCIA_AOC = "Creative Commons CCZero (CC0 1.0)";

const urlSocrata = (dataset: string): string => `https://analisi.transparenciacatalunya.cat/d/${dataset}`;

/** Els noms dels capítols, de l'estructura pressupostària de l'Ordre EHA/3565/2008. */
export const NOMS_CAPITOLS: Readonly<Record<"ingressos" | "despeses", Readonly<Record<number, string>>>> = {
  ingressos: {
    1: "Impostos directes",
    2: "Impostos indirectes",
    3: "Taxes, preus públics i altres ingressos",
    4: "Transferències corrents",
    5: "Ingressos patrimonials",
    6: "Alienació d'inversions reals",
    7: "Transferències de capital",
    8: "Actius financers",
    9: "Passius financers",
  },
  despeses: {
    1: "Despeses de personal",
    2: "Despeses en béns corrents i serveis",
    3: "Despeses financeres",
    4: "Transferències corrents",
    5: "Fons de contingència i altres imprevistos",
    6: "Inversions reals",
    7: "Transferències de capital",
    8: "Actius financers",
    9: "Passius financers",
  },
};

const avui = (): string => new Date().toISOString().slice(0, 10);

// ─────────────────────────────────────────────────────────────────────────────
// Funcions pures: textos de la font
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El valor d'un camp de text, o `null` si no diu res. El «-» que l'Alt Camp
 * posa en un escó vacant no és un nom ni un partit, és un buit escrit.
 */
export function valorNet(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const net = String(valor).replace(/\s+/g, " ").trim();
  return net === "" || /^[-–—.]+$/.test(net) ? null : net;
}

/**
 * «Gràcia i Xuclà, Sònia» → «Sònia Gràcia i Xuclà». El Gironès escriu així
 * tot el seu ple, i girat no lliga amb el mateix nom del ple municipal ni es
 * llegeix bé a la pàgina. Només es gira si hi ha exactament una coma i text a
 * banda i banda; qualsevol altra cosa es deixa com l'escriu la font.
 */
export function nomDret(nom: string): string {
  const parts = nom.split(",");
  if (parts.length !== 2) return nom.trim();
  const [cognoms, pila] = parts.map((p) => p.trim()) as [string, string];
  return cognoms && pila ? `${pila} ${cognoms}` : nom.trim();
}

/**
 * El paper de cada membre, deduït del text del càrrec.
 *
 * Les fonts escriuen el mateix de moltes maneres —«Presidenta», «Alcalde
 * President», «Presidenta del Consell Comarcal de l'Alt Urgell», «Vicepresident
 * 1r», «Vicepresidenta segona», «Conseller», «Diputada»— i la regla és estreta
 * a posta:
 *
 *   · **Presidència** només si el càrrec és «president(a)» sol, o seguit del
 *     nom de l'ens («del Consell…», «de la Diputació…»). L'«alcalde» o
 *     «alcaldessa» del davant es treu: és com set consells escriuen el seu
 *     president. «President de l'Àrea de Cultura» o «presidències delegades
 *     d'àrea» no són la presidència del ple.
 *   · **Vicepresidència** si comença per «vicepresident» (no per
 *     «vicepresidències», que a diba.cat és el nom d'un tram retributiu).
 *   · Tota la resta, **membre**.
 */
export function rolDeCarrec(carrec: string | null): RolEns {
  if (!carrec) return "membre";
  const c = normalize(carrec).replace(/^alcalde(ssa)?\s+/, "");
  if (/^vicepresident(a)?\b/.test(c)) return "vicepresidencia";
  if (/^president(a)?(\s+del?\s+(l\s+)?(consell|diputacio)\b.*)?$/.test(c)) return "presidencia";
  return "membre";
}

const ORDINALS: Readonly<Record<string, number>> = {
  primer: 1, primera: 1, segon: 2, segona: 2, tercer: 3, tercera: 3, quart: 4, quarta: 4,
  cinque: 5, cinquena: 5, sise: 6, sisena: 6, sete: 7, setena: 7, vuite: 8, vuitena: 8,
};

/**
 * El número d'una vicepresidència, per ordenar el ple com l'ordena l'ens:
 * «Vicepresident 1r», «Vicepresidenta 1ra», «Vicepresidenta segona»,
 * «Vicepresident 5è». `null` si el càrrec no en porta cap («Vicepresident»).
 */
export function numeroVicepresidencia(carrec: string | null): number | null {
  if (rolDeCarrec(carrec) !== "vicepresidencia") return null;
  const c = normalize(carrec!);
  const xifra = c.match(/\b(\d{1,2})\s*(r|ra|n|na|a|t|ta|e|o)?\b/);
  if (xifra) return Number(xifra[1]);
  for (const mot of c.split(" ")) if (ORDINALS[mot] !== undefined) return ORDINALS[mot]!;
  return null;
}

/** Clau d'ordre del ple: presidència, vicepresidències per número, la resta. */
export function ordreDelPle(a: MembreDesat, b: MembreDesat): number {
  const rang = (m: MembreDesat): number => (m.rol === "presidencia" ? 0 : m.rol === "vicepresidencia" ? 1 : 2);
  if (rang(a) !== rang(b)) return rang(a) - rang(b);
  const va = numeroVicepresidencia(a.carrec) ?? 99;
  const vb = numeroVicepresidencia(b.carrec) ?? 99;
  if (va !== vb) return va - vb;
  const oa = a.ordre ?? 9_999;
  const ob = b.ordre ?? 9_999;
  if (oa !== ob) return oa - ob;
  return a.nom.localeCompare(b.nom, "ca");
}

/**
 * «El» + «Bages» → «el Bages»; «L'» + «Anoia» → «l'Anoia». El registre dona
 * l'article a part, amb majúscula i de vegades amb un espai després de
 * l'apòstrof («L' Alt Camp»). Sense article (Osona, les diputacions), `null`.
 */
export function territoriAmbArticle(article: string | null | undefined, territori: string): string | null {
  const a = valorNet(article);
  if (!a) return null;
  const net = a.toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, "");
  return net.endsWith("'") ? `${net}${territori}` : `${net} ${territori}`;
}

/**
 * Un import tal com el tornen els conjunts de l'AOC: amb punt decimal a la
 * liquidació per capítols («321864252.10») i amb coma a la de programes
 * («254794346,34»). Un buit és `null`, mai zero.
 */
export function euros(valor: unknown): number | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  let text = String(valor).replace(/\s| /g, "");
  if (text === "") return null;
  if (text.includes(",")) text = text.replace(/\./g, "").replace(",", ".");
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/** El codi d'ens de 10 xifres: Socrata i CKAN es mengen el zero de Barcelona. */
export const codi10 = (valor: unknown): string => String(valor).trim().padStart(10, "0");

// ─────────────────────────────────────────────────────────────────────────────
// Funcions pures: de quin municipi és cada membre
// ─────────────────────────────────────────────────────────────────────────────

/** Un municipi del territori de l'ens, amb tots els noms amb què surt a les fonts. */
export type MunicipiTerritori = { municipalityId: number; noms: string[] };

/**
 * Les claus amb què es pot buscar un municipi pel nom: el nom normalitzat
 * sencer i, si comença per article, també sense («El Cogul» i «Cogul»). Les
 * fonts escriuen l'article de tres maneres («L'Estany», «Estany», «Estany,
 * l'») i el municipi és el mateix.
 */
export function clausDeMunicipi(nom: string): string[] {
  const girat = nom.match(/^(.*),\s*(l['’]|els?|les|la)\s*$/i);
  const dret = girat ? `${girat[2]} ${girat[1]}` : nom;
  const sencer = normalize(dret);
  const senseArticle = sencer.replace(/^(el|la|els|les|l)\s+/, "");
  return [...new Set([sencer, senseArticle])].filter((k) => k.length > 0);
}

/**
 * El municipi que vol dir el camp `municipi_representa`, buscat **només dins
 * del territori de l'ens** i només si el nom en designa un de sol. Un nom que
 * no lliga («CONSELL COMARCAL», «Alt Camp», una errada com «Caldes de
 * Malavela») torna `null`, i llavors el membre es busca pel seu nom.
 */
export function resolMunicipi(nom: string | null, municipis: readonly MunicipiTerritori[]): number | null {
  if (!nom) return null;
  const buscades = clausDeMunicipi(nom);
  const exactes = new Set<number>();
  const perInici = new Set<number>();
  for (const m of municipis) {
    const claus = m.noms.flatMap(clausDeMunicipi);
    if (claus.some((k) => buscades.includes(k))) exactes.add(m.municipalityId);
    /*
     * La segona volta, per paraules senceres: el registre escriu «Palamós» per
     * «Palamós i Sant Joan», «Brunyola» per «Brunyola i Sant Martí Sapresa» i
     * «Vilobí d'Onyar, Salitja i Sant Dalmai» per «Vilobí d'Onyar». Un nom és
     * l'inici de l'altre fins a un espai, i només val si n'hi ha un de sol.
     */
    if (claus.some((k) => buscades.some((b) => k.startsWith(`${b} `) || b.startsWith(`${k} `)))) {
      perInici.add(m.municipalityId);
    }
  }
  if (exactes.size > 0) return exactes.size === 1 ? [...exactes][0]! : null;
  return perInici.size === 1 ? [...perInici][0]! : null;
}

/** Un regidor o regidora del mandat actual, del registre de plens. */
export type RegidorActual = { nom: string; carrec: string | null; partit: string | null; municipalityId: number };

export type Aparellament<R> = { regidor: R | null; ambigu: boolean };

/**
 * La persona del ple municipal que és aquest membre de l'ens.
 *
 * Primer el nom normalitzat exacte; si no, la regla de la inicial de la J30
 * («EVA M. MARTINEZ MORALES» amb «Eva María Martínez Morales»). En tots dos
 * casos **només si n'hi ha un de sol**: dos regidors amb el mateix nom dins del
 * territori volen dir que no sabem qui és, i un membre de l'ens enllaçat amb
 * qui no és seria pitjor que no enllaçar-lo.
 */
export function aparellaRegidor<R extends { nom: string }>(nom: string, regidors: readonly R[]): Aparellament<R> {
  const clau = normalizePersonName(nomDret(nom));
  if (!clau) return { regidor: null, ambigu: false };
  const exactes = regidors.filter((r) => normalizePersonName(nomDret(r.nom)) === clau);
  if (exactes.length === 1) return { regidor: exactes[0]!, ambigu: false };
  if (exactes.length > 1) return { regidor: null, ambigu: true };
  const perInicial = regidors.filter((r) => nomsLliguenAmbInicials(nomDret(r.nom), nomDret(nom)));
  if (perInicial.length === 1) return { regidor: perInicial[0]!, ambigu: false };
  return { regidor: null, ambigu: perInicial.length > 1 };
}

/** `aparellaRegidor` amb cada manera d'escriure el nom; la primera que lliga, mana. */
function aparellaAmbNoms<R extends { nom: string }>(noms: readonly string[], regidors: readonly R[]): Aparellament<R> {
  let ambigu = false;
  for (const nom of noms) {
    const a = aparellaRegidor(nom, regidors);
    if (a.regidor) return a;
    ambigu ||= a.ambigu;
  }
  return { regidor: null, ambigu };
}

/**
 * L'aparellament dins del ple d'**un sol municipi**, el que l'ens diu que la
 * persona representa. Primer com a tot arreu (nom exacte, inicials); si no
 * lliga, pels dos cognoms, perquè les diputacions escriuen sovint el nom de
 * pila familiar («Filo Cañete Carrillo» és «Filomena Cañete Carrillo» al ple de
 * Sant Adrià de Besòs). Que l'ens mateix digui el municipi i que al ple només hi
 * hagi una persona amb aquells dos cognoms és el que fa que no sigui una
 * endevinalla; si n'hi ha dues, no és de cap.
 */
export function aparellaDinsDelMunicipi<R extends { nom: string }>(noms: readonly string[], regidors: readonly R[]): Aparellament<R> {
  const primer = aparellaAmbNoms(noms, regidors);
  if (primer.regidor || primer.ambigu) return primer;
  const perCognoms = regidors.filter((r) => noms.some((n) => cognomsLliguen(n, r.nom)));
  if (perCognoms.length === 1) return { regidor: perCognoms[0]!, ambigu: false };
  return { regidor: null, ambigu: perCognoms.length > 1 };
}

/** Un membre tal com el llegeix la font, abans de saber-ne el municipi. */
export type MembreLlegit = {
  nom: string;
  carrec: string;
  ordre: number | null;
  partit: string | null;
  municipiRepresenta: string | null;
  /**
   * El grup on seu segons la pàgina de grups de l'ens mateix (diba.cat,
   * ddgi.cat), per a les dues diputacions que el registre de plens deixa sense
   * partit. Només mana si el ple municipal no diu res: el grup d'avui pot no ser
   * la llista per on va entrar («Junts per Igualada»).
   */
  grupALEns?: string | null;
  /** L'alcaldia segons la pàgina de l'ens, si el ple municipal no la diu. */
  alcaldiaALEns?: boolean | null;
  /** Si el càrrec municipal que en diu la pàgina de l'ens és en femení. */
  femeniALEns?: boolean | null;
  /** Altres maneres com l'ens escriu el nom, per buscar-lo al ple municipal. */
  nomsAlternatius?: string[];
};

/**
 * Completa un membre amb el seu municipi, el partit i l'alcaldia.
 *
 * `municipi_representa` mana quan es pot resoldre: és el que diu el registre.
 * Llavors la persona es busca només al ple d'aquell municipi, per saber-ne el
 * grup i si n'és l'alcalde. Si el camp no hi és o no lliga, es busca el nom
 * entre tots els regidors del territori. El partit de l'ens passa per davant
 * del municipal, i `partitFont` diu sempre d'on ha sortit.
 */
export function completaMembre(
  llegit: MembreLlegit,
  municipis: readonly MunicipiTerritori[],
  regidors: readonly RegidorActual[],
  tipus: TipusEns = "consell",
): { membre: MembreDesat; ambigu: boolean } {
  let municipalityId: number | null = null;
  let municipiFont: MembreDesat["municipiFont"] = null;
  let aparellat: Aparellament<RegidorActual>;

  const noms = [llegit.nom, ...(llegit.nomsAlternatius ?? [])];
  const delRegistre = resolMunicipi(llegit.municipiRepresenta, municipis);
  if (delRegistre !== null) {
    municipalityId = delRegistre;
    municipiFont = "registre";
    aparellat = aparellaDinsDelMunicipi(noms, regidors.filter((r) => r.municipalityId === delRegistre));
  } else {
    aparellat = aparellaAmbNoms(noms, regidors);
    if (aparellat.regidor) {
      municipalityId = aparellat.regidor.municipalityId;
      municipiFont = "aparellament";
    }
  }

  const regidor = aparellat.regidor;
  const partitMunicipal = regidor ? valorNet(regidor.partit) : null;
  const grupALEns = valorNet(llegit.grupALEns ?? null);
  const partit = llegit.partit ?? partitMunicipal ?? grupALEns;
  const carrec =
    tipus === "diputacio"
      ? carrecDeDiputacio(llegit.carrec, (regidor ? femeniDelCarrec(regidor.carrec) : null) ?? llegit.femeniALEns ?? null)
      : llegit.carrec;
  return {
    membre: {
      nom: llegit.nom,
      carrec,
      rol: rolDeCarrec(llegit.carrec),
      ordre: llegit.ordre,
      partit,
      partitFont: llegit.partit ? "ens" : partitMunicipal ? "ple municipal" : grupALEns ? "ens" : null,
      municipalityId,
      municipiFont,
      alcaldia: regidor ? esAlcaldia(regidor.carrec ?? "") : (llegit.alcaldiaALEns ?? false),
      nomAlPle: regidor ? regidor.nom : null,
    },
    ambigu: aparellat.ambigu,
  };
}

/**
 * Les files del registre de plens sense les persones repetides.
 *
 * El registre escriu de tant en tant la mateixa persona dues vegades al mateix
 * ple: «Ana Herrera Bordallo» al Garraf, «Javier Garcia Romero» al Vallès
 * Occidental (27-10-2026). Dues files amb el mateix nom normalitzat i el mateix
 * municipi (o cap) són una persona, i un sol escó. Les files sense nom (escons
 * vacants, «-») no es toquen: cadascuna és un escó.
 */
export function treuRepetits<F extends { nom: string | null; municipiRepresenta: string | null }>(
  files: readonly F[],
): { files: F[]; repetits: string[] } {
  const vistes = new Set<string>();
  const repetits: string[] = [];
  const sortida: F[] = [];
  for (const f of files) {
    if (f.nom === null) {
      sortida.push(f);
      continue;
    }
    const clau = `${normalizePersonName(f.nom)}|${normalize(f.municipiRepresenta ?? "")}`;
    if (vistes.has(clau)) {
      repetits.push(f.nom);
      continue;
    }
    vistes.add(clau);
    sortida.push(f);
  }
  return { files: sortida, repetits };
}

/**
 * El nom que es desa per a un escó que el registre de plens dona **amb el
 * partit i sense la persona**.
 *
 * Passa al Montsià (27-10-2026): de les 25 files del ple, dues no porten nom
 * però sí el càrrec i les sigles («Conseller», CP; «Consellera», AM). Abans es
 * llençaven com si fossin escons vacants, i llavors la composició del consell
 * tenia dos escons menys dels que té cada partit i el repartiment que fa la
 * llei no podia quadrar mai, per bo que fos el càlcul. El partit és una dada de
 * la font i es queda; la persona no la sabem, i no s'inventa.
 *
 * Per què una cadena buida i no `null` ni un text com «Escó sense nom»: el
 * contracte (`MembreDesat.nom` a `ens-tipus.ts`) diu que el nom és una cadena, i
 * el JSON-LD de les fitxes (`ensLd` i `preguntesEns` a `seo-ld.ts`) ja tracta
 * un nom buit com «un seient sense nom no és cap persona» i no en fa cap
 * `Person`. Un text de mentida, en canvi, hi entraria com si fos algú. Les
 * pàgines no l'han d'escriure tal qual: el pinten amb `esSeientSenseNom()` com
 * «Seient de CP (la font no en dona el nom)».
 *
 * Els escons sense nom **ni** partit (el «-» de l'Alt Camp) no són d'això: són
 * vacants de debò, no es desen com a membres i només compten a `seients`.
 */
export const NOM_NO_PUBLICAT = "";

/** Si un membre desat és un escó amb partit i sense persona (vegeu `NOM_NO_PUBLICAT`). */
export function esSeientSenseNom(nom: string): boolean {
  return nom.trim() === NOM_NO_PUBLICAT;
}

/** Una fila del registre de plens ja neta, abans de saber si porta nom. */
export type FilaPleNeta = Omit<MembreLlegit, "nom"> & { nom: string | null };

/**
 * Un escó amb partit i sense nom, com a membre: el partit i el càrrec literal
 * de la font, i el municipi només si el registre el diu (`municipi_representa`).
 *
 * No passa per cap aparellament de nom, perquè no n'hi ha: no té fitxa, ni
 * cara, ni sou, ni alcaldia coneguda. Tampoc no pot ser la presidència: el
 * registre d'ens locals diu qui presideix amb nom i cognoms, i un escó sense
 * nom no s'hi pot comparar. Si la fila digués «President», es queda el càrrec
 * literal però el rol és de membre, i la presidència la resol
 * `reconciliaPresidencia()` amb els que tenen nom.
 */
export function seientSenseNom(fila: FilaPleNeta, municipis: readonly MunicipiTerritori[], tipus: TipusEns): MembreDesat {
  const municipalityId = resolMunicipi(fila.municipiRepresenta, municipis);
  const rol = rolDeCarrec(fila.carrec);
  return {
    nom: NOM_NO_PUBLICAT,
    carrec: tipus === "diputacio" ? carrecDeDiputacio(fila.carrec, null) : fila.carrec,
    rol: rol === "presidencia" ? "membre" : rol,
    ordre: fila.ordre,
    partit: fila.partit,
    partitFont: fila.partit ? "ens" : null,
    municipalityId,
    municipiFont: municipalityId === null ? null : "registre",
    alcaldia: false,
    nomAlPle: null,
  };
}

/**
 * Separa les files del ple en les que porten nom (que passen per l'aparellament
 * amb els plens municipals), els escons amb partit i sense nom (que es desen
 * com a `seientSenseNom`) i els vacants (que només compten).
 */
export function separaFilesDelPle(files: readonly FilaPleNeta[]): { ambNom: MembreLlegit[]; senseNom: FilaPleNeta[]; vacants: number } {
  const ambNom = files.filter((f): f is MembreLlegit => f.nom !== null);
  const senseNom = files.filter((f) => f.nom === null && f.partit !== null);
  return { ambNom, senseNom, vacants: files.length - ambNom.length - senseNom.length };
}

/**
 * Els avisos dels escons sense nom, per a la pàgina. Porten la paraula «nom»
 * perquè la fitxa els posa al bloc dels membres, que és on fan falta.
 */
export function avisosDeSeientsSenseNom(senseNom: readonly Pick<FilaPleNeta, "partit">[], vacants: number): string[] {
  const avisos: string[] = [];
  if (senseNom.length > 0) {
    const partits = [...new Set(senseNom.map((f) => f.partit).filter((p): p is string => p !== null))].join(", ");
    avisos.push(
      senseNom.length === 1
        ? `El registre de plens hi dona un escó amb el partit (${partits}) però sense el nom de qui hi seu: ` +
            "aquí compta com a escó d'aquell partit."
        : `El registre de plens hi dona ${senseNom.length} escons amb el partit (${partits}) però sense el nom de ` +
            "qui hi seu: aquí compten com a escons de cada partit.",
    );
  }
  if (vacants > 0) {
    avisos.push(
      vacants === 1
        ? "El registre de plens hi deixa un escó sense nom ni partit."
        : `El registre de plens hi deixa ${vacants} escons sense nom ni partit.`,
    );
  }
  return avisos;
}

/** Codi d'ens del Consell Comarcal d'Osona i codi de comarca del Lluçanès a `ehvx-5ty7`. */
const CONSELL_OSONA = "8102490004";
const COMARCA_LLUCANES = "8104300000";

/**
 * Si un municipi que avui és d'una altra comarca era del territori del consell
 * quan es va formar el ple d'aquest mandat. Només hi ha un cas: els vuit
 * municipis del Lluçanès, comarca des del maig del 2023 i sense consell fins
 * després del 2027, van votar el 2023 com a part d'Osona, i els consellers que
 * en surten seuen al Consell Comarcal d'Osona. Sense això, Pere Martí Grau o
 * Jordi Bruch Franch es quedaven sense municipi.
 */
export function territoriDelMandat(codiConsell: string, codiComarca: string): boolean {
  return codiConsell === CONSELL_OSONA && codiComarca === COMARCA_LLUCANES;
}

// ─────────────────────────────────────────────────────────────────────────────
// Funcions pures: qui presideix
// ─────────────────────────────────────────────────────────────────────────────

/** Si dos noms són la mateixa persona: exactes normalitzats o per inicial. */
export function mateixaPersona(a: string, b: string): boolean {
  const ka = normalizePersonName(nomDret(a));
  const kb = normalizePersonName(nomDret(b));
  return (ka !== "" && ka === kb) || nomsLliguenAmbInicials(nomDret(a), nomDret(b));
}

/**
 * Corregeix el càrrec dels membres amb una taula de la seu de l'ens, per nom.
 *
 * És el remei per a la Diputació de Tarragona, que al registre de plens escriu
 * «President» a qui presideix una àrea: la seva taula d'alts càrrecs diu el
 * càrrec al ple. Només es corregeix qui lliga amb **una** fila de la taula; la
 * resta es queda amb el que diu el registre.
 */
export function corregeixCarrecs(
  membres: readonly MembreDesat[],
  taula: readonly { nom: string; carrec: string }[],
): { membres: MembreDesat[]; corregits: number } {
  let corregits = 0;
  const fora = membres.map((m) => {
    const files = taula.filter((t) => valorNet(t.carrec) && mateixaPersona(t.nom, m.nom));
    if (files.length !== 1) return m;
    const carrec = valorNet(files[0]!.carrec)!;
    if (carrec === m.carrec) return m;
    corregits += 1;
    return { ...m, carrec, rol: rolDeCarrec(carrec) };
  });
  return { membres: fora, corregits };
}

export type Presidencia = {
  membres: MembreDesat[];
  /** Què s'ha hagut de decidir, dit per a la llista d'incidències. */
  incidencia: "cap" | "diverses" | "promoguda" | "discrepant" | null;
  /** Frase per a la pàgina, si el lector ho ha de saber. */
  avis: string | null;
};

/**
 * Deixa el ple amb una sola presidència, i diu què ha fet.
 *
 *   · **Una i coincideix amb el registre d'ens locals**: res a dir.
 *   · **Més d'una**: presideix qui el registre d'ens locals diu; les altres
 *     passen a membre i la pàgina ho explica. Si el registre no lliga amb cap
 *     d'elles, no se'n tria cap: endevinar qui presideix no és una opció.
 *   · **Cap**: si el president del registre d'ens locals hi és com a membre, se
 *     li dona el rol (el càrrec literal no es toca) i es diu.
 *   · **Una que no és la del registre**: es confia en el registre de plens, que
 *     és el que s'actualitza amb cada ple, i queda com a incidència.
 */
export function reconciliaPresidencia(membres: readonly MembreDesat[], presidentRegistre: string | null): Presidencia {
  const presidents = membres.filter((m) => m.rol === "presidencia");
  const delRegistre = presidentRegistre
    ? membres.filter((m) => mateixaPersona(m.nom, presidentRegistre))
    : [];
  const elegit = delRegistre.length === 1 ? delRegistre[0]! : null;

  if (presidents.length === 1) {
    const discrepant = presidentRegistre !== null && !mateixaPersona(presidents[0]!.nom, presidentRegistre);
    return { membres: [...membres], incidencia: discrepant ? "discrepant" : null, avis: null };
  }

  if (presidents.length > 1) {
    const fora = membres.map((m): MembreDesat => {
      if (m.rol !== "presidencia") return m;
      return m === elegit ? m : { ...m, rol: "membre" };
    });
    const queden = fora.filter((m) => m.rol === "presidencia").length;
    return {
      membres: fora,
      incidencia: "diverses",
      avis:
        `El registre de plens de la Generalitat escriu «President» o «Presidenta» al càrrec de ${presidents.length} ` +
        `membres d'aquest ple, perquè hi posa la presidència de l'àrea que cadascú porta. ` +
        (queden === 1
          ? "Aquí només es compta com a presidència qui el registre d'ens locals diu que presideix."
          : "Com que el registre d'ens locals no permet saber qui és, aquí no es marca cap presidència."),
    };
  }

  if (elegit) {
    return {
      membres: membres.map((m): MembreDesat => (m === elegit ? { ...m, rol: "presidencia" } : m)),
      incidencia: "promoguda",
      avis:
        "El registre de plens no marca cap presidència en aquest ple; la persona que el registre d'ens locals diu " +
        "que presideix hi consta amb el càrrec que s'hi llegeix.",
    };
  }
  return { membres: [...membres], incidencia: "cap", avis: null };
}

/**
 * El càrrec d'un electe de la Diputació de Barcelona. La seva pàgina no en dona
 * un per persona: agrupa els electes per **tram retributiu** («Vicepresidències;
 * membres de la Comissió Executiva i diputats/des presidents/es dels grups
 * polítics»), i un tram no és un càrrec. Només la presidència hi surt sola.
 */
export function carrecDeTram(tram: string): string {
  return rolDeCarrec(tram) === "presidencia" ? tram : "Diputat/da";
}

// ─────────────────────────────────────────────────────────────────────────────
// Funcions pures: el grup i el municipi segons la pàgina de l'ens
// ─────────────────────────────────────────────────────────────────────────────

/**
 * La pàgina del ple de la Diputació de Barcelona: els 51 diputats, cadascun
 * amb un enllaç a la seva fitxa biogràfica. Comprovada el 27-10-2026.
 */
export const URL_PLE_DIBA = "https://www.diba.cat/ca/web/ladiputacio/ple";

/**
 * La pàgina dels grups polítics de la Diputació de Girona: cada grup amb els
 * seus diputats. Comprovada el 27-10-2026 (27 noms, els mateixos de la taula
 * d'alts càrrecs). La pàgina «El Ple» (`nivell/628`) en té 28 perquè hi queda
 * un diputat que ja no hi és; aquesta no.
 */
export const URL_GRUPS_DDGI = "https://www.ddgi.cat/web/nivell/643/s-0/grups-politics";

/** Les entitats amb nom que surten als noms catalans i castellans de les pàgines dels ens. */
const ENTITATS: Readonly<Record<string, string>> = {
  agrave: "à", aacute: "á", egrave: "è", eacute: "é", iacute: "í", iuml: "ï", ograve: "ò", oacute: "ó",
  uacute: "ú", uuml: "ü", ccedil: "ç", ntilde: "ñ", middot: "·",
  Agrave: "À", Aacute: "Á", Egrave: "È", Eacute: "É", Iacute: "Í", Iuml: "Ï", Ograve: "Ò", Oacute: "Ó",
  Uacute: "Ú", Uuml: "Ü", Ccedil: "Ç", Ntilde: "Ñ",
};

/** El text d'un tros d'HTML: sense etiquetes, amb les entitats desfetes i els espais plegats. */
export function textDeHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&([A-Za-z]+);/g, (tot, nom: string) => ENTITATS[nom] ?? tot)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&(rsquo|lsquo|#39|#x27|apos);/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

/** El que la pàgina de l'ens diu d'un membre: el grup amb què hi seu i de quin ajuntament és. */
export type FitxaEns = {
  nom: string;
  /** El grup o el partit tal com l'escriu l'ens («Junts x Catalunya», «Grup del PSC»). */
  grup: string | null;
  /** El municipi del càrrec municipal («Gavà», «l'Hospitalet de Llobregat»), si en diu. */
  municipi: string | null;
  /** Cert si el càrrec municipal és l'alcaldia; `null` si la fitxa no en diu res. */
  alcaldia: boolean | null;
  /** Cert si el càrrec municipal és en femení («Regidora», «Alcaldessa»); `null` si no se sap. */
  femeni?: boolean | null;
};

/** Els diputats de la pàgina del ple de diba.cat, amb l'adreça absoluta de la seva fitxa. */
export function enllacosPleDiba(html: string): { nom: string; url: string }[] {
  const vistos = new Set<string>();
  const sortida: { nom: string; url: string }[] = [];
  for (const m of html.matchAll(/href="((?:https:\/\/www\.diba\.cat)?\/(?:ca\/)?web\/ladiputacio\/-\/[^"#?]+)"[^>]*>([^<]+)</g)) {
    const nom = textDeHtml(m[2]!);
    const url = m[1]!.startsWith("http") ? m[1]! : `https://www.diba.cat${m[1]!}`;
    if (!nom || vistos.has(url)) continue;
    vistos.add(url);
    sortida.push({ nom, url });
  }
  return sortida;
}

/**
 * El municipi i l'alcaldia d'un «càrrec municipal» de diba.cat: «Alcaldessa de
 * Gavà», «Alcalde d’Alella», «Regidor de Sant Cugat del Vallès - tinent
 * d'alcalde». El que va després del guió és un càrrec dins l'ajuntament, no
 * part del nom. Si el text no comença per alcalde o regidor, no se'n treu res.
 */
export function municipiDeCarrec(
  carrec: string | null,
): { municipi: string | null; alcaldia: boolean | null; femeni: boolean | null } {
  const text = (carrec ?? "").replace(/[’`]/g, "'").trim();
  const m = text.match(/^(alcalde|alcaldessa|regidor|regidora)\s+(?:de\s+|d')(.+)$/i);
  if (!m) return { municipi: null, alcaldia: null, femeni: null };
  const municipi = m[2]!.split(/\s+-\s+/)[0]!.trim();
  return { municipi: municipi || null, alcaldia: /^alcalde/i.test(m[1]!), femeni: /^(alcaldessa|regidora)$/i.test(m[1]!) };
}

/**
 * Si un càrrec municipal és en femení («Regidora», «Alcaldessa», «Tinenta
 * d'alcalde»), en masculí, o no ho diu. Serveix per escriure «Diputada» o
 * «Diputat» on la font de l'ens escriu «Diputat/da».
 */
export function femeniDelCarrec(carrec: string | null): boolean | null {
  const n = normalize(carrec ?? "");
  if (/^(regidora|alcaldessa|tinenta|presidenta|consellera)\b/.test(n)) return true;
  if (/^(regidor|alcalde|tinent|president|conseller)\b/.test(n)) return false;
  return null;
}

/**
 * El càrrec que es mostra per a un membre d'una diputació quan la font en dona
 * un de genèric. La Diputació de Barcelona escriu «Diputat/da» a 50 dels 51
 * (és el nom del tram retributiu), i el registre de plens escriu «Conseller/a»
 * a 20 dels 25 membres de la de Lleida, que no té consellers. Si el càrrec és
 * un d'aquests, es diu «Diputat» o «Diputada» segons el càrrec municipal de la
 * persona (regidor/a, alcalde/ssa), i «Membre del ple» si no se'n sap el
 * gènere; qualsevol altre càrrec («Vicepresidenta segona») es queda literal.
 */
export function carrecDeDiputacio(carrec: string, femeni: boolean | null): string {
  if (!/^(diputat\/?d?a?|diputat\/da|conseller\/?a?|consellera|conseller|membre)$/i.test(carrec.trim())) return carrec;
  if (femeni === null) return "Membre del ple";
  return femeni ? "Diputada" : "Diputat";
}

/**
 * La fitxa biogràfica d'un diputat de Barcelona: el nom, el «Partit polític»
 * i el «Càrrec municipal». El partit és el del grup on seu **avui** (per
 * exemple «Junts per Igualada» per a qui va sortir de la llista de Junts), i per
 * això a `completaMembre` només s'hi recorre si el ple municipal no ho diu.
 */
export function llegeixFitxaDiba(html: string): FitxaEns | null {
  const nom = html.match(/<p class="nomDiputat">([\s\S]*?)<\/p>/)?.[1];
  if (!nom) return null;
  const camp = (etiqueta: string): string | null => {
    const re = new RegExp(`<strong>\\s*${etiqueta}:?\\s*</strong>([\\s\\S]*?)</p>`, "i");
    const valor = html.match(re)?.[1];
    return valor ? textDeHtml(valor) || null : null;
  };
  const { municipi, alcaldia, femeni } = municipiDeCarrec(camp("Càrrec municipal"));
  return { nom: textDeHtml(nom), grup: camp("Partit polític"), municipi, alcaldia, femeni };
}

/**
 * El nom d'un grup de ddgi.cat sense l'embolcall: «Grup de Junts per Catalunya
 * a la Diputació de Girona - CM» → «Junts per Catalunya - CM», «Grup d'ERC a
 * la Diputació de Girona» → «ERC», «Grup CUP - Som Poble» → «CUP - Som Poble».
 * Així `partitComparable` en sap treure la família.
 */
export function etiquetaDeGrup(titol: string): string {
  return titol
    .replace(/[’`]/g, "'")
    .replace(/^grup\s+(?:dels?\s+|de\s+la\s+|de\s+|d')?/i, "")
    .replace(/\s+a\s+la\s+diputaci[óo]\s+de\s+\S+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Els grups de la pàgina de ddgi.cat, amb els noms sense el tractament («Il·lm.
 * Sr.», «Hble. Sra.»). Els membres són els `<li>` amb un enllaç a la fitxa de
 * la primera llista de cada grup; les de «President de grup» o «Portaveu», les
 * xarxes i el peu de pàgina que ve després de l'últim grup no són persones.
 */
export function llegeixGrupsDdgi(html: string): FitxaEns[] {
  const sortida: FitxaEns[] = [];
  const trossos = html.split(/<h2[^>]*>/i).slice(1);
  for (const tros of trossos) {
    const titol = textDeHtml(tros.split(/<\/h2>/i)[0] ?? "");
    if (!/^grup\b/i.test(titol)) continue;
    const grup = etiquetaDeGrup(titol);
    // Els membres són la primera llista del grup; les següents són els càrrecs
    // del grup, els enllaços a les xarxes i, després de l'últim, el peu de pàgina.
    const membres = tros.match(/<ul[^>]*>([\s\S]*?)<\/ul>/i)?.[1] ?? "";
    for (const m of membres.matchAll(/<li>\s*<a [^>]*>([^<]+)<\/a>\s*<\/li>/g)) {
      const nom = textDeHtml(m[1]!).replace(/^(?:(?:Il·l?m[ao]?|Il·ltre|Il·lustre|Hble|Excm[ao]?|Molt Hble)\.?\s+)?(?:Sr|Sra)\.?\s+/i, "");
      if (nom) sortida.push({ nom, grup, municipi: null, alcaldia: null });
    }
  }
  return sortida;
}

/**
 * Si dos noms comparteixen els dos cognoms. Els trossos es comparen
 * normalitzats, i un pot ser l'inici de l'altre si en fa almenys quatre lletres
 * («Solé» i «Soler» a les dues pàgines de la mateixa Diputació). El nom de pila
 * no es mira a posta: la Diputació de Barcelona escriu «Filo», «Xesco» o «Javi»
 * on el ple municipal diu «Filomena», «Francesc Xavier» o «Javier». Per això
 * només es fa servir dins d'un conjunt petit i ja acotat —els 51 diputats, o el
 * ple d'un sol municipi que la mateixa Diputació diu que és el seu— i només si
 * l'aparellament hi és únic.
 */
export function cognomsLliguen(a: string, b: string): boolean {
  const ta = normalizePersonName(nomDret(a)).split(" ").filter(Boolean);
  const tb = normalizePersonName(nomDret(b)).split(" ").filter(Boolean);
  if (ta.length < 2 || tb.length < 2) return false;
  const iguals = (x: string, y: string): boolean =>
    x === y || (Math.min(x.length, y.length) >= 4 && (x.startsWith(y) || y.startsWith(x)));
  return iguals(ta.at(-1)!, tb.at(-1)!) && iguals(ta.at(-2)!, tb.at(-2)!);
}

/** L'única fitxa que és aquesta persona: pel nom, per inicials o, si no, pels dos cognoms. */
function fitxaUnica<F extends { nom: string }>(nom: string, fitxes: readonly F[]): F | null {
  for (const prova of [mateixaPersona, cognomsLliguen]) {
    const iguals = fitxes.filter((f) => prova(f.nom, nom));
    if (iguals.length === 1) return iguals[0]!;
    if (iguals.length > 1) return null;
  }
  return null;
}

/**
 * Posa a cada membre llegit el que en diu la pàgina de grups de l'ens: el grup
 * (`grupALEns`), el municipi (com a `municipiRepresenta`, si la font principal
 * no en dona cap), l'alcaldia i el nom tal com l'escriu aquesta pàgina, per si
 * lliga millor amb el ple municipal. Un membre només rep una fitxa si
 * l'aparellament és únic **en tots dos sentits**: si dues persones de la llista
 * reclamen la mateixa fitxa, no és de cap.
 */
export function uneixFitxes(llegits: readonly MembreLlegit[], fitxes: readonly FitxaEns[]): { llegits: MembreLlegit[]; lligats: number } {
  const triades = llegits.map((l) => fitxaUnica(l.nom, fitxes));
  const vegades = new Map<FitxaEns, number>();
  for (const f of triades) if (f) vegades.set(f, (vegades.get(f) ?? 0) + 1);
  let lligats = 0;
  const sortida = llegits.map((l, i) => {
    const f = triades[i];
    if (!f || vegades.get(f) !== 1) return l;
    lligats += 1;
    return {
      ...l,
      municipiRepresenta: l.municipiRepresenta ?? f.municipi,
      grupALEns: f.grup,
      alcaldiaALEns: f.alcaldia,
      femeniALEns: f.femeni ?? null,
      nomsAlternatius: f.nom !== l.nom ? [f.nom] : [],
    };
  });
  return { llegits: sortida, lligats };
}

// ─────────────────────────────────────────────────────────────────────────────
// Funcions pures: els comptes
// ─────────────────────────────────────────────────────────────────────────────

/** Una fila de la liquidació per capítols, ja agrupada per ens, any, partida i capítol. */
export type FilaCapitol = {
  CODI_ENS: string | number;
  ANY_EXERCICI: string | number;
  TIPUS_PARTIDA: string;
  CODI_CAPITOL: string | number;
  liquidat: string | number | null;
  pressupostat: string | number | null;
};

/**
 * Plega la liquidació en anys de capítols, per ens.
 *
 * Cada any que té alguna fila surt amb **els nou capítols de cada banda**, i el
 * que la font no porta hi va amb `null`: un capítol 5 de despesa absent abans
 * del 2013 (el fons de contingència no existia) no és un fons de zero euros. Un
 * any sense cap fila no hi és, perquè no hi ha res a dir-ne.
 */
export function plegaCapitols(files: readonly FilaCapitol[]): Map<string, { any: number; capitols: CapitolDesat[] }[]> {
  const perEns = new Map<string, Map<number, Map<string, { liquidat: number | null; pressupostat: number | null }>>>();
  for (const f of files) {
    const any = Number(f.ANY_EXERCICI);
    const capitol = Number(f.CODI_CAPITOL);
    const partida = String(f.TIPUS_PARTIDA).trim().toUpperCase();
    if (!Number.isInteger(any) || !Number.isInteger(capitol) || capitol < 1 || capitol > 9) continue;
    if (partida !== "I" && partida !== "D") continue;
    const codi = codi10(f.CODI_ENS);
    const anys = perEns.get(codi) ?? new Map();
    perEns.set(codi, anys);
    const partides = anys.get(any) ?? new Map();
    anys.set(any, partides);
    const clau = `${partida}${capitol}`;
    const abans = partides.get(clau);
    const suma = (x: number | null, y: number | null): number | null => (x === null ? y : y === null ? x : x + y);
    partides.set(clau, {
      liquidat: suma(abans?.liquidat ?? null, euros(f.liquidat)),
      pressupostat: suma(abans?.pressupostat ?? null, euros(f.pressupostat)),
    });
  }

  const fora = new Map<string, { any: number; capitols: CapitolDesat[] }[]>();
  for (const [codi, anys] of perEns) {
    const llista = [...anys.entries()]
      .sort(([a], [b]) => a - b)
      .map(([any, partides]) => {
        const capitols: CapitolDesat[] = [];
        for (const [tipus, lletra] of [["ingressos", "I"], ["despeses", "D"]] as const) {
          for (let capitol = 1; capitol <= 9; capitol += 1) {
            const v = partides.get(`${lletra}${capitol}`);
            capitols.push({
              tipus,
              capitol,
              nom: NOMS_CAPITOLS[tipus][capitol]!,
              liquidat: v?.liquidat ?? null,
              pressupostat: v?.pressupostat ?? null,
            });
          }
        }
        return { any, capitols };
      });
    fora.set(codi, llista);
  }
  return fora;
}

/** Una fila de la despesa per programes (classificació funcional, nivells 1 i 2). */
export type FilaPrograma = {
  CODI_ENS: string | number;
  ANY_EXERCICI: string | number;
  NIVELL: string | number;
  ESTRUCTURA: string | number;
  DESCRIPCIO: string | null;
  IMPORT_DRET_OBLIG: string | number | null;
};

/**
 * La despesa per programes de l'**últim exercici** que cada ens té.
 *
 * Nivell 1 (àrea de despesa) i nivell 2 (política de despesa), que sumen el
 * mateix total cadascun (comprovat a la J15). Si un codi surt repetit dins del
 * mateix any i nivell, s'hi sumen les obligacions; el nom és el primer que
 * apareix. Ordenat per codi, que és com l'ordena la mateixa estructura.
 */
export function plegaProgrames(files: readonly FilaPrograma[]): Map<string, { any: number; files: ProgramaDesat[] }> {
  const perEns = new Map<string, Map<number, Map<string, ProgramaDesat>>>();
  for (const f of files) {
    const any = Number(f.ANY_EXERCICI);
    const nivell = Number(f.NIVELL);
    const codiPrograma = valorNet(f.ESTRUCTURA);
    if (!Number.isInteger(any) || (nivell !== 1 && nivell !== 2) || !codiPrograma) continue;
    const codi = codi10(f.CODI_ENS);
    const anys = perEns.get(codi) ?? new Map();
    perEns.set(codi, anys);
    const linies = anys.get(any) ?? new Map();
    anys.set(any, linies);
    const clau = `${nivell}|${codiPrograma}`;
    const import_ = euros(f.IMPORT_DRET_OBLIG);
    const abans = linies.get(clau);
    if (abans) {
      abans.obligacions = abans.obligacions === null ? import_ : import_ === null ? abans.obligacions : abans.obligacions + import_;
    } else {
      linies.set(clau, { codi: codiPrograma, nom: valorNet(f.DESCRIPCIO) ?? codiPrograma, nivell, obligacions: import_ });
    }
  }

  const fora = new Map<string, { any: number; files: ProgramaDesat[] }>();
  for (const [codi, anys] of perEns) {
    const any = Math.max(...anys.keys());
    const linies = [...anys.get(any)!.values()].sort(
      (a, b) => a.nivell - b.nivell || a.codi.localeCompare(b.codi, "ca", { numeric: true }),
    );
    fora.set(codi, { any, files: linies });
  }
  return fora;
}

/** El deute viu a 31 de desembre, per ens i any. Un buit no és «sense deute». */
export function plegaDeute(
  files: readonly { CODI_ENS: string | number; ANY: string | number; DEUTE_VIU: string | number | null }[],
): Map<string, { any: number; deuteViu: number }[]> {
  const fora = new Map<string, { any: number; deuteViu: number }[]>();
  for (const f of files) {
    const any = Number(f.ANY);
    const deuteViu = euros(f.DEUTE_VIU);
    if (!Number.isInteger(any) || deuteViu === null) continue;
    const codi = codi10(f.CODI_ENS);
    // Un any repetit és una correcció de la font: mana l'última fila que arriba.
    const llista = (fora.get(codi) ?? []).filter((d) => d.any !== any);
    llista.push({ any, deuteViu });
    fora.set(codi, llista);
  }
  for (const llista of fora.values()) llista.sort((a, b) => a.any - b.any);
  return fora;
}

// ─────────────────────────────────────────────────────────────────────────────
// Funcions pures: territori, districtes i escut
// ─────────────────────────────────────────────────────────────────────────────

/** Una fila de `ehvx-5ty7`, amb només el que aquesta feina en fa servir. */
export type FilaTerritori = {
  codi_10: string;
  nom_article?: string;
  codi_comarca?: string;
  codi_provincia?: string;
  partit_electoral?: string;
  /** El partit judicial d'avui; només serveix per refer el districte de Solsona. */
  partit_judicial?: string;
};

/** Codi d'ens de la Diputació de Lleida, que és el `codi_provincia` dels seus municipis. */
const PROVINCIA_LLEIDA = "8002550006";
/** Codis de comarca d'`ehvx-5ty7` que fan de districte sencer a Lleida. */
const COMARCA_GARRIGUES = "8101890004";
const COMARCA_PALLARS_SOBIRA = "8102650006";

/**
 * El districte electoral d'un municipi per a la diputació (LOREG 204.3: els
 * partits judicials de les locals del 1979).
 *
 * A Barcelona, Girona i Tarragona és la columna `partit_electoral`
 * d'`ehvx-5ty7`. **A Lleida aquesta columna no serveix**: en dona sis
 * (Lleida, Balaguer, Cervera, la Seu d'Urgell, Tremp, Vielha), i el 1979 n'hi
 * havia nou. La Junta Electoral del 2023 va repartir Lleida 13, Balaguer 3,
 * Cervera 3 i un a cadascun de la Seu d'Urgell, les Borges Blanques, Solsona,
 * Sort, Tremp i Vielha (premsa del 30-5-2023; vegeu el comentari de
 * `derive/escons-ens.ts`), i amb els sis el càlcul no reprodueix el ple. Els
 * tres que falten es refan així, que és la correspondència que dona
 * exactament el ple de Lleida amb els vots del 2023:
 *
 *   · **Solsona** = els municipis del partit judicial actual de Solsona
 *     (`partit_judicial`), que `partit_electoral` reparteix entre la Seu,
 *     Balaguer i Cervera.
 *   · **les Borges Blanques** = la comarca de les Garrigues.
 *   · **Sort** = la comarca del Pallars Sobirà.
 */
export function districteElectoral(f: FilaTerritori): string | null {
  const electoral = valorNet(f.partit_electoral);
  if (!f.codi_provincia || codi10(f.codi_provincia) !== PROVINCIA_LLEIDA) return electoral;
  if (valorNet(f.partit_judicial) === "Solsona") return "Solsona";
  const comarca = f.codi_comarca ? codi10(f.codi_comarca) : null;
  if (comarca === COMARCA_GARRIGUES) return "les Borges Blanques";
  if (comarca === COMARCA_PALLARS_SOBIRA) return "Sort";
  return electoral;
}

/**
 * Els districtes electorals de cada diputació: municipis agrupats pel seu
 * districte (`districteElectoral`: els partits judicials del 1979, LOREG art. 204.3) dins de
 * la província. La clau és el codi d'ens de la diputació, que és el
 * `codi_provincia` de la mateixa fila. Un municipi que no es pot lligar amb la
 * nostra base o que no té districte no s'hi posa: el comptarà qui el trobi a
 * faltar, no un districte inventat.
 */
export function agrupaDistrictes(
  files: readonly FilaTerritori[],
  resol: (codi: string) => number | undefined,
): Map<string, { nom: string; municipalityIds: number[] }[]> {
  const perProvincia = new Map<string, Map<string, Set<number>>>();
  for (const f of files) {
    const districte = districteElectoral(f);
    const provincia = valorNet(f.codi_provincia);
    const municipalityId = resol(codi10(f.codi_10));
    if (!districte || !provincia || municipalityId === undefined) continue;
    const districtes = perProvincia.get(codi10(provincia)) ?? new Map<string, Set<number>>();
    perProvincia.set(codi10(provincia), districtes);
    const ids = districtes.get(districte) ?? new Set<number>();
    ids.add(municipalityId);
    districtes.set(districte, ids);
  }
  const fora = new Map<string, { nom: string; municipalityIds: number[] }[]>();
  for (const [provincia, districtes] of perProvincia) {
    fora.set(
      provincia,
      [...districtes.entries()]
        .map(([nom, ids]) => ({ nom, municipalityIds: [...ids].sort((a, b) => a - b) }))
        .sort((a, b) => a.nom.localeCompare(b.nom, "ca")),
    );
  }
  return fora;
}

/** Una fila de `2zbw-miu8`. */
export type FilaSimbol = { codi_10: string; tipus_simbol?: string; url_imatge_simbol?: { url?: string } | string };

/**
 * L'escut de cada ens, o l'emblema si no en té. Les banderes no: no fan de
 * segell. L'adreça es passa a `https`, que el servidor del Municat serveix igual
 * (comprovat el 27-10-2026) i que una pàgina segura no bloqueja.
 */
export function triaEscuts(files: readonly FilaSimbol[]): Map<string, string> {
  const prioritat = (tipus: string): number => (tipus === "escut" ? 0 : tipus === "emblema" ? 1 : 9);
  const millors = new Map<string, { url: string; p: number }>();
  for (const f of files) {
    const p = prioritat(normalize(f.tipus_simbol ?? ""));
    const cru = typeof f.url_imatge_simbol === "string" ? f.url_imatge_simbol : f.url_imatge_simbol?.url;
    const url = valorNet(cru);
    if (p === 9 || !url) continue;
    const codi = codi10(f.codi_10);
    const abans = millors.get(codi);
    if (!abans || p < abans.p) millors.set(codi, { url: url.replace(/^http:\/\//i, "https://"), p });
  }
  return new Map([...millors.entries()].map(([codi, { url }]) => [codi, url]));
}

// ─────────────────────────────────────────────────────────────────────────────
// Lectura de les fonts
// ─────────────────────────────────────────────────────────────────────────────

type FilaPle = {
  codi_10: string;
  nom_ens: string;
  tipus_ens: string;
  nom?: string;
  carrec?: string;
  partit_politic?: string;
  municipi_representa?: string;
  ordre?: string;
};

type FilaRegistre = {
  codi_ens: string;
  nomtipus: string;
  nom_complert: string;
  president?: string;
  cif?: string;
  codi_municipi?: string;
  comarca?: string;
  provincia?: string;
  web?: string;
  gerent?: string;
  municat?: { url?: string };
  article?: string;
  dissolt?: string;
};

const FONT_CAPITOLS = {
  nom: "Liquidació del pressupost (execució per capítols), Consorci AOC",
  url: "https://dadesobertes.seu-e.cat/dataset/liquidacio-del-pressupost-execucio-per-capitols",
};
const FONT_PROGRAMES = {
  nom: "Liquidació del pressupost (econòmic i per programes), Consorci AOC",
  url: "https://dadesobertes.seu-e.cat/dataset/ge-p-liquidacions-per-programes-detallat",
};
const FONT_DEUTE = { nom: "Endeutament, Consorci AOC", url: "https://dadesobertes.seu-e.cat/dataset/ge-ge-endeutament" };

type Comptes = {
  capitols: Map<string, { any: number; capitols: CapitolDesat[] }[]>;
  programes: Map<string, { any: number; files: ProgramaDesat[] }>;
  deute: Map<string, { any: number; deuteViu: number }[]>;
};

/** Una consulta a CKAN que, si falla, deixa una incidència i torna buit. */
async function consultaCkan<T>(sql: string, que: string, run: Run): Promise<T[]> {
  await sleep(PAUSA_MS);
  try {
    const files = await ckanSql<T>(sql);
    if (files.length >= SOSTRE_CKAN) {
      await run.issue({
        kind: "ckan_row_cap",
        severity: "alta",
        entity: que,
        detail: { files: files.length, efecte: "la consulta toca el sostre silenciós de CKAN: pot ser incompleta" },
      });
    }
    return files;
  } catch (error) {
    await run.issue({
      kind: "ens_comptes_inaccessibles",
      severity: "alta",
      entity: que,
      detail: { error: String(error), efecte: "aquest tros dels comptes no es desa: queda com a buit, no com a zero" },
    });
    return [];
  }
}

/**
 * Els comptes dels ens, en poques consultes agregades: una per exercici de la
 * liquidació per capítols (com la J6, per no acostar-se mai al sostre de CKAN),
 * una per als últims exercicis de programes i una per al deute.
 *
 * `CODI_ENS` és numèric a tots tres conjunts; els codis de les diputacions
 * (80…) i dels consells (81…) no comencen per zero i van tal qual.
 */
async function llegeixComptes(codis: readonly string[], run: Run): Promise<Comptes> {
  const llista = codis.map((c) => String(Number(c))).join(",");

  const capitols: FilaCapitol[] = [];
  for (let any = PRIMER_ANY; any <= ULTIM_ANY; any += 1) {
    capitols.push(
      ...(await consultaCkan<FilaCapitol>(
        `SELECT "CODI_ENS", "ANY_EXERCICI", "TIPUS_PARTIDA", "CODI_CAPITOL",
                SUM("IMPORT_LIQUIDAT") AS liquidat, SUM("IMPORT_PRESSU_FINAL") AS pressupostat
         FROM "${LIQUIDACIO_CAPITOLS}" WHERE "ANY_EXERCICI" = ${any} AND "CODI_ENS" IN (${llista})
         GROUP BY "CODI_ENS", "ANY_EXERCICI", "TIPUS_PARTIDA", "CODI_CAPITOL"`,
        `liquidació per capítols ${any}`,
        run,
      )),
    );
  }

  // Al conjunt de programes l'exercici i el nivell són text: van entre cometes.
  const desDe = ULTIM_ANY - ANYS_PROGRAMES + 1;
  const programes = await consultaCkan<FilaPrograma>(
    `SELECT "CODI_ENS", "ANY_EXERCICI", "NIVELL", "ESTRUCTURA", "DESCRIPCIO", "IMPORT_DRET_OBLIG"
     FROM "${LIQUIDACIO_PROGRAMES}"
     WHERE "TIPUS_CLASSIF" = 'F' AND "TIPUS_PARTIDA" = 'D' AND "NIVELL" IN ('1', '2')
       AND "ANY_EXERCICI" >= '${desDe}' AND "CODI_ENS" IN (${llista})`,
    `despesa per programes ${desDe}-${ULTIM_ANY}`,
    run,
  );

  const deute = await consultaCkan<{ CODI_ENS: string; ANY: string; DEUTE_VIU: string | null }>(
    `SELECT "CODI_ENS", "ANY", "DEUTE_VIU" FROM "${DEUTE_VIU}"
     WHERE "ANY" >= ${PRIMER_ANY} AND "CODI_ENS" IN (${llista})`,
    "deute viu",
    run,
  );

  run.rowsIn += capitols.length + programes.length + deute.length;
  run.say(`${capitols.length} files de capítols, ${programes.length} de programes i ${deute.length} de deute`);
  return { capitols: plegaCapitols(capitols), programes: plegaProgrames(programes), deute: plegaDeute(deute) };
}

/** Els comptes d'un ens amb la forma del contracte, o `null` si l'AOC no en té res. */
function financesDe(codi: string, comptes: Comptes, consultat: string): FinancesDesades | null {
  const anys = comptes.capitols.get(codi) ?? [];
  const programes = comptes.programes.get(codi) ?? null;
  const deute = comptes.deute.get(codi) ?? [];
  if (anys.length === 0 && programes === null && deute.length === 0) return null;
  const fonts: FontEns[] = [];
  const font = (f: { nom: string; url: string }): FontEns => ({ ...f, llicencia: LLICENCIA_AOC, consultat });
  if (anys.length > 0) fonts.push(font(FONT_CAPITOLS));
  if (programes !== null) fonts.push(font(FONT_PROGRAMES));
  if (deute.length > 0) fonts.push(font(FONT_DEUTE));
  return { anys, programes, deute, fonts };
}

/**
 * Les fitxes dels 51 diputats de Barcelona: la pàgina del ple i, per a cada
 * nom, la seva fitxa biogràfica, d'on surten el grup i el càrrec municipal.
 * Són 52 pàgines i es demanen amb una pausa entre elles. Una fitxa que no
 * respon no atura res: aquell diputat es queda amb el que se'n sabia.
 */
async function fitxesDiba(run: Run): Promise<FitxaEns[] | null> {
  const ple = await fetchText(URL_PLE_DIBA).catch(() => null);
  const enllacos = ple && ple.status === 200 ? enllacosPleDiba(ple.html) : [];
  if (enllacos.length === 0) {
    await run.issue({
      kind: "diputacio_ple_illegible",
      severity: "mitjana",
      entity: "Diputació de Barcelona",
      detail: { url: URL_PLE_DIBA, efecte: "els diputats sense partit al ple municipal es queden sense partit" },
    });
    return null;
  }
  const fitxes: FitxaEns[] = [];
  let fallades = 0;
  for (const e of enllacos) {
    await sleep(PAUSA_MS);
    const resposta = await fetchText(e.url).catch(() => null);
    const fitxa = resposta && resposta.status === 200 ? llegeixFitxaDiba(resposta.html) : null;
    if (fitxa) fitxes.push(fitxa);
    else fallades += 1;
  }
  if (fallades > 0) {
    await run.issue({
      kind: "diputacio_fitxes_incompletes",
      severity: "baixa",
      entity: "Diputació de Barcelona",
      detail: { llegides: fitxes.length, fallades },
    });
  }
  return fitxes;
}

/** Els grups de la Diputació de Girona, de la seva pàgina de grups polítics. */
async function grupsDdgi(run: Run): Promise<FitxaEns[] | null> {
  const resposta = await fetchText(URL_GRUPS_DDGI).catch(() => null);
  const grups = resposta && resposta.status === 200 ? llegeixGrupsDdgi(resposta.html) : [];
  if (grups.length === 0) {
    await run.issue({
      kind: "diputacio_grups_illegibles",
      severity: "mitjana",
      entity: "Diputació de Girona",
      detail: { url: URL_GRUPS_DDGI, efecte: "els diputats sense partit al ple municipal es queden sense partit" },
    });
    return null;
  }
  return grups;
}

/**
 * Els noms de les dues diputacions que el registre de plens deixa en blanc,
 * llegits amb els lectors de la J24 (que ja deixen les seves incidències si la
 * pàgina no respon o ha canviat de forma), i el partit i el municipi de les
 * pàgines de grups de l'ens mateix.
 *
 * Per què la segona lectura: la Diputació de Barcelona escriu el nom de pila
 * familiar («Filo Cañete Carrillo», «Xesco Gomar Martín», «Javi Silva Pérez»)
 * i amb aquest nom no es troba ningú al ple municipal, i per tant tampoc el
 * partit. La fitxa de cada diputat a diba.cat diu el grup i de quin ajuntament
 * és regidor o alcalde, i amb el municipi a la mà ja es pot buscar la persona
 * al ple d'aquell sol municipi (`aparellaDinsDelMunicipi`). Girona no dona el
 * municipi, però sí el grup de cada diputat.
 */
async function membresDeLaSeu(
  ens: string,
  run: Run,
  consultat: string,
): Promise<{ llegits: MembreLlegit[]; fonts: FontEns[]; avis: string } | null> {
  if (ens === "Diputació de Barcelona") {
    const lectura = await llegeixBarcelona(run);
    if (!lectura || lectura.diputats.length === 0) return null;
    let llegits: MembreLlegit[] = lectura.diputats.map((d) => ({
      nom: nomDret(d.nom),
      carrec: carrecDeTram(d.carrec),
      ordre: null,
      partit: null,
      municipiRepresenta: null,
    }));
    const fonts: FontEns[] = [
      { nom: "Retribucions dels electes, Diputació de Barcelona", url: lectura.font.url, llicencia: LLICENCIA_DIBA, consultat },
    ];
    const fitxes = await fitxesDiba(run);
    if (fitxes) {
      const unio = uneixFitxes(llegits, fitxes);
      llegits = unio.llegits;
      fonts.push({ nom: "El Ple i les fitxes dels diputats, Diputació de Barcelona", url: URL_PLE_DIBA, llicencia: LLICENCIA_DIBA, consultat });
      run.say(`Diputació de Barcelona: ${unio.lligats} de ${llegits.length} diputats lligats amb la seva fitxa`);
    }
    return {
      llegits,
      fonts,
      avis:
        "El registre de plens de la Generalitat no publica els noms dels diputats de Barcelona. La llista surt de la " +
        "pàgina de retribucions de la mateixa Diputació, que agrupa els càrrecs per tram retributiu: hi consta qui " +
        "presideix, però no qui té cada vicepresidència. El municipi i el grup de cada diputat surten de la seva " +
        "fitxa al web de la Diputació quan no es poden saber pel ple municipal.",
    };
  }
  if (URL_ALTS_CARRECS[ens]) {
    const lectura = await llegeixTaula(ens, run);
    if (!lectura || lectura.diputats.length === 0) return null;
    let llegits: MembreLlegit[] = lectura.diputats.map((d) => ({
      nom: nomDret(d.nom),
      carrec: valorNet(d.carrec) ?? "Diputat/da",
      ordre: null,
      partit: null,
      municipiRepresenta: null,
    }));
    const fonts: FontEns[] = [
      { nom: `Retribucions dels alts càrrecs, ${ens}`, url: lectura.font.url, llicencia: LLICENCIA_SEUE, consultat },
    ];
    const grups = ens === "Diputació de Girona" ? await grupsDdgi(run) : null;
    if (grups) {
      const unio = uneixFitxes(llegits, grups);
      llegits = unio.llegits;
      fonts.push({ nom: "Grups polítics, Diputació de Girona", url: URL_GRUPS_DDGI, llicencia: null, consultat });
      run.say(`${ens}: ${unio.lligats} de ${llegits.length} diputats lligats amb el seu grup`);
    }
    return {
      llegits,
      fonts,
      avis:
        `El registre de plens de la Generalitat no publica els noms dels diputats de ${ens.replace(/^Diputació de /, "")}. ` +
        "La llista surt de la taula de retribucions dels alts càrrecs de la seu electrònica de la mateixa Diputació" +
        (grups ? ", i el grup de cada diputat, de la pàgina de grups polítics del seu web." : "."),
    };
  }
  return null;
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

// ─────────────────────────────────────────────────────────────────────────────
// La feina
// ─────────────────────────────────────────────────────────────────────────────

export async function j38EnsSupramunicipals(db: Db): Promise<void> {
  await withRun(db, "J38 fitxes dels ens supramunicipals", async (run) => {
    const consultat = avui();
    const perCodiEns = new Map<string, number>();
    const nomPerId = new Map<number, string>();
    for (const m of await db.select().from(municipalities)) {
      perCodiEns.set(m.codiEns, m.id);
      nomPerId.set(m.id, m.name);
    }
    const resol = (codi: unknown): number | undefined => perCodiEns.get(codi10(codi));

    // ── El registre de plens: els ens i els regidors de tots els municipis ──
    const plens = await socrataAll<FilaPle>(PLENS, {
      select: "codi_10,nom_ens,tipus_ens,nom,carrec,partit_politic,municipi_representa,ordre",
    });
    run.rowsIn += plens.length;
    const filesEns = new Map<string, FilaPle[]>();
    for (const f of plens) {
      if (f.tipus_ens !== "Comarques" && f.tipus_ens !== "Províncies") continue;
      const codi = codi10(f.codi_10);
      if (ENS_EXCLOSOS[codi]) continue;
      filesEns.set(codi, [...(filesEns.get(codi) ?? []), f]);
    }
    const vistos = new Set<string>();
    const regidors: RegidorActual[] = [];
    for (const f of plens) {
      const nom = valorNet(f.nom);
      const municipalityId = f.tipus_ens === "Municipis" ? resol(f.codi_10) : undefined;
      if (!nom || municipalityId === undefined) continue;
      // Una persona repetida al mateix ple és una fila duplicada, no dues persones.
      const clau = `${municipalityId}|${normalizePersonName(nom)}`;
      if (vistos.has(clau)) continue;
      vistos.add(clau);
      regidors.push({ nom, carrec: valorNet(f.carrec), partit: valorNet(f.partit_politic), municipalityId });
    }
    run.say(`${filesEns.size} ens amb ple al registre · ${regidors.length} regidors municipals per aparellar`);

    // ── Registre d'ens locals, territori i símbols ──
    await sleep(PAUSA_MS);
    const registre = new Map<string, FilaRegistre>();
    for (const f of await socrataAll<FilaRegistre>(DATASETS.ensLocals, {
      where: "nomtipus in ('Comarques','Províncies')",
    })) {
      registre.set(codi10(f.codi_ens), f);
    }
    await sleep(PAUSA_MS);
    const territori = await socrataAll<FilaTerritori>(MUNICIPIS_TERRITORI, {
      select: "codi_10,nom_article,codi_comarca,codi_provincia,partit_electoral,partit_judicial",
      where: "tipus_ens='Municipis'",
    });
    const districtes = agrupaDistrictes(territori, (codi) => resol(codi));
    const senseDistricte = territori.filter((f) => !valorNet(f.partit_electoral)).length;
    if (senseDistricte > 0) {
      await run.issue({
        kind: "municipi_sense_districte",
        severity: "baixa",
        entity: MUNICIPIS_TERRITORI,
        detail: { municipis: senseDistricte, efecte: "no compten a cap districte electoral de diputació" },
      });
    }
    const codis = [...filesEns.keys()].sort();
    await sleep(PAUSA_MS);
    const escuts = triaEscuts(
      await socrataAll<FilaSimbol>(SIMBOLS, {
        select: "codi_10,tipus_simbol,url_imatge_simbol",
        where: `codi_10 in (${codis.map((c) => `'${c}'`).join(",")})`,
      }),
    );
    run.say(`${territori.length} municipis amb territori · ${escuts.size} ens amb escut o emblema propi`);

    // ── Comptes ──
    const comptes = await llegeixComptes(codis, run);

    let desats = 0;
    let ambMunicipi = 0;
    let totalMembres = 0;
    const resum: string[] = [];

    for (const codi of codis) {
      const files = filesEns.get(codi)!;
      const reg = registre.get(codi);
      const nom = valorNet(reg?.nom_complert) ?? files[0]!.nom_ens;
      const tipus: TipusEns = files[0]!.tipus_ens === "Províncies" ? "diputacio" : "consell";
      if (reg && /^s/i.test(reg.dissolt ?? "")) continue;
      if (!reg) {
        await run.issue({ kind: "ens_sense_registre", severity: "mitjana", entity: nom, detail: { codi } });
      }

      // El territori de l'ens, per codis: comarca per als consells, província per a les diputacions.
      const municipis: MunicipiTerritori[] = [];
      for (const f of territori) {
        const delTerritori = tipus === "consell" ? f.codi_comarca : f.codi_provincia;
        const municipalityId = resol(f.codi_10);
        if (!delTerritori || municipalityId === undefined) continue;
        if (codi10(delTerritori) !== codi && !(tipus === "consell" && territoriDelMandat(codi, codi10(delTerritori)))) continue;
        municipis.push({
          municipalityId,
          noms: [valorNet(f.nom_article), nomPerId.get(municipalityId) ?? null].filter((n): n is string => n !== null),
        });
      }
      const delTerritori = new Set(municipis.map((m) => m.municipalityId));
      const regidorsTerritori = regidors.filter((r) => delTerritori.has(r.municipalityId));

      // ── Qui hi seu ──
      const fonts: FontEns[] = [
        { nom: "Dades generals dels ens locals, Generalitat de Catalunya", url: urlSocrata(DATASETS.ensLocals), llicencia: LLICENCIA_GENERALITAT, consultat },
        { nom: "Composició dels plens dels ens locals, Generalitat de Catalunya", url: urlSocrata(PLENS), llicencia: LLICENCIA_GENERALITAT, consultat },
        { nom: "Municipis de Catalunya: comarca, província i partit judicial, Generalitat de Catalunya", url: urlSocrata(MUNICIPIS_TERRITORI), llicencia: LLICENCIA_GENERALITAT, consultat },
      ];
      const avisos: string[] = [];
      const deduplicat = treuRepetits(
        files.map((f): FilaPleNeta => ({
          nom: valorNet(f.nom) ? nomDret(valorNet(f.nom)!) : null,
          carrec: valorNet(f.carrec) ?? (tipus === "diputacio" ? "Diputat/da" : "Conseller/a"),
          ordre: Number.isInteger(Number(f.ordre)) && valorNet(f.ordre) ? Number(f.ordre) : null,
          partit: valorNet(f.partit_politic),
          municipiRepresenta: valorNet(f.municipi_representa),
        })),
      );
      // Una persona escrita dues vegades no ocupa dos escons: els escons són
      // les files del registre menys les repetides.
      const seients = files.length - deduplicat.repetits.length;
      // Les files amb nom passen per l'aparellament; les que només porten el
      // partit (el Montsià) es desen com a escons d'aquell partit sense persona
      // (vegeu `NOM_NO_PUBLICAT`); les que no porten res són vacants.
      const separades = separaFilesDelPle(deduplicat.files);
      let llegits: MembreLlegit[] = separades.ambNom;
      let senseNom: FilaPleNeta[] = [];
      if (deduplicat.repetits.length > 0) {
        avisos.push(
          `El registre de plens escriu ${deduplicat.repetits.length === 1 ? "una persona" : `${deduplicat.repetits.length} persones`} ` +
            `dues vegades (${deduplicat.repetits.join(", ")}): aquí ${deduplicat.repetits.length === 1 ? "compta" : "compten"} ` +
            "com un sol escó cadascuna.",
        );
        await run.issue({
          kind: "ens_membre_repetit",
          severity: "mitjana",
          entity: nom,
          detail: { repetits: deduplicat.repetits, filesRegistre: files.length, seients },
        });
      }

      if (llegits.length === 0) {
        const seu = await membresDeLaSeu(nom, run, consultat);
        if (seu) {
          llegits = seu.llegits;
          fonts.push(...seu.fonts);
          avisos.push(seu.avis);
          if (llegits.length !== seients) {
            await run.issue({
              kind: "ens_recompte_diferent",
              severity: "mitjana",
              entity: nom,
              detail: { llegits: llegits.length, escons: seients, efecte: "la pàgina de l'ens no dona el ple sencer" },
            });
          }
        } else {
          // Sense la pàgina de l'ens, el partit dels escons sense nom és
          // l'única cosa que en sabem, i es queda.
          senseNom = separades.senseNom;
          avisos.push(
            `El registre de plens de la Generalitat no publica els noms dels membres d'aquest ple, i la pàgina de ` +
              `l'ens no s'ha pogut llegir: aquí només consten els ${seients} escons` +
              (senseNom.length > 0 ? `, ${senseNom.length} amb el partit.` : "."),
          );
        }
      } else {
        // Quan la font dona noms, els escons amb partit i sense nom completen el
        // ple. Quan no en dona cap (Barcelona, Girona), els noms surten de la
        // pàgina de l'ens i aquestes files no s'hi barregen: serien el mateix
        // escó dues vegades.
        senseNom = separades.senseNom;
        avisos.push(...avisosDeSeientsSenseNom(senseNom, separades.vacants));
      }

      let membres: MembreDesat[] = [];
      for (const llegit of llegits) {
        const { membre, ambigu } = completaMembre(llegit, municipis, regidorsTerritori, tipus);
        if (ambigu) {
          await run.issue({
            kind: "ens_membre_nom_ambigu",
            severity: "baixa",
            entity: `${nom} · ${llegit.nom}`,
            detail: { efecte: "el nom pot ser de més d'un regidor del territori: no se li atribueix cap municipi" },
          });
        }
        membres.push(membre);
      }
      for (const fila of senseNom) membres.push(seientSenseNom(fila, municipis, tipus));

      // ── Qui presideix ──
      if (membres.filter((m) => m.rol === "presidencia").length > 1 && URL_ALTS_CARRECS[nom]) {
        const taula = await llegeixTaula(nom, run);
        if (taula) {
          const correccio = corregeixCarrecs(membres, taula.diputats);
          if (correccio.corregits > 0) {
            membres = correccio.membres;
            fonts.push({ nom: `Retribucions dels alts càrrecs, ${nom}`, url: taula.font.url, llicencia: LLICENCIA_SEUE, consultat });
            avisos.push(
              `El càrrec de ${correccio.corregits} membres surt de la taula d'alts càrrecs de la seu electrònica de ` +
                "l'ens, perquè el registre de plens hi escriu la presidència de l'àrea que porten i no el càrrec al ple.",
            );
          }
        }
      }
      const presidencia = reconciliaPresidencia(membres, valorNet(reg?.president));
      membres = presidencia.membres.sort(ordreDelPle);
      if (presidencia.avis) avisos.push(presidencia.avis);
      if (presidencia.incidencia && membres.length > 0) {
        await run.issue({
          kind: `ens_presidencia_${presidencia.incidencia}`,
          severity: presidencia.incidencia === "discrepant" ? "baixa" : "mitjana",
          entity: nom,
          detail: {
            registreEnsLocals: valorNet(reg?.president),
            registrePlens: membres.filter((m) => m.rol === "presidencia").map((m) => m.nom),
          },
        });
      }

      // ── Comptes, districtes, escut ──
      const finances = financesDe(codi, comptes, consultat);
      if (finances) fonts.push(...finances.fonts);
      const districtesEns = tipus === "diputacio" ? (districtes.get(codi) ?? []) : null;
      if (districtesEns !== null && districtesEns.length === 0) {
        await run.issue({ kind: "diputacio_sense_districtes", severity: "alta", entity: nom, detail: { codi } });
      }
      const urlEscut = escuts.get(codi);
      const fontEscut: FontEns = {
        nom: "Símbols oficials dels ens locals de Catalunya, Generalitat de Catalunya",
        url: urlSocrata(SIMBOLS),
        llicencia: LLICENCIA_GENERALITAT,
        consultat,
      };
      if (urlEscut) fonts.push(fontEscut);
      const wikidata = tipus === "diputacio" ? (WIKIDATA_DIPUTACIONS[codi] ?? null) : null;
      if (wikidata) fonts.push({ nom: "Wikidata", url: `https://www.wikidata.org/wiki/${wikidata}`, llicencia: "CC0 1.0", consultat });

      const territoriNom =
        (tipus === "diputacio" ? valorNet(reg?.provincia) : valorNet(reg?.comarca)) ??
        nom.replace(/^(Diputació de |Consell Comarcal (de l'|de la |de les |del |de |d'))/, "");
      const gerent = valorNet(reg?.gerent);
      const ens: EnsDesat = {
        tipus,
        codiEns: codi,
        nom,
        territori: territoriNom,
        article: tipus === "consell" ? territoriAmbArticle(reg?.article, territoriNom) : null,
        seuMunicipalityId: reg?.codi_municipi ? (resol(reg.codi_municipi) ?? null) : null,
        cif: valorNet(reg?.cif),
        // «Sr. Vacant» és com el registre diu que no n'hi ha cap: un buit, no un nom.
        gerent: gerent && !/\bvacant\b/i.test(gerent) ? gerent : null,
        municat: valorNet(reg?.municat?.url),
        web: valorNet(reg?.web),
        seients,
        membres,
        finances,
        districtes: districtesEns,
        wikidata,
        escut: urlEscut ? { url: urlEscut, font: fontEscut } : null,
        fonts,
        avisos,
        consultat,
      };

      if (ens.seuMunicipalityId === null) {
        await run.issue({
          kind: "ens_sense_seu",
          severity: "alta",
          entity: nom,
          detail: { codiMunicipi: reg?.codi_municipi ?? null, efecte: "no es desa: no hi ha municipi on penjar la fitxa" },
        });
        continue;
      }
      await desa(db, ens.seuMunicipalityId, tipus === "diputacio" ? KIND_DIPUTACIO : KIND_CONSELL, ens);
      desats += 1;
      run.rowsOut += 1;
      totalMembres += membres.length;
      ambMunicipi += membres.filter((m) => m.municipalityId !== null).length;
      resum.push(
        `${nom}: ${membres.length}/${seients} membres` +
          (senseNom.length > 0 ? ` (${senseNom.length} sense nom, amb partit)` : "") +
          `, ${membres.filter((m) => m.municipalityId !== null).length} amb municipi, ` +
          `${finances ? finances.anys.length : 0} anys de comptes`,
      );
    }

    run.say(`${desats} ens desats · ${totalMembres} membres, ${ambMunicipi} amb el municipi lligat`);
    return { ens: desats, membres: totalMembres, ambMunicipi, detall: resum };
  });
}
