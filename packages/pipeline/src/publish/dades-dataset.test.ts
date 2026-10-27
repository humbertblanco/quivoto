import { describe, expect, it } from "vitest";
import { datasetCatalunya, renderDadesIndex } from "./dades";

/**
 * Les dades enriquides de la pàgina de dades, provades sense la base.
 *
 * `dades.test.ts` escriu els fitxers de descàrrega amb una base de veritat i
 * no es pot executar mentre una altra feina la té oberta (PGlite és d'un sol
 * procés). El `Dataset` que llegeix Google Dataset Search, en canvi, és una
 * funció pura de l'adreça, el nombre de municipis i la data: es prova aquí,
 * sola, perquè es pugui provar sempre.
 */

const URL_DADES = "https://quivoto.cat/observatori/dades/";

const conjunt = (nodes: Record<string, unknown>[], id: string): Record<string, unknown> =>
  nodes.find((n) => n["@id"] === `${URL_DADES}#${id}`)!;

describe("el Dataset de Catalunya", () => {
  const nodes = datasetCatalunya(URL_DADES, "Els indicadors dels 947 municipis.", 947, "2026-10-27T10:00:00Z");
  const catalunya = conjunt(nodes, "dataset");

  it("cobreix del 1979 a l'any de la publicació", () => {
    expect(catalunya.temporalCoverage).toBe("1979/2026");
    expect(catalunya.dateModified).toBe("2026-10-27");
  });

  it("diu què mesura amb les etiquetes de les columnes del fitxer, sense repetir-ne cap", () => {
    const variables = catalunya.variableMeasured as string[];
    expect(variables).toContain("Deute per habitant");
    expect(variables).toContain("Participació del 2023");
    expect(variables).toContain("Persones que han ocupat l'alcaldia des del 1979");
    expect(new Set(variables).size).toBe(variables.length);
    // Un camp que només és al fitxer de cada municipi no és cap columna de catalunya.csv.
    expect(variables).not.toContain("Forces diferents a l'alcaldia des del 1979");
  });

  it("sense data de publicació, l'interval queda obert i no s'inventa cap any", () => {
    const sense = conjunt(datasetCatalunya(URL_DADES, "x", 947), "dataset");
    expect(sense.temporalCoverage).toBe("1979/..");
    expect(sense.dateModified).toBeUndefined();
  });

  it("el registre de fonts no diu que mesuri res: és l'esquema, no les dades", () => {
    // El registre penja de l'àncora «D'on surt» (`#fonts`): el seu @id és `#fonts-registre`.
    const registre = conjunt(nodes, "fonts-registre");
    expect(registre["@type"]).toBe("Dataset");
    expect(registre.variableMeasured).toBeUndefined();
    expect(registre.temporalCoverage).toBeUndefined();
  });

  it("la pàgina porta el mateix Dataset al cap", () => {
    const html = renderDadesIndex("2026-10-27T10:00:00Z", { municipis: 947, camps: 80 });
    expect(html).toContain('"temporalCoverage":"1979/2026"');
    expect(html).toContain('"variableMeasured":[');
  });
});

/*
 * La marca (vegeu «les pastilles» a estil.ts): els fitxers de cada baixada són
 * enllaços i van subratllats com tota la navegació, no en pastilles amb vora.
 */
describe("els fitxers de la pàgina de dades", () => {
  const html = renderDadesIndex("2026-10-27T10:00:00Z", { municipis: 947, camps: 80 });

  it("són «.navega», sense pastilla", () => {
    expect(html).toContain('<div class="parell"><a class="navega" href="catalunya.csv">CSV</a><a class="navega" href="catalunya.json">JSON</a></div>');
    expect(html).toContain('<a class="navega" href="manifest.json">manifest.json</a>');
    const css = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
    const regla = css.slice(css.indexOf(".parell a{"), css.indexOf("}", css.indexOf(".parell a{")));
    expect(regla).not.toContain("var(--r-max)");
    expect(regla).not.toContain("border:");
  });
});
