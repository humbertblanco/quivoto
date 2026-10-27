/**
 * Els rànquings: qui és a dalt i qui a baix de cada indicador.
 *
 * Una sola pàgina, `/observatori/ranquings/`, que fa dues coses que abans
 * eren dues pàgines separades («Destaquen» i «Rànquings») i que deien el
 * mateix dues vegades: els extrems d'un indicador són la primera i l'última
 * fila del seu rànquing, i tenir-los en una pàgina a part, amb un altre nom
 * al menú, era fer triar el lector entre dues portes que duien al mateix
 * lloc. Ara els extrems obren la pàgina —amb els empats sencers, que és
 * l'única cosa que un rànquing ordenat no ensenya bé— i cada targeta porta al
 * rànquing complet de sota.
 *
 * ## Què es publica i què no
 *
 * Una mètrica només surt si té **un mateix període** per a almenys el 90 %
 * dels municipis i vint valors. No es barregen anys per fer créixer la
 * cobertura: el que decideix el període és `cohortHomogenia()`, que tria el
 * més recent que arriba al llindar. Un zero publicat és una dada; un buit no.
 *
 * ## Per què la pàgina porta les dades a dins i no 6.600 files escrites
 *
 * La primera versió escrivia les 947 files de cada indicador, amagades, i
 * un top 10 a part que repetia les deu primeres: dos megabytes i mig d'HTML
 * per a una pàgina que a cada moment n'ensenya quaranta. Ara el servidor
 * escriu les primeres files de cada rànquing (perquè sense JavaScript hi hagi
 * alguna cosa a llegir) i la resta viu en un bloc JSON compacte al final,
 * amb el qual el navegador refà la llista i el regle quan es canvia l'àmbit
 * o s'escriu al cercador.
 */

import { buildPeerGroups, type PeerGroup } from "../derive/peers";
import { slugify } from "../lib/text";
import { capcalera, tipografia } from "./capcalera";
import { cercador } from "./cercador";
import { SITE } from "./config";
import { ARREL_OBSERVATORI, capSeo, filAriadna, FITXER_OG, imatgeOg } from "./seo";
import { llistaOrdenada } from "./seo-ld";
import { ANY_MUNICIPALS, cohortHomogenia, extremsEmpatats, preuAiguaComparable } from "./contracte-metriques";
import { curiositatsTerritori } from "./territori-fitxa";
import { curiositatsWikidata } from "./wikidata-fitxa";
import { curiositatsVehicles, esFlota } from "./vehicles-fitxa";
import { curiositatsCens } from "./cens-fitxa";
import { curiositatsLlistesObertes, type ResumLlistesObertes } from "./llistes-obertes-fitxa";
import { CURIOSITATS_CSS, preparaCuriositats, renderCuriositats, type DadesCuriositats } from "./curiositats";
import {
  atributsEtiqueta,
  eixDispersio,
  etiquetaTall,
  GRAFICS_CSS,
  GRAFICS_JS,
  NOTA_ESCALA_LOG,
  posicioEscala,
  tallsEscala,
  textEtiqueta,
  type DadaEtiqueta,
  type EscalaRegle,
} from "./grafics";
import { codiPerAlNavegador } from "./comparador";
import type { Els947Row } from "./els947";
import { peu } from "./peu";
import { RADIOGRAFIA_CSS } from "./estil";

const escape = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n = (v: number, d = 0): string =>
  v.toLocaleString("ca-ES", { minimumFractionDigits: d, maximumFractionDigits: d });

/**
 * La fila mínima que necessita la pàgina: el subconjunt d'`Els947Row` que
 * es compara. Els camps de valor són opcionals perquè la projecció global els
 * pot anar afegint sense acoblar aquest mòdul a la base de dades. `null` és
 * absència; zero és sempre una dada vàlida.
 */
export type RankingRow = {
  s: string; n: string; c: string; p: number;
  /** participació a les municipals del 2023, en percentatge */
  pt?: number | null;
  /** mediana de renda per unitat de consum i any */
  rm?: number | null; rma?: number | null;
  /** recollida selectiva bruta i any */
  rs?: number | null; rsa?: number | null;
  /** preu domèstic de l'aigua i any */
  pa?: number | null; paa?: number | null;
  /** rebut mitjà d'IBI urbà i any */
  ibi?: number | null; ibia?: number | null;
  /** canvis de la força més votada des del 1979, i quantes eleccions tenen dada */
  v?: number | null; q?: number | null;
  /** vehicles per 1.000 habitants i any de la dada (Idescat, a partir de la DGT) */
  veh?: number | null; veha?: number | null;
  /** cens electoral del 1979 i de la darrera elecció, creixement entre la primera dada i la darrera (%) i any de la primera */
  cens79?: number | null; censUlt?: number | null; creixCens?: number | null; censDes?: number | null;
  /** participació màxima i mínima de les dotze municipals, amb l'any (només curiositats) */
  partMax?: number | null; partMaxA?: number | null; partMin?: number | null; partMinA?: number | null;
  /*
   * Els camps que segueixen no fan cap rànquing: els llegeixen les curiositats
   * (`curiositats.ts`), que comparteixen la fila per no tornar a carregar els
   * 947. Són els mateixos noms que a `Els947Row`.
   */
  /** regidories del ple */
  r?: number | null;
  /** nom de l'alcaldia i el camí de la seva fitxa, relatiu a `m/<slug>/` */
  a?: string | null; ad?: string | null;
  /** dones al ple en percentatge, `null` quan la llista d'electes no és completa */
  f?: number | null;
  /** sou anual de l'alcaldia, només quan és un sou */
  sa?: number | null;
  /** la darrera elecció en llista oberta o consell obert (J37), només als municipis que n'han tingut */
  lo?: ResumLlistesObertes | null;
} & Partial<Pick<Els947Row, CampsNous>>;

/**
 * Les xifres que fins ara només sortien a la fitxa i ara també fan rànquing
 * (o curiositat). Els noms i el sentit de cada camp són els d'`Els947Row`, on
 * hi ha la descripció de cadascun; aquí només es diu quins es fan servir.
 */
type CampsNous =
  | "ne" | "vol" | "vola" | "vp" | "vpr" | "cfa" | "cfd" | "cpa" | "cra" | "vv"
  | "uo" | "uon" | "uop" | "hut" | "huta" | "ll" | "lla" | "llv" | "llp"
  | "pla" | "plas" | "plaa" | "hpo" | "hpon" | "hpop" | "mg" | "mgs" | "mgg" | "mgp" | "pag" | "o" | "oa";

/**
 * Una mètrica comparable. `decimals` i `sufix` són els que fan servir alhora el
 * generador i el navegador per escriure el valor: van al JSON de la pàgina
 * perquè el JavaScript no hagi de saber res més de la mètrica.
 */
export type Metrica = {
  id: string;
  titol: string;
  valor: (r: RankingRow) => number | null | undefined;
  /** El període de la dada d'aquesta fila: un any, o un text quan és un mandat o una sèrie. */
  periode: (r: RankingRow) => number | string | null | undefined;
  decimals: number;
  sufix: string;
  font: string;
  metode: string;
  cautela: string;
  /**
   * L'escala del regle de dispersió (vegeu `EscalaRegle` a `grafics.ts`).
   * Lineal si no es diu. La població, els vehicles i el creixement del cens
   * són les tres xifres esbiaixades: uns quants municipis molt grans o que
   * han crescut molt estiren el regle i, en lineal, 900 marques queden
   * amuntegades a l'esquerra.
   */
  escala?: EscalaRegle;
  /**
   * Quan la mètrica no arriba al 90 % per una raó que es pot dir.
   *
   * El llindar general és el 90 % dels municipis amb el mateix període. Hi ha
   * xifres que no hi arribaran mai i no per cap forat: el lloguer només es
   * publica on hi ha prou contractes, el vot perdut no quadra mai als
   * municipis de llistes obertes, i un percentatge de licitacions sobre dues
   * licitacions no és un percentatge. Aquestes mètriques baixen el llindar
   * —mai per sota del que el `motiu` justifica— i la secció ho diu amb el
   * recompte de debò: «hi surten 547 dels 947».
   */
  cobertura?: { minima: number; motiu: string };
  /**
   * El regle de dispersió el dibuixa el navegador. Les marques del regle són
   * la meitat del pes de la pàgina —uns 150 kB per indicador—, i és un dibuix
   * per al ratolí (`aria-hidden`): sense JavaScript queden les tres xifres de
   * sota, el més baix, la mediana i el més alt, que són el que es llegeix.
   */
  diferit?: boolean;
  /**
   * Escriu, sota el mètode, la mediana de cada grup de mida. Per a les xifres
   * que depenen tant de la mida que comparar-les amb tot Catalunya enganya:
   * una sola oferta és habitual a un poble de 400 habitants i rara a una
   * ciutat, i el lector ho ha de veure abans de mirar la llista.
   */
  perGrups?: boolean;
  /**
   * Una segona manera de triar dins del rànquing, a més de la mida: una
   * categoria descriptiva de cada municipi (com es gestiona l'aigua, quina
   * figura té el pla urbanístic). Va amb la mediana de cada categoria i no
   * en fa cap judici: dir quina és més cara no diu per què.
   */
  filtre?: {
    etiqueta: string;
    categoria: (r: RankingRow) => string | null;
    /** Les categories en l'ordre del desplegable, amb el nom que s'escriu. */
    noms: Readonly<Record<string, string>>;
  };
};

const finit = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** El període d'una xifra de les municipals del 2023: «2023» quan la fila en té, res quan no. */
const del2023 = (v: number | null | undefined): number | null => (finit(v) ? ANY_MUNICIPALS : null);

