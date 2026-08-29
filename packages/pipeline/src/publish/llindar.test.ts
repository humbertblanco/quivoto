import { describe, expect, it } from "vitest";
import { citaUnPrograma, citaUnVot, compta, informe, validaConjunt, type Afirmacio } from "./llindar";

const base = (over: Partial<Afirmacio> = {}): Afirmacio => ({
  tema: "fiscalitat",
  text: "L'Ajuntament ha de rebaixar el tipus de gravamen de l'IBI urbà.",
  evidencia: "Ple de 18 d'octubre de 2023, acord núm. 6: aprovat amb 12 vots a favor, 4 en contra i 4 abstencions.",
  posicio_govern: "desacord",
  ...over,
});

/** Conjunt que compleix tots els mínims, per poder provar què els trenca. */
function conjuntValid(): Afirmacio[] {
  const temes = [
    ...Array.from({ length: 4 }, () => "fiscalitat"),
    ...Array.from({ length: 4 }, () => "habitatge"),
    ...Array.from({ length: 4 }, () => "mobilitat"),
    ...Array.from({ length: 4 }, () => "urbanisme"),
    ...Array.from({ length: 4 }, () => "cultura"),
    ...Array.from({ length: 5 }, () => "educació"),
  ];
  return temes.map((tema, i) =>
    base({
      tema,
      text: `L'Ajuntament ha de fer la cosa número ${i}.`,
      // La meitat amb el govern a favor, per quedar dins de la forquilla.
      posicio_govern: i % 2 === 0 ? "acord" : "desacord",
      evidencia:
        i < 6
          ? "Programa electoral del 2023 de la candidatura, pàgina 14: «ho farem»."
          : "Ple de 12 de març de 2025, acord núm. 4: aprovat amb 13 vots a favor i 8 en contra.",
    }),
  );
}

describe("compta paraules", () => {
  it("compta les elisions com una sola paraula", () => {
    expect(compta("L'Ajuntament ha de rebaixar l'IBI.")).toBe(5);
  });
});

describe("detecció d'evidència", () => {
  it("reconeix una votació amb recompte", () => {
    expect(citaUnVot(base())).toBe(true);
    expect(citaUnVot(base({ evidencia: "Ho va dir el diari la setmana passada." }))).toBe(false);
  });

  it("reconeix una cita de programa", () => {
    expect(citaUnPrograma(base({ evidencia: "Programa electoral del 2023, pàgina 12." }))).toBe(true);
    expect(citaUnPrograma(base())).toBe(false);
  });
});

describe("validaConjunt", () => {
  it("deixa passar un conjunt que compleix els mínims", () => {
    const v = validaConjunt({ municipi: "Prova", afirmacions: conjuntValid() });
    expect(v.publicable, informe(v)).toBe(true);
  });

  it("bloqueja si no hi ha prou afirmacions lligades a un vot", () => {
    const afirmacions = conjuntValid().map((a) => ({
      ...a,
      evidencia: "Programa electoral del 2023, pàgina 12: «ho farem».",
    }));
    const v = validaConjunt({ municipi: "Prova", afirmacions });
    expect(v.publicable).toBe(false);
    expect(v.incompliments.some((i) => i.regla.includes("vot del ple"))).toBe(true);
  });

  it("bloqueja si cap afirmació no cita un programa", () => {
    const afirmacions = conjuntValid().map((a) => ({ ...a, evidencia: base().evidencia }));
    const v = validaConjunt({ municipi: "Prova", afirmacions });
    expect(v.incompliments.some((i) => i.regla.includes("programa"))).toBe(true);
  });

  it("bloqueja un equilibri direccional fora de la forquilla", () => {
    const afirmacions = conjuntValid().map((a) => ({ ...a, posicio_govern: "acord" as const }));
    const v = validaConjunt({ municipi: "Prova", afirmacions });
    expect(v.incompliments.some((i) => i.regla === "equilibri direccional")).toBe(true);
  });

  it("bloqueja les posicions del govern desconegudes", () => {
    const afirmacions = conjuntValid();
    afirmacions[0] = { ...afirmacions[0]!, posicio_govern: "desconeguda" };
    const v = validaConjunt({ municipi: "Prova", afirmacions });
    expect(v.publicable).toBe(false);
    expect(v.incompliments.some((i) => i.regla.includes("desconegudes"))).toBe(true);
  });

  it("bloqueja una afirmació de més de 25 paraules", () => {
    const afirmacions = conjuntValid();
    afirmacions[0] = { ...afirmacions[0]!, text: Array.from({ length: 26 }, (_, i) => `mot${i}`).join(" ") };
    const v = validaConjunt({ municipi: "Prova", afirmacions });
    expect(v.incompliments.some((i) => i.regla === "màxim de paraules")).toBe(true);
  });

  it("avisa dels paranys de redacció sense bloquejar", () => {
    const afirmacions = conjuntValid();
    afirmacions[0] = { ...afirmacions[0]!, text: "L'Ajuntament ha de continuar amb el pla actual." };
    afirmacions[1] = { ...afirmacions[1]!, text: "L'Ajuntament ha de millorar els parcs." };
    const v = validaConjunt({ municipi: "Prova", afirmacions });
    const avisos = v.incompliments.filter((i) => i.gravetat === "avisa").map((i) => i.regla);
    expect(avisos).toContain("verb que premia l'statu quo");
    expect(avisos).toContain("verb buit");
  });
});
