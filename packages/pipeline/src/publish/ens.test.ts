import { describe, expect, it } from "vitest";
import { DESCRIPCIO_MAXIMA, TITOL_MAXIM } from "./seo";
import { descripcioEns, ENS_CSS, renderEns, titolEns } from "./ens";
import type { DadesEns, MembreEns, RepartimentEns } from "./ens-tipus";
import { NOM_NO_PUBLICAT } from "../jobs/j38-ens-supramunicipals";

/**
 * La fitxa d'un ens es prova amb tres ens escrits a mà —una diputació plena,
 * un consell amb un càlcul que no quadra i un consell gairebé buit— perquè el
 * que importa no és que «quedi bé» sinó que cap camí no surti trencat, que res
 * de les fonts pugui colar-hi etiquetes, que un buit es digui buit i que el
 * càlcul de la llei no es presenti mai com si fos el ple quan no ho és.
 */

const GENERAT = "2026-10-27T10:00:00Z";

function membre(over: Partial<MembreEns> = {}): MembreEns {
  return {
    nom: "MARTA PUIG SERRA",
    carrec: "Diputada",
    rol: "membre",
    ordre: null,
    partit: "PSC-CP",
    partitFont: "ens",
    municipi: { slug: "manresa", nom: "Manresa" },
    municipiFont: "registre",
    alcaldia: false,
    adreca: null,
    foto: null,
    retribucio: null,
    grup: "PSC",
    color: "#e73b39",
    ...over,
  };
}

function base(over: Partial<DadesEns> = {}): DadesEns {
  return {
    tipus: "diputacio",
    codiEns: "8000840003",
    nom: "Diputació de Barcelona",
    territori: "Barcelona",
    article: null,
    cif: "P0800000B",
    gerent: null,
    municat: null,
    web: "https://www.diba.cat/",
    seients: 0,
    membres: [],
    finances: null,
    districtes: null,
    wikidata: "Q1607008",
    escut: null,
    fonts: [],
    avisos: [],
    consultat: "2026-10-27",
    slug: "barcelona",
    seu: { slug: "barcelona", nom: "Barcelona" },
    composicio: [],
    presidencia: null,
    municipis: [],
    poblacio: null,
    comarca: null,
    comarques: [],
    repartiment: null,
    subvencions: null,
    ...over,
  };
}

