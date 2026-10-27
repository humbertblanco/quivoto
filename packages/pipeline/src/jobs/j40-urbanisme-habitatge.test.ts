import { describe, expect, it } from "vitest";
import {
  FONTS_URBANISME,
  figuraConeguda,
  ine5De,
  nombreNet,
  plegaHpo,
  plegaObservatori,
  protegitDe,
  sumaProtegits,
  textNet,
  urbanismeDeMunicipi,
  zonaDeFila,
  type Anomalia,
  type FilaObservatori,
} from "./j40-urbanisme-habitatge";

// Files reals de `8aaj-ypcb` (27-10-2026), retallades als camps que es demanen.
const cadaques2024: FilaObservatori = {
  codi_municipi: "170329", any: "2024",
  _10_hab_acabats_total: "12", _11_hab_acabats_hpo: "0",
  _13_hab_cost_ingressos_perc: "31.87332581", _14_hab_hipoteca_ingressos_perc: "NA",
  _23_tur_places: "8712", _24_tur_places_100hab: "312.4", _25_tur_places_huts: "5873",
  _27_tur_nombre_huts: "1004", _28_tur_nombre_huts_100hab: "35.98213",
  _61_plj_pg_vigent: "Pla general d'ordenació", _62_plj_pg_anitguitat: "37", _63_plj_munis_adapt_llei: "0",
};
const cadaques2023: FilaObservatori = { ...cadaques2024, any: "2023", _62_plj_pg_anitguitat: "36", _14_hab_hipoteca_ingressos_perc: "29.1" };
const catalunya2024: FilaObservatori = {
  any: "2024", _13_hab_cost_ingressos_perc: "25.16", _14_hab_hipoteca_ingressos_perc: "19.4",
  _61_plj_pg_vigent: "NA", _62_plj_pg_anitguitat: "20", _27_tur_nombre_huts: "105781",
};

const fonts = {
  territori: { ...FONTS_URBANISME.territori, actualitzat: "2026-03-26" },
  hpo: { ...FONTS_URBANISME.hpo, actualitzat: null },
  zones: { ...FONTS_URBANISME.zones, actualitzat: "2025-02-14" },
};

describe("lectura de valors", () => {
  it("els buits de la font són null, mai zero", () => {
    for (const buit of ["NA", "", " - ", null, undefined, "n/d"]) {
      expect(textNet(buit)).toBeNull();
      expect(nombreNet(buit)).toBeNull();
    }
    expect(nombreNet("0")).toBe(0);
    expect(nombreNet("28.20589847")).toBeCloseTo(28.2059);
    expect(nombreNet("1.234,5")).toBeNull();
  });

  it("treu l'INE de cinc xifres del codi de sis de l'Idescat i dels codis sense zero", () => {
    expect(ine5De("170329")).toBe("17032");
    expect(ine5De("17015")).toBe("17015");
    expect(ine5De("8019")).toBe("08019");
    expect(ine5De("NA")).toBeNull();
    expect(ine5De("1703290001")).toBeNull();
  });

  it("coneix les figures de planejament de la font i no n'inventa cap", () => {
    expect(figuraConeguda("Normes subsidiàries del planejament").sigla).toBe("NNSS");
    expect(figuraConeguda("Pla general d'ordenació plurimunicipal").sigla).toBeNull();
    expect(figuraConeguda("Pla nou que no existeix")).toEqual({ sigla: null, que: null });
  });
});

