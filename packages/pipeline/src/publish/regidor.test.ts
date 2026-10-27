import { describe, expect, it } from "vitest";
import {
  adrecesRegidors, carrecALaVista, carrecAmbMunicipi, carrecCurt, descripcioRegidor, fetsQueCaben, frasesQueCaben, indexDeLaFitxa,
  nomCurt, quiEsDeWikidata,
  renderRegidor, slugRegidor, titolQueCap, titolRegidor, trajectoriaDePersona,
  type ContextRegidor,
} from "./regidor";
import { DESCRIPCIO_MAXIMA, TITOL_MAXIM } from "./seo";
import { fitxaEnsPerNom } from "./regidor";
import { ensDeProva } from "./ens-prova-enllacos";

describe("adrecesRegidors", () => {
  it("dona una adreça diferent a dues persones que es diuen igual", () => {
    const carrecs = [{ nom: "Maria Garcia Puig" }, { nom: "Maria Garcia Puig" }];
    const adreces = [...adrecesRegidors(carrecs).values()];
    expect(adreces).toEqual(["maria-garcia-puig", "maria-garcia-puig-2"]);
  });

  it("és estable: la mateixa llista dona sempre les mateixes adreces", () => {
    const carrecs = [{ nom: "Anna Coll" }, { nom: "Pere Coll" }, { nom: "Anna Coll" }];
    expect([...adrecesRegidors(carrecs).values()]).toEqual([
      ...adrecesRegidors(carrecs).values(),
    ]);
  });

  it("no toca les adreces de la resta quan n'hi ha una de repetida", () => {
    const carrecs = [{ nom: "Anna Coll" }, { nom: "Anna Coll" }, { nom: "Pere Coll" }];
    expect(adrecesRegidors(carrecs).get(carrecs[2]!)).toBe("pere-coll");
  });
});

const REGIDORA = {
  nom: "Marta Alarcón i Puerto",
  carrec: "Regidora",
  grup: "Grup Municipal Republicà (GMR)",
  sigles: "ERC-AM",
  color: "#ffb232",
  equipGovern: false,
  foto: null,
  fitxaOficial: null,
  posicioLlista: 2,
  entradaTardana: false,
  canviDeGrup: null,
};

const CONTEXT = {
  municipi: "Esplugues de Llobregat",
  slug: "esplugues-de-llobregat",
  regidories: 21,
  majoria: 11,
  votsDelGrup: [
    {
      data: "2025-10-29",
      titol: "Modificació de l'ordenança fiscal núm. 4",
      sentit: "contra",
      url: "https://example.org/acta.pdf",
      tot: true,
      marge: 1,
      favor: 10,
      contra: 11,
    },
  ],
  actesLlegides: 12,
  adreca: "marta-alarcon-pujol",
  governConegut: true,
  publicaDeLaPersona: null,
    altresCarrecs: [],
    avisRetribucions: null,
  assistencia: { hi: 11, de: 12 },
};

/**
 * La fitxa que desa J21 d'un municipi, retallada al que llegeix aquesta pàgina.
 * Les xifres del capçal són les de l'extracció del 30-08-2026.
 */
const FITXA_J21 = {
  font: "Wikidata (wikidata.org)",
  url: "https://query.wikidata.org/sparql",
  llicenciaDades: "CC0 1.0",
  descarregat: "2026-08-30",
  ine5: "08077",
  totalPersones: 2,
  aparellades: 1,
  ambCarrecSuperior: 1,
  persones: [
    {
      qid: "Q11907",
      url: "https://www.wikidata.org/wiki/Q11907",
      qidsFusionats: [],
      nom: "Marta Alarcón i Puerto",
      naixement: "1962-04-11",
      viquipedia: "https://ca.wikipedia.org/wiki/Marta_Alarc%C3%B3n",
      ocupacions: ["advocada"],
      mandats: [{ inici: "2011-06-11", fi: null }],
      altresMunicipis: [],
      carrecs: [
        {
          qid: "Q18714",
          nom: "diputada al Parlament de Catalunya",
          familia: "parlament" as const,
          inici: "1999-10-01",
          fi: "2003-09-01",
        },
      ],
      altresCarrecs: 0,
      aparellat: true,
      termes: ["2011-2015"],
      motiuNoAparellat: null,
    },
  ],
};

describe("trajectoriaDePersona", () => {
  it("troba la persona pel nom normalitzat", () => {
    const t = trajectoriaDePersona(FITXA_J21, "MARTA ALARCON I PUERTO");
    expect(t?.qid).toBe("Q11907");
    expect(t?.carrecs).toHaveLength(1);
    expect(t?.llicencia).toBe("CC0 1.0");
  });

  it("no diu res de qui no hi és, ni quan encara no s'ha ingerit la fitxa", () => {
    expect(trajectoriaDePersona(FITXA_J21, "Pere Coll")).toBe(null);
    expect(trajectoriaDePersona(null, "Marta Alarcón i Puerto")).toBe(null);
  });

  it("davant de dos noms iguals no atribueix la carrera a ningú", () => {
    const dos = { ...FITXA_J21, persones: [...FITXA_J21.persones, FITXA_J21.persones[0]!] };
    expect(trajectoriaDePersona(dos, "Marta Alarcón i Puerto")).toBe(null);
  });

  it("una fitxa sense càrrec, ni ofici, ni article no és cap dada", () => {
    const buida = {
      ...FITXA_J21,
      persones: [{ ...FITXA_J21.persones[0]!, carrecs: [], ocupacions: [], viquipedia: null }],
    };
    expect(trajectoriaDePersona(buida, "Marta Alarcón i Puerto")).toBe(null);
  });
});

describe("renderRegidor", () => {
  it("explica quan el vot es pot atribuir a la persona i quan no", () => {
    const html = renderRegidor(REGIDORA, CONTEXT, "2026-08-29");
    expect(html).toContain("tants vots com regidories té");
    expect(html).toContain("no es pot saber qui");
  });

  it("diu el càrrec de més amunt, amb les dates, i torna a la pàgina dels que manen", () => {
    const html = renderRegidor(
      REGIDORA,
      { ...CONTEXT, trajectoria: trajectoriaDePersona(FITXA_J21, REGIDORA.nom) },
      "2026-08-29",
    );
    expect(html).toContain("Més enllà de l'ajuntament");
    expect(html).toContain("diputada al Parlament de Catalunya");
    expect(html).toContain("1999–2003");
    expect(html).toContain('href="../../../../trajectoria/"');
  });

  it("cita la font i la llicència de Wikidata al costat de la dada", () => {
    const html = renderRegidor(
      REGIDORA,
      { ...CONTEXT, trajectoria: trajectoriaDePersona(FITXA_J21, REGIDORA.nom) },
      "2026-08-29",
    );
    expect(html).toContain("CC0 1.0");
    expect(html).toContain("Q11907");
    expect(html).toContain("advocada");
    expect(html).toContain("La seva pàgina a la Viquipèdia");
  });

  it("quan no en sabem res, el bloc no s'escriu: cap «no consta»", () => {
    const html = renderRegidor(REGIDORA, CONTEXT, "2026-08-29");
    expect(html).not.toContain("Més enllà de l'ajuntament");
  });

  it("quan les dates no lliguen amb el nostre historial, ho diu al costat", () => {
    const fluix = {
      ...FITXA_J21,
      persones: [{ ...FITXA_J21.persones[0]!, aparellat: false }],
    };
    const html = renderRegidor(
      REGIDORA,
      { ...CONTEXT, trajectoria: trajectoriaDePersona(fluix, REGIDORA.nom) },
      "2026-08-29",
    );
    expect(html).toContain("no lliguen del tot amb el nostre historial");
  });

  it("no publica cap dada de contacte", () => {
    const html = renderRegidor(
      { ...REGIDORA, nom: "Marta Alarcón" },
      CONTEXT,
      "2026-08-29",
    );
    expect(html).not.toMatch(/mailto:|@[a-z0-9.-]+\.(cat|com|es)\b|tel:/i);
  });

  it("quan no hi ha cap acta llegida ho diu, en comptes de deixar el bloc buit", () => {
    const html = renderRegidor(REGIDORA, { ...CONTEXT, votsDelGrup: [], actesLlegides: 0 }, "2026-08-29");
    expect(html).toContain("encara no hem pogut llegir cap acta");
  });

  /**
   * «cap acta no desglossa el vot per grup» afirmava una cosa de les actes que
   * no sabem: a Esplugues les actes sí que desglossen —les preguntes de prova
   * les citen— i era el nostre lector que no les sabia llegir. La frase parla
   * de la nostra lectura, no de les actes.
   */
  it("quan no sabem llegir cap vot, ho diu de la nostra lectura i no de les actes", () => {
    const html = renderRegidor(REGIDORA, { ...CONTEXT, votsDelGrup: [] }, "2026-08-29");
    expect(html).toContain("no n'hem sabut llegir cap vot desglossat per grup");
    expect(html).not.toContain("cap no desglossa el vot per grup");
  });

  it("i quan llegim vots d'altres grups, diu que no hem sabut reconèixer el seu", () => {
    const html = renderRegidor(
      REGIDORA,
      { ...CONTEXT, votsDelGrup: [], puntsAmbDesglos: 7 },
      "2026-08-29",
    );
    expect(html).toContain("no hem sabut reconèixer-hi");
    expect(html).not.toContain("no n'hem sabut llegir cap vot desglossat");
  });

  it("amb les actes indexades a la mà, parla com la fitxa del municipi", () => {
    const html = renderRegidor(
      REGIDORA,
      { ...CONTEXT, votsDelGrup: [], actesIndexades: 12 },
      "2026-08-29",
    );
    expect(html).toContain("les 12 actes indexades, totes llegides");
  });

  it("diu què va votar la persona quan tot el seu grup hi va votar igual", () => {
    const html = renderRegidor(REGIDORA, CONTEXT, "2026-08-29");
    expect(html).toContain("hi va votar en contra");
    expect(html).not.toContain("el seu grup hi va votar en contra");
  });

  it("i ho atribueix al grup quan el grup no hi va votar sencer", () => {
    // Menys vots que regidories vol dir que algú no hi era o va votar a part:
    // llavors no es pot dir què va fer aquesta persona en concret.
    const html = renderRegidor(REGIDORA, {
      ...CONTEXT,
      votsDelGrup: [{ ...CONTEXT.votsDelGrup[0]!, tot: false }],
    }, "2026-08-29");
    expect(html).toContain("el seu grup hi va votar en contra");
  });

  it("destaca les votacions decidides per un vot o dos", () => {
    const html = renderRegidor(REGIDORA, CONTEXT, "2026-08-29");
    expect(html).toContain("renyida");
    expect(html).toContain("per 1 vot");
  });

  it("no crida renyida una votació guanyada de llarg", () => {
    const html = renderRegidor(
      REGIDORA,
      { ...CONTEXT, votsDelGrup: [{ ...CONTEXT.votsDelGrup[0]!, marge: 14, favor: 20, contra: 6 }] },
      "2026-08-29",
    );
    expect(html).not.toContain('class="renyida"');
    expect(html).toContain("20 a favor");
  });

  it("diu a quants plens ha anat, i que una absència no és una falta", () => {
    const html = renderRegidor(REGIDORA, CONTEXT, "2026-08-29");
    expect(html).toContain("11 de 12");
    expect(html).toContain("Una absència no és una falta");
  });

  it("no ensenya l'assistència si tenim la llista de menys de cinc plens", () => {
    const html = renderRegidor(REGIDORA, { ...CONTEXT, assistencia: { hi: 3, de: 4 } }, "2026-08-29");
    expect(html).not.toContain("Quants plens ha fet");
  });

  it("posa inicials quan no hi ha fotografia, i no un buit", () => {
    const html = renderRegidor(REGIDORA, CONTEXT, "2026-08-29");
    expect(html).toContain("inicials-gran");
    expect(html).toContain(">MA<");
  });

  it("escapa el nom i no deixa injectar marques", () => {
    const html = renderRegidor({ ...REGIDORA, nom: 'Anna <img src=x> "Coll"' }, CONTEXT, "2026-08-29");
    // Dins del JSON-LD el nom va tal com és —allà «<img>» és text, no una
    // etiqueta, i l'únic que hi pot fer mal, «</script», l'escapa `seo.ts`—;
    // a la resta del document ha d'arribar escapat.
    const senseJsonLd = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, "");
    expect(senseJsonLd).not.toContain("<img src=x>");
    expect(senseJsonLd).toContain("&lt;img src=x&gt;");
  });

  it("el slug no arrossega accents ni signes", () => {
    expect(slugRegidor("Marta Alarcón i Puerto")).toBe("marta-alarcon-i-puerto");
  });
});

