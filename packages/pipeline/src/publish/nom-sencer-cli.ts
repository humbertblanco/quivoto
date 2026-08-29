/**
 * D'unes sigles al NOM SENCER de la candidatura.
 *
 * Les sigles grises dels 947 no vénen totes del mateix lloc, i això és la clau:
 *
 *  - `candidatures.sigles` és el que publica el dataset electoral, i sempre
 *    porta al costat `candidatures.denominacio`, el nom sencer.
 *  - `municipalities.mayor_party_raw` és com el registre d'alcaldies escriu el
 *    partit de l'alcalde. Són sigles curtes i inventades pel registre
 *    («JuntsxCat»), no existeixen a `candidatures` i no tenen cap nom sencer
 *    propi. El nom sencer només s'hi arriba pel municipi.
 *
 * Per això el programa busca als dos llocs i, quan les sigles són del registre
 * d'alcaldies, ensenya totes les llistes amb escons d'aquell municipi perquè es
 * pugui veure quina és —i, si cap no ho és clarament, que no es pugui saber.
 *
 *   tsx src/publish/nom-sencer-cli.ts JuntsxCat
 */
import { openDb } from "@quivoto/db";
import { candidatures, electionResults, municipalities } from "@quivoto/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";

const ELECCIO = "M20231";
const buscades = process.argv[2] ?? "";
if (!buscades) {
  process.stderr.write("Ús: tsx src/publish/nom-sencer-cli.ts <sigles>\n");
  process.exit(1);
}

const { db, close } = await openDb();
const out = (s: string) => process.stdout.write(s);

// ---- 1. les sigles són d'una candidatura del dataset electoral? ----
const llistes = await db
  .select({
    municipi: municipalities.name,
    sigles: candidatures.sigles,
    denominacio: candidatures.denominacio,
    agrupacioSigles: candidatures.agrupacioSigles,
    brandId: candidatures.brandId,
    escons: electionResults.seats,
  })
  .from(candidatures)
  .innerJoin(municipalities, eq(municipalities.id, candidatures.municipalityId))
  .leftJoin(electionResults, eq(electionResults.candidatureId, candidatures.id))
  .where(and(
    eq(candidatures.electionId, ELECCIO),
    sql`lower(${candidatures.sigles}) = lower(${buscades})`,
  ))
  .orderBy(municipalities.name);

out(`candidatures.sigles = «${buscades}» (${ELECCIO}): ${llistes.length}\n`);
for (const l of llistes) {
  out(`  ${l.municipi}\n    nom sencer  ${l.denominacio ?? "(NUL)"}\n`
    + `    agrupació ${l.agrupacioSigles ?? "—"} · marca ${l.brandId ?? "—"} · escons ${l.escons ?? 0}\n`);
}

// ---- 2. o són del registre d'alcaldies? ----
const alcaldies = await db
  .select({ id: municipalities.id, name: municipalities.name, mayor: municipalities.mayorName })
  .from(municipalities)
  .where(sql`lower(${municipalities.mayorPartyRaw}) = lower(${buscades})`)
  .orderBy(municipalities.name);

out(`\nmunicipalities.mayor_party_raw = «${buscades}»: ${alcaldies.length}\n`);
for (const a of alcaldies) {
  out(`\n  ${a.name} — alcalde/essa ${a.mayor ?? "?"}\n`);
  const delMunicipi = await db
    .select({
      sigles: candidatures.sigles,
      denominacio: candidatures.denominacio,
      brandId: candidatures.brandId,
      escons: electionResults.seats,
    })
    .from(candidatures)
    .innerJoin(electionResults, eq(electionResults.candidatureId, candidatures.id))
    .where(and(eq(candidatures.municipalityId, a.id), eq(candidatures.electionId, ELECCIO)))
    .orderBy(desc(electionResults.seats));
  for (const c of delMunicipi.filter((c) => (c.escons ?? 0) > 0)) {
    out(`    ${String(c.escons).padStart(2)} escons · ${c.sigles}\n`
      + `               nom sencer: ${c.denominacio ?? "(NUL)"} · marca ${c.brandId ?? "—"}\n`);
  }
}
await close();