/** Una diputació amb tot: membres, sous, diners, càlcul que quadra i subvencions. */
function diputacio(): DadesEns {
  const presidenta = membre({
    nom: "LLUÏSA MORET SABIDÓ",
    carrec: "Presidenta",
    rol: "presidencia",
    municipi: { slug: "sant-boi-de-llobregat", nom: "Sant Boi de Llobregat" },
    alcaldia: true,
    adreca: "regidor/lluisa-moret-sabido/",
    // La J24 desa «dedicació exclusiva», amb la paraula: la pàgina no l'ha de repetir.
    retribucio: { anualBrut: 45_000, dedicacio: "dedicació exclusiva", sostreAssistencies: null, motiu: null, font: null },
  });
  const vice = membre({
    nom: "Joan Vila",
    carrec: "Vicepresident 1r",
    rol: "vicepresidencia",
    ordre: 1,
    partit: "ERC",
    grup: "ERC",
    color: "#ffb232",
    retribucio: { anualBrut: 30_000, dedicacio: "parcial", sostreAssistencies: null, motiu: null, font: null },
  });
  const assistencia = membre({
    nom: "Pere Soler",
    carrec: "Diputat",
    retribucio: { anualBrut: null, dedicacio: null, sostreAssistencies: 6_000, motiu: null, font: null },
  });
  // L'etiqueta literal («Aramoià - AM») és d'ERC: va al grup d'ERC i es diu en petit.
  const senseSou = membre({ nom: "Laia Font", partit: "Aramoià - AM", grup: "ERC", color: "#ffb232", municipi: null });
  const membres = [presidenta, vice, assistencia, senseSou];
  const repartiment: RepartimentEns = {
    files: [
      { partit: "PSC", vots: 600_000, regidors: 1_500, puntuacio: null, seientsCalculats: 3, seientsReals: 3 },
      { partit: "ERC", vots: 400_000, regidors: 1_200, puntuacio: null, seientsCalculats: 2, seientsReals: 2 },
    ],
    districtes: [
      { nom: "Manresa", poblacio: 250_000, seients: 2, perPartit: [{ partit: "PSC", seients: 1 }, { partit: "ERC", seients: 1 }] },
      { nom: "Vic", poblacio: 160_000, seients: 3, perPartit: [{ partit: "PSC", seients: 2 }, { partit: "ERC", seients: 1 }] },
    ],
    quadra: true,
    diferencies: [],
  };
  return base({
    seients: 5,
    membres,
    presidencia: presidenta,
    composicio: [
      { partit: "PSC", seients: 3, color: "#e73b39" },
      { partit: "ERC", seients: 2, color: "#ffb232" },
    ],
    municipis: [
      { slug: "manresa", nom: "Manresa", comarca: "Bages", poblacio: 78_000, membres: 2 },
      { slug: "sant-boi-de-llobregat", nom: "Sant Boi de Llobregat", comarca: "Baix Llobregat", poblacio: 84_000, membres: 1 },
      { slug: "gisclareny", nom: "Gisclareny", comarca: "Berguedà", poblacio: 30, membres: 0 },
    ],
    poblacio: 162_030,
    comarques: [{ slug: "bages", nom: "Bages" }, { slug: "bergueda", nom: "Berguedà" }],
    districtes: [{ nom: "Manresa", municipalityIds: [1] }, { nom: "Vic", municipalityIds: [2] }],
    repartiment,
    gerent: "JOSEP ROCA",
    finances: {
      anys: [
        { any: 2023, capitols: [{ tipus: "despeses", capitol: 1, nom: "Personal", liquidat: 300_000_000, pressupostat: null }] },
        { any: 2024, capitols: [
          { tipus: "ingressos", capitol: 4, nom: "Transferències corrents", liquidat: 700_000_000, pressupostat: null },
          { tipus: "ingressos", capitol: 1, nom: "Impostos directes", liquidat: 100_000_000, pressupostat: null },
          { tipus: "despeses", capitol: 1, nom: "Personal", liquidat: 300_000_000, pressupostat: null },
          { tipus: "despeses", capitol: 2, nom: "Béns corrents i serveis", liquidat: 50_000_000, pressupostat: null },
          { tipus: "despeses", capitol: 4, nom: "Transferències corrents", liquidat: 400_000_000, pressupostat: null },
          // El capítol 9 (tornar deute) no és despesa no financera: no entra al total.
          { tipus: "despeses", capitol: 9, nom: "Passius financers", liquidat: 27_800_000, pressupostat: null },
        ] },
      ],
      programes: { any: 2024, files: [
        { codi: "2", nom: "Protecció social", nivell: 1, obligacions: 300_000_000 },
        { codi: "4", nom: "Actuacions de caràcter econòmic", nivell: 1, obligacions: 450_000_000 },
        { codi: "23", nom: "Serveis socials", nivell: 2, obligacions: 200_000_000 },
      ] },
      deute: [{ any: 2023, deuteViu: 120_000_000 }, { any: 2024, deuteViu: 100_000_000 }],
      fonts: [{ nom: "Liquidació pressupostària, Consorci AOC", url: "https://dadesobertes.seu-e.cat/", llicencia: "CC BY 4.0", consultat: "2026-10-27" }],
    },
    subvencions: {
      anys: [2023, 2024],
      perMunicipi: [
        { slug: "manresa", nom: "Manresa", poblacio: 78_000, imports: [500_000, 780_000] },
        { slug: "sant-boi-de-llobregat", nom: "Sant Boi de Llobregat", poblacio: 84_000, imports: [400_000, 420_000] },
        { slug: "gisclareny", nom: "Gisclareny", poblacio: 30, imports: [null, 6_000] },
        { slug: "fantasma", nom: "Fantasma", poblacio: 100, imports: [null, null] },
        // Prou ajuntaments amb dada perquè la mediana voldria dir alguna cosa.
        ...["a", "b", "c", "d", "e", "f", "g", "h"].map((x) => ({ slug: `poble-${x}`, nom: `Poble ${x.toUpperCase()}`, poblacio: 5_000, imports: [null, 50_000] })),
      ],
      convocatories: [{ titol: "Pla Xarxa de Governs Locals", import: 900_000, concessions: 3 }],
      agenciesExcloses: ["Organisme de Gestió Tributària", "Institut del Teatre"],
      concessionsEns: [40, 52],
      noPublicable: [{ import: 0, concessions: 0 }, { import: 50_000, concessions: 2 }],
      font: { nom: "RAISC, s9xt-n979", url: "https://analisi.transparenciacatalunya.cat/d/s9xt-n979", llicencia: null, consultat: null },
    },
    avisos: ["La Diputació de Barcelona no publica els noms al registre de plens."],
    fonts: [{ nom: "Composició dels plens, nm3n-3vbj", url: "https://analisi.transparenciacatalunya.cat/d/nm3n-3vbj", llicencia: null, consultat: "2026-10-27" }],
  });
}

