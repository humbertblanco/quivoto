import { describe, expect, it } from "vitest";
import {
  CURIOSITATS_CSS, DADES_BUIDES, hrefAlcaldia, mandatsSeguits, preparaCuriositats, primers, renderCuriositats,
  respostaCuriositat, targetaCuriositat,
  type DadesCuriositats, type FilaCuriositat, type PasAlcaldia,
} from "./curiositats";

/**
 * Dotze pobles inventats. Les xifres són versemblants i no són de ningú: aquí
 * es prova què diu cada curiositat amb unes dades, no qui mana a cap poble.
 */
const MANDATS = ["1979-1983", "1983-1987", "1987-1991", "1991-1995", "1995-1999", "1999-2003", "2003-2007", "2007-2011", "2011-2015", "2015-2019", "2019-2023", "2023-2027"];

const files = (): FilaCuriositat[] => [
  { s: "vilagran", n: "Vilagran", c: "Alt Camp", p: 120_000, r: 27, a: "Marta Puig Roca", ad: "regidor/marta-puig-roca/", f: 48, sa: 84_000 },
  { s: "riubaix", n: "Riubaix", c: "Alt Camp", p: 8_000, r: 13, a: "JOAN SERRA VILA", ad: "regidor/joan-serra-vila/", f: 31, sa: 42_000 },
  { s: "pontnou", n: "Pontnou", c: "Baix Camp", p: 3_000, r: 11, a: "Pere Coll Mas", ad: null, f: 0, sa: null },
  { s: "santa-oliva-del-mont", n: "Santa Oliva del Mont", c: "Baix Camp", p: 900, r: 7, a: "Anna Font Gil", ad: "regidor/anna-font-gil/", f: 100, sa: null },
  { s: "alp", n: "Alp", c: "Cerdanya", p: 60, r: 3, a: "Jordi Pons Bou", ad: null, f: null, sa: null },
  { s: "bot", n: "Bot", c: "Terra Alta", p: 90, r: 3, a: "Rosa Vidal Sala", ad: null, f: null, sa: 12_000 },
  { s: "das", n: "Das", c: "Cerdanya", p: 200, r: 5, a: "Lluc Riu Pau", ad: null, f: 100, sa: null },
  { s: "ger", n: "Ger", c: "Cerdanya", p: 400, r: 7, a: "Eva Moll Ros", ad: null, f: 0, sa: null },
  { s: "vall-de-sant-esteve-de-les-roques", n: "Vall de Sant Esteve de les Roques", c: "Pallars", p: 1_500, r: 9, a: "Pau Roig Prat", ad: "regidor/pau-roig-prat/", f: 44, sa: 30_000 },
  { s: "marfull", n: "Marfull", c: "Pallars", p: 20_000, r: 21, a: "Núria Sol Camps", ad: "regidor/nuria-sol-camps/", f: 52, sa: 60_000 },
  { s: "colldarnes", n: "Colldarnes", c: "Pallars", p: 2_500, r: 11, a: "Marc Rius Bosch", ad: null, f: 27, sa: null },
  { s: "torrelluna", n: "Torrelluna", c: "Baix Camp", p: 5_000, r: 13, a: "Laia Prat Serra", ad: "regidor/laia-prat-serra/", f: 38, sa: 35_000 },
];

/** Una alcaldia que ha estat al càrrec en tots els mandats de la llista. */
const seguits = (nom: string, mandats: readonly string[]): PasAlcaldia[] =>
  mandats.map((m) => ({ mandat: m, nom, possessio: `${m.slice(0, 4)}-06-17` }));

