import { describe, expect, it } from "vitest";
import {
  repartimentConsell,
  repartimentDiputacio,
  seientsConsell,
  seientsDiputacio,
  seientsPerDistricte,
  type CandidaturaMunicipi,
  type VotsMunicipi,
} from "./escons-ens";

/** Una candidatura sense llista oberta: `candidats` null, com ve de `ntc4-rnwr`. */
const c = (partit: string, vots: number, regidors: number, candidats: number | null = null): CandidaturaMunicipi => ({
  partit, vots, regidors, candidats,
});

let seguent = 1;
const muni = (poblacio: number, candidatures: CandidaturaMunicipi[], extra: Partial<VotsMunicipi> = {}): VotsMunicipi => ({
  municipalityId: seguent++, poblacio, candidatures, ...extra,
});

/** Escons calculats per partit, només els que en tenen. */
const calculats = (r: ReturnType<typeof repartimentConsell>): Record<string, number> =>
  Object.fromEntries(r.files.filter((f) => f.seientsCalculats > 0).map((f) => [f.partit, f.seientsCalculats]));

describe("quants escons", () => {
  it("diputacions pels trams de l'art. 204.1", () => {
    expect(seientsDiputacio(441_443)).toBe(25); // Lleida
    expect(seientsDiputacio(500_000)).toBe(25);
    expect(seientsDiputacio(500_001)).toBe(27);
    expect(seientsDiputacio(830_075)).toBe(27); // Tarragona
    expect(seientsDiputacio(3_500_000)).toBe(31);
    expect(seientsDiputacio(5_727_615)).toBe(51); // Barcelona
  });

  it("consells pels trams del DL 4/2003, 20.1", () => {
    expect(seientsConsell(50_000)).toBe(19);
    expect(seientsConsell(50_001)).toBe(25);
    expect(seientsConsell(100_000)).toBe(25);
    expect(seientsConsell(100_001)).toBe(33);
    expect(seientsConsell(500_001)).toBe(39);
  });
});

describe("seientsPerDistricte", () => {
  it("reprodueix els nou districtes de Lleida del 2023 (padró 2022)", () => {
    const lleida = [
      { nom: "Balaguer", poblacio: 64_061 }, { nom: "Cervera", poblacio: 51_143 },
      { nom: "La Seu d'Urgell", poblacio: 21_763 }, { nom: "Les Borges Blanques", poblacio: 19_011 },
      { nom: "Lleida", poblacio: 229_615 }, { nom: "Solsona", poblacio: 21_244 },
      { nom: "Sort", poblacio: 7_181 }, { nom: "Tremp", poblacio: 17_157 },
      { nom: "Vielha e Mijaran", poblacio: 10_268 },
    ];
    expect(Object.fromEntries(seientsPerDistricte(lleida, 25))).toEqual({
      Balaguer: 3, Cervera: 3, "La Seu d'Urgell": 1, "Les Borges Blanques": 1,
      Lleida: 13, Solsona: 1, Sort: 1, Tremp: 1, "Vielha e Mijaran": 1,
    });
  });

  it("si en falten, l'afegeix al districte amb més residents per diputat (Tarragona)", () => {
    // Arrodonits: 5 + 7 + 7 + 5 + 2 = 26; falta un escó i Valls és qui té més residents per diputat.
    const tarragona = [
      { nom: "El Vendrell", poblacio: 154_805 }, { nom: "Reus", poblacio: 225_865 },
      { nom: "Tarragona", poblacio: 220_460 }, { nom: "Tortosa", poblacio: 161_400 },
      { nom: "Valls", poblacio: 67_545 },
    ];
    expect(Object.fromEntries(seientsPerDistricte(tarragona, 27))).toEqual({
      "El Vendrell": 5, Reus: 7, Tarragona: 7, Tortosa: 5, Valls: 3,
    });
  });

  it("aplica el mínim d'un, el sostre de tres cinquens i treu els que sobren", () => {
    const r = seientsPerDistricte(
      [{ nom: "Gran", poblacio: 950_000 }, { nom: "Petit A", poblacio: 30_000 }, { nom: "Petit B", poblacio: 20_000 }],
      25,
    );
    // Proporció: 23,75 / 0,75 / 0,5 → 24, 1, 1; sostre floor(25·3/5) = 15; i s'omple fins a 25.
    expect(r.get("Gran")).toBe(15);
    expect([...r.values()].reduce((a, b) => a + b, 0)).toBe(25);
    expect(r.get("Petit A")).toBeGreaterThanOrEqual(1);
    expect(r.get("Petit B")).toBeGreaterThanOrEqual(1);

    // Massa districtes petits que arrodoneixen amunt: es treu a qui té menys residents per diputat.
    // Quotes 1,5 / 1,5 / 1,4 / 0,6 → 2 + 2 + 1 + 1 = 6 per a 5 escons. D (60 per
    // diputat) té el mínim i no es toca; A i B (75) empaten i decideix el nom.
    const sobren = seientsPerDistricte(
      [{ nom: "A", poblacio: 150 }, { nom: "B", poblacio: 150 }, { nom: "C", poblacio: 140 }, { nom: "D", poblacio: 60 }],
      5,
    );
    expect(Object.fromEntries(sobren)).toEqual({ A: 1, B: 2, C: 1, D: 1 });
  });
});

