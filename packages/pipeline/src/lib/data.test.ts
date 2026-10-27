import { describe, expect, it } from "vitest";
import { consultatEl, dataCurta, dataEscrita, delDia, elDia, elDiaAlPrincipi, isoDeData } from "./text";

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

describe("l'11 també s'apostrofa", () => {
  it("«l'11 de juny» i «de l'11 de juny», però «el 21» i «del 12»", () => {
    expect(elDia("2026-06-11")).toBe("l'11 de juny del 2026");
    expect(delDia("2026-06-11")).toBe("de l'11 de juny del 2026");
    expect(elDia("2026-06-21")).toBe("el 21 de juny del 2026");
    expect(delDia("2026-06-12")).toBe("del 12 de juny del 2026");
    expect(elDia("2026-10-01")).toBe("l'1 d'octubre del 2026");
  });

  it("a començament de frase, amb majúscula", () => {
    expect(elDiaAlPrincipi("2026-10-11")).toBe("L'11 d'octubre del 2026");
    expect(elDiaAlPrincipi("2026-10-27")).toBe("El 27 d'octubre del 2026");
  });
});

describe("un sol formatador de dates per al veí", () => {
  it("entén ISO, ISO amb hora i dia/mes/any", () => {
    expect(isoDeData("2026-10-27")).toBe("2026-10-27");
    expect(isoDeData("2026-10-27T10:00:00Z")).toBe("2026-10-27");
    expect(isoDeData("26/03/2026")).toBe("2026-03-26");
    expect(isoDeData("1/4/2026")).toBe("2026-04-01");
    expect(isoDeData("2026")).toBeNull();
    expect(isoDeData("ahir")).toBeNull();
  });

  it("escriu la data com es diu, vingui com vingui", () => {
    expect(dataEscrita("2024-10-09")).toBe("9 d'octubre del 2024");
    expect(dataEscrita("26/03/2026")).toBe("26 de març del 2026");
    expect(dataCurta("21/03/2026")).toBe("21 de març del 2026");
    expect(elDia("11/06/2026")).toBe("l'11 de juny del 2026");
    expect(dataEscrita("no és una data")).toBeNull();
    expect(dataEscrita(null)).toBeNull();
  });

  it("el peu de font: «consultat el…», i si la data no s'entén, tal com ve", () => {
    expect(consultatEl("2026-10-27")).toBe("consultat el 27 d'octubre del 2026");
    expect(consultatEl("21/03/2026")).toBe("consultat el 21 de març del 2026");
    expect(consultatEl("2026-06-01")).toBe("consultat l'1 de juny del 2026");
    expect(consultatEl("2026")).toBe("consultat el 2026");
    expect(consultatEl(null)).toBe("");
  });
});
