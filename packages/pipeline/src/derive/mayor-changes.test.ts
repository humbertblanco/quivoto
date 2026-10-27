import { describe, expect, it } from "vitest";
import type { AlcaldiaWikidata } from "../jobs/j31-alcaldies-wikidata";
import type { AlcaldiaMinisteri } from "../jobs/j35-alcaldes-ministeri";
import {
  distanciaNoms, fusionaAmbWikidata, mateixaPersona, motiuFinalEscrit, partitAmbSentit, partitSenseParentesis, partitTruncat,
  reparaNomAlcaldia, termDe, type PasAlcaldia,
} from "./alcaldies";
import { datesDeConstitucio, findChanges } from "./mayor-changes";

/**
 * Badalona segons la Generalitat: una alcaldia per mandat, el partit retallat
 * a quinze caràcters i el nom de pila abreujat. És el forat que J31 omple.
 */
const GENERALITAT: PasAlcaldia[] = [
  { term: "2011-2015", name: "XAVIER GARCIA ALBIOL", partyRaw: "PP", tookOfficeOn: "2011-06-11" },
  { term: "2015-2019", name: "MA. DOLORS SABATER PUIG", partyRaw: "BADALONA EN COM", tookOfficeOn: "2015-06-13" },
  { term: "2019-2023", name: "ALEJANDRO PASTOR LOPEZ", partyRaw: "PSC-CP", tookOfficeOn: "2019-06-15" },
  { term: "2023-2027", name: "XAVIER GARCIA ALBIOL", partyRaw: "PP", tookOfficeOn: "2023-06-17" },
];

const wd = (a: Partial<AlcaldiaWikidata> & Pick<AlcaldiaWikidata, "qid" | "nom" | "inici">): AlcaldiaWikidata => ({
  fi: null, motiuFinal: null, motiuFinalQid: null, interina: false, partit: null, partitQid: null, partits: [], imatge: null, ...a,
});

/** Les set declaracions de P6 de Badalona des del 2015, més una de franquista i una sense data. */
const WIKIDATA: AlcaldiaWikidata[] = [
  wd({ qid: "Q1", nom: "Josep Maria de Porcioles", inici: "1957-03-16", fi: "1973-05-16" }),
  wd({ qid: "Q2", nom: "Maria Dolors Sabater i Puig", inici: "2015-06-13", fi: "2018-06-20", motiuFinal: "moció de censura", partit: "Guanyem Badalona en Comú" }),
  wd({ qid: "Q3", nom: "Àlex Pastor López", inici: "2018-06-20", fi: "2019-06-15", partit: "Partit dels Socialistes de Catalunya" }),
  wd({ qid: "Q3", nom: "Àlex Pastor López", inici: "2019-06-15", fi: "2020-04-29", motiuFinal: "dimissió", partit: "Partit dels Socialistes de Catalunya" }),
  wd({ qid: "Q4", nom: "Aïda Llauradó Álvarez", inici: "2020-04-29", fi: "2020-05-12", interina: true, partit: "Badalona en Comú Podem" }),
  wd({ qid: "Q5", nom: "Xavier García Albiol", inici: "2020-05-12", fi: "2021-11-08", motiuFinal: "moció de censura", partit: "Partit Popular" }),
  wd({ qid: "Q6", nom: "Rubén Guijarro Casas", inici: "2021-11-08", fi: "2023-06-17", partit: "Partit dels Socialistes de Catalunya" }),
  wd({ qid: "Q5", nom: "Xavier García Albiol", inici: "2023-06-17", partit: "Partit Popular" }),
  wd({ qid: "Q7", nom: "Algú Sense Data", inici: null }),
];

const TERM_STARTS = new Map([["2011-2015", "2011-06-11"], ["2015-2019", "2015-06-13"], ["2019-2023", "2019-06-15"], ["2023-2027", "2023-06-17"]]);

