import { describe, expect, it } from "vitest";
import { normalize } from "../lib/text";
import { AREES, FIGURES, SERVEIS } from "./j8-diners";

/**
 * Les claus del mapa de figures són text ja normalitzat. Si algú n'escriu una a
 * mà i no la passa per `normalize`, la figura desapareix en silenci de tots els
 * municipis: és el que va passar amb l'impost sobre construccions, que porta un
 * punt volat a «instal·lacions» i es va quedar fora dels 947.
 */
describe("FIGURES", () => {
  it("totes les claus són el resultat de normalitzar-les", () => {
    for (const clau of Object.keys(FIGURES)) expect(normalize(clau)).toBe(clau);
  });

  it("l'impost sobre construccions hi lliga amb el nom tal com el publica la font", () => {
    expect(FIGURES[normalize("IMPOST SOBRE CONSTRUCCIONS, INSTAL·LACIONS I OBRES")]).toBe("Obres");
  });

  it("les àrees de despesa i els serveis també estan normalitzats", () => {
    for (const clau of Object.keys(AREES)) expect(normalize(clau)).toBe(clau);
    for (const clau of Object.keys(SERVEIS)) expect(normalize(clau)).toBe(clau);
  });

  it("i les altres figures també", () => {
    expect(FIGURES[normalize("IMPOST SOBRE BÉNS IMMOBLES")]).toBe("IBI");
    expect(FIGURES[normalize("IMPOST SOBRE VEHICLES DE TRACCIÓ MECÀNICA")]).toBe("Vehicles");
    expect(FIGURES[normalize("IMPOST SOBRE ACTIVITATS ECONÒMIQUES")]).toBe("Activitats econòmiques");
  });
});
