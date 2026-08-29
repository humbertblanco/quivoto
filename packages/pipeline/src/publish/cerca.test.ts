import { describe, expect, it } from "vitest";
import { clauCerca, indexDeCerca } from "./cerca";
import type { Els947Row } from "./els947";

/**
 * El cercador ha de trobar el poble escrivint-lo com l'escriu la gent: sense
 * accents, sense l'article i sense saber com el desa la Generalitat.
 */
const fila = (s: string, n: string, c = "Barcelonès", p = 1000): Els947Row =>
  ({ s, n, c, p }) as unknown as Els947Row;

describe("clauCerca", () => {
  it("treu els accents, que és com s'escriu de pressa", () => {
    expect(clauCerca("Rubí")).toBe("rubi");
    expect(clauCerca("Sant Adrià de Besòs")).toBe("sant adria de besos");
  });

  it("treu l'article inicial, que la gent no escriu", () => {
    expect(clauCerca("l'Hospitalet de Llobregat")).toBe("hospitalet de llobregat");
    expect(clauCerca("la Seu d'Urgell")).toBe("seu d urgell");
    expect(clauCerca("els Prats de Rei")).toBe("prats de rei");
  });

  it("no es menja un article que forma part del nom", () => {
    // «Les Borges» sí que en porta; «Lleida» no comença per article.
    expect(clauCerca("Lleida")).toBe("lleida");
    expect(clauCerca("Manresa")).toBe("manresa");
  });
});

describe("indexDeCerca", () => {
  const index = indexDeCerca([
    fila("rubi", "Rubí", "Vallès Occidental", 79_609),
    fila("barcelona", "Barcelona", "Barcelonès", 1_731_649),
    fila("hospitalet-de-llobregat", "l'Hospitalet de Llobregat", "Barcelonès", 281_231),
  ]);

  it("porta el que cal per triar i res més", () => {
    expect(Object.keys(index[0]!).sort()).toEqual(["c", "h", "k", "n", "s"]);
  });

  it("ve ordenat per la clau, no pel nom amb article", () => {
    expect(index.map((f) => f.s)).toEqual(["barcelona", "hospitalet-de-llobregat", "rubi"]);
  });

  it("desa el nom sencer per ensenyar-lo i la clau per buscar-hi", () => {
    const hospi = index.find((f) => f.s === "hospitalet-de-llobregat")!;
    expect(hospi.n).toBe("l'Hospitalet de Llobregat");
    expect(hospi.k).toBe("hospitalet de llobregat");
  });
});
