import { describe, expect, it } from "vitest";
import { familiaDeCadaLlista } from "./families";

describe("una família, una llista per elecció", () => {
  it("Badalona 2015: Guanyem i ICV van per separat", () => {
    const f = familiaDeCadaLlista([
      { sigles: "PP", seats: 10 },
      { sigles: "Guanyem Badalona en Comú", seats: 5 },
      { sigles: "PSC-CP", seats: 4 },
      { sigles: "ERC-AM", seats: 3 },
      { sigles: "CiU", seats: 2 },
      { sigles: "ICV-EUiA-E", seats: 2 },
      { sigles: "C's", seats: 1 },
    ]);
    expect(f[1]).toBe("local");
    expect(f[5]).toBe("comuns");
    expect(f[0]).toBe("pp");
  });
  it("sense doblet, no toca res", () => {
    expect(familiaDeCadaLlista([{ sigles: "ERC-AM", seats: 5 }, { sigles: "JUNTS", seats: 4 }])).toEqual(["erc", "junts"]);
  });
  it("amb dues llistes que porten la marca al davant, es queda la que té més regidories", () => {
    expect(familiaDeCadaLlista([{ sigles: "ERC-AM", seats: 2 }, { sigles: "ERC-MES-AM", seats: 5 }])).toEqual(["local", "erc"]);
  });
});
