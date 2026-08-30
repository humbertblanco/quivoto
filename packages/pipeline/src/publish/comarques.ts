import { eq, sql, type SQLWrapper } from "drizzle-orm";
import {
  candidatures, electionParticipation, municipalities, municipalityMetrics, type Db,
} from "@quivoto/db";
import { BRANDS_BY_ID } from "@quivoto/shared-schemas/brands";
import { buildPeerGroups, medianOf, percentileOf, type PeerGroup } from "../derive/peers";
import { slugify } from "../lib/text";
import { carregaCarrecsAlcaldia, carregaPleDelRegistre, resolAlcaldia } from "./alcaldia";
import { sobreColor } from "./contrast";
import { RADIOGRAFIA_CSS } from "./estil";
import { icona } from "./icones";
import { capsaCami, geometria, projecta } from "./mapa";
import { sigla } from "./sigla";
import { GLOSSARI_CSS, esClauGlossari, renderGlossari } from "./glossari";
import { TERRITORI_CSS, renderBlocsPoder } from "./territori";
import { capcalera, tipografia } from "./capcalera";
import { cercador } from "./cercador";
import { peu } from "./peu";

/**
 * Les 43 comarques: qui mana a la meva comarca.
 *
 * És una pregunta que la gent es fa —«al meu voltant, què hi ha?»— i que avui no
 * respon ningú: la Generalitat publica l'alcaldia de cada municipi, però enlloc
 * no diu quantes n'hi ha de cada força ni on hi va haver pacte. Amb les dades
 * que ja tenim carregades és un recompte, no una estimació.
 *
 * La comarca no és una institució que es voti el 23-M —els consells comarcals
 * els trien els regidors, no els electors— i la pàgina ho ha de dir. Serveix
 * com a mapa per arribar a la fitxa del teu poble i per veure si el que hi passa
 * és excepcional o és el que passa a tot arreu.
 *
 * **La pàgina és la fitxa municipal un pis amunt, i s'hi assembla a propòsit.**
 * Fins ara no ho era: obria amb quatre xifres soles —23 municipis, 9.376
 * habitants— que no deien res perquè no tenien res al costat, i el repartiment
 * del poder s'havia de deduir llegint una llista. Ara obre amb la mateixa
 * `.ullada` que el poble, cada xifra amb la de Catalunya al peu; el poder es
 * veu en dues cintes —una d'alcaldies i una d'habitants, que és on es descobreix
 * que qui mana en més pobles no sempre mana sobre més gent— i hi ha el mapa de
 * la comarca amb un punt per municipi que porta a la seva fitxa.
 */

// ------------------------------------------------------------------- formes

/**
 * Canvi d'alcaldia dins del mandat actual, tal com el desa `derive/mayor-changes`.
 * És l'únic tros del document `mayors` que necessitem: la resta és l'historial
 * des del 1979, que ocupa un megabyte i aquí no fa cap falta.
 */
type CanviAlcaldia = {
  term: string;
  mayors: { name: string; tookOfficeOn: string | null }[];
  onlySuccessorKnown?: boolean;
  daysIntoTerm?: number;
};

export type ComarcaMunicipi = {
  slug: string;
  name: string;
  population: number | null;
  /** On cau al mapa. Sense les dues, el municipi no es pot pintar i s'omet del dibuix. */
  lat: number | null;
  lon: number | null;
  seats: number;
  mayorName: string | null;
  mayorSigles: string | null;
  /** Marca de l'alcaldia, resolta per les sigles de la seva candidatura del 2023. */
  mayorBrandId: string | null;
  /**
   * El retrat de l'alcaldia que publica el mateix ajuntament a la seva seu
   * electrònica, a 160 px.
   *
   * Aquests tres camps són opcionals a propòsit: la pàgina de l'AMB comparteix
   * aquest tipus i no els omple, i fer-los obligatoris obligaria a tocar
   * fitxers que no són d'aquest encàrrec. Qui no els ompli no en publica res.
   */
  mayorFoto?: string | null;
  /**
   * El camí de la fitxa de l'alcaldia, relatiu a `m/<slug>/`: «regidor/<persona>/».
   * El decideix `resolAlcaldia()`, igual que el retrat; `null` quan no en té,
   * i llavors el nom porta a `#alcaldies` del municipi.
   */
  mayorAdreca?: string | null;
  /** Renda neta per persona. `null` quan l'INE la tapa per secret estadístic. */
  renda?: number | null;
  /** El que cobra l'alcaldia en un any, i només quan és un sou amb dedicació. */
  souAlcaldia?: number | null;
  winnerSigles: string | null;
  /** `null` quan no hem pogut lligar l'alcaldia amb cap llista. */
  winnerGoverns: boolean | null;
  /** La llista **més votada** va treure la majoria absoluta, hi governi o no. */
  hasMajority: boolean;
  mayorChanged: boolean;
  mayorChangeName: string | null;
  mayorChangeDate: string | null;
};

/** Una força amb el nombre d'alcaldies que té a la comarca. */
export type ComarcaForca = {
  brandId: string;
  label: string;
  color: string;
  alcaldies: number;
  /** Habitants que viuen als municipis que governa. Un poble i una ciutat no pesen igual. */
  habitants: number;
};

export type ComarcaIndicador = {
  key: string;
  label: string;
  unit: "euros" | "percent";
  /** Mediana dels municipis de la comarca amb dada. */
  comarcal: number | null;
  /** Mediana dels 947, per tenir la referència al costat. */
  catalana: number | null;
  ambDada: number;
  ambDadaCatalunya: number;
  /**
   * Mediana dels percentils que treuen els municipis de la comarca **dins del
   * seu tram de població**. És l'única de les tres xifres que no queda tocada
   * per la mida dels pobles de la comarca.
   */
  percentilGrup: number | null;
  nota: string;
};

export type ComarcaData = {
  slug: string;
  name: string;
  municipis: ComarcaMunicipi[];
  habitants: number;
  regidories: number;
  /** Mediana de població dels municipis: diu de quina mida és la comarca de veritat. */
  poblacioMediana: number | null;
  forces: ComarcaForca[];
  governaMesVotat: number;
  pacte: number;
  senseIdentificar: number;
  /** Municipis on la llista més votada governa i, a més, té la majoria absoluta. */
  majoriaAbsoluta: number;
  canvisAlcaldia: number;
  indicadors: ComarcaIndicador[];
  /**
   * Els mateixos comptes, però de tot Catalunya.
   *
   * Sense això la portada donava xifres òrfenes: «2 municipis on governa qui no
   * va guanyar» no es pot llegir si no se sap que a Catalunya n'hi ha 214 de
   * 947. Una xifra sola no diu si el que passa aquí és excepcional o és el que
   * passa a tot arreu, que és exactament el que la pàgina promet respondre.
   */
  catalunya: {
    municipis: number;
    habitants: number;
    regidories: number;
    pacte: number;
    majoriaAbsoluta: number;
    canvisAlcaldia: number;
  };
  /** Les altres 42, per poder-hi saltar sense passar per l'índex. */
  altres: { slug: string; name: string; municipis: number }[];
};

// -------------------------------------------------------------- presentació

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const number = (n: number): string => n.toLocaleString("ca-ES");
const decimal = (n: number, digits = 1): string => n.toFixed(digits).replace(".", ",");

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/**
 * Noms curts de les forces. Els de `PARTY_BRANDS` són els oficials sencers
 * («Esquerra Republicana de Catalunya») i en un gràfic de barres no hi caben.
 */
const NOMS_CURTS: Record<string, string> = {
  psc: "PSC", junts: "Junts", erc: "ERC", cup: "CUP", comuns: "Comuns",
  pp: "PP", cs: "Ciutadans", vox: "Vox", pdecat: "PDeCAT", ciu: "CiU",
  aliancacat: "Aliança Catalana", local: "Llistes locals",
  cda: "Convergència Democràtica Aranesa",
};

/**
 * Colors de dades. Són els de `PARTY_BRANDS` excepte el groc pur de la CUP, que
 * damunt del paper cru no es veu: el fosquim just perquè es distingeixi.
 */
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
 * Cap color que no sigui un hexadecimal de sis xifres no entra a un atribut
 * `style`: un valor amb un punt i coma hi colaria una segona declaració. És la
 * mateixa comprovació que fa la pàgina de partit.
 */
