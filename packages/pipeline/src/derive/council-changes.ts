import { eq, and } from "drizzle-orm";
import {
  candidacies, candidatures, councillorMandates, municipalities, municipalityMetrics, people, type Db,
} from "@quivoto/db";
import { sameForce } from "@quivoto/shared-schemas/brands";
import { withRun } from "../lib/run";

/**
 * Qui ha entrat i qui ha canviat de bàndol a mig mandat.
 *
 * Cap font ho publica: el conjunt de composició dels plens no té cap etiqueta de
 * «no adscrit» i el de candidatures només diu qui va sortir elegit el 2023. Però
 * creuant-los surt sol, i són dues coses ben diferents:
 *
 *   · **Substitucions**: hi seu algú que no era a la llista d'elegits. Vol dir
 *     que un regidor va plegar i el va rellevar el següent de la seva llista.
 *     És rutina i no té cap càrrega política.
 *   · **Canvi de grup**: algú que va ser elegit per una candidatura i que avui
 *     consta amb unes sigles que no són les seves. Això sí que és notícia, i
 *     per això només ho afirmem quan les dues sigles són inequívocament
 *     diferents. Davant del dubte, no ho comptem.
 */

export type CouncilChange = {
  person: string;
  electedFor: string | null;
  nowWith: string | null;
  kind: "substitucio" | "canvi-de-grup";
};

export async function deriveCouncilChanges(db: Db): Promise<void> {
  await withRun(db, "derive: entrades i canvis de grup", async (run) => {
    // Elegits del 2023, amb la candidatura per la qual van sortir.
    const elected = await db
      .select({
        municipalityId: candidatures.municipalityId,
        personId: candidacies.personId,
        sigles: candidatures.sigles,
        name: people.fullName,
      })
      .from(candidacies)
      .innerJoin(candidatures, eq(candidatures.id, candidacies.candidatureId))
      .innerJoin(people, eq(people.id, candidacies.personId))
      .where(
      // Sense el filtre d'elecció, amb el 2015 i el 2019 ingerits, el mapa
      // «elegit per» es trepitja per persona amb sigles d'una elecció antiga i
      // s'inventen canvis de grup. Avisat per l'agent que va estendre J4.
      and(eq(candidacies.elected, true), eq(candidatures.electionId, "M20231")),
    );

    const electedFor = new Map<string, { sigles: string; name: string }>();
    for (const row of elected) {
      electedFor.set(`${row.municipalityId}|${row.personId}`, { sigles: row.sigles, name: row.name });
    }
    run.rowsIn = elected.length;

    // Qui seu avui al ple.
    const sitting = await db
      .select({
        municipalityId: councillorMandates.municipalityId,
        personId: councillorMandates.personId,
        partyRaw: councillorMandates.partyRaw,
        name: people.fullName,
      })
      .from(councillorMandates)
      .innerJoin(people, eq(people.id, councillorMandates.personId));

    const byMunicipality = new Map<number, CouncilChange[]>();
    let substitutions = 0;
    let switches = 0;

    for (const row of sitting) {
      const origin = electedFor.get(`${row.municipalityId}|${row.personId}`);
      const list = byMunicipality.get(row.municipalityId) ?? [];

      if (!origin) {
        // No era a la llista d'elegits: hi ha entrat després.
        list.push({ person: row.name, electedFor: null, nowWith: row.partyRaw, kind: "substitucio" });
        substitutions += 1;
        byMunicipality.set(row.municipalityId, list);
        continue;
      }

      // Elegit per una llista i avui amb unes altres sigles.
      if (row.partyRaw && !sameForce(origin.sigles, row.partyRaw)) {
        list.push({ person: row.name, electedFor: origin.sigles, nowWith: row.partyRaw, kind: "canvi-de-grup" });
        switches += 1;
        byMunicipality.set(row.municipalityId, list);
      }
    }

    const names = new Map<number, string>();
    for (const m of await db.select().from(municipalities)) names.set(m.id, m.name);

    for (const [municipalityId, changes] of byMunicipality) {
      await db
        .insert(municipalityMetrics)
        .values({
          municipalityId,
          kind: "councilChanges",
          data: {
            changes,
            substitutions: changes.filter((c) => c.kind === "substitucio").length,
            switches: changes.filter((c) => c.kind === "canvi-de-grup").length,
          },
        })
        .onConflictDoUpdate({
          target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
          set: {
            data: {
              changes,
              substitutions: changes.filter((c) => c.kind === "substitucio").length,
              switches: changes.filter((c) => c.kind === "canvi-de-grup").length,
            },
            computedAt: new Date(),
          },
        });
      run.rowsOut += 1;
    }

    run.say(`${substitutions} regidors hi han entrat a mig mandat, a ${byMunicipality.size} municipis`);
    run.say(`${switches} consten avui amb unes sigles diferents de les que els van fer elegir`);
    return { substitucions: substitutions, canvis_de_grup: switches, municipis: byMunicipality.size };
  });
}
