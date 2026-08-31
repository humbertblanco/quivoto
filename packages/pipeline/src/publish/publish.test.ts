import { describe, expect, it } from "vitest";
import {
  candidatura2023De, llistesDe, mandatsDe, nomAssistent, semblaUnNom, souDelAjuntamentDe,
  souDelConsellDe, votsPerGrupDe, type Candidatura2023, type HistorialMunicipi, type LlistaAnada,
} from "./publish";
import type { Grup } from "./posicions";
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
    candidatures: new Map(),
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

// ─────────────────────────────────────────────────────────────────────────────
// Les llistes on ha anat cadascú, els vots lligats al grup del ple i el sou
// que publica el consell comarcal (J30).
// ─────────────────────────────────────────────────────────────────────────────

describe("llistesDe", () => {
  const anada = (any: number, extra: Partial<LlistaAnada> = {}): LlistaAnada => ({
    any, sigles: "ERC-AM", posicio: 4, capDeLlista: false, elegit: any === 2023, ...extra,
  });
  const historial = (canvis: Partial<HistorialMunicipi> = {}): HistorialMunicipi => ({
    eleccions: [2015, 2019, 2023],
    mandats: new Map(),
    llistes: new Map(),
    candidatures: new Map([
      ["maria roig", [anada(2023, { posicio: 2 }), anada(2015, { posicio: 8 })]],
      ["nom repetit", [anada(2023), anada(2023)]],
    ]),
    ...canvis,
  });

  it("ordena per any i torna el detall de cada anada", () => {
    const anades = llistesDe(historial(), "MARIA ROIG");
    expect(anades?.map((a) => a.any)).toEqual([2015, 2023]);
    expect(anades?.[0]).toMatchObject({ posicio: 8, elegit: false });
    expect(anades?.[1]).toMatchObject({ posicio: 2, elegit: true });
  });

  it("amb una sola municipal coberta calla, i de qui no hi és no diu res", () => {
    // Amb una sola elecció ingerida, «les llistes on ha anat: 2023» faria
    // semblar que abans no s'hi presentava, quan senzillament no ho tenim.
    expect(llistesDe(historial({ eleccions: [2023] }), "Maria Roig")).toBe(null);
    expect(llistesDe(undefined, "Maria Roig")).toBe(null);
    expect(llistesDe(historial(), "Ningú")).toBe(null);
  });

  it("dues anades el mateix any són dues persones amb el mateix nom: no es diu res", () => {
    expect(llistesDe(historial(), "Nom Repetit")).toBe(null);
  });
});

/**
 * El cas d'Esplugues, fet fixture: la seu electrònica escriu «Partit dels
 * Socialistes de Catalunya - Candidatura de Progrés (PSC-CP)» i les actes
 * escriuen «PSC» o «Esplugues en Comú Podem». Si el lligam falla, la pàgina
 * de cada regidor diu que no sap res dels vots quan el ple sencer hi és.
 */
describe("votsPerGrupDe", () => {
  const GRUPS: Grup[] = [
    { nom: "Partit dels Socialistes de Catalunya - Candidatura de Progrés (PSC-CP)", sigles: "PSC-CP", escons: 11, govern: true, color: "#e73b39" },
    { nom: "Esplugues en Comú Podem - Confluència (ECP-C)", sigles: "ECP-C", escons: 2, govern: true, color: null },
    { nom: "Grup Municipal Popular (PP)", sigles: "PP", escons: 3, govern: false, color: null },
    { nom: "VOX", sigles: null, escons: 2, govern: false, color: null },
  ];
  const PUNT = {
    data: "2023-10-18",
    titol: "Modificació de l'ordenança fiscal núm. 4 de l'IBI",
    url: "https://example.org/acta.pdf",
    vots: [
      { grup: "PSC", sentit: "favor", vots: 11 },
      { grup: "Esplugues en Comú Podem", sentit: "favor", vots: 2 },
      { grup: "PP", sentit: "contra", vots: 3 },
      { grup: "Vox", sentit: "contra", vots: 2 },
    ],
  };

  it("lliga el nom que escriu l'acta amb el grup del ple, i compta el punt com a lligat", () => {
    const { votsPerGrup, puntsAmbDesglos } = votsPerGrupDe([PUNT], GRUPS);
    expect(puntsAmbDesglos).toBe(1);
    expect(votsPerGrup.get(GRUPS[0]!.nom)?.[0]).toMatchObject({ sentit: "favor", tot: true, marge: 8 });
    expect(votsPerGrup.get(GRUPS[1]!.nom)?.[0]).toMatchObject({ sentit: "favor", tot: true });
    expect(votsPerGrup.get(GRUPS[2]!.nom)?.[0]).toMatchObject({ sentit: "contra", tot: true });
    expect(votsPerGrup.get(GRUPS[3]!.nom)?.[0]).toMatchObject({ sentit: "contra" });
  });

  it("un nom que no és cap grup —«LIDL SUPERMERCADOS»— no reparteix res", () => {
    // El cas real que va destapar-ho: «una indemnització a favor de LIDL
    // SUPERMERCADOS, SAU, EN RELACIÓ AMB...» llegit com si fossin dos grups
    // votant a favor. Davant d'un nom que no lliga, no es diu res.
    const { votsPerGrup, puntsAmbDesglos } = votsPerGrupDe(
      [{ ...PUNT, vots: [
        { grup: "LIDL SUPERMERCADOS", sentit: "favor", vots: null },
        { grup: "EN RELACIÓ", sentit: "favor", vots: null },
      ]}],
      GRUPS,
    );
    expect(puntsAmbDesglos).toBe(0);
    expect(votsPerGrup.size).toBe(0);
  });

  it("menys vots que escons vol dir que el vot no és de tothom: tot=false", () => {
    const { votsPerGrup } = votsPerGrupDe(
      [{ ...PUNT, vots: [{ grup: "PSC", sentit: "favor", vots: 10 }] }],
      GRUPS,
    );
    expect(votsPerGrup.get(GRUPS[0]!.nom)?.[0]?.tot).toBe(false);
  });

  it("ordena per marge i, a igual marge, per data recent; sense recompte, al final", () => {
    const { votsPerGrup } = votsPerGrupDe(
      [
        { ...PUNT, data: "2024-01-01", titol: "Sense recompte", vots: [{ grup: "PP", sentit: "favor", vots: null }] },
        { ...PUNT, data: "2025-01-01", titol: "Renyida", vots: [
          { grup: "PP", sentit: "contra", vots: 3 },
          { grup: "PSC", sentit: "favor", vots: 4 },
        ]},
      ],
      GRUPS,
    );
    expect(votsPerGrup.get(GRUPS[2]!.nom)?.map((v) => v.titol)).toEqual(["Renyida", "Sense recompte"]);
  });
});

