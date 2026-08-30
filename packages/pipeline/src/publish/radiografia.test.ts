import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  colorDeCandidatura,
  renderEscombraries,
  renderQuePaga,
  renderQuiHiViu,
  renderContractacio,
  renderPapers,
  renderRadiografia,
  renderSous,
  renderTrajectoria,
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
    costGovern: null, transparenciaRetribucions: null, carrecsAcumulats: null, contractacio: null,
    continuitat: null, votPerdut: null, ordenances: null, cartipas: null, organismes: null,
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

describe("què costa el govern, i què se'n pot saber", () => {
  const any = (a: number, total: number, perHabitant: number, parcial = false) => ({
    any: a,
    parcial,
    habitants: 220_000,
    regidories: 27,
    organs: { total, perHabitant, perRegidoria: Math.round(total / 27) },
    dietes: null,
    indemnitzacions: null,
    sospitos: false,
  });
  const cost = (over: Partial<RadiografiaData["costGovern"] & object> = {}) =>
    ({
      serie: [any(2019, 900_000, 4.1), any(2021, 980_000, 4.5), any(2022, 1_020_000, 4.6), any(2023, 1_100_000, 5), any(2024, 1_210_000, 5.5)],
      darrerAnyComplet: 2024,
      darrer: any(2024, 1_210_000, 5.5),
      mandat: { de: 2023, a: 2024, deTotal: 1_100_000, aTotal: 1_210_000, canviPct: 10 },
      medianes: { perHabitant: 4.2, perRegidoria: 38_000 },
      grup: { etiqueta: "de més de 50.000 habitants", mida: 24, ambDada: 21 },
      medianesGrup: { perHabitant: 4.4, perRegidoria: 41_000 },
      font: { nom: "Liquidació del pressupost", dataset: "8squ-bk4r", exercicis: "2019-2025", consultat: "2026-08-29" },
      advertiment: "Euros corrents, sense descomptar la inflació.",
      ...over,
    }) as NonNullable<RadiografiaData["costGovern"]>;

  const transparencia = (over: Record<string, unknown> = {}) =>
    ({
      total: 27, ambXifra: 0, senseXifra: 27, senseCamp: 0, senseFitxa: 0,
      ambAltresRetribucions: 4, ambDietes: 0, ambIndemnitzacions: 0, ambDeclaracioBens: 27,
      publica: "cap", publicaBens: "tots", carrecs: [],
      font: "seu-e.cat (Consorci AOC), mòdul de càrrecs electes",
      url: "https://seu-e.cat/ca/web/sabadell/carrecs-electes",
      consultat: "2026-08-29",
      advertiment: "D'aquests camps només se'n compta la resposta, mai l'import.",
      ...over,
    }) as NonNullable<RadiografiaData["transparenciaRetribucions"]>;

  const acumulats = () =>
    ({
      persones: [
        {
          nom: "Marta Farrés", carrecMunicipal: "Alcaldessa", alcaldia: true,
          altres: [
            {
              ens: "Diputació de Barcelona", tipus: "diputacio", carrec: "Diputada",
              retribucio: {
                anualBrut: 90_940.08, concepte: "retribució anual bruta", dedicacio: "dedicació exclusiva",
                font: { nom: "Diputació de Barcelona", url: "https://www.diba.cat/carrecs", consultat: "2026-08-29" },
              },
              senseRetribucioPublicada: null,
            },
          ],
        },
        {
          nom: "Un Altre Regidor", carrecMunicipal: "Regidor", alcaldia: false,
          altres: [
            {
              ens: "Consell Comarcal del Vallès Occidental", tipus: "comarcal", carrec: "Conseller",
              retribucio: null,
              senseRetribucioPublicada: {
                motiu: "el consell comarcal no publica les retribucions dels seus membres",
                font: { nom: "seu-e", url: "https://seu-e.cat/ca/web/ccvallesoccidental", consultat: "2026-08-29" },
              },
            },
          ],
        },
      ],
      alcaldia: null,
      consultat: "2026-08-29",
      catalunya: {
        alcaldiesAmbSegonCarrec: 214, alcaldiesAmbImportPublicat: 31,
        ensQuePubliquen: 12, ensQueNoPubliquen: 31,
      },
      advertiment: "Cada import és el que publica l'ens que el paga, i només ell.",
    }) as NonNullable<RadiografiaData["carrecsAcumulats"]>;

  it("sense cap de les tres mètriques no hi ha bloc", () => {
    expect(renderSous(null, null, null)).toBe("");
  });

  it("publica el que hi dedica l'ajuntament, per habitant i per regidoria", () => {
    const html = renderSous(cost(), null, null);
    expect(html).toContain("1.210.000 €");
    expect(html).toContain("5,5 €");
    // «Per regidoria» no pot semblar mai el sou d'un regidor.
    expect(html).toContain("no és el que cobra cap regidor");
  });

  it("compara amb el grup de mida i diu quants en són, no amb tot Catalunya", () => {
    const html = renderSous(cost(), null, null);
    expect(html).toContain("de més de 50.000 habitants");
    expect(html).toContain("21 municipis");
    // 5,5 contra la mediana del grup 4,4 són un 25 % per sobre, no contra la
    // catalana de 4,2, que en faria un 31 %.
    expect(html).toContain("25 % per sobre");
  });

  it("dibuixa la forma de la sèrie i no només l'últim any", () => {
    const html = renderSous(cost(), null, null);
    expect(html).toContain('class="espurna"');
    expect(html).toContain("2019");
    expect(html).toContain("Del 2023 al 2024");
  });

  it("un exercici encara per liquidar no entra a la línia", () => {
    const amb = cost({ serie: [...cost().serie, any(2025, 400_000, 1.8, true)] });
    const html = renderSous(amb, null, null);
    // Si el 2025 parcial hi entrés, la línia cauria a plom l'últim any i diria
    // una baixada que no ha passat.
    expect(html).not.toContain("2025,");
  });

  it("de les retribucions no en publica cap euro, ni tan sols quan la font en porta", () => {
    const html = renderSous(null, transparencia(), null);
    expect(html).toContain("Publica una xifra de retribució");
    expect(html).toContain("Aquí no hi ha cap import, i no és un descuit");
    expect(html).not.toMatch(/\d{1,3}\.\d{3},\d{2}\s*€/);
  });

  it("un ajuntament que no publica res surt igualment, dient-ho", () => {
    const html = renderSous(null, transparencia(), null);
    expect(html).toContain(">cap<");
    expect(html).toContain("27 de 27");
  });

  it("quan no s'ha pogut obrir cap fitxa no diu que l'ajuntament no publica", () => {
    const html = renderSous(null, transparencia({ senseFitxa: 27, senseXifra: 0, ambDeclaracioBens: 0, ambAltresRetribucions: 0 }), null);
    expect(html).toContain("no en podem dir ni que publica ni que no publica");
    expect(html).not.toContain("Publica una xifra de retribució");
  });

  it("el segon càrrec porta l'import només quan el publica qui el paga, amb l'enllaç", () => {
    const html = renderSous(null, null, acumulats());
    expect(html).toContain("90.940 €");
    expect(html).toContain("https://www.diba.cat/carrecs");
    expect(html).toContain("no publica les retribucions dels seus membres");
    // I enlloc no hi ha cap suma de les dues administracions.
    expect(html).not.toContain("total");
  });

  it("arriba a la fitxa i a l'índex quan hi ha dades, i no hi és quan no", () => {
    const amb = renderRadiografia(fitxa({ costGovern: cost(), transparenciaRetribucions: transparencia() }));
    expect(amb).toContain('<a href="#sous">Què costa el govern</a>');
    expect(amb).toContain('id="sous"');
    expect(renderRadiografia(fitxa())).not.toContain('id="sous"');
  });
});

