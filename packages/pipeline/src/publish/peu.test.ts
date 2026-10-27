import { describe, expect, it } from "vitest";
import { PEU_CSS, XIFRES_PEU, fixaXifresPeu, grupsPeu, peu } from "./peu";

/**
 * El peu surt a totes les pàgines de l'Observatori, i per això els errors que
 * s'hi cometen es cometen deu mil vegades. El que es comprova aquí és el que
 * es va trencar o es podria trencar: els camins relatius segons el nivell, que
 * cap xifra no surti sola, que cada enllaç sigui al seu grup, que la lletra
 * petita no digui «esborrany» d'una publicació oberta, i que el dibuix de la
 * mascota no arribi amb els ulls tapats a les pàgines que no en carreguen el CSS.
 */

/** El tros d'HTML d'un grup del peu, de la capçalera fins que tanca la llista. */
const grupDe = (html: string, nom: string): string => {
  const inici = html.indexOf(`<h2>${nom}</h2>`);
  if (inici < 0) throw new Error(`no hi ha el grup «${nom}»`);
  return html.slice(inici, html.indexOf("</ul>", inici));
};

describe("peu", () => {
  it("resol els camins segons el nivell des d'on es crida", () => {
    // Des de la portada, «./»: l'Observatori és aquí i el web és un amunt.
    const portada = peu("./", "2026-08-30");
    expect(portada).toContain('href="./els947.html"');
    expect(portada).toContain('href="./dades/"');
    expect(portada).toContain('href="../avis-legal.html"');
    expect(portada).toContain('class="peu-marca" href="../"');

    // Des d'una fitxa de regidor, quatre nivells avall.
    const regidor = peu("../../../../", "2026-08-30");
    expect(regidor).toContain('href="../../../../mapa/"');
    expect(regidor).toContain('href="../../../../../privadesa.html"');
  });

  /**
   * La sala de premsa penja del web, com les legals, i la fa el generador de
   * la landing (tools/build_landing.py): és l'única porta que un periodista té
   * des d'una fitxa cap a qui som, les xifres i els materials.
   */
  it("porta a la sala de premsa al costat de les legals", () => {
    expect(peu("./", "avui")).toContain('<a href="../premsa.html">Premsa</a>');
    expect(peu("../../../../", "avui")).toContain('<a href="../../../../../premsa.html">Premsa</a>');
  });

  /**
   * El generador passa la data en ISO, que és com l'escriu una màquina. Al
   * peu la llegeix una persona: «el 3 de setembre del 2026», amb l'apòstrof
   * d'agost i l'«l'» de l'u de gener.
   */
  it("escriu la data en català i deixa l'ISO a l'atribut", () => {
    const html = peu("./", "2026-09-03");
    expect(html).toContain('Generat el <time datetime="2026-09-03">3 de setembre del 2026</time>.');
    // L'ISO només a l'atribut, mai al text que es llegeix.
    expect(html.replace(/datetime="[^"]*"/g, "")).not.toContain("2026-09-03");
    expect(peu("./", "2026-08-30")).toContain(">30 d'agost del 2026</time>");
    expect(peu("./", "2026-01-01")).toContain('Generat l\'<time datetime="2026-01-01">1 de gener del 2026</time>.');
    // El que no és una data ISO passa tal com ve: no se n'inventa cap.
    expect(peu("./", "30 d'agost del 2026")).toContain("Generat el 30 d'agost del 2026");
  });

  /**
   * L'Observatori és obert als cercadors des del setembre del 2026. Dir-hi
   * «esborrany intern, encara no indexat» era fals, i només s'ha de dir quan la
   * publicació es fa amb `QUIVOTO_NOINDEX=1`.
   */
  it("només diu que és un esborrany quan la publicació no surt als cercadors", () => {
    const oberta = peu("./", "2026-09-03", [], XIFRES_PEU, true);
    expect(oberta).not.toContain("Esborrany");
    expect(oberta).not.toContain("indexat");
    const tancada = peu("./", "2026-09-03", [], XIFRES_PEU, false);
    expect(tancada).toContain("<b>Esborrany intern:</b> aquesta publicació no surt als cercadors.");
  });

  it("acredita l'autor i Damos en el Blanco amb els seus enllaços", () => {
    const html = peu("./", "avui");
    expect(html).toContain('<a href="https://x.com/humbertblanco">Humbert Blanco</a>');
    expect(html).toContain('<a href="https://damosenelblanco.com/?utm_source=quivoto&amp;utm_medium=referral&amp;utm_campaign=credits">Damos en el Blanco</a>');
    expect(html).toContain('<a href="https://github.com/humbertblanco/quivoto">GitHub</a>');
  });

  /**
   * L'obligació legal i alhora l'argument del projecte: qui publica les dades,
   * amb quina llicència, on és el catàleg, i que no hi ha cap model de
   * llenguatge pel mig.
   */
  it("diu de qui són les dades, amb quina llicència i on és el catàleg", () => {
    // El text va partit en línies dins de la plantilla: aquí es mira la frase,
    // no on cau el salt de línia.
    const html = peu("./", "avui").replace(/\s+/g, " ");
    expect(html).toContain("Sense cap model de llenguatge pel mig");
    expect(html).toContain("CC0");
    expect(html).toContain("Les pots reutilitzar citant-ne la font");
    expect(html).toContain('<a href="./dades/#fonts">catàleg de fonts</a>');
    for (const font of ["Generalitat de Catalunya", "Consorci AOC", "Idescat", "Ministeri d'Hisenda", "Síndic de Greuges"]) {
      expect(html).toContain(font);
    }
  });

  it("ensenya les tres xifres i cap no hi va sola", () => {
    const html = peu("./", "avui", [], {
      municipis: 947,
      electes: 4807,
      candidatures: 2626,
      fitxersDades: 1897,
    });
    // Milers amb punt, com a la resta del web.
    expect(html).toContain("<b>4.807</b><span>electes</span>");
    expect(html).toContain("<b>2.626</b><span>candidatures</span>");
    expect(html).not.toContain("fitxers per baixar");
    // Cap xifra sense el seu nom: tants «<b>» com «<span>» dins de la llista.
    const inici = html.indexOf('<ul class="peu-xifres">');
    const llista = html.slice(inici, html.indexOf("</ul>", inici));
    expect(llista.match(/<b>/g)).toHaveLength(3);
    expect(llista.match(/<span>/g)).toHaveLength(3);
  });

  it("es queda amb les de l'última publicació quan no li'n passen cap", () => {
    const ambPunt = String(XIFRES_PEU.electes).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    expect(peu("./", "avui")).toContain(`<b>${ambPunt}</b><span>electes</span>`);
  });
});

describe("els enllaços del peu", () => {
  /**
   * Els deu llocs de sempre, agrupats per la pregunta que resolen. L'ordre de
   * dins de cada grup també és el que es comprova: és el que llegeix qui hi
   * arriba amb un lector de pantalla.
   */
  it("posa cada enllaç al seu grup i en l'ordre de sempre", () => {
    const html = peu("../../", "avui");
    const esperats: Record<string, Array<[string, string]>> = {
      Explora: [
        ["Els 947", "../../els947.html"],
        ["El mapa", "../../mapa/"],
        ["Rànquings", "../../ranquings/"],
        ["El comparador", "../../comparador/"],
      ],
      Territori: [
        ["Les comarques", "../../c/"],
        ["L'Àrea Metropolitana", "../../amb/"],
        ["Diputacions i consells", "../../ens/"],
      ],
      "Com està fet": [
        ["Les preguntes", "../../preguntes/"],
        ["Les dades", "../../dades/"],
        ["Totes les fonts", "../../dades/#fonts"],
      ],
    };
    for (const [nom, enllacos] of Object.entries(esperats)) {
      const grup = grupDe(html, nom);
      const trobats = [...grup.matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)].map((m) => [m[2], m[1]]);
      expect(trobats, nom).toEqual(enllacos.map(([text, on]) => [text, on]));
    }
    // Els grups, en aquest ordre: primer mirar, després el territori, al final com està fet.
    expect(html.indexOf("<h2>Explora</h2>")).toBeLessThan(html.indexOf("<h2>Territori</h2>"));
    expect(html.indexOf("<h2>Territori</h2>")).toBeLessThan(html.indexOf("<h2>Com està fet</h2>"));
  });

  it("dóna a la còpia en Python els mateixos deu enllaços", () => {
    const tots = grupsPeu("./").flatMap((g) => g.enllacos);
    expect(tots).toHaveLength(10);
    expect(new Set(tots.map((e) => e.on)).size).toBe(10);
  });

  it("va dins d'una navegació amb nom", () => {
    expect(peu("./", "avui")).toContain('<nav class="peu-anar" aria-label="Més de l\'Observatori">');
  });

  it("posa els enllaços propis de la pàgina en un grup a part, el primer", () => {
    const html = peu("../", "avui", [{ text: "El mapa dels 947", on: "../mapa/" }]);
    expect(grupDe(html, "Seguint el fil")).toContain('<a class="propi" href="../mapa/">El mapa dels 947</a>');
    expect(html.indexOf("<h2>Seguint el fil</h2>")).toBeLessThan(html.indexOf("<h2>Explora</h2>"));
    // Sense enllaços propis, el grup no hi és.
    expect(peu("../", "avui")).not.toContain("Seguint el fil");
  });

  it("no deixa cap enllaç sense escapar", () => {
    const html = peu("./", "avui", [{ text: 'Un "títol" & prou', on: 'x.html?a=1&b="2"' }]);
    expect(html).toContain("Un &quot;títol&quot; &amp; prou");
    expect(html).toContain('href="x.html?a=1&amp;b=&quot;2&quot;"');
  });

  /**
   * Les comarques anaven al Barcelonès, com si fos l'única de les 43: era
   * l'única manera d'enllaçar-les quan no hi havia índex. Ara n'hi ha.
   */
  it("envia a l'índex de les comarques i no a una comarca concreta", () => {
    const html = peu("../../", "avui");
    expect(html).toContain('href="../../c/">Les comarques</a>');
    expect(html).not.toContain("barcelones");
  });

  /**
   * Va l'última del bloc a posta: canvia l'estat del mòdul i el deixa canviat
   * per a qui vingui darrere, si no el torna al seu lloc.
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

describe("la mascota del peu", () => {
  it("és decorativa: no la llegeix cap lector de pantalla", () => {
    const html = peu("./", "avui");
    const inici = html.indexOf('<div class="peu-mascota">');
    expect(inici).toBeGreaterThan(0);
    expect(html.slice(inici, html.indexOf("</svg>", inici))).toContain('aria-hidden="true"');
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

  /**
   * Sense «footer» al davant, les sis pastilles de la graella de xifres reben
   * el fons i la vora del peu; i sense «peu-» a les classes de dins, el peu
   * rep els estils de les «.marca» i les «.xifres» de cada pàgina.
   */
  it("escriu cada selector dins de «footer.peu» i amb classes pròpies", () => {
    const sensComentaris = PEU_CSS.replace(/\/\*[\s\S]*?\*\//g, "");
    const selectors = [...sensComentaris.matchAll(/([^{}]+)\{[^{}]*\}/g)]
      .map((m) => m[1]!.trim())
      .filter((s) => !s.startsWith("@"));
    expect(selectors.length).toBeGreaterThan(10);
    for (const llista of selectors) {
      for (const s of llista.split(",")) {
        expect(s.trim(), s).toMatch(/^footer\.peu\b/);
      }
    }
    for (const nua of [".marca", ".xifres", ".cara{", ".crida", ".anar", ".lletra"]) {
      expect(sensComentaris, nua).not.toContain(` ${nua}`);
    }
  });

  it("respecta qui ha demanat que no li moguin la pantalla", () => {
    expect(PEU_CSS).toContain("@media (prefers-reduced-motion:reduce)");
  });

  it("no deixa cap objectiu de toc per sota dels 44px on es toca amb el dit", () => {
    expect(PEU_CSS).toContain("min-height:44px");
    // El 32 només es permet amb ratolí.
    expect(PEU_CSS).toMatch(/@media \(pointer:fine\)\{[^}]*min-height:32px/);
  });

  it("marca on és el focus del teclat", () => {
    expect(PEU_CSS).toContain("footer.peu a:focus-visible{outline:3px solid var(--coral-text)");
  });

  it("no fa servir rètols en majúscules espaiades", () => {
    expect(PEU_CSS).not.toContain("text-transform:uppercase");
  });
});
