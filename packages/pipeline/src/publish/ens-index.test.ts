import { describe, expect, it, vi } from "vitest";
import { DESCRIPCIO_MAXIMA, TITOL_MAXIM } from "./seo";
import type { DadesEns, MembreEns } from "./ens-tipus";

/**
 * `ultimaDespesa()` és d'`ens-dades.ts`, que fa les consultes a la base i té
 * les seves pròpies proves. Aquí es prova què en fa l'índex —com escriu la
 * xifra, l'any i el «provisional»—, i per això se substitueix per una versió
 * mínima que llegeix les fixtures: l'últim exercici, la suma dels capítols de
 * despesa i, si n'hi ha cap de buit, `parcial`. Així aquestes proves no
 * carreguen el client de la base de dades.
 */
vi.mock("./ens-dades", () => ({
  ultimaDespesa: (d: DadesEns) => {
    const any = d.finances?.anys.at(-1);
    if (!any) return null;
    const despeses = any.capitols.filter((c) => c.tipus === "despeses");
    if (despeses.length === 0) return null;
    const total = despeses.reduce((a, c) => a + (c.liquidat ?? 0), 0);
    return {
      any: any.any,
      total,
      perHabitant: d.poblacio ? total / d.poblacio : null,
      parcial: despeses.some((c) => c.liquidat === null),
    };
  },
}));

import {
  agrupaPerDemarcacio,
  barraComposicio,
  celaDespesa,
  celaPresidencia,
  clauTerritori,
  colorSegur,
  dadesCercador,
  dataDeLesDades,
  ensDelMunicipi,
  eurosPerHabitant,
  excepcioDe,
  filesComposicio,
  nomLlegible,
  renderEnsIndex,
  taulesDeBusca,
  textosExcepcio,
  TITOL_ENS_INDEX,
  type MunicipiIndex,
} from "./ens-index";

/**
 * Dues diputacions i tres consells de mostra. Les xifres són versemblants i no
 * són les de ningú: es prova què diu la pàgina amb unes dades, no qui presideix
 * de debò el Bages.
 */
function presidencia(canvis: Partial<MembreEns> = {}): MembreEns {
  return {
    nom: "MARIA DE LA FONT I PUIG",
    carrec: "Presidenta",
    rol: "presidencia",
    ordre: 1,
    partit: "ERC",
    partitFont: "ens",
    alcaldia: true,
    municipiFont: "registre",
    municipi: { slug: "manresa", nom: "Manresa" },
    adreca: "regidor/maria-de-la-font/",
    foto: null,
    retribucio: null,
    grup: "ERC",
    color: "#ffb232",
    ...canvis,
  };
}

function ens(canvis: Partial<DadesEns> & Pick<DadesEns, "tipus" | "slug" | "nom" | "territori">): DadesEns {
  return {
    codiEns: "0000000000",
    article: null,
    cif: null,
    gerent: null,
    municat: null,
    web: null,
    seients: 19,
    finances: {
      anys: [
        {
          any: 2024,
          capitols: [
            { tipus: "despeses", capitol: 1, nom: "Personal", liquidat: 600_000, pressupostat: null },
            { tipus: "despeses", capitol: 2, nom: "Béns i serveis", liquidat: 400_000, pressupostat: null },
            { tipus: "ingressos", capitol: 4, nom: "Transferències", liquidat: 9_000_000, pressupostat: null },
          ],
        },
      ],
      programes: null,
      deute: [],
      fonts: [{ nom: "Consorci AOC, liquidació", url: "https://dadesobertes.seu-e.cat/", llicencia: null, consultat: "2026-10-27" }],
    },
    districtes: null,
    wikidata: null,
    escut: null,
    fonts: [{ nom: "Registre d'ens locals", url: "https://analisi.transparenciacatalunya.cat/", llicencia: "CC BY 4.0", consultat: null }],
    avisos: [],
    consultat: "2026-10-27",
    seu: null,
    membres: [],
    composicio: [
      { partit: "ERC", seients: 10, color: "#ffb232" },
      { partit: "Junts", seients: 9, color: "#00c4b3" },
    ],
    presidencia: presidencia(),
    municipis: [],
    poblacio: 100_000,
    comarca: null,
    comarques: [],
    repartiment: null,
    subvencions: null,
    ...canvis,
  };
}

