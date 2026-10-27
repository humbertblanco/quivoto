import { describe, expect, it } from "vitest";
import { margesEleccioDHondt, margesEleccioOberta, type LlistaResultat, type MargesMetric } from "../derive/marges";
import type { CandidatLlistaOberta } from "../jobs/j37-llistes-obertes";
import { MARGES_CSS, fraseUltimEsco, renderMargesBloc } from "./marges-fitxa";

const vic2023: LlistaResultat[] = [
  { codi: "1", sigles: "CM", denominacio: "Junts per Vic - Compromís Municipal", votes: 4_029, seats: 8 },
  { codi: "2", sigles: "ERC-AM", denominacio: null, votes: 1_973, seats: 3 },
  { codi: "3", sigles: "CUP-AMUNT", denominacio: null, votes: 1_727, seats: 3 },
  { codi: "4", sigles: "ARA VIC-ARA PL", denominacio: "Ara Vic - Pacte Local", votes: 1_504, seats: 2 },
  { codi: "5", sigles: "PSC-CP", denominacio: null, votes: 1_282, seats: 2 },
  { codi: "6", sigles: "SOMI", denominacio: null, votes: 1_194, seats: 2 },
  { codi: "7", sigles: "VECP-C", denominacio: null, votes: 740, seats: 1 },
  { codi: "8", sigles: "<PETITA>", denominacio: null, votes: 420, seats: 0 },
];
const valids = vic2023.reduce((a, l) => a + l.votes, 0) + 372;
const vic: MargesMetric = {
  eleccions: [
    margesEleccioDHondt(2019, vic2023, valids)!,
    margesEleccioDHondt(2023, vic2023, valids)!,
  ],
};

describe("renderMargesBloc", () => {
  it("buit sense mètrica", () => {
    expect(renderMargesBloc(null)).toBe("");
    expect(renderMargesBloc({ eleccions: [] })).toBe("");
  });

  it("Vic: la frase de l'últim regidor, la taula, la barrera, la majoria i la nota", () => {
    const html = renderMargesBloc(vic);
    expect(html).toContain("L'últim regidor del 2023 el va guanyar <b>Junts per Vic - Compromís Municipal</b>");
    expect(html).toContain("per <b>7 vots</b>");
    expect(html).toContain("Ara Vic - Pacte Local");
    expect(html).toContain('class="balanc marges-taula"');
    // Format català: punt de milers i espai abans del %.
    expect(html).toContain("4.029");
    expect(html).toMatch(/\d,\d %/);
    expect(html).toContain("majoria\n  absoluta, 11");
    expect(html).toContain("no una predicció");
    // Les anteriors, plegades.
    expect(html).toContain("<details class=\"marges-anteriors\">");
    expect(html).toContain("L'últim regidor del 2019");
    // Escapat: les sigles no poden obrir etiquetes.
    expect(html).not.toContain("<PETITA>");
    expect(html).toContain("&lt;PETITA&gt;");
  });

  it("es pot triar l'elecció principal", () => {
    const html = renderMargesBloc(vic, { any: 2019 });
    expect(html.indexOf("del 2019")).toBeLessThan(html.indexOf("del 2023"));
  });

  it("llistes obertes: la persona elegida amb menys vots, i l'empat dit com a sorteig", () => {
    const p = (nom: string, vots: number, elegit: boolean): CandidatLlistaOberta => ({
      nom, clau: nom, sexe: "H", candidatura: { codi: "A", sigles: "A", nom: "Llista A" }, vots, elegit, suplent: false,
    });
    const base = { any: 2023, data: "2023-05-28", regidors: 3, nomsPerPapereta: 2, electors: 40, votants: 30, blancs: 0, nuls: 0 };
    const just = margesEleccioOberta({ ...base, candidats: [p("Anna", 20, true), p("Biel", 15, true), p("Clara", 12, true), p("Dani", 9, false)] }, null)!;
    expect(fraseUltimEsco(just)).toContain("n'hi van faltar <b>4</b>");
    const empat = margesEleccioOberta({ ...base, candidats: [p("Anna", 20, true), p("Biel", 15, true), p("Clara", 12, true), p("Dani", 12, false)] }, null)!;
    expect(fraseUltimEsco(empat)).toContain("sorteig");
    const html = renderMargesBloc({ eleccions: [just] });
    expect(html).toContain("Candidatura");
    expect(html).toContain("surten elegides les persones més votades");
  });

  it("el CSS només defineix classes amb el prefix marges-", () => {
    const classes = MARGES_CSS.match(/\.[a-zA-Z][\w-]*/g) ?? [];
    expect(classes.length).toBeGreaterThan(0);
    for (const c of classes) expect(c.startsWith(".marges-")).toBe(true);
  });
});
