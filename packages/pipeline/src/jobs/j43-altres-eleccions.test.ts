import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { siglesFamily } from "@quivoto/shared-schemas/brands";
import {
  ELECCIONS_ALTRES,
  FAMILIA_SIGLES_NACIONALS,
  LLISTES_DESADES,
  eleccioDelMunicipi,
  eleccionsAltresDelMunicipi,
  codiIne,
  esResidentsAbsents,
  familiaNacional,
  type FilaParticipacioAltres,
  type FilaVots,
} from "./j43-altres-eleccions";

/**
 * Les files són les reals dels conjunts `ntc4-rnwr` i `irrv-2mfc` del 27
 * d'octubre del 2026, retallades a quatre municipis i a les cinc eleccions:
 * Abrera (on el PSC guanya a totes), Barcelona (totes les llistes de cada
 * elecció), Ripoll (Aliança Catalana) i Meranges (un centenar d'electors).
 */
const FIXTURES = join(__dirname, "..", "adapters", "__fixtures__");
const vots: FilaVots[] = JSON.parse(readFileSync(join(FIXTURES, "gencat-altres-eleccions-vots.json"), "utf8"));
const participacio: FilaParticipacioAltres[] = JSON.parse(
  readFileSync(join(FIXTURES, "gencat-altres-eleccions-participacio.json"), "utf8"),
);
const de = (ine5: string) =>
  eleccionsAltresDelMunicipi(
    vots.filter((f) => codiIne(f.territori_codi) === ine5),
    participacio.filter((f) => codiIne(f.territori_codi) === ine5),
  );

describe("la llista d'eleccions", () => {
  it("les tres principals primer, i la de just abans al Parlament i al Congrés", () => {
    expect(ELECCIONS_ALTRES.map((e) => e.id)).toEqual(["A20241", "G20231", "E20241", "A20211", "G20192"]);
    expect(ELECCIONS_ALTRES.filter((e) => e.principal).map((e) => e.tipus)).toEqual(["parlament", "generals", "europees"]);
  });

  it("els «Residents absents» no són cap municipi", () => {
    expect(esResidentsAbsents("08998")).toBe(true);
    expect(esResidentsAbsents("43998")).toBe(true);
    expect(esResidentsAbsents("08019")).toBe(false);
    expect(esResidentsAbsents("25099")).toBe(false);
    expect(esResidentsAbsents("8998")).toBe(true);
  });

  it("les europees del 2024 porten «8001» per Abrera: el codi es refà a cinc xifres", () => {
    expect(vots.some((f) => f.id_eleccio === "E20241" && f.territori_codi === "8001")).toBe(true);
    expect(codiIne("8001")).toBe("08001");
    expect(codiIne("17147")).toBe("17147");
  });
});

describe("familiaNacional", () => {
  it("cada sigla nacional de les cinc eleccions va a la seva família", () => {
    const esperat: Record<string, string> = {
      PSC: "psc", ERC: "erc", "ERC-ARA REPÚBL": "erc", "ERC-SOBIRANISTES": "erc",
      "CAT-JUNTS+": "junts", JxCat: "junts", "JxCAT-JUNTS": "junts", "JxCAT - JUNTS": "junts",
      PP: "pp", VOX: "vox", Cs: "cs", CS: "cs",
      "COMUNS SUMAR": "comuns", "SUMAR - ECP": "comuns", "ECP-PEC": "comuns", "ECP-GUANYEM": "comuns",
      PODEMOS: "podem",
      "CUP - DT": "cup", "CUP-G": "cup", "CUP-PR": "cup",
      "ALIANÇA.CAT": "aliancacat",
      PDeCAT: "pdecat", "PDeCAT-E-CiU": "pdecat", PNC: "pdecat",
    };
    for (const [sigles, familia] of Object.entries(esperat)) expect(familiaNacional(sigles), sigles).toBe(familia);
  });

  it("Podemos només el sap la taula: `siglesFamily()` no hi arriba", () => {
    expect(siglesFamily("PODEMOS")).toBeNull();
    expect(FAMILIA_SIGLES_NACIONALS.podemos).toBe("podem");
    expect(familiaNacional("Podemos")).toBe("podem");
  });

  it("les llistes sense família són «altres», no una família endevinada", () => {
    for (const sigles of ["PACMA", "AE Se acabó Fiesta", "MÁS PAÍS", "FO", "PCTC", "RECORTES CERO-GV-M", "ESCONS EN BLANC", "ALHORA", "FNC"]) {
      expect(familiaNacional(sigles), sigles).toBeNull();
    }
  });

  it("totes les sigles del fixture amb més d'un 3 % a Barcelona tenen família", () => {
    const bcn = de("08019").eleccions;
    for (const e of bcn) {
      for (const l of e.llistes.filter((l) => l.pct >= 3 && !/Se acab/.test(l.sigles))) {
        expect(l.familia, `${e.id} ${l.sigles}`).not.toBeNull();
      }
    }
  });
});

