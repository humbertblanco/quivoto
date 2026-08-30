import { describe, expect, it } from "vitest";
import {
  COMPETENCIES,
  DINERS,
  buildIndicador,
  renderAmb,
  summarySentence,
  type AmbData,
  type AmbMunicipi,
} from "./amb";
import type { PeerGroup } from "../derive/peers";

/**
 * La pàgina es genera sense cap model pel mig, i el que s'ha de provar no és que
 * «quedi bé» sinó tres coses: que cap xifra no es contradigui amb una altra, que
 * res del que arriba de les fonts no pugui colar-hi etiquetes, i —la que és
 * pròpia d'aquesta pàgina— que **cada frase sobre què decideix l'AMB porti
 * l'article de la llei que ho diu**. Sense això seria una pàgina d'opinions
 * sobre una administració, que és exactament el que el projecte no vol ser.
 */

function municipi(over: Partial<AmbMunicipi> = {}): AmbMunicipi {
  return {
    slug: "cornella-de-llobregat", name: "Cornellà de Llobregat", comarca: "Baix Llobregat",
    population: 92_237, seats: 25,
    mayorName: "Antonio Balmón", mayorSigles: "PSC-CP", mayorBrandId: "psc",
    winnerSigles: "PSC-CP", winnerGoverns: true, hasMajority: true,
    mayorChanged: false, mayorChangeName: null, mayorChangeDate: null,
    ...over,
  };
}

function amb(over: Partial<AmbData> = {}): AmbData {
  const municipis = over.municipis ?? [municipi()];
  return {
    nom: "Àrea Metropolitana de Barcelona",
    habitants: 3_468_778, regidories: 787, poblacioMediana: 27_197,
    forces: [{ brandId: "psc", label: "PSC", color: "#e73b39", alcaldies: 1, habitants: 92_237 }],
    governaMesVotat: 1, pacte: 0, senseIdentificar: 0, majoriaAbsoluta: 1, canvisAlcaldia: 0,
    indicadors: [],
    comarques: [{ slug: "baix-llobregat", name: "Baix Llobregat", dins: 24, total: 30 }],
    catalunya: { municipis: 947, habitants: 8_012_231 },
    ...over,
    municipis,
  };
}

describe("les competències, que són el cor de la pàgina", () => {
  it("porta l'article de la llei a cada matèria, sense excepció", () => {
    // Si una targeta es queda sense article, la pàgina afirma què decideix una
    // administració sense dir d'on ho treu. Això no pot passar mai.
    for (const c of COMPETENCIES) {
      expect(c.article, c.titol).toMatch(/^articles? \d/);
      expect(c.que.trim().length, c.titol).toBeGreaterThan(40);
      expect(c.queNo.trim().length, c.titol).toBeGreaterThan(20);
    }
    for (const d of DINERS) expect(d.article).toMatch(/^articles? \d/);
  });

  it("no repeteix cap clau, que és el que ancora els enllaços interns", () => {
    expect(new Set(COMPETENCIES.map((c) => c.clau)).size).toBe(COMPETENCIES.length);
  });

  it("diu el transport, l'aigua, els residus, les platges i l'habitatge", () => {
    // Són les cinc que fan que valgui la pena tenir la pàgina: el que la gent
    // creu que decideix el seu ajuntament i no decideix.
    const html = renderAmb(amb(), "2026-08-29");
    for (const paraula of ["autobús", "aigua potable", "residus municipals", "platges", "habitatge assequible"]) {
      expect(html, paraula).toContain(paraula);
    }
  });

  it("diu sempre on s'acaba l'AMB, no només què fa", () => {
    const html = renderAmb(amb(), "2026-08-29");
    expect(html).toContain("On s'acaba:");
    // El tramvia és el cas exemplar: és transport metropolità i no és de l'AMB.
    expect(html).toContain("El tramvia no");
  });

  it("no diu ni una xifra del que fa l'AMB avui, que no hem pogut comprovar", () => {
    // `www.amb.cat` respon 403 a qualsevol client automàtic. La pàgina ho ha de
    // reconèixer en comptes de fabricar-ne dades.
    const html = renderAmb(amb(), "2026-08-29");
    expect(html).toContain("403");
    expect(html).toContain("https://www.amb.cat/");
  });
});

