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
