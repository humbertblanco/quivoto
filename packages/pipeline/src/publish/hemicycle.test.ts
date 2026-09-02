import { describe, expect, it } from "vitest";
import { etiquetaSeient, hemicycle, seientsHemicicle } from "./hemicycle";

describe("hemicycle", () => {
  it("dibuixa exactament els escons que té el ple", () => {
    for (const total of [3, 5, 7, 9, 11, 13, 17, 21, 25, 27, 41, 57]) {
      expect(hemicycle(total).seats, `ple de ${total}`).toHaveLength(total);
    }
  });

  it("no en dibuixa cap si el ple és buit", () => {
    expect(hemicycle(0).seats).toHaveLength(0);
  });

  it("manté tots els escons dins del llenç que declara", () => {
    for (const total of [5, 13, 21, 27, 41]) {
      const { seats, width, height } = hemicycle(total, { width: 640 });
      for (const seat of seats) {
        expect(seat.x - seat.r, `ple de ${total}`).toBeGreaterThanOrEqual(-0.5);
        expect(seat.x + seat.r, `ple de ${total}`).toBeLessThanOrEqual(width + 0.5);
        expect(seat.y - seat.r, `ple de ${total}`).toBeGreaterThanOrEqual(-0.5);
        expect(seat.y + seat.r, `ple de ${total}`).toBeLessThanOrEqual(height + 0.5);
      }
    }
  });

  it("ordena els escons d'esquerra a dreta perquè cada grup ocupi un sector seguit", () => {
    const { seats } = hemicycle(21);
    expect(seats[0]!.x).toBeLessThan(seats[seats.length - 1]!.x);
  });

  it("no encavalca els escons", () => {
    for (const total of [5, 13, 21, 27, 41]) {
      const { seats } = hemicycle(total, { width: 660 });
      for (let i = 0; i < seats.length; i += 1) {
        for (let j = i + 1; j < seats.length; j += 1) {
          const a = seats[i]!, b = seats[j]!;
          const distance = Math.hypot(a.x - b.x, a.y - b.y);
          expect(distance, `ple de ${total}, escons ${i} i ${j}`).toBeGreaterThanOrEqual(2 * a.r - 0.1);
        }
      }
    }
  });

  it("omple l'arc: els escons són prou grossos perquè sembli una sala", () => {
    // Amb 21 escons, un cercle ridícul vol dir que l'empaquetat ha fallat.
    const { seatRadius, width } = hemicycle(21, { width: 660 });
    expect(seatRadius).toBeGreaterThan(width * 0.02);
  });
});

describe("empaquetat", () => {
  it("omple l'arc: cap escó queda lluny del seu veí", () => {
    // Si els escons queden escampats, el dibuix deixa de semblar una sala i
    // passa a semblar un núvol de punts. Als plens petits el ventall és més
    // obert per força: hi ha pocs escons i molt d'arc.
    for (const total of [13, 21, 27, 41, 57]) {
      const { seats } = hemicycle(total, { width: 660 });
      for (const seat of seats) {
        const nearest = Math.min(
          ...seats.filter((other) => other !== seat).map((other) => Math.hypot(seat.x - other.x, seat.y - other.y)),
        );
        // Menys d'un diàmetre i mig de distància entre centres: es toquen quasi.
        expect(nearest, `ple de ${total}`).toBeLessThan(seat.r * 3.2);
      }
    }
  });

  it("fa servir més fileres com més gran és el ple", () => {
    expect(hemicycle(41).rows).toBeGreaterThanOrEqual(hemicycle(13).rows);
    expect(hemicycle(13).rows).toBeGreaterThanOrEqual(hemicycle(5).rows);
  });

  it("dona escons més grossos als plens petits", () => {
    expect(hemicycle(5).seatRadius).toBeGreaterThan(hemicycle(41).seatRadius);
  });
});

