import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FONT_ALTRES,
  NOTA_ALTRES,
  codiIne,
  eleccionsAltresDelMunicipi,
  type AltresEleccionsMetric,
  type FilaParticipacioAltres,
  type FilaVots,
} from "../jobs/j43-altres-eleccions";
import {
  ALTRES_ELECCIONS_CSS,
  barresParticipacio,
  columnaAltra,
  columnaMunicipal,
  etiquetaEleccio,
  fraseEleccio,
  fraseParticipacio,
  fraseVotDual,
  renderAltresEleccions,
  renderAltresEleccionsBloc,
  taulaFamilies,
  type Municipal2023,
} from "./altres-eleccions-fitxa";

const FIXTURES = join(__dirname, "..", "adapters", "__fixtures__");
const vots: FilaVots[] = JSON.parse(readFileSync(join(FIXTURES, "gencat-altres-eleccions-vots.json"), "utf8"));
const participacio: FilaParticipacioAltres[] = JSON.parse(
  readFileSync(join(FIXTURES, "gencat-altres-eleccions-participacio.json"), "utf8"),
);

/** La mètrica tal com la desa J43, feta amb les mateixes funcions i les files reals. */
function metrica(ine5: string, sense: readonly string[] = []): AltresEleccionsMetric {
  const { eleccions, buits } = eleccionsAltresDelMunicipi(
    vots.filter((f) => codiIne(f.territori_codi) === ine5 && !sense.includes(f.id_eleccio)),
    participacio.filter((f) => codiIne(f.territori_codi) === ine5 && !sense.includes(f.id_eleccio)),
  );
  return { font: { ...FONT_ALTRES, consultat: "2026-10-27" }, eleccions, buits, nota: NOTA_ALTRES };
}

/**
 * Unes municipals del 2023 inventades amb la forma de la fitxa: una llista
 * local al davant, el PSC i ERC amb la marca de J2 i una federació
 * d'independents (FIC), que tampoc es presenta a les altres eleccions.
 */
const MUNICIPAL: Municipal2023 = {
  participacio: { censusSize: 10_000, voters: 6_200 },
  resultats: {
    totalVotes: 6_000,
    candidatures: [
      { sigles: "PSC-CP", brandId: "psc", color: "#E20A16", votes: 1_800 },
      { sigles: "VIURE ABRERA", brandId: "local", color: "#00AA00", votes: 2_400 },
      { sigles: "ERC-AM", brandId: "erc", color: "#FDB94D", votes: 1_200 },
      { sigles: "FIC", brandId: "fic", color: null, votes: 600 },
    ],
  },
};

describe("els noms de cada elecció", () => {
  it("etiqueta curta i tros de frase, amb el novembre del 2019 dit", () => {
    expect(etiquetaEleccio({ id: "A20241", tipus: "parlament", any: 2024 })).toBe("Parlament 2024");
    expect(etiquetaEleccio({ id: "G20192", tipus: "generals", any: 2019 })).toBe("Generals nov. 2019");
    expect(fraseEleccio({ id: "G20192", tipus: "generals", any: 2019 })).toBe("a les generals del novembre del 2019");
    expect(fraseEleccio({ id: "E20241", tipus: "europees", any: 2024 })).toBe("a les europees del 2024");
  });
});

describe("columnaMunicipal", () => {
  it("participació, llistes ordenades i les locals i federacions juntes al calaix «local»", () => {
    const c = columnaMunicipal(MUNICIPAL)!;
    expect(c.participacio).toBe(62);
    expect(c.llistes.map((l) => l.sigles)).toEqual(["VIURE ABRERA", "PSC-CP", "ERC-AM", "FIC"]);
    expect(c.families).toEqual({ local: 50, psc: 30, erc: 20 });
  });

  it("sense res de les municipals no hi ha columna", () => {
    expect(columnaMunicipal(null)).toBeNull();
    expect(columnaMunicipal({ participacio: null, resultats: null })).toBeNull();
  });
});

