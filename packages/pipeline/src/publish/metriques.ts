import { municipalityMetrics, type Db } from "@quivoto/db";
import { eq } from "drizzle-orm";

/**
 * Carrega mètriques de moltes files sense matar el motor.
 *
 * PGlite fa córrer Postgres dins de WebAssembly, i el resultat d'una consulta
 * ha de cabre sencer a la seva memòria. Mentre les mètriques eren quatre xifres
 * per municipi, demanar-les totes de cop anava bé. Quan J12 hi va posar els
 * punts votats de les actes —41.113 punts amb el text i el vot de cada grup, 18
 * MB en 67 files— i J15 la despesa de 15 programes per set anys, les pàgines
 * que carregaven la taula sencera van començar a petar amb «memory access out
 * of bounds», i el pitjor és **com** petaven: l'error surt després d'haver
 * escrit part del web, així que la publicació semblava feta i faltaven pàgines.
 *
 * Aquí es demana **per tipus i en blocs**. És més lent i és l'única manera que
 * això aguanti mentre la base de dades creixi, que creixerà: les actes són el
 * que més té per créixer i encara en falten 877 municipis.
 */

const BLOC = 200;

export async function carregaMetriques(
  db: Db,
  kinds: readonly string[],
): Promise<(typeof municipalityMetrics.$inferSelect)[]> {
  const files: (typeof municipalityMetrics.$inferSelect)[] = [];
  for (const kind of kinds) {
    for (let salta = 0; ; salta += BLOC) {
      const tros = await db
        .select()
        .from(municipalityMetrics)
        .where(eq(municipalityMetrics.kind, kind))
        .orderBy(municipalityMetrics.municipalityId)
        .limit(BLOC)
        .offset(salta);
      files.push(...tros);
      if (tros.length < BLOC) break;
    }
  }
  return files;
}
