import { describe, expect, it } from "vitest";
import {
  alcadaPer, capsaCami, geometria, projecta, renderMapa, renderNuvol, renderSilueta,
  type PuntMapa,
} from "./mapa";

/** Els quatre extrems reals de Catalunya, dels 947 municipis. */
const extrems: PuntMapa[] = [
  { slug: "sud", nom: "sud", lat: 40.5430664, lon: 1.5 },
  { slug: "nord", nom: "nord", lat: 42.8402190, lon: 1.5 },
  { slug: "oest", nom: "oest", lat: 41.7, lon: 0.25064577 },
  { slug: "est", nom: "est", lat: 41.7, lon: 3.27720570 },
];

describe("projecció", () => {
  it("no deixa cap punt fora del llenç", () => {
    const amplada = 320;
    for (const p of projecta(extrems, amplada)) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(amplada);
      expect(p.y).toBeGreaterThanOrEqual(0);
    }
  });

  it("no estira el país de costat", () => {
    // Catalunya fa uns 225 km d'ample i uns 255 d'alt: el mapa ha de sortir una
    // mica més alt que ample. Sense la correcció del cosinus sortiria al revés.
    const amplada = 320;
    const alcada = alcadaPer(extrems, amplada);
    expect(alcada).toBeGreaterThan(amplada);
    expect(alcada).toBeLessThan(amplada * 1.6);
  });

  it("el nord queda a dalt", () => {
    const p = projecta(extrems, 320);
    const nord = p.find((x) => x.punt.slug === "nord")!;
    const sud = p.find((x) => x.punt.slug === "sud")!;
    expect(nord.y).toBeLessThan(sud.y);
  });

  it("l'oest queda a l'esquerra", () => {
    const p = projecta(extrems, 320);
    expect(p.find((x) => x.punt.slug === "oest")!.x).toBeLessThan(p.find((x) => x.punt.slug === "est")!.x);
  });
});

describe("renderNuvol", () => {
  it("dibuixa un cercle per municipi", () => {
    const svg = renderNuvol(extrems);
    expect((svg.match(/<circle/g) ?? []).length).toBe(4);
  });

  it("destaca el municipi demanat amb anella, i el pinta l'últim", () => {
    const svg = renderNuvol(extrems, { destacat: "nord" });
    expect(svg).toContain('class="destacat"');
    // 4 punts, però el destacat surt del grup normal i s'hi afegeix amb anella.
    expect((svg.match(/<circle/g) ?? []).length).toBe(5);
    expect(svg.indexOf('class="destacat"')).toBeGreaterThan(svg.indexOf('class="punts"'));
  });

  it("no dibuixa res si no hi ha punts", () => {
    expect(renderNuvol([])).toBe("");
  });

  it("porta descripció per als lectors de pantalla", () => {
    expect(renderNuvol(extrems, { descripcio: "Els quatre extrems" })).toContain("Els quatre extrems");
  });
});

describe("capsaCami", () => {
  it("llegeix M, l, h, v i Z, que és tot el que fa servir la geometria", () => {
    // Un quadrat de 10 × 10 amb la cantonada a (5, 7), escrit de les quatre
    // maneres que apareixen als camins de l'ICGC.
    expect(capsaCami("M5 7h10v10l-10 0Z")).toEqual({ x: 5, y: 7, ample: 10, alt: 10 });
  });

  it("agafa tots els trossos d'un municipi partit en illes", () => {
    // Els municipis costaners són MultiPolygon: si només es llegís el primer
    // tros, l'anella cauria damunt d'una illa i no del poble.
    const capsa = capsaCami("M0 0h10v10Z M100 100h10v10Z")!;
    expect(capsa.x).toBe(0);
    expect(capsa.ample).toBe(110);
    expect(capsa.alt).toBe(110);
  });

  it("torna null quan no ha llegit cap punt, en comptes d'inventar-se una capsa", () => {
    expect(capsaCami("")).toBeNull();
    expect(capsaCami("Z")).toBeNull();
  });

  it("cap dels 947 camins reals no es queda sense capsa", () => {
    const sense = Object.keys(geometria.municipis).filter((s) => capsaCami(geometria.municipis[s]!) === null);
    expect(sense).toEqual([]);
  });

  it("cap capsa real no surt del llenç de la geometria", () => {
    const [, , ample, alt] = geometria.viewBox.split(/\s+/).map(Number) as [number, number, number, number];
    for (const slug of Object.keys(geometria.municipis)) {
      const c = capsaCami(geometria.municipis[slug]!)!;
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.x + c.ample).toBeLessThanOrEqual(ample);
      expect(c.y + c.alt).toBeLessThanOrEqual(alt);
    }
  });
});

