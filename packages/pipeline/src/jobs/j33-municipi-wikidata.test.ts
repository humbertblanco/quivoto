import { describe, expect, it } from "vitest";
import {
  AMPLADA_CARA,
  KIND,
  MAX_NASCUTS,
  consultaAgermanaments,
  consultaNascuts,
  consultaRecompteNascuts,
  fitxaCuriositatsWikidata,
  imatgePersona,
  lotsNascuts,
  ordenaAgermanaments,
  parseAgermanaments,
  parseNascuts,
  parseRecompte,
  primersNascuts,
  type PersonaNascuda,
} from "./j33-municipi-wikidata";

/** Una fila de la resposta SPARQL tal com la torna WDQS, amb només els valors. */
const fila = (valors: Record<string, string>): Record<string, { value: string }> =>
  Object.fromEntries(Object.entries(valors).map(([k, v]) => [k, { value: v }]));

const ENTITAT = "http://www.wikidata.org/entity/";
const BADALONA = `${ENTITAT}Q15468`;
const BARCELONA = `${ENTITAT}Q1492`;

/**
 * Els agermanaments de Badalona tal com els dona WDQS el 03-09-2026 —Valparaíso,
 * San Fernando i Alcanar, cap amb data—, més un de Barcelona amb data d'inici
 * i un d'acabat, i una ciutat amb dos països que ha de sortir un sol cop.
 */
const AGERMANAMENTS = {
  results: {
    bindings: [
      fila({ muni: BADALONA, ciutat: `${ENTITAT}Q33986`, ciutatLabel: "Valparaíso", pais: `${ENTITAT}Q298`, paisLabel: "Xile" }),
      fila({ muni: BADALONA, ciutat: `${ENTITAT}Q741765`, ciutatLabel: "San Fernando", pais: `${ENTITAT}Q29`, paisLabel: "Espanya" }),
      fila({ muni: BADALONA, ciutat: `${ENTITAT}Q987434`, ciutatLabel: "Alcanar", pais: `${ENTITAT}Q29`, paisLabel: "Espanya" }),
      fila({ muni: BARCELONA, ciutat: `${ENTITAT}Q1218`, ciutatLabel: "Montevideo", pais: `${ENTITAT}Q77`, paisLabel: "Uruguai", inici: "1985-01-01T00:00:00Z" }),
      fila({ muni: BARCELONA, ciutat: `${ENTITAT}Q90`, ciutatLabel: "París", pais: `${ENTITAT}Q142`, paisLabel: "França", inici: "2013-05-01T00:00:00Z", fi: "2020-01-01T00:00:00Z" }),
      fila({ muni: BARCELONA, ciutat: `${ENTITAT}Q1899`, ciutatLabel: "Kíiv", pais: `${ENTITAT}Q212`, paisLabel: "Ucraïna" }),
      fila({ muni: BARCELONA, ciutat: `${ENTITAT}Q1899`, ciutatLabel: "Kíiv", pais: `${ENTITAT}Q15180`, paisLabel: "Unió Soviètica" }),
      // Sense etiqueta: el servei torna el QID, i això no és un nom.
      fila({ muni: BARCELONA, ciutat: `${ENTITAT}Q99999999`, ciutatLabel: "Q99999999" }),
    ],
  },
};

const RECOMPTE = {
  results: {
    bindings: [
      fila({ muni: BARCELONA, total: "14442" }),
      fila({ muni: BADALONA, total: "560" }),
      fila({ muni: `${ENTITAT}Q13341`, total: "no és un nombre" }),
    ],
  },
};

/**
 * Tres persones de Badalona, resumides del que torna WDQS: la Mireia Belmonte
 * surt dos cops perquè té dues fotografies; en Luis García, dos perquè té dues
 * ocupacions; l'Anna Cruz sense fotografia i una persona sense article en
 * català ni etiqueta. I una de Barcelona per comprovar que s'agrupa a part.
 */