const DIBA = ens({ tipus: "diputacio", slug: "barcelona", nom: "Diputació de Barcelona", territori: "Barcelona", seients: 51, poblacio: 1_000_000, seu: { slug: "barcelona", nom: "Barcelona" } });
const DDGI = ens({ tipus: "diputacio", slug: "girona", nom: "Diputació de Girona", territori: "Girona", seients: 27, seu: { slug: "girona", nom: "Girona" } });
const BAGES = ens({ tipus: "consell", slug: "bages", nom: "Consell Comarcal del Bages", territori: "Bages", article: "el Bages", seu: { slug: "manresa", nom: "Manresa" }, comarca: { slug: "bages", nom: "Bages" } });
const OSONA = ens({ tipus: "consell", slug: "osona", nom: "Consell Comarcal d'Osona", territori: "Osona", seu: { slug: "vic", nom: "Vic" }, comarca: { slug: "osona", nom: "Osona" }, presidencia: null, composicio: [] });
const SELVA = ens({ tipus: "consell", slug: "selva", nom: "Consell Comarcal de la Selva", territori: "la Selva", seu: { slug: "santa-coloma-de-farners", nom: "Santa Coloma de Farners" }, comarca: { slug: "selva", nom: "Selva" }, finances: null });
const LLISTA: DadesEns[] = [SELVA, DDGI, BAGES, DIBA, OSONA];

const MUNICIPIS: MunicipiIndex[] = [
  { slug: "barcelona", nom: "Barcelona", comarca: "Barcelonès", provincia: "Barcelona" },
  { slug: "manresa", nom: "Manresa", comarca: "Bages", provincia: "Barcelona" },
  { slug: "vic", nom: "Vic", comarca: "Osona", provincia: "Barcelona" },
  { slug: "espinelves", nom: "Espinelves", comarca: "Osona", provincia: "Girona" },
  { slug: "santa-coloma-de-farners", nom: "Santa Coloma de Farners", comarca: "la Selva", provincia: "Girona" },
  { slug: "girona", nom: "Girona", comarca: "Gironès", provincia: "Girona" },
  { slug: "prats", nom: "Prats de Lluçanès", comarca: "Lluçanès", provincia: "Barcelona" },
  { slug: "vielha", nom: "Vielha e Mijaran", comarca: "Aran", provincia: "Lleida" },
];

const HTML = renderEnsIndex(LLISTA, MUNICIPIS, "2026-10-27T10:00:00Z");

/** El JSON del cercador, tal com va dins de la pàgina. */
function dadesDe(html: string): { base: string; e: { n: string; u: string }[]; m: (string | number)[][]; x: Record<string, { t: string }> } {
  const m = html.match(/<script type="application\/json" id="ensi-dades">([\s\S]*?)<\/script>/);
  if (!m) throw new Error("no hi ha dades del cercador");
  return JSON.parse(m[1]!);
}

describe("busca de territori", () => {
  it("aparella els noms sense article ni accents", () => {
    expect(clauTerritori("la Selva")).toBe(clauTerritori("Selva"));
    expect(clauTerritori("l'Alt Empordà")).toBe("alt emporda");
    expect(clauTerritori("Val d'Aran")).toBe("aran");
  });

  it("troba el consell per comarca i la diputació per província", () => {
    const taules = taulesDeBusca(LLISTA);
    const r = ensDelMunicipi(MUNICIPIS[4]!, taules);
    expect(r.consell?.slug).toBe("selva");
    expect(r.diputacio?.slug).toBe("girona");
    expect(ensDelMunicipi(MUNICIPIS[0]!, taules).consell).toBeNull();
  });

  it("reconeix les tres excepcions", () => {
    expect(excepcioDe("Barcelonès")).toBe("barcelones");
    expect(excepcioDe("Lluçanès")).toBe("llucanes");
    expect(excepcioDe("Val d'Aran")).toBe("aran");
    expect(excepcioDe("Bages")).toBeNull();
  });
});