const colorSegur = (color: string): string => (/^#[0-9a-f]{6}$/i.test(color) ? color : "#8b8b8b");

/** El color de la força que té l'alcaldia d'un municipi, sempre pintable. */
const colorAlcaldia = (brandId: string | null | undefined): string =>
  colorSegur(colorOf(brandId ?? SENSE_MARCA));

/**
 * La cara de qui mana, i mai un forat.
 *
 * Quan l'ajuntament publica el retrat, el retrat; quan no, la inicial amb el
 * color del seu grup i la mateixa mida i la mateixa vora. És la regla que ja
 * fa el ple de la fitxa municipal: qui no té fotografia no és un regidor de
 * segona, és que el seu ajuntament no l'ha publicada.
 */
function caraAlcaldia(
  foto: string | null | undefined,
  nom: string | null,
  brandId: string | null | undefined,
): string {
  if (foto) {
    return `<img class="retrat" src="${escape(foto)}" alt="" loading="lazy" width="34" height="34">`;
  }
  // Sense nom d'alcaldia la inicial és la del municipi: val més una lletra que
  // un rodó buit, i el nom que hi ha sota la cara ja diu que no en sabem el nom.
  const lletres = (nom ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  const tint = sobreColor(colorAlcaldia(brandId));
  return `<span class="retrat inicials" style="--c:${tint.fons};--t:${tint.tinta}"
    aria-hidden="true">${escape(lletres || "?")}</span>`;
}

function formatValue(value: number, unit: ComarcaIndicador["unit"]): string {
  return unit === "euros" ? `${number(Math.round(value))} €` : `${decimal(value)} %`;
}

// ---------------------------------------------------------------- càlcul

/** Una lectura d'un indicador a un municipi, amb el mínim per poder-la agrupar. */
type Lectura = { municipalityId: number; comarca: string; value: number };

type IndicadorDef = {
  key: string;
  label: string;
  unit: ComarcaIndicador["unit"];
  nota: string;
};

/**
 * Els tres números d'un indicador comarcal. La mediana comarcal i la catalana
 * són directes; la tercera és la que fa que la comparació sigui honesta.
 *
 * Comparar la mediana del Priorat (23 pobles, cap de 2.000 habitants) amb la
 * mediana catalana no diu res de com governa el Priorat: diu que el Priorat és
 * petit. Per això cada municipi es percentila **dins del seu tram de la LOREG**
 * i el que es publica és la mediana d'aquells percentils: un 78 vol dir que el
 * municipi típic d'aquesta comarca queda per sobre de tres quartes parts dels
 * municipis catalans que fan la seva mida.
 */
function buildIndicador(
  def: IndicadorDef,
  lectures: readonly Lectura[],
  peers: ReadonlyMap<number, PeerGroup>,
): Map<string, ComarcaIndicador> {
  const catalana = medianOf(lectures.map((l) => l.value));

  const perGrup = new Map<string, number[]>();
  for (const lectura of lectures) {
    const key = peers.get(lectura.municipalityId)?.key;
    if (!key) continue;
    const list = perGrup.get(key);
    if (list) list.push(lectura.value);
    else perGrup.set(key, [lectura.value]);
  }

  const perComarca = new Map<string, { values: number[]; percentils: number[] }>();
  for (const lectura of lectures) {
    let bucket = perComarca.get(lectura.comarca);
    if (!bucket) perComarca.set(lectura.comarca, (bucket = { values: [], percentils: [] }));
    bucket.values.push(lectura.value);
    const key = peers.get(lectura.municipalityId)?.key;
    const grup = key ? perGrup.get(key) : undefined;
    const percentil = grup ? percentileOf(lectura.value, grup) : null;
    if (percentil !== null) bucket.percentils.push(percentil);
  }

  const result = new Map<string, ComarcaIndicador>();
  for (const [comarca, bucket] of perComarca) {
    result.set(comarca, {
      key: def.key,
      label: def.label,
      unit: def.unit,
      comarcal: medianOf(bucket.values),
      catalana,
      ambDada: bucket.values.length,
      ambDadaCatalunya: lectures.length,
      // Amb dos o tres municipis la mediana dels percentils és soroll i val més
      // no dir-la que dir-la amb un asterisc que ningú no llegirà.
      percentilGrup: bucket.percentils.length >= 4 ? medianOf(bucket.percentils) : null,
      nota: def.nota,
    });
  }
  return result;
}

// ------------------------------------------------------------------ accés

/**
 * Els documents de `municipality_metrics` sumen tretze megabytes i llegir-los
 * sencers rebenta el WebAssembly de PGlite («memory access out of bounds»).
 * Aquí no en fa falta ni un de sencer: es projecta amb `->>` el camp concret de
 * cada indicador i tot torna com a text, que és el que fan igual els dos motors
 * —PGlite i el Postgres de producció— sense discutir sobre tipus.
 */
const text = (column: SQLWrapper, path: string) =>
  // El nom del camp va incrustat i no lligat: `->>` està sobrecarregat (text i
  // enter) i amb un paràmetre sense tipus Postgres no sap quina versió vol.
  sql<string | null>`${column}->>${sql.raw(`'${path.replace(/'/g, "''")}'`)}`;

