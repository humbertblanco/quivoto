import { describe, expect, it } from "vitest";
import {
  agregaVots, etiquetesPct, graoDe, llistaDeLAlcaldia, quintilsDe, rampaDe,
  type LlistaAmbResultat,
} from "./vots-partit";

/**
 * Dos municipis de mostra. Les xifres no són les de ningú: el que es prova és
 * la definició del percentatge i qui hi entra, no què va treure cap partit.
 */
const municipis = [
  { id: 1, slug: "vic", name: "Vic" },
  { id: 2, slug: "salt", name: "Salt" },
];

const llista = (canvis: Partial<LlistaAmbResultat> & { id: number; municipalityId: number }): LlistaAmbResultat => ({
  sigles: "X",
  brandId: null,
  votes: 0,
  seats: 0,
  ...canvis,
});

const llistes: LlistaAmbResultat[] = [
  llista({ id: 11, municipalityId: 1, sigles: "ERC-AM", brandId: "erc", votes: 3_000, seats: 8 }),
  llista({ id: 12, municipalityId: 1, sigles: "PSC-CP", brandId: "psc", votes: 1_000, seats: 3 }),
  // Una llista local amb vots: compta al denominador i no surt enlloc.
  llista({ id: 13, municipalityId: 1, sigles: "GENT DE VIC", brandId: "local", votes: 1_000, seats: 2 }),
  llista({ id: 21, municipalityId: 2, sigles: "PSC-CP", brandId: "psc", votes: 2_000, seats: 5 }),
  llista({ id: 22, municipalityId: 2, sigles: "ERC-AM", brandId: "erc", votes: 1_000, seats: 2 }),
  // Es va presentar i no va treure cap regidoria: hi és igualment.
  llista({ id: 23, municipalityId: 2, sigles: "VOX", brandId: "vox", votes: 500, seats: 0 }),
];

// La font de la composició del ple escriu «PSC - CP» on el dataset electoral
// escriu «PSC-CP»: la clau dura ho ha d'igualar.
const alcaldies = new Map<number, string | null>([[1, "ERC-AM"], [2, "PSC - CP"]]);

describe("agregaVots", () => {
  const vots = agregaVots(municipis, llistes, alcaldies);

  it("el percentatge és sobre els vots a candidatures del municipi, llistes locals incloses", () => {
    // 3.000 de 5.000: la llista local hi compta al denominador encara que no
    // sigui de cap marca. És la mateixa xifra que diu la fitxa de candidatura.
    expect(vots["erc"]!["vic"]!.pct).toBe(60);
    expect(vots["psc"]!["vic"]!.pct).toBe(20);
    expect(vots["psc"]!["salt"]!.pct).toBeCloseTo((100 * 2_000) / 3_500, 6);
  });

  it("porta els vots, les regidories, l'alcaldia i el nom del municipi", () => {
    expect(vots["erc"]!["vic"]).toEqual({ nom: "Vic", pct: 60, vots: 3_000, regidories: 8, alcaldia: true });
    expect(vots["psc"]!["vic"]!.alcaldia).toBe(false);
    expect(vots["psc"]!["salt"]!.alcaldia).toBe(true);
    expect(vots["erc"]!["salt"]!.alcaldia).toBe(false);
  });

  it("qui es va presentar sense treure cap regidoria hi és, amb zero regidories", () => {
    expect(vots["vox"]!["salt"]).toEqual({ nom: "Salt", pct: (100 * 500) / 3_500, vots: 500, regidories: 0, alcaldia: false });
  });

  it("on una marca no es va presentar no hi ha entrada: absent, no zero", () => {
    // Un zero seria una dada; no presentar-s'hi no ho és, i el mapa ho ratlla.
    expect(vots["vox"]!["vic"]).toBeUndefined();
    expect(Object.keys(vots["vox"]!)).toEqual(["salt"]);
  });

  it("les llistes locals no són cap marca i no surten", () => {
    expect(vots["local"]).toBeUndefined();
  });

  it("dues llistes de la mateixa marca al mateix poble se sumen", () => {
    // Passa tres vegades el 2023, amb coalicions registrades a part. La
    // pregunta és quant pesa la marca al poble, no la llista.
    const dues = agregaVots(
      municipis,
      [
        llista({ id: 1, municipalityId: 1, sigles: "ERC-AM", brandId: "erc", votes: 600, seats: 2 }),
        llista({ id: 2, municipalityId: 1, sigles: "UP-ERC", brandId: "erc", votes: 400, seats: 1 }),
        llista({ id: 3, municipalityId: 1, sigles: "PSC-CP", brandId: "psc", votes: 1_000, seats: 3 }),
      ],
      new Map([[1, "UP-ERC"]]),
    );
    expect(dues["erc"]!["vic"]).toEqual({ nom: "Vic", pct: 50, vots: 1_000, regidories: 3, alcaldia: true });
  });

  it("una coalició que apunta a dues marques no compta per a cap", () => {
    const cap = agregaVots(
      municipis,
      [llista({ id: 1, municipalityId: 1, sigles: "SP-CUP-AM", brandId: "local", votes: 900, seats: 4 })],
      new Map(),
    );
    expect(cap).toEqual({});
  });

  it("un municipi que no és a la llista de municipis no entra enlloc", () => {
    const orfe = agregaVots(
      municipis,
      [llista({ id: 1, municipalityId: 99, sigles: "ERC-AM", brandId: "erc", votes: 100, seats: 1 })],
      new Map(),
    );
    expect(orfe).toEqual({});
  });
});

