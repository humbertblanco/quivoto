import { describe, expect, it } from "vitest";
import { renderComarca, type ComarcaData, type ComarcaMunicipi } from "./comarques";

/**
 * La pàgina es genera sense cap model pel mig, així que el que s'ha de provar
 * no és que «quedi bé» sinó que cap xifra no es contradigui amb una altra i que
 * res del que arriba de les fonts —cometes, cognoms amb `&`— no pugui trencar
 * la pàgina ni colar-hi etiquetes.
 */

function municipi(over: Partial<ComarcaMunicipi> = {}): ComarcaMunicipi {
  return {
    slug: "un-poble", name: "un Poble", population: 1_200, seats: 9,
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
    indicadors: [], altres: [{ slug: "priorat", name: "Priorat", municipis: 23 }],
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