const NASCUTS = {
  results: {
    bindings: [
      fila({
        muni: BADALONA, persona: `${ENTITAT}Q232218`, personaLabel: "Mireia Belmonte García", sitelinks: "31",
        naixement: "1990-11-10T00:00:00Z", imatge: "http://commons.wikimedia.org/wiki/Special:FilePath/Mireia%20Belmonte%20%28ESP%29%202018.jpg",
        article: "https://ca.wikipedia.org/wiki/Mireia_Belmonte_i_Garc%C3%ADa", ocupacio: `${ENTITAT}Q10843402`, ocupacioLabel: "nedador",
      }),
      fila({
        muni: BADALONA, persona: `${ENTITAT}Q232218`, personaLabel: "Mireia Belmonte García", sitelinks: "31",
        naixement: "1990-11-10T00:00:00Z", imatge: "http://commons.wikimedia.org/wiki/Special:FilePath/Mireia%20Belmonte%2003.jpg",
        article: "https://ca.wikipedia.org/wiki/Mireia_Belmonte_i_Garc%C3%ADa", ocupacio: `${ENTITAT}Q10843402`, ocupacioLabel: "nedador",
      }),
      fila({
        muni: BADALONA, persona: `${ENTITAT}Q295416`, personaLabel: "Luis Javier García Sanz", sitelinks: "42",
        naixement: "1978-06-24T00:00:00Z", imatge: "http://commons.wikimedia.org/wiki/Special:FilePath/Luis%20Garc%C3%ADa%20Sanz.jpg",
        article: "https://ca.wikipedia.org/wiki/Luis_Javier_Garc%C3%ADa_Sanz", ocupacio: `${ENTITAT}Q937857`, ocupacioLabel: "futbolista",
      }),
      fila({
        muni: BADALONA, persona: `${ENTITAT}Q295416`, personaLabel: "Luis Javier García Sanz", sitelinks: "42",
        naixement: "1978-06-24T00:00:00Z", imatge: "http://commons.wikimedia.org/wiki/Special:FilePath/Luis%20Garc%C3%ADa%20Sanz.jpg",
        article: "https://ca.wikipedia.org/wiki/Luis_Javier_Garc%C3%ADa_Sanz", ocupacio: `${ENTITAT}Q82955`, ocupacioLabel: "polític",
      }),
      fila({
        muni: BADALONA, persona: `${ENTITAT}Q425613`, personaLabel: "Anna Cruz i Lebrato", sitelinks: "19",
        naixement: "1986-10-27T00:00:00Z", article: "https://ca.wikipedia.org/wiki/Anna_Cruz_i_Lebrato",
        ocupacio: `${ENTITAT}Q3665646`, ocupacioLabel: "jugador de bàsquet",
      }),
      fila({ muni: BADALONA, persona: `${ENTITAT}Q99999999`, personaLabel: "Q99999999", sitelinks: "50" }),
      fila({
        muni: BARCELONA, persona: `${ENTITAT}Q5593`, personaLabel: "Pablo Picasso", sitelinks: "250",
        naixement: "1881-10-25T00:00:00Z", defuncio: "1973-04-08T00:00:00Z",
      }),
    ],
  },
};

describe("les consultes", () => {
  it("demana els agermanaments amb país i dates, i deixa fora les declaracions obsoletes", () => {
    const q = consultaAgermanaments(["Q15468", "Q1492"]);
    expect(q).toContain("VALUES ?muni { wd:Q15468 wd:Q1492 }");
    expect(q).toContain("p:P190");
    expect(q).toContain("wdt:P17");
    expect(q).toContain("pq:P580");
    expect(q).toContain("pq:P582");
    expect(q).toContain("wikibase:DeprecatedRank");
    expect(q).toContain('"ca,es,en"');
  });

  it("el recompte compta persones (P31 = Q5) nascudes (P19) a cada municipi", () => {
    const q = consultaRecompteNascuts(["Q15468"]);
    expect(q).toContain("COUNT(DISTINCT ?persona)");
    expect(q).toContain("wdt:P19 ?muni ; wdt:P31 wd:Q5");
    expect(q).toContain("GROUP BY ?muni");
  });

  it("amb límit, la selecció va en una subconsulta ordenada pels enllaços d'entrada", () => {
    const amb = consultaNascuts(["Q15468"], 12);
    expect(amb).toContain("{ SELECT ?muni ?persona ?sitelinks WHERE {");
    expect(amb).toContain("ORDER BY DESC(?sitelinks) LIMIT 12 }");
    expect(amb).toContain("wdt:P569");
    expect(amb).toContain("wdt:P570");
    expect(amb).toContain("wdt:P18");
    expect(amb).toContain("wdt:P106");
    expect(amb).toContain("schema:isPartOf <https://ca.wikipedia.org/>");
    const sense = consultaNascuts(["Q1", "Q2"], null);
    expect(sense).not.toContain("LIMIT");
    expect(sense).toContain("VALUES ?muni { wd:Q1 wd:Q2 }");
  });
});

