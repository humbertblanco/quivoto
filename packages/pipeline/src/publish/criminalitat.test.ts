import { describe, expect, it } from "vitest";
import {
  mitjanesPerGrup,
  ordinal,
  renderCriminalitat,
  type GrupCriminalitat,
} from "./criminalitat";
import {
  LLICENCIA_INTERIOR,
  NOTA_COMPETENCIES,
  NOTA_FETS_CONEGUTS,
  NOTA_LLINDAR,
  type CriminalitatMetric,
  type TipusCriminalitat,
} from "../jobs/j29-criminalitat";
import type { PeerGroup } from "../derive/peers";

/**
 * El que es prova no és que «quedi bé», sinó les tres regles del bloc: que la
 * frase vagi abans que la taula, que el canvi es digui amb fletxes de tinta i
 * mai amb les classes de color del balanç financer —aquí no hi ha millor ni
 * pitjor—, i que el rànquing no surti mai sense el denominador. I el buit: el
 * municipi que no és al balanç ha de saber per què.
 */

function tipus(over: Partial<TipusCriminalitat> & Pick<TipusCriminalitat, "clau" | "nom">): TipusCriminalitat {
  return {
    nivell: 1,
    fitxa: true,
    serie: [],
    perMil: [],
    canviUltimAny: null,
    canviMandat: null,
    ...over,
  };
}

const TOTAL = tipus({
  clau: "total",
  nom: "Total d'infraccions penals",
  serie: [
    { any: 2023, fets: 14_156 },
    { any: 2024, fets: 15_079 },
    { any: 2025, fets: 14_901 },
  ],
  perMil: [
    { any: 2023, valor: 62.6 },
    { any: 2024, valor: 66.4 },
    { any: 2025, valor: 64.4 },
  ],
  canviUltimAny: { desDe: 2024, fins: 2025, abs: -178, pct: -1.2 },
  canviMandat: { desDe: 2023, fins: 2025, abs: 745, pct: 5.3 },
});

function metrica(over: Partial<CriminalitatMetric> = {}): CriminalitatMetric {
  return {
    font: {
      nom: "Balanç de criminalitat (4t trimestre: any sencer)",
      organisme: LLICENCIA_INTERIOR.organisme,
      url: "https://estadisticasdecriminalidad.ses.mir.es/publico/portalestadistico/datos.html?type=jaxi&title=Cuarto%20trimestre&path=/DatosBalanceAnt/20254/",
      llicencia: LLICENCIA_INTERIOR,
      consultat: "2026-08-30",
      balancos: [
        { any: 2020, trimestre: 4, fitxer: "1009012.px", titol: "Municipios mayores de 30.000", llindar: 30_000, url: "https://x/1009012" },
        { any: 2025, trimestre: 4, fitxer: "1509012.px", titol: "Municipios mayores de 20.000", llindar: 20_000, url: "https://x/1509012" },
      ],
    },
    cobertura: "mes-de-20000",
    llindar: { habitants: 20_000, nota: NOTA_LLINDAR },
    context: { decideixLAjuntament: false, nota: NOTA_COMPETENCIES },
    mandat: { desDe: 2023 },
    anys: [2023, 2024, 2025],
    darrerAny: 2025,
    poblacio: [
      { any: 2023, habitants: 225_957, anyPadro: 2023 },
      { any: 2024, habitants: 227_083, anyPadro: 2024 },
      { any: 2025, habitants: 231_542, anyPadro: 2025 },
    ],
    total: TOTAL,
    tipus: [
      tipus({
        clau: "furts",
        nom: "Furts",
        serie: [{ any: 2023, fets: 3_969 }, { any: 2024, fets: 3_753 }, { any: 2025, fets: 4_095 }],
        perMil: [{ any: 2023, valor: 17.6 }, { any: 2024, valor: 16.5 }, { any: 2025, valor: 17.7 }],
        canviUltimAny: { desDe: 2024, fins: 2025, abs: 342, pct: 9.1 },
        canviMandat: { desDe: 2023, fins: 2025, abs: 126, pct: 3.2 },
      }),
      tipus({
        clau: "homicidis",
        nom: "Homicidis dolosos i assassinats consumats",
        serie: [{ any: 2023, fets: 3 }, { any: 2025, fets: 4 }],
        perMil: [{ any: 2023, valor: 0 }, { any: 2025, valor: 0 }],
        canviMandat: { desDe: 2023, fins: 2025, abs: 1, pct: 33.3 },
      }),
      tipus({
        clau: "vehicles",
        nom: "Sostraccions de vehicles",
        serie: [{ any: 2023, fets: 251 }, { any: 2024, fets: 237 }, { any: 2025, fets: 227 }],
        perMil: [{ any: 2023, valor: 1.1 }, { any: 2024, valor: 1 }, { any: 2025, valor: 1 }],
        canviUltimAny: { desDe: 2024, fins: 2025, abs: -10, pct: -4.2 },
        canviMandat: { desDe: 2023, fins: 2025, abs: -24, pct: -9.6 },
      }),
      tipus({
        clau: "segrest",
        nom: "Segrestos",
        fitxa: false,
        serie: [{ any: 2025, fets: 0 }],
        perMil: [{ any: 2025, valor: 0 }],
      }),
    ],
    ranquing: {
      posicio: 42,
      de: 71,
      any: 2025,
      criteri: "fets penals coneguts per 1.000 habitants (total d'infraccions penals)",
      ordre: "el 1r és el que en té més per 1.000 habitants",
    },
    nota: NOTA_FETS_CONEGUTS,
    ...over,
  };
}

