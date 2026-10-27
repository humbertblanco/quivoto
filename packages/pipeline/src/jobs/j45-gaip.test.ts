import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CAMPS_GAIP,
  FONTS_GAIP,
  clauMunicipiGaip,
  contextCatalunya,
  gaipDeMunicipi,
  indexMunicipis,
  mediana,
  municipisDelNom,
  reclamantDe,
  repartGaip,
  repartIncompliments,
  sentitDe,
  type FilaGaip,
  type FilaIncompliment,
} from "./j45-gaip";

/**
 * Les files són reals, de la consulta del 27 d'octubre del 2026, amb només
 * els camps que demana la feina (cap text lliure): totes les d'Espot (7
 * files, 5 reclamacions: dues surten també en castellà), els Alamús (18
 * files, 17 reclamacions), Seròs (11), la Paeria de Cervera (7), una
 * reclamació contra Arbeca i la Floresta alhora, dues contra «ESPIMSA i
 * Ajuntament de Tarragona» i una contra l'IMHAB, que no lliga. Els
 * incompliments: 16 de Tarragona (amb ESPIMSA), 3 de la Llagosta i un
 * consorci.
 */
const FIXTURES = join(__dirname, "..", "adapters", "__fixtures__");
const llegeix = <T>(nom: string): T => JSON.parse(readFileSync(join(FIXTURES, nom), "utf8")) as T;
const files = llegeix<FilaGaip[]>("gaip-resolucions.json");
const incompliments = llegeix<FilaIncompliment[]>("gaip-incompliments.json");

/** Una mostra dels 947, amb els noms tal com els desa J1. */
const MUNICIPIS = [
  "Espot", "els Alamús", "Seròs", "Cervera", "Arbeca", "la Floresta", "Tarragona", "la Llagosta", "Barcelona",
  "l'Hospitalet de Llobregat", "Calonge i Sant Antoni", "Calonge de Segarra", "Castell d'Aro, Platja d'Aro i s'Agaró",
  "Sant Feliu de Llobregat", "Sant Feliu de Guíxols", "Palau-solità i Plegamans", "el Prat de Llobregat", "la Ràpita",
  "Es Bòrdes", "Sant Pere de Ribes", "l'Ametlla del Vallès", "Granollers", "Igualada", "Vilanova i la Geltrú",
  "Vilanova del Vallès", "Lleida",
].map((name, i) => ({ id: i + 1, name }));
const index = indexMunicipis(MUNICIPIS);
const id = (nom: string): number => MUNICIPIS.find((m) => m.name === nom)!.id;
const noms = (nom: string): string[] => municipisDelNom(nom, index).map((i) => MUNICIPIS[i - 1]!.name);

