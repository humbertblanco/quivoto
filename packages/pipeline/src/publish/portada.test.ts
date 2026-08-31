import { describe, expect, it } from "vitest";
import { anellsDe, camiCompacte, mapaQuiMana, renderPortada, type ComptesPortada } from "./portada";
import type { PortadaMostra } from "./portada-mostra";

/**
 * La portada és la pàgina que més s'ha trencat sense que ningú ho notés: es
 * generava dues vegades i guanyava la que no es mantenia. El que es comprova
 * aquí és que ensenyi dades i no descripcions, que cada bloc porti on diu, i
 * que sense la base de dades quedi una portada d'enllaços i no un forat.
 */

function comptes(canvis: Partial<ComptesPortada> = {}): ComptesPortada {
  return {
    municipis: 947,
    comarques: 43,
    candidatures: 2626,
    fitxersDades: 1897,
    conjuntsPreguntes: 23,
    amb: 36,
    partits: 15,
    trajectoria: 284,
    exemple: { slug: "esplugues-de-llobregat", nom: "Esplugues de Llobregat" },
    provaDestacada: { slug: "esplugues-de-llobregat", nom: "Esplugues de Llobregat" },
    ...canvis,
  };
}

const MARQUES = [
  ["erc", "ERC", "#ffb232", 330, 2909],
  ["junts", "Junts", "#00c3b2", 329, 2701],
  ["psc", "PSC", "#d00c3c", 125, 1512],
  ["cup", "CUP", "#d8d000", 22, 190],
  ["comuns", "Comuns", "#662483", 6, 95],
  ["pp", "PP", "#234b90", 3, 74],
  ["pdecat", "PDeCAT", "#7f9ac9", 9, 88],
  ["fic", "FIC", "#5a9e5a", 4, 30],
  ["te", "Tots per l'Empordà", "#3f8f8f", 3, 20],
  ["idselva", "Independents de la Selva", "#8a7f4a", 2, 14],
  ["aliancacat", "Aliança Catalana", "#1d3f6e", 1, 9],
  ["cda", "CDA", "#a05a2c", 1, 6],
  ["vox", "Vox", "#00c118", 0, 12],
  ["cs", "Ciutadans", "#ff5824", 0, 3],
  ["podem", "Podem", "#6b2b73", 0, 2],
] as const;

const CIUTATS = [
  ["barcelona", "Barcelona", 1_702_000, "Jaume Collboni Cuadrado", "PSC-CP", "psc", "regidor/jaume-collboni-cuadrado/"],
  ["l-hospitalet-de-llobregat", "L'Hospitalet de Llobregat", 283_000, "David Quirós", "PSC-CP", "psc", null],
  ["terrassa", "Terrassa", 226_000, "Jordi Ballart", "TxT", null, "regidor/jordi-ballart/"],
  ["badalona", "Badalona", 226_000, "Xavier García Albiol", "PP", "pp", "regidor/xavier-garcia-albiol/"],
  ["sabadell", "Sabadell", 219_000, "Marta Farrés", "PSC-CP", "psc", "regidor/marta-farres/"],
  ["lleida", "Lleida", 143_000, "Fèlix Larrosa", "PSC-CP", "psc", "regidor/felix-larrosa/"],
  ["tarragona", "Tarragona", 141_000, "Rubén Viñuales", "PSC-CP", "psc", "regidor/ruben-vinuales/"],
  ["mataro", "Mataró", 131_000, "David Bote", "PSC-CP", "psc", "regidor/david-bote/"],
] as const;

const COMARQUES = [
  ["barcelones", "Barcelonès", 5, 2_390_000, "psc", "PSC", 4],
  ["valles-occidental", "Vallès Occidental", 23, 950_000, "psc", "PSC", 9],
  ["baix-llobregat", "Baix Llobregat", 30, 840_000, "psc", "PSC", 15],
  ["maresme", "Maresme", 30, 470_000, "junts", "Junts", 11],
  ["valles-oriental", "Vallès Oriental", 39, 430_000, "erc", "ERC", 14],
  ["tarragones", "Tarragonès", 22, 270_000, "erc", "ERC", 8],
] as const;

