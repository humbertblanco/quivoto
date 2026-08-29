import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MUN_CATALUNYA,
  PALMEROLA,
  filtresNoAplicats,
  parseEmexFitxa,
  parseJsonStat,
  type CelaJsonStat,
} from "./idescat";

/**
 * Els fixtures són respostes reals de l'API de l'Idescat, retallades a cinc
 * files de `MUN` i deixades intactes en tota la resta. Les cinc files són les
 * que fan mal:
 *
 *   · **Sabadell** (081878), que és el municipi on la diferència entre
 *     nacionalitat i lloc de naixement és de dotze mil persones.
 *   · **Abrera** (080018), un municipi mitjà qualsevol.
 *   · **Abella de la Conca** (250019), de 162 habitants: xifres petites.
 *   · **Palmerola** (171220), que surt a la classificació i no té dades.
 *   · **`TOTAL`**, que no és cap municipi sinó Catalunya sencera.
 */
const fixture = (nom: string): unknown =>
  JSON.parse(readFileSync(join(__dirname, "__fixtures__", nom), "utf8"));

const nacionalitat = parseJsonStat(fixture("idescat-nacionalitat.json"));
const llocNaixement = parseJsonStat(fixture("idescat-lloc-naixement.json"));

const cerca = (
  taula: { celes: CelaJsonStat[] },
  mun: string,
  any: number,
  categories: Record<string, string>,
): CelaJsonStat | undefined =>
  taula.celes.find(
    (c) =>
      c.mun === mun &&
      c.any === any &&
      Object.entries(categories).every(([dim, id]) => c.categories[dim] === id),
  );

