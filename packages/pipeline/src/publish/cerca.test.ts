import { describe, expect, it } from "vitest";
import {
  clauCerca,
  classifica,
  indexDeCerca,
  indexDeCercaAlcaldies,
  indexDeCercaElectes,
  qualitat,
  type Candidat,
  type DadesAlcaldies,
  type DadesElectes,
} from "./cerca";
import { cercador } from "./cercador";
import { adrecesAlcaldies, alcaldiesHistoriques, type HistorialAlcaldies } from "./alcaldia-historica";
import type { Els947Row } from "./els947";
import { slugify } from "../lib/text";
import { ensDeProva } from "./ens-prova-enllacos";

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
  ad: string | null = null,
): Els947Row => ({ s, n, c, p, a, g, ad }) as unknown as Els947Row;

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
    fila("barcelona", "Barcelona", "Barcelonès", 1_731_649, "Jaume Collboni", "PSC-CP", "regidor/jaume-collboni/"),
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
    // El camí el porta la fila dels 947, decidit per `resolAlcaldia()`: aquí
    // no es torna a calcular, només es copia a la posició del municipi.
    expect(index.alc[1]).toBe("regidor/jaume-collboni/");
    // A Alins la fila no en porta cap: el resultat ha d'anar a l'apartat
    // d'alcaldies, i no s'endevina res a partir de la llista de la seu.
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

describe("indexDeCercaAlcaldies", () => {
  /** L'historial d'Alcanar de `alcaldia-historica.test.ts`, amb la variant «i» inclosa. */
  const ALCANAR: HistorialAlcaldies = {
    history: [
      { term: "2023-2027", name: "MARIA PUIG SOLER", partyRaw: "ERC-AM", tookOfficeOn: "2024-10-05" },
      { term: "2019-2023", name: "JOAN ROIG CASTELL", partyRaw: "ERC-AM", tookOfficeOn: "2019-06-15" },
      { term: "2015-2019", name: "JOAN ROIG I CASTELL", partyRaw: "ERC-AM", tookOfficeOn: "2015-06-13" },
      { term: "2011-2015", name: "PERE VIDAL MAS", partyRaw: "CiU", tookOfficeOn: "2013-02-01" },
      { term: "2011-2015", name: "ANNA FERRER ROCA", partyRaw: "CiU", tookOfficeOn: "2011-06-11" },
      { term: "2007-2011", name: "ANNA FERRER ROCA", partyRaw: "CiU", tookOfficeOn: "2007-06-16" },
      { term: "2003-2007", name: "JOAN ROIG CASTELL", partyRaw: "ERC", tookOfficeOn: null },
    ],
    changes: [
      { term: "2023-2027", mayors: [{ name: "MARIA PUIG SOLER", tookOfficeOn: "2024-10-05" }], partyChanged: false, onlySuccessorKnown: true },
      { term: "2011-2015", mayors: [{ name: "ANNA FERRER ROCA", tookOfficeOn: "2011-06-11" }, { name: "PERE VIDAL MAS", tookOfficeOn: "2013-02-01" }], partyChanged: false },
    ],
  };
  const ALINS: HistorialAlcaldies = {
    history: [
      { term: "2023-2027", name: "JOAN PONS", partyRaw: "ERC-AM", tookOfficeOn: "2023-06-17" },
      { term: "2019-2023", name: "JOAN PONS", partyRaw: "ERC-AM", tookOfficeOn: "2019-06-15" },
    ],
    changes: [],
  };
  const RUBI: HistorialAlcaldies = {
    history: [{ term: "2023-2027", name: "JOSEP ALTRE VELL", partyRaw: "PSC-CP", tookOfficeOn: "2023-06-17" }],
    changes: [],
  };
  const files = [
    // L'alcaldia vigent amb fitxa de regidor, com a la majoria de municipis.
    fila("alcanar", "Alcanar", "Montsià", 9_500, "Maria Puig Soler", "ERC-AM", "regidor/maria-puig-soler/"),
    // Sense fitxa de regidor: la seva pàgina és la d'alcaldia.
    fila("alins", "Alins", "Pallars Sobirà", 250, "Joan Pons", "ERC-AM"),
    // L'historial i la fila dels 947 no diuen la mateixa persona.
    fila("rubi", "Rubí", "Vallès Occidental", 79_609, "Ana María Martínez", "PSC-CP", "regidor/ana-maria-martinez/"),
  ];
  const dades: DadesAlcaldies = {
    municipis: [{ id: 1, slug: "alcanar" }, { id: 2, slug: "alins" }, { id: 3, slug: "rubi" }],
    historials: [
      { municipalityId: 1, historial: ALCANAR },
      { municipalityId: 2, historial: ALINS },
      { municipalityId: 3, historial: RUBI },
    ],
    sexes: new Map([["joan roig castell", "H"], ["anna ferrer roca", "D"]]),
  };
  const index = indexDeCercaAlcaldies(files, dades);
  const roig = index.alc.find((a) => a[0] === "Joan Roig Castell")!;

  it("una persona per nom fusionat, amb el nom llegible del mandat més recent", () => {
    // «JOAN ROIG CASTELL» i «JOAN ROIG I CASTELL» són una sola fila, no dues.
    expect(index.alc.filter((a) => /roig/i.test(a[0]))).toHaveLength(1);
    expect(index.alc.map((a) => a[0]).sort()).toEqual(["Anna Ferrer Roca", "Joan Roig Castell", "Josep Altre Vell", "Pere Vidal Mas"]);
  });

  it("apunta al municipi per la seva posició a l'índex ordenat per clau", () => {
    // «alcanar» 0, «alins» 1, «rubi» 2.
    expect(roig[1]).toBe(0);
    expect(index.alc.find((a) => a[0] === "Josep Altre Vell")![1]).toBe(2);
  });

  it("escriu els anys per períodes, les sigles del mandat més recent i el càrrec segons el registre", () => {
    expect(roig[2]).toBe("2003-2007 i 2015-2023");
    expect(index.sig[roig[3]]).toBe("ERC-AM");
    expect(roig[4]).toBe(1);
    const ferrer = index.alc.find((a) => a[0] === "Anna Ferrer Roca")!;
    expect(ferrer[2]).toBe("2007-2013");
    expect(ferrer[4]).toBe(2);
    // En Pere Vidal no consta al registre: no se li endevina res.
    expect(index.alc.find((a) => a[0] === "Pere Vidal Mas")![4]).toBe(0);
  });

  it("qui hi és avui i ja surt a l'índex —amb fitxa de regidor— no s'hi repeteix", () => {
    expect(index.alc.some((a) => a[0] === "Maria Puig Soler")).toBe(false);
    expect(index.act[0]).toBeUndefined();
  });

  it("qui hi és avui sense fitxa de regidor tampoc, però deixa dit on és la seva pàgina", () => {
    expect(index.alc.some((a) => a[0] === "Joan Pons")).toBe(false);
    expect(index.act[1]).toBe("alcaldia/joan-pons/");
  });

  it("si l'historial diu una persona i la fila dels 947 una altra, la de l'historial hi entra com a vigent", () => {
    const altre = index.alc.find((a) => a[0] === "Josep Altre Vell")!;
    expect(altre[2]).toBe("des del 2023");
  });

  it("l'adreça que el navegador dedueix és la que decideix alcaldia-historica, i les excepcions es calculen", () => {
    // El guió fa «alcaldia/» + slugify(nom) + «/»; tot el que no sigui això ha
    // de ser a `exa`, calculat amb `adrecesAlcaldies()` i no escrit a mà.
    const esperades = new Map<string, string>();
    for (const { municipalityId, historial } of dades.historials) {
      const f = files.find((x) => x.s === dades.municipis.find((m) => m.id === municipalityId)!.slug)!;
      const persones = alcaldiesHistoriques(historial, { actual: { nom: f.a, adreca: f.ad ?? null } });
      for (const [, adreca] of adrecesAlcaldies(persones)) esperades.set(adreca, adreca);
    }
    index.alc.forEach((a, i) => {
      const deduida = index.exa[i] ?? `alcaldia/${slugify(a[0])}/`;
      expect(esperades.has(deduida)).toBe(true);
    });
    expect(index.exa).toEqual({});
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
    // La base ja no va escrita al guió: la porta el diàleg a «data-base» i el
    // mateix guió serveix des de la landing, on la base és absoluta.
    expect(html).toContain('data-base="/observatori/"');
    expect(html).toContain('var BASE = dialeg.getAttribute("data-base")');
    expect(html).toContain('BASE + "cerca.json"');
    expect(html).toContain('BASE + "cerca-electes.json"');
    expect(html).toContain('BASE + "cerca-alcaldies.json"');
    expect(html).not.toContain("../../cerca.json");
  });

  it("continua sent un combobox de debò i s'obre amb la barra inclinada", () => {
    expect(html).toContain('role="combobox"');
    expect(html).toContain('role="listbox"');
    expect(html).toContain('aria-activedescendant');
    expect(html).toContain('e.key === "/"');
  });
});

