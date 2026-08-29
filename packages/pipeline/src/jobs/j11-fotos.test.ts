import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCarrecs } from "../adapters/seue";
import { camiPublic, cobertura, fitxaCarrecs } from "./j11-fotos";

const html = readFileSync(
  join(__dirname, "..", "adapters", "__fixtures__", "carrecs-electes.html"),
  "utf8",
);

describe("cobertura", () => {
  /**
   * És l'única cosa que la fitxa mira per decidir si ensenya les cares: mig
   * consistori amb foto i mig amb silueta buida assenyala qui no en té.
   */
  it("distingeix els tres casos que la fitxa necessita", () => {
    expect(cobertura(17, 17)).toBe("completa");
    expect(cobertura(17, 15)).toBe("parcial");
    expect(cobertura(17, 0)).toBe("cap");
  });

  it("un municipi sense càrrecs no té cobertura", () => {
    expect(cobertura(0, 0)).toBe("cap");
  });
});

describe("fitxaCarrecs", () => {
  const carrecs = parseCarrecs(html);
  const totes = new Set(carrecs.flatMap((c) => (c.fotoId === null ? [] : [c.fotoId])));

  it("desa la font, l'enllaç i la data: cap dada sense procedència", () => {
    const f = fitxaCarrecs("girona", carrecs, totes, "2026-08-29");
    expect(f.font).toContain("seu-e.cat");
    expect(f.url).toBe(
      "https://seu-e.cat/ca/web/girona/govern-obert-i-transparencia" +
        "/informacio-institucional-i-organitzativa/organitzacio-politica-i-retribucions" +
        "/carrecs-electes",
    );
    expect(f.descarregat).toBe("2026-08-29");
  });

  it("compta com a parcial el consistori on algú no té foto", () => {
    // Al fixture hi ha 4 càrrecs i només 3 tenen fotografia.
    const f = fitxaCarrecs("girona", carrecs, totes, "2026-08-29");
    expect(f.totalCarrecs).toBe(4);
    expect(f.ambFoto).toBe(3);
    expect(f.cobertura).toBe("parcial");
  });

  /**
   * Que seu-e anunciï una foto no vol dir que se n'hagi pogut fer la miniatura:
   * n'hi ha de massa petites i n'hi ha que responen buides. Si el camí es desés
   * a partir del `fotoId`, la fitxa acabaria amb imatges trencades.
   */
  it("només posa el camí de les miniatures que existeixen de veritat", () => {
    const nomesUna = new Set([25009]);
    const f = fitxaCarrecs("girona", carrecs, nomesUna, "2026-08-29");
    expect(f.carrecs[0]!.foto).toBe("/observatori/fotos/320/25009.webp");
    expect(f.carrecs[0]!.fotoPetita).toBe("/observatori/fotos/160/25009.webp");
    expect(f.carrecs[1]!.fotoId).toBe(25105);
    expect(f.carrecs[1]!.foto).toBeNull();
    expect(f.carrecs[1]!.fotoPetita).toBeNull();
    expect(f.ambFoto).toBe(1);
  });

  it("qui no té foto la té a null, no un camí inventat", () => {
    const f = fitxaCarrecs("corberadellobregat", carrecs, totes, "2026-08-29");
    expect(f.carrecs[3]!.fotoId).toBeNull();
    expect(f.carrecs[3]!.foto).toBeNull();
  });

  it("conserva nom, càrrec, grup i equip de govern", () => {
    const f = fitxaCarrecs("girona", carrecs, totes, "2026-08-29");
    expect(f.carrecs[0]).toMatchObject({
      nom: "Lluc Salellas i Vilar",
      carrec: "Alcalde",
      grup: "Guanyem Girona (GGI - AMUNT)",
      equipGovern: true,
    });
  });

  it("guarda l'enllaç a la fitxa de seu-e per poder anar a la font", () => {
    const f = fitxaCarrecs("girona", carrecs, totes, "2026-08-29");
    expect(f.carrecs[0]!.fitxa).toContain("veureCarrec/25009");
    expect(f.carrecs[0]!.fitxa).not.toContain("p_auth");
  });
});

describe("camiPublic", () => {
  it("separa les dues mides, que conviuen amb el mateix id", () => {
    expect(camiPublic(160, 25009)).toBe("/observatori/fotos/160/25009.webp");
    expect(camiPublic(320, 25009)).toBe("/observatori/fotos/320/25009.webp");
  });
});
