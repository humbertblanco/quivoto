import { describe, expect, it } from "vitest";
import { DESCRIPCIO_MAXIMA, TITOL_MAXIM } from "./seo";
import { vi } from "vitest";
import { validaConjunt, type Afirmacio } from "./llindar";
import { renderIndexPreguntes, renderPreguntes, type ConjuntAmbSlug } from "./preguntes";

/**
 * Les preguntes i la seva portada eren les úniques pàgines del web amb una
 * capçalera i un peu propis: des d'aquí no es podia anar enlloc. El que es
 * comprova és que ara duen la capa compartida —una sola vegada— amb els camins
 * del nivell que els toca, i que els enllaços propis de cada pàgina hi són
 * només quan el seu destí existeix.
 */

const ACTA = "https://media.seu-e.cat/acteca/810210001/2025/acta-ple-12-03-2025.pdf";

function afirmacio(i: number, url: string | undefined): Afirmacio {
  const temes = ["fiscalitat", "fiscalitat", "fiscalitat", "habitatge", "habitatge", "habitatge", "mobilitat", "mobilitat", "mobilitat", "seguretat", "seguretat", "seguretat", "urbanisme", "urbanisme", "urbanisme", "cultura", "cultura", "educació", "educació", "participació"];
  return {
    tema: temes[i] ?? "participació",
    text: `L'Ajuntament ha de fer la cosa número ${i}.`,
    evidencia: "Ple de 12 de març de 2025, acord núm. 4: aprovat amb 13 vots a favor i 8 en contra.",
    posicio_govern: i % 2 === 0 ? "acord" : "desacord",
    url_evidencia: url,
  };
}

/** Un conjunt que s'aguanta en actes (jugable) o en premsa (no jugable). */
function conjunt(ambActes: boolean): ConjuntAmbSlug {
  const afirmacions = Array.from({ length: 20 }, (_, i) =>
    afirmacio(i, ambActes ? ACTA : "https://www.diari.cat/noticia"),
  );
  const base = { municipi: "Poble de Prova", afirmacions };
  return { ...base, slug: "poble-de-prova", veredicte: validaConjunt(base), citesFallides: [] };
}

describe("renderPreguntes", () => {
  const jugable = renderPreguntes(conjunt(true), "30 d'agost del 2026");
  const noJugable = renderPreguntes(conjunt(false), "30 d'agost del 2026");

  it("porta la capçalera, el cercador i un sol peu compartits", () => {
    expect(jugable.match(/<footer class="peu">/g)).toHaveLength(1);
    expect(jugable).toContain('<nav class="menu"');
    expect(jugable).toContain('<dialog class="cercador"');
    expect(jugable).not.toContain('<a class="logo" href="/observatori/">Observatori</a>');
    expect(jugable).toContain("Generat el 30 d'agost del 2026");
  });

  it("resol els camins des de dos nivells avall", () => {
    expect(jugable).toContain('href="../../../assets/fonts.css"');
    expect(jugable.indexOf("fonts.css")).toBeLessThan(jugable.indexOf("<style>"));
    expect(jugable).toContain('href="../../mapa/"');
    expect(jugable).toContain('href="../../../avis-legal.html"');
  });

  it("enllaça la demostració des del peu només quan existeix", () => {
    expect(jugable).toContain('<a class="propi" href="prova/">Respon les preguntes</a>');
    expect(noJugable).not.toContain("Respon les preguntes");
    expect(noJugable).not.toContain('href="prova/"');
  });

  it("enllaça la fitxa del poble des del peu, i sempre", () => {
    for (const html of [jugable, noJugable]) {
      expect(html).toContain('<a class="propi" href="../../m/poble-de-prova/">La fitxa de Poble de Prova</a>');
    }
  });

  it("la pastilla del govern porta a l'evidència de la mateixa targeta", () => {
    // La posició del govern no és una dada: es dedueix de l'evidència que hi
    // ha més avall a la mateixa targeta, i la pastilla ho ha de dir.
    expect(jugable).toContain('<a class="govern" href="#evidencia-1" title="Segons l\'evidència d\'aquesta mateixa targeta">el govern hi és acord</a>');
    expect(jugable).toContain('<dd id="evidencia-1">');
    expect(jugable).toContain('<a class="govern" href="#evidencia-2"');
    expect(jugable).toContain('<dd id="evidencia-2">');
  });

  it("el bloc «Segueix estirant» es queda només amb el que és d'aquesta pàgina", () => {
    expect(jugable).not.toContain("Les altres proves");
    expect(jugable).toContain("<b>La fitxa de Poble de Prova</b>");
    expect(jugable).toContain("<b>Respon les preguntes</b>");
    expect(noJugable).not.toContain("<b>Respon les preguntes</b>");
  });
});

