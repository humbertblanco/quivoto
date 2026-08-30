import { describe, expect, it } from "vitest";
import {
  clauCerca,
  classifica,
  indexDeCerca,
  indexDeCercaElectes,
  qualitat,
  type Candidat,
  type DadesElectes,
} from "./cerca";
import { cercador } from "./cercador";
import type { Els947Row } from "./els947";

/**
 * El cercador ha de trobar el poble escrivint-lo com l'escriu la gent: sense
 * accents, sense l'article i sense saber com el desa la Generalitat. I des que
 * hi ha 4.807 fitxes de persona i 2.626 de candidatura, també ha de trobar la
 * gent —normalment pel cognom, que és el que s'escriu— sense que dues-centes
 * persones que es diuen Martí tapin el municipi que es diu igual.
 */
const fila = (
  s: string,
  n: string,
  c = "Barcelonès",
  p = 1000,
  a: string | null = null,
  g: string | null = null,
): Els947Row => ({ s, n, c, p, a, g }) as unknown as Els947Row;

/** Un candidat ja aplanat, com el que munta el guió del navegador. */
const cand = (m: Candidat["m"], t: string, w: number, i = 0): Candidat =>
  ({ m, k: clauCerca(t), t, w, i });

describe("clauCerca", () => {
  it("treu els accents, que és com s'escriu de pressa", () => {
    expect(clauCerca("Rubí")).toBe("rubi");
    expect(clauCerca("Sant Adrià de Besòs")).toBe("sant adria de besos");
  });

  it("treu l'article inicial, que la gent no escriu", () => {
    expect(clauCerca("l'Hospitalet de Llobregat")).toBe("hospitalet de llobregat");
    expect(clauCerca("la Seu d'Urgell")).toBe("seu d urgell");
    expect(clauCerca("els Prats de Rei")).toBe("prats de rei");
  });

  it("no es menja un article que forma part del nom", () => {
    // «Les Borges» sí que en porta; «Lleida» no comença per article.
    expect(clauCerca("Lleida")).toBe("lleida");
    expect(clauCerca("Manresa")).toBe("manresa");
  });
});

describe("qualitat", () => {
  it("distingeix començar, començar una paraula i ser-hi a dins", () => {
    expect(qualitat("barcelona", "bar")).toBe(3);
    expect(qualitat("anna barbera", "bar")).toBe(2);
    expect(qualitat("jordi abarca sol", "bar")).toBe(1);
    expect(qualitat("girona", "bar")).toBe(0);
  });

  it("el guionet també separa paraules, o «ERC-AM» no es trobaria per «am»", () => {
    expect(qualitat("erc-am", "am")).toBe(2);
  });

  it("no es queda amb la primera coincidència dolenta", () => {
    // «abarca» hi és abans que «Barberà», i si la funció s'aturés a la primera
    // el cognom baixaria a qualitat 1 i quedaria per sota d'un municipi.
    expect(qualitat("jordi abarca barbera", "bar")).toBe(2);
  });
});

