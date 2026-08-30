import { describe, expect, it } from "vitest";
import {
  COMPARABLE,
  DESTACAT,
  INDICADORS,
  RFDB_INDEX,
  RFDB_PER_HABITANT,
  anyComparable,
  codiIne5,
  comparaDinsDelGrup,
  darrerAmbValor,
  nomIne,
  parseCsvAdrh,
  parseImportIne,
  posicioACatalunya,
  provinciesInesperades,
  serieRfdbCatalunya,
  seriesRfdb,
  urlDescarregaAdrh,
  urlTaulaAdrh,
} from "./j23-riquesa";
import type { CelaJsonStat } from "../adapters/idescat";
import type { PeerGroup } from "../derive/peers";

/**
 * Files copiades **literalment** dels fitxers de l'INE, tal com es van baixar
 * el 30 d'agost del 2026:
 *
 *   · Barcelona  https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/30896.csv
 *   · Girona     https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/31016.csv
 *   · Lleida     https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/31079.csv
 *
 * Hi ha de tot el que el parseig ha de saber travessar: una fila de municipi,
 * una de districte, una de secció censal, una cel·la tapada per secret
 * estadístic («.»), una cel·la buida entre cometes i les dues longituds de
 * xifra que enganyen —quatre xifres i sis.
 */
const CSV_INE = [
  "﻿Municipios;Distritos;Secciones;Indicadores de renta media y mediana;Periodo;Total",
  "08015 Badalona;;;Renta neta media por persona;2023;14.618",
  "08015 Badalona;;;Renta neta media por persona;2015;10.876",
  "08015 Badalona;;;Mediana de la renta por unidad de consumo;2023;19.950",
  "08015 Badalona;0801501 Badalona distrito 01;;Renta neta media por persona;2023;21.831",
  "08120 Matadepera;;;Renta neta media por persona;2023;26.720",
  "08120 Matadepera;;;Renta neta media por hogar;2023;85.692",
  "08021 Bellprat;;;Renta neta media por persona;2023;.",
  "08041 Canovelles;;;Renta neta media por persona;2015;9.726",
  "08003 Alella;;;Renta bruta media por hogar;2023;100.832",
  "25120 Lleida;2512008 Lleida distrito 08;2512008004 Lleida sección 08004;Renta neta media por persona;2023;19.572",
  '25120 Lleida;2512008 Lleida distrito 08;2512008004 Lleida sección 08004;Renta neta media por persona;2017;""',
  "",
].join("\r\n");

describe("parseImportIne", () => {
  it("llegeix el punt com a separador de milers, que és el que és", () => {
    // Badalona no té una renda de catorze euros amb sis-cents divuit.
    expect(parseImportIne("14.618")).toBe(14618);
    // La trampa de les quatre xifres: «9.726» sembla un decimal i no ho és.
    expect(parseImportIne("9.726")).toBe(9726);
    // I la de les sis: la renda bruta per llar d'Alella passa dels cent mil.
    expect(parseImportIne("100.832")).toBe(100832);
  });

  it("no confon una cel·la tapada per secret estadístic amb un zero", () => {
    // Bellprat i la Vajol surten amb un punt sol al fitxer del 2023. Un poble
    // sense xifra no és un poble sense renda.
    expect(parseImportIne(".")).toBeNull();
    expect(parseImportIne("")).toBeNull();
    expect(parseImportIne('""')).toBeNull();
    expect(parseImportIne("  ")).toBeNull();
  });

  it("no s'inventa un número quan el camp no ho és", () => {
    expect(parseImportIne("n/d")).toBeNull();
    expect(parseImportIne("12.3.4.5x")).toBeNull();
  });
});

