import { municipalFinances, municipalities, type Db } from "@quivoto/db";
import { ckanSql } from "../adapters/aoc";
import { withRun } from "../lib/run";

/**
 * J6 — els comptes dels 947 ajuntaments.
 *
 * Quatre fonts obertes del Consorci AOC, totes amb cobertura completa i sèrie
 * llarga: la liquidació pressupostària per capítols des del 2011, el deute viu
 * des del 2010, el període mitjà de pagament a proveïdors i el padró.
 *
 * Amb això es pot dir, amb la mateixa vara per a tothom, si un ajuntament
 * estalvia o es descapitalitza, si el deute puja o baixa, si executa les
 * inversions que pressuposta i si paga els proveïdors a temps. És la informació
 * que la brúixola noruega posa a la fitxa de cada municipi i que aquí no publica
 * ningú de manera comparable.
 */

const LIQUIDACIO = "81f18313-547f-4c87-adbd-c6ce873cb406";
const DEUTE = "34db8dc5-ad5e-4bf0-83cc-537cd8671342";
const PMP = "eecca986-a51b-4b0e-a03b-6fc8bb71d387";
const PADRO = "e0be5678-0bdd-48e0-99af-05cd5404a9a5";

/** Des d'on ingerim. Dos mandats sencers enrere és prou context. */
const FROM_YEAR = 2015;
const TO_YEAR = 2025;

type Row = Record<string, string | number | null>;

