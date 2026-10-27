import { describe, expect, it } from "vitest";
import {
  anysSerie,
  clauComarca,
  codi10,
  consultaContractes,
  grupProcediment,
  llegeixFilaContractes,
  nomTipus,
  numero,
  personesDeLaFila,
  plegaAbss,
  plegaContractes,
  resolArea,
  sadDeLaFila,
  PROCEDIMENTS,
  SSB_PERSONES,
  SSB_SAD,
  type CatalegAbss,
  type FilaContractes,
  type FilaSsb,
} from "./j42-serveis-ens";

// Codis reals del registre d'ens (6nei-4b44), comprovats el 27-10-2026.
const BAGES = "8100750006";
const BAIX_CAMP = "8100810007";
const OSONA = "8102490004";
const GARROTXA = "8101920002";
const ARAN = "8103980001";
const MARTORELL = "0811410007";
const CAS_GARROTXA = "9801810007";
const LA_PLANA = "9002350006";

const cataleg: CatalegAbss = {
  municipis: new Set([MARTORELL, "0801930008"]),
  consellPerClau: new Map([
    ["bages", BAGES],
    ["baix camp", BAIX_CAMP],
    ["osona", OSONA],
    ["garrotxa", GARROTXA],
    ["pla estany", "8102870005"],
  ]),
  altresEns: new Map([
    [CAS_GARROTXA, { nom: "Consorci d'Acció Social de la Garrotxa", codiComarca: GARROTXA }],
    [LA_PLANA, { nom: "Mancomunitat Intermunicipal Voluntària La Plana", codiComarca: OSONA }],
  ]),
};

const fila = (codi: string, nom: string, any: number, camps: Record<string, string> = {}): FilaSsb => ({
  codi_idescat_eacat: codi,
  nom_ens_local: nom,
  any: String(any),
  ...camps,
});

describe("llegir una fila", () => {
  it("torna el codi de 10 xifres que la font escapça als municipis de Barcelona", () => {
    expect(codi10("801930008")).toBe("0801930008");
    expect(codi10(" 8100170005 ")).toBe("8100170005");
    expect(codi10("None")).toBe("");
  });

  it("no inventa números: buit, text i negatius són null", () => {
    expect(numero("")).toBeNull();
    expect(numero(undefined)).toBeNull();
    expect(numero("abc")).toBeNull();
    expect(numero("-3")).toBeNull();
    expect(numero("1813.21")).toBe(1813.21);
  });

  it("suma els sexes informats i un camp absent no és un zero", () => {
    expect(personesDeLaFila(fila(BAGES, "Bages", 2021, { homes: "2000", dones: "3000" }))).toEqual({ persones: 5000, zero: false });
    expect(personesDeLaFila(fila(BAGES, "Bages", 2021))).toEqual({ persones: null, zero: false });
  });

  it("llegeix com a no informada una fila amb zero persones a tots els sexes (Martorell 2023)", () => {
    expect(personesDeLaFila(fila(MARTORELL, "Martorell", 2023, { homes: "0", dones: "0", no_binaris: "0" }))).toEqual({
      persones: null,
      zero: true,
    });
  });

  it("separa el SAD social del de dependència i arrodoneix les hores", () => {
    const sad = sadDeLaFila(
      fila(BAGES, "Bages", 2021, {
        atenci_social_homes: "11",
        atenci_social_dones: "25",
        hores_d_atenci_social_homes: "973.67",
        hores_d_atenci_social_dones: "3288.43",
        atenci_a_la_depend_ncia_homes: "8",
        atenci_a_la_depend_ncia_dones: "20",
        hores_d_atenci_a_la_depend: "2172",
        hores_d_atenci_a_la_depend_1: "2627.62",
      }),
    );
    expect(sad.sadSocial).toEqual({ persones: 36, hores: 4262 });
    expect(sad.sadDependencia).toEqual({ persones: 28, hores: 4800 });
    expect(sad.zero).toBe(false);
  });

  it("respecta el zero d'una sola modalitat però no una fila de SAD tota a zero", () => {
    const aran = sadDeLaFila(fila(ARAN, "Aran", 2022, { atenci_social_homes: "14", atenci_a_la_depend_ncia_homes: "0" }));
    expect(aran.sadSocial.persones).toBe(14);
    expect(aran.sadDependencia.persones).toBe(0);
    const tot = sadDeLaFila(fila(MARTORELL, "Martorell", 2023, { atenci_social_homes: "0", hores_d_atenci_social_homes: "0" }));
    expect(tot).toEqual({ sadSocial: { persones: null, hores: null }, sadDependencia: { persones: null, hores: null }, zero: true });
  });

  it("fa la sèrie del 2018 a l'últim any, i cap si l'últim és abans", () => {
    expect(anysSerie(2024)).toEqual([2018, 2019, 2020, 2021, 2022, 2023, 2024]);
    expect(anysSerie(2017)).toEqual([]);
  });
});

