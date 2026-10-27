import { describe, expect, it } from "vitest";
import { DESCRIPCIO_MAXIMA, TITOL_MAXIM } from "./seo";
import {
  anysEscrits,
  escalaDomini,
  marquesDe,
  marquesRodones,
  nivellsSenseSolapar,
  normalitza,
  quantil,
  renderComparador,
  repartimentDe,
  type ComparadorRow,
} from "./comparador";
import { textEtiqueta } from "./grafics";

describe("normalitza", () => {
  it("troba un municipi sense accents ni article", () => {
    expect(normalitza("l'Hospitalet de Llobregat")).toBe("hospitalet de llobregat");
    expect(normalitza("la Seu d'Urgell")).toBe("seu d urgell");
    expect(normalitza("Móra d'Ebre")).toBe("mora d ebre");
    expect(normalitza("Sant Julià de Ramis")).toBe("sant julia de ramis");
  });

  it("la cerca de l'usuari passa pel mateix sedàs que el nom", () => {
    expect(normalitza("l'Hospitalet de Llobregat").includes(normalitza("Hospitalet"))).toBe(true);
    expect(normalitza("la Seu d'Urgell").includes(normalitza("la seu"))).toBe(true);
  });
});

/**
 * Les dues funcions que viatgen a la pàgina s'hi incrusten amb `toString()`, i
 * al navegador s'executen soles. `new Function` reprodueix exactament això: si
 * el transpilador hi ha ficat cap ajudant seu —li va passar a una versió
 * anterior amb `__name`— o si la funció toca res de fora, aquí peta i a la
 * pàgina hauria petat en silenci.
 */
const aillada = <T>(fn: T): T => new Function("return (" + String(fn) + ")")() as T;

describe("el que s'incrusta a la pàgina", () => {
  it("marquesDe funciona sense res del seu mòdul al voltant", () => {
    expect(aillada(marquesDe)("avall", undefined, [253, 900, 12])).toEqual(["", "pitjor", "millor"]);
    expect(aillada(marquesDe)("objectiu", 50, [78, 52])).toEqual(["pitjor", "millor"]);
    expect(aillada(marquesDe)("cap", undefined, [1, 2])).toEqual(["", ""]);
  });

  it("normalitza funciona sense res del seu mòdul al voltant", () => {
    expect(aillada(normalitza)("l'Hospitalet de Llobregat")).toBe("hospitalet de llobregat");
  });
});

describe("marquesDe", () => {
  it("com més baix, millor: el deute", () => {
    expect(marquesDe("avall", undefined, [253, 900, 12])).toEqual(["", "pitjor", "millor"]);
  });

  it("com més alt, millor: la participació", () => {
    expect(marquesDe("amunt", undefined, [52.9, 61.2, 48])).toEqual(["", "millor", "pitjor"]);
  });

  it("el sentit no es dedueix del signe: estalvi negatiu és el pitjor, no el més petit", () => {
    expect(marquesDe("amunt", undefined, [-3.2, 11.7])).toEqual(["pitjor", "millor"]);
    expect(marquesDe("avall", undefined, [-3.2, 11.7])).toEqual(["millor", "pitjor"]);
  });

  it("la paritat es mesura per proximitat al 50 %, no per «com més dones millor»", () => {
    // 80 i 20 són igual de lluny de la paritat: cap dels dos no és millor que l'altre.
    expect(marquesDe("objectiu", 50, [50, 80, 20])).toEqual(["millor", "pitjor", "pitjor"]);
    expect(marquesDe("objectiu", 50, [50, 80, 35])).toEqual(["millor", "pitjor", ""]);
    // Un ple amb un 78 % de dones no és «millor» que un del 52 %.
    expect(marquesDe("objectiu", 50, [78, 52])).toEqual(["pitjor", "millor"]);
  });

  it("l'IBI no té un «millor»: només s'assenyalen els extrems", () => {
    expect(marquesDe("neutre", undefined, [0.7, 1.1, 0.4])).toEqual(["", "alt", "baix"]);
  });

  it("no marca res on no hi ha comparació possible", () => {
    expect(marquesDe("cap", undefined, [48221, 20500])).toEqual(["", ""]);
    expect(marquesDe("avall", undefined, [253, null])).toEqual(["", ""]);
    expect(marquesDe("amunt", undefined, [61, 61, 61])).toEqual(["", "", ""]);
  });

  it("marca tots els empats, no només el primer", () => {
    expect(marquesDe("avall", undefined, [10, 10, 90, 90])).toEqual(["millor", "millor", "pitjor", "pitjor"]);
  });

  it("salta els municipis sense dada sense desquadrar les posicions", () => {
    expect(marquesDe("amunt", undefined, [null, 90, 30, null])).toEqual(["", "millor", "pitjor", ""]);
  });
});

const fila = (slug: string, nom: string, valors: Record<string, number | null>): ComparadorRow => ({
  slug,
  nom,
  comarca: "Baix Llobregat",
  grup: "de 20.001 a 50.000 habitants",
  valors: { poblacio: 20_000, regidories: 21, ...valors },
  percentils: { deute: 42 },
  textos: {
    govern: { principal: "PSC-CP", secundari: "Algú Altre" },
    majoria: { principal: "Sí", secundari: "11 de 21 regidories" },
  },
});