/**
 * Dues persones del mateix ple amb el mateix nom. `adrecesRegidors()` en
 * desambigua una amb un sufix, i el canònic de cadascuna ha de ser el seu:
 * si es tornés a calcular a partir del nom, la segona es declararia canònica
 * a l'adreça de la primera i el cercador es quedaria amb una de les dues.
 */
describe("el canònic no es recalcula: és l'adreça amb què s'ha escrit", () => {
  it("dues persones amb el mateix nom no comparteixen canònic", () => {
    const base = { ...CONTEXT };
    const una = renderRegidor(REGIDORA, { ...base, adreca: "marta-alarcon-pujol" }, "2026-08-29");
    const altra = renderRegidor(REGIDORA, { ...base, adreca: "marta-alarcon-pujol-2" }, "2026-08-29");
    expect(una).toContain('regidor/marta-alarcon-pujol/"');
    expect(altra).toContain('regidor/marta-alarcon-pujol-2/"');
    expect(altra).not.toContain('regidor/marta-alarcon-pujol/"');
  });
});

/**
 * `equipGovern` és un booleà i no té manera de dir «no consta». A onze
 * ajuntaments —Barcelona entre ells— la seu electrònica no marca ningú, i el
 * fals sortia escrit com «a l'oposició» a les 163 persones del ple. Vuit
 * d'aquells ajuntaments tenen l'alcaldia identificada: vuit alcaldes publicats
 * a l'oposició del seu propi govern.
 */
describe("qui és a l'equip de govern, i quan no se sap", () => {
  const alcalde = { ...REGIDORA, nom: "Jaume Collboni", carrec: "Alcalde", equipGovern: false };

  it("qui té l'alcaldia hi és per definició, encara que la font no ho marqui", () => {
    const html = renderRegidor(alcalde, { ...CONTEXT, governConegut: false }, "2026-08-29");
    expect(html).toContain('<span class="rg-estat rg-govern">A l\'equip de govern</span>');
    expect(html).not.toContain("rg-oposicio");
  });

  it("sense ningú marcat al ple, no es diu que estigui a l'oposició", () => {
    const html = renderRegidor(
      { ...REGIDORA, equipGovern: false },
      { ...CONTEXT, governConegut: false },
      "2026-08-29",
    );
    expect(html).not.toContain("a l'oposició");
    expect(html).not.toContain("rg-oposicio");
    expect(html).toContain('<span class="rg-estat rg-buit">La seu electrònica no diu qui és a l\'equip de govern</span>');
  });

  it("amb algú marcat, el fals dels altres sí que vol dir oposició", () => {
    const html = renderRegidor(
      { ...REGIDORA, equipGovern: false },
      { ...CONTEXT, governConegut: true },
      "2026-08-29",
    );
    expect(html).toContain('<span class="rg-estat rg-oposicio">A l\'oposició</span>');
  });

  it("una tinença d'alcaldia és a l'equip de govern pel càrrec, encara que la font no ho marqui", () => {
    const html = renderRegidor(
      { ...REGIDORA, carrec: "2a Tinenta d'Alcaldia", equipGovern: false },
      { ...CONTEXT, governConegut: true },
      "2026-08-29",
    );
    expect(html).toContain("rg-govern");
    expect(html).not.toContain("rg-oposicio");
    // I no porta l'etiqueta de l'alcaldia, que la paraula «alcald» enganyava.
    expect(html).not.toContain("rg-alcaldia");
  });
});

/**
 * Dues coses que es veien a la pàgina publicada de cada alcalde i que cap prova
 * no mirava: la preposició davant del nom del municipi i la pastilla del grup.
 */
describe("el que es llegeix a sobre de tot", () => {
  const alcalde = { ...REGIDORA, nom: "Eduard Sanz García", carrec: "Alcalde", sigles: "PSC-CP" };

  it("apostrofa el nom del municipi a totes les frases, no només a la primera", () => {
    const html = renderRegidor(alcalde, { ...CONTEXT, municipi: "Esplugues de Llobregat" }, "2026-08-30");
    expect(html).toContain("Alcalde d'Esplugues de Llobregat");
    expect(html).toContain("La fitxa d'Esplugues de Llobregat");
    // «de Esplugues» és el que escrivia abans, i no ha de tornar enlloc del cos.
    expect(html.slice(html.indexOf("<main"))).not.toContain("de Esplugues");
  });

  it("i respecta l'article quan el municipi en porta", () => {
    const html = renderRegidor(alcalde, { ...CONTEXT, municipi: "el Prat de Llobregat" }, "2026-08-30");
    expect(html).toContain("Alcalde del Prat de Llobregat");
  });

  it("qui té l'alcaldia ho porta escrit a la fila d'etiquetes, no només a la frase", () => {
    const html = renderRegidor(alcalde, CONTEXT, "2026-08-30");
    // Escrita com una frase, no en majúscules espaiades.
    expect(html).toContain('<span class="rg-estat rg-alcaldia">Alcaldia</span>');
    expect(html).not.toMatch(/\.rg-estat[^}]*text-transform:uppercase/);
    expect(renderRegidor({ ...REGIDORA, carrec: "Regidora" }, CONTEXT, "2026-08-30")).not.toContain(
      "rg-alcaldia",
    );
  });

  it("les sigles fan servir la pastilla compartida i no la classe del ple", () => {
    // `.grup` a l'estil compartit és la targeta desplegable d'un grup municipal:
    // reutilitzar-ne el nom aquí aixafava «PSC-CP» fins a 31px d'ample.
    const html = renderRegidor(alcalde, CONTEXT, "2026-08-30");
    // Ara la pastilla és un enllaç a la pàgina del partit: la classe és la
    // mateixa i el que canvia és que porta on ha de portar.
    expect(html).toMatch(/<a class="sigla" style="--c:[^"]*" href="\.\.\/\.\.\/\.\.\/\.\.\/partit\//);
    expect(html).not.toContain('<span class="grup"');
  });
});

/**
 * Els noms arriben de la font tal com els escriu cada ajuntament, i n'hi ha que
 * els escriuen tots en majúscules: «JUAN ANTONIO CORCHADO PONCE» era el titular
 * de la pàgina de l'alcalde de les Franqueses del Vallès.
 */
describe("el nom es publica com s'escriu un nom", () => {
  it("les majúscules de la font no arriben al titular", () => {
    const html = renderRegidor(
      { ...REGIDORA, nom: "JUAN ANTONIO CORCHADO PONCE" },
      CONTEXT,
      "2026-08-30",
    );
    expect(html).toContain("<h1>Juan Antonio Corchado Ponce</h1>");
    expect(html).not.toContain("JUAN ANTONIO CORCHADO PONCE");
  });

  it("i un nom ja ben escrit no es toca", () => {
    const html = renderRegidor({ ...REGIDORA, nom: "Marta Alarcón i Puerto" }, CONTEXT, "2026-08-30");
    expect(html).toContain("<h1>Marta Alarcón i Puerto</h1>");
  });
});

/**
 * El bloc «Què cobra».
 *
 * L'usuari ho ha demanat tres vegades i és la dada que la gent busca a la
 * pàgina d'un càrrec electe. També és on és més fàcil publicar una xifra
 * falsa: sumant dues fonts que no es poden sumar, o copiant la de la seu
 * electrònica —que només recull la part que paga l'ajuntament— com si fos el
 * sou. Cada prova d'aquí és una d'aquestes maneres d'equivocar-se.
 */
const SOU_BARCELONA = {
  anualBrut: 102_120,
  abast: "tot" as const,
  paga: "Ajuntament de Barcelona",
  dedicacio: "Dedicació exclusiva",
  any: 2024,
  font: {
    nom: "Ajuntament de Barcelona, retribucions dels càrrecs electes",
    url: "https://opendata-ajuntament.barcelona.cat/",
    llicencia: "CC BY 4.0",
  },
  avis: null,
};

describe("què cobra", () => {
  it("el bloc hi és encara que no en tinguem cap import: que no ho publiqui ningú també és una dada", () => {
    const html = renderRegidor(REGIDORA, CONTEXT, "2026-08-30");
    expect(html).toContain("<h2>Què cobra</h2>");
    expect(html).toContain("no en tenim cap import comprovat");
    expect(html).toContain("no vol dir que no en cobri");
  });

  it("no suma mai dos imports de fonts diferents", () => {
    const html = renderRegidor(
      REGIDORA,
      {
        ...CONTEXT,
        retribucio: { ...SOU_BARCELONA, anualBrut: 50_000, paga: "Ajuntament d'Esplugues de Llobregat" },
        altresCarrecs: [
          {
            ens: "Diputació de Barcelona",
            carrec: "Diputada",
            anualBrut: 20_000,
            concepte: "Retribució per dedicació parcial",
            dedicacio: null,
            motiuSenseImport: null,
            font: { nom: "Diputació de Barcelona", url: "https://www.diba.cat/" },
          },
        ],
      },
      "2026-08-30",
    );
    expect(html).toContain("50.000 €");
    expect(html).toContain("20.000 €");
    // 70.000 € no ho ha publicat ningú: seria una xifra nostra.
    expect(html).not.toContain("70.000");
    expect(html).toContain("No n'hi ha cap total");
    // I cada import va amb qui el paga al costat, no en una llista anònima.
    expect(html).toContain("Ajuntament d'Esplugues de Llobregat");
    expect(html).toContain("Diputació de Barcelona");
  });

  it("la xifra de la seu electrònica no s'anomena mai el que cobra, ni es compara amb res", () => {
    const html = renderRegidor(
      { ...REGIDORA, nom: "Ana María Martínez", carrec: "Alcaldessa" },
      {
        ...CONTEXT,
        municipi: "Rubí",
        retribucio: {
          ...SOU_BARCELONA,
          anualBrut: 17_027,
          abast: "nomes-ajuntament",
          paga: "Ajuntament de Rubí",
          font: { nom: "seu-e.cat", url: "https://seu-e.cat/", llicencia: null },
        },
      },
      "2026-08-30",
    );
    expect(html).toContain("no és el que cobra");
    expect(html).toContain("17.027 €");
    // Comparar-la amb el salari mínim seria tornar-la a presentar com un sou.
    expect(html).not.toContain("vegades el salari mínim");
    expect(html).not.toContain("del salari mínim del");
  });

  it("un import sencer sí que es diu en vegades el salari mínim del seu any", () => {
    const html = renderRegidor(REGIDORA, { ...CONTEXT, retribucio: SOU_BARCELONA }, "2026-08-30");
    expect(html).toContain("102.120 €");
    expect(html).toContain("6,4 vegades");
    expect(html).toContain("15.876 €");
    expect(html).toContain("del 2024");
  });

  it("i no es compara amb el salari mínim d'un altre any: sense any, sense comparació", () => {
    const html = renderRegidor(
      REGIDORA,
      { ...CONTEXT, retribucio: { ...SOU_BARCELONA, any: null } },
      "2026-08-30",
    );
    expect(html).toContain("102.120 €");
    expect(html).not.toContain("salari mínim");
  });

  it("un any que no hem comprovat al BOE deixa l'import sense comparació, no amb una d'inventada", () => {
    const html = renderRegidor(
      REGIDORA,
      { ...CONTEXT, retribucio: { ...SOU_BARCELONA, any: 2026 } },
      "2026-08-30",
    );
    expect(html).toContain("102.120 €");
    expect(html).not.toContain("salari mínim");
  });

  it("quan la font no en publica cap import, hi diu el motiu i no un buit", () => {
    const html = renderRegidor(
      REGIDORA,
      {
        ...CONTEXT,
        altresCarrecs: [
          {
            ens: "Consell Comarcal del Baix Llobregat",
            carrec: "Consellera comarcal",
            anualBrut: null,
            concepte: null,
            dedicacio: null,
            motiuSenseImport: "el consell comarcal no publica les retribucions dels seus consellers",
            font: { nom: "Consell Comarcal del Baix Llobregat", url: "https://www.elbaixllobregat.cat/" },
          },
        ],
      },
      "2026-08-30",
    );
    expect(html).toContain("no publica les retribucions dels seus consellers");
  });

  it("cita la llicència i enllaça la declaració de béns quan la font la dona", () => {
    const html = renderRegidor(
      REGIDORA,
      {
        ...CONTEXT,
        retribucio: { ...SOU_BARCELONA, declaracioBens: "https://example.org/bens.pdf" },
      },
      "2026-08-30",
    );
    expect(html).toContain("CC BY 4.0");
    expect(html).toContain("https://example.org/bens.pdf");
  });
});

