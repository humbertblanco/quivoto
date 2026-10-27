import { describe, expect, it } from "vitest";
import {
  MANDATS_TIRA, mandatsSenseDades, relleusDeLaTira, resumTira, tiraDelPoble, tiraDesDeHistorial, tiradesDeLaTira,
  type HistorialPerTira, type MandatTira, type TramAlcaldia,
} from "./tira-poble";

/**
 * El mateix historial inventat que fan servir les proves d'`alcaldia-historica`,
 * amb la forma exacta de la mètrica `mayors`: dos mandats seguits d'una
 * persona, un relleu a mig mandat amb els dos noms, el mandat vigent on la font
 * només sap qui hi ha ara, i set mandats sense cap fila.
 */
const HISTORIAL: HistorialPerTira = {
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
    { term: "2023-2027", onlySuccessorKnown: true },
    { term: "2011-2015" },
  ],
};

const AVUI = "2026-09-02";
const dies = (a: string, b: string): number => (Date.parse(b) - Date.parse(a)) / 86_400_000;
const mandat = (t: ReturnType<typeof tiraDesDeHistorial>, term: string): MandatTira => t.mandats.find((m) => m.term === term)!;
const alcaldies = (m: MandatTira): TramAlcaldia[] => m.trams.filter((t): t is TramAlcaldia => t.tipus === "alcaldia");

