import { describe, expect, it } from "vitest";
import { triaFrase, type OgMunicipi } from "./og";

/** Un municipi mínim, al qual cada prova hi afegeix només el que li interessa. */
function municipi(canvis: Partial<OgMunicipi> = {}): OgMunicipi {
  return {
    slug: "vilaprova",
    name: "Vilaprova",
    comarca: "Comarca de Prova",
    government: {
      mayorName: "Anna Puig Roca", mayorSigles: "ERC-AM", mayorSeats: 6,
      winnerSigles: "ERC-AM", winnerSeats: 6, totalSeats: 11,
      winnerGoverns: true, winnerHasMajority: true,
    },
    mayors: null,
    history: null,
    results: null,
    singleList: false,
    ...canvis,
  };
}

const pla = (html: string): string => html.replace(/<[^>]+>/g, "");

describe("triaFrase", () => {
  it("posa per davant el canvi d'alcaldia a mig mandat, encara que hi hagi pacte i llista única", () => {
    const frase = triaFrase(municipi({
      singleList: true,
      government: { ...municipi().government!, winnerGoverns: false, winnerSigles: "JxV" },
      mayors: { currentTermChange: { term: "2023-2027", mayors: [{ name: "Marta Vidal Puig", tookOfficeOn: "2025-06-14" }] } },
    }));
    expect(frase.regla).toBe("canvi-alcaldia");
    expect(frase.banda).toBe("presec");
    expect(pla(frase.html)).toContain("Marta Vidal Puig");
    expect(pla(frase.html)).toContain("juny del 2025");
  });

  it("diu que mana qui no va guanyar, i ho pinta de lavanda", () => {
    const frase = triaFrase(municipi({
      government: { ...municipi().government!, winnerGoverns: false, winnerSigles: "JxV", mayorSigles: "PSC-CP", mayorSeats: 3 },
    }));
    expect(frase.regla).toBe("pacte");
    expect(frase.banda).toBe("lavanda");
    expect(pla(frase.html)).toBe("Hi va guanyar JxV, però mana PSC-CP, amb 3 dels 11 regidors.");
  });

  it("avisa dels ajuntaments sense oposició", () => {
    expect(triaFrase(municipi({ singleList: true })).regla).toBe("llista-unica");
  });

  it("compta la ratxa de la mateixa força a partir de quatre eleccions seguides", () => {
    const serie = (families: string[]) => ({
      series: families.map((winnerFamily, i) => ({ year: 2007 + i * 4, winnerFamily })),
    });
    expect(triaFrase(municipi({ history: serie(["psc", "erc", "erc", "erc"]) })).regla).toBe("qui-mana");
    const quatre = triaFrase(municipi({ history: serie(["psc", "erc", "erc", "erc", "erc"]) }));
    expect(quatre.regla).toBe("ratxa");
    expect(pla(quatre.html)).toBe("Hi guanya ERC des del 2011: 4 eleccions municipals seguides.");
  });

  it("no diu mai que «la mateixa força» hi guanya quan són llistes locals", () => {
    // Sota `local` hi ha totes les agrupacions d'electors, i dues llistes locals
    // de dues eleccions diferents no són la mateixa força.
    const history = { series: [1999, 2003, 2007, 2011, 2015, 2019, 2023].map((year) => ({ year, winnerFamily: "local" })) };
    expect(triaFrase(municipi({ history })).regla).toBe("qui-mana");
  });

  it("distingeix la majoria absoluta del govern en minoria", () => {
    expect(pla(triaFrase(municipi()).html)).toBe("Mana Anna Puig Roca (ERC-AM) amb majoria absoluta: 6 dels 11 regidors.");
    const minoria = municipi({ government: { ...municipi().government!, mayorSeats: 4 } });
    expect(pla(triaFrase(minoria).html)).toBe("Mana Anna Puig Roca (ERC-AM) sense majoria: 4 dels 11 regidors.");
  });

  it("canvia el codi de coalició per la família política, que és el que es reconeix", () => {
    // «CM» és Compromís Municipal i surt com a sigles a 338 municipis: sol no diu res.
    const amb = municipi({
      government: { ...municipi().government!, mayorSigles: "CM", winnerSigles: "CM" },
      results: { M20231: { candidatures: [{ sigles: "CM", brandId: "junts" }] } },
    });
    expect(pla(triaFrase(amb).html)).toBe("Mana Anna Puig Roca (Junts) amb majoria absoluta: 6 dels 11 regidors.");
  });

  it("canvia les sigles que no caben per la família, en comptes de tallar-les", () => {
    const llargues = "VIU SORIGUERA-ESQUERRA REPUBLICANA DE CATALUNYA-ACORD MUNICIPAL";
    const amb = municipi({
      government: { ...municipi().government!, mayorSigles: llargues },
      results: { M20231: { candidatures: [{ sigles: llargues, brandId: "erc" }] } },
    });
    expect(pla(triaFrase(amb).html)).toContain("(ERC)");
    expect(pla(triaFrase(amb).html)).not.toContain("…");
  });

  it("no crida amb majúscules i escriu en minúscula la «i» dels cognoms", () => {
    const cridant = municipi({ government: { ...municipi().government!, mayorName: "JOAN SOLÀ I FONT" } });
    expect(pla(triaFrase(cridant).html)).toContain("Joan Solà i Font");
  });

  it("cau al guanyador quan no sap de quina llista és l'alcaldia", () => {
    const orfe = municipi({
      government: { ...municipi().government!, mayorSigles: null, mayorSeats: null, winnerSigles: "CM", winnerSeats: 6 },
      results: { M20231: { candidatures: [{ sigles: "CM", brandId: "junts" }] } },
    });
    const frase = triaFrase(orfe);
    expect(frase.regla).toBe("guanyador");
    expect(pla(frase.html)).toBe("El 2023 hi va guanyar Junts, amb 6 dels 11 regidors.");
  });

  it("sempre en surt una frase, fins i tot sense cap dada", () => {
    const buit = triaFrase(municipi({ government: null }));
    expect(buit.regla).toBe("sense-dades");
    expect(pla(buit.html).length).toBeGreaterThan(10);
  });

  it("escapa el que ve de la font i només hi deixa passar <b>", () => {
    const brut = municipi({ government: { ...municipi().government!, mayorName: "Anna <script>alert(1)</script> & Cia" } });
    const html = triaFrase(brut).html;
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html.replace(/<\/?b>/g, "")).not.toMatch(/<[^>]/);
  });
});
