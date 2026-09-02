import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CERCADOR_JS, cercador, dialegCercador, escriuCercadorCompartit, PLACEHOLDER_CERCA } from "./cercador";
import { CERCADOR_CSS, RADIOGRAFIA_CSS, senseComentaris } from "./estil";
import type { IndexAlcaldies, IndexCerca, IndexElectes } from "./cerca";

/**
 * El guió del cercador, executat de debò amb un DOM de mentida.
 *
 * `cerca.test.ts` prova el rànquing i els índexs, que són funcions del
 * generador; el que no prova és el que passa dins del `<script>` que se'n va
 * al navegador: que les tres baixades s'encadenin, que cada mena de resultat
 * es pinti amb el seu context i que l'enllaç de cadascuna vagi on toca. Un
 * error allà es publicaria a 8.000 pàgines i només petaria a casa de qui les
 * llegeix; aquí peta al test, com fa `comparador-gestio.test.ts` amb el seu.
 */

type Escoltes = Record<string, (e?: unknown) => void>;

type Fals = {
  value: string;
  innerHTML: string;
  hidden: boolean;
  open: boolean;
  /** Quants cops s'ha obert el diàleg: la prova que una casella de fora l'obre. */
  obertures: number;
  atributs: Record<string, string>;
  escoltes: Escoltes;
  form: Fals | null;
  addEventListener(nom: string, fn: (e?: unknown) => void): void;
  setAttribute(nom: string, valor: string): void;
  removeAttribute(nom: string): void;
  getAttribute(nom: string): string | null;
  showModal(): void;
  focus(): void;
  appendChild(): void;
  querySelector(sel: string): Fals | null;
  querySelectorAll(): unknown[];
};

function element(fills: Record<string, Fals> = {}): Fals {
  return {
    value: "", innerHTML: "", hidden: false, open: false, obertures: 0, atributs: {}, escoltes: {}, form: null,
    addEventListener(nom, fn) { this.escoltes[nom] = fn; },
    setAttribute(nom, valor) { this.atributs[nom] = valor; },
    removeAttribute(nom) { delete this.atributs[nom]; },
    getAttribute(nom) { return this.atributs[nom] ?? null; },
    showModal() { this.open = true; this.obertures += 1; },
    focus() {}, appendChild() {},
    querySelector: (sel) => fills[sel] ?? null,
    querySelectorAll: () => [],
  };
}

type Opcions = {
  /** El camí fins a /observatori/ que porta el diàleg a `data-base`. */
  base?: string;
  /** Una casella de fora del diàleg, com la del hero de la landing. */
  extern?: Fals;
  /** El `location.search` de la pàgina, per a «?q=». */
  search?: string;
};

/** Els tres fitxers tal com els escriu el generador, en petit. */
const MUNICIPIS: IndexCerca = {
  sig: ["ERC-AM"],
  mun: [
    { s: "alcanar", n: "Alcanar", c: "Montsià", h: 9_500, k: "alcanar", a: "Maria Puig Soler", g: 0 },
    { s: "alins", n: "Alins", c: "Pallars Sobirà", h: 250, k: "alins", a: "Joan Pons", g: 0 },
  ],
  par: [],
};
const ELECTES: IndexElectes = {
  sig: ["ERC-AM"],
  reg: [["Maria Puig Soler", 0, 0], ["Pau Roig Vives", 0, -1]],
  cand: [],
  alc: { 0: "regidor/maria-puig-soler/" },
  exr: {},
  exc: {},
};
const ALCALDIES: IndexAlcaldies = {
  sig: ["ERC-AM", "CiU"],
  alc: [
    ["Joan Roig Castell", 0, "2003-2007 i 2015-2023", 0, 1],
    ["Anna Ferrer Roca", 0, "2007-2013", 1, 2],
    ["Pere Vidal Mas", 0, "2013-2015", 1, 0],
  ],
  // A Alins qui hi és avui no té fitxa de regidor: la seva pàgina és la d'alcaldia.
  act: { 1: "alcaldia/joan-pons/" },
  exa: {},
};

/** Les tres baixades vénen encadenades, cadascuna en el seu torn de promeses. */
async function espera() {
  for (let i = 0; i < 4; i += 1) await new Promise((r) => setTimeout(r, 0));
}

/**
 * Munta el guió sobre un DOM de mentida i torna les peces per fer-lo anar.
 * `fetch` és de mentida i torna els tres fitxers pel nom; els que no es
 * passen fallen, com fallarien a la xarxa. El guió s'agafa de la sortida
 * incrustada, que és la mateixa cadena que va a l'asset.
 */
