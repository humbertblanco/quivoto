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
 */

import { de } from "../lib/text";
import { ORGANITZACIO } from "./seo";

/** Un nom i la seva adreça absoluta: el mínim que el cercador necessita d'un element. */
export type Enllac = { nom: string; url: string };

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
    "@id": opcions.url ? `${opcions.url}#llista` : undefined,
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
}): Record<string, unknown> {
  return {
    "@type": "Dataset",
    "@id": `${d.url}#${d.id}`,
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
