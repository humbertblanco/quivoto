import { describe, expect, it } from "vitest";
import { targetaCuriositat } from "./curiositats";
import {
  curiositatsTerritori, densitatDe, densitatText, lletresDe, renderTerritori, superficieText, type FilaTerritori,
} from "./territori-fitxa";

/**
 * Vuit pobles inventats amb xifres versemblants. Es prova què diu cada fet
 * amb unes dades, no com és cap poble de debò.
 */
const files = (): FilaTerritori[] => [
  { s: "vilagran", n: "Vilagran", c: "Alt Camp", p: 120_000, sup: 48.2, alt: 120, gen: "vilagranencs", dens: 2_489.6 },
  { s: "riubaix", n: "Riubaix", c: "Alt Camp", p: 8_000, sup: 9.7, alt: 15, gen: "riubaixencs" },
  { s: "pontnou", n: "Pontnou", c: "Baix Camp", p: 3_000, sup: 120.5, alt: 640, gen: "pontnouencs" },
  { s: "santa-oliva-del-mont", n: "Santa Oliva del Mont", c: "Baix Camp", p: 900, sup: 32.5, alt: 980, gen: "santolivencs del mont" },
  // Alp: sense superfície ni gentilici; només l'altitud.
  { s: "alp", n: "Alp", c: "Cerdanya", p: 60, sup: null, alt: 1_158, gen: null },
  // Bot: sense res del territori.
  { s: "bot", n: "Bot", c: "Terra Alta", p: 90 },
  { s: "das", n: "Das", c: "Cerdanya", p: 200, sup: 15.1, alt: 1_219, gen: "dasencs" },
  { s: "marfull", n: "Marfull", c: "Pallars", p: 20_000, sup: 2.9, alt: 0, gen: "marfullencs" },
];

const fetDe = (id: string) => curiositatsTerritori(files()).find((c) => c.id === id);

describe("densitatDe", () => {
  it("es queda amb la que ve i, si no, la calcula amb el padró i la superfície", () => {
    expect(densitatDe(120_000, 48.2, 2_489.6)).toBe(2_489.6);
    expect(densitatDe(8_000, 9.7)).toBeCloseTo(824.7, 1);
  });

  it("no en calcula cap sense les dues xifres, ni amb zeros", () => {
    expect(densitatDe(null, 9.7)).toBeNull();
    expect(densitatDe(8_000, null)).toBeNull();
    expect(densitatDe(0, 9.7)).toBeNull();
    expect(densitatDe(8_000, 0)).toBeNull();
    expect(densitatDe(8_000, 9.7, null)).toBeCloseTo(824.7, 1);
  });
});

describe("els textos amb unitat", () => {
  it("escriuen els km² amb un decimal i la densitat amb decimal només per sota de 10", () => {
    expect(superficieText(9.68)).toBe("9,7 km²");
    expect(superficieText(101.35)).toBe("101,4 km²");
    expect(densitatText(6.77)).toBe("6,8 hab./km²");
    expect(densitatText(662.01)).toBe("662 hab./km²");
    expect(densitatText(15_950.4)).toBe("15.950 hab./km²");
  });

  it("compta les lletres del gentilici sense espais ni guions", () => {
    expect(lletresDe("sant-cugatencs")).toBe(13);
    expect(lletresDe("santolivencs del mont")).toBe(19);
  });
});

describe("renderTerritori", () => {
  it("escriu la línia sencera quan ho té tot", () => {
    const html = renderTerritori({ habitants: 496, superficie: 32.5, altitud: 980, gentilici: "vilallerencs" });
    // 496 / 32,5 = 15,26 → «15 hab./km²».
    expect(html.replace(/<[^>]+>/g, "")).toBe("496 habitants · 32,5 km² · 15 hab./km² · 980 m · vilallerencs");
    expect(html).toContain('title="altitud del nucli on hi ha l\'ajuntament, segons la Generalitat"');
    expect(html).toContain('<span class="gentilici" title="gentilici">vilallerencs</span>');
  });

  it("s'escurça amb el que falta, sense forats ni zeros", () => {
    expect(renderTerritori({ habitants: 60, superficie: null, altitud: 1_158, gentilici: null }).replace(/<[^>]+>/g, "")).toBe(
      "60 habitants · 1.158 m",
    );
    // Sense superfície no hi ha densitat; sense padró tampoc.
    expect(renderTerritori({ habitants: null, superficie: 9.7, altitud: null, gentilici: "riubaixencs" }).replace(/<[^>]+>/g, "")).toBe(
      "9,7 km² · riubaixencs",
    );
    expect(renderTerritori({ habitants: null, superficie: null, altitud: null, gentilici: null })).toBe("");
  });

  it("fa servir la densitat que ve abans que recalcular-la, i escapa el gentilici", () => {
    const html = renderTerritori({ habitants: 120_000, superficie: 48.2, altitud: 120, densitat: 2_489.6, gentilici: "a<b>" });
    expect(html).toContain("2.490 hab./km²");
    expect(html).toContain("a&lt;b&gt;");
  });
});

