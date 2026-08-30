import { describe, expect, it } from "vitest";
import { ICONES, ICONES_SERVEIS, icona, iconaDeServei } from "./icones";

/**
 * Un lector de camins prou complet per als camins que dibuixem aquí, i no més.
 *
 * Serveix per a una sola cosa: comprovar que cap punt del dibuix no surt del
 * viewBox. Els punts de control d'una corba quadràtica hi entren encara que la
 * corba no hi passi, i està bé que hi entrin: si el control ja és a fora, la
 * corba hi va a prop i el traç gruixut se'n va igualment.
 *
 * De l'arc (`A`) només se'n queda el punt final. Els arcs d'aquestes icones
 * són sempre semicercles entre dos punts que ja hi són, i mesurar-ne la panxa
 * exacta demanaria implementar la conversió d'arc a centre, que és molt codi
 * per a una comprovació que el marge de tolerància ja cobreix.
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
      case "c": {
        punts.push([x + num(), y + num()], [x + num(), y + num()]);
        x += num(); y += num(); posa(); break;
      }
      // Radis, rotació i les dues banderes es llegeixen i es llencen: només
      // ens quedem el punt d'arribada.
      case "A": { num(); num(); num(); num(); num(); x = num(); y = num(); posa(); break; }
      case "a": { num(); num(); num(); num(); num(); x += num(); y += num(); posa(); break; }
      case "Z": case "z": x = sx; y = sy; cmd = ""; i++; break;
      default: i++; break;
    }
  }
  return punts;
}

/**
 * Tots els punts d'un SVG: camins, cercles i rectangles.
 *
 * El marge és mig traç: una vora de tinta de 3 pintada damunt de la línia surt
 * 1,5 cap enfora, i és el que de debò s'ha de quedar dins del quadre.
 */
function puntsDelSvg(svg: string, marge: number): Array<[number, number]> {
  const punts: Array<[number, number]> = [];
  for (const m of svg.matchAll(/ d="([^"]+)"/g)) {
    for (const [x, y] of puntsDelCami(m[1]!)) {
      punts.push([x - marge, y - marge], [x + marge, y + marge]);
    }
  }
  for (const m of svg.matchAll(/<circle cx="([-0-9.]+)" cy="([-0-9.]+)" r="([-0-9.]+)"/g)) {
    const cx = Number(m[1]), cy = Number(m[2]), r = Number(m[3]) + marge;
    punts.push([cx - r, cy - r], [cx + r, cy + r]);
  }
  for (const m of svg.matchAll(/<rect ([^>]*)\/>/g)) {
    const attrs = m[1]!;
    // Un rectangle girat («Participació» en porta un) no es mesura amb les
    // seves x i y: la rotació el mou, i el que se'n comprovaria seria una
    // posició que el dibuix no té. Es deixa fora i prou.
    if (attrs.includes("transform=")) continue;
    const n = (nom: string): number => Number(attrs.match(new RegExp(`${nom}="([-0-9.]+)"`))?.[1] ?? NaN);
    const x = n("x"), y = n("y"), w = n("width"), h = n("height");
    if (Number.isNaN(x + y + w + h)) continue;
    punts.push([x - marge, y - marge], [x + w + marge, y + h + marge]);
  }
  return punts;
}

const TOTES: Array<[string, string]> = [
  ...Object.entries(ICONES).map(([n, s]) => [n, s] as [string, string]),
  ...Object.entries(ICONES_SERVEIS).map(([n, s]) => [n, s] as [string, string]),
];

