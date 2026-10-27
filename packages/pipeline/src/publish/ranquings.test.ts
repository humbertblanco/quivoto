import { describe, expect, it } from "vitest";
import { DESCRIPCIO_MAXIMA, TITOL_MAXIM } from "./seo";
import {
  ambSigne, extrems, medianaDe, nomsMarca, ordinal, PAS, posicioMarca, preparaRanquings, renderRanquings, respecteMediana,
  valorMarca, VISIBLES, type RankingRow,
} from "./ranquings";

/**
 * Cent pobles amb totes les mètriques i el mateix any: el cas net. Les
 * poblacions van de 1.000 en amunt perquè `buildPeerGroups` hi trobi més d'un
 * tram i el desplegable d'àmbit tingui alguna cosa a triar.
 */
const files = (quants = 100): RankingRow[] =>
  Array.from({ length: quants }, (_, i) => ({
    s: `poble-${i}`, n: `Poble ${String(i).padStart(3, "0")}`, c: "Comarca", p: 1_000 + i * 600,
    pt: i, rm: 10_000 + i, rma: 2023, rs: i, rsa: 2024, pa: i / 10, paa: 2025,
    ibi: 300 + i, ibia: 2025, v: i % 5, q: 12,
  }));

const ids = (rows: RankingRow[]): string[] => preparaRanquings(rows).map((r) => r.metrica.id);

describe("preparaRanquings", () => {
  it("publica només les mètriques amb el 90 % i vint valors del mateix període", () => {
    const rows = files();
    for (let i = 0; i < 11; i++) rows[i]!.rs = null;
    expect(ids(rows)).not.toContain("selectiva");
    expect(ids(rows)).toEqual(["poblacio", "participacio", "renda", "aigua", "ibi", "alternances"]);
    expect(preparaRanquings(files(19))).toHaveLength(0);
  });

  it("tria el període més recent que arriba al llindar i no en barreja dos", () => {
    const rows = files();
    // Vuit pobles amb la renda del 2022: el 2023 encara cobreix el 92 % i mana.
    for (let i = 0; i < 8; i++) rows[i]!.rma = 2022;
    const renda = preparaRanquings(rows).find((r) => r.metrica.id === "renda")!;
    expect(renda.periode).toBe("2023");
    expect(renda.files).toHaveLength(92);
    expect(renda.observades).toBe(92);
    expect(renda.total).toBe(100);
  });

  it("un zero és una dada i un any diferent és una absència", () => {
    const rows = files();
    rows[0]!.pt = 0;
    rows[1]!.rma = 2022;
    const per = Object.fromEntries(preparaRanquings(rows).map((r) => [r.metrica.id, r]));
    expect(per["participacio"]!.files.some((x) => x.valor === 0)).toBe(true);
    expect(per["renda"]!.files).toHaveLength(99);
  });

  it("però un preu de l'aigua a zero no és un preu: queda fora del rànquing", () => {
    const rows = files();
    rows[0]!.pa = 0;
    const aigua = preparaRanquings(rows).find((r) => r.metrica.id === "aigua")!;
    expect(aigua.files).toHaveLength(99);
    expect(aigua.files.some((x) => x.fila.s === "poble-0")).toBe(false);
  });

  it("ordena de més a menys i, en cas d'empat, per nom", () => {
    const rows = files();
    rows[3]!.pt = rows[2]!.pt = 500;
    const participacio = preparaRanquings(rows).find((r) => r.metrica.id === "participacio")!;
    expect(participacio.files.slice(0, 2).map((x) => x.fila.n)).toEqual(["Poble 002", "Poble 003"]);
  });

  it("torna els dos extrems amb tots els empats", () => {
    const rows = files();
    rows[0]!.pt = rows[1]!.pt = -1;
    const participacio = preparaRanquings(rows).find((r) => r.metrica.id === "participacio")!;
    const e = extrems(participacio)!;
    expect(e.alt.files.map((f) => f.s)).toEqual(["poble-99"]);
    expect(e.baix.valor).toBe(-1);
    expect(e.baix.files.map((f) => f.s).sort()).toEqual(["poble-0", "poble-1"]);
  });
});

