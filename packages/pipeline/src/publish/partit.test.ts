import { describe, expect, it } from "vitest";
import {
  marcaDe, renderPartit, tintaSobre,
  type PartitData, type PartitMunicipi, type PartitRenda, type PartitRetribucions,
} from "./partit";

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
    mayorPhoto: "/observatori/fotos/160/12345.webp",
    mayorSlug: "eduard-sanz-garcia",
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
    poblacioAny: 2025,
    vots: 620_000,
    votsCatalunya: 2_900_000,
    llocs: [
      lloc(),
      lloc({ slug: "gava", name: "Gavà", population: 12_300, candidatura: "psc-cp-2", majoria: false }),
      lloc({
        slug: "vic", name: "Vic", comarca: "Osona", population: 46_100,
        seats: 3, alcaldia: false, mayorName: null, mayorPhoto: null, mayorSlug: null,
        majoria: false, candidatura: "psc-vic",
      }),
    ],
    serie: [
      { year: 2015, regidories: 1_600, regidoriesCatalunya: 9_000, guanyats: 180, alcaldies: 150, municipisAmbSerie: 947 },
      { year: 2019, regidories: 1_520, regidoriesCatalunya: 9_000, guanyats: 170, alcaldies: 140, municipisAmbSerie: 947 },
      { year: 2023, regidories: 1_450, regidoriesCatalunya: 9_000, guanyats: 165, alcaldies: 2, municipisAmbSerie: 947 },
    ],
    poblacioSerie: [
      { year: 2015, alcaldies: 150, habitants: 2_203_671, catalunya: 7_508_106 },
      { year: 2019, alcaldies: 140, habitants: 2_315_209, catalunya: 7_675_217 },
      { year: 2023, alcaldies: 2, habitants: 58_800, catalunya: 7_909_125 },
    ],
    serieRegidoriesFiable: true,
    serieAlcaldiesFiable: true,
    serieRegidories2023: 1_450,
    serieAlcaldies2023: 2,
    retribucions: null,
    renda: null,
    altres: [{ id: "erc", sigles: "ERC", color: "#ffb232", alcaldies: 307, regidories: 2_000 }],
    ...canvis,
  };
}

/**
 * Retribucions versemblants d'una marca mitjana. Les xifres no són les de cap
 * partit: el que es prova és què diu la pàgina, no què cobra ningú.
 */
function retribucions(canvis: Partial<PartitRetribucions> = {}): PartitRetribucions {
  return {
    any: 2024,
    alcaldies: 40,
    ambImport: 36,
    senseComunicar: 4,
    ambDedicacio: 28,
    nomesAssistencies: 6,
    senseCapImport: 2,
    mediana: 21_000,
    media: 24_500,
    medianaCatalunya: 17_208.78,
    municipisAmbDada: 866,
    municipisTotals: 947,
    trams: [
      {
        tram: "de 5.001 a 10.000 habitants",
        alcaldies: 12, ambImport: 11, mediana: 42_340, medianaTram: 39_025, alcaldiesTram: 80,
      },
      {
        tram: "de 251 a 1.000 habitants",
        alcaldies: 28, ambImport: 25, mediana: 13_617, medianaTram: 13_129, alcaldiesTram: 271,
      },
    ],
    ...canvis,
  };
}

