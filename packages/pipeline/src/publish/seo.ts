/**
 * El cap de pàgina que llegeixen els cercadors i les xarxes: títol,
 * descripció, canònica, Open Graph, Twitter i dades estructurades.
 *
 * Abans cada plantilla s'ho escrivia: hi havia tres sufixos de títol
 * diferents («· Observatori de quivoto», «— Observatori municipal de
 * quivoto», «· Observatori · quivoto»), Open Graph només a quatre pàgines i
 * cap dada estructurada enlloc. Ara totes criden `capSeo()` amb el que és
 * seu —el títol, la descripció, l'adreça, la imatge si en té una de pròpia—
 * i el que és igual a tot arreu (el sufix, el `site_name`, el `locale`, la
 * targeta de Twitter, l'organització) s'escriu aquí una sola vegada.
 *
 * ## Les mides
 *
 * Un títol que passa de 60 caràcters el cercador el talla; una descripció
 * que passa de 160 també. Aquí no es talla el que ve: es comprova. El sufix
 * « · quivoto» s'afegeix només si hi cap, perquè val més un títol sencer
 * sense marca que una marca amb el títol a mitges. La descripció es retalla
 * a l'última paraula sencera abans dels 158 caràcters, amb punts suspensius.
 *
 * ## `noindex`
 *
 * Per defecte cada pàgina porta `index,follow,max-image-preview:large`: el
 * `max-image-preview` deixa que el cercador ensenyi la imatge social sencera
 * al resultat. Amb `QUIVOTO_NOINDEX=1` (`config.ts`) totes surten amb
 * `noindex,nofollow`, i una pàgina sola es tanca amb `noIndex: true`: és el
 * cas de les demostracions de les preguntes, que són esborranys editorials.
 * El sitemap (a `publish.ts`) deixa fora el que porta `noindex` de pàgina,
 * perquè un sitemap que apunta a pàgines tancades és un error a Search Console.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { INDEXABLE, SITE } from "./config";

const escape = (t: string): string =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** El nom del lloc tal com va a la marca i als títols. */
export const MARCA = "quivoto";

/** La imatge social de reserva, per a les pàgines que no en tenen una de pròpia. */
export const IMATGE_PER_DEFECTE = `${SITE}/assets/og.png`;

/** L'arrel del que se serveix: on `imatgeSocial()` mira si la imatge hi és. */
const ARREL_PUBLIC = new URL("../../../../web/public", import.meta.url).pathname;

/**
 * La imatge social d'una pàgina, si ja existeix; si no, la de reserva.
 *
 * Les imatges les fa `og.ts` **després** d'escriure les pàgines, i només per
 * als municipis de la tanda: en una publicació parcial —`publica girona`— la
 * fitxa d'un regidor de Reus s'escriu sense que la seva imatge s'hagi tornat
 * a fer, i a la primera publicació de totes encara no n'hi ha cap. Una pàgina
 * que apuntés a una imatge que no hi és sortiria sense cap imatge a WhatsApp,
 * que és pitjor que sortir amb la de la casa. Per això es mira el disc, i es
 * mira de manera síncrona: la crida és dins d'una plantilla que torna una
 * cadena, i són 9.000 comprovacions d'un `stat` cadascuna, que no es noten.
 *
 * `cami` és el públic, amb la barra inicial: `/observatori/og/sabadell.png`.
 */
export function imatgeSocial(cami: string): string {
  return existsSync(join(ARREL_PUBLIC, cami)) ? `${SITE}${cami}` : IMATGE_PER_DEFECTE;
}

/**
 * On va cada imatge social, relatiu a `/observatori/og/`. És l'únic lloc on
 * s'escriu el nom del fitxer: el generador (`og.ts`) i les plantilles el
 * demanen aquí, i així no poden divergir.
 *
 * Els regidors i les alcaldies històriques van a `p/` perquè són persones i n'hi
 * ha nou mil; les segones porten «alcaldia» al mig perquè un exalcalde que
 * avui seu al ple té dues pàgines diferents i no poden compartir imatge.
 */
export const FITXER_OG = {
  municipi: (slug: string): string => `${slug}.png`,
  regidor: (slugMunicipi: string, adreca: string): string => `p/${slugMunicipi}--${adreca}.jpg`,
  alcaldia: (slugMunicipi: string, slugPersona: string): string => `p/${slugMunicipi}--alcaldia--${slugPersona}.jpg`,
  comarca: (slug: string): string => `c/${slug}.png`,
  amb: (): string => "amb.png",
  partit: (id: string): string => `partit/${id}.png`,
  /** Les pàgines globals: `observatori`, `els947`, `mapa`, `ranquings`, `comparador`, `dades`, `preguntes`, `trajectoria`. */
  global: (nom: string): string => `${nom}.png`,
} as const;

/** La imatge social d'un fitxer de `FITXER_OG`, si ja és a disc; si no, la de reserva. */
export function imatgeOg(fitxer: string): string {
  return imatgeSocial(`/observatori/og/${fitxer}`);
}

/**
 * Si una pàgina ja escrita porta `noindex`. El sitemap ho mira sobre el HTML
 * de disc perquè el pipeline no guarda cap llista de què s'ha tancat: la
 * decisió és de cada plantilla (`noIndex: true`) i el fitxer és l'única
 * font que la conserva.
 */
export function portaNoIndex(html: string): boolean {
  return /<meta name="robots" content="noindex[^"]*">/.test(html);
}

export const TITOL_MAXIM = 60;
export const DESCRIPCIO_MAXIMA = 158;

export type TipusPagina = "website" | "article" | "profile";