describe("codiIne5 i nomIne", () => {
  it("separa el codi del nom de la columna Municipios", () => {
    expect(codiIne5("08015 Badalona")).toBe("08015");
    expect(nomIne("08015 Badalona")).toBe("Badalona");
  });

  it("aguanta l'article invertit que escriu l'INE", () => {
    expect(codiIne5("17014 Vajol, La")).toBe("17014");
    expect(nomIne("17014 Vajol, La")).toBe("Vajol, La");
  });

  it("torna null si el camp no comença per cinc xifres", () => {
    // Val més perdre una fila que ingerir-la contra el municipi equivocat.
    expect(codiIne5("Total Nacional")).toBeNull();
    expect(codiIne5("0801501 Badalona distrito 01")).toBeNull();
  });
});

describe("parseCsvAdrh", () => {
  const files = parseCsvAdrh(CSV_INE);

  it("es queda només amb les files de municipi", () => {
    // Al fitxer de Barcelona, 242.622 files i només 16.794 de municipi: qui no
    // filtri ingerirà la renda d'un districte com si fos la de la ciutat.
    expect(files.every((f) => !f.municipi.includes("distrito"))).toBe(true);
    expect(files.filter((f) => f.ine5 === "25120")).toHaveLength(0);
    const badalona2023 = files.filter((f) => f.ine5 === "08015" && f.any === 2023);
    expect(badalona2023.map((f) => f.valor)).toEqual([14618, 19950]);
  });

  it("no es menja la capçalera amb BOM ni la línia buida del final", () => {
    // Vuit files de municipi: les altres quatre del fitxer són capçalera,
    // districte, secció censal i la línia buida del final.
    expect(files).toHaveLength(8);
    expect(files.every((f) => /^\d{5}$/.test(f.ine5))).toBe(true);
  });

  it("desa la cel·la tapada com a null i la fila hi continua sent", () => {
    const bellprat = files.find((f) => f.ine5 === "08021");
    expect(bellprat).toBeDefined();
    expect(bellprat!.valor).toBeNull();
    expect(bellprat!.any).toBe(2023);
  });

  it("ignora els indicadors que no publiquem", () => {
    const desconegut = parseCsvAdrh(
      [
        "Municipios;Distritos;Secciones;Indicadores de renta media y mediana;Periodo;Total",
        "08015 Badalona;;;Indicador que no existeix;2023;1.000",
      ].join("\n"),
    );
    expect(desconegut).toHaveLength(0);
  });

  it("llegeix els sis indicadors que porta el fitxer i cap més", () => {
    expect(INDICADORS.map((i) => i.clau)).toContain(DESTACAT);
    expect(INDICADORS.map((i) => i.clau)).toContain(COMPARABLE);
    expect(new Set(INDICADORS.map((i) => i.origen)).size).toBe(6);
  });
});

describe("provinciesInesperades", () => {
  it("detecta que hem baixat la taula d'una altra província", () => {
    // Els identificadors de l'INE no van en ordre: entre Barcelona (30896) i
    // Girona (31016) hi ha Ciudad Real i A Coruña. Si un dia es reordenen,
    // creuar per codi INE simplement no trobaria res i el forat passaria
    // desapercebut.
    const jaen = parseCsvAdrh(
      [
        "Municipios;Distritos;Secciones;Indicadores de renta media y mediana;Periodo;Total",
        "23001 Albanchez de Mágina;;;Renta neta media por persona;2023;12.000",
      ].join("\n"),
    );
    expect(provinciesInesperades(jaen, "25")).toEqual(["23"]);
  });

  it("no es queixa quan la província és la que toca", () => {
    expect(provinciesInesperades(parseCsvAdrh(CSV_INE), "08")).toEqual([]);
  });
});