function renda(canvis: Partial<PartitRenda> = {}): PartitRenda {
  return {
    any: 2023,
    municipis: 40,
    ambDada: 31,
    mediana: 15_900,
    medianaCatalunya: 16_400,
    municipisCatalunyaAmbDada: 720,
    mesBaixa: { name: "Salt", slug: "salt", valor: 9_800 },
    mesAlta: { name: "Sant Cugat del Vallès", slug: "sant-cugat-del-valles", valor: 26_100 },
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

  it("dibuixa les tres sèries llargues quan les fonts s'hi assemblen", () => {
    const html = renderPartit(mostra(), "2026-08-30");
    expect(html).toContain("Regidories, elecció a elecció");
    expect(html).toContain("Alcaldies, mandat a mandat");
    expect(html).toContain("Població governada, elecció a elecció");
    // Tres gràfiques i no una de sola amb tres eixos: les regidories es compten
    // per milers, les alcaldies per centenars i els habitants per milions.
    expect(html.match(/<figure class="grafic/g)).toHaveLength(3);
  });

  describe("la població governada", () => {
    it("dibuixa la sèrie amb la població de cada any i el percentatge al costat", () => {
      const html = renderPartit(mostra(), "2026-08-30");
      // Els habitants del 2015 són els del padró del 2015, no els d'avui.
      expect(html).toContain("2.203.671");
      // 2.203.671 de 7.508.106 empadronats el 2015.
      expect(html).toContain("29,4 %");
      // I els del 2023 sobre el padró del 2023, no sobre el de Catalunya d'ara.
      expect(html).toContain("7.508.106");
    });

    it("diu que comença on comença el padró i no on comença la sèrie electoral", () => {
      const html = renderPartit(
        mostra({
          serie: [
            { year: 1979, regidories: 800, regidoriesCatalunya: 8_000, guanyats: 90, alcaldies: 70, municipisAmbSerie: 940 },
            ...mostra().serie,
          ],
        }),
        "2026-08-30",
      );
      expect(html).toContain("comença el 2015 i no el 1979");
    });

    it("no retreu cap forat quan la sèrie de població comença on comença la resta", () => {
      // El PSC de la mostra té les tres sèries del 2015 ençà: dir «comença el
      // 2015 i no el 2015» seria una frase sense sentit.
      const html = renderPartit(mostra(), "2026-08-30");
      expect(html).not.toContain("i no el 2015");
    });

    it("no fa passar la població d'avui per la de fa deu anys", () => {
      const html = renderPartit(mostra(), "2026-08-30");
      expect(html).toContain("padró de l'any de cada elecció");
      // La xifra gran de la capçalera és d'un altre any i la pàgina ho diu.
      expect(html).toContain("és el padró del");
      expect(html).toContain("2025");
    });

    it("amb un sol any amb padró no dibuixa cap línia, i la xifra queda a la taula", () => {
      const html = renderPartit(
        mostra({
          poblacioSerie: [{ year: 2023, alcaldies: 2, habitants: 58_800, catalunya: 7_909_125 }],
        }),
        "2026-08-30",
      );
      expect(html).toContain("Població governada, elecció a elecció");
      expect(html).toContain("una tendència d'un punt és una tendència");
      expect(html.match(/<figure class="grafic/g)).toHaveLength(2);
    });

    it("qui no governa enlloc no té cap línia plana damunt del zero", () => {
      const html = renderPartit(
        mostra({
          alcaldies: 0, majories: 0, comarques: 0, poblacioGovernada: 0,
          llocs: [lloc({ alcaldia: false, majoria: false, mayorName: null, mayorPhoto: null, mayorSlug: null })],
          poblacioSerie: [
            { year: 2015, alcaldies: 0, habitants: 0, catalunya: 7_508_106 },
            { year: 2019, alcaldies: 0, habitants: 0, catalunya: 7_675_217 },
            { year: 2023, alcaldies: 0, habitants: 0, catalunya: 7_909_125 },
          ],
        }),
        "2026-08-30",
      );
      expect(html).not.toContain("Població governada, elecció a elecció");
    });

    it("no la dibuixa quan la sèrie d'alcaldies no és fiable, que és la seva font", () => {
      const html = renderPartit(mostra({ serieAlcaldiesFiable: false, serieAlcaldies2023: 0 }), "2026-08-30");
      expect(html).not.toContain("Població governada, elecció a elecció");
    });
  });

  describe("el llinatge de les marques", () => {
    it("explica d'on ve Junts i cap a on va, amb la data de cada pas", () => {
      const html = renderPartit(
        mostra({ id: "junts", sigles: "Junts", lineage: "ciu", lineageSigles: "CiU" }),
        "2026-08-30",
      );
      expect(html).toContain("D'on ve i cap a on va");
      expect(html).toContain("25 de juliol del 2020");
      expect(html).toContain("18 de juny del 2015");
      // CiU i el PDeCAT s'anomenen encara que no tinguin pàgina.
      expect(html).toContain("CiU");
      expect(html).toContain("PDeCAT");
    });

    it("no ajunta les xifres de dues marques amb filiació", () => {
      const html = renderPartit(mostra({ id: "junts", sigles: "Junts" }), "2026-08-30");
      expect(html).toContain("no arrossega les xifres de l'altra");
      expect(html).toContain("no són la mateixa persona jurídica");
    });

    it("talla la corba de Junts on comença el partit i diu per què", () => {
      const html = renderPartit(mostra({ id: "junts", sigles: "Junts" }), "2026-08-30");
      // Les cinc alcaldies que la sèrie de sigles li dona el 2015 són llistes
      // locals i d'Acord Municipal, no el partit: fora de la taula i de la corba.
      expect(html).not.toContain("<th scope=\"row\">2015</th>");
      expect(html).toContain("La corba comença el 2019 i no el 1979");
    });

    it("enllaça a la pàgina de l'altra marca només quan en té", () => {
      const html = renderPartit(
        mostra({
          id: "junts", sigles: "Junts",
          altres: [{ id: "pdecat", sigles: "PDeCAT", color: "#7f9ac9", alcaldies: 9, regidories: 60 }],
        }),
        "2026-08-30",
      );
      expect(html).toContain('href="../pdecat/"');
      // CiU no en té: hi surt escrit i sense enllaç.
      expect(html).not.toContain('href="../ciu/"');
    });

    it("qui no té llinatge documentat no en porta cap secció inventada", () => {
      const html = renderPartit(mostra(), "2026-08-30");
      expect(html).not.toContain("D'on ve i cap a on va");
    });
  });

  it("qui no ha tingut mai cap alcaldia ho llegeix escrit, no en una línia plana", () => {
    const html = renderPartit(
      mostra({
        id: "vox", sigles: "Vox", name: "Vox", alcaldies: 0, majories: 0, comarques: 0,
        poblacioGovernada: 0, serieAlcaldies2023: 0,
        llocs: [lloc({ alcaldia: false, majoria: false, mayorName: null, mayorPhoto: null, mayorSlug: null })],
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

describe("les cares de les alcaldies", () => {
  /** Trenta alcaldies amb retrat, per poder provar la tira i el seu límit. */
  const ambCares = (quantes: number, canvis: Partial<PartitMunicipi> = {}): PartitMunicipi[] =>
    Array.from({ length: quantes }, (_, i) =>
      lloc({
        slug: `poble-${i}`,
        name: `Poble ${i}`,
        population: 40_000 - i,
        candidatura: "psc-cp",
        mayorName: `Alcalde ${i} Cognom`,
        mayorPhoto: `/observatori/fotos/160/${i}.webp`,
        mayorSlug: `alcalde-${i}-cognom`,
        ...canvis,
      }),
    );

  it("posa la cara de qui mana a cada fila i l'enllaça amb la seva fitxa", () => {
    const html = renderPartit(mostra(), "2026-08-30");
    expect(html).toContain('src="/observatori/fotos/160/12345.webp"');
    expect(html).toContain('href="../../m/esplugues-de-llobregat/regidor/eduard-sanz-garcia/"');
    expect(html).toContain("Eduard Sanz García");
  });

  it("qui no té retrat porta la inicial amb el color de la marca, mai un forat", () => {
    const html = renderPartit(
      mostra({ llocs: [lloc({ mayorPhoto: null, mayorName: "Anna Puig Roca" })] }),
      "2026-08-30",
    );
    expect(html).toContain('class="retrat inicials sense-foto"');
    // Dues inicials i el color de la marca, com a la composició del ple.
    expect(html).toContain(">AP<");
    expect(html).toContain("--c:#d00c3c");
  });

  it("qui no té fitxa de persona porta el nom sense enllaç, i no un enllaç trencat", () => {
    const html = renderPartit(
      mostra({ llocs: [lloc({ mayorSlug: null, mayorName: "Anna Puig Roca" })] }),
      "2026-08-30",
    );
    expect(html).toContain('<span class="lloc-qui">');
    expect(html).not.toContain("/regidor//");
  });

  it("no fica mai una àncora dins d'una altra: el municipi i la persona van a part", () => {
    const html = renderPartit(mostra({ llocs: ambCares(4) }), "2026-08-30");
    expect(html).not.toMatch(/<a\b[^>]*>(?:(?!<\/a>)[\s\S])*?<a\b/);
  });

  it("dibuixa la tira de cares només quan n'hi ha prou, i talla a vint-i-quatre", () => {
    const poques = renderPartit(mostra({ llocs: ambCares(5) }), "2026-08-30");
    expect(poques).not.toContain('class="partit-cares"');

    const moltes = renderPartit(
      mostra({ llocs: ambCares(30), alcaldies: 30, municipis: 30 }),
      "2026-08-30",
    );
    expect(moltes).toContain('class="partit-cares"');
    const tira = moltes.slice(
      moltes.indexOf('<ul class="partit-cares">'),
      moltes.indexOf("</ul>", moltes.indexOf('<ul class="partit-cares">')),
    );
    expect(tira.match(/retrat-tira/g)).toHaveLength(24);
    // I diu el criteri i el denominador: 24 de 30, no «les seves alcaldies».
    expect(moltes).toContain("Són les 24 primeres de les 30 alcaldies");
    expect(moltes).toContain("dels municipis més poblats als menys");
  });

  it("la tira no porta cap escut de municipi, que competiria amb el mapa", () => {
    const html = renderPartit(
      mostra({ llocs: ambCares(30), alcaldies: 30, municipis: 30 }),
      "2026-08-30",
    );
    const tira = html.slice(
      html.indexOf('<ul class="partit-cares">'),
      html.indexOf("</ul>", html.indexOf('<ul class="partit-cares">')),
    );
    expect(tira).not.toContain("escut");
    expect(tira.match(/<img/g)).toHaveLength(24);
  });
});

describe("què cobren les seves alcaldies", () => {
  it("no en diu mai «sou» a seques i explica què hi ha dins de la xifra", () => {
    const html = renderPartit(mostra({ retribucions: retribucions() }), "2026-08-30");
    expect(html).toContain("Aquella xifra no és un sou");
    expect(html).toContain("assistències a plens i comissions");
    expect(html).toContain("21.000 €");
    expect(html).toContain("24.500 €");
  });

  it("diu que qui no ho ha comunicat no és qui no cobra", () => {
    const html = renderPartit(mostra({ retribucions: retribucions() }), "2026-08-30");
    expect(html).toContain("No vol dir que no cobrin");
    expect(html).toContain("no ho ha comunicat al Ministeri");
    expect(html).toContain("81 de 947");
  });

  it("compara dins del tram de població i no la xifra global amb la d'un altre partit", () => {
    const html = renderPartit(mostra({ retribucions: retribucions() }), "2026-08-30");
    expect(html).toContain("de 5.001 a 10.000 habitants");
    expect(html).toContain("39.025 €");
    expect(html).toContain("la mida del municipi molt abans que el color");
  });

  it("amb poques alcaldies no publica cap mediana: seria la xifra d'una persona", () => {
    const html = renderPartit(
      mostra({
        retribucions: retribucions({ alcaldies: 2, ambImport: 2, senseComunicar: 0, trams: [] }),
      }),
      "2026-08-30",
    );
    expect(html).toContain("una mediana no diria res");
    expect(html).not.toContain('<span class="gran">21.000 €</span>');
  });

  it("diu en quin sentit la mitjana s'aparta de la mediana, i no sempre el mateix", () => {
    const amunt = renderPartit(mostra({ retribucions: retribucions() }), "2026-08-30");
    expect(amunt).toContain("estiren la xifra amunt");
    const avall = renderPartit(
      mostra({ retribucions: retribucions({ mediana: 30_000, media: 24_500 }) }),
      "2026-08-30",
    );
    expect(avall).toContain("l'estiren avall");
  });

  it("sense cap alcaldia amb import, el bloc no existeix ni a l'índex", () => {
    const html = renderPartit(mostra({ retribucions: null }), "2026-08-30");
    expect(html).not.toContain('id="retribucions"');
    expect(html).not.toContain("Què cobren les seves alcaldies");
  });
});

describe("la renda dels pobles que governa", () => {
  it("diu que la renda no la decideix l'ajuntament i que la sèrie s'acaba el 2023", () => {
    const html = renderPartit(mostra({ renda: renda() }), "2026-08-30");
    expect(html).toContain("La renda no la decideix l'ajuntament");
    expect(html).toContain("no hi ha cap dada posterior a les eleccions");
    expect(html).toContain("15.900 €");
    expect(html).toContain("16.400 €");
  });

  it("diu que la mediana és per municipi i no per persona, i qui no hi surt", () => {
    const html = renderPartit(mostra({ renda: renda() }), "2026-08-30");
    expect(html).toContain("per municipi i no per persona");
    expect(html).toContain("secret estadístic");
    expect(html).toContain("9 de les seves");
  });

  it("sense la font, la pàgina no en diu res: mai un bloc buit", () => {
    const html = renderPartit(mostra({ renda: null }), "2026-08-30");
    expect(html).not.toContain('id="renda"');
    expect(html).not.toContain("La renda dels pobles que governa");
  });
});
