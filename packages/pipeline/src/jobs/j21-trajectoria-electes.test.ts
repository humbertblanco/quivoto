import { describe, expect, it } from "vitest";
import {
  ANY_INICIAL,
  CONSULTA_ALCALDIES,
  KIND,
  agrupaPersones,
  anysDelMandat,
  aparella,
  consultaCarrecs,
  consultaPerfil,
  dataCurtaIso,
  familiaDe,
  fitxaTrajectoria,
  fusionaDuplicats,
  mateixaPersona,
  normalitzaIne,
  parseAlcaldies,
  parseCarrecs,
  parsePerfil,
  qidDeUri,
  solapen,
  trossos,
  urlConsulta,
  type PersonaWikidata,
} from "./j21-trajectoria-electes";

/**
 * Les dades d'aquestes proves són retalls de respostes reals de WDQS del
 * 30-08-2026. Les de Granollers són les que fan que aquest fitxer existeixi:
 * **Josep Pujadas i Maspons hi és dues vegades** —Q76350582 i Q140645246— amb
 * els mateixos tres mandats, i és el cas que la fusió ha de resoldre sense
 * perdre'l ni comptar-lo dos cops.
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

// ─────────────────────────────────────────────────────────────────────────────

describe("familiaDe", () => {
  it("classifica les sis famílies amb les etiquetes reals de Wikidata", () => {
    expect(familiaDe("diputat al Parlament de Catalunya")).toBe("parlament");
    expect(familiaDe("president del Parlament de Catalunya")).toBe("parlament");
    expect(familiaDe("diputat al Congrés dels Diputats")).toBe("congres");
    expect(familiaDe("senador al Senat espanyol")).toBe("senat");
    expect(familiaDe("Senador designat pel Parlament de Catalunya")).toBe("senat");
    expect(familiaDe("president de la Diputació de Girona")).toBe("diputacio");
    expect(familiaDe("conseller de la Presidència")).toBe("govern");
    expect(familiaDe("conseller d'Interior")).toBe("govern");
    expect(familiaDe("President de la Generalitat de Catalunya")).toBe("govern");
    expect(familiaDe("ministre de Defensa")).toBe("govern");
    expect(familiaDe("diputat al Parlament Europeu")).toBe("europeu");
  });

  /**
   * Aquesta és la prova que protegeix la xifra de la pàgina. «Conseller
   * comarcal del Baix Empordà» el porten 42 persones i «conseller del Consell
   * General d'Aran» sis: si s'esmunyissin com a «Govern», la xifra de 26
   * consellers es multiplicaria per deu amb gent que no hi ha estat mai.
   */
  it("no compta com a Govern el que és del mateix món local", () => {
    expect(familiaDe("conseller comarcal del Baix Empordà")).toBeNull();
    expect(familiaDe("conseller comarcal de l'Alt Urgell")).toBeNull();
    expect(familiaDe("conseller del Consell General d'Aran")).toBeNull();
    expect(familiaDe("conseller del Consell de l'Audiovisual")).toBeNull();
    expect(familiaDe("Consellera adjunta de Drets Socials al Consell Comarcal del Berguedà"))
      .toBeNull();
  });

  it("no compta ni les tinences d'alcaldia ni les regidories", () => {
    expect(familiaDe("primer tinent d'alcalde")).toBeNull();
    expect(familiaDe("regidor de l'Ajuntament de Barcelona")).toBeNull();
    expect(familiaDe("vicepresident primer de la Diputació de Barcelona")).toBeNull();
    expect(familiaDe("")).toBeNull();
  });
});

describe("normalitzaIne", () => {
  it("manté el zero del davant, que és el que distingeix Abrera del no-res", () => {
    expect(normalitzaIne("08001")).toBe("08001");
    expect(normalitzaIne(" 8001 ")).toBe("08001");
    expect(normalitzaIne("43155")).toBe("43155");
  });

  it("descarta el que no pot ser un codi INE", () => {
    expect(normalitzaIne(null)).toBeNull();
    expect(normalitzaIne("")).toBeNull();
    expect(normalitzaIne("081234567")).toBeNull();
  });
});

