import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/*
 * El repartiment el calcula `derive/escons-ens.ts` (un altre carril) i aquí no
 * es prova: només que se li passa el que toca. Per això se'n fa un doble que
 * retorna el que ha rebut. El prefix de la J39 tampoc no és d'aquest fitxer.
 *
 * L'excepció són les proves de regressió de les claus de partit (al final del
 * fitxer): els errors que vigilen —un escó del districte d'Igualada que
 * canviava de Junts a ERC, cinc consellers de la Selva sense llista— només es
 * veuen amb el D'Hondt de debò. Mentre `calculReal.actiu` és cert, el doble
 * passa la crida al mòdul real.
 */
const calculReal = vi.hoisted(() => ({ actiu: false }));
vi.mock("../derive/escons-ens", async (importOriginal) => {
  const real = await importOriginal<typeof import("../derive/escons-ens")>();
  return {
    seientsDiputacio: (pob: number) => (calculReal.actiu ? real.seientsDiputacio(pob) : pob > 1_000_000 ? 31 : 25),
    seientsConsell: (pob: number) => (calculReal.actiu ? real.seientsConsell(pob) : 19),
    repartimentDiputacio: (...args: Parameters<typeof real.repartimentDiputacio>) => {
      if (calculReal.actiu) return real.repartimentDiputacio(...args);
      const [districtes, total, reals] = args;
      return {
        files: [],
        districtes: [],
        quadra: false,
        diferencies: [JSON.stringify({ districtes, total, reals: reals ? [...reals] : null })],
      };
    },
    repartimentConsell: (...args: Parameters<typeof real.repartimentConsell>) => {
      if (calculReal.actiu) return real.repartimentConsell(...args);
      const [municipis, reals] = args;
      return {
        files: [],
        districtes: null,
        quadra: false,
        diferencies: [JSON.stringify({ municipis, reals: reals ? [...reals] : null })],
      };
    },
  };
});
vi.mock("../jobs/j39-subvencions-ens", () => ({ PREFIX_KIND_SUBVENCIONS: "subvencionsEns:" }));

import {
  SENSE_PARTIT,
  aparellaUnic,
  clausDeNom,
  colorDePartit,
  composicioDe,
  construeixEns,
  ensDeMunicipi,
  esEnsDesat,
  ordenaEns,
  partitComparable,
  partitDelResultat,
  pleDe,
  repartimentDe,
  retribucioDe,
  reconciliaDesconeguts,
  clauDelResultat,
  reparaApostrof,
  ambitDelCalcul,
  avisaPadroActual,
  colorSegur,
  diuQueNoCobra,
  grupDe,
  personaDelPle,
  poblacioDeLaConvocatoria,
  ultimaDespesa,
  slugEns,
  subvencionsDe,
  territoriDe,
  votsPerMunicipi,
  type ContextEns,
  type MunicipiBase,
} from "./ens-dades";
import type { DadesEns, EnsDesat, MembreDesat } from "./ens-tipus";
import { NOM_NO_PUBLICAT } from "../jobs/j38-ens-supramunicipals";

describe("partitComparable", () => {
  it("ajunta les maneres d'escriure el mateix partit", () => {
    expect(partitComparable("ERC-AM")).toEqual({ clau: "ERC", familia: "erc" });
    expect(partitComparable("ERC")).toEqual({ clau: "ERC", familia: "erc" });
    expect(partitComparable("Esquerra Republicana de Catalunya")).toEqual({ clau: "ERC", familia: "erc" });
    expect(partitComparable("AM")?.clau).toBe("ERC");
    expect(partitComparable("PSC-CP")?.clau).toBe("PSC");
    expect(partitComparable("Junts per Catalunya")?.clau).toBe("Junts");
  });

  it("una llista local es queda amb les seves sigles", () => {
    expect(partitComparable("  TxT ")).toEqual({ clau: "TxT", familia: null });
  });

  it("si la font no diu res, és null i no una fila buida", () => {
    expect(partitComparable(null)).toBeNull();
    expect(partitComparable("")).toBeNull();
    expect(partitComparable(" - ")).toBeNull();
    // «No adscrita» i «N/A» tenen nom però cap partit: compten com a desconeguts.
    expect(partitComparable("No adscrita")).toBeNull();
    expect(partitComparable("N/A")).toBeNull();
  });

  /*
   * Les vint etiquetes literals de la Diputació de Barcelona (ple municipal de
   * cada diputat, 27-10-2026) i les de Girona i Lleida: totes han de caure a la
   * família del seu sufix paraigua.
   */
  it("resol cada etiqueta de coalició del 2023 pel sufix paraigua", () => {
    const claus = (etiquetes: string[]) => etiquetes.map((e) => partitComparable(e)?.clau);
    expect(claus(["PSC-CP", "CP", "UA-PSC-CP"])).toEqual(["PSC", "PSC", "PSC"]);
    expect(claus(["TriasxBCN-CM", "CM", "JperSC-CM", "JXF-CM", "JxLF", "JUNTS-IMPULSEM", "TriasxBCN"])).toEqual(
      Array(7).fill("Junts"),
    );
    expect(
      claus(["ERC-AM", "ERC - AM", "ERC-I-AM", "ERC+SxA - AM", "ENTESA - AM", "Aramoià - AM", "TSCapolat - AM",
        "ERC-EUiA-AM", "+CASTELLFOLL-AM", "ERC - GIR - AM"]),
    ).toEqual(Array(10).fill("ERC"));
    expect(claus(["BCN en Comú - C", "MOVEM ECP - C", "BComúP - C", "BComú", "LHECP-C", "C"])).toEqual(Array(6).fill("Comuns"));
    expect(claus(["ACR- SP-AMUNT", "CUP-ALL- AMUNT", "SP-CUP-AM"])).toEqual(["CUP", "CUP", "CUP"]);
    expect(claus(["TSF-TE", "EA - IdSELVA", "UNITAT D'ARAN", "ARA PL"])).toEqual([
      "Tots per l'Empordà", "Independents de la Selva", "PSC", "PDeCAT",
    ]);
    expect(claus(["TxT", "VOX", "PP"])).toEqual(["TxT", "Vox", "PP"]);
  });

  it("un «AM» sol és la CUP si el mateix ple ja escriu ERC d'una altra manera", () => {
    expect(partitComparable("AM", ["ERC", "AM", "PSC"])?.clau).toBe("CUP");
    expect(partitComparable("AM", ["AM", "PSC"])?.clau).toBe("ERC");
    expect(grupDe(null)).toBe(SENSE_PARTIT);
    expect(grupDe("Aramoià - AM")).toBe("ERC");
  });
});

