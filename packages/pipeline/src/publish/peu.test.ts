import { describe, expect, it } from "vitest";
import { PEU_CSS, XIFRES_PEU, fixaXifresPeu, peu } from "./peu";

/**
 * El peu surt a totes les pàgines de l'Observatori, i per això els errors que
 * s'hi cometen es cometen deu mil vegades. El que es comprova aquí és el que
 * es va trencar o es podria trencar: els camins relatius segons el nivell, que
 * cap xifra no surti sola, i que el dibuix de la mascota no arribi amb els ulls
 * tapats a les pàgines que no carreguen el CSS de la mascota.
 */

describe("peu", () => {
  it("resol els camins segons el nivell des d'on es crida", () => {
    // Des de la portada, «./»: l'Observatori és aquí i el web és un amunt.
    const portada = peu("./", "30 d'agost del 2026");
    expect(portada).toContain('href="./els947.html"');
    expect(portada).toContain('href="./dades/"');
    expect(portada).toContain('href="../avis-legal.html"');
    expect(portada).toContain('class="marca" href="../"');

    // Des d'una fitxa de regidor, quatre nivells avall.
    const regidor = peu("../../../../", "30 d'agost del 2026");
    expect(regidor).toContain('href="../../../../mapa/"');
    expect(regidor).toContain('href="../../../../../privadesa.html"');
  });

  it("diu quan s'ha generat, que és el que en diu si és fresca", () => {
    expect(peu("./", "30 d'agost del 2026")).toContain("Generat el 30 d'agost del 2026");
  });

  /**
   * L'obligació legal i alhora l'argument del projecte: qui publica les dades,
   * amb quina llicència, i que no hi ha cap model de llenguatge pel mig.
   */
  it("diu de qui són les dades i amb quina llicència", () => {
    // El text va partit en línies dins de la plantilla: aquí es mira la frase,
    // no on cau el salt de línia.
    const html = peu("./", "avui").replace(/\s+/g, " ");
    expect(html).toContain("Sense cap model de llenguatge pel mig");
    expect(html).toContain("CC0");
    expect(html).toContain("Reutilització lliure amb atribució");
    for (const font of ["Generalitat de Catalunya", "Consorci AOC", "Idescat", "Síndic de Greuges"]) {
      expect(html).toContain(font);
    }
  });

  it("ensenya les quatre xifres i cap no hi va sola", () => {
    const html = peu("./", "avui", [], {
      municipis: 947,
      electes: 4807,
      candidatures: 2626,
      fitxersDades: 1897,
    });
    // Milers amb punt, com a la resta del web.
    expect(html).toContain("<b>4.807</b><span>electes</span>");
    expect(html).toContain("<b>2.626</b><span>candidatures</span>");
    expect(html).toContain("<b>1.897</b><span>fitxers per baixar</span>");
    // Cap xifra sense el seu nom: tants «<b>» com «<span>» dins de la llista.
    const llista = html.slice(html.indexOf('<ul class="xifres">'), html.indexOf("</ul>"));
    expect(llista.match(/<b>/g)).toHaveLength(4);
    expect(llista.match(/<span>/g)).toHaveLength(4);
  });

  it("es queda amb les de l'última publicació quan no li'n passen cap", () => {
    const ambPunt = String(XIFRES_PEU.electes).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    expect(peu("./", "avui")).toContain(`<b>${ambPunt}</b><span>electes</span>`);
  });

  it("posa els enllaços propis de la pàgina al davant i marcats", () => {
    const html = peu("../", "avui", [{ text: "El mapa dels 947", on: "../mapa/" }]);
    expect(html).toContain('<a class="propi" href="../mapa/">El mapa dels 947</a>');
    // Al davant dels sis de sempre, no darrere.
    expect(html.indexOf("El mapa dels 947")).toBeLessThan(html.indexOf("El comparador"));
  });

  it("no deixa cap enllaç sense escapar", () => {
    const html = peu("./", "avui", [{ text: 'Un "títol" & prou', on: 'x.html?a=1&b="2"' }]);
    expect(html).toContain("Un &quot;títol&quot; &amp; prou");
    expect(html).toContain('href="x.html?a=1&amp;b=&quot;2&quot;"');
  });

  it("porta la crida a baixar-se les dades i no només un enllaç més", () => {
    expect(peu("./", "avui")).toContain('<a class="baixa" href="./dades/">');
  });

  /**
   * Va l'última del fitxer a posta: canvia l'estat del mòdul i el deixa canviat
   * per a qui vingui darrere.
   */
  it("es queda amb el que li diu la publicació d'avui", () => {
    fixaXifresPeu({ municipis: 947, electes: 4900, candidatures: 2700, fitxersDades: 2000 });
    expect(peu("./", "avui")).toContain("<b>4.900</b><span>electes</span>");
    // I qui li'n passi unes altres a la crida, mana per damunt.
    const seves = peu("./", "avui", [], { ...XIFRES_PEU, electes: 1 });
    expect(seves).toContain("<b>1</b><span>electes</span>");
    fixaXifresPeu(XIFRES_PEU);
  });
});

describe("PEU_CSS", () => {
  /**
   * El CSS de la mascota no hi és a totes les pàgines que porten peu, i és ell
   * qui tanca les parpelles. Sense aquesta regla, mitja web ensenyava una
   * Catalunya amb dos cercles blancs on hi van els ulls.
   */
  it("tanca les parpelles de la mascota encara que el seu CSS no hi sigui", () => {
    expect(PEU_CSS).toContain("footer.peu .catalunya .parpelles circle{");
    expect(PEU_CSS).toContain("transform:scaleY(0)");
  });

  it("escriu els selectors amb l'element al davant, que el nom «peu» ja és d'algú", () => {
    // Sense «footer», les sis pastilles de la graella de xifres reben aquest
    // fons i aquesta vora i la graella sembla trencada.
    for (const linia of PEU_CSS.split("\n")) {
      if (linia.startsWith(".peu")) throw new Error(`selector sense element: ${linia}`);
    }
    expect(PEU_CSS).toContain("footer.peu{");
  });

  it("respecta qui ha demanat que no li moguin la pantalla", () => {
    expect(PEU_CSS).toContain("@media (prefers-reduced-motion:reduce)");
  });

  it("no deixa cap objectiu de toc per sota dels 44px", () => {
    expect(PEU_CSS).toContain("min-height:44px");
  });
});
