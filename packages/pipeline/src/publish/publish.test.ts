import { describe, expect, it } from "vitest";
import {
  candidatura2023De, mandatsDe, nomAssistent, semblaUnNom, souDelAjuntamentDe,
  type Candidatura2023, type HistorialMunicipi,
} from "./publish";
/**
 * L'assistència als plens era la dada més perillosa de tot el projecte: a les
 * Franqueses del Vallès **els catorze regidors sortien amb «1 de 49 plens»**,
 * l'alcalde inclòs. Publicar això no és una dada fluixa, és una acusació.
 */
describe("qui consta a la llista d'assistents", () => {
  it("treu el càrrec que l'acta enganxa al nom", () => {
    expect(nomAssistent("Juan Antonio Corchado Ponce, alcalde")).toBe("Juan Antonio Corchado Ponce");
    expect(nomAssistent("Dolors Amaro Fitó, tinenta d’alcalde (SPLF)")).toBe("Dolors Amaro Fitó");
    expect(nomAssistent("Eva Navarrete Bachs")).toBe("Eva Navarrete Bachs");
  });

  it("no compta com a persona el que no ho és", () => {
    // Tot això sortia de debò de la lectura de les actes, comptant plens.
    expect(semblaUnNom("Nom i Cognoms")).toBe(false);
    expect(semblaUnNom("ACORD ÚNIC.- DICTAMEN QUE PROPOSA")).toBe(false);
    expect(semblaUnNom("El documento ha sido firmado por :")).toBe(false);
    expect(semblaUnNom("Secretari")).toBe(false);
  });

  it("i sí que compta les persones de debò, amb càrrec i tot", () => {
    expect(semblaUnNom("Juan Antonio Corchado Ponce, alcalde")).toBe(true);
    expect(semblaUnNom("Maria del Mar Gallego Garrido, regidora")).toBe(true);
    expect(semblaUnNom("Arià Pérez Isidro")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// El context nou de la fitxa de persona: la candidatura del 2023, el sou que
// publica l'ajuntament amb nom i cognoms, i els mandats.
// ─────────────────────────────────────────────────────────────────────────────

const LLISTES: Candidatura2023[] = [
  {
    sigles: "ERC-AM",
    vots: 9_000,
    regidories: 5,
    persones: [
      { nom: "Ernest Maragall i Mira", clau: "ernest maragall mira", posicio: 1, capDeLlista: true },
      { nom: "Elisenda Alamany Gutierrez", clau: "elisenda alamany gutierrez", posicio: 2, capDeLlista: false },
    ],
  },
  {
    sigles: "PSC-CP",
    vots: 12_000,
    regidories: 10,
    persones: [{ nom: "Jaume Collboni Cuadrado", clau: "jaume collboni cuadrado", posicio: 1, capDeLlista: true }],
  },
];

describe("candidatura2023De", () => {
  const alcaldia = { nom: "Jaume Collboni Cuadrado", sigles: "PSC - CP" };

  it("troba la persona pel nom normalitzat i en surt la llista, el número i la força", () => {
    const c = candidatura2023De(LLISTES, "ELISENDA ALAMANY GUTIERREZ", alcaldia);
    expect(c).toEqual({
      es: false, posicio: 2, sigles: "ERC-AM", vots: 9_000, regidories: 5,
      forca: 2, forces: 2, vaGuanyar: false, teAlcaldia: false,
    });
  });

  it("el cap de llista de la més votada surt com a guanyador i amb l'alcaldia", () => {
    const c = candidatura2023De(LLISTES, "Jaume Collboni Cuadrado", alcaldia);
    expect(c?.es).toBe(true);
    expect(c?.forca).toBe(1);
    expect(c?.vaGuanyar).toBe(true);
    expect(c?.teAlcaldia).toBe(true);
  });

  it("l'alcaldia es resol per les sigles quan l'alcalde no és a cap llista, i queda en no-sabem si tampoc", () => {
    const perSigles = candidatura2023De(LLISTES, "Ernest Maragall i Mira", {
      nom: "Algú Que No Consta", sigles: "PSC-CP",
    });
    expect(perSigles?.teAlcaldia).toBe(false);
    const sense = candidatura2023De(LLISTES, "Ernest Maragall i Mira", { nom: null, sigles: null });
    expect(sense?.teAlcaldia).toBe(null);
  });

  it("un nom que lliga amb dues llistes no lliga amb cap, i sense llistes no hi ha res", () => {
    const dues: Candidatura2023[] = [
      ...LLISTES,
      { sigles: "CUP", vots: 100, regidories: 0, persones: [
        { nom: "Elisenda Alamany Gutierrez", clau: "elisenda alamany gutierrez", posicio: 3, capDeLlista: false },
      ]},
    ];
    expect(candidatura2023De(dues, "Elisenda Alamany Gutierrez", { nom: null, sigles: null })).toBe(null);
    expect(candidatura2023De(undefined, "Elisenda Alamany Gutierrez", { nom: null, sigles: null })).toBe(null);
  });
});

describe("souDelAjuntamentDe", () => {
  const AJUNTAMENT = {
    consultat: "2026-08-30",
    electes: [
      {
        nom: "Elisenda Alamany Gutierrez", euros: 96_304.04, importAmbigu: false, observacio: null,
        grauOcupacio: "100.00", plenaDedicacio: false,
        declaracioBens: "https://seuelectronica.ajuntament.barcelona.cat/bens", alPle: true,
      },
      {
        nom: "Jordi Zero Publicat", euros: 0, importAmbigu: false,
        observacio: "Percep les retribucions com a diputat al Parlament de Catalunya.",
        grauOcupacio: null, plenaDedicacio: false, declaracioBens: null, alPle: true,
      },
    ],
    font: {
      nom: "Càrrecs electes, comissionats i gerents del govern municipal",
      organisme: "Ajuntament de Barcelona",
      portal: "https://opendata-ajuntament.barcelona.cat/data/ca/dataset/carrecs-electes-comissionats-i-gerents",
      llicencia: "CC BY 4.0",
      consultat: "2026-08-30",
    },
  };

  it("dona l'import de qui el paga, sencer i amb la font, la llicència i la data", () => {
    const sou = souDelAjuntamentDe(AJUNTAMENT, "ELISENDA ALAMANY GUTIERREZ");
    expect(sou?.anualBrut).toBe(96_304.04);
    expect(sou?.abast).toBe("tot");
    expect(sou?.paga).toBe("Ajuntament de Barcelona");
    expect(sou?.font.llicencia).toBe("CC BY 4.0");
    expect(sou?.font.consultat).toBe("2026-08-30");
    // «100.00» és un grau d'ocupació, i es diu com un percentatge i no com un codi.
    expect(sou?.dedicacio).toBe("dedicació del 100 %");
    expect(sou?.declaracioBens).toContain("seuelectronica");
    // El fitxer no porta l'exercici: sense any no hi haurà comparació.
    expect(sou?.any).toBe(null);
  });

  it("un zero és una dada de la font i viatja amb la seva explicació", () => {
    const sou = souDelAjuntamentDe(AJUNTAMENT, "Jordi Zero Publicat");
    expect(sou?.anualBrut).toBe(0);
    expect(sou?.avis).toContain("Percep les retribucions");
  });

  it("no diu res de qui no hi és, de noms repetits ni del que no té la forma de J22", () => {
    expect(souDelAjuntamentDe(AJUNTAMENT, "Pere Coll")).toBe(null);
    const repetit = {
      ...AJUNTAMENT,
      electes: [...AJUNTAMENT.electes, AJUNTAMENT.electes[0]!],
    };
    expect(souDelAjuntamentDe(repetit, "Elisenda Alamany Gutierrez")).toBe(null);
    expect(souDelAjuntamentDe(null, "Elisenda Alamany Gutierrez")).toBe(null);
    expect(souDelAjuntamentDe({ electes: "no" }, "Elisenda Alamany Gutierrez")).toBe(null);
  });

  it("un import contradictori no es tria: es diu que la font no diu el mateix", () => {
    const ambigu = {
      ...AJUNTAMENT,
      electes: [{ ...AJUNTAMENT.electes[0]!, importAmbigu: true }],
    };
    const sou = souDelAjuntamentDe(ambigu, "Elisenda Alamany Gutierrez");
    expect(sou?.anualBrut).toBe(null);
    expect(sou?.motiuSenseImport).toContain("no diuen el mateix import");
  });
});

describe("mandatsDe", () => {
  const historial = (canvis: Partial<HistorialMunicipi> = {}): HistorialMunicipi => ({
    eleccions: [2015, 2019, 2023],
    mandats: new Map([
      ["tres seguits", [2015, 2019, 2023]],
      ["dos seguits", [2019, 2023]],
      ["amb forat", [2015, 2023]],
      ["nomes ara", [2023]],
      ["ja no hi es", [2015, 2019]],
    ]),
    llistes: new Map([["nomes ara", [2015, 2019, 2023]]]),
    ...canvis,
  });

  it("compta els mandats i sap si són seguits i des de quan", () => {
    expect(mandatsDe(historial(), "Tres Seguits")).toEqual({
      anys: [2015, 2019, 2023], primer: 2015, quants: 3, seguits: true,
      iniciConegut: false, cobertesDesDe: 2015, llistesSenseEntrar: [],
    });
    expect(mandatsDe(historial(), "Dos Seguits")).toMatchObject({ quants: 2, seguits: true, iniciConegut: true });
    expect(mandatsDe(historial(), "Amb Forat")).toMatchObject({ quants: 2, seguits: false });
  });

  it("de qui és nou diu les llistes on va anar sense entrar", () => {
    expect(mandatsDe(historial(), "Nomes Ara")).toMatchObject({
      quants: 1, iniciConegut: true, llistesSenseEntrar: [2015, 2019],
    });
  });

  it("amb una sola municipal al registre no es diu res: el silenci no és una absència", () => {
    expect(mandatsDe(historial({ eleccions: [2023] }), "Tres Seguits")).toBe(null);
    expect(mandatsDe(undefined, "Tres Seguits")).toBe(null);
  });

  it("si l'últim mandat que consta no és el de l'última municipal, val més callar", () => {
    expect(mandatsDe(historial(), "Ja No Hi Es")).toBe(null);
    expect(mandatsDe(historial(), "Ningú")).toBe(null);
  });
});