/**
 * Com es vota, qui pot votar i com es contracta: xifres que la fitxa ja
 * ensenyava i que no tenien rànquing. Totes van amb el regle diferit (vegeu
 * `diferit`): amb el regle escrit pel servidor, cada indicador hi sumaria 150 kB.
 */
const METRIQUES_POLITIQUES: readonly Metrica[] = [
  {
    id: "veins-voten", titol: "Veïns que poden votar a les municipals",
    valor: (r) => r.vv, periode: (r) => del2023(r.vv),
    decimals: 1, sufix: " %", diferit: true, perGrups: true,
    font: "Generalitat de Catalunya · processos electorals, i Idescat · padró municipal",
    metode: "Electors del cens de les municipals del 2023 sobre els habitants del padró a 1 de gener del 2023.",
    cautela: "No és cap valoració. Hi voten les persones de nacionalitat espanyola i les de la Unió Europea —i d'uns quants països amb conveni— que s'han inscrit al cens; no hi voten els menors d'edat ni la resta de veïns estrangers. " +
      "Per això surt baixa on hi viu molta gent estrangera o molt jove. Pot passar del 100 %: el padró i el cens es tanquen en dates diferents, i en un poble molt petit unes quantes altes basten.",
  },
  {
    id: "fragmentacio", titol: "Fragmentació del ple",
    valor: (r) => r.ne, periode: (r) => del2023(r.ne),
    decimals: 2, sufix: "", diferit: true, perGrups: true,
    font: "Generalitat de Catalunya · resultats de les municipals",
    metode: "Nombre efectiu de partits (índex de Laakso-Taagepera) sobre les regidories del ple que va sortir de les municipals del 2023: " +
      "1 vol dir que totes les regidories són d'una sola llista, i 3, un repartiment que equival a tres llistes iguals.",
    cautela: "Mesura com de repartit és el ple, no com es governa. Un ple de cinc regidories no pot repartir-se tant com un de vint-i-cinc: compareu-lo amb els municipis de la mateixa mida.",
  },
  {
    id: "volatilitat", titol: "Volatilitat electoral",
    valor: (r) => r.vol, periode: (r) => (finit(r.vola) ? `${r.vola - 4}-${r.vola}` : null),
    decimals: 1, sufix: "", diferit: true,
    cobertura: {
      minima: 0.8,
      motiu: "Hi falten els municipis on el càlcul del 2019 al 2023 no és fiable perquè massa regidories són de llistes locals que canvien de nom d'una elecció a l'altra.",
    },
    font: "Consorci AOC · resultats municipals històrics",
    metode: "Índex de Pedersen entre les municipals del 2019 i les del 2023, sobre les quotes de regidories: 0 vol dir un ple calcat a l'anterior i 100, que no en queda res.",
    cautela: "Un ple que es mou molt no és ni millor ni pitjor que un que no es mou: pot ser una llista nova, una escissió o un canvi de nom. Als plens petits una sola regidoria mou molt l'índex.",
  },
  {
    id: "vot-perdut", titol: "Vot sense representació",
    valor: (r) => r.vp, periode: (r) => del2023(r.vp),
    decimals: 1, sufix: " %", diferit: true,
    cobertura: {
      minima: 0.75,
      motiu: "Hi falten sobretot els municipis de llistes obertes, fins a 250 habitants: allà els vots per candidatura de la font no quadren mai amb els emesos, i la xifra no es pot calcular sencera.",
    },
    font: "Generalitat de Catalunya · resultats de les municipals",
    metode: "Part dels vots emesos el 2023 que no va arribar a cap regidoria: vots a llistes que no van treure cap escó, més nuls i blancs.",
    cautela: "Depèn sobretot de quantes llistes es presenten i de la barrera del 5 %. No parla de cap govern: diu quanta gent va votar una opció que no és al ple.",
  },
  {
    id: "ultima-regidoria", titol: "Vots que van decidir l'última regidoria",
    valor: (r) => r.mg, periode: (r) => del2023(r.mg),
    decimals: 0, sufix: " vots", escala: "log", diferit: true, perGrups: true,
    cobertura: {
      minima: 0.6,
      motiu: "Hi falten els municipis on el recompte no reprodueix els escons oficials o va caldre un sorteig, i els de llista oberta sense el vot nominal de cada persona.",
    },
    font: "Generalitat de Catalunya · resultats de les municipals, i Ministeri de l'Interior per a les llistes obertes",
    metode: "Quants vots de més li calien a la llista —o, en llista oberta, a la persona— que va quedar més a prop de prendre l'última regidoria del 2023, amb tota la resta igual. " +
      "A baix de tot hi ha els plens que es van decidir per menys vots.",
    cautela: "És aritmètica sobre els resultats oficials, no una predicció del 2027. Com més gran és el municipi, més vots calen per a una regidoria: compareu-lo amb els de la mateixa mida.",
  },
  {
    id: "forca-alcaldia", titol: "Anys de la mateixa força a l'alcaldia",
    valor: (r) => r.cfa, periode: (r) => (finit(r.cfa) && finit(r.cra) ? `fins al ${r.cra}` : null),
    decimals: 0, sufix: " anys", diferit: true,
    font: "Generalitat de Catalunya · historial d'alcaldies",
    metode: "Anys seguits que la força que avui té l'alcaldia l'ha tinguda, comptats fins a l'any de referència. La força es reconeix per la família de les sigles, encara que canviï la persona.",
    cautela: "Una ratxa llarga pot ser una majoria estable o la falta d'alternativa, i la xifra no ho distingeix. Del 2011 al 2023 la font no dona la data de la presa de possessió i l'inici de la ratxa és aproximat.",
  },
  {
    id: "una-oferta", titol: "Licitacions amb una sola oferta",
    valor: (r) => r.uo, periode: (r) => (finit(r.uo) ? r.uop : null),
    decimals: 0, sufix: " %", diferit: true, perGrups: true,
    cobertura: {
      minima: 0.3,
      motiu: "Només hi surten els municipis amb cinc licitacions o més que diguin quantes ofertes van rebre: sobre dues licitacions, un percentatge no vol dir res.",
    },
    font: "Plataforma de Serveis de Contractació Pública, via dades obertes de l'AOC",
    metode: "De les licitacions adjudicades per l'ajuntament en el període indicat a dalt que diuen quantes ofertes van rebre, quina part en va rebre només una. Es compta tot el període junt, no any a any.",
    cautela: "Una sola oferta no és cap irregularitat: als pobles petits sovint no hi ha més empreses que s'hi presentin, i depèn de què es contracta. Pesa tant la mida que cal mirar-lo amb els municipis de la mateixa mida.",
  },
];

/** Pisos turístics, lloguer, habitatge protegit i planejament: la fitxa ho tenia, el rànquing no. */
const METRIQUES_HABITATGE: readonly Metrica[] = [
  {
    id: "pisos-turistics", titol: "Pisos turístics per 100 habitants",
    valor: (r) => r.hut, periode: (r) => (finit(r.hut) ? r.huta : null),
    decimals: 2, sufix: "", diferit: true,
    font: "Registre de Turisme de Catalunya · habitatges d'ús turístic",
    metode: "HUT en alta al registre el dia de la consulta, per cada 100 habitants del padró.",
    cautela: "Només els inscrits; als pobles petits pocs pisos mouen molt la taxa. El planejament el fa l'ajuntament; la llicència la regula el Decret llei 3/2023.",
  },
  {
    id: "lloguer", titol: "Lloguer mitjà",
    valor: (r) => r.ll, periode: (r) => (finit(r.ll) ? r.lla : null),
    decimals: 0, sufix: " € al mes", diferit: true,
    cobertura: {
      minima: 0.4,
      motiu: "Només hi surten els municipis amb prou contractes perquè l'Agència de l'Habitatge en publiqui el preu: als pobles petits sovint no n'hi ha prou.",
    },
    font: "Agència de l'Habitatge de Catalunya · fiances de lloguer",
    metode: "Preu mitjà mensual dels contractes de lloguer amb fiança dipositada, de l'últim any publicat.",
    cautela: "És la mitjana dels contractes nous de l'any, no el que paguen tots els llogaters, i depèn de quins pisos es lloguen. L'ajuntament hi té poques eines.",
  },
  {
    id: "lloguer-canvi", titol: "Com ha canviat el lloguer des del 2023",
    valor: (r) => r.llv, periode: (r) => (finit(r.llv) ? r.llp : null),
    decimals: 1, sufix: " %", diferit: true,
    cobertura: {
      minima: 0.4,
      motiu: "Només hi surten els municipis amb el preu publicat el 2023 i l'últim any: als pobles petits sovint no hi ha prou contractes.",
    },
    font: "Agència de l'Habitatge de Catalunya · fiances de lloguer",
    metode: "Variació del preu mitjà del lloguer entre el 2023, el primer any del mandat, i l'últim any publicat.",
    cautela: "Amb pocs contractes, uns quants pisos cars o barats mouen molt la mitjana. Depèn del mercat de la zona més que de cap decisió municipal.",
  },
  {
    id: "habitatge-protegit", titol: "Habitatge protegit acabat des del 2023",
    valor: (r) => r.hpo, periode: (r) => (finit(r.hpo) ? r.hpop : null),
    decimals: 1, sufix: " per 1.000 hab.", diferit: true,
    font: "Departament de Territori · habitatges amb protecció oficial iniciats i acabats",
    metode: "Habitatges amb protecció oficial acabats des del 2023 fins al darrer any publicat, per cada 1.000 habitants del padró vigent.",
    cautela: "Els promouen la Generalitat, els ajuntaments, cooperatives i empreses, i una sola promoció mou molt la xifra d'un poble petit. Zero vol dir que la font no en compta cap d'acabat aquests anys.",
  },
  {
    id: "pla-urbanistic", titol: "Antiguitat del pla urbanístic",
    valor: (r) => r.pla, periode: (r) => (finit(r.pla) ? r.plaa : null),
    decimals: 0, sufix: " anys", diferit: true,
    font: "Departament de Territori · Observatori del Territori",
    metode: "Anys que fa que es va aprovar el pla urbanístic general vigent. Es pot triar per figura: el POUM és la d'ara; " +
      "les normes subsidiàries (NNSS) i els altres plans generals són d'abans de la Llei d'urbanisme del 2002.",
    cautela: "Un pla vell no és un pla dolent ni un de nou, un de bo: diu quan es va fer. Revisar-lo és car i llarg, i als pobles petits sovint no cal.",
    filtre: {
      etiqueta: "Figura",
      categoria: (r) => (!finit(r.pla) ? null : r.plas === "POUM" ? "poum" : r.plas === "NNSS" ? "nnss" : "altres"),
      noms: { poum: "POUM", nnss: "Normes subsidiàries", altres: "Altres figures" },
    },
  },
];

