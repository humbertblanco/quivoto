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
 * Mentre `INDEXABLE` sigui fals, cada pàgina porta `noindex,nofollow`, i el
 * sitemap es genera igualment (a `publish.ts`) perquè el dia que s'obri no
 * calgui tocar res més que la variable d'entorn. Tot el que s'escriu aquí és
 * per a aquell dia: les xarxes sí que llegeixen l'Open Graph avui mateix.
 */

import { INDEXABLE, SITE } from "./config";

const escape = (t: string): string =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** El nom del lloc tal com va a la marca i als títols. */
export const MARCA = "quivoto";

/** La imatge social de reserva, per a les pàgines que no en tenen una de pròpia. */
export const IMATGE_PER_DEFECTE = `${SITE}/assets/og.png`;

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

/** El lloc web, per a la portada de l'Observatori i la landing. */
export function llocWeb(nom: string, url: string, descripcio: string): Record<string, unknown> {
  return {
    "@type": "WebSite",
    "@id": `${url}#lloc`,
    name: nom,
    url,
    description: descripcio,
    inLanguage: "ca",
    publisher: { "@id": ORGANITZACIO["@id"] },
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