const toNumber = (value: string | null): number | null => {
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export async function loadComarques(db: Db): Promise<ComarcaData[]> {
  const all = await db
    .select({
      id: municipalities.id,
      slug: municipalities.slug,
      name: municipalities.name,
      comarca: municipalities.comarca,
      population: municipalities.population,
      lat: municipalities.lat,
      lon: municipalities.lon,
      councilSeats: municipalities.councilSeats,
      mayorName: municipalities.mayorName,
    })
    .from(municipalities);

  const data = municipalityMetrics.data;

  const governRows = await db
    .select({
      municipalityId: municipalityMetrics.municipalityId,
      mayorName: text(data, "mayorName"),
      mayorSigles: text(data, "mayorSigles"),
      winnerSigles: text(data, "winnerSigles"),
      winnerGoverns: text(data, "winnerGoverns"),
      winnerHasMajority: text(data, "winnerHasMajority"),
      totalSeats: text(data, "totalSeats"),
    })
    .from(municipalityMetrics)
    .where(eq(municipalityMetrics.kind, "government"));

  const changeRows = await db
    .select({
      municipalityId: municipalityMetrics.municipalityId,
      change: sql<CanviAlcaldia | null>`${data}->'currentTermChange'`,
    })
    .from(municipalityMetrics)
    .where(eq(municipalityMetrics.kind, "mayors"));

  const parityRows = await db
    .select({ municipalityId: municipalityMetrics.municipalityId, value: text(data, "womenElectedPct") })
    .from(municipalityMetrics)
    .where(eq(municipalityMetrics.kind, "parity"));

  // El semàfor financer desa els vuit indicadors dins d'un array; d'aquí només
  // en surt el deute per habitant i es queda tota la resta al seu lloc.
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

  /*
   * El retrat i la fitxa de qui té l'alcaldia.
   *
   * Aquí hi havia una subconsulta que treia el retrat de qui portés «alcald»
   * al càrrec, i prou. És la meitat de la regla que fa la fitxa del municipi,
   * i la meitat que falla on més es nota: l'Hospitalet de Llobregat després
   * del relleu, Lleida amb el seu «Paer en cap». `resolAlcaldia()` fa la regla
   * sencera, i les dues lectures que necessita —la llista de la seu retallada
   * al nom, el càrrec i el retrat petit, i el ple del registre per als
   * municipis sense seu— són les mateixes que fa la llista dels 947. El
   * document de càrrecs continua sense arribar sencer a JavaScript.
   */
  const carrecsSeu = await carregaCarrecsAlcaldia(db);
  const pleRegistre = await carregaPleDelRegistre(db);

  // La renda neta per persona, de l'Atles de distribució de renda de les llars
  // de l'INE (J23). El document en porta sis, d'indicadors, i d'aquí només en
  // surt el que la gent entén: quants diners nets entren a cada casa per cap.
  const rendaRows = await db
    .select({
      municipalityId: municipalityMetrics.municipalityId,
      value: sql<string | null>`(jsonb_path_query_first(${data}, '$.indicadors[*] ? (@.clau == "rendaNetaPersona")'))->>'valor'`,
      year: text(data, "any"),
    })
    .from(municipalityMetrics)
    .where(eq(municipalityMetrics.kind, "riquesa"));

  // El que cobra l'alcaldia, de l'inventari ISPA del Ministeri (J22). «mena»
  // separa el sou de les assistències, i aquí només hi entra el sou: dir que
  // una alcaldia sense dedicació «cobra» 180 € l'any per anar a dos plens
  // barrejaria dues coses que la font distingeix expressament.
  const souRows = await db
    .select({
      municipalityId: municipalityMetrics.municipalityId,
      value: sql<string | null>`${data}->'ministeri'->'alcaldia'->>'euros'`,
      mena: sql<string | null>`${data}->'ministeri'->'alcaldia'->>'mena'`,
      year: sql<string | null>`${data}->'ministeri'->>'any'`,
    })
    .from(municipalityMetrics)
    .where(eq(municipalityMetrics.kind, "retribucions"));

  // La marca de l'alcaldia no la publica cap font. Es dedueix de les sigles de
  // la seva candidatura del 2023, que sí que porten marca resolta: hi lliga per
  // a 924 dels 947, i les 23 que falten són alcaldies sense sigles a l'origen.
  const candidatureRows = await db
    .select({
      municipalityId: candidatures.municipalityId,
      sigles: candidatures.sigles,
      brandId: candidatures.brandId,
    })
    .from(candidatures)
    .where(eq(candidatures.electionId, "M20231"));

  const turnoutRows = await db
    .select({
      municipalityId: electionParticipation.municipalityId,
      censusSize: electionParticipation.censusSize,
      voters: electionParticipation.voters,
    })
    .from(electionParticipation)
    .where(eq(electionParticipation.electionId, "M20231"));

  const govern = new Map(governRows.map((r) => [r.municipalityId, r]));
  const canvis = new Map(changeRows.map((r) => [r.municipalityId, r.change]));
  const brandBySigles = new Map(candidatureRows.map((r) => [`${r.municipalityId}\u0000${r.sigles}`, r.brandId]));

  const rendaPer = new Map<number, number>();
  for (const row of rendaRows) {
    const valor = toNumber(row.value);
    if (valor !== null) rendaPer.set(row.municipalityId, valor);
  }

  const souPer = new Map<number, number>();
  for (const row of souRows) {
    const valor = toNumber(row.value);
    // Sense «sou» no hi entra: la resta d'imports d'aquell full són
    // assistències i indemnitzacions per sessió, que no són un sou.
    if (valor !== null && row.mena === "sou") souPer.set(row.municipalityId, valor);
  }

  const turnout = new Map<number, number>();
  for (const row of turnoutRows) {
    if (!row.censusSize || !row.voters) continue;
    turnout.set(row.municipalityId, (100 * row.voters) / row.censusSize);
  }

  // Els grups de comparació es fan sobre els 947, no sobre la comarca: el tram
  // de població és el que ha de manar, i dins d'una comarca sola no hi hauria
  // prou municipis de cada mida per calcular-hi res.
  const peers = buildPeerGroups(all.map((m) => ({ id: m.id, population: m.population })));
  const comarcaOf = new Map(all.map((m) => [m.id, m.comarca]));

  /** Passa una taula de valors en text a lectures, saltant-se els forats. */
  const lecturesFrom = (rows: readonly { municipalityId: number; value: string | null }[]): Lectura[] => {
    const out: Lectura[] = [];
    for (const row of rows) {
      const comarca = comarcaOf.get(row.municipalityId);
      const value = toNumber(row.value);
      if (!comarca || value === null) continue;
      out.push({ municipalityId: row.municipalityId, comarca, value });
    }
    return out;
  };

  /** El mateix, per als indicadors que ja arriben com a mapa de números. */
  const lecturesDe = (valors: ReadonlyMap<number, number>): Lectura[] => {
    const out: Lectura[] = [];
    for (const [municipalityId, value] of valors) {
      const comarca = comarcaOf.get(municipalityId);
      if (comarca) out.push({ municipalityId, comarca, value });
    }
    return out;
  };

  const deute = lecturesFrom(debtRows);
  const paritat = lecturesFrom(parityRows);
  const selectiva = lecturesFrom(wasteRows);
  const participacio = lecturesDe(turnout);
  const renda = lecturesDe(rendaPer);
  const sou = lecturesDe(souPer);

  const anyResidus = Math.max(0, ...wasteRows.map((r) => toNumber(r.year) ?? 0));
  const anyRenda = Math.max(0, ...rendaRows.map((r) => toNumber(r.year) ?? 0));
  const anySou = Math.max(0, ...souRows.map((r) => toNumber(r.year) ?? 0));

  const perComarca = new Map<string, ComarcaMunicipi[]>();
  const habitants = new Map<string, number>();
  const regidories = new Map<string, number>();
  const forces = new Map<string, Map<string, ComarcaForca>>();

  for (const m of all) {
    const comarca = m.comarca;
    if (!comarca) continue;
    const government = govern.get(m.id);
    const mayorSigles = government?.mayorSigles ?? null;
    const brandId = mayorSigles ? brandBySigles.get(`${m.id}\u0000${mayorSigles}`) ?? null : null;

    const change = canvis.get(m.id) ?? null;
    const successor = change?.mayors[change.mayors.length - 1] ?? null;
    const seats = toNumber(government?.totalSeats ?? null) ?? m.councilSeats ?? 0;
    const alcaldia = resolAlcaldia(
      carrecsSeu.get(m.id) ?? null,
      { mayorName: government?.mayorName ?? m.mayorName, mayorSigles },
      pleRegistre.get(m.id) ?? null,
    );

    const municipi: ComarcaMunicipi = {
      slug: m.slug,
      name: m.name,
      population: m.population,
      // `numeric` torna text als dos motors, i «41,7» no és un número: si no es
      // converteix aquí, el mapa projecta NaN i tots els punts cauen al zero.
      lat: toNumber(m.lat),
      lon: toNumber(m.lon),
      seats,
      mayorName: government?.mayorName ?? m.mayorName,
      mayorSigles,
      mayorBrandId: brandId,
      mayorFoto: alcaldia.fotoPetita,
      mayorAdreca: alcaldia.adreca,
      renda: rendaPer.get(m.id) ?? null,
      souAlcaldia: souPer.get(m.id) ?? null,
      winnerSigles: government?.winnerSigles ?? null,
      winnerGoverns: government?.winnerGoverns == null ? null : government.winnerGoverns === "true",
      hasMajority: government?.winnerHasMajority === "true",
      mayorChanged: change !== null,
      mayorChangeName: successor?.name ?? null,
      mayorChangeDate: successor?.tookOfficeOn ?? null,
    };

    const list = perComarca.get(comarca);
    if (list) list.push(municipi);
    else perComarca.set(comarca, [municipi]);
    habitants.set(comarca, (habitants.get(comarca) ?? 0) + (m.population ?? 0));
    regidories.set(comarca, (regidories.get(comarca) ?? 0) + seats);

    let forcesComarca = forces.get(comarca);
    if (!forcesComarca) forces.set(comarca, (forcesComarca = new Map()));
    const forcaId = brandId ?? SENSE_MARCA;
    const forca = forcesComarca.get(forcaId);
    if (forca) {
      forca.alcaldies += 1;
      forca.habitants += m.population ?? 0;
    } else {
      forcesComarca.set(forcaId, {
        brandId: forcaId,
        label: labelOf(forcaId),
        color: colorOf(forcaId),
        alcaldies: 1,
        habitants: m.population ?? 0,
      });
    }
  }

  const defs: ReadonlyArray<readonly [IndicadorDef, Lectura[]]> = [
    [{
      key: "deute-habitant", label: "Deute per habitant", unit: "euros",
      nota: "Deute viu a 31 de desembre dividit pel padró, de l'últim exercici tancat que consta a cada ajuntament.",
    }, deute],
    [{
      key: "sou-alcaldia",
      label: `Sou de l'alcaldia${anySou ? ` el ${anySou}` : ""}`,
      unit: "euros",
      nota:
        "Retribució anual de l'alcaldia amb dedicació exclusiva o parcial, de l'inventari ISPA del " +
        "Ministeri per a la Transformació Digital i de la Funció Pública. Les alcaldies sense dedicació " +
        "no hi compten: cobren per assistència a les sessions i això no és un sou.",
    }, sou],
    [{
      key: "renda",
      label: `Renda neta per persona${anyRenda ? ` el ${anyRenda}` : ""}`,
      unit: "euros",
      nota:
        "Renda neta mitjana per habitant, de l'Atles de distribució de renda de les llars de l'INE. " +
        "No la decideix l'ajuntament: diu qui hi viu i de què, no com governa.",
    }, renda],
    [{
      key: "participacio", label: "Participació el 2023", unit: "percent",
      nota: "Vots emesos sobre el cens a les municipals del 28 de maig del 2023.",
    }, participacio],
    [{
      key: "dones-ple", label: "Dones al ple", unit: "percent",
      nota: "Regidories ocupades per dones al ple sortit del 2023.",
    }, paritat],
    [{
      key: "selectiva", label: `Recollida selectiva${anyResidus ? ` el ${anyResidus}` : ""}`, unit: "percent",
      nota: "Part dels residus municipals que es recull separadament, segons l'Agència de Residus de Catalunya.",
    }, selectiva],
  ];

  const indicadors = defs
    .filter(([, lectures]) => lectures.length > 0)
    .map(([def, lectures]) => buildIndicador(def, lectures, peers));

  const noms = [...perComarca.keys()].sort((a, b) => a.localeCompare(b, "ca"));
  const altres = noms.map((name) => ({
    slug: slugify(name),
    name,
    municipis: perComarca.get(name)!.length,
  }));

  // El país sencer, comptat exactament amb la mateixa regla que cada comarca:
  // si el total es calculés d'una altra manera, la comparació de la portada
  // —«aquí el 9 %, a Catalunya el 22 %»— compararia dues coses diferents.
  const tots = [...perComarca.values()].flat();
  const catalunya = {
    municipis: tots.length,
    habitants: tots.reduce((a, m) => a + (m.population ?? 0), 0),
    regidories: tots.reduce((a, m) => a + m.seats, 0),
    pacte: tots.filter((m) => m.winnerGoverns === false).length,
    majoriaAbsoluta: tots.filter((m) => m.winnerGoverns === true && m.hasMajority).length,
    canvisAlcaldia: tots.filter((m) => m.mayorChanged).length,
  };

  return noms.map((name): ComarcaData => {
    const municipis = [...perComarca.get(name)!].sort(
      (a, b) => (b.population ?? 0) - (a.population ?? 0) || a.name.localeCompare(b.name, "ca"),
    );
    const forcesComarca = [...(forces.get(name)?.values() ?? [])].sort(
      (a, b) => b.alcaldies - a.alcaldies || b.habitants - a.habitants || a.label.localeCompare(b.label, "ca"),
    );
    return {
      slug: slugify(name),
      name,
      municipis,
      habitants: habitants.get(name) ?? 0,
      regidories: regidories.get(name) ?? 0,
      poblacioMediana: medianOf(municipis.map((m) => m.population ?? 0)),
      forces: forcesComarca,
      governaMesVotat: municipis.filter((m) => m.winnerGoverns === true).length,
      pacte: municipis.filter((m) => m.winnerGoverns === false).length,
      senseIdentificar: municipis.filter((m) => m.winnerGoverns === null).length,
      majoriaAbsoluta: municipis.filter((m) => m.winnerGoverns === true && m.hasMajority).length,
      canvisAlcaldia: municipis.filter((m) => m.mayorChanged).length,
      indicadors: indicadors.map((byComarca) => byComarca.get(name)).filter(Boolean) as ComarcaIndicador[],
      catalunya,
      altres,
    };
  });
}

// --------------------------------------------------------------- fragments

/** El mínim per pintar el repartiment del poder. L'AMB hi passa les seves forces. */
export type ForcaPoder = { label: string; color: string; alcaldies: number; habitants: number };

/**
 * El repartiment del poder, en dues cintes.
 *
 * Abans era una llista de barres d'alcaldies amb els habitants escrits al
 * costat en lletra petita, i les dues coses no es podien comparar perquè una
 * era un dibuix i l'altra un número. Aquí van l'una damunt de l'altra i amb els
 * mateixos colors en el mateix ordre: on un tram s'eixampla de la primera cinta
 * a la segona, aquella força mana en pobles grans; on s'estreny, mana en molts
 * pobles petits. Al Baix Llobregat el PSC té 15 alcaldies de 30 —la meitat de
 * la cinta de dalt— i el 71 % de la població: és la diferència que cap llista
 * de xifres no ensenyava.
 *
 * Les xifres van totes escrites a la clau de sota. La cinta és l'ajuda per
 * comparar-les d'un cop d'ull, mai l'única manera de llegir-les.
 */
export function renderPoder(
  forces: readonly ForcaPoder[],
  municipis: number,
  habitants: number,
  ambit: string,
): string {
  if (forces.length === 0) return "";
  const totalM = Math.max(1, municipis);
  const totalH = Math.max(1, habitants);

  const cinta = (valor: (f: ForcaPoder) => number, total: number): string =>
    forces
      .map(
        (f) =>
          `<i style="--w:${((100 * valor(f)) / total).toFixed(2)}%;--c:${f.color}"
        title="${escape(f.label)}"></i>`,
      )
      .join("");

  const descriu = (valor: (f: ForcaPoder) => number, total: number, unitat: string): string =>
    forces.map((f) => `${f.label}, ${decimal((100 * valor(f)) / total)} % ${unitat}`).join("; ");

  const clau = forces
    .map((f) => {
      const partM = (100 * f.alcaldies) / totalM;
      const partH = (100 * f.habitants) / totalH;
      return `<li>
      <span class="nom"><span class="mostra" style="--c:${f.color}"></span>${escape(f.label)}</span>
      <span class="dada"><b>${f.alcaldies}</b> ${plural(f.alcaldies, "alcaldia", "alcaldies")}
        de ${municipis} · ${decimal(partM)} %</span>
      <span class="dada"><b>${number(f.habitants)}</b> habitants · ${decimal(partH)} % ${escape(ambit)}</span>
    </li>`;
    })
    .join("");

  return `<figure class="poder">
  <div class="tira-fila">
    <span class="etq-tira">Alcaldies</span>
    <div class="tira" role="img" aria-label="Alcaldies: ${escape(descriu((f) => f.alcaldies, totalM, "de les alcaldies"))}.">${cinta((f) => f.alcaldies, totalM)}</div>
  </div>
  <div class="tira-fila">
    <span class="etq-tira">Població que governen</span>
    <div class="tira" role="img" aria-label="Població governada: ${escape(descriu((f) => f.habitants, totalH, "dels habitants"))}.">${cinta((f) => f.habitants, totalH)}</div>
  </div>
  <ul class="poder-clau">${clau}</ul>
</figure>`;
}

/** El mínim per pintar un municipi al mapa. L'AMB hi passa els seus 36. */
export type PuntTerritori = {
  slug: string;
  name: string;
  lat: number | null;
  lon: number | null;
  population: number | null;
  mayorBrandId: string | null;
  mayorSigles: string | null;
};

/**
 * El territori, amb un punt per municipi i cada punt pintat de qui hi mana.
 *
 * És el que convertia la pàgina en un cul-de-sac: la llista de municipis és
 * alfabètica per població i no diu on és res. Aquí es veu si una força mana en
 * una banda de la comarca o escampada, i cada punt és un enllaç a la fitxa del
 * poble —no un dibuix mut al costat d'una taula d'enllaços.
 *
 * Els colors són els mateixos de les cintes de sobre, i per això aquí no hi ha
 * clau: repetir-la dos cops a la mateixa pantalla és fer llegir dues vegades el
 * mateix. Sense coordenades no es pot pintar: amb menys de tres municipis
 * situats no hi ha forma que es reconegui i val més no dibuixar res.
 */
export function renderMapaTerritori(
  municipis: readonly PuntTerritori[],
  base: string,
  /**
   * Com s'anomena el territori a la descripció, i sense preposició al davant:
   * els noms de comarca vénen sense article —«Priorat», «Selva»— i qualsevol
   * frase que els en posi una surt mal escrita, «d'Priorat» o «a Selva».
   */
  ambit: string,
): string {
  const punts = municipis.filter(
    (m): m is PuntTerritori & { lat: number; lon: number } => m.lat !== null && m.lon !== null,
  );
  if (punts.length < 3) return "";

  const amplada = 640;
  // 24 i no 16: el punt més gran té un radi de 18, i amb un marge més estret la
  // meitat d'una capital de comarca quedava tallada per la vora del llenç.
  const marge = 24;
  const geo = punts.map((m) => ({ slug: m.slug, nom: m.name, lat: m.lat, lon: m.lon }));

  // La projecció escala per amplada. L'Alt Urgell fa el triple d'alt que
  // d'ample, i escalat així sortia un mapa de 1.900 píxels que no cabia a cap
  // pantalla: si l'alçada se'n va, es reescala per alçada i el dibuix es centra.
  const maxAlt = 430;
  let ample = amplada - 2 * marge;
  let projectats = projecta(geo, ample);
  let alt = Math.max(...projectats.map((p) => p.y));
  if (alt > maxAlt) {
    ample = Math.max(60, (ample * maxAlt) / alt);
    projectats = projecta(geo, ample);
    alt = Math.max(...projectats.map((p) => p.y));
  }
  const desplaca = (amplada - ample) / 2;
  const alcada = alt + 2 * marge;

  const radi = (population: number | null): number =>
    // Arrel quarta, com al mapa dels 947: amb l'àrea proporcional al padró, una
    // capital de comarca es menjaria els pobles del voltant. El mínim de 7 no és
    // estètic: per sota d'això el punt deixa de ser un enllaç que es pugui tocar.
    Math.max(7, Math.min(18, 7 + Math.pow(population ?? 0, 0.25) / 2.6));

  const cercles = projectats
    .map((p, i) => {
      const m = punts[i]!;
      const color = colorOf(m.mayorBrandId ?? SENSE_MARCA);
      const qui = m.mayorSigles ? `${m.name} — ${m.mayorSigles}` : m.name;
      return `<a href="${base}m/${escape(m.slug)}/"><title>${escape(qui)}</title>
      <circle cx="${(p.x + desplaca).toFixed(1)}" cy="${(p.y + marge).toFixed(1)}" r="${radi(m.population).toFixed(1)}"
        fill="${color}" stroke="#1E1B2E" stroke-width="1.5"/></a>`;
    })
    .join("");

  return `<figure class="mapa-territori">
  <svg viewBox="0 0 ${amplada} ${alcada.toFixed(0)}" aria-label="${escape(ambit)}: un punt per municipi, pintat de la força que hi té l'alcaldia. Cada punt porta a la fitxa del municipi.">${cercles}</svg>
  <figcaption>Un punt per municipi, de la mida del seu padró i del color de qui hi mana
  —els mateixos colors de les cintes. Cada punt porta a la seva fitxa.
  <a href="${base}mapa/">I els 947 sencers, al mapa gran →</a></figcaption>
</figure>`;
}


/**
 * Les capses dels 947, calculades un sol cop.
 *
 * Es demanen quaranta-tres vegades —una per comarca— i recórrer els 81 kB de
 * camins a cada pàgina seria fer quaranta-tres cops la mateixa feina.
 */
const CAPSES = new Map<string, ReturnType<typeof capsaCami>>();

function capsaDe(slug: string): ReturnType<typeof capsaCami> {
  if (!CAPSES.has(slug)) {
    const cami = geometria.municipis[slug];
    CAPSES.set(slug, cami ? capsaCami(cami) : null);
  }
  return CAPSES.get(slug) ?? null;
}

/** El mínim per pintar una comarca amb els límits municipals de veritat. */
export type TacaComarca = {
  slug: string;
  name: string;
  mayorName: string | null;
  mayorSigles: string | null;
  mayorBrandId: string | null;
};

/**
 * La comarca ampliada, amb els seus límits municipals i cada taca del color de
 * qui hi mana.
 *
 * El que hi havia era un núvol de punts: situava els pobles i prou. Una taca
 * diu tres coses que un punt no diu mai —on s'acaba cada terme, quins municipis
 * es toquen i si una força mana en un bloc o escampada— i és la mateixa
 * geometria de l'ICGC que ja fa servir el mapa dels 947, o sigui que no costa
 * cap fitxer nou.
 *
 * Es dibuixen també els veïns que cauen dins del retall, en gris: una comarca
 * retallada arran no es reconeix, i sense el que hi ha al costat no es veu si
 * el que mira és una vora de país o el mig. Només s'hi dibuixen els que toquen
 * el llenç: els 947 sencers serien 81 kB per pàgina per pintar coses que
 * queden fora.
 *
 * L'incrustat de dalt a la dreta és la resposta a «i això on cau?». Ampliada,
 * una comarca perd exactament això, i qui no sap on és el Priorat continuaria
 * sense saber-ho.
 */
export function renderMapaComarca(
  municipis: readonly TacaComarca[],
  base: string,
  ambit: string,
): string {
  const dins = municipis.filter((m) => geometria.municipis[m.slug]);
  if (dins.length === 0) return "";

  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const m of dins) {
    const c = capsaDe(m.slug);
    if (!c) continue;
    x0 = Math.min(x0, c.x);
    y0 = Math.min(y0, c.y);
    x1 = Math.max(x1, c.x + c.ample);
    y1 = Math.max(y1, c.y + c.alt);
  }
  if (!Number.isFinite(x0) || !Number.isFinite(y0)) return "";

  // Un marge del 7 % del costat llarg, i mai menys de 12 unitats de les 1.600
  // del llenç: el Barcelonès fa 60 unitats i sense un mínim quedaria arran.
  const marge = Math.max(12, 0.07 * Math.max(x1 - x0, y1 - y0));
  let vx = x0 - marge;
  const vy = y0 - marge;
  let vw = x1 - x0 + 2 * marge;
  const vh = y1 - y0 + 2 * marge;

  /*
   * Un llenç molt més alt que ample deixa dues franges buides als costats: el
   * dibuix s'ajusta a l'alçada màxima del full d'estil i s'encongeix al mig.
   * Val més eixamplar el retall —més veïnat a banda i banda, que és context i
   * no farciment— fins a un llenç poc més alt que ample.
   *
   * L'eixamplada té sostre a mig llenç de més. Sense sostre, l'Alt Urgell, que
   * fa el triple d'alt que d'ample, quedaria fet un fil enmig d'un mapa que
   * seria sobretot dels seus veïns.
   */
  const objectiu = 1.05;
  if (vh > objectiu * vw) {
    const volguda = Math.min(vh / objectiu, vw * 1.5);
    vx -= (volguda - vw) / 2;
    vw = volguda;
  }
  const retalla = (n: number): string => n.toFixed(1);

  const propis = new Set(dins.map((m) => m.slug));
  const veins = Object.keys(geometria.municipis)
    .filter((slug) => {
      if (propis.has(slug)) return false;
      const c = capsaDe(slug);
      return c !== null && c.x + c.ample >= vx && c.x <= vx + vw && c.y + c.alt >= vy && c.y <= vy + vh;
    })
    .map((slug) => `<path d="${geometria.municipis[slug]!}"/>`)
    .join("");

  const taques = dins
    .map((m) => {
      const qui = [m.name, m.mayorName, m.mayorSigles].filter(Boolean).join(" — ");
      return `<a href="${base}m/${escape(m.slug)}/"><title>${escape(qui)}</title>
      <path class="dins" style="--c:${colorAlcaldia(m.mayorBrandId)}" d="${geometria.municipis[m.slug]!}"/></a>`;
    })
    .join("");

  const pais = geometria.contorn ? capsaCami(geometria.contorn) : null;
  const capsaPais = pais
    ? [pais.x - 20, pais.y - 20, pais.ample + 40, pais.alt + 40].map(retalla).join(" ")
    : "";
  const oncau =
    geometria.contorn && pais
      ? `<div class="situacio">
      <svg class="on-cau" viewBox="${capsaPais}" role="img"
        aria-label="${escape(ambit)}, dins de Catalunya.">
        <path class="pais" d="${geometria.contorn}"/>
        <path class="aqui" d="${dins.map((m) => geometria.municipis[m.slug]!).join(" ")}"/>
        <circle class="anella" cx="${retalla((x0 + x1) / 2)}" cy="${retalla((y0 + y1) / 2)}"
          r="${retalla(Math.max(70, Math.hypot(x1 - x0, y1 - y0) / 2 + 25))}"/>
      </svg>
      <span>On cau</span>
    </div>`
      : "";

  return `<figure class="mapa-comarca">
  <div class="llenc">
    <svg class="gran" viewBox="${retalla(vx)} ${retalla(vy)} ${retalla(vw)} ${retalla(vh)}" role="img"
      aria-label="${escape(ambit)}: els ${dins.length} municipis pintats de la força que hi té l'alcaldia, i en gris els veïns de fora. Cada terme porta a la fitxa del seu municipi.">
      <g class="fora">${veins}</g>
      ${geometria.contorn ? `<path class="contorn" d="${geometria.contorn}"/>` : ""}
      ${taques}
    </svg>
    ${oncau}
  </div>
  <figcaption>Cada terme porta a la fitxa del seu poble i va pintat amb els colors de les cintes
  de sobre; en gris, els veïns de fora. Límits municipals de l'<a href="${escape(geometria.fontUrl)}"
  target="_blank" rel="noopener">ICGC</a>, ${escape(geometria.llicencia)}.
  <a href="${base}mapa/">Els 947 sencers →</a></figcaption>
</figure>`;
}