describe("repartimentDiputacio", () => {
  it("només hi entren els partits amb regidor al districte, però hi compten tots els seus vots", () => {
    const r = repartimentDiputacio(
      [{
        nom: "Únic",
        municipis: [
          muni(5_000, [c("A", 1_000, 7), c("B", 900, 4), c("C", 2_000, 0)]),
          // B no hi treu ningú, però aquests vots seus també compten.
          muni(3_000, [c("A", 100, 6), c("B", 500, 0)]),
        ],
      }],
      3,
      null,
    );
    // C té més vots que ningú i cap regidor: fora. A 1.100, B 1.400 → B, A, B.
    expect(calculats(r)).toEqual({ B: 2, A: 1 });
    expect(r.files.map((f) => f.partit)).not.toContain("C");
    expect(r.districtes).toEqual([
      { nom: "Únic", poblacio: 8_000, seients: 3, perPartit: [{ partit: "B", seients: 2 }, { partit: "A", seients: 1 }] },
    ]);
  });

  it("a quocients iguals guanya qui té més vots, i després qui té més regidors", () => {
    // A 100 i B 50: el segon escó empata a 50 i és d'A per vots.
    const perVots = repartimentDiputacio([{ nom: "D", municipis: [muni(9_000, [c("A", 100, 3), c("B", 50, 2)])] }], 3, null);
    expect(calculats(perVots)).toEqual({ A: 2, B: 1 });

    // Mateixos vots: decideixen els regidors del districte.
    const perRegidors = repartimentDiputacio([{ nom: "D", municipis: [muni(9_000, [c("A", 60, 3), c("B", 60, 5)])] }], 1, null);
    expect(calculats(perRegidors)).toEqual({ B: 1 });
    expect(perRegidors.diferencies).toEqual([]);

    // També mateixos regidors: la llei sorteja, i el càlcul ho diu.
    const sorteig = repartimentDiputacio([{ nom: "D", municipis: [muni(9_000, [c("A", 60, 4), c("B", 60, 4)])] }], 1, null);
    expect(sorteig.diferencies).toEqual(["Un escó d'A surt d'un empat que la llei resol per sorteig."]);

    // Empat total però amb escons per a tots dos: quatre escons van dos i dos
    // tregui qui tregui primer, i no hi ha cap sorteig que canviï res.
    const senseEfecte = repartimentDiputacio([{ nom: "D", municipis: [muni(9_000, [c("A", 60, 4), c("B", 60, 4)])] }], 4, null);
    expect(calculats(senseEfecte)).toEqual({ A: 2, B: 2 });
    expect(senseEfecte.diferencies).toEqual([]);

    // Tres empatats i dos escons: aquí sí que el sorteig decideix qui es queda fora.
    const tres = repartimentDiputacio(
      [{ nom: "D", municipis: [muni(9_000, [c("A", 60, 4), c("B", 60, 4), c("C", 60, 4)])] }],
      2,
      null,
    );
    // El primer escó es sorteja entre tres i el segon entre els dos que queden.
    expect(tres.diferencies).toHaveLength(2);
  });

  it("compara amb el ple i ho diu en una frase per partit", () => {
    const districtes = [{ nom: "D", municipis: [muni(9_000, [c("PSC", 900, 8), c("ERC", 450, 5), c("CUP", 300, 1)])] }];
    // D'Hondt amb 5: PSC 900, 450, 300 (empata amb CUP 300 i guanya per vots) → PSC 3, ERC 1, CUP 1.
    const quadra = repartimentDiputacio(districtes, 5, new Map([["PSC", 3], ["ERC", 1], ["CUP", 1]]));
    expect(quadra.quadra).toBe(true);
    expect(quadra.diferencies).toEqual([]);

    const noQuadra = repartimentDiputacio(districtes, 5, new Map([["PSC", 2], ["ERC", 1], ["Junts", 2]]));
    expect(noQuadra.quadra).toBe(false);
    expect(noQuadra.diferencies).toEqual([
      "El càlcul dona 3 escons al PSC i el ple en té 2.",
      "El càlcul dona 1 escó a la CUP i el ple no en té cap.",
      "El càlcul no dona cap escó a Junts i el ple en té 2.",
    ]);
    // Junts té escons al ple sense haver entrat al càlcul: també surt a les files.
    expect(noQuadra.files.find((f) => f.partit === "Junts")).toMatchObject({ seientsCalculats: 0, seientsReals: 2 });

    const senseReals = repartimentDiputacio(districtes, 5, null);
    expect(senseReals.quadra).toBe(false);
    expect(senseReals.files.every((f) => f.seientsReals === null && f.puntuacio === null)).toBe(true);
  });
});