describe("colorDePartit", () => {
  it("és el color de dada de la família, amb el groc de la CUP enfosquit", () => {
    expect(colorDePartit(partitComparable("ERC"))).toBe("#ffb232");
    expect(colorDePartit(partitComparable("CUP-AMUNT"))).toBe("#d8d000");
  });

  it("una llista local no en té", () => {
    expect(colorDePartit(partitComparable("TxT"))).toBeNull();
    expect(colorDePartit(null)).toBeNull();
  });
});

describe("composicioDe", () => {
  it("compta per partit comparable, de més a menys, i deixa els desconeguts al final", () => {
    const files = composicioDe([
      { partit: "ERC-AM" },
      { partit: "Esquerra Republicana" },
      { partit: null },
      { partit: "PSC-CP" },
      { partit: "ERC" },
      { partit: "TxT" },
      { partit: "PSC" },
    ]);
    expect(files.map((f) => [f.partit, f.seients])).toEqual([
      ["ERC", 3],
      ["PSC", 2],
      ["TxT", 1],
      [SENSE_PARTIT, 1],
    ]);
    expect(files[0]!.color).toBe("#ffb232");
    expect(files.at(-1)!.color).toBeNull();
  });

  it("sense membres no hi ha composició", () => {
    expect(composicioDe([])).toEqual([]);
  });
});

describe("clausDeNom i aparellaUnic", () => {
  it("prova també el nom girat quan la font escriu «COGNOMS, NOM»", () => {
    expect(clausDeNom("PUIG ROCA, Joan")).toEqual(["puig roca joan", "joan puig roca"]);
  });

  it("lliga amb una sola persona, encara que la font l'escrigui en majúscules i amb «(Ind.)»", () => {
    const ple = [{ nom: "Joan Puig i Roca" }, { nom: "Maria Vidal Soler" }];
    expect(aparellaUnic("JOAN PUIG ROCA (Ind.)", ple)).toBe(ple[0]);
    expect(aparellaUnic("Puig Roca, Joan", ple)).toBe(ple[0]);
  });

  it("si el nom és de dues persones, no és de cap", () => {
    const ple = [{ nom: "Joan Puig Roca" }, { nom: "JOAN PUIG ROCA" }];
    expect(aparellaUnic("Joan Puig Roca", ple)).toBeNull();
    expect(aparellaUnic("Pere Serra", ple)).toBeNull();
    expect(aparellaUnic("", ple)).toBeNull();
  });
});

describe("pleDe", () => {
  it("amb seu electrònica, l'adreça és la de `adrecesRegidors` i la cara la petita", () => {
    const ple = pleDe(
      [
        { nom: "Anna Roca", foto: "/f/anna.jpg", fotoPetita: "/f/anna-160.jpg" },
        { nom: "Anna Roca", foto: null, fotoPetita: null },
        { nom: "Pere Pou", foto: "/f/pere.jpg", fotoPetita: null },
      ],
      [{ nom: "Algú del registre" }],
    );
    expect(ple.map((p) => [p.adreca, p.foto])).toEqual([
      ["regidor/anna-roca/", "/f/anna-160.jpg"],
      ["regidor/anna-roca-2/", null],
      ["regidor/pere-pou/", "/f/pere.jpg"],
    ]);
  });

  it("amb el registre d'electes, un slug repetit no té adreça segura", () => {
    const ple = pleDe(null, [{ nom: "Anna Roca" }, { nom: "ANNA ROCA" }, { nom: "Pere Pou" }]);
    expect(ple.map((p) => p.adreca)).toEqual([null, null, "regidor/pere-pou/"]);
    expect(ple.every((p) => p.foto === null)).toBe(true);
  });
});

const font = { nom: "Seu-e", url: "https://exemple.cat", llicencia: "CC BY 4.0", consultat: "2026-10-01" };
const carrecRetribuit = (ens: string, anual: number | null, sostre: number | null = null) => ({
  ens, carrec: "Diputat", dedicacio: anual === null ? null : "exclusiva",
  retribucioAnualBruta: anual, maximPerAssistencies: sostre, motiu: anual === null ? "sense dedicació" : null, font,
});

