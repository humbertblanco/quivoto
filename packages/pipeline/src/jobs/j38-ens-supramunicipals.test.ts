import { describe, expect, it } from "vitest";
import type { MembreDesat } from "../publish/ens-tipus";
import { seientsPerDistricte } from "../derive/escons-ens";
import {
  agrupaDistrictes,
  aparellaDinsDelMunicipi,
  aparellaRegidor,
  carrecDeDiputacio,
  cognomsLliguen,
  districteElectoral,
  enllacosPleDiba,
  etiquetaDeGrup,
  femeniDelCarrec,
  llegeixFitxaDiba,
  llegeixGrupsDdgi,
  municipiDeCarrec,
  territoriDelMandat,
  treuRepetits,
  uneixFitxes,
  avisosDeSeientsSenseNom,
  esSeientSenseNom,
  NOM_NO_PUBLICAT,
  seientSenseNom,
  separaFilesDelPle,
  carrecDeTram,
  clausDeMunicipi,
  completaMembre,
  corregeixCarrecs,
  euros,
  nomDret,
  numeroVicepresidencia,
  ordreDelPle,
  plegaCapitols,
  plegaDeute,
  plegaProgrames,
  reconciliaPresidencia,
  resolMunicipi,
  rolDeCarrec,
  territoriAmbArticle,
  triaEscuts,
  valorNet,
  type MunicipiTerritori,
  type RegidorActual,
} from "./j38-ens-supramunicipals";

/*
 * Les cadenes d'aquests fixtures són literals del registre de plens
 * (`nm3n-3vbj`), del registre d'ens locals (`6nei-4b44`) i dels conjunts de
 * l'AOC, consultats el 27-10-2026; el consell o la diputació d'on surt cada una
 * va dit al costat. Els noms de persona que no surten de la font són inventats
 * i ho semblen.
 */

describe("rolDeCarrec", () => {
  it("reconeix la presidència en totes les formes que escriu la font", () => {
    expect(rolDeCarrec("President")).toBe("presidencia");
    expect(rolDeCarrec("Presidenta")).toBe("presidencia");
    // Set consells escriuen així el seu president (la Selva, la Noguera…).
    expect(rolDeCarrec("Alcalde President")).toBe("presidencia");
    expect(rolDeCarrec("Alcaldessa Presidenta")).toBe("presidencia");
    expect(rolDeCarrec("Presidenta del Consell Comarcal de l'Alt Urgell")).toBe("presidencia");
  });

  it("no confon la presidència d'una àrea ni un tram retributiu amb la del ple", () => {
    expect(rolDeCarrec("President de l'Àrea de Cultura")).toBe("membre");
    expect(rolDeCarrec("Presidències delegades d’àrea; diputats/des delegats/des")).toBe("membre");
    expect(rolDeCarrec("Vicepresidències; membres de la Comissió Executiva")).toBe("membre");
  });

  it("reconeix les vicepresidències i la resta", () => {
    for (const c of ["Vicepresident 1r", "Vicepresidenta segona", "Vicepresidenta 1ra", "Vicepresident", "Vicepresident 5è"]) {
      expect(rolDeCarrec(c)).toBe("vicepresidencia");
    }
    for (const c of ["Conseller", "Consellera", "Conseller/a", "Diputat/da", "Diputada", null]) {
      expect(rolDeCarrec(c)).toBe("membre");
    }
  });

  it("numera les vicepresidències amb xifra o amb lletra", () => {
    expect(numeroVicepresidencia("Vicepresident 1r")).toBe(1);
    expect(numeroVicepresidencia("Vicepresidenta 3a")).toBe(3);
    expect(numeroVicepresidencia("Vicepresident 5è")).toBe(5);
    expect(numeroVicepresidencia("Vicepresidenta segona")).toBe(2);
    expect(numeroVicepresidencia("Vicepresident tercer")).toBe(3);
    expect(numeroVicepresidencia("Vicepresident")).toBeNull();
    expect(numeroVicepresidencia("Conseller")).toBeNull();
  });

  it("el tram de diba.cat només és càrrec quan és la presidència", () => {
    expect(carrecDeTram("Presidenta")).toBe("Presidenta");
    expect(carrecDeTram("Vicepresidències; membres de la Comissió Executiva i diputats/des presidents/es")).toBe("Diputat/da");
  });
});

