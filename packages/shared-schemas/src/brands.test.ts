import { describe, expect, it } from "vitest";
import { resolveBrand, sameForce, siglesFamily } from "./brands";

describe("siglesFamily", () => {
  it("reconeix la mateixa força sota noms diferents al llarg dels anys", () => {
    // Els noms reals amb què el PSC ha guanyat Esplugues des del 1979.
    for (const sigles of ["PSC-PSOE", "PSC-PM", "PSC-CP", "PSC CP", "PSCPMC", "PSC-UNITS-CP"]) {
      expect(siglesFamily(sigles), sigles).toBe("psc");
    }
    expect(siglesFamily("CiU")).toBe("ciu");
    expect(siglesFamily("JxCAT-JUNTS")).toBe("junts");
    expect(siglesFamily("ERC-AM")).toBe("erc");
    expect(siglesFamily("ICV-EUiA")).toBe("comuns");
    expect(siglesFamily("CUP-PA")).toBe("cup");
  });

  it("no atribueix cap família a una llista local", () => {
    expect(siglesFamily("Gent de Capolat")).toBeNull();
    expect(siglesFamily("UxA")).toBeNull();
  });
});

describe("sameForce", () => {
  it("no compta una alternança quan només canvia el nom", () => {
    expect(sameForce("PSC-PSOE", "PSC-CP")).toBe(true);
    expect(sameForce("CiU", "CIU")).toBe(true);
    expect(sameForce("Independents per Móra", "Independents Móra")).toBe(true);
  });

  it("detecta un canvi de mans de veritat", () => {
    expect(sameForce("PSC-CP", "CiU")).toBe(false);
    expect(sameForce("ERC-AM", "JxCAT-JUNTS")).toBe(false);
    expect(sameForce("CUP-PA", "PP")).toBe(false);
  });

  it("davant del dubte no afirma que hi hagi hagut canvi", () => {
    expect(sameForce(null, "PSC")).toBe(true);
    expect(sameForce("PSC", undefined)).toBe(true);
  });

  it("CiU i Junts es compten com a forces diferents, que és el que van ser a les urnes", () => {
    expect(sameForce("CiU", "JxCAT-JUNTS")).toBe(false);
  });
});

describe("resolveBrand", () => {
  it("resol les agrupacions conegudes de cada elecció", () => {
    expect(resolveBrand("M20231", "20231127").brandId).toBe("erc");
    expect(resolveBrand("M20191", "2019839").brandId).toBe("erc");
    expect(resolveBrand("M20151", "2015012").brandId).toBe("ciu");
  });

  it("marca per revisar el que no coneix, en comptes d'endevinar-ho", () => {
    const unknown = resolveBrand("M20231", "999999");
    expect(unknown.brandId).toBe("local");
    expect(unknown.needsReview).toBe(true);
  });
});

describe("sameForce amb coalicions locals", () => {
  it("veu la marca amagada dins d'una coalició local", () => {
    // Casos reals de la composició dels plens del 2023.
    expect(sameForce("UA-PSC-CP", "PSC-CP")).toBe(true);
    expect(sameForce("SP-CUP-AM", "CUP-AMUNT")).toBe(true);
    expect(sameForce("ERC-EUiA-AM", "ERC / ESQUERRA")).toBe(true);
    expect(sameForce("JUNTS-CM", "CM")).toBe(true);
  });

  it("segueix distingint un canvi de bàndol real", () => {
    expect(sameForce("PSC-CP", "CM")).toBe(false);
    expect(sameForce("ERC-AM", "PP")).toBe(false);
  });

  it("no tria marca quan la coalició en barreja dues", () => {
    // «ERC-EUiA» apunta a dues famílies alhora: no n'afirmem cap.
    expect(siglesFamily("Gent-i-Poble")).toBeNull();
  });
});

describe("les coalicions «en comú», que porten la marca al mig", () => {
  it("reconeix la família encara que el nom comenci per la ciutat", () => {
    expect(siglesFamily("Barcelona en Comú-C")).toBe("comuns");
    expect(siglesFamily("BCN en Comú - C")).toBe("comuns");
  });

  it("no endevina les sigles que amaguen la marca dins d'un acrònim", () => {
    // «LHECP» és l'Hospitalet En Comú Podem, i no hi ha manera de saber-ho
    // sense una taula a mà. Val més no reconèixer-la que inventar-se una
    // regla que un dia atribuirà un regidor al partit que no toca.
    expect(siglesFamily("LHECP-C")).toBeNull();
  });

  it("i per tant les lliga entre elles", () => {
    expect(sameForce("Barcelona en Comú-C", "BCN en Comú - C")).toBe(true);
  });
});
