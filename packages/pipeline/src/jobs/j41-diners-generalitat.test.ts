import { describe, expect, it } from "vitest";
import {
  CODI_AMB,
  CONSULTA_FCL,
  codi10,
  dataCurta,
  estatDocument,
  llegeixFcl,
  llegeixImportAmbPunts,
  llegeixObra,
  llegeixPendents,
  llegeixRegistre,
  llegeixTramesa,
  llegeixTrameses,
  muntaDiners,
  normalitzaNif,
  numero,
  ordenaObres,
  type Llegit,
} from "./j41-diners-generalitat";

/*
 * Les fixtures copien files reals dels quatre conjunts (`ka4a-fyht`,
 * `v5fj-86q3`, `7fnj-etev`, `4w8y-gf8x`) i del registre d'ens locals
 * (`6nei-4b44`) consultades el 27-10-2026, retallades al que fa falta. Cap
 * prova toca la xarxa ni la base de dades.
 */

describe("codi10", () => {
  it("torna el zero que el PUOSC perd als codis de la província de Barcelona", () => {
    expect(codi10("825150006")).toBe("0825150006");
    expect(codi10("1715440003")).toBe("1715440003");
    expect(codi10(808500000)).toBe("0808500000");
  });
  it("no s'inventa un codi d'un text que no ho és", () => {
    expect(codi10(undefined)).toBeNull();
    expect(codi10("")).toBeNull();
    expect(codi10("N/A")).toBeNull();
    expect(codi10("12345678901")).toBeNull();
  });
});

describe("llegeixImportAmbPunts", () => {
  it("llegeix els pressupostos del PUOSC amb punts per a tot", () => {
    expect(llegeixImportAmbPunts("247.806.98")).toBe(247806.98);
    expect(llegeixImportAmbPunts("1.504.817.12")).toBe(1504817.12);
    expect(llegeixImportAmbPunts("47.876.68")).toBe(47876.68);
    expect(llegeixImportAmbPunts("5.314.55")).toBe(5314.55);
    expect(llegeixImportAmbPunts("949.85")).toBe(949.85);
  });
  it("un darrer grup de tres xifres són milers, no cèntims", () => {
    expect(llegeixImportAmbPunts("164.000")).toBe(164000);
    expect(llegeixImportAmbPunts("1.234.567")).toBe(1234567);
    expect(llegeixImportAmbPunts("45.000")).toBe(45000);
  });
  it("accepta la forma catalana amb coma i els números sense punts", () => {
    expect(llegeixImportAmbPunts("1.234,56")).toBe(1234.56);
    expect(llegeixImportAmbPunts("115416.63")).toBe(115416.63);
    expect(llegeixImportAmbPunts("12000")).toBe(12000);
    expect(llegeixImportAmbPunts(" 247.806.98 € ")).toBe(247806.98);
  });
  it("una forma ambigua o buida torna null, mai zero", () => {
    expect(llegeixImportAmbPunts("1234.567")).toBeNull();
    expect(llegeixImportAmbPunts("12.34.56")).toBeNull();
    expect(llegeixImportAmbPunts("1.2345.67")).toBeNull();
    expect(llegeixImportAmbPunts("N/A")).toBeNull();
    expect(llegeixImportAmbPunts("")).toBeNull();
    expect(llegeixImportAmbPunts(undefined)).toBeNull();
    expect(llegeixImportAmbPunts("abc")).toBeNull();
  });
});

describe("numero i dataCurta", () => {
  it("buits i N/A són null; un zero publicat és zero", () => {
    expect(numero("0")).toBe(0);
    expect(numero("44203.27")).toBe(44203.27);
    expect(numero("N/A")).toBeNull();
    expect(numero(undefined)).toBeNull();
    expect(numero("")).toBeNull();
  });
  it("talla la data de Socrata al dia", () => {
    expect(dataCurta("2024-10-09T00:00:00.000")).toBe("2024-10-09");
    expect(dataCurta(undefined)).toBeNull();
    expect(dataCurta("ahir")).toBeNull();
  });
});