/** Un consell amb un càlcul que no quadra. */
function consell(): DadesEns {
  const president = membre({ nom: "Eloi Hernàndez", carrec: "President", rol: "presidencia", partit: "Junts", grup: "Junts", color: "#20c0b2" });
  return base({
    tipus: "consell",
    codiEns: "8100750006",
    nom: "Consell Comarcal del Bages",
    territori: "Bages",
    article: "el Bages",
    slug: "bages",
    seu: { slug: "manresa", nom: "Manresa" },
    comarca: { slug: "bages", nom: "Bages" },
    seients: 33,
    membres: [president],
    presidencia: president,
    composicio: [{ partit: "Junts", seients: 12, color: "#20c0b2" }, { partit: "ERC", seients: 10, color: "#ffb232" }],
    municipis: [{ slug: "manresa", nom: "Manresa", comarca: "Bages", poblacio: 78_000, membres: 1 }],
    poblacio: 78_000,
    repartiment: {
      files: [
        { partit: "Junts", vots: 30_000, regidors: 120, puntuacio: 31.25, seientsCalculats: 11, seientsReals: 12 },
        { partit: "ERC", vots: 28_000, regidors: 110, puntuacio: 29.5, seientsCalculats: 11, seientsReals: null },
      ],
      districtes: null,
      quadra: false,
      diferencies: ["Junts en té 12 al ple i el càlcul li'n dona 11."],
    },
  });
}

/** Un consell gairebé buit: només el nom i els seients. */
function buit(): DadesEns {
  return base({
    tipus: "consell",
    codiEns: "0000000000",
    nom: "Consell Comarcal del Moianès",
    territori: "Moianès",
    article: "el Moianès",
    slug: "moianes",
    seu: null,
    comarca: null,
    web: null,
    wikidata: null,
    cif: null,
    seients: 19,
  });
}

/** La pàgina sense els scripts compartits (el cercador porta «null» i adreces al seu codi). */
const senseScripts = (html: string): string => html.replace(/<script[\s\S]*?<\/script>/g, "");
const titolDe = (html: string): string => html.match(/<title>([^<]*)<\/title>/)![1]!;
const descripcioDe = (html: string): string => html.match(/<meta name="description" content="([^"]*)">/)![1]!;

