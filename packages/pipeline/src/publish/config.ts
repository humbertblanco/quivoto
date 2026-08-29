/**
 * Interruptors de publicació.
 *
 * Viu en un fitxer propi i no dins de `publish.ts` perquè la plantilla de la
 * fitxa també l'ha de llegir, i tenir-los important-se l'un a l'altre acabaria
 * en una dependència circular.
 */

/**
 * Mentre valgui `false`, cada fitxa surt amb `noindex` i el sitemap existeix
 * però no s'enllaça: les pàgines es poden obrir amb l'adreça, però no s'indexen.
 * Es posa a `true` amb `QUIVOTO_INDEXABLE=1`, i només després d'haver revisat a
 * mà una mostra de fitxes de mides diferents.
 */
export const INDEXABLE = process.env.QUIVOTO_INDEXABLE === "1";

/** Arrel pública, per als enllaços canònics i el sitemap. */
export const SITE = "https://quivoto.cat";
