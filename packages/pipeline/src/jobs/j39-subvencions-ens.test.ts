import { describe, expect, it } from "vitest";
import {
  anysComplets,
  classificaConcedent,
  clauEns,
  consultaPerAjuntament,
  consultaTotals,
  esDelTerritori,
  indexaEns,
  llegeixRegistre,
  normalitzaCif,
  numero,
  PATRO_AJUNTAMENT,
  plegaPerAjuntament,
  topConvocatories,
  urlConsulta,
} from "./j39-subvencions-ens";

/*
 * Les fixtures copien files reals del registre d'ens locals (`6nei-4b44`) i
 * del RAISC (`s9xt-n979`) consultades el 27-10-2026, retallades al que fa
 * falta. Cap prova toca la xarxa ni la base de dades.
 */

const REGISTRE = [
  { codi_ens: "8000840003", nomtipus: "Províncies", nom_complert: "Diputació de Barcelona", cif: "P0800000B", codi_municipi: "0801930008", dissolt: "N" },
  { codi_ens: "8002550006", nomtipus: "Províncies", nom_complert: "Diputació de Lleida", cif: "P2500000A", codi_municipi: "2512070005", dissolt: "N" },
  { codi_ens: "8100170005", nomtipus: "Comarques", nom_complert: "Consell Comarcal de l'Alt Camp", cif: "P9300005G", codi_municipi: "4316130008", dissolt: "N" },
  { codi_ens: "8102520002", nomtipus: "Comarques", nom_complert: "Consell Comarcal del Pallars Jussà", cif: "P7500014A", codi_municipi: "2523470005", dissolt: "N" },
  { codi_ens: "8102710007", nomtipus: "Comarques", nom_complert: "Consell Comarcal del Pla d'Urgell", cif: "P7500012E", codi_municipi: "2513700000", dissolt: "N" },
  { codi_ens: "8103850006", nomtipus: "Comarques", nom_complert: "Consell Comarcal de l'Urgell", cif: "P7500003D", codi_municipi: "2521730008", dissolt: "N" },
  { codi_ens: "8102490004", nomtipus: "Comarques", nom_complert: "Consell Comarcal d'Osona", cif: "P5800015I", codi_municipi: "0829810007", dissolt: "N" },
  // Tres «comarques» que no són consells comarcals.
  { codi_ens: "8101360009", nomtipus: "Comarques", nom_complert: "Comarca del Barcelonès", cif: "P5800012F", codi_municipi: "0801930008", dissolt: "N" },
  { codi_ens: "8104300000", nomtipus: "Comarques", nom_complert: "Comarca del Lluçanès", codi_municipi: "0817120002", dissolt: "N" },
  { codi_ens: "8103980001", nomtipus: "Comarques", nom_complert: "Conselh Generau d'Aran", cif: "P7500011G", codi_municipi: "2524300000", dissolt: "N" },
  // Ajuntaments: Abella de la Conca (Pallars Jussà, Lleida), Abrera (Baix Llobregat, Barcelona),
  // Torrelameu (Noguera, Lleida), i un sense CIF vàlid.
  { codi_ens: "2500190004", nomtipus: "Municipis", nom_complert: "Ajuntament d'Abella de la Conca", cif: "P2500100I", codiprov: "8002550006", codcomarca: "8102520002", dissolt: "N" },
  { codi_ens: "800180001", nomtipus: "Municipis", nom_complert: "Ajuntament d'Abrera", cif: "p-0800100-j", codiprov: "8000840003", codcomarca: "8101150006", dissolt: "N" },
  { codi_ens: "2528840000", nomtipus: "Municipis", nom_complert: "Ajuntament de Torrelameu", cif: "P2528800B", codiprov: "8002550006", codcomarca: "8102340003", dissolt: "N" },
  { codi_ens: "2599990000", nomtipus: "Municipis", nom_complert: "Ajuntament inventat", cif: "", codiprov: "8002550006", dissolt: "N" },
];