describe("de qui és cada fila", () => {
  it("fa la mateixa clau per al nom de la font i per al del consell", () => {
    expect(clauComarca("Pla de l'Estany")).toBe("pla estany");
    expect(clauComarca("CAS Garrotxa")).toBe("garrotxa");
    expect(clauComarca("CBS Ripollès")).toBe("ripolles");
    expect(clauComarca("Sant Adrià de Besòs")).toBe("sant adria besos");
  });

  it("als municipis mana el codi", () => {
    expect(resolArea(fila("811410007", "Martorell", 2024), cataleg)).toEqual({ mena: "municipi", codiEns: MARTORELL });
  });

  it("als consells mana el nom: el 2022 al codi del Bages hi ha el Baix Camp", () => {
    expect(resolArea(fila(BAGES, "Baix Camp", 2022), cataleg)).toEqual({
      mena: "consell",
      codiEns: BAIX_CAMP,
      gestor: null,
      codiNoQuadra: true,
    });
    expect(resolArea(fila(BAGES, "Bages", 2021), cataleg)).toMatchObject({ codiEns: BAGES, codiNoQuadra: false });
  });

  it("posa l'àrea d'un consorci al consell de la comarca, dient qui la gestiona", () => {
    expect(resolArea(fila(CAS_GARROTXA, "CAS Garrotxa", 2019), cataleg)).toEqual({
      mena: "consell",
      codiEns: GARROTXA,
      gestor: { codiEns: CAS_GARROTXA, nom: "Consorci d'Acció Social de la Garrotxa" },
      codiNoQuadra: false,
    });
  });

  it("deixa a part una mancomunitat que no porta el nom de la comarca", () => {
    expect(resolArea(fila(LA_PLANA, "Mancomunitat Intermunicipal Voluntària La Plana", 2024), cataleg)).toEqual({
      mena: "altra",
      codiEns: LA_PLANA,
      nom: "Mancomunitat Intermunicipal Voluntària La Plana",
      consell: OSONA,
    });
  });

  it("l'Aran i els codis desconeguts queden fora, amb el motiu", () => {
    expect(resolArea(fila(ARAN, "Conselh Generau d'Aran", 2021), cataleg).mena).toBe("fora");
    expect(resolArea(fila("9999999999", "Qui sap", 2021), cataleg)).toMatchObject({ mena: "fora" });
    expect(resolArea(fila("", "Sense codi", 2021), cataleg)).toMatchObject({ mena: "fora" });
  });
});

