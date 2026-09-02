import { describe, expect, it } from "vitest";
import {
  adrecesAlcaldies, alcaldiesHistoriques, anysDeLaPersona, descripcioAlcaldia, duradaEscrita, esRedireccioAlcaldia,
  fraseNaixement, genereDe, periodesDeLaPersona, renderAlcaldiaHistorica, renderRedireccioAlcaldia, resultatDeLaLlista, titolAlcaldia,
  type HistorialAlcaldies, type PersonaAlcaldia, type ResultatsPerEleccio,
} from "./alcaldia-historica";
import { DESCRIPCIO_MAXIMA, TITOL_MAXIM } from "./seo";

/**
 * Un historial inventat amb la forma exacta que desa `derive/mayor-changes.ts`,
 * amb els tres casos que la pàgina ha de saber explicar: una persona amb dos
 * mandats seguits, un relleu a mig mandat amb els dos noms coneguts, i el
 * mandat vigent on la font només desa qui hi ha ara. Els noms vénen com els
 * escriu la Generalitat —en majúscules i, de vegades, amb la «i» copulativa—
 * perquè és així com arriben.
 */
const HISTORIAL: HistorialAlcaldies = {
  history: [
    { term: "2023-2027", name: "MARIA PUIG SOLER", partyRaw: "ERC-AM", tookOfficeOn: "2024-10-05" },
    { term: "2019-2023", name: "JOAN ROIG CASTELL", partyRaw: "ERC-AM", tookOfficeOn: "2019-06-15" },
    { term: "2015-2019", name: "JOAN ROIG I CASTELL", partyRaw: "ERC-AM", tookOfficeOn: "2015-06-13" },
    { term: "2011-2015", name: "PERE VIDAL MAS", partyRaw: "CiU", tookOfficeOn: "2013-02-01" },
    { term: "2011-2015", name: "ANNA FERRER ROCA", partyRaw: "CiU", tookOfficeOn: "2011-06-11" },
    { term: "2007-2011", name: "ANNA FERRER ROCA", partyRaw: "CiU", tookOfficeOn: "2007-06-16" },
    { term: "2003-2007", name: "JOAN ROIG CASTELL", partyRaw: "ERC", tookOfficeOn: null },
  ],
  changes: [
    { term: "2023-2027", mayors: [{ name: "MARIA PUIG SOLER", tookOfficeOn: "2024-10-05" }], partyChanged: false, onlySuccessorKnown: true },
    {
      term: "2011-2015",
      mayors: [{ name: "ANNA FERRER ROCA", tookOfficeOn: "2011-06-11" }, { name: "PERE VIDAL MAS", tookOfficeOn: "2013-02-01" }],
      partyChanged: false,
    },
  ],
};

const RESULTATS: ResultatsPerEleccio = {
  M20151: {
    totalVotes: 4_000, seats: 13,
    candidatures: [
      { sigles: "ERC-AM", brandId: "erc", votes: 1_800, seats: 6, share: 45 },
      { sigles: "CiU", brandId: "ciu", votes: 1_500, seats: 5, share: 37.5 },
      { sigles: "PSC-CP", brandId: "psc", votes: 700, seats: 2, share: 17.5 },
    ],
  },
  M20191: {
    totalVotes: 4_200, seats: 13,
    candidatures: [
      { sigles: "ERC-AM", brandId: "erc", votes: 2_100, seats: 7, share: 50 },
      { sigles: "JUNTS", brandId: "junts", votes: 1_400, seats: 4, share: 33.3 },
      { sigles: "PSC-CP", brandId: "psc", votes: 700, seats: 2, share: 16.7 },
    ],
  },
};

const MUNICIPI = { nom: "Alcanar", slug: "alcanar", comarca: "Montsià" };
const AVUI = "2026-09-02";

const persones = () => alcaldiesHistoriques(HISTORIAL, { results: RESULTATS, avui: AVUI });
const roig = () => persones().find((p) => p.slug === "joan-roig-castell")!;

