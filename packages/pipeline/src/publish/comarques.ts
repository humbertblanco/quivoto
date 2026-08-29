import { eq, sql, type SQLWrapper } from "drizzle-orm";
import {
  candidatures, electionParticipation, municipalities, municipalityMetrics, type Db,
} from "@quivoto/db";
import { BRANDS_BY_ID } from "@quivoto/shared-schemas/brands";
import { buildPeerGroups, medianOf, percentileOf, type PeerGroup } from "../derive/peers";
import { dataCurta, slugify } from "../lib/text";
import { RADIOGRAFIA_CSS } from "./estil";

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
  seats: number;
  mayorName: string | null;
  mayorSigles: string | null;
  /** Marca de l'alcaldia, resolta per les sigles de la seva candidatura del 2023. */
  mayorBrandId: string | null;
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
  /** Les altres 42, per poder-hi saltar sense passar per l'índex. */
  altres: { slug: string; name: string; municipis: number }[];
};

// -------------------------------------------------------------- presentació

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const number = (n: number): string => n.toLocaleString("ca-ES");
const decimal = (n: number, digits = 1): string => n.toFixed(digits).replace(".", ",");

/** «27 d'agost», no «27 de agost». Una sola còpia, a `lib/text.ts`. */
const formatDate = dataCurta;

/**
 * «des de l'1 de juliol», no «des del 1 de juliol»: l'u i l'onze són els dos
 * únics dies que comencen amb vocal, i l'article s'hi apostrofa.
 */
function sinceDate(iso: string | null): string {
  if (!iso) return "";
  const day = Number(iso.slice(8, 10));
  return `${day === 1 || day === 11 ? "des de l'" : "des del "}${formatDate(iso)}`;
}

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

  const deute = lecturesFrom(debtRows);
  const paritat = lecturesFrom(parityRows);
  const selectiva = lecturesFrom(wasteRows);
  const participacio: Lectura[] = [];
  for (const [municipalityId, value] of turnout) {
    const comarca = comarcaOf.get(municipalityId);
    if (comarca) participacio.push({ municipalityId, comarca, value });
  }

  const anyResidus = Math.max(0, ...wasteRows.map((r) => toNumber(r.year) ?? 0));

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

    const municipi: ComarcaMunicipi = {
      slug: m.slug,
      name: m.name,
      population: m.population,
      seats,
      mayorName: government?.mayorName ?? m.mayorName,
      mayorSigles,
      mayorBrandId: brandId,
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
      key: "participacio", label: "Participació el 2023", unit: "percent",
      nota: "Vots emesos sobre el cens a les municipals del 28 de maig del 2023.",
    }, participacio],
    [{
      key: "paritat", label: "Dones al ple", unit: "percent",
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
      altres,
    };
  });
}

// --------------------------------------------------------------- fragments

/**
 * Quantes alcaldies té cada força. És el gràfic que dona nom a la pàgina, i per
 * això les xifres van escrites al costat de la barra i no dins: la barra és
 * l'ajuda per comparar-les d'una ullada, no l'única manera de llegir-les.
 */
function renderForces(data: ComarcaData): string {
  const max = Math.max(1, ...data.forces.map((f) => f.alcaldies));
  const items = data.forces
    .map((forca) => {
      const share = (100 * forca.habitants) / Math.max(1, data.habitants);
      return `<li>
      <span class="nom"><span class="mostra" style="--c:${forca.color}"></span>${escape(forca.label)}</span>
      <span class="regle"><i style="--w:${((100 * forca.alcaldies) / max).toFixed(1)}%;--c:${forca.color}"></i></span>
      <span class="compte"><b>${forca.alcaldies}</b> ${plural(forca.alcaldies, "alcaldia", "alcaldies")}</span>
      <span class="secundari">${number(forca.habitants)} habitants · ${decimal(share)} % de la comarca</span>
    </li>`;
    })
    .join("");
  return `<ul class="forces">${items}</ul>`;
}

