import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ajuntaBalancos,
  anyDelPeriode,
  canviEntre,
  clauTipologia,
  construeixTipus,
  habitantsPerAny,
  llindarDelTitol,
  parseCsvBalanc,
  parseXifra,
  posicioDinsDe,
  taulaMunicipisDelIndex,
  urlCsvBalanc,
  urlIndexBalanc,
  TIPOLOGIA_TOTAL,
  TIPOLOGIES,
} from "./j29-criminalitat";

/**
 * Les tres mostres de CSV són files copiades **literalment** dels fitxers del
 * Ministeri, baixades el 30 d'agost del 2026:
 *
 *   · 20254: balanç del 4t trimestre del 2025 (1509012.px), amb codi INE.
 *   · 20234: el del 2023 (1309012.px), sense codi («-Municipio de Badalona»)
 *     i amb el període «enero--diciembre 2023» de doble guionet, tal com surt.
 *   · 20204: el del 2020 (1009012.px), esquema vell de tipologies
 *     («1.-Homicidios…», «Resto de infracciones penales») i llindar de 30.000.
 *
 * L'índex és el retall de la pàgina real amb les tres taules del balanç.
 */
const FIXTURES = join(__dirname, "..", "adapters", "__fixtures__");
const llegeix = (nom: string): string => readFileSync(join(FIXTURES, nom), "utf8");

const INDEX_2025 = llegeix("criminalitat-index-20254.html");
const BALANC_2025 = parseCsvBalanc(llegeix("criminalitat-balanc-20254.csv"));
const BALANC_2023 = parseCsvBalanc(llegeix("criminalitat-balanc-20234.csv"));
const BALANC_2020 = parseCsvBalanc(llegeix("criminalitat-balanc-20204.csv"));

describe("taulaMunicipisDelIndex", () => {
  it("troba la taula de municipis i el llindar que declara el títol", () => {
    const taula = taulaMunicipisDelIndex(INDEX_2025);
    expect(taula?.fitxer).toBe("1509012.px");
    expect(taula?.titol).toContain("Municipios mayores de 20.000");
    expect(taula?.llindar).toBe(20_000);
  });

  it("torna null quan l'índex no té taula de municipis, que és com sabem que el balanç encara no hi és", () => {
    const nomesCcaa =
      '<a href="/sec/jaxiPx/Tabla.htm?path=/DatosBalanceAnt/l0/&amp;file=1509010.px&amp;L=0">Balance trimestral. Comunidades</a>';
    expect(taulaMunicipisDelIndex(nomesCcaa)).toBeNull();
    expect(taulaMunicipisDelIndex("<html></html>")).toBeNull();
  });

  it("les URL del portal es construeixen tal com les serveix", () => {
    expect(urlIndexBalanc(2025)).toBe(
      "https://estadisticasdecriminalidad.ses.mir.es/sec/dynPx/inebase/index.htm?type=pcaxis&path=/DatosBalanceAnt/20254/&file=pcaxis",
    );
    expect(urlCsvBalanc("1509012.px")).toBe(
      "https://estadisticasdecriminalidad.ses.mir.es/sec/jaxiPx/files/_px/es/csv_bdsc/DatosBalanceAnt/l0/1509012.px?nocab=1",
    );
  });
});

describe("parseXifra i anyDelPeriode", () => {
  it("llegeix el punt com a separador de milers", () => {
    expect(parseXifra("12.979")).toBe(12_979);
    expect(parseXifra("1.098")).toBe(1_098);
    expect(parseXifra("3")).toBe(3);
    expect(parseXifra("0")).toBe(0);
  });

  it("no confon una variació amb coma amb una xifra de fets", () => {
    expect(parseXifra("-1,2")).toBeNull();
    expect(parseXifra("")).toBeNull();
    expect(parseXifra("n/d")).toBeNull();
  });

  it("llegeix els tres formats de període que gasta la font, doble guionet inclòs", () => {
    expect(anyDelPeriode("enero-diciembre 2025")).toBe(2025);
    expect(anyDelPeriode("Enero-diciembre 2019")).toBe(2019);
    expect(anyDelPeriode("enero--diciembre 2023")).toBe(2023);
    expect(anyDelPeriode("Variación % 2025/2024")).toBeNull();
  });

  it("el llindar surt del títol i no d'una constant", () => {
    expect(llindarDelTitol("Balance… Municipios mayores de 30.000 habitantes e islas")).toBe(30_000);
    expect(llindarDelTitol("Balance… Provincias")).toBeNull();
  });
});