describe("renderSilueta", () => {
  const slug = Object.keys(geometria.municipis)[0]!;

  it("dibuixa el contorn del país i el polígon del municipi, i res més", () => {
    const svg = renderSilueta(slug);
    expect((svg.match(/<path/g) ?? []).length).toBe(2);
    expect(svg).toContain(geometria.municipis[slug]!);
    expect(svg).toContain(geometria.contorn!);
  });

  it("hi posa una anella per poder trobar els municipis diminuts", () => {
    // Puigdalber ocupa 4 × 6 unitats de 1600: a 300 px és un píxel i mig.
    const svg = renderSilueta("puigdalber");
    const r = /<circle[^>]*r="(\d+)"/.exec(svg);
    expect(r).not.toBeNull();
    expect(Number(r![1])).toBeGreaterThanOrEqual(42);
  });

  it("centra l'anella dins del municipi", () => {
    const capsa = capsaCami(geometria.municipis[slug]!)!;
    const svg = renderSilueta(slug);
    const cx = Number(/cx="(-?\d+)"/.exec(svg)![1]);
    const cy = Number(/cy="(-?\d+)"/.exec(svg)![1]);
    expect(cx).toBeGreaterThanOrEqual(capsa.x);
    expect(cx).toBeLessThanOrEqual(capsa.x + capsa.ample);
    expect(cy).toBeGreaterThanOrEqual(capsa.y);
    expect(cy).toBeLessThanOrEqual(capsa.y + capsa.alt);
  });

  it("no dibuixa res per a un slug que no tenim", () => {
    expect(renderSilueta("no-existeix")).toBe("");
  });

  it("porta descripció per als lectors de pantalla", () => {
    expect(renderSilueta(slug, { descripcio: "On és" })).toContain('aria-label="On és"');
  });

  it("no desborda el document: amplada relativa i alçada automàtica", () => {
    // El contenidor de la fitxa fa 300 px a mòbil i fins a 300 a escriptori.
    // Amb «width:100%» i «height:auto» el dibuix no pot ser més ample que ell,
    // i per tant tampoc que la finestra, sigui de 320, 390 o 768 px.
    const svg = renderSilueta(slug);
    expect(svg).toContain("width:100%");
    expect(svg).toContain("height:auto");
    expect(svg).not.toMatch(/<svg[^>]*\swidth="\d/);
  });
});

describe("renderMapa", () => {
  const slug = Object.keys(geometria.municipis)[0]!;
  const punts: PuntMapa[] = Object.keys(geometria.municipis).map((s, i) => ({
    slug: s, nom: s, lat: 40.6 + (i % 200) / 100, lon: 0.3 + (i % 280) / 100, pes: 500 + i,
  }));

  it("tria la silueta quan del municipi destacat en tenim el polígon", () => {
    const svg = renderMapa(punts, { amplada: 300, destacat: slug });
    expect(svg).toContain("mapa-silueta");
    expect((svg.match(/<circle/g) ?? []).length).toBe(1);
  });

  it("torna al núvol de punts quan el destacat no té geometria", () => {
    const svg = renderMapa(extrems, { amplada: 300, destacat: "nord" });
    expect(svg).not.toContain("mapa-silueta");
    expect((svg.match(/<circle/g) ?? []).length).toBe(5);
  });

  it("pesa menys d'una vintena part del que pesava el núvol", () => {
    // La raó de tot aquest canvi: 947 fitxes x 67,9 kB són 64,3 MB.
    // Aquesta prova és el que evita que hi tornem sense adonar-nos-en.
    const opcions = { amplada: 300, destacat: slug, descripcio: `Mapa de Catalunya amb ${slug} destacat` };
    const nuvol = Buffer.byteLength(renderMapa(punts, { ...opcions, nuvol: true }), "utf8");
    const silueta = Buffer.byteLength(renderMapa(punts, opcions), "utf8");
    expect(nuvol).toBeGreaterThan(60_000);
    expect(silueta).toBeLessThan(nuvol / 20);
    expect(silueta).toBeLessThan(4_000);
  });

  it("cap dels 947 no es queda amb el núvol", () => {
    const ambNuvol = Object.keys(geometria.municipis).filter(
      (s) => !renderMapa(punts, { amplada: 300, destacat: s }).includes("mapa-silueta"),
    );
    expect(ambNuvol).toEqual([]);
  });
});
