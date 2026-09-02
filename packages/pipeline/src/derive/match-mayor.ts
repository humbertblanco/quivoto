import { siglesFamily } from "@quivoto/shared-schemas/brands";
import { normalize } from "../lib/text";

/**
 * Lliga el partit de l'alcaldia amb la candidatura que el va portar al ple.
 *
 * El camp `partitpol` del padró d'ens locals ve **truncat a uns deu caràcters** i
 * amb la puntuació canviada: «SOM DE CASTELLAR-PSC-CP» hi surt com a
 * «SOMC-PSC-C», i «araC-AM» com a «araC-A». Per això no serveix comparar cadenes
 * senceres i cal una escala de criteris, del més segur al més arriscat.
 *
 * Cada resultat porta el mètode amb què s'ha resolt, perquè a la fitxa pública
 * es pugui dir d'on surt i perquè els aparellaments febles es puguin revisar.
 */

export type MatchCandidate = {
  candidatureId: number;
  sigles: string;
  agrupacioSigles: string | null;
  brandId: string | null;
  seats: number;
};

export type MayorMatch = {
  candidatureId: number;
  /** exacte · agrupació · marca · prefix · únic-amb-escons */
  method: string;
  /** 1 = segur; per sota de 0,7 val més revisar-ho a mà. */
  confidence: number;
};

/** Compacta per comparar: sense accents, ni espais, ni signes. */
function key(text: string): string {
  return normalize(text).replace(/[^a-z0-9]/g, "");
}

/** Trossos separats per guions o espais. */
function tokens(text: string): string[] {
  return normalize(text).split(/[^a-z0-9]+/).filter(Boolean);
}

/** Últim tros: sol ser el codi de l'agrupació. */
function tail(text: string): string {
  const parts = tokens(text);
  return parts.length > 0 ? parts[parts.length - 1]! : "";
}

/** Distància d'edició entre dues cadenes curtes: «horitzo31» i «horitzo32» són a 1. */
function distancia(a: string, b: string): number {
  const fila = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let anterior = fila[0]!;
    fila[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = fila[j]!;
      fila[j] = Math.min(fila[j]! + 1, fila[j - 1]! + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1));
      anterior = temp;
    }
  }
  return fila[b.length]!;
}

/** La «x» de «per» fora: «IxSC» i «ISC» són la mateixa llista escrita de dues maneres. */
const senseX = (text: string): string => key(text).replace(/(?<=[a-z])x(?=[a-z])/g, "");

/**
 * Trossos compartits entre dos noms, comptant també els que un té escapçats:
 * «SOMC-PSC-C» i «SOM DE CASTELLAR-PSC-CP» comparteixen «psc», i «somc» comença
 * per «som». Amb dos noms tan maltractats com aquests, és l'únic que lliga.
 */
function sharedTokens(a: readonly string[], b: readonly string[]): number {
  let score = 0;
  for (const x of a) {
    if (x.length < 2) continue;
    if (b.includes(x)) score += 2;
    else if (b.some((y) => y.length >= 3 && (x.startsWith(y) || y.startsWith(x)))) score += 1;
  }
  return score;
}

