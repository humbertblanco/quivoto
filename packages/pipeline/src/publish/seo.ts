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
 *
 * ## El graf
 *
 * Cada pàgina acaba amb el node de la pàgina mateixa (`nodePagina()`): de quin
 * lloc és part, qui la publica, quin és el seu fil i de què parla. «De què
 * parla» es dedueix del JSON-LD de la plantilla (el primer node amb un `@id`
 * de la mateixa adreça: `#municipi`, `#ens`, `#comarca`…), de manera que totes
 * les fitxes queden lligades a la seva entitat sense tocar cap plantilla. És
 * el que permet a un cercador —o a un model que llegeix les dades
 * estructurades— saber que la fitxa de Sabadell parla de la ciutat de Sabadell
 * i no d'una pàgina que s'hi assembla. Els nodes de cada entitat i les
 * preguntes ràpides són a `seo-ld.ts`.
 *
 * ## Els sitemaps
 *
 * Al final del fitxer hi ha les peces dels sitemaps (`urlsetXml`,
 * `indexSitemapsXml`) i l'empremta que fa que el `lastmod` digui quan ha
 * canviat el contingut d'una pàgina i no quan s'ha tornat a escriure el
 * fitxer (`empremtaPagina`, `lastmodReal`). Les fa servir el bloc dels
 * sitemaps de `publish.ts`.
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { dataCurta } from "../lib/text";
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
  /**
   * Les fitxes dels ens supramunicipals. Cada tipus al seu directori perquè el
   * slug d'un consell és el de la seva comarca, i la comarca ja té `c/<slug>.png`:
   * «Girona» és alhora una diputació i un municipi, i no poden xocar.
   */
  diputacio: (slug: string): string => `diputacio/${slug}.png`,
  consell: (slug: string): string => `consell/${slug}.png`,
  /** L'índex de les diputacions i els consells (`observatori/ens/`). */
  ens: (): string => "ens.png",
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
  /**
   * La data (ISO) de les dades que la pàgina ensenya, si en té una de pròpia:
   * el dia que la font es va consultar (`DadesEns.consultat`), el de l'última
   * actualització d'un registre. Va al `dateModified` del node de la pàgina i a
   * `article:modified_time`.
   *
   * **No hi passeu la data de publicació** (`generatedAt`) si les dades no han
   * canviat: dir que una pàgina és d'avui cada vegada que es torna a generar
   * és el senyal de frescor fals que els cercadors aprenen a ignorar. La data
   * de generació ja surt al peu («Generat el…»), que és on toca.
   */
  dataModificacio?: string | null;
  /**
   * L'`@id` de la cosa de què parla la pàgina (el municipi, la persona, l'ens),
   * si no és el primer node amb `@id` propi de `jsonLd` —que és el que es fa
   * servir quan no es diu res (vegeu `entitatPrincipal()`).
   */
  sobre?: string | null;
  /** El tipus del node de la pàgina, si no és el que es dedueix (vegeu `nodePagina()`). */
  tipusPaginaLd?: "WebPage" | "ProfilePage" | "CollectionPage" | "AboutPage" | "ItemPage";
  /** Les adreces de les fonts d'on surt la pàgina, per a l'`isBasedOn` del node de la pàgina. */
  fonts?: readonly string[];
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

/**
 * Els `@id` que comparteixen totes les pàgines. Un `@id` és el nom propi
 * d'una cosa dins del graf: si la portada diu que el lloc el publica
 * `…/#organitzacio` i la fitxa de Sabadell diu el mateix, un cercador (o un
 * model que llegeix el JSON-LD) entén que parlen de la mateixa organització
 * sense haver de comparar noms. Els de les coses de cada pàgina —el municipi,
 * la persona, el partit— són a `seo-ld.ts` (`ID`).
 */
export const ID_ORGANITZACIO = `${SITE}/#organitzacio`;
export const ID_FUNDADOR = `${SITE}/#humbert-blanco`;
/** El lloc sencer (la landing ho declara amb el mateix `@id` a `tools/build_landing.py`). */
export const ID_LLOC = `${SITE}/#lloc`;
/** L'Observatori, que és una part del lloc i té la seva pròpia cerca. */
export const ID_LLOC_OBSERVATORI = `${SITE}/observatori/#lloc`;