describe("agrupació per província", () => {
  const grups = agrupaPerDemarcacio(LLISTA, MUNICIPIS);

  it("posa cada consell sota la diputació de la seva seu, en ordre alfabètic", () => {
    expect(grups.map((g) => g.diputacio?.slug)).toEqual(["barcelona", "girona"]);
    expect(grups[0]!.consells.map((c) => c.ens.slug)).toEqual(["bages", "osona"]);
    expect(grups[1]!.consells.map((c) => c.ens.slug)).toEqual(["selva"]);
  });

  it("diu quan una comarca té municipis d'una altra província", () => {
    const osona = grups[0]!.consells.find((c) => c.ens.slug === "osona")!;
    expect(osona.altresProvincies).toEqual(["Girona"]);
    expect(HTML).toContain("també té municipis de Girona");
  });
});

describe("xifres", () => {
  it("escriu els euros per habitant amb la precisió que té sentit", () => {
    expect(eurosPerHabitant(74.4)).toBe("74&nbsp;€");
    expect(eurosPerHabitant(12_345.2)).toBe("12.345&nbsp;€");
    expect(eurosPerHabitant(3.42)).toBe("3,4&nbsp;€");
    expect(eurosPerHabitant(9.96)).toBe("10&nbsp;€");
    expect(eurosPerHabitant(0.04)).toBe("menys de 0,1&nbsp;€");
    expect(eurosPerHabitant(0)).toBe("0&nbsp;€");
  });

  it("diu la despesa amb el seu any, i en veu baixa si és provisional", () => {
    expect(celaDespesa(BAGES)).toContain("10&nbsp;€");
    expect(celaDespesa(BAGES)).toContain("per habitant, 2024</span>");
    const provisional = ens({
      ...BAGES,
      finances: {
        ...BAGES.finances!,
        anys: [
          {
            any: 2025,
            capitols: [
              { tipus: "despeses", capitol: 1, nom: "Personal", liquidat: 340_000, pressupostat: null },
              { tipus: "despeses", capitol: 6, nom: "Inversions", liquidat: null, pressupostat: null },
            ],
          },
        ],
      },
    });
    expect(celaDespesa(provisional)).toContain("3,4&nbsp;€");
    expect(celaDespesa(provisional)).toContain("per habitant, 2025, provisional");
  });

  it("un buit no es converteix en zero", () => {
    expect(celaDespesa(SELVA)).toBe('<span class="ensi-buit">no consta</span>');
    expect(celaDespesa(ens({ ...BAGES, poblacio: null }))).toContain("no consta");
  });

  it("escriu els noms en majúscules en lletra normal", () => {
    expect(nomLlegible("MARIA DE LA FONT I PUIG")).toBe("Maria de la Font i Puig");
    expect(nomLlegible("JOAN D'ARQUER")).toBe("Joan d'Arquer");
    expect(nomLlegible("Anna López (Ind.)")).toBe("Anna López (Ind.)");
    expect(nomLlegible("ARIÀ PÉREZ ISIDRO (Ind.)")).toBe("Arià Pérez Isidro (Ind.)");
  });

  it("també quan la font deixa les partícules en minúscula enmig dels crits", () => {
    expect(nomLlegible("NOEMÍ TRUCHARTE i CERVERA")).toBe("Noemí Trucharte i Cervera");
    expect(nomLlegible("JOAN d'ARQUER  i  PUIG")).toBe("Joan d'Arquer i Puig");
    // Un nom ben escrit no es toca.
    expect(nomLlegible("Eloi Hernàndez i Mosella")).toBe("Eloi Hernàndez i Mosella");
    expect(nomLlegible("Eva M. Martinez Morales")).toBe("Eva M. Martinez Morales");
  });

  it("la presidència porta el nom llegible, el grup del partit i el municipi amb la preposició", () => {
    const html = celaPresidencia(
      presidencia({ nom: "NOEMÍ TRUCHARTE i CERVERA", partit: "PSC-CP", grup: "PSC", municipi: { slug: "olot", nom: "Olot" } }),
      "../",
    );
    expect(html).toContain("Noemí Trucharte i Cervera");
    expect(html).toContain("(PSC)");
    expect(html).not.toContain("PSC-CP");
    expect(html).toContain('<a href="../m/olot/">d\'Olot</a>');
    expect(celaPresidencia(presidencia({ grup: "sense partit conegut", partit: null }), "../")).not.toContain("ensi-partit");
  });
});

