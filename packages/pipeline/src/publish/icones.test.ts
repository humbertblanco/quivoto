import { describe, expect, it } from "vitest";
import { ICONES, ICONES_ENS, ICONES_SERVEIS, icona, iconaDeServei } from "./icones";

/**
 * Proves estructurals, sense instantànies.
 *
 * Una instantània de l'SVG sencer fallaria a cada retoc de dibuix i acabaria
 * acceptant-se a cegues. El que aquí es comprova és el que fa que les icones
 * siguin un joc i no trenta dibuixos solts: que totes són SVG ben format, que
 * van dins la mateixa graella, que només fan servir els colors de la casa i el
 * gruix de la casa, i que la cara és la mateixa a totes. Les regles són a la
 * capçalera de `tools/icons_lib.py`.
 */

const TOTES: Array<[string, string]> = [ICONES, ICONES_SERVEIS, ICONES_ENS].flatMap((mapa) =>
  Object.entries(mapa).map(([n, s]) => [n, s] as [string, string]),
);

/** Els sis tons de la casa, i prou. */
const COLORS = new Set(["#FBF7EE", "#1E1B2E", "#E2735A", "#BFE8D2", "#C9C4F2", "#FFD8B8"]);

/** Els gruixos permesos: la casa (3), la silueta per darrere (6) i la boca (2,1). */
const GRUIXOS = new Set(["3", "6", "2.1"]);

/** Les icones que no porten cara, i per què: l'hemicicle d'escons és un gràfic. */
const SENSE_CARA = new Set(["Regidories"]);

type Etiqueta = { nom: string; attrs: Record<string, string>; tanca: boolean; autotanca: boolean };

/**
 * Un lector d'etiquetes prou complet per als SVG que escrivim aquí, i no més.
 *
 * Talla el text en etiquetes, n'extreu els atributs i rebutja tot el que no
 * entén (un atribut sense cometes, un «<» solt). No és un analitzador XML: és
 * el mínim per saber que les etiquetes s'obren i es tanquen en ordre.
 */
function etiquetes(svg: string): Etiqueta[] {
  const sortida: Etiqueta[] = [];
  const re = /<(\/?)([a-zA-Z]+)((?:\s+[a-zA-Z:-]+="[^"<>]*")*)\s*(\/?)>/g;
  let fi = 0;
  for (const m of svg.matchAll(re)) {
    // Entre etiquetes només hi pot haver text sense «<» (la ç de «Llengua»).
    expect(svg.slice(fi, m.index).includes("<"), `etiqueta mal formada a ${fi}`).toBe(false);
    fi = m.index! + m[0].length;
    const attrs: Record<string, string> = {};
    for (const a of m[3]!.matchAll(/([a-zA-Z:-]+)="([^"]*)"/g)) {
      expect(attrs[a[1]!], `atribut repetit ${a[1]}`).toBeUndefined();
      attrs[a[1]!] = a[2]!;
    }
    sortida.push({ nom: m[2]!, attrs, tanca: m[1] === "/", autotanca: m[4] === "/" });
  }
  expect(svg.slice(fi).includes("<")).toBe(false);
  return sortida;
}

/** Comprova que les etiquetes s'obren i es tanquen en ordre, i torna l'arrel. */
function benFormat(svg: string): void {
  const pila: string[] = [];
  for (const e of etiquetes(svg)) {
    if (e.tanca) expect(pila.pop(), `</${e.nom}> sense obrir`).toBe(e.nom);
    else if (!e.autotanca) pila.push(e.nom);
  }
  expect(pila, "etiquetes sense tancar").toEqual([]);
}

/**
 * Els punts d'un camí, prou per mesurar-ne la caixa.
 *
 * Els punts de control de les corbes hi entren encara que la corba no hi passi:
 * si el control ja és a fora, la corba hi va a prop i el traç gruixut també. De
 * l'arc (`A`) només se'n queda el punt final; els arcs d'aquestes icones són
 * trossos de cercle entre punts que ja hi són, i el marge els cobreix.
 */