describe("clauTipologia", () => {
  it("mapa pel número, que és l'única cosa que no ha canviat entre esquemes", () => {
    // Esquema nou (2022 ençà).
    expect(clauTipologia("1. Homicidios dolosos y asesinatos consumados")).toBe("homicidis");
    expect(clauTipologia("5.1.-Agresión sexual con penetración")).toBe("sexuals-penetracio");
    expect(clauTipologia("10. Tráfico de drogas")).toBe("drogues");
    expect(clauTipologia("I. CRIMINALIDAD CONVENCIONAL")).toBe("convencional");
    expect(clauTipologia("II. CIBERCRIMINALIDAD (infracciones penales cometidas en/por medio ciber)")).toBe("ciber");
    expect(clauTipologia("III. TOTAL INFRACCIONES PENALES")).toBe("total");
    // Esquema vell (fins al 2021): punt-guionet i «libertad e indemnidad».
    expect(clauTipologia("1.-Homicidios dolosos y asesinatos consumados")).toBe("homicidis");
    expect(clauTipologia("5.-Delitos contra la libertad e indemnidad sexual")).toBe("sexuals");
    expect(clauTipologia("7.- Robos con fuerza en domicilios, establecimientos y otras instalaciones")).toBe("robatoris-forca");
    expect(clauTipologia("TOTAL INFRACCIONES PENALES")).toBe("total");
  });

  it("el «Resto de infracciones penales» vell no es mapa: barrejava convencional i ciber", () => {
    expect(clauTipologia("Resto de infracciones penales")).toBeNull();
  });
});

describe("parseCsvBalanc", () => {
  it("llegeix les files amb codi INE i la província de la capçalera", () => {
    const total2025 = BALANC_2025.find(
      (f) => f.ine5 === "08015" && f.clau === "total" && f.any === 2025,
    );
    expect(total2025?.fets).toBe(14_901);
    expect(total2025?.nom).toBe("Badalona");
    expect(total2025?.provincia).toBe("BARCELONA");
    // Cap fila de variació ni de geografies que no són municipis.
    expect(BALANC_2025.every((f) => f.any === 2024 || f.any === 2025)).toBe(true);
    expect(BALANC_2025.some((f) => f.nom.includes("CATALU"))).toBe(false);
  });

  it("un municipi amb codi de fora de Catalunya es llegeix aquí i es filtra en ajuntar", () => {
    // «21042 Isla Cristina» és un municipi de Huelva, no una illa.
    expect(BALANC_2025.some((f) => f.ine5 === "21042")).toBe(true);
  });

  it("llegeix els balanços vells sense codi, amb el nom i la província", () => {
    const total2023 = BALANC_2023.find(
      (f) => f.nom === "Badalona" && f.clau === "total" && f.any === 2023,
    );
    expect(total2023?.ine5).toBeNull();
    expect(total2023?.fets).toBe(14_156);
    // El «enero--diciembre» de doble guionet del fitxer del 2024 també es llegeix
    // (aquí el del 2023 porta els dos anys ben escrits, i el test del format és a dalt).
    const total2022 = BALANC_2023.find((f) => f.nom === "Badalona" && f.clau === "total" && f.any === 2022);
    expect(total2022?.fets).toBe(13_705);
  });

  it("l'esquema vell del 2020: «- Municipio de», majúscula al període i illes fora", () => {
    const total2019 = BALANC_2020.find((f) => f.nom === "Badalona" && f.clau === "total" && f.any === 2019);
    expect(total2019?.fets).toBe(12_341);
    expect(BALANC_2020.some((f) => f.nom.includes("Mallorca"))).toBe(false);
    const resto = BALANC_2020.find((f) => f.etiqueta === "Resto de infracciones penales");
    expect(resto?.clau).toBeNull();
  });
});

