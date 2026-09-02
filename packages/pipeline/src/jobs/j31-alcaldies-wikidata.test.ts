import { describe, expect, it } from "vitest";
import {
  KIND,
  consultaAlcaldies,
  desDelInici,
  esInterina,
  fitxaAlcaldiesWikidata,
  ordenaAlcaldies,
  parseAlcaldies,
  type AlcaldiaWikidata,
} from "./j31-alcaldies-wikidata";

/** Una fila de la resposta SPARQL tal com la torna WDQS, amb només els valors. */
const fila = (valors: Record<string, string>): Record<string, { value: string }> =>
  Object.fromEntries(Object.entries(valors).map(([k, v]) => [k, { value: v }]));

const ENTITAT = "http://www.wikidata.org/entity/";

/**
 * Badalona (Q15083) segons Wikidata, resumida al mandat 2015-2019 i al
 * 2019-2023: els dos casos que la Generalitat no té —una alcaldessa que cau
 * per moció de censura i un alcalde que dimiteix, amb una interina entremig—.
 * La Sabater surt en dues files perquè té dos partits; en Pastor, en dues
 * perquè té dues fotografies.
 */
const RESPOSTA = {
  results: {
    bindings: [
      fila({
        muni: `${ENTITAT}Q15083`, persona: `${ENTITAT}Q19288390`, personaLabel: "Maria Dolors Sabater i Puig",
        inici: "2015-06-13T00:00:00Z", fi: "2018-06-20T00:00:00Z", causa: `${ENTITAT}Q1013067`, causaLabel: "moció de censura",
        partit: `${ENTITAT}Q19926432`, partitLabel: "Guanyem Badalona en Comú",
      }),
      fila({
        muni: `${ENTITAT}Q15083`, persona: `${ENTITAT}Q19288390`, personaLabel: "Maria Dolors Sabater i Puig",
        inici: "2015-06-13T00:00:00Z", fi: "2018-06-20T00:00:00Z", causa: `${ENTITAT}Q1013067`, causaLabel: "moció de censura",
        partit: `${ENTITAT}Q65130011`, partitLabel: "Candidatura d'Unitat Popular",
      }),
      fila({
        muni: `${ENTITAT}Q15083`, persona: `${ENTITAT}Q55049091`, personaLabel: "Àlex Pastor López",
        inici: "2018-06-20T00:00:00Z", fi: "2019-06-15T00:00:00Z",
        partit: `${ENTITAT}Q1074207`, partitLabel: "Partit dels Socialistes de Catalunya",
        imatge: "http://commons.wikimedia.org/wiki/Special:FilePath/Alex%20Pastor.jpg",
      }),
      fila({
        muni: `${ENTITAT}Q15083`, persona: `${ENTITAT}Q55049091`, personaLabel: "Àlex Pastor López",
        inici: "2018-06-20T00:00:00Z", fi: "2019-06-15T00:00:00Z",
        partit: `${ENTITAT}Q1074207`, partitLabel: "Partit dels Socialistes de Catalunya",
        imatge: "http://commons.wikimedia.org/wiki/Special:FilePath/Alex%20Pastor%202.jpg",
      }),
      fila({
        muni: `${ENTITAT}Q15083`, persona: `${ENTITAT}Q55049091`, personaLabel: "Àlex Pastor López",
        inici: "2019-06-15T00:00:00Z", fi: "2020-04-29T00:00:00Z", causa: `${ENTITAT}Q1030034`, causaLabel: "dimissió",
        partit: `${ENTITAT}Q1074207`, partitLabel: "Partit dels Socialistes de Catalunya",
        imatge: "http://commons.wikimedia.org/wiki/Special:FilePath/Alex%20Pastor.jpg",
      }),
      fila({
        muni: `${ENTITAT}Q15083`, persona: `${ENTITAT}Q94628123`, personaLabel: "Aïda Llauradó Álvarez",
        inici: "2020-04-29T00:00:00Z", fi: "2020-05-12T00:00:00Z", rolLabel: "alcaldessa accidental",
        partit: `${ENTITAT}Q19926432`, partitLabel: "Badalona en Comú Podem",
      }),
      // Sense etiqueta en cap idioma: el servei torna el QID, i això no és un nom.
      fila({ muni: `${ENTITAT}Q15083`, persona: `${ENTITAT}Q99999999`, personaLabel: "Q99999999", inici: "2020-05-12T00:00:00Z" }),
      // Un altre municipi i una alcaldia franquista, que ha de quedar fora.
      fila({ muni: `${ENTITAT}Q1492`, persona: `${ENTITAT}Q2731`, personaLabel: "Josep Maria de Porcioles", inici: "1957-03-16T00:00:00Z", fi: "1973-05-16T00:00:00Z" }),
      fila({ muni: `${ENTITAT}Q1492`, persona: `${ENTITAT}Q3070`, personaLabel: "Narcís Serra i Serra", inici: "1979-04-19T00:00:00Z", fi: "1982-12-03T00:00:00Z", causaLabel: "dimissió" }),
    ],
  },
};

