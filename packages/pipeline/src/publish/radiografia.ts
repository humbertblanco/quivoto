import { and, asc, eq, inArray } from "drizzle-orm";
import {
  candidatures, councillorMandates, dataIssues, electionParticipation, municipalities,
  municipalityMetrics, people, politicalGroups, type Db,
} from "@quivoto/db";
import { BRANDS_BY_ID, sameForce, siglesFamily } from "@quivoto/shared-schemas/brands";
import { absoluteMajority } from "@quivoto/shared-schemas/seats";
import { sobreColor } from "./contrast";
import { hemicycle } from "./hemicycle";
import { icona } from "./icones";
import { renderMapa, type PuntMapa } from "./mapa";
import { adrecesRegidors } from "./regidor";
import { nomLlegible, slugify } from "../lib/text";
import { INDEXABLE, SITE } from "./config";
import { RADIOGRAFIA_CSS } from "./estil";

/**
 * Radiografia d'un municipi: una pàgina feta només amb dades obertes i càlculs
 * deterministes, sense cap intervenció d'un model de llenguatge.
 *
 * És el primer lliurable públic del projecte i ha de valer per si sol, mesos
 * abans que existeixi cap brúixola: qui mana, qui va guanyar, com s'ha mogut el
 * vot en tres eleccions, qui ha estat alcalde des del 1979 i quantes dades en
 * tenim de veritat.
 */

type CandidatureShare = {
  sigles: string; brandId: string | null; color: string | null;
  votes: number; seats: number; share: number;
};
type ResultsMetric = Record<string, { totalVotes: number; seats: number; candidatures: CandidatureShare[] }>;
type GovernmentMetric = {
  mayorName: string | null; mayorPartyRaw: string | null; mayorSigles: string | null;
  mayorSeats: number | null; winnerSigles: string; winnerSeats: number; totalSeats: number;
  majority: number; winnerHasMajority: boolean; winnerGoverns: boolean | null;
  effectiveParties: number; mayorMatchMethod: string | null; mayorMatchConfidence: number | null;
};
type ParityMetric = {
  candidates: number; womenCandidates: number; womenCandidatesPct: number | null;
  elected: number; womenElected: number; womenElectedPct: number | null;
  heads: number; womenHeads: number;
};
type FinanceIndicator = {
  key: string; label: string; value: number | null;
  unit: "percent" | "euros" | "dies"; level: string; note: string;
};
type PeerComparison = {
  key: string; value: number; lowerIsBetter: boolean;
  groupLabel: string; groupSize: number;
  median: number | null; percentile: number | null; rank: number | null; floorShare: number | null;
};
type YearPoint = {
  year: number; debtPerHead: number | null; netSavingPct: number | null;
  financialLoadPct: number | null; investmentPerHead: number | null;
  investmentExecutionPct: number | null; personnelPct: number | null;
  paymentDays: number | null; investmentUnspent: number | null;
};
type MandateReading = {
  id: string; label: string; years: number[]; expected: number;
  first: YearPoint | null; last: YearPoint | null;
  delta: Partial<Record<string, number | null>>;
  investmentUnspentTotal: number | null;
};
type MandateBand = { id: string; from: number; to: number; mayor: string | null; party: string | null };
type FinancesMetric = {
  year: number; indicators: FinanceIndicator[];
  debtSeries: { year: number; perHead: number }[];
  comparison: PeerComparison[];
  points: YearPoint[];
  mandates: MandateReading[];
  bands: MandateBand[];
  group: { label: string; size: number } | null;
  incomeCurrent: number; population: number | null;
};
type ElectoralHistory = {
  series: {
    year: number; seats: number; totalVotes: number;
    winner: { sigles: string; seats: number; votes: number } | null;
    winnerFamily: string | null;
    families: Record<string, number>;
    candidatures: number;
  }[];
  elections: number; firstYear: number | null; alternances: number;
};
type TaxesMetric = {
  year: number;
  taxes: Record<string, { label: string; value: number; unit: string }>;
  medians: Record<string, number>;
};
type EstatItem = {
  key: string; label: string; published: boolean; auto: boolean;
  notApplicable: boolean; updatedOn: string | null; updatedYear: number | null;
  bulk: boolean; catalunya: { published: number; of: number } | null;
};
type TransparencyMetric = {
  items: number; published: number; pct: number | null;
  detail?: EstatItem[];
};
type MoneyEntry = { label: string; perHead: number; total: number; share?: number };
/** Amb qui es compara aquest municipi, i quants d'ells tenen la dada. */
type GrupComparacio = { etiqueta: string; mida: number; ambDada: number };
type RevenueMetric = {
  year: number;
  figures: MoneyEntry[];
  medians: Record<string, number | null>;
  grup?: GrupComparacio | null;
  medianesGrup?: Record<string, number | null> | null;
  propis?: { perHabitant: number; medianaCatalunya: number | null; municipisAmbDada: number } | null;
};
type SpendingMetric = {
  year: number;
  areas: MoneyEntry[];
  totalPerHead: number;
  medians: Record<string, number | null>;
  grup?: GrupComparacio | null;
  medianesGrup?: Record<string, number | null> | null;
  totalMediaGrup?: number | null;
  poblacio?: number | null;
  autofinancament?: { pct: number; medianaGrup: number | null } | null;
};
type ServicesMetric = {
  year: number;
  services: { label: string; perHead: number; total: number; management: string }[];
  medians: Record<string, number | null>;
};
/** El ple tal com el publica avui l'ajuntament a la seva seu electrònica. */
type CarrecSeue = {
  nom: string; carrec: string; grup: string | null; equipGovern: boolean;
  foto: string | null; fotoPetita: string | null; fitxa: string | null;
};
type FitxaCarrecs = {
  font: string; url: string; slug: string; descarregat: string;
  totalCarrecs: number; ambFoto: number;
  cobertura: "completa" | "parcial" | "cap";
  carrecs: CarrecSeue[];
};
/** Una variació entre dos anys, amb la del grup al costat per poder-la jutjar. */
type Variacio = {
  desDe: number;
  fins: number;
  inici: number;
  final: number;
  diferencia: number;
  percentual: number | null;
};
type MandatGrup = { diferencia: number | null; percentual: number | null; municipis: number };
type ResidusMetric = {
  darrerAny: number;
  taxaSelectiva: number | null;
  kgHabAny: number | null;
  serie: { any: number; taxaSelectiva: number | null; kgHabAny: number | null }[];
  mandat?: Variacio | null;
  mandatDelGrup?: MandatGrup | null;
  comparacio?: { percentil: number | null; mediana: number | null; grup: string } | null;
};
type HabitatgeMetric = {
  darrerAny: number;
  preu: number | null;
  serie: { any: number; preu: number; contractes: number | null }[];
  mandat?: Variacio | null;
  mandatDelGrup?: MandatGrup | null;
};

/**
 * Un enllaç de l'Idescat tal com el dona la seva API.
 *
 * **No és decoració ni una cortesia.** Les condicions d'ús de les API de
 * l'Idescat diuen literalment que cal reconèixer l'origen de les dades fent
 * servir els enllaços que proporcionen les API, i que no estem autoritzats a
 * modificar-los. Una fitxa que ensenyi les seves xifres sense l'enllaç al
 * costat **no es pot publicar**: per això aquí no hi ha cap camí de codi que
 * pinti una xifra de l'Idescat sense pintar-ne també l'enllaç.
 */
type EnllacIdescat = { taula: string; titol: string; href: string };

/** Percentil i mediana dins del grup de mida, amb quants hi tenen dada. */
type PercentilGrup = {
  grup: { clau: string; etiqueta: string; mida: number; ambDada: number };
  percentil: number;
  mediana: number;
};

/** Mediana d'una variació **en %** dins del grup. L'aigua i l'IBI la desen així. */
type MedianaPct = { mediana: number | null; municipis: number };

/** Un dels catorze indicadors de població que desa J18. */
type IndicadorPoblacio = {
  clau: string;
  etiqueta: string;
  unitat: "persones" | "%" | "anys";
  /**
   * Què compta exactament aquesta xifra, escrit per J18. Va **literal** a la
   * pantalla: és l'única cosa que impedeix que «nacionalitat estrangera» i
   * «nascuts a l'estranger» es llegeixin com si diguessin el mateix.
   */
  compta: string;
  taula: string;
  emex: string | null;
  decimals: number;
  darrerAny: number | null;
  valor: number | null;
  serie: { any: number; valor: number | null }[];
  mandat: Variacio | null;
  mandatAnterior: Variacio | null;
  mandatDelGrup: MandatGrup | null;
  comparacio: PercentilGrup | null;
  enllac: EnllacIdescat | null;
  catalunya: { valor: number | null; mandat: Variacio | null } | null;
};

type PoblacioMetric = {
  font: {
    organisme: string;
    llicencia: { organisme: string; condicions: string; literal: string; obliga: string };
    taules: { taula: string; nom: string; font: string; actualitzat: string | null }[];
    /** Els enllaços d'aquest municipi, verbatim. La llicència obliga a mostrar-los. */
    enllacosMunicipi: EnllacIdescat[];
  };
  /** J18 marca que res d'això no ho decideix l'ajuntament. La fitxa ho ha de dir. */
  context: { decideixLAjuntament: boolean; nota: string };
  mandat: { desDe: number; anterior: number };
  darrerAny: number | null;
  indicadors: IndicadorPoblacio[];
  divergencia: {
    any: number;
    poblacio: number;
    nacionalitatEstrangera: number;
    nascutsAEstranger: number;
    pctNacionalitatEstrangera: number | null;
    pctNascutsAEstranger: number | null;
    persones: number;
    mesGran: "lloc de naixement" | "nacionalitat" | "iguals";
    nota: string;
  } | null;
  creuament: {
    any: number;
    nascutsForaAmbNacionalitatEspanyola: number | null;
    estrangersNascutsAEspanya: number | null;
    desquadrament: number | null;
    arrodonit: true;
    nota: string;
  } | null;
  padroContraCens: {
    any: number;
    padro: number;
    cens: number;
    persones: number;
    percentual: number | null;
    divergeix: boolean;
    nota: string;
  } | null;
};

/** El preu de l'aigua segons el full de l'ACA, amb els tres paranys ja resolts. */
type PreuAiguaMetric = {
  font: { nom?: string; organisme?: string; url?: string; dataActualitzacio: string | null; peu?: string };
  darrerAny: number;
  serie: {
    any: number;
    subministrament: number | null;
    canon: number | null;
    clavegueram: number | null;
    municipal: number | null;
    total: number | null;
    rebutSencer: boolean;
    tarifaSocial: boolean | null;
    dataRevisio: string | null;
  }[];
  preu: {
    subministrament: number | null;
    canon: number | null;
    clavegueram: number | null;
    municipal: number | null;
    total: number | null;
  };
  /** Quin tram és comparable entre municipis. Avui, sempre «subministrament». */
  comparable: string;
  rebutSencer: boolean;
  /** L'avís que cal ensenyar quan el TOTAL no és el rebut sencer. */
  avisRebut: string | null;
  dataRevisio: string | null;
  interpretable: { valida: boolean; motiu: string | null; anyRevisio: number | null };
  mandat: { subministrament: Variacio | null; municipal: Variacio | null; total: Variacio | null };
  mandatDelGrup: { subministrament: MedianaPct | null; municipal: MedianaPct | null; nota: string };
  comparacio: PercentilGrup | null;
  canon: { ara: number | null; variacio: Variacio | null; nota: string };
  gestio: {
    subministrament: string | null;
    clavegueram: string | null;
    gestora: string | null;
    canvis: { year: number; from?: string; to?: string; delMandat: boolean }[];
    etiquetes: Record<string, string>;
  };
  /** `ara` és `true` o `null`, **mai** `false`: al full de l'ACA el buit no està definit. */
  tarifaSocial: { ara: boolean | null; desDe: number | null; creadaAquestMandat: boolean; nota: string };
};

/** El rebut mitjà d'IBI urbà, amb el permís de publicació de la variació. */
type RebutIbiMetric = {
  font: { nom: string; organisme: string; url: string; llicencia: string };
  darrerAny: number;
  base: string;
  serie: {
    any: number;
    provisional: boolean;
    valoracio: number | null;
    rebuts: number | null;
    baseImposable: number | null;
    quota: number | null;
    rebutMitja: number | null;
  }[];
  rebutMitja: number | null;
  rebuts: number | null;
  provisional: boolean;
  mandat: Variacio | null;
  mandatAnterior: Variacio | null;
  mandatDelGrup: MedianaPct | null;
  comparacio: PercentilGrup | null;
  revaloracio: { dins: boolean; anysDeCanvi: number[]; valoracions: number[] };
  /** Cert només quan la variació és atribuïble al ple i no al cadastre. */
  publicable: boolean;
  /** Per què no és publicable, si no ho és. */
  motius: string[];
};

/** Un dels quinze programes de despesa que desa J15, en euros per habitant. */
type ProgramaDespesa = {
  codi: string;
  nom: string;
  nomOrigen: string | null;
  perque: string;
  relacionatAmb: { kind: string; camp: string } | null;
  serie: {
    any: number;
    /** Fals = aquell exercici no s'ha liquidat. **No és un zero.** */
    liquidacio: boolean;
    total: number | null;
    perHabitant: number | null;
    part: number | null;
    habitants: number | null;
  }[];
  darrer: { any: number; liquidacio: boolean; total: number | null; perHabitant: number | null; part: number | null } | null;
  mandat: Variacio | null;
  mandatDelGrup: MandatGrup | null;
  mandatAnterior: Variacio | null;
  comparacio: { percentil: number; mediana: number; ambDada: number } | null;
  cobertura: { ambImport: number; ambZero: number; ambLiquidacio: number } | null;
};

type DespesaProgramesMetric = {
  font: { dataset: string; nom: string; organisme: string; portal: string; classificacio: string };
  anys: number[];
  darrerAny: number | null;
  anyComparable: number;
  anysSenseLiquidacio: number[];
  total: { any: number; total: number; perHabitant: number | null; fiable: boolean }[];
  programes: ProgramaDespesa[];
  grup: { clau: string; etiqueta: string; mida: number; ambLiquidacio: number } | null;
  mandat: { actual: number; anterior: number };
  base: string;
  zeroIBuit: string;
};

/** El que J12 treu de les actes del ple: cada punt votat, amb el vot per grup. */
type MocionsMetric = {
  font: string;
  fontUrl: string;
  metode: string;
  actes: { indexades: number; llegides: number; fallides: number; darrera: string | null };
  punts: { desats: number; omesos: number; ambVotPerGrup: number };
  /** Qui va anar a cada ple, quan l'acta ho diu al capçal. */
  assistencia?: { plensAmbLlista: number; persones: { nom: string; plens: number }[] } | null;
  llista: {
    data: string;
    codiActa: string;
    url: string;
    numero: string | null;
    titol: string;
    tipus: string;
    proposant: string | null;
    resultat: string | null;
    unanimitat: boolean;
    recompte: Record<string, number | null> | null;
    vots: { grup: string; sentit: string; vots: number | null }[];
    cita: string | null;
  }[];
};

type Councillor = {
  name: string;
  role: string | null;
  groupName: string | null;
  sigles: string | null;
  color: string | null;
  brandId: string | null;
  orderNum: number | null;
};
type CouncilChangesMetric = {
  changes: { person: string; electedFor: string | null; nowWith: string | null; kind: string }[];
  substitutions: number; switches: number;
};
type MayorsMetric = {
  history: { term: string; name: string; partyRaw: string | null; tookOfficeOn: string | null }[];
  changes: { term: string; mayors: { name: string; tookOfficeOn: string | null }[]; partyChanged: boolean; onlySuccessorKnown?: boolean; daysIntoTerm?: number }[];
  currentTermChange: { term: string; mayors: { name: string; tookOfficeOn: string | null }[]; onlySuccessorKnown?: boolean; daysIntoTerm?: number } | null;
  distinctPeople: number;
};

const ELECTIONS = ["M20231", "M20191", "M20151"] as const;
const ELECTION_YEAR: Record<string, string> = { M20231: "2023", M20191: "2019", M20151: "2015" };

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const number = (n: number): string => n.toLocaleString("ca-ES");
const percent = (n: number): string => `${n.toFixed(1).replace(".", ",")} %`;