describe("llistes obertes (municipis de fins a 250 habitants)", () => {
  it("divideix la suma de vots personals pels candidats, fins a quatre, i arrodoneix avall", () => {
    const r = repartimentDiputacio(
      [{ nom: "D", municipis: [muni(120, [c("A", 103, 3, 5), c("B", 50, 2, 2)])] }],
      1,
      null,
    );
    // A: 103 / min(5, 4) = 25,75 → 25. B: 50 / 2 = 25. Empat de vots: més regidors, A.
    expect(r.files.find((f) => f.partit === "A")!.vots).toBe(25);
    expect(r.files.find((f) => f.partit === "B")!.vots).toBe(25);
    expect(calculats(r)).toEqual({ A: 1 });
  });

  it("amb candidats null pren els vots tal com venen (ntc4 ja els porta dividits)", () => {
    const r = repartimentDiputacio([{ nom: "D", municipis: [muni(120, [c("A", 26, 3), c("B", 25, 2)])] }], 1, null);
    expect(r.files.map((f) => f.vots)).toEqual([26, 25]);
  });

  it("es fia del ple que en va sortir més que del padró", () => {
    // Set regidors vol dir més de 250 habitants el 2023, encara que el padró d'ara en digui 240.
    const r = repartimentDiputacio([{ nom: "D", municipis: [muni(240, [c("A", 80, 4, 7), c("B", 60, 3, 7)])] }], 1, null);
    expect(r.files.map((f) => f.vots)).toEqual([80, 60]);
  });
});

describe("repartimentConsell", () => {
  it("puntua 1/3 del % de regidors i 2/3 del % de vots, sobre tots els de la comarca", () => {
    const r = repartimentConsell(
      [muni(30_000, [c("A", 600, 10), c("B", 300, 8), c("C", 80, 2), c("D", 20, 0)])],
      null,
    );
    // Vots 1.000 i regidors 20 en total (D, sota el 3 %, també compta als totals).
    const a = r.files.find((f) => f.partit === "A")!;
    expect(a.puntuacio).toBeCloseTo(50 / 3 + (60 * 2) / 3, 10);
    expect(r.files.map((f) => f.partit)).not.toContain("D");
    expect(r.files.reduce((s, f) => s + f.seientsCalculats, 0)).toBe(19);
    expect(r.districtes).toBeNull();
  });

  it("a quocients iguals mana la puntuació i després els vots", () => {
    // V = 120 i R = 12. Pes (numerador comú de la puntuació) = r·V + 2·v·R:
    // A = 4·120 + 2·50·12 = 1.680 i B = 2·120 + 2·60·12 = 1.680. Empat exacte,
    // que en coma flotant no es veuria. A cada empat B passa davant per vots.
    const r = repartimentConsell([muni(30_000, [c("A", 50, 4), c("B", 60, 2), c("X", 10, 6)])], null);
    const a = r.files.find((f) => f.partit === "A")!;
    const b = r.files.find((f) => f.partit === "B")!;
    expect(a.puntuacio).toBeCloseTo(b.puntuacio!, 12);
    expect(b.seientsCalculats - a.seientsCalculats).toBe(1);
    expect(r.diferencies).toEqual([]);
  });
});

