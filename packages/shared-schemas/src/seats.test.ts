import { describe, expect, it } from "vitest";
import { absoluteMajority, councilSeats, dHondt, effectiveParties, margesDHondt, type DHondtCandidature } from "./seats";

describe("councilSeats (LOREG art. 179)", () => {
  it("aplica els trams fixos fins a 100.000 residents", () => {
    expect(councilSeats(0)).toBe(3);
    expect(councilSeats(100)).toBe(3);
    expect(councilSeats(101)).toBe(5);
    expect(councilSeats(250)).toBe(5);
    expect(councilSeats(1_000)).toBe(7);
    expect(councilSeats(2_000)).toBe(9);
    expect(councilSeats(5_000)).toBe(11);
    expect(councilSeats(10_000)).toBe(13);
    expect(councilSeats(20_000)).toBe(17);
    expect(councilSeats(50_000)).toBe(21);
    expect(councilSeats(100_000)).toBe(25);
  });

  it("reprodueix els plens reals del mandat 2023-2027", () => {
    expect(councilSeats(225_368)).toBe(27); // Sabadell
    expect(councilSeats(108_666)).toBe(27); // Girona
    expect(councilSeats(111_601)).toBe(27); // Reus
    expect(councilSeats(289_510)).toBe(27); // L'Hospitalet
    expect(councilSeats(1_636_193)).toBe(41); // Barcelona amb el padró del 2022
    expect(councilSeats(3_280_000)).toBe(57); // Madrid, com a control fora de Catalunya
  });

  it("el ple sempre té un nombre senar de regidors", () => {
    for (let pop = 0; pop < 4_000_000; pop += 7_919) {
      expect(councilSeats(pop) % 2).toBe(1);
    }
  });

  it("no decreix mai amb la població", () => {
    let previous = 0;
    for (let pop = 0; pop < 2_000_000; pop += 1_013) {
      const seats = councilSeats(pop);
      expect(seats).toBeGreaterThanOrEqual(previous);
      previous = seats;
    }
  });

  it("rebutja poblacions impossibles", () => {
    expect(() => councilSeats(-1)).toThrow(RangeError);
    expect(() => councilSeats(Number.NaN)).toThrow(RangeError);
  });
});

describe("dHondt", () => {
  /** Sabadell 2023, dades oficials de `ntc4-rnwr` (verificat 28-08-2026). */
  const sabadell2023 = [
    { id: "PSC-CP", votes: 35_799, seats: 14 },
    { id: "ERC-EUiA-AM", votes: 8_592, seats: 3 },
    { id: "CpS-AMUNT", votes: 8_018, seats: 3 },
    { id: "CM", votes: 6_319, seats: 2 },
    { id: "SECP -C", votes: 5_636, seats: 2 },
    { id: "VOX", votes: 5_087, seats: 2 },
    { id: "PP", votes: 4_557, seats: 1 },
    { id: "SSBD", votes: 939, seats: 0 },
    { id: "Cs", votes: 884, seats: 0 },
    { id: "PDeCAT-ARA PL", votes: 400, seats: 0 },
    { id: "VALENTS", votes: 289, seats: 0 },
  ];

  it("reprodueix el repartiment oficial de Sabadell 2023", () => {
    const result = dHondt(sabadell2023, 27);
    for (const c of sabadell2023) {
      expect(result.seats[c.id], `escons de ${c.id}`).toBe(c.seats);
    }
    expect(result.drawNeeded).toBe(false);
  });

  it("aplica la barrera del 5% dels vots vàlids", () => {
    const result = dHondt(sabadell2023, 27);
    expect(result.excluded).toContain("SSBD"); // 939 vots = 1,2%
    expect(result.excluded).not.toContain("PP"); // 4.557 vots = 6,0%
  });

  it("reparteix tots els escons quan hi ha candidatures elegibles", () => {
    const result = dHondt(sabadell2023, 27);
    const total = Object.values(result.seats).reduce((a, b) => a + b, 0);
    expect(total).toBe(27);
  });

  it("marca el sorteig quan dues candidatures empaten en quocient i en vots", () => {
    const result = dHondt([{ id: "A", votes: 100 }, { id: "B", votes: 100 }], 3);
    expect(result.drawNeeded).toBe(true);
    expect(result.seats.A! + result.seats.B!).toBe(3);
  });

  it("no adjudica escons si cap candidatura passa la barrera", () => {
    const result = dHondt([{ id: "A", votes: 1 }], 5, { validVotes: 1_000_000 });
    expect(result.seats.A).toBe(0);
  });
});

