import { and, asc, eq, inArray } from "drizzle-orm";
import {
  candidatures, councillorMandates, dataIssues, electionParticipation, municipalities,
  municipalityMetrics, people, politicalGroups, type Db,
} from "@quivoto/db";
import { BRANDS_BY_ID, PARTY_BRANDS, sameForce, siglesFamily } from "@quivoto/shared-schemas/brands";
import { absoluteMajority, councilSeats } from "@quivoto/shared-schemas/seats";
import { sobreColor } from "./contrast";
import { CRIMINALITAT_CSS, renderCriminalitat, type GrupCriminalitat } from "./criminalitat";
import type { CriminalitatMetric } from "../jobs/j29-criminalitat";
import type { MedianaGrup, MedianesMunicipi } from "./medianes";
import {
  atributsEtiqueta, barresDivergents, distribucioGrup, escalaDivergent, GRAFICS_JS, regleDispersio, serieTemporal,
  textEtiqueta, type DadaEtiqueta, type FilaDivergent,
} from "./grafics";
import type { SeriesMunicipi } from "./series-grup";
import type { Continuitat, PuntVolatilitat, VotPerdutElecció } from "../derive/trajectoria";
import { mateixaPersona } from "../derive/trajectoria";
import { hemicycle, seientsHemicicle } from "./hemicycle";
import { TIRA_POBLE_CSS, tiraDelPoble, tiraDesDeHistorial } from "./tira-poble";
import { INDICADORS_VEINS, VEINS_CSS, adjacenciaMunicipal, renderVeins, veinsAmbXifra, type IndicadorVeins } from "./veins";
import type { Els947Row } from "./els947";
import { renderTerritori } from "./territori-fitxa";
import { WIKIDATA_FITXA_CSS, renderAgermanaments, renderNascuts } from "./wikidata-fitxa";
import type { FitxaCuriositatsWikidata } from "../jobs/j33-municipi-wikidata";
import { renderVehiclesBloc } from "./vehicles-fitxa";
import type { VehiclesMetric } from "../jobs/j34-vehicles";
import { ALTRES_ELECCIONS_CSS, renderAltresEleccionsBloc } from "./altres-eleccions-fitxa";
import type { AltresEleccionsMetric } from "../jobs/j43-altres-eleccions";
import { MARGES_CSS, renderMargesBloc } from "./marges-fitxa";
import type { MargesMetric } from "../derive/marges";
import { SOCIOECONOMIA_CSS, renderSocioeconomiaBloc } from "./socioeconomia-fitxa";
import type { SocioeconomiaMetric } from "../jobs/j44-socioeconomia";
import type { GaipMetric } from "../jobs/j45-gaip";
import type { EstablimentsTuristicsMetric } from "../jobs/j46-habitatges-turistics";
import { GAIP_FITXA_CSS, TITOL_GAIP, renderGaipBloc } from "./gaip-fitxa";
import { LLISTES_OBERTES_CSS, adrecesDelPle, renderLlistesObertesBloc } from "./llistes-obertes-fitxa";
import type { LlistesObertesMetric } from "../jobs/j37-llistes-obertes";
import { CENS_FITXA_CSS, renderCensBloc } from "./cens-fitxa";
import type { CensElectoralMetric } from "../jobs/j36-cens-electoral";
import type { UrbanismeHabitatgeMetric } from "../jobs/j40-urbanisme-habitatge";
import { URBANISME_FITXA_CSS, TITOL_URBANISME, renderUrbanismeHabitatgeBloc } from "./urbanisme-fitxa";
import type { DinersGeneralitat } from "../jobs/j41-diners-generalitat";
import {
  COOPERACIO_CSS, CURT_DINERS_GENERALITAT, TITOL_DINERS_GENERALITAT, llegeixDinersGeneralitat, renderDinersGeneralitatBloc,
} from "./cooperacio-fitxa";
import type { ServeisSocialsDesats } from "../jobs/j42-serveis-ens";
import { SERVEIS_ENS_CSS, renderServeisSocialsMunicipi } from "./serveis-ens-fitxa";
import type { TerritoriMetric } from "../jobs/j32-territori";
import { icona } from "./icones";
import { renderMapa, type PuntMapa } from "./mapa";
import { assignaSlugs } from "./candidatura";
import { adrecesRegidors, carrecCurt, frasesQueCaben, nomCurt, titolQueCap } from "./regidor";
import { ARREL_OBSERVATORI, capSeo, filAriadna } from "./seo";
import { GEO_CSS, ajuntamentLd, municipiLd, preguntesMunicipi, preguntesRapides } from "./seo-ld";
import { esAlcaldia, resolAlcaldia } from "./alcaldia";
import { adrecesAlcaldies, alcaldiesHistoriques } from "./alcaldia-historica";
import { familiaDelPartit, motiuFinalEscrit, type PasAlcaldia } from "../derive/alcaldies";
import { FOTOS_WIKIMEDIA_CSS, creditsRetrats, retratsPerNom, type Retrat } from "./fotos-wikidata";
import type { FitxaFotosExalcaldes } from "../jobs/j28-fotos-exalcaldes";
import {
  consultatEl, dataCurta, de, delDia, elDia, nomLlegible, nomPreferit, nomsOficials, normalize, normalizePersonName, slugify,
} from "../lib/text";
import { SITE } from "./config";
import { RADIOGRAFIA_CSS, senseComentaris } from "./estil";
import { MASCOTA_CSS, papereta } from "./mascota";
import { PAPERETA_POSTURES_CSS, vinyetaPapereta } from "./mascota-postures";
import { capcalera, tipografia } from "./capcalera";
import { credit, escutMunicipi, type ImatgesMunicipi } from "./escut";
import { sigla, siglesConegudes } from "./sigla";
import { cara } from "./cara";
import { cercador } from "./cercador";
import { peu } from "./peu";
import { adrecaEns, type DadesEns } from "./ens-tipus";
import { esSeientSenseNom } from "../jobs/j38-ens-supramunicipals";
// El text de «zero i buit» es llegeix del codi i no del JSON desat: el que hi
// va desar una J15 antiga parlava de «liquidacio: false», que no és per a ningú.
import { ZERO_I_BUIT } from "../jobs/j15-despesa-serveis";
import { SENSE_CONSELL } from "./comarques";

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
  /** Regidories que té el ple, per poder jutjar el denominador de dalt. */
  expectedElected?: number;
  /** Cert només quan la font dona tants d'electes com regidories té el ple. */
  complet?: boolean;
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

/**
 * La renda de la gent del poble, tal com la desa J23 (només el que la fitxa
 * llegeix: l'ADRH de l'INE, amb el rang a Catalunya ja calculat pel job).
 *
 * Com la població i el preu del lloguer, **no ho decideix l'ajuntament**: és
 * el context on governa, i la mètrica porta la nota que ho diu i que la fitxa
 * ha d'ensenyar al costat de la xifra. El rang són els municipis amb dada, no
 * els 947: l'INE tapa per secret estadístic la renda dels més petits.
 */
type RiquesaMetric = {
  font: {
    ine: { organisme: string; conjunt: string; extret: string };
  };
  context: { decideixLAjuntament: boolean; nota: string; sensePostEleccions: string | null };
  /** L'any comparable per a tothom. */
  any: number | null;
  cobertura: { municipisAmbDada: number; de: number; nota: string };
  indicadors: {
    clau: string;
    etiqueta: string;
    unitat: string;
    nota: string;
    any: number | null;
    valor: number | null;
    darrerAnyPropi: number | null;
    serie: { any: number; valor: number | null }[];
    variacio: Variacio | null;
    comparacio: {
      grup: { clau: string; etiqueta: string; mida: number; ambDada: number };
      percentil: number;
      mediana: number;
      diferencia: number;
      percentual: number | null;
    } | null;
    /** Rang dins de Catalunya: 1 és la renda més alta. Els empats, el millor. */
    catalunya: {
      rang: number;
      de: number;
      percentil: number;
      medianaMunicipal: number;
      diferencia: number;
      percentual: number | null;
      nota: string;
    } | null;
  }[];
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
  /**
   * La mediana del total per habitant als municipis de la seva mida.
   *
   * Encara no la desa cap feina: J15 calcula el percentil de cada programa
   * per separat, i la del total no existeix. El camp hi és perquè la fitxa el
   * pugui fer servir el dia que hi sigui sense tocar res, i mentrestant la
   * comparacio del total surt de J8, que sí que la porta. **No se substitueix
   * mai per la suma de les medianes dels programes**: la mediana d'una suma no
   * es la suma de les medianes, i el resultat seria un municipi que no existeix.
   */
  medianaGrupTotal?: { any: number; mediana: number; ambDada: number } | null;
  mandat: { actual: number; anterior: number };
  base: string;
  zeroIBuit: string;
};

/**
 * El que costa el govern d'un ajuntament (J14), i el que cada ajuntament en publica.
 *
 * Són tres mètriques i van juntes perquè responen la mateixa pregunta amb tres
 * graus de certesa, i separar-les faria que la més tova semblés tan bona com la
 * més dura:
 *
 *   · `costGovern` és **la xifra sòlida**: el capítol 1000 de la liquidació, el
 *     mateix formulari per als 947, sèrie des del 2019. No diu què cobra ningú;
 *     diu què hi dedica l'ajuntament sencer.
 *   · `transparenciaRetribucions` no porta **cap euro**, a propòsit: només
 *     compta si cada ajuntament publica la xifra, les altres retribucions, les
 *     dietes i la declaració de béns. És la resposta honesta a «què en podem
 *     saber», i com que un ajuntament que no publica res surt igualment, el buit
 *     queda dit.
 *   · `carrecsAcumulats` és qui, a més de la regidoria, té un segon càrrec en un
 *     ens que el paga, **amb l'import només si el publica qui el paga**.
 *
 * La regla que mana damunt de totes tres (PLA-DADES-2027, Bloc 1): una xifra
 * baixa perquè no hem trobat els complements és pitjor que no publicar-ne cap,
 * perquè exculpa. Per això aquí no es suma res i el camp de retribució que
 * publiquen els ajuntaments a seu-e no arriba mai a la pàgina com a import.
 */
type CostGovernMetric = {
  serie: {
    any: number;
    parcial: boolean;
    habitants: number | null;
    regidories: number | null;
    organs: { total: number; perHabitant: number | null; perRegidoria: number | null } | null;
    dietes: { total: number; perHabitant: number | null } | null;
    indemnitzacions: { total: number; perHabitant: number | null } | null;
    sospitos: boolean;
  }[];
  darrerAnyComplet: number;
  darrer: CostGovernMetric["serie"][number] | null;
  mandat: { de: number; a: number; deTotal: number; aTotal: number; canviPct: number } | null;
  medianes: { perHabitant: number | null; perRegidoria: number | null };
  grup: { etiqueta: string; mida: number; ambDada: number } | null;
  medianesGrup: { perHabitant: number | null; perRegidoria: number | null } | null;
  font: { nom: string; dataset: string; exercicis: string; consultat: string };
  advertiment: string;
};

type TransparenciaRetribucionsMetric = {
  total: number;
  ambXifra: number;
  senseXifra: number;
  senseCamp: number;
  senseFitxa: number;
  ambAltresRetribucions: number;
  ambDietes: number;
  ambIndemnitzacions: number;
  ambDeclaracioBens: number;
  publica: "tots" | "alguns" | "cap";
  publicaBens: "tots" | "alguns" | "cap";
  carrecs: {
    nom: string;
    fitxa: string | null;
    retribucio: "xifra" | "sense-xifra" | "cap" | null;
    altresRetribucions: boolean;
    dietes: boolean;
    indemnitzacions: boolean;
    declaracioBens: boolean;
    alcaldia: boolean;
  }[];
  font: string;
  url: string;
  consultat: string;
  advertiment: string;
};

type CarrecsAcumulatsMetric = {
  persones: {
    nom: string;
    carrecMunicipal: string;
    alcaldia: boolean;
    altres: {
      ens: string;
      tipus: string;
      carrec: string;
      retribucio: {
        anualBrut: number | null;
        concepte: string;
        dedicacio: string | null;
        font: { nom: string; url: string; consultat: string };
      } | null;
      senseRetribucioPublicada: { motiu: string; font: { nom: string; url: string; consultat: string } } | null;
    }[];
  }[];
  alcaldia: CarrecsAcumulatsMetric["persones"][number] | null;
  consultat: string;
  catalunya: {
    alcaldiesAmbSegonCarrec: number;
    alcaldiesAmbImportPublicat: number;
    ensQuePubliquen: number;
    ensQueNoPubliquen: number;
  };
  advertiment: string;
};

/**
 * El que publica el Ministeri del que cobra l'alcaldia i les regidories (J22).
 *
 * La forma és la que desa `jobs/j22-retribucions.ts`, escrita aquí i no
 * importada, com la resta de mètriques d'aquest fitxer. De tot això, **només
 * `alcaldia.mena === "sou"` és un sou**: «sense dedicació» amb import són
 * assistències a plens, i dir-ne sou faria semblar que una alcaldia de poble
 * cobra 180 € l'any per fer d'alcalde. `comarques.ts` ja aplica la regla i la
 * fitxa l'ha d'aplicar igual.
 */
type RetribucionsMetric = {
  municipi: { nom: string; ine5: string };
  ministeri: {
    any: number;
    alcaldia: { regim: string; euros: number; mena: "sou" | "assistencies" | "cap" } | null;
    regidories: {
      files: number;
      dedicacioExclusiva: number;
      dedicacioParcial: number;
      senseDedicacio: number;
      ambSou: number;
      nomesAssistencies: number;
      senseCapImport: number;
      souMinim: number | null;
      souMedia: number | null;
      souMaxim: number | null;
      sumaDelFullDeRegidories: number;
    } | null;
    nomAlFull: string;
    font: { nom: string; organisme: string; pagina: string; llicencia: string; urls: string[]; consultat: string };
    advertiment: string;
  } | null;
  /** Només Barcelona publica un import per persona; la forma és la de J22. */
  ajuntament: unknown | null;
  catalunya: {
    municipisAmbDadaDelMinisteri: number;
    municipisTotals: number;
    alcaldiesAmbSou: number;
    alcaldiesNomesAmbAssistencies: number;
    alcaldiesSenseCapImport: number;
    /** La mediana del que cobren les alcaldies amb sou de debò, a tot Catalunya. */
    souMedianaAlcaldia: number | null;
  };
  advertiment: string;
};

/**
 * Qui del ple seu també a una diputació, i què en publica la diputació (J24).
 *
 * Es fusiona amb `carrecsAcumulats` (J14) per `normalizePersonName`, i el
 * `maximPerAssistencies` **és un sostre, mai una suma**: no s'ha d'afegir a
 * cap altre import.
 */
type SousDiputacionsMetric = {
  persones: {
    nom: string;
    carrecMunicipal: string;
    alcaldia: boolean;
    diputacio: {
      ens: string;
      tipus: "diputació";
      carrec: string;
      dedicacio: string | null;
      retribucioAnualBruta: number | null;
      maximPerAssistencies: number | null;
      motiu: string | null;
      font: { nom: string; url: string; format: string; llicencia: string; consultat: string };
      metode: string;
    };
  }[];
  alcaldia: SousDiputacionsMetric["persones"][number] | null;
  catalunya: {
    diputacionsLlegides: { ens: string; diputats: number; ambRetribucioPublicada: number }[];
    diputatsQueTambeSonRegidors: number;
    ambImportPublicat: number;
    nomsAmbigusDescartats: number;
    consultat: string;
  };
  advertiment: string;
};

/**
 * El sou que publica el consell comarcal de cada conseller que també seu en
 * aquest ple (J30). És el germà exacte de `SousDiputacionsMetric`: el mateix
 * contracte —l'import el diu qui el paga, el màxim per assistències és un
 * sostre i mai un sou— amb `consell` en comptes de `diputacio`.
 */
type SousConsellsMetric = {
  persones: {
    nom: string;
    carrecMunicipal: string;
    alcaldia: boolean;
    /** El nom tal com l'escriu el consell, quan no és lletra per lletra el mateix. */
    nomAlConsell: string | null;
    consell: {
      ens: string;
      tipus: "consell comarcal";
      carrec: string;
      dedicacio: string | null;
      retribucioAnualBruta: number | null;
      maximPerAssistencies: number | null;
      motiu: string | null;
      font: { nom: string; url: string; format: string; llicencia: string; consultat: string };
      metode: string;
    };
  }[];
  alcaldia: SousConsellsMetric["persones"][number] | null;
  catalunya: {
    consellersQueTambeSonRegidors: number;
    ambImportPublicat: number;
    nomsAmbigusDescartats: number;
    consultat: string;
  };
  advertiment: string;
};

/**
 * El que aquest ajuntament ha adjudicat, i amb quanta competència (J10).
 *
 * De tot el que hi ha aquí, la xifra que diu més no és el volum sinó **quantes
 * licitacions van rebre una sola oferta**: el volum el marca la mida del
 * municipi i el pressupost de l'any, però que a un concurs només s'hi presenti
 * qui ja hi era és una propietat del concurs. Va amb la mediana dels municipis
 * de la seva mida, i només quan hi ha prou licitacions perquè el percentatge
 * vulgui dir alguna cosa: dir «percentil 90» sobre tres licitacions és fals.
 *
 * Els noms dels adjudicataris hi són, a la font, i no els publiquem: qui vulgui
 * saber qui ha guanyat cada contracte hi té l'enllaç.
 */
type ContractacioMetric = {
  anys: {
    any: number;
    complet: boolean;
    contractes: number;
    volum: number;
    volumPerHabitant: number | null;
    licitacions: number;
    ofertesMitjana: number | null;
    unaOfertaPct: number | null;
  }[];
  finestra: {
    contractes: number;
    volum: number;
    licitacions: number;
    ofertesMitjana: number | null;
    unaOfertaPct: number | null;
    licitacionsAmbOfertes: number;
  };
  volumPerHabitant: number | null;
  ultimAnyComplet: number | null;
  finestraDates: { desDe: string | null; finsA: string | null };
  comparacio: {
    grup: string;
    municipisVolum: number;
    percentilVolum: number | null;
    medianaVolum: number | null;
    percentilUnaOferta: number | null;
    medianaUnaOferta: number | null;
    municipisUnaOferta: number;
  } | null;
  font: string;
  fontUrl: string;
  detall: string;
};

/**
 * Quant fa que mana el mateix, i quant es mou el ple d'una elecció a l'altra.
 *
 * Els tipus venen de `derive/trajectoria.ts` i no es tornen a escriure aquí: si
 * un dia el càlcul canvia de forma, això ha de petar a la compilació i no
 * publicar en silenci un camp que ja no existeix.
 */
type ContinuitatMetric = Continuitat & {
  font: string;
  anyReferencia: number;
  volatilitat: {
    font: string;
    serie: PuntVolatilitat[];
    ultima: PuntVolatilitat | null;
    mitjana: number | null;
    trams: number;
    tramsFiables: number;
    comparacio: { percentil: number; mediana: number; grup: string; grupMida: number } | null;
  };
};

/** Els vots que no van arribar a cap regidoria: la pregunta del vot útil. */
type VotPerdutMetric = {
  font: string;
  eleccions: Record<string, VotPerdutElecció>;
  darrera: string | null;
  regidorsEquivalents: number | null;
  variacioDesDel2019: number | null;
  comparacio: { percentil: number; mediana: number; grup: string; grupMida: number } | null;
};

/**
 * Els papers oficials d'aquest mandat, i el perímetre que el pressupost no cobreix.
 *
 * Tres coses que J10 ja té desades i que la fitxa no deia. El cartipàs és el
 * document que diu qui porta quina àrea, i és literalment el paper que la gent
 * busca i no troba. Les ordenances són el que el ple ha aprovat que canvia el
 * que es paga i el que es pot fer. I els organismes dependents —patronats,
 * societats municipals, consorcis— són on viu la despesa que la liquidació de
 * l'ajuntament no recull: sense dir-los, tota la resta del bloc de diners es
 * llegeix com si fos tot el que fa l'ajuntament, i no ho és.
 */
type OrdenancesMetric = {
  mandat: number;
  ultimes: { titol: string; data: string; enllac: string | null }[];
  desDe: string;
  font: string;
  fontUrl: string;
};

type CartipasMetric = {
  titol: string;
  data: string | null;
  enllac: string | null;
  mandat: string;
  font: string;
  fontUrl: string;
};

type OrganismesMetric = {
  total: number;
  perTipus: Record<string, number>;
  organismes: { nom: string; tipus: string; relacio: string }[];
  font: string;
  fontUrl: string;
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

/** Lectura humana dels punts de les actes, centrada en el vot i no només en el títol. */
function renderVotsPle(mocions: MocionsMetric | null): string {
  if (!mocions) {
    return `<p>No tenim encara cap acta de ple llegida d'aquest municipi. Les actes indexades són
    una porta d'entrada, però no les presentem com si coneguéssim els vots.</p>`;
  }
  const llista = Array.isArray(mocions.llista) ? mocions.llista : [];
  const puntsLlegits = mocions.punts ?? { desats: 0, omesos: 0, ambVotPerGrup: 0 };
  const llegibles = llista.filter((p) => p.cita || p.resultat || p.vots.length > 0);
  const visibles = llegibles.slice(-12).reverse();
  const resum = `<ul class="preus vots-resum">
    <li><span class="etq">Actes llegides</span><span class="gran">${number(mocions.actes.llegides)}</span><span class="sub">de ${number(mocions.actes.indexades)} indexades</span></li>
    <li><span class="etq">Punts de l'ordre del dia</span><span class="gran">${number(puntsLlegits.desats)}</span><span class="sub">${number(puntsLlegits.ambVotPerGrup)} amb vot per grup</span></li>
    <li><span class="etq">Punts unànimes</span><span class="gran">${number(llegibles.filter((p) => p.unanimitat).length)}</span><span class="sub">dels punts llegits</span></li>
  </ul>`;
  const punts = visibles.length === 0 ? `<p class="compta">No hi ha prou informació de vot per mostrar punts concrets.</p>` : `<ol class="punts-ple">${visibles.map((p) => {
    const vots = p.vots.filter((v) => v.vots !== null).map((v) => `<span class="vot-grup" title="${escape(`${v.grup}: ${v.sentit}`)}"><b>${escape(v.grup)}</b> ${number(v.vots!)}</span>`).join("");
    return `<li><div class="punt-cap"><time datetime="${escape(p.data)}">${escape(p.data)}</time><span class="punt-tipus">${escape(p.tipus)}</span>${p.unanimitat ? '<span class="vot-unanim">unànime</span>' : ""}</div><b>${escape(p.titol)}</b>${p.resultat ? `<span class="resultat-vot">${escape(p.resultat)}</span>` : ""}${vots ? `<div class="vots-grups">${vots}</div>` : ""}${p.cita ? `<details class="nota"><summary>Què diu l'acta</summary>${escape(p.cita)}</details>` : ""}<a class="font-acta" href="${escape(p.url)}" rel="noopener nofollow">Veure l'acta</a></li>`;
  }).join("")}</ol>`;
  return `${resum}<p class="entrada-bloc">Aquí no mesurem només quants punts hi ha: mirem si l'acta permet saber <b>què va votar cada grup</b> i si el resultat va ser unànime.</p>${punts}<details class="nota"><summary>Com llegim les actes</summary>Hem llegit ${number(mocions.actes.llegides)} actes i desat ${number(puntsLlegits.desats)} punts. Els punts omesos (${number(puntsLlegits.omesos)}) no entren al recompte. Un vot no apareix si l'acta no el diu explícitament.</details>`;
}

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
  /** Les files de la Generalitat i, marcades amb `font: "wikidata"`, les que J31 hi afegeix. */
  history: PasAlcaldia[];
  changes: { term: string; mayors: { name: string; tookOfficeOn: string | null }[]; partyChanged: boolean; onlySuccessorKnown?: boolean; daysIntoTerm?: number }[];
  currentTermChange: { term: string; mayors: { name: string; tookOfficeOn: string | null }[]; onlySuccessorKnown?: boolean; daysIntoTerm?: number } | null;
  distinctPeople: number;
};

/**
 * Quants anys s'obren abans de plegar l'històric.
 *
 * Dotze i no deu perquè un mandat municipal en dura quatre: dotze anys són
 * exactament **tres mandats sencers** i deu en parteixen un pel mig, de manera
 * que la finestra deixaria mitja legislatura a cada banda de la línia. Val per
 * a l'històric d'alcaldies i per a les sèries dels comptes.
 */
const ANYS_OBERTS = 12;

const ELECTIONS = ["M20231", "M20191", "M20151"] as const;
/**
 * El camí fins a `/observatori/` des de `m/<slug>/`, amb la barra final.
 *
 * És el mateix per a tots els enllaços de la fitxa —capçalera, peu, pastilles
 * de sigles, descàrregues— i s'escriu una vegada perquè no hi hagi dues
 * profunditats diferents a la mateixa pàgina.
 */
const BASE = "../../";
const ELECTION_YEAR: Record<string, string> = { M20231: "2023", M20191: "2019", M20151: "2015" };

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const number = (n: number): string => n.toLocaleString("ca-ES");
const percent = (n: number): string => `${n.toFixed(1).replace(".", ",")} %`;

/**
 * Un percentatge que la font ja dona arrodonit a l'enter: «57 %», i no
 * «57,0 %».
 *
 * Les dones al ple (J-mètriques) i les licitacions d'una sola oferta (J10)
 * arriben com a enters, i passar-los per `percent()` hi afegia un decimal que
 * no existeix: un «57,0 %» fa creure que se sap fins a la desena, i 4 de 7
 * regidores són un 57,1 %. Les medianes del grup, que poden caure entre dos
 * enters, conserven el ,5 quan el tenen.
 */
const percentEnter = (n: number): string => (Number.isInteger(n) ? `${number(n)} %` : percent(n));

/**
 * De quina força és un grup municipal, pel seu nom llarg.
 *
 * Només dues evidències, i totes dues són literals: que el nom sencer del
 * partit hi surti escrit —«Partit dels Socialistes de Catalunya»— o que les
 * sigles del parèntesi final ho diguin —«(PSC)», «(ERC)». Res d'endevinar per
 * com sona: «Grup Municipal Republicà» no diu Esquerra i es queda sense color,
 * que és el que ha de passar quan no se sap.
 */
function familiaDelNomDeGrup(nom: string): string | null {
  const net = nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  for (const marca of PARTY_BRANDS) {
    const sencer = marca.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    if (sencer.length > 8 && net.includes(sencer)) return marca.id;
  }
  // Els noms en castellà dels partits estatals: a Sabadell el grup es diu
  // «PARTIDO POPULAR» i la marca es diu «Partit Popular». És el mateix partit
  // escrit en l'altra llengua, no una deducció.
  const EN_CASTELLA: ReadonlyArray<readonly [string, string]> = [
    ["partido popular", "pp"],
    ["partido de los socialistas", "psc"],
    ["partido socialista obrero", "psc"],
    ["esquerra republicana", "erc"],
  ];
  for (const [text, marca] of EN_CASTELLA) if (net.includes(text)) return marca;
  const parentesi = /\(([^)]{1,12})\)\s*$/.exec(nom.trim());
  return parentesi ? siglesFamily(parentesi[1]!) : null;
}

/** Color de la candidatura: el que publica la Generalitat, o el de la marca. */
/**
 * El color d'una candidatura, i en quin ordre es decideix.
 *
 * Abans manava el color que porta la font per a aquella candidatura i aquella
 * elecció, i la marca només hi entrava si aquell no hi era. Sortien dues coses
 * mal fetes a la mateixa taula de Barcelona:
 *
 * - **El PP en dos blaus**: `#234b90` el 2023 i `#01a7e3` el 2019, perquè la
 *   font en dona un de diferent cada convocatòria. El mateix partit canviant de
 *   color entre files diu que són dos partits, que és justament el contrari del
 *   que la taula ha de fer veure.
 * - **Grisos que no hi havien de ser**: «BARCELONA EN COMÚ-ECG», «BCN Canvi-Cs»
 *   i «JUNTS» sortien de color mort perquè la ingesta no els va desar cap
 *   `brandId`, tot i que `siglesFamily()` els reconeix tots tres sense dubtar.
 *   El color el decidia una dada desada i envellida en comptes de la funció que
 *   sap la resposta.
 *
 * Ara mana la marca quan la sabem —desada o deduïda de les sigles— i el color
 * de la font queda per a les llistes locals que no som capaços de reconèixer,
 * que és on de debò aporta alguna cosa. El gris és per a l'últim cas i vol dir
 * el que ha de voler dir: no sabem de qui és.
 */
export function colorDeCandidatura(candidature: CandidatureShare): string {
  // `local` no és una marca: és el calaix d'«aquesta no l'hem sabuda reconèixer»,
  // i per això no atura la pregunta a les sigles. «BCN Canvi-Cs» hi era desada i
  // es quedava grisa tot i que és Ciutadans amb un nom de campanya al davant.
  const desada = candidature.brandId === "local" ? null : candidature.brandId;
  const family = desada ?? siglesFamily(candidature.sigles) ?? candidature.brandId;
  const marca = BRANDS_BY_ID.get(family ?? "")?.color;
  if (marca && family !== "local") return marca;
  const official = candidature.color?.trim();
  if (official && /^#[0-9a-f]{6}$/i.test(official)) return official;
  return "#8b8b8b";
}

/**
 * Es deia `formatDate` i tenia la seva pròpia còpia dels mesos, sense apòstrof:
 * la taula d'alcaldies de les 947 fitxes publicava «19 de abril del 1979».
 * Ara és la de `lib/text.ts`, que és la que ja feien servir bé l'AMB i les
 * comarques.
 */
const formatDate = dataCurta;

/**
 * «al 21 d'agost del 2026», i «a l'1 de gener» o «a l'11 de juny» quan el dia
 * s'apostrofa. Es fa a partir d'`elDia()` perquè la regla de quins dies porten
 * apòstrof visqui en un sol lloc —`lib/text.ts`— i no se'n faci aquí una còpia
 * que s'oblidi de l'11 com s'havia oblidat abans.
 */
function alDia(data: string | null): string {
  const text = elDia(data);
  return text.startsWith("el ") ? `al ${text.slice(3)}` : text ? `a ${text}` : "";
}

/**
 * La primera lletra en majúscula, per quan una frase de `lib/text.ts` obre una
 * oració: «Consultat el 27 d'octubre del 2026.» a la lletra petita.
 */
function majuscula(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ---------------------------------------------------------------- fragments

/**
 * El que la fitxa sap d'una candidatura més enllà del recompte: si forma govern
 * i qui seu als seus escons, per ordre. Ho calcula `seientsDelPle()` a partir
 * del ple que la pàgina ja té («Qui seu al ple»), i l'hemicicle ho posa a
 * l'etiqueta de cada cercle.
 */
type SeientsCandidatura = { govern: boolean; persones: string[] };

/**
 * Qui seu a cada escó i quins grups formen govern, per sigles de candidatura.
 *
 * L'hemicicle rep les candidatures del 2023 i el bloc «Qui seu al ple» rep la
 * seu electrònica o el registre de la Generalitat: són dues llistes que no
 * s'escriuen igual («PSC-CP» i «Grup Municipal del PSC»), i fins ara no es
 * parlaven. Aquí es lliguen amb la mateixa regla que dona el color a cada grup
 * (`candidaturaDelGrup`), de manera que el cercle i la cara diuen la mateixa
 * persona. Les fonts són les mateixes que tria el bloc de sota, en el mateix
 * ordre —la seu si hi és, el registre si no— i l'alcaldia va la primera del
 * seu grup, com a la graella.
 *
 * El govern surt de les banderes de la seu quan es poden creure —la mateixa
 * regla que `renderPleCompacte`: a Sabadell només marquen l'alcaldessa, i
 * llavors no diuen qui governa— i, si no, de la força de l'alcaldia, que és
 * l'única de què la mètrica del govern està segura. Un ple que no lliga amb
 * cap candidatura (els no adscrits, un grup que no es reconeix) no s'inventa
 * cap nom: aquells escons tornen a dir el grup.
 */
function seientsDelPle(
  data: RadiografiaData,
  candidaturaDelGrup: (grup: string | null) => CandidatureShare | null,
  alcaldia: { carrec: CarrecSeue | null },
): Map<string, SeientsCandidatura> {
  const per = new Map<string, SeientsCandidatura>();
  const entrada = (sigles: string): SeientsCandidatura => {
    let e = per.get(sigles);
    if (!e) {
      e = { govern: false, persones: [] };
      per.set(sigles, e);
    }
    return e;
  };
  const government = data.government;

  const seu = data.carrecs?.carrecs ?? [];
  if (seu.length > 0) {
    const marcats = seu.filter((c) => c.equipGovern).length;
    const banderesFiables = government?.mayorSeats === null || government?.mayorSeats === undefined || marcats >= government.mayorSeats;
    const teLAlcaldia = (c: CarrecSeue): boolean => c === alcaldia.carrec;
    for (const c of [...seu].sort((a, b) => (teLAlcaldia(b) ? 1 : 0) - (teLAlcaldia(a) ? 1 : 0))) {
      const candidatura = candidaturaDelGrup(c.grup);
      if (!candidatura) continue;
      const e = entrada(candidatura.sigles);
      e.persones.push(c.nom);
      if (banderesFiables && c.equipGovern) e.govern = true;
    }
  } else if (data.councillors.length > 0) {
    // La mateixa regla que `renderCouncillors`: el nom oficial mana; el càrrec
    // «Alcalde» del registre només decideix quan no hi ha cap nom oficial.
    const nomOficial = government?.mayorName ? normalizePersonName(government.mayorName) : "";
    const pelNom = nomOficial === "" ? null : (data.councillors.find((c) => normalizePersonName(c.name) === nomOficial) ?? null);
    const esLAlcaldia = (c: Councillor): boolean => (pelNom ? c === pelNom : nomOficial === "" && esAlcaldia(c.role));
    const ordenats = [...data.councillors].sort(
      (a, b) => (esLAlcaldia(b) ? 1 : 0) - (esLAlcaldia(a) ? 1 : 0) || (a.orderNum ?? 99) - (b.orderNum ?? 99),
    );
    for (const c of ordenats) {
      const candidatura = candidaturaDelGrup(c.sigles ?? c.groupName);
      if (candidatura) entrada(candidatura.sigles).persones.push(nomLlegible(c.name));
    }
  }

  if (government?.mayorSigles && ![...per.values()].some((e) => e.govern)) {
    const candidatura = candidaturaDelGrup(government.mayorSigles);
    if (candidatura) entrada(candidatura.sigles).govern = true;
  }
  return per;
}

function renderHemicycle(
  candidatures: readonly CandidatureShare[],
  totalSeats: number,
  majority: number,
  seients: ReadonlyMap<string, SeientsCandidatura> = new Map(),
): string {
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

  // Els cercles els escriu hemicycle.ts: cada seient porta el grup, «N de M
  // regidories», els vots amb el tant per cent, «al govern» si escau i qui hi
  // seu quan se sap, en atributs i en un <title>, que és el que fa que en
  // passar-hi el cursor surti l'etiqueta comuna dels gràfics (GRAFICS_JS).
  const circles = seientsHemicicle(
    seats,
    sorted.map((c) => {
      const seu = seients.get(c.sigles);
      return {
        nom: c.sigles,
        regidories: c.seats,
        color: colorDeCandidatura(c),
        vots: c.votes,
        pctVots: c.share,
        govern: seu?.govern,
        persones: seu?.persones,
      };
    }),
    totalSeats,
  );

  const majorityX = width / 2;
  return `<figure class="hemicicle">
  <svg viewBox="0 0 ${width} ${height + 6}" role="img"
       aria-label="Hemicicle de ${totalSeats} regidories. ${sorted.map((c) => `${c.sigles}, ${c.seats}`).join("; ")}.">
    <line x1="${majorityX}" y1="0" x2="${majorityX}" y2="${height}" stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="5 5" opacity=".45"/>
    ${circles}
  </svg>
  <figcaption>${totalSeats} regidories · la ratlla marca la majoria absoluta, que són ${majority}. Cada cercle és una regidoria: ${seatRadius > 0 ? "es poden comptar" : ""}</figcaption>
</figure>`;
}

/**
 * El slug de cada candidatura d'un ple, el mateix que fa servir qui escriu les
 * seves pàgines. Es calcula un cop per ple i es consulta per sigles.
 */
function slugDeCandidatura(
  candidatures: readonly CandidatureShare[],
): (sigles: string) => string {
  const noms = candidatures.map((c) => c.sigles);
  const slugs = assignaSlugs(noms);
  const per = new Map(noms.map((n, i) => [n, slugs[i]!]));
  return (sigles: string) => per.get(sigles) ?? slugify(sigles);
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
      <span class="qui"><span class="mostra" style="--c:${colorDeCandidatura(c)}"></span><b><a href="${escape(
        slugPer(c.sigles),
      )}/">${escape(c.sigles)}</a></b></span>
      <span class="xifra"><b>${c.seats}</b> ${c.seats === 1 ? "regidoria" : "regidories"}</span>
      <span class="proporcio" aria-hidden="true"><i style="--c:${colorDeCandidatura(c)};--w:${(100 * c.share) / maxim}%"></i></span>
      <span class="secundari">${number(c.votes)} vots · ${percent(c.share)} · ${number(Math.round(c.votes / c.seats))} vots per regidoria</span></li>`,
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
          const { fons, tinta } = sobreColor(colorDeCandidatura(c));
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
    // A sota de la barra, els noms un altre cop. En una pantalla estreta el
    // tram més gran no arriba a cinquanta píxels i el nom hi sortiria com a
    // «Triasx…»: allà mana aquesta llista i la barra es queda neta. A partir de
    // 560px passa al revés, i el nom torna a dins del tram. Sempre n'hi ha
    // exactament un de visible, de manera que qui llegeix amb veu no ho sent
    // dues vegades.
    const noms = election.candidatures
      .filter((c) => c.seats > 0)
      .map(
        (c) => `<li><span class="mostra" style="--c:${sobreColor(colorDeCandidatura(c)).fons}"></span>${escape(
          c.sigles,
        )} <b>${c.seats}</b></li>`,
      )
      .join("");
    return `<tr><th scope="row">${ELECTION_YEAR[electionId]}</th><td><div class="barra">${bars}</div>
    <ul class="noms-serie">${noms}</ul></td></tr>`;
  });
  return `<table class="serie"><caption class="nomes-lectors">Regidories per candidatura a cada elecció</caption>
  <colgroup><col class="any-serie"><col></colgroup>
  <tbody>${rows.join("")}</tbody></table>`;
}

/** Un decimal amb la coma catalana, i el signe davant si n'hi ha d'anar. */
const punts = (n: number): string => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(1).replace(".", ",")}`;

/**
 * El regle amb la mediana del grup marcada a sobre.
 *
 * És la peça que ja feien servir els diners, treta a part perquè la faci servir
 * tothom qui n'hagi de menester: una xifra amb una escala de 0 a 100 i una
 * marca que diu on és el mig del grup. Sense la marca, un 60,6 % de
 * participació no es pot jutjar; amb la marca, es veu d'una ullada si el poble
 * hi va anar més o menys que els de la seva mida.
 *
 * Només serveix per a percentatges, que és on el 0 i el 100 volen dir alguna
 * cosa de debò. Per a un import en euros caldria inventar-se un màxim, i un
 * màxim inventat fa que la barra digui el que hagi triat qui la dibuixa.
 */
function reglePercentatge(valor: number, mediana: number | null, etiqueta: boolean): string {
  const dins = (n: number): number => Math.max(0, Math.min(100, n));
  const marca = mediana === null
    ? ""
    : `<b style="--m:${dins(mediana)}%">${etiqueta ? "<span>mediana</span>" : ""}</b>`;
  return `<span class="regle" aria-hidden="true"><i style="--w:${dins(valor)}%"></i>${marca}</span>`;
}

/**
 * La frase que compara amb el grup. Va escrita en punts i no en percentatge del
 * percentatge: dir «un 7 % més» quan es passa del 56 % al 60 % és el gènere
 * d'error que fa que dues fonts diguin coses diferents del mateix número.
 */
/**
 * @param curta Diu la diferència i prou, sense tornar a nomenar el grup.
 *
 * Qui és el grup de comparació no canvia entre les files d'una mateixa llista, i
 * escriure'l a cadascuna vol dir repetir «dels 46 municipis de 20.001 a 50.000
 * habitants» tres vegades seguides: seixanta caràcters que no aporten res la
 * segona vegada i que són el gruix del bloc. És la mateixa regla que ja seguia
 * l'etiqueta «mediana» del regle, aplicada també a la frase.
 */
function fraseMediana(valor: number, m: MedianaGrup | null, unitat: string, curta = false): string {
  if (!m) return "";
  const diferencia = Math.round(10 * (valor - m.mediana)) / 10;
  // «La mediana» és el nom tècnic; a la frase s'hi diu «el municipi del mig»,
  // que és el que és i s'entén sense haver fet estadística.
  const on = diferencia === 0
    ? "igual que el municipi del mig"
    : `${punts(diferencia)} ${unitat} ${diferencia > 0 ? "per sobre" : "per sota"} del municipi del mig`;
  if (curta) return `<span class="comparativa">${on} (${percent(m.mediana)})</span>`;
  return `<span class="comparativa">${on} dels ${m.quants} ${escape(m.etiqueta)}
    (${percent(m.mediana)})</span>`;
}

function renderTurnout(
  rows: readonly { electionId: string; censusSize: number | null; voters: number | null; blankVotes: number | null }[],
  medianes?: MedianesMunicipi,
): string {
  const ordered = ELECTIONS.map((e) => rows.find((r) => r.electionId === e)).filter(Boolean) as typeof rows;
  let etiquetaPosada = false;
  const items = ordered.map((row) => {
    const pct = row.censusSize && row.voters ? (100 * row.voters) / row.censusSize : null;
    const m = medianes?.participacio[row.electionId] ?? null;
    // L'etiqueta «mediana» va només al primer regle que en porti: tres vegades
    // la mateixa paraula és soroll, i la marca ja s'entén un cop s'ha llegit.
    const etiqueta = m !== null && pct !== null && !etiquetaPosada;
    if (etiqueta) etiquetaPosada = true;
    return `<li><b>${ELECTION_YEAR[row.electionId]}</b>
      <span class="gran">${pct === null ? "—" : percent(pct)}</span>
      ${pct === null ? "" : reglePercentatge(pct, m?.mediana ?? null, etiqueta)}
      ${pct === null ? "" : fraseMediana(pct, m, "punts", !etiqueta)}
      <span class="secundari">${number(row.voters ?? 0)} de ${number(row.censusSize ?? 0)} · ${number(row.blankVotes ?? 0)} en blanc</span></li>`;
  });

  /*
   * L'histograma del grup ja no hi és.
   *
   * Dibuixava com queda repartida la participació dels 46 municipis de la mida
   * d'aquest, amb la marca on cau ell. És una bona idea i estava ben feta, però
   * al costat de tres regles que ja porten la mediana marcada explicava una
   * segona vegada el que la llista ja diu, i era la peça més alta d'un bloc que
   * havia de ser curt. La dada no es perd: el regle continua dient on queda
   * respecte de la mediana, i qui vulgui la distribució sencera la té a
   * `dades/`. Si algun dia torna, que sigui a un lloc on sigui l'única cosa
   * que hi ha, i no la tercera manera de dir el mateix.
   */

  /*
   * El regle de dispersió del 23-M: una marca per municipi del grup, del que
   * menys participació va tenir al que més, amb la mediana i «tu ets aquí».
   * No repeteix cap dels regles de sobre: aquells diuen on és la mediana, i
   * aquest ensenya el grup sencer —un percentil 70 d'un grup atapeït i un
   * d'un grup partit en dos no volen dir el mateix. Només es pot dibuixar
   * aquí perquè la participació és l'única mètrica de la fitxa que desa els
   * valors del grup (`MedianaGrup.valors`); les marques van sense nom perquè
   * la mediana no guarda de quin municipi és cada valor.
   */
  const darrera = ordered.find((r) => r.electionId === "M20231") ?? null;
  const m2023 = medianes?.participacio["M20231"] ?? null;
  const pct2023 =
    darrera?.censusSize && darrera.voters ? (100 * darrera.voters) / darrera.censusSize : null;
  let dispersio = "";
  if (m2023 && pct2023 !== null && m2023.valors.length >= 4) {
    // El municipi ja és dins de `valors`: no s'hi afegeix una segona vegada
    // —mouria la mediana— sinó que es marca com a seva la marca més propera.
    const marques: { valor: number; nom: string; aquest?: boolean }[] = m2023.valors.map((v) => ({
      valor: v,
      nom: "",
    }));
    let meva = 0;
    for (let i = 1; i < marques.length; i++) {
      if (Math.abs(marques[i]!.valor - pct2023) < Math.abs(marques[meva]!.valor - pct2023)) meva = i;
    }
    marques[meva] = { valor: marques[meva]!.valor, nom: "aquest municipi", aquest: true };
    dispersio = regleDispersio("On cau entre els de la seva mida, el 2023", marques, {
      format: (v) => percent(v),
      quants: `els ${m2023.quants} municipis ${m2023.etiqueta}`,
      etiquetaMediana: "El del mig (la mediana)",
      sotaMediana: "el municipi del mig",
    });
  }
  return `<ul class="participacio">${items.join("")}</ul>${dispersio}`;
}

/** Una xifra amb la seva unitat. La fan servir l'indicador i la seva mediana. */
function formatValue(value: number, unit: FinanceIndicator["unit"]): string {
  if (unit === "percent") return `${value.toFixed(1).replace(".", ",")} %`;
  if (unit === "euros") return `${number(Math.round(value))} €`;
  return `${number(Math.round(value))} dies`;
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
  <details class="nota"><summary>La lletra petita</summary>Hi ha <b>${current.years.length} ${current.years.length === 1 ? "exercici liquidat" : "exercicis liquidats"}
  dels ${current.expected}</b> que té el mandat: les liquidacions triguen, i el darrer any encara no hi és.
  ${mayorChanged ? "En aquest mandat hi ha hagut canvi d'alcaldia, així que les xifres són del govern, no d'una persona. " : ""}
  Que una xifra millori o empitjori no vol dir que s'hagi fet bé o malament: vol dir que ha canviat.</details>`;
}

/**
 * El deute, any a any, contra els municipis de la seva mida.
 *
 * És l'única peça que queda del bloc «Els comptes» de vuit targetes: les
 * targetes repetien els mateixos indicadors que el balanç del mandat i que
 * «com queda respecte dels seus», i tres blocs per a les mateixes vuit xifres
 * era el que feia la fitxa tan llarga. La sèrie del deute no la repetia ningú.
 *
 * Aquí hi havia onze columnes de CSS. Dibuixaven la sèrie i no la deixaven
 * jutjar: sense saber on es mouen els altres, 1.204 € per habitant no són ni
 * molts ni pocs, i un any que la font no dona hi desapareixia sense deixar
 * cap forat perquè les columnes es posen l'una al costat de l'altra i prou.
 * Amb un eix de veritat i la meitat central del grup al darrere, les dues
 * coses es veuen.
 *
 * Tota la sèrie que la font dona, i no un tall nostre: hi havia un 2015
 * escrit a mà que era el mateix que hi havia a la ingesta, i quan aquella va
 * passar al 2010 —que és on comença de debò el conjunt de deute viu— aquest
 * tall s'hauria menjat els cinc anys nous sense que ho notés ningú.
 */
function renderDeuteAnyAAny(finances: FinancesMetric, seriesGrup?: SeriesMunicipi): string {
  const series = finances.debtSeries;
  if (series.length < 2) return "";
  const mandats = finances.bands
    .filter((b) => b.to >= (series[0]?.year ?? 0))
    .map((b) => ({
      desDe: b.from,
      finsA: b.to,
      // El primer cognom, que és com se'n parla: «Farrés», no «Marta». Amb un
      // sol mot es queda el que hi hagi, que ja és el que hi ha.
      etiqueta: b.mayor ? (nomLlegible(b.mayor).split(/\s+/)[1] ?? nomLlegible(b.mayor).split(/\s+/)[0]!) : b.id,
    }));
  const grafic = serieTemporal(
    series.map((p) => ({ any: p.year, valor: p.perHead })),
    {
      titol: "Deute per habitant",
      format: (v) => `${number(Math.round(v))} €`,
      banda: seriesGrup?.deuteGrup,
      grup: seriesGrup?.grup ?? finances.group?.label ?? null,
      mandats,
      nota: "font: Consorci AOC, deute viu a 31 de desembre",
    },
  );
  if (grafic === "") return "";

  const bandLegend = finances.bands
    // El mateix que a la sèrie: el primer any el mana la font i no un número
    // escrit aquí, que era el que amagava mitja història de cada poble.
    .filter((b) => b.to >= (series[0]?.year ?? 0))
    .map(
      (band) => `<li class="mandat-${band.id}"><span class="tram-mandat"></span>
      <b>${escape(band.id)}</b>${band.mayor ? ` · ${escape(band.mayor)}` : ""}${band.party ? ` (${escape(band.party)})` : ""}</li>`,
    )
    .join("");

  return `<h3 class="subtitol">Deute per habitant, any a any</h3>
  ${grafic}
  <ul class="clau-mandats">${bandLegend}</ul>
  <details class="nota"><summary>La lletra petita</summary>Deute viu a 31 de desembre de cada any, dividit pel padró d'aquell any;
  l'últim exercici tancat que consta és el ${finances.year}.
  ${finances.group ? `Les comparacions són amb els <b>${finances.group.size} municipis catalans ${escape(finances.group.label)}</b>, no amb tot Catalunya: comparar un poble amb Barcelona no diu res.` : ""}
  <b>Això no és una nota al govern</b>: diu com estan els comptes, no si algú ho ha fet bé.</details>`;
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
  const contra = grup === null ? "del municipi del mig de Catalunya" : `del que és habitual ${grup}`;
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

/*
 * Els mapes de quadres («treemap») d'on surten i on van els diners ja no hi
 * són: deien la mateixa proporció que les barres de sota —cada barra porta el
 * seu import i la marca del que és habitual— i un dibuix que repeteix el de
 * sota no és una segona lectura, és el doble d'alçada. El mòdul `quadres.ts`
 * continua viu per a l'índex de partits, on el mapa és l'única peça.
 */

/**
 * Quant gasta l'ajuntament per habitant, i què és habitual als seus.
 *
 * Ho calculen dues peces —el bloc dels diners i la pastilla de l'ullada— i
 * s'ha de calcular igual a totes dues: J15 porta la sèrie sencera, un punt per
 * exercici liquidat des del 2019, i J8 només l'últim any. Es fa servir la que
 * en tingui més, i si no hi ha J15 la fitxa encara pot dir la xifra de l'últim
 * any amb J8. La mediana del grup és **del mateix any que la xifra i de cap
 * altre**: comparar el 2025 d'aquest municipi amb el 2024 dels seus faria
 * semblar decisions del ple el que només és un any de diferència.
 */
type DespesaHabitant = {
  perHabitant: number;
  any: number;
  total: number | null;
  /** Els habitants implícits a la xifra: el total dividit pel per habitant. */
  habitants: number | null;
  serie: { any: number; total: number; perHabitant: number; fiable: boolean }[];
  referencia: { mediana: number; quants: number | null; etiqueta: string | null } | null;
};

function despesaPerHabitant(
  despesa: DespesaProgramesMetric | null,
  spending: SpendingMetric | null,
): DespesaHabitant | null {
  const serie = [...(despesa?.total ?? [])]
    .filter((p): p is { any: number; total: number; perHabitant: number; fiable: boolean } =>
      p.perHabitant !== null && p.perHabitant > 0)
    .sort((a, b) => a.any - b.any);
  const ultim = serie.length > 0 ? serie[serie.length - 1]! : null;

  const perHabitant = ultim?.perHabitant ?? spending?.totalPerHead ?? null;
  const any = ultim?.any ?? spending?.year ?? null;
  if (perHabitant === null || perHabitant <= 0 || any === null) return null;

  // Els habitants no es demanen enlloc: la pròpia dada ja els porta implícits,
  // perquè els euros per habitant són el total dividit pel padró d'aquell any.
  // Fer servir el padró d'ara donaria un total que no quadra amb la divisió.
  const total = ultim?.total ?? (spending?.poblacio != null ? spending.totalPerHead * spending.poblacio : null);
  const habitants = ultim ? Math.round(ultim.total / ultim.perHabitant) : (spending?.poblacio ?? null);

  const referencia =
    despesa?.medianaGrupTotal != null && despesa.medianaGrupTotal.any === any
      ? {
          mediana: despesa.medianaGrupTotal.mediana,
          quants: despesa.medianaGrupTotal.ambDada,
          etiqueta: despesa.grup?.etiqueta ?? null,
        }
      : spending?.totalMediaGrup != null && spending.totalMediaGrup > 0 && spending.year === any
        ? {
            mediana: spending.totalMediaGrup,
            quants: spending.grup?.ambDada ?? null,
            etiqueta: spending.grup?.etiqueta ?? despesa?.grup?.etiqueta ?? null,
          }
        : null;

  return { perHabitant, any, total, habitants, serie, referencia };
}

/**
 * Quant gasta l'ajuntament, en total i per habitant.
 *
 * El bloc dels diners deia **en què** es reparteixen —d'on surten i on van—
 * i no deia mai **quants n'eren**. Un repartiment
 * sense total no es pot jutjar: un 12 % en administració general vol dir una
 * cosa en una liquidació de 20 milions i una altra de molt diferent en una de
 * dos-cents mil euros. Per això la xifra gran va aquí dalt, abans de les
 * llistes, i no al mig de la llista de partides.
 *
 * **Això és una liquidació i no un pressupost, i no són la mateixa cosa.** El
 * pressupost és el que el ple aprova abans de començar l'any; la liquidació és
 * el que l'ajuntament ha acabat reconeixent com a obligació, amb totes les
 * modificacions de l'exercici incloses. Del pressupost aprovat no en tenim cap
 * font amb la mateixa definició per als 947 municipis —ni a l'AOC ni a la
 * Generalitat—, i publicar una liquidació dient-ne «pressupost» seria posar a
 * la pàgina una xifra que ningú no ha votat. Es diu a la pàgina, cada vegada, i
 * amb el mateix relleu que la xifra.
 *
 * La comparació amb els municipis de la seva mida no és un adorn: és l'única
 * cosa que fa jutjable un import per habitant. 1.684 € no són ni molts ni pocs
 * fins que no se sap què gasten els seus.
 */
export function renderQuantGasta(
  despesa: DespesaProgramesMetric | null,
  spending: SpendingMetric | null,
): string {
  const gasta = despesaPerHabitant(despesa, spending);
  if (!gasta) return "";
  const { perHabitant, any, total, habitants, serie, referencia } = gasta;
  const ultim = serie.length > 0 ? serie[serie.length - 1]! : null;

  const diferencia =
    referencia !== null && habitants !== null
      ? Math.round((perHabitant - referencia.mediana) * habitants)
      : null;

  const comparacio =
    referencia === null
      ? // Sense mediana del grup no s'escriu cap comparació inventada: es diu
        // que no la tenim, que és el que passa i el que la fitxa ha de dir.
        `<p class="nota oberta">D'aquest exercici no en tenim què és habitual als municipis de la
         seva mida, i per tant la xifra va sola. Sense comparació no diu si és molta o poca.</p>`
      : `<p class="entrada-bloc">Als municipis ${escape(referencia.etiqueta ?? "de la seva mida")} el més
         habitual són <b>${number(Math.round(referencia.mediana))} € per habitant</b>${
           referencia.quants === null ? "" : ` (${referencia.quants} amb liquidació)`
         }.${
           diferencia === null || diferencia === 0
             ? ""
             : ` Gastant com ells, la liquidació d'aquest ajuntament seria
                <b>${number(Math.abs(diferencia))} € ${diferencia > 0 ? "més petita" : "més gran"}</b> cada any.`
         }</p>`;

  // La sèrie va dins de la targeta, com a espurna, i el canvi escrit al costat:
  // la línia de 720 px amb l'eix des de zero sortia plana —de 1.075 a 1.200 en
  // un eix que arrenca a 0 és una ratlla— i no deia res que la xifra no digués.
  // L'espurna diu la forma i la frase diu el quant.
  const espurna =
    serie.length >= 3
      ? sparkline(
          serie.map((p) => ({ any: p.any, valor: p.perHabitant })),
          (v) => `${number(Math.round(v))} €`,
        )
      : "";
  const primer = serie[0] ?? null;
  const canvi =
    primer && ultim && ultim.any > primer.any
      ? (() => {
          const dif = ultim.perHabitant - primer.perHabitant;
          const pct = primer.perHabitant === 0 ? null : (100 * dif) / primer.perHabitant;
          return `<span class="sub canvi">Del ${primer.any} al ${ultim.any}: <b>${signeDe(dif)}${number(Math.round(Math.abs(dif)))} €</b>${
            pct === null ? "" : ` (${signeDe(pct)}${decimal(Math.abs(pct), 1)} %)`
          }</span>`;
        })()
      : "";

  // Un exercici que un ajuntament no ha liquidat no és un zero ni un any que no
  // ha existit: és un forat. L'espurna no en dibuixa —salta d'un punt al
  // següent— i per això els anys que falten es diuen, un per un, a sota.
  const forats = despesa?.anysSenseLiquidacio ?? [];

  return `<p class="entrada-bloc">El que aquest ajuntament ha acabat gastant, abans de mirar en què.</p>
  <ul class="gent">
    <li>
      <span class="etq">El que gasta en total</span>
      <span class="gran">${total === null ? "—" : `${number(Math.round(total))} €`}</span>
      <span class="sub">liquidat el ${any}${habitants === null ? "" : ` · ${number(habitants)} empadronats aquell any`}</span>
    </li>
    <li>
      <span class="etq">Per habitant</span>
      <span class="gran">${number(Math.round(perHabitant))} €</span>
      ${espurna}
      ${canvi}
      <span class="sub">el mateix total dividit pel padró d'aquell any</span>
    </li>
  </ul>
  ${comparacio}
  <p class="context-avis"><b>Això és una liquidació, no un pressupost.</b> El pressupost és el que
  el ple aprova abans de començar l'any; la liquidació és el que l'ajuntament ha acabat reconeixent
  com a obligació, amb les modificacions de l'exercici incloses. No són la mateixa cosa i barrejar-les
  seria un error: del pressupost aprovat no hi ha cap font amb la mateixa definició per als 947
  municipis, i per això aquesta pàgina no en publica cap xifra.</p>
  ${
    forats.length > 0
      ? `<p class="nota oberta">${
          forats.length === 1
            ? `L'exercici ${forats[0]} no consta liquidat`
            : `Els exercicis ${forats.slice(0, -1).join(", ")} i ${forats[forats.length - 1]} no consten liquidats`
        }: ${forats.length === 1 ? "d'aquell any" : "d'aquells anys"} no en consta cap xifra, la línia
        ${forats.length === 1 ? "el" : "els"} salta, i un forat no és un zero.</p>`
      : ""
  }
  <details class="nota"><summary>La lletra petita</summary>${
    despesa
      ? `${escape(despesa.base)} ${escape(despesa.font.nom)}, ${escape(despesa.font.organisme)}.`
      : `Despesa liquidada del ${any}, en euros corrents i sense descomptar la inflació.`
  }</details>`;
}

function renderRevenue(revenue: RevenueMetric): string {
  const medianes = revenue.medianesGrup ?? revenue.medians;
  const grup = revenue.grup?.etiqueta ?? null;
  const scale = scaleFor(revenue.figures.map((f) => f.perHead), medianes);
  const propis = revenue.figures.reduce((a, f) => a + f.perHead, 0);
  return `<p class="entrada-bloc">Aquests són els ingressos que l'ajuntament decideix directament: <b>impostos, taxes i preus públics</b>. Les transferències d'altres administracions no hi entren.</p>
  <ul class="diners">${revenue.figures
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
      ? `<p class="nota oberta">Aquesta xifra sí que la comparem amb tot Catalunya i no només amb els
         municipis de la mateixa mida: a diferència de la despesa, el que recapta un ajuntament
         per habitant amb els seus propis impostos gairebé no depèn de quanta gent hi viu
         (${revenue.propis.municipisAmbDada} municipis amb dada).</p>`
      : ""
  }
  <details class="nota"><summary>La lletra petita</summary>Recaptat el ${revenue.year}, en euros per habitant. La marca vertical és
  ${
    revenue.grup
      ? `el valor habitual dels ${revenue.grup.ambDada} municipis ${escape(revenue.grup.etiqueta)}
         dels quals tenim la liquidació`
      : "la mediana de tots els municipis catalans amb dada"
  }.
  És el que es recapta al terme dividit pels empadronats, no el que paga cada veí: on hi ha
  moltes segones residències, part de l'IBI el paga gent que no hi viu.</details>`;
}

function renderSpending(spending: SpendingMetric): string {
  const medianes = spending.medianesGrup ?? spending.medians;
  const grup = spending.grup?.etiqueta ?? null;
  const scale = scaleFor(spending.areas.map((a) => a.perHead), medianes);
  // El total i la seva comparació ja no són aquí: han pujat al capdamunt del
  // bloc, a «Quant gasta en total», perquè és la xifra que les dues llistes
  // reparteixen i llegir-la a mitja llista la deixava com una partida més.
  // Aquí hi queda el repartiment, que és l'altra pregunta.
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
         <p class="nota oberta">Com més baixa és aquesta proporció, més depèn el pressupost del poble de
         decisions que no es prenen al seu ple. No diu si l'ajuntament ho fa bé o malament: diu
         d'on surten els diners.</p>`;
  return `${fraseAuto}<ul class="diners">${spending.areas
    .map((area) => moneyRow(area.label, area.perHead, medianes[area.label], scale, grup))
    .join("")}</ul>
  <details class="nota"><summary>La lletra petita</summary>Liquidat el ${spending.year}. Les àrees són les de la classificació per
  programes, iguals per a tots els ajuntaments, i sumen el total.
  ${
    spending.areas.length < 6
      ? "Les que no hi surten són zero: l'ajuntament no hi destina res."
      : ""
  }</details>`;
}

/*
 * «Què costa cada servei» (el cost efectiu del Ministeri) ja no es dibuixa.
 *
 * Constava com a retirat i encara sortia, amb «otro tipo de gestión (**)»
 * sense traduir. Els valors no són comparables: en clavegueram, el percentil
 * 90 és 507 vegades el percentil 10, i un Q1 de 2 €/habitant vol dir que un
 * poble de mil habitants declara que el seu clavegueram costa dos mil euros
 * l'any —això no és un cost, és un apunt que va a una altra partida. La mètrica
 * `services` es continua carregant perquè `dades.ts` la publica als fitxers de
 * descàrrega, amb l'avís.
 */

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
 * Una persona del ple, tal com la dibuixa la graella compacta.
 *
 * Ve de la seu electrònica o del registre de la Generalitat, i un cop aquí ja
 * no es distingeix: les dues fonts pinten la mateixa fila d'avatars.
 */
type PersonaPle = {
  nom: string;
  carrec: string | null;
  foto: string | null;
  slug: string;
  alcaldia: boolean;
  /** Si se li escriu el càrrec a sota: l'alcaldia i l'equip de govern. */
  ambCarrec: boolean;
  /** Marcada com a govern, només quan les banderes es poden creure. */
  govern: boolean;
};

type GrupPle = { nom: string; color: string; persones: PersonaPle[]; alGovern: number; noAdscrit: boolean };

/** Les inicials d'un nom: la peça que porta qui no té fotografia. */
const inicialsDe = (nom: string): string =>
  nom.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

/**
 * Si un càrrec, tal com l'escriu una font, és el de l'alcaldia.
 *
 * És la mateixa regla que `esAlcaldia` a `alcaldia.ts`, que és qui decideix
 * qui té l'alcaldia per a tot el web i no l'exporta: la paraula «alcald» hi ha
 * de ser, i no hi pot ser com a «tinent d'alcalde» —un càrrec de debò que les
 * seus escriuen—, «d'Alcaldia» —l'àrea que porta el nom de qui mana sense
 * ser-ho— ni «adjunt». Amb la regla vella —que hi fos «alcald»— un tinent
 * d'alcalde escrit abans que l'alcalde sortia amb la cara de qui mana. Aquí
 * només serveix per escriure el càrrec de la portada i per al ple del registre
 * electoral, que no passa per `resolAlcaldia`; qui és l'alcaldia ho diu ell.
 */
/**
 * El ple en una graella d'avatars, grup a grup.
 *
 * Abans cada regidoria era una targeta de tres línies —retrat, nom i càrrec
 * sencer— i un ple de vint-i-set deixava mitja pantalla buida i quatre
 * pantalles de recorregut. Aquí cada grup és una fila de cares amb el color
 * del grup, i el nom i el càrrec van al «title» de l'enllaç i a la fitxa de la
 * persona, que és on es busca. El càrrec només s'escriu a sota de qui mana
 * —l'alcaldia i l'equip de govern— perquè és l'única informació que canvia el
 * que vol dir la cara; a la resta, «Regidor» escrit vint vegades no diu res.
 *
 * Les cares s'ensenyen quan les tenim, i qui no en té rep la seva inicial amb
 * el color del seu grup, a la mateixa mida i amb la mateixa vora: no és el
 * forat que queda quan falta una foto, és una peça dissenyada. I qui llegeix
 * amb veu sent el nom i el càrrec de cadascú, que van dins de l'enllaç.
 */
/*
 * El nom que es veu sota la cara és el `nomCurt()` de `regidor.ts`: el nom de
 * pila i el primer cognom, el mateix que fa servir el bloc «Al mateix grup» de
 * cada fitxa de regidor.
 *
 * Aquí n'hi havia una còpia que treia l'última paraula quan n'hi havia tres o
 * més, i això trencava els cognoms amb partícula: «Joan Pérez i Soler» sortia
 * «Joan Pérez i» i «Víctor Martí de la Rosa», «Víctor Martí de la». La de
 * `regidor.ts` enganxa les partícules (i, de, del, de la, y…) al cognom que
 * les segueix, i fer servir la mateixa vol dir que la mateixa persona es diu
 * igual a totes dues pàgines. El nom complet continua a l'enllaç i a la fitxa.
 */

/**
 * La tinença d'alcaldia en curt: «Primer tinent d'alcalde de Cultura» →
 * «1a tinença», «5aTta.Alcaldessa» → «5a tinença». Si no és una tinença,
 * `null`. El càrrec sencer, tal com l'escriu la seu, és al `title` i a la
 * fitxa; sota la cara només hi cap el que canvia el que vol dir la cara, i
 * «Regidora de l'àrea de…» tallat a mitja paraula no deia res.
 */
function tinencaCurta(carrec: string | null): string | null {
  if (!carrec) return null;
  const net = normalize(carrec);
  if (!/tinen(t|ta|ca)\b|tta\b|tte\b/.test(net)) return null;
  const xifra = net.match(/(\d+)/)?.[1] ?? null;
  const PARAULES: Record<string, number> = {
    primer: 1, primera: 1, segon: 2, segona: 2, tercer: 3, tercera: 3, quart: 4, quarta: 4,
    cinque: 5, cinquena: 5, sise: 6, sisena: 6, sete: 7, setena: 7, vuite: 8, vuitena: 8,
    nove: 9, novena: 9, dese: 10, desena: 10,
  };
  const paraula = net.split(/\s+/).find((w) => PARAULES[w] !== undefined);
  const n = xifra ? Number(xifra) : paraula ? PARAULES[paraula]! : null;
  return n ? `${n}a tinença` : "tinença d'alcaldia";
}

function graellaDelPle(grups: readonly GrupPle[]): string {
  const bloc = (g: GrupPle): string => {
    const totGovern = g.alGovern === g.persones.length && g.alGovern > 0;
    const tint = sobreColor(g.color);
    const retrats = g.persones
      .map((p) => {
        // Mentre la foto es carrega (va en mandrós), el cercle no queda blanc:
        // a sota hi ha les inicials sobre el paper de la casa, com a la portada.
        const retrat = p.foto
          ? `<span class="fx-cara" data-ini="${escape(inicialsDe(p.nom))}"><img class="retrat" src="${escape(p.foto)}" alt="" loading="lazy" width="44" height="44"></span>`
          : `<span class="retrat inicials" style="--c:${tint.fons};--t:${tint.tinta}" aria-hidden="true">${escape(inicialsDe(p.nom))}</span>`;
        const titol = p.carrec ? `${p.nom} · ${p.carrec}` : p.nom;
        const classes = ["persona", p.alcaldia ? "alcaldia" : "", p.govern ? "govern" : ""].filter(Boolean).join(" ");
        // A sota, el càrrec només de qui té l'alcaldia i de les tinences: és
        // l'única informació que canvia el que vol dir la cara.
        const carrecVisible = p.alcaldia ? p.carrec : tinencaCurta(p.carrec);
        // El nom va dins de l'enllaç, amagat als ulls: un enllaç que només és
        // una cara no té nom per a qui llegeix amb veu. El nom curt de sota és
        // per als ulls, i per això el lector de pantalla no el llegeix dues vegades.
        return `<li class="${classes}"><a href="regidor/${escape(p.slug)}/" title="${escape(titol)}" aria-label="${escape(titol)}" data-tip="${escape(titol)}">${retrat}<span class="nomes-lectors">${escape(titol)}</span></a><span class="fx-nom" aria-hidden="true">${escape(nomCurt(p.nom))}</span>${
          carrecVisible ? `<span class="carrec">${escape(carrecVisible)}</span>` : ""
        }</li>`;
      })
      .join("");
    return `<div class="grup-compacte${g.noAdscrit ? " noadscrit" : ""}${totGovern ? " al-govern" : ""}" style="--c:${g.color}">
      <h4><span class="marca-grup"></span>${escape(g.nom)}
        <span class="quants">${g.persones.length}${
          g.alGovern > 0 ? (totGovern ? " · al govern" : ` · ${g.alGovern} al govern`) : ""
        }</span></h4>
      <ul class="retrats">${retrats}</ul>
    </div>`;
  };
  return `<div class="ple-compacte">${grups.map(bloc).join("")}</div>`;
}

/**
 * Qui és al govern segons la seu electrònica, llegit un sol cop.
 *
 * Ho necessiten dues peces que han de dir el mateix: el ple compacte, que
 * pinta qui governa, i «En 30 segons», que diu amb qui. Si cadascuna tingués
 * la seva còpia de la regla de les banderes incompletes, un dia una diria
 * «coalició» i l'altra no.
 */
function lecturaDelGovern(
  fitxa: FitxaCarrecs,
  government: GovernmentMetric | null,
  registre: readonly Councillor[],
): {
  grupDe: (c: CarrecSeue) => string | null;
  govern: CarrecSeue[];
  seientsAlcaldia: number | null;
  banderesIncompletes: boolean;
  grupsGovern: string[];
} {
  /*
   * El grup de cada persona el diu la seu electrònica; quan no el diu (a
   * Tarragona no en diu cap, i els 27 regidors sortien «Sense grup»), el
   * registre electoral de la Generalitat sap amb quina llista va sortir
   * elegida cadascú, i la llista és el grup mentre ningú no digui el contrari.
   * Es busca pel nom normalitzat; qui no hi és, es queda sense grup de debò.
   */
  const siglesDelRegistre = new Map(
    registre.map((c) => [normalizePersonName(c.name), c.sigles ?? c.groupName ?? null] as const),
  );
  const grupDe = (c: CarrecSeue): string | null =>
    c.grup ?? siglesDelRegistre.get(normalizePersonName(c.nom)) ?? null;
  /*
   * Les banderes «equipGovern» de la seu electrònica no serveixen per comptar.
   *
   * A Sabadell només marquen l'alcaldessa, i la fitxa publicava «1 regidoria
   * forma el govern de 27» quan en són 14: una cosa falsa dita amb una dada
   * certa. J13 les posa totes a fals allà on la seu no ho diu. Per això, quan
   * les banderes no arriben ni a les regidories que la mètrica del govern
   * atribueix a l'alcaldia, es donen per incompletes: la frase es fa amb la
   * mètrica —que sí que sap quantes en té— i les marques per persona no es
   * pinten, perquè marcarien qui la seu ha marcat i no qui governa. El càrrec,
   * llavors, només s'escriu sota de l'alcaldia.
   */
  const govern = fitxa.carrecs.filter((c) => c.equipGovern);
  const seientsAlcaldia = government?.mayorSeats ?? null;
  const banderesIncompletes = seientsAlcaldia !== null && govern.length < seientsAlcaldia;
  const grupsGovern = [...new Set(govern.map((c) => grupDe(c)).filter((g): g is string => Boolean(g)))];
  return { grupDe, govern, seientsAlcaldia, banderesIncompletes, grupsGovern };
}

/**
 * El ple segons la seu electrònica del mateix ajuntament.
 *
 * És més al dia que el registre de la Generalitat —a Esplugues aquest hi tenia
 * un tinent d'alcaldia que ja no hi és i li faltaven dues regidores— i, sobre
 * tot, **etiqueta els regidors no adscrits**, que és una cosa que el conjunt
 * obert no diu enlloc i que nosaltres havíem renunciat a deduir.
 */
function renderPleCompacte(
  fitxa: FitxaCarrecs,
  colorPer: (grup: string | null) => string,
  government: GovernmentMetric | null = null,
  registre: readonly Councillor[] = [],
): string {
  const { grupDe, govern, seientsAlcaldia, banderesIncompletes, grupsGovern } = lecturaDelGovern(
    fitxa,
    government,
    registre,
  );
  // La mateixa funció que fa servir el generador de pàgines de regidor, sobre la
  // mateixa llista i en el mateix ordre: així l'enllaç sempre existeix.
  const adreces = adrecesRegidors(fitxa.carrecs);
  const esDelGovern = (c: CarrecSeue): boolean => c.equipGovern && !banderesIncompletes;
  const ambFoto = fitxa.ambFoto > 0;

  const groups = new Map<string, CarrecSeue[]>();
  for (const carrec of fitxa.carrecs) {
    const key = grupDe(carrec) ?? "Sense grup";
    const list = groups.get(key);
    if (list) list.push(carrec);
    else groups.set(key, [carrec]);
  }

  // Qui és l'alcaldia ho decideix `resolAlcaldia`, el mateix que la portada i
  // la resta del web: el càrrec «alcald» que no sigui un tinent, i si no hi
  // és, el nom que dona la font oficial. Buscar-hi la paraula a pèl feia
  // alcalde el primer tinent d'alcalde de la llista.
  const alcaldia = resolAlcaldia(fitxa.carrecs, government).carrec;
  const isMayor = (c: CarrecSeue): boolean => c === alcaldia;
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

  const grups: GrupPle[] = ordered.map(([name, list]) => ({
    nom: name,
    color: colorPer(name),
    noAdscrit: noAdscrit(name),
    alGovern: list.filter(esDelGovern).length,
    persones: [...list]
      .sort((a, b) => (isMayor(b) ? 1 : 0) - (isMayor(a) ? 1 : 0))
      .map((c) => ({
        nom: c.nom,
        // Una seu no actualitzada encara diu «Alcalde» de qui ja no ho és:
        // al costat de l'alcaldia que ha decidit `resolAlcaldia`, es calla.
        carrec: esAlcaldia(c.carrec) && !isMayor(c) ? null : c.carrec,
        foto: c.fotoPetita,
        slug: adreces.get(c) ?? slugify(c.nom),
        alcaldia: isMayor(c),
        ambCarrec: isMayor(c) || esDelGovern(c),
        govern: esDelGovern(c),
      })),
  }));

  // Qui forma el govern, que sovint no és un sol partit: de 453 municipis amb
  // la dada, 195 tenen regidors de més d'un grup a l'equip de govern. La fitxa
  // ho deia només a través de l'alcaldia, i això amagava totes les coalicions.
  // Els grups del govern els compta `lecturaDelGovern`, que és qui també els
  // passa a «En 30 segons»: les dues frases han de dir la mateixa coalició.
  const siglesAlcaldia = government?.mayorSigles ?? government?.winnerSigles ?? null;
  const resumGovern =
    banderesIncompletes && government && siglesAlcaldia
      ? // Amb les banderes incompletes la frase surt de la mètrica del govern:
        // quantes regidories té la força de l'alcaldia i si li arriben per
        // governar sola. De coalicions no se'n diu res, perquè no se sap.
        `<p class="resum-govern">Governa ${sigla(siglesAlcaldia, { base: BASE, color: colorPer(siglesAlcaldia) })}
      amb <b>${number(seientsAlcaldia!)} de ${number(government.totalSeats || fitxa.carrecs.length)} regidories</b>,
      ${seientsAlcaldia! >= government.majority ? "majoria absoluta" : "sense majoria absoluta"}.
      <span class="peu-nota">La seu electrònica no marca qui és a l'equip de govern, i per això aquí no
      s'assenyala ningú com a govern ni com a oposició.</span></p>`
      : govern.length === 0
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

  return `${resumGovern}${graellaDelPle(grups)}
  <details class="nota"><summary>La lletra petita</summary>Composició del ple segons la seu electrònica del mateix ajuntament,
  consultada el ${escape(fitxa.descarregat)}. Va més al dia que el registre de la Generalitat.
  Cada cara porta a la fitxa de la persona; el nom i el càrrec hi són, i també en passar-hi per sobre.
  ${
    ambFoto
      ? `Les fotografies les publica l'ajuntament al seu portal de transparència
         (<a href="${escape(fitxa.url)}" target="_blank" rel="noopener">fitxa original</a>);
         les reproduïm en mida petita i les retirem a la primera petició de la persona.${
           fitxa.ambFoto < fitxa.totalCarrecs
             ? ` D'aquest ple en publica ${fitxa.ambFoto} de ${fitxa.totalCarrecs}: qui no hi
                surt no és que no en tingui, és que el seu ajuntament no l'ha publicada, i per
                això les inicials van amb el color del seu grup i no com un buit.`
             : ""
         }`
      : ""
  }
  Hi surten nom, càrrec i grup, que és el que deriva del càrrec públic; cap dada de contacte.</details>`;
}

/*
 * El ple quan la seu electrònica no en publica la llista.
 *
 * Aquesta és la versió que veuen 483 dels 947 municipis, i té la mateixa forma
 * que l'altra: una fila de cares per grup, amb les inicials i el color de la
 * candidatura, cadascuna enllaçada a la fitxa de la persona. El registre de la
 * Generalitat no diu qui és a l'equip de govern, i per això aquí el càrrec
 * només s'escriu sota de l'alcaldia.
 *
 * L'adreça la calcula `adrecesRegidors()` sobre aquesta mateixa llista i en el
 * mateix ordre que el generador de pàgines, que és el que fa que l'enllaç i el
 * directori no puguin divergir.
 */
function renderCouncillors(councillors: readonly Councillor[], government: GovernmentMetric | null = null): string {
  if (councillors.length === 0) return "";
  const perPersona = councillors.map((c) => ({ nom: c.name, de: c }));
  const adrecesPer = adrecesRegidors(perPersona);
  const adreces = new Map(perPersona.map((p) => [p.de, adrecesPer.get(p)!]));

  const groups = new Map<string, Councillor[]>();
  for (const councillor of councillors) {
    const key = councillor.sigles ?? councillor.groupName ?? "Sense grup";
    const list = groups.get(key);
    if (list) list.push(councillor);
    else groups.set(key, [councillor]);
  }

  // L'alcaldia primer, i després per mida del grup: és l'ordre en què la gent
  // s'ho mira. Qui és l'alcaldia ho diu el nom de la font oficial, que està al
  // dia; el càrrec del registre és el del dia de la constitució del ple i,
  // després d'un relleu, diria «Alcalde» de qui ja no ho és. El càrrec només
  // decideix quan NO hi ha cap nom oficial: si n'hi ha un i no lliga amb cap
  // fila, val més no destacar ningú que coronar l'alcaldia vella del registre,
  // que és el que passava a Tarrés després del relleu.
  const nomOficial = government?.mayorName ? normalizePersonName(government.mayorName) : "";
  const pelNom = nomOficial === "" ? null : councillors.find((c) => normalizePersonName(c.name) === nomOficial) ?? null;
  const isMayor = (c: Councillor): boolean => (pelNom ? c === pelNom : nomOficial === "" && esAlcaldia(c.role));
  const ordered = [...groups.entries()].sort((a, b) => {
    const mayorA = a[1].some(isMayor) ? 1 : 0;
    const mayorB = b[1].some(isMayor) ? 1 : 0;
    if (mayorA !== mayorB) return mayorB - mayorA;
    return b[1].length - a[1].length;
  });

  const grups: GrupPle[] = ordered.map(([name, list]) => ({
    nom: name,
    color: list.find((c) => c.color)?.color ?? "#8b8b8b",
    noAdscrit: false,
    alGovern: 0,
    persones: [...list]
      .sort((a, b) => (isMayor(b) ? 1 : 0) - (isMayor(a) ? 1 : 0) || (a.orderNum ?? 99) - (b.orderNum ?? 99))
      .map((c) => ({
        nom: nomLlegible(c.name),
        // El càrrec «Alcalde» del dia de la constitució no es pot escriure al
        // costat de l'alcaldia nova: davant d'un relleu es calla, i prou.
        carrec: esAlcaldia(c.role) && !isMayor(c) ? null : c.role,
        foto: null,
        slug: adreces.get(c) ?? slugify(c.name),
        alcaldia: isMayor(c),
        ambCarrec: isMayor(c),
        govern: false,
      })),
  }));

  return `${graellaDelPle(grups)}
  <details class="nota"><summary>La lletra petita</summary>Composició actual del ple segons el registre de càrrecs electes de la
  Generalitat. Cada cara porta a la fitxa de la persona; el nom i el càrrec hi són, i també en passar-hi
  per sobre. Hi surten el nom, el càrrec i el grup, que és el que deriva del càrrec públic;
  cap dada de contacte. Si hi ha un error o vols que retirem alguna cosa, escriu-nos.</details>`;
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
/**
 * Què publica el portal de transparència, i com de comú és publicar-ho.
 *
 * Cada línia acabava amb la mateixa frase escrita de nou —«el publiquen 835
 * dels 936 ajuntaments catalans»— quinze vegades seguides amb l'únic canvi de
 * dues xifres. Són quinze proporcions amb el mateix denominador, i quinze
 * proporcions amb el mateix denominador es miren, no es llegeixen: ara el
 * denominador es diu una vegada i cada apartat porta la seva barra. El que
 * interessa d'aquesta llista no és el número, és quins apartats són rars —allà
 * on aquest ajuntament fa una cosa que gairebé ningú no fa.
 */
/**
 * La cara i el partit d'una persona, allà on en surti el nom.
 *
 * Una llista de noms no diu res: «Daniel Sirera Bellés» i «David Escudé
 * Rodríguez» són dues cadenes de text fins que no se sap qui són i de qui són.
 * La composició del ple ja porta els dos retrats i les sigles de cadascú, i
 * aquí només es tornen a fer servir: el nom s'aparella amb el de la seu
 * electrònica —normalitzat, perquè les fonts no l'escriuen igual— i, si l'hi
 * troba, la persona surt amb la cara que publica el seu propi ajuntament i amb
 * la pastilla del seu grup.
 *
 * Si no hi ha fotografia, hi van les inicials amb el color del partit: mai un
 * buit i mai un dibuix genèric, que faria semblar que d'aquesta persona no en
 * sabem res quan el que passa és que l'ajuntament no en publica el retrat.
 */
function capPersona(
  nom: string,
  carrecs: readonly CarrecSeue[] | null,
  colorPer: (sigles: string | null) => string,
  peu = "",
): string {
  const clau = normalizePersonName(nom);
  const fitxa = carrecs?.find((c) => normalizePersonName(c.nom) === clau) ?? null;
  const sigles = fitxa?.grup ?? null;
  const { fons, tinta } = sobreColor(colorPer(sigles));
  const inicials = nom.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
  const cara = fitxa?.fotoPetita
    ? `<img class="retrat" src="${escape(fitxa.fotoPetita)}" alt="" loading="lazy" width="44" height="44">`
    : `<span class="retrat inicials sense-foto" style="--c:${fons};--t:${tinta}" aria-hidden="true">${escape(inicials)}</span>`;
  return `<span class="cap-persona">${cara}<span class="qui-es">
    <b>${escape(nom)}</b>
    <span class="sota">${
      // El nom del grup de la seu electrònica no són unes sigles: la marca es
      // dedueix del nom sencer o del parèntesi, i si no se sap, la pastilla
      // es queda sense enllaç.
      sigles ? sigla(sigles, { base: BASE, brandId: familiaDelNomDeGrup(sigles), color: colorPer(sigles) }) : ""
    }${
      peu ? `<span class="carrec">${escape(peu)}</span>` : ""
    }</span></span></span>`;
}

/**
 * @param resum El recompte de la mètrica —publicats, apartats, tant per cent—
 *   que és el mateix que fa servir la pastilla de l'ullada. Les dotze files de
 *   barres eren el bloc més alt de «Què en sabem», i el que interessa d'elles
 *   és el recompte; la llista sencera hi és, plegada, per a qui vulgui saber
 *   quins apartats són.
 */
function renderTransparencyDetail(items: readonly EstatItem[], resum: TransparencyMetric): string {
  const publicats = items.filter((i) => i.published && !i.notApplicable);
  if (publicats.length === 0) return "";
  const total = publicats.find((i) => i.catalunya)?.catalunya?.of ?? null;

  const fila = (item: EstatItem): string => {
    const cat = item.catalunya;
    const quan =
      item.updatedYear && !item.bulk
        ? `<span class="quan">actualitzat el ${item.updatedYear}</span>`
        : "";
    const part = cat && cat.of > 0 ? (100 * cat.published) / cat.of : null;
    return `<li class="hi-es">
      <span class="senyal" aria-hidden="true">✓</span>
      <span class="dades">
        <span class="nom">${escape(item.label)}</span>
        ${
          part === null || !cat
            ? ""
            : `<span class="quants-cat" title="el publiquen ${number(cat.published)} de ${number(cat.of)} ajuntaments catalans">
               <i style="--w:${part.toFixed(1)}%" aria-hidden="true"></i>
               <b>${Math.round(part)} %</b></span>`
        }
      </span>
      ${quan}
    </li>`;
  };

  return `<p>El seu portal de transparència publica <b>${number(resum.published)} dels ${number(resum.items)} apartats</b>
  que li tocarien${resum.pct === null ? "" : ` (${resum.pct} %)`}.</p>
  <details class="nota"><summary>${
    publicats.length === 1
      ? "L'apartat que hi consta publicat"
      : `Els ${number(publicats.length)} apartats que hi consten publicats, un per un`
  }</summary>
  <ul class="transparencia">${publicats.map(fila).join("")}</ul>
  La barra de cada apartat és quants${
    total === null ? " ajuntaments catalans" : ` dels ${number(total)} ajuntaments catalans`
  } el publiquen. <b>El que no surti en aquesta llista no vol dir
  que l'ajuntament no ho publiqui</b>: el conjunt del Consorci AOC no distingeix entre un
  apartat que no s'ha omplert i un que no hi consta, i no volem acusar ningú d'opac amb una
  dada que no ho diu.</details>`;
}

/**
 * La taula de les alcaldies des del 1979.
 *
 * @param adreces On porta cada nom, per nom normalitzat i relatiu a
 *   `m/<slug>/`: la fitxa d'alcaldia històrica (`alcaldia/<persona>/`) o, per a
 *   qui hi és avui, la seva fitxa de regidor. Les calcula
 *   `alcaldiesHistoriques()` sobre aquest mateix historial, que és el que
 *   escriu les pàgines: la taula no pot enllaçar una adreça que no existeixi.
 * @param retrats Les cares de Wikimedia Commons per nom normalitzat, quan J28
 *   n'ha baixat cap. Porten el crèdit obligatori plegat sota la taula.
 */
function renderMayors(
  mayorsMetric: MayorsMetric,
  adreces: ReadonlyMap<string, string> = new Map(),
  retrats: ReadonlyMap<string, Retrat> = new Map(),
): string {
  const history = [...mayorsMetric.history].sort((a, b) => b.term.localeCompare(a.term));
  const ambRetrat = new Map<string, Retrat>();
  const rows = history.map((m, i) => {
    const change = mayorsMetric.changes.find((c) => c.term === m.term);
    const late = change?.onlySuccessorKnown && change.mayors[0]?.name === m.name;
    // Un mandat amb dues files és un relleu a mig mandat, i és el que més
    // s'entén malament d'aquesta taula: sense marcar-ho sembla una dada
    // repetida. La cel·la del mandat, doncs, només s'escriu al primer.
    const repeteix = history[i - 1]?.term === m.term;
    // El color, de la sigla de la Generalitat o, si no n'hi ha, del nom sencer
    // que dona Wikidata: un pas de Wikidata sense punt de color semblaria
    // d'un partit desconegut quan és del PSC o del PP.
    const familia = familiaDelPartit(m.partyRaw) ?? familiaDelPartit(m.partitWikidata);
    const color = familia ? BRANDS_BY_ID.get(familia)?.color : undefined;
    const marca = color ? `<span class="punt-partit" style="--c:${color}" aria-hidden="true"></span>` : "";
    // El nom porta a la fitxa de la persona, i la cara —de Commons, quan n'hi
    // ha— hi va dins del mateix enllaç: és la mateixa `cara()` de la
    // capçalera, en petit, i amb les inicials del color de la força si no hi
    // ha retrat. Sense adreça el nom es queda com a text, que és el cas de
    // les proves i de cap dels 947.
    const clau = normalizePersonName(m.name);
    const adreca = adreces.get(clau) ?? null;
    const retrat = retrats.get(clau) ?? null;
    if (retrat && adreca) ambRetrat.set(clau, retrat);
    const qui = adreca
      ? `<a class="qui-alcaldia" href="${escape(adreca)}">${cara(nomLlegible(m.name), retrat?.cami ?? null, { mida: 28, color })}${escape(nomLlegible(m.name))}</a>`
      : escape(nomLlegible(m.name));
    // El que ve de Wikidata (J31) es diu amb aquestes paraules: el pas sencer
    // quan la Generalitat no el té, el motiu del final quan el sap, i el nom
    // sencer del partit quan la Generalitat el retalla, al costat i no a sobre.
    const motiu = motiuFinalEscrit(m.motiuFinal);
    // I el que ve del Ministeri (J35), també amb aquestes paraules: el pas
    // sencer quan cap altra font el té, i la data en què va deixar l'alcaldia
    // quan només ell la dona (sense motiu: el Ministeri no en diu cap).
    const marques = [
      late ? ' <span class="marca-canvi">va arribar a mig mandat</span>' : "",
      m.font === "wikidata" ? ' <span class="marca-canvi">segons Wikidata</span>' : "",
      m.font === "ministeri" ? ' <span class="marca-canvi">segons el Ministeri</span>' : "",
      m.interina ? ' <span class="marca-canvi">alcaldia interina</span>' : "",
      motiu ? ` <span class="marca-canvi" title="segons Wikidata">${escape(motiu)}</span>` : "",
      !motiu && m.finsA && m.fontFi === "ministeri"
        ? ` <span class="marca-canvi" title="segons el Ministeri">fins ${alDia(m.finsA)}</span>`
        : "",
    ].join("");
    // «N/A» al camp del partit és un buit amb disfressa: no s'escriu com si
    // fos un partit, i la fila passa a Wikidata, al Ministeri o al guionet.
    const siglesPas = siglesConegudes(m.partyRaw);
    const partit = siglesPas
      ? `${escape(siglesPas)}${m.partitWikidata ? ` <span class="secundari" title="nom complet segons Wikidata">(${escape(m.partitWikidata)})</span>` : ""}`
      : m.partitWikidata
        ? `${escape(m.partitWikidata)} <span class="secundari">segons Wikidata</span>`
        : m.llistaMinisteri
          ? `${escape(m.llistaMinisteri)} <span class="secundari">segons el Ministeri</span>`
          : "—";
    const desDe = m.tookOfficeOn
      ? `${formatDate(m.tookOfficeOn)}${m.fontInici === "ministeri" ? ' <span class="secundari" title="la Generalitat no en dona la data">segons el Ministeri</span>' : ""}`
      : "<span class=\"buit\" title=\"la font no en dona la data\">—</span>";
    return `<tr${repeteix ? ' class="mateix-mandat"' : ""}>
      <th scope="row">${escape(m.term)}</th>
      <td>${qui}${marques}</td>
      <td class="partit">${marca}${partit}</td>
      <td class="secundari">${desDe}</td>
    </tr>`;
  });
  const relleus = history.filter((m, i) => history[i - 1]?.term === m.term).length;
  const deWikidata = history.filter((m) => m.font === "wikidata" || m.motiuFinal || m.partitWikidata).length;
  const delMinisteri = history.filter((m) => m.font === "ministeri" || m.fontFi === "ministeri" || m.fontInici === "ministeri").length;
  // Tres mandats oberts i la resta plegada. Quinze files per arribar al 1979
  // són quinze files de les quals la gent en mira dues: qui mana i qui manava
  // abans. La resta hi és sencera —plegada, no esborrada, com la lletra
  // petita— darrere d'una línia que diu quantes n'hi ha.
  const OBERT_DES_DE = new Date().getFullYear() - ANYS_OBERTS;
  const anyDe = (term: string): number => Number(term.slice(0, 4)) || 0;
  const recents = rows.filter((_, i) => anyDe(history[i]!.term) >= OBERT_DES_DE);
  const velles = rows.filter((_, i) => anyDe(history[i]!.term) < OBERT_DES_DE);
  const capcalera = `<thead><tr><th>Mandat</th><th>Alcaldia</th><th>Partit</th><th>Des de</th></tr></thead>`;
  const taula =
    velles.length === 0
      ? `<table class="alcaldies">${capcalera}<tbody>${rows.join("")}</tbody></table>`
      : `<table class="alcaldies">${capcalera}<tbody>${recents.join("")}</tbody></table>
      <details class="mes-enrere"><summary>${velles.length} ${
        velles.length === 1 ? "alcaldia anterior" : "alcaldies anteriors"
      }, fins al ${history[history.length - 1]!.term.slice(0, 4)}</summary>
      <table class="alcaldies">${capcalera}<tbody>${velles.join("")}</tbody></table></details>`;
  return `${taula}${
    relleus > 0
      ? `<p class="nota oberta">Els mandats que surten ${
          relleus === 1 ? "dues vegades" : "més d'una vegada"
        } no són cap duplicat: hi va haver un relleu a l'alcaldia sense passar per les urnes.</p>`
      : ""
  }${
    deWikidata > 0
      ? `<p class="nota">El que va marcat «segons Wikidata» no és a l'historial de la Generalitat: són passos, motius de relleu
        o noms sencers de partit que Wikidata (dades CC0) sí que té, afegits sense treure res de la font oficial.</p>`
      : ""
  }${
    delMinisteri > 0
      ? `<p class="nota">El que va marcat «segons el Ministeri» —fins quan va durar una alcaldia, alguna data de possessió
        que a la Generalitat li falta, o un pas sencer— ve dels fulls «Alcaldes por mandato» del Sistema d'Informació Local
        del Ministeri de Política Territorial, que tampoc no diu mai per què algú plega.</p>`
      : ""
  }${creditsRetrats(ambRetrat.values())}`;
}

// ------------------------------------------------------------------- pàgina

export type RadiografiaData = {
  municipality: typeof municipalities.$inferSelect;
  results: ResultsMetric;
  government: GovernmentMetric | null;
  parity: ParityMetric | null;
  mayors: MayorsMetric | null;
  /**
   * Els retrats dels exalcaldes que J28 ha baixat de Wikimedia Commons, per a
   * la taula d'alcaldies i les fitxes de cadascú. Optatiu perquè és l'única
   * mètrica que la fitxa pot no tenir sense que li falti res.
   */
  fotosExalcaldes?: FitxaFotosExalcaldes | null;
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
  /** La renda de la gent (J23). Context també: l'ajuntament no la decideix. */
  riquesa: RiquesaMetric | null;
  /** Els fets penals coneguts del balanç del Ministeri de l'Interior (J29). */
  criminalitat: CriminalitatMetric | null;
  /** El preu de l'aigua del full de l'ACA (J19). */
  preuAigua: PreuAiguaMetric | null;
  /** El rebut mitjà d'IBI urbà de l'Idescat (J19). */
  rebutIbi: RebutIbiMetric | null;
  /** La despesa liquidada per programes, en euros per habitant (J15). */
  despesaProgrames: DespesaProgramesMetric | null;
  /** El que costa el govern, del capítol 1000 de la liquidació (J14). */
  costGovern: CostGovernMetric | null;
  /** Què publica aquest ajuntament del que cobren els seus electes (J14). */
  transparenciaRetribucions: TransparenciaRetribucionsMetric | null;
  /** Qui, a més de la regidoria, té un càrrec en un altre ens que el paga (J14). */
  carrecsAcumulats: CarrecsAcumulatsMetric | null;
  /** El que publica el Ministeri del que cobra l'alcaldia i les regidories (J22). */
  retribucions: RetribucionsMetric | null;
  /** Qui del ple seu també a una diputació, i què en publica (J24). */
  sousDiputacions: SousDiputacionsMetric | null;
  sousConsells: SousConsellsMetric | null;
  /** L'escut i la fotografia del poble, servits des de casa i amb crèdit (J26). */
  imatges: ImatgesMunicipi | null;
  /** El que s'ha adjudicat i amb quanta competència, de la PSCP (J10). */
  contractacio: ContractacioMetric | null;
  /** Quant fa que mana la mateixa força, i com es mou el ple (derive). */
  continuitat: ContinuitatMetric | null;
  /** Els vots que no van arribar a cap regidoria (derive). */
  votPerdut: VotPerdutMetric | null;
  /** Ordenances i reglaments aprovats aquest mandat (J10). */
  ordenances: OrdenancesMetric | null;
  /** El cartipàs del mandat: qui porta quina àrea (J10). */
  cartipas: CartipasMetric | null;
  /** Els ens dependents on viu la despesa que la liquidació no recull (J10). */
  organismes: OrganismesMetric | null;
  /**
   * Pertinença a l'Àrea Metropolitana de Barcelona.
   *
   * Per a 36 municipis, una part del que paguen i del que reben no ho decideix
   * el seu ajuntament ni el seu consell comarcal: el transport, l'aigua i el
   * tractament de residus són de l'AMB, i el seu Consell no el vota ningú en
   * una papereta. Dir-ho a la fitxa és tan important com dir qui hi governa.
   */
  amb: { member: boolean; municipis: number; materies: string[] } | null;
  /** Superfície, altitud, densitat i gentilici (J32, kind «territori»). */
  territori?: TerritoriMetric | null;
  /** Agermanaments i persones nascudes al municipi segons Wikidata (J33). */
  curiositatsWikidata?: FitxaCuriositatsWikidata | null;
  /** Parc de vehicles per mil habitants (J34, Idescat a partir de la DGT). */
  vehicles?: VehiclesMetric | null;
  /** Atur registrat (SEPE) i context socioeconòmic de l'Idescat (J44). Context, no balanç. */
  socioeconomia?: SocioeconomiaMetric | null;
  /** Reclamacions a la GAIP contra l'ajuntament i incompliments (J45). */
  gaip?: GaipMetric | null;
  /** Registre de Turisme viu: pisos turístics i altres establiments (J46). */
  establimentsTuristics?: EstablimentsTuristicsMetric | null;
  /** El vot per persona a les llistes obertes, només als municipis que n'han tingut (J37). */
  llistesObertes?: LlistesObertesMetric | null;
  /** El cens i la participació de les dotze municipals des del 1979 (J36). */
  censElectoral?: CensElectoralMetric | null;
  /** Com vota el municipi al Parlament, al Congrés i al Parlament Europeu (J43). */
  altresEleccions?: AltresEleccionsMetric | null;
  /** Per quants vots es va decidir cada regidoria: marges de d'Hondt (derive/marges.ts). */
  marges?: MargesMetric | null;
  /** El pla urbanístic, els pisos turístics, l'habitatge protegit i la zona tensa (J40). */
  urbanismeHabitatge?: UrbanismeHabitatgeMetric | null;
  /** El Fons de Cooperació Local, les obres del PUOSC, els pendents i les trameses de comptes (J41). */
  dinersGeneralitat?: DinersGeneralitat | null;
  /**
   * Les persones ateses pels serveis socials bàsics (J42, kind
   * `serveisSocialsBasics`). Només la tenen els 67 municipis que són àrea
   * bàsica de serveis socials pròpia —els de més de 20.000 habitants—; als
   * altres, els serveis socials els presta el consell comarcal i la xifra viu a
   * la seva fitxa, no aquí.
   */
  serveisSocials?: ServeisSocialsDesats | null;
  /**
   * L'element de Wikidata del municipi i el seu article de la Viquipèdia (J20,
   * kind `wikidata`), aparellats pel codi INE i mai pel nom. Només van al
   * `sameAs` del JSON-LD del municipi: la fitxa no n'ensenya res més.
   */
  wikidata?: { qid: string; url: string; viquipedia: string | null } | null;
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
  // I la pastilla porta a la pàgina del partit, com a la resta del web: el
  // color el decideix `sigla()` amb la mateixa regla, i el de la candidatura
  // només hi entra quan la marca no es coneix.
  const pastilla = (sigles: string | null): string => {
    const text = sigles ?? "?";
    if (!colorPer) return `<b>${escape(text)}</b>`;
    return sigla(text, { base: BASE, color: colorPer(sigles) });
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
 *
 * La cara la dibuixa `cara()` de `cara.ts`, que va néixer aquí i ara la
 * comparteixen la portada, les comarques i els partits: la mateixa persona ha
 * de tenir la mateixa cara a totes les pàgines. I el retrat és **el mateix que
 * ensenya la fitxa de la persona**: `resolAlcaldia()` el treu de la mateixa
 * entrada de la seu electrònica —el gran, i si no hi és, el petit— amb què
 * `publish.ts` escriu la pàgina de «regidor/<persona>/». Si la fitxa de la
 * persona té cara, la portada del municipi la té; si aquí surten inicials és
 * que l'ajuntament no en publica cap, i llavors tampoc no en té la persona.
 *
 * @param adreca On porta el nom: la fitxa de la persona («regidor/<slug>/»)
 *   quan en té, i si no, la taula d'alcaldies d'aquesta mateixa pàgina. El nom
 *   de qui mana no és mai text mort.
 */
/**
 * El relleu a mig mandat, si n'hi ha hagut: des de quan hi és qui hi és i,
 * quan la font ho diu, qui hi havia abans. Per al mandat en curs l'historial
 * de la Generalitat només desa l'alcaldia vigent, així que sovint se sap la
 * data d'arribada però no el nom anterior; llavors es diu el que se sap i
 * prou, i la taula d'alcaldies ho explica.
 */
type RelleuAlcaldia = { desDe: string | null; anteriors: string[] };

function relleuDelMandat(mayorsMetric: MayorsMetric | null | undefined, nomActual: string): RelleuAlcaldia | null {
  const change = mayorsMetric?.currentTermChange ?? null;
  if (!change) return null;
  const actual = normalizePersonName(nomActual);
  const delMandat = mayorsMetric!.history.filter((h) => h.term === change.term);
  const jo = [...delMandat, ...change.mayors].find((h) => normalizePersonName(h.name) === actual) ?? null;
  const anteriors = [...new Map(
    [...delMandat, ...change.mayors]
      .filter((h) => normalizePersonName(h.name) !== actual)
      .map((h) => [normalizePersonName(h.name), nomLlegible(h.name)] as const),
  ).values()];
  return { desDe: jo?.tookOfficeOn ?? null, anteriors };
}

function renderAlcaldia(
  nom: string,
  carrec: string,
  sigles: string | null,
  color: string,
  foto: string | null,
  adreca: string | null,
  relleu: RelleuAlcaldia | null = null,
): string {
  const etiqueta = `${escape(carrec)}${sigles ? ` · ${sigla(sigles, { base: BASE, color })}` : ""}`;
  const desDe = relleu?.desDe ? `des ${delDia(relleu.desDe)}` : "va arribar a mig mandat";
  const abans = relleu && relleu.anteriors.length > 0
    ? ` · abans, ${relleu.anteriors.map(escape).join(" i ")}`
    : "";
  const liniaRelleu = relleu
    ? `<span class="relleu-alcaldia"><a href="#alcaldies">${desDe}${abans}</a></span>`
    : "";
  return `<p class="alcaldia">${cara(nom, foto, { color })}<span class="qui-mana">
    <span class="nom-alcaldia"><a href="${escape(adreca ?? "#alcaldies")}">${escape(nom)}</a></span>
    <span class="carrec-alcaldia">${etiqueta}</span>${liniaRelleu}</span></p>`;
}

// ----------------------------------------------------- qui hi viu i què paga

/** Un decimal amb la coma catalana. `number()` ja fa els milers. */
const decimal = (n: number, d: number): string => n.toFixed(d).replace(".", ",");
/**
 * Una posició dins d'una llista, escrita com es diu: «el 1r», «el 4t»,
 * «el 214è». L'article hi va inclòs perquè l'onzè el demana apostrofat
 * —«l'11è»— i qui escriu la frase no ha de saber-ho.
 */
function elOrdinal(n: number): string {
  const ordinal = n === 1 ? "1r" : n === 2 ? "2n" : n === 3 ? "3r" : n === 4 ? "4t" : `${number(n)}è`;
  return `${n === 11 ? "l'" : "el "}${ordinal}`;
}

/** El signe d'una variació, amb el menys tipogràfic. */
const signeDe = (n: number): string => (n > 0 ? "+" : n < 0 ? "−" : "");

/**
 * Els rànquings dels 947 que existeixen, tal com els anomena `ranquings.ts`
 * (`METRIQUES[].id`): són les àncores de `../../ranquings/#<id>`. Es declaren
 * aquí com a tipus perquè el compilador no deixi enllaçar un rànquing que no
 * hi és —la despesa o el deute per habitant no en tenen— i un canvi de nom
 * allà peti aquí i no a la pàgina publicada.
 */
type RanquingId = "poblacio" | "participacio" | "renda" | "selectiva" | "aigua" | "ibi" | "alternances";

/**
 * «entre els 947»: l'enllaç petit d'una xifra cap al rànquing on surt la
 * mateixa xifra de tots els municipis. Va al costat de la comparació amb els
 * de la seva mida, no en lloc seu: la comparació de grup diu si és normal, i
 * el rànquing diu on cau entre tots.
 */
const entreEls947 = (id: RanquingId): string =>
  `<a class="entre-947" href="${BASE}ranquings/#${id}">entre els 947</a>`;

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

/**
 * Com s'escriu una variació segons la unitat: «+14», «+1,2 punts», «+0,3 anys».
 *
 * Un recompte de persones va sencer i sense decimals; qualsevol altra unitat
 * en porta un i s'escriu al costat de la xifra. Un «+14» pelat al costat d'un
 * «+8,1» no diu de què parla, i aquí de vegades són euros i de vegades punts.
 * La fan servir la línia del canvi de cada tira i la taula de les edats, que
 * han d'escriure el mateix canvi de la mateixa manera.
 */
const escriuVariacio = (unitat: string) => (n: number): string => {
  const sufix = unitat === "%" ? " punts" : unitat === "persones" ? "" : ` ${unitat}`;
  return unitat === "persones"
    ? `${signeDe(n)}${number(Math.round(Math.abs(n)))}`
    : `${signeDe(n)}${decimal(Math.abs(n), 1)}${sufix}`;
};

/** El canvi del mandat amb el mateix canvi als seus al costat, mai sol. */
function canviAmbGrup(mandat: Variacio, grup: MandatGrup | null | undefined, unitat: string): string {
  const escriu = escriuVariacio(unitat);
  const seus =
    grup && grup.diferencia !== null
      ? ` · als ${grup.municipis} de la seva mida, ${escriu(grup.diferencia)}`
      : " · sense comparació de grup";
  return `<span class="sub canvi">Del ${mandat.desDe} al ${mandat.fins}: <b>${escriu(mandat.diferencia)}</b>${escape(seus)}</span>`;
}

/** Una xifra de població, amb què compta i d'on surt. */
/**
 * La forma d'una sèrie, al costat de la xifra.
 *
 * Les xifres d'aquest bloc arribaven soles: «21,0 % de 65 anys o més» i el
 * canvi del mandat escrit al costat. Però la dada porta la sèrie sencera —cinc
 * o set anys— i d'una xifra i una variació no se'n dedueix la forma: no és el
 * mateix pujar de cop l'últim any que pujar a poc a poc des del primer, i amb
 * dos números això no es pot distingir. La línia ho ensenya sense demanar cap
 * esforç i sense afegir cap número més a la pantalla, que ja en va plena.
 *
 * No hi va cap eix ni cap escala: l'escala és la de la pròpia sèrie —del mínim
 * al màxim— i per tant la línia diu **com** s'ha mogut, no quant. El quant és la
 * xifra gran que té al costat, i barrejar-ho faria llegir pendents que no hi
 * són. Per això tampoc no comparteix escala amb la línia del costat.
 */
//
// Sota la línia hi van el primer any i l'últim, i al costat de l'últim, la
// xifra a què arriba: una línia sense cap valor escrit no es pot llegir sense
// buscar la xifra gran, i a les fitxes amb tres espurnes seguides no sempre és
// al costat.
function sparkline(
  serie: readonly { any: number; valor: number | null }[],
  format: (valor: number) => string,
  /**
   * La xifra final en curt, per a l'etiqueta de sota la línia («2025: 12,3 €»).
   * Si no es diu, la mateixa de `format`; només cal quan aquella porta una
   * cua que no hi cap («12,3 € per habitant»).
   */
  curt: (valor: number) => string = format,
): string {
  const punts = serie.filter((p): p is { any: number; valor: number } => p.valor !== null);
  // Amb menys de tres punts no hi ha cap forma per ensenyar: hi hauria una
  // ratlla recta que semblaria una tendència i no ho seria.
  if (punts.length < 3) return "";
  const valors = punts.map((p) => p.valor);
  const min = Math.min(...valors);
  const max = Math.max(...valors);
  const W = 118;
  const H = 34;
  const marge = 3;
  const x = (i: number): number => (i * W) / (punts.length - 1);
  // Una sèrie plana es dibuixa al mig i no arran de terra: a terra sembla un
  // zero, i al mig es veu que no s'ha mogut.
  const y = (v: number): number =>
    max === min ? H / 2 : H - marge - ((v - min) / (max - min)) * (H - 2 * marge);
  const d = punts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p.valor).toFixed(1)}`).join(" ");
  const ultim = punts[punts.length - 1]!;
  const primer = punts[0]!;
  return `<span class="espurna">
    <span class="linia">
    <svg viewBox="-2 -2 ${W + 4} ${H + 4}" role="img" preserveAspectRatio="none"
         aria-label="${punts.map((p) => `${p.any}, ${format(p.valor)}`).join("; ")}.">
      <path d="${d}" fill="none" stroke="currentColor" stroke-width="2.2"
            stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    </svg>
    <!-- El punt d'ara no es dibuixa dins de l'SVG: el dibuix s'estira en
         amplada i no en alçada, i un cercle hi sortiria ovalat. Com que sempre
         és l'últim punt, i per tant sempre a la vora dreta, només cal saber a
         quina alçada va. -->
    <b class="ara" style="--y:${(((y(ultim.valor) + 2) / (H + 4)) * 100).toFixed(1)}%" aria-hidden="true"></b>
    </span>
    <i aria-hidden="true"><b>${primer.any}</b><b>${ultim.any}: ${escape(curt(ultim.valor))}</b></i>
  </span>`;
}

/** Com s'escriu una xifra de població segons la seva unitat. */
const valorPoblacio = (ind: IndicadorPoblacio) => (valor: number): string =>
  ind.unitat === "%" ? percent(valor) : ind.unitat === "anys" ? `${decimal(valor, 1)} anys` : number(valor);

/**
 * Una tira: la pastilla petita que la fitxa fa servir a tot arreu on cal una
 * xifra amb la seva etiqueta i el seu peu.
 *
 * És la mateixa forma que les de l'ullada —etiqueta en versaletes, xifra
 * gran, peu petit— i per això es llegeix igual a la banda del 23-M, a «Quant
 * fa que mana el mateix» i a «Qui hi viu»: qui ha entès la primera ja ha entès
 * totes. Les targetes de «.gent» i «.preus» eren cadascuna d'una mida i amb
 * quatre línies de text a dins; aquesta en té tres i prou, i el que no hi cap
 * va a la lletra petita del bloc.
 *
 * `xifra` i `peu` s'escriuen tal com arriben —hi van pastilles de sigles i
 * enllaços— i qui els construeix hi escapa el que calgui; `etq` s'escapa aquí.
 * `enllac` fa de tota la tira un enllaç, com a l'ullada; `font` és la línia
 * del peu de tot, que a les xifres de l'Idescat és l'enllaç que la llicència
 * obliga a ensenyar.
 */
function tira(t: {
  etq: string;
  xifra: string;
  peu?: string;
  espurna?: string;
  enllac?: string;
  font?: string;
  classe?: string;
}): string {
  const dins = `<span class="etq">${escape(t.etq)}</span>
      <span class="xifra">${t.xifra}</span>
      ${t.espurna ?? ""}
      ${t.peu ? `<span class="peu">${t.peu}</span>` : ""}
      ${t.font ?? ""}`;
  const classe = ["tira", t.classe].filter(Boolean).join(" ");
  return t.enllac
    ? `<li class="${classe}"><a href="${escape(t.enllac)}">${dins}</a></li>`
    : `<li class="${classe}">${dins}</li>`;
}

/** Un indicador amb xifra i any: l'únic que es pot escriure a la pàgina. */
const ambValor = (ind: IndicadorPoblacio | null): ind is IndicadorPoblacio & { valor: number; darrerAny: number } =>
  ind !== null && ind.valor !== null && ind.darrerAny !== null;

/**
 * Les edats, en una taula i no en tres tessel·les.
 *
 * El pes dels menors de 16, el dels majors de 64 i l'edat mitjana eren tres
 * tessel·les més a la graella de «Qui hi viu», que amb la renda en feia sis
 * i, a escriptori, les posava totes en una fila de 160 px cadascuna: la
 * xifra, l'espurna, el peu, el canvi del mandat i l'enllaç esclafats a dins.
 * Les tres són la mateixa pregunta —quines edats hi ha— i es comparen amb les
 * mateixes tres coses: Catalunya, el mandat, els de la seva mida. Això és una
 * taula: una fila per tram i una columna per comparació, i es llegeix d'una
 * mirada el que abans demanava tres targetes.
 *
 * No es perd res del que deien les tessel·les: la xifra d'ara és la columna
 * «aquí», l'espurna va a la seva columna amb els mateixos punts, el «a tot
 * Catalunya» del peu és una columna, el canvi del mandat i el dels seus són
 * dues més, i el «què compta» de cadascuna i l'enllaç de l'Idescat —que la
 * llicència obliga— van sota la taula i a la lletra petita del bloc.
 */
function taulaEdats(indicadors: readonly (IndicadorPoblacio | null)[]): string {
  const files = indicadors.filter(ambValor);
  if (files.length === 0) return "";

  // L'any de la taula és el de la primera fila; si una fila és d'un altre any,
  // ho diu a la seva cel·la, que un 2024 al costat d'un 2025 no es pot callar.
  const any = files[0]!.darrerAny;
  const mandat = files.find((f) => f.mandat)?.mandat ?? null;
  const grup = files.find((f) => f.mandatDelGrup)?.mandatDelGrup ?? null;
  const ambCatalunya = files.some((f) => f.catalunya?.valor != null);
  const espurnes = files.map((f) => sparkline(f.serie, valorPoblacio(f)));
  const ambSerie = espurnes.some((e) => e !== "");
  const primerAny = Math.min(
    ...files.flatMap((f) => f.serie.filter((p) => p.valor !== null).map((p) => p.any)),
  );

  // «Pes de la població de 0 a 15 anys» és el nom que li dona J18 i el títol
  // de la taula ja diu que són pesos: a la fila hi queda «De 0 a 15 anys».
  const nomDeFila = (f: IndicadorPoblacio): string => {
    const curt = f.etiqueta.replace(/^Pes de la població /, "");
    return curt.charAt(0).toUpperCase() + curt.slice(1);
  };

  const capcalera = [
    `<th scope="col">Edat</th>`,
    `<th scope="col">Aquí</th>`,
    ambSerie && Number.isFinite(primerAny) ? `<th scope="col">Des del ${primerAny}</th>` : "",
    ambCatalunya ? `<th scope="col">A tot Catalunya</th>` : "",
    mandat ? `<th scope="col">Del ${mandat.desDe} al ${mandat.fins}</th>` : "",
    grup ? `<th scope="col">Als ${grup.municipis} de la seva mida</th>` : "",
  ]
    .filter((c) => c !== "")
    .join("");

  const fila = (f: IndicadorPoblacio & { valor: number; darrerAny: number }, i: number): string => {
    const escriu = escriuVariacio(f.unitat);
    const propi = f.mandat
      ? `${escriu(f.mandat.diferencia)}${
          mandat && (f.mandat.desDe !== mandat.desDe || f.mandat.fins !== mandat.fins)
            ? ` <span class="secundari">(del ${f.mandat.desDe} al ${f.mandat.fins})</span>`
            : ""
        }`
      : "sense dada";
    const seus = f.mandatDelGrup && f.mandatDelGrup.diferencia !== null ? escriu(f.mandatDelGrup.diferencia) : "sense dada";
    return `<tr><th scope="row">${escape(nomDeFila(f))}</th>
      <td class="aqui">${valorPoblacio(f)(f.valor)}${f.darrerAny === any ? "" : ` <span class="secundari">(${f.darrerAny})</span>`}</td>
      ${ambSerie ? `<td class="serie-edat">${espurnes[i] === "" ? "sense sèrie" : espurnes[i]}</td>` : ""}
      ${ambCatalunya ? `<td>${f.catalunya?.valor != null ? valorPoblacio(f)(f.catalunya.valor) : "sense dada"}</td>` : ""}
      ${mandat ? `<td>${propi}</td>` : ""}
      ${grup ? `<td>${seus}</td>` : ""}</tr>`;
  };

  // Un enllaç per taula de l'Idescat, no un per fila: les tres files surten de
  // la mateixa taula i repetir-lo tres cops no reconeix res que un cop no
  // reconegui. La llicència demana l'enllaç, i hi és.
  const enllacos = new Map<string, EnllacIdescat>();
  for (const f of files) if (f.enllac) enllacos.set(f.enllac.href, f.enllac);
  const fonts = [...enllacos.values()].map((e) => enllacIdescat(e)).join(" · ");

  return `<div class="taula-envolta"><table class="edats">
    <caption>Les edats, el ${any}: el pes de cada tram sobre la població censada</caption>
    <thead><tr>${capcalera}</tr></thead>
    <tbody>${files.map(fila).join("")}</tbody></table></div>
    ${fonts === "" ? "" : `<p class="nota-linia fonts-edats">${fonts}</p>`}`;
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
 * no es publica. Cada tira porta el seu.
 *
 * Era el bloc més llarg de la fitxa: cinc paràgrafs, dos avisos, vuit targetes
 * i una línia del padró amb l'eix des de zero que sortia plana. Després van
 * ser cinc tires (sis amb la renda) en una graella que s'omplia sola, i a
 * escriptori sortien totes en una fila de 160 px: un tauler, no tres xifres.
 * Ara són **tres tessel·les** —quants hi viuen, d'on venen, quant guanyen—,
 * **una taula amb les edats** (els tres trams que eren tres tessel·les més,
 * amb les mateixes comparacions en columnes), una línia amb els tres recomptes
 * que no es poden comparar amb res, i una sola lletra petita amb tot el que
 * explica com es compta: el padró contra el cens, els anys que no demanem, el
 * «què compta» de cada edat, i la segona xifra de l'origen amb la diferència
 * i la taula creuada. Res no s'ha esborrat; s'ha plegat o s'ha posat en fila.
 */
export function renderQuiHiViu(poblacio: PoblacioMetric, riquesa: RiquesaMetric | null = null): string {
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
  const teValor = (ind: IndicadorPoblacio | null): ind is IndicadorPoblacio & { valor: number; darrerAny: number } =>
    ind !== null && ind.valor !== null && ind.darrerAny !== null;

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

  // ---- les tires -----------------------------------------------------------
  // La xifra de Catalunya només hi va quan es pot comparar de veritat: un
  // percentatge o una edat mitjana. El recompte d'infants de tot Catalunya al
  // costat del d'un poble no compara res, només fa soroll.
  const catalunyaDe = (ind: IndicadorPoblacio): string =>
    (ind.unitat === "%" || ind.unitat === "anys") && ind.catalunya?.valor != null
      ? `a tot Catalunya, ${valorPoblacio(ind)(ind.catalunya.valor)}`
      : "";
  const peuDe = (ind: IndicadorPoblacio, davant = ""): string =>
    [davant, catalunyaDe(ind)].filter((t) => t !== "").join(" · ");
  const tiraIndicador = (ind: IndicadorPoblacio | null, etq?: string): string => {
    if (!teValor(ind)) return "";
    return tira({
      etq: etq ?? ind.etiqueta,
      xifra: valorPoblacio(ind)(ind.valor),
      espurna: sparkline(ind.serie, valorPoblacio(ind)),
      peu: peuDe(ind, `el ${ind.darrerAny}`),
      font: `${ind.mandat ? canviAmbGrup(ind.mandat, ind.mandatDelGrup, ind.unitat) : ""}
        <details class="compta"><summary>Què compta exactament</summary>${escape(ind.compta)}</details>
        ${enllacIdescat(ind.enllac)}`,
    });
  };

  // Els empadronats, amb la sèrie llarga. El padró és l'única sèrie d'aquest
  // bloc que va més enrere del 2021, i per això l'espurna és la seva; la xifra
  // gran és la del padró i no la del cens, perquè un dibuix del padró amb el
  // punt d'ara al cens diria una cosa que no és.
  const habitants = teValor(padro)
    ? tira({
        etq: "Empadronats",
        xifra: number(padro.valor),
        espurna: sparkline(padro.serie, number),
        peu: `el ${padro.darrerAny}${pc ? ` · el cens en compta ${number(pc.cens)}` : ""}`,
        font: `${padro.mandat ? canviAmbGrup(padro.mandat, padro.mandatDelGrup, "persones") : ""}
          <details class="compta"><summary>Què compta exactament</summary>${escape(padro.compta)}</details>
          ${enllacIdescat(padro.enllac ?? cens.enllac)}`,
      })
    : tiraIndicador(cens, "Població censada");

  // L'origen: el percentatge com a xifra gran, el recompte al peu, i el text
  // de què compta a la vista —és l'única cosa que impedeix llegir «nacionalitat
  // estrangera» com «nascuts fora», i per això no es plega.
  const origen =
    teValor(nacionalitat)
      ? teValor(pctNacionalitat)
        ? tira({
            etq: pctNacionalitat.etiqueta,
            xifra: percent(pctNacionalitat.valor),
            espurna: sparkline(pctNacionalitat.serie, (v) => percent(v)),
            peu: peuDe(pctNacionalitat, `${number(nacionalitat.valor)} persones`),
            // El «què compta» de J18 és llarg i ja viu, literal, a la lletra
            // petita del bloc: aquí només hi va el canvi i la font, que la
            // tessel·la ha de fer de tessel·la i no de nota metodològica.
            font: `${pctNacionalitat.mandat ? canviAmbGrup(pctNacionalitat.mandat, pctNacionalitat.mandatDelGrup, "%") : ""}
              ${enllacIdescat(pctNacionalitat.enllac ?? nacionalitat.enllac)}`,
          })
        : tira({
            etq: nacionalitat.etiqueta,
            xifra: number(nacionalitat.valor),
            espurna: sparkline(nacionalitat.serie, number),
            peu: "de la població censada",
            font: `<span class="compta">${escape(nacionalitat.compta)}</span>${enllacIdescat(nacionalitat.enllac)}`,
          })
      : "";

  // Primer els pesos i després els recomptes, i no al revés: el pes es pot
  // comparar amb Catalunya i amb el mateix poble de fa quatre anys, i el
  // recompte no. «pct0a15» és l'única xifra del bloc que diu quants nens hi
  // ha en proporció, que és el que decideix si calen escoles.
  // La renda, amb el lloc que ocupa el poble dit en paraules: «el 214è de 927
  // municipis amb dada» es llegeix; un percentil, no. El rang el calcula J23
  // sobre tota la distribució —aquí no es podria— i els que falten fins als
  // 947 no són municipis sense renda: l'INE els tapa per secret estadístic.
  const renda = riquesa?.indicadors.find((i) => i.clau === "rendaNetaPersona") ?? null;
  const tiraRenda =
    renda && renda.valor !== null && renda.any !== null
      ? tira({
          etq: "Renda neta per persona",
          xifra: `${number(Math.round(renda.valor))} €`,
          espurna: sparkline(renda.serie, (v) => `${number(Math.round(v))} €`),
          // El lloc que ocupa ja es diu en paraules; l'enllaç porta a la
          // llista sencera on es pot veure qui hi ha davant i darrere.
          peu: `${
            renda.catalunya
              ? `${elOrdinal(renda.catalunya.rang)} de ${number(renda.catalunya.de)} municipis amb dada · `
              : ""
          }INE, ${renda.any} · ${entreEls947("renda")}`,
          font: `<span class="compta">${escape(riquesa!.context.nota)}</span>`,
        })
      : "";

  // Tres tessel·les i prou —quants, d'on, quant guanyen— i les edats a la
  // taula de sota. Eren sis en una fila i no es llegien: vegeu `taulaEdats`.
  const tires = [habitants, origen, tiraRenda].filter((t) => t !== "").join("");
  const edats = taulaEdats([
    indicadorDe(poblacio, "pct0a15"),
    indicadorDe(poblacio, "pct65iMes"),
    indicadorDe(poblacio, "edatMitjana"),
  ]);

  // Els tres recomptes que no es poden comparar amb res —ni amb Catalunya ni
  // amb el poble del costat— en una línia, cadascun amb el seu enllaç.
  const infants = indicadorDe(poblacio, "infants0a2");
  const grans = indicadorDe(poblacio, "de85iMes");
  const cera = indicadorDe(poblacio, "residentsAEstranger");
  const tambe = [
    teValor(infants) ? `<b>${number(infants.valor)}</b> infants de 0 a 2 anys ${enllacIdescat(infants.enllac)}` : "",
    teValor(grans) ? `<b>${number(grans.valor)}</b> persones de 85 anys o més ${enllacIdescat(grans.enllac)}` : "",
    teValor(cera) ? `<b>${number(cera.valor)}</b> hi consten al padró però viuen a l'estranger ${enllacIdescat(cera.enllac)}` : "",
  ].filter((t) => t !== "");
  const liniaTambe = tambe.length === 0 ? "" : `<p class="nota-linia tambe">També: ${tambe.join(" · ")}.</p>`;

  // ---- la lletra petita, una de sola ---------------------------------------
  const notes: string[] = [];

  if (teValor(padro) && pc) {
    notes.push(`<p><b>Al padró n'hi ha ${number(pc.padro)}</b> i al cens ${number(pc.cens)}: ${
      pc.persones === 0
        ? "exactament els mateixos"
        : `${number(Math.abs(pc.persones))} ${Math.abs(pc.persones) === 1 ? "persona" : "persones"} ${pc.persones > 0 ? "més" : "menys"} al padró${
            pc.percentual === null ? "" : ` (${signeDe(pc.percentual)}${decimal(Math.abs(pc.percentual), 1)} %)`
          }`
    }. ${escape(pc.nota)}${
      pc.divergeix
        ? " <b>Aquí la diferència és prou gran per tenir-la en compte:</b> segons quina de les dues xifres es faci servir, el poble té una mida diferent."
        : ""
    } ${escape(padro.compta)}</p>`);
  }

  // El «què compta» de la nacionalitat anava al peu de la seva tessel·la i la
  // feia de tres pams. El text és de la metodologia i ha de ser a la pàgina,
  // literal —és l'única cosa que impedeix llegir «nacionalitat estrangera» i
  // «nascuts a l'estranger» com si diguessin el mateix—, però hi és aquí, a la
  // lletra petita, un cop i sencer.
  if (nacionalitat && nacionalitat.compta && teValor(pctNacionalitat ?? nacionalitat)) {
    notes.push(`<p>${escape(nacionalitat.compta)}</p>`);
  }

  // Les xifres de percentatge d'aquest bloc surten totes del cens de població,
  // que l'Idescat publica any a any i que **no existeix abans del 2021**: per
  // molt que es demani, no hi ha percentatge d'estrangers del 2015 ni piràmide
  // d'edats del 2018 amb aquesta definició. El padró sí que va més enrere —el
  // publica des del 1998—, i per això la sèrie que s'allarga és aquesta i no
  // cap altra. Dir-ho a la pàgina és part de la dada: sense això, que una línia
  // arrenqui el 2021 i l'altra el 2015 sembla una tria nostra.
  const puntsPadro = (padro?.serie ?? [])
    .filter((p): p is { any: number; valor: number } => p.valor !== null)
    .sort((a, b) => a.any - b.any);
  // Els anys que no hi ha entre el primer i l'últim: aquests anys la font sí
  // que els publica i som nosaltres qui no els demanem, i dir-ne «l'any que la
  // font no publica» seria carregar a l'Idescat una decisió nostra.
  const buitsPadro: number[] = [];
  for (let i = 1; i < puntsPadro.length; i += 1) {
    for (let any = puntsPadro[i - 1]!.any + 1; any < puntsPadro[i]!.any; any += 1) buitsPadro.push(any);
  }
  if (buitsPadro.length > 0) {
    notes.push(`<p>A l'espurna del padró, del ${
      buitsPadro.length === 1
        ? buitsPadro[0]
        : `${buitsPadro.slice(0, -1).join(", ")} i ${buitsPadro[buitsPadro.length - 1]}`
    } no hi ha punt perquè no en demanem la xifra, no perquè la font no la tingui: l'Idescat
    publica el padró des del 1998. La línia hi va recta, i això no vol dir que aquells anys
    no s'hi mogués ningú.</p>`);
  }
  const primerCens = cens.serie.find((p) => p.valor !== null)?.any ?? null;
  if (primerCens !== null && puntsPadro.length > 1) {
    notes.push(`<p>Els percentatges d'aquest bloc —d'on ve la gent i quines edats hi ha— no poden anar tan
    enrere: surten del cens de població, que l'Idescat publica any a any des del ${primerCens} i que
    abans no existeix amb aquesta definició. El padró sí que hi va, i és l'única sèrie d'aquest bloc que s'ha pogut allargar.</p>`);
  }

  // Les dues xifres que la gent confon, una al costat de l'altra, cadascuna amb
  // què compta. Cap de les dues no és «immigrants» i no en surt cap tercera.
  if (teValor(nacionalitat) && teValor(nascuts)) {
    const pctN = teValor(pctNacionalitat) ? ` (${percent(pctNacionalitat.valor)})` : "";
    const pctB = teValor(pctNascuts) ? ` (${percent(pctNascuts.valor)}${
      pctNascuts.catalunya?.valor != null ? `; a tot Catalunya, ${percent(pctNascuts.catalunya.valor)}` : ""
    })` : "";
    notes.push(`<p><b>D'on ve la gent: dues xifres que no compten el mateix.</b> El ${nascuts.darrerAny},
    <b>${number(nacionalitat.valor)} persones</b>${pctN} tenen nacionalitat estrangera i
    <b>${number(nascuts.valor)} persones</b>${pctB} han nascut a l'estranger.
    ${escape(nascuts.compta)} ${enllacIdescat(pctNascuts?.enllac ?? nascuts.enllac)}</p>`);
    if (div) {
      notes.push(`<p><b>Entre les dues xifres hi ha ${number(div.persones)}
      ${div.persones === 1 ? "persona" : "persones"} de diferència</b>${
        div.mesGran === "iguals" ? "" : `, i la més alta és la del ${escape(div.mesGran)}`
      }. ${escape(div.nota)}</p>`);
    }
    const creu = poblacio.creuament;
    if (creu && (creu.nascutsForaAmbNacionalitatEspanyola !== null || creu.estrangersNascutsAEspanya !== null)) {
      notes.push(`<p>Per què es diferencien, segons la taula creuada del ${creu.any}:
      ${
        creu.nascutsForaAmbNacionalitatEspanyola !== null
          ? `<b>${number(creu.nascutsForaAmbNacionalitatEspanyola)} persones nascudes fora d'Espanya tenen nacionalitat espanyola</b>`
          : ""
      }${creu.nascutsForaAmbNacionalitatEspanyola !== null && creu.estrangersNascutsAEspanya !== null ? " i " : ""}${
        creu.estrangersNascutsAEspanya !== null
          ? `<b>${number(creu.estrangersNascutsAEspanya)} persones estrangeres han nascut a Espanya</b>`
          : ""
      }. ${escape(creu.nota)}</p>`);
    }
  }

  // El «què compta» de cada fila de les edats. A les tessel·les anava plegat
  // en un «Què compta exactament» per tessel·la; a la taula no hi cap, i aquí
  // hi va sencer i literal, que és com J18 el va escriure.
  const comptesEdats = [
    indicadorDe(poblacio, "pct0a15"),
    indicadorDe(poblacio, "pct65iMes"),
    indicadorDe(poblacio, "edatMitjana"),
  ]
    .filter(ambValor)
    .map((f) => escape(f.compta));
  if (comptesEdats.length > 0) {
    notes.push(`<p><b>Les edats, què compta cada fila:</b> ${comptesEdats.join(" ")}</p>`);
  }

  if (renda && renda.valor !== null && riquesa) {
    if (riquesa.context.sensePostEleccions) {
      notes.push(`<p><b>De la renda:</b> ${escape(riquesa.context.sensePostEleccions)}</p>`);
    }
    notes.push(`<p>La renda surt de l'${escape(riquesa.font.ine.organisme)} (${escape(riquesa.font.ine.conjunt)}),
    extret el ${escape(riquesa.font.ine.extret)}. ${escape(riquesa.cobertura.nota)}${
      renda.catalunya ? ` ${escape(renda.catalunya.nota)}` : ""
    }</p>`);
  }

  // La llicència de l'Idescat obliga a dues coses i totes dues es compleixen:
  // cada xifra porta el seu enllaç a la seva tira, i les condicions d'ús hi
  // consten. La llista de taules va al peu de la pàgina, amb la resta de fonts.
  notes.push(`<p>${escape(poblacio.font.llicencia.obliga)} Les condicions d'ús de les seves API són a
    <a href="${escape(poblacio.font.llicencia.condicions)}" rel="noopener nofollow">idescat.cat</a>;
    la llista de taules d'aquest municipi és al peu de la pàgina.</p>`);

  const detalls = `<details class="nota"><summary>Padró i cens, els anys que falten, i les dues xifres de l'origen</summary>${notes.join(
    "\n",
  )}</details>`;

  return `${capcalera}${context}<ul class="tires gent-tires">${tires}</ul>${edats}${liniaTambe}${detalls}`;
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
 * Què paga la gent: l'aigua, l'IBI i els tipus que vota el ple.
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
 * Eren sis paràgrafs per dir sis coses de l'aigua; ara és una llista de
 * definició —una fila per cosa— que es llegeix de dalt a baix sense buscar on
 * és cada xifra. Els avisos que impedeixen llegir una xifra al revés no es
 * pleguen: van a la seva fila.
 *
 * De l'IBI només se'n publica la variació quan la dada diu que és atribuïble al
 * ple (`publicable`). Si hi ha hagut revisió cadastral, el que ha pujat és la
 * base i no el tipus, i això no ho decideix ningú de l'ajuntament: llavors hi va
 * el motiu i no la xifra.
 *
 * Els tipus impositius —IBI, IAE, el del cotxe i l'any de l'última revisió
 * cadastral— van al final i **sense comparar-los amb ningú**. Els comparàvem
 * amb la mediana catalana i el lector n'extreia «aquí es paga poc IBI». És
 * fals: sobre 823 municipis, la correlació entre el tipus i els euros d'IBI que
 * es recapten per habitant és de +0,08, o sigui cap. El que mana és la base
 * cadastral, i 601 dels 923 municipis tenen la ponència de valors anterior a
 * l'any 2000. El tipus s'hi queda perquè és una decisió del ple i es vota cada
 * any, però comparar és afirmar, i aquí l'afirmació seria falsa. El que es paga
 * de veritat és a la fila del rebut mitjà, en euros.
 */
export function renderQuePaga(
  aigua: PreuAiguaMetric | null,
  ibi: RebutIbiMetric | null,
  taxes: TaxesMetric | null = null,
): string {
  const trossos: string[] = [];
  const fila = (terme: string, definicio: string, classe = ""): string =>
    `<div${classe ? ` class="${classe}"` : ""}><dt>${escape(terme)}</dt><dd>${definicio}</dd></div>`;

  if (aigua && aigua.preu.subministrament !== null) {
    const comparat =
      aigua.comparacio !== null
        ? `<span class="sub">Als ${aigua.comparacio.grup.ambDada} municipis ${escape(aigua.comparacio.grup.etiqueta)}
           el més habitual són ${decimal(aigua.comparacio.mediana, 3)} €.</span>`
        : "";
    // La línia només es dibuixa quan la variació és interpretable, que és la
    // mateixa regla que mana sobre la fila del canvi: si les tarifes no s'han
    // revisat des d'abans del mandat, un preu clavat no vol dir que aquest
    // govern no l'hagi apujat, vol dir que ningú no hi ha tocat —i una línia
    // plana ho diria com si fos una decisió.
    const espurna = aigua.interpretable.valida
      ? sparkline(
          aigua.serie.map((p) => ({ any: p.any, valor: p.subministrament })),
          (v) => `${decimal(v, 3)} €`,
        )
      : "";
    const subministrament = fila(
      "Subministrament, el tram comparable",
      `<b class="xifra">${decimal(aigua.preu.subministrament, 3)} €</b>
       <span class="sub">per metre cúbic, el ${aigua.darrerAny}</span>${espurna}${comparat}`,
      "principal",
    );
    const canon =
      aigua.canon.ara === null
        ? ""
        : fila(
            "Cànon de l'aigua",
            `<b>${decimal(aigua.canon.ara, 3)} €</b> <span class="sub">per metre cúbic · no és municipal</span>
             <span class="nota-linia">${escape(aigua.canon.nota)}</span>`,
          );
    const total =
      aigua.preu.total === null
        ? ""
        : fila(
            "Total del rebut",
            `<b>${decimal(aigua.preu.total, 3)} €</b> <span class="sub">per metre cúbic, segons el full de l'ACA${
              aigua.preu.canon === null ? "" : `, cànon inclòs`
            }${aigua.avisRebut ? "" : " · inclou el clavegueram i la depuració"}</span>${
              aigua.avisRebut ? `<span class="avis-dada">${escape(aigua.avisRebut)}</span>` : ""
            }`,
          );
    const gestio = etiquetaGestio(aigua.gestio);
    const canvis = aigua.gestio.canvis.filter((c) => c.delMandat);
    const blocGestio = gestio
      ? fila(
          "Gestió",
          `<b>${escape(gestio)}</b>${
            canvis.length > 0
              ? ` <span class="sub">el model ha canviat durant aquest mandat (${canvis.map((c) => c.year).join(", ")})</span>`
              : ""
          }`,
        )
      : "";
    // `true` o `null`, mai `false`: el buit del full no vol dir que no en tinguin.
    const social =
      aigua.tarifaSocial.ara === true
        ? fila(
            "Tarifa social",
            `<b>Hi consta</b>${
              aigua.tarifaSocial.desDe === null ? "" : ` <span class="sub">des del ${aigua.tarifaSocial.desDe}</span>`
            }${aigua.tarifaSocial.creadaAquestMandat ? ` <span class="sub">· estrenada aquest mandat</span>` : ""}`,
          )
        : fila(
            "Tarifa social",
            `<b>De tarifa social, la font no en diu res.</b> <span class="nota-linia">${escape(aigua.tarifaSocial.nota)}</span>`,
          );
    const variacio =
      aigua.interpretable.valida && aigua.mandat.subministrament
        ? fila(
            `Canvi del ${aigua.mandat.subministrament.desDe} al ${aigua.mandat.subministrament.fins}`,
            `<b>${
              aigua.mandat.subministrament.percentual === null
                ? `${signeDe(aigua.mandat.subministrament.diferencia)}${decimal(Math.abs(aigua.mandat.subministrament.diferencia), 3)} €`
                : `${signeDe(aigua.mandat.subministrament.percentual)}${decimal(Math.abs(aigua.mandat.subministrament.percentual), 1)} %`
            }</b>
             <span class="sub">de ${decimal(aigua.mandat.subministrament.inici, 3)} € a ${decimal(aigua.mandat.subministrament.final, 3)} €${
               aigua.mandatDelGrup.subministrament?.mediana != null
                 ? ` · als ${aigua.mandatDelGrup.subministrament.municipis} de la seva mida amb la variació interpretable,
                    ${signeDe(aigua.mandatDelGrup.subministrament.mediana)}${decimal(Math.abs(aigua.mandatDelGrup.subministrament.mediana), 1)} %`
                 : ""
             }</span>`,
          )
        : fila(
            "Canvi durant el mandat",
            `<span class="avis-dada"><b>Aquí no es pot dir si el preu ha pujat durant el mandat</b>${
              aigua.interpretable.motiu ? `: ${escape(aigua.interpretable.motiu)}` : "."
            }</span>`,
          );

    trossos.push(`<h3 class="subtitol">L'aigua</h3>
    <dl class="rebut">${subministrament}${canon}${total}${blocGestio}${social}${variacio}</dl>
    <details class="nota"><summary>La lletra petita</summary>Preus del full de tarifes de l'Agència Catalana de l'Aigua${
      aigua.font.dataActualitzacio ? `, actualitzat el ${escape(aigua.font.dataActualitzacio)}` : ""
    }${aigua.dataRevisio ? `. Aquest municipi va revisar les tarifes el ${escape(aigua.dataRevisio)}` : ""}.
    La xifra que es pot comparar entre municipis és la del <b>${escape(aigua.comparable)}</b>.</details>`);
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
        ${
          // Igual que amb l'aigua: quan el que ha canviat és el cadastre i no el
          // ple, la fitxa no publica la variació. Una línia que puja seria
          // exactament això, publicada en forma de dibuix.
          ibi.publicable
            ? sparkline(
                ibi.serie.map((p) => ({ any: p.any, valor: p.rebutMitja })),
                (v) => `${number(Math.round(v))} €`,
              )
            : ""
        }
        <span class="sub">l'any, el ${ibi.darrerAny}${ibi.provisional ? " (dada provisional)" : ""}${
          ibi.rebuts === null ? "" : ` · ${number(ibi.rebuts)} rebuts`
        }</span>
        ${comparat}
      </li>
    </ul>
    ${variacio}
    <details class="nota"><summary>La lletra petita</summary>${escape(ibi.base)} No és el tipus impositiu que vota el ple: dos pobles amb el
    mateix tipus tenen rebuts diferents si el cadastre els valora diferent.
    <a href="${escape(ibi.font.url)}" rel="noopener nofollow">${escape(ibi.font.nom)} · Idescat</a>.</details>`);
  }

  // Els tipus que vota el ple, sense comparació: vegeu el capçal.
  const tipus = taxes
    ? Object.entries(taxes.taxes)
        .filter(([, tax]) => tax.value > 0)
        .map(([key, tax]) => {
          const value = key === "cadastre" ? String(Math.round(tax.value)) : String(tax.value).replace(".", ",");
          return fila(tax.label, `<b>${value}${tax.unit && tax.unit !== "any" ? ` ${escape(tax.unit)}` : ""}</b>`);
        })
    : [];
  if (taxes && tipus.length > 0) {
    trossos.push(`<h3 class="subtitol">Els tipus que vota el ple</h3>
    <dl class="rebut">${tipus.join("")}</dl>
    <details class="nota"><summary>La lletra petita</summary>Tipus vigents el ${taxes.year}, tal com els declara cada ajuntament al mateix
    formulari. <b>No els comparem amb els d'altres municipis a propòsit</b>: un tipus més alt no
    vol dir un rebut més alt, perquè el que mana és el valor cadastral i la majoria de municipis
    el tenen revisat fa dècades. El que es paga de veritat és el rebut mitjà de més amunt, en euros.</details>`);
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
/** Un import en euros, sencer i amb els punts de milers catalans. */
const eurosSencers = (n: number): string => `${Math.round(n).toLocaleString("ca-ES")} €`;

/**
 * Quantes de les regidories, dit sense fer semblar una nota el que és la dada.
 */
function deQuantes(quants: number, total: number): string {
  return `${number(quants)} de ${number(total)}`;
}

/**
 * Què costa aquest govern i què se'n pot saber.
 *
 * És el bloc que la gent més busca i el que ningú no respon, i el que el fa
 * difícil no és trobar una xifra sinó **no publicar-ne una de falsa**. La
 * retribució que un ajuntament publica a la seva seu electrònica sol ser només
 * la part que paga ell: hi ha alcaldies que hi consten amb 17.000 € quan la
 * seva diputació en publica 90.000 més. Una xifra així exculpa, i per això
 * d'aquell camp no n'arriba cap euro a la pàgina.
 *
 * El que sí que s'hi publica són quatre coses, i van en aquest ordre perquè van
 * de la més sòlida a la més parcial:
 *
 *   1. **El que hi dedica l'ajuntament sencer**, del capítol 1000 de la
 *      liquidació. És el mateix formulari per als 947 i té sèrie des del 2019,
 *      i per tant es pot comparar i es pot seguir. No diu què cobra ningú.
 *   2. **El sou de l'alcaldia segons el Ministeri**, que és qui recull el que
 *      cada ajuntament li declara —i només quan és un sou. «Sense dedicació»
 *      amb un import són assistències a plens, i dir-ne sou faria semblar que
 *      una alcaldia de poble cobra 180 € l'any per fer d'alcalde: llavors es
 *      diu això, sense cap xifra al costat.
 *   3. **Què publica aquest ajuntament** de les retribucions dels seus electes:
 *      una resposta de sí o no per regidoria, mai un import. Un ajuntament que
 *      no publica res surt igualment, perquè el buit també és la dada.
 *   4. **Qui té un segon càrrec** en un ens que el paga, amb l'import només si
 *      el publica qui el paga i amb l'enllaç a on el publica. Les diputacions
 *      hi entren per nom, i el que en publiquen omple les files que J14
 *      deixava «sense import publicat»; el màxim per assistències és un
 *      sostre, i s'escriu com a sostre. Aquí no s'hi suma res: el que cobra una
 *      persona de dues administracions no ho ha publicat mai ningú, i una suma
 *      nostra seria una xifra sense font.
 *
 * Cap veredicte. Un govern que costa més no és ni millor ni pitjor: hi ha la
 * xifra, la dels municipis de la seva mida i qui la paga.
 */
export function renderSous(
  cost: CostGovernMetric | null,
  transparencia: TransparenciaRetribucionsMetric | null,
  acumulats: CarrecsAcumulatsMetric | null,
  carrecsSeue: readonly CarrecSeue[] | null = null,
  colorPer: (sigles: string | null) => string = () => "#8b8b8b",
  retribucions: RetribucionsMetric | null = null,
  diputacions: SousDiputacionsMetric | null = null,
  consells: SousConsellsMetric | null = null,
): string {
  /*
   * `parts` és el que queda a la vista i `detall`, el que va plegat a «Més
   * detall». Era el segon bloc més llarg de la fitxa (més de tres mil píxels al
   * mòbil): a la vista hi queden les xifres del que costa el govern, que és la
   * resposta al títol; què publica l'ajuntament de cada regidoria i qui té un
   * segon càrrec són el detall, sencer i a un toc.
   */
  const parts: string[] = [];
  const detall: string[] = [];
  const queHiHa: string[] = [];

  // ---- 1. El que hi dedica l'ajuntament, i el sou de l'alcaldia ----------
  const darrer = cost?.darrer ?? null;
  const targetes: string[] = [];
  let quants = "";
  let mandat = "";
  if (cost && darrer?.organs) {
    const grup = cost.grup?.etiqueta ?? null;
    const medianes = cost.medianesGrup ?? cost.medianes;
    const contra = grup === null ? "del municipi del mig de Catalunya" : `del municipi del mig dels municipis ${grup}`;
    const compara = (valor: number | null, mediana: number | null): string => {
      if (valor === null || mediana === null || mediana <= 0) return "";
      const ratio = valor / mediana;
      const classe = ratio > 1.15 ? " mes" : ratio < 0.85 ? " menys" : "";
      const text =
        ratio > 1.15
          ? `${Math.round(100 * ratio - 100)} % per sobre ${contra}`
          : ratio < 0.85
            ? `${Math.round(100 - 100 * ratio)} % per sota ${contra}`
            : `a tocar ${contra}`;
      return `<span class="comparativa${classe}">${escape(text)}</span>`;
    };
    quants =
      cost.grup && cost.grup.ambDada > 0
        ? `<p class="compta">Comparat amb els ${number(cost.grup.ambDada)} municipis ${escape(cost.grup.etiqueta)}
           dels quals en tenim la liquidació.</p>`
        : "";
    const linia = sparkline(
      cost.serie.filter((a) => !a.parcial).map((a) => ({ any: a.any, valor: a.organs?.perHabitant ?? null })),
      (v) => `${decimal(v, 1)} € per habitant`,
      (v) => `${decimal(v, 1)} €`,
    );
    mandat = cost.mandat
      ? `<p class="apart">Del ${cost.mandat.de} al ${cost.mandat.a}, el que l'ajuntament hi dedica ha passat de
         <b>${eurosSencers(cost.mandat.deTotal)}</b> a <b>${eurosSencers(cost.mandat.aTotal)}</b>
         (${punts(cost.mandat.canviPct)} %).</p>`
      : "";
    targetes.push(`<li>
        <span class="etq">El que hi dedica l'ajuntament</span>
        <span class="gran">${eurosSencers(darrer.organs.total)}</span>
        <span class="sub">retribucions dels membres dels òrgans de govern, ${cost.darrerAnyComplet}</span>
        ${linia}
      </li>
      <li>
        <span class="etq">Per habitant</span>
        <span class="gran">${darrer.organs.perHabitant === null ? "—" : `${decimal(darrer.organs.perHabitant, 1)} €`}</span>
        ${compara(darrer.organs.perHabitant, medianes.perHabitant)}
      </li>
      <li>
        <span class="etq">Per regidoria del ple</span>
        <span class="gran">${darrer.organs.perRegidoria === null ? "—" : eurosSencers(darrer.organs.perRegidoria)}</span>
        ${compara(darrer.organs.perRegidoria, medianes.perRegidoria)}
        <span class="sub">no és el que cobra cap regidor: és el total dividit pels escons</span>
      </li>`);
  }

  /*
   * El sou de l'alcaldia, només quan és un sou.
   *
   * `mena` la decideix J22 amb la regla de `comarques.ts`: «sou» és dedicació
   * exclusiva o parcial amb import; «assistències» és sense dedicació amb
   * import; «cap» és sense cap import. Les dues últimes no porten xifra a la
   * targeta perquè no en tenen cap que sigui un sou, i escriure els 180 € de
   * les assistències a la mateixa casella que un sou de 60.000 seria fer
   * semblar que són la mateixa cosa. La mediana amb què es compara és la de
   * les alcaldies catalanes que sí que tenen sou, i no de totes. I no se suma
   * amb res del que hi ha més amunt ni més avall.
   */
  const ministeri = retribucions?.ministeri ?? null;
  const alc = ministeri?.alcaldia ?? null;
  let souLinia = "";
  if (ministeri && alc) {
    if (alc.mena === "sou") {
      const mediana = retribucions!.catalunya.souMedianaAlcaldia;
      targetes.push(`<li class="sou-alcaldia">
        <span class="etq">Sou de l'alcaldia</span>
        <span class="gran">${eurosSencers(alc.euros)}</span>
        <span class="sub">l'any bruts, el ${ministeri.any}, segons el que publica el Ministeri${
          alc.regim ? ` · ${escape(alc.regim.toLowerCase())}` : ""
        }</span>
        ${
          mediana !== null && mediana > 0
            ? `<span class="comparativa">entre les ${number(retribucions!.catalunya.alcaldiesAmbSou)} alcaldies catalanes
               amb sou, la del mig cobra ${eurosSencers(mediana)}</span>`
            : ""
        }
      </li>`);
    } else {
      souLinia = `<p class="compta sou-alcaldia">${
        alc.mena === "assistencies"
          ? "L'alcaldia no té dedicació: cobra per assistències als òrgans, segons el que publica el Ministeri, i això no és un sou."
          : "L'alcaldia no cobra res de l'ajuntament, segons el que publica el Ministeri."
      }</p>`;
    }
  }

  // Quan l'alcaldia també és diputada provincial, ho avancem al resum: és una
  // dada que sovint es perd dins la llista de càrrecs acumulats. L'import és
  // sempre el que publica la diputació i queda separat del sou municipal.
  const alcaldiaDiputacio = diputacions?.alcaldia?.diputacio ?? null;
  if (diputacions?.alcaldia && alcaldiaDiputacio) {
    const d = alcaldiaDiputacio;
    const importDiputacio =
      d.retribucioAnualBruta !== null
        ? `<span class="gran">${eurosSencers(d.retribucioAnualBruta)}</span>
           <span class="sub">l'any bruts · ${escape(d.dedicacio ?? "retribució anual bruta")} · segons la diputació</span>`
        : d.maximPerAssistencies !== null
          ? `<span class="gran">${eurosSencers(d.maximPerAssistencies)}</span>
             <span class="sub">màxim anual per assistències; no és un sou ni el que ha cobrat</span>`
          : `<span class="gran">—</span><span class="sub">la diputació no publica cap import anual</span>`;
    targetes.push(`<li class="sou-diputacio">
      <span class="etq">L'alcaldia també és a la diputació</span>
      ${importDiputacio}
      <span class="comparativa"><a href="${escape(d.font.url)}" rel="noopener nofollow">${escape(d.font.nom)}</a></span>
    </li>`);
  }

  if (targetes.length > 0 || souLinia !== "") {
    const fontMinisteri = ministeri
      ? ` ${escape(ministeri.advertiment)} El que declara aquest ajuntament al Ministeri:
         <a href="${escape(ministeri.font.urls[0] ?? ministeri.font.pagina)}" rel="noopener nofollow">${escape(
           ministeri.font.nom,
         )}</a>, ${escape(ministeri.font.organisme)}, ${escape(consultatEl(ministeri.font.consultat))}.`
      : "";
    parts.push(`${targetes.length > 0 ? `<ul class="preus">${targetes.join("")}</ul>` : ""}
    ${quants}
    ${mandat}
    ${souLinia}`);
    detall.push(`<details class="nota"><summary>La lletra petita</summary>${cost ? escape(cost.advertiment) : ""}${fontMinisteri}</details>`);
  }

  // ---- 2. Què publica aquest ajuntament ----------------------------------
  if (transparencia && transparencia.total > 0) {
    const t = transparencia;
    const mirats = t.total - t.senseFitxa;
    const files: { etiqueta: string; quants: number }[] = [
      { etiqueta: "Publica una xifra de retribució", quants: t.ambXifra },
      { etiqueta: "Diu si en cobra d'altres administracions", quants: t.ambAltresRetribucions },
      { etiqueta: "Publica les dietes", quants: t.ambDietes },
      { etiqueta: "Publica les indemnitzacions", quants: t.ambIndemnitzacions },
      { etiqueta: "Publica la declaració de béns", quants: t.ambDeclaracioBens },
    ];
    // Quan no s'ha pogut obrir cap fitxa, la taula diria «0 de 0» cinc vegades i
    // semblaria que l'ajuntament no publica res quan el que passa és que no ho
    // hem pogut mirar. Es diu això i prou.
    // I quan totes les files diuen «cap», una taula de cinc «cap» seguits és
    // una frase escrita cinc vegades: es diu un cop, i la taula es plega.
    const totCap = files.every((f) => f.quants === 0);
    const taula = `<div class="taula-envolta"><table class="euros-resultat">
        <caption class="nomes-lectors">Què publica aquest ajuntament de cada regidoria</caption>
        <thead><tr><th scope="col">Del que cobren els electes</th><th scope="col">Regidories</th></tr></thead>
        <tbody>${files
          .map(
            (fila) => `<tr>
            <th scope="row">${escape(fila.etiqueta)}</th>
            <td>${fila.quants === 0 ? '<span class="buit">cap</span>' : deQuantes(fila.quants, mirats)}</td>
          </tr>`,
          )
          .join("")}</tbody></table></div>`;
    const cos =
      mirats === 0
        ? `<p>No hem pogut obrir la fitxa de cap de les ${number(t.total)} regidories a la seu electrònica,
           i per tant d'aquest ajuntament no en podem dir ni que publica ni que no publica.</p>`
        : `${
            totCap
              ? `<p>De les ${number(mirats)} regidories amb fitxa, <b>cap no publica res</b> del que cobra:
                 ni una xifra de retribució, ni si en cobra d'altres administracions, ni dietes,
                 ni indemnitzacions, ni la declaració de béns.</p>
                 <details class="nota"><summary>Apartat per apartat</summary>${taula}</details>`
              : taula
          }
        ${
          t.senseFitxa > 0
            ? `<p class="compta">${deQuantes(t.senseFitxa, t.total)} regidories no tenen fitxa oberta a la seu
               electrònica i no s'han pogut mirar.</p>`
            : ""
        }`;
    queHiHa.push("què en publica l'ajuntament");
    detall.push(`<h3>Què en publica l'ajuntament</h3>
    <p>Aquí no hi ha cap import, i no és un descuit.</p>
    ${cos}
    <p class="avis-dada">${escape(t.advertiment)}</p>
    <details class="nota"><summary>La lletra petita</summary>${escape(majuscula(consultatEl(t.consultat)))} a
      <a href="${escape(t.url)}" rel="noopener nofollow">${escape(t.font)}</a>.</details>`);
  }

  // ---- 3. Qui té un segon càrrec -----------------------------------------
  /*
   * J14 (consells comarcals, diputacions i AMB, amb l'import si el publica
   * l'ens) i J24 (les quatre diputacions, llegides directament) parlen de les
   * mateixes persones i es fusionen aquí per nom normalitzat. Quan J24 porta
   * un import per a una fila que J14 tenia «sense import publicat», l'import
   * de J24 l'omple; quan porta un màxim per assistències, s'escriu com a
   * sostre. Una persona que només és a J24 hi entra com una fila més, i J30
   * —els consells comarcals llegits directament de la seva seu— hi entra amb
   * la mateixa fusió.
   */
  type Altre = CarrecsAcumulatsMetric["persones"][number]["altres"][number];
  type FilaAltre = Altre & { sostre?: { euros: number; font: { nom: string; url: string } } | null };
  type FilaPersona = { nom: string; carrecMunicipal: string; alcaldia: boolean; altres: FilaAltre[] };
  const perClau = new Map<string, FilaPersona>();
  for (const p of acumulats?.persones ?? []) {
    if (p.altres.length === 0) continue;
    perClau.set(normalizePersonName(p.nom), {
      nom: p.nom,
      carrecMunicipal: p.carrecMunicipal,
      alcaldia: p.alcaldia,
      altres: p.altres.map((a) => ({ ...a })),
    });
  }
  for (const p of diputacions?.persones ?? []) {
    const d = p.diputacio;
    const clau = normalizePersonName(p.nom);
    const fila = perClau.get(clau) ?? { nom: p.nom, carrecMunicipal: p.carrecMunicipal, alcaldia: p.alcaldia, altres: [] };
    const font = { nom: d.font.nom, url: d.font.url, consultat: d.font.consultat };
    const retribucio =
      d.retribucioAnualBruta !== null
        ? { anualBrut: d.retribucioAnualBruta, concepte: "retribució anual bruta", dedicacio: d.dedicacio, font }
        : null;
    const sostre = d.maximPerAssistencies !== null ? { euros: d.maximPerAssistencies, font } : null;
    const mateix =
      fila.altres.find((a) => normalize(a.ens) === normalize(d.ens)) ??
      fila.altres.find((a) => /diputaci/i.test(a.tipus) || /diputaci/i.test(a.ens));
    if (mateix) {
      if (!mateix.retribucio && retribucio) {
        mateix.retribucio = retribucio;
        mateix.senseRetribucioPublicada = null;
      }
      if (sostre) {
        mateix.sostre = sostre;
        if (!mateix.retribucio) mateix.senseRetribucioPublicada = null;
      }
    } else {
      fila.altres.push({
        ens: d.ens,
        tipus: d.tipus,
        carrec: d.carrec,
        retribucio,
        senseRetribucioPublicada:
          retribucio || sostre ? null : { motiu: d.motiu ?? "la diputació no en publica cap import", font },
        sostre,
      });
    }
    perClau.set(clau, fila);
  }
  for (const p of consells?.persones ?? []) {
    const d = p.consell;
    const clau = normalizePersonName(p.nom);
    const fila = perClau.get(clau) ?? { nom: p.nom, carrecMunicipal: p.carrecMunicipal, alcaldia: p.alcaldia, altres: [] };
    const font = { nom: d.font.nom, url: d.font.url, consultat: d.font.consultat };
    const retribucio =
      d.retribucioAnualBruta !== null
        ? { anualBrut: d.retribucioAnualBruta, concepte: "retribució anual bruta", dedicacio: d.dedicacio, font }
        : null;
    const sostre = d.maximPerAssistencies !== null ? { euros: d.maximPerAssistencies, font } : null;
    const mateix =
      fila.altres.find((a) => normalize(a.ens) === normalize(d.ens)) ??
      fila.altres.find((a) => /consell comarcal/i.test(a.tipus) || /consell comarcal/i.test(a.ens));
    if (mateix) {
      if (!mateix.retribucio && retribucio) {
        mateix.retribucio = retribucio;
        mateix.senseRetribucioPublicada = null;
      }
      if (sostre) {
        mateix.sostre = sostre;
        if (!mateix.retribucio) mateix.senseRetribucioPublicada = null;
      }
    } else {
      fila.altres.push({
        ens: d.ens,
        tipus: d.tipus,
        carrec: d.carrec,
        retribucio,
        senseRetribucioPublicada:
          retribucio || sostre ? null : { motiu: d.motiu ?? "el consell comarcal no en publica cap import", font },
        sostre,
      });
    }
    perClau.set(clau, fila);
  }
  const ambAltres = [...perClau.values()];

  if (ambAltres.length > 0) {
    // El nom com l'escriu la seu electrònica del seu ajuntament, amb els seus
    // accents: J14 i J24 el porten de fonts que l'escriuen sense.
    const oficials = nomsOficials(carrecsSeue?.map((c) => c.nom) ?? []);
    /**
     * El que és igual per a tothom, dit una vegada.
     *
     * Cada persona ocupava una targeta de 216px i nou targetes feien 1.185: un
     * terç del bloc. I no era per la informació, era per la repetició: vuit de
     * les nou deien exactament la mateixa frase —«la Diputació de Barcelona en
     * publica el preu per sessió i no cap import anual»— perquè totes vuit són
     * de la mateixa diputació. Aquí les persones són una fila cadascuna i el
     * que comparteixen va escrit un sol cop a sota, amb l'enllaç a la font.
     */
    const compartit = new Map<string, { ens: string; motiu: string; font: { nom: string; url: string } }>();
    for (const p of ambAltres) {
      for (const altre of p.altres) {
        const sense = altre.senseRetribucioPublicada;
        if (!sense) continue;
        compartit.set(`${altre.ens}|${sense.motiu}`, { ens: altre.ens, motiu: sense.motiu, font: sense.font });
      }
    }

    const persona = (p: FilaPersona): string => {
      const ens = p.altres
        .map((altre) => {
          // L'import només hi és quan l'ens el publica, i llavors és el que
          // aquesta fila té de particular: va aquí i no a la frase de sota.
          const import_ =
            altre.retribucio && altre.retribucio.anualBrut !== null
              ? `<b class="import">${eurosSencers(altre.retribucio.anualBrut)}</b>
                 <span class="concepte">l'any bruts · ${escape(altre.retribucio.concepte)}${
                   altre.retribucio.dedicacio ? ` (${escape(altre.retribucio.dedicacio)})` : ""
                 } · <a href="${escape(altre.retribucio.font.url)}" rel="noopener nofollow">${escape(
                   altre.retribucio.font.nom,
                 )}</a></span>`
              : altre.sostre
                ? ""
                : `<span class="buit">sense import publicat</span>`;
          // El sostre per assistències no és un sou ni s'hi afegeix: és el
          // màxim que la diputació diu que es pot arribar a cobrar anant a tot.
          const sostre = altre.sostre
            ? `<span class="concepte">sostre per assistències: <b class="import">${eurosSencers(altre.sostre.euros)}</b>
               l'any, si va a totes · no és un sou ni s'hi afegeix ·
               <a href="${escape(altre.sostre.font.url)}" rel="noopener nofollow">${escape(altre.sostre.font.nom)}</a></span>`
            : "";
          return `<span class="altre"><b class="ens">${escape(altre.ens)}</b>${import_}${sostre}</span>`;
        })
        .join("");
      return `<li>
        ${capPersona(nomPreferit(oficials, p.nom), carrecsSeue, colorPer, p.alcaldia ? "alcaldia" : p.carrecMunicipal)}
        <span class="altres">${ens}</span>
      </li>`;
    };
    queHiHa.push("qui té un càrrec en un altre ens");
    detall.push(`<h3>Qui té un càrrec en un altre ens</h3>
    <p>${
      ambAltres.length === 1
        ? "Una persona del ple"
        : `${number(ambAltres.length)} persones del ple`
    } ${ambAltres.length === 1 ? "ocupa" : "ocupen"} també un càrrec al consell comarcal, a la diputació
    o a l'Àrea Metropolitana. Qui hi cobra i qui no depèn de l'ens, i qui ho publica també.</p>
    <ul class="acumulats">${ambAltres.map(persona).join("")}</ul>
    ${[...compartit.values()]
      .map(
        (c) => `<p class="nota oberta">De la <b>${escape(c.ens)}</b>: ${escape(c.motiu)}
        (<a href="${escape(c.font.url)}" rel="noopener nofollow">${escape(c.font.nom)}</a>).</p>`,
      )
      .join("")}
    ${acumulats ? `<p class="avis-dada">${escape(acumulats.advertiment)}</p>` : ""}
    ${diputacions ? `<p class="avis-dada">${escape(diputacions.advertiment)}</p>` : ""}
    <details class="nota"><summary>La lletra petita</summary>${
      acumulats
        ? `A tot Catalunya, ${number(acumulats.catalunya.alcaldiesAmbSegonCarrec)} alcaldies tenen un
    segon càrrec i només ${number(acumulats.catalunya.alcaldiesAmbImportPublicat)} en tenen l'import publicat
    per qui el paga. ${escape(majuscula(consultatEl(acumulats.consultat)))}.`
        : ""
    }${
      diputacions
        ? ` De les diputacions: ${number(diputacions.catalunya.diputatsQueTambeSonRegidors)} diputats són alhora
    regidors, i ${number(diputacions.catalunya.ambImportPublicat)} tenen l'import publicat per la seva diputació.
    ${escape(majuscula(consultatEl(diputacions.catalunya.consultat)))}.`
        : ""
    }</details>`);
  }

  // Sense xifres del cost no hi ha res a resumir: el detall va a la vista,
  // perquè plegar-ho tot deixaria el bloc amb un títol i un botó.
  if (parts.length === 0) return detall.join("\n");
  return [...parts, mesDetall(detall.join("\n"), [...queHiHa, "la lletra petita"])].join("\n");
}

/**
 * Què contracta aquest ajuntament, i amb quanta competència.
 *
 * Un ajuntament decideix dues coses que aquí es poden veure: quant adjudica i
 * com ho treu a concurs. La primera depèn de la mida i del pressupost i per
 * això va sempre contra els municipis del seu tram; la segona no, i és la que
 * val la pena mirar: **quantes de les seves licitacions van rebre una sola
 * oferta**. Una sola oferta no vol dir res de dolent per si mateixa —hi ha
 * mercats amb un sol proveïdor a la comarca—, però un ajuntament on això passa
 * a la immensa majoria dels concursos és diferent d'un on no passa mai, i això
 * no ho diu enlloc ningú.
 *
 * Dues cauteles. La finestra és curta: la font només publica adjudicacions des
 * del 2025, i es diu al costat de la xifra i no al peu. I amb menys de cinc
 * licitacions amb ofertes informades el percentatge no se situa: sobre tres
 * licitacions, un percentil és una xifra inventada.
 */
export function renderContractacio(c: ContractacioMetric | null): string {
  // El buit es diu: 138 municipis no consten a la plataforma i el bloc
  // desapareixia en silenci, que és exactament el que el pla de dades diu que
  // no s'ha de fer («un bloc que desapareix sense explicació fa pensar que no
  // hi ha res a dir»).
  if (!c) {
    return `<p>La plataforma de serveis de contractació pública <b>no publica cap adjudicació
    d'aquest ajuntament</b>, i per això aquí no hi ha xifres. No vol dir que no contracti res:
    vol dir que no ho podem llegir d'una font oberta.</p>`;
  }
  if (c.finestra.contractes === 0) {
    return `<p>En la finestra que publica la font no hi consta <b>cap adjudicació</b> d'aquest
    ajuntament. Un zero aquí no és un veredicte: és el que diu la plataforma.</p>`;
  }
  const comp = c.comparacio;
  const finestra =
    c.finestraDates.desDe && c.finestraDates.finsA
      ? `${delDia(c.finestraDates.desDe)} ${alDia(c.finestraDates.finsA)}`
      : "de la finestra que publica la font";

  const targetes: string[] = [];

  targetes.push(`<li>
    <span class="etq">El que ha adjudicat</span>
    <span class="gran">${eurosSencers(c.finestra.volum)}</span>
    <span class="sub">${number(c.finestra.contractes)} contractes, ${escape(finestra)}</span>
  </li>`);

  if (c.volumPerHabitant !== null && c.ultimAnyComplet !== null) {
    const contra =
      comp && comp.medianaVolum !== null
        ? `<span class="comparativa">entre els ${number(comp.municipisVolum)} municipis
           ${escape(comp.grup)}, el del mig: ${eurosSencers(comp.medianaVolum)}</span>`
        : "";
    targetes.push(`<li>
      <span class="etq">Per habitant, el ${c.ultimAnyComplet}</span>
      <span class="gran">${eurosSencers(c.volumPerHabitant)}</span>
      ${contra}
    </li>`);
  }

  // La xifra que val la pena: una sola oferta. Només si hi ha prou licitacions.
  const solitari =
    c.finestra.unaOfertaPct !== null && comp?.percentilUnaOferta !== null && comp?.medianaUnaOferta !== null;
  if (solitari && comp) {
    targetes.push(`<li>
      <span class="etq">Licitacions amb una sola oferta</span>
      <span class="gran">${percentEnter(c.finestra.unaOfertaPct!)}</span>
      ${reglePercentatge(c.finestra.unaOfertaPct!, comp.medianaUnaOferta, true)}
      <span class="comparativa">entre els ${number(comp.municipisUnaOferta)} municipis
      ${escape(comp.grup)}, el del mig: ${percentEnter(comp.medianaUnaOferta!)}</span>
      <span class="sub">sobre ${number(c.finestra.licitacionsAmbOfertes)} licitacions amb el nombre d'ofertes informat</span>
    </li>`);
  } else if (c.finestra.licitacions > 0) {
    targetes.push(`<li>
      <span class="etq">Licitacions amb una sola oferta</span>
      <span class="gran">—</span>
      <span class="sub">${
        c.finestra.licitacionsAmbOfertes === 0
          ? "cap de les seves licitacions no publica quantes ofertes va rebre"
          : `només ${number(c.finestra.licitacionsAmbOfertes)} licitacions publiquen quantes ofertes van rebre, i amb tan poques el percentatge no vol dir res`
      }</span>
    </li>`);
  }

  return `<ul class="preus">${targetes.join("")}</ul>
  <p class="nota oberta">Una sola oferta no vol dir que res s'hagi fet malament: hi ha serveis amb un únic
  proveïdor possible a la comarca. Vol dir que en aquell concurs no hi va haver competència, i qui
  llegeix que ho jutgi.</p>
  <p class="compta">La font només publica adjudicacions ${escape(finestra)}: és una finestra curta i
  no s'hi pot llegir cap tendència. Els noms de les empreses adjudicatàries hi són i aquí no es
  publiquen; qui vulgui saber qui ha guanyat cada contracte té
  <a href="${escape(c.detall)}" rel="noopener nofollow">l'enllaç a la plataforma</a>.</p>
  <details class="nota"><summary>La lletra petita</summary>Font: <a href="${escape(c.fontUrl)}" rel="noopener nofollow">${escape(c.font)}</a>.</details>`;
}

/**
 * Quant fa que mana el mateix, i quants vots no van arribar al ple.
 *
 * Dues preguntes que la sèrie d'eleccions ja respon i que la fitxa no
 * preguntava. La primera és el context sense el qual una alternança no vol dir
 * res: canviar de govern després de quatre anys i canviar-ne després de
 * vint-i-vuit són fets diferents. La segona és la pregunta del vot útil escrita
 * amb la xifra del propi poble —quants dels vots que es van dipositar a l'urna
 * no van elegir ningú, i a quantes regidories equivaldrien—, i és la que fa que
 * «el meu vot no serveix de res» deixi de ser una intuïció i passi a ser un
 * número que es pot comprovar.
 *
 * Tres tires i una lletra petita. Eren dues targetes gegants i tres paràgrafs
 * —«7 anys» / «7 anys», «quant es mou el ple», «els vots que no van arribar»—
 * que ocupaven una pantalla per dir tres xifres. Les xifres van a les tires, i
 * tot el que explica com es compten i el que no es veu a la xifra —la data
 * deduïda, les legislatures sense alcalde, la volatilitat, les regidories que
 * el vot perdut valdria— va plegat a sota, sencer.
 *
 * Cauteles. Els anys de ratxa poden ser aproximats: la font no dona la data de
 * constitució de les legislatures del 2011 al 2023, i quan s'ha hagut de
 * deduir es diu. La volatilitat només es publica sobre els trams fiables: en un
 * ple ple de llistes locals que canvien de nom cada elecció, l'índex mesuraria
 * els noms i no els vots. I el vot perdut només es diu sencer quan els vots per
 * candidatura de la font quadren amb els que ella mateixa declara.
 */
/**
 * @param alcaldia Qui té l'alcaldia avui i on és la seva fitxa, per enllaçar-hi
 *   el nom de «La mateixa persona» quan és ella. La ratxa és de qui mana ara
 *   —la calcula `derive/trajectoria` cap enrere des de l'últim mandat—, però
 *   es comprova pel nom igualment: si un dia la ratxa parlés d'algú altre, el
 *   nom no portaria a una fitxa que no és la seva.
 */
export function renderTrajectoria(
  continuitat: ContinuitatMetric | null,
  votPerdut: VotPerdutMetric | null,
  alcaldia: { nom: string | null; adreca: string | null } | null = null,
): string {
  const tires: string[] = [];
  const notes: string[] = [];

  const ratxa = continuitat?.partit ?? null;
  if (continuitat && ratxa && ratxa.anys > 0) {
    const sigles = ratxa.sigles ?? "la mateixa força";
    const desDe =
      ratxa.ininterromput && ratxa.forats.length === 0
        ? "des de la primera legislatura que consta"
        : `des del ${ratxa.desDeAny}`;
    tires.push(
      tira({
        etq: `Fa que mana ${sigles}`,
        xifra: `${number(ratxa.anys)} ${ratxa.anys === 1 ? "any" : "anys"}`,
        peu: `${escape(desDe)} · ${number(ratxa.legislatures)} ${
          ratxa.legislatures === 1 ? "legislatura" : "legislatures"
        } seguides`,
      }),
    );
    if (continuitat.persona) {
      const nom = nomLlegible(continuitat.persona.nom);
      const esLAlcaldia =
        alcaldia?.adreca &&
        alcaldia.nom &&
        normalizePersonName(alcaldia.nom) === normalizePersonName(continuitat.persona.nom);
      tires.push(
        tira({
          etq: "La mateixa persona",
          xifra: `${number(continuitat.persona.anys)} ${continuitat.persona.anys === 1 ? "any" : "anys"}`,
          peu: esLAlcaldia ? `<a href="${escape(alcaldia!.adreca!)}">${escape(nom)}</a>` : escape(nom),
        }),
      );
    }
    // Dues coses que, si no es diuen, converteixen una ratxa en una afirmació
    // que la font no sosté: que la data s'ha hagut de deduir, i que la ratxa
    // travessa legislatures de les quals no consta cap alcalde.
    const avisos: string[] = [];
    if (ratxa.aproximat) {
      avisos.push(
        "la font no publica la data de constitució de les legislatures del 2011 al 2023 i s'ha pres la de la legislatura",
      );
    }
    if (ratxa.forats.length > 0) {
      avisos.push(
        `la ratxa travessa ${number(ratxa.forats.length)} ${
          ratxa.forats.length === 1 ? "legislatura" : "legislatures"
        } de les quals la font no registra cap alcalde (${ratxa.forats.map(escape).join(", ")})`,
      );
    }
    if (ratxa.aturadaPerDesconegut) {
      avisos.push("cap enrere s'atura on la font deixa de dir de quin partit era l'alcaldia");
    }
    const alternances =
      continuitat.alternances === 0
        ? `Des del ${continuitat.primeraLegislatura?.slice(0, 4) ?? "1979"} no hi ha hagut cap alternança:
           l'alcaldia no ha canviat de força ni una sola vegada.`
        : `Hi ha hagut ${number(continuitat.alternances)} ${
            continuitat.alternances === 1 ? "alternança" : "alternances"
          } de força a l'alcaldia, i ${number(continuitat.personesDiferents)} persones diferents
          l'han ocupada.`;
    notes.push(`<p>${alternances}${
      avisos.length === 0 ? "" : ` ${avisos.join("; ").replace(/^./, (c) => c.toUpperCase())}.`
    }</p>`);
  }

  // La volatilitat: quant es mou el repartiment del ple d'una elecció a l'altra.
  const vol = continuitat?.volatilitat ?? null;
  if (vol && vol.mitjana !== null && vol.tramsFiables > 0) {
    const c = vol.comparacio;
    notes.push(`<p><b>Quant es mou el ple d'una elecció a l'altra.</b> De mitjana, <b>${decimal(vol.mitjana, 1)} de cada 100 escons</b>
    canvien de família política entre dues eleccions. Zero voldria dir un ple calcat; cent, que no hi queda res del
    repartiment anterior.${
      c ? ` La mediana dels ${number(c.grupMida)} municipis ${escape(c.grup)} és ${decimal(c.mediana, 1)}.` : ""
    } Calculat sobre ${number(vol.tramsFiables)} de ${number(vol.trams)} trams: els que tenen massa escons de
    llistes locals no hi entren, perquè allà l'índex mesuraria els noms de les candidatures i no el vot.</p>`);
  }

  // El vot que no va arribar enlloc.
  const darrera = votPerdut?.darrera ? votPerdut.eleccions[votPerdut.darrera] : null;
  if (votPerdut && darrera) {
    const total = darrera.total;
    const equivalents = votPerdut.regidorsEquivalents;
    const c = votPerdut.comparacio;
    if (total) {
      tires.push(
        tira({
          etq: "Vots sense regidoria",
          xifra: percent(total.pct),
          peu: `${number(total.vots)} vots del ${darrera.any}${
            c ? ` · la mediana dels seus, ${percent(c.mediana)}` : ""
          }`,
        }),
      );
      notes.push(`<p><b>Els vots que no van arribar al ple.</b> <b>${number(total.vots)} vots</b> del ${darrera.any}
      —el ${percent(total.pct)} dels emesos— no van elegir ningú: ni un regidor.${
        equivalents !== null && equivalents >= 0.5
          ? ` Si haguessin tingut traducció, serien <b>${decimal(equivalents, 1)} regidories</b>.`
          : ""
      }${
        c ? ` La mediana dels ${number(c.grupMida)} municipis ${escape(c.grup)} és ${percent(c.mediana)}.` : ""
      }${
        votPerdut.variacioDesDel2019 !== null ? ` Respecte del 2019, ${punts(votPerdut.variacioDesDel2019)} punts.` : ""
      }</p>`);
    } else {
      // Sense la xifra sencera es diu la part que sí que es pot afirmar.
      tires.push(
        tira({
          etq: "Nuls i en blanc",
          xifra: percent(darrera.nulsIBlancs.pct),
          peu: `${number(darrera.nulsIBlancs.vots)} vots del ${darrera.any}`,
        }),
      );
      notes.push(`<p><b>Els vots que no van arribar al ple.</b> D'aquest municipi no en podem donar la xifra sencera:
      els vots per candidatura que publica la font no sumen els que ella mateixa declara. El que sí que es pot
      dir és que <b>${number(darrera.nulsIBlancs.vots)} vots</b> del ${darrera.any} van ser nuls o en blanc,
      el ${percent(darrera.nulsIBlancs.pct)} dels emesos.</p>`);
    }
    notes.push(`<p>Al vot sense regidoria hi entren els vots a candidatures que es van quedar sense cap regidoria, els nuls
    i els blancs. El denominador són els vots emesos i no el cens: això no parla de qui no va anar a
    votar —que té el seu propi bloc— sinó de qui hi va anar i va tornar a casa sense representació.
    No és cap defecte del sistema ni cap veredicte: és una conseqüència de repartir un nombre enter
    de regidories, i qui llegeix que ho jutgi.</p>`);
  }

  if (tires.length === 0 && notes.length === 0) return "";
  return `${tires.length > 0 ? `<ul class="tires">${tires.join("")}</ul>` : ""}
  ${
    notes.length > 0
      ? `<details class="nota"><summary>La lletra petita</summary>${notes.join("\n")}</details>`
      : ""
  }`;
}

/**
 * Els papers d'aquest mandat: el cartipàs, les ordenances i els ens dependents.
 *
 * Els tres van junts perquè els tres responen «on ho puc mirar jo», que és
 * l'única manera que això no sigui una altra pàgina que demana que se la
 * cregui. El cartipàs i les ordenances porten l'enllaç al document oficial, no
 * una còpia nostra.
 *
 * Els organismes dependents hi són com a **perímetre i no com a xifra**: si un
 * ajuntament té una societat municipal que porta l'aigua, la despesa d'aquell
 * servei no és a la seva liquidació, i tot el bloc de diners de la fitxa es
 * llegeix diferent segons si això es diu o no. No en publiquem cap import
 * perquè la font no en dona cap.
 */
export function renderPapers(
  cartipas: CartipasMetric | null,
  ordenances: OrdenancesMetric | null,
  organismes: OrganismesMetric | null,
): string {
  const parts: string[] = [];

  if (cartipas) {
    const quan = cartipas.data ? ` Publicat ${elDia(cartipas.data)}.` : "";
    parts.push(`<p><b>El cartipàs del mandat ${escape(cartipas.mandat)}</b> és el document que diu quina
    àrea porta cada regidoria i quines competències s'han delegat.${escape(quan)}
    ${
      cartipas.enllac
        ? `<a href="${escape(cartipas.enllac)}" rel="noopener nofollow">${escape(cartipas.titol)}</a>.`
        : `Consta publicat com a «${escape(cartipas.titol)}», però la font no en dona l'enllaç.`
    }</p>`);
  }

  if (ordenances && ordenances.mandat > 0) {
    const llista = ordenances.ultimes
      .map(
        (o) =>
          `<li>${
            o.enllac
              ? `<a href="${escape(o.enllac)}" rel="noopener nofollow">${escape(o.titol)}</a>`
              : escape(o.titol)
          } <span class="sub">${dataCurta(o.data)}</span></li>`,
      )
      .join("");
    parts.push(`<p><b>${number(ordenances.mandat)}</b> ${
      ordenances.mandat === 1 ? "ordenança o reglament s'ha aprovat" : "ordenances i reglaments s'han aprovat"
    } des del ${ordenances.desDe.slice(0, 4)}. ${
      ordenances.ultimes.length > 0 ? "Els últims:" : ""
    }</p>
    ${llista === "" ? "" : `<ul class="apart">${llista}</ul>`}`);
  }

  if (organismes && organismes.total > 0) {
    const tipus = Object.entries(organismes.perTipus)
      .sort((a, b) => b[1] - a[1])
      .map(([nom, quants]) => `${number(quants)} ${escape(nom.toLowerCase())}`)
      .join(", ");
    parts.push(`<h3>El que no surt a la liquidació</h3>
    <p>Aquest ajuntament té <b>${number(organismes.total)}</b> ${
      organismes.total === 1 ? "ens dependent o vinculat" : "ens dependents o vinculats"
    }: ${tipus}.</p>
    <ul class="apart">${organismes.organismes
      .map((o) => `<li>${escape(o.nom)} <span class="sub">${escape(o.tipus)}</span></li>`)
      .join("")}</ul>
    <p class="avis-dada">El que gasten aquests ens <b>no és a la liquidació de l'ajuntament</b>, i per
    tant tampoc a les xifres de diners d'aquesta fitxa. Segons què hi hagi posat cada ajuntament, la
    mateixa quantitat de servei pot sortir com a despesa municipal en un poble i no sortir-hi en un
    altre. No en publiquem cap import perquè la font no en dona cap.</p>`);
  }

  if (parts.length === 0) return "";
  const fonts = [cartipas, ordenances, organismes].filter((x): x is NonNullable<typeof x> => x !== null);
  return `${parts.join("\n")}
  <details class="nota"><summary>La lletra petita</summary>Fonts: ${fonts
    .map((f) => `<a href="${escape(f.fontUrl)}" rel="noopener nofollow">${escape(f.font)}</a>`)
    .join(" · ")}.</details>`;
}

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
  ${
    // Les dues sèries, una sota l'altra i cadascuna amb la seva escala.
    // Compartir-la seria pintar euros i percentatges al mateix eix; el que
    // val la pena mirar és si les dues línies van juntes o cadascuna per la
    // seva banda, i això es veu igual amb dues escales.
    residus.serie.filter((p) => p.taxaSelectiva !== null).length >= 3
      ? `<div class="dues-series">
      <div><span class="rotul-serie">Recollida selectiva</span>${sparkline(
        residus.serie.map((p) => ({ any: p.any, valor: p.taxaSelectiva })),
        (v) => percent(v),
      )}</div>
      <div><span class="rotul-serie">Quilos per habitant</span>${sparkline(
        residus.serie.map((p) => ({ any: p.any, valor: p.kgHabAny })),
        (v) => `${number(Math.round(v))} kg`,
      )}</div>
    </div>`
      : ""
  }
  <details class="nota"><summary>La lletra petita</summary>${escape(programa.perque)}
  La despesa és en euros per habitant d'obligacions reconegudes netes, sense
  descomptar la inflació.${
    cobertura
      ? ` Dels ${cobertura.ambLiquidacio} ajuntaments que van liquidar el ${despesa!.anyComparable},
         ${cobertura.ambImport} hi destinen alguna cosa i ${cobertura.ambZero} no hi destinen ni un euro.`
      : ""
  } <b>${escape(ZERO_I_BUIT)}</b></details>
  <p class="nota oberta">No hi posem cap veredicte: gastar-hi més no vol dir fer-ho millor, i reciclar més
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
  //
  // La xifra és la del padró, la mateixa que la capçalera i que «Qui hi viu».
  // Abans era la del cens de població de l'INE, que és una altra font i dona
  // una altra xifra: a Juncosa la capçalera deia 377 habitants i aquesta fila
  // 379, sense dir que eren dues coses diferents. Només quan el padró no porta
  // el canvi del mandat es fa servir el cens, i llavors l'etiqueta ho diu.
  const padroMandat = data.poblacio ? indicadorDe(data.poblacio, "padroHabitants") : null;
  const censMandat = data.poblacio ? indicadorDe(data.poblacio, "censHabitants") : null;
  const poblacioMandat = padroMandat?.mandat ? padroMandat : censMandat?.mandat ? censMandat : null;
  if (poblacioMandat?.mandat && data.poblacio && !data.poblacio.context.decideixLAjuntament) {
    files.push({
      etiqueta: poblacioMandat === padroMandat ? "Gent empadronada" : "Població censada (INE)",
      unitat: "persones",
      mandat: poblacioMandat.mandat,
      grup: poblacioMandat.mandatDelGrup,
      amuntEsMillor: null,
      decimals: 0,
      decimalsBase: 0,
      nota: `La població no la decideix l'ajuntament. ${data.poblacio.context.nota}`,
    });
  }

  /**
   * Els programes de despesa, en euros per habitant.
   *
   * Van a part perquè són quinze i perquè no són del mateix tipus que la
   * resta: aquí no hi ha res que millori ni que empitjori, hi ha on han
   * decidit posar els diners. Eren divuit files de text —«+13,7 €/hab, de 71
   * el 2023 a 85 el 2025, als 20 de la seva mida +8,1»— que calia llegir una
   * per una; ara són barres que surten del zero cap a una banda o l'altra,
   * amb el mateix canvi als seus marcat a sobre, i es veu de reüll què s'ha
   * mogut. L'ordre és el del canvi més gran, i els programes on no hi havia
   * res ni al principi ni al final —«Aigua potable, 0,0»— no hi surten: una
   * barra buida d'un servei que l'ajuntament no presta no diu res.
   */
  const programes = (data.despesaProgrames?.programes ?? [])
    .filter((p): p is ProgramaDespesa & { mandat: Variacio } => p.mandat !== null)
    .filter((p) => !(p.mandat.inici === 0 && p.mandat.final === 0))
    .sort((a, b) => Math.abs(b.mandat.diferencia) - Math.abs(a.mandat.diferencia));
  // L'abans i el després van només a l'etiqueta del punt: «+13,7 €/hab» sol no
  // diu si es parteix de 20 o de 200.
  const despesa: FilaDivergent[] = programes.map((p) => ({
    etiqueta: p.nom,
    valor: p.mandat.diferencia,
    grup: p.mandatDelGrup?.diferencia ?? null,
    abans: p.mandat.inici,
    despres: p.mandat.final,
  }));

  if (files.length === 0 && despesa.length === 0) return "";

  const signe = signeDe;
  /**
   * La icona del tema de cada fila.
   *
   * Sis files de xifres amb el mateix aspecte s'han de llegir una per una per
   * saber de què va cadascuna. Amb el dibuix al davant, la de l'aigua, la del
   * lloguer i la de les escombraries es distingeixen abans de llegir-les —que
   * és el que fa la resta de la casa, i aquí no hi era. Les files de despesa
   * per servei no en porten: no hi ha una icona per a cada programa i
   * inventar-ne una correspondència seria pitjor que no posar-n'hi cap.
   */
  const TEMA_MANDAT: Readonly<Record<string, string>> = {
    "Recollida selectiva": "residus",
    "Preu de l'aigua": "medi ambient",
    "Rebut mitjà d'IBI": "fiscalitat",
    "Deute per habitant": "deute public",
    "Preu del lloguer": "habitatge",
    "Gent empadronada": "habitants",
    "Població censada (INE)": "habitants",
  };
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
    // Muda: l'etiqueta del costat ja diu el mateix, i llegida dues vegades entrebanca.
    const dibuix = icona(TEMA_MANDAT[f.etiqueta] ?? "", true);
    return `<li${sentit.trim() ? ` class="${sentit.trim()}"` : ""}>
      ${dibuix ? `<span class="tema" aria-hidden="true">${dibuix}</span>` : '<span class="tema"></span>'}
      <span class="etq">${escape(f.etiqueta)}</span>
      <span class="salt"><b>${signe(m.diferencia)}${dec === 0 ? number(Math.round(dif)) : decimal(dif, dec)}</b> ${escape(f.unitat)}</span>
      <span class="dedes">de ${fmt(m.inici, base)} el ${m.desDe} a ${fmt(m.final, base)} el ${m.fins}</span>
      ${delGrup}
    </li>`;
  };

  const cos = files.map(fila).join("");
  // Tres notes seguides eren tres desplegables un sota l'altre, que és més
  // soroll que les notes mateixes. Van totes dins del mateix.
  const ambNota = files.filter((f) => f.nota);
  const notes =
    ambNota.length === 0
      ? ""
      : `<details class="nota"><summary>La lletra petita</summary>${ambNota
          .map((f) => `<span class="apart">${escape(f.nota!)}</span>`)
          .join("")}</details>`;
  /**
   * Les vuit que més s'han mogut a la vista i la resta plegades, **totes amb la
   * mateixa escala**: es calcula sobre la llista sencera i es passa a les dues
   * crides, perquè una barra de dins del plec digui el mateix que una de fora.
   */
  const VISIBLES = 8;
  const primerPrograma = programes[0] ?? null;
  const opcionsDivergents = {
    titol: primerPrograma
      ? `Canvi de la despesa per habitant del ${primerPrograma.mandat.desDe} al ${primerPrograma.mandat.fins}`
      : "Canvi de la despesa per habitant",
    format: (v: number): string => decimal(v, 1),
    unitat: "€/hab",
    nomGrup: data.despesaProgrames?.grup?.etiqueta ?? null,
    escala: escalaDivergent(despesa),
    anys: primerPrograma ? { inici: primerPrograma.mandat.desDe, final: primerPrograma.mandat.fins } : null,
  };
  const restaProgrames = despesa.slice(VISIBLES);
  const blocDespesa =
    despesa.length === 0
      ? ""
      : `<h3 class="subtitol">On han posat els diners, servei a servei</h3>
    ${barresDivergents(despesa.slice(0, VISIBLES), opcionsDivergents)}
    ${
      restaProgrames.length === 0
        ? ""
        : `<details class="nota mes-programes"><summary>${
            restaProgrames.length === 1 ? "L'altre programa" : `Els altres ${number(restaProgrames.length)} programes`
          }, amb la mateixa escala</summary>${barresDivergents(restaProgrames, opcionsDivergents)}</details>`
    }
    <details class="nota"><summary>La lletra petita</summary>Euros per habitant liquidats, del ${primerPrograma!.mandat.desDe} al
    ${primerPrograma!.mandat.fins}, en euros corrents i sense descomptar la inflació.
    Gastar-hi més no vol dir fer-ho millor: vol dir haver-hi posat més diners. La ratlla grisa és el
    mateix canvi als municipis de la seva mida. Els programes on l'ajuntament no hi posava res ni al
    començament ni al final del mandat no hi surten.${
      data.despesaProgrames && data.despesaProgrames.anysSenseLiquidacio.length > 0
        ? ` D'aquest ajuntament no en tenim la liquidació del ${data.despesaProgrames.anysSenseLiquidacio.join(", ")}.`
        : ""
    }</details>`;

  return `${cos ? `<ul class="mandat">${cos}</ul>` : ""}
  <p class="nota oberta">La xifra de la dreta és <b>el mateix canvi als municipis de la seva mida</b>.
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
 *
 * Cada fila voldria portar, sota la barra, el regle de dispersió de
 * `grafics.ts` amb una marca per municipi del grup. Avui no pot:
 * `PeerComparison` només desa mediana, percentil, rang i quota, no els valors
 * del grup. Perquè el regle hi càpiga caldria que J8 desés per indicador la
 * llista ordenada de valors del grup —com fa `MedianaGrup.valors` amb la
 * participació— i que arribés fins aquí dins de `finances.comparison`. Mentre
 * no hi sigui, el regle només es dibuixa on els valors existeixen de debò: a
 * la participació.
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
    "estalvi-brut": "El que sobra abans de pagar el deute (estalvi brut)",
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
  <details class="nota"><summary>La lletra petita</summary>Cada barra és la posició dins del grup, i sempre vol dir el mateix: com més
  llarga, millor està aquest municipi en aquell indicador. Comparar-lo amb tot Catalunya
  barrejaria Barcelona amb pobles de tres-cents habitants i no voldria dir res.</details>`;
}

/**
 * «En 30 segons»: el poble explicat en quatre o cinc frases, abans de cap xifra.
 *
 * La fitxa fa quaranta mil píxels al mòbil i les respostes que la majoria de
 * gent hi ve a buscar —qui mana, si pot fer-ho sol, si l'ajuntament deu molt,
 * si la gent hi vota— eren escampades en quatre blocs diferents. Aquí hi van
 * dites com les diria un veí, just sota la portada.
 *
 * **Cap frase no és nova.** Totes surten de dades que la pàgina ja ensenya més
 * avall, calculades allà mateix: la ratxa de `continuitat`, la mètrica del
 * govern, el deute de `finances`, la despesa liquidada i la participació del
 * 2023. I cada frase **desapareix sencera** quan li falta la dada: mai no es
 * completa amb un «no consta» enmig ni amb un any deduït. Amb menys de dues
 * frases el bloc no surt, perquè una frase sola ja la diu la portada.
 *
 * La comparació és sempre amb «el municipi del mig» dels de la seva mida (la
 * mediana del grup, dita en planer) i mai amb un adjectiu: deure més que el
 * del mig no és ni bo ni dolent, i la frase no ho insinua.
 */
export function renderEn30Segons(
  data: RadiografiaData,
  ctx: {
    /** Qui té l'alcaldia, tal com l'ha resolta `resolAlcaldia`. */
    alcaldia?: { nom: string | null } | null;
    medianes?: MedianesMunicipi;
    colorPer?: (sigles: string | null) => string;
    /**
     * Les sigles de la candidatura d'un grup del ple de la seu electrònica
     * («Grup Municipal d'ERC» → «ERC-AM»), quan es poden saber. Sense això la
     * coalició es diu pel nombre de grups i no pel nom.
     */
    siglesDelGrup?: (grup: string) => string | null;
  } = {},
): string {
  const frases: string[] = [];
  const government = data.government;
  const colorPer = ctx.colorPer;
  const pastilla = (sigles: string): string =>
    colorPer ? sigla(sigles, { base: BASE, color: colorPer(sigles) }) : `<b>${escape(sigles)}</b>`;
  const siglesAlcaldia = government?.mayorSigles ?? null;

  // ---- 1. Qui mana i des de quan -------------------------------------------
  // La persona i la força, cadascuna amb el seu «des de» només quan la ratxa
  // es pot afirmar: una ratxa amb legislatures sense alcalde registrat, o
  // aturada perquè no se sap de quin partit era el pas anterior, no diu des de
  // quan mana ningú.
  const fiable = (r: { forats: readonly string[]; aturadaPerDesconegut?: boolean } | null | undefined): boolean =>
    Boolean(r) && r!.forats.length === 0 && r!.aturadaPerDesconegut !== true;
  const nom = ctx.alcaldia?.nom ? nomLlegible(ctx.alcaldia.nom) : null;
  const persona = data.continuitat?.persona ?? null;
  const anyPersona =
    nom && persona && fiable(persona) && mateixaPersona(persona.nom, nom)
      ? persona.desDeAny
      : nom
        ? (() => {
            // Sense ratxa, el relleu a mig mandat diu des de quan hi és qui hi és.
            const desDe = relleuDelMandat(data.mayors, nom)?.desDe ?? null;
            return desDe ? Number(desDe.slice(0, 4)) : null;
          })()
        : null;
  const partit = data.continuitat?.partit ?? null;
  const anyPartit =
    partit && fiable(partit) && partit.legislatures > 1 && (!siglesAlcaldia || !partit.sigles || sameForce(partit.sigles, siglesAlcaldia))
      ? partit.desDeAny
      : null;
  if (nom) {
    const desDe = anyPersona ? ` des del ${anyPersona}` : "";
    const amb = siglesAlcaldia ? `, amb ${pastilla(siglesAlcaldia)}` : "";
    const forca =
      anyPartit !== null && (anyPersona === null || anyPartit < anyPersona)
        ? `, i el seu partit hi mana des del ${anyPartit}`
        : "";
    frases.push(`<b>${escape(nom)}</b> té l'alcaldia${desDe}${amb}${forca}.`);
  } else if (siglesAlcaldia && anyPartit !== null) {
    frases.push(`${pastilla(siglesAlcaldia)} té l'alcaldia des del ${anyPartit}.`);
  }

  // ---- 2. Si té majoria, i amb qui governa ---------------------------------
  // La coalició només es diu quan la seu electrònica marca el govern sencer
  // (`lecturaDelGovern`): amb les banderes incompletes no se sap qui hi és.
  const lectura = data.carrecs && data.carrecs.carrecs.length > 0
    ? lecturaDelGovern(data.carrecs, government, data.councillors)
    : null;
  const grupsGovern = lectura && !lectura.banderesIncompletes && lectura.govern.length > 0 ? lectura.grupsGovern : null;
  let coalicio = "";
  if (grupsGovern && grupsGovern.length > 1) {
    const sigles = grupsGovern.map((g) => ctx.siglesDelGrup?.(g) ?? null);
    const socis = sigles.filter((s): s is string => s !== null && !(siglesAlcaldia && sameForce(s, siglesAlcaldia)));
    coalicio =
      sigles.every((s) => s !== null) && socis.length > 0
        ? `governa en coalició amb ${socis.map(pastilla).reduce((a, b, i, tots) => (i === tots.length - 1 ? `${a} i ${b}` : `${a}, ${b}`))}`
        : `governa en coalició de ${number(grupsGovern.length)} grups`;
  } else if (grupsGovern && grupsGovern.length === 1) {
    coalicio = "governa sola";
  }
  if (government) {
    const seients = government.mayorSeats;
    const total = government.totalSeats;
    if (seients !== null && total > 0 && government.winnerGoverns !== false && seients >= government.majority) {
      frases.push(`La seva llista té <b>${number(seients)} de les ${number(total)}</b> regidories: majoria absoluta, i pot aprovar les coses sense els vots de ningú més.`);
    } else if (seients !== null && total > 0) {
      frases.push(`La seva llista té <b>${number(seients)} de les ${number(total)}</b> regidories, i la majoria absoluta és de ${number(government.majority)}${
        coalicio === "governa sola" ? ": governa sola, en minoria" : coalicio ? `: ${coalicio}` : ""
      }.`);
    } else if (coalicio && coalicio !== "governa sola") {
      frases.push(`${coalicio[0]!.toUpperCase()}${coalicio.slice(1)}.`);
    }
  }

  // ---- 3. El deute, contra el municipi del mig -----------------------------
  const comptes = data.finances;
  const deute = comptes?.indicators.find((i) => i.key === "deute-habitant") ?? null;
  if (comptes && deute && deute.value !== null) {
    const c = comptes.comparison.find((x) => x.key === "deute-habitant") ?? null;
    const delMig =
      c && c.median !== null
        ? `; el municipi del mig dels ${c.groupSize > 0 ? `${number(c.groupSize)} ` : ""}de la seva mida en deu ${formatValue(c.median, deute.unit)}`
        : "";
    frases.push(`L'ajuntament deu <b>${formatValue(deute.value, deute.unit)}</b> per habitant (${comptes.year})${delMig}.`);
  }

  // ---- 4. El que gasta, contra el mateix municipi del mig ------------------
  const gasta = despesaPerHabitant(data.despesaProgrames, data.spending);
  if (gasta) {
    const ref = gasta.referencia;
    frases.push(`Gasta <b>${number(Math.round(gasta.perHabitant))} €</b> per habitant l'any (liquidat el ${gasta.any})${
      ref ? `; el municipi del mig de la seva mida, ${number(Math.round(ref.mediana))} €` : ""
    }.`);
  }

  // ---- 5. Qui hi va anar a votar -------------------------------------------
  const votar = data.participation.find((r) => r.electionId === "M20231");
  if (votar?.censusSize && votar.voters !== null && votar.voters !== undefined) {
    const pct = (100 * votar.voters) / votar.censusSize;
    const m = ctx.medianes?.participacio["M20231"] ?? null;
    frases.push(`Al maig del 2023 hi va anar a votar el <b>${percent(pct)}</b> del cens${
      m ? `; al municipi del mig de la seva mida, el ${percent(m.mediana)}` : ""
    }.`);
  }

  if (frases.length < 2) return "";
  // El relleu a mig mandat el diu la papereta, i només aquí: és un fet que
  // canvia com s'han de llegir les frases de dalt (qui té l'alcaldia avui no
  // és qui va sortir del ple del 2023), i una vinyeta per bloc com a molt.
  const relleu = data.mayors?.currentTermChange
    ? vinyetaPapereta("canviMigMandat", "En aquest mandat hi ha hagut un relleu a l'alcaldia.", {
        enllac: { href: "#alcaldies", text: "Qui hi havia abans" },
      })
    : "";
  return `<section class="fx-30" aria-labelledby="fx-30-titol">
  <h2 id="fx-30-titol">En 30 segons</h2>
  <ul>
    ${frases.map((f) => `<li>${f}</li>`).join("\n    ")}
  </ul>
  ${relleu}
</section>`;
}

/**
 * El poble en cinc xifres, abans de l'índex.
 *
 * La fitxa fa 28.000 píxels i 5.700 paraules. Qui l'obre per saber com està el
 * seu poble no hauria d'haver de recórrer-la sencera per treure'n res: aquí hi
 * ha les cinc xifres que responen la pregunta, cadascuna amb on queda
 * respecte dels municipis de la seva mida **escrit amb paraules** i amb
 * l'enllaç al bloc que l'explica. És un índex amb números, no un resum: **no
 * hi ha cap nota, cap mitjana de mitjanes i cap veredicte**. Un resum que
 * digués si el poble està bé o malament seria exactament el que aquesta fitxa
 * no fa enlloc.
 *
 * Les cinc són les que diuen alguna cosa a qui no és tècnic: què gasta per
 * habitant, què deu, què paga la gent, qui va anar a votar i qui mana i des
 * de quan. «Òrgans de govern» i «portal de transparència» hi eren abans i no
 * volen dir res sense el bloc que els explica: es queden a «Què costa el
 * govern» i a «Què en sabem». I la comparació va en paraules —«més que 7 de
 * cada 10 dels de la seva mida»— perquè una barra sola no és una dada
 * llegible.
 *
 * Cap xifra no és nova: totes surten dels blocs de sota, calculades allà
 * mateix. Si una no hi és, la pastilla no hi surt; no s'omple amb res. Amb
 * menys de tres, no hi ha ullada.
 */
function renderUllada(
  data: RadiografiaData,
  medianes?: MedianesMunicipi,
  colorPer: (sigles: string | null) => string = () => "#8b8b8b",
): string {
  /**
   * `ranquing` és l'id del rànquing dels 947 on surt aquesta mateixa xifra,
   * quan n'hi ha un. Només el tenen les que la pàgina de rànquings calcula
   * amb la mateixa definició: el rebut d'IBI, el preu de l'aigua i la
   * participació. La despesa i el deute per habitant no en tenen —cap
   * rànquing els ordena— i no se'ls inventa cap enllaç.
   */
  type Pastilla = {
    etq: string; xifra: string; peu: string; part: number | null; on: string; tema: string;
    ranquing?: RanquingId;
    /**
     * L'etiqueta que surt en passar-hi per sobre (`GRAFICS_JS`): la xifra amb
     * l'any, la mediana dels de la seva mida i d'on surt. La tessel·la ja diu
     * la comparació en paraules; l'etiqueta hi posa la xifra exacta i la
     * font, que al peu no hi caben. La de sigles no en porta: no és una xifra.
     */
    etiqueta?: DadaEtiqueta | null;
  };
  const pastilles: Pastilla[] = [];
  const delMig = "el poble del mig de la seva mida";
  /** «els de la seva mida: mediana 1.050 € (23 municipis)», amb quants quan se sap. */
  const elsSeus = (mediana: string, quants: number | null | undefined): { etq: string; valor: string } => ({
    etq: "els de la seva mida",
    valor: `mediana ${mediana}${quants ? ` (${number(quants)} municipis)` : ""}`,
  });

  // 1. El que gasta per habitant, amb la mediana del grup en euros de diferència.
  const gasta = despesaPerHabitant(data.despesaProgrames, data.spending);
  if (gasta) {
    const ref = gasta.referencia;
    const dif = ref ? Math.round(gasta.perHabitant - ref.mediana) : null;
    pastilles.push({
      etq: "Gasta per habitant",
      xifra: `${number(Math.round(gasta.perHabitant))} €`,
      // La marca del mig és la mediana: la barra plena són dues medianes.
      part: ref ? Math.min(100, (100 * gasta.perHabitant) / (2 * ref.mediana)) : null,
      peu:
        dif === null
          ? `liquidat el ${gasta.any}`
          : dif === 0
            ? `com ${delMig}`
            : `${number(Math.abs(dif))} € ${dif > 0 ? "més" : "menys"} que ${delMig}`,
      on: "#diners",
      tema: "fiscalitat",
      etiqueta: {
        nom: "Gasta per habitant",
        any: gasta.any,
        valor: `${number(Math.round(gasta.perHabitant))} €`,
        extres: ref ? [elsSeus(`${number(Math.round(ref.mediana))} €`, ref.quants)] : null,
        nota: `font: AOC, liquidació del ${gasta.any}`,
      },
    });
  }

  // 2. El que deu per habitant, amb la posició dins del grup dita en paraules.
  const comptes = data.finances;
  const deute = comptes?.indicators.find((i) => i.key === "deute-habitant") ?? null;
  if (comptes && deute && deute.value !== null) {
    const comparacio = comptes.comparison.find((c) => c.key === "deute-habitant") ?? null;
    const p = comparacio?.percentile ?? null;
    pastilles.push({
      etq: "Deu per habitant",
      xifra: formatValue(deute.value, deute.unit),
      // La barra és la posició dins del grup, de qui menys deu a qui més.
      part: p,
      peu:
        p === null
          ? `l'exercici ${comptes.year}`
          : p <= 25
            ? "entre els que menys deuen dels de la seva mida"
            : p >= 75
              ? "entre els que més deuen dels de la seva mida"
              : `més que ${Math.round(p / 10)} de cada 10 dels de la seva mida`,
      on: "#comptes",
      tema: "deute public",
      etiqueta: {
        nom: "Deu per habitant",
        any: comptes.year,
        valor: formatValue(deute.value, deute.unit),
        extres:
          comparacio?.median !== null && comparacio?.median !== undefined
            ? [elsSeus(formatValue(comparacio.median, deute.unit), comparacio.groupSize)]
            : null,
        nota: `font: AOC, exercici ${comptes.year}`,
      },
    });
  }

  // 3. El que paga la gent: el rebut d'IBI quan la variació és atribuïble al
  // ple, i si no, el preu de l'aigua. Un rebut que ha pujat perquè el cadastre
  // ha revalorat no diu res del ple, i la pastilla no l'ha de fer semblar.
  const ibi = data.rebutIbi;
  const aigua = data.preuAigua;
  if (ibi && ibi.publicable && ibi.rebutMitja !== null) {
    pastilles.push({
      etq: "Rebut mitjà d'IBI",
      xifra: `${number(Math.round(ibi.rebutMitja))} €`,
      part: ibi.comparacio?.percentil ?? null,
      peu: ibi.comparacio
        ? `el més habitual als de la seva mida són ${number(Math.round(ibi.comparacio.mediana))} €`
        : `l'any, el ${ibi.darrerAny}`,
      on: "#que-paga",
      tema: "fiscalitat",
      ranquing: "ibi",
      etiqueta: {
        nom: "Rebut mitjà d'IBI",
        any: ibi.darrerAny,
        valor: `${number(Math.round(ibi.rebutMitja))} €`,
        extres: ibi.comparacio ? [elsSeus(`${number(Math.round(ibi.comparacio.mediana))} €`, ibi.comparacio.grup.ambDada)] : null,
        nota: `font: Idescat, ${ibi.darrerAny}${ibi.provisional ? " (provisional)" : ""}`,
      },
    });
  } else if (aigua && aigua.preu.subministrament !== null) {
    pastilles.push({
      etq: "Paga per l'aigua",
      xifra: `${decimal(aigua.preu.subministrament, 2)} €`,
      part: aigua.comparacio?.percentil ?? null,
      peu: aigua.comparacio
        ? `per m³ · el més habitual als de la seva mida són ${decimal(aigua.comparacio.mediana, 2)} €`
        : `per metre cúbic, el ${aigua.darrerAny}`,
      on: "#que-paga",
      tema: "medi ambient",
      ranquing: "aigua",
      etiqueta: {
        nom: "Paga per l'aigua",
        any: aigua.darrerAny,
        valor: `${decimal(aigua.preu.subministrament, 2)} €/m³`,
        extres: aigua.comparacio
          ? [elsSeus(`${decimal(aigua.comparacio.mediana, 2)} €/m³`, aigua.comparacio.grup.ambDada)]
          : null,
        nota: `font: ACA, ${aigua.darrerAny}`,
      },
    });
  }

  // 4. Qui va anar a votar, contra la mediana en punts.
  const votar = data.participation.find((r) => r.electionId === "M20231");
  if (votar?.censusSize && votar.voters !== null) {
    const pct = (100 * votar.voters) / votar.censusSize;
    const m = medianes?.participacio["M20231"] ?? null;
    const dif = m ? Math.round(10 * (pct - m.mediana)) / 10 : null;
    pastilles.push({
      etq: "Va anar a votar",
      xifra: percent(pct),
      part: Math.min(100, pct),
      peu:
        dif === null
          ? "el 2023"
          : dif === 0
            ? `el 2023, com ${delMig}`
            : `${decimal(Math.abs(dif), 1)} punts ${dif > 0 ? "més" : "menys"} que ${delMig}`,
      on: "#participacio",
      tema: "participació",
      ranquing: "participacio",
      etiqueta: {
        nom: "Va anar a votar",
        any: 2023,
        valor: percent(pct),
        extres: m ? [elsSeus(percent(m.mediana), m.quants)] : null,
        nota: "font: Generalitat, municipals del 2023",
      },
    });
  }

  // 5. Qui mana i des de quan. La pastilla de sigles porta a la pàgina del
  // partit, com a tot el web; el «des de» surt de la ratxa, i quan la ratxa no
  // hi és no s'inventa cap any.
  const government = data.government;
  if (government && (government.mayorSigles || government.winnerSigles)) {
    const sigles = government.mayorSigles ?? government.winnerSigles;
    const ratxa = data.continuitat?.partit ?? null;
    const desDe =
      ratxa && ratxa.anys > 0
        ? ratxa.legislatures <= 1
          ? `des del ${ratxa.desDeAny}, primera legislatura`
          : `des del ${ratxa.desDeAny} · ${number(ratxa.legislatures)} legislatures`
        : "";
    pastilles.push({
      etq: "Mana des de",
      // Sense enllaç a posta: la tessel·la sencera ja és un <a> cap a #ple, i
      // un enllaç dins d'un enllaç no és HTML vàlid —el navegador el reparteix
      // com pot i el xip acabava vestit amb l'estil de la tessel·la, gegant.
      xifra: `${sigla(sigles, { color: colorPer(sigles) })}${desDe ? ` <small class="des-de">${desDe}</small>` : ""}`,
      part: null,
      peu: government.winnerGoverns === false ? "no va guanyar: hi va haver pacte" : "la llista més votada",
      on: "#ple",
      tema: "el ple",
    });
  }

  if (pastilles.length < 3) return "";
  // «cinc» és la classe que posa les cinc pastilles en una fila a partir de
  // 900 px de contenidor, en 3+2 fins a 600 i en 2+2+1 a sota. «.ullada» a
  // seques la comparteixen la comarca i l'AMB.
  return `<section class="ullada cinc" aria-label="El poble en cinc xifres">
  <ul>${pastilles
    .map(
      (p) => `<li><a href="${p.on}"${
        // La tessel·la sencera rep l'etiqueta flotant, com qualsevol punt amb
        // `data-valor`; el `title` és la mateixa frase per a qui no té script.
        p.etiqueta ? `${atributsEtiqueta(p.etiqueta)} title="${escape(textEtiqueta(p.etiqueta))}"` : ""
      }>
      <span class="dibuix" aria-hidden="true">${icona(p.tema, true)}</span>
      <span class="etq">${escape(p.etq)}</span>
      <span class="xifra">${p.xifra}</span>
      ${
        // La barra hi va SEMPRE, encara que sigui buida. Ometre-la quan no hi
        // ha percentil treia una fila de la graella només a algunes pastilles,
        // i llavors el peu d'aquelles quedava cinc píxels més amunt que el de
        // la del costat: era el descuadre de la graella de sis xifres, i no es
        // veia d'on venia perquè el que faltava no es veu.
        p.part === null
          ? `<span class="on buida" aria-hidden="true"></span>`
          : `<span class="on"><i style="--w:${Math.max(0, Math.min(100, p.part)).toFixed(0)}%"></i></span>`
      }
      <span class="peu">${escape(p.peu)}</span>
    </a>${
      // Fora de la tessel·la, que ja és un enllaç sencer: un <a> dins d'un <a>
      // no és HTML vàlid. Va sota, a la dreta, i el CSS («.entre-947») el
      // pinta com un peu més i no com una segona targeta.
      p.ranquing ? entreEls947(p.ranquing) : ""
    }</li>`,
    )
    .join("")}</ul>
</section>`;
}

/**
 * On cau entre els seus: deu xifres, cadascuna amb la posició dins del grup.
 *
 * Les comparacions ja hi eren, però escampades: l'ullada diu «el més habitual
 * als de la seva mida», les sèries porten la banda del grup, «Com ha anat el
 * mandat» compara el canvi amb el dels seus i cada bloc té la seva mediana.
 * Ningú no veia d'un cop d'ull on cau el municipi. Aquest bloc és el resum, i
 * les peces de sota, el detall: no en treu cap, i cada fila hi porta.
 *
 * La llista és **fixa**: deu indicadors que tenen mediana del grup i percentil
 * calculats per les feines, sempre en el mateix ordre, i el que falta diu
 * «sense dada» en comptes de desaparèixer. Si les files es moguessin segons
 * què hi ha, dues fitxes no es podrien llegir de costat.
 *
 * La barra va del municipi més baix del grup al més alt, la ratlla del mig és
 * la mediana i el punt de coral és aquest municipi: el mateix «tu ets aquí»
 * dels regles de la fitxa. **Cap barra no diu si és bo o dolent**: un deute
 * alt pot ser una piscina nova, i un rebut alt, un servei més. La frase diu
 * «més alt que el 74 %» i mai «millor» ni «pitjor».
 *
 * La despesa per habitant no hi és, i no és un descuit: J8 desa la mediana
 * del total però no el percentil (vegeu `DespesaProgramesMetric.medianaGrupTotal`),
 * i pintar-hi un punt calculat d'una altra manera seria dibuixar una posició
 * que ningú no ha mesurat. El dia que arribi, és una entrada més a la llista.
 */
type FilaComparat = {
  etq: string;
  /** L'any de la xifra: va al costat de l'etiqueta i a l'etiqueta del punt. */
  any: number | string | null;
  /** D'on surt, en una paraula. Amb enllaç quan la llicència obliga a posar-lo. */
  font: string;
  fontHref?: string;
  /** L'àncora del bloc que en dona el detall. */
  on: string;
  valor: number | null;
  format: (v: number) => string;
  /** De 0 (el més baix del grup) a 100 (el més alt), com el dona `percentileOf`. */
  percentil: number | null;
  mediana: number | null;
  /** Quants municipis del grup tenen la dada: el percentil és entre aquests. */
  quants: number | null;
  /** Context que l'ajuntament no decideix: es diu a la fila, no s'amaga. */
  context?: boolean;
  /**
   * El municipi més baix i el més alt del grup, quan la fila els sap. Avui
   * només els saben les files que reben tots els valors del grup (la
   * participació i les dones al ple, de `medianes.ts`); les altres porten la
   * mediana i el percentil i prou, i a l'etiqueta hi va només la posició.
   */
  extrems?: { minim: number; maxim: number } | null;
  /**
   * Per què no hi ha xifra, quan no és que no en tinguem cap: «massa poques
   * licitacions…». Sense, la fila diu «d'aquest municipi no en tenim la xifra».
   */
  motiuSenseDada?: string;
};

/**
 * La posició dins del grup, dita del municipi estant: «més alt que el 74 %»
 * i mai «millor». Als extrems el percentil de rang mitjà pot arrodonir a 0 o a
 * 100, i «més alt que el 100 %» seria fals: allà es diu que és el més alt.
 * `dels` és com s'anomena el grup: llarg a la frase de la fila, curt a l'etiqueta.
 */
function posicioEntre(percentil: number, dels: string): string {
  return percentil >= 100
    ? `el més alt ${dels}`
    : percentil <= 0
      ? `el més baix ${dels}`
      : percentil === 50
        ? `just al mig ${dels}`
        : percentil > 50
          ? `més alt que el ${percentil} % ${dels}`
          : `més baix que el ${100 - percentil} % ${dels}`;
}

/**
 * La posició dins del grup, en una frase neutra.
 *
 * «Més alt que el 74 %» i no «millor»: la fitxa no dona veredictes enlloc, i
 * aquest bloc, que els ensenya tots junts, és on més fàcil seria colar-ne un.
 * Als extrems el percentil de rang mitjà pot arrodonir a 0 o a 100, i «més
 * alt que el 100 %» seria fals: allà es diu que és el més alt del grup.
 */
function fraseComparat(percentil: number, quants: number | null, mediana: string): string {
  return `${posicioDe(percentil, quants)} · el del mig, ${mediana}`;
}

/**
 * La posició comptada en municipis: «més alt que 13 de 24».
 *
 * «Més alt que el 56 % dels 24 municipis de la seva mida» repetit deu vegades
 * era una frase de tècnic, i el denominador ja el diu una vegada l'entrada del
 * bloc. Comptat en municipis s'entén sense saber què és un percentil. El
 * percentil de les feines és de rang mitjà (el municipi compta mig per sota
 * d'ell mateix), i per això se'n treu el mig abans d'arrodonir: el 14è de 24
 * té un percentil 56 i en deixa 13 per sota. Mai no pot deixar-ne per sota
 * tants com en té el grup, perquè ell n'és un. Sense el recompte del grup es
 * diu en tant per cent, com abans.
 */
function posicioDe(percentil: number, quants: number | null): string {
  if (quants === null || quants < 2) return posicioEntre(percentil, "dels de la seva mida");
  const q = number(quants);
  if (percentil >= 100) return `el més alt dels ${q}`;
  if (percentil <= 0) return `el més baix dels ${q}`;
  if (percentil === 50) return `just al mig dels ${q}`;
  const per = (p: number): number => Math.max(1, Math.min(quants - 1, Math.round((p * quants) / 100 - 0.5)));
  return percentil > 50 ? `més alt que ${number(per(percentil))} de ${q}` : `més baix que ${number(per(100 - percentil))} de ${q}`;
}

/** La mateixa posició, per a l'etiqueta del punt: és la mateixa frase que la fila. */
const posicioCurta = (percentil: number, quants: number | null): string =>
  quants === null ? posicioEntre(percentil, "del grup") : posicioDe(percentil, quants);

/** El més baix i el més alt d'un grup del qual tenim tots els valors. */
function extremsDe(grup: MedianaGrup | null): { minim: number; maxim: number } | null {
  if (!grup || grup.valors.length === 0) return null;
  return { minim: Math.min(...grup.valors), maxim: Math.max(...grup.valors) };
}

function filesComparat(data: RadiografiaData, medianes?: MedianesMunicipi): FilaComparat[] {
  const euros = (v: number): string => `${number(Math.round(v))} €`;
  const comptes = data.finances;
  const deLaComparacio = (key: string): PeerComparison | null =>
    comptes?.comparison.find((c) => c.key === key) ?? null;
  /*
   * Als grups petits (menys de trenta municipis: les ciutats grans) finances.ts
   * no publica percentil sinó posició —«el 7è de 24»—, i la barra es quedava
   * buida just als municipis on més gent la mira. La posició es converteix
   * al mateix eix (0 = el més baix del grup, 100 = el més alt) amb el rang
   * mitjà, que és el que fa `percentileOf` als grups grans: el primer de 24
   * cau al 2 %, l'últim al 98 %. Quan la posició és «millor» per ser baixa
   * (deute, dies de pagament) el primer és el més baix; a l'estalvi, el més
   * alt. Si tampoc no hi ha posició (un terra de zeros massa poblat), la fila
   * ho diu i prou.
   */
  const delsComptes = (key: string, etq: string, format: (v: number) => string): FilaComparat => {
    const c = deLaComparacio(key);
    const perPosicio =
      c && c.percentile === null && c.rank !== null && c.groupSize > 0
        ? Math.round(((c.rank - 0.5) / c.groupSize) * 100)
        : null;
    const percentil =
      c?.percentile ?? (perPosicio === null ? null : c!.lowerIsBetter ? perPosicio : 100 - perPosicio);
    return {
      etq,
      any: comptes?.year ?? null,
      font: "AOC",
      on: "#comptes",
      valor: c?.value ?? null,
      format,
      percentil,
      mediana: c?.median ?? null,
      quants: c?.groupSize ?? null,
    };
  };

  const ibi = data.rebutIbi;
  const aigua = data.preuAigua;
  const residus = data.residus;
  const contractacio = data.contractacio;
  const renda = data.riquesa?.indicadors.find((i) => i.clau === "rendaNetaPersona") ?? null;
  const votar = data.participation.find((r) => r.electionId === "M20231") ?? null;
  const participacio = medianes?.participacio["M20231"] ?? null;
  const dones = medianes?.donesAlPle ?? null;
  // Només compta com a paritat el que és una paritat de debò: amb menys electes
  // que regidories, el percentatge és d'una llista incompleta (vegeu medianes.ts).
  const donesPct =
    data.parity && avaluaParitat(data.parity, contextParitat(data)).completa ? (data.parity.womenElectedPct ?? null) : null;
  const unaOferta = contractacio?.comparacio ?? null;
  const finestra = contractacio?.finestraDates ?? null;
  const anyFinestra =
    finestra?.desDe && finestra.finsA
      ? `${finestra.desDe.slice(0, 4)}–${finestra.finsA.slice(0, 4)}`
      : (contractacio?.ultimAnyComplet ?? null);

  return [
    delsComptes("deute-habitant", "Deute per habitant", euros),
    delsComptes("estalvi-net", "El que sobra cada any (estalvi net)", percent),
    delsComptes("pmp", "Dies que triga a pagar els proveïdors", (v) => `${number(Math.round(v))} dies`),
    {
      etq: "Rebut mitjà d'IBI",
      any: ibi?.darrerAny ?? null,
      font: "Idescat",
      fontHref: ibi?.font.url,
      on: "#que-paga",
      valor: ibi?.rebutMitja ?? null,
      format: euros,
      percentil: ibi?.comparacio?.percentil ?? null,
      mediana: ibi?.comparacio?.mediana ?? null,
      quants: ibi?.comparacio?.grup.ambDada ?? null,
    },
    {
      etq: "Preu de l'aigua (subministrament)",
      any: aigua?.darrerAny ?? null,
      font: "ACA",
      on: "#que-paga",
      valor: aigua?.preu.subministrament ?? null,
      format: (v) => `${decimal(v, 2)} €/m³`,
      percentil: aigua?.comparacio?.percentil ?? null,
      mediana: aigua?.comparacio?.mediana ?? null,
      quants: aigua?.comparacio?.grup.ambDada ?? null,
    },
    {
      etq: "Recollida selectiva",
      any: residus?.darrerAny ?? null,
      font: "ARC",
      on: "#escombraries",
      valor: residus?.taxaSelectiva ?? null,
      format: percent,
      percentil: residus?.comparacio?.percentil ?? null,
      mediana: residus?.comparacio?.mediana ?? null,
      quants: null,
    },
    {
      etq: "Licitacions amb una sola oferta",
      any: anyFinestra,
      font: "PSCP",
      on: "#contractacio",
      // Amb menys de cinc licitacions amb les ofertes informades J10 no la
      // situa al grup (amb tres, els valors possibles són 0, 33, 67 i 100), i
      // el bloc de contractació ja no l'ensenya. Aquí sortia igualment, com a
      // «0,0 % sense comparació» a quasi dues-centes fitxes: és el mateix
      // criteri que el bloc, i sense posició és «sense dada».
      valor: unaOferta?.percentilUnaOferta != null ? (contractacio?.finestra.unaOfertaPct ?? null) : null,
      motiuSenseDada:
        contractacio && contractacio.finestra.licitacions > 0
          ? contractacio.finestra.licitacionsAmbOfertes === 0
            ? "cap licitació no publica quantes ofertes va rebre"
            : "massa poques licitacions amb les ofertes informades per fer-ne un percentatge"
          : undefined,
      format: percentEnter,
      percentil: unaOferta?.percentilUnaOferta ?? null,
      mediana: unaOferta?.medianaUnaOferta ?? null,
      quants: unaOferta?.municipisUnaOferta ?? null,
    },
    {
      etq: "Participació a les municipals",
      any: 2023,
      font: "Generalitat",
      on: "#participacio",
      valor: votar?.censusSize && votar.voters !== null ? (100 * votar.voters) / votar.censusSize : null,
      format: percent,
      percentil: participacio?.percentil ?? null,
      mediana: participacio?.mediana ?? null,
      quants: participacio?.quants ?? null,
      extrems: extremsDe(participacio),
    },
    {
      etq: "Dones al ple",
      any: 2023,
      font: "Generalitat",
      on: "#dones-i-homes",
      valor: donesPct,
      format: percentEnter,
      percentil: dones?.percentil ?? null,
      mediana: dones?.mediana ?? null,
      quants: dones?.quants ?? null,
      extrems: extremsDe(dones),
    },
    {
      etq: "Renda neta per persona",
      any: renda?.any ?? null,
      font: "INE",
      on: "#qui-hi-viu",
      valor: renda?.valor ?? null,
      format: euros,
      percentil: renda?.comparacio?.percentil ?? null,
      mediana: renda?.comparacio?.mediana ?? null,
      quants: renda?.comparacio?.grup.ambDada ?? null,
      context: true,
    },
  ];
}

/** Amb qui es compara: el primer grup de mida que alguna feina hagi desat. */
function grupComparat(data: RadiografiaData, medianes?: MedianesMunicipi): { etiqueta: string; mida: number } | null {
  if (data.finances?.group) return { etiqueta: data.finances.group.label, mida: data.finances.group.size };
  const ambGrup = data.rebutIbi?.comparacio?.grup ?? data.preuAigua?.comparacio?.grup ?? data.despesaProgrames?.grup;
  if (ambGrup) return { etiqueta: ambGrup.etiqueta, mida: ambGrup.mida };
  if (data.spending?.grup) return { etiqueta: data.spending.grup.etiqueta, mida: data.spending.grup.mida };
  const p = medianes?.participacio["M20231"];
  return p ? { etiqueta: p.etiqueta, mida: p.quants } : null;
}

/**
 * «Els teus veïns»: el mateix poble comparat amb els que toquen de terme, no
 * amb els de la seva mida. És la comparació que la gent fa de debò («a Sant
 * Just paguen menys d'IBI?») i la idea de marca, el veïnat, feta literal.
 *
 * Tres xifres —el deute, l'IBI i la participació— i una tria entre elles feta
 * amb tres botons de ràdio i CSS: sense JavaScript funciona igual, i amb el
 * teclat es canvia amb les fletxes com qualsevol grup de ràdio. Els panells
 * són germans dels botons (i no fills d'un `:has()`), de manera que també va
 * als navegadors que encara no el tenen. Els veïns són els mateixos per a les
 * tres: o hi són tots tres panells o no n'hi ha cap (Llívia no en té cap).
 *
 * La xifra de cada veí surt de la seva fila d'`els947`, que és la mateixa que
 * publica el web per als 947: la fitxa no torna a la base de dades.
 */
export function renderVeinsTria(slug: string, nom: string, files947: readonly Els947Row[] | undefined): string {
  if (!files947 || files947.length === 0) return "";
  const propi = files947.find((r) => r.s === slug) ?? null;
  const tria: { id: string; etq: string; indicador: IndicadorVeins }[] = [
    { id: "deute", etq: "deute", indicador: INDICADORS_VEINS.deute },
    { id: "ibi", etq: "IBI", indicador: INDICADORS_VEINS.ibi },
    { id: "participacio", etq: "participació", indicador: INDICADORS_VEINS.participacio },
  ];
  const adjacencia = adjacenciaMunicipal();
  const panells = tria.map((t) => {
    const sel = veinsAmbXifra(slug, adjacencia, files947, t.indicador);
    return {
      ...t,
      html: renderVeins(
        { slug, nom, valor: propi ? t.indicador.valor(propi) : undefined },
        sel.veins,
        t.indicador,
        { total: sel.total },
      ),
    };
  });
  if (panells.every((p) => p.html === "")) return "";
  return `<div class="fx-veins">
  ${panells
    .map((p, i) => `<input class="fx-veins-ra" type="radio" name="fx-veins" id="fx-veins-${p.id}" value="${p.id}"${i === 0 ? " checked" : ""}>`)
    .join("\n  ")}
  <p class="fx-veins-tria"><span>Compara els veïns per</span>${panells
    .map((p) => `<label for="fx-veins-${p.id}">${escape(p.etq)}</label>`)
    .join("")}</p>
  ${panells.map((p) => `<div class="fx-veins-panell fx-veins-${p.id}">${p.html}</div>`).join("\n  ")}
</div>`;
}

export function renderComparat(data: RadiografiaData, medianes?: MedianesMunicipi, veins = ""): string {
  const files = filesComparat(data, medianes);
  const ambPosicio = files.filter((f) => f.valor !== null && f.percentil !== null && f.mediana !== null);
  const grup = grupComparat(data, medianes);
  // Amb menys de tres posicions no hi ha resum: hi ha dues xifres, i ja les
  // diuen els seus blocs. I sense grup no se sap amb qui es compara.
  // Sense prou posicions no hi ha bloc, però els veïns, si n'hi ha, hi van
  // igualment: no depenen del grup de mida.
  if (ambPosicio.length < 3 || !grup) return veins;

  const fila = (f: FilaComparat): string => {
    const anyIFont = [
      f.any === null ? "" : escape(String(f.any)),
      f.fontHref ? `<a href="${escape(f.fontHref)}" rel="noopener nofollow">${escape(f.font)}</a>` : escape(f.font),
      f.context ? "no ho decideix l'ajuntament" : "",
    ]
      .filter((t) => t !== "")
      .join(" · ");
    const etq = `<span class="etq"><a href="${escape(f.on)}">${escape(f.etq)}</a><small>${anyIFont}</small></span>`;

    if (f.valor === null) {
      return `<li class="sense">${etq}
      <span class="xifra buit">sense dada</span>
      <span class="comparat-barra buida" aria-hidden="true"></span>
      <span class="frase">${escape(f.motiuSenseDada ?? "d'aquest municipi no en tenim la xifra")}</span></li>`;
    }
    const valor = f.format(f.valor);
    if (f.percentil === null || f.mediana === null) {
      return `<li class="sense-posicio">${etq}
      <span class="xifra">${valor}</span>
      <span class="comparat-barra buida" aria-hidden="true"></span>
      <span class="frase">sense comparació amb els de la seva mida</span></li>`;
    }
    const mediana = f.format(f.mediana);
    // L'etiqueta del punt diu el que la fila ja diu, però al costat del punt:
    // la posició en curt, els extrems del grup quan es saben, i d'on surt.
    const dada: DadaEtiqueta = {
      nom: f.etq,
      any: f.any,
      valor,
      mediana,
      extres: [
        { etq: "posició", valor: posicioCurta(f.percentil, f.quants) },
        ...(f.extrems
          ? [
              { etq: "el més baix del grup", valor: f.format(f.extrems.minim) },
              { etq: "el més alt del grup", valor: f.format(f.extrems.maxim) },
            ]
          : []),
      ],
      nota: `font: ${f.font}${f.any === null ? "" : `, ${f.any}`}`,
    };
    // Del 3 % al 97 % i no de 0 a 100: el punt fa 20 px i als extrems mitja
    // marca sortia de la barra; el 50 es queda al 50, que és on hi ha la mediana.
    const on = (3 + 0.94 * Math.max(0, Math.min(100, f.percentil))).toFixed(1);
    return `<li>${etq}
      <span class="xifra">${valor}</span>
      <span class="comparat-barra"><i class="mig"></i><b class="punt" style="--p:${on}%"${atributsEtiqueta(dada)} title="${escape(textEtiqueta(dada))}" tabindex="0"></b></span>
      <span class="frase">${escape(fraseComparat(f.percentil, f.quants, mediana))}</span></li>`;
  };

  /*
   * Quatre files a la vista i la resta plegades. Les de dalt són les primeres
   * que tenen posició, en l'ordre fix de la llista: una fila «sense dada» a la
   * vista ocupava lloc per dir que no hi ha res. Les plegades mantenen el
   * mateix ordre, i el compte del botó és el de la llista sencera, de manera
   * que dues fitxes es continuen llegint de costat.
   */
  const ambPunt = (f: FilaComparat): boolean => f.valor !== null && f.percentil !== null && f.mediana !== null;
  const visibles = files.filter(ambPunt).slice(0, 4);
  const plegades = files.filter((f) => !visibles.includes(f));
  return `<section class="bloc comparat" id="comparat">
  <h2>On cau entre els seus</h2>
  <p class="entrada-bloc">Entre els <b>${number(grup.mida)} municipis de la seva mida</b> (${escape(grup.etiqueta)}), que és el
  que vol dir «els seus» a tota la fitxa. Cada barra va del municipi més baix del grup al més alt; la ratlla és
  el municipi del mig (la mediana) i el punt de coral, aquest municipi.</p>
  <p class="comparat-llegenda" aria-hidden="true"><span>el més baix del grup</span><span>el del mig</span><span>el més alt</span></p>
  <ol class="comparat-files">
    ${visibles.map(fila).join("\n    ")}
  </ol>
  ${
    plegades.length === 0
      ? ""
      : `<details class="fx-mes comparat-mes"><summary>Veure'n les ${number(files.length)}</summary>
  <ol class="comparat-files" start="${visibles.length + 1}">
    ${plegades.map(fila).join("\n    ")}
  </ol>
  </details>`
  }
  ${veins}
  <p class="nota oberta">Les barres diuen on cau, no cap veredicte: un deute alt pot ser una piscina nova, i un
  rebut alt, un servei més. Cada fila porta al bloc que ho explica. Per triar les xifres i els municipis
  hi ha el <a href="${BASE}comparador/?m=${escape(data.municipality.slug)}">comparador</a>, i per veure
  els 947 ordenats, els <a href="${BASE}ranquings/">rànquings</a>.</p>
</section>`;
}

/**
 * El cercador: la casella que treu la fitxa del cul-de-sac.
 *
 * Una fitxa municipal és una pantalla final: quan s'hi arriba, l'única manera
 * d'anar a un altre poble és tornar enrere. I amb vint-i-cinc blocs, trobar on
 * surt el deute demana recórrer-la. La mateixa casella respon les dues coses:
 * escrivint hi surten els municipis que lliguen i els blocs d'aquesta pàgina
 * que lliguen.
 *
 * Sense JavaScript el botó no existeix —el posa el mateix guió que el fa
 * funcionar— i la pàgina es queda com era: l'índex de dalt continua portant a
 * tots els blocs i la portada continua tenint els 947. Cap contingut no depèn
 * d'això.
 *
 * L'índex dels municipis es baixa **la primera vegada que s'obre**, no en
 * carregar la pàgina: són 80 kB que la immensa majoria de qui llegeix una
 * fitxa no necessitarà mai.
 */

/**
 * Quina secció s'està llegint, marcada a l'índex.
 *
 * Amb dotze blocs i l'índex a la vista tota l'estona, saber on ets és la meitat
 * del que fa servible una pàgina llarga; sense això el rail és una llista de
 * dotze enllaços iguals i qui llegeix no en pot deduir res. Va amb
 * «IntersectionObserver» i no amb l'esdeveniment de scroll perquè el navegador
 * ho calcula ell i no hi ha res que es recalculi a cada píxel.
 *
 * És l'únic JavaScript de la fitxa i no hi ha res que en depengui: sense ell
 * l'índex continua sent onze enllaços que porten on diuen. Per això no hi ha
 * cap `try` ni cap avís —si el navegador no té `IntersectionObserver`, la
 * primera línia no troba res i la resta no s'executa— i per això la pàgina
 * continua sent un fitxer autònom que es pot obrir des de qualsevol lloc.
 *
 * Des que la fitxa va per capítols, l'índex agrupa els enllaços sota el nom de
 * cada capítol (`grupIndex`). El seguidor no en sap res: continua mirant els
 * `a[href^='#']` de l'índex, i els noms dels capítols no són enllaços. Només en
 * fan ús la barra «Ets a», que copia l'índex amb els capítols i escriu el del
 * bloc que es llegeix davant del seu nom, i el rail, que si no hi cap sencer
 * es desplaça sol fins a l'enllaç marcat.
 */
const SEGUIDOR_INDEX = `<script>
(function(){
  var enllacos = document.querySelectorAll(".index a[href^='#']");
  if (!enllacos.length || !window.IntersectionObserver) return;
  var per = new Map(), seccions = [];
  enllacos.forEach(function(a){
    var seccio = document.getElementById(decodeURIComponent(a.hash.slice(1)));
    if (seccio) { per.set(seccio, a); seccions.push(seccio); }
  });
  if (!seccions.length) return;
  var visibles = new Set(), actual = null;
  function marca(){
    // La de més amunt de les que es veuen: si n'hi ha dues a la pantalla, la
    // que s'està llegint és la que ja s'ha començat.
    var tria = null;
    for (var i = 0; i < seccions.length; i++) {
      if (visibles.has(seccions[i])) { tria = seccions[i]; break; }
    }
    // Entre dues seccions indexades n'hi ha que no ho són: allà no es desmarca
    // res, perquè apagar-ho tot mentre es llegeix faria pampallugues.
    if (!tria || tria === actual) return;
    if (actual) {
      per.get(actual).removeAttribute("aria-current");
      if (copies.get(per.get(actual))) copies.get(per.get(actual)).removeAttribute("aria-current");
    }
    actual = tria;
    if (actual) {
      per.get(actual).setAttribute("aria-current", "true");
      if (copies.get(per.get(actual))) copies.get(per.get(actual)).setAttribute("aria-current", "true");
      posaNom(per.get(actual));
      alaVista(per.get(actual));
    }
  }
  var indexNav = document.querySelector("nav.index");
  // Al rail de l'escriptori, amb els capítols, l'índex pot ser més alt que la
  // pantalla i té el seu propi desplaçament: l'enllaç marcat s'hi porta a la
  // vista. Només es mou l'índex, mai la pàgina (res de scrollIntoView, que al
  // mòbil, amb l'índex ja passat, faria tornar la pàgina amunt).
  function alaVista(a){
    if (!indexNav || indexNav.scrollHeight <= indexNav.clientHeight + 1) return;
    var n = indexNav.getBoundingClientRect(), r = a.getBoundingClientRect();
    if (r.top < n.top + 24) indexNav.scrollTop -= n.top + 24 - r.top;
    else if (r.bottom > n.bottom - 24) indexNav.scrollTop += r.bottom - n.bottom + 24;
  }
  // La barra «Ets a» del mòbil (vegeu \`barraEtsA\`): el mateix seguidor la
  // manté, i les seves entrades són còpies de les de l'índex, de manera que no
  // hi ha dues llistes que es puguin desquadrar. Sense barra a la pàgina, res.
  var barra = document.querySelector("[data-fx-ets]"), copies = new Map(), posaNom = function(){};
  if (barra) {
    var boto = barra.querySelector("button"), llista = barra.querySelector(".fx-ets-llista"),
        on = barra.querySelector("[data-fx-ets-on]");
    // Es copia l'índex sencer, capítols inclosos, i després s'aparella cada
    // enllaç amb la seva còpia per ordre: les dues llistes tenen els mateixos
    // enllaços en el mateix ordre perquè una és la fotocòpia de l'altra.
    if (indexNav) {
      for (var f = indexNav.firstElementChild; f; f = f.nextElementSibling) llista.appendChild(f.cloneNode(true));
    } else {
      enllacos.forEach(function(a){ llista.appendChild(a.cloneNode(true)); });
    }
    var copiats = llista.querySelectorAll("a[href^='#']");
    enllacos.forEach(function(a, i){
      if (!copiats[i]) return;
      copiats[i].removeAttribute("aria-current");
      copies.set(a, copiats[i]);
    });
    // «Ets a: Els diners · Què paga la gent»: el capítol davant del bloc, que
    // és el que diu a quina altura de la fitxa s'és.
    posaNom = function(a){
      var grup = a.closest ? a.closest("[data-fx-capitol]") : null;
      on.textContent = "Ets a: " + (grup ? grup.getAttribute("data-fx-capitol") + " · " : "");
      var b = document.createElement("b");
      b.textContent = a.textContent.trim();
      on.appendChild(b);
    };
    var obre = function(){
      llista.hidden = false;
      boto.setAttribute("aria-expanded", "true");
      var ara = llista.querySelector("[aria-current]") || llista.querySelector("a");
      if (ara) ara.focus();
    };
    var tanca = function(retorna){
      if (llista.hidden) return;
      llista.hidden = true;
      boto.setAttribute("aria-expanded", "false");
      if (retorna) boto.focus();
    };
    boto.addEventListener("click", function(){
      if (llista.hidden) obre(); else tanca(false);
    });
    llista.addEventListener("click", function(e){ if (e.target.closest("a")) tanca(false); });
    barra.addEventListener("keydown", function(e){ if (e.key === "Escape") tanca(true); });
    // La barra només baixa quan l'índex de pastilles ja ha quedat enrere: mentre
    // es veu, ja fa la mateixa feina i dues llistes a la vegada sobren.
    if (indexNav) new IntersectionObserver(function(es){
      var e = es[0], passat = !e.isIntersecting && e.boundingClientRect.top < 0;
      barra.classList.toggle("fx-avall", passat);
      if (!passat) tanca(false);
    }).observe(indexNav);
    barra.classList.add("fx-viu");
  }
  var mira = new IntersectionObserver(function(entrades){
    entrades.forEach(function(e){
      if (e.isIntersecting) visibles.add(e.target); else visibles.delete(e.target);
    });
    marca();
  // El marge de dalt descompta la franja on un títol ja ha sortit de la
  // pantalla però la secció encara s'està llegint; el de baix evita que la
  // següent es marqui només per haver-hi tret el nas.
  }, { rootMargin: "-15% 0px -70% 0px" });
  seccions.forEach(function(s){ mira.observe(s); });
})();
</script>`;

/**
 * La barra «Ets a: <secció> ▾» del mòbil.
 *
 * A partir de 1.180 px l'índex és un rail fix a l'esquerra i sempre se sap on
 * ets. Per sota, l'índex és una filera de pastilles que surt un cop, a quatre
 * mil píxels del capdamunt, i un cop passada ja no hi és: en una fitxa de
 * quaranta pantalles, qui llegeix al telèfon no sabia mai on era ni com saltar
 * a un altre bloc. Aquesta barra és el rail del mòbil: diu la secció que
 * s'està llegint i, en tocar-la, obre la llista sencera.
 *
 * Tres decisions que la fan innòcua:
 *
 *   · **És fixa i no ocupa lloc al document.** Baixa per sobre del contingut
 *     quan l'índex de pastilles ha quedat enrere, i no empeny res: cap salt de
 *     maquetació en aparèixer ni en desaparèixer.
 *   · **Sense JavaScript no existeix.** El CSS l'amaga fins que el guió li posa
 *     la classe `fx-viu`, i llavors la pàgina és la de sempre, amb el
 *     `nav.index` que porta a tots els blocs. La llista la omple el guió amb
 *     còpies dels enllaços de l'índex: una sola font, cap desquadrament.
 *   · **Es fa servir amb el teclat.** És un `<button>` amb `aria-expanded`, la
 *     llista rep el focus en obrir-se i Esc la tanca i torna al botó.
 */
function barraEtsA(): string {
  return `<div class="fx-ets" data-fx-ets>
  <button type="button" class="fx-ets-boto" aria-expanded="false" aria-controls="fx-ets-llista">
    <span class="fx-ets-on" data-fx-ets-on>Seccions d'aquesta pàgina</span><span class="fx-ets-obre" aria-hidden="true">▾</span>
  </button>
  <nav class="fx-ets-llista" id="fx-ets-llista" aria-label="Salta a una secció" hidden></nav>
</div>`;
}

/**
 * Obre els «Més detall» que amaguen el lloc on porta un enllaç.
 *
 * Els blocs llargs pleguen la segona meitat dins d'un `<details>`, i dins hi
 * queden àncores que altres pàgines enllacen: `#alcaldies` (la portada, la
 * pàgina de trajectòria), `#trajectoria`. Chrome i Firefox ja obren el
 * `<details>` quan s'hi arriba per l'adreça o amb el «cerca a la pàgina»;
 * Safari, no. Aquest guió fa el mateix a tots: en carregar i a cada canvi
 * d'àncora, si el destí és dins d'un plegat, l'obre i hi porta. Sense guió,
 * l'enllaç porta al bloc i el «Més detall» és a la vista, a un toc.
 */
const OBRE_DETALL_JS = `<script>
(function(){
  function obre(){
    var id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    var desti = document.getElementById(id);
    if (!desti || !desti.closest || !desti.closest("details:not([open])")) return;
    for (var d = desti.parentElement; d; d = d.parentElement) if (d.tagName === "DETAILS") d.open = true;
    desti.scrollIntoView();
  }
  window.addEventListener("hashchange", obre);
  obre();
})();
</script>`;

/**
 * Plega la part secundària d'un bloc dins d'un «Més detall».
 *
 * Cada bloc llarg es queda amb el títol, la frase que respon la pregunta i el
 * gràfic principal a la vista; les taules de suport, les notes i la lletra
 * petita van aquí dins. `que` diu en dues o tres paraules què hi ha, perquè
 * un «Més detall» a seques no diu si val la pena obrir-lo.
 *
 * El text plegat continua sent a la pàgina: els cercadors l'indexen, el
 * «cerca a la pàgina» del navegador l'hi troba (i Chrome i Firefox l'obren
 * sols), i `OBRE_DETALL_JS` l'obre quan un enllaç hi porta.
 */
function mesDetall(cos: string, que: readonly string[] = []): string {
  if (cos.trim() === "") return "";
  return `<details class="fx-mes"><summary>Més detall${
    que.length > 0 ? ` <span class="fx-mes-que">${que.map(escape).join(" · ")}</span>` : ""
  }</summary>
  ${cos}
</details>`;
}

/**
 * Separa la «lletra petita» final d'un tros de bloc, per plegar-la a part.
 *
 * Les peces de la fitxa (`renderPleCompacte`, `renderRevenue`…) acaben amb el
 * seu `<details class="nota">`, i és la part que ha d'anar a «Més detall»
 * mentre la resta es queda a la vista. Es busca el ÚLTIM `<details class="nota">`
 * de primer nivell i només si tanca el tros: si n'hi ha un al mig, no es toca,
 * perquè llavors no és la lletra petita del final sinó una part del contingut.
 * La comptabilitat de `<details>` oberts i tancats és el que permet que la
 * lletra petita en porti un a dins sense partir-la pel lloc equivocat.
 */
function treuLletraPetita(html: string): { cos: string; lletra: string } {
  const net = html.trimEnd();
  const marca = '<details class="nota">';
  let on = net.lastIndexOf(marca);
  while (on >= 0) {
    // Del candidat al final hi ha d'haver exactament un <details> obert i tancat
    // al nivell de dalt, i ha d'acabar just al final del tros.
    let fondaria = 0;
    let fi = -1;
    const re = /<details\b|<\/details>/g;
    re.lastIndex = on;
    for (let m = re.exec(net); m; m = re.exec(net)) {
      fondaria += m[0] === "</details>" ? -1 : 1;
      if (fondaria === 0) {
        fi = m.index + m[0].length;
        break;
      }
    }
    if (fi === net.length) return { cos: net.slice(0, on).trimEnd(), lletra: net.slice(on) };
    on = on === 0 ? -1 : net.lastIndexOf(marca, on - 1);
  }
  return { cos: html, lletra: "" };
}

/**
 * El CSS de les peces noves de la fitxa municipal: «En 30 segons», la barra
 * «Ets a» del mòbil, els «Més detall», els noms del ple compacte, la
 * miniatura del mapa al mòbil, les franges dels capítols i l'índex agrupat
 * per capítols.
 *
 * Viu aquí i no a `estil.ts` perquè només el fa servir aquesta pàgina, i amb
 * el prefix `fx-` perquè cap classe no pugui xocar amb les compartides (el peu
 * de la web, les pastilles). Fa servir els tokens de la casa i res més.
 */
const FITXA_CSS = senseComentaris(`
/* En 30 segons: frases, no targetes. Un filet de color a l'esquerra i prou. */
.fx-30{margin:var(--e4) 0 0;padding:var(--e3) var(--e3) var(--e3) calc(var(--e3) + 2px);
  border-left:6px solid var(--menta);background:var(--paper-2);border-radius:0 var(--r-m) var(--r-m) 0}
.fx-30 h2{font-family:var(--display);font-weight:900;font-size:1.15rem;letter-spacing:-.01em;margin:0 0 var(--e2)}
.fx-30 ul{margin:0;padding:0;list-style:none;display:grid;gap:8px}
.fx-30 li{font-size:1rem;line-height:1.45;max-width:70ch}
.fx-30 li .sigla{vertical-align:baseline}

/* Més detall: el resum ja s'ha dit; això és per a qui en vol més. */
.fx-mes{margin:var(--e3) 0 0;border-top:1.5px solid var(--vora)}
.fx-mes > summary{cursor:pointer;display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 10px;min-height:44px;
  padding:12px 0 6px;font-family:var(--display);font-weight:900;font-size:1rem;list-style:none}
.fx-mes > summary::-webkit-details-marker{display:none}
.fx-mes > summary::before{content:"+";display:inline-grid;place-items:center;width:22px;height:22px;flex:none;
  border:2px solid var(--ink);border-radius:50%;font:900 .9rem/1 var(--text);align-self:center}
.fx-mes[open] > summary::before{content:"−"}
.fx-mes > summary:focus-visible{outline:3px solid var(--coral);outline-offset:2px;border-radius:4px}
.fx-mes-que{font-family:var(--text);font-weight:700;font-size:.8rem;color:var(--ink-suau)}
.fx-mes > :not(summary):first-of-type{margin-top:var(--e2)}

/* La barra «Ets a» del mòbil. Fixa, per sobre de tot, i fora del flux. */
.fx-ets{display:none}
@media (max-width:1179px){
  .fx-ets.fx-viu{display:block;position:fixed;top:0;left:0;right:0;z-index:30;background:var(--paper);
    border-bottom:2.5px solid var(--ink);transform:translateY(-105%);visibility:hidden;
    transition:transform .18s ease,visibility 0s linear .18s}
  .fx-ets.fx-viu.fx-avall{transform:none;visibility:visible;transition:transform .18s ease}
  [id]{scroll-margin-top:60px}
}
@media (prefers-reduced-motion:reduce){.fx-ets.fx-viu,.fx-ets.fx-viu.fx-avall{transition:none}}
.fx-ets-boto{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;
  max-width:var(--ample);margin:0 auto;min-height:44px;padding:0 16px;border:0;background:none;color:var(--ink);
  font:800 .86rem/1.2 var(--text);text-align:left;cursor:pointer}
.fx-ets-on{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fx-ets-on b{font-family:var(--display);font-weight:900}
.fx-ets-obre{flex:none;font-size:1rem}
.fx-ets-boto[aria-expanded="true"] .fx-ets-obre{transform:rotate(180deg)}
.fx-ets-boto:focus-visible{outline:3px solid var(--coral);outline-offset:-3px}
.fx-ets-llista{max-width:var(--ample);margin:0 auto;max-height:calc(100vh - 48px);overflow:auto;
  padding:0 16px 12px;border-top:1.5px solid var(--vora);overscroll-behavior:contain}
.fx-ets-llista a{display:flex;align-items:center;min-height:44px;font-weight:800;font-size:.92rem;
  text-decoration:none;border-bottom:1px solid var(--vora)}
.fx-ets-llista a[aria-current]{color:var(--coral-text);text-decoration:underline;text-decoration-thickness:2.5px;
  text-underline-offset:5px}
.fx-ets-llista a:focus-visible{outline:3px solid var(--coral);outline-offset:-3px}

/* El ple compacte: el nom curt a la vista, i les inicials mentre la foto arriba. */
.retrats .fx-nom{font-size:.66rem;line-height:1.2;font-weight:700;text-align:center;max-width:100%;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:break-word}
.retrats .alcaldia .fx-nom{font-weight:900}
.fx-cara{position:relative;display:inline-block;border-radius:50%;background:var(--paper-2);line-height:0}
.fx-cara::before{content:attr(data-ini);position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  font:900 .74rem/1 var(--display);color:var(--ink-suau)}
.fx-cara .retrat{position:relative;background:transparent}

/* Els teus veïns: la tria entre tres xifres, amb ràdios i CSS. */
.fx-veins{margin:var(--e4) 0 0;padding-top:var(--e3);border-top:1.5px solid var(--vora)}
.fx-veins-ra{position:absolute;opacity:0;width:1px;height:1px;margin:0}
.fx-veins-tria{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;margin:0 0 var(--e1);font-size:.84rem;font-weight:700}
.fx-veins-tria span{color:var(--ink-suau);margin-right:4px}
.fx-veins-tria label{display:inline-flex;align-items:center;min-height:44px;padding:0 4px;cursor:pointer;font-weight:800;
  text-decoration:underline;text-decoration-thickness:1.5px;text-underline-offset:5px;text-decoration-color:var(--vora)}
.fx-veins-panell{display:none}
.fx-veins-panell .vn{margin-top:0}
#fx-veins-deute:checked ~ .fx-veins-deute,#fx-veins-ibi:checked ~ .fx-veins-ibi,
#fx-veins-participacio:checked ~ .fx-veins-participacio{display:block}
#fx-veins-deute:checked ~ .fx-veins-tria label[for="fx-veins-deute"],
#fx-veins-ibi:checked ~ .fx-veins-tria label[for="fx-veins-ibi"],
#fx-veins-participacio:checked ~ .fx-veins-tria label[for="fx-veins-participacio"]{
  color:var(--coral-text);text-decoration-color:currentColor;text-decoration-thickness:2.5px}
#fx-veins-deute:focus-visible ~ .fx-veins-tria label[for="fx-veins-deute"],
#fx-veins-ibi:focus-visible ~ .fx-veins-tria label[for="fx-veins-ibi"],
#fx-veins-participacio:focus-visible ~ .fx-veins-tria label[for="fx-veins-participacio"]{
  outline:3px solid var(--coral);outline-offset:2px;border-radius:4px}

/* La tira del poble a la portada. */
.fx-tira{margin:var(--e3) 0 0;min-width:0}
.fx-tira-etq{margin:0;font-size:.8rem;font-weight:800;color:var(--ink-suau)}

/* La portada al mòbil: el mapa, miniatura al costat de la línia de dades. La
   línia de dades és sempre la tercera peça (rètol, títol, dades), i per això
   la fila es pot dir pel número. Sense mapa (classe «amb-mapa» absent), la
   portada és la de sempre i la línia de dades fa tota l'amplada. */
@media (max-width:819px){
  .portada.amb-mapa{display:grid;grid-template-columns:minmax(0,1fr) 120px;column-gap:var(--e2);align-items:start}
  .portada.amb-mapa > *{grid-column:1 / -1;min-width:0}
  .portada.amb-mapa > .entrada{grid-column:1;grid-row:3}
  .portada.amb-mapa > .on-es{grid-column:2;grid-row:3;margin:0;max-width:120px;width:120px;align-self:center}
  .portada.amb-mapa > .on-es figcaption{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
}

/* La franja que obre cada capítol: quieta, el nom en gran i els blocs que hi
   ha. Un punt del color del capítol (marca, no veredicte) i prou; el bloc que
   la segueix no porta la ratlla de dalt, perquè la franja ja fa de separació. */
.fx-cap{margin:var(--e4) 0 0;padding:var(--e3);background:var(--paper-2);border:1.5px solid var(--vora);border-radius:var(--r-m)}
.fx-cap-nom{display:flex;align-items:center;gap:12px;margin:0;font-family:var(--display);font-weight:900;
  font-size:clamp(1.55rem,6vw,2.1rem);line-height:1.05;letter-spacing:-.025em}
.fx-cap-nom::before{content:"";flex:none;width:16px;height:16px;border-radius:50%;background:var(--fx-c);border:2px solid var(--ink)}
.fx-cap-qui-mana{--fx-c:var(--lavanda)}
.fx-cap-diners{--fx-c:var(--presec)}
.fx-cap-poble{--fx-c:var(--menta)}
.fx-cap-fonts{--fx-c:var(--coral)}
.fx-cap-que{margin:6px 0 0;max-width:60ch;color:var(--ink-suau);font-size:.98rem;line-height:1.45}
.fx-cap-blocs{list-style:none;margin:var(--e1) 0 0;padding:0;display:flex;flex-wrap:wrap;gap:0 var(--e2)}
.fx-cap-blocs a{display:inline-flex;align-items:center;min-height:44px;font-weight:800;font-size:.9rem;
  text-decoration:underline;text-decoration-thickness:1.5px;text-underline-offset:5px;text-decoration-color:var(--vora)}
.fx-cap-blocs a:hover{text-decoration-color:currentColor}
.fx-cap + .bloc{border-top:0}
@media (max-width:1179px){.fx-cap-primer .fx-cap-blocs{display:none}}

/* L'índex per capítols. Al mòbil, una fila de pastilles per capítol que es
   desplaça de costat: quatre files curtes en lloc d'un núvol de mitja pantalla.
   Al rail, el nom de cada capítol sobre els seus blocs, i el rail es desplaça
   sol si no hi cap (el guió hi porta l'enllaç marcat). */
.fx-idx-grup{min-width:0}
.fx-idx-nom{margin:0;font-family:var(--display);font-weight:900;font-size:.92rem;letter-spacing:-.01em}
@media (max-width:1179px){
  nav.index .fx-idx-grup{flex:1 1 100%;margin-top:var(--e1)}
  nav.index .fx-idx-nom{margin:0 0 6px}
  nav.index .fx-idx-blocs{display:flex;gap:0 18px;overflow-x:auto;padding:2px 0 6px;scrollbar-width:thin;overscroll-behavior-x:contain}
  nav.index .fx-idx-blocs a{flex:none;white-space:nowrap}
  nav.index .fx-idx-blocs a:focus-visible{outline-offset:-4px}
}
@media (min-width:1180px){
  nav.index{flex-wrap:nowrap;max-height:calc(100vh - 2 * var(--e3));overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin}
  nav.index > *{flex:none}
  nav.index .fx-idx-nom{margin:var(--e2) 0 2px;padding-left:14px;font-size:.8rem;color:var(--ink-suau)}
  nav.index .fx-idx-blocs{display:flex;flex-direction:column}
  nav.index .fx-idx-blocs a{padding-top:6px;padding-bottom:6px}
  nav.index a:focus-visible{outline-offset:-3px}
}
/* La mateixa agrupació dins la llista de la barra «Ets a». */
.fx-ets-llista .fx-idx-nom{margin:var(--e2) 0 0;font-size:.82rem;color:var(--ink-suau)}
.fx-ets-llista .fx-idx-blocs{display:block}
`);

/**
 * Dones i homes: el denominador ha de ser el ple.
 *
 * El percentatge de dones al ple només es publica si la font en dona tants
 * d'electes com regidories té el ple. A Abella de la Conca, que en té cinc, el
 * conjunt de candidatures de la Generalitat només porta tres persones i en
 * marca dues com a electes: el «50 % de dones al ple» que hi sortia era una de
 * dues, no dues i mitja de cinc. Passa a 213 dels 947 municipis i, entre ells,
 * als 152 plens de cinc regidories sense excepció. Una xifra així no es
 * corregeix arrodonint-la: o es diu de quantes persones parla, o no es diu.
 */
/** El que la paritat necessita saber del 2023: regidories, candidatures i sistema. */
function contextParitat(data: RadiografiaData): { seients2023: number | null; llistes2023: number | null; llistesObertes: boolean } {
  const r = data.results.M20231;
  return {
    seients2023: r?.seats ?? data.government?.totalSeats ?? null,
    llistes2023: r && r.candidatures.length > 0 ? r.candidatures.length : null,
    llistesObertes: !/tancades/i.test(data.municipality.electoralSystem ?? ""),
  };
}

/**
 * Què se'n pot dir, de les tres xifres de paritat, amb el que porta la font.
 *
 * El denominador del ple són les regidories que es van elegir el 2023, i no
 * `expectedElected`: J-mètriques el calcula amb el padró d'ara
 * (`councilSeats`), i a la cinquantena de municipis que han canviat de mida
 * —Barcelona en tenia 41 i amb el padró del 2025 en tocarien 43— deixava el
 * ple sencer per incomplet. Sense el recompte del 2023 es fa com abans.
 *
 * Les llistes tenen el mateix problema que el ple, i més amagat: a 212
 * municipis el conjunt de candidatures només porta dues o tres persones, i el
 * «0 % de dones a les llistes» que hi sortia era el d'aquelles dues o tres.
 * Amb llistes tancades cada candidatura porta tants titulars com regidories,
 * i per això es pot saber si hi són totes; amb llistes obertes (fins a 250
 * habitants) una candidatura pot dur-ne menys, i llavors només es dona per
 * bona si el ple quadra i hi ha, com a mínim, tantes persones com escons.
 * Els caps de llista, igual: sense cap cap marcat («0 de 0») o amb un
 * nombre que no és el de candidatures que es van presentar, no es diu res.
 */
export function avaluaParitat(
  paritat: ParityMetric,
  context: { seients2023?: number | null; llistes2023?: number | null; llistesObertes?: boolean } = {},
): { completa: boolean; escons: number; llistesSenceres: boolean; llistesEsperades: number | null; capsFiables: boolean } {
  const seients = context.seients2023 && context.seients2023 > 0 ? context.seients2023 : null;
  const escons = seients ?? paritat.expectedElected ?? paritat.elected;
  const completa =
    paritat.elected > 0 &&
    paritat.elected === escons &&
    (seients !== null || paritat.complet !== false);
  const llistes = context.llistes2023 && context.llistes2023 > 0 ? context.llistes2023 : null;
  const nombreDeLlistes = llistes ?? (paritat.heads > 0 ? paritat.heads : null);
  const llistesEsperades = !context.llistesObertes && nombreDeLlistes !== null ? nombreDeLlistes * escons : null;
  const llistesSenceres =
    paritat.candidates > 0 &&
    paritat.womenCandidatesPct !== null &&
    completa &&
    (llistesEsperades !== null ? paritat.candidates >= llistesEsperades : paritat.candidates >= escons);
  const capsFiables = paritat.heads > 0 && (llistes === null || paritat.heads === llistes);
  return { completa, escons, llistesSenceres, llistesEsperades, capsFiables };
}

function renderParitat(
  paritat: ParityMetric,
  medianes?: MedianesMunicipi,
  context: { seients2023?: number | null; llistes2023?: number | null; llistesObertes?: boolean } = {},
): string {
  const { completa, escons, llistesSenceres, llistesEsperades, capsFiables } = avaluaParitat(paritat, context);
  const persones = (n: number): string => `${number(n)} ${n === 1 ? "persona" : "persones"}`;
  const llistesHtml = llistesSenceres
    ? `<li><span class="etq">De dones a les llistes</span>
      <span class="gran">${paritat.womenCandidatesPct} %</span>
      ${reglePercentatge(paritat.womenCandidatesPct!, null, false)}
      <span class="secundari">${number(paritat.womenCandidates)} de ${number(paritat.candidates)} candidatures</span></li>`
    : `<li><span class="etq">De dones a les llistes</span>
      <span class="gran">Sense dada</span>
      <span class="secundari">${
        paritat.candidates === 0
          ? "el conjunt de candidatures no en dona cap persona"
          : llistesEsperades !== null && paritat.candidates < llistesEsperades
            ? `el conjunt de candidatures només en dona ${persones(paritat.candidates)} de les ${number(llistesEsperades)}
               que portaven les llistes, i un percentatge sobre aquestes no seria el de les llistes`
            : `el conjunt de candidatures només en dona ${persones(paritat.candidates)}, i amb la llista d'electes
               incompleta no se sap si hi són totes`
      }</span></li>`;
  const capsHtml = capsFiables
    ? `<li><span class="etq">Caps de llista</span>
      <span class="gran">${number(paritat.womenHeads)} de ${number(paritat.heads)}</span>
      ${reglePercentatge((100 * paritat.womenHeads) / paritat.heads, null, false)}
      <span class="secundari">eren dones</span></li>`
    : `<li><span class="etq">Caps de llista</span>
      <span class="gran">Sense dada</span>
      <span class="secundari">${
        paritat.heads === 0
          ? "el conjunt de candidatures no marca qui encapçalava cada llista"
          : `el conjunt de candidatures en marca ${number(paritat.heads)} i es van presentar
             ${number(context.llistes2023 ?? 0)} ${context.llistes2023 === 1 ? "llista" : "llistes"}`
      }</span></li>`;
  return `<ul class="paritat">
    ${completa ? `<li><span class="etq">De dones al ple</span>
      <span class="gran">${paritat.womenElectedPct ?? "—"} %</span>
      ${paritat.womenElectedPct === null ? "" : reglePercentatge(paritat.womenElectedPct, medianes?.donesAlPle?.mediana ?? null, true)}
      ${paritat.womenElectedPct === null ? "" : fraseMediana(paritat.womenElectedPct, medianes?.donesAlPle ?? null, "punts")}
      <span class="secundari">${paritat.womenElected} de ${paritat.elected} regidories</span></li>`
    : `<li><span class="etq">De dones al ple</span>
      <span class="gran">Sense dada</span>
      <span class="secundari">${
        paritat.elected === 0
          ? `el conjunt de candidatures no marca cap persona electa de les ${number(escons)} regidories d'aquest ple`
          : `el conjunt de candidatures només en dona ${number(paritat.elected)}
      ${paritat.elected === 1 ? "persona electa" : "persones electes"} de les ${number(escons)} regidories
      d'aquest ple, i un percentatge sobre aquestes ${paritat.elected === 1 ? "una" : number(paritat.elected)}
      no seria el del ple`
      }</span></li>`}
    ${llistesHtml}
    ${capsHtml}
  </ul>
  ${
    completa && paritat.womenElectedPct !== null && medianes?.donesAlPle
      ? distribucioGrup(medianes.donesAlPle.valors, paritat.womenElectedPct, {
          format: percentEnter,
          titol: "Dones al ple",
          grup: medianes.donesAlPle.etiqueta,
          unitat: "de dones al ple",
        })
      : ""
  }
  <details class="nota"><summary>La lletra petita</summary>${
    completa
      ? "La mediana és la del ple, que és l'única de les tres xifres que es pot comparar amb la resta de municipis: de les llistes i dels caps de llista no en tenim el recompte de tothom."
      : "La mediana del grup es calcula només amb els municipis dels quals tenim la llista d'electes sencera, i per això aquest no hi entra ni s'hi compara."
  } La llei electoral demana llistes equilibrades —ni més d'un 60 % ni
  menys d'un 40 % de cap sexe—, i això és de les llistes, no del resultat.</details>`;
}

// ------------------------------------------------- per sobre de l'ajuntament

/**
 * El consell comarcal i la diputació d'un municipi, trets de la llista de
 * `loadEns`.
 *
 * Es busquen pel municipi mateix (`municipis` de cada ens), que és el que diu
 * el registre, i el consell, si no hi és, per la comarca: un municipi pot no
 * sortir a la llista d'un ens per un buit de la font i continuar sent de la
 * seva comarca. És la mateixa pregunta que respon `ensDeMunicipi` del
 * carregador; aquí es fa amb el que ja arriba a la pàgina perquè la fitxa no
 * depengui de res més.
 */
export function ensDelMunicipi(
  ens: readonly DadesEns[],
  slug: string,
  comarca: string | null,
): { consell: DadesEns | null; diputacio: DadesEns | null } {
  const hiEs = (e: DadesEns): boolean => e.municipis.some((x) => x.slug === slug);
  const slugComarca = comarca ? slugify(comarca) : null;
  const consell =
    ens.find((e) => e.tipus === "consell" && hiEs(e)) ??
    (slugComarca ? ens.find((e) => e.tipus === "consell" && (e.comarca?.slug ?? e.slug) === slugComarca) : undefined) ??
    null;
  const diputacio = ens.find((e) => e.tipus === "diputacio" && hiEs(e)) ?? null;
  return { consell, diputacio };
}

/** «12,3 €/hab.»: amb un decimal per sota de cent, que és on el decimal diu alguna cosa. */
const eurosPerHabitant = (n: number): string =>
  `${n.toLocaleString("ca-ES", { maximumFractionDigits: n < 100 ? 1 : 0 })} €/hab.`;

/**
 * El que un ens va concedir a l'ajuntament, segons el RAISC, en una frase.
 *
 * L'any és el més recent que té import d'aquest municipi, i es diu: no es
 * pot llegir «li va concedir» sense saber quan. A J39, «res registrat» és un
 * `null` i no un zero: un buit (`null` a tots els anys) no surt, perquè no és
 * cap «no li va concedir res». Un 0 de debò només apareix quan les
 * concessions i els reintegraments d'aquell any s'anul·len entre ells, i
 * s'escriu així, amb el motiu al costat: llegit a seques semblaria que l'ens
 * no li va donar res, i no és el que diu la font. **Mai no se suma amb el que
 * doni l'altre ens**: cada ens té la seva frase.
 */
function concessioDe(e: DadesEns, slug: string, poblacio: number | null): string {
  const s = e.subvencions;
  const fila = s?.perMunicipi.find((p) => p.slug === slug);
  if (!s || !fila) return "";
  let i = fila.imports.length - 1;
  while (i >= 0 && (fila.imports[i] === null || fila.imports[i] === undefined)) i -= 1;
  const any = s.anys[i];
  const import_ = i >= 0 ? fila.imports[i] : null;
  if (import_ === null || import_ === undefined || any === undefined) return "";
  const qui = e.tipus === "diputacio" ? "La Diputació" : "El Consell";
  const font = `<span class="ens-font">Font: ${
    s.font.url ? `<a href="${escape(s.font.url)}" rel="noopener nofollow">${escape(s.font.nom)}</a>` : escape(s.font.nom)
  }, concessions a l'ajuntament el ${any}.</span>`;
  if (import_ === 0) {
    return `<p>${qui}: <b>0 €</b> el ${any}, perquè les concessions i els reintegraments d'aquell any
    s'anul·len entre ells. ${font}</p>`;
  }
  const habitants = fila.poblacio ?? poblacio;
  const perHab = habitants && habitants > 0 ? ` (${eurosPerHabitant(import_ / habitants)})` : "";
  return `<p>${qui} li va concedir <b>${eurosSencers(import_)}</b> el ${any}${perHab}. ${font}</p>`;
}

/**
 * Qui del ple d'aquest municipi seu a l'ens, amb el nom enllaçat a la seva
 * fitxa si és únic.
 *
 * El «ningú d'aquí no hi seu» només s'escriu quan es pot afirmar: quan el
 * recompte de l'ens per a aquest municipi és un 0 de debò (`MunicipiEns.membres`).
 * Si és `null` és que a algun membre de l'ens no se li sap el municipi, i
 * potser és d'aquí: llavors la frase no surt, que és el que toca amb un buit.
 */
function delPleALens(e: DadesEns, slug: string, municipi: string): string {
  const seus = e.membres.filter((x) => x.municipi?.slug === slug);
  if (seus.length === 0) {
    const recompte = e.municipis.find((x) => x.slug === slug)?.membres;
    return recompte === 0 ? `<p>Cap regidor ni regidora ${de(escape(municipi))} no hi seu.</p>` : "";
  }
  const noms = seus
    .map((x) => {
      // Un escó que la font dona amb partit i sense nom (`NOM_NO_PUBLICAT` de
      // la J38) es diu pel que és, i el partit ja va al nom.
      if (esSeientSenseNom(x.nom)) {
        return `<li>Seient de ${escape(siglesConegudes(x.partit) ?? "partit no consta")} <span class="ens-detall">la font no en dona el nom</span></li>`;
      }
      // `adreca` és relativa a `m/<slug>/`, que és on és aquesta pàgina.
      const nom = x.adreca ? `<a href="${escape(x.adreca)}">${escape(x.nom)}</a>` : escape(x.nom);
      const detall = [x.carrec, siglesConegudes(x.partit)].filter((t): t is string => !!t && t.trim() !== "").map(escape).join(", ");
      return `<li>${nom}${detall ? ` <span class="ens-detall">${detall}</span>` : ""}</li>`;
    })
    .join("");
  return `<p>${seus.length === 1 ? "Hi seu una persona" : `Hi seuen ${seus.length} persones`} del ple ${de(escape(municipi))}:</p>
  <ul class="ens-membres">${noms}</ul>`;
}

/**
 * «Per sobre de l'ajuntament»: el consell comarcal i la diputació del poble.
 *
 * Són els dos governs que no surten a la papereta i que reparteixen diners i
 * serveis entre els ajuntaments. El bloc diu quins són (amb la seva fitxa),
 * qui del ple d'aquí hi seu i què li han concedit, cada ens per separat.
 *
 * Sense `ens` (o amb la llista buida) torna una cadena buida, la secció no
 * existeix i la fitxa queda exactament com era, índex inclòs.
 */
export function renderPerSobre(
  ens: readonly DadesEns[] | undefined,
  municipi: { slug: string; name: string; comarca: string | null; population: number | null },
): string {
  if (!ens || ens.length === 0) return "";
  const { consell, diputacio } = ensDelMunicipi(ens, municipi.slug, municipi.comarca);
  const slugComarca = municipi.comarca ? slugify(municipi.comarca) : null;
  const senseConsell = slugComarca ? SENSE_CONSELL[slugComarca] : undefined;
  if (!consell && !diputacio && !senseConsell) return "";

  // La icona de cada pis (la diputació, el consell) va muda al costat del nom:
  // el nom ja diu què és.
  const targeta = (e: DadesEns, avis = ""): string => `<div class="ens-pis">
    <h3>${icona(e.tipus === "diputacio" ? "diputacio" : "consell comarcal", true)}<a href="${BASE}${escape(adrecaEns(e.tipus, e.slug))}">${escape(e.nom)}</a></h3>
    ${avis}
    <p class="ens-detall">${number(e.seients)} escons${
      e.presidencia ? ` · ${escape(e.presidencia.carrec)}: ${escape(e.presidencia.nom)}` : ""
    }</p>
    ${delPleALens(e, municipi.slug, municipi.name)}
    ${concessioDe(e, municipi.slug, municipi.population)}
  </div>`;

  /*
   * El Lluçanès és comarca des del 2023 però encara no té consell: els
   * regidors que els seus municipis van elegir aquell any van entrar al
   * Consell Comarcal d'Osona, que és on segueixen. Dir «no té consell» a
   * seques seria fals per a qui hi viu: el consell que li toca avui és el
   * d'Osona, i es diu amb la seva fitxa si la tenim.
   */
  const osona =
    slugComarca === "llucanes"
      ? (consell ??
        ens.find((e) => e.tipus === "consell" && (e.comarca?.slug ?? e.slug) === "osona") ??
        null)
      : null;
  const avisLlucanes = (enllac: string): string =>
    `<p>El Lluçanès encara no té consell comarcal propi; els regidors elegits el 2023 en aquests
    municipis van entrar al ${enllac}.</p>`;
  const pisos = [
    slugComarca === "llucanes"
      ? osona
        ? targeta(osona, avisLlucanes(`<a href="${BASE}${escape(adrecaEns(osona.tipus, osona.slug))}">${escape(osona.nom)}</a>`))
        : `<div class="ens-pis"><h3>${icona("consell comarcal", true)}Consell comarcal</h3>${avisLlucanes("Consell Comarcal d'Osona")}</div>`
      : consell
      ? targeta(consell)
      : senseConsell
        ? `<div class="ens-pis"><h3>${icona("consell comarcal", true)}Consell comarcal</h3><p>${senseConsell}</p></div>`
        : "",
    diputacio ? targeta(diputacio) : "",
  ].filter(Boolean);

  return `<p class="entrada-bloc">Dos governs més fan feina per a ${escape(municipi.name)} i no surten a la
  papereta: el consell comarcal i la diputació. Els formen regidors, i els escons es reparteixen
  segons els vots de les municipals.</p>
  <div class="ens-pisos">${pisos.join("")}</div>
  <p class="nota">Cada import és el d'un sol ens i d'un sol any: no se sumen mai entre ells.</p>`;
}

/** Només per a la secció «Per sobre de l'ajuntament», i només quan surt. */
const PER_SOBRE_CSS = `
.ens-pisos{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:var(--e2)}
.ens-pis{border:2px solid var(--ink);border-radius:var(--r-m);padding:var(--e2);background:var(--paper-2)}
.ens-pis h3{margin:0 0 4px;font-size:1.05rem;display:flex;align-items:center;gap:10px}
.ens-pis h3 .icona{width:32px;height:32px;flex:0 0 auto}
.ens-pis h3 a{font-weight:900}
.ens-pis .ens-detall{color:var(--ink-suau);font-size:.85rem}
.ens-pis p{margin:var(--e1) 0 0}
.ens-membres{margin:4px 0 0;padding-left:1.1em}
.ens-membres a{font-weight:800}
.ens-font{display:block;font-size:.8rem;color:var(--ink-suau)}
`;

/**
 * On continua la fitxa: la comarca, l'AMB si hi és, les preguntes o la prova,
 * i el comparador.
 *
 * Eren set targetes de tres línies en un bloc «Segueix estirant» al final de
 * tot; el peu ja porta el mapa, els 947 i les dades, i el que és propi
 * d'aquest poble cap en una filera de pastilles. Es publica com a peça a part
 * perquè la banda «Què t'hi jugues» —que és on ha d'anar— la pugui posar on
 * li toqui.
 */
export function pastillesContext(
  data: RadiografiaData,
  preguntes: ReadonlyMap<string, { jugable: boolean; quantes: number }> = new Map(),
  base = BASE,
): string {
  const m = data.municipality;
  const pastilles: string[] = [];
  if (m.comarca) {
    pastilles.push(`<li><a href="${escape(base)}c/${escape(slugify(m.comarca))}/"><b>${escape(m.comarca)}</b>
      <span>qui mana a la comarca</span></a></li>`);
  }
  if (data.amb) {
    pastilles.push(`<li><a href="${escape(base)}amb/"><b>L'Àrea Metropolitana</b>
      <span>un dels ${number(data.amb.municipis)} municipis</span></a></li>`);
  }
  const p = preguntes.get(m.slug);
  if (p) {
    pastilles.push(
      p.jugable
        ? `<li><a href="${escape(base)}preguntes/${escape(m.slug)}/prova/"><b>I tu, què hi dius?</b>
      <span>${number(p.quantes)} afirmacions</span></a></li>`
        : `<li><a href="${escape(base)}preguntes/${escape(m.slug)}/"><b>Les preguntes</b>
      <span>${number(p.quantes)} afirmacions amb evidència</span></a></li>`,
    );
  }
  pastilles.push(`<li><a href="${escape(base)}comparador/?m=${escape(m.slug)}"><b>Compara'l</b>
      <span>amb fins a tres municipis més</span></a></li>`);
  return `<ul class="pastilles-context">${pastilles.join("")}</ul>`;
}

/** Com es vota en un municipi: els tres règims de la llei electoral. */
export type SistemaElectoral = "llistes tancades" | "llistes obertes" | "consell obert";

/**
 * El ple que s'elegirà el 23 de maig del 2027, deduït del padró d'ara.
 *
 * La banda «Què t'hi jugues» deia «Regidories 41 · es voten el maig del 2027»
 * amb les regidories del 2023. Però la mida del ple no és fixa: la dona la
 * taula de l'article 179 de la LOREG a partir de la població (`councilSeats()`
 * de shared-schemas, la mateixa que fa servir J1), i Barcelona, amb el padró
 * de l'1 de gener del 2025, en passa a tenir 43. Amb el padró del 2025 hi ha
 * una cinquantena de municipis que canvien de mida.
 *
 * El sistema també es mou amb el padró: fins a 250 habitants es vota amb
 * llistes obertes (LOREG art. 184) i per sobre amb llistes tancades. El 2023
 * el sabem pel conjunt de dades de la Generalitat que carrega J5; per al 2027
 * s'aplica la regla de població, que és la mateixa que hi ha darrere d'aquell
 * conjunt. El consell obert és l'excepció: no depèn de la població sinó de la
 * tradició del municipi (LBRL art. 29), i qui el tenia el conserva. Allà no
 * s'elegeixen regidories, només l'alcaldia.
 *
 * Tot plegat és una deducció, no una xifra oficial: el nombre definitiu surt
 * de les xifres oficials de població vigents quan es convoquin les eleccions,
 * i qui ho llegeix ho ha de saber. Sense padró es torna `null` i la fitxa es
 * queda amb el ple del 2023.
 */
export type Ple2027 = {
  regidories: number;
  majoria: number;
  sistema: SistemaElectoral;
  /** Les regidories que es van elegir el 2023, si les sabem. */
  regidories2023: number | null;
  sistema2023: SistemaElectoral;
  canviaMida: boolean;
  canviaSistema: boolean;
  poblacio: number;
  /** L'any del padró (a 1 de gener) del qual surt la població. */
  anyPadro: number | null;
};

/** «Llistes obertes», «Consell obert»… tal com venen de J5, en un dels tres règims. */
export function sistemaElectoral(text: string | null | undefined): SistemaElectoral {
  if (/consell obert/i.test(text ?? "")) return "consell obert";
  if (/llistes obertes/i.test(text ?? "")) return "llistes obertes";
  return "llistes tancades";
}

/** Fins a 250 habitants les llistes són obertes (LOREG art. 184). */
const MAXIM_LLISTES_OBERTES = 250;

export function pleDel2027(
  m: { population: number | null; populationYear?: number | null; electoralSystem: string | null },
  regidories2023: number | null,
): Ple2027 | null {
  if (m.population === null || !Number.isFinite(m.population) || m.population < 0) return null;
  const sistema2023 = sistemaElectoral(m.electoralSystem);
  const sistema: SistemaElectoral =
    sistema2023 === "consell obert"
      ? "consell obert"
      : m.population <= MAXIM_LLISTES_OBERTES
        ? "llistes obertes"
        : "llistes tancades";
  // En consell obert no hi ha regidories que repartir: s'elegeix l'alcaldia,
  // i el recompte del 2023 ja ho reflecteix (una sola «regidoria»).
  const regidories = sistema === "consell obert" ? (regidories2023 ?? 1) : councilSeats(m.population);
  const r2023 = regidories2023 !== null && regidories2023 > 0 ? regidories2023 : null;
  return {
    regidories,
    majoria: absoluteMajority(regidories),
    sistema,
    regidories2023: r2023,
    sistema2023,
    canviaMida: r2023 !== null && r2023 !== regidories,
    canviaSistema: sistema !== sistema2023,
    poblacio: m.population,
    anyPadro: m.populationYear ?? null,
  };
}

/**
 * La frase que diu què canvia del 2023 al 2027, o res si no canvia res.
 *
 * Neutra i amb la font a la vista: «El 2023 el ple tenia 41 regidories; amb
 * el padró de l'1 de gener del 2025 en tindrà 43». I sempre amb la cautela
 * que la xifra definitiva no és nostra.
 */
export function fraseCanviDelPle(ple: Ple2027, nom: string): string {
  if (!ple.canviaMida && !ple.canviaSistema) return "";
  const padro = ple.anyPadro !== null ? `el padró ${delDia(`${ple.anyPadro}-01-01`)}` : "el padró d'ara";
  const habitants = `${number(ple.poblacio)} ${ple.poblacio === 1 ? "habitant" : "habitants"}`;
  const frases: string[] = [];
  if (ple.canviaMida && ple.regidories2023 !== null) {
    frases.push(
      `El 2023 el ple tenia ${number(ple.regidories2023)} ${ple.regidories2023 === 1 ? "regidoria" : "regidories"}; amb ${padro}
      (${habitants}) en tindrà ${number(ple.regidories)}, i la majoria absoluta passa de
      ${number(absoluteMajority(ple.regidories2023))} a ${number(ple.majoria)}.`,
    );
  }
  if (ple.canviaSistema) {
    frases.push(
      `El 2023 ${escape(nom)} votava amb ${ple.sistema2023}; amb ${padro}${ple.canviaMida ? "" : ` (${habitants})`}
      el 2027 hi tocaran ${ple.sistema}.`,
    );
  }
  frases.push(
    "És el que en surt aplicant la llei electoral al padró: el nombre definitiu el fixen les xifres oficials de població vigents quan es convoquin les eleccions.",
  );
  return `<p class="nota-linia"><b>El ple canvia.</b> ${frases.join(" ")}</p>`;
}

/**
 * Què t'hi jugues el 23 de maig del 2027: la banda que fa que això no sigui un
 * dossier d'estadística.
 *
 * Era l'última secció de la fitxa, al 96 % del recorregut, i és l'única que
 * parla de l'elecció: la fitxa estava invertida. Ara va just sota de l'ullada,
 * abans de l'índex, i diu en quatre xifres el que està en joc —quantes
 * regidories, quantes en calen, qui les té ara i quantes vegades ha canviat de
 * mans— amb la papereta al costat, que és la mascota del projecte i no una
 * decoració: és qui pregunta.
 *
 * Cap veredicte tampoc aquí. «En minoria» diu que la llista de l'alcaldia no
 * arriba sola a la majoria absoluta, no que governi malament; i els canvis de
 * mans són un recompte, no una nota.
 */
export function renderJoc(
  data: RadiografiaData,
  preguntes: ReadonlyMap<string, { jugable: boolean; quantes: number }>,
  totalSeats: number,
  majority: number,
  colorPer: (sigles: string | null) => string = () => "#8b8b8b",
): string {
  const m = data.municipality;
  const government = data.government;
  const tires: string[] = [];

  // Les dues primeres tires parlen del ple del 2027, que no és per força el
  // d'ara: es dedueixen del padró (`pleDel2027`). `totalSeats` i `majority`
  // continuen sent els del ple d'avui, que és el que mesura «Les té».
  const ple = pleDel2027(m, totalSeats > 0 ? totalSeats : null);
  if (ple?.sistema === "consell obert") {
    tires.push(tira({ etq: "Es vota", xifra: "L'alcaldia", peu: "en consell obert no s'elegeixen regidories" }));
  } else if (ple) {
    tires.push(tira({
      etq: "Regidories",
      xifra: number(ple.regidories),
      peu: ple.canviaMida ? `es voten el maig del 2027 · ara en són ${number(ple.regidories2023!)}` : "es voten el maig del 2027",
    }));
    tires.push(tira({ etq: "En calen", xifra: number(ple.majoria), peu: "per governar sense pactar amb ningú" }));
  } else if (totalSeats > 0) {
    tires.push(tira({ etq: "Regidories", xifra: number(totalSeats), peu: "les del ple del 2023" }));
    tires.push(tira({ etq: "En calen", xifra: number(majority), peu: "per governar sense pactar amb ningú" }));
  }

  if (government) {
    const sigles = government.mayorSigles ?? government.winnerSigles;
    // Les regidories de la llista de l'alcaldia: les que la mètrica del govern
    // li atribueix i, si no les porta, les de la guanyadora quan l'alcaldia és
    // de la guanyadora. Si no se sap, no s'escriu cap xifra.
    const seients =
      government.mayorSeats ??
      (government.mayorSigles === null || government.mayorSigles === government.winnerSigles ? government.winnerSeats : null);
    const teMajoria = seients !== null ? seients >= majority : government.winnerGoverns !== false && government.winnerHasMajority;
    tires.push(
      tira({
        etq: "Les té",
        xifra: sigla(sigles, { base: BASE, color: colorPer(sigles) }),
        peu: `${seients !== null ? `${number(seients)} de ${number(totalSeats)}${ple?.canviaMida ? " al ple d'ara" : ""} · ` : ""}${teMajoria ? "majoria absoluta" : "en minoria"}`,
        classe: "les-te",
      }),
    );
  }

  const h = data.history;
  if (h && h.elections > 0) {
    tires.push(
      tira({
        etq: `Canvis de mans des del ${h.firstYear ?? 1979}`,
        xifra: h.alternances === 0 ? "Cap" : number(h.alternances),
        // El rànquing dels canvis de força només hi compta els municipis amb
        // dada a les dotze eleccions; els altres hi surten com a «sense dada»,
        // i l'enllaç val igual: allà s'explica per què.
        peu: `${
          h.alternances === 0
            ? `la mateixa força ha guanyat les ${number(h.elections)} eleccions`
            : `en ${number(h.elections)} eleccions`
        } · ${entreEls947("alternances")}`,
      }),
    );
  }

  // El sistema que compta és el del 2027; si canvia respecte del 2023, la
  // frase del canvi ho explica a sota.
  const sistema = ple?.sistema ?? sistemaElectoral(m.electoralSystem);
  const votaDiferent =
    sistema !== "llistes tancades"
      ? `<p class="nota-linia"><b>Aquí es vota diferent.</b> ${escape(m.name)} ${ple?.canviaSistema ? "votarà" : "funciona"} amb ${sistema}:
         no es tria una llista tancada, i per això la brúixola hi tindrà un altre format.</p>`
      : "";
  const canviDelPle = ple ? fraseCanviDelPle(ple, m.name) : "";

  // El botó porta a la prova quan es pot respondre, a les preguntes quan
  // només es poden llegir, i quan no hi ha res encara es diu que s'està
  // preparant: un botó que no porta enlloc seria pitjor que cap botó.
  const p = preguntes.get(m.slug);
  const crida = p?.jugable
    ? `<a class="boto-joc" href="${BASE}preguntes/${escape(m.slug)}/prova/">Respon les ${number(p.quantes)} preguntes</a>`
    : p
      ? `<a class="boto-joc" href="${BASE}preguntes/${escape(m.slug)}/">Llegeix les ${number(p.quantes)} preguntes</a>`
      : `<span class="crida-text">Estem preparant una brúixola electoral per a ${escape(m.name)}: 25 preguntes
         sobre el teu poble i què n'ha dit cada candidatura, amb l'evidència al costat.</span>`;

  return `<section class="joc-banda" id="joc" aria-labelledby="joc-titol">
  <div class="mascota" aria-hidden="true">${papereta(96, "pregunta")}</div>
  <div class="cos-joc">
    <h2 id="joc-titol">Què t'hi jugues el 23 de maig del 2027</h2>
    ${tires.length > 0 ? `<ul class="tires">${tires.join("")}</ul>` : ""}
    ${votaDiferent}
    ${canviDelPle}
    <p class="crida">${crida} <a class="avisa" href="/#avisam">Avisa'm quan s'obri</a></p>
    <details class="nota"><summary>La lletra petita</summary>La data és la del calendari electoral: les eleccions municipals se celebren
    el quart diumenge de maig, i el 2027 cau el 23. Les candidatures no es coneixeran fins a
    finals d'abril del 2027, quan la Junta Electoral les proclami.${
      ple && ple.sistema !== "consell obert"
        ? ` Les regidories del 2027 surten d'aplicar la taula de la llei electoral (LOREG, art. 179) al padró${
            ple.anyPadro !== null ? ` ${delDia(`${ple.anyPadro}-01-01`)}` : ""
          }, ${number(ple.poblacio)} habitants; el nombre definitiu el fixen les xifres oficials de població
          vigents quan es convoquin les eleccions.`
        : ""
    }</details>
    ${pastillesContext(data, preguntes)}
  </div>
</section>`;
}

/**
 * El bloc «Quanta gent atenen els serveis socials», amb el tros que en fa la
 * J42 per als municipis que són àrea bàsica de serveis socials.
 *
 * `renderServeisSocialsMunicipi` fa un tros autònom —el seu `<section>` i un
 * subtítol amb la mateixa pregunta— perquè es pugui posar a qualsevol pàgina.
 * Aquí el registre de seccions ja posa l'embolcall i l'h2, i deixar-li els seus
 * faria una secció dins d'una secció amb el títol dit dues vegades seguides.
 * Per això se li treuen, com es fa amb els blocs de Wikidata. Si un dia el tros
 * canvia de forma i la substitució no lliga, el bloc surt igualment: amb el
 * títol repetit, que és lleig però no amaga res.
 *
 * Sense fila (els 880 municipis que no són àrea bàsica pròpia) o amb una fila
 * d'una forma que no és la de la J42, torna buit i el bloc no existeix: als
 * pobles petits els serveis socials els presta el consell comarcal, i aquest
 * bloc no ha de fer veure que el municipi no en té.
 */
function cosDeServeisSocials(
  dades: ServeisSocialsDesats | null | undefined,
  poblacio: number | null,
  anyPoblacio: number | null,
): string {
  if (!dades || !Array.isArray(dades.anys)) return "";
  const tros = renderServeisSocialsMunicipi(dades, { poblacio, anyPoblacio });
  if (tros.trim() === "") return "";
  const obertura = /^\s*<section class="srv srv-municipi">\s*<h3 class="srv-sub">[^<]*<\/h3>/;
  // L'obertura i el tancament es canvien junts o no es canvia res: un
  // `<section>` tancat amb un `</div>` trencaria la resta de la pàgina.
  if (!obertura.test(tros) || !/<\/section>\s*$/.test(tros)) return tros;
  return tros.replace(obertura, '<div class="srv fx-srv">').replace(/<\/section>\s*$/, "</div>");
}

/**
 * Els quatre capítols de la fitxa.
 *
 * La fitxa d'una ciutat gran feia quaranta pantalles al mòbil amb una vintena
 * de blocs seguits, tots amb el mateix pes, i qui hi entrava per saber una cosa
 * no sabia a quina altura buscar-la. Els blocs no canvien: s'agrupen en quatre
 * preguntes que un veí sí que es fa —qui mana, què fa amb els diners, com és el
 * poble i d'on surt tot plegat— i cada capítol s'anuncia amb una franja que diu
 * què hi ha a dins i hi porta.
 *
 * L'ordre d'aquesta llista és l'ordre de la pàgina. Dins de cada capítol, els
 * blocs van en l'ordre en què són al registre de `renderRadiografia`.
 *
 * Els ids dels blocs no canvien, i per això cap enllaç d'una altra pàgina
 * (`#alcaldies`, `#diners`, `#seguretat`…) no es trenca. La franja de cada
 * capítol porta el seu propi id (`cap-<id>`), per si un dia algú hi vol enllaçar.
 */
export const CAPITOLS_FITXA = [
  { id: "qui-mana", nom: "Qui mana", que: "Qui governa l'ajuntament, com hi va arribar i qui el va votar." },
  { id: "diners", nom: "Els diners", que: "Què gasta l'ajuntament, d'on li arriben els diners i què et toca pagar a tu." },
  { id: "poble", nom: "Com és el poble", que: "Qui hi viu, com s'hi viu i què hi passa." },
  { id: "fonts", nom: "D'on surt", que: "Què en sabem i què no, i d'on surt cada xifra." },
] as const;

type CapitolId = (typeof CAPITOLS_FITXA)[number]["id"];

/**
 * La franja que obre un capítol: el nom, una frase que diu què s'hi trobarà i
 * els blocs que té, enllaçats.
 *
 * No és un h2: els blocs ja ho són, i un capítol amb el mateix encapçalament
 * competiria amb ells en lloc d'agrupar-los. És una franja quieta, el nom en
 * gran i res més que la distingeixi d'un bloc, sense números de capítol (no
 * són passos d'una seqüència) ni etiquetes en majúscules.
 *
 * La primera franja va just després de l'índex, que ja diu els mateixos blocs:
 * al mòbil la llista de la primera s'amaga (vegeu `FITXA_CSS`) per no repetir
 * dues vegades seguides els mateixos enllaços. Al rail de l'escriptori
 * l'índex és a l'esquerra i la franja es queda sencera.
 */
function franjaCapitol(
  capitol: (typeof CAPITOLS_FITXA)[number],
  blocs: readonly Pick<Seccio, "id" | "titol" | "curt">[],
  primer: boolean,
): string {
  return `<div class="fx-cap fx-cap-${capitol.id}${primer ? " fx-cap-primer" : ""}" id="cap-${capitol.id}">
  <p class="fx-cap-nom">${escape(capitol.nom)}</p>
  <p class="fx-cap-que">${escape(capitol.que)}</p>
  <ul class="fx-cap-blocs" aria-label="${escape(`Què hi ha a «${capitol.nom}»`)}">
    ${blocs.map((b) => `<li><a href="#${b.id}">${escape(b.curt ?? b.titol)}</a></li>`).join("\n    ")}
  </ul>
</div>`;
}

/**
 * Un capítol a l'índex: el nom, que no és cap enllaç, i els seus blocs.
 *
 * El nom no enllaça la franja a posta. Tot el que llegeix l'índex —el
 * seguidor que marca on ets, la barra «Ets a» i els resultats «Bloc» del
 * cercador— ho fa amb `.index a[href^='#']`, i una franja de quatre ratlles
 * marcada com a «secció que es llegeix» faria pampallugues a cada canvi de
 * capítol. El nom es diu amb `data-fx-capitol`, que és d'on la barra «Ets a»
 * treu el capítol que posa davant del bloc.
 */
function grupIndex(capitol: (typeof CAPITOLS_FITXA)[number], enllacos: readonly string[]): string {
  return `<div class="fx-idx-grup" data-fx-capitol="${escape(capitol.nom)}">
    <p class="fx-idx-nom">${escape(capitol.nom)}</p>
    <div class="fx-idx-blocs">
    ${enllacos.join("\n    ")}
    </div>
  </div>`;
}

/**
 * Una secció de la fitxa: el que cal per escriure-la al cos i a l'índex.
 *
 * L'índex lateral i el cos surten de la mateixa llista i de cap altre lloc.
 * Eren dues llistes escrites a mà i no coincidien: sis blocs del cos no eren
 * a l'índex, l'ordre era un altre, i el cercador —que llegeix l'índex per
 * oferir els «Bloc» d'aquesta pàgina— no els trobava. Un bloc sense `html`
 * no existeix: ni al cos ni a l'índex.
 */
type Seccio = {
  id: string;
  titol: string;
  /**
   * El capítol on va. Obligatori: un bloc que no digués on va no sortiria a
   * cap capítol, ni al cos ni a l'índex, i val més que el compilador ho digui.
   */
  capitol: CapitolId;
  /** L'etiqueta de l'índex, quan el títol és massa llarg per a una pastilla. */
  curt?: string;
  /** El tema de la icona que encapçala el títol, si en porta. */
  icona?: string;
  /** Classes de més per al `<section>`. */
  classe?: string;
  /** Fals per a les seccions que no van a l'índex (les fonts). */
  alIndex?: boolean;
  html: string;
};

// ------------------------------------------------------------ el cap SEO

/**
 * «Sabadell: qui mana, comptes i vots». Si no hi cap amb la marca —«Cruïlles,
 * Monells i Sant Sadurní de l'Heura» ja en gasta 42—, el nom amb la comarca,
 * que és el que distingeix dos pobles que es diuen igual; i si ni això, el nom.
 */
export function titolMunicipi(m: Pick<RadiografiaData["municipality"], "name" | "comarca">): string {
  return titolQueCap([
    `${m.name}: qui mana, comptes i vots`,
    m.comarca ? `${m.name}, ${m.comarca}` : m.name,
    m.name,
  ]);
}

/**
 * La descripció per al cercador, amb les xifres que la fitxa ja ensenya i
 * sense cap veredicte: qui governa i amb quina majoria, qui té l'alcaldia,
 * quanta gent hi viu, el deute per habitant i el rebut mitjà d'IBI. Cada
 * tros s'escriu només si la dada hi és; el que falta no es diu.
 *
 * L'alcaldia arriba resolta de fora (`resolAlcaldia`) perquè és la mateixa
 * persona i el mateix càrrec que la targeta de la portada: dues frases de la
 * mateixa pàgina no poden dir dos alcaldes.
 */
export function descripcioMunicipi(
  data: RadiografiaData,
  alcaldia: { nom: string | null; carrec: string | null },
): string {
  const m = data.municipality;
  const g = data.government;
  const sigles = g?.mayorSigles ?? g?.winnerSigles ?? null;
  // La majoria és la de qui governa, no la de qui va guanyar: quan hi ha
  // pacte són dues llistes diferents. Sense els escons de l'alcaldia, la de
  // la llista més votada només val si és ella qui governa.
  const majoria =
    g && g.mayorSeats !== null
      ? g.mayorSeats >= g.majority
      : g && g.winnerGoverns !== false
        ? g.winnerHasMajority
        : null;
  const regidories = g && g.mayorSeats !== null && g.totalSeats > 0 ? ` (${g.mayorSeats} de ${g.totalSeats} regidories)` : "";
  const quiMana = alcaldia.nom
    ? alcaldia.carrec && esAlcaldia(alcaldia.carrec)
      ? `, ${carrecCurt(alcaldia.carrec)} ${nomLlegible(alcaldia.nom)}`
      : `, alcaldia: ${nomLlegible(alcaldia.nom)}`
    : "";
  const govern = sigles
    ? `Governa ${sigles}${majoria === null ? "" : majoria ? " amb majoria absoluta" : " sense majoria absoluta"}${regidories}${
        g?.winnerGoverns === false && g.winnerSigles ? `, tot i que la més votada va ser ${g.winnerSigles}` : ""
      }${quiMana}.`
    : `Qui mana a ${m.name}, com estan els comptes i com s'ha mogut el vot des del 1979.`;

  const habitants = m.population ? `${number(m.population)} habitants.` : null;

  const deute =
    data.finances?.indicators.find((i) => i.key === "deute-habitant")?.value ??
    data.finances?.debtSeries.at(-1)?.perHead ??
    null;
  const ibi = data.rebutIbi?.rebutMitja ?? null;
  const diners = [
    deute !== null ? `Deute ${number(Math.round(deute))} € per habitant` : null,
    ibi !== null ? `IBI mitjà ${number(Math.round(ibi))} €` : null,
  ].filter((t) => t !== null);
  const comptes = diners.length > 0 ? `${diners.join(", ")}.` : null;

  return frasesQueCaben([govern, habitants, comptes, "Fonts oficials."]);
}

/**
 * Les coordenades del municipi: les de la base, i si no hi són, les del punt
 * del mapa de Catalunya que la fitxa ja dibuixa. Una que no sigui un nombre
 * no s'escriu: val més cap `geo` que un de fals.
 */
function coordenades(m: RadiografiaData["municipality"], mapa: readonly PuntMapa[]): { lat: number; lon: number } | null {
  const lat = Number(m.lat);
  const lon = Number(m.lon);
  if (m.lat != null && m.lon != null && Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  const punt = mapa.find((p) => p.slug === m.slug);
  return punt && Number.isFinite(punt.lat) && Number.isFinite(punt.lon) ? { lat: punt.lat, lon: punt.lon } : null;
}

/**
 * La data més nova de les dades que ensenya la fitxa, per al `dateModified` i
 * l'`article:modified_time` del cap.
 *
 * Fins ara hi anava la data de generació (`generatedAt`), que és just el que
 * `seo.ts` demana de no fer: la fitxa es torna a generar cada vegada que es
 * publica, i dir que és d'avui cada vegada és el senyal de frescor fals que els
 * cercadors aprenen a ignorar. La data de generació ja surt al peu.
 *
 * La fitxa no té una sola data de les dades: cada mètrica ve d'una feina i
 * d'una font diferents. Però les feines que consulten una font hi deixen el dia
 * de la consulta en un camp `consultat` (`AAAA-MM-DD`): la J14 i la J22 amb els
 * sous, la J24 i la J30 amb les diputacions i els consells, la J28 amb els
 * retrats, la J32 amb el territori, la J36 amb el cens, la J37, la J40… És la
 * mateixa data que les fitxes dels ens fan servir (`DadesEns.consultat`), i
 * aquí es pren la més nova de totes les que porta la fitxa.
 *
 * Per què recórrer la fitxa sencera i no una llista de mètriques: una mètrica
 * nova amb el seu `consultat` hi entra sola, sense que ningú se n'hagi de
 * recordar. Són unes quantes desenes de milers de nodes com a molt per fitxa, i
 * es fa un sol cop per pàgina.
 *
 * És una cota per sota i no la data exacta: una mètrica que no porta data de
 * consulta (els resultats electorals, la liquidació) pot ser més nova. Però
 * així la pàgina mai no es diu més fresca del que és. Només compten els valors
 * que comencen per una data ISO; un `consultat` escrit en lletra no s'endevina.
 * Sense cap data així, `null`, i el cap no porta data de modificació: millor
 * cap data que una d'inventada.
 */
export function dataDeLesDades(data: RadiografiaData): string | null {
  let mesNova: string | null = null;
  const pendents: unknown[] = [data];
  while (pendents.length > 0) {
    const node = pendents.pop();
    if (node === null || typeof node !== "object") continue;
    if (Array.isArray(node)) {
      for (const fill of node) pendents.push(fill);
      continue;
    }
    for (const [clau, valor] of Object.entries(node)) {
      if (clau === "consultat" && typeof valor === "string" && /^\d{4}-\d{2}-\d{2}/.test(valor)) {
        const dia = valor.slice(0, 10);
        if (mesNova === null || dia > mesNova) mesNova = dia;
      } else if (valor !== null && typeof valor === "object") {
        pendents.push(valor);
      }
    }
  }
  return mesNova;
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
  medianes?: MedianesMunicipi,
  seriesGrup?: SeriesMunicipi,
  /**
   * La comparació de seguretat, calculada un sol cop per a totes les fitxes:
   * la mediana del grup de mida i quants municipis tenen la dada. Sense això
   * el bloc surt igualment, amb la frase del rànquing i sense la mediana.
   */
  seguretat?: { grup: GrupCriminalitat | null; coberts: number | null } | null,
  /**
   * Les fitxes de diputacions i consells (`loadEns`), per al bloc «Per sobre
   * de l'ajuntament». Sense, el bloc no surt i la fitxa queda com era.
   */
  ens?: readonly DadesEns[],
  /**
   * Les files d'`els947` dels 947 municipis, per al bloc «Els teus veïns»: la
   * xifra de cada veí surt de la seva fila. Sense, el bloc no surt.
   */
  files947?: readonly Els947Row[],
): string {
  const m = data.municipality;
  const perSobre = renderPerSobre(ens, {
    slug: m.slug,
    name: m.name,
    comarca: m.comarca ?? null,
    population: m.population ?? null,
  });
  const current = data.results.M20231;
  const government = data.government;
  const totalSeats = current?.seats ?? m.councilSeats ?? 0;
  const majority = absoluteMajority(totalSeats);
  const change = data.mayors?.currentTermChange ?? null;
  // Es fa un sol cop: decideix si hi ha bloc de diners, si hi ha entrada a
  // l'índex i quin dels subtítols és el primer, i cridar-lo quatre vegades
  // seria dibuixar quatre vegades la mateixa sèrie.
  const quantGasta = renderQuantGasta(data.despesaProgrames, data.spending);

  /**
   * Color d'un grup del ple. Els noms de seu-e («Grup Municipal del PSC»,
   * «ERC-AM», «No adscrits») no coincideixen amb les sigles de la candidatura,
   * així que es comparen per força amb `sameForce`, que ja sap que PSC-PSOE i
   * PSC-CP són el mateix. Si no lliga, gris: val més no acolorir que acolorir
   * malament, perquè aquí el color diu de qui és cada cosa.
   */
  const candidaturaDelGrup = (grup: string | null): CandidatureShare | null => {
    if (!grup || /no\s*adscri/i.test(grup)) return null;
    const llistes = current?.candidatures ?? [];
    const directe = llistes.find((c) => sameForce(c.sigles, grup) || sameForce(c.brandId, grup));
    if (directe) return directe;
    // La seu electrònica no escriu sigles, escriu el nom del grup municipal:
    // «Grup municipal del Partit dels Socialistes de Catalunya (PSC)». Comparat
    // amb «PSC-CP» com si fossin dues sigles no lliga mai, i a Rubí cinc dels
    // set grups es quedaven grisos. Dues coses hi lliguen sense endevinar res:
    // el nom sencer del partit escrit a dins, i les sigles del parèntesi.
    const familia = familiaDelNomDeGrup(grup);
    return familia ? (llistes.find((c) => siglesFamily(c.sigles) === familia) ?? null) : null;
  };
  const colorPerGrup = (grup: string | null): string => {
    if (!grup || /no\s*adscri/i.test(grup)) return "#8b8b8b";
    const seva = candidaturaDelGrup(grup);
    if (seva) return colorDeCandidatura(seva);
    // Sense candidatura al ple d'avui, el color de la marca si la família es reconeix.
    const familia = familiaDelNomDeGrup(grup);
    return familia ? (BRANDS_BY_ID.get(familia)?.color ?? "#8b8b8b") : "#8b8b8b";
  };

  /*
   * Qui és l'alcaldia ho decideix `resolAlcaldia`, un sol cop per a tot el
   * web: el càrrec de la seu electrònica si hi ha un «alcald» que no sigui
   * un tinent, si no el nom que dona la font oficial dins de la mateixa
   * llista —l'Hospitalet, on la seu encara no marca ningú després del relleu
   * però la cara hi és—, i als 483 municipis sense llista a la seu, el ple del
   * registre electoral, que és qui té la fitxa de la persona. La fitxa tenia
   * la seva pròpia còpia de la regla i buscava «alcald» a pèl, que és com un
   * tinent d'alcalde escrit abans que l'alcalde sortia amb la cara de qui mana.
   */
  const alcaldia = resolAlcaldia(
    data.carrecs?.carrecs ?? null,
    government,
    data.councillors.map((c) => ({ nom: c.name })),
  );
  const mayorColor = government?.mayorSigles
    ? colorPerGrup(government.mayorSigles)
    : "#8b8b8b";

  const coverageLevel = (m.minutesCount ?? 0) >= 20 ? "bo" : (m.minutesCount ?? 0) > 0 ? "parcial" : "cap";
  const coverageText =
    coverageLevel === "bo"
      ? `Tenim indexades ${m.minutesCount} actes de sessions des del juny del 2023, l'última ${delDia(m.minutesLastDate)}.`
      : coverageLevel === "parcial"
        ? `Només tenim indexades ${m.minutesCount} actes des del juny del 2023. És poc per explicar un mandat sencer.`
        : "No hi ha cap acta d'aquest ajuntament al portal de dades obertes de l'AOC.";

  // El cap SEO: el títol, la descripció amb les xifres de la fitxa, la imatge
  // social pròpia de cada municipi i el JSON-LD del lloc i del fil d'Ariadna.
  const url = `${SITE}/observatori/m/${m.slug}/`;
  const fil = filAriadna([
    ...ARREL_OBSERVATORI,
    ...(m.comarca ? [{ nom: m.comarca, url: `${SITE}/observatori/c/${slugify(m.comarca)}/` }] : []),
    { nom: m.name, url },
  ]);

  // Les incidències obertes es diuen, no s'amaguen: una fitxa que calla un
  // problema conegut val menys que una que l'admet.
  const notable = data.issues.filter((i) => i.severity !== "baixa" && ISSUE_TEXT[i.kind]);
  const resum = summarySentence(data, colorPerGrup);

  // ---- les seccions, cadascuna calculada una sola vegada -------------------
  //
  // Abans «Qui hi viu», «Què costa el govern» o «Com ha anat» es dibuixaven dos
  // o tres cops per pàgina: un per saber si calia l'entrada a l'índex i un altre
  // per al cos. Aquí cada bloc es fa un cop i la llista `seccions` decideix la
  // resta. L'ordre és el de la fitxa: qui mana, què ha fet amb els comptes, els
  // diners, el vot, la gent, i al final què en sabem i el 23-M.

  const ple = current
    ? `${renderHemicycle(current.candidatures, totalSeats, majority, seientsDelPle(data, candidaturaDelGrup, alcaldia))}
  ${
    // Els slugs els mana `assignaSlugs()`, que és qui escriu els directoris:
    // amb `slugify()` cru, dues candidatures del mateix ple que en donessin un
    // d'igual enllaçarien totes dues a la primera i la segona pàgina no
    // l'enllaçaria ningú.
    renderLegend(current.candidatures, slugDeCandidatura(current.candidatures))
  }`
    : "";
  const pleLletra = current
    ? `<details class="nota"><summary>La lletra petita</summary>Calen <b>${majority}</b> regidories de ${totalSeats} per aprovar-hi res tot sol.
  L'índex de fragmentació que hi havia aquí (partits efectius) s'ha tret: l'hemicicle ja ho ensenya
  i es pot comptar amb els dits, i el número obligava a explicar-lo cada vegada.</details>`
    : "";

  const regidors =
    data.carrecs && data.carrecs.carrecs.length > 0
      ? renderPleCompacte(data.carrecs, colorPerGrup, government, data.councillors)
      : data.councillors.length > 0
        ? renderCouncillors(data.councillors, government)
        : "";

  const alcaldies =
    data.mayors && data.mayors.history.length > 0
      ? `<p class="entrada-bloc">${data.mayors.distinctPeople} ${data.mayors.distinctPeople === 1 ? "persona ha ocupat" : "persones han ocupat"} l'alcaldia
  ${de(escape(m.name))} des de les primeres eleccions municipals democràtiques.</p>
  ${renderMayors(
    data.mayors,
    // Les adreces de cada persona de l'historial, calculades pel mateix codi
    // que escriu les seves fitxes; l'alcaldia vigent hi va amb la de regidor.
    adrecesAlcaldies(alcaldiesHistoriques(data.mayors, { actual: { nom: alcaldia.nom, adreca: alcaldia.adreca } })),
    retratsPerNom(data.fotosExalcaldes),
  )}`
      : "";

  const trajectoria = renderTrajectoria(data.continuitat, data.votPerdut, { nom: alcaldia.nom, adreca: alcaldia.adreca });

  // Els moviments al ple eren una secció sencera per a una frase: ara és una
  // línia al final de «Qui mana». El que no es diu —el motiu de plegar, els
  // canvis de grup— no es diu perquè la font no ho publica de manera fiable.
  const moviments =
    data.councilChanges && data.councilChanges.substitutions > 0
      ? `<p class="nota-linia"><b>${data.councilChanges.substitutions} ${data.councilChanges.substitutions === 1 ? "persona ha entrat" : "persones han entrat"}
  al ple a mig mandat</b>, rellevant algú que va plegar: les fonts obertes no en publiquen el motiu, i de canvis
  de grup no n'informem perquè la font escriu les mateixes sigles de maneres diferents.</p>`
      : "";

  // El ple, i com s'hi va arribar: el ple d'avui, qui hi seu, les alcaldies des
  // del 1979 i quant fa que mana el mateix. Eren cinc seccions per a la mateixa
  // pregunta; les àncores es queden als subtítols perquè els enllaços vells
  // —el cercador, la pàgina de trajectòria— continuïn arribant-hi.
  //
  // És el bloc més llarg de la fitxa (més de quatre mil píxels al mòbil), i per
  // això a la vista només hi queda la resposta: l'hemicicle i qui seu al ple.
  // La història —les alcaldies des del 1979, quant fa que mana el mateix, qui
  // ha entrat a mig mandat— i la lletra petita van plegades a «Més detall».
  // Les àncores dels subtítols plegats continuen funcionant: `OBRE_DETALL_JS`
  // obre el plegat quan un enllaç hi porta.
  const regidorsPeces = treuLletraPetita(regidors);
  const quiManaVisible = [
    ple,
    regidors ? `<h3 class="subtitol${ple ? "" : " primer"}" id="regidors">Qui seu al ple</h3>${regidorsPeces.cos}` : "",
  ].filter((t) => t !== "");
  const quiManaDetall = [
    alcaldies ? `<h3 class="subtitol" id="alcaldies">Les alcaldies des del 1979</h3>${alcaldies}` : "",
    trajectoria ? `<h3 class="subtitol" id="trajectoria">Quant fa que mana el mateix</h3>${trajectoria}` : "",
    moviments,
    pleLletra,
    regidorsPeces.lletra,
  ].filter((t) => t !== "");
  const quiMana =
    quiManaVisible.length === 0
      ? // Sense ple ni regidors no hi ha res a resumir: la resta va a la vista.
        quiManaDetall.join("\n  ")
      : [
          ...quiManaVisible,
          mesDetall(quiManaDetall.join("\n  "), [
            ...(alcaldies ? ["les alcaldies des del 1979"] : []),
            ...(trajectoria ? ["quant fa que mana el mateix"] : []),
            ...(moviments ? ["qui ha entrat a mig mandat"] : []),
            "la lletra petita",
          ]),
        ]
          .filter((t) => t !== "")
          .join("\n  ");

  // Què ha fet aquest govern amb els comptes: el balanç del mandat, com queda
  // respecte dels seus i el deute any a any. Eren tres blocs —«Balanç»,
  // «Com queda» i «Els comptes»— per a les mateixes vuit xifres.
  const balanc = data.finances ? renderMandate(data.finances, Boolean(data.mayors?.currentTermChange)) : "";
  const comQueda = data.finances ? renderComQueda(data.finances.comparison, data.finances.group) : "";
  const deute = data.finances ? renderDeuteAnyAAny(data.finances, seriesGrup) : "";
  const comptes = [
    balanc ? `<h3 class="subtitol primer" id="balanc">El balanç del mandat</h3>${balanc}` : "",
    comQueda ? `<h3 class="subtitol${balanc ? "" : " primer"}" id="com-queda">Com queda respecte dels seus</h3>${comQueda}` : "",
    deute,
  ]
    .filter((t) => t !== "")
    .join("\n  ");

  const mandat = renderMandat(data);

  // D'on surten i on van eren dos blocs amb dos títols i dues ratlles, quan
  // l'índex sempre n'ha dit «Els diners» i és una sola pregunta amb dues
  // meitats. Junts, i cada meitat amb el seu subtítol. Quants són va primer:
  // és el total que les dues llistes reparteixen.
  //
  // A la vista hi queden les tres respostes —quant, d'on i on— amb les seves
  // xifres i barres; les notes de mètode i les tres lletres petites van
  // plegades a «Més detall» al final del bloc. Les notes que diuen un buit
  // (un exercici sense liquidar, una comparació que no tenim) no es pleguen
  // mai: un buit es diu on es veu.
  const ambDiners = Boolean(quantGasta || data.revenue || data.spending);
  const gastaPeces = treuLletraPetita(quantGasta);
  const ingressosPeces = treuLletraPetita(data.revenue ? renderRevenue(data.revenue) : "");
  // La nota que explica per què els ingressos es comparen amb tot Catalunya és
  // de mètode, no de dada: plegada amb la resta.
  const notaIngressos = ingressosPeces.cos.match(/<p class="nota oberta">[\s\S]*?<\/p>/)?.[0] ?? "";
  const ingressosVisibles = notaIngressos ? ingressosPeces.cos.replace(notaIngressos, "") : ingressosPeces.cos;
  const despesaPeces = treuLletraPetita(data.spending ? renderSpending(data.spending) : "");
  const dinersDetall = [notaIngressos, gastaPeces.lletra, ingressosPeces.lletra, despesaPeces.lletra]
    .filter((t) => t !== "")
    .join("\n  ");
  const diners = ambDiners
    ? `${quantGasta ? `<h3 class="subtitol primer">Quant gasta en total</h3>${gastaPeces.cos}` : ""}
  ${data.revenue ? `<h3 class="subtitol${quantGasta ? "" : " primer"}">D'on surten</h3>${ingressosVisibles}` : ""}
  ${data.spending ? `<h3 class="subtitol">On van</h3>${despesaPeces.cos}` : ""}
  ${mesDetall(dinersDetall, ["com es compara", "la lletra petita"])}
  ${
    // La liquidació per programes de l'AOC arriba a municipis on la de la
    // Generalitat no hi és. Quan passa, la fitxa ja pot dir quant gasta
    // l'ajuntament i encara no en què: dir-ho val més que deixar el buit sense
    // explicació, que és el que es feia.
    !data.revenue && !data.spending
      ? `<p class="nota oberta">D'aquest ajuntament en tenim quant gasta però no en què: el desglossament
         per impostos i per àrees surt de la liquidació que publica la Generalitat, i la d'aquest municipi
         no hi és. Són 112 dels 947, i entre ells hi ha ciutats grans com Badalona. No vol dir que
         l'ajuntament no la reti ni que hi hagi res a amagar: la immensa majoria la publiquen al seu
         portal de transparència, però en un format que no es pot comparar amb el de la resta.</p>`
      : ""
  }`
    : `<p class="entrada-bloc"><b>D'aquest ajuntament no en tenim la liquidació.</b></p>
  <p>Són 112 dels 947, i entre ells hi ha ciutats grans com Badalona. Vol dir que la Generalitat
  no ha publicat la seva liquidació pressupostària a la font que fem servir, no que l'ajuntament
  no la retigui ni que hi hagi res a amagar: la immensa majoria la publiquen al seu propi portal
  de transparència, però en un format que no es pot comparar amb el de la resta.</p>
  <p class="nota oberta">Ho diem en comptes de fer desaparèixer el bloc sense explicació, que és el que
  fèiem fins ara. La resta de la fitxa —qui governa, el ple, el deute, els impostos— no en depèn.</p>`;

  const quePaga = renderQuePaga(data.preuAigua, data.rebutIbi, data.taxes);
  const sous = renderSous(
    data.costGovern,
    data.transparenciaRetribucions,
    data.carrecsAcumulats,
    data.carrecs?.carrecs ?? null,
    colorPerGrup,
    data.retribucions,
    data.sousDiputacions,
    data.sousConsells,
  );
  const contractacio = renderContractacio(data.contractacio);
  const escombraries = renderEscombraries(data.despesaProgrames, data.residus);

  // Les tres últimes eleccions, candidatura a candidatura, viuen dins de la
  // lletra petita d'«Elecció a elecció»: repetien el 2015, el 2019 i el 2023
  // de la gràfica de sobre, i el que hi afegeixen —el nom exacte de cada
  // llista— és el que es busca un cop s'ha vist la sèrie, no abans.
  const serieTres = Object.keys(data.results).length === 0 ? "" : renderSeries(data.results);
  const notaNoms = `<b>Els noms van tal com estan inscrits</b>, amb les majúscules i els guions
  de la font: «BARCELONA EN COMÚ-ECG» i «ERC-MESBcnCO-ACatSí» estan escrits així de debò.
  No els endrecem perquè dins d'aquests noms hi ha sigles de partits i de coalicions, i
  posar-les en minúscula convertiria una marca registrada en una altra cosa.`;
  const historia =
    data.history && data.history.series.length > 3
      ? `<p class="entrada-bloc">${
          data.history.alternances === 0
            ? "<b>La mateixa força ha guanyat totes les eleccions</b> des del " + (data.history.firstYear ?? 1979) + "."
            : "L'ajuntament ha canviat de mans <b>" + data.history.alternances + (data.history.alternances === 1 ? " vegada" : " vegades") + "</b> en " + data.history.elections + " eleccions."
        }</p>
  ${renderFamilyHistory(data.history)}
  <details class="nota"><summary>La lletra petita</summary>Cada columna és el ple sortit d'una elecció, i cada tros, una força.
  Comparem per força i no per sigles perquè les coalicions locals es rebategen sovint:
  el mateix partit hi surt com a PSC-PSOE, PSC-PM i PSC-CP segons l'any.
  Les llistes sense marca supramunicipal van totes juntes com a «llistes locals».
  ${
    serieTres === ""
      ? ""
      : `<b>Les tres últimes, candidatura a candidatura.</b> Regidories obtingudes el 2015, el 2019 i
  el 2023, ara sí amb el nom exacte de cada llista.
  ${serieTres}
  ${notaNoms}`
  }</details>`
      : serieTres === ""
        ? ""
        : // Sense la sèrie des del 1979, les tres últimes són tot el que hi ha.
          `${serieTres}
  <details class="nota"><summary>La lletra petita</summary>${notaNoms}</details>`;

  const participacio = renderTurnout(data.participation, medianes);
  const quiHiViu = data.poblacio ? renderQuiHiViu(data.poblacio, data.riquesa) : "";
  const donesIHomes = data.parity ? renderParitat(data.parity, medianes, contextParitat(data)) : "";
  /*
   * Els dos blocs de Wikidata vénen amb la seva pròpia <section> i el seu h2
   * (wikidata-fitxa.ts els fa autònoms per a qualsevol pàgina); aquí el
   * registre de seccions ja posa l'embolcall i el títol, així que se'ls treu
   * el seu per no tenir una secció dins d'una secció.
   */
  const cosDeSeccio = (html: string): string =>
    html.replace(/^\s*<section[^>]*>\s*<h2>[^<]*<\/h2>/, "").replace(/<\/section>\s*$/, "");
  const agermanaments = cosDeSeccio(renderAgermanaments(data.curiositatsWikidata));
  const nascuts = cosDeSeccio(renderNascuts(data.curiositatsWikidata));
  const serveisSocials = cosDeServeisSocials(data.serveisSocials, m.population ?? null, m.populationYear ?? null);

  const papers = renderPapers(data.cartipas, data.ordenances, data.organismes);
  const detall = data.transparency?.detail ?? [];
  const transparencia =
    data.transparency && detall.length > 0 ? renderTransparencyDetail(detall, data.transparency) : "";
  // «Un buit és un buit», dit per la papereta un sol cop, al bloc que explica
  // què en sabem: és la regla que fa que cap «no consta» de la fitxa sigui un zero.
  const dades = `${vinyetaPapereta(
    "noConsta",
    "Un buit és un buit: quan una font no publica una dada, aquí hi diu «no consta», i mai no hi posem un zero.",
  )}
  <p>${coverageText}</p>
  ${notable.length > 0
    ? `<p class="avis-dades"><b>Hi ha ${notable.length === 1 ? "una cosa" : `${notable.length} coses`} que no ens quadra${notable.length === 1 ? "" : "n"} d'aquest municipi:</b>
       ${notable.map((i) => escape(ISSUE_TEXT[i.kind]!)).join("; ")}.
       Ho tenim obert i no ho amaguem: si alguna xifra d'aquesta pàgina en depèn, agafa-la amb pinces.</p>`
    : ""}
  ${
    transparencia !== ""
      ? transparencia
      : data.transparency && data.transparency.pct !== null
        ? `<p>El seu portal de transparència publica <b>${data.transparency.pct} %</b> dels
       ${data.transparency.items} apartats que li tocarien (${data.transparency.published} de ${data.transparency.items}).</p>`
        : ""
  }
  ${papers ? `<h3 class="subtitol">Els papers d'aquest mandat</h3>
  ${papers}` : ""}
  ${(() => {
    // Aquesta nota deia «encara no n'hem llegit cap» a totes les fitxes, i des
    // que J12 buida les actes és fals a les que sí que en tenen: la fitxa de
    // Sabadell publicava el vot per grup de cada punt i, al peu, que no havíem
    // llegit cap acta. Ara diu el que passa a aquest municipi.
    const actes = data.mocions?.actes ?? null;
    if (actes && actes.llegides > 0) {
      return `<details class="nota"><summary>Les actes: què n'hem llegit</summary>D'aquest municipi n'hem llegit <b>${number(actes.llegides)}</b>
      ${actes.llegides === 1 ? "acta" : "actes"} de ple de les ${number(actes.indexades)} indexades, i
      d'aquí en surt què s'ha votat i què hi ha votat cada grup. La resta de la pàgina surt de dades
      obertes i de càlculs que qualsevol pot repetir.</details>`;
    }
    return `<details class="nota"><summary>Les actes: què n'hem llegit</summary>Les actes d'aquest municipi les tenim <b>indexades però no llegides</b>:
    buidar-les punt per punt es fa als municipis de més de 20.000 habitants, on una votació dividida
    és una notícia i no una excepció. Fins que hi arribem, tot el que hi ha en aquesta pàgina surt de
    dades obertes i de càlculs que qualsevol pot repetir.</details>`;
  })()}
  ${"" /* Les descàrregues d'aquest municipi van aquí, amb el que en sabem: és
  l'únic lloc de la fitxa que en parla des que «Segueix estirant» no hi és. */}
  <p class="baixa">Tot el que hi ha en aquesta pàgina, en
  <a href="${BASE}dades/m/${escape(m.slug)}.csv" download>CSV</a> i en
  <a href="${BASE}dades/m/${escape(m.slug)}.json">JSON</a>, amb l'<a href="${BASE}dades/">esquema documentat</a>
  de cada camp i la seva font.</p>`;

  // La banda del 23-M no és una secció del registre: va abans de l'índex,
  // sota l'ullada, i conserva l'id «joc» perquè els enllaços vells hi arribin.
  const joc = renderJoc(data, preguntes, totalSeats, majority, colorPerGrup);

  const fonts = `<ul>
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
    ${data.poblacio ? `<li>Població, edats i lloc de naixement: ${escape(data.poblacio.font.organisme)}, taules
      ${data.poblacio.font.taules.map((t) => `<code>${escape(t.taula)}</code>`).join(", ")}.
      Les seves dades no són CC: ${escape(data.poblacio.font.llicencia.obliga)}
      ${
        // La llista de taules ja no hi és. Cada xifra del bloc «Qui hi viu»
        // porta el seu enllaç al peu de la seva targeta —que és el que obliga
        // la llicència— i repetir-los tots junts aquí era una llista de cinc
        // enllaços que no responia cap pregunta. Les condicions d'ús, que sí
        // que s'han de poder trobar, es queden en una línia.
        `Condicions d'ús de les seves API a
         <a href="${escape(data.poblacio.font.llicencia.condicions)}" rel="noopener nofollow">idescat.cat</a>.`
      }</li>` : ""}
    ${data.preuAigua ? `<li>Preu de l'aigua: full de tarifes de l'Agència Catalana de l'Aigua${
      data.preuAigua.font.dataActualitzacio ? `, ${escape(data.preuAigua.font.dataActualitzacio)}` : ""
    }.</li>` : ""}
    ${data.rebutIbi ? `<li>Rebut mitjà d'IBI: <a href="${escape(data.rebutIbi.font.url)}" rel="noopener nofollow">${escape(data.rebutIbi.font.organisme)}</a>.</li>` : ""}
    ${data.despesaProgrames ? `<li>Despesa liquidada per programes: ${escape(data.despesaProgrames.font.organisme)},
      <code>${escape(data.despesaProgrames.font.dataset)}</code>.</li>` : ""}
    ${
      // Les fonts del bloc de serveis socials, només on el bloc surt: les cita
      // la mateixa fila de la J42, amb el seu enllaç.
      serveisSocials && data.serveisSocials
        ? `<li>Serveis socials bàsics: ${data.serveisSocials.fonts
            .map((f) => `<a href="${escape(f.url)}" rel="noopener nofollow">${escape(f.nom)}</a>`)
            .join("; ")}.</li>`
        : ""
    }
    ${
      // El crèdit de l'escut va aquí i no al costat del titular: la llicència
      // demana els quatre elements —què és, qui, quina llicència i on és
      // l'original— i al costat d'un escut de 44 px matarien el nom del poble.
      data.imatges?.escut ? `<li>${credit(data.imatges.escut)}</li>` : ""
    }
  </ul>
  <details class="nota"><summary>La lletra petita</summary>Els càlculs derivats —qui governa contra qui va guanyar, els canvis d'alcaldia a mig mandat,
  la fragmentació i la paritat— són nostres i es poden reproduir amb el codi del projecte.</details>`;

  // Les preguntes ràpides: el que la fitxa ja diu (la mateixa alcaldia que la
  // portada, la mateixa majoria que la descripció), escrit com ho preguntaria
  // algú, amb la font i la data al costat. Les respostes que depenen del dia
  // —quan són les properes eleccions— necessiten una data ISO; sense, el bloc
  // no surt, que és millor que una data inventada.
  const consultatIso = /^\d{4}-\d{2}-\d{2}/.test(data.generatedAt) ? data.generatedAt.slice(0, 10) : null;
  const siglesGovern = government?.mayorSigles ?? government?.winnerSigles ?? null;
  const vot2023 = data.participation.find((p) => p.electionId === "M20231") ?? null;
  const rapides =
    consultatIso === null
      ? { html: "", cos: "", jsonLd: null }
      : preguntesRapides(
          preguntesMunicipi({
            municipi: m.name,
            alcaldia: alcaldia.nom
              ? {
                  nom: nomLlegible(alcaldia.nom),
                  carrec: alcaldia.carrec && esAlcaldia(alcaldia.carrec.carrec) ? carrecCurt(alcaldia.carrec.carrec) : null,
                  sigles: government?.mayorSigles ?? null,
                  url: alcaldia.adreca ? `${url}${alcaldia.adreca}` : null,
                }
              : null,
            govern:
              government && siglesGovern
                ? {
                    sigles: siglesGovern,
                    regidories: government.mayorSeats,
                    // La mateixa regla que `descripcioMunicipi`: la majoria de qui governa.
                    majoriaAbsoluta:
                      government.mayorSeats !== null
                        ? government.mayorSeats >= government.majority
                        : government.winnerGoverns !== false
                          ? government.winnerHasMajority
                          : null,
                    mesVotada: government.winnerSigles,
                  }
                : null,
            // En un consell obert no hi ha ple de regidories que comptar.
            ple:
              government && government.totalSeats > 0 && !/consell obert/i.test(m.electoralSystem)
                ? { regidories: government.totalSeats, majoria: government.majority }
                : null,
            participacio:
              vot2023 && vot2023.voters !== null && vot2023.censusSize !== null
                ? { any: 2023, votants: vot2023.voters, cens: vot2023.censusSize }
                : null,
            habitants: m.population ? { valor: m.population, any: m.populationYear ?? null } : null,
            consultat: consultatIso,
          }),
          url,
        );

  // El registre va per capítols (`CAPITOLS_FITXA`) i, dins de cada capítol, en
  // l'ordre de la pàgina. L'etiqueta curta del ple i la dels diners ja no és
  // «Qui mana» ni «Els diners»: ara són els noms dels capítols, i a l'índex
  // sortien repetits l'un sota l'altre. Pel mateix motiu el títol del primer
  // bloc ja no comença per «Qui mana»: la franja del capítol, just a sobre, ja
  // ho diu, i la frase sortia dues vegades seguides.
  //
  // Les etiquetes curtes de l'índex s'han d'entendre soles, fora del bloc:
  // «Per sobre» i «Com ha anat» no deien de què parlaven fins que hi entraves.
  // Ara diuen la cosa: la diputació i el consell, el mandat.
  const seccions: Seccio[] = (
    [
      // ---- Qui mana: el ple, qui hi ha per sobre, com ha anat el mandat i el vot.
      { id: "ple", capitol: "qui-mana", titol: "El ple, i com s'hi va arribar", curt: "El ple", icona: "el ple", html: quiMana },
      // Just després de qui mana a l'ajuntament, qui mana un pis més amunt.
      { id: "per-sobre", capitol: "qui-mana", titol: "Per sobre de l'ajuntament", curt: "Diputació i consell", html: perSobre },
      {
        id: "mandat",
        capitol: "qui-mana",
        titol: "Com han anat aquests quatre anys",
        curt: "El mandat",
        html: mandat
          ? `<p class="entrada-bloc">El que ha canviat des del començament del mandat, i el mateix canvi
  als municipis de la seva mida.</p>
  ${mandat}`
          : "",
      },
      { id: "gaip", capitol: "qui-mana", titol: TITOL_GAIP, curt: "Accés a la informació", html: renderGaipBloc(data.gaip ?? null, m.population, m.name) },
      { id: "historia", capitol: "qui-mana", titol: "El ple, elecció a elecció", curt: "Elecció a elecció", html: historia },
      {
        // Només als municipis que han votat en llista oberta o consell obert
        // alguna vegada: el bloc torna buit a la resta i el registre no el
        // publica. Els noms enllacen la fitxa de regidor calculada sobre la
        // mateixa llista que el generador de pàgines (la seu si hi és, si no
        // el registre), perquè l'enllaç existeixi.
        id: "llistes-obertes",
        capitol: "qui-mana",
        titol: "Aquí es vota persones",
        curt: "Es vota persones",
        html: renderLlistesObertesBloc(
          data.llistesObertes ?? null,
          adrecesDelPle(data.carrecs?.carrecs?.length ? data.carrecs.carrecs : data.councillors.map((c) => ({ nom: c.name }))),
        ),
      },
      // Als pobles de llistes obertes el marge ja surt a «Aquí es vota persones».
      { id: "ultim-regidor", capitol: "qui-mana", titol: "L'últim regidor: per quants vots", curt: "L'últim regidor",
        html: data.marges?.eleccions.at(-1)?.sistema === "dhondt" ? renderMargesBloc(data.marges ?? null) : "" },
      // Dones i homes va amb qui mana i no amb com és el poble: no parla del
      // padró sinó de les llistes, dels caps de llista i de qui seu al ple.
      { id: "dones-i-homes", capitol: "qui-mana", titol: "Dones i homes", html: donesIHomes },
      { id: "participacio", capitol: "qui-mana", titol: "Qui hi va anar a votar", curt: "Participació", icona: "participació", html: participacio },
      // Mai buit: sense J36 executat diu que no hi ha dada, que no és un zero.
      { id: "cens", capitol: "qui-mana", titol: "El cens i la participació des del 1979", curt: "Cens des del 1979", html: renderCensBloc(data.censElectoral ?? null) },
      { id: "altres-eleccions", capitol: "qui-mana", titol: "Com vota aquest municipi a cada elecció", curt: "Altres eleccions",
        html: renderAltresEleccionsBloc(data.altresEleccions ?? null, {
          participacio: data.participation.find((p) => p.electionId === "M20231") ?? null,
          resultats: data.results["M20231"] ?? null,
        }) },
      // Al final de «Qui mana»: gairebé totes les preguntes són d'aquest
      // capítol (l'alcaldia, qui governa, el ple, les eleccions, el vot).
      { id: "preguntes-rapides", capitol: "qui-mana", titol: "Preguntes ràpides", classe: "geo-preguntes", html: rapides.cos },
      // ---- Els diners: els comptes del mandat, el pressupost, el que paga la gent i el que costa el govern.
      { id: "comptes", capitol: "diners", titol: "Què ha fet aquest govern amb els comptes", curt: "Els comptes", html: comptes },
      {
        id: "diners",
        capitol: "diners",
        titol: ambDiners ? "Els diners: quants són, d'on surten i on van" : "D'on surten i on van els diners",
        curt: "Quant gasta",
        icona: ambDiners ? "fiscalitat" : undefined,
        html: diners,
      },
      {
        // Just després dels diners de l'ajuntament, els que li arriben de la
        // Generalitat. Mai no se sumen amb els de la diputació i el consell
        // (RAISC) de «Per sobre de l'ajuntament»: són pagadors diferents.
        id: "diners-generalitat",
        capitol: "diners",
        titol: TITOL_DINERS_GENERALITAT,
        curt: CURT_DINERS_GENERALITAT,
        html: renderDinersGeneralitatBloc(data.dinersGeneralitat ?? null, {
          habitants: m.population ?? null,
          anyPadro: m.populationYear ?? null,
        }),
      },
      {
        id: "que-paga",
        capitol: "diners",
        titol: "Què paga la gent",
        icona: "fiscalitat",
        html: quePaga
          ? `<p class="entrada-bloc">El que costa l'aigua, el que surt al rebut de l'IBI i els tipus que vota el ple,
  amb els avisos que fan que aquestes xifres es puguin comparar sense mentir.</p>
  ${quePaga}`
          : "",
      },
      {
        id: "sous",
        capitol: "diners",
        titol: "Què costa el govern, i què se'n pot saber",
        curt: "Què costa el govern",
        icona: "fiscalitat",
        html: sous
          ? `<p class="entrada-bloc">El que l'ajuntament dedica a retribuir els membres del seu govern, què en publica
  de cada regidoria i qui, a més, té un càrrec en un altre ens. Cap xifra de sou individual: la que publiquen
  els ajuntaments és només la part que paguen ells, i publicar-la exculparia.</p>
  ${sous}`
          : "",
      },
      {
        id: "contractacio",
        capitol: "diners",
        titol: "Què contracta, i amb quanta competència",
        curt: "Què contracta",
        html: contractacio
          ? `<p class="entrada-bloc">Quant ha adjudicat aquest ajuntament i quantes de les seves licitacions van
  rebre una sola oferta, comparat amb els municipis de la seva mida.</p>
  ${contractacio}`
          : "",
      },
      {
        id: "escombraries",
        capitol: "diners",
        titol: "Les escombraries: el que costen i el que se'n recull",
        curt: "Les escombraries",
        icona: "residus",
        html: escombraries,
      },
      // ---- Com és el poble: qui hi viu, les cases, els serveis i el que hi passa.
      { id: "qui-hi-viu", capitol: "poble", titol: "Qui hi viu", icona: "habitants", html: quiHiViu },
      { id: "feina-i-renda", capitol: "poble", titol: "Feina i renda", curt: "Feina i renda", html: renderSocioeconomiaBloc(data.socioeconomia ?? null, { nom: m.name }) },
      // Just després de qui hi viu, on viu: el pla urbanístic, els pisos
      // turístics i l'habitatge protegit. Mai buit: sense J40 diu el buit.
      {
        id: "urbanisme",
        capitol: "poble",
        titol: TITOL_URBANISME,
        curt: "La casa",
        html: renderUrbanismeHabitatgeBloc(data.urbanismeHabitatge ?? null, { nom: m.name, registre: data.establimentsTuristics ?? null }),
      },
      // Només als 67 municipis que són àrea bàsica de serveis socials pròpia
      // (J42): a la resta torna buit i el registre no el publica, perquè allà
      // els serveis socials els presta el consell comarcal.
      {
        id: "serveis-socials",
        capitol: "poble",
        titol: "Quanta gent atenen els serveis socials",
        curt: "Serveis socials",
        html: serveisSocials,
      },
      {
        // Mai buida: els 877 municipis que el Ministeri no publica hi veuen el
        // buit dit clar, i tots hi llegeixen que la policia no és municipal.
        id: "seguretat",
        capitol: "poble",
        titol: "Com ha anat la seguretat",
        curt: "Seguretat",
        html: renderCriminalitat(data.criminalitat, {
          grup: seguretat?.grup ?? null,
          poblacio: m.population,
          coberts: seguretat?.coberts ?? null,
        }),
      },
      { id: "vehicles", capitol: "poble", titol: "Quants vehicles hi ha", curt: "Vehicles", html: renderVehiclesBloc(data.vehicles ?? null) },
      { id: "agermanaments", capitol: "poble", titol: "Agermanaments", html: agermanaments },
      { id: "nascuts", capitol: "poble", titol: "Nascuts aquí, segons Wikidata", curt: "Nascuts aquí", html: nascuts },
      // ---- D'on surt: què en sabem i les fonts.
      {
        id: "dades",
        capitol: "fonts",
        titol: "Què en sabem i què no",
        curt: "Què en sabem",
        classe: `cobertura cobertura-${coverageLevel}`,
        html: dades,
      },
      // Fora de l'índex, com sempre; la franja del capítol sí que hi porta.
      { id: "fonts", capitol: "fonts", titol: "D'on surt tot això", curt: "Les fonts", classe: "fonts", alIndex: false, html: fonts },
    ] satisfies Seccio[]
  ).filter((seccio) => seccio.html.trim() !== "");

  // L'índex i el cos, de la mateixa llista. El client (`SEGUIDOR_INDEX`, i el
  // cercador amb els seus resultats «Bloc») llegeix `.index a[href^='#']`.
  // «On cau entre els seus» viu abans de l'índex, entre l'ullada i la banda
  // del 23-M, però és un bloc amb id com els altres i l'índex hi ha de portar:
  // va el primer, que és on és a la pàgina.
  const veins = renderVeinsTria(m.slug, m.name, files947);
  const comparat = renderComparat(data, medianes, veins);

  // Els capítols que tenen algun bloc, cadascun amb els seus. Es reparteixen
  // pel camp `capitol` i no per la posició al registre: un bloc nou posat on
  // no toca continua anant al seu capítol, i cap capítol no surt partit en dos.
  const capitols = CAPITOLS_FITXA.map((capitol) => ({
    capitol,
    blocs: seccions.filter((seccio) => seccio.capitol === capitol.id),
  })).filter((c) => c.blocs.length > 0);

  const enllacIndex = (seccio: Seccio): string => `<a href="#${seccio.id}">${escape(seccio.curt ?? seccio.titol)}</a>`;
  // «On cau entre els seus» va el primer i fora de tot capítol: és part del
  // resum que hi ha abans de l'índex, com l'ullada i «En 30 segons».
  const index = [
    ...(comparat === "" ? [] : ['<a href="#comparat">On cau entre els seus</a>']),
    ...capitols.flatMap(({ capitol, blocs }) => {
      const enllacos = blocs.filter((seccio) => seccio.alIndex !== false).map(enllacIndex);
      return enllacos.length === 0 ? [] : [grupIndex(capitol, enllacos)];
    }),
  ].join("\n  ");

  const seccioHtml = (seccio: Seccio): string => `<section class="bloc${seccio.classe ? ` ${seccio.classe}` : ""}" id="${seccio.id}">
  ${
    seccio.icona
      ? `<h2 class="amb-icona">${icona(seccio.icona, true)}<span>${escape(seccio.titol)}</span></h2>`
      : `<h2>${escape(seccio.titol)}</h2>`
  }
  ${seccio.html}
</section>`;
  const cos = capitols
    .map(({ capitol, blocs }, i) => [franjaCapitol(capitol, blocs, i === 0), ...blocs.map(seccioHtml)].join("\n\n"))
    .join("\n\n");

  return `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${capSeo({
  titol: titolMunicipi(m),
  descripcio: descripcioMunicipi(data, { nom: alcaldia.nom, carrec: alcaldia.carrec?.carrec ?? null }),
  url,
  imatge: `${SITE}/observatori/og/${m.slug}.png`,
  tipus: "article",
  // La data de les dades i no la de la generació, que seo.ts demana de no
  // passar-hi: la més nova de les consultes a les fonts que porta la fitxa
  // (vegeu `dataDeLesDades`). Sense cap, el cap no en porta.
  dataModificacio: dataDeLesDades(data),
  jsonLd: [
    fil,
    // El municipi amb els `@id` del graf (`ID.municipi`), el codi INE i, quan
    // la J20 l'ha aparellat pel codi INE, l'element de Wikidata i la Viquipèdia.
    municipiLd({
      slug: m.slug,
      nom: m.name,
      comarca: m.comarca ? { slug: slugify(m.comarca), nom: m.comarca } : null,
      punt: coordenades(m, mapa),
      habitants: m.population,
      ine: m.ine5,
      wikidata: data.wikidata?.qid ?? null,
      viquipedia: data.wikidata?.viquipedia ?? null,
      imatge: `${SITE}/observatori/og/${m.slug}.png`,
    }),
    // L'ajuntament, amb la mateixa alcaldia que la portada i la descripció:
    // el càrrec curt («alcalde», «alcaldessa») quan la seu el diu, i
    // «alcaldia» a seques quan només tenim el nom del registre.
    ajuntamentLd(
      m.slug,
      m.name,
      alcaldia.nom
        ? {
            nom: nomLlegible(alcaldia.nom),
            carrec: alcaldia.carrec && esAlcaldia(alcaldia.carrec.carrec) ? carrecCurt(alcaldia.carrec.carrec) : "alcaldia",
            url: alcaldia.adreca ? `${url}${alcaldia.adreca}` : null,
          }
        : null,
    ),
    // Les preguntes ràpides, que diuen el mateix que el bloc visible: sense
    // bloc, cap FAQPage (`preguntesRapides` torna `null`).
    ...(rapides.jsonLd ? [rapides.jsonLd] : []),
  ],
})}
${tipografia(BASE)}
<style>${RADIOGRAFIA_CSS}${senseComentaris(MASCOTA_CSS)}${FOTOS_WIKIMEDIA_CSS}${WIKIDATA_FITXA_CSS}${CENS_FITXA_CSS}${ALTRES_ELECCIONS_CSS}${data.marges ? MARGES_CSS : ""}${data.socioeconomia ? senseComentaris(SOCIOECONOMIA_CSS) : ""}${data.gaip ? senseComentaris(GAIP_FITXA_CSS) : ""}${LLISTES_OBERTES_CSS}${perSobre ? PER_SOBRE_CSS : ""}${senseComentaris(CRIMINALITAT_CSS)}${senseComentaris(TIRA_POBLE_CSS)}${senseComentaris(PAPERETA_POSTURES_CSS)}${veins ? senseComentaris(VEINS_CSS) : ""}${senseComentaris(URBANISME_FITXA_CSS)}${senseComentaris(COOPERACIO_CSS)}${serveisSocials ? senseComentaris(SERVEIS_ENS_CSS) : ""}${rapides.cos ? senseComentaris(GEO_CSS) : ""}${FITXA_CSS}</style>
</head>
<body>
<a class="salta" href="#contingut">Ves al contingut</a>

${capcalera(BASE, "cap")}
${cercador(BASE)}

<main id="contingut">

<section class="portada${mapa.length > 0 ? " amb-mapa" : ""}">
  ${
    // La comarca porta a la seva pàgina, amb el mateix camí que fa servir
    // «On continua» al final de la fitxa (`pastillesContext`): era l'única
    // menció de la comarca a tota la portada i no era cap enllaç. La
    // província es queda com a text: no té pàgina.
    `<p class="micro">${
      m.comarca ? `<a href="${BASE}c/${escape(slugify(m.comarca))}/">${escape(m.comarca)}</a>` : ""
    }${m.provincia ? ` · ${escape(m.provincia)}` : ""}</p>`
  }
  ${
    // L'escut al costat del nom, quan Commons en té: 877 dels 947. Sense
    // escut no hi va cap silueta, i el crèdit —que la llicència obliga— és a
    // «D'on surt tot això».
    `<div class="titol-amb-escut">${escutMunicipi(data.imatges, { municipi: m.name })}<h1>${escape(m.name)}</h1></div>`
  }
  <p class="entrada">
    ${renderTerritori({ habitants: m.population, superficie: data.territori?.superficie?.valor ?? null, altitud: data.territori?.altitud?.valor ?? null, densitat: data.territori?.densitat?.valor ?? null, gentilici: data.territori?.gentilici ?? null }) || `${number(m.population ?? 0)} habitants`} · ${
      // En consell obert no hi ha ple de regidories («1 regidories al ple»
      // sortia a sis fitxes): s'elegeix l'alcaldia, i el sistema ja ho diu.
      sistemaElectoral(m.electoralSystem) === "consell obert" ? "" : `${number(totalSeats)} ${totalSeats === 1 ? "regidoria" : "regidories"} al ple ·`
    }
    ${
      // «Llistes tancades» és el nom tècnic, i un veí no sap què vol dir:
      // es diu què vol dir. Els altres sistemes (llista oberta, consell
      // obert) ja s'expliquen sols, i a més tenen el seu bloc a la fitxa.
      m.electoralSystem === "llistes tancades" ? "es vota una llista sencera, no persones" : escape(m.electoralSystem)
    }
  </p>
  ${resum ? `<p class="resum">${resum}</p>` : ""}
  ${
    /*
     * Qui mana, amb cara i nom, a TOTS els municipis.
     *
     * La targeta sortia només quan la seu electrònica publicava la llista de
     * càrrecs, i per això només la tenien 804 dels 947. A l'Hospitalet de
     * Llobregat, per exemple, les vint-i-quatre cares les tenim d'una altra font
     * i la seu electrònica serveix un Tableau sense cap fotografia: la fitxa de
     * la segona ciutat de Catalunya es quedava sense dir qui n'és l'alcalde a
     * la portada.
     *
     * El nom i les sigles, en canvi, els tenim per als 947 de la font oficial de
     * la Generalitat. Quan la seu electrònica hi arriba, mana ella, perquè porta
     * el càrrec exacte, la foto i l'enllaç a la fitxa de la persona; quan no,
     * la targeta es fa igualment amb el que sabem de cert i les inicials fan de
     * cara. El que no passa mai és que la fitxa d'un poble calli qui hi mana.
     */
    alcaldia.nom
      ? renderAlcaldia(
          nomLlegible(alcaldia.nom),
          // Quan la persona s'ha trobat pel nom oficial i no pel càrrec, el
          // càrrec que en diu la seu electrònica és el d'abans del relleu —o
          // cap— i escriure'l seria dir que no ho és.
          alcaldia.carrec && esAlcaldia(alcaldia.carrec.carrec) ? alcaldia.carrec.carrec : "Alcaldia",
          government?.mayorSigles ?? null,
          mayorColor,
          alcaldia.foto,
          alcaldia.adreca,
          relleuDelMandat(data.mayors, alcaldia.nom),
        )
      : ""
  }
  ${
    /*
     * La tira del poble: qui ha tingut l'alcaldia de cada mandat des del 1979,
     * un tram per persona amb el color de la seva força (marca de dada) i una
     * osca als relleus de mig mandat. Va sota la targeta de l'alcaldia, a
     * totes les amplades: al mòbil és el dibuix de la portada, en lloc del
     * mapa gros, i diu més del poble que on és. Sense historial no surt: una
     * tira tota en blanc diria «no consta» dotze vegades.
     */
    data.mayors && data.mayors.history.length > 0
      ? `<div class="fx-tira">
    <p class="fx-tira-etq"><a href="#alcaldies">Qui ha tingut l'alcaldia</a>, mandat a mandat</p>
    ${tiraDelPoble(tiraDesDeHistorial(data.mayors, m.name), { mida: "gran" })}
  </div>`
      : ""
  }
  ${
    // El mapa, al mòbil, és una miniatura de 120 px al costat de la línia de
    // dades (vegeu FITXA_CSS): a mida sencera es menjava la primera pantalla
    // per dir només on és el poble. A partir de 820 px torna a la columna
    // del costat, com sempre.
    mapa.length > 0
      ? `<figure class="on-es">
      ${renderMapa(mapa, { amplada: 300, destacat: m.slug, descripcio: `Mapa de Catalunya amb ${m.name} destacat` })}
      <figcaption>${escape(m.name)}, entre els 947 municipis de Catalunya</figcaption>
    </figure>`
      : ""
  }
</section>

${
  // El resum en frases va just sota la portada i abans de cap xifra: és el
  // que respon «què he de saber d'aquest poble» a qui no baixarà més avall.
  renderEn30Segons(data, {
    alcaldia,
    medianes,
    colorPer: colorPerGrup,
    siglesDelGrup: (grup) => candidaturaDelGrup(grup)?.sigles ?? null,
  })
}

${renderUllada(data, medianes, colorPerGrup)}

${comparat}

${joc}

<nav class="index" aria-label="Seccions d'aquesta pàgina">
  ${index}
</nav>
${barraEtsA()}
${"" /* Aquest </nav> hi faltava, i no era un detall de validador: sense ell tota
  la resta de la pàgina quedava dins d'un contenidor flex amb wrap, i cada secció
  hi entrava com a element flexible amb min-width:auto. El resultat era que la
  taula més ampla de la fitxa estirava el document sencer i a 320 px la pàgina es
  desplaçava horitzontalment 89 px. */}

${cos}

${
  // La papereta tanca la fitxa i proposa el pas següent: el comparador, que
  // llegeix el municipi de partida del paràmetre «m».
  vinyetaPapereta("final", "Has arribat al final.", {
    enllac: { href: `${BASE}comparador/?m=${m.slug}`, text: "El comparem amb un altre poble?" },
  })
}

</main>
${peu(BASE, data.generatedAt)}

${SEGUIDOR_INDEX}
${OBRE_DETALL_JS}
${GRAFICS_JS}
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
    riquesa: (byKind.get("riquesa") ?? null) as RiquesaMetric | null,
    criminalitat: (byKind.get("criminalitat") ?? null) as CriminalitatMetric | null,
    preuAigua: (byKind.get("preuAigua") ?? null) as PreuAiguaMetric | null,
    rebutIbi: (byKind.get("rebutIbi") ?? null) as RebutIbiMetric | null,
    despesaProgrames: (byKind.get("despesaProgrames") ?? null) as DespesaProgramesMetric | null,
    costGovern: (byKind.get("costGovern") ?? null) as CostGovernMetric | null,
    transparenciaRetribucions: (byKind.get("transparenciaRetribucions") ?? null) as TransparenciaRetribucionsMetric | null,
    carrecsAcumulats: (byKind.get("carrecsAcumulats") ?? null) as CarrecsAcumulatsMetric | null,
    retribucions: (byKind.get("retribucions") ?? null) as RetribucionsMetric | null,
    sousDiputacions: (byKind.get("sousDiputacions") ?? null) as SousDiputacionsMetric | null,
    sousConsells: (byKind.get("sousConsells") ?? null) as SousConsellsMetric | null,
    // Sense J26 executat no hi ha fila i l'escut no surt: la fitxa es construeix igual.
    imatges: (byKind.get("imatges") ?? null) as ImatgesMunicipi | null,
    contractacio: (byKind.get("contractacio") ?? null) as ContractacioMetric | null,
    continuitat: (byKind.get("continuitat") ?? null) as ContinuitatMetric | null,
    votPerdut: (byKind.get("votPerdut") ?? null) as VotPerdutMetric | null,
    ordenances: (byKind.get("ordenances") ?? null) as OrdenancesMetric | null,
    cartipas: (byKind.get("cartipas") ?? null) as CartipasMetric | null,
    organismes: (byKind.get("organismes") ?? null) as OrganismesMetric | null,
    amb: (byKind.get("amb") ?? null) as RadiografiaData["amb"],
    territori: (byKind.get("territori") ?? null) as TerritoriMetric | null,
    curiositatsWikidata: (byKind.get("curiositatsWikidata") ?? null) as FitxaCuriositatsWikidata | null,
    vehicles: (byKind.get("vehicles") ?? null) as VehiclesMetric | null,
    socioeconomia: (byKind.get("socioeconomia") ?? null) as SocioeconomiaMetric | null,
    gaip: (byKind.get("gaip") ?? null) as GaipMetric | null,
    establimentsTuristics: (byKind.get("establimentsTuristics") ?? null) as EstablimentsTuristicsMetric | null,
    llistesObertes: (byKind.get("llistesObertes") ?? null) as LlistesObertesMetric | null,
    censElectoral: (byKind.get("censElectoral") ?? null) as CensElectoralMetric | null,
    altresEleccions: (byKind.get("altresEleccions") ?? null) as AltresEleccionsMetric | null,
    marges: (byKind.get("marges") ?? null) as MargesMetric | null,
    urbanismeHabitatge: (byKind.get("urbanismeHabitatge") ?? null) as UrbanismeHabitatgeMetric | null,
    // L'adaptador comprova la forma: una fila d'una versió vella de J41 surt
    // com a `null` («no consta») i no com un bloc trencat.
    dinersGeneralitat: llegeixDinersGeneralitat(byKind.get("dinersGeneralitat") ?? null),
    // Només els municipis que són àrea bàsica de serveis socials en tenen fila;
    // la resta queda a `null` i la fitxa no hi fa cap bloc.
    serveisSocials: (byKind.get("serveisSocialsBasics") ?? null) as ServeisSocialsDesats | null,
    // La fila sencera de la J20 porta més camps (imatges, OSM…); la fitxa només
    // en llegeix el QID, l'adreça i la Viquipèdia per al JSON-LD.
    wikidata: (byKind.get("wikidata") ?? null) as { qid: string; url: string; viquipedia: string | null } | null,
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
    fotosExalcaldes: (byKind.get("fotosExalcaldes") ?? null) as FitxaFotosExalcaldes | null,
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