function munta(fitxers: Partial<Record<string, unknown>>, opcions: Opcions = {}) {
  const base = opcions.base ?? "/observatori/";
  const html = cercador(base);
  const inici = html.indexOf("<script>") + 8;
  const script = html.slice(inici, html.indexOf("</script>", inici));

  const camp = element();
  const caixa = element();
  const dialeg = element({ "#cerca-camp": camp, ".cerca-resultats": caixa });
  dialeg.atributs["data-base"] = base;
  const boto = element();
  const document = {
    querySelector: (sel: string) => (sel === ".cercador" ? dialeg : null),
    querySelectorAll: (sel: string) => (sel === "[data-cerca-camp]" && opcions.extern ? [opcions.extern] : []),
    createElement: () => boto,
    addEventListener() {},
  };
  const fetch = (url: string) => {
    const nom = url.replace(base, "");
    const dades = fitxers[nom];
    return dades === undefined
      ? Promise.reject(new Error(`no hi ha ${nom}`))
      : Promise.resolve({ json: () => Promise.resolve(dades) });
  };
  const window = { location: { search: opcions.search ?? "" } };
  new Function("document", "fetch", "window", script)(document, fetch, window);

  return {
    camp, caixa, dialeg, boto,
    busca(text: string): string {
      camp.value = text;
      camp.escoltes.input!();
      return caixa.innerHTML;
    },
  };
}

/**
 * Obre el diàleg amb el botó de la capçalera —que és el que dispara les
 * baixades— i torna una funció per escriure-hi i llegir el que es pinta.
 */
async function obre(fitxers: Partial<Record<string, unknown>>, opcions: Opcions = {}) {
  const peces = munta(fitxers, opcions);
  peces.boto.escoltes.click!();
  await espera();
  return peces;
}

const TOTS = { "cerca.json": MUNICIPIS, "cerca-electes.json": ELECTES, "cerca-alcaldies.json": ALCALDIES };

/** Les files pintades, en ordre: [mena, nom, context, enllaç]. */
function files(html: string): [string, string, string, string][] {
  return [...html.matchAll(/href="([^"]*)"><span class="mena">([^<]*)<\/span><span class="qui"><b>([^<]*)<\/b><span>([^<]*)<\/span>/g)]
    .map((m) => [m[2]!, m[3]!, m[4]!, m[1]!]);
}

describe("el guió del cercador, executat", () => {
  it("troba un exalcalde pel cognom, amb el càrrec, els anys i el partit, i l'envia a la seva fitxa", async () => {
    const { busca } = await obre(TOTS);
    expect(files(busca("roig castell"))).toEqual([
      ["Alcaldia", "Joan Roig Castell", "alcalde d'Alcanar · 2003-2007 i 2015-2023 · ERC-AM", "/observatori/m/alcanar/alcaldia/joan-roig-castell/"],
    ]);
  });

  it("normalitza els accents del que s'escriu, com fa amb els pobles", async () => {
    const { busca } = await obre(TOTS);
    expect(files(busca("férrer")).map((f) => f[1])).toEqual(["Anna Ferrer Roca"]);
  });

  it("diu «alcaldessa» quan el registre ho diu i «a l'alcaldia» quan cap font no ho diu", async () => {
    const { busca } = await obre(TOTS);
    expect(files(busca("ferrer"))[0]![2]).toBe("alcaldessa d'Alcanar · 2007-2013 · CiU");
    expect(files(busca("vidal"))[0]![2]).toBe("a l'alcaldia d'Alcanar · 2013-2015 · CiU");
  });

  it("qui seu al ple avui surt abans que qui va tenir l'alcaldia fa anys", async () => {
    const { busca } = await obre(TOTS);
    // «roig» lliga igual de bé amb tots dos: el regidor d'ara va primer.
    expect(files(busca("roig")).map((f) => [f[0], f[1]])).toEqual([
      ["Regidor", "Pau Roig Vives"],
      ["Alcaldia", "Joan Roig Castell"],
    ]);
  });

  it("l'alcaldia d'avui no es repeteix: la fila del municipi i la de regidor, i cap d'exalcalde", async () => {
    const { busca } = await obre(TOTS);
    const trobades = files(busca("puig soler"));
    expect(trobades.map((f) => f[0])).toEqual(["Alcaldia", "Regidor"]);
    for (const f of trobades) expect(f[3]).toBe("/observatori/m/alcanar/regidor/maria-puig-soler/");
  });

  it("l'alcaldia d'avui sense fitxa de regidor va a la seva pàgina d'alcaldia, no a l'apartat", async () => {
    const { busca } = await obre(TOTS);
    const [pons] = files(busca("pons"));
    expect(pons).toEqual(["Alcaldia", "Joan Pons", "alcaldia d'Alins · ERC-AM", "/observatori/m/alins/alcaldia/joan-pons/"]);
  });

  it("sense el tercer fitxer, la cerca continua i l'alcaldia d'avui va a l'apartat d'alcaldies", async () => {
    const { busca } = await obre({ "cerca.json": MUNICIPIS, "cerca-electes.json": ELECTES });
    expect(files(busca("roig")).map((f) => f[1])).toEqual(["Pau Roig Vives"]);
    expect(files(busca("pons"))[0]![3]).toBe("/observatori/m/alins/#alcaldies");
  });

  it("si els electes fallen, les alcaldies d'abans arriben igualment", async () => {
    const { busca } = await obre({ "cerca.json": MUNICIPIS, "cerca-alcaldies.json": ALCALDIES });
    expect(files(busca("roig castell")).map((f) => f[1])).toEqual(["Joan Roig Castell"]);
  });
});

