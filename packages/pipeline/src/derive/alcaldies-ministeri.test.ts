import { describe, expect, it } from "vitest";
import type { AlcaldiaMinisteri } from "../jobs/j35-alcaldes-ministeri";
import { fusionaAmbMinisteri, llistaMinisteriAmbSentit, type PasAlcaldia } from "./alcaldies";
import { findChanges } from "./mayor-changes";

/**
 * Badalona després de la fusió amb Wikidata: la Generalitat amb una fila per
 * mandat, i Wikidata amb els passos del 2019-2023 i el final de la Sabater.
 * En Guijarro hi és sense data de fi (Wikidata no la posa), i el mandat del
 * 2007-2011 és el de la Generalitat sola: Maite Arqué i Jordi Serra, aquest
 * últim sense data de possessió.
 */
const HISTORIAL: PasAlcaldia[] = [
  { term: "2007-2011", name: "MAITE ARQUE FERRER", partyRaw: "PSC-PM", tookOfficeOn: "2007-06-16" },
  { term: "2007-2011", name: "JORDI SERRA ISERN", partyRaw: "PSC-PM", tookOfficeOn: null },
  { term: "2011-2015", name: "XAVIER GARCIA ALBIOL", partyRaw: "PP", tookOfficeOn: "2011-06-11" },
  { term: "2015-2019", name: "MA. DOLORS SABATER PUIG", partyRaw: "BADALONA EN COM", tookOfficeOn: "2015-06-13", qid: "Q2", finsA: "2018-06-20", motiuFinal: "moció de censura" },
  { term: "2015-2019", name: "Àlex Pastor López", partyRaw: null, tookOfficeOn: "2018-06-20", font: "wikidata", qid: "Q3", finsA: "2019-06-15", motiuFinal: null },
  { term: "2019-2023", name: "ALEJANDRO PASTOR LOPEZ", partyRaw: "PSC-CP", tookOfficeOn: "2019-06-15", qid: "Q3", finsA: "2020-04-29", motiuFinal: "dimissió" },
  { term: "2019-2023", name: "Xavier García Albiol", partyRaw: null, tookOfficeOn: "2020-05-12", font: "wikidata", qid: "Q5", finsA: "2021-11-08", motiuFinal: "moció de censura", partitWikidata: "Partit Popular" },
  { term: "2019-2023", name: "Rubén Guijarro Casas", partyRaw: null, tookOfficeOn: "2021-11-08", font: "wikidata", qid: "Q6", finsA: null, motiuFinal: null, partitWikidata: "Partit dels Socialistes de Catalunya" },
  { term: "2023-2027", name: "XAVIER GARCIA ALBIOL", partyRaw: "PP", tookOfficeOn: "2023-06-17" },
];

/** El que el Ministeri diu de Badalona, tal com ho desa J35. */
const MINISTERI: AlcaldiaMinisteri[] = [
  { mandat: "2007-2011", nom: "MAITE ARQUE FERRER", llista: "PSOE", possessio: "2007-06-16", baixa: "2008-04-08" },
  { mandat: "2007-2011", nom: "JORDI SERRA ISERN", llista: "PSOE", possessio: "2008-04-08", baixa: null },
  { mandat: "2011-2015", nom: "XAVIER GARCÍA ALBIOL", llista: "PP", possessio: "2011-06-11", baixa: null },
  // La Sabater amb la data de baixa que Wikidata ja té: no s'ha de tocar el motiu.
  { mandat: "2015-2019", nom: "MARIA DOLORS SABATER PUIG", llista: "GUANYEM", possessio: "2015-06-13", baixa: "2018-06-25" },
  { mandat: "2015-2019", nom: "ALEJANDRO PASTOR LOPEZ", llista: "C.ELECTORAL", possessio: "2018-06-20", baixa: null },
  // El 2019-2023 amb el malnom entre parèntesis i en Pastor amb una baixa tres dies més tard que Wikidata.
  { mandat: "2019-2023", nom: "ALEJANDRO PASTOR LÓPEZ (ÀLEX)", llista: "C. ELECTORAL", possessio: "2019-06-15", baixa: "2020-05-02" },
  { mandat: "2019-2023", nom: "XABIER García Albiol", llista: "PP", possessio: "2020-05-12", baixa: "2021-11-08" },
  { mandat: "2019-2023", nom: "RUBÉN GUIJARRO CASAS", llista: "OTROS", possessio: "2021-11-08", baixa: "2023-06-17" },
  // Algú que cap altra font té, amb una llista que no diu res.
  { mandat: "2023-2027", nom: "PERSONA INVENTADA PROVA", llista: "OTROS", possessio: "2024-01-10", baixa: null },
  // Un mandat que l'historial no té: no s'inventa.
  { mandat: "1979-1983", nom: "MARIO DIAZ BIELSA", llista: "PSUC", possessio: "1979-04-19", baixa: null },
  // Una baixa anterior a la possessió és una errada del fitxer.
  { mandat: "2011-2015", nom: "ALGÚ AMB DATES GIRADES", llista: "CIU", possessio: "2013-01-01", baixa: "2012-01-01" },
];

