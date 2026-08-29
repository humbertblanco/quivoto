import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { esActa, verifica } from "./verificacio";
import type { Conjunt } from "./llindar";

const DIR = new URL("./afirmacions/", import.meta.url).pathname;
const carrega = (fitxer: string): Conjunt =>
  JSON.parse(readFileSync(join(DIR, fitxer), "utf8")) as Conjunt;

describe("esActa", () => {
  it("reconeix una acta de l'acteca", () => {
    expect(esActa("https://media.seu-e.cat/acteca/801550006/2025/x/Acta.pdf")).toBe(true);
  });

  it("no accepta un catàleg com si fos un acord", () => {
    expect(esActa("https://dadesobertes.seu-e.cat/")).toBe(false);
    expect(esActa("https://cido.diba.cat/normativa/123")).toBe(false);
  });

  it("accepta el registre de votacions del plenari de Barcelona", () => {
    // No és una acta de l'acteca, però és el registre oficial de la institució
    // que va votar, i ve amb el vot de cada grup desglossat.
    expect(esActa("https://ajuntament.barcelona.cat/sites/default/files/votacions_plenari/votacions_plenari_mandat_actual.csv")).toBe(true);
    expect(esActa("https://ajuntament.barcelona.cat/ca/accio-de-govern/el-consell-municipal/acords-del-plenari")).toBe(true);
  });

  it("però no qualsevol pàgina de l'ajuntament de Barcelona", () => {
    expect(esActa("https://ajuntament.barcelona.cat/premsa/2026/01/01/una-nota-de-premsa/")).toBe(false);
  });

  it("no accepta la premsa", () => {
    expect(esActa("https://www.diarideterrassa.com/una-noticia")).toBe(false);
  });

  it("no accepta el nostre propi web com a evidència", () => {
    // Acreditar una xifra amb la pàgina que la publica és no acreditar-la.
    expect(esActa("https://quivoto.cat/observatori/m/terrassa/")).toBe(false);
  });

  it("no peta amb una adreça mal formada ni amb res", () => {
    expect(esActa("no és una adreça")).toBe(false);
    expect(esActa(null)).toBe(false);
  });
});

describe("verifica, sobre els conjunts reals", () => {
  const fitxers = readdirSync(DIR).filter((f) => f.endsWith(".json"));

  it("hi ha conjunts escrits", () => {
    expect(fitxers.length).toBeGreaterThan(0);
  });

  it("Terrassa no és jugable: no cita cap acta", () => {
    if (!fitxers.includes("terrassa.json")) return;
    const estat = verifica(carrega("terrassa.json"));
    expect(estat.jugable).toBe(false);
    expect(estat.ambActa).toBe(0);
  });

  it("Esplugues sí que ho és: totes les afirmacions citen una acta", () => {
    const estat = verifica(carrega("esplugues-de-llobregat.json"));
    expect(estat.jugable).toBe(true);
    expect(estat.ambActa).toBe(estat.total);
  });

  it("cap conjunt jugable no baixa del llindar", () => {
    for (const f of fitxers) {
      const estat = verifica(carrega(f));
      if (estat.jugable) expect(estat.proporcio, f).toBeGreaterThanOrEqual(0.75);
    }
  });
});