const dades = (): DadesCuriositats => ({
  alcaldies: {
    // Marta Puig mana des del 1983: deu mandats seguits, però no des del principi.
    vilagran: [...seguits("PERE VELL", ["1979-1983"]), ...seguits("Marta Puig Roca", MANDATS.slice(1))],
    // Riubaix: la mateixa persona des del 1979, els dotze mandats.
    riubaix: seguits("Joan Serra Vila", MANDATS),
    // Pontnou: tres persones i un relleu a mig mandat el 2023.
    pontnou: [
      ...seguits("Antoni Gras", MANDATS.slice(0, 6)),
      ...seguits("Carme Nin", MANDATS.slice(6, 11)),
      { mandat: "2023-2027", nom: "Carme Nin", possessio: "2023-06-17" },
      { mandat: "2023-2027", nom: "Pere Coll Mas", possessio: "2025-01-10" },
    ],
    // Santa Oliva: la mateixa persona, però amb un mandat que falta al registre.
    "santa-oliva-del-mont": seguits("Anna Font Gil", MANDATS.filter((m) => m !== "2011-2015")),
    // Alp: només té l'últim mandat.
    alp: seguits("Jordi Pons Bou", ["2023-2027"]),
    // Ger: cap fila del mandat en curs: no s'hi pot dir qui mana.
    ger: seguits("Eva Moll Ros", MANDATS.slice(0, 11)),
    // Marfull: molts alcaldes diferents.
    marfull: MANDATS.map((m, i) => ({ mandat: m, nom: `Alcalde ${i}`, possessio: `${m.slice(0, 4)}-06-17` })),
  },
  llistes2023: {
    vilagran: [
      { sigles: "PSC", vots: 30_000, regidories: 9 }, { sigles: "JUNTS", vots: 25_000, regidories: 8 },
      { sigles: "ERC", vots: 15_000, regidories: 5 }, { sigles: "PP", vots: 8_000, regidories: 3 },
      { sigles: "CUP", vots: 6_000, regidories: 2 }, { sigles: "VOX", vots: 1_900, regidories: 0 },
    ],
    riubaix: [{ sigles: "ERC", vots: 2_000, regidories: 7 }, { sigles: "JUNTS", vots: 1_800, regidories: 6 }],
    pontnou: [{ sigles: "IP", vots: 1_500, regidories: 11 }],
    "santa-oliva-del-mont": [{ sigles: "AM", vots: 400, regidories: 7 }],
    // Alp: llistes obertes, no hi compten els vots per regidoria.
    alp: [{ sigles: "CM", vots: 3, regidories: 3 }],
    marfull: [
      { sigles: "A", vots: 3_000, regidories: 5 }, { sigles: "B", vots: 2_800, regidories: 5 }, { sigles: "C", vots: 2_500, regidories: 4 },
      { sigles: "D", vots: 1_500, regidories: 3 }, { sigles: "E", vots: 1_200, regidories: 2 }, { sigles: "F", vots: 1_000, regidories: 1 },
      { sigles: "G", vots: 900, regidories: 1 },
    ],
    torrelluna: [{ sigles: "X", vots: 2_000, regidories: 7 }, { sigles: "Y", vots: 1_600, regidories: 6 }],
  },
  ple2023: {
    vilagran: { sistema: "llistes tancades", regidories: 27 },
    riubaix: { sistema: "llistes tancades", regidories: 13 },
    pontnou: { sistema: "llistes tancades", regidories: 11 },
    "santa-oliva-del-mont": { sistema: "llistes tancades", regidories: 7 },
    alp: { sistema: "llistes obertes", regidories: 3 },
    marfull: { sistema: "llistes tancades", regidories: 21 },
    torrelluna: { sistema: "llistes tancades", regidories: 13 },
  },
  naixements: {
    vilagran: { "marta puig roca": 1968 },
    riubaix: { "joan serra vila": 1949, "una altra persona": 1990 },
    pontnou: { "pere coll mas": 1995 },
    "santa-oliva-del-mont": { "anna font gil": 1975 },
    alp: { "jordi pons bou": 1955 },
    bot: { "rosa vidal sala": 1962 },
    das: { "lluc riu pau": 1998 },
    ger: { "eva moll ros": 1980 },
    "vall-de-sant-esteve-de-les-roques": { "pau roig prat": 1971 },
    marfull: { "nuria sol camps": 1985 },
    colldarnes: { "marc rius bosch": 1959 },
  },
  retribucions: {
    vilagran: { mena: "sou", euros: 84_000, any: 2024 },
    riubaix: { mena: "sou", euros: 42_000, any: 2024 },
    pontnou: { mena: "cap", euros: 0, any: 2024 },
    "santa-oliva-del-mont": { mena: "assistencies", euros: 900, any: 2024 },
    alp: { mena: "cap", euros: 0, any: 2024 },
    bot: { mena: "sou", euros: 12_000, any: 2024 },
    das: { mena: "cap", euros: 0, any: 2024 },
    marfull: { mena: "sou", euros: 60_000, any: 2024 },
    torrelluna: { mena: "sou", euros: 35_000, any: 2024 },
  },
});