/** Color de la candidatura: el que publica la Generalitat, o el de la marca. */
function colorOf(candidature: CandidatureShare): string {
  const official = candidature.color?.trim();
  if (official && /^#[0-9a-f]{6}$/i.test(official)) return official;
  return BRANDS_BY_ID.get(candidature.brandId ?? "")?.color ?? "#8b8b8b";
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const months = ["gener", "febrer", "març", "abril", "maig", "juny", "juliol", "agost", "setembre", "octubre", "novembre", "desembre"];
  const [year, month, day] = iso.slice(0, 10).split("-");
  const monthName = months[Number(month) - 1] ?? month;
  return `${Number(day)} de ${monthName} del ${year}`;
}

// ---------------------------------------------------------------- fragments

function renderHemicycle(candidatures: readonly CandidatureShare[], totalSeats: number, majority: number): string {
  const { seats, width, height, seatRadius } = hemicycle(totalSeats, { width: 660 });
  const withSeats = candidatures.filter((c) => c.seats > 0);

  // Ordre polític aproximat perquè els grups quedin junts i el dibuix sigui
  // llegible. No pretenem col·locar ningú en un eix ideològic: només agrupar.
  const order = ["cup", "comuns", "erc", "psc", "junts", "pdecat", "local", "cs", "pp", "vox", "aliancacat"];
  const sorted = [...withSeats].sort((a, b) => {
    const ia = order.indexOf(a.brandId ?? "local");
    const ib = order.indexOf(b.brandId ?? "local");
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  let cursor = 0;
  const circles: string[] = [];
  for (const candidature of sorted) {
    for (let i = 0; i < candidature.seats && cursor < seats.length; i += 1, cursor += 1) {
      const seat = seats[cursor]!;
      circles.push(
        `<circle cx="${seat.x}" cy="${seat.y}" r="${seat.r}" fill="${colorOf(candidature)}" stroke="var(--ink)" stroke-width="1.5"><title>${escape(candidature.sigles)}</title></circle>`,
      );
    }
  }

  const majorityX = width / 2;
  return `<figure class="hemicicle">
  <svg viewBox="0 0 ${width} ${height + 6}" role="img"
       aria-label="Hemicicle de ${totalSeats} regidories. ${sorted.map((c) => `${c.sigles}, ${c.seats}`).join("; ")}.">
    <line x1="${majorityX}" y1="0" x2="${majorityX}" y2="${height}" stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="5 5" opacity=".45"/>
    ${circles.join("\n    ")}
  </svg>
  <figcaption>${totalSeats} regidories · la ratlla marca la majoria absoluta, que són ${majority}. Cada cercle és una regidoria: ${seatRadius > 0 ? "es poden comptar" : ""}</figcaption>
</figure>`;
}

/**
 * Qui ha tret què, en una llista que es pugui recórrer amb la vista.
 *
 * Abans era una fila de trossos amb `flex-wrap`, i el resultat era que cada
 * candidatura partia per un lloc diferent segons quant ocupava el seu nom: la
 * xifra de regidories saltava de línia a unes i no a les altres, i la columna
 * que hauria de deixar comparar-les no existia. Ara cada força és una fila amb
 * les mateixes tres posicions —marca i sigles, regidories, vots— i les xifres
 * queden una sota l'altra. La barra de sota diu la mateixa proporció que
 * l'hemicicle, però mesurable: 22,7 % i 20,0 % són dos cercles de diferència i
 * a l'hemicicle no es veuen.
 */
function renderLegend(candidatures: readonly CandidatureShare[], slugPer: (sigles: string) => string): string {
  const amb = candidatures.filter((c) => c.seats > 0);
  const maxim = Math.max(...amb.map((c) => c.share), 1);
  return `<ul class="llegenda">${amb
    .map(
      (c) => `<li>
      <span class="qui"><span class="mostra" style="--c:${colorOf(c)}"></span><b><a href="${escape(
        slugPer(c.sigles),
      )}/">${escape(c.sigles)}</a></b></span>
      <span class="xifra"><b>${c.seats}</b> ${c.seats === 1 ? "regidoria" : "regidories"}</span>
      <span class="proporcio" aria-hidden="true"><i style="--c:${colorOf(c)};--w:${(100 * c.share) / maxim}%"></i></span>
      <span class="secundari">${number(c.votes)} vots · ${percent(c.share)}</span></li>`,
    )
    .join("")}</ul>`;
}

function renderSeries(results: ResultsMetric): string {
  const rows = ELECTIONS.filter((e) => results[e]).map((electionId) => {
    const election = results[electionId]!;
    const total = election.seats || 1;
    const bars = election.candidatures
      .filter((c) => c.seats > 0)
      .map(
        (c) => {
          const part = (100 * c.seats) / total;
          const { fons, tinta } = sobreColor(colorOf(c));
          // Les sigles només hi caben si el tram és prou ample: per sota d'un
          // 14 % del ple hi sortia un tros de paraula tallat a mitja lletra,
          // que no diu res i embruta la barra. El títol i la llegenda de sota
          // continuen dient de qui és cada tram.
          const sigles = part >= 14 ? `<i>${escape(c.sigles)}</i>` : "";
          return `<span class="tram" style="--c:${fons};--t:${tinta};--w:${part}%" title="${escape(c.sigles)}: ${c.seats}">
        <b>${c.seats}</b>${sigles}</span>`;
        },
      )
      .join("");
    return `<tr><th scope="row">${ELECTION_YEAR[electionId]}</th><td><div class="barra">${bars}</div></td></tr>`;
  });
  return `<table class="serie"><caption class="nomes-lectors">Regidories per candidatura a cada elecció</caption><tbody>${rows.join("")}</tbody></table>`;
}

function renderTurnout(rows: readonly { electionId: string; censusSize: number | null; voters: number | null; blankVotes: number | null }[]): string {
  const ordered = ELECTIONS.map((e) => rows.find((r) => r.electionId === e)).filter(Boolean) as typeof rows;
  const items = ordered.map((row) => {
    const pct = row.censusSize && row.voters ? (100 * row.voters) / row.censusSize : null;
    return `<li><b>${ELECTION_YEAR[row.electionId]}</b>
      <span class="gran">${pct === null ? "—" : percent(pct)}</span>
      <span class="secundari">${number(row.voters ?? 0)} de ${number(row.censusSize ?? 0)} · ${number(row.blankVotes ?? 0)} en blanc</span></li>`;
  });
  return `<ul class="participacio">${items.join("")}</ul>`;
}

function formatIndicator(indicator: FinanceIndicator): string {
  if (indicator.value === null) return "—";
  if (indicator.unit === "percent") return `${indicator.value.toFixed(1).replace(".", ",")} %`;
  if (indicator.unit === "euros") return `${number(indicator.value)} €`;
  return `${number(indicator.value)} dies`;
}

/**
 * Com anomenem cada indicador quan el que expliquem és una gestió i no un
 * balanç. La lliçó ve dels noruecs: en diuen «els diners estalviats», no «fons
 * de disposició». El terme tècnic va darrere, entre parèntesis, mai davant.
 */
const MANDATE_ROWS: ReadonlyArray<{
  key: keyof YearPoint; label: string; unit: "euros" | "percent" | "dies";
  lowerIsBetter: boolean; note: string;
}> = [
  {
    key: "debtPerHead", label: "El que el poble deu, per habitant", unit: "euros", lowerIsBetter: true,
    note: "deute viu a 31 de desembre dividit pel padró d'aquell any",
  },
  {
    key: "netSavingPct", label: "El que sobra cada any", unit: "percent", lowerIsBetter: false,
    note: "un cop pagat el funcionament i les quotes del deute (estalvi net)",
  },
  {
    key: "investmentExecutionPct", label: "Del que pressuposten per invertir, quant gasten", unit: "percent", lowerIsBetter: false,
    note: "sobre el pressupost definitiu d'inversions, amb les modificacions incloses",
  },
  {
    key: "investmentPerHead", label: "Invertit per habitant", unit: "euros", lowerIsBetter: false,
    note: "capítol 6 liquidat",
  },
  {
    key: "personnelPct", label: "Part dels ingressos que va a personal", unit: "percent", lowerIsBetter: true,
    note: "no és la plantilla: hi pesen el conveni, l'antiguitat i el que està externalitzat",
  },
  {
    key: "paymentDays", label: "Dies que triguen a pagar els proveïdors", unit: "dies", lowerIsBetter: true,
    note: "període mitjà de pagament; per sobre de 30 dies és un incompliment",
  },
];

function formatUnit(value: number, unit: "euros" | "percent" | "dies"): string {
  if (unit === "percent") return `${value.toFixed(1).replace(".", ",")} %`;
  if (unit === "dies") return `${number(Math.round(value))} dies`;
  return `${number(Math.round(value))} €`;
}

/**
 * El balanç del mandat: com els van trobar i com els deixen.
 *
 * És la pregunta de fons a quatre mesos d'unes eleccions, i fins ara la fitxa no
 * la podia respondre perquè publicava la fotografia d'un sol any tot i tenir la
 * sèrie sencera desada. Aquí no es diu si ho han fet bé: es diu què ha canviat.
 */
function renderMandate(finances: FinancesMetric, mayorChanged: boolean): string {
  const current = finances.mandates.find((m) => m.id === "2023-2027");
  const previous = finances.mandates.find((m) => m.id === "2019-2023");
  if (!current || !current.first || !current.last || current.years.length < 2) return "";

  const rows = MANDATE_ROWS.map((row) => {
    const from = current.first![row.key];
    const to = current.last![row.key];
    if (typeof from !== "number" || typeof to !== "number") return "";
    const delta = to - from;
    const previousDelta = previous?.delta?.[row.key];
    // Una millora és que la xifra vagi cap on toca, i «cap on toca» es codifica
    // a mà per indicador: al deute, avall; a l'estalvi, amunt.
    const better = row.lowerIsBetter ? delta < 0 : delta > 0;
    const flat = Math.abs(delta) < (row.unit === "percent" ? 0.5 : 1);
    const direction = flat ? "igual" : better ? "millor" : "pitjor";
    const arrow = flat ? "→" : delta > 0 ? "↑" : "↓";
    return `<tr class="${direction}">
      <th scope="row">${escape(row.label)}<span class="peu-nota">${escape(row.note)}</span></th>
      <td class="abans">${formatUnit(from, row.unit)}</td>
      <td class="fletxa" aria-label="${flat ? "sense canvi" : delta > 0 ? "puja" : "baixa"}">${arrow}</td>
      <td class="ara">${formatUnit(to, row.unit)}</td>
      <td class="canvi">${flat ? "sense canvi" : `${delta > 0 ? "+" : "−"}${formatUnit(Math.abs(delta), row.unit)}`}
        ${typeof previousDelta === "number" && !flat
          ? `<span class="peu-nota">el mandat anterior, ${previousDelta > 0 ? "+" : "−"}${formatUnit(Math.abs(previousDelta), row.unit)}</span>`
          : ""}</td>
    </tr>`;
  }).join("");

  // El pressupost d'inversions arrossega crèdits d'un any a l'altre, així que
  // sumar el no gastat de tres exercicis compta dues i tres vegades els mateixos
  // diners. La mitjana anual sí que és honesta.
  const unspentYears = current.years.length;
  const unspentAverage =
    current.investmentUnspentTotal !== null && unspentYears > 0
      ? Math.round(current.investmentUnspentTotal / unspentYears)
      : null;
  const executions = [current.first, current.last]
    .map((p) => p?.investmentExecutionPct)
    .filter((v): v is number => typeof v === "number");
  return `<p class="entrada-bloc">Compara el primer exercici liquidat d'aquest mandat
  (${current.years[0]}) amb l'últim que consta (${current.years[current.years.length - 1]}).</p>
  <table class="balanc">
    <thead><tr><th>Indicador</th><th>${current.years[0]}</th><th><span class="nomes-lectors">canvi</span></th><th>${current.years[current.years.length - 1]}</th><th>Diferència</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${unspentAverage && unspentAverage > 0
    ? `<p class="destacat">Cada any d'aquest mandat s'han quedat sense gastar,
       de mitjana, <b>${number(unspentAverage)} €</b> del pressupost d'inversions.
       <span class="peu-nota">No se sumen els anys: els crèdits que no es gasten es traspassen
       al següent i es tornarien a comptar. Un pressupost d'inversions molt poc executat sol
       voler dir que s'ha pressupostat de més, no necessàriament que no s'hagi fet res.</span></p>`
    : ""}
  <p class="nota">Hi ha <b>${current.years.length} ${current.years.length === 1 ? "exercici liquidat" : "exercicis liquidats"}
  dels ${current.expected}</b> que té el mandat: les liquidacions triguen, i el darrer any encara no hi és.
  ${mayorChanged ? "En aquest mandat hi ha hagut canvi d'alcaldia, així que les xifres són del govern, no d'una persona. " : ""}
  Que una xifra millori o empitjori no vol dir que s'hagi fet bé o malament: vol dir que ha canviat.</p>`;
}

/**
 * El semàfor no diu si el govern ho fa bé: diu com estan els comptes. La fitxa
 * ho ha de deixar clar, perquè la temptació de llegir-ho com una nota és òbvia.
 */
function renderFinances(finances: FinancesMetric): string {
  const byKey = new Map(finances.comparison.map((c) => [c.key, c]));
  const cards = finances.indicators
    .map((indicator) => {
      const peer = byKey.get(indicator.key);
      // Comparar amb la mediana de tot Catalunya barreja Barcelona amb pobles de
      // tres-cents habitants. Aquí es diu sempre amb qui es compara i quants són.
      const comparison = !peer
        ? ""
        : peer.floorShare !== null
          ? `<span class="comparativa">${peer.floorShare} de cada 100 municipis ${escape(peer.groupLabel)} estan al mínim</span>`
          : peer.percentile !== null
            ? `<span class="comparativa">percentil ${peer.percentile} entre els ${peer.groupSize} municipis ${escape(peer.groupLabel)}</span>`
            : peer.rank !== null
              ? `<span class="comparativa">el ${peer.rank} de ${peer.groupSize} municipis ${escape(peer.groupLabel)}</span>`
              : "";
      return `<li class="indicador nivell-${escape(indicator.level)}">
      <span class="nom">${escape(indicator.label)}</span>
      <span class="gran">${formatIndicator(indicator)}</span>
      ${comparison}
      <span class="secundari">${escape(indicator.note)}</span>
    </li>`;
    })
    .join("");

  const series = finances.debtSeries.filter((point) => point.year >= 2015);
  const max = Math.max(1, ...series.map((point) => point.perHead));
  // Cada columna sap de quin mandat és: una línia que puja ha de ser d'algú.
  const bandOf = (year: number): MandateBand | undefined =>
    finances.bands.find((b) => year >= b.from && year <= b.to);
  const bars = series
    .map((point) => {
      const band = bandOf(point.year);
      return `<li class="${band ? `mandat-${band.id}` : ""}" style="--h:${Math.max(2, Math.round((100 * point.perHead) / max))}%">
      <span class="valor">${number(point.perHead)}</span><span class="any">'${String(point.year).slice(2)}</span>
    </li>`;
    })
    .join("");

  const bandLegend = finances.bands
    .filter((b) => b.to >= 2015)
    .map(
      (band) => `<li class="mandat-${band.id}"><span class="tram-mandat"></span>
      <b>${escape(band.id)}</b>${band.mayor ? ` · ${escape(band.mayor)}` : ""}${band.party ? ` (${escape(band.party)})` : ""}</li>`,
    )
    .join("");

  return `<ul class="indicadors">${cards}</ul>
  ${series.length > 1 ? `<h3 class="subtitol">Deute per habitant, any a any</h3>
  <ul class="columnes" role="img" aria-label="${series.map((p) => `${p.year}: ${p.perHead} euros`).join("; ")}">${bars}</ul>
  <ul class="clau-mandats">${bandLegend}</ul>` : ""}
  <p class="nota">Dades de la liquidació del ${finances.year}, l'últim exercici tancat que consta.
  ${finances.group ? `Les comparacions són amb els <b>${finances.group.size} municipis catalans ${escape(finances.group.label)}</b>, no amb tot Catalunya: comparar un poble amb Barcelona no diu res.` : ""}
  Els llindars, on n'hi ha, són els de la llei.
  <b>Això no és una nota al govern</b>: diu com estan els comptes, no si algú ho ha fet bé.</p>`;
}

/**
 * Quaranta-cinc anys d'eleccions en una tira. No hi posem totes les
 * candidatures —serien il·legibles— sinó qui va guanyar cada cop, que és el que
 * deixa veure d'una ullada si un poble ha canviat de mans o no ho ha fet mai.
 */
/** Colors de força per al gràfic històric. Marca de dades, mai d'interfície. */
const FAMILY_COLORS: Record<string, string> = {
  psc: "#d00c3c", ciu: "#18307b", junts: "#00c3b2", erc: "#ffb232", comuns: "#662483",
  cup: "#d8d000", pp: "#234b90", cs: "#ff5824", vox: "#00c118", pdecat: "#7f9ac9",
  aliancacat: "#1d3f6e", local: "#8b8b8b",
};
const colorFamilia = (family: string): string => FAMILY_COLORS[family] ?? "#8b8b8b";
const FAMILY_NAMES: Record<string, string> = {
  psc: "PSC", ciu: "CiU", junts: "Junts", erc: "ERC", comuns: "Comuns / ICV",
  cup: "CUP", pp: "PP", cs: "Ciutadans", vox: "Vox", pdecat: "PDeCAT",
  aliancacat: "Aliança Catalana", local: "Llistes locals",
};

/**
 * Dotze eleccions en una sola imatge: cada columna és un ple i cada tros, una
 * força. Amb les sigles no es podria fer —canvien cada poques convocatòries—,
 * així que s'agrupa per força i les llistes locals van totes juntes, que és
 * exactament el que són a molts pobles: la política d'allà i prou.
 */
function renderFamilyHistory(history: ElectoralHistory): string {
  const present = new Set<string>();
  for (const point of history.series) for (const family of Object.keys(point.families)) present.add(family);
  const order = ["cup", "comuns", "erc", "psc", "ciu", "junts", "pdecat", "local", "cs", "pp", "vox", "aliancacat"];
  const families = order.filter((f) => present.has(f));

  const columns = history.series
    .map((point) => {
      const total = point.seats || 1;
      const winner = point.winnerFamily;
      const stack = families
        .filter((family) => (point.families[family] ?? 0) > 0)
        .map((family) => {
          const seats = point.families[family]!;
          const share = (100 * seats) / total;
          const { fons, tinta } = sobreColor(colorFamilia(family));
          return `<span class="tros${family === winner ? " guanya" : ""}"
            style="--c:${fons};--t:${tinta};--h:${share}%"
            title="${escape(FAMILY_NAMES[family] ?? family)}: ${seats} de ${point.seats} regidories">${
              share >= 12 ? seats : ""
            }</span>`;
        })
        .join("");
      return `<li>
      <span class="pila">${stack}</span>
      <span class="peu-any"><b>${point.year}</b><i>${point.seats}</i></span>
    </li>`;
    })
    .join("");

  const legend = families
    .map(
      // La mostra porta el mateix color que el tros: si `sobreColor()` n'ha
      // hagut de moure cap, es mouen tots dos i la clau continua sent la clau.
      (family) => `<li><span class="mostra" style="--c:${sobreColor(colorFamilia(family)).fons}"></span>${escape(
        FAMILY_NAMES[family] ?? family,
      )}</li>`,
    )
    .join("");

  return `<figure class="grafic">
  <div class="eleccions-marc">
    <span class="majoria" aria-hidden="true"></span>
    <ul class="eleccions" role="img" aria-label="${history.series
      .map((p) => `${p.year}: ${Object.entries(p.families).map(([f, n]) => `${FAMILY_NAMES[f] ?? f} ${n}`).join(", ")}`)
      .join("; ")}">${columns}</ul>
  </div>
  <ul class="clau">${legend}</ul>
  <figcaption>L'alçada de cada tros és la seva part del ple. La ratlla horitzontal és la
  <b>majoria absoluta</b>: qui la travessa, governa sol. Sota cada columna, l'any i les
  regidories que tenia el ple. La força més votada porta un contorn gruixut.</figcaption>
</figure>`;
}

/**
 * Els tipus impositius, sense comparar-los amb ningú.
 *
 * Els comparàvem amb la mediana catalana i el lector n'extreia «aquí es paga
 * poc IBI». És fals: sobre 823 municipis, la correlació entre el tipus i els
 * euros d'IBI que es recapten per habitant és de +0,08, o sigui cap. El que
 * mana és la base cadastral, i 601 dels 923 municipis tenen la ponència de
 * valors anterior a l'any 2000 —l'any de revisió correlaciona 2,5 vegades més
 * fort amb el que es paga que no pas el tipus.
 *
 * El tipus s'hi queda perquè és una decisió del ple i es vota cada any, però
 * sense comparació: comparar és afirmar, i aquí l'afirmació seria falsa. El que
 * es paga de veritat surt al bloc d'ingressos, en euros.
 */
function renderTaxes(taxes: TaxesMetric): string {
  const items = Object.entries(taxes.taxes)
    .filter(([, tax]) => tax.value > 0)
    .map(([key, tax]) => {
      const value = key === "cadastre" ? String(Math.round(tax.value)) : String(tax.value).replace(".", ",");
      return `<li><span class="nom">${escape(tax.label)}</span>
        <span class="gran">${value}${tax.unit && tax.unit !== "any" ? ` ${tax.unit}` : ""}</span></li>`;
    })
    .join("");
  return `<ul class="impostos">${items}</ul>
  <p class="nota">Tipus vigents el ${taxes.year}, tal com els declara cada ajuntament al mateix
  formulari. <b>No els comparem amb els d'altres municipis a propòsit</b>: un tipus més alt no
  vol dir un rebut més alt, perquè el que mana és el valor cadastral i la majoria de municipis
  el tenen revisat fa dècades. El que es paga de veritat és al bloc d'ingressos, en euros.</p>`;
}

/**
 * Una xifra per habitant només informa si es pot comparar amb dues coses: amb la
 * resta de conceptes de la mateixa llista i amb el que fan els altres municipis.
 * Per això totes les barres d'un bloc comparteixen escala —si cadascuna tingués
 * la seva, un import petit podria semblar més gran que un de gran— i la mediana
 * catalana hi va marcada damunt de la mateixa escala.
 */
function moneyRow(
  label: string,
  perHead: number,
  median: number | null | undefined,
  scale: number,
  grup: string | null,
): string {
  const euros = `${perHead.toFixed(perHead < 10 ? 2 : 0).replace(".", ",")} €`;
  const width = scale > 0 ? Math.min(100, (100 * perHead) / scale) : 0;
  const markAt = median && median > 0 && scale > 0 ? Math.min(100, (100 * median) / scale) : null;
  const ratio = median && median > 0 ? perHead / median : null;
  // «la mediana catalana» comparava un poble de 200 habitants amb Barcelona i
  // acabava dient el mateix a tothom d'una mateixa mida. Quan sabem amb qui
  // toca comparar, es diu.
  const contra = grup === null ? "la mediana catalana" : `el que és habitual ${grup}`;
  const comparison =
    ratio === null
      ? ""
      : ratio > 1.15
        ? `<span class="comparativa mes">${Math.round(100 * ratio - 100)} % per sobre ${escape(contra)}</span>`
        : ratio < 0.85
          ? `<span class="comparativa menys">${Math.round(100 - 100 * ratio)} % per sota ${escape(contra)}</span>`
          : `<span class="comparativa">a tocar ${escape(contra)}</span>`;
  return `<li>
    <span class="etq">${escape(label)}</span>
    <span class="imp">${euros}</span>
    <span class="regle">
      <i style="--w:${width.toFixed(1)}%"></i>
      ${markAt === null ? "" : `<b style="--m:${markAt.toFixed(1)}%"><span>habitual</span></b>`}
    </span>
    ${comparison}
  </li>`;
}

/** Escala del bloc: el més alt entre el valor màxim i la mediana més alta. */
function scaleFor(values: readonly number[], medians: Record<string, number | null>): number {
  const highest = Math.max(0, ...values, ...Object.values(medians).map((m) => m ?? 0));
  return highest === 0 ? 1 : highest * 1.06;
}

function renderRevenue(revenue: RevenueMetric): string {
  const medianes = revenue.medianesGrup ?? revenue.medians;
  const grup = revenue.grup?.etiqueta ?? null;
  const scale = scaleFor(revenue.figures.map((f) => f.perHead), medianes);
  const propis = revenue.figures.reduce((a, f) => a + f.perHead, 0);
  return `<ul class="diners">${revenue.figures
    .map((figure) => moneyRow(figure.label, figure.perHead, medianes[figure.label], scale, grup))
    .join("")}</ul>
  <p class="entrada-bloc"><b>${number(revenue.propis?.perHabitant ?? Math.round(propis))} € per
  habitant</b> en impostos i taxes municipals, sumant-ho tot.${
    revenue.propis?.medianaCatalunya
      ? ` A tot Catalunya, el més habitual són ${number(Math.round(revenue.propis.medianaCatalunya))} €.`
      : ""
  }</p>
  ${
    revenue.propis?.medianaCatalunya
      ? `<p class="nota">Aquesta xifra sí que la comparem amb tot Catalunya i no només amb els
         municipis de la mateixa mida: a diferència de la despesa, el que recapta un ajuntament
         per habitant amb els seus propis impostos gairebé no depèn de quanta gent hi viu
         (${revenue.propis.municipisAmbDada} municipis amb dada).</p>`
      : ""
  }
  <p class="nota">Recaptat el ${revenue.year}, en euros per habitant. La marca vertical és
  ${
    revenue.grup
      ? `el valor habitual dels ${revenue.grup.ambDada} municipis ${escape(revenue.grup.etiqueta)}
         dels quals tenim la liquidació`
      : "la mediana de tots els municipis catalans amb dada"
  }.
  És el que es recapta al terme dividit pels empadronats, no el que paga cada veí: on hi ha
  moltes segones residències, part de l'IBI el paga gent que no hi viu.</p>`;
}

function renderSpending(spending: SpendingMetric): string {
  const medianes = spending.medianesGrup ?? spending.medians;
  const grup = spending.grup?.etiqueta ?? null;
  const scale = scaleFor(spending.areas.map((a) => a.perHead), medianes);
  // Un percentil no es pot llegir sense saber què val: als municipis de més de
  // 50.000 habitants, entre el percentil 25 i el 75 hi ha 245 €/habitant. Dit en
  // euros del pressupost sencer, en canvi, s'entén sol.
  const mediaGrup = spending.totalMediaGrup ?? null;
  const poblacio = spending.poblacio ?? null;
  const diferencia =
    mediaGrup !== null && mediaGrup > 0 && poblacio !== null
      ? Math.round((spending.totalPerHead - mediaGrup) * poblacio)
      : null;
  const frase =
    diferencia === null || mediaGrup === null
      ? ""
      : `<p class="entrada-bloc"><b>${number(spending.totalPerHead)} € per habitant</b> en total.
         Als municipis ${escape(spending.grup?.etiqueta ?? "de la seva mida")} el més habitual és
         ${number(Math.round(mediaGrup))} €: gastant com ells, el pressupost seria
         <b>${number(Math.abs(diferencia))} € ${diferencia > 0 ? "més petit" : "més gran"}</b> cada any.</p>`;
  const auto = spending.autofinancament ?? null;
  const fraseAuto =
    auto === null
      ? ""
      : `<p class="entrada-bloc">De cada 100 € que gasta, <b>${Math.round(auto.pct)} surten
         d'impostos i taxes cobrats aquí</b>. Els altres ${Math.round(100 - auto.pct)} no:
         vénen de transferències d'altres administracions, d'altres ingressos o de deute.${
           auto.medianaGrup === null
             ? ""
             : ` Als municipis ${escape(spending.grup?.etiqueta ?? "de la seva mida")} el més
                habitual és que en surtin d'aquí ${Math.round(auto.medianaGrup)}.`
         }</p>
         <p class="nota">Com més baixa és aquesta proporció, més depèn el pressupost del poble de
         decisions que no es prenen al seu ple. No diu si l'ajuntament ho fa bé o malament: diu
         d'on surten els diners.</p>`;
  return `${frase}${fraseAuto}<ul class="diners">${spending.areas
    .map((area) => moneyRow(area.label, area.perHead, medianes[area.label], scale, grup))
    .join("")}</ul>
  <p class="nota">Liquidat el ${spending.year}. Les àrees són les de la classificació per
  programes, iguals per a tots els ajuntaments, i sumen el total.
  ${
    spending.areas.length < 6
      ? "Les que no hi surten són zero: l'ajuntament no hi destina res."
      : ""
  }</p>`;
}

