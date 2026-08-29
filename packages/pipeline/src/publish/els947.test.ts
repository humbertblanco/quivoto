import { describe, expect, it } from "vitest";
import {
  clauCerca,
  filtresDisponibles,
  lectorDe,
  llindarsDe,
  marques,
  mediana,
  pastilles,
  renderEls947,
  type Els947Row,
  type Fila,
} from "./els947";

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
  const l = llindarsDe(conjunt);

  it("no repeteix qui mana: l'alcaldia té la seva pròpia línia i no és cap pastilla", () => {
    // Van ser una pastilla sola de 453px, després dues, i ara cap: el nom i les
    // sigles surten a la línia de dalt amb la cara i el color del partit. Si
    // algú els torna a posar aquí, sortiran dues vegades a cada fila.
    const p = pastilles(
      ambX(fila("x", { a: "Josep Maria Gras Charles", g: "AGRUPACIÓ D'ELECTORS-PROGRÉS MUNICIPAL" })),
      l,
    ).join(" ");
    expect(p).not.toContain("Josep Maria Gras Charles");
    expect(p).not.toContain("AGRUPACIÓ");
  });

  it("no diu res que sigui un judici de gestió", () => {
    const p = pastilles(ambX(fila("x", { d: 9999, y: 3, t: 0 })), l).join(" ");
    expect(p).not.toMatch(/malament|bé|pitjor|millor|suspèn|aprovat/i);
  });

  it("escapa el que ve de la base de dades", () => {
    expect(pastilles(ambX(fila("x", { d: 9999 })), l).join("")).not.toContain("<script>");
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
    expect(html).toContain('href="preguntes/"');
    expect(html).toContain('href="c/pallars-jussa/"');
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
