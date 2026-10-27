import { describe, expect, it } from "vitest";
import { DESCRIPCIO_MAXIMA, TITOL_MAXIM } from "./seo";
import {
  renderComarca, renderMapaComarca, renderMapaTerritori, renderPoder, renderUllada,
  type ComarcaData, type ComarcaMunicipi,
} from "./comarques";
import { geometria } from "./mapa";
import { ensDeProva, membreDeProva } from "./ens-prova-enllacos";
import { renderComarquesIndex } from "./comarques-index";
import { aLaComarca, comarcaAmbArticle } from "./comarques";
import { tiraDesDeHistorial } from "./tira-poble";

/**
 * La pàgina es genera sense cap model pel mig, així que el que s'ha de provar
 * no és que «quedi bé» sinó que cap xifra no es contradigui amb una altra i que
 * res del que arriba de les fonts —cometes, cognoms amb `&`— no pugui trencar
 * la pàgina ni colar-hi etiquetes.
 */

function municipi(over: Partial<ComarcaMunicipi> = {}): ComarcaMunicipi {
  return {
    slug: "un-poble", name: "un Poble", population: 1_200, lat: 41.2, lon: 0.8, seats: 9,
    mayorName: "Maria Puig", mayorSigles: "ERC-AM", mayorBrandId: "erc",
    winnerSigles: "ERC-AM", winnerGoverns: true, hasMajority: true,
    mayorChanged: false, mayorChangeName: null, mayorChangeDate: null,
    ...over,
  };
}

function comarca(over: Partial<ComarcaData> = {}): ComarcaData {
  const municipis = over.municipis ?? [municipi()];
  return {
    slug: "priorat", name: "Priorat",
    habitants: 9_376, regidories: 143, poblacioMediana: 254,
    forces: [{ brandId: "erc", label: "ERC", color: "#ffb232", alcaldies: 1, habitants: 1_200 }],
    governaMesVotat: 1, pacte: 0, senseIdentificar: 0, majoriaAbsoluta: 1, canvisAlcaldia: 0,
    indicadors: [],
    catalunya: {
      municipis: 947, habitants: 8_012_231, regidories: 9_104,
      pacte: 214, majoriaAbsoluta: 520, canvisAlcaldia: 61,
    },
    altres: [{ slug: "priorat", name: "Priorat", municipis: 23 }],
    metropolitans: 0,
    ...over,
    municipis,
  };
}

describe("renderComarca", () => {
  it("escapa el que ve de les fonts, que no és de fiar", () => {
    const html = renderComarca(
      comarca({ municipis: [municipi({ name: 'Sant <script>alert("x")</script>', mayorSigles: "A & B" })] }),
      "2026-08-29",
    );
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("A &amp; B");
  });

  it("enllaça cada municipi amb la seva fitxa, dos nivells amunt", () => {
    const html = renderComarca(comarca(), "2026-08-29");
    expect(html).toContain('href="../../m/un-poble/"');
  });

  it("marca l'excepció i no la norma a la llista de municipis", () => {
    // A gairebé tots els pobles la llista guanyadora té majoria absoluta: si es
    // marquessin totes, els dos casos de pacte quedarien enterrats. I el
    // distintiu de majoria seria a més enganyós allà on governa un altre.
    const html = renderComarca(
      comarca({
        municipis: [municipi({ winnerGoverns: false, hasMajority: true, winnerSigles: "JxCAT" })],
        governaMesVotat: 0, pacte: 1, majoriaAbsoluta: 0,
      }),
      "2026-08-29",
    );
    // Es busca el distintiu escrit, no la classe: el full d'estil també la porta.
    expect(html).toContain('<span class="marca-pacte">pacte</span>');
    expect(html).not.toContain(">majoria absoluta</span>");
    // I un ple partit sí que es marca, perquè aquell sí que és l'excepció.
    const partit = renderComarca(comarca({ municipis: [municipi({ hasMajority: false })] }), "2026-08-29");
    expect(partit).toContain(">ple sense majoria</span>");
  });

  it("diu que no hi ha hagut cap canvi d'alcaldia en comptes de callar", () => {
    const html = renderComarca(comarca(), "2026-08-29");
    expect(html).toContain("Cap municipi d'aquesta comarca no ha canviat d'alcaldia");
  });

  it("no s'inventa una secció d'indicadors quan no en té cap", () => {
    const html = renderComarca(comarca({ indicadors: [] }), "2026-08-29");
    expect(html).not.toContain('id="indicadors"');
  });

  it("posa el municipi del mig de Catalunya al costat del de la comarca, mai sol", () => {
    const html = renderComarca(
      comarca({
        indicadors: [{
          key: "deute-habitant", label: "Deute per habitant", unit: "euros",
          comarcal: 0, catalana: 2, ambDada: 23, ambDadaCatalunya: 947,
          percentilGrup: 35, nota: "Deute viu a 31 de desembre.",
        }],
      }),
      "2026-08-29",
    );
    // Sense «mediana» ni «percentil» a la vista: el veí no fa servir cap de
    // les dues paraules, i el regle dels rànquings ja diu «el municipi del mig».
    expect(html).toContain("A Catalunya, el del mig: <b>2 €</b>");
    expect(html).toContain("Per sobre de <b>35</b> de cada 100 de la seva mida");
    const targeta = html.slice(html.indexOf('<ul class="indicadors">'), html.indexOf("</ul>", html.indexOf('<ul class="indicadors">')));
    // El text que es llegeix, sense les etiquetes (la classe «percentil» no compta).
    expect(targeta.replace(/<[^>]+>/g, "")).not.toMatch(/mediana|percentil/i);
    // La definició ja no va sota la targeta: va al glossari, amb la font.
    expect(html).not.toContain("Deute viu a 31 de desembre.</span>");
    expect(html).toContain('<details class="nota glossari">');
    expect(html).toContain("Font: Consorci AOC, 34db8dc5.");
  });

  it("carrega la tipografia del portal dos nivells amunt", () => {
    const html = renderComarca(comarca(), "2026-08-29");
    expect(html).toContain('href="../../../assets/fonts.css"');
    expect(html.indexOf("fonts.css")).toBeLessThan(html.indexOf("<style>"));
  });

  it("no deixa el singular i el plural barrejats", () => {
    const una = renderComarca(
      comarca({ municipis: [municipi({ mayorChanged: true, mayorChangeName: "Anna Roig", mayorChangeDate: "2025-06-14" })], canvisAlcaldia: 1 }),
      "2026-08-29",
    );
    expect(una).toContain("<b>1</b> municipi ha canviat");
    expect(una).toContain("14 de juny del 2025");
  });

  it("porta títol, full d'estil i peu, perquè és una pàgina autònoma", () => {
    const html = renderComarca(comarca(), "2026-08-29");
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<title>Priorat: qui mana al seu únic municipi · quivoto</title>");
    expect(html).toContain("--paper:#FBF7EE");
    // El peu compartit escriu la data amb les seves paraules; el que ha de ser
    // cert és que la pàgina digui de quin dia és.
    expect(html).toContain('<footer class="peu">');
    expect(html).toContain("2026-08-29");
  });
});