/**
 * La resta de la fitxa: quant fa que hi seu, quants plens ha fet i de quants
 * punts en sabem el vot. A Esplugues eren quatre seccions i mitja pantalla en
 * blanc, i tot això ja era al context sense que ho llegís ningú.
 */
describe("el seu pas pel ple", () => {
  const MANDAT = { constitucio: "2023-06-17", nom: "2023-2027" };

  it("diu quant fa que hi seu, comptat des de la constitució del ple", () => {
    const html = renderRegidor(
      REGIDORA,
      { ...CONTEXT, mandat: MANDAT },
      "2026-08-30",
    );
    expect(html).toContain("3 anys i 2 mesos");
    expect(html).toContain("del 17 de juny del 2023");
  });

  it("a qui va entrar a mig mandat no li compta el mandat sencer", () => {
    const html = renderRegidor(
      { ...REGIDORA, entradaTardana: true },
      { ...CONTEXT, mandat: MANDAT },
      "2026-08-30",
    );
    expect(html).not.toContain("3 anys i 2 mesos");
    expect(html).toContain("sense la data no ens l'inventem");
  });

  it("i quan sí que en sabem el dia, el compta des d'aquell dia", () => {
    const html = renderRegidor(
      { ...REGIDORA, entradaTardana: true, desDe: "2025-06-30" },
      { ...CONTEXT, mandat: MANDAT },
      "2026-08-30",
    );
    expect(html).toContain("1 any i 2 mesos");
    expect(html).toContain("va prendre possessió");
  });

  it("compta els punts votats i els que es van decidir per no res", () => {
    const html = renderRegidor(REGIDORA, CONTEXT, "2026-08-30");
    expect(html).toContain("Punts votats");
    expect(html).toContain("Decidits per no res");
  });

  it("resumeix el sentit del vot dels punts on el grup hi va votar sencer", () => {
    const html = renderRegidor(REGIDORA, CONTEXT, "2026-08-30");
    expect(html).toContain("el vot queda determinat");
    expect(html).toContain("<b>1</b> en contra");
  });

  it("i no en fa cap resum quan de cap punt no se'n pot dir el vot de la persona", () => {
    const html = renderRegidor(
      REGIDORA,
      { ...CONTEXT, votsDelGrup: [{ ...CONTEXT.votsDelGrup[0]!, tot: false }] },
      "2026-08-30",
    );
    expect(html).not.toContain("el vot queda determinat");
  });

  it("sense cap acta amb llista d'assistents, ho diu en comptes de callar", () => {
    const html = renderRegidor(REGIDORA, { ...CONTEXT, assistencia: null }, "2026-08-30");
    expect(html).toContain("cap de les actes que hem llegit");
  });
});

/**
 * L'avís de la xifra parcial cita el cas de Rubí perquè és el que ho explica en
 * una frase. A la pàgina d'algú de Rubí, però, sonaria a que parlem d'una altra
 * persona quan parlaríem d'ella mateixa —i què cobra no ho sabem.
 */
describe("l'exemple que explica la xifra parcial", () => {
  const parcial = {
    anualBrut: 17_027,
    abast: "nomes-ajuntament" as const,
    paga: "Ajuntament de Rubí",
    dedicacio: null,
    any: null,
    font: { nom: "seu-e.cat", url: "https://seu-e.cat/", llicencia: null },
    avis: null,
  };

  it("se cita a la pàgina de qualsevol altre municipi", () => {
    const html = renderRegidor(REGIDORA, { ...CONTEXT, retribucio: parcial }, "2026-08-30");
    expect(html).toContain("A Rubí l'alcaldessa hi consta amb 17.027 €");
  });

  it("i no a la de Rubí, on l'avís es diu sense l'exemple", () => {
    const html = renderRegidor(
      REGIDORA,
      { ...CONTEXT, municipi: "Rubí", retribucio: parcial },
      "2026-08-30",
    );
    expect(html).toContain("no és el que cobra");
    expect(html).not.toContain("A Rubí l'alcaldessa hi consta");
  });
});

/**
 * La majoria de les 4.834 persones que seuen a un ple: cap sou publicat, cap
 * acta amb el vot desglossat, cap fitxa a Wikidata, cap llista d'assistents.
 * La pàgina els escrivia tres blocs que deien tots tres «no ho sabem», i ara
 * ho diu un sol cop —sense deixar de dir cap de les tres coses.
 */
describe("una persona de qui no sabem res", () => {
  const BUIT = { ...CONTEXT, votsDelGrup: [], actesLlegides: 0, assistencia: null };
  const h2 = (html: string): number => (html.match(/<h2>/g) ?? []).length;

  it("té un sol bloc en comptes de tres", () => {
    const buit = renderRegidor(REGIDORA, BUIT, "2026-08-30");
    const ple = renderRegidor(REGIDORA, CONTEXT, "2026-08-30");
    expect(buit).toContain("<h2>Què en sabem</h2>");
    expect(buit).not.toContain("<h2>Què cobra</h2>");
    expect(buit).not.toContain("<h2>El seu pas pel ple</h2>");
    expect(buit).not.toContain("<h2>Què ha votat</h2>");
    expect(h2(ple) - h2(buit)).toBe(2);
  });

  it("però cada absència continua dita amb el seu motiu", () => {
    const html = renderRegidor(REGIDORA, BUIT, "2026-08-30");
    expect(html).toContain("no vol dir que no en cobri");
    expect(html).toContain("encara no n'hem pogut llegir cap acta");
    expect(html).toContain("a quants plens ha anat");
    // I no es compta res sobre zero.
    expect(html).not.toContain("de 0 actes");
  });

  it("distingeix no haver llegit actes de no haver-ne sabut llegir el vot", () => {
    const html = renderRegidor(REGIDORA, { ...BUIT, actesLlegides: 12 }, "2026-08-30");
    expect(html).toContain("De 12 actes llegides");
    expect(html).toContain("no n'hem sabut llegir cap vot desglossat per grup");
    expect(html).toContain("Cap de les actes que hem llegit no porta la llista");
  });

  it("amb massa poques llistes d'assistents, diu quantes i per què no compta", () => {
    const html = renderRegidor(
      REGIDORA,
      { ...BUIT, actesLlegides: 12, assistencia: { hi: 3, de: 4 } },
      "2026-08-30",
    );
    expect(html).toContain("Només 4 actes porten");
    expect(html).not.toContain("3 de 4");
  });

  it("i porta quant fa que hi seu, que és l'única xifra que sí que tenim", () => {
    const html = renderRegidor(
      REGIDORA,
      { ...BUIT, mandat: { constitucio: "2023-06-17", nom: "2023-2027" } },
      "2026-08-30",
    );
    expect(html).toContain("Fa que hi seu");
    expect(html).toContain("3 anys i 2 mesos");
  });

  it("el que sí que publica el seu ajuntament s'hi continua dient", () => {
    const html = renderRegidor(
      REGIDORA,
      {
        ...BUIT,
        publicaDeLaPersona: {
          retribucio: "xifra", declaracioBens: true, dietes: false, indemnitzacions: false,
          altresRetribucions: false, fitxa: "https://seu-e.cat/fitxa",
          font: { nom: "seu-e.cat", url: "https://seu-e.cat/", consultat: "2026-08-30" },
        },
      },
      "2026-08-30",
    );
    expect(html).toContain("<h2>Què en publica el seu ajuntament</h2>");
    expect(html).toContain("només recull la part que paga ell mateix");
  });

  it("amb una sola dada de debò, tornen els tres blocs", () => {
    // Un sou publicat, cinc llistes d'assistents o una fitxa de Wikidata:
    // qualsevol és una dada, i llavors cada bloc té alguna cosa a dir i es diu
    // al seu lloc, amb les absències dels altres al costat.
    const ambSou = renderRegidor(REGIDORA, { ...BUIT, retribucio: SOU_BARCELONA }, "2026-08-30");
    expect(ambSou).toContain("<h2>Què cobra</h2>");
    expect(ambSou).not.toContain("<h2>Què en sabem</h2>");
    expect(
      renderRegidor(REGIDORA, { ...BUIT, assistencia: { hi: 5, de: 6 } }, "2026-08-30"),
    ).toContain("<h2>El seu pas pel ple</h2>");
    expect(
      renderRegidor(
        REGIDORA,
        { ...BUIT, trajectoria: trajectoriaDePersona(FITXA_J21, REGIDORA.nom) },
        "2026-08-30",
      ),
    ).toContain("<h2>Què ha votat</h2>");
  });

  it("una fitxa de la seu sense import no és no saber-ne res: té font i motiu", () => {
    const html = renderRegidor(
      REGIDORA,
      {
        ...BUIT,
        retribucio: { ...SOU_BARCELONA, anualBrut: null, motiuSenseImport: "la font no en dona cap import" },
      },
      "2026-08-30",
    );
    expect(html).toContain("<h2>Què cobra</h2>");
    expect(html).toContain("la font no en dona cap import");
  });
});

describe("quan la seu electrònica publica una xifra i cap pagador res", () => {
  const PUBLICA_XIFRA = {
    retribucio: "xifra" as const, declaracioBens: true, dietes: false, indemnitzacions: false,
    altresRetribucions: false, fitxa: "https://seu-e.cat/fitxa",
    font: { nom: "seu-e.cat", url: "https://seu-e.cat/", consultat: "2026-08-30" },
  };

  /**
   * Obrir amb «no en tenim cap import» mentre el bloc del costat marcava
   * «✓ La retribució del càrrec, amb import» es llegia com un error de la
   * pàgina. La xifra existeix i es diu primer; reproduir-la, no.
   */
  it("el bloc anomena la xifra primer i diu per què no la reproduïm", () => {
    const html = renderRegidor(
      REGIDORA,
      { ...CONTEXT, publicaDeLaPersona: PUBLICA_XIFRA },
      "2026-08-30",
    );
    expect(html).toContain("en publica una xifra</b> a la seu electrònica");
    expect(html).toContain("no és el que cobra");
    expect(html).toContain("La xifra, a la seva fitxa de la seu electrònica");
    expect(html).not.toContain("no en tenim cap import comprovat");
  });
});

