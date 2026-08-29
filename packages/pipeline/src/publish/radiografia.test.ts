import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  renderEscombraries,
  renderQuePaga,
  renderQuiHiViu,
  renderRadiografia,
  type RadiografiaData,
} from "./radiografia";

/**
 * Els blocs nous de la fitxa, provats amb dades inventades però amb la forma
 * exacta que desen J15, J18 i J19.
 *
 * Les xifres de població són les de Sabadell que surten citades a J18, perquè
 * són l'exemple que va motivar la regla: 34.062 persones de nacionalitat
 * estrangera i 46.870 nascudes a l'estranger, 12.808 de diferència al mateix
 * poble el mateix any. Si un dia algú «simplifica» el bloc i en treu una xifra
 * sola, aquestes proves han de petar.
 */

const CENS_2025 = 224_092;

const variacio = (desDe: number, fins: number, inici: number, final: number) => ({
  desDe,
  fins,
  inici,
  final,
  diferencia: Math.round((final - inici) * 1000) / 1000,
  percentual: inici === 0 ? null : Math.round((1000 * (final - inici)) / inici) / 10,
  anys: fins - desDe,
  diferenciaAnual: Math.round(((final - inici) / (fins - desDe)) * 1000) / 1000,
  percentualAnual: inici === 0 ? null : Math.round((1000 * (final - inici)) / inici / (fins - desDe)) / 10,
});

const enllac = (taula: string, titol: string) => ({
  taula,
  titol,
  href: `https://www.idescat.cat/emex/?id=081871#${taula}`,
});

const indicador = (
  clau: string,
  etiqueta: string,
  unitat: "persones" | "%" | "anys",
  compta: string,
  valor: number,
  extra: Partial<Record<string, unknown>> = {},
) => ({
  clau,
  etiqueta,
  unitat,
  compta,
  taula: "censph/5992/5987",
  emex: "t195",
  decimals: unitat === "persones" ? 0 : 1,
  darrerAny: 2025,
  valor,
  serie: [
    { any: 2023, valor: valor * 0.97 },
    { any: 2025, valor },
  ],
  mandat: null,
  mandatAnterior: null,
  mandatDelGrup: null,
  comparacio: null,
  enllac: enllac("t195", etiqueta),
  catalunya: null,
  ...extra,
});

