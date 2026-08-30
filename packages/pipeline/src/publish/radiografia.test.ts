import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  colorDeCandidatura,
  pastillesContext,
  renderEscombraries,
  renderQuantGasta,
  renderQuePaga,
  renderQuiHiViu,
  renderContractacio,
  renderPapers,
  renderRadiografia,
  renderSous,
  renderTrajectoria,
  type RadiografiaData,
} from "./radiografia";
import {
  LLICENCIA_INTERIOR, NOTA_COMPETENCIES, NOTA_FETS_CONEGUTS, NOTA_LLINDAR,
} from "../jobs/j29-criminalitat";

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
      // Els anys que J18 demana de debò del padró: els tres inicis de mandat i
      // la sèrie recent. Els del mig no hi són perquè no es demanen, no perquè
      // l'Idescat no els publiqui —el padró hi és des del 1998—, i la fitxa ho
      // ha de dir així. Si algú allarga SERIE_PADRO, aquesta prova ha de canviar.
      indicador("padroHabitants", "Persones empadronades", "persones",
        "Persones inscrites al padró municipal d'habitants a 1 de gener. Compta empadronats, no residents.",
        224_512, { emex: null, enllac: null, serie: [
          { any: 2015, valor: 207_814 },
          { any: 2019, valor: 213_644 },
          { any: 2021, valor: 216_204 },
          { any: 2022, valor: 218_100 },
          { any: 2023, valor: 220_312 },
          { any: 2024, valor: 222_400 },
          { any: 2025, valor: 224_512 },
        ] }),
      // El cens arrenca el 2021 i abans no existeix: és el motiu pel qual els
      // percentatges d'aquest bloc no poden anar més enrere.
      indicador("censHabitants", "Població censada", "persones",
        "Població resident segons el Cens de població anual de l'INE a 1 de gener.",
        CENS_2025, {
          mandat: variacio(2023, 2025, 216_204, CENS_2025),
          mandatDelGrup: { fins: 2025, diferencia: 1_240, percentual: 2.1, municipis: 22 },
          serie: [
            { any: 2021, valor: 214_900 },
            { any: 2022, valor: 217_800 },
            { any: 2023, valor: 216_204 },
            { any: 2024, valor: 221_050 },
            { any: 2025, valor: CENS_2025 },
          ],
        }),
      indicador("nacionalitatEstrangera", "Persones de nacionalitat estrangera", "persones",
        "Persones que no tenen la nacionalitat espanyola. NO és el mateix que haver nascut fora.",
        34_062, { emex: "t75", enllac: enllac("t75", "Població per nacionalitat") }),
      indicador("pctNacionalitatEstrangera", "Pes de la població de nacionalitat estrangera", "%",
        "Persones sense nacionalitat espanyola sobre el total de població censada.",
        15.2, { emex: "t75", enllac: enllac("t75", "Població per nacionalitat"),
          catalunya: { valor: 17.4, mandat: null },
          serie: [
            { any: 2021, valor: 12.7 },
            { any: 2022, valor: 13.3 },
            { any: 2023, valor: 13.9 },
            { any: 2024, valor: 14.6 },
            { any: 2025, valor: 15.2 },
          ] }),
      indicador("nascutsAEstranger", "Persones nascudes a l'estranger", "persones",
        "Persones nascudes fora d'Espanya, tinguin la nacionalitat que tinguin. NO és el mateix que ser estranger.",
        46_870, { emex: "t68", enllac: enllac("t68", "Població per lloc de naixement") }),
      indicador("pctNascutsAEstranger", "Pes de la població nascuda a l'estranger", "%",
        "Persones nascudes fora d'Espanya sobre el total de població censada.",
        20.9, { emex: "t68", enllac: enllac("t68", "Població per lloc de naixement"),
          catalunya: { valor: 22.6, mandat: null },
          serie: [
            { any: 2021, valor: 18.4 },
            { any: 2022, valor: 19.3 },
            { any: 2023, valor: 19.8 },
            { any: 2024, valor: 20.4 },
            { any: 2025, valor: 20.9 },
          ] }),
      indicador("pct65iMes", "Pes de la població de 65 anys o més", "%",
        "Persones de 65 anys o més sobre el total de població censada, tal com ho calcula l'Idescat.",
        18.9, { emex: "t25", enllac: enllac("t25", "Població per grups d'edat"),
          mandat: variacio(2023, 2025, 18.3, 18.9),
          mandatDelGrup: { fins: 2025, diferencia: 0.4, percentual: 2.2, municipis: 22 },
          catalunya: { valor: 19.7, mandat: null } }),
      indicador("pct0a15", "Pes de la població de 0 a 15 anys", "%",
        "Persones de 0 a 15 anys sobre el total de població censada, tal com ho calcula l'Idescat.",
        16.4, { emex: "t25", enllac: enllac("t25", "Població per grups d'edat"),
          mandat: variacio(2023, 2025, 17.2, 16.4),
          mandatDelGrup: { fins: 2025, diferencia: -0.5, percentual: -2.9, municipis: 22 },
          catalunya: { valor: 15.9, mandat: null },
          serie: [
            { any: 2021, valor: 18.4 },
            { any: 2022, valor: 17.8 },
            { any: 2023, valor: 17.2 },
            { any: 2024, valor: 16.8 },
            { any: 2025, valor: 16.4 },
          ] }),
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
    // El 2023 no s'ha liquidat: no és un zero, és un forat, i la sèrie l'ha de
    // dibuixar com un forat. La resta és la sèrie sencera des del 2019.
    anysSenseLiquidacio: [2023],
    total: [
      { any: 2019, total: 240_818_900, perHabitant: 1075, fiable: true },
      { any: 2020, total: 233_055_680, perHabitant: 1040, fiable: true },
      { any: 2021, total: 251_783_320, perHabitant: 1124, fiable: true },
      { any: 2022, total: 259_770_540, perHabitant: 1159, fiable: true },
      { any: 2024, total: 265_101_320, perHabitant: 1183, fiable: true },
      { any: 2025, total: 268_910_400, perHabitant: 1200, fiable: true },
    ],
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

/**
 * El que desa J8 a «spending»: el repartiment per àrees i, sobretot, la mediana
 * del total als municipis de la mateixa mida. Sense aquesta mediana la xifra
 * gran del bloc no es pot jutjar, i per això la prova la porta.
 */
function gasta(over: Partial<NonNullable<RadiografiaData["spending"]>> = {}): NonNullable<
  RadiografiaData["spending"]
> {
  return {
    year: 2025,
    areas: [
      { label: "Serveis públics bàsics", perHead: 430, total: 96_359_560, share: 35.8 },
      { label: "Administració general", perHead: 320, total: 71_709_440, share: 26.7 },
      { label: "Educació, cultura i esport", perHead: 250, total: 56_023_000, share: 20.8 },
      { label: "Protecció i promoció social", perHead: 200, total: 44_818_400, share: 16.7 },
    ],
    totalPerHead: 1200,
    medians: {},
    grup: { etiqueta: "de més de 50.000 habitants", mida: 23, ambDada: 21 },
    medianesGrup: null,
    totalMediaGrup: 1050,
    poblacio: CENS_2025,
    autofinancament: { pct: 58, medianaGrup: 54 },
    ...over,
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

/** Els comptes de J8, amb el deute al percentil 40 del seu grup. */
function finances(): NonNullable<RadiografiaData["finances"]> {
  const punt = (year: number, debtPerHead: number) => ({
    year, debtPerHead, netSavingPct: 8.2, financialLoadPct: 4.1, investmentPerHead: 120,
    investmentExecutionPct: 61, personnelPct: 38, paymentDays: 28, investmentUnspent: 4_000_000,
  });
  return {
    year: 2025,
    indicators: [
      { key: "deute-habitant", label: "Deute per habitant", value: 450, unit: "euros", level: "bo", note: "deute viu" },
    ],
    debtSeries: [
      { year: 2019, perHead: 620 }, { year: 2021, perHead: 560 }, { year: 2023, perHead: 500 }, { year: 2025, perHead: 450 },
    ],
    comparison: [
      { key: "deute-habitant", value: 450, lowerIsBetter: true, groupLabel: "de més de 50.000 habitants", groupSize: 23, median: 520, percentile: 40, rank: null, floorShare: null },
      { key: "estalvi-net", value: 8.2, lowerIsBetter: false, groupLabel: "de més de 50.000 habitants", groupSize: 23, median: 6, percentile: 70, rank: null, floorShare: null },
      { key: "pmp", value: 28, lowerIsBetter: true, groupLabel: "de més de 50.000 habitants", groupSize: 23, median: 32, percentile: 35, rank: null, floorShare: null },
    ],
    points: [punt(2023, 500), punt(2024, 470), punt(2025, 450)],
    mandates: [
      { id: "2023-2027", label: "2023-2027", years: [2023, 2024, 2025], expected: 4, first: punt(2023, 500), last: punt(2025, 450), delta: {}, investmentUnspentTotal: 12_000_000 },
    ],
    bands: [{ id: "2023-2027", from: 2023, to: 2027, mayor: "Marta Farrés", party: "PSC" }],
    group: { label: "de més de 50.000 habitants", size: 23 },
    incomeCurrent: 250_000_000,
    population: CENS_2025,
  };
}

/** El govern de Sabadell: la llista més votada, amb majoria absoluta. */
function govern(over: Partial<NonNullable<RadiografiaData["government"]>> = {}): NonNullable<RadiografiaData["government"]> {
  return {
    mayorName: "Marta Farrés Falgueras", mayorPartyRaw: "PSC-CP", mayorSigles: "PSC-CP", mayorSeats: 14,
    winnerSigles: "PSC-CP", winnerSeats: 14, totalSeats: 27, majority: 14,
    winnerHasMajority: true, winnerGoverns: true,
    effectiveParties: 3.2, mayorMatchMethod: "exact", mayorMatchConfidence: 1,
    ...over,
  };
}

/** Els tipus que vota el ple, tal com els desa J8: sense cap mediana que compti. */
function taxes(): NonNullable<RadiografiaData["taxes"]> {
  return {
    year: 2025,
    taxes: {
      ibi: { label: "Tipus general d'IBI urbà", value: 0.52, unit: "%" },
      iae: { label: "Coeficient de l'IAE", value: 1.3, unit: "" },
      ivtm: { label: "Impost de vehicles, turisme de 12 a 16 CV", value: 120.5, unit: "€" },
      cadastre: { label: "Última revisió cadastral", value: 2003, unit: "any" },
    },
    medians: {},
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
    poblacio: poblacio(), riquesa: null, criminalitat: null, preuAigua: aigua(), rebutIbi: ibi(), despesaProgrames: despesa(),
    costGovern: null, transparenciaRetribucions: null, carrecsAcumulats: null, contractacio: null,
    retribucions: null, sousDiputacions: null, imatges: null,
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
    expect(html).toContain("infants de 0 a 2 anys");
    expect(html).toContain("5.412");
    expect(html).toContain("de 85 anys o més");
    expect(html).toContain("7.104");
    expect(html).toContain("65 anys o més");
    expect(html).toContain("3.190"); // residents a l'estranger
    // Els tres recomptes van en una línia, cadascun amb el seu enllaç.
    const linia = html.slice(html.indexOf('class="nota-linia tambe"'), html.indexOf("</p>", html.indexOf('class="nota-linia tambe"')));
    expect(linia.match(/class="font-idescat"/g)?.length).toBe(3);
  });

  it("són cinc tires amb espurna, i una sola lletra petita", () => {
    expect(html).toContain('<ul class="tires gent-tires">');
    expect(html.match(/<li class="tira">/g)?.length).toBe(5);
    expect(html).toContain('<span class="etq">Empadronats</span>');
    expect(html).toContain('<span class="etq">Edat mitjana</span>');
    // Cada tira porta el seu enllaç de l'Idescat, que la llicència obliga.
    const tires = html.slice(html.indexOf('<ul class="tires'), html.indexOf("</ul>", html.indexOf('<ul class="tires')));
    expect(tires.match(/class="font-idescat"/g)?.length).toBe(5);
    expect(html.match(/<details class="nota">/g)?.length).toBe(1);
    // I la sèrie gran del padró ja no hi és.
    expect(html).not.toContain('class="grafic serie');
  });

  it("posa el canvi del mandat amb el dels municipis de la seva mida al costat", () => {
    expect(html).toContain("22 municipis de la seva mida");
    expect(html).toContain("als 22 de la seva mida");
  });
});

