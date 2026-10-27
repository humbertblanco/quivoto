import { eq } from "drizzle-orm";
import {
  candidacies, candidatures, councilTerms, electionResults, municipalities,
  municipalityMetrics, people, type Db,
} from "@quivoto/db";
import { MUNICIPAL_ELECTIONS } from "@quivoto/shared-schemas/brands";
import { absoluteMajority, effectiveParties } from "@quivoto/shared-schemas/seats";
import { matchMayorParty } from "./match-mayor";
import { deriveMarges } from "./marges";
import type { LlistesObertesMetric } from "../jobs/j37-llistes-obertes";
import { withRun } from "../lib/run";

/**
 * Indicadors derivats. Aquí no hi ha cap intel·ligència artificial: són càlculs
 * deterministes sobre dades oficials, i per això es poden publicar amb la
 * confiança més alta i es poden refer sempre que calgui.
 *
 * El que en surt és el contingut de la radiografia de cada municipi: qui governa
 * contra qui va guanyar, com s'ha mogut el vot en tres eleccions, com de
 * fragmentat és el ple i quina paritat tenien les llistes. Cap d'aquestes
 * quatre coses es publica avui de manera comparable per als 947 municipis.
 */

type CandidatureRow = {
  candidatureId: number;
  sigles: string;
  agrupacioSigles: string | null;
  brandId: string | null;
  color: string | null;
  votes: number;
  seats: number;
};