describe("fusionaAmbMinisteri", () => {
  const history = fusionaAmbMinisteri(HISTORIAL, MINISTERI);
  const de = (term: string, nom: string) => history.find((h) => h.term === term && h.name === nom)!;

  it("posa la data de baixa on cap font la tenia, marcada com del Ministeri, i no toca mai el motiu", () => {
    expect(de("2007-2011", "MAITE ARQUE FERRER")).toMatchObject({ finsA: "2008-04-08", fontFi: "ministeri" });
    expect(de("2007-2011", "MAITE ARQUE FERRER").motiuFinal).toBeUndefined();
    // En Guijarro: Wikidata el tenia sense fi, i el Ministeri la dona.
    expect(de("2019-2023", "Rubén Guijarro Casas")).toMatchObject({ finsA: "2023-06-17", fontFi: "ministeri", motiuFinal: null, font: "wikidata" });
  });

  it("quan Wikidata ja deia el final, mana Wikidata: ni la data ni el motiu es toquen", () => {
    expect(de("2015-2019", "MA. DOLORS SABATER PUIG")).toMatchObject({ finsA: "2018-06-20", motiuFinal: "moció de censura" });
    expect(de("2015-2019", "MA. DOLORS SABATER PUIG").fontFi).toBeUndefined();
    expect(de("2019-2023", "ALEJANDRO PASTOR LOPEZ")).toMatchObject({ finsA: "2020-04-29", motiuFinal: "dimissió" });
    expect(de("2019-2023", "ALEJANDRO PASTOR LOPEZ").fontFi).toBeUndefined();
  });

  it("completa la presa de possessió que a la Generalitat li falta, i diu que és del Ministeri", () => {
    expect(de("2007-2011", "JORDI SERRA ISERN")).toMatchObject({ tookOfficeOn: "2008-04-08", fontInici: "ministeri", partyRaw: "PSC-PM" });
    // Qui ja la tenia no en porta cap marca.
    expect(de("2011-2015", "XAVIER GARCIA ALBIOL").fontInici).toBeUndefined();
  });

  it("afegeix qui cap altra font té, amb `font: \"ministeri\"` i sense partit si la llista no diu res", () => {
    const nou = de("2023-2027", "PERSONA INVENTADA PROVA");
    expect(nou).toEqual({ term: "2023-2027", name: "PERSONA INVENTADA PROVA", partyRaw: null, tookOfficeOn: "2024-01-10", font: "ministeri", finsA: null, llistaMinisteri: null });
    // I ordenat darrere de qui va obrir el mandat.
    expect(history.filter((h) => h.term === "2023-2027").map((h) => h.name)).toEqual(["XAVIER GARCIA ALBIOL", "PERSONA INVENTADA PROVA"]);
  });

  it("no inventa mandats, i una baixa anterior a la possessió no és cap data", () => {
    expect(history.some((h) => h.term === "1979-1983")).toBe(false);
    expect(de("2011-2015", "ALGÚ AMB DATES GIRADES")).toMatchObject({ font: "ministeri", finsA: null, llistaMinisteri: "CIU" });
  });

  it("no toca res del que ja hi era: nom, partit, dates i marques de Wikidata es queden com eren", () => {
    for (const original of HISTORIAL) {
      const fila = history.find((h) => h.term === original.term && h.name === original.name)!;
      expect(fila.name).toBe(original.name);
      expect(fila.partyRaw).toBe(original.partyRaw);
      expect(fila.font).toBe(original.font);
      expect(fila.qid).toBe(original.qid);
      if (original.tookOfficeOn !== null) expect(fila.tookOfficeOn).toBe(original.tookOfficeOn);
      if (original.finsA) expect(fila.finsA).toBe(original.finsA);
    }
    expect(history).toHaveLength(HISTORIAL.length + 2);
  });

  it("sense res del Ministeri, l'historial és el que era", () => {
    expect(fusionaAmbMinisteri(HISTORIAL, [])).toEqual(HISTORIAL);
  });
});

describe("llistaMinisteriAmbSentit", () => {
  it("«C. ELECTORAL» i «OTROS» no són cap partit; les sigles sí", () => {
    expect(llistaMinisteriAmbSentit("C. ELECTORAL")).toBeNull();
    expect(llistaMinisteriAmbSentit("C.ELECTORAL")).toBeNull();
    expect(llistaMinisteriAmbSentit("OTROS")).toBeNull();
    expect(llistaMinisteriAmbSentit("")).toBeNull();
    expect(llistaMinisteriAmbSentit(null)).toBeNull();
    expect(llistaMinisteriAmbSentit("PSOE")).toBe("PSOE");
    expect(llistaMinisteriAmbSentit(" IND ")).toBe("IND");
  });
});

describe("findChanges amb els passos del Ministeri", () => {
  it("el relleu del 2007-2011 es veu, i el canvi de color es mira també per la llista del Ministeri", () => {
    const historial: PasAlcaldia[] = [
      { term: "2007-2011", name: "MAITE ARQUE FERRER", partyRaw: "PSC-PM", tookOfficeOn: "2007-06-16" },
    ];
    const ministeri: AlcaldiaMinisteri[] = [
      { mandat: "2007-2011", nom: "MAITE ARQUE FERRER", llista: "PSOE", possessio: "2007-06-16", baixa: "2008-04-08" },
      { mandat: "2007-2011", nom: "JORDI SERRA ISERN", llista: "PSOE", possessio: "2008-04-08", baixa: null },
    ];
    const canvis = findChanges(fusionaAmbMinisteri(historial, ministeri), new Map([["2007-2011", "2007-06-16"]]));
    expect(canvis).toHaveLength(1);
    expect(canvis[0]!.mayors.map((m) => m.name)).toEqual(["MAITE ARQUE FERRER", "JORDI SERRA ISERN"]);
    expect(canvis[0]!.partyChanged).toBe(false);
    expect(canvis[0]!.mayors[1]).toMatchObject({ font: "ministeri", llistaMinisteri: "PSOE" });
  });
});