const fetDe = (id: string) => preparaCuriositats(files(), dades()).find((c) => c.id === id);

describe("primers", () => {
  it("dona els primers per valor, els empats per nom, i compta els que queden amb la mateixa xifra", () => {
    const items = [{ n: "C", v: 3 }, { n: "A", v: 3 }, { n: "B", v: 3 }, { n: "D", v: 1 }];
    const alt = primers(items, (x) => x.v, (x) => x.n, 2, "max");
    expect(alt.files.map((x) => x.n)).toEqual(["A", "B"]);
    expect(alt.empatats).toBe(1);
    const baix = primers(items, (x) => x.v, (x) => x.n, 2, "min");
    expect(baix.files.map((x) => x.n)).toEqual(["D", "A"]);
    expect(baix.empatats).toBe(2);
    expect(primers([], (x: { v: number }) => x.v, () => "", 5, "max")).toEqual({ files: [], empatats: 0 });
  });
});

describe("mandatsSeguits", () => {
  it("compta cap enrere mentre el mateix nom consti al mandat anterior", () => {
    const s = mandatsSeguits(dades().alcaldies["vilagran"]!, "2023-2027")!;
    expect(s.nom).toBe("Marta Puig Roca");
    expect(s.mandats).toBe(11);
    expect(s.desDe).toBe(1983);
    expect(s.desDelPrincipi).toBe(false);
  });

  it("des del principi és tenir tots els mandats des del primer del registre", () => {
    const s = mandatsSeguits(dades().alcaldies["riubaix"]!, "2023-2027")!;
    expect(s.mandats).toBe(12);
    expect(s.desDe).toBe(1979);
    expect(s.desDelPrincipi).toBe(true);
  });

  it("l'alcaldia actual és qui ha pres possessió més tard, i el relleu talla la sèrie", () => {
    const s = mandatsSeguits(dades().alcaldies["pontnou"]!, "2023-2027")!;
    expect(s.nom).toBe("Pere Coll Mas");
    expect(s.mandats).toBe(1);
    expect(s.desDe).toBe(2025);
  });

  it("un mandat que falta al registre trenca la sèrie: un buit no és una continuïtat", () => {
    const s = mandatsSeguits(dades().alcaldies["santa-oliva-del-mont"]!, "2023-2027")!;
    expect(s.mandats).toBe(3);
    expect(s.desDe).toBe(2015);
    expect(s.desDelPrincipi).toBe(false);
  });

  it("sense el mandat en curs no diu res", () => {
    expect(mandatsSeguits(dades().alcaldies["ger"]!, "2023-2027")).toBeNull();
    expect(mandatsSeguits([], "2023-2027")).toBeNull();
  });

  it("un poble que només té el mandat en curs no mana «des del principi»: el principi és el del registre", () => {
    const s = mandatsSeguits(dades().alcaldies["alp"]!, "2023-2027", 1979)!;
    expect(s.mandats).toBe(1);
    expect(s.desDelPrincipi).toBe(false);
  });
});

describe("hrefAlcaldia", () => {
  it("envia a la fitxa de regidor si és l'alcaldia actual amb el mateix nom, i si no a la pàgina de l'historial", () => {
    const f = files()[1]!;
    expect(hrefAlcaldia(f, "Joan Serra Vila")).toBe("../m/riubaix/regidor/joan-serra-vila/");
    expect(hrefAlcaldia(f, "JOAN SERRA VILA")).toBe("../m/riubaix/regidor/joan-serra-vila/");
    expect(hrefAlcaldia(f, "ANTONI GRAS I PUJOL")).toBe("../m/riubaix/alcaldia/antoni-gras-i-pujol/");
    expect(hrefAlcaldia(files()[2]!, "Pere Coll Mas")).toBe("../m/pontnou/alcaldia/pere-coll-mas/");
  });
});

