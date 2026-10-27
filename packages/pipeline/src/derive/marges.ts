import { and, eq, notInArray } from "drizzle-orm";
import {
  candidatures, electionParticipation, electionResults, municipalities, municipalityMetrics, type Db,
} from "@quivoto/db";
import { MUNICIPAL_ELECTIONS } from "@quivoto/shared-schemas/brands";
import { dHondt, margesDHondt } from "@quivoto/shared-schemas/seats";
import type { EleccioLlistaOberta, LlistesObertesMetric } from "../jobs/j37-llistes-obertes";
import { withRun } from "../lib/run";

/**
 * «L'últim regidor»: per quants vots es va decidir cada ple.
 *
 * La fitxa diu quantes regidories va treure cada llista, i prou. El que no
 * diu ningú és **com de just** va anar: a Vic, el 2023, l'última regidoria va
 * ser de Junts per Vic i a Ara Vic li'n van faltar set vots. Set vots en una
 * ciutat de 48.000 habitants és la mena de dada que fa entendre a qualsevol
 * veí que el seu vot compta, i és aritmètica pura sobre els resultats
 * oficials: no hi ha cap estimació ni cap model.
 *
 * ─── EL QUE ES CALCULA, I EL QUE NO ─────────────────────────────────────────
 *
 * Als municipis de **llistes tancades** (més de 250 habitants, més de cinc
 * regidories) es torna a passar la llei d'Hondt amb `margesDHondt()` de
 * `shared-schemas/seats.ts`: l'última regidoria i qui la tenia més a tocar,
 * quants vots de més calien a cada llista per a una regidoria més i quants en
 * podia perdre sense perdre'n cap, quant va faltar a les que es van quedar
 * sota el 5 % i quant a la més votada per a la majoria absoluta. Sempre amb
 * **tota la resta igual**: els vots de més vénen de l'abstenció, cap altra
 * llista no en perd. No és una predicció del 2027 i no s'ha de presentar mai
 * com si ho fos.
 *
 * Una elecció **no entra** si el nostre recompte no reprodueix els escons
 * oficials —és el mateix que J2 registra com a `seats_mismatch`— o si el
 * repartiment de partida va necessitar un sorteig: un marge calculat sobre un
 * repartiment que no és l'oficial seria un número inventat. Es comprova aquí
 * mateix en comptes de llegir les incidències, perquè així no depèn de l'ordre
 * en què s'hagin executat els jobs.
 *
 * Als municipis de **llistes obertes** (fins a 250 habitants) no hi ha llei
 * d'Hondt: surten elegides les persones més votades. Allà el marge és entre
 * l'última persona elegida i la primera que va quedar fora, i surt del vot
 * nominal del Ministeri que desa J37 (`llistesObertes`). Si un municipi no en
 * té fitxa, aquella elecció no hi és.
 *
 * Es desa a `municipality_metrics` amb `kind = "marges"`. La forma de dalt
 * (`MargesMetric`) la fan servir altres generadors: s'hi poden afegir camps,
 * però no se n'hi ha de canviar el nom de cap.
 */

export const KIND_MARGES = "marges";

const ANY_ELECCIO: Record<string, number> = { M20151: 2015, M20191: 2019, M20231: 2023 };

export type MargesLlistaMetric = {
  /** Denominació de la candidatura, o les sigles si la font no en dona cap. */
  nom: string;
  sigla: string;
  /** Codi de la candidatura al dataset electoral: la clau estable per creuar-la. */
  codi: string;
  vots: number;
  escons: number;
  /** Vots de més que li calien per a una regidoria més; `null` si ja les tenia totes o no és possible. */
  votsPerUnaMes: number | null;
  /** Vots que podia perdre sense perdre cap regidoria; `null` si no en tenia cap. */
  margeDePerdua: number | null;
  /** Percentatge sobre els vots vàlids, amb dos decimals; `null` a les llistes obertes. */
  pct: number | null;
};

export type MargesEleccio = {
  any: number;
  sistema: "dhondt" | "obertes";
  escons: number;
  /** Vots vàlids (blancs inclosos): la base de la barrera del 5 %. */
  votsValids: number;
  ultimEsco: {
    /** La llista (d'Hondt) o la persona (llistes obertes) que es va endur l'última regidoria. */
    guanyador: string;
    /** La llista o la persona que amb menys vots de més l'hauria presa. */
    perseguidor: string;
    votsQueFaltaven: number;
    siglaGuanyador: string;
    siglaPerseguidor: string;
    /** Només d'Hondt: el quocient de l'última regidoria i el del perseguidor per a la seva següent. */
    quocientGuanyador: number | null;
    quocientPerseguidor: number | null;
    /** Només llistes obertes: vots de l'última persona elegida i de la primera que va quedar fora. */
    votsGuanyador: number | null;
    votsPerseguidor: number | null;
  } | null;
  /** De més a menys vots. */
  llistes: MargesLlistaMetric[];
  /** Les llistes que no van arribar al 5 %. A les llistes obertes, sempre buida: no hi ha barrera. */
  llindar: Array<{ nom: string; sigla: string; codi: string; vots: number; pct: number; votsQueFaltaven: number }>;
  /** La llista més votada, quan no té la majoria absoluta; `null` si la té o a les llistes obertes. */
  majoriaAbsoluta: { llista: string; sigla: string; escons: number; calen: number; votsQueFaltaven: number } | null;
};

