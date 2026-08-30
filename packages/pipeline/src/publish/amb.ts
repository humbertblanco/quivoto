import { eq, sql, type SQLWrapper } from "drizzle-orm";
import { electionParticipation, municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { BRANDS_BY_ID } from "@quivoto/shared-schemas/brands";
import { buildPeerGroups, medianOf, percentileOf, type PeerGroup } from "../derive/peers";
import { dataCurta, slugify } from "../lib/text";
import { RADIOGRAFIA_CSS } from "./estil";
import { MASCOTA_CSS, papereta } from "./mascota";
import { icona } from "./icones";
import {
  TERRITORI_CSS, renderMapaTerritori, renderPoder, renderUllada,
  type ComarcaData, type ComarcaMunicipi, type Pastilla,
} from "./comarques";
import { projecta } from "./mapa";
import { capcalera } from "./capcalera";
import { cercador } from "./cercador";
import { peu } from "./peu";

/**
 * L'Àrea Metropolitana de Barcelona: un ens propi, al costat de les comarques.
 *
 * L'Observatori només sabia agrupar per comarca, i per als trenta-sis municipis
 * metropolitans la comarca no explica res del que comparteixen. El Barcelonès en
 * són cinc; l'AMB en són trenta-sis repartits entre cinc comarques, i el que
 * tenen en comú —l'autobús, l'aigua de l'aixeta, la depuradora, la deixalleria,
 * la platja, el parc— no ho decideix cap dels seus ajuntaments tot sol.
 *
 * Per això aquesta pàgina té una secció que les de comarca no tenen i que és el
 * motiu de ser-hi: **què decideix l'AMB i què no.** Molta gent no sap que una
 * part del que paga al rebut i del que rep al carrer se signa en un consell que
 * no ha votat mai directament. Tot el que s'hi diu surt de la Llei 31/2010 amb
 * l'article al costat, i el que no en surt no s'hi diu: `www.amb.cat` respon 403
 * a qualsevol client automàtic, així que del que fa l'AMB avui només n'hi ha
 * l'enllaç perquè hi vagi qui vulgui.
 *
 * **Tot el que no és la llei ho comparteix amb les pàgines de comarca**, i des
 * d'ara literalment: la ullada d'obertura, les dues cintes de poder, el mapa i
 * el full d'estil surten de `comarques.ts`. N'hi havia una còpia sencera aquí
 * —vuitanta línies de CSS idèntiques— i qualsevol arranjament s'havia de fer
 * dues vegades o quedava a mitges en una de les dues pàgines.
 */

// ------------------------------------------------------------------- formes

export type AmbMunicipi = ComarcaMunicipi & {
  comarca: string | null;
  /**
   * El valor de cada indicador en aquest municipi, per la clau de l'indicador.
   * És el que fa que la pàgina respongui «i el meu poble, com hi queda?»: sense
   * això només s'hi podia llegir la mediana dels 36, que no és de ningú.
   */
  valors: Record<string, number>;
};

/** Una força amb el nombre d'alcaldies metropolitanes que té. */
export type AmbForca = {
  brandId: string;
  label: string;
  color: string;
  alcaldies: number;
  /** Habitants que viuen als municipis que governa. Un poble i una ciutat no pesen igual. */
  habitants: number;
};

/**
 * Les unitats que sap escriure la pàgina. No n'hi ha prou amb «euros»: el preu
 * de l'aigua són 2,29 € el metre cúbic i arrodonir-lo a 2 € el deixaria sense
 * cap de les dues xifres que el fan comparable.
 */
export type AmbUnitat = "euros" | "euros-m3" | "euros-mes" | "percent" | "kg";

/**
 * Qui decideix el que mesura l'indicador. És l'única classificació que fa la
 * pàgina, i surt de la llei, no d'una opinió: «amb» és el que la Llei 31/2010
 * posa a mans del Consell Metropolità, «ajuntament» el que continua sent del
 * ple que sí que es vota, i «cap-dels-dos» el que no decideix ni l'un ni l'altre.
 */
export type AmbQui = "amb" | "ajuntament" | "cap-dels-dos";

export type AmbIndicador = {
  key: string;
  label: string;
  unit: AmbUnitat;
  /** Qui ho decideix, i per tant a qui s'ha de reclamar. */
  qui: AmbQui;
  /** L'article que ho diu, quan qui decideix és l'AMB. Buit si no n'hi ha. */
  article: string;
  /** Mediana dels municipis metropolitans amb dada. */
  metropolita: number | null;
  /** Mediana dels 947, per tenir la referència al costat. */
  catalana: number | null;
  ambDada: number;
  ambDadaCatalunya: number;
  /**
   * Mediana dels percentils que treuen els municipis metropolitans **dins del
   * seu tram de població**. És l'única de les tres xifres que no queda tocada
   * pel fet que a l'AMB hi hagi Barcelona i el Papiol alhora.
   */
  percentilGrup: number | null;
  nota: string;
};

/**
 * Un punt del mapa petit de situació: on cau, i si és dels 36.
 *
 * No hi va ni el nom ni el `slug` perquè aquest mapa no és clicable: és de la
 * mida d'un segell i el dit no hi encertaria cap municipi. El mapa on es clica
 * és el gran, el dels 36 ampliats.
 */
export type PuntSituacio = { lat: number; lon: number; dins: boolean };

/** De quantes comarques surten els 36, i quants n'hi ha de cadascuna. */
export type AmbComarca = { slug: string; name: string; dins: number; total: number };

export type AmbData = {
  nom: string;
  municipis: AmbMunicipi[];
  habitants: number;
  regidories: number;
  poblacioMediana: number | null;
  forces: AmbForca[];
  governaMesVotat: number;
  pacte: number;
  senseIdentificar: number;
  majoriaAbsoluta: number;
  canvisAlcaldia: number;
  indicadors: AmbIndicador[];
  /** Els 947 punts del país, per situar-hi els 36. Buit si no hi ha coordenades. */
  situacio: PuntSituacio[];
  comarques: AmbComarca[];
  /** El conjunt on s'ha de llegir cada xifra metropolitana: els 947 sencers. */
  catalunya: ComarcaData["catalunya"];
};

// -------------------------------------------------------------- presentació

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const number = (n: number): string => n.toLocaleString("ca-ES");
const decimal = (n: number, digits = 1): string => n.toFixed(digits).replace(".", ",");

/** «27 d'agost», no «27 de agost». Una sola còpia, a `lib/text.ts`. */
const formatDate = dataCurta;

/** «des de l'1 de juliol», no «des del 1 de juliol». */
function sinceDate(iso: string | null): string {
  if (!iso) return "";
  const day = Number(iso.slice(8, 10));
  return `${day === 1 || day === 11 ? "des de l'" : "des del "}${formatDate(iso)}`;
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/** Noms curts de les forces; els oficials sencers no caben en un gràfic de barres. */
const NOMS_CURTS: Record<string, string> = {
  psc: "PSC", junts: "Junts", erc: "ERC", cup: "CUP", comuns: "Comuns",
  pp: "PP", cs: "Ciutadans", vox: "Vox", pdecat: "PDeCAT", ciu: "CiU",
  aliancacat: "Aliança Catalana", local: "Llistes locals",
  cda: "Convergència Democràtica Aranesa",
};

/** El groc pur de la CUP no es veu damunt del paper cru: el fosquim just. */
const COLORS: Record<string, string> = { cup: "#d8d000" };

const SENSE_MARCA = "sense-identificar";

function labelOf(brandId: string): string {
  if (brandId === SENSE_MARCA) return "Sense identificar";
  return NOMS_CURTS[brandId] ?? BRANDS_BY_ID.get(brandId)?.name ?? brandId;
}

function colorOf(brandId: string): string {
  if (brandId === SENSE_MARCA) return "#8b8b8b";
  return COLORS[brandId] ?? BRANDS_BY_ID.get(brandId)?.color ?? "#8b8b8b";
}

/**
 * Cada unitat s'escriu amb la precisió que té la font, no amb la que faria goig.
 * L'aigua ve amb tres decimals i se'n publiquen dos, que és el cèntim; el rebut
 * de l'IBI i el deute són euros sencers perquè els cèntims d'una mitjana de
 * milers de rebuts no volen dir res.
 */
function formatValue(value: number, unit: AmbUnitat): string {
  if (unit === "euros") return `${number(Math.round(value))} €`;
  if (unit === "euros-m3") return `${decimal(value, 2)} €/m³`;
  if (unit === "euros-mes") return `${number(Math.round(value))} €/mes`;
  if (unit === "kg") return `${number(Math.round(value))} kg`;
  return `${decimal(value)} %`;
}

// ------------------------------------------------------- què decideix l'AMB

/**
 * Una matèria que la llei posa a mans de l'AMB.
 *
 * Cada targeta porta l'article, i el text de `que` és **el que hi diu la llei**
 * reduït a una frase, no una valoració del servei. `queNo` és la línia que
 * costa més de trobar en cap altre lloc: on s'acaba l'AMB i torna a començar
 * l'ajuntament o la Generalitat.
 */
export type Competencia = {
  clau: string;
  /** El tema de la icona, dels que coneix `icones.ts`. */
  tema: string;
  titol: string;
  article: string;
  que: string;
  queNo: string;
};

/**
 * Les competències metropolitanes, de la Llei 31/2010.
 *
 * L'ordre no és el de la llei sinó el de la vida de qui llegeix: primer el que
 * es paga i s'agafa cada dia, després el que es planifica. L'urbanisme i
 * l'habitatge van junts al final perquè són els dos que la gent atribueix
 * sempre a l'ajuntament, i és on la sorpresa és més grossa.
 */
export const COMPETENCIES: readonly Competencia[] = [
  {
    clau: "transport",
    tema: "mobilitat",
    titol: "L'autobús, el metro i el taxi",
    article: "article 14.B",
    que: `L'autobús urbà i el metro són de titularitat metropolitana, i l'AMB aprova el Pla
      metropolità de mobilitat urbana. També ordena el taxi i els VTC quan el viatge comença i
      acaba dins dels 36: la llei els tracta com una sola àrea de transport.`,
    queNo: `El tramvia no: la llei l'exclou perquè és sistema ferroviari de Catalunya, de la
      Generalitat. Els trens i els Ferrocarrils, tampoc.`,
  },
  {
    clau: "aigua",
    tema: "medi ambient",
    titol: "L'aigua de l'aixeta i la depuradora",
    article: "article 14.C",
    que: `El subministrament d'aigua potable és de titularitat metropolitana, i l'AMB en regula
      l'estructura tarifària —bonificacions incloses— abans que l'autoritzi la Comissió de Preus de
      Catalunya. També són seus el sanejament en alta i la depuració.`,
    queNo: `L'Agència Catalana de l'Aigua manté les seves competències, i el clavegueram del
      carrer és de cada ajuntament: l'AMB només el coordina.`,
  },
  {
    clau: "residus",
    tema: "residus",
    titol: "On van les escombraries",
    article: "article 14.D",
    que: `Tractar, valoritzar i llençar els residus municipals és metropolità, i també els
      enderrocs d'obres menors, la selecció d'envasos i el transport del que es deixa a la
      deixalleria.`,
    queNo: `Recollir-les del carrer és de l'ajuntament, i la deixalleria també: l'AMB en coordina
      els sistemes, no els presta.`,
  },
  {
    clau: "infraestructures",
    tema: "turisme",
    titol: "Els parcs, les platges i les infraestructures",
    article: "article 14.F",
    que: `La llei encarrega a l'AMB la vertebració del territori i n'anomena els parcs, les
      platges, els espais naturals i els equipaments d'interès metropolità.`,
    queNo: `Quines platges i quins parcs ho són ho fixa el planejament, no la llei. No en publiquem
      la llista: no és a cap font oberta.`,
  },
  {
    clau: "mediambient",
    tema: "medi ambient",
    titol: "El soroll, l'aire i el canvi climàtic",
    article: "article 14.E",
    que: `L'AMB formula el pla metropolità de protecció del medi ambient, la salut i la
      biodiversitat i de lluita contra el canvi climàtic, col·labora en els mapes de sorolls i emet
      els informes ambientals de les llicències municipals.`,
    queNo: `La llicència ambiental la continua atorgant l'ajuntament: l'AMB hi posa l'informe.`,
  },
  {
    clau: "urbanisme",
    tema: "urbanisme",
    titol: "El planejament urbanístic",
    article: "articles 14.A i 21 a 34",
    que: `El Pla director urbanístic metropolità i el Pla d'ordenació urbanística metropolità
      classifiquen el sòl dels 36 municipis i hi delimiten les reserves per a infraestructures,
      equipaments i espais lliures.`,
    queNo: `Aprovar definitivament el Pla d'ordenació no és de l'AMB: és de la Comissió
      d'Urbanisme de l'Àrea Metropolitana de Barcelona, òrgan de la Generalitat amb deu vocals del
      departament i deu de la presidència de l'AMB.`,
  },
  {
    clau: "habitatge",
    tema: "habitatge",
    titol: "L'habitatge assequible",
    article: "article 22.e",
    que: `El Pla director urbanístic metropolità ha de definir polítiques de sòl i habitatge que
      garanteixin la solidaritat entre municipis en l'habitatge assequible i de protecció pública.`,
    queNo: `El programa d'actuació urbanística de cada poble el continua formulant el seu
      ajuntament, encara que hagi de ser coherent amb el pla metropolità.`,
  },
  {
    clau: "economia",
    tema: "comerç",
    titol: "L'activitat econòmica i el comerç",
    article: "article 14.G",
    que: `Fomentar l'activitat econòmica i l'ocupació en indústria, comerç, serveis i turisme, i
      promoure un pla estratègic metropolità amb els agents econòmics i socials.`,
    queNo: `És foment i promoció: no substitueix cap llicència ni cap ordenança comercial
      municipal.`,
  },
  {
    clau: "cohesio",
    tema: "serveis socials",
    titol: "La cohesió social i territorial",
    article: "article 14.H",
    que: `Promoure polítiques comunes en serveis municipals i en cohesió social i territorial, i
      participar en la comissió de seguretat de l'àmbit.`,
    queNo: `Els serveis socials que atenen les persones els presta l'ajuntament, i la policia local
      també és municipal.`,
  },
];

/**
 * El que es paga i qui ho decideix.
 *
 * És la part que fa que la pàgina serveixi de debò: al rebut de l'IBI hi ha un
 * recàrrec que no ha decidit l'ajuntament, i la tarifa de l'aigua i del bus les
 * aprova un consell que no s'ha votat mai en una papereta.
 */
export const DINERS: readonly { titol: string; article: string; text: string }[] = [
  {
    titol: "Un recàrrec sobre l'IBI",
    article: "article 40.b",
    text: `Entre els recursos de l'AMB, la llei hi posa el recàrrec sobre l'IBI que la legislació
      d'hisendes locals preveu per a les àrees metropolitanes. El tipus el fixa l'ajuntament; el
      recàrrec, no.`,
  },
  {
    titol: "Les tarifes dels serveis metropolitans",
    article: "article 8.1.i",
    text: `Aprovar les tarifes dels serveis metropolitans és una atribució del Consell Metropolità.
      L'aigua i el transport urbà són serveis metropolitans.`,
  },
  {
    titol: "Les aportacions del teu ajuntament",
    article: "articles 40.j i 42",
    text: `Els municipis hi aporten diners del seu pressupost. Les fixa per majoria absoluta el
      Consell Metropolità i han de ser generals, encara que puguin variar segons el municipi.`,
  },
];

// ---------------------------------------------------------------- càlcul

/** Una lectura d'un indicador a un municipi, amb el mínim per poder-la agrupar. */
type Lectura = { municipalityId: number; value: number };

type IndicadorDef = {
  key: string;
  label: string;
  unit: AmbUnitat;
  qui: AmbQui;
  /** L'article de la Llei 31/2010 que ho posa a mans de l'AMB; buit si no n'és. */
  article?: string;
  nota: string;
};

/**
 * Els tres números d'un indicador metropolità. Els dos primers són directes; el
 * tercer és el que fa que la comparació sigui honesta.
 *
 * A l'AMB hi conviuen Barcelona i la Palma de Cervelló, i una mediana sobre
 * municipis diu tant d'una cosa com de l'altra. Per això cada municipi es
 * percentila **dins del seu tram de la LOREG** i el que es publica és la mediana
 * d'aquells percentils.
 */
export function buildIndicador(
  def: IndicadorDef,
  lectures: readonly Lectura[],
  dins: ReadonlySet<number>,
  peers: ReadonlyMap<number, PeerGroup>,
): AmbIndicador | null {
  const metropolitanes = lectures.filter((l) => dins.has(l.municipalityId));
  if (metropolitanes.length === 0) return null;

  const perGrup = new Map<string, number[]>();
  for (const lectura of lectures) {
    const key = peers.get(lectura.municipalityId)?.key;
    if (!key) continue;
    const list = perGrup.get(key);
    if (list) list.push(lectura.value);
    else perGrup.set(key, [lectura.value]);
  }

  const percentils: number[] = [];
  for (const lectura of metropolitanes) {
    const key = peers.get(lectura.municipalityId)?.key;
    const grup = key ? perGrup.get(key) : undefined;
    const percentil = grup ? percentileOf(lectura.value, grup) : null;
    if (percentil !== null) percentils.push(percentil);
  }

  return {
    key: def.key,
    label: def.label,
    unit: def.unit,
    qui: def.qui,
    article: def.article ?? "",
    metropolita: medianOf(metropolitanes.map((l) => l.value)),
    catalana: medianOf(lectures.map((l) => l.value)),
    ambDada: metropolitanes.length,
    ambDadaCatalunya: lectures.length,
    // Amb tres o quatre municipis la mediana dels percentils és soroll, i val
    // més no dir-la que dir-la amb un asterisc que ningú no llegirà.
    percentilGrup: percentils.length >= 4 ? medianOf(percentils) : null,
    nota: def.nota,
  };
}

// ------------------------------------------------------------------ accés

/**
 * Els documents de `municipality_metrics` sumen tretze megabytes i llegir-los
 * sencers rebenta el WebAssembly de PGlite. Aquí no en fa falta ni un de sencer:
 * es projecta amb `->>` el camp concret i tot torna com a text, que és el que
 * fan igual els dos motors sense discutir sobre tipus.
 */
const text = (column: SQLWrapper, path: string) =>
  sql<string | null>`${column}->>${sql.raw(`'${path.replace(/'/g, "''")}'`)}`;

