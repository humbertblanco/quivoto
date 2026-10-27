import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import {
  KIND,
  PAGINA,
  csvDelXlsx,
  dataIso,
  descobreixFitxers,
  fitxaAlcaldiesMinisteri,
  ine5DelCodi,
  nomEndret,
  ordenaAlcaldies,
  parseFullMinisteri,
} from "./j35-alcaldes-ministeri";

const execFileAsync = promisify(execFile);

/** Un tros de la pàgina del Ministeri, amb els enllaços tal com hi són (relatius, dos cops). */
const HTML = `
<a href="/content/dam/mpt/politica-territorial/local/sistema_de_informacion_local_-SIL-/alcaldes_y_concejales/Alcaldes_Mandato_2019_2023.xlsx">Alcaldes mandato 2019-2023</a>
<a href="/content/dam/mpt/politica-territorial/local/sistema_de_informacion_local_-SIL-/alcaldes_y_concejales/Alcaldes_Mandato_1979_1983.xlsx">Alcaldes mandato 1979-1983</a>
<a href="/content/dam/mpt/politica-territorial/local/sistema_de_informacion_local_-SIL-/alcaldes_y_concejales/Alcaldes_Mandato_2019_2023.xlsx">repetit</a>
<a href="/content/dam/mpt/otra_cosa/Concejales_2019.xlsx">no és d'alcaldes</a>
`;

/**
 * El full del 2019-2023 tal com el deixa `csvDelXlsx`: set files de res al
 * davant, la capçalera a la columna D, i les manies del fitxer real —el codi
 * INE de sis xifres, com a nombre sense el zero, la possessió com a text
 * «dd/mm/aaaa», la província amb espais de farciment i un malnom entre
 * parèntesis—. Badalona amb els tres alcaldes del mandat, i una fila d'Aragó.
 */
const CSV = [
  ",,,,,,,,,,,,,,,,,",
  ",,,,,Alcaldes del mandato de 2.019 a 2.023,,,,,,,,,,,,",
  ",,,,,,,,,,,,,,,,,",
  ",,,COMUNIDAD AUTÓNOMA,PROVINCIA,MUNICIPIO,CÓDIGO INE,NOMBRE,LISTA,FECHA POSESIÓN,FECHA BAJA,,,,,,,",
  ",,,Aragón,Zaragoza,Zaragoza,50297,JORGE AZCÓN NAVARRO,PP,2019-06-15,,,,,,,,",
  ",,,Cataluña,Barcelona,Abrera,080018,JESÚS NAHARRO RODRÍGUEZ,C. ELECTORAL,15/06/2019,,,,,,,,",
  ',,,Cataluña,"Barcelona     ",Badalona,80155,"ALEJANDRO PASTOR LÓPEZ (ÀLEX)",C. ELECTORAL,15/06/2019,2020-05-02,,,,,,,',
  ",,,Cataluña,Barcelona,Badalona,080155,XABIER García Albiol,PP,2020-05-12,2021-11-08,,,,,,,",
  ",,,Cataluña,Barcelona,Badalona,080155,RUBÉN GUIJARRO CASAS,OTROS,2021-11-08,,,,,,,,",
  ",,,Cataluña,Girona,Girona,17079,MARTA MADRENAS MIR,JUNTS,2019-06-15,,,,,,,,",
  ",,,Cataluña,Lleida,Poble Inventat,ABC,ALGÚ,IND,2019-06-15,,,,,,,,",
  ",,,Cataluña,Tarragona,Reus,43123,CARLES PELLICER PUNYED,OTROS,ahir,,,,,,,,",
  ",,,,,,,,,,,,,,,,,",
].join("\n");

