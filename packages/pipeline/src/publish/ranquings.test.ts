import { describe, expect, it } from "vitest";
import { preparaRanquings, renderRanquings, type RankingRow } from "./ranquings";

const files = (n = 100): RankingRow[] => Array.from({ length: n }, (_, i) => ({
  s: `poble-${i}`, n: `Poble ${String(i).padStart(3, "0")}`, c: "Comarca", p: 1_000 + i,
  pt: i, rn: 10_000 + i, ra: 2023, rs: i, rsa: 2024, pa: i / 10, paa: 2025,
  ibi: 300 + i, ibia: 2025, v: i % 5, q: 12,
}));

describe("rànquings municipals", () => {
  it("només publica mètriques amb cobertura mínima del 90% i vint files", () => {
    const rows = files();
    for (let i = 0; i < 11; i++) rows[i]!.rs = null;
    const ids = preparaRanquings(rows).map(r => r.metrica.id);
    expect(ids).not.toContain("selectiva");
    expect(ids).toEqual(expect.arrayContaining(["poblacio", "participacio", "renda", "aigua", "ibi", "alternances"]));
    expect(preparaRanquings(files(19))).toHaveLength(0);
  });

  it("zero és una dada vàlida, però un any diferent queda exclòs", () => {
    const rows = files();
    rows[0]!.pt = 0;
    rows[1]!.ra = 2022;
    const ranquings = preparaRanquings(rows);
    expect(ranquings.find(r => r.metrica.id === "participacio")!.files.some(x => x.valor === 0)).toBe(true);
    expect(ranquings.find(r => r.metrica.id === "renda")!.files).toHaveLength(99);
  });

  it("renderitza top 10, taula completa, cohorts, cerca, cobertura i metodologia", () => {
    const html = renderRanquings(files(), "2026-09-01");
    expect(html).toContain("Rànquings municipals");
    expect(html).toContain('<option value="cat">Tot Catalunya</option>');
    expect(html).toContain("habitants</option>");
    expect(html).toContain("data-filtre");
    expect(html).toContain('class="llista-ranquing"');
    expect(html).not.toContain("Cobertura completa");
    expect(html).not.toContain("<table");
    expect(html.match(/<ol class="top">/g)?.length).toBe(7);
    expect(html).toContain("D'on surt aquesta comparació?");
    expect(html).toContain("../m/poble-99/");
  });
});