/** Traducció mínima de com es gestiona el servei, que la font dona en castellà. */
function managementLabel(raw: string): string {
  const key = raw.toLowerCase();
  if (key.includes("no se presta")) return "no es presta";
  if (key.includes("directa")) return "gestió directa";
  if (key.includes("indirecta") || key.includes("contrat")) return "contractat";
  if (key.includes("consorcio") || key.includes("mancomun") || key.includes("comarca")) return "mancomunat";
  return raw.toLowerCase();
}

function renderServices(services: ServicesMetric): string {
  return `<ul class="serveis">${services.services
    .map((service) => {
      const median = services.medians[service.label];
      return `<li>
      <span class="etq">${escape(service.label)}</span>
      <span class="imp">${service.perHead.toFixed(2).replace(".", ",")} €</span>
      <span class="secundari">per habitant · ${escape(managementLabel(service.management))}${
        median ? ` · mediana catalana ${median.toFixed(2).replace(".", ",")} €` : ""
      }</span>
    </li>`;
    })
    .join("")}</ul>
  <p class="nota">Cost efectiu del ${services.year}, calculat amb el mateix criteri del Ministeri
  d'Hisenda per a tots els ajuntaments d'Espanya. És el que costa prestar el servei, no el que
  es cobra per ell.</p>`;
}

/**
 * Qui seu al ple, amb nom i cognoms.
 *
 * Són càrrecs públics i la seva identitat ja és oberta: la publica la
 * Generalitat. Publicar-la aquí és el que permet que algú es reconegui —o
 * reconegui el seu veí— i entengui que això va d'ell. Del càrrec i prou: cap
 * correu, cap adreça, cap telèfon.
 *
 * El color de la candidatura sí que hi va: aquí no és decoració d'interfície
 * sinó la manera més ràpida de veure com es reparteix el ple, i és el mateix
 * color que ja fa servir l'hemicicle de dues seccions més amunt.
 */
/**
 * El ple segons la seu electrònica del mateix ajuntament.
 *
 * És més al dia que el registre de la Generalitat —a Esplugues aquest hi tenia
 * un tinent d'alcaldia que ja no hi és i li faltaven dues regidores— i, sobre
 * tot, **etiqueta els regidors no adscrits**, que és una cosa que el conjunt
 * obert no diu enlloc i que nosaltres havíem renunciat a deduir.
 *
 * Les fotografies segueixen la regla del tot o res: o les té tot el ple o no
 * se'n mostra cap. Un ple on l'equip de govern surt amb retrat i l'oposició amb
 * inicials seria un tracte desigual que no hem triat però que publicaríem.
 */