/**
 * El resum d'obertura: el mateix component que la fitxa del poble.
 *
 * El que s'ha de provar no és que hi surti, sinó que **cap xifra no hi va sola**.
 * Una comarca amb dos municipis on governa qui no va guanyar no diu res si al
 * costat no hi ha què passa als 947, i era exactament el que la pàgina feia.
 */
describe("la ullada de la portada", () => {
  it("posa la xifra de Catalunya al costat de cada xifra comarcal", () => {
    const html = renderComarca(
      comarca({
        municipis: [municipi(), municipi({ slug: "altre", name: "Altre", winnerGoverns: false })],
        pacte: 1,
        habitants: 2_400,
        regidories: 18,
      }),
      "2026-08-29",
    );
    expect(html).toContain('class="ullada"');
    expect(html).toContain("dels 947 de Catalunya");
    expect(html).toContain("de les 9.104 de Catalunya");
    // 214 de 947 és el 22,6 %: la comarca en té 1 de 2, i sense el 22,6 % del
    // costat el 50 % no es pot llegir ni com a molt ni com a poc.
    expect(html).toContain("a Catalunya, el 22,6 % dels municipis");
  });

  it("no repeteix a l'entrada les xifres que hi ha just a sota", () => {
    // L'entrada era «23 municipis · 9.376 habitants · 143 regidories» i tot
    // seguit venien les mateixes tres xifres en targetes.
    const html = renderComarca(comarca(), "2026-08-29");
    expect(html).not.toContain("regidories en total");
    expect(html).not.toContain('class="resum-xifres"');
  });

  it("cada pastilla porta al bloc que l'explica, i el bloc hi és", () => {
    const html = renderComarca(comarca(), "2026-08-29");
    for (const ancora of ["#municipis", "#alcaldies", "#pactes", "#canvis"]) {
      expect(html, ancora).toContain(`<a href="${ancora}">`);
      expect(html, ancora).toContain(`id="${ancora.slice(1)}"`);
    }
  });

  it("calla sobre la força capdavantera quan no s'ha pogut identificar", () => {
    const html = renderComarca(
      comarca({
        forces: [{ brandId: "sense-identificar", label: "Sense identificar", color: "#8b8b8b", alcaldies: 1, habitants: 1_200 }],
      }),
      "2026-08-29",
    );
    expect(html).not.toContain("La força amb més alcaldies");
  });
});

describe("renderPoder", () => {
  const forces = [
    { label: "PSC", color: "#e73b39", alcaldies: 3, habitants: 90_000 },
    { label: "ERC", color: "#ffb232", alcaldies: 7, habitants: 10_000 },
  ];

  it("pinta les dues cintes amb la mateixa amplada de referència", () => {
    // És tot el gràfic: 3 alcaldies de 10 són el 30 % de la cinta de dalt, i els
    // 90.000 habitants d'aquells tres el 90 % de la de baix. Si les dues cintes
    // no es normalitzessin cadascuna al seu total, la comparació no voldria dir res.
    const html = renderPoder(forces, 10, 100_000, "de la comarca");
    expect(html).toContain("--w:30.00%;--c:#e73b39");
    expect(html).toContain("--w:90.00%;--c:#e73b39");
    expect(html).toContain("--w:70.00%;--c:#ffb232");
    expect(html).toContain("--w:10.00%;--c:#ffb232");
  });

  it("escriu totes les xifres a la clau, perquè la cinta no és l'única lectura", () => {
    const html = renderPoder(forces, 10, 100_000, "de la comarca");
    expect(html.replace(/\s+/g, " ")).toContain("<b>3</b> alcaldies de 10 · 30,0 %");
    expect(html.replace(/\s+/g, " ")).toContain("<b>90.000</b> habitants · 90,0 % de la comarca");
  });

  it("descriu les dues cintes per a qui no les pot veure", () => {
    const html = renderPoder(forces, 10, 100_000, "de la comarca");
    expect(html).toContain('aria-label="Alcaldies: PSC, 30,0 % de les alcaldies; ERC, 70,0 % de les alcaldies."');
    expect(html).toContain("Població governada: PSC, 90,0 % dels habitants");
  });

  it("no dibuixa res quan no hi ha cap força", () => {
    expect(renderPoder([], 0, 0, "de la comarca")).toBe("");
  });
});

