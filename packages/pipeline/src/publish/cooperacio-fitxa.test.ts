import { describe, expect, it } from "vitest";
import { FONTS_DINERS, type DinersGeneralitat, type DinersGeneralitatEnsDesat, type ObraPuosc } from "../jobs/j41-diners-generalitat";
import {
  COOPERACIO_CSS,
  ambPreposicio,
  anysAmbForats,
  celDocument,
  combinaTrameses,
  dataEscrita,
  dinersGeneralitatEns,
  fraseObres,
  indexaDinersGeneralitatEns,
  llegeixDinersGeneralitat,
  renderDinersGeneralitat,
  renderDinersGeneralitatBloc,
  renderDinersGeneralitatEns,
} from "./cooperacio-fitxa";

/*
 * Les fixtures imiten el que desa la J41 amb xifres reals consultades el
 * 27-10-2026 (Abrera al FCL, Santa Margarida i els Monjos al PUOSC, Rabós a
 * l'inventari, Fígols a la relació de pendents), barrejades en un sol municipi
 * de prova. Cap prova toca la xarxa ni la base de dades.
 */

const consultat = "2026-10-27";
const fonts = {
  fcl: { ...FONTS_DINERS.fcl, consultat },
  puosc: { ...FONTS_DINERS.puosc, consultat },
  trameses: { ...FONTS_DINERS.trameses, consultat },
  pendents: { ...FONTS_DINERS.pendents, consultat },
};

const obra = (o: Partial<ObraPuosc>): ObraPuosc => ({
  any: 2022,
  estat: "assignada",
  titol: null,
  tipologia: null,
  linia: null,
  subvencio: null,
  pressupost: null,
  expedient: null,
  ...o,
});

const DADES: DinersGeneralitat = {
  codiEns: "0800180001",
  fcl: [
    { any: 2010, lliure: 206841.04, supramunicipal: 16078.27, extraordinari: null },
    { any: 2013, lliure: 0, supramunicipal: null, extraordinari: 172981.16 },
    { any: 2025, lliure: 300000, supramunicipal: null, extraordinari: 60000 },
  ],
  obres: [
    obra({ any: 2028, estat: "programada", titol: "Nova biblioteca", linia: "inversions", subvencio: 150000, pressupost: 600000 }),
    obra({ any: 2022, titol: "Reurbanització de l'avinguda del Centre <i>", linia: "inversions", subvencio: 11347.16, pressupost: 302259.8 }),
    obra({ any: 2001, tipologia: "Pavimentació/urbanització/conservació vies públiques", subvencio: 10444.67 }),
  ],
  trameses: {
    anys: [
      {
        any: 2023,
        pressupost: {
          economic: { trames: true, data: "2023-05-23", observacio: null },
          administratiu: { trames: true, data: "2023-05-24", observacio: null },
        },
        liquidacio: {
          economic: { trames: true, data: "2024-04-19", observacio: null },
          administratiu: { trames: false, data: null, observacio: null },
        },
        deute: null,
        compteGeneral: { trames: true, data: "2024-10-09", observacio: null },
      },
      {
        any: 2026,
        pressupost: {
          economic: { trames: true, data: "2026-03-23", observacio: "En revisió" },
          administratiu: { trames: true, data: "2026-03-23", observacio: null },
        },
        liquidacio: { economic: { trames: false, data: null, observacio: null }, administratiu: { trames: false, data: null, observacio: null } },
        deute: { trames: false, data: null, observacio: null },
        compteGeneral: { trames: false, data: null, observacio: null },
      },
    ],
    estatInventari: "No compleix",
    actualitzat: "2026-10-27",
  },
  pendents: {
    data: "2026-10-01",
    conceptes: [
      { tipus: "FCL", exercici: 2026, import: 14397.63, retingut: false },
      { tipus: "PUOSC", exercici: 2025, import: 5000, retingut: true },
    ],
  },
  anyConsulta: 2026,
  fonts,
};

describe("peces petites", () => {
  it("escriu les dates com dd/mm/aaaa", () => {
    expect(dataEscrita("2024-10-09")).toBe("9 d'octubre del 2024");
    expect(dataEscrita(null)).toBeNull();
  });
  it("contrau «a el» i «per a el»", () => {
    expect(ambPreposicio("a", { article: "el ", nom: "consell comarcal" })).toBe("al consell comarcal");
    expect(ambPreposicio("per a", { article: "el ", nom: "consell comarcal" })).toBe("per al consell comarcal");
    expect(ambPreposicio("a", { article: "l'", nom: "ajuntament" })).toBe("a l'ajuntament");
  });
  it("omple els forats del FCL amb anys buits, del més recent al més antic", () => {
    const anys = anysAmbForats(DADES.fcl!);
    expect(anys.map((a) => a.any)).toEqual([2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010]);
    expect(anys[1]).toMatchObject({ any: 2024, buit: true, lliure: null });
    expect(anysAmbForats([])).toEqual([]);
  });
});

