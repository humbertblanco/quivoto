import { describe, expect, it } from "vitest";
import { DESCRIPCIO_MAXIMA, TITOL_MAXIM } from "./seo";
import {
  TRAJECTORIA_CSS,
  barresDurades,
  barresFamilia,
  barresRelleus,
  calculaHistorial,
  decades,
  fitxaAlcaldia,
  fitxaDe,
  fitxaPersona,
  inicisDeMandat,
  llistaDestins,
  llistaLongeus,
  llistaMunicipisRelleus,
  ocupacions,
  inicialCognom,
  PAS_GENT,
  percent,
  renderTrajectoriaElectes,
  type FilaHistorial,
  type HistorialAlcaldies,
  type MunicipiBasic,
  type SaltPersona,
  type SaltWikidata,
  type TrajectoriaData,
} from "./trajectoria-electes";
import type { Retrat } from "./fotos-wikidata";

/**
 * Les proves de l'historial van amb un poble sintètic de tres municipis, prou
 * petit per comptar-ho a mà: una alcaldia de nou mandats, un poble que canvia
 * de persona a cada mandat i té dos relleus, i un tercer amb un relleu dins
 * del mateix partit. Les xifres del salt són les de l'extracció real del
 * 30-08-2026: 2.917 persones a Wikidata, 284 amb un càrrec per sobre de
 * l'ajuntament.
 */

const TERMES = [
  "1979-1983", "1983-1987", "1987-1991", "1991-1995", "1995-1999", "1999-2003",
  "2003-2007", "2007-2011", "2011-2015", "2015-2019", "2019-2023", "2023-2027",
];

const MUNICIPIS = new Map<number, MunicipiBasic>([
  [1, { slug: "poble-a", nom: "Poble A" }],
  [2, { slug: "poble-b", nom: "Poble B" }],
  [3, { slug: "poble-c", nom: "Poble C" }],
]);

const fila = (municipalityId: number, term: string, name: string, partyRaw: string | null, tookOfficeOn: string | null = null): FilaHistorial =>
  ({ municipalityId, term, name, partyRaw, tookOfficeOn });

/** El dia de constitució de cada mandat, com el dona la font per a algun poble. */
const constitucio = (term: string): string => `${term.slice(0, 4)}-06-17`;

const FILES: FilaHistorial[] = [
  // Poble A: nou mandats de Joan Roig, escrit de dues maneres, i tres de Maria Puig, que hi és avui.
  ...TERMES.slice(0, 9).map((t, i) => fila(1, t, i < 5 ? "JOAN ROIG I CASTELL" : "Joan Roig Castell", "CiU", constitucio(t))),
  ...TERMES.slice(9).map((t) => fila(1, t, "Maria Puig Serra", "ERC", constitucio(t))),
  // Poble B: una persona per mandat, amb dos relleus: el 2007-2011 amb canvi
  // de color, i el mandat en curs amb una alcaldia que arriba tard.
  ...TERMES.slice(0, 11).map((t, i) => fila(2, t, `Persona ${i} B`, i % 2 === 0 ? "PSC" : "CiU", constitucio(t))),
  fila(2, "2007-2011", "Substitut Colomer", "ERC", "2009-03-01"),
  fila(2, "2023-2027", "Tard Arribat", "Junts", "2024-10-15"),
  // Poble C: un relleu dins del mateix partit el 1991-1995, i la resta sense data.
  ...TERMES.map((t) => fila(3, t, t < "2003" ? "Pere Vila" : "Anna Coll", "ERC")),
  fila(3, "1991-1995", "Jordi Mas", "ERC", "1993-05-05"),
];

const ACTUALS = new Map([[1, { clau: "maria puig serra", adreca: "regidor/maria-puig-serra/" }]]);

const HISTORIAL = calculaHistorial(FILES, MUNICIPIS, { avui: "2026-08-30", actuals: ACTUALS })!;

// ─────────────────────────────────────────────────────────────────────────────

describe("percent", () => {
  it("escriu el tant per cent a la catalana i sense decimals inútils", () => {
    expect(percent(284, 2_917)).toBe("9,7 %");
    expect(percent(272, 284)).toBe("96 %");
    expect(percent(0, 10)).toBe("0,0 %");
    expect(percent(1, 0)).toBe("—");
  });
});

