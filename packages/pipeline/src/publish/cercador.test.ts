import { describe, expect, it } from "vitest";
import { cercador } from "./cercador";
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
  escoltes: Escoltes;
  addEventListener(nom: string, fn: (e?: unknown) => void): void;
  setAttribute(): void;
  removeAttribute(): void;
  getAttribute(): null;
  showModal(): void;
  focus(): void;
  appendChild(): void;
  querySelector(sel: string): Fals | null;
  querySelectorAll(): unknown[];
};

function element(fills: Record<string, Fals> = {}): Fals {
  return {
    value: "", innerHTML: "", hidden: false, escoltes: {},
    addEventListener(nom, fn) { this.escoltes[nom] = fn; },
    setAttribute() {}, removeAttribute() {}, getAttribute: () => null,
    showModal() {}, focus() {}, appendChild() {},
    querySelector: (sel) => fills[sel] ?? null,
    querySelectorAll: () => [],
  };
}

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

/**
 * Obre el diàleg —que és el que dispara les baixades— i torna una funció per
 * escriure-hi i llegir el que es pinta. `fetch` és de mentida i torna els tres
 * fitxers pel nom; els que no es passen fallen, com fallarien a la xarxa.
 */
async function obre(fitxers: Partial<Record<string, unknown>>) {
  const html = cercador("/observatori/");
  const inici = html.indexOf("<script>") + 8;
  const script = html.slice(inici, html.indexOf("</script>", inici));

  const camp = element();
  const caixa = element();
  const dialeg = element({ "#cerca-camp": camp, ".cerca-resultats": caixa });
  const boto = element();
  const document = {
    querySelector: (sel: string) => (sel === ".cercador" ? dialeg : null),
    querySelectorAll: () => [],
    createElement: () => boto,
    addEventListener() {},
  };
  const fetch = (url: string) => {
    const nom = url.replace("/observatori/", "");
    const dades = fitxers[nom];
    return dades === undefined
      ? Promise.reject(new Error(`no hi ha ${nom}`))
      : Promise.resolve({ json: () => Promise.resolve(dades) });
  };
  new Function("document", "fetch", "window", script)(document, fetch, {});

  // El clic al botó és el que obre el diàleg i demana el primer fitxer; els
  // altres dos vénen encadenats darrere, cadascun en el seu torn de promeses.
  boto.escoltes.click!();
  for (let i = 0; i < 4; i += 1) await new Promise((r) => setTimeout(r, 0));

  return {
    busca(text: string): string {
      camp.value = text;
      camp.escoltes.input!();
      return caixa.innerHTML;
    },
  };
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