export async function deriveMetrics(db: Db): Promise<void> {
  await withRun(db, "derive: indicadors municipals", async (run) => {
    const allMunicipalities = await db.select().from(municipalities);
    run.rowsIn = allMunicipalities.length;

    // Una sola lectura de tot el resultat electoral, indexada en memòria.
    const resultRows = await db
      .select({
        municipalityId: candidatures.municipalityId,
        electionId: candidatures.electionId,
        candidatureId: candidatures.id,
        sigles: candidatures.sigles,
        agrupacioSigles: candidatures.agrupacioSigles,
        brandId: candidatures.brandId,
        color: candidatures.color,
        votes: electionResults.votes,
        seats: electionResults.seats,
      })
      .from(candidatures)
      .innerJoin(electionResults, eq(electionResults.candidatureId, candidatures.id));

    const byMunicipality = new Map<number, Map<string, CandidatureRow[]>>();
    for (const r of resultRows) {
      let elections = byMunicipality.get(r.municipalityId);
      if (!elections) byMunicipality.set(r.municipalityId, (elections = new Map()));
      const list = elections.get(r.electionId);
      const row: CandidatureRow = {
        candidatureId: r.candidatureId, sigles: r.sigles, agrupacioSigles: r.agrupacioSigles,
        brandId: r.brandId, color: r.color, votes: r.votes, seats: r.seats,
      };
      if (list) list.push(row);
      else elections.set(r.electionId, [row]);
    }

    // Paritat i renovació: sexe de les persones de cada llista del 2023.
    const listRows = await db
      .select({
        municipalityId: candidatures.municipalityId,
        electionId: candidatures.electionId,
        sex: people.sex,
        elected: candidacies.elected,
        isHead: candidacies.isHead,
        kind: candidacies.kind,
      })
      .from(candidacies)
      .innerJoin(candidatures, eq(candidatures.id, candidacies.candidatureId))
      .innerJoin(people, eq(people.id, candidacies.personId));

    const listsByMunicipality = new Map<number, typeof listRows>();
    for (const r of listRows) {
      const list = listsByMunicipality.get(r.municipalityId);
      if (list) list.push(r);
      else listsByMunicipality.set(r.municipalityId, [r]);
    }

    /*
     * Les regidories del ple del 2023, tal com les va repartir aquella elecció
     * (`council_terms.seats`, J2). No es pot fer servir `municipalities.
     * councilSeats`: és la projecció per al 2027 amb el padró d'avui, i a
     * una quarantena de municipis que han crescut (Barcelona, Vic, Roses…)
     * ja no coincideix amb el ple que hi seu. Comparar-hi els electes del 2023
     * marcava el ple de Barcelona com a incomplet amb «41 de 43».
     */
    const terms2023 = await db
      .select({ municipalityId: councilTerms.municipalityId, seats: councilTerms.seats })
      .from(councilTerms)
      .where(eq(councilTerms.electionId, "M20231"));
    const seats2023 = new Map(terms2023.map((t) => [t.municipalityId, t.seats]));

    /*
     * El vot nominal dels municipis de llista oberta (J37). El conjunt de
     * candidatures de la Generalitat no hi porta la llista sencera —és el
     * forat de 213 municipis de la nota de sota—, i el fitxer del Ministeri sí:
     * cada persona amb el seu sexe i si va sortir elegida.
     */
    const obertes2023 = new Map<number, NonNullable<ReturnType<typeof eleccioOberta2023>>>();
    for (const r of await db
      .select({ municipalityId: municipalityMetrics.municipalityId, data: municipalityMetrics.data })
      .from(municipalityMetrics)
      .where(eq(municipalityMetrics.kind, "llistesObertes"))) {
      const e = eleccioOberta2023(r.data as LlistesObertesMetric);
      if (e) obertes2023.set(r.municipalityId, e);
    }

    let noGovernmentData = 0;

    for (const m of allMunicipalities) {
      const elections = byMunicipality.get(m.id);
      if (!elections) continue;

      // ---- resultats per elecció ----
      const results: Record<string, unknown> = {};
      for (const electionId of MUNICIPAL_ELECTIONS) {
        const list = elections.get(electionId);
        if (!list) continue;
        const totalVotes = list.reduce((a, c) => a + c.votes, 0);
        const sorted = [...list].sort((a, b) => b.votes - a.votes);
        results[electionId] = {
          totalVotes,
          seats: list.reduce((a, c) => a + c.seats, 0),
          candidatures: sorted.map((c) => ({
            sigles: c.sigles,
            brandId: c.brandId,
            color: c.color,
            votes: c.votes,
            seats: c.seats,
            share: totalVotes === 0 ? 0 : Math.round((10_000 * c.votes) / totalVotes) / 100,
          })),
        };
      }
      await upsert(db, m.id, "results", results);

      // ---- qui governa contra qui va guanyar ----
      const current = elections.get("M20231");
      if (current && current.length > 0) {
        const bySeats = [...current].sort((a, b) => b.seats - a.seats || b.votes - a.votes);
        const winner = bySeats[0]!;
        const totalSeats = current.reduce((a, c) => a + c.seats, 0);
        const majority = absoluteMajority(totalSeats);
        const match = matchMayorParty(
          m.mayorPartyRaw,
          current.map((c) => ({
            candidatureId: c.candidatureId, sigles: c.sigles,
            agrupacioSigles: c.agrupacioSigles, brandId: c.brandId, seats: c.seats,
          })),
        );
        const mayorCandidature = match ? current.find((c) => c.candidatureId === match.candidatureId) : undefined;

        if (!mayorCandidature) noGovernmentData += 1;

        await upsert(db, m.id, "government", {
          mayorName: m.mayorName,
          mayorPartyRaw: m.mayorPartyRaw,
          mayorSeats: mayorCandidature?.seats ?? null,
          mayorSigles: mayorCandidature?.sigles ?? null,
          /** Com s'ha lligat l'alcaldia amb la seva llista, i amb quina seguretat. */
          mayorMatchMethod: match?.method ?? null,
          mayorMatchConfidence: match?.confidence ?? null,
          winnerSigles: winner.sigles,
          winnerSeats: winner.seats,
          totalSeats,
          majority,
          winnerHasMajority: winner.seats >= majority,
          /** La dada amb més valor periodístic: la llista més votada, governa? */
          winnerGoverns: mayorCandidature ? mayorCandidature.candidatureId === winner.candidatureId : null,
          /** Cert quan l'alcaldia és d'una llista que no va guanyar: hi va haver pacte. */
          coalitionLikely: mayorCandidature ? mayorCandidature.candidatureId !== winner.candidatureId : null,
          effectiveParties: Math.round(effectiveParties(current.map((c) => c.seats)) * 100) / 100,
        });
      }

      // ---- moviment 2015 → 2019 → 2023, per marca ----
      const trend: Record<string, Record<string, { votes: number; seats: number }>> = {};
      for (const electionId of MUNICIPAL_ELECTIONS) {
        for (const c of elections.get(electionId) ?? []) {
          const brand = c.brandId ?? "local";
          trend[brand] ??= {};
          const bucket = (trend[brand]![electionId] ??= { votes: 0, seats: 0 });
          bucket.votes += c.votes;
          bucket.seats += c.seats;
        }
      }
      await upsert(db, m.id, "trend", {
        brands: trend,
        deltaSeats: Object.fromEntries(
          Object.entries(trend).map(([brand, byElection]) => [
            brand,
            (byElection.M20231?.seats ?? 0) - (byElection.M20191?.seats ?? 0),
          ]),
        ),
      });

      /*
       * ---- paritat de les llistes i del ple ----
       *
       * Amb una trampa que ha estat publicant xifres falses i que es va veure
       * el dia que se'n va dibuixar la distribució del grup: a la meitat
       * central dels municipis de 101 a 250 habitants hi sortia un **0 % de
       * dones al ple** i, al costat, pobles amb un **100 %**. Cap de les dues
       * xifres no és la del seu ple.
       *
       * La causa és que el conjunt de candidatures de la Generalitat no porta
       * la llista sencera dels municipis petits: a Abella de la Conca, que té
       * cinc regidories, hi consten **tres** persones i **dues** com a electes.
       * Un 50 % calculat sobre dues persones s'estava publicant com «la meitat
       * del ple són dones». Mesurat sobre els 947: **213 municipis** no tenen
       * la llista d'electes completa, i entre ells **els 152 plens de cinc
       * regidories, tots**.
       *
       * Aquí no s'hi toca cap càlcul —les xifres continuen sent les que la font
       * permet— sinó que s'hi afegeix de quantes regidories parlem i si la
       * llista quadra. Qui les publiqui ha de mirar `complet` primer: un
       * percentatge sobre dues persones de cinc no és el ple, i publicar-lo és
       * pitjor que no publicar-ne cap.
       */
      const lists = (listsByMunicipality.get(m.id) ?? []).filter((r) => r.electionId === "M20231");
      const oberta = obertes2023.get(m.id) ?? null;
      if (lists.length > 0 || oberta) {
        const titulars = lists.filter((r) => r.kind === "Titular");
        const women = (rows: typeof lists) => rows.filter((r) => r.sex === "D").length;
        const elected = lists.filter((r) => r.elected);
        const heads = lists.filter((r) => r.isHead);
        // El ple que va sortir del 2023; la projecció del padró d'avui només si J2 no en té el mandat.
        const escons = seats2023.get(m.id) ?? oberta?.regidors ?? m.councilSeats ?? 0;

        let candidats = { total: titulars.length, dones: women(titulars) };
        let electes = { total: elected.length, dones: women(elected) };
        let font: "candidatures" | "llistesObertes" = "candidatures";
        /*
         * Als pobles de llista oberta on el conjunt de la Generalitat es queda
         * curt, el vot nominal del Ministeri dona la llista sencera. Només s'hi
         * canvia si quadra del tot —tantes persones elegides com regidories, i
         * totes amb el sexe informat—: substituir un denominador dolent per un
         * altre de dolent no arregla res.
         */
        const completCandidatures = escons > 0 && elected.length === escons;
        if (!completCandidatures && oberta && oberta.elegits === escons && oberta.elegitsSenseSexe === 0) {
          candidats = { total: oberta.candidats, dones: oberta.donesCandidates };
          electes = { total: oberta.elegits, dones: oberta.donesElegides };
          font = "llistesObertes";
        }
        const complet = escons > 0 && electes.total === escons;
        if (!complet) {
          await run.issue({
            kind: "llista_electes_incompleta",
            severity: "mitjana",
            municipalityId: m.id,
            detail: {
              escons, electesAlConjunt: elected.length, filesAlConjunt: lists.length,
              electesVotNominal: oberta?.elegits ?? null,
            },
          });
        }
        await upsert(db, m.id, "parity", {
          candidates: candidats.total,
          womenCandidates: candidats.dones,
          womenCandidatesPct: candidats.total === 0 ? null : Math.round((100 * candidats.dones) / candidats.total),
          elected: electes.total,
          womenElected: electes.dones,
          womenElectedPct: electes.total === 0 ? null : Math.round((100 * electes.dones) / electes.total),
          heads: heads.length,
          womenHeads: women(heads),
          /** Regidories del ple del 2023, per poder jutjar el denominador. */
          expectedElected: escons,
          /** Cert només quan la font en dona tants d'electes com regidories té el ple. */
          complet,
          /** D'on surten les persones: el conjunt de candidatures o el vot nominal del Ministeri (J37). */
          font,
        });
      }

      run.rowsOut += 1;
    }

    if (noGovernmentData > 0) {
      await run.issue({
        kind: "mayor_party_unmatched",
        severity: "mitjana",
        detail: {
          municipis: noGovernmentData,
          nota: "les sigles de l'alcaldia no s'han pogut lligar a cap candidatura del 2023; cal normalitzar àlies",
        },
      });
    }
    return { municipis: run.rowsOut, alcaldies_sense_lligar: noGovernmentData };
  });

  // «L'últim regidor»: els marges de cada elecció, amb la seva pròpia execució registrada.
  await deriveMarges(db);
}

/**
 * Del vot nominal de J37, el que la paritat necessita de l'elecció del 2023:
 * quantes persones (sense els suplents del 1979, que aquí no n'hi ha) i
 * quantes dones, a la llista i entre les elegides. `null` si aquell municipi
 * no va votar en llista oberta el 2023.
 */
function eleccioOberta2023(m: LlistesObertesMetric) {
  const e = m.eleccions?.find((x) => x.any === 2023);
  if (!e) return null;
  const persones = e.candidats.filter((c) => !c.suplent);
  const elegits = persones.filter((c) => c.elegit);
  return {
    regidors: e.regidors,
    candidats: persones.length,
    donesCandidates: persones.filter((c) => c.sexe === "D").length,
    elegits: elegits.length,
    donesElegides: elegits.filter((c) => c.sexe === "D").length,
    elegitsSenseSexe: elegits.filter((c) => c.sexe === null).length,
  };
}

async function upsert(db: Db, municipalityId: number, kind: string, data: unknown): Promise<void> {
  await db
    .insert(municipalityMetrics)
    .values({ municipalityId, kind, data })
    .onConflictDoUpdate({
      target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
      set: { data, computedAt: new Date() },
    });
}