describe("on porta cada nom", () => {
  /**
   * La convenció de la fitxa d'alcaldia històrica, feta prova: el slug surt
   * del nom tal com el publiquem, no tal com el crida la font.
   */
  it("la fitxa històrica es diu pel nom llegible, en slug", () => {
    expect(fitxaAlcaldia("poble-a", "JOAN ROIG I CASTELL")).toBe("../m/poble-a/alcaldia/joan-roig-i-castell/");
    expect(fitxaAlcaldia("poble-a", "Josep Sánchez I Camps")).toBe("../m/poble-a/alcaldia/josep-sanchez-i-camps/");
  });

  it("qui té l'alcaldia avui i fitxa de regidor va a la de regidor, i ningú més", () => {
    const muni = { slug: "poble-a", nom: "Poble A" };
    const actual = { clau: "maria puig serra", adreca: "regidor/maria-puig-serra/" };
    expect(fitxaDe(muni, "MARIA PUIG I SERRA", actual)).toBe("../m/poble-a/regidor/maria-puig-serra/");
    expect(fitxaDe(muni, "Joan Roig Castell", actual)).toBe("../m/poble-a/alcaldia/joan-roig-castell/");
    expect(fitxaDe(muni, "Maria Puig Serra", null)).toBe("../m/poble-a/alcaldia/maria-puig-serra/");
  });
});

describe("calculaHistorial", () => {
  it("compta les persones per municipi, i una persona escrita de dues maneres és una", () => {
    // Poble A: 2 · Poble B: 11 + 2 relleus = 13 · Poble C: 3
    expect(HISTORIAL.persones).toBe(18);
    expect(HISTORIAL.municipis).toBe(3);
    expect(HISTORIAL.municipisTotal).toBe(3);
    expect(HISTORIAL.primerMandat).toBe("1979-1983");
    expect(HISTORIAL.mandatActual).toBe("2023-2027");
    expect(HISTORIAL.mandats).toBe(12);
  });

  it("reparteix la gent per mandats i marca qui encara hi és", () => {
    const trams = Object.fromEntries(HISTORIAL.durades.map((d) => [d.mandats, d]));
    // Un mandat: els 13 del poble B i Jordi Mas. Avui hi és Tard Arribat.
    expect(trams[1]).toMatchObject({ etiqueta: "Un mandat", persones: 14, enCurs: 1 });
    expect(trams[2]).toMatchObject({ persones: 0, enCurs: 0 });
    // Tres mandats: Maria Puig, que hi és avui.
    expect(trams[3]).toMatchObject({ etiqueta: "Tres mandats", persones: 1, enCurs: 1 });
    // Quatre o més: Joan Roig (9), Pere Vila (6) i Anna Coll (6, i hi és avui).
    expect(trams[4]).toMatchObject({ etiqueta: "Quatre o més", persones: 3, enCurs: 1 });
    expect(HISTORIAL.repeteixen).toBe(4);
    expect(HISTORIAL.actuals).toBe(3);
  });

  it("els més longeus van per anys, amb el nom llegible i la fitxa que toca", () => {
    const [primer, segon] = HISTORIAL.longeus;
    expect(primer).toMatchObject({
      nom: "Joan Roig Castell",
      mandats: 9,
      primerMandat: "1979-1983",
      ultimMandat: "2011-2015",
      actual: false,
      fitxa: "../m/poble-a/alcaldia/joan-roig-castell/",
    });
    // Del 17-06-1979 al 17-06-2015: trenta-sis anys.
    expect(primer!.anys).toBe(36);
    expect(segon!.mandats).toBe(6);
    // Qui té l'alcaldia avui compta fins avui i porta a la fitxa de regidor.
    const maria = HISTORIAL.longeus.find((p) => p.nom === "Maria Puig Serra")!;
    expect(maria.actual).toBe(true);
    expect(maria.fitxa).toBe("../m/poble-a/regidor/maria-puig-serra/");
    expect(maria.anys).toBeCloseTo(11.2, 1);
  });

  /**
   * Els relleus es compten amb la regla de `derive/mayor-changes.ts`, no amb
   * una de nova: un mandat amb dues persones, o una de sola que arriba molt
   * després del ple de constitució.
   */
  it("compta els relleus per mandat amb la regla de la fitxa municipal", () => {
    const per = Object.fromEntries(HISTORIAL.relleus.map((r) => [r.term, r]));
    expect(per["2007-2011"]).toMatchObject({ municipis: 1, ambCanviDeColor: 1, nomesSuccessor: 0 });
    expect(per["1991-1995"]).toMatchObject({ municipis: 1, ambCanviDeColor: 0 });
    expect(per["2023-2027"]).toMatchObject({ municipis: 1, ambCanviDeColor: 0, nomesSuccessor: 1 });
    expect(per["1979-1983"]).toMatchObject({ municipis: 0 });
    expect(HISTORIAL.totalRelleus).toBe(3);
    expect(HISTORIAL.totalAmbCanviDeColor).toBe(1);
    expect(HISTORIAL.municipisAmbMesRelleus[0]).toMatchObject({ slug: "poble-b", relleus: 2, ambCanviDeColor: 1 });
  });

  it("sense cap fila no hi ha historial, i les files de municipis desconeguts no compten", () => {
    expect(calculaHistorial([], MUNICIPIS, { avui: "2026-08-30" })).toBeNull();
    expect(calculaHistorial([fila(99, "2023-2027", "Ningú", null)], MUNICIPIS, { avui: "2026-08-30" })).toBeNull();
  });

  it("el dia de constitució surt de la font, i si no en dona cap, de mitjan juny", () => {
    const inicis = inicisDeMandat([
      fila(1, "2019-2023", "A", null, "2019-06-15"),
      fila(2, "2019-2023", "B", null, "2019-06-20"),
      fila(3, "1979-1983", "C", null),
    ]);
    expect(inicis.get("2019-2023")).toBe("2019-06-15");
    expect(inicis.get("1979-1983")).toBe("1979-06-15");
  });
});