/** Una xifra de la portada: l'etiqueta, el número, on cau i on l'expliquen. */
export type Pastilla = {
  etq: string;
  xifra: string;
  /** De 0 a 100, o `null` quan no hi ha res a mesurar. Mai s'omple amb un zero. */
  part: number | null;
  peu: string;
  on: string;
  tema: string;
};

/**
 * El resum d'una ullada, el mateix component que obre la fitxa del poble.
 *
 * No hi ha cap xifra nova: totes surten dels blocs de sota, i cada pastilla hi
 * porta. El peu és el que la fa servir de res —una xifra sola no diu si és molt
 * o poc— i la barra hi va sempre, buida quan no hi ha res a mesurar, perquè les
 * files de la graella no es desmuntin.
 */
export function renderUllada(pastilles: readonly Pastilla[], titol: string): string {
  if (pastilles.length < 3) return "";
  return `<section class="ullada" aria-label="${escape(titol)}">
  <ul>${pastilles
    .map(
      (p) => `<li><a href="${p.on}">
      <span class="dibuix" aria-hidden="true">${icona(p.tema)}</span>
      <span class="etq">${escape(p.etq)}</span>
      <span class="xifra">${p.xifra}</span>
      ${
        p.part === null
          ? `<span class="on buida" aria-hidden="true"></span>`
          : `<span class="on"><i style="--w:${Math.max(0, Math.min(100, p.part)).toFixed(0)}%"></i></span>`
      }
      <span class="peu">${escape(p.peu)}</span>
    </a></li>`,
    )
    .join("")}</ul>
</section>`;
}