describe("qidDeUri i dataCurtaIso", () => {
  it("treu el QID de l'URI i el dia de la marca de temps", () => {
    expect(qidDeUri(entitat("Q76350582"))).toBe("Q76350582");
    expect(qidDeUri("http://www.wikidata.org/entity/P39")).toBeNull();
    expect(dataCurtaIso("1986-07-26T00:00:00Z")).toBe("1986-07-26");
    expect(dataCurtaIso(null)).toBeNull();
  });
});

describe("les consultes", () => {
  it("la d'alcaldies filtra pel primer any de les municipals democràtiques", () => {
    expect(CONSULTA_ALCALDIES).toContain(`YEAR(?inici) >= ${ANY_INICIAL}`);
    expect(ANY_INICIAL).toBe(1979);
    // La posició ha de ser específica del municipi: és el que fa que
    // l'aparellament sigui quasi determinista.
    expect(CONSULTA_ALCALDIES).toContain("wdt:P31 wd:Q5663900");
    expect(CONSULTA_ALCALDIES).toContain("wdt:P772 ?ine");
  });

  it("les de lot passen els QID per VALUES i demanen l'etiqueta en català", () => {
    const q = consultaCarrecs(["Q1", "Q2"]);
    expect(q).toContain("VALUES ?persona { wd:Q1 wd:Q2 }");
    expect(q).toContain('lang(?etiqueta) = "ca"');
    // Les alcaldies ja les tenim de la primera consulta i aquí només farien soroll.
    expect(q).toContain("FILTER NOT EXISTS { ?carrec wdt:P31 wd:Q5663900 }");
    expect(consultaPerfil(["Q1"])).toContain("wdt:P106 ?ocupacio");
  });

  it("l'URL demana JSON i porta la consulta escapada", () => {
    const url = urlConsulta("SELECT ?a WHERE { ?a ?b ?c }");
    expect(url.startsWith("https://query.wikidata.org/sparql?format=json&query=")).toBe(true);
    expect(url).not.toContain(" ");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

const ALCALDIES = resposta([
  {
    persona: entitat("Q76350582"),
    nom: "Josep Pujadas i Maspons",
    ine: "08096",
    municipi: "Granollers",
    inici: "1986-07-26T00:00:00Z",
    fi: "1992-05-22T00:00:00Z",
  },
  {
    persona: entitat("Q76350582"),
    nom: "Josep Pujadas i Maspons",
    ine: "08096",
    municipi: "Granollers",
    inici: "1996-12-21T00:00:00Z",
    fi: "1998-10-31T00:00:00Z",
  },
  {
    // El duplicat: mateix nom, mateix municipi, mandat solapat, fitxa més buida.
    persona: entitat("Q140645246"),
    nom: "Josep Pujadas i Maspons",
    ine: "08096",
    municipi: "Granollers",
    inici: "1986-07-26T00:00:00Z",
    fi: "1992-05-22T00:00:00Z",
  },
  {
    persona: entitat("Q9999"),
    nom: "Maria Roig i Puig",
    ine: "8096",
    municipi: "Granollers",
    inici: "2015-06-13T00:00:00Z",
    fi: null,
  },
  {
    // Sense data d'inici no hi ha res per solapar: la fila no serveix.
    persona: entitat("Q8888"),
    nom: "Anònim Sense Dates",
    ine: "08096",
    municipi: "Granollers",
    inici: null,
    fi: null,
  },
]);

describe("parseAlcaldies", () => {
  it("llegeix els mandats i descarta el que no es pot aparellar", () => {
    const files = parseAlcaldies(ALCALDIES);
    expect(files).toHaveLength(4);
    expect(files.every((f) => f.ine5 === "08096")).toBe(true);
    expect(files[0]).toMatchObject({ qid: "Q76350582", inici: "1986-07-26", fi: "1992-05-22" });
    // El mandat en curs es desa amb el final obert, no amb una data inventada.
    expect(files[3]).toMatchObject({ qid: "Q9999", inici: "2015-06-13", fi: null });
    expect(files.some((f) => f.qid === "Q8888")).toBe(false);
  });

  it("no compta dues vegades el mateix mandat", () => {
    const doble = resposta([
      { persona: entitat("Q1"), nom: "A B", ine: "08096", municipi: "Granollers", inici: "1999-07-03T00:00:00Z", fi: null },
      { persona: entitat("Q1"), nom: "A B", ine: "08096", municipi: "Granollers", inici: "1999-07-03T00:00:00Z", fi: null },
    ]);
    expect(parseAlcaldies(doble)).toHaveLength(1);
  });

  it("una resposta buida o malmesa no peta", () => {
    expect(parseAlcaldies({})).toEqual([]);
    expect(parseAlcaldies(null)).toEqual([]);
  });
});

const CARRECS = resposta([
  {
    persona: entitat("Q76350582"),
    carrec: entitat("Q18714088"),
    etiqueta: "diputat al Parlament de Catalunya",
    inici: "1995-10-01T00:00:00Z",
    fi: "1999-09-01T00:00:00Z",
  },
  {
    persona: entitat("Q76350582"),
    carrec: entitat("Q30228494"),
    etiqueta: "conseller comarcal del Baix Empordà",
    inici: null,
    fi: null,
  },
  {
    persona: entitat("Q9999"),
    carrec: entitat("Q19323171"),
    etiqueta: "senador al Senat espanyol",
    inici: "2019-05-21T00:00:00Z",
    fi: null,
  },
]);

const PERFILS = resposta([
  {
    persona: entitat("Q76350582"),
    ocupacio: entitat("Q40348"),
    ocupacioNom: "advocat",
    naixement: "1948-03-11T00:00:00Z",
    article: "https://ca.wikipedia.org/wiki/Josep_Pujadas_i_Maspons",
  },
  {
    // «Polític» és soroll: no diu res de ningú i és el que cal filtrar.
    persona: entitat("Q76350582"),
    ocupacio: entitat("Q82955"),
    ocupacioNom: "polític",
    naixement: "1948-03-11T00:00:00Z",
    article: "https://ca.wikipedia.org/wiki/Josep_Pujadas_i_Maspons",
  },
  { persona: entitat("Q9999"), ocupacio: null, ocupacioNom: null, naixement: null, article: null },
]);

describe("parseCarrecs i parsePerfil", () => {
  it("classifica cada càrrec i deixa el que no és cap salt amb família nul·la", () => {
    const files = parseCarrecs(CARRECS);
    expect(files).toHaveLength(3);
    expect(files[0]).toMatchObject({ familia: "parlament", inici: "1995-10-01" });
    expect(files[1]!.familia).toBeNull();
    expect(files[2]).toMatchObject({ familia: "senat", fi: null });
  });

  it("treu «polític» de les ocupacions i no repeteix cap fila", () => {
    const perfils = parsePerfil(PERFILS);
    expect(perfils).toHaveLength(2);
    expect(perfils[0]).toMatchObject({
      qid: "Q76350582",
      naixement: "1948-03-11",
      ocupacions: ["advocat"],
    });
    expect(perfils[1]!.ocupacions).toEqual([]);
    expect(perfils[1]!.viquipedia).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("solapen i anysDelMandat", () => {
  it("un mandat sense final es considera obert", () => {
    expect(solapen({ inici: "2019-06-15", fi: null }, { inici: "2023-01-01", fi: "2027-12-31" }))
      .toBe(true);
    expect(solapen({ inici: "1986-07-26", fi: "1992-05-22" }, { inici: "1999-01-01", fi: "2003-12-31" }))
      .toBe(false);
  });

  it("es toquen encara que sigui per un dia", () => {
    expect(solapen({ inici: "1991-05-26", fi: "1995-06-17" }, { inici: "1995-01-01", fi: "1999-12-31" }))
      .toBe(true);
  });

  it("llegeix la legislatura tal com la publica la font", () => {
    expect(anysDelMandat("2023-2027")).toEqual({ inici: "2023-01-01", fi: "2027-12-31" });
    expect(anysDelMandat("1979-1983")).toEqual({ inici: "1979-01-01", fi: "1983-12-31" });
    expect(anysDelMandat("no ho sé")).toBeNull();
  });
});

describe("fusionaDuplicats", () => {
  const persones = agrupaPersones(
    parseAlcaldies(ALCALDIES),
    parseCarrecs(CARRECS),
    parsePerfil(PERFILS),
  );

  it("reconeix que els dos Josep Pujadas són la mateixa persona", () => {
    const [a, b] = persones.filter((p) => p.nom.startsWith("Josep"));
    expect(mateixaPersona(a!, b!)).toBe(true);
  });

  it("els fusiona en comptes de descartar-los, i es queda el que sap més", () => {
    const { persones: fusionades, fusions } = fusionaDuplicats(persones);
    expect(persones).toHaveLength(3);
    expect(fusionades).toHaveLength(2);
    expect(fusions).toEqual([
      {
        conservat: "Q76350582",
        absorbits: ["Q140645246"],
        nom: "Josep Pujadas i Maspons",
        ine5: "08096",
      },
    ]);
    const josep = fusionades.find((p) => p.qid === "Q76350582")!;
    // Els dos mandats propis, i el del duplicat que ja hi era no es repeteix.
    expect(josep.mandats).toHaveLength(2);
    expect(josep.viquipedia).toContain("ca.wikipedia.org");
    expect(josep.carrecs.map((c) => c.familia)).toEqual(["parlament"]);
    expect(josep.altresCarrecs).toBe(1);
  });

  it("dos noms iguals de municipis diferents no es fusionen mai", () => {
    const base: PersonaWikidata = {
      qid: "Q1", qidsFusionats: [], nom: "Joan Puig", nomNormalitzat: "joan puig",
      naixement: null, viquipedia: null, ocupacions: [], carrecs: [], altresCarrecs: 0,
      mandats: [{ ine5: "08096", municipi: "Granollers", inici: "1999-07-03", fi: "2003-06-14" }],
    };
    const altre: PersonaWikidata = {
      ...base, qid: "Q2",
      mandats: [{ ine5: "43155", municipi: "Tortosa", inici: "1999-07-03", fi: "2003-06-14" }],
    };
    expect(mateixaPersona(base, altre)).toBe(false);
    expect(fusionaDuplicats([base, altre]).persones).toHaveLength(2);
  });

  it("el mateix nom al mateix poble en èpoques que no es toquen tampoc es fusiona", () => {
    // Pare i fill amb el mateix nom és el cas real que la fusió no ha de tocar:
    // dins de les 2.921 persones no n'hi ha cap, però la regla ho ha de dir.
    const pare: PersonaWikidata = {
      qid: "Q1", qidsFusionats: [], nom: "Joan Puig", nomNormalitzat: "joan puig",
      naixement: null, viquipedia: null, ocupacions: [], carrecs: [], altresCarrecs: 0,
      mandats: [{ ine5: "08096", municipi: "Granollers", inici: "1983-05-23", fi: "1987-06-30" }],
    };
    const fill: PersonaWikidata = {
      ...pare, qid: "Q2",
      mandats: [{ ine5: "08096", municipi: "Granollers", inici: "2015-06-13", fi: null }],
    };
    expect(mateixaPersona(pare, fill)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("aparella", () => {
  const josep = fusionaDuplicats(
    agrupaPersones(parseAlcaldies(ALCALDIES), parseCarrecs(CARRECS), parsePerfil(PERFILS)),
  ).persones.find((p) => p.qid === "Q76350582")!;

  it("lliga quan el nom i les dates hi són tots dos", () => {
    const resultat = aparella(josep, "08096", [
      { term: "1987-1991", nom: "JOSEP PUJADAS MASPONS" },
      { term: "1995-1999", nom: "JOSEP PUJADAS MASPONS" },
      { term: "2003-2007", nom: "Maria Roig i Puig" },
    ]);
    // La «i» copulativa i les majúscules no han de trencar res: és el que fa
    // «normalizePersonName», la mateixa que creua persones a la resta del projecte.
    expect(resultat).toEqual({ ok: true, termes: ["1987-1991", "1995-1999"] });
  });

  it("no lliga si el nom no hi és, i ho diu", () => {
    const resultat = aparella(josep, "08096", [{ term: "1987-1991", nom: "Una Altra Persona" }]);
    expect(resultat.ok).toBe(false);
    expect(resultat).toMatchObject({ motiu: "cap alcaldia nostra amb aquest nom en aquest municipi" });
  });

  /**
   * El cas que justifica demanar les dues coses alhora. Si només es mirés el
   * nom, aquest alcalde quedaria enganxat a una legislatura on no hi era: en
   * una pàgina que porta el seu nom al títol, és el pitjor error possible.
   */
  it("no lliga si el nom hi és però les dates no es toquen", () => {
    const resultat = aparella(josep, "08096", [
      { term: "2019-2023", nom: "Josep Pujadas i Maspons" },
    ]);
    expect(resultat).toEqual({ ok: false, motiu: "el nom lliga però les dates no es toquen" });
  });

  it("una legislatura que no sabem llegir no aparella ni descarta", () => {
    expect(aparella(josep, "08096", [{ term: "vuitanta", nom: "Josep Pujadas i Maspons" }]))
      .toMatchObject({ ok: false });
  });
});

describe("fitxaTrajectoria", () => {
  const { persones } = fusionaDuplicats(
    agrupaPersones(parseAlcaldies(ALCALDIES), parseCarrecs(CARRECS), parsePerfil(PERFILS)),
  );
  const fitxa = fitxaTrajectoria(
    "08096",
    persones.map((persona) => ({
      persona,
      aparellament: aparella(persona, "08096", [
        { term: "1987-1991", nom: "Josep Pujadas i Maspons" },
      ]),
    })),
    "2026-08-30",
  );

  it("desa la font, la llicència i la data, que és el que la fa publicable", () => {
    expect(KIND).toBe("trajectoriaElectes");
    expect(fitxa.font).toContain("Wikidata");
    expect(fitxa.llicenciaDades).toBe("CC0 1.0");
    expect(fitxa.descarregat).toBe("2026-08-30");
    expect(fitxa.url).toBe("https://query.wikidata.org/sparql");
  });

  it("cada persona porta el seu QID i l'enllaç a la seva fitxa d'origen", () => {
    const josep = fitxa.persones.find((p) => p.qid === "Q76350582")!;
    expect(josep.url).toBe("https://www.wikidata.org/wiki/Q76350582");
    expect(josep.qidsFusionats).toEqual(["Q140645246"]);
    expect(josep.carrecs).toEqual([
      {
        qid: "Q18714088",
        nom: "diputat al Parlament de Catalunya",
        familia: "parlament",
        inici: "1995-10-01",
        fi: "1999-09-01",
      },
    ]);
  });

  it("qui no lliga es desa igualment, però dient que no lliga", () => {
    expect(fitxa.totalPersones).toBe(2);
    expect(fitxa.aparellades).toBe(1);
    expect(fitxa.ambCarrecSuperior).toBe(2);
    const maria = fitxa.persones.find((p) => p.qid === "Q9999")!;
    expect(maria.aparellat).toBe(false);
    expect(maria.termes).toEqual([]);
    expect(maria.motiuNoAparellat).toBe("cap alcaldia nostra amb aquest nom en aquest municipi");
  });
});

describe("trossos", () => {
  it("parteix la llista de QID en lots de la mida demanada", () => {
    expect(trossos([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(trossos([], 300)).toEqual([]);
  });
});