describe("renderRanquings", () => {
  const html = renderRanquings(files(), "2026-09-01");

  it("obre amb els extrems de cada mètrica i cada targeta porta al seu rànquing", () => {
    expect(html).toContain('<section class="bloc" id="destaquen">');
    expect(html.match(/<li class="extrem">/g)).toHaveLength(7);
    expect(html).toContain('href="#participacio"');
    expect(html).toContain("El més alt");
    expect(html).toContain("El més baix");
  });

  it("l'enllaç a les dades no porta fletxa al final, com cap enllaç de la casa", () => {
    expect(html).toContain('<a href="../dades/">Les dades senceres i l\'esquema de cada camp</a>');
    expect(html.slice(html.indexOf("<body"))).not.toMatch(/→\s*<\/a>/);
  });

  it("escriu els empats sencers i en resumeix la cua a partir de cinc", () => {
    const rows = files();
    for (let i = 0; i < 7; i++) rows[i]!.pt = -1;
    const amb = renderRanquings(rows, "avui");
    expect(amb).toContain("<i>7 empatats:</i>");
    expect(amb).toContain('<a href="#participacio">i 3 més</a>');
  });

  it("escriu cada rànquing amb el període, la font, el mètode, el regle i la cautela", () => {
    expect(html.match(/<section class="bloc ranquing"/g)).toHaveLength(7);
    expect(html).toContain('<p class="micro">2023 · Generalitat de Catalunya · processos electorals</p>');
    expect(html).toContain("Votants sobre el cens a les eleccions municipals del 2023.");
    expect(html).toContain('<figure class="dispersio">');
    expect(html).toContain("La mida del municipi i la competència electoral pesen molt");
    expect(html).not.toContain("<table");
  });

  it("no repeteix la llista: cap top 10 a part, i el servidor només escriu les primeres files", () => {
    expect(html).not.toContain('class="top"');
    const participacio = html.slice(html.indexOf('id="participacio"'), html.indexOf('id="renda"'));
    // Les 40 primeres i les cinc últimes: res més.
    expect(participacio.match(/<li [^>]*><span class="pos">/g)).toHaveLength(PAS + VISIBLES);
    expect(participacio).toContain('<span class="pos">1</span>');
    expect(participacio).toContain("../m/poble-99/");
    expect(participacio).toContain('<a class="comarca" href="../c/comarca/">Comarca</a>');
    // Poble 010 és el 90è: ni entre els 40 primers ni entre els cinc últims.
    // El JSON amb què el navegador completa la llista sí que el porta.
    expect(participacio).not.toContain('"../m/poble-10/"');
    expect(participacio).not.toContain('<span class="pos">90</span>');
    expect(html).toContain('<script type="application/json" id="dades-ranquings">');
    expect(html).toContain('"poble-0"');
  });

  it("porta l'àmbit, el cercador i el botó de continuar, i l'àmbit comença per tot Catalunya", () => {
    expect(html).toContain('<select data-ambit><option value="cat">Tot Catalunya</option><option value="t');
    expect(html).toContain("data-cerca");
    expect(html).toContain("data-mes hidden");
    expect(html).toContain("habitants</option>");
  });

  it("és una pàgina de l'Observatori: menú amb els rànquings marcats, cercador i peu", () => {
    expect(html).toContain('<span class="ara" aria-current="page">Rànquings</span>');
    expect(html).toContain('<footer class="peu"');
    expect(html).toContain("Com s'han triat");
  });

  it("cada marca del regle diu de qui és i quant, i la mediana diu que és la mediana", () => {
    const participacio = html.slice(html.indexOf('id="participacio"'), html.indexOf('id="renda"'));
    const regle = participacio.slice(participacio.indexOf('<div class="regle-dispersio"'), participacio.indexOf("</div>"));
    // Cent valors diferents, cent marques, i cadascuna amb el seu municipi.
    expect(regle.match(/<i class="marca"/g)).toHaveLength(100);
    // Cada marca diu la posició al rànquing i com de lluny és de la mediana
    // (49,50 %), als data-extres amb els separadors de grafics.ts (U+2016
    // entre línies, U+00A6 entre etiqueta i valor) i al title= en fila.
    expect(regle).toContain(
      '<i class="marca" style="--p:4.0%" data-nom="Poble 000" data-valor="0,00%" data-extres="posició\u00a6el 100è de 100\u2016respecte a la mediana\u00a6\u221249,50%" title="Poble 000: 0,00% · posició: el 100è de 100 · respecte a la mediana: \u221249,50%"></i>',
    );
    expect(regle).toContain('data-nom="Poble 099" data-valor="99,00%" data-extres="posició\u00a6el 1r de 100\u2016respecte a la mediana\u00a6+49,50%"');
    // La mediana diu de quants és i entre quins extrems.
    expect(regle).toContain(
      '<i class="mig" style="--p:50.0%" data-nom="La mediana" data-valor="49,50%" data-extres="municipis\u00a6100\u2016del més baix al més alt\u00a6de 0,00% a 99,00%" title="La mediana: 49,50% · municipis: 100 · del més baix al més alt: de 0,00% a 99,00%"></i>',
    );
  });

  it("cada fila de la llista porta l'etiqueta amb la comarca, la posició de quants i la distància a la mediana", () => {
    const participacio = html.slice(html.indexOf('id="participacio"'), html.indexOf('id="renda"'));
    expect(participacio).toContain(
      '<li data-nom="Poble 099" data-valor="99,00%" data-extres="comarca\u00a6Comarca\u2016posició de 100\u00a61r\u2016respecte a la mediana\u00a6+49,50%" title="Poble 099: 99,00% · comarca: Comarca · posició de 100: 1r · respecte a la mediana: +49,50%"><span class="pos">1</span>',
    );
    expect(participacio).toContain('data-extres="comarca\u00a6Comarca\u2016posició de 100\u00a640è\u2016respecte a la mediana\u00a6+10,50%"');
  });

  it("dues a la mateixa posició són una marca amb tots els noms, fins a tres i «i N més»", () => {
    const rows = files();
    for (let i = 0; i < 5; i++) rows[i]!.pt = -1;
    // Poble 007 ja val 7: amb aquests dos són tres empatats.
    rows[6]!.pt = rows[5]!.pt = 7;
    const amb = renderRanquings(rows, "avui");
    const participacio = amb.slice(amb.indexOf('id="participacio"'), amb.indexOf('id="renda"'));
    expect(participacio).toContain('data-nom="Poble 000, Poble 001, Poble 002 i 2 més" data-valor="-1,00%"');
    expect(participacio).toContain('data-nom="Poble 005, Poble 006 i Poble 007" data-valor="7,00%"');
    expect(participacio.match(/<i class="marca"/g)).toHaveLength(94);
    // Els cinc empatats són els cinc últims: la posició és un tram.
    expect(participacio).toContain('data-extres="posició\u00a6del 96è al 100è de 100\u2016respecte a la mediana');
    expect(participacio).toContain('data-extres="posició\u00a6del 93è al 95è de 100\u2016respecte a la mediana');
  });

  it("porta el script de l'etiqueta flotant una sola vegada, i el CSS que la pinta", () => {
    expect(html.match(/<script id="grafics-etiqueta">/g)).toHaveLength(1);
    expect(html).toContain(".etiqueta-grafic{");
    // El navegador refà les marques, la mediana i les files amb els mateixos
    // data-* quan canvia l'àmbit, amb els mateixos separadors dels extres.
    expect(html).toContain('e.etq + "\u00a6" + e.valor).join("\u2016")');
    expect(html).toContain('{ etq: "posició", valor: posicio(colla, files.length) }');
    expect(html).toContain('nom: "La mediana"');
    expect(html).toContain('{ etq: "posició de " + fmt(delAmbit.length, 0, ""), valor: ordinal(f.pos) }');
  });

  it("amb massa pocs municipis no publica res i ho diu", () => {
    const buit = renderRanquings(files(10), "avui");
    expect(buit).not.toContain('class="ranquing"');
    expect(buit).toContain("Cap indicador no arriba avui al llindar");
  });

  it("sense les dades de curiositats no escriu la secció ni l'enllaç; amb elles, sí, després dels rànquings", () => {
    expect(html).not.toContain('id="curiositats"');
    expect(html).not.toContain('href="#curiositats"');
    const rows = files().map((r, i) => ({ ...r, r: 7 + (i % 5) * 2, a: `Alcaldia ${i}`, ad: `regidor/alcaldia-${i}/`, f: i % 2 ? 40 : 60, sa: 20_000 + i }));
    const amb = renderRanquings(rows, "avui", {
      alcaldies: { "poble-3": [{ mandat: "2023-2027", nom: "Alcaldia 3", possessio: "2023-06-17" }] },
      llistes2023: {}, ple2023: {}, naixements: {}, retribucions: {},
    });
    expect(amb).toContain('<section class="bloc" id="curiositats">');
    expect(amb).toContain('<a href="#curiositats">les curiositats</a>');
    expect(amb.indexOf('id="curiositats"')).toBeGreaterThan(amb.lastIndexOf('<section class="bloc ranquing"'));
    expect(amb.indexOf('id="curiositats"')).toBeLessThan(amb.indexOf('id="metode"'));
    expect(amb).toContain('<a href="../m/poble-3/regidor/alcaldia-3/">Alcaldia 3</a>');
    expect(amb).toContain(".llista-curiosa .pos{");
  });
});

