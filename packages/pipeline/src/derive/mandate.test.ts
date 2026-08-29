import { describe, expect, it } from "vitest";
import { MANDATES, mandateBands, readMandate, type YearPoint } from "./mandate";

const point = (year: number, over: Partial<YearPoint> = {}): YearPoint => ({
  year, debtPerHead: 100, netSavingPct: 10, financialLoadPct: 2,
  investmentPerHead: 50, investmentExecutionPct: 40, personnelPct: 30,
  paymentDays: 20, investmentUnspent: 1_000, ...over,
});

describe("readMandate", () => {
  const mandate = MANDATES[0]!; // 2023-2027

  it("mesura la variació entre el primer i l'últim exercici del mandat", () => {
    const lectura = readMandate(
      [point(2022, { debtPerHead: 999 }), point(2023, { debtPerHead: 300 }), point(2024, { debtPerHead: 240 })],
      mandate,
    )!;
    expect(lectura.years).toEqual([2023, 2024]);
    expect(lectura.delta.debtPerHead).toBe(-60);
  });

  it("deixa fora els exercicis d'un altre mandat", () => {
    const lectura = readMandate([point(2019), point(2020), point(2024)], mandate)!;
    expect(lectura.years).toEqual([2024]);
  });

  it("suma els diners pressupostats per invertir i no gastats de tot el mandat", () => {
    const lectura = readMandate(
      [point(2023, { investmentUnspent: 500_000 }), point(2024, { investmentUnspent: 300_000 })],
      mandate,
    )!;
    expect(lectura.investmentUnspentTotal).toBe(800_000);
  });

  it("no inventa una variació quan a un dels dos extrems hi falta la dada", () => {
    const lectura = readMandate(
      [point(2023, { paymentDays: null }), point(2024, { paymentDays: 15 })],
      mandate,
    )!;
    expect(lectura.delta.paymentDays).toBeNull();
  });

  it("diu quants exercicis esperava tenir, per poder escriure «2 dels 4»", () => {
    const lectura = readMandate([point(2023), point(2024)], mandate)!;
    expect(lectura.years).toHaveLength(2);
    expect(lectura.expected).toBe(4);
  });

  it("torna null si el mandat no té cap exercici liquidat", () => {
    expect(readMandate([point(2015)], mandate)).toBeNull();
  });
});

describe("mandateBands", () => {
  it("lliga cada tram d'anys amb qui manava", () => {
    const bands = mandateBands(
      [2018, 2019, 2020, 2021, 2022, 2023, 2024],
      [
        { term: "2019-2023", name: "Pilar Díaz Romero", partyRaw: "PSC-CP" },
        { term: "2023-2027", name: "Eduard Sanz Garcia", partyRaw: "PSC-CP" },
      ],
    );
    expect(bands.map((b) => b.id)).toEqual(["2015-2019", "2019-2023", "2023-2027"]);
    expect(bands[1]!.mayor).toBe("Pilar Díaz Romero");
    expect(bands[2]!.from).toBe(2023);
  });

  it("no atribueix la banda a ningú si al mandat hi va haver més d'una alcaldia", () => {
    const bands = mandateBands(
      [2023, 2024],
      [
        { term: "2023-2027", name: "Primera", partyRaw: "PSC-CP" },
        { term: "2023-2027", name: "Segona", partyRaw: "PSC-CP" },
      ],
    );
    expect(bands[0]!.mayor).toBeNull();
    expect(bands[0]!.party).toBe("PSC-CP");
  });

  it("no dibuixa bandes fora del rang d'anys que hi ha", () => {
    const bands = mandateBands([2024], []);
    expect(bands).toHaveLength(1);
    expect(bands[0]!.id).toBe("2023-2027");
  });
});