describe("renderComparador", () => {
  const rows = [
    fila("esplugues-de-llobregat", "Esplugues de Llobregat", { deute: 253, selectiva: null }),
    fila("sant-just-desvern", "Sant Just Desvern", { deute: 120, selectiva: null }),
  ];

  it("incrusta el conjunt i la funció que decideix el millor, no una còpia", () => {
    const html = renderComparador(rows, "2026-08-29");
    expect(html).toContain("esplugues-de-llobregat");
    expect(html).toContain("const marquesDe = function marquesDe(");
    expect(html).toContain("const normalitza = function normalitza(");
  });

  it("no treu la fila de la recollida selectiva del no-res", () => {
    const sense = renderComparador(rows, "2026-08-29");
    expect(sense).not.toContain("Recollida selectiva");

    const amb = renderComparador(
      [rows[0]!, { ...rows[1]!, valors: { ...rows[1]!.valors, selectiva: 61.4 } }],
      "2026-08-29",
    );
    expect(amb).toContain("Recollida selectiva");
  });

  it("cap fila no es publica sense dir d'on surt", () => {
    const html = renderComparador(rows, "2026-08-29");
    for (const font of [
      "6nei-4b44", "irrv-2mfc", "34db8dc5", "81f18313", "eecca986", "82ae0ea2", "xnfg-weec", "1a9c1ede",
      // Les cinc files noves: el capítol de govern, l'aigua, l'IBI, la renda i el cens.
      "8squ-bk4r", "ACA, Observatori del preu de l&#039;aigua".replace("&#039;", "'"),
      "Idescat, IBI urbà (taula 173)", "INE, ADRH", "Idescat, cens de població",
      // I la seguretat, del balanç de criminalitat del Ministeri.
      "Ministeri de l'Interior, portal SEC",
    ]) {
      expect(html).toContain(font);
    }
    // I el glossari en porta l'any quan les files en tenen un.
    const glossari = renderComparador(
      rows.map((r) => ({ ...r, valors: { ...r.valors, renda: 15_000 }, anys: { renda: 2023 } })),
      "2026-08-29",
    );
    expect(glossari).toContain("<code>INE, ADRH</code> · 2023");
  });

  it("el glossari va plegat i s'obre amb el títol de sempre", () => {
    const html = renderComparador(rows, "2026-08-29");
    expect(html).toContain('<details class="nota glossari">');
    expect(html).toContain("<summary>Què hi ha a cada fila i d'on surt</summary>");
    // La taula de fonts és a dins del plec, no fora.
    expect(html.indexOf('<details class="nota glossari">')).toBeLessThan(html.indexOf('<table class="fonts-fila">'));
    expect(html.indexOf('<table class="fonts-fila">')).toBeLessThan(html.indexOf("</details>"));
  });

  it("carrega la tipografia de la casa abans de l'estil", () => {
    // La pàgina viu a «observatori/comparador/»: l'arrel del web és dos nivells
    // amunt, i és `tipografia` qui ho sap, no aquesta pàgina.
    const html = renderComparador(rows, "2026-08-29");
    expect(html).toContain('href="../../assets/fonts.css"');
    expect(html.indexOf("assets/fonts.css")).toBeLessThan(html.indexOf("<style>"));
  });

  it("els suggeriments són enllaços de debò amb l'adreça de la comparació", () => {
    // Sense guió porten a la mateixa pàgina amb els municipis a l'adreça, i es
    // poden copiar tal qual; amb guió, el guió els intercepta.
    const html = renderComparador(rows, "2026-08-29");
    expect(html).toContain('<a class="suggeriment" href="?m=esplugues-de-llobregat,sant-just-desvern"');
    expect(html).not.toContain('<button type="button" data-m=');
    expect(html).toContain('querySelectorAll(".suggeriments a[data-m]")');
    expect(html).toContain("event.preventDefault()");
  });

  it("cap color de veredicte a la taula: ni verd ni coral sota .comparativa ni a les marques", () => {
    const html = renderComparador(rows, "2026-08-29");
    // Només el full d'aquesta pàgina: el de la casa té el logotip del peu
    // («footer.peu .marca») i la marca de partit, que no són la marca d'extrem
    // d'aquí (que per això es diu «.marca-extrem»).
    const inici = html.indexOf("/* --- el cercador i els municipis triats --- */");
    expect(inici).toBeGreaterThan(0);
    const css = html.slice(inici, html.indexOf("</style>")).replace(/@media[^{]*\{/g, "{");
    const REGLA = /([^{}]*)\{([^{}]*)\}/g;
    let mirades = 0;
    for (const regla of css.matchAll(REGLA)) {
      const selector = regla[1]!;
      if (!selector.includes(".comparativa") && !selector.includes(".marca") && !selector.includes(".quintil")) continue;
      mirades += 1;
      expect(regla[2]).not.toContain("var(--coral)");
      expect(regla[2]).not.toContain("var(--menta)");
    }
    expect(mirades).toBeGreaterThan(5);
    // Les classes velles han desaparegut del full i del guió.
    expect(css).not.toContain(".marca.millor");
    expect(css).not.toContain(".marca.pitjor");
    expect(css).not.toContain("td.millor");
    expect(css).not.toContain("td.pitjor");
    expect(html).not.toContain('millor: "millor"');
    // El quint va en cinc tons de tinta i prou.
    for (const q of [0, 1, 2, 3, 4]) expect(css).toContain(`.quintil.q${q}{opacity:`);
  });
});

// ------------------------------------------------- el regle i la seva escala

describe("escalaDomini", () => {
  it("deixa marge als extrems perquè cap punt no caigui damunt de la vora", () => {
    const { min, max } = escalaDomini([100, 200]);
    expect(min).toBeLessThan(100);
    expect(max).toBeGreaterThan(200);
  });

  it("amb tots els valors iguals inventa un tros simètric: el punt va al mig", () => {
    const { min, max } = escalaDomini([250, 250]);
    expect(min).toBeLessThan(250);
    expect(max).toBeGreaterThan(250);
    expect(Math.abs((250 - min) - (max - 250))).toBeLessThan(1e-9);
  });

  it("un zero repetit no dona un tros de zero d'amplada", () => {
    const { min, max } = escalaDomini([0, 0]);
    expect(max).toBeGreaterThan(min);
  });

  it("ignora el que no és una xifra i sobreviu a no tenir-ne cap", () => {
    expect(escalaDomini([null, 40, null, 10]).min).toBeLessThan(10);
    expect(escalaDomini([null, null])).toEqual({ min: 0, max: 1 });
  });
});

describe("nivellsSenseSolapar", () => {
  it("dues xifres que caurien una damunt de l'altra no s'escriuen a la mateixa alçada", () => {
    // 237 € i 240 € cauen al mateix mil·límetre del regle: escrites totes dues
    // a sota es llegia una tercera xifra que no existeix.
    expect(nivellsSenseSolapar([100, 104], [50, 50])).toEqual([0, 1]);
  });

  it("dues xifres separades es queden totes dues a la primera alçada", () => {
    expect(nivellsSenseSolapar([60, 300], [50, 50])).toEqual([0, 0]);
  });

  it("l'ordre d'arribada no és el de la recta i el resultat va per posició", () => {
    expect(nivellsSenseSolapar([300, 60, 304], [50, 50, 50])).toEqual([0, 0, 1]);
  });

  it("quan ni amb dues alçades no hi caben, es torna a dalt i no es perd cap etiqueta", () => {
    const nivells = nivellsSenseSolapar([100, 102, 104, 106], [60, 60, 60, 60]);
    expect(nivells).toHaveLength(4);
    for (const nivell of nivells) expect(nivell === 0 || nivell === 1).toBe(true);
  });

  it("amb tantes alçades com punts, quatre xifres apilades no se'n mengen cap", () => {
    // És el que fa servir el regle: el dibuix creix abans que dues xifres
    // s'escriguin una damunt de l'altra.
    expect(nivellsSenseSolapar([100, 102, 104, 106], [60, 60, 60, 60], 4)).toEqual([0, 1, 2, 3]);
  });
});

describe("quantil i repartimentDe", () => {
  const deu = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

  it("interpola entre els dos veïns: el p90 no salta d'un municipi a l'altre", () => {
    expect(quantil(deu, 0.5)).toBe(55);
    expect(quantil(deu, 0)).toBe(10);
    expect(quantil(deu, 1)).toBe(100);
    expect(quantil([], 0.5)).toBeNull();
  });

  it("un grup massa petit no té repartiment: una mediana de cinc és una anècdota", () => {
    expect(repartimentDe([1, 2, 3, 4, 5])).toBeNull();
    expect(repartimentDe([1, 2, 3, null, 4, 5, null, 6, 7])).toBeNull();
  });

  it("torna p10, mediana, p90 i de quants municipis surt", () => {
    const repart = repartimentDe(deu);
    expect(repart).not.toBeNull();
    expect(repart![1]).toBe(55);
    expect(repart![3]).toBe(10);
    expect(repart![0]).toBeLessThan(repart![1]);
    expect(repart![2]).toBeGreaterThan(repart![1]);
  });

  it("no compta els forats com si fossin zeros", () => {
    expect(repartimentDe([...deu, null, null])![3]).toBe(10);
  });
});

describe("marquesRodones i anysEscrits", () => {
  it("l'eix arriba a passar el màxim: cap línia no se'n surt per dalt", () => {
    const marques = marquesRodones(1204, 4);
    expect(marques[0]).toBe(0);
    expect(marques[marques.length - 1]!).toBeGreaterThanOrEqual(1204);
    for (const marca of marques) expect(Number.isInteger(marca * 100)).toBe(true);
  });

  it("les marques són xifres rodones i no en surten quinze", () => {
    for (const maxim of [3, 47, 1204, 98_000]) {
      const marques = marquesRodones(maxim, 4);
      expect(marques.length).toBeGreaterThanOrEqual(2);
      expect(marques.length).toBeLessThanOrEqual(8);
    }
  });

  it("un màxim de zero no peta ni dona un eix sense alçada", () => {
    expect(marquesRodones(0)).toEqual([0, 1]);
  });

  it("onze anys no s'escriuen tots, i el primer i l'últim hi són sempre", () => {
    const anys = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
    const escrits = anysEscrits(anys, 7);
    expect(escrits.length).toBeLessThanOrEqual(7);
    expect(escrits[0]).toBe(2015);
    expect(escrits[escrits.length - 1]).toBe(2025);
    expect(anysEscrits([2019, 2020, 2021], 7)).toEqual([2019, 2020, 2021]);
  });
});

describe("el que s'incrusta a la pàgina, també el que dibuixa", () => {
  it("les quatre funcions noves funcionen sense res del seu mòdul al voltant", () => {
    // Si el transpilador hi fica cap ajudant seu, aquí peta; a la pàgina hauria
    // petat en obrir-la, en silenci i a casa de qui la llegeix.
    expect(aillada(escalaDomini)([10, 20]).max).toBeGreaterThan(20);
    expect(aillada(nivellsSenseSolapar)([100, 104], [50, 50])).toEqual([0, 1]);
    expect(aillada(marquesRodones)(1204, 4)[0]).toBe(0);
    expect(aillada(anysEscrits)([2019, 2020, 2021], 7)).toEqual([2019, 2020, 2021]);
  });
});

// ------------------------------------------ la pàgina, oberta amb un DOM fals

type Fals = {
  innerHTML: string; textContent: string; hidden: boolean; disabled: boolean;
  value: string; children: unknown[];
  addEventListener(): void; setAttribute(): void; removeAttribute(): void;
  querySelector(): null; closest(): null;
};

const element = (): Fals => ({
  innerHTML: "", textContent: "", hidden: false, disabled: false, value: "", children: [],
  addEventListener() {}, setAttribute() {}, removeAttribute() {},
  querySelector: () => null, closest: () => null,
});

/**
 * Executa el `<script>` de la pàgina amb un DOM de mentida i torna els nodes.
 *
 * Els dibuixos es pinten al navegador i no al generador: sense obrir-los aquí,
 * un regle que peta —una funció que ja no es diu igual, un municipi sense
 * grup— es publicaria sencer i només fallaria a casa de qui el mira.
 */
function obre(html: string, slugs: readonly string[]): Record<string, Fals> {
  // El script de la pàgina és l'últim `<script>` pelat; el de l'etiqueta dels
  // gràfics ve després, amb `id`, i no és el que es vol executar aquí.
  const inici = html.lastIndexOf("<script>") + 8;
  const script = html.slice(inici, html.indexOf("</script>", inici));
  const nodes: Record<string, Fals> = {};
  const document = {
    getElementById: (id: string): Fals => (nodes[id] ??= element()),
    querySelectorAll: (): unknown[] => [],
  };
  const executa = new Function(
    "document", "location", "history", "window",
    `${script}\nreturn { afegeix: afegeix };`,
  ) as (d: unknown, l: unknown, h: unknown, w: unknown) => { afegeix(slug: string): void };
  const api = executa(
    document,
    { search: "", pathname: "/observatori/comparador/" },
    { replaceState() {} },
    { setTimeout() {} },
  );
  for (const slug of slugs) api.afegeix(slug);
  return nodes;
}

const GRUP_GRAN = "de 20.001 a 50.000 habitants";
const GRUP_PETIT = "fins a 250 habitants";

function municipi(
  slug: string,
  nom: string,
  valors: Record<string, number | null>,
  extra: { grup?: string; grupMida?: number; serie?: { any: number; valor: number }[] } = {},
): ComparadorRow {
  return {
    slug,
    nom,
    comarca: "Baix Llobregat",
    grup: extra.grup ?? GRUP_GRAN,
    grupMida: extra.grupMida ?? 88,
    valors: {
      poblacio: 21_000, regidories: 21, participacio: 55, alternances: 1, deute: 400,
      deute_mandat: -20, estalvi: 6, saldo: 1, carrega: 5, execucio: 60, pmp: 30, ibi: 0.7,
      selectiva: null, dones: 45, transparencia: 70,
      cost_govern: 9.2, preu_aigua: 0.82, rebut_ibi: 410, renda: 15_800, estrangera_pct: 12.5, ...valors,
    },
    percentils: { deute: 42 },
    textos: {
      govern: { principal: "PSC-CP", secundari: "Algú Altre" },
      mesvotada: { principal: "Sí", secundari: "" },
      majoria: { principal: "Sí", secundari: "11 de 21 regidories" },
    },
    enllacIdescat: "https://www.idescat.cat/emex/?id=" + slug + "#h40000",
    ...(extra.serie ? { serie: extra.serie } : {}),
  };
}

/** Prou municipis al grup perquè la mediana no sigui una anècdota de cinc. */
const FARCIMENT = Array.from({ length: 12 }, (_, i) =>
  municipi("poble-" + i, "Poble " + i, {
    deute: 100 + i * 90, participacio: 45 + i, estalvi: i, transparencia: 40 + i * 4,
  }));

const ESPLUGUES = municipi(
  "esplugues-de-llobregat", "Esplugues de Llobregat",
  { deute: 237, estalvi: 11.7, participacio: 52.4 },
  { serie: [{ any: 2019, valor: 421 }, { any: 2021, valor: 380 }, { any: 2023, valor: 237 }] },
);
const SANT_JUST = municipi(
  "sant-just-desvern", "Sant Just Desvern",
  { deute: 120, estalvi: null, participacio: 61.2 },
  { serie: [{ any: 2019, valor: 68 }, { any: 2023, valor: 120 }] },
);
/** D'una altra lliga i sense sèrie: el cas que ha de parlar, no callar. */
const ABELLA = municipi(
  "abella-de-la-conca", "Abella de la Conca",
  { poblacio: 158, regidories: 5, deute: 0, estalvi: null, participacio: 88.1 },
  { grup: GRUP_PETIT, grupMida: 45 },
);

const TOTS = [ESPLUGUES, SANT_JUST, ABELLA, ...FARCIMENT];
const pagina = (): string => renderComparador(TOTS, "2026-08-30");

describe("el regle de cada indicador", () => {
  it("situa els municipis triats en una escala amb la mediana del seu grup marcada", () => {
    const nodes = obre(pagina(), ["esplugues-de-llobregat", "sant-just-desvern"]);
    const html = nodes["escales-cos"]!.innerHTML;
    expect(nodes.escales!.hidden).toBe(false);
    expect(html).toContain('class="escala-svg"');
    // La mediana i la franja del 80 % central: sense elles, dos punts en una
    // recta són dos punts en una recta.
    expect(html).toContain('class="escala-mediana"');
    expect(html).toContain('class="escala-banda"');
    expect(html).toContain(">mediana<");
    expect(html).toContain("El 80 % central dels 14 municipis de 20.001 a 50.000 habitants");
    // Cada municipi hi és amb el seu número, el mateix que porta a la taula.
    expect(html).toContain('class="escala-punt q1"');
    expect(html).toContain('class="escala-punt q2"');
  });

  it("els dos extrems del regle van escrits: un tros de recta sense xifres enganya", () => {
    const html = obre(pagina(), ["esplugues-de-llobregat", "sant-just-desvern"])["escales-cos"]!.innerHTML;
    const primer = html.slice(html.indexOf("Participació el 2023"));
    const regle = primer.slice(0, primer.indexOf("</article>"));
    // Van fora del dibuix, en text de debò: dins hi anaven a la mida del
    // «viewBox», que en un telèfon són set píxels.
    const limits = regle.slice(regle.indexOf('class="escala-limits"'));
    expect(limits.match(/<span>[^<]+<\/span>/g)!.length).toBe(2);
    expect(limits).toContain("%");
    expect(regle).toContain('class="escala-xifra"');
    expect(regle).toContain("52,4 %");
    expect(regle).toContain("61,2 %");
  });

  it("el número del regle és el mateix que el de la taula i el de la fitxa triada", () => {
    const nodes = obre(pagina(), ["esplugues-de-llobregat", "sant-just-desvern"]);
    expect(nodes.triats!.innerHTML).toContain('<span class="num q1">1</span>Esplugues de Llobregat');
    expect(nodes["capcalera-taula"]!.innerHTML).toContain('<span class="num q2">2</span>');
    expect(nodes["escala-clau"]!.innerHTML).toContain('<span class="num q2">2</span>Sant Just Desvern');
  });

  it("cap xifra del regle no s'escriu damunt d'una altra, ni amb quatre municipis junts", () => {
    // Quatre municipis amb el deute a tocar cauen al mateix mil·límetre de la
    // recta: el que no pot passar és que les seves xifres es facin il·legibles.
    const html = obre(pagina(), ["poble-3", "poble-4", "poble-5", "poble-6"])["escales-cos"]!.innerHTML;
    const ample = (text: string): number => text.length * 9.8 + 8;
    for (const svg of html.match(/<svg[\s\S]*?<\/svg>/g) ?? []) {
      const etiquetes = [...svg.matchAll(/class="escala-xifra" x="([\d.]+)" y="(\d+)"[^>]*>([^<]+)</g)]
        .map((m) => ({ x: Number(m[1]), y: Number(m[2]), text: m[3]! }));
      for (let i = 0; i < etiquetes.length; i += 1) {
        for (let j = i + 1; j < etiquetes.length; j += 1) {
          const a = etiquetes[i]!;
          const b = etiquetes[j]!;
          if (a.y !== b.y) continue;
          expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual((ample(a.text) + ample(b.text)) / 2);
        }
      }
    }
  });

  it("no dibuixa cap regle dels indicadors que no tenen grup de comparació", () => {
    // Els habitants i les regidories no porten percentil: un regle amb la
    // mediana de la població seria comparar mides amb mides.
    const html = obre(pagina(), ["esplugues-de-llobregat", "sant-just-desvern"])["escales-cos"]!.innerHTML;
    expect(html).not.toContain("Regidories al ple");
    expect(html).not.toContain("Població de nacionalitat estrangera");
    expect(html).toContain("Deute per habitant");
  });

  it("les files noves també tenen regle, amb el seu format", () => {
    const html = obre(pagina(), ["esplugues-de-llobregat", "sant-just-desvern"])["escales-cos"]!.innerHTML;
    for (const etiqueta of ["Cost del govern per habitant", "Preu de l'aigua, €/m³", "Rebut mitjà de l'IBI", "Renda neta per persona"]) {
      expect(html).toContain(etiqueta);
    }
    expect(html).toContain("9,2 €");
    expect(html).toContain("0,82 €/m³");
    expect(html).toContain("15.800 €");
  });
});

describe("el que no es pot comparar es diu, i es diu per què", () => {
  it("una xifra que només té un municipi no es dibuixa: es diu qui hi falta i què hi falta", () => {
    const html = obre(pagina(), ["esplugues-de-llobregat", "sant-just-desvern"])["escales-cos"]!.innerHTML;
    const bloc = html.slice(html.indexOf("Estalvi net"));
    const regle = bloc.slice(0, bloc.indexOf("</article>"));
    expect(regle).toContain("No es pot comparar:");
    expect(regle).toContain("hi falta Sant Just Desvern");
    expect(regle).toContain("No en tenim la liquidació.");
    expect(regle).not.toContain("escala-svg");
  });

  it("el compte de dalt diu quantes xifres no es poden comparar", () => {
    const nodes = obre(pagina(), ["esplugues-de-llobregat", "sant-just-desvern"]);
    expect(nodes["escala-compte"]!.hidden).toBe(false);
    expect(nodes["escala-compte"]!.innerHTML).toContain("no es poden comparar");
    // I amb tres municipis que tenen totes les xifres, l'avís no s'inventa res.
    const plens = obre(pagina(), ["poble-1", "poble-2"]);
    expect(plens["escala-compte"]!.hidden).toBe(true);
  });

  it("quan un municipi hi falta però la comparació s'aguanta, el regle diu qui n'és fora", () => {
    const html = obre(pagina(), ["esplugues-de-llobregat", "poble-3", "sant-just-desvern"])["escales-cos"]!.innerHTML;
    const bloc = html.slice(html.indexOf("Estalvi net"));
    const regle = bloc.slice(0, bloc.indexOf("</article>"));
    expect(regle).toContain('class="escala-svg"');
    expect(regle).toContain("Fora del dibuix, Sant Just Desvern: no en tenim la liquidació.");
  });

  it("dues lligues diferents no tenen una mediana comuna, i el regle no se n'inventa cap", () => {
    const html = obre(pagina(), ["esplugues-de-llobregat", "abella-de-la-conca"])["escales-cos"]!.innerHTML;
    expect(html).toContain("Sense mediana: aquests municipis són de 2 grups de mida diferents");
    // I es diu un sol cop, a dalt, i no a peu de cada regle.
    expect(html.match(/Sense mediana: aquests municipis/g)).toHaveLength(1);
    expect(html.indexOf("Sense mediana")).toBeLessThan(html.indexOf('<article class="escala"'));
    const bloc = html.slice(html.indexOf("Deute per habitant"));
    const regle = bloc.slice(0, bloc.indexOf("</article>"));
    expect(regle).not.toContain("escala-mediana");
    // Els punts hi continuen sent: les xifres sí que es poden posar en fila.
    expect(regle).toContain('class="escala-punt q1"');
  });
});

describe("el deute any a any", () => {
  it("dibuixa una línia per municipi, cadascuna amb la seva forma", () => {
    const nodes = obre(pagina(), ["esplugues-de-llobregat", "sant-just-desvern"]);
    const html = nodes["serie-cos"]!.innerHTML;
    expect(nodes.serie!.hidden).toBe(false);
    expect(html).toContain('class="serie-linia q1"');
    expect(html).toContain('class="serie-linia q2"');
    expect(html).toContain("2019");
    expect(html).toContain("2023");
    // L'equivalent en text és la mateixa dada, no una nota al peu.
    expect(html).toContain("<caption>Deute per habitant, any a any</caption>");
    expect(html).toContain("421 €");
  });

  it("un any que la font no publica trenca la línia i no s'inventa el pendent", () => {
    const html = obre(pagina(), ["esplugues-de-llobregat", "sant-just-desvern"])["serie-cos"]!.innerHTML;
    // Sant Just no té el 2021: la seva línia ha de ser dos trossos, no un.
    const linia = html.slice(html.indexOf('class="serie-linia q2"'));
    const camí = linia.slice(linia.indexOf('d="') + 3, linia.indexOf('"/>'));
    expect(camí.match(/M/g)!.length).toBe(2);
    expect(html).toContain("sense dada");
  });

  it("el municipi sense sèrie es diu, no desapareix", () => {
    const html = obre(pagina(), ["esplugues-de-llobregat", "abella-de-la-conca"])["serie-cos"]!.innerHTML;
    expect(html).toContain("No es pot comparar amb Abella de la Conca");
    expect(html).toContain("no en tenim el deute any a any");
    expect(html).toContain("sense sèrie");
  });

  it("sense cap sèrie no hi ha secció buida", () => {
    const nodes = obre(renderComparador([FARCIMENT[0]!, FARCIMENT[1]!], "2026-08-30"), ["poble-0", "poble-1"]);
    expect(nodes.serie!.hidden).toBe(true);
  });
});

// ---------------------------------------------- l'etiqueta de cada punt
//
// L'etiqueta flotant la posa el script comú de grafics.ts, que escolta el
// document sencer i només llegeix «data-*»: perquè funcioni aquí, cada punt
// que es dibuixa al navegador ha de portar els mateixos atributs que un punt
// escrit pel servidor, i la mateixa frase al <title>.

/** Els grups tocables d'un tros d'HTML, amb els seus atributs i el que tenen a dins. */
function puntsDe(html: string): { atributs: string; dins: string }[] {
  return [...html.matchAll(/<g class="punt" tabindex="0"([^>]*)>([\s\S]*?)<\/g>/g)]
    .map((m) => ({ atributs: m[1]!, dins: m[2]! }));
}

const atribut = (atributs: string, nom: string): string | null =>
  atributs.match(new RegExp(` ${nom}="([^"]*)"`))?.[1] ?? null;

/** Els extres d'un punt, desfets amb els mateixos separadors que els ajunten. */
const extresDe = (atributs: string): { etq: string; valor: string }[] =>
  (atribut(atributs, "data-extres") ?? "")
    .split("\u2016")
    .filter(Boolean)
    .map((linia) => {
      const [etq, ...valor] = linia.split("\u00a6");
      return { etq: etq!, valor: valor.join("\u00a6") };
    });

/** El contracte sencer d'un punt, tal com el llegeix el script de grafics.ts. */
const dadaDe = (atributs: string) => ({
  nom: atribut(atributs, "data-nom"),
  any: atribut(atributs, "data-any"),
  valor: atribut(atributs, "data-valor")!,
  mediana: atribut(atributs, "data-mediana"),
  extres: extresDe(atributs),
  nota: atribut(atributs, "data-nota"),
});

describe("l'etiqueta dels punts del regle", () => {
  const html = obre(pagina(), ["esplugues-de-llobregat", "sant-just-desvern"])["escales-cos"]!.innerHTML;
  const bloc = html.slice(html.indexOf("Deute per habitant"));
  const regle = bloc.slice(0, bloc.indexOf("</article>"));
  const punts = puntsDe(regle);

  it("cada municipi és un grup tocable amb nom, valor amb unitat i la mediana dels seus", () => {
    const esplugues = punts.find((p) => atribut(p.atributs, "data-nom") === "Esplugues de Llobregat");
    const santJust = punts.find((p) => atribut(p.atributs, "data-nom") === "Sant Just Desvern");
    expect(esplugues).toBeDefined();
    expect(santJust).toBeDefined();
    expect(atribut(esplugues!.atributs, "data-valor")).toBe("237 €");
    expect(atribut(santJust!.atributs, "data-valor")).toBe("120 €");
    // La mediana que diu el punt és la mateixa que diu el peu del regle.
    const alPeu = regle.match(/; la mediana és ([^.]+)\./)![1];
    expect(atribut(esplugues!.atributs, "data-mediana")).toBe(alPeu);
    // El dibuix del punt no ha canviat: el cèrcol, el punt i el número, dins del grup.
    expect(esplugues!.dins).toContain('class="escala-halo"');
    expect(esplugues!.dins).toContain('class="escala-punt q1"');
    expect(esplugues!.dins).toContain('class="escala-num"');
    expect(santJust!.dins).toContain('class="escala-punt q2"');
  });

  it("sense any conegut de la xifra, el punt no se n'inventa cap", () => {
    // Les files de prova no porten anys: ni «data-any» ni un «undefined» escrit.
    for (const p of punts) expect(atribut(p.atributs, "data-any")).toBeNull();
    expect(regle).not.toContain("undefined");
  });

  it("la marca de la mediana també es toca, i diu de quants municipis és", () => {
    const mediana = punts.find((p) => p.dins.includes('class="escala-mediana"'));
    expect(mediana).toBeDefined();
    expect(atribut(mediana!.atributs, "data-nom")).toBe("Mediana dels 14 municipis de 20.001 a 50.000 habitants");
    expect(atribut(mediana!.atributs, "data-valor")).toBe(regle.match(/; la mediana és ([^.]+)\./)![1]);
    // La mediana és el valor, no la seva pròpia mediana.
    expect(atribut(mediana!.atributs, "data-mediana")).toBeNull();
    // Una ratlla d'un píxel no es toca: la banda de tacte és un rectangle.
    expect(mediana!.dins).toMatch(/<rect class="toc" x="[\d.]+" y="20" width="20" height="40"\/>/);
  });

  it("el punt es pot tocar: una banda transparent de 12 de radi sota el dibuix, i focus amb el teclat", () => {
    for (const p of punts.filter((p) => !p.dins.includes("escala-mediana"))) {
      expect(p.dins).toMatch(/<\/title><circle class="toc" cx="[\d.]+" cy="40" r="12"\/>/);
    }
    // El CSS del tacte va amb el regle, que no és un «.grafic» de la fitxa.
    const css = pagina();
    expect(css).toContain(".escala-svg .toc,.serie-marc .toc{fill:transparent;stroke:none;pointer-events:all}");
    expect(css).toContain(".escala-svg .punt,.serie-marc .punt{cursor:pointer;outline:none}");
  });

  it("el <title> diu la mateixa frase que compon el servidor per als seus gràfics", () => {
    for (const p of punts) {
      const titol = p.dins.match(/<title>([^<]*)<\/title>/)![1];
      expect(titol).toBe(textEtiqueta(dadaDe(p.atributs)));
    }
  });

  it("cada punt diu com de lluny és de la mediana, de quin grup és i d'on surt la xifra", () => {
    const esplugues = punts.find((p) => atribut(p.atributs, "data-nom") === "Esplugues de Llobregat")!;
    const santJust = punts.find((p) => atribut(p.atributs, "data-nom") === "Sant Just Desvern")!;
    // La mediana és 505 €: la diferència va amb signe i amb el menys de debò.
    expect(extresDe(esplugues.atributs)).toEqual([
      { etq: "respecte a la mediana", valor: "\u2212268 €" },
      { etq: "grup", valor: "14 municipis de 20.001 a 50.000 habitants" },
    ]);
    expect(extresDe(santJust.atributs)[0]).toEqual({ etq: "respecte a la mediana", valor: "\u2212385 €" });
    // La nota és la font de la fila, la mateixa que la taula de fonts del peu.
    expect(atribut(esplugues.atributs, "data-nota")).toBe("font: 34db8dc5");
    // Sense any de la xifra, cap extra d'any: no hi ha res de què diferir.
    expect(extresDe(esplugues.atributs).some((e) => e.etq === "any")).toBe(false);
  });

  it("la mediana diu entre quins valors va el 80 % central, que és la banda que es dibuixa", () => {
    const mediana = punts.find((p) => p.dins.includes('class="escala-mediana"'))!;
    const banda = regle.match(/va de ([^ ]+ €) a ([^;]+ €);/)!;
    expect(extresDe(mediana.atributs)).toEqual([{ etq: "el 80 % central", valor: `de ${banda[1]} a ${banda[2]}` }]);
    expect(atribut(mediana.atributs, "data-nota")).toBe("font: 34db8dc5");
  });

  it("sense mediana comuna, el punt diu el seu grup però no cap distància", () => {
    const dues = obre(pagina(), ["esplugues-de-llobregat", "abella-de-la-conca"])["escales-cos"]!.innerHTML;
    const desDelDeute = dues.slice(dues.indexOf("Deute per habitant"));
    const senseMediana = desDelDeute.slice(0, desDelDeute.indexOf("</article>"));
    const abella = puntsDe(senseMediana).find((p) => atribut(p.atributs, "data-nom") === "Abella de la Conca")!;
    expect(extresDe(abella.atributs)).toEqual([{ etq: "grup", valor: "45 municipis fins a 250 habitants" }]);
  });

  it("sense mediana comuna, el punt no en diu cap", () => {
    const dues = obre(pagina(), ["esplugues-de-llobregat", "abella-de-la-conca"])["escales-cos"]!.innerHTML;
    const desDelDeute = dues.slice(dues.indexOf("Deute per habitant"));
    const senseMediana = desDelDeute.slice(0, desDelDeute.indexOf("</article>"));
    const punts = puntsDe(senseMediana);
    expect(punts.length).toBe(2);
    for (const p of punts) expect(atribut(p.atributs, "data-mediana")).toBeNull();
  });
});

describe("l'etiqueta dels punts del deute any a any", () => {
  const html = obre(pagina(), ["esplugues-de-llobregat", "sant-just-desvern"])["serie-cos"]!.innerHTML;
  const punts = puntsDe(html);

  it("cada any amb dada és un punt tocable amb el nom, l'any i els euros", () => {
    const esplugues = punts.filter((p) => atribut(p.atributs, "data-nom") === "Esplugues de Llobregat");
    const santJust = punts.filter((p) => atribut(p.atributs, "data-nom") === "Sant Just Desvern");
    expect(esplugues.map((p) => atribut(p.atributs, "data-any"))).toEqual(["2019", "2021", "2023"]);
    expect(esplugues.map((p) => atribut(p.atributs, "data-valor"))).toEqual(["421 €", "380 €", "237 €"]);
    // Sant Just no té el 2021: no hi ha cap punt que s'inventi l'any que falta.
    expect(santJust.map((p) => atribut(p.atributs, "data-any"))).toEqual(["2019", "2023"]);
    expect(santJust.map((p) => atribut(p.atributs, "data-valor"))).toEqual(["68 €", "120 €"]);
    // A la sèrie no hi ha mediana del grup: el punt no en diu cap.
    for (const p of punts) expect(atribut(p.atributs, "data-mediana")).toBeNull();
  });

  it("només la punta de la línia es dibuixa, com abans; la resta són bandes de tacte", () => {
    const esplugues = punts.filter((p) => atribut(p.atributs, "data-nom") === "Esplugues de Llobregat");
    expect(esplugues[2]!.dins).toContain('class="escala-punt q1"');
    expect(esplugues[2]!.dins).toContain('class="escala-num"');
    expect(esplugues[0]!.dins).not.toContain("escala-punt");
    expect(esplugues[1]!.dins).not.toContain("escala-punt");
    for (const p of punts) expect(p.dins).toMatch(/<\/title><circle class="toc" cx="[\d.]+" cy="[\d.]+" r="12"\/>/);
    // Un sol punt dibuixat per municipi, i els cercles van després de la seva línia.
    expect(html.match(/class="escala-punt q1"/g)!.length).toBe(1);
    expect(html.indexOf('class="serie-linia q1"')).toBeLessThan(html.indexOf('class="escala-punt q1"'));
  });

  it("el <title> diu la mateixa frase que compon el servidor", () => {
    for (const p of punts) {
      const titol = p.dins.match(/<title>([^<]*)<\/title>/)![1];
      expect(titol).toBe(textEtiqueta(dadaDe(p.atributs)));
    }
  });

  it("cada any diu com ha canviat respecte a l'any anterior amb dada i respecte al primer", () => {
    const esplugues = punts.filter((p) => atribut(p.atributs, "data-nom") === "Esplugues de Llobregat");
    // El primer any no ve de cap lloc: cap extra.
    expect(extresDe(esplugues[0]!.atributs)).toEqual([]);
    // El 2021 ve del 2019, que no és l'any de just abans: es diu pel seu nom,
    // amb els euros amb signe i el tant per cent del punt de partida.
    expect(extresDe(esplugues[1]!.atributs)).toEqual([{ etq: "respecte al 2019", valor: "\u221241 € (\u22129,7 %)" }]);
    expect(extresDe(esplugues[2]!.atributs)).toEqual([
      { etq: "respecte al 2021", valor: "\u2212143 € (\u221237,6 %)" },
      { etq: "respecte al primer any (2019)", valor: "\u2212184 € (\u221243,7 %)" },
    ]);
    const santJust = punts.filter((p) => atribut(p.atributs, "data-nom") === "Sant Just Desvern");
    expect(extresDe(santJust[1]!.atributs)).toEqual([{ etq: "respecte al 2019", valor: "+52 € (+76,5 %)" }]);
    // La font és el mateix conjunt que diu el peu de la gràfica.
    for (const p of punts) expect(atribut(p.atributs, "data-nota")).toBe("font: 34db8dc5");
    expect(html).toContain("Conjunt 34db8dc5.");
  });
});

describe("a 320, 480 i 768 píxels", () => {
  const html = pagina();
  const css = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
  const REGLA = /([^{}]*)\{([^{}]*)\}/g;

  it("cap dibuix nou no empeny el document: o cap dins del viewBox o s'arrossega sol", () => {
    // El regle és de 480 unitats i no de 720 justament per això: a 320 px es
    // veu sencer sense arrossegar res. La gràfica del deute, que necessita un
    // eix amb els anys escrits, viu dins d'una caixa que llisca ella sola.
    const desplacables = [...css.matchAll(REGLA)]
      .filter((r) => /overflow-x:\s*auto/.test(r[2]!))
      .flatMap((r) => [...r[1]!.matchAll(/\.[A-Za-z0-9_-]+/g)].map((c) => c[0]!));
    expect(desplacables).toContain(".serie-marc");
    expect(desplacables).not.toContain(".escala-svg");

    const sense = css.replace(/@media[^{]*\{/g, "{");
    for (const regla of sense.matchAll(REGLA)) {
      if (desplacables.some((classe) => regla[1]!.includes(classe))) continue;
      for (const decl of regla[2]!.matchAll(/(?:^|[;{\s(])((?:min-)?width):\s*(\d+)px/g)) {
        expect(Number(decl[2])).toBeLessThanOrEqual(320);
      }
    }
  });

  it("tots els SVG que es pinten porten viewBox i cap amplada en píxels", () => {
    const nodes = obre(html, ["esplugues-de-llobregat", "sant-just-desvern", "abella-de-la-conca"]);
    const pintat = nodes["escales-cos"]!.innerHTML + nodes["serie-cos"]!.innerHTML;
    const svgs = pintat.match(/<svg[^>]*>/g) ?? [];
    expect(svgs.length).toBeGreaterThan(5);
    for (const svg of svgs) {
      expect(svg).toContain("viewBox=");
      expect(svg).not.toMatch(/\swidth="/);
      expect(svg).not.toMatch(/\sheight="/);
      // Un dibuix sense text alternatiu és un forat per a qui no hi veu.
      expect(svg).toContain('role="img"');
      expect(svg).toContain("aria-label=");
    }
  });

  it("els regles es posen en una sola columna fins que hi caben dos", () => {
    expect(css).toContain(".escala-graella{display:grid");
    expect(css).toContain("@media (min-width:900px){ .escala-graella{grid-template-columns:1fr 1fr} }");
    expect(css).toContain(".escala-svg{display:block;width:100%;height:auto");
  });
});

// ---------------------------------------------------------------- la seguretat

describe("la seguretat al comparador", () => {
  // Dos municipis coberts pel balanç del Ministeri i un —Abella— que no hi és:
  // el cas normal, perquè només els de més de 20.000 habitants hi surten.
  const badalona: ComparadorRow = {
    ...municipi("badalona", "Badalona", { fets_penals_per_mil: 64.4, fets_canvi_mandat: 5.3 }),
    anys: { fets_penals_per_mil: 2025 },
    peus: { fets_canvi_mandat: "de 14.156 fets el 2023 a 14.901 el 2025" },
  };
  const girona: ComparadorRow = {
    ...municipi("girona", "Girona", { fets_penals_per_mil: 55.2, fets_canvi_mandat: -2.1 }),
    anys: { fets_penals_per_mil: 2025 },
  };
  const files = [badalona, girona, ABELLA, ...FARCIMENT];
  const html = renderComparador(files, "2026-08-31");

  it("la secció tanca la taula i el glossari duu la citació que la font obliga", () => {
    expect(html).toContain("La seguretat");
    expect(html).toContain("Fets penals per 1.000 habitants");
    expect(html).toContain("Fets penals: canvi des del 2023");
    expect(html).toContain("Ministeri de l'Interior, portal SEC");
    expect(html).toContain("Origen de los datos: Portal Estadístico de Criminalidad");
    // La cobertura es diu amb el compte de debò del conjunt incrustat.
    expect(html).toContain(`La tenen 2 dels ${files.length} municipis.`);
    // I l'any de la dada va un cop a la capçalera de la fila.
    expect(html).toContain("dada del 2025 · no es compara");
  });

  it("la taxa duu un decimal, el canvi duu signe i el peu duu les dues puntes", () => {
    const cos = obre(html, ["badalona", "girona"])["cos-taula"]!.innerHTML;
    expect(cos).toContain("64,4");
    expect(cos).toContain("+5,3 %");
    expect(cos).toContain("−2,1 %");
    expect(cos).toContain("de 14.156 fets el 2023 a 14.901 el 2025");
    // I cap marca: més fets coneguts pot ser més denúncies, i la policia no és
    // del ple. La fila no reparteix res.
    const seccio = cos.slice(cos.indexOf("Fets penals per 1.000 habitants"));
    expect(seccio.slice(0, seccio.indexOf("</tr>"))).not.toContain('class="marca-extrem');
  });

  it("el municipi que el Ministeri no publica llegeix el perquè, no un guionet", () => {
    const cos = obre(html, ["badalona", "abella-de-la-conca"])["cos-taula"]!.innerHTML;
    expect(cos).toContain("El Ministeri només publica els fets penals dels municipis de més de 20.000 habitants");
    expect(cos).toContain("no hi ha canvi a mesurar");
  });

  it("cap regle de seguretat: sense percentil no hi ha mediana honesta a dibuixar", () => {
    // Amb mig grup de mida sense dada, la mediana del grup i el «pN entre els
    // de la seva mida» duien el denominador mentider: la fila viu a la taula.
    const nodes = obre(html, ["badalona", "girona"]);
    expect(nodes["escales-cos"]!.innerHTML).not.toContain("Fets penals");
  });
});

describe("l'etiqueta dels gràfics", () => {
  it("la pàgina porta el script de l'etiqueta una sola vegada, abans de tancar el cos", () => {
    const html = pagina();
    expect(html.match(/<script id="grafics-etiqueta">/g)?.length).toBe(1);
    expect(html.indexOf('<script id="grafics-etiqueta">')).toBeLessThan(html.indexOf("</body>"));
  });
});

describe("el cap SEO del comparador", () => {
  const titolDe = (html: string): string => /<title>([^<]*)<\/title>/.exec(html)![1]!;
  const descripcioDe = (html: string): string => /<meta name="description" content="([^"]*)"/.exec(html)![1]!;
  const jsonLdDe = (html: string): Record<string, unknown>[] =>
    [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1]!));
  const filDe = (html: string): { name: string; item: string }[] =>
    (jsonLdDe(html).find((o) => o["@type"] === "BreadcrumbList")!.itemListElement as { name: string; item: string }[]);

  const html = renderComparador(
    [fila("esplugues-de-llobregat", "Esplugues de Llobregat", { deute: 253 }), fila("sant-just-desvern", "Sant Just Desvern", { deute: 120 })],
    "2026-08-29",
  );

  it("té canònica —abans no en tenia— i un títol curt amb la marca", () => {
    expect(titolDe(html)).toBe("Comparador de municipis · quivoto");
    expect(html).toContain('<link rel="canonical" href="https://quivoto.cat/observatori/comparador/">');
    expect(descripcioDe(html)).toMatch(/^De dos a quatre dels 2 municipis de Catalunya, costat a costat: \d+ indicadors/);
    expect(descripcioDe(html)).not.toContain("veredicte");
  });

  it("porta el fil d'Ariadna fins al comparador", () => {
    expect(filDe(html).map((i) => i.name)).toEqual(["quivoto", "Observatori municipal", "Comparador de municipis"]);
  });

  it("el títol i la descripció caben on el cercador els talla, i la descripció no s'ha hagut de retallar", () => {
    expect(titolDe(html).length).toBeLessThanOrEqual(TITOL_MAXIM);
    expect(descripcioDe(html).length).toBeLessThanOrEqual(DESCRIPCIO_MAXIMA);
    expect(descripcioDe(html).length).toBeGreaterThanOrEqual(70);
    expect(descripcioDe(html)).not.toMatch(/…$/);
  });

  it("té un sol <h1>", () => {
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
  });
});

describe("la cara de la pàgina", () => {
  it("cap rètol en versaletes damunt del títol, i un fil d'Ariadna en minúscula", () => {
    const html = pagina();
    expect(html).not.toContain('<p class="micro">Comparador</p>');
    expect(html).toContain('<nav class="cmp-fil" aria-label="On ets">');
  });

  it("cap regle és una targeta amb ombra, i cap etiqueta va en majúscules espaiades", () => {
    const html = pagina();
    expect(html).not.toMatch(/\.escala\{[^}]*box-shadow/);
    expect(html).not.toMatch(/\.escala-seccio\{[^}]*text-transform:uppercase/);
    expect(html).not.toMatch(/\.marca-extrem\{[^}]*text-transform:uppercase/);
  });

  it("un arrodoniment a zero no s'escriu mai «-0»", () => {
    const html = obre(
      renderComparador([municipi("a", "A", { estalvi: -0.04 }), municipi("b", "B", { estalvi: 3 }), ...FARCIMENT], "2026-08-30"),
      ["a", "b"],
    )["escales-cos"]!.innerHTML;
    expect(html).not.toMatch(/-0 %|−0 %/);
    expect(html).toContain(">0 %<");
  });
});