/**
 * Les sis xifres que obren la pàgina de comarca.
 *
 * Les tres primeres diuen de quina mida és, i les tres següents qui hi mana:
 * per això la primera fila no porta barra —una comarca no és «molta» ni «poca»
 * comarca— i la segona sí, on la barra és la part de la comarca i el peu la
 * mateixa proporció a tot Catalunya.
 */
function ulladaComarca(data: ComarcaData): string {
  const total = Math.max(1, data.municipis.length);
  const cat = data.catalunya;
  const partCat = (n: number): string => `el ${decimal((100 * n) / Math.max(1, cat.municipis))} %`;
  const pastilles: Pastilla[] = [
    {
      etq: "Municipis",
      xifra: number(data.municipis.length),
      part: null,
      peu:
        data.poblacioMediana === null
          ? `dels ${number(cat.municipis)} de Catalunya`
          : `dels ${number(cat.municipis)} de Catalunya; el del mig té ${number(Math.round(data.poblacioMediana))} habitants`,
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
    peu: `de ${data.municipis.length}; a Catalunya, ${partCat(cat.pacte)} dels municipis`,
    on: "#pactes",
    tema: "seguretat",
  });

  pastilles.push({
    etq: "Han canviat d'alcaldia",
    xifra: number(data.canvisAlcaldia),
    part: (100 * data.canvisAlcaldia) / total,
    peu: `des del juny del 2023; a Catalunya, ${partCat(cat.canvisAlcaldia)}`,
    on: "#canvis",
    tema: "cultura",
  });

  return renderUllada(pastilles, `${data.name} en sis xifres`);
}