function poblacio(): NonNullable<RadiografiaData["poblacio"]> {
  return {
    font: {
      organisme: "Institut d'Estadística de Catalunya (Idescat)",
      llicencia: {
        organisme: "Institut d'Estadística de Catalunya (Idescat)",
        condicions: "https://www.idescat.cat/dev/api/condicions/",
        literal: "Heu de reconèixer l'origen de les dades…",
        obliga:
          "Cada xifra s'ha de presentar amb l'enllaç que ha donat l'API, tal com l'ha donat.",
      },
      taules: [
        { taula: "censph/5992/5987", nom: "Població per nacionalitat", font: "Idescat", actualitzat: "2026-02-10" },
      ],
      enllacosMunicipi: [
        enllac("t195", "Població. Xifres oficials"),
        enllac("t75", "Població per nacionalitat"),
        enllac("t68", "Població per lloc de naixement"),
        enllac("t25", "Població per grups d'edat"),
        enllac("t197", "Població resident a l'estranger"),
      ],
    },
    context: {
      decideixLAjuntament: false,
      nota:
        "Un ajuntament no decideix qui neix, qui mor ni qui es muda. Aquestes xifres descriuen el " +
        "poble, no la gestió del consistori.",
    },
    mandat: { desDe: 2023, anterior: 2019 },
    darrerAny: 2025,
    indicadors: [
      indicador("padroHabitants", "Persones empadronades", "persones",
        "Persones inscrites al padró municipal d'habitants a 1 de gener. Compta empadronats, no residents.",
        224_512, { emex: null, enllac: null }),
      indicador("censHabitants", "Població censada", "persones",
        "Població resident segons el Cens de població anual de l'INE a 1 de gener.",
        CENS_2025, {
          mandat: variacio(2023, 2025, 216_204, CENS_2025),
          mandatDelGrup: { fins: 2025, diferencia: 1_240, percentual: 2.1, municipis: 22 },
        }),
      indicador("nacionalitatEstrangera", "Persones de nacionalitat estrangera", "persones",
        "Persones que no tenen la nacionalitat espanyola. NO és el mateix que haver nascut fora.",
        34_062, { emex: "t75", enllac: enllac("t75", "Població per nacionalitat") }),
      indicador("pctNacionalitatEstrangera", "Pes de la població de nacionalitat estrangera", "%",
        "Persones sense nacionalitat espanyola sobre el total de població censada.",
        15.2, { emex: "t75", enllac: enllac("t75", "Població per nacionalitat"),
          catalunya: { valor: 17.4, mandat: null } }),
      indicador("nascutsAEstranger", "Persones nascudes a l'estranger", "persones",
        "Persones nascudes fora d'Espanya, tinguin la nacionalitat que tinguin. NO és el mateix que ser estranger.",
        46_870, { emex: "t68", enllac: enllac("t68", "Població per lloc de naixement") }),
      indicador("pctNascutsAEstranger", "Pes de la població nascuda a l'estranger", "%",
        "Persones nascudes fora d'Espanya sobre el total de població censada.",
        20.9, { emex: "t68", enllac: enllac("t68", "Població per lloc de naixement"),
          catalunya: { valor: 22.6, mandat: null } }),
      indicador("pct65iMes", "Pes de la població de 65 anys o més", "%",
        "Persones de 65 anys o més sobre el total de població censada, tal com ho calcula l'Idescat.",
        18.9, { emex: "t25", enllac: enllac("t25", "Població per grups d'edat"),
          mandat: variacio(2023, 2025, 18.3, 18.9),
          mandatDelGrup: { fins: 2025, diferencia: 0.4, percentual: 2.2, municipis: 22 },
          catalunya: { valor: 19.7, mandat: null } }),
      indicador("edatMitjana", "Edat mitjana", "anys",
        "Edat mitjana de la població censada, calculada per l'Idescat.",
        42.6, { emex: "t25", enllac: enllac("t25", "Població per grups d'edat"),
          catalunya: { valor: 43.1, mandat: null } }),
      indicador("infants0a2", "Infants de 0 a 2 anys", "persones",
        "Suma de les persones de 0, 1 i 2 anys. És la població a qui van adreçades les llars d'infants.",
        5_412, { emex: "t25", enllac: enllac("t25", "Població per grups d'edat"),
          mandat: variacio(2023, 2025, 5_820, 5_412),
          mandatDelGrup: { fins: 2025, diferencia: -180, percentual: -3.1, municipis: 22 } }),
      indicador("de85iMes", "Persones de 85 anys o més", "persones",
        "Suma dels trams de 85 a 89, de 90 a 94, de 95 a 99 i de 100 anys o més.",
        7_104, { emex: "t25", enllac: enllac("t25", "Població per grups d'edat"),
          mandat: variacio(2023, 2025, 6_780, 7_104),
          mandatDelGrup: { fins: 2025, diferencia: 210, percentual: 3.8, municipis: 22 } }),
      indicador("residentsAEstranger", "Persones empadronades que viuen a l'estranger", "persones",
        "Espanyols inscrits al padró d'aquest municipi que resideixen a l'estranger (CERA).",
        3_190, { emex: "t197", enllac: enllac("t197", "Població resident a l'estranger") }),
    ],
    divergencia: {
      any: 2025,
      poblacio: CENS_2025,
      nacionalitatEstrangera: 34_062,
      nascutsAEstranger: 46_870,
      pctNacionalitatEstrangera: 15.2,
      pctNascutsAEstranger: 20.9,
      persones: 12_808,
      mesGran: "lloc de naixement",
      nota:
        "Són dos recomptes de coses diferents, no dues estimacions de la mateixa cosa. Ni la suma " +
        "ni la resta de tots dos vol dir res.",
    },
    creuament: {
      any: 2025,
      nascutsForaAmbNacionalitatEspanyola: 15_780,
      estrangersNascutsAEspanya: 2_970,
      desquadrament: -2,
      arrodonit: true,
      nota: "Xifres derivades de la taula creuada, que l'Idescat publica arrodonida.",
    },
    padroContraCens: {
      any: 2025,
      padro: 224_512,
      cens: CENS_2025,
      persones: 420,
      percentual: 0.2,
      divergeix: false,
      nota: "El padró compta persones empadronades i el cens estima qui hi resideix.",
    },
  };
}

