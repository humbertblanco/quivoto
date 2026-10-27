import { describe, expect, it } from "vitest";
import { cara, inicials } from "./cara";
import { RADIOGRAFIA_CSS } from "./estil";

/**
 * La cara que comparteixen la portada, la fitxa municipal, les comarques, els
 * partits, els ens i les fitxes de persona. El que es prova aquí és el
 * contracte que aquestes pàgines donen per fet: la mateixa mida amb foto o
 * sense, i un retrat que és un <img> sol.
 */

describe("cara: el retrat i les inicials", () => {
  it("amb foto, un <img> sol: sense capa d'inicials al voltant ni al costat", () => {
    const html = cara("Marta Farrés Falgueras", "/observatori/fotos/160/1.webp", { mida: 40, color: "#d00c3c" });
    expect(html).toBe(
      '<img class="cara-alcaldia petita" style="--mida:40px;" src="/observatori/fotos/160/1.webp" alt="" width="40" height="40" loading="lazy">',
    );
    // La fitxa del regidor hi apila les seves pròpies inicials a sota: si
    // aquesta funció n'hi afegís unes altres, allà en sortirien dues.
    expect(html).not.toContain("MF");
    expect(html).not.toContain("inicials");
  });

  it("sense foto, les inicials sobre el color de la força, a la mateixa mida", () => {
    const html = cara("Marta Farrés Falgueras", null, { mida: 40, color: "#d00c3c" });
    expect(html).toMatch(
      /^<span class="cara-alcaldia inicials petita" style="--mida:40px;--c:#d00c3c;--t:#[0-9a-fA-F]{6}" aria-hidden="true">MF<\/span>$/,
    );
  });

  it("la mida per defecte és la de la fitxa (52 px) i no escriu cap --mida", () => {
    expect(cara("Pere", "/f.webp")).toBe(
      '<img class="cara-alcaldia" style="" src="/f.webp" alt="" width="52" height="52" loading="lazy">',
    );
  });

  it("escapa el nom i el camí de la foto", () => {
    expect(cara("<b>", null)).toContain("&lt;");
    expect(cara("X", '/f.webp" onerror="x')).toContain('src="/f.webp&quot; onerror=&quot;x"');
  });

  it("les inicials són les de les dues primeres paraules", () => {
    expect(inicials("Marta Farrés Falgueras")).toBe("MF");
    expect(inicials("  joan  ")).toBe("J");
  });
});

describe("cara: mai un cercle blanc buit", () => {
  /**
   * El retrat va amb «loading=lazy» i, fins que arriba, el cercle es quedava
   * blanc. El fons del <img> (i només del <img>: les inicials ja porten el seu
   * color) dibuixa una silueta amb el gris dels filets, que la foto tapa.
   */
  it("el retrat porta de fons una silueta, no el blanc del paper", () => {
    const regla = RADIOGRAFIA_CSS.match(/(?:^|[\s}])img\.cara-alcaldia\{([^}]*)\}/)?.[1] ?? "";
    expect(regla).toContain("radial-gradient(");
    expect(regla).toContain("var(--vora)");
    expect(regla.trim().endsWith("var(--paper-2)")).toBe(true);
  });
});