export const METRIQUES: readonly Metrica[] = [
  {
    id: "poblacio", titol: "Població",
    valor: (r) => (finit(r.p) ? r.p : null), periode: () => "padró vigent",
    decimals: 0, sufix: "", escala: "log",
    font: "Generalitat de Catalunya · dades generals dels ens locals",
    metode: "Habitants del padró vigent, en nombres absoluts.",
    cautela: "La població és context: no valora cap govern municipal.",
  },
  {
    id: "participacio", titol: "Participació a les municipals",
    valor: (r) => r.pt, periode: () => 2023,
    decimals: 2, sufix: "%",
    font: "Generalitat de Catalunya · processos electorals",
    metode: "Votants sobre el cens a les eleccions municipals del 2023.",
    cautela: "La mida del municipi i la competència electoral pesen molt en la participació: un poble de trenta veïns arriba al cent per cent amb més facilitat que una ciutat.",
  },
  {
    id: "renda", titol: "Renda de les llars",
    valor: (r) => r.rm, periode: (r) => r.rma,
    decimals: 0, sufix: " €",
    font: "INE · Atles de distribució de renda de les llars",
    metode: "Mediana anual de la renda per unitat de consum, el mateix any i la mateixa definició per a tothom.",
    cautela: "Descriu les llars que hi viuen, no els recursos de l'ajuntament ni l'efecte del govern municipal.",
  },
  {
    id: "selectiva", titol: "Recollida selectiva",
    valor: (r) => r.rs, periode: (r) => r.rsa,
    decimals: 1, sufix: "%",
    font: "Agència de Residus de Catalunya",
    metode: "Percentatge brut de recollida selectiva sobre els residus municipals.",
    cautela: "El percentatge brut inclou impropis i depèn del model de recollida i de la població estacional.",
  },
  {
    id: "aigua", titol: "Preu de l'aigua",
    // Un zero aquí no és un preu: és un municipi que no publica cap tarifa de
    // subministrament (dotze pobles del Pirineu, el 2025). A la fitxa es diu
    // tal com ve; al rànquing, «el més barat: 0,000 €» seria una comparació
    // falsa, i per això el zero es tracta com a absència. Decisió editorial
    // de l'1-09-2026.
    // La regla és `preuAiguaComparable()`, la mateixa que fan servir el mapa i el comparador.
    valor: (r) => preuAiguaComparable(r.pa), periode: (r) => r.paa,
    decimals: 3, sufix: " €/m³",
    font: "Agència Catalana de l'Aigua · Observatori del preu de l'aigua",
    metode: "Tram de subministrament domèstic, amb el mateix consum de referència per a tothom. " +
      "Es pot triar per model de gestió: directa, quan presta el servei el mateix ajuntament o un ens seu, o indirecta, quan el presta una empresa per concessió o una societat mixta.",
    cautela: "El preu no mesura la qualitat del servei: depèn dels costos físics de portar l'aigua i de com és l'estructura tarifària. " +
      "Que un model surti més car o més barat no vol dir que el model en sigui la causa: canvien alhora la mida, l'orografia i d'on ve l'aigua.",
    filtre: {
      etiqueta: "Gestió",
      categoria: (r) => (r.pag === "directa" || r.pag === "indirecta" ? r.pag : null),
      noms: { directa: "Gestió directa", indirecta: "Gestió indirecta" },
    },
  },
  {
    id: "ibi", titol: "Rebut mitjà d'IBI urbà",
    valor: (r) => r.ibi, periode: (r) => r.ibia,
    decimals: 2, sufix: " €",
    font: "Idescat · impost sobre béns immobles urbans",
    metode: "Quota íntegra urbana dividida pel nombre de rebuts de l'exercici.",
    cautela: "Depèn alhora del tipus que fixa l'ajuntament i dels valors cadastrals dels immobles, que no els fixa ell.",
  },
  {
    id: "vehicles", titol: "Vehicles per 1.000 habitants",
    // Una flota de rènting domiciliada (Rajadell: 44.737 per 1.000) no és
    // comparable amb res: es deixa fora del rànquing i es diu a les curiositats.
    valor: (r) => (finit(r.veh) && !esFlota(r.veh) ? r.veh : null), periode: (r) => r.veha,
    decimals: 0, sufix: " per 1.000 hab.", escala: "log",
    font: "Idescat, a partir de la DGT · parc de vehicles",
    metode: "Vehicles amb permís de circulació domiciliats al municipi, per cada 1.000 habitants del padró de l'any de la dada. " +
      "Els municipis amb més de dos vehicles per habitant queden fora: són flotes d'empreses de rènting domiciliades, no els vehicles dels veïns, i surten a les curiositats.",
    cautela: "Compta els vehicles domiciliats, no els que hi circulen: una empresa de lloguer o una flota d'autocars poden posar-hi més vehicles que veïns, i als pobles petits cent vehicles mouen molt la taxa. Depèn del transport públic i de la dispersió, no del govern municipal.",
  },
  {
    id: "cens", titol: "Creixement del cens des del 1979",
    // Només els que tenen dada del 1979: un municipi segregat el 1994 no es
    // pot comparar amb els altres en el mateix tram de temps, i el període
    // ha de ser el mateix per a tothom perquè el rànquing digui una cosa.
    valor: (r) => (finit(r.creixCens) && r.censDes === 1979 ? r.creixCens : null),
    periode: (r) => (r.censDes === 1979 ? "1979-2023" : null),
    decimals: 1, sufix: " %", escala: "log-creixement",
    font: "Generalitat de Catalunya · processos electorals, participació",
    metode: "El cens electoral de les municipals del 2023 respecte del de les del 1979, en percentatge. Els municipis que el 1979 encara no existien queden fora i surten a les curiositats.",
    cautela: "El cens creix amb la gent que arriba i fa divuit anys, i minva amb la que marxa o mor: és demografia, no gestió, i als pobles petits pocs centenars d'electors mouen molt el percentatge.",
  },
  {
    id: "alternances", titol: "Canvis de força més votada",
    valor: (r) => (finit(r.v) && r.q === 12 ? r.v : null), periode: () => "1979-2023",
    decimals: 0, sufix: " canvis",
    font: "Consorci AOC i Generalitat · resultats municipals històrics",
    metode: "Quantes vegades ha canviat la llista més votada, només als municipis amb dada a les dotze eleccions municipals.",
    cautela: "Compta canvis de sigles guanyadores: no necessàriament canvis d'alcaldia ni de bloc.",
  },
  ...METRIQUES_POLITIQUES,
  ...METRIQUES_HABITATGE,
];

// ------------------------------------------------------------- preparació

export type FilaRanquing = { fila: RankingRow; valor: number; grup: PeerGroup };

export type RanquingPreparat = {
  metrica: Metrica;
  /** El període de la cohort publicada, ja escrit: «2023», «mandat 2023-2027». */
  periode: string;
  /** De més a menys valor, i per nom quan empaten. */
  files: FilaRanquing[];
  observades: number;
  total: number;
};

export type Extrem = { valor: number; files: readonly RankingRow[] };

/** Els grups de mida, del més gran al més petit, que és l'ordre del desplegable. */
function grupsOrdenats(rows: readonly RankingRow[], perFila: Map<number, PeerGroup>): PeerGroup[] {
  const maxim = new Map<string, { grup: PeerGroup; poblacio: number }>();
  rows.forEach((r, id) => {
    const grup = perFila.get(id);
    if (!grup) return;
    const actual = maxim.get(grup.key);
    if (!actual || r.p > actual.poblacio) maxim.set(grup.key, { grup, poblacio: r.p });
  });
  return [...maxim.values()].sort((a, b) => b.poblacio - a.poblacio).map((x) => x.grup);
}

/**
 * Aplica els llindars i ordena. Una mètrica que no arribi al 90 % i vint
 * valors en un mateix període no es publica, i no cal cap avís a la pàgina:
 * la seva absència ja és el missatge, i el bloc de mètode explica el criteri.
 */
export function preparaRanquings(rows: readonly RankingRow[]): RanquingPreparat[] {
  const perFila = buildPeerGroups(rows.map((r, id) => ({ id, population: r.p })));
  const index = new Map(rows.map((r, i) => [r, i]));
  return METRIQUES.flatMap((metrica) => {
    const cohort = cohortHomogenia(
      rows,
      (r) => ({ valor: metrica.valor(r), periode: metrica.periode(r) }),
      metrica.cobertura?.minima ?? 0.9,
    );
    if (!cohort) return [];
    const files = cohort.files.flatMap(({ fila, valor }) => {
      const grup = perFila.get(index.get(fila) ?? -1);
      return grup ? [{ fila, valor, grup }] : [];
    });
    files.sort((a, b) => b.valor - a.valor || a.fila.n.localeCompare(b.fila.n, "ca"));
    return [{ metrica, periode: cohort.periode, files, observades: cohort.observades, total: cohort.total }];
  });
}

