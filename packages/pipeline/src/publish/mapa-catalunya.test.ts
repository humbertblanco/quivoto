import { describe, expect, it } from "vitest";
import { DESCRIPCIO_MAXIMA, TITOL_MAXIM } from "./seo";
import { colorsDelsGraons, geometria, renderMapaCatalunya } from "./mapa-catalunya";
import { rampaDe } from "./vots-partit";
import type { Els947Row } from "./els947";
import type { VotsPartit } from "./vots-partit";

const fila = (s: string, extra: Partial<Els947Row> = {}): Els947Row => ({
  s, n: s, c: "una comarca", p: 1000, r: 11,
  a: null, g: null, ar: null, ac: null, w: 1, m: 0, k: 0, t: 0,
  d: 100, e: 5, f: 40, v: 1, q: 12, y: 60, o: 0,
  b: null, pt: 60, pe: 10, pa: 1.5,
  ...extra,
});

/** Les capes tal com arriben al navegador, que és on es pot comprovar què pinten. */
type CapaAlNavegador = {
  t: string; g: string; e: string[]; n: number; m: string; x: string; c: string;
  u: [string, string] | null;
  /** El diccionari de textos de l'etiqueta i l'índex de cada municipi; la primera capa no els porta. */
  w: string[] | null; k: string | null;
  /** La mediana per tram de mida, el diccionari d'anys i, si cal, l'any de cada municipi. */
  d: string[] | null; a: string[] | null; y: string | null;
  /** El rètol de la clau d'HTML: el nom curt, i la unitat, l'any i la font. */
  b: string; q: string;
};
const capesDe = (html: string): CapaAlNavegador[] =>
  JSON.parse(/var CAPES = (\[.*\]);\n/.exec(html)![1]!) as never;

/** L'enllaç d'un municipi al mapa, amb els atributs de l'etiqueta. */
const enllacDe = (html: string, slug: string): string =>
  /<a href="\/observatori\/m\/[^"]+\/"[^>]*>/.exec(html.slice(html.indexOf(`<a href="/observatori/m/${slug}/"`)))![0];

/** El que diu l'etiqueta d'un municipi a una capa, tal com ho compondrà el script. */
const textDe = (capa: CapaAlNavegador, i: number): string => {
  const clau = capa.k!.split("|")[i]!;
  return clau === "" ? capa.x : capa.w![parseInt(clau, 36)]!;
};

/** On cau un municipi dins de les cadenes de graons: els camins van ordenats. */
const posicio = (slug: string): number => Object.keys(geometria.municipis).sort().indexOf(slug);

describe("geometria", () => {
  it("porta els 947 municipis", () => {
    expect(Object.keys(geometria.municipis)).toHaveLength(947);
  });

  it("porta la llicència i la font, que són obligatòries per publicar-la", () => {
    expect(geometria.llicencia).toBe("CC BY 4.0");
    expect(geometria.font).toMatch(/Institut Cartogràfic/);
  });

  it("cap camí no és buit: un municipi sense geometria seria un forat blanc", () => {
    for (const [slug, d] of Object.entries(geometria.municipis)) {
      expect(d.length, slug).toBeGreaterThan(10);
      expect(d.startsWith("M"), slug).toBe(true);
    }
  });

  it("Barcelona hi és i no és un forat", () => {
    // El GeoJSON de l'ICGC aplana els MultiPolygon i, sense reparar, Barcelona
    // es llegeix com un forat d'un tros de costa i desapareix del mapa.
    expect(geometria.municipis["barcelona"]).toBeDefined();
    expect(geometria.municipis["barcelona"]!.length).toBeGreaterThan(100);
  });
});