describe("fusionaAmbWikidata", () => {
  const history = fusionaAmbWikidata(GENERALITAT, WIKIDATA, TERM_STARTS);

  it("afegeix els passos que la Generalitat no té, marcats com de Wikidata i dins del mandat que toca", () => {
    expect(history.map((h) => `${h.term} ${h.name}${h.font === "wikidata" ? " (wd)" : ""}`)).toEqual([
      "2011-2015 XAVIER GARCIA ALBIOL",
      "2015-2019 MA. DOLORS SABATER PUIG",
      "2015-2019 Àlex Pastor López (wd)",
      "2019-2023 ALEJANDRO PASTOR LOPEZ",
      "2019-2023 Aïda Llauradó Álvarez (wd)",
      "2019-2023 Xavier García Albiol (wd)",
      "2019-2023 Rubén Guijarro Casas (wd)",
      "2023-2027 XAVIER GARCIA ALBIOL",
    ]);
    const pastor2015 = history[2]!;
    expect(pastor2015).toMatchObject({ font: "wikidata", qid: "Q3", tookOfficeOn: "2018-06-20", finsA: "2019-06-15", partyRaw: null, partitWikidata: "Partit dels Socialistes de Catalunya" });
    expect(history[4]).toMatchObject({ name: "Aïda Llauradó Álvarez", interina: true, tookOfficeOn: "2020-04-29", finsA: "2020-05-12" });
    expect(history[5]).toMatchObject({ motiuFinal: "moció de censura", partitWikidata: "Partit Popular" });
  });

  it("no toca cap camp de la Generalitat: nom, partit i data es queden tal com eren", () => {
    for (const original of GENERALITAT) {
      const fila = history.find((h) => h.term === original.term && h.name === original.name)!;
      expect(fila).toMatchObject({ partyRaw: original.partyRaw, tookOfficeOn: original.tookOfficeOn });
      expect(fila.font).toBeUndefined();
    }
    expect(GENERALITAT[1]!.finsA).toBeUndefined();
  });

  it("de la fila que lliga en pren el final, el motiu i el QID, i el partit sencer només si el seu és retallat", () => {
    const sabater = history[1]!;
    expect(sabater).toMatchObject({ qid: "Q2", finsA: "2018-06-20", motiuFinal: "moció de censura", partitWikidata: "Guanyem Badalona en Comú" });
    // «ALEJANDRO PASTOR LOPEZ» i «Àlex Pastor López» són la mateixa persona: pels cognoms i la inicial.
    const pastor2019 = history[3]!;
    expect(pastor2019).toMatchObject({ qid: "Q3", finsA: "2020-04-29", motiuFinal: "dimissió" });
    expect(pastor2019.partitWikidata).toBeUndefined();
    // L'alcaldia vigent no té final, i el PP no és cap text retallat.
    expect(history[7]).toMatchObject({ qid: "Q5", finsA: null, motiuFinal: null });
    expect(history[7]!.partitWikidata).toBeUndefined();
  });

  it("deixa fora el que no es pot situar: abans del 1979, sense data, o en un mandat que la Generalitat no té", () => {
    expect(history.some((h) => h.name === "Josep Maria de Porcioles" || h.name === "Algú Sense Data")).toBe(false);
    const nomes2023 = fusionaAmbWikidata([GENERALITAT[3]!], WIKIDATA, TERM_STARTS);
    expect(nomes2023.map((h) => h.name)).toEqual(["XAVIER GARCIA ALBIOL"]);
  });

  it("sense res de Wikidata, l'historial és el de la Generalitat", () => {
    expect(fusionaAmbWikidata(GENERALITAT, [], TERM_STARTS)).toEqual(GENERALITAT);
  });
});