/** Els dos extrems d'un rànquing, amb tots els empats. */
export function extrems(r: RanquingPreparat): { alt: Extrem; baix: Extrem } | null {
  const valors = r.files.map((f) => ({ fila: f.fila, valor: f.valor }));
  const alt = extremsEmpatats(valors, "max");
  const baix = extremsEmpatats(valors, "min");
  return alt && baix ? { alt, baix } : null;
}

// ------------------------------------------------------------------ peces

const format = (m: Metrica) => (v: number): string => `${n(v, m.decimals)}${m.sufix}`;

const fitxa = (r: RankingRow): string => `<a href="../m/${escape(r.s)}/">${escape(r.n)}</a>`;
/** La comarca, en petit i enllaçada a la seva pàgina: és l'altra manera d'agrupar els 947. */
const comarca = (r: RankingRow): string => `<a class="comarca" href="../c/${escape(slugify(r.c))}/">${escape(r.c)}</a>`;

/**
 * Els empatats, escrits com una frase: «Fulleda, Esterri de Cardós i Granyena
 * de les Garrigues». A partir de cinc, els quatre primers i «i 8 més», perquè
 * una targeta no és el lloc per a una llista de dotze pobles; el rànquing de
 * sota els té tots.
 */
function llistaNoms(files: readonly RankingRow[], ancora: string): string {
  const ordenats = [...files].sort((a, b) => a.n.localeCompare(b.n, "ca"));
  const noms = ordenats.slice(0, 4).map(fitxa);
  const resta = ordenats.length - noms.length;
  if (resta > 0) noms.push(`<a href="#${escape(ancora)}">i ${n(resta)} més</a>`);
  if (noms.length === 1) return noms[0]!;
  return `${noms.slice(0, -1).join(", ")} i ${noms[noms.length - 1]}`;
}

/** Una targeta de «Destaquen»: la mètrica, el més alt i el més baix, amb empats. */
function targetaExtrems(r: RanquingPreparat): string {
  const e = extrems(r);
  if (!e) return "";
  const fmt = format(r.metrica);
  const pol = (classe: string, cap: string, x: Extrem): string =>
    `<div class="pol ${classe}"><span class="cap">${cap}</span><b>${escape(fmt(x.valor))}</b>
      <span class="qui">${x.files.length > 1 ? `<i>${n(x.files.length)} empatats:</i> ` : ""}${llistaNoms(x.files, r.metrica.id)}</span></div>`;
  return `<li class="extrem">
    <a class="quina" href="#${escape(r.metrica.id)}"><span class="micro">${escape(r.periode)}</span><b>${escape(r.metrica.titol)}</b><span class="secundari">${n(r.files.length)} municipis</span></a>
    ${pol("alt", "El més alt", e.alt)}
    ${pol("baix", "El més baix", e.baix)}
  </li>`;
}

/**
 * Els noms d'una marca del regle, escrits com una frase: «Fulleda»,
 * «Fulleda i Sarroca», «Fulleda, Sarroca i Vinaixa» i, a partir de quatre,
 * «Fulleda, Sarroca, Vinaixa i 9 més». Tres i no quatre com a `llistaNoms()`:
 * l'etiqueta flotant és una caixa de 320 píxels i el rànquing de sota ja els
 * té tots. El navegador fa exactament el mateix a `noms()` del script.
 */
export function nomsMarca(noms: readonly string[]): string {
  const ordenats = [...noms].sort((a, b) => a.localeCompare(b, "ca"));
  const tres = ordenats.slice(0, 3);
  const resta = ordenats.length - tres.length;
  if (resta > 0) return `${tres.join(", ")} i ${n(resta)} més`;
  if (tres.length === 1) return tres[0]!;
  return `${tres.slice(0, -1).join(", ")} i ${tres[tres.length - 1]}`;
}

/**
 * «1r», «2n», «3r», «4t» i, de cinc en amunt, sempre «è»: «5è», «12è», «947è».
 * El navegador fa el mateix a `ordinal()` del script.
 */
export function ordinal(pos: number): string {
  const cua = pos === 1 ? "r" : pos === 2 ? "n" : pos === 3 ? "r" : pos === 4 ? "t" : "è";
  return `${n(pos)}${cua}`;
}

/**
 * On cau una marca al rànquing: «el 3r de 24» o, quan a la mateixa marca hi
 * cauen diversos municipis, «del 12è al 15è de 947». La posició és la de la
 * llista, que va de més a menys valor.
 */
export function posicioMarca(posicions: readonly number[], total: number): string {
  const primer = Math.min(...posicions);
  const darrer = Math.max(...posicions);
  return primer === darrer ? `el ${ordinal(primer)} de ${n(total)}` : `del ${ordinal(primer)} al ${ordinal(darrer)} de ${n(total)}`;
}

/**
 * Una diferència escrita amb signe i amb la unitat de la mètrica: «+3,20%»,
 * «−12 €». El menys és el de debò (−), no el guionet. Una diferència que
 * arrodonida no es veu és «igual», no un «+0,00%» que fa pensar que n'hi ha.
 */
export function ambSigne(v: number, fmt: (v: number) => string): string {
  const absolut = fmt(Math.abs(v));
  if (absolut === fmt(0)) return "igual";
  return `${v > 0 ? "+" : "−"}${absolut}`;
}

/**
 * Com de lluny és una marca de la mediana. Com a `valorMarca()`, si a la
 * marca hi cauen valors veïns és «de +2 a +5», que és el que la marca diu.
 */
export function respecteMediana(valors: readonly number[], mediana: number, fmt: (v: number) => string): string {
  const difs = valors.map((v) => v - mediana);
  const baix = Math.min(...difs);
  const alt = Math.max(...difs);
  return baix === alt ? ambSigne(baix, fmt) : `de ${ambSigne(baix, fmt)} a ${ambSigne(alt, fmt)}`;
}

/** La mediana de tots els valors d'un rànquing: el del mig o, si són parells, la mitjana dels dos del mig. */
export function medianaDe(valors: readonly number[]): number {
  const asc = [...valors].sort((a, b) => a - b);
  const meitat = Math.floor(asc.length / 2);
  return asc.length % 2 === 0 ? (asc[meitat - 1]! + asc[meitat]!) / 2 : asc[meitat]!;
}

/**
 * El valor d'una marca. Dues marques a la mateixa dècima de tant per cent
 * són una, i no sempre tenen el mateix valor: a un regle de 947 municipis en
 * 920 posicions possibles hi cauen valors veïns que no són iguals. Si ho són,
 * la xifra; si no, «de X a Y», que és el que la marca vol dir de debò.
 */
export function valorMarca(valors: readonly number[], fmt: (v: number) => string): string {
  const baix = Math.min(...valors);
  const alt = Math.max(...valors);
  return baix === alt ? fmt(baix) : `de ${fmt(baix)} a ${fmt(alt)}`;
}

/**
 * El regle de dispersió d'aquest rànquing, escrit pel servidor per a l'àmbit
 * inicial. Fa el mateix dibuix que `regleDispersio()` de `grafics.ts` i en
 * reutilitza el CSS, però no en crida la funció per dues raons: aquella posa
 * un enllaç per municipi —947 enllaços en una barra de 46 píxels no són
 * clicables i pesen 130 bytes cadascun— i la mediana la calcula del que
 * dibuixa, i aquí les marques es resumeixen (dues a la mateixa posició són
 * una) mentre que la mediana ha de ser la de tots. El navegador refà aquest
 * mateix dibuix quan canvia l'àmbit, amb `regle()` del JavaScript de sota.
 *
 * Cada marca porta l'etiqueta comuna de `grafics.ts` —`data-nom` amb els
 * municipis d'aquella posició, `data-valor` amb la xifra, i als `data-extres`
 * la posició al rànquing i la distància a la mediana— i el `title=` amb la
 * mateixa frase per a quan no hi ha script. La barra és `aria-hidden` i
 * les marques no reben el focus: les tres xifres de sota i el rànquing són
 * l'equivalent que es llegeix; el regle és per al ratolí i el dit.
 */
function regle(r: RanquingPreparat): string {
  if (r.files.length < 4) return "";
  const fmt = format(r.metrica);
  const asc = [...r.files].reverse();
  const baix = asc[0]!;
  const alt = asc[asc.length - 1]!;
  if (alt.valor === baix.valor) return "";
  const mig = medianaDe(asc.map((f) => f.valor));
  // On cau cada xifra, amb l'escala de la mètrica: la mateixa funció que el
  // navegador fa servir quan refà el regle.
  const escala = r.metrica.escala ?? "lineal";
  const on = (v: number): string => posicioEscala(v, baix.valor, alt.valor, escala).toFixed(1);
  const eix = eixDispersio(baix.valor, alt.valor, escala, escape(fmt(baix.valor)), escape(fmt(alt.valor)));
  // La posició de cada fila és la de la llista, que va de més a menys.
  const posicio = new Map(r.files.map((f, i) => [f, i + 1]));
  const perPosicio = new Map<string, FilaRanquing[]>();
  for (const f of asc) {
    const p = on(f.valor);
    const colla = perPosicio.get(p);
    if (colla) colla.push(f);
    else perPosicio.set(p, [f]);
  }
  const marques = [...perPosicio]
    .map(([p, colla]) => {
      const valors = colla.map((f) => f.valor);
      const dada: DadaEtiqueta = {
        nom: nomsMarca(colla.map((f) => f.fila.n)),
        valor: valorMarca(valors, fmt),
        extres: [
          { etq: "posició", valor: posicioMarca(colla.map((f) => posicio.get(f) ?? 0), r.files.length) },
          { etq: "respecte a la mediana", valor: respecteMediana(valors, mig, fmt) },
        ],
      };
      return `<i class="marca" style="--p:${p}%"${etiqueta(dada)}></i>`;
    })
    .join("");
  // La mediana diu de quants municipis és i entre quins extrems: sense
  // això, «49,50 %» al mig d'una barra no diu res.
  const mediana: DadaEtiqueta = {
    nom: "La mediana",
    valor: fmt(mig),
    extres: [
      { etq: "municipis", valor: n(r.files.length) },
      { etq: "del més baix al més alt", valor: `de ${fmt(baix.valor)} a ${fmt(alt.valor)}` },
    ],
  };
  return `<figure class="dispersio">
  <figcaption class="titol">Del més baix al més alt <span class="secundari">${n(r.files.length)} municipis amb dada</span>${
    eix.log ? `<span class="escala">${NOTA_ESCALA_LOG}</span>` : ""
  }</figcaption>
  <div class="regle-dispersio" aria-hidden="true">${eix.linies}<i class="mig" style="--p:${on(mig)}%"${etiqueta(mediana)}></i>${marques}</div>
  ${eix.eix}
  ${llistaExtrems(baix, mig, alt, fmt)}
</figure>`;
}

