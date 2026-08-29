import { describe, expect, it } from "vitest";
import { citesDe, hiEs, nucli, senseMarquesDaigua } from "./cites";

describe("citesDe", () => {
  it("agafa les cites entre cometes baixes", () => {
    expect(citesDe("Ple del 12/03: «el nou tipus de gravamen serà del 0,70224 per cent»")).toEqual([
      "el nou tipus de gravamen serà del 0,70224 per cent",
    ]);
  });

  it("no comprova les cites curtes: «aprovat» surt a qualsevol document", () => {
    expect(citesDe("s'aprova amb «aprovat» i prou")).toEqual([]);
  });

  it("n'agafa més d'una del mateix text", () => {
    expect(
      citesDe("diu «una primera cita prou llarga per comptar» i també «una segona igual de llarga»"),
    ).toHaveLength(2);
  });
});

describe("hiEs", () => {
  const doc = nucli(
    "Es proposa aprovar un nou tipus de gravamen del 0,70224 per cent per als béns urbans, " +
      "amb efectes de l'1 de gener de 2024, i mantenir la resta de bonificacions vigents.",
  );

  it("troba una cita literal", () => {
    expect(hiEs("aprovar un nou tipus de gravamen del 0,70224 per cent", doc)).toBe(true);
  });

  it("no troba una cita que no hi és", () => {
    expect(hiEs("aprovar un nou tipus de gravamen del 0,85 per cent", doc)).toBe(false);
  });

  it("tolera els accents, els espais i els salts de línia", () => {
    expect(hiEs("aprovar  un nou\ntipus de gravamen\ndel 0,70224 per cent", doc)).toBe(true);
  });

  it("entén els punts suspensius com una el·lipsi", () => {
    expect(hiEs("aprovar un nou tipus de gravamen... mantenir la resta de bonificacions", doc)).toBe(true);
  });

  it("però no accepta una el·lipsi amb els trossos desordenats", () => {
    // Si sortissin a l'inrevés, la cita diria una cosa que el document no diu.
    expect(hiEs("mantenir la resta de bonificacions... aprovar un nou tipus de gravamen", doc)).toBe(false);
  });

  it("tolera un número de pàgina ficat enmig d'una paraula", () => {
    // El PDF d'un ple de Lleida cola el «38» dins de «reforçar la seguretat».
    const ambPagina = nucli("per reforçar la ") + "38" + nucli("seguretat ciutadana del municipi");
    expect(hiEs("per reforçar la seguretat ciutadana", ambPagina)).toBe(true);
  });

  it("i tot i així no deixa passar una xifra canviada", () => {
    // La tolerància només salta dígits allà on la cita porta lletra: una xifra
    // que no quadra continua fent saltar la comprovació, que és el cas que ens
    // importa —una cita inventada sol portar un número inventat.
    const d = nucli("els preus públics es van revisar un 6,0 per cent aquest exercici");
    expect(hiEs("es van revisar un 8,5 per cent", d)).toBe(false);
  });
});

describe("senseMarquesDaigua", () => {
  it("treu una lletra solta que el PDF cola enmig d'una frase", () => {
    // A les actes de Lleida, «DOCUMENT PENDENT D'APROVACIÓ» va escrit lletra a
    // lletra al marge i l'extractor la deixa caure entremig del text.
    const cru = "19 vots en contra dels membres\nT\ndels grups municipals PSC-UNITS-CP";
    expect(nucli(senseMarquesDaigua(cru))).toContain(nucli("dels membres dels grups municipals"));
  });

  it("treu la línia del codi segur de verificació", () => {
    const cru = "d'inversió\nCSV: 023a6da3-4f21-4bc1-9d0e-77aa1c2b5e90\ncol·lectiva";
    expect(nucli(senseMarquesDaigua(cru))).toContain(nucli("d'inversió col·lectiva"));
  });

  it("no toca les paraules d'una lletra en minúscula, que són català", () => {
    // «a», «i» i «o» són paraules: treure-les trencaria cites bones.
    const cru = "va a la plaça i al carrer";
    expect(nucli(senseMarquesDaigua(cru))).toBe(nucli("va a la plaça i al carrer"));
  });

  it("no deixa passar una cita que el document no diu", () => {
    // La tolerància només esborra caràcters del document: una cita que afirmi
    // més del que hi ha continua fallant.
    const cru = nucli(senseMarquesDaigua("es van revisar un 6,0 per cent aquest exercici"));
    expect(hiEs("es van revisar un 8,5 per cent", cru)).toBe(false);
  });
});
