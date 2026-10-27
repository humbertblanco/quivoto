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

// ─────────────────────────────────────────────────────────────────────────────
// Els marges: per quants vots es va decidir cada regidoria
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El que una llista tenia a tocar, amb tota la resta igual.
 *
 * `votsPerUnaMes` són els vots **de més** que li calien per treure una
 * regidoria més, i `margeDePerdua` els que podia haver perdut sense perdre'n
 * cap. Tots dos es compten com a vots que arriben o se'n van de l'abstenció:
 * els de les altres llistes no es toquen, i per això els vots vàlids —i amb
 * ells la barrera del 5 %— es mouen amb els de la llista.
 */
export type MargeLlista = {
  id: string;
  vots: number;
  escons: number;
  /** Cert si passa la barrera del 5 % dels vots vàlids. */
  elegible: boolean;
  /** Percentatge sobre els vots vàlids (blancs inclosos), sense arrodonir. */
  pct: number;
  /** `null` si ja les té totes. */
  votsPerUnaMes: number | null;
  /** `null` si no en té cap: no en pot perdre. */
  margeDePerdua: number | null;
};

export type MargesDHondtResult = {
  escons: number;
  votsValids: number;
  /** Vots mínims per passar la barrera, tal com la compta `dHondt()`. */
  votsLlindar: number;
  /**
   * L'última regidoria que es va repartir.
   *
   * El `perseguidor` és la llista que **amb menys vots de més** l'hauria presa,
   * que no sempre és la del quocient següent més alt: una llista petita amb
   * quocient més baix pot necessitar menys vots que una de gran, perquè la
   * gran els ha de multiplicar pel nombre de regidories que ja té. El
   * quocient de cadascuna hi és perquè es pugui explicar.
   */
  ultimEsco: {
    guanyador: string;
    quocient: number;
    perseguidor: string;
    quocientPerseguidor: number;
    votsQueFaltaven: number;
  } | null;
  /** En l'ordre d'entrada. */
  llistes: MargeLlista[];
  /** Les que no van arribar al 5 %, i quants vots els en faltaven. */
  sotaLlindar: Array<{ id: string; vots: number; pct: number; votsQueFaltaven: number }>;
  /** La llista més votada, si no té la majoria absoluta: `null` si ja la té. */
  majoriaAbsoluta: { id: string; escons: number; calen: number; votsQueFaltaven: number } | null;
  /** Cert si el repartiment de partida ja va necessitar un sorteig. */
  drawNeeded: boolean;
};

/**
 * Escons d'una llista quan se li sumen `delta` vots (negatiu: se li'n
 * treuen), amb els vots vàlids moguts igual.
 *
 * La llista es posa **l'última**: `dHondt()` deixa els empats perfectes
 * —mateix quocient i mateixos vots, que la llei sorteja— a qui ja guanyava,
 * i així aquí la llista els perd tots. Un marge no pot dependre d'un sorteig:
 * «li faltaven X vots» vol dir guanyar-la sense sort, i «podia perdre'n Y»
 * vol dir conservar-la sense sort.
 */
function esconsAmb(
  candidatures: readonly DHondtCandidature[],
  index: number,
  delta: number,
  totalSeats: number,
  validVotes: number,
  threshold: number,
): number {
  const propia = candidatures[index]!;
  const altres = candidatures.filter((_, i) => i !== index);
  const result = dHondt(
    [...altres, { id: propia.id, votes: propia.votes + delta }],
    totalSeats,
    { validVotes: validVotes + delta, threshold },
  );
  return result.seats[propia.id] ?? 0;
}

/**
 * El primer enter de `[0, sostre]` que compleix una condició monòtona (falsa
 * fins a un punt i certa a partir d'aquell), o `null` si ni el sostre la
 * compleix. El sostre es dobla fins a un límit, per si l'estimació es queda
 * curta: és una fita de seguretat, no part del càlcul.
 */
function primerQueCompleix(compleix: (n: number) => boolean, sostre: number, limit = 1e9): number | null {
  if (compleix(0)) return 0;
  let hi = Math.max(1, Math.ceil(sostre));
  while (!compleix(hi)) {
    if (hi >= limit) return null;
    hi = Math.min(limit, hi * 2);
  }
  let lo = 0; // fals
  while (hi - lo > 1) {
    const mig = Math.floor((lo + hi) / 2);
    if (compleix(mig)) hi = mig;
    else lo = mig;
  }
  return hi;
}

/** Cert si, amb aquests vots i aquests vàlids, la llista passa la barrera (mateixa regla que `dHondt()`). */
const passaLlindar = (vots: number, valids: number, threshold: number): boolean =>
  vots >= valids * threshold && vots > 0;

/**
 * Vots de més que necessita una llista per passar la barrera. La primera
 * aproximació és algebraica —(5 % dels vàlids − vots) / 95 %— i després es
 * corregeix d'un en un amb la mateixa comparació que fa `dHondt()`, perquè el
 * resultat no pugui discrepar mai del repartiment per un arrodoniment.
 */
function votsPerLlindar(vots: number, valids: number, threshold: number): number {
  let x = Math.max(0, Math.ceil((threshold * valids - vots) / (1 - threshold)) - 1);
  while (!passaLlindar(vots + x, valids + x, threshold)) x += 1;
  while (x > 0 && passaLlindar(vots + x - 1, valids + x - 1, threshold)) x -= 1;
  return x;
}