function renderCarrecsSeue(fitxa: FitxaCarrecs, colorPer: (grup: string | null) => string): string {
  // La mateixa funció que fa servir el generador de pàgines de regidor, sobre la
  // mateixa llista i en el mateix ordre: així l'enllaç sempre existeix.
  const adreces = adrecesRegidors(fitxa.carrecs);
  const ambFoto = fitxa.cobertura === "completa";

  const groups = new Map<string, CarrecSeue[]>();
  for (const carrec of fitxa.carrecs) {
    const key = carrec.grup ?? "Sense grup";
    const list = groups.get(key);
    if (list) list.push(carrec);
    else groups.set(key, [carrec]);
  }

  const isMayor = (c: CarrecSeue): boolean => /alcald/i.test(c.carrec);
  const noAdscrit = (name: string): boolean => /no\s*adscri/i.test(name);
  const ordered = [...groups.entries()].sort((a, b) => {
    const mA = a[1].some(isMayor) ? 1 : 0;
    const mB = b[1].some(isMayor) ? 1 : 0;
    if (mA !== mB) return mB - mA;
    // Els no adscrits sempre al final: no són un grup, són el que en queda.
    const nA = noAdscrit(a[0]) ? 1 : 0;
    const nB = noAdscrit(b[0]) ? 1 : 0;
    if (nA !== nB) return nA - nB;
    return b[1].length - a[1].length;
  });

  const blocks = ordered
    .map(([name, list]) => {
      const alGovern = list.filter((c) => c.equipGovern).length;
      const members = [...list]
        .sort((a, b) => (isMayor(b) ? 1 : 0) - (isMayor(a) ? 1 : 0))
        .map((c) => {
          const inicials = c.nom
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((w) => w[0]!.toUpperCase())
            .join("");
          const retrat =
            ambFoto && c.fotoPetita
              ? `<img class="retrat" src="${escape(c.fotoPetita)}" alt="" loading="lazy" width="44" height="44">`
              : `<span class="retrat inicials" aria-hidden="true">${escape(inicials)}</span>`;
          // El nom porta a la nostra fitxa de la persona, no a la de la seu
          // electrònica: allà només hi ha el càrrec, i aquí hi ha també de quina
          // llista va sortir i què ha votat el seu grup. L'enllaç a l'original
          // continua al peu del bloc, que és on toca citar la font.
          const nom = `<a href="regidor/${escape(adreces.get(c) ?? slugify(c.nom))}/">${escape(c.nom)}</a>`;
          const classes = [isMayor(c) ? "alcaldia" : "", c.equipGovern ? "govern" : "oposicio"]
            .filter(Boolean)
            .join(" ");
          return `<li class="${classes}">
        ${retrat}
        <span class="dades"><span class="qui">${nom}</span>
        <span class="carrec">${escape(c.carrec)}</span></span>
        ${c.equipGovern ? '<span class="marca-govern">govern</span>' : ""}
      </li>`;
        })
        .join("");
      const totGovern = alGovern === list.length && alGovern > 0;
      return `<div class="grup${noAdscrit(name) ? " noadscrit" : ""}${totGovern ? " al-govern" : ""}" style="--c:${colorPer(name)}">
      <h3><span class="marca-grup"></span>${escape(name)}
        <span class="quants">${list.length}${
          alGovern > 0 ? (totGovern ? " · al govern" : ` · ${alGovern} al govern`) : ""
        }</span></h3>
      <ul>${members}</ul>
    </div>`;
    })
    .join("");

  // Qui forma el govern, que sovint no és un sol partit: de 453 municipis amb
  // la dada, 195 tenen regidors de més d'un grup a l'equip de govern. La fitxa
  // ho deia només a través de l'alcaldia, i això amagava totes les coalicions.
  const govern = fitxa.carrecs.filter((c) => c.equipGovern);
  const grupsGovern = [...new Set(govern.map((c) => c.grup).filter((g): g is string => Boolean(g)))];
  const resumGovern =
    govern.length === 0
      ? ""
      : `<p class="resum-govern">
      <b>${govern.length} ${govern.length === 1 ? "regidoria forma" : "regidories formen"} el govern</b>
      de ${fitxa.carrecs.length},
      ${
        grupsGovern.length > 1
          ? `en coalició de ${grupsGovern.length} grups: ${grupsGovern.map((g) => escape(g)).join(", ")}.`
          : grupsGovern.length === 1
            ? `totes de ${escape(grupsGovern[0]!)}.`
            : "."
      }</p>`;

  return `${resumGovern}<div class="plens${ambFoto ? " amb-retrats" : ""}">${blocks}</div>
  <p class="nota">Composició del ple segons la seu electrònica del mateix ajuntament,
  consultada el ${escape(fitxa.descarregat)}. Va més al dia que el registre de la Generalitat.
  ${
    ambFoto
      ? `Les fotografies les publica l'ajuntament al seu portal de transparència
         (<a href="${escape(fitxa.url)}" target="_blank" rel="noopener">fitxa original</a>);
         les reproduïm en mida petita i les retirem a la primera petició de la persona.`
      : fitxa.ambFoto > 0
        ? `L'ajuntament publica fotografia de ${fitxa.ambFoto} dels ${fitxa.totalCarrecs} càrrecs.
           Com que no les té tothom, no en mostrem cap: ensenyar-ne només algunes seria un
           tracte desigual.`
        : ""
  }
  Hi surten nom, càrrec i grup, que és el que deriva del càrrec públic; cap dada de contacte.</p>`;
}

function renderCouncillors(councillors: readonly Councillor[]): string {
  if (councillors.length === 0) return "";

  const groups = new Map<string, Councillor[]>();
  for (const councillor of councillors) {
    const key = councillor.sigles ?? councillor.groupName ?? "Sense grup";
    const list = groups.get(key);
    if (list) list.push(councillor);
    else groups.set(key, [councillor]);
  }

  // L'alcaldia primer, i després per mida del grup: és l'ordre en què la gent
  // s'ho mira.
  const isMayor = (c: Councillor): boolean => /alcald/i.test(c.role ?? "");
  const ordered = [...groups.entries()].sort((a, b) => {
    const mayorA = a[1].some(isMayor) ? 1 : 0;
    const mayorB = b[1].some(isMayor) ? 1 : 0;
    if (mayorA !== mayorB) return mayorB - mayorA;
    return b[1].length - a[1].length;
  });

  const blocks = ordered
    .map(([name, list]) => {
      const color = list.find((c) => c.color)?.color ?? "#8b8b8b";
      const members = [...list]
        .sort((a, b) => (isMayor(b) ? 1 : 0) - (isMayor(a) ? 1 : 0) || (a.orderNum ?? 99) - (b.orderNum ?? 99))
        .map(
          (c) => `<li${isMayor(c) ? ' class="alcaldia"' : ""}>
        <span class="qui">${escape(c.name)}</span>
        ${c.role ? `<span class="carrec">${escape(c.role)}</span>` : ""}
      </li>`,
        )
        .join("");
      return `<div class="grup" style="--c:${color}">
      <h3><span class="marca-grup"></span>${escape(name)}
        <span class="quants">${list.length} ${list.length === 1 ? "regidoria" : "regidories"}</span></h3>
      <ul>${members}</ul>
    </div>`;
    })
    .join("");

  return `<div class="plens">${blocks}</div>
  <p class="nota">Composició actual del ple segons el registre de càrrecs electes de la
  Generalitat. Hi surten el nom, el càrrec i el grup, que és el que deriva del càrrec públic;
  cap dada de contacte. Si hi ha un error o vols que retirem alguna cosa, escriu-nos.</p>`;
}

/**
 * Què publica l'ajuntament, ítem a ítem.
 *
 * **Aquí no s'afirma mai que un ajuntament NO publiqui una cosa.** El conjunt
 * de l'AOC no distingeix entre «l'ajuntament no ho publica» i «l'ítem no consta
 * al portal per a aquest ens», i publicar-ho com si fos el primer és acusar
 * algú d'opac amb una dada que no ho diu. Ho vam comprovar amb les declaracions
 * de béns d'Esplugues: al conjunt hi surten com a no publicades i a la seu hi
 * són.
 *
 * Per tant només es mostra el que hi consta com a publicat, amb l'any de
 * l'última actualització quan es pot afirmar, i la cobertura catalana com a
 * context. El que falti no es menciona.
 */
function renderTransparencyDetail(items: readonly EstatItem[]): string {
  const publicats = items.filter((i) => i.published && !i.notApplicable);
  if (publicats.length === 0) return "";

  const fila = (item: EstatItem): string => {
    const cat = item.catalunya;
    const quan =
      item.updatedYear && !item.bulk
        ? `<span class="quan">actualitzat el ${item.updatedYear}</span>`
        : "";
    return `<li class="hi-es">
      <span class="senyal" aria-hidden="true">✓</span>
      <span class="dades">
        <span class="nom">${escape(item.label)}</span>
        ${cat ? `<span class="secundari">el publiquen ${number(cat.published)} dels ${number(cat.of)} ajuntaments catalans</span>` : ""}
      </span>
      ${quan}
    </li>`;
  };

  return `<ul class="transparencia">${publicats.map(fila).join("")}</ul>
  <p class="nota">Apartats del portal de transparència que hi consten publicats, amb quants
  ajuntaments catalans publiquen cadascun. <b>El que no surti en aquesta llista no vol dir
  que l'ajuntament no ho publiqui</b>: el conjunt del Consorci AOC no distingeix entre un
  apartat que no s'ha omplert i un que no hi consta, i no volem acusar ningú d'opac amb una
  dada que no ho diu.</p>`;
}

function renderMayors(mayorsMetric: MayorsMetric): string {
  const history = [...mayorsMetric.history].sort((a, b) => b.term.localeCompare(a.term));
  const rows = history.map((m, i) => {
    const change = mayorsMetric.changes.find((c) => c.term === m.term);
    const late = change?.onlySuccessorKnown && change.mayors[0]?.name === m.name;
    // Un mandat amb dues files és un relleu a mig mandat, i és el que més
    // s'entén malament d'aquesta taula: sense marcar-ho sembla una dada
    // repetida. La cel·la del mandat, doncs, només s'escriu al primer.
    const repeteix = history[i - 1]?.term === m.term;
    const familia = m.partyRaw ? siglesFamily(m.partyRaw) : null;
    const color = familia ? BRANDS_BY_ID.get(familia)?.color : undefined;
    const marca = color ? `<span class="punt-partit" style="--c:${color}" aria-hidden="true"></span>` : "";
    return `<tr${repeteix ? ' class="mateix-mandat"' : ""}>
      <th scope="row">${repeteix ? `<span class="nomes-lectors">${escape(m.term)}</span>` : escape(m.term)}</th>
      <td>${escape(nomLlegible(m.name))}${late ? ' <span class="marca-canvi">va arribar a mig mandat</span>' : ""}</td>
      <td class="partit">${marca}${escape(m.partyRaw ?? "—")}</td>
      <td class="secundari">${m.tookOfficeOn ? formatDate(m.tookOfficeOn) : ""}</td>
    </tr>`;
  });
  return `<table class="alcaldies"><thead><tr><th>Mandat</th><th>Alcaldia</th><th>Partit</th><th>Des de</th></tr></thead><tbody>${rows.join("")}</tbody></table>`;
}

// ------------------------------------------------------------------- pàgina

export type RadiografiaData = {
  municipality: typeof municipalities.$inferSelect;
  results: ResultsMetric;
  government: GovernmentMetric | null;
  parity: ParityMetric | null;
  mayors: MayorsMetric | null;
  finances: FinancesMetric | null;
  history: ElectoralHistory | null;
  taxes: TaxesMetric | null;
  transparency: TransparencyMetric | null;
  singleList: boolean;
  revenue: RevenueMetric | null;
  spending: SpendingMetric | null;
  services: ServicesMetric | null;
  councilChanges: CouncilChangesMetric | null;
  councillors: Councillor[];
  carrecs: FitxaCarrecs | null;
  mocions: MocionsMetric | null;
  residus: ResidusMetric | null;
  habitatge: HabitatgeMetric | null;
  /** Qui hi viu (J18). És context, no gestió: l'ajuntament no ho decideix. */
  poblacio: PoblacioMetric | null;
  /** El preu de l'aigua del full de l'ACA (J19). */
  preuAigua: PreuAiguaMetric | null;
  /** El rebut mitjà d'IBI urbà de l'Idescat (J19). */
  rebutIbi: RebutIbiMetric | null;
  /** La despesa liquidada per programes, en euros per habitant (J15). */
  despesaProgrames: DespesaProgramesMetric | null;
  /**
   * Pertinença a l'Àrea Metropolitana de Barcelona.
   *
   * Per a 36 municipis, una part del que paguen i del que reben no ho decideix
   * el seu ajuntament ni el seu consell comarcal: el transport, l'aigua i el
   * tractament de residus són de l'AMB, i el seu Consell no el vota ningú en
   * una papereta. Dir-ho a la fitxa és tan important com dir qui hi governa.
   */
  amb: { member: boolean; municipis: number; materies: string[] } | null;
  participation: (typeof electionParticipation.$inferSelect)[];
  /** Incidències obertes que afecten aquest municipi, si n'hi ha. */
  issues: { kind: string; severity: string; entity: string | null; detail: unknown }[];
  generatedAt: string;
};

/** Què vol dir cada incidència, dita perquè s'entengui sense saber què és un job. */
const ISSUE_TEXT: Record<string, string> = {
  seats_mismatch:
    "el nostre recompte de la llei d'Hondt no reprodueix exactament els escons oficials d'alguna candidatura",
  council_size_mismatch: "el nombre de regidories no quadra amb el que li tocaria per població",
  mayor_party_unmatched: "no hem pogut lligar el partit de l'alcaldia amb cap llista del 2023",
  slug_collision: "el nom d'aquest municipi coincideix amb el d'un altre i hem hagut de desambiguar-lo",
  open_list_unmatched: "no hem pogut confirmar quin sistema electoral s'hi aplica",
};

/**
 * El resum en una frase. Qui obre la fitxa d'un poble vol saber tres coses
 * abans de fer scroll: qui mana, si va guanyar i si mana sol. La resta de la
 * pàgina és per a qui ho vulgui comprovar.
 */
function summarySentence(
  data: RadiografiaData,
  colorPer?: (sigles: string | null) => string,
): string {
  const government = data.government;
  if (!government?.mayorName) return "";
  // Les sigles van amb el color del seu partit i no amb el coral de la casa: a
  // la frase «governa X tot i que la més votada va ser Y» hi ha dos partits
  // diferents, i pintar-los iguals els feia semblar el mateix. Van sobre fons de
  // color amb la tinta triada per lluminància, perquè escrites amb el color del
  // partit damunt del paper n'hi ha que no es llegeixen: el groc d'ERC sobre
  // crema queda per sota de qualsevol mínim de contrast.
  const pastilla = (sigles: string | null): string => {
    const text = sigles ?? "?";
    if (!colorPer) return `<b>${escape(text)}</b>`;
    const color = colorPer(sigles);
    const { fons, tinta } = sobreColor(color);
    return `<b class="sigla" style="--c:${fons};--t:${tinta}">${escape(text)}</b>`;
  };
  const parts: string[] = [
    government.winnerGoverns === false
      ? `Governa ${pastilla(government.mayorSigles)} tot i que la llista més votada va ser ${pastilla(government.winnerSigles)}`
      : `Governa ${pastilla(government.mayorSigles ?? government.winnerSigles)}, la llista més votada`,
    government.winnerHasMajority ? "amb majoria absoluta" : "sense majoria absoluta",
  ];
  if (data.mayors?.currentTermChange) parts.push("i l'alcaldia ha canviat a mig mandat");
  return `${parts.join(", ")}.`;
}

/**
 * Qui és l'alcalde o l'alcaldessa, amb cara si l'ajuntament en publica.
 *
 * Va just sota del resum perquè «qui mana» és una persona abans que unes sigles,
 * i perquè un nom amb cara es recorda i unes sigles no. Sense fotografia no
 * queda un buit: hi van les inicials amb el color del partit.
 */
function renderAlcaldia(
  nom: string,
  carrec: string,
  sigles: string | null,
  color: string,
  foto: string | null,
  slugFitxa: string | null,
): string {
  const inicials = nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  const { fons, tinta } = sobreColor(color);
  const cara = foto
    ? `<img class="cara-alcaldia" src="${escape(foto)}" alt="" width="52" height="52" loading="lazy">`
    : `<span class="cara-alcaldia inicials" style="--c:${fons};--t:${tinta}" aria-hidden="true">${escape(inicials)}</span>`;
  const etiqueta = `${escape(carrec)}${sigles ? ` · <b class="sigla" style="--c:${fons};--t:${tinta}">${escape(sigles)}</b>` : ""}`;
  return `<p class="alcaldia">${cara}<span class="qui-mana">
    <span class="nom-alcaldia">${slugFitxa ? `<a href="regidor/${escape(slugFitxa)}/">${escape(nom)}</a>` : escape(nom)}</span>
    <span class="carrec-alcaldia">${etiqueta}</span></span></p>`;
}

// ----------------------------------------------------- qui hi viu i què paga

/** Un decimal amb la coma catalana. `number()` ja fa els milers. */
const decimal = (n: number, d: number): string => n.toFixed(d).replace(".", ",");
/** El signe d'una variació, amb el menys tipogràfic. */
const signeDe = (n: number): string => (n > 0 ? "+" : n < 0 ? "−" : "");

/**
 * L'enllaç de l'Idescat d'una xifra, tal com el dona l'API.
 *
 * Sense això no es pot publicar res d'aquesta font: les condicions d'ús ho
 * demanen explícitament i no ens autoritzen a modificar l'enllaç. Per això la
 * funció no en construeix cap; o el porta la dada o no surt la xifra.
 */
function enllacIdescat(enllac: EnllacIdescat | null): string {
  if (!enllac) return "";
  return `<a class="font-idescat" href="${escape(enllac.href)}" rel="noopener nofollow">${escape(enllac.titol)} · Idescat</a>`;
}

function indicadorDe(poblacio: PoblacioMetric, clau: string): IndicadorPoblacio | null {
  return poblacio.indicadors.find((i) => i.clau === clau) ?? null;
}