describe("retribucioDe", () => {
  const diputacio = { tipus: "diputacio" as const, nom: "Diputació de Lleida", territori: "Lleida" };
  const consell = { tipus: "consell" as const, nom: "Consell Comarcal de l'Urgell", territori: "Urgell" };

  it("pren el sou de la diputació que paga, amb el sostre a part i mai com a import", () => {
    const metrica = { persones: [{ nom: "Joan Puig Roca", diputacio: carrecRetribuit("Diputació de Lleida", null, 6000) }] };
    expect(retribucioDe(diputacio, "JOAN PUIG ROCA", metrica)).toEqual({
      anualBrut: null, dedicacio: null, sostreAssistencies: 6000, motiu: "sense dedicació", font,
    });
  });

  it("no confon el càrrec al consell amb el de la diputació", () => {
    const metrica = { persones: [{ nom: "Joan Puig Roca", consell: carrecRetribuit("Consell Comarcal de l'Urgell", 30000) }] };
    expect(retribucioDe(diputacio, "Joan Puig Roca", metrica)).toBeNull();
    expect(retribucioDe(consell, "Joan Puig Roca", metrica)?.anualBrut).toBe(30000);
  });

  it("accepta un nom d'ens escrit d'una altra manera si acaba amb el territori", () => {
    const metrica = { persones: [{ nom: "Joan Puig Roca", consell: carrecRetribuit("CC Urgell", 12000) }] };
    expect(retribucioDe(consell, "Joan Puig Roca", metrica)?.anualBrut).toBe(12000);
  });

  it("un nom repetit o una mètrica illegible no donen sou", () => {
    const dos = { persones: [
      { nom: "Joan Puig Roca", diputacio: carrecRetribuit("Diputació de Lleida", 1) },
      { nom: "JOAN PUIG ROCA", diputacio: carrecRetribuit("Diputació de Lleida", 2) },
    ] };
    expect(retribucioDe(diputacio, "Joan Puig Roca", dos)).toBeNull();
    expect(retribucioDe(diputacio, "Joan Puig Roca", null)).toBeNull();
    expect(retribucioDe(diputacio, "Joan Puig Roca", { persones: "no" })).toBeNull();
  });
});

const muni = (id: number, nom: string, comarca: string | null, ine5: string, poblacio: number | null): MunicipiBase => ({
  id, slug: nom.toLowerCase().replace(/[^a-z]+/g, "-"), nom, comarca, provincia: null, ine5, poblacio,
});
const BASE: MunicipiBase[] = [
  muni(1, "Valls", "Alt Camp", "43161", 25000),
  muni(2, "Alcover", "Alt Camp", "43005", 5000),
  muni(3, "Reus", "Baix Camp", "43123", 107000),
  muni(4, "Manresa", "Bages", "08113", 78000),
];

describe("slugEns", () => {
  it("és el slug del territori, el mateix que fa `comarques.ts` per a la comarca", () => {
    expect(slugEns({ tipus: "consell", territori: "Alt Camp" })).toBe("alt-camp");
    expect(slugEns({ tipus: "consell", territori: "Pallars Jussà" })).toBe("pallars-jussa");
    expect(slugEns({ tipus: "diputacio", territori: "Barcelona" })).toBe("barcelona");
    expect(slugEns({ tipus: "consell", territori: "l'Alt Urgell" })).toBe("alt-urgell");
    expect(slugEns({ tipus: "consell", territori: "la Selva" })).toBe("selva");
    expect(slugEns({ tipus: "consell", territori: "Pla de l'Estany" })).toBe("pla-de-l-estany");
  });
});

describe("territoriDe", () => {
  it("un consell: els municipis de la comarca, la població i l'enllaç a la comarca", () => {
    const t = territoriDe({ tipus: "consell", territori: "l'Alt Camp", districtes: null }, BASE, [
      { municipalityId: 2 }, { municipalityId: 2 }, { municipalityId: null },
    ]);
    // Hi ha un membre sense municipi: a Valls no es pot afirmar un zero.
    expect(t.municipis.map((m) => [m.nom, m.membres])).toEqual([["Valls", null], ["Alcover", 2]]);
    const tots = territoriDe({ tipus: "consell", territori: "l'Alt Camp", districtes: null }, BASE, [
      { municipalityId: 2 }, { municipalityId: 2 },
    ]);
    expect(tots.municipis.map((m) => [m.nom, m.membres])).toEqual([["Valls", 0], ["Alcover", 2]]);
    expect(t.poblacio).toBe(30000);
    expect(t.comarca).toEqual({ slug: "alt-camp", nom: "Alt Camp" });
    expect(t.comarques).toEqual([]);
  });

  it("una diputació: la província pel codi INE, i les comarques de la demarcació", () => {
    const t = territoriDe({ tipus: "diputacio", territori: "Tarragona", districtes: null }, BASE, []);
    expect(t.municipis.map((m) => m.nom)).toEqual(["Reus", "Valls", "Alcover"]);
    expect(t.comarca).toBeNull();
    expect(t.comarques).toEqual([{ slug: "alt-camp", nom: "Alt Camp" }, { slug: "baix-camp", nom: "Baix Camp" }]);
  });

  it("si a un municipi li falta el padró, la població de l'àmbit no consta", () => {
    const base = [...BASE, muni(5, "Vilallonga", "Alt Camp", "43170", null)];
    expect(territoriDe({ tipus: "consell", territori: "Alt Camp", districtes: null }, base, []).poblacio).toBeNull();
  });
});

describe("ensDeMunicipi", () => {
  const ens = (tipus: DadesEns["tipus"], slugs: string[]) =>
    ({ tipus, municipis: slugs.map((slug) => ({ slug })) }) as unknown as DadesEns;
  it("troba el consell i la diputació que tenen el municipi a l'àmbit", () => {
    const llista = [ens("diputacio", ["valls", "reus"]), ens("consell", ["reus"]), ens("consell", ["valls"])];
    expect(ensDeMunicipi(llista, "valls")).toEqual({ diputacio: llista[0], consell: llista[2] });
    expect(ensDeMunicipi(llista, "manresa")).toEqual({ diputacio: null, consell: null });
  });
});

const PER_ID = new Map(BASE.map((m) => [m.id, m]));