function aigua(over: Partial<NonNullable<RadiografiaData["preuAigua"]>> = {}): NonNullable<
  RadiografiaData["preuAigua"]
> {
  return {
    font: { dataActualitzacio: "2026-01-15", peu: "Agència Catalana de l'Aigua" },
    darrerAny: 2025,
    serie: [
      {
        any: 2023, subministrament: 1.4, canon: 0.654, clavegueram: 0, municipal: 1.4,
        total: 2.054, rebutSencer: false, tarifaSocial: true, dataRevisio: "2024-03-01",
      },
      {
        any: 2025, subministrament: 1.5, canon: 0.654, clavegueram: 0, municipal: 1.5,
        total: 2.154, rebutSencer: false, tarifaSocial: true, dataRevisio: "2024-03-01",
      },
    ],
    preu: { subministrament: 1.5, canon: 0.654, clavegueram: 0, municipal: 1.5, total: 2.154 },
    comparable: "subministrament",
    rebutSencer: false,
    avisRebut:
      "El total no inclou el clavegueram i la depuració: aquest municipi no els calcula sobre el " +
      "consum d'aigua. Per comparar amb altres municipis cal fer servir el preu del subministrament.",
    dataRevisio: "2024-03-01",
    interpretable: { valida: true, motiu: null, anyRevisio: 2024 },
    mandat: {
      subministrament: variacio(2023, 2025, 1.4, 1.5),
      municipal: variacio(2023, 2025, 1.4, 1.5),
      total: variacio(2023, 2025, 2.054, 2.154),
    },
    mandatDelGrup: {
      subministrament: { mediana: 4.8, municipis: 18 },
      municipal: { mediana: 4.8, municipis: 18 },
      nota: "Mediana de la mateixa variació als municipis de la mateixa mida.",
    },
    comparacio: {
      grup: { clau: "gran", etiqueta: "de més de 50.000 habitants", mida: 23, ambDada: 22 },
      percentil: 41,
      mediana: 1.612,
    },
    canon: {
      ara: 0.654,
      variacio: null,
      nota:
        "El cànon de l'aigua el fixa la Generalitat, no l'ajuntament: és idèntic el 2023 i el 2025 " +
        "a 913 dels 947 municipis i no compta com a decisió municipal.",
    },
    gestio: {
      subministrament: "Indirecta", clavegueram: "Directa", gestora: "CASSA",
      canvis: [], etiquetes: {},
    },
    tarifaSocial: {
      ara: true, desDe: 2018, creadaAquestMandat: false,
      nota:
        "Una casella buida no està definida al full de l'ACA: no vol dir que el municipi no tingui " +
        "tarifa social, vol dir que la font no ho diu.",
    },
    ...over,
  };
}

function ibi(over: Partial<NonNullable<RadiografiaData["rebutIbi"]>> = {}): NonNullable<
  RadiografiaData["rebutIbi"]