describe("indicadors derivats", () => {
  it("compta els partits efectius del ple", () => {
    expect(effectiveParties([27])).toBeCloseTo(1);
    expect(effectiveParties([14, 13])).toBeCloseTo(1.998, 2);
    expect(effectiveParties([])).toBe(0);
  });

  it("calcula la majoria absoluta", () => {
    expect(absoluteMajority(27)).toBe(14);
    expect(absoluteMajority(13)).toBe(7);
    expect(absoluteMajority(41)).toBe(21);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Els marges, comprovats a força bruta: sumant i restant vots d'un en un i
// tornant a passar la llei d'Hondt sencera, sense cap drecera.
// ─────────────────────────────────────────────────────────────────────────────

/** Escons de la llista `i` amb `delta` vots més, els vàlids moguts igual i els empats perfectes perduts. */
function esconsForcaBruta(
  llistes: readonly DHondtCandidature[], i: number, delta: number, escons: number, valids: number,
): number {
  const propia = llistes[i]!;
  const ordre = [...llistes.filter((_, j) => j !== i), { id: propia.id, votes: propia.votes + delta }];
  return dHondt(ordre, escons, { validVotes: valids + delta }).seats[propia.id] ?? 0;
}

function unaMesForcaBruta(llistes: readonly DHondtCandidature[], i: number, escons: number, valids: number): number | null {
  const ara = dHondt(llistes, escons, { validVotes: valids }).seats[llistes[i]!.id]!;
  if (ara >= escons) return null;
  for (let x = 0; x < 200_000; x += 1) {
    if (esconsForcaBruta(llistes, i, x, escons, valids) > ara) return x;
  }
  throw new Error("sense resposta");
}

function margeForcaBruta(llistes: readonly DHondtCandidature[], i: number, escons: number, valids: number): number | null {
  const ara = dHondt(llistes, escons, { validVotes: valids }).seats[llistes[i]!.id]!;
  if (ara === 0) return null;
  for (let y = 0; y <= llistes[i]!.votes; y += 1) {
    if (esconsForcaBruta(llistes, i, -y, escons, valids) < ara) return Math.max(0, y - 1);
  }
  throw new Error("sense resposta");
}

describe("margesDHondt", () => {
  /** Vic 2023 (dades de la fitxa publicada): vots de les set llistes amb regidoria i 372 en blanc. */
  const vic2023 = [
    { id: "CM", votes: 4_029 },
    { id: "ERC-AM", votes: 1_973 },
    { id: "CUP-AMUNT", votes: 1_727 },
    { id: "ARA VIC-ARA PL", votes: 1_504 },
    { id: "PSC-CP", votes: 1_282 },
    { id: "SOMI", votes: 1_194 },
    { id: "VECP-C", votes: 740 },
  ];
  const valids = vic2023.reduce((a, c) => a + c.votes, 0) + 372;

  it("Vic 2023: l'última regidoria va ser de Junts per Vic, i a Ara Vic li'n van faltar 7 vots", () => {
    const m = margesDHondt(vic2023, 21, { validVotes: valids });
    expect(m.llistes.map((l) => l.escons)).toEqual([8, 3, 3, 2, 2, 2, 1]);
    expect(m.ultimEsco).not.toBeNull();
    expect(m.ultimEsco!.guanyador).toBe("CM");
    expect(m.ultimEsco!.quocient).toBeCloseTo(4_029 / 8);
    expect(m.ultimEsco!.perseguidor).toBe("ARA VIC-ARA PL");
    // 3 × 503,625 = 1.510,875: amb 1.511 vots (7 més) el seu tercer quocient passa el de Junts.
    expect(m.ultimEsco!.votsQueFaltaven).toBe(7);
    expect(m.ultimEsco!.quocientPerseguidor).toBeCloseTo(1_504 / 3);
    // Junts tenia 8 de 21: la majoria absoluta és d'11.
    expect(m.majoriaAbsoluta).toMatchObject({ id: "CM", escons: 8, calen: 11 });
  });

  it("Vic 2023: cada xifra coincideix amb la força bruta", () => {
    const m = margesDHondt(vic2023, 21, { validVotes: valids });
    vic2023.forEach((_, i) => {
      expect(m.llistes[i]!.votsPerUnaMes, `una més ${vic2023[i]!.id}`).toBe(unaMesForcaBruta(vic2023, i, 21, valids));
      expect(m.llistes[i]!.margeDePerdua, `marge ${vic2023[i]!.id}`).toBe(margeForcaBruta(vic2023, i, 21, valids));
    });
    // La majoria de Junts: el primer nombre de vots que li en dona 11, i un menys no.
    const falten = m.majoriaAbsoluta!.votsQueFaltaven;
    expect(esconsForcaBruta(vic2023, 0, falten, 21, valids)).toBeGreaterThanOrEqual(11);
    expect(esconsForcaBruta(vic2023, 0, falten - 1, 21, valids)).toBeLessThan(11);
  });

  it("el perseguidor és qui necessita menys vots, no qui té el quocient següent més alt", () => {
    // A té el quocient següent més alt (1.000/5 = 200) però li calen 5 × 210 − 1.000 = 51 vots;
    // B, amb quocient 190, només 21. El darrer escó és de C (210).
    const llistes = [{ id: "A", votes: 1_000 }, { id: "B", votes: 190 }, { id: "C", votes: 210 }];
    const m = margesDHondt(llistes, 5, { validVotes: 1_400, threshold: 0 });
    expect(m.llistes.map((l) => l.escons)).toEqual([4, 0, 1]);
    expect(m.ultimEsco).toMatchObject({ perseguidor: "B", votsQueFaltaven: 21 });
  });

  it("una llista sota el 5 %: quants vots li faltaven, i que no té regidoria", () => {
    const llistes = [{ id: "A", votes: 600 }, { id: "B", votes: 350 }, { id: "PETITA", votes: 40 }];
    const m = margesDHondt(llistes, 9, { validVotes: 1_000 }); // 10 en blanc
    expect(m.llistes[2]).toMatchObject({ escons: 0, elegible: false, margeDePerdua: null });
    expect(m.sotaLlindar).toHaveLength(1);
    // 40 + x ≥ 5 % de (1.000 + x)  ⇔  x ≥ 10 / 0,95 = 10,5  ⇒  11.
    expect(m.sotaLlindar[0]).toMatchObject({ id: "PETITA", votsQueFaltaven: 11 });
    expect(m.sotaLlindar[0]!.pct).toBeCloseTo(4);
    expect(dHondt([...llistes.slice(0, 2), { id: "PETITA", votes: 51 }], 9, { validVotes: 1_011 }).excluded).not.toContain("PETITA");
    expect(dHondt([...llistes.slice(0, 2), { id: "PETITA", votes: 50 }], 9, { validVotes: 1_010 }).excluded).toContain("PETITA");
    // Per a una regidoria no n'hi ha prou de passar la barrera: també cal el quocient.
    expect(m.llistes[2]!.votsPerUnaMes).toBe(unaMesForcaBruta(llistes, 2, 9, 1_000));
    expect(m.llistes[2]!.votsPerUnaMes!).toBeGreaterThan(11);
  });

  it("una llista justa al 5 % que en créixer els vàlids queda fora", () => {
    // C té el 5 % exacte. Qualsevol vot nou d'A apuja la barrera i C cau: els seus escons
    // es reparteixen, i la bisecció ho ha de veure igual que la força bruta.
    const llistes = [{ id: "A", votes: 500 }, { id: "B", votes: 450 }, { id: "C", votes: 50 }];
    const m = margesDHondt(llistes, 21, { validVotes: 1_000 });
    for (let i = 0; i < llistes.length; i += 1) {
      expect(m.llistes[i]!.votsPerUnaMes).toBe(unaMesForcaBruta(llistes, i, 21, 1_000));
      expect(m.llistes[i]!.margeDePerdua).toBe(margeForcaBruta(llistes, i, 21, 1_000));
    }
    expect(m.llistes[2]!.margeDePerdua).toBe(0);
  });

  it("empats: el quocient igual el guanya qui té més vots (art. 163.1), i un empat perfecte no compta com a guanyat", () => {
    // Dues regidories: 200/2 = 100 i 100/1 = 100. A quocient igual, la segona és de qui té més
    // vots totals (A, 200 contra 100), i A se les queda totes dues.
    const llistes = [{ id: "A", votes: 200 }, { id: "B", votes: 100 }];
    const m = margesDHondt(llistes, 2, { validVotes: 300 });
    expect(m.llistes.map((l) => l.escons)).toEqual([2, 0]);
    expect(m.ultimEsco).toMatchObject({ guanyador: "A", quocient: 100, perseguidor: "B" });
    // A B, amb 100, l'empat de quocient no li serveix (té menys vots): li'n cal un més.
    expect(m.ultimEsco!.votsQueFaltaven).toBe(1);
    expect(m.llistes[1]!.votsPerUnaMes).toBe(unaMesForcaBruta(llistes, 1, 2, 300));
    // A no podia perdre cap vot: amb 199, 199/2 = 99,5 < 100 i la segona passa a B.
    expect(m.llistes[0]!.margeDePerdua).toBe(0);
    expect(m.llistes[0]!.margeDePerdua).toBe(margeForcaBruta(llistes, 0, 2, 300));
    expect(m.drawNeeded).toBe(false);

    // Empat perfecte (mateixos vots): la llei ho sorteja. Per a una llista, «una més» vol dir sense sorteig.
    const iguals = [{ id: "X", votes: 300 }, { id: "Y", votes: 300 }];
    const e = margesDHondt(iguals, 3, { validVotes: 600 });
    expect(e.drawNeeded).toBe(true);
    expect(e.llistes[1]!.votsPerUnaMes).toBe(unaMesForcaBruta(iguals, 1, 3, 600));
    expect(e.llistes[0]!.margeDePerdua).toBe(margeForcaBruta(iguals, 0, 3, 600));
  });

  it("una sola llista: les té totes, no hi ha últim escó en disputa ni majoria per buscar", () => {
    const m = margesDHondt([{ id: "SOLA", votes: 321 }], 7, { validVotes: 340 });
    expect(m.llistes[0]).toMatchObject({ escons: 7, votsPerUnaMes: null });
    // Les conserva totes mentre tingui un vot i passi la barrera (5 % de 340 − y).
    expect(m.llistes[0]!.margeDePerdua).toBe(margeForcaBruta([{ id: "SOLA", votes: 321 }], 0, 7, 340));
    expect(m.ultimEsco).toBeNull();
    expect(m.majoriaAbsoluta).toBeNull();
    expect(m.sotaLlindar).toEqual([]);
  });

  it("la majoria absoluta: null si ja la té", () => {
    const m = margesDHondt([{ id: "A", votes: 700 }, { id: "B", votes: 300 }], 11, { validVotes: 1_000 });
    expect(m.llistes[0]!.escons).toBeGreaterThanOrEqual(6);
    expect(m.majoriaAbsoluta).toBeNull();
  });

  it("coincideix amb la força bruta en 40 eleccions inventades", () => {
    // Generador pseudoaleatori amb llavor fixa: el test és sempre el mateix.
    let llavor = 20_230_528;
    const aleatori = (n: number) => {
      llavor = (llavor * 1_103_515_245 + 12_345) % 2_147_483_648;
      return llavor % n;
    };
    for (let cas = 0; cas < 40; cas += 1) {
      const n = 2 + aleatori(5);
      const llistes = Array.from({ length: n }, (_, i) => ({ id: `L${i}`, votes: 1 + aleatori(i === 0 ? 900 : 400) }));
      const escons = [5, 7, 9, 11, 13, 17][aleatori(6)]!;
      const valids = llistes.reduce((a, c) => a + c.votes, 0) + aleatori(60);
      const m = margesDHondt(llistes, escons, { validVotes: valids });
      llistes.forEach((l, i) => {
        expect(m.llistes[i]!.votsPerUnaMes, `cas ${cas} ${l.id} una més`).toBe(unaMesForcaBruta(llistes, i, escons, valids));
        expect(m.llistes[i]!.margeDePerdua, `cas ${cas} ${l.id} marge`).toBe(margeForcaBruta(llistes, i, escons, valids));
      });
      if (m.ultimEsco) {
        // Ningú altre necessitava menys vots que el perseguidor.
        const minim = Math.min(
          ...llistes.map((l, i) => (l.id === m.ultimEsco!.guanyador ? Infinity : unaMesForcaBruta(llistes, i, escons, valids) ?? Infinity)),
        );
        expect(m.ultimEsco.votsQueFaltaven).toBe(minim);
      }
      for (const s of m.sotaLlindar) {
        const i = llistes.findIndex((l) => l.id === s.id);
        const passa = (x: number) => !dHondt(
          [...llistes.filter((_, j) => j !== i), { id: s.id, votes: llistes[i]!.votes + x }], escons, { validVotes: valids + x },
        ).excluded.includes(s.id);
        expect(passa(s.votsQueFaltaven), `cas ${cas} ${s.id} llindar`).toBe(true);
        if (s.votsQueFaltaven > 0) expect(passa(s.votsQueFaltaven - 1)).toBe(false);
      }
    }
  });
});