/**
 * Les mitjanes comarcals. Tres xifres per indicador i totes tres necessàries:
 * la comarcal per saber com és aquí, la catalana per tenir referència, i el
 * percentil dins del tram de població perquè les dues primeres no enganyin.
 */
function renderIndicadors(data: ComarcaData): string {
  const cards = data.indicadors
    .map((indicador) => {
      const comarcal = indicador.comarcal === null ? "—" : formatValue(indicador.comarcal, indicador.unit);
      const catalana = indicador.catalana === null ? "" : formatValue(indicador.catalana, indicador.unit);
      return `<li class="indicador">
      <span class="nom">${escape(indicador.label)}</span>
      <span class="gran">${comarcal}</span>
      <span class="secundari">mediana d'aquesta comarca · ${indicador.ambDada} de ${data.municipis.length}
        ${plural(indicador.ambDada, "municipi amb dada", "municipis amb dada")}</span>
      ${catalana ? `<span class="referencia">Mediana catalana: <b>${catalana}</b>
        <span class="secundari">(${number(indicador.ambDadaCatalunya)} municipis)</span></span>` : ""}
      ${indicador.percentilGrup === null
        ? ""
        : `<span class="percentil">Percentil <b>${Math.round(indicador.percentilGrup)}</b> entre els de la seva mida</span>`}
    </li>`;
    })
    .join("");
  // La definició de cada indicador ja no va sota cada targeta: va al glossari
  // del final, una sola vegada i amb la font, que és el que la targeta no deia.
  const glossari = renderGlossari(data.indicadors.map((i) => i.key).filter(esClauGlossari));
  return `<ul class="indicadors">${cards}</ul>
  <p class="nota">Les medianes són sobre municipis i no sobre habitants: cada poble hi compta un
  cop. El <b>percentil</b> mesura cada municipi només amb els del seu tram de població de la
  LOREG: 50 és quedar al mig; 80, per sobre de quatre de cada cinc de la seva mida.</p>
  ${glossari}`;
}


/**
 * Els municipis de la comarca comparats **entre ells**.
 *
 * Les targetes de sobre diuen com és la comarca contra Catalunya; això diu com
 * de diferents són els seus pobles per dins, que és la comparació que aquesta
 * pàgina hauria de fer i no feia. Una mediana comarcal de renda amaga
 * exactament el que la gent hi busca: al Baix Llobregat va de poc més d'onze
 * mil euros a més de vint-i-quatre mil, i la xifra del mig no ho diu.
 *
 * El regle va del més baix al més alt d'aquesta comarca, no de zero: la
 * pregunta és qui és a dalt i qui a baix d'aquí, i estirar-lo fins al zero
 * aplanaria totes les diferències en un pam de barra. Cada marca és un
 * municipi i porta a la seva fitxa; les tres xifres van escrites a sota,
 * perquè el dibuix mai no sigui l'única manera de llegir-les.
 */
function renderDispersio(
  titol: string,
  valors: readonly { slug: string; name: string; value: number }[],
  total: number,
): string {
  // Amb tres municipis no hi ha dispersió, hi ha tres xifres: val més dir-les.
  if (valors.length < 4) return "";
  const ordenats = [...valors].sort((a, b) => a.value - b.value);
  const baix = ordenats[0]!;
  const alt = ordenats[ordenats.length - 1]!;
  if (alt.value === baix.value) return "";
  const mig = medianOf(ordenats.map((v) => v.value));
  // Del 4 % al 96 % i no de 0 a 100: la marca fa 14 px i als extrems mitja
  // marca quedava fora de la caixa arrodonida.
  const on = (v: number): string =>
    (4 + (92 * (v - baix.value)) / (alt.value - baix.value)).toFixed(2);
  const euros = (v: number): string => `${number(Math.round(v))} €`;

  const marques = ordenats
    .map(
      (v) => `<a class="marca" style="--p:${on(v.value)}%" href="../../m/${escape(v.slug)}/"
      ><span class="nomes-lectors">${escape(v.name)}, ${euros(v.value)}</span></a>`,
    )
    .join("");

  return `<figure class="dispersio">
  <figcaption class="titol">${escape(titol)}
    <span class="secundari">${valors.length} de ${total} ${plural(valors.length, "municipi amb dada", "municipis amb dada")}</span></figcaption>
  <div class="regle">${mig === null ? "" : `<i class="mig" style="--p:${on(mig)}%"></i>`}${marques}</div>
  <ul class="extrems">
    <li><span class="cap">El més baix</span>
      <a href="../../m/${escape(baix.slug)}/">${escape(baix.name)}</a><b>${euros(baix.value)}</b></li>
    <li><span class="cap">La mediana d'aquí</span>
      <span class="secundari">el municipi del mig</span><b>${mig === null ? "—" : euros(mig)}</b></li>
    <li><span class="cap">El més alt</span>
      <a href="../../m/${escape(alt.slug)}/">${escape(alt.name)}</a><b>${euros(alt.value)}</b></li>
  </ul>
</figure>`;
}

/** Les dues comparacions internes que tenim en euros: la renda i el sou. */
function renderComparacions(data: ComarcaData): string {
  const de = (
    tria: (m: ComarcaMunicipi) => number | null | undefined,
  ): { slug: string; name: string; value: number }[] =>
    data.municipis
      .map((m) => ({ slug: m.slug, name: m.name, value: tria(m) }))
      .filter((v): v is { slug: string; name: string; value: number } => typeof v.value === "number");

  const total = data.municipis.length;
  const renda = renderDispersio("Renda neta per persona", de((m) => m.renda), total);
  const sou = renderDispersio("Sou de l'alcaldia", de((m) => m.souAlcaldia), total);
  if (!renda && !sou) return "";
  return `<h3 class="subtitol">I entre els seus municipis</h3>${renda}${sou}`;
}