describe("plegat de l'Observatori del Territori", () => {
  it("separa la fila de Catalunya, que no porta codi", () => {
    const { perIne5, catalunya } = plegaObservatori([cadaques2024, cadaques2023, catalunya2024]);
    expect(perIne5.get("17032")).toHaveLength(2);
    expect(catalunya.get(2024)).toEqual({ lloguerPerc: 25.2, hipotecaPerc: 19.4 });
  });

  it("si un any hi ha dues files sense codi no fa servir cap referència", () => {
    const { catalunya } = plegaObservatori([catalunya2024, { ...catalunya2024 }]);
    expect(catalunya.size).toBe(0);
  });

  it("fa la mètrica amb l'any més recent de cada secció i sense cap veredicte", () => {
    const { perIne5, catalunya } = plegaObservatori([cadaques2024, cadaques2023, catalunya2024]);
    const m = urbanismeDeMunicipi({
      observatori: perIne5.get("17032")!, catalunya, hpo: undefined,
      zona: { codmuni: "17032", zona_de_mercat_residencial_tensat: "ZMRT 1" }, fonts, consultat: "2026-10-27",
    })!;
    expect(m.planejament).toEqual({
      any: 2024, figura: "Pla general d'ordenació", sigla: "PGO", antiguitat: 37, anyAprovacioAprox: 1987, adaptatLlei2002: false,
    });
    expect(m.pisosTuristics).toMatchObject({ any: 2024, huts: 1004, placesHuts: 5873, hutsPer100: 35.98, placesTuristiques: 8712 });
    // El 2024 la hipoteca és «NA», però el lloguer hi és: la secció és del 2024 i la hipoteca, buida.
    expect(m.cost).toEqual({ any: 2024, lloguerPerc: 31.9, hipotecaPerc: null, catalunya: { lloguerPerc: 25.2, hipotecaPerc: 19.4 } });
    expect(m.habitatgesAcabats).toEqual({ any: 2024, total: 12, protegits: 0 });
    expect(m.protegit).toBeNull();
    expect(m.zonaTensa).toEqual({ zona: "ZMRT1", vigentDes: "2024-03-16" });
    expect(JSON.stringify(m)).not.toMatch(/compleix/i);
  });

  it("baixa a l'any anterior quan l'últim no té la secció", () => {
    const sense2024 = { ...cadaques2024, _13_hab_cost_ingressos_perc: "NA", _14_hab_hipoteca_ingressos_perc: "" };
    const m = urbanismeDeMunicipi({ observatori: [sense2024, cadaques2023], catalunya: new Map(), hpo: undefined, zona: undefined, fonts, consultat: "x" })!;
    expect(m.cost).toEqual({ any: 2023, lloguerPerc: 31.9, hipotecaPerc: 29.1, catalunya: null });
  });

  it("una xifra fora de rang és null i una anomalia", () => {
    const avisos: Anomalia[] = [];
    const trencada = { ...cadaques2024, _13_hab_cost_ingressos_perc: "248566532", _62_plj_pg_anitguitat: "900" };
    const m = urbanismeDeMunicipi({ observatori: [trencada], catalunya: new Map(), hpo: undefined, zona: undefined, fonts, consultat: "x" }, avisos)!;
    expect(m.cost).toBeNull();
    expect(m.planejament?.antiguitat).toBeNull();
    expect(m.planejament?.anyAprovacioAprox).toBeNull();
    expect(avisos.map((a) => a.camp).sort()).toEqual(["_13_hab_cost_ingressos_perc", "_62_plj_pg_anitguitat"]);
  });

  it("sense cap font no hi ha mètrica", () => {
    expect(urbanismeDeMunicipi({ observatori: [], catalunya: new Map(), hpo: undefined, zona: undefined, fonts, consultat: "x" })).toBeNull();
  });
});

describe("habitatge protegit", () => {
  const files = [
    { codi_ine: "17015", any: "2023", iniciats_hpo: "0", acabats_hpo: "0" },
    { codi_ine: "17015", any: "2025", iniciats_hpo: "27", acabats_hpo: "3" },
    { codi_ine: "17015", any: "2024", iniciats_hpo: "0", acabats_hpo: "1" },
    { codi_ine: "17015", any: "2024", iniciats_hpo: "99", acabats_hpo: "99" },
    { codi_ine: "8019", any: "2025", iniciats_hpo: "NA", acabats_hpo: "5" },
  ];

  it("ordena la sèrie i no suma els anys repetits", () => {
    const { perIne5, repetits } = plegaHpo(files);
    expect(repetits).toBe(1);
    expect(perIne5.get("17015")!.map((a) => a.any)).toEqual([2023, 2024, 2025]);
    expect(perIne5.get("17015")![1]).toEqual({ any: 2024, iniciats: 0, acabats: 1 });
  });

  it("resumeix el darrer any i el que va de mandat; els zeros publicats són zeros", () => {
    const p = protegitDe(plegaHpo(files).perIne5.get("17015"))!;
    expect(p.darrer).toEqual({ any: 2025, iniciats: 27, acabats: 3 });
    expect(p.desDe2023).toEqual({ des: 2023, fins: 2025, iniciats: 27, acabats: 4 });
    expect(p.total).toEqual(p.desDe2023);
  });

  it("no suma un tram amb un any que falta o amb una xifra buida", () => {
    const amb = plegaHpo(files).perIne5;
    expect(sumaProtegits(amb.get("17015")!, 2022, 2025)).toBeNull();
    const bcn = protegitDe(amb.get("08019"))!;
    expect(bcn.darrer).toEqual({ any: 2025, iniciats: null, acabats: 5 });
    expect(bcn.desDe2023).toBeNull();
    expect(protegitDe(undefined)).toBeNull();
  });
});

describe("zona tensa", () => {
  it("distingeix zona 1, zona 2, «no ho és» i «no se sap»", () => {
    expect(zonaDeFila({ zona_de_mercat_residencial_tensat: "ZMRT 2" })).toEqual({ zona: "ZMRT2", vigentDes: "2024-10-10" });
    expect(zonaDeFila({ zona_de_mercat_residencial_tensat: "NA" })).toEqual({ zona: null, vigentDes: null });
    expect(zonaDeFila({ zona_de_mercat_residencial_tensat: "ZMRT 3" })).toBeNull();
    expect(zonaDeFila(undefined)).toBeNull();
  });
});