describe("parseJsonStat", () => {
  it("desplega l'hipercub a files planes, una per municipi, any i categoria", () => {
    // 3 anys × 4 municipis × 2 nacionalitats. Catalunya en surt a part.
    expect(nacionalitat.celes).toHaveLength(24);
    expect(nacionalitat.catalunya).toHaveLength(6);
  });

  it("posa cada valor a la casella que li toca", () => {
    // Sabadell 2025: 34.062 persones de nacionalitat estrangera sobre 224.589.
    expect(cerca(nacionalitat, "081878", 2025, { NATION: "ESTR" })?.valor).toBe(34_062);
    expect(cerca(nacionalitat, "081878", 2025, { NATION: "TOTAL" })?.valor).toBe(224_589);
    // I el primer any de la sèrie, que és l'altre extrem de la variació.
    expect(cerca(nacionalitat, "081878", 2023, { NATION: "ESTR" })?.valor).toBe(29_953);
    // Un municipi petit, per comprovar que l'ordre de l'hipercub no s'ha girat.
    expect(cerca(nacionalitat, "250019", 2024, { NATION: "ESTR" })?.valor).toBe(26);
    expect(cerca(nacionalitat, "250019", 2024, { NATION: "TOTAL" })?.valor).toBe(161);
  });

  it("porta el nom del municipi que dona l'Idescat", () => {
    expect(cerca(nacionalitat, "081878", 2025, { NATION: "TOTAL" })?.municipi).toBe("Sabadell");
    expect(cerca(nacionalitat, "250019", 2025, { NATION: "TOTAL" })?.municipi).toBe("Abella de la Conca");
  });

  /**
   * El parany més gros d'aquesta API. La dimensió `MUN` porta una categoria
   * `TOTAL` que **és Catalunya**: per això les taules diuen 948 municipis quan
   * n'hi ha 947. Ingerir-la com si fos un poble posaria una fila de vuit
   * milions d'habitants dins dels grups de comparació.
   */
  it("no deixa mai que Catalunya passi per municipi", () => {
    expect(nacionalitat.celes.some((c) => c.mun === MUN_CATALUNYA)).toBe(false);
    expect(nacionalitat.celes.some((c) => c.municipi === "Catalunya")).toBe(false);
    expect(
      nacionalitat.catalunya.find((c) => c.any === 2025 && c.categories.NATION === "TOTAL")?.valor,
    ).toBe(8_124_126);
  });

  /**
   * Palmerola surt a la classificació territorial i no té cap dada. L'API ho
   * diu amb la marca `..`, que vol dir «confidencial, poc fiable o no
   * disponible» —i **no** vol dir zero. Si això entrés com a zero, Palmerola
   * apareixeria com un municipi que ha perdut tots els seus habitants.
   */
  it("distingeix «no ho sabem» de zero", () => {
    const cela = cerca(nacionalitat, PALMEROLA, 2025, { NATION: "TOTAL" });
    expect(cela?.valor).toBeNull();
    expect(cela?.estat).toBe("..");
    expect(nacionalitat.estats[".."]).toContain("no disponible");
    expect(nacionalitat.celes.some((c) => c.valor === 0)).toBe(false);
  });

  /**
   * La llicència de l'Idescat obliga a reconèixer l'origen amb els enllaços que
   * dona l'API i prohibeix modificar-los. Es guarden tal com arriben.
   */
  it("conserva els enllaços i l'atribució tal com els dona l'API", () => {
    expect(nacionalitat.href).toBe(
      "https://api.idescat.cat/taules/v2/censph/5992/5987/mun/data?NATION=ESTR,TOTAL&YEAR=2023,2024,2025&SEX=TOTAL",
    );
    expect(nacionalitat.enllacos[0]).toEqual({
      rel: "self",
      href: nacionalitat.href,
      label: "Població. Per nacionalitat i sexe. Municipis",
    });
    expect(nacionalitat.enllacos.some((e) => e.rel === "describedby")).toBe(true);
    expect(nacionalitat.source).toBe("Idescat, a partir del Cens de població anual de l'INE.");
    expect(nacionalitat.updated).toBe("2026-02-25");
  });

  it("guarda les categories de cada dimensió amb la seva etiqueta", () => {
    expect(nacionalitat.dimensions.NATION).toEqual({
      label: "nacionalitat",
      categories: [
        { id: "ESTR", label: "estrangera" },
        { id: "TOTAL", label: "total" },
      ],
    });
  });

  it("no s'empassa una resposta d'error com si fos una taula", () => {
    expect(() =>
      parseJsonStat({ version: "2.0", class: "error", status: "416", label: "Nombre màxim de dades superat." }),
    ).toThrow(/416/);
    expect(() => parseJsonStat({ hola: 1 })).toThrow(/JSON-stat/);
  });

  it("es planta si la taula no porta municipi o any", () => {
    expect(() =>
      parseJsonStat({ id: ["MUN"], size: [1], dimension: { MUN: { category: { index: ["080018"] } } }, value: [1] }),
    ).toThrow(/MUN o YEAR/);
  });

  it("accepta l'índex de categories en forma de diccionari", () => {
    // JSON-stat permet `index` com a llista o com a objecte id → posició.
    const taula = parseJsonStat({
      id: ["YEAR", "MUN"],
      size: [1, 2],
      dimension: {
        YEAR: { category: { index: { "2025": 0 } } },
        MUN: { category: { index: { "080018": 0, "081878": 1 }, label: { "080018": "Abrera", "081878": "Sabadell" } } },
      },
      value: { "0": 13207, "1": 224589 },
    });
    expect(taula.celes.map((c) => [c.mun, c.valor])).toEqual([
      ["080018", 13_207],
      ["081878", 224_589],
    ]);
  });
});

/**
 * La comprovació que evita l'error silenciós. L'API de l'Idescat **no** es
 * queixa d'un filtre desconegut: `?FOO=BAR` torna un 200 i la taula sencera.
 */
describe("filtresNoAplicats", () => {
  it("no diu res quan la taula ha tornat exactament el que li hem demanat", () => {
    expect(filtresNoAplicats(nacionalitat, { NATION: ["ESTR", "TOTAL"], SEX: ["TOTAL"] })).toEqual([]);
  });

  it("avisa quan la taula torna categories que no hem demanat", () => {
    const problemes = filtresNoAplicats(nacionalitat, { NATION: ["ESTR"] });
    expect(problemes).toHaveLength(1);
    expect(problemes[0]).toMatchObject({ dimensio: "NATION", obtingut: ["ESTR", "TOTAL"] });
  });

  it("avisa quan una categoria demanada no hi és", () => {
    // El dia que l'Idescat reanomeni `ESTR`, això ha de sortir a la llista.
    expect(filtresNoAplicats(nacionalitat, { NATION: ["ESTRANGERA"] })).toHaveLength(1);
    expect(filtresNoAplicats(nacionalitat, { INEXISTENT: ["X"] })).toHaveLength(1);
  });
});