describe("subvencionsDe", () => {
  it("resol cada ajuntament a la seva fitxa, conserva els buits i deixa fora el que no és a la base", () => {
    const s = subvencionsDe(
      {
        codiEns: "4300000000", ens: "Consell Comarcal de l'Alt Camp", anys: [2023, 2024],
        perAjuntament: [
          { municipalityId: 1, imports: [1000, null] },
          { municipalityId: 99, imports: [5, 5] },
          { municipalityId: 2, imports: [null, 250] },
        ],
        convocatories: [{ titol: "Pla de serveis", import: 1250, concessions: 2 }],
        agenciesExcloses: ["Organisme X"],
        font,
      },
      PER_ID,
    );
    expect(s?.anys).toEqual([2023, 2024]);
    expect(s?.perMunicipi).toEqual([
      { slug: "alcover", nom: "Alcover", poblacio: 5000, imports: [null, 250] },
      { slug: "valls", nom: "Valls", poblacio: 25000, imports: [1000, null] },
    ]);
    expect(s?.convocatories).toHaveLength(1);
    expect(s?.agenciesExcloses).toEqual(["Organisme X"]);
    expect(s?.font).toBe(font);
  });

  it("sense dades de la J39 no hi ha bloc", () => {
    expect(subvencionsDe(null, PER_ID)).toBeNull();
  });
});

describe("vots del 2023", () => {
  it("la clau del resultat és la de la composició, i mana el codi d'agrupació", () => {
    expect(partitDelResultat("CSLLM-AM", "erc")).toBe("ERC");
    expect(partitDelResultat("ERC-AM", null)).toBe("ERC");
    expect(partitDelResultat("TE-XTU", "local")).toBe("TE-XTU");
    expect(partitDelResultat("IPV", null)).toBe("IPV");
    // Sense marca, les sigles de l'agrupació ajunten la coalició.
    expect(partitDelResultat("TFS-TE", "local", "TE")).toBe("Tots per l'Empordà");
    expect(partitDelResultat("UA-PSC-CP", "psc", "PSC-CP")).toBe("PSC");
    expect(partitDelResultat("SOM-IdSELVA", "local", "IdLS")).toBe("Independents de la Selva");
    expect(partitDelResultat("Cs", "cs", "Cs")).toBe("Ciutadans");
    // «ALTRES» vol dir llista local.
    expect(partitDelResultat("JUNTS", "local", "ALTRES")).toBe("JUNTS");
    expect(partitDelResultat("JUNTS", null, "ALTRES")).toBe("JUNTS");
  });

  it("una agrupació que no és la marca d'una família és una candidatura a part, encara que el nom ho sembli", () => {
    // Ara Montbui: el sufix «-AM» no la fa d'ERC.
    expect(partitDelResultat("AM-LVDVDM", "local", "AM-LVDVDM")).toBe("AM-LVDVDM");
    // Junts per Tiana i Junts per Sant Feliu de Codines són agrupacions d'electors.
    expect(partitDelResultat("JUNTS", "local", "JUNTS")).toBe("JUNTS");
    expect(partitDelResultat("JUNTS per SFC", "local", "JUNTS per SFC")).toBe("JUNTS per SFC");
    // La CUP del Figueró es va inscriure a part de l'agrupació AMUNT.
    expect(partitDelResultat("TXF", "local", "CUP-AMUNT")).toBe("CUP-AMUNT");
    // Les marques de debò, sí.
    expect(partitDelResultat("JxI-CM", "junts", "CM")).toBe("Junts");
    expect(partitDelResultat("ERC-AM", "erc", "AM")).toBe("ERC");
  });

  it("hi posa els blancs i els nuls del municipi", () => {
    const vots = votsPerMunicipi(
      [{ municipalityId: 1, sigles: "ERC-AM", brandId: "erc", vots: 900, regidors: 9, candidats: null }],
      PER_ID,
      new Map([[1, { blancs: 30, nuls: 12 }]]),
    );
    expect(vots.get(1)).toMatchObject({ blancs: 30, nuls: 12 });
  });

  it("fa servir el padró del 2022 i diu quins municipis s'han quedat amb el d'avui", () => {
    const { poblacions, ambPadroActual } = poblacioDeLaConvocatoria(PER_ID, new Map([[1, 24_000]]));
    expect(poblacions.get(1)).toEqual({ poblacio: 24_000 });
    expect(poblacions.get(2)).toEqual({ poblacio: PER_ID.get(2)!.poblacio });
    expect(ambPadroActual.has(1)).toBe(false);
    expect(ambPadroActual.has(2)).toBe(true);
    const r = { files: [], districtes: null, quadra: true, diferencies: [] };
    expect(avisaPadroActual(r, [{ id: 2 }], ambPadroActual)!.diferencies[0]).toMatch(/aproximat: per a un municipi/);
    expect(avisaPadroActual(r, [{ id: 1 }], ambPadroActual)).toBe(r);
  });

  it("agrupa per municipi, amb la població, i salta els que no tenen padró", () => {
    const base = new Map([...PER_ID, [5, muni(5, "Vilallonga", "Alt Camp", "43170", null)]]);
    const vots = votsPerMunicipi(
      [
        { municipalityId: 1, sigles: "ERC-AM", brandId: "erc", vots: 900, regidors: 9, candidats: 17 },
        { municipalityId: 1, sigles: "PSC-CP", brandId: "psc", vots: 600, regidors: 6, candidats: 17 },
        { municipalityId: 5, sigles: "ERC", brandId: "erc", vots: 10, regidors: 1, candidats: 3 },
      ],
      base,
    );
    expect([...vots.keys()]).toEqual([1]);
    expect(vots.get(1)).toEqual({
      municipalityId: 1,
      poblacio: 25000,
      blancs: null,
      nuls: null,
      candidatures: [
        { partit: "ERC", vots: 900, regidors: 9, candidats: 17 },
        { partit: "PSC", vots: 600, regidors: 6, candidats: 17 },
      ],
    });
  });
});