describe("què contracta, i amb quanta competència", () => {
  const contractacio = (over: Record<string, unknown> = {}) =>
    ({
      anys: [
        { any: 2025, complet: true, contractes: 412, volum: 18_400_000, volumPerHabitant: 82, licitacions: 64, ofertesMitjana: 2.4, unaOfertaPct: 38 },
        { any: 2026, complet: false, contractes: 190, volum: 7_100_000, volumPerHabitant: 32, licitacions: 28, ofertesMitjana: 2.1, unaOfertaPct: 44 },
      ],
      finestra: { contractes: 602, volum: 25_500_000, licitacions: 92, ofertesMitjana: 2.3, unaOfertaPct: 40, licitacionsAmbOfertes: 78 },
      volumPerHabitant: 82,
      ultimAnyComplet: 2025,
      finestraDates: { desDe: "2025-01-02", finsA: "2026-08-28" },
      comparacio: {
        grup: "de més de 50.000 habitants",
        municipisVolum: 22, percentilVolum: 61, medianaVolum: 74,
        percentilUnaOferta: 78, medianaUnaOferta: 31, municipisUnaOferta: 19,
      },
      font: "Plataforma de Serveis de Contractació Pública (PSCP), via dades obertes de l'AOC",
      fontUrl: "https://dadesobertes.seu-e.cat/",
      detall: "https://contractaciopublica.cat/",
      ...over,
    }) as NonNullable<RadiografiaData["contractacio"]>;

  it("sense contractes no hi ha bloc", () => {
    expect(renderContractacio(null)).toBe("");
    expect(renderContractacio(contractacio({ finestra: { contractes: 0, volum: 0, licitacions: 0, ofertesMitjana: null, unaOfertaPct: null, licitacionsAmbOfertes: 0 } }))).toBe("");
  });

  it("posa el volum, el volum per habitant i la mediana dels de la seva mida", () => {
    const html = renderContractacio(contractacio());
    expect(html).toContain("25.500.000 €");
    expect(html).toContain("602 contractes");
    expect(html).toContain("82 €");
    expect(html).toContain("la mediana dels 22 municipis");
    expect(html).toContain("74 €");
  });

  it("la xifra d'una sola oferta va amb el regle i amb la mediana del grup", () => {
    const html = renderContractacio(contractacio());
    expect(html).toContain("40,0 %");
    expect(html).toContain('class="regle"');
    expect(html).toContain("31,0 %");
    expect(html).toContain("78 licitacions");
  });

  it("no situa el percentatge quan hi ha massa poques licitacions", () => {
    const html = renderContractacio(
      contractacio({
        finestra: { contractes: 12, volum: 90_000, licitacions: 3, ofertesMitjana: 1.3, unaOfertaPct: 67, licitacionsAmbOfertes: 3 },
        comparacio: { grup: "de 1.001 a 2.000 habitants", municipisVolum: 60, percentilVolum: 20, medianaVolum: 120, percentilUnaOferta: null, medianaUnaOferta: 44, municipisUnaOferta: 31 },
      }),
    );
    expect(html).toContain("amb tan poques el percentatge no vol dir res");
    expect(html).not.toContain("67,0 %");
  });

  it("diu que una sola oferta no és cap veredicte, i que la finestra és curta", () => {
    const html = renderContractacio(contractacio());
    expect(html).toContain("no vol dir que res s'hagi fet malament");
    expect(html).toContain("és una finestra curta");
    expect(html).toContain("del 2 de gener del 2025");
  });

  it("no publica cap nom d'adjudicatari i enllaça la plataforma", () => {
    const html = renderContractacio(contractacio());
    expect(html.replace(/\s+/g, " ")).toContain("aquí no es publiquen");
    expect(html).toContain("https://contractaciopublica.cat/");
  });

  it("arriba a la fitxa i a l'índex", () => {
    const html = renderRadiografia(fitxa({ contractacio: contractacio() }));
    expect(html).toContain('<a href="#contractacio">Què contracta</a>');
    expect(html).toContain('id="contractacio"');
    expect(renderRadiografia(fitxa())).not.toContain('id="contractacio"');
  });
});

