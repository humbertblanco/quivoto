import { describe, expect, it } from "vitest";
import { cohortHomogenia, estatDe, extremsEmpatats } from "./contracte-metriques";

describe("contracte de mètriques", () => {
  it("zero és una dada i null és una absència", () => {
    expect(estatDe(0, "falta")).toEqual({ estat: "disponible", valor: 0 });
    expect(estatDe(null, "falta")).toEqual({ estat: "absent", motiu: "falta" });
  });

  it("no barreja períodes i exigeix 90% i vint observacions", () => {
    const files = Array.from({ length: 23 }, (_, i) => ({ valor: i, any: i < 21 ? 2023 : 2022 }));
    const cohort = cohortHomogenia(files, (f) => ({ valor: f.valor, periode: f.any }));
    expect(cohort?.periode).toBe("2023");
    expect(cohort?.observades).toBe(21);
    expect(cohort?.total).toBe(23);
    expect(cohortHomogenia(files.slice(0, 19), (f) => ({ valor: f.valor, periode: f.any }))).toBeNull();
  });

  it("conserva tots els municipis empatats", () => {
    expect(extremsEmpatats([{ fila: "B", valor: 7 }, { fila: "A", valor: 7 }, { fila: "C", valor: 2 }], "max"))
      .toEqual({ valor: 7, files: ["B", "A"] });
  });
});