export function matchMayorParty(
  mayorPartyRaw: string | null | undefined,
  candidates: readonly MatchCandidate[],
): MayorMatch | null {
  const withSeats = candidates.filter((c) => c.seats > 0);
  if (withSeats.length === 0) return null;

  // Un sol grup al ple: no hi ha res a decidir.
  if (withSeats.length === 1 && mayorPartyRaw) {
    return { candidatureId: withSeats[0]!.candidatureId, method: "únic-amb-escons", confidence: 0.9 };
  }
  if (!mayorPartyRaw) return null;

  const target = key(mayorPartyRaw);
  if (!target) return null;

  const unique = (matches: MatchCandidate[], method: string, confidence: number): MayorMatch | null =>
    matches.length === 1 ? { candidatureId: matches[0]!.candidatureId, method, confidence } : null;

  // 1. Coincidència exacta de sigles.
  const exact = unique(withSeats.filter((c) => key(c.sigles) === target), "exacte", 1);
  if (exact) return exact;

  // 2. El nom truncat és el començament de les sigles reals («araC-A» → «araC-AM»).
  const prefix = withSeats.filter((c) => {
    const k = key(c.sigles);
    return k.startsWith(target) || target.startsWith(k);
  });
  const byPrefix = unique(prefix, "prefix", target.length >= 6 ? 0.9 : 0.7);
  if (byPrefix) return byPrefix;

  // 3. El sufix és el codi de l'agrupació («ERC - AM» → la candidatura amb agrupació AM).
  const suffix = tail(mayorPartyRaw);
  if (suffix) {
    const byAgrupacio = unique(
      withSeats.filter((c) => c.agrupacioSigles && key(c.agrupacioSigles) === suffix),
      "agrupació",
      0.85,
    );
    if (byAgrupacio) return byAgrupacio;
  }

  // 4. Coincidència amb la marca sencera («AMUNT» → la candidatura de la CUP).
  const byBrand = unique(
    withSeats.filter((c) => (c.agrupacioSigles && key(c.agrupacioSigles) === target) || key(c.brandId ?? "") === target),
    "marca",
    0.8,
  );
  if (byBrand) return byBrand;

  // 5. El nom truncat apareix dins de les sigles d'una sola llista.
  const contains = withSeats.filter((c) => target.length >= 5 && key(c.sigles).includes(target));
  const byContains = unique(contains, "conté", 0.65);
  if (byContains) return byContains;

  /*
   * 5b. La mateixa família de marca. «CP» és la Candidatura de Progrés, que a
   * Vilaller es presenta com a «MÉS X VILALLER-CANDIDATURA DE PROGRÉS»; «PLV/ERC»
   * és la llista que el registre electoral té sota el codi d'agrupació d'ERC.
   * Quan el partit de l'alcaldia i una sola llista amb regidories pertanyen a la
   * mateixa família (per sigles o pel codi d'agrupació), és aquella.
   */
  const familia = siglesFamily(mayorPartyRaw);
  if (familia && familia !== "local") {
    const deLaFamilia = unique(
      withSeats.filter((c) => (c.brandId && c.brandId !== "local" ? c.brandId : siglesFamily(c.sigles)) === familia),
      "família",
      0.75,
    );
    if (deLaFamilia) return deLaFamilia;
  }

  /*
   * 5c. La «x» de «per» i les errates d'una lletra. El padró escriu «IxSC» i
   * el registre «ISC-IdSELVA»; «HORITZÓ31» i «HORITZÓ32» són la mateixa llista
   * amb un dit que ha relliscat; «AMUNT» i «AMONT» és l'occità de la Vall de
   * Cardós. Es compara sense la «x» entremig i amb una lletra de marge, només
   * en trossos prou llargs perquè una lletra no sigui mitja paraula.
   */
  const objectiuSenseX = senseX(mayorPartyRaw);
  // Els trossos del padró també van sense la x i, com que venen escapçats,
  // es comparen pels cinc primers caràcters: «SumemxS» i «Sumen» són «sumem»
  // i «sumen», a una lletra.
  const trossosObjectiu = tokens(mayorPartyRaw).map((t) => senseX(t)).filter((t) => t.length >= 5);
  const semblants = (a: string, b: string): boolean => {
    if (a.length < 5 || b.length < 5) return false;
    if (distancia(a, b) <= 1) return true;
    const n = Math.min(a.length, b.length, 6);
    return distancia(a.slice(0, n), b.slice(0, n)) <= 1;
  };
  const aproximats = withSeats.filter((c) => {
    const trossos = [key(c.sigles), ...tokens(c.sigles)].filter((t) => t.length >= 3);
    return trossos.some(
      (t) =>
        t === objectiuSenseX ||
        senseX(t) === objectiuSenseX ||
        semblants(t, objectiuSenseX) ||
        semblants(t, target) ||
        trossosObjectiu.some((o) => semblants(senseX(t), o)),
    );
  });
  const perAproximacio = unique(aproximats, "aproximat", 0.65);
  if (perAproximacio) return perAproximacio;

  // 6. Últim recurs: qui comparteix més trossos del nom, si en destaca un de sol.
  const mayorTokens = tokens(mayorPartyRaw);
  const scored = withSeats
    .map((c) => ({ candidate: c, score: sharedTokens(mayorTokens, tokens(c.sigles)) }))
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score);
  if (scored.length > 0 && (scored.length === 1 || scored[0]!.score > scored[1]!.score)) {
    return { candidatureId: scored[0]!.candidate.candidatureId, method: "trossos", confidence: 0.7 };
  }
  return null;
}
