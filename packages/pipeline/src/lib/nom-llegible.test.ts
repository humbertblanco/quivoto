import { describe, expect, it } from "vitest";
import { nomLlegible } from "./text";

/**
 * La taula d'alcaldies barreja fonts i es veu: a la fitxa de Barcelona hi
 * conviuen «Jaume Collboni Cuadrado» i «ADA COLAU BALLANO». Qui llegeix no ha
 * de deduir que el crit és la font i no la persona.
 */
describe("nomLlegible", () => {
  it("no toca un nom que ja està escrit bé", () => {
    expect(nomLlegible("Jaume Collboni Cuadrado")).toBe("Jaume Collboni Cuadrado");
    expect(nomLlegible("Ada Colau Ballano")).toBe("Ada Colau Ballano");
    expect(nomLlegible("Xavier Trias i Vidal de Llobatera")).toBe("Xavier Trias i Vidal de Llobatera");
  });

  it("baixa el crit de les fonts que escriuen en majúscules", () => {
    expect(nomLlegible("ADA COLAU BALLANO")).toBe("Ada Colau Ballano");
    expect(nomLlegible("JORDI HEREU BOHER")).toBe("Jordi Hereu Boher");
    expect(nomLlegible("PASQUAL MARAGALL MIRA")).toBe("Pasqual Maragall Mira");
  });

  it("deixa la partícula en minúscula, però no si obre el nom", () => {
    expect(nomLlegible("JOAN DE LA CRUZ SOLER")).toBe("Joan de la Cruz Soler");
    expect(nomLlegible("PASQUAL MARAGALL I MIRA")).toBe("Pasqual Maragall i Mira");
    expect(nomLlegible("DE LA ROSA PONS")).toBe("De la Rosa Pons");
  });

  it("parteix pel guionet i per l'apòstrof", () => {
    expect(nomLlegible("MARIA GARCIA-MORENO")).toBe("Maria Garcia-Moreno");
    expect(nomLlegible("JOSEP D'URGELL FERRER")).toBe("Josep d'Urgell Ferrer");
  });

  it("manté els accents catalans i no peta amb el buit", () => {
    expect(nomLlegible("MARIA ASSUMPCIÓ LAÏLLA JOU")).toBe("Maria Assumpció Laïlla Jou");
    expect(nomLlegible("   ")).toBe("");
  });
});