describe("ajuntaBalancos", () => {
  const ajuntat = ajuntaBalancos([
    { any: 2020, files: BALANC_2020 },
    { any: 2023, files: BALANC_2023 },
    { any: 2025, files: BALANC_2025 },
  ]);

  it("una sèrie per municipi i tipologia, creuada sempre pel codi INE", () => {
    const badalona = ajuntat.perIne5.get("08015")!.get("total")!;
    expect([...badalona.keys()].sort()).toEqual([2019, 2020, 2022, 2023, 2024, 2025]);
    expect(badalona.get(2019)).toBe(12_341);
    expect(badalona.get(2025)).toBe(14_901);
  });

  it("els noms dels balanços vells es resolen amb el diccionari de la mateixa font", () => {
    // «- Municipio de Girona» (2020) i «-Municipio de Girona» (2023) → 17079,
    // que és el codi que el balanç del 2025 posa al mateix nom sota la mateixa província.
    const girona = ajuntat.perIne5.get("17079")!.get("furts")!;
    expect(girona.get(2019)).toBe(2_043);
    expect(girona.get(2023)).toBe(2_346);
  });

  it("el que no és català se salta sense soroll, tingui codi o nom", () => {
    expect(ajuntat.perIne5.has("21042")).toBe(false); // Isla Cristina (Huelva)
    expect(ajuntat.perIne5.has("03014")).toBe(false); // Alacant
    expect(ajuntat.senseCodi).toEqual([]); // Alacant pel nom tampoc no hi deixa rastre
  });

  it("un nom català que el diccionari no coneix queda a senseCodi, no s'inventa", () => {
    const csv = [
      "Geografía;Tipología penal;Periodos:;Total",
      "Provincia de GIRONA;III. TOTAL INFRACCIONES PENALES;enero-diciembre 2022;9",
      "-Municipio de Vilafantasia;III. TOTAL INFRACCIONES PENALES;enero-diciembre 2022;7",
      "Provincia de MADRID;III. TOTAL INFRACCIONES PENALES;enero-diciembre 2022;9",
      "-Municipio de Móstoles;III. TOTAL INFRACCIONES PENALES;enero-diciembre 2022;5",
    ].join("\r\n");
    const { perIne5, senseCodi } = ajuntaBalancos([{ any: 2022, files: parseCsvBalanc(csv) }]);
    expect(perIne5.size).toBe(0);
    expect(senseCodi).toEqual([{ nom: "Vilafantasia", provincia: "GIRONA" }]);
  });

  it("quan un any surt a dos balanços, guanya el més nou: el Ministeri revisa", () => {
    const fila = (fets: number): string =>
      ["Geografía;Tipología penal;Periodos:;Total", `08015 Badalona;III. TOTAL INFRACCIONES PENALES;enero-diciembre 2024;${fets}`].join("\r\n");
    // Es passen desordenats a posta: l'ordre el posa la funció, no qui la crida.
    const { perIne5 } = ajuntaBalancos([
      { any: 2025, files: parseCsvBalanc(fila(150)) },
      { any: 2024, files: parseCsvBalanc(fila(100)) },
    ]);
    expect(perIne5.get("08015")!.get("total")!.get(2024)).toBe(150);
  });
});

describe("habitantsPerAny", () => {
  const padro = [
    { any: 2019, valor: 220_440 },
    { any: 2021, valor: 223_006 },
    { any: 2025, valor: 231_542 },
  ];

  it("fa servir el padró de l'any mateix, i el més proper quan aquell falta", () => {
    const resultat = habitantsPerAny([2019, 2020, 2025], padro, 999_999);
    expect(resultat).toEqual([
      { any: 2019, habitants: 220_440, anyPadro: 2019 },
      // Empat de distància entre 2019 i 2021: guanya el més nou.
      { any: 2020, habitants: 223_006, anyPadro: 2021 },
      { any: 2025, habitants: 231_542, anyPadro: 2025 },
    ]);
  });

  it("un padró de fa més de dos anys no fa taxa: cau al padró vigent, marcat", () => {
    const resultat = habitantsPerAny([2025], [{ any: 2015, valor: 215_654 }], 231_542);
    expect(resultat).toEqual([{ any: 2025, habitants: 231_542, anyPadro: null }]);
  });

  it("sense cap padró ni padró vigent, l'any queda sense habitants i la taxa no es fa", () => {
    expect(habitantsPerAny([2025], null, null)).toEqual([]);
  });
});