describe("combinaTrameses i celDocument", () => {
  const si = (data: string) => ({ trames: true, data, observacio: null });
  const no = { trames: false, data: null, observacio: null };
  it("dues trameses fetes donen la data de la darrera", () => {
    expect(combinaTrameses(si("2023-05-23"), si("2023-05-24"))).toEqual({ trames: true, data: "2023-05-24", observacio: null });
  });
  it("cap de les dues és «No tramès»; una de sola, «en part»", () => {
    expect(combinaTrameses(no, no)).toEqual({ trames: false, data: null, observacio: null });
    expect(combinaTrameses(si("2024-04-19"), no)?.enPart).toContain("les dades econòmiques el 19 d'abril del 2024");
  });
  it("si la font en porta una sola, aquella; si cap, null", () => {
    expect(combinaTrameses(null, no)).toEqual(no);
    expect(combinaTrameses(null, null)).toBeNull();
  });
  it("pinta l'estat amb paraules, sense colors", () => {
    expect(celDocument(si("2024-10-09"))).toContain("Tramès el 9 d'octubre del 2024");
    expect(celDocument(no)).toContain("No tramès");
    expect(celDocument(null)).toContain("no consta");
    expect(celDocument({ trames: true, data: "2026-03-23", observacio: "En revisió" })).toContain("En revisió");
  });
});

describe("renderDinersGeneralitatBloc", () => {
  const html = renderDinersGeneralitatBloc(DADES, { habitants: 12000, anyPadro: 2025 });

  it("sense J41 diu que no consta, i mai torna buit", () => {
    const buit = renderDinersGeneralitatBloc(null);
    expect(buit).toContain("No consta");
    expect(renderDinersGeneralitat(undefined)).toContain('id="diners-generalitat"');
  });

  it("té els quatre apartats amb els seus títols", () => {
    expect(html).toContain("Què li dona la Generalitat sense condicions");
    expect(html).toContain("Obres del PUOSC");
    expect(html).toContain("Envia els comptes?");
    expect(html).toContain("El que li deu la Generalitat");
  });

  it("el FCL: el darrer any, per habitant, i els trams sense sumar", () => {
    expect(html).toContain("El 2025 la Generalitat va assignar a l'ajuntament <b>300.000&nbsp;€</b>");
    expect(html).toContain("25&nbsp;€ per habitant, amb el padró del 2025");
    expect(html).toContain("A part, i sense sumar-hi, 60.000&nbsp;€ del fons extraordinari");
    // 300.000 + 60.000 no surt enlloc.
    expect(html).not.toContain("360.000");
    expect(html).toContain("No és un premi ni un càstig");
    // Un any sense fila és «no consta», i un zero publicat es queda zero.
    expect(html).toMatch(/<th scope="row">2024<\/th><td class="coop-buit"[^>]*>no consta/);
    expect(html).toContain("<td class=\"ara\">0&nbsp;€</td>");
  });

  it("les obres: programades amb etiqueta, separades de les assignades, i el títol escapat", () => {
    expect(html).toContain("Des del 2022 la Generalitat ha assignat a l'ajuntament <b>1 obra</b> del PUOSC, amb 11.347&nbsp;€ de subvenció.");
    expect(html).toContain("I n'hi ha una més de programada per al 2028, amb 150.000&nbsp;€: són anualitats previstes, no obres fetes.");
    expect(html).toContain('2028 <span class="coop-etiqueta">programada</span>');
    expect(html).toContain("avinguda del Centre &lt;i&gt;");
    expect(html).not.toContain("<i>");
    expect(html).toContain("L'obra del 2001");
    expect(html).toContain("Del 2013 al 2019 la font no publica cap obra");
  });

  it("els comptes: estat literal per any, sense l'adjectiu de l'inventari", () => {
    expect(html).toContain("Tramès el 9 d'octubre del 2024");
    expect(html).toContain("Tramès en part");
    expect(html).toContain("No tramès");
    expect(html).toContain("no consta");
    expect(html).toContain("Inventari actualitzat el 27 d'octubre del 2026");
    expect(html).not.toContain("No compleix");
    expect(html).not.toContain("Compleix");
  });

  it("el pendent: data de la relació, total d'un sol pagador i el retingut explicat", () => {
    expect(html).toContain("L'1 d'octubre del 2026 la Generalitat tenia reconeguts <b>19.398&nbsp;€</b>");
    expect(html).toContain("Fons de Cooperació Local");
    expect(html).toContain("Retingut");
    expect(html).toContain("calendari normal de pagaments");
  });

  it("cada apartat cita la seva font amb la data de consulta", () => {
    for (const id of ["ka4a-fyht", "v5fj-86q3", "7fnj-etev", "4w8y-gf8x"]) expect(html).toContain(`/d/${id}`);
    expect(html).toContain("consultat el 27 d'octubre del 2026");
  });

  it("amb buits a totes les fonts, cada apartat diu que no consta", () => {
    const buit = renderDinersGeneralitatBloc({
      ...DADES,
      fcl: [],
      obres: [],
      trameses: { anys: [], estatInventari: null, actualitzat: null },
      pendents: null,
    });
    expect(buit).toContain("no porta cap any per a l'ajuntament: no consta");
    expect(buit).toContain("no porta cap obra per a l'ajuntament");
    expect(buit).toContain("L'ajuntament no surt a l'inventari");
    expect(buit).toContain("No s'ha pogut llegir la relació de pagaments pendents");
  });

  it("si no surt a la relació de pendents, ho diu amb la data", () => {
    const res = renderDinersGeneralitatBloc({ ...DADES, pendents: { data: "2026-10-01", conceptes: [] } });
    expect(res).toContain("A la relació de l'1 d'octubre del 2026, l'ajuntament no hi surt");
  });

  it("frase d'obres quan només n'hi ha de programades", () => {
    expect(fraseObres([obra({ any: 2027, estat: "programada", subvencio: 10 }), obra({ any: 2029, estat: "programada", subvencio: 5 })]))
      .toBe("Hi ha 2 obres del PUOSC programades per als anys 2027-2029, amb 15&nbsp;€: són anualitats previstes, no obres fetes.");
  });

  it("frase d'obres quan només n'hi ha d'antigues", () => {
    expect(fraseObres([obra({ any: 1999 }), obra({ any: 2003 })])).toContain("entre el 1999 i el 2003 n'hi consten 2 obres");
  });
});

