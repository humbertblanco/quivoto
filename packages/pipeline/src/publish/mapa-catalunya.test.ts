import { describe, expect, it } from "vitest";
import { geometria, renderMapaCatalunya } from "./mapa-catalunya";
import type { Els947Row } from "./els947";

const fila = (s: string, extra: Partial<Els947Row> = {}): Els947Row => ({
  s, n: s, c: "una comarca", p: 1000, r: 11,
  a: null, g: null, w: 1, m: 0, k: 0, t: 0,
  d: 100, e: 5, f: 40, v: 1, q: 12, y: 60, o: 0,
  ...extra,
});

describe("geometria", () => {
  it("porta els 947 municipis", () => {
    expect(Object.keys(geometria.municipis)).toHaveLength(947);
  });

  it("porta la llicència i la font, que són obligatòries per publicar-la", () => {
    expect(geometria.llicencia).toBe("CC BY 4.0");
    expect(geometria.font).toMatch(/Institut Cartogràfic/);
  });

  it("cap camí no és buit: un municipi sense geometria seria un forat blanc", () => {
    for (const [slug, d] of Object.entries(geometria.municipis)) {
      expect(d.length, slug).toBeGreaterThan(10);
      expect(d.startsWith("M"), slug).toBe(true);
    }
  });

  it("Barcelona hi és i no és un forat", () => {
    // El GeoJSON de l'ICGC aplana els MultiPolygon i, sense reparar, Barcelona
    // es llegeix com un forat d'un tros de costa i desapareix del mapa.
    expect(geometria.municipis["barcelona"]).toBeDefined();
    expect(geometria.municipis["barcelona"]!.length).toBeGreaterThan(100);
  });
});

describe("renderMapaCatalunya", () => {
  const files = Object.keys(geometria.municipis).map((s) => fila(s));

  it("dibuixa un camí per municipi i tots porten a la seva fitxa", () => {
    const html = renderMapaCatalunya(files, "2026-08-29");
    expect(html.match(/<path class="g/g) ?? []).toHaveLength(947);
    expect(html).toContain('href="/observatori/m/barcelona/"');
  });

  it("marca com a «sense dada» els municipis que no tenen la xifra", () => {
    const html = renderMapaCatalunya(
      files.map((f, i) => (i < 100 ? { ...f, f: null, y: null, v: null } : f)),
      "2026-08-29",
    );
    // La primera capa és la majoria absoluta, que la tenen tots; les que falten
    // han de sortir a la cobertura de les altres capes.
    expect(html).toContain("gnd");
    expect(html).toContain("847");
  });

  it("cita la llicència i qui fa el mapa", () => {
    const html = renderMapaCatalunya(files, "2026-08-29");
    expect(html).toContain("CC BY 4.0");
    expect(html).toContain("Institut Cartogràfic");
  });

  it("avisa que un mapa de municipis sobrerepresenta el buit", () => {
    expect(renderMapaCatalunya(files, "2026-08-29")).toContain("sobrerepresenta el buit");
  });

  it("no es queda sense graons quan tots els municipis valen el mateix", () => {
    // Amb tots els valors iguals, els quantils col·lapsen: no ha de petar ni
    // deixar la llegenda amb graons que no existeixen.
    const iguals = files.map((f) => ({ ...f, f: 50, y: 50, v: 0 }));
    const html = renderMapaCatalunya(iguals, "2026-08-29");
    expect(html).toContain("<svg");
  });
});