describe("preparaCuriositats", () => {
  it("sense dades de la base només publica el que la fila porta sola", () => {
    const ids = preparaCuriositats(files(), DADES_BUIDES).map((c) => c.id);
    expect(ids).toEqual(["dones-ple", "regidories-habitant", "noms"]);
  });

  it("sense files no publica res", () => {
    expect(preparaCuriositats([], dades())).toEqual([]);
  });

  it("qui fa més anys que mana: ordena per mandats seguits, enllaça la persona i diu sobre quants", () => {
    const fet = fetDe("mana-mes")!;
    expect(fet.periode).toBe("1979-2027");
    const [llargs, principi] = fet.llistes;
    expect(llargs!.files.slice(0, 3).map((f) => [f.persona!.nom, f.valor, f.detall])).toEqual([
      ["Joan Serra Vila", "12 mandats seguits", "des del 1979"],
      ["Marta Puig Roca", "11 mandats seguits", "des del 1983"],
      ["Anna Font Gil", "3 mandats seguits", "des del 2015"],
    ]);
    expect(llargs!.files[0]!.persona!.href).toBe("../m/riubaix/regidor/joan-serra-vila/");
    // Pere Coll Mas no té fitxa de regidor: va a la pàgina de l'historial.
    expect(llargs!.files.find((f) => f.municipi.s === "pontnou")!.persona!.href).toBe("../m/pontnou/alcaldia/pere-coll-mas/");
    expect(principi!.cap).toBe("L'únic on mana la mateixa persona des del 1979");
    expect(principi!.files.map((f) => f.municipi.n)).toEqual(["Riubaix"]);
    // Ger no té el mandat en curs i no s'hi compta; ho diu la cobertura.
    expect(fet.cobertura).toBe("S'ha mirat l'historial d'alcaldies amb el mandat 2023-2027 de 6 municipis dels 12.");
  });

  it("els noms que apareixen en majúscules al registre s'escriuen llegibles", () => {
    const fet = fetDe("mana-mes")!;
    expect(fet.llistes[0]!.files.some((f) => f.persona!.nom === "Joan Serra Vila")).toBe(true);
    expect(fet.llistes[0]!.files.some((f) => /[A-Z]{3}/.test(f.persona!.nom))).toBe(false);
  });

  it("els ajuntaments amb més alcaldes diferents compten persones, no files", () => {
    const fet = fetDe("mes-alcaldes")!;
    expect(fet.llistes[0]!.files[0]).toEqual({ municipi: { s: "marfull", n: "Marfull", c: "Pallars" }, valor: "12 persones", detall: "en 12 mandats" });
    expect(fet.llistes[0]!.files[1]!.municipi.n).toBe("Pontnou");
    expect(fet.llistes[0]!.files[1]!.valor).toBe("3 persones");
    expect(fet.cobertura).toBe("S'ha mirat l'historial d'alcaldies de 7 municipis dels 12.");
  });

  it("les alcaldies per any de naixement només surten amb deu o més i diuen de quantes", () => {
    const fet = fetDe("edat-alcaldies")!;
    const [tard, abans] = fet.llistes;
    const avui = new Date().getFullYear();
    expect(tard!.files.map((f) => f.valor)).toEqual(
      [1998, 1995, 1985, 1980, 1975].map((any) => `uns ${avui - any} anys · any ${any}`),
    );
    expect(tard!.files[0]!.persona).toEqual({ nom: "Lluc Riu Pau", href: null });
    expect(abans!.files[0]!.persona).toEqual({ nom: "Joan Serra Vila", href: "../m/riubaix/regidor/joan-serra-vila/" });
    // Torrelluna no té fitxa a Wikidata: 11 de 12.
    expect(fet.cobertura).toBe("S'han mirat les 11 alcaldies de 12 que tenen any de naixement a Wikidata; de la resta no se'n sap.");

    const poques = dades();
    poques.naixements = { vilagran: poques.naixements["vilagran"]! };
    expect(preparaCuriositats(files(), poques).some((c) => c.id === "edat-alcaldies")).toBe(false);
  });

  it("l'any de naixement només compta si el nom de l'alcaldia lliga amb la fitxa", () => {
    const canviat = files().map((f) => (f.s === "riubaix" ? { ...f, a: "Una Persona Nova" } : f));
    const fet = preparaCuriositats(canviat, dades()).find((c) => c.id === "edat-alcaldies")!;
    expect(fet.cobertura).toContain("les 10 alcaldies de 12");
  });

  it("els sous: els més alts amb la persona, les alcaldies sense import per població, i l'exercici", () => {
    const fet = fetDe("sou-alcaldia")!;
    expect(fet.periode).toBe("exercici 2024");
    const [alts, sense] = fet.llistes;
    expect(alts!.files.map((f) => [f.municipi.n, f.valor])).toEqual([
      ["Vilagran", "84.000 € l'any"], ["Marfull", "60.000 € l'any"], ["Riubaix", "42.000 € l'any"],
      ["Torrelluna", "35.000 € l'any"], ["Vall de Sant Esteve de les Roques", "30.000 € l'any"],
    ]);
    expect(alts!.files[0]!.persona).toEqual({ nom: "Marta Puig Roca", href: "../m/vilagran/regidor/marta-puig-roca/" });
    expect(sense!.cap).toBe("Totes les 3 alcaldies sense cap import declarat");
    expect(sense!.files.map((f) => f.municipi.n)).toEqual(["Pontnou", "Das", "Alp"]);
    expect(fet.metode).toContain("1 alcaldies cobren només assistències");
    expect(fet.cobertura).toBe("S'han mirat els 9 municipis que consten al full del Ministeri; dels 12 n'hi falten 3. Amb sou: 6.");
  });

  it("els plens amb més llistes compten només les que van treure regidoria, i els d'una sola surten per població", () => {
    const fet = fetDe("fragmentacio")!;
    const [mes, una] = fet.llistes;
    expect(mes!.files[0]!.municipi.n).toBe("Marfull");
    expect(mes!.files[0]!.valor).toBe("7 llistes");
    // VOX no va treure regidoria a Vilagran: cinc, no sis.
    expect(mes!.files[1]!.valor).toBe("5 llistes");
    expect(mes!.files[1]!.detall).toBe("PSC 9 · JUNTS 8 · ERC 5 · PP 3 · CUP 2");
    expect(una!.cap).toBe("Tots els 3 plens on una sola llista va treure regidories");
    expect(una!.files.map((f) => f.municipi.n)).toEqual(["Pontnou", "Santa Oliva del Mont", "Alp"]);
    expect(fet.cobertura).toBe("S'ha mirat els resultats de les municipals del 2023 de 7 municipis dels 12.");
  });

  it("la regidoria en vots deixa fora les llistes obertes i diu quantes candidatures ha mirat", () => {
    const fet = fetDe("regidoria-vots")!;
    const [cares, barates] = fet.llistes;
    expect(cares!.files[0]!.valor).toBe("3.333 vots per regidoria");
    expect(cares!.files[0]!.detall).toBe("PSC · 30.000 vots, 9 regidories");
    expect(barates!.files[0]!.detall).toBe("AM · 400 vots, 7 regidories");
    expect(barates!.files[0]!.valor).toBe("57 vots per regidoria");
    // Alp (llistes obertes, 1 vot per regidoria) no hi és.
    expect(fet.llistes.flatMap((l) => l.files).some((f) => f.municipi.s === "alp")).toBe(false);
    // Sis municipis de llistes tancades amb més de cinc regidories: 5+2+1+1+7+2 candidatures amb regidoria.
    expect(fet.cobertura).toBe("S'han mirat 18 candidatures amb regidoria de 6 municipis dels 12: els de llistes tancades amb més de cinc regidories.");
  });

  it("els plens de dones i sense dones només compten els municipis amb la llista completa, i ho diuen", () => {
    const fet = fetDe("dones-ple")!;
    const [totes, cap] = fet.llistes;
    expect(totes!.cap).toBe("Tots els 2 plens on totes les regidories són dones");
    expect(totes!.files.map((f) => f.municipi.n)).toEqual(["Santa Oliva del Mont", "Das"]);
    expect(cap!.files.map((f) => f.municipi.n)).toEqual(["Pontnou", "Ger"]);
    expect(cap!.files[0]!.valor).toBe("0 % dones");
    expect(fet.cobertura).toBe("S'ha mirat la llista d'electes de 10 municipis dels 12. Els altres 2 no tenen la llista sencera al registre i no s'hi compten.");
  });

  it("regidories per habitant: els pobles de tres regidors primer i les ciutats a l'altre extrem", () => {
    const fet = fetDe("regidories-habitant")!;
    const [mes, menys] = fet.llistes;
    expect(mes!.files[0]!.municipi.n).toBe("Alp");
    expect(mes!.files[0]!.valor).toBe("1 per cada 20 habitants");
    expect(menys!.files[0]!.municipi.n).toBe("Vilagran");
    expect(menys!.files[0]!.valor).toBe("1 per cada 4.444 habitants");
    expect(fet.cobertura).toBe("S'ha mirat el padró i les regidories de 12 municipis.");
  });

  it("els noms més llargs i més curts compten lletres i resumeixen els empats", () => {
    const fet = fetDe("noms")!;
    const [llargs, curts] = fet.llistes;
    expect(llargs!.files[0]).toEqual({ municipi: { s: "vall-de-sant-esteve-de-les-roques", n: "Vall de Sant Esteve de les Roques", c: "Pallars" }, valor: "27 lletres" });
    expect(curts!.files.map((f) => f.municipi.n)).toEqual(["Alp", "Bot", "Das", "Ger", "Marfull"]);
    expect(curts!.empatats).toBe(2);
  });

  it("cap curiositat no jutja: ni «millor» ni «pitjor» enlloc, i totes diuen sobre quants", () => {
    for (const c of preparaCuriositats(files(), dades())) {
      const text = JSON.stringify(c);
      expect(text).not.toMatch(/millor|pitjor/i);
      expect(c.cobertura).toMatch(/\d/);
      expect(c.font.length).toBeGreaterThan(0);
      expect(c.periode.length).toBeGreaterThan(0);
      expect(c.llistes.every((l) => l.files.length > 0)).toBe(true);
    }
  });
});