describe("eleccionsAltresDelMunicipi", () => {
  it("Abrera: cinc eleccions, amb la participació calculada i el PSC primer a totes", () => {
    const { eleccions, buits } = de("08001");
    expect(buits).toEqual([]);
    expect(eleccions.map((e) => e.id)).toEqual(["A20241", "G20231", "E20241", "A20211", "G20192"]);
    const a24 = eleccions[0]!;
    expect(a24.llistes[0]).toMatchObject({ sigles: "PSC", vots: 2097, familia: "psc", color: "#E20A16" });
    expect(a24.llistes).toHaveLength(LLISTES_DESADES);
    expect(a24.cens).not.toBeNull();
    expect(a24.participacio).toBe(Math.round((1000 * a24.votants!) / a24.cens!) / 10);
    for (const e of eleccions.slice(0, 3)) expect(e.llistes[0]!.familia).toBe("psc");
  });

  it("els vots a candidatures més els blancs fan els vàlids, i els percentatges sumen 100", () => {
    for (const ine5 of ["08001", "08019", "17147", "17099"]) {
      for (const e of de(ine5).eleccions) {
        expect(e.votsCandidatures + e.blancs!, `${ine5} ${e.id}`).toBe(e.vots_valids);
        const suma = e.llistes.reduce((s, l) => s + l.vots, 0) + (e.altres?.vots ?? 0);
        expect(suma).toBe(e.votsCandidatures);
        const pct = e.llistes.reduce((s, l) => s + l.pct, 0) + (e.altres?.pct ?? 0);
        expect(Math.abs(pct - 100)).toBeLessThan(0.5);
      }
    }
  });

  it("Barcelona a les europees: sis llistes amb nom i la resta juntes a «altres»", () => {
    const e24 = de("08019").eleccions.find((e) => e.id === "E20241")!;
    expect(e24.llistes).toHaveLength(6);
    expect(e24.altres!.llistes).toBeGreaterThan(20);
    // Podemos va per separat dels Comuns, i cadascú a la seva família.
    expect(e24.families.podem).toBeGreaterThan(0);
    expect(e24.families.comuns).toBeGreaterThan(0);
  });

  it("Ripoll: Aliança Catalana al Parlament del 2024, amb la seva família", () => {
    const a24 = de("17147").eleccions[0]!;
    const ac = a24.llistes.find((l) => l.sigles === "ALIANÇA.CAT")!;
    expect(ac.familia).toBe("aliancacat");
    expect(a24.families.aliancacat).toBe(ac.pct);
  });

  it("una elecció sense cap fila és un buit, no un zero", () => {
    const { eleccions, buits } = eleccionsAltresDelMunicipi(
      vots.filter((f) => f.territori_codi === "17099" && f.id_eleccio !== "E20241"),
      participacio.filter((f) => f.territori_codi === "17099" && f.id_eleccio !== "E20241"),
    );
    expect(buits).toEqual(["E20241"]);
    expect(eleccions).toHaveLength(4);
  });

  it("sense participació la elecció hi és igual, amb la participació a null", () => {
    const e = eleccioDelMunicipi(ELECCIONS_ALTRES[0]!, [
      { id_eleccio: "A20241", territori_codi: "99999", candidatura_sigles: "PSC", vots: "30", candidatura_color: "blau" },
      { id_eleccio: "A20241", territori_codi: "99999", candidatura_sigles: "PP", vots: "10" },
    ], undefined)!;
    expect(e.participacio).toBeNull();
    expect(e.llistes.map((l) => [l.sigles, l.pct, l.color])).toEqual([["PSC", 75, null], ["PP", 25, null]]);
    expect(e.altres).toBeNull();
    expect(e.families).toEqual({ psc: 75, pp: 25 });
  });

  it("sense vots ni participació no hi ha elecció", () => {
    expect(eleccioDelMunicipi(ELECCIONS_ALTRES[0]!, [], undefined)).toBeNull();
  });
});