describe("consultaAlcaldies", () => {
  it("demana P6 amb els qualificadors del relleu i deixa fora les declaracions obsoletes", () => {
    const q = consultaAlcaldies(["Q15083", "Q1492"]);
    expect(q).toContain("VALUES ?muni { wd:Q15083 wd:Q1492 }");
    expect(q).toContain("p:P6");
    expect(q).toContain("pq:P580");
    expect(q).toContain("pq:P582");
    expect(q).toContain("pq:P1534");
    expect(q).toContain("wdt:P102");
    expect(q).toContain("wdt:P18");
    expect(q).toContain("wikibase:DeprecatedRank");
    expect(q).toContain('"ca,es,en"');
  });
});

describe("parseAlcaldies", () => {
  const per = parseAlcaldies(RESPOSTA);
  const badalona = per.get("Q15083")!;

  it("una alcaldia per declaració, amb la persona, les dates i el motiu del final", () => {
    expect(badalona.map((a) => `${a.nom} ${a.inici}→${a.fi ?? "?"}`)).toEqual([
      "Maria Dolors Sabater i Puig 2015-06-13→2018-06-20",
      "Àlex Pastor López 2018-06-20→2019-06-15",
      "Àlex Pastor López 2019-06-15→2020-04-29",
      "Aïda Llauradó Álvarez 2020-04-29→2020-05-12",
    ]);
    expect(badalona[0]).toMatchObject({ qid: "Q19288390", motiuFinal: "moció de censura", motiuFinalQid: "Q1013067", interina: false });
    expect(badalona[2]).toMatchObject({ motiuFinal: "dimissió", motiuFinalQid: "Q1030034" });
    expect(badalona[1]!.motiuFinal).toBeNull();
  });

  it("dos partits són el primer com a partit i tots dos a la llista; dues fotos, la primera", () => {
    expect(badalona[0]).toMatchObject({ partit: "Guanyem Badalona en Comú", partitQid: "Q19926432", partits: ["Guanyem Badalona en Comú", "Candidatura d'Unitat Popular"] });
    expect(badalona[1]).toMatchObject({ imatge: "File:Alex Pastor.jpg", partits: ["Partit dels Socialistes de Catalunya"] });
  });

  it("detecta l'alcaldia accidental pel rol", () => {
    expect(badalona[3]).toMatchObject({ nom: "Aïda Llauradó Álvarez", interina: true });
  });

  it("descarta les files sense etiqueta de persona i agrupa per municipi", () => {
    expect(badalona.some((a) => a.qid === "Q99999999")).toBe(false);
    expect([...per.keys()].sort()).toEqual(["Q1492", "Q15083"]);
    expect(per.get("Q1492")!.map((a) => a.nom)).toEqual(["Josep Maria de Porcioles", "Narcís Serra i Serra"]);
  });

  it("una resposta buida o malformada no és cap alcaldia", () => {
    expect(parseAlcaldies({}).size).toBe(0);
    expect(parseAlcaldies(null).size).toBe(0);
    expect(parseAlcaldies({ results: { bindings: [{ muni: { value: "no és un uri" } }] } }).size).toBe(0);
  });
});

describe("esInterina", () => {
  it("ho diu el rol o el càrrec, en qualsevol de les formes que Wikidata fa servir", () => {
    expect(esInterina("alcaldessa accidental", null)).toBe(true);
    expect(esInterina(null, "alcalde interí")).toBe(true);
    expect(esInterina("alcaldessa en funcions")).toBe(true);
    expect(esInterina("acting mayor")).toBe(true);
    expect(esInterina("alcalde", null)).toBe(false);
    expect(esInterina(null, null)).toBe(false);
  });
});

describe("fitxaAlcaldiesWikidata", () => {
  const alcaldies = parseAlcaldies(RESPOSTA).get("Q1492")!;
  const fitxa = fitxaAlcaldiesWikidata({ qid: "Q1492", ine5: "08019" }, alcaldies, "2026-09-03");

  it("porta font, llicència CC0 i data de consulta, i només les alcaldies des del 1979", () => {
    expect(fitxa).toMatchObject({ font: "Wikidata (wikidata.org)", llicenciaDades: "CC0 1.0", consultat: "2026-09-03", qidMunicipi: "Q1492", ine5: "08019", url: "https://www.wikidata.org/wiki/Q1492" });
    expect(fitxa.alcaldies.map((a) => a.nom)).toEqual(["Narcís Serra i Serra"]);
    expect(KIND).toBe("alcaldiesWikidata");
  });

  it("les alcaldies sense inici es queden, al final, perquè la fusió decideixi", () => {
    const senseInici: AlcaldiaWikidata = { ...alcaldies[1]!, qid: "Q1", nom: "Algú Sense Data", inici: null, fi: null };
    expect(desDelInici([senseInici, alcaldies[0]!]).map((a) => a.nom)).toEqual(["Algú Sense Data"]);
    expect(ordenaAlcaldies([senseInici, alcaldies[1]!]).map((a) => a.nom)).toEqual(["Narcís Serra i Serra", "Algú Sense Data"]);
  });
});
