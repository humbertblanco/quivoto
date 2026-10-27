import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { escriuLlms, llmsFullTxt, llmsTxt, type DadesLlms } from "./llms";

const OBS = "https://quivoto.cat/observatori";

const dades = (over: Partial<DadesLlms> = {}): DadesLlms => ({
  generatedAt: "2026-10-27",
  municipis: [
    { slug: "sabadell", nom: "Sabadell", comarca: "Vallès Occidental", regidories: 27, alcaldia: "MARTA FARRÉS FALGUERAS", sigles: "PSC-CP" },
    { slug: "abrera", nom: "Abrera", comarca: "Baix Llobregat", regidories: 17, alcaldia: null, sigles: null },
    { slug: "prat-de-llobregat", nom: "el Prat [de] Llobregat", comarca: null, regidories: null, alcaldia: "Lluís Mijoler", sigles: null },
  ],
  comarques: [{ slug: "valles-occidental", nom: "Vallès Occidental" }, { slug: "bages", nom: "Bages" }],
  partits: [{ id: "psc", nom: "Partit dels Socialistes de Catalunya", sigles: "PSC" }],
  ens: [
    { tipus: "consell", slug: "bages", nom: "Consell Comarcal del Bages" },
    { tipus: "diputacio", slug: "barcelona", nom: "Diputació de Barcelona" },
  ],
  amb: true,
  trajectoria: false,
  candidatures: 2626,
  persones: 14002,
  ...over,
});

describe("llms.txt", () => {
  const txt = llmsTxt(dades());

  it("segueix la forma de la proposta: un títol, un resum en cita i seccions amb enllaços", () => {
    expect(txt.startsWith("# quivoto: Observatori municipal de Catalunya\n\n> quivoto reuneix")).toBe(true);
    expect(txt).toContain("\n## Principis editorials\n");
    expect(txt).toContain("\n## Com citar\n");
    expect(txt).toContain("\n## Optional\n");
    expect(txt).toContain(`- [Diputacions i consells comarcals](${OBS}/ens/): les 1 diputacions i els 1 consells comarcals`);
  });

  it("porta la data, els principis i com citar, amb la llicència", () => {
    expect(txt).toContain("Última publicació: 27 d'octubre del 2026.");
    expect(txt).toContain("Un buit és un buit");
    expect(txt).toContain("«quivoto, Observatori municipal, 27 d'octubre del 2026. <adreça de la fitxa>»");
    expect(txt).toContain("CC BY 4.0");
    expect(txt).toContain(`${OBS}/m/<municipi>/regidor/<persona>/ (14.002 fitxes de persona`);
    expect(txt).toContain(`- [Fitxa d'un municipi: Sabadell](${OBS}/m/sabadell/)`);
  });

  it("només anuncia les seccions que existeixen", () => {
    expect(txt).toContain(`${OBS}/amb/`);
    expect(txt).not.toContain(`${OBS}/trajectoria/`);
    expect(llmsTxt(dades({ ens: [] }))).not.toContain(`${OBS}/ens/`);
  });
});

describe("llms-full.txt", () => {
  const txt = llmsFullTxt(dades());

  it("llista cada municipi per ordre d'adreça, amb la comarca, les regidories i l'alcaldia llegible", () => {
    const linies = txt.split("\n").filter((l) => l.startsWith(`- [`) && l.includes("/m/"));
    expect(linies).toEqual([
      `- [Abrera](${OBS}/m/abrera/): Baix Llobregat · 17 regidories`,
      `- [el Prat de Llobregat](${OBS}/m/prat-de-llobregat/): alcaldia: Lluís Mijoler`,
      `- [Sabadell](${OBS}/m/sabadell/): Vallès Occidental · 27 regidories · alcaldia: Marta Farrés Falgueras (PSC-CP)`,
    ]);
    expect(txt).toContain("## Municipis (3)");
  });

  it("posa les diputacions abans que els consells, i cada ens a la seva adreça", () => {
    const dip = txt.indexOf(`(${OBS}/diputacio/barcelona/)`);
    const con = txt.indexOf(`(${OBS}/c/bages/consell/)`);
    expect(dip).toBeGreaterThan(0);
    expect(con).toBeGreaterThan(dip);
    expect(txt).toContain(`- [Partit dels Socialistes de Catalunya](${OBS}/partit/psc/): PSC`);
    expect(txt).toContain("Dades del 27 d'octubre del 2026");
  });
});

describe("escriuLlms", () => {
  it("escriu els dos fitxers a l'arrel que se li diu", async () => {
    const dir = await mkdtemp(join(tmpdir(), "llms-"));
    try {
      const mides = await escriuLlms(`${dir}/`, dades());
      expect(await readFile(join(dir, "llms.txt"), "utf8")).toBe(llmsTxt(dades()));
      expect(await readFile(join(dir, "llms-full.txt"), "utf8")).toBe(llmsFullTxt(dades()));
      expect(mides.curt).toBeGreaterThan(1000);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