function puntsDelCami(d: string): Array<[number, number]> {
  const toks = d.match(/[MmLlHhVvQqTtCcSsAaZz]|-?[0-9]*\.?[0-9]+/g) ?? [];
  const punts: Array<[number, number]> = [];
  let x = 0, y = 0, sx = 0, sy = 0, cmd = "";
  let i = 0;
  const num = (): number => Number(toks[i++]);
  const posa = (): void => { punts.push([x, y]); };
  while (i < toks.length) {
    if (/[A-Za-z]/.test(toks[i]!)) { cmd = toks[i]!; i++; }
    switch (cmd) {
      case "M": x = num(); y = num(); sx = x; sy = y; posa(); cmd = "L"; break;
      case "m": x += num(); y += num(); sx = x; sy = y; posa(); cmd = "l"; break;
      case "L": x = num(); y = num(); posa(); break;
      case "l": x += num(); y += num(); posa(); break;
      case "H": x = num(); posa(); break;
      case "h": x += num(); posa(); break;
      case "V": y = num(); posa(); break;
      case "v": y += num(); posa(); break;
      case "Q": { const cx = num(), cy = num(); punts.push([cx, cy]); x = num(); y = num(); posa(); break; }
      case "q": { const cx = x + num(), cy = y + num(); punts.push([cx, cy]); x += num(); y += num(); posa(); break; }
      case "C": { punts.push([num(), num()], [num(), num()]); x = num(); y = num(); posa(); break; }
      case "c": { punts.push([x + num(), y + num()], [x + num(), y + num()]); x += num(); y += num(); posa(); break; }
      case "A": { num(); num(); num(); num(); num(); x = num(); y = num(); posa(); break; }
      case "a": { num(); num(); num(); num(); num(); x += num(); y += num(); posa(); break; }
      case "Z": case "z": x = sx; y = sy; cmd = ""; break;
      default: i++; break;
    }
  }
  return punts;
}

/**
 * La caixa que ocupa la tinta, amb el traç inclòs.
 *
 * El gruix es llegeix de l'element o, si no en porta, del grup que l'embolcalla:
 * la silueta posa el traç de 6 al grup i les formes de dins no en diuen res.
 * Del traç només en surt la meitat cap enfora, i és aquesta meitat la que ha
 * de quedar dins de la zona viva. Les formes girades no es mesuren: la rotació
 * les mou i el que se'n comprovaria seria una posició que el dibuix no té.
 */
function caixa(svg: string): { x0: number; y0: number; x1: number; y1: number } {
  const c = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const afegeix = (x: number, y: number, m: number): void => {
    c.x0 = Math.min(c.x0, x - m); c.y0 = Math.min(c.y0, y - m);
    c.x1 = Math.max(c.x1, x + m); c.y1 = Math.max(c.y1, y + m);
  };
  const gruixos: number[] = [];
  for (const e of etiquetes(svg)) {
    if (e.nom === "g") {
      if (e.tanca) gruixos.pop();
      else gruixos.push(Number(e.attrs["stroke-width"] ?? gruixos.at(-1) ?? 0));
      continue;
    }
    if (e.tanca || e.attrs.transform) continue;
    const a = e.attrs;
    const traç = a.stroke === "none" ? 0 : Number(a["stroke-width"] ?? gruixos.at(-1) ?? 0);
    const m = traç / 2;
    if (e.nom === "path") for (const [x, y] of puntsDelCami(a.d!)) afegeix(x, y, m);
    if (e.nom === "circle") {
      const r = Number(a.r) + m;
      afegeix(Number(a.cx) - r, Number(a.cy) - r, 0);
      afegeix(Number(a.cx) + r, Number(a.cy) + r, 0);
    }
    if (e.nom === "rect") {
      afegeix(Number(a.x), Number(a.y), m);
      afegeix(Number(a.x) + Number(a.width), Number(a.y) + Number(a.height), m);
    }
  }
  return c;
}