/** El més baix, la mediana i el més alt: les tres xifres de sota el regle, que es llegeixen sense ell. */
function llistaExtrems(baix: FilaRanquing, mig: number, alt: FilaRanquing, fmt: (v: number) => string): string {
  return `<ul class="extrems">
    <li><span class="cap">El més baix</span>${fitxa(baix.fila)}<b>${escape(fmt(baix.valor))}</b></li>
    <li><span class="cap">La mediana</span><span class="secundari">el municipi del mig</span><b>${escape(fmt(mig))}</b></li>
    <li><span class="cap">El més alt</span>${fitxa(alt.fila)}<b>${escape(fmt(alt.valor))}</b></li>
  </ul>`;
}

/**
 * El regle d'una mètrica `diferit`: el títol, la barra buida i les tres
 * xifres. El navegador hi dibuixa les marques en arrencar amb la mateixa
 * funció `regle()` que fa servir quan canvia l'àmbit; sense JavaScript queden
 * les tres xifres, que és el que el regle diu en text. La barra va buida i no
 * absent perquè la pàgina no salti quan s'omple.
 */
function regleDiferit(r: RanquingPreparat): string {
  if (r.files.length < 4) return "";
  const fmt = format(r.metrica);
  const baix = r.files[r.files.length - 1]!;
  const alt = r.files[0]!;
  if (alt.valor === baix.valor) return "";
  const mig = medianaDe(r.files.map((f) => f.valor));
  return `<figure class="dispersio" data-diferit>
  <figcaption class="titol">Del més baix al més alt <span class="secundari">${n(r.files.length)} municipis amb dada</span></figcaption>
  <div class="regle-dispersio" aria-hidden="true"></div>
  ${llistaExtrems(baix, mig, alt, fmt)}
</figure>`;
}

/**
 * Per què una mètrica té menys municipis que les altres, amb el recompte de
 * debò. Només quan la mètrica ha baixat el llindar (`cobertura`) i en falta
 * algun: si hi són tots, no cal dir res.
 */
function notaCobertura(r: RanquingPreparat): string {
  const c = r.metrica.cobertura;
  if (!c || r.observades >= r.total) return "";
  return `<p class="cobertura">${escape(c.motiu)} Hi surten ${n(r.observades)} dels ${n(r.total)} municipis.</p>`;
}

/**
 * Una frase de medianes: «fins a 100 habitants: 17 % (40)». Els grups amb
 * menys de cinc municipis no hi surten, perquè la mediana de tres valors és
 * un d'ells i no descriu el grup.
 */
function fraseMedianes(
  titol: string,
  parts: readonly { nom: string; valors: readonly number[] }[],
  fmt: (v: number) => string,
): string {
  const escrites = parts
    .filter((p) => p.valors.length >= 5)
    .map((p) => `${p.nom}: ${fmt(medianaDe(p.valors))} (${n(p.valors.length)})`);
  if (escrites.length < 2) return "";
  return `<p class="per-grups"><b>${escape(titol)}</b> <span class="secundari">(entre parèntesis, quants municipis)</span>: ${escape(escrites.join(" · "))}.</p>`;
}

/** La mediana de cada grup de mida, del més petit al més gran, per a les mètriques `perGrups`. */
function medianesPerGrup(r: RanquingPreparat, grups: readonly PeerGroup[]): string {
  if (!r.metrica.perGrups) return "";
  const parts = [...grups].reverse().map((g) => ({
    nom: g.label,
    valors: r.files.filter((f) => f.grup.key === g.key).map((f) => f.valor),
  }));
  return fraseMedianes("La mediana de cada mida", parts, format(r.metrica));
}

/** La mediana de cada categoria del filtre: descriu, no explica per què. */
function medianesPerCategoria(r: RanquingPreparat): string {
  const filtre = r.metrica.filtre;
  if (!filtre) return "";
  const parts = Object.entries(filtre.noms).map(([clau, nom]) => ({
    nom,
    valors: r.files.filter((f) => filtre.categoria(f.fila) === clau).map((f) => f.valor),
  }));
  return fraseMedianes(`La mediana per ${filtre.etiqueta.toLocaleLowerCase("ca")}`, parts, format(r.metrica));
}

/** El segon desplegable, quan la mètrica en té: les categories amb quants municipis hi ha a cadascuna. */
function selectorFiltre(r: RanquingPreparat): string {
  const filtre = r.metrica.filtre;
  if (!filtre) return "";
  const opcions = Object.entries(filtre.noms)
    .map(([clau, nom]) => {
      const quants = r.files.filter((f) => filtre.categoria(f.fila) === clau).length;
      return quants > 0 ? `<option value="${escape(clau)}">${escape(nom)} (${n(quants)})</option>` : "";
    })
    .join("");
  return `<label>${escape(filtre.etiqueta)} <select data-filtre><option value="">Totes</option>${opcions}</select></label>`;
}

/** Els `data-*` de l'etiqueta flotant i el `title=` amb la mateixa frase, per a quan no hi ha script. */
const etiqueta = (dada: DadaEtiqueta): string => `${atributsEtiqueta(dada)} title="${escape(textEtiqueta(dada))}"`;

/** Quantes files escriu el servidor i quantes n'afegeix cada «Mostra'n més». */
export const PAS = 40;

/**
 * Quantes files de dalt i quantes de baix es veuen sense obrir res.
 *
 * Cada rànquing escrivia 40 files obertes: a 360 px eren 4.100 px per
 * indicador, i la pàgina sencera passava dels 95.000. El que la gent busca
 * d'un rànquing és qui és a dalt de tot i qui a baix de tot; el mig es
 * consulta. Per això es veuen els cinc primers i els cinc últims, i entre
 * mig hi ha un `<details>` «Veure'n els 40 primers» amb la resta. Les 40
 * files continuen escrites a l'HTML —dins del calaix— perquè sense
 * JavaScript, i per als cercadors, la llista hi sigui sencera.
 */
export const VISIBLES = 5;

/**
 * Una fila de la llista. El valor ja és visible; l'etiqueta que surt en
 * passar-hi per sobre hi afegeix el context que la fila no té lloc per dir:
 * la comarca, la posició de quants i com de lluny és de la mediana. El
 * navegador escriu la mateixa fila a `pinta()` quan canvia l'àmbit.
 */
function filaHtml(
  f: FilaRanquing, pos: number, total: number, mediana: number, fmt: (v: number) => string,
  categoria: { etq: string; valor: string } | null = null,
): string {
  const dada: DadaEtiqueta = {
    nom: f.fila.n,
    valor: fmt(f.valor),
    extres: [
      { etq: "comarca", valor: f.fila.c },
      // La categoria del filtre (la gestió de l'aigua, la figura del pla), quan la mètrica en té.
      ...(categoria ? [categoria] : []),
      { etq: `posició de ${n(total)}`, valor: ordinal(pos) },
      { etq: "respecte a la mediana", valor: ambSigne(f.valor - mediana, fmt) },
    ],
  };
  return `<li${etiqueta(dada)}><span class="pos">${pos}</span><span class="municipi">${fitxa(f.fila)}<small>${comarca(f.fila)}</small></span><b class="dada">${escape(fmt(f.valor))}</b></li>`;
}

