/**
 * Repartiment d'escons municipals: nombre de regidors segons població
 * (LOREG art. 179) i llei d'Hondt amb barrera del 5% (LOREG art. 180 i 163).
 *
 * Ho fem servir per a dues coses: derivar dades que cap font publica
 * (quants regidors tocaran el 2027 amb el padró vigent) i, sobretot, com a
 * prova de regressió de la ingesta — si el nostre recompte no reprodueix
 * els escons oficials del 2023, alguna cosa hem carregat malament.
 */

/** Trams fixos de l'article 179.1 fins a 100.000 residents. */
const BRACKETS: ReadonlyArray<readonly [maxPop: number, seats: number]> = [
  [100, 3],
  [250, 5],
  [1_000, 7],
  [2_000, 9],
  [5_000, 11],
  [10_000, 13],
  [20_000, 17],
  [50_000, 21],
  [100_000, 25],
];

/**
 * Regidors que corresponen a un municipi segons el padró.
 * Per sobre de 100.000: un regidor més per cada 100.000 residents o fracció,
 * i un més encara si el resultat és parell (el ple sempre té nombre senar).
 */
export function councilSeats(population: number): number {
  if (!Number.isFinite(population) || population < 0) {
    throw new RangeError(`població invàlida: ${population}`);
  }
  for (const [maxPop, seats] of BRACKETS) {
    if (population <= maxPop) return seats;
  }
  const seats = 25 + Math.floor(population / 100_000);
  return seats % 2 === 0 ? seats + 1 : seats;
}

export type DHondtCandidature = {
  id: string;
  votes: number;
};

export type DHondtOptions = {
  /**
   * Vots vàlids del districte (inclou els vots en blanc), base de la barrera.
   * Si no es passa, se sumen els vots de les candidatures — cosa que infla
   * lleugerament el llindar respecte de la llei.
   */
  validVotes?: number;
  /** Barrera legal: 5% dels vots vàlids. */
  threshold?: number;
};

export type DHondtResult = {
  seats: Record<string, number>;
  /** Candidatures excloses per no arribar a la barrera. */
  excluded: string[];
  /**
   * Cert si algun escó s'ha hagut de decidir per sorteig (quocients i vots
   * idèntics). La llei ho resol per sorteig, així que el nostre resultat és
   * una possibilitat, no la veritat: cal marcar-ho i no publicar-ho com a fet.
   */
  drawNeeded: boolean;
};

/**
 * Llei d'Hondt. Empat de quocients: guanya qui té més vots totals
 * (art. 163.1.d); si també empaten, la llei ho sorteja i nosaltres ho marquem.
 */
export function dHondt(
  candidatures: readonly DHondtCandidature[],
  totalSeats: number,
  opts: DHondtOptions = {},
): DHondtResult {
  const threshold = opts.threshold ?? 0.05;
  const validVotes = opts.validVotes ?? candidatures.reduce((a, c) => a + c.votes, 0);
  const minVotes = validVotes * threshold;

  const eligible = candidatures.filter((c) => c.votes >= minVotes && c.votes > 0);
  const excluded = candidatures.filter((c) => !eligible.includes(c)).map((c) => c.id);

  const seats: Record<string, number> = Object.fromEntries(candidatures.map((c) => [c.id, 0]));
  let drawNeeded = false;

  for (let s = 0; s < totalSeats; s += 1) {
    let best: DHondtCandidature | undefined;
    let bestQuotient = -1;
    let tied = false;

    for (const c of eligible) {
      const quotient = c.votes / (seats[c.id]! + 1);
      if (quotient > bestQuotient) {
        bestQuotient = quotient;
        best = c;
        tied = false;
      } else if (quotient === bestQuotient && best) {
        if (c.votes > best.votes) {
          best = c;
          tied = false;
        } else if (c.votes === best.votes) {
          tied = true; // mateix quocient i mateixos vots ⇒ sorteig
        }
      }
    }

    if (!best) break; // cap candidatura elegible: escons sense adjudicar
    if (tied) drawNeeded = true;
    seats[best.id] = seats[best.id]! + 1;
  }

  return { seats, excluded, drawNeeded };
}

/** Índex de Laakso-Taagepera: nombre efectiu de partits al ple. */
export function effectiveParties(seatsBySubject: readonly number[]): number {
  const total = seatsBySubject.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  const sumSquares = seatsBySubject.reduce((a, s) => a + (s / total) ** 2, 0);
  return sumSquares === 0 ? 0 : 1 / sumSquares;
}

/** Escons que calen per a la majoria absoluta. */
export function absoluteMajority(totalSeats: number): number {
  return Math.floor(totalSeats / 2) + 1;
}