describe("qui hi viu: percentatges i tants anys com en tenim", () => {
  const html = renderQuiHiViu(poblacio());

  it("la xifra gran de l'origen és el percentatge, i el recompte queda a sota", () => {
    // Un recompte no es pot comparar amb res: ni amb el poble del costat ni amb
    // el mateix poble fa quatre anys, que tenia una altra població.
    expect(html).toContain('<span class="xifra">15,2 %</span>');
    // La segona xifra de l'origen viu a la lletra petita, amb el seu pes.
    expect(html).toContain("20,9 %");
    // I el recompte no marxa: és el que hi ha darrere del tant per cent.
    expect(html).toContain("34.062 persones");
    expect(html).toContain("46.870 persones");
  });

  it("l'espurna de l'origen dibuixa el percentatge i no el recompte", () => {
    // En un poble que creix, la línia dels recomptes puja encara que el pes
    // baixi, i llavors el dibuix diu el contrari que la xifra que té a sobre.
    expect(html).toContain("2021, 12,7 %");
    expect(html).toContain("2025, 15,2 %");
    expect(html).not.toContain("2021, 33.040");
  });

  it("l'espurna dels empadronats és la del padró, que és la sèrie que va més enrere", () => {
    const tira = html.slice(html.indexOf('<span class="etq">Empadronats</span>'), html.indexOf("</li>", html.indexOf('<span class="etq">Empadronats</span>')));
    expect(tira).toContain('<span class="xifra">224.512</span>');
    expect(tira).toContain("2015, 207.814");
    expect(tira).toContain("2025, 224.512");
    // El cens hi és al costat, perquè les dues xifres no es confonguin.
    expect(tira).toContain("el cens en compta 224.092");
  });

  it("diu que els anys que falten del padró no els demanem, i que la font els té", () => {
    // La diferència és tota: si es diguessin «anys que la font no publica»,
    // estaríem carregant a l'Idescat una decisió d'ingesta nostra.
    expect(html).toContain("2016, 2017, 2018 i 2020");
    expect(html).toContain("des del 1998");
    expect(html).not.toMatch(/2016[^<]{0,80}la font no publica/);
  });

  it("diu per què els percentatges no poden anar més enrere", () => {
    expect(html).toContain("any a any des del 2021");
    expect(html).toContain("El padró sí que hi va, i és l'única sèrie d'aquest bloc que s'ha pogut allargar");
  });

  it("porta el pes de 0 a 15 anys, que la dada ja tenia i la fitxa no ensenyava", () => {
    expect(html).toContain("Pes de la població de 0 a 15 anys");
    expect(html).toContain("16,4 %");
    // Els pesos van abans dels recomptes: un pes es compara i un recompte no.
    expect(html.indexOf("Pes de la població de 0 a 15 anys")).toBeLessThan(
      html.indexOf("infants de 0 a 2 anys"),
    );
  });
});

/**
 * La renda: J23 desa el rang a Catalunya ja calculat sobre tota la
 * distribució, i la fitxa el diu en paraules al bloc de «Qui hi viu», sempre
 * amb el «no ho decideix l'ajuntament» al costat.
 */
describe("la renda: on cau el poble, dit en paraules", () => {
  const riquesa = (rang = 214): NonNullable<RadiografiaData["riquesa"]> => ({
    font: {
      ine: {
        organisme: "Institut Nacional d'Estadística (INE)",
        conjunt: "Atlas de distribución de renta de los hogares (ADRH)",
        extret: "2026-08-29",
      },
    },
    context: {
      decideixLAjuntament: false,
      nota:
        "Un ajuntament no decideix quant guanya la gent que hi viu. La renda depèn de qui hi viu, de " +
        "què hi treballa i de com va l'economia.",
      sensePostEleccions:
        "La sèrie acaba el 2023, que és l'any en què es va constituir aquest ajuntament.",
    },
    any: 2023,
    cobertura: {
      municipisAmbDada: 927,
      de: 947,
      nota: "L'INE tapa per secret estadístic la renda dels municipis més petits.",
    },
    indicadors: [
      {
        clau: "rendaNetaPersona",
        etiqueta: "Renda neta per persona",
        unitat: "€",
        nota: "Renda neta mitjana per persona.",
        any: 2023,
        valor: 14_500,
        darrerAnyPropi: 2023,
        serie: [
          { any: 2019, valor: 13_100 },
          { any: 2020, valor: 13_050 },
          { any: 2021, valor: 13_600 },
          { any: 2022, valor: 14_000 },
          { any: 2023, valor: 14_500 },
        ],
        variacio: null,
        comparacio: null,
        catalunya: {
          rang,
          de: 927,
          percentil: 77,
          medianaMunicipal: 13_100,
          diferencia: 1_400,
          percentual: 10.7,
          nota: "Mediana dels municipis catalans amb dada, no la renda de Catalunya.",
        },
      },
    ],
  });

  it("la sisena tira diu el lloc a Catalunya en paraules, la font i que no ho decideix l'ajuntament", () => {
    const html = renderQuiHiViu(poblacio(), riquesa());
    expect(html.match(/<li class="tira">/g)?.length).toBe(6);
    expect(html).toContain("Renda neta per persona");
    expect(html).toContain("14.500 €");
    expect(html).toContain("el 214è de 927 municipis amb dada");
    expect(html).toContain("INE, 2023");
    expect(html).toContain("Un ajuntament no decideix quant guanya la gent que hi viu");
    // L'espurna dibuixa la sèrie, i la lletra petita diu el que no es veu a la
    // xifra: que la sèrie s'atura l'any de les eleccions, i qui tapa els buits.
    expect(html).toContain("2019, 13.100 €");
    expect(html).toContain("La sèrie acaba el 2023");
    expect(html).toContain("secret estadístic");
    expect(html).toContain("no la renda de Catalunya");
  });

  it("els ordinals s'escriuen com es diuen: el 1r, el 4t, l'11è", () => {
    expect(renderQuiHiViu(poblacio(), riquesa(1))).toContain("el 1r de 927 municipis");
    expect(renderQuiHiViu(poblacio(), riquesa(4))).toContain("el 4t de 927 municipis");
    expect(renderQuiHiViu(poblacio(), riquesa(11))).toContain("l'11è de 927 municipis");
  });

  it("sense la mètrica o sense valor no hi ha tira, i a la fitxa sencera va dins de «Qui hi viu»", () => {
    expect(renderQuiHiViu(poblacio(), null).match(/<li class="tira">/g)?.length).toBe(5);
    const tapat = riquesa();
    tapat.indicadors[0]!.valor = null;
    expect(renderQuiHiViu(poblacio(), tapat)).not.toContain("Renda neta per persona");
    const html = renderRadiografia(fitxa({ riquesa: riquesa() }));
    const on = html.indexOf('id="qui-hi-viu"');
    expect(html.slice(on, html.indexOf("<section", on))).toContain("el 214è de 927 municipis amb dada");
  });
});

