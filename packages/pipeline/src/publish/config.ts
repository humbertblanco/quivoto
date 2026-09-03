/**
 * Interruptors de publicació.
 *
 * Viu en un fitxer propi i no dins de `publish.ts` perquè la plantilla de la
 * fitxa també l'ha de llegir, i tenir-los important-se l'un a l'altre acabaria
 * en una dependència circular.
 */

/**
 * Si les pàgines de l'Observatori s'indexen. Val `true` per defecte: cada
 * pàgina surt amb `index,follow`, el sitemap és a `robots.txt` i les dades
 * enriquides (JSON-LD) hi són perquè els cercadors les llegeixin.
 *
 * L'interruptor serveix per TANCAR, no per obrir: `QUIVOTO_NOINDEX=1` fa que
 * cada pàgina surti amb `noindex,nofollow`. És per a una publicació que no es
 * vol al cercador —un servidor de proves, una tanda amb dades a mig
 * revisar— i mai per al que es puja a quivoto.cat. Abans era al revés
 * (`QUIVOTO_INDEXABLE=1` obria), i el risc era publicar de debò amb la
 * variable oblidada: 17.000 pàgines tancades sense que ningú se n'adonés
 * fins que Search Console ho digués una setmana després.
 *
 * Una pàgina concreta —una demostració, un esborrany— es tanca a part, amb
 * `noIndex: true` a `capSeo()`, i el sitemap la deixa fora (`publish.ts`).
 */
export const INDEXABLE = process.env.QUIVOTO_NOINDEX !== "1";

/** Arrel pública, per als enllaços canònics i el sitemap. */
export const SITE = "https://quivoto.cat";
