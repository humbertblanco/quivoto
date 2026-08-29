import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Traça de cada execució d'ingesta. Sense això no es pot respondre la pregunta
 * que ens faran tard o d'hora: «d'on has tret aquesta dada i quan».
 */
export const ingestRuns = pgTable("ingest_runs", {
  id: serial("id").primaryKey(),
  /** J1 · J2 · J3 · J4 · derive:* */
  job: text("job").notNull(),
  status: text("status").notNull().default("running"),
  rowsIn: integer("rows_in").notNull().default(0),
  rowsOut: integer("rows_out").notNull().default(0),
  issues: integer("issues").notNull().default(0),
  summary: jsonb("summary").notNull().default(sql`'{}'::jsonb`),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});
