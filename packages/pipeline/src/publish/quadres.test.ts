import { describe, expect, it } from "vitest";
import { quadres } from "./quadres";

/**
 * Les xifres reals de Barcelona del 2025. El que ha de complir el dibuix és
 * senzill i és tot el que importa: que les àrees siguin les proporcions, que
 * omplin el rectangle sencer i que cap tros no en surti.
 */
const INGRESSOS = [
  { etiqueta: "IBI", valor: 458 },
  { etiqueta: "Taxes", valor: 130 },
  { etiqueta: "Plusvàlua", valor: 85 },
  { etiqueta: "Activitats econòmiques", valor: 54 },
  { etiqueta: "Preus públics", valor: 43 },
  { etiqueta: "Vehicles", valor: 32 },
];

describe("quadres", () => {
  const caixes = quadres(INGRESSOS);

  it("l'àrea de cada tros és la seva part del total", () => {
    const suma = INGRESSOS.reduce((a, t) => a + t.valor, 0);
    for (const c of caixes) {
      const esperada = (10_000 * c.valor) / suma;
      expect(c.w * c.h, c.etiqueta).toBeCloseTo(esperada, 4);
    }
  });

  it("omplen el rectangle i cap no en surt", () => {
    const area = caixes.reduce((a, c) => a + c.w * c.h, 0);
    expect(area).toBeCloseTo(10_000, 3);
    for (const c of caixes) {
      expect(c.x).toBeGreaterThanOrEqual(-0.001);
      expect(c.y).toBeGreaterThanOrEqual(-0.001);
      expect(c.x + c.w).toBeLessThanOrEqual(100.001);
      expect(c.y + c.h).toBeLessThanOrEqual(100.001);
    }
  });

  it("el més gran va primer i és el més gran de debò", () => {
    expect(caixes[0]!.etiqueta).toBe("IBI");
    expect(Math.round(caixes[0]!.part)).toBe(57);
  });

  it("cap tros no queda tan prim que no s'hi pugui llegir res", () => {
    // La relació d'aspecte és el que l'algorisme minimitza: si en surt un de
    // vint a un, el dibuix no serveix i val més tornar a la llista.
    for (const c of caixes) {
      const relacio = Math.max(c.w / c.h, c.h / c.w);
      expect(relacio, c.etiqueta).toBeLessThan(6);
    }
  });

  it("un total explícit deixa el forat que hi falta", () => {
    // Quan la suma de les parts no és el total —hi ha una partida que no
    // desglossem— la part de cadascuna es calcula sobre el total de debò.
    const amb = quadres([{ etiqueta: "A", valor: 50 }], 200);
    expect(amb[0]!.part).toBe(25);
  });

  it("no peta amb res, ni amb zeros", () => {
    expect(quadres([])).toEqual([]);
    expect(quadres([{ etiqueta: "A", valor: 0 }])).toEqual([]);
  });
});