function mostra(canvis: Partial<PortadaMostra> = {}): PortadaMostra {
  return {
    partits: MARQUES.map(([id, sigles, color, alcaldies, regidories]) => ({ id, sigles, nom: `Nom ${sigles}`, color, alcaldies, regidories })),
    municipis: CIUTATS.map(([slug, nom, habitants, alcalde, sigles, brandId, adreca]) => ({
      slug,
      nom,
      habitants,
      alcaldia: { nom: alcalde, sigles, brandId, adreca },
    })),
    quiMana: [
      ...CIUTATS.map(([slug, , , , , brandId]) => ({ slug, brandId: brandId ?? "local" })),
      { slug: "girona", brandId: "local" },
      { slug: "olot", brandId: "junts" },
      { slug: "salt", brandId: "erc" },
      { slug: "poble-que-no-existeix", brandId: null },
    ],
    comarques: COMARQUES.map(([slug, nom, municipis, habitants, brandId, sigles, alcaldies]) => ({
      slug,
      nom,
      municipis,
      habitants,
      forcaMes: { brandId, sigles, alcaldies },
    })),
    preguntes: Array.from({ length: 23 }, (_, i) => ({
      slug: i === 0 ? "esplugues-de-llobregat" : `poble-${i}`,
      nom: i === 0 ? "Esplugues de Llobregat" : `Poble ${i}`,
      jugable: i < 3,
    })),
    comparacions: [
      { titol: "Dos veïns del Baix Llobregat", slugs: ["esplugues-de-llobregat", "sant-just-desvern"], noms: ["Esplugues de Llobregat", "Sant Just Desvern"] },
      { titol: "Tres capitals de província", slugs: ["girona", "lleida", "tarragona"], noms: ["Girona", "Lleida", "Tarragona"] },
      { titol: "Dues ciutats gironines de mida semblant", slugs: ["olot", "salt"], noms: ["Olot", "Salt"] },
    ],
    amb: { municipis: 36, habitants: 3_390_000 },
    comptes: { municipis: 947, comarques: 43, alcaldiesAmbMarca: 835, alcaldiesLocals: 97, senseIdentificar: 15 },
    ...canvis,
  };
}

/** El cos de la pàgina, sense la capçalera, el cercador ni el peu. */
const cos = (html: string): string => html.slice(html.indexOf('<main id="contingut">'), html.indexOf('<footer class="peu">'));

