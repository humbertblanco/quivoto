import { describe, expect, it } from "vitest";
import { ordena, renderPartitsIndex, type PartitFila } from "./partits-index";

/**
 * Marques de mostra. Les xifres són versemblants i no són les de ningú: aquí es
 * prova què diu la pàgina amb unes dades, no quantes alcaldies té ERC.
 */
function marca(canvis: Partial<PartitFila> = {}): PartitFila {
  return {
    id: "erc",
    sigles: "ERC",
    nom: "Esquerra Republicana de Catalunya",
    color: "#ffb232",
    alcaldies: 330,
    regidories: 2_400,
    poblacioGovernada: 1_200_000,
    ...canvis,
  };
}

const MOSTRA: PartitFila[] = [
  marca(),
  marca({ id: "junts", sigles: "Junts", nom: "Junts per Catalunya", color: "#00c4b3", alcaldies: 329, regidories: 2_300, poblacioGovernada: 1_100_000 }),
  marca({ id: "psc", sigles: "PSC", nom: "Partit dels Socialistes de Catalunya", color: "#d00c3c", alcaldies: 125, regidories: 1_450, poblacioGovernada: 3_100_000 }),
  marca({ id: "cs", sigles: "Ciutadans", nom: "Ciutadans", color: "#eb6109", alcaldies: 0, regidories: 40, poblacioGovernada: 0 }),
];

const CATALUNYA = 7_901_963;

describe("ordena", () => {
  it("posa davant qui té més alcaldies", () => {
    expect(ordena(MOSTRA).map((p) => p.sigles)).toEqual(["ERC", "Junts", "PSC", "Ciutadans"]);
  });

  it("desempata amb les regidories, que és el que separa dues marques sense cap alcaldia", () => {
    const sense = [
      marca({ id: "vox", sigles: "Vox", alcaldies: 0, regidories: 60 }),
      marca({ id: "cs", sigles: "Ciutadans", alcaldies: 0, regidories: 120 }),
    ];
    expect(ordena(sense).map((p) => p.sigles)).toEqual(["Ciutadans", "Vox"]);
  });

  it("no toca la llista que rep", () => {
    const original = [...MOSTRA];
    ordena(MOSTRA);
    expect(MOSTRA).toEqual(original);
  });
});

describe("renderPartitsIndex", () => {
  const html = renderPartitsIndex(MOSTRA, CATALUNYA, "2026-08-30T10:00:00.000Z");

  it("porta la capçalera, el cercador i el peu amb la base d'un nivell", () => {
    expect(html).toContain('href="../"');
    expect(html).toContain("cerca.json");
    expect(html).toContain("</html>");
  });

  it("enllaça les tipografies des d'un nivell avall, abans del full d'estil", () => {
    expect(html).toContain('href="../../assets/fonts.css"');
    expect(html.indexOf("fonts.css")).toBeLessThan(html.indexOf("<style>"));
  });

  /**
   * «D'on surten els que manen» no és al menú ni al peu de sempre: hi porten
   * la portada i les pàgines de partit. Sense això, la pàgina de trajectòria
   * només es trobava des de la portada.
   */
  it("el peu porta a d'on surten els que manen", () => {
    expect(html).toContain('<a class="propi" href="../trajectoria/">D\'on surten els que manen</a>');
  });

  it("enllaça cada marca a la seva pàgina, que penja d'aquest mateix directori", () => {
    expect(html).toContain('href="erc/"');
    expect(html).toContain('href="psc/"');
    expect(html).toContain('href="cs/"');
  });

  /*
   * El motiu de la pàgina: 330 + 329 + 125 = 784 de 947, i les 163 que falten no
   * són de cap marca. Si el dibuix repartís només 784 diria que els partits es
   * reparteixen tot Catalunya, que és exactament el que no volem que digui.
   */
  it("dibuixa el tros que no és de cap marca i diu quantes alcaldies són", () => {
    expect(html).toContain("px-resta");
    expect(html).toContain("Llistes locals i partits sense pàgina");
    expect(html).toContain("163");
  });

  it("reparteix sobre 947 i no sobre la suma de les marques", () => {
    // Amb 784 de 947, ERC és el 35 % del total i seria el 42 % si el dibuix
    // només comptés les marques.
    expect(html).toContain("<em>35 %</em>");
    expect(html).not.toContain("<em>42 %</em>");
  });

  it("no dibuixa requadre a qui no té cap alcaldia, però sí que la posa a la llista", () => {
    const trossos = html.match(/class="px-tros/g) ?? [];
    expect(trossos).toHaveLength(4); // tres marques amb alcaldia i el tros de ningú
    expect(html).toContain("Ciutadans");
    expect(html).toContain("cap: tot oposició");
  });

  it("cada requadre porta el color de la marca i una tinta que s'hi llegeix", () => {
    expect(html).toContain("--c:#ffb232");
    expect(html).toContain("--c:#d00c3c");
    // El groc d'ERC demana tinta fosca i el vermell del PSC, clara.
    expect(html).toContain("--c:#ffb232;--t:#1E1B2E");
    expect(html).toContain("--c:#d00c3c;--t:#FBF7EE");
  });

  it("posa el percentatge de població de Catalunya, que és el que fa comparables les marques", () => {
    // 3.100.000 de 7.901.963 habitants.
    expect(html).toContain("39,2 % de Catalunya");
  });

  it("no es queda amb un color inventat de la base de dades", () => {
    const brut = renderPartitsIndex([marca({ color: "vermellet" })], CATALUNYA, "2026-08-30");
    expect(brut).toContain("--c:#8b8b8b");
    expect(brut).not.toContain("vermellet");
  });

  it("no dibuixa trossos negatius si les marques passessin de 947", () => {
    const impossible = renderPartitsIndex([marca({ alcaldies: 1_000 })], CATALUNYA, "2026-08-30");
    expect(impossible).not.toContain("--w:-");
    expect(impossible).not.toContain("--h:-");
  });

  it("aguanta una llista buida sense petar", () => {
    const buit = renderPartitsIndex([], CATALUNYA, "2026-08-30");
    expect(buit).toContain("</html>");
    expect(buit).toContain("947");
  });

  it("escapa el que ve de la base de dades", () => {
    const dolent = renderPartitsIndex(
      [marca({ nom: 'Partit <script>alert("ep")</script>' })],
      CATALUNYA,
      "2026-08-30",
    );
    expect(dolent).not.toContain("<script>alert");
    expect(dolent).toContain("&lt;script&gt;");
  });
});
