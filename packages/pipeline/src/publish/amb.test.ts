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
    population: 92_237, lat: 41.355, lon: 2.075, seats: 25,
    mayorName: "Antonio Balmón", mayorSigles: "PSC-CP", mayorBrandId: "psc",
    winnerSigles: "PSC-CP", winnerGoverns: true, hasMajority: true,
    mayorChanged: false, mayorChangeName: null, mayorChangeDate: null,
    valors: {},
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
    situacio: [],
    comarques: [{ slug: "baix-llobregat", name: "Baix Llobregat", dins: 24, total: 30 }],
    catalunya: {
      municipis: 947, habitants: 8_012_231, regidories: 9_104,
      pacte: 214, majoriaAbsoluta: 520, canvisAlcaldia: 61,
    },
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
    expect(html.replace(/\s+/g, " ")).toContain("<b>1</b> alcaldia de 1");
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
          qui: "ajuntament", article: "",
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
    expect(html).toContain("Ningú no el vota en una papereta");
    expect(html).toContain("el que tenim és el d'avui");
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
  const def = {
    key: "deute-habitant", label: "Deute per habitant", unit: "euros" as const,
    qui: "ajuntament" as const, nota: ".",
  };
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


/**
 * La pàgina és la fitxa d'un poble un pis amunt, i el que s'ha de provar és
 * justament això: que obre igual, que el poder s'hi veu i que d'aquí se surt
 * cap als 36 municipis i cap al mapa.
 */
describe("l'AMB llegida com una fitxa", () => {
  it("obre amb la mateixa ullada que un municipi, i amb Catalunya al costat", () => {
    const html = renderAmb(amb(), "2026-08-29");
    expect(html).toContain('class="ullada"');
    expect(html).toContain("dels 947 de Catalunya");
    expect(html).toContain("de les 9.104 de Catalunya");
    // La xifra que fa que la pàgina existeixi ha de ser a la portada.
    expect(html).toContain("Matèries que decideix l'AMB");
  });

  it("no repeteix a l'entrada les xifres que hi ha just a sota", () => {
    const html = renderAmb(amb(), "2026-08-29");
    expect(html).not.toContain("regidories en total");
    expect(html).not.toContain('class="resum-xifres"');
  });

  it("no diu «1 comarques» quan només n'hi ha una", () => {
    const html = renderAmb(amb(), "2026-08-29");
    expect(html).toContain("repartits entre 1 comarca");
    expect(html).not.toContain("entre 1 comarques");
  });

  it("ensenya el poder en dues cintes i no en una llista de barres", () => {
    const html = renderAmb(
      amb({
        forces: [
          { brandId: "psc", label: "PSC", color: "#e73b39", alcaldies: 3, habitants: 900_000 },
          { brandId: "erc", label: "ERC", color: "#ffb232", alcaldies: 7, habitants: 100_000 },
        ],
        municipis: Array.from({ length: 10 }, (_, i) => municipi({ slug: `m${i}`, name: `M${i}` })),
        habitants: 1_000_000,
      }),
      "2026-08-29",
    );
    expect(html).toContain('class="tira"');
    // El PSC té el 30 % de les alcaldies i el 90 % de la gent: és tot el gràfic.
    expect(html).toContain("--w:30.00%;--c:#e73b39");
    expect(html).toContain("--w:90.00%;--c:#e73b39");
    expect(html).not.toContain('class="forces"');
  });

  it("porta el mapa dels 36 amb un punt per fitxa, sense sortir del seu nivell", () => {
    const html = renderAmb(
      amb({
        municipis: [
          municipi({ slug: "a", name: "A", lat: 41.3, lon: 2.0 }),
          municipi({ slug: "b", name: "B", lat: 41.4, lon: 2.1 }),
          municipi({ slug: "c", name: "C", lat: 41.5, lon: 2.2 }),
        ],
      }),
      "2026-08-29",
    );
    expect(html).toContain('class="mapa-territori"');
    expect(html).toContain('<a href="../m/a/">');
    expect(html).toContain('href="../mapa/"');
    expect(html).not.toContain('href="../../m/');
  });

  it("comparteix el full d'estil amb les comarques, i no en porta una còpia", () => {
    // La còpia literal del CSS era el que feia que un arranjament a les
    // comarques deixés l'AMB a mitges. Si algú la torna a fer, això peta.
    const html = renderAmb(amb(), "2026-08-29");
    const cops = html.split(".repartiment{display:flex").length - 1;
    expect(cops).toBe(1);
  });
});

/**
 * El que l'usuari va trobar a faltar: un mapa que situï els 36, i prou
 * indicadors per respondre «i el meu poble, com hi queda». El que es prova aquí
 * és que cap de les dues coses no es pugui perdre sense que això peti.
 */