describe("renderCriminalitat", () => {
  const html = renderCriminalitat(metrica());

  it("la frase va primer, amb la xifra, la taxa i el canvi des del 2023", () => {
    expect(html.trimStart().startsWith("<p class=\"entrada-bloc\">El 2025 es van conèixer")).toBe(true);
    expect(html).toContain("<b>14.901</b> fets penals");
    expect(html).toContain("64,4 per cada 1.000 habitants");
    expect(html).toContain("745 més que el 2023");
    expect(html).toContain("+5,3");
  });

  it("el rànquing mai no surt sense el denominador, i es diu amb paraules", () => {
    expect(html).toContain("el <b>42è</b> dels <b>71</b> municipis catalans amb dada");
    expect(html).toContain("el 1r és el que en té més");
  });

  it("els ordinals catalans: 1r, 2n, 3r, 4t i tota la resta en è", () => {
    expect([ordinal(1), ordinal(2), ordinal(3), ordinal(4), ordinal(5), ordinal(42)])
      .toEqual(["1r", "2n", "3r", "4t", "5è", "42è"]);
  });

  it("les fletxes són de tinta: ↑ i ↓ sense les classes de color del balanç financer", () => {
    expect(html).toContain("↑");
    expect(html).toContain("↓");
    expect(html).toContain('aria-label="puja"');
    expect(html).toContain('aria-label="baixa"');
    expect(html).not.toContain("millor");
    expect(html).not.toContain("pitjor");
  });

  it("la taula compacta porta l'últim any i el canvi des del 2023; el que no és de fitxa va al desplegable", () => {
    expect(html).toContain("<th>2025</th>");
    expect(html).toContain("des del 2023");
    expect(html).toContain("Furts");
    // «Segrestos» té fitxa:false: només surt un cop, dins del desplegable any a any.
    const desplegable = html.slice(html.indexOf("<details"));
    expect(desplegable).toContain("Segrestos");
    expect(html.slice(0, html.indexOf("<details"))).not.toContain("Segrestos");
  });

  it("el desplegable porta la sèrie sencera i un guionet als anys que falten", () => {
    const desplegable = html.slice(html.indexOf("<details"));
    expect(desplegable).toContain("<th>2023</th>");
    expect(desplegable).toContain("<th>2025</th>");
    // Els homicidis no tenen 2024: guionet, no zero.
    expect(desplegable).toContain("—");
  });

  it("les dues notes són visibles: fets coneguts i què hi decideix l'ajuntament", () => {
    expect(html).toContain("Són fets penals coneguts");
    expect(html).toContain("Què hi decideix l&#39;ajuntament".replace("&#39;", "'"));
    expect(html).toContain("Mossos");
    expect(html).toContain("policia local");
  });

  it("la font surt amb la citació literal que obliga l'avís legal", () => {
    expect(html).toContain("Origen de los datos: Portal Estadístico de Criminalidad");
    expect(html).toContain("consultats el 2026-08-30");
    expect(html).toContain("del 2020 al 2025");
  });

  it("amb el grup, la taula guanya la columna dels de la seva mida i la frase la mediana", () => {
    const grup: GrupCriminalitat = {
      nom: "de més de 50.000 habitants",
      quants: 23,
      medianaPerMil: { total: 55.5, furts: 12.3 },
    };
    const ambGrup = renderCriminalitat(metrica(), { grup });
    expect(ambGrup).toContain("els de la seva mida");
    expect(ambGrup).toContain("55,5");
    expect(ambGrup).toContain("12,3");
    expect(ambGrup).toContain("entre els 23 de la seva mida amb dada");
    // Sense grup, ni columna ni frase.
    expect(html).not.toContain("els de la seva mida");
  });

  it("cap text de la font ni del grup no pot colar-hi etiquetes", () => {
    const ambGrup = renderCriminalitat(metrica(), {
      grup: { nom: "<script>alert(1)</script>", medianaPerMil: { total: 1 } },
    });
    expect(ambGrup).not.toContain("<script>");
    expect(ambGrup).toContain("&lt;script&gt;");
  });

  it("quan el canvi del mandat no hi és, la frase cau al canvi de l'últim any", () => {
    const sense = renderCriminalitat(metrica({
      total: tipus({
        clau: "total",
        nom: "Total d'infraccions penals",
        serie: [{ any: 2024, fets: 100 }, { any: 2025, fets: 90 }],
        perMil: [{ any: 2024, valor: 5 }, { any: 2025, valor: 4.5 }],
        canviUltimAny: { desDe: 2024, fins: 2025, abs: -10, pct: -10 },
      }),
    }));
    expect(sense).toContain("10 menys que el 2024");
  });

  it("un tipus que comença més tard que el total porta l'any d'inici al costat, al desplegable", () => {
    const html = renderCriminalitat(metrica({
      anys: [2021, 2022, 2023, 2024, 2025],
      total: tipus({
        clau: "total",
        nom: "Total d'infraccions penals",
        serie: [2021, 2022, 2023, 2024, 2025].map((any) => ({ any, fets: 100 + any - 2021 })),
      }),
      tipus: [
        tipus({
          clau: "ciber",
          nom: "Cibercriminalitat",
          serie: [{ any: 2023, fets: 900 }, { any: 2025, fets: 950 }],
        }),
      ],
    }));
    expect(html).toContain("Cibercriminalitat (des del 2023)");
    expect(html).not.toContain("Total d'infraccions penals (des del");
    // I el peu del desplegable diu per què una fila pot començar més tard.
    expect(html).toContain("un desglòs que abans no existia");
  });

  it("amb vuit anys o més, la frase porta l'espurna de la sèrie; amb tres anys, no", () => {
    const anys = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
    const llarga = renderCriminalitat(metrica({
      anys,
      total: tipus({
        clau: "total",
        nom: "Total d'infraccions penals",
        serie: anys.map((any) => ({ any, fets: 10_000 + (any - 2018) * 100 })),
        perMil: anys.map((any) => ({ any, valor: 50 })),
      }),
      tipus: [],
    }));
    expect(llarga).toContain("serie-espurna");
    // L'espurna no substitueix la xifra: la frase continua sent el primer que es llegeix.
    expect(llarga.trimStart().startsWith("<p class=\"entrada-bloc\">El 2025")).toBe(true);
    expect(llarga).toContain("10.700 fets");
    expect(renderCriminalitat(metrica())).not.toContain("serie-espurna");
  });

  it("un any que falta al mig de l'espurna és un forat dibuixat, no un pendent inventat", () => {
    const serie = [2017, 2018, 2019, 2020, 2022, 2023, 2024, 2025].map((any) => ({ any, fets: 5_000 }));
    const html = renderCriminalitat(metrica({
      anys: serie.map((p) => p.any),
      total: tipus({ clau: "total", nom: "Total d'infraccions penals", serie }),
      tipus: [],
    }));
    expect(html).toContain("serie-espurna");
    expect(html).toContain("2021 no en consta cap xifra");
  });
});