describe("«Què en publica el seu ajuntament» només quan la fitxa s'ha llegit", () => {
  const PUBLICA = {
    retribucio: "cap" as const, declaracioBens: true, dietes: false, indemnitzacions: false,
    altresRetribucions: false, fitxa: "https://seu-e.cat/fitxa",
    font: { nom: "seu-e.cat", url: "https://seu-e.cat/", consultat: "2026-08-30" },
  };

  it("amb la fitxa llegida, el bloc hi és i enllaça la fitxa oficial", () => {
    const html = renderRegidor(REGIDORA, { ...CONTEXT, publicaDeLaPersona: PUBLICA }, "2026-08-30");
    expect(html).toContain("<h2>Què en publica el seu ajuntament</h2>");
    expect(html).toContain("La seva fitxa a la seu electrònica");
  });

  /**
   * Cinc creus sota una fitxa que no s'ha pogut llegir es llegien com «no
   * publica res», que és una afirmació que no podem fer, i la nota que ho
   * matisava no desfeia la primera impressió: l'usuari va demanar treure-ho.
   * Quan no hem llegit res, no es diu res.
   */
  it("sense mètrica de la seu no hi ha bloc: ni creus ni disculpes", () => {
    const html = renderRegidor(REGIDORA, CONTEXT, "2026-08-30");
    expect(html).not.toContain("Què en publica el seu ajuntament");
  });

  it("amb la fitxa no llegida (retribució nul·la), tampoc", () => {
    const html = renderRegidor(
      REGIDORA,
      { ...CONTEXT, publicaDeLaPersona: { ...PUBLICA, retribucio: null, fitxa: null } },
      "2026-08-30",
    );
    expect(html).not.toContain("Què en publica el seu ajuntament");
    expect(html).not.toContain("no en podem dir ni que publiqui");
  });
});

describe("les llistes on ha anat", () => {
  const LLISTES: NonNullable<ContextRegidor["llistes"]> = [
    { any: 2015, sigles: "ERC-AM", posicio: 8, capDeLlista: false, elegit: false },
    { any: 2019, sigles: "ERC-AM", posicio: 4, capDeLlista: false, elegit: true },
    { any: 2023, sigles: "ERC-AM", posicio: 2, capDeLlista: false, elegit: true },
  ];

  it("una línia amb cada anada: any, número, llista i si en va sortir", () => {
    const html = renderRegidor(REGIDORA, { ...CONTEXT, llistes: LLISTES }, "2026-08-30");
    expect(html).toContain("Les llistes on ha anat");
    expect(html).toContain("<b>2015</b>: núm. 8 amb ERC-AM (no elegida)");
    // Les sigles no es repeteixen quan no canvien: ja se sap amb qui anava.
    expect(html).toContain("<b>2019</b>: núm. 4 (elegida)");
    expect(html).toContain("<b>2023</b>: núm. 2 (elegida)");
  });

  it("les sigles tornen a dir-se quan canvien, i el cap de llista es diu pel nom", () => {
    const html = renderRegidor(
      REGIDORA,
      {
        ...CONTEXT,
        llistes: [
          { any: 2019, sigles: "CUP", posicio: 3, capDeLlista: false, elegit: false },
          { any: 2023, sigles: "ERC-AM", posicio: 1, capDeLlista: true, elegit: true },
        ],
      },
      "2026-08-30",
    );
    expect(html).toContain("<b>2019</b>: núm. 3 amb CUP (no elegida)");
    expect(html).toContain("<b>2023</b>: cap de llista amb ERC-AM (elegida)");
  });

  it("sense historial no hi ha línia", () => {
    expect(renderRegidor(REGIDORA, CONTEXT, "2026-08-30")).not.toContain("Les llistes on ha anat");
  });

  it("la cronologia diu el número quan el sabem, i quan no, cap «?» ni «núm. 0»", () => {
    const html = renderRegidor(
      REGIDORA,
      {
        ...CONTEXT,
        llistes: [
          { any: 2015, sigles: "CUP", posicio: null, capDeLlista: false, elegit: false },
          { any: 2019, sigles: "ERC-AM", posicio: 4, capDeLlista: false, elegit: true },
          { any: 2023, sigles: "ERC-AM", posicio: 1, capDeLlista: true, elegit: true },
        ],
      },
      "2026-08-30",
    );
    expect(html).toContain("Va anar a la llista CUP i no en va sortir elegit.");
    expect(html).toContain("Va anar de número 4 a la llista ERC-AM i en va sortir elegit.");
    expect(html).toContain("Va encapçalar la llista ERC-AM i en va sortir elegit.");
    expect(html).not.toMatch(/número \?|número 0|núm\. 0/);
  });
});