function seccio(r: RanquingPreparat, grups: readonly PeerGroup[]): string {
  const m = r.metrica;
  const fmt = format(m);
  const opcions = grups.map((g) => `<option value="${escape(g.key)}">${escape(g.label)}</option>`).join("");
  const mediana = medianaDe(r.files.map((f) => f.valor));
  const total = r.files.length;
  const filtre = m.filtre;
  const categoriaDe = (f: FilaRanquing): { etq: string; valor: string } | null => {
    const clau = filtre?.categoria(f.fila);
    return filtre && clau ? { etq: filtre.etiqueta.toLocaleLowerCase("ca"), valor: filtre.noms[clau] ?? clau } : null;
  };
  const fila = (f: FilaRanquing, i: number): string => filaHtml(f, i + 1, total, mediana, fmt, categoriaDe(f));
  /*
   * Tres trossos d'una mateixa llista: els cinc de dalt, el mig fins a la
   * fila 40 (plegat) i els cinc de baix. Els de baix comencen on acaba el mig
   * i mai no se solapen: amb dotze municipis, el mig són les files 6 i 7.
   * Amb deu o menys no hi ha mig ni calaix: tot es veu.
   */
  const iniciBaix = Math.max(VISIBLES, total - VISIBLES);
  const dalt = r.files.slice(0, VISIBLES).map((f, i) => fila(f, i)).join("\n    ");
  const fiMig = Math.min(PAS, iniciBaix);
  const mig = r.files.slice(VISIBLES, fiMig).map((f, i) => fila(f, i + VISIBLES)).join("\n      ");
  const baix = r.files.slice(iniciBaix).map((f, i) => fila(f, i + iniciBaix)).join("\n    ");
  const titolLlista = escape(m.titol.toLocaleLowerCase("ca"));
  const resta = total - fiMig - (total - iniciBaix);
  return `<section class="bloc ranquing" id="${escape(m.id)}" data-metrica="${escape(m.id)}">
  <p class="micro">${escape(r.periode)} · ${escape(m.font)}</p>
  <h2>${escape(m.titol)}</h2>
  <p class="entrada-bloc">${escape(m.metode)}</p>
  ${notaCobertura(r)}
  ${m.diferit ? regleDiferit(r) : regle(r)}
  ${medianesPerGrup(r, grups)}${medianesPerCategoria(r)}
  <div class="controls">
    <label>Àmbit <select data-ambit><option value="cat">Tot Catalunya</option>${opcions}</select></label>
    ${selectorFiltre(r)}
    <label>Cerca <input data-cerca type="search" autocomplete="off" placeholder="Municipi o comarca"></label>
  </div>
  <ol class="llista-ranquing rq-dalt" data-dalt aria-label="Rànquing de ${titolLlista}: els de dalt">
    ${dalt}
  </ol>
  <details class="rq-calaix" data-calaix${mig ? "" : " hidden"}>
    <summary class="rq-obre"><span data-obre>Veure'n els ${n(fiMig)} primers</span><span class="secundari"> de ${n(total)}</span></summary>
    <ol class="llista-ranquing rq-mig" data-mig start="${VISIBLES + 1}" aria-label="Rànquing de ${titolLlista}: el mig">
      ${mig}
    </ol>
    <p class="mes-fila"><button type="button" class="mes" data-mes hidden>Mostra'n ${PAS} més</button>
      <noscript>${resta > 0 ? `Aquí surten els ${PAS} primers i els ${VISIBLES} últims de ${n(total)}; la llista sencera és a <a href="../dades/">les dades</a>.` : ""}</noscript></p>
  </details>
  <ol class="llista-ranquing rq-baix" data-baix start="${iniciBaix + 1}" aria-label="Rànquing de ${titolLlista}: els de baix"${baix ? "" : " hidden"}>
    ${baix}
  </ol>
  <p class="buit" data-buit hidden>Cap municipi no coincideix amb la cerca en aquest àmbit.</p>
  <p class="nota">${escape(m.cautela)}</p>
</section>`;
}

/**
 * El bloc JSON amb què el navegador refà les llistes: cada municipi un sol
 * cop, i per mètrica només l'índex del municipi i el valor. Els noms ja hi
 * són, així que el JavaScript no escriu res que no vingui d'aquí.
 */
function dadesJson(rows: readonly RankingRow[], preparats: readonly RanquingPreparat[], grups: readonly PeerGroup[]): string {
  const perFila = buildPeerGroups(rows.map((r, id) => ({ id, population: r.p })));
  const index = new Map(rows.map((r, i) => [r, i]));
  const municipis = rows.map((r, id) => [r.s, r.n, r.c, perFila.get(id)?.key ?? "", slugify(r.c)]);
  const metriques = Object.fromEntries(
    preparats.map((r) => [
      r.metrica.id,
      {
        d: r.metrica.decimals,
        s: r.metrica.sufix,
        e: r.metrica.escala ?? "lineal",
        /*
         * Amb filtre, cada fila porta un tercer element: la clau de la seva
         * categoria (o `null`), i la mètrica, l'etiqueta i el nom de cada
         * clau, perquè el navegador els escrigui a l'etiqueta de la fila.
         */
        ...(r.metrica.filtre
          ? { fe: r.metrica.filtre.etiqueta.toLocaleLowerCase("ca"), fn: r.metrica.filtre.noms }
          : {}),
        files: r.files.map((f) =>
          r.metrica.filtre
            ? [index.get(f.fila), f.valor, r.metrica.filtre.categoria(f.fila)]
            : [index.get(f.fila), f.valor],
        ),
      },
    ]),
  );
  return JSON.stringify({ municipis, grups: Object.fromEntries(grups.map((g) => [g.key, g.label])), metriques })
    .replace(/</g, "\\u003c");
}

// -------------------------------------------------------------------- estil

const CSS = `${GRAFICS_CSS}${CURIOSITATS_CSS}
.intro{max-width:72ch;margin-bottom:var(--e4)}

/* --- Destaquen: una fila per mètrica, els dos pols al costat --------------- */
.extrems-llista{list-style:none;padding:0;margin:var(--e3) 0 0;display:grid;gap:var(--e2)}
.extrem{display:grid;grid-template-columns:minmax(150px,.9fr) 1fr 1fr;gap:var(--e2) var(--e3);align-items:start;
  background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);box-shadow:var(--ombra);padding:var(--e2) var(--e3)}
.extrem .quina{display:flex;flex-direction:column;gap:2px;text-decoration:none;color:inherit;min-width:0}
.extrem .quina .micro{margin:0}
.extrem .quina b{font-family:var(--display);font-weight:900;font-size:1.15rem;letter-spacing:-.02em;line-height:1.15}
.extrem .quina:hover b{color:var(--coral-text)}
.extrem .pol{display:grid;gap:2px;min-width:0;border-left:2px solid var(--vora);padding-left:var(--e2)}
.extrem .cap{font-size:.78rem;font-weight:800;color:var(--ink-suau)}
.extrem .pol b{font-family:var(--display);font-weight:900;font-size:1.35rem;letter-spacing:-.03em;font-variant-numeric:tabular-nums;line-height:1.1}
.extrem .qui{font-size:.86rem;color:var(--ink-suau);overflow-wrap:anywhere}
.extrem .qui i{font-style:normal;font-weight:800;color:var(--ink)}
.extrem .qui a{color:var(--ink);font-weight:700}

/* --- cada rànquing --------------------------------------------------------- */
.ranquing .entrada-bloc{max-width:70ch}
.controls{display:flex;gap:var(--e2) var(--e3);flex-wrap:wrap;align-items:end;margin:var(--e3) 0 var(--e2)}
.controls label{font-weight:800;font-size:.9rem}
.controls select,.controls input{display:block;margin-top:4px;min-height:42px;border:2px solid var(--ink);border-radius:9px;
  background:var(--paper);padding:7px 10px;color:var(--ink);font:inherit;font-size:.95rem;min-width:220px}
.controls select:focus-visible,.controls input:focus-visible{outline:3px solid var(--coral-text);outline-offset:2px}
.llista-ranquing{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.llista-ranquing li{display:grid;grid-template-columns:2.4rem minmax(0,1fr) auto;gap:10px;align-items:center;
  border:2px solid var(--vora);border-radius:var(--r-m);padding:9px 12px;background:var(--paper-2)}
.llista-ranquing li:hover{border-color:var(--ink);box-shadow:var(--ombra)}
.llista-ranquing .pos{font-family:var(--display);font-weight:900;font-size:1.15rem;color:var(--coral-text);font-variant-numeric:tabular-nums}
.llista-ranquing .municipi a{font-weight:800;color:var(--ink)}
.llista-ranquing .municipi small{display:block;color:var(--ink-suau);font-size:.76rem;margin-top:1px}
.llista-ranquing .municipi small a{color:inherit;font-weight:600;text-decoration-color:var(--vora)}
.llista-ranquing .municipi small a:hover{color:var(--coral-text)}
.llista-ranquing .dada{font-family:var(--display);font-weight:900;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
/* --- cinc de dalt, el mig plegat, cinc de baix ---------------------------
   El resum del calaix fa de pont entre les dues puntes: diu quantes files hi
   ha amagades i de quantes, i al mòbil és l'únic que separa el cinquè del
   943è. Per això va amb vora discontínua —és un tros que falta, no una fila
   més— i amb un «+» que gira en obrir-lo. */
.rq-calaix{margin:8px 0}
.rq-calaix[hidden]{display:none}
.rq-obre{display:flex;align-items:center;gap:6px;min-height:44px;padding:0 14px;cursor:pointer;list-style:none;
  border:2px dashed var(--ink);border-radius:var(--r-m);font-weight:800;font-size:.92rem}
.rq-obre::-webkit-details-marker{display:none}
.rq-obre::after{content:"+";margin-left:auto;font-size:1.3rem;line-height:1;transition:transform .15s ease}
.rq-calaix[open]>.rq-obre::after{transform:rotate(45deg)}
.rq-obre:focus-visible{outline:3px solid var(--coral-text);outline-offset:2px}
.rq-obre .secundari{font-weight:600;color:var(--ink-suau)}
.rq-calaix .rq-mig{margin-top:8px}
.llista-ranquing[hidden]{display:none}
@media (prefers-reduced-motion:reduce){.rq-obre::after{transition:none}}
.ranquing .buit{color:var(--ink-suau);margin:var(--e2) 0 0}
.ranquing .cobertura{max-width:70ch;font-size:.9rem;font-weight:700;margin:var(--e1) 0 0}
.ranquing .per-grups{max-width:80ch;font-size:.86rem;color:var(--ink);margin:var(--e2) 0 0;overflow-wrap:anywhere}
.ranquing .per-grups b{font-weight:800}
.mes-fila{margin:var(--e2) 0 0;display:flex;gap:var(--e2);align-items:center;flex-wrap:wrap;color:var(--ink-suau);font-size:.9rem}
.mes{font:inherit;font-weight:800;color:var(--ink);background:var(--paper);border:2px solid var(--ink);border-radius:var(--r-max);
  padding:9px 18px;cursor:pointer;box-shadow:var(--ombra)}
.mes:hover{background:var(--ink);color:var(--paper)}
.mes:focus-visible{outline:3px solid var(--coral-text);outline-offset:2px}

@media(max-width:760px){
  .extrem{grid-template-columns:1fr}
  .extrem .pol{border-left:0;border-top:2px solid var(--vora);padding:var(--e1) 0 0}
  .llista-ranquing{grid-template-columns:1fr}
  .controls select,.controls input{min-width:0;width:100%}
  .controls label{flex:1 1 100%}
}
`;

