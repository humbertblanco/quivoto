import { describe, expect, it } from "vitest";
import { FONT_TERRITORI, territoriDeFila, textNet, xifra, type FilaTerritori } from "./j32-territori";

/**
 * El que s'ha de provar no és que sàpiga baixar un JSON: és que **llegeixi
 * bé el que la font escriu** —textos amb punt decimal, buits, guions— i que
 * no converteixi cap absència en un zero. Les files són les tres primeres
 * del conjunt real del 3 de setembre de 2026, retallades als camps que la
 * feina demana.
 */
const abrera = (over: Partial<FilaTerritori> = {}): FilaTerritori => ({
  codi_ens: "0800180001",
  superficie: "19.98",
  altura: "105",
  gentilici: "abrerencs",
  ubicacio: "Interior",
  data_actualitzacio: "2024-07-21T00:00:00.000",
  ...over,
});

describe("xifra", () => {
  it("llegeix el text de Socrata amb punt decimal i hi posa la unitat", () => {
    expect(xifra("19.98", "km²")).toEqual({ valor: 19.98, unitat: "km²" });
    expect(xifra("105", "m")).toEqual({ valor: 105, unitat: "m" });
    // Si un dia arriba amb coma, també.
    expect(xifra("43,14", "km²")).toEqual({ valor: 43.14, unitat: "km²" });
  });

  it("no converteix cap absència en un zero", () => {
    expect(xifra("", "m")).toBeNull();
    expect(xifra("-", "m")).toBeNull();
    expect(xifra("n/d", "m")).toBeNull();
    expect(xifra(null, "m")).toBeNull();
    expect(xifra(undefined, "m")).toBeNull();
    // Un negatiu no és cap superfície ni cap altitud de Catalunya.
    expect(xifra("-5", "m")).toBeNull();
  });
});

describe("textNet", () => {
  it("retalla espais i tracta el guió com a buit", () => {
    expect(textNet(" abrerencs ")).toBe("abrerencs");
    expect(textNet("-")).toBeNull();
    expect(textNet("")).toBeNull();
    expect(textNet(null)).toBeNull();
  });
});

describe("territoriDeFila", () => {
  it("desa superfície, altitud, gentilici i ubicació amb la font, la consulta i la llicència", () => {
    const t = territoriDeFila(abrera(), { habitants: 13_227, any: 2025 }, "2026-09-03");
    expect(t.superficie).toEqual({ valor: 19.98, unitat: "km²" });
    expect(t.altitud).toEqual({ valor: 105, unitat: "m" });
    expect(t.gentilici).toBe("abrerencs");
    expect(t.gentiliciFemeni).toBeNull();
    expect(t.ubicacio).toBe("Interior");
    expect(t.source).toEqual({
      ...FONT_TERRITORI,
      consultat: "2026-09-03",
      actualitzat: "2024-07-21",
    });
    expect(t.source.dataset).toBe("6nei-4b44");
    expect(t.source.llicencia).not.toBe("");
  });

  it("calcula la densitat amb el padró de J1 i en recorda l'any", () => {
    const t = territoriDeFila(abrera(), { habitants: 13_227, any: 2025 }, "2026-09-03");
    // 13.227 / 19,98 = 662,01…: un decimal.
    expect(t.densitat).toEqual({ valor: 662, unitat: "hab./km²", anyPadro: 2025 });
    const aguilar = territoriDeFila(abrera({ superficie: "43.14" }), { habitants: 292, any: 2025 }, "2026-09-03");
    expect(aguilar.densitat).toEqual({ valor: 6.8, unitat: "hab./km²", anyPadro: 2025 });
  });

  it("no calcula la densitat si falta el padró o la superfície", () => {
    expect(territoriDeFila(abrera(), null, "2026-09-03").densitat).toBeNull();
    expect(territoriDeFila(abrera({ superficie: "" }), { habitants: 13_227, any: 2025 }, "2026-09-03").densitat).toBeNull();
    // Una superfície de zero tampoc no divideix res.
    expect(territoriDeFila(abrera({ superficie: "0" }), { habitants: 13_227, any: 2025 }, "2026-09-03").densitat).toBeNull();
  });

  it("deixa en null el que la font no porta, sense inventar-se res", () => {
    const t = territoriDeFila(
      abrera({ superficie: null, altura: "-", gentilici: "", ubicacio: undefined, data_actualitzacio: null }),
      { habitants: 100, any: null },
      "2026-09-03",
    );
    expect(t.superficie).toBeNull();
    expect(t.altitud).toBeNull();
    expect(t.gentilici).toBeNull();
    expect(t.ubicacio).toBeNull();
    expect(t.densitat).toBeNull();
    expect(t.source.actualitzat).toBeNull();
  });
});
