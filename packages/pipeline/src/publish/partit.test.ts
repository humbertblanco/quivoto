import { describe, expect, it } from "vitest";
import { marcaDe, renderPartit, tintaSobre, type PartitData, type PartitMunicipi } from "./partit";

/**
 * Una marca de mostra amb prou dades per rendir la pàgina sencera. Les xifres
 * són versemblants però no són les de ningú: el que es prova aquí és què diu la
 * pàgina amb unes dades, no quantes alcaldies té el PSC.
 */
function lloc(canvis: Partial<PartitMunicipi> = {}): PartitMunicipi {
  return {
    slug: "esplugues-de-llobregat",
    name: "Esplugues de Llobregat",
    comarca: "Baix Llobregat",
    population: 46_500,
    sigles: "PSC-CP",
    candidatura: "psc-cp",
    seats: 11,
    totalSeats: 21,
    alcaldia: true,
    mayorName: "Eduard Sanz García",
    majoria: true,
    ...canvis,
  };
}

function mostra(canvis: Partial<PartitData> = {}): PartitData {
  return {
    id: "psc",
    sigles: "PSC",
    name: "Partit dels Socialistes de Catalunya",
    kind: "catalan",
    color: "#d00c3c",
    lineage: null,
    lineageSigles: null,
    alcaldies: 2,
    regidories: 1_450,
    municipis: 3,
    comarques: 2,
    majories: 1,
    poblacioGovernada: 58_800,
    poblacioCatalunya: 7_900_000,
    vots: 620_000,
    votsCatalunya: 2_900_000,
    llocs: [
      lloc(),
      lloc({ slug: "gava", name: "Gavà", population: 12_300, candidatura: "psc-cp-2", majoria: false }),
      lloc({
        slug: "vic", name: "Vic", comarca: "Osona", population: 46_100,
        seats: 3, alcaldia: false, mayorName: null, majoria: false, candidatura: "psc-vic",
      }),
    ],
    serie: [
      { year: 2015, regidories: 1_600, regidoriesCatalunya: 9_000, guanyats: 180, alcaldies: 150, municipisAmbSerie: 947 },
      { year: 2019, regidories: 1_520, regidoriesCatalunya: 9_000, guanyats: 170, alcaldies: 140, municipisAmbSerie: 947 },
      { year: 2023, regidories: 1_450, regidoriesCatalunya: 9_000, guanyats: 165, alcaldies: 2, municipisAmbSerie: 947 },
    ],
    serieRegidoriesFiable: true,
    serieAlcaldiesFiable: true,
    serieRegidories2023: 1_450,
    serieAlcaldies2023: 2,
    altres: [{ id: "erc", sigles: "ERC", color: "#ffb232", alcaldies: 307, regidories: 2_000 }],
    ...canvis,
  };
}

describe("marcaDe", () => {
  it("es queda amb l'agrupació que publica la Generalitat quan n'hi ha", () => {
    expect(marcaDe("erc", "ERC-AM")).toBe("erc");
    expect(marcaDe("junts", "JUNTS PER RIALP CM")).toBe("junts");
  });

  it("repesca per les sigles la coalició local registrada com a agrupació d'electors", () => {
    // «UA-PSC-CP» entra al dataset com a llista local i porta la marca escrita
    // a dins: sense aquesta repesca, el PSC tindria menys regidories de les que té.
    expect(marcaDe("local", "UA-PSC-CP")).toBe("psc");
    expect(marcaDe(null, "BARCELONA EN COMU-C")).toBe("comuns");
  });

  it("davant d'una coalició que apunta a dues marques no en tria cap", () => {
    // «SP-CUP-AM» porta el testimoni de la CUP i el d'Esquerra alhora.
    // Repartir-la a mitges o triar-ne una seria inventar-se una alcaldia.
    expect(marcaDe("local", "SP-CUP-AM")).toBeNull();
  });

  it("no atribueix res a ningú quan ni l'agrupació ni les sigles ho aclareixen", () => {
    // Una llista d'un poble i prou. Val més una xifra curta que una de falsa.
    expect(marcaDe("local", "GENT DEL POBLE")).toBeNull();
    expect(marcaDe(null, "AGRUPACIÓ D'ELECTORS SOM-HI")).toBeNull();
  });

  it("«local» no és mai una marca, vingui d'on vingui", () => {
    expect(marcaDe("local", "AE")).toBeNull();
  });
});

