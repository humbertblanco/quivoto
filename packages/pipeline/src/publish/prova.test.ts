import { describe, expect, it } from "vitest";
import { DESCRIPCIO_MAXIMA, TITOL_MAXIM } from "./seo";
import { vi } from "vitest";
import { validaConjunt, type Afirmacio } from "./llindar";
import type { ConjuntAmbSlug } from "./preguntes";
import { renderProva } from "./prova";

/**
 * La demostració vivia amb una capçalera pròpia i un camí absolut, i un peu
 * d'una línia. Aquí es comprova que ara duu la capa compartida des de tres
 * nivells avall, i que el peu porta a la fitxa del poble.
 */

const ACTA = "https://media.seu-e.cat/acteca/810210001/2025/acta-ple-12-03-2025.pdf";

function conjunt(): ConjuntAmbSlug {
  const afirmacions: Afirmacio[] = Array.from({ length: 4 }, (_, i) => ({
    tema: "habitatge",
    text: `L'Ajuntament ha de fer la cosa número ${i}.`,
    evidencia: "Ple de 12 de març de 2025, acord núm. 4: aprovat amb 13 vots a favor i 8 en contra.",
    posicio_govern: i % 2 === 0 ? "acord" : "desacord",
    url_evidencia: ACTA,
  }));
  const base = { municipi: "Poble de Prova", afirmacions };
  return { ...base, slug: "poble-de-prova", veredicte: validaConjunt(base), citesFallides: [] };
}

describe("renderProva", () => {
  const html = renderProva(conjunt(), [], [], "30 d'agost del 2026");

  it("porta la capçalera, el cercador i un sol peu compartits", () => {
    expect(html.match(/<footer class="peu">/g)).toHaveLength(1);
    expect(html).toContain('<nav class="menu"');
    expect(html).toContain('<dialog class="cercador"');
    expect(html).not.toContain('<a class="logo" href="/observatori/">Observatori</a>');
    expect(html).toContain("Generat el 30 d'agost del 2026");
  });

  it("resol els camins des de tres nivells avall", () => {
    expect(html).toContain('href="../../../../assets/fonts.css"');
    expect(html.indexOf("fonts.css")).toBeLessThan(html.indexOf("<style>"));
    expect(html).toContain('href="../../../mapa/"');
    expect(html).toContain('href="../../../../avis-legal.html"');
  });

  it("enllaça la fitxa del poble des del peu", () => {
    expect(html).toContain('<a class="propi" href="../../../m/poble-de-prova/">La fitxa de Poble de Prova</a>');
  });

  it("continua sent la demostració sencera, amb el guió i les afirmacions", () => {
    expect(html).toContain('<button class="boto-prova" id="comenca">Comença</button>');
    expect(html).toContain("const D = [");
    expect(html).toContain("cosa número 0");
    expect(html.trimEnd().endsWith("</html>")).toBe(true);
  });

  it("no fa desaparèixer cap grup del ple quan encara no en sap deduir la posició", () => {
    const grups = [
      { nom: "Govern", sigles: "GOV", escons: 7, govern: true, color: "#123456" },
      { nom: "Oposició sense vot citable", sigles: "OSC", escons: 2, govern: false, color: null },
    ];
    const ambGrups = renderProva(conjunt(), grups, [], "30 d'agost del 2026");
    expect(ambGrups).toContain('"nom":"Govern"');
    expect(ambGrups).toContain('"nom":"Oposició sense vot citable"');
    expect(ambGrups).toContain("Sense prou dades");
  });
});

describe("el cap SEO de la demostració", () => {
  const titolDe = (html: string): string => /<title>([^<]*)<\/title>/.exec(html)![1]!;
  const descripcioDe = (html: string): string => /<meta name="description" content="([^"]*)"/.exec(html)![1]!;
  const jsonLdDe = (html: string): Record<string, unknown>[] =>
    [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1]!));
  const filDe = (html: string): { name: string; item: string }[] =>
    (jsonLdDe(html).find((o) => o["@type"] === "BreadcrumbList")!.itemListElement as { name: string; item: string }[]);

  const html = renderProva(conjunt(), [], [], "avui");

  it("diu quantes preguntes i de quin poble, i té canònica", () => {
    expect(titolDe(html)).toBe("Respon 4 preguntes sobre Poble de Prova · quivoto");
    expect(descripcioDe(html)).toBe(
      "Respon 4 preguntes sobre Poble de Prova i mira amb quin grup del ple coincideixes més. Cada una porta el ple on es va votar. És una demostració.",
    );
    expect(html).toContain('<link rel="canonical" href="https://quivoto.cat/observatori/preguntes/poble-de-prova/prova/">');
  });

  it("no s'indexa mai, ni quan l'Observatori s'obre: és un esborrany editorial", async () => {
    expect(html).toContain('<meta name="robots" content="noindex,nofollow">');
    vi.stubEnv("QUIVOTO_INDEXABLE", "1");
    vi.resetModules();
    const obert = await import("./prova");
    expect(obert.renderProva(conjunt(), [], [], "avui")).toContain('<meta name="robots" content="noindex,nofollow">');
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("porta el fil d'Ariadna de quatre esglaons, passant pel conjunt", () => {
    expect(filDe(html).map((i) => i.name)).toEqual(["quivoto", "Observatori municipal", "Preguntes per municipi", "Poble de Prova", "Respon les preguntes"]);
    expect(filDe(html)[3]!.item).toBe("https://quivoto.cat/observatori/preguntes/poble-de-prova/");
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