describe("quin ajuntament és", () => {
  it("la clau treu accents, apòstrofs, guionets i l'article", () => {
    expect(clauMunicipiGaip("L'HOSPITALET DE LLOBREGAT.")).toBe("hospitalet de llobregat");
    expect(clauMunicipiGaip("Palau-solità i Plegamans")).toBe("palau solita i plegamans");
    expect(clauMunicipiGaip("els Alamús")).toBe("alamus");
  });

  it("lliga les formes netes i les contraccions", () => {
    expect(noms("Ajuntament d'Espot")).toEqual(["Espot"]);
    expect(noms("Ajuntament dels Alamús")).toEqual(["els Alamús"]);
    expect(noms("Ajuntament del Prat de Llobregat")).toEqual(["el Prat de Llobregat"]);
    expect(noms("Ajuntament d'Es Bòrdes")).toEqual(["Es Bòrdes"]);
    expect(noms("Ajuntament La Llagosta")).toEqual(["la Llagosta"]);
    expect(noms("Ajuntament l' Ametlla del Vallès")).toEqual(["l'Ametlla del Vallès"]);
  });

  it("aguanta les faltes de la font, el castellà i la Paeria", () => {
    expect(noms("Ajumtament de Llançà")).toEqual([]); // Llançà no és a la mostra
    expect(noms("Ajunatment de Lleida")).toEqual(["Lleida"]);
    expect(noms("Ajuntamentde Sant Pere de Ribes")).toEqual(["Sant Pere de Ribes"]);
    expect(noms("Ayuntamiento de Tarragona")).toEqual(["Tarragona"]);
    expect(noms("Paeria de Cervera")).toEqual(["Cervera"]);
    expect(noms("Ajuntament Palau solità i Plegamans")).toEqual(["Palau-solità i Plegamans"]);
    expect(noms("Ajuntament  d'Espot")).toEqual(["Espot"]);
  });

  it("troba l'ajuntament dins d'un nom compost, i en pot trobar dos", () => {
    expect(noms("ESPIMSA i Ajuntament de Tarragona")).toEqual(["Tarragona"]);
    expect(noms("Espimsa y Ayuntamiento de Tarragona")).toEqual(["Tarragona"]);
    expect(noms("CEE Montserrat Montero (Ajuntament de Granollers)")).toEqual(["Granollers"]);
    expect(noms("Policia Local de l'Ajuntament d'Igualada")).toEqual(["Igualada"]);
    expect(noms("Ajuntamenet d'Arbeca i Ajuntament de la Floresta")).toEqual(["Arbeca", "la Floresta"]);
    expect(noms("Ajuntament de Tarragona i ESPIMSA")).toEqual(["Tarragona"]);
  });

  it("agafa el nom més llarg: Sant Feliu de Llobregat no és Sant Feliu de Guíxols", () => {
    expect(noms("Ajuntament de Sant Feliu de Llobregat")).toEqual(["Sant Feliu de Llobregat"]);
    expect(noms("Ajuntament de Sant Feliu de Guíxols")).toEqual(["Sant Feliu de Guíxols"]);
  });

  it("els noms vells i curts van pels àlies, i Calonge de Segarra no s'hi confon", () => {
    expect(noms("Ajuntament de Calonge")).toEqual(["Calonge i Sant Antoni"]);
    expect(noms("Ajuntament de Calonge de Segarra")).toEqual(["Calonge de Segarra"]);
    expect(noms("AJUNTAMENT DE PLATJA D'ARO")).toEqual(["Castell d'Aro, Platja d'Aro i s'Agaró"]);
    expect(noms("Ajuntament Castell-Platja Aro")).toEqual(["Castell d'Aro, Platja d'Aro i s'Agaró"]);
    expect(noms("Ajuntament de Sant Carles de la Ràpita")).toEqual(["la Ràpita"]);
  });

  it("no endevina els ambigus ni les entitats sense «Ajuntament»", () => {
    expect(noms("Ajuntament de Vilanova")).toEqual([]);
    expect(noms("IMHAB")).toEqual([]);
    expect(noms("Institut Barcelona Esports")).toEqual([]);
    expect(noms("Entitat Municipal Descentralitzada de Valldoreix")).toEqual([]);
  });
});

describe("la lectura de les files", () => {
  it("no demana cap text lliure ni cap nom de persona", () => {
    for (const camp of ["resum", "informaci_reclamada", "ponent", "sexe", "paraules_clau"]) {
      expect(CAMPS_GAIP).not.toContain(camp);
    }
    const camps = new Set(files.flatMap((f) => Object.keys(f)));
    for (const camp of camps) expect(CAMPS_GAIP as readonly string[]).toContain(camp);
  });

  it("redueix el sentit i el reclamant", () => {
    expect(sentitDe("Estimació")).toBe("estimacio");
    expect(sentitDe("Estimació parcial")).toBe("estimacioParcial");
    expect(sentitDe("Desestimació parcial")).toBe("estimacioParcial");
    expect(sentitDe("Pèrdua d'objecte")).toBe("perduaObjecte");
    expect(sentitDe("Acord de mediació")).toBe("mediacio");
    expect(sentitDe("Derivació")).toBe("altres");
    expect(reclamantDe("Electes")).toBe("electe");
    expect(reclamantDe("Sindicats i representants dels treballadors")).toBe("sindicat");
    expect(reclamantDe("Gremis i col·legis professionals")).toBe("altres");
  });

  it("la mediana", () => {
    expect(mediana([36, 86, 105, 175, 175])).toBe(105);
    expect(mediana([10, 20])).toBe(15);
    expect(mediana([])).toBeNull();
  });
});

