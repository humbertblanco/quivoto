import { describe, expect, it } from "vitest";
import { splitName } from "./j3-councillors";

/**
 * El registre de plens escriu anotacions entre parèntesis al costat del nom
 * («EVA LABRADOR CUADRADO (Ind.)»), i sense separar-les el nom no lliga amb
 * cap altra font: la mateixa regidora semblaria dues persones.
 */
describe("splitName", () => {
  it("separa el nom de l'anotació entre parèntesis", () => {
    expect(splitName("EVA LABRADOR CUADRADO (Ind.)")).toEqual({
      name: "EVA LABRADOR CUADRADO",
      note: "Ind.",
    });
  });

  it("un nom sense parèntesis queda sencer i sense nota", () => {
    expect(splitName("Marta Alarcón i Puerto")).toEqual({
      name: "Marta Alarcón i Puerto",
      note: null,
    });
  });

  it("retalla els espais que la font arrossega", () => {
    expect(splitName("  Pere Coll  (ERC) ")).toEqual({ name: "Pere Coll", note: "ERC" });
  });
});
