import { describe, expect, it } from "vitest";
import {
  municipalityName, nomPreferit, nomsOficials, normalize, normalizePersonName, slugifyMunicipality,
  uninvertArticle,
} from "./text";

describe("municipalityName", () => {
  it("desfà la contracció i conserva l'article, que és part del nom oficial", () => {
    expect(municipalityName("Ajuntament de Barcelona")).toBe("Barcelona");
    expect(municipalityName("Ajuntament d'Abrera")).toBe("Abrera");
    expect(municipalityName("Ajuntament del Cogul")).toBe("el Cogul");
    expect(municipalityName("Ajuntament dels Torms")).toBe("els Torms");
    expect(municipalityName("Ajuntament de la Floresta")).toBe("la Floresta");
    expect(municipalityName("Ajuntament de les Llosses")).toBe("les Llosses");
    expect(municipalityName("Ajuntament de l'Hospitalet de Llobregat")).toBe("l'Hospitalet de Llobregat");
    expect(municipalityName("Ajuntament dels Omells de na Gaia")).toBe("els Omells de na Gaia");
  });

  it("el nom que en surt lliga amb el dataset que inverteix l'article", () => {
    const delPadro = municipalityName("Ajuntament dels Omells de na Gaia");
    expect(normalize(delPadro)).toBe(normalize(uninvertArticle("OMELLS DE NA GAIA, ELS")));
  });
});

describe("uninvertArticle", () => {
  it("torna l'article al davant", () => {
    expect(uninvertArticle("OMELLS DE NA GAIA, ELS")).toBe("ELS OMELLS DE NA GAIA");
    expect(uninvertArticle("FIGUERA, LA")).toBe("LA FIGUERA");
    expect(uninvertArticle("ARGENTERA, L'")).toBe("L'ARGENTERA");
    expect(uninvertArticle("GRANYENA DE SEGARRA")).toBe("GRANYENA DE SEGARRA");
  });
});

describe("slugifyMunicipality", () => {
  it("deixa fora l'article inicial perquè la gent el cerca sense", () => {
    expect(slugifyMunicipality("l'Hospitalet de Llobregat")).toBe("hospitalet-de-llobregat");
    expect(slugifyMunicipality("Sant Cugat del Vallès")).toBe("sant-cugat-del-valles");
    expect(slugifyMunicipality("la Seu d'Urgell")).toBe("seu-d-urgell");
  });
});

describe("normalizePersonName", () => {
  it("aparella el mateix nom escrit de maneres diferents", () => {
    expect(normalizePersonName("MARTÍ RIERA ROVIRA")).toBe(normalizePersonName("Martí Riera i Rovira"));
    expect(normalizePersonName("Marta Farrés Falgueras")).toBe("marta farres falgueras");
  });
});

describe("normalizePersonName amb els noms reals de les fonts", () => {
  it("ignora el motiu entre parèntesis de les llistes electorals", () => {
    expect(normalizePersonName("Concepción(conxi) Sierra Martín"))
      .toBe(normalizePersonName("Concepción Sierra Martín"));
    expect(normalizePersonName("Maria Teresa(maite) Novell Joya"))
      .toBe(normalizePersonName("Maria Teresa Novell Joya"));
  });

  it("ignora la «i» copulativa dels cognoms", () => {
    expect(normalizePersonName("Ramon Bachs i Vendrell")).toBe(normalizePersonName("Ramon Bachs Vendrell"));
  });
});

/**
 * El mateix nom sortia de dues maneres: «Marta Farres Falgueras» a la pàgina
 * de la candidatura, que llegeix el registre de la Generalitat, i «Marta Farrés
 * Falgueras» a la seva, que llegeix la seu electrònica. Una sola regla: guanya
 * la seu, i sense seu, el que hi ha.
 */
describe("nomPreferit", () => {
  const seu = nomsOficials(["Marta Farrés Falgueras", "RAMON BACHS I VENDRELL"]);

  it("l'accent de la seu electrònica guanya el nom sense accent del registre", () => {
    expect(nomPreferit(seu, "Marta Farres Falgueras")).toBe("Marta Farrés Falgueras");
  });

  it("i el de la seu s'escriu com un nom, encara que la seu el doni en majúscules", () => {
    // És el que ja fa la fitxa de la persona amb el mateix nom: les dues
    // pàgines no només trien el mateix nom, l'escriuen igual.
    expect(nomPreferit(seu, "Ramon Bachs Vendrell")).toBe("Ramon Bachs i Vendrell");
  });

  it("sense fitxa a la seu, fa el que pot amb el que hi ha", () => {
    expect(nomPreferit(seu, "JOAN PUIG ROCA")).toBe("Joan Puig Roca");
    expect(nomPreferit(new Map(), "Marta Farres Falgueras")).toBe("Marta Farres Falgueras");
  });
});

describe("nomsOficials", () => {
  it("un nom que lliga amb dues fitxes no hi és: val més cap accent que l'accent d'un altre", () => {
    const seu = nomsOficials(["Maria Garcia Puig", "Maria García Puig", "Pere Coll"]);
    expect(seu.has("maria garcia puig")).toBe(false);
    expect(seu.get("pere coll")).toBe("Pere Coll");
  });

  it("va indexat amb la mateixa clau amb què el projecte creua persones", () => {
    const seu = nomsOficials(["Concepción Sierra Martín"]);
    expect(seu.get(normalizePersonName("Concepción(conxi) Sierra Martín"))).toBe("Concepción Sierra Martín");
  });
});

/**
 * L'historial de la Generalitat escriu «Ma. Dolors Sabater Puig» i Wikidata
 * «Maria Dolors Sabater i Puig»: és la mateixa alcaldessa de Badalona, i si
 * no lliga, l'historial que completa Wikidata la hi posaria dues vegades.
 */
describe("normalizePersonName amb les abreviatures del nom de pila", () => {
  it("«Ma.», «Mª» i «M.ª» són Maria, també en majúscules", () => {
    const clau = normalizePersonName("Maria Dolors Sabater i Puig");
    expect(clau).toBe("maria dolors sabater puig");
    expect(normalizePersonName("Ma. Dolors Sabater Puig")).toBe(clau);
    expect(normalizePersonName("MA. DOLORS SABATER PUIG")).toBe(clau);
    expect(normalizePersonName("Mª Dolors Sabater Puig")).toBe(clau);
    expect(normalizePersonName("M.ª Dolors Sabater Puig")).toBe(clau);
    expect(normalizePersonName("Mª. Dolors Sabater Puig")).toBe(clau);
  });

  it("«Josep M.» és Josep Maria, i «Fco.» és Francisco", () => {
    expect(normalizePersonName("Josep M. Puig Roca")).toBe(normalizePersonName("Josep Maria Puig i Roca"));
    expect(normalizePersonName("JOSEP M. PUIG ROCA")).toBe("josep maria puig roca");
    expect(normalizePersonName("Fco. Javier Pérez Gil")).toBe(normalizePersonName("Francisco Javier Pérez Gil"));
    expect(normalizePersonName("Fca. Martí Vila")).toBe("francisca marti vila");
  });

  it("una «M» o una «Ma» sense punt no es toquen: poden ser un cognom o una inicial de debò", () => {
    expect(normalizePersonName("Joan Ma Serra")).toBe("joan ma serra");
    expect(normalizePersonName("Marta Fàbregas M")).toBe("marta fabregas m");
    // Una M. amb punt però enganxada a una altra lletra no és cap abreviatura.
    expect(normalizePersonName("Anna Comas M.Àngel")).toBe(normalizePersonName("Anna Comas M Àngel"));
  });
});