> {
  return {
    font: {
      nom: "Impost de béns immobles de naturalesa urbana (IBI), taula 173",
      organisme: "Idescat, a partir de la Direcció General del Cadastre",
      url: "https://www.idescat.cat/emex/?id=081871#h173",
      llicencia: "Cal enllaçar la pàgina de l'Idescat al costat de la xifra.",
    },
    darrerAny: 2025,
    base: "Rebut mitjà = quota íntegra dividida pels rebuts. No és el tipus impositiu.",
    serie: [
      { any: 2023, provisional: false, valoracio: 2003, rebuts: 118_400, baseImposable: null, quota: null, rebutMitja: 342.1 },
      { any: 2025, provisional: true, valoracio: 2003, rebuts: 119_260, baseImposable: null, quota: null, rebutMitja: 361.7 },
    ],
    rebutMitja: 361.7,
    rebuts: 119_260,
    provisional: true,
    mandat: variacio(2023, 2025, 342.1, 361.7),
    mandatAnterior: null,
    mandatDelGrup: { mediana: 3.9, municipis: 19 },
    comparacio: {
      grup: { clau: "gran", etiqueta: "de més de 50.000 habitants", mida: 23, ambDada: 23 },
      percentil: 58,
      mediana: 348.2,
    },
    revaloracio: { dins: false, anysDeCanvi: [], valoracions: [2003] },
    publicable: true,
    motius: [],
    ...over,
  };
}

function despesa(): NonNullable<RadiografiaData["despesaProgrames"]> {
  const punt = (any: number, perHabitant: number | null, liquidacio = true) => ({
    any,
    liquidacio,
    total: perHabitant === null ? null : Math.round(perHabitant * CENS_2025),
    perHabitant,
    part: perHabitant === null ? null : 6.2,
    habitants: CENS_2025,
  });
  return {
    font: {
      dataset: "liquidacio-programes",
      nom: "Liquidació del pressupost per programes",
      organisme: "Consorci AOC, a partir de les liquidacions dels ens locals",
      portal: "dadesobertes.seu-e.cat",
      classificacio: "Classificació funcional, grups de programa (nivell 3)",
    },
    anys: [2019, 2020, 2021, 2022, 2023, 2024, 2025],
    darrerAny: 2025,
    anyComparable: 2024,
    anysSenseLiquidacio: [],
    total: [{ any: 2025, total: 268_910_400, perHabitant: 1200, fiable: true }],
    programes: [
      {
        codi: "1602",
        nom: "Escombraries i residus",
        nomOrigen: "Recollida, gestió i tractament de residus",
        perque:
          "Quants diners costa recollir les escombraries, que és la despesa que tothom paga per " +
          "taxa i tothom veu passar pel carrer.",
        relatedFix: undefined,
        relacionatAmb: { kind: "residus", camp: "serie[].taxaSelectiva" },
        serie: [punt(2023, 71.2), punt(2024, 78.4), punt(2025, 84.9)],
        darrer: punt(2025, 84.9),
        mandat: variacio(2023, 2025, 71.2, 84.9),
        mandatDelGrup: { fins: 2025, diferencia: 8.1, percentual: 11.4, municipis: 20 },
        mandatAnterior: null,
        comparacio: { percentil: 62, mediana: 79.4, ambDada: 21 },
        cobertura: { ambImport: 830, ambZero: 115, ambLiquidacio: 945 },
      } as unknown as NonNullable<RadiografiaData["despesaProgrames"]>["programes"][number],
      {
        codi: "1502",
        nom: "Habitatge",
        nomOrigen: "Habitatge",
        perque: "552 dels 945 ajuntaments no hi destinen ni un euro mentre el lloguer puja.",
        relacionatAmb: { kind: "habitatge", camp: "serie[].preu" },
        serie: [punt(2023, 4.1), punt(2024, 6.8), punt(2025, 9.3)],
        darrer: punt(2025, 9.3),
        mandat: variacio(2023, 2025, 4.1, 9.3),
        mandatDelGrup: { fins: 2025, diferencia: 0.9, percentual: 14.2, municipis: 20 },
        mandatAnterior: null,
        comparacio: { percentil: 88, mediana: 5.1, ambDada: 19 },
        cobertura: { ambImport: 393, ambZero: 552, ambLiquidacio: 945 },
      } as unknown as NonNullable<RadiografiaData["despesaProgrames"]>["programes"][number],
    ],
    grup: { clau: "gran", etiqueta: "de més de 50.000 habitants", mida: 23, ambLiquidacio: 21 },
    mandat: { actual: 2023, anterior: 2019 },
    base: "Obligacions reconegudes netes, en euros corrents i sense descomptar la inflació.",
    zeroIBuit:
      "«liquidacio: false» vol dir que aquell exercici encara no s'ha liquidat i no en sabem res. " +
      "Un import de 0 € vol dir que l'ajuntament ha presentat els comptes i no hi ha destinat cap euro.",
  };
}

