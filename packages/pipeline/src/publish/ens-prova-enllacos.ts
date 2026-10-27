import type { DadesEns, MembreEns } from "./ens-tipus";

/**
 * Ens de mentida per a les proves dels enllaços cap a les fitxes d'ens.
 *
 * La comarca, la fitxa municipal, la del regidor, el cercador i la portada
 * enllacen totes cap a les diputacions i els consells, i totes necessiten el
 * mateix: un `DadesEns` complet, petit i escrit a mà, que no surti de cap
 * base de dades. Viu aquí i no copiat a cada `.test.ts` perquè el dia que el
 * contracte (`ens-tipus.ts`) guanyi un camp, només s'hagi de tocar un lloc.
 *
 * No el fa servir cap pàgina publicada: només els tests.
 */

/** Un membre amb tot el que no importa ja posat. */
export function membreDeProva(over: Partial<MembreEns> = {}): MembreEns {
  return {
    nom: "Anna Puig Serra",
    carrec: "Consellera",
    rol: "membre",
    ordre: null,
    partit: "ERC",
    partitFont: "ens",
    municipi: null,
    municipiFont: null,
    alcaldia: false,
    adreca: null,
    foto: null,
    retribucio: null,
    // La clau del grup segueix el partit que demana el test, si en demana un.
    grup: over.partit ?? "ERC",
    color: "#ffb232",
    ...over,
  };
}

/** Un consell comarcal o una diputació, amb el mínim que fa servir una pàgina. */
export function ensDeProva(over: Partial<DadesEns> = {}): DadesEns {
  const tipus = over.tipus ?? "consell";
  return {
    tipus,
    codiEns: tipus === "consell" ? "0800000000" : "0810000000",
    nom: tipus === "consell" ? "Consell Comarcal del Bages" : "Diputació de Barcelona",
    territori: tipus === "consell" ? "Bages" : "Barcelona",
    article: tipus === "consell" ? "el Bages" : null,
    cif: null,
    gerent: null,
    municat: null,
    web: null,
    seients: 33,
    membres: [],
    finances: null,
    districtes: null,
    wikidata: null,
    escut: null,
    fonts: [],
    avisos: [],
    consultat: "2026-10-27",
    slug: tipus === "consell" ? "bages" : "barcelona",
    seu: null,
    composicio: [],
    presidencia: null,
    municipis: [],
    poblacio: null,
    comarca: tipus === "consell" ? { slug: "bages", nom: "Bages" } : null,
    comarques: [],
    repartiment: null,
    subvencions: null,
    ...over,
  };
}