describe("barra de composició", () => {
  it("és una imatge amb la frase sencera", () => {
    const html = barraComposicio(BAGES);
    expect(html).toContain('role="img"');
    expect(html).toContain("Composició del ple: ERC, 10 seients; Junts, 9 seients");
    expect(html).toContain("background:#ffb232");
  });

  it("diu que no consta quan no hi ha composició, i quan és parcial", () => {
    expect(barraComposicio(OSONA)).toContain("no consta");
    expect(barraComposicio({ seients: 25, composicio: BAGES.composicio })).toContain("19 de 25 seients amb partit conegut");
  });

  it("agrupa pel grup comparable dels membres i deixa els sense partit al final", () => {
    const membre = (grup: string, color: string | null): MembreEns =>
      presidencia({ rol: "membre", partit: grup === "Comuns" ? "BComúP - C" : grup, grup, color });
    const membres = [
      ...Array.from({ length: 3 }, () => membre("Comuns", "#662483")),
      membre("Comuns", null),
      ...Array.from({ length: 5 }, () => membre("sense partit conegut", null)),
      ...Array.from({ length: 4 }, () => membre("PSC", "#d00c3c")),
    ];
    const files = filesComposicio({ composicio: [], membres });
    expect(files).toEqual([
      { partit: "Comuns", seients: 4, color: "#662483" },
      { partit: "PSC", seients: 4, color: "#d00c3c" },
      { partit: "sense partit conegut", seients: 5, color: null },
    ]);
    expect(barraComposicio({ seients: 13, composicio: [], membres })).not.toContain("BComúP");
  });

  it("la llegenda diu quatre partits i «i N més»; la frase accessible, tots", () => {
    const composicio = [
      { partit: "ERC", seients: 9, color: "#ffb232" },
      { partit: "sense partit conegut", seients: 4, color: null },
      { partit: "Junts", seients: 8, color: "#00c3b2" },
      { partit: "PSC", seients: 7, color: "#d00c3c" },
      { partit: "CAM", seients: 2, color: null },
      { partit: "ARA MONTBUI", seients: 1, color: null },
      { partit: "Vox", seients: 1, color: "#00c118" },
    ];
    const html = barraComposicio({ seients: 32, composicio });
    const llegenda = html.match(/<ul class="ensi-llegenda"[^>]*>([\s\S]*?)<\/ul>/)![1]!;
    expect(llegenda.match(/<li/g)).toHaveLength(6);
    expect(llegenda).toContain("ERC 9");
    expect(llegenda).toContain("CAM 2");
    expect(llegenda).not.toContain("Vox");
    expect(llegenda).toContain("i 2 més");
    expect(llegenda.trim().endsWith("4 sense partit conegut</li>")).toBe(true);
    expect(html).toContain("ARA MONTBUI, 1 seient; Vox, 1 seient; sense partit conegut, 4 seients");
  });

  it("no deixa passar un color que no ho és", () => {
    expect(colorSegur("red;background:url(x)")).toBeNull();
    expect(colorSegur("rgb(1,2,3)")).toBeNull();
    expect(colorSegur("#abcd")).toBeNull();
    expect(colorSegur("#ABCDEF")).toBe("#ABCDEF");
    expect(colorSegur("#abc")).toBe("#abc");
    const html = barraComposicio({ seients: 2, composicio: [{ partit: "X", seients: 2, color: "#fff;}</style>" }] });
    expect(html).not.toContain("</style>");
    expect(html).toContain("ensi-sense");
  });
});