describe("renderCriminalitat: el buit s'ha de dir", () => {
  it("el municipi petit sap per què no té xifra i on és el que sí que es publica", () => {
    const html = renderCriminalitat(null, { poblacio: 3_000, coberts: 71 });
    expect(html).toContain("més de 20.000 habitants");
    expect(html).toContain("71 a Catalunya");
    expect(html).toContain("àrea bàsica policial");
    expect(html).not.toContain("hauria de formar part");
    // La nota de competències hi és igualment: el buit no s'emporta el context.
    expect(html).toContain("Què hi decideix l'ajuntament");
    expect(html).toContain("Mossos");
  });

  it("el municipi gran que falta ho diu: el forat és de la font", () => {
    const html = renderCriminalitat(null, { poblacio: 25_000 });
    expect(html).toContain("<b>25.000</b> habitants");
    expect(html).toContain("hauria de formar part");
  });

  it("mai una cadena buida: un bloc que desapareix sense explicació fa pensar que no hi ha res a dir", () => {
    expect(renderCriminalitat(null).trim()).not.toBe("");
  });
});

describe("mitjanesPerGrup", () => {
  it("mediana per grup i tipologia sobre els municipis amb dada, amb el quants al costat", () => {
    const grupGran: PeerGroup = { key: "t8-9", label: "de més de 50.000 habitants", size: 23 };
    const grupMitja: PeerGroup = { key: "t7-7", label: "de 20.001 a 50.000 habitants", size: 40 };
    const grups = new Map<number, PeerGroup>([[1, grupGran], [2, grupGran], [3, grupMitja]]);
    const ambTaxa = (valor: number): CriminalitatMetric =>
      metrica({
        total: tipus({
          clau: "total",
          nom: "Total d'infraccions penals",
          serie: [{ any: 2025, fets: 1 }],
          perMil: [{ any: 2025, valor }],
        }),
        tipus: [],
      });
    const medianes = mitjanesPerGrup(
      [
        { municipalityId: 1, data: ambTaxa(64.4) },
        { municipalityId: 2, data: ambTaxa(50) },
        { municipalityId: 3, data: ambTaxa(30) },
      ],
      grups,
    );
    expect(medianes.get("t8-9")).toEqual({
      nom: "de més de 50.000 habitants",
      quants: 2,
      medianaPerMil: { total: 57.2 },
    });
    expect(medianes.get("t7-7")?.medianaPerMil["total"]).toBe(30);
  });

  it("una taxa null no entra a la mediana: no és un zero", () => {
    const grup: PeerGroup = { key: "g", label: "grup", size: 2 };
    const medianes = mitjanesPerGrup(
      [{
        municipalityId: 1,
        data: metrica({
          total: tipus({
            clau: "total",
            nom: "Total",
            serie: [{ any: 2025, fets: 10 }],
            perMil: [{ any: 2025, valor: null }],
          }),
          tipus: [],
        }),
      }],
      new Map([[1, grup]]),
    );
    expect(medianes.get("g")?.medianaPerMil["total"]).toBeUndefined();
  });
});
