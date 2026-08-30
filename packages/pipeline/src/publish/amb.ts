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

export type AmbMunicipi = ComarcaMunicipi & { comarca: string | null };

/** Una força amb el nombre d'alcaldies metropolitanes que té. */
export type AmbForca = {
  brandId: string;
  label: string;
  color: string;
  alcaldies: number;
  /** Habitants que viuen als municipis que governa. Un poble i una ciutat no pesen igual. */
  habitants: number;
};

export type AmbIndicador = {
  key: string;
  label: string;
  unit: "euros" | "percent";
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

function formatValue(value: number, unit: AmbIndicador["unit"]): string {
  return unit === "euros" ? `${number(Math.round(value))} €` : `${decimal(value)} %`;
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
    que: `El transport públic urbà col·lectiu de superfície i el transport subterrani de viatgers són
      de titularitat metropolitana, i l'AMB aprova el Pla metropolità de mobilitat urbana. També
      ordena el taxi i els vehicles de lloguer amb conductor quan el viatge comença i acaba dins
      dels 36 municipis: la llei els tracta com una sola àrea de gestió del transport.`,
    queNo: `El tramvia no: la llei l'exclou expressament perquè forma part del sistema ferroviari
      de Catalunya, que és de la Generalitat. Els trens i els Ferrocarrils, tampoc.`,
  },
  {
    clau: "aigua",
    tema: "medi ambient",
    titol: "L'aigua de l'aixeta i la depuradora",
    article: "article 14.C",
    que: `El subministrament domiciliari d'aigua potable és un servei de titularitat metropolitana, i
      l'AMB en regula els preus de les tarifes —estructura, bonificacions i tractaments especials—
      abans que els autoritzi la Comissió de Preus de Catalunya. També és seu el sanejament en alta
      i la depuració d'aigües residuals.`,
    queNo: `L'Agència Catalana de l'Aigua manté les seves competències, i el clavegueram del carrer
      continua sent municipal: l'AMB el coordina i planifica l'evacuació d'aigües pluvials i
      residuals, però la xarxa en baixa és de cada ajuntament.`,
  },
  {
    clau: "residus",
    tema: "residus",
    titol: "On van les escombraries",
    article: "article 14.D",
    que: `El tractament, la valorització i la disposició dels residus municipals són metropolitans,
      i també els enderrocs d'obres menors, la tria i selecció d'envasos i el transport del que es
      deixa a la deixalleria.`,
    queNo: `Recollir-les del carrer continua sent de l'ajuntament: l'AMB en coordina els sistemes,
      no els presta. Les instal·lacions de deixalleria també les gestiona cada municipi.`,
  },
  {
    clau: "infraestructures",
    tema: "turisme",
    titol: "Els parcs, les platges i les infraestructures",
    article: "article 14.F",
    que: `La llei encarrega a l'AMB les actuacions de vertebració del territori, i n'anomena
      expressament els parcs, les platges, els espais naturals, els equipaments i els serveis
      tècnics i mediambientals d'interès metropolità.`,
    queNo: `La llei no diu quines platges ni quins parcs són d'interès metropolità: això ho fixa el
      planejament. Aquí no en publiquem la llista perquè no l'hem pogut treure de cap font oberta.`,
  },
  {
    clau: "mediambient",
    tema: "medi ambient",
    titol: "El soroll, l'aire i el canvi climàtic",
    article: "article 14.E",
    que: `L'AMB formula el pla d'actuació metropolità de protecció del medi ambient, la salut i la
      biodiversitat i de lluita contra el canvi climàtic, col·labora en els mapes de capacitat
      acústica i de sorolls i emet els informes ambientals de les llicències ambientals municipals.`,
    queNo: `La llicència ambiental la continua atorgant l'ajuntament: l'AMB hi posa l'informe.`,
  },
  {
    clau: "urbanisme",
    tema: "urbanisme",
    titol: "El planejament urbanístic",
    article: "articles 14.A i 21 a 34",
    que: `L'ordenació urbanística del territori metropolità s'instrumenta amb el Pla director
      urbanístic metropolità i el Pla d'ordenació urbanística metropolità, que classifiquen el sòl
      dels 36 municipis i delimiten les reserves per a infraestructures, equipaments i espais
      lliures.`,
    queNo: `L'aprovació definitiva del Pla d'ordenació urbanística metropolità no és de l'AMB: és de
      la Comissió d'Urbanisme de l'Àrea Metropolitana de Barcelona, que la llei defineix com un
      òrgan del departament competent de la Generalitat, amb deu vocals designats pel departament i
      deu per la presidència de l'AMB.`,
  },
  {
    clau: "habitatge",
    tema: "habitatge",
    titol: "L'habitatge assequible",
    article: "article 22.e",
    que: `El Pla director urbanístic metropolità ha de definir polítiques metropolitanes de sòl i
      habitatge que garanteixin la solidaritat entre municipis en l'execució de polítiques
      d'habitatge assequible i de protecció pública.`,
    queNo: `Els programes d'actuació urbanística municipal —l'expressió de la política de sòl i
      habitatge de cada poble— els continua formulant cada ajuntament, encara que hagin d'ésser
      coherents amb el pla metropolità.`,
  },
  {
    clau: "economia",
    tema: "comerç",
    titol: "L'activitat econòmica i el comerç",
    article: "article 14.G",
    que: `Fomentar l'activitat econòmica i l'ocupació en indústria, comerç, serveis i turisme, i
      promoure un pla estratègic metropolità amb els agents econòmics i socials.`,
    queNo: `És una competència de foment i promoció: no substitueix cap llicència ni cap ordenança
      comercial municipal.`,
  },
  {
    clau: "cohesio",
    tema: "serveis socials",
    titol: "La cohesió social i territorial",
    article: "article 14.H",
    que: `Promoure polítiques públiques comunes en serveis municipals i en cohesió social i
      territorial, i participar en la comissió de seguretat de l'àmbit.`,
    queNo: `Els serveis socials que atenen les persones els continua prestant l'ajuntament, i la
      policia local també és municipal.`,
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
    text: `Entre els recursos amb què es pot finançar l'AMB, la llei hi posa el recàrrec sobre
      l'impost de béns immobles que la legislació d'hisendes locals preveu per a les àrees
      metropolitanes. El tipus de l'IBI el fixa l'ajuntament; el recàrrec, no.`,
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
    text: `Els municipis hi aporten diners del seu pressupost. Les aportacions s'estableixen per
      majoria absoluta del Consell Metropolità i han de ser generals, encara que puguin variar
      segons les característiques de cada municipi.`,
  },
];

