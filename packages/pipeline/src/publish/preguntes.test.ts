import { describe, expect, it } from "vitest";
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
  return {
    tema: "habitatge",
    text: `L'Ajuntament ha de fer la cosa número ${i}.`,
    evidencia: "Ple de 12 de març de 2025, acord núm. 4: aprovat amb 13 vots a favor i 8 en contra.",
    posicio_govern: i % 2 === 0 ? "acord" : "desacord",
    url_evidencia: url,
  };
}

/** Un conjunt que s'aguanta en actes (jugable) o en premsa (no jugable). */
function conjunt(ambActes: boolean): ConjuntAmbSlug {
  const afirmacions = Array.from({ length: 4 }, (_, i) =>
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

  it("enllaça cada conjunt i la seva demostració", () => {
    expect(html).toContain('href="poble-de-prova/"');
    expect(html).toContain('href="poble-de-prova/prova/"');
  });
});