describe("indexDeCerca amb els ens supramunicipals", () => {
  const files947 = [fila("manresa", "Manresa", "Bages", 78_000, null, null)];

  it("sense ens, l'índex no porta ni la clau: el fitxer queda com era", () => {
    expect("ens" in indexDeCerca(files947)).toBe(false);
    expect("ens" in indexDeCerca(files947, [])).toBe(false);
  });

  it("amb ens, una fila per ens amb nom, mena, slug, habitants i municipis", () => {
    const index = indexDeCerca(files947, [
      ensDeProva({ poblacio: 180_000, municipis: Array.from({ length: 30 }, () => ({ slug: "x", nom: "X", comarca: null, poblacio: null, membres: 0 })) }),
      ensDeProva({ tipus: "diputacio", poblacio: null }),
    ]);
    expect(index.ens).toEqual([
      ["Consell Comarcal del Bages", "consell", "bages", 180_000, 30],
      // Sense població coneguda pesa 0: va al final dels empats, no s'inventa res.
      ["Diputació de Barcelona", "diputacio", "barcelona", 0, 0],
    ]);
  });

  it("qui escriu «bages» troba la comarca abans que el consell, i el consell també", () => {
    const tots = [cand("Comarca", "Bages", 180_000, 0), cand("Ens", "Consell Comarcal del Bages", 180_000, 0)];
    expect(classifica("bages", tots, 5).map((c) => c.m)).toEqual(["Comarca", "Ens"]);
  });
});