describe("quant fa que mana el mateix, i quants vots no hi van arribar", () => {
  const ratxa = (over: Record<string, unknown> = {}) => ({
    desDeLegislatura: "2011-2015", desDeAny: 2011, desDe: "2011-06-11",
    anys: 15, legislatures: 4, aproximat: false, ininterromput: false,
    forats: [], aturadaPerDesconegut: false, ...over,
  });
  const continuitat = (over: Record<string, unknown> = {}) =>
    ({
      font: "Alcaldies (Generalitat de Catalunya)",
      anyReferencia: 2026,
      actual: { nom: "Marta Farrés", sigles: "PSC-CP", familia: "psc", legislatura: "2023-2027" },
      partit: { ...ratxa(), sigles: "PSC-CP", familia: "psc" },
      persona: { ...ratxa({ anys: 7, legislatures: 2 }), nom: "MARTA FARRÉS ​FALGUERAS" },
      personesDiferents: 6, forcesDiferents: 3, legislatures: 12,
      primeraLegislatura: "1979-1983", alternances: 2, alternancesDetall: [],
      volatilitat: {
        font: "Resultats electorals (Generalitat de Catalunya)",
        serie: [
          { de: 2015, a: 2019, index: 18.5, fiable: true },
          { de: 2019, a: 2023, index: 24.1, fiable: true },
          { de: 2011, a: 2015, index: 60, fiable: false },
        ],
        ultima: { de: 2019, a: 2023, index: 24.1, fiable: true },
        mitjana: 21.3, trams: 3, tramsFiables: 2,
        comparacio: { percentil: 44, mediana: 23.8, grup: "de més de 50.000 habitants", grupMida: 24 },
      },
      ...over,
    }) as NonNullable<RadiografiaData["continuitat"]>;

  const eleccio = (over: Record<string, unknown> = {}) => ({
    any: 2023, cens: 170_000, emesos: 94_000,
    senseEsco: { vots: 5_400, pct: 5.74, candidatures: 4, mesVotada: { sigles: "AV", vots: 2_100, pct: 2.23 } },
    nuls: { vots: 900, pct: 0.96 },
    blancs: { vots: 1_200, pct: 1.28 },
    nulsIBlancs: { vots: 2_100, pct: 2.23 },
    total: { vots: 7_500, pct: 7.98 },
    quadra: true,
    ...over,
  });
  const votPerdut = (over: Record<string, unknown> = {}) =>
    ({
      font: "Resultats electorals (Generalitat de Catalunya)",
      eleccions: { M20231: eleccio(), M20191: eleccio({ any: 2019, total: { vots: 6_100, pct: 6.6 } }) },
      darrera: "M20231",
      regidorsEquivalents: 2.2,
      variacioDesDel2019: 1.38,
      comparacio: { percentil: 71, mediana: 6.4, grup: "de més de 50.000 habitants", grupMida: 24 },
      ...over,
    }) as NonNullable<RadiografiaData["votPerdut"]>;

  it("sense cap de les dues mètriques no hi ha bloc", () => {
    expect(renderTrajectoria(null, null)).toBe("");
  });

  it("diu els anys de la ratxa, les legislatures i les alternances", () => {
    const html = renderTrajectoria(continuitat(), null);
    expect(html).toContain("PSC-CP");
    expect(html).toContain("15 anys");
    expect(html).toContain("4 legislatures seguides");
    expect(html).toContain("2 alternances");
    expect(html).toContain("6 persones diferents");
  });

  it("una ratxa amb forats no es publica com si fos ininterrompuda", () => {
    // Torroella de Fluvià: la font no registra cap alcalde de dues
    // legislatures, i «des de la primera que consta» seria una afirmació que la
    // font no sosté.
    const html = renderTrajectoria(
      continuitat({ partit: { ...ratxa({ ininterromput: true, forats: ["1983-1987", "1995-1999"] }), sigles: "PSC-CP", familia: "psc" } }),
      null,
    );
    expect(html).not.toContain("des de la primera legislatura que consta");
    expect(html).toContain("2 legislatures de les quals la font no registra cap alcalde");
  });

  it("quan la data d'inici s'ha deduït, ho diu", () => {
    const html = renderTrajectoria(
      continuitat({ partit: { ...ratxa({ aproximat: true }), sigles: "PSC-CP", familia: "psc" } }),
      null,
    );
    expect(html).toContain("no publica la data de constitució");
  });

  it("la volatilitat només compta els trams fiables i diu quants en són", () => {
    const html = renderTrajectoria(continuitat(), null);
    expect(html).toContain("21,3 de cada 100 escons");
    expect(html).toContain("2 de 3 trams");
    expect(html).toContain("23,8");
  });

  it("el vot perdut porta els vots, el percentatge i les regidories equivalents", () => {
    const html = renderTrajectoria(null, votPerdut());
    expect(html).toContain("7.500 vots");
    // Un decimal, com la resta de percentatges de la fitxa: barrejar precisions
    // fa que dues xifres del mateix bloc semblin de fonts diferents.
    expect(html).toContain("8,0 %");
    expect(html).toContain("2,2 regidories");
    expect(html).toContain("+1,4 punts");
  });

  it("quan els vots per candidatura no quadren, només diu els nuls i els blancs", () => {
    const html = renderTrajectoria(
      null,
      votPerdut({ eleccions: { M20231: eleccio({ total: null, quadra: false }) }, regidorsEquivalents: null, variacioDesDel2019: null }),
    );
    expect(html).toContain("no en podem donar la xifra sencera");
    expect(html).toContain("2.100 vots");
    expect(html).not.toContain("regidories</b>");
  });

  it("no dona cap veredicte sobre el vot que no arriba al ple", () => {
    const html = renderTrajectoria(null, votPerdut());
    expect(html).toContain("No és cap defecte del sistema ni cap veredicte");
  });

  it("arriba a la fitxa i a l'índex", () => {
    const html = renderRadiografia(fitxa({ continuitat: continuitat(), votPerdut: votPerdut() }));
    expect(html).toContain('<a href="#trajectoria">Quant fa que mana el mateix</a>');
    expect(html).toContain('id="trajectoria"');
    expect(renderRadiografia(fitxa())).not.toContain('id="trajectoria"');
  });
});

