import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Els947Row } from "./els947";
import { geometria } from "./mapa";
import {
  aMunicipi, adjacenciaDeCamins, adjacenciaMunicipal, anellsDelCami, escriuVeins, INDICADORS_VEINS, renderVeins, veinsAmbXifra,
  type VeiAmbXifra,
} from "./veins";

describe("anellsDelCami", () => {
  it("llegeix M absoluta, l, h i v relatives i tanca amb Z", () => {
    expect(anellsDelCami("M0 0h10v10h-10Z")).toEqual([[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]]);
    expect(anellsDelCami("M5 5l3 -2l-3 -2Z")).toEqual([[[5, 5], [8, 3], [5, 1], [5, 5]]]);
  });

  it("separa els anells d'un MultiPolygon i accepta les variants absolutes", () => {
    const anells = anellsDelCami("M0 0L4 0V4H0ZM10 10l1 0l0 1Z");
    expect(anells).toHaveLength(2);
    expect(anells[0]).toEqual([[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]]);
    expect(anells[1]![0]).toEqual([10, 10]);
  });
});

describe("adjacenciaDeCamins sobre una topologia inventada", () => {
  /**
   * Quatre quadrats en graella de 2 × 2 i una illa: A i D només es toquen en
   * diagonal, a la cantonada (10,10), i no són veïns. B es dibuixa en sentit
   * contrari, perquè la frontera compartida es recorre al revés als dos camins.
   */
  const camins = {
    a: "M0 0h10v10h-10Z",
    b: "M10 0v10h10v-10Z",
    c: "M0 10h10v10h-10Z",
    d: "M10 10h10v10h-10Z",
    illa: "M100 100h5v5h-5Z",
  };
  const adj = adjacenciaDeCamins(camins);

  it("fa veïns els que comparteixen un segment, en qualsevol sentit", () => {
    expect(adj.get("a")).toEqual(["b", "c"]);
    expect(adj.get("b")).toEqual(["a", "d"]);
    expect(adj.get("d")).toEqual(["b", "c"]);
  });

  it("un sol punt en comú no fa veïns", () => {
    expect(adj.get("a")).not.toContain("d");
    expect(adj.get("c")).not.toContain("b");
  });

  it("qui no toca ningú hi surt amb la llista buida", () => {
    expect(adj.get("illa")).toEqual([]);
    expect([...adj.keys()]).toEqual(["a", "b", "c", "d", "illa"]);
  });
});

