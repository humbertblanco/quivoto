import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AMPLADA,
  KIND,
  TERME_ACTUAL,
  alcaldesActuals,
  anyDe,
  continuacioDe,
  esperaReintent,
  camiCreditRetrat,
  camiPublicRetrat,
  candidats,
  consultaFotos,
  directoriRetrats,
  esAlcaldeActual,
  fitxaFotosExalcaldes,
  formatDelsBytes,
  llegeixImageinfo,
  midesImatge,
  netejaUrl,
  parseFotos,
  personaFoto,
  retratDesat,
  serveixElQueHiHa,
  urlImageinfo,
  type Candidat,
  type RetratDesat,
} from "./j28-fotos-exalcaldes";
import { trossos, type FitxaTrajectoria } from "./j21-trajectoria-electes";

/**
 * Les respostes d'aquestes proves són retalls de respostes reals de WDQS i de
 * l'API de Commons del 30-08-2026. La de l'Escala és la que justifica el
 * filtre de llicència: la Generalitat hi va pujar el retrat amb la plantilla
 * «Attribution», que no porta cap codi llegible per màquina, i sense codi no
 * hi ha permís. La de Joan Antoni Baron és la que justifica llegir les mides
 * dels bytes: l'original fa 139 × 140 i l'API diu 240 × 242.
 */

const entitat = (qid: string): string => `http://www.wikidata.org/entity/${qid}`;

type Cela = { value: string };
const resposta = (files: Record<string, string | null>[]): unknown => ({
  results: {
    bindings: files.map((fila) => {
      const b: Record<string, Cela> = {};
      for (const [clau, valor] of Object.entries(fila)) {
        if (valor !== null) b[clau] = { value: valor };
      }
      return b;
    }),
  },
});

