import { and, asc, eq, inArray } from "drizzle-orm";
import {
  candidatures, councillorMandates, dataIssues, electionParticipation, municipalities,
  municipalityMetrics, people, politicalGroups, type Db,
} from "@quivoto/db";
import { BRANDS_BY_ID, sameForce } from "@quivoto/shared-schemas/brands";
import { absoluteMajority } from "@quivoto/shared-schemas/seats";
import { hemicycle } from "./hemicycle";
import { renderMapa, type PuntMapa } from "./mapa";
import { slugify } from "../lib/text";
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
type RevenueMetric = { year: number; figures: MoneyEntry[]; medians: Record<string, number | null> };
type SpendingMetric = { year: number; areas: MoneyEntry[]; totalPerHead: number; medians: Record<string, number | null> };
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

function renderLegend(candidatures: readonly CandidatureShare[], slugPer: (sigles: string) => string): string {
  return `<ul class="llegenda">${candidatures
    .filter((c) => c.seats > 0)
    .map(
      (c) => `<li><span class="mostra" style="--c:${colorOf(c)}"></span>
      <b><a href="${escape(slugPer(c.sigles))}/">${escape(c.sigles)}</a></b>
      <span class="xifra">${c.seats} ${c.seats === 1 ? "regidoria" : "regidories"}</span>
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
        (c) => `<span class="tram" style="--c:${colorOf(c)};--w:${(100 * c.seats) / total}%" title="${escape(c.sigles)}: ${c.seats}">
        <b>${c.seats}</b><i>${escape(c.sigles)}</i></span>`,
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
          return `<span class="tros${family === winner ? " guanya" : ""}"
            style="--c:${FAMILY_COLORS[family] ?? "#8b8b8b"};--h:${share}%"
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
      (family) => `<li><span class="mostra" style="--c:${FAMILY_COLORS[family] ?? "#8b8b8b"}"></span>${escape(
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
 * Un tipus impositiu tot sol no diu res. Al costat de la mediana catalana, sí.
 */
function renderTaxes(taxes: TaxesMetric): string {
  const items = Object.entries(taxes.taxes)
    .filter(([, tax]) => tax.value > 0)
    .map(([key, tax]) => {
      const median = taxes.medians[key];
      const comparison =
        median === undefined || key === "cadastre"
          ? ""
          : tax.value > median
            ? `<span class="comparativa mes">per sobre de la mediana catalana (${String(median).replace(".", ",")})</span>`
            : tax.value < median
              ? `<span class="comparativa menys">per sota de la mediana catalana (${String(median).replace(".", ",")})</span>`
              : `<span class="comparativa">just a la mediana catalana</span>`;
      const value = key === "cadastre" ? String(Math.round(tax.value)) : String(tax.value).replace(".", ",");
      return `<li><span class="nom">${escape(tax.label)}</span>
        <span class="gran">${value}${tax.unit && tax.unit !== "any" ? ` ${tax.unit}` : ""}</span>
        ${comparison}</li>`;
    })
    .join("");
  return `<ul class="impostos">${items}</ul>
  <p class="nota">Tipus vigents el ${taxes.year}, tal com els declara cada ajuntament al mateix
  formulari. Les medianes són de tots els municipis catalans amb dada.</p>`;
}

/**
 * Una xifra per habitant només informa si es pot comparar amb dues coses: amb la
 * resta de conceptes de la mateixa llista i amb el que fan els altres municipis.
 * Per això totes les barres d'un bloc comparteixen escala —si cadascuna tingués
 * la seva, un import petit podria semblar més gran que un de gran— i la mediana
 * catalana hi va marcada damunt de la mateixa escala.
 */
function moneyRow(label: string, perHead: number, median: number | null | undefined, scale: number): string {
  const euros = `${perHead.toFixed(perHead < 10 ? 2 : 0).replace(".", ",")} €`;
  const width = scale > 0 ? Math.min(100, (100 * perHead) / scale) : 0;
  const markAt = median && median > 0 && scale > 0 ? Math.min(100, (100 * median) / scale) : null;
  const ratio = median && median > 0 ? perHead / median : null;
  const comparison =
    ratio === null
      ? ""
      : ratio > 1.15
        ? `<span class="comparativa mes">${Math.round(100 * ratio - 100)} % per sobre de la mediana catalana</span>`
        : ratio < 0.85
          ? `<span class="comparativa menys">${Math.round(100 - 100 * ratio)} % per sota de la mediana catalana</span>`
          : `<span class="comparativa">a tocar de la mediana catalana</span>`;
  return `<li>
    <span class="etq">${escape(label)}</span>
    <span class="imp">${euros}</span>
    <span class="regle">
      <i style="--w:${width.toFixed(1)}%"></i>
      ${markAt === null ? "" : `<b style="--m:${markAt.toFixed(1)}%"><span>mediana</span></b>`}
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
  const scale = scaleFor(revenue.figures.map((f) => f.perHead), revenue.medians);
  return `<ul class="diners">${revenue.figures
    .map((figure) => moneyRow(figure.label, figure.perHead, revenue.medians[figure.label], scale))
    .join("")}</ul>
  <p class="nota">Recaptat el ${revenue.year}, en euros per habitant. La marca vertical és la
  mediana de tots els municipis catalans amb dada, perquè una xifra sola no diu si aquí es
  paga molt o poc.</p>`;
}

function renderSpending(spending: SpendingMetric): string {
  const scale = scaleFor(spending.areas.map((a) => a.perHead), spending.medians);
  return `<ul class="diners">${spending.areas
    .map((area) => moneyRow(area.label, area.perHead, spending.medians[area.label], scale))
    .join("")}</ul>
  <p class="nota">Liquidat el ${spending.year}: ${number(spending.totalPerHead)} € per habitant en total.
  Les àrees són les de la classificació per programes, iguals per a tots els ajuntaments.</p>`;
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
          const nom = c.fitxa
            ? `<a href="${escape(c.fitxa)}" target="_blank" rel="noopener">${escape(c.nom)}</a>`
            : escape(c.nom);
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
  const rows = history.map((m) => {
    const change = mayorsMetric.changes.find((c) => c.term === m.term);
    const late = change?.onlySuccessorKnown && change.mayors[0]?.name === m.name;
    return `<tr>
      <th scope="row">${escape(m.term)}</th>
      <td>${escape(m.name)}${late ? ' <span class="marca-canvi">va arribar a mig mandat</span>' : ""}</td>
      <td class="secundari">${escape(m.partyRaw ?? "—")}</td>
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
function summarySentence(data: RadiografiaData): string {
  const government = data.government;
  if (!government?.mayorName) return "";
  const parts: string[] = [
    government.winnerGoverns === false
      ? `Governa <b>${escape(government.mayorSigles ?? "?")}</b> tot i que la llista més votada va ser <b>${escape(government.winnerSigles)}</b>`
      : `Governa <b>${escape(government.mayorSigles ?? government.winnerSigles)}</b>, la llista més votada`,
    government.winnerHasMajority ? "amb majoria absoluta" : "sense majoria absoluta",
  ];
  if (data.mayors?.currentTermChange) parts.push("i l'alcaldia ha canviat a mig mandat");
  return `${parts.join(", ")}.`;
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

export function renderRadiografia(data: RadiografiaData, mapa: readonly PuntMapa[] = []): string {
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

  /** La foto de l'alcaldia, si l'ajuntament la publica i en té de tot el ple. */
  const mayorPhoto =
    data.carrecs?.cobertura === "completa"
      ? data.carrecs.carrecs.find((c) => /alcald/i.test(c.carrec))?.foto ?? null
      : null;
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
  ${summarySentence(data) ? `<p class="resum">${summarySentence(data)}</p>` : ""}
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
  ${data.revenue ? '<a href="#diners">Els diners</a>' : ""}
  ${data.services ? '<a href="#serveis">Serveis</a>' : ""}
  ${data.finances ? '<a href="#com-queda">Com queda</a>' : ""}
  ${data.finances ? '<a href="#comptes">Comptes</a>' : ""}
  <a href="#dades">Què en sabem</a>
  <a href="#joc">El 23-M</a>
  <a href="#anar">Segueix estirant</a>
</nav>

${government ? `<section class="banda banda-qui-mana" style="--partit:${mayorColor}">
  <div class="cos">
    <h2>Qui mana</h2>
    <div class="alcaldia-cap">
      ${mayorPhoto ? `<img class="retrat-alcaldia" src="${escape(mayorPhoto)}" alt="" width="112" height="112">` : ""}
      <div>
        <p class="titular">
          ${government.mayorName ? `<b>${escape(government.mayorName)}</b>` : "Alcaldia no identificada"}
        </p>
        ${government.mayorSigles ? `<p class="sigles-alcaldia"><span class="marca-partit"></span>${escape(government.mayorSigles)}</p>` : ""}
      </div>
    </div>
    ${
      government.winnerGoverns === null
        ? `<p class="nota">No hem pogut lligar el partit de l'alcaldia amb cap llista del 2023. Ho tenim marcat per revisar.</p>`
        : government.winnerGoverns
          ? `<p class="veredicte bo">La llista més votada governa.</p>
             <p class="nota">${escape(government.winnerSigles)} va treure ${government.winnerSeats} de ${totalSeats} regidories${government.winnerHasMajority ? ", prou per governar sola" : ", per sota de la majoria absoluta"}.</p>`
          : `<p class="veredicte pacte">Governa una llista que no va guanyar.</p>
             <p class="nota">La més votada va ser ${escape(government.winnerSigles)} amb ${government.winnerSeats} regidories; l'alcaldia és de ${escape(government.mayorSigles ?? "?")}, amb ${government.mayorSeats ?? "?"}. Vol dir que hi va haver pacte.</p>`
    }
    ${
      change
        ? `<p class="avis"><b>Hi ha hagut canvi d'alcaldia a mig mandat.</b>
             ${escape(change.mayors[change.mayors.length - 1]!.name)} va prendre possessió el
             ${formatDate(change.mayors[change.mayors.length - 1]!.tookOfficeOn)}${change.daysIntoTerm ? `, ${Math.round(change.daysIntoTerm / 30)} mesos després de la constitució del ple` : ""}.
             ${change.onlySuccessorKnown ? "La font oberta només desa qui hi ha ara, així que no en podem dir el motiu." : ""}</p>`
        : ""
    }
    ${mayorPhoto ? `<p class="credit-foto">Fotografia publicada per l'ajuntament a la seva seu electrònica.</p>` : ""}
    ${data.singleList ? `<p class="avis"><b>Al ple hi ha una sola candidatura.</b>
      El Síndic de Greuges compta aquest ajuntament entre els que no tenen oposició.</p>` : ""}
    ${government.mayorMatchConfidence !== null && government.mayorMatchConfidence < 0.8
      ? `<p class="nota feble">L'aparellament entre l'alcaldia i la seva llista és feble (mètode «${escape(government.mayorMatchMethod ?? "")}»). Cal revisar-lo a mà.</p>`
      : ""}
  </div>
</section>` : ""}

${data.finances && data.finances.mandates.length > 0 && renderMandate(data.finances, Boolean(data.mayors?.currentTermChange)) ? `<section class="bloc" id="balanc">
  <h2>El balanç del mandat</h2>
  ${renderMandate(data.finances, Boolean(data.mayors?.currentTermChange))}
</section>` : ""}

${current ? `<section class="bloc" id="ple">
  <h2>El ple del mandat 2023-2027</h2>
  ${renderHemicycle(current.candidatures, totalSeats, majority)}
  ${renderLegend(current.candidatures, (sigles) => slugify(sigles))}
  <p class="nota">Partits efectius al ple: ${government ? government.effectiveParties.toString().replace(".", ",") : "—"}.
  És una mesura de fragmentació: 1 vol dir un ple d'un sol color; ${totalSeats}, un de tan repartit com sigui possible.</p>
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

${data.revenue ? `<section class="bloc" id="diners">
  <h2>D'on surten els diners</h2>
  ${renderRevenue(data.revenue)}
</section>` : ""}

${data.spending ? `<section class="bloc">
  <h2>On van els diners</h2>
  ${renderSpending(data.spending)}
</section>` : ""}

${data.services ? `<section class="bloc" id="serveis">
  <h2>Què costa cada servei</h2>
  ${renderServices(data.services)}
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
    <li><a href="../../comparador/?m=${escape(m.slug)}">
      <b>Compara'l</b><span>Posa ${escape(m.name)} al costat de fins a tres municipis més</span></a></li>
    <li><a href="../../els947.html">
      <b>Els 947</b><span>Tots els municipis de Catalunya, amb cercador i filtres</span></a></li>
    <li><a href="../../dades/m/${escape(m.slug)}.csv" download>
      <b>Baixa't les dades</b><span>Tot el que hi ha en aquesta pàgina, en CSV. També en
      <a href="../../dades/m/${escape(m.slug)}.json">JSON</a> i amb l'<a href="../../dades/">esquema documentat</a></span></a></li>
  </ul>
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
