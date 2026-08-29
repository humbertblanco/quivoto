import { describe, expect, it } from "vitest";
import { MIN_GROUP, bracketIndexFor, buildPeerGroups, medianOf, percentileOf } from "./peers";

describe("bracketIndexFor", () => {
  it("fa servir els trams de la LOREG, que ja són oficials", () => {
    expect(bracketIndexFor(80)).toBe(0);
    expect(bracketIndexFor(200)).toBe(1);
    expect(bracketIndexFor(3_000)).toBe(4);
    expect(bracketIndexFor(48_221)).toBe(7); // Esplugues
    expect(bracketIndexFor(225_368)).toBe(9); // Sabadell, fora dels trams tancats
  });
});

describe("buildPeerGroups", () => {
  const catalunya = [
    ...Array.from({ length: 40 }, (_, i) => ({ id: i + 1, population: 300 })),
    ...Array.from({ length: 30 }, (_, i) => ({ id: 100 + i, population: 30_000 })),
    ...Array.from({ length: 3 }, (_, i) => ({ id: 200 + i, population: 500_000 })),
  ];

  it("posa cada municipi en un grup", () => {
    const groups = buildPeerGroups(catalunya);
    expect(groups.size).toBe(catalunya.length);
  });

  it("cap grup no queda per sota del mínim", () => {
    const groups = buildPeerGroups(catalunya);
    for (const group of groups.values()) expect(group.size).toBeGreaterThanOrEqual(MIN_GROUP);
  });

  it("ajunta els trams grans, que sempre queden curts", () => {
    const groups = buildPeerGroups(catalunya);
    // Els 3 de mig milió no poden formar grup sols: han d'anar amb els de 30.000.
    expect(groups.get(200)!.key).toBe(groups.get(100)!.key);
  });

  it("no barreja un poble de 300 habitants amb una ciutat", () => {
    const groups = buildPeerGroups(catalunya);
    expect(groups.get(1)!.key).not.toBe(groups.get(200)!.key);
  });

  it("ignora els municipis sense padró en comptes de fer-los caure a un tram fals", () => {
    const groups = buildPeerGroups([...catalunya, { id: 999, population: null }]);
    expect(groups.has(999)).toBe(false);
  });
});

describe("percentileOf", () => {
  it("situa el valor dins del grup", () => {
    const grup = [10, 20, 30, 40, 50];
    expect(percentileOf(10, grup)).toBe(10);
    expect(percentileOf(30, grup)).toBe(50);
    expect(percentileOf(50, grup)).toBe(90);
  });

  it("reparteix els empats, que als comptes municipals són molts", () => {
    // 400 municipis catalans tenen zero deute: no poden ser tots el percentil 0.
    const grup = [0, 0, 0, 0, 100];
    expect(percentileOf(0, grup)).toBe(40);
    expect(percentileOf(100, grup)).toBe(90);
  });

  it("no inventa un percentil si el grup és buit", () => {
    expect(percentileOf(5, [])).toBeNull();
  });
});

describe("medianOf", () => {
  it("calcula la mediana amb un nombre parell i senar de valors", () => {
    expect(medianOf([1, 2, 3])).toBe(2);
    expect(medianOf([1, 2, 3, 4])).toBe(2.5);
    expect(medianOf([])).toBeNull();
  });

  it("el percentil 50 del grup és la seva mediana", () => {
    const grup = [3, 9, 1, 7, 5];
    const mediana = medianOf(grup)!;
    expect(percentileOf(mediana, grup)).toBe(50);
  });
});

describe("com s'anomena el grup", () => {
  it("escriu bé el nom quan dos trams s'ajunten", () => {
    // El tram de més de 100.000 mai té prou companys i sempre s'ajunta amb el
    // de sota: el nom ha de sortir dels números, no d'enganxar dues etiquetes.
    const groups = buildPeerGroups([
      ...Array.from({ length: 20 }, (_, i) => ({ id: i + 1, population: 60_000 })),
      ...Array.from({ length: 5 }, (_, i) => ({ id: 100 + i, population: 400_000 })),
    ]);
    const label = groups.get(100)!.label;
    expect(label).toBe("de més de 50.000 habitants");
    expect(label).not.toContain("de més de 100.000 habitants habitants");
  });

  it("diu «fins a» al tram més petit quan hi ha municipis més grans", () => {
    const groups = buildPeerGroups([
      ...Array.from({ length: 20 }, (_, i) => ({ id: i + 1, population: 50 })),
      ...Array.from({ length: 20 }, (_, i) => ({ id: 100 + i, population: 30_000 })),
    ]);
    expect(groups.get(1)!.label).toBe("fins a 100 habitants");
  });

  it("el nom descriu els municipis que hi ha al grup, no els trams buits que arrossega", () => {
    // Si tots els municipis són de menys de cent habitants, el grup abraça tots
    // els trams però el nom ha de dir «fins a 100», no «fins a 100.000»: el
    // lector ha de saber amb qui l'estem comparant de veritat.
    const groups = buildPeerGroups(Array.from({ length: 20 }, (_, i) => ({ id: i + 1, population: 50 })));
    expect(groups.get(1)!.label).toBe("fins a 100 habitants");
  });
});