describe("renderCuriositats", () => {
  const html = renderCuriositats(preparaCuriositats(files(), dades()));

  it("és una secció «bloc» amb una targeta per fet, i sense fets no escriu res", () => {
    expect(html).toContain('<section class="bloc" id="curiositats">');
    expect(html.match(/<article class="curiositat"/g)).toHaveLength(9);
    expect(html).toContain('<p class="micro">1979-2027 · Generalitat de Catalunya · historial d&#39;alcaldies</p>'.replace("&#39;", "'"));
    expect(renderCuriositats([])).toBe("");
  });

  it("cada fila porta la posició, l'enllaç a la fitxa municipal i, si en té, a la persona", () => {
    expect(html).toContain('<li><span class="pos">1</span><span class="municipi"><a href="../m/riubaix/regidor/joan-serra-vila/">Joan Serra Vila</a><small><a href="../m/riubaix/">Riubaix</a> · <a class="comarca" href="../c/alt-camp/">Alt Camp</a> · des del 1979</small></span><b class="dada">12 mandats seguits</b></li>');
    expect(html).toContain('<span class="sense-fitxa">Lluc Riu Pau</span>');
    expect(html).toContain('<a href="../m/pontnou/alcaldia/pere-coll-mas/">Pere Coll Mas</a>');
  });

  it("escriu la cobertura, la cautela i els empats que no s'escriuen", () => {
    expect(html).toContain('<p class="cobertura">S&#39;ha mirat el nom oficial de 12 municipis.</p>'.replace("&#39;", "'"));
    expect(html).toContain('<p class="nota">Quantes regidories té un ple ho fixa la llei per trams de població: no ho tria cap ajuntament.</p>');
    expect(html).toContain('<p class="secundari">i 2 més amb la mateixa xifra.</p>');
  });
});

