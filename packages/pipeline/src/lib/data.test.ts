import { describe, expect, it } from "vitest";
import { dataCurta, delDia, elDia } from "./text";

/**
 * Aquesta funció existia tres vegades i només dues estaven bé. La de la fitxa
 * municipal, que és la que es publica 947 vegades, escrivia «19 de abril del
 * 1979» a la taula d'alcaldies. Ara n'hi ha una i té proves.
 */

describe("les dates, escrites com es diuen", () => {
  it("apostrofa els mesos que comencen per vocal", () => {
    // «21 de agost» és el gènere de detall que fa que una pàgina de dades
    // sembli escrita per una màquina que no llegeix el que publica.
    expect(dataCurta("2026-08-21")).toBe("21 d'agost del 2026");
    expect(dataCurta("2026-04-03")).toBe("3 d'abril del 2026");
    expect(dataCurta("2026-10-30")).toBe("30 d'octubre del 2026");
    expect(dataCurta("2026-07-14")).toBe("14 de juliol del 2026");
    expect(dataCurta("2026-03-02")).toBe("2 de març del 2026");
  });

  it("el dia 1 va amb apòstrof i no amb article sencer", () => {
    expect(elDia("2025-01-01")).toBe("l'1 de gener del 2025");
    expect(elDia("2025-01-21")).toBe("el 21 de gener del 2025");
    expect(delDia("2025-01-01")).toBe("de l'1 de gener del 2025");
    expect(delDia("2025-08-21")).toBe("del 21 d'agost del 2025");
  });

  it("sense data no inventa res", () => {
    expect(dataCurta(null)).toBe("");
    expect(elDia(null)).toBe("");
    expect(delDia(null)).toBe("");
  });
});