/**
 * Els marges d'una elecció d'Hondt en un municipi: per quants vots es va
 * decidir l'última regidoria, quants en faltaven a cada llista per treure'n
 * una més i quants en podia perdre sense perdre'n cap, quant li va faltar a
 * cada llista que es va quedar sota el 5 % i quant a la més votada per a la
 * majoria absoluta.
 *
 * És **aritmètica amb tota la resta igual**, no una predicció: diu què hauria
 * passat si una sola llista hagués tingut uns quants vots més o menys, i
 * prou. Cada xifra es calcula tornant a passar la llei d'Hondt —amb la
 * barrera, el desempat per vots totals de l'art. 163.1 i els vots vàlids
 * moguts— i buscant el mínim per bisecció, de manera que no hi ha cap
 * fórmula tancada que es pugui equivocar en un cas estrany (una llista que,
 * en créixer els vàlids, fa caure'n una altra sota el 5 %). Funciona perquè
 * els escons d'una llista no baixen mai quan se li sumen vots.
 */
export function margesDHondt(
  candidatures: readonly DHondtCandidature[],
  totalSeats: number,
  opts: DHondtOptions = {},
): MargesDHondtResult {
  const threshold = opts.threshold ?? 0.05;
  const validVotes = opts.validVotes ?? candidatures.reduce((a, c) => a + c.votes, 0);
  const base = dHondt(candidatures, totalSeats, { validVotes, threshold });
  const maxVots = candidatures.reduce((a, c) => Math.max(a, c.votes), 0);
  const pctDe = (vots: number) => (validVotes > 0 ? (100 * vots) / validVotes : 0);

  /** Vots de més perquè la llista `i` arribi a `objectiu` regidories, o `null` si no és possible. */
  const votsPerArribarA = (i: number, objectiu: number): number | null => {
    if (objectiu > totalSeats) return null;
    const c = candidatures[i]!;
    // Amb el quocient `objectiu`-è per sobre dels vots de tothom, les té segur.
    const sostre = Math.max(objectiu * maxVots + 1 - c.votes, votsPerLlindar(c.votes, validVotes, threshold)) + 1;
    return primerQueCompleix(
      (x) => esconsAmb(candidatures, i, x, totalSeats, validVotes, threshold) >= objectiu,
      sostre,
    );
  };

  const llistes: MargeLlista[] = candidatures.map((c, i) => {
    const escons = base.seats[c.id] ?? 0;
    let margeDePerdua: number | null = null;
    if (escons > 0) {
      // El primer nombre de vots perduts que li fa perdre una regidoria; el marge és un menys.
      const perdua = primerQueCompleix(
        (y) => esconsAmb(candidatures, i, -y, totalSeats, validVotes, threshold) < escons,
        c.votes,
        c.votes,
      );
      margeDePerdua = perdua === null ? c.votes : Math.max(0, perdua - 1);
    }
    return {
      id: c.id,
      vots: c.votes,
      escons,
      elegible: passaLlindar(c.votes, validVotes, threshold),
      pct: pctDe(c.votes),
      votsPerUnaMes: votsPerArribarA(i, escons + 1),
      margeDePerdua,
    };
  });

  // L'última regidoria: el quocient guanyador més baix; a quocient igual, la
  // de menys vots, que és la que l'art. 163.1 deixa per al final.
  let ultim: MargeLlista | null = null;
  for (const l of llistes) {
    if (l.escons === 0) continue;
    if (
      !ultim ||
      l.vots / l.escons < ultim.vots / ultim.escons ||
      (l.vots / l.escons === ultim.vots / ultim.escons && l.vots < ultim.vots)
    ) {
      ultim = l;
    }
  }
  let perseguidor: MargeLlista | null = null;
  for (const l of llistes) {
    if (!ultim || l.id === ultim.id || l.votsPerUnaMes === null) continue;
    if (
      !perseguidor ||
      l.votsPerUnaMes < perseguidor.votsPerUnaMes! ||
      (l.votsPerUnaMes === perseguidor.votsPerUnaMes && l.vots / (l.escons + 1) > perseguidor.vots / (perseguidor.escons + 1))
    ) {
      perseguidor = l;
    }
  }

  // La més votada i la majoria absoluta. A vots iguals, la primera de l'entrada.
  let gran = -1;
  candidatures.forEach((c, i) => {
    if (gran < 0 || c.votes > candidatures[gran]!.votes) gran = i;
  });
  const calen = absoluteMajority(totalSeats);
  let majoriaAbsoluta: MargesDHondtResult["majoriaAbsoluta"] = null;
  if (gran >= 0 && totalSeats > 0 && llistes[gran]!.escons < calen) {
    const falten = votsPerArribarA(gran, calen);
    if (falten !== null) {
      majoriaAbsoluta = { id: llistes[gran]!.id, escons: llistes[gran]!.escons, calen, votsQueFaltaven: falten };
    }
  }

  return {
    escons: totalSeats,
    votsValids: validVotes,
    votsLlindar: validVotes * threshold,
    ultimEsco:
      ultim && perseguidor
        ? {
            guanyador: ultim.id,
            quocient: ultim.vots / ultim.escons,
            perseguidor: perseguidor.id,
            quocientPerseguidor: perseguidor.vots / (perseguidor.escons + 1),
            votsQueFaltaven: perseguidor.votsPerUnaMes!,
          }
        : null,
    llistes,
    sotaLlindar: llistes
      .filter((l) => !l.elegible)
      .map((l) => ({ id: l.id, vots: l.vots, pct: l.pct, votsQueFaltaven: votsPerLlindar(l.vots, validVotes, threshold) })),
    majoriaAbsoluta,
    drawNeeded: base.drawNeeded,
  };
}