describe("llistaDeLAlcaldia", () => {
  const seves = llistes.filter((l) => l.municipalityId === 2);

  it("lliga per sigles exactes amb la clau dura, i per família si cal", () => {
    expect(llistaDeLAlcaldia(seves, "PSC - CP")).toBe(21);
    // «PSC-PM» no és cap de les sigles del ple, però és de la família del PSC
    // i només una llista del ple ho és.
    expect(llistaDeLAlcaldia(seves, "PSC-PM")).toBe(21);
  });

  it("no tria cap llista quan n'hi encaixen dues o cap", () => {
    expect(llistaDeLAlcaldia(seves, null)).toBeNull();
    expect(llistaDeLAlcaldia(seves, "GENT")).toBeNull();
    const dues = [
      llista({ id: 1, municipalityId: 1, sigles: "ERC-AM", brandId: "erc", votes: 100, seats: 2 }),
      llista({ id: 2, municipalityId: 1, sigles: "JOVES-ERC", brandId: "erc", votes: 100, seats: 2 }),
    ];
    expect(llistaDeLAlcaldia(dues, "ESQUERRA")).toBeNull();
  });
});

describe("quintilsDe", () => {
  it("parteix la llista en cinc parts iguals amb quatre talls", () => {
    expect(quintilsDe([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toEqual([3, 5, 7, 9]);
  });

  it("amb tots els valors iguals no hi ha cap tall", () => {
    expect(quintilsDe([7, 7, 7, 7, 7])).toEqual([]);
    expect(quintilsDe([])).toEqual([]);
  });

  it("no obre cap graó per sota del mínim ni en repeteix cap", () => {
    // Vuit zeros i dos valors: els tres primers talls valdrien zero, que és
    // un graó on no hi pot caure ningú, i el quart és l'1.
    expect(quintilsDe([0, 0, 0, 0, 0, 0, 0, 0, 1, 2])).toEqual([1]);
  });
});

describe("graoDe", () => {
  it("compta quants talls té per sota o iguals", () => {
    const talls = [4.1, 12.3, 35.6, 41.2];
    expect(graoDe(2, talls)).toBe(0);
    expect(graoDe(4.1, talls)).toBe(1);
    expect(graoDe(20, talls)).toBe(2);
    expect(graoDe(100, talls)).toBe(4);
    expect(graoDe(5, [])).toBe(0);
  });
});

describe("etiquetesPct", () => {
  it("escriu cada graó com un interval, i només el de dalt queda obert", () => {
    expect(etiquetesPct([4.1, 12.3, 35.6, 41.2])).toEqual([
      "menys del 4,1 %",
      "del 4,1 % al 12,3 %",
      "del 12,3 % al 35,6 %",
      "del 35,6 % al 41,2 %",
      "41,2 % o més",
    ]);
  });

  it("amb menys talls, menys graons; sense cap, cap etiqueta", () => {
    expect(etiquetesPct([15.2, 31.4])).toEqual(["menys del 15,2 %", "del 15,2 % al 31,4 %", "31,4 % o més"]);
    expect(etiquetesPct([])).toEqual([]);
  });
});

/** Lluminància relativa de la norma, per comprovar que la rampa no s'encreua. */
const lluminancia = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

describe("rampaDe", () => {
  const colors = ["#d00c3c", "#ffb232", "#00c3b2", "#d8d000", "#1d3f6e", "#6d7f8a"];

  it("dona cinc graons en clar i cinc en fosc, tots hexadecimals", () => {
    for (const color of colors) {
      const { clar, fosc } = rampaDe(color);
      expect(clar).toHaveLength(5);
      expect(fosc).toHaveLength(5);
      for (const c of [...clar, ...fosc]) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("la lluminància sempre baixa en clar i sempre puja en fosc, sigui quin sigui el color", () => {
    // És el que fa que els graons es distingeixin també sense veure el color:
    // en clar el valor alt és el fosc, i damunt del paper fosc s'ha de girar.
    for (const color of colors) {
      const { clar, fosc } = rampaDe(color);
      for (let k = 1; k < 5; k += 1) {
        expect(lluminancia(clar[k]!), `${color} clar ${k}`).toBeLessThan(lluminancia(clar[k - 1]!));
        expect(lluminancia(fosc[k]!), `${color} fosc ${k}`).toBeGreaterThan(lluminancia(fosc[k - 1]!));
      }
    }
  });

  it("manté el to de la marca: el vermell del PSC continua sent vermell a cada graó", () => {
    for (const c of rampaDe("#d00c3c").clar) {
      const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(c.slice(i, i + 2), 16));
      expect(r).toBeGreaterThan(g!);
      expect(r).toBeGreaterThan(b!);
    }
  });

  it("un color que no és cap hexadecimal surt en gris, no peta", () => {
    const { clar } = rampaDe("javascript:alert(1)");
    expect(clar).toEqual(rampaDe("#8b8b8b").clar);
  });
});