describe("llegeixFcl", () => {
  it("la consulta agrega al servidor per ens i any", () => {
    expect(CONSULTA_FCL.group).toBe("codi_10,any");
    expect(CONSULTA_FCL.select).toContain("sum(import)");
  });
  it("desa els tres trams per separat i deixa null el que la font no porta", () => {
    const { perCodi, repetides, illegibles } = llegeixFcl([
      { codi_10: "0800180001", any: "2013", lliure: "0", extraordinari: "172981.16", files: "1" },
      { codi_10: "0800180001", any: "2010", lliure: "206841.04", supramunicipal: "16078.27", files: "1" },
      { codi_10: "8100170005", any: "2025", lliure: "974404.93", extraordinari: "194877.36", files: "1" },
      { codi_10: "8100170005", any: "2016", lliure: "900000", files: "2" },
      { codi_10: "N/A", any: "2016", lliure: "1" },
    ]);
    expect(perCodi.get("0800180001")).toEqual([
      { any: 2010, lliure: 206841.04, supramunicipal: 16078.27, extraordinari: null },
      { any: 2013, lliure: 0, supramunicipal: null, extraordinari: 172981.16 },
    ]);
    expect(perCodi.get("8100170005")![1]).toEqual({ any: 2025, lliure: 974404.93, supramunicipal: null, extraordinari: 194877.36 });
    expect(repetides).toEqual([{ codiEns: "8100170005", any: 2016, files: 2 }]);
    expect(illegibles).toBe(1);
  });
});

describe("llegeixObra", () => {
  const fila = {
    expedient: "PRE082/19/00571",
    l_nia: "INV",
    any: "2022",
    titol_actuacio: "Reurbanització de l'avinguda del Centre",
    tipologia_obra: "N/A",
    pressupost: "302.259.80",
    subvenci_puosc: "11347.16",
    codi_ens: "825150006",
  };
  it("llegeix l'obra amb el codi d'ens refet i el pressupost llegit", () => {
    const r = llegeixObra(fila, 2026)!;
    expect(r.codiEns).toBe("0825150006");
    expect(r.obra).toEqual({
      any: 2022,
      estat: "assignada",
      titol: "Reurbanització de l'avinguda del Centre",
      tipologia: null,
      linia: "inversions",
      subvencio: 11347.16,
      pressupost: 302259.8,
      expedient: "PRE082/19/00571",
    });
    expect(r.avisos).toEqual([]);
  });
  it("l'any de la consulta i els posteriors són anualitats programades", () => {
    expect(llegeixObra({ ...fila, any: "2026" }, 2026)!.obra.estat).toBe("programada");
    expect(llegeixObra({ ...fila, any: "2029", l_nia: "MP" }, 2026)!.obra).toMatchObject({ estat: "programada", linia: "municipis petits" });
    expect(llegeixObra({ ...fila, any: "2025" }, 2026)!.obra.estat).toBe("assignada");
  });
  it("les obres antigues no porten títol ni pressupost, i queden null", () => {
    const r = llegeixObra(
      { expedient: "N/A", l_nia: "N/A", any: "2000", titol_actuacio: "N/A", tipologia_obra: "Pavimentació/urbanització/conservació vies públiques", subvenci_puosc: "18380.74", codi_ens: "2500240003" },
      2026,
    )!;
    expect(r.obra).toMatchObject({ titol: null, pressupost: null, expedient: null, linia: null, subvencio: 18380.74 });
    expect(r.avisos).toEqual([]);
  });
  it("avisa d'un pressupost il·legible i d'una subvenció per sobre del pressupost", () => {
    expect(llegeixObra({ ...fila, pressupost: "1234.567" }, 2026)!.avisos).toEqual(["pressupost_illegible"]);
    expect(llegeixObra({ ...fila, pressupost: "91.648.02", subvenci_puosc: "916410" }, 2026)!.avisos).toEqual(["subvencio_sobre_pressupost"]);
  });
  it("sense codi o sense any no és una obra", () => {
    expect(llegeixObra({ ...fila, codi_ens: undefined }, 2026)).toBeNull();
    expect(llegeixObra({ ...fila, any: "N/A" }, 2026)).toBeNull();
  });
  it("ordena de la més recent a la més antiga i, dins l'any, per subvenció", () => {
    const o = (any: number, subvencio: number | null) => ({ ...llegeixObra(fila, 2026)!.obra, any, subvencio });
    expect(ordenaObres([o(2020, 5), o(2022, 1), o(2022, 9), o(2022, null)]).map((x) => [x.any, x.subvencio])).toEqual([
      [2022, 9],
      [2022, 1],
      [2022, null],
      [2020, 5],
    ]);
  });
});