describe("renderAmb", () => {
  it("escapa el que ve de les fonts, que no és de fiar", () => {
    const html = renderAmb(
      amb({ municipis: [municipi({ name: 'Sant <script>alert("x")</script>', mayorSigles: "A & B" })] }),
      "2026-08-29",
    );
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("A &amp; B");
  });

  it("enllaça cada municipi amb la seva fitxa, un nivell amunt", () => {
    // La pàgina viu a `observatori/amb/`, no a `observatori/c/<comarca>/`: si es
    // copiessin els `../../` de les comarques, els 36 enllaços anirien a lloc.
    const html = renderAmb(amb(), "2026-08-29");
    expect(html).toContain('href="../m/cornella-de-llobregat/"');
    expect(html).not.toContain('href="../../m/');
    expect(html).toContain('href="../c/baix-llobregat/"');
  });

  it("diu de quants municipis parla cada comparació", () => {
    const html = renderAmb(amb({ forces: [{ brandId: "psc", label: "PSC", color: "#e73b39", alcaldies: 1, habitants: 92_237 }] }), "2026-08-29");
    expect(html).toContain("alcaldia de 1");
    expect(html).toContain("dels 947 de Catalunya");
  });

  it("marca l'excepció i no la norma a la llista de municipis", () => {
    const html = renderAmb(
      amb({
        municipis: [municipi({ winnerGoverns: false, hasMajority: true, winnerSigles: "ERC-AM" })],
        governaMesVotat: 0, pacte: 1, majoriaAbsoluta: 0,
      }),
      "2026-08-29",
    );
    expect(html).toContain('<span class="marca-pacte">pacte</span>');
    expect(html).not.toContain(">majoria absoluta</span>");
    const partit = renderAmb(amb({ municipis: [municipi({ hasMajority: false })] }), "2026-08-29");
    expect(partit).toContain(">ple sense majoria</span>");
  });

  it("diu que no hi ha hagut cap canvi d'alcaldia en comptes de callar", () => {
    const html = renderAmb(amb(), "2026-08-29");
    expect(html).toContain("no ha canviat d'alcaldia");
  });

  it("no s'inventa una secció d'indicadors quan no en té cap", () => {
    expect(renderAmb(amb({ indicadors: [] }), "2026-08-29")).not.toContain('id="indicadors"');
  });

  it("posa la mediana catalana al costat de la metropolitana, mai sola", () => {
    const html = renderAmb(
      amb({
        indicadors: [{
          key: "deute-habitant", label: "Deute per habitant", unit: "euros",
          metropolita: 412, catalana: 285, ambDada: 34, ambDadaCatalunya: 921,
          percentilGrup: 61, nota: "Deute viu a 31 de desembre.",
        }],
      }),
      "2026-08-29",
    );
    expect(html).toContain("Mediana catalana");
    expect(html).toContain("Percentil");
    expect(html).toContain("34 de 1");
  });

  it("no dona el nombre de consellers de cap municipi, perquè no el podem saber", () => {
    // La llei mana comptar el padró de les eleccions de què va sortir el Consell,
    // i el que tenim és el d'avui. Publicar-ho seria inventar-se la composició
    // d'un òrgan que aprova el que paga la gent.
    const html = renderAmb(amb(), "2026-08-29");
    expect(html).toContain("Ningú no vota el Consell Metropolità");
    expect(html).toContain("el padró que tenim nosaltres és el d'avui");
  });

  it("no deixa el singular i el plural barrejats", () => {
    const una = renderAmb(
      amb({
        municipis: [municipi({ mayorChanged: true, mayorChangeName: "Anna Roig", mayorChangeDate: "2025-06-14" })],
        canvisAlcaldia: 1,
      }),
      "2026-08-29",
    );
    expect(una).toContain("14 de juny del 2025");
    expect(una).toContain("Anna Roig");
  });

  it("porta títol, full d'estil, mascota i peu, perquè és una pàgina autònoma", () => {
    const html = renderAmb(amb(), "2026-08-29");
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<title>Àrea Metropolitana de Barcelona — Observatori municipal de quivoto</title>");
    expect(html).toContain("--paper:#FBF7EE");
    expect(html).toContain("mascota de quivoto");
    // El peu compartit escriu la data amb les seves paraules; el que ha de ser
    // cert és que la pàgina digui de quin dia és.
    expect(html).toContain('<footer class="peu">');
    expect(html).toContain("2026-08-29");
  });
});

