import { describe, expect, it } from "vitest";
import {
  clauCandidatura,
  clauCerca,
  clausOrdre,
  ORDRES,
  ordresDisponibles,
  filtresDisponibles,
  lectorDe,
  llindarsDe,
  marques,
  mediana,
  pastilles,
  POSICIO_ANY_RENDA,
  renderEls947,
  souAlcaldia,
  textOrdre,
  type Els947Row,
  type Fila,
} from "./els947";
import { RADIOGRAFIA_CSS } from "./estil";
import { MASCOTA_CSS } from "./mascota";

/**
 * El CSS propi de la pàgina: el que ve després dels dos fulls compartits, i
 * sense comentaris, que no són regles i poden citar selectors d'altres.
 */
const cssPropi = (html: string): string => {
  const estil = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
  return estil.slice(estil.indexOf(MASCOTA_CSS) + MASCOTA_CSS.length).replace(/\/\*[\s\S]*?\*\//g, "");
};

const fila = (s: string, extra: Partial<Els947Row> = {}): Els947Row => ({
  s,
  n: s,
  c: "Pallars Jussà",
  p: 1000,
  r: 11,
  a: null,
  ar: null,
  ac: null,
  g: null,
  w: 1,
  m: 0,
  k: 0,
  t: 3,
  d: 500,
  e: 5,
  f: 40,
  v: 1,
  q: 12,
  y: 60,
  o: 0,
  ...extra,
});

const ambX = (r: Els947Row, x: 0 | 1 = 0): Fila => ({ ...r, x });

/** Un conjunt prou gran perquè les medianes es puguin oferir. */
const conjunt = Array.from({ length: 100 }, (_, i) =>
  fila(`municipi-${i}`, { n: `Municipi ${i}`, p: 100 + i * 10, d: i * 10, y: i }),
);

describe("clauCerca", () => {
  it("treu accents, apòstrofs i l'article, que és com la gent escriu", () => {
    expect(clauCerca("l'Hospitalet de Llobregat")).toBe("hospitalet de llobregat");
    expect(clauCerca("la Seu d'Urgell")).toBe("seu d urgell");
    expect(clauCerca("Sant Julià de Ramis")).toBe("sant julia de ramis");
  });

  it("es pot serialitzar per al navegador sense ajudants del transpilador", () => {
    // Si el transpilador hi fica un `__helper`, al navegador no hi seria i la
    // cerca petaria a la primera lletra.
    expect(clauCerca.toString()).not.toMatch(/\b__[A-Za-z0-9_$]+\s*\(/);
  });
});

describe("mediana", () => {
  it("amb un nombre senar de valors agafa el del mig", () => {
    expect(mediana([3, 1, 2])).toBe(2);
  });

  it("amb un nombre parell fa la mitjana dels dos del mig", () => {
    expect(mediana([1, 2, 3, 4])).toBe(2.5);
  });

  it("sense valors no s'inventa cap xifra", () => {
    expect(mediana([])).toBeNull();
  });
});

describe("llindarsDe", () => {
  it("arrodoneix, perquè l'etiqueta del filtre digui la regla que s'aplica", () => {
    const l = llindarsDe(conjunt);
    expect(l.deute).toBe(Math.round(mediana(conjunt.map((f) => f.d!))!));
    expect(Number.isInteger(l.deute)).toBe(true);
  });

  it("no ofereix cap mediana quan gairebé ningú no té la dada", () => {
    const quasiBuit = conjunt.map((f, i) => ({ ...f, d: i < 5 ? 100 : null, y: null }));
    const l = llindarsDe(quasiBuit);
    expect(l.deute).toBeNull();
    expect(l.transparencia).toBeNull();
    expect(filtresDisponibles(l).map((f) => f.clau)).not.toContain("deute");
    expect(filtresDisponibles(l).map((f) => f.clau)).not.toContain("opac");
  });
});

describe("marques", () => {
  const l = llindarsDe(conjunt);

  it("un municipi que ho toca tot porta les onze marques", () => {
    const tot = ambX(
      fila("x", { w: 0, k: 1, m: 1, o: 1, p: 400, t: 0, v: 0, q: 12, f: 60, d: 5000, y: 0 }),
      1,
    );
    expect(marques(tot, l).sort()).toEqual(filtresDisponibles(l).map((f) => f.clau).sort());
  });

  it("i un de corrent només porta el que li toca", () => {
    // La mediana del deute d'aquest conjunt és 495: 500 hi queda just per sobre.
    expect(marques(ambX(fila("x")), l)).toEqual(["deute"]);
  });

  it("no marca «sempre» amb poques eleccions: quatre no són una sèrie", () => {
    expect(marques(ambX(fila("x", { v: 0, q: 4 })), l)).not.toContain("sempre");
  });

  it("la paritat és estricta: la meitat justa no és «més dones que homes»", () => {
    expect(marques(ambX(fila("x", { f: 50 })), l)).not.toContain("dones");
    expect(marques(ambX(fila("x", { f: 50.1 })), l)).toContain("dones");
  });

  it("sense dada no hi ha marca: un forat no és un valor baix", () => {
    expect(marques(ambX(fila("x", { d: null, y: null, f: null })), l)).not.toContain("deute");
    expect(marques(ambX(fila("x", { d: null, y: null, f: null })), l)).not.toContain("opac");
  });
});

describe("pastilles", () => {
  it("no repeteix qui mana: l'alcaldia té la seva pròpia línia i no és cap pastilla", () => {
    // Van ser una pastilla sola de 453px, després dues, i ara cap: el nom i les
    // sigles surten a la línia de dalt amb la cara i el color del partit. Si
    // algú els torna a posar aquí, sortiran dues vegades a cada fila.
    const p = pastilles(
      ambX(fila("x", { a: "Josep Maria Gras Charles", g: "AGRUPACIÓ D'ELECTORS-PROGRÉS MUNICIPAL" })),
    ).join(" ");
    expect(p).not.toContain("Josep Maria Gras Charles");
    expect(p).not.toContain("AGRUPACIÓ");
  });

  it("com a molt en són tres, i totes tres diuen qui mana", () => {
    // N'hi havia set per fila —346 kB d'un fitxer d'un megabyte— i totes
    // repetien una xifra que la fila ja duu a «data-o» o a «data-f». Un
    // municipi que ho toca tot en porta tres, i un de corrent cap.
    const tot = pastilles(ambX(fila("x", { w: 0, k: 1, m: 1, o: 1, v: 0, q: 12, t: 0, d: 5000, y: 0, f: 60 })));
    expect(tot).toHaveLength(3);
    expect(tot.join("")).toContain("Governa qui no va guanyar");
    expect(tot.join("")).toContain("Canvi d'alcaldia a mig mandat");
    expect(tot.join("")).toContain("Majoria absoluta");
    expect(pastilles(ambX(fila("x")))).toEqual([]);
  });

  it("cap xifra no s'escriu com a pastilla: la que mana la pinta el navegador en ordenar", () => {
    const p = pastilles(ambX(fila("x", { d: 9999, y: 3, t: 0, f: 60, rn: 14350, ra: 2023, o: 1 }))).join(" ");
    for (const text of ["regidories", "actes", "deute", "renda", "dones", "Transparència", "candidatura", "1979"]) {
      expect(p, text).not.toContain(text);
    }
  });

  it("no diu res que sigui un judici de gestió", () => {
    const p = pastilles(ambX(fila("x", { w: 0, k: 1, m: 1 }))).join(" ");
    expect(p).not.toMatch(/malament|bé|pitjor|millor|suspèn|aprovat/i);
  });
});

describe("renderEls947", () => {
  const amb = (files: readonly Els947Row[], fitxes: string[] = files.map((f) => f.s)): string =>
    renderEls947(files, "2026-08-29", new Set(fitxes));
  const html = amb(conjunt);

  it("ensenya qui mana amb la seva cara i el color del seu partit", () => {
    const p = amb([
      ambX(fila("x", { a: "Ada Colau Ballano", g: "B EN COMÚ", ar: "/observatori/fotos/160/1.webp", ac: "#662483" })),
    ]);
    expect(p).toContain('src="/observatori/fotos/160/1.webp"');
    expect(p).toContain("Ada Colau Ballano");
    expect(p).toContain("#662483");
  });

  it("sense fotografia hi van les inicials amb el color del partit, mai un buit", () => {
    const p = amb([ambX(fila("x", { a: "Ada Colau Ballano", g: "B EN COMÚ", ar: null, ac: "#662483" }))]);
    expect(p).toContain('class="cara inicials"');
    expect(p).toContain(">AC<");
    expect(p).not.toContain("<img");
  });

  it("l'Hospitalet: la cara i el nom porten a la fitxa de la persona que ha decidit resolAlcaldia", () => {
    // La seu no marca ningú després del relleu i la fila arriba amb el retrat
    // i el camí trobats pel nom oficial: la llista els ensenya i els enllaça.
    const p = amb([
      ambX(
        fila("hospitalet-de-llobregat", {
          n: "l'Hospitalet de Llobregat", a: "DAVID QUIRÓS BRITO", g: "PSC-CP",
          ar: "/observatori/fotos/160/11.webp", ad: "regidor/quiros-brito-david/", ac: "#e30613",
        }),
        1,
      ),
    ]);
    const enllac = p.slice(p.indexOf('<a class="persona"'), p.indexOf("</a>", p.indexOf('<a class="persona"')));
    expect(enllac).toContain('href="m/hospitalet-de-llobregat/regidor/quiros-brito-david/"');
    expect(enllac).toContain('src="/observatori/fotos/160/11.webp"');
    expect(enllac).toContain("David Quirós Brito");
    expect(enllac).not.toContain('class="cara inicials"');
  });

  it("sense fitxa de persona, el nom porta a l'apartat d'alcaldies del municipi", () => {
    const p = amb([ambX(fila("x", { a: "Ada Colau Ballano", g: "B EN COMÚ", ar: null, ad: null, ac: "#662483" }), 1)]);
    expect(p).toContain('<a class="persona" href="m/x/#alcaldies">');
    expect(p).toContain('class="cara inicials"');
  });

  it("i sense fitxa del municipi no hi ha enllaç, com amb el nom del poble", () => {
    // La fitxa la decideix el conjunt de pàgines escrites, no la fila.
    const p = amb([ambX(fila("x", { a: "Ada Colau Ballano", g: "B EN COMÚ", ad: "regidor/ada-colau-ballano/" }))], []);
    expect(p).not.toContain('class="persona"');
    expect(p).not.toContain("regidor/ada-colau-ballano/");
    expect(p).toContain("Ada Colau Ballano");
  });

  it("la pastilla de sigles queda fora de l'enllaç de la persona: dos enllaços, no un dins l'altre", () => {
    const p = amb([ambX(fila("x", { a: "Ada Colau Ballano", g: "ERC-AM", b: "erc", ad: "regidor/ada-colau-ballano/" }), 1)]);
    const persona = p.slice(p.indexOf('<a class="persona"'), p.indexOf("</a>", p.indexOf('<a class="persona"')));
    expect(persona).not.toContain("partit/erc/");
    expect(p).toContain('href="./partit/erc/"');
  });

  it("escapa el nom de l'alcaldia, que ve de la base de dades", () => {
    const p = amb([ambX(fila("x", { a: "<script>alert(1)</script>", g: null }))]);
    expect(p).not.toContain("<script>alert(1)</script>");
  });

  it("fa servir el CSS compartit i no una còpia pròpia", () => {
    // El to de text del coral només existeix a `estil.ts`: si hi és, la pàgina
    // rep les correccions de la resta de l'Observatori.
    expect(html).toContain("--coral-text");
    expect(html).toContain(".destins");
    // I no torna a declarar els tokens pel seu compte.
    expect(html.match(/--paper:#FBF7EE/g) ?? []).toHaveLength(1);
  });

  it("escriu la llista sencera a l'HTML: sense JavaScript s'ha de poder llegir", () => {
    expect(html.match(/<li class="fila"/g) ?? []).toHaveLength(conjunt.length);
    expect(html).toContain('<a class="municipi" href="m/municipi-0/">Municipi 0</a>');
  });

  it("un municipi sense fitxa surt igualment, però sense enllaç trencat", () => {
    const sense = amb(conjunt, []);
    expect(sense.match(/<li class="fila"/g) ?? []).toHaveLength(conjunt.length);
    expect(sense).not.toContain('href="m/municipi-0/"');
    expect(sense).toContain('<span class="municipi">Municipi 0</span>');
  });

  it("porta a la resta de la casa: mapa, comparador, comarques i preguntes", () => {
    expect(html).toContain('href="mapa/"');
    expect(html).toContain('href="comparador/"');
    // Les preguntes hi són pel peu, que és el mateix a totes les pàgines: la
    // secció «Segueix estirant» que les repetia a sobre del peu ja no hi és.
    expect(html).toContain('href="./preguntes/"');
    expect(html).not.toContain('href="preguntes/"');
    expect(html).not.toContain("Segueix estirant");
    expect(html).toContain('href="c/pallars-jussa/"');
  });

  it("les pistes de sota la presentació es queden: mapa i comparador", () => {
    const pistes = html.slice(html.indexOf('<p class="pistes">'), html.indexOf("</p>", html.indexOf('<p class="pistes">')));
    expect(pistes).toContain('href="mapa/"');
    expect(pistes).toContain('href="comparador/"');
  });

  it("enllaça les tipografies de la marca abans del full d'estil", () => {
    expect(html.indexOf("assets/fonts.css")).toBeGreaterThan(-1);
    expect(html.indexOf("assets/fonts.css")).toBeLessThan(html.indexOf("<style>"));
  });

  it("cap pastilla no porta «nowrap»: és el que desplaçava la pàgina a 320 px", () => {
    const css = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
    const regla = css.slice(css.indexOf(".pastilla{"), css.indexOf(".pastilla.pacte"));
    expect(regla).not.toContain("nowrap");
    expect(regla).toContain("overflow-wrap:anywhere");
  });

  it("cap objectiu de toc no baixa dels 44 px", () => {
    const css = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
    for (const selector of [".filtre{", ".neteja{", ".fila .municipi{", ".fila .lloc a{"]) {
      const regla = css.slice(css.indexOf(selector), css.indexOf("}", css.indexOf(selector)));
      expect(regla, selector).toContain("min-height:44px");
    }
  });

  it("els filtres funcionen sense JavaScript: caselles i CSS", () => {
    expect(html).toContain('id="f-majoria"');
    expect(html).toContain('.tauler:has(#f-majoria:checked) .fila:not([data-f~="majoria"])');
    expect(html).toContain('type="reset"');
  });

  it("els filtres nous hi són i porten la xifra que apliquen", () => {
    const l = llindarsDe(conjunt);
    expect(html).toContain("Més dones que homes al ple");
    expect(html).toContain(`Deute per sobre de ${l.deute!.toLocaleString("ca-ES")} €`);
    expect(html).toContain(`Transparència per sota del ${l.transparencia} %`);
    expect(html).toContain("Menys de 1.000 habitants");
  });

  it("un filtre que el conjunt no aguanta no es dibuixa", () => {
    const sense = amb(conjunt.map((f) => ({ ...f, y: null })));
    expect(sense).not.toContain('id="f-opac"');
    expect(sense).toContain('id="f-deute"');
  });

  it("diu que la mediana és una posició i no una nota", () => {
    expect(html).toContain("no si això està bé o malament");
    expect(html).toContain("cap veredicte de gestió");
  });

  it("la primera menció d'els947.cat ja diu que el joc és d'algú altre", () => {
    const primera = html.indexOf("els947.cat");
    const context = html.slice(primera - 400, primera + 200).replace(/\s+/g, " ");
    expect(context).toMatch(/d'una altra gent|d'algú altre/);
    expect(context).toContain("no tenim cap relació");
    // I el guinyo del final es manté amb el mateix sentit.
    expect(html).toContain("No hi tenim res a veure");
  });

  it("porta la mascota i les seves animacions", () => {
    expect(html).toContain('class="papereta"');
    expect(html).toContain("@keyframes parpelleig");
  });

  it("les colles de filtres van encapçalades per la icona del seu tema", () => {
    expect(html).toContain('aria-label="El ple"');
    expect(html).toContain('aria-label="Fiscalitat"');
  });

  it("la clau de cerca de cada fila és la mateixa funció que farà servir el navegador", () => {
    const amb947 = amb([fila("hospitalet", { n: "l'Hospitalet de Llobregat", c: "Barcelonès" })]);
    expect(amb947).toContain('data-k="hospitalet de llobregat barcelones"');
    expect(amb947).toContain("function clauCerca");
  });

  it("no es queda sense pàgina amb un conjunt buit", () => {
    expect(() => amb([])).not.toThrow();
  });

  it("compta els plens amb una sola candidatura, que és el que deia 0 tenint-ne 185", () => {
    const cap = amb([fila("a"), fila("b")]);
    expect(cap).toContain("<b>0</b><span>amb una sola candidatura al ple</span>");
    const dos = amb([fila("a", { o: 1 }), fila("b", { o: 1 }), fila("c")]);
    expect(dos).toContain("<b>2</b><span>amb una sola candidatura al ple</span>");
    // I el filtre ha de trobar-los: sense la marca a la fila, la casella no serveix.
    expect(dos.match(/data-f="[^"]*\bunica\b[^"]*"/g) ?? []).toHaveLength(2);
  });
});

describe("lectorDe", () => {
  it("torna la mètrica quan s'ha demanat a la consulta", () => {
    const { llegeix, te } = lectorDe(new Map([["singleList", { campaign: 2023 }]]));
    expect(llegeix("singleList")).toEqual({ campaign: 2023 });
    expect(te("singleList")).toBe(true);
  });

  it("distingeix «no la té» de «no s'ha demanat»", () => {
    const { te } = lectorDe(new Map());
    expect(te("singleList")).toBe(false);
  });

  it("peta si es llegeix una mètrica que no és a KINDS_ELS947", () => {
    const { llegeix, te } = lectorDe(new Map());
    // «actes» va estar-hi anys sense que cap job l'escrigués: una lectura buida
    // i silenciosa. Ara la que no s'ha demanat és la que peta.
    expect(() => llegeix("costGovern")).toThrow(/KINDS_ELS947/);
    expect(() => te("mocions")).toThrow(/KINDS_ELS947/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// El desbordament, les sigles clicables i les tres coses noves
// ───────────────────────────────────────────────────────────────────────────

/** El mateix conjunt de sempre, però amb la renda que ara publica la llista. */
const ambRenda = conjunt.map((f, i) => ({ ...f, rn: 12000 + i * 100, ra: 2023 }));

describe("les sigles, que desplaçaven la pàgina sencera", () => {
  const html = renderEls947(ambRenda, "2026-08-30", new Set(ambRenda.map((f) => f.s)));
  const css = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));

  it("no porten «nowrap» dins de la llista, que és el que feia 522 px en una pantalla de 320", () => {
    // «.sigla» de RADIOGRAFIA_CSS en porta i hi té raó —dins d'una frase de
    // titular una sigla partida no es llegeix—, i aquesta pàgina l'ha de desfer
    // per a les seves 947: n'hi ha de 63 caràcters, i amb «nowrap» fan 498 px.
    const regla = css.slice(css.indexOf(".mana .sigla{"), css.indexOf("}", css.indexOf(".mana .sigla{")));
    expect(regla).toContain("white-space:normal");
    expect(regla).toContain("overflow-wrap:anywhere");
    expect(regla).toContain("max-width:100%");
  });

  it("i la caixa de toc arriba als 44 px sense fer la fila més alta", () => {
    const regla = css.slice(css.indexOf(".mana .sigla{"), css.indexOf("}", css.indexOf(".mana .sigla{")));
    expect(regla).toContain("min-height:30px");
    // 30 de pastilla més 4 amunt i 10 avall són els 44 que demana un dit. No
    // van repartits: amunt hi ha l'enllaç de la comarca, i amb 7 la caixa hi
    // entrava 1 px i li prenia els tocs de la vora.
    expect(css).toContain(".mana a.sigla::after{content:\"\";position:absolute;inset:-4px -2px -10px}");
  });
});

describe("les 947 pastilles, ara clicables", () => {
  const ambSigles = (extra: Partial<Els947Row>): string =>
    renderEls947([fila("x", { a: "Ada Colau Ballano", ...extra })], "2026-08-30", new Set(["x"]));

  it("porten a la pàgina del partit quan sabem de quin és", () => {
    const p = ambSigles({ g: "PSC-CP", b: "psc", ac: "#E30613" });
    expect(p).toContain('href="./partit/psc/"');
    expect(p).toContain('class="sigla"');
    expect(p).toMatch(/<a class="sigla"[^>]*>PSC-CP<\/a>/);
  });

  it("el codi d'agrupació mana sobre les sigles, com a tot arreu", () => {
    // «EPCP-C» és El Prat en Comú Podem: endevinar-ho per les sigles no surt,
    // i el codi d'agrupació sí que ho diu.
    expect(ambSigles({ g: "EPCP-C", b: "comuns" })).toContain('href="./partit/comuns/"');
  });

  it("una llista local es queda sense enllaç, que és el que toca", () => {
    // Sota «AGRUPACIÓ D'ELECTORS» hi ha centenars de candidatures que no tenen
    // res a veure: ajuntar-les diria que existeix un partit que no existeix.
    const p = ambSigles({ g: "AGRUPACIÓ D'ELECTORS-PROGRÉS MUNICIPAL", b: "local", ac: null });
    expect(p).not.toContain("partit/local/");
    expect(p).toMatch(/<b class="sigla"/);
  });

  it("la cara i la pastilla comparteixen el color de la força", () => {
    const p = ambSigles({ g: "PSC-CP", b: "psc", ac: null, ar: null });
    const colors = [...p.matchAll(/--c:(#[0-9A-Fa-f]{6})/g)].map((m) => m[1]!.toLowerCase());
    expect(new Set(colors).size).toBe(1);
  });
});

describe("la renda per persona, la dada que faltava per comparar pobles", () => {
  it("posa la mediana al filtre, i només si prou municipis la tenen", () => {
    const l = llindarsDe(ambRenda);
    expect(l.renda).toBe(Math.round(mediana(ambRenda.map((f) => f.rn!))!));
    expect(l.ambRenda).toBe(ambRenda.length);
    expect(filtresDisponibles(l).map((f) => f.clau)).toContain("renda");
    // Amb quatre municipis amb dada, una mediana diu més del forat que dels pobles.
    const quasiBuit = llindarsDe(conjunt.map((f, i) => ({ ...f, rn: i < 5 ? 12000 : null })));
    expect(quasiBuit.renda).toBeNull();
    expect(filtresDisponibles(quasiBuit).map((f) => f.clau)).not.toContain("renda");
  });

  it("un forat no és una renda baixa: sense xifra no hi ha marca", () => {
    const l = llindarsDe(ambRenda);
    expect(marques(ambX({ ...ambRenda[0]!, rn: null }), l)).not.toContain("renda");
    expect(marques(ambX(ambRenda[0]!), l)).toContain("renda");
  });

  it("la xifra de l'ordre porta l'any, perquè no tothom la té del mateix", () => {
    // La renda ja no s'escriu a cada fila: la pinta el navegador quan s'ordena
    // per renda, i l'any li arriba com a últim camp de «data-o».
    const plantilla = ORDRES.find((o) => o.clau === "renda")!.unitat!;
    expect(textOrdre(plantilla, 14350, 2022)).toBe("renda 14.350 € (2022)");
    expect(textOrdre(plantilla, 14350, null)).toBe("renda 14.350 €");
    expect(clausOrdre(ambX({ ...ambRenda[0]!, rn: 14350, ra: 2022 })).split("|")[POSICIO_ANY_RENDA]).toBe("2022");
    // Sense renda no hi ha any: un any sol faria semblar que la xifra hi és.
    expect(clausOrdre(ambX({ ...ambRenda[0]!, rn: null, ra: 2022 })).split("|")[POSICIO_ANY_RENDA]).toBe("");
  });

  it("no diu que un poble sigui pobre, i diu que això no ho decideix l'ajuntament", () => {
    const html = renderEls947(ambRenda, "2026-08-30", new Set());
    expect(html).toContain("Hi entra menys de");
    expect(html).not.toMatch(/pobl?es? (més )?pobres?|municipis pobres/i);
    expect(html).toContain("La renda no la decideix l'ajuntament");
  });

  it("cita l'INE, que és la condició per poder-ne publicar la xifra", () => {
    const html = renderEls947(ambRenda, "2026-08-30", new Set());
    expect(html).toContain("Institut Nacional d'Estadística");
    expect(html).toContain("dades extretes del web de");
    expect(html).toContain("www.ine.es");
  });

  it("i diu quants la tenen, perquè l'INE en tapa uns quants", () => {
    const html = renderEls947(ambRenda, "2026-08-30", new Set());
    expect(html).toContain("secret estadístic");
    expect(html).toContain(`La renda per persona la tenen ${ambRenda.length}`);
  });
});

describe("ordenar la llista", () => {
  const html = renderEls947(ambRenda, "2026-08-30", new Set(ambRenda.map((f) => f.s)));

  it("cada fila porta les cinc xifres que no es poden deduir i l'any de la renda, en un sol atribut", () => {
    // Cinc atributs «data-» per fila serien 4.735 atributs a la pàgina. I la
    // població no hi és: l'ordre en què la llista ja ve escrita és el seu, i
    // repetir-la eren 4,3 kB de pàgina —2,7 comprimida— per no dir res de nou.
    expect(html.match(/ data-o="/g) ?? []).toHaveLength(ambRenda.length);
    const primera = html.match(/ data-o="([^"]*)"/)![1]!;
    expect(primera.split("|")).toHaveLength(6);
    // La primera xifra és la renda, no la població: la població no hi viatja.
    expect(primera.split("|")[0]).toBe(String(ambRenda[0]!.rn));
    expect(primera.split("|")).not.toContain(String(ambRenda[0]!.p));
    // I l'última és l'any de la renda, que no és cap ordre però la pastilla el diu.
    expect(primera.split("|")[5]).toBe("2023");
    expect(POSICIO_ANY_RENDA).toBe(5);
  });

  it("el buit hi va com a buit i no com a zero", () => {
    const sense = renderEls947([fila("x", { rn: null, d: null, y: null, f: null })], "2026-08-30", new Set());
    expect(sense).toContain('data-o="||||3|"');
    expect(clausOrdre(ambX(fila("x", { p: 10, rn: null, d: 5, y: null, f: null, t: 0 })))).toBe("|5|||0|");
  });

  it("cada fila té una pastilla per a la xifra de l'ordre, buida fins que el navegador l'omple", () => {
    // Sense JavaScript no hi ha cap ordre que no sigui el de població, i la
    // pastilla es queda amagada: la fila es llegeix igual que abans.
    expect(html.match(/<span class="pastilla ordre" hidden><\/span>/g) ?? []).toHaveLength(ambRenda.length);
    expect(cssPropi(html)).toContain(".pastilla.ordre[hidden]{display:none}");
    // Va a la línia del nom, abans de la població: és el que l'ull segueix.
    expect(html).toMatch(/<\/a><span class="pastilla ordre" hidden><\/span><span class="pob">/);
  });

  it("cada ordre de xifra diu com s'escriu la seva, i la població i el nom no diuen res", () => {
    for (const o of ORDRES) {
      if (o.de === "xifra") expect(o.unitat, o.clau).toContain("{n}");
      else expect(o.unitat, o.clau).toBeUndefined();
    }
    expect(textOrdre(ORDRES.find((o) => o.clau === "deute")!.unitat!, 656, null)).toBe("656 € de deute per habitant");
    expect(textOrdre(ORDRES.find((o) => o.clau === "dones")!.unitat!, 52, null)).toBe("52 % de dones al ple");
    expect(textOrdre(ORDRES.find((o) => o.clau === "actes")!.unitat!, 49, null)).toBe("49 actes");
    expect(textOrdre(ORDRES.find((o) => o.clau === "transp")!.unitat!, 74, null)).toBe("Transparència 74 %");
    // Cap plantilla no és un judici.
    for (const o of ORDRES) expect(o.unitat ?? "").not.toMatch(/millor|pitjor|bo|dolent/i);
  });

  it("la plantilla i l'any viatgen al navegador, i la funció que els llegeix és la mateixa", () => {
    expect(html).toContain('"u":"{n} € de deute per habitant"');
    expect(html).toContain('"c":"pob"');
    expect(html).toContain(`const RA = ${POSICIO_ANY_RENDA};`);
    expect(html).toContain("function textOrdre");
    // Si el transpilador hi fica un ajudant, al navegador no hi seria.
    expect(textOrdre.toString()).not.toMatch(/\b__[A-Za-z0-9_$]+\s*\(/);
  });

  it("hi ha un ordre que mana des del primer moment, i el navegador ho fa complir sol", () => {
    // Camps de ràdio: no cal cap línia de JavaScript perquè només un pugui manar.
    expect(html).toContain('type="radio" name="ordre" id="o-pob" value="pob" checked');
    for (const o of ORDRES) expect(html).toContain(`id="o-${o.clau}"`);
    expect(html).toContain(`${ambRenda.length} municipis, ${ORDRES[0]!.avall}`);
  });

  it("es pot ordenar per renda, que és per al que serveix tenir-la", () => {
    expect(ORDRES.map((o) => o.clau)).toContain("renda");
    expect(html).toContain("de més renda per persona a menys");
    expect(html).toContain("de menys renda per persona a més");
  });

  it("cap ordre no es presenta com un rànquing de gestió", () => {
    expect(html).toContain("rànquing de gestió");
    expect(html).toContain("un forat no és un zero");
    for (const o of ORDRES) {
      expect(o.avall).not.toMatch(/millor|pitjor|bo|dolent|rànquing/i);
      expect(o.amunt).not.toMatch(/millor|pitjor|bo|dolent|rànquing/i);
    }
  });

  it("el botó de capgirar arriba als 44 px, com la resta", () => {
    const css = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
    const regla = css.slice(css.indexOf(".capgira{"), css.indexOf("}", css.indexOf(".capgira{")));
    expect(regla).toContain("min-height:44px");
  });

  it("sense JavaScript no s'ensenya: uns botons que no fan res enganyen", () => {
    const css = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
    expect(css).toContain(".ordre{margin:var(--e3) 0 0;display:none}");
    expect(css).toContain(".js .ordre{display:block}");
  });
});

describe("quants municipis queden a cada filtre", () => {
  const html = renderEls947(ambRenda, "2026-08-30", new Set(ambRenda.map((f) => f.s)));

  it("cada casella té el seu comptador, i cap altre", () => {
    const l = llindarsDe(ambRenda);
    for (const f of filtresDisponibles(l)) expect(html).toContain(`<span class="quants" id="q-${f.clau}"></span>`);
    expect(html.match(/class="quants"/g) ?? []).toHaveLength(filtresDisponibles(l).length);
  });

  it("un filtre que el conjunt no aguanta tampoc no té comptador", () => {
    const sense = renderEls947(
      ambRenda.map((f) => ({ ...f, y: null })),
      "2026-08-30",
      new Set(),
    );
    expect(sense).not.toContain('id="q-opac"');
    expect(sense).toContain('id="q-deute"');
  });

  it("sense JavaScript no hi surt cap parèntesi buit", () => {
    const css = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
    expect(css).toContain(".quants{display:none}");
    expect(css).toContain(".js .quants{display:inline}");
  });

  it("la pàgina explica què vol dir la xifra de cada casella", () => {
    expect(html).toContain("quants dels que ara es veuen hi entrarien");
  });
});

describe("la clau d'una candidatura", () => {
  it("s'escriu una sola vegada, i per això les dues bandes coincideixen", () => {
    // El mapa es construïa amb un byte nul enmig i es llegia amb un espai: no
    // encertava mai, 0 de 947, i el codi d'agrupació de la Generalitat —que és
    // el que no s'ha d'endevinar— no s'arribava a fer servir enlloc.
    const mapa = new Map([[clauCandidatura(160, "B EN COMÚ"), "comuns"]]);
    expect(mapa.get(clauCandidatura(160, "B EN COMÚ"))).toBe("comuns");
    expect(mapa.get(`160 B EN COMÚ`)).toBeUndefined();
  });

  it("no confon dos municipis amb les mateixes sigles", () => {
    // «CM», «AM» i «UP» es repeteixen a pobles que no tenen res a veure.
    expect(clauCandidatura(1, "AM")).not.toBe(clauCandidatura(2, "AM"));
    expect(clauCandidatura(12, "3 AM")).not.toBe(clauCandidatura(123, "AM"));
  });
});

describe("ordresDisponibles", () => {
  it("no ofereix ordenar per una xifra que no té ningú", () => {
    // Passa cada cop que J23 encara no s'ha passat: un botó «Renda per
    // persona» ordenaria 947 buits i deixaria la llista igual dient «de més
    // renda a menys», que és una pàgina que menteix sobre el que sap.
    const sense = conjunt.map((f) => ambX({ ...f, rn: null }));
    expect(ordresDisponibles(sense).map((o) => o.clau)).not.toContain("renda");
    const amb = ambRenda.map((f) => ambX(f));
    expect(ordresDisponibles(amb).map((o) => o.clau)).toContain("renda");
  });

  it("i el primer sempre hi és, que és el que la llista ja té escrit", () => {
    expect(ordresDisponibles([]).map((o) => o.clau)).toEqual(["pob", "nom"]);
  });

  it("«data-o» té una casella per cada ordre de xifra, sempre les mateixes, i l'any al final", () => {
    // Si «clausOrdre» i les posicions es podien desincronitzar, ordenar per
    // dones al ple hauria ordenat per actes sense petar enlloc.
    const dExifra = ORDRES.filter((o) => o.de === "xifra");
    expect(clausOrdre(ambX(fila("x"))).split("|")).toHaveLength(dExifra.length + 1);
    for (const [i, o] of dExifra.entries()) expect(o.i).toBe(i);
    expect(POSICIO_ANY_RENDA).toBe(dExifra.length);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// La fila lleugera, el filtre de la llista i «?partit=»
// ───────────────────────────────────────────────────────────────────────────

describe("la fila lleugera", () => {
  const files = ambRenda.map((f, i) => ({ ...f, w: i % 4 === 0 ? (0 as const) : (1 as const), o: i % 5 === 0 ? (1 as const) : (0 as const) }));
  const html = renderEls947(files, "2026-08-30", new Set(files.map((f) => f.s)));

  it("només escriu la línia de pastilles quan n'hi ha alguna", () => {
    const ambPastilla = files.filter((f) => f.w === 0 || f.k === 1 || f.m === 1).length;
    expect(ambPastilla).toBeGreaterThan(0);
    expect(ambPastilla).toBeLessThan(files.length);
    expect(html.match(/<p class="dades">/g) ?? []).toHaveLength(ambPastilla);
    expect(html).not.toContain('<p class="dades"></p>');
  });

  it("cap fila no porta més de tres pastilles escrites", () => {
    for (const dades of html.match(/<p class="dades">[^\n]*<\/p>/g) ?? []) {
      expect((dades.match(/class="pastilla /g) ?? []).length).toBeLessThanOrEqual(3);
    }
  });

  it("el que ha deixat de ser pastilla continua sent filtre i ordre", () => {
    // «Una sola candidatura» i el deute per sobre de la mediana ja no s'escriuen
    // a la fila, però «data-f» els porta i la casella els troba.
    expect(html.match(/data-f="[^"]*\bunica\b[^"]*"/g) ?? []).toHaveLength(files.filter((f) => f.o === 1).length);
    expect(html).toContain('id="f-unica"');
    expect(html).toContain('id="o-deute"');
    expect(html).not.toContain("regidories</span>");
    expect(html).not.toContain("actes indexades</span>");
  });
});

describe("el filtre de la llista no és el cercador del web", () => {
  const html = renderEls947(conjunt, "2026-08-30", new Set());

  it("es diu «cerca-llista» i diu el que fa", () => {
    expect(html).toContain('<div class="cerca-llista">');
    expect(html).toContain('<label class="nomes-lectors" for="cerca">Filtra els 947</label>');
    expect(html).toContain('placeholder="Filtra la llista: esplugues, la seu…"');
    // I el diàleg compartit continua hi sent, amb el seu nom.
    expect(html).toContain('<dialog class="cercador"');
  });

  it("el CSS de la pàgina no toca «.cercador», que és el diàleg compartit", () => {
    // «.cercador{position:sticky}» i «.js .cercador{display:block}» agafaven
    // també el diàleg de la capçalera i el pintaven tancat, clavat a dalt.
    const css = cssPropi(html);
    expect(css).not.toContain(".cercador{");
    expect(css).not.toContain(".cercador ");
    expect(css).toContain(".cerca-llista{position:sticky");
    expect(css).toContain(".js .cerca-llista{display:block}");
    // I el compartit sí que hi és, un cop, al full de tots.
    expect(RADIOGRAFIA_CSS).toContain(".cercador{");
  });
});

describe("«?partit=»: on mana cada marca", () => {
  const files = [
    fila("a", { a: "Una", g: "PSC-CP", b: "psc" }),
    fila("b", { a: "Dues", g: "ERC-AM", b: "erc" }),
    fila("c", { a: "Tres", g: "AGRUPACIÓ D'ELECTORS", b: "local" }),
    fila("d", { a: null, g: null, b: null }),
  ];
  const html = renderEls947(files, "2026-08-30", new Set());

  it("cada fila diu de quina marca és l'alcaldia, amb el mateix identificador que la pastilla enllaça", () => {
    expect(html).toContain('data-b="psc"');
    expect(html).toContain('data-b="erc"');
    expect(html.match(/ data-b="/g) ?? []).toHaveLength(files.length);
    // Una llista local no té pàgina i no és cap marca: va buida, com la pastilla que no enllaça.
    expect(html).not.toContain('data-b="local"');
    expect(html.match(/ data-b=""/g) ?? []).toHaveLength(2);
  });

  it("el navegador llegeix «partit» de l'adreça, filtra per «data-b» i deixa treure-ho", () => {
    expect(html).toContain('new URLSearchParams(location.search).get("partit")');
    expect(html).toContain("marcaDe[i] !== partit");
    expect(html).toContain('<button class="nomes-partit" type="button" id="nomes-partit" hidden>');
    expect(html).toContain('"Només on mana " + nomPartit()');
    expect(html).toContain("history.replaceState");
    // El recompte ho diu, perquè «2 de 4 municipis» sense dir per què no és cap resposta.
    expect(html).toContain('" on mana " + nomPartit()');
  });

  it("porta el nom de cada marca que hi mana, i no els de les que no hi són", () => {
    expect(html).toContain('"psc":"Partit dels Socialistes de Catalunya"');
    expect(html).toContain('"erc":"Esquerra Republicana de Catalunya"');
    expect(html).not.toContain('"local":');
    expect(html).not.toContain('"cup":');
  });

  it("sense JavaScript la llista és sencera: el xip neix amagat i el filtre no talla res", () => {
    expect(html).toContain('id="nomes-partit" hidden');
    expect(cssPropi(html)).not.toContain('[data-b');
  });
});

describe("el sou de l'alcaldia, per al mapa", () => {
  it("només entra quan és un sou", () => {
    // «Sense dedicació» amb import són assistències a plens: comptar-les com
    // a sou faria semblar que hi ha alcaldies que cobren 180 € l'any per fer
    // d'alcalde, quan el que passa és que no en cobren cap.
    expect(souAlcaldia({ ministeri: { alcaldia: { regim: "Dedicació exclusiva", euros: 58000, mena: "sou" } } })).toBe(58000);
    expect(souAlcaldia({ ministeri: { alcaldia: { regim: "Sense dedicació", euros: 180, mena: "assistencies" } } })).toBeNull();
    expect(souAlcaldia({ ministeri: { alcaldia: { regim: "Sense dedicació", euros: 0, mena: "cap" } } })).toBeNull();
  });

  it("i sense fila al full, o sense la mètrica, és un forat i no un zero", () => {
    expect(souAlcaldia({ ministeri: { alcaldia: null } })).toBeNull();
    expect(souAlcaldia({ ministeri: null })).toBeNull();
    expect(souAlcaldia(undefined)).toBeNull();
    expect(souAlcaldia({ ministeri: { alcaldia: { euros: "58000", mena: "sou" } } })).toBeNull();
  });

  it("«retribucions» és a la llista del que la fila demana, que és el que fa que es llegeixi", () => {
    const { llegeix } = lectorDe(new Map([["retribucions", { ministeri: { alcaldia: { euros: 1, mena: "sou" } } }]]));
    expect(() => llegeix("retribucions")).not.toThrow();
    expect(souAlcaldia(llegeix("retribucions"))).toBe(1);
  });
});