describe("renderPortada amb la mostra", () => {
  const html = renderPortada(comptes(), "30 d'agost del 2026", mostra());
  const main = cos(html);

  it("es diu Observatori municipal i el recompte va a l'entrada, no al titular", () => {
    expect(html).toContain("<h1>Observatori municipal</h1>");
    expect(html).toContain("<b>947 municipis</b>");
  });

  it("ja no té targetes que descriguin pàgines", () => {
    expect(html).not.toContain('class="reixa"');
    expect(html).not.toContain("La fitxa d'un poble");
    expect(html).not.toContain("el ple amb nom i cognoms");
    // Les etiquetes de les targetes («una per municipi», «demostració») ja no hi són;
    // el peu porta la seva pròpia «.marca», que és el nom de la casa.
    expect(main).not.toContain('class="marca');
  });

  it("posa els blocs en l'ordre decidit, i cada títol és l'enllaç a la seva pàgina", () => {
    const titols = [...main.matchAll(/<h2><a href="([^"]+)">([^<]+)<\/a><\/h2>/g)].map((m) => [m[1], m[2]]);
    expect(titols).toEqual([
      ["els947.html", "Els municipis més grans"],
      ["mapa/", "Qui mana"],
      ["partit/", "Els partits"],
      ["c/", "Les comarques"],
      ["preguntes/", "Respon les preguntes"],
      ["comparador/", "Compara"],
    ]);
  });

  /**
   * El botó no va dins de cap enllaç —no seria HTML vàlid i el clic canviaria
   * de pàgina— i neix amagat: el guió del cercador és qui l'ensenya i el
   * connecta. Sense JavaScript, al costat hi ha la llista dels 947.
   */
  it("porta el botó que obre el cercador, amagat fins que hi ha guió, i l'enllaç als 947 al costat", () => {
    expect(html).toContain('<button type="button" class="obre-cerca" data-obre-cerca hidden>');
    expect(html).toContain("Escriu el nom del teu poble");
    const crida = main.slice(main.indexOf('<p class="cerca-poble">'), main.indexOf("</p>", main.indexOf('<p class="cerca-poble">')));
    // El botó va sol, i l'enllaç ve després: cap dels dos no conté l'altre.
    expect(crida.indexOf("<a href")).toBeGreaterThan(crida.indexOf("</button>"));
    expect(crida).toContain('<a href="els947.html">');
    expect(html).toContain('querySelectorAll("[data-obre-cerca]")');
  });

  it("ensenya les vuit ciutats sense cap cara: el poble, la persona i les sigles, enllaçats", () => {
    const llista = main.slice(main.indexOf('<ol class="grans">'), main.indexOf("</ol>"));
    expect(llista.match(/<li>/g)).toHaveLength(8);
    // Cap retrat ni inicials: les cares no són del poble, són de persones.
    expect(llista).not.toContain("<img");
    expect(llista).not.toContain('class="retrat');
    // Barcelona: el poble a la seva fitxa, l'alcalde a la seva pàgina, les sigles a la del partit.
    expect(llista).toContain('<a class="poble" href="m/barcelona/">Barcelona</a>');
    expect(llista).toContain('<a href="m/barcelona/regidor/jaume-collboni-cuadrado/">Jaume Collboni Cuadrado</a>');
    expect(llista).toContain('href="./partit/psc/"');
    expect(llista).toContain("1.702.000 habitants");
    // L'Hospitalet: sense fitxa el nom porta a l'apartat d'alcaldies del municipi.
    expect(llista).toContain('<a href="m/l-hospitalet-de-llobregat/#alcaldies">David Quirós</a>');
    // Terrassa: llista local, la pastilla grisa i sense enllaç enlloc.
    expect(llista).toContain('<b class="sigla" style="--c:#8b8b8b;--t:');
    expect(main).toContain('<a href="els947.html">i 939 més →</a>');
  });

  it("dibuixa el mapa dels 947 pintat per força, enllaçat al mapa gran i amb la clau al costat", () => {
    expect(main).toContain('<a class="minimapa-enllac" href="mapa/"');
    const svg = main.slice(main.indexOf('<svg class="minimapa"'), main.indexOf("</svg>", main.indexOf('<svg class="minimapa"')) + 6);
    expect(svg).toContain('viewBox="0 0 800 800"');
    // Un camí per força, no un per municipi.
    expect(svg).toContain('<path fill="#d00c3c" d="M');
    expect(svg).toContain('<path fill="#ffb232" d="M');
    expect(svg).toContain('<path class="local" d="M');
    expect(svg).toContain('<path class="cap" d="M');
    expect(svg).toContain('<path class="contorn" d="M');
    expect(svg).toContain('<pattern id="pm-ratlles"');
    expect(svg.match(/<path /g)!.length).toBeLessThan(12);
    // La clau: les forces amb alcaldia, el gris i el ratllat.
    const clau = main.slice(main.indexOf('<ul class="clau-mini">'), main.indexOf("</ul>", main.indexOf('<ul class="clau-mini">')));
    expect(clau).toContain('href="./partit/erc/"');
    expect(clau).not.toContain('href="./partit/vox/"');
    expect(clau).toContain("<b>97</b> alcaldies de llistes locals o sense marca");
    expect(clau).toContain("<b>15</b> sense identificar");
  });

  it("el mapa petit pesa menys de 60 kB", () => {
    const svg = mapaQuiMana(mostra());
    expect(Buffer.byteLength(svg, "utf8")).toBeLessThan(60_000);
    expect(Buffer.byteLength(svg, "utf8")).toBeGreaterThan(30_000);
  });

  it("posa les quinze marques amb les seves alcaldies i regidories, cadascuna a la seva pàgina", () => {
    const marques = main.slice(main.indexOf('<ul class="marques">'), main.indexOf("</ul>", main.indexOf('<ul class="marques">')));
    expect(marques.match(/<li>/g)).toHaveLength(15);
    expect(marques.match(/class="sigla"/g)).toHaveLength(15);
    expect(marques).toContain('<a href="partit/erc/" title="Nom ERC a tot Catalunya">');
    expect(marques).toContain("<b>330</b> alcaldies · <b>2.909</b> regidories");
    expect(marques).toContain("<b>1</b> alcaldia · <b>9</b> regidories");
    expect(marques).toContain("<b>0</b> alcaldies · <b>12</b> regidories");
  });

  it("posa sis comarques amb la força que hi mana més, i l'enllaç a totes", () => {
    const taula = main.slice(main.indexOf('<table class="comarques-taula">'), main.indexOf("</table>"));
    expect(taula.match(/<tr><th scope="row">/g)).toHaveLength(6);
    expect(taula).toContain('<a href="c/barcelones/">Barcelonès</a>');
    expect(taula).toContain("<td>2.390.000</td>");
    expect(taula).toContain('href="./partit/psc/"');
    expect(taula).toContain('<span class="sec">4 de 5</span>');
    expect(main).toContain('<a href="c/">totes 43 →</a>');
  });

  it("posa un xip per poble amb preguntes: els que es responen com a botó a la prova, la resta a l'esborrany", () => {
    const xips = main.slice(main.indexOf('<ul class="xips">'), main.indexOf("</ul>", main.indexOf('<ul class="xips">')));
    expect(xips.match(/<li>/g)).toHaveLength(23);
    expect(xips.match(/class="xip jugable"/g)).toHaveLength(3);
    expect(xips).toContain('<a class="xip jugable" href="preguntes/esplugues-de-llobregat/prova/">Esplugues de Llobregat <small>respon</small></a>');
    expect(xips).toContain('<a class="xip" href="preguntes/poble-5/">Poble 5</a>');
    expect(main).toContain("a 3 ja es poden respondre");
  });

  it("posa les tres comparacions amb què arrenca el comparador", () => {
    expect(main).toContain('<a href="comparador/?m=esplugues-de-llobregat,sant-just-desvern">');
    expect(main).toContain('<a href="comparador/?m=girona,lleida,tarragona"><b>Tres capitals de província</b><span>Girona · Lleida · Tarragona</span></a>');
    expect(main).toContain('<a href="comparador/?m=olot,salt">');
  });

  it("l'AMB i la trajectòria són una línia cadascuna, no una targeta", () => {
    expect(main).toContain('<a href="amb/">L\'Àrea Metropolitana</a> <span>36 municipis · 3,4 M habitants</span>');
    expect(main).toContain('<a href="trajectoria/">D\'on surten els que manen</a> <span>284 persones');
  });

  it("la descàrrega és una sola línia al final, sense xifres", () => {
    expect(main.match(/href="dades\/"/g)).toHaveLength(1);
    expect(main).toContain('<p class="baixa">Tot el que hi ha aquí es pot <a href="dades/">baixar en CSV i JSON</a>.</p>');
    expect(main).not.toContain("1.897");
    expect(main).not.toContain("fitxers");
    expect(main.indexOf('href="dades/"')).toBeGreaterThan(main.indexOf("Per què això i no un portal de dades"));
  });

  it("no enllaça el que no s'ha publicat", () => {
    const sense = cos(renderPortada(comptes({ trajectoria: null }), "avui", mostra({ amb: null, preguntes: [] })));
    expect(sense).not.toContain('href="amb/"');
    expect(sense).not.toContain('href="trajectoria/"');
    expect(sense).not.toContain('href="preguntes/"');
    expect(sense).not.toContain('class="bloc linies"');
  });

  it("enllaça les tipografies i la capçalera des de l'arrel de l'Observatori", () => {
    expect(html).toContain('href="../assets/fonts.css"');
    expect(html.indexOf("fonts.css")).toBeLessThan(html.indexOf("<style>"));
    expect(html).toContain('<span class="ara" aria-current="page">Observatori</span>');
    expect(html).toContain('<dialog class="cercador"');
    expect(html).toContain('<footer class="peu">');
  });

  it("escapa el que ve de fora", () => {
    const dolent = renderPortada(
      comptes(),
      "avui",
      mostra({
        municipis: [{ slug: "x", nom: 'Un <b>poble</b> "rar"', habitants: 1, alcaldia: { nom: "A <i>B</i>", sigles: "<X>", brandId: null, adreca: null } }],
      }),
    );
    expect(dolent).toContain("Un &lt;b&gt;poble&lt;/b&gt; &quot;rar&quot;");
    expect(dolent).toContain("A &lt;i&gt;B&lt;/i&gt;");
    expect(dolent).toContain("&lt;X&gt;");
    expect(dolent).not.toContain("<i>B</i>");
  });
});