function residus(): NonNullable<RadiografiaData["residus"]> {
  return {
    darrerAny: 2024,
    taxaSelectiva: 48.6,
    kgHabAny: 512,
    serie: [
      { any: 2023, taxaSelectiva: 41.2, kgHabAny: 521 },
      { any: 2024, taxaSelectiva: 48.6, kgHabAny: 512 },
    ],
    mandat: variacio(2023, 2024, 41.2, 48.6),
    mandatDelGrup: { diferencia: 4.9, percentual: 11.1, municipis: 20 },
    comparacio: { percentil: 70, mediana: 44.1, grup: "de més de 50.000 habitants" },
  };
}

function fitxa(over: Partial<RadiografiaData> = {}): RadiografiaData {
  return {
    municipality: {
      id: 1, name: "Sabadell", slug: "sabadell", comarca: "Vallès Occidental",
      provincia: "Barcelona", population: CENS_2025, councilSeats: 27,
      electoralSystem: "llistes tancades", minutesCount: 24, minutesLastDate: "2026-06-30",
    } as unknown as RadiografiaData["municipality"],
    results: {},
    government: null, parity: null, mayors: null, finances: null, history: null,
    taxes: null, transparency: null, singleList: false, revenue: null, spending: null,
    services: null, councilChanges: null, councillors: [], carrecs: null, mocions: null,
    residus: residus(), habitatge: null,
    poblacio: poblacio(), preuAigua: aigua(), rebutIbi: ibi(), despesaProgrames: despesa(),
    amb: null, participation: [], issues: [], generatedAt: "29 d'agost del 2026",
    ...over,
  };
}

describe("qui hi viu", () => {
  const html = renderQuiHiViu(poblacio());

  it("ensenya les dues xifres d'origen i la diferència, sense inventar-ne cap tercera", () => {
    expect(html).toContain("34.062");
    expect(html).toContain("46.870");
    expect(html).toContain("12.808");
    // La suma i la resta no existeixen: cap xifra barrejada no pot sortir mai.
    expect(html).not.toContain("80.932"); // 34.062 + 46.870
    expect(html).not.toMatch(/immigra/i);
  });

  it("diu de cada xifra què compta, amb el text literal de la mètrica", () => {
    expect(html).toContain("Persones que no tenen la nacionalitat espanyola");
    expect(html).toContain("Persones nascudes fora d'Espanya, tinguin la nacionalitat que tinguin");
  });

  it("explica la divergència amb la taula creuada", () => {
    expect(html).toContain("15.780");
    expect(html).toContain("2.970");
  });

  it("diu al costat que això no ho decideix l'ajuntament, no al peu", () => {
    const posicioContext = html.indexOf("no ho decideix l'ajuntament");
    expect(posicioContext).toBeGreaterThan(-1);
    // Va abans de la primera xifra d'origen: si es llegís després, ja s'hauria
    // llegit com un mèrit o com una culpa.
    expect(posicioContext).toBeLessThan(html.indexOf("34.062"));
  });

  it("mostra l'enllaç de l'Idescat de cada municipi, que la llicència obliga", () => {
    expect(html).toContain("https://www.idescat.cat/emex/?id=081871#t75");
    expect(html).toContain("https://www.idescat.cat/emex/?id=081871#t68");
    expect(html).toContain("https://www.idescat.cat/dev/api/condicions/");
  });

  it("no publica res si aquest municipi no té cap enllaç de l'Idescat", () => {
    const sense = poblacio();
    sense.font.enllacosMunicipi = [];
    expect(renderQuiHiViu(sense)).toBe("");
  });

  it("porta l'estructura d'edats que sí que té conseqüències municipals", () => {
    expect(html).toContain("Infants de 0 a 2 anys");
    expect(html).toContain("5.412");
    expect(html).toContain("Persones de 85 anys o més");
    expect(html).toContain("65 anys o més");
    expect(html).toContain("3.190"); // residents a l'estranger
  });

  it("posa el canvi del mandat amb el dels municipis de la seva mida al costat", () => {
    expect(html).toContain("22 municipis de la seva mida");
    expect(html).toContain("als 22 de la seva mida");
  });
});

