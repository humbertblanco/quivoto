import { eq } from "drizzle-orm";
import { candidacies, candidatures, municipalities, people, type Db } from "@quivoto/db";
import { MUNICIPAL_ELECTIONS } from "@quivoto/shared-schemas/brands";
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

/** El que desem d'una fila del dataset, llegit una sola vegada i sense xarxa. */
export type CandidatLlegit = {
  fullName: string;
  normalized: string;
  posicio: number;
  kind: string;
  elected: boolean;
};

/**
 * Llegeix una fila de candidat tal com la desarem. El motiu entre parèntesis
 * («Concepción(conxi) Sierra Martín») el treu `normalizePersonName`, que és la
 * mateixa clau amb què tot el projecte aparella persones: normalitzar aquí
 * igual que a J3 és el que fa que la mateixa persona no es dupliqui entre
 * fonts ni entre eleccions. Torna `null` quan no en surt cap nom, perquè una
 * fila sense nom no és ningú.
 */
export function llegeixCandidat(row: CandidateRow): CandidatLlegit | null {
  const fullName = [row.candidat_nom, row.candidat_primer_cognom, row.candidat_segon_cognom]
    .filter(Boolean)
    .join(" ")
    .trim();
  const normalized = normalizePersonName(fullName);
  if (!normalized) return null;
  return {
    fullName,
    normalized,
    posicio: toInt(row.candidat_posicio) ?? 0,
    kind: row.candidat_tipus ?? "Titular",
    elected: String(row.electe ?? "N").toUpperCase() === "S",
  };
}

/**
 * J4 — les llistes senceres de les tres municipals: 2023, 2019 i 2015.
 *
 * Serveixen per a quatre coses: saber qui encapçalava cada llista
 * (l'alcaldable), poder mesurar la paritat i la renovació, tenir ja creades
 * les persones que el 2027 tornaran a presentar-se, i —des que s'ingereixen
 * les tres eleccions— poder dir de cada persona del ple quantes vegades ha
 * anat a llistes i des de quan la hi elegeixen.
 *
 * Comprovat el 31-08-2026 amb crides reals: `xnfg-weec` porta les persones
 * candidates amb `electe` i `candidat_posicio` de les municipals des del 2011
 * (M20151: 42.867 files; M20191: 43.543; M20231: 43.710); de les anteriors al
 * 2011 només en porta ~8.300 per elecció, que no són les llistes senceres.
 * S'ingereixen les mateixes tres que J2 ja carrega de resultats.
 *
 * Les persones es reaprofiten per `name_normalized`, la mateixa clau i la
 * mateixa exigència que fins ara: la mateixa dona a la llista del 2015 i a la
 * del 2023 és una sola fila, i no s'hi afegeix cap heurística nova, perquè
 * una fusió equivocada és pitjor que un duplicat.
 */
export async function j4Candidates(db: Db, electionIds: readonly string[] = MUNICIPAL_ELECTIONS): Promise<void> {
  for (const electionId of electionIds) {
    await j4CandidatesEleccio(db, electionId);
  }
}

async function j4CandidatesEleccio(db: Db, electionId: string): Promise<void> {
  await withRun(db, `J4 llistes ${electionId}`, async (run) => {
    const municipalityByIne = new Map<string, number>();
    for (const m of await db.select().from(municipalities)) municipalityByIne.set(m.ine5, m.id);

    const candidatureKey = new Map<string, number>();
    for (const c of await db.select().from(candidatures).where(eq(candidatures.electionId, electionId))) {
      candidatureKey.set(`${c.municipalityId}|${c.candidaturaCodi}`, c.id);
    }

    // Cau de persones en memòria: sense això farien falta 43.710 consultes.
    // Es torna a llegir a cada elecció perquè l'anterior n'ha creat de noves.
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

        const candidat = llegeixCandidat(row);
        if (!candidat) continue;

        let personId = peopleCache.get(candidat.normalized);
        if (!personId) {
          const [created] = await db
            .insert(people)
            .values({
              firstName: row.candidat_nom ?? null,
              lastName1: row.candidat_primer_cognom ?? null,
              lastName2: row.candidat_segon_cognom ?? null,
              fullName: titleCase(candidat.fullName),
              nameNormalized: candidat.normalized,
              sex: row.candidat_sexe ?? null,
            })
            .returning({ id: people.id });
          personId = created!.id;
          peopleCache.set(candidat.normalized, personId);
        }

        await db
          .insert(candidacies)
          .values({
            candidatureId,
            personId,
            listPosition: candidat.posicio,
            isHead: candidat.posicio === 1 && candidat.kind === "Titular",
            kind: candidat.kind,
            elected: candidat.elected,
            status: candidat.elected ? "elected" : "proclaimed",
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
