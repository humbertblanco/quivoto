import { describe, expect, it } from "vitest";
import { ordena, quiManaMes, renderComarquesIndex, type ComarcaFila } from "./comarques-index";

/**
 * Comarques de mostra. Les xifres són versemblants i no són les de ningú: aquí
 * es prova què diu la pàgina amb unes dades, no quantes alcaldies té ERC al
 * Bages.
 */
function comarca(canvis: Partial<ComarcaFila> = {}): ComarcaFila {
  return {
    slug: "bages",
    name: "Bages",
    municipis: 30,
    habitants: 180_000,
    forces: [
      { brandId: "erc", label: "ERC", color: "#ffb232", alcaldies: 14 },
      { brandId: "junts", label: "Junts", color: "#00c4b3", alcaldies: 11 },
      { brandId: "sense-identificar", label: "Sense identificar", color: "#8b8b8b", alcaldies: 5 },
    ],
    pacte: 4,
    canvisAlcaldia: 2,
    ...canvis,
  };
}

const MOSTRA: ComarcaFila[] = [
  comarca(),
  comarca({
    slug: "barcelones",
    name: "Barcelonès",
    municipis: 5,
    habitants: 2_300_000,
    forces: [{ brandId: "psc", label: "PSC", color: "#d00c3c", alcaldies: 4 }],
    pacte: 1,
    canvisAlcaldia: 0,
  }),
  comarca({
    slug: "alta-ribagorca",
    name: "Alta Ribagorça",
    municipis: 3,
    habitants: 4_000,
    forces: [
      { brandId: "sense-identificar", label: "Sense identificar", color: "#8b8b8b", alcaldies: 3 },
    ],
    pacte: 0,
    canvisAlcaldia: 0,
  }),
];

describe("ordena", () => {
  it("posa davant la comarca amb més habitants, com els 947", () => {
    expect(ordena(MOSTRA).map((c) => c.name)).toEqual(["Barcelonès", "Bages", "Alta Ribagorça"]);
  });

  it("no toca la llista que rep", () => {
    const original = [...MOSTRA];
    ordena(MOSTRA);
    expect(MOSTRA).toEqual(original);
  });
});

describe("quiManaMes", () => {
  it("salta el calaix dels que no s'han pogut identificar", () => {
    const mana = quiManaMes([
      { brandId: "sense-identificar", label: "Sense identificar", color: "#8b8b8b", alcaldies: 9 },
      { brandId: "junts", label: "Junts", color: "#00c4b3", alcaldies: 8 },
    ]);
    expect(mana?.primera.label).toBe("Junts");
    expect(mana?.empat).toBeNull();
  });

  it("diu l'empat quan n'hi ha, que ensenyar-ne una diria que guanya", () => {
    const mana = quiManaMes([
      { brandId: "erc", label: "ERC", color: "#ffb232", alcaldies: 6 },
      { brandId: "junts", label: "Junts", color: "#00c4b3", alcaldies: 6 },
      { brandId: "psc", label: "PSC", color: "#d00c3c", alcaldies: 2 },
    ]);
    expect(mana?.primera.label).toBe("ERC");
    expect(mana?.empat?.label).toBe("Junts");
  });

  it("torna null quan no hi ha cap força identificada", () => {
    expect(quiManaMes([])).toBeNull();
    expect(
      quiManaMes([{ brandId: "sense-identificar", label: "Sense identificar", color: "#8b8b8b", alcaldies: 3 }]),
    ).toBeNull();
  });
});

describe("renderComarquesIndex", () => {
  const html = renderComarquesIndex(MOSTRA, "30 d'agost del 2026", { municipis: 36, comarques: 4 });

  it("porta la capçalera amb «Comarques» com a lloc actual, el cercador i el peu, tot a un nivell", () => {
    expect(html).toContain('<span class="ara" aria-current="page">Comarques</span>');
    expect(html).toContain('href="../mapa/"');
    expect(html).toContain('<dialog class="cercador"');
    expect(html.match(/<footer class="peu">/g)).toHaveLength(1);
    expect(html).toContain("Generat el 30 d'agost del 2026");
    expect(html.trimEnd().endsWith("</html>")).toBe(true);
  });

  it("enllaça les tipografies des d'un nivell avall", () => {
    expect(html).toContain('href="../../assets/fonts.css"');
    expect(html.indexOf("fonts.css")).toBeLessThan(html.indexOf("<style>"));
  });

  it("enllaça cada comarca a la seva pàgina, que penja d'aquest mateix directori", () => {
    expect(html).toContain('<a href="bages/">Bages</a>');
    expect(html).toContain('<a href="barcelones/">Barcelonès</a>');
    expect(html).toContain('<a href="alta-ribagorca/">Alta Ribagorça</a>');
  });

  it("compta les comarques al títol i no escriu 43 a mà", () => {
    expect(html).toContain("<h1>Les 3 comarques</h1>");
    expect(html).toContain("3 comarques, 38 municipis i 2.484.000 habitants");
  });

  it("posa la força amb més alcaldies com a pastilla de dades, amb quantes de quantes", () => {
    expect(html).toContain('class="sigla" style="--c:');
    expect(html).toContain("14 de 30");
    // ERC té pàgina: la pastilla hi porta.
    expect(html).toContain('href="../partit/erc/"');
  });

  it("diu que no se sap qui mana on no s'ha identificat cap alcaldia", () => {
    const fila = html.slice(html.indexOf("Alta Ribagorça"), html.indexOf("</tr>", html.indexOf("Alta Ribagorça")));
    expect(fila).toContain("sense identificar");
    expect(fila).not.toContain('class="sigla"');
  });

  it("tanca la taula amb tot Catalunya, sumat i no escrit", () => {
    const peu = html.slice(html.indexOf("<tfoot>"), html.indexOf("</tfoot>"));
    expect(peu).toContain("Catalunya");
    expect(peu).toContain("<td>38</td>");
    expect(peu).toContain("<td>2.484.000</td>");
    // ERC suma 14 a tot el país i mana més que el PSC (4) i que Junts (11).
    expect(peu).toContain("14 de 38");
    expect(peu).toContain("<td>5</td>"); // pactes: 4 + 1 + 0
    expect(peu).toContain("<td>2</td>"); // canvis: 2 + 0 + 0
  });

  it("enllaça l'Àrea Metropolitana amb el que en sabem, i no si no s'ha publicat", () => {
    expect(html).toContain('href="../amb/"');
    expect(html).toContain("36 municipis de 4 comarques");
    const sense = renderComarquesIndex(MOSTRA, "avui", null);
    expect(sense).not.toContain("Àrea Metropolitana, ");
  });

  it("diu que no hi ha res quan no hi ha res, en comptes d'una taula buida", () => {
    const buit = renderComarquesIndex([], "avui");
    expect(buit).toContain("Encara no hi ha cap comarca publicada");
    expect(buit).not.toContain("<table");
    expect(buit).toContain("</html>");
  });

  it("escapa el que ve de la base de dades", () => {
    const dolent = renderComarquesIndex([comarca({ name: 'Bages <script>alert("ep")</script>' })], "avui");
    expect(dolent).not.toContain("<script>alert");
    expect(dolent).toContain("&lt;script&gt;");
  });
});
