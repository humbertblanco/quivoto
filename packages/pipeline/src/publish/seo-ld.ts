/**
 * Les dades enriquides (JSON-LD, schema.org) que no són el fil d'Ariadna.
 *
 * `seo.ts` fa el cap sencer i hi posa el `BreadcrumbList`, el `WebSite` i
 * l'`Organization`; aquí hi ha les formes que només tenen sentit en un tipus
 * de pàgina —l'ajuntament amb qui hi mana, la llista ordenada d'un rànquing,
 * el conjunt de dades descarregable, l'acció de cerca— escrites una sola
 * vegada i amb el nom exacte de cada propietat de schema.org, que és on és
 * fàcil equivocar-se (`containsPlace` i no `contains`, `query-input` amb
 * guió, `urlTemplate` dins d'un `EntryPoint`).
 *
 * ## La regla
 *
 * Cap d'aquestes funcions no sap res de la base: reben el que la pàgina ja
 * ha decidit ensenyar i ho tornen en la forma que el cercador llegeix. Si una
 * dada no és a la pàgina, no ha d'arribar aquí: el JSON-LD és una traducció
 * del que hi ha escrit, no un canal per dir-hi més coses. Per això reben
 * noms i adreces, i no files de taula.
 *
 * Els valors buits (`null`, `undefined`, llistes buides) es deixen fora de
 * l'objecte i no s'escriuen com a `null`: `JSON.stringify` ja omet
 * `undefined`, però una llista buida sortiria com a `[]` i un validador la
 * marca com a propietat sense valor.
 *
 * ## Què hi ha
 *
 *   · Les formes de sempre: `ajuntament`, `llocsContinguts`, `llistaOrdenada`,
 *     `accioDeCerca`, `conjuntDeDades`, `catalegDeDades`.
 *   · El graf d'entitats, amb `@id` estables (`ID`): `municipiLd`,
 *     `ajuntamentLd`, `personaLd`, `partitLd`, `comarcaLd`, `ensLd`.
 *   · Les preguntes ràpides (respostes curtes amb font i data, a la vista i
 *     com a `FAQPage`): `preguntesMunicipi`, `preguntesEns`,
 *     `preguntesRapides`, amb el seu full `GEO_CSS`.
 */

import { dataCurta, de, delDia, nomLlegible } from "../lib/text";
import { SITE } from "./config";
import type { DadesEns, FontEns, MembreEns, TipusEns } from "./ens-tipus";
import { adrecaEns } from "./ens-tipus";
import { ORGANITZACIO } from "./seo";
import { SOURCES } from "./source-registry";

/** Un nom i la seva adreça absoluta: el mínim que el cercador necessita d'un element. */
export type Enllac = { nom: string; url: string };

const OBS = `${SITE}/observatori`;

/**
 * Els `@id` de cada cosa, escrits en un sol lloc.
 *
 * Un `@id` és el nom propi d'una cosa dins del graf de dades enriquides. Si la
 * fitxa de Sabadell diu que el municipi és `…/m/sabadell/#municipi` i la
 * fitxa d'una regidora diu que treballa a l'ajuntament `…/m/sabadell/#ajuntament`,
 * qui llegeix totes dues pàgines —un cercador, un model de llenguatge que
 * indexa el web— sap que parlen del mateix ajuntament sense comparar cap nom.
 * Això només funciona si totes les plantilles escriuen exactament la mateixa
 * cadena, i per això cap plantilla no se l'ha d'escriure a mà: la demana aquí.
 *
 * L'esquema és sempre «l'adreça canònica de la pàgina que en parla + `#` + què
 * és», perquè l'`@id` es pugui obrir i porti a la pàgina de la cosa. Els que ja
 * existien (`#municipi`, `#ajuntament`, `#comarca`, `#partit`, `#ens`) no
 * canvien: canviar un `@id` és, per al graf, canviar de cosa.
 */
export const ID = {
  municipi: (slug: string): string => `${OBS}/m/${slug}/#municipi`,
  ajuntament: (slug: string): string => `${OBS}/m/${slug}/#ajuntament`,
  /** La persona, a la seva fitxa (`…/m/<slug>/regidor/<persona>/`). */
  persona: (urlFitxa: string): string => `${urlFitxa.split("#")[0]}#persona`,
  partit: (id: string): string => `${OBS}/partit/${id}/#partit`,
  comarca: (slug: string): string => `${OBS}/c/${slug}/#comarca`,
  ens: (tipus: TipusEns, slug: string): string => `${OBS}/${adrecaEns(tipus, slug)}#ens`,
} as const;

/**
 * L'`@id` d'un node dins d'una adreça que potser ja porta fragment.
 * `…/ranquings/#participacio` amb `llista` dona `…/ranquings/#participacio-llista`
 * i no `…#participacio#llista`, que no és cap IRI vàlid (un fragment no pot
 * contenir un altre `#`) i que alguns validadors tallen pel segon coixinet.
 */
export function idDins(url: string, nom: string): string {
  const [base, fragment] = url.split("#", 2);
  return fragment ? `${base}#${fragment}-${nom}` : `${base}#${nom}`;
}

/** L'adreça de l'element de Wikidata a partir del QID, o la mateixa adreça si ja ho és. */
export function urlWikidata(qidOUrl: string | null | undefined): string | null {
  if (!qidOUrl) return null;
  const net = qidOUrl.trim();
  if (/^Q\d+$/.test(net)) return `https://www.wikidata.org/wiki/${net}`;
  return /^https?:\/\//.test(net) ? net : null;
}

/**
 * Les adreces externes que valen com a `sameAs` —l'element de Wikidata,
 * l'article de la Viquipèdia—, sense les que no hi són. `undefined` quan no en
 * queda cap, perquè la propietat no s'escrigui buida.
 */
export function mateixQue(...adreces: readonly (string | null | undefined)[]): string[] | undefined {
  const netes = adreces.filter((a): a is string => typeof a === "string" && a.trim() !== "");
  return netes.length > 0 ? [...new Set(netes)] : undefined;
}