describe("canviEntre i construeixTipus", () => {
  it("el canvi porta la diferència en fets i la variació en %", () => {
    const serie = [
      { any: 2023, fets: 14_156 },
      { any: 2024, fets: 15_079 },
      { any: 2025, fets: 14_901 },
    ];
    expect(canviEntre(serie, 2023, 2025)).toEqual({ desDe: 2023, fins: 2025, abs: 745, pct: 5.3 });
    expect(canviEntre(serie, 2024, 2025)).toEqual({ desDe: 2024, fins: 2025, abs: -178, pct: -1.2 });
    // Sense dada a un extrem no hi ha canvi: no s'inventa el punt de partida.
    expect(canviEntre(serie, 2021, 2025)).toBeNull();
  });

  it("partir de zero no fa una divisió: el percentatge queda en null", () => {
    const serie = [{ any: 2023, fets: 0 }, { any: 2024, fets: 5 }];
    expect(canviEntre(serie, 2023, 2024)).toEqual({ desDe: 2023, fins: 2024, abs: 5, pct: null });
  });

  it("construeix la sèrie ordenada, la taxa per 1.000 i els dos canvis", () => {
    const fets = new Map([[2025, 500], [2023, 400]]);
    const poblacio = [
      { any: 2023, habitants: 20_000, anyPadro: 2023 },
      { any: 2025, habitants: 25_000, anyPadro: 2025 },
    ];
    const tipus = construeixTipus(TIPOLOGIA_TOTAL, fets, poblacio)!;
    expect(tipus.serie).toEqual([{ any: 2023, fets: 400 }, { any: 2025, fets: 500 }]);
    expect(tipus.perMil).toEqual([{ any: 2023, valor: 20 }, { any: 2025, valor: 20 }]);
    // El 2024 falta: el «canvi de l'últim any» no es fa amb un forat pel mig.
    expect(tipus.canviUltimAny).toBeNull();
    expect(tipus.canviMandat).toEqual({ desDe: 2023, fins: 2025, abs: 100, pct: 25 });
  });

  it("sense habitants d'un any, la taxa d'aquell any és null i la sèrie de fets es queda", () => {
    const tipus = construeixTipus(TIPOLOGIA_TOTAL, new Map([[2025, 500]]), [])!;
    expect(tipus.perMil).toEqual([{ any: 2025, valor: null }]);
  });

  it("una tipologia sense cap dada no existeix: null, no una sèrie buida", () => {
    expect(construeixTipus(TIPOLOGIA_TOTAL, undefined, [])).toBeNull();
    expect(construeixTipus(TIPOLOGIA_TOTAL, new Map(), [])).toBeNull();
  });
});

describe("posicioDinsDe", () => {
  it("l'1 és el que en té més, i els empatats comparteixen posició", () => {
    expect(posicioDinsDe(30, [10, 20, 30])).toBe(1);
    expect(posicioDinsDe(10, [10, 20, 30])).toBe(3);
    expect(posicioDinsDe(30, [30, 30, 10])).toBe(1);
    expect(posicioDinsDe(10, [30, 30, 10])).toBe(3);
  });
});

describe("el catàleg de tipologies", () => {
  it("cada clau i cada número són únics: un número repetit barrejaria sèries", () => {
    const claus = TIPOLOGIES.map((t) => t.clau);
    const numeros = TIPOLOGIES.map((t) => t.numero);
    expect(new Set(claus).size).toBe(claus.length);
    expect(new Set(numeros).size).toBe(numeros.length);
  });
});