describe("els papers d'aquest mandat", () => {
  const cartipas = (over: Record<string, unknown> = {}) =>
    ({
      titol: "Cartipàs municipal per al mandat 2023-2027",
      data: "2023-07-14", enllac: "https://cido.diba.cat/cartipas/sabadell.pdf",
      mandat: "2023-2027",
      font: "Cartipàs: organització política (CIDO), via dades obertes de l'AOC",
      fontUrl: "https://dadesobertes.seu-e.cat/cartipas",
      ...over,
    }) as NonNullable<RadiografiaData["cartipas"]>;

  const ordenances = () =>
    ({
      mandat: 34, desDe: "2023-06-17",
      ultimes: [
        { titol: "Ordenança de convivència", data: "2026-05-12", enllac: "https://cido.diba.cat/o/1" },
        { titol: "Reglament de participació", data: "2026-02-03", enllac: null },
      ],
      font: "Ordenances reguladores i reglaments (CIDO), via dades obertes de l'AOC",
      fontUrl: "https://dadesobertes.seu-e.cat/ordenances",
    }) as NonNullable<RadiografiaData["ordenances"]>;

  const organismes = () =>
    ({
      total: 3,
      perTipus: { "Societats mercantils 100% municipals": 2, Consorcis: 1 },
      organismes: [
        { nom: "Aigües de Sabadell SA", tipus: "Societats mercantils 100% municipals", relacio: "Dependent" },
        { nom: "Promoció Econòmica SA", tipus: "Societats mercantils 100% municipals", relacio: "Dependent" },
        { nom: "Consorci del Riu Ripoll", tipus: "Consorcis", relacio: "Vinculat" },
      ],
      font: "Organismes dependents o vinculats, dades obertes de l'AOC",
      fontUrl: "https://dadesobertes.seu-e.cat/organismes",
    }) as NonNullable<RadiografiaData["organismes"]>;

  it("sense cap dels tres no hi ha res", () => {
    expect(renderPapers(null, null, null)).toBe("");
  });

  it("el cartipàs va amb l'enllaç al document oficial i la data", () => {
    const html = renderPapers(cartipas(), null, null);
    expect(html).toContain("https://cido.diba.cat/cartipas/sabadell.pdf");
    expect(html).toContain("14 de juliol del 2023");
  });

  it("un cartipàs sense enllaç ho diu i no en fabrica cap", () => {
    const html = renderPapers(cartipas({ enllac: null }), null, null);
    expect(html).toContain("la font no en dona l'enllaç");
    expect(html).not.toContain("<a href=\"\"");
  });

  it("les ordenances porten el compte del mandat i les últimes amb enllaç", () => {
    const html = renderPapers(null, ordenances(), null);
    expect(html).toContain("<b>34</b>");
    expect(html).toContain("des del 2023");
    expect(html).toContain("Ordenança de convivència");
    expect(html).toContain("12 de maig del 2026");
  });

  it("els organismes es diuen com a perímetre i sense cap import", () => {
    const html = renderPapers(null, null, organismes());
    expect(html).toContain("<b>3</b>");
    expect(html).toContain("Aigües de Sabadell SA");
    expect(html).toContain("no és a la liquidació de l'ajuntament");
    expect(html).toContain("la font no en dona cap");
    expect(html).not.toContain("€");
  });

  it("va al bloc de què en sabem i què no, quan hi ha alguna cosa", () => {
    const html = renderRadiografia(fitxa({ cartipas: cartipas(), organismes: organismes() }));
    expect(html).toContain("Els papers d'aquest mandat");
    expect(renderRadiografia(fitxa())).not.toContain("Els papers d'aquest mandat");
  });

  it("ja no diu a tothom que no hem llegit cap acta", () => {
    const ambActes = renderRadiografia(
      fitxa({
        mocions: {
          actes: { indexades: 24, llegides: 21, fallides: 1, darrera: "2026-06-30" },
        } as unknown as RadiografiaData["mocions"],
      }),
    );
    expect(ambActes).toContain("n'hem llegit <b>21</b>");
    expect(ambActes).not.toContain("no n'hem llegit cap");
    // I on no se n'han llegit, es diu per què i no com si fos una promesa buida.
    expect(renderRadiografia(fitxa())).toContain("indexades però no llegides");
  });
});