describe("renderMapaTerritori", () => {
  const punts = [
    { slug: "a", name: "A", lat: 41.0, lon: 0.5, population: 1_000, mayorBrandId: "erc", mayorSigles: "ERC-AM" },
    { slug: "b", name: "B", lat: 41.5, lon: 1.0, population: 5_000, mayorBrandId: "psc", mayorSigles: "PSC-CP" },
    { slug: "c", name: "C", lat: 41.2, lon: 1.5, population: 300, mayorBrandId: null, mayorSigles: null },
  ];

  it("fa de cada punt un enllaç a la fitxa, no un dibuix mut", () => {
    const html = renderMapaTerritori(punts, "../../", "del Priorat");
    // El punt diu la força i, a sota, els habitants i la llista; la lletra petita, la font.
    expect(html).toContain(
      '<a href="../../m/a/" data-nom="A" data-valor="ERC (ERC-AM)" data-extres="habitants¦1.000‖amb quina llista¦ERC-AM"' +
        ' data-nota="Generalitat · composició dels plens">' +
        "<title>A: ERC (ERC-AM) · habitants: 1.000 · amb quina llista: ERC-AM (Generalitat · composició dels plens)</title>",
    );
    // Sense marca ni sigles, el gris del mapa es diu pel seu nom, i cap llista.
    expect(html).toContain(
      '<a href="../../m/c/" data-nom="C" data-valor="Sense identificar" data-extres="habitants¦300" data-nota="Generalitat · composició dels plens">' +
        "<title>C: Sense identificar · habitants: 300 (Generalitat · composició dels plens)</title>",
    );
    expect(html).toContain('href="../../mapa/"');
  });

  it("pinta de gris el que no s'ha pogut lligar amb cap marca", () => {
    const html = renderMapaTerritori(punts, "../../", "del Priorat");
    expect(html).toContain('fill="#8b8b8b"');
  });

  it("no dibuixa un mapa que no es pugui reconèixer", () => {
    // Amb dos punts situats el dibuix és una ratlla i no diu on és res.
    expect(renderMapaTerritori(punts.slice(0, 2), "../../", "del Priorat")).toBe("");
    const sensePosicio = punts.map((p) => ({ ...p, lat: null, lon: null }));
    expect(renderMapaTerritori(sensePosicio, "../../", "del Priorat")).toBe("");
  });

  it("no se'n va d'alçada amb una comarca molt més alta que ampla", () => {
    // L'Alt Urgell fa el triple d'alt que d'ample: escalat només per amplada
    // sortia un llenç de gairebé dos mil píxels que no cabia en cap pantalla.
    const alta = [
      { ...punts[0]!, lat: 42.6, lon: 1.0 },
      { ...punts[1]!, lat: 42.0, lon: 1.1 },
      { ...punts[2]!, lat: 42.3, lon: 1.05 },
    ];
    const viewBox = /viewBox="0 0 640 (\d+)"/.exec(renderMapaTerritori(alta, "../../", "de l'Alt Urgell"));
    expect(viewBox).not.toBeNull();
    // 430 de dibuix més els dos marges. En el cas extrem —una comarca deu
    // vegades més alta que ampla— el mínim de 60 px d'amplada mana per damunt
    // del sostre d'alçada: val més un mapa un pèl alt que una ratlla vertical.
    expect(Number(viewBox![1])).toBeLessThanOrEqual(560);
  });

  it("escapa el nom del municipi dins del títol del punt", () => {
    const dolent = [{ ...punts[0]!, name: 'A <script>alert("x")</script>', mayorSigles: "A & B" }, punts[1]!, punts[2]!];
    const html = renderMapaTerritori(dolent, "../../", "del Priorat");
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&amp;");
  });
});

describe("renderUllada", () => {
  const p = (over = {}) => ({
    etq: "Municipis", xifra: "23", part: null as number | null,
    peu: "dels 947", on: "#municipis", tema: "urbanisme", ...over,
  });

  it("posa la barra buida quan no hi ha res a mesurar, mai un zero", () => {
    // Una barra plena al zero es llegeix com «l'últim de tots», que és una
    // afirmació que no hem fet: la buida diu el que és, que no hi ha mesura.
    const html = renderUllada([p(), p(), p()], "Prova");
    expect(html).toContain('class="on buida"');
    expect(html).not.toContain("--w:0%");
  });

  it("no obre un panell de resum amb dues xifres", () => {
    expect(renderUllada([p(), p()], "Prova")).toBe("");
  });
});

/**
 * El mapa de la comarca amb els límits municipals de veritat.
 *
 * Es prova amb slugs de debò de la geometria de l'ICGC —no se'n poden inventar,
 * perquè la funció només pinta el que hi troba— i el que s'hi comprova és el
 * que trencaria la peça: que el retall enquadri la comarca i no el país, que
 * cada taca sigui un enllaç i que no es dibuixin els 947 a cada pàgina.
 */