const RESPOSTA_COMMONS = {
  batchcomplete: true,
  query: {
    pages: [
      {
        pageid: 65187887,
        ns: 6,
        title: "File:L'alcalde de l'Escala (2003).jpg",
        imageinfo: [
          {
            thumburl:
              "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/L%27alcalde_de_l%27Escala_%282003%29.jpg/250px-L%27alcalde_de_l%27Escala_%282003%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
            thumbwidth: 240,
            thumbheight: 320,
            url: "https://upload.wikimedia.org/wikipedia/commons/9/9e/L%27alcalde_de_l%27Escala_%282003%29.jpg",
            descriptionurl: "https://commons.wikimedia.org/wiki/File:L%27alcalde_de_l%27Escala_(2003).jpg",
            extmetadata: {
              Artist: { value: "Generalitat de Catalunya", source: "commons-desc-page" },
              LicenseShortName: { value: "Attribution", source: "commons-desc-page" },
            },
            mime: "image/jpeg",
          },
        ],
      },
      {
        pageid: 94236449,
        ns: 6,
        title: "File:Roda de premsa de la UGT Girona 02 (cropped).jpg",
        imageinfo: [
          {
            thumburl:
              "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/Roda_de_premsa_de_la_UGT_Girona_02_%28cropped%29.jpg/250px-Roda_de_premsa_de_la_UGT_Girona_02_%28cropped%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
            thumbwidth: 240,
            thumbheight: 289,
            url: "https://upload.wikimedia.org/wikipedia/commons/b/bb/Roda_de_premsa_de_la_UGT_Girona_02_%28cropped%29.jpg",
            descriptionurl:
              "https://commons.wikimedia.org/wiki/File:Roda_de_premsa_de_la_UGT_Girona_02_(cropped).jpg",
            extmetadata: {
              Artist: {
                value: '<a href="//commons.wikimedia.org/wiki/User:Davidpar" title="User:Davidpar">Davidpar</a>',
                source: "commons-desc-page",
              },
              LicenseShortName: { value: "CC BY-SA 4.0", source: "commons-desc-page" },
              AttributionRequired: { value: "true", source: "commons-desc-page" },
              LicenseUrl: { value: "https://creativecommons.org/licenses/by-sa/4.0", source: "commons-desc-page" },
              License: { value: "cc-by-sa-4.0", source: "commons-templates" },
            },
            mime: "image/jpeg",
          },
        ],
      },
      {
        pageid: 96728326,
        ns: 6,
        title: "File:Joan Antoni Baron.png",
        imageinfo: [
          {
            thumburl:
              "https://upload.wikimedia.org/wikipedia/commons/d/d7/Joan_Antoni_Baron.png?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled",
            thumbwidth: 240,
            thumbheight: 242,
            url: "https://upload.wikimedia.org/wikipedia/commons/d/d7/Joan_Antoni_Baron.png",
            descriptionurl: "https://commons.wikimedia.org/wiki/File:Joan_Antoni_Baron.png",
            extmetadata: {
              Artist: { value: "STIC.CAT", source: "commons-desc-page" },
              LicenseShortName: { value: "CC BY 2.0", source: "commons-desc-page" },
              License: { value: "cc-by-2.0", source: "commons-templates" },
            },
            mime: "image/png",
          },
        ],
      },
      {
        pageid: 1,
        ns: 6,
        title: "File:Retrat vectorial.svg",
        imageinfo: [
          {
            thumburl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Retrat_vectorial.svg/240px-Retrat_vectorial.svg.png",
            url: "https://upload.wikimedia.org/wikipedia/commons/0/00/Retrat_vectorial.svg",
            descriptionurl: "https://commons.wikimedia.org/wiki/File:Retrat_vectorial.svg",
            extmetadata: {
              LicenseShortName: { value: "CC BY-SA 4.0", source: "commons-desc-page" },
              License: { value: "cc-by-sa-4.0", source: "commons-templates" },
            },
            mime: "image/svg+xml",
          },
        ],
      },
      {
        ns: 6,
        title: "File:Fitxer que no existeix.jpg",
        missing: true,
        imagerepository: "",
      },
      {
        pageid: 2,
        ns: 6,
        title: "File:Retrat no comercial.jpg",
        imageinfo: [
          {
            thumburl: "https://upload.wikimedia.org/x/240px-Retrat_no_comercial.jpg",
            url: "https://upload.wikimedia.org/x/Retrat_no_comercial.jpg",
            descriptionurl: "https://commons.wikimedia.org/wiki/File:Retrat_no_comercial.jpg",
            extmetadata: {
              LicenseShortName: { value: "CC BY-NC-SA 3.0", source: "commons-desc-page" },
              License: { value: "cc-by-nc-sa-3.0", source: "commons-templates" },
            },
            mime: "image/jpeg",
          },
        ],
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────

describe("camins", () => {
  /** El QID és la clau que la persona porta a totes les fitxes on surt. */
  it("anomena els fitxers amb el QID i el format real", () => {
    expect(camiPublicRetrat("Q14074303", "jpg")).toBe("/observatori/fotos/wikimedia/Q14074303.jpg");
    expect(camiPublicRetrat("Q20003435", "png")).toBe("/observatori/fotos/wikimedia/Q20003435.png");
  });

  it("desa els retrats en un directori a part, dins de les fotos de l'Observatori", () => {
    expect(directoriRetrats("/repo")).toBe("/repo/web/public/observatori/fotos/wikimedia");
    expect(camiCreditRetrat("Q14074303", "/repo")).toBe(
      "/repo/web/public/observatori/fotos/wikimedia/Q14074303.json",
    );
  });

  it("la mètrica té el nom que la publicació llegeix", () => {
    expect(KIND).toBe("fotosExalcaldes");
    expect(TERME_ACTUAL).toBe("2023-2027");
  });
});

describe("alcaldesActuals i esAlcaldeActual", () => {
  const munis = [
    { id: 1, mayorName: "MARTA FARRÉS FALGUERAS" },
    { id: 2, mayorName: null },
    { id: 3, mayorName: null },
  ];
  const files = [
    // Relleu a mig mandat al municipi 2: la primera fila ja ha plegat.
    { municipalityId: 2, name: "Joan Vell i Puig", tookOfficeOn: "2023-06-17" },
    { municipalityId: 2, name: "Anna Nova Roig", tookOfficeOn: "2025-02-01" },
    // Dues files sense data al municipi 3: no es pot saber quina és l'última.
    { municipalityId: 3, name: "Pere Sense Data", tookOfficeOn: null },
    { municipalityId: 3, name: "Rosa Tampoc", tookOfficeOn: null },
  ];
  const actuals = alcaldesActuals(files, munis);

  it("ajunta el nom del padró i l'última fila del mandat en curs", () => {
    expect(actuals.get(1)).toEqual(new Set(["marta farres falgueras"]));
    expect(actuals.get(2)).toEqual(new Set(["anna nova roig"]));
  });

  /**
   * Qui va plegar a mig mandat és un exalcalde: si es deixés fora, el retrat
   * de Commons que li toca no es baixaria mai.
   */
  it("qui va plegar a mig mandat no compta com a alcalde d'ara", () => {
    expect(actuals.get(2)?.has("joan vell puig")).toBe(false);
  });

  it("sense dates s'hi queden totes, que és l'error prudent", () => {
    expect(actuals.get(3)).toEqual(new Set(["pere sense data", "rosa tampoc"]));
  });

  it("la persona queda fora si mana ara a qualsevol municipi on hagi estat alcalde", () => {
    const farres: Candidat = { qid: "Q1", nom: "Marta Farrés i Falgueras", municipis: new Set([5, 1]) };
    const vell: Candidat = { qid: "Q2", nom: "Joan Vell Puig", municipis: new Set([2]) };
    expect(esAlcaldeActual(farres, actuals)).toBe(true);
    expect(esAlcaldeActual(vell, actuals)).toBe(false);
    expect(esAlcaldeActual({ qid: "Q3", nom: "", municipis: new Set([1]) }, actuals)).toBe(false);
  });
});

describe("candidats", () => {
  const fitxa = (persones: { qid: string; nom: string }[]): FitxaTrajectoria =>
    ({ persones } as unknown as FitxaTrajectoria);

  it("dedueix cada persona un cop, amb tots els municipis on surt", () => {
    const tots = candidats([
      { municipalityId: 1, fitxa: fitxa([{ qid: "Q1", nom: "Josep Pujadas" }]) },
      { municipalityId: 2, fitxa: fitxa([{ qid: "Q1", nom: "Josep Pujadas" }, { qid: "Q2", nom: "Maria Roig" }]) },
      { municipalityId: 3, fitxa: { res: true } as unknown as FitxaTrajectoria },
    ]);
    expect(tots.size).toBe(2);
    expect(tots.get("Q1")?.municipis).toEqual(new Set([1, 2]));
    expect(tots.get("Q2")?.municipis).toEqual(new Set([2]));
  });
});

describe("consultaFotos", () => {
  it("demana la fotografia com a obligatòria i els anys com a opcionals", () => {
    const consulta = consultaFotos(["Q14074303", "Q20003435"]);
    expect(consulta).toContain("VALUES ?persona { wd:Q14074303 wd:Q20003435 }");
    expect(consulta).toContain("?persona wdt:P18 ?imatge .");
    expect(consulta).toContain("OPTIONAL { ?persona wdt:P569 ?naixement }");
    expect(consulta).toContain("OPTIONAL { ?persona wdt:P570 ?defuncio }");
  });

  /** 2.921 persones menys els alcaldes d'ara: en lots de 100, una vintena de crides. */
  it("els lots de cent cobreixen tots els QID sense repetir-ne cap", () => {
    const qids = Array.from({ length: 2_021 }, (_, i) => `Q${i + 1}`);
    const lots = trossos(qids, 100);
    expect(lots.length).toBe(21);
    expect(lots[20]!.length).toBe(21);
    const dins = lots.flatMap((lot) => [...consultaFotos(lot).matchAll(/wd:(Q\d+)/g)].map((m) => m[1]));
    expect(dins).toEqual(qids);
  });
});

describe("parseFotos", () => {
  it("llegeix el títol del fitxer, l'any de naixement i el de defunció", () => {
    const fotos = parseFotos(
      resposta([
        {
          persona: entitat("Q11928699"),
          imatge: "http://commons.wikimedia.org/wiki/Special:FilePath/L%27alcalde%20de%20l%27Escala%20%282003%29.jpg",
          naixement: "1945-03-02T00:00:00Z",
          defuncio: "2010-07-19T00:00:00Z",
        },
        {
          persona: entitat("Q20003435"),
          imatge: "http://commons.wikimedia.org/wiki/Special:FilePath/Joan%20Antoni%20Baron.png",
          naixement: null,
          defuncio: null,
        },
      ]),
    );
    expect(fotos).toEqual([
      { qid: "Q11928699", fitxer: "File:L'alcalde de l'Escala (2003).jpg", naixement: 1945, defuncio: 2010 },
      { qid: "Q20003435", fitxer: "File:Joan Antoni Baron.png", naixement: null, defuncio: null },
    ]);
  });

  it("dues fotografies de la mateixa persona són una sola fila", () => {
    const fotos = parseFotos(
      resposta([
        { persona: entitat("Q1"), imatge: "http://commons.wikimedia.org/wiki/Special:FilePath/A.jpg", naixement: null, defuncio: null },
        { persona: entitat("Q1"), imatge: "http://commons.wikimedia.org/wiki/Special:FilePath/B.jpg", naixement: "1950-01-01T00:00:00Z", defuncio: null },
      ]),
    );
    expect(fotos.length).toBe(1);
    expect(fotos[0]!.fitxer).toBe("File:A.jpg");
    // El que la primera fila no porta es completa amb la segona.
    expect(fotos[0]!.naixement).toBe(1950);
  });

  it("no s'ofega amb files sense persona, sense fitxer o amb una resposta buida", () => {
    expect(parseFotos(resposta([{ persona: null, imatge: "http://commons.wikimedia.org/wiki/Special:FilePath/A.jpg" }]))).toEqual([]);
    expect(parseFotos(resposta([{ persona: entitat("Q1"), imatge: "https://example.org/no-es-commons.jpg" }]))).toEqual([]);
    expect(parseFotos({})).toEqual([]);
    expect(parseFotos(null)).toEqual([]);
  });

  it("l'any surt de la data de Wikidata, que ve amb hora", () => {
    expect(anyDe("1945-03-02T00:00:00Z")).toBe(1945);
    expect(anyDe("t1945")).toBeNull();
    expect(anyDe(null)).toBeNull();
  });
});

describe("urlImageinfo i netejaUrl", () => {
  it("demana la miniatura de 240 i només les metadades que calen", () => {
    const url = new URL(urlImageinfo(["File:Joan Antoni Baron.png", "File:Retrat.jpg"]));
    expect(url.origin + url.pathname).toBe("https://commons.wikimedia.org/w/api.php");
    expect(url.searchParams.get("iiurlwidth")).toBe(String(AMPLADA));
    expect(AMPLADA).toBe(240);
    expect(url.searchParams.get("iiprop")).toBe("url|mime|extmetadata");
    expect(url.searchParams.get("titles")).toBe("File:Joan Antoni Baron.png|File:Retrat.jpg");
    expect(url.searchParams.get("iiextmetadatafilter")).toContain("LicenseUrl");
  });

  it("treu la cua de seguiment de la URL de la miniatura", () => {
    expect(
      netejaUrl("https://upload.wikimedia.org/wikipedia/commons/d/d7/Joan_Antoni_Baron.png?utm_source=commons.wikimedia.org&utm_campaign=imageinfo"),
    ).toBe("https://upload.wikimedia.org/wikipedia/commons/d/d7/Joan_Antoni_Baron.png");
    expect(netejaUrl("https://upload.wikimedia.org/x.jpg")).toBe("https://upload.wikimedia.org/x.jpg");
  });
});

describe("llegeixImageinfo", () => {
  const demanats = [
    "File:L'alcalde de l'Escala (2003).jpg",
    "File:Roda de premsa de la UGT Girona 02 (cropped).jpg",
    "File:Joan Antoni Baron.png",
    "File:Retrat vectorial.svg",
    "File:Retrat no comercial.jpg",
    "File:Fitxer que no existeix.jpg",
    "File:Mai contestat.jpg",
  ];
  const resultats = llegeixImageinfo(RESPOSTA_COMMONS, demanats);

  it("desa autor, llicència amb enllaç, pàgina i miniatura neta d'una CC BY-SA", () => {
    const r = resultats.get("File:Roda de premsa de la UGT Girona 02 (cropped).jpg")!;
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.retrat.autor).toBe("Davidpar");
    expect(r.retrat.llicencia).toEqual({
      codi: "cc-by-sa-4.0",
      nom: "CC BY-SA 4.0",
      url: "https://creativecommons.org/licenses/by-sa/4.0",
    });
    expect(r.retrat.paginaFitxer).toBe(
      "https://commons.wikimedia.org/wiki/File:Roda_de_premsa_de_la_UGT_Girona_02_(cropped).jpg",
    );
    expect(r.retrat.miniaturaUrl).not.toContain("utm_");
    expect(r.retrat.miniaturaUrl).toContain("/250px-Roda_de_premsa");
    expect(r.retrat.mime).toBe("image/jpeg");
  });

  it("quan Commons no dona l'enllaç de la llicència, es dedueix del codi", () => {
    const r = resultats.get("File:Joan Antoni Baron.png")!;
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.retrat.llicencia.url).toBe("https://creativecommons.org/licenses/by/2.0/");
    expect(r.retrat.autor).toBe("STIC.CAT");
  });

  /**
   * La plantilla «Attribution» de la Generalitat no porta codi de llicència
   * llegible per màquina. Sense codi no hi ha permís: és desconeixement, i es
   * descarta amb el motiu escrit perquè es pugui decidir un dia a J20.
   */
  it("refusa el retrat sense codi de llicència encara que digui «Attribution»", () => {
    const r = resultats.get("File:L'alcalde de l'Escala (2003).jpg")!;
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.llicencia).toBeNull();
    expect(r.motiu).toBe("Commons no en publica el codi de llicència");
  });

  it("refusa el no comercial, amb la mateixa llista que J20", () => {
    const r = resultats.get("File:Retrat no comercial.jpg")!;
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motiu).toBe("llicència no lliure: cc-by-nc-sa-3.0");
  });

  it("refusa l'SVG encara que la llicència sigui lliure", () => {
    const r = resultats.get("File:Retrat vectorial.svg")!;
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motiu).toBe("format no publicable: image/svg+xml");
  });

  /**
   * Dues coses que s'assemblen i no són el mateix: el fitxer que Commons diu
   * que no existeix (pàgina «missing») i el que la resposta no ha arribat a
   * contestar (un tall per mida). El primer és un fet; el segon és una manca
   * nostra i s'ha de tornar a demanar, no atribuir-li cap problema al fitxer.
   */
  it("distingeix el fitxer inexistent del que la resposta no ha contestat", () => {
    const inexistent = resultats.get("File:Fitxer que no existeix.jpg")!;
    expect(inexistent.ok).toBe(false);
    if (!inexistent.ok) expect(inexistent.motiu).toBe("Commons no coneix aquest fitxer");
    const tallat = resultats.get("File:Mai contestat.jpg")!;
    expect(tallat.ok).toBe(false);
    if (!tallat.ok) expect(tallat.motiu).toBe("Commons no n'ha tornat la informació");
  });

  /**
   * MediaWiki normalitza els títols demanats i contesta amb el seu: sense
   * aplicar el mapa «normalized», el resultat no lliga amb la clau demanada i
   * el fitxer sembla no contestat. La primera execució real en va perdre així.
   */
  it("desfà la normalització de títols del servidor per lligar amb el que es va demanar", () => {
    const resposta = {
      query: {
        normalized: [{ from: "File:Nom  amb   espais.jpg", to: "File:Nom amb espais.jpg" }],
        pages: [
          {
            title: "File:Nom amb espais.jpg",
            imageinfo: [
              {
                thumburl: "https://upload.wikimedia.org/x/240px-Nom.jpg",
                url: "https://upload.wikimedia.org/x/Nom.jpg",
                descriptionurl: "https://commons.wikimedia.org/wiki/File:Nom_amb_espais.jpg",
                extmetadata: {
                  License: { value: "cc0" },
                  LicenseShortName: { value: "CC0" },
                },
                mime: "image/jpeg",
              },
            ],
          },
        ],
      },
    };
    const res = llegeixImageinfo(resposta, ["File:Nom  amb   espais.jpg"]);
    expect(res.get("File:Nom  amb   espais.jpg")).toBeUndefined();
    // La clau de treball és el títol normalitzat nostre, com a tot arreu.
    expect(res.get("File:Nom amb espais.jpg")?.ok).toBe(true);
  });

  /**
   * Una resposta amb «continue» arriba partida: la mateixa pàgina pot venir
   * primer pelada i després amb la informació. Les parts es fusionen i mana
   * la que porta l'imageinfo, vingui en l'ordre que vingui.
   */
  it("fusiona les parts d'una resposta partida i es queda la que porta la informació", () => {
    const part1 = {
      continue: { iistart: "2020-01-01T00:00:00Z", continue: "||" },
      query: { pages: [{ title: "File:Partit.jpg" }, { title: "File:Sempre pelat.jpg" }] },
    };
    const part2 = {
      query: {
        pages: [
          {
            title: "File:Partit.jpg",
            imageinfo: [
              {
                thumburl: "https://upload.wikimedia.org/x/240px-Partit.jpg",
                url: "https://upload.wikimedia.org/x/Partit.jpg",
                descriptionurl: "https://commons.wikimedia.org/wiki/File:Partit.jpg",
                extmetadata: { License: { value: "cc-by-4.0" }, LicenseShortName: { value: "CC BY 4.0" } },
                mime: "image/jpeg",
              },
            ],
          },
        ],
      },
    };
    const res = llegeixImageinfo([part1, part2], ["File:Partit.jpg", "File:Sempre pelat.jpg"]);
    expect(res.get("File:Partit.jpg")?.ok).toBe(true);
    const pelat = res.get("File:Sempre pelat.jpg")!;
    expect(pelat.ok).toBe(false);
    if (!pelat.ok) expect(pelat.motiu).toBe("Commons no n'ha tornat la informació");
    // I el bloc «continue» es llegeix tal com el torna el servidor.
    expect(continuacioDe(part1)).toEqual({ iistart: "2020-01-01T00:00:00Z", continue: "||" });
    expect(continuacioDe(part2)).toBeNull();
    expect(continuacioDe(null)).toBeNull();
  });

  it("la crida de continuació porta els paràmetres del bloc, a més dels de sempre", () => {
    const url = new URL(urlImageinfo(["File:A.jpg"], 240, { iistart: "2020-01-01T00:00:00Z", continue: "||" }));
    expect(url.searchParams.get("iistart")).toBe("2020-01-01T00:00:00Z");
    expect(url.searchParams.get("continue")).toBe("||");
    expect(url.searchParams.get("titles")).toBe("File:A.jpg");
  });

  it("no s'ofega amb una resposta buida", () => {
    const buit = llegeixImageinfo({}, ["File:A.jpg"]);
    expect(buit.get("File:A.jpg")?.ok).toBe(false);
  });
});