// ---------------------------------------------------------------- càlcul

/** Una lectura d'un indicador a un municipi, amb el mínim per poder-la agrupar. */
type Lectura = { municipalityId: number; value: number };

type IndicadorDef = { key: string; label: string; unit: AmbIndicador["unit"]; nota: string };

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
      municipis.push({ ...m, comarca: comarcaPerSlug.get(m.slug) ?? comarca.name });
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
      year: text(data, "darrerAny"),
    })
    .from(municipalityMetrics)
    .where(eq(municipalityMetrics.kind, "residus"));

  const turnoutRows = await db
    .select({
      municipalityId: electionParticipation.municipalityId,
      censusSize: electionParticipation.censusSize,
      voters: electionParticipation.voters,
    })
    .from(electionParticipation)
    .where(eq(electionParticipation.electionId, "M20231"));

  const lecturesFrom = (rows: readonly { municipalityId: number; value: string | null }[]): Lectura[] => {
    const out: Lectura[] = [];
    for (const row of rows) {
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

  const anyResidus = Math.max(0, ...wasteRows.map((r) => toNumber(r.year) ?? 0));
  const peers = buildPeerGroups(all.map((m) => ({ id: m.id, population: m.population })));

  const defs: ReadonlyArray<readonly [IndicadorDef, Lectura[]]> = [
    [{
      key: "deute-habitant", label: "Deute per habitant", unit: "euros",
      nota: "Deute viu a 31 de desembre dividit pel padró, de l'últim exercici tancat que consta a cada ajuntament.",
    }, lecturesFrom(debtRows)],
    [{
      key: "participacio", label: "Participació el 2023", unit: "percent",
      nota: "Vots emesos sobre el cens a les municipals del 28 de maig del 2023.",
    }, participacio],
    [{
      key: "paritat", label: "Dones al ple", unit: "percent",
      nota: "Regidories ocupades per dones al ple sortit del 2023.",
    }, lecturesFrom(parityRows)],
    [{
      key: "selectiva", label: `Recollida selectiva${anyResidus ? ` el ${anyResidus}` : ""}`, unit: "percent",
      nota: "Part dels residus municipals que es recull separadament, segons l'Agència de Residus de Catalunya. El tractament és metropolità; recollir-los, municipal.",
    }, lecturesFrom(wasteRows)],
  ];

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
  <p class="nota">Les fonts desen qui ocupa el càrrec, no per què va marxar l'anterior: d'aquí no
  se'n pot deduir ni una dimissió ni una moció de censura. I un canvi d'alcaldia canvia també qui
  seu al Consell Metropolità, perquè els alcaldes en són membres nats.</p>`;
}

/** Les mitjanes del conjunt, sempre amb la catalana i el percentil al costat. */
function renderIndicadors(data: AmbData): string {
  const cards = data.indicadors
    .map((indicador) => {
      const metropolita = indicador.metropolita === null ? "—" : formatValue(indicador.metropolita, indicador.unit);
      const catalana = indicador.catalana === null ? "" : formatValue(indicador.catalana, indicador.unit);
      return `<li class="indicador">
      <span class="nom">${escape(indicador.label)}</span>
      <span class="gran">${metropolita}</span>
      <span class="secundari">mediana dels municipis metropolitans · ${indicador.ambDada} de ${data.municipis.length}
        ${plural(indicador.ambDada, "municipi amb dada", "municipis amb dada")}</span>
      ${catalana ? `<span class="referencia">Mediana catalana: <b>${catalana}</b>
        <span class="secundari">(${number(indicador.ambDadaCatalunya)} municipis)</span></span>` : ""}
      ${indicador.percentilGrup === null
        ? ""
        : `<span class="percentil">Percentil <b>${Math.round(indicador.percentilGrup)}</b> entre els de la seva mida</span>`}
      <span class="secundari">${escape(indicador.nota)}</span>
    </li>`;
    })
    .join("");
  return `<ul class="indicadors">${cards}</ul>
  <p class="nota">Les dues medianes són sobre municipis, no sobre habitants: cada municipi hi
  compta un cop, tant si en té tres mil com si en té un milió i escaig. El <b>percentil</b> és la
  comparació que val, perquè mesura cada municipi només amb els del seu tram de població de la
  LOREG: 50 és quedar al mig dels ${number(data.catalunya.municipis)}; 80, per sobre de quatre de
  cada cinc de la seva mida.</p>`;
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

/** La llista de municipis: el motiu pel qual algú arriba a aquesta pàgina. */
function renderMunicipis(data: AmbData): string {
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
      <td>${escape(m.mayorName ?? "—")}</td>
      <td class="secundari">${escape(m.mayorSigles ?? "—")} ${marca} ${canvi}</td>
    </tr>`;
    })
    .join("");
  return `<table class="municipis">
  <thead><tr><th>Municipi</th><th>Comarca</th><th>Habitants</th><th>Regidories</th><th>Alcaldia</th><th>Candidatura</th></tr></thead>
  <tbody>${rows}</tbody>
</table>`;
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
  <p class="entrada-bloc">${COMPETENCIES.length} matèries de la Llei 31/2010. A cada targeta, el
  que la llei posa a mans de l'AMB i, a sota, <b>on s'acaba</b>: què continua sent de l'ajuntament
  o de la Generalitat. És la línia que decideix a qui has de reclamar.</p>
  ${renderCompetencies()}
  <p class="nota">Això és el que <b>diu la llei</b>, no el que fa l'AMB aquest any: del que fa avui
  no en publiquem cap xifra perquè <code>www.amb.cat</code> respon 403 a qualsevol client
  automàtic, fins i tot al <code>robots.txt</code>. Qui vulgui el detall el té a
  <a href="https://www.amb.cat/" rel="noopener">amb.cat</a>, i el text sencer de la llei
  a <a href="https://portaljuridic.gencat.cat/eli/es-ct/l/2010/08/03/31" rel="noopener">portaljuridic.gencat.cat</a>.</p>