describe("renderMapaComarca", () => {
  const priorat = ["falset", "gratallops", "porrera", "poboleda", "torroja-del-priorat", "margalef"];
  const taques = priorat.map((slug, i) => ({
    slug,
    name: slug,
    mayorName: "Maria Puig",
    mayorSigles: "ERC-AM",
    mayorBrandId: i % 2 === 0 ? "erc" : null,
  }));

  it("hi són, els slugs de la prova, o el mapa no prova res", () => {
    for (const slug of priorat) expect(geometria.municipis[slug], slug).toBeTruthy();
  });

  it("pinta cada terme del color de qui hi mana i el fa enllaç a la seva fitxa", () => {
    const html = renderMapaComarca(taques, "../../", "Priorat");
    expect(html).toContain(
      '<a href="../../m/falset/" data-nom="falset" data-valor="ERC (ERC-AM) · alcaldia: Maria Puig" data-extres="amb quina llista¦ERC-AM"' +
        ' data-nota="Generalitat · composició dels plens">' +
        "<title>falset: ERC (ERC-AM) · alcaldia: Maria Puig · amb quina llista: ERC-AM (Generalitat · composició dels plens)</title>",
    );
    // Sense marca, «Sense identificar», i les sigles i l'alcaldia igualment.
    expect(html).toContain('data-nom="gratallops" data-valor="Sense identificar (ERC-AM) · alcaldia: Maria Puig"');
    // Sense marca, el gris: mai el color de la força del costat.
    expect(html).toContain("--c:#8b8b8b");
  });

  it("l'etiqueta de cada terme diu els habitants, les regidories, i el pacte o el canvi d'alcaldia només quan hi són", () => {
    const html = renderMapaComarca(
      [
        municipi({ slug: "falset", name: "Falset", population: 2_800, seats: 11, winnerGoverns: false, winnerSigles: "JxCat" }),
        municipi({ slug: "gratallops", name: "Gratallops", population: 250, seats: 7, mayorChanged: true, mayorChangeDate: "2024-06-15" }),
        municipi({ slug: "porrera", name: "Porrera", population: 430, seats: 7 }),
      ],
      "../../",
      "Priorat",
    );
    expect(html).toContain(
      'data-extres="habitants¦2.800‖regidories¦11‖amb quina llista¦ERC-AM‖pacte¦governa qui no va guanyar (va guanyar JxCat)"',
    );
    expect(html).toContain('data-extres="habitants¦250‖regidories¦7‖amb quina llista¦ERC-AM‖canvi d\'alcaldia¦a mig mandat, el 15/6/2024"');
    // On no hi ha ni pacte ni canvi no s'hi diu res: un «no» a cada poble seria soroll.
    expect(html).toContain('data-extres="habitants¦430‖regidories¦7‖amb quina llista¦ERC-AM"');
    expect(html).not.toContain("pacte¦governa qui va guanyar");
  });

  it("enquadra la comarca i no Catalunya sencera", () => {
    const html = renderMapaComarca(taques, "../../", "Priorat");
    const vb = /<svg class="gran" viewBox="([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+)"/.exec(html);
    expect(vb).not.toBeNull();
    const [ample, alt] = [Number(vb![3]), Number(vb![4])];
    // El llenç sencer fa 1.600: un retall que s'hi acostés voldria dir que
    // l'enquadrament no s'ha fet i que el lector veu tot el país.
    expect(ample).toBeLessThan(600);
    expect(alt).toBeLessThan(600);
    // I mai molt més alt que ample, que és el que deixava dues franges buides.
    expect(alt / ample).toBeLessThan(1.1);
  });

  it("no dibuixa els 947 a cada pàgina de comarca", () => {
    const html = renderMapaComarca(taques, "../../", "Priorat");
    const camins = (html.match(/<path/g) ?? []).length;
    expect(camins).toBeGreaterThan(priorat.length);
    expect(camins).toBeLessThan(400);
  });

  it("diu on cau, perquè ampliada una comarca perd justament això", () => {
    const html = renderMapaComarca(taques, "../../", "Priorat");
    expect(html).toContain('class="on-cau"');
    expect(html).toContain('class="anella"');
  });

  it("cita la font i la llicència del mapa, que és el que la llicència obliga", () => {
    const html = renderMapaComarca(taques, "../../", "Priorat");
    expect(html).toContain("ICGC");
    expect(html).toContain(geometria.llicencia);
  });

  it("calla quan de cap municipi no en tenim el polígon", () => {
    const inventats = [{ ...taques[0]!, slug: "no-existeix-aquest-poble" }];
    expect(renderMapaComarca(inventats, "../../", "Priorat")).toBe("");
  });

  it("escapa el nom del municipi dins del títol de la taca", () => {
    const dolent = [{ ...taques[0]!, name: 'A <script>alert("x")</script>', mayorSigles: "A & B" }];
    const html = renderMapaComarca(dolent, "../../", "Priorat");
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&amp;");
  });
});

/**
 * Qui hi mana, a la llista de municipis: la cara i la pastilla.
 *
 * La regla que s'hi prova és la que l'encàrrec demana i la que la fitxa
 * municipal ja aplica al ple: **mai un forat**. Qui no té fotografia rep la
 * inicial amb el color del seu grup, que és una peça i no una absència.
 */