describe("anyComparable", () => {
  /** La cobertura real de la renda neta per persona als 947, comprovada. */
  const cobertura = new Map([
    [2015, 914],
    [2016, 912],
    [2017, 911],
    [2018, 915],
    [2019, 912],
    [2020, 947],
    [2021, 945],
    [2022, 932],
    [2023, 927],
  ]);

  it("tria el 2023, que és el més nou amb prou cobertura", () => {
    expect(anyComparable(cobertura, 947)).toBe(2023);
  });

  it("recula quan l'any més nou tapa massa municipis", () => {
    // Un sol any per a tothom: si es publiqués l'últim any de cada municipi,
    // un poble amb dada del 2019 quedaria comparat amb la mediana del 2023
    // dels seus veïns i sortiria pobre pel sol fet de ser vell.
    const prim = new Map([...cobertura, [2024, 300]]);
    expect(anyComparable(prim, 947)).toBe(2023);
  });

  it("no tria res quan cap any no hi arriba", () => {
    expect(anyComparable(new Map([[2023, 10]]), 947)).toBeNull();
    expect(anyComparable(new Map(), 947)).toBeNull();
  });
});

describe("comparaDinsDelGrup", () => {
  const grup = (key: string, label: string, size: number): PeerGroup => ({ key, label, size });
  const grups = new Map<number, PeerGroup>([
    [1, grup("t7-7", "de 20.001 a 50.000 habitants", 3)],
    [2, grup("t7-7", "de 20.001 a 50.000 habitants", 3)],
    [3, grup("t7-7", "de 20.001 a 50.000 habitants", 3)],
    [4, grup("t2-2", "de 251 a 1.000 habitants", 1)],
  ]);

  it("posa la xifra al costat de la mediana dels municipis de la mateixa mida", () => {
    // 15.200 € no diu res sol; el que diu alguna cosa és si al grup la mediana
    // és 14.000 o 21.000.
    const resultat = comparaDinsDelGrup(new Map([[1, 12000], [2, 15200], [3, 21000]]), grups);
    const mitja = resultat.get(2)!;
    expect(mitja.mediana).toBe(15200);
    expect(mitja.diferencia).toBe(0);
    expect(mitja.percentil).toBe(50);
    expect(mitja.grup.etiqueta).toBe("de 20.001 a 50.000 habitants");
    expect(mitja.grup.ambDada).toBe(3);

    const alt = resultat.get(3)!;
    expect(alt.diferencia).toBe(5800);
    expect(alt.percentual).toBe(38.2);
  });

  it("compta només els que tenen dada, i ho diu", () => {
    // El percentil calculat sobre dos municipis s'ha de poder llegir amb la
    // desconfiança que mereix, i per això `ambDada` va al costat.
    const resultat = comparaDinsDelGrup(new Map([[1, 12000], [3, 21000]]), grups);
    expect(resultat.get(1)!.grup.ambDada).toBe(2);
    expect(resultat.get(1)!.grup.mida).toBe(3);
  });

  it("deixa fora els municipis sense grup", () => {
    const resultat = comparaDinsDelGrup(new Map([[99, 12000]]), grups);
    expect(resultat.size).toBe(0);
  });
});

describe("posicioACatalunya", () => {
  it("ordena de més ric a més pobre i diu sobre quants", () => {
    // Matadepera (26.720 €) i Badalona (14.618 €) són xifres reals del 2023.
    const valors = new Map([[1, 26720], [2, 14618], [3, 16682]]);
    const resultat = posicioACatalunya(valors);
    expect(resultat.get(1)!.rang).toBe(1);
    expect(resultat.get(2)!.rang).toBe(3);
    expect(resultat.get(1)!.de).toBe(3);
    expect(resultat.get(3)!.medianaMunicipal).toBe(16682);
    expect(resultat.get(2)!.diferencia).toBe(-2064);
  });

  it("dona el mateix rang als empatats", () => {
    // Dos municipis amb la mateixa renda no poden ser el 12è i el 13è per
    // l'ordre en què els hem llegit del fitxer.
    const resultat = posicioACatalunya(new Map([[1, 20000], [2, 20000], [3, 10000]]));
    expect(resultat.get(1)!.rang).toBe(1);
    expect(resultat.get(2)!.rang).toBe(1);
    expect(resultat.get(3)!.rang).toBe(3);
  });

  it("diu que la mediana és la dels municipis i no la de Catalunya", () => {
    const resultat = posicioACatalunya(new Map([[1, 20000], [2, 10000]]));
    expect(resultat.get(1)!.nota).toContain("no la renda de Catalunya");
  });

  it("no torna res sense mostra", () => {
    expect(posicioACatalunya(new Map()).size).toBe(0);
  });
});

