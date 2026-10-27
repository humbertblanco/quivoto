import { municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { socrataAll } from "../adapters/socrata";
import { sleep } from "../lib/http";
import { normalize } from "../lib/text";
import { withRun } from "../lib/run";
import { dataActualitzacioSocrata } from "./j46-habitatges-turistics";

/**
 * J45 — quan algú demana informació a l'ajuntament i no li la donen: les
 * reclamacions davant la GAIP (Comissió de Garantia del Dret d'Accés a la
 * Informació Pública) i les resolucions que l'ajuntament no va complir.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LES FONTS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   · `mpbu-t5zh`, **resolucions de la GAIP**: una fila per reclamació
 *     resolta des del 2015, amb l'administració reclamada, la data de la
 *     reclamació i de la resolució, el sentit, els dies que va trigar, l'àmbit,
 *     qui reclamava (no qui és: «Particular», «Electes», «Premsa»…) i
 *     l'enllaç al PDF. El 27-10-2026 eren 9.564 files de tipologia
 *     «Ajuntament», amb reclamacions fins al 18 de juliol del 2026.
 *   · `wrch-dn23`, **incompliments**: 253 resolucions que l'administració
 *     no va complir després que la GAIP li ho requerís, des del 2016.
 *
 * Cap de les dues porta cap codi de municipi: només el nom de
 * l'administració, escrit a mà. Vegeu `municipisDelNom()`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TRES TRAMPES DE LA FONT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   · **Les resolucions traduïdes surten dues vegades.** 652 files de
 *     tipologia «Ajuntament» són la versió castellana (`versi_es = CAST`) d'una
 *     reclamació que ja hi és en català, amb el mateix número i un altre PDF.
 *     Es compten un cop, per número de reclamació, i l'enllaç és el català.
 *     Una reclamació contra dos ajuntaments sí que compta a tots dos.
 *   · **«Pèrdua d'objecte» és el sentit més freqüent** (3.954 de 9.564). Vol
 *     dir que la reclamació es va tancar sense pronunciar-se perquè ja no hi
 *     havia res a resoldre, i el cas més habitual és que l'ajuntament hagi
 *     donat la informació un cop presentada la reclamació. No és ni una
 *     estimació ni una desestimació, i es compta a part.
 *   · **Una de cada cinc reclamacions la fa un electe** (2.064 de 9.564):
 *     sovint regidors de l'oposició que no aconsegueixen papers del govern
 *     municipal. Es desa qui reclama per condició, mai per nom; la font
 *     tampoc no en dona cap.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL QUE AQUESTA FEINA NO FA, A POSTA
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   · **No desa cap text lliure de la resolució.** Els camps `resum` i
 *     `informaci_reclamada` expliquen el cas i de vegades nomenen persones o
 *     empreses; `ponent` és el nom del membre de la GAIP. Ni es demanen a
 *     l'API. De cada reclamació es desa el número, les dates, el sentit,
 *     l'àmbit i l'enllaç al PDF oficial.
 *   · **No fa taxes per habitant.** Una ciutat gran rep moltes més
 *     sol·licituds d'informació que un poble, i la font no diu quantes en
 *     rep cada ajuntament. Reclamacions per 10.000 habitants no són
 *     comparables entre mides, i es desen els recomptes crus. Zero
 *     reclamacions tampoc no vol dir transparència perfecta: als pobles
 *     petits hi ha poques sol·licituds. La fitxa ho diu.
 *   · **No compta les reclamacions pendents.** El conjunt és de resolucions:
 *     el que s'ha reclamat i encara no s'ha resolt no hi és, i per això els
 *     darrers mesos sempre surten curts.
 *
 * El mandat és el que va començar amb la constitució dels ajuntaments el 17
 * de juny del 2023; l'anterior, del 15 de juny del 2019 al 16 de juny del
 * 2023. Una reclamació és del mandat en què es va presentar.
 */

export const DATASET_GAIP = "mpbu-t5zh";
export const DATASET_GAIP_INCOMPLIMENTS = "wrch-dn23";
export const KIND_GAIP = "gaip";

const LLICENCIA_GENCAT =
  "Condicions d'ús del portal de Dades Obertes de Catalunya: reutilització amb atribució i sense alterar el sentit";

export const FONTS_GAIP = {
  resolucions: {
    nom: "Resolucions de la Comissió de Garantia del Dret d'Accés a la Informació Pública (GAIP)",
    organisme: "GAIP",
    dataset: DATASET_GAIP,
    url: `https://analisi.transparenciacatalunya.cat/d/${DATASET_GAIP}`,
    llicencia: LLICENCIA_GENCAT,
  },
  incompliments: {
    nom: "Incompliments de resolucions de la GAIP",
    organisme: "GAIP",
    dataset: DATASET_GAIP_INCOMPLIMENTS,
    url: `https://analisi.transparenciacatalunya.cat/d/${DATASET_GAIP_INCOMPLIMENTS}`,
    llicencia: LLICENCIA_GENCAT,
  },
} as const;

/** Els dos mandats, per la data de la reclamació (ISO, tots dos dies inclosos). */
export const MANDATS_GAIP = {
  actual: { des: "2023-06-17", fins: null },
  anterior: { des: "2019-06-15", fins: "2023-06-16" },
} as const;

/** Quantes reclamacions recents es desen per municipi. */
export const MAX_RECENTS = 10;

// ─────────────────────────────────────────────────────────────────────────────
// El que es desa
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El sentit de la resolució, reduït. «Desestimació parcial» (una sola fila)
 * vol dir el mateix que «estimació parcial»: la GAIP dona la raó en part.
 */
export type SentitGaip =
  | "estimacio"
  | "estimacioParcial"
  | "desestimacio"
  | "inadmissio"
  | "perduaObjecte"
  | "mediacio"
  | "desistiment"
  | "altres";

export const SENTITS_GAIP: readonly SentitGaip[] = [
  "estimacio", "estimacioParcial", "desestimacio", "inadmissio", "perduaObjecte", "mediacio", "desistiment", "altres",
];

/** Qui reclamava, per condició (mai per nom). */
export type ReclamantGaip = "particular" | "electe" | "entitat" | "premsa" | "sindicat" | "empresa" | "altres";

export const RECLAMANTS_GAIP: readonly ReclamantGaip[] = [
  "particular", "electe", "entitat", "premsa", "sindicat", "empresa", "altres",
];

export type ResumGaip = {
  des: string;
  fins: string | null;
  reclamacions: number;
  sentit: Record<SentitGaip, number>;
  reclamant: Record<ReclamantGaip, number>;
  /** Mediana dels dies que la GAIP va trigar a resoldre; `null` sense cap reclamació. */
  medianaDies: number | null;
  /** Els tres àmbits amb més reclamacions («Urbanisme», «Personal»…). */
  ambits: { ambit: string; reclamacions: number }[];
};

export type ReclamacioGaip = {
  reclamacio: string;
  resolucio: string | null;
  dataReclamacio: string;
  dataResolucio: string | null;
  sentit: SentitGaip;
  /** El sentit tal com l'escriu la GAIP. */
  sentitText: string;
  ambit: string | null;
  reclamant: ReclamantGaip;
  dies: number | null;
  url: string | null;
};

export type IncomplimentGaip = {
  reclamacio: string;
  resolucio: string | null;
  dataResolucio: string | null;
  /** El dia que la GAIP va requerir a l'ajuntament que complís. */
  dataRequeriment: string | null;
  sentitText: string;
  url: string | null;
};

/** El que es desa a `municipality_metrics` amb `kind = "gaip"`. */
export type GaipMetric = {
  mandat: ResumGaip;
  anterior: ResumGaip;
  /** Totes les reclamacions resoltes des que la GAIP existeix. */
  total: { reclamacions: number; desDe: string | null };
  perAny: { any: number; reclamacions: number }[];
  /** Les més recents, per data de reclamació, la més nova primer. */
  recents: ReclamacioGaip[];
  incompliments: IncomplimentGaip[];
  /**
   * Referència de tots els ajuntaments el mateix mandat: no és un rànquing.
   * `ambits` són els cinc àmbits amb més reclamacions i contra quants
   * ajuntaments: el primer, el 27-10-2026, era «Protecció d'animals», amb més
   * de 1.000 reclamacions presentades sobretot la tardor del 2025 contra
   * centenars d'ajuntaments alhora. La fitxa ho diu perquè, en un poble
   * petit, aquella onada pot ser tot el que hi ha.
   */
  catalunya: {
    reclamacions: number;
    ajuntaments: number;
    estimades: number;
    ambits?: { ambit: string; reclamacions: number; ajuntaments: number }[];
  };
  /** La reclamació més nova de tot el conjunt: d'aquí ençà la font encara no hi és. */
  darreraReclamacioFont: string | null;
  fonts: { resolucions: FontGaip; incompliments: FontGaip };
  consultat: string;
};

export type FontGaip = (typeof FONTS_GAIP)[keyof typeof FONTS_GAIP] & { actualitzat: string | null };

// ─────────────────────────────────────────────────────────────────────────────
// Quin ajuntament és: el nom
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Els articles que es treuen del començament de la clau. Inclou l'aranès «es»
 * (es Bòrdes) i el salat «sa» i «s'», com `slugifyMunicipality`.
 */
const ARTICLES_INICIALS = new Set(["l", "el", "la", "els", "les", "es", "sa", "s"]);

/** Les preposicions que van entre «Ajuntament» i el nom: «de», «d'», «del», «dels». */
const PREPOSICIONS = new Set(["de", "d", "del", "dels"]);

/**
 * La clau d'un nom de municipi: sense accents, apòstrofs ni guionets, en
 * minúscules i sense l'article del davant. «l'Hospitalet de Llobregat»,
 * «L'HOSPITALET DE LLOBREGAT.» i «Hospitalet de Llobregat» donen
 * `hospitalet de llobregat`; «Palau-solità i Plegamans» i «Palau solità i
 * Plegamans», `palau solita i plegamans`.
 */
export function clauMunicipiGaip(nom: string): string {
  const mots = normalize(nom).replace(/-/g, " ").split(" ").filter(Boolean);
  if (mots.length > 1 && ARTICLES_INICIALS.has(mots[0]!)) mots.shift();
  return mots.join(" ");
}

/**
 * Noms que la GAIP escriu i que no són el nom oficial actual, ja en forma de
 * clau. Comprovats un a un el 27-10-2026 contra els 1.275 noms de la font i
 * el registre d'ens locals:
 *
 *   · Canvis de denominació: la Ràpita (2023), Calonge i Sant Antoni (2020),
 *     Bigues i Riells del Fai (2021), Palamós i Sant Joan, Masarac i
 *     Vilarnadal, Brunyola i Sant Martí Sapresa, Gimenells i el Pla de la
 *     Font, Cruïlles, Monells i Sant Sadurní de l'Heura. «calonge» sol és
 *     segur: «Calonge de Segarra» té la seva pròpia clau i mai no queda
 *     reduït a «calonge».
 *   · Noms curts d'ús corrent (Platja d'Aro, Vielha, Llavaneres).
 *   · Errors de picat que no admeten dubte («Alguire», «Calldetnes»,
 *     «Granyella de Segarra», «Sant Jaume de Lierca»…).
 *
 * No hi ha, a posta, els noms ambigus: «Vilanova», «Sant Cugat», «Barberà»,
 * «Torrelles», «l'Hospitalet» i «Pineda» poden ser més d'un municipi, i
 * aquelles files queden sense lligar. Tampoc les entitats municipals
 * descentralitzades (Jesús, Campredó, els Muntells), que no són municipi.
 */
export const ALIES_GAIP: ReadonlyMap<string, string> = new Map([
  ["sant carles de la rapita", "rapita"],
  ["bigues i riells", "bigues i riells del fai"],
  ["calonge", "calonge i sant antoni"],
  ["palamos", "palamos i sant joan"],
  ["masarac", "masarac i vilarnadal"],
  ["brunyola", "brunyola i sant marti sapresa"],
  ["gimenells", "gimenells i el pla de la font"],
  ["cruilles", "cruilles monells i sant sadurni de l heura"],
  ["platja d aro", "castell d aro platja d aro i s agaro"],
  ["castell platja d aro", "castell d aro platja d aro i s agaro"],
  ["castell platja aro", "castell d aro platja d aro i s agaro"],
  ["castell d aro", "castell d aro platja d aro i s agaro"],
  ["vielha", "vielha e mijaran"],
  ["naut d aran", "naut aran"],
  ["guils", "guils de cerdanya"],
  ["llavaneres", "sant andreu de llavaneres"],
  ["sant andreu llavaneres", "sant andreu de llavaneres"],
  ["vilaseca", "vila seca"],
  ["vilanova i geltru", "vilanova i la geltru"],
  ["vilanova de valles", "vilanova del valles"],
  ["mont roig de camp", "mont roig del camp"],
  ["cornella del llobregat", "cornella de llobregat"],
  ["sant adria del besos", "sant adria de besos"],
  ["san adria del besos", "sant adria de besos"],
  ["bisbal penedes", "bisbal del penedes"],
  ["lametlla del valles", "ametlla del valles"],
  ["atmella del valles", "ametlla del valles"],
  ["rupit pruit", "rupit i pruit"],
  ["torre de capdella", "torre de cabdella"],
  ["sant joan de les fonts", "sant joan les fonts"],
  ["san joan les fonts", "sant joan les fonts"],
  ["sant hilari de sacalm", "sant hilari sacalm"],
  ["sant esteve de sarga", "sant esteve de la sarga"],
  ["sant jaume del domenys", "sant jaume dels domenys"],
  ["sant jaume de lierca", "sant jaume de llierca"],
  ["sant fost de campcentelles", "sant fost de campsentelles"],
  ["st vicenc dels horts", "sant vicenc dels horts"],
  ["prats i sanso", "prats i sansor"],
  ["vila de menarguens", "menarguens"],
  ["cabassers", "cabaces"],
  ["alguire", "alguaire"],
  ["esplgugues de llobregat", "esplugues de llobregat"],
  ["calldetnes", "calldetenes"],
  ["cabrera der mar", "cabrera de mar"],
  ["granyella de segarra", "granyena de segarra"],
  ["avinoyet del penedes", "avinyonet del penedes"],
  ["torrefleta i florejacs", "torrefeta i florejacs"],
  ["sant pere sallavienra", "sant pere sallavinera"],
]);

/**
 * Un mot que vol dir «ajuntament», amb les faltes que hi ha a la font
 * («Ajumtament», «Ajunatment», «Ajuntamnet», «Ajutnament», «Ajuntaments»),
 * en castellà («Ayuntamiento») i la Paeria de Lleida i de Cervera.
 */
const MOT_AJUNTAMENT = /^(?:a[jy]u[a-z]{4,}|paeria)$/;

/** «ajuntamentde» enganxat: el separa en «ajuntament» i «de». */
const AJUNTAMENT_ENGANXAT = /^(a[jy]u[a-z]{4,}?(?:ment|miento))(de|del|dels)$/;

/** L'índex de claus: una clau que porta a més d'un municipi no es fa servir. */
export type IndexMunicipis = ReadonlyMap<string, readonly number[]>;

export function indexMunicipis(municipis: readonly { id: number; name: string }[]): IndexMunicipis {
  const index = new Map<string, number[]>();
  for (const m of municipis) {
    const clau = clauMunicipiGaip(m.name);
    index.set(clau, [...(index.get(clau) ?? []), m.id]);
  }
  return index;
}

/** Busca una clau, directa o per un àlies; només si porta a un sol municipi. */
function busca(clau: string, index: IndexMunicipis): number | null {
  const ids = index.get(clau) ?? index.get(ALIES_GAIP.get(clau) ?? "");
  return ids && ids.length === 1 ? ids[0]! : null;
}

/**
 * Els municipis d'un nom d'administració de la GAIP.
 *
 * Es busca cada aparició d'«Ajuntament» (o d'una de les seves faltes) i es
 * llegeix el que hi ha darrere fins a la següent: «Ajuntament d'Arbeca i
 * Ajuntament de la Floresta» són dos ajuntaments, i «ESPIMSA i Ajuntament de
 * Tarragona», «Policia Local de l'Ajuntament d'Igualada» o «CEE Montserrat
 * Montero (Ajuntament de Granollers)» en són un. Dels mots de darrere es
 * treu la preposició i es prova la tirada més llarga que sigui un municipi:
 * així «Ajuntament de Tarragona i ESPIMSA» és Tarragona, i «Sant Feliu de
 * Llobregat» no queda mai reduït a «Sant Feliu».
 *
 * Un nom sense cap «Ajuntament» (un institut municipal, una empresa
 * municipal, «IMHAB») no lliga: no s'endevina de quin ajuntament penja.
 */
export function municipisDelNom(nom: string, index: IndexMunicipis): number[] {
  const mots = normalize(nom)
    .split(" ")
    .flatMap((mot) => {
      const enganxat = AJUNTAMENT_ENGANXAT.exec(mot);
      return enganxat ? [enganxat[1]!, enganxat[2]!] : [mot];
    })
    .filter(Boolean);
  const trobats: number[] = [];
  for (let i = 0; i < mots.length; i += 1) {
    if (!MOT_AJUNTAMENT.test(mots[i]!)) continue;
    let fi = i + 1;
    while (fi < mots.length && !MOT_AJUNTAMENT.test(mots[fi]!)) fi += 1;
    let tros = mots.slice(i + 1, fi);
    if (tros.length > 0 && PREPOSICIONS.has(tros[0]!)) tros = tros.slice(1);
    for (let llarg = tros.length; llarg > 0; llarg -= 1) {
      const id = busca(clauMunicipiGaip(tros.slice(0, llarg).join(" ")), index);
      if (id !== null) {
        if (!trobats.includes(id)) trobats.push(id);
        break;
      }
    }
  }
  return trobats;
}

// ─────────────────────────────────────────────────────────────────────────────
// Les files tal com arriben, i com es llegeixen
// ─────────────────────────────────────────────────────────────────────────────

/** L'enllaç tal com el dona Socrata: `{ url }` o, de vegades, un text. */
type Enllac = { url?: string | null } | string | null | undefined;

/** Una fila de `mpbu-t5zh` amb només els camps que es demanen: cap text lliure. */
export type FilaGaip = {
  reclamaci?: string | null;
  resoluci?: string | null;
  data_de_reclamaci?: string | null;
  data_de_resoluci?: string | null;
  administraci_reclamada?: string | null;
  sentit_de_la_resoluci?: string | null;
  temps_trigat_en_resoldre?: string | null;
  mbits?: string | null;
  condici_reclamant?: string | null;
  versi_es?: string | null;
  url?: Enllac;
};

/** Els camps de `mpbu-t5zh` que es demanen. Ni `resum`, ni `informaci_reclamada`, ni `ponent`. */
export const CAMPS_GAIP = [
  "reclamaci", "resoluci", "data_de_reclamaci", "data_de_resoluci", "administraci_reclamada",
  "sentit_de_la_resoluci", "temps_trigat_en_resoldre", "mbits", "condici_reclamant", "versi_es", "url",
] as const;

/** Una fila de `wrch-dn23`. */
export type FilaIncompliment = {
  reclamacio?: string | null;
  resolucio?: string | null;
  data_reclamacio?: string | null;
  administracio_reclamada?: string | null;
  sentit_resolucio?: string | null;
  data_resolucio?: string | null;
  data_requeriment?: string | null;
  enllac?: Enllac;
};

/** «2024-01-26T00:00:00.000» → «2024-01-26», o `null`. */
export function dataIso(valor: unknown): string | null {
  const m = typeof valor === "string" ? /^(\d{4}-\d{2}-\d{2})/.exec(valor.trim()) : null;
  return m ? m[1]! : null;
}

export function urlDe(valor: Enllac): string | null {
  const text = typeof valor === "string" ? valor : valor?.url;
  return typeof text === "string" && /^https?:\/\//.test(text.trim()) ? text.trim() : null;
}

/** El sentit de la resolució, reduït (vegeu `SentitGaip`). */
export function sentitDe(text: unknown): SentitGaip {
  const t = normalize(String(text ?? ""));
  if (t === "estimacio") return "estimacio";
  if (t === "estimacio parcial" || t === "desestimacio parcial") return "estimacioParcial";
  if (t === "desestimacio") return "desestimacio";
  if (t.startsWith("inadmissio")) return "inadmissio";
  if (t.startsWith("perdua d objecte")) return "perduaObjecte";
  if (t.includes("mediacio")) return "mediacio";
  if (t.startsWith("desistiment")) return "desistiment";
  return "altres";
}

/** Qui reclamava, per la condició que en dona la font. */
export function reclamantDe(text: unknown): ReclamantGaip {
  const t = normalize(String(text ?? ""));
  if (t === "particular") return "particular";
  if (t.startsWith("electe")) return "electe";
  if (t.startsWith("entitats")) return "entitat";
  if (t === "premsa") return "premsa";
  if (t.startsWith("sindicats")) return "sindicat";
  if (t.startsWith("empresa")) return "empresa";
  return "altres";
}

/** Els dies que va trigar la GAIP, si són un enter raonable (0-2.000). */
function dies(valor: unknown): number | null {
  const text = String(valor ?? "").trim();
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return n <= 2_000 ? n : null;
}

/** Una fila de la GAIP com a reclamació desada, o `null` si no té número o data. */
export function reclamacioDeFila(fila: FilaGaip): ReclamacioGaip | null {
  const reclamacio = String(fila.reclamaci ?? "").trim();
  const dataReclamacio = dataIso(fila.data_de_reclamaci);
  if (!reclamacio || !dataReclamacio) return null;
  const ambit = String(fila.mbits ?? "").trim();
  return {
    reclamacio,
    resolucio: String(fila.resoluci ?? "").trim() || null,
    dataReclamacio,
    dataResolucio: dataIso(fila.data_de_resoluci),
    sentit: sentitDe(fila.sentit_de_la_resoluci),
    sentitText: String(fila.sentit_de_la_resoluci ?? "").trim(),
    ambit: ambit || null,
    reclamant: reclamantDe(fila.condici_reclamant),
    dies: dies(fila.temps_trigat_en_resoldre),
    url: urlDe(fila.url),
  };
}

export function incomplimentDeFila(fila: FilaIncompliment): IncomplimentGaip | null {
  const reclamacio = String(fila.reclamacio ?? "").trim();
  if (!reclamacio) return null;
  return {
    reclamacio,
    resolucio: String(fila.resolucio ?? "").trim() || null,
    dataResolucio: dataIso(fila.data_resolucio),
    dataRequeriment: dataIso(fila.data_requeriment),
    sentitText: String(fila.sentit_resolucio ?? "").trim(),
    url: urlDe(fila.enllac),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// El plegat
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reparteix les files entre els municipis i en treu els duplicats: per
 * municipi, una reclamació per número, i si n'hi ha dues versions es queda
 * la catalana (la castellana porta el mateix sentit i les mateixes dates).
 * Torna també els noms que no han lligat, amb quantes files.
 */
export function repartGaip(
  files: readonly FilaGaip[],
  index: IndexMunicipis,
): { perMunicipi: Map<number, ReclamacioGaip[]>; senseLligar: Map<string, number>; invalides: number } {
  const triades = new Map<number, Map<string, { r: ReclamacioGaip; catala: boolean }>>();
  const senseLligar = new Map<string, number>();
  let invalides = 0;
  for (const fila of files) {
    const r = reclamacioDeFila(fila);
    if (!r) {
      invalides += 1;
      continue;
    }
    const nom = String(fila.administraci_reclamada ?? "").trim();
    const ids = municipisDelNom(nom, index);
    if (ids.length === 0) {
      senseLligar.set(nom, (senseLligar.get(nom) ?? 0) + 1);
      continue;
    }
    const catala = String(fila.versi_es ?? "").trim().toUpperCase() !== "CAST";
    for (const id of ids) {
      let delMunicipi = triades.get(id);
      if (!delMunicipi) triades.set(id, (delMunicipi = new Map()));
      const ja = delMunicipi.get(r.reclamacio);
      if (!ja || (!ja.catala && catala)) delMunicipi.set(r.reclamacio, { r, catala });
    }
  }
  const perMunicipi = new Map<number, ReclamacioGaip[]>();
  for (const [id, m] of triades) perMunicipi.set(id, [...m.values()].map((x) => x.r));
  return { perMunicipi, senseLligar, invalides };
}

/** El mateix per als incompliments, un per número de reclamació. */
export function repartIncompliments(
  files: readonly FilaIncompliment[],
  index: IndexMunicipis,
): { perMunicipi: Map<number, IncomplimentGaip[]>; senseLligar: Map<string, number> } {
  const triats = new Map<number, Map<string, IncomplimentGaip>>();
  const senseLligar = new Map<string, number>();
  for (const fila of files) {
    const inc = incomplimentDeFila(fila);
    if (!inc) continue;
    const nom = String(fila.administracio_reclamada ?? "").trim();
    const ids = municipisDelNom(nom, index);
    if (ids.length === 0) {
      senseLligar.set(nom, (senseLligar.get(nom) ?? 0) + 1);
      continue;
    }
    for (const id of ids) {
      let m = triats.get(id);
      if (!m) triats.set(id, (m = new Map()));
      if (!m.has(inc.reclamacio)) m.set(inc.reclamacio, inc);
    }
  }
  const perMunicipi = new Map<number, IncomplimentGaip[]>();
  for (const [id, m] of triats) {
    perMunicipi.set(id, [...m.values()].sort((a, b) => (b.dataResolucio ?? "").localeCompare(a.dataResolucio ?? "")));
  }
  return { perMunicipi, senseLligar };
}

export function mediana(valors: readonly number[]): number | null {
  if (valors.length === 0) return null;
  const v = [...valors].sort((a, b) => a - b);
  const mig = Math.floor(v.length / 2);
  return v.length % 2 ? v[mig]! : Math.round((v[mig - 1]! + v[mig]!) / 2);
}

const dinsDe = (r: ReclamacioGaip, des: string, fins: string | null): boolean =>
  r.dataReclamacio >= des && (fins === null || r.dataReclamacio <= fins);

/** El resum d'un mandat: recomptes per sentit i per reclamant, mediana de dies i àmbits. */
export function resumGaip(reclamacions: readonly ReclamacioGaip[], des: string, fins: string | null): ResumGaip {
  const dins = reclamacions.filter((r) => dinsDe(r, des, fins));
  const sentit = Object.fromEntries(SENTITS_GAIP.map((s) => [s, 0])) as Record<SentitGaip, number>;
  const reclamant = Object.fromEntries(RECLAMANTS_GAIP.map((s) => [s, 0])) as Record<ReclamantGaip, number>;
  const ambits = new Map<string, number>();
  for (const r of dins) {
    sentit[r.sentit] += 1;
    reclamant[r.reclamant] += 1;
    if (r.ambit) ambits.set(r.ambit, (ambits.get(r.ambit) ?? 0) + 1);
  }
  return {
    des,
    fins,
    reclamacions: dins.length,
    sentit,
    reclamant,
    medianaDies: mediana(dins.map((r) => r.dies).filter((d): d is number => d !== null)),
    ambits: [...ambits]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ca"))
      .slice(0, 3)
      .map(([ambit, n]) => ({ ambit, reclamacions: n })),
  };
}

/** La mètrica d'un municipi. Sense cap reclamació també se'n fa una, amb zeros. */
export function gaipDeMunicipi(
  reclamacions: readonly ReclamacioGaip[],
  incompliments: readonly IncomplimentGaip[],
  ctx: Pick<GaipMetric, "catalunya" | "darreraReclamacioFont" | "fonts" | "consultat"> & { primerAny: number; darrerAny: number },
): GaipMetric {
  const perAnyMap = new Map<number, number>();
  for (const r of reclamacions) {
    const any = Number(r.dataReclamacio.slice(0, 4));
    perAnyMap.set(any, (perAnyMap.get(any) ?? 0) + 1);
  }
  const perAny: GaipMetric["perAny"] = [];
  for (let any = ctx.primerAny; any <= ctx.darrerAny; any += 1) perAny.push({ any, reclamacions: perAnyMap.get(any) ?? 0 });
  const ordenades = [...reclamacions].sort(
    (a, b) => b.dataReclamacio.localeCompare(a.dataReclamacio) || b.reclamacio.localeCompare(a.reclamacio),
  );
  return {
    mandat: resumGaip(reclamacions, MANDATS_GAIP.actual.des, MANDATS_GAIP.actual.fins),
    anterior: resumGaip(reclamacions, MANDATS_GAIP.anterior.des, MANDATS_GAIP.anterior.fins),
    total: { reclamacions: reclamacions.length, desDe: ordenades.at(-1)?.dataReclamacio ?? null },
    perAny,
    recents: ordenades.slice(0, MAX_RECENTS),
    incompliments: [...incompliments],
    catalunya: ctx.catalunya,
    darreraReclamacioFont: ctx.darreraReclamacioFont,
    fonts: ctx.fonts,
    consultat: ctx.consultat,
  };
}

/** La referència de Catalunya: totes les reclamacions lligades del mandat. */
export function contextCatalunya(perMunicipi: ReadonlyMap<number, readonly ReclamacioGaip[]>): GaipMetric["catalunya"] {
  let reclamacions = 0;
  let ajuntaments = 0;
  let estimades = 0;
  const perAmbit = new Map<string, { reclamacions: number; ajuntaments: number }>();
  for (const llista of perMunicipi.values()) {
    const r = resumGaip(llista, MANDATS_GAIP.actual.des, MANDATS_GAIP.actual.fins);
    reclamacions += r.reclamacions;
    estimades += r.sentit.estimacio + r.sentit.estimacioParcial;
    if (r.reclamacions > 0) ajuntaments += 1;
    const delMunicipi = new Map<string, number>();
    for (const x of llista) {
      if (x.ambit && dinsDe(x, MANDATS_GAIP.actual.des, MANDATS_GAIP.actual.fins)) {
        delMunicipi.set(x.ambit, (delMunicipi.get(x.ambit) ?? 0) + 1);
      }
    }
    for (const [ambit, n] of delMunicipi) {
      const a = perAmbit.get(ambit) ?? { reclamacions: 0, ajuntaments: 0 };
      perAmbit.set(ambit, { reclamacions: a.reclamacions + n, ajuntaments: a.ajuntaments + 1 });
    }
  }
  const ambits = [...perAmbit]
    .sort((a, b) => b[1].reclamacions - a[1].reclamacions || a[0].localeCompare(b[0], "ca"))
    .slice(0, 5)
    .map(([ambit, a]) => ({ ambit, ...a }));
  return { reclamacions, ajuntaments, estimades, ambits };
}

// ─────────────────────────────────────────────────────────────────────────────
// La feina
// ─────────────────────────────────────────────────────────────────────────────

const PAUSA_MS = 1_000;

async function desa(db: Db, municipalityId: number, data: GaipMetric): Promise<void> {
  await db
    .insert(municipalityMetrics)
    .values({ municipalityId, kind: KIND_GAIP, data })
    .onConflictDoUpdate({
      target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
      set: { data, computedAt: new Date() },
    });
}

export async function j45Gaip(db: Db): Promise<void> {
  await withRun(db, "J45 GAIP: reclamacions d'accés a la informació contra els ajuntaments", async (run) => {
    const consultat = new Date().toISOString().slice(0, 10);
    // ~9.600 files de tipologia «Ajuntament», en dues pàgines. Les EMD no hi
    // són: no són municipi, i una reclamació contra Valldoreix no és contra
    // Sant Cugat.
    const files = await socrataAll<FilaGaip>(DATASET_GAIP, {
      select: CAMPS_GAIP.join(","),
      where: "tipologia_d_administraci='Ajuntament'",
      // `:id` i no el número: una reclamació pot tenir dues files (CAT i
      // CAST) i un ordre amb empats pot repetir o saltar files entre pàgines.
      order: ":id",
    });
    await sleep(PAUSA_MS);
    const filesIncompliments = await socrataAll<FilaIncompliment>(DATASET_GAIP_INCOMPLIMENTS, {
      select: "reclamacio,resolucio,data_reclamacio,administracio_reclamada,sentit_resolucio,data_resolucio,data_requeriment,enllac",
      order: ":id",
    });
    run.rowsIn = files.length + filesIncompliments.length;
    const fonts: GaipMetric["fonts"] = {
      resolucions: { ...FONTS_GAIP.resolucions, actualitzat: await dataActualitzacioSocrata(DATASET_GAIP) },
      incompliments: { ...FONTS_GAIP.incompliments, actualitzat: await dataActualitzacioSocrata(DATASET_GAIP_INCOMPLIMENTS) },
    };

    const tots = await db.select({ id: municipalities.id, name: municipalities.name }).from(municipalities);
    const index = indexMunicipis(tots);
    const ambiguos = [...index].filter(([, ids]) => ids.length > 1).map(([clau]) => clau);
    if (ambiguos.length) run.say(`claus de municipi repetides, que no lliguen: ${ambiguos.join(", ")}`);

    const { perMunicipi, senseLligar, invalides } = repartGaip(files, index);
    const inc = repartIncompliments(filesIncompliments, index);
    const filesSense = [...senseLligar.values()].reduce((s, n) => s + n, 0);
    run.say(
      `${files.length} files de la GAIP i ${filesIncompliments.length} d'incompliments · ` +
        `${filesSense} files (${senseLligar.size} noms) sense lligar amb cap municipi` +
        (invalides ? ` · ${invalides} sense número o data` : ""),
    );
    // Els noms que no lliguen van a les incidències, de més a menys files: la
    // majoria són organismes i empreses municipals, i se'n pot fer un àlies si
    // algun es repeteix.
    for (const [nom, n] of [...senseLligar].sort((a, b) => b[1] - a[1])) {
      await run.issue({ kind: "gaip_nom_sense_municipi", severity: "baixa", entity: nom, detail: { files: n, dataset: DATASET_GAIP } });
    }
    for (const [nom, n] of inc.senseLligar) {
      // Als incompliments hi ha tota mena d'administracions: només és incidència
      // si el nom diu «ajuntament».
      if (/a[jy]u[a-z]{4,}|paeria/i.test(normalize(nom))) {
        await run.issue({ kind: "gaip_nom_sense_municipi", severity: "baixa", entity: nom, detail: { files: n, dataset: DATASET_GAIP_INCOMPLIMENTS } });
      }
    }

    const dates = files.map((f) => dataIso(f.data_de_reclamaci)).filter((d): d is string => d !== null).sort();
    const primerAny = Number((dates[0] ?? consultat).slice(0, 4));
    const darreraReclamacioFont = dates.at(-1) ?? null;
    const darrerAny = Number((darreraReclamacioFont ?? consultat).slice(0, 4));
    const catalunya = contextCatalunya(perMunicipi);

    let ambReclamacions = 0;
    let ambIncompliments = 0;
    for (const m of tots) {
      const data = gaipDeMunicipi(perMunicipi.get(m.id) ?? [], inc.perMunicipi.get(m.id) ?? [], {
        catalunya, darreraReclamacioFont, fonts, consultat, primerAny, darrerAny,
      });
      if (data.mandat.reclamacions > 0) ambReclamacions += 1;
      if (data.incompliments.length > 0) ambIncompliments += 1;
      await desa(db, m.id, data);
      run.rowsOut += 1;
    }
    run.say(
      `${run.rowsOut} municipis desats · ${ambReclamacions} amb alguna reclamació aquest mandat ` +
        `(${catalunya.reclamacions} en total, ${catalunya.estimades} estimades del tot o en part) · ` +
        `${ambIncompliments} amb algun incompliment`,
    );
    return { municipis: run.rowsOut, ambReclamacions, ambIncompliments, filesSenseLligar: filesSense, nomsSenseLligar: senseLligar.size, ...catalunya };
  });
}