describe("què paga la gent", () => {
  it("compara pel subministrament i avisa que el total no és el rebut sencer", () => {
    const html = renderQuePaga(aigua(), null);
    expect(html).toContain("1,500 €");
    expect(html).toContain("Subministrament, el tram comparable");
    expect(html).toContain("no els calcula sobre el consum d'aigua");
  });

  it("separa el cànon i diu que no és municipal", () => {
    const html = renderQuePaga(aigua(), null);
    expect(html).toContain("0,654");
    expect(html).toContain("el fixa la Generalitat");
  });

  it("no publica cap variació quan les tarifes no s'han revisat", () => {
    const html = renderQuePaga(
      aigua({
        interpretable: {
          valida: false,
          anyRevisio: 2019,
          motiu: "les tarifes no es revisen des del 2019: que el preu no s'hagi mogut durant el mandat no vol dir que aquest govern hagi decidit no apujar-lo",
        },
      }),
      null,
    );
    expect(html).toContain("no es pot dir si el preu ha pujat");
    expect(html).toContain("les tarifes no es revisen des del 2019");
    expect(html).not.toContain("+7,1 %");
  });

  it("una casella buida de tarifa social no es llegeix mai com un «no»", () => {
    const html = renderQuePaga(
      aigua({
        tarifaSocial: {
          ara: null, desDe: null, creadaAquestMandat: false,
          nota: "Una casella buida no està definida al full de l'ACA: no vol dir que el municipi no tingui tarifa social, vol dir que la font no ho diu.",
        },
      }),
      null,
    );
    expect(html).toContain("la font no en diu res");
    expect(html).toContain("no vol dir que el municipi no tingui tarifa social");
    expect(html).not.toMatch(/no té tarifa social/i);
  });

  it("publica el rebut d'IBI amb l'enllaç obligatori de l'Idescat", () => {
    const html = renderQuePaga(null, ibi());
    expect(html).toContain("362 €");
    expect(html).toContain("119.260 rebuts");
    expect(html).toContain("https://www.idescat.cat/emex/?id=081871#h173");
    expect(html).toContain("dada provisional");
  });

  it("no publica la variació d'IBI quan el que ha canviat és el cadastre", () => {
    const html = renderQuePaga(
      null,
      ibi({
        publicable: false,
        motius: ["hi ha hagut revisió cadastral dins de la finestra (valoracions 2024)"],
      }),
    );
    expect(html).toContain("no en publiquem la variació del mandat");
    expect(html).toContain("revisió cadastral");
  });
});