describe("repartimentDe", () => {
  const vots = votsPerMunicipi(
    [
      { municipalityId: 1, sigles: "ERC", brandId: "erc", vots: 900, regidors: 9, candidats: 17 },
      { municipalityId: 3, sigles: "PSC", brandId: "psc", vots: 9000, regidors: 12, candidats: 27 },
    ],
    PER_ID,
  );
  const composicio = composicioDe([{ partit: "ERC" }, { partit: "ERC" }, { partit: null }]);

  it("un consell: els vots de la comarca, i els escons reals sense la fila dels desconeguts", () => {
    const r = repartimentDe({ tipus: "consell", districtes: null }, [{ id: 1 }, { id: 2 }], vots, composicio, true);
    const rebut = JSON.parse(r!.diferencies[0]!);
    expect(rebut.municipis.map((m: { municipalityId: number }) => m.municipalityId)).toEqual([1]);
    expect(rebut.reals).toEqual([["ERC", 2]]);
  });

  it("sense noms al ple no hi ha escons reals amb què comparar", () => {
    const r = repartimentDe({ tipus: "consell", districtes: null }, [{ id: 1 }], vots, [], false);
    expect(JSON.parse(r!.diferencies[0]!).reals).toBeNull();
  });

  it("una diputació: un repartiment per districte, amb el total de la llei pels residents", () => {
    const districtes = [{ nom: "Valls", municipalityIds: [1, 2] }, { nom: "Reus", municipalityIds: [3] }];
    const r = repartimentDe({ tipus: "diputacio", districtes }, [], vots, composicio, true);
    const rebut = JSON.parse(r!.diferencies[0]!);
    expect(rebut.districtes.map((d: { nom: string; municipis: unknown[] }) => [d.nom, d.municipis.length])).toEqual([
      ["Valls", 1],
      ["Reus", 1],
    ]);
    expect(rebut.total).toBe(25);
  });

  it("sense districtes o sense vots no s'inventa cap repartiment", () => {
    expect(repartimentDe({ tipus: "diputacio", districtes: null }, [], vots, [], false)).toBeNull();
    expect(repartimentDe({ tipus: "consell", districtes: null }, [{ id: 4 }], vots, [], false)).toBeNull();
  });
});

describe("ordenaEns i esEnsDesat", () => {
  it("les diputacions primer i en l'ordre de sempre, després els consells de l'A a la Z", () => {
    const llista = [
      { tipus: "consell" as const, territori: "Urgell" },
      { tipus: "diputacio" as const, territori: "Tarragona" },
      { tipus: "consell" as const, territori: "Alt Camp" },
      { tipus: "diputacio" as const, territori: "Barcelona" },
      { tipus: "diputacio" as const, territori: "Lleida" },
      { tipus: "diputacio" as const, territori: "Girona" },
    ];
    expect(ordenaEns(llista).map((e) => e.territori)).toEqual([
      "Barcelona", "Girona", "Lleida", "Tarragona", "Alt Camp", "Urgell",
    ]);
  });

  it("no es refia d'un JSON qualsevol", () => {
    expect(esEnsDesat({ tipus: "consell", codiEns: "1", territori: "Bages", membres: [] })).toBe(true);
    expect(esEnsDesat({ tipus: "comarca", codiEns: "1", territori: "Bages", membres: [] })).toBe(false);
    expect(esEnsDesat(null)).toBe(false);
  });
});

describe("construeixEns", () => {
  const membre = (nom: string, rol: MembreDesat["rol"], partit: string | null, municipalityId: number | null, ordre: number | null): MembreDesat => ({
    nom, carrec: rol === "presidencia" ? "President" : "Conseller", rol, ordre, partit,
    partitFont: partit === null ? null : "ens", municipalityId, municipiFont: municipalityId === null ? null : "registre", alcaldia: false,
  });
  const desat: EnsDesat = {
    tipus: "consell", codiEns: "4300000000", nom: "Consell Comarcal de l'Alt Camp", territori: "Alt Camp", article: "l'Alt Camp",
    seuMunicipalityId: 1, cif: null, gerent: null, municat: null, web: null, seients: 19,
    membres: [
      membre("Pere Pou", "membre", "PSC-CP", 2, 3),
      membre("ANNA ROCA (Ind.)", "presidencia", "ERC-AM", 1, 1),
      membre("Algú Desconegut", "membre", null, null, null),
    ],
    finances: null, districtes: null, wikidata: null, escut: null, fonts: [], avisos: [], consultat: "2026-10-27",
  };
  const ctx: ContextEns = {
    municipis: PER_ID,
    plens: new Map([
      [1, pleDe([{ nom: "Anna Roca", foto: null, fotoPetita: "/f/anna.jpg" }], [])],
      [2, pleDe(null, [{ nom: "Pere Pou" }, { nom: "Pere Pou" }])],
    ]),
    sousDiputacions: new Map(),
    sousConsells: new Map([[1, { persones: [{ nom: "Anna Roca", consell: carrecRetribuit("Consell Comarcal de l'Alt Camp", 40000) }] }]]),
    vots2023: new Map(),
    subvencions: new Map(),
  };

  it("hi afegeix el que només sap el publicador, sense enllaçar cap nom dubtós", () => {
    const d = construeixEns(desat, ctx);
    expect(d.slug).toBe("alt-camp");
    expect(d.seu).toEqual({ slug: "valls", nom: "Valls" });
    expect(d.presidencia?.nom).toBe("ANNA ROCA (Ind.)");
    expect(d.membres.map((m) => m.nom)).toEqual(["ANNA ROCA (Ind.)", "Pere Pou", "Algú Desconegut"]);
    const [anna, pere, algu] = d.membres;
    expect(anna).toMatchObject({ municipi: { slug: "valls", nom: "Valls" }, adreca: "regidor/anna-roca/", foto: "/f/anna.jpg", color: "#ffb232" });
    expect(anna!.retribucio?.anualBrut).toBe(40000);
    // Dos «Pere Pou» al ple d'Alcover: ni adreça ni sou.
    expect(pere).toMatchObject({ municipi: { slug: "alcover", nom: "Alcover" }, adreca: null, retribucio: null });
    expect(algu).toMatchObject({ municipi: null, adreca: null, retribucio: null, color: null });
    expect("municipalityId" in anna!).toBe(false);
    expect(d.composicio.map((f) => f.partit)).toEqual(["ERC", "PSC", SENSE_PARTIT]);
    expect(d.comarca).toEqual({ slug: "alt-camp", nom: "Alt Camp" });
    expect(d.municipis.map((m) => [m.slug, m.membres])).toEqual([["valls", 1], ["alcover", 1]]);
    expect(d.repartiment).toBeNull();
    expect(d.subvencions).toBeNull();
    expect("seuMunicipalityId" in d).toBe(false);
  });

  /*
   * El Montsià: el registre de plens hi dona dos escons amb el partit i sense
   * nom, i la J38 els desa amb el nom buit (`NOM_NO_PUBLICAT`). Compten a la
   * composició del seu partit, però no són cap persona: ni fitxa, ni cara, ni
   * sou, encara que el registre en digui el municipi.
   */
  it("un escó amb partit i sense nom compta al seu partit i no s'aparella amb ningú", () => {
    const anonim: MembreDesat = { ...membre(NOM_NO_PUBLICAT, "membre", "ERC-AM", 1, 14), nomAlPle: null };
    const d = construeixEns({ ...desat, membres: [...desat.membres, anonim] }, ctx);
    const seient = d.membres.find((m) => m.nom === NOM_NO_PUBLICAT)!;
    expect(seient).toMatchObject({ municipi: { slug: "valls", nom: "Valls" }, adreca: null, foto: null, retribucio: null, grup: "ERC" });
    // ERC hi passa de 1 a 2 escons.
    expect(d.composicio.find((f) => f.partit === "ERC")?.seients).toBe(2);
    // I la presidenta continua sent qui era, amb la seva cara i el seu sou.
    expect(d.presidencia?.nom).toBe("ANNA ROCA (Ind.)");
    expect(d.presidencia?.retribucio?.anualBrut).toBe(40000);
  });
});