// --------------------------------------------------------------------- script

/**
 * El JavaScript de la pàgina. Escrit sencer i no minificat: és curt, es
 * llegeix al costat del CSS que el fa servir i el servidor ja serveix comprimit.
 */
const JS = `<script>
(() => {
  const bloc = document.getElementById("dades-ranquings");
  if (!bloc) return;
  const dades = JSON.parse(bloc.textContent);
  const PAS = ${PAS};
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const formats = {};
  const fmt = (v, d, s) => {
    formats[d] ??= new Intl.NumberFormat("ca-ES", { minimumFractionDigits: d, maximumFractionDigits: d });
    return formats[d].format(v) + s;
  };
  const enllac = (m) => '<a href="../m/' + esc(m.s) + '/">' + esc(m.n) + "</a>";

  // Els mateixos data-* que escriu atributsEtiqueta() de grafics.ts, perquè el
  // script comú de l'etiqueta flotant llegeixi igual una marca escrita pel
  // servidor i una de refeta aquí: el nom, el valor i, en un sol atribut, les
  // línies de més amb els mateixos separadors (U+2016 entre línies, U+00A6
  // entre l'etiqueta i el valor). Sense title=: el script de l'etiqueta
  // només treu els title= que troba en carregar, i una marca escrita després
  // en tindria dos rètols.
  const atributs = (d) => ' data-nom="' + esc(d.nom) + '" data-valor="' + esc(d.valor) + '"' +
    (d.extres && d.extres.length
      ? ' data-extres="' + esc(d.extres.map((e) => e.etq + "\u00a6" + e.valor).join("\u2016")) + '"'
      : "");

  // «1r», «2n», «3r», «4t» i de cinc en amunt «è», com ordinal() al servidor.
  const ordinal = (pos) => fmt(pos, 0, "") + (pos === 1 ? "r" : pos === 2 ? "n" : pos === 3 ? "r" : pos === 4 ? "t" : "è");
  // «el 3r de 24» o «del 12è al 15è de 947», com posicioMarca().
  const posicio = (colla, total) => {
    const ps = colla.map((f) => f.pos);
    const primer = Math.min(...ps), darrer = Math.max(...ps);
    return primer === darrer ? "el " + ordinal(primer) + " de " + fmt(total, 0, "")
      : "del " + ordinal(primer) + " al " + ordinal(darrer) + " de " + fmt(total, 0, "");
  };
  // Amb signe i amb el menys de debò, com ambSigne(); «igual» si no es veu.
  const ambSigne = (v, d, s) => {
    const absolut = fmt(Math.abs(v), d, s);
    return absolut === fmt(0, d, s) ? "igual" : (v > 0 ? "+" : "\u2212") + absolut;
  };
  const respecteMediana = (colla, mig, d, s) => {
    const difs = colla.map((f) => f.valor - mig);
    const baix = Math.min(...difs), alt = Math.max(...difs);
    return baix === alt ? ambSigne(baix, d, s) : "de " + ambSigne(baix, d, s) + " a " + ambSigne(alt, d, s);
  };
  const mediana = (files) => {
    const asc = files.map((f) => f.valor).sort((a, b) => a - b);
    const meitat = Math.floor(asc.length / 2);
    return asc.length % 2 === 0 ? (asc[meitat - 1] + asc[meitat]) / 2 : asc[meitat];
  };

  // Els noms d'una marca, com els escriu nomsMarca() al servidor: fins a tres
  // i «i N més».
  const noms = (colla) => {
    const ordenats = colla.map((f) => f.n).sort((a, b) => a.localeCompare(b, "ca"));
    const tres = ordenats.slice(0, 3);
    const resta = ordenats.length - tres.length;
    if (resta > 0) return tres.join(", ") + " i " + fmt(resta, 0, "") + " més";
    if (tres.length === 1) return tres[0];
    return tres.slice(0, -1).join(", ") + " i " + tres[tres.length - 1];
  };
  // El valor d'una marca, com valorMarca(): la xifra, o «de X a Y» quan a la
  // mateixa posició hi cauen valors veïns.
  const valor = (colla, d, s) => {
    const vs = colla.map((f) => f.valor);
    const baix = Math.min(...vs), alt = Math.max(...vs);
    return baix === alt ? fmt(baix, d, s) : "de " + fmt(baix, d, s) + " a " + fmt(alt, d, s);
  };

  // El mateix dibuix que fa el servidor: mediana de tots, marques resumides,
  // i a cada marca els data-* de l'etiqueta flotant. Les files arriben de més
  // a menys, i la posició és la d'aquest ordre.
  // L'escala del regle: les mateixes tres funcions de grafics.ts que fa servir
  // el servidor, incrustades tal qual perquè no n'hi pugui haver dues versions.
  const posicioEscala = ${codiPerAlNavegador(posicioEscala)};
  const tallsEscala = ${codiPerAlNavegador(tallsEscala)};
  const etiquetaTall = ${codiPerAlNavegador(etiquetaTall)};
  const eixDispersio = ${codiPerAlNavegador(eixDispersio)};
  const NOTA_ESCALA_LOG = ${JSON.stringify(NOTA_ESCALA_LOG)};

  const regle = (files, d, s, escala) => {
    if (files.length < 4) return "";
    const asc = files.map((f, i) => ({ s: f.s, n: f.n, valor: f.valor, pos: i + 1 })).reverse();
    const baix = asc[0], alt = asc[asc.length - 1];
    if (alt.valor === baix.valor) return "";
    const mig = mediana(asc);
    const on = (v) => posicioEscala(v, baix.valor, alt.valor, escala).toFixed(1);
    const eix = eixDispersio(baix.valor, alt.valor, escala, esc(fmt(baix.valor, d, s)), esc(fmt(alt.valor, d, s)));
    const perPosicio = new Map();
    for (const f of asc) {
      const p = on(f.valor);
      if (perPosicio.has(p)) perPosicio.get(p).push(f); else perPosicio.set(p, [f]);
    }
    const marques = [...perPosicio].map(([p, colla]) =>
      '<i class="marca" style="--p:' + p + '%"' + atributs({
        nom: noms(colla),
        valor: valor(colla, d, s),
        extres: [
          { etq: "posició", valor: posicio(colla, files.length) },
          { etq: "respecte a la mediana", valor: respecteMediana(colla, mig, d, s) },
        ],
      }) + "></i>").join("");
    const laMediana = atributs({
      nom: "La mediana",
      valor: fmt(mig, d, s),
      extres: [
        { etq: "municipis", valor: fmt(files.length, 0, "") },
        { etq: "del més baix al més alt", valor: "de " + fmt(baix.valor, d, s) + " a " + fmt(alt.valor, d, s) },
      ],
    });
    return '<figcaption class="titol">Del més baix al més alt <span class="secundari">' + fmt(files.length, 0, "") + ' municipis amb dada</span>' +
      (eix.log ? '<span class="escala">' + NOTA_ESCALA_LOG + "</span>" : "") + "</figcaption>" +
      '<div class="regle-dispersio" aria-hidden="true">' + eix.linies + '<i class="mig" style="--p:' + on(mig) + '%"' + laMediana + "></i>" +
      marques + "</div>" + eix.eix +
      '<ul class="extrems"><li><span class="cap">El més baix</span>' + enllac(baix) + "<b>" + esc(fmt(baix.valor, d, s)) + "</b></li>" +
      '<li><span class="cap">La mediana</span><span class="secundari">el municipi del mig</span><b>' + esc(fmt(mig, d, s)) + "</b></li>" +
      '<li><span class="cap">El més alt</span>' + enllac(alt) + "<b>" + esc(fmt(alt.valor, d, s)) + "</b></li></ul>";
  };

  document.querySelectorAll(".ranquing").forEach((seccio) => {
    const m = dades.metriques[seccio.dataset.metrica];
    if (!m) return;
    const files = m.files.map(([i, valor, cat]) => {
      const [s, n, c, grup, cs] = dades.municipis[i];
      return { s, n, c, cs, grup, valor, cat: cat ?? null, text: (n + " " + c).toLocaleLowerCase("ca") };
    });
    const ambit = seccio.querySelector("[data-ambit]");
    // El segon desplegable (la gestió de l'aigua, la figura del pla), si la mètrica en té.
    const filtre = seccio.querySelector("[data-filtre]");
    const cerca = seccio.querySelector("[data-cerca]");
    const dalt = seccio.querySelector("[data-dalt]");
    const migLlista = seccio.querySelector("[data-mig]");
    const baix = seccio.querySelector("[data-baix]");
    const calaix = seccio.querySelector("[data-calaix]");
    const obre = seccio.querySelector("[data-obre]");
    const de = calaix.querySelector(".rq-obre .secundari");
    const mes = seccio.querySelector("[data-mes]");
    const buit = seccio.querySelector("[data-buit]");
    const VISIBLES = ${VISIBLES};
    let figura = seccio.querySelector(".dispersio");
    let visibles = PAS;

    // «Mostra'n N més (en queden M)», o res quan ja no en queden.
    const pintaMes = (resten) => {
      mes.hidden = resten <= 0;
      mes.textContent = "Mostra'n " + Math.min(PAS, resten) + " més (en queden " + resten + ")";
    };

    const pinta = () => {
      const grup = ambit.value;
      const terme = cerca.value.trim().toLocaleLowerCase("ca");
      const categoria = filtre ? filtre.value : "";
      const delAmbit = files.filter((f) => (grup === "cat" || f.grup === grup) && (!categoria || f.cat === categoria));
      // La posició és la de l'àmbit, no la de la cerca: qui busca «vall» ha de
      // veure que Matadepera és el primer de Catalunya, no el primer dels que
      // es diuen Vallès.
      const trobats = delAmbit.map((f, i) => ({ ...f, pos: i + 1 })).filter((f) => !terme || f.text.includes(terme));
      // La mediana és la de l'àmbit, com el regle: la cerca troba, no compara.
      const mig = delAmbit.length ? mediana(delAmbit) : 0;
      // Cada fila porta la mateixa etiqueta que escriu filaHtml() al servidor.
      const li = (f) =>
        "<li" + atributs({
          nom: f.n,
          valor: fmt(f.valor, m.d, m.s),
          extres: [
            { etq: "comarca", valor: f.c },
            ...(m.fe && f.cat ? [{ etq: m.fe, valor: (m.fn && m.fn[f.cat]) || f.cat }] : []),
            { etq: "posició de " + fmt(delAmbit.length, 0, ""), valor: ordinal(f.pos) },
            { etq: "respecte a la mediana", valor: ambSigne(f.valor - mig, m.d, m.s) },
          ],
        }) + '><span class="pos">' + f.pos + '</span><span class="municipi">' + enllac(f) + '<small><a class="comarca" href="../c/' + esc(f.cs) + '/">' + esc(f.c) + "</a></small></span>" +
        '<b class="dada">' + esc(fmt(f.valor, m.d, m.s)) + "</b></li>";
      if (terme) {
        /*
         * Cercant, el que es busca són les trobades i no els extrems: les
         * cinc primeres a dalt i la resta dins del calaix, que s'obre sol
         * perquè no quedi amagat el que s'acaba de demanar. Els de baix no hi
         * pinten res.
         */
        const fins = Math.min(visibles, trobats.length);
        dalt.innerHTML = trobats.slice(0, VISIBLES).map(li).join("");
        migLlista.innerHTML = trobats.slice(VISIBLES, fins).map(li).join("");
        calaix.hidden = fins <= VISIBLES;
        if (!calaix.hidden) calaix.open = true;
        obre.textContent = "Veure'n les " + fmt(fins, 0, "") + " primeres trobades";
        de.textContent = " de " + fmt(trobats.length, 0, "");
        baix.innerHTML = "";
        baix.hidden = true;
        pintaMes(trobats.length - fins);
      } else {
        // Sense cerca, com el servidor: cinc de dalt, el mig plegat i cinc de baix.
        const iniciBaix = Math.max(VISIBLES, trobats.length - VISIBLES);
        const fiMig = Math.min(visibles, iniciBaix);
        dalt.innerHTML = trobats.slice(0, VISIBLES).map(li).join("");
        migLlista.innerHTML = trobats.slice(VISIBLES, fiMig).map(li).join("");
        calaix.hidden = fiMig <= VISIBLES;
        obre.textContent = "Veure'n els " + fmt(fiMig, 0, "") + " primers";
        de.textContent = " de " + fmt(trobats.length, 0, "");
        baix.innerHTML = trobats.slice(iniciBaix).map(li).join("");
        baix.hidden = iniciBaix >= trobats.length;
        baix.setAttribute("start", String(iniciBaix + 1));
        pintaMes(iniciBaix - fiMig);
      }
      buit.hidden = trobats.length > 0;
      // El regle és el de l'àmbit, no el de la cerca: la cerca troba, no compara.
      const dibuix = regle(delAmbit, m.d, m.s, m.e || "lineal");
      if (!figura && dibuix) {
        figura = document.createElement("figure");
        figura.className = "dispersio";
        seccio.querySelector(".controls").before(figura);
      }
      if (figura) { figura.innerHTML = dibuix; figura.hidden = !dibuix; }
    };
    ambit.addEventListener("change", () => { visibles = PAS; pinta(); });
    if (filtre) filtre.addEventListener("change", () => { visibles = PAS; pinta(); });
    // Un regle diferit arriba amb la barra buida: es dibuixa ara, amb la
    // mateixa funció que el refà quan canvia l'àmbit.
    if (figura && figura.dataset && "diferit" in figura.dataset) {
      const dibuix = regle(files, m.d, m.s, m.e || "lineal");
      figura.innerHTML = dibuix;
      figura.hidden = !dibuix;
    }
    cerca.addEventListener("input", () => { visibles = PAS; pinta(); });
    mes.addEventListener("click", () => { visibles += PAS; pinta(); });
    // Sense canviar res, la pàgina ja és la que ha escrit el servidor: només cal
    // el botó, que sense JavaScript no faria res i per això arriba amagat.
    pintaMes(Math.max(VISIBLES, files.length - VISIBLES) - Math.min(PAS, Math.max(VISIBLES, files.length - VISIBLES)));
  });
})();
</script>`;