describe("les escombraries: euros contra resultat", () => {
  const html = renderEscombraries(despesa(), residus());

  it("posa la despesa i la taxa de selectiva a la mateixa taula, any a any", () => {
    expect(html).toContain("84,9 €");
    expect(html).toContain("48,6 %");
    expect(html).toContain("41,2 %");
  });

  it("no confon un any sense dada amb un zero", () => {
    // El 2025 la sèrie de residus no hi arriba: hi ha d'anar un guió, no un 0 %.
    expect(html).toContain('<td class="buit">—</td>');
    expect(html).not.toContain("0,0 %");
    expect(html).toContain("Un import de 0 € vol dir que l'ajuntament ha presentat els comptes");
  });

  it("diu «sense liquidar» i no 0 € quan l'exercici no s'ha liquidat", () => {
    const d = despesa();
    d.programes[0]!.serie = [
      { any: 2023, liquidacio: true, total: 1, perHabitant: 71.2, part: 6.2, habitants: CENS_2025 },
      { any: 2024, liquidacio: false, total: null, perHabitant: null, part: null, habitants: CENS_2025 },
      { any: 2025, liquidacio: false, total: null, perHabitant: null, part: null, habitants: CENS_2025 },
    ];
    const amb = renderEscombraries(d, residus());
    expect(amb).toContain("sense liquidar");
  });

  it("porta els dos canvis del mandat amb el dels seus al costat", () => {
    expect(html).toContain("Despesa en escombraries");
    expect(html).toContain("Recollida selectiva");
    // Cada xifra porta la seva unitat: un «+14» pelat al costat d'un «+8,1» no
    // diu si parla d'euros o de punts.
    expect(html).toContain("+13,7 \u20ac/hab");
    expect(html).toContain("als 20 de la seva mida, +8,1 \u20ac/hab");
    expect(html).toContain("+7,4 punts");
    expect(html).toContain("als 20 de la seva mida, +4,9 punts");
  });
});

describe("com ha anat aquests quatre anys", () => {
  const html = renderRadiografia(fitxa());

  it("hi afegeix l'aigua, l'IBI, la població i els programes de despesa", () => {
    expect(html).toContain("Preu de l'aigua");
    expect(html).toContain("Rebut mitjà d'IBI");
    expect(html).toContain("Gent que hi viu");
    expect(html).toContain("On han posat els diners, servei a servei");
    expect(html).toContain("Escombraries i residus");
  });

  it("expressa la mediana del grup de l'aigua en % i no en euros", () => {
    expect(html).toContain("als 18 de la seva mida,\n             +4,8 %");
  });

  it("no dona cap veredicte sobre el preu de l'aigua ni sobre l'IBI", () => {
    const seccio = html.slice(html.indexOf('id="mandat"'), html.indexOf('id="com-queda"'));
    const files = seccio.split("<li").filter((f) => /aigua|IBI|Gent que hi viu/.test(f));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect(f).not.toMatch(/class="(millora|empitjora)"/);
  });

  it("diu al costat de la població que no la decideix l'ajuntament", () => {
    expect(html).toContain("La població no la decideix l'ajuntament");
  });
});

describe("la fitxa sencera", () => {
  it("es genera sense cap d'aquestes mètriques", () => {
    const buida = renderRadiografia(
      fitxa({ poblacio: null, preuAigua: null, rebutIbi: null, despesaProgrames: null, residus: null }),
    );
    expect(buida).toContain("Sabadell");
    expect(buida).not.toContain('id="qui-hi-viu"');
    expect(buida).not.toContain('id="que-paga"');
    expect(buida).not.toContain('id="escombraries"');
  });

  it("porta els blocs nous a l'índex i es desa per mirar-la", () => {
    const html = renderRadiografia(fitxa());
    expect(html).toContain('<a href="#qui-hi-viu">Qui hi viu</a>');
    expect(html).toContain('<a href="#que-paga">Què paga la gent</a>');
    expect(html).toContain('<a href="#escombraries">Les escombraries</a>');

    const dir = mkdtempSync(join(tmpdir(), "quivoto-radiografia-"));
    const cami = join(dir, "sabadell.html");
    writeFileSync(cami, html, "utf8");
    // Es diu on ha quedat perquè es pugui obrir al navegador i comprovar-hi
    // l'amplada de 320 px, que és l'única manera de saber-ho de veritat.
    console.log(`fitxa de prova: ${cami}`);
    expect(html.length).toBeGreaterThan(5_000);
  });
});