describe("inventari de trameses", () => {
  const rabos = {
    codi10: "1714320002",
    tipusens: "Municipis",
    any: "2023",
    compliment: "Compleix",
    pressupostdecofin: "Tramès",
    datapressupostdecofin: "2023-05-23T00:00:00.000",
    pressupostdocadm: "Tramès",
    datapressupostdocadm: "2023-05-23T00:00:00.000",
    liquidaci_decofin: "Tramès",
    dataliquidaci_decofin: "2024-04-19T00:00:00.000",
    liquidaci_docadm: "Tramès",
    dataliquidaci_docadm: "2024-04-19T00:00:00.000",
    estatdeutefiex: "Tramès",
    dataestatdeutefiex: "2024-05-31T00:00:00.000",
    comptegeneral: "Tramès",
    datacomptegeneral: "2024-10-09T00:00:00.000",
    dataultimacarrega: "2026-10-27T00:00:00.000",
  };
  const albages2026 = {
    codi10: "2500610007",
    tipusens: "Municipis",
    any: "2026",
    compliment: "Compleix",
    pressupostdecofin: "Tramès",
    datapressupostdecofin: "2026-03-23T00:00:00.000",
    obspressupostdecofin: "En revisió",
    pressupostdocadm: "Tramès",
    datapressupostdocadm: "2026-03-23T00:00:00.000",
    liquidaci_decofin: "No tramès",
    liquidaci_docadm: "No tramès",
    estatdeutefiex: "No tramès",
    comptegeneral: "No tramès",
    dataultimacarrega: "2026-10-27T00:00:00.000",
  };

  it("un document és tramès amb data, no tramès sense data, o null si la font calla", () => {
    expect(estatDocument("Tramès", "2024-10-09T00:00:00.000", undefined)).toEqual({ trames: true, data: "2024-10-09", observacio: null });
    expect(estatDocument("No tramès", "2024-10-09T00:00:00.000", "Altres situacions")).toEqual({ trames: false, data: null, observacio: "Altres situacions" });
    expect(estatDocument(undefined, undefined, undefined)).toBeNull();
    expect(estatDocument("Pendent", undefined, undefined)).toBeNull();
  });

  it("llegeix una fila sencera", () => {
    const r = llegeixTramesa(rabos)!;
    expect(r.codiEns).toBe("1714320002");
    expect(r.any.compteGeneral).toEqual({ trames: true, data: "2024-10-09", observacio: null });
    expect(r.any.liquidacio.economic?.data).toBe("2024-04-19");
    const sensDeute = llegeixTramesa({ ...rabos, estatdeutefiex: undefined, dataestatdeutefiex: undefined })!;
    expect(sensDeute.any.deute).toBeNull();
  });

  it("plega per ens, ordena els anys i desa l'estat de l'any més recent", () => {
    const { perCodi, illegibles } = llegeixTrameses([
      albages2026,
      { ...albages2026, any: "2019", compliment: "No compleix", dataultimacarrega: "2026-10-01T00:00:00.000" },
      rabos,
      { codi10: "N/A", any: "2020" },
    ]);
    expect(illegibles).toBe(1);
    const albages = perCodi.get("2500610007")!;
    expect(albages.anys.map((a) => a.any)).toEqual([2019, 2026]);
    expect(albages.estatInventari).toBe("Compleix");
    expect(albages.actualitzat).toBe("2026-10-27");
    expect(albages.anys[1]!.pressupost.economic?.observacio).toBe("En revisió");
    expect(albages.anys[1]!.compteGeneral).toEqual({ trames: false, data: null, observacio: null });
  });
});

describe("llegeixPendents", () => {
  it("plega per NIF, separa el retingut i descarta el que no és un deute", () => {
    const perNif = llegeixPendents([
      { nifcreditor: "P0807900F", tipusajut: "FCL", exercici: "2026", importnet: "14397.63" },
      { nifcreditor: "p-0807900-f", tipusajut: "FCL", exercici: "2026", importnet: "100" },
      { nifcreditor: "P0807900F", tipusajut: "PUOSC", exercici: "2025", importnet: "5000", retenci: "Pagament retingut" },
      { nifcreditor: "P0807900F", tipusajut: "FCL", exercici: "2026", importnet: "0" },
      { nifcreditor: "Benef. no publicable", tipusajut: "FCL", exercici: "2026", importnet: "10" },
      { nifcreditor: "P2527700E", tipusajut: "FCL", importnet: "14410.31" },
    ]);
    expect(perNif.get("P0807900F")).toEqual([
      { tipus: "FCL", exercici: 2026, import: 14497.63, retingut: false },
      { tipus: "PUOSC", exercici: 2025, import: 5000, retingut: true },
    ]);
    expect(perNif.get("P2527700E")).toEqual([{ tipus: "FCL", exercici: null, import: 14410.31, retingut: false }]);
    expect(perNif.size).toBe(2);
  });
  it("normalitza el NIF i rebutja el que no en té la forma", () => {
    expect(normalitzaNif(" p-0800100-j ")).toBe("P0800100J");
    expect(normalitzaNif("Persona física")).toBeNull();
    expect(normalitzaNif(undefined)).toBeNull();
  });
});