/** Governa el més votat, o hi va haver pacte. Una barra de tres trams i prou. */
function renderRepartiment(data: ComarcaData): string {
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
function renderPactes(data: ComarcaData): string {
  const pactes = data.municipis.filter((m) => m.winnerGoverns === false);
  if (pactes.length === 0) {
    return `<p>A tots els municipis d'aquesta comarca on hem pogut identificar l'alcaldia,
    la governa la llista més votada.</p>`;
  }
  const items = pactes
    .map(
      (m) => `<li><a href="../../m/${escape(m.slug)}/">${escape(m.name)}</a>
      <span class="secundari">governa ${escape(m.mayorSigles ?? "?")}; la més votada va ser ${escape(m.winnerSigles ?? "?")}</span></li>`,
    )
    .join("");
  return `<p>A <b>${pactes.length}</b> ${plural(pactes.length, "municipi", "municipis")} de
  ${data.municipis.length} l'alcaldia no és de la llista més votada. Vol dir que hi va haver pacte.</p>
  <ul class="detall">${items}</ul>`;
}

/** Canvis d'alcaldia a mig mandat, que és on es veu la política que no es vota. */
function renderCanvis(data: ComarcaData): string {
  const canvis = data.municipis.filter((m) => m.mayorChanged);
  if (canvis.length === 0) {
    return `<p>Cap municipi d'aquesta comarca no ha canviat d'alcaldia des de la constitució
    dels plens el juny del 2023.</p>`;
  }
  const items = canvis
    .map(
      (m) => `<li><a href="../../m/${escape(m.slug)}/">${escape(m.name)}</a>
      <span class="secundari">${escape(m.mayorChangeName ?? "")}${m.mayorChangeDate ? `, ${sinceDate(m.mayorChangeDate)}` : ""}</span></li>`,
    )
    .join("");
  return `<p><b>${canvis.length}</b> ${plural(canvis.length, "municipi ha canviat", "municipis han canviat")}
  d'alcaldia des de la constitució dels plens del juny del 2023.</p>
  <ul class="detall">${items}</ul>
  <p class="nota">Les fonts obertes desen qui ocupa el càrrec, no per què va marxar l'anterior:
  d'aquí no se'n pot deduir ni una dimissió ni una moció de censura.</p>`;
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
      <span class="secundari">${escape(indicador.nota)}</span>
    </li>`;
    })
    .join("");
  return `<ul class="indicadors">${cards}</ul>
  <p class="nota">La mediana comarcal i la catalana es calculen sobre municipis, no sobre
  habitants: cada poble hi compta un cop, tant si en té tres-cents com si en té cent mil.
  El <b>percentil</b> és la comparació que val: cada municipi es mesura només amb els
  catalans del seu tram de població de la LOREG —el mateix que decideix quants regidors
  té— i el que es publica és la mediana d'aquells percentils. 50 vol dir que el municipi
  típic d'aquesta comarca queda al mig; 80, que queda per sobre de quatre de cada cinc
  municipis de la seva mida.</p>`;
}

/** La llista de municipis: el motiu pel qual algú arriba a aquesta pàgina. */
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
      return `<tr>
      <th scope="row"><a href="../../m/${escape(m.slug)}/">${escape(m.name)}</a></th>
      <td class="xifra pob">${number(m.population ?? 0)}</td>
      <td class="xifra reg">${m.seats}</td>
      <td>${escape(m.mayorName ?? "—")}</td>
      <td class="secundari">${escape(m.mayorSigles ?? "—")} ${marca} ${canvi}</td>
    </tr>`;
    })
    .join("");
  return `<table class="municipis">
  <thead><tr><th>Municipi</th><th>Habitants</th><th>Regidories</th><th>Alcaldia</th><th>Candidatura</th></tr></thead>
  <tbody>${rows}</tbody>
</table>`;
}

// ------------------------------------------------------------------ estil

/**
 * El que aquesta pàgina necessita i la fitxa municipal no té. Va aquí i no a
 * `estil.ts` perquè les comarques són una pàgina i no un patró: si demà en
 * surten més que ho comparteixin, ja es mourà.
 */
const COMARCA_CSS = `
.forces{list-style:none;margin:0 0 var(--e2);padding:0;display:grid;gap:var(--e2)}
.forces li{display:grid;grid-template-columns:minmax(8em,12em) 1fr auto;gap:2px var(--e2);align-items:center}
.forces .nom{font-weight:800;font-size:.94rem;display:flex;align-items:center;gap:8px}
.forces .regle{height:20px;background:var(--vora);border-radius:var(--r-max);overflow:hidden}
.forces .regle i{display:block;height:100%;width:var(--w);min-width:5px;background:var(--c);border:1.5px solid var(--ink);border-radius:var(--r-max)}
.forces .compte{font-size:.92rem;white-space:nowrap}
.forces .compte b{font-family:var(--display);font-weight:900;font-size:1.25rem;letter-spacing:-.02em}
.forces .secundari{grid-column:1/-1;margin-top:-2px}
@media (max-width:560px){
  .forces li{grid-template-columns:1fr auto}
  .forces .regle{grid-column:1/-1;order:3}
  .forces .secundari{order:4}
}

/* Governa el més votat o hi va haver pacte: una barra i prou. Els colors són
   els de la identitat, no els de cap partit: aquí no es parla de forces. */
.repartiment{display:flex;height:52px;border:2.5px solid var(--ink);border-radius:var(--r-s);overflow:hidden}
.repartiment span{width:var(--w);display:flex;align-items:center;justify-content:center;
  border-right:1.5px solid var(--ink);color:#1E1B2E;font-family:var(--display);font-weight:900;font-size:1.1rem}
.repartiment span:last-child{border-right:0}
.governa-guanyador{background:var(--menta)}
.governa-pacte{background:var(--presec)}
.governa-desconegut{background:var(--lavanda)}
.clau .mostra.governa-guanyador{background:var(--menta)}
.clau .mostra.governa-pacte{background:var(--presec)}
.clau .mostra.governa-desconegut{background:var(--lavanda)}

/* Llistes de municipis amb un detall al costat: pactes i canvis d'alcaldia. */
.detall{list-style:none;margin:0 0 var(--e2);padding:0;display:grid;gap:var(--e1);
  grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
.detall li{padding:8px 0;border-bottom:1px solid var(--vora);display:flex;flex-direction:column;gap:1px}
.detall a{font-weight:800}

/* Les targetes d'indicador reaprofiten .indicadors i .indicador de la fitxa. */
.indicador .referencia,.indicador .percentil{font-size:.88rem}
.indicador .percentil{background:var(--lavanda);color:#1E1B2E;border-radius:var(--r-s);
  padding:5px 9px;align-self:flex-start;font-weight:700}

/* La llista de municipis: la taula més llarga del portal, 68 files a l'Alt Empordà. */
.municipis{width:100%;border-collapse:collapse;font-size:.92rem}
.municipis th,.municipis td{text-align:left;padding:9px 10px 9px 0;border-bottom:1px solid var(--vora);vertical-align:top}
.municipis thead th{font-size:.7rem;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-suau);border-bottom:2.5px solid var(--ink)}
.municipis tbody th{font-weight:800}
.municipis .xifra{font-variant-numeric:tabular-nums;white-space:nowrap}
.marca-pacte,.marca-minoria{display:inline-block;border-radius:var(--r-max);padding:2px 9px;
  font-size:.68rem;font-weight:800;white-space:nowrap;color:#1E1B2E}
.marca-pacte{background:var(--presec)}
.marca-minoria{background:var(--lavanda)}
@media (max-width:640px){
  .municipis thead{display:none}
  .municipis tr{display:block;padding:10px 0;border-bottom:1px solid var(--vora)}
  .municipis th,.municipis td{display:block;border:0;padding:1px 0}
  .municipis tbody th{font-size:1.02rem}
  /* Població i regidories tornen a la mateixa línia, amb la unitat escrita:
     sense capçalera de taula, «685» i «7» tots sols no volen dir res. */
  .municipis .pob,.municipis .reg{display:inline;font-weight:400;color:var(--ink-suau);font-size:.86rem}
  .municipis .pob::after{content:" habitants · "}
  .municipis .reg::after{content:" regidories"}
}

/* Les altres 42: sense això, cada pàgina de comarca és un carreró sense sortida. */
.veines{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px}
.veines a{display:inline-flex;align-items:center;min-height:44px;font-size:.8rem;font-weight:800;
  text-decoration:none;border:2px solid var(--ink);border-radius:var(--r-max);padding:5px 12px}
.veines a:hover{background:var(--ink);color:var(--paper)}
.veines .aqui{background:var(--coral);color:#1E1B2E;border-color:var(--ink)}
.resum-xifres{list-style:none;margin:var(--e3) 0 0;padding:0;display:grid;gap:var(--e2);
  /* 150 px no cabien: una xifra com «2.416.005» en fa 162 amb «.gran» i vessava
     sobre el text del costat a 768 px. */
  grid-template-columns:repeat(auto-fit,minmax(190px,1fr))}
.resum-xifres li{background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);
  box-shadow:var(--ombra);padding:var(--e2);display:flex;flex-direction:column;gap:2px}
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
  const capital = data.municipis[0];

  return `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escape(title)}</title>
<meta name="description" content="Qui mana a ${escape(data.name)}: quantes alcaldies té cada força als seus ${data.municipis.length} municipis, on hi va haver pacte, on ha canviat l'alcaldia i com són els seus indicadors comparats amb la resta de Catalunya.">
<style>${RADIOGRAFIA_CSS}${COMARCA_CSS}</style>
</head>
<body>
<a class="salta" href="#contingut">Ves al contingut</a>

<header class="capcalera">
  <a class="logo" href="../../">Observatori</a>
  <span class="etiqueta">esborrany · dades obertes</span>
</header>

<main id="contingut">

<section class="portada">
  <p class="micro">Comarca</p>
  <h1>${escape(data.name)}</h1>
  <p class="entrada">
    ${data.municipis.length} municipis · ${number(data.habitants)} habitants ·
    ${number(data.regidories)} regidories en total
  </p>
  ${summary ? `<p class="resum">${summary}</p>` : ""}
  <ul class="resum-xifres">
    <li><span class="gran">${data.municipis.length}</span><span class="secundari">municipis</span></li>
    <li><span class="gran">${number(data.habitants)}</span><span class="secundari">habitants${
      data.poblacioMediana === null ? "" : ` · el municipi del mig en té ${number(Math.round(data.poblacioMediana))}`
    }</span></li>
    <li><span class="gran">${number(data.regidories)}</span><span class="secundari">regidories, que és el que es reparteix el 23-M</span></li>
    <li><span class="gran">${data.pacte}</span><span class="secundari">${plural(data.pacte, "municipi on governa qui no va guanyar", "municipis on governa qui no va guanyar")}</span></li>
  </ul>
</section>

<nav class="index" aria-label="Seccions d'aquesta pàgina">
  <a href="#alcaldies">Qui mana</a>
  <a href="#pactes">Pactes</a>
  <a href="#canvis">Canvis d'alcaldia</a>
  ${data.indicadors.length > 0 ? '<a href="#indicadors">Com és aquesta comarca</a>' : ""}
  <a href="#municipis">Els ${data.municipis.length} municipis</a>
</nav>

<section class="bloc" id="alcaldies">
  <h2>Quantes alcaldies té cada força</h2>
  <p class="entrada-bloc">L'alcaldia de cada municipi, agrupada per la força de la candidatura
  que la va presentar. Al costat, quanta gent viu als municipis que governa.</p>
  ${renderForces(data)}
  <p class="nota">Una alcaldia no és un vot: als municipis petits n'hi ha prou amb dues-centes
  persones i a la capital en calen milers. Per això hi va el nombre d'habitants al costat, que
  és el que diu si una força mana en molts llocs o en llocs grans.
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

<section class="bloc" id="pactes">
  <h2>On va governar la llista més votada</h2>
  ${renderRepartiment(data)}
  <p>A <b>${data.majoriaAbsoluta}</b> de ${data.municipis.length}
  ${plural(data.majoriaAbsoluta, "municipi la llista guanyadora governa", "municipis la llista guanyadora governa")}
  amb majoria absoluta, i per tant no va necessitar ningú.</p>
  ${renderPactes(data)}
  <p class="nota">«Pacte» vol dir només això: que l'alcaldia és d'una llista que no va ser la
  més votada, i que per tant algú altre hi va donar suport. No en sabem el contingut, perquè
  els acords d'investidura no són dades obertes.</p>
</section>

<section class="bloc" id="canvis">
  <h2>Qui ha canviat d'alcaldia a mig mandat</h2>
  ${renderCanvis(data)}
</section>

${data.indicadors.length > 0 ? `<section class="bloc" id="indicadors">
  <h2>Com és aquesta comarca</h2>
  ${renderIndicadors(data)}
</section>` : ""}

<section class="bloc" id="municipis">
  <h2>Els ${data.municipis.length} municipis</h2>
  <p class="entrada-bloc">Ordenats per població${capital ? `, i per tant comença ${escape(capital.name)}` : ""}.
  Cada nom porta a la seva fitxa sencera.</p>
  ${renderMunicipis(data)}
</section>

<section class="bloc">
  <h2>Què és i què no és una comarca</h2>
  <p>El 23 de maig del 2027 no es vota cap consell comarcal: els seus consellers els trien els
  regidors elegits als municipis, no els electors. Aquesta pàgina no és, doncs, la fitxa d'un
  govern comarcal, sinó la <b>suma dels ${data.municipis.length} ajuntaments</b> que hi ha a
  ${escape(data.name)}, per veure si el que passa al teu poble és el que passa al costat.</p>
  <p class="nota">Els límits comarcals són els que fa servir la Generalitat al padró; el
  Lluçanès i el Moianès hi són com a comarques pròpies.</p>
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
  </ul>
  <p class="nota">El recompte d'alcaldies per força, els pactes, els canvis a mig mandat i els
  percentils per tram de població són càlculs nostres sobre aquestes fonts, i es poden repetir
  amb el codi del projecte. Cap xifra d'aquesta pàgina no ve d'una estimació.</p>
</section>

</main>

<footer class="peu">
  <p>quivoto · ${escape(data.name)} · pàgina generada el ${escape(generatedAt)} · esborrany intern, no indexat</p>
</footer>
</body>
</html>`;
}
