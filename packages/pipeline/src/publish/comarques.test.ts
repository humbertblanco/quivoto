import { describe, expect, it } from "vitest";
import {
  renderComarca, renderMapaComarca, renderMapaTerritori, renderPoder, renderUllada,
  type ComarcaData, type ComarcaMunicipi,
} from "./comarques";
import { geometria } from "./mapa";

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

  it("posa la mediana catalana al costat de la comarcal, mai sola", () => {
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
    expect(html).toContain("Mediana catalana");
    expect(html).toContain("Percentil");
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
    expect(html).toContain("<title>Priorat — Observatori municipal de quivoto</title>");
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
    expect(html).toContain('<a href="../../m/a/">');
    expect(html).toContain("<title>A — ERC-AM</title>");
    // Sense sigles no s'inventa cap guionet penjat després del nom.
    expect(html).toContain("<title>C</title>");
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
    expect(html).toContain('<a href="../../m/falset/">');
    expect(html).toContain("<title>falset — Maria Puig — ERC-AM</title>");
    // Sense marca, el gris: mai el color de la força del costat.
    expect(html).toContain("--c:#8b8b8b");
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
    expect(html).toContain('<img class="retrat" src="/observatori/fotos/160/25009.webp"');
  });

  it("posa la inicial amb el color del partit quan no en publica, mai un buit", () => {
    const html = renderComarca(comarca({ municipis: [municipi({ mayorFoto: null })] }), "2026-08-29");
    expect(html).toContain('class="retrat inicials"');
    expect(html).toContain(">MP<");
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
