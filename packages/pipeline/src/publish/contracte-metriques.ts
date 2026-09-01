/** Contracte mínim perquè una mètrica es pugui publicar i comparar. */
export type EstatMetrica =
  | { estat: "disponible"; valor: number }
  | { estat: "absent"; motiu: string };

export type FontMetrica = { nom: string; url: string };

export type CohortMetrica<T> = {
  periode: string;
  files: readonly { fila: T; valor: number }[];
  observades: number;
  total: number;
};

export const estatDe = (valor: number | null | undefined, motiu: string): EstatMetrica =>
  typeof valor === "number" && Number.isFinite(valor)
    ? { estat: "disponible", valor }
    : { estat: "absent", motiu };

/**
 * Tria una sola cohort temporal. Guanya l'any més recent que arriba al llindar;
 * mai no es barregen anys per fer créixer artificialment la cobertura.
 */
export function cohortHomogenia<T>(
  files: readonly T[],
  llegeix: (fila: T) => { valor: number | null | undefined; periode: number | string | null | undefined },
  coberturaMinima = 0.9,
  minim = 20,
): CohortMetrica<T> | null {
  const perPeriode = new Map<string, { fila: T; valor: number }[]>();
  for (const fila of files) {
    const dada = llegeix(fila);
    if (dada.periode === null || dada.periode === undefined) continue;
    const estat = estatDe(dada.valor, "sense valor publicat");
    if (estat.estat === "absent") continue;
    const periode = String(dada.periode);
    perPeriode.set(periode, [...(perPeriode.get(periode) ?? []), { fila, valor: estat.valor }]);
  }
  return [...perPeriode]
    .filter(([, cohort]) => cohort.length >= minim && cohort.length / files.length >= coberturaMinima)
    .sort(([a], [b]) => b.localeCompare(a, "ca", { numeric: true }))
    .map(([periode, cohort]) => ({ periode, files: cohort, observades: cohort.length, total: files.length }))[0] ?? null;
}

/** Torna tots els empats de l'extrem; zero continua sent un valor legítim. */
export function extremsEmpatats<T>(
  files: readonly { fila: T; valor: number }[],
  mena: "max" | "min",
): { valor: number; files: T[] } | null {
  if (files.length === 0) return null;
  const valor = mena === "max"
    ? Math.max(...files.map((f) => f.valor))
    : Math.min(...files.map((f) => f.valor));
  return { valor, files: files.filter((f) => f.valor === valor).map((f) => f.fila) };
}
