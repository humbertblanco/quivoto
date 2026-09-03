import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseEmexMassiu } from "../adapters/idescat";
import { buildPeerGroups } from "../derive/peers";
import { habitantsPerAny } from "./j29-criminalitat";
import {
  INDICADORS_EMEX,
  KIND,
  comparaDinsDelGrup,
  comprovaIndicadors,
  parcDelMunicipi,
  pesDelParc,
  taxesPerMil,
} from "./j34-vehicles";

/**
 * La resposta és la real del mode massiu de l'EMEX del 3 de setembre del
 * 2026, retallada a sis municipis: Abella de la Conca (162 habitants),
 * Abrera, Barcelona, Girona, Sabadell i Xerta. Girona és la que s'ha
 * contrastat a mà amb la pàgina de l'Idescat: 46.124 turismes, 12.436
 * motocicletes, 9.537 camions i furgonetes + 278 tractors industrials =
 * 9.815 «vehicles industrials», 1.922 autobusos i altres, 70.297 en total.
 */
const FIXTURES = join(__dirname, "..", "adapters", "__fixtures__");
const fixture = (): unknown => JSON.parse(readFileSync(join(FIXTURES, "idescat-emex-vehicles-mun.json"), "utf8"));
const massiu = parseEmexMassiu(fixture());

describe("la resposta massiva", () => {
  it("porta els cinc indicadors de la taula t18, tots del 2024", () => {
    expect(comprovaIndicadors(massiu)).toEqual([]);
    expect(Object.values(INDICADORS_EMEX)).toHaveLength(5);
  });

  it("es queixa si falta un indicador o és d'una altra taula", () => {
    const sense = { ...massiu, indicadors: massiu.indicadors.filter((i) => i.id !== "f325") };
    expect(comprovaIndicadors(sense)).toEqual(["falta l'indicador f325 (motocicletes)"]);
    const altraTaula = {
      ...massiu,
      indicadors: massiu.indicadors.map((i) => (i.id === "f19" ? { ...i, taula: { id: "t99", nom: "Una altra" } } : i)),
    };
    expect(comprovaIndicadors(altraTaula)[0]).toMatch(/f19 \(turismes\) és de la taula t99/);
    const anysDiferents = {
      ...massiu,
      indicadors: massiu.indicadors.map((i) => (i.id === "f163" ? { ...i, any: 2023 } : i)),
    };
    expect(comprovaIndicadors(anysDiferents)[0]).toMatch(/no són tots del mateix any/);
  });
});

describe("el parc d'un municipi", () => {
  it("és el de Girona, xifra a xifra, i el total és la suma de les parts", () => {
    const girona = parcDelMunicipi(massiu, "170792");
    expect(girona).toEqual({
      any: 2024,
      parc: { total: 70297, turismes: 46124, motocicletes: 12436, industrials: 9815, altres: 1922 },
    });
    const p = girona!.parc;
    expect(p.turismes + p.motocicletes + p.industrials! + p.altres!).toBe(p.total);
  });

  it("un municipi que no hi és no té parc: cap zero inventat", () => {
    expect(parcDelMunicipi(massiu, "171220")).toBeNull();
  });

  it("sense total, turismes o motocicletes el municipi cau; sense industrials no", () => {
    const senseTotal = {
      ...massiu,
      indicadors: massiu.indicadors.map((i) =>
        i.id === "f163" ? { ...i, valors: new Map([...i.valors].map(([k, v]) => [k, k === "170792" ? null : v])) } : i),
    };
    expect(parcDelMunicipi(senseTotal, "170792")).toBeNull();
    expect(parcDelMunicipi(senseTotal, "080018")).not.toBeNull();
    const senseIndustrials = { ...massiu, indicadors: massiu.indicadors.filter((i) => i.id !== "f272") };
    expect(parcDelMunicipi(senseIndustrials, "170792")!.parc.industrials).toBeNull();
  });
});

describe("taxes i pesos", () => {
  const girona = parcDelMunicipi(massiu, "170792")!.parc;

  it("fa vehicles per 1.000 habitants amb un decimal", () => {
    // Padró del 2024 de Girona segons l'Idescat: 105.052 habitants.
    const taxes = taxesPerMil(girona, 105_052);
    expect(taxes).toEqual({ total: 669.2, turismes: 439.1, motocicletes: 118.4, industrials: 93.4, altres: 18.3 });
  });

  it("sense padró no hi ha taxa: un buit, no un zero", () => {
    expect(taxesPerMil(girona, null)).toBeNull();
    expect(taxesPerMil(girona, 0)).toBeNull();
  });

  it("el pes de turismes i motos dins del parc", () => {
    expect(pesDelParc(girona)).toEqual({ turismes: 65.6, motocicletes: 17.7 });
    expect(pesDelParc({ ...girona, total: 0 })).toBeNull();
  });

  it("el padró que fa servir és el de l'any de la dada, o el més proper fins a dos anys", () => {
    const padro = [{ any: 2022, valor: 103_000 }, { any: 2025, valor: 106_000 }];
    const [amb2025] = habitantsPerAny([2024], padro, 100_000);
    expect(amb2025).toEqual({ any: 2024, habitants: 106_000, anyPadro: 2025 });
    const [vigent] = habitantsPerAny([2024], [{ any: 2019, valor: 99_000 }], 100_000);
    expect(vigent).toEqual({ any: 2024, habitants: 100_000, anyPadro: null });
  });
});

describe("la comparació amb els de la seva mida", () => {
  // Tretze municipis del mateix tram (de 2.001 a 5.000 habitants) i un
  // sense població, que no té grup i per tant no pot comparar-se amb ningú.
  const municipis = [
    ...Array.from({ length: 13 }, (_, i) => ({ id: i + 1, population: 3_000 })),
    { id: 99, population: null },
  ];
  const grups = buildPeerGroups(municipis);
  const taxes = new Map<number, number>();
  for (let id = 1; id <= 13; id += 1) taxes.set(id, 500 + id * 10); // 510 … 630
  taxes.set(99, 400);

  it("dona la mediana i el percentil dins del grup, i quants tenen la dada", () => {
    const comparacions = comparaDinsDelGrup(taxes, grups);
    const setè = comparacions.get(7)!;
    expect(setè.mediana).toBe(570);
    expect(setè.percentil).toBe(50);
    expect(setè.grup.ambDada).toBe(13);
    expect(comparacions.get(13)!.percentil).toBe(96);
    expect(comparacions.get(1)!.percentil).toBe(4);
    expect(comparacions.get(99)).toBeUndefined();
  });

  it("qui no té taxa no hi entra ni fa baixar la mediana", () => {
    const menys = new Map(taxes);
    menys.delete(13);
    const comparacions = comparaDinsDelGrup(menys, grups);
    expect(comparacions.get(7)!.grup.ambDada).toBe(12);
    expect(comparacions.get(13)).toBeUndefined();
  });

  it("la clau de la mètrica és «vehicles»", () => {
    expect(KIND).toBe("vehicles");
  });
});
