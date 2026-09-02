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

describe("família i errates d'una lletra (els catorze municipis que quedaven en gris el 2-9-2026)", () => {
  const c = (candidatureId: number, sigles: string, seats: number, brandId: string | null = null): MatchCandidate => ({
    candidatureId, sigles, agrupacioSigles: null, brandId, seats,
  });
  it("«CP» és la Candidatura de Progrés de Vilaller", () => {
    const m = matchMayorParty("CP", [c(1, "MÉS X VILALLER-CANDIDATURA DE PROGRÉS", 4, "psc"), c(2, "JUNTS PER VILALLER CM", 2, "junts"), c(3, "ERC-AM", 1, "erc")]);
    expect(m?.candidatureId).toBe(1);
    expect(m?.method).toBe("família");
  });
  it("«PLV/ERC» és la llista de la Vall de Boí amb codi d'agrupació d'ERC", () => {
    expect(matchMayorParty("PLV/ERC", [c(1, "PER LA VALL-ACORD MUNICIPAL", 5, "erc"), c(2, "JUNTS PER LA VALL DE BOÍ CM", 3, "junts")])?.candidatureId).toBe(1);
  });
  it("«IxSC» és «ISC-IdSELVA» sense la x de «per»", () => {
    expect(matchMayorParty("IxSC", [c(1, "CM", 5), c(2, "CUP-AMUNT", 4), c(3, "ISC-IdSELVA", 4), c(4, "ERC-AM", 3), c(5, "PSC-CP", 1)])?.candidatureId).toBe(3);
  });
  it("«HORITZÓ31» és «HORITZÓ32», i «AMUNT» és «AMONT»", () => {
    expect(matchMayorParty("HORITZÓ31", [c(1, "ERC-AM", 5), c(2, "HORITZÓ32", 5), c(3, "CM", 1)])?.candidatureId).toBe(2);
    expect(matchMayorParty("AMUNT", [c(1, "VALL DE CARDÓS AMONT", 5), c(2, "NOVA VALL DE CARDÓS-ACORD MUNICIPAL", 2)])?.candidatureId).toBe(1);
  });
  it("«SumemxS-PS» és «Sumen per Salou-PSC-CP»", () => {
    expect(matchMayorParty("SumemxS-PS", [c(1, "Sumen per Salou-PSC-CP", 8, "psc"), c(2, "ERC-AM", 4), c(3, "PP", 3), c(4, "VOX", 3), c(5, "ARA PL", 2), c(6, "USAP", 1)])?.candidatureId).toBe(1);
  });
  it("«JxMontb» és Junts, però a Montblanc hi ha dues llistes de la família (CM i JUNTSXMTB): no es tria", () => {
    expect(matchMayorParty("JxMontb", [c(1, "CM", 5), c(2, "JUNTSXMTB-ARA PL", 3, "junts"), c(3, "EM-AM", 3), c(4, "DP-FIC", 1), c(5, "PSC-CP", 1)])).toBeNull();
    expect(matchMayorParty("JxMontb", [c(2, "JUNTSXMTB-ARA PL", 3, "junts"), c(3, "EM-AM", 3), c(5, "PSC-CP", 1)])?.candidatureId).toBe(2);
  });
  it("un no adscrit no lliga amb ningú, i una lletra de marge no fa lligar sigles curtes", () => {
    expect(matchMayorParty("No adscrit", [c(1, "iVDV", 6), c(2, "UpVV", 5), c(3, "PSC-CP", 2)])).toBeNull();
    expect(matchMayorParty("UFP", [c(1, "CM", 4), c(2, "GdF-AM", 2), c(3, "ASG-X TU", 1)])).toBeNull();
  });
});
