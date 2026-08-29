import { describe, expect, it } from "vitest";
import { marquesDe, normalitza, renderComparador, type ComparadorRow } from "./comparador";

describe("normalitza", () => {
  it("troba un municipi sense accents ni article", () => {
    expect(normalitza("l'Hospitalet de Llobregat")).toBe("hospitalet de llobregat");
    expect(normalitza("la Seu d'Urgell")).toBe("seu d urgell");
    expect(normalitza("Móra d'Ebre")).toBe("mora d ebre");
    expect(normalitza("Sant Julià de Ramis")).toBe("sant julia de ramis");
  });

  it("la cerca de l'usuari passa pel mateix sedàs que el nom", () => {
    expect(normalitza("l'Hospitalet de Llobregat").includes(normalitza("Hospitalet"))).toBe(true);
    expect(normalitza("la Seu d'Urgell").includes(normalitza("la seu"))).toBe(true);
  });
});

/**
 * Les dues funcions que viatgen a la pàgina s'hi incrusten amb `toString()`, i
 * al navegador s'executen soles. `new Function` reprodueix exactament això: si
 * el transpilador hi ha ficat cap ajudant seu —li va passar a una versió
 * anterior amb `__name`— o si la funció toca res de fora, aquí peta i a la
 * pàgina hauria petat en silenci.
 */
const aillada = <T>(fn: T): T => new Function("return (" + String(fn) + ")")() as T;

describe("el que s'incrusta a la pàgina", () => {
  it("marquesDe funciona sense res del seu mòdul al voltant", () => {
    expect(aillada(marquesDe)("avall", undefined, [253, 900, 12])).toEqual(["", "pitjor", "millor"]);
    expect(aillada(marquesDe)("objectiu", 50, [78, 52])).toEqual(["pitjor", "millor"]);
    expect(aillada(marquesDe)("cap", undefined, [1, 2])).toEqual(["", ""]);
  });

  it("normalitza funciona sense res del seu mòdul al voltant", () => {
    expect(aillada(normalitza)("l'Hospitalet de Llobregat")).toBe("hospitalet de llobregat");
  });
});

describe("marquesDe", () => {
  it("com més baix, millor: el deute", () => {
    expect(marquesDe("avall", undefined, [253, 900, 12])).toEqual(["", "pitjor", "millor"]);
  });

  it("com més alt, millor: la participació", () => {
    expect(marquesDe("amunt", undefined, [52.9, 61.2, 48])).toEqual(["", "millor", "pitjor"]);
  });

  it("el sentit no es dedueix del signe: estalvi negatiu és el pitjor, no el més petit", () => {
    expect(marquesDe("amunt", undefined, [-3.2, 11.7])).toEqual(["pitjor", "millor"]);
    expect(marquesDe("avall", undefined, [-3.2, 11.7])).toEqual(["millor", "pitjor"]);
  });

  it("la paritat es mesura per proximitat al 50 %, no per «com més dones millor»", () => {
    // 80 i 20 són igual de lluny de la paritat: cap dels dos no és millor que l'altre.
    expect(marquesDe("objectiu", 50, [50, 80, 20])).toEqual(["millor", "pitjor", "pitjor"]);
    expect(marquesDe("objectiu", 50, [50, 80, 35])).toEqual(["millor", "pitjor", ""]);
    // Un ple amb un 78 % de dones no és «millor» que un del 52 %.
    expect(marquesDe("objectiu", 50, [78, 52])).toEqual(["pitjor", "millor"]);
  });

  it("l'IBI no té un «millor»: només s'assenyalen els extrems", () => {
    expect(marquesDe("neutre", undefined, [0.7, 1.1, 0.4])).toEqual(["", "alt", "baix"]);
  });

  it("no marca res on no hi ha comparació possible", () => {
    expect(marquesDe("cap", undefined, [48221, 20500])).toEqual(["", ""]);
    expect(marquesDe("avall", undefined, [253, null])).toEqual(["", ""]);
    expect(marquesDe("amunt", undefined, [61, 61, 61])).toEqual(["", "", ""]);
  });

  it("marca tots els empats, no només el primer", () => {
    expect(marquesDe("avall", undefined, [10, 10, 90, 90])).toEqual(["millor", "millor", "pitjor", "pitjor"]);
  });

  it("salta els municipis sense dada sense desquadrar les posicions", () => {
    expect(marquesDe("amunt", undefined, [null, 90, 30, null])).toEqual(["", "millor", "pitjor", ""]);
  });
});

const fila = (slug: string, nom: string, valors: Record<string, number | null>): ComparadorRow => ({
  slug,
  nom,
  comarca: "Baix Llobregat",
  grup: "de 20.001 a 50.000 habitants",
  valors: { poblacio: 20_000, regidories: 21, ...valors },
  percentils: { deute: 42 },
  textos: {
    govern: { principal: "PSC-CP", secundari: "Algú Altre" },
    majoria: { principal: "Sí", secundari: "11 de 21 regidories" },
  },
});

describe("renderComparador", () => {
  const rows = [
    fila("esplugues-de-llobregat", "Esplugues de Llobregat", { deute: 253, selectiva: null }),
    fila("sant-just-desvern", "Sant Just Desvern", { deute: 120, selectiva: null }),
  ];

  it("incrusta el conjunt i la funció que decideix el millor, no una còpia", () => {
    const html = renderComparador(rows, "2026-08-29");
    expect(html).toContain("esplugues-de-llobregat");
    expect(html).toContain("const marquesDe = function marquesDe(");
    expect(html).toContain("const normalitza = function normalitza(");
  });

  it("no treu la fila de la recollida selectiva del no-res", () => {
    const sense = renderComparador(rows, "2026-08-29");
    expect(sense).not.toContain("Recollida selectiva");

    const amb = renderComparador(
      [rows[0]!, { ...rows[1]!, valors: { ...rows[1]!.valors, selectiva: 61.4 } }],
      "2026-08-29",
    );
    expect(amb).toContain("Recollida selectiva");
  });

  it("cap fila no es publica sense dir d'on surt", () => {
    const html = renderComparador(rows, "2026-08-29");
    for (const font of ["6nei-4b44", "irrv-2mfc", "34db8dc5", "81f18313", "eecca986", "82ae0ea2", "xnfg-weec", "1a9c1ede"]) {
      expect(html).toContain(font);
    }
  });
});
