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

  /**
   * Sis destins, en aquest ordre, i cap més: el menú és curt a propòsit i el
   * que s'hi afegeix s'hi afegeix aquí, amb el seu perquè al capçal.
   */
  it("té set destins, amb les comarques entre el mapa i els partits i les trajectòries abans del comparador", () => {
    const html = capcalera("./", "cap");
    const textos = [...html.matchAll(/<a href="[^"]*">([^<]+)<\/a>/g)]
      .map((m) => m[1])
      .filter((t) => t !== "quivoto");
    expect(textos).toEqual(["Observatori", "Els 947", "Mapa", "Comarques", "Partits", "Trajectòries", "Comparador"]);
  });

  it("porta les comarques al seu índex i no a una comarca qualsevol", () => {
    expect(capcalera("../../", "cap")).toContain('href="../../c/">Comarques</a>');
    expect(capcalera("../../", "comarques")).toContain('<span class="ara" aria-current="page">Comarques</span>');
  });

  it("la taula dels 947 es diu igual que al peu i a la portada", () => {
    const html = capcalera("./", "portada");
    expect(html).toContain('href="./els947.html">Els 947</a>');
    expect(html).not.toContain("La llista");
  });
});

describe("capcalera: trajectòries", () => {
  /**
   * «D'on surten els que manen» no s'hi arribava des d'enlloc: només des d'una
   * fitxa de regidor. L'usuari ho va demanar dues vegades; ara és al menú.
   */
  it("porta les trajectòries al menú, després dels partits", () => {
    const html = capcalera("../", "trajectoria");
    expect(html).toContain('<span class="ara" aria-current="page">Trajectòries</span>');
    expect(html.indexOf("Partits")).toBeLessThan(html.indexOf("Trajectòries"));
    expect(capcalera("./")).toContain('href="./trajectoria/">Trajectòries</a>');
  });
});
