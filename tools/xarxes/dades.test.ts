import { describe, expect, it } from "vitest";
import { mediana, parseCuriositats, parseParticipacio, parseRanquings, parseTitolsRanquings } from "./dades";

// Un tros de la pàgina de rànquings tal com la publica `curiositats.ts`.
const CURIOSITAT = `
<article class="curiositat" id="cur-vehicles">
  <p class="micro">2024 · Idescat, a partir de la DGT · parc de vehicles</p>
  <h3>On hi ha més vehicles que persones</h3>
  <p class="entrada-bloc">Municipis amb més de 1.000 vehicles: n'hi ha 448.</p>
  <h4 class="cap">Els que en tenen més per habitant</h4>
    <ol class="llista-curiosa" aria-label="x">
      <li><span class="pos">1</span><span class="municipi"><a href="../m/rajadell/">Rajadell</a><small><a class="comarca" href="../c/bages/">Bages</a> · 597 habitants</small></span><b class="dada">44.737 per 1.000 hab.</b></li>
      <li><span class="pos">2</span><span class="municipi"><a href="../m/aguilar-de-segarra/">Aguilar de Segarra</a><small>Bages · 292 habitants</small></span><b class="dada">43.096 per 1.000 hab.</b></li>
    </ol>
  <p class="cobertura">S'ha mirat el parc de vehicles de 947 municipis.</p>
  <p class="nota">El parc compta els vehicles domiciliats.</p>
</article>`;

describe("parseCuriositats", () => {
  it("llegeix font, títol, llistes i cobertura d'una targeta", () => {
    const [c] = parseCuriositats(CURIOSITAT);
    expect(c?.id).toBe("cur-vehicles");
    expect(c?.font).toBe("2024 · Idescat, a partir de la DGT · parc de vehicles");
    expect(c?.titol).toBe("On hi ha més vehicles que persones");
    expect(c?.llistes).toHaveLength(1);
    expect(c?.llistes[0]?.cap).toBe("Els que en tenen més per habitant");
    expect(c?.llistes[0]?.items[0]).toEqual({
      pos: 1, nom: "Rajadell", sub: "Bages · 597 habitants", dada: "44.737 per 1.000 hab.", href: "../m/rajadell/",
    });
    expect(c?.cobertura).toBe("S'ha mirat el parc de vehicles de 947 municipis.");
  });
  it("no inventa targetes on no n'hi ha", () => {
    expect(parseCuriositats("<p>res</p>")).toEqual([]);
  });
});

describe("parseParticipacio", () => {
  it("treu any, percentatge, votants i cens de la secció de participació", () => {
    const html = `<section id="participacio"><h2>Qui hi va anar a votar</h2>
      <b>2023</b> <b>60,6 %</b> <span>+9,1 punts</span> <span>672.053 de 1.109.116 · 6.788 en blanc</span>
      <b>2019</b> <b>66,2 %</b> <span>755.983 de 1.142.444 · 2.635 en blanc</span></section>`;
    expect(parseParticipacio(html)).toEqual([
      { any: 2023, pct: 60.6, votants: 672053, cens: 1109116 },
      { any: 2019, pct: 66.2, votants: 755983, cens: 1142444 },
    ]);
  });
  it("torna buit si la fitxa no té la secció", () => {
    expect(parseParticipacio("<p>res</p>")).toEqual([]);
  });
});

describe("parseRanquings", () => {
  it("llegeix el JSON incrustat", () => {
    const html = `<script type="application/json" id="dades-ranquings">{"municipis":[["a","A","C","t0-0","c"]],"grups":{},"metriques":{"poblacio":{"d":0,"s":"","files":[[0,5]]}}}</script>`;
    expect(parseRanquings(html).metriques["poblacio"]?.files).toEqual([[0, 5]]);
  });
});

describe("mediana", () => {
  it("fa la mediana amb parell i senar", () => {
    expect(mediana([3, 1, 2])).toBe(2);
    expect(mediana([4, 1, 3, 2])).toBe(2.5);
    expect(Number.isNaN(mediana([]))).toBe(true);
  });
});

describe("parseTitolsRanquings", () => {
  it("aparella cada mètrica amb el títol i la font de la seva secció", () => {
    const html = `<section data-metrica="ibi"><p class="micro">2025 · Idescat</p><h2>Rebut mitjà d'IBI urbà</h2></section>`;
    expect(parseTitolsRanquings(html)).toEqual({ ibi: { titol: "Rebut mitjà d'IBI urbà", font: "2025 · Idescat" } });
  });
});