describe("esperaReintent", () => {
  /**
   * La paret mesurada el 30-08-2026: després d'una trentena de baixades, la
   * vora de Wikimedia respon 429 amb «retry-after: 11». Fer-li cas és l'única
   * resposta correcta, i el marge de mig segon evita tornar-hi al pèl.
   */
  it("un 429 espera el que diu la capçalera, amb marge", () => {
    expect(esperaReintent(429, "11", 0)).toBe(11_500);
    expect(esperaReintent(429, null, 0)).toBe(2_500);
    expect(esperaReintent(429, null, 2)).toBe(8_500);
  });

  it("un 5xx reintenta amb creixement; un 4xx de debò no reintenta", () => {
    expect(esperaReintent(503, null, 1)).toBe(4_500);
    expect(esperaReintent(404, null, 0)).toBeNull();
    expect(esperaReintent(403, "11", 0)).toBeNull();
  });

  it("mai no s'espera més d'un minut, digui el que digui la capçalera", () => {
    expect(esperaReintent(429, "3600", 0)).toBe(60_000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

/** Capçalera PNG de 139 × 140, les mides reals del retrat de Joan Antoni Baron. */
const PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52,
  0, 0, 0, 139, 0, 0, 0, 140, 8, 6, 0, 0, 0,
]);

/** JPEG amb un APP0 davant del SOF0: 240 d'ample i 320 d'alt. */
const JPEG = Uint8Array.from([
  0xff, 0xd8,
  0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x40, 0x00, 0xf0, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
]);

/** WebP estès (VP8X): les mides van a 24 bits menys u. 240 × 300. */
const WEBP = Uint8Array.from([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  0x56, 0x50, 0x38, 0x58, 10, 0, 0, 0, 0, 0, 0, 0,
  239, 0, 0, 43, 1, 0,
]);

describe("formatDelsBytes i midesImatge", () => {
  it("reconeix el format pels primers bytes i no pel nom", () => {
    expect(formatDelsBytes(PNG)).toBe("png");
    expect(formatDelsBytes(JPEG)).toBe("jpg");
    expect(formatDelsBytes(WEBP)).toBe("webp");
    expect(formatDelsBytes(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(formatDelsBytes(new Uint8Array(0))).toBeNull();
  });

  /** L'API deia 240 × 242 d'aquest PNG; el fitxer diu 139 × 140. Mana el fitxer. */
  it("llegeix les mides reals de la capçalera", () => {
    expect(midesImatge(PNG)).toEqual({ amplada: 139, alcada: 140 });
    expect(midesImatge(JPEG)).toEqual({ amplada: 240, alcada: 320 });
    expect(midesImatge(WEBP)).toEqual({ amplada: 240, alcada: 300 });
  });

  it("un fitxer truncat no dona mides inventades", () => {
    expect(midesImatge(PNG.subarray(0, 20))).toBeNull();
    expect(midesImatge(JPEG.subarray(0, 24))).toBeNull();
    expect(midesImatge(Uint8Array.from([0xff, 0xd8, 0x00, 0x00]))).toBeNull();
  });
});

describe("idempotència", () => {
  const desat: RetratDesat = {
    qid: "Q20003435",
    cami: "/observatori/fotos/wikimedia/Q20003435.png",
    format: "png",
    amplada: 139,
    alcada: 140,
    fitxer: "File:Joan Antoni Baron.png",
    paginaFitxer: "https://commons.wikimedia.org/wiki/File:Joan_Antoni_Baron.png",
    autor: "STIC.CAT",
    llicencia: { codi: "cc-by-2.0", nom: "CC BY 2.0", url: "https://creativecommons.org/licenses/by/2.0" },
    font: "Wikimedia Commons (commons.wikimedia.org)",
    descarregat: "2026-08-30",
  };

  /** El nom local és el QID i no canvia: només el títol de Commons diu si és la mateixa foto. */
  it("serveix el que hi ha només si ve del mateix fitxer de Commons", () => {
    expect(serveixElQueHiHa(desat, "File:Joan Antoni Baron.png")).toBe(true);
    expect(serveixElQueHiHa(desat, "File:Joan_Antoni_Baron.png")).toBe(true);
    expect(serveixElQueHiHa(desat, "File:Joan Antoni Baron 2024.png")).toBe(false);
    expect(serveixElQueHiHa(null, "File:Joan Antoni Baron.png")).toBe(false);
  });

  it("llegeix el crèdit del costat del fitxer, i un JSON trencat és com si no hi fos", async () => {
    const arrel = await mkdtemp(join(tmpdir(), "quivoto-j28-"));
    await mkdir(directoriRetrats(arrel), { recursive: true });
    await writeFile(camiCreditRetrat("Q20003435", arrel), JSON.stringify(desat), "utf8");
    await writeFile(camiCreditRetrat("Q1", arrel), "{ trencat", "utf8");
    expect(await retratDesat("Q20003435", arrel)).toEqual(desat);
    expect(await retratDesat("Q1", arrel)).toBeNull();
    expect(await retratDesat("Q2", arrel)).toBeNull();
  });
});

describe("la fitxa que es desa", () => {
  const desat: RetratDesat = {
    qid: "Q14074303",
    cami: "/observatori/fotos/wikimedia/Q14074303.jpg",
    format: "jpg",
    amplada: 240,
    alcada: 320,
    fitxer: "File:Ferran Roquer Padrosa (2014).jpg",
    paginaFitxer: "https://commons.wikimedia.org/wiki/File:Ferran_Roquer_Padrosa_(2014).jpg",
    autor: "Ajuntament de Figueres",
    llicencia: { codi: "cc-by-sa-4.0", nom: "CC BY-SA 4.0", url: "https://creativecommons.org/licenses/by-sa/4.0" },
    font: "Wikimedia Commons (commons.wikimedia.org)",
    descarregat: "2026-08-30",
  };

  it("porta tot el que el crèdit necessita i el que la pàgina ha de reservar", () => {
    const p = personaFoto({ qid: "Q14074303", nom: "Ferran Roquer i Padrosa" }, { naixement: 1962, defuncio: null }, desat);
    expect(p).toEqual({
      qid: "Q14074303",
      nom: "Ferran Roquer i Padrosa",
      naixement: 1962,
      defuncio: null,
      cami: "/observatori/fotos/wikimedia/Q14074303.jpg",
      format: "jpg",
      amplada: 240,
      alcada: 320,
      fitxer: "File:Ferran Roquer Padrosa (2014).jpg",
      paginaFitxer: "https://commons.wikimedia.org/wiki/File:Ferran_Roquer_Padrosa_(2014).jpg",
      autor: "Ajuntament de Figueres",
      llicencia: { codi: "cc-by-sa-4.0", nom: "CC BY-SA 4.0", url: "https://creativecommons.org/licenses/by-sa/4.0" },
    });
  });

  it("cita les dues fonts, la data i compta qui té cara i qui no", () => {
    const p = personaFoto({ qid: "Q14074303", nom: "Ferran Roquer i Padrosa" }, { naixement: null, defuncio: null }, desat);
    const fitxa = fitxaFotosExalcaldes(
      "17066",
      4,
      [p],
      [{ qid: "Q11928699", nom: "Josep Maria Guinart i Solà", fitxer: "File:L'alcalde de l'Escala (2003).jpg", llicencia: null, motiu: "Commons no en publica el codi de llicència" }],
      "2026-08-30",
    );
    expect(fitxa.font).toBe("Wikidata (wikidata.org)");
    expect(fitxa.fontImatges).toBe("Wikimedia Commons (commons.wikimedia.org)");
    expect(fitxa.llicenciaDades).toBe("CC0 1.0");
    expect(fitxa.consultat).toBe("2026-08-30");
    expect(fitxa.totalPersones).toBe(4);
    expect(fitxa.ambFoto).toBe(1);
    expect(fitxa.persones[0]?.cami).toBe("/observatori/fotos/wikimedia/Q14074303.jpg");
    expect(fitxa.descartades[0]?.motiu).toContain("codi de llicència");
  });
});