describe("findChanges amb els passos de Wikidata", () => {
  const history = fusionaAmbWikidata(GENERALITAT, WIKIDATA, TERM_STARTS);
  const changes = findChanges(history, TERM_STARTS);

  it("els relleus surten sencers, en ordre, i conserven la marca de font i el motiu", () => {
    const c2019 = changes.find((c) => c.term === "2019-2023")!;
    expect(c2019.mayors.map((m) => m.name)).toEqual(["ALEJANDRO PASTOR LOPEZ", "Aïda Llauradó Álvarez", "Xavier García Albiol", "Rubén Guijarro Casas"]);
    expect(c2019.mayors[0]).toMatchObject({ motiuFinal: "dimissió", finsA: "2020-04-29" });
    expect(c2019.mayors[1]).toMatchObject({ font: "wikidata", interina: true });
    expect(c2019.onlySuccessorKnown).toBeUndefined();
    const c2015 = changes.find((c) => c.term === "2015-2019")!;
    expect(c2015.mayors.map((m) => m.name)).toEqual(["MA. DOLORS SABATER PUIG", "Àlex Pastor López"]);
  });

  it("el canvi de color es veu per la família del partit de Wikidata", () => {
    expect(changes.find((c) => c.term === "2019-2023")!.partyChanged).toBe(true);
    expect(changes.find((c) => c.term === "2015-2019")!.partyChanged).toBe(true);
    expect(changes.some((c) => c.term === "2023-2027")).toBe(false);
  });

  it("sense Wikidata, la regla de sempre: qui arriba tard a un mandat d'una sola fila és un relleu", () => {
    const sols = findChanges(
      [{ term: "2023-2027", name: "EDUARD SANZ", partyRaw: "PSC-CP", tookOfficeOn: "2024-10-05" }],
      new Map([["2023-2027", "2023-06-17"]]),
    );
    expect(sols).toHaveLength(1);
    expect(sols[0]).toMatchObject({ onlySuccessorKnown: true, partyChanged: false });
    expect(sols[0]!.daysIntoTerm).toBeGreaterThan(400);
  });
});

describe("les peces", () => {
  it("mateixaPersona: nom sencer normalitzat, o cognoms i inicial", () => {
    expect(mateixaPersona("MA. DOLORS SABATER PUIG", "Maria Dolors Sabater i Puig")).toBe(true);
    expect(mateixaPersona("ALEJANDRO PASTOR LOPEZ", "Àlex Pastor López")).toBe(true);
    expect(mateixaPersona("XAVIER GARCIA ALBIOL", "Rubén Guijarro Casas")).toBe(false);
    expect(mateixaPersona("JOAN PUIG ROCA", "Josep Puig Roca")).toBe(true);
    expect(mateixaPersona("JOAN PUIG ROCA", "Pere Puig Roca")).toBe(false);
    expect(mateixaPersona("", "Pere Puig Roca")).toBe(false);
  });

  it("termDe situa una data al mandat, amb la constitució real quan la té", () => {
    const terms = ["2015-2019", "2019-2023", "2023-2027"];
    expect(termDe("2018-06-20", terms, TERM_STARTS)).toBe("2015-2019");
    expect(termDe("2019-06-15", terms, TERM_STARTS)).toBe("2019-2023");
    expect(termDe("2019-06-14", terms, TERM_STARTS)).toBe("2015-2019");
    expect(termDe("2019-06-14", terms)).toBe("2019-2023");
    expect(termDe("2011-06-11", terms, TERM_STARTS)).toBeNull();
  });

  it("partitTruncat: curt i desconegut sí; sigles conegudes o nom llarg no", () => {
    expect(partitTruncat("BADALONA EN COM")).toBe(true);
    expect(partitTruncat("SANT CUGAT EN CO")).toBe(false);
    expect(partitTruncat("PSC-CP")).toBe(false);
    expect(partitTruncat("ERC-AM")).toBe(false);
    expect(partitTruncat(null)).toBe(false);
    expect(partitTruncat("")).toBe(false);
  });

  it("motiuFinalEscrit tradueix l'etiqueta de Wikidata a la frase de la pàgina", () => {
    expect(motiuFinalEscrit("dimissió")).toBe("va dimitir");
    expect(motiuFinalEscrit("moció de censura")).toBe("moció de censura");
    expect(motiuFinalEscrit("mort")).toBe("va morir");
    expect(motiuFinalEscrit("inhabilitació")).toBe("inhabilitació");
    expect(motiuFinalEscrit("nomenament a un altre càrrec")).toBe("nomenament a un altre càrrec");
    expect(motiuFinalEscrit(null)).toBeNull();
    expect(motiuFinalEscrit("  ")).toBeNull();
  });
});

