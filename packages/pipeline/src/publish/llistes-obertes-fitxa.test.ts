import { describe, expect, it } from "vitest";
import { FONT, type EleccioLlistaOberta, type LlistesObertesMetric } from "../jobs/j37-llistes-obertes";
import {
  EXPLICACIO,
  adrecesDelPle,
  colorDeCandidatura,
  curiositatsLlistesObertes,
  renderLlistesObertes,
  renderLlistesObertesBloc,
  resumLlistesObertes,
  type FilaLlistesObertes,
} from "./llistes-obertes-fitxa";

/** Sant Jaume de Frontanyà el 2019, tal com J37 ho desa: sis persones, tres regidories. */
const cand = (nom: string, sigles: string, vots: number, elegit: boolean, suplent = false) => ({
  nom,
  clau: nom.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""),
  sexe: null,
  candidatura: { codi: "0", sigles, nom: `Nom de ${sigles}` },
  vots,
  elegit,
  suplent,
});
const e2019: EleccioLlistaOberta = {
  any: 2019, data: "2019-05-26", regidors: 3, nomsPerPapereta: 2, electors: 26, votants: 21, blancs: 0, nuls: 0,
  candidats: [
    cand("Manel Anselmo Amador", "CxSJF-CP", 12, true),
    cand("Nil Anselmo Serres", "CxSJF-CP", 12, true),
    cand("Lluïsa Vilalta Pérez", "SJF-AMUNT", 6, true),
    cand("Anna Rosa Sanromà Cortina", "SJF-AMUNT", 5, false),
    cand("Jordi Codina Ventura", "SJA-AM", 4, false),
    cand("Roc Carrion Roig", "SJF-AMUNT", 0, false),
  ],
};
const e2015: EleccioLlistaOberta = {
  ...e2019, any: 2015, data: "2015-05-24", electors: null, votants: null, blancs: null, nuls: null,
  candidats: [cand("Josefa Mitjanes Llordes", "CiU", 9, true, true), cand("Teodoro Ribalta Mitjanes", "PSC", 8, false)],
};
const sjf: LlistesObertesMetric = {
  font: { ...FONT, fitxers: ["https://infoelectoral.interior.gob.es/estaticos/docxl/apliextr/04201905_MUNI.zip"], consultat: "2026-09-03" },
  ine5: "08216",
  eleccions: [e2015, e2019],
};
const ple = adrecesDelPle([{ nom: "Nil Anselmo Serres" }, { nom: "Anna Rosa Sanromà Cortina" }, { nom: "Manel Anselmo Amador" }]);

describe("renderLlistesObertesBloc", () => {
  const html = renderLlistesObertesBloc(sjf, ple);

  it("no surt sense dada", () => {
    expect(renderLlistesObertesBloc(null)).toBe("");
    expect(renderLlistesObertesBloc({ ...sjf, eleccions: [] })).toBe("");
    expect(renderLlistesObertes(null)).toBe("");
  });

  it("explica el sistema i diu des de quan hi vota llistes si ja no és oberta", () => {
    expect(html).toContain(EXPLICACIO.slice(0, 60));
    expect(html).toContain("La darrera elecció amb dades aquí és la del 2019; les del 2023 encara no hi són");
    expect(html).toContain("s'elegien 3 regidories entre 6 persones; cada elector podia escriure fins a dos noms. Van votar 21 dels 26 electors.");
  });

  it("fa la taula de la darrera elecció amb enllaç només a qui és avui al ple", () => {
    expect(html).toContain('<a href="regidor/nil-anselmo-serres/">Nil Anselmo Serres</a>');
    expect(html).toContain('<a href="regidor/anna-rosa-sanroma-cortina/">Anna Rosa Sanromà Cortina</a>');
    expect(html).not.toContain('<a href="regidor/lluisa-vilalta-perez/">');
    expect(html).toContain("Lluïsa Vilalta Pérez");
    expect(html).toContain('<tr class="llo-elegit">');
    expect(html).toContain('<tr class="llo-no">');
    expect((html.match(/<td class="llo-si">sí<\/td>/g) ?? []).length).toBe(4);
  });

  it("pinta el color de la família de la candidatura", () => {
    expect(colorDeCandidatura("SJF-AMUNT")).toBe("#ffff00");
    expect(colorDeCandidatura("CxSJF-CP")).toBe("#d00c3c");
    expect(colorDeCandidatura("")).toBeNull();
    expect(html).toContain('style="background:#ffff00"');
  });

  it("plega les anteriors, marca els suplents i cita la font", () => {
    expect(html).toContain("<h3 class=\"llo-titol\">Les anteriors</h3>");
    expect(html).toContain("<summary>2015 · 3 regidories, 2 persones</summary>");
    expect(html).toContain('<span class="llo-suplent">suplent</span>');
    expect(html).toContain("Ministeri de l&#39;Interior".replace("&#39;", "'"));
    expect(html).toContain("municipals 2015-2019, consultats el 2026-09-03");
    expect(html).not.toMatch(/class="(marca|xifres|cara|crida)"/);
  });

  it("en consell obert ho diu amb una sola persona", () => {
    const co: LlistesObertesMetric = { ...sjf, eleccions: [{ ...e2019, regidors: 1, nomsPerPapereta: 1, candidats: [cand("Joan Tor Tomas", "ERC-AM", 20, true)] }] };
    const bloc = renderLlistesObertesBloc(co);
    expect(bloc).toContain("s'elegia una sola persona, l'alcaldia: el municipi funciona en consell obert entre 1 persona; cada elector podia escriure un sol nom.");
    expect(renderLlistesObertes(co)).toContain('<section class="bloc" id="llistes-obertes">');
  });
});