describe("tintaSobre", () => {
  it("posa tinta fosca sobre els colors clars i clara sobre els foscos", () => {
    expect(tintaSobre("#ffff00")).toBe("#1E1B2E");
    expect(tintaSobre("#d00c3c")).toBe("#FBF7EE");
  });
});

describe("renderPartit", () => {
  it("obre amb les tres xifres que manen", () => {
    const html = renderPartit(mostra(), "2026-08-30");
    expect(html).toContain("PSC");
    expect(html).toContain("Partit dels Socialistes de Catalunya");
    expect(html).toContain("1.450");
    expect(html).toContain("58.800");
    expect(html).toContain("2 alcaldies");
  });

  it("distingeix la població que el vota de la població que governa", () => {
    const html = renderPartit(mostra(), "2026-08-30");
    expect(html).toContain("La població que el vota");
    expect(html).toContain("La població que governa");
    expect(html).toContain("620.000");
    // La frase que explica la diferència, que ha de ser una i no un paràgraf.
    expect(html).toContain("l'hagi votat o no");
  });

  it("llista els municipis on mana, del més gran al més petit, i hi enllaça", () => {
    const html = renderPartit(mostra(), "2026-08-30");
    expect(html).toContain('href="../../m/esplugues-de-llobregat/psc-cp/"');
    expect(html).toContain('href="../../m/gava/psc-cp-2/"');
    // Vic no hi mana: hi és al mapa i no a la llista d'alcaldies.
    expect(html.indexOf("Esplugues de Llobregat")).toBeLessThan(html.indexOf("Gavà"));
  });

  it("plega la resta de municipis quan n'hi ha més de trenta", () => {
    const molts = Array.from({ length: 42 }, (_, i) =>
      lloc({ slug: `poble-${i}`, name: `Poble ${i}`, population: 40_000 - i, candidatura: "psc-cp" }),
    );
    const html = renderPartit(mostra({ llocs: molts, alcaldies: 42, municipis: 42 }), "2026-08-30");
    expect(html).toContain("<details");
    expect(html).toContain("Els altres 12 municipis");
    // Plegats, però escrits: sense JavaScript i sense obrir res, hi són tots.
    expect(html).toContain("Poble 41");
  });

  it("no plega res amb pocs municipis", () => {
    const html = renderPartit(mostra(), "2026-08-30");
    expect(html).not.toContain('<details class="partit-resta"');
  });

  it("pinta el mapa amb els seus municipis encesos i la resta apagats", () => {
    const html = renderPartit(mostra(), "2026-08-30");
    expect(html).toContain('<path class="mana"');
    expect(html).toContain('<path class="hi-es"');
    // El mapa surt de la geometria de debò: 947 taques i ni una menys. Les
    // apagades van sense classe, que és l'estat per defecte del mapa.
    const comenca = html.indexOf('<figure class="partit-mapa">');
    const mapa = html.slice(comenca, html.indexOf("</svg>", comenca));
    const taques = mapa.match(/<path (?:class="(?:mana|hi-es)" )?d="/g) ?? [];
    expect(taques.length).toBe(947);
    expect(html.match(/<path class="(?:mana|hi-es)"/g)).toHaveLength(3);
  });

  it("quan la sèrie llarga no sap veure la marca, no la dibuixa i diu per què", () => {
    // És el cas de les federacions comarcals: el conjunt del 1979 les compta
    // dins de les llistes locals i una corba a zero seria la història d'algú altre.
    const html = renderPartit(
      mostra({
        id: "fic", sigles: "FIC", name: "Federació d'Independents de Catalunya",
        serieRegidoriesFiable: false, serieAlcaldiesFiable: false,
        serieRegidories2023: 0, serieAlcaldies2023: 0,
      }),
      "2026-08-30",
    );
    expect(html).toContain("no en tenim sèrie llarga");
    expect(html).not.toContain('<figure class="grafic');
  });

  it("dibuixa les dues sèries llargues quan les dues fonts s'hi assemblen", () => {
    const html = renderPartit(mostra(), "2026-08-30");
    expect(html).toContain("Regidories, elecció a elecció");
    expect(html).toContain("Alcaldies, mandat a mandat");
    // Dues gràfiques i no una de sola amb dos eixos: les regidories es compten
    // per milers i les alcaldies per centenars.
    expect(html.match(/<figure class="grafic/g)).toHaveLength(2);
  });

  it("qui no ha tingut mai cap alcaldia ho llegeix escrit, no en una línia plana", () => {
    const html = renderPartit(
      mostra({
        id: "vox", sigles: "Vox", name: "Vox", alcaldies: 0, majories: 0, comarques: 0,
        poblacioGovernada: 0, serieAlcaldies2023: 0,
        llocs: [lloc({ alcaldia: false, majoria: false, mayorName: null })],
        serie: [
          { year: 2019, regidories: 40, regidoriesCatalunya: 9_000, guanyats: 0, alcaldies: 0, municipisAmbSerie: 947 },
          { year: 2023, regidories: 121, regidoriesCatalunya: 9_000, guanyats: 0, alcaldies: 0, municipisAmbSerie: 947 },
        ],
      }),
      "2026-08-30",
    );
    expect(html).toContain("No ha tingut mai cap alcaldia");
    expect(html).not.toContain("Alcaldies, mandat a mandat");
    // La sèrie de regidories sí que hi és: allà sí que hi ha què explicar.
    expect(html).toContain("Regidories, elecció a elecció");
    expect(html).toContain("no governa cap habitant de Catalunya");
  });

  it("no fa passar per continuïtat la força de la qual prové", () => {
    const html = renderPartit(
      mostra({ id: "junts", sigles: "Junts", lineage: "ciu", lineageSigles: "CiU" }),
      "2026-08-30",
    );
    expect(html).toContain("no ho volem fer passar per continuïtat");
  });

  it("sense cap alcaldia ho diu en comptes de deixar la llista buida", () => {
    const html = renderPartit(
      mostra({ alcaldies: 0, majories: 0, poblacioGovernada: 0, comarques: 0, llocs: [lloc({ alcaldia: false, majoria: false })] }),
      "2026-08-30",
    );
    expect(html).toContain("No té cap alcaldia");
    expect(html).not.toContain("<ul class=\"partit-llocs\"></ul>");
  });

  it("enllaça les altres marques i no n'inventa cap de les llistes locals", () => {
    const html = renderPartit(mostra(), "2026-08-30");
    expect(html).toContain('href="../erc/"');
    expect(html).toContain("diria que existeix un partit que no existeix");
  });

  it("escapa el que ve de la font: cap nom de municipi no pot injectar marcatge", () => {
    const html = renderPartit(
      mostra({ llocs: [lloc({ name: "<script>alert(1)</script>", sigles: 'PSC "CP"' })] }),
      "2026-08-30",
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&quot;CP&quot;");
  });

  it("un color que no sigui hexadecimal no pot sortir de l'atribut style", () => {
    const html = renderPartit(
      mostra({
        color: "#000;} body{background:red",
        altres: [{ id: "x", sigles: "X", color: "javascript:alert(1)", alcaldies: 1, regidories: 1 }],
      }),
      "2026-08-30",
    );
    expect(html).not.toContain("body{background:red");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("--accent:#8b8b8b");
  });

  it("el fons continua sent el paper de la casa; el color de la marca només és accent", () => {
    const html = renderPartit(mostra(), "2026-08-30");
    expect(html).toContain("--accent:#d00c3c");
    expect(html).toContain("--paper:#FBF7EE");
    expect(html).not.toContain("body{margin:0;background:#d00c3c");
  });

  it("va a la capçalera i al peu compartits amb el camí que li toca", () => {
    const html = renderPartit(mostra(), "2026-08-30");
    // Des de /observatori/partit/<id>/ l'Observatori és dos nivells amunt.
    expect(html).toContain('href="../../els947.html"');
    expect(html).toContain('href="../../mapa/"');
    expect(html).toContain("2026-08-30");
  });

  it("no publica cap dada de contacte de ningú", () => {
    const html = renderPartit(mostra(), "2026-08-30");
    expect(html).not.toMatch(/mailto:|href="tel:|[\w.-]+@[\w.-]+\.\w+/);
  });
});