describe("curiositatsTerritori", () => {
  it("escriu els quatre fets, en aquest ordre, i cadascun diu sobre quants s'ha mirat", () => {
    const fets = curiositatsTerritori(files(), { consultat: "2026-09-03" });
    expect(fets.map((f) => f.id)).toEqual(["extensio", "altitud", "densitat", "gentilicis"]);
    for (const f of fets) {
      expect(f.font).toContain("Generalitat de Catalunya");
      expect(f.periode).toBe("registre vigent, consultat el 3 de setembre del 2026");
      expect(f.cobertura).toMatch(/^S'ha mirat .* dels 8\.$/);
      expect(f.llistes.length).toBeGreaterThan(0);
    }
  });

  it("ordena els termes més extensos i els més petits, i deixa fora qui no té superfície", () => {
    const fet = fetDe("extensio")!;
    expect(fet.cobertura).toBe("S'ha mirat la superfície de 6 municipis dels 8.");
    const [grans, petits] = fet.llistes;
    expect(grans!.files.map((f) => f.municipi.n)).toEqual(["Pontnou", "Vilagran", "Santa Oliva del Mont", "Das", "Riubaix"]);
    expect(grans!.files[0]!.valor).toBe("120,5 km²");
    expect(grans!.files[0]!.detall).toBe("3.000 habitants");
    expect(petits!.files[0]!.municipi.n).toBe("Marfull");
    expect(petits!.files[0]!.valor).toBe("2,9 km²");
  });

  it("ordena les altituds i hi posa la cautela del nucli de l'ajuntament", () => {
    const fet = fetDe("altitud")!;
    expect(fet.cobertura).toBe("S'ha mirat l'altitud de 7 municipis dels 8.");
    const [alts, baixos] = fet.llistes;
    expect(alts!.files.map((f) => f.municipi.n)).toEqual(["Das", "Alp", "Santa Oliva del Mont", "Pontnou", "Vilagran"]);
    expect(alts!.files[0]!.valor).toBe("1.219 m");
    // Zero metres és una altitud, no un buit: Marfull és a la vora del mar.
    expect(baixos!.files[0]!.municipi.n).toBe("Marfull");
    expect(baixos!.files[0]!.valor).toBe("0 m");
    expect(fet.cautela).toContain("casa de la vila");
  });

  it("calcula la densitat només on hi ha padró i superfície, i escriu els dos ingredients al detall", () => {
    const fet = fetDe("densitat")!;
    expect(fet.cobertura).toBe("S'ha mirat el padró i la superfície de 6 municipis dels 8.");
    const [densos, buits] = fet.llistes;
    // Marfull: 20.000 / 2,9 = 6.897; Vilagran porta la densitat feta, 2.490.
    expect(densos!.files.map((f) => f.municipi.n).slice(0, 2)).toEqual(["Marfull", "Vilagran"]);
    expect(densos!.files[0]!.valor).toBe("6.897 hab./km²");
    expect(densos!.files[0]!.detall).toBe("20.000 habitants · 2,9 km²");
    expect(densos!.files[1]!.valor).toBe("2.490 hab./km²");
    // Das: 200 / 15,1 = 13,2.
    expect(buits!.files[0]!.municipi.n).toBe("Das");
    expect(buits!.files[0]!.valor).toBe("13 hab./km²");
  });

  it("llista els gentilicis més llargs amb el gentilici com a xifra", () => {
    const fet = fetDe("gentilicis")!;
    expect(fet.cobertura).toBe("S'ha mirat el gentilici de 6 municipis dels 8.");
    const llista = fet.llistes[0]!;
    expect(llista.files[0]).toEqual({
      municipi: { s: "santa-oliva-del-mont", n: "Santa Oliva del Mont", c: "Baix Camp" },
      valor: "santolivencs del mont",
      detall: "19 lletres",
    });
    // Empats per nom: «pontnouencs», «riubaixencs» i «vilagranencs»…
    expect(llista.files.map((f) => f.valor)).toContain("dasencs");
    expect(fet.metode).toContain("masculina plural");
  });

  it("no escriu cap fet si cap municipi no té la dada", () => {
    const senseRes = curiositatsTerritori([{ s: "bot", n: "Bot", c: "Terra Alta", p: 90 }]);
    expect(senseRes).toEqual([]);
    expect(curiositatsTerritori([])).toEqual([]);
  });

  it("es pinta amb la targeta de curiositats sense tocar-la", () => {
    const html = targetaCuriositat(fetDe("extensio")!);
    expect(html).toContain('<article class="curiositat" id="cur-extensio">');
    expect(html).toContain("Els termes més extensos i els més petits");
    expect(html).toContain('<b class="dada">120,5 km²</b>');
  });
});