describe("seientsHemicicle", () => {
  const { seats } = hemicycle(21);
  const grups = [
    { nom: "ERC", regidories: 8, color: "#ffb232", govern: true },
    { nom: "PSC", regidories: 7, color: "#e4001c" },
    { nom: "Junts", regidories: 6, color: "#00c3b2" },
  ];

  it("escriu un cercle per escó, en l'ordre dels grups, amb el color de cadascun", () => {
    const svg = seientsHemicicle(seats, grups, 21);
    expect(svg.match(/<circle /g)).toHaveLength(21);
    expect(svg.match(/fill="#ffb232"/g)).toHaveLength(8);
    expect(svg.match(/fill="#e4001c"/g)).toHaveLength(7);
    expect(svg.indexOf("#ffb232")).toBeLessThan(svg.indexOf("#00c3b2"));
  });

  it("cada escó porta l'etiqueta del grup: el nom, el recompte i «al govern» si hi és", () => {
    const svg = seientsHemicicle(seats, grups, 21);
    expect(svg.match(/data-nom="ERC" data-valor="8 de 21 regidories · al govern"/g)).toHaveLength(8);
    expect(svg).toContain('data-nom="PSC" data-valor="7 de 21 regidories"');
    expect(svg).not.toContain('data-nom="PSC" data-valor="7 de 21 regidories · al govern"');
    expect(svg).toContain("<title>ERC: 8 de 21 regidories · al govern</title>");
  });

  it("quan sap qui hi seu, el nom és la persona, el grup passa a la dada i el recompte a les línies de més", () => {
    const svg = seientsHemicicle(seats, [{ ...grups[1]!, persones: ["Marta Farrés"] }, grups[0]!, grups[2]!], 21);
    expect(svg).toContain('data-nom="Marta Farrés" data-valor="PSC" data-extres="regidories¦7 de 21"');
    expect(svg).toContain("<title>Marta Farrés: PSC · regidories: 7 de 21</title>");
    // Els sis escons del PSC sense nom continuen dient el grup, sense repetir el recompte.
    expect(svg.match(/data-nom="PSC" data-valor="7 de 21 regidories"/g)).toHaveLength(6);
    expect(svg).not.toContain('data-valor="7 de 21 regidories" data-extres="regidories');
  });

  it("amb vots, cada escó els diu amb el tant per cent, i «al govern» es queda a la dada", () => {
    const ambVots = [
      { ...grups[0]!, vots: 35_799, pctVots: 46.8, persones: ["Marta Farrés"] },
      { ...grups[1]!, vots: 12_004, pctVots: 15.7 },
    ];
    const svg = seientsHemicicle(seats, ambVots, 21);
    // L'escó amb persona: la persona, el grup i el govern a la dada; vots i recompte a sota.
    expect(svg).toContain(
      'data-nom="Marta Farrés" data-valor="ERC · al govern" data-extres="vots¦35.799 · 46,8 %‖regidories¦8 de 21"',
    );
    expect(svg).toContain("<title>Marta Farrés: ERC · al govern · vots: 35.799 · 46,8 % · regidories: 8 de 21</title>");
    // Els escons sense persona: el grup, el recompte i els vots.
    expect(svg.match(/data-nom="PSC" data-valor="7 de 21 regidories" data-extres="vots¦12.004 · 15,7 %"/g)).toHaveLength(7);
    expect(svg).toContain("<title>PSC: 7 de 21 regidories · vots: 12.004 · 15,7 %</title>");
  });

  it("sense vots no s'inventa cap línia de vots, i amb vots sense percentatge els diu sols", () => {
    expect(etiquetaSeient({ nom: "AM", regidories: 3, color: "#000", vots: null }, 5).extres).toBeNull();
    expect(etiquetaSeient({ nom: "AM", regidories: 3, color: "#000", vots: 0 }, 5).extres).toBeNull();
    expect(etiquetaSeient({ nom: "AM", regidories: 3, color: "#000", vots: 812 }, 5).extres).toEqual([{ etq: "vots", valor: "812" }]);
  });

  it("el text sense script no s'allarga més del compte: quatre línies de més com a molt", () => {
    const dada = etiquetaSeient({ nom: "PSC-CP", regidories: 14, color: "#000", vots: 35_799, pctVots: 46.8, govern: true }, 27, "Marta Farrés Falgueras");
    expect(dada.extres!.length).toBeLessThanOrEqual(4);
    const text = `${dada.nom}: ${dada.valor}${dada.extres!.map((e) => ` · ${e.etq}: ${e.valor}`).join("")}`;
    expect(text.length).toBeLessThan(160);
  });

  it("no rep el focus: la llista de sota ja és l'equivalent accessible", () => {
    expect(seientsHemicicle(seats, grups, 21)).not.toContain("tabindex");
  });

  it("escapa el que ve de fora: sigles amb cometes o angles", () => {
    const svg = seientsHemicicle(hemicycle(3).seats, [{ nom: 'A "B" <C>', regidories: 3, color: "#000" }], 3);
    expect(svg).toContain('data-nom="A &quot;B&quot; &lt;C&gt;"');
    expect(svg).not.toContain("<C>");
  });

  it("no dibuixa més escons dels que hi ha ni dels que sumen els grups", () => {
    expect(seientsHemicicle(hemicycle(5).seats, grups, 21).match(/<circle /g)).toHaveLength(5);
    expect(seientsHemicicle(seats, grups.slice(0, 1), 21).match(/<circle /g)).toHaveLength(8);
  });

  it("amb un sol regidor diu «regidoria»", () => {
    expect(etiquetaSeient({ nom: "AM", regidories: 1, color: "#000" }, 1).valor).toBe("1 de 1 regidoria");
  });
});