describe("clauEns", () => {
  it("dona la mateixa clau amb accents, articles i majúscules diferents", () => {
    expect(clauEns("Consell Comarcal de l'Alt Camp")).toBe("consell:alt camp");
    expect(clauEns("CONSELL COMARCAL ALT CAMP")).toBe("consell:alt camp");
    expect(clauEns("Consell Comarcal del Pallars Jussà")).toBe(clauEns("CONSELL COMARCAL DEL PALLARS JUSSA"));
    expect(clauEns("Consell Comarcal d’Osona")).toBe("consell:osona");
    expect(clauEns("Diputació de Barcelona")).toBe("diputacio:barcelona");
    expect(clauEns("DIPUTACIO PROVINCIAL DE LLEIDA")).toBe("diputacio:lleida");
  });

  it("treu els articles de dins el nom, i Urgell, Alt Urgell i Pla d'Urgell continuen sent tres", () => {
    expect(clauEns("Consell Comarcal del Pla de l'Estany")).toBe(clauEns("CONSELL COMARCAL PLA ESTANY"));
    const urgells = ["Consell Comarcal de l'Urgell", "Consell Comarcal de l'Alt Urgell", "Consell Comarcal del Pla d'Urgell"].map(clauEns);
    expect(new Set(urgells).size).toBe(3);
  });

  it("no dona clau als organismes ni a res que no sigui consell o diputació", () => {
    expect(clauEns("Organisme Autònom de Salut Pública de la Diputació de Girona (Dipsalut)")).toBeNull();
    expect(clauEns("Patronat de Turisme de la Diputació de Tarragona")).toBeNull();
    expect(clauEns("Conselh Generau d'Aran")).toBeNull();
    expect(clauEns("Consell Comarcal")).toBeNull();
  });
});

describe("normalitzaCif", () => {
  it("neteja espais, guions i punts i posa majúscules", () => {
    expect(normalitzaCif("P2528800B")).toBe("P2528800B");
    expect(normalitzaCif(" p-2528800-b ")).toBe("P2528800B");
    expect(normalitzaCif("P.2528800.B")).toBe("P2528800B");
  });

  it("no accepta els textos amb què el RAISC amaga el beneficiari", () => {
    expect(normalitzaCif("Benef. no publicable")).toBeNull();
    expect(normalitzaCif("PERSONA FÍSICA")).toBeNull();
    expect(normalitzaCif("")).toBeNull();
    expect(normalitzaCif(undefined)).toBeNull();
  });
});

describe("anys i números", () => {
  it("pren els tres últims anys complets, mai l'any en curs", () => {
    expect(anysComplets(new Date("2026-10-27T10:00:00Z"))).toEqual([2023, 2024, 2025]);
    expect(anysComplets(new Date("2027-01-01T00:00:00Z"))).toEqual([2024, 2025, 2026]);
  });

  it("llegeix els números que el Socrata torna com a text", () => {
    expect(numero("22708.04")).toBe(22708.04);
    expect(numero("")).toBeNull();
    expect(numero(undefined)).toBeNull();
    expect(numero("no")).toBeNull();
  });
});

describe("llegeixRegistre", () => {
  const { ens, ajuntaments } = llegeixRegistre(REGISTRE);

  it("pren les diputacions i només les comarques que són consells comarcals", () => {
    expect(ens.map((e) => e.nom)).toEqual([
      "Diputació de Barcelona",
      "Diputació de Lleida",
      "Consell Comarcal de l'Alt Camp",
      "Consell Comarcal d'Osona",
      "Consell Comarcal del Pallars Jussà",
      "Consell Comarcal del Pla d'Urgell",
      "Consell Comarcal de l'Urgell",
    ]);
    expect(ens.find((e) => e.codiEns === "8002550006")).toMatchObject({ tipus: "diputacio", seuCodiEns: "2512070005" });
  });

  it("normalitza el CIF i el codi d'ens dels ajuntaments, i deixa els que no tenen CIF", () => {
    expect(ajuntaments).toHaveLength(3);
    expect(ajuntaments.find((a) => a.cif === "P0800100J")).toMatchObject({ codiEns: "0800180001", codiProvincia: "8000840003" });
  });

  it("sap si un ajuntament és del territori de l'ens", () => {
    const abella = ajuntaments.find((a) => a.cif === "P2500100I")!;
    expect(esDelTerritori({ codiEns: "8002550006", tipus: "diputacio" }, abella)).toBe(true);
    expect(esDelTerritori({ codiEns: "8102520002", tipus: "consell" }, abella)).toBe(true);
    expect(esDelTerritori({ codiEns: "8000840003", tipus: "diputacio" }, abella)).toBe(false);
    expect(esDelTerritori({ codiEns: "8100170005", tipus: "consell" }, abella)).toBe(false);
  });
});

describe("classificaConcedent", () => {
  const { perClau, repetides } = indexaEns(llegeixRegistre(REGISTRE).ens);

  it("no té cap clau repetida", () => {
    expect(repetides).toEqual([]);
  });

  it("lliga el nom del RAISC amb l'ens, encara que s'escrigui diferent", () => {
    expect(classificaConcedent("CONSELL COMARCAL ALT CAMP", null, perClau)).toMatchObject({
      ens: { codiEns: "8100170005" },
      agencia: false,
    });
    expect(classificaConcedent("Diputació de Lleida", "Diputació de Lleida", perClau)?.agencia).toBe(false);
  });

  it("marca com a organisme el que només lliga per l'entitat d'adscripció", () => {
    const iei = classificaConcedent("Fundació Pública Institut d'Estudis Ilerdencs", "Diputació de Lleida", perClau);
    expect(iei).toMatchObject({ ens: { codiEns: "8002550006" }, agencia: true });
    const osona = classificaConcedent("Consorci d'Osona de Serveis Socials", "Consell Comarcal d'Osona", perClau);
    expect(osona).toMatchObject({ ens: { codiEns: "8102490004" }, agencia: true });
  });

  it("no atribueix a cap ens el que no és de cap dels 44", () => {
    expect(classificaConcedent("Diputació de Girona", "Diputació de Girona", perClau)).toBeNull();
    expect(classificaConcedent("Ajuntament de Manresa", undefined, perClau)).toBeNull();
  });
});