const REGISTRE = [
  { codi_ens: "8000840003", nomtipus: "Províncies", nom_complert: "Diputació de Barcelona", cif: "P0800000B", codi_municipi: "0801930008", dissolt: "N" },
  { codi_ens: "8100170005", nomtipus: "Comarques", nom_complert: "Consell Comarcal de l'Alt Camp", cif: "P9300005G", codi_municipi: "4316130008", dissolt: "N" },
  { codi_ens: "8101360009", nomtipus: "Comarques", nom_complert: "Comarca del Barcelonès", cif: "P5800012F", codi_municipi: "0801930008", dissolt: "N" },
  { codi_ens: "8104300000", nomtipus: "Comarques", nom_complert: "Comarca del Lluçanès", codi_municipi: "0817120002", dissolt: "N" },
  { codi_ens: "8103980001", nomtipus: "Comarques", nom_complert: "Conselh Generau d'Aran", cif: "P7500011G", codi_municipi: "2524300000", dissolt: "N" },
  { codi_ens: "8200330008", nomtipus: "Entitats metropolitanes", nom_complert: "Àrea Metropolitana de Barcelona", cif: "P0800258F", codi_municipi: "0801930008", dissolt: "N" },
  { codi_ens: "8200270005", nomtipus: "Entitats metropolitanes", nom_complert: "Entitat Metropolitana del Transport", codi_municipi: "0801930008", dissolt: "N" },
  { codi_ens: "800180001", nomtipus: "Municipis", nom_complert: "Ajuntament d'Abrera", cif: "P0800100J", dissolt: "N" },
  { codi_ens: "2599990000", nomtipus: "Municipis", nom_complert: "Municipi dissolt", cif: "P2599999A", dissolt: "S" },
];

describe("llegeixRegistre", () => {
  it("tria les diputacions, els consells comarcals vius i l'AMB, amb la seu", () => {
    const { ens } = llegeixRegistre(REGISTRE);
    expect(ens.map((e) => [e.codiEns, e.tipus, e.seuCodiEns])).toEqual([
      ["8000840003", "diputacio", "0801930008"],
      ["8100170005", "consell", "4316130008"],
      [CODI_AMB, "amb", "0801930008"],
    ]);
  });
  it("guarda el NIF de cada ens, municipis inclosos, amb el codi refet", () => {
    const { nifPerCodi } = llegeixRegistre(REGISTRE);
    expect(nifPerCodi.get("0800180001")).toBe("P0800100J");
    expect(nifPerCodi.has("2599990000")).toBe(false);
    expect(nifPerCodi.has("8104300000")).toBe(false);
  });
});

describe("muntaDiners", () => {
  const llegit: Llegit = {
    fcl: new Map([["0800180001", [{ any: 2025, lliure: 300000, supramunicipal: null, extraordinari: 60000 }]]]),
    obres: new Map(),
    trameses: new Map(),
    pendents: { data: "2026-10-01", perNif: new Map([["P0800100J", [{ tipus: "FCL", exercici: 2026, import: 10, retingut: false }]]]) },
    nifPerCodi: new Map([["0800180001", "P0800100J"], ["8000840003", "P0800000B"]]),
    anyConsulta: 2026,
    consultat: "2026-10-27",
  };
  it("munta un municipi amb totes les fonts i la data de consulta a cada una", () => {
    const d = muntaDiners("0800180001", llegit);
    expect(d.fcl).toEqual([{ any: 2025, lliure: 300000, supramunicipal: null, extraordinari: 60000 }]);
    expect(d.obres).toEqual([]);
    expect(d.trameses).toEqual({ anys: [], estatInventari: null, actualitzat: null });
    expect(d.pendents).toEqual({ data: "2026-10-01", conceptes: [{ tipus: "FCL", exercici: 2026, import: 10, retingut: false }] });
    expect(d.fonts.fcl).toMatchObject({ id: "ka4a-fyht", consultat: "2026-10-27" });
    expect(d.fonts.trameses.llicencia).toContain("ODC-By");
  });
  it("una diputació no rep FCL: null, que no és una llista buida", () => {
    const d = muntaDiners("8000840003", llegit, false);
    expect(d.fcl).toBeNull();
    // Té NIF però no surt a la relació: cap pagament pendent aquell dia.
    expect(d.pendents).toEqual({ data: "2026-10-01", conceptes: [] });
  });
  it("sense NIF o sense instantània, el pendent és null (no consta), no buit", () => {
    expect(muntaDiners("9999999999", llegit).pendents).toBeNull();
    expect(muntaDiners("0800180001", { ...llegit, pendents: null }).pendents).toBeNull();
    expect(muntaDiners("9999999999", llegit).fcl).toEqual([]);
  });
});