/**
 * Qui hi ha darrere, tal com ho diu la pàgina de premsa (`web/public/premsa.html`,
 * «Qui hi ha darrere»): una persona, Humbert Blanco, que el va començar pel seu
 * compte. Els `sameAs` són els dos perfils que la mateixa pàgina enllaça; cap
 * altre, perquè un `sameAs` és una afirmació d'identitat i només en fem de les
 * que podem comprovar.
 */
export const FUNDADOR: Record<string, unknown> = {
  "@type": "Person",
  "@id": ID_FUNDADOR,
  name: "Humbert Blanco",
  sameAs: ["https://x.com/humbertblanco", "https://github.com/humbertblanco"],
};

/**
 * L'organització que publica tot això, per als JSON-LD que la citen.
 *
 * Abans era el nom, l'adreça i el logotip, i prou. Ara porta el que un model
 * de llenguatge necessita per dir *qui* publica una xifra quan la cita: qui
 * l'ha fundat, qui n'és el titular legal (el mateix `legalName` que la landing,
 * perquè dues pàgines del mateix lloc no poden dir dues coses), on són els
 * principis de feina («Com treballem» a premsa) i el codi. No diu que sigui
 * una entitat sense ànim de lucre en el sentit legal: el titular és una
 * societat limitada, i el «sense ànim de lucre» de premsa és una manera de
 * fer, no una forma jurídica.
 */
export const ORGANITZACIO: Record<string, unknown> = {
  "@type": "Organization",
  "@id": ID_ORGANITZACIO,
  name: MARCA,
  legalName: "Damos en el Blanco, S.L.",
  url: `${SITE}/`,
  logo: `${SITE}/assets/og.png`,
  email: "hola@quivoto.cat",
  description:
    "Portal que reuneix les dades obertes dels 947 ajuntaments de Catalunya: qui governa, què s'hi ha votat des del 1979 i com estan els comptes, amb la font de cada xifra.",
  founder: FUNDADOR,
  areaServed: { "@type": "AdministrativeArea", name: "Catalunya" },
  knowsLanguage: "ca",
  publishingPrinciples: `${SITE}/premsa.html#com-treballem`,
  sameAs: ["https://github.com/humbertblanco/quivoto"],
};

/**
 * L'organització en forma curta, per citar-la des de cada pàgina sense
 * repetir-la sencera 18.000 vegades: l'`@id` lliga amb el node complet de la
 * portada i de les dades, i el nom i l'adreça hi són perquè qui no resol
 * l'`@id` (la majoria de lectors de JSON-LD d'una sola pàgina) sàpiga igualment
 * de qui és.
 */
export const ORGANITZACIO_REF: Record<string, unknown> = {
  "@type": "Organization",
  "@id": ID_ORGANITZACIO,
  name: MARCA,
  url: `${SITE}/`,
};

/**
 * El lloc web, per a la portada de l'Observatori i la landing. `cerca` és
 * l'acció de cerca (`seo-ld.ts`, `accioDeCerca()`), i només s'hi passa des de
 * la pàgina que de debò llegeix `?q=` de l'adreça.
 *
 * Un lloc que no és l'arrel (l'Observatori) es declara part del lloc sencer
 * amb `isPartOf`: és el que fa que «Observatori municipal de quivoto» i
 * «quivoto» siguin, per al graf, una secció i el seu web, i no dos webs.
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
    isPartOf: url === `${SITE}/` ? undefined : { "@id": ID_LLOC },
    potentialAction: cerca,
  };
}

/**
 * El fil d'Ariadna: «quivoto › Observatori › Vallès Occidental › Sabadell».
 * El cercador el pinta sota el títol en lloc de l'adreça, que és més llegible.
 *
 * Porta `@id` (l'adreça de l'últim esglaó, que és la pàgina mateixa, amb
 * `#fil`) perquè el node de la pàgina que escriu `capSeo()` hi pugui apuntar
 * amb `breadcrumb`.
 */