describe("plegar les àrees bàsiques", () => {
  const anys = [2021, 2022, 2023];

  it("fa una sèrie per àrea amb tots els anys, i un any sense fila queda buit", () => {
    const r = plegaAbss(anys, [fila(BAGES, "Bages", 2021, { homes: "10", dones: "20" })], [], cataleg);
    const bages = r.arees.get(BAGES)!;
    expect(bages.mena).toBe("consell");
    expect(bages.anys.map((a) => a.any)).toEqual(anys);
    expect(bages.anys.map((a) => a.persones)).toEqual([30, null, null]);
    expect(bages.anys[1]!.sadSocial).toEqual({ persones: null, hores: null });
  });

  it("ajunta persones i SAD de la mateixa àrea i any, i ignora els anys de fora", () => {
    const r = plegaAbss(
      anys,
      [fila("811410007", "Martorell", 2022, { homes: "2180", dones: "2613" }), fila("811410007", "Martorell", 2017, { homes: "1" })],
      [fila("811410007", "Martorell", 2022, { atenci_a_la_depend_ncia_dones: "91" })],
      cataleg,
    );
    const a = r.arees.get(MARTORELL)!.anys[1]!;
    expect(a.persones).toBe(4793);
    expect(a.sadDependencia.persones).toBe(91);
    expect(r.arees.get(MARTORELL)!.mena).toBe("municipi");
  });

  it("marca el zero llegit com a buit i el codi que no quadra", () => {
    const r = plegaAbss(
      anys,
      [fila(BAGES, "Baix Camp", 2022, { homes: "8000", dones: "610" }), fila(BAIX_CAMP, "Baix Camp", 2023, { homes: "0", dones: "0" })],
      [],
      cataleg,
    );
    const baixCamp = r.arees.get(BAIX_CAMP)!.anys;
    expect(baixCamp[1]).toMatchObject({ persones: 8610, codiNoQuadra: true, zeroLlegitComBuit: false });
    expect(baixCamp[2]).toMatchObject({ persones: null, zeroLlegitComBuit: true, codiNoQuadra: false });
    expect(r.incidencies.codiNoQuadra).toEqual([{ conjunt: SSB_PERSONES, any: 2022, codi: BAGES, nom: "Baix Camp", consell: BAIX_CAMP }]);
    expect(r.arees.has(BAGES)).toBe(false);
  });

  it("es queda la primera de dues files repetides i ho anota", () => {
    const r = plegaAbss(anys, [], [fila(MARTORELL, "Martorell", 2023, { atenci_social_homes: "5" }), fila(MARTORELL, "Martorell", 2023, { atenci_social_homes: "9" })], cataleg);
    expect(r.arees.get(MARTORELL)!.anys[2]!.sadSocial.persones).toBe(5);
    expect(r.incidencies.repetides).toEqual([{ conjunt: SSB_SAD, any: 2023, area: MARTORELL }]);
  });

  it("si persones diu que és el consell i el SAD diu un consorci, mana persones", () => {
    const osonaCat = {
      ...cataleg,
      altresEns: new Map([...cataleg.altresEns, ["9822340003", { nom: "Consorci d'Osona de Serveis Socials", codiComarca: OSONA }]]),
    };
    const r = plegaAbss(
      anys,
      [fila("8102340003", "Osona", 2022, { homes: "4395", dones: "5623" })],
      [fila("9822340003", "Osona", 2022, { atenci_social_homes: "100" }), fila("9822340003", "Osona", 2023, { atenci_social_homes: "90" })],
      osonaCat,
    );
    const osona = r.arees.get(OSONA)!.anys;
    expect(osona[1]).toMatchObject({ persones: 10018, gestor: null, codiNoQuadra: true });
    expect(osona[1]!.sadSocial.persones).toBe(100);
    // Sense fila de persones, el gestor el diu el SAD.
    expect(osona[2]!.gestor).toEqual({ codiEns: "9822340003", nom: "Consorci d'Osona de Serveis Socials" });
  });

  it("guarda el gestor any per any i les altres àrees de la comarca amb l'últim any informat", () => {
    const r = plegaAbss(
      anys,
      [
        fila(OSONA, "Osona", 2021, { homes: "3192", dones: "3875" }),
        fila("9822340003", "Osona", 2023, { homes: "2742", dones: "3421" }),
        fila(LA_PLANA, "Mancomunitat Intermunicipal Voluntària La Plana", 2021, { homes: "1276", dones: "1979" }),
        fila(LA_PLANA, "Mancomunitat Intermunicipal Voluntària La Plana", 2023),
      ],
      [],
      {
        ...cataleg,
        altresEns: new Map([...cataleg.altresEns, ["9822340003", { nom: "Consorci d'Osona de Serveis Socials", codiComarca: OSONA }]]),
      },
    );
    const osona = r.arees.get(OSONA)!.anys;
    expect(osona[0]!.gestor).toBeNull();
    expect(osona[2]!.gestor).toEqual({ codiEns: "9822340003", nom: "Consorci d'Osona de Serveis Socials" });
    expect(r.altres.get(OSONA)).toEqual([
      { codiEns: LA_PLANA, nom: "Mancomunitat Intermunicipal Voluntària La Plana", any: 2021, persones: 3255 },
    ]);
  });
});

