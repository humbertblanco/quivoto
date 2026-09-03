import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildPeerGroups } from "../derive/peers";
import {
  buitsDe,
  comparaDinsDelGrup,
  creixement,
  ELECCIONS_MUNICIPALS,
  eleccionsDelMunicipi,
  resumDe,
  type FilaParticipacio,
} from "./j36-cens-electoral";

/**
 * Les files són les reals del conjunt `irrv-2mfc` del 3 de setembre del
 * 2026, retallades a quatre municipis: Barcelona (dotze eleccions, cens que
 * baixa), Santpedor (dotze, cens que més que dobla), Badia del Vallès (des
 * del 1995, que es va segregar el 1994) i la Canonja (des del 2011).
 */
const FIXTURES = join(__dirname, "..", "adapters", "__fixtures__");
const totes: FilaParticipacio[] = JSON.parse(
  readFileSync(join(FIXTURES, "gencat-participacio-municipals.json"), "utf8"),
);
const de = (ine5: string): FilaParticipacio[] => totes.filter((f) => f.territori_codi === ine5);

describe("la llista d'eleccions", () => {
  it("són les dotze municipals, del 1979 al 2023, cada quatre anys", () => {
    expect(ELECCIONS_MUNICIPALS).toHaveLength(12);
    expect(ELECCIONS_MUNICIPALS[0]).toEqual({ id: "M19791", any: 1979, data: "1979-04-03" });
    expect(ELECCIONS_MUNICIPALS[11]).toEqual({ id: "M20231", any: 2023, data: "2023-05-28" });
    for (let i = 1; i < ELECCIONS_MUNICIPALS.length; i++) {
      expect(ELECCIONS_MUNICIPALS[i]!.any - ELECCIONS_MUNICIPALS[i - 1]!.any).toBe(4);
    }
  });
});

describe("eleccionsDelMunicipi", () => {
  it("Barcelona: dotze eleccions ordenades, amb la participació calculada a un decimal", () => {
    const bcn = eleccionsDelMunicipi(de("08019"));
    expect(bcn).toHaveLength(12);
    expect(bcn.map((e) => e.any)).toEqual([1979, 1983, 1987, 1991, 1995, 1999, 2003, 2007, 2011, 2015, 2019, 2023]);
    expect(bcn[0]).toEqual({
      id: "M19791", any: 1979, data: "1979-04-03",
      cens: 1480453, votants: 803419, participacio: 54.3,
      vots_valids: 800428, blancs: 2547, nuls: 2991,
    });
    expect(bcn[11]!.participacio).toBe(60.6);
    expect(buitsDe(bcn)).toEqual([]);
  });

  it("Badia del Vallès comença el 1995: les quatre primeres són buits, no zeros", () => {
    const badia = eleccionsDelMunicipi(de("08904"));
    expect(badia).toHaveLength(8);
    expect(badia[0]!.any).toBe(1995);
    expect(buitsDe(badia)).toEqual(["M19791", "M19831", "M19871", "M19911"]);
  });

  it("un cens a zero o uns votants buits no són una dada", () => {
    const files: FilaParticipacio[] = [
      { id_eleccio: "M19791", territori_codi: "00000", cens_electoral: "0", votants: "0" },
      { id_eleccio: "M19831", territori_codi: "00000", cens_electoral: "100" },
      { id_eleccio: "M19871", territori_codi: "00000", cens_electoral: "100", votants: "60" },
      { id_eleccio: "X20241", territori_codi: "00000", cens_electoral: "100", votants: "60" },
    ];
    const serie = eleccionsDelMunicipi(files);
    expect(serie.map((e) => e.id)).toEqual(["M19871"]);
    expect(serie[0]!.participacio).toBe(60);
    expect(serie[0]!.vots_valids).toBeNull();
  });
});

describe("resumDe", () => {
  it("Barcelona: el cens ha minvat un 25,1 % des del 1979 i la participació màxima és la del 1987", () => {
    const r = resumDe(eleccionsDelMunicipi(de("08019")))!;
    expect(r.primera).toEqual({ any: 1979, cens: 1480453 });
    expect(r.darrera).toEqual({ any: 2023, cens: 1109116, votants: 672053, participacio: 60.6 });
    expect(r.creixementCens).toBe(-25.1);
    expect(r.creixementDes1979).toBe(-25.1);
    expect(r.censMaxim).toEqual({ any: 1979, cens: 1480453 });
    expect(r.censMinim).toEqual({ any: 2023, cens: 1109116 });
    expect(r.participacioMaxima).toEqual({ any: 1987, participacio: 68.9 });
    expect(r.participacioMinima).toEqual({ any: 2007, participacio: 49.6 });
    expect(r.eleccionsAmbDada).toBe(12);
    expect(r.eleccionsEsperades).toBe(12);
  });

  it("Santpedor: el cens més que dobla", () => {
    const r = resumDe(eleccionsDelMunicipi(de("08192")))!;
    expect(r.creixementCens).toBe(153.5);
    expect(r.creixementDes1979).toBe(153.5);
  });

  it("sense el 1979 el creixement es fa des de la primera dada, però el «des del 1979» és null", () => {
    const r = resumDe(eleccionsDelMunicipi(de("08904")))!;
    expect(r.primera.any).toBe(1995);
    expect(r.creixementCens).toBe(creixement(13903, 10251));
    expect(r.creixementDes1979).toBeNull();
  });

  it("amb una sola elecció hi ha resum però cap creixement; sense cap, res", () => {
    const [una] = eleccionsDelMunicipi(de("43907"));
    const r = resumDe([una!])!;
    expect(r.creixementCens).toBeNull();
    expect(r.darrera.cens).toBe(4133);
    expect(resumDe([])).toBeNull();
  });
});

describe("comparaDinsDelGrup", () => {
  it("dona la mediana de participació del grup a cada elecció, amb quants, i cap si són menys de quatre", () => {
    // Sis municipis del mateix tram de població, dels quals només quatre
    // tenen dada del 1979: el 1979 té mediana amb quatre; el 2023, amb sis.
    const series = new Map<number, ReturnType<typeof eleccionsDelMunicipi>>();
    const base = eleccionsDelMunicipi(de("08192"));
    const ambDues = (part79: number, part23: number) =>
      base.map((e) => (e.any === 1979 ? { ...e, participacio: part79 } : e.any === 2023 ? { ...e, participacio: part23 } : e));
    series.set(1, ambDues(50, 60));
    series.set(2, ambDues(52, 62));
    series.set(3, ambDues(54, 64));
    series.set(4, ambDues(56, 66));
    series.set(5, ambDues(0, 68).filter((e) => e.any !== 1979));
    series.set(6, ambDues(0, 70).filter((e) => e.any !== 1979));
    const grups = buildPeerGroups([1, 2, 3, 4, 5, 6].map((id) => ({ id, population: 5000 })));
    const c = comparaDinsDelGrup(series, grups);
    expect(c.get(1)!.participacio.M19791).toEqual({ mediana: 53, quants: 4 });
    expect(c.get(5)!.participacio.M20231).toEqual({ mediana: 65, quants: 6 });
    expect(c.get(1)!.grup.mida).toBe(6);
    // Tres amb dada no fan mediana: seria dir la xifra d'un veí.
    const pocs = comparaDinsDelGrup(new Map([...series].slice(0, 3)), grups);
    expect(pocs.get(1)!.participacio.M19791).toBeUndefined();
  });
});
