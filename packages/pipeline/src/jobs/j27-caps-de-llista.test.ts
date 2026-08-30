import { describe, expect, it } from "vitest";
import {
  CATALUNYA,
  KIND,
  aparella,
  consultaCarrecs,
  consultaCerca,
  consultaPerfil,
  desambiguaGlobal,
  evidencia,
  familiaDelPartit,
  fitxaCapsDeLlista,
  mateixaFamilia,
  parseCarrecs,
  parseCerca,
  parsePerfil,
  variantsDelNom,
  type Candidat,
  type Electe,
} from "./j27-caps-de-llista";

/**
 * Les respostes d'aquestes proves imiten la forma de WDQS. El cas que fa
 * existir el fitxer és el d'Elisenda Alamany: número dos d'ERC a Barcelona el
 * 2023, el registre l'escriu sense accent i Wikidata amb («Elisenda Alamany i
 * Gutiérrez», Q42963597), i la seva pàgina no deia res més que on seu.
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

const BARCELONA = "08019";

const ALAMANY: Electe = {
  municipalityId: 19,
  ine5: BARCELONA,
  municipi: "Barcelona",
  nom: "Elisenda Alamany Gutierrez",
  sigles: "ERC-AM",
  familia: "erc",
  capDeLlista: false,
  carrec: "Regidora",
};

const candidat = (qid: string, canvis: Partial<Candidat> = {}): Candidat => ({
  qid,
  perfil: {
    qid, etiqueta: null, naixement: null, llocs: [], catalunya: false, partits: [], ocupacions: [],
    articleCa: null, articleEs: null,
  },
  carrecs: [],
  ...canvis,
});

// ─────────────────────────────────────────────────────────────────────────────

describe("variantsDelNom", () => {
  it("prova el nom sencer, sense el segon cognom i amb la «i» entremig, ben escrits", () => {
    expect(variantsDelNom("ELISENDA ALAMANY GUTIERREZ")).toEqual([
      "Elisenda Alamany Gutierrez",
      "Elisenda Alamany",
      "Elisenda Alamany i Gutierrez",
    ]);
  });

  it("un nom de dos mots no s'escurça: no hi ha segon cognom a treure", () => {
    expect(variantsDelNom("Pere Coll")).toEqual(["Pere Coll"]);
  });

  it("ni un que ja porta la «i»: la forma curta hi és igualment", () => {
    expect(variantsDelNom("Josep Pujadas i Maspons")).toEqual(["Josep Pujadas i Maspons"]);
  });

  it("el motiu entre parèntesis del registre no forma part de cap nom", () => {
    expect(variantsDelNom("Marc Almendro Campillo (erc)")).toEqual([
      "Marc Almendro Campillo",
      "Marc Almendro",
      "Marc Almendro i Campillo",
    ]);
    expect(variantsDelNom("   ")).toEqual([]);
  });
});

describe("les consultes", () => {
  it("la cerca demana cada forma en català i en castellà, per etiqueta o àlies, i només persones", () => {
    const q = consultaCerca(['Elisenda Alamany', 'Joan "Pep" Coll']);
    expect(q).toContain('"Elisenda Alamany"@ca');
    expect(q).toContain('"Elisenda Alamany"@es');
    expect(q).toContain('"Joan \\"Pep\\" Coll"@ca');
    expect(q).toContain("rdfs:label|skos:altLabel");
    expect(q).toContain("wdt:P31 wd:Q5");
  });

  it("el perfil i els càrrecs passen els QID per VALUES i miren el codi INE i Catalunya", () => {
    const perfil = consultaPerfil(["Q1", "Q2"]);
    expect(perfil).toContain("VALUES ?persona { wd:Q1 wd:Q2 }");
    expect(perfil).toContain("wdt:P19");
    expect(perfil).toContain("wdt:P551");
    expect(perfil).toContain("wdt:P102");
    expect(perfil).toContain(`wdt:P131* wd:${CATALUNYA}`);
    const carrecs = consultaCarrecs(["Q1"]);
    expect(carrecs).toContain("p:P39");
    expect(carrecs).toContain("wdt:P1001");
    expect(carrecs).toContain("wdt:P772 ?ine");
    // Aquí no es treuen les alcaldies: «va ser alcaldessa» és justament qui és.
    expect(carrecs).not.toContain("NOT EXISTS");
  });

  it("la clau de la mètrica és la que llegeix la publicació", () => {
    expect(KIND).toBe("capsDeLlista");
    expect(CATALUNYA).toBe("Q5705");
  });
});

describe("parseCerca", () => {
  it("dona cada fitxa amb l'etiqueta que ha lligat, sense repetir", () => {
    const trobats = parseCerca(
      resposta([
        { persona: entitat("Q100"), nom: "Elisenda Alamany" },
        { persona: entitat("Q100"), nom: "Elisenda Alamany" },
        { persona: entitat("Q100"), nom: "Elisenda Alamany i Gutiérrez" },
        { persona: entitat("Q200"), nom: "Elisenda Alamany" },
        { persona: "http://www.wikidata.org/entity/P31", nom: "res" },
      ]),
    );
    expect(trobats).toEqual([
      { qid: "Q100", nom: "Elisenda Alamany" },
      { qid: "Q100", nom: "Elisenda Alamany i Gutiérrez" },
      { qid: "Q200", nom: "Elisenda Alamany" },
    ]);
  });
});

describe("parsePerfil", () => {
  it("agrupa per persona: només l'any de naixement, els llocs amb INE, el partit i l'ofici sense «polític»", () => {
    const [p] = parsePerfil(
      resposta([
        {
          persona: entitat("Q100"), etiqueta: "Elisenda Alamany i Gutiérrez", naixement: "1985-04-21T00:00:00Z",
          naixIne: "8019", naixCat: "true", partit: entitat("Q192657"), partitNom: "Esquerra Republicana de Catalunya",
          ocupacio: entitat("Q82955"), ocupacioNom: "polític",
          articleCa: "https://ca.wikipedia.org/wiki/Elisenda_Alamany",
        },
        {
          persona: entitat("Q100"), etiqueta: "Elisenda Alamany i Gutiérrez", naixement: "1985-04-21T00:00:00Z",
          naixIne: "8019", naixCat: "true", partit: entitat("Q192657"), partitNom: "Esquerra Republicana de Catalunya",
          ocupacio: entitat("Q1930187"), ocupacioNom: "periodista",
          articleCa: "https://ca.wikipedia.org/wiki/Elisenda_Alamany",
        },
      ]),
    );
    expect(p).toEqual({
      qid: "Q100",
      etiqueta: "Elisenda Alamany i Gutiérrez",
      naixement: 1985,
      llocs: [BARCELONA],
      catalunya: true,
      partits: ["Esquerra Republicana de Catalunya"],
      ocupacions: ["periodista"],
      articleCa: "https://ca.wikipedia.org/wiki/Elisenda_Alamany",
      articleEs: null,
    });
  });

  it("sense etiqueta catalana agafa la castellana, i sense cap lloc no diu que sigui de Catalunya", () => {
    const [p] = parsePerfil(resposta([{ persona: entitat("Q300"), etiquetaEs: "Juan Pérez" }]));
    expect(p?.etiqueta).toBe("Juan Pérez");
    expect(p?.catalunya).toBe(false);
    expect(p?.naixement).toBeNull();
  });
});

describe("parseCarrecs", () => {
  it("dona cada càrrec amb les dates, el codi INE de l'àmbit a cinc xifres i si és a Catalunya", () => {
    const carrecs = parseCarrecs(
      resposta([
        {
          persona: entitat("Q100"), carrec: entitat("Q500"), etiqueta: "regidor de l'Ajuntament de Barcelona",
          inici: "2023-06-17T00:00:00Z", ine: "8019", cat: "true",
        },
        {
          persona: entitat("Q100"), carrec: entitat("Q600"), etiqueta: "diputada al Parlament de Catalunya",
          inici: "2017-12-21T00:00:00Z", fi: "2021-03-12T00:00:00Z", cat: "true",
        },
        // Un càrrec sense etiqueta catalana es conserva per aparellar, però no
        // porta nom i la pàgina no el publicarà.
        { persona: entitat("Q100"), carrec: entitat("Q700"), ine: "08019" },
        // El mateix càrrec amb la mateixa data, dues vegades: un sol cop.
        {
          persona: entitat("Q100"), carrec: entitat("Q500"), etiqueta: "regidor de l'Ajuntament de Barcelona",
          inici: "2023-06-17T00:00:00Z", ine: "8019", cat: "true",
        },
      ]),
    );
    expect(carrecs).toHaveLength(3);
    expect(carrecs[0]).toEqual({
      qid: "Q100", carrecQid: "Q500", carrec: "regidor de l'Ajuntament de Barcelona",
      inici: "2023-06-17", fi: null, ine5: BARCELONA, catalunya: true,
    });
    expect(carrecs[1]?.fi).toBe("2021-03-12");
    expect(carrecs[1]?.ine5).toBeNull();
    expect(carrecs[2]).toMatchObject({ carrec: null, ine5: BARCELONA, catalunya: false });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("familiaDelPartit i mateixaFamilia", () => {
  it("llegeix els noms llargs amb què Wikidata anomena els partits", () => {
    expect(familiaDelPartit("Esquerra Republicana de Catalunya")).toBe("erc");
    expect(familiaDelPartit("Partit dels Socialistes de Catalunya")).toBe("psc");
    expect(familiaDelPartit("Junts per Catalunya")).toBe("junts");
    expect(familiaDelPartit("Barcelona en Comú")).toBe("comuns");
    expect(familiaDelPartit("Partit Popular")).toBe("pp");
    expect(familiaDelPartit("Convergència Democràtica de Catalunya")).toBe("ciu");
    expect(familiaDelPartit("")).toBeNull();
  });

  it("Junts, el PDeCAT i CiU compten com el mateix llinatge; ERC i el PSC no", () => {
    expect(mateixaFamilia("junts", "ciu")).toBe(true);
    expect(mateixaFamilia("ciu", "junts")).toBe(true);
    expect(mateixaFamilia("junts", "pdecat")).toBe(true);
    expect(mateixaFamilia("erc", "erc")).toBe(true);
    expect(mateixaFamilia("erc", "psc")).toBe(false);
  });
});

describe("evidencia", () => {
  const alBarcelona = candidat("Q100", {
    carrecs: [
      { qid: "Q100", carrecQid: "Q500", carrec: "regidora de Barcelona", inici: null, fi: null, ine5: BARCELONA, catalunya: true },
    ],
  });

  it("un càrrec en aquest municipi és la prova més forta", () => {
    expect(evidencia(ALAMANY, alBarcelona)).toBe("carrec-al-municipi");
  });

  it("haver-hi nascut o viure-hi també lliga", () => {
    const nascuda = candidat("Q100", { perfil: { ...candidat("Q100").perfil!, llocs: [BARCELONA], catalunya: true } });
    expect(evidencia(ALAMANY, nascuda)).toBe("lloc-al-municipi");
  });

  it("el mateix partit només val amb un peu a Catalunya", () => {
    const dErc = (catalunya: boolean): Candidat =>
      candidat("Q100", {
        perfil: { ...candidat("Q100").perfil!, partits: ["Esquerra Republicana de Catalunya"], catalunya },
      });
    expect(evidencia(ALAMANY, dErc(true))).toBe("partit-i-catalunya");
    expect(evidencia(ALAMANY, dErc(false))).toBeNull();
    // El peu a Catalunya pot ser un càrrec d'àmbit català.
    const ambParlament = candidat("Q100", {
      perfil: { ...candidat("Q100").perfil!, partits: ["Esquerra Republicana de Catalunya"] },
      carrecs: [
        { qid: "Q100", carrecQid: "Q600", carrec: "diputada al Parlament de Catalunya", inici: null, fi: null, ine5: null, catalunya: true },
      ],
    });
    expect(evidencia(ALAMANY, ambParlament)).toBe("partit-i-catalunya");
  });

  it("el partit no decideix res quan la llista és local, ni quan no és el mateix", () => {
    const dErc = candidat("Q100", {
      perfil: { ...candidat("Q100").perfil!, partits: ["Esquerra Republicana de Catalunya"], catalunya: true },
    });
    expect(evidencia({ ...ALAMANY, familia: "local", sigles: "Junts pel Poble" }, dErc)).toBeNull();
    expect(evidencia({ ...ALAMANY, familia: null }, dErc)).toBeNull();
    expect(evidencia({ ...ALAMANY, familia: "psc" }, dErc)).toBeNull();
  });

  it("una fitxa que només té el nom no lliga amb ningú", () => {
    expect(evidencia(ALAMANY, candidat("Q100"))).toBeNull();
    expect(evidencia(ALAMANY, { qid: "Q100", perfil: null, carrecs: [] })).toBeNull();
  });
});

describe("aparella", () => {
  const regidora = candidat("Q100", {
    carrecs: [
      { qid: "Q100", carrecQid: "Q500", carrec: "regidora de Barcelona", inici: null, fi: null, ine5: BARCELONA, catalunya: true },
    ],
  });
  const homonima = candidat("Q200", {
    perfil: { ...candidat("Q200").perfil!, partits: ["Esquerra Republicana de Catalunya"], catalunya: true },
  });

  it("amb una sola fitxa que lligui, és ella", () => {
    expect(aparella(ALAMANY, [candidat("Q900"), regidora])).toEqual({
      ok: true, qid: "Q100", motiu: "carrec-al-municipi",
    });
  });

  it("amb dues que lliguin, cap: val més el bloc buit que la carrera d'una altra", () => {
    const r = aparella(ALAMANY, [regidora, homonima]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.qids).toEqual(["Q100", "Q200"]);
      expect(r.motiu).toMatch(/més d'una/);
    }
  });

  it("sense cap fitxa, o amb fitxes que només tenen el nom, tampoc", () => {
    expect(aparella(ALAMANY, [])).toEqual({ ok: false, motiu: "cap fitxa amb aquest nom", qids: [] });
    const r = aparella(ALAMANY, [candidat("Q900")]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.qids).toEqual(["Q900"]);
  });
});

describe("desambiguaGlobal", () => {
  it("una fitxa que lliga amb dues persones pel partit es descarta per a totes dues", () => {
    const files = [
      { electe: ALAMANY, aparellament: { ok: true as const, qid: "Q1", motiu: "partit-i-catalunya" as const } },
      { electe: { ...ALAMANY, ine5: "08121", municipi: "Manresa" }, aparellament: { ok: true as const, qid: "Q1", motiu: "partit-i-catalunya" as const } },
      { electe: { ...ALAMANY, ine5: "08187", municipi: "Sabadell" }, aparellament: { ok: true as const, qid: "Q2", motiu: "partit-i-catalunya" as const } },
    ];
    const net = desambiguaGlobal(files);
    expect(net[0]?.aparellament.ok).toBe(false);
    expect(net[1]?.aparellament.ok).toBe(false);
    expect(net[2]?.aparellament.ok).toBe(true);
  });

  it("però pel càrrec al municipi es pot ser de dos pobles: la fitxa ho diu", () => {
    const files = [
      { electe: ALAMANY, aparellament: { ok: true as const, qid: "Q1", motiu: "carrec-al-municipi" as const } },
      { electe: { ...ALAMANY, ine5: "08121" }, aparellament: { ok: true as const, qid: "Q1", motiu: "carrec-al-municipi" as const } },
    ];
    expect(desambiguaGlobal(files).every((f) => f.aparellament.ok)).toBe(true);
  });
});

describe("fitxaCapsDeLlista", () => {
  const regidora = candidat("Q100", {
    perfil: {
      qid: "Q100", etiqueta: "Elisenda Alamany i Gutiérrez", naixement: 1985, llocs: [BARCELONA], catalunya: true,
      partits: ["Esquerra Republicana de Catalunya"], ocupacions: ["periodista"],
      articleCa: "https://ca.wikipedia.org/wiki/Elisenda_Alamany", articleEs: null,
    },
    carrecs: [
      { qid: "Q100", carrecQid: "Q600", carrec: "diputada al Parlament de Catalunya", inici: "2017-12-21", fi: "2021-03-12", ine5: null, catalunya: true },
      { qid: "Q100", carrecQid: "Q500", carrec: "regidora de Barcelona", inici: "2023-06-17", fi: null, ine5: BARCELONA, catalunya: true },
      { qid: "Q100", carrecQid: "Q700", carrec: null, inici: null, fi: null, ine5: BARCELONA, catalunya: true },
    ],
  });

  it("desa la persona amb el que Wikidata en sap, els càrrecs del més recent al més antic i la font", () => {
    const fitxa = fitxaCapsDeLlista(
      BARCELONA,
      [{ electe: ALAMANY, candidats: [regidora], aparellament: { ok: true, qid: "Q100", motiu: "carrec-al-municipi" } }],
      "2026-08-30",
    );
    expect(fitxa.font).toBe("Wikidata (wikidata.org)");
    expect(fitxa.llicenciaDades).toBe("CC0 1.0");
    expect(fitxa.consultat).toBe("2026-08-30");
    expect(fitxa.buscats).toBe(1);
    expect(fitxa.capsDeLlista).toBe(0);
    expect(fitxa.trobats).toBe(1);
    const [p] = fitxa.persones;
    expect(p).toMatchObject({
      nom: "Elisenda Alamany Gutierrez",
      normalitzat: "elisenda alamany gutierrez",
      sigles: "ERC-AM",
      capDeLlista: false,
      qid: "Q100",
      url: "https://www.wikidata.org/wiki/Q100",
      naixement: 1985,
      ocupacio: ["periodista"],
      partit: "Esquerra Republicana de Catalunya",
      article: { ca: "https://ca.wikipedia.org/wiki/Elisenda_Alamany", es: null },
      motiu: "carrec-al-municipi",
    });
    // El càrrec sense etiqueta no es publica; els altres, del més recent al més antic.
    expect(p?.carrecs.map((c) => c.nom)).toEqual(["regidora de Barcelona", "diputada al Parlament de Catalunya"]);
    expect(p?.carrecs[0]?.alMunicipi).toBe(true);
    expect(p?.carrecs[1]?.alMunicipi).toBe(false);
  });

  it("compta els caps de llista, i qui no s'ha aparellat no hi surt com a persona", () => {
    const fitxa = fitxaCapsDeLlista(
      BARCELONA,
      [
        {
          electe: { ...ALAMANY, nom: "Ernest Maragall i Mira", capDeLlista: true },
          candidats: [],
          aparellament: { ok: false, motiu: "cap fitxa amb aquest nom", qids: [] },
        },
        {
          electe: { ...ALAMANY, nom: "Pere Coll", sigles: "PSC-CP" },
          candidats: [candidat("Q1"), candidat("Q2")],
          aparellament: { ok: false, motiu: "més d'una fitxa amb aquest nom lliga", qids: ["Q1", "Q2"] },
        },
      ],
      "2026-08-30",
    );
    expect(fitxa.persones).toEqual([]);
    expect(fitxa.buscats).toBe(2);
    expect(fitxa.capsDeLlista).toBe(1);
    expect(fitxa.trobats).toBe(0);
    // Només els que tenien alguna fitxa amb el nom: els altres no són cap cosa per mirar.
    expect(fitxa.descartats).toEqual([
      { nom: "Pere Coll", sigles: "PSC-CP", motiu: "més d'una fitxa amb aquest nom lliga", qids: ["Q1", "Q2"] },
    ]);
  });
});