describe("cada curiositat, plegada", () => {
  const fets = preparaCuriositats(files(), dades());
  const html = renderCuriositats(fets);

  it("és un <details> tancat amb el títol i la resposta d'una línia a la vista", () => {
    expect(html.match(/<details class="cur-plec">/g)).toHaveLength(fets.length);
    expect(html).not.toContain('<details class="cur-plec" open');
    const primer = html.slice(html.indexOf('<summary class="cur-obre">'), html.indexOf("</summary>"));
    expect(primer).toContain(`<h3>${fets[0]!.titol}</h3>`);
    expect(primer).toContain('<span class="cur-resposta">');
    // A la vista no hi ha llistes: són dins del calaix.
    expect(primer).not.toContain("llista-curiosa");
  });

  it("la resposta diu qui encapçala la primera llista i amb quina xifra, en text pla", () => {
    const qui = fets.find((f) => f.llistes[0]?.files[0]?.persona)!;
    const fila = qui.llistes[0]!.files[0]!;
    expect(respostaCuriositat(qui)).toBe(`${qui.llistes[0]!.cap}: ${fila.persona!.nom}, a ${fila.municipi.n} · ${fila.valor}`);
    // Dins del <summary> no hi ha enllaços: un toc hi faria dues coses.
    for (const m of html.matchAll(/<summary class="cur-obre">([\s\S]*?)<\/summary>/g)) expect(m[1]).not.toContain("<a ");
  });

  it("sense cap fila no s'inventa cap resposta", () => {
    const buit = { ...fets[0]!, llistes: [{ cap: "Res", files: [] }] };
    expect(respostaCuriositat(buit)).toBe("");
    expect(targetaCuriositat(buit)).not.toContain("cur-resposta");
  });

  it("l'article i el seu id es queden, perquè hi ha enllaços a #cur-… i altres pàgines que el pinten", () => {
    expect(html).toContain(`<article class="curiositat" id="cur-${fets[0]!.id}">`);
  });

  it("el resum és un objectiu de 44 px amb el focus visible, i cap rètol en majúscules espaiades", () => {
    expect(CURIOSITATS_CSS).toMatch(/\.cur-obre\{[^}]*min-height:44px/);
    expect(CURIOSITATS_CSS).toContain(".cur-obre:focus-visible{outline:3px solid");
    expect(CURIOSITATS_CSS).not.toContain("text-transform:uppercase");
    expect(CURIOSITATS_CSS).not.toContain("box-shadow");
  });
});

