import { describe, expect, it } from "vitest";
import { municipalityName, normalize, normalizePersonName, slugifyMunicipality, uninvertArticle } from "./text";

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
