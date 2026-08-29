import { describe, expect, it } from "vitest";
import { absoluteMajority, councilSeats, dHondt, effectiveParties } from "./seats";

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