/** El canvi del mandat amb el mateix canvi als seus al costat, mai sol. */
function canviAmbGrup(mandat: Variacio, grup: MandatGrup | null | undefined, unitat: string): string {
  // Un recompte de persones va sencer i sense decimals; qualsevol altra unitat
  // en porta un i s'escriu al costat de la xifra. Un «+14» pelat al costat d'un
  // «+8,1» no diu de què parla, i aquí de vegades són euros i de vegades punts.
  const sufix = unitat === "%" ? " punts" : unitat === "persones" ? "" : ` ${unitat}`;
  const escriu = (n: number): string =>
    unitat === "persones"
      ? `${signeDe(n)}${number(Math.round(Math.abs(n)))}`
      : `${signeDe(n)}${decimal(Math.abs(n), 1)}${sufix}`;
  const seus =
    grup && grup.diferencia !== null
      ? ` · als ${grup.municipis} de la seva mida, ${escriu(grup.diferencia)}`
      : " · sense comparació de grup";
  return `<span class="sub canvi">Del ${mandat.desDe} al ${mandat.fins}: <b>${escriu(mandat.diferencia)}</b>${escape(seus)}</span>`;
}

/** Una xifra de població, amb què compta i d'on surt. */
function fitxaGent(ind: IndicadorPoblacio | null): string {
  if (!ind || ind.valor === null || ind.darrerAny === null) return "";
  const val =
    ind.unitat === "%"
      ? percent(ind.valor)
      : ind.unitat === "anys"
        ? `${decimal(ind.valor, 1)} anys`
        : number(ind.valor);
  // La xifra de Catalunya només hi va quan es pot comparar de veritat: un
  // percentatge o una edat mitjana. El recompte d'infants de tot Catalunya al
  // costat del d'un poble no compara res, només fa soroll.
  const cat =
    (ind.unitat === "%" || ind.unitat === "anys") && ind.catalunya?.valor != null
      ? `<span class="sub">A tot Catalunya, ${ind.unitat === "%" ? percent(ind.catalunya.valor) : `${decimal(ind.catalunya.valor, 1)} anys`}.</span>`
      : "";
  return `<li>
    <span class="etq">${escape(ind.etiqueta)}</span>
    <span class="gran">${val}</span>
    ${ind.mandat ? canviAmbGrup(ind.mandat, ind.mandatDelGrup, ind.unitat) : ""}
    ${cat}
    <p class="compta">${escape(ind.compta)}</p>
    ${enllacIdescat(ind.enllac)}
  </li>`;
}

/**
 * Qui hi viu.
 *
 * Tres coses manen en aquest bloc i cadascuna ve d'un error que ja s'ha comès.
 *
 * **La primera: nacionalitat, lloc de naixement i «immigrant» són tres coses
 * diferents.** A Sabadell el 15,2 % té nacionalitat estrangera i el 20,9 % ha
 * nascut a l'estranger: 12.808 persones de diferència al mateix poble el
 * mateix any, perquè 15.780 nascudes fora tenen nacionalitat espanyola i 2.970
 * estrangers han nascut aquí. Aquí es pinten **les dues xifres**, cadascuna amb
 * el text de què compta que ja porta la dada, i **no se'n calcula cap tercera**:
 * no hi ha cap suma ni cap resta en aquest bloc que barregi les dues
 * definicions, perquè el resultat no voldria dir res i s'entendria com un
 * col·lectiu de persones que no existeix.
 *
 * **La segona: això no ho decideix l'ajuntament**, i es diu a dalt de tot i no
 * en una nota al peu. Un govern no decideix qui neix ni qui es muda. El que sí
 * que en depèn és què hi fa: bressols, atenció domiciliària, habitatge.
 *
 * **La tercera: la llicència de l'Idescat obliga a mostrar l'enllaç.** No és
 * opcional ni és un detall de crèdits: si aquest municipi no en té cap, el bloc
 * no es publica.
 */
export function renderQuiHiViu(poblacio: PoblacioMetric): string {
  // Sense enllaços de l'Idescat no podem publicar les seves dades. Preferim un
  // bloc que falta a un bloc que incompleix la llicència de la font.
  if (poblacio.font.enllacosMunicipi.length === 0) return "";
  const cens = indicadorDe(poblacio, "censHabitants");
  if (!cens || cens.valor === null || cens.darrerAny === null) return "";

  const padro = indicadorDe(poblacio, "padroHabitants");
  const pc = poblacio.padroContraCens;
  const div = poblacio.divergencia;
  const nacionalitat = indicadorDe(poblacio, "nacionalitatEstrangera");
  const pctNacionalitat = indicadorDe(poblacio, "pctNacionalitatEstrangera");
  const nascuts = indicadorDe(poblacio, "nascutsAEstranger");
  const pctNascuts = indicadorDe(poblacio, "pctNascutsAEstranger");

  const capcalera = `<p class="entrada-bloc">El cens del ${cens.darrerAny} hi compta
    <b>${number(cens.valor)} persones</b>.${
      cens.mandat
        ? ` Del ${cens.mandat.desDe} ençà, ${signeDe(cens.mandat.diferencia)}${number(Math.abs(Math.round(cens.mandat.diferencia)))}
           ${Math.abs(Math.round(cens.mandat.diferencia)) === 1 ? "persona" : "persones"}${
             cens.mandat.percentual === null
               ? ""
               : ` (${signeDe(cens.mandat.percentual)}${decimal(Math.abs(cens.mandat.percentual), 1)} %)`
           }${
             cens.mandatDelGrup && cens.mandatDelGrup.percentual !== null
               ? `, quan als ${cens.mandatDelGrup.municipis} municipis de la seva mida la variació habitual ha estat
                  ${signeDe(cens.mandatDelGrup.percentual)}${decimal(Math.abs(cens.mandatDelGrup.percentual), 1)} %`
               : ""
           }.`
        : ""
    }</p>`;

  // El context va aquí dalt i no al peu: si es llegeix després de les xifres,
  // ja s'han llegit com un mèrit o com una culpa.
  const context = poblacio.context.decideixLAjuntament
    ? ""
    : `<p class="context-avis"><b>Això no ho decideix l'ajuntament.</b> ${escape(poblacio.context.nota)}</p>`;

  const padroBloc =
    padro && padro.valor !== null && pc
      ? `<p class="apart"><b>Al padró n'hi ha ${number(pc.padro)}</b>, ${
          pc.persones === 0
            ? "exactament els mateixos"
            : `${number(Math.abs(pc.persones))} ${Math.abs(pc.persones) === 1 ? "persona" : "persones"} ${pc.persones > 0 ? "més" : "menys"}${
                pc.percentual === null ? "" : ` (${signeDe(pc.percentual)}${decimal(Math.abs(pc.percentual), 1)} %)`
              }`
        }. ${escape(pc.nota)}${
          pc.divergeix
            ? " <b>Aquí la diferència és prou gran per tenir-la en compte:</b> segons quina de les dues xifres es faci servir, el poble té una mida diferent."
            : ""
        } ${escape(padro.compta)}</p>`
      : "";

  // Les dues xifres que la gent confon, una al costat de l'altra, cadascuna amb
  // què compta. Cap de les dues no és «immigrants» i no en surt cap tercera.
  const origens =
    nacionalitat && nacionalitat.valor !== null && nascuts && nascuts.valor !== null
      ? `<h3 class="subtitol">D'on ve la gent: dues xifres que no compten el mateix</h3>
      <ul class="origens">
        <li>
          <span class="etq">${escape(nacionalitat.etiqueta)}</span>
          <span class="gran">${number(nacionalitat.valor)}</span>
          ${
            pctNacionalitat?.valor != null
              ? `<span class="sub">${percent(pctNacionalitat.valor)} de la població censada${
                  pctNacionalitat.catalunya?.valor != null
                    ? ` · a tot Catalunya, ${percent(pctNacionalitat.catalunya.valor)}`
                    : ""
                }</span>`
              : ""
          }
          <p class="compta">${escape(nacionalitat.compta)}</p>
          ${enllacIdescat(nacionalitat.enllac)}
        </li>
        <li>
          <span class="etq">${escape(nascuts.etiqueta)}</span>
          <span class="gran">${number(nascuts.valor)}</span>
          ${
            pctNascuts?.valor != null
              ? `<span class="sub">${percent(pctNascuts.valor)} de la població censada${
                  pctNascuts.catalunya?.valor != null ? ` · a tot Catalunya, ${percent(pctNascuts.catalunya.valor)}` : ""
                }</span>`
              : ""
          }
          <p class="compta">${escape(nascuts.compta)}</p>
          ${enllacIdescat(nascuts.enllac)}
        </li>
      </ul>
      ${
        div
          ? `<p class="avis-definicions"><b>Entre les dues xifres hi ha ${number(div.persones)}
             ${div.persones === 1 ? "persona" : "persones"} de diferència</b>${
               div.mesGran === "iguals" ? "" : `, i la més alta és la del ${escape(div.mesGran)}`
             }. ${escape(div.nota)}</p>`
          : ""
      }
      ${
        poblacio.creuament &&
        (poblacio.creuament.nascutsForaAmbNacionalitatEspanyola !== null ||
          poblacio.creuament.estrangersNascutsAEspanya !== null)
          ? `<p class="apart">Per què es diferencien, segons la taula creuada del ${poblacio.creuament.any}:
             ${
               poblacio.creuament.nascutsForaAmbNacionalitatEspanyola !== null
                 ? `<b>${number(poblacio.creuament.nascutsForaAmbNacionalitatEspanyola)} persones nascudes fora d'Espanya tenen nacionalitat espanyola</b>`
                 : ""
             }${
               poblacio.creuament.nascutsForaAmbNacionalitatEspanyola !== null &&
               poblacio.creuament.estrangersNascutsAEspanya !== null
                 ? " i "
                 : ""
             }${
               poblacio.creuament.estrangersNascutsAEspanya !== null
                 ? `<b>${number(poblacio.creuament.estrangersNascutsAEspanya)} persones estrangeres han nascut a Espanya</b>`
                 : ""
             }.</p>
             <p class="nota">${escape(poblacio.creuament.nota)}</p>`
          : ""
      }`
      : "";

  // L'estructura d'edats que sí que té conseqüències municipals: qui va a
  // bressol i qui necessita atenció a casa.
  const edats = [
    fitxaGent(indicadorDe(poblacio, "infants0a2")),
    fitxaGent(indicadorDe(poblacio, "pct65iMes")),
    fitxaGent(indicadorDe(poblacio, "de85iMes")),
    fitxaGent(indicadorDe(poblacio, "edatMitjana")),
  ].join("");
  const blocEdats = edats
    ? `<h3 class="subtitol">Quines edats hi ha</h3>
       <ul class="gent">${edats}</ul>`
    : "";

  const cera = fitxaGent(indicadorDe(poblacio, "residentsAEstranger"));
  const blocCera = cera
    ? `<h3 class="subtitol">I els que hi consten però no hi viuen</h3>
       <ul class="gent">${cera}</ul>`
    : "";

  const fonts = `<h3 class="subtitol">Les taules d'aquest municipi a l'Idescat</h3>
    <ul class="fonts-idescat">${poblacio.font.enllacosMunicipi
      .map((e) => `<li><a href="${escape(e.href)}" rel="noopener nofollow">${escape(e.titol)}</a></li>`)
      .join("")}</ul>
    <p class="nota">${escape(poblacio.font.llicencia.obliga)} Les condicions d'ús de les seves API són
    a <a href="${escape(poblacio.font.llicencia.condicions)}" rel="noopener nofollow">idescat.cat</a>.</p>`;

  return `${capcalera}${context}${padroBloc}${origens}${blocEdats}${blocCera}${fonts}`;
}

/** El model de gestió del servei tal com l'escriu el full de l'ACA. */
function etiquetaGestio(gestio: PreuAiguaMetric["gestio"]): string {
  const brut = gestio.subministrament;
  if (!brut) return "";
  const clau = brut.trim().toLowerCase();
  const nom = clau.startsWith("directa")
    ? "gestió directa"
    : clau.startsWith("indirecta")
      ? "gestió indirecta"
      : clau.startsWith("no presta")
        ? "no el presta l'ajuntament"
        : brut.toLowerCase();
  return gestio.gestora ? `${nom}, a càrrec de ${gestio.gestora}` : nom;
}

/**
 * Què paga la gent: l'aigua i l'IBI.
 *
 * L'aigua porta tres paranys, tots tres ja resolts a la dada i tots tres
 * respectats aquí:
 *
 *  1. **El TOTAL no és el rebut sencer a tot arreu.** El camp `comparable` diu
 *     quin tram es pot comparar entre municipis —el subministrament— i, quan el
 *     total no inclou el clavegueram, `avisRebut` porta escrit per què. La
 *     xifra gran del bloc és la comparable; el total hi surt amb l'avís al
 *     costat, no sol.
 *  2. **Una variació només és interpretable si les tarifes s'han revisat el
 *     2024 o després.** Si no, un preu clavat no vol dir «aquest govern no l'ha
 *     apujat», vol dir «ningú no hi ha tocat». Quan `interpretable.valida` és
 *     fals no es publica cap variació: es publica el motiu.
 *  3. **El cànon no és municipal.** El fixa la Generalitat i va sempre a part.
 *
 * I la tarifa social ve com a `true` o `null`, mai `false`: al full de l'ACA una
 * casella buida no està definida, i llegir-la com un «no» seria acusar de no
 * tenir-ne un municipi que potser en té.
 *
 * De l'IBI només se'n publica la variació quan la dada diu que és atribuïble al
 * ple (`publicable`). Si hi ha hagut revisió cadastral, el que ha pujat és la
 * base i no el tipus, i això no ho decideix ningú de l'ajuntament: llavors hi va
 * el motiu i no la xifra.
 */