describe("el cercador compartit: el mateix a l'Observatori i a la landing", () => {
  it("l'asset i l'incrustat són la mateixa cadena, per al guió, per al full i per al diàleg", async () => {
    const dir = `${await mkdtemp(join(tmpdir(), "cercador-"))}/`;
    try {
      await escriuCercadorCompartit(dir);
      const js = await readFile(`${dir}cercador.js`, "utf8");
      const css = await readFile(`${dir}cercador.css`, "utf8");
      const html = await readFile(`${dir}cercador.html`, "utf8");
      expect(js).toContain(CERCADOR_JS);
      expect(cercador("../../")).toContain(CERCADOR_JS);
      const full = senseComentaris(CERCADOR_CSS).trim();
      expect(css).toContain(full);
      expect(RADIOGRAFIA_CSS).toContain(full);
      // Des de la landing els índexs viuen a /observatori/, en absolut.
      expect(html).toContain(dialegCercador("/observatori/"));
      expect(html).toContain('data-base="/observatori/"');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("el full porta el botó de la capçalera, la ranura i el diàleg, i el guió és JavaScript vàlid", () => {
    for (const regla of [".capcalera .ranura-cerca{", ".obre-cerca{", ".cercador{", ".cerca-fila{"]) {
      expect(CERCADOR_CSS).toContain(regla);
    }
    expect(() => new Function(CERCADOR_JS)).not.toThrow();
  });

  it("el camí fins a /observatori/ surt del data-base del diàleg, no del guió", async () => {
    expect(dialegCercador("../../")).toContain('data-base="../../"');
    expect(dialegCercador("../../", "Busca tu municipio")).toContain('placeholder="Busca tu municipio"');
    expect(dialegCercador("./")).toContain(`placeholder="${PLACEHOLDER_CERCA}"`);
    const { busca } = await obre(TOTS, { base: "../../" });
    expect(files(busca("pons"))[0]![3]).toBe("../../m/alins/alcaldia/joan-pons/");
  });

  it("una casella de fora obre el diàleg amb el que s'hi ha escrit, i el formulari no se'n va enlloc", async () => {
    const extern = element();
    const formulari = element();
    extern.form = formulari;
    const { camp, caixa, dialeg } = munta(TOTS, { extern });
    expect(dialeg.obertures).toBe(0);
    extern.value = "roig";
    extern.escoltes.input!();
    await espera();
    expect(dialeg.obertures).toBe(1);
    expect(camp.value).toBe("roig");
    expect(files(caixa.innerHTML).map((f) => f[1])).toContain("Pau Roig Vives");
    // L'Enter a la casella no envia el formulari: obre el diàleg amb el text.
    let evitat = false;
    formulari.escoltes.submit!({ preventDefault() { evitat = true; } });
    expect(evitat).toBe(true);
  });

  it("amb «?q=» a l'adreça —el formulari d'una pàgina sense guió— el diàleg s'obre sol amb el text", async () => {
    const { camp, caixa, dialeg } = munta(TOTS, { search: "?q=roig+castell" });
    await espera();
    expect(dialeg.obertures).toBe(1);
    expect(camp.value).toBe("roig castell");
    expect(files(caixa.innerHTML).map((f) => f[1])).toEqual(["Joan Roig Castell"]);
  });
});