describe("datesDeConstitucio", () => {
  it("pren la data més repetida de cada mandat, no la mínima, i la primera si hi ha empat", () => {
    const inicis = datesDeConstitucio([
      { term: "1995-1999", data: "1995-01-01" },
      { term: "1995-1999", data: "1995-06-17" },
      { term: "1995-1999", data: "1995-06-17" },
      { term: "1995-1999", data: null },
      { term: "2011-2015", data: "2011-06-11" },
      { term: "2011-2015", data: "2011-06-10" },
    ]);
    expect(inicis.get("1995-1999")).toBe("1995-06-17");
    expect(inicis.get("2011-2015")).toBe("2011-06-10");
    expect(inicis.has("2015-2019")).toBe(false);
  });
});

describe("l'alcalde sortint en funcions", () => {
  it("no encapçala el mandat següent si plega el dia que el primer oficial pren possessió", () => {
    const generalitat: PasAlcaldia[] = [
      { term: "1979-1983", name: "MARIUS DIAZ BIELSA", partyRaw: "PSUC", tookOfficeOn: "1979-04-19" },
      { term: "1983-1987", name: "JOAN BLANCH RODRIGUEZ", partyRaw: "PSC-PSOE", tookOfficeOn: "1983-05-24" },
    ];
    const wikidata = [wd({ qid: "Q9", nom: "Màrius Díaz i Bielsa", inici: "1979-04-19", fi: "1983-05-24" })];
    const inicis = new Map([["1979-1983", "1979-04-19"], ["1983-1987", "1983-05-23"]]);
    const history = fusionaAmbWikidata(generalitat, wikidata, inicis);
    expect(history.map((h) => `${h.term} ${h.name}`)).toEqual(["1979-1983 MARIUS DIAZ BIELSA", "1983-1987 JOAN BLANCH RODRIGUEZ"]);
    expect(history[0]).toMatchObject({ finsA: "1983-05-24", qid: "Q9" });
  });

  it("però qui arriba a mig mandat no és qui l'obre: el tram de Wikidata que el precedeix es queda", () => {
    const generalitat: PasAlcaldia[] = [
      { term: "2015-2019", name: "MA. DOLORS SABATER PUIG", partyRaw: "BADALONA EN COM", tookOfficeOn: "2015-06-13" },
      { term: "2019-2023", name: "RUBEN GUIJARRO PALMA", partyRaw: "PSC-CP", tookOfficeOn: "2021-11-08" },
    ];
    const wikidata = [wd({ qid: "Q3", nom: "Àlex Pastor López", inici: "2018-06-20", fi: "2020-04-22", motiuFinal: "renúncia" })];
    const inicis = new Map([["2015-2019", "2015-06-13"], ["2019-2023", "2019-06-15"]]);
    const history = fusionaAmbWikidata(generalitat, wikidata, inicis);
    expect(history.map((h) => `${h.term} ${h.name}`)).toEqual([
      "2015-2019 MA. DOLORS SABATER PUIG",
      "2015-2019 Àlex Pastor López",
      "2019-2023 Àlex Pastor López",
      "2019-2023 RUBEN GUIJARRO PALMA",
    ]);
    expect(history[2]).toMatchObject({ tookOfficeOn: "2019-06-15", finsA: "2020-04-22", motiuFinal: "renúncia" });
  });
});