describe("alcaldiesHistoriques", () => {
  it("fa una persona per nom normalitzat, amb tots els mandats en ordre cronològic", () => {
    const totes = persones();
    expect(totes.map((p) => p.nom)).toEqual(["Joan Roig Castell", "Anna Ferrer Roca", "Pere Vidal Mas", "Maria Puig Soler"]);
    // «JOAN ROIG CASTELL» i «JOAN ROIG I CASTELL» són la mateixa persona: tres mandats.
    expect(roig().mandats.map((m) => m.term)).toEqual(["2003-2007", "2015-2019", "2019-2023"]);
  });

  it("l'adreça és alcaldia/<slugify(nomLlegible(nom))>/, i el nom és el del mandat més recent", () => {
    for (const p of persones()) expect(p.adreca).toBe(`alcaldia/${p.slug}/`);
    expect(roig().slug).toBe("joan-roig-castell");
    expect(adrecesAlcaldies(persones()).get("joan roig castell")).toBe("alcaldia/joan-roig-castell/");
  });

  it("un motiu entre parèntesis o la «i» copulativa no parteixen una persona en dues", () => {
    // La clau és `normalizePersonName`, que treu els parèntesis i la «i»; el
    // slug és `slugify(nomLlegible(nom))`, que els conserva. Com que tot el
    // que distingeix dos slugs també distingeix dues claus, dues persones
    // diferents del mateix municipi no poden donar el mateix slug: el sufix
    // «-2» que s'afegiria si passés és una barana, no un cas conegut.
    const una = alcaldiesHistoriques({
      history: [
        { term: "2019-2023", name: "Pau Coll i Mas (Ind.)", partyRaw: null, tookOfficeOn: null },
        { term: "1983-1987", name: "PAU COLL MAS", partyRaw: null, tookOfficeOn: null },
      ],
      changes: [],
    }, { avui: AVUI });
    expect(una).toHaveLength(1);
    expect(una[0]!.slug).toBe("pau-coll-i-mas-ind");
    expect(una[0]!.mandats.map((m) => m.term)).toEqual(["1983-1987", "2019-2023"]);
  });

  it("qui hi és avui i té fitxa de regidor no en té una segona: l'adreça és la de regidor", () => {
    const totes = alcaldiesHistoriques(HISTORIAL, {
      avui: AVUI,
      actual: { nom: "Maria Puig Soler", adreca: "regidor/maria-puig-soler/" },
    });
    const puig = totes.find((p) => p.clau === "maria puig soler")!;
    expect(puig.actual).toBe(true);
    expect(puig.fitxaRegidor).toBe("regidor/maria-puig-soler/");
    expect(puig.adreca).toBe("regidor/maria-puig-soler/");
    // I els altres hi enllacen per aquesta adreça.
    expect(totes.find((p) => p.clau === "joan roig castell")!.despres?.adreca).toBe("regidor/maria-puig-soler/");
    // Sense fitxa de regidor, pàgina d'alcaldia com tothom.
    const sense = alcaldiesHistoriques(HISTORIAL, { avui: AVUI, actual: { nom: "Maria Puig Soler", adreca: null } });
    expect(sense.find((p) => p.clau === "maria puig soler")!.adreca).toBe("alcaldia/maria-puig-soler/");
  });

  it("sap qui va arribar i qui va marxar a mig mandat, i amb qui", () => {
    const ferrer = persones().find((p) => p.clau === "anna ferrer roca")!;
    const vidal = persones().find((p) => p.clau === "pere vidal mas")!;
    const m2011 = ferrer.mandats.find((m) => m.term === "2011-2015")!;
    expect(m2011.marxaAMigMandat).toBe(true);
    expect(m2011.despresEnElMandat?.nom).toBe("Pere Vidal Mas");
    expect(vidal.mandats[0]!.arribaAMigMandat).toBe(true);
    expect(vidal.mandats[0]!.abansEnElMandat?.nom).toBe("Anna Ferrer Roca");
    // Al mandat vigent la font només desa qui hi ha ara: va arribar a mig mandat, no sabem de qui.
    const puig = persones().find((p) => p.clau === "maria puig soler")!;
    expect(puig.mandats[0]!.arribaAMigMandat).toBe(true);
    expect(puig.mandats[0]!.abansEnElMandat).toBeNull();
  });

  it("diu qui hi havia abans i després, i qui va passar entremig de dos mandats no seguits", () => {
    const p = roig();
    expect(p.abans).toBeNull();
    expect(p.despres?.nom).toBe("Maria Puig Soler");
    expect(p.entremig.map((v) => v.nom)).toEqual(["Anna Ferrer Roca", "Pere Vidal Mas"]);
    expect(p.primerAny).toBe(2003);
    expect(p.ultimAny).toBe(2023);
    expect(anysDeLaPersona(p)).toBe("2003-2023");
    expect(anysDeLaPersona(persones().find((q) => q.actual)!)).toBe("des del 2024");
    // Qui va plegar a mig mandat acaba l'any del relleu, no el del mandat.
    expect(persones().find((q) => q.clau === "anna ferrer roca")!.ultimAny).toBe(2013);
  });

  it("compta els anys de presa de possessió a relleu, i els marca aproximats quan falta una data", () => {
    // Vidal: del 2013-02-01 al 2015-06-13, tot amb data.
    const vidal = persones().find((p) => p.clau === "pere vidal mas")!;
    expect(vidal.durada.aproximat).toBe(false);
    expect(duradaEscrita(vidal.durada)).toBe("2 anys i 4 mesos");
    // Roig té un mandat sense data (2003): la suma és aproximada.
    expect(roig().durada.aproximat).toBe(true);
    expect(duradaEscrita(roig().durada)).toMatch(/^uns 1[23] anys$/);
    // Qui hi és avui compta fins avui.
    const puig = persones().find((p) => p.actual)!;
    expect(duradaEscrita(puig.durada)).toBe("1 any i 11 mesos");
  });

  it("lliga el resultat de la seva llista només quan la sigla lliga amb una sola candidatura", () => {
    expect(roig().mandats.find((m) => m.term === "2015-2019")!.resultat).toMatchObject({
      any: 2015, sigles: "ERC-AM", vots: 1_800, regidories: 6, deRegidories: 13, forca: 1, forces: 3,
    });
    // «CiU» del 2011: no tenim els resultats del 2011.
    expect(resultatDeLaLlista(RESULTATS, "2011-2015", "CiU")).toBeNull();
    // Per família quan la sigla no és idèntica.
    expect(resultatDeLaLlista(RESULTATS, "2019-2023", "ERC")?.sigles).toBe("ERC-AM");
    // Una sigla que lliga amb dues llistes no en rep cap.
    const ambigu: ResultatsPerEleccio = {
      M20191: { totalVotes: 100, seats: 5, candidatures: [
        { sigles: "ERC-AM", brandId: "erc", votes: 60, seats: 3, share: 60 },
        { sigles: "ERC-MES", brandId: "erc", votes: 40, seats: 2, share: 40 },
      ] },
    };
    expect(resultatDeLaLlista(ambigu, "2019-2023", "ERC")).toBeNull();
    expect(resultatDeLaLlista(null, "2019-2023", "ERC")).toBeNull();
  });

  it("agafa el retrat de Commons i el que Wikidata en sap, pel nom i només si el nom lliga amb una fitxa", () => {
    const fotos = {
      font: "Wikidata", fontImatges: "Commons", llicenciaDades: "CC0 1.0", consultat: "2026-08-30", ine5: "43004",
      totalPersones: 2, ambFoto: 1, descartades: [],
      persones: [{
        qid: "Q1", nom: "Joan Roig i Castell", naixement: 1960, defuncio: null, cami: "/observatori/fotos/wikimedia/Q1.jpg",
        format: "jpg" as const, amplada: 240, alcada: 320, fitxer: "File:Roig.jpg",
        paginaFitxer: "https://commons.wikimedia.org/wiki/File:Roig.jpg", autor: "Algú",
        llicencia: { codi: "cc-by-sa-4.0", nom: "CC BY-SA 4.0", url: "https://creativecommons.org/licenses/by-sa/4.0/" },
      }],
    };
    const trajectoria = {
      font: "Wikidata (wikidata.org)", url: "https://query.wikidata.org/sparql", llicenciaDades: "CC0 1.0", descarregat: "2026-08-30",
      ine5: "43004", totalPersones: 1, aparellades: 1, ambCarrecSuperior: 1,
      persones: [{
        qid: "Q1", url: "https://www.wikidata.org/wiki/Q1", qidsFusionats: [], nom: "Joan Roig i Castell", naixement: "1960-03-12",
        viquipedia: "https://ca.wikipedia.org/wiki/Joan_Roig", ocupacions: ["mestre"], mandats: [{ inici: "2015-06-13", fi: "2023-06-17" }],
        altresMunicipis: [], carrecs: [{ qid: "Q2", nom: "diputat al Parlament de Catalunya", familia: "parlament" as const, inici: "2021-03-12", fi: null }],
        altresCarrecs: 0, aparellat: true, termes: ["2015-2019", "2019-2023"], motiuNoAparellat: null,
      }],
    };
    const p = alcaldiesHistoriques(HISTORIAL, { avui: AVUI, fotos, trajectoria }).find((q) => q.clau === "joan roig castell")!;
    expect(p.retrat?.cami).toBe("/observatori/fotos/wikimedia/Q1.jpg");
    expect(p.wikidata).toMatchObject({ qid: "Q1", naixement: "1960-03-12", ocupacions: ["mestre"], aparellat: true });
    expect(p.wikidata?.carrecs[0]?.nom).toBe("diputat al Parlament de Catalunya");
    // Els altres no en tenen res.
    expect(alcaldiesHistoriques(HISTORIAL, { avui: AVUI, fotos, trajectoria }).find((q) => q.clau === "pere vidal mas")!.wikidata).toBeNull();
  });

  it("els períodes separen els mandats que no van seguits, i ajunten els que sí", () => {
    // En Roig: 2003-2007, i després dos mandats seguits del 2015 al 2023.
    expect(periodesDeLaPersona(roig())).toBe("2003-2007 i 2015-2023");
    // L'Anna Ferrer va del 2007 fins que en Pere Vidal la releva el 2013: un sol tram.
    expect(periodesDeLaPersona(persones().find((p) => p.slug === "anna-ferrer-roca")!)).toBe("2007-2013");
    // Qui encara hi és acaba amb «des del».
    expect(periodesDeLaPersona(persones().find((p) => p.slug === "maria-puig-soler")!)).toBe("des del 2024");
  });

  it("sense historial no hi ha ningú", () => {
    expect(alcaldiesHistoriques(null)).toEqual([]);
    expect(alcaldiesHistoriques({ history: [], changes: [] })).toEqual([]);
  });
});