describe("les peces de l'etiqueta: ordinal, posició, signe i mediana", () => {
  it("escriu els ordinals com en català: 1r, 2n, 3r, 4t i «è» de cinc en amunt", () => {
    expect([1, 2, 3, 4, 5, 11, 21, 947].map(ordinal)).toEqual(["1r", "2n", "3r", "4t", "5è", "11è", "21è", "947è"]);
  });

  it("diu la posició d'una marca: una sola o un tram, sempre de quants", () => {
    expect(posicioMarca([3], 24)).toBe("el 3r de 24");
    expect(posicioMarca([15, 12, 13], 947)).toBe("del 12è al 15è de 947");
    expect(posicioMarca([1000], 1000)).toBe("el 1.000è de 1.000");
  });

  it("escriu la diferència amb signe, amb el menys de debò, i «igual» quan no es veu", () => {
    const fmt = (v: number): string => `${v.toLocaleString("ca-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
    expect(ambSigne(3.2, fmt)).toBe("+3,20%");
    expect(ambSigne(-12, fmt)).toBe("\u221212,00%");
    expect(ambSigne(0.001, fmt)).toBe("igual");
    expect(respecteMediana([52], 49.5, fmt)).toBe("+2,50%");
    expect(respecteMediana([47, 48], 49.5, fmt)).toBe("de \u22122,50% a \u22121,50%");
  });

  it("la mediana és la del mig, o la mitjana dels dos del mig, vingui en l'ordre que vingui", () => {
    expect(medianaDe([5, 1, 3])).toBe(3);
    expect(medianaDe([4, 1, 3, 2])).toBe(2.5);
  });
});

describe("nomsMarca i valorMarca", () => {
  it("escriu els noms com una frase, per ordre alfabètic i amb la cua resumida", () => {
    expect(nomsMarca(["Vinaixa"])).toBe("Vinaixa");
    expect(nomsMarca(["Vinaixa", "Fulleda"])).toBe("Fulleda i Vinaixa");
    expect(nomsMarca(["Vinaixa", "Fulleda", "Sarroca"])).toBe("Fulleda, Sarroca i Vinaixa");
    expect(nomsMarca(["Vinaixa", "Fulleda", "Sarroca", "Alfés", "Bovera"])).toBe("Alfés, Bovera, Fulleda i 2 més");
  });

  it("dona la xifra si tots els valors són iguals i «de X a Y» si són veïns", () => {
    const fmt = (v: number) => `${v} €`;
    expect(valorMarca([3], fmt)).toBe("3 €");
    expect(valorMarca([3, 3], fmt)).toBe("3 €");
    expect(valorMarca([3.2, 3, 3.1], fmt)).toBe("de 3 € a 3.2 €");
  });
});

describe("el cap SEO dels rànquings", () => {
  const titolDe = (html: string): string => /<title>([^<]*)<\/title>/.exec(html)![1]!;
  const descripcioDe = (html: string): string => /<meta name="description" content="([^"]*)"/.exec(html)![1]!;
  const jsonLdDe = (html: string): Record<string, unknown>[] =>
    [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1]!));
  const filDe = (html: string): { name: string; item: string }[] =>
    (jsonLdDe(html).find((o) => o["@type"] === "BreadcrumbList")!.itemListElement as { name: string; item: string }[]);

  const html = renderRanquings(files(), "2026-09-01");

  it("compta els rànquings publicats de debò, no les mètriques que existeixen", () => {
    expect(titolDe(html)).toBe("Rànquings municipals de Catalunya · quivoto");
    expect(descripcioDe(html)).toBe(
      `${ids(files()).length} rànquings dels 100 municipis de Catalunya: qui és a dalt i qui a baix de cada indicador, amb l'any, la font i el que la xifra no diu.`,
    );
    expect(html).toContain('<link rel="canonical" href="https://quivoto.cat/observatori/ranquings/">');
  });

  it("sense cap rànquing publicat no escriu «0 rànquings»", () => {
    expect(descripcioDe(renderRanquings(files(10), "avui"))).toMatch(/^Els rànquings dels 10 municipis/);
  });

  it("porta el fil d'Ariadna fins als rànquings", () => {
    expect(filDe(html).map((i) => i.name)).toEqual(["quivoto", "Observatori municipal", "Rànquings municipals"]);
  });

  it("cada rànquing publicat és un ItemList amb els 40 primers i la mida sencera", () => {
    const llistes = jsonLdDe(html).filter((o) => o["@type"] === "ItemList");
    expect(llistes).toHaveLength(ids(files()).length);
    for (const l of llistes) {
      const elements = l.itemListElement as { position: number; url: string }[];
      expect(elements.length).toBeLessThanOrEqual(40);
      expect(elements.length).toBeGreaterThan(0);
      expect(l.numberOfItems as number).toBeGreaterThanOrEqual(elements.length);
      expect(elements[0]!.position).toBe(1);
      expect(elements.every((e) => e.url.startsWith("https://quivoto.cat/observatori/m/"))).toBe(true);
      expect(String(l.url)).toMatch(/^https:\/\/quivoto\.cat\/observatori\/ranquings\/#[a-z0-9-]+$/);
    }
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

// ───────────────────────────────────────────────────────────────────────────
// Cinc de dalt, cinc de baix, i el mig plegat
// ───────────────────────────────────────────────────────────────────────────

describe("cada rànquing ensenya les dues puntes i plega el mig", () => {
  const html = renderRanquings(files(), "2026-10-27");
  const participacio = html.slice(html.indexOf('id="participacio"'), html.indexOf('id="renda"'));
  const tros = (de: string): string => participacio.slice(participacio.indexOf(de), participacio.indexOf("</ol>", participacio.indexOf(de)));

  it("els cinc primers a la vista, de l'1 al 5", () => {
    const dalt = tros('<ol class="llista-ranquing rq-dalt"');
    expect(dalt.match(/<span class="pos">/g)).toHaveLength(VISIBLES);
    expect(dalt).toContain('<span class="pos">1</span>');
    expect(dalt).toContain('<span class="pos">5</span>');
  });

  it("del 6 al 40 dins d'un <details> «Veure'n els 40 primers», escrits per als cercadors i per a qui no té JavaScript", () => {
    const calaix = participacio.slice(participacio.indexOf('<details class="rq-calaix"'), participacio.indexOf("</details>"));
    expect(calaix).toContain("Veure'n els 40 primers");
    expect(calaix).toContain(" de 100");
    expect(calaix.match(/<span class="pos">/g)).toHaveLength(PAS - VISIBLES);
    expect(calaix).toContain('<span class="pos">6</span>');
    expect(calaix).toContain('<span class="pos">40</span>');
    // Plegat: sense «open».
    expect(participacio).not.toContain('<details class="rq-calaix" data-calaix open');
    expect(calaix).toContain("data-mes hidden");
  });

  it("els cinc últims a la vista, amb la seva posició de debò", () => {
    const baix = tros('<ol class="llista-ranquing rq-baix"');
    expect(baix).toContain('start="96"');
    expect(baix.match(/<span class="pos">/g)).toHaveLength(VISIBLES);
    expect(baix).toContain('<span class="pos">96</span>');
    expect(baix).toContain('<span class="pos">100</span>');
    expect(baix).toContain('href="../m/poble-0/"');
  });

  it("amb poques files no hi ha calaix ni repeticions: cada municipi surt un sol cop", () => {
    // Vint-i-dos municipis: 5 de dalt, del 6 al 17 al calaix, 5 de baix.
    const petit = renderRanquings(files(22), "avui");
    const p = petit.slice(petit.indexOf('id="participacio"'), petit.indexOf('id="renda"'));
    const posicions = [...p.matchAll(/<span class="pos">(\d+)<\/span>/g)].map((m) => Number(m[1]));
    expect(posicions).toEqual(Array.from({ length: 22 }, (_, i) => i + 1));
    expect(p).toContain("Veure'n els 17 primers");
  });

  it("el resum del calaix és un objectiu de 44 px amb el focus visible", () => {
    const css = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
    expect(css).toMatch(/\.rq-obre\{[^}]*min-height:44px/);
    expect(css).toContain(".rq-obre:focus-visible{outline:3px solid");
  });
});

// ─────────────────────────────── el JavaScript de la pàgina, amb un DOM fals

type NodeR = {
  innerHTML: string; textContent: string; hidden: boolean; open: boolean; value: string;
  attrs: Record<string, string>; oients: Record<string, (() => void)[]>;
  dataset: Record<string, string>; className: string;
  querySelector(sel: string): NodeR | null;
  addEventListener(t: string, f: () => void): void;
  setAttribute(k: string, v: string): void;
  before(n: NodeR): void;
};

const nodeR = (fills: Record<string, NodeR> = {}): NodeR => {
  const n: NodeR = {
    innerHTML: "", textContent: "", hidden: false, open: false, value: "", attrs: {}, oients: {},
    dataset: {}, className: "",
    querySelector: (sel) => fills[sel] ?? null,
    addEventListener: (t, f) => { (n.oients[t] ??= []).push(f); },
    setAttribute: (k, v) => { n.attrs[k] = v; },
    before: () => {},
  };
  return n;
};

/** Obre el guió de la pàgina amb una sola secció de mentida, la de la mètrica `id`. */
function obreRanquings(html: string, id: string, extra: { diferit?: boolean; filtre?: NodeR } = {}) {
  const de = nodeR();
  const calaix = nodeR({ ".rq-obre .secundari": de });
  const n = {
    ambit: Object.assign(nodeR(), { value: "cat" }), cerca: nodeR(), dalt: nodeR(), mig: nodeR(), baix: nodeR(),
    calaix, obre: nodeR(), de, mes: nodeR(), buit: nodeR(), figura: nodeR(), controls: nodeR(),
  };
  const seccio = nodeR({
    "[data-ambit]": n.ambit, "[data-cerca]": n.cerca, "[data-dalt]": n.dalt, "[data-mig]": n.mig,
    "[data-baix]": n.baix, "[data-calaix]": n.calaix, "[data-obre]": n.obre, "[data-mes]": n.mes,
    "[data-buit]": n.buit, ".dispersio": n.figura, ".controls": n.controls,
    ...(extra.filtre ? { "[data-filtre]": extra.filtre } : {}),
  });
  // Un regle diferit arriba amb `data-diferit`, que al DOM de debò és `dataset.diferit = ""`.
  if (extra.diferit) n.figura.dataset.diferit = "";
  seccio.dataset.metrica = id;
  const json = /<script type="application\/json" id="dades-ranquings">([\s\S]*?)<\/script>/.exec(html)![1]!;
  const inici = html.indexOf("<script>\n(() => {\n  const bloc");
  const script = html.slice(inici + 8, html.indexOf("</script>", inici));
  const document = {
    getElementById: () => ({ textContent: json }),
    querySelectorAll: () => [seccio],
    createElement: () => nodeR(),
  };
  new Function("document", script)(document);
  const pinta = (on: NodeR, t: string): void => { for (const f of on.oients[t] ?? []) f(); };
  const posicions = (llista: NodeR): number[] =>
    [...llista.innerHTML.matchAll(/<span class="pos">(\d+)<\/span>/g)].map((m) => Number(m[1]));
  return { n, pinta, posicions };
}

describe("el navegador refà les dues puntes igual que el servidor", () => {
  const html = renderRanquings(files(), "2026-10-27");

  it("en carregar, només ensenya el botó si al mig en queden d'amagats", () => {
    const { n } = obreRanquings(html, "participacio");
    expect(n.mes.hidden).toBe(false);
    expect(n.mes.textContent).toBe("Mostra'n 40 més (en queden 55)");
  });

  it("canviar d'àmbit torna a fer cinc de dalt, el mig plegat i cinc de baix", () => {
    const { n, pinta, posicions } = obreRanquings(html, "participacio");
    pinta(n.ambit, "change");
    expect(posicions(n.dalt)).toEqual([1, 2, 3, 4, 5]);
    expect(posicions(n.mig)).toEqual(Array.from({ length: 35 }, (_, i) => i + 6));
    expect(posicions(n.baix)).toEqual([96, 97, 98, 99, 100]);
    expect(n.baix.attrs.start).toBe("96");
    expect(n.obre.textContent).toBe("Veure'n els 40 primers");
    // «Mostra'n més» allarga el mig fins a tocar els de baix, i llavors s'amaga.
    pinta(n.mes, "click");
    pinta(n.mes, "click");
    expect(posicions(n.mig).at(-1)).toBe(95);
    expect(n.mes.hidden).toBe(true);
  });

  it("cercant, les trobades van juntes, el calaix s'obre i els de baix s'amaguen", () => {
    const { n, pinta, posicions } = obreRanquings(html, "participacio");
    n.cerca.value = "poble 00";
    pinta(n.cerca, "input");
    // Poble 000 … Poble 009: deu trobades, amb la seva posició a tot Catalunya.
    expect([...posicions(n.dalt), ...posicions(n.mig)]).toEqual([91, 92, 93, 94, 95, 96, 97, 98, 99, 100]);
    expect(n.calaix.open).toBe(true);
    expect(n.baix.hidden).toBe(true);
    expect(n.de.textContent).toBe(" de 10");
  });

  it("el regle de la població, refet al navegador, va en escala logarítmica i amb els extrems etiquetats", () => {
    const { n, pinta } = obreRanquings(html, "poblacio");
    pinta(n.ambit, "change");
    expect(n.figura.innerHTML).toContain('<div class="regle-eix" aria-hidden="true"><span class="ini">1.000</span>');
    expect(n.figura.innerHTML).toContain('<span class="fi">60.400</span>');
    expect(n.figura.innerHTML).toContain('class="tall" style="--p:');
    expect(n.figura.innerHTML).toContain("cada ratlla multiplica per deu");
  });
});

describe("l'escala del regle als rànquings", () => {
  const html = renderRanquings(files(), "2026-10-27");
  const seccio = (id: string, seguent: string): string => html.slice(html.indexOf(`id="${id}"`), html.indexOf(`id="${seguent}"`));

  it("la població va en logarítmica: el més petit al 4 %, el més gran al 96 %, i les marques de 10.000 al mig", () => {
    const p = seccio("poblacio", "participacio");
    expect(p).toContain("cada ratlla multiplica per deu");
    expect(p).toContain('<i class="tall" style="--p:');
    expect(p).toContain(">10 mil</span>");
    expect(p).toContain('<span class="ini">1.000</span>');
    expect(p).toContain('<span class="fi">60.400</span>');
    // log10(1.000)=3, log10(60.400)≈4,781: 10.000 cau al 4 + 92·(1/1,781) ≈ 55,7 %.
    expect(p).toContain('<span class="tall" style="--p:55.7%">10 mil</span>');
  });

  it("la participació continua en lineal, sense ratlles, però amb els dos extrems etiquetats", () => {
    const p = seccio("participacio", "renda");
    expect(p).not.toContain("multiplica per deu");
    expect(p).not.toContain('class="tall"');
    expect(p).toContain('<div class="regle-eix" aria-hidden="true"><span class="ini">0,00%</span><span class="fi">99,00%</span></div>');
  });

  it("el JSON diu l'escala de cada mètrica perquè el navegador la refaci igual", () => {
    expect(html).toContain('"poblacio":{"d":0,"s":"","e":"log"');
    expect(html).toContain('"participacio":{"d":2,"s":"%","e":"lineal"');
  });
});

// ─────────────────────── les xifres que fins ara només eren a la fitxa

/**
 * Els cent pobles de dalt, ara amb les xifres noves. El lloguer només el
 * tenen la meitat i la contractació 45, que és el que passa de debò: són
 * mètriques que no arriben mai al 90 % i que baixen el llindar dient per què.
 */
const ambNoves = (quants = 100): RankingRow[] =>
  files(quants).map((r, i) => ({
    ...r,
    vv: 60 + (i % 40), ne: 1 + (i % 5) / 2, vol: i % 50, vola: 2023, vp: i % 20, mg: 1 + i, cfa: i % 30, cra: 2026,
    uo: i < 45 ? i : null, uon: 10, uop: "2025-2026",
    hut: i / 100, huta: 2024,
    ll: i < 50 ? 500 + i : null, lla: 2025, llv: i < 50 ? i / 10 : null, llp: "2023-2025",
    hpo: i % 3, hpop: "2023-2025",
    pla: i % 40, plas: i % 2 ? "POUM" : "NNSS", plaa: 2024,
    pag: i % 2 ? "directa" : "indirecta",
  }));

describe("els rànquings nous", () => {
  const html = renderRanquings(ambNoves(), "2026-10-27");
  const seccio = (id: string): string => {
    const inici = html.indexOf(`<section class="bloc ranquing" id="${id}"`);
    return html.slice(inici, html.indexOf("</section>", inici));
  };

  it("surten quan les files porten la dada, i no surten quan no la porten", () => {
    const nous = [
      "veins-voten", "fragmentacio", "volatilitat", "vot-perdut", "ultima-regidoria", "forca-alcaldia",
      "una-oferta", "pisos-turistics", "lloguer", "lloguer-canvi", "habitatge-protegit", "pla-urbanistic",
    ];
    expect(ids(ambNoves())).toEqual(expect.arrayContaining(nous));
    for (const id of nous) expect(ids(files())).not.toContain(id);
  });

  it("una mètrica amb llindar propi diu per què i quants en surten de debò", () => {
    const lloguer = preparaRanquings(ambNoves()).find((r) => r.metrica.id === "lloguer")!;
    expect(lloguer.files).toHaveLength(50);
    expect(seccio("lloguer")).toContain("Hi surten 50 dels 100 municipis.");
    expect(seccio("lloguer")).toContain("prou contractes");
    // Per sota del seu llindar (el 40 %), no es publica.
    const poques = ambNoves().map((r, i) => ({ ...r, ll: i < 30 ? r.ll : null }));
    expect(ids(poques)).not.toContain("lloguer");
    // Una mètrica amb tots els municipis no posa cap nota de cobertura.
    expect(seccio("fragmentacio")).not.toContain('class="cobertura"');
  });

  it("el regle de les mètriques noves el dibuixa el navegador: el servidor només escriu les tres xifres", () => {
    const s = seccio("fragmentacio");
    expect(s).toContain('<figure class="dispersio" data-diferit>');
    expect(s).not.toContain('<i class="marca"');
    expect(s).toContain('<span class="cap">La mediana</span>');
    const { n } = obreRanquings(html, "fragmentacio", { diferit: true });
    expect(n.figura.innerHTML).toContain('<i class="marca"');
    expect(n.figura.innerHTML).toContain("Del més baix al més alt");
  });

  it("les que depenen de la mida diuen la mediana de cada grup", () => {
    expect(seccio("una-oferta")).toContain("La mediana de cada mida");
    expect(seccio("volatilitat")).not.toContain("La mediana de cada mida");
  });

  it("el preu de l'aigua es pot triar per model de gestió, amb la mediana de cadascun i sense dir quin és millor", () => {
    const s = seccio("aigua");
    expect(s).toContain("<select data-filtre>");
    expect(s).toContain('<option value="directa">Gestió directa (50)</option>');
    expect(s).toContain("La mediana per gestió");
    expect(s).toContain("no vol dir que el model en sigui la causa");
    expect(html).toContain('"fe":"gestió"');
  });

  it("al navegador, el filtre de gestió deixa la llista només amb els d'aquell model", () => {
    const filtre = nodeR();
    const { n, pinta, posicions } = obreRanquings(html, "aigua", { filtre });
    filtre.value = "directa";
    pinta(filtre, "change");
    expect(n.de.textContent).toBe(" de 50");
    expect(posicions(n.dalt)).toEqual([1, 2, 3, 4, 5]);
    expect(n.dalt.innerHTML).toContain("gestió¦Gestió directa");
  });

  it("la figura del pla urbanístic separa POUM, normes subsidiàries i la resta", () => {
    expect(seccio("pla-urbanistic")).toContain('<option value="nnss">Normes subsidiàries (50)</option>');
  });
});