/**
 * L'ajuntament com a `GovernmentOrganization`, amb qui té l'alcaldia com a
 * `employee`. El nom és «Ajuntament de X» amb la preposició ben escrita
 * («Ajuntament d'Olot», «Ajuntament del Prat»), i l'adreça és la fitxa del
 * municipi, que és l'única pàgina nostra que en parla. El web propi de
 * l'ajuntament no hi va: la fitxa no l'ensenya.
 *
 * L'alcaldia és la mateixa persona i el mateix càrrec que la fitxa escriu a
 * la portada (`resolAlcaldia()`): el `jobTitle` és el càrrec tal com el diu
 * la seu —«alcalde», «alcaldessa»— seguit del municipi, i la `url` és la seva
 * fitxa de regidor quan en té.
 */
export function ajuntament(
  municipi: string,
  url: string,
  alcaldia: { nom: string; carrec: string; url: string | null } | null,
): Record<string, unknown> {
  return {
    "@type": "GovernmentOrganization",
    "@id": `${url}#ajuntament`,
    name: `Ajuntament ${de(municipi)}`,
    url,
    areaServed: { "@id": `${url}#municipi` },
    employee: alcaldia
      ? {
          "@type": "Person",
          name: alcaldia.nom,
          jobTitle: `${alcaldia.carrec.charAt(0).toUpperCase()}${alcaldia.carrec.slice(1)} ${de(municipi)}`,
          url: alcaldia.url ?? undefined,
        }
      : undefined,
  };
}

/**
 * Els municipis d'un territori, per al `containsPlace` d'una comarca o de
 * l'AMB: cada un és una `City` amb el nom i la seva fitxa. Amb la llista
 * buida torna `undefined`, i la propietat no s'escriu.
 */
export function llocsContinguts(municipis: readonly Enllac[]): Record<string, unknown>[] | undefined {
  if (municipis.length === 0) return undefined;
  return municipis.map((m) => ({ "@type": "City", name: m.nom, url: m.url }));
}

/**
 * Una llista ordenada (`ItemList`) que apunta a pàgines: els municipis d'un
 * rànquing, els 947 d'una llista. Cada `ListItem` porta la posició, el nom i
 * la `url`, que és la forma que el cercador fa servir per lligar la llista
 * amb les pàgines que hi ha darrere. `total` és quants n'hi ha de debò quan
 * només se n'escriuen els primers —els 40 que la pàgina pinta sense guió—,
 * perquè `numberOfItems` digui la mida de la llista i no la del tros.
 */
export function llistaOrdenada(
  nom: string,
  elements: readonly Enllac[],
  opcions: { url?: string; total?: number; descripcio?: string } = {},
): Record<string, unknown> {
  return {
    "@type": "ItemList",
    "@id": opcions.url ? idDins(opcions.url, "llista") : undefined,
    name: nom,
    description: opcions.descripcio,
    url: opcions.url,
    numberOfItems: opcions.total ?? elements.length,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: elements.map((e, i) => ({ "@type": "ListItem", position: i + 1, name: e.nom, url: e.url })),
  };
}

/**
 * L'acció de cerca del lloc, per al `potentialAction` d'un `WebSite`. Només
 * es pot anunciar si hi ha una pàgina que llegeixi `?q=` de l'adreça i obri
 * la cerca amb el que hi ha: la portada de l'Observatori ho fa
 * (`cercador.ts` llegeix `location.search`), i és l'única que s'hi ha de
 * posar. El nom del paràmetre a la plantilla (`{cerca}`) i a `query-input`
 * ha de ser el mateix: és així com el cercador lliga l'un amb l'altre.
 */
export function accioDeCerca(urlPagina: string): Record<string, unknown> {
  return {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: `${urlPagina}?q={cerca}` },
    "query-input": "required name=cerca",
  };
}

export type FitxerDeDades = { url: string; format: "text/csv" | "application/json" | "text/markdown" };

/**
 * Un conjunt de dades descarregable (`Dataset`), que és el que llegeix Google
 * Dataset Search. Cada fitxer hi va com a `DataDownload` amb el seu tipus
 * MIME; `isBasedOn` són les adreces de les fonts d'on surt, que la pàgina de
 * dades llista al registre; i la llicència és la de les dades derivades, que
 * és l'única que podem donar. `creator` és l'organització del lloc, per
 * l'`@id`, perquè totes les pàgines parlin de la mateixa.
 */
export function conjuntDeDades(d: {
  url: string;
  /** L'`@id` del conjunt, relatiu a l'adreça: `dataset`, `fonts`. */
  id: string;
  nom: string;
  descripcio: string;
  fitxers: readonly FitxerDeDades[];
  llicencia: string;
  fonts?: readonly string[];
  /** ISO, la data de la publicació que ha escrit els fitxers. */
  dataModificacio?: string | null;
  /** «1979/2027», si el conjunt cobreix un període que la pàgina diu. */
  cobertura?: string | null;
  cataleg?: string | null;
  paraulesClau?: readonly string[];
  /**
   * Els noms dels camps que mesura (`variableMeasured`): Google Dataset Search
   * els ensenya a la fitxa del conjunt, i són el que algú busca («deute per
   * habitant», «participació»). Els de `camps.json`, no uns d'inventats.
   */
  variables?: readonly string[];
}): Record<string, unknown> {
  return {
    "@type": "Dataset",
    "@id": idDins(d.url, d.id),
    name: d.nom,
    description: d.descripcio,
    url: d.url,
    inLanguage: "ca",
    license: d.llicencia,
    isAccessibleForFree: true,
    creator: { "@id": ORGANITZACIO["@id"] },
    publisher: { "@id": ORGANITZACIO["@id"] },
    spatialCoverage: { "@type": "Place", name: "Catalunya" },
    temporalCoverage: d.cobertura ?? undefined,
    dateModified: d.dataModificacio ?? undefined,
    keywords: d.paraulesClau && d.paraulesClau.length > 0 ? [...d.paraulesClau] : undefined,
    variableMeasured: d.variables && d.variables.length > 0 ? [...new Set(d.variables)] : undefined,
    isBasedOn: d.fonts && d.fonts.length > 0 ? [...new Set(d.fonts)] : undefined,
    includedInDataCatalog: d.cataleg ? { "@id": d.cataleg } : undefined,
    distribution: d.fitxers.map((f) => ({ "@type": "DataDownload", encodingFormat: f.format, contentUrl: f.url })),
  };
}