describe("la cara i el partit de cada alcaldia", () => {
  it("ensenya el retrat quan l'ajuntament el publica", () => {
    const html = renderComarca(
      comarca({ municipis: [municipi({ mayorFoto: "/observatori/fotos/160/25009.webp" })] }),
      "2026-08-29",
    );
    // És la cara compartida de cara.ts, a 36 px: la mateixa que la portada i la
    // fitxa, i no una de pròpia que un dia deixaria d'assemblar-s'hi.
    expect(html).toContain('<img class="cara-alcaldia petita" style="--mida:36px;" src="/observatori/fotos/160/25009.webp"');
    expect(html).not.toContain('class="retrat');
  });

  it("posa la inicial amb el color del partit quan no en publica, mai un buit", () => {
    const html = renderComarca(comarca({ municipis: [municipi({ mayorFoto: null })] }), "2026-08-29");
    expect(html).toContain('class="cara-alcaldia inicials petita"');
    expect(html).toContain("--mida:36px;");
    // El color d'ERC, no el gris de «no ho sabem».
    expect(html).toContain("--c:#ffb232");
    expect(html).toContain(">MP<");
  });

  it("totes les cares fan la mateixa mida, tinguin foto o no", () => {
    const html = renderComarca(
      comarca({
        municipis: [
          municipi({ slug: "a", mayorFoto: "/observatori/fotos/160/1.webp" }),
          municipi({ slug: "b", mayorFoto: null }),
        ],
      }),
      "2026-08-29",
    );
    expect(html.match(/--mida:36px;/g)).toHaveLength(2);
  });

  it("separa l'alcaldia de la llista en dues columnes, perquè les files facin la mateixa alçada", () => {
    // Amb les etiquetes sota el nom, la fila d'un pacte amb canvi d'alcaldia
    // doblava la del costat. Ara cada cosa té la seva columna i la fila
    // sencera fa l'alçada de la cara.
    const html = renderComarca(
      comarca({ municipis: [municipi({ winnerGoverns: false, mayorChanged: true })] }),
      "2026-08-29",
    );
    expect(html).toContain("<th>Alcaldia</th><th>Amb quina llista</th>");
    const persona = html.slice(html.indexOf('<td class="mana">'), html.indexOf("</td>", html.indexOf('<td class="mana">')));
    expect(persona).not.toContain('class="sigla"');
    expect(persona).not.toContain("marca-pacte");
    const llista = html.slice(html.indexOf('<td class="llista">'), html.indexOf("</td>", html.indexOf('<td class="llista">')));
    expect(llista).toContain('href="../../partit/erc/"');
    expect(llista).toContain('<span class="marca-pacte">pacte</span>');
    expect(llista).toContain("canvi a mig mandat");
  });

  it("la cara i el nom porten a la fitxa de la persona, dos nivells amunt", () => {
    const html = renderComarca(
      comarca({ municipis: [municipi({ mayorFoto: "/observatori/fotos/160/25009.webp", mayorAdreca: "regidor/maria-puig/" })] }),
      "2026-08-29",
    );
    const enllac = html.slice(html.indexOf('<a class="persona"'), html.indexOf("</a>", html.indexOf('<a class="persona"')));
    expect(enllac).toContain('href="../../m/un-poble/regidor/maria-puig/"');
    expect(enllac).toContain('src="/observatori/fotos/160/25009.webp"');
    expect(enllac).toContain("Maria Puig");
    // La pastilla del partit és un altre enllaç i va fora d'aquest.
    expect(enllac).not.toContain("partit/erc/");
  });

  it("sense fitxa de persona, el nom porta a l'apartat d'alcaldies del municipi", () => {
    const html = renderComarca(comarca({ municipis: [municipi({ mayorAdreca: null })] }), "2026-08-29");
    expect(html).toContain('<a class="persona" href="../../m/un-poble/#alcaldies">');
  });

  it("i sense nom no hi ha enllaç: no hi ha ningú a qui anar a veure", () => {
    const html = renderComarca(comarca({ municipis: [municipi({ mayorName: null, mayorAdreca: null })] }), "2026-08-29");
    expect(html).not.toContain('<a class="persona"');
    expect(html).toContain("Sense dada");
    // I el cercle porta un interrogant, no un forat ni unes inicials de ningú.
    expect(html).toContain(">?<");
  });

  it("fa clicable la pastilla del partit, que abans no portava enlloc", () => {
    const html = renderComarca(comarca(), "2026-08-29");
    expect(html).toContain('href="../../partit/erc/"');
  });

  it("no enllaça les sigles que no són de cap partit conegut", () => {
    // Sota «llistes locals» hi ha centenars de candidatures que no tenen res a
    // veure: ajuntar-les diria que existeix un partit que no existeix.
    const html = renderComarca(
      comarca({ municipis: [municipi({ mayorSigles: "IND-VEÏNS", mayorBrandId: null })] }),
      "2026-08-29",
    );
    expect(html).toContain("IND-VEÏNS");
    expect(html).not.toContain('href="../../partit/null/"');
  });
});

/**
 * La comparació entre els municipis de la comarca.
 *
 * És la peça que la pàgina no tenia: deia com és la comarca contra Catalunya i
 * mai com de diferents són els seus pobles per dins.
 */
describe("la dispersió entre municipis", () => {
  const ambRenda = (valors: readonly number[]): ComarcaData =>
    comarca({
      municipis: valors.map((renda, i) =>
        municipi({ slug: `poble-${i}`, name: `Poble ${i}`, renda, souAlcaldia: null }),
      ),
      indicadors: [],
    });

  it("posa el més baix, la mediana i el més alt, i tots tres amb la xifra escrita", () => {
    const html = renderComarca(ambRenda([11_000, 14_000, 16_000, 24_000]), "2026-08-29");
    expect(html).toContain("El més baix");
    expect(html).toContain("El més alt");
    expect(html).toContain("11.000 €");
    expect(html).toContain("24.000 €");
    // La mediana de quatre valors és la mitjana dels dos del mig: 15.000.
    expect(html).toContain("15.000 €");
  });

  it("cada marca és un enllaç a la fitxa d'aquell municipi", () => {
    const html = renderComarca(ambRenda([11_000, 14_000, 16_000, 24_000]), "2026-08-29");
    expect(html).toContain('class="marca" style="--p:4.00%" href="../../m/poble-0/"');
    expect(html).toContain("--p:96.00%");
  });

  it("no dibuixa una dispersió amb tres xifres ni quan totes són iguals", () => {
    expect(renderComarca(ambRenda([11_000, 14_000, 16_000]), "2026-08-29")).not.toContain('class="dispersio"');
    expect(renderComarca(ambRenda([9, 9, 9, 9]), "2026-08-29")).not.toContain('class="dispersio"');
  });

  it("obre la secció encara que no hi hagi cap indicador comarcal", () => {
    // La secció penjava només dels indicadors; amb la comparació interna
    // sola, el bloc existia i l'índex no hi portava.
    const html = renderComarca(ambRenda([11_000, 14_000, 16_000, 24_000]), "2026-08-29");
    expect(html).toContain('id="indicadors"');
    expect(html).toContain('<a href="#indicadors">');
  });
});

