import { and, eq } from "drizzle-orm";
import {
  candidatures, councilTerms, electionParticipation, electionResults, municipalities,
  politicalGroups, type Db,
} from "@quivoto/db";
import { MUNICIPAL_ELECTIONS, resolveBrand } from "@quivoto/shared-schemas/brands";
import { dHondt } from "@quivoto/shared-schemas/seats";
import { DATASETS, socrataAll } from "../adapters/socrata";
import { toInt } from "../lib/text";
import { withRun } from "../lib/run";

type ResultRow = {
  territori_codi: string;
  territori_nom: string;
  candidatura_codi: string;
  candidatura_sigles: string;
  candidatura_denominacio?: string;
  candidatura_color?: string;
  agrupacio_codi?: string;
  agrupacio_sigles?: string;
  vots: string;
  escons?: string;
};

const TERM_DATES: Record<string, { startsOn: string; endsOn: string | null }> = {
  M20231: { startsOn: "2023-06-17", endsOn: null },
  M20191: { startsOn: "2019-06-15", endsOn: "2023-06-17" },
  M20151: { startsOn: "2015-06-13", endsOn: "2019-06-15" },
};

/**
 * J2 — resultats de 2023, 2019 i 2015. Tres eleccions perquè una sola foto no
 * explica res: el que interessa d'un municipi és el moviment, i el transvasament
 * entre marques és una de les coses que ningú publica de manera comparable.
 *
 * A cada municipi hi tornem a passar la llei d'Hondt amb els vots oficials. Si
 * el nostre repartiment no coincideix amb els escons publicats, l'anomalia queda
 * registrada: o hem carregat malament els vots, o hi ha alguna particularitat
 * (un empat resolt per sorteig) que val la pena mirar-se.
 */
