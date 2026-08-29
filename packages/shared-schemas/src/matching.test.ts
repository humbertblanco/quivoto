import { describe, expect, it } from "vitest";
import {
  computeMatch,
  needsShootOut,
  tiedLeaders,
  weightFor,
  type Subject,
  type UserAnswer,
} from "./matching";

const answers: Record<string, UserAnswer> = {
  s1: { value: 2, important: true },
  s2: { value: -1 },
  s3: { value: 0 },
};

/** A coincideix gairebé del tot i ha prioritzat la primera afirmació. */
const partitA: Subject = {
  id: "A",
  name: "Candidatura A",
  positions: {
    s1: { kind: "answered", value: 2, priority: true },
    s2: { kind: "answered", value: -2 },
    s3: { kind: "answered", value: 0 },
  },
};

/** B és a les antípodes a la primera i esquiva la tercera. */
const partitB: Subject = {
  id: "B",
  name: "Candidatura B",
  positions: {
    s1: { kind: "answered", value: -2 },
    s2: { kind: "answered", value: -1 },
    s3: { kind: "no_position" },
  },
};

/** C només té posició en una de les tres: no arriba al llindar de cobertura. */
const partitC: Subject = {
  id: "C",
  name: "Candidatura C",
  positions: { s1: { kind: "answered", value: 2 } },
};

