import { sql } from "drizzle-orm";
import {
  boolean, date, index, integer, jsonb, numeric, pgTable, serial, text, timestamp, uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Els 947 municipis de Catalunya, amb els tres sistemes de codis que fem servir
 * per creuar fonts: INE de 5 xifres (electoral), Idescat de 6 (estadística) i
 * `codi_ens` de 10 (Generalitat i AOC). `INE5 = codi_ens[0:5]`.
 */
export const municipalities = pgTable(
  "municipalities",
  {
    id: serial("id").primaryKey(),
    ine5: text("ine5").notNull(),
    idescat6: text("idescat6"),
    codiEns: text("codi_ens").notNull(),
    slug: text("slug").notNull(),
    /** Nom del municipi, sense el prefix «Ajuntament de». */
    name: text("name").notNull(),
    comarca: text("comarca"),
    provincia: text("provincia"),
    population: integer("population"),
    populationYear: integer("population_year"),
    lat: numeric("lat"),
    lon: numeric("lon"),
    web: text("web"),
    email: text("email"),
    /** Alcalde o alcaldessa en actiu, tal com el publica la Generalitat. */
    mayorName: text("mayor_name"),
    /** Sigles del partit de l'alcaldia, en text lliure a l'origen. */
    mayorPartyRaw: text("mayor_party_raw"),
    /** Regidors que li toquen pel padró vigent (LOREG art. 179), calculat per nosaltres. */
    councilSeats: integer("council_seats"),
    /** planned · researching · pilot · published */
    status: text("status").notNull().default("planned"),
    priorityRank: integer("priority_rank"),
    /** Actes al feed obert de l'AOC des del juny del 2023, i data de l'última. */
    minutesCount: integer("minutes_count"),
    minutesLastDate: date("minutes_last_date"),
    /**
     * Sistema electoral del municipi. 178 municipis catalans no reparteixen els
     * escons per la llei d'Hondt: els de menys de 250 habitants voten llistes
     * obertes i uns quants funcionen en consell obert (LOREG art. 179.2 i 184).
     * Sense aquesta distinció, el nostre recompte hi falla sempre.
     */
    electoralSystem: text("electoral_system").notNull().default("llistes tancades"),
    /** Adaptador de plens: aoc · barcelona · terrassa · generic_html · videoacta · cap */
    minutesAdapter: text("minutes_adapter").notNull().default("aoc"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("municipalities_ine5_key").on(t.ine5),
    uniqueIndex("municipalities_codi_ens_key").on(t.codiEns),
    uniqueIndex("municipalities_slug_key").on(t.slug),
    index("municipalities_population_idx").on(t.population),
  ],
);

/**
 * Indicadors derivats per municipi: tot el que calculem nosaltres a partir de
 * les fonts obertes i que no publica ningú (pactes, transvasaments, paritat…).
 * Es guarda com a document perquè el conjunt d'indicadors encara creix.
 */
export const municipalityMetrics = pgTable(
  "municipality_metrics",
  {
    municipalityId: integer("municipality_id").notNull().references(() => municipalities.id, { onDelete: "cascade" }),
    /** Clau de l'indicador: `results`, `government`, `turnover`, `parity`… */
    kind: text("kind").notNull(),
    data: jsonb("data").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("municipality_metrics_key").on(t.municipalityId, t.kind)],
);

/**
 * Tot el que no quadra durant la ingesta. És la xarxa de seguretat del projecte:
 * cap dada entra al portal públic si té una incidència de gravetat alta oberta.
 */
export const dataIssues = pgTable(
  "data_issues",
  {
    id: serial("id").primaryKey(),
    /** seats_mismatch · brand_unmapped · orphan_councillor · missing_minutes … */
    kind: text("kind").notNull(),
    /** alta · mitjana · baixa */
    severity: text("severity").notNull().default("mitjana"),
    municipalityId: integer("municipality_id").references(() => municipalities.id, { onDelete: "cascade" }),
    entity: text("entity"),
    detail: jsonb("detail").notNull().default(sql`'{}'::jsonb`),
    resolved: boolean("resolved").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("data_issues_kind_idx").on(t.kind, t.resolved)],
);

/**
 * Comptes municipals: el que permet dir si un ajuntament està sanejat o ofegat,
 * amb la mateixa vara de mesurar per als 947. Ve del formulari normalitzat que
 * tots els ens trameten, i per això és comparable —cosa que les retribucions
 * dels càrrecs, per exemple, no són.
 *
 * Es desa un any per fila i els capítols en brut, no els indicadors ja calculats:
 * si demà volem canviar una fórmula o afegir-hi un indicador, no cal tornar a
 * baixar res.
 */
export const municipalFinances = pgTable(
  "municipal_finances",
  {
    municipalityId: integer("municipality_id").notNull().references(() => municipalities.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    /** Ingressos liquidats, capítols 1 a 5 (corrents) i 6 i 7 (de capital). */
    incomeCurrent: numeric("income_current"),
    incomeCapital: numeric("income_capital"),
    /** Despeses liquidades per capítol: 1 personal, 2 corrent, 3 interessos,
     *  4 transferències, 6 inversions, 7 transferències de capital, 9 amortització. */
    expensePersonnel: numeric("expense_personnel"),
    expenseGoods: numeric("expense_goods"),
    expenseInterest: numeric("expense_interest"),
    expenseTransfers: numeric("expense_transfers"),
    expenseInvestment: numeric("expense_investment"),
    expenseCapitalTransfers: numeric("expense_capital_transfers"),
    expenseDebtRepayment: numeric("expense_debt_repayment"),
    /** Pressupost final d'inversions, per calcular-ne el grau d'execució. */
    investmentBudget: numeric("investment_budget"),
    /** Deute viu a 31 de desembre. */
    debt: numeric("debt"),
    /** Període mitjà de pagament a proveïdors, en dies. */
    paymentDays: integer("payment_days"),
    population: integer("population"),
  },
  (t) => [uniqueIndex("municipal_finances_key").on(t.municipalityId, t.year)],
);
