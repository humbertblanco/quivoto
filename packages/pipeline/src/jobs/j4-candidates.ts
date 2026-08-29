import { eq, inArray } from "drizzle-orm";
import { candidacies, candidatures, municipalities, people, type Db } from "@quivoto/db";
import { DATASETS, socrataPages } from "../adapters/socrata";
import { normalizePersonName, titleCase, toInt } from "../lib/text";
import { withRun } from "../lib/run";

type CandidateRow = {
  territori_codi: string;
  candidatura_codi: string;
  candidat_nom: string;
  candidat_primer_cognom?: string;
  candidat_segon_cognom?: string;
  candidat_sexe?: string;
  candidat_posicio: string;
  candidat_tipus?: string;
  electe?: string;
};

/**
 * J4 — les llistes senceres. Són 43.710 files només del 2023, i inclouen els
 * suplents. Serveixen per a tres coses: saber qui encapçalava cada llista
 * (l'alcaldable), poder mesurar la paritat i la renovació, i tenir ja creades
 * les persones que el 2027 tornaran a presentar-se.
 */
export async function j4Candidates(db: Db, electionId = "M20231"): Promise<void> {
  await withRun(db, `J4 llistes ${electionId}`, async (run) => {
    const municipalityByIne = new Map<string, number>();
    for (const m of await db.select().from(municipalities)) municipalityByIne.set(m.ine5, m.id);

    const candidatureKey = new Map<string, number>();
    for (const c of await db.select().from(candidatures).where(eq(candidatures.electionId, electionId))) {
      candidatureKey.set(`${c.municipalityId}|${c.candidaturaCodi}`, c.id);
    }

    // Cau de persones en memòria: sense això farien falta 43.710 consultes.
    const peopleCache = new Map<string, number>();
    for (const p of await db.select({ id: people.id, key: people.nameNormalized }).from(people)) {
      peopleCache.set(p.key, p.id);
    }

    let missingCandidature = 0;
    for await (const page of socrataPages<CandidateRow>(
      DATASETS.candidats,
      {
        filters: { id_eleccio: electionId },
        select:
          "territori_codi,candidatura_codi,candidat_nom,candidat_primer_cognom,candidat_segon_cognom,candidat_sexe,candidat_posicio,candidat_tipus,electe",
      },
      5_000,
    )) {
      run.rowsIn += page.length;

      for (const row of page) {
        const municipalityId = municipalityByIne.get(row.territori_codi);
        if (!municipalityId) continue;
        const candidatureId = candidatureKey.get(`${municipalityId}|${row.candidatura_codi}`);
        if (!candidatureId) {
          missingCandidature += 1;
          continue;
        }

        const fullName = [row.candidat_nom, row.candidat_primer_cognom, row.candidat_segon_cognom]
          .filter(Boolean)
          .join(" ")
          .trim();
        const normalized = normalizePersonName(fullName);
        if (!normalized) continue;

        let personId = peopleCache.get(normalized);
        if (!personId) {
          const [created] = await db
            .insert(people)
            .values({
              firstName: row.candidat_nom ?? null,
              lastName1: row.candidat_primer_cognom ?? null,
              lastName2: row.candidat_segon_cognom ?? null,
              fullName: titleCase(fullName),
              nameNormalized: normalized,
              sex: row.candidat_sexe ?? null,
            })
            .returning({ id: people.id });
          personId = created!.id;
          peopleCache.set(normalized, personId);
        }

        const position = toInt(row.candidat_posicio) ?? 0;
        const kind = row.candidat_tipus ?? "Titular";
        const elected = String(row.electe ?? "N").toUpperCase() === "S";

        await db
          .insert(candidacies)
          .values({
            candidatureId,
            personId,
            listPosition: position,
            isHead: position === 1 && kind === "Titular",
            kind,
            elected,
            status: elected ? "elected" : "proclaimed",
          })
          .onConflictDoNothing();
        run.rowsOut += 1;
      }

      if (run.rowsIn % 20_000 === 0) run.say(`${run.rowsIn} files processades`);
    }

    if (missingCandidature > 0) {
      await run.issue({
        kind: "candidacy_without_candidature",
        severity: "mitjana",
        detail: { files: missingCandidature, nota: "candidatures sense escons que no són al dataset de resultats" },
      });
    }
    return { files: run.rowsIn, sense_candidatura: missingCandidature };
  });
}