describe("adrecesDelPle", () => {
  it("dona l'adreça de regidor per clau de nom i no enllaça els noms repetits", () => {
    const adreces = adrecesDelPle([{ nom: "Joan Tor Tomas" }, { nom: "JOAN TOR TOMAS" }, { nom: "Maria Puig i Roca" }]);
    expect(adreces.get("joan tor tomas")).toBeUndefined();
    expect(adreces.get("maria puig roca")).toBe("regidor/maria-puig-i-roca/");
  });
});

describe("resumLlistesObertes i curiositats", () => {
  const resum = resumLlistesObertes(sjf, ple)!;

  it("resumeix la darrera elecció: qui va entrar amb menys vots, el més votat i el marge", () => {
    expect(resum).toEqual({
      any: 2019, regidors: 3, persones: 6, eleccions: 2,
      min: { nom: "Lluïsa Vilalta Pérez", vots: 6, href: null },
      max: { nom: "Manel Anselmo Amador", vots: 12, href: "regidor/manel-anselmo-amador/" },
      marge: 1,
    });
    expect(resumLlistesObertes(null)).toBeNull();
  });

  const fila = (s: string, p: number, lo: FilaLlistesObertes["lo"]): FilaLlistesObertes => ({ s, n: s, c: "Berguedà", p, lo });
  const files: FilaLlistesObertes[] = [
    fila("Sant Jaume de Frontanyà", 25, resum),
    fila("Gisclareny", 28, { any: 2019, regidors: 1, persones: 1, eleccions: 12, min: { nom: "Joan Tor Tomas", vots: 20, href: "regidor/joan-tor-tomas/" }, max: { nom: "Joan Tor Tomas", vots: 20, href: "regidor/joan-tor-tomas/" }, marge: null }),
    fila("Vell", 120, { any: 2011, regidors: 5, persones: 7, eleccions: 9, min: { nom: "Algú", vots: 30, href: null }, max: { nom: "Algú", vots: 60, href: null }, marge: 0 }),
    fila("Barcelona", 1_600_000, null),
  ];
  const fets = curiositatsLlistesObertes(files);

  it("mira només l'any més freqüent i compta sobre quants", () => {
    expect(fets.map((f) => f.id)).toEqual(["voten-persones", "elegit-menys-vots", "mes-votat-llista-oberta", "regidoria-per-un-vot"]);
    for (const f of fets) {
      expect(f.periode).toBe("2019");
      expect(f.cobertura).toContain("de 2 municipis dels 4");
    }
    expect(fets[0]!.llistes[0]!.files.map((f) => f.municipi.n)).toEqual(["Gisclareny", "Sant Jaume de Frontanyà"]);
  });

  it("no escriu cap nom sense fitxa: sense enllaç, només el municipi", () => {
    const menys = fets[1]!.llistes[0]!.files;
    expect(menys[0]).toEqual({ municipi: { s: "Sant Jaume de Frontanyà", n: "Sant Jaume de Frontanyà", c: "Berguedà" }, valor: "6 vots", detall: "6 persones per 3 regidories · 25 habitants" });
    expect(menys[1]!.persona).toEqual({ nom: "Joan Tor Tomas", href: "../m/Gisclareny/regidor/joan-tor-tomas/" });
    const mes = fets[2]!.llistes[0]!.files;
    expect(mes[0]!.persona).toEqual({ nom: "Joan Tor Tomas", href: "../m/Gisclareny/regidor/joan-tor-tomas/" });
    expect(mes[1]!.persona).toEqual({ nom: "Manel Anselmo Amador", href: "../m/Sant Jaume de Frontanyà/regidor/manel-anselmo-amador/" });
    expect(fets[3]!.llistes[0]!.files).toHaveLength(1);
    expect(fets[3]!.llistes[0]!.files[0]!.valor).toBe("per un vot");
    expect(fets[3]!.llistes[0]!.files[0]!.persona).toBeUndefined();
  });

  it("sense cap fila amb dada no diu res", () => {
    expect(curiositatsLlistesObertes([fila("Barcelona", 1, null)])).toEqual([]);
  });
});