/**
 * Tres comarques del 2023 resumides en un sol «municipi» (només compten les
 * sumes): els partits que passen del 2,5 %, la resta en trossos per sota del
 * 3 %, i els blancs i nuls de `irrv-2mfc`. Són les que decideixen sobre quins
 * vots es fan els percentatges.
 */
const comarca = (poblacio: number, partits: [string, number, number][], altres: [number, number][], blancs: number, nuls: number) =>
  muni(poblacio, [...partits.map(([p, v, r]) => c(p, v, r)), ...altres.map(([v, r], i) => c(`altres${i}`, v, r))], { blancs, nuls });

describe("les bases dels percentatges, contra els plens del 2023", () => {
  const baixEbre = (ambBlancs: boolean) => comarca(
    79_636,
    [["CM", 13_564, 51], ["AM", 9_661, 71], ["PSC-CP", 6_467, 26]],
    [[726, 3], [656, 1], [555, 0], [766, 0], [402, 0]],
    ambBlancs ? 671 : 0,
    ambBlancs ? 743 : 0,
  );

  it("Baix Ebre: amb els blancs al percentatge de vots, Junts 10, ERC 10 i PSC 5", () => {
    expect(calculats(repartimentConsell([baixEbre(true)], null))).toEqual({ CM: 10, AM: 10, "PSC-CP": 5 });
    // Sense blancs ni nuls, ERC en perdria un: per això cal passar-los.
    expect(calculats(repartimentConsell([baixEbre(false)], null))).toEqual({ CM: 11, AM: 9, "PSC-CP": 5 });
  });

  it("Vallès Oriental: amb els nuls a la barrera del 3 %, Vox queda fora", () => {
    const partits: [string, number, number][] = [
      ["PSC-CP", 45_635, 126], ["AM", 29_259, 114], ["CM", 27_183, 109], ["C", 12_491, 33],
      ["AMUNT", 6_842, 19], ["PP", 6_047, 10], ["VOX", 4_871, 7],
    ];
    const altres: [number, number][] = [[2_349, 6], [2_160, 11], [3_940, 10], [3_030, 2], [3_713, 15], [3_890, 16], [3_776, 17], [3_934, 19]];
    const reals = new Map([["PSC-CP", 12], ["AM", 8], ["CM", 8], ["C", 3], ["AMUNT", 1], ["PP", 1]]);
    const r = repartimentConsell([comarca(414_991, partits, altres, 3_036, 2_517)], reals);
    expect(r.quadra).toBe(true);
    expect(r.files.map((f) => f.partit)).not.toContain("VOX");
  });

  it("Alt Camp: els nuls no entren al percentatge de vots (Junts hi té vuit consellers)", () => {
    const r = repartimentConsell([comarca(
      45_540,
      [["CM", 5_777, 57], ["AM", 4_013, 49], ["PSC-CP", 3_089, 17], ["ApCANVI", 1_638, 11], ["AMUNT", 1_107, 5], ["VOX", 524, 1]],
      [[373, 0], [369, 6], [287, 14], [432, 14], [342, 11], [318, 2]],
      528,
      454,
    )], null);
    // El ple en té 2 del PSC i un seient vacant: el tercer del PSC.
    expect(calculats(r)).toEqual({ CM: 8, AM: 5, "PSC-CP": 3, ApCANVI: 2, AMUNT: 1 });
  });
});
