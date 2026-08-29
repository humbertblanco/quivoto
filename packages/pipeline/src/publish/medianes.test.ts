import { describe, expect, it } from "vitest";
import { medianaDelGrup } from "./medianes";

/**
 * La mediana del grup és el que fa que una xifra vulgui dir alguna cosa, i per
 * això ha de ser sempre la mateixa per a tots els municipis del mateix tram: si
 * cadascun es tragués ell mateix del càlcul, dos pobles veïns de la mateixa
 * mida veurien dues medianes diferents i la frase deixaria de ser comprovable.
 */
const GRUP = { key: "21", label: "de 20.001 a 50.000 habitants", size: 88 };

describe("medianaDelGrup", () => {
  const valors = new Map([["21", [50, 52, 54, 56, 58]]]);

  it("dona la mediana del grup, quants en són i com es diu", () => {
    const m = medianaDelGrup(valors, GRUP, 58);
    expect(m).not.toBeNull();
    expect(m!.mediana).toBe(54);
    expect(m!.quants).toBe(5);
    expect(m!.etiqueta).toBe("de 20.001 a 50.000 habitants");
  });

  it("no treu el municipi del seu propi grup: la mediana és la del tram", () => {
    // El mateix grup mirat des de dos municipis diferents dona la mateixa xifra.
    expect(medianaDelGrup(valors, GRUP, 50)!.mediana).toBe(54);
    expect(medianaDelGrup(valors, GRUP, 58)!.mediana).toBe(54);
  });

  it("situa el municipi dins del grup", () => {
    expect(medianaDelGrup(valors, GRUP, 50)!.percentil).toBe(10);
    expect(medianaDelGrup(valors, GRUP, 54)!.percentil).toBe(50);
    expect(medianaDelGrup(valors, GRUP, 58)!.percentil).toBe(90);
  });

  it("sense la xifra del municipi, la mediana hi és igual i el percentil no", () => {
    const m = medianaDelGrup(valors, GRUP, null);
    expect(m!.mediana).toBe(54);
    expect(m!.percentil).toBeNull();
  });

  it("un grup sense cap dada no en dona cap: val més no dir res", () => {
    expect(medianaDelGrup(new Map(), GRUP, 58)).toBeNull();
    expect(medianaDelGrup(new Map([["21", []]]), GRUP, 58)).toBeNull();
  });
});