describe("la font oficial mana sobre un tram de Wikidata", () => {
  // Barcelona: Wikidata data Jordi Hereu fins a l'1 de juliol del 2011, i la
  // Generalitat del 2011 ençà no dona cap data de presa de possessió. Sense la
  // regla, a Hereu li sortia un mandat 2011-2015 «segons Wikidata» que acabava
  // quan hi arribava Xavier Trias, que va ser qui el va obrir.
  const generalitat: PasAlcaldia[] = [
    { term: "2003-2007", name: "JORDI HEREU BOHER", partyRaw: "(PSC-PSOE)-PM", tookOfficeOn: "2006-09-08" },
    { term: "2007-2011", name: "JORDI HEREU BOHER", partyRaw: "PSC-PSOE", tookOfficeOn: "2007-06-16" },
    { term: "2011-2015", name: "XAVIER TRIAS VIDAL DE LLOBATERA", partyRaw: "CiU", tookOfficeOn: null },
  ];
  const inicis = new Map([["2003-2007", "2003-06-14"], ["2007-2011", "2007-06-16"], ["2011-2015", "2011-06-11"]]);
  const hereu = wd({ qid: "Q953762", nom: "Jordi Hereu i Boher", inici: "2006-08-08", fi: "2011-07-01" });
  const ministeri: AlcaldiaMinisteri[] = [
    { mandat: "2011-2015", nom: "XAVIER TRIAS VIDAL DE LLOBATERA", llista: "CIU", possessio: "2011-07-01", baixa: null },
  ];

  it("no crea cap mandat on una font oficial diu que hi havia una altra persona", () => {
    const history = fusionaAmbWikidata(generalitat, [hereu], inicis, ministeri);
    expect(history.filter((h) => mateixaPersona(h.name, "Jordi Hereu Boher")).map((h) => h.term)).toEqual(["2003-2007", "2007-2011"]);
    expect(history.some((h) => h.font === "wikidata")).toBe(false);
  });

  it("tampoc quan la Generalitat no té data i Wikidata sí que té qui va obrir el mandat", () => {
    const trias = wd({ qid: "Q973064", nom: "Xavier Trias i Vidal de Llobatera", inici: "2011-07-01", fi: "2015-06-13" });
    const history = fusionaAmbWikidata(generalitat, [hereu, trias], inicis);
    expect(history.filter((h) => h.term === "2011-2015").map((h) => h.name)).toEqual(["XAVIER TRIAS VIDAL DE LLOBATERA"]);
  });

  it("un pas nou que diu haver obert el mandat quan l'oficial en diu un altre no s'afegeix; un relleu a mig mandat, sí", () => {
    const wikidata = [
      wd({ qid: "Q1", nom: "Pere Inventat Roca", inici: "2011-06-11", fi: "2012-01-01" }),
      wd({ qid: "Q2", nom: "Anna Rellevant Puig", inici: "2013-03-01", fi: "2015-06-13" }),
    ];
    const history = fusionaAmbWikidata(generalitat, wikidata, inicis, ministeri);
    expect(history.filter((h) => h.term === "2011-2015").map((h) => h.name)).toEqual(["XAVIER TRIAS VIDAL DE LLOBATERA", "Anna Rellevant Puig"]);
  });
});