describe("renderPortada sense la mostra", () => {
  const html = renderPortada(comptes(), "avui");
  const main = cos(html);

  it("queda una portada d'enllaços: cap targeta, cap bloc de dades", () => {
    expect(main).toContain('<ul class="seccions">');
    expect(main).not.toContain('class="reixa"');
    expect(main).not.toContain('<ol class="grans">');
    expect(main).not.toContain('<svg class="minimapa"');
    expect(main).not.toContain('<ul class="marques">');
    expect([...main.matchAll(/<li><a href="([^"]+)">/g)].map((m) => m[1])).toEqual([
      "els947.html",
      "mapa/",
      "partit/",
      "c/",
      "preguntes/",
      "comparador/",
      "amb/",
      "trajectoria/",
    ]);
  });

  it("continua portant el botó del cercador i la línia de la descàrrega", () => {
    expect(main).toContain("data-obre-cerca hidden");
    expect(main.match(/href="dades\/"/g)).toHaveLength(1);
  });

  it("no enllaça el que no s'ha publicat", () => {
    const sense = cos(renderPortada(comptes({ trajectoria: null, amb: null, conjuntsPreguntes: 0 }), "avui"));
    expect([...sense.matchAll(/<li><a href="([^"]+)">/g)].map((m) => m[1])).toEqual([
      "els947.html",
      "mapa/",
      "partit/",
      "c/",
      "comparador/",
    ]);
  });
});

describe("la geometria compactada", () => {
  it("llegeix els camins de la geometria: M absoluta, l/h/v relatives i Z", () => {
    expect(anellsDe("M10 20l4 0v6h-4Z")).toEqual([
      [
        [10, 20],
        [14, 20],
        [14, 26],
        [10, 26],
      ],
    ]);
    // Dos anells: un enclavament.
    expect(anellsDe("M0 0h10v10h-10zM2 2h2v2h-2z")).toHaveLength(2);
  });

  it("escala, arrodoneix i treu els punts que cauen l'un sobre l'altre", () => {
    // A la meitat, (10,20)→(5,10), (11,20)→(6,10)? no: 5.5 arrodoneix a 6; (14,20)→(7,10).
    expect(camiCompacte("M10 20l1 0l3 0v6h-4Z", 0.5)).toBe("M5 10h1h1v3h-2z");
    // Un anell que en arrodonir es queda amb menys de tres punts no és res.
    expect(camiCompacte("M0 0h1v1h-1z", 0.25)).toBe("");
    // El punt final repetit del primer no es torna a escriure.
    expect(camiCompacte("M0 0h10v10h-10l0 -10z", 1)).toBe("M0 0h10v10h-10z");
  });
});