const toNumber = (value: string | null): number | null => {
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/**
 * Carrega l'AMB reaprofitant les comarques ja llegides.
 *
 * Els municipis surten de `loadComarques`, que ja ha fet la feina caríssima de
 * lligar cada alcaldia amb la seva marca i cada canvi a mig mandat amb el seu
 * successor: tornar-ho a fer per a trenta-sis municipis seria repetir tretze
 * consultes per estalviar-ne una. El que sí que es torna a calcular són els
 * indicadors, perquè les medianes comarcals no es poden sumar.
 *
 * Torna `null` si J17 encara no ha marcat cap municipi: sense composició no hi
 * ha pàgina, i una d'inventada seria pitjor que cap.
 */
export async function loadAmb(db: Db, comarques: readonly ComarcaData[]): Promise<AmbData | null> {
  const membres = await db
    .select({ municipalityId: municipalityMetrics.municipalityId, nom: text(municipalityMetrics.data, "ens") })
    .from(municipalityMetrics)
    .where(eq(municipalityMetrics.kind, "amb"));
  if (membres.length === 0) return null;
  const dins = new Set(membres.map((m) => m.municipalityId));

  // Els totals de Catalunya ja els ha comptat `loadComarques` amb una regla
  // concreta. Tornar-los a sumar aquí seria arriscar-se a comptar-los d'una
  // altra manera i que les dues pàgines diguessin xifres diferents del mateix.
  const catalunya = comarques[0]?.catalunya;
  if (!catalunya) return null;

  const all = await db
    .select({
      id: municipalities.id,
      slug: municipalities.slug,
      comarca: municipalities.comarca,
      population: municipalities.population,
    })
    .from(municipalities);
  const idPerSlug = new Map(all.map((m) => [m.slug, m.id]));
  const comarcaPerSlug = new Map(all.map((m) => [m.slug, m.comarca]));

  // Els municipis metropolitans, amb tot el que les comarques ja saben d'ells.
  const municipis: AmbMunicipi[] = [];
  const perComarca = new Map<string, { dins: number; total: number }>();
  for (const comarca of comarques) {
    for (const m of comarca.municipis) {
      const id = idPerSlug.get(m.slug);
      if (id === undefined || !dins.has(id)) continue;
      municipis.push({ ...m, comarca: comarcaPerSlug.get(m.slug) ?? comarca.name, valors: {} });
      const compte = perComarca.get(comarca.name) ?? { dins: 0, total: comarca.municipis.length };
      compte.dins += 1;
      perComarca.set(comarca.name, compte);
    }
  }
  if (municipis.length === 0) return null;
  municipis.sort((a, b) => (b.population ?? 0) - (a.population ?? 0) || a.name.localeCompare(b.name, "ca"));

  // ---- qui governa cada un dels 36 -----------------------------------
  const forces = new Map<string, AmbForca>();
  let habitants = 0;
  let regidories = 0;
  for (const m of municipis) {
    habitants += m.population ?? 0;
    regidories += m.seats;
    const forcaId = m.mayorBrandId ?? SENSE_MARCA;
    const forca = forces.get(forcaId);
    if (forca) {
      forca.alcaldies += 1;
      forca.habitants += m.population ?? 0;
    } else {
      forces.set(forcaId, {
        brandId: forcaId,
        label: labelOf(forcaId),
        color: colorOf(forcaId),
        alcaldies: 1,
        habitants: m.population ?? 0,
      });
    }
  }

  // ---- els indicadors, sempre contra els 947 -------------------------
  const data = municipalityMetrics.data;

  const parityRows = await db
    .select({ municipalityId: municipalityMetrics.municipalityId, value: text(data, "womenElectedPct") })
    .from(municipalityMetrics)
    .where(eq(municipalityMetrics.kind, "parity"));

  const debtRows = await db
    .select({
      municipalityId: municipalityMetrics.municipalityId,
      value: sql<string | null>`(jsonb_path_query_first(${data}, '$.indicators[*] ? (@.key == "deute-habitant")'))->>'value'`,
    })
    .from(municipalityMetrics)
    .where(eq(municipalityMetrics.kind, "finances"));

  const wasteRows = await db
    .select({
      municipalityId: municipalityMetrics.municipalityId,
      value: text(data, "taxaSelectiva"),
      kg: text(data, "kgHabAny"),
      year: text(data, "darrerAny"),
    })
    .from(municipalityMetrics)
    .where(eq(municipalityMetrics.kind, "residus"));

  /**
   * El preu de l'aigua és **l'indicador d'aquesta pàgina**: és l'únic servei on
   * la tarifa que paga el veí la proposa l'AMB i no el seu ajuntament. Es llegeix
   * el subministrament i no el total perquè és el que diu l'ACA que es pot
   * comparar: a 307 municipis el total no inclou el clavegueram.
   */
  const aiguaRows = await db
    .select({
      municipalityId: municipalityMetrics.municipalityId,
      value: sql<string | null>`${data}#>>'{preu,subministrament}'`,
      year: text(data, "darrerAny"),
    })
    .from(municipalityMetrics)
    .where(eq(municipalityMetrics.kind, "preuAigua"));

  // El recàrrec metropolità sobre l'IBI (article 40.b) va damunt d'aquest rebut.
  // `publicable` és la marca que hi posa J19 quan la sèrie de l'Idescat no fa
  // cap salt sospitós: sense ella la xifra no es publica, ni aquí ni enlloc.
  const ibiRows = await db
    .select({
      municipalityId: municipalityMetrics.municipalityId,
      value: text(data, "rebutMitja"),
      ok: text(data, "publicable"),
      year: text(data, "darrerAny"),
    })
    .from(municipalityMetrics)
    .where(eq(municipalityMetrics.kind, "rebutIbi"));

  const lloguerRows = await db
    .select({
      municipalityId: municipalityMetrics.municipalityId,
      value: text(data, "preu"),
      year: text(data, "darrerAny"),
    })
    .from(municipalityMetrics)
    .where(eq(municipalityMetrics.kind, "habitatge"));

  // De la despesa només se'n llegeix l'últim exercici que la feina J15 ha marcat
  // com a fiable: una liquidació truncada dispararia la mediana dels 36.
  const despesaRows = await db
    .select({
      municipalityId: municipalityMetrics.municipalityId,
      value: sql<string | null>`(jsonb_path_query_first(${data}, '$.total[last]'))->>'perHabitant'`,
      ok: sql<string | null>`(jsonb_path_query_first(${data}, '$.total[last]'))->>'fiable'`,
      year: sql<string | null>`(jsonb_path_query_first(${data}, '$.total[last]'))->>'any'`,
    })
    .from(municipalityMetrics)
    .where(eq(municipalityMetrics.kind, "despesaProgrames"));

  const transparenciaRows = await db
    .select({ municipalityId: municipalityMetrics.municipalityId, value: text(data, "pct") })
    .from(municipalityMetrics)
    .where(eq(municipalityMetrics.kind, "transparency"));

  const turnoutRows = await db
    .select({
      municipalityId: electionParticipation.municipalityId,
      censusSize: electionParticipation.censusSize,
      voters: electionParticipation.voters,
    })
    .from(electionParticipation)
    .where(eq(electionParticipation.electionId, "M20231"));

  const lecturesFrom = (
    rows: readonly { municipalityId: number; value: string | null; ok?: string | null }[],
  ): Lectura[] => {
    const out: Lectura[] = [];
    for (const row of rows) {
      // `ok` és la marca de publicable de la feina d'ingesta. Quan hi és i diu
      // que no, la lectura no compta: ni a la mediana ni a la fitxa del poble.
      if (row.ok !== undefined && row.ok !== null && row.ok !== "true") continue;
      const value = toNumber(row.value);
      if (value === null) continue;
      out.push({ municipalityId: row.municipalityId, value });
    }
    return out;
  };

  const participacio: Lectura[] = [];
  for (const row of turnoutRows) {
    if (!row.censusSize || !row.voters) continue;
    participacio.push({ municipalityId: row.municipalityId, value: (100 * row.voters) / row.censusSize });
  }

  /** L'any de la darrera dada, per escriure'l a l'etiqueta i no deixar-la penjada. */
  const anyDe = (rows: readonly { year: string | null }[]): number =>
    Math.max(0, ...rows.map((r) => toNumber(r.year) ?? 0));
  const anyResidus = anyDe(wasteRows);
  const anyAigua = anyDe(aiguaRows);
  const anyIbi = anyDe(ibiRows);
  const anyLloguer = anyDe(lloguerRows);
  const anyDespesa = anyDe(despesaRows);
  const quan = (any: number): string => (any ? ` el ${any}` : "");

  const peers = buildPeerGroups(all.map((m) => ({ id: m.id, population: m.population })));

  /**
   * L'ordre no és casual i és el que respon la pregunta de la pàgina: primer el
   * que decideix l'AMB, després el que continua decidint el ple que sí que es
   * vota, i al final el que no decideix cap dels dos.
   */
  const defs: ReadonlyArray<readonly [IndicadorDef, Lectura[]]> = [
    [{
      key: "preu-aigua", label: `Preu de l'aigua${quan(anyAigua)}`, unit: "euros-m3",
      qui: "amb", article: "article 14.C",
      nota: "Preu del subministrament domiciliari a l'1 de gener, ús domèstic, consum de 12 m³/mes en un habitatge de tres persones i sense IVA. L'AMB en regula l'estructura tarifària i la Comissió de Preus de Catalunya l'autoritza.",
    }, lecturesFrom(aiguaRows)],
    [{
      key: "residus-kg", label: `Residus per habitant${quan(anyResidus)}`, unit: "kg",
      qui: "amb", article: "article 14.D",
      nota: "Quilos de residus municipals generats per habitant i any. Tractar-los, valoritzar-los i llençar el que queda és metropolità; recollir-los del carrer, no.",
    }, lecturesFrom(wasteRows.map((r) => ({ ...r, value: r.kg })))],
    [{
      key: "selectiva", label: `Recollida selectiva${quan(anyResidus)}`, unit: "percent",
      qui: "ajuntament", article: "article 14.D",
      nota: "Part d'aquells residus que es recull separadament. Aquesta és la meitat municipal de la mateixa escombraria: la recollida la contracta cada ajuntament.",
    }, lecturesFrom(wasteRows)],
    [{
      key: "rebut-ibi", label: `Rebut mitjà de l'IBI${quan(anyIbi)}`, unit: "euros",
      qui: "ajuntament", article: "article 40.b",
      nota: "Quota íntegra dividida pels rebuts d'IBI urbà. No és el tipus impositiu. El tipus el fixa l'ajuntament; el recàrrec metropolità que la llei permet damunt d'aquest impost, no.",
    }, lecturesFrom(ibiRows)],
    [{
      key: "despesa-habitant", label: `Despesa per habitant${quan(anyDespesa)}`, unit: "euros",
      qui: "ajuntament",
      nota: "Obligacions reconegudes netes de la liquidació del pressupost, dividides pel padró de l'exercici. No hi ha la despesa metropolitana: els comptes de l'AMB no són a cap font oberta que fem servir.",
    }, lecturesFrom(despesaRows)],
    [{
      key: "deute-habitant", label: "Deute per habitant", unit: "euros",
      qui: "ajuntament",
      nota: "Deute viu a 31 de desembre dividit pel padró, de l'últim exercici tancat que consta a cada ajuntament.",
    }, lecturesFrom(debtRows)],
    [{
      key: "transparencia", label: "Transparència", unit: "percent",
      qui: "ajuntament",
      nota: "Part dels ítems del portal de transparència que l'ajuntament té publicats, segons el segell Infoparticipa del Consorci AOC.",
    }, lecturesFrom(transparenciaRows)],
    [{
      key: "participacio", label: "Participació el 2023", unit: "percent",
      qui: "ajuntament",
      nota: "Vots emesos sobre el cens a les municipals del 28 de maig del 2023. És l'única d'aquestes xifres que decideix directament qui llegeix.",
    }, participacio],
    [{
      key: "paritat", label: "Dones al ple", unit: "percent",
      qui: "ajuntament",
      nota: "Regidories ocupades per dones al ple sortit del 2023.",
    }, lecturesFrom(parityRows)],
    [{
      key: "lloguer", label: `Lloguer mitjà${quan(anyLloguer)}`, unit: "euros-mes",
      qui: "cap-dels-dos", article: "article 22.e",
      nota: "Renda mitjana dels contractes de lloguer registrats a la fiança. No la fixa ningú de les dues administracions: el pla metropolità només hi pot posar sòl i habitatge protegit.",
    }, lecturesFrom(lloguerRows)],
  ];

  // El valor de cada indicador a cada un dels 36, que és el que permet a la
  // pàgina dir «i el teu poble, aquí» en comptes de només la mediana del conjunt.
  const idPerMunicipi = new Map(municipis.map((m) => [idPerSlug.get(m.slug), m]));
  for (const [def, lectures] of defs) {
    for (const lectura of lectures) {
      const municipi = idPerMunicipi.get(lectura.municipalityId);
      if (municipi) municipi.valors[def.key] = lectura.value;
    }
  }

  const indicadors = defs
    .map(([def, lectures]) => buildIndicador(def, lectures, dins, peers))
    .filter((i): i is AmbIndicador => i !== null);

  return {
    nom: membres[0]?.nom ?? "Àrea Metropolitana de Barcelona",
    municipis,
    habitants,
    regidories,
    poblacioMediana: medianOf(municipis.map((m) => m.population ?? 0)),
    forces: [...forces.values()].sort(
      (a, b) => b.alcaldies - a.alcaldies || b.habitants - a.habitants || a.label.localeCompare(b.label, "ca"),
    ),
    governaMesVotat: municipis.filter((m) => m.winnerGoverns === true).length,
    pacte: municipis.filter((m) => m.winnerGoverns === false).length,
    senseIdentificar: municipis.filter((m) => m.winnerGoverns === null).length,
    majoriaAbsoluta: municipis.filter((m) => m.winnerGoverns === true && m.hasMajority).length,
    canvisAlcaldia: municipis.filter((m) => m.mayorChanged).length,
    indicadors,
    /**
     * Els 947 punts del país amb els 36 marcats. Es fa aquí i no al mapa gran
     * perquè `loadComarques` ja té les coordenades de tots: tornar-les a llegir
     * seria una consulta més per una xifra que ja tenim a la mà.
     */
    situacio: comarques.flatMap((comarca) =>
      comarca.municipis.flatMap((m) =>
        m.lat === null || m.lon === null
          ? []
          : [{ lat: m.lat, lon: m.lon, dins: dins.has(idPerSlug.get(m.slug) ?? -1) }],
      ),
    ),
    comarques: [...perComarca.entries()]
      .map(([name, compte]) => ({ slug: slugify(name), name, dins: compte.dins, total: compte.total }))
      .sort((a, b) => b.dins - a.dins || a.name.localeCompare(b.name, "ca")),
    catalunya,
  };
}

// --------------------------------------------------------------- fragments

/** Què decideix l'AMB i què no: la secció que justifica que aquesta pàgina existeixi. */
function renderCompetencies(): string {
  const cards = COMPETENCIES.map((c) => {
    const dibuix = icona(c.tema);
    return `<li class="competencia" id="fa-${escape(c.clau)}">
    <div class="cap">${dibuix}<h3>${escape(c.titol)}</h3></div>
    <p class="que">${c.que.replace(/\s+/g, " ").trim()}</p>
    <p class="que-no"><b>On s'acaba:</b> ${c.queNo.replace(/\s+/g, " ").trim()}</p>
    <p class="cita">Llei 31/2010, ${escape(c.article)}</p>
  </li>`;
  }).join("");
  return `<ul class="competencies">${cards}</ul>`;
}

/** Els diners: el tros que ningú no explica i que surt al rebut. */
function renderDiners(): string {
  const items = DINERS.map(
    (d) => `<li><span class="nom">${escape(d.titol)}</span>
    <span>${d.text.replace(/\s+/g, " ").trim()}</span>
    <span class="cita">Llei 31/2010, ${escape(d.article)}</span></li>`,
  ).join("");
  return `<ul class="detall diners-amb">${items}</ul>`;
}

/** Governa el més votat, o hi va haver pacte. Una barra de tres trams i prou. */
function renderRepartiment(data: AmbData): string {
  const total = Math.max(1, data.municipis.length);
  const trams: ReadonlyArray<readonly [number, string, string]> = [
    [data.governaMesVotat, "governa-guanyador", "governa el més votat"],
    [data.pacte, "governa-pacte", "hi va haver pacte"],
    [data.senseIdentificar, "governa-desconegut", "sense identificar"],
  ];
  const bars = trams
    .filter(([n]) => n > 0)
    .map(([n, cls, label]) => {
      const share = (100 * n) / total;
      return `<span class="${cls}" style="--w:${share}%" title="${n} ${escape(label)}">${share >= 7 ? `<b>${n}</b>` : ""}</span>`;
    })
    .join("");
  const clau = trams
    .filter(([n]) => n > 0)
    .map(([n, cls, label]) => `<li><span class="mostra ${cls}"></span><b>${n}</b> ${escape(label)}</li>`)
    .join("");
  return `<figure class="grafic">
  <div class="repartiment" role="img" aria-label="${trams.filter(([n]) => n > 0).map(([n, , label]) => `${n} ${label}`).join("; ")}.">${bars}</div>
  <ul class="clau">${clau}</ul>
</figure>`;
}

/** Els municipis on l'alcaldia no és de la llista més votada, amb nom i cognoms. */
function renderPactes(data: AmbData): string {
  const pactes = data.municipis.filter((m) => m.winnerGoverns === false);
  if (pactes.length === 0) {
    return `<p>A tots els municipis metropolitans on hem pogut identificar l'alcaldia, la governa
    la llista més votada.</p>`;
  }
  const items = pactes
    .map(
      (m) => `<li><a href="../m/${escape(m.slug)}/">${escape(m.name)}</a>
      <span class="secundari">governa ${escape(m.mayorSigles ?? "?")}; la més votada va ser ${escape(m.winnerSigles ?? "?")}</span></li>`,
    )
    .join("");
  return `<p>A <b>${pactes.length}</b> ${plural(pactes.length, "municipi", "municipis")} dels
  ${data.municipis.length} l'alcaldia no és de la llista més votada. Vol dir que hi va haver pacte.</p>
  <ul class="detall">${items}</ul>`;
}

/** Canvis d'alcaldia a mig mandat, que és on es veu la política que no es vota. */
function renderCanvis(data: AmbData): string {
  const canvis = data.municipis.filter((m) => m.mayorChanged);
  if (canvis.length === 0) {
    return `<p>Cap dels ${data.municipis.length} municipis metropolitans no ha canviat d'alcaldia
    des de la constitució dels plens el juny del 2023.</p>`;
  }
  const items = canvis
    .map(
      (m) => `<li><a href="../m/${escape(m.slug)}/">${escape(m.name)}</a>
      <span class="secundari">${escape(m.mayorChangeName ?? "")}${m.mayorChangeDate ? `, ${sinceDate(m.mayorChangeDate)}` : ""}</span></li>`,
    )
    .join("");
  return `<p><b>${canvis.length}</b> dels ${data.municipis.length}
  ${plural(canvis.length, "municipis ha canviat", "municipis han canviat")} d'alcaldia des de la
  constitució dels plens del juny del 2023.</p>
  <ul class="detall">${items}</ul>
  <p class="nota">Les fonts desen qui ocupa el càrrec, no per què va marxar l'anterior: no se'n pot
  deduir cap moció de censura. Un canvi d'alcaldia també canvia qui seu al Consell.</p>`;
}

/**
 * El mapa petit que situa els 36 dins dels 947.
 *
 * El mapa gran els ensenya **ampliats**, que és l'única escala on qui hi busca
 * el seu poble el pot encertar amb el dit: els 36 caben en trenta quilòmetres i
 * dibuixats damunt de Catalunya sencera serien una taca d'un centímetre on no
 * es distingiria Barcelona de Badalona. El preu d'ampliar-los és que es perd on
 * cau la taca, i això és el que torna aquest segell: els 947 punts del país amb
 * els 36 encesos. Dos dibuixos, cadascun amb la feina que l'altre no pot fer.
 *
 * Els punts són quadrets d'un sol traç i no cercles: 947 elements `circle` són
 * cent quilobytes de pàgina, i aquí n'hi ha prou amb dues formes.
 */
function renderSituacio(punts: readonly PuntSituacio[]): string {
  // Amb quatre punts no surt cap silueta i el segell no situaria res.
  if (punts.length < 100) return "";
  const amplada = 320;
  const marge = 4;
  const projectats = projecta(
    punts.map((p) => ({ slug: "", nom: "", lat: p.lat, lon: p.lon })),
    amplada - 2 * marge,
  );
  const alcada = Math.max(...projectats.map((p) => p.y)) + 2 * marge;

  const quadrat = (i: number, costat: number): string => {
    const p = projectats[i]!;
    const x = (p.x + marge - costat / 2).toFixed(1);
    const y = (p.y + marge - costat / 2).toFixed(1);
    return `M${x} ${y}h${costat}v${costat}h-${costat}z`;
  };
  const fora = punts.map((p, i) => (p.dins ? "" : quadrat(i, 2.2))).join("");
  const metropolitans = punts.map((p, i) => (p.dins ? quadrat(i, 4.2) : "")).join("");
  const quants = punts.filter((p) => p.dins).length;

  return `<figure class="situacio">
  <svg viewBox="0 0 ${amplada} ${alcada.toFixed(0)}" role="img"
    aria-label="Mapa de Catalunya amb un punt per municipi: els ${quants} metropolitans, marcats, ocupen una taca a la costa central.">
    <path d="${fora}" fill="var(--vora)"/>
    <path d="${metropolitans}" fill="var(--coral)" stroke="#1E1B2E" stroke-width="0.6"/>
  </svg>
  <figcaption>On cau la taca: els ${quants} metropolitans damunt dels ${punts.length} municipis
  del país. A dalt es veuen ampliats perquè, a aquesta escala, tots ells fan un centímetre.</figcaption>
</figure>`;
}

/** Els tres grups d'indicadors, amb el títol que diu de qui és la decisió. */
const GRUPS: ReadonlyArray<readonly [AmbQui, string, string]> = [
  ["amb", "Ho decideix l'AMB", "Ho fixa el Consell Metropolità, no el ple que vas votar."],
  ["ajuntament", "Ho decideix el teu ajuntament", "Aquí sí que la papereta del 23-M hi arriba."],
  ["cap-dels-dos", "No ho decideix cap dels dos", "Hi posen condicions, però el número el fa el mercat."],
];

/** Qui té el valor més alt i qui el més baix entre els 36, amb nom i enllaç. */
function extrems(data: AmbData, key: string): { alt: AmbMunicipi; baix: AmbMunicipi } | null {
  const amb = data.municipis.filter((m) => typeof m.valors[key] === "number");
  if (amb.length < 4) return null;
  const ordenats = [...amb].sort((a, b) => a.valors[key]! - b.valors[key]!);
  return { baix: ordenats[0]!, alt: ordenats[ordenats.length - 1]! };
}

/**
 * Les medianes del conjunt, però ordenades per qui pren la decisió.
 *
 * Abans eren quatre targetes totes iguals i cap deia de qui era la xifra. La
 * pàgina es pregunta què decideix l'AMB, i una llista d'indicadors que barreja
 * el preu de l'aigua —que fixa el Consell Metropolità— amb la participació
 * electoral respon a una altra pregunta. Amb el grup, cada targeta diu a qui
 * s'ha de reclamar, i quan és de l'AMB hi porta l'article de la llei.
 *
 * Els dos extrems hi són perquè una mediana no és de ningú: entre els 36 hi ha
 * qui paga molt més i qui molt menys, i cadascun és un enllaç a la seva fitxa.
 */
function renderIndicadors(data: AmbData): string {
  const targeta = (indicador: AmbIndicador): string => {
    const metropolita = indicador.metropolita === null ? "—" : formatValue(indicador.metropolita, indicador.unit);
    const catalana = indicador.catalana === null ? "" : formatValue(indicador.catalana, indicador.unit);
    const punta = extrems(data, indicador.key);
    return `<li class="indicador">
      <span class="nom">${escape(indicador.label)}</span>
      <span class="gran">${metropolita}</span>
      <span class="secundari">mediana metropolitana · ${indicador.ambDada} de ${data.municipis.length}
        ${plural(indicador.ambDada, "municipi amb dada", "municipis amb dada")}</span>
      ${catalana ? `<span class="referencia">Mediana catalana: <b>${catalana}</b>
        <span class="secundari">(${number(indicador.ambDadaCatalunya)} municipis)</span></span>` : ""}
      ${indicador.percentilGrup === null
        ? ""
        : `<span class="percentil">Percentil <b>${Math.round(indicador.percentilGrup)}</b> entre els de la seva mida</span>`}
      ${punta
        ? `<span class="puntes">
          <span>Més alt: <a href="../m/${escape(punta.alt.slug)}/">${escape(punta.alt.name)}</a>,
            <b>${formatValue(punta.alt.valors[indicador.key]!, indicador.unit)}</b></span>
          <span>Més baix: <a href="../m/${escape(punta.baix.slug)}/">${escape(punta.baix.name)}</a>,
            <b>${formatValue(punta.baix.valors[indicador.key]!, indicador.unit)}</b></span>
        </span>`
        : ""}
      ${indicador.article ? `<span class="cita">Llei 31/2010, ${escape(indicador.article)}</span>` : ""}
      <span class="secundari">${escape(indicador.nota)}</span>
    </li>`;
  };

  const grups = GRUPS.map(([qui, titol, entrada]) => {
    const dins = data.indicadors.filter((i) => i.qui === qui);
    if (dins.length === 0) return "";
    return `<h3 class="qui-decideix qui-${qui}">${escape(titol)}</h3>
    <p class="entrada-bloc">${escape(entrada)}</p>
    <ul class="indicadors">${dins.map(targeta).join("")}</ul>`;
  }).join("");

  return `${grups}
  <p class="nota">Les medianes són sobre municipis, no sobre habitants: Barcelona hi compta un cop,
  com el Papiol. El <b>percentil</b> mesura cada municipi només amb els del seu tram de població de
  la LOREG: 80 és estar per sobre de quatre de cada cinc de la seva mida.</p>`;
}

/** De quantes comarques surten els 36. És l'argument de per què l'AMB és un ens propi. */
function renderComarques(data: AmbData): string {
  const items = data.comarques
    .map(
      (c) => `<li><a href="../c/${escape(c.slug)}/">${escape(c.name)}</a>
      <span class="secundari"><b>${c.dins}</b> ${plural(c.dins, "municipi metropolità", "municipis metropolitans")}
      dels ${c.total} de la comarca</span></li>`,
    )
    .join("");
  return `<ul class="detall">${items}</ul>`;
}

/**
 * Les tres xifres que aquesta pàgina compara municipi per municipi.
 *
 * No hi són totes deu: en una taula de trenta-sis files, deu columnes no es
 * llegeixen a cap pantalla i a un mòbil no hi caben. Hi són les dues que
 * decideix l'AMB —el preu de l'aigua i els quilos de residus— i la que és la
 * cara municipal de la mateixa escombraria, que és exactament la línia que la
 * pàgina vol ensenyar. La resta es llegeix a la fitxa de cada poble.
 */
const COLUMNES: ReadonlyArray<{ key: string; curt: string; classe: string; unitat: string }> = [
  { key: "preu-aigua", curt: "Aigua", classe: "aig", unitat: " €/m³ d'aigua" },
  { key: "residus-kg", curt: "Residus", classe: "res", unitat: " kg de residus" },
  { key: "selectiva", curt: "Selectiva", classe: "sel", unitat: " % de selectiva" },
];

/**
 * La llista de municipis: el motiu pel qual algú arriba a aquesta pàgina.
 *
 * Cada xifra hi porta una barreta de la seva posició entre els 36. Una xifra
 * sola no diu si és molta o poca —2,29 € el metre cúbic no vol dir res a qui no
 * en sàpiga cap altra— i la barra ho resol sense fer llegir trenta-sis files.
 */
function renderMunicipis(data: AmbData): string {
  // El mínim i el màxim de cada columna, que és el que ancora la barreta. Sense
  // dades de quatre municipis no es dibuixa: dues barres no comparen res.
  const escales = new Map<string, { min: number; max: number }>();
  for (const columna of COLUMNES) {
    const valors = data.municipis
      .map((m) => m.valors[columna.key])
      .filter((v): v is number => typeof v === "number");
    if (valors.length < 4) continue;
    escales.set(columna.key, { min: Math.min(...valors), max: Math.max(...valors) });
  }
  const columnes = COLUMNES.filter((c) => escales.has(c.key));

  const cella = (m: AmbMunicipi, columna: (typeof COLUMNES)[number]): string => {
    const valor = m.valors[columna.key];
    const escala = escales.get(columna.key)!;
    if (typeof valor !== "number") return `<td class="xifra dada ${columna.classe}">—</td>`;
    const part = (100 * (valor - escala.min)) / (escala.max - escala.min || 1);
    const escrit = columna.key === "preu-aigua" ? decimal(valor, 2) : columna.key === "selectiva" ? decimal(valor) : number(Math.round(valor));
    return `<td class="xifra dada ${columna.classe}"><span class="v">${escrit}</span>
      <span class="barra" aria-hidden="true"><i style="--p:${part.toFixed(0)}%"></i></span></td>`;
  };

  const rows = data.municipis
    .map((m) => {
      const marca =
        m.winnerGoverns === false
          ? '<span class="marca-pacte">pacte</span>'
          : m.hasMajority
            ? ""
            : '<span class="marca-minoria">ple sense majoria</span>';
      const canvi = m.mayorChanged ? '<span class="marca-canvi">canvi a mig mandat</span>' : "";
      return `<tr>
      <th scope="row"><a href="../m/${escape(m.slug)}/">${escape(m.name)}</a></th>
      <td class="secundari com">${escape(m.comarca ?? "—")}</td>
      <td class="xifra pob">${number(m.population ?? 0)}</td>
      <td class="xifra reg">${m.seats}</td>
      ${columnes.map((c) => cella(m, c)).join("")}
      <td class="secundari alc">${escape(m.mayorName ?? "—")} · ${escape(m.mayorSigles ?? "—")} ${marca} ${canvi}</td>
    </tr>`;
    })
    .join("");
  const caps = columnes.map((c) => `<th>${escape(c.curt)}</th>`).join("");
  return `<table class="municipis">
  <thead><tr><th>Municipi</th><th>Comarca</th><th>Habitants</th><th>Regidories</th>${caps}<th>Alcaldia</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
  <p class="nota">Aigua, euros el metre cúbic de subministrament; residus, quilos per habitant i
  any; selectiva, la part que se'n recull separada. La barreta situa el municipi entre el més baix
  i el més alt dels ${data.municipis.length}, no dels ${number(data.catalunya.municipis)}.</p>`;
}

// ------------------------------------------------------------------ estil

/**
 * El que aquesta pàgina té i les de comarca no.
 *
 * La resta —cintes, mapa, taula de municipis, targetes d'indicador— és
 * `TERRITORI_CSS`, el mateix full que les 43 comarques. Aquí només hi queda el
 * que és propi: les targetes de competència, que són l'única cosa de
 * l'Observatori que explica una llei en comptes d'una xifra, i l'escala de
 * representants del Consell.
 */
const AMB_CSS = TERRITORI_CSS + `
.diners-amb li{font-size:.94rem}
.cita{font-size:.78rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;
  color:var(--coral-text);margin:6px 0 0}

/* Què decideix l'AMB: el bloc que aquesta pàgina té i les de comarca no. Cada
   targeta és una matèria, i sota de tot hi ha sempre l'article que ho diu. */
.competencies{list-style:none;margin:0;padding:0;display:grid;gap:var(--e2);
  grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
.competencia{background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);
  box-shadow:var(--ombra);padding:var(--e2);display:flex;flex-direction:column;gap:2px}
.competencia .cap{display:flex;align-items:center;gap:var(--e1);margin-bottom:var(--e1)}
.competencia .cap .icona{flex:0 0 auto;width:38px;height:38px}
.competencia h3{font-family:var(--display);font-weight:900;font-size:1.08rem;letter-spacing:-.02em;margin:0;min-width:0}
.competencia p{margin:0 0 var(--e1);font-size:.92rem}
.competencia .que-no{color:var(--ink-suau)}
.competencia .cita{margin-top:auto;padding-top:var(--e1)}

/* El consell que no es vota: una escala i prou, sense xifres per municipi. */
.escala{list-style:none;margin:0 0 var(--e2);padding:0;display:grid;gap:6px}
.escala li{display:flex;gap:var(--e2);align-items:baseline;padding:7px 0;border-bottom:1px solid var(--vora)}
.escala b{font-family:var(--display);font-weight:900;font-size:1.15rem;flex:0 0 3.2em;
  font-variant-numeric:tabular-nums}

/* «Metropolitana» fa tretze lletres i no es parteix. A 390 px de vista, el
   titular en demanava 272 dins d'una columna de 234 i el document se n'anava a
   404: la pagina vessava de catorze pixels per una sola paraula. Amb la mida
   lligada a l'ample de la vista, la paraula sempre hi cap. */
.portada .presenta h1{font-size:clamp(1.9rem,8.2vw,2.6rem)}

/* El segell de situacio: on cauen els 36 dins dels 947. Va estret perque es
   una nota al peu del mapa gran, no un segon mapa per mirar-s'hi estona. */
.situacio{margin:0 0 var(--e3);max-width:320px}
.situacio svg{display:block;width:100%;height:auto}
.situacio figcaption{font-size:.8rem;color:var(--ink-suau);line-height:1.4;margin-top:6px}
@media (min-width:760px){
  /* A pantalla ampla els dos mapes van l'un al costat de l'altre: el gran per
     buscar-hi el poble, el petit per saber on cau la taca. */
  .parell-mapes{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:var(--e3);align-items:start}
  .parell-mapes .mapa-territori,.parell-mapes .situacio{margin-bottom:0}
}

/* De qui es la decisio: el titol que parteix els indicadors en tres. El color
   de la barra no es decoratiu, es la mateixa clau que les targetes de dalt. */
.qui-decideix{font-family:var(--display);font-weight:900;font-size:1.05rem;letter-spacing:-.01em;
  margin:var(--e3) 0 2px;padding-left:12px;border-left:6px solid var(--vora)}
.qui-amb{border-left-color:var(--coral)}
.qui-ajuntament{border-left-color:var(--menta)}
.qui-cap-dels-dos{border-left-color:var(--lavanda)}
.qui-decideix+.entrada-bloc{margin-top:0}

/* Els dos extrems de cada indicador: una mediana no es de ningu, i aixo diu de
   qui es el numero mes alt i el mes baix dels 36. */
.puntes{display:flex;flex-direction:column;gap:1px;font-size:.86rem;color:var(--ink-suau)}
.puntes b{font-variant-numeric:tabular-nums;color:var(--ink)}

/* Les tres columnes comparables de la taula dels 36. La barreta hi es perque
   «2,29» tot sol no diu si es car o barat. */
.municipis .dada .v{font-weight:800}
.municipis .barra{display:block;height:6px;background:var(--vora);border-radius:var(--r-max);
  margin-top:3px;min-width:44px}
.municipis .barra i{display:block;height:100%;width:var(--p);min-width:3px;background:var(--coral);
  border-radius:var(--r-max)}
@media (max-width:640px){
  /* Sense capcalera de taula cal dir la unitat al costat, com ja fan la
     poblacio i les regidories. La barreta no hi cap en linia i se'n va. */
  .municipis .dada{display:inline;font-weight:400;color:var(--ink-suau);font-size:.86rem}
  .municipis .dada .barra{display:none}
  .municipis .aig::after{content:" €/m³ · "}
  .municipis .res::after{content:" kg · "}
  .municipis .sel::after{content:" % de selectiva"}
  .municipis .alc{margin-top:4px}
}
`;


// ------------------------------------------------------------------ pàgina

/**
 * El resum d'una frase. A la fitxa municipal és qui mana; aquí és quina força
 * té més alcaldies metropolitanes, sempre dient de quants municipis parlem.
 */
export function summarySentence(data: AmbData): string {
  const first = data.forces[0];
  if (!first || first.brandId === SENSE_MARCA) return "";
  const second = data.forces[1];
  const head =
    second && second.alcaldies === first.alcaldies
      ? `<b>${escape(first.label)}</b> i <b>${escape(second.label)}</b> empaten a ${first.alcaldies}
         ${plural(first.alcaldies, "alcaldia", "alcaldies")} dels ${data.municipis.length} municipis metropolitans`
      : `<b>${escape(first.label)}</b> té ${first.alcaldies}
         ${plural(first.alcaldies, "alcaldia", "alcaldies")} dels ${data.municipis.length} municipis metropolitans`;
  const share = (100 * first.alcaldies) / Math.max(1, data.municipis.length);
  const tail = share >= 50 && !(second && second.alcaldies === first.alcaldies) ? ", més de la meitat" : "";
  return `${head}${tail}.`;
}

/**
 * Les sis xifres que obren la pàgina.
 *
 * Les tres primeres diuen de quina mida és l'àrea; les tres següents, qui hi
 * mana i què decideix. La sisena és la que fa que la pàgina existeixi: el
 * nombre de matèries que la llei posa a mans d'un ens que ningú no vota.
 */
function ulladaAmb(data: AmbData): string {
  const total = Math.max(1, data.municipis.length);
  const cat = data.catalunya;
  const pastilles: Pastilla[] = [
    {
      etq: "Municipis",
      xifra: number(data.municipis.length),
      part: null,
      peu: `dels ${number(cat.municipis)} de Catalunya, repartits entre ${data.comarques.length}
        ${plural(data.comarques.length, "comarca", "comarques")}`.replace(/\s+/g, " "),
      on: "#municipis",
      tema: "urbanisme",
    },
    {
      etq: "Habitants",
      xifra: number(data.habitants),
      part: null,
      peu: `el ${decimal((100 * data.habitants) / Math.max(1, cat.habitants))} % dels de Catalunya`,
      on: "#municipis",
      tema: "serveis socials",
    },
    {
      etq: "Regidories en joc el 23-M",
      xifra: number(data.regidories),
      part: null,
      peu: `de les ${number(cat.regidories)} de Catalunya`,
      on: "#municipis",
      tema: "el ple",
    },
  ];

  const primera = data.forces[0];
  if (primera && primera.brandId !== SENSE_MARCA) {
    pastilles.push({
      etq: "La força amb més alcaldies",
      xifra: number(primera.alcaldies),
      part: (100 * primera.alcaldies) / total,
      peu: `${primera.label}, el ${decimal((100 * primera.alcaldies) / total)} % dels municipis`,
      on: "#alcaldies",
      tema: "participació",
    });
  }

  pastilles.push({
    etq: "Governa qui no va guanyar",
    xifra: number(data.pacte),
    part: (100 * data.pacte) / total,
    peu: `de ${data.municipis.length}; a Catalunya, el ${decimal((100 * cat.pacte) / Math.max(1, cat.municipis))} %`,
    on: "#pactes",
    tema: "seguretat",
  });

  pastilles.push({
    etq: "Matèries que decideix l'AMB",
    xifra: number(COMPETENCIES.length),
    part: null,
    peu: "totes escrites a la Llei 31/2010, i cap no es vota en una papereta",
    on: "#que-fa",
    tema: "mobilitat",
  });

  return renderUllada(pastilles, "L'Àrea Metropolitana en sis xifres");
}

export function renderAmb(data: AmbData, generatedAt: string): string {
  const title = "Àrea Metropolitana de Barcelona — Observatori municipal de quivoto";
  const summary = summarySentence(data);
  const gran = data.municipis[0];

  return `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escape(title)}</title>
<meta name="description" content="Què decideix l'Àrea Metropolitana de Barcelona i què no: el transport, l'aigua, els residus, les platges i l'habitatge dels seus ${data.municipis.length} municipis, amb l'article de la llei al costat, i qui governa cadascun.">
<style>${RADIOGRAFIA_CSS}${MASCOTA_CSS}${AMB_CSS}</style>
</head>
<body>
<a class="salta" href="#contingut">Ves al contingut</a>

${capcalera("../", "cap")}
${cercador("../")}

<main id="contingut">

<section class="portada">
  <div class="presenta">${papereta(120, "pregunta")}<div>
    <p class="micro">Ens metropolità</p>
    <h1>L'Àrea Metropolitana</h1>
  </div></div>
  <p class="entrada">L'autobús, l'aigua de l'aixeta, on van les escombraries, la platja on vas
  a l'estiu: <b>no ho decideix el teu ajuntament</b>. Ho decideix un ens de ${data.municipis.length}
  municipis que no es vota en cap papereta.</p>
  ${summary ? `<p class="resum">${summary}</p>` : ""}
  ${ulladaAmb(data)}
</section>

<nav class="index" aria-label="Seccions d'aquesta pàgina">
  <a href="#que-fa">Què decideix</a>
  <a href="#diners">Què en pagues</a>
  <a href="#consell">Qui hi decideix</a>
  <a href="#alcaldies">Qui mana</a>
  <a href="#pactes">Pactes</a>
  <a href="#canvis">Canvis d'alcaldia</a>
  ${data.indicadors.length > 0 ? '<a href="#indicadors">Com és l\'àrea</a>' : ""}
  <a href="#municipis">Els ${data.municipis.length} municipis</a>
</nav>

<section class="bloc" id="que-fa">
  <h2>Què decideix l'AMB i què no</h2>
  <p class="entrada-bloc">${COMPETENCIES.length} matèries de la Llei 31/2010: què hi posa a mans
  de l'AMB i, a sota, <b>on s'acaba</b>. És la línia que diu a qui has de reclamar.</p>
  ${renderCompetencies()}
  <p class="nota">Això és el que <b>diu la llei</b>, no el que fa l'AMB aquest any:
  <code>www.amb.cat</code> respon 403 a qualsevol client automàtic, fins i tot al
  <code>robots.txt</code>. El detall, a <a href="https://www.amb.cat/" rel="noopener">amb.cat</a>;
  la llei, a <a href="https://portaljuridic.gencat.cat/eli/es-ct/l/2010/08/03/31" rel="noopener">portaljuridic.gencat.cat</a>.</p>
</section>

<section class="bloc" id="diners">
  <h2>Què en pagues, i qui ho decideix</h2>
  <p class="entrada-bloc">Tres maneres en què l'AMB arriba a la butxaca. Cap no es vota.</p>
  ${renderDiners()}
  <p class="nota">Sense imports: la llei diu quins recursos pot fer servir l'AMB, no quant en
  cobra, i els comptes metropolitans no són a cap font oberta.</p>
</section>

<section class="bloc" id="consell">
  <h2>Qui decideix a l'AMB, i com hi arriba</h2>
  <p>El Consell Metropolità aprova el pressupost, les ordenances i <b>les tarifes dels serveis
  metropolitans</b>. El formen els alcaldes dels ${data.municipis.length} municipis, membres nats,
  i regidors que tria el ple de cada ajuntament.</p>
  <p><b>Ningú no el vota en una papereta.</b> El 23-M tries el ple, i és el ple qui tria qui hi va.
  Per això un canvi d'alcaldia a mig mandat també canvia qui seu a l'AMB.</p>
  <p>Quants representants hi té cada municipi ho fixa la llei per trams de població:</p>
  <ul class="escala">
    <li><b>25</b><span>Barcelona</span></li>
    <li><b>4</b><span>municipis de més de cent mil habitants</span></li>
    <li><b>3</b><span>municipis d'entre setanta-cinc mil i cent mil</span></li>
    <li><b>2</b><span>municipis d'entre vint mil i setanta-cinc mil</span></li>
    <li><b>1</b><span>municipis de menys de vint mil</span></li>
  </ul>
  <p class="nota">No diem quants en té cadascun: la llei mana comptar el padró <b>de les
  eleccions</b> i el que tenim és el d'avui. Els llocs que no són d'alcalde se'ls reparteixen les
  llistes del ple en proporció als regidors. Llei 31/2010, articles 4 a 8.</p>
</section>

<section class="bloc" id="alcaldies">
  <h2>Qui mana als ${data.municipis.length}</h2>
  <p class="entrada-bloc">Dalt, les alcaldies. Baix, la gent que hi viu. Compta perquè tots
  aquests alcaldes seuen al Consell Metropolità.</p>
  ${renderPoder(data.forces, data.municipis.length, data.habitants, "de l'àrea")}
  <div class="parell-mapes">
    ${renderMapaTerritori(data.municipis, "../", "L'Àrea Metropolitana")}
    ${renderSituacio(data.situacio)}
  </div>
  <p class="nota">Una alcaldia no és un vot: a la Palma de Cervelló n'hi ha prou amb unes centenes
  de persones i a Barcelona en calen centenars de milers.
  ${(data.forces.find((f) => f.brandId === SENSE_MARCA)?.alcaldies ?? 0) > 0
    ? (() => {
        const n = data.forces.find((f) => f.brandId === SENSE_MARCA)?.alcaldies ?? 0;
        return `De ${n} ${plural(n, "alcaldia no n'hem pogut", "alcaldies no n'hem pogut")} lligar la candidatura amb cap marca coneguda.`;
      })()
    : ""}</p>
</section>

<section class="bloc" id="pactes">
  <h2>On va governar la llista més votada</h2>
  ${renderRepartiment(data)}
  <p>A <b>${data.majoriaAbsoluta}</b> dels ${data.municipis.length}
  ${plural(data.majoriaAbsoluta, "municipi la llista guanyadora governa", "municipis la llista guanyadora governa")}
  amb majoria absoluta, i per tant no va necessitar ningú.</p>
  ${renderPactes(data)}
  <p class="nota">«Pacte» vol dir només això: que l'alcaldia és d'una llista que no va ser la més
  votada. El contingut de l'acord no el sabem: les investidures no són dades obertes.</p>
</section>

<section class="bloc" id="canvis">
  <h2>Qui ha canviat d'alcaldia a mig mandat</h2>
  ${renderCanvis(data)}
</section>

${data.indicadors.length > 0 ? `<section class="bloc" id="indicadors">
  <h2>Què costa viure-hi, i qui ho decideix</h2>
  <p class="entrada-bloc">${data.indicadors.length} indicadors sobre els ${data.municipis.length}
  municipis, amb la mediana dels ${number(data.catalunya.municipis)} al costat i <b>ordenats per
  qui pren la decisió</b>.</p>
  ${renderIndicadors(data)}
</section>` : ""}

<section class="bloc" id="comarques">
  <h2>De quantes comarques surten aquests ${data.municipis.length}</h2>
  <p class="entrada-bloc">L'AMB no encaixa amb cap comarca: n'hi ha de senceres i n'hi ha que hi
  posen només una part dels seus pobles.</p>
  ${renderComarques(data)}
</section>

<section class="bloc" id="municipis">
  <h2>Els ${data.municipis.length} municipis</h2>
  <p class="entrada-bloc">Aquí és on trobes el teu: ordenats per població${gran ? `, i per tant
  comença ${escape(gran.name)}` : ""}, amb les tres xifres comparables al costat.</p>
  ${renderMunicipis(data)}
</section>

<section class="bloc">
  <h2>Què és i què no és l'AMB</h2>
  <p>Un <b>ens local supramunicipal de caràcter territorial</b> creat per la Llei 31/2010, amb
  potestat normativa, tributària i sancionadora. No és una comarca, ni una diputació, ni un
  ajuntament gran. Això tampoc no és la fitxa del seu govern —dels seus comptes no hi ha dades
  obertes—, sinó la <b>suma dels ${data.municipis.length} ajuntaments</b> més el que la llei diu
  que decideix.</p>
  <p class="nota">L'àmbit només es pot modificar per llei del Parlament.</p>
</section>

<nav class="bloc" aria-label="Segueix estirant">
  <h2>Segueix estirant</h2>
  <ul class="detall">
    <li><a href="../els947.html">Els ${number(data.catalunya.municipis)} municipis de Catalunya</a>
      <span class="secundari">Tots, amb cercador i filtres</span></li>
    <li><a href="../mapa/">El mapa</a>
      <span class="secundari">On hi ha majoria absoluta i on no governa qui va guanyar</span></li>
    <li><a href="../comparador/">El comparador</a>
      <span class="secundari">Fins a quatre municipis un al costat de l'altre</span></li>
    ${data.comarques[0] ? `<li><a href="../c/${escape(data.comarques[0].slug)}/">${escape(data.comarques[0].name)}</a>
      <span class="secundari">La comarca que hi posa més municipis metropolitans</span></li>` : ""}
  </ul>
</nav>

<section class="bloc fonts">
  <h2>D'on surt tot això</h2>
  <ul>
    <li>Qui forma l'AMB: «ens on participa cada ens local», Generalitat de Catalunya,
      <code>2r5q-tsxs</code>. En surten els ${data.municipis.length} que anomena un a un
      l'article 2 de la llei.</li>
    <li>Què decideix l'AMB: Llei 31/2010, del 3 d'agost, de l'Àrea Metropolitana de Barcelona,
      articles 2, 4 a 8, 14, 21 a 34, 40 i 42. Text consolidat al Portal Jurídic de Catalunya.</li>
    <li>Padró, comarca i alcaldia de cada municipi: <code>6nei-4b44</code>.</li>
    <li>Vots i regidories del 2023, i les sigles de cada candidatura: <code>ntc4-rnwr</code>.</li>
    <li>Participació i cens del 2023: <code>irrv-2mfc</code>.</li>
    <li>Historial d'alcaldies, d'on surten els canvis a mig mandat: <code>2v2p-vu4h</code>.</li>
    <li>Sexe de les persones elegides: <code>xnfg-weec</code>.</li>
    <li>Liquidació pressupostària i deute viu: Consorci AOC, <code>81f18313</code> i <code>34db8dc5</code>.</li>
    <li>Preu de l'aigua: Observatori del preu de l'aigua, Agència Catalana de l'Aigua.</li>
    <li>Rebut mitjà de l'IBI urbà: <a href="https://www.idescat.cat/pub/?id=ibi&amp;n=173" rel="noopener">Idescat</a>,
      taula 173, a partir de la Direcció General del Cadastre.</li>
    <li>Residus generats i recollida selectiva: Agència de Residus de Catalunya, <code>69zu-w48s</code>.</li>
    <li>Lloguer mitjà: Agència de l'Habitatge de Catalunya, <code>qww9-bvhh</code>.</li>
    <li>Transparència: segell Infoparticipa, Consorci AOC.</li>
  </ul>
  <p class="nota">Les alcaldies per força, els pactes, els canvis i els percentils són càlculs
  nostres sobre aquestes fonts, repetibles amb el codi del projecte. Cap xifra no ve d'una
  estimació, i cap frase sobre què decideix l'AMB no ve d'enlloc més que de la llei.</p>
</section>

</main>
${peu("../", generatedAt)}

</body>
</html>`;
}