describe("la mateixa persona escrita de dues maneres", () => {
  it("la «i» i la «y» dels cognoms, els accents i el sobrenom entre parèntesis no compten", () => {
    expect(mateixaPersona("Jordi Hereu Boher", "Jordi Hereu i Boher")).toBe(true);
    expect(mateixaPersona("Alejandro Pastor López (Àlex)", "Àlex Pastor López")).toBe(true);
    expect(mateixaPersona("Juan García y Pérez", "JUAN GARCIA PEREZ")).toBe(true);
    expect(mateixaPersona("Joan Piqué Vilà", "JOAN PIQUE VILA")).toBe(true);
  });

  it("una errada d'una lletra, o dues lletres girades, al nom o als cognoms", () => {
    expect(mateixaPersona("Gudald Picas Mitjavila", "Eudald Picas Mitjavila")).toBe(true);
    expect(mateixaPersona("Eudald Picas Mijtavila", "Eudald Picas Mitjavila")).toBe(true);
    expect(mateixaPersona("Lluís Dalmau Almacellas", "Lluís Dalmau Almacelles")).toBe(true);
    expect(mateixaPersona("Víctor Falguera Pascual", "Víctor Falguera Pasqual")).toBe(true);
    expect(mateixaPersona("Antoni Siurana Zaragoza", "Antoni Siurana i Saragossa")).toBe(true);
    expect(mateixaPersona("Ngel Vidal Povill", "Àngel Vidal Povill")).toBe(true);
    expect(mateixaPersona("Enrique Pujol - Casanovas.", "Enrique Pujol Casanovas")).toBe(true);
  });

  it("un cognom de menys", () => {
    expect(mateixaPersona("Vanessa Olivart", "Vanesa Olivart Rosicart")).toBe(true);
    expect(mateixaPersona("Jordi Cabezas", "Jordi Cabezas Llobet")).toBe(true);
    expect(mateixaPersona("Toni Bosch Carabante", "Antoni Bosch i Carabante")).toBe(true);
  });

  it("però no persones diferents amb el mateix cognom", () => {
    expect(mateixaPersona("Josep March Minguell", "Josep March Silart")).toBe(false);
    expect(mateixaPersona("Manuel Sales Sales", "Manel Sales Martori")).toBe(false);
    expect(mateixaPersona("Maria Sarret Pijuan", "Manuel Sarret Pons")).toBe(false);
    expect(mateixaPersona("Jose Masdeu Vives", "Josep Masdeu Isern")).toBe(false);
    expect(mateixaPersona("Pere Arderiu Arraut", "Pere Arderiu Ros")).toBe(false);
    expect(mateixaPersona("Meritxell Capdevila Morera", "Magí Capdevila Huguet")).toBe(false);
    expect(mateixaPersona("Maria Puig", "Marta Puig")).toBe(false);
  });

  it("distanciaNoms compta una transposició com una sola errada", () => {
    expect(distanciaNoms("mitjavila", "mijtavila")).toBe(1);
    expect(distanciaNoms("almacellas", "almacelles")).toBe(1);
    expect(distanciaNoms("abc", "abc")).toBe(0);
  });
});

describe("les reparacions d'escriptura", () => {
  it("la «Ð» era una «Ñ», i un parèntesi solt no hi és", () => {
    expect(reparaNomAlcaldia("JOAN CASAS MONTAÐA")).toBe("JOAN CASAS MONTAÑA");
    expect(reparaNomAlcaldia("Jordi Delgado Peða")).toBe("Jordi Delgado Peña");
    expect(reparaNomAlcaldia("Eduard Montseny i Masip Pons)")).toBe("Eduard Montseny i Masip Pons");
    expect(reparaNomAlcaldia("Alejandro Pastor López (Àlex)")).toBe("Alejandro Pastor López (Àlex)");
    expect(mateixaPersona("JOAN CASAS MONTAÐA", "Joan Casas Montaña")).toBe(true);
  });

  it("«N/A» no és cap partit, i el parèntesi de dins no es dobla", () => {
    expect(partitAmbSentit("N/A")).toBeNull();
    expect(partitAmbSentit(" n/a ")).toBeNull();
    expect(partitAmbSentit("")).toBeNull();
    expect(partitAmbSentit("PSC-CP")).toBe("PSC-CP");
    expect(partitSenseParentesis("(PSC-PSOE)-PM")).toBe("PSC-PSOE-PM");
    expect(partitSenseParentesis("CiU")).toBe("CiU");
  });
});
