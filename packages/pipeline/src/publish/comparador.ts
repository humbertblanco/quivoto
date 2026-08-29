import { eq, inArray } from "drizzle-orm";
import { electionParticipation, municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { tintaSobre } from "./contrast";
import { carregaMetriques } from "./metriques";
import { BRANDS_BY_ID, siglesFamily } from "@quivoto/shared-schemas/brands";
import { buildPeerGroups, percentileOf } from "../derive/peers";
import { RADIOGRAFIA_CSS } from "./estil";

/**
 * El comparador: de dos a quatre municipis, un al costat de l'altre.
 *
 * És la pregunta que la gent es fa sola quan llegeix la fitxa del seu poble —«i
 * al del costat, com ho tenen?»— i la que un regidor de l'oposició farà servir
 * el 23-M. Per això la pàgina no és un explorador de dades: són onze files
 * triades, cadascuna amb la seva font i amb el seu sentit escrit a sobre.
 *
 * Tot passa al navegador amb el conjunt incrustat, com a «Els 947»: sense
 * servidor, sense peticions i sense que ningú sàpiga quins municipis compares.
 *
 * Dues decisions que expliquen la meitat del fitxer:
 *
 * 1. **La direcció de cada indicador va escrita, no deduïda.** Menys deute és
 *    millor i menys participació és pitjor: el signe no ho diu. Cada indicador
 *    porta `sentit`, i n'hi ha que no en tenen cap («qui governa», la població)
 *    o que no tenen un «millor» defensable (el tipus de l'IBI: pagar menys no
 *    és objectivament millor, depèn de què vulguis que faci l'ajuntament).
 * 2. **Cada xifra porta el seu percentil dins del grup de comparació**, i el
 *    grup diu de quants municipis es tracta. Que un municipi tingui menys deute
 *    que un altre no vol dir gaire si són de mides diferents; el percentil diu
 *    on és cadascun dins de la seva pròpia lliga, que és la comparació justa.
 * 3. **Hi ha temps, no només nivells.** Un nivell no jutja un govern: un poble
 *    pot tenir poc deute per una decisió del 1998. Per això la taula té una
 *    secció de mandat amb la variació del deute del 2019 al 2023, que és el
 *    tros de la xifra que sí que ha passat sota un govern concret; i per això
 *    cada fila de govern porta les sigles de qui mana, amb el seu color, al
 *    costat de les xifres que se li atribuiran.
 * 4. **Una casella buida parla.** Deixar-la en blanc fa pensar que la xifra és
 *    zero o que ningú no ho ha mirat; cada indicador porta escrit què és el que
 *    ens falta quan falta («no en tenim la liquidació»), i sota la taula hi ha
 *    el compte de forats de la comparació que s'està mirant.
 */

// ------------------------------------------------------------- els indicadors

type Sentit =
  /** com més alt, millor */
  | "amunt"
  /** com més baix, millor */
  | "avall"
  /** millor com més a prop de l'objectiu */
  | "objectiu"
  /** no hi ha un «millor», però els extrems es marquen sense jutjar-los */
  | "neutre"
  /** no es marca res */
  | "cap";

type Indicador = {
  clau: string;
  etiqueta: string;
  seccio: string;
  mena: "xifra" | "text";
  format: "nombre" | "euros" | "percent" | "tipus" | "dies" | "variacio-euros" | "vegades";
  sentit: Sentit;
  objectiu?: number;
  /** si es calcula el percentil dins del grup de comparació */
  percentil: boolean;
  nota: string;
  /**
   * Què és, exactament, el que no tenim quan la casella surt buida.
   *
   * Un guionet no informa: fa pensar que la xifra és zero, o que no ho hem
   * mirat, o que l'ajuntament ho amaga. Dir «no en tenim la liquidació» diu de
   * qui és el forat i quina és la peça que hi falta, que és el que permet
   * anar-la a buscar.
   */
  absent: string;
  /** noms de les marques quan el sentit és `neutre` i «el més alt» no diu res */
  extrems?: { alt: string; baix: string };
  /** identificador del conjunt de dades, perquè cada fila pugui dir d'on surt */
  font: string;
};

const SECCIONS = [
  "El poble",
  "Qui mana",
  "Els comptes",
  "Com ha anat el mandat",
  "Com es governa",
] as const;

/**
 * L'ordre d'aquesta llista és l'ordre de la taula, i les claus són les mateixes
 * que fa servir `ComparadorRow`. Afegir-hi una fila vol dir afegir-la aquí i
 * omplir-la a `loadComparador`: la pàgina no s'ha de tocar.
 */
const INDICADORS: readonly Indicador[] = [
  {
    clau: "poblacio", etiqueta: "Habitants", seccio: "El poble", mena: "xifra", format: "nombre",
    sentit: "cap", percentil: false, font: "6nei-4b44",
    nota: "Padró municipal de l'últim any publicat.",
    absent: "No en tenim el padró.",
  },
  {
    clau: "regidories", etiqueta: "Regidories al ple", seccio: "El poble", mena: "xifra", format: "nombre",
    sentit: "cap", percentil: false, font: "LOREG art. 179",
    nota: "Les fixa la llei segons la població: no és una decisió de l'ajuntament.",
    absent: "No en tenim la composició del ple.",
  },
  {
    clau: "govern", etiqueta: "Qui governa", seccio: "Qui mana", mena: "text", format: "nombre",
    sentit: "cap", percentil: false, font: "6nei-4b44 · ntc4-rnwr",
    nota: "Les sigles de la candidatura que té l'alcaldia des del juny del 2023, amb el seu color, i el nom de qui l'ocupa. Van a dalt de tot perquè les xifres de sota no s'atribueixin a un govern desconegut.",
    absent: "No en tenim l'alcaldia.",
  },
  {
    clau: "mesvotada", etiqueta: "Governa la llista més votada", seccio: "Qui mana", mena: "text", format: "nombre",
    sentit: "cap", percentil: false, font: "ntc4-rnwr",
    nota: "Si l'alcaldia és de la candidatura que va treure més vots el 2023 o hi ha arribat per un pacte. Un «no» no és cap irregularitat: l'alcaldia la tria el ple, no les urnes.",
    absent: "No hem sabut lligar l'alcaldia amb cap candidatura.",
  },
  {
    clau: "majoria", etiqueta: "Majoria absoluta", seccio: "Qui mana", mena: "text", format: "nombre",
    sentit: "cap", percentil: false, font: "ntc4-rnwr",
    nota: "Si la llista que té l'alcaldia arriba sola a la meitat més un del ple.",
    absent: "No en tenim el repartiment de regidories.",
  },
  {
    clau: "participacio", etiqueta: "Participació el 2023", seccio: "Qui mana", mena: "xifra", format: "percent",
    sentit: "amunt", percentil: true, font: "irrv-2mfc",
    nota: "Votants sobre el cens a les municipals del 28 de maig del 2023.",
    absent: "No en tenim el cens del 2023.",
  },
  {
    // Quantes vegades ha canviat de mans no és ni bo ni dolent: hi ha pobles amb
    // quaranta anys de la mateixa força per convicció i n'hi ha per manca
    // d'alternativa. La xifra és el fet; el judici, de qui llegeix.
    clau: "alternances", etiqueta: "Canvis de força més votada", seccio: "Qui mana", mena: "xifra", format: "vegades",
    sentit: "cap", percentil: false, font: "3539f7e6",
    nota: "Vegades que la força més votada ha canviat de família política a les municipals des del 1979. Zero vol dir que sempre ha guanyat la mateixa.",
    absent: "No en tenim la sèrie electoral des del 1979.",
  },
  {
    clau: "deute", etiqueta: "Deute per habitant", seccio: "Els comptes", mena: "xifra", format: "euros",
    sentit: "avall", percentil: true, font: "34db8dc5",
    nota: "Deute viu a 31 de desembre dividit pel padró. És un nivell, i un nivell no és el balanç d'un govern: pot venir d'una operació de fa vint anys. Per això la taula també en porta la variació del mandat.",
    absent: "No en tenim el deute viu.",
  },
  {
    clau: "estalvi", etiqueta: "Estalvi net", seccio: "Els comptes", mena: "xifra", format: "percent",
    sentit: "amunt", percentil: true, font: "81f18313",
    nota: "El que sobra dels ingressos corrents un cop pagat el dia a dia i el deute que toca tornar. Negatiu obliga a fer un pla de sanejament.",
    absent: "No en tenim la liquidació.",
  },
  {
    clau: "saldo", etiqueta: "Saldo no financer", seccio: "Els comptes", mena: "xifra", format: "percent",
    sentit: "amunt", percentil: true, font: "81f18313",
    nota: "Diferència entre tot el que entra i tot el que es gasta sense comptar préstecs, sobre els ingressos corrents. Negatiu vol dir que l'any es va tancar gastant més del que va entrar.",
    absent: "No en tenim la liquidació.",
  },
  {
    clau: "carrega", etiqueta: "Càrrega financera", seccio: "Els comptes", mena: "xifra", format: "percent",
    sentit: "avall", percentil: true, font: "81f18313",
    nota: "Interessos i amortització del deute sobre els ingressos corrents: la part del pressupost que ja està compromesa abans que el govern decideixi res.",
    absent: "No en tenim la liquidació.",
  },
  {
    // La mesura més directa de si un pressupost d'inversió es va complir.
    clau: "execucio", etiqueta: "Inversions executades", seccio: "Els comptes", mena: "xifra", format: "percent",
    sentit: "amunt", percentil: true, font: "81f18313",
    nota: "Del que l'ajuntament tenia pressupostat per invertir, quina part va arribar a executar. Un valor baix vol dir que el pressupost anunciava obres i inversions que aquell any no es van fer. Per sobre del 100 % vol dir que el pressupost es va ampliar durant l'any.",
    absent: "No en tenim la liquidació.",
  },
  {
    clau: "pmp", etiqueta: "Dies per pagar els proveïdors", seccio: "Els comptes", mena: "xifra", format: "dies",
    sentit: "avall", percentil: true, font: "eecca986",
    nota: "Període mitjà de pagament. Per sobre de 30 dies és un incompliment; per sobre de 60, greu.",
    absent: "No en tenim el període de pagament.",
  },
  {
    // Sense sentit: pagar menys IBI no és objectivament millor —depèn de què
    // esperis de l'ajuntament—, així que es marquen els extrems i prou.
    //
    // El tipus sol no és el rebut, i la peça que faltava per dir-ho —l'any de
    // l'última revisió cadastral— la tenim: va al peu de la mateixa casella. Amb
    // l'any al costat, la comparació deixa de ser una disculpa.
    clau: "ibi", etiqueta: "Tipus de l'IBI urbà", seccio: "Els comptes", mena: "xifra", format: "tipus",
    sentit: "neutre", percentil: true, font: "82ae0ea2",
    nota: "Tipus de gravamen dels béns immobles urbans, amb l'any de l'última revisió cadastral al peu. El rebut és el tipus multiplicat pel valor cadastral: dos municipis amb el mateix tipus i revisions de dècades diferents no cobren el mateix, i per això l'any hi va al costat.",
    absent: "No en tenim l'ordenança fiscal.",
  },
  {
    // La columna de temps. La resta de la taula són nivells de l'últim any; això
    // no. Els extrems es marquen sense dir que baixar sigui millor: hi ha qui
    // baixa el deute perquè no inverteix, i «Inversions executades» hi és
    // justament perquè les dues coses es puguin llegir juntes.
    clau: "deute_mandat", etiqueta: "Deute: del 2019 al 2023", seccio: "Com ha anat el mandat",
    mena: "xifra", format: "variacio-euros",
    // «El que més puja» seria mentida quan tots dos baixen —el que baixa menys
    // no puja—, i passa sovint: de les 947, 401 van baixar el deute entre el
    // 2019 i el 2023. Les marques parlen de la variació, no de la direcció.
    sentit: "neutre", extrems: { alt: "la variació més alta", baix: "la variació més baixa" },
    percentil: true, font: "34db8dc5",
    nota: "Diferència entre el deute per habitant del 2019 i el del 2023, que és el tros del deute que ha passat durant el mandat 2019-2023. Al peu hi ha les dues xifres i, quan la sabem, la candidatura que tenia l'alcaldia aquells anys —que pot no ser la d'ara.",
    absent: "No en tenim el deute del 2019 o del 2023.",
  },
  {
    clau: "selectiva", etiqueta: "Recollida selectiva", seccio: "Com es governa", mena: "xifra", format: "percent",
    sentit: "amunt", percentil: true, font: "69zu-w48s",
    nota: "Part dels residus municipals recollits selectivament. És dels pocs resultats directes d'una decisió de govern que es pot seguir any a any.",
    absent: "No en tenim les dades de residus.",
  },
  {
    // La paritat no és «com més dones, millor» sinó com més a prop del 50 %:
    // marcar com a millor un ple de 80 % de dones seria tan fals com al revés.
    clau: "dones", etiqueta: "Dones al ple", seccio: "Com es governa", mena: "xifra", format: "percent",
    sentit: "objectiu", objectiu: 50, percentil: true, font: "xnfg-weec",
    nota: "Percentatge de dones entre les persones electes el 2023.",
    absent: "No en tenim la llista d'electes.",
  },
  {
    clau: "transparencia", etiqueta: "Portal de transparència", seccio: "Com es governa", mena: "xifra", format: "percent",
    sentit: "amunt", percentil: true, font: "1a9c1ede",
    nota: "Apartats publicats dels que li tocarien, segons l'emplenament del portal de transparència que mesura el Consorci AOC.",
    absent: "No en tenim el mesurament de l'AOC.",
  },
];

// -------------------------------------------------------- les dues funcions
// que també s'executen al navegador
//
// S'incrusten a la pàgina amb `toString()` en comptes de reescriure-les dins
// del `<script>`: així la regla que decideix qui és el millor és literalment la
// mateixa que passa pels tests, i no hi pot haver dues versions que divergeixin.
// Per això no poden fer servir res de fora seu ni sintaxi que TypeScript
// esborri: han de ser JavaScript vàlid tal com estan escrites.

/**
 * La mateixa normalització que «Els 947»: sense accents, sense apòstrofs i
 * sense l'article davant, perquè «hospitalet» trobi «l'Hospitalet de Llobregat»
 * i «seu» trobi «la Seu d'Urgell».
 */
export function normalitza(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['\u2019]/g, " ")
    .replace(/^(l|el|la|els|les|es|sa)\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Qui es marca com a millor i qui com a pitjor en una fila.
 *
 * Torna una etiqueta per posició: `"millor"`, `"pitjor"`, `"alt"`, `"baix"` o
 * `""`. Les regles, totes deliberades:
 *
 * - amb menys de dos valors no hi ha comparació i no es marca res;
 * - si tots els valors empaten, tampoc: marcar-los tots de «millor» no diu res;
 * - els empats a dalt o a baix es marquen tots, no només el primer;
 * - `neutre` marca els extrems sense dir que cap sigui millor.
 */
export function marquesDe(
  sentit: Sentit,
  objectiu: number | undefined,
  valors: readonly (number | null)[],
): string[] {
  // Tot en un sol bucle i sense funcions auxiliars a dins: aquesta funció
  // s'incrusta a la pàgina amb `toString()` i qualsevol tancament intern hi
  // arribaria embolicat amb els ajudants del transpilador, que al navegador no
  // existeixen. El test l'avalua aïllada justament per no tornar-hi a caure.
  const marques: string[] = [];
  const posicions: number[] = [];
  const rangs: number[] = [];
  for (let i = 0; i < valors.length; i += 1) {
    marques.push("");
    const valor = valors[i];
    if (typeof valor !== "number") continue;
    posicions.push(i);
    // Tot es converteix a «com més petit, millor» per no repetir la comparació
    // quatre vegades. Al cas neutre el rang és el valor mateix i les etiquetes
    // no diuen «millor», sinó «el més alt» i «el més baix».
    rangs.push(
      sentit === "amunt" ? -valor : sentit === "objectiu" ? Math.abs(valor - (objectiu ?? 0)) : valor,
    );
  }
  if (sentit === "cap" || posicions.length < 2) return marques;

  const millor = Math.min.apply(null, rangs);
  const pitjor = Math.max.apply(null, rangs);
  if (millor === pitjor) return marques;

  for (let n = 0; n < posicions.length; n += 1) {
    const i = posicions[n] as number;
    if (rangs[n] === millor) marques[i] = sentit === "neutre" ? "baix" : "millor";
    else if (rangs[n] === pitjor) marques[i] = sentit === "neutre" ? "alt" : "pitjor";
  }
  return marques;
}

// -------------------------------------------------------------------- càrrega

export type ComparadorRow = {
  slug: string;
  nom: string;
  comarca: string;
  /** grup de comparació de la LOREG: amb qui és just comparar aquest municipi */
  grup: string;
  /** quants municipis hi ha al grup: un percentil sense la mida no es pot llegir */
  grupMida?: number;
  /** valors dels indicadors numèrics, per clau */
  valors: Record<string, number | null>;
  /** percentil de cada valor dins del seu grup de comparació */
  percentils: Record<string, number | null>;
  /**
   * Peu d'una casella numèrica: el context sense el qual la xifra sola enganya
   * —l'any de la revisió cadastral sota el tipus de l'IBI, les dues puntes de
   * la sèrie sota la variació del deute. Només les claus que en tenen.
   */
  peus?: Record<string, string>;
  /** cel·les de text, per clau; el color és el de la marca, quan n'hi ha */
  textos: Record<string, { principal: string; secundari: string; color?: string }>;
};

type GovernmentMetric = {
  mayorName: string | null; mayorSigles: string | null; mayorSeats: number | null;
  winnerSigles: string; winnerSeats: number; totalSeats: number;
  majority: number; winnerHasMajority: boolean; winnerGoverns: boolean | null;
};
type FinancesMetric = {
  indicators: { key: string; value: number | null }[];
  /** deute per habitant any a any; d'aquí surt la columna de temps */
  debtSeries?: { year: number; perHead: number }[];
  /** qui tenia l'alcaldia a cada mandat, per no atribuir una variació a ningú */
  bands?: { id: string; party: string | null }[];
};
type TaxesMetric = { taxes: Record<string, { value: number }> };
type ParityMetric = { womenElectedPct: number | null; complet?: boolean };
type TransparencyMetric = { pct: number | null };
type HistoryMetric = { alternances: number | null; elections: number | null };

/**
 * Els `kind` que necessita la taula. Es demanen per nom i no es carrega tot
 * `municipality_metrics`: són 13.000 files de JSON i la pàgina només en fa
 * servir set.
 */
const KINDS = [
  "government", "finances", "taxes", "parity", "transparency", "residus", "electoralHistory",
] as const;

/** El mandat que la taula llegeix sencer: hi ha les dues puntes per als 947. */
const MANDAT = { primer: 2019, ultim: 2023 } as const;

/**
 * Color de la candidatura que té l'alcaldia.
 *
 * `radiografia.ts` el treu de la candidatura del municipi, que hi porta el color
 * oficial del dataset electoral; aquí no carreguem els resultats i es dedueix de
 * les sigles amb la mateixa taula de marques. Si no lliga, gris: val més no
 * acolorir que acolorir malament, perquè el color diu de qui és cada cosa.
 */
function colorDeLesSigles(sigles: string | null): string {
  const familia = sigles ? siglesFamily(sigles) : null;
  return (familia ? BRANDS_BY_ID.get(familia)?.color : null) ?? "#8b8b8b";
}

const euros = (n: number): string => `${Math.round(n).toLocaleString("ca-ES")} €`;

/**
 * La variació del deute durant el mandat 2019-2023, i el peu que la sosté.
 *
 * Es fa amb les dues puntes de la sèrie i no amb una mitjana: la pregunta és si
 * el municipi va sortir del mandat devent més o menys que hi va entrar. Si en
 * falta qualsevol de les dues, no hi ha xifra —una variació calculada contra un
 * any que no hi és seria inventada.
 */
export function variacioDelMandat(
  finances: FinancesMetric | undefined,
): { valor: number | null; peu: string } {
  const serie = finances?.debtSeries ?? [];
  const primer = serie.find((p) => p.year === MANDAT.primer);
  const ultim = serie.find((p) => p.year === MANDAT.ultim);
  if (!primer || !ultim) return { valor: null, peu: "" };

  const banda = finances?.bands?.find((b) => b.id === `${MANDAT.primer}-${MANDAT.ultim}`);
  const partit = banda?.party?.trim();
  // Les sigles crues del registre d'alcaldies poden ser una tirallonga; si no
  // caben en una casella val més no dir-les que trencar la taula.
  const qui = partit && partit.length <= 28 ? `, amb ${partit} a l'alcaldia` : "";
  return {
    valor: ultim.perHead - primer.perHead,
    peu: `de ${euros(primer.perHead)} el ${MANDAT.primer} a ${euros(ultim.perHead)} el ${MANDAT.ultim}${qui}`,
  };
}

/**
 * La recollida selectiva la desa J9, i la lectura continua sent tolerant a
 * propòsit: no tots els municipis hi són cada any, i quan un any hi falta val
 * més que la fila no surti que no pas una columna de guions que faci pensar que
 * ho hem mirat i no hi ha res.
 */
function recollidaSelectiva(data: unknown): number | null {
  if (!data || typeof data !== "object") return null;
  // La clau és `taxaSelectiva`, la que desa J9. Abans es provaven quatre noms
  // possibles i cap no era el bo: la fila desapareixia sola i el codi callava,
  // que és la manera més fàcil de publicar un forat sense adonar-se'n.
  const valor = (data as { taxaSelectiva?: unknown }).taxaSelectiva;
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

export async function loadComparador(db: Db): Promise<ComparadorRow[]> {
  const all = await db
    .select({
      id: municipalities.id,
      slug: municipalities.slug,
      name: municipalities.name,
      comarca: municipalities.comarca,
      population: municipalities.population,
      councilSeats: municipalities.councilSeats,
      mayorName: municipalities.mayorName,
      mayorPartyRaw: municipalities.mayorPartyRaw,
    })
    .from(municipalities);

  const metrics = await carregaMetriques(db, KINDS);

  const turnout = await db
    .select()
    .from(electionParticipation)
    .where(eq(electionParticipation.electionId, "M20231"));

  const byMunicipality = new Map<number, Map<string, unknown>>();
  for (const metric of metrics) {
    let map = byMunicipality.get(metric.municipalityId);
    if (!map) byMunicipality.set(metric.municipalityId, (map = new Map()));
    map.set(metric.kind, metric.data);
  }
  const turnoutBy = new Map(turnout.map((row) => [row.municipalityId, row]));
  const groups = buildPeerGroups(all);

  const rows = all.map((m): ComparadorRow & { id: number } => {
    const own = byMunicipality.get(m.id);
    const government = own?.get("government") as GovernmentMetric | undefined;
    const finances = own?.get("finances") as FinancesMetric | undefined;
    const taxes = own?.get("taxes") as TaxesMetric | undefined;
    const parity = own?.get("parity") as ParityMetric | undefined;
    const transparency = own?.get("transparency") as TransparencyMetric | undefined;
    const history = own?.get("electoralHistory") as HistoryMetric | undefined;
    const indicator = (key: string): number | null =>
      finances?.indicators.find((i) => i.key === key)?.value ?? null;
    const mandat = variacioDelMandat(finances);
    // L'any de la revisió cadastral viu al mateix `kind` que el tipus de l'IBI,
    // com a valor i no com a data de la dada: per això surt d'aquí i no de `year`.
    const cadastre = taxes?.taxes?.cadastre?.value ?? null;

    const census = turnoutBy.get(m.id);
    const participacio =
      census?.censusSize && census.voters
        ? Math.round((1000 * census.voters) / census.censusSize) / 10
        : null;

    const seats = government?.totalSeats ?? m.councilSeats ?? null;
    // Qui té l'alcaldia és qui compta per a la majoria, no qui va guanyar: en
    // 180 municipis no són el mateix i és justament el que es vol veure.
    const governSeats = government?.mayorSeats ?? null;
    const majority = government?.majority ?? null;
    const teMajoria =
      governSeats !== null && majority !== null ? governSeats >= majority : government?.winnerHasMajority ?? null;

    const sigles = government?.mayorSigles ?? m.mayorPartyRaw ?? null;

    return {
      id: m.id,
      slug: m.slug,
      nom: m.name,
      comarca: m.comarca ?? "",
      grup: groups.get(m.id)?.label ?? "sense grup",
      grupMida: groups.get(m.id)?.size,
      valors: {
        poblacio: m.population ?? null,
        regidories: seats,
        participacio,
        alternances: typeof history?.alternances === "number" ? history.alternances : null,
        deute: indicator("deute-habitant"),
        deute_mandat: mandat.valor,
        estalvi: indicator("estalvi-net"),
        saldo: indicator("saldo-no-financer"),
        carrega: indicator("carrega-financera"),
        execucio: indicator("execucio-inversions"),
        pmp: indicator("pmp"),
        ibi: taxes?.taxes?.ibi?.value ?? null,
        selectiva: recollidaSelectiva(own?.get("residus")),
        dones: parity?.complet === false ? null : parity?.womenElectedPct ?? null,
        transparencia: transparency?.pct ?? null,
      },
      percentils: {},
      peus: {
        ...(mandat.peu ? { deute_mandat: mandat.peu } : {}),
        ...(cadastre ? { ibi: `última revisió cadastral: ${Math.round(cadastre)}` } : {}),
      },
      textos: {
        govern: {
          // Les sigles primer i el nom a sota: el que s'atribueix a un govern és
          // de la candidatura, i la persona canvia sense que canviï el govern.
          principal: sigles ?? "No consta",
          secundari: government?.mayorName ?? m.mayorName ?? "",
          ...(sigles ? { color: colorDeLesSigles(sigles) } : {}),
        },
        mesvotada: {
          principal:
            government?.winnerGoverns === true ? "Sí" : government?.winnerGoverns === false ? "No" : "No consta",
          secundari:
            government?.winnerGoverns === false && government.winnerSigles
              ? `la més votada va ser ${government.winnerSigles}`
              : government?.winnerGoverns === true && government.winnerSigles
                ? `${government.winnerSigles}, amb ${government.winnerSeats} de ${seats ?? government.totalSeats}`
                : "",
        },
        majoria: {
          principal: teMajoria === null ? "No consta" : teMajoria ? "Sí" : "No",
          secundari:
            governSeats !== null && seats !== null && majority !== null
              ? teMajoria
                ? `${governSeats} de ${seats} ${seats === 1 ? "regidoria" : "regidories"}`
                : `${governSeats} de ${seats}; en calen ${majority}`
              : seats !== null
                ? `${seats} ${seats === 1 ? "regidoria" : "regidories"} al ple`
                : "",
        },
      },
    };
  });

  // Percentils dins del grup de comparació, no de tot Catalunya: comparar un
  // poble de 300 habitants amb la mediana catalana és comparar-lo amb Barcelona.
  const perGroup = new Map<string, ComparadorRow[]>();
  for (const row of rows) {
    const key = groups.get(row.id)?.key ?? "sense-grup";
    const list = perGroup.get(key);
    if (list) list.push(row);
    else perGroup.set(key, [row]);
  }
  for (const members of perGroup.values()) {
    for (const indicador of INDICADORS) {
      if (!indicador.percentil) continue;
      const valors = members
        .map((r) => r.valors[indicador.clau])
        .filter((v): v is number => typeof v === "number");
      for (const member of members) {
        const valor = member.valors[indicador.clau];
        member.percentils[indicador.clau] = typeof valor === "number" ? percentileOf(valor, valors) : null;
      }
    }
  }

  return rows
    .map(({ id: _id, ...row }) => row)
    .sort((a, b) => (b.valors.poblacio ?? 0) - (a.valors.poblacio ?? 0));
}

// ---------------------------------------------------------------- la pàgina

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** JSON que es pot posar dins d'un `<script>` sense que el tanqui cap cadena. */
const jsonSegur = (value: unknown): string =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

/**
 * El codi d'una funció, tal com anirà a dins del `<script>`.
 *
 * El transpilador embolica les funcions internes amb ajudants seus —`__name`,
 * per conservar-ne el nom—, que existeixen al mòdul però no al navegador: la
 * pàgina es generaria sencera i petaria en obrir-la. Val més no publicar-la.
 */
export function codiPerAlNavegador(fn: { toString(): string }): string {
  const codi = fn.toString();
  const ajudant = codi.match(/\b__[A-Za-z0-9_$]+\s*\(/);
  if (ajudant) {
    throw new Error(
      `El transpilador ha ficat «${ajudant[0]}» dins d'una funció que s'incrusta a la pàgina. ` +
        "Treu-ne les funcions internes: al navegador aquest ajudant no hi és.",
    );
  }
  return codi;
}

/** Com es llegeix la marca de cada fila, escrit a la capçalera de la fila. */
function textDelSentit(indicador: Indicador): string {
  if (indicador.sentit === "amunt") return "com més alt, millor";
  if (indicador.sentit === "avall") return "com més baix, millor";
  if (indicador.sentit === "objectiu") return `com més a prop del ${indicador.objectiu} %, millor`;
  if (indicador.sentit === "neutre") return "no hi ha un «millor»: es marquen els extrems";
  return "no es compara";
}

/**
 * Comparacions per començar. Són suggeriments de municipis del mateix tram de
 * població: si la primera cosa que veu algú fos Barcelona contra un poble de
 * 300 habitants, la pàgina ja hauria ensenyat malament què és comparar.
 */
const SUGGERIMENTS: readonly { titol: string; slugs: readonly string[] }[] = [
  { titol: "Dos veïns del Baix Llobregat", slugs: ["esplugues-de-llobregat", "sant-just-desvern"] },
  { titol: "Tres capitals de província", slugs: ["girona", "lleida", "tarragona"] },
  { titol: "Dues ciutats gironines de mida semblant", slugs: ["olot", "salt"] },
];

const CSS = `
.entradeta{font-size:1.1rem;color:var(--ink-suau);max-width:52ch;margin:var(--e2) 0 var(--e4)}

/* --- el cercador i els municipis triats --- */
.tria{margin-bottom:var(--e3)}
.camp{position:relative;max-width:34rem}
#cerca{width:100%;font:inherit;font-size:1.05rem;padding:13px 15px;border:2.5px solid var(--ink);
  border-radius:var(--r-m);background:var(--paper-2);color:var(--ink);box-shadow:var(--ombra)}
#cerca[disabled]{opacity:.55;box-shadow:none}
.resultats{list-style:none;margin:6px 0 0;padding:0;position:absolute;z-index:9;left:0;right:0;
  background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);box-shadow:var(--ombra);
  max-height:19rem;overflow-y:auto}
.resultats:empty,.resultats[hidden]{display:none}
.resultats li{padding:9px 14px;cursor:pointer;display:flex;justify-content:space-between;gap:var(--e2);align-items:baseline}
.resultats li+li{border-top:1px solid var(--vora)}
.resultats li[aria-selected="true"]{background:var(--lavanda);color:#1E1B2E}
.resultats b{font-family:var(--display);font-weight:900;letter-spacing:-.02em}
.resultats span{font-size:.8rem;opacity:.75;white-space:nowrap}

.triats{list-style:none;margin:var(--e2) 0 0;padding:0;display:flex;flex-wrap:wrap;gap:var(--e1)}
.triats li{display:flex;align-items:center;gap:9px;background:var(--menta);color:#1E1B2E;
  border:2.5px solid #1E1B2E;border-radius:var(--r-max);padding:5px 6px 5px 15px;font-weight:800}
.triats .treu{font:inherit;font-weight:900;line-height:1;cursor:pointer;background:#1E1B2E;color:#FBF7EE;
  border:0;border-radius:var(--r-max);width:26px;height:26px}
.eines{display:flex;flex-wrap:wrap;gap:var(--e2);align-items:center;margin-top:var(--e2)}
.neteja{font:inherit;font-size:.84rem;font-weight:800;background:transparent;color:inherit;cursor:pointer;
  border:2px solid var(--ink);border-radius:var(--r-max);padding:6px 13px}
.compte{font-size:.84rem;color:var(--ink-suau)}

/* --- estat buit: ha de servir per començar, no per disculpar-se --- */
.buit{background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);box-shadow:var(--ombra);
  padding:var(--e3);margin:var(--e3) 0}
.buit h2{font-size:1.4rem}
.buit p{max-width:52ch}
.suggeriments{list-style:none;margin:var(--e2) 0 0;padding:0;display:grid;gap:var(--e1)}
.suggeriments button{font:inherit;text-align:left;width:100%;background:transparent;color:inherit;cursor:pointer;
  border:2px solid var(--ink);border-radius:var(--r-m);padding:11px 15px}
.suggeriments button:hover{background:var(--ink);color:var(--paper)}
.suggeriments b{font-family:var(--display);font-weight:900;letter-spacing:-.02em;display:block}
.suggeriments span{font-size:.86rem;opacity:.8}

/* --- avís de mides diferents --- */
.desigual{background:var(--presec);color:#1E1B2E;border:2.5px solid #1E1B2E;border-radius:var(--r-m);
  padding:var(--e2);margin:var(--e3) 0;font-size:.94rem}
.desigual[hidden]{display:none}

/* --- la taula ---------------------------------------------------------
   Amb quatre municipis no hi caben quatre columnes en un telèfon, així que la
   taula es desplaça de costat i la columna dels indicadors es queda enganxada:
   sense el nom de la fila a la vista, una xifra sola no vol dir res. */
.marc{overflow-x:auto;border:2.5px solid var(--ink);border-radius:var(--r-m);background:var(--paper-2)}
.marc[hidden]{display:none}
.comparativa{border-collapse:separate;border-spacing:0;width:max-content;min-width:100%;font-size:.95rem}
.comparativa th,.comparativa td{text-align:left;vertical-align:top;padding:13px 15px;border-bottom:1px solid var(--vora)}
/* La taula es dimensiona pel contingut; sense un sostre, una frase llarga
   —el nom de l'alcaldia amb el «no va ser la llista més votada»— faria una
   columna de mig metre i obligaria a desplaçar-se per res. */
.comparativa td,.comparativa thead th:not(.cantonada){min-width:11.5rem;max-width:14rem}
.comparativa tbody th{position:sticky;left:0;z-index:2;background:var(--paper-2);border-right:2.5px solid var(--ink);
  min-width:12rem;max-width:12rem;font-weight:800}
.comparativa thead th{position:sticky;top:0;z-index:3;background:var(--paper-2);border-bottom:2.5px solid var(--ink)}
.comparativa thead th.cantonada{left:0;z-index:4;border-right:2.5px solid var(--ink)}
.comparativa .municipi{font-family:var(--display);font-weight:900;font-size:1.15rem;letter-spacing:-.02em;display:block}
.comparativa .municipi a{text-decoration:none;border-bottom:2.5px solid var(--coral)}
.comparativa .lloc{font-size:.78rem;color:var(--ink-suau);display:block;margin-top:2px}
.comparativa .grup{font-size:.72rem;color:var(--ink-suau);display:block;margin-top:4px}
.comparativa tr.seccio th{background:var(--ink);color:var(--paper);font-family:var(--display);font-weight:900;
  font-size:.8rem;text-transform:uppercase;letter-spacing:.12em;position:static;max-width:none;border-right:0}
.comparativa tr.seccio th span{position:sticky;left:15px;display:inline-block}
.comparativa .etq{display:block}
.comparativa .sentit{display:block;font-weight:400;font-size:.74rem;color:var(--ink-suau);margin-top:3px}
.comparativa .valor{font-family:var(--display);font-weight:900;font-size:1.25rem;letter-spacing:-.02em;
  font-variant-numeric:tabular-nums;display:block}
.comparativa .valor.sense{font-size:1rem;color:var(--ink-suau);font-family:var(--text);font-weight:700}
.comparativa .sec{display:block;font-size:.8rem;color:var(--ink-suau);margin-top:2px}
.comparativa .percentil{display:block;font-size:.74rem;color:var(--ink-suau);margin-top:4px}
.marca{display:inline-block;margin-top:6px;border:2px solid #1E1B2E;border-radius:var(--r-max);
  padding:2px 10px;font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#1E1B2E}
.marca.millor{background:var(--menta)}
.marca.pitjor{background:var(--coral)}
.marca.alt,.marca.baix{background:transparent;border-style:dashed;color:var(--ink-suau);border-color:var(--ink-suau)}
.comparativa td.millor{background:rgba(191,232,210,.34)}
.comparativa td.pitjor{background:rgba(226,115,90,.16)}
/* Les caselles amb els extrems marcats (l'IBI, la variació del deute) no
   s'acoloreixen: el fons verd o coral es llegiria com un «bé» o un «malament»
   que aquestes files no diuen. */
.comparativa td.alt,.comparativa td.baix{background:transparent}
/* Un buit que parla ocupa dues ratlles i no ha d'estirar la columna: es
   trenca com una frase, no com una xifra. */
.comparativa .valor.sense{font-size:.86rem;line-height:1.35;white-space:normal;overflow-wrap:anywhere}
/* Les sigles de qui governa, amb el color del partit i la tinta triada per
   lluminància, com a la radiografia. Amb quatre municipis a la taula, un nom
   llarg de coalició no pot fer de fusta d'amplada: es trenca. */
.comparativa .sigla{white-space:normal;overflow-wrap:anywhere;max-width:100%}
.pista{font-size:.82rem;color:var(--ink-suau);margin:var(--e1) 0 0}
/* El compte de forats: no és una alerta, és una advertència de fiabilitat, i va
   amb el mateix pressec dels avisos de mida perquè es llegeixin com a parents. */
.buits{background:var(--presec);color:#1E1B2E;border:2.5px solid #1E1B2E;border-radius:var(--r-m);
  padding:var(--e2);margin:var(--e2) 0 0;font-size:.9rem}
.buits[hidden]{display:none}
.llegenda-taula{font-size:.86rem;color:var(--ink-suau);margin:var(--e3) 0 0;max-width:60ch}
/* «table-layout:fixed» perquè els codis de font no estirin la taula: amb
   «6nei-4b44 · ntc4-rnwr» en una cel·la, la taula feia 387 px i desplaçava la
   pàgina en un mòbil de 320. */
.fonts-fila{width:100%;border-collapse:collapse;font-size:.86rem;margin-top:var(--e2);table-layout:fixed}
/* Amb «table-layout:fixed» les columnes fan 90 px en un mòbil de 320 i una
   paraula com «transparència» no hi cap: sense trencar-la, se n'hi surt i
   desplaça la pàgina sencera. Les notes ara són més llargues, i això val per a
   totes tres columnes, no només per als codis. */
.fonts-fila th,.fonts-fila td{text-align:left;padding:7px 10px 7px 0;border-bottom:1px solid var(--vora);
  vertical-align:top;overflow-wrap:anywhere}
.fonts-fila code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.9em;background:var(--paper-2);
  border:1px solid var(--vora);border-radius:5px;padding:1px 5px;overflow-wrap:anywhere}
@media (max-width:620px){
  .comparativa tbody th{min-width:10rem;max-width:10rem;padding:11px}
  .comparativa td,.comparativa thead th:not(.cantonada){min-width:11rem;max-width:12rem;padding:11px}
}
`;

export function renderComparador(rows: readonly ComparadorRow[], generatedAt: string): string {
  const perSlug = new Map(rows.map((r) => [r.slug, r]));

  // La recollida selectiva només és una fila el dia que hi hagi la dada: una
  // columna de guions no informa de res i fa la taula més llarga. La regla no
  // s'ha generalitzat a tots els indicadors a posta: la resta sí que estan
  // ingerits, i si un dia en fallés la ingesta val més que la fila surti dient
  // «no en tenim la liquidació» que no pas que desaparegui en silenci.
  const indicadors = INDICADORS.filter(
    (i) => i.clau !== "selectiva" || rows.some((r) => r.valors.selectiva !== null),
  );

  // Comarques i grups s'internen: són 43 i una dotzena, repetits 947 vegades.
  const comarques: string[] = [];
  const grups: string[] = [];
  /** Mida de cada grup, a la mateixa posició que el nom: un percentil sense la
   *  mida del grup no es pot llegir («p10» de quants?). */
  const mides: (number | null)[] = [];
  const indexDe = (taula: string[], valor: string): number => {
    const i = taula.indexOf(valor);
    if (i !== -1) return i;
    taula.push(valor);
    return taula.length - 1;
  };
  const xifres = indicadors.filter((i) => i.mena === "xifra");
  const textos = indicadors.filter((i) => i.mena === "text");

  const dades = rows.map((r) => {
    const g = indexDe(grups, r.grup);
    if (mides[g] === undefined) mides[g] = r.grupMida ?? null;
    return {
      s: r.slug,
      n: r.nom,
      c: indexDe(comarques, r.comarca),
      g,
      v: xifres.map((i) => r.valors[i.clau] ?? null),
      p: xifres.map((i) => r.percentils[i.clau] ?? null),
      // Els peus són pocs: van per clau i no per posició perquè no s'hi
      // publiquin 947 × 14 cadenes buides que no diuen res.
      u: Object.fromEntries(
        xifres.map((i) => [i.clau, r.peus?.[i.clau] ?? ""]).filter(([, peu]) => peu !== ""),
      ),
      t: textos.map((i) => {
        const cela = r.textos[i.clau];
        const color = cela?.color;
        return color
          ? [cela?.principal ?? "", cela?.secundari ?? "", color, tintaSobre(color)]
          : [cela?.principal ?? "", cela?.secundari ?? ""];
      }),
    };
  });

  // Els suggeriments es comproven contra el conjunt: si un slug canvia, el
  // suggeriment desapareix en comptes de portar a una comparació buida.
  const suggeriments = SUGGERIMENTS.map((s) => ({
    titol: s.titol,
    slugs: s.slugs.filter((slug) => perSlug.has(slug)),
  }))
    .filter((s) => s.slugs.length >= 2)
    .map((s) => ({ ...s, noms: s.slugs.map((slug) => perSlug.get(slug)!.nom) }));

  const fonts = indicadors
    .map(
      (i) => `<tr><th scope="row">${escape(i.etiqueta)}</th>
      <td>${escape(i.nota)}</td><td><code>${escape(i.font)}</code></td></tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Comparador de municipis · Observatori de quivoto</title>
<meta name="description" content="Tria de dos a quatre municipis catalans i mira'ls costat a costat: qui governa, participació, deute i com ha variat durant el mandat, inversions executades, IBI, paritat i transparència. Només amb dades obertes.">
<style>${RADIOGRAFIA_CSS}${CSS}</style>
</head>
<body>
<a class="salta" href="#comparacio">Ves a la comparació</a>

<header class="capcalera">
  <a class="logo" href="../">Observatori</a>
  <span class="etiqueta">esborrany · dades obertes</span>
</header>

<main>
<section class="portada">
  <p class="micro">Comparador</p>
  <h1>El teu poble, al costat</h1>
  <p class="entradeta">Tria de dos a quatre municipis i mira'ls a la mateixa taula.
  Cada fila diu si «més» vol dir millor o pitjor, i cada xifra porta el seu lloc dins del
  grup de municipis de la mateixa mida, que és l'única comparació que és justa.
  A dalt de tot hi ha qui governa, perquè les xifres de sota tinguin a qui atribuir-se;
  i hi ha una secció que mira com ha anat el mandat i no només com estan les coses avui.</p>
</section>

<section class="tria">
  <div class="camp">
    <label class="nomes-lectors" for="cerca">Afegeix un municipi</label>
    <input id="cerca" type="text" role="combobox" aria-expanded="false" aria-controls="resultats"
      aria-autocomplete="list" autocomplete="off" spellcheck="false"
      placeholder="Escriu un poble: esplugues, la seu, hospitalet…">
    <ul class="resultats" id="resultats" role="listbox" aria-label="Municipis que coincideixen" hidden></ul>
  </div>
  <ul class="triats" id="triats" aria-label="Municipis que compares"></ul>
  <div class="eines">
    <button class="neteja" id="neteja" type="button" hidden>Buida la comparació</button>
    <span class="compte" id="compte"></span>
  </div>
  <p class="nomes-lectors" id="avis" role="status" aria-live="polite"></p>
</section>

<div class="desigual" id="desigual" hidden></div>

<section id="comparacio">
  <div class="buit" id="buit">
    <h2>Encara no hi ha res a comparar</h2>
    <p>Afegeix-hi dos municipis com a mínim —i quatre com a màxim— amb el cercador de dalt.
    L'adreça d'aquesta pàgina es va actualitzant sola, així que la comparació que muntis es
    pot enviar tal qual.</p>
    <ul class="suggeriments">
      ${suggeriments
        .map(
          (s) => `<li><button type="button" data-m="${escape(s.slugs.join(","))}">
        <b>${escape(s.titol)}</b><span>${escape(s.noms.join(" · "))}</span></button></li>`,
        )
        .join("\n      ")}
    </ul>
  </div>

  <div class="marc" id="marc" role="region" aria-label="Taula de comparació, es pot desplaçar de costat" tabindex="0" hidden>
    <table class="comparativa" id="taula">
      <caption class="nomes-lectors">Indicadors dels municipis triats, un per columna</caption>
      <thead id="capcalera-taula"></thead>
      <tbody id="cos-taula"></tbody>
    </table>
  </div>
  <p class="pista" id="pista" hidden>Amb tres o quatre municipis la taula es desplaça de costat;
  la columna dels indicadors es queda fixa.</p>

  <p class="buits" id="buits" hidden></p>

  <p class="llegenda-taula" id="llegenda" hidden><b>Millor</b> i <b>pitjor</b> es marquen només dins dels municipis que
  has triat, i només a les files on hi ha un sentit clar: menys deute és millor, menys participació
  no ho és. A les que no en tenen —quants habitants, quantes regidories, qui governa, quantes vegades
  ha canviat de mans— no es marca res, i al tipus de l'IBI i a la variació del deute només s'assenyalen
  els extrems, sense dir que cap sigui millor.
  El <b>percentil</b> diu on queda cada xifra entre els municipis de la seva mida: p10 vol dir que
  només un 10 % del seu grup té un valor més baix.
  La secció <b>Com ha anat el mandat</b> és l'única que mira el temps i no una foto de l'últim any:
  la resta són nivells, i un nivell pot venir d'una decisió de fa vint anys que no és d'aquest govern.</p>
</section>

<section class="bloc fonts">
  <h2>Què hi ha a cada fila i d'on surt</h2>
  <table class="fonts-fila">
    <thead><tr><th scope="col">Fila</th><th scope="col">Què vol dir</th><th scope="col">Conjunt</th></tr></thead>
    <tbody>${fonts}</tbody>
  </table>
  <p class="nota">Els conjunts amb identificador de vuit caràcters són del Consorci AOC; els altres,
  del portal de dades obertes de la Generalitat. Els percentils i els grups de comparació són
  càlculs nostres i es poden repetir amb el codi del projecte.</p>
</section>
</main>

<footer class="peu">
  <p>quivoto · pàgina generada el ${escape(generatedAt)} · esborrany intern, no indexat</p>
</footer>

<script>
const DADES = ${jsonSegur(dades)};
const COMARQUES = ${jsonSegur(comarques)};
const GRUPS = ${jsonSegur(grups)};
const MIDES = ${jsonSegur(mides.map((m) => m ?? null))};
const XIFRES = ${jsonSegur(xifres.map((i) => ({ clau: i.clau, etiqueta: i.etiqueta, seccio: i.seccio, ordre: indicadors.indexOf(i), format: i.format, sentit: i.sentit, objectiu: i.objectiu ?? null, percentil: i.percentil, absent: i.absent, extrems: i.extrems ?? null, com: textDelSentit(i) })))};
const TEXTOS = ${jsonSegur(textos.map((i) => ({ clau: i.clau, etiqueta: i.etiqueta, seccio: i.seccio, ordre: indicadors.indexOf(i), absent: i.absent, com: textDelSentit(i) })))};
const SECCIONS = ${jsonSegur(SECCIONS)};
const MAXIM = 4;

const normalitza = ${codiPerAlNavegador(normalitza)};
const marquesDe = ${codiPerAlNavegador(marquesDe)};

for (const row of DADES) row.k = normalitza(row.n) + " " + normalitza(COMARQUES[row.c]);
const PER_SLUG = new Map(DADES.map((row) => [row.s, row]));

const cerca = document.getElementById("cerca");
const resultats = document.getElementById("resultats");
const triatsUl = document.getElementById("triats");
const neteja = document.getElementById("neteja");
const compte = document.getElementById("compte");
const avis = document.getElementById("avis");
const buit = document.getElementById("buit");
const marc = document.getElementById("marc");
const pista = document.getElementById("pista");
const buits = document.getElementById("buits");
const llegenda = document.getElementById("llegenda");
const desigual = document.getElementById("desigual");
const capcalera = document.getElementById("capcalera-taula");
const cos = document.getElementById("cos-taula");

let triats = [];
let candidats = [];
let actiu = -1;

const esc = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const milers = (n) => n.toLocaleString("ca-ES");

function formata(def, valor){
  if (valor === null || valor === undefined) return null;
  if (def.format === "euros") return milers(Math.round(valor)) + " €";
  if (def.format === "dies") return milers(Math.round(valor)) + " dies";
  if (def.format === "percent") return valor.toLocaleString("ca-ES", { maximumFractionDigits: 1 }) + " %";
  if (def.format === "tipus") return valor.toLocaleString("ca-ES", { minimumFractionDigits: 2, maximumFractionDigits: 3 }) + " %";
  // Una variació de zero no és «0 €»: és que el deute va quedar igual, i escrit
  // amb un zero es llegeix com si no en tinguessin. El signe hi va sempre, i el
  // menys és el de debò (−), no el guionet del teclat.
  if (def.format === "variacio-euros") {
    const arrodonit = Math.round(valor);
    if (arrodonit === 0) return "igual";
    return (arrodonit > 0 ? "+" : "−") + milers(Math.abs(arrodonit)) + " €";
  }
  if (def.format === "vegades") {
    return valor === 0 ? "cap" : milers(valor) + (valor === 1 ? " vegada" : " vegades");
  }
  return milers(valor);
}

const NOM_MARCA = { millor: "millor", pitjor: "pitjor", alt: "el més alt", baix: "el més baix" };

// Com es diu una marca d'extrem en aquesta fila. «El més alt» val per a l'IBI i
// no val per a una variació, on el que es marca és qui puja i qui baixa.
function nomDeLaMarca(def, marca){
  if ((marca === "alt" || marca === "baix") && def.extrems) return def.extrems[marca];
  return NOM_MARCA[marca];
}
// La població surt a la llista de resultats i a l'avís de mides; es busca per
// clau i no per posició perquè reordenar els indicadors no la faci ballar.
const POBLACIO = XIFRES.findIndex((def) => def.clau === "poblacio");

// ------------------------------------------------------------- adreça i estat

function llegeixAdreca(){
  const parametre = new URLSearchParams(location.search).get("m") || "";
  const vistos = new Set();
  const out = [];
  for (const brut of parametre.split(",")) {
    const slug = brut.trim();
    if (!slug || vistos.has(slug) || !PER_SLUG.has(slug) || out.length >= MAXIM) continue;
    vistos.add(slug);
    out.push(slug);
  }
  return out;
}

// L'adreça s'actualitza sense afegir entrades a l'historial: enrere ha de sortir
// d'aquí, no desfer municipi a municipi.
function desaAdreca(){
  const query = triats.length > 0 ? "?m=" + triats.join(",") : "";
  // Amb el fitxer obert des del disc (file://) hi ha navegadors que no deixen
  // tocar l'adreça; que no funcioni l'enllaç no ha de trencar la taula.
  try { history.replaceState(null, "", location.pathname + query); } catch (error) { /* res a fer */ }
}

function afegeix(slug){
  if (triats.length >= MAXIM || triats.includes(slug) || !PER_SLUG.has(slug)) return;
  triats.push(slug);
  canvia();
}

function treu(slug){
  triats = triats.filter((s) => s !== slug);
  canvia();
}

function canvia(){
  desaAdreca();
  pinta();
  const noms = triats.map((s) => PER_SLUG.get(s).n);
  avis.textContent = triats.length === 0
    ? "No hi ha cap municipi triat."
    : triats.length === 1
      ? "Només hi ha " + noms[0] + ". En cal un altre per comparar."
      : "Compares " + noms.join(", ") + ".";
}

// ------------------------------------------------------------------ cercador

function pintaResultats(){
  const q = normalitza(cerca.value);
  candidats = q.length === 0 ? [] : DADES.filter((row) => row.k.includes(q) && !triats.includes(row.s)).slice(0, 8);
  actiu = candidats.length > 0 ? 0 : -1;
  resultats.innerHTML = candidats.map((row, i) =>
    '<li id="opcio-' + i + '" role="option" aria-selected="' + (i === actiu) + '" data-s="' + esc(row.s) + '">' +
    "<b>" + esc(row.n) + "</b><span>" + esc(COMARQUES[row.c]) + " · " + milers(row.v[POBLACIO] || 0) + " hab.</span></li>").join("");
  resultats.hidden = candidats.length === 0;
  cerca.setAttribute("aria-expanded", candidats.length > 0 ? "true" : "false");
  cerca.setAttribute("aria-activedescendant", actiu === -1 ? "" : "opcio-" + actiu);
}

function mouActiu(pas){
  if (candidats.length === 0) return;
  actiu = (actiu + pas + candidats.length) % candidats.length;
  for (let i = 0; i < resultats.children.length; i += 1) {
    resultats.children[i].setAttribute("aria-selected", i === actiu ? "true" : "false");
  }
  cerca.setAttribute("aria-activedescendant", "opcio-" + actiu);
  resultats.children[actiu].scrollIntoView({ block: "nearest" });
}

function tanca(){
  resultats.hidden = true;
  candidats = [];
  actiu = -1;
  cerca.setAttribute("aria-expanded", "false");
  cerca.removeAttribute("aria-activedescendant");
}

function tria(slug){
  afegeix(slug);
  cerca.value = "";
  tanca();
  // Amb quatre municipis el cercador queda desactivat: el focus ha d'anar a un
  // lloc útil —treure el que s'acaba d'afegir— i no perdre's al document.
  if (cerca.disabled) {
    const boto = triatsUl.querySelector('button[data-s="' + slug + '"]');
    if (boto) boto.focus();
  } else {
    cerca.focus();
  }
}

cerca.addEventListener("input", pintaResultats);
cerca.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown") { event.preventDefault(); if (resultats.hidden) pintaResultats(); else mouActiu(1); }
  else if (event.key === "ArrowUp") { event.preventDefault(); mouActiu(-1); }
  else if (event.key === "Enter") { if (actiu !== -1) { event.preventDefault(); tria(candidats[actiu].s); } }
  else if (event.key === "Escape") { if (!resultats.hidden) { event.preventDefault(); tanca(); } else cerca.value = ""; }
});
// Amb 'mousedown' el clic no perd el focus abans d'hora i la tria no s'escapa.
resultats.addEventListener("mousedown", (event) => {
  const li = event.target.closest("li[data-s]");
  if (!li) return;
  event.preventDefault();
  tria(li.dataset.s);
});
cerca.addEventListener("blur", () => { window.setTimeout(tanca, 120); });

triatsUl.addEventListener("click", (event) => {
  const boto = event.target.closest("button[data-s]");
  if (!boto) return;
  treu(boto.dataset.s);
  cerca.focus();
});
neteja.addEventListener("click", () => { triats = []; canvia(); cerca.focus(); });
for (const boto of document.querySelectorAll(".suggeriments button")) {
  boto.addEventListener("click", () => {
    triats = boto.dataset.m.split(",").filter((s) => PER_SLUG.has(s)).slice(0, MAXIM);
    canvia();
  });
}

// -------------------------------------------------------------------- taula

// Com es llegeix un percentil: sense la mida del grup, «p10» no diu de quants.
function textDelPercentil(row, percentil){
  const mida = MIDES[row.g];
  return "p" + percentil + " " + (mida ? "entre els " + milers(mida) + " municipis de la seva mida"
    : "entre els municipis de la seva mida");
}

function celaXifra(def, row, marca, posicio){
  const valor = row.v[posicio];
  const text = formata(def, valor);
  const percentil = def.percentil ? row.p[posicio] : null;
  const peu = row.u ? row.u[def.clau] : "";
  return '<td' + (marca ? ' class="' + marca + '"' : "") + ">" +
    // Una casella buida no es deixa en blanc ni s'omple d'un guionet: diu quina
    // és la peça que ens falta. Sense això, el 20 % de les comparacions de
    // quatre municipis tenen almenys un forat mut que es llegeix com un zero.
    (text === null
      ? '<span class="valor sense">' + esc(def.absent) + "</span>"
      : '<span class="valor">' + esc(text) + "</span>") +
    (text !== null && peu ? '<span class="sec">' + esc(peu) + "</span>" : "") +
    (percentil === null || percentil === undefined
      ? ""
      : '<span class="percentil">' + esc(textDelPercentil(row, percentil)) + "</span>") +
    (marca ? '<span class="marca ' + marca + '">' + esc(nomDeLaMarca(def, marca)) + "</span>" : "") +
    "</td>";
}

// «tots els municipis» és una etiqueta de grup possible i no encaixa amb la
// frase, així que la frase s'adapta i no al revés. La mida hi va sempre que la
// sabem: comparar «dins del grup» sense dir de quants municipis és no és dir res.
function compara(row){
  const grup = GRUPS[row.g];
  const mida = MIDES[row.g];
  const quants = mida ? "els " + milers(mida) + " municipis " : "els municipis ";
  return grup.indexOf("tots") === 0
    ? "es compara amb " + (mida ? milers(mida) + " municipis" : grup)
    : "es compara amb " + quants + grup;
}

function pintaTaula(){
  const files = triats.map((slug) => PER_SLUG.get(slug));

  capcalera.innerHTML = '<tr><th class="cantonada" scope="col"><span class="nomes-lectors">Indicador</span></th>' +
    files.map((row) =>
      '<th scope="col"><span class="municipi"><a href="../m/' + esc(row.s) + '/">' + esc(row.n) + "</a></span>" +
      '<span class="lloc">' + esc(COMARQUES[row.c]) + "</span>" +
      '<span class="grup">' + esc(compara(row)) + "</span></th>").join("") +
    "</tr>";

  let html = "";
  let forats = 0;
  let caselles = 0;
  for (const seccio of SECCIONS) {
    const deLaSeccio = [];
    XIFRES.forEach((def, i) => { if (def.seccio === seccio) deLaSeccio.push({ def: def, i: i, mena: "xifra" }); });
    TEXTOS.forEach((def, i) => { if (def.seccio === seccio) deLaSeccio.push({ def: def, i: i, mena: "text" }); });
    if (deLaSeccio.length === 0) continue;
    // Dins d'una secció manen l'ordre del catàleg, no el de les dues llistes:
    // a «Qui mana», les sigles de qui governa han d'anar abans de cap xifra que
    // se li atribueixi, i «xifres primer, textos després» les hi posava a sota.
    deLaSeccio.sort((a, b) => a.def.ordre - b.def.ordre);
    // El títol de secció va dins d'un span enganxat a l'esquerra: la cel·la ocupa
    // tota l'amplada de la taula i, en desplaçar-se de costat, el text se n'anava.
    html += '<tr class="seccio"><th scope="colgroup" colspan="' + (files.length + 1) + '"><span>' + esc(seccio) + "</span></th></tr>";
    for (const fila of deLaSeccio) {
      const def = fila.def;
      html += '<tr><th scope="row"><span class="etq">' + esc(def.etiqueta) + "</span>" +
        (def.com ? '<span class="sentit">' + esc(def.com) + "</span>" : "") + "</th>";
      if (fila.mena === "text") {
        html += files.map((row) => {
          const cela = row.t[fila.i] || ["", ""];
          caselles += 1;
          // «No consta» és el que desa la càrrega quan no ha sabut lligar la
          // dada; aquí es canvia per la frase que diu què és el que falta.
          const buida = !cela[0] || cela[0] === "No consta";
          if (buida) forats += 1;
          const sigla = cela[2]
            ? '<b class="sigla" style="--c:' + esc(cela[2]) + ";--t:" + esc(cela[3]) + '">' + esc(cela[0]) + "</b>"
            : '<span class="valor">' + esc(cela[0]) + "</span>";
          return "<td>" +
            (buida ? '<span class="valor sense">' + esc(def.absent) + "</span>" : sigla) +
            (!buida && cela[1] ? '<span class="sec">' + esc(cela[1]) + "</span>" : "") + "</td>";
        }).join("");
      } else {
        const valors = files.map((row) => row.v[fila.i]);
        caselles += valors.length;
        for (const valor of valors) { if (typeof valor !== "number") forats += 1; }
        const marques = marquesDe(def.sentit, def.objectiu === null ? undefined : def.objectiu, valors);
        html += files.map((row, n) => celaXifra(def, row, marques[n], fila.i)).join("");
      }
      html += "</tr>";
    }
  }
  cos.innerHTML = html;
  pintaForats(forats, caselles);
}

// El compte de forats de la comparació que s'està mirant. Una taula amb tres
// caselles buides de setanta no és la mateixa taula que una amb vint, i sense
// dir-ho el lector no ho pot saber sense comptar-les a mà.
function pintaForats(forats, caselles){
  if (forats === 0) {
    buits.hidden = true;
    return;
  }
  buits.hidden = false;
  buits.innerHTML = "<b>" + forats + (forats === 1 ? " casella" : " caselles") + " de " + caselles +
    "</b> d'aquesta taula " + (forats === 1 ? "no té" : "no tenen") + " dada. No vol dir que la xifra " +
    "sigui zero: vol dir que a nosaltres ens falta la peça que hi diu cada casella. Els forats de " +
    "liquidació i d'ordenances són els més habituals als municipis petits, i és on la comparació és " +
    "més fluixa.";
}

function pintaTriats(){
  triatsUl.innerHTML = triats.map((slug) => {
    const row = PER_SLUG.get(slug);
    return "<li>" + esc(row.n) +
      '<button class="treu" type="button" data-s="' + esc(slug) + '" aria-label="Treu ' + esc(row.n) + ' de la comparació">×</button></li>';
  }).join("");
}

// Quan els municipis triats no són del mateix grup, els percentils surten de
// llistes diferents i no es poden posar en fila; i si a més les mides ballen
// molt, les xifres per habitant tampoc no volen dir el mateix. Són dos avisos
// diferents i el segon no sempre toca.
function pintaDesigual(){
  const files = triats.map((slug) => PER_SLUG.get(slug));
  const grups = new Set(files.map((row) => row.g));
  if (files.length < 2 || grups.size < 2) { desigual.hidden = true; return; }
  const poblacions = files.map((row) => row.v[POBLACIO]).filter((v) => typeof v === "number");
  const proporcio = poblacions.length > 1 ? Math.max.apply(null, poblacions) / Math.min.apply(null, poblacions) : 1;
  const noms = files.map((row) =>
    row.n + " (" + GRUPS[row.g] + (MIDES[row.g] ? ", " + milers(MIDES[row.g]) + " municipis" : "") + ")");
  desigual.hidden = false;
  desigual.innerHTML = "<b>No juguen a la mateixa lliga:</b> " + esc(noms.join("; ")) +
    ". Són " + grups.size + " grups de comparació dels " + GRUPS.length + " que hi ha, i surten dels trams " +
    "de població de la llei electoral —els mateixos que decideixen quants regidors té cada ple. " +
    "Cada percentil compara el municipi amb els del seu grup, així que entre ells no es poden posar " +
    "en fila; les xifres sí." +
    (proporcio >= 5
      ? " I amb aquesta diferència de població, el que es gasta i es deu per habitant tampoc no vol dir el mateix: " +
        "una ciutat presta serveis que el seu voltant també fa servir."
      : "");
}

function pinta(){
  pintaTriats();
  pintaDesigual();
  const nhiha = triats.length >= 2;
  buit.hidden = nhiha;
  marc.hidden = !nhiha;
  llegenda.hidden = !nhiha;
  pista.hidden = triats.length < 3;
  if (nhiha) pintaTaula();
  else buits.hidden = true;
  neteja.hidden = triats.length === 0;
  compte.textContent = triats.length >= MAXIM
    ? "Ja n'hi ha quatre, que és el màxim. Treu-ne un per canviar-lo."
    : triats.length === 1
      ? "N'hi falta un altre per poder comparar."
      : triats.length === 0
        ? DADES.length + " municipis per triar"
        : "Encara n'hi pots afegir " + (MAXIM - triats.length) + ".";
  cerca.disabled = triats.length >= MAXIM;
}

triats = llegeixAdreca();
// L'adreça es torna a escriure d'entrada: si arriba amb municipis repetits, amb
// slugs que no existeixen o amb més de quatre, l'enllaç que es comparteixi a
// partir d'aquí ja és el net.
desaAdreca();
pinta();
</script>
</body>
</html>`;
}