describe("les barres de l'historial", () => {
  it("les durades van a la mateixa escala i diuen qui encara hi és", () => {
    const html = barresDurades(HISTORIAL.durades, HISTORIAL.persones);
    expect(html).toContain("width:100.0%");
    expect(html).toContain("<b>14</b> 78 %");
    expect(html).toContain("<small>1 encara hi és</small>");
    expect(html).toContain("Sobre les 18 persones");
    // El tram buit no desapareix: una barra a zero és una dada.
    expect(html).toContain("Dos mandats");
    expect(barresDurades(HISTORIAL.durades, 0)).toBe("");
  });

  it("els longeus enllacen la persona i el municipi, i diuen anys i mandats", () => {
    const html = llistaLongeus(HISTORIAL.longeus);
    expect(html).toContain('<a href="../m/poble-a/alcaldia/joan-roig-castell/">Joan Roig Castell</a>');
    expect(html).toContain('<a href="../m/poble-a/">Poble A</a> · 1979–2015');
    expect(html).toContain("36 anys<small>9 mandats</small>");
    expect(html).toContain('<a href="../m/poble-a/regidor/maria-puig-serra/">Maria Puig Serra</a>');
    expect(html).toContain("2015–avui");
    expect(llistaLongeus([])).toBe("");
  });

  it("els relleus marquen el mandat en curs i el canvi de color", () => {
    const html = barresRelleus(HISTORIAL.relleus, HISTORIAL.mandatActual, HISTORIAL.municipis);
    expect(html).toContain("2007–2011");
    expect(html).toContain("1 amb canvi de color");
    expect(html).toContain("<small>en curs</small>");
    expect(html).toContain("Sobre els 3 municipis");
    expect(barresRelleus(HISTORIAL.relleus.map((r) => ({ ...r, municipis: 0 })), "2023-2027", 3)).toBe("");
  });

  it("la llista de municipis amb més relleus només porta els que en tenen dos o més", () => {
    const html = llistaMunicipisRelleus(HISTORIAL.municipisAmbMesRelleus);
    expect(html).toContain('<a href="../m/poble-b/#alcaldies">Poble B</a>');
    expect(html).toContain("2 mandats amb relleu, 1 amb canvi de color");
    expect(html).not.toContain("Poble C");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

const persona = (extra: Partial<SaltPersona> = {}): SaltPersona => ({
  qid: "Q76350582",
  url: "https://www.wikidata.org/wiki/Q76350582",
  nom: "Josep Pujadas i Maspons",
  viquipedia: "https://ca.wikipedia.org/wiki/Josep_Pujadas_i_Maspons",
  municipis: [{ nom: "Granollers", slug: "granollers" }],
  primerAny: 1986,
  ultimAny: 2004,
  families: ["parlament"],
  carrecs: [{ nom: "diputat al Parlament de Catalunya", familia: "parlament", inici: "1995-10-01", fi: "1999-09-01" }],
  ocupacions: ["advocat"],
  aparellat: true,
  fitxa: "../m/granollers/regidor/josep-pujadas-i-maspons/",
  foto: "/observatori/fotos/160/8096.webp",
  retrat: null,
  ...extra,
});

/** El retrat de Commons d'un exalcalde, tal com J28 el desa. */
const RETRAT: Retrat = {
  nom: "Josep Pujadas i Maspons",
  cami: "/observatori/fotos/wikimedia/Q76350582.jpg",
  fitxer: "File:Josep Pujadas.jpg",
  paginaFitxer: "https://commons.wikimedia.org/wiki/File:Josep_Pujadas.jpg",
  autor: "Davidpar",
  llicencia: { nom: "CC BY-SA 4.0", url: "https://creativecommons.org/licenses/by-sa/4.0" },
  amplada: 240,
  alcada: 320,
};

const SALT: SaltWikidata = {
  font: "Wikidata (wikidata.org)",
  fontUrl: "https://query.wikidata.org/sparql",
  llicencia: "CC0 1.0",
  descarregat: "2026-08-30",
  totalPersones: 2_917,
  aparellades: 1_900,
  ambSalt: 284,
  municipisAmbSalt: 195,
  families: [
    { clau: "parlament", etiqueta: "Parlament de Catalunya", frase: "al Parlament de Catalunya", persones: 213 },
    { clau: "congres", etiqueta: "Congrés dels Diputats", frase: "al Congrés dels Diputats", persones: 46 },
    { clau: "senat", etiqueta: "Senat", frase: "al Senat", persones: 46 },
    { clau: "diputacio", etiqueta: "Presidència de diputació", frase: "a la presidència d'una diputació", persones: 29 },
    { clau: "govern", etiqueta: "Govern", frase: "al Govern", persones: 36 },
    { clau: "europeu", etiqueta: "Parlament Europeu", frase: "al Parlament Europeu", persones: 3 },
  ],
  decades: [
    { decada: 1970, alcaldes: 310, ambSalt: 29 },
    { decada: 1980, alcaldes: 309, ambSalt: 54 },
    { decada: 1990, alcaldes: 405, ambSalt: 68 },
    { decada: 2000, alcaldes: 512, ambSalt: 53 },
    { decada: 2010, alcaldes: 958, ambSalt: 65 },
    { decada: 2020, alcaldes: 423, ambSalt: 15 },
  ],
  ocupacions: [
    { nom: "empresari", quants: 68 },
    { nom: "professor", quants: 57 },
    { nom: "advocat", quants: 50 },
  ],
  ambOcupacio: 603,
  ambViquipediaSalt: 272,
  ambViquipediaSenseSalt: 341,
};

/** Un historial amb les mides de debò, per a les frases d'entrada i el cap. */
const HISTORIAL_GRAN: HistorialAlcaldies = {
  ...HISTORIAL,
  persones: 6_400,
  municipis: 947,
  municipisTotal: 947,
  durades: [
    { mandats: 1, etiqueta: "Un mandat", persones: 3_100, enCurs: 400 },
    { mandats: 2, etiqueta: "Dos mandats", persones: 1_700, enCurs: 250 },
    { mandats: 3, etiqueta: "Tres mandats", persones: 900, enCurs: 150 },
    { mandats: 4, etiqueta: "Quatre o més", persones: 700, enCurs: 147 },
  ],
  repeteixen: 3_300,
  actuals: 947,
  totalRelleus: 512,
  totalAmbCanviDeColor: 140,
};

const DADES: TrajectoriaData = {
  historial: HISTORIAL_GRAN,
  salt: SALT,
  persones: [
    persona(),
    persona({
      qid: "Q9999",
      nom: "Maria Roig",
      families: ["senat"],
      viquipedia: null,
      aparellat: false,
      primerAny: 2015,
      ultimAny: 2015,
      carrecs: [{ nom: "senador al Senat espanyol", familia: "senat", inici: "2019-05-21", fi: null }],
      ocupacions: [],
      fitxa: "../m/granollers/#alcaldies",
      foto: null,
    }),
  ],
};

describe("barresFamilia", () => {
  const svg = barresFamilia(SALT.families, SALT.totalPersones);

  it("totes les barres comparteixen escala: la més gran omple i la petita no", () => {
    expect(svg).toContain("width:100.0%");
    // 3 sobre 213 és un 1,4 %, i el mínim visible és 1,5: el Parlament Europeu
    // no pot desaparèixer, però tampoc pot semblar més gran del que és.
    expect(svg).toContain("width:1.5%");
  });

  it("cada xifra va amb el seu denominador i explica per què les barres no sumen el total", () => {
    expect(svg).toContain("<b>213</b> 7,3 %");
    expect(svg).toContain("sobre les 2.917 persones");
    expect(svg).toContain("<b>Les barres no sumen 2.917</b>");
  });

  it("no dibuixa les famílies buides ni peta sense cap", () => {
    expect(barresFamilia(SALT.families.map((f) => ({ ...f, persones: 0 })), 2_917)).toBe("");
  });
});

describe("decades i ocupacions", () => {
  it("la sèrie porta les dues xifres, no només el percentatge", () => {
    const html = decades(SALT.decades);
    expect(html).toContain("<b>Anys 1980</b><span>54 de 309</span>");
    expect(html).toContain("<b>Anys 2010</b><span>65 de 958</span>");
  });

  it("una dècada sola no dona sèrie", () => {
    expect(decades([{ decada: 1980, alcaldes: 10, ambSalt: 2 }])).toBe("");
  });

  it("les ocupacions diuen de quants se'n sap i de quants no", () => {
    const html = ocupacions(SALT.ocupacions, SALT.ambOcupacio, SALT.totalPersones);
    expect(html).toContain("de les 603 persones que en declaren");
    expect(html).toContain("<b>De les altres 2.314, Wikidata no en té cap d'escrita</b>");
  });
});

describe("fitxaPersona", () => {
  it("enllaça la fitxa, el municipi i l'ítem d'origen, i porta el nom cercable", () => {
    const html = fitxaPersona(persona());
    expect(html).toContain('href="../m/granollers/regidor/josep-pujadas-i-maspons/"');
    expect(html).toContain('href="../m/granollers/"');
    expect(html).toContain('href="https://www.wikidata.org/wiki/Q76350582"');
    expect(html).toContain('data-nom="josep pujadas maspons"');
    expect(html).toContain("1986–2004");
    expect(html).toContain("Abans: advocat");
    expect(html).toContain("Viquipedia</a>");
  });

  it("qui no lliga amb el nostre historial ho porta escrit i va a l'historial del municipi", () => {
    const html = fitxaPersona(persona({ aparellat: false, fitxa: "../m/granollers/#alcaldies" }));
    expect(html).toContain("no lliga amb el nostre historial");
    expect(html).toContain('href="../m/granollers/#alcaldies"');
    expect(fitxaPersona(persona({ aparellat: true }))).not.toContain("no lliga amb el nostre");
  });

  it("un nom amb signes no es converteix en marques", () => {
    const html = fitxaPersona(persona({ nom: 'Anna <b>"Rius"</b> & Puig', viquipedia: null }));
    expect(html).toContain("Anna &lt;b&gt;&quot;Rius&quot;&lt;/b&gt; &amp; Puig");
  });

  /**
   * La política de fotografies, feta codi: primer el retrat oficial, després
   * el de Wikimedia Commons amb el crèdit a la vista, i si no, les inicials
   * de la cara de la casa.
   */
  it("el retrat oficial mana, i llavors no hi ha crèdit de Commons", () => {
    const html = fitxaPersona(persona({ retrat: RETRAT }));
    expect(html).toContain('class="cara-alcaldia petita"');
    expect(html).toContain('src="/observatori/fotos/160/8096.webp"');
    expect(html).not.toContain("wikimedia");
    expect(html).not.toContain("Foto:");
  });

  it("sense retrat oficial surt el de Commons, amb el crèdit al peu de la targeta", () => {
    const html = fitxaPersona(persona({ foto: null, retrat: RETRAT }));
    expect(html).toContain('src="/observatori/fotos/wikimedia/Q76350582.jpg"');
    expect(html).toContain('class="retrat retrat-wikimedia"');
    expect(html).toContain('width="56" height="56"');
    expect(html).toContain("Foto: Davidpar, ");
    expect(html).toContain('rel="license noopener nofollow">CC BY-SA 4.0</a>');
    expect(html).not.toContain('title="');
  });

  it("sense cap retrat hi van les inicials de la cara de la casa", () => {
    const html = fitxaPersona(persona({ foto: null, retrat: null }));
    expect(html).toContain('class="cara-alcaldia inicials petita"');
    expect(html).toContain(">JP</span>");
    expect(html).not.toContain("<img");
  });
});

describe("llistaDestins", () => {
  it("escriu els destins que de debò tenen algú, i cap més", () => {
    expect(llistaDestins(SALT.families)).toBe(
      "al Parlament de Catalunya, al Congrés dels Diputats, al Senat, " +
        "a la presidència d'una diputació, al Govern o al Parlament Europeu",
    );
    const sense = SALT.families.map((f) => (f.clau === "europeu" ? { ...f, persones: 0 } : f));
    expect(llistaDestins(sense)).not.toContain("Europeu");
    expect(llistaDestins(sense.map((f) => ({ ...f, persones: 0 })))).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("renderTrajectoriaElectes", () => {
  const html = renderTrajectoriaElectes(DADES, "30 d'agost del 2026");

  it("és una pàgina sencera amb la capçalera, la cerca i el peu compartits", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<html lang="ca">');
    expect(html).toContain('class="capcalera"');
    expect(html).toContain('class="cercador"');
    expect(html).toContain('<footer class="peu">');
    expect(html).toContain("Generat el 30 d'agost del 2026");
    expect(html.trimEnd().endsWith("</html>")).toBe(true);
  });

  /**
   * L'ordre és el de les preguntes: primer el que se sap de tothom —quant
   * duren, els relleus— i després el que només diu Wikidata.
   */
  it("respon les tres preguntes en aquest ordre, amb l'índex al davant", () => {
    const ordre = ['id="duren"', 'id="relleus"', 'id="despres"', 'id="gent"', 'id="font"'].map((s) => html.indexOf(s));
    expect(ordre.every((n) => n > 0)).toBe(true);
    expect([...ordre].sort((a, b) => a - b)).toEqual(ordre);
    expect(html).toContain('<a href="#duren">Quant duren</a>');
    expect(html).toContain('<a href="#relleus">Relleus a mig mandat</a>');
    expect(html).toContain('<a href="#despres">On van després</a>');
  });

  it("l'entrada porta la xifra forta amb el seu denominador i la font de cada part", () => {
    expect(html).toContain("<b>6.400 persones</b> han tingut l'alcaldia d'algun dels\n  947 municipis des del 1979");
    expect(html).toContain("3.100\n  (48 %) hi han estat un sol mandat i 3.300\n  n'han repetit");
    expect(html).toContain("a mig mandat 512 vegades");
    expect(html).toContain("l'historial de la Generalitat");
  });

  it("el salt es diu amb el denominador de Wikidata, i el biaix queda escrit", () => {
    expect(html).toContain("<b>284 de 2.917</b>");
    expect(html).toContain("dels 6.400 de\n  l'historial oficial");
    expect(html).toContain('<details class="nota" id="cobertura">');
    expect(html).toContain("cobreix molt millor la gent famosa");
    expect(html).toContain("96 % té article a la Viquipedia");
    expect(html).toMatch(/un\s+13 %/);
    expect(html).toContain("no hi ha cap rànquing de\n    municipis");
    expect(html).toContain("es mostren dades quan n'hi ha");
    expect(html).not.toContain("no ho sabem");
  });

  it("avisa que la baixada de les últimes dècades no és cap troballa", () => {
    expect(html).toContain("no vol dir que ara les carreres siguin");
    expect(html).toContain("vol dir que encara no han passat");
  });

  it("cita les dues fonts, amb la llicència i la data d'extracció de Wikidata", () => {
    expect(html).toContain("<b>Generalitat de Catalunya, historial d'alcaldies</b>");
    expect(html).toContain("Wikidata (wikidata.org)");
    expect(html).toContain("https://query.wikidata.org/sparql");
    expect(html).toContain("<b>CC0 1.0</b>");
    expect(html).toContain("el 30 d'agost del 2026");
  });

  it("sense J21, la pàgina surt igualment amb les dues primeres preguntes i ho diu", () => {
    const sense = renderTrajectoriaElectes({ historial: HISTORIAL_GRAN, salt: null, persones: [] }, "avui");
    expect(sense).toContain('id="duren"');
    expect(sense).toContain('id="relleus"');
    expect(sense).not.toContain('id="despres"');
    expect(sense).not.toContain('id="gent"');
    expect(sense).not.toContain('href="#despres"');
    expect(sense).toContain("encara no s'ha carregat");
    expect(sense.match(/<h1[\s>]/g)).toHaveLength(1);
  });

  it("la llista porta cerca i filtre, que neixen amagats, i cada fitxa les seves claus", () => {
    expect(html).toContain('<div class="filtra" hidden>');
    expect(html).toContain('<input type="search"');
    expect(html).toContain('data-familia="tots" aria-pressed="true"');
    expect(html).toContain('<li class="persona" data-families="parlament" data-nom="josep pujadas maspons" data-lletra="P">');
    expect(html).toContain('data-families="senat"');
    expect(html).toContain('<button type="button" data-familia="parlament" aria-pressed="false">');
  });

  /**
   * El filtre no anava: «.gent > li» d'estil.ts posa display:flex a cada
   * targeta i guanya al [hidden] del navegador. Aquesta prova lliga el guió,
   * els atributs de les targetes i la regla que fa valer el [hidden].
   */
  it("el guió toca exactament els atributs que porten les targetes, i el [hidden] val", () => {
    const guio = html.slice(html.lastIndexOf('<script>\n(function(){'));
    expect(guio).toContain('querySelectorAll("button[data-familia]")');
    expect(guio).toContain('querySelectorAll(".persona[data-families]")');
    expect(guio).toContain('querySelector("input[type=search]")');
    expect(guio).toContain('getAttribute("data-nom")');
    expect(guio).toContain("li.hidden = amaga");
    expect(guio).toContain('clau !== "tots"');
    // Les famílies es comparen senceres: «senat» no es busca dins de cap altre text.
    expect(guio).toContain('split(" ")');
    expect(guio).toContain("families.indexOf(clau) === -1");
    expect(TRAJECTORIA_CSS).toContain(".gent > .persona[hidden],.filtra[hidden]{display:none}");
  });

  it("el compte de la llista neix amb totes i el guió el refà a cada canvi", () => {
    expect(html).toContain('<p class="quants-gent" aria-live="polite">Es mostren les 2 persones.</p>');
    const guio = html.slice(html.lastIndexOf('<script>\n(function(){'));
    expect(guio).toContain('"Es mostren " + visibles + " de "');
    expect(guio).toContain('" trobades, de " + targetes.length');
    expect(guio).toContain('"Es mostren les " + visibles + " persones."');
  });

  it("el menú marca «Trajectòries» com la pàgina actual", () => {
    expect(html).toContain('<span class="ara" aria-current="page">Trajectòries</span>');
    expect(html).not.toContain('href="../trajectoria/">Trajectòries</a>');
  });

  it("diu quantes cares vénen de Commons, i no ho diu si cap", () => {
    expect(html).not.toContain("porten un retrat de");
    const ambRetrat = renderTrajectoriaElectes(
      { ...DADES, persones: [persona({ foto: null, retrat: RETRAT }), persona({ qid: "Q9999", foto: null })] },
      "30 d'agost del 2026",
    );
    expect(ambRetrat).toContain("1\n  porten un retrat de <b>Wikimedia Commons</b>");
    expect(ambRetrat).toContain("Foto: Davidpar");
  });

  it("enllaça les tipografies des d'un nivell avall, abans del full d'estil", () => {
    expect(html).toContain('href="../../assets/fonts.css"');
    expect(html.indexOf("fonts.css")).toBeLessThan(html.indexOf("<style>"));
  });

  it("el peu porta als partits, que és el que no hi ha a totes les pàgines", () => {
    expect(html).toContain('<a class="propi" href="../partit/">Els partits</a>');
    expect(html).not.toContain('class="propi" href="../mapa/"');
  });

  it("el full d'estil hi va sencer i sense cap accent greu", () => {
    expect(html).toContain(TRAJECTORIA_CSS);
    expect(TRAJECTORIA_CSS.length).toBeGreaterThan(500);
    expect(TRAJECTORIA_CSS).not.toContain("`");
  });
});

describe("el cap SEO de la trajectòria", () => {
  const titolDe = (html: string): string => /<title>([^<]*)<\/title>/.exec(html)![1]!;
  const descripcioDe = (html: string): string => /<meta name="description" content="([^"]*)"/.exec(html)![1]!;
  const jsonLdDe = (html: string): Record<string, unknown>[] =>
    [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1]!));
  const filDe = (html: string): { name: string; item: string }[] =>
    (jsonLdDe(html).find((o) => o["@type"] === "BreadcrumbList")!.itemListElement as { name: string; item: string }[]);

  const html = renderTrajectoriaElectes(DADES, "avui");

  it("porta les tres respostes amb els seus denominadors, i canònica", () => {
    expect(titolDe(html)).toBe("Quant duren els que manen · quivoto");
    expect(descripcioDe(html)).toBe(
      "Quants mandats duren les 6.400 persones amb alcaldia als 947 municipis des del 1979, 512 relleus a mig mandat i els 284 que han fet el salt.",
    );
    expect(html).toContain('<link rel="canonical" href="https://quivoto.cat/observatori/trajectoria/">');
  });

  it("sense J21 la descripció no promet cap salt", () => {
    const sense = renderTrajectoriaElectes({ historial: HISTORIAL_GRAN, salt: null, persones: [] }, "avui");
    expect(descripcioDe(sense)).not.toContain("salt");
    expect(descripcioDe(sense).endsWith("relleus a mig mandat.")).toBe(true);
  });

  it("porta el fil d'Ariadna fins a la pàgina", () => {
    expect(filDe(html).map((i) => i.name)).toEqual(["quivoto", "Observatori municipal", "Quant duren els que manen"]);
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
// «Qui són»: cerca primer, salt per lletra i de 24 en 24
// ───────────────────────────────────────────────────────────────────────────

describe("inicialCognom", () => {
  it("amb la «i» entre cognoms, el primer cognom és el d'abans", () => {
    expect(inicialCognom("Montserrat Candini i Puig")).toBe("C");
    expect(inicialCognom("Josep Maria Graells i Forcada")).toBe("G");
    expect(inicialCognom("Joan Roma i Cunill")).toBe("R");
  });

  it("un cognom amb «d'» va amb la paraula d'abans", () => {
    expect(inicialCognom("Josep Maria Vila d'Abadal i Serra")).toBe("V");
  });

  it("sense «i», la penúltima paraula, tret dels noms de pila compostos amb un sol cognom", () => {
    expect(inicialCognom("Román Ruiz Llamas")).toBe("R");
    expect(inicialCognom("Alfons Jaume Montserrat Esteller")).toBe("M");
    expect(inicialCognom("Joan Carles Garcia Guillamon")).toBe("G");
    expect(inicialCognom("Joan Maria Roig")).toBe("R");
    expect(inicialCognom("Maria Roig")).toBe("R");
  });

  it("treu els accents i, si no en surt cap lletra, torna «#»", () => {
    expect(inicialCognom("Pere Òdena i Puig")).toBe("O");
    expect(inicialCognom("Àngel Èrcules Roca")).toBe("E");
    expect(inicialCognom("")).toBe("#");
  });
});

type TargetaFalsa = { attrs: Record<string, string>; hidden: boolean; getAttribute(k: string): string | null };
type BotoFals = TargetaFalsa & { oients: (() => void)[]; setAttribute(k: string, v: string): void; addEventListener(t: string, f: () => void): void };

/** Executa el guió de «Qui són» amb un DOM de mentida fet de l'HTML de debò. */
function obreGent(html: string) {
  const inici = html.lastIndexOf("<script>\n(function(){");
  const script = html.slice(inici + 8, html.indexOf("</script>", inici));
  const boto = (attrs: Record<string, string>): BotoFals => {
    const b: BotoFals = {
      attrs, hidden: false, oients: [],
      getAttribute: (k) => b.attrs[k] ?? null,
      setAttribute: (k, v) => { b.attrs[k] = v; },
      addEventListener: (_t, f) => { b.oients.push(f); },
    };
    return b;
  };
  const targetes = [...html.matchAll(/<li class="persona" data-families="([^"]*)" data-nom="([^"]*)" data-lletra="([^"]*)">/g)]
    .map((m) => boto({ "data-families": m[1]!, "data-nom": m[2]!, "data-lletra": m[3]! }));
  const lletres = [...html.matchAll(/<button type="button" data-lletra="([^"]*)"/g)].map((m) => boto({ "data-lletra": m[1]! }));
  const families = [...html.matchAll(/<button type="button" data-familia="([^"]*)"/g)].map((m) => boto({ "data-familia": m[1]! }));
  const cerca = Object.assign(boto({}), { value: "" });
  const quants = { textContent: "" };
  const mes = Object.assign(boto({}), { textContent: "" });
  const caixa = {
    hidden: true,
    querySelectorAll: (sel: string) => (sel.includes("data-lletra") ? lletres : families),
    querySelector: () => cerca,
  };
  const gent = { querySelectorAll: () => targetes };
  const document = {
    querySelector: (sel: string) =>
      ({ ".filtra": caixa, ".gent": gent, ".quants-gent": quants, ".tj-mes": mes } as Record<string, unknown>)[sel] ?? null,
  };
  new Function("document", script)(document);
  const visibles = () => targetes.filter((t) => !t.hidden);
  const toca = (b: BotoFals) => { for (const f of b.oients) f(); };
  return { caixa, targetes, lletres, families, cerca, quants, mes, visibles, toca };
}

describe("«Qui són», de 24 en 24", () => {
  const cognoms = ["Puig", "Roca", "Serra", "Vila", "Font", "Mas", "Pons", "Riera"];
  const moltes = Array.from({ length: 60 }, (_, i) =>
    persona({ qid: `Q${i}`, nom: `Persona${i} ${cognoms[i % cognoms.length]} i Soler`, primerAny: 1980 + (i % 40), families: [i % 3 === 0 ? "senat" : "parlament"] }));
  const html = renderTrajectoriaElectes({ ...DADES, persones: moltes }, "avui");

  it("la cerca va primer, i després el salt per lletra i les famílies", () => {
    const filtra = html.slice(html.indexOf('<div class="filtra" hidden>'), html.indexOf('<p class="quants-gent"'));
    expect(filtra.indexOf('type="search"')).toBeLessThan(filtra.indexOf('data-lletra="totes"'));
    expect(filtra.indexOf('data-lletra="totes"')).toBeLessThan(filtra.indexOf('data-familia="tots"'));
  });

  it("només hi ha botó per a les lletres que tenen algú", () => {
    const lletres = [...html.matchAll(/data-lletra="([A-Z#])" aria-pressed/g)].map((m) => m[1]);
    expect(lletres).toEqual(["F", "M", "P", "R", "S", "V"]);
  });

  it("sense JavaScript la llista surt sencera; amb ell, se'n veuen 24 i un botó per a la resta", () => {
    expect(html.match(/<li class="persona"/g)).toHaveLength(60);
    expect(html).toContain('<button type="button" class="tj-mes" hidden></button>');
    const p = obreGent(html);
    expect(p.caixa.hidden).toBe(false);
    expect(p.visibles()).toHaveLength(PAS_GENT);
    expect(p.mes.hidden).toBe(false);
    expect(p.mes.textContent).toBe("Mostra'n 24 més (en queden 36)");
    expect(p.quants.textContent).toBe("Es mostren 24 de 60 persones.");
    p.toca(p.mes);
    p.toca(p.mes);
    expect(p.visibles()).toHaveLength(60);
    expect(p.mes.hidden).toBe(true);
    expect(p.quants.textContent).toBe("Es mostren les 60 persones.");
  });

  it("una lletra deixa només els seus, i torna a començar per la primera pàgina", () => {
    const p = obreGent(html);
    p.toca(p.mes);
    p.toca(p.lletres.find((b) => b.attrs["data-lletra"] === "S")!);
    const esses = moltes.filter((_, i) => cognoms[i % cognoms.length] === "Serra").length;
    expect(p.visibles()).toHaveLength(esses);
    expect(p.visibles().every((t) => t.attrs["data-lletra"] === "S")).toBe(true);
    expect(p.lletres.find((b) => b.attrs["data-lletra"] === "S")!.attrs["aria-pressed"]).toBe("true");
    expect(p.quants.textContent).toBe(`Es mostren ${esses} de ${esses} trobades, de 60 persones.`);
  });

  it("la cerca troba a totes les pàgines, no només a la primera", () => {
    const p = obreGent(html);
    p.cerca.value = "persona59";
    for (const f of p.cerca.oients) f();
    expect(p.visibles().map((t) => t.attrs["data-nom"])).toEqual(["persona59 vila soler"]);
  });

  it("cada lletra és un objectiu de 44 px, i la tira llisca de costat sense moure la pàgina", () => {
    expect(TRAJECTORIA_CSS).toMatch(/\.tj-lletres button\{min-width:44px;min-height:44px/);
    expect(TRAJECTORIA_CSS).toMatch(/\.tj-lletres\{[^}]*overflow-x:auto/);
    expect(TRAJECTORIA_CSS).toContain(".tj-mes[hidden]{display:none}");
  });
});