describe("parseAgermanaments", () => {
  const per = parseAgermanaments(AGERMANAMENTS);

  it("un agermanament per ciutat, amb el país, l'enllaç i les dates", () => {
    expect(per.get("Q15468")!.map((a) => `${a.nom} (${a.pais})`)).toEqual([
      "Alcanar (Espanya)", "San Fernando (Espanya)", "Valparaíso (Xile)",
    ]);
    expect(per.get("Q15468")![2]).toMatchObject({ qid: "Q33986", paisQid: "Q298", url: "https://www.wikidata.org/wiki/Q33986", inici: null, fi: null });
  });

  it("els datats van primer i per data; una ciutat amb dos països surt un cop; sense etiqueta, fora", () => {
    const bcn = per.get("Q1492")!;
    expect(bcn.map((a) => a.nom)).toEqual(["Montevideo", "París", "Kíiv"]);
    expect(bcn[1]).toMatchObject({ inici: "2013-05-01", fi: "2020-01-01" });
    expect(bcn[2]).toMatchObject({ pais: "Ucraïna", paisQid: "Q212" });
    expect(bcn.some((a) => a.qid === "Q99999999")).toBe(false);
  });

  it("una resposta buida o malformada no és cap agermanament", () => {
    expect(parseAgermanaments({}).size).toBe(0);
    expect(parseAgermanaments(null).size).toBe(0);
    expect(ordenaAgermanaments([]).length).toBe(0);
  });
});

describe("parseRecompte", () => {
  it("un total per municipi, i el que no és un nombre no compta", () => {
    const r = parseRecompte(RECOMPTE);
    expect(r.get("Q1492")).toBe(14442);
    expect(r.get("Q15468")).toBe(560);
    expect(r.has("Q13341")).toBe(false);
    expect(parseRecompte(null).size).toBe(0);
  });
});

describe("parseNascuts", () => {
  const per = parseNascuts(NASCUTS);
  const badalona = per.get("Q15468")!;

  it("una persona per QID, de més a menys enllaços, amb les dates, l'article i la fotografia", () => {
    expect(badalona.map((p) => `${p.nom} ${p.enllacos}`)).toEqual([
      "Luis Javier García Sanz 42", "Mireia Belmonte García 31", "Anna Cruz i Lebrato 19",
    ]);
    expect(badalona[1]).toMatchObject({
      qid: "Q232218", url: "https://www.wikidata.org/wiki/Q232218", naixement: "1990-11-10", defuncio: null,
      viquipedia: "https://ca.wikipedia.org/wiki/Mireia_Belmonte_i_Garc%C3%ADa",
      fitxer: "File:Mireia Belmonte (ESP) 2018.jpg", imatge: null, ocupacio: "nedador", ocupacions: ["nedador"],
    });
    expect(badalona[2]).toMatchObject({ fitxer: null, ocupacio: "jugador de bàsquet" });
  });

  it("dues ocupacions són la primera com a ocupació i totes dues a la llista", () => {
    expect(badalona[0]).toMatchObject({ ocupacio: "futbolista", ocupacions: ["futbolista", "polític"] });
  });

  it("descarta qui no té etiqueta i agrupa per municipi", () => {
    expect(badalona.some((p) => p.qid === "Q99999999")).toBe(false);
    expect(per.get("Q1492")![0]).toMatchObject({ nom: "Pablo Picasso", naixement: "1881-10-25", defuncio: "1973-04-08", viquipedia: null, ocupacio: null, ocupacions: [] });
  });

  it("es queda les dotze amb més enllaços, i a igualtat, per nom", () => {
    const persona = (i: number, enllacos: number): PersonaNascuda => ({
      qid: `Q${i}`, nom: `Persona ${String(i).padStart(2, "0")}`, url: "", viquipedia: null, naixement: null, defuncio: null,
      ocupacio: null, ocupacions: [], enllacos, fitxer: null, imatge: null,
    });
    const moltes = Array.from({ length: 15 }, (_, i) => persona(i, i < 5 ? 9 : 3));
    const primers = primersNascuts(moltes);
    expect(primers).toHaveLength(MAX_NASCUTS);
    expect(primers.slice(0, 5).map((p) => p.enllacos)).toEqual([9, 9, 9, 9, 9]);
    expect(primers.slice(5).map((p) => p.nom)).toEqual(["Persona 05", "Persona 06", "Persona 07", "Persona 08", "Persona 09", "Persona 10", "Persona 11"]);
  });
});