describe("fitxes dels ens", () => {
  const consell: DinersGeneralitatEnsDesat = {
    ...DADES,
    codiEns: "8100170005",
    nom: "Consell Comarcal de l'Alt Camp",
    tipus: "consell",
    fcl: [{ any: 2025, lliure: 974404.93, supramunicipal: null, extraordinari: 194877.36 }],
    obres: [],
    pendents: { data: "2026-10-01", conceptes: [] },
  };
  const diputacio: DinersGeneralitatEnsDesat = { ...consell, codiEns: "8000840003", nom: "Diputació de Barcelona", tipus: "diputacio", fcl: null };

  it("l'adaptador indexa per codi i ignora files d'un altre kind o sense forma", () => {
    const files = [
      { kind: "dinersGeneralitatEns:8100170005", data: consell },
      { kind: "dinersGeneralitatEns:8000840003", data: diputacio },
      { kind: "dinersGeneralitat", data: DADES },
      { kind: "dinersGeneralitatEns:trencat", data: { codiEns: "x" } },
      { kind: "dinersGeneralitatEns:sense-tipus", data: { ...consell, codiEns: "1", tipus: "altre" } },
    ];
    const index = indexaDinersGeneralitatEns(files);
    expect([...index.keys()]).toEqual(["8100170005", "8000840003"]);
    expect(dinersGeneralitatEns(files, "8000840003")?.nom).toBe("Diputació de Barcelona");
    expect(dinersGeneralitatEns(files, "0000000000")).toBeNull();
  });

  it("valida la forma de la mètrica municipal", () => {
    expect(llegeixDinersGeneralitat(DADES)?.codiEns).toBe("0800180001");
    expect(llegeixDinersGeneralitat(null)).toBeNull();
    expect(llegeixDinersGeneralitat({ ...DADES, obres: "no" })).toBeNull();
    expect(llegeixDinersGeneralitat({ ...DADES, fonts: { fcl: {} } })).toBeNull();
  });

  it("el consell: fons amb la contracció bona, comptes, i res de pendents si no n'hi ha", () => {
    const html = renderDinersGeneralitatEns(consell);
    expect(html).toContain("va assignar al consell comarcal <b>974.405&nbsp;€</b>");
    expect(html).toContain("194.877&nbsp;€ del fons extraordinari");
    expect(html).toContain("Cada any el consell comarcal ha d'enviar");
    expect(html).not.toContain("El que li deu la Generalitat");
    expect(html).not.toContain("Obres del PUOSC");
  });

  it("la diputació: diu que no rep FCL en comptes de deixar un forat", () => {
    const html = renderDinersGeneralitatEns(diputacio);
    expect(html).toContain("Les diputacions no reben el Fons de Cooperació Local");
    expect(html).not.toContain("Què li dona la Generalitat sense condicions");
    expect(html).toContain("Cada any la diputació ha d'enviar");
    expect(renderDinersGeneralitatEns(null)).toBe("");
  });
});

describe("COOPERACIO_CSS", () => {
  it("totes les classes porten el prefix coop-", () => {
    const classes = [...COOPERACIO_CSS.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]!);
    expect(classes.length).toBeGreaterThan(5);
    for (const c of classes) expect(c.startsWith("coop-")).toBe(true);
  });
});