// -------------------------------------------------------------------- pàgina

/**
 * La pàgina. `curiositats` és el que `loadCuriositats()` ha llegit de la base
 * i la fila no porta; sense això la secció de curiositats no s'escriu, que és
 * el que passa a la vista prèvia i als tests que només tenen files.
 */
export function renderRanquings(
  rows: readonly RankingRow[],
  generatedAt: string,
  curiositats?: DadesCuriositats,
): string {
  const preparats = preparaRanquings(rows);
  const grups = grupsOrdenats(rows, buildPeerGroups(rows.map((r, id) => ({ id, population: r.p }))));
  const targetes = preparats.map(targetaExtrems).join("\n");
  const fets = curiositats ? [...preparaCuriositats(rows, curiositats), ...curiositatsTerritori(rows, { consultat: generatedAt }), ...curiositatsWikidata(rows), ...curiositatsVehicles(rows), ...curiositatsCens(rows), ...curiositatsLlistesObertes(rows)] : [];
  const cos = preparats.length
    ? `<section class="bloc" id="destaquen">
  <h2>Destaquen</h2>
  <p class="entrada-bloc">El municipi més alt i el més baix de cada indicador, amb els empats sencers.
  Cada fila porta al rànquing complet${fets.length ? `; al final, <a href="#curiositats">les curiositats</a>` : ""}.</p>
  <ul class="extrems-llista">
${targetes}
  </ul>
</section>
${preparats.map((r) => seccio(r, grups)).join("\n")}`
    : `<p class="nota">Cap indicador no arriba avui al llindar de publicació: un mateix període per a almenys el
  90 % dels municipis i vint valors.</p>`;

  // El cap per al cercador: quants rànquings s'han publicat de debò —els que
  // passen el llindar, no les mètriques que existeixen— i de quants municipis.
  // Cada rànquing hi va com a `ItemList` amb els mateixos `PAS` primers que la
  // pàgina pinta sense guió (la resta la posa el client), en l'ordre de la
  // llista i amb la fitxa de cada municipi; `numberOfItems` diu quants n'hi ha.
  const url = `${SITE}/observatori/ranquings/`;
  const llistes = preparats.map((r) =>
    llistaOrdenada(
      r.metrica.titol,
      r.files.slice(0, PAS).map((f) => ({ nom: f.fila.n, url: `${SITE}/observatori/m/${f.fila.s}/` })),
      { url: `${url}#${r.metrica.id}`, total: r.files.length, descripcio: `${r.periode} · ${r.metrica.font}` },
    ),
  );
  const cap = capSeo({
    titol: "Rànquings municipals de Catalunya",
    descripcio: `${preparats.length > 0 ? `${preparats.length} rànquings` : "Els rànquings"} dels ${rows.length} municipis de Catalunya: qui és a dalt i qui a baix de cada indicador, amb l'any, la font i el que la xifra no diu.`,
    url,
    imatge: imatgeOg(FITXER_OG.global("ranquings")),
    jsonLd: [filAriadna([...ARREL_OBSERVATORI, { nom: "Rànquings municipals", url }]), ...llistes],
  });

  return `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${cap}
${tipografia("../")}
<style>${RADIOGRAFIA_CSS}${CSS}</style>
</head>
<body>
<a class="salta" href="#contingut">Ves al contingut</a>
${capcalera("../", "ranquings", "dades obertes")}
${cercador("../")}
<main id="contingut">
<header class="intro">
  <p class="micro">Comparar sense sentenciar</p>
  <h1>Rànquings</h1>
  <p class="entrada">Qui és a dalt i qui a baix de cada indicador, a tot Catalunya o entre municipis
  d'una mida semblant. Una posició descriu una xifra: no diu quin ajuntament ho fa millor.</p>
</header>
${cos}
${renderCuriositats(fets)}
<section class="bloc" id="metode">
  <h2>Com s'han triat</h2>
  <p>Un indicador només es publica quan té dada del mateix període per a almenys el 90 % dels
  municipis i per a vint com a mínim. No barregem anys ni definicions per completar una llista:
  si la font d'un municipi no ha publicat l'any que es compara, el municipi no hi surt, i el
  recompte de cada rànquing ho diu. Un zero publicat compta com a dada; un buit no.</p>
  <p>Els grups de mida són els trams de població que fixen quants regidors té cada ple, i per
  tant no els hem triat nosaltres. Els empats surten sencers i per ordre alfabètic.</p>
  <p>Les curiositats no són rànquings i no passen pel llindar del 90 %: són llistes curtes, i
  cadascuna diu sobre quants municipis o persones s'ha mirat. Si una dada no hi és, el fet no surt.</p>
  <p><a href="../dades/">Les dades senceres i l'esquema de cada camp</a></p>
</section>
</main>
${peu("../", generatedAt)}
<script type="application/json" id="dades-ranquings">${dadesJson(rows, preparats, grups)}</script>
${JS}
${GRAFICS_JS}
</body>
</html>`;
}