describe("lotsNascuts", () => {
  it("els sense cap persona no van enlloc, els grans van sols i els petits s'agrupen per persones", () => {
    const recompte = new Map([["Q1", 0], ["Q2", 5], ["Q3", 200], ["Q4", 12], ["Q5", 13], ["Q6", 100], ["Q7", 3]]);
    const lots = lotsNascuts(["Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7"], recompte, 12, 240);
    expect(lots.grans).toEqual(["Q3", "Q5", "Q6"]);
    expect(lots.petits).toEqual([["Q2", "Q4", "Q7"]]);
  });

  it("tanca el lot quan la suma passaria del límit", () => {
    const recompte = new Map([["Q1", 10], ["Q2", 10], ["Q3", 10], ["Q4", 10]]);
    expect(lotsNascuts(["Q1", "Q2", "Q3", "Q4"], recompte, 12, 25).petits).toEqual([["Q1", "Q2"], ["Q3", "Q4"]]);
    expect(lotsNascuts([], recompte).petits).toEqual([]);
  });
});

describe("fitxaCuriositatsWikidata", () => {
  const agermanaments = parseAgermanaments(AGERMANAMENTS).get("Q15468")!;
  const persones = parseNascuts(NASCUTS).get("Q15468")!;
  const fitxa = fitxaCuriositatsWikidata({ qid: "Q15468", ine5: "08015" }, agermanaments, { total: 560, persones }, "2026-09-03");

  it("porta font, llicència CC0, data de consulta, URL de l'element i el total abans de retallar", () => {
    expect(fitxa).toMatchObject({
      font: "Wikidata (wikidata.org)", fontImatges: "Wikimedia Commons (commons.wikimedia.org)", llicenciaDades: "CC0 1.0",
      consultat: "2026-09-03", qidMunicipi: "Q15468", url: "https://www.wikidata.org/wiki/Q15468", ine5: "08015",
    });
    expect(fitxa.agermanaments).toHaveLength(3);
    expect(fitxa.nascuts.total).toBe(560);
    expect(fitxa.nascuts.persones.map((p) => p.nom)).toEqual(["Luis Javier García Sanz", "Mireia Belmonte García", "Anna Cruz i Lebrato"]);
    expect(KIND).toBe("curiositatsWikidata");
    expect(AMPLADA_CARA).toBe(120);
  });

  it("la fotografia només es desa quan Commons diu que és lliure", () => {
    expect(imatgePersona(undefined)).toBeNull();
    expect(imatgePersona({ ok: false, llicencia: "cc-by-nc-4.0", motiu: "llicència no lliure" })).toBeNull();
    expect(
      imatgePersona({
        ok: true,
        retrat: {
          fitxer: "File:Mireia Belmonte (ESP) 2018.jpg", paginaFitxer: "https://commons.wikimedia.org/wiki/File:Mireia_Belmonte_(ESP)_2018.jpg",
          miniaturaUrl: "https://upload.wikimedia.org/x/120px-Mireia.jpg", mime: "image/jpeg", autor: "Sandro Halank",
          llicencia: { codi: "cc-by-sa-3.0", nom: "CC BY-SA 3.0", url: "https://creativecommons.org/licenses/by-sa/3.0/" },
        },
      }),
    ).toEqual({
      fitxer: "File:Mireia Belmonte (ESP) 2018.jpg", paginaFitxer: "https://commons.wikimedia.org/wiki/File:Mireia_Belmonte_(ESP)_2018.jpg",
      miniaturaUrl: "https://upload.wikimedia.org/x/120px-Mireia.jpg", autor: "Sandro Halank",
      llicencia: { codi: "cc-by-sa-3.0", nom: "CC BY-SA 3.0", url: "https://creativecommons.org/licenses/by-sa/3.0/" },
    });
  });
});