/**
 * La llista de municipis: el motiu pel qual algú arriba a aquesta pàgina.
 *
 * Eren cinc columnes de text pla i la darrera —les sigles— no portava enlloc.
 * Ara qui mana hi surt amb la cara i amb la pastilla del seu partit, que és
 * un enllaç a la seva pàgina catalana; les dues columnes de la dreta es
 * fonen en una perquè són la mateixa cosa, qui hi mana.
 */
function renderMunicipis(data: ComarcaData): string {
  const rows = data.municipis
    .map((m) => {
      const marca =
        m.winnerGoverns === false
          ? '<span class="marca-pacte">pacte</span>'
          : m.hasMajority
            ? ""
            : '<span class="marca-minoria">ple sense majoria</span>';
      const canvi = m.mayorChanged ? '<span class="marca-canvi">canvi a mig mandat</span>' : "";
      const pastilla = m.mayorSigles
        ? sigla(m.mayorSigles, { base: "../../", brandId: m.mayorBrandId })
        : "";
      /*
       * La cara i el nom porten a la pàgina de la persona —la que ha decidit
       * `resolAlcaldia()` amb el retrat— o a l'apartat d'alcaldies del
       * municipi quan no en té. Les etiquetes van fora de l'enllaç perquè la
       * pastilla de sigles ja n'és un altre, i sense nom no hi ha enllaç: no
       * hi ha ningú a qui anar a veure.
       */
      const persona = `${caraAlcaldia(m.mayorFoto, m.mayorName, m.mayorBrandId)}<span class="nom">${escape(m.mayorName ?? "Sense dada")}</span>`;
      const onVa = m.mayorName ? `../../m/${escape(m.slug)}/${m.mayorAdreca ? escape(m.mayorAdreca) : "#alcaldies"}` : null;
      return `<tr>
      <th scope="row"><a href="../../m/${escape(m.slug)}/">${escape(m.name)}</a></th>
      <td class="xifra pob">${number(m.population ?? 0)}</td>
      <td class="xifra reg">${m.seats}</td>
      <td class="mana">
        ${onVa ? `<a class="persona" href="${onVa}">${persona}</a>` : `<span class="persona">${persona}</span>`}
        <span class="etiquetes">${pastilla} ${marca} ${canvi}</span>
      </td>
    </tr>`;
    })
    .join("");
  return `<table class="municipis">
  <thead><tr><th>Municipi</th><th>Habitants</th><th>Regidories</th><th>Qui hi mana</th></tr></thead>
  <tbody>${rows}</tbody>
</table>`;
}

// ------------------------------------------------------------------ estil

/** El que només és de les comarques: el salt a les altres quaranta-dues. */
const COMARCA_CSS = TERRITORI_CSS + GLOSSARI_CSS + `
/* El mapa de la comarca amb els límits municipals de veritat. Els gruixos van
   amb «non-scaling-stroke» perquè el llenç està ampliat: sense això, una vora
   d'1 unitat sobre un retall de 60 sortiria de sis píxels i es menjaria els
   pobles petits. */
.mapa-comarca{margin:0 0 var(--e3)}
.mapa-comarca svg.gran{display:block;width:100%;height:auto;max-height:72vh}
.mapa-comarca path{stroke:var(--ink);stroke-width:1;stroke-linejoin:round;vector-effect:non-scaling-stroke}
.mapa-comarca .fora path{fill:var(--paper-2);opacity:.5}
.mapa-comarca .dins{fill:var(--c)}
.mapa-comarca .contorn{fill:none;stroke:var(--ink);stroke-width:2}
.mapa-comarca a:hover .dins{stroke-width:3}
.mapa-comarca a:focus-visible .dins{outline:3px solid var(--coral-text);outline-offset:2px}
/* On cau, dins del país. Ampliada, una comarca perd justament això.
   Va en una columna pròpia i no damunt del mapa: sobreposat, a les comarques
   que toquen el nord-est —l'Alt Empordà, el Ripollès— tapava justament els
   municipis que el lector hi buscava. */
.mapa-comarca .llenc{display:grid;grid-template-columns:minmax(0,1fr) 122px;
  gap:var(--e2);align-items:start}
.mapa-comarca .situacio{display:flex;flex-direction:column;gap:5px;align-items:center}
.mapa-comarca .situacio span{font-size:.68rem;font-weight:800;text-transform:uppercase;
  letter-spacing:.09em;color:var(--ink-suau)}
.mapa-comarca .on-cau{width:100%;height:auto;background:var(--paper);
  border:2.5px solid var(--ink);border-radius:var(--r-s);box-shadow:var(--ombra);padding:5px}
@media (max-width:560px){ .mapa-comarca .llenc{grid-template-columns:minmax(0,1fr) 86px} }
.mapa-comarca .on-cau .pais{fill:var(--vora);stroke:var(--ink);stroke-width:1.5}
.mapa-comarca .on-cau .aqui{fill:var(--coral);stroke:var(--ink);stroke-width:.5}
/* Sense anella no es troba: el Priorat dins de Catalunya fa dos mil·límetres
   d'aquest dibuix, i és la mateixa solució que el mapa petit de la fitxa. */
.mapa-comarca .on-cau .anella{fill:none;stroke:var(--ink);stroke-width:1.5}
.mapa-comarca figcaption{font-size:.8rem;color:var(--ink-suau);line-height:1.4;margin-top:var(--e1)}
.mapa-comarca figcaption a{font-weight:800}

/* La dispersió: cada marca és un municipi col·locat entre el més baix i el més
   alt de la comarca. La marca fa 14 px d'ample encara que la ratlla en faci 4:
   per sota d'això no és un enllaç que es pugui tocar amb el dit. */
.dispersio{margin:0 0 var(--e3)}
.dispersio .titol{font-weight:800;font-size:.95rem;margin:0 0 10px;display:flex;
  flex-wrap:wrap;gap:0 8px;align-items:baseline}
.dispersio .regle{position:relative;height:46px;border:2.5px solid var(--ink);border-radius:var(--r-s);
  background:linear-gradient(90deg,var(--paper-2),var(--lavanda))}
.dispersio .marca{position:absolute;left:var(--p);top:0;bottom:0;width:14px;margin-left:-7px}
.dispersio .marca::before{content:"";position:absolute;left:5px;top:5px;bottom:5px;width:4px;
  border-radius:2px;background:var(--ink);opacity:.5}
.dispersio .marca:hover::before,.dispersio .marca:focus-visible::before{background:var(--coral-text);
  opacity:1;left:4px;width:6px;top:2px;bottom:2px}
/* La mediana surt de la caixa per dalt i per baix: ha de guanyar visualment a
   les 900 marques d'una comarca gran sense pintar-se d'un altre color. */
.dispersio .mig{position:absolute;left:var(--p);top:-7px;bottom:-7px;width:8px;margin-left:-4px;
  background:var(--coral);border:2px solid var(--ink);border-radius:4px}
.dispersio .extrems{list-style:none;margin:12px 0 0;padding:0;display:grid;gap:var(--e1);
  grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}
.dispersio .extrems li{display:flex;flex-direction:column;gap:1px}
.dispersio .cap{font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.09em;
  color:var(--ink-suau)}
.dispersio .extrems b{font-family:var(--display);font-weight:900;font-size:1.1rem;
  letter-spacing:-.02em;font-variant-numeric:tabular-nums}

/* Qui hi mana, a la llista de municipis: la cara i la pastilla del partit. El
   retrat hi va a 34 px i no a 44 perquè són fins a 68 files seguides. */
/* Qui hi mana: la cara i el nom en una línia, que és l'enllaç a la persona, i
   les etiquetes a sota alineades amb el nom. Abans era una fila amb la cara i
   una columna al costat; ara la persona és un enllaç i la pastilla de sigles
   n'és un altre, i no poden anar l'un dins de l'altre. */
.municipis .mana{display:flex;flex-direction:column;gap:3px;min-width:0}
.municipis .mana .persona{display:flex;align-items:center;gap:9px;min-width:0;color:inherit;
  text-decoration:none;min-height:44px}
.municipis .mana .retrat{width:34px;height:34px;flex:none}
.municipis .mana .nom{font-weight:700;line-height:1.25;overflow-wrap:anywhere}
.municipis .mana a.persona:hover .nom,.municipis .mana a.persona:focus-visible .nom{text-decoration:underline;
  text-decoration-thickness:2.5px;text-underline-offset:3px;text-decoration-color:var(--coral)}
.municipis .mana a.persona:focus-visible{outline:3px solid var(--coral);outline-offset:2px}
.municipis .mana .etiquetes{display:flex;flex-wrap:wrap;gap:5px;align-items:center;padding-left:43px}

/* Les altres 42: sense això, cada pàgina de comarca és un carreró sense sortida. */
.veines{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px}
.veines a{display:inline-flex;align-items:center;min-height:44px;font-size:.8rem;font-weight:800;
  text-decoration:none;border:2px solid var(--ink);border-radius:var(--r-max);padding:5px 12px}
.veines a:hover{background:var(--ink);color:var(--paper)}
.veines .aqui{background:var(--coral);color:#1E1B2E;border-color:var(--ink)}
`;