describe("computeMatch", () => {
  it("reprodueix un exemple calculat a mà", () => {
    // A: s1 pes 4 (important × prioritat), distància 0 → 16/16
    //    s2 pes 1, distància 1 → 3/4 · s3 pes 1, distància 0 → 4/4
    //    (16+3+4) / (16+4+4) = 23/24 = 95,83% → 96%
    // B: s1 pes 2, distància 4 → 0/8 · s2 pes 1, distància 0 → 4/4
    //    s3 no es posiciona → −1 · 1, denominador 4 → 3/16 = 18,75% → 19%
    const [first, second] = computeMatch(answers, [partitB, partitA]);
    expect(first!.subjectId).toBe("A");
    expect(first!.matchPct).toBe(96);
    expect(second!.subjectId).toBe("B");
    expect(second!.matchPct).toBe(19);
  });

  it("penalitza amb −1 qui declara que no es posiciona, i no l'exclou", () => {
    const [b] = computeMatch(answers, [partitB]);
    expect(b!.known).toBe(3); // «no ens hi posicionem» és una resposta, compta
    const s3 = b!.breakdown.find((x) => x.statementId === "s3")!;
    expect(s3.kind).toBe("no_position");
    expect(s3.score).toBe(-1);
  });

  it("deixa fora del càlcul les afirmacions sense dades", () => {
    const [c] = computeMatch(answers, [partitC]);
    expect(c!.known).toBe(1);
    expect(c!.coverage).toBeCloseTo(1 / 3);
    expect(c!.classified).toBe(false);
    expect(c!.matchPct).toBeNull();
  });

  it("classifica just a partir del 70% de cobertura", () => {
    const deuAfirmacions = Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [`q${i}`, { value: 2 } as UserAnswer]),
    );
    const ambSet = (n: number): Subject => ({
      id: `s${n}`,
      name: `Subjecte ${n}`,
      positions: Object.fromEntries(
        Array.from({ length: n }, (_, i) => [`q${i}`, { kind: "answered", value: 2 } as const]),
      ),
    });
    expect(computeMatch(deuAfirmacions, [ambSet(7)])[0]!.classified).toBe(true);
    expect(computeMatch(deuAfirmacions, [ambSet(6)])[0]!.classified).toBe(false);
  });

  it("posa els no classificats al final, per darrere de qualsevol classificat", () => {
    const results = computeMatch(answers, [partitC, partitB, partitA]);
    expect(results.map((r) => r.subjectId)).toEqual(["A", "B", "C"]);
  });

  it("ignora del tot les afirmacions que l'usuari omet", () => {
    const ambOmissio = { ...answers, s3: { value: null } as UserAnswer };
    const [a] = computeMatch(ambOmissio, [partitA]);
    expect(a!.answered).toBe(2);
    expect(a!.breakdown.map((b) => b.statementId)).toEqual(["s1", "s2"]);
    // 16/16 + 3/4 = 19/20 = 95%
    expect(a!.matchPct).toBe(95);
  });

  it("ometre no altera la posició relativa dels subjectes que hi coincidien", () => {
    const dosIguals = computeMatch(
      { s1: { value: 2 }, s2: { value: 2 } },
      [partitA, partitB],
    );
    const nomesUna = computeMatch({ s1: { value: 2 }, s2: { value: null } }, [partitA, partitB]);
    expect(dosIguals[0]!.subjectId).toBe("A");
    expect(nomesUna[0]!.subjectId).toBe("A");
  });

  it("decreix monòtonament a mesura que augmenta la distància", () => {
    const percentatges = [2, 1, 0, -1, -2].map((v) => {
      const subject: Subject = {
        id: "x",
        name: "X",
        positions: { s1: { kind: "answered", value: v as -2 | -1 | 0 | 1 | 2 } },
      };
      return computeMatch({ s1: { value: 2 } }, [subject])[0]!.matchPct!;
    });
    expect(percentatges).toEqual([100, 75, 50, 25, 0]);
  });

  it("es manté sempre dins de 0–100", () => {
    const totEsquivat: Subject = {
      id: "z",
      name: "Z",
      positions: { s1: { kind: "no_position" }, s2: { kind: "no_position" }, s3: { kind: "no_position" } },
    };
    const [z] = computeMatch(answers, [totEsquivat]);
    expect(z!.matchPct).toBe(0); // seria negatiu; s'acota a 0
  });

  it("desempata per l'encert a les afirmacions marcades com a importants", () => {
    const user: Record<string, UserAnswer> = {
      q1: { value: 2, important: true },
      q2: { value: 2 },
    };
    // Els dos sumen el mateix, però D encerta la que a l'usuari li importa.
    const d: Subject = {
      id: "D", name: "D",
      positions: { q1: { kind: "answered", value: 2 }, q2: { kind: "answered", value: 0 } },
    };
    const e: Subject = {
      id: "E", name: "E",
      positions: { q1: { kind: "answered", value: 1 }, q2: { kind: "answered", value: 2 } },
    };
    const results = computeMatch(user, [e, d]);
    expect(results[0]!.matchPct).toBe(results[1]!.matchPct);
    expect(results[0]!.subjectId).toBe("D");
  });

  it("no classifica ningú si l'usuari no ha respost res", () => {
    const results = computeMatch({}, [partitA, partitB]);
    expect(results.every((r) => !r.classified)).toBe(true);
  });
});

describe("pesos", () => {
  it("multiplica per 2 la importància de l'usuari i per 2 la prioritat del partit", () => {
    expect(weightFor(false, false)).toBe(1);
    expect(weightFor(true, false)).toBe(2);
    expect(weightFor(false, true)).toBe(2);
    expect(weightFor(true, true)).toBe(4);
  });
});

describe("empats i shoot-out", () => {
  it("detecta els subjectes empatats al capdamunt", () => {
    const bessons = ["F", "G"].map((id): Subject => ({
      id, name: id,
      positions: { s1: { kind: "answered", value: 2 }, s2: { kind: "answered", value: -1 }, s3: { kind: "answered", value: 0 } },
    }));
    const results = computeMatch(answers, bessons);
    expect(tiedLeaders(results).map((r) => r.subjectId).sort()).toEqual(["F", "G"]);
    expect(needsShootOut(results)).toBe(true);
  });

  it("no demana shoot-out quan el primer va destacat", () => {
    expect(needsShootOut(computeMatch(answers, [partitA, partitB]))).toBe(false);
  });
});