export function renderQuePaga(aigua: PreuAiguaMetric | null, ibi: RebutIbiMetric | null): string {
  const trossos: string[] = [];

  if (aigua && aigua.preu.subministrament !== null) {
    const comparat =
      aigua.comparacio !== null
        ? `<span class="sub">Als ${aigua.comparacio.grup.ambDada} municipis ${escape(aigua.comparacio.grup.etiqueta)}
           el més habitual són ${decimal(aigua.comparacio.mediana, 3)} €.</span>`
        : "";
    const variacio =
      aigua.interpretable.valida && aigua.mandat.subministrament
        ? `<p class="apart">Del ${aigua.mandat.subministrament.desDe} al ${aigua.mandat.subministrament.fins} el
           subministrament ha passat de ${decimal(aigua.mandat.subministrament.inici, 3)} € a
           ${decimal(aigua.mandat.subministrament.final, 3)} €${
             aigua.mandat.subministrament.percentual === null
               ? ""
               : ` (<b>${signeDe(aigua.mandat.subministrament.percentual)}${decimal(Math.abs(aigua.mandat.subministrament.percentual), 1)} %</b>)`
           }${
             aigua.mandatDelGrup.subministrament?.mediana != null
               ? `. Als ${aigua.mandatDelGrup.subministrament.municipis} municipis de la seva mida amb la
                  variació interpretable, la mediana ha estat
                  ${signeDe(aigua.mandatDelGrup.subministrament.mediana)}${decimal(Math.abs(aigua.mandatDelGrup.subministrament.mediana), 1)} %`
               : ""
           }.</p>`
        : `<p class="avis-dada"><b>Aquí no es pot dir si el preu ha pujat durant el mandat</b>${
            aigua.interpretable.motiu ? `: ${escape(aigua.interpretable.motiu)}` : "."
          }</p>`;
    const total =
      aigua.preu.total === null
        ? ""
        : `<p class="apart">El full de l'ACA hi dona un total de <b>${decimal(aigua.preu.total, 3)} € per metre cúbic</b>${
            aigua.preu.canon === null ? "" : `, dels quals ${decimal(aigua.preu.canon, 3)} € són el cànon`
          }.${aigua.avisRebut ? "" : " Inclou el clavegueram i la depuració."}</p>${
            aigua.avisRebut ? `<p class="avis-dada">${escape(aigua.avisRebut)}</p>` : ""
          }`;
    const canon =
      aigua.canon.ara === null
        ? ""
        : `<p class="nota"><b>El cànon (${decimal(aigua.canon.ara, 3)} €) no és municipal.</b> ${escape(aigua.canon.nota)}</p>`;
    const gestio = etiquetaGestio(aigua.gestio);
    const canvis = aigua.gestio.canvis.filter((c) => c.delMandat);
    const blocGestio = gestio
      ? `<p class="apart">El servei de subministrament és de <b>${escape(gestio)}</b>.${
          canvis.length > 0
            ? ` El model ha canviat durant aquest mandat (${canvis.map((c) => c.year).join(", ")}).`
            : ""
        }</p>`
      : "";
    // `true` o `null`, mai `false`: el buit del full no vol dir que no en tinguin.
    const social =
      aigua.tarifaSocial.ara === true
        ? `<p class="apart">Hi consta <b>tarifa social</b>${
            aigua.tarifaSocial.desDe === null ? "" : ` des del ${aigua.tarifaSocial.desDe}`
          }${aigua.tarifaSocial.creadaAquestMandat ? ", estrenada aquest mandat" : ""}.</p>`
        : `<p class="apart"><b>De tarifa social, la font no en diu res.</b></p>
           <p class="nota">${escape(aigua.tarifaSocial.nota)}</p>`;

    trossos.push(`<h3 class="subtitol">L'aigua</h3>
    <ul class="preus">
      <li>
        <span class="etq">Subministrament, el tram comparable</span>
        <span class="gran">${decimal(aigua.preu.subministrament, 3)} €</span>
        <span class="sub">per metre cúbic, el ${aigua.darrerAny}</span>
        ${comparat}
      </li>
    </ul>
    ${total}${variacio}${canon}${blocGestio}${social}
    <p class="nota">Preus del full de tarifes de l'Agència Catalana de l'Aigua${
      aigua.font.dataActualitzacio ? `, actualitzat el ${escape(aigua.font.dataActualitzacio)}` : ""
    }${aigua.dataRevisio ? `. Aquest municipi va revisar les tarifes el ${escape(aigua.dataRevisio)}` : ""}.
    La xifra que es pot comparar entre municipis és la del <b>${escape(aigua.comparable)}</b>.</p>`);
  }

  if (ibi && ibi.rebutMitja !== null) {
    const comparat =
      ibi.comparacio !== null
        ? `<span class="sub">Als ${ibi.comparacio.grup.ambDada} municipis ${escape(ibi.comparacio.grup.etiqueta)}
           el més habitual són ${number(Math.round(ibi.comparacio.mediana))} €.</span>`
        : "";
    const variacio =
      ibi.publicable && ibi.mandat
        ? `<p class="apart">Del ${ibi.mandat.desDe} al ${ibi.mandat.fins} el rebut mitjà ha passat de
           ${number(Math.round(ibi.mandat.inici))} € a ${number(Math.round(ibi.mandat.final))} €${
             ibi.mandat.percentual === null
               ? ""
               : ` (<b>${signeDe(ibi.mandat.percentual)}${decimal(Math.abs(ibi.mandat.percentual), 1)} %</b>)`
           }${
             ibi.mandatDelGrup?.mediana != null
               ? `. Als ${ibi.mandatDelGrup.municipis} municipis de la seva mida on la variació és atribuïble al ple,
                  la mediana ha estat ${signeDe(ibi.mandatDelGrup.mediana)}${decimal(Math.abs(ibi.mandatDelGrup.mediana), 1)} %`
               : ""
           }.</p>`
        : `<p class="avis-dada"><b>D'aquest municipi no en publiquem la variació del mandat</b>${
            ibi.motius.length > 0 ? `: ${escape(ibi.motius.join("; "))}` : "."
          }</p>`;
    trossos.push(`<h3 class="subtitol">L'IBI</h3>
    <ul class="preus">
      <li>
        <span class="etq">Rebut mitjà d'IBI urbà</span>
        <span class="gran">${number(Math.round(ibi.rebutMitja))} €</span>
        <span class="sub">l'any, el ${ibi.darrerAny}${ibi.provisional ? " (dada provisional)" : ""}${
          ibi.rebuts === null ? "" : ` · ${number(ibi.rebuts)} rebuts`
        }</span>
        ${comparat}
      </li>
    </ul>
    ${variacio}
    <p class="nota">${escape(ibi.base)} No és el tipus impositiu que vota el ple: dos pobles amb el
    mateix tipus tenen rebuts diferents si el cadastre els valora diferent.
    <a href="${escape(ibi.font.url)}" rel="noopener nofollow">${escape(ibi.font.nom)} · Idescat</a>.</p>`);
  }

  return trossos.join("");
}

/**
 * Els diners de les escombraries al costat del que se n'ha recollit bé.
 *
 * És la comparació que més val de tot el projecte i la primera que podem fer:
 * J15 desa els euros per habitant del programa 1602 any a any i J9 desa la taxa
 * de recollida selectiva amb la mateixa base temporal. Junts converteixen una
 * partida del pressupost en un resultat que es pot veure al carrer.
 *
 * Dues regles hi manen. La primera: **zero no és el mateix que «no en tenim la
 * dada»**. Un exercici sense liquidar es diu que no s'ha liquidat; un import de
 * 0 € vol dir que l'ajuntament ha presentat els comptes i no hi ha destinat cap
 * euro, i és una decisió. La segona: **cap veredicte**. Gastar més no és fer-ho
 * millor ni pitjor; hi ha les dues sèries i la de la seva mida, i qui llegeix
 * que jutgi.
 */
export function renderEscombraries(
  despesa: DespesaProgramesMetric | null,
  residus: ResidusMetric | null,
): string {
  const programa = despesa?.programes.find((p) => p.codi === "1602") ?? null;
  if (!programa || !residus) return "";

  const desDe = despesa!.mandat.actual;
  const anys = [
    ...new Set([
      ...programa.serie.filter((p) => p.any >= desDe).map((p) => p.any),
      ...residus.serie.filter((p) => p.any >= desDe).map((p) => p.any),
    ]),
  ].sort((a, b) => a - b);
  if (anys.length < 2) return "";

  const files = anys
    .map((any) => {
      const euros = programa.serie.find((p) => p.any === any) ?? null;
      const taxa = residus.serie.find((p) => p.any === any) ?? null;
      // Un exercici sense liquidar no és un zero, i es diu.
      const cellaEuros =
        euros === null || !euros.liquidacio
          ? `<td class="buit">sense liquidar</td>`
          : euros.perHabitant === null
            ? `<td class="buit">—</td>`
            : `<td>${decimal(euros.perHabitant, 1)} €</td>`;
      const cellaTaxa =
        taxa === null || taxa.taxaSelectiva === null
          ? `<td class="buit">—</td>`
          : `<td>${percent(taxa.taxaSelectiva)}</td>`;
      return `<tr><th scope="row">${any}</th>${cellaEuros}${cellaTaxa}</tr>`;
    })
    .join("");

  const canvi = (
    etiqueta: string,
    variacio: Variacio | null | undefined,
    grup: MandatGrup | null | undefined,
    unitat: string,
  ): string => {
    if (!variacio) return "";
    return `<li><span class="etq">${escape(etiqueta)}</span>
      ${canviAmbGrup(variacio, grup, unitat)}</li>`;
  };

  const cobertura = programa.cobertura;
  return `<p class="entrada-bloc">Els euros que hi van i el que se'n recull bé, any a any i amb la
  mateixa base temporal. És l'única manera de mirar un pressupost i veure què n'ha sortit.</p>
  <div class="taula-envolta">
  <table class="euros-resultat">
    <caption class="nomes-lectors">Despesa en escombraries i taxa de recollida selectiva, any a any</caption>
    <thead><tr><th scope="col">Any</th><th scope="col">Escombraries</th><th scope="col">Recollida selectiva</th></tr></thead>
    <tbody>${files}</tbody>
  </table>
  </div>
  <ul class="canvis-parell">
    ${canvi("Despesa en escombraries", programa.mandat, programa.mandatDelGrup, "€/hab")}
    ${canvi("Recollida selectiva", residus.mandat, residus.mandatDelGrup, "%")}
  </ul>
  <p class="nota">${escape(programa.perque)}</p>
  <p class="nota">La despesa és en euros per habitant d'obligacions reconegudes netes, sense
  descomptar la inflació.${
    cobertura
      ? ` Dels ${cobertura.ambLiquidacio} ajuntaments que van liquidar el ${despesa!.anyComparable},
         ${cobertura.ambImport} hi destinen alguna cosa i ${cobertura.ambZero} no hi destinen ni un euro.`
      : ""
  } <b>${escape(despesa!.zeroIBuit)}</b></p>
  <p class="nota">No hi posem cap veredicte: gastar-hi més no vol dir fer-ho millor, i reciclar més
  amb menys diners tampoc no vol dir que la despesa sobri. Hi són les dues sèries i les dels seus.</p>`;
}

/**
 * Com ha anat el mandat, i comparat amb qui.
 *
 * Tota la resta de la fitxa és una foto de l'últim any. Un nivell no jutja un
 * govern: un poble pot tenir poc deute per una decisió del 1998, o molta
 * recollida selectiva perquè els contenidors els va posar l'alcalde anterior.
 * El que jutja és el **canvi durant aquests quatre anys**.
 *
 * I el canvi tot sol tampoc no diu res. Que la selectiva hagi pujat cinc punts
 * sona bé fins que saps que als municipis de la seva mida ha pujat deu: llavors
 * el poble no ha millorat, s'ha quedat enrere. Per això cada fila porta al
 * costat **la mateixa variació als seus**, i és la comparació la que informa.
 *
 * Del lloguer se'n diu el canvi però s'adverteix que no el decideix
 * l'ajuntament. Publicar-lo sense dir-ho seria carregar-li a un govern una cosa
 * que no controla, i callar-lo seria amagar el que més preocupa la gent.
 */
