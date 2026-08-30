import { describe, expect, it } from "vitest";
import { adrecesRegidors, renderRegidor, slugRegidor } from "./regidor";

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

describe("renderRegidor", () => {
  it("explica quan el vot es pot atribuir a la persona i quan no", () => {
    const html = renderRegidor(REGIDORA, CONTEXT, "2026-08-29");
    expect(html).toContain("tants vots com regidories té");
    expect(html).toContain("no es pot saber qui");
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
    expect(html).toContain('<span class="sigla" style="--c:');
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