describe("contractes", () => {
  it("agrupa els procediments com els escriu el registre", () => {
    expect(grupProcediment("Obert")).toBe("obert");
    expect(grupProcediment("Obert simplificat")).toBe("obert");
    expect(grupProcediment("Menor")).toBe("menor");
    expect(grupProcediment(null, "menor")).toBe("menor");
    expect(grupProcediment("Negociat sense publicitat")).toBe("negociat");
    expect(grupProcediment("Licitació amb negociació")).toBe("negociat");
    expect(grupProcediment("Basat en acord marc")).toBe("acordMarc");
    expect(grupProcediment("Específic de sistema dinàmic de contractació")).toBe("acordMarc");
    expect(grupProcediment("Restringit")).toBe("altres");
    expect(grupProcediment("Contractes d'emergències")).toBe("altres");
    expect(grupProcediment(undefined)).toBe("altres");
  });

  it("escriu els tipus com cal", () => {
    expect(nomTipus("5. SERVEIS")).toBe("Serveis");
    expect(nomTipus("8. CONCESSIÓ DE SERVEIS")).toBe("Concessió de serveis");
    expect(nomTipus("10. PRIVAT D'ADMINISTRACIO PUBLICA")).toBe("Privat de l'Administració");
    expect(nomTipus("12. ALGUNA COSA NOVA")).toBe("Alguna cosa nova");
    expect(nomTipus(null)).toBe("Sense tipus");
  });

  it("no demana mai l'adjudicatari i deixa fora els lots deserts", () => {
    const c = consultaContractes(["8000840003", "8100170005"], 2021, 2026);
    expect(`${c.select} ${c.where} ${c.group}`).not.toMatch(/adjudicatari/);
    expect(c.where).toContain("id_organisme_contractant in ('8000840003','8100170005')");
    expect(c.where).toContain("lot_desert");
    expect(c.where).toContain("exercici >= 2021 AND exercici <= 2026");
  });

  it("llegeix una suma i no posa import si cap fila no en porta", () => {
    expect(llegeixFilaContractes({ ens: "8100170005", any: "2025", contractes: "3", import: "1000.5", amb_import: "3", procediment: "Obert" })).toMatchObject({
      ens: "8100170005",
      any: 2025,
      contractes: 3,
      import: 1000.5,
      ambImport: 3,
    });
    expect(llegeixFilaContractes({ ens: "8100170005", any: "2025", contractes: "2", amb_import: "0" })!.import).toBeNull();
    expect(llegeixFilaContractes({ any: "2025", contractes: "2" })).toBeNull();
  });

  const f = (any: number, procediment: string, tipus: string, contractes: number, imp: number | null, ambImport = imp === null ? 0 : contractes): FilaContractes => ({
    ens: "8100170005",
    any,
    situacio: procediment === "Menor" ? "menor" : "adjudicació",
    procediment,
    tipus,
    contractes,
    import: imp,
    ambImport,
  });

  it("plega per any amb els cinc procediments sempre presents i els tipus per import", () => {
    const anys = plegaContractes(
      [
        f(2025, "Obert", "5. SERVEIS", 2, 300_000),
        f(2025, "Menor", "3. SUBMINISTRAMENTS", 40, 120_000.3),
        f(2025, "Menor", "5. SERVEIS", 10, 50_000.2),
        f(2025, "Restringit", "8. CONCESSIÓ DE SERVEIS", 1, 1_000),
        f(2026, "Menor", "5. SERVEIS", 4, null),
      ],
      2026,
    );
    expect(anys.map((a) => a.any)).toEqual([2025, 2026]);
    const a = anys[0]!;
    expect(a).toMatchObject({ complet: true, contractes: 53, import: 471_000.5, senseImport: 0, procedimentsAltres: ["Restringit"] });
    expect(a.perProcediment.map((p) => p.procediment)).toEqual([...PROCEDIMENTS]);
    expect(a.perProcediment.find((p) => p.procediment === "menor")).toEqual({ procediment: "menor", contractes: 50, import: 170_000.5 });
    expect(a.perProcediment.find((p) => p.procediment === "negociat")).toEqual({ procediment: "negociat", contractes: 0, import: 0 });
    expect(a.perTipus.map((t) => t.tipus)).toEqual(["Serveis", "Subministraments", "Concessió de serveis"]);
    expect(anys[1]).toMatchObject({ complet: false, contractes: 4, import: null, senseImport: 4 });
  });

  it("sense cap fila, cap any", () => {
    expect(plegaContractes([], 2026)).toEqual([]);
  });
});