// ------------------------------------------------------------------ pàgina

/**
 * El resum d'una frase. A la fitxa municipal és qui mana; aquí és quina força
 * té més alcaldies i si en té prou per dir que la comarca és seva.
 */
function summarySentence(data: ComarcaData): string {
  const first = data.forces[0];
  if (!first || first.brandId === SENSE_MARCA) return "";
  const second = data.forces[1];
  const share = (100 * first.alcaldies) / Math.max(1, data.municipis.length);
  const head =
    second && second.alcaldies === first.alcaldies
      ? `<b>${escape(first.label)}</b> i <b>${escape(second.label)}</b> empaten a ${first.alcaldies} ${plural(first.alcaldies, "alcaldia", "alcaldies")}`
      : `<b>${escape(first.label)}</b> té ${first.alcaldies} ${plural(first.alcaldies, "alcaldia", "alcaldies")} de ${data.municipis.length}`;
  const tail =
    share >= 50 && !(second && second.alcaldies === first.alcaldies)
      ? ", més de la meitat de la comarca"
      : "";
  return `${head}${tail}.`;
}

export function renderComarca(data: ComarcaData, generatedAt: string): string {
  const title = `${data.name} — Observatori municipal de quivoto`;
  const summary = summarySentence(data);
  // El mapa de taques quan en tenim la geometria, i el núvol de punts quan no:
  // hi ha ens —l'AMB— i municipis nous que encara no són als límits de l'ICGC.
  const mapa =
    renderMapaComarca(data.municipis, "../../", data.name) ||
    renderMapaTerritori(data.municipis, "../../", data.name);
  const comparacions = renderComparacions(data);
  const teIndicadors = data.indicadors.length > 0 || comparacions !== "";

  return `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escape(title)}</title>
<meta name="description" content="Qui mana a ${escape(data.name)}: quantes alcaldies té cada força als seus ${data.municipis.length} municipis, on hi va haver pacte, on ha canviat l'alcaldia i com són els seus indicadors comparats amb la resta de Catalunya.">
${tipografia("../../")}
<style>${RADIOGRAFIA_CSS}${COMARCA_CSS}</style>
</head>
<body>
<a class="salta" href="#contingut">Ves al contingut</a>

${capcalera("../../", "cap")}
${cercador("../../")}

<main id="contingut">

<section class="portada">
  <p class="micro">Comarca</p>
  <h1>${escape(data.name)}</h1>
  ${
    // L'entrada era la línia de comptes —«23 municipis · 9.376 habitants»— i just
    // a sota les mateixes tres xifres repetides en targetes. Ara l'entrada és la
    // resposta a la pregunta que porta algú aquí, i els comptes van a la ullada.
    summary
      ? `<p class="entrada">${summary}</p>`
      : `<p class="entrada">De l'alcaldia més repetida d'aquesta comarca no n'hem pogut lligar
         la candidatura amb cap força coneguda.</p>`
  }
  ${ulladaComarca(data)}
</section>

<nav class="index" aria-label="Seccions d'aquesta pàgina">
  <a href="#alcaldies">Qui mana</a>
  <a href="#pactes">Pactes</a>
  <a href="#canvis">Canvis d'alcaldia</a>
  ${teIndicadors ? '<a href="#indicadors">Com és aquesta comarca</a>' : ""}
  <a href="#municipis">Els ${data.municipis.length} municipis</a>
</nav>

<section class="bloc" id="alcaldies">
  <h2>Qui mana, i sobre quanta gent</h2>
  <p class="entrada-bloc">Dalt, les alcaldies; baix, la gent que hi viu. Un color que s'eixampla
  de l'una a l'altra mana en pocs municipis però grans.</p>
  ${renderPoder(data.forces, data.municipis.length, data.habitants, "de la comarca")}
  ${mapa}
  <p class="nota">Una alcaldia no és un vot: en un poble n'hi ha prou amb dues-centes persones.
  ${(data.forces.find((f) => f.brandId === SENSE_MARCA)?.alcaldies ?? 0) > 0
    ? (() => {
        // La frase ha d'explicar la barra que el lector té davant. `senseIdentificar`
        // compta una altra cosa —«no sabem si governa el més votat»— i posar-lo aquí
        // feia dir «3 alcaldies» sota una barra que en marcava 7.
        const n = data.forces.find((f) => f.brandId === SENSE_MARCA)?.alcaldies ?? 0;
        return `De ${n} ${plural(n, "alcaldia no n'hem pogut", "alcaldies no n'hem pogut")} lligar la candidatura amb cap marca coneguda.`;
      })()
    : ""}</p>
</section>

${renderBlocsPoder(data, { base: "../../", ambit: "comarca" })}

${teIndicadors ? `<section class="bloc" id="indicadors">
  <h2>Com és aquesta comarca</h2>
  ${renderIndicadors(data)}
  ${comparacions}
</section>` : ""}

<section class="bloc" id="municipis">
  <h2>Els ${data.municipis.length} municipis</h2>
  <p class="entrada-bloc">Ordenats per població; cada nom porta a la seva fitxa.</p>
  ${renderMunicipis(data)}
</section>

<section class="bloc">
  <h2>Què és i què no és una comarca</h2>
  <p>Els consells comarcals no es voten: els trien els regidors. Això no és la fitxa d'un govern
  comarcal, sinó la <b>suma dels ${data.municipis.length} ajuntaments</b> de ${escape(data.name)}.</p>
  <p class="nota">Els límits són els del padró de la Generalitat, amb el Lluçanès i el Moianès
  com a comarques pròpies.</p>
</section>

<nav class="bloc" aria-label="Les altres comarques">
  <h2>Les altres comarques</h2>
  <ul class="veines">${data.altres
    .map(
      (c) => `<li><a href="../${escape(c.slug)}/"${c.slug === data.slug ? ' class="aqui" aria-current="page"' : ""}>${escape(c.name)} <span class="secundari">${c.municipis}</span></a></li>`,
    )
    .join("")}</ul>
</nav>

<section class="bloc fonts">
  <h2>D'on surt tot això</h2>
  <ul>
    <li>Padró, comarca i alcaldia de cada ens: Generalitat de Catalunya, <code>6nei-4b44</code>.</li>
    <li>Vots i regidories del 2023, i les sigles de cada candidatura: <code>ntc4-rnwr</code>.</li>
    <li>Participació i cens del 2023: <code>irrv-2mfc</code>.</li>
    <li>Historial d'alcaldies, d'on surten els canvis a mig mandat: <code>2v2p-vu4h</code>.</li>
    <li>Sexe de les persones elegides: <code>xnfg-weec</code>.</li>
    <li>Liquidació pressupostària i deute viu: Consorci AOC, <code>81f18313</code> i <code>34db8dc5</code>.</li>
    <li>Renda neta per persona: INE, Atles de distribució de renda de les llars.</li>
    <li>Sou de l'alcaldia: inventari ISPA 2025 del Ministeri per a la Transformació Digital i de
      la Funció Pública.</li>
    <li>Retrats de l'alcaldia: la seu electrònica de cada ajuntament, que és qui els publica.</li>
    <li>Límits municipals del mapa: <a href="${escape(geometria.fontUrl)}" target="_blank"
      rel="noopener">ICGC</a>, ${escape(geometria.llicencia)}.</li>
  </ul>
  <p class="nota">Les alcaldies per força, els pactes, els canvis i els percentils són càlculs
  nostres sobre aquestes fonts, repetibles amb el codi del projecte. Cap xifra no és estimada.</p>
</section>

</main>
${peu("../../", generatedAt)}

</body>
</html>`;
}