function renderMandat(data: RadiografiaData): string {
  type Fila = {
    etiqueta: string;
    unitat: string;
    mandat: Variacio | null | undefined;
    grup: MandatGrup | null | undefined;
    /**
     * La mediana del grup quan la font la desa **en percentatge** i no en
     * unitats: l'aigua i l'IBI la calculen així, i pintar un 3,4 % com si fossin
     * 3,4 € seria inventar-se una xifra.
     */
    grupPct?: MedianaPct | null;
    /** Puja = millora? `null` quan no és ni bo ni dolent, o no depèn d'ells. */
    amuntEsMillor: boolean | null;
    /** Decimals del salt i del «de X a Y». Per defecte, 1 i 0, com sempre. */
    decimals?: number;
    decimalsBase?: number;
    nota?: string;
  };
  const files: Fila[] = [];
  if (data.residus?.mandat) {
    files.push({
      etiqueta: "Recollida selectiva",
      unitat: "punts",
      mandat: data.residus.mandat,
      grup: data.residus.mandatDelGrup,
      amuntEsMillor: true,
    });
  }
  // El preu de l'aigua només hi surt si la variació és interpretable: si les
  // tarifes no s'han revisat des d'abans del 2024, un preu clavat no vol dir que
  // aquest govern no l'hagi apujat, vol dir que ningú no hi ha tocat.
  if (data.preuAigua?.interpretable.valida && data.preuAigua.mandat.subministrament) {
    files.push({
      etiqueta: "Preu de l'aigua",
      unitat: "€/m³",
      mandat: data.preuAigua.mandat.subministrament,
      grup: null,
      grupPct: data.preuAigua.mandatDelGrup.subministrament,
      // Cap veredicte: que l'aigua pugi o baixi no és per si sol ni bo ni dolent.
      amuntEsMillor: null,
      decimals: 3,
      decimalsBase: 3,
      nota:
        "De l'aigua només se'n compara el tram del subministrament, que és l'únic que vol dir el " +
        "mateix a tots els municipis. El cànon el fixa la Generalitat i no compta com a decisió municipal.",
    });
  }
  // De l'IBI, la variació només si la dada diu que és atribuïble al ple.
  if (data.rebutIbi?.publicable && data.rebutIbi.mandat) {
    files.push({
      etiqueta: "Rebut mitjà d'IBI",
      unitat: "€ l'any",
      mandat: data.rebutIbi.mandat,
      grup: null,
      grupPct: data.rebutIbi.mandatDelGrup,
      amuntEsMillor: null,
      decimals: 0,
      decimalsBase: 0,
    });
  }
  if (data.finances?.debtSeries && data.finances.debtSeries.length > 1) {
    const serie = data.finances.debtSeries;
    const inici = serie.find((p) => p.year === 2023) ?? null;
    const final = serie[serie.length - 1] ?? null;
    if (inici && final && final.year > inici.year) {
      files.push({
        etiqueta: "Deute per habitant",
        unitat: "€",
        mandat: {
          desDe: inici.year,
          fins: final.year,
          inici: inici.perHead,
          final: final.perHead,
          diferencia: final.perHead - inici.perHead,
          percentual: inici.perHead === 0 ? null : Math.round((1000 * (final.perHead - inici.perHead)) / inici.perHead) / 10,
        },
        grup: null,
        amuntEsMillor: false,
      });
    }
  }
  if (data.habitatge?.mandat) {
    files.push({
      etiqueta: "Preu del lloguer",
      unitat: "€ al mes",
      mandat: data.habitatge.mandat,
      grup: data.habitatge.mandatDelGrup,
      amuntEsMillor: null,
      nota: "El preu del lloguer no el decideix l'ajuntament: hi surt com a context del que ha passat al poble, no com a resultat de cap decisió seva.",
    });
  }
  // Quanta gent hi viu tampoc no ho decideix l'ajuntament, i per això hi va amb
  // la mateixa advertència que el lloguer: és el context on ha governat.
  const cens = data.poblacio ? indicadorDe(data.poblacio, "censHabitants") : null;
  if (cens?.mandat && data.poblacio && !data.poblacio.context.decideixLAjuntament) {
    files.push({
      etiqueta: "Gent que hi viu",
      unitat: "persones",
      mandat: cens.mandat,
      grup: cens.mandatDelGrup,
      amuntEsMillor: null,
      decimals: 0,
      decimalsBase: 0,
      nota: `La població no la decideix l'ajuntament. ${data.poblacio.context.nota}`,
    });
  }

  /**
   * Els programes de despesa, en euros per habitant.
   *
   * Van en una llista a part perquè són quinze i perquè no són del mateix tipus
   * que la resta: aquí no hi ha res que millori ni que empitjori, hi ha on han
   * decidit posar els diners. L'ordre és el del canvi més gran, que és el que
   * algú buscaria si pogués ordenar-ho ell.
   */
  const despesa: Fila[] = (data.despesaProgrames?.programes ?? [])
    .filter((p) => p.mandat !== null)
    .map((p) => ({
      etiqueta: p.nom,
      unitat: "€/hab",
      mandat: p.mandat,
      grup: p.mandatDelGrup,
      amuntEsMillor: null,
      decimals: 1,
      decimalsBase: 0,
    }))
    .sort((a, b) => Math.abs(b.mandat!.diferencia) - Math.abs(a.mandat!.diferencia));

  if (files.length === 0 && despesa.length === 0) return "";

  const signe = signeDe;
  const fila = (f: Fila): string => {
    const m = f.mandat!;
    const dec = f.decimals ?? 1;
    const base = f.decimalsBase ?? 0;
    const fmt = (n: number, d: number): string => (d === 0 ? number(Math.round(n)) : decimal(n, d));
    const dif = Math.abs(m.diferencia);
    const sentit =
      f.amuntEsMillor === null
        ? ""
        : (m.diferencia > 0) === f.amuntEsMillor
          ? " millora"
          : m.diferencia === 0
            ? ""
            : " empitjora";
    const delGrup =
      f.grup && f.grup.diferencia !== null
        ? `<span class="del-grup">als ${f.grup.municipis} de la seva mida,
           ${signe(f.grup.diferencia)}${dec === 0 ? number(Math.round(Math.abs(f.grup.diferencia))) : decimal(Math.abs(f.grup.diferencia), dec)}</span>`
        : f.grupPct && f.grupPct.mediana !== null
          ? `<span class="del-grup">als ${f.grupPct.municipis} de la seva mida,
             ${signe(f.grupPct.mediana)}${decimal(Math.abs(f.grupPct.mediana), 1)} %</span>`
          : `<span class="del-grup">sense comparació de grup</span>`;
    return `<li class="${sentit.trim()}">
      <span class="etq">${escape(f.etiqueta)}</span>
      <span class="salt"><b>${signe(m.diferencia)}${dec === 0 ? number(Math.round(dif)) : decimal(dif, dec)}</b> ${escape(f.unitat)}</span>
      <span class="dedes">de ${fmt(m.inici, base)} el ${m.desDe} a ${fmt(m.final, base)} el ${m.fins}</span>
      ${delGrup}
    </li>`;
  };

  const cos = files.map(fila).join("");
  const notes = files.filter((f) => f.nota).map((f) => `<p class="nota">${escape(f.nota!)}</p>`).join("");
  const blocDespesa =
    despesa.length === 0
      ? ""
      : `<h3 class="subtitol">On han posat els diners, servei a servei</h3>
    <ul class="mandat">${despesa.map(fila).join("")}</ul>
    <p class="nota">Euros per habitant liquidats, del ${despesa[0]!.mandat!.desDe} al
    ${despesa[0]!.mandat!.fins}, en euros corrents i sense descomptar la inflació.
    Gastar-hi més no vol dir fer-ho millor: vol dir haver-hi posat més diners.${
      data.despesaProgrames && data.despesaProgrames.anysSenseLiquidacio.length > 0
        ? ` D'aquest ajuntament no en tenim la liquidació del ${data.despesaProgrames.anysSenseLiquidacio.join(", ")}.`
        : ""
    }</p>`;

  return `${cos ? `<ul class="mandat">${cos}</ul>` : ""}
  <p class="nota">La xifra de la dreta és <b>el mateix canvi als municipis de la seva mida</b>.
  Un poble que millora menys que els seus no ha millorat: s'ha quedat enrere, i al revés.
  No hi posem cap veredicte: hi són les dues xifres i qui llegeix que jutgi.</p>${notes}${blocDespesa}`;
}

/**
 * Com queda el municipi respecte dels de la seva mida, en una sola imatge.
 *
 * Els percentils ja surten indicador per indicador dins del bloc dels comptes,
 * però escampats no es llegeixen. Junts sí: es veu d'una ullada si un poble és
 * dels que deuen més o dels que paguen abans, i en quines coses destaca.
 *
 * La barra va sempre de pitjor a millor **dins del grup**, no de menys a més:
 * al deute, menys és millor, i pintar-ho al revés faria llegir el gràfic girat.
 */
function renderComQueda(comparacio: readonly PeerComparison[], grup: { label: string; size: number } | null): string {
  const amb = comparacio.filter((c) => c.percentile !== null);
  if (amb.length < 3 || !grup) return "";

  const NOMS: Record<string, string> = {
    "estalvi-net": "El que sobra cada any",
    "deute-habitant": "Deute per habitant",
    "deute-ingressos": "Deute sobre els ingressos",
    "saldo-no-financer": "Saldo no financer",
    "carrega-financera": "Càrrega financera",
    "execucio-inversions": "Inversions executades",
    pmp: "Rapidesa pagant els proveïdors",
    "estalvi-brut": "Estalvi brut",
  };

  const files = amb
    .map((c) => {
      // El percentil el dona la posició dins del grup de menys a més. Quan
      // menys és millor, es gira, perquè la barra sempre vulgui dir el mateix:
      // com més llarga, millor està aquest municipi.
      const bo = c.lowerIsBetter ? 100 - c.percentile! : c.percentile!;
      const posicio = bo >= 75 ? "dalt" : bo <= 25 ? "baix" : "mig";
      return `<li class="posicio-${posicio}">
      <span class="etq">${escape(NOMS[c.key] ?? c.key)}</span>
      <span class="barra-peer"><i style="--w:${bo}%"></i></span>
      <span class="lloc">${bo >= 50 ? "millor" : "pitjor"} que el ${bo >= 50 ? bo : 100 - bo} %</span>
    </li>`;
    })
    .join("");

  const bons = amb.filter((c) => (c.lowerIsBetter ? 100 - c.percentile! : c.percentile!) >= 75).length;
  const dolents = amb.filter((c) => (c.lowerIsBetter ? 100 - c.percentile! : c.percentile!) <= 25).length;

  return `<p class="entrada-bloc">Comparat amb els <b>${grup.size} municipis catalans ${escape(grup.label)}</b>.
  ${bons > 0 ? `Destaca en ${bons} ${bons === 1 ? "indicador" : "indicadors"}` : "No destaca en cap indicador"}${
    dolents > 0 ? ` i va endarrerit en ${dolents}` : ""
  }.</p>
  <ul class="com-queda">${files}</ul>
  <p class="nota">Cada barra és la posició dins del grup, i sempre vol dir el mateix: com més
  llarga, millor està aquest municipi en aquell indicador. Comparar-lo amb tot Catalunya
  barrejaria Barcelona amb pobles de tres-cents habitants i no voldria dir res.</p>`;
}

/**
 * @param preguntes  Els municipis que tenen conjunt d'afirmacions, i si es pot
 *   respondre. La fitxa ensenya dades; les preguntes són el pas següent —«i tu
 *   què hi dius»— i sense l'enllaç aquí no hi arriba ningú.
 */
export function renderRadiografia(
  data: RadiografiaData,
  mapa: readonly PuntMapa[] = [],
  preguntes: ReadonlyMap<string, { jugable: boolean; quantes: number }> = new Map(),
): string {
  const m = data.municipality;
  const current = data.results.M20231;
  const government = data.government;
  const totalSeats = current?.seats ?? m.councilSeats ?? 0;
  const majority = absoluteMajority(totalSeats);
  const change = data.mayors?.currentTermChange ?? null;

  /**
   * Color d'un grup del ple. Els noms de seu-e («Grup Municipal del PSC»,
   * «ERC-AM», «No adscrits») no coincideixen amb les sigles de la candidatura,
   * així que es comparen per força amb `sameForce`, que ja sap que PSC-PSOE i
   * PSC-CP són el mateix. Si no lliga, gris: val més no acolorir que acolorir
   * malament, perquè aquí el color diu de qui és cada cosa.
   */
  const colorPerGrup = (grup: string | null): string => {
    if (!grup || /no\s*adscri/i.test(grup)) return "#8b8b8b";
    const candidature = (current?.candidatures ?? []).find(
      (c) => sameForce(c.sigles, grup) || sameForce(c.brandId, grup),
    );
    return candidature ? colorOf(candidature) : "#8b8b8b";
  };

  /**
   * L'alcaldia tal com la publica la seu electrònica del mateix ajuntament.
   *
   * La foto no demana que el ple sencer en tingui: la regla de no ensenyar-ne
   * cap si no les té tothom val per a la llista del ple, on una foto sola faria
   * quedar la resta com a fitxes de segona. Aquí és una persona sola i no hi ha
   * ningú amb qui quedi comparada.
   */
  const carrecAlcaldia = data.carrecs?.carrecs.find((c) => /alcald/i.test(c.carrec)) ?? null;
  const mayorPhoto = carrecAlcaldia?.foto ?? carrecAlcaldia?.fotoPetita ?? null;
  const mayorColor = government?.mayorSigles
    ? colorPerGrup(government.mayorSigles)
    : "#8b8b8b";

  const coverageLevel = (m.minutesCount ?? 0) >= 20 ? "bo" : (m.minutesCount ?? 0) > 0 ? "parcial" : "cap";
  const coverageText =
    coverageLevel === "bo"
      ? `Tenim indexades ${m.minutesCount} actes de sessions des del juny del 2023, l'última del ${formatDate(m.minutesLastDate)}.`
      : coverageLevel === "parcial"
        ? `Només tenim indexades ${m.minutesCount} actes des del juny del 2023. És poc per explicar un mandat sencer.`
        : "No hi ha cap acta d'aquest ajuntament al portal de dades obertes de l'AOC.";

  const title = `${m.name} — Observatori municipal de quivoto`;
  const description = `Qui mana a ${m.name}, què ha fet aquest govern amb els comptes, com s'ha mogut el vot des del 1979 i què s'hi juga el 23 de maig del 2027. Només amb dades obertes.`;

  // Les incidències obertes es diuen, no s'amaguen: una fitxa que calla un
  // problema conegut val menys que una que l'admet.
  const notable = data.issues.filter((i) => i.severity !== "baixa" && ISSUE_TEXT[i.kind]);

  return `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${INDEXABLE ? "" : '<meta name="robots" content="noindex, nofollow">'}
<title>${escape(title)}</title>
<meta name="description" content="${escape(description)}">
<link rel="canonical" href="${SITE}/observatori/m/${escape(m.slug)}/">
<meta property="og:type" content="article">
<meta property="og:site_name" content="quivoto">
<meta property="og:locale" content="ca_ES">
<meta property="og:title" content="${escape(m.name)} — Observatori municipal">
<meta property="og:description" content="${escape(summarySentence(data).replace(/<[^>]+>/g, "") || description)}">
<meta property="og:url" content="${SITE}/observatori/m/${escape(m.slug)}/">
<meta property="og:image" content="${SITE}/observatori/og/${escape(m.slug)}.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<style>${RADIOGRAFIA_CSS}</style>
</head>
<body>
<a class="salta" href="#contingut">Ves al contingut</a>

<header class="capcalera">
  <a class="logo" href="../../">Observatori</a>
  <span class="etiqueta">esborrany · dades obertes</span>
</header>

<main id="contingut">

<section class="portada">
  <p class="micro">${escape(m.comarca ?? "")}${m.provincia ? ` · ${escape(m.provincia)}` : ""}</p>
  <h1>${escape(m.name)}</h1>
  <p class="entrada">
    ${number(m.population ?? 0)} habitants · ${totalSeats} regidories al ple ·
    ${m.electoralSystem === "llistes tancades" ? "llistes tancades" : escape(m.electoralSystem)}
  </p>
  ${summarySentence(data, colorPerGrup) ? `<p class="resum">${summarySentence(data, colorPerGrup)}</p>` : ""}
  ${
    carrecAlcaldia
      ? renderAlcaldia(
          carrecAlcaldia.nom,
          carrecAlcaldia.carrec,
          government?.mayorSigles ?? null,
          mayorColor,
          mayorPhoto,
          data.carrecs ? adrecesRegidors(data.carrecs.carrecs).get(carrecAlcaldia) ?? null : null,
        )
      : ""
  }
  ${
    mapa.length > 0
      ? `<figure class="on-es">
      ${renderMapa(mapa, { amplada: 300, destacat: m.slug, descripcio: `Mapa de Catalunya amb ${m.name} destacat` })}
      <figcaption>${escape(m.name)}, entre els 947 municipis de Catalunya</figcaption>
    </figure>`
      : ""
  }
</section>

<nav class="index" aria-label="Seccions d'aquesta pàgina">
  ${data.finances && data.finances.mandates.some((m) => m.id === "2023-2027" && m.years.length > 1) ? '<a href="#balanc">Balanç del mandat</a>' : ""}
  <a href="#ple">El ple</a>
  ${data.councillors.length > 0 ? '<a href="#regidors">Qui hi seu</a>' : ""}
  ${data.history && data.history.series.length > 3 ? '<a href="#historia">Elecció a elecció</a>' : ""}
  <a href="#participacio">Participació</a>
  ${data.mayors && data.mayors.history.length > 0 ? '<a href="#alcaldies">Alcaldies</a>' : ""}
  ${data.poblacio && renderQuiHiViu(data.poblacio) ? '<a href="#qui-hi-viu">Qui hi viu</a>' : ""}
  ${data.revenue ? '<a href="#diners">Els diners</a>' : ""}
  ${renderQuePaga(data.preuAigua, data.rebutIbi) ? '<a href="#que-paga">Què paga la gent</a>' : ""}
  ${renderEscombraries(data.despesaProgrames, data.residus) ? '<a href="#escombraries">Les escombraries</a>' : ""}
  ${"" /* El cost efectiu dels serveis s'ha retirat de la fitxa.
  Els valors no són comparables: en clavegueram, el percentil 90 és 507 vegades
  el percentil 10, i un Q1 de 2 €/habitant vol dir que un poble de mil habitants
  declara que el seu clavegueram costa dos mil euros l'any —això no és un cost,
  és un apunt que va a una altra partida. La pròpia ingesta ja ho sap: 56 de les
  62 incidències greus obertes de tot el projecte són d'aquest bloc. Les dades
  segueixen als fitxers de descàrrega amb l'avís; tornarà quan es pugui
  distingir un cost real d'un apunt comptable. */}
</nav>
${"" /* Aquest </nav> hi faltava, i no era un detall de validador: sense ell tota
  la resta de la pàgina quedava dins d'un contenidor flex amb wrap, i cada secció
  hi entrava com a element flexible amb min-width:auto. El resultat era que la
  taula més ampla de la fitxa estirava el document sencer i a 320 px la pàgina es
  desplaçava horitzontalment 89 px. */}

${data.finances && data.finances.mandates.length > 0 && renderMandate(data.finances, Boolean(data.mayors?.currentTermChange)) ? `<section class="bloc" id="balanc">
  <h2>El balanç del mandat</h2>
  ${renderMandate(data.finances, Boolean(data.mayors?.currentTermChange))}
</section>` : ""}

${current ? `<section class="bloc" id="ple">
  <h2>El ple del mandat 2023-2027</h2>
  ${renderHemicycle(current.candidatures, totalSeats, majority)}
  ${renderLegend(current.candidatures, (sigles) => slugify(sigles))}
  <p class="nota">Calen <b>${majority}</b> regidories de ${totalSeats} per aprovar-hi res tot sol.
  L'índex de fragmentació que hi havia aquí (partits efectius) s'ha tret: l'hemicicle ja ho ensenya
  i es pot comptar amb els dits, i el número obligava a explicar-lo cada vegada.</p>
</section>` : ""}

${data.carrecs && data.carrecs.carrecs.length > 0
  ? `<section class="bloc" id="regidors">
  <h2>Qui seu al ple</h2>
  ${renderCarrecsSeue(data.carrecs, colorPerGrup)}
</section>`
  : data.councillors.length > 0
    ? `<section class="bloc" id="regidors">
  <h2>Qui seu al ple</h2>
  ${renderCouncillors(data.councillors)}
</section>`
    : ""}

${data.history && data.history.series.length > 3 ? `<section class="bloc" id="historia">
  <h2>El ple, elecció a elecció</h2>
  <p class="entrada-bloc">${
    data.history.alternances === 0
      ? "<b>La mateixa força ha guanyat totes les eleccions</b> des del " + (data.history.firstYear ?? 1979) + "."
      : "L'ajuntament ha canviat de mans <b>" + data.history.alternances + (data.history.alternances === 1 ? " vegada" : " vegades") + "</b> en " + data.history.elections + " eleccions."
  }</p>
  ${renderFamilyHistory(data.history)}
  <p class="nota">Cada columna és el ple sortit d'una elecció, i cada tros, una força.
  Comparem per força i no per sigles perquè les coalicions locals es rebategen sovint:
  el mateix partit hi surt com a PSC-PSOE, PSC-PM i PSC-CP segons l'any.
  Les llistes sense marca supramunicipal van totes juntes com a «llistes locals».</p>
</section>` : ""}

<section class="bloc">
  <h2>Les tres últimes, candidatura a candidatura</h2>
  ${renderSeries(data.results)}
  <p class="nota">Regidories obtingudes el 2015, el 2019 i el 2023, ara sí amb el nom exacte
  de cada llista.</p>
</section>

<section class="bloc" id="participacio">
  <h2>Qui hi va anar a votar</h2>
  ${renderTurnout(data.participation)}
</section>

${data.mayors && data.mayors.history.length > 0 ? `<section class="bloc" id="alcaldies">
  <h2>Les alcaldies des del 1979</h2>
  <p class="entrada-bloc">${data.mayors.distinctPeople} ${data.mayors.distinctPeople === 1 ? "persona ha ocupat" : "persones han ocupat"} l'alcaldia
  d'${escape(m.name)} des de les primeres eleccions municipals democràtiques.</p>
  ${renderMayors(data.mayors)}
</section>` : ""}

${data.poblacio && renderQuiHiViu(data.poblacio) ? `<section class="bloc" id="qui-hi-viu">
  <h2 class="amb-icona">${icona("serveis socials")}<span>Qui hi viu</span></h2>
  ${renderQuiHiViu(data.poblacio)}
</section>` : ""}

${data.revenue ? `<section class="bloc" id="diners">
  <h2>D'on surten els diners</h2>
  ${renderRevenue(data.revenue)}
</section>` : ""}

${data.spending ? `<section class="bloc">
  <h2>On van els diners</h2>
  ${renderSpending(data.spending)}