describe("dones i homes: el denominador ha de ser el ple", () => {
  const paritat = (over: Record<string, unknown> = {}) =>
    ({
      candidates: 297, womenCandidates: 144, womenCandidatesPct: 48,
      elected: 27, womenElected: 14, womenElectedPct: 52,
      heads: 11, womenHeads: 5, expectedElected: 27, complet: true,
      ...over,
    }) as unknown as RadiografiaData["parity"];

  it("publica el percentatge quan la llista d'electes quadra amb el ple", () => {
    const html = renderRadiografia(fitxa({ parity: paritat() }));
    expect(html).toContain("14 de 27 regidories");
    expect(html).not.toContain("Sense dada");
  });

  it("no publica cap percentatge quan la font en dona menys d'electes que regidories", () => {
    // Abella de la Conca: cinc regidories i dues persones al conjunt. El «50 %»
    // que en sortia era una de dues, i es llegia com la meitat del ple.
    const html = renderRadiografia(
      fitxa({
        parity: paritat({
          elected: 2, womenElected: 1, womenElectedPct: 50, expectedElected: 5, complet: false,
          candidates: 3, womenCandidates: 1, womenCandidatesPct: 33, heads: 0, womenHeads: 0,
        }),
      }),
    );
    expect(html.replace(/\s+/g, " ")).toContain("només en dona 2 persones electes de les 5 regidories");
    expect(html).not.toContain(">50 %<");
    // I tampoc no s'hi compara: la mediana del grup no el compta.
    expect(html).toContain("no hi entra ni s'hi compara");
  });

  it("una fitxa antiga sense el camp nou continua publicant-se", () => {
    // Les mètriques desades abans d'aquest canvi no porten `complet`; el que no
    // pot passar és que la fitxa es quedi muda esperant un camp que no hi és.
    const { expectedElected, complet, ...vell } = paritat() as Record<string, unknown>;
    void expectedElected;
    void complet;
    const html = renderRadiografia(fitxa({ parity: vell as RadiografiaData["parity"] }));
    expect(html).toContain("14 de 27 regidories");
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

  it("cada enllaç de l'índex porta a una secció que existeix", () => {
    // El seguidor que marca on ets busca cada secció per l'id de l'enllaç. Si
    // un bloc canvia d'id i l'índex no, l'enllaç deixa de portar enlloc i el
    // rail es queda mut: no peta res i no ho veu ningú fins que es fa scroll.
    const html = renderRadiografia(fitxa());
    // Des de l'índex fins al SEU tancament: la capçalera compartida també porta
    // un <nav> (el menú) i va abans, de manera que el primer </nav> del document
    // no és el d'aquí.
    const on = html.indexOf('<nav class="index"');
    const index = html.slice(on, html.indexOf("</nav>", on));
    const ancores = [...index.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]!);
    expect(ancores.length).toBeGreaterThan(3);
    for (const ancora of ancores) expect(html, ancora).toContain(`id="${ancora}"`);
  });

  it("la fitxa continua sent llegible sense el JavaScript que marca la secció", () => {
    const html = renderRadiografia(fitxa());
    // El guió és l'únic de la pàgina i no hi ha d'haver res que en depengui:
    // ni un bloc amagat d'entrada, ni un enllaç que només funcioni amb ell.
    expect(html).toContain("IntersectionObserver");
    const sensePlom = html.replace(/<script>[\s\S]*?<\/script>/g, "");
    expect(sensePlom).toContain('<nav class="index"');
    expect(sensePlom).toContain('href="#participacio"');
    // Cap secció no arriba amagada esperant que el guió l'obri.
    expect(sensePlom).not.toMatch(/<section[^>]*\bhidden\b/);
    expect(sensePlom).not.toMatch(/<section[^>]*display:\s*none/);
  });
});

describe("la mediana del grup", () => {
  const participacio = [
    { electionId: "M20231", censusSize: 1000, voters: 600, blankVotes: 5 },
  ] as unknown as RadiografiaData["participation"];

  it("compara la participació amb la mediana dels municipis de la mateixa mida", () => {
    const html = renderRadiografia(fitxa({ participation: participacio }), [], new Map(), {
      participacio: {
        M20231: { mediana: 51.5, quants: 24, etiqueta: "de més de 50.000 habitants", percentil: 88, valors: [] },
      },
      donesAlPle: null,
    });
    expect(html).toContain("60,0 %");
    // La diferència va en punts, no en percentatge del percentatge: de 51,5 a
    // 60,0 són 8,5 punts, i mai «un 16 % més».
    expect(html).toContain("+8,5 punts per sobre de la mediana");
    expect(html).toContain("24 municipis de més de 50.000 habitants");
    expect(html).toContain("(51,5 %)");
  });

  it("sense mediana, la xifra surt sola i no se'n inventa cap", () => {
    const html = renderRadiografia(fitxa({ participation: participacio }));
    expect(html).toContain("60,0 %");
    expect(html).not.toContain("mediana dels");
  });
});

/**
 * El color d'una candidatura no el pot decidir una dada desada que ha
 * envellit: a la taula de les tres últimes eleccions de Barcelona sortien
 * «BARCELONA EN COMÚ-ECG», «BCN Canvi-Cs» i «JUNTS» de color mort, i el PP en
 * dos blaus diferents segons l'any.
 */
describe("de quin color va cada candidatura", () => {
  const fes = (sigles: string, brandId: string | null, color: string | null) =>
    colorDeCandidatura({ sigles, brandId, color } as never);

  it("mana la marca, i no el color que la font dona a cada convocatòria", () => {
    // El PP arriba amb blaus diferents el 2019 i el 2023; a la taula n'ha de fer un.
    expect(fes("PP", "pp", "#01a7e3")).toBe(fes("PP", "pp", "#234b90"));
  });

  it("dedueix la família de les sigles quan la ingesta no en va desar cap", () => {
    expect(fes("BARCELONA EN COMÚ-ECG", null, null)).toBe(fes("ECP", "comuns", null));
    expect(fes("JUNTS", null, null)).toBe(fes("Junts", "junts", null));
  });

  it("«local» no atura la pregunta: és el calaix de les no reconegudes", () => {
    // «BCN Canvi-Cs» hi era desada i es quedava grisa tot i ser Ciutadans.
    expect(fes("BCN Canvi-Cs", "local", null)).toBe(fes("C's", "cs", null));
  });

  it("una llista local de debò es queda amb el seu color, o amb el gris", () => {
    expect(fes("Som-hi Matadepera", "local", "#0a7d5e")).toBe("#0a7d5e");
    expect(fes("Som-hi Matadepera", "local", null)).toBe("#8b8b8b");
  });
});
