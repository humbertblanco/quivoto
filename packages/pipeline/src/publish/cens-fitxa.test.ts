import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buitsDe,
  eleccionsDelMunicipi,
  FONT_CENS,
  NOTA_BUITS,
  NOTA_COMPETENCIES,
  resumDe,
  type CensElectoralMetric,
  type FilaParticipacio,
} from "../jobs/j36-cens-electoral";
import {
  CENS_FITXA_CSS,
  curiositatsCens,
  etiquetaEleccio,
  fraseObertura,
  graficCens,
  graficParticipacio,
  renderCens,
  renderCensBloc,
  type FilaCens,
} from "./cens-fitxa";
import { textEtiqueta } from "./grafics";

const FIXTURES = join(__dirname, "..", "adapters", "__fixtures__");
const totes: FilaParticipacio[] = JSON.parse(
  readFileSync(join(FIXTURES, "gencat-participacio-municipals.json"), "utf8"),
);

/** La mètrica tal com la desa J36, feta amb les mateixes funcions i les files reals. */
function metrica(ine5: string, ambComparacio = true): CensElectoralMetric {
  const eleccions = eleccionsDelMunicipi(totes.filter((f) => f.territori_codi === ine5));
  return {
    font: { ...FONT_CENS, consultat: "2026-09-03" },
    eleccions,
    buits: buitsDe(eleccions),
    resum: resumDe(eleccions)!,
    comparacio: ambComparacio
      ? {
          grup: { clau: "t9-9", etiqueta: "de més de 100.000 habitants", mida: 11 },
          participacio: { M20191: { mediana: 62.4, quants: 11 }, M20231: { mediana: 58.1, quants: 11 } },
        }
      : null,
    context: { decideixLAjuntament: false, nota: NOTA_COMPETENCIES },
    nota: NOTA_BUITS,
  };
}

describe("fraseObertura", () => {
  it("Barcelona: la darrera dada, el creixement des del 1979 i els extrems de participació", () => {
    const frase = fraseObertura(metrica("08019"));
    expect(frase).toContain("El 2023 el cens electoral era de <b>1.109.116</b> persones");
    expect(frase).toContain("hi van votar 672.053, <b>el 60,6&nbsp;%</b>");
    expect(frase).toContain("Des del 1979 el cens ha minvat un 25,1&nbsp;%");
    expect(frase).toContain("el màxim va ser el del 1979 (1.480.453) i el mínim el del 2023 (1.109.116)");
    expect(frase).toContain("La participació més alta va ser la del 1987 (68,9&nbsp;%) i la més baixa la del 2007 (49,6&nbsp;%)");
  });

  it("Badia del Vallès: el creixement es diu des del 1995, que és la primera dada", () => {
    expect(fraseObertura(metrica("08904"))).toContain("Des del 1995 el cens ha minvat un 26,3&nbsp;%");
  });
});