/**
 * El catàleg (`DataCatalog`) que agrupa els conjunts d'una pàgina de dades:
 * és el que fa que el cercador de dades presenti «Dades obertes de
 * l'Observatori» com una cosa i els fitxers com les seves parts.
 */
export function catalegDeDades(url: string, nom: string, descripcio: string, conjunts: readonly string[]): Record<string, unknown> {
  return {
    "@type": "DataCatalog",
    "@id": `${url}#cataleg`,
    name: nom,
    description: descripcio,
    url,
    inLanguage: "ca",
    publisher: { "@id": ORGANITZACIO["@id"] },
    dataset: conjunts.map((id) => ({ "@id": id })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// El graf d'entitats: municipi, ajuntament, persona, partit, comarca i ens
// ─────────────────────────────────────────────────────────────────────────────
//
// Cada funció d'aquí fa el node d'una cosa amb el seu `@id` (`ID`) i apunta a
// les altres pel seu: la persona treballa a `ID.ajuntament(slug)`, l'ajuntament
// serveix `ID.municipi(slug)`, el municipi és dins de `ID.comarca(slug)`, el
// consell comarcal serveix la mateixa comarca. Les referències porten també el
// nom i l'adreça, perquè un lector que no resol `@id` entre pàgines (gairebé
// tots) sàpiga igualment de què es parla.
//
// Els `sameAs` són afirmacions d'identitat i només hi van quan l'aparellament
// és segur: el QID que J20 aparella pel codi INE (mai pel nom), el que J31 dona
// per a cada persona, el de l'ens quan la J38 el desa.

/** Majúscula inicial, per als noms amb article que obren una frase («El Prat…»). */
const majuscula = (text: string): string => (text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : text);

const fitxaMunicipi = (slug: string): string => `${OBS}/m/${slug}/`;

/**
 * El municipi com a `City` (que a schema.org ja és una `AdministrativeArea`),
 * amb el que el lliga a la resta del món: l'element de Wikidata i l'article de
 * la Viquipèdia (`sameAs`), el codi INE (`identifier`), la comarca on és i les
 * coordenades. És el node principal de la fitxa del municipi.
 *
 * El QID és el que la J20 desa al kind `wikidata` (`FitxaWikidata.qid`, o
 * `.url`): la fitxa l'ha de carregar a `loadRadiografia` i passar-lo aquí.
 */
export function municipiLd(m: {
  slug: string;
  nom: string;
  comarca: { slug: string; nom: string } | null;
  punt?: { lat: number; lon: number } | null;
  habitants?: number | null;
  /** Codi INE de cinc xifres (Wikidata P772). */
  ine?: string | null;
  /** QID («Q15495») o adreça de Wikidata. */
  wikidata?: string | null;
  viquipedia?: string | null;
  imatge?: string | null;
}): Record<string, unknown> {
  return {
    "@type": "City",
    "@id": ID.municipi(m.slug),
    name: m.nom,
    url: fitxaMunicipi(m.slug),
    image: m.imatge ?? undefined,
    sameAs: mateixQue(urlWikidata(m.wikidata), m.viquipedia),
    identifier: m.ine ? { "@type": "PropertyValue", propertyID: "INE", value: m.ine } : undefined,
    containedInPlace: m.comarca
      ? { "@type": "AdministrativeArea", "@id": ID.comarca(m.comarca.slug), name: m.comarca.nom, url: `${OBS}/c/${m.comarca.slug}/` }
      : { "@type": "AdministrativeArea", name: "Catalunya" },
    geo: m.punt ? { "@type": "GeoCoordinates", latitude: m.punt.lat, longitude: m.punt.lon } : undefined,
    additionalProperty: m.habitants
      ? [{ "@type": "PropertyValue", name: "population", value: m.habitants, unitText: "habitants" }]
      : undefined,
  };
}

/**
 * L'ajuntament amb els `@id` del graf. És el mateix que `ajuntament()`, però
 * l'alcaldia porta l'`@id` de la seva fitxa (`ID.persona`) i el nom de l'ens el
 * de la seva adreça: `ajuntament()` es queda com era perquè la fitxa del
 * municipi en prova la forma exacta, i qui vulgui el graf complet passa a aquesta.
 */
export function ajuntamentLd(
  slug: string,
  municipi: string,
  alcaldia: { nom: string; carrec: string; url: string | null } | null,
): Record<string, unknown> {
  return {
    "@type": "GovernmentOrganization",
    "@id": ID.ajuntament(slug),
    name: `Ajuntament ${de(municipi)}`,
    url: fitxaMunicipi(slug),
    areaServed: { "@type": "City", "@id": ID.municipi(slug), name: municipi },
    employee: alcaldia
      ? {
          "@type": "Person",
          "@id": alcaldia.url ? ID.persona(alcaldia.url) : undefined,
          name: alcaldia.nom,
          jobTitle: `${majuscula(alcaldia.carrec)} ${de(municipi)}`,
          url: alcaldia.url ?? undefined,
        }
      : undefined,
  };
}

/**
 * Una persona electa, per a la seva fitxa (regidor o alcaldia històrica).
 *
 * El `jobTitle` porta el municipi («1r Tinent d'Alcalde de Bellcaire
 * d'Urgell») i no el càrrec a seques: és la frase que un model cita quan li
 * pregunten qui és algú, i «Regidor» sol no diu de quin poble. El partit va com
 * a `PoliticalParty` amb l'`@id` de la seva pàgina quan en té; una llista local
 * (sense pàgina de partit) va com a `Organization`, perquè no és un partit.
 */
export function personaLd(p: {
  /** L'adreça canònica de la fitxa de la persona. */
  url: string;
  nom: string;
  carrec: string;
  municipi: { slug: string; nom: string };
  foto?: string | null;
  partit?: { id: string; nom: string } | null;
  /** El nom del grup o de la llista quan no és cap partit amb pàgina. */
  grup?: string | null;
  /** Wikidata, Viquipèdia…: només els aparellaments segurs (J21, J31). */
  sameAs?: readonly (string | null | undefined)[];
  naixement?: string | null;
}): Record<string, unknown> {
  const carrec = p.carrec.trim();
  const ambMunicipi = carrec.toLowerCase().includes(p.municipi.nom.toLowerCase()) ? carrec : `${carrec} ${de(p.municipi.nom)}`;
  return {
    "@type": "Person",
    "@id": ID.persona(p.url),
    name: p.nom,
    url: p.url,
    image: p.foto ? new URL(p.foto, p.url).href : undefined,
    jobTitle: majuscula(ambMunicipi),
    worksFor: {
      "@type": "GovernmentOrganization",
      "@id": ID.ajuntament(p.municipi.slug),
      name: `Ajuntament ${de(p.municipi.nom)}`,
      url: fitxaMunicipi(p.municipi.slug),
    },
    memberOf: p.partit
      ? { "@type": "PoliticalParty", "@id": ID.partit(p.partit.id), name: p.partit.nom, url: `${OBS}/partit/${p.partit.id}/` }
      : p.grup
        ? { "@type": "Organization", name: p.grup }
        : undefined,
    sameAs: p.sameAs ? mateixQue(...p.sameAs) : undefined,
    birthDate: p.naixement ?? undefined,
  };
}

/** Un partit, per a la seva pàgina: `PoliticalParty` (subtipus d'`Organization`). */
export function partitLd(p: { id: string; nom: string; sigles: string; wikidata?: string | null; web?: string | null }): Record<string, unknown> {
  const url = `${OBS}/partit/${p.id}/`;
  return {
    "@type": "PoliticalParty",
    "@id": ID.partit(p.id),
    name: p.nom,
    alternateName: p.sigles !== p.nom ? p.sigles : undefined,
    url,
    mainEntityOfPage: url,
    sameAs: mateixQue(urlWikidata(p.wikidata), p.web),
  };
}

/**
 * Una comarca amb els seus municipis, cadascun amb el seu `@id`. A diferència
 * de `llocsContinguts()` (que es queda com era perquè les pàgines en proven la
 * forma), aquí cada `City` és el mateix node que la fitxa del municipi declara.
 */
export function comarcaLd(c: {
  slug: string;
  nom: string;
  municipis: readonly { slug: string; nom: string }[];
  wikidata?: string | null;
}): Record<string, unknown> {
  return {
    "@type": "AdministrativeArea",
    "@id": ID.comarca(c.slug),
    name: c.nom,
    url: `${OBS}/c/${c.slug}/`,
    sameAs: mateixQue(urlWikidata(c.wikidata)),
    containedInPlace: { "@type": "AdministrativeArea", name: "Catalunya" },
    containsPlace:
      c.municipis.length > 0
        ? c.municipis.map((m) => ({ "@type": "City", "@id": ID.municipi(m.slug), name: m.nom, url: fitxaMunicipi(m.slug) }))
        : undefined,
  };
}

/** «la Diputació de Barcelona», «el Consell Comarcal del Bages»: el nom de l'ens amb l'article que li toca. */
export function ambArticle(d: Pick<DadesEns, "tipus" | "nom">): string {
  return `${d.tipus === "diputacio" ? "la" : "el"} ${d.nom}`;
}

/** «de la Diputació de Barcelona», «del Consell Comarcal del Bages». */
export function delEns(d: Pick<DadesEns, "tipus" | "nom">): string {
  return `${d.tipus === "diputacio" ? "de la" : "del"} ${d.nom}`;
}

/** L'adreça absoluta de la fitxa de persona d'un membre, si l'aparellament és únic. */
function urlMembre(m: Pick<MembreEns, "adreca" | "municipi">): string | null {
  return m.adreca && m.municipi ? `${fitxaMunicipi(m.municipi.slug)}${m.adreca}` : null;
}

/** Un membre de l'ens com a `Person`, enllaçat a la seva fitxa només si n'hi ha. */
function personaMembre(d: Pick<DadesEns, "tipus" | "nom">, m: MembreEns): Record<string, unknown> {
  const url = urlMembre(m);
  return {
    "@type": "Person",
    "@id": url ? ID.persona(url) : undefined,
    name: nomLlegible(m.nom),
    jobTitle: `${majuscula(m.carrec.trim())} ${delEns(d)}`,
    url: url ?? undefined,
  };
}

/**
 * Una diputació o un consell comarcal com a `GovernmentOrganization`, amb el
 * territori que serveix, la seu, la presidència i el ple sencer.
 *
 * El ple va a `member` amb un `OrganizationRole` per persona, que és la forma
 * que schema.org fa servir per dir «aquesta persona hi és amb aquest càrrec»
 * (el `roleName` és el càrrec literal de la font: «Vicepresident 1r»,
 * «Consellera»). Hi van només els membres amb nom: la Diputació de Barcelona i
 * la de Girona consten al registre de plens sense noms, i un seient sense nom
 * no és cap persona.
 *
 * No porta `parentOrganization`: una diputació o un consell no depenen de cap
 * altre ens, són administracions locals pròpies, i dir-ho seria fals.
 */
export function ensLd(d: DadesEns): Record<string, unknown> {
  const url = `${OBS}/${adrecaEns(d.tipus, d.slug)}`;
  const territori =
    d.tipus === "consell" && d.comarca
      ? { "@type": "AdministrativeArea", "@id": ID.comarca(d.comarca.slug), name: d.comarca.nom, url: `${OBS}/c/${d.comarca.slug}/` }
      : { "@type": "AdministrativeArea", name: d.tipus === "diputacio" ? `província de ${d.territori}` : d.territori };
  const ambNom = d.membres.filter((m) => m.nom.trim() !== "");
  return {
    "@type": "GovernmentOrganization",
    "@id": ID.ens(d.tipus, d.slug),
    name: d.nom,
    url,
    taxID: d.cif ?? undefined,
    areaServed: territori,
    location: d.seu ? { "@type": "City", "@id": ID.municipi(d.seu.slug), name: d.seu.nom, url: fitxaMunicipi(d.seu.slug) } : undefined,
    sameAs: mateixQue(d.web, urlWikidata(d.wikidata), d.municat),
    employee: d.presidencia && d.presidencia.nom.trim() !== "" ? personaMembre(d, d.presidencia) : undefined,
    member:
      ambNom.length > 0
        ? ambNom.map((m) => ({ "@type": "OrganizationRole", roleName: m.carrec.trim(), member: personaMembre(d, m) }))
        : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Preguntes ràpides: la resposta primer, amb la font i la data
// ─────────────────────────────────────────────────────────────────────────────
//
// Els cercadors amb IA (ChatGPT, Perplexity, les AI Overviews de Google,
// Claude, Gemini) no citen pàgines: citen **trossos** de pàgina. Agafen un
// paràgraf que respon la pregunta tot sol i el posen al costat de l'enllaç. Una
// fitxa que diu «Marta Farrés Falgueras» dins d'una targeta i «alcaldessa» en
// una etiqueta a l'altra punta és una resposta per a una persona, però no hi ha
// cap frase que es pugui citar sencera.
//
// Aquí es fan aquestes frases, de tres a sis per pàgina, amb dues regles:
//
//   · **Cada resposta s'aguanta sola**: porta el nom del municipi o de l'ens,
//     la xifra, i la font i la data al darrere. Si algú la copia sense la
//     pàgina, encara diu de quan és i d'on surt.
//   · **Només el que la pàgina ja diu**, amb la mateixa xifra i la mateixa
//     regla. Si una dada no hi és, la pregunta no es fa: cap «no consta»
//     convertit en resposta, cap zero inventat.
//
// Les mateixes preguntes surten dues vegades: a la vista, en un bloc
// «Preguntes ràpides» (`blocPreguntes()`, classes `geo-`), i com a `FAQPage` al
// JSON-LD (`preguntesLd()`). Google va retirar els resultats enriquits de FAQ el
// 2026, i per això el JSON-LD no es fa per l'estrella del cercador: es fa perquè
// és text net, amb la pregunta i la resposta lligades, que qualsevol lector de
// dades estructurades entén. El que compta de debò és el bloc visible, i les
// dades estructurades sempre han de dir el mateix que la pàgina: **no poseu mai
// el JSON-LD sense el bloc**. `preguntesRapides()` torna les dues coses juntes.

/** D'on surt una resposta: el nom que es llegeix i, si en té, l'adreça. */
export type FontPregunta = { nom: string; url?: string | null };

export type PreguntaRapida = {
  /** La pregunta com la faria algú: «Qui és l'alcaldessa de Sabadell?». */
  pregunta: string;
  /** La resposta, una o dues frases, sense la font. */
  resposta: string;
  font: FontPregunta | null;
  /** De quan és la dada, ja escrit: «dades del 27 d'octubre del 2026». */
  quan: string | null;
  /** Un tros de la resposta que porta a una pàgina (el nom de l'alcaldessa a la seva fitxa). */
  enllac?: { text: string; url: string } | null;
};

/** La resposta sencera, amb la font i la data: el text del JSON-LD. */
export function textResposta(p: PreguntaRapida): string {
  if (p.font) return `${p.resposta} Font: ${p.font.nom}${p.quan ? `, ${p.quan}` : ""}.`;
  return p.quan ? `${p.resposta} (${p.quan})` : p.resposta;
}

/** Una font del registre (`source-registry.ts`) com la cita una resposta. */
const fontDe = (s: { titol: string; productor: string; url: string }): FontPregunta => ({
  nom: `${s.titol} (${s.productor})`,
  url: s.url,
});

const LOREG = "https://www.boe.es/buscar/act.php?id=BOE-A-1985-11672";
const DL_COMARCAL = "https://portaljuridic.gencat.cat/eli/es-ct/dlg/2003/11/04/4";

/** Milers amb punt, sempre: «1.275», com la resta de l'Observatori (el `ca-ES` de l'ICU no agrupa les de quatre xifres). */
const enters = (n: number): string => {
  const r = Math.round(n);
  return `${r < 0 ? "−" : ""}${String(Math.abs(r)).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
};

/** Un decimal amb coma: «54,3». */
const unDecimal = (n: number): string => {
  const [enter, dec] = Math.abs(n).toFixed(1).split(".");
  return `${n < 0 ? "−" : ""}${enters(Number(enter))},${dec}`;
};

/** «412,3 milions d'euros» per sobre del milió, l'import sencer per sota: la forma de `ens.ts`. */
const milionsEuros = (n: number): string => (Math.abs(n) < 1_000_000 ? `${enters(n)} €` : `${unDecimal(n / 1_000_000)} milions d'euros`);

/** «el Prat de Llobregat» encara que la font l'escrigui «El Prat…»: el nom com va al mig d'una frase. */
export function enFrase(nom: string): string {
  return nom.trim().replace(/^(El|La|Els|Les|Es|Sa|Ses)\s/, (art: string) => art.toLowerCase()).replace(/^L['’]/, "l'");
}

/** «a Sabadell», «al Prat», «als Omells de na Gaia». */
export function a(nom: string): string {
  if (/^els\s/i.test(nom)) return `als ${nom.slice(4)}`;
  if (/^el\s/i.test(nom)) return `al ${nom.slice(3)}`;
  return `a ${nom}`;
}

/** El dia de les municipals del 2023. */
export const MUNICIPALS_2023 = "2023-05-28";

/** El quart diumenge de maig d'un any, en ISO: el dia que la LOREG (art. 42.3) fixa per a les municipals. */
export function quartDiumengeDeMaig(any: number): string {
  const diaSetmana = new Date(Date.UTC(any, 4, 1)).getUTCDay();
  const primer = 1 + ((7 - diaSetmana) % 7);
  return `${any}-05-${String(primer + 21).padStart(2, "0")}`;
}

/**
 * Les properes municipals a partir d'una data: el quart diumenge de maig dels
 * anys del cicle del 2023 (cada quatre anys). Es calcula i no s'escriu «2027»
 * perquè el dia després de votar la pregunta ja té una altra resposta, i una
 * fitxa que diu una data passada com si fos futura és exactament l'error que
 * un model citaria anys després.
 */
export function properesMunicipals(desDe: string): string {
  const dia = desDe.slice(0, 10);
  let any = Number(dia.slice(0, 4));
  any += (((2023 - any) % 4) + 4) % 4;
  while (quartDiumengeDeMaig(any) < dia) any += 4;
  return quartDiumengeDeMaig(any);
}

/**
 * El que la fitxa d'un municipi ja ensenya i que les preguntes ràpides fan
 * servir. Cada camp és el que la fitxa ha decidit mostrar (la mateixa alcaldia
 * que la portada, `resolAlcaldia()`; la mateixa majoria que la descripció), no
 * una fila de la base: així la pregunta i la pàgina no poden dir dues coses.
 */
export type FetsMunicipi = {
  /** El nom oficial: «l'Hospitalet de Llobregat», «Sabadell». */
  municipi: string;
  /**
   * Qui té l'alcaldia. `carrec` és el curt («alcalde», «alcaldessa») quan la
   * font el diu; si no se sap, la pregunta es fa sense gènere («Qui té l'alcaldia…?»).
   */
  alcaldia: { nom: string; carrec: string | null; sigles: string | null; url?: string | null; font?: FontPregunta | null } | null;
  /** La llista que governa (la de l'alcaldia), les seves regidories i si té majoria absoluta. */
  govern: { sigles: string; regidories: number | null; majoriaAbsoluta: boolean | null; mesVotada: string | null } | null;
  /** Les regidories del ple i la majoria absoluta. */
  ple: { regidories: number; majoria: number } | null;
  /** La participació a les últimes municipals. */
  participacio: { any: number; votants: number; cens: number } | null;
  /** Els habitants, amb l'any del padró (sense any, no hi ha pregunta). */
  habitants: { valor: number; any: number | null; font?: FontPregunta | null } | null;
  /**
   * La data (ISO) de les dades que canvien a mig mandat —l'alcaldia, el
   * govern—: la de la descàrrega de la font si se sap, i si no, la de la
   * publicació. És la que acompanya aquestes respostes.
   */
  consultat: string;
};

/**
 * De tres a sis preguntes sobre un municipi, en aquest ordre: qui té
 * l'alcaldia, qui governa, quantes regidories té el ple, quan són les properes
 * eleccions, quanta gent va votar i quants habitants té. La de les eleccions hi
 * és sempre (és la llei, no una dada); les altres, només si la dada hi és.
 */
export function preguntesMunicipi(f: FetsMunicipi): PreguntaRapida[] {
  const nom = enFrase(f.municipi);
  const quan = `dades ${delDia(f.consultat)}`;
  const preguntes: PreguntaRapida[] = [];

  if (f.alcaldia && f.alcaldia.nom.trim() !== "") {
    const carrec = /^alcaldessa\b/i.test(f.alcaldia.carrec ?? "") ? "alcaldessa" : /^alcalde\b/i.test(f.alcaldia.carrec ?? "") ? "alcalde" : null;
    const sigles = f.alcaldia.sigles ? ` (${f.alcaldia.sigles})` : "";
    preguntes.push({
      pregunta: carrec ? `Qui és l'${carrec} ${de(nom)}?` : `Qui té l'alcaldia ${de(nom)}?`,
      resposta: carrec
        ? `L'${carrec} ${de(nom)} és ${f.alcaldia.nom}${sigles}.`
        : `L'alcaldia ${de(nom)} la té ${f.alcaldia.nom}${sigles}.`,
      font: f.alcaldia.font ?? fontDe(SOURCES.plens),
      quan,
      enllac: f.alcaldia.url ? { text: f.alcaldia.nom, url: f.alcaldia.url } : null,
    });
  }

  if (f.govern && f.govern.sigles.trim() !== "") {
    const g = f.govern;
    const majoria = g.majoriaAbsoluta === null ? "" : g.majoriaAbsoluta ? " amb majoria absoluta" : " sense majoria absoluta";
    const regidories =
      g.regidories === null ? "" : f.ple ? `: ${g.regidories} de les ${f.ple.regidories} regidories del ple` : `: ${g.regidories} regidories`;
    const mesVotada =
      g.mesVotada && g.mesVotada !== g.sigles ? ` La llista més votada a les municipals del 2023 va ser ${g.mesVotada}.` : "";
    preguntes.push({
      pregunta: `Quin partit governa ${nom}?`,
      resposta: `${majuscula(a(nom))} governa ${g.sigles}${majoria}${regidories}.${mesVotada}`,
      font: fontDe(SOURCES.plens),
      quan,
    });
  }

  if (f.ple && f.ple.regidories > 0) {
    preguntes.push({
      pregunta: `Quants regidors té l'Ajuntament ${de(nom)}?`,
      resposta: `El ple ${de(nom)} té ${enters(f.ple.regidories)} regidories, i la majoria absoluta és de ${enters(f.ple.majoria)}. La llei en fixa el nombre segons els habitants del municipi (LOREG, article 179).`,
      font: fontDe(SOURCES.resultats),
      quan: "municipals del 2023",
    });
  }

  const properes = properesMunicipals(f.consultat);
  preguntes.push({
    pregunta: `Quan són les properes eleccions municipals ${a(nom)}?`,
    resposta: `Les properes eleccions municipals són el diumenge ${dataCurta(properes)}, el mateix dia a tots els municipis. La llei electoral les fixa el quart diumenge de maig, cada quatre anys.`,
    font: { nom: "Llei orgànica del règim electoral general (LOREG), article 42.3", url: LOREG },
    quan: null,
  });

  const p = f.participacio;
  if (p && p.cens > 0 && p.votants >= 0 && p.votants <= p.cens) {
    preguntes.push({
      pregunta: `Quanta gent va votar ${a(nom)} a les municipals del ${p.any}?`,
      resposta: `A les municipals del ${p.any}, ${a(nom)} hi van votar ${enters(p.votants)} de les ${enters(p.cens)} persones del cens electoral: una participació del ${unDecimal((100 * p.votants) / p.cens)} %.`,
      font: fontDe(SOURCES.participacio),
      quan: null,
    });
  }

  const h = f.habitants;
  if (h && h.valor > 0 && h.any !== null) {
    preguntes.push({
      pregunta: `Quants habitants té ${nom}?`,
      resposta: `${majuscula(nom)} té ${enters(h.valor)} habitants, segons el padró del ${h.any}.`,
      font: h.font ?? fontDe(SOURCES.ensLocals),
      quan: null,
    });
  }

  return preguntes.slice(0, 6);
}

/**
 * D'on surt la composició d'un ens: les seus de la Diputació de Barcelona i de
 * la de Girona quan la J24 n'ha llegit els noms (el registre de plens els hi
 * deixa en blanc), i si no el registre de plens de la Generalitat.
 */
function fontComposicio(d: Pick<DadesEns, "fonts">): FontPregunta {
  const f: FontEns | undefined =
    d.fonts.find((x) => /diba\.cat|ddgi/.test(x.url)) ?? d.fonts.find((x) => /nm3n-3vbj/.test(x.url));
  return f ? { nom: f.nom, url: f.url } : fontDe(SOURCES.plens);
}

/**
 * La despesa liquidada de l'últim exercici que en té, amb la mateixa regla que
 * la pàgina (`exercicis()` a `ens.ts`): se sumen els capítols de despesa del
 * mateix pressupost que porten import, un capítol sense import no compta com a
 * zero, i un exercici sense cap import no té total.
 */
export function ultimaDespesaEns(d: Pick<DadesEns, "finances">): { any: number; total: number } | null {
  let millor: { any: number; total: number } | null = null;
  for (const { any, capitols } of d.finances?.anys ?? []) {
    const imports = capitols.filter((c) => c.tipus === "despeses" && c.liquidat !== null).map((c) => c.liquidat as number);
    if (imports.length === 0) continue;
    if (!millor || any > millor.any) millor = { any, total: imports.reduce((s, v) => s + v, 0) };
  }
  return millor;
}

/**
 * De tres a sis preguntes sobre una diputació o un consell comarcal: qui el
 * presideix, quants membres té, com s'escullen, quant gasta, quant cobra la
 * presidència (el que paga l'ens, i prou) i quant deu. Les dues primeres i la
 * tercera surten del registre i de la llei; les altres, només si la font en
 * publica la xifra.
 */
export function preguntesEns(d: DadesEns): PreguntaRapida[] {
  const diputacio = d.tipus === "diputacio";
  const membres = diputacio ? "diputats" : "consellers";
  const delTerritori = diputacio ? "de la demarcació" : "de la comarca";
  const quan = `dades ${delDia(d.consultat)}`;
  const composicio = fontComposicio(d);
  const preguntes: PreguntaRapida[] = [];

  const p = d.presidencia && d.presidencia.nom.trim() !== "" ? d.presidencia : null;
  if (p) {
    const nom = nomLlegible(p.nom);
    const partit = p.partit ? ` (${p.partit})` : "";
    const on = p.municipi ? `, que ${p.alcaldia ? "té l'alcaldia" : "seu al ple"} ${de(enFrase(p.municipi.nom))}` : "";
    const url = urlMembre(p);
    preguntes.push({
      pregunta: `Qui presideix ${ambArticle(d)}?`,
      resposta: `${majuscula(ambArticle(d))} ${diputacio ? "la" : "el"} presideix ${nom}${partit}${on}.`,
      font: composicio,
      quan,
      enllac: url ? { text: nom, url } : null,
    });
  }

  if (d.seients > 0) {
    preguntes.push({
      pregunta: `Quants ${membres} té ${ambArticle(d)}?`,
      resposta: `${majuscula(ambArticle(d))} té ${enters(d.seients)} ${membres}. La llei en fixa el nombre segons ${
        diputacio ? "els residents de la província (LOREG, article 204)" : "la població de la comarca (Decret legislatiu 4/2003, article 20)"
      }.`,
      font: composicio,
      quan,
    });
  }

  preguntes.push({
    pregunta: `Com s'escullen els ${membres} ${delEns(d)}?`,
    resposta: diputacio
      ? "No es voten a les urnes: surten de les eleccions municipals. La llei reparteix els seients entre els partits judicials segons els residents i, dins de cada un, per D'Hondt sobre els vots dels partits que hi han tret almenys un regidor; cada partit hi envia regidors seus. El ple tria la presidència entre els seus membres. Els d'ara surten de les municipals del 28 de maig del 2023."
      : "No es voten a les urnes: surten de les eleccions municipals. Hi entren les llistes amb un 3 % dels vots de la comarca o més; cada una rep una puntuació (un terç el seu percentatge de regidors i dos terços el de vots) i els seients es reparteixen per D'Hondt sobre aquesta puntuació. Cada partit hi envia regidors seus, i el ple tria la presidència entre els seus membres. Els d'ara surten de les municipals del 28 de maig del 2023.",
    font: diputacio
      ? { nom: "Llei orgànica del règim electoral general (LOREG), articles 204 a 206", url: LOREG }
      : { nom: "Decret legislatiu 4/2003, d'organització comarcal de Catalunya, article 20", url: DL_COMARCAL },
    quan: null,
  });

  const despesa = ultimaDespesaEns(d);
  if (despesa) {
    const perHabitant = d.poblacio && d.poblacio > 0 ? `, uns ${enters(despesa.total / d.poblacio)} € per habitant ${delTerritori}` : "";
    preguntes.push({
      pregunta: `Quant gasta ${ambArticle(d)}?`,
      resposta: `El ${despesa.any}, ${ambArticle(d)} va liquidar ${milionsEuros(despesa.total)} de despesa${perHabitant}.`,
      font: fontDe(SOURCES.liquidacio),
      quan: null,
    });
  }

  // Només un sou fix publicat (> 0): un zero vol dir «cap sou, potser
  // assistències», i la pàgina ho explica amb més matís del que hi cap aquí.
  const sou = p?.retribucio;
  if (p && sou && sou.anualBrut !== null && sou.anualBrut > 0 && sou.font) {
    const dedicacio = (sou.dedicacio ?? "").trim().toLowerCase().replace(/^dedicació\s+/, "");
    preguntes.push({
      pregunta: `Quant cobra la presidència ${delEns(d)}?`,
      resposta: `${nomLlegible(p.nom)} té una retribució de ${enters(sou.anualBrut)} € bruts l'any per presidir ${ambArticle(d)}${
        dedicacio ? `, amb dedicació ${dedicacio}` : ""
      }. És el que paga ${ambArticle(d)}; no hi compta el que pugui cobrar d'un altre ens.`,
      font: { nom: sou.font.nom, url: sou.font.url },
      quan: sou.font.consultat ? `dades ${delDia(sou.font.consultat)}` : null,
    });
  }

  const deute = (d.finances?.deute ?? []).reduce<{ any: number; deuteViu: number } | null>(
    (max, e) => (max === null || e.any > max.any ? e : max),
    null,
  );
  if (deute) {
    preguntes.push({
      pregunta: `Quant deu ${ambArticle(d)}?`,
      resposta: `A 31 de desembre del ${deute.any}, ${ambArticle(d)} tenia un deute viu de ${milionsEuros(deute.deuteViu)}.`,
      font: fontDe(SOURCES.deute),
      quan: null,
    });
  }

  return preguntes.slice(0, 6);
}

const escapeHtml = (t: string): string =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Les preguntes com a `FAQPage`. L'`@id` és el de la pàgina (`#pagina`)
 * perquè `capSeo()` el completa amb la resta del node de la pàgina (l'adreça,
 * el fil, qui la publica, de què parla) i n'escriu un de sol: una pàgina no pot
 * ser alhora un `WebPage` i un `FAQPage` amb dos noms diferents.
 */
export function preguntesLd(preguntes: readonly PreguntaRapida[], url: string): Record<string, unknown> {
  return {
    "@type": "FAQPage",
    "@id": `${url.split("#")[0]}#pagina`,
    mainEntity: preguntes.map((p) => ({
      "@type": "Question",
      name: p.pregunta,
      acceptedAnswer: { "@type": "Answer", text: textResposta(p) },
    })),
  };
}

/**
 * El cos del bloc, sense la secció ni el títol: per a les plantilles que ja
 * emboliquen cada bloc amb el seu `<section class="bloc">` i el seu `<h2>`
 * (la fitxa del municipi en fa una llista). Una llista de definicions (`<dl>`):
 * és el que és, una pregunta i la seva resposta, i un lector de pantalla les
 * llegeix aparellades.
 *
 * La resposta visible és **la mateixa** que la del JSON-LD, lletra per lletra,
 * amb una sola diferència: el tros d'`enllac` (el nom d'una persona) hi porta a
 * la seva fitxa.
 */
export function cosPreguntes(preguntes: readonly PreguntaRapida[]): string {
  if (preguntes.length === 0) return "";
  const parells = preguntes.map((p) => {
    let resposta = escapeHtml(p.resposta);
    if (p.enllac) {
      const text = escapeHtml(p.enllac.text);
      const on = resposta.indexOf(text);
      if (on >= 0) {
        resposta = `${resposta.slice(0, on)}<a href="${escapeHtml(p.enllac.url)}">${text}</a>${resposta.slice(on + text.length)}`;
      }
    }
    const font = p.font
      ? `<p class="geo-font">Font: ${
          p.font.url ? `<a href="${escapeHtml(p.font.url)}" rel="noopener">${escapeHtml(p.font.nom)}</a>` : escapeHtml(p.font.nom)
        }${p.quan ? `, ${escapeHtml(p.quan)}` : ""}.</p>`
      : p.quan
        ? `<p class="geo-font">${escapeHtml(p.quan)}</p>`
        : "";
    return `<div class="geo-parell">
    <dt class="geo-pregunta">${escapeHtml(p.pregunta)}</dt>
    <dd class="geo-resposta"><p>${resposta}</p>${font}</dd>
  </div>`;
  });
  return `<dl class="geo-llista">
  ${parells.join("\n  ")}
</dl>`;
}

/** El bloc sencer, amb la secció, l'àncora i el títol, per a les plantilles que no fan llista de blocs. */
export function blocPreguntes(
  preguntes: readonly PreguntaRapida[],
  opcions: { id?: string; titol?: string } = {},
): string {
  const cos = cosPreguntes(preguntes);
  if (cos === "") return "";
  const id = opcions.id ?? "preguntes-rapides";
  return `<section class="bloc geo-preguntes" id="${escapeHtml(id)}" aria-labelledby="${escapeHtml(id)}-titol">
  <h2 id="${escapeHtml(id)}-titol">${escapeHtml(opcions.titol ?? "Preguntes ràpides")}</h2>
  ${cos}
</section>`;
}

/**
 * Les dues meitats juntes, que és com s'han de fer servir: el bloc visible i
 * el JSON-LD que diu el mateix. Sense preguntes, el bloc és buit i el JSON-LD
 * `null` (no s'ha de passar a `capSeo()`).
 */
export function preguntesRapides(
  preguntes: readonly PreguntaRapida[],
  url: string,
  opcions: { id?: string; titol?: string } = {},
): { html: string; cos: string; jsonLd: Record<string, unknown> | null } {
  if (preguntes.length === 0) return { html: "", cos: "", jsonLd: null };
  return { html: blocPreguntes(preguntes, opcions), cos: cosPreguntes(preguntes), jsonLd: preguntesLd(preguntes, url) };
}

/**
 * El full del bloc. Tot porta el prefix `geo-` i va penjat de `.geo-llista`,
 * perquè cap regla no toqui res de fora (les classes curtes i nues xoquen amb
 * el peu i amb altres pàgines). Res de targetes amb ombra: una ratlla fina
 * entre parells, la pregunta en la lletra dels títols i la font en petit. Al
 * mòbil la pregunta va a sobre de la resposta; a partir de 640 px, al costat.
 */
export const GEO_CSS = `
.geo-llista{margin:var(--e2) 0 0;padding:0}
.geo-llista .geo-parell{display:grid;grid-template-columns:1fr;gap:6px;padding:var(--e2) 0;border-top:1.5px solid var(--vora)}
.geo-llista .geo-parell:first-child{border-top:0;padding-top:0}
.geo-llista .geo-pregunta{margin:0;font-family:var(--display);font-weight:700;font-size:1.04rem;line-height:1.3;color:var(--ink)}
.geo-llista .geo-resposta{margin:0;min-width:0}
.geo-llista .geo-resposta p{margin:0;line-height:1.55;max-width:66ch}
.geo-llista .geo-resposta .geo-font{margin-top:4px;font-size:.86rem;color:var(--ink-suau)}
.geo-llista a{color:inherit;text-decoration-thickness:1.5px;text-underline-offset:2px}
.geo-llista a:focus-visible{outline:3px solid var(--coral-text);outline-offset:2px;border-radius:4px}
@media (min-width:640px){.geo-llista .geo-parell{grid-template-columns:minmax(0,15rem) minmax(0,1fr);gap:var(--e3)}}
`;