</section>

<section class="bloc" id="diners">
  <h2>Què en pagues, i qui ho decideix</h2>
  <p class="entrada-bloc">Tres maneres en què l'AMB arriba a la butxaca dels veïns dels
  ${data.municipis.length} municipis. Cap no es vota directament.</p>
  ${renderDiners()}
  <p class="nota">Aquí no hi ha cap import: la llei diu quins recursos pot fer servir l'AMB, no
  quant en cobra. Els comptes metropolitans no són a cap de les fonts obertes que fem servir per
  als ${number(data.catalunya.municipis)} ajuntaments, i copiar-los d'una altra banda seria dir-los
  sense poder-los comprovar.</p>
</section>

<section class="bloc" id="consell">
  <h2>Qui decideix a l'AMB, i com hi arriba</h2>
  <p>El Consell Metropolità aprova el pressupost, les ordenances i <b>les tarifes dels serveis
  metropolitans</b>. El formen els alcaldes dels ${data.municipis.length} municipis, que en són
  membres nats, i regidors que tria el ple de cada ajuntament d'entre els seus.</p>
  <p><b>Ningú no vota el Consell Metropolità en una papereta.</b> El vot del 23-M tria el ple, i és
  el ple qui tria qui hi va, dins dels trenta dies següents a constituir-se. Per això un canvi
  d'alcaldia a mig mandat també canvia qui seu a l'AMB.</p>
  <p>Quants representants hi té cada municipi ho fixa la llei per trams de població:</p>
  <ul class="escala">
    <li><b>25</b><span>Barcelona</span></li>
    <li><b>4</b><span>municipis de més de cent mil habitants</span></li>
    <li><b>3</b><span>municipis d'entre setanta-cinc mil i cent mil</span></li>
    <li><b>2</b><span>municipis d'entre vint mil i setanta-cinc mil</span></li>
    <li><b>1</b><span>municipis de menys de vint mil</span></li>
  </ul>
  <p class="nota">Aquí no diem quants en té cadascun dels ${data.municipis.length}: la llei mana
  comptar el padró <b>de les eleccions</b> de què va sortir el Consell,
  i el padró que tenim nosaltres és el d'avui. Amb el d'avui hi ha municipis que han canviat de tram, i publicar-ho
  seria donar una composició que no és la del Consell que hi ha. Els llocs que no són d'alcalde
  es reparteixen entre les llistes del ple en proporció als regidors que van treure.
  Llei 31/2010, articles 4 a 8.</p>