describe("el que se sap i el que no", () => {
  const fila = (partit: string, calc: number, real: number | null) => ({
    partit, vots: 0, regidors: 0, puntuacio: null, seientsCalculats: calc, seientsReals: real,
  });

  it("si les diferències són exactament els seients sense partit, quadra amb el que se sap", () => {
    // Barcelona abans d'arreglar els noms: el càlcul dona PSC 18 i Comuns 5; el
    // ple en té 14 i 4 coneguts, i hi ha 5 seients sense partit.
    const r = {
      files: [fila("PSC", 18, 14), fila("Junts", 12, 12), fila("Comuns", 5, 4)],
      districtes: null, quadra: false, diferencies: ["El càlcul dona 18 escons al PSC i el ple en té 14."],
    };
    const fet = reconciliaDesconeguts(r, 5);
    expect(fet.quadra).toBe(true);
    expect(fet.diferencies[0]).toBe("Quadra amb els 30 seients de partit conegut; dels altres 5, la font no diu de quin partit són.");
  });

  it("si algun partit en té més que el càlcul, o no sumen, la diferència és de debò", () => {
    const mes = { files: [fila("PSC", 18, 19), fila("ERC", 10, 8)], districtes: null, quadra: false, diferencies: ["x"] };
    expect(reconciliaDesconeguts(mes, 1)).toBe(mes);
    const noSuma = { files: [fila("PSC", 18, 14)], districtes: null, quadra: false, diferencies: ["x"] };
    expect(reconciliaDesconeguts(noSuma, 2)).toBe(noSuma);
  });

  it("repartimentDe compta com a desconeguts els seients sense nom ni partit", () => {
    const vots = votsPerMunicipi(
      [{ municipalityId: 1, sigles: "ERC", brandId: "erc", vots: 900, regidors: 9, candidats: null }],
      PER_ID,
    );
    const r = repartimentDe({ tipus: "consell", districtes: null, seients: 19 }, [{ id: 1 }],
      vots, [{ partit: "ERC", seients: 15, color: null }], true);
    // El doble del càlcul no quadra mai: el que importa és que no es perdi la fila d'ERC.
    expect(r!.diferencies[0]).toContain('"reals":[["ERC",15]]');
  });
});

describe("ultimaDespesa", () => {
  const cap = (capitol: number, liquidat: number | null) => ({ tipus: "despeses" as const, capitol, nom: "", liquidat, pressupostat: null });
  const ens = (anys: { any: number; capitols: ReturnType<typeof cap>[] }[], poblacio: number | null = 1000) =>
    ({ finances: { anys, programes: null, deute: [], fonts: [] }, poblacio, consultat: "2026-10-27" }) as unknown as DadesEns;

  it("suma els capítols 1 a 7, sense préstecs ni amortitzacions", () => {
    const d = ens([{ any: 2024, capitols: [cap(1, 100), cap(2, 50), cap(4, 30), cap(6, 20), cap(9, 500)] }]);
    expect(ultimaDespesa(d)).toEqual({ any: 2024, total: 200, perHabitant: 0.2, parcial: false });
  });

  it("salta l'any sense els tres capítols principals i marca parcial el que s'està tancant", () => {
    const d = ens([
      { any: 2023, capitols: [cap(1, 90), cap(2, 40), cap(3, 1), cap(4, 30)] },
      { any: 2024, capitols: [cap(1, 100), cap(2, 50), cap(3, 2), cap(4, 30)] },
      { any: 2025, capitols: [cap(1, 100), cap(2, 50), cap(4, null)] },
    ]);
    expect(ultimaDespesa(d)).toMatchObject({ any: 2024, parcial: false });
    const parcial = ens([
      { any: 2024, capitols: [cap(1, 100), cap(2, 50), cap(3, 2), cap(4, 30)] },
      { any: 2025, capitols: [cap(1, 100), cap(2, 50), cap(4, 30)] },
    ]);
    expect(ultimaDespesa(parcial)).toMatchObject({ any: 2025, total: 180, parcial: true });
    expect(ultimaDespesa(ens([], null))).toBeNull();
  });
});