describe("descobreixFitxers", () => {
  it("troba un fitxer per mandat, amb l'URL absoluta, en ordre i sense repetits", () => {
    expect(descobreixFitxers(HTML)).toEqual([
      { mandat: "1979-1983", url: "https://mptmd.gob.es/content/dam/mpt/politica-territorial/local/sistema_de_informacion_local_-SIL-/alcaldes_y_concejales/Alcaldes_Mandato_1979_1983.xlsx" },
      { mandat: "2019-2023", url: "https://mptmd.gob.es/content/dam/mpt/politica-territorial/local/sistema_de_informacion_local_-SIL-/alcaldes_y_concejales/Alcaldes_Mandato_2019_2023.xlsx" },
    ]);
    expect(descobreixFitxers("<p>res</p>")).toEqual([]);
    expect(PAGINA).toMatch(/^https:\/\/mptmd\.gob\.es\//);
  });
});

describe("ine5DelCodi", () => {
  it("en treu sempre les cinc xifres del codi, vingui amb dígit de control o sense el zero", () => {
    expect(ine5DelCodi("08015")).toBe("08015");
    expect(ine5DelCodi("080155")).toBe("08015");
    expect(ine5DelCodi("80155")).toBe("08015");
    expect(ine5DelCodi("8001")).toBe("08001");
    expect(ine5DelCodi("80018")).toBe("08001");
    expect(ine5DelCodi("17079")).toBe("17079");
    expect(ine5DelCodi("170795")).toBe("17079");
    expect(ine5DelCodi("43123.0")).toBe("43123");
    expect(ine5DelCodi("ABC")).toBeNull();
    expect(ine5DelCodi("")).toBeNull();
  });
});

describe("nomEndret i dataIso", () => {
  it("gira la coma dels fitxers vells i deixa els altres noms com són", () => {
    expect(nomEndret("LOPEZ LOZANO, MANUEL")).toBe("MANUEL LOPEZ LOZANO");
    expect(nomEndret("CASAS MONTAÐA, JOAN")).toBe("JOAN CASAS MONTAÑA");
    expect(nomEndret("RIERA VILAPLANA,  VALENTI ")).toBe("VALENTI RIERA VILAPLANA");
    expect(nomEndret("MARIA SOLER SALA")).toBe("MARIA SOLER SALA");
    expect(nomEndret("ALEJANDRO PASTOR LÓPEZ (ÀLEX)")).toBe("ALEJANDRO PASTOR LÓPEZ (ÀLEX)");
    expect(nomEndret("COGNOM,")).toBe("COGNOM");
  });

  it("llegeix les dates ISO i les «dd/mm/aaaa», i no s'inventa la resta", () => {
    expect(dataIso("2019-06-15")).toBe("2019-06-15");
    expect(dataIso("2019-06-15 00:00:00")).toBe("2019-06-15");
    expect(dataIso("15/06/2019")).toBe("2019-06-15");
    expect(dataIso("2/5/2020")).toBe("2020-05-02");
    expect(dataIso("ahir")).toBeNull();
    expect(dataIso("2019-13-01")).toBeNull();
    expect(dataIso("")).toBeNull();
  });
});

describe("parseFullMinisteri", () => {
  const lectura = parseFullMinisteri(CSV, "2019-2023");

  it("es queda amb Catalunya, pel codi INE de cinc xifres, amb les dates en ISO i el mandat del fitxer", () => {
    expect(lectura.altresComunitats).toBe(1);
    expect(lectura.files.map((f) => `${f.ine5} ${f.nom} ${f.possessio ?? "?"}→${f.baixa ?? "-"}`)).toEqual([
      "08001 JESÚS NAHARRO RODRÍGUEZ 2019-06-15→-",
      "08015 ALEJANDRO PASTOR LÓPEZ (ÀLEX) 2019-06-15→2020-05-02",
      "08015 XABIER García Albiol 2020-05-12→2021-11-08",
      "08015 RUBÉN GUIJARRO CASAS 2021-11-08→-",
      "17079 MARTA MADRENAS MIR 2019-06-15→-",
      "43123 CARLES PELLICER PUNYED ?→-",
    ]);
    expect(lectura.files[2]).toMatchObject({ mandat: "2019-2023", municipi: "Badalona", llista: "PP" });
    expect(lectura.files[0]!.llista).toBe("C. ELECTORAL");
  });

  it("apunta el que no sap llegir en comptes de callar-ho o d'inventar-ho", () => {
    expect(lectura.senseCodi).toEqual(["ABC (Poble Inventat)"]);
    expect(lectura.datesEstranyes).toEqual(["ahir (Reus, 2019-2023)"]);
  });

  it("s'atura si el fitxer ha canviat d'esquema", () => {
    expect(() => parseFullMinisteri("a,b,c\n1,2,3\n", "2019-2023")).toThrow(/CÓDIGO INE/);
    expect(() => parseFullMinisteri(",,,COMUNIDAD AUTÓNOMA,MUNICIPIO,CÓDIGO INE,NOMBRE\n", "2019-2023")).toThrow(/falta la columna «lista»/);
  });
});

describe("fitxaAlcaldiesMinisteri", () => {
  const files = parseFullMinisteri(CSV, "2019-2023").files.filter((f) => f.ine5 === "08015");
  const vell = { mandat: "2015-2019", nom: "MARIA DOLORS SABATER PUIG", llista: "GUANYEM", possessio: "2015-06-13", baixa: "2018-06-20" };
  const fitxa = fitxaAlcaldiesMinisteri("08015", [...files, vell], [{ mandat: "2019-2023", url: "https://mptmd.gob.es/x.xlsx" }], "2026-09-03");

  it("porta font, organisme, pàgina, fitxers, llicència i data de consulta, amb les alcaldies per mandat i data", () => {
    expect(fitxa).toMatchObject({ organisme: "Ministeri de Política Territorial i Memòria Democràtica", url: PAGINA, consultat: "2026-09-03", ine5: "08015" });
    expect(fitxa.llicencia).toMatch(/37\/2007/);
    expect(fitxa.fitxers).toEqual([{ mandat: "2019-2023", url: "https://mptmd.gob.es/x.xlsx" }]);
    expect(fitxa.alcaldies.map((a) => `${a.mandat} ${a.nom}`)).toEqual([
      "2015-2019 MARIA DOLORS SABATER PUIG",
      "2019-2023 ALEJANDRO PASTOR LÓPEZ (ÀLEX)",
      "2019-2023 XABIER García Albiol",
      "2019-2023 RUBÉN GUIJARRO CASAS",
    ]);
    // El que es desa no porta el municipi ni el codi: ja és a la fitxa.
    expect(Object.keys(fitxa.alcaldies[1]!).sort()).toEqual(["baixa", "llista", "mandat", "nom", "possessio"]);
    expect(KIND).toBe("alcaldiesMinisteri");
  });

  it("les alcaldies sense data de possessió van primer dins del mandat", () => {
    const ordenades = ordenaAlcaldies([files[1]!, { ...files[0]!, possessio: null }]);
    expect(ordenades.map((a) => a.possessio)).toEqual([null, "2020-05-12"]);
  });
});

/** Només si hi ha `python3` amb `openpyxl`: és el que el job fa servir de veritat. */
const hiHaOpenpyxl = await execFileAsync("python3", ["-c", "import openpyxl"]).then(() => true, () => false);

describe.runIf(hiHaOpenpyxl)("csvDelXlsx", () => {
  it("llegeix un XLSX de veritat: dates en ISO, buits com a buits i nombres com a text", async () => {
    const dir = await mkdtemp(join(tmpdir(), "quivoto-j35-test-"));
    try {
      const ruta = join(dir, "prova.xlsx");
      await execFileAsync("python3", ["-c", [
        "import sys, datetime, openpyxl",
        "wb = openpyxl.Workbook(); ws = wb.active; ws.title = 'Alcaldes 2015-2019'",
        "ws.append([None, None, None, 'COMUNIDAD AUTÓNOMA', 'PROVINCIA', 'MUNICIPIO', 'CÓDIGO INE', 'NOMBRE', 'LISTA', 'FECHA POSESIÓN', 'FECHA BAJA'])",
        "ws.append([None, None, None, 'Cataluña', 'Barcelona      ', 'Badalona', 80155, 'ALEJANDRO PASTOR LÓPEZ (ÀLEX)', 'C. ELECTORAL', '15/06/2019', datetime.datetime(2020, 5, 2)])",
        "ws.append([None, None, None, 'Cataluña', 'Barcelona', 'Badalona', '080155', 'XABIER García Albiol', 'PP', datetime.datetime(2020, 5, 12), datetime.datetime(2021, 11, 8)])",
        "wb.save(sys.argv[1])",
      ].join("\n"), ruta]);
      const csv = await csvDelXlsx(ruta);
      const lectura = parseFullMinisteri(csv, "2019-2023");
      expect(lectura.files.map((f) => `${f.ine5} ${f.nom} ${f.possessio}→${f.baixa}`)).toEqual([
        "08015 ALEJANDRO PASTOR LÓPEZ (ÀLEX) 2019-06-15→2020-05-02",
        "08015 XABIER García Albiol 2020-05-12→2021-11-08",
      ]);
      expect(lectura.datesEstranyes).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
