import { describe, expect, it } from "vitest";
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
    expect(html).toContain('<button class="gros" id="comenca">Comença</button>');
    expect(html).toContain("const D = [");
    expect(html).toContain("cosa número 0");
    expect(html.trimEnd().endsWith("</html>")).toBe(true);
  });
});