/**
 * **Nacionalitat i lloc de naixement no són la mateixa cosa, i cap de les dues
 * no és «immigrant».** Aquesta prova hi és perquè el dia que algú toqui el
 * parseig i creui les dimensions, salti aquí i no a la fitxa d'un poble.
 */
describe("nacionalitat i lloc de naixement no es barregen mai", () => {
  it("compten coses diferents al mateix poble i el mateix any", () => {
    const estrangera = cerca(nacionalitat, "081878", 2025, { NATION: "ESTR" })!.valor!;
    const nascutsFora = cerca(llocNaixement, "081878", 2025, { PBIRTH: "ESTR" })!.valor!;
    expect(estrangera).toBe(34_062);
    expect(nascutsFora).toBe(46_870);
    // Dotze mil vuit-centes vuit persones de diferència, al mateix municipi.
    expect(nascutsFora - estrangera).toBe(12_808);
  });

  it("cada taula fa servir la seva dimensió, i no la de l'altra", () => {
    expect(Object.keys(nacionalitat.dimensions)).toContain("NATION");
    expect(Object.keys(nacionalitat.dimensions)).not.toContain("PBIRTH");
    expect(Object.keys(llocNaixement.dimensions)).toContain("PBIRTH");
    expect(Object.keys(llocNaixement.dimensions)).not.toContain("NATION");
    // Cap cel·la de nacionalitat no porta lloc de naixement, ni al revés.
    expect(nacionalitat.celes.every((c) => c.categories.PBIRTH === undefined)).toBe(true);
    expect(llocNaixement.celes.every((c) => c.categories.NATION === undefined)).toBe(true);
  });

  it("el total de població sí que és el mateix a les dues taules", () => {
    // És l'única xifra que comparteixen: el denominador.
    for (const any of [2023, 2024, 2025]) {
      expect(cerca(nacionalitat, "081878", any, { NATION: "TOTAL" })?.valor).toBe(
        cerca(llocNaixement, "081878", any, { PBIRTH: "TOTAL" })?.valor,
      );
    }
  });
});

describe("parseEmexFitxa", () => {
  const fitxa = parseEmexFitxa(fixture("idescat-emex-fitxa.json"));

  it("treu l'enllaç exacte de cada taula d'aquest municipi", () => {
    expect(fitxa.idescat6).toBe("081878");
    const perTaula = new Map(fitxa.enllacos.map((e) => [e.taula, e.href]));
    expect(perTaula.get("t68")).toBe("https://www.idescat.cat/pub/?id=censph&n=293&geo=mun:081878");
    expect(perTaula.get("t75")).toBe("https://www.idescat.cat/pub/?id=censph&n=479&geo=mun:081878");
    expect(perTaula.get("t25")).toBe("https://www.idescat.cat/pub/?id=censph&n=539&geo=mun:081878");
    expect(perTaula.get("t197")).toBe("https://www.idescat.cat/pub/?id=phre&n=3697&geo=mun:081878");
  });

  it("no perd la taula d'un grup que en té una de sola", () => {
    // L'EMEX torna `tt.t` com a objecte quan el grup només té una taula, i com
    // a llista quan en té més. El grup «Territori» és el cas d'objecte.
    expect(fitxa.enllacos.find((e) => e.taula === "t176")?.titol).toBe("Indicadors geogràfics");
  });

  it("porta el títol que dona l'API, per poder-lo mostrar sense inventar-ne cap", () => {
    expect(fitxa.enllacos.find((e) => e.taula === "t68")?.titol).toBe("Població. Per lloc de naixement");
  });

  it("no repeteix una taula si surt a més d'un grup", () => {
    const ids = fitxa.enllacos.map((e) => e.taula);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("es planta amb una resposta d'error de l'EMEX", () => {
    expect(() => parseEmexFitxa({ fitxes: { p: "id=", error: "404" } })).toThrow(/404/);
    expect(() => parseEmexFitxa({})).toThrow(/fitxes/);
  });
});