export function filAriadna(items: readonly { nom: string; url: string }[]): Record<string, unknown> {
  const ultim = items.at(-1);
  return {
    "@type": "BreadcrumbList",
    "@id": ultim ? `${ultim.url.split("#")[0]}#fil` : undefined,
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

/** Els tipus que mai no són «de què parla» una pàgina: són el marc, no el tema. */
const NO_SON_TEMA = new Set(["BreadcrumbList", "WebSite", "Organization", "WebPage", "FAQPage", "SearchAction"]);

/**
 * L'`@id` de la cosa principal d'una pàgina, deduït del seu propi JSON-LD: el
 * primer node que porta un `@id` de la mateixa adreça (`<url>#municipi`,
 * `#comarca`, `#ens`, `#partit`, `#persona`, `#cataleg`…) i que no és el marc
 * (el fil, el lloc, l'organització).
 *
 * Es dedueix i no es demana perquè així les 18.000 pàgines guanyen el lligam
 * sense tocar cap plantilla: la fitxa de Sabadell ja escriu el `City` amb
 * `#municipi` abans que l'ajuntament, i és d'això que parla. Si el node no hi
 * és, no s'inventa cap `@id`: un `mainEntity` que apunta a res no diu res.
 */
export function entitatPrincipal(url: string, nodes: readonly Record<string, unknown>[]): string | null {
  const base = url.split("#")[0]!;
  for (const node of nodes) {
    const id = node["@id"];
    const tipus = node["@type"];
    if (typeof id !== "string" || !id.startsWith(`${base}#`)) continue;
    if (typeof tipus === "string" && NO_SON_TEMA.has(tipus)) continue;
    return id;
  }
  return null;
}

/**
 * Si un node de la plantilla és el de la pàgina mateixa: un `FAQPage` (les
 * preguntes ràpides) o qualsevol node amb l'`@id` `<url>#pagina`. `capSeo()`
 * no l'escriu tal com ve: el completa i n'escriu un de sol.
 */
export function esNodePagina(node: Record<string, unknown>, url: string): boolean {
  return node["@type"] === "FAQPage" || node["@id"] === `${url.split("#")[0]}#pagina`;
}

/**
 * El node de la pàgina mateixa (`WebPage` o un dels seus subtipus), que és el
 * que lliga tot el graf: diu que la pàgina és part de l'Observatori, qui la
 * publica, de què parla (`mainEntity`, o `about` quan és una pàgina de
 * preguntes), quin és el seu fil d'Ariadna i, si la plantilla la sap, de quan
 * són les dades.
 *
 * El tipus surt del que ja se sap: una persona (`tipus: "profile"`) és un
 * `ProfilePage`, que és com Google demana marcar la pàgina d'una persona; una
 * pàgina que parla d'una llista (`ItemList`) és un `CollectionPage`; i si la
 * plantilla hi ha posat les preguntes ràpides (`preguntesRapides()` a
 * `seo-ld.ts`), el node és el `FAQPage` que porten, completat amb el mateix
 * que tindria el `WebPage`: un sol node per pàgina, no dos que es contradiuen.
 */
export function nodePagina(m: MetaPagina, titol: string, descripcio: string): Record<string, unknown> {
  const nodes = m.jsonLd ?? [];
  const url = m.url;
  const sobre = m.sobre ?? entitatPrincipal(url, nodes);
  const nodeSobre = sobre ? nodes.find((n) => n["@id"] === sobre) : undefined;
  const tipusSobre = nodeSobre?.["@type"];
  // La referència porta el tipus i el nom a més de l'`@id`: un lector que no
  // lligui nodes de dos `<script>` diferents sap igualment de qui es tracta, i
  // el `ProfilePage` de Google, que exigeix el nom de la persona, el té.
  const refSobre = sobre
    ? { "@id": sobre, "@type": nodeSobre?.["@type"], name: typeof nodeSobre?.name === "string" ? nodeSobre.name : undefined }
    : undefined;
  const propi = nodes.find((n) => esNodePagina(n, url));
  const faq = propi?.["@type"] === "FAQPage" ? propi : undefined;
  const fil = nodes.find((n) => n["@type"] === "BreadcrumbList")?.["@id"];
  const observatori = url.startsWith(`${SITE}/observatori/`);
  // Un `ProfilePage` sense la persona és un error a Search Console (és un
  // resultat enriquit amb camps obligatoris), i per això només ho és quan la
  // persona hi és amb el seu `@id`; si no, és un `WebPage` com qualsevol altra.
  const tipus =
    m.tipusPaginaLd ??
    (m.tipus === "profile" && tipusSobre === "Person" ? "ProfilePage" : tipusSobre === "ItemList" ? "CollectionPage" : "WebPage");
  const fonts = m.fonts && m.fonts.length > 0 ? [...new Set(m.fonts)] : undefined;
  const calculat: Record<string, unknown> = {
    "@type": faq ? "FAQPage" : tipus,
    "@id": `${url.split("#")[0]}#pagina`,
    url,
    name: titol,
    description: descripcio,
    inLanguage: "ca",
    isPartOf: { "@id": observatori && url !== `${SITE}/observatori/` ? ID_LLOC_OBSERVATORI : ID_LLOC },
    publisher: ORGANITZACIO_REF,
    breadcrumb: typeof fil === "string" ? { "@id": fil } : undefined,
    // Una pàgina de preguntes té les preguntes com a `mainEntity` (és com es
    // defineix `FAQPage`); la cosa de què parla passa a `about`.
    mainEntity: faq ? faq.mainEntity : refSobre,
    about: faq ? refSobre : undefined,
    primaryImageOfPage: m.imatge ? { "@type": "ImageObject", url: m.imatge, width: 1200, height: 630 } : undefined,
    dateModified: m.dataModificacio ?? undefined,
    isBasedOn: fonts,
  };
  // El que la plantilla hagi escrit al seu node de pàgina mana sobre el que
  // es dedueix aquí; el que no hi hagi escrit, es completa.
  if (!propi || faq) return calculat;
  const delaPlantilla = Object.fromEntries(Object.entries(propi).filter(([, v]) => v !== undefined && v !== null));
  return { ...calculat, ...delaPlantilla, "@id": calculat["@id"] };
}

/**
 * Tot el cap SEO d'una pàgina, del `<title>` al JSON-LD. Va dins del
 * `<head>`, després del `charset` i el `viewport` i abans dels estils.
 *
 * El JSON-LD de la plantilla surt en l'ordre que la plantilla el dona (el fil
 * d'Ariadna primer, que és el que algunes proves miren) i, al final, el node
 * de la pàgina (`nodePagina()`) quan lliga alguna cosa. Si la plantilla hi ha
 * posat un `FAQPage` (o el seu propi node `#pagina`), no s'escriu dues
 * vegades: el de la plantilla es completa i surt al lloc del `WebPage`.
 */
export function capSeo(m: MetaPagina): string {
  const titol = titolAmbMarca(m.titol);
  const descripcio = descripcioNeta(m.descripcio);
  const imatge = m.imatge ?? IMATGE_PER_DEFECTE;
  const noIndex = m.noIndex === true || !INDEXABLE;
  // El node de la pàgina només surt quan lliga alguna cosa: la cosa de què
  // parla, les preguntes, la data de les dades o les fonts. Una pàgina que només
  // té el fil (el mapa, el comparador, la portada) no guanya res amb un
  // `WebPage` que repeteix el títol i la descripció.
  const pagina = nodePagina(m, titol, descripcio);
  const lligaAlgo = ["mainEntity", "about", "dateModified", "isBasedOn"].some((k) => pagina[k] !== undefined);
  const nodes = [...(m.jsonLd ?? []).filter((n) => !esNodePagina(n, m.url)), ...(lligaAlgo ? [pagina] : [])];
  // El text alternatiu de la imatge social: la de cada pàgina és una targeta
  // amb el nom de la cosa, i el títol la descriu; la de reserva és la de la
  // landing, i porta la mateixa frase que la landing hi posa.
  const altImatge = m.imatge ? titol : "quivoto: la papereta mascota i la pregunta «A qui votes al teu poble?»";
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
    `<meta property="og:image:alt" content="${escape(altImatge)}">`,
    ...(m.dataModificacio && (m.tipus ?? "website") === "article"
      ? [`<meta property="article:modified_time" content="${escape(m.dataModificacio)}">`]
      : []),
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escape(titol)}">`,
    `<meta name="twitter:description" content="${escape(descripcio)}">`,
    `<meta name="twitter:image" content="${escape(imatge)}">`,
    `<meta name="twitter:image:alt" content="${escape(altImatge)}">`,
    ...nodes.map(scriptJsonLd),
  ];
  return linies.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Els sitemaps
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Una adreça del sitemap. Ja no porta `priority` ni `changefreq`: Google diu
 * a la seva documentació de sitemaps que no en fa cas, i Bing tampoc. L'únic
 * camp que tots dos llegeixen és `lastmod`, i només si és de fiar.
 */
export type AdrecaSitemap = { loc: string; lastmod: string };

const escapaXml = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Un `urlset` del protocol de sitemaps, una adreça per línia. */
export function urlsetXml(adreces: readonly AdrecaSitemap[]): string {
  const files = adreces.map((a) => `  <url><loc>${escapaXml(a.loc)}</loc><lastmod>${a.lastmod}</lastmod></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${files.join("\n")}\n</urlset>\n`;
}

/**
 * L'índex que apunta a un sitemap per tipus de pàgina. El `lastmod` de cada
 * fitxer és el més recent de les seves adreces: si cap persona no ha canviat,
 * el sitemap de persones tampoc, i el cercador no l'ha de tornar a llegir.
 */
export function indexSitemapsXml(fitxers: readonly AdrecaSitemap[]): string {
  const files = fitxers.map((f) => `  <sitemap><loc>${escapaXml(f.loc)}</loc><lastmod>${f.lastmod}</lastmod></sitemap>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${files.join("\n")}\n</sitemapindex>\n`;
}

/** La data més recent d'una llista d'adreces, o `per defecte` si és buida. */
export function lastmodMesRecent(adreces: readonly AdrecaSitemap[], perDefecte: string): string {
  return adreces.reduce((max, a) => (a.lastmod > max ? a.lastmod : max), "") || perDefecte;
}

/**
 * Què es guarda de cada adreça entre una publicació i la següent: l'empremta
 * del contingut (`h`), la data en què aquest contingut va aparèixer per primer
 * cop (`d`) i l'`mtime` del fitxer quan es va llegir (`t`), que serveix per no
 * tornar a llegir els fitxers que una publicació parcial no ha tocat.
 */
export type Empremta = { h: string; d: string; t: number };

/**
 * L'empremta del que una pàgina **diu**, no del fitxer.
 *
 * El `lastmod` era la data del fitxer, i cada publicació els reescriu tots:
 * les 18.000 adreces sortien amb la data d'avui cada vegada, encara que només
 * hagués canviat un regidor de Reus. Google ho diu clar: fa servir `lastmod`
 * si és «consistentment i verificablement correcte», i si no, el deixa de
 * llegir per a tot el lloc. Un `lastmod` que sempre és avui és exactament el
 * que aprèn a ignorar.
 *
 * Per saber si una pàgina ha canviat de debò es treu el que canvia sense que
 * canviï res: la data de generació (en ISO i en la forma «27 d'octubre del
 * 2026» que en fa el peu), el peu i la capçalera compartits (les xifres del
 * peu es mouen amb qualsevol publicació), els estils i els scripts (un retoc
 * de CSS no és contingut nou; el JSON-LD sí que es queda, perquè les dades
 * enriquides són part del que la pàgina diu), i els `?v=` de les adreces dels
 * fitxers estàtics. El que queda —títol, descripció, dades enriquides i cos—
 * és el que es compara.
 */
export function empremtaPagina(html: string, generatedAt: string): string {
  // La data de generació que la pàgina mateixa diu al peu: una pàgina que una
  // publicació parcial no ha tornat a escriure porta la d'un altre dia, i
  // també s'ha de treure perquè l'empremta compari el contingut i no el dia.
  // Les fitxes d'abans del peu nou ho diuen sense `<time>` («Generat el <b>2026-09-03</b>»).
  const delPeu = /Generat (?:el |l')(?:<time datetime="|<b>)?(\d{4}-\d{2}-\d{2})/.exec(html)?.[1] ?? null;
  let net = html
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<script(?![^>]*application\/ld\+json)[\s\S]*?<\/script>/g, "")
    .replace(/<header class="capcalera"[\s\S]*?<\/header>/g, "")
    .replace(/<footer class="peu"[\s\S]*?<\/footer>/g, "")
    .replace(/\?v=[^"'\s)&]+/g, "");
  for (const iso of new Set([generatedAt.slice(0, 10), delPeu])) {
    if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) net = net.split(iso).join("").split(dataCurta(iso)).join("");
  }
  return createHash("sha1").update(net.replace(/\s+/g, " ")).digest("hex");
}

/**
 * El `lastmod` d'una adreça: el d'abans si l'empremta no ha canviat, i avui
 * si ha canviat o si l'adreça és nova. La primera publicació amb aquest
 * mecanisme no té res d'abans i ho data tot avui; a partir de la segona, les
 * dates ja diuen quan ha canviat cada pàgina.
 */
export function lastmodReal(anterior: Empremta | undefined, empremta: string, avui: string): string {
  return anterior && anterior.h === empremta ? anterior.d : avui;
}