const num = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export async function j6Finances(db: Db): Promise<void> {
  await withRun(db, "J6 comptes municipals", async (run) => {
    // `CODI_ENS` arriba com a enter i perd el zero inicial de la província de
    // Barcelona; el padegem per poder-lo creuar amb el nostre territori.
    const byCodiEns = new Map<string, number>();
    for (const m of await db.select().from(municipalities)) byCodiEns.set(m.codiEns, m.id);
    const resolve = (codi: unknown): number | undefined =>
      byCodiEns.get(String(codi).padStart(10, "0"));

    type Bucket = {
      incomeCurrent: number; incomeCapital: number;
      expensePersonnel: number; expenseGoods: number; expenseInterest: number;
      expenseTransfers: number; expenseInvestment: number; expenseCapitalTransfers: number;
      expenseDebtRepayment: number; investmentBudget: number;
      debt: number | null; paymentDays: number | null; population: number | null;
    };
    const empty = (): Bucket => ({
      incomeCurrent: 0, incomeCapital: 0, expensePersonnel: 0, expenseGoods: 0,
      expenseInterest: 0, expenseTransfers: 0, expenseInvestment: 0,
      expenseCapitalTransfers: 0, expenseDebtRepayment: 0, investmentBudget: 0,
      debt: null, paymentDays: null, population: null,
    });
    const data = new Map<string, Bucket>();
    const at = (municipalityId: number, year: number): Bucket => {
      const key = `${municipalityId}|${year}`;
      const existing = data.get(key);
      if (existing) return existing;
      const created = empty();
      data.set(key, created);
      return created;
    };

    // --- liquidació, any per any ---
    // CKAN talla les respostes a 32.000 files sense avisar: una consulta única de
    // tota la sèrie tornava incompleta i deixava 700 municipis sense comptes.
    // Per anys, cap consulta no s'hi acosta.
    const liquidacio: Row[] = [];
    for (let year = FROM_YEAR; year <= TO_YEAR; year += 1) {
      const rows = await ckanSql<Row>(
        `SELECT "CODI_ENS", "ANY_EXERCICI", "TIPUS_PARTIDA", "CODI_CAPITOL",
                SUM("IMPORT_LIQUIDAT") AS liquidat, SUM("IMPORT_PRESSU_FINAL") AS pressupostat
         FROM "${LIQUIDACIO}" WHERE "ANY_EXERCICI" = ${year}
         GROUP BY "CODI_ENS", "ANY_EXERCICI", "TIPUS_PARTIDA", "CODI_CAPITOL"`,
      );
      if (rows.length >= 31_900) {
        await run.issue({
          kind: "ckan_row_cap",
          severity: "alta",
          entity: `liquidació ${year}`,
          detail: { files: rows.length, nota: "consulta a tocar del sostre de CKAN: cal partir-la més" },
        });
      }
      liquidacio.push(...rows);
    }
    run.rowsIn += liquidacio.length;
    run.say(`${liquidacio.length} files de liquidació, del ${FROM_YEAR} al ${TO_YEAR}`);

    for (const row of liquidacio) {
      const municipalityId = resolve(row.CODI_ENS);
      if (!municipalityId) continue;
      const bucket = at(municipalityId, num(row.ANY_EXERCICI));
      const chapter = num(row.CODI_CAPITOL);
      const amount = num(row.liquidat);
      if (String(row.TIPUS_PARTIDA).toUpperCase() === "I") {
        if (chapter <= 5) bucket.incomeCurrent += amount;
        else if (chapter <= 7) bucket.incomeCapital += amount;
        continue;
      }
      if (chapter === 1) bucket.expensePersonnel += amount;
      else if (chapter === 2) bucket.expenseGoods += amount;
      else if (chapter === 3) bucket.expenseInterest += amount;
      else if (chapter === 4) bucket.expenseTransfers += amount;
      else if (chapter === 6) { bucket.expenseInvestment += amount; bucket.investmentBudget += num(row.pressupostat); }
      else if (chapter === 7) bucket.expenseCapitalTransfers += amount;
      else if (chapter === 9) bucket.expenseDebtRepayment += amount;
    }

    // --- deute viu ---
    const deute = await ckanSql<Row>(
      `SELECT "CODI_ENS", "ANY", "DEUTE_VIU" FROM "${DEUTE}" WHERE "ANY" >= ${FROM_YEAR}`,
    );
    run.rowsIn += deute.length;
    for (const row of deute) {
      const municipalityId = resolve(row.CODI_ENS);
      if (!municipalityId) continue;
      at(municipalityId, num(row.ANY)).debt = num(row.DEUTE_VIU);
    }

    // --- padró: el denominador de tots els «per habitant» ---
    const padro = await ckanSql<Row>(
      `SELECT "CODI_ENS", "ANY", "TOTAL" FROM "${PADRO}" WHERE "ANY" >= ${FROM_YEAR}`,
    );
    run.rowsIn += padro.length;
    for (const row of padro) {
      const municipalityId = resolve(row.CODI_ENS);
      if (!municipalityId) continue;
      at(municipalityId, num(row.ANY)).population = num(row.TOTAL);
    }

    // --- període mitjà de pagament: una mesura per data, la resumim per any ---
    const pmp = await ckanSql<Row>(
      `SELECT "CODI_ENS", "DATA_ACTUALITZACIO", "PERIODE_MIG_PAGAMENT" FROM "${PMP}"`,
    );
    run.rowsIn += pmp.length;
    const pmpByYear = new Map<string, number[]>();
    for (const row of pmp) {
      const municipalityId = resolve(row.CODI_ENS);
      if (!municipalityId || !row.DATA_ACTUALITZACIO) continue;
      const year = Number(String(row.DATA_ACTUALITZACIO).slice(0, 4));
      if (!Number.isFinite(year) || year < FROM_YEAR) continue;
      const key = `${municipalityId}|${year}`;
      const list = pmpByYear.get(key);
      if (list) list.push(num(row.PERIODE_MIG_PAGAMENT));
      else pmpByYear.set(key, [num(row.PERIODE_MIG_PAGAMENT)]);
    }
    for (const [key, values] of pmpByYear) {
      const [municipalityId, year] = key.split("|").map(Number);
      at(municipalityId!, year!).paymentDays = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    }

    // --- desat ---
    for (const [key, bucket] of data) {
      const [municipalityId, year] = key.split("|").map(Number);
      const values = {
        municipalityId: municipalityId!,
        year: year!,
        incomeCurrent: String(Math.round(bucket.incomeCurrent)),
        incomeCapital: String(Math.round(bucket.incomeCapital)),
        expensePersonnel: String(Math.round(bucket.expensePersonnel)),
        expenseGoods: String(Math.round(bucket.expenseGoods)),
        expenseInterest: String(Math.round(bucket.expenseInterest)),
        expenseTransfers: String(Math.round(bucket.expenseTransfers)),
        expenseInvestment: String(Math.round(bucket.expenseInvestment)),
        expenseCapitalTransfers: String(Math.round(bucket.expenseCapitalTransfers)),
        expenseDebtRepayment: String(Math.round(bucket.expenseDebtRepayment)),
        investmentBudget: String(Math.round(bucket.investmentBudget)),
        debt: bucket.debt === null ? null : String(Math.round(bucket.debt)),
        paymentDays: bucket.paymentDays,
        population: bucket.population,
      };
      await db
        .insert(municipalFinances)
        .values(values)
        .onConflictDoUpdate({ target: [municipalFinances.municipalityId, municipalFinances.year], set: values });
      run.rowsOut += 1;
    }

    const years = new Set([...data.keys()].map((k) => Number(k.split("|")[1])));
    run.say(`${run.rowsOut} anys-municipi desats, del ${Math.min(...years)} al ${Math.max(...years)}`);
    return { anys_municipi: run.rowsOut };
  });
}
