import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderSourcesList, writeSourceCatalogue } from "./source-catalogue";
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

  it("documenta les fonts de les fitxes de diputacions i consells (J38 i J39)", () => {
    const delJob = (job: string) => Object.values(SOURCES).filter(source => source.jobs.includes(job)).map(source => source.id);
    expect(delJob("J38")).toEqual(expect.arrayContaining(["6nei-4b44", "nm3n-3vbj", "ehvx-5ty7", "2zbw-miu8", "81f18313", "5b96829f", "34db8dc5"]));
    expect(delJob("J39")).toEqual(["s9xt-n979"]);
  });

  it("llista cada font agrupada pel seu estat, amb la fitxa plegada", () => {
    const html = renderSourcesList();
    expect(html).toContain("Als fitxers descarregables");
    expect(html).toContain('<details class="font" id="ensLocals">');
    expect(html).toContain("Cost efectiu dels serveis");
    expect(html).toContain('<span class="publicat">Publicada</span>');
    expect(html.match(/<details class="font"/g)).toHaveLength(Object.keys(SOURCES).length);
    // Cada font és un h4 sota l'h3 del seu estat: l'ordre és publicades primer.
    expect(html.indexOf("Als fitxers descarregables")).toBeLessThan(html.indexOf("En preparació"));
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
