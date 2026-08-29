import {
  boolean, date, index, integer, pgTable, serial, text, uniqueIndex,
} from "drizzle-orm/pg-core";
import { municipalities } from "./territory";

/** Marques polítiques estables, llavor de `@quivoto/shared-schemas/brands`. */
export const partyBrands = pgTable("party_brands", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  /** state · catalan · regional · local */
  kind: text("kind").notNull(),
  /** Marca de la qual prové (CiU → Junts i PDeCAT). */
  lineage: text("lineage"),
});

/** Convocatòries. L'id és el de la Generalitat: `M20231`, `M20191`, `M20151`. */
export const elections = pgTable("elections", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** municipal · autonomic · general … */
  kind: text("kind").notNull().default("municipal"),
  votedOn: date("voted_on"),
});

/**
 * L'actor polític real d'aquest projecte no és la marca sinó **la candidatura
 * local**: «Junts per Sabadell» i «Junts per Girona» són dues coses diferents,
 * poden pactar en direccions oposades i, sovint, són coalicions que només
 * existeixen en aquell poble.
 */
export const candidatures = pgTable(
  "candidatures",
  {
    id: serial("id").primaryKey(),
    municipalityId: integer("municipality_id").notNull().references(() => municipalities.id, { onDelete: "cascade" }),
    electionId: text("election_id").notNull().references(() => elections.id),
    /** Codi de la candidatura al dataset electoral. */
    candidaturaCodi: text("candidatura_codi").notNull(),
    sigles: text("sigles").notNull(),
    denominacio: text("denominacio"),
    /** Agrupació de la Generalitat: el pont cap a la marca. */
    agrupacioCodi: text("agrupacio_codi"),
    agrupacioSigles: text("agrupacio_sigles"),
    brandId: text("brand_id").references(() => partyBrands.id),
    /** Cert quan la marca s'ha resolt per defecte a `local` i cal mirar-s'ho. */
    brandNeedsReview: boolean("brand_needs_review").notNull().default(false),
    /** Color oficial de la candidatura, tal com el publica la Generalitat. */
    color: text("color"),
  },
  (t) => [
    uniqueIndex("candidatures_key").on(t.municipalityId, t.electionId, t.candidaturaCodi),
    index("candidatures_brand_idx").on(t.brandId),
  ],
);

/** Vots i escons de cada candidatura al municipi. */
export const electionResults = pgTable(
  "election_results",
  {
    candidatureId: integer("candidature_id").notNull().references(() => candidatures.id, { onDelete: "cascade" }),
    votes: integer("votes").notNull(),
    seats: integer("seats").notNull().default(0),
    /** Escons que li dona el nostre recompte d'Hondt; ha de coincidir amb `seats`. */
    seatsRecomputed: integer("seats_recomputed"),
  },
  (t) => [uniqueIndex("election_results_key").on(t.candidatureId)],
);

/** Mandat sortit d'una elecció: 2023-2027, 2019-2023, 2015-2019. */
export const councilTerms = pgTable(
  "council_terms",
  {
    id: serial("id").primaryKey(),
    municipalityId: integer("municipality_id").notNull().references(() => municipalities.id, { onDelete: "cascade" }),
    electionId: text("election_id").notNull().references(() => elections.id),
    seats: integer("seats").notNull(),
    startsOn: date("starts_on"),
    endsOn: date("ends_on"),
  },
  (t) => [uniqueIndex("council_terms_key").on(t.municipalityId, t.electionId)],
);

/**
 * Grup municipal: qui vota al ple. Neix d'una candidatura però se'n pot separar
 * (regidors no adscrits), i és per això que no barregem les dues taules.
 */
export const politicalGroups = pgTable(
  "political_groups",
  {
    id: serial("id").primaryKey(),
    municipalityId: integer("municipality_id").notNull().references(() => municipalities.id, { onDelete: "cascade" }),
    termId: integer("term_id").references(() => councilTerms.id, { onDelete: "cascade" }),
    candidatureId: integer("candidature_id").references(() => candidatures.id),
    name: text("name").notNull(),
    brandId: text("brand_id").references(() => partyBrands.id),
    /** Cert per als no adscrits i altres grups que no vénen d'una llista. */
    isMixed: boolean("is_mixed").notNull().default(false),
  },
  (t) => [index("political_groups_mun_idx").on(t.municipalityId, t.termId)],
);

/**
 * Participació i vots que no van a cap candidatura. Els vots en blanc compten
 * per a la barrera del 5% (LOREG art. 180), així que sense aquesta taula el
 * nostre recompte d'Hondt no pot reproduir el repartiment oficial.
 */
export const electionParticipation = pgTable(
  "election_participation",
  {
    municipalityId: integer("municipality_id").notNull().references(() => municipalities.id, { onDelete: "cascade" }),
    electionId: text("election_id").notNull().references(() => elections.id),
    censusSize: integer("census_size"),
    voters: integer("voters"),
    abstention: integer("abstention"),
    nullVotes: integer("null_votes"),
    blankVotes: integer("blank_votes"),
    partyVotes: integer("party_votes"),
    validVotes: integer("valid_votes"),
  },
  (t) => [uniqueIndex("election_participation_key").on(t.municipalityId, t.electionId)],
);

/**
 * Historial d'alcaldies. La Generalitat en publica 11.873 files que arriben molt
 * més enrere del 2015, i inclouen els canvis a mig mandat: dimissions, relleus
 * pactats i mocions de censura. És de les poques dades que expliquen la política
 * municipal real i no la fotografia del dia de les eleccions.
 */
export const mayors = pgTable(
  "mayors",
  {
    id: serial("id").primaryKey(),
    municipalityId: integer("municipality_id").notNull().references(() => municipalities.id, { onDelete: "cascade" }),
    /** «2023-2027», tal com ho publica la font. */
    term: text("term").notNull(),
    name: text("name").notNull(),
    nameNormalized: text("name_normalized").notNull(),
    partyRaw: text("party_raw"),
    tookOfficeOn: date("took_office_on"),
  },
  (t) => [
    uniqueIndex("mayors_key").on(t.municipalityId, t.term, t.nameNormalized),
    index("mayors_mun_idx").on(t.municipalityId, t.term),
  ],
);