describe("adjacenciaMunicipal sobre la geometria real", () => {
  const adj = adjacenciaMunicipal();

  it("té els 947 i és simètrica", () => {
    expect(adj.size).toBe(Object.keys(geometria.municipis).length);
    for (const [s, veins] of adj) for (const v of veins) expect(adj.get(v), `${v} ↔ ${s}`).toContain(s);
  });

  it("Barcelona toca amb onze municipis, i no amb Badalona", () => {
    expect(adj.get("barcelona")).toEqual([
      "cerdanyola-del-valles", "esplugues-de-llobregat", "hospitalet-de-llobregat", "molins-de-rei", "montcada-i-reixac",
      "prat-de-llobregat", "sant-adria-de-besos", "sant-cugat-del-valles", "sant-feliu-de-llobregat", "sant-just-desvern",
      "santa-coloma-de-gramenet",
    ]);
    expect(adj.get("badalona")).toContain("sant-adria-de-besos");
    expect(adj.get("badalona")).not.toContain("barcelona");
  });

  it("Girona toca amb Salt i Sarrià de Ter, i Llívia, enclavament, amb ningú", () => {
    expect(adj.get("girona")).toEqual(expect.arrayContaining(["salt", "sarria-de-ter", "sant-gregori", "quart"]));
    expect(adj.get("llivia")).toEqual([]);
    expect([...adj].filter(([, v]) => v.length === 0).map(([s]) => s)).toEqual(["llivia"]);
  });

  it("escriuVeins desa el JSON amb la font i la llicència de la geometria", async () => {
    const dir = await mkdtemp(join(tmpdir(), "veins-"));
    try {
      const cami = join(dir, "dades", "veins.json");
      const escrit = await escriuVeins(cami);
      const llegit = JSON.parse(await readFile(cami, "utf8"));
      expect(llegit).toEqual(escrit);
      expect(llegit.llicencia).toBe("CC BY 4.0");
      expect(llegit.actualitzat).toBe(geometria.actualitzat);
      expect(llegit.veins.barcelona).toHaveLength(11);
      expect(Object.keys(llegit.veins)).toHaveLength(947);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

/** Una fila d'els947 amb només el que fan servir els veïns; la resta no hi compta. */
const fila = (s: string, n: string, p: number, extra: Partial<Els947Row> = {}): Els947Row =>
  ({ s, n, p, d: null, pt: null, ibi: null, ibia: null, ...extra }) as Els947Row;

describe("veinsAmbXifra", () => {
  const adj = new Map([["centre", ["a", "b", "c", "d", "e", "f", "g", "fantasma"]]]);
  const files = [
    fila("a", "Abrera", 12_000, { d: 300 }),
    fila("b", "Begues", 7_000, { d: 0 }),
    fila("c", "Cervelló", 9_000, { d: null }),
    fila("d", "Dosrius", 5_000, { d: 120 }),
    fila("e", "Esparreguera", 22_000, { d: 450 }),
    fila("f", "Figaró", 1_000, { d: 80 }),
    fila("g", "Gelida", 7_500, { d: 200 }),
    fila("centre", "el Centre", 50_000, { d: 500 }),
  ];

  it("es queda els més poblats, els ordena per nom i no es pensa cap xifra", () => {
    const tria = veinsAmbXifra("centre", adj, files, INDICADORS_VEINS.deute);
    expect(tria.veins.map((v) => v.nom)).toEqual(["Abrera", "Begues", "Cervelló", "Dosrius", "Esparreguera", "Gelida"]);
    expect(tria.total).toBe(8);
    expect(tria.fora).toBe(2);
    // Zero és una xifra (no té deute) i null és «no consta»: no es confonen.
    expect(tria.veins.find((v) => v.slug === "b")!.valor).toBe(0);
    expect(tria.veins.find((v) => v.slug === "c")!.valor).toBeNull();
  });

  it("porta l'any de cada veí quan l'indicador no en té un de comú", () => {
    const tria = veinsAmbXifra("x", new Map([["x", ["a"]]]), [fila("a", "Abrera", 1, { ibi: 412.4, ibia: 2024 })], INDICADORS_VEINS.ibi);
    expect(tria.veins).toEqual([{ slug: "a", nom: "Abrera", valor: 412.4, any: 2024 }]);
    const pt = veinsAmbXifra("x", new Map([["x", ["a"]]]), [fila("a", "Abrera", 1, { pt: 61.25 })], INDICADORS_VEINS.participacio);
    expect(pt.veins[0]!.any).toBe(2023);
  });
});

describe("renderVeins", () => {
  const veins: VeiAmbXifra[] = [
    { slug: "esplugues-de-llobregat", nom: "Esplugues de Llobregat", valor: 312, any: null },
    { slug: "hospitalet-de-llobregat", nom: "l'Hospitalet de Llobregat", valor: null, any: null },
    { slug: "sant-just-desvern", nom: "Sant Just Desvern", valor: 1250.6, any: null },
  ];

  it("fa una caseta per veí, que porta a la seva fitxa, amb «no consta» als buits", () => {
    const html = renderVeins({ slug: "barcelona", nom: "Barcelona" }, veins, INDICADORS_VEINS.deute, { total: 11 });
    expect(html.match(/<li class="vn-casa">/g)).toHaveLength(3);
    expect(html).toContain('<a href="../sant-just-desvern/">');
    expect(html).toContain('<span class="vn-xifra">1.251 €</span>');
    expect(html).toContain('<span class="vn-xifra vn-buit">no consta</span>');
    expect(html).toContain("Barcelona toca de terme amb 11 municipis. Aquí hi ha els 3 més poblats, per ordre alfabètic.");
    expect(html).toContain("Quant deuen els ajuntaments veïns de Barcelona");
    expect(html).toContain("l'Hospitalet de Llobregat");
    expect(html).toContain('<span class="nomes-lectors">, deute per habitant: </span>');
    expect(html).toContain('aria-hidden="true"');
  });

  it("diu la xifra pròpia a l'entrada, amb la contracció de l'article", () => {
    expect(renderVeins({ slug: "p", nom: "el Prat de Llobregat", valor: 640 }, veins, INDICADORS_VEINS.deute)).toContain(
      "El Prat de Llobregat toca de terme amb 3 municipis. Al Prat de Llobregat, 640 €.",
    );
    expect(renderVeins({ slug: "v", nom: "Vic", valor: null }, veins, INDICADORS_VEINS.deute)).toContain("A Vic, no consta.");
  });

  it("l'any comú va al peu, i el de cada veí només quan és diferent", () => {
    const pt = renderVeins({ slug: "v", nom: "Vic" }, [{ slug: "gurb", nom: "Gurb", valor: 71.5, any: 2023 }], INDICADORS_VEINS.participacio);
    expect(pt).toContain("71,5 %");
    expect(pt).toContain("(2023).");
    expect(pt).not.toContain("vn-any");
    const ibi = renderVeins({ slug: "v", nom: "Vic" }, [{ slug: "gurb", nom: "Gurb", valor: 400, any: 2024 }], INDICADORS_VEINS.ibi);
    expect(ibi).toContain('<span class="vn-any">2024</span>');
  });

  it("sense veïns no hi ha bloc, i el que ve de fora s'escapa", () => {
    expect(renderVeins({ slug: "llivia", nom: "Llívia" }, [], INDICADORS_VEINS.deute)).toBe("");
    const html = renderVeins({ slug: "x", nom: "X" }, [{ slug: "y", nom: "<b>Y</b>", valor: 1, any: null }], INDICADORS_VEINS.deute);
    expect(html).not.toContain("<b>");
  });

  it("aMunicipi contrau l'article", () => {
    expect(aMunicipi("Vic")).toBe("A Vic");
    expect(aMunicipi("el Masnou")).toBe("Al Masnou");
    expect(aMunicipi("els Hostalets de Pierola")).toBe("Als Hostalets de Pierola");
    expect(aMunicipi("l'Hospitalet de Llobregat")).toBe("A l'Hospitalet de Llobregat");
  });
});
