import { asc, eq } from "drizzle-orm";
import { mayors, municipalFinances, municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { MANDATES, mandateBands, readMandate, toYearPoint } from "./mandate";
import { buildPeerGroups, medianOf, percentileOf } from "./peers";
import { withRun } from "../lib/run";

/**
 * Semàfor financer municipal.
 *
 * Vuit indicadors calculats sempre igual per als 947 ajuntaments, a partir de la
 * liquidació pressupostària, el deute viu i el període de pagament. Els llindars
 * no els hem triat a ull: surten dels percentils reals de tot Catalunya i, quan
 * n'hi ha, de la llei —l'estalvi net negatiu obliga a un pla de sanejament i el
 * deute per sobre del 110% dels ingressos corrents és una alerta legal.
 *
 * Cap indicador és un judici sobre el govern. Diuen com estan els comptes, no si
 * algú ho ha fet bé o malament, i la fitxa pública ho ha de dir així.
 */

export type Level = "bo" | "avis" | "alerta" | "sense-dades";

export type Indicator = {
  key: string;
  label: string;
  /** Valor ja normalitzat; `null` quan no es pot calcular. */
  value: number | null;
  unit: "percent" | "euros" | "dies";
  level: Level;
  /** Frase curta que explica el número sense tecnicismes. */
  note: string;
};

const pct = (numerator: number, denominator: number): number | null =>
  denominator === 0 ? null : Math.round((10_000 * numerator) / denominator) / 100;

/** Llindars: percentils de tot Catalunya (2024) i límits legals. */
export function computeIndicators(row: typeof municipalFinances.$inferSelect): Indicator[] {
  const n = (value: string | null): number => (value === null ? 0 : Number(value));
  const incomeCurrent = n(row.incomeCurrent);
  const incomeCapital = n(row.incomeCapital);
  const personnel = n(row.expensePersonnel);
  const goods = n(row.expenseGoods);
  const interest = n(row.expenseInterest);
  const transfers = n(row.expenseTransfers);
  const investment = n(row.expenseInvestment);
  const capitalTransfers = n(row.expenseCapitalTransfers);
  const repayment = n(row.expenseDebtRepayment);
  const debt = row.debt === null ? null : Number(row.debt);
  const population = row.population ?? 0;

  const grossSaving = incomeCurrent - personnel - goods - transfers;
  const netSaving = grossSaving - repayment;
  const nonFinancialBalance =
    incomeCurrent + incomeCapital - personnel - goods - interest - transfers - investment - capitalTransfers;

  const debtPerHead = debt === null || population === 0 ? null : Math.round(debt / population);
  const debtOverIncome = debt === null ? null : pct(debt, incomeCurrent);
  const investmentExecution = pct(investment, n(row.investmentBudget));

  const level = (value: number | null, warn: number, alert: number, lowerIsBetter = false): Level => {
    if (value === null) return "sense-dades";
    if (lowerIsBetter) return value >= alert ? "alerta" : value >= warn ? "avis" : "bo";
    return value <= alert ? "alerta" : value <= warn ? "avis" : "bo";
  };

  return [
    {
      key: "estalvi-net", label: "Estalvi net", value: pct(netSaving, incomeCurrent), unit: "percent",
      level: pct(netSaving, incomeCurrent) === null ? "sense-dades" : netSaving < 0 ? "alerta" : level(pct(netSaving, incomeCurrent), 5, 0),
      note: netSaving < 0
        ? "Els ingressos corrents no cobreixen les despeses corrents ni el deute que toca tornar. La llei obliga a fer un pla de sanejament."
        : "El que sobra dels ingressos corrents un cop pagat el dia a dia i el deute que toca tornar.",
    },
    {
      key: "estalvi-brut", label: "Estalvi brut", value: pct(grossSaving, incomeCurrent), unit: "percent",
      level: level(pct(grossSaving, incomeCurrent), 8, 0),
      note: "El que sobra dels ingressos corrents un cop pagat el funcionament ordinari. La mediana catalana és el 15 %.",
    },
    {
      key: "deute-habitant", label: "Deute per habitant", value: debtPerHead, unit: "euros",
      level: level(debtPerHead, 300, 582, true),
      note: "Deute viu a 31 de desembre dividit pel padró. La meitat dels municipis catalans està per sota de 4 €; 400 no en tenen gens.",
    },
    {
      key: "deute-ingressos", label: "Deute sobre ingressos corrents", value: debtOverIncome, unit: "percent",
      level: level(debtOverIncome, 75, 110, true),
      note: "Per sobre del 110 % la llei no permet endeutar-se més sense autorització.",
    },
    {
      key: "saldo-no-financer", label: "Saldo no financer", value: pct(nonFinancialBalance, incomeCurrent), unit: "percent",
      level: level(pct(nonFinancialBalance, incomeCurrent), 3, 0),
      note: "Tots els ingressos menys totes les despeses, sense comptar-hi el deute. Negatiu dos anys seguits és un avís.",
    },
    {
      key: "carrega-financera", label: "Càrrega financera", value: pct(interest + repayment, incomeCurrent), unit: "percent",
      level: level(pct(interest + repayment, incomeCurrent), 5, 8.4, true),
      note: "Part dels ingressos corrents que se'n va en interessos i en tornar deute.",
    },
    {
      key: "execucio-inversions", label: "Inversions executades", value: investmentExecution, unit: "percent",
      level: level(investmentExecution, 35, 29),
      note: "Del que es va pressupostar per invertir, quant es va gastar de veritat. La mediana catalana és el 45 %.",
    },
    {
      key: "pmp", label: "Dies per pagar els proveïdors", value: row.paymentDays, unit: "dies",
      level: level(row.paymentDays, 30, 60, true),
      note: "Per sobre de 30 dies és un incompliment; per sobre de 60, greu. La mediana catalana és de 18 dies.",
    },
  ];
}

/**
 * Indicadors que es comparen amb el grup de municipis de la mateixa mida, i en
 * quina direcció és millor. Codificat a mà i no deduït del signe: al deute,
 * menys és millor; a l'estalvi, més. Confondre-ho seria pitjor que no comparar.
 */
/**
 * Els quatre indicadors que es comparen amb el grup.
 *
 * N'hi havia vuit, i quatre eren repeticions. Sobre els 947 municipis, el deute
 * per habitant i el deute sobre ingressos corrents correlacionen a 0,98: són la
 * mateixa barra dues vegades. L'estalvi brut i el net, a 0,86. La conseqüència
 * no era només soroll: un municipi endeutat cobrava tres barres vermelles pel
 * mateix fet i el comptador de «va endarrerit en N indicadors» sortia inflat
 * —a 209 dels 947, els tres indicadors de deute donaven el mateix veredicte
 * extrem alhora.
 *
 * Es queden els quatre que diuen coses diferents: l'estalvi net (que és el que
 * té conseqüència legal, perquè si és negatiu obliga a un pla de sanejament),
 * el deute per habitant, l'execució d'inversions i els dies per pagar —aquests
 * dos últims són els únics genuïnament independents de la resta.
 */
const PEER_INDICATORS: ReadonlyArray<{ key: string; lowerIsBetter: boolean }> = [
  { key: "estalvi-net", lowerIsBetter: false },
  { key: "deute-habitant", lowerIsBetter: true },
  { key: "execucio-inversions", lowerIsBetter: false },
  { key: "pmp", lowerIsBetter: true },
];
/** Per sota d'aquest nombre de companys, un percentil promet una precisió que no hi és. */
const MIN_FOR_PERCENTILE = 30;

export async function deriveFinances(db: Db): Promise<void> {
  await withRun(db, "derive: semàfor financer i balanç de mandat", async (run) => {
    const rows = await db.select().from(municipalFinances);
    run.rowsIn = rows.length;

    // Grups de comparació: un percentil contra tot Catalunya barreja Barcelona
    // amb pobles de tres-cents habitants i no vol dir res.
    const peers = buildPeerGroups(
      (await db.select({ id: municipalities.id, population: municipalities.population }).from(municipalities)),
    );

    // Alcaldies, per poder dir de qui és cada tram de la sèrie.
    const mayorsByMunicipality = new Map<number, { term: string; name: string; partyRaw: string | null }[]>();
    for (const m of await db.select().from(mayors).orderBy(asc(mayors.term))) {
      const list = mayorsByMunicipality.get(m.municipalityId) ?? [];
      list.push({ term: m.term, name: m.name, partyRaw: m.partyRaw });
      mayorsByMunicipality.set(m.municipalityId, list);
    }

    const byMunicipality = new Map<number, typeof rows>();
    for (const row of rows) {
      const list = byMunicipality.get(row.municipalityId);
      if (list) list.push(row);
      else byMunicipality.set(row.municipalityId, [row]);
    }

    // Primer passada: calculem els indicadors de tothom per poder-ne treure
    // els percentils de cada grup. Sense aquesta passada prèvia no hi ha
    // comparació possible.
    const latestByMunicipality = new Map<number, ReturnType<typeof computeIndicators>>();
    for (const [municipalityId, list] of byMunicipality) {
      const withData = list.filter((r) => Number(r.incomeCurrent ?? 0) > 0).sort((a, b) => b.year - a.year);
      if (withData[0]) latestByMunicipality.set(municipalityId, computeIndicators(withData[0]));
    }

    /** Valors d'un indicador dins d'un grup, per treure'n percentil i mediana. */
    const groupValues = new Map<string, number[]>();
    for (const [municipalityId, indicators] of latestByMunicipality) {
      const group = peers.get(municipalityId);
      if (!group) continue;
      for (const indicator of indicators) {
        if (indicator.value === null) continue;
        const key = `${group.key}|${indicator.key}`;
        const list = groupValues.get(key) ?? [];
        list.push(indicator.value);
        groupValues.set(key, list);
      }
    }

    let alerts = 0;
    for (const [municipalityId, list] of byMunicipality) {
      // L'últim any amb liquidació de veritat: els més recents encara són buits.
      const withData = list
        .filter((r) => Number(r.incomeCurrent ?? 0) > 0)
        .sort((a, b) => b.year - a.year);
      const latest = withData[0];
      if (!latest) continue;

      const indicators = computeIndicators(latest);
      if (indicators.some((i) => i.level === "alerta")) alerts += 1;

      // Comparació amb els municipis de la mateixa mida.
      const group = peers.get(municipalityId);
      const comparison = group
        ? PEER_INDICATORS.map(({ key, lowerIsBetter }) => {
            const indicator = indicators.find((i) => i.key === key);
            const values = groupValues.get(`${group.key}|${key}`) ?? [];
            if (!indicator || indicator.value === null || values.length === 0) return null;
            // Distribucions amb terra: 400 municipis tenen zero deute, i dir que
            // tots són el percentil 0 enganya. Quan el terra és massa poblat,
            // la frase ha de ser una altra i el percentil no es publica.
            const floorShare = values.filter((v) => v === Math.min(...values)).length / values.length;
            return {
              key,
              value: indicator.value,
              lowerIsBetter,
              groupLabel: group.label,
              groupSize: values.length,
              median: medianOf(values),
              percentile: values.length >= MIN_FOR_PERCENTILE && floorShare <= 0.25
                ? percentileOf(indicator.value, values)
                : null,
              rank: values.length < MIN_FOR_PERCENTILE
                ? [...values].sort((a, b) => (lowerIsBetter ? a - b : b - a)).indexOf(indicator.value) + 1
                : null,
              floorShare: floorShare > 0.25 ? Math.round(100 * floorShare) : null,
            };
          }).filter(Boolean)
        : [];

      // El balanç del mandat: com els van trobar i com els deixen.
      //
      // Només els exercicis **liquidats**. Les files dels anys en curs porten
      // padró i període de pagament però cap liquidació, i colar-les faria dir
      // que la inversió ha caigut a zero quan el que passa és que encara no
      // s'ha tancat l'exercici.
      const points = [...list]
        .filter((r) => Number(r.incomeCurrent ?? 0) > 0)
        .sort((a, b) => a.year - b.year)
        .map(toYearPoint);
      const readings = MANDATES.map((m) => readMandate(points, m)).filter(Boolean);
      const bands = mandateBands(points.map((p) => p.year), mayorsByMunicipality.get(municipalityId) ?? []);

      // Sèrie de deute per habitant: el gràfic que diu si puja o baixa.
      const debtSeries = [...list]
        .filter((r) => r.debt !== null && (r.population ?? 0) > 0)
        .sort((a, b) => a.year - b.year)
        .map((r) => ({ year: r.year, perHead: Math.round(Number(r.debt) / (r.population ?? 1)) }));

      await db
        .insert(municipalityMetrics)
        .values({
          municipalityId,
          kind: "finances",
          data: {
            year: latest.year, indicators, debtSeries, comparison, points, mandates: readings, bands,
            incomeCurrent: Number(latest.incomeCurrent ?? 0), population: latest.population,
            group: group ? { label: group.label, size: group.size } : null,
          },
        })
        .onConflictDoUpdate({
          target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
          set: {
            data: {
              year: latest.year, indicators, debtSeries, comparison, points, mandates: readings, bands,
              incomeCurrent: Number(latest.incomeCurrent ?? 0), population: latest.population,
              group: group ? { label: group.label, size: group.size } : null,
            },
            computedAt: new Date(),
          },
        });
      run.rowsOut += 1;
    }

    const grups = new Set([...peers.values()].map((g) => g.label));
    run.say(`${run.rowsOut} municipis amb semàfor · ${alerts} amb almenys un indicador en alerta`);
    run.say(`${grups.size} grups de comparació: ${[...grups].join(" · ")}`);
    return { municipis: run.rowsOut, amb_alerta: alerts, grups: [...grups] };
  });
}
