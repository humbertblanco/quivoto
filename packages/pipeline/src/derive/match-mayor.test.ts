import { describe, expect, it } from "vitest";
import { matchMayorParty, type MatchCandidate } from "./match-mayor";

/** Castellar del Vallès, 2023: dades reals de la ingesta. */
const castellar: MatchCandidate[] = [
  { candidatureId: 1, sigles: "ERC-AM", agrupacioSigles: "AM", brandId: "erc", seats: 4 },
  { candidatureId: 2, sigles: "SOM DE CASTELLAR-PSC-CP", agrupacioSigles: "PSC-CP", brandId: "psc", seats: 12 },
  { candidatureId: 3, sigles: "CM", agrupacioSigles: "CM", brandId: "junts", seats: 3 },
  { candidatureId: 4, sigles: "CUP-AMUNT", agrupacioSigles: "AMUNT", brandId: "cup", seats: 1 },
  { candidatureId: 5, sigles: "ARA PL", agrupacioSigles: "ARA PL", brandId: "pdecat", seats: 1 },
];

describe("matchMayorParty", () => {
  it("lliga un nom truncat pel prefix", () => {
    // «araC-A» al padró; la llista es diu «araC-AM».
    const castellcir: MatchCandidate[] = [
      { candidatureId: 9, sigles: "araC-AM", agrupacioSigles: "AM", brandId: "erc", seats: 7 },
      { candidatureId: 10, sigles: "CM", agrupacioSigles: "CM", brandId: "junts", seats: 0 },
    ];
    const match = matchMayorParty("araC-A", castellcir);
    expect(match?.candidatureId).toBe(9);
  });

  it("lliga pel codi d'agrupació del final", () => {
    // «ERC - AM» normalitzat ja coincideix amb les sigles «ERC-AM».
    expect(matchMayorParty("ERC - AM", castellar)?.candidatureId).toBe(1);
    // Aquí el nom no diu res de la llista i només serveix el codi del final.
    const sumem: MatchCandidate[] = [
      { candidatureId: 20, sigles: "SUMEM PER GIRONA", agrupacioSigles: "AM", brandId: "erc", seats: 6 },
      { candidatureId: 21, sigles: "PSC-CP", agrupacioSigles: "PSC-CP", brandId: "psc", seats: 3 },
    ];
    const match = matchMayorParty("SUMEM - AM", sumem);
    expect(match?.candidatureId).toBe(20);
  });

  it("lliga «SOMC-PSC-C» amb «SOM DE CASTELLAR-PSC-CP»", () => {
    const match = matchMayorParty("SOMC-PSC-C", castellar);
    expect(match?.candidatureId).toBe(2);
  });

  it("resol el cas trivial d'un sol grup al ple", () => {
    const match = matchMayorParty("El que sigui", [
      { candidatureId: 7, sigles: "UxA", agrupacioSigles: "ALTRES", brandId: "local", seats: 7 },
      { candidatureId: 8, sigles: "CM", agrupacioSigles: "CM", brandId: "junts", seats: 0 },
    ]);
    expect(match?.candidatureId).toBe(7);
    expect(match?.method).toBe("únic-amb-escons");
  });

  it("no inventa un aparellament quan és ambigu", () => {
    // Dues llistes amb la mateixa agrupació: no es pot decidir.
    expect(
      matchMayorParty("AM", [
        { candidatureId: 1, sigles: "A-AM", agrupacioSigles: "AM", brandId: "erc", seats: 3 },
        { candidatureId: 2, sigles: "B-AM", agrupacioSigles: "AM", brandId: "erc", seats: 2 },
      ]),
    ).toBeNull();
  });

  it("torna null si no hi ha ningú amb escons", () => {
    expect(matchMayorParty("PSC", [{ candidatureId: 1, sigles: "PSC", agrupacioSigles: "PSC-CP", brandId: "psc", seats: 0 }])).toBeNull();
  });

  it("marca amb menys confiança els aparellaments febles", () => {
    const match = matchMayorParty("SOMC-PSC-C", castellar);
    expect(match!.confidence).toBeLessThanOrEqual(1);
    expect(match!.confidence).toBeGreaterThan(0.6);
  });
});
