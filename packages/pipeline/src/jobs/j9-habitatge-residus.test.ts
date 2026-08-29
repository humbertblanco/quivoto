import { describe, expect, it } from "vitest";
import { arrodoneix, mitjanaPonderada, taxaSelectiva, variacioEntre, type PuntSerie } from "./j9-habitatge-residus";

describe("taxaSelectiva", () => {
  it("dona el percentatge que publica l'origen", () => {
    // Abrera 2024, comprovat contra `r_s_r_m_total` del conjunt: 34,17 %.
    expect(taxaSelectiva(2_034.05, 5_953.07)).toBe(34.17);
  });

  it("distingeix «no ho sabem» de «no reciclen res»", () => {
    expect(taxaSelectiva(null, 100)).toBeNull();
    expect(taxaSelectiva(10, null)).toBeNull();
    expect(taxaSelectiva(10, 0)).toBeNull();
    expect(taxaSelectiva(0, 100)).toBe(0);
  });

  it("no passa mai del 100 % quan les xifres quadren", () => {
    expect(taxaSelectiva(100, 100)).toBe(100);
  });
});

describe("mitjanaPonderada", () => {
  it("reconstrueix la renda anual a partir dels trimestres", () => {
    // Abrera 2023: 77, 44, 52 i 34 contractes. La fila anual de l'origen diu
    // 675,58 €, i és exactament la mitjana ponderada dels quatre trimestres.
    expect(
      mitjanaPonderada([
        { valor: 575.36, pes: 77 },
        { valor: 659.98, pes: 44 },
        { valor: 794.41, pes: 52 },
        { valor: 741.01, pes: 34 },
      ]),
    ).toBe(675.58);
  });

  it("no és la mitjana simple: un trimestre de 5 contractes no pesa com un de 200", () => {
    const ponderada = mitjanaPonderada([
      { valor: 400, pes: 200 },
      { valor: 900, pes: 5 },
    ]);
    expect(ponderada).toBe(412.2);
    expect(ponderada).not.toBe(650);
  });

  it("ignora els trimestres sense preu i els que no tenen contractes", () => {
    expect(mitjanaPonderada([{ valor: 500, pes: 10 }, { valor: null, pes: 90 }])).toBe(500);
    expect(mitjanaPonderada([{ valor: 500, pes: 0 }])).toBeNull();
    expect(mitjanaPonderada([])).toBeNull();
  });
});

describe("variacioEntre", () => {
  const lloguer: PuntSerie[] = [
    { any: 2019, valor: 600 },
    { any: 2020, valor: 610 },
    { any: 2023, valor: 675 },
    { any: 2024, valor: 740 },
    { any: 2025, valor: 810 },
  ];

  it("compara el mandat actual amb l'anterior", () => {
    expect(variacioEntre(lloguer, 2023, 2025)).toEqual({
      desDe: 2023,
      fins: 2025,
      inici: 675,
      final: 810,
      diferencia: 135,
      percentual: 20,
      anys: 2,
      diferenciaAnual: 67.5,
      percentualAnual: 10,
    });
    expect(variacioEntre(lloguer, 2019, 2023)).toMatchObject({ diferencia: 75, percentual: 12.5 });
  });

  it("no compara anys que no existeixen", () => {
    expect(variacioEntre(lloguer, 2021, 2025)).toBeNull();
    expect(variacioEntre(lloguer, 2019, 2026)).toBeNull();
    expect(variacioEntre([], 2023, 2025)).toBeNull();
  });

  it("tampoc quan l'any hi és però la xifra està suprimida", () => {
    // Al conjunt del lloguer la renda no es publica si hi ha massa pocs
    // contractes: l'any hi és, el preu no.
    const buit: PuntSerie[] = [{ any: 2023, valor: null }, { any: 2025, valor: 810 }];
    expect(variacioEntre(buit, 2023, 2025)).toBeNull();
  });

  it("no inverteix els extrems si li'ls donen del revés", () => {
    expect(variacioEntre(lloguer, 2025, 2023)).toBeNull();
    expect(variacioEntre(lloguer, 2023, 2023)).toBeNull();
  });

  it("dona punts percentuals i variació relativa alhora per a la taxa", () => {
    const taxa: PuntSerie[] = [{ any: 2023, valor: 40 }, { any: 2024, valor: 50 }];
    const variacio = variacioEntre(taxa, 2023, 2024)!;
    expect(variacio.diferencia).toBe(10); // deu punts
    expect(variacio.percentual).toBe(25); // un quart més
  });

  it("no divideix per zero quan es partia de no reciclar res", () => {
    const taxa: PuntSerie[] = [{ any: 2023, valor: 0 }, { any: 2024, valor: 12 }];
    expect(variacioEntre(taxa, 2023, 2024)).toMatchObject({ diferencia: 12, percentual: null });
  });
});

describe("arrodoneix", () => {
  it("no arrossega els decimals binaris", () => {
    expect(arrodoneix(1.005 * 100, 2)).toBe(100.5);
    expect(arrodoneix(34.16666, 2)).toBe(34.17);
  });
});

describe("variacions de mandats de durada diferent", () => {
  const serie = [
    { any: 2019, valor: 30 },
    { any: 2023, valor: 39 },
    { any: 2024, valor: 41 },
  ];

  it("diu quants anys cobreix cada variació", () => {
    expect(variacioEntre(serie, 2019, 2023)!.anys).toBe(4);
    expect(variacioEntre(serie, 2023, 2024)!.anys).toBe(1);
  });

  it("dona el ritme anual, que és l'única xifra comparable entre mandats", () => {
    const anterior = variacioEntre(serie, 2019, 2023)!;
    const actual = variacioEntre(serie, 2023, 2024)!;
    // +9 punts en 4 anys és 2,25 l'any; +2 punts en 1 any és 2 l'any.
    // Amb les diferències brutes, l'actual sembla molt més tranquil; amb el
    // ritme, es veu que van gairebé igual.
    expect(anterior.diferencia).toBe(9);
    expect(actual.diferencia).toBe(2);
    expect(anterior.diferenciaAnual).toBe(2.25);
    expect(actual.diferenciaAnual).toBe(2);
  });
});