/**
 * Els salts de la portada: el mapa, els rànquings i, només on toca, l'AMB.
 *
 * El que s'hi prova és que no hi hagi cap enllaç decoratiu: l'Àrea
 * Metropolitana només surt a les comarques que hi tenen municipis, i a les
 * altres 38 no se n'ha de parlar.
 */
describe("els salts de la portada", () => {
  it("porta al mapa de Catalunya i als rànquings dels 947", () => {
    const html = renderComarca(comarca(), "2026-08-29");
    const salts = html.slice(html.indexOf('<p class="salts">'), html.indexOf("</p>", html.indexOf('<p class="salts">')));
    expect(salts).toContain('href="../../mapa/"');
    expect(salts).toContain('href="../../ranquings/"');
    expect(salts).toContain("rànquings dels 947");
  });

  it("enllaça l'Àrea Metropolitana només a les comarques que hi tenen municipis", () => {
    // El peu compartit enllaça l'AMB a totes les pàgines: el que no hi ha de
    // ser és a la portada ni al cos, on diria que la comarca hi té a veure.
    const fora = renderComarca(comarca({ metropolitans: 0 }), "2026-08-29");
    const cos = fora.slice(fora.indexOf('<main id="contingut">'), fora.indexOf("</main>"));
    expect(cos).not.toContain('href="../../amb/"');
    expect(cos).not.toContain("Àrea Metropolitana");

    const dins = renderComarca(
      comarca({ municipis: [municipi({ slug: "a" }), municipi({ slug: "b" }), municipi({ slug: "c" })], metropolitans: 2 }),
      "2026-08-29",
    );
    expect(dins).toContain("2 dels seus 3 municipis són de l'<a href=\"../../amb/\">Àrea Metropolitana de Barcelona</a>");
    // I ho torna a dir al bloc que explica què és una comarca, que és on cal.
    expect(dins).toContain("2 d'aquests municipis són\n  també de l'<a href=\"../../amb/\">");
  });

  it("diu «tots» quan tots hi són, com al Barcelonès", () => {
    const html = renderComarca(comarca({ municipis: [municipi({ slug: "a" }), municipi({ slug: "b" })], metropolitans: 2 }), "2026-08-29");
    expect(html).toContain("Tots els seus municipis són de l'<a href=\"../../amb/\">");
  });
});

describe("l'etiqueta dels gràfics", () => {
  it("la pàgina porta el script de l'etiqueta una sola vegada, abans de tancar el cos", () => {
    const html = renderComarca(comarca(), "2026-08-29");
    expect(html.match(/<script id="grafics-etiqueta">/g)?.length).toBe(1);
    expect(html.indexOf('<script id="grafics-etiqueta">')).toBeLessThan(html.indexOf("</body>"));
  });
});

