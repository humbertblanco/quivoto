import { describe, expect, it } from "vitest";
import type { VotSeccionsMetric } from "../jobs/j47-vot-seccions";
import { combinaMunicipis, transformaCami } from "./vot-seccions-amb";
import { votDual } from "./vot-seccions-fitxa";

const marc = { x0: 0, y1: 100, escala: 1, marge: 0 };

function metrica(prefix: string, x0: number, sigles: string, familia: string | null): VotSeccionsMetric {
  return {
    origen: "generalitat", consultat: "2026-11-24", amplada: 100, alcada: 100,
    seccions: [{ codi: `${prefix}01001`, d: "M0 0l100 0 0 100z" }, { codi: `${prefix}01002`, d: "M0 0l50 50z" }],
    marc: { ...marc, x0 },
    eleccions: [
      { id: "M20231", etiqueta: "Municipals 2023", llistes: [
        { sigles, familia, color: "#000000", vots: 70 },
        { sigles: "ERC-AM", familia: "erc", color: "#ffb232", vots: 30 },
      ], files: { [`${prefix}01001`]: [100, 60, 0, 0, 40, 20], [`${prefix}01002`]: [80, 40, 0, 0, 10, 30] } },
      { id: "A20241", etiqueta: "Parlament 2024", llistes: [
        { sigles: "PSC", familia: "psc", color: "#d00c3c", vots: 50 },
        { sigles: "ERC", familia: "erc", color: "#ffb232", vots: 50 },
      ], files: { [`${prefix}01001`]: [100, 60, 0, 0, 25, 35], [`${prefix}01002`]: [80, 40, 0, 0, 10, 30] } },
    ],
    renda: null, xamfra: null, senseGeometria: {},
  };
}

describe("vot per secció · AMB", () => {
  it("un camí passat al mateix marc queda igual", () => {
    expect(transformaCami("M10 20l5 -3 0 4z", marc, { X0: 0, Y1: 100, E: 1, marge: 0 })).toBe("M10 20l5-3 0 4z");
  });

  it("escala els relatius i mou el punt inicial", () => {
    expect(transformaCami("M10 20l4 -2z", marc, { X0: -10, Y1: 100, E: 0.5, marge: 0 })).toBe("M10 10l2-1z");
  });

  it("ajunta municipis sumant les llistes per família, sense perdre cap vot", () => {
    const c = combinaMunicipis([
      { ine5: "08019", nom: "Barcelona", m: metrica("08019", 0, "PSC-CP", "psc") },
      { ine5: "08101", nom: "l'Hospitalet", m: metrica("08101", 100, "VEINS", "local") },
    ])!;
    expect(c.m.seccions).toHaveLength(4);
    expect(c.m.amplada).toBe(1000);
    const mun = c.m.eleccions.find((e) => e.id === "M20231")!;
    expect(mun.llistes.map((l) => l.sigles)).toEqual(["PSC", "Llistes locals", "ERC"]);
    expect(mun.files["0810101001"]).toEqual([100, 60, 0, 0, 0, 40, 20]);
    expect(c.municipis).toEqual({ "08019": "Barcelona", "08101": "l'Hospitalet" });
  });

  it("no ajunta les mètriques sense marc", () => {
    const m = metrica("08019", 0, "PSC-CP", "psc");
    delete m.marc;
    expect(combinaMunicipis([{ ine5: "08019", nom: "B", m }, { ine5: "08101", nom: "H", m }])).toBeNull();
  });

  it("compta el vot dual per família: una llista local que guanya l'ajuntament sempre és diferent", () => {
    expect(votDual(metrica("08019", 0, "PSC-CP", "psc"))).toEqual({ diferents: 1, total: 2 });
    // A la segona secció guanya ERC a totes dues: la mateixa força.
    expect(votDual(metrica("08101", 0, "VEINS", "local"))).toEqual({ diferents: 1, total: 2 });
  });
});