describe("souDelConsellDe (J30)", () => {
  /*
   * El cas que ho va demanar: una regidora de Vallirana amb càrrec al Consell
   * Comarcal del Baix Llobregat que la seva pàgina no deia. Les xifres del
   * fixture són inventades; la forma és la de la mètrica `sousConsells`.
   */
  const METRICA = {
    persones: [
      {
        nom: "Eva María Martínez Morales",
        carrecMunicipal: "Regidora",
        alcaldia: false,
        nomAlConsell: null,
        consell: {
          ens: "Consell Comarcal del Baix Llobregat",
          tipus: "consell comarcal",
          carrec: "Presidenta",
          dedicacio: "dedicació exclusiva",
          retribucioAnualBruta: 47_150,
          maximPerAssistencies: null,
          motiu: null,
          font: {
            nom: "Consell Comarcal del Baix Llobregat, seu electrònica",
            url: "https://www.elbaixllobregat.cat/transparencia",
            format: "html",
            llicencia: "",
            consultat: "2026-08-31",
          },
          metode: "nom",
        },
      },
    ],
    alcaldia: null,
    advertiment: "Cada import és el que publica el consell comarcal que el paga, i només ell.",
  };

  it("dona el càrrec amb l'import de qui el paga i l'advertiment de la font", () => {
    const resultat = souDelConsellDe(METRICA, "EVA MARIA MARTINEZ MORALES");
    expect(resultat?.carrec).toMatchObject({
      ens: "Consell Comarcal del Baix Llobregat",
      carrec: "Presidenta",
      anualBrut: 47_150,
      concepte: "retribució anual bruta",
    });
    expect(resultat?.carrec.font?.url).toContain("elbaixllobregat");
    expect(resultat?.advertiment).toContain("que el paga");
  });

  it("quan el consell escriu el nom d'una altra manera, la nota ho diu", () => {
    const ambNom = {
      ...METRICA,
      persones: [{ ...METRICA.persones[0]!, nomAlConsell: "Eva M. Martínez Morales" }],
    };
    const resultat = souDelConsellDe(ambNom, "Eva María Martínez Morales");
    expect(resultat?.nota).toContain("hi consta com a «Eva M. Martínez Morales»");
    // Amb el mateix nom no cal cap nota: no hi ha res a reconciliar.
    expect(souDelConsellDe(METRICA, "Eva María Martínez Morales")?.nota).toBe(null);
  });

  it("el màxim per assistències viatja com a sostre i mai com a import", () => {
    const sense = {
      ...METRICA,
      persones: [{
        ...METRICA.persones[0]!,
        consell: {
          ...METRICA.persones[0]!.consell,
          retribucioAnualBruta: null,
          maximPerAssistencies: 9_000,
          motiu: "el consell no li paga cap retribució fixa",
        },
      }],
    };
    const resultat = souDelConsellDe(sense, "Eva María Martínez Morales");
    expect(resultat?.carrec.anualBrut).toBe(null);
    expect(resultat?.carrec.sostreAssistencies).toBe(9_000);
    expect(resultat?.carrec.motiuSenseImport).toContain("retribució fixa");
  });

  it("no diu res de qui no hi és, de noms repetits ni del que no té la forma de J30", () => {
    expect(souDelConsellDe(METRICA, "Una Altra Persona")).toBe(null);
    const repetida = { ...METRICA, persones: [...METRICA.persones, METRICA.persones[0]!] };
    expect(souDelConsellDe(repetida, "Eva María Martínez Morales")).toBe(null);
    expect(souDelConsellDe(null, "Eva María Martínez Morales")).toBe(null);
    expect(souDelConsellDe({ persones: "no" }, "Eva María Martínez Morales")).toBe(null);
  });
});