export type MargesMetric = {
  /** Cronològiques; només les que s'han pogut calcular. */
  eleccions: MargesEleccio[];
};

/** Una candidatura d'una elecció, tal com surt de `candidatures` + `election_results`. */
export type LlistaResultat = {
  codi: string;
  sigles: string;
  denominacio: string | null;
  votes: number;
  seats: number;
};

const dosDecimals = (n: number): number => Math.round(n * 100) / 100;
const nomDe = (l: LlistaResultat): string => (l.denominacio?.trim() ? l.denominacio.trim() : l.sigles);

/**
 * Els marges d'una elecció de llistes tancades, o `null` si no s'han de
 * publicar: un ple de cinc regidories o menys (llista oberta), cap vot, o un
 * recompte que no reprodueix l'oficial o que depèn d'un sorteig.
 *
 * `votsValids` ve de la participació (J5). Si no hi és, se sumen els vots de
 * les candidatures, que és el que fa `dHondt()` per defecte: la barrera queda
 * una mica més baixa que la legal, i per això també es comprova el recompte.
 */
export function margesEleccioDHondt(
  any: number,
  llistes: readonly LlistaResultat[],
  votsValids: number | null,
): MargesEleccio | null {
  const escons = llistes.reduce((a, l) => a + l.seats, 0);
  if (escons <= 5 || llistes.length === 0) return null;
  const valids = votsValids ?? llistes.reduce((a, l) => a + l.votes, 0);
  if (valids <= 0) return null;

  const entrada = llistes.map((l) => ({ id: l.codi, votes: l.votes }));
  const recompte = dHondt(entrada, escons, { validVotes: valids });
  if (recompte.drawNeeded) return null;
  if (llistes.some((l) => (recompte.seats[l.codi] ?? 0) !== l.seats)) return null;

  const m = margesDHondt(entrada, escons, { validVotes: valids });
  const perCodi = new Map(llistes.map((l) => [l.codi, l]));
  const llista = (codi: string) => perCodi.get(codi)!;

  return {
    any,
    sistema: "dhondt",
    escons,
    votsValids: valids,
    ultimEsco: m.ultimEsco
      ? {
          guanyador: nomDe(llista(m.ultimEsco.guanyador)),
          perseguidor: nomDe(llista(m.ultimEsco.perseguidor)),
          votsQueFaltaven: m.ultimEsco.votsQueFaltaven,
          siglaGuanyador: llista(m.ultimEsco.guanyador).sigles,
          siglaPerseguidor: llista(m.ultimEsco.perseguidor).sigles,
          quocientGuanyador: dosDecimals(m.ultimEsco.quocient),
          quocientPerseguidor: dosDecimals(m.ultimEsco.quocientPerseguidor),
          votsGuanyador: null,
          votsPerseguidor: null,
        }
      : null,
    llistes: m.llistes
      .map((l) => ({
        nom: nomDe(llista(l.id)),
        sigla: llista(l.id).sigles,
        codi: l.id,
        vots: l.vots,
        escons: l.escons,
        votsPerUnaMes: l.votsPerUnaMes,
        margeDePerdua: l.margeDePerdua,
        pct: dosDecimals(l.pct),
      }))
      .sort((a, b) => b.vots - a.vots || a.sigla.localeCompare(b.sigla, "ca")),
    llindar: m.sotaLlindar
      .map((s) => ({
        nom: nomDe(llista(s.id)),
        sigla: llista(s.id).sigles,
        codi: s.id,
        vots: s.vots,
        pct: dosDecimals(s.pct),
        votsQueFaltaven: s.votsQueFaltaven,
      }))
      .sort((a, b) => a.votsQueFaltaven - b.votsQueFaltaven),
    majoriaAbsoluta: m.majoriaAbsoluta
      ? {
          llista: nomDe(llista(m.majoriaAbsoluta.id)),
          sigla: llista(m.majoriaAbsoluta.id).sigles,
          escons: m.majoriaAbsoluta.escons,
          calen: m.majoriaAbsoluta.calen,
          votsQueFaltaven: m.majoriaAbsoluta.votsQueFaltaven,
        }
      : null,
  };
}

