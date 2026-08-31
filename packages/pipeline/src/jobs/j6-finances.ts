import { municipalFinances, municipalities, type Db } from "@quivoto/db";
import { ckanSql } from "../adapters/aoc";
import { withRun } from "../lib/run";

/**
 * J6 — els comptes dels 947 ajuntaments.
 *
 * Quatre fonts obertes del Consorci AOC, totes amb cobertura completa i sèrie
 * llarga: la liquidació pressupostària per capítols des del 2010, el deute viu
 * des del 2010, el període mitjà de pagament a proveïdors des del juny del 2018
 * i el padró des del 2009.
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

/**
 * Des d'on ingerim. **El límit el posa la font, no nosaltres.**
 *
 * Fins ara aquí hi deia 2015 «perquè dos mandats sencers enrere és prou
 * context», i era una decisió nostra que amagava mitja sèrie. Comprovat contra
 * el portal, conjunt per conjunt:
 *
 *   · Liquidació (81f18313): del 2008 al 2025, però el 2008 només hi ha 2 ens i
 *     el 2009 n'hi ha 6 —soroll, no una sèrie—. El primer any de debò és el
 *     **2010**, amb 1.195 ens i 16.182 files, i d'allà endavant no baixa de
 *     1.200 fins al 2025 (1.074 ens: exercici encara a mig liquidar).
 *   · Deute viu (34db8dc5): del **2010** al 2025, entre 982 i 1.002 ens cada
 *     any. Sèrie completa, sense cap forat. Reverificat el 31-08-2026 amb un
 *     `GROUP BY "ANY"`: el primer any del conjunt és el 2010, amb 994 ens.
 *
 * ─── Per què el deute no s'allarga al 2008-2009 ─────────────────────────────
 * Hisenda sí que publica «deuda viva» per ajuntament del 2008 i el 2009
 * (comprovat el 31-08-2026: `deuda_aytos_2008_con_poblacion.xls` i
 * `deuda_aytos_2009.xls` a hacienda.gob.es, fulls de càlcul solts identificats
 * per nom i codi INE, no per CODI_ENS). Però el conjunt de l'AOC que és la
 * font d'aquesta feina comença el 2010, i empalmar-hi dos anys d'un altre
 * editor voldria dir un adaptador nou d'XLS, un creuament d'ens diferent i cap
 * garantia que aquelles primeres fotos comptin els mateixos ens que la sèrie
 * (982-1.002 cada any des del 2010). Dos anys més no valen una sèrie amb dues
 * vares de mesurar: el deute es queda començant el 2010, i si l'AOC un dia hi
 * afegeix el 2008-2009, entraran sols per `FROM_YEAR`... que llavors caldrà
 * abaixar expressament.
 *   · Padró (e0be5678): del **2009** al 2026, 946-948 ens cada any. Comença un
 *     any abans que la liquidació, però un padró sense comptes al costat no
 *     serveix per a cap «per habitant», i per això arrenquem tots alhora.
 *   · PMP (eecca986): la primera mesura és del **30 de juny del 2018**. Aquí el
 *     límit sí que és de la font, i cap valor de FROM_YEAR no el mourà.
 *
 * O sigui que 2010 és el terra real d'aquesta feina, i el PMP arrenca vuit anys
 * més tard que la resta.
 *
 * ─── El que això costa ──────────────────────────────────────────────────────
 * La liquidació es demana any per any (vegeu més avall el sostre de CKAN):
 * passar del 2015 al 2010 són **cinc consultes més**, no cinc-centes. La
 * consulta més gruixuda de tota la sèrie nova és la del 2012, amb 20.730 files,
 * que continua ben lluny del sostre de 32.000. El deute i el padró es demanen
 * d'una sola consulta cadascun i no n'afegeixen cap.
 */
const FROM_YEAR = 2010;

/**
 * Últim exercici de liquidació que demanem. El padró i el deute no en porten,
 * de sostre: el padró ja publica el 2026 i entra sol, cosa que crea una fila
 * d'any amb població i sense comptes. És un forat de debò —aquell exercici
 * encara no s'ha liquidat— i qui dibuixa la despesa ja el descarta perquè el
 * total per habitant no és positiu.
 */
const TO_YEAR = 2025;

/**
 * Primera mesura de període mitjà de pagament que publica el conjunt:
 * 2018-06-30. No és una tria nostra i no es pot allargar.
 */
const PMP_DES_DE = 2018;

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
      /**
       * El repartiment per capítols és **el mateix del 2010 al 2025**: els dos
       * tipus de partida i els nou capítols hi són tots els anys. L'única cosa
       * que canvia és que el capítol 5 de despesa —el fons de contingència, que
       * va crear la Llei orgànica 2/2012 d'estabilitat pressupostària— no surt
       * cap any abans del 2013 (0 files el 2012, 111 el 2013, 368 el 2015). No
       * el fem servir per a res, o sigui que cap dels totals d'aquí sota no en
       * depèn i la sèrie es pot llegir sencera.
       */
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
      if (!Number.isFinite(year) || year < PMP_DES_DE) continue;
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
