import { describe, expect, it } from "vitest";
import { nomAssistent, semblaUnNom } from "./publish";
/**
 * L'assistència als plens era la dada més perillosa de tot el projecte: a les
 * Franqueses del Vallès **els catorze regidors sortien amb «1 de 49 plens»**,
 * l'alcalde inclòs. Publicar això no és una dada fluixa, és una acusació.
 */
describe("qui consta a la llista d'assistents", () => {
  it("treu el càrrec que l'acta enganxa al nom", () => {
    expect(nomAssistent("Juan Antonio Corchado Ponce, alcalde")).toBe("Juan Antonio Corchado Ponce");
    expect(nomAssistent("Dolors Amaro Fitó, tinenta d’alcalde (SPLF)")).toBe("Dolors Amaro Fitó");
    expect(nomAssistent("Eva Navarrete Bachs")).toBe("Eva Navarrete Bachs");
  });

  it("no compta com a persona el que no ho és", () => {
    // Tot això sortia de debò de la lectura de les actes, comptant plens.
    expect(semblaUnNom("Nom i Cognoms")).toBe(false);
    expect(semblaUnNom("ACORD ÚNIC.- DICTAMEN QUE PROPOSA")).toBe(false);
    expect(semblaUnNom("El documento ha sido firmado por :")).toBe(false);
    expect(semblaUnNom("Secretari")).toBe(false);
  });

  it("i sí que compta les persones de debò, amb càrrec i tot", () => {
    expect(semblaUnNom("Juan Antonio Corchado Ponce, alcalde")).toBe(true);
    expect(semblaUnNom("Maria del Mar Gallego Garrido, regidora")).toBe(true);
    expect(semblaUnNom("Arià Pérez Isidro")).toBe(true);
  });
});