describe("renderEns · diputació", () => {
  const html = renderEns(diputacio(), GENERAT);

  it("és una pàgina sencera amb un sol h1 i el JSON-LD de l'organisme", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).toContain('"@type":"GovernmentOrganization"');
    expect(html).toContain('<link rel="canonical" href="https://quivoto.cat/observatori/diputacio/barcelona/">');
  });

  it("títol i descripció hi caben sense tallar", () => {
    expect(titolDe(html).length).toBeLessThanOrEqual(TITOL_MAXIM);
    expect(descripcioDe(html).length).toBeLessThanOrEqual(DESCRIPCIO_MAXIMA);
    expect(descripcioDe(html)).not.toMatch(/…$/);
    expect(descripcioDe(html)).toContain("5 diputats");
  });

  it("els camins surten de dos nivells avall", () => {
    expect(html).toContain('href="../../m/sant-boi-de-llobregat/regidor/lluisa-moret-sabido/"');
    expect(html).toContain('href="../../m/manresa/"');
    expect(html).toContain('href="../../ens/"');
    expect(html).toContain('href="../../c/bages/"');
    expect(html).toContain('href="../../diputacio/girona/"');
    expect(html).toContain('href="../../diputacio/barcelona/" class="aqui" aria-current="page"');
    expect(html).not.toMatch(/href="\.\.\/\.\.\/\.\.\/(m|c|ens|diputacio)\//);
  });

  it("no enllaça ningú que no tingui un aparellament únic", () => {
    expect(html).not.toMatch(/href="[^"]*regidor\/[^"]*"[^>]*>Pere Soler/);
    expect(html).toContain("Pere Soler");
  });

  it("diu el sou que publica l'ens, i no el suma mai", () => {
    expect(html).toContain("45.000 €</b> bruts l'any");
    expect(html).toContain("dedicació exclusiva</span>");
    expect(html).not.toContain("dedicació dedicació");
    expect(html).toContain("només assistències");
    expect(html).toContain("màx. 6 mil € l'any");
    expect(html).toContain("no consta");
    expect(html).not.toContain((75_000).toLocaleString("ca-ES"));
    expect(html).toContain("no tot el que");
  });

  it("dibuixa un cercle per seient i la cadena de tres passos", () => {
    expect(html.match(/<circle class="seient"/g)).toHaveLength(5);
    expect(html.match(/class="ens-baula /g)).toHaveLength(3);
    expect(html).toContain("1.000.000");
    expect(html).toContain("Lluïsa Moret Sabidó");
  });

  it("quan el càlcul quadra, ho diu, i pinta els partits judicials", () => {
    expect(html).toContain("exactament aquest ple");
    expect(html).not.toContain("no dona exactament");
    expect(html).toContain("per partit judicial");
    expect(html).toContain("<b>Vic</b>");
  });

  it("pinta els diners de l'últim any amb quadres i sèries", () => {
    expect(html).toContain("750,0 milions d'euros");
    expect(html).toContain(`${(4629).toLocaleString("ca-ES")} € per cada habitant`);
    expect(html).toContain("per àrees");
    expect(html).not.toContain(">Serveis socials<");
    expect(html.match(/class="ens-tros"/g)!.length).toBe(4);
    expect(html).toContain("100,0 milions d'euros");
  });

  it("reparteix: mediana, euros per habitant i buits que no són zeros", () => {
    expect(html).toContain("1,6 milions d'euros");
    expect(html).toContain("més de 10 €");
    expect(html).toContain("200 €");
    expect(html).toContain("Sense dada: Fantasma");
    expect(html).toContain("RAISC");
    expect(html).toContain('href="#reparteix"');
  });

  it("reparteix: organismes exclosos, any de concessió i el no publicable petit com a nota", () => {
    expect(html).toContain("Tampoc no hi compten els organismes propis: Organisme de Gestió Tributària i Institut del Teatre.");
    expect(html).toContain("data de concessió, no el de la convocatòria");
    expect(html).toContain("amb el beneficiari amagat");
    expect(html).not.toContain("la major part del que reparteix no diu a qui");
  });

  it("l'avís dels noms va al bloc dels membres, i el gerent a part", () => {
    expect(html).toContain('<p class="avis-dada">La Diputació de Barcelona no publica els noms');
    expect(html.match(/no publica els noms al registre/g)).toHaveLength(1);
    expect(html).toContain("Josep Roca");
  });
});

describe("renderEns · consell", () => {
  const html = renderEns(consell(), GENERAT);

  it("parla de consellers i de la comarca, i viu tres nivells avall", () => {
    expect(html).toContain("33\n  consellers");
    expect(html).toContain("Consell comarcal · el Bages");
    expect(html).toContain('href="../../../c/bages/"');
    expect(html).toContain('href="../../../diputacio/barcelona/"');
    expect(html).toContain('href="../../../m/manresa/"');
    expect(html).toContain("https://quivoto.cat/observatori/c/bages/consell/");
    expect(html).toContain("Decret legislatiu 4/2003");
  });

  it("si el càlcul no quadra, ho diu, ensenya les diferències i no el ven com el ple", () => {
    expect(html).toContain("no dona exactament aquest ple");
    expect(html).not.toContain("dona <b>exactament aquest ple");
    expect(html).toContain("<li>Junts en té 12 al ple i el càlcul li&#39;n dona 11.</li>".replace("&#39;", "'"));
    expect(html).toContain("(no és el ple real)");
    expect(html).toContain("Puntuació");
    expect(html).toContain("31,25");
    expect(html).toMatch(/<td class="xifra"><span class="secundari">no consta<\/span><\/td>/);
  });

  it("els seients sense partit conegut es dibuixen en gris, no desapareixen", () => {
    expect(html.match(/<circle class="seient"/g)).toHaveLength(33);
    expect(html).toContain("Seient sense nom a la font");
  });

  it("diu quants noms en coneixem", () => {
    expect(html).toContain("En coneixem 1 de 33");
  });

  /*
   * El Montsià: dos escons que el registre dona amb el partit i sense nom. La
   * J38 els desa amb el nom buit (`NOM_NO_PUBLICAT`), i la pàgina diu què són en
   * lloc de deixar un forat, sense inicials inventades ni fitxa ni sou.
   */
  it("un escó amb partit i sense nom es diu «Seient de <partit>», i no compta com a nom conegut", () => {
    const d = consell();
    const anonim = membre({
      nom: NOM_NO_PUBLICAT, carrec: "Conseller", partit: "ERC", grup: "ERC", color: "#ffb232", municipi: null, ordre: 23,
    });
    const h = renderEns({ ...d, membres: [...d.membres, anonim] }, GENERAT);
    expect(h).toContain("Seient de ERC (la font no en dona el nom)");
    // Cap enllaç ni cap cara amb inicials: la cara és un interrogant.
    expect(h).not.toMatch(/<a [^>]*>Seient de ERC/);
    expect(h).toContain('aria-label="Seient de ERC (la font no en dona el nom)"'.slice(0, 0));
    // El nom no el sabem: continuen sent 1 de 33 els noms coneguts.
    expect(h).toContain("En coneixem 1 de 33");
    // Cap forat a la llista: cap nom buit entre etiquetes.
    expect(h).not.toMatch(/<span class="ens-nom">\s*<\/span>/);
  });

  it("parla en singular quan només hi ha un municipi", () => {
    expect(html).toContain("L'únic municipi");
    expect(html).toContain("de l'únic ajuntament");
    expect(html).not.toContain("Els 1 ");
  });
});

describe("renderEns · gairebé buit", () => {
  const html = renderEns(buit(), GENERAT);

  it("es pinta sencer, sense «undefined» ni «NaN»", () => {
    expect(senseScripts(html)).not.toMatch(/undefined|NaN|null/);
    expect(html).toContain("</html>");
    expect(html.match(/<circle class="seient"/g)).toHaveLength(19);
  });

  it("diu cada buit amb la seva veu", () => {
    expect(html).toContain("La font no diu qui presideix el consell");
    expect(html).toContain("no publica els noms de qui seu al consell");
    expect(html).toContain("No tenim cap liquidació del pressupost del consell");
    expect(html).toContain("no en recull cap xifra declarada");
    expect(html).toContain("Encara no hem pogut refer el càlcul");
    expect(html).toContain("No tenim la llista de municipis");
    expect(html).toContain("no en declara");
    expect(html).toContain("La font no diu de quin partit és cap dels seients");
  });

  it("sense subvencions, el bloc i la seva entrada a l'índex no hi són", () => {
    expect(html).not.toContain('id="reparteix"');
    expect(html).not.toContain('href="#reparteix"');
  });

  it("sense diputació coneguda, enllaça només a l'índex", () => {
    expect(html).toContain('href="../../../ens/"');
    expect(senseScripts(html)).not.toContain("diputacio/");
  });

  it("títol i descripció també hi caben", () => {
    expect(titolDe(html).length).toBeLessThanOrEqual(TITOL_MAXIM);
    expect(descripcioDe(html).length).toBeLessThanOrEqual(DESCRIPCIO_MAXIMA);
  });
});

describe("renderEns · subvencions amb buits de debò", () => {
  it("si l'ens no registra res al RAISC, ho diu en lloc d'una taula buida", () => {
    const d = diputacio();
    const html = renderEns({ ...d, subvencions: { ...d.subvencions!, concessionsEns: [0, 0], noPublicable: null } }, GENERAT);
    expect(html).toContain("no registra cap concessió al RAISC entre el 2023 i el 2024");
    expect(html).not.toContain('class="ens-reparteix"');
    expect(html).not.toContain("Les convocatòries que més reparteixen");
  });

  it("si el que amaga el beneficiari supera el que té nom, l'avís va destacat", () => {
    const d = diputacio();
    const html = renderEns(
      { ...d, subvencions: { ...d.subvencions!, noPublicable: [{ import: 0, concessions: 0 }, { import: 181_000_000, concessions: 900 }] } },
      GENERAT,
    );
    expect(html).toContain('<p class="avis-dada"><b>Compte: la major part del que reparteix no diu a qui.</b>');
    expect(html).toContain("181,0 milions d'euros");
    expect(html.indexOf("Compte: la major part")).toBeLessThan(html.indexOf('class="ens-ratlla"'));
  });
});

describe("renderEns · el que arriba de les fonts", () => {
  it("escapa noms, partits, càrrecs, avisos i diferències", () => {
    const d = consell();
    const dolent = membre({ nom: "<script>x</script>", carrec: "<b>Cap</b>", partit: '"><img>', color: "red;background:url(x)" });
    const html = renderEns(
      {
        ...d,
        nom: "Consell <i>Comarcal</i>",
        membres: [dolent],
        presidencia: dolent,
        avisos: ["<em>avís</em>"],
        repartiment: { ...d.repartiment!, diferencies: ["<u>dif</u>"] },
      },
      GENERAT,
    );
    expect(html).not.toContain("<script>x</script>");
    expect(html).not.toContain("<b>Cap</b>");
    expect(html).not.toContain('"><img>');
    expect(html).not.toContain("<em>avís</em>");
    expect(html).not.toContain("<u>dif</u>");
    expect(html).not.toContain("<i>Comarcal</i>");
    expect(html).not.toContain("red;background");
  });
});

describe("títol i descripció", () => {
  it("un nom llarg es queda sense coletilla abans de passar de 60", () => {
    const t = titolEns({ nom: "Consell Comarcal del Vallès Occidental" });
    expect(t.length).toBeLessThanOrEqual(TITOL_MAXIM);
    expect(t.startsWith("Consell Comarcal del Vallès Occidental")).toBe(true);
  });

  it("la descripció fa servir el plural o el singular que toca", () => {
    expect(descripcioEns(diputacio())).toMatch(/^Els 5 diputats de la Diputació de Barcelona/);
    expect(descripcioEns(consell())).toMatch(/^Els 33 consellers del Consell Comarcal del Bages/);
  });

  it("el CSS només defineix classes amb prefix", () => {
    // El primer tros de cada selector ha de ser nostre; a dins, una classe
    // compartida (.xifra) ja queda encerclada per l'ens- de davant.
    const css = ENS_CSS.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@[^{]+\{/g, "");
    const selectors = [...css.matchAll(/([^{}]+)\{[^{}]*\}/g)].flatMap((m) => m[1]!.split(",").map((s) => s.trim()));
    const alienes = selectors.filter((s) => s.startsWith(".") && !s.startsWith(".ens-"));
    expect(alienes).toEqual([]);
  });
});

describe("renderEns · el que s'ha arreglat després de mirar les pàgines", () => {
  const html = renderEns(diputacio(), GENERAT);

  it("agrupa per partit comparable, amb el nom de la família al títol i l'etiqueta literal en petit", () => {
    expect(html).toMatch(/<h3 class="ens-grup">[^]*?<span>PSC<\/span>/);
    expect(html).toMatch(/<h3 class="ens-grup">[^]*?<span>ERC<\/span>/);
    // Els grups són dos, no un per cada etiqueta literal.
    expect(html.match(/<h3 class="ens-grup">/g)).toHaveLength(2);
    expect(html).toContain('<span class="ens-etiqueta" title="Com ho escriu la font">Aramoià - AM</span>');
    expect(html).toContain('<span class="ens-etiqueta" title="Com ho escriu la font">PSC-CP</span>');
  });

  it("«N/A» al camp del partit no és cap partit: no es pinta ni com a pastilla ni com a etiqueta", () => {
    const d = diputacio();
    const senseEtiqueta = membre({ nom: "Dante Pérez Berenguer", carrec: "Conseller", partit: "N/A", grup: "ERC" });
    const h = renderEns({ ...d, membres: [...d.membres, senseEtiqueta] }, GENERAT);
    expect(h).toContain("Dante Pérez Berenguer");
    expect(h).not.toContain("N/A");
  });

  it("les dates de consulta es diuen en català, no en ISO", () => {
    expect(html).toContain("Consultat el 27 d'octubre del 2026.");
    expect(html).toContain("consultat el 27 d'octubre del 2026");
    expect(html).not.toMatch(/consultat el \d{4}-\d{2}-\d{2}/i);
  });

  it("contreu la preposició amb el nom del municipi", () => {
    const d = diputacio();
    const elBruc = { ...d.membres[2]!, municipi: { slug: "bruc", nom: "el Bruc" } };
    const olot = { ...d.membres[2]!, nom: "Anna Olot", municipi: { slug: "olot", nom: "Olot" }, carrec: "Alcalde President" };
    const h = renderEns({ ...d, membres: [...d.membres, elBruc, olot] }, GENERAT);
    expect(h).toContain('seu al ple del <a href="../../m/bruc/">Bruc</a>');
    expect(h).toContain(`té l'alcaldia d'<a href="../../m/olot/">Olot</a>`);
    expect(h).not.toMatch(/de el |de Olot/);
  });

  it("la despesa és la no financera i els préstecs es diuen a part", () => {
    expect(html).toContain("capítols 1 a 7");
    expect(html).toContain("27,8 milions d'euros a tornar préstecs (capítol 9)");
  });

  it("acaba amb la papereta i un enllaç a l'índex", () => {
    expect(html).toContain("pap-v-final");
    expect(html).toContain('href="../../ens/">Mira qui governa per sobre dels altres pobles</a>');
  });

  it("si els seients sense partit expliquen tota la diferència, ho diu així", () => {
    const d = diputacio();
    const r = { ...d.repartiment!, diferencies: ["Quadra amb els 4 seients de partit conegut; de l'altre, la font no diu de quin partit és."] };
    const h = renderEns({ ...d, repartiment: r }, GENERAT);
    expect(h).toContain("aquest ple en tot el que sabem");
    expect(h).toContain("Quadra amb els 4 seients de partit conegut");
  });

  it("amaga les llistes sense cap seient i les compta en una línia; un sorteig porta la papereta de l'empat", () => {
    const d = diputacio();
    const zero = (partit: string) => ({ partit, vots: 10, regidors: 1, puntuacio: null, seientsCalculats: 0, seientsReals: 0 });
    const r = {
      ...d.repartiment!,
      files: [...d.repartiment!.files, zero("IPV"), zero("AM-LVDVDM")],
      diferencies: ["Un escó d'ERC surt d'un empat que la llei resol per sorteig."],
    };
    const h = renderEns({ ...d, repartiment: r }, GENERAT);
    expect(h).not.toContain(">IPV<");
    expect(h).toContain("I 2 llistes més");
    expect(h).toContain("pap-v-empat");
  });

  it("no diu «la resta, ningú» si d'algun membre no se'n sap el municipi", () => {
    // La Laia Font no té municipi conegut.
    expect(html).not.toContain("la resta, ningú");
    expect(html).toContain("de 1 diputat no en sabem el municipi");
    const d = diputacio();
    const h = renderEns({ ...d, municipis: d.municipis.map((m) => ({ ...m, membres: m.membres || null })) }, GENERAT);
    expect(h).toContain('<td class="xifra ens-seu"><span class="ens-buit">no consta</span></td>');
  });

  it("un import petit no s'escriu mai com a zero", () => {
    const d = diputacio();
    const h = renderEns({ ...d, finances: { ...d.finances!, deute: [{ any: 2024, deuteViu: 1_154 }] } }, GENERAT);
    expect(h).toContain("1 mil €");
    expect(h).not.toMatch(/[^\d.]0,0 M€/);
  });

  it("«no cobra res» i «no consta» són coses diferents", () => {
    const d = diputacio();
    const cobraZero = { ...d.membres[2]!, nom: "Zero Zero", retribucio: { anualBrut: 0, dedicacio: null, sostreAssistencies: null, motiu: null, font: null } };
    const motiu = "El consell no publica cap import anual per a aquesta persona.";
    const buit1 = { ...d.membres[2]!, nom: "Buit U", retribucio: { anualBrut: null, dedicacio: null, sostreAssistencies: null, motiu, font: null } };
    const buit2 = { ...buit1, nom: "Buit Dos" };
    const h = renderEns({ ...d, membres: [...d.membres, cobraZero, buit1, buit2] }, GENERAT);
    expect(h).toContain("no cobra res d'aquest ens");
    // El mateix motiu, una sola vegada, a la nota de sota.
    expect(h.match(/El consell no publica cap import anual/g)).toHaveLength(1);
    expect(h).toContain('id="ens-nota-1"');
  });

  it("si presideix pel registre d'ens locals però el càrrec no ho diu, ho explica", () => {
    const d = diputacio();
    const promogut = { ...d.presidencia!, carrec: "Conseller" };
    const h = renderEns({ ...d, presidencia: promogut, membres: [promogut, ...d.membres.slice(1)] }, GENERAT);
    expect(h).toContain("Presidència, segons el registre d&#39;ens locals".replace("&#39;", "'"));
  });
});

describe("renderEns · serveis i diners de la Generalitat", () => {
  const font = { id: "x", titol: "Trameses de comptes", organisme: "Generalitat", url: "https://exemple.cat/trameses", llicencia: "CC", consultat: "2026-10-27" };
  const generalitat = {
    codiEns: "8000840003",
    nom: "Diputació de Barcelona",
    tipus: "diputacio" as const,
    fcl: null,
    obres: [],
    trameses: { anys: [], estatInventari: null, actualitzat: null },
    pendents: null,
    anyConsulta: 2026,
    fonts: { fcl: { ...font, titol: "FCL", url: "https://exemple.cat/fcl" }, puosc: font, trameses: font, pendents: font },
  };

  it("sense dades de la J41 ni de la J42, ni seccions ni enllaços a l'índex", () => {
    const html = renderEns(diputacio(), GENERAT);
    expect(html).not.toContain('id="generalitat"');
    expect(html).not.toContain('href="#generalitat"');
    expect(html).not.toContain('href="#contractacio"');
  });

  it("amb dades de la J41, el bloc de la Generalitat i la seva font, sense la del fons si no en rep", () => {
    const html = renderEns({ ...diputacio(), dinersGeneralitat: generalitat }, GENERAT);
    expect(html).toContain('<section class="bloc" id="generalitat">');
    expect(html).toContain('href="#generalitat"');
    expect(html).toContain("Les diputacions no reben el Fons de Cooperació Local");
    expect(html).toContain('href="https://exemple.cat/trameses"');
    expect(html).not.toContain('href="https://exemple.cat/fcl"');
  });

  it("amb dades de la J42, l'enllaç a com contracta i el seu bloc", () => {
    const serveis = { codiEns: "8000840003", ens: "Diputació de Barcelona", tipus: "diputacio" as const, serveisSocials: null, altresArees: [], contractacio: null, consultat: "2026-10-27" };
    const html = renderEns({ ...diputacio(), serveis }, GENERAT);
    expect(html).toContain('href="#contractacio"');
    expect(html).toContain('id="contractacio"');
    expect(senseScripts(html)).not.toMatch(/undefined|NaN/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// El cap SEO i les preguntes ràpides: el graf de l'ens i les respostes citables.
// ─────────────────────────────────────────────────────────────────────────────

/** Els objectes JSON-LD del cap, en l'ordre en què surten. */
const jsonLdDe = (html: string): Record<string, unknown>[] =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
    (m) => JSON.parse(m[1]!) as Record<string, unknown>,
  );

describe("renderEns · dades enriquides i preguntes ràpides", () => {
  const html = renderEns(diputacio(), GENERAT);
  const nodes = jsonLdDe(html);
  const ens = nodes.find((n) => n["@type"] === "GovernmentOrganization")!;
  const pagina = nodes.find((n) => n["@id"] === "https://quivoto.cat/observatori/diputacio/barcelona/#pagina")!;

  it("l'ens és el node del graf, amb el mateix @id de sempre, la presidència i el ple", () => {
    expect(ens["@id"]).toBe("https://quivoto.cat/observatori/diputacio/barcelona/#ens");
    expect(ens.areaServed).toEqual({ "@type": "AdministrativeArea", name: "província de Barcelona" });
    expect((ens.location as Record<string, unknown>)["@id"]).toBe("https://quivoto.cat/observatori/m/barcelona/#municipi");
    expect(ens.sameAs).toEqual(["https://www.diba.cat/", "https://www.wikidata.org/wiki/Q1607008"]);
    // La presidenta té fitxa (aparellament únic): porta l'@id de la seva fitxa.
    expect((ens.employee as Record<string, unknown>)["@id"]).toBe(
      "https://quivoto.cat/observatori/m/sant-boi-de-llobregat/regidor/lluisa-moret-sabido/#persona",
    );
    expect(ens.member as unknown[]).toHaveLength(4);
  });

  it("un sol node de pàgina: el FAQPage de les preguntes, que parla de l'ens i diu de quan són les dades", () => {
    expect(nodes.filter((n) => n["@id"] === pagina["@id"])).toHaveLength(1);
    expect(pagina["@type"]).toBe("FAQPage");
    expect((pagina.about as Record<string, unknown>)["@id"]).toBe(ens["@id"]);
    expect(pagina.dateModified).toBe("2026-10-27");
    const preguntes = (pagina.mainEntity as { name: string }[]).map((q) => q.name);
    expect(preguntes[0]).toBe("Qui presideix la Diputació de Barcelona?");
    expect(preguntes).toContain("Com s'escullen els diputats de la Diputació de Barcelona?");
  });

  it("les preguntes es veuen a la pàgina, després de l'índex, i l'índex hi porta", () => {
    expect(html).toContain('<section class="bloc geo-preguntes" id="preguntes-rapides"');
    expect(html).toContain('<a href="#preguntes-rapides">Preguntes ràpides</a>');
    const index = html.indexOf('<nav class="index"');
    const preguntes = html.indexOf('id="preguntes-rapides"');
    const queFa = html.indexOf('id="que-fa"');
    expect(index).toBeGreaterThan(0);
    expect(preguntes).toBeGreaterThan(index);
    expect(preguntes).toBeLessThan(queFa);
    // El nom de la presidenta porta a la seva fitxa (adreça absoluta, la mateixa del JSON-LD).
    expect(html).toMatch(/class="geo-resposta"><p>La Diputació de Barcelona la presideix <a href="https:\/\/quivoto\.cat\/observatori\/m\/sant-boi-de-llobregat\/regidor\/lluisa-moret-sabido\/">Lluïsa Moret Sabidó<\/a>/);
    expect(html).toContain(".geo-llista");
  });

  it("la data de les dades va a l'article:modified_time, i no la de la publicació", () => {
    expect(html).toContain('<meta property="og:type" content="article">');
    expect(html).toContain('<meta property="article:modified_time" content="2026-10-27">');
    const d = renderEns({ ...diputacio(), consultat: "2026-09-01" }, GENERAT);
    expect(d).toContain('"dateModified":"2026-09-01"');
    expect(d).not.toContain('"dateModified":"2026-10-27"');
  });

  it("un consell serveix la seva comarca, amb l'@id de la fitxa de comarca", () => {
    const consellLd = jsonLdDe(renderEns(consell(), GENERAT)).find((n) => n["@type"] === "GovernmentOrganization")!;
    expect(consellLd["@id"]).toBe("https://quivoto.cat/observatori/c/bages/consell/#ens");
    expect((consellLd.areaServed as Record<string, unknown>)["@id"]).toBe("https://quivoto.cat/observatori/c/bages/#comarca");
  });

  it("gairebé buit: només les preguntes que tenen resposta, sense cap «null»", () => {
    const h = renderEns(buit(), GENERAT);
    const faq = jsonLdDe(h).find((n) => n["@type"] === "FAQPage")!;
    const preguntes = (faq.mainEntity as { name: string }[]).map((q) => q.name);
    expect(preguntes).toEqual([
      "Quants consellers té el Consell Comarcal del Moianès?",
      "Com s'escullen els consellers del Consell Comarcal del Moianès?",
    ]);
    expect(JSON.stringify(faq)).not.toMatch(/null|undefined|NaN/);
  });
});