describe("renderIndexPreguntes", () => {
  const html = renderIndexPreguntes([conjunt(true), conjunt(false)], "30 d'agost del 2026");

  it("porta la capçalera, el cercador i un sol peu, a un nivell", () => {
    expect(html.match(/<footer class="peu">/g)).toHaveLength(1);
    expect(html).toContain('<nav class="menu"');
    expect(html).toContain('<dialog class="cercador"');
    expect(html).toContain('href="../../assets/fonts.css"');
    expect(html).toContain('href="../mapa/"');
  });

  it("enllaça la demostració només dels conjunts que superen tots dos llindars", () => {
    expect(html).toContain('href="poble-de-prova/"');
    expect(html).toContain('href="poble-de-prova/prova/"');
    expect(html).toContain("En revisió");
  });

  it("enllaça la fitxa municipal de cada municipi, no només les seves preguntes", () => {
    expect(html).toContain('<a class="prova-enllac" href="../m/poble-de-prova/">La fitxa de Poble de Prova →</a>');
    // La targeta és només l'enllaç al conjunt; les pastilles de sota no la
    // poden heretar, que és el que passava amb «.llista-municipis a».
    expect(html).toContain('<a class="conjunt" href="poble-de-prova/">');
    expect(html).toContain(".llista-municipis a.conjunt{");
    expect(html).not.toContain(".llista-municipis a{");
  });
});

describe("el cap SEO de les preguntes", () => {
  const titolDe = (html: string): string => /<title>([^<]*)<\/title>/.exec(html)![1]!;
  const descripcioDe = (html: string): string => /<meta name="description" content="([^"]*)"/.exec(html)![1]!;
  const jsonLdDe = (html: string): Record<string, unknown>[] =>
    [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1]!));
  const filDe = (html: string): { name: string; item: string }[] =>
    (jsonLdDe(html).find((o) => o["@type"] === "BreadcrumbList")!.itemListElement as { name: string; item: string }[]);

  const jugable = renderPreguntes(conjunt(true), "avui");
  const noJugable = renderPreguntes(conjunt(false), "avui");
  const index = renderIndexPreguntes([conjunt(true), conjunt(false)], "avui");

  it("l'índex compta els municipis i quants es poden respondre", () => {
    expect(titolDe(index)).toBe("Preguntes per municipi · quivoto");
    expect(descripcioDe(index)).toBe(
      "Les preguntes que la brúixola de quivoto faria a 2 municipis de Catalunya, en esborrany i amb l'evidència de cadascuna: 1 ja es poden respondre.",
    );
    expect(index).toContain('<link rel="canonical" href="https://quivoto.cat/observatori/preguntes/">');
    expect(filDe(index).map((i) => i.name)).toEqual(["quivoto", "Observatori municipal", "Preguntes per municipi"]);
  });

  it("el conjunt d'un municipi diu quantes preguntes i quantes lligades a una votació", () => {
    expect(titolDe(jugable)).toBe("20 preguntes sobre Poble de Prova · quivoto");
    expect(descripcioDe(jugable)).toMatch(/^Les 20 preguntes que la brúixola de quivoto faria a Poble de Prova, en esborrany i amb l'evidència de cadascuna: \d+ lligades a una votació del ple\.$/);
    expect(jugable).toContain('<link rel="canonical" href="https://quivoto.cat/observatori/preguntes/poble-de-prova/">');
    expect(filDe(jugable).map((i) => i.name)).toEqual(["quivoto", "Observatori municipal", "Preguntes per municipi", "Poble de Prova"]);
  });

  it("el conjunt «en revisió» porta noindex encara que l'Observatori s'obri; el que es pot respondre, no", async () => {
    vi.stubEnv("QUIVOTO_INDEXABLE", "1");
    vi.resetModules();
    const obert = await import("./preguntes");
    expect(obert.renderPreguntes(conjunt(false), "avui")).toContain('<meta name="robots" content="noindex,nofollow">');
    expect(obert.renderPreguntes(conjunt(true), "avui")).toContain('<meta name="robots" content="index,follow,max-image-preview:large">');
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("mentre l'Observatori no s'obri, tots dos porten noindex", () => {
    expect(jugable).toContain('content="noindex,nofollow"');
    expect(noJugable).toContain('content="noindex,nofollow"');
  });

  for (const [nom, html] of [["l'índex", index], ["el conjunt", jugable]] as const) {
    it(`${nom}: el títol i la descripció caben, i té un sol <h1>`, () => {
      expect(titolDe(html).length).toBeLessThanOrEqual(TITOL_MAXIM);
      expect(descripcioDe(html).length).toBeLessThanOrEqual(DESCRIPCIO_MAXIMA);
      expect(descripcioDe(html).length).toBeGreaterThanOrEqual(70);
      expect(descripcioDe(html)).not.toMatch(/…$/);
      expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    });
  }
});