describe("detalls del carregador", () => {
  it("troba la persona del ple pel nom del registre o per inicials, i només si és una", () => {
    const ple = pleDe([{ nom: "Eva Maria Martínez Morales" }, { nom: "Joan Puig Roca" }], []);
    expect(personaDelPle(["Eva M. Martinez Morales", "EVA M. MARTINEZ MORALES"], ple)?.nom).toBe("Eva Maria Martínez Morales");
    expect(personaDelPle([null, "Joan Puig Roca"], ple)?.nom).toBe("Joan Puig Roca");
    expect(personaDelPle(["Pere Pou"], ple)).toBeNull();
  });

  it("«Sense retribucions» és que no cobra, no que no consti", () => {
    expect(diuQueNoCobra("El consell hi escriu un text sense cap import que es pugui llegir («Sense retribucions»).")).toBe(true);
    expect(diuQueNoCobra("El consell hi escriu un text sense cap import que es pugui llegir («Segons acord de ple»).")).toBe(false);
    expect(diuQueNoCobra(null)).toBe(false);
  });

  it("repara l'apòstrof perdut del RAISC i deixa els altres interrogants", () => {
    expect(reparaApostrof("Subvencions d?ajuntaments i l?Hospital")).toBe("Subvencions d'ajuntaments i l'Hospital");
    expect(reparaApostrof("Què fem?")).toBe("Què fem?");
    expect(reparaApostrof("Pla d?x")).toBe("Pla d?x");
  });

  it("només accepta colors hexadecimals", () => {
    expect(colorSegur("#ffb232")).toBe("#ffb232");
    expect(colorSegur("#fb2")).toBe("#fb2");
    expect(colorSegur("red;background:url(x)")).toBe("#9a9a9a");
    expect(colorSegur(null)).toBe("#9a9a9a");
  });

  it("el càlcul d'Osona hi compta els municipis del Lluçanès, que el 2023 encara hi eren", () => {
    const base = [muni(10, "Vic", "Osona", "08298", 48000), muni(11, "Olost", "Lluçanès", "08142", 1200), ...BASE];
    const ids = ambitDelCalcul({ tipus: "consell", territori: "Osona", districtes: null }, base).map((m) => m.id);
    expect(ids).toEqual([10, 11]);
    expect(ambitDelCalcul({ tipus: "consell", territori: "Alt Camp", districtes: null }, base).map((m) => m.id)).toEqual([1, 2]);
  });
});

describe("les llistes locals, entre el ple i els resultats", () => {
  it("troba la mateixa llista escrita d'una altra manera, o pels àlies comprovats", () => {
    const claus = new Set(["MxGi", "AM-LVDVDM", "TxT", "Junts"]);
    expect(clauDelResultat("Junts", claus)).toBe("Junts");
    expect(clauDelResultat("MÉS X GIRONELLA", claus)).toBe("MxGi");
    expect(clauDelResultat("ARA MONTBUI", claus)).toBe("AM-LVDVDM");
    expect(clauDelResultat("T x T", claus)).toBe("TxT");
    expect(clauDelResultat("Llista Que No Hi És", claus)).toBe("Llista Que No Hi És");
  });

  it("els grups comarcals amb nom propi van a la seva família, i GCAECP és local", () => {
    expect(partitComparable("GCP")?.clau).toBe("PSC");
    expect(partitComparable("GCC")?.clau).toBe("Comuns");
    expect(partitComparable("CAM")?.clau).toBe("CUP");
    expect(partitComparable("GCAECP")).toEqual({ clau: "GCAECP", familia: null });
    // El Consell de la Selva escriu «IS» els cinc d'Independents de la Selva,
    // la mateixa clau que l'agrupació «IdLS» dels resultats.
    expect(partitComparable("IS")).toEqual({ clau: "Independents de la Selva", familia: "idselva" });
    expect(partitDelResultat("SOM-IdSELVA", "local", "IdLS")).toBe(partitComparable("IS")!.clau);
  });

  it("les llistes del ple es busquen només entre les candidatures de l'àmbit de l'ens", () => {
    // «AC» a l'Alt Camp és Alcoverencs pel Canvi (ApCANVI, Alcover); l'agrupació
    // «AC» d'Ara Copons és de l'Anoia (aquí, Reus fa de municipi de fora).
    const vots = votsPerMunicipi(
      [
        { municipalityId: 2, sigles: "ApCANVI", brandId: "local", agrupacioSigles: "ApCANVI", vots: 1638, regidors: 11, candidats: null },
        { municipalityId: 3, sigles: "AC", brandId: "local", agrupacioSigles: "AC", vots: 151, regidors: 7, candidats: null },
      ],
      PER_ID,
    );
    const r = repartimentDe({ tipus: "consell", districtes: null }, [{ id: 1 }, { id: 2 }], vots,
      [{ partit: "AC", seients: 2, color: null }], true);
    expect(JSON.parse(r!.diferencies[0]!).reals).toEqual([["ApCANVI", 2]]);
  });
});

/*
 * Regressions de les claus de partit, amb el càlcul de debò: les dues bandes
 * (resultats i composició) han de donar la mateixa clau que la validació del
 * 27-10-2026, que reprodueix 32 plens dels 44. Fixtures petites que copien la
 * forma dels casos reals.
 */
