import { describe, expect, it } from "vitest";
import { CLAUS_GLOSSARI, GLOSSARI, esClauGlossari, renderGlossari } from "./glossari";

/**
 * El glossari és text i prou, i el que s'ha de provar és el que el projecte
 * exigeix a tot text que explica una xifra: que digui què és, que digui d'on
 * surt i que no hi posi cap veredicte.
 */
describe("GLOSSARI", () => {
  it("té una entrada per clau, i cada entrada diu què és i d'on surt", () => {
    for (const clau of CLAUS_GLOSSARI) {
      const e = GLOSSARI[clau];
      expect(e.etiqueta.trim().length, clau).toBeGreaterThan(0);
      expect(e.que.trim().length, clau).toBeGreaterThan(20);
      expect(e.font.trim().length, clau).toBeGreaterThan(0);
    }
    expect(Object.keys(GLOSSARI).sort()).toEqual([...CLAUS_GLOSSARI].sort());
  });

  it("no jutja cap xifra: ni «millor» ni «pitjor» en cap entrada", () => {
    for (const clau of CLAUS_GLOSSARI) {
      const text = `${GLOSSARI[clau].etiqueta} ${GLOSSARI[clau].que} ${GLOSSARI[clau].font}`.toLowerCase();
      expect(text, clau).not.toMatch(/millor|pitjor/);
    }
  });

  it("reconeix les claus canòniques i no les d'altres pàgines", () => {
    expect(esClauGlossari("deute-habitant")).toBe(true);
    expect(esClauGlossari("dones-ple")).toBe(true);
    // «paritat» era la clau vella dels indicadors de comarca; ja no existeix.
    expect(esClauGlossari("paritat")).toBe(false);
    expect(esClauGlossari("toString")).toBe(false);
  });
});

describe("renderGlossari", () => {
  it("surt plegat, amb un terme i una font per clau, en l'ordre demanat", () => {
    const html = renderGlossari(["renda", "deute-habitant"]);
    expect(html.startsWith('<details class="nota glossari">')).toBe(true);
    expect(html).toContain("<summary>Què vol dir cada xifra</summary>");
    expect(html).toContain("<dt>Renda neta per persona <span class=\"unitat\">€ l'any</span></dt>");
    expect(html).toContain("Font: INE, Atles de distribució de renda de les llars.");
    expect(html.indexOf("Renda neta per persona")).toBeLessThan(html.indexOf("Deute per habitant"));
  });

  it("no repeteix una clau demanada dues vegades ni obre un glossari buit", () => {
    const html = renderGlossari(["selectiva", "selectiva"]);
    expect(html.split("<dt>").length - 1).toBe(1);
    expect(renderGlossari([])).toBe("");
  });

  it("accepta un títol propi", () => {
    expect(renderGlossari(["pmp"], { titol: "Com es compta" })).toContain("<summary>Com es compta</summary>");
  });
});