/**
 * Els marges d'una elecció de llistes obertes, a partir del vot nominal.
 *
 * Surten elegides les persones més votades, vinguin de la llista que vinguin,
 * i un empat el decideix la sort. Per això:
 *
 *   · l'**últim escó** és de la persona elegida amb menys vots, i el
 *     perseguidor és la no elegida amb més; li calien la diferència **més
 *     un** per passar-la sense sorteig;
 *   · a cada candidatura, **una més** vol dir que la seva millor persona no
 *     elegida passi l'última elegida *d'una altra* llista (passar una
 *     companya no li dona cap regidoria), i **el marge** és quants vots podia
 *     perdre la seva elegida més fluixa abans de quedar empatada amb la
 *     primera persona d'una altra llista que va quedar fora.
 *
 * Els vots de cada candidatura no se sumen: cada elector escriu diversos noms
 * i els vots d'una persona no s'afegeixen als de les altres. A la llista hi va
 * el de la seva persona més votada, que és l'única xifra que es pot llegir.
 */
export function margesEleccioOberta(e: EleccioLlistaOberta, votsValids: number | null): MargesEleccio | null {
  const candidats = e.candidats.filter((c) => !c.suplent);
  const elegits = candidats.filter((c) => c.elegit);
  const fora = candidats.filter((c) => !c.elegit);
  if (elegits.length === 0) return null;

  const minim = <T extends { vots: number }>(xs: readonly T[]): T | null =>
    xs.length === 0 ? null : xs.reduce((a, b) => (b.vots < a.vots ? b : a));
  const maxim = <T extends { vots: number }>(xs: readonly T[]): T | null =>
    xs.length === 0 ? null : xs.reduce((a, b) => (b.vots > a.vots ? b : a));

  const ultim = minim(elegits)!;
  const primerFora = maxim(fora);

  // Per candidatura, en l'ordre de la seva persona més votada.
  const codis = [...new Set(candidats.map((c) => c.candidatura.codi))];
  const llistes: MargesLlistaMetric[] = codis.map((codi) => {
    const propis = candidats.filter((c) => c.candidatura.codi === codi);
    const cand = propis[0]!.candidatura;
    const elegitsPropis = propis.filter((c) => c.elegit);
    const millorFora = maxim(propis.filter((c) => !c.elegit));
    const ultimAltres = minim(elegits.filter((c) => c.candidatura.codi !== codi));
    const primerForaAltres = maxim(fora.filter((c) => c.candidatura.codi !== codi));
    const fluix = minim(elegitsPropis);
    return {
      nom: cand.nom.trim() || cand.sigles || codi,
      sigla: cand.sigles || cand.nom.trim() || codi,
      codi,
      vots: maxim(propis)!.vots,
      escons: elegitsPropis.length,
      votsPerUnaMes: millorFora && ultimAltres ? Math.max(1, ultimAltres.vots - millorFora.vots + 1) : null,
      margeDePerdua:
        fluix === null ? null : primerForaAltres === null ? fluix.vots : Math.max(0, fluix.vots - primerForaAltres.vots - 1),
      pct: null,
    };
  });
  llistes.sort((a, b) => b.vots - a.vots || a.sigla.localeCompare(b.sigla, "ca"));

  const valids = votsValids ?? (e.votants !== null && e.nuls !== null ? e.votants - e.nuls : 0);
  return {
    any: e.any,
    sistema: "obertes",
    escons: e.regidors,
    votsValids: valids,
    ultimEsco: primerFora
      ? {
          guanyador: ultim.nom,
          perseguidor: primerFora.nom,
          votsQueFaltaven: Math.max(1, ultim.vots - primerFora.vots + 1),
          siglaGuanyador: ultim.candidatura.sigles,
          siglaPerseguidor: primerFora.candidatura.sigles,
          quocientGuanyador: null,
          quocientPerseguidor: null,
          votsGuanyador: ultim.vots,
          votsPerseguidor: primerFora.vots,
        }
      : null,
    llistes,
    llindar: [],
    majoriaAbsoluta: null,
  };
}

/**
 * La mètrica d'un municipi: per a cada elecció del 2015, 2019 i 2023, el vot
 * nominal si n'hi ha (llista oberta) i, si no, la llei d'Hondt. `null` si no
 * en surt cap.
 */
