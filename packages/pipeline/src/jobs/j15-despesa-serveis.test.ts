import { describe, expect, it } from "vitest";
import {
  PROGRAMES,
  codiPrograma,
  darrerAnyComparable,
  despesaDelPrograma,
  euros,
  medianaPerGrup,
  partDelTotal,
  perHabitant,
  type VariacioAmbFinal,
} from "./j15-despesa-serveis";
import type { PeerGroup } from "../derive/peers";

describe("euros", () => {
  it("llegeix els decimals amb coma, que és com els publica aquest conjunt", () => {
    // Bellvís 2024, residus: «200993,67» tal com arriba de l'origen.
    expect(euros("200993,67")).toBe(200993.67);
    // Barcelona 2024, parcs i jardins: cent tres milions, sense separador de milers.
    expect(euros("103555042,41")).toBe(103555042.41);
    expect(euros("0,00")).toBe(0);
  });

  it("no confon un import amb coma amb un zero", () => {
    // El parany de debò: `Number("200993,67")` és NaN, i qui el converteixi a
    // zero publica que un ajuntament no gasta res en escombraries.
    expect(Number("200993,67")).toBeNaN();
    expect(euros("200993,67")).not.toBe(0);
  });

  it("també entén els decimals amb punt, per si un dia canvien de format", () => {
    expect(euros("200993.67")).toBe(200993.67);
    expect(euros(1234.5)).toBe(1234.5);
  });

  it("conserva els imports negatius, que són reintegraments reals", () => {
    // El 2024 n'hi ha tres al nivell 3; el més gros passa dels disset milions.
    expect(euros("-17995939,06")).toBe(-17995939.06);
    expect(euros("-360,14")).toBe(-360.14);
  });

  it("distingeix «no consta» de «zero euros»", () => {
    expect(euros("")).toBeNull();
    expect(euros(null)).toBeNull();
    expect(euros(undefined)).toBeNull();
    expect(euros("   ")).toBeNull();
    expect(euros("no consta")).toBeNull();
    expect(euros("0,00")).toBe(0);
  });
});

describe("codiPrograma", () => {
  it("accepta el codi tal com el numeritza l'origen", () => {
    expect(codiPrograma("1602")).toBe("1602");
    // `ESTRUCTURA` és de tipus numèric al datastore: el grup 0101 («Deute
    // públic») hi arriba sense el zero del davant. El catàleg l'ha de dur igual.
    expect(codiPrograma("101")).toBe("101");
    expect(codiPrograma(1602)).toBe("1602");
    expect(codiPrograma("1602.0")).toBe("1602");
    expect(codiPrograma(" 1602 ")).toBe("1602");
  });

  it("el catàleg no porta cap codi amb zero al davant, o no lligaria mai", () => {
    for (const programa of PROGRAMES) {
      expect(programa.codi).toBe(codiPrograma(programa.codi));
      expect(programa.codi.startsWith("0")).toBe(false);
    }
  });

  it("no repeteix cap programa", () => {
    expect(new Set(PROGRAMES.map((p) => p.codi)).size).toBe(PROGRAMES.length);
  });
});

describe("despesaDelPrograma", () => {
  const declarats = new Map([
    ["1602", 200993.67],
    ["1605", 41200],
  ]);

  it("dona l'import quan el programa hi és", () => {
    expect(despesaDelPrograma(declarats, "1602", true)).toBe(200993.67);
  });

  it("un programa que no hi és, havent liquidat l'exercici, és un zero", () => {
    // Berga 2024 declara «0,00» a residus; un altre poble no declara la línia.
    // Els dos casos volen dir el mateix: aquell any no hi va anar cap euro.
    expect(despesaDelPrograma(declarats, "1603", true)).toBe(0);
  });

  it("un exercici sense liquidar no és un zero: no en sabem res", () => {
    // El 2025 el tenen liquidat 827 dels 947. Si els altres 120 sortissin amb
    // zero, la fitxa diria que han deixat de netejar els carrers.
    expect(despesaDelPrograma(undefined, "1602", false)).toBeNull();
    expect(despesaDelPrograma(declarats, "1602", false)).toBeNull();
  });

  it("un municipi sense cap programa però amb liquidació té zeros, no buits", () => {
    expect(despesaDelPrograma(new Map(), "1602", true)).toBe(0);
    expect(despesaDelPrograma(undefined, "1602", true)).toBe(0);
  });
});

describe("perHabitant i partDelTotal", () => {
  it("divideix pel padró de l'any", () => {
    expect(perHabitant(200993.67, 2180)).toBe(92.2);
  });

  it("no inventa res quan no hi ha padró o no hi ha import", () => {
    expect(perHabitant(200993.67, null)).toBeNull();
    expect(perHabitant(200993.67, 0)).toBeNull();
    expect(perHabitant(null, 2180)).toBeNull();
  });

  it("el zero per habitant continua sent zero i no un buit", () => {
    expect(perHabitant(0, 2180)).toBe(0);
  });

  it("dona la part del total en percentatge", () => {
    expect(partDelTotal(2669230.76, 16940503.01)).toBe(15.8);
    expect(partDelTotal(0, 16940503.01)).toBe(0);
    expect(partDelTotal(100, 0)).toBeNull();
    expect(partDelTotal(null, 16940503.01)).toBeNull();
  });
});