describe("summarySentence", () => {
  it("diu de quants municipis es tracta, sempre", () => {
    const frase = summarySentence(amb({
      forces: [{ brandId: "psc", label: "PSC", color: "#e73b39", alcaldies: 20, habitants: 2_000_000 }],
      municipis: Array.from({ length: 36 }, (_, i) => municipi({ slug: `m${i}`, name: `M${i}` })),
    }));
    expect(frase).toContain("dels 36 municipis metropolitans");
    expect(frase).toContain("més de la meitat");
  });

  it("no proclama guanyador quan hi ha empat", () => {
    const frase = summarySentence(amb({
      forces: [
        { brandId: "psc", label: "PSC", color: "#e73b39", alcaldies: 12, habitants: 9 },
        { brandId: "erc", label: "ERC", color: "#ffb232", alcaldies: 12, habitants: 9 },
      ],
    }));
    expect(frase).toContain("empaten");
    expect(frase).not.toContain("més de la meitat");
  });

  it("calla si l'alcaldia més repetida no s'ha pogut lligar amb cap marca", () => {
    const frase = summarySentence(amb({
      forces: [{ brandId: "sense-identificar", label: "Sense identificar", color: "#8b8b8b", alcaldies: 3, habitants: 9 }],
    }));
    expect(frase).toBe("");
  });
});

describe("buildIndicador", () => {
  const peers = new Map<number, PeerGroup>([
    [1, { key: "a", label: "grup A", size: 4 } as PeerGroup],
    [2, { key: "a", label: "grup A", size: 4 } as PeerGroup],
    [3, { key: "a", label: "grup A", size: 4 } as PeerGroup],
    [4, { key: "a", label: "grup A", size: 4 } as PeerGroup],
  ]);
  const def = { key: "deute-habitant", label: "Deute per habitant", unit: "euros" as const, nota: "." };
  const lectures = [
    { municipalityId: 1, value: 100 },
    { municipalityId: 2, value: 200 },
    { municipalityId: 3, value: 300 },
    { municipalityId: 4, value: 400 },
  ];

  it("compara la mediana metropolitana amb la de tot el conjunt, no amb ella mateixa", () => {
    const indicador = buildIndicador(def, lectures, new Set([1, 2]), peers)!;
    expect(indicador.metropolita).toBe(150);
    expect(indicador.catalana).toBe(250);
    expect(indicador.ambDada).toBe(2);
    expect(indicador.ambDadaCatalunya).toBe(4);
  });

  it("no publica un percentil calculat amb tres municipis, que és soroll", () => {
    expect(buildIndicador(def, lectures, new Set([1, 2, 3]), peers)!.percentilGrup).toBeNull();
    expect(buildIndicador(def, lectures, new Set([1, 2, 3, 4]), peers)!.percentilGrup).not.toBeNull();
  });

  it("no inventa un indicador quan cap municipi metropolità no en té dada", () => {
    expect(buildIndicador(def, lectures, new Set([99]), peers)).toBeNull();
  });
});
