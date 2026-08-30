import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { openDb, type Db } from "@quivoto/db";
import { CAMPS_CATALUNYA, renderDadesIndex, writeDownloads } from "./dades";

/**
 * La descàrrega no té gaire lògica per provar en abstracte: el que pot fallar és
 * que els fitxers no s'obrin, que diguin coses diferents entre ells o que hi hagi
 * una xifra sense font. Això només es comprova generant-los de veritat, i per això
 * la prova va contra la base local sencera.
 */
describe("writeDownloads", () => {
  let dir = "";
  let resum = { files: 0, bytes: 0 };
  let base: Db | null = null;
  let tancar: (() => Promise<void>) | null = null;
  /** Els CSV de tots els municipis, ja llegits. */
  const municipals = new Map<string, string[][]>();

  /** Lector de CSV mínim, amb el mateix dialecte que escrivim. */
  const llegeix = (text: string): string[][] => {
    const net = text.startsWith("﻿") ? text.slice(1) : text;
    const files: string[][] = [];
    let fila: string[] = [];
    let cella = "";
    let dins = false;
    for (let i = 0; i < net.length; i += 1) {
      const c = net[i]!;
      if (dins) {
        if (c === '"' && net[i + 1] === '"') { cella += '"'; i += 1; }
        else if (c === '"') dins = false;
        else cella += c;
      } else if (c === '"') dins = true;
      else if (c === ";") { fila.push(cella); cella = ""; }
      else if (c === "\r" && net[i + 1] === "\n") {
        fila.push(cella); files.push(fila); fila = []; cella = ""; i += 1;
      } else cella += c;
    }
    if (cella !== "" || fila.length > 0) { fila.push(cella); files.push(fila); }
    return files;
  };

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "quivoto-dades-"));
    const { db, close } = await openDb();
    base = db;
    tancar = close;
    resum = await writeDownloads(db, dir);

    // Els 947 fitxers es llegeixen un sol cop: dues proves els miren i llegir-los
    // dues vegades és el que feia que la prova petés per temps.
    for (const nom of (await readdir(join(dir, "m"))).filter((n) => n.endsWith(".csv"))) {
      municipals.set(nom, llegeix(await readFile(join(dir, "m", nom), "utf8")));
    }
  }, 120_000);

  afterAll(async () => {
    await tancar?.();
    if (dir) await rm(dir, { recursive: true, force: true });
  });


  it("escriu dos fitxers per municipi més els quatre comuns", async () => {
    const municipals = (await readdir(join(dir, "m"))).length;
    expect(municipals % 2).toBe(0);
    expect(resum.files).toBe(municipals + 3);
    expect(resum.bytes).toBeGreaterThan(0);
  });

  it("el fitxer de tot Catalunya té una fila per municipi i cap columna descollada", async () => {
    const files = llegeix(await readFile(join(dir, "catalunya.csv"), "utf8"));
    const capcalera = files[0]!;
    expect(capcalera).toHaveLength(CAMPS_CATALUNYA);
    expect(capcalera.slice(0, 3)).toEqual(["municipi", "slug", "codi_ine"]);
    expect(files.length).toBeGreaterThan(900);
    for (const fila of files.slice(1)) expect(fila).toHaveLength(CAMPS_CATALUNYA);
  });

  it("porta el BOM d'UTF-8, punt i coma de separador i coma decimal", async () => {
    const brut = await readFile(join(dir, "catalunya.csv"), "utf8");
    expect(brut.startsWith("﻿")).toBe(true);
    expect(brut).toContain("\r\n");

    const files = llegeix(brut);
    const columna = files[0]!.indexOf("estalvi_net");
    const valors = files.slice(1).map((f) => f[columna]!).filter((v) => v !== "");
    // Si algun decimal sortís amb punt, l'Excel en català el llegiria com a milers.
    expect(valors.some((v) => v.includes(","))).toBe(true);
    expect(valors.some((v) => v.includes("."))).toBe(false);
  });

  it("cap fitxer de municipi no té una fila trencada, i totes porten font", () => {
    expect(municipals.size).toBeGreaterThan(900);
    for (const [nom, files] of municipals) {
      expect(files[0], nom).toEqual(["municipi", "codi_ine", "indicador", "valor", "unitat", "any", "font"]);
      expect(files.length, nom).toBeGreaterThan(1);
      for (const fila of files.slice(1)) {
        expect(fila, `${nom}: ${fila.join(";")}`).toHaveLength(7);
        // Cap xifra sense font ni sense nom: és la regla del projecte.
        expect(fila[2], nom).not.toBe("");
        expect(fila[3], nom).not.toBe("");
        expect(fila[6], nom).not.toBe("");
      }
    }
  }, 60_000);

  /**
   * Les etiquetes de recaptació, despesa i serveis venen de la font i les
   * traduïm a camps documentats amb una taula. Si la font n'estrena una, avui
   * desapareixeria sense dir res: això és el que ha de petar aquí i no al web.
   */
  it("no perd cap concepte que la font publiqui", async () => {
    const distintes = async (kind: string, cami: string): Promise<string[]> => {
      const resultat = await base!.execute(
        sql.raw(
          `select distinct jsonb_array_elements(data->'${cami}')->>'label' as l ` +
          `from municipality_metrics where kind = '${kind}'`,
        ),
      );
      return ((resultat as unknown as { rows: { l: string }[] }).rows ?? []).map((r) => r.l);
    };
    const etiquetes = [
      ...(await distintes("revenue", "figures")),
      ...(await distintes("spending", "areas")),
      ...(await distintes("services", "services")),
    ];
    const indicadors = new Set<string>();
    for (const files of municipals.values()) for (const fila of files.slice(1)) indicadors.add(fila[2]!);

    expect(etiquetes.length).toBeGreaterThan(15);
    for (const etiqueta of etiquetes) expect(indicadors, etiqueta).toContain(etiqueta);
  });

  it("el fitxer del municipi i el de Catalunya no es contradiuen", async () => {
    const global = JSON.parse(await readFile(join(dir, "catalunya.json"), "utf8")) as {
      dades: Record<string, unknown>[];
    };
    for (const slug of ["barcelona", "gisclareny", "esplugues-de-llobregat"]) {
      const fila = global.dades.find((d) => d.slug === slug);
      expect(fila, slug).toBeDefined();
      const municipi = JSON.parse(await readFile(join(dir, "m", `${slug}.json`), "utf8")) as {
        indicadors: { clau: string; valor: unknown }[];
      };
      for (const indicador of municipi.indicadors) {
        // La sèrie de deute porta un valor per any i al fitxer ample no hi cap.
        if (indicador.clau === "deute_habitant_serie") continue;
        if (!(indicador.clau in fila!)) continue;
        expect(fila![indicador.clau], `${slug} · ${indicador.clau}`).toEqual(indicador.valor);
      }
    }
  });

  it("l'esquema documenta cada columna del fitxer global", async () => {
    const esquema = await readFile(join(dir, "ESQUEMA.md"), "utf8");
    const capcalera = llegeix(await readFile(join(dir, "catalunya.csv"), "utf8"))[0]!;
    for (const columna of capcalera) expect(esquema, columna).toContain(`\`${columna}\``);
  });
});

describe("renderDadesIndex", () => {
  const html = renderDadesIndex("2026-08-29", { municipis: 947, camps: CAMPS_CATALUNYA });

  it("diu què hi ha, com se cita i que no és una API", () => {
    expect(html).toContain("catalunya.csv");
    expect(html).toContain("catalunya.json");
    expect(html).toContain("ESQUEMA.md");
    expect(html).toContain("Creative Commons BY 4.0");
    expect(html).toContain("no és una API");
    expect(html).toContain("2026-08-29");
  });

  it("és una pàgina autònoma i sense recursos de fora", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<html lang="ca">');
    // El que ha de ser autònom és el fitxer, no que no hi hagi cap guió: la
    // casella de cerca de la capçalera compartida en porta un, i va incrustat
    // com tot el CSS. El que no hi pot haver és res que es baixi de fora.
    expect(html).not.toMatch(/<script[^>]*\ssrc=/i);
    expect(html).not.toMatch(/https?:\/\/[^"']*\.(?:css|js)/i);
  });
});
