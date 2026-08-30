import { describe, expect, it } from "vitest";
import {
  CONSULTA_SPARQL,
  aparellaPerIne,
  fitxaWikidata,
  fitxerCommons,
  llegeixLlicencies,
  memoriaPrevia,
  normalitzaIne,
  parseSparql,
  textPla,
  titolNormalitzat,
  urlCommons,
  urlConsulta,
  urlOsm,
  veredicteLlicencia,
  type FilaWikidata,
  type FitxaWikidata,
  type Municipi,
  type ResultatFitxer,
} from "./j20-wikidata";

/**
 * Les respostes d'exemple d'aquest fitxer estan copiades de crides reals a
 * query.wikidata.org i a l'API de Commons. Ripoll és el cas que va motivar tot
 * el filtre de llicència: el seu escut és CC BY-SA 4.0 i l'autor es diu
 * Kilo567, i publicar-lo sense dir-ho seria incomplir la llicència.
 */

const entitat = (qid: string) => ({ type: "uri", value: `http://www.wikidata.org/entity/${qid}` });
const literal = (value: string) => ({ type: "literal", value });
const fitxer = (nom: string) => ({
  type: "uri",
  value: `http://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(nom)}`,
});

const RESPOSTA_SPARQL = {
  head: { vars: ["item", "ine", "imatge", "escut", "osm", "article"] },
  results: {
    bindings: [
      {
        item: entitat("Q14320"),
        ine: literal("17156"),
        imatge: fitxer("Ripoll - Monestir de Santa Maria.jpg"),
        escut: fitxer("Escut de Ripoll.svg"),
        osm: literal("343534"),
        article: { type: "uri", value: "https://ca.wikipedia.org/wiki/Ripoll" },
      },
      {
        item: entitat("Q15069"),
        // Molló: menys de 10.000 habitants, i el codi INE comença per zero.
        ine: literal("17109"),
        imatge: fitxer("Molló des del sud.jpg"),
        osm: literal("343528"),
        article: { type: "uri", value: "https://ca.wikipedia.org/wiki/Molló" },
      },
      {
        item: entitat("Q11939"),
        ine: literal("08015"),
        escut: fitxer("Escut d'Argentona.svg"),
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// La consulta i la lectura de la resposta
// ─────────────────────────────────────────────────────────────────────────────

describe("la consulta SPARQL", () => {
  it("demana els municipis catalans pel codi INE, no per cap nom", () => {
    expect(CONSULTA_SPARQL).toContain("wd:Q33146843");
    expect(CONSULTA_SPARQL).toContain("wdt:P772");
  });

  /**
   * Població i alcalde no hi són a posta: P1082 té un punt de Molló datat el
   * 2039 i P6 va desactualitzat en un 28 % dels casos. Si algú els hi afegeix
   * per comoditat, aquesta prova ho ha de fer petar.
   */
  it("no demana ni la població ni l'alcalde, que ja tenim de font oficial", () => {
    expect(CONSULTA_SPARQL).not.toContain("P1082");
    expect(CONSULTA_SPARQL).not.toMatch(/\bP6\b/);
  });

  it("va a l'endpoint amb format json i la consulta codificada", () => {
    const url = urlConsulta();
    expect(url.startsWith("https://query.wikidata.org/sparql?format=json&query=")).toBe(true);
    expect(decodeURIComponent(url.split("query=")[1]!)).toBe(CONSULTA_SPARQL);
  });
});

describe("normalitzaIne", () => {
  /**
   * Els municipis de la província de Barcelona tenen l'INE amb un zero al
   * davant. Qualsevol pas per un número se'l menjaria i Argentona (08015)
   * deixaria de lligar amb el nostre 08015.
   */
  it("conserva el zero inicial", () => {
    expect(normalitzaIne("08015")).toBe("08015");
    expect(normalitzaIne("8015")).toBe("08015");
  });

  it("descarta el que no pot ser un codi INE", () => {
    expect(normalitzaIne("")).toBeNull();
    expect(normalitzaIne("ES-17156")).toBe("17156");
    expect(normalitzaIne("171560000")).toBeNull();
    expect(normalitzaIne(null)).toBeNull();
  });
});

describe("fitxerCommons", () => {
  it("treu el títol del fitxer de l'URL de Special:FilePath", () => {
    expect(fitxerCommons(fitxer("Escut de Ripoll.svg").value)).toBe("File:Escut de Ripoll.svg");
  });

  it("torna els guions baixos a espais, com fa Commons", () => {
    expect(
      fitxerCommons("http://commons.wikimedia.org/wiki/Special:FilePath/Escut_de_Ripoll.svg"),
    ).toBe("File:Escut de Ripoll.svg");
  });

  it("no inventa cap fitxer quan l'URL no és de Commons", () => {
    expect(fitxerCommons("https://example.org/foto.jpg")).toBeNull();
    expect(fitxerCommons(null)).toBeNull();
  });

  it("normalitza la inicial en majúscula i el prefix", () => {
    expect(titolNormalitzat("file:escut de Ripoll.svg")).toBe("File:Escut de Ripoll.svg");
    expect(titolNormalitzat("File:Escut de Ripoll.svg")).toBe("File:Escut de Ripoll.svg");
  });
});

describe("parseSparql", () => {
  const files = parseSparql(RESPOSTA_SPARQL);

  it("llegeix un municipi per ítem amb tot el que la consulta demana", () => {
    expect(files).toHaveLength(3);
    const ripoll = files.find((f) => f.qid === "Q14320")!;
    expect(ripoll.ine5).toBe("17156");
    expect(ripoll.imatge).toBe("File:Ripoll - Monestir de Santa Maria.jpg");
    expect(ripoll.escut).toBe("File:Escut de Ripoll.svg");
    expect(ripoll.osm).toBe("343534");
    expect(ripoll.viquipedia).toBe("https://ca.wikipedia.org/wiki/Ripoll");
  });

  it("deixa a null el que l'ítem no té: 879 dels 947 tenen escut", () => {
    const mollo = files.find((f) => f.qid === "Q15069")!;
    expect(mollo.escut).toBeNull();
    expect(mollo.imatge).toBe("File:Molló des del sud.jpg");
  });

  /**
   * Un OPTIONAL que troba dos valors multiplica les files. Sense agrupar per
   * ítem, aquell municipi sortiria dues vegades i s'aparellaria dos cops.
   */
  it("agrupa les files repetides d'un mateix ítem en un sol municipi", () => {
    const duplicat = {
      results: {
        bindings: [
          { item: entitat("Q14320"), ine: literal("17156"), imatge: fitxer("A.jpg") },
          { item: entitat("Q14320"), ine: literal("17156"), imatge: fitxer("B.jpg") },
        ],
      },
    };
    const resultat = parseSparql(duplicat);
    expect(resultat).toHaveLength(1);
    expect(resultat[0]!.imatge).toBe("File:A.jpg");
  });

  it("no s'ofega amb una resposta buida o inesperada", () => {
    expect(parseSparql({})).toEqual([]);
    expect(parseSparql(null)).toEqual([]);
    expect(parseSparql({ results: { bindings: [{ item: entitat("Q1") }] } })).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// L'aparellament per codi INE
// ─────────────────────────────────────────────────────────────────────────────

describe("aparellaPerIne", () => {
  const files = parseSparql(RESPOSTA_SPARQL);
  const munis: Municipi[] = [
    { id: 1, ine5: "17156", name: "Ripoll" },
    { id: 2, ine5: "17109", name: "Molló" },
    { id: 3, ine5: "08015", name: "Argentona" },
  ];

  it("aparella pel codi INE i no per cap semblança de nom", () => {
    const { parelles, senseWikidata, orfes, ambigus } = aparellaPerIne(files, munis);
    expect(parelles).toHaveLength(3);
    expect(senseWikidata).toEqual([]);
    expect(orfes).toEqual([]);
    expect(ambigus).toEqual([]);
    expect(parelles.find((p) => p.municipalityId === 1)!.fila.qid).toBe("Q14320");
    expect(parelles.find((p) => p.municipalityId === 3)!.fila.qid).toBe("Q11939");
  });

  /**
   * Sant Quirze del Vallès (08234) i Sant Quirze Safaja (08235) són el motiu
   * pel qual aquí no es compara cap nom: s'assemblen prou perquè qualsevol
   * comparació aproximada els intercanviï, i tenen codis INE diferents.
   */
  it("no cau en els noms bessons perquè només mira el codi", () => {
    const bessons = [
      { qid: "Q1", ine5: "08234", imatge: null, escut: null, osm: null, viquipedia: null },
      { qid: "Q2", ine5: "08235", imatge: null, escut: null, osm: null, viquipedia: null },
    ] satisfies FilaWikidata[];
    const { parelles } = aparellaPerIne(bessons, [
      { id: 10, ine5: "08235", name: "Sant Quirze Safaja" },
      { id: 11, ine5: "08234", name: "Sant Quirze del Vallès" },
    ]);
    expect(parelles.find((p) => p.nom === "Sant Quirze Safaja")!.fila.qid).toBe("Q2");
    expect(parelles.find((p) => p.nom === "Sant Quirze del Vallès")!.fila.qid).toBe("Q1");
  });

  it("un INE que no lliga es registra i no s'endevina", () => {
    const { parelles, senseWikidata } = aparellaPerIne(files, [
      ...munis,
      { id: 4, ine5: "25120", name: "Lleida" },
    ]);
    expect(parelles).toHaveLength(3);
    expect(senseWikidata.map((m) => m.name)).toEqual(["Lleida"]);
  });

  it("un ítem de Wikidata amb un INE que no és nostre queda com a orfe", () => {
    const { parelles, orfes } = aparellaPerIne(files, [{ id: 1, ine5: "17156", name: "Ripoll" }]);
    expect(parelles).toHaveLength(1);
    expect(orfes.map((f) => f.qid).sort()).toEqual(["Q11939", "Q15069"]);
  });

  /**
   * Dos ítems amb el mateix codi INE. Triar-ne un seria posar la fotografia
   * d'un poble a la fitxa d'un altre: el municipi es queda sense fila.
   */
  it("davant d'un INE duplicat no aparella res", () => {
    const duplicats = [
      { qid: "Q14320", ine5: "17156", imatge: null, escut: null, osm: null, viquipedia: null },
      { qid: "Q99999", ine5: "17156", imatge: null, escut: null, osm: null, viquipedia: null },
    ] satisfies FilaWikidata[];
    const { parelles, senseWikidata, ambigus } = aparellaPerIne(duplicats, [
      { id: 1, ine5: "17156", name: "Ripoll" },
    ]);
    expect(parelles).toEqual([]);
    expect(senseWikidata.map((m) => m.name)).toEqual(["Ripoll"]);
    expect(ambigus).toEqual([{ ine5: "17156", qids: ["Q14320", "Q99999"] }]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// El filtre de llicència
// ─────────────────────────────────────────────────────────────────────────────

describe("veredicteLlicencia", () => {
  it("accepta el domini públic i les Creative Commons amb atribució", () => {
    for (const codi of ["cc0", "CC0-1.0", "pd", "pd-old-100", "cc-by-4.0", "cc-by-sa-4.0"]) {
      expect(veredicteLlicencia(codi).lliure, codi).toBe(true);
    }
  });

  /**
   * `cc-by-nc-sa-4.0` conté `cc-by`: si la comprovació del que és lliure anés
   * abans que la del que està prohibit, una imatge no comercial passaria el
   * filtre. Aquest és el cas que fixa l'ordre de les dues llistes.
   */
  it("rebutja el no comercial i el sense obra derivada", () => {
    for (const codi of ["cc-by-nc-4.0", "cc-by-nc-sa-4.0", "cc-by-nd-4.0", "fair use"]) {
      const v = veredicteLlicencia(codi);
      expect(v.lliure, codi).toBe(false);
      if (!v.lliure) expect(v.motiu).toContain(codi.toLowerCase());
    }
  });

  it("rebutja el que no reconeix, encara que soni lliure", () => {
    // La GFDL obligaria a reproduir el text sencer de la llicència al costat
    // de cada escut: és lliure, però no per a aquesta pàgina.
    expect(veredicteLlicencia("gfdl").lliure).toBe(false);
    expect(veredicteLlicencia("attribution").lliure).toBe(false);
  });

  it("sense codi no hi ha permís: no saber-ho no és tenir-ho", () => {
    expect(veredicteLlicencia(null)).toEqual({
      lliure: false,
      motiu: "Commons no en publica el codi de llicència",
    });
    expect(veredicteLlicencia("   ").lliure).toBe(false);
    expect(veredicteLlicencia(undefined).lliure).toBe(false);
  });
});

describe("textPla", () => {
  it("treu l'HTML de l'autor, que a Commons és text lliure", () => {
    expect(textPla('<a href="//commons.wikimedia.org/wiki/User:Kilo567">Kilo567</a>')).toBe(
      "Kilo567",
    );
    expect(textPla("<span>Josep&nbsp;Puig &amp; fills</span>")).toBe("Josep Puig & fills");
  });

  it("un autor buit és null i no una cadena buida", () => {
    expect(textPla("<span></span>")).toBeNull();
    expect(textPla(null)).toBeNull();
  });
});

// Resposta real de l'API de Commons per als dos fitxers de Ripoll, retallada
// als camps que demanem amb iiextmetadatafilter.
const RESPOSTA_COMMONS = {
  batchcomplete: true,
  query: {
    pages: [
      {
        pageid: 137285991,
        ns: 6,
        title: "File:Escut de Ripoll.svg",
        imagerepository: "local",
        imageinfo: [
          {
            url: "https://upload.wikimedia.org/wikipedia/commons/1/1f/Escut_de_Ripoll.svg",
            descriptionurl: "https://commons.wikimedia.org/wiki/File:Escut_de_Ripoll.svg",
            extmetadata: {
              License: { value: "cc-by-sa-4.0", source: "commons-templates" },
              LicenseShortName: { value: "CC BY-SA 4.0", source: "commons-desc-page" },
              Artist: {
                value: '<a href="//commons.wikimedia.org/wiki/User:Kilo567">Kilo567</a>',
                source: "commons-desc-page",
              },
              AttributionRequired: { value: "true", source: "commons-desc-page" },
            },
          },
        ],
      },
      {
        pageid: 4823411,
        ns: 6,
        title: "File:Ripoll - Monestir de Santa Maria.jpg",
        imagerepository: "local",
        imageinfo: [
          {
            url: "https://upload.wikimedia.org/wikipedia/commons/a/a1/Ripoll.jpg",
            descriptionurl:
              "https://commons.wikimedia.org/wiki/File:Ripoll_-_Monestir_de_Santa_Maria.jpg",
            extmetadata: {
              License: { value: "cc0", source: "commons-templates" },
              LicenseShortName: { value: "CC0", source: "commons-desc-page" },
            },
          },
        ],
      },
    ],
  },
};

describe("llegeixLlicencies", () => {
  const demanats = ["File:Escut de Ripoll.svg", "File:Ripoll - Monestir de Santa Maria.jpg"];
  const resultats = llegeixLlicencies(RESPOSTA_COMMONS, demanats);

  it("desa la llicència i l'autor de cada fitxer, que és el que la llicència exigeix", () => {
    const escut = resultats.get("File:Escut de Ripoll.svg")!;
    expect(escut.ok).toBe(true);
    if (!escut.ok) return;
    expect(escut.imatge.llicencia).toBe("cc-by-sa-4.0");
    expect(escut.imatge.llicenciaNom).toBe("CC BY-SA 4.0");
    expect(escut.imatge.autor).toBe("Kilo567");
    expect(escut.imatge.pagina).toBe("https://commons.wikimedia.org/wiki/File:Escut_de_Ripoll.svg");
  });

  it("una CC0 no té autor obligatori i es desa igualment", () => {
    const foto = resultats.get("File:Ripoll - Monestir de Santa Maria.jpg")!;
    expect(foto.ok).toBe(true);
    if (!foto.ok) return;
    expect(foto.imatge.llicencia).toBe("cc0");
    expect(foto.imatge.autor).toBeNull();
  });

  it("descarta el fitxer amb llicència no comercial i en diu el motiu", () => {
    const noComercial = {
      query: {
        pages: [
          {
            title: "File:Vista del poble.jpg",
            imageinfo: [
              {
                url: "https://upload.wikimedia.org/x.jpg",
                descriptionurl: "https://commons.wikimedia.org/wiki/File:Vista_del_poble.jpg",
                extmetadata: { License: { value: "cc-by-nc-sa-3.0" } },
              },
            ],
          },
        ],
      },
    };
    const r = llegeixLlicencies(noComercial, ["File:Vista del poble.jpg"]).get(
      "File:Vista del poble.jpg",
    )!;
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.descartada.llicencia).toBe("cc-by-nc-sa-3.0");
    expect(r.descartada.motiu).toContain("no lliure");
  });

  /**
   * Si Commons no en diu la llicència, la imatge es descarta. El silenci d'una
   * font no és un permís, i aquesta és la regla que impedeix que una imatge de
   * llicència desconeguda acabi publicada.
   */
  it("descarta el fitxer sense llicència llegible", () => {
    const senseLlicencia = {
      query: {
        pages: [
          {
            title: "File:Sense dades.jpg",
            imageinfo: [
              {
                url: "https://upload.wikimedia.org/y.jpg",
                descriptionurl: "https://commons.wikimedia.org/wiki/File:Sense_dades.jpg",
                extmetadata: {},
              },
            ],
          },
        ],
      },
    };
    const r = llegeixLlicencies(senseLlicencia, ["File:Sense dades.jpg"]).get(
      "File:Sense dades.jpg",
    )!;
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.descartada.llicencia).toBeNull();
  });

  /**
   * El que la resposta **no** porta també compta: un fitxer que Commons no
   * coneix no és un fitxer sense problema, és un fitxer del qual no en sabem
   * res, i per tant no es publica.
   */
  it("dona per descartat el fitxer que la resposta no menciona", () => {
    const r = llegeixLlicencies(RESPOSTA_COMMONS, [...demanats, "File:Que no hi es.svg"]).get(
      "File:Que no hi es.svg",
    )!;
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.descartada.motiu).toContain("no coneix");
  });

  it("descarta la pàgina que Commons marca com a inexistent", () => {
    const absent = { query: { pages: [{ title: "File:X.jpg", missing: true }] } };
    const r = llegeixLlicencies(absent, ["File:X.jpg"]).get("File:X.jpg")!;
    expect(r.ok).toBe(false);
  });

  it("aparella el títol encara que Commons el torni amb guions baixos", () => {
    const ambGuions = {
      query: {
        pages: [
          {
            title: "File:Escut_de_Ripoll.svg",
            imageinfo: [
              {
                url: "https://upload.wikimedia.org/z.svg",
                descriptionurl: "https://commons.wikimedia.org/wiki/File:Escut_de_Ripoll.svg",
                extmetadata: { License: { value: "cc0" } },
              },
            ],
          },
        ],
      },
    };
    const r = llegeixLlicencies(ambGuions, ["File:Escut de Ripoll.svg"]).get(
      "File:Escut de Ripoll.svg",
    )!;
    expect(r.ok).toBe(true);
  });
});

describe("urlCommons", () => {
  it("demana les metadades de llicència de fins a cinquanta fitxers de cop", () => {
    const url = urlCommons(["File:A.svg", "File:B.jpg"]);
    expect(url).toContain("action=query");
    expect(url).toContain("prop=imageinfo");
    expect(url).toContain("iiprop=url%7Cextmetadata");
    expect(decodeURIComponent(url.match(/titles=([^&]+)/)![1]!)).toBe("File:A.svg|File:B.jpg");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// La fitxa que es desa
// ─────────────────────────────────────────────────────────────────────────────

describe("fitxaWikidata", () => {
  const ripoll = parseSparql(RESPOSTA_SPARQL).find((f) => f.qid === "Q14320")!;
  const llicencies = llegeixLlicencies(RESPOSTA_COMMONS, [ripoll.imatge!, ripoll.escut!]);
  const fitxa = fitxaWikidata(ripoll, llicencies, "2026-08-30");

  it("desa la font, la llicència de les dades i la data d'extracció", () => {
    expect(fitxa.font).toContain("Wikidata");
    expect(fitxa.llicenciaDades).toBe("CC0 1.0");
    expect(fitxa.descarregat).toBe("2026-08-30");
    expect(fitxa.url).toBe("https://www.wikidata.org/wiki/Q14320");
  });

  it("desa les dues imatges amb la seva llicència, i cap descartada", () => {
    expect(fitxa.imatge!.llicencia).toBe("cc0");
    expect(fitxa.escut!.autor).toBe("Kilo567");
    expect(fitxa.descartats).toEqual([]);
  });

  it("guarda l'enllaç a la Viquipedia, mai el text", () => {
    expect(fitxa.viquipedia).toBe("https://ca.wikipedia.org/wiki/Ripoll");
    expect(JSON.stringify(fitxa)).not.toContain("wikitext");
  });

  it("converteix la relació d'OpenStreetMap en un enllaç", () => {
    expect(fitxa.osmUrl).toBe("https://www.openstreetmap.org/relation/343534");
    expect(urlOsm(null)).toBeNull();
  });

  /**
   * Una imatge sense llicència comprovada no arriba mai a la fitxa, i el motiu
   * hi queda escrit: si un dia un municipi no ensenya escut, aquí hi ha per què.
   */
  it("deixa fora la imatge que no ha passat el filtre i n'anota el motiu", () => {
    const nomesEscut = new Map<string, ResultatFitxer>([
      [
        "File:Escut de Ripoll.svg",
        llegeixLlicencies(RESPOSTA_COMMONS, []).get("File:Escut de Ripoll.svg")!,
      ],
    ]);
    const parcial = fitxaWikidata(ripoll, nomesEscut, "2026-08-30");
    expect(parcial.escut).not.toBeNull();
    expect(parcial.imatge).toBeNull();
    expect(parcial.descartats).toEqual([
      {
        fitxer: "File:Ripoll - Monestir de Santa Maria.jpg",
        llicencia: null,
        motiu: "llicència no consultada",
      },
    ]);
  });

  it("un municipi sense escut no arrossega cap descartat", () => {
    const mollo = parseSparql(RESPOSTA_SPARQL).find((f) => f.qid === "Q15069")!;
    const fitxaMollo = fitxaWikidata(mollo, new Map(), "2026-08-30");
    expect(fitxaMollo.escut).toBeNull();
    expect(fitxaMollo.descartats.map((d) => d.fitxer)).toEqual(["File:Molló des del sud.jpg"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// La represa
// ─────────────────────────────────────────────────────────────────────────────

describe("memoriaPrevia", () => {
  const ripoll = parseSparql(RESPOSTA_SPARQL).find((f) => f.qid === "Q14320")!;
  const fitxa = fitxaWikidata(
    ripoll,
    llegeixLlicencies(RESPOSTA_COMMONS, [ripoll.imatge!, ripoll.escut!]),
    "2026-08-30",
  );

  it("recorda les llicències ja llegides perquè no es tornin a demanar", () => {
    const cau = memoriaPrevia([fitxa]);
    expect([...cau.keys()].sort()).toEqual([
      "File:Escut de Ripoll.svg",
      "File:Ripoll - Monestir de Santa Maria.jpg",
    ]);
    const escut = cau.get("File:Escut de Ripoll.svg")!;
    expect(escut.ok).toBe(true);
    if (escut.ok) expect(escut.imatge.autor).toBe("Kilo567");
  });

  /**
   * Els descartats no s'hi guarden: són pocs i, si algú arregla la llicència
   * d'un escut a Commons, la propera execució ho ha de poder veure. Recordar el
   * «no» el faria etern.
   */
  it("no recorda els descartats, que s'han de tornar a mirar", () => {
    const ambDescartat: FitxaWikidata = {
      ...fitxa,
      imatge: null,
      descartats: [{ fitxer: "File:X.jpg", llicencia: "cc-by-nc-4.0", motiu: "llicència no lliure" }],
    };
    const cau = memoriaPrevia([ambDescartat]);
    expect(cau.has("File:X.jpg")).toBe(false);
    expect(cau.has("File:Escut de Ripoll.svg")).toBe(true);
  });

  it("una base sense cap fila anterior no recorda res", () => {
    expect(memoriaPrevia([]).size).toBe(0);
  });
});
