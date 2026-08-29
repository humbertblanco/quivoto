import { describe, expect, it } from "vitest";
import { acordCitat, dataCitada, puntDe, type PuntActa } from "./enllac-actes";

const punt = (data: string, numero: string | null, ambVot = true): PuntActa => ({
  data,
  numero,
  titol: "un punt qualsevol",
  url: "https://example.org/acta.pdf",
  unanimitat: false,
  vots: ambVot ? [{ grup: "PSC", sentit: "favor", vots: 10 }] : [],
});

describe("dataCitada", () => {
  it("llegeix la data escrita en lletres", () => {
    expect(dataCitada("Ple de 18 d'octubre de 2023, acord núm. 6: modificació de l'IBI")).toBe(
      "2023-10-18",
    );
  });

  it("llegeix la data escrita en números", () => {
    expect(dataCitada("Ple del 27/10/2025: s'aprova incrementar un 2,4% els tipus")).toBe(
      "2025-10-27",
    );
  });

  it("es queda amb el primer ple quan l'evidència en cita dos", () => {
    // El segon ple hi surt com a context; el que sosté l'afirmació és el primer.
    expect(
      dataCitada(
        "Ple del 27/10/2025: s'aprova incrementar l'IBI. El 18/10/2024 el tipus ja havia passat del 0,769% al 0,792%.",
      ),
    ).toBe("2025-10-27");
  });

  it("no s'inventa una data quan no n'hi ha", () => {
    expect(dataCitada("Informe municipal de resolució d'al·legacions")).toBeNull();
  });
});

describe("acordCitat", () => {
  it("llegeix el número d'acord", () => {
    expect(acordCitat("Ple de 18 d'octubre de 2023, acord núm. 6: modificació")).toBe("6");
  });

  it("torna null quan l'evidència no en cita cap", () => {
    expect(acordCitat("Ple del 27/10/2025: s'aprova incrementar l'IBI")).toBeNull();
  });
});

describe("puntDe", () => {
  const punts = [punt("2023-10-18", "6"), punt("2023-10-18", "8"), punt("2025-10-27", "3")];

  it("troba el punt exacte amb data i número d'acord", () => {
    expect(puntDe("Ple de 18 d'octubre de 2023, acord núm. 6: l'IBI", punts)?.numero).toBe("6");
  });

  it("no tria res quan la data sola apunta a dos punts votats", () => {
    expect(puntDe("Ple de 18 d'octubre de 2023: es va aprovar l'IBI", punts)).toBeNull();
  });

  it("accepta la data sola quan aquell ple només té un punt votat", () => {
    expect(puntDe("Ple del 27/10/2025: s'aprova incrementar l'IBI", punts)?.numero).toBe("3");
  });

  it("tolera que l'acta escrigui el número amb punt", () => {
    expect(puntDe("Ple de 18 d'octubre de 2023, acord núm. 6", [punt("2023-10-18", "6.")])?.numero)
      .toBe("6.");
  });

  it("no troba res si el ple citat no s'ha pogut llegir", () => {
    expect(puntDe("Ple de 3 de març de 2024, acord núm. 2", punts)).toBeNull();
  });
});
