import { describe, expect, it } from "vitest";
import { DESCRIPCIO_MAXIMA, TITOL_MAXIM } from "./seo";
import {
  clauCandidatura,
  clauCerca,
  clausOrdre,
  ORDRES,
  ordresDisponibles,
  FILTRES,
  filtresDisponibles,
  codiTira,
  htmlTira,
  paletaTira,
  tiraCompacta,
  type TramCompacte,
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

  it("un municipi que ho toca tot porta totes les marques", () => {
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

  /*
   * La navegació és text subratllat i prou (vegeu «les pastilles» a estil.ts):
   * la fletxa «→» del final dels enllaços era un tic de plantilla. Es mira el
   * cos de la pàgina i no el full d'estil, que porta la fletxa de l'«abans → ara»
   * del balanç, que no és cap enllaç.
   */
  it("cap enllaç de la pàgina acaba amb la fletxa «→»", () => {
    expect(html.slice(html.indexOf("<body"))).not.toMatch(/→\s*<\/a>/);
    expect(html).toContain('<a class="prova-enllac" href="mapa/">Els mateixos 947, al mapa</a>');
    expect(html).toContain('rel="noopener">Ves a jugar a els947.cat</a>');
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
    expect(html).toContain(`Més deute per habitant que el municipi del mig (${l.deute!.toLocaleString("ca-ES")} €)`);
    expect(html).toContain(`Menys transparència que el municipi del mig (${l.transparencia} %)`);
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
    expect(p).toMatch(/<b class="sigla( llarga)?"/);
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
    expect(html).toContain("Renda per sota del municipi del mig (");
    expect(html).not.toContain("Hi entra menys de");
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

describe("el cap SEO dels 947", () => {
  const titolDe = (html: string): string => /<title>([^<]*)<\/title>/.exec(html)![1]!;
  const descripcioDe = (html: string): string => /<meta name="description" content="([^"]*)"/.exec(html)![1]!;
  const jsonLdDe = (html: string): Record<string, unknown>[] =>
    [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1]!));
  const filDe = (html: string): { name: string; item: string }[] =>
    (jsonLdDe(html).find((o) => o["@type"] === "BreadcrumbList")!.itemListElement as { name: string; item: string }[]);

  const html = renderEls947(conjunt, "2026-08-29", new Set(conjunt.map((f) => f.s)));

  it("compta els municipis al títol i els pactes i canvis a la descripció, sense escriure 947 a mà", () => {
    expect(titolDe(html)).toBe("Els 100 municipis, un per un · quivoto");
    expect(descripcioDe(html)).toBe(
      "Els 100 municipis de Catalunya en una llista: qui hi mana, els comptes i les actes del ple. A 0 governa qui no va guanyar i 0 han canviat d'alcaldia.",
    );
    expect(html).toContain('<link rel="canonical" href="https://quivoto.cat/observatori/els947.html">');
  });

  it("porta el fil d'Ariadna fins a la llista", () => {
    expect(filDe(html).map((i) => i.name)).toEqual(["quivoto", "Observatori municipal", "Els 100 municipis"]);
    expect(filDe(html)[2]!.item).toBe("https://quivoto.cat/observatori/els947.html");
  });

  it("és un ItemList amb tots els municipis que tenen fitxa, numerats i amb l'adreça de cadascun", () => {
    const llista = jsonLdDe(html).find((o) => o["@type"] === "ItemList")!;
    expect(llista.numberOfItems).toBe(100);
    const elements = llista.itemListElement as { position: number; name: string; url: string }[];
    expect(elements).toHaveLength(100);
    expect(elements[0]).toEqual({ "@type": "ListItem", position: 1, name: conjunt[0]!.n, url: `https://quivoto.cat/observatori/m/${conjunt[0]!.s}/` });
    // Sense fitxa, fora de la llista: el cercador no ha d'anar a una pàgina que no existeix.
    const menys = renderEls947(conjunt, "2026-08-29", new Set(conjunt.slice(1).map((f) => f.s)));
    expect((jsonLdDe(menys).find((o) => o["@type"] === "ItemList")!.itemListElement as unknown[]).length).toBe(99);
  });

  it("el títol i la descripció caben on el cercador els talla, i la descripció no s'ha hagut de retallar", () => {
    expect(titolDe(html).length).toBeLessThanOrEqual(TITOL_MAXIM);
    expect(descripcioDe(html).length).toBeLessThanOrEqual(DESCRIPCIO_MAXIMA);
    expect(descripcioDe(html).length).toBeGreaterThanOrEqual(70);
    expect(descripcioDe(html)).not.toMatch(/…$/);
  });

  it("té un sol <h1>", () => {
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Una pàgina més curta: el calaix de filtres i la fila d'una línia
// ───────────────────────────────────────────────────────────────────────────

/** Un node de mentida amb el que el guió de la pàgina toca, i res més. */
type NodeFals = {
  id: string;
  attrs: Record<string, string>;
  value: string;
  checked: boolean;
  hidden: boolean;
  open: boolean;
  textContent: string;
  classes: Set<string>;
  oients: Record<string, ((e?: unknown) => void)[]>;
  fills: NodeFals[];
  getAttribute(n: string): string | null;
  setAttribute(n: string, v: string): void;
  addEventListener(t: string, f: (e?: unknown) => void): void;
  querySelector(sel: string): NodeFals | null;
  querySelectorAll(sel: string): NodeFals[];
  appendChild(n: NodeFals): void;
  classList: { toggle(c: string, si?: boolean): void; contains(c: string): boolean };
};

function nodeFals(id = "", attrs: Record<string, string> = {}): NodeFals {
  const n: NodeFals = {
    id, attrs, value: attrs.value ?? "", checked: false, hidden: false, open: false, textContent: "",
    classes: new Set(), oients: {}, fills: [],
    getAttribute: (k) => (k in n.attrs ? n.attrs[k]! : null),
    setAttribute: (k, v) => { n.attrs[k] = v; },
    addEventListener: (t, f) => { (n.oients[t] ??= []).push(f); },
    querySelector: () => null,
    querySelectorAll: () => [],
    appendChild: (f) => { n.fills.push(...(f.fills.length ? f.fills : [f])); },
    classList: {
      toggle: (c, si) => { if (si ?? !n.classes.has(c)) n.classes.add(c); else n.classes.delete(c); },
      contains: (c) => n.classes.has(c),
    },
  };
  return n;
}

/**
 * Obre la pàgina amb un DOM de mentida i torna-hi els nodes que importen.
 *
 * Les files i les caselles es llegeixen de l'HTML de debò: si el guió i el que
 * s'escriu deixessin de coincidir —una casella que canvia de nom, una fila
 * sense «data-f»—, ho diria aquesta prova i no un lector a qui el filtre no
 * fa res.
 */
function obreEls947(html: string, ample = false) {
  const inici = html.indexOf("<script>\nconst norm");
  const script = html.slice(inici + 8, html.indexOf("</script>", inici));
  const files = [...html.matchAll(/<li class="fila" data-k="([^"]*)" data-f="([^"]*)" data-o="([^"]*)" data-b="([^"]*)"(?: data-t="([^"]*)")?>/g)]
    .map((m) => {
      const f = nodeFals("", { "data-k": m[1]!, "data-f": m[2]!, "data-o": m[3]!, "data-b": m[4]!, ...(m[5] ? { "data-t": m[5] } : {}) });
      (f as unknown as { insertAdjacentHTML(p: string, h: string): void }).insertAdjacentHTML = (_p, h) => { f.textContent += h; };
      const pastilla = nodeFals();
      f.querySelector = () => pastilla;
      return f;
    });
  const caselles = [...html.matchAll(/type="checkbox" id="f-([a-z]+)" value="([a-z]+)"/g)].map((m) =>
    nodeFals(`f-${m[1]}`, { value: m[2]!, type: "checkbox" }));
  const nodes: Record<string, NodeFals> = {};
  const tauler = nodeFals("tauler");
  tauler.querySelectorAll = (sel) => (sel === ".fila" ? files : sel.includes("checkbox") ? caselles : []);
  nodes.tauler = tauler;
  const fletxa = nodeFals();
  const document = {
    getElementById: (id: string) => (nodes[id] ??= (() => {
      const n = nodeFals(id);
      if (id === "capgira") { n.attrs["aria-pressed"] = "false"; n.querySelector = () => fletxa; }
      return n;
    })()),
    createDocumentFragment: () => nodeFals(),
  };
  const executa = new Function("document", "location", "history", "window", script);
  executa(
    document,
    { search: "", href: "https://quivoto.cat/observatori/els947.html" },
    { replaceState() {} },
    { matchMedia: () => ({ matches: ample }) },
  );
  const visibles = () => files.filter((f) => !f.classes.has("fora"));
  const canvia = () => for_each(tauler.oients.change, (f) => f());
  return { nodes, files, caselles, visibles, canvia };
}

function for_each<T>(xs: T[] | undefined, f: (x: T) => void): void {
  for (const x of xs ?? []) f(x);
}

describe("el calaix de filtres", () => {
  const files = ambRenda.map((f, i) => ({ ...f, m: i % 3 === 0 ? (1 as const) : (0 as const) }));
  const html = renderEls947(files, "2026-10-27", new Set(files.map((f) => f.s)));

  it("els filtres, l'ordre i la nota van dins d'un <details> plegat de sortida", () => {
    const calaix = html.slice(html.indexOf('<details class="calaix-947"'), html.indexOf("</details>"));
    expect(html).toContain('<details class="calaix-947" id="calaix">');
    expect(calaix).toContain('id="f-majoria"');
    expect(calaix).toContain('id="o-pob"');
    expect(calaix).toContain("El municipi del mig és el que queda al mig");
    // Tancat a l'HTML: sense JavaScript, al mòbil, la llista surt a la primera pantalla.
    expect(html).not.toContain('<details class="calaix-947" id="calaix" open');
    // El recompte i «Treu-ho tot» queden a fora, a la vista, encara que el calaix estigui tancat.
    expect(calaix).not.toContain('id="recompte"');
    expect(html.indexOf('id="recompte"')).toBeGreaterThan(html.indexOf("</details>"));
  });

  it("el resum fa 44 px i té el focus visible", () => {
    const css = cssPropi(html);
    expect(css).toMatch(/\.calaix-947-obre\{[^}]*min-height:44px/);
    expect(css).toContain(".calaix-947-obre:focus-visible{outline:3px solid var(--coral)");
    expect(css).toContain("prefers-reduced-motion:reduce");
  });

  it("«Amb radiografia» ja no hi és: la tenen tots 947 i no filtrava res", () => {
    expect(html).not.toContain("Amb radiografia");
    expect(html).not.toContain('id="f-fitxa"');
    expect(FILTRES_CLAUS()).not.toContain("fitxa");
  });

  it("cap etiqueta de filtre no diu «mediana»: diu «el municipi del mig»", () => {
    const etiquetes = [...html.matchAll(/<label class="filtre"[^>]*>([^<]*)/g)].map((m) => m[1]!);
    expect(etiquetes.length).toBeGreaterThan(5);
    for (const e of etiquetes) expect(e).not.toMatch(/mediana/i);
    expect(etiquetes.filter((e) => e.includes("municipi del mig")).length).toBe(3);
    expect(etiquetes.some((e) => e.startsWith("Renda per sota del municipi del mig"))).toBe(true);
    expect(etiquetes.some((e) => e.includes("per habitant"))).toBe(true);
  });

  it("marcar un filtre amaga les files que no el porten, i el resum diu quants n'hi ha de marcats", () => {
    const p = obreEls947(html);
    expect(p.visibles()).toHaveLength(files.length);
    expect(p.nodes["filtra-n"]!.hidden).toBe(true);
    p.caselles.find((c) => c.id === "f-majoria")!.checked = true;
    p.canvia();
    const amb = files.filter((f) => f.m === 1).length;
    expect(p.visibles()).toHaveLength(amb);
    expect(p.nodes["filtra-n"]!.hidden).toBe(false);
    expect(p.nodes["filtra-n"]!.textContent).toBe("1 actiu");
    expect(p.nodes.recompte!.textContent).toBe(`${amb} de ${files.length} municipis, ${ORDRES[0]!.avall}`);
    // Dos filtres alhora es combinen, i el resum en diu dos.
    p.caselles.find((c) => c.id === "f-petits")!.checked = true;
    p.canvia();
    expect(p.nodes["filtra-n"]!.textContent).toBe("2 actius");
    expect(p.visibles().length).toBe(files.filter((f) => f.m === 1 && f.p < 1000).length);
  });

  it("el filtre de text continua trobant pel nom, i el comptador de cada casella diu quants quedarien", () => {
    const p = obreEls947(html);
    p.nodes.cerca!.value = "Municipi 1";
    for_each(p.nodes.cerca!.oients.input, (f) => f());
    // «municipi 1», «municipi 10» … «municipi 19»: onze.
    expect(p.visibles()).toHaveLength(11);
    const ambMajoria = p.visibles().filter((f) => f.attrs["data-f"]!.split(" ").includes("majoria")).length;
    expect(p.nodes["q-majoria"]!.textContent).toBe(`(${ambMajoria})`);
  });

  it("a una pantalla ampla el calaix s'obre sol; al mòbil es queda tancat", () => {
    expect(obreEls947(html, true).nodes.calaix!.open).toBe(true);
    expect(obreEls947(html, false).nodes.calaix!.open).toBe(false);
  });
});

describe("la fila d'una línia al mòbil", () => {
  const html = renderEls947(ambRenda, "2026-10-27", new Set(ambRenda.map((f) => f.s)));
  const css = cssPropi(html);
  const mobil = css.slice(css.indexOf("@media (max-width:640px){"));

  it("la fila és una línia de 56 px: nom, habitants, cara i sigla", () => {
    expect(mobil).toContain(".fila{display:flex;align-items:center;gap:0 10px;padding:6px 0;min-height:56px}");
    expect(mobil).toContain(".fila .lloc,.fila .dades{display:none}");
  });

  it("el nom de l'alcaldia s'amaga a la vista però no al lector de pantalla", () => {
    expect(mobil).toMatch(/\.fila \.mana \.qui-mana\{position:absolute;width:1px;height:1px;overflow:hidden/);
    expect(mobil).not.toMatch(/\.qui-mana\{display:none/);
  });

  it("una sigla llarga es talla en una línia i no desborda la pantalla", () => {
    const regla = mobil.slice(mobil.indexOf(".fila .mana .sigla{"), mobil.indexOf("}", mobil.indexOf(".fila .mana .sigla{")));
    expect(regla).toContain("text-overflow:ellipsis");
    expect(regla).toContain("max-width:8.5em");
    expect(regla).toContain("min-height:30px");
  });

  it("el nom del municipi continua sent un objectiu de 44 px", () => {
    expect(css).toMatch(/\.fila \.municipi\{[^}]*min-height:44px/);
    expect(mobil).not.toMatch(/\.fila \.municipi\{[^}]*min-height:(?!44)/);
  });
});

/** Les claus de tots els filtres que la pàgina sap fer, encara que el conjunt no els aguanti. */
function FILTRES_CLAUS(): string[] {
  return FILTRES.map((f) => f.clau);
}

// ───────────────────────────────────────────────────────────────────────────
// La tira d'alcaldies de cada fila
// ───────────────────────────────────────────────────────────────────────────

describe("la tira d'alcaldies a cada fila", () => {
  /** Dotze mandats del mateix partit, amb un relleu a Junts a mig mandat del 2015 i el futur del mandat en curs. */
  const tipica = (familia: string, altra: string): TramCompacte[][] => [
    ...Array.from({ length: 9 }, (): TramCompacte[] => [["a", familia, 0]]),
    [["a", familia, 0], ["a", altra, 0.48]],
    [["a", altra, 0]],
    [["a", altra, 0], ["f", null, 0.84]],
  ];
  const files947 = ambRenda.map((f, i) => ({ ...f, tp: i % 7 === 0 ? null : tipica(i % 2 ? "psc" : "erc", "junts") }));
  const html = renderEls947(files947, "2026-10-27", new Set(files947.map((f) => f.s)));
  const paleta = paletaTira(files947);

  it("la paleta dona una lletra a cada família, una sola vegada, amb el color de la seva marca", () => {
    expect([...paleta.keys()]).toEqual(["erc", "junts", "psc"]);
    expect(paleta.get("erc")!.lletra).toBe("A");
    expect(paleta.get("psc")!.color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(html).toContain(`const COLORS_TIRA = {"A":"${paleta.get("erc")!.color}"`);
  });

  it("cada mandat és una lletra, i cada relleu, la desena on comença i qui entra", () => {
    expect(codiTira(tipica("psc", "junts"), paleta)).toBe("CCCCCCCCCC5BBB8~");
    expect(codiTira([[["b", null, 0]], [["b", null, 0], ["a", "cup", 0.3]]], paleta)).toBe("__3x");
  });

  it("del codi en surt la mateixa tira de «tira-poble.ts», amb les seves classes i sense lectura de pantalla", () => {
    const colors = { A: "#e30613" };
    const tira = htmlTira("AA5_", colors);
    expect(tira.startsWith('<span class="tp tp-fina tira-947" aria-hidden="true">')).toBe(true);
    expect(tira.match(/class="tp-mandat"/g)).toHaveLength(2);
    expect(tira).toContain('<span class="tp-tram" style="width:100%;--c:#e30613"></span>');
    expect(tira).toContain('<span class="tp-tram" style="width:50%;--c:#e30613"></span><span class="tp-tram tp-buit" style="width:50%"></span>');
    // Funciona sola, com al navegador.
    const sola = new Function("return (" + String(htmlTira) + ")")() as typeof htmlTira;
    expect(sola("AA5_", colors)).toBe(tira);
  });

  it("de l'historial de la fitxa a la fila: alcaldia, buit i futur, amb on comença cada tros", () => {
    const tp = tiraCompacta({
      municipi: "X",
      mandats: [
        { term: "1979-1983", inici: 1979, fi: 1983, trams: [{ tipus: "buit", de: 0, fins: 1 }] },
        { term: "2023-2027", inici: 2023, fi: 2027, trams: [
          { tipus: "alcaldia", nom: "A", partit: "PSC", familia: "psc", color: "#e30613", desDe: null, de: 0, fins: 0.8, relleu: false, posicioAproximada: false, font: "generalitat" },
          { tipus: "futur", de: 0.8, fins: 1 },
        ] },
      ],
    });
    expect(tp).toEqual([[["b", null, 0]], [["a", "psc", 0], ["f", null, 0.8]]]);
  });

  it("la pinta el navegador: el guió afegeix la tira a cada fila que en porta", () => {
    const p = obreEls947(html);
    const ambCodi = p.files.filter((f) => f.attrs["data-t"]);
    expect(ambCodi).toHaveLength(files947.filter((f) => f.tp).length);
    for (const f of ambCodi) expect(f.textContent).toContain('class="tp tp-fina tira-947"');
    expect(p.files.filter((f) => !f.attrs["data-t"]).every((f) => !f.textContent.includes("tira-947"))).toBe(true);
  });

  it("sense historial no hi ha ni tira, ni CSS de la tira, ni nota que l'expliqui", () => {
    const sense = renderEls947(ambRenda, "2026-10-27", new Set());
    expect(sense).not.toContain("data-t=");
    expect(sense).not.toContain(".tp-fina{");
    expect(sense).not.toContain("La franja de sota cada municipi");
    expect(html).toContain("La franja de sota cada municipi");
  });

  it("pesa poc: uns vint-i-cinc bytes per fila, i no un quilobyte de <span>", () => {
    const sense = renderEls947(files947.map((f) => ({ ...f, tp: null })), "2026-10-27", new Set(files947.map((f) => f.s)));
    const perFila = (html.length - sense.length) / files947.length;
    // Inclou el CSS de la tira, la nota i el guió, repartits entre només 100 files.
    expect(perFila).toBeLessThan(60);
    const nomesAtributs = (html.match(/ data-t="[^"]*"/g) ?? []).join("").length / files947.filter((f) => f.tp).length;
    expect(nomesAtributs).toBeLessThan(28);
  });
});
