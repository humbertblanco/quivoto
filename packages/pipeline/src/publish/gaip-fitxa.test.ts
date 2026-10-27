import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FONTS_GAIP,
  contextCatalunya,
  gaipDeMunicipi,
  indexMunicipis,
  repartGaip,
  repartIncompliments,
  type FilaGaip,
  type FilaIncompliment,
  type GaipMetric,
} from "../jobs/j45-gaip";
import { GAIP_FITXA_CSS, TITOL_GAIP, avisIncompliments, renderGaip, renderGaipBloc } from "./gaip-fitxa";

/** Les mateixes files reals que fa servir el test de J45. */
const FIXTURES = join(__dirname, "..", "adapters", "__fixtures__");
const llegeix = <T>(nom: string): T => JSON.parse(readFileSync(join(FIXTURES, nom), "utf8")) as T;
const MUNICIPIS = ["Espot", "els Alamús", "Seròs", "Cervera", "Arbeca", "la Floresta", "Tarragona", "la Llagosta"].map(
  (name, i) => ({ id: i + 1, name }),
);
const index = indexMunicipis(MUNICIPIS);
const { perMunicipi } = repartGaip(llegeix<FilaGaip[]>("gaip-resolucions.json"), index);
const inc = repartIncompliments(llegeix<FilaIncompliment[]>("gaip-incompliments.json"), index);
const ctx = {
  catalunya: {
    reclamacions: 4567,
    ajuntaments: 870,
    estimades: 1747,
    ambits: [{ ambit: "Protecció d'animals", reclamacions: 1042, ajuntaments: 773 }],
  },
  darreraReclamacioFont: "2026-07-18",
  fonts: {
    resolucions: { ...FONTS_GAIP.resolucions, actualitzat: "2026-10-01" },
    incompliments: { ...FONTS_GAIP.incompliments, actualitzat: "2026-10-01" },
  },
  consultat: "2026-10-27",
  primerAny: 2015,
  darrerAny: 2026,
};
const metrica = (nom: string): GaipMetric => {
  const id = MUNICIPIS.find((m) => m.name === nom)!.id;
  return gaipDeMunicipi(perMunicipi.get(id) ?? [], inc.perMunicipi.get(id) ?? [], ctx);
};
/** El text que llegeix el veí, sense etiquetes i amb els espais plegats. */
const text = (html: string): string => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

describe("el bloc d'un municipi amb reclamacions", () => {
  const html = renderGaipBloc(metrica("Espot"), 300, "Espot");
  const t = text(html);

  it("diu quantes aquest mandat i quantes va estimar la GAIP, amb què vol dir", () => {
    expect(t).toContain("Aquest mandat, des del 17 de juny del 2023, la GAIP ha resolt 5 reclamacions contra l'Ajuntament d'Espot");
    expect(t).toContain("La GAIP en va estimar 3 , del tot o en part (60,0 %)");
    expect(t).toContain("havia de donar la informació");
  });

  it("desglossa el sentit, explica la pèrdua d'objecte i diu qui reclamava", () => {
    expect(t).toContain("1 estimada del tot, 2 estimades en part i 2 tancades per pèrdua d'objecte");
    expect(t).toContain("l'ajuntament hagués donat la informació un cop presentada la reclamació");
    expect(t).toContain("3 particulars, 1 càrrec electe i 1 entitat o fundació");
  });

  it("porta les tessel·les, la mediana de dies i els PDF de les recents", () => {
    expect(html).toContain('<ul class="tires">');
    expect(t).toContain("Dies que va trigar la GAIP 105");
    expect(html).toContain("https://documents.dadesobertes.gencat.cat/gaip/docs/Resolucio_1054_2026_CAT.pdf");
    expect(html).not.toContain("_CAST.pdf");
  });

  it("dona la referència de Catalunya sense fer-ne una nota, i les cauteles", () => {
    expect(t).toContain("4.567 reclamacions contra 870 ajuntaments");
    expect(t).toContain("no una nota");
    expect(t).toContain("no vol dir que l'ajuntament ho publiqui tot");
    expect(t).toContain("les pendents no hi surten");
  });

  it("no fa cap taxa per habitant", () => {
    expect(t).not.toMatch(/per (1\.000|10\.000|100) habitants/);
  });
});

describe("l'onada de reclamacions de protecció d'animals", () => {
  it("es diu quan el tema és també del municipi", () => {
    const t = text(renderGaipBloc(metrica("els Alamús"), 900, "els Alamús"));
    expect(t).toContain("contra l'Ajuntament dels Alamús");
    expect(t).toContain("protecció d'animals, un tema en què aquest mandat s'han presentat 1.042 reclamacions contra 773 ajuntaments");
  });
});

describe("els incompliments", () => {
  it("van primer i a la vista, amb els enllaços", () => {
    const html = renderGaipBloc(metrica("Tarragona"), 140_000, "Tarragona");
    const t = text(html);
    expect(t).toContain("Segons la GAIP, l'ajuntament no va complir 16 resolucions seves");
    expect(html.indexOf("gaip-incompliment")).toBeLessThan(html.indexOf("entrada-bloc"));
    expect(html).toMatch(/Resolucio_\d+_\d{4}_CAT\.pdf/);
  });

  it("un de sol, en singular", () => {
    const m = metrica("la Llagosta");
    const un = { ...m, incompliments: m.incompliments.slice(0, 1) };
    expect(text(avisIncompliments(un))).toContain("no va complir una resolució seva (resolucions del 2016)");
    expect(text(avisIncompliments(un))).toContain("que la complís");
  });

  it("sense incompliments, no hi ha avís", () => {
    expect(renderGaipBloc(metrica("Espot"), 300)).not.toContain("gaip-incompliment");
  });
});

describe("un municipi sense reclamacions", () => {
  it("ho diu i avisa que zero no vol dir transparència perfecta", () => {
    const t = text(renderGaipBloc(gaipDeMunicipi([], [], ctx), 1800, "Seròs"));
    expect(t).toContain("no consta cap reclamació contra l'Ajuntament de Seròs que la GAIP hagi resolt");
    expect(t).toContain("als pobles petits hi ha poques sol·licituds");
    expect(t).not.toContain("Estimades, del tot o en part");
  });
});

describe("sense J45", () => {
  it("no torna mai buit, i diu el buit", () => {
    const t = text(renderGaipBloc(null, null));
    expect(t).toContain("No consta cap dada");
    expect(renderGaip(null, null)).toContain(TITOL_GAIP);
  });

  it("l'estil porta només classes gaip-", () => {
    const classes = GAIP_FITXA_CSS.match(/\.[a-z][a-z0-9-]*/g) ?? [];
    expect(classes.length).toBeGreaterThan(0);
    for (const c of classes) expect(c.startsWith(".gaip-")).toBe(true);
  });
});