describe("les claus de partit, amb el càlcul de debò", () => {
  beforeAll(() => {
    calculReal.actiu = true;
  });
  afterAll(() => {
    calculReal.actiu = false;
  });

  /** Municipis de fixture: id, població i comarca, sense res més. */
  const base = new Map<number, MunicipiBase>([
    [801, muni(801, "Igualada", "Anoia", "08102", 6_000)],
    [802, muni(802, "Santa Margarida de Montbui", "Anoia", "08217", 4_000)],
    [803, muni(803, "Barcelona", "Barcelonès", "08019", 240_000)],
    [804, muni(804, "Terrassa", "Vallès Occidental", "08279", 240_000)],
  ]);
  type Fila = Parameters<typeof votsPerMunicipi>[0][number];
  const fila = (municipalityId: number, sigles: string, agrupacioSigles: string, vots: number, regidors: number): Fila => ({
    municipalityId, sigles, brandId: "local", agrupacioSigles, vots, regidors, candidats: null,
  });
  const etiquetes = (...grups: [string, number][]) => grups.flatMap(([partit, n]) => Array.from({ length: n }, () => ({ partit })));

  it("districte d'Igualada: Ara Montbui (AM-LVDVDM) no suma a ERC, i l'escó és de Junts", () => {
    // Junts 3.000 vots al districte; ERC 2.600 i Ara Montbui 1.500. Si el sufix
    // «-AM» posés Ara Montbui amb ERC (4.100), l'escó seria d'ERC.
    const vots = votsPerMunicipi(
      [
        fila(801, "JxI-CM", "CM", 3_000, 6), fila(801, "ERC-AM", "AM", 2_000, 4),
        fila(802, "ERC-AM", "AM", 600, 2), fila(802, "AM-LVDVDM", "AM-LVDVDM", 1_500, 6),
        fila(803, "PSC-CP", "PSC-CP", 10_000, 20),
        fila(804, "PSC-CP", "PSC-CP", 9_000, 15), fila(804, "TxT", "TxT", 2_900, 3),
      ],
      base,
    );
    const districtes = [
      { nom: "Igualada", municipalityIds: [801, 802] },
      { nom: "Barcelona", municipalityIds: [803] },
      { nom: "Terrassa", municipalityIds: [804] },
    ];
    // El ple, amb les etiquetes del ple municipal de cada diputat.
    const composicio = composicioDe(etiquetes(["PSC-CP", 21], ["TxT", 3], ["JxCAT", 1]));
    const r = repartimentDe({ tipus: "diputacio", districtes, seients: 25 }, [], vots, composicio, true)!;
    expect(r.districtes!.find((d) => d.nom === "Igualada")!.perPartit).toEqual([{ partit: "Junts", seients: 1 }]);
    expect(r.files.find((f) => f.partit === "AM-LVDVDM")).toMatchObject({ vots: 1_500, seientsCalculats: 0 });
    expect(r.files.find((f) => f.partit === "ERC")).toMatchObject({ vots: 2_600, seientsCalculats: 0 });
    expect(r.quadra).toBe(true);
  });

  it("Consell de la Selva: els consellers «IS» són la llista Independents de la Selva (IdLS)", () => {
    const selva = new Map<number, MunicipiBase>([
      [901, muni(901, "Santa Coloma de Farners", "Selva", "17180", 13_000)],
      [902, muni(902, "Sils", "Selva", "17192", 6_000)],
    ]);
    const vots = votsPerMunicipi(
      [
        fila(901, "JxSC-CM", "CM", 3_000, 8), fila(901, "ERC-AM", "AM", 1_500, 4), fila(901, "SC-IdSELVA", "IdLS", 1_200, 3),
        fila(902, "Junts-CM", "CM", 900, 5), fila(902, "IdSils-IdSelva", "IdLS", 800, 4), fila(902, "ERC-AM", "AM", 300, 2),
      ],
      selva,
    );
    const r = repartimentDe({ tipus: "consell", districtes: null, seients: 19 }, [{ id: 901 }, { id: 902 }], vots,
      composicioDe(etiquetes(["CM", 10], ["ERC - AM", 4], ["IS", 5])), true)!;
    expect(r.files.find((f) => f.partit === "Independents de la Selva")).toMatchObject({ seientsCalculats: 5, seientsReals: 5 });
    expect(r.files.some((f) => f.partit === "IS")).toBe(false);
    expect(r.quadra).toBe(true);
  });

  it("si el registre té un escó menys que la llei (una persona repetida), el que falta és desconegut", () => {
    // Com al Vallès Occidental (39 per llei, 38 noms perquè una persona del PSC
    // hi surt dues vegades), aquí un consell de 19 amb 18 noms: el càlcul dona
    // a Junts un seient més dels que té amb nom, i és el seient que no en té.
    const vots = votsPerMunicipi(
      [fila(901, "JxSC-CM", "CM", 3_000, 8), fila(901, "SC-IdSELVA", "IdLS", 1_200, 3)],
      new Map([[901, muni(901, "Santa Coloma de Farners", "Selva", "17180", 13_000)]]),
    );
    const complet = repartimentDe({ tipus: "consell", districtes: null, seients: 19 }, [{ id: 901 }], vots,
      composicioDe([]), false)!;
    const juntsLlei = complet.files.find((f) => f.partit === "Junts")!.seientsCalculats;
    const r = repartimentDe({ tipus: "consell", districtes: null, seients: 18 }, [{ id: 901 }], vots,
      composicioDe(etiquetes(["CM", juntsLlei - 1], ["IdLS", 19 - juntsLlei])), true)!;
    expect(r.quadra).toBe(true);
    expect(r.diferencies[0]).toBe("Quadra amb els 18 seients de partit conegut; de l'altre, la font no diu de quin partit és.");
  });
});