describe("les icones, totes: el joc", () => {
  it("n'hi ha de les tres famílies i cap és buida", () => {
    expect(Object.keys(ICONES)).toHaveLength(16);
    expect(Object.keys(ICONES_SERVEIS).length).toBeGreaterThan(0);
    expect(Object.keys(ICONES_ENS).length).toBeGreaterThan(0);
    for (const [nom, svg] of TOTES) expect(svg, nom).not.toBe("");
  });

  it("cap nom no es repeteix entre famílies: el primer mapa amagaria el segon", () => {
    const noms = TOTES.map(([n]) => n);
    expect(new Set(noms).size).toBe(noms.length);
  });

  it.each(TOTES)("«%s» és un SVG ben format, amb el viewBox i la mida de la casa", (_nom, svg) => {
    benFormat(svg);
    expect(svg.startsWith("<svg ")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(svg).toContain('viewBox="0 0 48 48"');
    expect(svg).toContain('width="48"');
    expect(svg).toContain('height="48"');
  });

  it.each(TOTES)("«%s» queda dins de la zona viva, de 4 a 44, amb el traç inclòs", (nom, svg) => {
    const c = caixa(svg);
    expect(c.x0, `${nom}: x0`).toBeGreaterThanOrEqual(4);
    expect(c.y0, `${nom}: y0`).toBeGreaterThanOrEqual(4);
    expect(c.x1, `${nom}: x1`).toBeLessThanOrEqual(44);
    expect(c.y1, `${nom}: y1`).toBeLessThanOrEqual(44);
  });

  it.each(TOTES)("«%s» només fa servir els colors de la casa, sense degradats", (nom, svg) => {
    for (const e of etiquetes(svg)) {
      for (const atribut of ["fill", "stroke"]) {
        const valor = e.attrs[atribut];
        if (valor === undefined || valor === "none") continue;
        expect(COLORS.has(valor), `${nom}: ${atribut}="${valor}"`).toBe(true);
      }
    }
    expect(svg).not.toMatch(/Gradient|<filter|opacity|url\(|rgba?\(/);
  });

  it.each(TOTES)("«%s» fa servir el gruix de la casa i no porta cap id", (nom, svg) => {
    for (const e of etiquetes(svg)) {
      const g = e.attrs["stroke-width"];
      if (g !== undefined) expect(GRUIXOS.has(g), `${nom}: stroke-width="${g}"`).toBe(true);
      // El traç de 6 només és per a la silueta: un grup de tinta per darrere.
      if (g === "6") {
        expect(e.nom, nom).toBe("g");
        expect(e.attrs.stroke, nom).toBe("#1E1B2E");
      }
      // Dues icones a la mateixa pàgina amb el mateix id es trepitjarien.
      expect(e.attrs.id, nom).toBeUndefined();
    }
  });

  it.each(TOTES)("«%s» és una imatge amb nom mentre no es digui el contrari", (nom, svg) => {
    expect(svg, nom).toContain('role="img"');
    expect(svg, nom).toContain(`aria-label="${nom}"`);
    expect(svg, nom).not.toContain("aria-hidden");
  });

  it.each(TOTES.filter(([n]) => !SENSE_CARA.has(n)))("«%s» porta la cara de la casa, mesurada igual", (nom, svg) => {
    const cara = svg.slice(svg.indexOf('<g class="cara">'));
    expect(svg.indexOf('<g class="cara">'), nom).toBeGreaterThan(0);
    expect(cara.match(/<circle [^>]*r="3.6" fill="#FBF7EE"\/>/g), nom).toHaveLength(2);
    expect(cara.match(/<circle [^>]*r="1.9" fill="#1E1B2E"\/>/g), nom).toHaveLength(2);
    expect(cara.match(/<rect [^>]*width="8" height="8.4" rx="3.4"/g), nom).toHaveLength(2);
    expect(cara, nom).toMatch(/<path class="boca" d="M[-0-9.]+ [-0-9.]+ q4 3 8 0" stroke="#1E1B2E" stroke-width="2.1"/);
    expect(svg, nom).toMatch(/style="--retard: \d\.\ds"/);
    // La cara va a sobre de tot: res no es dibuixa per damunt dels ulls.
    expect(svg.endsWith("</g></svg>"), nom).toBe(true);
  });

  it("les que no porten cara són les que s'han decidit, i no cap altra per descuit", () => {
    const sense = TOTES.filter(([, s]) => !s.includes('class="cara"')).map(([n]) => n);
    expect(new Set(sense)).toEqual(SENSE_CARA);
  });

  it("no n'hi ha dues amb el mateix dibuix", () => {
    const dibuixos = TOTES.map(([, s]) => s.replace(/aria-label="[^"]*"/, "").replace(/--retard: [0-9.]+s/, ""));
    expect(new Set(dibuixos).size).toBe(dibuixos.length);
  });
});

describe("les icones dels serveis", () => {
  /**
   * Les etiquetes reals, tal com surten de les dades: els quinze programes de
   * `jobs/j15-despesa-serveis.ts`, els onze serveis del cost efectiu i les
   * àrees del bloc dels diners. Si algú en canvia una a la font i aquí no,
   * aquesta prova és la que ho diu.
   */
  const PROGRAMES = [
    "Escombraries i residus", "Neteja viària", "Enllumenat públic", "Aigua potable",
    "Clavegueram", "Parcs i jardins", "Vies públiques", "Habitatge", "Serveis socials",
    "Escoles d'infantil i primària", "Biblioteques i arxius", "Instal·lacions esportives",
    "Policia local i seguretat", "Òrgans de govern", "Pagar el deute",
  ];
  const COST_EFECTIU = [
    "Aigua potable", "Recollida d'escombraries", "Neteja viària", "Clavegueram",
    "Enllumenat públic", "Parcs i jardins", "Tractament de residus", "Atenció social",
    "Biblioteca", "Instal·lacions esportives", "Cementiri",
  ];
  const AREES = [
    "Despesa total", "Serveis públics bàsics", "Educació, cultura i esport",
    "Administració general", "Protecció i promoció social", "Deute públic",
    "Actuacions econòmiques",
  ];

  it.each([...PROGRAMES, ...COST_EFECTIU, ...AREES])("«%s» té dibuix propi i no el recanvi", (etiqueta) => {
    const svg = iconaDeServei(etiqueta);
    expect(svg, etiqueta).toContain("<svg");
    expect(svg, etiqueta).not.toBe(iconaDeServei("una cosa que no existeix"));
  });

  it("dins d'una llista va muda: el nom del servei ja hi és escrit al costat", () => {
    const svg = iconaDeServei("Aigua potable");
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).toContain('focusable="false"');
    expect(svg).not.toContain("role=");
    expect(svg).not.toContain("aria-label");
  });

  it("un servei desconegut torna el recanvi i no peta", () => {
    const recanvi = iconaDeServei("Servei de teletransport municipal");
    expect(recanvi).toContain('viewBox="0 0 48 48"');
    expect(recanvi).toContain('aria-hidden="true"');
    expect(recanvi).toBe(iconaDeServei(""));
    expect(recanvi).not.toBe(iconaDeServei("Cementiri"));
  });

  it("no confon dues files veïnes de la mateixa llista", () => {
    expect(iconaDeServei("Recollida d'escombraries")).not.toBe(iconaDeServei("Tractament de residus"));
    expect(iconaDeServei("Neteja viària")).not.toBe(iconaDeServei("Escombraries i residus"));
    expect(iconaDeServei("Parcs i jardins")).not.toBe(iconaDeServei("Instal·lacions esportives"));
    expect(iconaDeServei("Deute públic")).not.toBe(iconaDeServei("fiscalitat"));
  });

  it("«Pagar el deute» i el deute viu dels ens porten el mateix bitllet que l'àrea", () => {
    expect(iconaDeServei("Pagar el deute")).toBe(iconaDeServei("Deute públic"));
    expect(icona("deute public")).toBe(ICONES_SERVEIS["Deute públic"]);
    expect(icona("Deute viu")).toBe(ICONES_SERVEIS["Deute públic"]);
  });

  it("aprofita el que la casa ja tenia dibuixat i no en fa un de calcat", () => {
    expect(iconaDeServei("Escombraries i residus")).toBe(iconaDeServei("residus"));
    expect(iconaDeServei("Òrgans de govern")).toBe(iconaDeServei("el ple"));
    expect(iconaDeServei("Escoles d'infantil i primària")).toBe(iconaDeServei("educació"));
    expect(iconaDeServei("Atenció social")).toBe(iconaDeServei("serveis socials"));
    expect(iconaDeServei("Actuacions econòmiques")).toBe(iconaDeServei("comerç"));
  });

  it("l'apòstrof tipogràfic no deixa cap servei sense icona", () => {
    expect(iconaDeServei("Recollida d’escombraries")).toBe(iconaDeServei("Recollida d'escombraries"));
  });
});

describe("les icones dels ens i del govern local", () => {
  it.each([
    ["diputació", "Diputació"], ["Diputacions", "Diputació"],
    ["consell comarcal", "Consell comarcal"], ["Consells comarcals", "Consell comarcal"],
    ["municipis", "Municipis"], ["Ajuntament", "Municipis"],
    ["habitants", "Habitants"], ["població", "Habitants"],
    ["subvencions", "Subvencions"], ["ajuts", "Subvencions"],
    ["vots", "Vots"], ["papereta", "Vots"],
    ["regidories", "Regidories"], ["regidors", "Regidories"], ["escons", "Regidories"],
    ["alcaldia", "Alcaldia"], ["alcaldies", "Alcaldia"],
  ])("«%s» porta a «%s»", (tema, nom) => {
    expect(icona(tema)).toBe(ICONES_ENS[nom]);
  });

  it("els temes que les pàgines ja feien servir no canvien de dibuix", () => {
    // Que les pàgines passin d'«urbanisme» a «municipis» és cosa seva: aquí
    // només s'afegeix, i «urbanisme» continua sent la grua.
    expect(icona("urbanisme")).toBe(ICONES["Urbanisme"]);
    expect(icona("el ple")).toBe(ICONES["El ple"]);
  });
});

describe("icona", () => {
  it("no canvia per als temes de sempre: cap crida existent no es mou", () => {
    expect(icona("habitatge")).toBe(ICONES["Habitatge"]);
    expect(icona("residus")).toBe(ICONES["Neteja"]);
    expect(icona("Medi ambient")).toBe(ICONES["Medi ambient"]);
  });

  it("un tema desconegut continua tornant buit i no peta", () => {
    expect(() => icona("un tema que no existeix")).not.toThrow();
    expect(icona("un tema que no existeix")).toBe("");
    expect(icona("")).toBe("");
  });

  it("coneix els serveis i els ens, i els pot tornar muts", () => {
    expect(icona("Clavegueram")).toBe(ICONES_SERVEIS["Clavegueram"]);
    const mut = icona("Clavegueram", true);
    expect(mut).toContain('aria-hidden="true"');
    expect(mut).not.toContain("role=");
    // Muda o no, és el mateix dibuix: només canvia com s'anuncia.
    expect(mut.replace(/aria-hidden="true" focusable="false"/, "")).toBe(
      icona("Clavegueram").replace(/role="img" aria-label="[^"]*"/, ""),
    );
    expect(icona("diputació", true)).toContain('aria-hidden="true"');
  });
});