</section>` : ""}

${!data.revenue && !data.spending ? `<section class="bloc" id="diners">
  <h2>D'on surten i on van els diners</h2>
  <p class="entrada-bloc"><b>D'aquest ajuntament no en tenim la liquidació.</b></p>
  <p>Són 112 dels 947, i entre ells hi ha ciutats grans com Badalona. Vol dir que la Generalitat
  no ha publicat la seva liquidació pressupostària a la font que fem servir, no que l'ajuntament
  no la retigui ni que hi hagi res a amagar: la immensa majoria la publiquen al seu propi portal
  de transparència, però en un format que no es pot comparar amb el de la resta.</p>
  <p class="nota">Ho diem en comptes de fer desaparèixer el bloc sense explicació, que és el que
  fèiem fins ara. La resta de la fitxa —qui governa, el ple, el deute, els impostos— no en depèn.</p>
</section>` : ""}

${renderQuePaga(data.preuAigua, data.rebutIbi) ? `<section class="bloc" id="que-paga">
  <h2 class="amb-icona">${icona("fiscalitat")}<span>Què paga la gent</span></h2>
  <p class="entrada-bloc">El que costa l'aigua i el que surt al rebut de l'IBI, amb els avisos que
  fan que aquestes xifres es puguin comparar sense mentir.</p>
  ${renderQuePaga(data.preuAigua, data.rebutIbi)}
</section>` : ""}

${data.services ? `<section class="bloc" id="serveis">
  <h2>Què costa cada servei</h2>
  ${renderServices(data.services)}
</section>` : ""}

${renderEscombraries(data.despesaProgrames, data.residus) ? `<section class="bloc" id="escombraries">
  <h2 class="amb-icona">${icona("residus")}<span>Les escombraries: el que costen i el que se'n recull</span></h2>
  ${renderEscombraries(data.despesaProgrames, data.residus)}
</section>` : ""}

${renderMandat(data) ? `<section class="bloc" id="mandat">
  <h2>Com ha anat aquests quatre anys</h2>
  <p class="entrada-bloc">El que ha canviat des del començament del mandat, i el mateix canvi
  als municipis de la seva mida.</p>
  ${renderMandat(data)}
</section>` : ""}

${data.finances && renderComQueda(data.finances.comparison, data.finances.group) ? `<section class="bloc" id="com-queda">
  <h2>Com queda respecte dels seus</h2>
  ${renderComQueda(data.finances.comparison, data.finances.group)}
</section>` : ""}

${data.finances ? `<section class="bloc" id="comptes">
  <h2>Els comptes</h2>
  ${renderFinances(data.finances)}
</section>` : ""}

${data.taxes ? `<section class="bloc">
  <h2>Què es paga aquí</h2>
  ${renderTaxes(data.taxes)}
</section>` : ""}

${data.councilChanges && data.councilChanges.substitutions > 0 ? `<section class="bloc">
  <h2>Moviments al ple</h2>
  <p><b>${data.councilChanges.substitutions}</b> ${data.councilChanges.substitutions === 1 ? "persona ha entrat" : "persones han entrat"}
  al ple després de la constitució del mandat: algú va plegar i el va rellevar el següent de la seva llista.</p>
  <p class="nota">No podem dir-ne el motiu: les fonts obertes no el publiquen. I tampoc no
  informem de canvis de grup ni de regidors no adscrits, perquè la font escriu les mateixes
  sigles de maneres diferents i qualsevol xifra que en donéssim seria una acusació sense
  fonament. Ho tenim identificat com a feina pendent.</p>
</section>` : ""}

${data.parity ? `<section class="bloc">
  <h2>Dones i homes</h2>
  <ul class="paritat">
    <li><span class="gran">${data.parity.womenElectedPct ?? "—"} %</span><span>de dones al ple<br><span class="secundari">${data.parity.womenElected} de ${data.parity.elected}</span></span></li>
    <li><span class="gran">${data.parity.womenCandidatesPct ?? "—"} %</span><span>de dones a les llistes<br><span class="secundari">${data.parity.womenCandidates} de ${data.parity.candidates}</span></span></li>
    <li><span class="gran">${data.parity.womenHeads}</span><span>de ${data.parity.heads} caps de llista<br><span class="secundari">eren dones</span></span></li>
  </ul>
</section>` : ""}

<section class="bloc cobertura cobertura-${coverageLevel}" id="dades">
  <h2>Què en sabem i què no</h2>
  <p>${coverageText}</p>
  ${notable.length > 0
    ? `<p class="avis-dades"><b>Hi ha ${notable.length === 1 ? "una cosa" : `${notable.length} coses`} que no ens quadra${notable.length === 1 ? "" : "n"} d'aquest municipi:</b>
       ${notable.map((i) => escape(ISSUE_TEXT[i.kind]!)).join("; ")}.
       Ho tenim obert i no ho amaguem: si alguna xifra d'aquesta pàgina en depèn, agafa-la amb pinces.</p>`
    : ""}
  ${data.transparency && data.transparency.pct !== null
    ? `<p>El seu portal de transparència publica <b>${data.transparency.pct} %</b> dels
       ${data.transparency.items} apartats que li tocarien (${data.transparency.published} de ${data.transparency.items}).</p>`
    : ""}
  ${data.transparency?.detail && data.transparency.detail.length > 0
    ? `<h3 class="subtitol">El que hi consta publicat</h3>
       ${renderTransparencyDetail(data.transparency.detail)}`
    : ""}
  <p class="nota">Encara <b>no n'hem llegit cap</b>. Quan ho fem, aquí hi haurà el registre de mocions:
  què s'ha votat al ple i què hi ha votat cada grup. Fins llavors, tot el que hi ha en aquesta pàgina
  surt de dades obertes i de càlculs que qualsevol pot repetir.</p>
</section>

<section class="bloc joc" id="joc">
  <h2>Què t'hi jugues el 23 de maig del 2027</h2>
  <p class="entrada-bloc">${
    totalSeats > 0
      ? `Es reparteixen <b>${totalSeats} regidories</b> i en calen <b>${majority}</b> per governar sense pactar amb ningú.`
      : ""
  }${
    government
      ? government.winnerHasMajority
        ? ` L'últim cop, ${escape(government.winnerSigles)} les va tenir.`
        : ` L'últim cop no les va tenir ningú i va caldre pactar.`
      : ""
  }</p>
  ${
    data.history && data.history.alternances === 0 && data.history.elections >= 8
      ? `<p>Des del ${data.history.firstYear ?? 1979} sempre hi ha guanyat la mateixa força.
         Per canviar-ho caldria una cosa que no ha passat mai en ${data.history.elections} eleccions.</p>`
      : data.history && data.history.alternances > 0
        ? `<p>L'ajuntament ha canviat de mans ${data.history.alternances}
           ${data.history.alternances === 1 ? "vegada" : "vegades"} des del ${data.history.firstYear ?? 1979}:
           aquí les coses es mouen.</p>`
        : ""
  }
  ${
    m.electoralSystem !== "llistes tancades"
      ? `<p><b>Aquí es vota diferent.</b> ${escape(m.name)} funciona amb ${escape(m.electoralSystem.toLowerCase())}:
         no es tria una llista tancada, i per això la brúixola hi tindrà un altre format.</p>`
      : ""
  }
  <p class="crida">Estem preparant una brúixola electoral per a ${escape(m.name)}: 25 preguntes
  sobre el teu poble i què n'ha dit cada candidatura, amb l'evidència al costat.
  <a href="/#avisa">Avisa'm quan s'obri</a>.</p>
  <p class="nota">La data és la del calendari electoral: les eleccions municipals se celebren
  el quart diumenge de maig, i el 2027 cau el 23. Les candidatures no es coneixeran fins a
  finals d'abril del 2027, quan la Junta Electoral les proclami.</p>
</section>

<section class="bloc anar" id="anar">
  <h2>Segueix estirant</h2>
  <ul class="destins">
    ${m.comarca ? `<li><a href="../../c/${escape(slugify(m.comarca))}/">
      <b>${escape(m.comarca)}</b><span>Qui mana a la comarca, quantes alcaldies té cada força i com hi queda ${escape(m.name)}</span></a></li>` : ""}
    ${
      data.amb
        ? `<li><a href="../../amb/">
      <b>L'Àrea Metropolitana</b><span>${escape(m.name)} és un dels ${data.amb.municipis} municipis
      metropolitans: què decideix l'AMB del seu transport, la seva aigua i els seus residus, i què no</span></a></li>`
        : ""
    }
    ${
      preguntes.has(m.slug)
        ? preguntes.get(m.slug)!.jugable
          ? `<li><a href="../../preguntes/${escape(m.slug)}/prova/">
      <b>I tu, què hi dius?</b><span>Respon ${preguntes.get(m.slug)!.quantes} afirmacions sobre
      ${escape(m.name)} i mira amb quin grup del ple coincideixes més</span></a></li>`
          : `<li><a href="../../preguntes/${escape(m.slug)}/">
      <b>Les preguntes de ${escape(m.name)}</b><span>Les ${preguntes.get(m.slug)!.quantes} afirmacions
      que faríem aquí, amb l'evidència de cadascuna</span></a></li>`
        : ""
    }
    <li><a href="../../comparador/?m=${escape(m.slug)}">
      <b>Compara'l</b><span>Posa ${escape(m.name)} al costat de fins a tres municipis més</span></a></li>
    <li><a href="../../mapa/">
      <b>El mapa dels 947</b><span>On hi ha majoria absoluta, on no governa qui va guanyar i on
      mana la mateixa força des del 1979</span></a></li>
    <li><a href="../../els947.html">
      <b>Els 947</b><span>Tots els municipis de Catalunya, amb cercador i filtres</span></a></li>
    <li><a href="../../dades/m/${escape(m.slug)}.csv" download>
      <b>Baixa't les dades</b><span>Tot el que hi ha en aquesta pàgina, en CSV</span></a></li>
  </ul>
  <p class="nota">També en <a href="../../dades/m/${escape(m.slug)}.json">JSON</a>,
  amb l'<a href="../../dades/">esquema documentat</a> de cada camp i la seva font.</p>
</section>

<section class="bloc fonts">
  <h2>D'on surt tot això</h2>
  <ul>
    <li>Padró, alcaldia i dades de l'ens: Generalitat de Catalunya, <code>6nei-4b44</code>.</li>
    <li>Vots i regidories de 2015, 2019 i 2023: <code>ntc4-rnwr</code>.</li>
    <li>Participació i vots en blanc: <code>irrv-2mfc</code>.</li>
    <li>Historial d'alcaldies: <code>2v2p-vu4h</code>.</li>
    <li>Llistes de candidats i sexe: <code>xnfg-weec</code>.</li>
    <li>Índex d'actes: Consorci AOC, <code>b5d370d0</code>.</li>
    <li>Liquidació pressupostària per capítols: AOC, <code>81f18313</code>.</li>
    <li>Deute viu: AOC, <code>34db8dc5</code>. Pagament a proveïdors: <code>eecca986</code>.</li>
    <li>Resultats de les dotze eleccions municipals des del 1979: AOC, <code>3539f7e6</code>.</li>
    <li>Tipus impositius: AOC, <code>82ae0ea2</code>. Portal de transparència: <code>1a9c1ede</code>.</li>
    <li>Ajuntaments sense oposició: Síndic de Greuges, <code>943d6174</code>.</li>
    <li>Recaptació i despesa per habitant: Generalitat, <code>ytva-5kp3</code>.</li>
    <li>Cost efectiu dels serveis: Ministeri d'Hisenda via AOC, <code>12c13cdd</code>.</li>
    ${data.poblacio ? `<li>Població, edats i lloc de naixement: ${escape(data.poblacio.font.organisme)}, taules
      ${data.poblacio.font.taules.map((t) => `<code>${escape(t.taula)}</code>`).join(", ")}.
      Les seves dades no són CC: ${escape(data.poblacio.font.llicencia.obliga)}</li>` : ""}
    ${data.preuAigua ? `<li>Preu de l'aigua: full de tarifes de l'Agència Catalana de l'Aigua${
      data.preuAigua.font.dataActualitzacio ? `, ${escape(data.preuAigua.font.dataActualitzacio)}` : ""
    }.</li>` : ""}
    ${data.rebutIbi ? `<li>Rebut mitjà d'IBI: <a href="${escape(data.rebutIbi.font.url)}" rel="noopener nofollow">${escape(data.rebutIbi.font.organisme)}</a>.</li>` : ""}
    ${data.despesaProgrames ? `<li>Despesa liquidada per programes: ${escape(data.despesaProgrames.font.organisme)},
      <code>${escape(data.despesaProgrames.font.dataset)}</code>.</li>` : ""}
  </ul>
  <p class="nota">Els càlculs derivats —qui governa contra qui va guanyar, els canvis d'alcaldia a mig mandat,
  la fragmentació i la paritat— són nostres i es poden reproduir amb el codi del projecte.</p>
</section>

</main>

<footer class="peu">
  <p>quivoto · pàgina generada el ${escape(data.generatedAt)} · esborrany intern, no indexat</p>
</footer>
</body>
</html>`;
}

// -------------------------------------------------------------------- accés

export async function loadRadiografia(db: Db, slug: string, generatedAt: string): Promise<RadiografiaData | null> {
  const [municipality] = await db.select().from(municipalities).where(eq(municipalities.slug, slug));
  if (!municipality) return null;

  const metrics = await db
    .select()
    .from(municipalityMetrics)
    .where(eq(municipalityMetrics.municipalityId, municipality.id));
  const byKind = new Map(metrics.map((x) => [x.kind, x.data]));

  const participation = await db
    .select()
    .from(electionParticipation)
    .where(eq(electionParticipation.municipalityId, municipality.id))
    .orderBy(asc(electionParticipation.electionId));

  return {
    municipality,
    results: (byKind.get("results") ?? {}) as ResultsMetric,
    government: (byKind.get("government") ?? null) as GovernmentMetric | null,
    parity: (byKind.get("parity") ?? null) as ParityMetric | null,
    finances: (byKind.get("finances") ?? null) as FinancesMetric | null,
    history: (byKind.get("electoralHistory") ?? null) as ElectoralHistory | null,
    taxes: (byKind.get("taxes") ?? null) as TaxesMetric | null,
    transparency: (byKind.get("transparency") ?? null) as TransparencyMetric | null,
    singleList: byKind.has("singleList"),
    revenue: (byKind.get("revenue") ?? null) as RevenueMetric | null,
    spending: (byKind.get("spending") ?? null) as SpendingMetric | null,
    services: (byKind.get("services") ?? null) as ServicesMetric | null,
    councilChanges: (byKind.get("councilChanges") ?? null) as CouncilChangesMetric | null,
    carrecs: (byKind.get("carrecs") ?? null) as FitxaCarrecs | null,
    mocions: (byKind.get("mocions") ?? null) as MocionsMetric | null,
    residus: (byKind.get("residus") ?? null) as ResidusMetric | null,
    habitatge: (byKind.get("habitatge") ?? null) as HabitatgeMetric | null,
    poblacio: (byKind.get("poblacio") ?? null) as PoblacioMetric | null,
    preuAigua: (byKind.get("preuAigua") ?? null) as PreuAiguaMetric | null,
    rebutIbi: (byKind.get("rebutIbi") ?? null) as RebutIbiMetric | null,
    despesaProgrames: (byKind.get("despesaProgrames") ?? null) as DespesaProgramesMetric | null,
    amb: (byKind.get("amb") ?? null) as RadiografiaData["amb"],
    councillors: await db
      .select({
        name: people.fullName,
        role: councillorMandates.role,
        groupName: politicalGroups.name,
        sigles: candidatures.sigles,
        color: candidatures.color,
        brandId: candidatures.brandId,
        orderNum: councillorMandates.orderNum,
      })
      .from(councillorMandates)
      .innerJoin(people, eq(people.id, councillorMandates.personId))
      .leftJoin(politicalGroups, eq(politicalGroups.id, councillorMandates.groupId))
      .leftJoin(candidatures, eq(candidatures.id, politicalGroups.candidatureId))
      .where(eq(councillorMandates.municipalityId, municipality.id))
      .orderBy(asc(councillorMandates.orderNum)),
    mayors: (byKind.get("mayors") ?? null) as MayorsMetric | null,
    participation,
    issues: (
      await db
        .select({
          kind: dataIssues.kind, severity: dataIssues.severity,
          entity: dataIssues.entity, detail: dataIssues.detail,
        })
        .from(dataIssues)
        .where(and(eq(dataIssues.municipalityId, municipality.id), eq(dataIssues.resolved, false)))
    ),
    generatedAt,
  };
}

export async function loadSlugs(db: Db, slugs: readonly string[]): Promise<string[]> {
  if (slugs.length === 0) return [];
  const rows = await db.select({ slug: municipalities.slug }).from(municipalities).where(inArray(municipalities.slug, [...slugs]));
  return rows.map((r) => r.slug);
}
