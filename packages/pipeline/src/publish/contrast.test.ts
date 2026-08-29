import { describe, expect, it } from "vitest";
import { PARTY_BRANDS } from "@quivoto/shared-schemas/brands";
import { MINIM_TEXT, TINTA_CLARA, TINTA_FOSCA, contrast, sobreColor, tintaSobre } from "./contrast";

/**
 * La regla d'aquest fitxer és una sola: cap sigla, cap xifra i cap inicial
 * escrita damunt del color d'un partit pot quedar per sota de 4,5:1. Abans hi
 * quedaven, i no era un cas rar: el turquesa de Junts és el color de la segona
 * força de Barcelona i les seves sigles hi eren a 2,08:1.
 */

describe("contrast", () => {
  it("mesura els extrems tal com els defineix la norma", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrast("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });

  it("no s'inventa res amb un color que no ho és", () => {
    expect(contrast("blau", "#ffffff")).toBe(1);
  });
});

describe("tintaSobre", () => {
  it("posa tinta fosca damunt del turquesa de Junts, que és on fallava", () => {
    // La fórmula YIQ hi posava tinta clara: 2,08:1. La fosca hi fa 7,55:1.
    expect(tintaSobre("#00c3b2")).toBe(TINTA_FOSCA);
    expect(contrast("#00c3b2", TINTA_FOSCA)).toBeGreaterThan(MINIM_TEXT);
  });

  it("manté la tinta clara on ja era la bona", () => {
    expect(tintaSobre("#18307b")).toBe(TINTA_CLARA); // el blau de CiU
    expect(tintaSobre("#662483")).toBe(TINTA_CLARA); // el lila dels comuns
  });

  it("posa tinta fosca damunt del groc d'ERC i del de la CUP", () => {
    expect(tintaSobre("#ffb232")).toBe(TINTA_FOSCA);
    expect(tintaSobre("#ffff00")).toBe(TINTA_FOSCA);
  });
});

describe("sobreColor", () => {
  it("deixa el color del partit intacte quan ja s'hi llegeix", () => {
    for (const color of ["#00c3b2", "#d00c3c", "#ffb232", "#18307b", "#662483"]) {
      expect(sobreColor(color).fons).toBe(color);
    }
  });

  it("cap color de marca no queda per sota del mínim", () => {
    for (const brand of PARTY_BRANDS) {
      const { fons, tinta } = sobreColor(brand.color);
      expect(contrast(fons, tinta), `${brand.id} (${brand.color} → ${fons})`).toBeGreaterThanOrEqual(MINIM_TEXT);
    }
  });

  it("mou el color només quan cap tinta no hi arriba, i el mou poc", () => {
    // Independents de Catalunya: 4,04:1 amb la fosca i 3,89:1 amb la clara.
    const { fons, tinta } = sobreColor("#6d7f8a");
    expect(fons).not.toBe("#6d7f8a");
    expect(tinta).toBe(TINTA_FOSCA);
    expect(contrast(fons, tinta)).toBeGreaterThanOrEqual(MINIM_TEXT);
    // El to es manté: continua sent el mateix blau grisós, només més clar.
    expect(contrast(fons, "#6d7f8a")).toBeLessThan(1.6);
  });

  it("també funciona amb els colors que porta la dada, que poden ser qualsevol", () => {
    // El gris clar de Barcelona en Comú del 2015 i el blau cel del PP del 2011,
    // que no són colors de marca sinó els que dona la font.
    for (const color of ["#D5D5D5", "#01A7E3", "#D48041", "#ffffff", "#808080"]) {
      const { fons, tinta } = sobreColor(color);
      expect(contrast(fons, tinta), color).toBeGreaterThanOrEqual(MINIM_TEXT);
    }
  });

  it("no peta amb un color que no es pot llegir", () => {
    expect(sobreColor("").fons).toBe("");
    expect(sobreColor("#zzz").tinta).toBe(TINTA_FOSCA);
  });
});