describe("tiraDesDeHistorial", () => {
  const tira = tiraDesDeHistorial(HISTORIAL, "Alcanar", AVUI);

  it("dona sempre els dotze mandats del 1979 al 2027", () => {
    expect(tira.mandats.map((m) => m.term)).toEqual(MANDATS_TIRA.map((m) => m.term));
    expect(tira.mandats[0]!.inici).toBe(1979);
    expect(tira.mandats[11]!.fi).toBe(2027);
  });

  it("deixa en blanc els mandats sense cap fila, sense copiar el color del costat", () => {
    for (const term of ["1979-1983", "1983-1987", "1999-2003"]) expect(mandat(tira, term).trams).toEqual([{ tipus: "buit", de: 0, fins: 1 }]);
    expect(mandatsSenseDades(tira)).toEqual(["1979-1983", "1983-1987", "1987-1991", "1991-1995", "1995-1999", "1999-2003"]);
  });

  it("cada mandat omple exactament el seu tros, sense forats ni encavalcaments", () => {
    for (const m of tira.mandats) {
      expect(m.trams[0]!.de).toBe(0);
      expect(m.trams[m.trams.length - 1]!.fins).toBe(1);
      m.trams.forEach((t, k) => k > 0 && expect(t.de).toBe(m.trams[k - 1]!.fins));
    }
  });

  it("posa l'osca d'un relleu al seu dia dins del mandat", () => {
    const [anna, pere] = alcaldies(mandat(tira, "2011-2015"));
    const esperat = dies("2011-06-11", "2013-02-01") / dies("2011-06-11", "2015-06-13");
    expect(anna!.relleu).toBe(false);
    expect(pere!.relleu).toBe(true);
    expect(pere!.de).toBeCloseTo(esperat, 3);
    expect(anna!.fins).toBe(pere!.de);
    expect(pere!.nom).toBe("Pere Vidal Mas");
  });

  it("un mandat on la font només sap el successor comença en blanc, i el futur també és blanc", () => {
    const m = mandat(tira, "2023-2027");
    expect(m.trams.map((t) => t.tipus)).toEqual(["buit", "alcaldia", "futur"]);
    const ara = dies("2023-06-17", AVUI) / dies("2023-06-17", "2027-06-12");
    expect(m.trams[2]!.de).toBeCloseTo(ara, 3);
    expect((m.trams[1] as TramAlcaldia).relleu).toBe(true);
  });

  it("el color és el de la marca, i ERC i ERC-AM són la mateixa família", () => {
    const roig2003 = alcaldies(mandat(tira, "2003-2007"))[0]!;
    const roig2019 = alcaldies(mandat(tira, "2019-2023"))[0]!;
    expect(roig2003.familia).toBe("erc");
    expect(roig2003.color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(roig2019.color).toBe(roig2003.color);
    // Sense data de possessió no es pot dir que arribés tard: comença al principi.
    expect(roig2003.de).toBe(0);
  });

  it("un partit sense marca no té color (gris neutre) i un relleu sense data va a mig camí", () => {
    const t = tiraDesDeHistorial(
      {
        history: [
          { term: "1991-1995", name: "A", partyRaw: "AGRUPACIO VEINAL XYZ", tookOfficeOn: "1991-06-15" },
          { term: "1991-1995", name: "B", partyRaw: null, tookOfficeOn: null },
          { term: "1991-1995", name: "C", partyRaw: null, tookOfficeOn: "1993-06-15" },
          { term: "1991-1995", name: "a", partyRaw: "AGRUPACIO VEINAL XYZ", tookOfficeOn: "1991-06-15" },
        ],
      },
      null,
      AVUI,
    );
    const [a, c, b] = alcaldies(mandat(t, "1991-1995"));
    // Per data i sense repetir la mateixa persona; «B», sense data, va després
    // de qui hi era des de la constitució, al final i amb l'osca aproximada.
    expect([a!.nom, c!.nom, b!.nom]).toEqual(["A", "C", "B"]);
    expect(a!.color).toBeNull();
    expect(a!.familia).toBeNull();
    expect(b!.partit).toBeNull();
    expect(c!.de).toBeCloseTo(0.5, 2);
    expect(b!.posicioAproximada).toBe(true);
    expect(b!.de).toBeCloseTo((c!.de + 1) / 2, 3);
  });

  it("un relleu sense data entre dos de coneguts queda al mig i ho diu", () => {
    const t = tiraDesDeHistorial(
      {
        history: [
          { term: "1995-1999", name: "A", partyRaw: "PSC", tookOfficeOn: "1995-06-17" },
          { term: "1995-1999", name: "B", partyRaw: "PSC", tookOfficeOn: null },
        ],
      },
      null,
      AVUI,
    );
    const trams = alcaldies(mandat(t, "1995-1999"));
    expect(trams.map((x) => x.nom)).toEqual(["A", "B"]);
    expect(trams[1]!.de).toBe(0.5);
    expect(trams[1]!.posicioAproximada).toBe(true);
    expect(trams[1]!.relleu).toBe(true);
  });

  it("si ningú no hi és des de la constitució, qui no té data és qui hi era abans", () => {
    const t = tiraDesDeHistorial(
      {
        history: [
          { term: "1987-1991", name: "NOU", partyRaw: "PSC", tookOfficeOn: "1989-06-30" },
          { term: "1987-1991", name: "VELL", partyRaw: "CiU", tookOfficeOn: null },
        ],
      },
      null,
      AVUI,
    );
    const trams = mandat(t, "1987-1991").trams;
    expect(trams.map((x) => (x.tipus === "alcaldia" ? x.nom : x.tipus))).toEqual(["Vell", "Nou"]);
    expect(trams[0]!.de).toBe(0);
    expect((trams[1] as TramAlcaldia).posicioAproximada).toBe(false);
  });

  it("sense historial, tot és blanc i el mandat en curs acaba en futur", () => {
    const t = tiraDesDeHistorial(null, "Gósol", AVUI);
    expect(t.mandats.slice(0, 11).every((m) => m.trams.length === 1 && m.trams[0]!.tipus === "buit")).toBe(true);
    expect(mandat(t, "2023-2027").trams.map((x) => x.tipus)).toEqual(["buit", "futur"]);
    expect(resumTira(t)).toBe("Qui ha tingut l'alcaldia de Gósol del 1979 al 2027: no consta a cap font.");
  });
});

describe("el que diu la tira", () => {
  const tira = tiraDesDeHistorial(HISTORIAL, "Alcanar", AVUI);

  it("agrupa els trams seguits de la mateixa força a través dels mandats", () => {
    expect(tiradesDeLaTira(tira)).toEqual([
      { etiqueta: "no consta", buit: true, anyInici: 1979, anyFi: 2003 },
      { etiqueta: "ERC", buit: false, anyInici: 2003, anyFi: 2007 },
      { etiqueta: "CiU", buit: false, anyInici: 2007, anyFi: 2015 },
      { etiqueta: "ERC-AM", buit: false, anyInici: 2015, anyFi: 2023 },
      { etiqueta: "no consta", buit: true, anyInici: 2023, anyFi: 2024 },
      { etiqueta: "ERC-AM", buit: false, anyInici: 2024, anyFi: null },
    ]);
  });

  it("compta només les osques entre dues alcaldies conegudes", () => {
    expect(relleusDeLaTira(tira)).toBe(1);
  });

  it("escriu la frase de l'aria-label", () => {
    expect(resumTira(tira)).toBe(
      "Qui ha tingut l'alcaldia d'Alcanar, del 1979 al 2027: no consta, del 1979 al 2003; ERC, del 2003 al 2007; CiU, del 2007 al 2015; " +
        "ERC-AM, del 2015 al 2023; no consta, del 2023 al 2024; ERC-AM, del 2024 fins ara. Un relleu a mig mandat.",
    );
    expect(resumTira({ ...tira, municipi: "el Prat de Llobregat" })).toContain("l'alcaldia del Prat de Llobregat");
  });
});

describe("tiraDelPoble", () => {
  const tira = tiraDesDeHistorial(HISTORIAL, "Alcanar", AVUI);

  it("gran: imatge amb etiqueta, anys als extrems, llista amagada i dades per a l'etiqueta flotant", () => {
    const html = tiraDelPoble(tira, { mida: "gran" });
    expect(html).toContain('class="tp tp-gran"');
    expect(html).toMatch(/role="img" aria-label="Qui ha tingut l'alcaldia d'Alcanar/);
    expect(html).toContain('<span>1979</span><span>2027</span>');
    expect(html.match(/<li>/g)).toHaveLength(12);
    expect(html).toContain("<li>2011-2015: Anna Ferrer Roca (CiU); des de l'1 de febrer del 2013, Pere Vidal Mas (CiU)</li>");
    expect(html).toContain("<li>1979-1983: no consta</li>");
    expect(html).toContain("<li>2023-2027: el principi del mandat no consta; des del 5 d'octubre del 2024, Maria Puig Soler (ERC-AM)</li>");
    expect(html).toContain('data-nom="Pere Vidal Mas"');
    expect(html).toContain('data-valor="no consta"');
    expect(html).toContain('data-extres="presa de possessió');
    expect(html.match(/tp-relleu/g)).toHaveLength(2);
    expect(html).toContain("tp-futur");
    // Cap tram no és focusable: dins d'un role="img" seria una trampa per al teclat.
    expect(html).not.toContain("tabindex");
  });

  it("gran: les amplades de cada mandat sumen el cent per cent", () => {
    const html = tiraDelPoble(tira, { mida: "gran" });
    const mandats = html.split('<span class="tp-mandat">').slice(1);
    expect(mandats).toHaveLength(12);
    for (const m of mandats) {
      const suma = [...m.matchAll(/width:([\d.]+)%/g)].reduce((s, x) => s + Number(x[1]), 0);
      expect(suma).toBeCloseTo(100, 1);
    }
  });

  it("fina: només la franja i l'aria-label, sense llista ni etiquetes", () => {
    const html = tiraDelPoble(tira, { mida: "fina" });
    expect(html.startsWith('<span class="tp tp-fina" role="img" aria-label="Qui ha tingut')).toBe(true);
    expect(html).not.toContain("<ul");
    expect(html).not.toContain("data-valor");
    expect(html).not.toContain("title=");
    expect(html).toContain("--c:#");
  });

  it("escapa el que ve de la font", () => {
    const t = tiraDesDeHistorial(
      { history: [{ term: "2015-2019", name: "X", partyRaw: 'A<b>"', tookOfficeOn: "2015-06-13" }] },
      "Vic",
      AVUI,
    );
    const html = tiraDelPoble(t, { mida: "gran" });
    expect(html).not.toContain("<b>");
    expect(html).toContain("A&lt;b&gt;&quot;");
  });
});
