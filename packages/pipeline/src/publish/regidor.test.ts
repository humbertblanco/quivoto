import { describe, expect, it } from "vitest";
import { adrecesRegidors, renderRegidor, slugRegidor, trajectoriaDePersona } from "./regidor";

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
    expect(html).toContain("La seva pàgina a la Viquipedia");
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

  it("distingeix no haver llegit actes de que les actes no desglossin el vot", () => {
    const html = renderRegidor(REGIDORA, { ...CONTEXT, votsDelGrup: [] }, "2026-08-29");
    expect(html).toContain("cap no desglossa el vot per grup");
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
    expect(html).not.toContain("<img src=x>");
    expect(html).toContain("&lt;img src=x&gt;");
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
    expect(html).toContain("a l'equip de govern");
    expect(html).not.toContain("a l'oposició");
  });

  it("sense ningú marcat al ple, no es diu que estigui a l'oposició", () => {
    const html = renderRegidor(
      { ...REGIDORA, equipGovern: false },
      { ...CONTEXT, governConegut: false },
      "2026-08-29",
    );
    expect(html).not.toContain("a l'oposició");
    expect(html).toContain("no diu qui és a l'equip de govern");
  });

  it("amb algú marcat, el fals dels altres sí que vol dir oposició", () => {
    const html = renderRegidor(
      { ...REGIDORA, equipGovern: false },
      { ...CONTEXT, governConegut: true },
      "2026-08-29",
    );
    expect(html).toContain("a l'oposició");
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
    expect(html).toContain('<span class="alcaldia-etiqueta">');
    // El CSS de la pastilla hi és sempre; el que no hi ha de ser és el <span>.
    expect(renderRegidor({ ...REGIDORA, carrec: "Regidora" }, CONTEXT, "2026-08-30")).not.toContain(
      '<span class="alcaldia-etiqueta">',
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

describe("quan no s'ha llegit cap acta, no es compta res sobre zero", () => {
  it("no diu «de 0 actes llegides»", () => {
    const html = renderRegidor(
      REGIDORA,
      { ...CONTEXT, votsDelGrup: [], actesLlegides: 0, assistencia: null },
      "2026-08-30",
    );
    expect(html).not.toContain("de 0 actes llegides");
    expect(html).toContain("encara no n'hem pogut llegir cap acta");
  });
});
