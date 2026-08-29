import { describe, expect, it } from "vitest";
import {
  ITEMS_TRANSPARENCIA,
  dataMesRecent,
  diaDe,
  diesMassius,
  esMillorFila,
  sqlText,
  type ItemRow,
} from "./j7-context-obert";

/** Una fila del conjunt de transparència amb només el que ens interessa. */
const fila = (camps: Partial<Record<string, string | number | null>> = {}): ItemRow => ({
  VISIBLE: 0,
  DARRERAACTUALITZACIODM: null,
  DARRERAACTUALITZACIOMI: null,
  DARRERAACTUALITZACIODA: null,
  DARRERAACTUALITZACIO: null,
  ...camps,
});

describe("ITEMS_TRANSPARENCIA", () => {
  it("tria els ítems pel nom, perquè el codi no identifica res", () => {
    // El 146 són dos ítems diferents al conjunt i les declaracions de béns dels
    // alts càrrecs tenen el codi buit: si la clau fos CODIITEM, el detall
    // barrejaria «Resolucions d'accés a la informació» amb «Informació
    // proporcionada per entitats privades» i perdria l'ítem més sensible.
    for (const item of ITEMS_TRANSPARENCIA) expect(item.nomItem.length).toBeGreaterThan(0);
    expect(new Set(ITEMS_TRANSPARENCIA.map((i) => i.nomItem)).size).toBe(ITEMS_TRANSPARENCIA.length);
    expect(new Set(ITEMS_TRANSPARENCIA.map((i) => i.key)).size).toBe(ITEMS_TRANSPARENCIA.length);
  });

  it("en són entre 8 i 12, i hi ha els diners, els electes i el ple", () => {
    expect(ITEMS_TRANSPARENCIA.length).toBeGreaterThanOrEqual(8);
    expect(ITEMS_TRANSPARENCIA.length).toBeLessThanOrEqual(12);
    const keys = ITEMS_TRANSPARENCIA.map((i) => i.key);
    for (const key of ["retribucions", "declaracions", "compteGeneral", "contractes", "ordreDelDia", "dretAcces"]) {
      expect(keys).toContain(key);
    }
  });
});

describe("sqlText", () => {
  it("dobla els apòstrofs, que la meitat dels ítems en porten", () => {
    expect(sqlText("Acords d'òrgans de govern")).toBe("'Acords d''òrgans de govern'");
    expect(sqlText("Compte general")).toBe("'Compte general'");
  });
});

describe("diaDe", () => {
  it("es queda amb el dia i deixa l'hora", () => {
    expect(diaDe("2022-06-20T08:45:06.123000")).toBe("2022-06-20");
    expect(diaDe("2026-04-13T00:00:00")).toBe("2026-04-13");
  });

  it("no s'inventa cap data quan l'origen no en dona", () => {
    // Tres de cada deu files visibles no tenen cap data a cap dels quatre camps.
    expect(diaDe(null)).toBeNull();
    expect(diaDe("")).toBeNull();
    expect(diaDe(0)).toBeNull();
  });
});

describe("dataMesRecent", () => {
  it("agafa la més nova dels quatre camps i diu d'on ve", () => {
    expect(
      dataMesRecent(fila({ DARRERAACTUALITZACIODM: "2015-11-26T00:00:00", DARRERAACTUALITZACIO: "2024-03-01T10:00:00" })),
    ).toEqual({ updatedOn: "2024-03-01", updatedFrom: "DARRERAACTUALITZACIO" });
  });

  it("conserva el camp manual quan és el més recent", () => {
    // Importa distingir-ho: que ho hagi tocat una persona de l'ajuntament no és
    // el mateix que un reompliment automàtic del portal.
    expect(
      dataMesRecent(fila({ DARRERAACTUALITZACIODM: "2024-06-06T00:00:00", DARRERAACTUALITZACIODA: "2024-01-01T00:00:00" })),
    ).toEqual({ updatedOn: "2024-06-06", updatedFrom: "DARRERAACTUALITZACIODM" });
  });

  it("torna null quan el portal no dona cap data", () => {
    expect(dataMesRecent(fila())).toEqual({ updatedOn: null, updatedFrom: null });
  });
});

describe("diesMassius", () => {
  it("caça el segell de portal que faria dir una mentida", () => {
    // El 20 de juny del 2022 l'Ajuntament de Llívia va quedar amb 104 ítems
    // datats el mateix dia. Ningú no actualitza cent pàgines en una tarda, i
    // dir «sense tocar des del 2022» a partir d'aquesta data seria acusar algú
    // amb una dada falsa.
    const rows = Array.from({ length: 6 }, () => fila({ DARRERAACTUALITZACIO: "2022-06-20T08:45:06" }));
    expect(diesMassius(rows).has("2022-06-20")).toBe(true);
  });

  it("deixa passar una actualització de debò", () => {
    const rows = [
      fila({ DARRERAACTUALITZACIO: "2026-02-11T09:00:00" }),
      fila({ DARRERAACTUALITZACIO: "2025-10-02T09:00:00" }),
      fila({ DARRERAACTUALITZACIO: "2024-01-30T09:00:00" }),
    ];
    expect(diesMassius(rows).size).toBe(0);
  });

  it("no compta quatre cops una fila que té el mateix dia als quatre camps", () => {
    const dia = "2021-03-04T00:00:00";
    const rows = [
      fila({ DARRERAACTUALITZACIODM: dia, DARRERAACTUALITZACIOMI: dia, DARRERAACTUALITZACIODA: dia, DARRERAACTUALITZACIO: dia }),
      fila({ DARRERAACTUALITZACIO: dia }),
    ];
    expect(diesMassius(rows).size).toBe(0);
  });
});

describe("esMillorFila", () => {
  it("es queda la publicada quan el portal repeteix l'ítem", () => {
    // L'Hospitalet de Llobregat, Cardona, Das i Santa Fe del Penedès tenen dos
    // «Compte general» al portal.
    expect(esMillorFila(fila({ VISIBLE: 1 }), fila({ VISIBLE: 0 }))).toBe(true);
    expect(esMillorFila(fila({ VISIBLE: 0 }), fila({ VISIBLE: 1 }))).toBe(false);
  });

  it("entre dues de publicades, es queda la més recent", () => {
    const antiga = fila({ VISIBLE: 1, DARRERAACTUALITZACIO: "2019-01-01T00:00:00" });
    const nova = fila({ VISIBLE: 1, DARRERAACTUALITZACIO: "2026-05-20T12:00:11" });
    expect(esMillorFila(nova, antiga)).toBe(true);
    expect(esMillorFila(antiga, nova)).toBe(false);
  });

  it("accepta la primera fila que arriba", () => {
    expect(esMillorFila(fila(), undefined)).toBe(true);
  });
});
