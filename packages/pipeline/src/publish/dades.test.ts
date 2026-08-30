import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import { dataIssues, electionParticipation, municipalities, municipalityMetrics, openDb, type Db } from "@quivoto/db";
import { CAMPS_CATALUNYA, renderDadesIndex, writeDownloads } from "./dades";

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

/** Els identificadors de font que l'esquema documenta a la taula «D'on surt cada cosa». */
const fontsDocumentades = (esquema: string): Set<string> =>
  new Set([...esquema.matchAll(/^\| `([^`]+)` \| [^|]+ \| [^|]+ \| [^|]+ \| \[conjunt\]/gm)].map((m) => m[1]!));

type Indicador = { clau: string; indicador: string; valor: unknown; unitat: string; any: number | null; font: string };
type Municipi = {
  enllacos: { idescat: string | null; idescat_ibi: string | null; ine: string | null };
  ine: { citacio: string; actualitzat: string | null } | null;
  indicadors: Indicador[];
};

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
      const municipi = JSON.parse(await readFile(join(dir, "m", `${slug}.json`), "utf8")) as Municipi;
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

  it("cap columna nova sense font: tota font citada és a la taula de l'esquema", async () => {
    const fonts = fontsDocumentades(await readFile(join(dir, "ESQUEMA.md"), "utf8"));
    expect(fonts.size).toBeGreaterThan(20);
    const citades = new Set<string>();
    for (const files of municipals.values()) for (const fila of files.slice(1)) citades.add(fila[6]!);
    for (const font of citades) expect(fonts, font).toContain(font);
  });
});

/**
 * Crea la taula tal com la declara l'esquema de Drizzle, sense claus foranes ni
 * valors per defecte: en una base sembrada a mà tot el que cal hi va escrit.
 * Es genera de l'esquema i no es copia aquí perquè, si demà una taula guanya una
 * columna, la prova la tingui sense que ningú se'n recordi.
 */
async function creaTaula(db: Db, taula: PgTable): Promise<void> {
  const { name, columns } = getTableConfig(taula);
  const definicions = columns.map((c) => `"${c.name}" ${c.getSQLType()}${c.primary ? " primary key" : ""}`);
  await db.execute(sql.raw(`create table "${name}" (${definicions.join(", ")})`));
}

/**
 * Les files noves es proven sobre una base en memòria amb dos municipis
 * sembrats a mà: la base local pot no tenir totes les feines passades, i el
 * que cal comprovar aquí és exacte —quin valor, quin any, quina font i quin
 * enllaç— i no «alguna cosa hi surt».
 */
describe("les files noves, sobre una base sembrada", () => {
  let dir = "";
  let tancar: (() => Promise<void>) | null = null;
  let resum = { files: 0, municipis: 0 };
  let esquema = "";
  let abrera: Municipi;
  let clot: Municipi;
  let global: string[][] = [];

  const per = (m: Municipi, clau: string): Indicador[] => m.indicadors.filter((i) => i.clau === clau);
  const un = (m: Municipi, clau: string): Indicador | undefined => per(m, clau)[0];

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "quivoto-dades-sembra-"));
    const { db, close } = await openDb({ dir: "memory://" });
    tancar = close;
    for (const taula of [municipalities, municipalityMetrics, electionParticipation, dataIssues]) await creaTaula(db, taula);

    const [a, c] = await db
      .insert(municipalities)
      .values([
        {
          ine5: "08001", idescat6: "080018", codiEns: "0800120001", slug: "abrera", name: "Abrera",
          comarca: "Baix Llobregat", provincia: "Barcelona", population: 12_800, populationYear: 2025,
          electoralSystem: "llistes tancades", status: "published", minutesAdapter: "aoc",
        },
        {
          ine5: "17999", idescat6: "179990", codiEns: "1799920009", slug: "el-clot-de-prova", name: "El Clot de Prova",
          comarca: "Ripollès", provincia: "Girona", population: 180, populationYear: 2025,
          electoralSystem: "Llistes obertes", status: "published", minutesAdapter: "cap",
        },
      ])
      .returning({ id: municipalities.id });

    const idescat = "https://www.idescat.cat/emex/?id=080018&lang=ca";
    const metriques: { kind: string; data: unknown; municipi?: number }[] = [
      { kind: "residus", data: { darrerAny: 2023, taxaSelectiva: 41.3, kgHabAny: 512.7, serie: [] } },
      { kind: "habitatge", data: { darrerAny: 2024, preu: 812.5, serie: [] } },
      { kind: "preuAigua", data: { darrerAny: 2025, preu: { subministrament: 1.234, canon: 0.6, clavegueram: null, municipal: null, total: null } } },
      {
        kind: "rebutIbi",
        data: {
          darrerAny: 2024, rebutMitja: 543.21, publicable: true, motius: [],
          font: { nom: "IBI, taula 173", organisme: "Idescat", url: "https://www.idescat.cat/pub/?id=ibi&n=173&geo=mun:080018", llicencia: "" },
        },
      },
      {
        kind: "costGovern",
        data: {
          darrerAnyComplet: 2024,
          darrer: { any: 2024, parcial: false, sospitos: false, habitants: 12_800, regidories: 17, organs: { total: 254_336, perHabitant: 19.87, perRegidoria: null }, dietes: null, indemnitzacions: null },
          serie: [],
        },
      },
      { kind: "amb", data: { member: true, municipis: 36, materies: ["transport"] } },
      {
        kind: "continuitat",
        data: {
          partit: { anys: 12, desDeAny: 2011, legislatures: 3, aproximat: false, sigles: "PSC", familia: "psc" },
          persona: { anys: 4, nom: "Algú" },
          forcesDiferents: 3, alternances: 2, personesDiferents: 5, legislatures: 12,
          volatilitat: { serie: [], ultima: { de: 2019, a: 2023, index: 17.5, fiable: true }, mitjana: 21.4, trams: 11, tramsFiables: 9, comparacio: null },
        },
      },
      {
        kind: "votPerdut",
        data: {
          eleccions: {
            M20191: { any: 2019, total: { vots: 410, pct: 8.1 }, senseEsco: { vots: 160, pct: 3.2, candidatures: 1, mesVotada: null }, quadra: true },
            M20231: { any: 2023, total: { vots: 590, pct: 11.6 }, senseEsco: { vots: 270, pct: 5.4, candidatures: 2, mesVotada: null }, quadra: true },
          },
          darrera: "M20231", regidorsEquivalents: 1.9, variacioDesDel2019: 3.5, comparacio: null,
        },
      },
      {
        kind: "poblacio",
        data: {
          font: { enllacosMunicipi: [{ taula: "censph", titol: "El municipi en xifres", href: idescat }] },
          indicadors: [
            { clau: "padroHabitants", valor: 12_800, darrerAny: 2025, serie: [], enllac: null },
            { clau: "pctNacionalitatEstrangera", valor: 14.2, darrerAny: 2025, serie: [], enllac: { taula: "t75", titol: "Nacionalitat", href: `${idescat}#t75` } },
          ],
        },
      },
      {
        kind: "riquesa",
        data: {
          any: 2022,
          font: { ine: { taules: [
            { provincia: "08", nom: "Barcelona", taula: 30896, urlTaula: "https://www.ine.es/jaxiT3/Tabla.htm?t=30896", actualitzada: "2025-11-26" },
            { provincia: "17", nom: "Girona", taula: 31016, urlTaula: "https://www.ine.es/jaxiT3/Tabla.htm?t=31016", actualitzada: "2025-11-26" },
          ] } },
          indicadors: [
            { clau: "rendaNetaPersona", valor: 14_321, any: 2022, serie: [] },
            { clau: "rendaNetaLlar", valor: 38_002, any: 2022, serie: [] },
          ],
        },
      },
      {
        kind: "criminalitat",
        data: {
          darrerAny: 2025,
          total: {
            clau: "total",
            serie: [{ any: 2023, fets: 600 }, { any: 2025, fets: 640 }],
            perMil: [{ any: 2023, valor: 46.9 }, { any: 2025, valor: 50 }],
            canviMandat: { desDe: 2023, fins: 2025, abs: 40, pct: 6.7 },
          },
          ranquing: { posicio: 42, de: 70, any: 2025 },
        },
      },
      {
        kind: "despesaProgrames",
        data: {
          programes: [
            { codi: "151", nom: "Urbanisme", serie: [{ any: 2023 }, { any: 2024 }], darrer: { any: 2024, liquidacio: true, perHabitant: 88.4, total: 1_131_520, part: 9.1 }, mandat: { desDe: 2023, fins: 2024, inici: 78.6, final: 88.4, diferencia: 9.8, percentual: 12.5 } },
            { codi: "342", nom: "Instal·lacions esportives", serie: [], darrer: { any: 2024, liquidacio: false, perHabitant: null, total: null, part: null }, mandat: null },
          ],
        },
      },
      // El segon municipi només té un rebut d'IBI que J19 no dona per publicable.
      { municipi: c!.id, kind: "rebutIbi", data: { darrerAny: 2024, rebutMitja: 120.5, publicable: false, motius: ["revaloració"], font: { url: "https://www.idescat.cat/pub/?id=ibi&n=173&geo=mun:179990" } } },
    ];
    await db.insert(municipalityMetrics).values(
      metriques.map((m) => ({ municipalityId: m.municipi ?? a!.id, kind: m.kind, data: m.data })),
    );

    resum = await writeDownloads(db, dir);
    esquema = await readFile(join(dir, "ESQUEMA.md"), "utf8");
    abrera = JSON.parse(await readFile(join(dir, "m", "abrera.json"), "utf8")) as Municipi;
    clot = JSON.parse(await readFile(join(dir, "m", "el-clot-de-prova.json"), "utf8")) as Municipi;
    global = llegeix(await readFile(join(dir, "catalunya.csv"), "utf8"));
  }, 60_000);

  afterAll(async () => {
    await tancar?.();
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it("escriu dos fitxers per municipi més els tres comuns", async () => {
    expect(resum.municipis).toBe(2);
    expect((await readdir(join(dir, "m"))).sort()).toEqual([
      "abrera.csv", "abrera.json", "el-clot-de-prova.csv", "el-clot-de-prova.json",
    ]);
    expect(resum.files).toBe(4 + 3);
  });

  it("cada indicador nou surt amb el valor, l'any i la font que li toquen", () => {
    const esperats: Record<string, [unknown, number | null, string]> = {
      poblacio_estrangera_pct: [14.2, 2025, "censph/5992/5987"],
      renda_neta_persona: [14_321, 2022, "ADRH"],
      renda_any: [2022, null, "ADRH"],
      preu_aigua_subministrament: [1.234, 2025, "aca-preus"],
      rebut_ibi_mitja: [543.21, 2024, "ibi/173"],
      cost_govern_habitant: [19.87, 2024, "8squ-bk4r"],
      residus_selectiva_pct: [41.3, 2023, "69zu-w48s"],
      residus_kg_habitant: [512.7, 2023, "69zu-w48s"],
      lloguer_mitja: [812.5, 2024, "qww9-bvhh"],
      amb_membre: [true, null, "2r5q-tsxs"],
      alcaldia_forca_anys: [12, null, "2v2p-vu4h"],
      alcaldia_forca_des_de: [2011, null, "2v2p-vu4h"],
      alcaldia_persona_anys: [4, null, "2v2p-vu4h"],
      alcaldia_forces: [3, null, "2v2p-vu4h"],
      alcaldia_alternances: [2, null, "2v2p-vu4h"],
      volatilitat_ultima: [17.5, 2023, "3539f7e6"],
      volatilitat_mitjana: [21.4, null, "3539f7e6"],
      vot_perdut_2023_pct: [11.6, 2023, "ntc4-rnwr"],
      vot_perdut_regidories: [1.9, 2023, "ntc4-rnwr"],
      fets_penals: [640, 2025, "DatosBalanceAnt"],
      fets_penals_any: [2025, null, "DatosBalanceAnt"],
      fets_penals_per_mil: [50, 2025, "DatosBalanceAnt"],
      fets_penals_canvi_mandat_pct: [6.7, 2025, "DatosBalanceAnt"],
      fets_penals_posicio: [42, 2025, "DatosBalanceAnt"],
      fets_penals_municipis_amb_dada: [70, 2025, "DatosBalanceAnt"],
    };
    for (const [clau, [valor, any, font]] of Object.entries(esperats)) {
      const fila = un(abrera, clau);
      expect(fila, clau).toBeDefined();
      expect(fila!.valor, clau).toEqual(valor);
      expect(fila!.any, clau).toEqual(any);
      expect(fila!.font, clau).toBe(font);
    }
  });

  it("el vot perdut va una fila per convocatòria i la despesa, una per programa liquidat", () => {
    expect(per(abrera, "vot_perdut_pct").map((f) => [f.any, f.valor])).toEqual([[2019, 8.1], [2023, 11.6]]);
    expect(per(abrera, "vot_sense_esco_pct").map((f) => [f.any, f.valor])).toEqual([[2019, 3.2], [2023, 5.4]]);

    // El programa 342 no té l'exercici liquidat: no és un zero, és una fila que no hi és.
    const despesa = per(abrera, "despesa_programa");
    expect(despesa).toHaveLength(1);
    expect(despesa[0]).toMatchObject({
      indicador: "Despesa del programa (151 Urbanisme)", valor: 88.4, unitat: "€/habitant", any: 2024, font: "5b96829f",
    });
    expect(per(abrera, "despesa_programa_mandat")).toEqual([
      expect.objectContaining({ indicador: "Variació al mandat del programa (151 Urbanisme)", valor: 12.5, unitat: "%", any: 2024 }),
    ]);
  });

  it("el municipi sense dades no en té les files, i el rebut no publicable no hi surt", () => {
    for (const clau of ["rebut_ibi_mitja", "renda_neta_persona", "renda_any", "poblacio_estrangera_pct", "vot_perdut_pct", "despesa_programa", "fets_penals", "fets_penals_posicio"]) {
      expect(per(clot, clau), clau).toHaveLength(0);
    }
    // Sí que sabem que no és de l'AMB: J17 ha desat els que hi són.
    expect(un(clot, "amb_membre")?.valor).toBe(false);
  });

  it("la capçalera del JSON porta els enllaços i la citació que les llicències obliguen a mostrar", () => {
    expect(abrera.enllacos).toEqual({
      idescat: "https://www.idescat.cat/emex/?id=080018&lang=ca#t75",
      idescat_ibi: "https://www.idescat.cat/pub/?id=ibi&n=173&geo=mun:080018",
      ine: "https://www.ine.es/jaxiT3/Tabla.htm?t=30896",
    });
    expect(abrera.ine).toEqual({
      citacio: "Elaboración propia con datos extraídos del sitio web del INE: www.ine.es",
      actualitzat: "2025-11-26",
    });
    expect(clot.enllacos).toEqual({ idescat: null, idescat_ibi: null, ine: null });
    expect(clot.ine).toBeNull();
  });

  it("el fitxer global du les columnes noves i les diu igual que el del municipi", () => {
    const capcalera = global[0]!;
    expect(capcalera).toHaveLength(CAMPS_CATALUNYA);
    for (const clau of ["poblacio_estrangera_pct", "renda_neta_persona", "cost_govern_habitant", "amb_membre", "alcaldia_forca_anys", "vot_perdut_2023_pct", "fets_penals_per_mil", "fets_penals_posicio"]) {
      expect(capcalera, clau).toContain(clau);
    }
    const fila = global.find((f) => f[1] === "abrera")!;
    const cella = (clau: string): string => fila[capcalera.indexOf(clau)]!;
    expect(cella("residus_selectiva_pct")).toBe("41,3");
    expect(cella("amb_membre")).toBe("sí");
    expect(cella("renda_any")).toBe("2022");
    expect(global.find((f) => f[1] === "el-clot-de-prova")![capcalera.indexOf("amb_membre")]).toBe("no");
  });

  it("l'esquema documenta cada columna i cap columna nova va sense font", () => {
    for (const columna of global[0]!) expect(esquema, columna).toContain(`\`${columna}\``);
    const fonts = fontsDocumentades(esquema);
    for (const municipi of [abrera, clot]) {
      for (const fila of municipi.indicadors) {
        expect(esquema, fila.clau).toContain(`\`${fila.clau}\``);
        expect(fonts, `${fila.clau} → ${fila.font}`).toContain(fila.font);
      }
    }
    expect(esquema).toContain("## Com es governa");
    expect(esquema).toContain("Elaboración propia con datos extraídos del sitio web del INE");
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

  it("té un sol peu, el compartit, i enllaça les tipografies de la marca", () => {
    // Abans n'hi havia dos: una nota pròpia amb les fonts i el peu de totes
    // les pàgines, que ja les cita. La frase de les fonts viu al peu compartit.
    expect(html.match(/class="peu"/g)).toHaveLength(1);
    expect(html).toContain('<footer class="peu">');
    expect(html).toContain("assets/fonts.css");
    expect(html.indexOf("assets/fonts.css")).toBeLessThan(html.indexOf("<style>"));
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
