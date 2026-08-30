import { describe, expect, it } from "vitest";
import { geometria, renderMapaCatalunya } from "./mapa-catalunya";
import type { Els947Row } from "./els947";

const fila = (s: string, extra: Partial<Els947Row> = {}): Els947Row => ({
  s, n: s, c: "una comarca", p: 1000, r: 11,
  a: null, g: null, ar: null, ac: null, w: 1, m: 0, k: 0, t: 0,
  d: 100, e: 5, f: 40, v: 1, q: 12, y: 60, o: 0,
  b: null, pt: 60, pe: 10, pa: 1.5,
  ...extra,
});

/** Les capes tal com arriben al navegador, que és on es pot comprovar què pinten. */
const capesDe = (html: string): { t: string; g: string; e: string[]; n: number; m: string }[] =>
  JSON.parse(/var CAPES = (\[[\s\S]*?\]);\nvar camins/.exec(html)![1]!) as never;

const infoDe = (html: string): [string, number, string, string, string][] =>
  JSON.parse(/var INFO = (\[[\s\S]*?\]);\nvar ullada/.exec(html)![1]!) as never;

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
    // I la fitxa flotant ha de dir el mateix color, no un altre.
    expect(infoDe(html)[posicio("prat-de-llobregat")]![4]).toBe("#662483");
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
    expect(html).toMatch(/<ul class="llegenda" id="llegenda" data-capa="0">\s*<li>/);
  });

  it("no la sent dues vegades qui llegeix amb veu", () => {
    expect(html).toMatch(/<g class="clau-mapa" data-clau="0" aria-hidden="true">/);
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
    expect(html).toMatch(/\.llegenda \.gnd\{background:repeating-linear-gradient/);
  });
});

/**
 * Les capes que arriben de mètriques que la fila dels 947 encara no porta.
 *
 * Mentre `loadEls947()` no escrigui `rn` i `sa`, les dues capes no tenen dada
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
    const amb = slugs.map((s, i) =>
      Object.assign(fila(s), { rn: 12_000 + i * 10, sa: i % 3 === 0 ? null : 30_000 + i }),
    );
    const html = renderMapaCatalunya(amb, "2026-08-29");
    expect(html).toContain("Renda per persona");
    expect(html).toContain("Sou de l'alcaldia");
    expect(html).toContain("Atlas de distribución de renta");
    expect(html).toContain("Ministeri per a la Transformació Digital");
    // La cobertura de cada capa arriba al navegador: els 947 tenen renda i dos
    // terços tenen sou, i el mapa ho ha de poder dir.
    const capes = capesDe(html);
    expect(capes.find((c) => c.t.includes("entren a les cases"))!.n).toBe(947);
    expect(capes.find((c) => c.t.includes("cobra l'alcaldia"))!.n).toBe(
      amb.filter((f) => (f as { sa: number | null }).sa !== null).length,
    );
  });

  it("la descripció de la pàgina només promet les capes que hi són", () => {
    const html = renderMapaCatalunya(slugs.map((s) => fila(s)), "2026-08-29");
    const descripcio = /<meta name="description" content="([^"]*)"/.exec(html)![1]!;
    expect(descripcio).toContain("qui mana");
    expect(descripcio).not.toContain("renda per persona");
  });
});
