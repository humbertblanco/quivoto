import { describe, expect, it } from "vitest";
import {
  renderComarca, renderMapaTerritori, renderPoder, renderUllada,
  type ComarcaData, type ComarcaMunicipi,
} from "./comarques";

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
