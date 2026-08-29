import { municipalFinances } from "@quivoto/db";

/**
 * La lectura de mandat: com els van trobar i com els deixen.
 *
 * Fins ara la fitxa publicava una fotografia d'un sol any tot i tenir la sèrie
 * sencera del 2015 al 2025 desada. Amb una fotografia es pot dir com estan els
 * comptes, però no **què ha fet aquest govern**, que és l'única pregunta que
 * importa a quatre mesos d'unes eleccions.
 *
 * Dues cauteles que no es poden saltar:
 *   · Del mandat en curs només hi ha dos exercicis liquidats. Es diu, no
 *     s'amaga, i la xifra va sempre amb «de X dels 4 exercicis».
 *   · Si l'alcaldia ha canviat a mig mandat, la frase no pot dir «aquest
 *     alcalde»: parla del govern, no de la persona.
 */

export type Finance = typeof municipalFinances.$inferSelect;

/** Mandats municipals, amb els exercicis que se'ls poden atribuir. */
export const MANDATES: ReadonlyArray<{ id: string; from: number; to: number; label: string }> = [
  { id: "2023-2027", from: 2023, to: 2027, label: "mandat 2023-2027" },
  { id: "2019-2023", from: 2019, to: 2023, label: "mandat 2019-2023" },
  { id: "2015-2019", from: 2015, to: 2019, label: "mandat 2015-2019" },
];

const n = (value: string | null): number => (value === null ? 0 : Number(value));

/** Indicadors que es poden seguir any a any i que expliquen una gestió. */
export type YearPoint = {
  year: number;
  debtPerHead: number | null;
  netSavingPct: number | null;
  financialLoadPct: number | null;
  investmentPerHead: number | null;
  investmentExecutionPct: number | null;
  personnelPct: number | null;
  paymentDays: number | null;
  /** Euros pressupostats per invertir i no gastats aquell any. */
  investmentUnspent: number | null;
};

export function toYearPoint(row: Finance): YearPoint {
  const incomeCurrent = n(row.incomeCurrent);
  const personnel = n(row.expensePersonnel);
  const goods = n(row.expenseGoods);
  const interest = n(row.expenseInterest);
  const transfers = n(row.expenseTransfers);
  const investment = n(row.expenseInvestment);
  const repayment = n(row.expenseDebtRepayment);
  const budget = n(row.investmentBudget);
  const population = row.population ?? 0;
  const debt = row.debt === null ? null : Number(row.debt);

  const pct = (part: number): number | null =>
    incomeCurrent === 0 ? null : Math.round((10_000 * part) / incomeCurrent) / 100;

  return {
    year: row.year,
    debtPerHead: debt === null || population === 0 ? null : Math.round(debt / population),
    netSavingPct: pct(incomeCurrent - personnel - goods - transfers - repayment),
    financialLoadPct: pct(interest + repayment),
    investmentPerHead: population === 0 ? null : Math.round(investment / population),
    investmentExecutionPct: budget === 0 ? null : Math.round((10_000 * investment) / budget) / 100,
    personnelPct: pct(personnel),
    paymentDays: row.paymentDays,
    investmentUnspent: budget === 0 ? null : Math.max(0, Math.round(budget - investment)),
  };
}

export type MandateReading = {
  id: string;
  label: string;
  /** Exercicis liquidats que hem pogut atribuir a aquest mandat. */
  years: number[];
  /** Quants n'hi hauria d'haver: serveix per dir «2 dels 4». */
  expected: number;
  first: YearPoint | null;
  last: YearPoint | null;
  /** Variació entre el primer i l'últim exercici del mandat. */
  delta: Partial<Record<keyof YearPoint, number | null>>;
  /** Euros pressupostats per invertir i no gastats en tot el mandat. */
  investmentUnspentTotal: number | null;
};

const TRACKED: (keyof YearPoint)[] = [
  "debtPerHead", "netSavingPct", "financialLoadPct",
  "investmentPerHead", "investmentExecutionPct", "personnelPct", "paymentDays",
];

/**
 * Els exercicis d'un mandat. El primer any n'és la línia de base —el pressupost
 * encara és en bona part del govern anterior— i per això s'hi inclou: sense ell
 * no es pot dir «com els van trobar».
 */
export function readMandate(
  points: readonly YearPoint[],
  mandate: (typeof MANDATES)[number],
): MandateReading | null {
  const inside = points
    .filter((p) => p.year >= mandate.from && p.year <= mandate.to)
    .sort((a, b) => a.year - b.year);
  if (inside.length === 0) return null;

  const first = inside[0]!;
  const last = inside[inside.length - 1]!;

  const delta: MandateReading["delta"] = {};
  for (const key of TRACKED) {
    const a = first[key];
    const b = last[key];
    delta[key] = typeof a === "number" && typeof b === "number" ? Math.round((b - a) * 100) / 100 : null;
  }

  const unspent = inside
    .map((p) => p.investmentUnspent)
    .filter((v): v is number => v !== null);

  return {
    id: mandate.id,
    label: mandate.label,
    years: inside.map((p) => p.year),
    expected: mandate.to - mandate.from,
    first,
    last,
    delta,
    investmentUnspentTotal: unspent.length === 0 ? null : unspent.reduce((a, b) => a + b, 0),
  };
}

/**
 * Bandes de mandat per als gràfics de sèrie: cada tram d'anys amb qui manava.
 * És el gest que converteix una estadística en una rendició de comptes, i sense
 * ell una línia que puja no és de ningú.
 */
export type MandateBand = { id: string; from: number; to: number; mayor: string | null; party: string | null };

export function mandateBands(
  years: readonly number[],
  mayors: readonly { term: string; name: string; partyRaw: string | null }[],
): MandateBand[] {
  if (years.length === 0) return [];
  const min = Math.min(...years);
  const max = Math.max(...years);
  return MANDATES.filter((m) => m.to >= min && m.from <= max)
    .map((m) => {
      // Si al mandat hi ha hagut més d'una alcaldia, no en triem cap: la banda
      // és del govern, i dir-hi un sol nom seria atribuir malament.
      const own = mayors.filter((x) => x.term === m.id);
      const single = own.length === 1 ? own[0]! : null;
      return {
        id: m.id,
        from: Math.max(m.from, min),
        to: Math.min(m.to, max),
        mayor: single?.name ?? null,
        party: single?.partyRaw ?? own[0]?.partyRaw ?? null,
      };
    })
    .sort((a, b) => a.from - b.from);
}