describe("quant gasta l'ajuntament, en total i per habitant", () => {
  const html = renderQuantGasta(despesa(), gasta());

  it("diu el total i el que surt per habitant", () => {
    expect(html).toContain("268.910.400 €");
    expect(html).toContain("1.200 €");
    expect(html).toContain("224.092 habitants");
  });

  it("avisa que això és una liquidació i no un pressupost", () => {
    // No són la mateixa cosa: el pressupost és el que el ple aprova, la
    // liquidació és el que s'ha acabat gastant. Barrejar-los seria un error.
    expect(html).toContain("Això és una liquidació, no un pressupost");
    expect(html).toContain("modificacions de l'exercici incloses");
  });

  it("compara amb els municipis de la seva mida, i ho diu en euros del total", () => {
    expect(html).toContain("de més de 50.000 habitants");
    expect(html).toContain("1.050 € per habitant");
    // (1.200 − 1.050) × 224.092 habitants = 33.613.800 €.
    expect(html).toContain("33.613.800 €");
    expect(html).toContain("més petita");
  });

  it("sense mediana del grup no s'inventa cap comparació", () => {
    const sol = renderQuantGasta(despesa(), null);
    expect(sol).toContain("268.910.400 €");
    expect(sol).toContain("Sense comparació no diu si és molta o poca");
    expect(sol).not.toContain("Gastant com ells");
  });

  it("no compara la xifra d'un any amb la mediana d'un altre", () => {
    // El 2025 d'aquest municipi contra el 2024 dels seus faria semblar una
    // decisió del ple el que només és un any de diferència.
    const desquadrat = renderQuantGasta(despesa(), gasta({ year: 2024 }));
    expect(desquadrat).not.toContain("1.050 € per habitant");
    expect(desquadrat).toContain("Sense comparació no diu si és molta o poca");
  });

  it("un exercici sense liquidar surt com un forat i no com un zero", () => {
    expect(html).toContain("L'exercici 2023 no consta liquidat");
    expect(html).toContain("un forat no és un zero");
    // El text alternatiu de la sèrie també ho diu: qui no veu el cercle buit ha
    // de saber igualment que d'aquell any no en consta cap xifra.
    expect(html).toContain("no en consta cap xifra");
  });

  it("la sèrie va com a espurna dins de la targeta, amb el canvi escrit al costat", () => {
    // La línia de 720 px amb l'eix des de zero sortia plana i no deia res que
    // la xifra no digués: l'espurna diu la forma i la frase diu el quant.
    const targeta = html.slice(html.indexOf('<span class="etq">Per habitant</span>'), html.indexOf("</li>", html.indexOf('<span class="etq">Per habitant</span>')));
    expect(targeta).toContain('class="espurna"');
    expect(targeta).toContain("2019, 1.075 €");
    expect(targeta).toContain("Del 2019 al 2025: <b>+125 €</b> (+11,6 %)");
    expect(html).not.toContain('class="grafic serie');
    expect(html).not.toContain("Any a any");
  });

  it("amb la liquidació de la Generalitat i prou, encara diu la xifra", () => {
    const nomesJ8 = renderQuantGasta(null, gasta());
    expect(nomesJ8).toContain("1.200 €");
    expect(nomesJ8).toContain("268.910.400 €");
    expect(nomesJ8).toContain("Això és una liquidació, no un pressupost");
  });

  it("sense cap de les dues mètriques no hi ha bloc", () => {
    expect(renderQuantGasta(null, null)).toBe("");
  });
});