export type MetaPagina = {
  /** El títol sense la marca: «Sabadell», «Rànquings dels 947 municipis». */
  titol: string;
  /** La frase per al cercador i les xarxes: què hi ha en aquesta pàgina i quines xifres. */
  descripcio: string;
  /** L'adreça canònica, absoluta. */
  url: string;
  /** La imatge social pròpia, absoluta; sense, la de reserva. */
  imatge?: string | null;
  /** El tipus per a l'Open Graph: «article» per a les fitxes, «profile» per a les persones. */
  tipus?: TipusPagina;
  /** Objectes JSON-LD (schema.org), un `<script>` cadascun. */
  jsonLd?: readonly Record<string, unknown>[];
  /** Per forçar `noindex` en una pàgina concreta (una demostració, un esborrany). */
  noIndex?: boolean;
};

/**
 * El títol amb la marca al darrere si hi cap. «Sabadell · quivoto»; però
 * «Comparador de municipis de Catalunya, de dos a quatre alhora» es queda
 * sense marca perquè amb ella passaria de seixanta. Si el títol ja diu
 * «quivoto», no es repeteix.
 */
export function titolAmbMarca(titol: string): string {
  const net = titol.trim().replace(/\s+/g, " ");
  if (net.toLowerCase().includes(MARCA)) return net;
  const ambMarca = `${net} · ${MARCA}`;
  return ambMarca.length <= TITOL_MAXIM ? ambMarca : net;
}

/**
 * La descripció, retallada a l'última paraula sencera si passa del màxim.
 * S'hi treuen les etiquetes HTML que hi pugui haver arrossegat una frase
 * feta per a la pàgina, i els espais dobles.
 */
export function descripcioNeta(text: string, maxim = DESCRIPCIO_MAXIMA): string {
  const net = text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  if (net.length <= maxim) return net;
  const tall = net.slice(0, maxim - 1);
  const ultimEspai = tall.lastIndexOf(" ");
  return `${(ultimEspai > maxim * 0.6 ? tall.slice(0, ultimEspai) : tall).replace(/[,;:·—-]+$/, "")}…`;
}

/**
 * El JSON-LD dins d'un `<script>`: el `</` s'escapa perquè un nom amb
 * «</script>» a dins no pugui tancar l'etiqueta abans d'hora.
 */
export function scriptJsonLd(objecte: Record<string, unknown>): string {
  // `<` sencer a `\u003c` i no només `</`: JSON ho admet i cap nom amb una
  // etiqueta a dins pot escriure HTML dins de l'script.
  const json = JSON.stringify({ "@context": "https://schema.org", ...objecte }).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">${json}</script>`;
}

/** L'organització que publica tot això, per als JSON-LD que la citen. */
export const ORGANITZACIO: Record<string, unknown> = {
  "@type": "Organization",
  "@id": `${SITE}/#organitzacio`,
  name: MARCA,
  url: `${SITE}/`,
  logo: `${SITE}/assets/og.png`,
};

/**
 * El lloc web, per a la portada de l'Observatori i la landing. `cerca` és
 * l'acció de cerca (`seo-ld.ts`, `accioDeCerca()`), i només s'hi passa des de
 * la pàgina que de debò llegeix `?q=` de l'adreça.
 */
export function llocWeb(nom: string, url: string, descripcio: string, cerca?: Record<string, unknown>): Record<string, unknown> {
  return {
    "@type": "WebSite",
    "@id": `${url}#lloc`,
    name: nom,
    url,
    description: descripcio,
    inLanguage: "ca",
    publisher: { "@id": ORGANITZACIO["@id"] },
    potentialAction: cerca,
  };
}

/**
 * El fil d'Ariadna: «quivoto › Observatori › Vallès Occidental › Sabadell».
 * El cercador el pinta sota el títol en lloc de l'adreça, que és més llegible.
 */
export function filAriadna(items: readonly { nom: string; url: string }[]): Record<string, unknown> {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.nom,
      item: item.url,
    })),
  };
}

/** Els dos primers esglaons de qualsevol pàgina de l'Observatori. */
export const ARREL_OBSERVATORI: readonly { nom: string; url: string }[] = [
  { nom: MARCA, url: `${SITE}/` },
  { nom: "Observatori municipal", url: `${SITE}/observatori/` },
];

/**
 * Tot el cap SEO d'una pàgina, del `<title>` al JSON-LD. Va dins del
 * `<head>`, després del `charset` i el `viewport` i abans dels estils.
 */
export function capSeo(m: MetaPagina): string {
  const titol = titolAmbMarca(m.titol);
  const descripcio = descripcioNeta(m.descripcio);
  const imatge = m.imatge ?? IMATGE_PER_DEFECTE;
  const noIndex = m.noIndex === true || !INDEXABLE;
  const linies = [
    `<title>${escape(titol)}</title>`,
    `<meta name="description" content="${escape(descripcio)}">`,
    `<link rel="canonical" href="${escape(m.url)}">`,
    noIndex ? `<meta name="robots" content="noindex,nofollow">` : `<meta name="robots" content="index,follow,max-image-preview:large">`,
    `<meta property="og:type" content="${m.tipus ?? "website"}">`,
    `<meta property="og:site_name" content="${MARCA}">`,
    `<meta property="og:locale" content="ca_ES">`,
    `<meta property="og:title" content="${escape(titol)}">`,
    `<meta property="og:description" content="${escape(descripcio)}">`,
    `<meta property="og:url" content="${escape(m.url)}">`,
    `<meta property="og:image" content="${escape(imatge)}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escape(titol)}">`,
    `<meta name="twitter:description" content="${escape(descripcio)}">`,
    `<meta name="twitter:image" content="${escape(imatge)}">`,
    ...(m.jsonLd ?? []).map(scriptJsonLd),
  ];
  return linies.join("\n");
}
