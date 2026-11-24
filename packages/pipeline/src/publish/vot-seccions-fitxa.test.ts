import { describe, expect, it } from "vitest";
import type { EleccioSeccions, VotSeccionsMetric } from "../jobs/j47-vot-seccions";
import {
  dadesNavegador,
  frases,
  guanyador,
  nomSeccio,
  opacitatMarge,
  rendaQuarts,
  renderVotSeccionsBloc,
  taulaEquivalent,
  talls,
} from "./vot-seccions-fitxa";

const eleccio = (files: Record<string, number[]>): EleccioSeccions => ({
  id: "M20231",
  etiqueta: "Municipals 2023",
  llistes: [
    { sigles: "PSC", familia: "psc", color: "#d00c3c", vots: 0 },
    { sigles: "ERC", familia: "erc", color: "#ffb232", vots: 0 },
  ],
  files,
});

function metrica(n: number, renda = false): VotSeccionsMetric {
  const files: Record<string, number[]> = {};
  const seccions = [];
  const valors: Record<string, number> = {};
  for (let i = 1; i <= n; i += 1) {
    const codi = `08077${String(Math.ceil(i / 50)).padStart(2, "0")}${String(i).padStart(3, "0")}`;
    seccions.push({ codi, d: "M0 0l10 0 0 10z" });
    // Les seccions de renda alta voten més i més ERC.
    files[codi] = [1000, 400 + 10 * i, 5, 5, 300, 90 + 10 * i];
    valors[codi] = 10000 + 1000 * i;
  }
  return {
    origen: "generalitat", consultat: "2026-11-24", amplada: 1000, alcada: 800, seccions,
    eleccions: [eleccio(files)], renda: renda ? { any: 2023, font: "INE", url: "https://www.ine.es/x", valors } : null,
    xamfra: "esplugues-de-llobregat", senseGeometria: {},
  };
}

describe("vot per secció · càlculs", () => {
  it("troba el guanyador, l'empat i la secció sense vots", () => {
    expect(guanyador([10, 5, 0, 0, 3, 2])).toBe(0);
    expect(guanyador([10, 5, 0, 0, 2, 2])).toBe(-2);
    expect(guanyador([10, 0, 0, 0, 0, 0])).toBe(-1);
  });

  it("fa més intens el color com més ample és el marge", () => {
    expect(opacitatMarge([0, 0, 0, 0, 51, 49])).toBe(0.45);
    expect(opacitatMarge([0, 0, 0, 0, 55, 45])).toBe(0.72);
    expect(opacitatMarge([0, 0, 0, 0, 80, 20])).toBe(1);
  });

  it("parteix en cinc graons rodons", () => {
    expect(talls(31.6, 65.1, 5)).toEqual([30, 40, 50, 60, 70, 80]);
    expect(talls(0, 42, 5)).toEqual([0, 10, 20, 30, 40, 50]);
  });

  it("anomena la secció pel districte i el número", () => {
    expect(nomSeccio("0801910026")).toBe("Districte 10, secció 26");
  });

  it("compara la participació del quart més ric i del més pobre sumant vots, no fent mitjanes", () => {
    const m = metrica(8, true);
    const q = rendaQuarts(m, m.eleccions[0]!)!;
    expect(q.n).toBe(2);
    expect(q.pobres).toBeCloseTo((100 * (410 + 420)) / 2000, 5);
    expect(q.rics).toBeCloseTo((100 * (470 + 480)) / 2000, 5);
  });

  it("escriu les frases sense veredictes: qui guanya on, el ventall i la renda", () => {
    const m = metrica(8, true);
    const f = frases(m, m.eleccions[0]!);
    expect(f[0]).toContain("<strong>PSC</strong> va guanyar a");
    expect(f[1]).toMatch(/La participació va del/);
    expect(f[2]).toMatch(/quart de seccions amb més renda/);
  });
});

describe("vot per secció · el bloc", () => {
  it("no surt si no hi ha mapa", () => {
    expect(renderVotSeccionsBloc(null, { nom: "X" })).toBe("");
  });

  it("dibuixa una secció per camí, pintada amb el guanyador, i funciona sense JavaScript", () => {
    const html = renderVotSeccionsBloc(metrica(5), { nom: "Esplugues" });
    expect(html.match(/<path data-i=/g)).toHaveLength(5);
    expect(html).toContain("fill:#d00c3c");
    expect(html).toContain("Les xifres de cada secció");
    expect(html).toContain("xamfra.damosenelblanco.com/municipis/esplugues-de-llobregat.html");
  });

  it("a les ciutats grans la taula va per districte", () => {
    const m = metrica(260);
    expect(taulaEquivalent(m, m.eleccions[0]!)).toContain("Les xifres de cada districte");
  });

  it("no deixa que les dades tanquin el <script>", () => {
    const m = metrica(2);
    m.eleccions[0]!.llistes[0]!.sigles = "</script><b>";
    expect(dadesNavegador(m)).not.toContain("</");
  });
});
