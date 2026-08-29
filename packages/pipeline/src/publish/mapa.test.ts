import { describe, expect, it } from "vitest";
import { alcadaPer, projecta, renderMapa, type PuntMapa } from "./mapa";

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

describe("renderMapa", () => {
  it("dibuixa un cercle per municipi", () => {
    const svg = renderMapa(extrems);
    expect((svg.match(/<circle/g) ?? []).length).toBe(4);
  });

  it("destaca el municipi demanat amb anella, i el pinta l'últim", () => {
    const svg = renderMapa(extrems, { destacat: "nord" });
    expect(svg).toContain('class="destacat"');
    // 4 punts, però el destacat surt del grup normal i s'hi afegeix amb anella.
    expect((svg.match(/<circle/g) ?? []).length).toBe(5);
    expect(svg.indexOf('class="destacat"')).toBeGreaterThan(svg.indexOf('class="punts"'));
  });

  it("no dibuixa res si no hi ha punts", () => {
    expect(renderMapa([])).toBe("");
  });

  it("porta descripció per als lectors de pantalla", () => {
    expect(renderMapa(extrems, { descripcio: "Els quatre extrems" })).toContain("Els quatre extrems");
  });
});
