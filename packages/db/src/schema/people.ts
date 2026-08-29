import {
  boolean, date, index, integer, pgTable, serial, text, timestamp, uniqueIndex,
} from "drizzle-orm/pg-core";
import { candidatures, councilTerms, politicalGroups } from "./elections";
import { municipalities } from "./territory";

/**
 * Persones: candidats i regidors. Una mateixa persona apareix a diverses
 * eleccions i municipis, sovint amb el nom escrit de maneres diferents, així que
 * en guardem una versió normalitzada per poder-les aparellar.
 */
export const people = pgTable(
  "people",
  {
    id: serial("id").primaryKey(),
    firstName: text("first_name"),
    lastName1: text("last_name1"),
    lastName2: text("last_name2"),
    fullName: text("full_name").notNull(),
    /** Minúscules, sense accents ni partícules: base de l'aparellament. */
    nameNormalized: text("name_normalized").notNull(),
    /** H · D, tal com ho publica el dataset de candidatures. */
    sex: text("sex"),
    /** Quan es descobreix que dues fitxes són la mateixa persona. */
    mergedIntoId: integer("merged_into_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("people_normalized_idx").on(t.nameNormalized)],
);

/** Presència d'una persona en una llista electoral. */
export const candidacies = pgTable(
  "candidacies",
  {
    id: serial("id").primaryKey(),
    candidatureId: integer("candidature_id").notNull().references(() => candidatures.id, { onDelete: "cascade" }),
    personId: integer("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
    listPosition: integer("list_position").notNull(),
    /** Cap de llista: l'alcaldable. */
    isHead: boolean("is_head").notNull().default(false),
    /** Titular · Suplent */
    kind: text("kind").notNull().default("Titular"),
    elected: boolean("elected").notNull().default(false),
    /** announced · proclaimed · withdrawn · elected */
    status: text("status").notNull().default("proclaimed"),
  },
  (t) => [uniqueIndex("candidacies_key").on(t.candidatureId, t.listPosition, t.kind)],
);

/**
 * Pas d'una persona pel ple. Hi ha una fila nova cada cop que canvia alguna cosa
 * (substitució, canvi de grup, canvi de càrrec): així el transfuguisme i les
 * baixes queden registrats en comptes de sobreescriure's.
 */
export const councillorMandates = pgTable(
  "councillor_mandates",
  {
    id: serial("id").primaryKey(),
    municipalityId: integer("municipality_id").notNull().references(() => municipalities.id, { onDelete: "cascade" }),
    termId: integer("term_id").references(() => councilTerms.id, { onDelete: "cascade" }),
    personId: integer("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
    groupId: integer("group_id").references(() => politicalGroups.id),
    /** Alcalde · Alcaldessa · Regidor · Regidora · Tinent d'alcalde… */
    role: text("role"),
    area: text("area"),
    /** Sigles tal com les escriu la font, en text lliure. */
    partyRaw: text("party_raw"),
    orderNum: integer("order_num"),
    email: text("email"),
    startsOn: date("starts_on"),
    endsOn: date("ends_on"),
    /** socrata_nm3n · socrata_m5nd · aoc · manual */
    source: text("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("councillor_mandates_mun_idx").on(t.municipalityId, t.termId),
    index("councillor_mandates_person_idx").on(t.personId),
  ],
);