describe("renderAltresEleccionsBloc", () => {
  const m = metrica("08001");
  const html = renderAltresEleccionsBloc(m, MUNICIPAL);

  it("la frase de participació diu les quatre principals amb format català", () => {
    const a24 = m.eleccions.find((e) => e.id === "A20241")!;
    expect(html).toContain("A les municipals del 2023 hi va votar el <b>62,0&nbsp;%</b> del cens; al Parlament del 2024, el");
    expect(html).toContain(`el <b>${a24.participacio!.toLocaleString("ca-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}&nbsp;%</b>`);
    expect(html).toContain(", i a les europees del 2024, el");
  });

  it("sis barres de participació: la municipal marcada i les dues anteriors apagades", () => {
    const barres = barresParticipacio([columnaMunicipal(MUNICIPAL)!, ...m.eleccions.map(columnaAltra)]);
    expect(barres.match(/class="altres-el-fila/g)).toHaveLength(6);
    expect(barres.match(/altres-el-abans/g)).toHaveLength(2);
    expect(barres).toContain("altres-el-fila altres-el-municipal");
    expect(barres).toContain("Generals nov. 2019");
  });

  it("el vot dual és descriptiu: la més votada a cada elecció, i la local dita com a local", () => {
    expect(html).toContain("A les municipals del 2023 la llista més votada va ser <b>VIURE ABRERA</b> (40,0&nbsp;%, una llista local); al Parlament del 2024, <b>PSC</b>");
    expect(html).not.toMatch(/vot dual|traïci|incoher|fidel/i);
  });

  it("la taula de famílies posa un «—» on la família no s'hi presenta, i les locals a part", () => {
    const taula = taulaFamilies([columnaMunicipal(MUNICIPAL)!, ...m.eleccions.map(columnaAltra)]);
    expect(taula).toContain("<summary>La mateixa força a cada elecció</summary>");
    expect(taula).toContain("Llistes locals i d&#39;independents".replace("&#39;", "'"));
    // A Ripoll, Aliança Catalana només es presenta al Parlament del 2024.
    const ripoll = taulaFamilies(metrica("17147").eleccions.map(columnaAltra));
    expect(ripoll).toMatch(/Aliança Catalana<\/th><td>33,4&nbsp;%<\/td>(<td>—<\/td>){4}<\/tr>/);
    expect(taula).toMatch(/Llistes locals[^<]*<\/th><td>50,0&nbsp;%<\/td>(<td>—<\/td>){5}<\/tr>/);
  });

  it("els colors són marques de dades: el de la casa per família, i cap sigla sense escapar", () => {
    expect(html).toContain('class="mostra" style="--c:#d00c3c"');
    const injectat = renderAltresEleccionsBloc(metrica("08001"), {
      participacio: null,
      resultats: { totalVotes: 10, candidatures: [{ sigles: "<b>X</b>", brandId: null, color: "red", votes: 10 }] },
    });
    expect(injectat).not.toContain("<b>X</b>");
    expect(injectat).toContain("&lt;b&gt;X&lt;/b&gt;");
    expect(injectat).toContain("--c:#8b8b8b");
  });

  it("diu sempre que la comparació per família és aproximada, i la font amb la data", () => {
    expect(html).toContain("comparar per família política és");
    expect(html).toContain("aproximat");
    expect(html).toContain("consultat el 27 d’octubre del 2026".replace("’", "'"));
    expect(html).toContain('href="https://analisi.transparenciacatalunya.cat/d/ntc4-rnwr"');
  });

  it("sense municipals el bloc parla només de les altres", () => {
    const sense = renderAltresEleccionsBloc(m, null);
    expect(sense).toContain("Al Parlament del 2024 hi va votar el");
    expect(sense).toContain("Al Parlament del 2024 la llista més votada va ser <b>PSC</b>");
    expect(sense).not.toContain("municipals del 2023");
  });

  it("una elecció que la font no dona surt com a buit", () => {
    const amb = renderAltresEleccionsBloc(metrica("17099", ["E20241"]), MUNICIPAL);
    expect(amb).toContain("La font no dona cap xifra d'aquest municipi a les europees del 2024: és un buit, no un zero.");
  });

  it("sense mètrica no torna mai buit", () => {
    const buit = renderAltresEleccionsBloc(null, MUNICIPAL);
    expect(buit).toContain("un buit no és un zero");
    expect(buit).toContain("irrv-2mfc");
  });

  it("la secció porta l'id i el títol, i el CSS té només classes pròpies", () => {
    expect(renderAltresEleccions(m, MUNICIPAL)).toContain('<section class="bloc" id="altres-eleccions">');
    // Cada regla comença per una classe pròpia; `.mostra` només hi surt a dins d'una.
    const selectors = ALTRES_ELECCIONS_CSS.split("}").map((r) => r.split("{")[0]!.trim()).filter((r) => r && !r.startsWith("@"));
    for (const sel of selectors.flatMap((r) => r.replace(/^.*\{/, "").split(","))) {
      expect(sel.trim().startsWith(".altres-el-"), sel).toBe(true);
    }
  });

  it("fraseParticipacio i fraseVotDual no diuen res sense prou dades", () => {
    expect(fraseParticipacio([])).toBe("");
    expect(fraseVotDual([columnaAltra(m.eleccions[0]!)])).toBe("");
  });
});