describe("on cau l'àrea i com hi queda cada poble", () => {
  /** Els 947 punts falsos, escampats, amb els primers marcats com a metropolitans. */
  const situacio = Array.from({ length: 947 }, (_, i) => ({
    lat: 40.6 + (i % 40) / 20,
    lon: 0.3 + Math.floor(i / 40) / 12,
    dins: i < 36,
  }));

  it("porta els dos mapes: els 36 ampliats i on cauen dins dels 947", () => {
    // Amb un de sol no n'hi ha prou. Ampliats es pot buscar el poble però es
    // perd on és; damunt de Catalunya se sap on és però no s'hi encerta res.
    const html = renderAmb(
      amb({
        situacio,
        municipis: [
          municipi({ slug: "a", name: "A", lat: 41.3, lon: 2.0 }),
          municipi({ slug: "b", name: "B", lat: 41.4, lon: 2.1 }),
          municipi({ slug: "c", name: "C", lat: 41.5, lon: 2.2 }),
        ],
      }),
      "2026-08-29",
    );
    expect(html).toContain('class="mapa-territori"');
    expect(html).toContain('class="situacio"');
    expect(html).toContain("els 36 metropolitans damunt dels 947 municipis");
  });

  it("no dibuixa el segell de situació amb quatre punts, que no situarien res", () => {
    const html = renderAmb(amb({ situacio: situacio.slice(0, 4) }), "2026-08-29");
    expect(html).not.toContain('class="situacio"');
  });

  it("ordena els indicadors per qui pren la decisió, i cita l'article quan és l'AMB", () => {
    // És el que separa aquesta pàgina d'una llista d'indicadors qualsevol: el
    // preu de l'aigua i el rebut de l'IBI no els decideix el mateix govern.
    const html = renderAmb(
      amb({
        indicadors: [
          {
            key: "preu-aigua", label: "Preu de l'aigua", unit: "euros-m3",
            qui: "amb", article: "article 14.C",
            metropolita: 2.288, catalana: 1.02, ambDada: 36, ambDadaCatalunya: 945,
            percentilGrup: 82, nota: "Subministrament domiciliari.",
          },
          {
            key: "rebut-ibi", label: "Rebut mitjà de l'IBI", unit: "euros",
            qui: "ajuntament", article: "",
            metropolita: 412, catalana: 285, ambDada: 36, ambDadaCatalunya: 940,
            percentilGrup: 61, nota: "Quota íntegra pels rebuts.",
          },
        ],
      }),
      "2026-08-29",
    );
    expect(html).toContain("Ho decideix l'AMB");
    expect(html).toContain("Ho decideix el teu ajuntament");
    expect(html).toContain("Llei 31/2010, article 14.C");
    // Dos decimals i el metre cúbic: arrodonir el preu de l'aigua a «2 €» el
    // deixaria sense cap de les dues xifres que el fan comparable.
    expect(html).toContain("2,29 €/m³");
    expect(html).toContain("412 €");
  });

  it("diu qui paga més i qui menys, perquè una mediana no és de ningú", () => {
    const municipis = [
      municipi({ slug: "a", name: "A", valors: { "preu-aigua": 1.07 } }),
      municipi({ slug: "b", name: "B", valors: { "preu-aigua": 2.0 } }),
      municipi({ slug: "c", name: "C", valors: { "preu-aigua": 2.5 } }),
      municipi({ slug: "d", name: "D", valors: { "preu-aigua": 3.03 } }),
    ];
    const indicadors: AmbData["indicadors"] = [{
      key: "preu-aigua", label: "Preu de l'aigua", unit: "euros-m3",
      qui: "amb", article: "article 14.C",
      metropolita: 2.25, catalana: 1.02, ambDada: 4, ambDadaCatalunya: 945,
      percentilGrup: 80, nota: ".",
    }];
    const html = renderAmb(amb({ municipis, indicadors }), "2026-08-29");
    expect(html).toContain('Més alt: <a href="../m/d/">D</a>');
    expect(html).toContain('Més baix: <a href="../m/a/">A</a>');
    expect(html).toContain("3,03 €/m³");

    // Amb tres municipis no hi ha extrems que valguin: són tots tres extrems.
    const pocs = renderAmb(amb({ municipis: municipis.slice(0, 3), indicadors }), "2026-08-29");
    expect(pocs).not.toContain("Més alt:");
  });

  it("posa les xifres comparables a la taula dels 36, amb la posició de cadascuna", () => {
    const municipis = [
      municipi({ slug: "a", name: "A", valors: { "preu-aigua": 1, "residus-kg": 300, selectiva: 20 } }),
      municipi({ slug: "b", name: "B", valors: { "preu-aigua": 2, "residus-kg": 400, selectiva: 40 } }),
      municipi({ slug: "c", name: "C", valors: { "preu-aigua": 3, "residus-kg": 500, selectiva: 60 } }),
      municipi({ slug: "d", name: "D", valors: { "preu-aigua": 4, "residus-kg": 600, selectiva: 80 } }),
    ];
    const html = renderAmb(amb({ municipis }), "2026-08-29");
    expect(html).toContain("<th>Aigua</th>");
    expect(html).toContain("<th>Selectiva</th>");
    // El primer és el mínim de la seva columna i el darrer el màxim.
    expect(html).toContain('style="--p:0%"');
    expect(html).toContain('style="--p:100%"');
    expect(html).toContain("1,00");
  });

  it("no obre una columna que només tindria guionets", () => {
    // Sense dades de quatre municipis la barreta no compara res, i una columna
    // buida només fa la taula més ampla.
    const html = renderAmb(amb(), "2026-08-29");
    expect(html).not.toContain("<th>Aigua</th>");
  });

  it("lliga la mida del titular a l'ample de la vista, que és el que feia vessar la pàgina", () => {
    // A 390 px «Metropolitana» demanava 272 px dins d'una columna de 234 i el
    // document se n'anava a 404. Si algú torna a fixar la mida, això peta.
    const html = renderAmb(amb(), "2026-08-29");
    expect(html).toContain(".portada .presenta h1{font-size:clamp(");
    expect(html).toContain("vw");
  });
});