describe("el repartiment", () => {
  const { perMunicipi, senseLligar } = repartGaip(files, index);

  it("compta un cop les reclamacions que surten en català i en castellà, amb el PDF català", () => {
    const espot = perMunicipi.get(id("Espot"))!;
    expect(espot).toHaveLength(5);
    const r = espot.find((x) => x.reclamacio === "0722/2023")!;
    expect(r.url).toMatch(/_CAT\.pdf$/);
    expect(perMunicipi.get(id("els Alamús"))).toHaveLength(17);
  });

  it("una reclamació contra dos ajuntaments compta a tots dos", () => {
    expect(perMunicipi.get(id("Arbeca"))).toHaveLength(1);
    expect(perMunicipi.get(id("la Floresta"))).toHaveLength(1);
  });

  it("aparta els noms que no lliguen", () => {
    expect([...senseLligar]).toEqual([["IMHAB", 1]]);
  });

  it("els incompliments, un per reclamació, del més nou al més vell", () => {
    const inc = repartIncompliments(incompliments, index);
    expect(inc.perMunicipi.get(id("Tarragona"))).toHaveLength(16);
    expect(inc.perMunicipi.get(id("Tarragona"))![0]!.dataResolucio).toBe("2020-07-09");
    expect(inc.perMunicipi.get(id("la Llagosta"))!.map((x) => x.reclamacio).sort()).toEqual(["0221/2016", "0263/2016", "0264/2016"]);
    expect([...inc.senseLligar.keys()]).toEqual(["Consorci de l'Auditori i l'Orquestra"]);
  });
});

describe("la mètrica", () => {
  const { perMunicipi } = repartGaip(files, index);
  const inc = repartIncompliments(incompliments, index);
  const ctx = {
    catalunya: contextCatalunya(perMunicipi),
    darreraReclamacioFont: "2026-07-18",
    fonts: {
      resolucions: { ...FONTS_GAIP.resolucions, actualitzat: "2026-10-01" },
      incompliments: { ...FONTS_GAIP.incompliments, actualitzat: "2026-10-01" },
    },
    consultat: "2026-10-27",
    primerAny: 2015,
    darrerAny: 2026,
  };

  it("resumeix el mandat per sentit, reclamant i dies", () => {
    const m = gaipDeMunicipi(perMunicipi.get(id("Espot"))!, [], ctx);
    expect(m.mandat.reclamacions).toBe(5);
    expect(m.mandat.sentit.estimacio).toBe(1);
    expect(m.mandat.sentit.estimacioParcial).toBe(2);
    expect(m.mandat.sentit.perduaObjecte).toBe(2);
    expect(m.mandat.reclamant).toMatchObject({ particular: 3, electe: 1, entitat: 1 });
    expect(m.mandat.medianaDies).toBe(105);
    expect(m.anterior.reclamacions).toBe(0);
    expect(m.recents[0]).toMatchObject({ reclamacio: "0399/2026", dataReclamacio: "2026-02-26", sentit: "estimacio" });
    expect(m.perAny).toHaveLength(12);
  });

  it("separa el mandat actual de l'anterior", () => {
    const m = gaipDeMunicipi(perMunicipi.get(id("els Alamús"))!, [], ctx);
    expect(m.mandat.reclamacions).toBe(5);
    expect(m.anterior.reclamacions).toBe(4);
    expect(m.total.reclamacions).toBe(17);
    expect(m.recents).toHaveLength(10);
  });

  it("un municipi sense reclamacions té zeros i cap recent; els incompliments hi van", () => {
    const m = gaipDeMunicipi([], inc.perMunicipi.get(id("la Llagosta"))!, ctx);
    expect(m.mandat.reclamacions).toBe(0);
    expect(m.mandat.medianaDies).toBeNull();
    expect(m.recents).toEqual([]);
    expect(m.incompliments).toHaveLength(3);
    expect(m.total.desDe).toBeNull();
  });

  it("la referència de Catalunya suma les del mandat", () => {
    expect(ctx.catalunya.reclamacions).toBeGreaterThan(0);
    expect(ctx.catalunya.ajuntaments).toBeGreaterThanOrEqual(3);
  });
});