describe("textos de la font", () => {
  it("un «-» o un buit no són valors", () => {
    expect(valorNet("-")).toBeNull();
    expect(valorNet("  ")).toBeNull();
    expect(valorNet(undefined)).toBeNull();
    expect(valorNet(" ERC-AM ")).toBe("ERC-AM");
  });

  it("posa dret el nom que el Gironès escriu girat", () => {
    expect(nomDret("Gràcia i Xuclà, Sònia")).toBe("Sònia Gràcia i Xuclà");
    expect(nomDret("Joan Talarn Gilabert")).toBe("Joan Talarn Gilabert");
    expect(nomDret("A, B, C")).toBe("A, B, C");
  });

  it("compon l'article del territori com es diu", () => {
    expect(territoriAmbArticle("El", "Bages")).toBe("el Bages");
    expect(territoriAmbArticle("L' ", "Alt Camp")).toBe("l'Alt Camp");
    expect(territoriAmbArticle("L'", "Anoia")).toBe("l'Anoia");
    expect(territoriAmbArticle("Les", "Garrigues")).toBe("les Garrigues");
    expect(territoriAmbArticle(undefined, "Osona")).toBeNull();
  });

  it("llegeix els imports amb punt i amb coma, i un buit no és zero", () => {
    expect(euros("321864252.10")).toBeCloseTo(321864252.1);
    expect(euros("254794346,34")).toBeCloseTo(254794346.34);
    expect(euros("1.234.567,89")).toBeCloseTo(1234567.89);
    expect(euros("0.00")).toBe(0);
    expect(euros(null)).toBeNull();
    expect(euros("")).toBeNull();
  });
});

describe("de quin municipi és cada membre", () => {
  const municipis: MunicipiTerritori[] = [
    { municipalityId: 1, noms: ["Corçà"] },
    { municipalityId: 2, noms: ["L'Estany", "l'Estany"] },
    { municipalityId: 3, noms: ["Caldes de Malavella"] },
    { municipalityId: 4, noms: ["El Cogul"] },
  ];

  it("resol el nom del municipi amb o sense article, i només si és un de sol", () => {
    expect(clausDeMunicipi("Estany, l'")).toEqual(["l estany", "estany"]);
    expect(resolMunicipi("Corçà", municipis)).toBe(1);
    expect(resolMunicipi("Estany", municipis)).toBe(2);
    expect(resolMunicipi("Cogul", municipis)).toBe(4);
    // Errades i textos que no són municipis (Baix Empordà, Alt Camp): cap.
    expect(resolMunicipi("Caldes de Malavela", municipis)).toBeNull();
    expect(resolMunicipi("CONSELL COMARCAL", municipis)).toBeNull();
    expect(resolMunicipi(null, municipis)).toBeNull();
    const repetit = [...municipis, { municipalityId: 9, noms: ["Corçà"] }];
    expect(resolMunicipi("Corçà", repetit)).toBeNull();
  });

  it("accepta un nom que és l'inici de l'altre per paraules senceres, si és únic", () => {
    const selva: MunicipiTerritori[] = [
      { municipalityId: 20, noms: ["Palamós i Sant Joan"] },
      { municipalityId: 21, noms: ["Vilobí d'Onyar"] },
      { municipalityId: 22, noms: ["Sant Hilari Sacalm"] },
      { municipalityId: 23, noms: ["Sant Feliu de Buixalleu"] },
    ];
    expect(resolMunicipi("Palamós", selva)).toBe(20);
    expect(resolMunicipi("Vilobí d'Onyar, Salitja i Sant Dalmai", selva)).toBe(21);
    // «Sant» és l'inici de dos municipis: cap.
    expect(resolMunicipi("Sant", selva)).toBeNull();
    // «Palam» no és una paraula sencera.
    expect(resolMunicipi("Palam", selva)).toBeNull();
  });

  const regidors: RegidorActual[] = [
    { nom: "EVA MARÍA MARTÍNEZ MORALES", carrec: "Alcaldessa", partit: "PSC-CP", municipalityId: 10 },
    { nom: "Jordi Carol Sabrià", carrec: "Regidor", partit: "ERC-AM", municipalityId: 1 },
    { nom: "Marta Puig Soler", carrec: "Regidora", partit: "JUNTS", municipalityId: 3 },
    { nom: "Marta Puig Soler", carrec: "Alcaldessa", partit: "CUP", municipalityId: 4 },
  ];

  it("aparella pel nom exacte, o per inicial, i només si és únic", () => {
    expect(aparellaRegidor("Jordi Carol Sabrià", regidors).regidor?.municipalityId).toBe(1);
    // Baix Llobregat: el consell l'escriu amb la inicial.
    expect(aparellaRegidor("EVA M. MARTINEZ MORALES", regidors).regidor?.municipalityId).toBe(10);
    // Dues persones amb el mateix nom al territori: no és de cap.
    expect(aparellaRegidor("Marta Puig i Soler", regidors)).toEqual({ regidor: null, ambigu: true });
    expect(aparellaRegidor("Ningú Que Hi Sigui", regidors)).toEqual({ regidor: null, ambigu: false });
  });

  it("el municipi del registre mana, i el partit i l'alcaldia surten del seu ple", () => {
    const { membre, ambigu } = completaMembre(
      { nom: "Marta Puig Soler", carrec: "Consellera", ordre: 7, partit: null, municipiRepresenta: "Cogul" },
      municipis,
      regidors,
    );
    expect(ambigu).toBe(false);
    expect(membre).toMatchObject({
      municipalityId: 4,
      municipiFont: "registre",
      partit: "CUP",
      partitFont: "ple municipal",
      alcaldia: true,
      rol: "membre",
    });
  });

  it("sense municipi al registre es busca pel nom, i el partit de l'ens passa davant", () => {
    const { membre } = completaMembre(
      { nom: "EVA M. MARTINEZ MORALES", carrec: "Presidenta", ordre: 1, partit: "PSC", municipiRepresenta: null },
      municipis,
      regidors,
    );
    expect(membre).toMatchObject({
      municipalityId: 10,
      municipiFont: "aparellament",
      partit: "PSC",
      partitFont: "ens",
      alcaldia: true,
      rol: "presidencia",
    });
  });

  it("un nom ambigu es queda sense municipi i ho diu", () => {
    const { membre, ambigu } = completaMembre(
      { nom: "Marta Puig Soler", carrec: "Consellera", ordre: null, partit: null, municipiRepresenta: "-" },
      municipis,
      regidors,
    );
    expect(ambigu).toBe(true);
    expect(membre).toMatchObject({ municipalityId: null, municipiFont: null, partit: null, partitFont: null, alcaldia: false });
  });
});