describe("el cap SEO de la comarca", () => {
  const titolDe = (html: string): string => /<title>([^<]*)<\/title>/.exec(html)![1]!;
  const descripcioDe = (html: string): string => /<meta name="description" content="([^"]*)"/.exec(html)![1]!;
  const jsonLdDe = (html: string): Record<string, unknown>[] =>
    [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1]!));
  const filDe = (html: string): { name: string; item: string }[] =>
    (jsonLdDe(html).find((o) => o["@type"] === "BreadcrumbList")!.itemListElement as { name: string; item: string }[]);

  const html = renderComarca(comarca({ municipis: [municipi(), municipi({ slug: "b", name: "B", winnerGoverns: false })], pacte: 1 }), "2026-08-29");

  it("es titula amb la comarca i els seus municipis, i descriu les xifres de la ullada", () => {
    expect(titolDe(html)).toBe("Priorat: qui mana als 2 municipis · quivoto");
    expect(descripcioDe(html)).toBe(
      "Qui mana al Priorat: alcaldies per força als 2 municipis (9.376 habitants), 1 governat per qui no va guanyar i 0 canvis d'alcaldia.",
    );
    expect(html).toContain('<link rel="canonical" href="https://quivoto.cat/observatori/c/priorat/">');
  });

  it("passa per l'índex de comarques al fil d'Ariadna i es declara AdministrativeArea dins de Catalunya", () => {
    expect(filDe(html).map((i) => i.name)).toEqual(["quivoto", "Observatori municipal", "Les comarques", "Priorat"]);
    expect(filDe(html)[2]!.item).toBe("https://quivoto.cat/observatori/c/");
    const area = jsonLdDe(html).find((o) => o["@type"] === "AdministrativeArea")!;
    expect(area.name).toBe("Priorat");
    expect(area.url).toBe("https://quivoto.cat/observatori/c/priorat/");
  });

  it("porta els municipis com a containsPlace, cadascun amb la seva fitxa", () => {
    const area = jsonLdDe(html).find((o) => o["@type"] === "AdministrativeArea")!;
    const dins = area.containsPlace as { "@type": string; name: string; url: string }[];
    expect(dins).toHaveLength(2);
    // Cada municipi és el mateix node que declara la seva fitxa: el mateix `@id`.
    expect(dins[1]).toEqual({
      "@type": "City", "@id": "https://quivoto.cat/observatori/m/b/#municipi", name: "B", url: "https://quivoto.cat/observatori/m/b/",
    });
    expect(dins.every((m) => m["@type"] === "City")).toBe(true);
  });

  it("escapa el nom també al cap", () => {
    const dolent = renderComarca(comarca({ name: 'Pla <script>alert("x")</script>' }), "avui");
    // Al JSON-LD el nom hi va tal qual, que és JSON i no HTML: el que no pot
    // passar és que un `</script>` de dins tanqui l'etiqueta abans d'hora.
    expect(dolent).not.toContain('alert("x")</script>');
    expect(titolDe(dolent)).toContain("&lt;script&gt;");
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

describe("el consell comarcal a la pàgina de comarca", () => {
  const bages = comarca({ slug: "bages", name: "Bages" });
  const consell = ensDeProva({
    slug: "bages",
    comarca: { slug: "bages", nom: "Bages" },
    seients: 33,
    composicio: [
      { partit: "ERC", seients: 14, color: "#ffb232" },
      { partit: "PSC", seients: 12, color: "#e3001b" },
      { partit: "", seients: 7, color: null },
    ],
    presidencia: membreDeProva({
      nom: "Anna Puig Serra",
      carrec: "Presidenta",
      rol: "presidencia",
      municipi: { slug: "manresa", nom: "Manresa" },
      adreca: "regidor/anna-puig-serra/",
      alcaldia: true,
    }),
  });
  const diputacio = ensDeProva({ tipus: "diputacio", comarques: [{ slug: "bages", nom: "Bages" }] });

  it("sense ens, la pàgina queda exactament com era", () => {
    expect(renderComarca(bages, "avui", undefined)).toBe(renderComarca(bages, "avui"));
    expect(renderComarca(bages, "avui", [])).toBe(renderComarca(bages, "avui"));
    expect(renderComarca(bages, "avui")).not.toContain('id="consell"');
  });

  it("presenta el consell just després de «Qui mana», amb l'enllaç a la seva fitxa i a l'índex", () => {
    const html = renderComarca(bages, "avui", [consell, diputacio]);
    const alcaldies = html.indexOf('id="alcaldies"');
    const bloc = html.indexOf('id="consell"');
    expect(bloc).toBeGreaterThan(alcaldies);
    expect(bloc).toBeLessThan(html.indexOf('id="pactes"') === -1 ? Infinity : html.indexOf('id="pactes"'));
    expect(html).toContain('<a href="#consell">El consell comarcal</a>');
    expect(html).toContain('<a href="consell/">La fitxa del consell</a>');
    expect(html).toContain("Consell Comarcal del Bages té 33 escons");
  });

  it("la presidència porta la cara, el càrrec literal i la fitxa de la persona", () => {
    const html = renderComarca(bages, "avui", [consell]);
    expect(html).toContain('<span class="ens-carrec">Presidenta</span>');
    expect(html).toContain('href="../../m/manresa/regidor/anna-puig-serra/"');
    expect(html).toContain("té l'alcaldia de Manresa");
    expect(html).toMatch(/class="cara-alcaldia inicials petita"[^>]*>AP</);
  });

  it("sense aparellament únic, el nom de qui presideix no s'enllaça", () => {
    const html = renderComarca(bages, "avui", [
      { ...consell, presidencia: membreDeProva({ nom: "Joan Riera", carrec: "President", municipi: null, adreca: null }) },
    ]);
    expect(html).toContain('<b class="ens-nom">Joan Riera</b>');
  });

  it("la composició és una cinta amb llegenda; qui no té partit conegut no es reparteix", () => {
    const html = renderComarca(bages, "avui", [consell]);
    expect(html).toContain('aria-label="Composició del ple, 33 escons: ERC 14, PSC 12, sense partit conegut 7"');
    expect(html).toContain("flex:14;--c:#ffb232");
    // Sense color de dada, gris neutre: cap color de veredicte.
    expect(html).toContain("flex:7;--c:#8b8b8b");
  });

  it("enllaça la diputació, o les dues quan la comarca en té dues", () => {
    const una = renderComarca(bages, "avui", [consell, diputacio]);
    expect(una).toContain('la <a href="../../diputacio/barcelona/">Diputació de Barcelona</a>');
    const girona = ensDeProva({ tipus: "diputacio", nom: "Diputació de Girona", slug: "girona", comarques: [{ slug: "bages", nom: "Bages" }] });
    const dues = renderComarca(bages, "avui", [consell, diputacio, girona]);
    expect(dues).toContain("Diputació de Barcelona</a> i la <a href=\"../../diputacio/girona/\">");
    expect(dues).toContain("que tampoc no es voten");
  });

  it("al Barcelonès diu que el consell es va dissoldre el 2019, i no enllaça cap fitxa", () => {
    const html = renderComarca(comarca({ slug: "barcelones", name: "Barcelonès" }), "avui", [consell, diputacio]);
    expect(html).toContain("no té consell comarcal des del 2019");
    expect(html).toContain("Llei 1/2019");
    expect(html).not.toContain('href="consell/"');
  });

  it("al Lluçanès diu que no en tindrà fins després del maig del 2027", () => {
    const html = renderComarca(comarca({ slug: "llucanes", name: "Lluçanès" }), "avui", [consell]);
    expect(html).toContain("maig del 2027");
    expect(html).not.toContain('href="consell/"');
  });
});

describe("l'índex de comarques enllaça l'índex d'ens", () => {
  // El peu compartit ja enllaça l'índex d'ens a totes les pàgines: el que es
  // prova és la crida del cos, al costat de la de l'AMB.
  const cos = (html: string): string => html.slice(html.indexOf('<main id="contingut">'), html.indexOf("</main>"));
  it("només si hi ha fitxes d'ens publicades", () => {
    expect(cos(renderComarquesIndex([], "avui", null))).not.toContain('href="../ens/"');
    expect(cos(renderComarquesIndex([], "avui", null, []))).not.toContain('href="../ens/"');
    const html = cos(renderComarquesIndex([], "avui", null, [ensDeProva(), ensDeProva({ tipus: "diputacio" })]));
    expect(html).toContain('<a href="../ens/">el consell comarcal i la diputació</a>');
    const molts = cos(renderComarquesIndex([], "avui", null, [ensDeProva(), ensDeProva({ slug: "anoia" }), ensDeProva({ tipus: "diputacio" })]));
    expect(molts).toContain("els 2 consells comarcals i la diputació");
  });
});

/**
 * «La tira del poble» a la llista de municipis: qui ha tingut l'alcaldia de
 * cada mandat des del 1979, en una columna pròpia perquè els mandats quedin
 * l'un sota l'altre.
 */
describe("la tira del poble a la llista de municipis", () => {
  const tira = tiraDesDeHistorial(
    {
      history: [
        { term: "2023-2027", name: "MARIA PUIG SOLER", partyRaw: "ERC-AM", tookOfficeOn: "2023-06-17" },
        { term: "2019-2023", name: "JOAN ROIG CASTELL", partyRaw: "CiU", tookOfficeOn: "2019-06-15" },
      ],
    },
    "un Poble",
    "2026-10-27",
  );

  it("porta una columna amb els dos extrems a la capçalera i la tira fina a cada fila", () => {
    const html = renderComarca(comarca({ municipis: [municipi({ tira })] }), "2026-08-29");
    expect(html).toContain('<th class="historia"><span class="historia-titol">Alcaldies des del 1979</span>');
    expect(html).toContain("<span>1979</span><span>2027</span>");
    const cela = html.slice(html.indexOf('<td class="historia">'), html.indexOf("</td>", html.indexOf('<td class="historia">')));
    expect(cela).toContain('class="tp tp-fina" role="img"');
    // La frase per als lectors de pantalla diu qui i de quin partit.
    expect(cela).toContain("Qui ha tingut l&#39;alcaldia d&#39;un Poble".replace(/&#39;/g, "'"));
    // I el full d'estil de la tira hi és, un sol cop.
    expect(html.split(".tp-mandat{").length - 1).toBe(1);
  });

  it("deixa la cel·la buida, sense ni un espai, al poble que no té historial", () => {
    const html = renderComarca(
      comarca({ municipis: [municipi({ tira }), municipi({ slug: "altre", name: "Altre", tira: null })] }),
      "2026-08-29",
    );
    expect(html).toContain('<td class="historia"></td>');
  });

  it("sense cap tira, ni columna ni full d'estil: la pàgina queda com era", () => {
    const html = renderComarca(comarca(), "2026-08-29");
    expect(html).not.toContain('class="historia"');
    expect(html).not.toContain(".tp-mandat{");
  });
});

describe("la ullada no repeteix ni la frase d'entrada ni la icona", () => {
  const html = renderComarca(
    comarca({
      habitants: 10_000,
      forces: [{ brandId: "erc", label: "ERC", color: "#ffb232", alcaldies: 1, habitants: 6_000 }],
    }),
    "2026-08-29",
  );
  const ullada = html.slice(html.indexOf('<section class="ullada"'), html.indexOf("</section>", html.indexOf('<section class="ullada"')));

  it("la quarta pastilla diu la gent que viu on mana la primera força, no les seves alcaldies", () => {
    expect(ullada).toContain("Viuen on mana ERC");
    expect(ullada).toContain("60,0 %");
    expect(ullada).toContain("6.000 dels 10.000 habitants");
    expect(ullada).not.toContain("La força amb més alcaldies");
  });

  it("el canvi d'alcaldia porta la mà alçada, i no la mateixa medalla que la força", () => {
    expect(ullada.split('aria-label="Alcaldia"').length - 1).toBe(1);
    expect(ullada).toContain('aria-label="Participació"');
  });

  it("parla del maig del 2027 i no d'una sigla", () => {
    expect(ullada).toContain("Regidories en joc el 2027");
    expect(ullada).not.toContain("23-M");
  });
});

describe("l'article de cada comarca", () => {
  it("contrau la preposició com toca", () => {
    expect(aLaComarca("Pla d'Urgell")).toBe("al Pla d'Urgell");
    expect(aLaComarca("Selva")).toBe("a la Selva");
    expect(aLaComarca("Anoia")).toBe("a l'Anoia");
    expect(aLaComarca("Garrigues")).toBe("a les Garrigues");
    expect(aLaComarca("Osona")).toBe("a Osona");
  });

  it("no s'inventa l'article d'una comarca que no coneix", () => {
    expect(comarcaAmbArticle("Comarca Nova")).toBe("Comarca Nova");
  });

  it("escriu bé la comarca dins de les frases de la pàgina", () => {
    const html = renderComarca(comarca({ slug: "bages", name: "Bages" }), "2026-08-29");
    expect(html).toContain("ajuntaments</b> del Bages");
    expect(html).toContain("Qui mana al Bages:");
  });

  it("diu al cercador de quin dia són les dades", () => {
    const html = renderComarca(comarca(), "2026-08-29");
    expect(html).toContain('"dateModified":"2026-08-29"');
  });
});

describe("cap fletxa als enllaços", () => {
  it("ni al peu del mapa ni enlloc del cos", () => {
    const html = renderComarca(comarca(), "2026-08-29");
    const cos = html.slice(html.indexOf('<main id="contingut">'), html.indexOf("</main>"));
    expect(cos).not.toContain("→");
  });
});