describe("les curiositats de l'última regidoria i de la llista única", () => {
  it("compta les regidories decidides per menys de deu vots i ensenya les més justes amb qui les va treure", () => {
    const amb = files().map((f, i) => ({ ...f, mg: [3, 1, 40, 9, 250, 12, 7, 1_200, 15, 9, 60, 2][i]!, mgg: "AAA", mgp: "BBB" }));
    const fet = preparaCuriositats(amb, DADES_BUIDES).find((c) => c.id === "ultima-regidoria")!;
    expect(fet.titol).toBe("6 regidories es van decidir per menys de 10 vots");
    const llista = fet.llistes[0]!;
    expect(llista.files[0]).toMatchObject({ valor: "1 vot", detall: "l'última va ser per a AAA; la tenia a tocar BBB" });
    expect(llista.files.map((f) => f.valor).slice(0, 3)).toEqual(["1 vot", "2 vots", "3 vots"]);
    expect(fet.cautela).toContain("no és una predicció del 2027");
  });

  it("sense la mètrica de marges, el fet no surt", () => {
    expect(preparaCuriositats(files(), DADES_BUIDES).some((c) => c.id === "ultima-regidoria")).toBe(false);
  });

  it("compara la participació amb una sola llista i amb més d'una dins de cada tram, amb la mediana", () => {
    // Vint pobles de fins a 100 habitants: deu amb una sola llista (participació 60-69) i deu amb més d'una (75-84).
    const petits: FilaCuriositat[] = Array.from({ length: 20 }, (_, i) => ({
      s: `p${i}`, n: `Poble ${i}`, c: "Pallars", p: 50 + i, o: i < 10 ? 1 : 0, oa: i < 10 ? 2023 : null,
      pt: i < 10 ? 60 + i : 65 + i,
    }));
    const fet = preparaCuriositats(petits, DADES_BUIDES).find((c) => c.id === "una-sola-llista")!;
    expect(fet.llistes).toHaveLength(1);
    expect(fet.llistes[0]!.cap).toBe("fins a 100 habitants: 64,5 % amb una sola llista i 79,5 % amb més d'una");
    expect(fet.llistes[0]!.files).toHaveLength(5);
    expect(fet.cautela).toContain("no n'explica la causa");
    // Un ple que el Síndic compta d'una altra campanya no entra a cap costat.
    const altra = petits.map((f, i) => (i === 0 ? { ...f, oa: 2019 } : f));
    expect(preparaCuriositats(altra, DADES_BUIDES).find((c) => c.id === "una-sola-llista")!.cobertura)
      .toContain("9 d'ells amb una sola candidatura");
  });

  it("amb menys de cinc municipis d'una llista en un tram, el tram no surt", () => {
    const pocs: FilaCuriositat[] = Array.from({ length: 20 }, (_, i) => ({
      s: `p${i}`, n: `Poble ${i}`, c: "Pallars", p: 50 + i, o: i < 4 ? 1 : 0, pt: 70,
    }));
    expect(preparaCuriositats(pocs, DADES_BUIDES).some((c) => c.id === "una-sola-llista")).toBe(false);
  });
});