const membre = (nom: string, carrec: string, extra: Partial<MembreDesat> = {}): MembreDesat => ({
  nom,
  carrec,
  rol: rolDeCarrec(carrec),
  ordre: null,
  partit: null,
  partitFont: null,
  municipalityId: null,
  municipiFont: null,
  alcaldia: false,
  ...extra,
});

describe("qui presideix", () => {
  it("una presidència que quadra amb el registre no diu res", () => {
    const r = reconciliaPresidencia([membre("Joan Talarn Gilabert", "President"), membre("Agustí Jiménez Pérez", "Vicepresident 1r")], "Joan Talarn Gilabert");
    expect(r.incidencia).toBeNull();
    expect(r.avis).toBeNull();
  });

  it("amb moltes presidències (Tarragona) presideix qui diu el registre d'ens locals", () => {
    const ple = [
      membre("XAVIER ROYO FRANCH", "President"),
      membre("NOEMI LLAURADÓ I SANS", "Alcaldessa Presidenta"),
      membre("IRIS CASTELL I CID", "Presidenta"),
      membre("RUBEN VIÑUALES I ELÍAS", "Vicepresident 1r"),
    ];
    const r = reconciliaPresidencia(ple, "Noemí Llauradó Sans");
    expect(r.incidencia).toBe("diverses");
    expect(r.membres.filter((m) => m.rol === "presidencia").map((m) => m.nom)).toEqual(["NOEMI LLAURADÓ I SANS"]);
    expect(r.membres.find((m) => m.nom === "XAVIER ROYO FRANCH")!.rol).toBe("membre");
    // El càrrec literal no es toca: només el rol.
    expect(r.membres.find((m) => m.nom === "XAVIER ROYO FRANCH")!.carrec).toBe("President");
    expect(r.avis).toMatch(/registre d'ens locals diu que presideix/);
  });

  it("si el registre no permet triar, no es marca cap presidència", () => {
    const r = reconciliaPresidencia([membre("A B C", "President"), membre("D E F", "President")], "Algú Altre Del Tot");
    expect(r.membres.every((m) => m.rol === "membre")).toBe(true);
    expect(r.avis).toMatch(/no es marca cap presidència/);
  });

  it("sense cap presidència, promou qui el registre diu que presideix", () => {
    const r = reconciliaPresidencia([membre("Ramon Jordana Farré", "Conseller"), membre("Anna Riu Vall", "Consellera")], "Ramon Jordana Farré");
    expect(r.incidencia).toBe("promoguda");
    expect(r.membres[0]!.rol).toBe("presidencia");
    expect(r.membres[0]!.carrec).toBe("Conseller");
  });

  it("una presidència diferent de la del registre es manté i queda com a incidència", () => {
    const r = reconciliaPresidencia([membre("Santi Reixach Garriga", "President")], "Albert Danés Casalprim");
    expect(r.incidencia).toBe("discrepant");
    expect(r.membres[0]!.rol).toBe("presidencia");
  });

  it("corregeix el càrrec amb la taula de la seu, només si el nom és d'una fila", () => {
    const ple = [membre("XAVIER ROYO FRANCH", "President"), membre("NOEMI LLAURADÓ I SANS", "Alcaldessa Presidenta")];
    const taula = [
      { nom: "Xavier Royo Franch", carrec: "Diputat delegat" },
      { nom: "Noemí Llauradó i Sans", carrec: "Presidenta" },
    ];
    const r = corregeixCarrecs(ple, taula);
    expect(r.corregits).toBe(2);
    expect(r.membres.map((m) => [m.carrec, m.rol])).toEqual([
      ["Diputat delegat", "membre"],
      ["Presidenta", "presidencia"],
    ]);
  });

  it("ordena el ple: presidència, vicepresidències per número i la resta per ordre", () => {
    const ple = [
      membre("Z", "Conseller", { ordre: 2 }),
      membre("Y", "Vicepresidenta segona"),
      membre("X", "President"),
      membre("W", "Vicepresident 1r"),
      membre("V", "Consellera", { ordre: 1 }),
    ].sort(ordreDelPle);
    expect(ple.map((m) => m.nom)).toEqual(["X", "W", "Y", "V", "Z"]);
  });
});

describe("els comptes", () => {
  it("plega els capítols amb els nou de cada banda i els absents a null", () => {
    const plegat = plegaCapitols([
      { CODI_ENS: "8100690004", ANY_EXERCICI: "2024", TIPUS_PARTIDA: "D", CODI_CAPITOL: "1", liquidat: "2952018.46", pressupostat: "3751121.22" },
      { CODI_ENS: "8100690004", ANY_EXERCICI: "2024", TIPUS_PARTIDA: "I", CODI_CAPITOL: "4", liquidat: "1000.50", pressupostat: null },
      { CODI_ENS: 8100690004, ANY_EXERCICI: 2010, TIPUS_PARTIDA: "D", CODI_CAPITOL: 1, liquidat: "10", pressupostat: "20" },
      { CODI_ENS: "8100690004", ANY_EXERCICI: "2024", TIPUS_PARTIDA: "X", CODI_CAPITOL: "1", liquidat: "1", pressupostat: "1" },
    ]);
    const anys = plegat.get("8100690004")!;
    expect(anys.map((a) => a.any)).toEqual([2010, 2024]);
    const y2024 = anys[1]!.capitols;
    expect(y2024).toHaveLength(18);
    expect(y2024.find((c) => c.tipus === "despeses" && c.capitol === 1)).toEqual({
      tipus: "despeses",
      capitol: 1,
      nom: "Despeses de personal",
      liquidat: 2952018.46,
      pressupostat: 3751121.22,
    });
    expect(y2024.find((c) => c.tipus === "ingressos" && c.capitol === 4)!.pressupostat).toBeNull();
    // Un capítol que la font no porta és un buit, mai un zero.
    expect(y2024.find((c) => c.tipus === "despeses" && c.capitol === 5)!.liquidat).toBeNull();
    expect(y2024.find((c) => c.tipus === "ingressos" && c.capitol === 1)!.nom).toBe("Impostos directes");
  });

  it("tria l'últim exercici de programes i en suma els codis repetits", () => {
    const plegat = plegaProgrames([
      { CODI_ENS: "8000840003", ANY_EXERCICI: "2023", NIVELL: "1", ESTRUCTURA: "1", DESCRIPCIO: "Serveis públics bàsics", IMPORT_DRET_OBLIG: "1,00" },
      { CODI_ENS: "8000840003", ANY_EXERCICI: "2024", NIVELL: "1", ESTRUCTURA: "1", DESCRIPCIO: "Serveis públics bàsics", IMPORT_DRET_OBLIG: "254794346,34" },
      { CODI_ENS: "8000840003", ANY_EXERCICI: "2024", NIVELL: "2", ESTRUCTURA: "15", DESCRIPCIO: "Habitatge i urbanisme", IMPORT_DRET_OBLIG: "100,00" },
      { CODI_ENS: "8000840003", ANY_EXERCICI: "2024", NIVELL: "2", ESTRUCTURA: "15", DESCRIPCIO: "Habitatge i urbanisme", IMPORT_DRET_OBLIG: "50,50" },
      { CODI_ENS: "8000840003", ANY_EXERCICI: "2024", NIVELL: "2", ESTRUCTURA: "9", DESCRIPCIO: null, IMPORT_DRET_OBLIG: null },
      { CODI_ENS: "8000840003", ANY_EXERCICI: "2024", NIVELL: "3", ESTRUCTURA: "151", DESCRIPCIO: "Urbanisme", IMPORT_DRET_OBLIG: "9,00" },
    ]);
    const p = plegat.get("8000840003")!;
    expect(p.any).toBe(2024);
    expect(p.files).toEqual([
      { codi: "1", nom: "Serveis públics bàsics", nivell: 1, obligacions: 254794346.34 },
      { codi: "9", nom: "9", nivell: 2, obligacions: null },
      { codi: "15", nom: "Habitatge i urbanisme", nivell: 2, obligacions: 150.5 },
    ]);
  });

  it("el deute buit no hi és, i un any repetit el corregeix l'última fila", () => {
    const plegat = plegaDeute([
      { CODI_ENS: "8000840003", ANY: "2025", DEUTE_VIU: "440560.000000" },
      { CODI_ENS: "8000840003", ANY: "2024", DEUTE_VIU: "1.000000" },
      { CODI_ENS: "8000840003", ANY: "2024", DEUTE_VIU: "941330.000000" },
      { CODI_ENS: "8000840003", ANY: "2023", DEUTE_VIU: null },
    ]);
    expect(plegat.get("8000840003")).toEqual([
      { any: 2024, deuteViu: 941330 },
      { any: 2025, deuteViu: 440560 },
    ]);
  });
});

describe("districtes i escut", () => {
  it("agrupa els municipis de cada província pel partit electoral del 1979", () => {
    const ids: Record<string, number> = { "2507660009": 1, "1721090004": 2, "1707920002": 3, "0801930008": 4 };
    const districtes = agrupaDistrictes(
      [
        { codi_10: "2507660009", codi_provincia: "8002550006", partit_electoral: "Lleida" },
        { codi_10: "1721090004", codi_provincia: "8001760009", partit_electoral: "Girona" },
        { codi_10: "1707920002", codi_provincia: "8001760009", partit_electoral: "Girona" },
        // Barcelona perd el zero a Socrata: s'hi torna a posar.
        { codi_10: "801930008", codi_provincia: "8000840003", partit_electoral: "Barcelona" },
        { codi_10: "7004400000", codi_provincia: "8002550006" },
        { codi_10: "9999999999", codi_provincia: "8002550006", partit_electoral: "Lleida" },
      ],
      (codi) => ids[codi],
    );
    expect(districtes.get("8001760009")).toEqual([{ nom: "Girona", municipalityIds: [2, 3] }]);
    expect(districtes.get("8002550006")).toEqual([{ nom: "Lleida", municipalityIds: [1] }]);
    expect(districtes.get("8000840003")).toEqual([{ nom: "Barcelona", municipalityIds: [4] }]);
  });

  it("tria l'escut abans que l'emblema, mai la bandera, i en https", () => {
    const escuts = triaEscuts([
      { codi_10: "8103320002", tipus_simbol: "Bandera", url_imatge_simbol: { url: "http://aplicacions.municat.gencat.cat/upload/escuts/bn81033.gif" } },
      { codi_10: "8103320002", tipus_simbol: "Escut", url_imatge_simbol: { url: "http://aplicacions.municat.gencat.cat/upload/escuts/ec81033.jpg" } },
      { codi_10: "8100220002", tipus_simbol: "Emblema", url_imatge_simbol: { url: "http://aplicacions.municat.gencat.cat/upload/escuts/em81002.jpg" } },
      { codi_10: "8100220002", tipus_simbol: "Escut", url_imatge_simbol: { url: "http://aplicacions.municat.gencat.cat/upload/escuts/ec81002.jpg" } },
      { codi_10: "8104190004", tipus_simbol: "Emblema", url_imatge_simbol: { url: "http://aplicacions.municat.gencat.cat/upload/escuts/em81041.jpg" } },
      { codi_10: "8102710007", tipus_simbol: "Bandera", url_imatge_simbol: { url: "http://aplicacions.municat.gencat.cat/upload/escuts/bn81027.gif" } },
    ]);
    expect(escuts.get("8103320002")).toBe("https://aplicacions.municat.gencat.cat/upload/escuts/ec81033.jpg");
    expect(escuts.get("8100220002")).toBe("https://aplicacions.municat.gencat.cat/upload/escuts/ec81002.jpg");
    expect(escuts.get("8104190004")).toBe("https://aplicacions.municat.gencat.cat/upload/escuts/em81041.jpg");
    expect(escuts.has("8102710007")).toBe(false);
  });
});

describe("els districtes de Lleida", () => {
  const fila = (codi_10: string, partit_electoral: string, extra: Partial<Parameters<typeof districteElectoral>[0]> = {}) => ({
    codi_10, codi_provincia: "8002550006", partit_electoral, ...extra,
  });

  it("refà els tres districtes del 1979 que `partit_electoral` no porta", () => {
    // Solsona pel partit judicial d'avui; les Borges per les Garrigues; Sort pel Pallars Sobirà.
    expect(districteElectoral(fila("2513430002", "La Seu d'Urgell", { partit_judicial: "Solsona" }))).toBe("Solsona");
    expect(districteElectoral(fila("2507660009", "Lleida", { codi_comarca: "8101890004" }))).toBe("les Borges Blanques");
    expect(districteElectoral(fila("2520930005", "Tremp", { codi_comarca: "8102650006" }))).toBe("Sort");
    expect(districteElectoral(fila("2512040006", "Lleida", { partit_judicial: "Lleida", codi_comarca: "8103320002" }))).toBe("Lleida");
    // A les altres províncies, la columna tal com ve.
    expect(districteElectoral({ codi_10: "1707920002", codi_provincia: "8001760009", partit_electoral: "Girona", partit_judicial: "Solsona" }))
      .toBe("Girona");
  });

  it("amb els nou districtes i el padró del 2022, la llei dona Lleida 13, Balaguer 3, Cervera 3 i un a cadascun dels altres", () => {
    // Residents de cada districte amb el padró de l'1-1-2022 (x5sz-niat), el de la convocatòria.
    const districtes = [
      { nom: "Balaguer", poblacio: 64_061 }, { nom: "Cervera", poblacio: 51_143 },
      { nom: "La Seu d'Urgell", poblacio: 21_763 }, { nom: "les Borges Blanques", poblacio: 19_011 },
      { nom: "Lleida", poblacio: 229_615 }, { nom: "Solsona", poblacio: 21_244 }, { nom: "Sort", poblacio: 7_181 },
      { nom: "Tremp", poblacio: 17_157 }, { nom: "Vielha e Mijaran", poblacio: 10_268 },
    ];
    const escons = seientsPerDistricte(districtes, 25);
    expect(Object.fromEntries(escons)).toEqual({
      Balaguer: 3, Cervera: 3, "La Seu d'Urgell": 1, "les Borges Blanques": 1, Lleida: 13, Solsona: 1, Sort: 1, Tremp: 1,
      "Vielha e Mijaran": 1,
    });
  });
});

describe("el grup i el municipi segons la pàgina de l'ens", () => {
  // Trossos literals de diba.cat i ddgi.cat (27-10-2026), retallats.
  const PLE_DIBA = `<ul><li><a href="/web/ladiputacio/-/filo-canete-carrillo">Filo Ca&ntilde;ete Carrillo</a></li>
    <li><a href="/web/ladiputacio/-/javier-silva-perez">Javi Silva Pérez</a></li>
    <li><a href="/web/ladiputacio/-/javier-silva-perez">Javi Silva Pérez</a></li></ul>`;
  const FITXA_DIBA = `<div><p class="nomDiputat">Marc Almendro i Campillo</p></div> <div class="destacatApartats">
    <p><strong>Partit judicial:</strong> Mataró</p>
    <p><strong>Partit polític:</strong> Esquerra Republicana de Catalunya-Acord Municipal (ERC-AM)</p>
    <p><strong>Càrrec municipal:</strong> Alcalde d&rsquo;Alella </p></div>`;
  const GRUPS_DDGI = `<h1>Grups polítics</h1><div id="grups_politics">
    <h2 class="estilH3">Grup de Junts per Catalunya a la Diputació de Girona - CM</h2>
    <ul><li><a href="https://www.ddgi.cat/web/nivell/7370/s-/alfons">Il·lm. Sr. Alfons Casamajó Carrera</a></li>
    <li><a href="https://www.ddgi.cat/web/nivell/7443/gemma">Hble. Sra. Gemma Geis i Carreras</a></li></ul>
    <ul><li><strong>President de grup</strong>: Il·lm. Sr. Miquel Noguer i Planas</li></ul>
    <h2 class="estilH3">Grup d'ERC a la Diputació de Girona</h2>
    <ul><li><a href="https://www.ddgi.cat/web/nivell/1/s-/maite">Il·lma. Sra. Maite Tixis Padrosa</a></li></ul>
    <h2 class="estilH3">Grup del PSC a la Diputació de Girona</h2>
    <ul><li><a href="https://www.ddgi.cat/web/nivell/2/s-/adria">Il·lm. Sr. Adrià Lamelas Martínez</a></li></ul></div>`;

  it("llegeix el ple, les fitxes i els grups", () => {
    expect(enllacosPleDiba(PLE_DIBA)).toEqual([
      { nom: "Filo Cañete Carrillo", url: "https://www.diba.cat/web/ladiputacio/-/filo-canete-carrillo" },
      { nom: "Javi Silva Pérez", url: "https://www.diba.cat/web/ladiputacio/-/javier-silva-perez" },
    ]);
    expect(llegeixFitxaDiba(FITXA_DIBA)).toEqual({
      nom: "Marc Almendro i Campillo",
      grup: "Esquerra Republicana de Catalunya-Acord Municipal (ERC-AM)",
      municipi: "Alella",
      alcaldia: true,
      femeni: false,
    });
    expect(llegeixGrupsDdgi(GRUPS_DDGI).map((f) => [f.nom, f.grup])).toEqual([
      ["Alfons Casamajó Carrera", "Junts per Catalunya - CM"],
      ["Gemma Geis i Carreras", "Junts per Catalunya - CM"],
      ["Maite Tixis Padrosa", "ERC"],
      ["Adrià Lamelas Martínez", "PSC"],
    ]);
    expect(etiquetaDeGrup("Grup CUP - Som Poble")).toBe("CUP - Som Poble");
  });

  it("treu el municipi i l'alcaldia del càrrec municipal", () => {
    expect(municipiDeCarrec("Alcaldessa de Sant Adrià de Besòs")).toEqual({ municipi: "Sant Adrià de Besòs", alcaldia: true, femeni: true });
    expect(municipiDeCarrec("Regidor de Sant Cugat del Vallès - tinent d'alcalde")).toEqual({
      municipi: "Sant Cugat del Vallès", alcaldia: false, femeni: false,
    });
    expect(municipiDeCarrec("Alcalde de l'Hospitalet de Llobregat").municipi).toBe("l'Hospitalet de Llobregat");
    expect(municipiDeCarrec("Diputat")).toEqual({ municipi: null, alcaldia: null, femeni: null });
  });

  it("lliga els noms per cognoms, amb el nom de pila familiar o un accent diferent", () => {
    expect(cognomsLliguen("Filo Cañete Carrillo", "Filomena Cañete Carrillo")).toBe(true);
    expect(cognomsLliguen("Xesco Gomar Martín", "Francesc Xavier Gomar Martín")).toBe(true);
    expect(cognomsLliguen("Marc Serra Soler", "Marc Serra Solé")).toBe(true);
    expect(cognomsLliguen("Maria Rosa Boladeras i Domingo", "Rosa Boladeras Domingo")).toBe(true);
    expect(cognomsLliguen("David Solé Gimeno", "Marc Serra Solé")).toBe(false);
    expect(cognomsLliguen("Pau Puig", "Joan Roca")).toBe(false);
  });

  it("dins d'un municipi, aparella pels cognoms només si n'hi ha un de sol", () => {
    const ple = [
      { nom: "Filomena Cañete Carrillo", carrec: "Alcaldessa" },
      { nom: "Joan Puig Roca", carrec: "Regidor" },
      { nom: "Anna Puig Roca", carrec: "Regidora" },
    ];
    expect(aparellaDinsDelMunicipi(["Filo Cañete Carrillo"], ple).regidor?.nom).toBe("Filomena Cañete Carrillo");
    expect(aparellaDinsDelMunicipi(["Pep Puig Roca"], ple)).toEqual({ regidor: null, ambigu: true });
  });

  it("dona a cada membre la seva fitxa, i el municipi i el partit en surten si el ple municipal no lliga", () => {
    const llegits = [
      { nom: "Javi Silva Pérez", carrec: "Diputat/da", ordre: null, partit: null, municipiRepresenta: null },
      { nom: "Marc Serra Soler", carrec: "Diputat/da", ordre: null, partit: null, municipiRepresenta: null },
    ];
    const fitxes = [
      { nom: "Javi Silva Pérez", grup: "Partit dels Socialistes de Catalunya - Candidatura de Progrés", municipi: "Polinyà", alcaldia: true, femeni: false },
      { nom: "Marc Serra Solé", grup: "En Comú Podem", municipi: "Barcelona", alcaldia: false, femeni: false },
    ];
    const { llegits: units, lligats } = uneixFitxes(llegits, fitxes);
    expect(lligats).toBe(2);
    expect(units[1]).toMatchObject({ municipiRepresenta: "Barcelona", grupALEns: "En Comú Podem", nomsAlternatius: ["Marc Serra Solé"] });

    const municipis = [{ municipalityId: 1, noms: ["Polinyà"] }, { municipalityId: 2, noms: ["Barcelona"] }];
    const regidors = [
      { nom: "Marc Serra Solé", carrec: "Regidor", partit: "BCN en Comú - C", municipalityId: 2 },
      { nom: "Javier Silva Pérez", carrec: "Alcalde", partit: null, municipalityId: 1 },
    ];
    const serra = completaMembre(units[1]!, municipis, regidors, "diputacio").membre;
    expect(serra).toMatchObject({ municipalityId: 2, partit: "BCN en Comú - C", partitFont: "ple municipal", nomAlPle: "Marc Serra Solé", carrec: "Diputat" });
    // El ple municipal no en diu el partit: mana el grup de la fitxa, dit com a font de l'ens.
    const silva = completaMembre(units[0]!, municipis, regidors, "diputacio").membre;
    expect(silva).toMatchObject({ municipalityId: 1, partitFont: "ens", alcaldia: true });
    expect(silva.partit).toMatch(/Socialistes/);
  });

  it("una fitxa reclamada per dos membres no és de cap", () => {
    const llegits = [
      { nom: "Joan Puig Roca", carrec: "Diputat", ordre: null, partit: null, municipiRepresenta: null },
      { nom: "Pere Puig Roca", carrec: "Diputat", ordre: null, partit: null, municipiRepresenta: null },
    ];
    const { lligats } = uneixFitxes(llegits, [{ nom: "Josep Puig Roca", grup: "PSC", municipi: null, alcaldia: null }]);
    expect(lligats).toBe(0);
  });
});

describe("neteja del ple", () => {
  it("una persona escrita dues vegades és un sol escó; un escó vacant no es toca", () => {
    const { files, repetits } = treuRepetits([
      { nom: "Ana Herrera Bordallo", municipiRepresenta: "Sant Pere de Ribes" },
      { nom: "ANA HERRERA BORDALLO", municipiRepresenta: "Sant Pere de Ribes" },
      { nom: null, municipiRepresenta: null },
      { nom: null, municipiRepresenta: null },
    ]);
    expect(files).toHaveLength(3);
    expect(repetits).toEqual(["ANA HERRERA BORDALLO"]);
  });

  it("el Lluçanès compta com a Osona per al mandat 2023-2027", () => {
    expect(territoriDelMandat("8102490004", "8104300000")).toBe(true);
    expect(territoriDelMandat("8100000000", "8104300000")).toBe(false);
  });

  it("escriu Diputat o Diputada on la font diu «Diputat/da» o «Conseller/a»", () => {
    expect(carrecDeDiputacio("Diputat/da", true)).toBe("Diputada");
    expect(carrecDeDiputacio("Conseller/a", false)).toBe("Diputat");
    expect(carrecDeDiputacio("Diputat/da", null)).toBe("Membre del ple");
    expect(carrecDeDiputacio("Vicepresidenta segona", false)).toBe("Vicepresidenta segona");
    expect(femeniDelCarrec("Tinenta d'alcalde")).toBe(true);
    expect(femeniDelCarrec("Alcalde")).toBe(false);
    expect(femeniDelCarrec(null)).toBeNull();
  });
});

/*
 * El Montsià al registre de plens (`nm3n-3vbj`, 27-10-2026): 25 files, dues
 * sense nom però amb el càrrec i les sigles. Són literals de la font:
 *   { carrec: "Conseller", partit_politic: "CP", ordre: "23" }
 *   { carrec: "Consellera", partit_politic: "AM", ordre: "14" }
 * I la fila buida de l'Alt Camp, amb «-» a tot arreu, que és un vacant.
 */
describe("els escons amb partit i sense nom", () => {
  const fila = (nom: string | null, carrec: string, partit: string | null, ordre: number | null = null) => ({
    nom, carrec, ordre, partit, municipiRepresenta: null,
  });
  const montsia = [
    fila("Joan Exemple Inventat", "President", "ERC", 1),
    fila(null, "Conseller", "CP", 23),
    fila(null, "Consellera", "AM", 14),
    // L'Alt Camp: «-» al nom, al càrrec i al partit; `valorNet` el deixa en null.
    fila(null, "Conseller/a", null),
  ];

  it("separa els que tenen nom, els que només porten partit i els vacants", () => {
    const { ambNom, senseNom, vacants } = separaFilesDelPle(montsia);
    expect(ambNom.map((f) => f.nom)).toEqual(["Joan Exemple Inventat"]);
    expect(senseNom.map((f) => f.partit)).toEqual(["CP", "AM"]);
    expect(vacants).toBe(1);
  });

  it("un escó sense nom és un membre del seu partit, amb el nom buit i sense cap aparellament", () => {
    const m = seientSenseNom(fila(null, "Consellera", "AM", 14), [], "consell");
    expect(m).toEqual({
      nom: NOM_NO_PUBLICAT, carrec: "Consellera", rol: "membre", ordre: 14, partit: "AM", partitFont: "ens",
      municipalityId: null, municipiFont: null, alcaldia: false, nomAlPle: null,
    });
    expect(esSeientSenseNom(m.nom)).toBe(true);
    expect(esSeientSenseNom("Joan Exemple Inventat")).toBe(false);
  });

  it("el municipi només si el registre el diu, i mai la presidència", () => {
    const municipis: MunicipiTerritori[] = [{ municipalityId: 7, noms: ["Amposta"] }];
    const ambMunicipi = seientSenseNom({ ...fila(null, "Conseller", "CP"), municipiRepresenta: "Amposta" }, municipis, "consell");
    expect(ambMunicipi.municipalityId).toBe(7);
    expect(ambMunicipi.municipiFont).toBe("registre");
    // Un «President» sense nom no es pot comparar amb el registre d'ens locals.
    const president = seientSenseNom(fila(null, "President", "CP"), [], "consell");
    expect(president.carrec).toBe("President");
    expect(president.rol).toBe("membre");
  });

  it("no toca la presidència ni els càrrecs dels que tenen nom", () => {
    const anonim = seientSenseNom(fila(null, "Conseller", "CP", 23), [], "consell");
    const presidenta: MembreDesat = { ...anonim, nom: "Anna Exemple Inventada", carrec: "Presidenta", rol: "presidencia", ordre: 1 };
    const r = reconciliaPresidencia([presidenta, anonim], "Anna Exemple Inventada");
    expect(r.incidencia).toBeNull();
    expect(r.membres.filter((m) => m.rol === "presidencia").map((m) => m.nom)).toEqual(["Anna Exemple Inventada"]);
    expect(corregeixCarrecs([anonim], [{ nom: "", carrec: "Vicepresident 1r" }]).corregits).toBe(0);
  });

  it("l'avís diu quants escons tenen partit sense nom, i a part els vacants", () => {
    const { senseNom, vacants } = separaFilesDelPle(montsia);
    expect(avisosDeSeientsSenseNom(senseNom, vacants)).toEqual([
      "El registre de plens hi dona 2 escons amb el partit (CP, AM) però sense el nom de qui hi seu: aquí compten com a escons de cada partit.",
      "El registre de plens hi deixa un escó sense nom ni partit.",
    ]);
    expect(avisosDeSeientsSenseNom([], 0)).toEqual([]);
    expect(avisosDeSeientsSenseNom([{ partit: "CP" }], 0)).toEqual([
      "El registre de plens hi dona un escó amb el partit (CP) però sense el nom de qui hi seu: aquí compta com a escó d'aquell partit.",
    ]);
  });
});