describe("la pàgina", () => {
  it("té un títol i una descripció que caben", () => {
    const titol = HTML.match(/<title>([^<]*)<\/title>/)![1]!;
    const descripcio = HTML.match(/<meta name="description" content="([^"]*)">/)![1]!;
    expect(titol.length).toBeLessThanOrEqual(TITOL_MAXIM);
    // El nom de la cosa al davant, i la marca darrere perquè hi cap; la frase
    // de portada es queda a l'h1.
    expect(titol).toBe(`${TITOL_ENS_INDEX} · quivoto`);
    expect(titol.startsWith("Diputacions i consells comarcals")).toBe(true);
    expect(HTML).toContain("<h1>Qui governa per sobre del teu ajuntament</h1>");
    expect(descripcio.length).toBeLessThanOrEqual(DESCRIPCIO_MAXIMA);
    expect(descripcio.endsWith("…")).toBe(false);
    expect(descripcio).toContain("2 diputacions i els 3 consells");
    expect(HTML).toContain('<link rel="canonical" href="https://');
    expect(HTML).toContain("/observatori/ens/");
  });

  it("enllaça cada fitxa amb adrecaEns, des de ../", () => {
    expect(HTML).toContain('href="../diputacio/barcelona/"');
    expect(HTML).toContain('href="../diputacio/girona/"');
    expect(HTML).toContain('href="../c/bages/consell/"');
    expect(HTML).toContain('href="../c/osona/consell/"');
    expect(HTML).toContain('href="../c/selva/consell/"');
  });

  it("enllaça la persona i el seu municipi quan l'aparellament és únic", () => {
    expect(HTML).toContain('href="../m/manresa/regidor/maria-de-la-font/"');
    expect(HTML).toContain("Maria de la Font i Puig");
    expect(HTML).toContain('té l\'alcaldia <a href="../m/manresa/">de Manresa</a>');
  });

  it("agrupa els consells sota la seva diputació", () => {
    // Es busca a partir de la llista: les dades del cercador, més amunt, també porten les adreces.
    const llista = HTML.indexOf('id="ensi-llista-titol"');
    const dip = HTML.indexOf('id="ensi-barcelona"', llista);
    const ddgi = HTML.indexOf('id="ensi-girona"', llista);
    const bages = HTML.indexOf("../c/bages/consell/", llista);
    const selva = HTML.indexOf("../c/selva/consell/", llista);
    expect(dip).toBeGreaterThan(-1);
    expect(dip).toBeLessThan(bages);
    expect(bages).toBeLessThan(ddgi);
    expect(ddgi).toBeLessThan(selva);
  });

  it("explica les excepcions", () => {
    expect(HTML).toContain("Llei 1/2019");
    expect(HTML).toContain("maig del 2027");
    expect(HTML).toContain("Conselh Generau d'Aran");
    expect(HTML).toContain('href="https://www.conselharan.org/"');
    expect(HTML).toContain('href="../amb/"');
    // La comarca s'enllaça perquè surt a les dades de municipis.
    expect(HTML).toContain('href="../c/barcelones/"');
    expect(HTML).toContain('href="../c/llucanes/"');
  });

  it("diu «no consta» on no hi ha dada, i mai un zero inventat", () => {
    expect(HTML).toContain("no consta");
    expect(HTML).toContain("10&nbsp;€");
  });

  it("el cercador va just després del dibuix, abans de la llista", () => {
    const dibuix = HTML.indexOf('class="ensi-capes"');
    const cerca = HTML.indexOf('id="ensi-cerca"');
    const llista = HTML.indexOf('id="ensi-llista-titol"');
    expect(dibuix).toBeGreaterThan(-1);
    expect(dibuix).toBeLessThan(cerca);
    expect(cerca).toBeLessThan(llista);
  });

  it("cap nom de persona no surt en majúscules", () => {
    const anoia = ens({
      tipus: "consell", slug: "anoia", nom: "Consell Comarcal de l'Anoia", territori: "Anoia",
      presidencia: presidencia({ nom: "NOEMÍ TRUCHARTE i CERVERA" }),
    });
    const html = renderEnsIndex([...LLISTA, anoia], MUNICIPIS, "2026-10-27T10:00:00Z");
    expect(html).toContain("Noemí Trucharte i Cervera");
    expect(html).not.toMatch(/NOEMÍ|TRUCHARTE|MARIA DE LA FONT/);
  });

  it("cada cel·la de consell porta la seva etiqueta per a la vista estreta", () => {
    expect(HTML).toContain('data-etiqueta="Qui el presideix"');
    expect(HTML).toContain('data-etiqueta="Despesa"');
    expect(HTML).toContain('data-etiqueta="El ple"');
    expect(HTML).toContain('<table class="ensi-taula" role="table">');
  });

  it("escapa els noms", () => {
    const dolent = ens({ ...BAGES, slug: "x", territori: "<b>Bages</b>", nom: "Consell <script>alert(1)</script>" });
    const html = renderEnsIndex([DIBA, dolent], MUNICIPIS, "2026-10-27T10:00:00Z");
    expect(html).toContain("&lt;b&gt;Bages&lt;/b&gt;");
    expect(html).not.toContain("<b>Bages</b>");
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});

describe("dades del cercador", () => {
  it("són un JSON vàlid amb les adreces ja fetes", () => {
    const d = dadesDe(HTML);
    expect(d.base).toBe("../");
    const manresa = d.m.find((m) => m[1] === "manresa")!;
    expect(d.e[manresa[3] as number]!.u).toBe("../c/bages/consell/");
    expect(d.e[manresa[4] as number]!.u).toBe("../diputacio/barcelona/");
    const vic = d.m.find((m) => m[1] === "vic")!;
    const espinelves = d.m.find((m) => m[1] === "espinelves")!;
    // Mateix consell, diputació diferent: cada municipi la seva.
    expect(vic[3]).toBe(espinelves[3]);
    expect(d.e[espinelves[4] as number]!.u).toBe("../diputacio/girona/");
  });

  it("marca les excepcions i porta el text de cada una", () => {
    const d = dadesDe(HTML);
    expect(d.m.find((m) => m[1] === "barcelona")![5]).toBe("barcelones");
    expect(d.m.find((m) => m[1] === "prats")![5]).toBe("llucanes");
    expect(d.m.find((m) => m[1] === "vielha")![5]).toBe("aran");
    expect(d.x.barcelones!.t).toContain("2019");
  });

  it("un nom amb </script> no tanca l'etiqueta", () => {
    const municipis = [...MUNICIPIS, { slug: "x", nom: "</script><script>alert(1)</script>", comarca: "Bages", provincia: "Barcelona" }];
    const json = dadesCercador(LLISTA, municipis, "../");
    expect(json).not.toContain("</script>");
    expect(json).not.toContain("<");
    const html = renderEnsIndex(LLISTA, municipis, "2026-10-27T10:00:00Z");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(dadesDe(html).m.some((m) => m[0] === "</script><script>alert(1)</script>")).toBe(true);
  });

  it("distingeix dos municipis que es diuen igual per la comarca", () => {
    const municipis = [...MUNICIPIS, { slug: "vic-2", nom: "Vic", comarca: "Bages", provincia: "Barcelona" }];
    const etiquetes = JSON.parse(dadesCercador(LLISTA, municipis, "../")).m.map((m: unknown[]) => m[0]);
    expect(etiquetes).toContain("Vic (Osona)");
    expect(etiquetes).toContain("Vic (Bages)");
  });

  it("el Lluçanès diu on seuen ara els seus regidors, amb l'enllaç al consell d'Osona", () => {
    const x = textosExcepcio("../", LLISTA).llucanes;
    expect(x.t).toContain("encara no té consell comarcal propi");
    expect(x.t).toContain("regidors del 2023");
    expect(x.u).toBe("../c/osona/consell/");
    expect(x.n).toBe("Consell Comarcal d'Osona");
    // Sense el consell d'Osona a la llista, ho diu sense enllaçar cap adreça.
    const sense = textosExcepcio("../", [BAGES]).llucanes;
    expect(sense.u).toBeNull();
    expect(sense.t).toContain("Consell Comarcal d'Osona.");
    expect(dadesDe(HTML).x.llucanes!.t).toContain("Osona");
  });

  it("el cercador va amagat fins que el script el destapa", () => {
    expect(HTML).toMatch(/<section class="ensi-cerca" id="ensi-cerca" hidden/);
    expect(HTML).toContain('<label for="ensi-tria">');
    expect(HTML).toContain('aria-live="polite"');
  });
});

describe("de quan són les dades de l'índex", () => {
  it("és el dia de consulta més recent de les fitxes, no el de la publicació", () => {
    expect(dataDeLesDades([{ consultat: "2026-09-01" }, { consultat: "2026-10-27" }, { consultat: "2026-10-02" }])).toBe("2026-10-27");
    expect(HTML).toContain('"dateModified":"2026-10-27"');
    const vella = renderEnsIndex(LLISTA.map((e) => ({ ...e, consultat: "2026-09-15" })), MUNICIPIS, "2026-10-27T10:00:00Z");
    expect(vella).toContain('"dateModified":"2026-09-15"');
  });

  it("sense cap ens, cap data: el cap no se n'inventa cap", () => {
    expect(dataDeLesDades([])).toBeNull();
    expect(dataDeLesDades([{ consultat: "" }])).toBeNull();
    expect(renderEnsIndex([], MUNICIPIS, "2026-10-27T10:00:00Z")).not.toContain("dateModified");
  });
});