export async function j2Results(db: Db): Promise<void> {
  const byIne = new Map<string, { id: number; name: string; seats: number | null; system: string }>();
  for (const m of await db.select().from(municipalities)) {
    byIne.set(m.ine5, { id: m.id, name: m.name, seats: m.councilSeats, system: m.electoralSystem });
  }

  // Vots vàlids per municipi i elecció: és la base legal de la barrera del 5%,
  // i inclou els vots en blanc. Ve de J5, que s'ha d'haver executat abans.
  const validVotes = new Map<string, number>();
  for (const p of await db.select().from(electionParticipation)) {
    if (p.validVotes !== null) validVotes.set(`${p.municipalityId}|${p.electionId}`, p.validVotes);
  }

  for (const electionId of MUNICIPAL_ELECTIONS) {
    await withRun(db, `J2 resultats ${electionId}`, async (run) => {
      const rows = await socrataAll<ResultRow>(DATASETS.resultats, {
        filters: { id_eleccio: electionId, id_nivell_territorial: "MU" },
        select:
          "territori_codi,territori_nom,candidatura_codi,candidatura_sigles,candidatura_denominacio,candidatura_color,agrupacio_codi,agrupacio_sigles,vots,escons",
      });
      run.rowsIn = rows.length;

      const byMunicipality = new Map<string, ResultRow[]>();
      for (const row of rows) {
        const list = byMunicipality.get(row.territori_codi);
        if (list) list.push(row);
        else byMunicipality.set(row.territori_codi, [row]);
      }
      run.say(`${rows.length} candidatures a ${byMunicipality.size} municipis`);

      let unmapped = 0;
      let seatMismatches = 0;

      for (const [ine5, list] of byMunicipality) {
        const municipality = byIne.get(ine5);
        if (!municipality) {
          await run.issue({ kind: "unknown_municipality", entity: ine5, detail: { nom: list[0]?.territori_nom } });
          continue;
        }

        const officialSeats = list.reduce((a, r) => a + (toInt(r.escons) ?? 0), 0);
        const [term] = await db
          .insert(councilTerms)
          .values({
            municipalityId: municipality.id,
            electionId,
            seats: officialSeats,
            startsOn: TERM_DATES[electionId]!.startsOn,
            endsOn: TERM_DATES[electionId]!.endsOn,
          })
          .onConflictDoUpdate({
            target: [councilTerms.municipalityId, councilTerms.electionId],
            set: { seats: officialSeats },
          })
          .returning({ id: councilTerms.id });

        // El nostre recompte contra el repartiment oficial. Als municipis de
        // llistes obertes o de consell obert no s'aplica la llei d'Hondt, així
        // que allà no hi ha res a comprovar.
        // Un ple de 5 regidors o menys vol dir 250 habitants o menys (LOREG
        // art. 179), i en aquesta franja es vota amb llistes obertes (art. 184).
        // Ho deduïm dels escons i no del padró d'avui perquè el que compta és la
        // població que tenia el municipi en aquella elecció, no la d'ara.
        const usesDHondt = municipality.system === "llistes tancades" && officialSeats > 5;
        const recount = usesDHondt
          ? dHondt(
              list.map((r) => ({ id: r.candidatura_codi, votes: toInt(r.vots) ?? 0 })),
              officialSeats,
              { validVotes: validVotes.get(`${municipality.id}|${electionId}`) },
            )
          : null;

        for (const row of list) {
          const brand = resolveBrand(electionId, row.agrupacio_codi);
          if (brand.needsReview) unmapped += 1;

          const values = {
            municipalityId: municipality.id,
            electionId,
            candidaturaCodi: row.candidatura_codi,
            sigles: row.candidatura_sigles,
            denominacio: row.candidatura_denominacio ?? null,
            agrupacioCodi: row.agrupacio_codi ?? null,
            agrupacioSigles: row.agrupacio_sigles ?? null,
            brandId: brand.brandId,
            brandNeedsReview: brand.needsReview,
            color: row.candidatura_color ?? null,
          };
          const [candidature] = await db
            .insert(candidatures)
            .values(values)
            .onConflictDoUpdate({
              target: [candidatures.municipalityId, candidatures.electionId, candidatures.candidaturaCodi],
              set: values,
            })
            .returning({ id: candidatures.id });

          const seats = toInt(row.escons) ?? 0;
          const recomputed = recount ? recount.seats[row.candidatura_codi] ?? 0 : null;
          await db
            .insert(electionResults)
            .values({ candidatureId: candidature!.id, votes: toInt(row.vots) ?? 0, seats, seatsRecomputed: recomputed })
            .onConflictDoUpdate({
              target: electionResults.candidatureId,
              set: { votes: toInt(row.vots) ?? 0, seats, seatsRecomputed: recomputed },
            });

          if (recount && seats !== recomputed) {
            seatMismatches += 1;
            await run.issue({
              kind: "seats_mismatch",
              severity: recount.drawNeeded ? "baixa" : "alta",
              municipalityId: municipality.id,
              entity: `${municipality.name} · ${row.candidatura_sigles}`,
              detail: {
                electionId, oficials: seats, recomptats: recomputed, sorteig: recount.drawNeeded,
                votsValids: validVotes.get(`${municipality.id}|${electionId}`) ?? null,
              },
            });
          }

          // El grup municipal del mandat surt de la candidatura amb escons.
          if (seats > 0) {
            const existing = await db
              .select({ id: politicalGroups.id })
              .from(politicalGroups)
              .where(and(eq(politicalGroups.candidatureId, candidature!.id), eq(politicalGroups.termId, term!.id)));
            if (existing.length === 0) {
              await db.insert(politicalGroups).values({
                municipalityId: municipality.id,
                termId: term!.id,
                candidatureId: candidature!.id,
                name: row.candidatura_sigles,
                brandId: brand.brandId,
              });
            }
          }
          run.rowsOut += 1;
        }

        // El ple d'avui es va escollir amb el padró del 2022, i el que tenim és
        // el del 2025: la diferència no és un error, és una previsió del que
        // canviarà el 2027. Es guarda com a informació, no com a problema.
        if (municipality.seats !== null && officialSeats !== municipality.seats && electionId === "M20231") {
          await run.issue({
            kind: "council_size_change_2027",
            severity: "baixa",
            municipalityId: municipality.id,
            entity: municipality.name,
            detail: {
              escons2023: officialSeats,
              previstos2027: municipality.seats,
              delta: municipality.seats - officialSeats,
              nota: "projecció amb el padró del 2025; el definitiu serà el vigent en convocar",
            },
          });
        }
      }

      return { candidatures: rows.length, senseMarca: unmapped, escons_discrepants: seatMismatches };
    });
  }
}