describe("el gènere només quan una font el diu", () => {
  const sexes = new Map<string, "H" | "D">([["anna ferrer roca", "D"]]);
  it("mana el càrrec de la seu electrònica de qui hi és avui", () => {
    expect(genereDe("maria puig soler", [{ nom: "Maria Puig Soler", carrec: "Alcaldessa" }], new Map())).toBe("alcaldessa");
    expect(genereDe("joan roig castell", [{ nom: "Joan Roig Castell", carrec: "Alcalde" }], new Map())).toBe("alcalde");
    // Un tinent d'alcalde no és l'alcaldia.
    expect(genereDe("pere vidal mas", [{ nom: "Pere Vidal Mas", carrec: "1r Tinent d'alcalde" }], new Map())).toBeNull();
  });
  it("si no, el sexe del registre de candidatures; si no, res", () => {
    expect(genereDe("anna ferrer roca", null, sexes)).toBe("alcaldessa");
    expect(genereDe("pere vidal mas", null, sexes)).toBeNull();
  });
});

describe("el títol i la descripció", () => {
  it("«Joan Roig Castell, alcalde d'Alcanar (2003-2023)», i neutre quan no se sap", () => {
    expect(titolAlcaldia(roig(), "Alcanar", "alcalde")).toBe("Joan Roig Castell, alcalde d'Alcanar (2003-2023)");
    expect(titolAlcaldia(roig(), "Alcanar", null)).toBe("Joan Roig Castell, a l'alcaldia d'Alcanar (2003-2023)");
    expect(titolAlcaldia(persones().find((p) => p.actual)!, "Alcanar", "alcaldessa")).toBe("Maria Puig Soler, alcaldessa d'Alcanar (des del 2024)");
  });
  it("cap dins dels límits del cercador, també amb un nom i un municipi llargs", () => {
    const llarg: PersonaAlcaldia = { ...roig(), nom: "Maria Immaculada Concepció Bofarull i Castellví de Montcada" };
    expect(titolAlcaldia(llarg, "Vilanova de Prades", null).length).toBeLessThanOrEqual(TITOL_MAXIM);
    expect(descripcioAlcaldia(llarg, "Vilanova de Prades", null).length).toBeLessThanOrEqual(DESCRIPCIO_MAXIMA);
  });
  it("la descripció diu els mandats, el partit i els veïns", () => {
    const d = descripcioAlcaldia(roig(), "Alcanar", "alcalde");
    expect(d).toContain("Alcalde d'Alcanar durant tres mandats (2003-2023) per ERC-AM.");
    expect(d).toContain("Després, Maria Puig Soler.");
  });
});