describe("renderMapaCatalunya", () => {
  const files = Object.keys(geometria.municipis).map((s) => fila(s));

  it("dibuixa un camí per municipi i tots porten a la seva fitxa", () => {
    const html = renderMapaCatalunya(files, "2026-08-29");
    expect(html.match(/<path class="g/g) ?? []).toHaveLength(947);
    expect(html).toContain('href="/observatori/m/barcelona/"');
  });

  it("marca com a «sense dada» els municipis que no tenen la xifra", () => {
    const html = renderMapaCatalunya(
      files.map((f, i) => (i < 100 ? { ...f, f: null, y: null, v: null } : f)),
      "2026-08-29",
    );
    // La primera capa és la majoria absoluta, que la tenen tots; les que falten
    // han de sortir a la cobertura de les altres capes.
    expect(html).toContain("gnd");
    expect(html).toContain("847");
  });

  it("cita la llicència i qui fa el mapa", () => {
    const html = renderMapaCatalunya(files, "2026-08-29");
    expect(html).toContain("CC BY 4.0");
    expect(html).toContain("Institut Cartogràfic");
  });

  it("avisa que un mapa de municipis sobrerepresenta el buit", () => {
    expect(renderMapaCatalunya(files, "2026-08-29")).toContain("sobrerepresenta el buit");
  });

  it("no es queda sense graons quan tots els municipis valen el mateix", () => {
    // Amb tots els valors iguals, els quantils col·lapsen: no ha de petar ni
    // deixar la llegenda amb graons que no existeixen.
    const iguals = files.map((f) => ({ ...f, f: 50, y: 50, v: 0 }));
    const html = renderMapaCatalunya(iguals, "2026-08-29");
    expect(html).toContain("<svg");
  });
});

/**
 * El mecanisme de les capes desa un graó per municipi en una cadena, i canviar
 * de capa és reescriure classes llegint-ne els caràcters d'un en un. Si un
 * graó n'ocupa dos, tot el que ve després queda desplaçat i el mapa pinta els
 * municipis del color d'un altre. Va passar amb la capa dels partits: dotze
 * famílies, els graons 10 i 11 escrits com a «10» i «11», i Lleida —que és del
 * PSC— es pintava d'ERC.
 */
describe("cada graó ocupa exactament un caràcter", () => {
  it("la cadena de cada capa té tants caràcters com municipis", () => {
    const tots = Object.keys(geometria.municipis).map((s) => fila(s, { g: "PSC-CP" }));
    const html = renderMapaCatalunya(tots, "2026-08-29");
    const capes = JSON.parse(/var CAPES = (\[[\s\S]*?\]);/.exec(html)![1]!) as { g: string }[];
    const camins = (html.match(/<a href="\/observatori\/m\//g) ?? []).length;
    expect(capes.length).toBeGreaterThan(0);
    for (const capa of capes) expect(capa.g.length).toBe(camins);
  });
});

/**
 * Els 94 municipis grisos, i per què el codi d'agrupació els despenja.
 *
 * Mesurat sobre `dades/catalunya.csv`: 94 municipis tenen sigles d'alcaldia i
 * `siglesFamily()` no els en reconeix cap família, i hi viuen 640.193 persones.
 * El cas que ho explica és el Prat de Llobregat, on la marca dels comuns va
 * plegada dins d'un acrònim que només existeix allà.
 */
describe("qui mana: mana el codi d'agrupació, no l'acrònim", () => {
  const tots = (extra: Record<string, Partial<Els947Row>>): Els947Row[] =>
    Object.keys(geometria.municipis).map((s) => fila(s, extra[s] ?? {}));

  it("el Prat de Llobregat es pinta dels comuns encara que «EPCP-C» no ho digui", () => {
    const html = renderMapaCatalunya(
      tots({ "prat-de-llobregat": { g: "EPCP-C", b: "comuns" } }),
      "2026-08-29",
    );
    const capa = capesDe(html)[0]!;
    // El quart color de la llista de famílies del mapa és el dels comuns.
    expect(capa.e[parseInt(capa.g.charAt(posicio("prat-de-llobregat")), 36)]).toBe("Comuns");
    // I l'etiqueta ha de dir la mateixa força, no una altra.
    expect(enllacDe(html, "prat-de-llobregat")).toContain('data-valor="Comuns"');
  });

  it("Terrassa es queda grisa: «TxT» és Tot per Terrassa i no és cap marca gran", () => {
    const html = renderMapaCatalunya(tots({ terrassa: { g: "TxT", b: null } }), "2026-08-29");
    expect(capesDe(html)[0]!.g.charAt(posicio("terrassa"))).toBe("x");
  });

  it("sense codi d'agrupació les sigles continuen manant", () => {
    // Tiana: la llista es diu «JUNTS» i el codi encara no s'ha repassat, o
    // sigui que hi consta com a local. Despintar-la seria perdre una dada que
    // tenim, no ser prudent.
    const html = renderMapaCatalunya(tots({ tiana: { g: "JUNTS", b: null } }), "2026-08-29");
    const capa = capesDe(html)[0]!;
    expect(capa.e[parseInt(capa.g.charAt(posicio("tiana")), 36)]).toBe("Junts");
  });

  it("una marca comarcal no es pinta del color de ningú", () => {
    // «Tots per l'Empordà» és una marca de veritat, però no és cap de les dotze
    // del mapa: ha de sortir grisa i no pas del color de la que se li assembli.
    const html = renderMapaCatalunya(tots({ corca: { g: "FP-TE", b: "te" } }), "2026-08-29");
    expect(capesDe(html)[0]!.g.charAt(posicio("corca"))).toBe("x");
  });
});

describe("l'etiqueta de cada municipi", () => {
  const tots = (extra: Record<string, Partial<Els947Row>>): Els947Row[] =>
    Object.keys(geometria.municipis).map((s) => fila(s, extra[s] ?? {}));

  it("cada camí porta el nom, el que hi ha pintat a la primera capa i els extres fixos, i el títol per a qui no té script", () => {
    const html = renderMapaCatalunya(
      tots({ girona: { n: "Girona", c: "Gironès", p: 104_000, a: "Lluc Salellas", g: "CUP-AMUNT", b: "cup" } }),
      "2026-08-29",
    );
    // Els habitants, la comarca i l'alcaldia amb les sigles: el que és
    // veritat del municipi a totes les capes, escrit una sola vegada.
    expect(enllacDe(html, "girona")).toBe(
      '<a href="/observatori/m/girona/" data-nom="Girona" data-valor="CUP (alcaldia: Lluc Salellas)"' +
        ' data-extres="habitants¦104.000‖comarca¦Gironès‖alcaldia¦Lluc Salellas (CUP-AMUNT)">',
    );
    expect(html).toContain('(CUP-AMUNT)"><title>Girona</title><path class="g');
    // Tots els 947, i cap sense el que diu ni sense els extres.
    expect(
      html.match(/<a href="\/observatori\/m\/[^"]+\/" data-nom="[^"]+" data-valor="[^"]+" data-extres="habitants¦[^"]+">/g),
    ).toHaveLength(947);
    // Sense alcaldia coneguda no es diu cap alcaldia, i no un guió.
    expect(enllacDe(html, "barcelona")).toContain('data-extres="habitants¦1.000‖comarca¦una comarca">');
    // L'any de la primera capa no s'escriu 947 vegades: el posa el script en arrencar.
    expect(html).not.toContain("data-any=");
  });

  it("l'any i la mediana dels de la seva mida van amb cada capa, i el script els posa a l'enllaç en canviar-la", () => {
    const html = renderMapaCatalunya(
      tots({
        barcelona: { p: 1_600_000, d: 1234, pa: 2.5, paa: 2024 },
        girona: { p: 104_000, d: 0, pa: 1.5, paa: 2023 },
        lleida: { p: 140_000, d: 300, pa: null, paa: null },
      }),
      "2026-08-29",
    );
    const capes = capesDe(html);
    // Un tram de mida per municipi, com els graons: una lletra cadascun.
    const trams = /var TRAMS = "([^"]+)"/.exec(html)![1]!;
    expect(trams).toHaveLength(947);
    // Les capes de govern diuen el mandat, i és el mateix per a tothom.
    expect(capes[0]!.a).toEqual(["mandat 2023-2027"]);
    expect(capes[0]!.y).toBeNull();
    // Les de categories no tenen mediana.
    expect(capes[0]!.d).toBeNull();
    // El deute no diu any, que no és el mateix a tot arreu, però sí la mediana per tram.
    const deute = capes.find((c) => c.t.includes("deu cada ajuntament"))!;
    expect(deute.a).toBeNull();
    expect(deute.d).not.toBeNull();
    const tramGran = parseInt(trams.charAt(posicio("barcelona")), 36);
    expect(deute.d![tramGran]).toMatch(/^[\d.]+ €$/);
    // L'aigua porta l'any de cada fila: un diccionari i una lletra per municipi.
    const aigua = capes.find((c) => c.t.includes("costa l'aigua"))!;
    expect(aigua.y).toHaveLength(947);
    const anyDe = (slug: string): string | null => {
      const lletra = aigua.y!.charAt(posicio(slug));
      return lletra === "x" ? null : aigua.a![parseInt(lletra, 36)]!;
    };
    expect(anyDe("barcelona")).toBe("2024");
    expect(anyDe("girona")).toBe("2023");
    expect(anyDe("lleida")).toBeNull();
    // I el script els escriu i els treu a cada canvi de capa.
    expect(html).toContain("enllacos[n].setAttribute('data-any', any)");
    expect(html).toContain("enllacos[n].setAttribute('data-mediana', mediana)");
    expect(html).toContain("enllacos[n].removeAttribute('data-any')");
  });

  it("un municipi gris no és un municipi sense alcaldia: diu les sigles i qui hi mana", () => {
    const html = renderMapaCatalunya(tots({ terrassa: { g: "TxT", b: null, a: "Jordi Ballart" } }), "2026-08-29");
    expect(enllacDe(html, "terrassa")).toContain('data-valor="TxT, llista local o sense marca (alcaldia: Jordi Ballart)"');
    // I sense ni sigles ni alcaldia, el que diu la clau.
    expect(enllacDe(html, "barcelona")).toContain('data-valor="sense dada"');
  });

  it("la resta de capes porten el text de cada municipi, formatat com la clau, en un diccionari i un índex per municipi", () => {
    const html = renderMapaCatalunya(
      tots({ barcelona: { pt: 62.34, d: 1234, m: 1 }, girona: { pt: null, d: 0, m: 0 } }),
      "2026-08-29",
    );
    const capes = capesDe(html);
    // La primera capa ja és escrita als camins i no viatja dues vegades.
    expect(capes[0]!.w).toBeNull();
    expect(capes[0]!.k).toBeNull();
    for (const capa of capes.slice(1)) {
      expect(capa.k!.split("|")).toHaveLength(947);
      // Cap índex fora del diccionari.
      for (const clau of capa.k!.split("|")) if (clau !== "") expect(capa.w![parseInt(clau, 36)]).toBeTypeOf("string");
    }
    const participacio = capes.find((c) => c.t.includes("anar a votar"))!;
    expect(textDe(participacio, posicio("barcelona"))).toBe("62,3 %");
    expect(textDe(participacio, posicio("girona"))).toBe("sense dada");
    const deute = capes.find((c) => c.t.includes("deu cada ajuntament"))!;
    expect(textDe(deute, posicio("barcelona"))).toBe("1.234 €");
    expect(textDe(deute, posicio("girona"))).toBe("0 €");
    const majoria = capes.find((c) => c.t.includes("majoria absoluta"))!;
    expect(textDe(majoria, posicio("barcelona"))).toBe("amb majoria absoluta");
    expect(textDe(majoria, posicio("girona"))).toBe("sense majoria absoluta");
    // Dos textos per a 947 municipis: el diccionari és el que estalvia.
    expect(majoria.w).toEqual(["sense majoria absoluta", "amb majoria absoluta"]);
  });

  it("el script pinta la capa i reescriu el «data-valor» dels 947 amb el text d'aquella capa", () => {
    const html = renderMapaCatalunya(tots({}), "2026-08-29");
    expect(html).toContain("enllacos[n].setAttribute('data-valor', text)");
    expect(html).toContain("inicials.push(enllacos[e].getAttribute('data-valor'))");
  });

  it("és l'etiqueta comuna de tots els gràfics, una sola vegada i sense cap fitxa pròpia del mapa", () => {
    const html = renderMapaCatalunya(tots({}), "2026-08-29");
    expect(html.split('<script id="grafics-etiqueta">')).toHaveLength(2);
    expect(html.indexOf('<script id="grafics-etiqueta">')).toBeLessThan(html.indexOf("</body>"));
    expect(html).toContain(".etiqueta-grafic{position:fixed");
    expect(html).not.toContain("ullada-mapa");
    expect(html).not.toContain("var INFO");
  });
});

describe("les capes de xifres", () => {
  const slugs = Object.keys(geometria.municipis);

  it("pinta el deute, la participació, l'aigua i la població estrangera", () => {
    const html = renderMapaCatalunya(slugs.map((s) => fila(s)), "2026-08-29");
    for (const titol of ["Quant deu cada ajuntament", "va anar a votar", "costa l'aigua", "nacionalitat estrangera"]) {
      expect(capesDe(html).some((c) => c.t.includes(titol)), titol).toBe(true);
    }
  });

  it("una capa que no té la dada enlloc no s'ofereix", () => {
    // Un botó que pinta els 947 de gris no diu «no hi ha dada»: diu «espatllat».
    const html = renderMapaCatalunya(slugs.map((s) => fila(s, { pa: null })), "2026-08-29");
    expect(capesDe(html).some((c) => c.t.includes("costa l'aigua"))).toBe(false);
  });

  it("no obre cap graó per sota del mínim", () => {
    // El deute per habitant té quatre-cents municipis a zero i el primer
    // quantil hi val 0: la clau deia «menys de 0 €», un graó on no hi pot
    // caure ningú i un color de la rampa que no s'arribava a fer servir.
    const html = renderMapaCatalunya(
      slugs.map((s, i) => fila(s, { d: i < 500 ? 0 : i })),
      "2026-08-29",
    );
    const capa = capesDe(html).find((c) => c.t.includes("Quant deu"))!;
    expect(capa.e[0]).not.toBe("menys de 0 €");
    expect(capa.g).not.toContain("x");
  });

  it("diu la mediana, perquè una taca fosca sola no vol dir «molt»", () => {
    const html = renderMapaCatalunya(slugs.map((s, i) => fila(s, { d: i })), "2026-08-29");
    expect(capesDe(html).find((c) => c.t.includes("Quant deu"))!.m).toMatch(/€$/);
    // I les categòriques no en tenen: la mediana d'un número de partit no és res.
    expect(capesDe(html)[0]!.m).toBe("");
  });
});

/**
 * La clau del mapa, escrita dins de l'SVG.
 *
 * Quan algú fa una captura del mapa o se'n desa el dibuix, la llista de colors
 * que hi ha en HTML al costat no hi va, i el que queda és una taca de colors
 * sense manera de saber què volen dir.
 */
describe("la llegenda va dins de l'SVG", () => {
  const html = renderMapaCatalunya(
    Object.keys(geometria.municipis).map((s) => fila(s, { g: "PSC-CP" })),
    "2026-08-29",
  );

  it("n'hi ha una per capa i totes van dins del dibuix", () => {
    const dins = /<svg class="mapa947"[\s\S]*?<\/svg>/.exec(html)![0]!;
    expect((dins.match(/class="clau-mapa"/g) ?? []).length).toBe(capesDe(html).length);
  });

  it("porta el nom de cada força escrit, no només el quadret de color", () => {
    expect(html).toMatch(/<g class="clau-mapa" data-clau="0"[\s\S]*?Aliança Catalana/);
  });

  it("la primera capa ja es veu sense JavaScript", () => {
    expect(html).toContain('<svg class="mapa947" data-capa="0"');
    expect(html).toMatch(/<ul class="mapa-llegenda" id="llegenda" data-capa="0"><li>/);
  });

  it("no la sent dues vegades qui llegeix amb veu", () => {
    expect(html).toMatch(/<g class="clau-mapa" data-clau="0" aria-hidden="true">/);
  });

  it("es veu quan el mapa fa 800 px o més, i llavors la d'HTML es queda per a qui llegeix amb veu", () => {
    // Dues llegendes de la mateixa cosa a un pam l'una de l'altra fan dubtar
    // de si volen dir el mateix. El tall és l'amplada del mapa, no la de la
    // finestra: la lletra més petita de la clau de dins (26 unitats d'un llenç
    // de 1.600) fa 13 px just quan el mapa en fa 800. El full compartit té els
    // seus propis talls; el que es mira és el del mapa, que comença a «.mapa-marc».
    const css = html.slice(html.indexOf(".mapa-marc{margin"), html.indexOf("</style>"));
    expect(css).toContain(".mapa-marc{container:mapa / inline-size}");
    const dins = css.slice(css.indexOf("@container mapa (min-width:800px){"));
    expect(dins).toContain('.mapa947[data-capa="0"] .clau-mapa[data-clau="0"]{display:block}');
    expect(dins).toMatch(/\.mapa-clau\{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect\(0 0 0 0\)/);
    // Sense «@container» (o amb el mapa estret) mana la d'HTML.
    expect(css).toContain(".clau-mapa{display:none}");
    expect(css).not.toContain("min-width:761px");
    expect(css).not.toContain("max-width:760px");
    expect(html).toContain('<ul class="mapa-llegenda" id="llegenda" data-capa="0">');
  });

  it("cap lletra de dins del dibuix no baixa de 26 unitats, que són 13 px amb el mapa a 800", () => {
    const dins = /<svg class="mapa947"[\s\S]*?<\/svg>/.exec(html)![0]!;
    const mides = [...dins.matchAll(/font-size="(\d+)"/g)].map((m) => Number(m[1]));
    expect(mides.length).toBeGreaterThan(0);
    expect(Math.min(...mides)).toBeGreaterThanOrEqual(26);
  });

  it("diu la unitat, l'any i la font, a dins del dibuix i a la clau d'HTML", () => {
    // La clau de dins és la que viatja amb una captura: sense font ni any,
    // una captura és una xifra que ningú pot comprovar.
    expect(html).toMatch(/<g class="clau-mapa" data-clau="0"[\s\S]*?class="meta"[^>]*>mandat 2023-2027 · Font: Generalitat de Catalunya</);
    expect(html).toContain(
      '<p class="mapa-clau-cap" id="clau-cap"><b>Qui mana</b> mandat 2023-2027 · Font: Generalitat de Catalunya</p>',
    );
    const deute = capesDe(html).find((c) => c.t.includes("Quant deu"))!;
    expect(deute.b).toBe("Deute per habitant");
    expect(deute.q).toBe("€ per habitant · últim exercici liquidat · Font: Consorci AOC");
    expect(html).toMatch(/class="meta"[^>]*>€ per habitant · últim exercici liquidat<\/text><text class="meta"[^>]*>Font: Consorci AOC</);
  });

  it("cap clau no trepitja cap municipi: totes caben al forat del mar", () => {
    // El mateix càlcul que dona `FORAT_DEL_MAR`, refet amb la geometria del
    // repositori: si el traçat canvia, això ho diu abans que la clau tapi la costa.
    const punts: [number, number][] = [];
    const camina = (d: string): void => {
      const toks = d.match(/[MLlZzHhVv]|-?\d+(?:\.\d+)?/g) ?? [];
      let x = 0, y = 0, sx = 0, sy = 0, cmd = "";
      for (let i = 0; i < toks.length; ) {
        const t = toks[i]!;
        if (/[A-Za-z]/.test(t)) {
          cmd = t;
          i += 1;
          if (cmd === "Z" || cmd === "z") { x = sx; y = sy; }
          continue;
        }
        if (cmd === "M") { x = +t; y = +toks[i + 1]!; sx = x; sy = y; i += 2; cmd = "L"; }
        else if (cmd === "L") { x = +t; y = +toks[i + 1]!; i += 2; }
        else if (cmd === "l") { x += +t; y += +toks[i + 1]!; i += 2; }
        else if (cmd === "h") { x += +t; i += 1; }
        else if (cmd === "v") { y += +t; i += 1; }
        else if (cmd === "H") { x = +t; i += 1; }
        else if (cmd === "V") { y = +t; i += 1; }
        else i += 1;
        punts.push([x, y]);
      }
    };
    for (const d of Object.values(geometria.municipis)) camina(d);
    // Amb vots, perquè hi hagi també les claus dels partits, i amb sense dades
    // a la renda, perquè la clau més alta d'una columna en porti sis files.
    const slugs = Object.keys(geometria.municipis).sort();
    const vots: VotsPartit = { erc: {} };
    slugs.forEach((s, i) => { if (i % 3) vots["erc"]![s] = { nom: s, pct: i % 90, vots: i, regidories: 1, alcaldia: false }; });
    const amb = renderMapaCatalunya(
      slugs.map((s, i) => fila(s, { g: "PSC-CP", rn: i % 7 === 0 ? null : 10_000 + i, ra: 2023, sa: 20_000 + i, pa: 1 + i / 1000, paa: 2020 + (i % 4) })),
      "2026-08-29",
      vots,
    );
    const fons = [...amb.matchAll(/<rect class="fons" x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"/g)].map((m) => m.slice(1).map(Number));
    expect(fons.length).toBe(capesDe(amb).length);
    for (const [x, y, w, h] of fons) {
      expect(x! + w!).toBeLessThanOrEqual(1600);
      expect(y! + h!).toBeLessThanOrEqual(1600);
      const dins = punts.filter(([px, py]) => px >= x! && px <= x! + w! && py >= y! && py <= y! + h!);
      expect(dins, `clau a ${x},${y} de ${w}×${h}`).toHaveLength(0);
    }
  });
});

describe("la resta de la pàgina", () => {
  const html = renderMapaCatalunya(Object.keys(geometria.municipis).map((s) => fila(s)), "2026-08-29");

  it("no repeteix el peu: «Segueix estirant» ja no hi és, i els 947 i el comparador hi són pel peu", () => {
    expect(html).not.toContain("Segueix estirant");
    expect(html).toContain('href="../comparador/"');
  });

  it("enllaça les tipografies de la marca abans del full d'estil", () => {
    expect(html.indexOf("assets/fonts.css")).toBeGreaterThan(-1);
    expect(html.indexOf("assets/fonts.css")).toBeLessThan(html.indexOf("<style>"));
  });
});

describe("la rampa contínua", () => {
  const html = renderMapaCatalunya(Object.keys(geometria.municipis).map((s) => fila(s)), "2026-08-29");

  it("es gira en fosc, perquè el graó que crida sigui sempre el valor alt", () => {
    expect(html).toMatch(/@media \(prefers-color-scheme:dark\)\{[\s\S]*?\.mapa947 \.g0\{fill:#3B2119\}/);
    expect(html).toMatch(/@media \(prefers-color-scheme:dark\)\{[\s\S]*?--nd-fons:#2E2A3A/);
  });

  it("el «sense dada» no és mai un graó de la rampa", () => {
    // Si el forat es pinta amb un color de la rampa, un municipi sense dada es
    // llegeix com un municipi amb una xifra, que és pitjor que no dir res.
    for (const ramp of ["#FBEFE6", "#F0BFA9", "#E2735A", "#BE5138", "#8E2F1D", "#3B2119", "#F5A583"]) {
      expect(html).not.toContain(`.gnd{fill:${ramp}}`);
    }
  });

  it("el «sense dada» va ratllat i no pintat, i el patró és dins del dibuix", () => {
    // El gris de sorra d'abans tenia la lluminància entre el primer graó i el
    // segon: un forat es llegia com «poc». Les ratlles no són cap graó de cap
    // escala i es distingeixen encara que no es distingeixi el color.
    expect(html).toContain(".mapa947 .gnd{fill:url(#sense-dada)}");
    const dins = /<svg class="mapa947"[\s\S]*?<\/svg>/.exec(html)![0]!;
    expect(dins).toContain('<pattern id="sense-dada"');
    // I el quadret de la llegenda d'HTML ha de portar les mateixes ratlles: si
    // el mapa va ratllat i la clau va plana, la clau no és la clau del mapa.
    expect(html).toMatch(/\.mapa-llegenda \.gnd\{background:repeating-linear-gradient/);
  });
});

/**
 * Les capes que depenen d'una feina d'ingesta que pot no haver-se passat.
 *
 * `loadEls947()` escriu `rn` (J23) i `sa` (J22) sempre, però són `null` a tots
 * els 947 mentre la feina no s'ha passat: llavors les dues capes no tenen dada
 * enlloc i han de desaparèixer del mapa senceres —botó, llegenda i taca—, no
 * quedar-se com un botó que pinta els 947 de gris.
 */
describe("renda i sou de l'alcaldia", () => {
  const slugs = Object.keys(geometria.municipis);

  it("no surten quan la fila no en porta la xifra", () => {
    const html = renderMapaCatalunya(slugs.map((s) => fila(s)), "2026-08-29");
    expect(html).not.toContain("Renda per persona");
    expect(html).not.toContain("Sou de l'alcaldia");
    expect(html).not.toContain("Atlas de distribución de renta");
  });

  it("surten, amb la font i la llicència, quan la fila les porta", () => {
    const amb = slugs.map((s, i) => fila(s, { rn: 12_000 + i * 10, sa: i % 3 === 0 ? null : 30_000 + i }));
    const html = renderMapaCatalunya(amb, "2026-08-29");
    expect(html).toContain("Renda per persona");
    expect(html).toContain("Sou de l'alcaldia");
    expect(html).toContain("Atlas de distribución de renta");
    expect(html).toContain("Ministeri per a la Transformació Digital");
    // La cobertura de cada capa arriba al navegador: els 947 tenen renda i dos
    // terços tenen sou, i el mapa ho ha de poder dir.
    const capes = capesDe(html);
    expect(capes.find((c) => c.t.includes("entren a les cases"))!.n).toBe(947);
    expect(capes.find((c) => c.t.includes("cobra l'alcaldia"))!.n).toBe(amb.filter((f) => f.sa !== null).length);
  });

  it("el sou el llegeix de la fila tal qual: la fila ja diu si és un sou", () => {
    // Qui decideix si un import és un sou o assistències és `souAlcaldia()` a
    // «els947.ts»; aquí un `null` és «sense dada» i prou, i un zero seria una
    // xifra. Amb `sa` a zero a tots, la capa hi és i ningú no és «sense dada».
    const html = renderMapaCatalunya(slugs.map((s) => fila(s, { sa: 0 })), "2026-08-29");
    const capa = capesDe(html).find((c) => c.t.includes("cobra l'alcaldia"))!;
    expect(capa.n).toBe(947);
    expect(capa.g).not.toContain("x");
  });

  it("la descripció de la pàgina només promet les capes que hi són", () => {
    const html = renderMapaCatalunya(slugs.map((s) => fila(s)), "2026-08-29");
    const descripcio = /<meta name="description" content="([^"]*)"/.exec(html)![1]!;
    expect(descripcio).toContain("qui mana");
    expect(descripcio).not.toContain("renda per persona");
  });
});

/**
 * Les capes de cada partit: on es vota més cadascun.
 *
 * Una alcaldia és el final d'un pacte i no la mesura del vot. Aquestes capes
 * pinten el pes dels vots de cada marca en cinc quintils del seu color, i on
 * no es va presentar hi va el ratllat, que aquí es diu pel seu nom.
 */
describe("on es vota més cada partit", () => {
  const slugs = Object.keys(geometria.municipis).sort();
  const files = slugs.map((s) => fila(s));
  /** ERC a dos de cada tres municipis, el PSC a un de cada dos, i FIC sense cap regidoria enlloc. */
  const vots: VotsPartit = { erc: {}, psc: {}, fic: {} };
  slugs.forEach((s, i) => {
    if (i % 3 !== 0) vots["erc"]![s] = { nom: s, pct: (i * 7) % 100, vots: i, regidories: i % 5, alcaldia: i % 7 === 0 };
    if (i % 2 === 0) vots["psc"]![s] = { nom: s, pct: (i * 3) % 60, vots: i, regidories: 1, alcaldia: false };
    if (i % 50 === 0) vots["fic"]![s] = { nom: s, pct: 5, vots: 10, regidories: 0, alcaldia: false };
  });
  const html = renderMapaCatalunya(files, "2026-08-29", vots);
  const capes = capesDe(html);

  it("sense vots no hi ha cap capa de partit: el mapa surt com sempre", () => {
    const sense = renderMapaCatalunya(files, "2026-08-29");
    expect(sense).not.toContain('class="tries tries-partits"');
    expect(sense).not.toContain("On es vota més");
    expect(capesDe(sense).length).toBe(capesDe(html).length - 2);
  });

  it("amb vots, una capa per partit amb pàgina, en una segona filera de botons amb les sigles", () => {
    const filera = /<div class="tries tries-partits"[^>]*>([\s\S]*?)<\/div>/.exec(html)![1]!;
    expect(filera).toContain(">ERC<");
    expect(filera).toContain(">PSC<");
    // FIC té vots i cap regidoria: no té pàgina i no té capa.
    expect(filera).not.toContain(">FIC<");
    expect(html).toContain("On es vota més cada partit");
    // La primera filera continua sent la de sempre, sense cap partit.
    const primera = /<div class="tries" id="tries"[^>]*>([\s\S]*?)<\/div>/.exec(html)![1]!;
    expect(primera).not.toContain(">ERC<");
    expect(capes.some((c) => c.t === "On es vota més ERC")).toBe(true);
    expect(capes.some((c) => c.t.includes("FIC"))).toBe(false);
  });

  it("l'índex del botó és el de la capa, no el lloc que ocupa a la filera", () => {
    const index = capes.findIndex((c) => c.t === "On es vota més ERC");
    expect(index).toBeGreaterThan(0);
    expect(html).toContain(`<button type="button" data-capa="${index}" aria-pressed="false">ERC<`);
  });

  it("cada capa va del color del seu partit, en cinc graons, i es gira en fosc", () => {
    const i = capes.findIndex((c) => c.t === "On es vota més ERC");
    // El full compartit ja porta un bloc fosc abans del del mapa: el que es
    // mira és el del mapa, que comença a «.mapa-marc».
    const css = html.slice(html.indexOf(".mapa-marc"), html.indexOf("</style>"));
    const clar = css.slice(0, css.indexOf("@media (prefers-color-scheme:dark)"));
    for (let k = 0; k < 5; k += 1) {
      expect(clar).toMatch(new RegExp(`\\.mapa947\\[data-capa="${i}"\\] \\.g${k}\\{fill:#[0-9a-f]{6}\\}`));
    }
    // La rampa d'ERC és la del seu taronja, no la coral: cap graó no és de la coral.
    expect(clar).not.toMatch(new RegExp(`\\.mapa947\\[data-capa="${i}"\\] \\.g4\\{fill:#8E2F1D\\}`));
    const fosc = css.slice(css.lastIndexOf("@media (prefers-color-scheme:dark)"));
    expect(fosc).toMatch(new RegExp(`\\.mapa947\\[data-capa="${i}"\\] \\.g0\\{fill:#[0-9a-f]{6}\\}`));
    // I la clau de dins del dibuix hi és, amb el nom del partit.
    expect(html).toMatch(new RegExp(`<g class="clau-mapa" data-clau="${i}"[\\s\\S]*?Vot a ERC`));
  });

  it("on no es va presentar va ratllat i la clau ho diu pel seu nom", () => {
    const erc = capes.find((c) => c.t === "On es vota més ERC")!;
    expect(erc.x).toBe("no s'hi va presentar");
    expect(erc.g.charAt(0)).toBe("x");
    expect(erc.g.length).toBe(947);
    expect(erc.n).toBe(slugs.filter((_, i) => i % 3 !== 0).length);
    expect(erc.c).toMatch(/^S'hi va presentar a \d+ dels 947 municipis\. Al municipi del mig hi va treure el [\d,]+ %\.$/);
    // Les capes de sempre continuen dient «sense dada».
    expect(capes[1]!.x).toBe("sense dada");
  });

  it("les etiquetes són intervals, no «o més» a cada tall", () => {
    const erc = capes.find((c) => c.t === "On es vota més ERC")!;
    expect(erc.e).toHaveLength(5);
    expect(erc.e[0]).toMatch(/^menys del [\d,]+ %$/);
    expect(erc.e[1]).toMatch(/^del [\d,]+ % al [\d,]+ %$/);
    expect(erc.e[4]).toMatch(/^[\d,]+ % o més$/);
  });

  it("enllaça la pàgina del partit des de la capa, i només des d'ella", () => {
    const erc = capes.find((c) => c.t === "On es vota més ERC")!;
    expect(erc.u).toEqual(["../partit/erc/", "La pàgina d'ERC: alcaldies, regidories i des del 1979"]);
    expect(capes[0]!.u).toBeNull();
    expect(html).toContain('<p class="nota" id="enllac-capa" hidden>');
  });

  it("explica la font i que els quintils no es comparen entre partits", () => {
    expect(html).toContain("<code>ntc4-rnwr</code>");
    expect(html).toContain("no es poden comparar entre partits");
    const descripcio = /<meta name="description" content="([^"]*)"/.exec(html)![1]!;
    expect(descripcio).toContain("on es vota més cada partit");
    expect(descripcio).not.toContain("ERC");
  });
});

describe("el cap SEO del mapa", () => {
  const titolDe = (html: string): string => /<title>([^<]*)<\/title>/.exec(html)![1]!;
  const descripcioDe = (html: string): string => /<meta name="description" content="([^"]*)"/.exec(html)![1]!;
  const jsonLdDe = (html: string): Record<string, unknown>[] =>
    [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1]!));
  const filDe = (html: string): { name: string; item: string }[] =>
    (jsonLdDe(html).find((o) => o["@type"] === "BreadcrumbList")!.itemListElement as { name: string; item: string }[]);

  const html = renderMapaCatalunya(Object.keys(geometria.municipis).map((s) => fila(s)), "2026-08-29");

  it("es titula amb el compte de municipis i descriu tres capes i compta la resta", () => {
    expect(titolDe(html)).toBe("Mapa dels 947 municipis · quivoto");
    expect(descripcioDe(html)).toMatch(/^Els 947 municipis de Catalunya pintats per qui mana, majoria absoluta, pactes i \d+ capes més/);
    expect(descripcioDe(html)).toMatch(/Cada un porta a la seva fitxa\.$/);
    expect(html).toContain('<link rel="canonical" href="https://quivoto.cat/observatori/mapa/">');
  });

  it("porta el fil d'Ariadna fins al mapa", () => {
    expect(filDe(html).map((i) => i.name)).toEqual(["quivoto", "Observatori municipal", "Mapa dels 947 municipis"]);
  });

  it("el títol i la descripció caben on el cercador els talla, i la descripció no s'ha hagut de retallar", () => {
    expect(titolDe(html).length).toBeLessThanOrEqual(TITOL_MAXIM);
    expect(descripcioDe(html).length).toBeLessThanOrEqual(DESCRIPCIO_MAXIMA);
    expect(descripcioDe(html).length).toBeGreaterThanOrEqual(70);
    expect(descripcioDe(html)).not.toMatch(/…$/);
  });

  it("té un sol <h1>", () => {
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
  });
});

/**
 * El mapa al mòbil: el mapa a la primera pantalla.
 *
 * Abans hi havia vint-i-vuit botons de capa abans del mapa i el mapa no
 * sortia fins a la segona pantalla i mitja. Per sota de 721 px els botons
 * deixen lloc a un desplegable agrupat i el mapa va just sota el títol de la
 * capa; a l'escriptori els botons continuen on eren.
 */
describe("el mapa al mòbil", () => {
  const slugs = Object.keys(geometria.municipis).sort();
  const vots: VotsPartit = { erc: {} };
  slugs.forEach((s, i) => { if (i % 2) vots["erc"]![s] = { nom: s, pct: i % 80, vots: i, regidories: 1, alcaldia: false }; });
  const html = renderMapaCatalunya(slugs.map((s) => fila(s)), "2026-08-29", vots);
  const capes = capesDe(html);
  // El full del mapa, sense el compartit, que té els seus propis talls de 720 px.
  const css = html.slice(html.indexOf(".mapa-marc{margin"), html.indexOf("</style>"));

  it("porta un desplegable amb totes les capes, agrupades, i la primera triada", () => {
    const select = /<select id="tria-capa">([\s\S]*?)<\/select>/.exec(html)![1]!;
    const valors = [...select.matchAll(/<option value="(\d+)"/g)].map((m) => Number(m[1]));
    // Una opció per capa, amb l'índex de la llista sencera, com els botons.
    expect([...valors].sort((a, b) => a - b)).toEqual(capes.map((_, i) => i));
    expect(select).toContain('<option value="0" selected>Qui mana</option>');
    const grups = [...select.matchAll(/<optgroup label="([^"]+)">/g)].map((m) => m[1]);
    expect(grups[0]).toBe("Qui governa");
    expect(grups).toContain("On es vota més cada partit");
    expect(new Set(grups).size).toBe(grups.length);
    // I té una etiqueta visible, lligada al desplegable.
    expect(html).toContain('<label for="tria-capa">Què vols veure al mapa</label>');
  });

  it("per sota de 721 px amaga els botons, ensenya el desplegable i posa el mapa abans del peu", () => {
    expect(css).toContain(".mapa-tria{display:none;");
    const mobil = css.slice(css.indexOf("@media (max-width:720px){"));
    expect(mobil).toMatch(/^@media \(max-width:720px\)\{\s*\.tries,\.tries-cap\{display:none\}\s*\.mapa-tria\{display:block;order:0\}/);
    expect(mobil).toContain(".mapa-salta,.mapa-llenc{order:2}");
    expect(mobil).toContain(".mapa-clau{order:3;");
    expect(mobil).toContain("#peu-capa{order:4;");
    // El desplegable va dins del marc del mapa, just abans del títol de la capa.
    expect(html.indexOf('<div class="mapa-tria">')).toBeLessThan(html.indexOf('<h2 id="titol-capa">'));
    expect(html.indexOf('<div class="mapa-tria">')).toBeGreaterThan(html.indexOf('<div class="mapa-marc">'));
    // 16 px, perquè l'iPhone no faci zoom en tocar-lo.
    expect(css).toMatch(/\.mapa-tria select\{[^}]*font-size:1rem/);
  });

  it("el desplegable i els botons pinten la mateixa capa i es diuen l'un a l'altre quina és", () => {
    expect(html).toContain("tria.addEventListener('change', function () { pinta(Number(tria.value)); });");
    expect(html).toContain("if (tria) tria.value = String(i);");
  });

  it("els botons de l'escriptori fan de barra d'eines: una parada de tabulador per filera i fletxes per dins", () => {
    expect(html).toContain('<div class="tries" id="tries" role="toolbar" aria-label="Què vols veure al mapa">');
    expect(html).toMatch(/<div class="tries tries-partits" id="tries-partits" role="toolbar" aria-labelledby="tries-partits-cap">/);
    for (const tecla of ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"]) expect(html).toContain(`'${tecla}'`);
    expect(html).toContain("bs[k].tabIndex = bs[k] === boto ? 0 : -1;");
    // I un salt per sobre dels 947 enllaços del mapa per a qui va amb el tabulador.
    expect(html).toContain('<a class="mapa-salta" href="#cobertura-capa">Salta els 947 municipis del mapa</a>');
    expect(html).toContain('<p class="nota" id="cobertura-capa" tabindex="-1">');
  });

  it("la clau d'HTML no baixa de 14 px i no hereta la «.llegenda» del full compartit", () => {
    expect(css).toMatch(/\.mapa-llegenda\{[^}]*font-size:\.9rem/);
    expect(css).toMatch(/\.mapa-clau-cap\{[^}]*font-size:\.9rem/);
    expect(html).not.toContain('class="llegenda"');
  });

  it("el llenç ocupa tota l'amplada: al mòbil, l'SVG no es queda als 300 px per defecte", () => {
    expect(css).toContain(".mapa-llenc{position:relative;width:100%;max-width:900px;margin:0 auto}");
  });
});

/**
 * La fitxa que surt en tocar un municipi amb el dit.
 *
 * Al mòbil, tocar un municipi portava directament a la seva fitxa i
 * l'etiqueta flotant no s'arribava a veure. Ara el primer toc obre una fitxa
 * petita amb el nom, la xifra i l'enllaç; el segon toc al mateix municipi hi
 * porta. El ratolí i el teclat no canvien.
 */
describe("la fitxa del municipi tocat", () => {
  const html = renderMapaCatalunya(Object.keys(geometria.municipis).map((s) => fila(s)), "2026-08-29");

  it("és al document, amagada, amb l'enllaç relatiu a la fitxa i un botó per tancar-la", () => {
    expect(html).toContain('<div class="mapa-fitxa" id="mapa-fitxa" hidden>');
    expect(html).toContain('<a class="mapa-fitxa-enllac" href="../m/">');
    expect(html).toContain('<button type="button" class="mapa-fitxa-tanca" aria-label="Tanca la fitxa">×</button>');
    // Es llegeix en obrir-se, per a qui toca amb un lector de pantalla.
    expect(html).toMatch(/<div class="mapa-fitxa" id="mapa-fitxa" hidden>\s*<div aria-live="polite">/);
  });

  it("només el dit l'obre, i el segon toc al mateix municipi segueix l'enllaç", () => {
    expect(html).toContain("tactil = e.pointerType === 'touch';");
    expect(html).toContain("if (!tactil) return;");
    expect(html).toContain("if (a === triat) return;");
    expect(html).toContain("e.preventDefault();\n  obre(a);");
    // L'enllaç de la fitxa és «../m/<slug>/», com tots els del web.
    expect(html).toContain("enllacFitxa.href = '../m/' + slug + '/';");
    // Escape la tanca, com l'etiqueta comuna.
    expect(html).toContain("if (e.key === 'Escape' && triat) tanca();");
  });

  it("amb el dit, l'etiqueta comuna no surt sota el dit a repetir el que diu la fitxa", () => {
    expect(html).toContain("if (tactil) { e.stopPropagation(); return; }");
  });

  it("el municipi triat o amb el focus porta un ressalt a sobre de tots els altres", () => {
    const dins = /<svg class="mapa947"[\s\S]*?<\/svg>/.exec(html)![0]!;
    // Després dels camins i del contorn, i abans de les claus.
    expect(dins.indexOf('<g class="mapa-ressalt" aria-hidden="true">')).toBeGreaterThan(dins.lastIndexOf("<path class=\"g"));
    expect(dins.indexOf('<g class="mapa-ressalt"')).toBeLessThan(dins.indexOf('<g class="clau-mapa"'));
    expect(html).toContain(".mapa947 a:hover path,.mapa947 a:focus-visible path{stroke-width:3.5}");
  });

  it("respecta qui demana menys moviment", () => {
    expect(html).toContain("@media (prefers-reduced-motion:reduce){.mapa947 path{transition:none}}");
    expect(html).toMatch(/\.mapa947 \.mapa-ressalt path\{[^}]*transition:none/);
  });

  it("el script del mapa es pot compilar: cap barra invertida perduda dins de la plantilla", () => {
    const script = /<script>\n(var CAPES = [\s\S]*?)<\/script>/.exec(html)![1]!;
    expect(() => new Function(script)).not.toThrow();
  });
});

/**
 * Els colors de les escales.
 *
 * Una escala seqüencial diu «més o menys» amb una sola tinta; els colors de
 * partit només marquen de qui és cada cosa; i cap color no fa de veredicte.
 */
describe("els colors de les escales", () => {
  const slugs = Object.keys(geometria.municipis);

  it("una capa amb menys graons que colors s'estén per tota la rampa, i el de dalt és el més fort", () => {
    expect(colorsDelsGraons(["a", "b", "c", "d", "e"], 3)).toEqual(["a", "c", "e"]);
    expect(colorsDelsGraons(["a", "b", "c", "d", "e"], 2)).toEqual(["a", "e"]);
    expect(colorsDelsGraons(["a", "b", "c", "d", "e"], 1)).toEqual(["c"]);
    expect(colorsDelsGraons(["a", "b", "c", "d", "e"], 5)).toEqual(["a", "b", "c", "d", "e"]);
    // El deute amb quatre-cents municipis a zero fa tres graons: el de dalt és
    // el coral més fosc, no el del mig.
    const html = renderMapaCatalunya(slugs.map((s, i) => fila(s, { d: i < 500 ? 0 : i })), "2026-08-29");
    const capes = capesDe(html);
    const i = capes.findIndex((c) => c.t.includes("Quant deu"));
    const n = capes[i]!.e.length;
    expect(n).toBeLessThan(5);
    const rampa = rampaDe("#E2735A");
    expect(html).toContain(`.mapa947[data-capa="${i}"] .g${n - 1}{fill:${rampa.clar[4]}}`);
    expect(html).toContain(`.mapa947[data-capa="${i}"] .g${n - 1}{fill:${rampa.fosc[4]}}`);
  });

  it("les capes de «sí o no» són paper i coral, prou diferents per distingir-se", () => {
    const html = renderMapaCatalunya(slugs.map((s) => fila(s)), "2026-08-29");
    const capes = capesDe(html);
    for (const titol of ["majoria absoluta", "llista més votada", "ha canviat l'alcaldia"]) {
      const i = capes.findIndex((c) => c.t.includes(titol));
      expect(html, titol).toContain(`.mapa947[data-capa="${i}"] .g0{fill:var(--paper-2)}`);
      expect(html, titol).toContain(`.mapa947[data-capa="${i}"] .g1{fill:var(--coral)}`);
    }
  });

  it("la renda no és verda: un verd al costat del deute coral diria «bé» i «malament»", () => {
    const html = renderMapaCatalunya(slugs.map((s, i) => fila(s, { rn: 10_000 + i, ra: 2023 })), "2026-08-29");
    const i = capesDe(html).findIndex((c) => c.t.includes("entren a les cases"));
    const regla = new RegExp(`\\.mapa947\\[data-capa="${i}"\\] \\.g4\\{fill:(#[0-9a-f]{6})\\}`).exec(html)![1]!;
    expect(regla).not.toBe(rampaDe("#2E8B57").clar[4]);
    const [r, g, b] = [1, 3, 5].map((k) => parseInt(regla.slice(k, k + 2), 16));
    expect(g!).toBeLessThan(Math.max(r!, b!));
  });

  it("les etiquetes de les capes de xifres són intervals", () => {
    const html = renderMapaCatalunya(slugs.map((s, i) => fila(s, { d: i * 3 })), "2026-08-29");
    const deute = capesDe(html).find((c) => c.t.includes("Quant deu"))!;
    expect(deute.e[0]).toMatch(/^menys de [\d.]+ €$/);
    expect(deute.e[1]).toMatch(/^de [\d.]+ € a [\d.]+ €$/);
    expect(deute.e[deute.e.length - 1]).toMatch(/^[\d.]+ € o més$/);
  });

  it("l'any de la clau surt de les files quan cada municipi porta el seu", () => {
    const html = renderMapaCatalunya(slugs.map((s, i) => fila(s, { pa: 1 + i / 100, paa: i % 2 ? 2023 : 2024 })), "2026-08-29");
    const aigua = capesDe(html).find((c) => c.t.includes("costa l'aigua"))!;
    expect(aigua.q).toBe("€/m³, consum de 12 m³ al mes · 2023-2024 · Font: Agència Catalana de l'Aigua");
  });
});