describe("les tipografies de la marca", () => {
  it("s'enllacen des de la profunditat d'aquesta pàgina, abans de l'estil", () => {
    // Som a /observatori/m/<municipi>/regidor/<nom>/: cinc nivells amunt.
    const html = renderRegidor(REGIDORA, CONTEXT, "2026-08-30");
    expect(html).toContain('href="../../../../../assets/fonts.css"');
    expect(html.indexOf("fonts.css")).toBeLessThan(html.indexOf("<style>"));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// El cap de llista, el perfil de Wikidata (J27), els sous de cada pagador,
// la font dels vots i la frase dels mandats.
// ─────────────────────────────────────────────────────────────────────────────

const CAP: NonNullable<ContextRegidor["capDeLlista"]> = {
  es: true,
  posicio: 1,
  sigles: "ERC-AM",
  vots: 9_000,
  regidories: 5,
  forca: 2,
  forces: 6,
  vaGuanyar: false,
  teAlcaldia: false,
};

describe("cap de llista", () => {
  it("porta la pastilla i el bloc amb les xifres de la seva llista", () => {
    const html = renderRegidor(
      { ...REGIDORA, posicioLlista: 1 },
      { ...CONTEXT, capDeLlista: CAP },
      "2026-08-30",
    );
    expect(html).toContain('<span class="rg-estat rg-cap-llista">Cap de llista el 2023</span>');
    expect(html).toContain("<h2>Com a cap de llista</h2>");
    expect(html).toContain("9.000 vots");
    expect(html).toContain("5 regidories");
    expect(html).toContain("segona força");
    expect(html).toContain("No va aconseguir l'alcaldia");
    // «Cap de llista» ja diu el número u: no es diu dues vegades.
    expect(html).not.toContain("Número 1 de la llista");
    // I torna a la pàgina de la seva candidatura.
    expect(html).toContain('href="../../erc-am/"');
  });

  it("qui no encapçalava només porta el número, sense bloc", () => {
    const html = renderRegidor(
      { ...REGIDORA, posicioLlista: 2 },
      { ...CONTEXT, capDeLlista: { ...CAP, es: false, posicio: 2 } },
      "2026-08-30",
    );
    expect(html).toContain('<span class="rg-estat rg-numero">Número 2 de la llista</span>');
    expect(html).not.toContain("Com a cap de llista");
  });

  it("l'alcaldia es diu segons qui la té, i quan no se sap no es diu res", () => {
    const alcaldessa = renderRegidor(
      { ...REGIDORA, carrec: "Alcaldessa" },
      { ...CONTEXT, capDeLlista: { ...CAP, teAlcaldia: true } },
      "2026-08-30",
    );
    expect(alcaldessa).toContain("I té l'alcaldia");
    // La llista la té, però l'ocupa algú altre: passa quan el cap de llista
    // cedeix l'alcaldia o quan qui la té va entrar més avall de la llista.
    const cedida = renderRegidor(REGIDORA, { ...CONTEXT, capDeLlista: { ...CAP, teAlcaldia: true } }, "2026-08-30");
    expect(cedida).toContain("l'ocupa una altra persona");
    const guanyada = renderRegidor(
      REGIDORA,
      { ...CONTEXT, capDeLlista: { ...CAP, vaGuanyar: true, forca: 1 } },
      "2026-08-30",
    );
    expect(guanyada).toContain("Va guanyar les eleccions i no té l'alcaldia");
    const desconeguda = renderRegidor(
      REGIDORA,
      { ...CONTEXT, capDeLlista: { ...CAP, teAlcaldia: null } },
      "2026-08-30",
    );
    expect(desconeguda).toContain("<h2>Com a cap de llista</h2>");
    expect(desconeguda).not.toContain("té l'alcaldia");
    expect(desconeguda).not.toContain("aconseguir l'alcaldia");
  });

  it("una tinència d'alcaldia no és l'alcaldia: la seva frase és la de la llista", () => {
    const html = renderRegidor(
      { ...REGIDORA, carrec: "1a Tinent d'Alcalde" },
      { ...CONTEXT, capDeLlista: { ...CAP, teAlcaldia: false } },
      "2026-08-30",
    );
    expect(html).not.toContain("I té l'alcaldia");
    expect(html).toContain("No va aconseguir l'alcaldia");
  });
});

const FITXA_J27 = {
  font: "Wikidata (wikidata.org)",
  url: "https://query.wikidata.org/sparql",
  llicenciaDades: "CC0 1.0",
  consultat: "2026-08-30",
  ine5: "08077",
  eleccio: "M20231",
  buscats: 2,
  capsDeLlista: 1,
  trobats: 1,
  persones: [
    {
      nom: "Marta Alarcon Puerto",
      normalitzat: "marta alarcon puerto",
      sigles: "ERC-AM",
      capDeLlista: false,
      qid: "Q42",
      url: "https://www.wikidata.org/wiki/Q42",
      etiqueta: "Marta Alarcón i Puerto",
      naixement: 1985,
      ocupacio: ["periodista"],
      partit: "Esquerra Republicana de Catalunya",
      carrecs: [
        { qid: "Q600", nom: "diputada al Parlament de Catalunya", inici: "2017-12-21", fi: "2021-03-12", alMunicipi: false },
      ],
      article: { ca: "https://ca.wikipedia.org/wiki/Marta_Alarc%C3%B3n", es: null },
      motiu: "carrec-al-municipi" as const,
    },
  ],
  descartats: [],
};

describe("qui és, segons Wikidata (J27)", () => {
  it("quiEsDeWikidata troba la persona pel nom normalitzat i no confon homònims", () => {
    const t = quiEsDeWikidata(FITXA_J27, "MARTA ALARCÓN I PUERTO");
    expect(t?.qid).toBe("Q42");
    expect(t?.origen).toBe("caps-de-llista");
    expect(t?.naixement).toBe(1985);
    expect(quiEsDeWikidata(FITXA_J27, "Pere Coll")).toBe(null);
    expect(quiEsDeWikidata(null, "Marta Alarcon Puerto")).toBe(null);
    const dos = { ...FITXA_J27, persones: [...FITXA_J27.persones, FITXA_J27.persones[0]!] };
    expect(quiEsDeWikidata(dos, "Marta Alarcon Puerto")).toBe(null);
  });

  it("el bloc «Qui és» diu l'any, l'ofici, el partit, els càrrecs i el perquè del lligam", () => {
    const html = renderRegidor(
      REGIDORA,
      { ...CONTEXT, trajectoria: quiEsDeWikidata(FITXA_J27, "Marta Alarcon Puerto") },
      "2026-08-30",
    );
    expect(html).toContain("<h2>Qui és</h2>");
    expect(html).toContain("1985");
    expect(html).toContain("periodista");
    expect(html).toContain("Esquerra Republicana de Catalunya");
    expect(html).toContain("diputada al Parlament de Catalunya");
    expect(html).toContain("CC0 1.0");
    expect(html).toContain("càrrec en aquest mateix municipi");
    // El bloc dels alcaldes de J21 és un altre i no s'ha de barrejar.
    expect(html).not.toContain("Més enllà de l'ajuntament");
  });

  it("una fitxa de J27 sense res a dir no escriu cap bloc", () => {
    const buida = {
      ...FITXA_J27,
      persones: [{
        ...FITXA_J27.persones[0]!,
        naixement: null, ocupacio: [], partit: null, carrecs: [], article: { ca: null, es: null },
      }],
    };
    expect(quiEsDeWikidata(buida, "Marta Alarcon Puerto")).toBe(null);
  });
});

describe("el sou que publica el pagador, amb la data i el zero dits com toca", () => {
  it("la targeta porta la llicència i el dia que la font es va consultar", () => {
    const html = renderRegidor(
      REGIDORA,
      {
        ...CONTEXT,
        retribucio: { ...SOU_BARCELONA, any: null, font: { ...SOU_BARCELONA.font, consultat: "2026-08-30" } },
      },
      "2026-08-30",
    );
    expect(html).toContain("CC BY 4.0");
    expect(html).toContain("consultat el 30 d'agost del 2026");
  });

  it("un zero publicat és qui paga dient que no paga res, amb l'explicació de la font al costat", () => {
    const html = renderRegidor(
      REGIDORA,
      {
        ...CONTEXT,
        retribucio: {
          ...SOU_BARCELONA, anualBrut: 0, any: null,
          avis: "Percep les retribucions com a diputada al Parlament de Catalunya.",
        },
      },
      "2026-08-30",
    );
    expect(html).toContain("0 €");
    expect(html).toContain("declara que no li paga res");
    expect(html).toContain("Percep les retribucions com a diputada");
    expect(html).not.toContain("salari mínim");
  });
});

describe("el que l'alcaldia declara al Ministeri", () => {
  const MINISTERI: NonNullable<ContextRegidor["alcaldiaSegonsMinisteri"]> = {
    any: 2024,
    euros: 104_000,
    regim: "Exclusiva",
    mena: "sou",
    canviDAlcaldia: false,
    font: {
      nom: "Inventari de retribucions dels membres de les corporacions locals (ISPA 2025)",
      organisme: "Ministeri per a la Transformació Digital i de la Funció Pública",
      url: "https://digital.gob.es/",
      llicencia: "Avís legal del portal del Ministeri (reutilització segons la Llei 37/2007). No és Creative Commons.",
      consultat: "2026-08-30",
    },
    avis: null,
  };

  it("un sou de debò es compara amb el salari mínim del seu any", () => {
    const html = renderRegidor(
      { ...REGIDORA, carrec: "Alcaldessa" },
      { ...CONTEXT, alcaldiaSegonsMinisteri: MINISTERI },
      "2026-08-30",
    );
    expect(html).toContain("104.000 €");
    expect(html).toContain("vegades</b> el salari mínim");
    expect(html).toContain("Ministeri");
  });

  it("les assistències no són un sou i no es comparen amb res", () => {
    const html = renderRegidor(
      { ...REGIDORA, carrec: "Alcalde" },
      {
        ...CONTEXT,
        alcaldiaSegonsMinisteri: { ...MINISTERI, euros: 180, mena: "assistencies", regim: "Sin dedicación" },
      },
      "2026-08-30",
    );
    expect(html).toContain("180 €");
    expect(html).toContain("assistències");
    expect(html).not.toContain("salari mínim");
  });

  it("qui no cobra res ho té dit, i un any amb canvi d'alcaldia no s'atribueix a ningú", () => {
    const cap = renderRegidor(
      { ...REGIDORA, carrec: "Alcalde" },
      { ...CONTEXT, alcaldiaSegonsMinisteri: { ...MINISTERI, mena: "cap", euros: 0 } },
      "2026-08-30",
    );
    expect(cap).toContain("no cobra res de l'ajuntament");
    const canvi = renderRegidor(
      { ...REGIDORA, carrec: "Alcalde" },
      { ...CONTEXT, alcaldiaSegonsMinisteri: { ...MINISTERI, canviDAlcaldia: true } },
      "2026-08-30",
    );
    expect(canvi).toContain("ha canviat de mans");
    expect(canvi).not.toContain("104.000 €");
  });
});

describe("la font dels vots", () => {
  const FONT_BCN = {
    nom: "Votacions del Plenari del Consell Municipal, Ajuntament de Barcelona",
    url: "https://ajuntament.barcelona.cat/ca/organitzacio-municipal/consell-municipal",
    llicencia: "Avís legal de l'Ajuntament de Barcelona",
    llicenciaUrl: "https://ajuntament.barcelona.cat/ca/avis-legal",
    consultat: "2026-08-30",
  };

  it("se cita al peu de la llista amb la llicència que la font declara, no una de suposada", () => {
    const html = renderRegidor(REGIDORA, { ...CONTEXT, fontVots: FONT_BCN }, "2026-08-30");
    expect(html).toContain("Font dels vots");
    expect(html).toContain("Votacions del Plenari");
    expect(html).toContain("Avís legal de l'Ajuntament de Barcelona");
    expect(html).not.toContain("CC BY");
  });

  it("i sense cap vot a la llista no s'escriu, que citaria una font que no s'usa", () => {
    const html = renderRegidor(REGIDORA, { ...CONTEXT, votsDelGrup: [], fontVots: FONT_BCN }, "2026-08-30");
    expect(html).not.toContain("Font dels vots");
  });
});

describe("la frase dels mandats", () => {
  const TRES: NonNullable<ContextRegidor["mandats"]> = {
    anys: [2015, 2019, 2023],
    primer: 2015,
    quants: 3,
    seguits: true,
    iniciConegut: false,
    cobertesDesDe: 2015,
    llistesSenseEntrar: [],
  };

  it("tercer mandat seguit, dit amb la cobertura del registre i no com un inici", () => {
    const html = renderRegidor(REGIDORA, { ...CONTEXT, mandats: TRES }, "2026-08-30");
    expect(html).toContain("tercer mandat");
    expect(html).toContain("Al ple des del <b>2015</b>");
    expect(html).toContain("fins on arriba el registre");
  });

  /**
   * La font dels mandats són les candidatures amb «electe», que no veuen les
   * substitucions de mandats passats: per això la frase diu «elegida per
   * primera vegada» —que la font aguanta— i no «primer mandat», que podria
   * ser fals si havia segut abans per substitució.
   */
  it("la primera elecció s'afirma com a elecció, dins del que el registre cobreix", () => {
    const html = renderRegidor(
      REGIDORA,
      {
        ...CONTEXT,
        mandats: {
          anys: [2023], primer: 2023, quants: 1, seguits: true, iniciConegut: true,
          cobertesDesDe: 2015, llistesSenseEntrar: [2015, 2019],
        },
      },
      "2026-08-30",
    );
    expect(html).toContain("per primera vegada");
    expect(html).toContain("cobreix des del 2015");
    // De les llistes on no va sortir només es diu això: «sense entrar al ple»
    // seria afirmar que no hi va entrar mai, i una substitució ho desmentiria.
    expect(html).toContain("els anys 2015 i 2019 sense sortir-ne elegida");
    expect(html).not.toContain("primer mandat");
  });

  it("amb un forat no es diu cap ordinal: es diuen les municipals que l'han elegida", () => {
    const html = renderRegidor(
      REGIDORA,
      { ...CONTEXT, mandats: { ...TRES, anys: [2015, 2023], quants: 2, seguits: false, iniciConegut: false } },
      "2026-08-30",
    );
    expect(html).toContain("Elegida a les municipals del <b>2015</b> i del <b>2023</b>");
    expect(html).not.toContain("seguit");
    expect(html).not.toContain("segon mandat");
  });

  it("sense historial no s'escriu res, i la frase també surt a la pàgina de qui no en sabem res", () => {
    expect(renderRegidor(REGIDORA, CONTEXT, "2026-08-30")).not.toContain('class="mandats"');
    const html = renderRegidor(
      REGIDORA,
      { ...CONTEXT, votsDelGrup: [], assistencia: null, mandats: TRES },
      "2026-08-30",
    );
    expect(html).toContain("<h2>Què en sabem</h2>");
    expect(html).toContain("tercer mandat");
  });
});

/**
 * La primera frase de la fitxa de l'alcaldessa de Sabadell deia «Alcaldessa de
 * Sabadell de Sabadell»: la seu electrònica ja escriu el municipi dins del
 * càrrec i la pàgina l'hi tornava a afegir. No és cosa de les alcaldies —qualsevol
 * càrrec escrit amb el municipi hi cau— i l'arranjament tampoc no ho és.
 */
describe("el càrrec no diu el municipi dues vegades", () => {
  it("quan el càrrec ja porta el municipi, es deixa tal com ve", () => {
    expect(carrecAmbMunicipi("Alcaldessa de Sabadell", "Sabadell")).toBe("Alcaldessa de Sabadell");
    expect(carrecAmbMunicipi("Regidora de l'Ajuntament de Terrassa", "Terrassa")).toBe(
      "Regidora de l'Ajuntament de Terrassa",
    );
    // Sense accents ni majúscules: les fonts no els posen igual.
    expect(carrecAmbMunicipi("ALCALDE DE SANT CUGAT DEL VALLES", "Sant Cugat del Vallès")).toBe(
      "ALCALDE DE SANT CUGAT DEL VALLES",
    );
    // L'article del municipi no és el que decideix si hi és.
    expect(carrecAmbMunicipi("Alcalde del Prat de Llobregat", "el Prat de Llobregat")).toBe(
      "Alcalde del Prat de Llobregat",
    );
  });

  it("i quan no el porta, s'hi afegeix amb la preposició ben contreta", () => {
    expect(carrecAmbMunicipi("Alcalde", "Esplugues de Llobregat")).toBe("Alcalde d'Esplugues de Llobregat");
    expect(carrecAmbMunicipi("Regidora", "el Prat de Llobregat")).toBe("Regidora del Prat de Llobregat");
    // Un municipi que només coincideix a mitges no compta com a dit.
    expect(carrecAmbMunicipi("Regidor de Sant Cugat Sesgarrigues", "Sant Cugat del Vallès")).toBe(
      "Regidor de Sant Cugat Sesgarrigues de Sant Cugat del Vallès",
    );
  });

  it("a la pàgina sencera: ni a la frase d'entrada ni a la descripció", () => {
    const html = renderRegidor(
      { ...REGIDORA, nom: "Marta Farrés Falgueras", carrec: "Alcaldessa de Sabadell", sigles: "PSC-CP" },
      { ...CONTEXT, municipi: "Sabadell", slug: "sabadell" },
      "2026-08-30",
    );
    expect(html).not.toContain("de Sabadell de Sabadell");
    expect(html).toContain("Alcaldessa de Sabadell, pel grup");
  });
});

describe("els enllaços entre pàgines", () => {
  it("el nom del grup porta al bloc «Qui seu al ple» de la fitxa municipal", () => {
    const html = renderRegidor(REGIDORA, CONTEXT, "2026-08-30");
    expect(html).toContain(
      'pel grup <a class="grup-enllac" href="../../#regidors"><b>Grup Municipal Republicà (GMR)</b></a>',
    );
  });

  it("i sense grup no hi ha cap enllaç buit", () => {
    const html = renderRegidor({ ...REGIDORA, grup: null }, CONTEXT, "2026-08-30");
    expect(html).not.toContain("pel grup");
    expect(html).not.toContain("#regidors");
  });

  it("les sigles porten a la pàgina del partit, quatre nivells amunt", () => {
    const html = renderRegidor(REGIDORA, CONTEXT, "2026-08-30");
    expect(html).toContain('href="../../../../partit/erc/"');
  });

  it("el peu enllaça el partit a tot Catalunya i la comarca, quan els sabem", () => {
    const html = renderRegidor(REGIDORA, { ...CONTEXT, comarca: "Baix Llobregat" }, "2026-08-30");
    expect(html).toContain('<a href="../../../../partit/erc/"><b>Esquerra Republicana de Catalunya a tot Catalunya</b>');
    expect(html).toContain('<a href="../../../../c/baix-llobregat/"><b>Baix Llobregat</b>');
  });

  it("una llista local no té pàgina de partit i no s'hi enllaça; sense comarca, tampoc", () => {
    // «-AM» al final ja resoldria a ERC (és la regla de `siglesFamily`): la
    // llista local de debò és la que no porta cap sufix de partit.
    const html = renderRegidor({ ...REGIDORA, sigles: "IxE" }, CONTEXT, "2026-08-30");
    // Es mira la llista de destins i no la pàgina sencera: el peu comú ja
    // enllaça les comarques, i això no és el que es comprova aquí.
    const destins = html.slice(html.indexOf('<ul class="destins">'), html.indexOf("</ul>", html.indexOf('<ul class="destins">')));
    expect(destins).not.toContain("a tot Catalunya</b>");
    expect(destins).not.toContain('href="../../../../c/');
  });

  it("la pastilla del càrrec supramunicipal porta al bloc on es detalla", () => {
    const html = renderRegidor(
      REGIDORA,
      {
        ...CONTEXT,
        altresCarrecs: [
          { ens: "Diputació de Barcelona", carrec: "Diputada", anualBrut: null, concepte: null, dedicacio: null, motiuSenseImport: "no ho publica", font: null },
        ],
      },
      "2026-08-30",
    );
    // És navegació: un enllaç a la línia de sota les etiquetes, no una pastilla més.
    expect(html).toContain('<p class="rg-tambe"><a class="segon-carrec" href="#que-cobra">També té un càrrec supramunicipal</a></p>');
    expect(html).toContain('id="que-cobra"');
  });
});

describe("al mateix grup", () => {
  const companys = [
    { nom: "Marta Alarcón i Puerto", foto: null, adreca: "marta-alarcon-pujol", carrec: "Regidora" },
    { nom: "Pere Coll Vidal", foto: "/observatori/fotos/160/1.webp", adreca: "pere-coll-vidal", carrec: "Regidor" },
    { nom: "ANNA RIBAS SOLÀ", foto: null, adreca: "anna-ribas-sola", carrec: "Regidora" },
  ];

  it("ensenya les altres persones del grup, amb cara i enllaç a la seva fitxa", () => {
    const html = renderRegidor(REGIDORA, { ...CONTEXT, companys }, "2026-08-30");
    expect(html).toContain('id="mateix-grup"');
    expect(html).toContain("Les altres <b>2</b> persones del grup");
    expect(html).toContain('<a href="../pere-coll-vidal/" title="Pere Coll Vidal">');
    expect(html).toContain('<a href="../anna-ribas-sola/" title="Anna Ribas Solà">');
    // La cara compartida, a 40 px: foto per a qui en té, inicials per a qui no.
    expect(html).toContain('src="/observatori/fotos/160/1.webp" alt="" width="40" height="40"');
    expect(html).toMatch(/cara-alcaldia inicials petita" style="--mida:40px;[^"]*" aria-hidden="true">AR</);
    // A la vista, el nom curt i escrit com un nom; el sencer, al title.
    expect(html).toContain('<span class="rg-nom">Anna Ribas</span>');
    expect(html).toContain('<span class="rg-nom">Pere Coll</span>');
    // I el bloc entra a la navegació de la fitxa.
    expect(html).toContain('<a href="#mateix-grup">Al mateix grup</a>');
  });

  it("no s'hi inclou la persona mateixa", () => {
    const html = renderRegidor(REGIDORA, { ...CONTEXT, companys }, "2026-08-30");
    const bloc = html.slice(html.indexOf('id="mateix-grup"'), html.indexOf("</section>", html.indexOf('id="mateix-grup"')));
    expect(bloc).not.toContain('href="../marta-alarcon-pujol/"');
  });

  it("les inicials van amb el color del grup", () => {
    const html = renderRegidor(REGIDORA, { ...CONTEXT, companys }, "2026-08-30");
    const bloc = html.slice(html.indexOf('id="mateix-grup"'));
    // #ffb232 és el color d'ERC del fixture; `sobreColor()` el pot ajustar,
    // però la variable hi ha de ser i no el gris de «no sabem de qui és».
    expect(bloc).toMatch(/--mida:40px;--c:#[0-9a-f]{6};--t:#[0-9a-f]{6}/i);
    expect(bloc).not.toContain("--c:#9a9a9a");
  });

  it("mentre la foto carrega es veuen les inicials, no un cercle buit", () => {
    const html = renderRegidor(REGIDORA, { ...CONTEXT, companys }, "2026-08-30");
    // Qui té foto porta les dues capes de `cara()`: les inicials a sota i la foto a sobre.
    expect(html).toMatch(
      /<span class="rg-cara"><span class="cara-alcaldia inicials petita"[^>]*>PC<\/span><img class="cara-alcaldia petita"[^>]*src="\/observatori\/fotos\/160\/1\.webp"[^>]*loading="lazy"><\/span>/,
    );
    // I la foto no porta el fons de paper que tapava les inicials.
    expect(html).toContain(".rg-cara img.cara-alcaldia{background:transparent}");
  });

  it("el càrrec només surt a la vista quan és l'alcaldia o una tinença", () => {
    const html = renderRegidor(
      REGIDORA,
      {
        ...CONTEXT,
        companys: [
          { nom: "Albert Batlle Bastardas", foto: null, adreca: "albert-batlle", carrec: "Regidor del Districte" },
          { nom: "Laia Bonet Rull", foto: null, adreca: "laia-bonet", carrec: "Primera Tinenta d'Alcaldia" },
          { nom: "Jaume Collboni Cuadrado", foto: null, adreca: "jaume-collboni", carrec: "Alcalde" },
        ],
      },
      "2026-08-30",
    );
    const bloc = html.slice(html.indexOf('id="mateix-grup"'), html.indexOf("</section>", html.indexOf('id="mateix-grup"')));
    expect(bloc).not.toContain("Regidor del Districte");
    expect(bloc).toContain('<span class="rg-nom">Laia Bonet</span><span class="rg-carrec">1a tinença</span>');
    expect(bloc).toContain('<span class="rg-nom">Jaume Collboni</span><span class="rg-carrec">Alcaldia</span>');
  });

  it("dues persones amb el mateix nom curt porten el nom sencer", () => {
    const html = renderRegidor(
      REGIDORA,
      {
        ...CONTEXT,
        companys: [
          { nom: "Joan Puig Serra", foto: null, adreca: "joan-puig-serra", carrec: "Regidor" },
          { nom: "Joan Puig Vila", foto: null, adreca: "joan-puig-vila", carrec: "Regidor" },
        ],
      },
      "2026-08-30",
    );
    expect(html).toContain('<span class="rg-nom">Joan Puig Serra</span>');
    expect(html).toContain('<span class="rg-nom">Joan Puig Vila</span>');
  });

  it("si al grup només hi seu ella, el bloc no s'escriu", () => {
    const sola = renderRegidor(REGIDORA, { ...CONTEXT, companys: [companys[0]!] }, "2026-08-30");
    expect(sola).not.toContain('id="mateix-grup"');
    expect(sola).not.toContain("Al mateix grup");
    // I quan no arriba la llista, tampoc: cap «no té companys».
    expect(renderRegidor(REGIDORA, CONTEXT, "2026-08-30")).not.toContain("mateix-grup");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// El cap SEO: el títol, la descripció i les dades estructurades de la persona.
// ─────────────────────────────────────────────────────────────────────────────

/** El cap de la pàgina, sense el cos: el que llegeixen el cercador i les xarxes. */
const cap = (html: string): string => html.slice(0, html.indexOf("</head>"));
const titolDe = (html: string): string => /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? "";
const descripcioDe = (html: string): string =>
  /<meta name="description" content="([^"]*)">/.exec(html)?.[1] ?? "";
const jsonLdDe = (html: string): Record<string, unknown>[] =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
    (m) => JSON.parse(m[1]!) as Record<string, unknown>,
  );
const nivellsDe = (html: string): number[] =>
  [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));

describe("el títol de la persona", () => {
  it("«nom, càrrec de municipi», amb la marca si hi cap", () => {
    const html = renderRegidor(
      { ...REGIDORA, nom: "Marta Farrés Falgueras", carrec: "Alcaldessa", sigles: "PSC-CP" },
      { ...CONTEXT, municipi: "Sabadell", slug: "sabadell" },
      "2026-08-30",
    );
    expect(titolDe(html)).toBe("Marta Farrés Falgueras, alcaldessa de Sabadell · quivoto");
  });

  it("quan la marca no hi cap, val més el càrrec que la marca", () => {
    const html = renderRegidor(REGIDORA, CONTEXT, "2026-08-30");
    expect(titolDe(html)).toBe("Marta Alarcón i Puerto, regidora d'Esplugues de Llobregat");
    expect(titolDe(html).length).toBeLessThanOrEqual(TITOL_MAXIM);
  });

  it("amb un nom llarg i un poble llarg, el nom i el poble; i mai més de seixanta", () => {
    const titol = titolRegidor(
      { nom: "JUAN ANTONIO CORCHADO PONCE", carrec: "Alcalde" },
      { municipi: "les Franqueses del Vallès" },
    );
    expect(titol).toBe("Juan Antonio Corchado Ponce · les Franqueses del Vallès");
    expect(titol.length).toBeLessThanOrEqual(TITOL_MAXIM);
    expect(titolRegidor({ nom: "Anna Coll", carrec: "Regidora" }, { municipi: "Vilanova i la Geltrú" })).toBe(
      "Anna Coll, regidora de Vilanova i la Geltrú",
    );
  });

  it("el càrrec en una paraula, sense endevinar el gènere de ningú", () => {
    expect(carrecCurt("Alcaldessa")).toBe("alcaldessa");
    expect(carrecCurt("Alcalde President")).toBe("alcalde");
    expect(carrecCurt("Regidora delegada d'Urbanisme")).toBe("regidora");
    expect(carrecCurt("Regidor")).toBe("regidor");
    expect(carrecCurt("Regidor/a")).toBe("regidor/a");
    // Un tinent d'alcalde és regidor, però la seu no diu si és regidor o
    // regidora: es deixa el càrrec tal com el publica.
    expect(carrecCurt("1a Tinent d'Alcalde")).toBe("1a Tinent d'Alcalde");
    expect(carrecCurt("Portaveu")).toBe("portaveu");
  });

  it("els sufixos vells ja no hi són", () => {
    const html = renderRegidor(REGIDORA, CONTEXT, "2026-08-30");
    expect(html).not.toContain("Observatori municipal de quivoto");
    expect(html).not.toContain("· Observatori de quivoto");
  });
});

describe("la descripció de la persona", () => {
  it("comença pel nom, diu el càrrec, les sigles i el costat, i acaba amb el que hi ha a la pàgina", () => {
    const html = renderRegidor(REGIDORA, CONTEXT, "2026-08-30");
    expect(descripcioDe(html)).toBe(
      "Marta Alarcón i Puerto, regidora d'Esplugues de Llobregat (ERC-AM), a l'oposició. Què ha votat el seu grup, què cobra i d'on surt cada dada.",
    );
  });

  it("dues persones del mateix grup i del mateix ple ja no tenen la mateixa descripció", () => {
    // Abans totes dues eren «Regidora d'Esplugues de Llobregat (ERC-AM), a l'oposició. …».
    const una = descripcioRegidor(REGIDORA, CONTEXT);
    const altra = descripcioRegidor({ ...REGIDORA, nom: "ANNA COLL PUIG" }, CONTEXT);
    expect(una).not.toBe(altra);
    expect(altra.startsWith("Anna Coll Puig, regidora d'Esplugues de Llobregat (ERC-AM)")).toBe(true);
  });

  it("amb un càrrec llarguíssim, retalla el càrrec i no el nom ni cap xifra, i no passa mai de 158", () => {
    const carrec =
      "1a Tinent d'alcalde delegada de les àrees de Personal, Educació, Medi Ambient, Món Rural, Participació, Transparència, Pubillatge i Porta a porta";
    const descripcio = descripcioRegidor(
      { ...REGIDORA, carrec, equipGovern: true },
      { ...CONTEXT, mandat: { constitucio: "2023-06-17", nom: "2023-2027" } },
    );
    expect(descripcio.length).toBeLessThanOrEqual(DESCRIPCIO_MAXIMA);
    expect(descripcio.startsWith("Marta Alarcón i Puerto, al ple d'Esplugues de Llobregat (ERC-AM)")).toBe(true);
    expect(descripcio).toContain("Al ple des del 17 de juny del 2023.");
    expect(descripcio).not.toMatch(/…$/);
  });

  it("hi posa des de quan és al ple, la llista que encapçalava i les seves xifres", () => {
    const descripcio = descripcioRegidor(REGIDORA, {
      ...CONTEXT,
      mandat: { constitucio: "2023-06-17", nom: "2023-2027" },
      capDeLlista: CAP,
    });
    expect(descripcio).toContain("Al ple des del 17 de juny del 2023.");
    // Amb el nom davant, la llista hi entra en la forma curta: el fet hi és,
    // les xifres són a la pàgina.
    expect(descripcio).toContain("Cap de llista d'ERC-AM el 2023.");
    expect(descripcio.length).toBeLessThanOrEqual(DESCRIPCIO_MAXIMA);
    expect(descripcio.length).toBeGreaterThanOrEqual(70);
    // Sense el nom davant (un nom curt) les xifres sí que hi caben senceres.
    const curt = descripcioRegidor({ ...REGIDORA, nom: "Pau Gil" }, { ...CONTEXT, governConegut: false, capDeLlista: CAP });
    expect(curt).toContain("Cap de llista d'ERC-AM el 2023: 9.000 vots i 5 de 21 regidories.");
  });

  it("amb més d'un mandat, els compta; i diu el càrrec de més amunt", () => {
    const descripcio = descripcioRegidor(REGIDORA, {
      ...CONTEXT,
      mandats: { anys: [2015, 2019, 2023], primer: 2015, quants: 3, seguits: true, iniciConegut: true, cobertesDesDe: 2011, llistesSenseEntrar: [] },
      trajectoria: trajectoriaDePersona(FITXA_J21, REGIDORA.nom),
    });
    // Els dos fets hi són: el càrrec de més amunt no es perd per dir «a
    // l'oposició» o «3 mandats seguits», que passen a la forma curta.
    expect(descripcio).toBe(
      "Marta Alarcón i Puerto, regidora d'Esplugues de Llobregat (ERC-AM). Al ple des del 2015. Ha estat diputada al Parlament de Catalunya (1999–2003).",
    );
    const sola = descripcioRegidor(REGIDORA, {
      ...CONTEXT,
      mandats: { anys: [2015, 2019, 2023], primer: 2015, quants: 3, seguits: true, iniciConegut: true, cobertesDesDe: 2011, llistesSenseEntrar: [] },
    });
    expect(sola).toContain("Al ple des del 2015: 3 mandats seguits.");
  });

  it("el primer any només es diu quan el registre arriba a la municipal d'abans", () => {
    // El registre comença el 2015: «des del 2015» diria que el 2011 no hi era, i no ho sabem.
    const mandats = { anys: [2015, 2019, 2023], primer: 2015, quants: 3, seguits: true, iniciConegut: false, cobertesDesDe: 2015, llistesSenseEntrar: [] };
    const seguits = descripcioRegidor(REGIDORA, { ...CONTEXT, mandats });
    expect(seguits).toContain("Almenys 3 mandats seguits al ple.");
    expect(seguits).not.toMatch(/des del 2015|el primer el/);
    const solts = descripcioRegidor(REGIDORA, { ...CONTEXT, mandats: { ...mandats, anys: [2015, 2023], quants: 2, seguits: false } });
    expect(solts).toContain("Almenys 2 mandats al ple.");
    expect(solts).not.toContain("el primer el 2015");
    // Amb l'inici conegut, el primer any sí.
    const conegut = descripcioRegidor(REGIDORA, {
      ...CONTEXT,
      mandats: { ...mandats, anys: [2015, 2023], quants: 2, seguits: false, iniciConegut: true, cobertesDesDe: 2011 },
    });
    expect(conegut).toContain("2 mandats al ple, el primer el 2015.");
  });

  it("l'alcaldia no és «a l'oposició», i sense govern conegut no es diu cap costat", () => {
    const alcaldessa = descripcioRegidor({ ...REGIDORA, carrec: "Alcaldessa" }, CONTEXT);
    expect(alcaldessa.startsWith("Marta Alarcón i Puerto, alcaldessa d'Esplugues de Llobregat (ERC-AM).")).toBe(true);
    expect(alcaldessa).not.toContain("oposició");
    expect(descripcioRegidor(REGIDORA, { ...CONTEXT, governConegut: false })).not.toContain("oposició");
  });

  it("qui té un càrrec en un altre ens, també", () => {
    const descripcio = descripcioRegidor(REGIDORA, {
      ...CONTEXT,
      altresCarrecs: [{ ens: "Diputació de Barcelona", carrec: "Diputada", anualBrut: null, concepte: null, dedicacio: null, motiuSenseImport: null, font: null }],
    });
    expect(descripcio).toContain("També és diputada (Diputació de Barcelona).");
  });

  it("no s'hi cola cap «null» ni «undefined», ni cap frase a mitges", () => {
    const html = renderRegidor({ ...REGIDORA, grup: null, sigles: null }, { ...CONTEXT, governConegut: false }, "2026-08-30");
    expect(cap(html)).not.toMatch(/null|undefined/);
    expect(descripcioDe(html)).toBe(
      "Marta Alarcón i Puerto, regidora d'Esplugues de Llobregat. Què ha votat el seu grup, què cobra i d'on surt cada dada.",
    );
  });
});

describe("els ajudants del cap SEO", () => {
  it("titolQueCap tria el primer candidat que no passa de seixanta", () => {
    const llarg = "x".repeat(TITOL_MAXIM + 1);
    expect(titolQueCap([llarg, "curt", "més curt"])).toBe("curt");
    expect(titolQueCap([llarg])).toBe(llarg);
    expect(titolQueCap([])).toBe("");
  });

  it("frasesQueCaben posa les frases que hi caben senceres i tria la variant més llarga que hi cap", () => {
    expect(frasesQueCaben(["Una.", null, "Dues.", undefined], 20)).toBe("Una. Dues.");
    expect(frasesQueCaben(["Una frase que no deixa lloc.", "Dues."], 30)).toBe("Una frase que no deixa lloc.");
    // Una de curta pot entrar encara que la llarga d'abans no hi hagi cabut.
    expect(frasesQueCaben(["Una.", "Una frase massa llarga per al lloc que queda.", "Sí."], 12)).toBe("Una. Sí.");
    expect(frasesQueCaben(["Una.", ["Té l'alcaldia: Algú.", "Té l'alcaldia."]], 20)).toBe("Una. Té l'alcaldia.");
  });

  it("fetsQueCaben fa entrar primer tots els fets en la forma curta, i després els fa créixer", () => {
    // frasesQueCaben deixaria la primera llarga i perdria el segon fet.
    const frases = [["Una primera frase llarga.", "Una."], "Fet dos.", ["Fet tres, amb xifres.", "Fet tres."]];
    expect(frasesQueCaben(frases, 40)).toBe("Una primera frase llarga. Fet dos.");
    // fetsQueCaben hi fa cabre els tres fets, i el lloc que queda va al tercer.
    expect(fetsQueCaben(frases, null, 40)).toBe("Una. Fet dos. Fet tres, amb xifres.");
    // Amb lloc de sobra, tot en la forma més llarga i la coletilla al final.
    expect(fetsQueCaben(frases, ["Coletilla llarga.", "Col."], 100)).toBe(
      "Una primera frase llarga. Fet dos. Fet tres, amb xifres. Coletilla llarga.",
    );
    // La coletilla només entra si encara hi cap, i en la seva forma més llarga possible.
    expect(fetsQueCaben(["Una.", "Dos."], ["Coletilla llarga.", "Col."], 14)).toBe("Una. Dos. Col.");
    // La primera hi va sempre, encara que no hi càpiga ni curta.
    expect(fetsQueCaben([["Massa llarga per caber."], "Dos."], null, 10)).toBe("Massa llarga per caber.");
    expect(fetsQueCaben([null, undefined], "Sola.", 20)).toBe("Sola.");
  });
});

describe("les dades estructurades de la persona", () => {
  const html = renderRegidor(
    { ...REGIDORA, foto: "../../../../cares/marta-alarcon.jpg" },
    { ...CONTEXT, comarca: "Baix Llobregat" },
    "2026-08-30",
  );
  const [fil, persona] = jsonLdDe(html);

  it("el fil d'Ariadna passa per l'Observatori, la comarca i el municipi", () => {
    expect(fil?.["@type"]).toBe("BreadcrumbList");
    const noms = (fil?.itemListElement as { name: string; item: string }[]).map((e) => e.name);
    expect(noms).toEqual(["quivoto", "Observatori municipal", "Baix Llobregat", "Esplugues de Llobregat", "Marta Alarcón i Puerto"]);
    expect((fil?.itemListElement as { item: string }[])[2]?.item).toBe("https://quivoto.cat/observatori/c/baix-llobregat/");
  });

  it("la persona: nom, càrrec amb el municipi, ajuntament, partit i retrat, amb els @id del graf, i res més", () => {
    expect(persona?.["@type"]).toBe("Person");
    expect(persona?.["@id"]).toBe("https://quivoto.cat/observatori/m/esplugues-de-llobregat/regidor/marta-alarcon-pujol/#persona");
    expect(persona?.name).toBe("Marta Alarcón i Puerto");
    // El càrrec amb el municipi: és la frase que es cita quan es pregunta qui és algú.
    expect(persona?.jobTitle).toBe("Regidora d'Esplugues de Llobregat");
    expect(persona?.url).toBe("https://quivoto.cat/observatori/m/esplugues-de-llobregat/regidor/marta-alarcon-pujol/");
    expect(persona?.worksFor).toEqual({
      "@type": "GovernmentOrganization",
      "@id": "https://quivoto.cat/observatori/m/esplugues-de-llobregat/#ajuntament",
      name: "Ajuntament d'Esplugues de Llobregat",
      url: "https://quivoto.cat/observatori/m/esplugues-de-llobregat/",
    });
    expect(persona?.memberOf).toEqual({
      "@type": "PoliticalParty",
      "@id": "https://quivoto.cat/observatori/partit/erc/#partit",
      name: "Esquerra Republicana de Catalunya",
      url: "https://quivoto.cat/observatori/partit/erc/",
    });
    // El retrat relatiu a la pàgina surt resolt contra l'adreça canònica.
    expect(persona?.image).toBe("https://quivoto.cat/observatori/cares/marta-alarcon.jpg");
    expect(JSON.stringify(persona)).not.toMatch(/email|telephone|mailto/);
  });

  it("sense retrat no hi ha imatge; una llista local hi va com a Organization, no com a partit", () => {
    const [, sola] = jsonLdDe(renderRegidor({ ...REGIDORA, sigles: null, grup: "Independents" }, CONTEXT, "2026-08-30"));
    expect(sola).not.toHaveProperty("image");
    expect(sola?.memberOf).toEqual({ "@type": "Organization", name: "Independents" });
    // Sense sigles ni grup, cap memberOf.
    const [, ningu] = jsonLdDe(renderRegidor({ ...REGIDORA, sigles: null, grup: null }, CONTEXT, "2026-08-30"));
    expect(ningu).not.toHaveProperty("memberOf");
  });

  it("la pàgina és un ProfilePage que parla de la persona pel seu @id", () => {
    const pagina = jsonLdDe(html).find((n) => n["@type"] === "ProfilePage");
    expect(pagina?.mainEntity).toMatchObject({ "@id": persona?.["@id"], "@type": "Person", name: "Marta Alarcón i Puerto" });
  });

  it("sense Wikidata, cap sameAs ni birthDate; amb la fitxa d'alcaldies, l'element i la Viquipèdia", () => {
    expect(persona).not.toHaveProperty("sameAs");
    expect(persona).not.toHaveProperty("birthDate");
    const [, amb] = jsonLdDe(renderRegidor(REGIDORA, { ...CONTEXT, trajectoria: trajectoriaDePersona(FITXA_J21, REGIDORA.nom) }, "2026-08-30"));
    expect(amb?.sameAs).toEqual(["https://www.wikidata.org/wiki/Q11907", "https://ca.wikipedia.org/wiki/Marta_Alarc%C3%B3n"]);
    // La fitxa d'alcaldies no ensenya la data de naixement: tampoc no va al JSON-LD.
    expect(amb).not.toHaveProperty("birthDate");
  });

  it("amb la fitxa de caps de llista, l'any de naixement que el bloc «Qui és» escriu, i només l'any", () => {
    const [, cap] = jsonLdDe(renderRegidor(REGIDORA, { ...CONTEXT, trajectoria: quiEsDeWikidata(FITXA_J27, "Marta Alarcon Puerto") }, "2026-08-30"));
    expect(cap?.birthDate).toBe("1985");
    expect(cap?.sameAs).toEqual(["https://www.wikidata.org/wiki/Q42", "https://ca.wikipedia.org/wiki/Marta_Alarc%C3%B3n"]);
  });

  it("l'Open Graph és de perfil, amb la imatge de reserva i l'adreça canònica", () => {
    expect(html).toContain('<meta property="og:type" content="profile">');
    expect(html).toContain('<meta property="og:image" content="https://quivoto.cat/assets/og.png">');
    expect(html).toContain('<link rel="canonical" href="https://quivoto.cat/observatori/m/esplugues-de-llobregat/regidor/marta-alarcon-pujol/">');
    expect(html).toContain('<meta name="robots" content="index,follow,max-image-preview:large">');
  });
});

describe("els encapçalaments de la pàgina de la persona", () => {
  it("un sol h1 i cap salt de nivell", () => {
    const html = renderRegidor(
      { ...REGIDORA, posicioLlista: 1 },
      { ...CONTEXT, capDeLlista: CAP, trajectoria: trajectoriaDePersona(FITXA_J21, REGIDORA.nom) },
      "2026-08-30",
    );
    const nivells = nivellsDe(html);
    expect(nivells.filter((n) => n === 1)).toHaveLength(1);
    expect(nivells[0]).toBe(1);
    for (let i = 1; i < nivells.length; i++) expect(nivells[i]).toBeLessThanOrEqual(nivells[i - 1]! + 1);
  });
});

describe("el nom de l'ens enllaça la seva fitxa", () => {
  const diba = ensDeProva({ tipus: "diputacio" });
  const consell = ensDeProva({ nom: "Consell Comarcal del Baix Llobregat", slug: "baix-llobregat" });
  const ambDiputacio = {
    ...CONTEXT,
    altresCarrecs: [
      {
        ens: "DIPUTACIÓ DE BARCELONA",
        carrec: "Diputada",
        anualBrut: 20_000,
        concepte: null,
        dedicacio: null,
        motiuSenseImport: null,
        font: { nom: "Diputació de Barcelona", url: "https://www.diba.cat/" },
      },
    ],
  };

  it("lliga el nom sense accents ni majúscules, i només si l'ens és únic", () => {
    expect(fitxaEnsPerNom([diba, consell], "Diputació de Barcelona")).toBe("../../../../diputacio/barcelona/");
    expect(fitxaEnsPerNom([diba, consell], "consell comarcal del baix llobregat")).toBe("../../../../c/baix-llobregat/consell/");
    expect(fitxaEnsPerNom([diba, diba], "Diputació de Barcelona")).toBeNull();
    expect(fitxaEnsPerNom([diba], "Àrea Metropolitana de Barcelona")).toBeNull();
    expect(fitxaEnsPerNom(undefined, "Diputació de Barcelona")).toBeNull();
  });

  it("sense ens, la pàgina queda exactament com era", () => {
    expect(renderRegidor(REGIDORA, ambDiputacio, "2026-08-30", undefined)).toBe(
      renderRegidor(REGIDORA, ambDiputacio, "2026-08-30"),
    );
    expect(renderRegidor(REGIDORA, ambDiputacio, "2026-08-30")).not.toContain("diputacio/barcelona/");
  });

  it("amb ens, la targeta de «Què cobra» i la pastilla del capçal porten a la fitxa", () => {
    const html = renderRegidor(REGIDORA, ambDiputacio, "2026-08-30", [diba, consell]);
    expect(html).toContain('<span class="ens"><a href="../../../../diputacio/barcelona/">DIPUTACIÓ DE BARCELONA</a>');
    // Al capçal el nom de l'ens s'escriu com un nom, no amb les majúscules de la font.
    expect(html).toContain('<a class="segon-carrec" href="../../../../diputacio/barcelona/">Diputació de Barcelona</a>');
    // La pastilla que porta a «Què cobra» hi continua.
    expect(html).toContain('<a class="segon-carrec" href="#que-cobra">');
  });
});

describe("el nom curt i el càrrec a la vista", () => {
  it("nomCurt: el nom de pila i el primer cognom, amb les partícules al seu cognom", () => {
    expect(nomCurt("Francesc Xavier Marcé Carol")).toBe("Francesc Marcé");
    expect(nomCurt("Albert Batlle Bastardas")).toBe("Albert Batlle");
    expect(nomCurt("Marta Alarcón i Puerto")).toBe("Marta Alarcón");
    expect(nomCurt("Josep Maria de Pablo García")).toBe("Josep de Pablo");
    expect(nomCurt("ANNA RIBAS SOLÀ")).toBe("Anna Ribas");
    // Amb dos trossos no hi ha res a escurçar; el sufix entre parèntesis cau.
    expect(nomCurt("Pere Coll")).toBe("Pere Coll");
    expect(nomCurt("ARIÀ PÉREZ ISIDRO (Ind.)")).toBe("Arià Pérez");
  });

  it("carrecALaVista: l'alcaldia i les tinences, amb el número si la seu el dona", () => {
    expect(carrecALaVista("Alcaldessa de Sabadell")).toBe("Alcaldia");
    expect(carrecALaVista("4t Tinent d'Alcalde")).toBe("4a tinença");
    expect(carrecALaVista("1ª Tinença Alcaldia")).toBe("1a tinença");
    expect(carrecALaVista("5aTta.Alcaldessa")).toBe("5a tinença");
    expect(carrecALaVista("Segona tinenta d'alcaldia")).toBe("2a tinença");
    expect(carrecALaVista("Tinent d'alcalde")).toBe("Tinença d'alcaldia");
    expect(carrecALaVista("Regidor del Districte")).toBeNull();
    expect(carrecALaVista("Regidora d'Alcaldia")).toBeNull();
    expect(carrecALaVista("Portaveu")).toBeNull();
  });
});

describe("l'índex de la fitxa", () => {
  const enllacos = (html: string): string[] => {
    const nav = html.slice(html.indexOf('<nav class="rg-index"'), html.indexOf("</nav>", html.indexOf('<nav class="rg-index"')));
    return [...nav.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]!);
  };
  const seccions = (html: string): string[] =>
    [...html.slice(html.indexOf("<main")).matchAll(/<section class="bloc[^"]*" id="([^"]+)"/g)].map((m) => m[1]!);

  it("no enllaça cap bloc que no s'hagi escrit: sense fitxa de la seu, cap «Transparència»", () => {
    const html = renderRegidor(REGIDORA, { ...CONTEXT, publicaDeLaPersona: null }, "2026-08-30");
    expect(html).not.toContain('id="que-en-publica"');
    expect(html).not.toContain('href="#que-en-publica"');
    for (const id of enllacos(html)) expect(html).toContain(`id="${id}"`);
  });

  it("segueix l'ordre dels blocs i inclou «Com a cap de llista» quan hi és", () => {
    const html = renderRegidor(
      { ...REGIDORA, posicioLlista: 1 },
      {
        ...CONTEXT,
        capDeLlista: CAP,
        companys: [
          { nom: "Pere Coll Vidal", foto: null, adreca: "pere-coll-vidal", carrec: "Regidor" },
        ],
        trajectoria: trajectoriaDePersona(FITXA_J21, "Marta Alarcón i Puerto"),
      },
      "2026-08-30",
    );
    const index = enllacos(html);
    expect(index).toContain("cap-de-llista");
    expect(index).toContain("mes-enlla");
    // Exactament les seccions de la pàgina que tenen nom a l'índex, en el seu ordre.
    expect(index).toEqual(seccions(html).filter((id) => index.includes(id)));
    expect(index[0]).toBe("mateix-grup");
  });

  it("és text subratllat, no una filera de pastilles", () => {
    const html = renderRegidor(REGIDORA, CONTEXT, "2026-08-30");
    expect(html).toMatch(/\.nav-fitxa a\{[^}]*text-decoration:underline/);
    expect(html).not.toMatch(/\.nav-fitxa a\{[^}]*border-radius/);
  });

  it("indexDeLaFitxa llegeix l'id de cada bloc, i amb menys de dos no s'escriu", () => {
    expect(indexDeLaFitxa(['<section class="bloc" id="que-cobra"></section>'])).toBe("");
    const nav = indexDeLaFitxa([
      '<section class="bloc" id="qui-es"></section>',
      '<section class="bloc" id="que-ha-votat"></section>',
      '<section class="bloc" id="desconegut"></section>',
    ]);
    expect(nav).toContain('<a href="#qui-es">Qui és</a>');
    expect(nav).toContain('<a href="#que-ha-votat">Què ha votat</a>');
    expect(nav).not.toContain("desconegut");
  });
});

describe("polit de la pàgina de la persona", () => {
  it("cap enllaç amb «→» al darrere", () => {
    const html = renderRegidor(REGIDORA, { ...CONTEXT, trajectoria: trajectoriaDePersona(FITXA_J21, "Marta Alarcón i Puerto") }, "2026-08-30");
    expect(html.slice(html.indexOf("<main"), html.indexOf("</main>"))).not.toContain("→");
  });

  it("les etiquetes de les caselles no van en majúscules espaiades, i el peu no es diu «peu»", () => {
    const html = renderRegidor(REGIDORA, CONTEXT, "2026-08-30");
    expect(html).not.toMatch(/\.(pas|fets) \.etq\{[^}]*uppercase/);
    expect(html).toContain('<span class="rg-peu">');
    expect(html).not.toContain('<span class="peu">');
  });

  it("la cronologia diu «Va ser diputada», no «Va ocupar diputada»", () => {
    const html = renderRegidor(
      REGIDORA,
      {
        ...CONTEXT,
        llistes: [{ any: 2023, sigles: "ERC-AM", posicio: 2, capDeLlista: false, elegit: true }],
        trajectoria: trajectoriaDePersona(FITXA_J21, "Marta Alarcón i Puerto"),
      },
      "2026-08-30",
    );
    expect(html).toContain("Va ser diputada al Parlament de Catalunya.");
    expect(html).not.toContain("Va ocupar");
  });

  it("una sola llista, elegida i amb el número a les etiquetes, no repeteix la línia de llistes", () => {
    const una = renderRegidor(
      REGIDORA,
      { ...CONTEXT, llistes: [{ any: 2023, sigles: "ERC-AM", posicio: 2, capDeLlista: false, elegit: true }] },
      "2026-08-30",
    );
    expect(una).not.toContain("Les llistes on ha anat");
    // Si el número no es diu enlloc més, la línia es queda.
    const senseNumero = renderRegidor(
      { ...REGIDORA, posicioLlista: null },
      { ...CONTEXT, llistes: [{ any: 2023, sigles: "ERC-AM", posicio: 2, capDeLlista: false, elegit: true }] },
      "2026-08-30",
    );
    expect(senseNumero).toContain("Les llistes on ha anat");
  });
});