</section>

<section class="bloc" id="alcaldies">
  <h2>Qui mana als ${data.municipis.length}</h2>
  <p class="entrada-bloc">Dalt, les alcaldies. Baix, la gent que hi viu. Compta perquè tots
  aquests alcaldes seuen al Consell Metropolità.</p>
  ${renderPoder(data.forces, data.municipis.length, data.habitants, "de l'àrea")}
  ${renderMapaTerritori(data.municipis, "../", "L'Àrea Metropolitana")}
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
  <h2>Com és aquesta àrea</h2>
  <p class="entrada-bloc">Els mateixos indicadors que a les pàgines de comarca, calculats sobre els
  ${data.municipis.length} municipis metropolitans i amb la mediana dels
  ${number(data.catalunya.municipis)} al costat.</p>
  ${renderIndicadors(data)}
</section>` : ""}

<section class="bloc" id="comarques">
  <h2>De quantes comarques surten aquests ${data.municipis.length}</h2>
  <p class="entrada-bloc">L'AMB no encaixa amb cap comarca: n'hi ha que hi són senceres i n'hi ha
  que hi posen només una part dels seus pobles.</p>
  ${renderComarques(data)}
</section>

<section class="bloc" id="municipis">
  <h2>Els ${data.municipis.length} municipis</h2>
  <p class="entrada-bloc">Ordenats per població${gran ? `, i per tant comença ${escape(gran.name)}` : ""}.
  Cada nom porta a la seva fitxa sencera.</p>
  ${renderMunicipis(data)}
</section>

<section class="bloc">
  <h2>Què és i què no és l'AMB</h2>
  <p>És un <b>ens local supramunicipal de caràcter territorial</b> creat per la Llei 31/2010, amb
  personalitat jurídica pròpia i potestat normativa, tributària i sancionadora. No és una comarca,
  no és una diputació i no és un ajuntament gran: és una administració amb competències pròpies que
  ningú no vota directament.</p>
  <p>Això no és la fitxa del seu govern —dels seus comptes i de les seves votacions no en tenim
  dades obertes—, sinó la <b>suma dels ${data.municipis.length} ajuntaments</b> que la formen, més
  el que la llei diu que decideix.</p>
  <p class="nota">L'àmbit territorial només es pot modificar per llei del Parlament.</p>
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
      <code>2r5q-tsxs</code>. En surten ${data.municipis.length} municipis, exactament els mateixos
      que anomena un a un l'article 2 de la llei.</li>
    <li>Què decideix l'AMB: Llei 31/2010, del 3 d'agost, de l'Àrea Metropolitana de Barcelona,
      articles 2, 4 a 8, 14, 21 a 34, 40 i 42. Text consolidat al Portal Jurídic de Catalunya.</li>
    <li>Padró, comarca i alcaldia de cada municipi: <code>6nei-4b44</code>.</li>
    <li>Vots i regidories del 2023, i les sigles de cada candidatura: <code>ntc4-rnwr</code>.</li>
    <li>Participació i cens del 2023: <code>irrv-2mfc</code>.</li>
    <li>Historial d'alcaldies, d'on surten els canvis a mig mandat: <code>2v2p-vu4h</code>.</li>
    <li>Sexe de les persones elegides: <code>xnfg-weec</code>.</li>
    <li>Liquidació pressupostària i deute viu: Consorci AOC, <code>81f18313</code> i <code>34db8dc5</code>.</li>
  </ul>
  <p class="nota">Les alcaldies per força, els pactes, els canvis a mig mandat i els percentils són
  càlculs nostres sobre aquestes fonts, repetibles amb el codi del projecte. Cap xifra d'aquesta
  pàgina no ve d'una estimació, i cap frase sobre què decideix l'AMB no ve d'enlloc més que del
  text de la llei.</p>
</section>

</main>
${peu("../", generatedAt)}

</body>
</html>`;
}
