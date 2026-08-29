import { eq } from "drizzle-orm";
import {
  electionParticipation, mayors, municipalities, type Db,
} from "@quivoto/db";
import { MUNICIPAL_ELECTIONS } from "@quivoto/shared-schemas/brands";
import { socrataAll } from "../adapters/socrata";
import { normalize, normalizePersonName, toInt, uninvertArticle } from "../lib/text";
import { withRun } from "../lib/run";

/** Municipis que no reparteixen escons per la llei d'Hondt. */
const OPEN_LIST_DATASET = "x4tc-npww";
/** Participació, vots nuls i vots en blanc per municipi i elecció. */
const PARTICIPATION_DATASET = "irrv-2mfc";
/** Historial d'alcaldies, molt més enrere del 2015. */
const MAYORS_DATASET = "2v2p-vu4h";

type OpenListRow = { nom_municipi: string; sistema_electoral: string };
type ParticipationRow = {
  id_eleccio: string; territori_codi: string; cens_electoral?: string; votants?: string;
  abstencio?: string; vots_nuls?: string; vots_blancs?: string; vots_candidatures?: string; vots_valids?: string;
};
type MayorRow = {
  codi_10: string; nom_alcalde: string; partit_alcalde?: string;
  legislatura_alcalde: string; data_pressa_possessio?: string;
};

/**
 * J5 — el context que fa que la resta quadri.
 *
 * Tres fonts que el pla original no tenia i que canvien resultats:
 *   1. **Sistema electoral**: 178 municipis voten amb llistes obertes o funcionen
 *      en consell obert. Aplicar-hi la llei d'Hondt és senzillament incorrecte, i
 *      era la causa de la majoria de descuadres del nostre recompte.
 *   2. **Participació**: els vots en blanc entren a la base de la barrera del 5%.
 *      Sense ells, el recompte inclou candidatures que la llei deixava fora.
 *   3. **Historial d'alcaldies**: 11.873 files que arriben dècades enrere i que
 *      recullen els relleus a mig mandat, que és on es veu la política de veritat.
 */
export async function j5Context(db: Db): Promise<void> {
  const all = await db.select().from(municipalities);
  const byName = new Map<string, number>();
  const byCodiEns = new Map<string, number>();
  const byIne = new Map<string, number>();
  for (const m of all) {
    byName.set(normalize(m.name), m.id);
    byCodiEns.set(m.codiEns, m.id);
    byIne.set(m.ine5, m.id);
  }

  await withRun(db, "J5 sistema electoral", async (run) => {
    const rows = await socrataAll<OpenListRow>(OPEN_LIST_DATASET, {});
    run.rowsIn = rows.length;
    let matched = 0;
    for (const row of rows) {
      const id = byName.get(normalize(row.nom_municipi))
        ?? byName.get(normalize(uninvertArticle(row.nom_municipi)));
      if (!id) {
        await run.issue({ kind: "open_list_unmatched", severity: "baixa", entity: row.nom_municipi });
        continue;
      }
      await db
        .update(municipalities)
        .set({ electoralSystem: row.sistema_electoral })
        .where(eq(municipalities.id, id));
      matched += 1;
    }
    run.rowsOut = matched;
    run.say(`${matched} municipis amb llistes obertes o consell obert`);
    return { municipis: matched };
  });

  await withRun(db, "J5 participació", async (run) => {
    for (const electionId of MUNICIPAL_ELECTIONS) {
      const rows = await socrataAll<ParticipationRow>(PARTICIPATION_DATASET, {
        filters: { id_eleccio: electionId, id_nivell_territorial: "MU" },
        select:
          "territori_codi,cens_electoral,votants,abstencio,vots_nuls,vots_blancs,vots_candidatures,vots_valids",
      });
      run.rowsIn += rows.length;
      for (const row of rows) {
        const municipalityId = byIne.get(row.territori_codi);
        if (!municipalityId) continue;
        const values = {
          municipalityId,
          electionId,
          censusSize: toInt(row.cens_electoral),
          voters: toInt(row.votants),
          abstention: toInt(row.abstencio),
          nullVotes: toInt(row.vots_nuls),
          blankVotes: toInt(row.vots_blancs),
          partyVotes: toInt(row.vots_candidatures),
          validVotes: toInt(row.vots_valids),
        };
        await db
          .insert(electionParticipation)
          .values(values)
          .onConflictDoUpdate({
            target: [electionParticipation.municipalityId, electionParticipation.electionId],
            set: values,
          });
        run.rowsOut += 1;
      }
      run.say(`${electionId}: ${rows.length} municipis amb participació`);
    }
    return { files: run.rowsOut };
  });

  await withRun(db, "J5 historial d'alcaldies", async (run) => {
    const rows = await socrataAll<MayorRow>(MAYORS_DATASET, {
      select: "codi_10,nom_alcalde,partit_alcalde,legislatura_alcalde,data_pressa_possessio",
    });
    run.rowsIn = rows.length;
    const terms = new Set<string>();
    for (const row of rows) {
      const municipalityId = byCodiEns.get(String(row.codi_10).padStart(10, "0"));
      if (!municipalityId || !row.nom_alcalde) continue;
      terms.add(row.legislatura_alcalde);
      await db
        .insert(mayors)
        .values({
          municipalityId,
          term: row.legislatura_alcalde,
          name: row.nom_alcalde,
          nameNormalized: normalizePersonName(row.nom_alcalde),
          partyRaw: row.partit_alcalde ?? null,
          tookOfficeOn: row.data_pressa_possessio ? row.data_pressa_possessio.slice(0, 10) : null,
        })
        .onConflictDoNothing();
      run.rowsOut += 1;
    }
    run.say(`${run.rowsOut} alcaldies desades, ${terms.size} legislatures diferents`);
    return { alcaldies: run.rowsOut, legislatures: [...terms].sort() };
  });
}
