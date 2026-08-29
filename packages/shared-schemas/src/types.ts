/** Text en les tres llengües del portal. `ca` és obligatori. */
export type I18nText = { ca: string; es?: string; oc?: string };

export type Lang = "ca" | "es" | "oc";
export const LANGS: readonly Lang[] = ["ca", "es", "oc"] as const;

/**
 * Escala d'acord de −2 a 2. És la mateixa per a l'usuari i per als subjectes
 * (candidatures i persones); 0 («ni una cosa ni l'altra») és una posició real
 * i puntua distància, a diferència d'ometre.
 */
export type Value = -2 | -1 | 0 | 1 | 2;
export const VALUES: readonly Value[] = [-2, -1, 0, 1, 2] as const;

export function isValue(n: unknown): n is Value {
  return typeof n === "number" && Number.isInteger(n) && n >= -2 && n <= 2;
}
