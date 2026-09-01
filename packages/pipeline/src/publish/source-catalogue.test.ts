import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderSourcesIndex, writeSourceCatalogue } from "./source-catalogue";
import { SOURCES } from "./source-registry";

describe("registre de fonts", () => {
  it("té identitat, procedència, llicència, període, ús i estat per a cada font", () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThanOrEqual(30);
    for (const [key, source] of Object.entries(SOURCES)) {
      expect(key).toMatch(/^[a-z][A-Za-z0-9]+$/);
      expect(source.id).not.toBe("");
      expect(source.productor).not.toBe("");
      expect(source.url).toMatch(/^https:\/\//);
      expect(source.llicencia).not.toBe("");
      expect(source.granularitat).not.toBe("");
      expect(source.periode).not.toBe("");
      expect(source.univers).not.toBe("");
      expect(source.jobs.length).toBeGreaterThan(0);
      expect(source.transformacions.length).toBeGreaterThan(0);
      expect(["publicat","nomes_fitxa","suport","experimental","retirat"]).toContain(source.estat);
    }
  });

  it("documenta tots els jobs de J1 a J30", () => {
    const jobs = new Set(Object.values(SOURCES).flatMap(source => source.jobs));
    for (let n = 1; n <= 30; n++) expect(jobs.has(`J${n}`), `falta J${n}`).toBe(true);
  });

  it("renderitza amb els components i enllaços compartits", () => {
    const html = renderSourcesIndex("2026-09-01");
    expect(html).toContain("D'on surt cada dada");
    expect(html).toContain("fonts.json");
    expect(html).toContain("manifest.json");
    expect(html).toContain("<footer class=\"peu\"");
    expect(html).toContain("Cost efectiu dels serveis");
  });
});

describe("exports de procedència", () => {
  it("genera registres i un manifest reproduïble amb SHA-256", async () => {
    const root = await mkdtemp(join(tmpdir(), "quivoto-fonts-"));
    const data = join(root, "dades");
    await mkdir(join(data, "m"), { recursive: true });
    await writeFile(join(data, "catalunya.csv"), "municipi;valor\r\nA;1\r\n");
    await writeFile(join(data, "m", "a.json"), "{}\n");
    const fields = [{ clau:"x", etiqueta:"X", unitat:"%", sourceIds:["ensLocals"] as const, derivat:false, descripcio:"Prova", abast:"municipi" as const }];

    await writeSourceCatalogue(data, "2026-09-01", fields);
    const fonts = JSON.parse(await readFile(join(data, "fonts.json"), "utf8"));
    const camps = JSON.parse(await readFile(join(data, "camps.json"), "utf8"));
    const manifest = JSON.parse(await readFile(join(data, "manifest.json"), "utf8"));

    expect(fonts.sources.length).toBe(Object.keys(SOURCES).length);
    expect(camps.fields[0].sourceIds).toEqual(["ensLocals"]);
    expect(manifest.counts.municipality_files).toBe(1);
    expect(manifest.files.find((f: {path:string}) => f.path === "catalunya.csv").sha256).toMatch(/^[a-f0-9]{64}$/);
  });
});