describe("seriesRfdb", () => {
  /**
   * Cel·les reals de la taula municipal de RFDB de l'Idescat
   * (`rfdbc/21181/25017`), tal com les torna l'API i les parseja l'adaptador.
   */
  const cela = (mun: string, municipi: string, any: number, indicador: string, valor: number | null): CelaJsonStat => ({
    mun,
    municipi,
    any,
    categories: { CONCEPT: "GROSS_INCOME", INDICATOR: indicador },
    valor,
    estat: null,
  });

  const celes: CelaJsonStat[] = [
    cela("081691", "Prat de Llobregat, el", 2022, RFDB_PER_HABITANT, 19026),
    cela("081691", "Prat de Llobregat, el", 2022, RFDB_INDEX, 99.3),
    cela("081691", "Prat de Llobregat, el", 2023, RFDB_PER_HABITANT, 20168),
    cela("081691", "Prat de Llobregat, el", 2023, RFDB_INDEX, 97),
    cela("080193", "Barcelona", 2023, RFDB_PER_HABITANT, 25898),
    cela("080193", "Barcelona", 2023, RFDB_INDEX, 124.6),
    // El valor absolut en milers d'euros no el publiquem: sobra i s'ha d'ignorar.
    cela("080193", "Barcelona", 2023, "VALUE_EK", 43278408),
  ];

  it("ajunta els euros per habitant i l'índex del mateix any", () => {
    const series = seriesRfdb(celes);
    const prat = series.get("081691")!;
    expect(prat).toHaveLength(2);
    expect(prat[0]).toEqual({ any: 2022, perHabitant: 19026, index: 99.3 });
    expect(prat[1]).toEqual({ any: 2023, perHabitant: 20168, index: 97 });
  });

  it("no toca l'índex Catalunya=100: el dona l'Idescat i no el recalculem", () => {
    const barcelona = seriesRfdb(celes).get("080193")!;
    expect(barcelona[0]!.index).toBe(124.6);
  });

  it("ordena la sèrie per any", () => {
    const desordenat = [celes[2]!, celes[0]!];
    expect(seriesRfdb(desordenat).get("081691")!.map((p) => p.any)).toEqual([2022, 2023]);
  });

  it("llegeix la sèrie de Catalunya, que és la referència de l'índex", () => {
    const catalunya = serieRfdbCatalunya([
      cela("TOTAL", "Catalunya", 2023, RFDB_PER_HABITANT, 20789),
      cela("TOTAL", "Catalunya", 2023, RFDB_INDEX, 100),
    ]);
    expect(catalunya).toEqual([{ any: 2023, perHabitant: 20789, index: 100 }]);
  });
});

describe("darrerAmbValor", () => {
  it("diu quan va tenir xifra un municipi que l'INE ara tapa", () => {
    // Els vint municipis sense 2023 no es comparen amb ningú, però la fitxa ha
    // de poder dir de quan és l'última xifra que en tenim.
    const serie = [
      { any: 2021, valor: 11500 },
      { any: 2022, valor: 12100 },
      { any: 2023, valor: null },
    ];
    expect(darrerAmbValor(serie)).toBe(2022);
  });

  it("torna null quan no n'ha tingut mai", () => {
    expect(darrerAmbValor([{ any: 2023, valor: null }])).toBeNull();
    expect(darrerAmbValor([])).toBeNull();
  });
});

describe("els URL de l'INE", () => {
  it("apunten a la taula que hem comprovat", () => {
    expect(urlDescarregaAdrh(30896)).toBe("https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/30896.csv");
    expect(urlTaulaAdrh(30896)).toBe("https://www.ine.es/jaxiT3/Tabla.htm?t=30896");
  });
});
