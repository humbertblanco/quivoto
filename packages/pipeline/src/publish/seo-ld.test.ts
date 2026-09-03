import { describe, expect, it } from "vitest";
import { accioDeCerca, ajuntament, catalegDeDades, conjuntDeDades, llistaOrdenada, llocsContinguts, mateixQue } from "./seo-ld";
import { scriptJsonLd } from "./seo";

const M = "https://quivoto.cat/observatori/m/olot/";

describe("mateixQue", () => {
  it("deixa fora els buits i els repetits, i no torna cap llista buida", () => {
    expect(mateixQue("https://www.wikidata.org/wiki/Q1", null, undefined, "", "https://www.wikidata.org/wiki/Q1")).toEqual([
      "https://www.wikidata.org/wiki/Q1",
    ]);
    expect(mateixQue(null, undefined)).toBeUndefined();
  });
});

describe("l'ajuntament", () => {
  it("és una GovernmentOrganization amb la preposició ben escrita i l'alcaldia com a employee", () => {
    const org = ajuntament("Olot", M, { nom: "Agustí Arbós Torrent", carrec: "alcalde", url: `${M}regidor/agusti-arbos-torrent/` });
    expect(org["@type"]).toBe("GovernmentOrganization");
    expect(org.name).toBe("Ajuntament d'Olot");
    expect(org["@id"]).toBe(`${M}#ajuntament`);
    expect(org.areaServed).toEqual({ "@id": `${M}#municipi` });
    expect(org.employee).toEqual({
      "@type": "Person",
      name: "Agustí Arbós Torrent",
      jobTitle: "Alcalde d'Olot",
      url: `${M}regidor/agusti-arbos-torrent/`,
    });
  });
  it("sense alcaldia coneguda no escriu cap employee, i sense fitxa de la persona cap url", () => {
    expect(JSON.stringify(ajuntament("Reus", M, null))).not.toContain("employee");
    const org = ajuntament("El Prat de Llobregat", M, { nom: "Lluís Mijoler", carrec: "alcalde", url: null });
    expect(org.name).toBe("Ajuntament del Prat de Llobregat");
    expect(JSON.stringify(org)).not.toContain('"url":null');
  });
});

describe("la llista ordenada", () => {
  const llista = llistaOrdenada(
    "Participació a les municipals del 2023",
    [
      { nom: "Olot", url: M },
      { nom: "Reus", url: "https://quivoto.cat/observatori/m/reus/" },
    ],
    { url: "https://quivoto.cat/observatori/ranquings/#participacio", total: 947 },
  );
  it("numera des d'1, apunta a la pàgina de cada element i diu la mida sencera", () => {
    expect(llista["@type"]).toBe("ItemList");
    expect(llista.numberOfItems).toBe(947);
    expect(llista.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Olot", url: M },
      { "@type": "ListItem", position: 2, name: "Reus", url: "https://quivoto.cat/observatori/m/reus/" },
    ]);
    expect(llista["@id"]).toBe("https://quivoto.cat/observatori/ranquings/#participacio#llista");
  });
  it("sense total, la mida és la de la llista", () => {
    expect(llistaOrdenada("x", [{ nom: "a", url: "u" }]).numberOfItems).toBe(1);
  });
});

describe("els llocs continguts", () => {
  it("són City amb nom i fitxa, i cap propietat quan no n'hi ha", () => {
    expect(llocsContinguts([{ nom: "Olot", url: M }])).toEqual([{ "@type": "City", name: "Olot", url: M }]);
    expect(llocsContinguts([])).toBeUndefined();
  });
});

describe("l'acció de cerca", () => {
  it("apunta a la mateixa pàgina amb ?q= i el mateix nom de paràmetre a query-input", () => {
    const a = accioDeCerca("https://quivoto.cat/observatori/");
    expect(a).toEqual({
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: "https://quivoto.cat/observatori/?q={cerca}" },
      "query-input": "required name=cerca",
    });
  });
});

describe("el conjunt de dades", () => {
  const url = "https://quivoto.cat/observatori/dades/";
  const d = conjuntDeDades({
    url,
    id: "dataset",
    nom: "Indicadors dels 947 municipis",
    descripcio: "Una fila per municipi.",
    fitxers: [
      { url: `${url}catalunya.csv`, format: "text/csv" },
      { url: `${url}catalunya.json`, format: "application/json" },
    ],
    llicencia: "https://creativecommons.org/licenses/by/4.0/",
    fonts: ["https://www.idescat.cat/", "https://www.idescat.cat/", "https://dadesobertes.seu-e.cat/"],
    dataModificacio: "2026-09-03",
    cataleg: `${url}#cataleg`,
    paraulesClau: ["municipis", "Catalunya"],
  });
  it("és un Dataset amb un DataDownload per fitxer, la llicència, les fonts sense repetir i el catàleg", () => {
    expect(d["@type"]).toBe("Dataset");
    expect(d["@id"]).toBe(`${url}#dataset`);
    expect(d.distribution).toEqual([
      { "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: `${url}catalunya.csv` },
      { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${url}catalunya.json` },
    ]);
    expect(d.isBasedOn).toEqual(["https://www.idescat.cat/", "https://dadesobertes.seu-e.cat/"]);
    expect(d.includedInDataCatalog).toEqual({ "@id": `${url}#cataleg` });
    expect(d.creator).toEqual({ "@id": "https://quivoto.cat/#organitzacio" });
    expect(d.spatialCoverage).toEqual({ "@type": "Place", name: "Catalunya" });
    expect(d.dateModified).toBe("2026-09-03");
  });
  it("no escriu propietats buides", () => {
    const json = JSON.stringify(conjuntDeDades({ url, id: "x", nom: "x", descripcio: "x", fitxers: [], llicencia: "l" }));
    expect(json).not.toContain("isBasedOn");
    expect(json).not.toContain("temporalCoverage");
    expect(json).not.toContain("keywords");
    expect(json).not.toContain("null");
  });
  it("el catàleg lliga els conjunts per l'@id", () => {
    const c = catalegDeDades(url, "Dades obertes", "x", [`${url}#dataset`]);
    expect(c["@type"]).toBe("DataCatalog");
    expect(c.dataset).toEqual([{ "@id": `${url}#dataset` }]);
  });
  it("dins d'un script, porta el context una sola vegada", () => {
    const script = scriptJsonLd(d);
    expect(script.match(/@context/g)).toHaveLength(1);
  });
});