describe("darrerAnyComparable", () => {
  it("descarta l'últim any quan encara no l'ha liquidat gairebé ningú", () => {
    // Xifres reals del 29-08-2026: el 2025 el tenen 827 de 947 (87 %).
    const perAny = new Map([
      [2019, 947],
      [2022, 947],
      [2023, 947],
      [2024, 945],
      [2025, 827],
    ]);
    expect(darrerAnyComparable(perAny)).toBe(2024);
  });

  it("agafa l'últim any tan bon punt la cobertura hi arriba", () => {
    const perAny = new Map([
      [2024, 945],
      [2025, 900],
    ]);
    expect(darrerAnyComparable(perAny)).toBe(2025);
  });

  it("no es queda sense resposta si cap any no arriba al llindar", () => {
    expect(darrerAnyComparable(new Map([[2024, 10]]))).toBe(2024);
    expect(darrerAnyComparable(new Map())).toBeNull();
  });
});

describe("medianaPerGrup", () => {
  const petits: PeerGroup = { key: "t0-2", label: "fins a 1.000 habitants", size: 3 };
  const grans: PeerGroup = { key: "t7-9", label: "de més de 20.000 habitants", size: 2 };
  const grups = new Map<number, PeerGroup>([
    [1, petits],
    [2, petits],
    [3, petits],
    [4, grans],
    [5, grans],
  ]);

  it("compara cada municipi amb els de la seva mida i no amb tot Catalunya", () => {
    const variacions = new Map<number, VariacioAmbFinal>([
      [1, { fins: 2024, diferencia: 5, percentual: 10 }],
      [2, { fins: 2024, diferencia: 11, percentual: 20 }],
      [3, { fins: 2024, diferencia: 17, percentual: 30 }],
      [4, { fins: 2024, diferencia: 100, percentual: 200 }],
      [5, { fins: 2024, diferencia: 200, percentual: 300 }],
    ]);
    const resultat = medianaPerGrup(variacions, grups);
    expect(resultat.get(1)).toEqual({ fins: 2024, diferencia: 11, percentual: 20, municipis: 3 });
    expect(resultat.get(4)).toEqual({ fins: 2024, diferencia: 150, percentual: 250, municipis: 2 });
  });

  it("no barreja períodes: un 2023-2025 no es compara amb un 2023-2024", () => {
    // Si es barregessin, el municipi que ha tancat el 2025 sortiria sempre pujant
    // més que «el seu grup» pel sol fet de comparar dos anys contra un.
    const variacions = new Map<number, VariacioAmbFinal>([
      [1, { fins: 2025, diferencia: 20, percentual: 40 }],
      [2, { fins: 2024, diferencia: 4, percentual: 8 }],
      [3, { fins: 2024, diferencia: 6, percentual: 12 }],
    ]);
    const resultat = medianaPerGrup(variacions, grups);
    // El municipi 1 és l'únic del seu grup amb any final 2025: la mediana és ell
    // mateix, i `municipis: 1` ho diu perquè ningú se la cregui.
    expect(resultat.get(1)).toEqual({ fins: 2025, diferencia: 20, percentual: 40, municipis: 1 });
    expect(resultat.get(2)).toEqual({ fins: 2024, diferencia: 5, percentual: 10, municipis: 2 });
  });

  it("dona la mediana en punts encara que ningú tingui variació relativa", () => {
    // Passa quan es partia de zero: el percentatge no existeix, la diferència sí.
    const variacions = new Map<number, VariacioAmbFinal>([
      [1, { fins: 2024, diferencia: 3, percentual: null }],
      [2, { fins: 2024, diferencia: 9, percentual: null }],
    ]);
    const resultat = medianaPerGrup(variacions, grups);
    expect(resultat.get(1)).toEqual({ fins: 2024, diferencia: 6, percentual: null, municipis: 2 });
  });

  it("ignora els municipis que no tenen grup assignat", () => {
    const variacions = new Map<number, VariacioAmbFinal>([
      [99, { fins: 2024, diferencia: 5, percentual: 10 }],
    ]);
    expect(medianaPerGrup(variacions, grups).size).toBe(0);
  });
});

describe("el catàleg de programes", () => {
  it("hi ha el programa que lliga els euros amb la taxa de reciclatge", () => {
    const residus = PROGRAMES.find((p) => p.codi === "1602");
    expect(residus?.relacionatAmb).toEqual({ kind: "residus", camp: "serie[].taxaSelectiva" });
  });

  it("cada programa diu quina pregunta respon i quina cobertura té", () => {
    for (const programa of PROGRAMES) {
      expect(programa.nom.length).toBeGreaterThan(0);
      expect(programa.perque.length).toBeGreaterThan(20);
      // Menys de 300 ajuntaments no permet comparar dins de cap grup de mida.
      expect(programa.cobertura2024).toBeGreaterThan(300);
      expect(programa.cobertura2024).toBeLessThanOrEqual(947);
    }
  });
});
