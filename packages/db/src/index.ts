import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

export * as schema from "./schema/index";
export * from "./schema/index";

/**
 * Una sola forma de base de dades per als dos entorns. En local fem servir
 * PGlite —Postgres compilat a WebAssembly, sense servidor— i a producció el
 * Postgres de Supabase. És el mateix dialecte i el mateix esquema, així que el
 * que passa els tests aquí passa allà.
 */
export type Db = PgliteDatabase<typeof schema>;

export const LOCAL_DATA_DIR = new URL("../.data/quivoto/", import.meta.url).pathname;

/**
 * Avís que val per a qui hi treballi: **PGlite és d'un sol procés**. Dues feines
 * escrivint alhora al mateix directori corrompen la base i el següent
 * `openDb()` peta amb «memory access out of bounds» dins de `_pg_initdb`, sense
 * dir enlloc que el problema és la concurrència.
 *
 * Mentre el desenvolupament sigui d'una persona no fa mal, però és la raó de
 * pes per passar a un Postgres de veritat abans que hi treballi ningú més.
 */

export type DbHandle = {
  db: Db;
  /** Tanca la connexió; en PGlite també allibera el fitxer. */
  close: () => Promise<void>;
  kind: "pglite" | "postgres";
};

/**
 * Obre la base de dades. Si hi ha `DATABASE_URL` va a Postgres; si no, a PGlite
 * al directori `.data/` del paquet (que no entra al repositori).
 */
export async function openDb(options: { url?: string; dir?: string } = {}): Promise<DbHandle> {
  const url = options.url ?? process.env.DATABASE_URL;

  if (url) {
    const client = postgres(url, { max: 4, prepare: false });
    // Els dos clients exposen la mateixa API de consulta de Drizzle.
    const db = drizzlePostgres(client, { schema }) as unknown as Db;
    return { db, kind: "postgres", close: async () => { await client.end(); } };
  }

  // `QUIVOTO_DB_DIR` permet que dos processos treballin alhora sobre còpies
  // separades. Sense això es corrompen l'un a l'altre, perquè PGlite no admet
  // més d'un escriptor sobre el mateix directori.
  const client = new PGlite(options.dir ?? process.env.QUIVOTO_DB_DIR ?? LOCAL_DATA_DIR);
  const db = drizzlePglite(client, { schema });
  return {
    db,
    kind: "pglite",
    /**
     * Aturar el motor de WebAssembly de PGlite peta després d'una sessió llarga
     * («memory access out of bounds»), i l'error surt fora de qualsevol `try`:
     * una ingesta acabada i desada sortia amb codi 1 i semblava que havia
     * fallat. Com que cada feina confirma les seves escriptures i el backend és
     * el sistema de fitxers, forcem un `CHECKPOINT` —que sí que garanteix que
     * tot és a disc— i deixem el procés acabar sense aturar el motor.
     */
    close: async () => {
      try {
        await client.query("CHECKPOINT");
      } catch (error) {
        process.stderr.write(`  avís: no s'ha pogut fer CHECKPOINT (${String(error).slice(0, 80)})\n`);
      }
    },
  };
}
