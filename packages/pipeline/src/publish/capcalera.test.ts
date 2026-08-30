import { describe, expect, it } from "vitest";
import { capcalera, tipografia } from "./capcalera";

describe("tipografia", () => {
  it("arriba a /assets/ des de qualsevol profunditat", () => {
    expect(tipografia("./")).toContain('href="../assets/fonts.css"');
    expect(tipografia("../../")).toContain('href="../../../assets/fonts.css"');
    expect(tipografia("../../../../")).toContain('href="../../../../../assets/fonts.css"');
  });

  it("pre-carrega el fitxer llatí de Gabarito amb crossorigin", () => {
    const html = tipografia("../");
    expect(html).toMatch(/<link rel="preload" as="font" type="font\/woff2" crossorigin href="\.\.\/\.\.\/assets\/fonts\/QGYtz_0dZAGKJJ4t3HtoW4XGnfBI\.woff2">/);
  });
});

describe("capcalera", () => {
  it("marca el destí actual i enllaça la resta", () => {
    const html = capcalera("../", "mapa");
    expect(html).toContain('<span class="ara" aria-current="page">Mapa</span>');
    expect(html).toContain('href="../comparador/"');
  });
});