describe("plegaPerAjuntament", () => {
  const territori = [
    { cif: "P2528800B", municipalityId: 30 },
    { cif: "P2500100I", municipalityId: 10 },
    { cif: "P2508600J", municipalityId: 20 },
  ];

  it("posa tots els ajuntaments del territori, amb null on no consta res, mai zero", () => {
    const { perAjuntament, foraDelTerritori } = plegaPerAjuntament(
      [2023, 2024, 2025],
      [
        { cif: "P2528800B", any: 2025, import: 22708.04 },
        { cif: "P2500100I", any: 2023, import: 1000 },
        { cif: "P2500100I", any: 2023, import: 0.1 },
        { cif: "P2500100I", any: 2024, import: 0.2 },
        // Un any fora de la finestra s'ignora.
        { cif: "P2500100I", any: 2026, import: 99 },
        // Un ajuntament d'una altra província va a part.
        { cif: "P0800100J", any: 2024, import: 10000 },
      ],
      territori,
    );
    expect(perAjuntament).toEqual([
      { municipalityId: 10, imports: [1000.1, 0.2, null] },
      { municipalityId: 20, imports: [null, null, null] },
      { municipalityId: 30, imports: [null, null, 22708.04] },
    ]);
    expect(foraDelTerritori).toEqual([{ cif: "P0800100J", any: 2024, import: 10000 }]);
  });

  it("guarda un import zero si el RAISC el registra així: és una dada, no un buit", () => {
    const { perAjuntament } = plegaPerAjuntament([2025], [{ cif: "P2508600J", any: 2025, import: 0 }], territori);
    expect(perAjuntament.find((p) => p.municipalityId === 20)?.imports).toEqual([0]);
  });
});

describe("topConvocatories", () => {
  it("plega pel títol, ordena per import i en deixa les primeres", () => {
    const files = [
      { titol: "Pla despesa corrent  per a ens locals", import: 100, concessions: 1 },
      { titol: "Pla despesa corrent per a ens locals", import: 50.5, concessions: 2 },
      { titol: "Convocatoria secretaris 2025", import: 120, concessions: 3 },
      { titol: null, import: 5, concessions: 1 },
      { titol: "B", import: 10, concessions: 1 },
      { titol: "A", import: 10, concessions: 1 },
    ];
    expect(topConvocatories(files, 4)).toEqual([
      { titol: "Pla despesa corrent per a ens locals", import: 150.5, concessions: 3 },
      { titol: "Convocatoria secretaris 2025", import: 120, concessions: 3 },
      { titol: "A", import: 10, concessions: 1 },
      { titol: "B", import: 10, concessions: 1 },
    ]);
    expect(topConvocatories(files).at(-1)).toEqual({ titol: "(convocatòria sense títol al RAISC)", import: 5, concessions: 1 });
  });
});

describe("consultes", () => {
  it("agrega al servidor i filtra pels anys i pel patró de CIF d'ajuntament", () => {
    const c = consultaPerAjuntament([2023, 2024, 2025]);
    expect(c.select).toContain("sum(import_subvenci_pr_stec_ajut)");
    expect(c.select).toContain("count(*)");
    expect(c.where).toContain("administraci_codi in ('002','003')");
    expect(c.where).toContain("data_concessi >= '2023-01-01T00:00:00' AND data_concessi < '2026-01-01T00:00:00'");
    expect(c.where).toContain(PATRO_AJUNTAMENT);
    expect(PATRO_AJUNTAMENT).toContain("cif_beneficiari like 'P25___00_'");
    expect(consultaTotals([2025], true).where).toContain("cif_beneficiari = 'Benef. no publicable'");
  });

  it("munta una URL paginada i ordenada pels camps agrupats", () => {
    const url = new URL(urlConsulta("s9xt-n979", consultaTotals([2025]), 5000, 10000));
    expect(url.pathname).toBe("/resource/s9xt-n979.json");
    expect(url.searchParams.get("$group")).toBe("concedent, adscripcio, any");
    expect(url.searchParams.get("$order")).toBe("concedent, adscripcio, any");
    expect(url.searchParams.get("$limit")).toBe("5000");
    expect(url.searchParams.get("$offset")).toBe("10000");
  });
});
