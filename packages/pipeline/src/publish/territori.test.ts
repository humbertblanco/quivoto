import { describe, expect, it } from "vitest";
import {
  renderBlocsPoder, renderCanvis, renderPactes, renderRepartiment,
  type DadesPoder, type MunicipiPoder,
} from "./territori";

/**
 * Els blocs que comparteixen la comarca i l'AMB. El que s'ha de provar és el
 * que va fer que existissin com a mòdul: que les dues pàgines diguin el mateix
 * amb les paraules del seu àmbit, que cada enllaç surti del nivell correcte
 * —dos amunt a la comarca, un a l'AMB— i que la pastilla del partit hi sigui
 * als dos llocs, que a l'AMB abans era text pla.
 */

function municipi(over: Partial<MunicipiPoder> = {}): MunicipiPoder {
  return {
    slug: "un-poble", name: "un Poble",
    mayorSigles: "ERC-AM", mayorBrandId: "erc",
    winnerSigles: "ERC-AM", winnerGoverns: true,
    mayorChanged: false, mayorChangeName: null, mayorChangeDate: null,
    ...over,
  };
}

function dades(over: Partial<DadesPoder> = {}): DadesPoder {
  const municipis = over.municipis ?? [municipi()];
  return {
    governaMesVotat: municipis.filter((m) => m.winnerGoverns === true).length,
    pacte: municipis.filter((m) => m.winnerGoverns === false).length,
    senseIdentificar: municipis.filter((m) => m.winnerGoverns === null).length,
    majoriaAbsoluta: 1,
    ...over,
    municipis,
  };
}

const COMARCA = { base: "../../", ambit: "comarca" } as const;
const AMB = { base: "../", ambit: "amb" } as const;

describe("les paraules de cada àmbit", () => {
  it("diu «de 23» a la comarca i «dels 36» a l'AMB", () => {
    const d = dades({ municipis: [municipi(), municipi({ slug: "b", name: "B", winnerGoverns: false, winnerSigles: "JxCAT" })] });
    const comarca = renderBlocsPoder(d, COMARCA).replace(/\s+/g, " ");
    const amb = renderBlocsPoder(d, AMB).replace(/\s+/g, " ");
    expect(comarca).toContain("<b>1</b> de 2 municipi la llista guanyadora governa");
    expect(amb).toContain("<b>1</b> dels 2 municipi la llista guanyadora governa");
    expect(comarca).toContain("A <b>1</b> de 2 municipi l'alcaldia no és de la llista més votada");
    expect(amb).toContain("A <b>1</b> dels 2 municipi l'alcaldia no és de la llista més votada");
  });

  it("anomena els municipis com toca quan no hi ha cap pacte ni cap canvi", () => {
    const d = dades();
    expect(renderPactes(d, COMARCA)).toContain("A tots els municipis d'aquesta comarca on hem pogut identificar l'alcaldia");
    expect(renderPactes(d, AMB)).toContain("A tots els municipis metropolitans on hem pogut identificar l'alcaldia");
    expect(renderCanvis(d, COMARCA)).toContain("Cap municipi d'aquesta comarca no ha canviat d'alcaldia");
    expect(renderCanvis(d, AMB)).toContain("Cap municipi metropolità no ha canviat d'alcaldia");
  });

  it("només a l'AMB recorda que un canvi d'alcaldia també mou el Consell", () => {
    const d = dades({ municipis: [municipi({ mayorChanged: true, mayorChangeName: "Anna Roig", mayorChangeDate: "2025-07-01" })] });
    const comarca = renderCanvis(d, COMARCA);
    const amb = renderCanvis(d, AMB);
    expect(amb).toContain("també canvia qui seu al Consell Metropolità");
    expect(comarca).not.toContain("Consell Metropolità");
    // I la resta de la frase és la mateixa als dos llocs, apòstrof inclòs.
    for (const html of [comarca, amb]) {
      expect(html).toContain("<b>1</b> municipi ha canviat");
      expect(html).toContain("Anna Roig, des de l'1 de juliol del 2025");
      expect(html).toContain("ni una dimissió ni una moció de censura");
    }
  });
});

describe("els enllaços surten del nivell de cada pàgina", () => {
  const d = dades({
    municipis: [
      municipi({ slug: "a", name: "A", winnerGoverns: false, mayorSigles: "PSC-CP", mayorBrandId: "psc", winnerSigles: "ERC-AM" }),
      municipi({ slug: "b", name: "B", mayorChanged: true, mayorChangeName: "Pau Vila", mayorChangeDate: "2024-03-14" }),
    ],
  });

  it("a la comarca, dos amunt; a l'AMB, un", () => {
    const comarca = renderBlocsPoder(d, COMARCA);
    expect(comarca).toContain('href="../../m/a/"');
    expect(comarca).toContain('href="../../m/b/"');
    expect(comarca).toContain('href="../../partit/psc/"');
    const amb = renderBlocsPoder(d, AMB);
    expect(amb).toContain('href="../m/a/"');
    expect(amb).toContain('href="../m/b/"');
    expect(amb).toContain('href="../partit/psc/"');
    expect(amb).not.toContain('href="../../');
  });

  it("posa la pastilla del partit als pactes dels dos àmbits, i la de qui va guanyar també", () => {
    for (const opcions of [COMARCA, AMB]) {
      const html = renderPactes(d, opcions);
      expect(html).toContain('class="sigla"');
      // La guanyadora no porta marca desada: `sigla()` l'endevina per les sigles.
      expect(html).toContain(`href="${opcions.base}partit/erc/"`);
      expect(html).toContain(">PSC-CP</a>");
      expect(html).toContain(">ERC-AM</a>");
    }
  });

  it("no enllaça unes sigles que no són de cap partit conegut", () => {
    const local = dades({
      municipis: [municipi({ winnerGoverns: false, mayorSigles: "IND-VEÏNS", mayorBrandId: null, winnerSigles: "ERC-AM" })],
    });
    const html = renderPactes(local, COMARCA);
    expect(html).toContain('<b class="sigla"');
    expect(html).toContain("IND-VEÏNS");
    expect(html).not.toContain("partit/null/");
  });
});

describe("renderRepartiment", () => {
  it("no dibuixa cap tram buit i descriu la barra per a qui no la veu", () => {
    const html = renderRepartiment(dades({ governaMesVotat: 3, pacte: 1, senseIdentificar: 0, municipis: Array.from({ length: 4 }, (_, i) => municipi({ slug: `m${i}` })) }));
    expect(html).toContain('class="governa-guanyador"');
    expect(html).toContain('class="governa-pacte"');
    expect(html).not.toContain('class="governa-desconegut"');
    expect(html).toContain('aria-label="3 governa el més votat; 1 hi va haver pacte."');
  });
});

describe("renderBlocsPoder", () => {
  it("obre les dues seccions amb les àncores que fan servir la ullada i l'índex", () => {
    const html = renderBlocsPoder(dades(), COMARCA);
    expect(html).toContain('<section class="bloc" id="pactes">');
    expect(html).toContain('<section class="bloc" id="canvis">');
    expect(html).toContain("les investidures no són dades obertes");
  });

  it("escapa el que ve de les fonts, que no és de fiar", () => {
    const html = renderBlocsPoder(
      dades({ municipis: [municipi({ name: 'Sant <script>alert("x")</script>', winnerGoverns: false, mayorSigles: "A & B", winnerSigles: "C & D" })] }),
      AMB,
    );
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("A &amp; B");
    expect(html).toContain("C &amp; D");
  });
});