describe("les icones, totes", () => {
  it("no n'hi ha cap de buida i n'hi ha de les dues famílies", () => {
    expect(Object.keys(ICONES).length).toBeGreaterThan(0);
    expect(Object.keys(ICONES_SERVEIS).length).toBeGreaterThan(0);
    for (const [nom, svg] of TOTES) expect(svg, nom).not.toBe("");
  });

  it.each(TOTES)("«%s» porta viewBox de 48 i mida coherent", (_nom, svg) => {
    expect(svg).toContain('viewBox="0 0 48 48"');
    expect(svg).toContain('width="48"');
    expect(svg).toContain('height="48"');
  });

  it.each(TOTES)("«%s» no se surt del viewBox", (nom, svg) => {
    // 1,75 és mig traç del més gruixut que fem servir (3,5, a «Fiscalitat»).
    const punts = puntsDelSvg(svg, 1.75);
    expect(punts.length, nom).toBeGreaterThan(0);
    for (const [x, y] of punts) {
      expect(x, `${nom}: x=${x}`).toBeGreaterThanOrEqual(0);
      expect(x, `${nom}: x=${x}`).toBeLessThanOrEqual(48);
      expect(y, `${nom}: y=${y}`).toBeGreaterThanOrEqual(0);
      expect(y, `${nom}: y=${y}`).toBeLessThanOrEqual(48);
    }
  });

  it.each(TOTES)("«%s» és una imatge amb nom mentre no es digui el contrari", (nom, svg) => {
    expect(svg, nom).toContain('role="img"');
    expect(svg, nom).toContain(`aria-label="${nom}"`);
    expect(svg, nom).not.toContain("aria-hidden");
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

  it.each([...PROGRAMES, ...COST_EFECTIU, ...AREES])(
    "«%s» té dibuix propi i no el recanvi",
    (etiqueta) => {
      const svg = iconaDeServei(etiqueta);
      expect(svg, etiqueta).toContain("<svg");
      expect(svg, etiqueta).not.toBe(iconaDeServei("una cosa que no existeix"));
    },
  );

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
    // El recanvi és una peça neutra, no cap dels serveis de debò.
    expect(recanvi).not.toBe(iconaDeServei("Cementiri"));
  });

  it("no confon dues files veïnes de la mateixa llista", () => {
    // La recollida és el cubell i el tractament és la planta: si compartissin
    // dibuix, dues files seguides es llegirien com la mateixa xifra.
    expect(iconaDeServei("Recollida d'escombraries")).not.toBe(iconaDeServei("Tractament de residus"));
    // La neteja viària és l'escombra, no el cubell de les escombraries.
    expect(iconaDeServei("Neteja viària")).not.toBe(iconaDeServei("Escombraries i residus"));
    // L'arbre dels parcs no és la pilota dels esports.
    expect(iconaDeServei("Parcs i jardins")).not.toBe(iconaDeServei("Instal·lacions esportives"));
    // El bitllet del deute no és la moneda dels impostos.
    expect(iconaDeServei("Deute públic")).not.toBe(iconaDeServei("fiscalitat"));
  });

  it("«Pagar el deute», el nom nou del programa 011, porta el mateix bitllet que l'àrea", () => {
    // El programa es va rebatejar perquè no es confongués amb «Deute per
    // habitant»; l'àrea de J8 es continua dient «Deute públic» i el dibuix
    // és el mateix per a tots dos.
    expect(iconaDeServei("Pagar el deute")).toBe(iconaDeServei("Deute públic"));
    expect(iconaDeServei("Pagar el deute")).not.toBe(iconaDeServei("una cosa que no existeix"));
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

  it("ara també coneix els serveis, i pot tornar-los muts", () => {
    expect(icona("Clavegueram")).toBe(ICONES_SERVEIS["Clavegueram"]);
    const mut = icona("Clavegueram", true);
    expect(mut).toContain('aria-hidden="true"');
    expect(mut).not.toContain("role=");
    // Muda o no, és el mateix dibuix: només canvia com s'anuncia.
    expect(mut.replace(/aria-hidden="true" focusable="false"/, "")).toBe(
      icona("Clavegueram").replace(/role="img" aria-label="[^"]*"/, ""),
    );
  });

  it("la cara i el retard són els de la casa, també a les icones noves", () => {
    for (const [nom, svg] of Object.entries(ICONES_SERVEIS)) {
      expect(svg, nom).toContain('<g class="cara">');
      expect(svg, nom).toContain('class="pupilles"');
      expect(svg, nom).toContain('class="parpelles"');
      expect(svg, nom).toContain('class="boca"');
      expect(svg, nom).toMatch(/--retard: \d\.\ds/);
    }
  });
});