describe("classifica", () => {
  it("«sant» torna Sant Cugat abans que ningú que es digui Sant", () => {
    const tots = [
      cand("Regidor", "Santiago Vila Prats", 1_731_649, 0),
      cand("Municipi", "Sant Cugat del Vallès", 93_000, 1),
      cand("Regidor", "Jordi Sant Pujol", 1_731_649, 2),
    ];
    const ordre = classifica("sant", tots, 12).map((c) => c.t);
    // El municipi va primer tot i ser vint vegades més petit que Barcelona:
    // la mena desempata, però mai passa per davant d'una coincidència millor.
    expect(ordre[0]).toBe("Sant Cugat del Vallès");
    expect(ordre[1]).toBe("Santiago Vila Prats");
    expect(ordre[2]).toBe("Jordi Sant Pujol");
  });

  it("un cognom lliga, i lliga més fort que una lletra enmig d'un mot", () => {
    const tots = [
      cand("Municipi", "Barcelona", 1_731_649, 0),
      cand("Regidor", "Jordi Abarca Sol", 1_731_649, 1),
      cand("Regidor", "Anna Barberà Puig", 1_000, 2),
    ];
    const ordre = classifica("bar", tots, 12).map((c) => c.t);
    expect(ordre).toEqual(["Barcelona", "Anna Barberà Puig", "Jordi Abarca Sol"]);
  });

  it("qui es diu Riera al mig del nom es troba escrivint només el cognom", () => {
    const tots = [cand("Regidor", "Marta Riera Rovira", 79_609, 0)];
    expect(classifica("riera", tots, 12).map((c) => c.t)).toEqual(["Marta Riera Rovira"]);
    expect(classifica("rovira", tots, 12).map((c) => c.t)).toEqual(["Marta Riera Rovira"]);
  });

  it("l'empat el trenca la població, que és l'única cosa que decideix amb «marti»", () => {
    const tots = [
      cand("Regidor", "Anna Martí Vila", 250, 0),
      cand("Regidor", "Marta Martí Coll", 1_731_649, 1),
      cand("Regidor", "Pau Martí Serra", 79_609, 2),
    ];
    // Els tres tenen la mateixa puntuació: mateixa qualitat i mateixa mena.
    expect(classifica("marti", tots, 12).map((c) => c.t)).toEqual([
      "Marta Martí Coll",
      "Pau Martí Serra",
      "Anna Martí Vila",
    ]);
  });

  it("i quan també empata la població, l'ordre alfabètic", () => {
    const tots = [
      cand("Regidor", "Pau Martí Serra", 1_000, 0),
      cand("Regidor", "Albert Martí Puig", 1_000, 1),
    ];
    expect(classifica("marti", tots, 12).map((c) => c.t)).toEqual([
      "Albert Martí Puig",
      "Pau Martí Serra",
    ]);
  });

  it("un partit que hi entra amb dues claus no surt dues vegades", () => {
    // ERC hi és pel nom sencer i per la sigla curta, perquè «Esquerra
    // Republicana de Catalunya» no conté «erc» enlloc.
    const tots: Candidat[] = [
      { m: "Partit", k: "esquerra republicana de catalunya", t: "Esquerra Republicana de Catalunya", w: 900_000, i: 0 },
      { m: "Partit", k: "erc", t: "Esquerra Republicana de Catalunya", w: 900_000, i: 0 },
    ];
    expect(classifica("erc", tots, 12)).toHaveLength(1);
  });

  it("no en torna més dels que caben a la llista", () => {
    const tots = Array.from({ length: 40 }, (_, i) => cand("Regidor", `Martí Puig ${i}`, i, i));
    expect(classifica("marti", tots, 12)).toHaveLength(12);
  });
});

describe("indexDeCerca", () => {
  const index = indexDeCerca([
    fila("rubi", "Rubí", "Vallès Occidental", 79_609, "Ana María Martínez", "PSC-CP"),
    fila("barcelona", "Barcelona", "Barcelonès", 1_731_649, "Jaume Collboni", "PSC-CP"),
    fila("hospitalet-de-llobregat", "l'Hospitalet de Llobregat", "Barcelonès", 281_231, null, null),
  ]);

  it("porta el que cal per triar i res més", () => {
    expect(Object.keys(index.mun[0]!).sort()).toEqual(["a", "c", "g", "h", "k", "n", "s"]);
  });

  it("ve ordenat per la clau, no pel nom amb article", () => {
    expect(index.mun.map((f) => f.s)).toEqual(["barcelona", "hospitalet-de-llobregat", "rubi"]);
  });

  it("desa el nom sencer per ensenyar-lo i la clau per buscar-hi", () => {
    const hospi = index.mun.find((f) => f.s === "hospitalet-de-llobregat")!;
    expect(hospi.n).toBe("l'Hospitalet de Llobregat");
    expect(hospi.k).toBe("hospitalet de llobregat");
  });

  it("porta l'alcaldia plegada dins la fila del municipi", () => {
    const bcn = index.mun.find((f) => f.s === "barcelona")!;
    expect(bcn.a).toBe("Jaume Collboni");
    expect(index.sig[bcn.g!]).toBe("PSC-CP");
  });

  it("les sigles van a un diccionari: «PSC-CP» s'escriu una vegada, no set-centes", () => {
    expect(index.sig).toEqual(["PSC-CP"]);
  });

  it("un municipi sense alcaldia coneguda no s'inventa res", () => {
    const hospi = index.mun.find((f) => f.s === "hospitalet-de-llobregat")!;
    expect(hospi.a).toBeNull();
    expect(hospi.g).toBeNull();
  });

  it("els partits es compten per alcaldies i les llistes locals no hi surten", () => {
    const psc = index.par.find((p) => p[1] === "psc");
    expect(psc).toBeDefined();
    expect(psc![2]).toBe(2);
    // Rubí i Barcelona: el pes és la gent que governa, no les alcaldies.
    expect(psc![3]).toBe(79_609 + 1_731_649);
    expect(index.par.some((p) => p[1] === "local")).toBe(false);
  });
});