describe("fraseNaixement", () => {
  const base = { qid: "Q1", url: "", viquipedia: null, ocupacions: [], carrecs: [], aparellat: true, defuncio: null, font: "Wikidata", llicencia: "CC0 1.0", consultat: null };
  it("data amb edat, any sol, i defunció sense edat", () => {
    expect(fraseNaixement({ ...base, naixement: "1960-03-12" }, AVUI)).toBe("Va néixer el 12 de març del 1960 (66 anys).");
    expect(fraseNaixement({ ...base, naixement: "1960-12-12" }, AVUI)).toBe("Va néixer el 12 de desembre del 1960 (65 anys).");
    expect(fraseNaixement({ ...base, naixement: "1960" }, AVUI)).toBe("Va néixer el 1960 (66 anys).");
    expect(fraseNaixement({ ...base, naixement: "1940", defuncio: 2010 }, AVUI)).toBe("Va néixer el 1940 i va morir el 2010.");
    // Wikidata no sempre sap qui ha mort: de cent anys no se'n diu l'edat.
    expect(fraseNaixement({ ...base, naixement: "1920" }, AVUI)).toBe("Va néixer el 1920.");
    expect(fraseNaixement({ ...base, naixement: null }, AVUI)).toBe("");
  });
});

describe("renderAlcaldiaHistorica", () => {
  const html = renderAlcaldiaHistorica(roig(), MUNICIPI, { generatedAt: "2 de setembre del 2026", genere: null, avui: AVUI });

  it("porta el cap SEO d'una persona: títol, canònica, profile, JSON-LD Person i fil d'Ariadna", () => {
    // Amb la marca passaria dels 60 caràcters: el títol va sencer i sense marca, que és la regla de `titolAmbMarca()`.
    expect(html).toContain("<title>Joan Roig Castell, a l'alcaldia d'Alcanar (2003-2023)</title>");
    expect(html).toContain('<link rel="canonical" href="https://quivoto.cat/observatori/m/alcanar/alcaldia/joan-roig-castell/">');
    expect(html).toContain('<meta property="og:type" content="profile">');
    expect(html).toContain('"@type":"Person"');
    expect(html).toContain('"jobTitle":"Titular de l\'alcaldia d\'Alcanar"');
    expect(html).toContain('"@type":"GovernmentOrganization","name":"Ajuntament d\'Alcanar"');
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html).toContain('"name":"Montsià"');
  });

  it("amb gènere conegut el càrrec va amb totes les lletres", () => {
    const amb = renderAlcaldiaHistorica(roig(), MUNICIPI, { generatedAt: "avui", genere: "alcalde", avui: AVUI });
    expect(amb).toContain('"jobTitle":"Alcalde d\'Alcanar"');
    expect(amb).toContain("Alcalde d'Alcanar durant tres mandats (2003-2023), per ERC-AM.");
  });

  it("ensenya els mandats amb la sigla enllaçada, la presa de possessió i el resultat de la llista", () => {
    expect(html).toContain('<b class="mandat-anys">2015-2019</b>');
    expect(html).toContain('href="../../../../partit/erc/"');
    expect(html).toContain("Va prendre possessió el 13 de juny del 2015.");
    expect(html).toContain("La font no en dona la data de presa de possessió.");
    expect(html).toContain("la llista d'<b>ERC-AM</b> va treure");
    expect(html).toContain("<b>1.800 vots</b> (45 %) i <b>6 de les 13 regidories</b>");
    expect(html).toContain("va ser la primera força de 3.");
    expect(html).toContain("<b>uns 1");
  });

  it("diu qui hi havia abans i després, enllaçats, i qui va passar entremig", () => {
    expect(html).toContain('<a href="../../alcaldia/maria-puig-soler/">Maria Puig Soler</a>');
    expect(html).toContain("és la primera alcaldia des del 1979");
    expect(html).toContain('Entre els seus mandats hi va haver <a href="../../alcaldia/anna-ferrer-roca/">Anna Ferrer Roca</a> i <a href="../../alcaldia/pere-vidal-mas/">Pere Vidal Mas</a>.');
  });

  it("el relleu es diu sense motiu ni veredicte", () => {
    const ferrer = renderAlcaldiaHistorica(persones().find((p) => p.clau === "anna ferrer roca")!, MUNICIPI, { generatedAt: "avui", genere: "alcaldessa", avui: AVUI });
    expect(ferrer).toContain("Va deixar l'alcaldia abans d'acabar el mandat: hi va seguir <a href=\"../../alcaldia/pere-vidal-mas/\">Pere Vidal Mas</a>. La font no en diu el motiu, i nosaltres tampoc.");
    expect(ferrer).not.toMatch(/dimissi|censura/i);
    const vidal = renderAlcaldiaHistorica(persones().find((p) => p.clau === "pere vidal mas")!, MUNICIPI, { generatedAt: "avui", genere: null, avui: AVUI });
    expect(vidal).toContain('Va arribar a mig mandat, rellevant <a href="../../alcaldia/anna-ferrer-roca/">Anna Ferrer Roca</a>.');
  });

  it("sense retrat, les inicials del color de la força; amb retrat de Commons, el crèdit sempre visible", () => {
    expect(html).toContain('class="inicials-gran"');
    expect(html).toContain(">JR</span>");
    expect(html).not.toContain("Més enllà de l'ajuntament");
    const retrat = {
      nom: "Joan Roig Castell", cami: "/observatori/fotos/wikimedia/Q1.jpg", fitxer: "File:Roig.jpg",
      paginaFitxer: "https://commons.wikimedia.org/wiki/File:Roig.jpg", autor: "Algú",
      llicencia: { nom: "CC BY-SA 4.0", url: "https://creativecommons.org/licenses/by-sa/4.0/" },
    };
    const amb = renderAlcaldiaHistorica({ ...roig(), retrat }, MUNICIPI, { generatedAt: "avui", genere: null, avui: AVUI });
    expect(amb).toContain('<img class="retrat-gran" src="/observatori/fotos/wikimedia/Q1.jpg"');
    expect(amb).toContain("Foto: Algú, <a href=\"https://creativecommons.org/licenses/by-sa/4.0/\" rel=\"license noopener nofollow\">CC BY-SA 4.0</a>");
    expect(amb).toContain('"image":"https://quivoto.cat/observatori/fotos/wikimedia/Q1.jpg"');
  });

  it("amb Wikidata, el bloc de trajectòria amb la font i la llicència", () => {
    const wikidata = {
      qid: "Q1", url: "https://www.wikidata.org/wiki/Q1", viquipedia: "https://ca.wikipedia.org/wiki/Joan_Roig", ocupacions: ["mestre"],
      carrecs: [{ nom: "diputat al Parlament de Catalunya", inici: "2021-03-12", fi: null }], aparellat: true,
      naixement: "1960-03-12", defuncio: null, font: "Wikidata (wikidata.org)", llicencia: "CC0 1.0", consultat: "2026-08-30",
    };
    const amb = renderAlcaldiaHistorica({ ...roig(), wikidata }, MUNICIPI, { generatedAt: "avui", genere: null, avui: AVUI });
    expect(amb).toContain("Més enllà de l'ajuntament");
    expect(amb).toContain("Va néixer el 12 de març del 1960 (66 anys).");
    expect(amb).toContain("diputat al Parlament de Catalunya");
    expect(amb).toContain('<span class="quan">des del 2021</span>');
    expect(amb).toContain("Les dades de Wikidata són <b>CC0 1.0</b>");
    expect(amb).toContain('"birthDate":"1960-03-12"');
  });

  it("enllaça la fitxa municipal, la taula d'alcaldies, el partit i la comarca", () => {
    expect(html).toContain('<a href="../../"><b>La fitxa d\'Alcanar</b>');
    expect(html).toContain('<a href="../../#alcaldies"><b>Les alcaldies des del 1979</b>');
    expect(html).toContain('href="../../../../partit/erc/"><b>Esquerra Republicana de Catalunya a tot Catalunya</b>');
    expect(html).toContain('href="../../../../c/montsia/"><b>Montsià</b>');
  });
});

describe("la redirecció de qui ja té fitxa de regidor", () => {
  it("apunta a la fitxa de regidor, amb canònica i noindex, i es reconeix", () => {
    const puig = alcaldiesHistoriques(HISTORIAL, { avui: AVUI, actual: { nom: "Maria Puig Soler", adreca: "regidor/maria-puig-soler/" } })
      .find((p) => p.actual)!;
    const html = renderRedireccioAlcaldia(puig, MUNICIPI);
    expect(html).toContain('content="0; url=../../regidor/maria-puig-soler/"');
    expect(html).toContain('<link rel="canonical" href="https://quivoto.cat/observatori/m/alcanar/regidor/maria-puig-soler/">');
    expect(html).toContain('content="noindex,follow"');
    expect(esRedireccioAlcaldia(html)).toBe(true);
    expect(esRedireccioAlcaldia(renderAlcaldiaHistorica(roig(), MUNICIPI, { generatedAt: "avui", genere: null, avui: AVUI }))).toBe(false);
  });
});
