import { describe, expect, it } from "vitest";
import { detectManagementChanges, managementModel, termOf, type ManagementYear } from "./j8-diners";

/** Escurça la sèrie: «dd i i» vol dir dos anys de directa i dos d'indirecta des del 2020. */
const serie = (models: string, from = 2020): ManagementYear[] =>
  models.split(" ").map((m, i) => ({
    year: from + i,
    model: { d: "directa", i: "indirecta", s: "supramunicipal", n: "noPrestat", a: "altres" }[m] as never,
  }));

describe("managementModel", () => {
  it("agrupa les quinze etiquetes del Ministeri en els quatre models reals", () => {
    expect(managementModel("Gestión directa por la entidad local")).toBe("directa");
    expect(managementModel("Gestión directa por sociedad mercantil local")).toBe("directa");
    expect(managementModel("Gestión directa por organismo autónomo de la entidad local")).toBe("directa");
    expect(managementModel("Gestión indirecta mediante concesión, gestionando el concesionario el servicio a su riesgo y ventura")).toBe("indirecta");
    expect(managementModel("Gestión indirecta por sociedad de economía mixta")).toBe("indirecta");
    expect(managementModel("Gestión mancomunada/comarcal/por la Diputación/otro tipo de agrupación municipal")).toBe("supramunicipal");
    expect(managementModel("Gestión consorciada + otra forma de gestión (*)")).toBe("supramunicipal");
    expect(managementModel("Gestión por convenio de colaboración interadministrativo")).toBe("supramunicipal");
    expect(managementModel("No se presta el servicio")).toBe("noPrestat");
    expect(managementModel("Otro tipo de gestión (**)")).toBe("altres");
  });
});

describe("detectManagementChanges", () => {
  it("veu el canvi quan el model nou es manté dos exercicis", () => {
    const [change, ...rest] = detectManagementChanges(serie("i i d d"));
    expect(rest).toHaveLength(0);
    expect(change).toMatchObject({ year: 2022, from: "indirecta", to: "directa", confirmed: true, heldYears: 2 });
    expect(change!.toLabel).toBe("gestió directa");
  });

  it("no afirma res per un any solt: ni el canvi d'anada ni el de tornada", () => {
    // El 5-6 % de les files de la font canvien d'etiqueta cada any i tornen al
    // seu lloc l'any següent. Això és una reclassificació, no una decisió.
    expect(detectManagementChanges(serie("d d i d d"))).toHaveLength(0);
  });

  it("marca com a no confirmat el model que només s'ha vist l'últim any", () => {
    const changes = detectManagementChanges(serie("d d d i"));
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ year: 2023, to: "indirecta", confirmed: false, heldYears: 1 });
  });

  it("ignora «altres formes», que no diu qui presta el servei", () => {
    // Directa, un any sense classificar, i directa una altra vegada: cap canvi.
    expect(detectManagementChanges(serie("d d a d d"))).toHaveLength(0);
    // I un any opac enmig no trenca el canvi que hi ha a banda i banda.
    expect(detectManagementChanges(serie("d d a i i"))).toMatchObject([{ from: "directa", to: "indirecta", year: 2023 }]);
  });

  it("deixa «no es presta» fora del canvi de model si no se li demana", () => {
    expect(detectManagementChanges(serie("n n d d"))).toHaveLength(0);
    expect(
      detectManagementChanges(serie("n n d d"), { compare: ["directa", "indirecta", "supramunicipal", "noPrestat"] }),
    ).toMatchObject([{ from: "noPrestat", to: "directa", confirmed: true }]);
  });

  it("aguanta els forats de la sèrie sense inventar-se anys", () => {
    const ambForat: ManagementYear[] = [
      { year: 2019, model: "directa" },
      { year: 2020, model: "directa" },
      // El 2021 aquest municipi no va declarar res.
      { year: 2022, model: "indirecta" },
      { year: 2023, model: "indirecta" },
    ];
    expect(detectManagementChanges(ambForat)).toMatchObject([{ year: 2022, from: "directa", to: "indirecta", confirmed: true }]);
  });

  it("posa cada canvi al mandat que li toca", () => {
    expect(termOf(2018)).toBe("2015-2019");
    expect(termOf(2022)).toBe("2019-2023");
    expect(termOf(2023)).toBe("2023-2027");
  });
});