describe("indexDeCercaElectes", () => {
  const files = [
    fila("barcelona", "Barcelona", "Barcelonès", 1_731_649, "Jaume Collboni", "PSC-CP"),
    fila("alins", "Alins", "Pallars Sobirà", 250, "Joan Pons", "ERC-AM"),
  ];
  const dades: DadesElectes = {
    municipis: [
      { id: 1, slug: "barcelona" },
      { id: 2, slug: "alins" },
    ],
    carrecs: [
      {
        municipalityId: 1,
        carrecs: [{ nom: "Jaume Collboni" }, { nom: "Anna Riera" }, { nom: "Anna Riera" }],
      },
      { municipalityId: 2, carrecs: [{ nom: "Marta Sol" }] },
    ],
    mandats: [
      { municipalityId: 1, nom: "Jaume Collboni", sigles: "PSC-CP" },
      { municipalityId: 1, nom: "Anna Riera", sigles: "ERC-AM" },
      { municipalityId: 1, nom: "Anna Riera", sigles: "Junts" },
      { municipalityId: 2, nom: "Marta Sol", sigles: "ERC-AM" },
    ],
    llistes: [
      { municipalityId: 1, sigles: "PSC-CP", seats: 10, votes: 100 },
      { municipalityId: 1, sigles: "ERC-AM", seats: 5, votes: 90 },
      { municipalityId: 1, sigles: "Cap", seats: 0, votes: 3 },
      { municipalityId: 2, sigles: "+", seats: 3, votes: 40 },
    ],
  };
  const index = indexDeCercaElectes(files, dades);

  it("apunta al municipi per la seva posició a l'índex, que va ordenat per clau", () => {
    // «alins» va abans que «barcelona»: si això es calculés a part, cada regidor
    // sortiria amb el poble del veí.
    const collboni = index.reg.find((r) => r[0] === "Jaume Collboni")!;
    expect(collboni[1]).toBe(1);
    expect(index.reg.find((r) => r[0] === "Marta Sol")![1]).toBe(0);
  });

  it("posa les sigles de qui les té clares", () => {
    const collboni = index.reg.find((r) => r[0] === "Jaume Collboni")!;
    expect(index.sig[collboni[2]]).toBe("PSC-CP");
  });

  it("i no en posa cap a qui surt amb dues sigles diferents", () => {
    // L'Anna Riera hi consta amb ERC i amb Junts: al costat d'un nom, unes
    // sigles que no li toquen són pitjor que cap sigla.
    for (const r of index.reg.filter((f) => f[0] === "Anna Riera")) expect(r[2]).toBe(-1);
  });

  it("desa el slug només quan no és el que el navegador en deduiria", () => {
    // Dues Anna Riera al mateix ple: la segona viu a «anna-riera-2», i sense
    // aquesta excepció l'enllaç aniria a la fitxa de l'altra persona.
    expect(Object.values(index.exr)).toEqual(["anna-riera-2"]);
    const segona = Number(Object.keys(index.exr)[0]);
    expect(index.reg[segona]![0]).toBe("Anna Riera");
  });

  it("l'alcaldia amb fitxa pròpia hi va; la que no en té, no s'inventa", () => {
    expect(index.alc[1]).toBe("jaume-collboni");
    // A Alins l'alcalde és en Joan Pons i la seu electrònica només publica la
    // Marta Sol: sense fitxa, el resultat ha d'anar a l'apartat d'alcaldies.
    expect(index.alc[0]).toBeUndefined();
  });

  it("només hi entren les candidatures que van treure representació", () => {
    expect(index.cand).toHaveLength(3);
    expect(index.cand.map((c) => index.sig[c[0]])).toEqual(["PSC-CP", "ERC-AM", "+"]);
  });

  it("i unes sigles que no deixen cap lletra tenen el seu slug escrit", () => {
    const i = index.cand.findIndex((c) => index.sig[c[0]] === "+");
    expect(index.exc[i]).toBe("llista-1");
  });
});

describe("el guió del navegador", () => {
  const html = cercador("/observatori/");

  it("hi serialitza les funcions de debò i no una còpia", () => {
    expect(html).toContain("function clauCerca");
    expect(html).toContain("function normalize");
    expect(html).toContain("function slugify");
    expect(html).toContain("function classifica");
    expect(html).toContain("function qualitat");
  });

  it("«slugify» hi crida «normalize» pel seu nom, que és el que fa que funcioni", () => {
    // Si algun dia el transpilador reanomenés la funció, l'enllaç de cada
    // regidor petaria al navegador i aquí no ho notaria ningú.
    expect(html).toMatch(/var slugify = function slugify\([^)]*\) \{[\s\S]*normalize\(/);
  });

  it("tots els camins surten de «base» i cap no està escrit a mà", () => {
    expect(html).toContain('var BASE = "/observatori/"');
    expect(html).toContain('BASE + "cerca.json"');
    expect(html).toContain('BASE + "cerca-electes.json"');
    expect(html).not.toContain("../../cerca.json");
  });

  it("continua sent un combobox de debò i s'obre amb la barra inclinada", () => {
    expect(html).toContain('role="combobox"');
    expect(html).toContain('role="listbox"');
    expect(html).toContain('aria-activedescendant');
    expect(html).toContain('e.key === "/"');
  });
});