export function construeixMarges(
  resultats: ReadonlyMap<string, readonly LlistaResultat[]>,
  valids: ReadonlyMap<string, number>,
  obertes: LlistesObertesMetric | null,
): MargesMetric | null {
  const eleccions: MargesEleccio[] = [];
  for (const electionId of MUNICIPAL_ELECTIONS) {
    const any = ANY_ELECCIO[electionId];
    if (any === undefined) continue;
    const oberta = obertes?.eleccions.find((e) => e.any === any);
    const eleccio = oberta
      ? margesEleccioOberta(oberta, valids.get(electionId) ?? null)
      : margesEleccioDHondt(any, resultats.get(electionId) ?? [], valids.get(electionId) ?? null);
    if (eleccio) eleccions.push(eleccio);
  }
  eleccions.sort((a, b) => a.any - b.any);
  return eleccions.length === 0 ? null : { eleccions };
}

/**
 * Llegeix els resultats de les tres municipals, els vots vàlids i el vot
 * nominal de J37, i desa la mètrica `marges` de cada municipi. Els municipis
 * que avui no en treuen cap perden la fila que tinguessin: una xifra vella
 * calculada amb uns vots que ja no són els carregats no s'ha de quedar.
 *
 * El crida `deriveMetrics()` al final, de manera que `start derive` la fa.
 */
export async function deriveMarges(db: Db): Promise<void> {
  await withRun(db, "derive: marges de l'últim regidor", async (run) => {
    const munis = await db.select({ id: municipalities.id }).from(municipalities);
    run.rowsIn = munis.length;

    const files = await db
      .select({
        municipalityId: candidatures.municipalityId,
        electionId: candidatures.electionId,
        codi: candidatures.candidaturaCodi,
        sigles: candidatures.sigles,
        denominacio: candidatures.denominacio,
        votes: electionResults.votes,
        seats: electionResults.seats,
      })
      .from(candidatures)
      .innerJoin(electionResults, eq(electionResults.candidatureId, candidatures.id));
    const resultats = new Map<number, Map<string, LlistaResultat[]>>();
    for (const f of files) {
      let perEleccio = resultats.get(f.municipalityId);
      if (!perEleccio) resultats.set(f.municipalityId, (perEleccio = new Map()));
      const llista = perEleccio.get(f.electionId) ?? [];
      llista.push({ codi: f.codi, sigles: f.sigles, denominacio: f.denominacio, votes: f.votes, seats: f.seats });
      perEleccio.set(f.electionId, llista);
    }

    const valids = new Map<number, Map<string, number>>();
    for (const p of await db.select().from(electionParticipation)) {
      if (p.validVotes === null) continue;
      let perEleccio = valids.get(p.municipalityId);
      if (!perEleccio) valids.set(p.municipalityId, (perEleccio = new Map()));
      perEleccio.set(p.electionId, p.validVotes);
    }

    const obertes = new Map<number, LlistesObertesMetric>();
    for (const r of await db
      .select({ municipalityId: municipalityMetrics.municipalityId, data: municipalityMetrics.data })
      .from(municipalityMetrics)
      .where(eq(municipalityMetrics.kind, "llistesObertes"))) {
      obertes.set(r.municipalityId, r.data as LlistesObertesMetric);
    }

    let dhondt = 0;
    let nominals = 0;
    let descartades = 0;
    const desats: number[] = [];
    for (const m of munis) {
      const perEleccio = resultats.get(m.id) ?? new Map<string, LlistaResultat[]>();
      const data = construeixMarges(perEleccio, valids.get(m.id) ?? new Map(), obertes.get(m.id) ?? null);
      // Eleccions de llista tancada (més de cinc regidories) que no han donat
      // marges: el recompte no quadra amb l'oficial o va caldre un sorteig.
      const fetes = new Set(data?.eleccions.map((e) => e.any) ?? []);
      for (const [electionId, llistes] of perEleccio) {
        const any = ANY_ELECCIO[electionId];
        if (any !== undefined && !fetes.has(any) && llistes.reduce((a, x) => a + x.seats, 0) > 5) descartades += 1;
      }
      const dHondtFetes = data?.eleccions.filter((e) => e.sistema === "dhondt").length ?? 0;
      if (!data) continue;
      dhondt += dHondtFetes;
      nominals += data.eleccions.length - dHondtFetes;
      await db
        .insert(municipalityMetrics)
        .values({ municipalityId: m.id, kind: KIND_MARGES, data })
        .onConflictDoUpdate({
          target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
          set: { data, computedAt: new Date() },
        });
      desats.push(m.id);
      run.rowsOut += 1;
    }
    await db.delete(municipalityMetrics).where(
      desats.length > 0
        ? and(eq(municipalityMetrics.kind, KIND_MARGES), notInArray(municipalityMetrics.municipalityId, desats))
        : eq(municipalityMetrics.kind, KIND_MARGES),
    );
    run.say(`${run.rowsOut} municipis · ${dhondt} eleccions d'Hondt · ${nominals} de llista oberta · ${descartades} descartades (recompte o sorteig)`);
    return { municipis: run.rowsOut, dhondt, nominals, descartades };
  });
}