describe("els diners: el total i el repartiment, al mateix bloc", () => {
  it("la xifra gran va al capdamunt i no es repeteix al repartiment", () => {
    const html = renderRadiografia(fitxa({ spending: gasta() }));
    expect(html).toContain('id="diners"');
    expect(html).toContain("Quant gasta en total");
    expect(html).toContain('<a href="#diners">Els diners</a>');
    // Una sola vegada: abans la comparació del total vivia al mig de la llista
    // de partides i es llegia com una partida més.
    expect(html.split("Gastant com ells").length - 1).toBe(1);
    expect(html.indexOf("Quant gasta en total")).toBeLessThan(html.indexOf("On van"));
  });

  it("amb la liquidació per programes però sense la de la Generalitat, diu què hi falta", () => {
    // Són 112 dels 947: en sabem quant gasta però no en què.
    const html = renderRadiografia(fitxa());
    expect(html).toContain('id="diners"');
    expect(html).toContain("Quant gasta en total");
    expect(html).toContain("en tenim quant gasta però no en què");
    expect(html).not.toContain("<b>D'aquest ajuntament no en tenim la liquidació.</b>");
  });

  it("sense cap de les tres, el bloc diu que no en tenim la liquidació", () => {
    const html = renderRadiografia(fitxa({ despesaProgrames: null }));
    expect(html).toContain("D'aquest ajuntament no en tenim la liquidació");
    expect(html).not.toContain("Quant gasta en total");
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

  it("l'aigua és una llista de definició, una fila per cosa, i els tipus del ple hi van a sota", () => {
    // Eren sis paràgrafs i una secció a part per als tipus impositius.
    const html = renderQuePaga(aigua(), ibi(), taxes());
    expect(html.match(/<dl class="rebut">/g)?.length).toBe(2);
    const termes = [...html.matchAll(/<dt>([^<]+)<\/dt>/g)].map((m) => m[1]);
    expect(termes).toEqual([
      "Subministrament, el tram comparable",
      "Cànon de l'aigua",
      "Total del rebut",
      "Gestió",
      "Tarifa social",
      "Canvi del 2023 al 2025",
      "Tipus general d'IBI urbà",
      "Coeficient de l'IAE",
      "Impost de vehicles, turisme de 12 a 16 CV",
      "Última revisió cadastral",
    ]);
    expect(html).toContain("gestió indirecta, a càrrec de CASSA");
    expect(html).toContain("<b>+7,1 %</b>");
    expect(html).toContain("als 18 de la seva mida amb la variació interpretable");
    expect(html).toContain("2,154 €");
    expect(html).toContain("<b>0,52 %</b>");
    expect(html).toContain("<b>2003</b>");
    expect(html).toContain("No els comparem amb els d'altres municipis a propòsit");
    // I la secció «Què es paga aquí» ja no existeix: tot és a «Què paga la gent».
    const fitxaSencera = renderRadiografia(fitxa({ taxes: taxes() }));
    expect(fitxaSencera).not.toContain('id="impostos"');
    expect(fitxaSencera).not.toContain('class="impostos"');
    const on = fitxaSencera.indexOf('id="que-paga"');
    expect(fitxaSencera.slice(on, fitxaSencera.indexOf("<section", on))).toContain("Coeficient de l'IAE");
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

  it("una sola lletra petita, no dues seguides", () => {
    // Hi havia dos «La lletra petita» l'un sota l'altre: el perquè del
    // programa i la base de la despesa. És la mateixa nota.
    expect(html.match(/<summary>La lletra petita<\/summary>/g)?.length).toBe(1);
    expect(html).toContain("Quants diners costa recollir les escombraries");
    expect(html).toContain("obligacions reconegudes netes");
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
    // Des del bloc fins al següent: «com queda» ja no és un bloc a part, és un
    // subtítol de «Els comptes».
    const on = html.indexOf('id="mandat"');
    const seccio = html.slice(on, html.indexOf("<section", on));
    const files = seccio.split("<li").filter((f) => /aigua|IBI|Gent que hi viu/.test(f));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect(f).not.toMatch(/class="(millora|empitjora)"/);
  });

  it("diu al costat de la població que no la decideix l'ajuntament", () => {
    expect(html).toContain("La població no la decideix l'ajuntament");
  });

  it("els programes van en barres divergents: les vuit més grans a la vista, la resta plegades amb la mateixa escala, i les 0→0 fora", () => {
    const d = despesa();
    const programa = (codi: string, nom: string, inici: number, final: number, grup: number | null) =>
      ({
        codi, nom, nomOrigen: nom, perque: "", relacionatAmb: null, serie: [], darrer: null,
        mandat: variacio(2023, 2025, inici, final),
        mandatDelGrup: grup === null ? null : { fins: 2025, diferencia: grup, percentual: null, municipis: 20 },
        mandatAnterior: null, comparacio: null, cobertura: null,
      }) as unknown as NonNullable<RadiografiaData["despesaProgrames"]>["programes"][number];
    d.programes.push(
      programa("011", "Pagar el deute", 60, 40, -3), // −20: la més gran de totes
      programa("1301", "Policia local", 80, 83, 2.5),
      programa("3301", "Cultura", 30, 28, -1),
      programa("3401", "Esports", 20, 21.5, 0.5),
      programa("1650", "Enllumenat", 12, 12.4, 0.2),
      programa("2310", "Serveis socials", 90, 89.1, 4),
      programa("1710", "Parcs i jardins", 25, 32, 1),
      programa("9200", "Administració general", 200, 202.2, 3),
      programa("1610", "Aigua potable", 0, 0, 0), // 0→0: no hi surt
    );
    const html = renderRadiografia(fitxa({ despesaProgrames: d }));
    const on = html.indexOf('id="mandat"');
    const bloc = html.slice(on, html.indexOf("<section", on));
    expect(bloc).toContain("On han posat els diners, servei a servei");
    expect(bloc.match(/<figure class="grafic divergents">/g)?.length).toBe(2);
    const primer = bloc.slice(bloc.indexOf('<figure class="grafic divergents">'), bloc.indexOf("</figure>"));
    expect(primer.match(/<li class="(positiu|negatiu|zero)">/g)?.length).toBe(8);
    expect(primer.indexOf("Pagar el deute")).toBeLessThan(primer.indexOf("Escombraries i residus"));
    // La més gran ocupa mitja canal, i el zero és al mig.
    expect(primer).toContain('<li class="negatiu">');
    expect(primer).toContain('style="--w:50%"');
    expect(primer).toContain("−20,0 €/hab");
    expect(primer).toContain("seus +8,1 €/hab");
    // La resta, plegada, amb la mateixa escala: cap barra de dins no arriba al 50 %.
    expect(bloc).toContain("<summary>Els altres 2 programes, amb la mateixa escala</summary>");
    const segon = bloc.slice(bloc.indexOf("<details class=\"nota mes-programes\">"), bloc.indexOf("</details>", bloc.indexOf("<details class=\"nota mes-programes\">")));
    expect(segon).toContain("Enllumenat");
    expect(segon).toContain('style="--w:1%"'); // 0,4 sobre 20 → 1 %
    expect(bloc).not.toContain("Aigua potable");
    // I el text vell de divuit files ja no hi és.
    expect(bloc).not.toContain('<ul class="mandat">' + "\n" + '    <li class="">');
    expect(bloc).toContain("Els programes on l'ajuntament no hi posava res");
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

  it("quan tot és «cap», ho diu en una línia i plega la taula", () => {
    const html = renderSous(null, transparencia({ ambAltresRetribucions: 0, ambDeclaracioBens: 0 }), null);
    expect(html).toContain("cap no publica res");
    expect(html).toContain("<summary>Apartat per apartat</summary>");
    // La taula hi continua sent, plegada: cinc «cap» seguits no s'han
    // d'esborrar, només no s'han de llegir cinc vegades.
    expect(html.indexOf("<details")).toBeLessThan(html.indexOf("<table"));
    expect(html).toContain(">cap<");
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

  const retribucions = (mena: "sou" | "assistencies" | "cap", euros = 65_000) =>
    ({
      municipi: { nom: "Sabadell", ine5: "08187" },
      ministeri: {
        any: 2024,
        alcaldia: { regim: mena === "sou" ? "Dedicació exclusiva" : "Sense dedicació", euros: mena === "cap" ? 0 : euros, mena },
        regidories: null,
        nomAlFull: "Sabadell",
        font: {
          nom: "Retribucions dels membres de les corporacions locals", organisme: "Ministeri d'Hisenda",
          pagina: "https://www.hacienda.gob.es/", llicencia: "", urls: ["https://www.hacienda.gob.es/retribuciones-2024.xlsx"],
          consultat: "2026-08-29",
        },
        advertiment: "És el que cada ajuntament declara al Ministeri, no el que cobra ningú de tots els ens.",
      },
      ajuntament: null,
      catalunya: {
        municipisAmbDadaDelMinisteri: 866, municipisTotals: 947, alcaldiesAmbSou: 312,
        alcaldiesNomesAmbAssistencies: 400, alcaldiesSenseCapImport: 154, souMedianaAlcaldia: 48_000,
      },
      advertiment: "Només «sou» és un sou.",
    }) as NonNullable<RadiografiaData["retribucions"]>;

  it("el sou de l'alcaldia hi va només quan és un sou, comparat amb les alcaldies que en tenen, i mai sumat", () => {
    const html = renderSous(cost(), null, null, null, undefined, retribucions("sou"));
    expect(html).toContain("Sou de l'alcaldia");
    expect(html).toContain("65.000 €");
    expect(html).toContain("segons el que publica el Ministeri");
    expect(html).toContain("312 alcaldies catalanes");
    expect(html).toContain("48.000 €");
    expect(html).toContain("https://www.hacienda.gob.es/retribuciones-2024.xlsx");
    // 1.210.000 + 65.000 no surt enlloc: no se suma amb res.
    expect(html).not.toContain("1.275.000");
  });

  it("amb assistències o sense cap import no hi ha xifra: una frase que diu què és", () => {
    const a = renderSous(cost(), null, null, null, undefined, retribucions("assistencies", 180));
    expect(a).not.toContain("Sou de l'alcaldia");
    expect(a).not.toContain("180 €");
    expect(a).toContain("cobra per assistències");
    const c = renderSous(null, null, null, null, undefined, retribucions("cap"));
    expect(c).toContain("no cobra res de l'ajuntament");
    expect(c).not.toContain("Sou de l'alcaldia");
    expect(c).not.toContain('class="preus"');
  });

  it("les diputacions entren per nom: omplen la fila sense import, i el sostre per assistències no és cap suma", () => {
    const font = {
      nom: "Diputació de Barcelona, portal de transparència", url: "https://www.diba.cat/transparencia/retribucions",
      format: "csv", llicencia: "", consultat: "2026-08-29",
    };
    const dip = {
      persones: [
        {
          nom: "UN ALTRE REGIDOR", carrecMunicipal: "Regidor", alcaldia: false,
          diputacio: { ens: "Diputació de Barcelona", tipus: "diputació", carrec: "Diputat", dedicacio: null, retribucioAnualBruta: null, maximPerAssistencies: 12_000, motiu: null, font, metode: "nom" },
        },
        {
          nom: "MARTA FARRES", carrecMunicipal: "Alcaldessa", alcaldia: true,
          diputacio: { ens: "Diputació de Barcelona", tipus: "diputació", carrec: "Diputada", dedicacio: "dedicació exclusiva", retribucioAnualBruta: 90_940.08, maximPerAssistencies: null, motiu: null, font, metode: "nom" },
        },
      ],
      alcaldia: null,
      catalunya: { diputacionsLlegides: [], diputatsQueTambeSonRegidors: 180, ambImportPublicat: 90, nomsAmbigusDescartats: 2, consultat: "2026-08-29" },
      advertiment: "El màxim per assistències és un sostre, no un import cobrat.",
    } as NonNullable<RadiografiaData["sousDiputacions"]>;
    const html = renderSous(null, null, acumulats(), null, undefined, null, dip);
    // Dues persones i no quatre: J14 i J24 parlen de les mateixes.
    expect(html.match(/class="cap-persona"/g)?.length).toBe(2);
    expect(html).toContain("sostre per assistències");
    expect(html).toContain("12.000 €");
    expect(html).toContain("no és un sou ni s'hi afegeix");
    expect(html).toContain("https://www.diba.cat/transparencia/retribucions");
    expect(html).toContain("El màxim per assistències és un sostre, no un import cobrat.");
    expect(html).not.toContain("102.940"); // 90.940 + 12.000
    expect(html).toContain("180 diputats són alhora");
    // I una persona que només és a J24 entra igualment.
    const nomes = renderSous(null, null, null, null, undefined, null, dip);
    expect(nomes).toContain("Qui té un càrrec en un altre ens");
    expect(nomes.match(/class="cap-persona"/g)?.length).toBe(2);
    expect(nomes).toContain("90.940 €");
  });

  it("el nom s'escriu com l'escriu la seu electrònica, amb els seus accents", () => {
    const seu = [{ nom: "Marta Farrés Falgueras", carrec: "Alcaldessa", grup: "Grup Municipal del PSC", equipGovern: true, foto: null, fotoPetita: null, fitxa: null }];
    const ac = acumulats();
    ac.persones[0]!.nom = "MARTA FARRES FALGUERAS";
    const html = renderSous(null, null, ac, seu);
    expect(html).toContain("<b>Marta Farrés Falgueras</b>");
    expect(html).not.toContain("MARTA FARRES");
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

  it("va dins de «Qui mana», amb l'àncora al subtítol i les xifres en tires", () => {
    const html = renderRadiografia(fitxa({ continuitat: continuitat(), votPerdut: votPerdut() }));
    // Ja no és una secció: l'índex porta a «Qui mana» i l'àncora vella es
    // queda al subtítol, que és on hi arriben el cercador i la trajectòria.
    expect(html).not.toContain('href="#trajectoria"');
    const on = html.indexOf('id="ple"');
    const bloc = html.slice(on, html.indexOf("<section", on));
    expect(bloc).toMatch(/<h3 class="subtitol[^"]*" id="trajectoria">Quant fa que mana el mateix<\/h3>/);
    expect(bloc).toContain('<ul class="tires">');
    expect(bloc).toContain("Fa que mana PSC-CP");
    expect(bloc).toContain("Vots sense regidoria");
    // Les explicacions hi són, plegades: una sola lletra petita per a tot.
    const traj = bloc.slice(bloc.indexOf('id="trajectoria"'));
    expect(traj.match(/<details class="nota">/g)?.length).toBe(1);
    expect(traj).toContain("21,3 de cada 100 escons");
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

    // I una de plena —ple, comptes, govern, història, tipus— que és la que
    // s'assembla a una fitxa de debò i la que val per mesurar-ne el pes.
    const plena = renderRadiografia(
      fitxa({
        finances: finances(), government: govern(), taxes: taxes(),
        results: { M20231: { totalVotes: 90_000, seats: 27, candidatures: [
          { sigles: "PSC-CP", brandId: "psc", color: null, votes: 40_000, seats: 14, share: 44.4 },
          { sigles: "ERC-AM", brandId: "erc", color: null, votes: 20_000, seats: 6, share: 22.2 },
          { sigles: "JUNTS", brandId: "junts", color: null, votes: 14_000, seats: 4, share: 15.5 },
          { sigles: "PP", brandId: "pp", color: null, votes: 9_000, seats: 3, share: 10 },
        ] } },
        history: {
          series: [1979, 1983, 1987, 1991, 1995, 1999, 2003, 2007, 2011, 2015, 2019, 2023].map((year) => ({
            year, seats: 27, totalVotes: 90_000, winner: { sigles: "PSC", seats: 14, votes: 40_000 },
            winnerFamily: "psc", families: { psc: 14, erc: 6, junts: 4, pp: 3 }, candidatures: 6,
          })),
          elections: 12, firstYear: 1979, alternances: 2,
        },
        mayors: {
          history: [
            { term: "2023-2027", name: "MARTA FARRÉS FALGUERAS", partyRaw: "PSC-CP", tookOfficeOn: "2023-06-17" },
            { term: "2019-2023", name: "MARTA FARRÉS FALGUERAS", partyRaw: "PSC-CP", tookOfficeOn: "2019-06-15" },
            { term: "2015-2019", name: "JULI FERNÀNDEZ OLIVARES", partyRaw: "ERC-AM", tookOfficeOn: "2015-06-13" },
          ],
          changes: [], currentTermChange: null, distinctPeople: 2,
        },
        carrecs: {
          font: "seu-e", url: "https://seu-e.cat/ca/web/sabadell/govern", slug: "sabadell",
          descarregat: "29 d'agost del 2026", totalCarrecs: 27, ambFoto: 0, cobertura: "completa",
          carrecs: [
            { nom: "Marta Farrés Falgueras", carrec: "Alcaldessa", grup: "Grup Municipal del PSC", equipGovern: true, foto: null, fotoPetita: null, fitxa: null },
            ...Array.from({ length: 13 }, (_, i) => ({ nom: `Regidora Socialista ${i + 1}`, carrec: i < 8 ? `Regidora de l'àrea ${i + 1}` : "Regidora", grup: "Grup Municipal del PSC", equipGovern: i < 8, foto: null, fotoPetita: null, fitxa: null })),
            ...Array.from({ length: 6 }, (_, i) => ({ nom: `Regidor Republicà ${i + 1}`, carrec: "Regidor", grup: "Grup Municipal d'ERC", equipGovern: false, foto: null, fotoPetita: null, fitxa: null })),
            ...Array.from({ length: 4 }, (_, i) => ({ nom: `Regidor de Junts ${i + 1}`, carrec: "Regidor", grup: "Grup Municipal de Junts", equipGovern: false, foto: null, fotoPetita: null, fitxa: null })),
            ...Array.from({ length: 3 }, (_, i) => ({ nom: `Regidor Popular ${i + 1}`, carrec: "Regidor", grup: "Grup Municipal del PP", equipGovern: false, foto: null, fotoPetita: null, fitxa: null })),
          ],
        },
        participation: [{ electionId: "M20231", censusSize: 170_000, voters: 94_000, blankVotes: 1_200 }] as unknown as RadiografiaData["participation"],
        parity: { candidates: 297, womenCandidates: 144, womenCandidatesPct: 48, elected: 27, womenElected: 14, womenElectedPct: 52, heads: 11, womenHeads: 5, expectedElected: 27, complet: true },
        transparency: { items: 12, published: 9, pct: 75 },
      }),
      [],
      new Map([["sabadell", { jugable: true, quantes: 25 }]]),
    );
    const camiPlena = join(dir, "sabadell-plena.html");
    writeFileSync(camiPlena, plena, "utf8");
    console.log(`fitxa de prova plena: ${camiPlena}`);
    expect(plena).toContain('class="ullada cinc"');
    expect(plena).toContain('class="ple-compacte"');
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

/**
 * L'índex i el cos surten de la mateixa llista.
 *
 * Abans eren dues llistes escrites a mà: sis blocs del cos no eren a l'índex,
 * l'ordre era un altre, i el cercador —que llegeix l'índex— no els trobava.
 */
describe("el registre de seccions", () => {
  const seccions = (html: string): string[] => [...html.matchAll(/<section class="bloc[^"]*" id="([^"]+)"/g)].map((m) => m[1]!);
  const index = (html: string): string[] => {
    const on = html.indexOf('<nav class="index"');
    const nav = html.slice(on, html.indexOf("</nav>", on));
    return [...nav.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]!);
  };

  it("cap id no es repeteix, i tot el que és a l'índex és al cos", () => {
    const html = renderRadiografia(fitxa({ finances: finances() }));
    const ids = seccions(html);
    expect(new Set(ids).size).toBe(ids.length);
    for (const ancora of index(html)) expect(ids, ancora).toContain(ancora);
  });

  it("tot el que és al cos és a l'índex, menys les fonts", () => {
    const html = renderRadiografia(fitxa({ finances: finances(), parity: { candidates: 297, womenCandidates: 144, womenCandidatesPct: 48, elected: 27, womenElected: 14, womenElectedPct: 52, heads: 11, womenHeads: 5, expectedElected: 27, complet: true } }));
    const alIndex = new Set(index(html));
    for (const id of seccions(html)) {
      if (id === "fonts") expect(alIndex.has(id)).toBe(false);
      else expect(alIndex.has(id), id).toBe(true);
    }
    // Les seccions que abans no tenien id ara en tenen, i surten a l'índex.
    expect(html).toContain('<a href="#dones-i-homes">Dones i homes</a>');
    expect(html).toContain('<a href="#dades">Què en sabem</a>');
    expect(html).toContain('id="fonts"');
  });

  it("els comptes són un sol bloc: balanç, com queda i el deute any a any", () => {
    const html = renderRadiografia(fitxa({ finances: finances() }));
    expect(html).toContain('<a href="#comptes">Els comptes</a>');
    expect(html).not.toContain('href="#balanc"');
    expect(html).not.toContain('href="#com-queda"');
    expect(html).not.toMatch(/<section[^>]*id="balanc"/);
    expect(html).not.toMatch(/<section[^>]*id="com-queda"/);
    const on = html.indexOf('id="comptes"');
    const bloc = html.slice(on, html.indexOf("<section", on));
    expect(bloc).toContain('id="balanc"');
    expect(bloc).toContain("El balanç del mandat");
    expect(bloc).toContain('id="com-queda"');
    expect(bloc).toContain("Deute per habitant, any a any");
    // Les vuit targetes del semàfor ja no hi són.
    expect(html).not.toContain('class="indicadors"');
    // Les àncores que no són blocs també s'han de poder saltar.
    expect(html).toContain("[id]{scroll-margin-top:var(--e3)}");
  });

  it("les seccions fusionades ja no hi són: les seves àncores viuen als subtítols", () => {
    const mayors: NonNullable<RadiografiaData["mayors"]> = {
      history: [{ term: "2023-2027", name: "MARTA FARRÉS FALGUERAS", partyRaw: "PSC-CP", tookOfficeOn: "2023-06-17" }],
      changes: [], currentTermChange: null, distinctPeople: 1,
    };
    const html = renderRadiografia(
      fitxa({
        finances: finances(), government: govern(), mayors, taxes: taxes(),
        councilChanges: { changes: [], substitutions: 2, switches: 0 },
        results: { M20231: { totalVotes: 90_000, seats: 27, candidatures: [{ sigles: "PSC-CP", brandId: "psc", color: null, votes: 40_000, seats: 14, share: 44.4 }] } },
      }),
    );
    const ids = seccions(html);
    for (const id of ["regidors", "alcaldies", "trajectoria", "moviments", "impostos", "joc"]) expect(ids, id).not.toContain(id);
    expect(ids[0]).toBe("ple");
    expect(html).toContain('<a href="#ple">Qui mana</a>');
    const on = html.indexOf('id="ple"');
    const bloc = html.slice(on, html.indexOf("<section", on));
    expect(bloc).toContain("Qui mana, i com hi va arribar");
    expect(bloc).toContain('class="hemicicle"');
    expect(bloc).toMatch(/<h3 class="subtitol[^"]*" id="alcaldies">Les alcaldies des del 1979<\/h3>/);
    expect(bloc).toContain('<table class="alcaldies">');
    // Els moviments al ple són una línia al final, no una secció.
    expect(bloc).toContain('<p class="nota-linia"><b>2 persones han entrat');
    expect(html).not.toContain("<h2>Moviments al ple</h2>");
  });

  it("l'ordre és el de la fitxa: qui mana, els comptes, els diners, el vot, la gent", () => {
    const html = renderRadiografia(fitxa({ finances: finances(), participation: [{ electionId: "M20231", censusSize: 1000, voters: 600, blankVotes: 5 }] as unknown as RadiografiaData["participation"] }));
    const ids = seccions(html);
    const pos = (id: string): number => ids.indexOf(id);
    expect(pos("comptes")).toBeLessThan(pos("mandat"));
    expect(pos("mandat")).toBeLessThan(pos("diners"));
    expect(pos("diners")).toBeLessThan(pos("que-paga"));
    expect(pos("escombraries")).toBeLessThan(pos("participacio"));
    expect(pos("participacio")).toBeLessThan(pos("qui-hi-viu"));
    expect(pos("dades")).toBeLessThan(pos("fonts"));
  });

  it("«Què costa cada servei» i «Segueix estirant» ja no hi són, i les descàrregues van a «Què en sabem»", () => {
    const html = renderRadiografia(
      fitxa({
        services: { year: 2023, services: [{ label: "Clavegueram", perHead: 2, total: 1, management: "otro tipo de gestión (**)" }], medians: {} },
      }),
    );
    expect(html).not.toContain('id="serveis"');
    expect(html).not.toContain("otro tipo de gesti");
    expect(html).not.toContain('id="anar"');
    expect(html).not.toContain("Segueix estirant");
    const on = html.indexOf('id="dades"');
    const dades = html.slice(on, html.indexOf("<section", on));
    expect(dades).toContain('href="../../dades/m/sabadell.csv" download');
    expect(dades).toContain('href="../../dades/m/sabadell.json"');
    // I els mapes de quadres dels diners tampoc: deien el mateix que les barres.
    expect(renderRadiografia(fitxa({ spending: gasta() }))).not.toContain('class="quadres"');
  });

  it("les tres últimes eleccions viuen dins de la lletra petita d'«Elecció a elecció»", () => {
    const history: NonNullable<RadiografiaData["history"]> = {
      series: [1979, 1983, 2019, 2023].map((year) => ({
        year, seats: 27, totalVotes: 90_000, winner: { sigles: "PSC", seats: 14, votes: 40_000 },
        winnerFamily: "psc", families: { psc: 14, erc: 6, junts: 4, pp: 3 }, candidatures: 6,
      })),
      elections: 4, firstYear: 1979, alternances: 0,
    };
    const results: RadiografiaData["results"] = {
      M20231: { totalVotes: 90_000, seats: 27, candidatures: [{ sigles: "PSC-CP", brandId: "psc", color: null, votes: 40_000, seats: 14, share: 44.4 }] },
    };
    const html = renderRadiografia(fitxa({ history, results }));
    expect(html).not.toMatch(/<h2>Les tres últimes/);
    const on = html.indexOf('id="historia"');
    const bloc = html.slice(on, html.indexOf("<section", on));
    expect(bloc).toContain("<b>Les tres últimes, candidatura a candidatura.</b>");
    expect(bloc).toContain('<table class="serie">');
    expect(bloc.indexOf("<details")).toBeLessThan(bloc.indexOf('<table class="serie">'));
  });
});

describe("qui seu al ple: el recompte del govern", () => {
  const carrec = (nom: string, carrec: string, grup: string, equipGovern: boolean) => ({
    nom, carrec, grup, equipGovern, foto: null, fotoPetita: null, fitxa: null,
  });
  const carrecs = (): NonNullable<RadiografiaData["carrecs"]> => ({
    font: "seu-e", url: "https://seu-e.cat/ca/web/sabadell/govern", slug: "sabadell",
    descarregat: "29 d'agost del 2026", totalCarrecs: 3, ambFoto: 0, cobertura: "completa",
    carrecs: [
      carrec("Marta Farrés Falgueras", "Alcaldessa", "Grup Municipal del PSC", true),
      carrec("Pol Gibert Horcas", "Regidor", "Grup Municipal del PSC", false),
      carrec("Lluís Matas Ferrer", "Regidor", "Grup Municipal d'ERC", false),
    ],
  });
  const govern = (mayorSeats: number): NonNullable<RadiografiaData["government"]> => ({
    mayorName: "Marta Farrés Falgueras", mayorPartyRaw: "PSC-CP", mayorSigles: "PSC-CP", mayorSeats,
    winnerSigles: "PSC-CP", winnerSeats: mayorSeats, totalSeats: 27, majority: 14,
    winnerHasMajority: mayorSeats >= 14, winnerGoverns: true,
    effectiveParties: 3.2, mayorMatchMethod: "exact", mayorMatchConfidence: 1,
  });

  it("no diu «1 regidoria forma el govern» quan la seu només marca l'alcaldia", () => {
    // Sabadell: la seu electrònica marca l'alcaldessa i prou, i la fitxa
    // publicava «1 regidoria forma el govern de 27» quan en són 14.
    const html = renderRadiografia(fitxa({ carrecs: carrecs(), government: govern(14) }));
    expect(html).not.toContain("regidoria forma");
    expect(html).toContain("14 de 27 regidories");
    expect(html).toContain("majoria absoluta");
    expect(html).not.toContain("sense majoria absoluta");
    // I cap marca per persona: assenyalarien qui la seu ha marcat, no qui governa.
    expect(html).not.toMatch(/class="persona[^"]* govern"/);
    expect(html).not.toMatch(/class="grup-compacte[^"]*al-govern/);
    // Només l'alcaldia porta el càrrec escrit a sota.
    const on = html.indexOf('id="regidors"');
    const ple = html.slice(on, html.indexOf('id="alcaldies"', on) > 0 ? html.indexOf('id="alcaldies"', on) : html.indexOf("<section", on));
    expect(ple.match(/<span class="carrec">/g)?.length).toBe(1);
    expect(ple).toContain('<span class="carrec">Alcaldessa</span>');
  });

  it("sense majoria, ho diu", () => {
    const html = renderRadiografia(fitxa({ carrecs: carrecs(), government: govern(12) }));
    expect(html).toContain("12 de 27 regidories");
    expect(html).toContain("sense majoria absoluta");
  });

  it("quan les banderes sí que quadren, continua comptant-les", () => {
    const html = renderRadiografia(fitxa({ carrecs: carrecs(), government: govern(1) }));
    expect(html).toContain("1 regidoria forma");
    expect(html).toContain('class="persona alcaldia govern"');
  });

  it("un tinent d'alcalde escrit abans que l'alcaldessa no és l'alcaldia", () => {
    // Amb la regla vella —que el càrrec portés «alcald»— el primer tinent
    // d'alcalde de la llista sortia amb la cara de qui mana.
    const c = carrecs();
    c.carrecs = [
      carrec("Pol Gibert Horcas", "Primer tinent d'alcalde", "Grup Municipal del PSC", true),
      carrec("Marta Farrés Falgueras", "Alcaldessa", "Grup Municipal del PSC", true),
      carrec("Lluís Matas Ferrer", "Regidor", "Grup Municipal d'ERC", false),
    ];
    const html = renderRadiografia(fitxa({ carrecs: c, government: govern(2) }));
    const portada = html.slice(html.indexOf('<p class="alcaldia">'), html.indexOf("</p>", html.indexOf('<p class="alcaldia">')));
    expect(portada).toContain("Marta Farrés Falgueras");
    expect(portada).toContain('href="regidor/marta-farres-falgueras/"');
    expect(portada).not.toContain("Pol Gibert");
    expect(html).toMatch(/<li class="persona alcaldia[^"]*"><a href="regidor\/marta-farres-falgueras\//);
    expect(html).not.toMatch(/<li class="persona alcaldia[^"]*"><a href="regidor\/pol-gibert-horcas\//);
    // El tinent és al govern i porta el càrrec escrit, però no és l'alcaldia.
    expect(html).toContain('<span class="carrec">Primer tinent d\'alcalde</span>');
  });

  it("sense llista a la seu, l'alcaldia surt del registre pel nom oficial i porta a la seva fitxa", () => {
    // El càrrec del registre és el del dia de la constitució: després d'un
    // relleu diria «Alcalde» de qui ja no ho és. Mana el nom de la font oficial.
    const councillors: RadiografiaData["councillors"] = [
      { name: "POL GIBERT HORCAS", role: "Alcalde", groupName: null, sigles: "PSC-CP", color: null, brandId: "psc", orderNum: 1 },
      { name: "MARTA FARRES FALGUERAS", role: "Regidora", groupName: null, sigles: "PSC-CP", color: null, brandId: "psc", orderNum: 2 },
    ];
    const html = renderRadiografia(fitxa({ councillors, government: govern(14) }));
    const portada = html.slice(html.indexOf('<p class="alcaldia">'), html.indexOf("</p>", html.indexOf('<p class="alcaldia">')));
    // El nom és el de la font oficial, que és l'única que hi ha sense seu.
    expect(portada).toContain("Marta Farrés Falgueras");
    expect(portada).not.toContain("Pol Gibert");
    expect(portada).toContain('href="regidor/marta-farres-falgueras/"');
    expect(html).toMatch(/<li class="persona alcaldia"><a href="regidor\/marta-farres-falgueras\//);
    expect(html).not.toMatch(/<li class="persona alcaldia"><a href="regidor\/pol-gibert-horcas\//);
  });

  it("el ple compacte: una cara per regidoria, enllaçada a la seva fitxa, i el càrrec només a qui mana", () => {
    const html = renderRadiografia(fitxa({ carrecs: carrecs(), government: govern(14) }));
    const on = html.indexOf('id="ple"');
    const bloc = html.slice(on, html.indexOf("<section", on));
    expect(html).toContain('<a href="#ple">Qui mana</a>');
    expect(html).toContain("Qui mana, i com hi va arribar");
    expect(bloc).toMatch(/<h3 class="subtitol[^"]*" id="regidors">Qui seu al ple<\/h3>/);
    expect(bloc.match(/<li class="persona[^"]*"><a href="regidor\//g)?.length).toBe(3);
    expect(bloc).toContain('title="Marta Farrés Falgueras · Alcaldessa"');
    // Qui no mana no porta el càrrec escrit: «Regidor» vint vegades no diu res.
    expect(bloc).not.toContain('<span class="carrec">Regidor</span>');
    // I les targetes velles ja no hi són.
    expect(html).not.toContain('class="plens');
    expect(html).not.toContain('<details class="grup');
  });
});

describe("les pastilles de sigles porten a la pàgina del partit", () => {
  const govern = (): NonNullable<RadiografiaData["government"]> => ({
    mayorName: "Marta Farrés Falgueras", mayorPartyRaw: "PSC-CP", mayorSigles: "PSC-CP", mayorSeats: 14,
    winnerSigles: "PSC-CP", winnerSeats: 14, totalSeats: 27, majority: 14,
    winnerHasMajority: true, winnerGoverns: true,
    effectiveParties: 3.2, mayorMatchMethod: "exact", mayorMatchConfidence: 1,
  });

  it("el resum de la portada enllaça partit/psc/", () => {
    const html = renderRadiografia(fitxa({ government: govern() }));
    const on = html.indexOf('<p class="resum">');
    const resum = html.slice(on, html.indexOf("</p>", on));
    expect(resum).toContain('href="../../partit/psc/"');
    expect(resum).toContain('class="sigla"');
    expect(resum).not.toContain("<b class=\"sigla\"");
    // I la targeta de l'alcaldia, també.
    const alcaldia = html.slice(html.indexOf('<p class="alcaldia">'), html.indexOf("</p>", html.indexOf('<p class="alcaldia">')));
    expect(alcaldia).toContain('href="../../partit/psc/"');
  });

  it("l'enllaç no va subratllat: el fons de color ja diu que és una peça", () => {
    const html = renderRadiografia(fitxa({ government: govern() }));
    expect(html).toContain("text-decoration:none}");
    expect(html).toContain(".resum .sigla{color:var(--t,#FBF7EE)}");
  });
});

describe("la portada i el cap de pàgina", () => {
  it("enllaça les tipografies de la marca, que cap pàgina no carregava", () => {
    const html = renderRadiografia(fitxa());
    expect(html).toContain('href="../../../assets/fonts.css"');
    expect(html.indexOf("fonts.css")).toBeLessThan(html.indexOf("<style>"));
  });

  it("l'escut va al costat del nom i el seu crèdit a les fonts", () => {
    const html = renderRadiografia(
      fitxa({
        imatges: {
          escut: {
            mena: "escut", cami: "/observatori/escuts/08187.svg", format: "svg", amplada: null, alcada: null,
            derivada: false, fitxer: "File:Escut de Sabadell.svg",
            pagina: "https://commons.wikimedia.org/wiki/File:Escut_de_Sabadell.svg",
            llicencia: "cc-by-sa-4.0", llicenciaNom: "CC BY-SA 4.0", autor: null,
          },
          vista: null,
        },
      }),
    );
    const portada = html.slice(html.indexOf('<section class="portada">'), html.indexOf("</section>"));
    expect(portada).toContain('<div class="titol-amb-escut"><img class="escut" src="/observatori/escuts/08187.svg" alt="Escut de Sabadell"');
    const on = html.indexOf('id="fonts"');
    const fonts = html.slice(on, html.indexOf("</section>", on));
    expect(fonts).toContain('class="credit-imatge"');
    expect(fonts).toContain("https://commons.wikimedia.org/wiki/File:Escut_de_Sabadell.svg");
    expect(fonts).toContain("CC BY-SA 4.0");
    // Sense escut no hi ha ni silueta ni crèdit, i la fitxa es construeix igual.
    expect(renderRadiografia(fitxa())).not.toContain('class="escut"');
    expect(renderRadiografia(fitxa())).not.toContain("credit-imatge\"");
  });

  it("el full d'estil surt sense comentaris", () => {
    const html = renderRadiografia(fitxa());
    const css = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
    expect(css).not.toContain("/*");
    expect(css).toContain(".preus{grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}");
  });

  it("amb set entrades, el menú baixa sencer a la seva fila i la regla d'encongir toca els enllaços", () => {
    const html = renderRadiografia(fitxa());
    const css = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
    // A 900px el menú ocupa la seva pròpia fila, com a la landing: si no,
    // l'etiqueta queia sola a una segona fila entre 720 i 900.
    expect(css).toContain(".capcalera .menu{order:1;flex:1 1 100%;margin-left:0;gap:4px 14px}");
    // I la regla de 420px ha d'apuntar als enllaços: el contenidor no mana
    // sobre una mida que cada enllaç porta escrita.
    expect(css).toContain(".capcalera .menu a,.capcalera .menu .ara{font-size:.78rem}");
    expect(css).not.toContain(".capcalera .menu{font-size");
  });
});

/**
 * L'ullada: cinc xifres que vulguin dir alguna cosa a qui no és tècnic, amb la
 * comparació escrita en paraules. «Òrgans de govern» i «portal de transparència»
 * hi eren i no volien dir res sense el bloc que els explica.
 */
describe("l'ullada: cinc xifres en paraules", () => {
  const participacio = [{ electionId: "M20231", censusSize: 1000, voters: 600, blankVotes: 5 }] as unknown as RadiografiaData["participation"];
  const medianes = {
    participacio: { M20231: { mediana: 51.5, quants: 24, etiqueta: "de més de 50.000 habitants", percentil: 88, valors: [] } },
    donesAlPle: null,
  };
  const continuitat = {
    partit: { desDeLegislatura: "2011-2015", desDeAny: 2011, desDe: "2011-06-11", anys: 15, legislatures: 4, aproximat: false, ininterromput: false, forats: [], aturadaPerDesconegut: false, sigles: "PSC-CP", familia: "psc" },
    persona: null, personesDiferents: 6, forcesDiferents: 3, legislatures: 12, primeraLegislatura: "1979-1983", alternances: 2, alternancesDetall: [],
    volatilitat: { font: "", serie: [], ultima: null, mitjana: null, trams: 0, tramsFiables: 0, comparacio: null },
  } as unknown as RadiografiaData["continuitat"];
  const ullada = (html: string): string => {
    const on = html.indexOf('<section class="ullada');
    return on < 0 ? "" : html.slice(on, html.indexOf("</section>", on));
  };

  it("són cinc, amb aquestes etiquetes, en aquest ordre i amb la comparació en paraules", () => {
    const u = ullada(
      renderRadiografia(
        fitxa({ finances: finances(), government: govern(), spending: gasta(), participation: participacio, continuitat }),
        [],
        new Map(),
        medianes,
      ),
    );
    expect(u).toContain('class="ullada cinc"');
    const etiquetes = [...u.matchAll(/<span class="etq">([^<]+)<\/span>/g)].map((m) => m[1]);
    expect(etiquetes).toEqual(["Gasta per habitant", "Deu per habitant", "Rebut mitjà d'IBI", "Va anar a votar", "Mana des de"]);
    // Cada peu diu la comparació amb paraules, no només amb una barra.
    expect(u).toContain("1.200 €");
    expect(u).toContain("150 € més que el poble del mig de la seva mida"); // 1.200 − 1.050
    expect(u).toContain("450 €");
    expect(u).toContain("més que 4 de cada 10 dels de la seva mida"); // percentil 40
    expect(u).toContain("362 €");
    expect(u).toContain("el més habitual als de la seva mida són 348 €");
    expect(u).toContain("60,0 %");
    expect(u).toContain("8,5 punts més que el poble del mig de la seva mida");
    expect(u).toContain('href="../../partit/psc/"');
    expect(u).toContain("des del 2011 · 4 legislatures");
    expect(u).toContain("la llista més votada");
    // I els dos blocs que no volien dir res ja no hi són.
    expect(u).not.toMatch(/òrgans de govern|transparència/i);
    expect(u).not.toContain("Cost del govern");
    // Els enllaços porten als blocs que ho expliquen.
    for (const on of ["#diners", "#comptes", "#que-paga", "#participacio", "#ple"]) expect(u).toContain(`href="${on}"`);
  });

  it("el deute es diu en paraules també als extrems, i qui va pactar ho diu", () => {
    const f = finances();
    f.comparison[0]!.percentile = 12;
    const u = ullada(renderRadiografia(fitxa({ finances: f, government: govern({ winnerGoverns: false, winnerSigles: "ERC-AM" }) })));
    expect(u).toContain("entre els que menys deuen dels de la seva mida");
    expect(u).toContain("no va guanyar: hi va haver pacte");
    f.comparison[0]!.percentile = 90;
    expect(ullada(renderRadiografia(fitxa({ finances: f })))).toContain("entre els que més deuen dels de la seva mida");
  });

  it("sense rebut d'IBI publicable hi va el preu de l'aigua", () => {
    const u = ullada(renderRadiografia(fitxa({ finances: finances(), government: govern(), rebutIbi: ibi({ publicable: false }) })));
    expect(u).toContain("Paga per l'aigua");
    expect(u).toContain("1,50 €");
    expect(u).toContain("el més habitual als de la seva mida són 1,61 €");
    expect(u).not.toContain("Rebut mitjà d'IBI");
  });

  it("amb menys de tres xifres no hi ha ullada, i el CSS posa les cinc en fila", () => {
    const html = renderRadiografia(fitxa({ despesaProgrames: null, rebutIbi: null, preuAigua: null }));
    expect(html).not.toContain('class="ullada');
    expect(html).toContain(".ullada.cinc ul{grid-template-columns:repeat(5,minmax(0,1fr))}");
  });
});

describe("les pastilles de context", () => {
  it("porten a la comarca, a la prova i al comparador, i a l'AMB quan hi és", () => {
    const html = pastillesContext(
      fitxa({ amb: { member: true, municipis: 36, materies: [] } }),
      new Map([["sabadell", { jugable: true, quantes: 25 }]]),
    );
    expect(html).toContain('<ul class="pastilles-context">');
    expect(html).toContain('href="../../c/valles-occidental/"');
    expect(html).toContain('href="../../amb/"');
    expect(html).toContain('href="../../preguntes/sabadell/prova/"');
    expect(html).toContain('href="../../comparador/?m=sabadell"');
    expect(html).not.toContain("mapa/");
  });

  it("sense prova jugable porta a les preguntes, i sense AMB no en parla", () => {
    const html = pastillesContext(fitxa(), new Map([["sabadell", { jugable: false, quantes: 12 }]]));
    expect(html).toContain('href="../../preguntes/sabadell/"');
    expect(html).not.toContain("prova/");
    expect(html).not.toContain("amb/");
  });

  it("viuen a la banda del 23-M, com a última fila", () => {
    const html = renderRadiografia(fitxa(), [], new Map([["sabadell", { jugable: true, quantes: 25 }]]));
    const on = html.indexOf('<section class="joc-banda" id="joc"');
    const joc = html.slice(on, html.indexOf("</section>", on));
    expect(joc).toContain('class="pastilles-context"');
    expect(joc.indexOf('class="pastilles-context"')).toBeGreaterThan(joc.indexOf("<details"));
  });
});

/**
 * La banda del 23-M: l'única peça de la fitxa que parla de l'elecció, i era al
 * 96 % de l'scroll. Ara va sota l'ullada i abans de l'índex.
 */
describe("la banda «Què t'hi jugues»", () => {
  const history = (alternances: number): NonNullable<RadiografiaData["history"]> => ({
    series: [1979, 1983, 2019, 2023].map((year) => ({
      year, seats: 27, totalVotes: 90_000, winner: { sigles: "PSC", seats: 14, votes: 40_000 },
      winnerFamily: "psc", families: { psc: 14, erc: 6, junts: 4, pp: 3 }, candidatures: 6,
    })),
    elections: 12, firstYear: 1979, alternances,
  });
  const banda = (html: string): string => {
    const on = html.indexOf('<section class="joc-banda" id="joc"');
    return on < 0 ? "" : html.slice(on, html.indexOf("</section>", on));
  };

  it("va entre l'ullada i l'índex, amb la papereta, quatre tires i el botó a la prova", () => {
    const html = renderRadiografia(
      fitxa({ government: govern(), history: history(2), finances: finances() }),
      [],
      new Map([["sabadell", { jugable: true, quantes: 25 }]]),
    );
    const on = html.indexOf('<section class="joc-banda" id="joc"');
    expect(on).toBeGreaterThan(html.indexOf('<section class="ullada'));
    expect(on).toBeLessThan(html.indexOf('<nav class="index"'));
    const b = banda(html);
    expect(b).toContain('class="papereta"');
    expect(b).toContain("Què t'hi jugues el 23 de maig del 2027");
    const etiquetes = [...b.matchAll(/<span class="etq">([^<]+)<\/span>/g)].map((m) => m[1]);
    expect(etiquetes).toEqual(["Regidories en joc", "En calen", "Les té", "Canvis de mans des del 1979"]);
    expect(b).toContain('<span class="xifra">27</span>');
    expect(b).toContain('<span class="xifra">14</span>');
    expect(b).toContain('href="../../partit/psc/"');
    expect(b).toContain("14 de 27 · majoria absoluta");
    expect(b).toContain('<span class="xifra">2</span>');
    expect(b).toContain("en 12 eleccions");
    expect(b).toContain('class="boto-joc" href="../../preguntes/sabadell/prova/"');
    expect(b).toContain('href="/#avisa"');
    expect(b).toContain("el quart diumenge de maig");
    expect(b).toContain('class="pastilles-context"');
    // Ja no és una secció del registre ni de l'índex, però l'àncora vella hi arriba.
    expect(html).not.toMatch(/<section class="bloc[^"]*" id="joc"/);
    expect(html).not.toContain('href="#joc"');
    expect(html.match(/id="joc"/g)?.length).toBe(1);
    // I la mascota porta el seu CSS, sense comentaris.
    expect(html).toContain(".papereta .parpelles circle");
  });

  it("sense prova jugable porta a les preguntes, i sense conjunt diu que s'està preparant", () => {
    const nomesLlegir = banda(renderRadiografia(fitxa({ government: govern() }), [], new Map([["sabadell", { jugable: false, quantes: 12 }]])));
    expect(nomesLlegir).toContain('class="boto-joc" href="../../preguntes/sabadell/"');
    expect(nomesLlegir).not.toContain("prova/");
    const res = banda(renderRadiografia(fitxa({ government: govern() })));
    expect(res).toContain("Estem preparant una brúixola electoral per a Sabadell");
    expect(res).not.toContain('class="boto-joc"');
    expect(res).toContain('href="/#avisa"');
  });

  it("en minoria ho diu, i sense història no s'inventa cap canvi de mans", () => {
    const b = banda(renderRadiografia(fitxa({ government: govern({ mayorSeats: 12, winnerSeats: 12, winnerHasMajority: false }) })));
    expect(b).toContain("12 de 27 · en minoria");
    expect(b).not.toContain("Canvis de mans");
    const cap = banda(renderRadiografia(fitxa({ government: govern(), history: history(0) })));
    expect(cap).toContain('<span class="xifra">Cap</span>');
    expect(cap).toContain("la mateixa força ha guanyat les 12 eleccions");
  });
});

describe("què en sabem: la transparència en recompte", () => {
  const item = (key: string, label: string, published: boolean) => ({
    key, label, published, auto: false, notApplicable: false, updatedOn: null, updatedYear: 2025, bulk: false,
    catalunya: { published: 835, of: 936 },
  });

  it("diu quants apartats publica i plega la llista", () => {
    const html = renderRadiografia(
      fitxa({
        transparency: {
          items: 12, published: 9, pct: 75,
          detail: [item("a", "Retribucions dels càrrecs", true), item("b", "Cartipàs", true), item("c", "Agenda", false)],
        },
      }),
    );
    expect(html).toContain("publica <b>9 dels 12 apartats</b>");
    expect(html).toContain("<summary>Els 2 apartats que hi consten publicats, un per un</summary>");
    expect(html).toContain("Retribucions dels càrrecs");
    expect(html).not.toContain("El que hi consta publicat</h3>");
    // La llista només diu el que hi consta com a publicat: mai acusa.
    expect(html).not.toContain("Agenda");
  });
});

describe("com ha anat la seguretat", () => {
  const crim = (): NonNullable<RadiografiaData["criminalitat"]> => ({
    font: {
      nom: "Balanç de criminalitat (4t trimestre: any sencer)",
      organisme: LLICENCIA_INTERIOR.organisme,
      url: "https://estadisticasdecriminalidad.ses.mir.es/publico/portalestadistico/balances",
      llicencia: LLICENCIA_INTERIOR,
      consultat: "2026-08-30",
      balancos: [
        { any: 2025, trimestre: 4, fitxer: "1509012.px", titol: "Municipios mayores de 20.000", llindar: 20_000, url: "https://x" },
      ],
    },
    cobertura: "mes-de-20000",
    llindar: { habitants: 20_000, nota: NOTA_LLINDAR },
    context: { decideixLAjuntament: false, nota: NOTA_COMPETENCIES },
    mandat: { desDe: 2023 },
    anys: [2023, 2024, 2025],
    darrerAny: 2025,
    poblacio: [{ any: 2025, habitants: CENS_2025, anyPadro: 2025 }],
    total: {
      clau: "total", nom: "Total d'infraccions penals", nivell: 1, fitxa: true,
      serie: [{ any: 2023, fets: 12_000 }, { any: 2024, fets: 12_500 }, { any: 2025, fets: 13_000 }],
      perMil: [{ any: 2023, valor: 53.6 }, { any: 2024, valor: 55.8 }, { any: 2025, valor: 58 }],
      canviUltimAny: { desDe: 2024, fins: 2025, abs: 500, pct: 4 },
      canviMandat: { desDe: 2023, fins: 2025, abs: 1_000, pct: 8.3 },
    },
    tipus: [],
    ranquing: {
      posicio: 9, de: 70, any: 2025,
      criteri: "fets penals coneguts per 1.000 habitants (total d'infraccions penals)",
      ordre: "el 1r és el que en té més per 1.000 habitants",
    },
    nota: NOTA_FETS_CONEGUTS,
  });

  it("la secció hi és, surt a l'índex, i la frase va abans que cap taula", () => {
    const html = renderRadiografia(fitxa({ criminalitat: crim() }));
    expect(html).toContain('id="seguretat"');
    expect(html).toContain("Com ha anat la seguretat");
    expect(html).toContain('href="#seguretat"');
    expect(html).toContain("El 2025 es van conèixer <b>13.000</b> fets penals");
    // El rànquing mai sense el denominador.
    expect(html).toContain("el <b>9è</b> dels <b>70</b> municipis catalans amb dada");
  });

  it("la mediana del grup i el compte de coberts arriben pel paràmetre nou", () => {
    const html = renderRadiografia(fitxa({ criminalitat: crim() }), [], new Map(), undefined, undefined, {
      grup: { nom: "de més de 100.000 habitants", quants: 10, medianaPerMil: { total: 61.2 } },
      coberts: 70,
    });
    expect(html).toContain("61,2");
    expect(html).toContain("entre els 10 de la seva mida amb dada");
    expect(html).toContain("els de la seva mida");
  });

  it("el municipi que no és al balanç no perd el bloc: el buit s'ha de dir", () => {
    const html = renderRadiografia(fitxa(), [], new Map(), undefined, undefined, { grup: null, coberts: 70 });
    expect(html).toContain('id="seguretat"');
    expect(html).toContain("més de 20.000 habitants");
    expect(html).toContain("70 a Catalunya");
    // Sabadell passa del llindar: la fitxa diu que el forat és de la font.
    expect(html).toContain("hauria de formar part");
    expect(html).toContain("Mossos");
  });
});