describe("els dos dibuixos", () => {
  const bcn = metrica("08019");

  it("el cens són dotze barres, la darrera de coral, cadascuna amb l'etiqueta de la casa", () => {
    const svg = graficCens(bcn);
    expect(svg.match(/class="cens-barra/g)).toHaveLength(12);
    expect(svg.match(/class="cens-barra ara"/g)).toHaveLength(1);
    expect(svg.match(/<g class="punt cens-punt" tabindex="0"/g)).toHaveLength(12);
    expect(svg).toContain('data-nom="Cens electoral"');
    expect(svg).toContain('data-any="2023"');
    expect(svg).toContain('data-valor="1.109.116 electors"');
    expect(svg).not.toContain("cens-sense");
    expect(svg).toContain('<figcaption class="cens-titol">El cens electoral, elecció a elecció</figcaption>');
    expect(svg).toContain('aria-label="Cens electoral: de 1.480.453 el 1979 a 1.109.116 el 2023."');
  });

  it("la participació és una línia sencera de 0 a 100 amb la mediana del grup on n'hi ha", () => {
    const svg = graficParticipacio(bcn);
    expect(svg).toContain('class="linia"');
    expect(svg.match(/class="nus/g)).toHaveLength(12);
    expect(svg).toContain(">100&#160;%<");
    // Només dues eleccions tenen mediana: un sol tram de dos punts.
    expect(svg).toContain('class="mediana-grup"');
    expect(svg).toContain("mediana dels de més de 100.000 habitants");
    expect(svg).toContain('data-valor="60,6 %"');
  });

  it("una elecció sense dada es dibuixa com un forat i la línia es parteix, no passa per zero", () => {
    const badia = metrica("08904", false);
    const cens = graficCens(badia);
    expect(cens.match(/cens-sense/g)).toHaveLength(4);
    expect(cens.match(/class="forat"/g)).toHaveLength(4);
    expect(cens).toContain('data-valor="sense dada"');
    expect(cens).toContain("un buit no és un zero");
    expect(cens.match(/class="cens-barra/g)).toHaveLength(8);
    const part = graficParticipacio(badia);
    // Cap tram de la línia no comença als llocs del 1979-1991: el primer punt és el del 1995.
    expect(part.match(/<path class="linia" d="M[^"]*"/g)).toHaveLength(1);
    expect(part).not.toContain('class="mediana-grup"');
    expect(part).not.toContain("cens-clau");
  });
});

describe("etiquetaEleccio", () => {
  const bcn = metrica("08019");
  const [e79, e83] = bcn.eleccions;

  it("porta els votants, la participació, la diferència amb l'anterior i la mediana dels seus", () => {
    const e23 = bcn.eleccions[11]!;
    const e19 = bcn.eleccions[10]!;
    const text = textEtiqueta(etiquetaEleccio(bcn, e23, e19, "cens"));
    expect(text).toBe(
      "Cens electoral: 2023 · 1.109.116 electors · votants: 672.053 · participació: 60,6 % · " +
        "cens respecte al 2019: −33.328 (−2,9 %) · participació respecte al 2019: −5,6 punts · " +
        "mediana dels 11 de la seva mida: 58,1 % (Generalitat de Catalunya, processos electorals, consultat el 2026-09-03)",
    );
  });

  it("la primera elecció no té anterior i el 1979 no té mediana: cap extra inventat", () => {
    const text = textEtiqueta(etiquetaEleccio(bcn, e79!, null, "participacio"));
    expect(text).toBe(
      "Participació: 1979 · 54,3 % · cens: 1.480.453 · votants: 803.419 " +
        "(Generalitat de Catalunya, processos electorals, consultat el 2026-09-03)",
    );
    expect(textEtiqueta(etiquetaEleccio(bcn, e83!, e79!, "cens"))).toContain("cens respecte al 1979: −120.864 (−8,2 %)");
  });
});

describe("renderCens", () => {
  it("és una secció de la fitxa amb els dos dibuixos, la taula plegada, la nota i el peu amb la font", () => {
    const html = renderCens(metrica("08019"));
    expect(html).toContain('<section class="bloc" id="cens">');
    expect(html).toContain("<h2>El cens i la participació des del 1979</h2>");
    expect(html.match(/<figure class="grafic cens-grafic"/g)).toHaveLength(2);
    expect(html).toContain('<details class="cens-detall"><summary>Les xifres, elecció a elecció</summary>');
    expect(html).toContain("<th>Mediana dels de la seva mida</th>");
    expect(html).toContain("<tr><th scope=\"row\">2023</th><td>1.109.116</td><td>672.053</td><td>60,6&nbsp;%</td><td>58,1&nbsp;%</td><td>6.788</td></tr>");
    expect(html).toContain("<b>Què hi decideix l'ajuntament.</b>");
    expect(html).toContain('href="https://analisi.transparenciacatalunya.cat/d/irrv-2mfc"');
    expect(html).toContain("1979-2023");
    expect(html).toContain("consultat el 2026-09-03");
    expect(html).toContain("La mediana és la dels municipis de més de 100.000 habitants segons el padró d'avui");
    expect(html).not.toContain("Hi ha una elecció sense dada");
  });

  it("amb buits ho diu, els anomena i explica que no són zeros", () => {
    const html = renderCensBloc(metrica("08904"));
    expect(html).toContain("Hi ha 4 eleccions sense dada\n  (1979, 1983, 1987, 1991).");
    expect(html).toContain("Badia del Vallès es va segregar el 1994");
    expect(html.match(/<tr class="cens-fila-buida">/g)).toHaveLength(4);
  });

  it("sense mètrica diu el buit i la font consultada, i mai torna cadena buida", () => {
    const html = renderCensBloc(null);
    expect(html).toContain("un buit no és un zero");
    expect(html).toContain("irrv-2mfc");
    expect(html.trim()).not.toBe("");
  });

  it("el CSS només porta classes amb el prefix cens-, a part de les dels gràfics de la casa", () => {
    const classes = [...CENS_FITXA_CSS.matchAll(/\.([a-z-]+)/g)].map((m) => m[1] ?? "");
    for (const c of classes) expect(c === "forat" || c === "ara" || c.startsWith("cens-")).toBe(true);
  });
});

describe("curiositatsCens", () => {
  const fila = (n: string, extra: Partial<FilaCens>): FilaCens => ({ s: n.toLowerCase(), n, c: "Comarca", p: 1000, ...extra });
  const files: FilaCens[] = [
    fila("Amunt", { cens79: 1000, censUlt: 3000, creixCens: 200, censDes: 1979, partMax: 91.2, partMaxA: 1983, partMin: 55.1, partMinA: 2007 }),
    fila("Avall", { cens79: 1000, censUlt: 500, creixCens: -50, censDes: 1979, partMax: 80, partMaxA: 1979, partMin: 40, partMinA: 2019 }),
    fila("Mig", { cens79: 1000, censUlt: 1100, creixCens: 10, censDes: 1979, partMax: 70, partMaxA: 1995, partMin: 60, partMinA: 2023 }),
    fila("Nou", { cens79: null, censUlt: 2000, creixCens: 5, censDes: 1995, partMax: 75, partMaxA: 1999, partMin: 50, partMinA: 2011 }),
    fila("Sense", {}),
  ];

  it("dona tres fets: el creixement del cens, els extrems de participació i els municipis posteriors al 1979", () => {
    const fets = curiositatsCens(files);
    expect(fets.map((f) => f.id)).toEqual(["cens-creixement", "participacio-extrems", "municipis-posteriors-1979"]);
  });

  it("el creixement només compta els que tenen el 1979, i escriu el signe i el recorregut", () => {
    const [creix] = curiositatsCens(files);
    expect(creix!.llistes[0]!.cap).toBe("Els que més han crescut");
    expect(creix!.llistes[0]!.files[0]).toEqual({ municipi: { s: "amunt", n: "Amunt", c: "Comarca" }, valor: "+200,0 %", detall: "de 1.000 a 3.000 electors" });
    expect(creix!.llistes[1]!.files[0]!.valor).toBe("−50,0 %");
    expect(creix!.llistes[0]!.files.map((f) => f.municipi.n)).not.toContain("Nou");
    expect(creix!.cobertura).toBe("S'ha mirat el cens de 3 municipis dels 5 amb dada del 1979 i del 2023.");
    expect(creix!.periode).toBe("1979-2023");
  });

  it("la participació més alta i la més baixa porten l'any i la població", () => {
    const [, part] = curiositatsCens(files);
    expect(part!.llistes[0]!.files[0]).toEqual({ municipi: { s: "amunt", n: "Amunt", c: "Comarca" }, valor: "91,2 %", detall: "el 1983 · 1.000 habitants avui" });
    expect(part!.llistes[1]!.files[0]!.valor).toBe("40,0 %");
    expect(part!.llistes[1]!.files[0]!.detall).toBe("el 2019 · 1.000 habitants avui");
  });

  it("els posteriors al 1979 van per any de la primera dada, i sense cap no hi ha fet", () => {
    const [, , nous] = curiositatsCens(files);
    expect(nous!.llistes[0]!.files).toEqual([{ municipi: { s: "nou", n: "Nou", c: "Comarca" }, valor: "des del 1995", detall: "2.000 electors a la darrera" }]);
    expect(nous!.cobertura).toBe("N'hi ha 1 dels 5.");
    expect(curiositatsCens(files.slice(0, 3)).map((f) => f.id)).toEqual(["cens-creixement", "participacio-extrems"]);
  });

  it("sense cap dada no surt res", () => {
    expect(curiositatsCens([fila("Sense", {})])).toEqual([]);
  });
});

describe("el full del cens segueix la marca", () => {
  it("cap etiqueta en majúscules espaiades: el títol de cada dibuix va en minúscula", () => {
    expect(CENS_FITXA_CSS).not.toContain("text-transform:uppercase");
    expect(CENS_FITXA_CSS).not.toMatch(/letter-spacing:\.\d/);
    expect(CENS_FITXA_CSS).toContain(".cens-titol{");
  });
});
