import { describe, expect, it } from "vitest";
import { llegeixCandidat } from "./j4-candidates";
import { MUNICIPAL_ELECTIONS } from "@quivoto/shared-schemas/brands";

describe("llegeixCandidat", () => {
  const fila = (extra: Record<string, string | undefined> = {}) => ({
    territori_codi: "08077",
    candidatura_codi: "12",
    candidat_nom: "Concepción(conxi)",
    candidat_primer_cognom: "Sierra",
    candidat_segon_cognom: "Martín",
    candidat_posicio: "8",
    candidat_tipus: "Titular",
    electe: "N",
    ...extra,
  });

  it("ajunta el nom i el normalitza amb la clau de tot el projecte", () => {
    const c = llegeixCandidat(fila());
    // El motiu entre parèntesis no forma part del nom: sense treure'l, la
    // mateixa persona semblaria dues entre el cens de candidats i el ple.
    expect(c?.normalized).toBe("concepcion sierra martin");
    expect(c?.fullName).toBe("Concepción(conxi) Sierra Martín");
    expect(c?.posicio).toBe(8);
  });

  it("llegeix l'electe com el marca la font, i sense marca vol dir que no", () => {
    expect(llegeixCandidat(fila({ electe: "S" }))?.elected).toBe(true);
    expect(llegeixCandidat(fila({ electe: "N" }))?.elected).toBe(false);
    expect(llegeixCandidat(fila({ electe: undefined }))?.elected).toBe(false);
  });

  it("una fila sense cap nom no és ningú", () => {
    expect(
      llegeixCandidat(
        fila({ candidat_nom: "", candidat_primer_cognom: undefined, candidat_segon_cognom: undefined }),
      ),
    ).toBe(null);
  });

  it("el tipus per defecte és Titular i la posició buida és zero", () => {
    const c = llegeixCandidat(fila({ candidat_tipus: undefined, candidat_posicio: "" }));
    expect(c?.kind).toBe("Titular");
    expect(c?.posicio).toBe(0);
  });
});

/**
 * Per defecte J4 ingereix les tres municipals que J2 ja carrega de resultats:
 * és el que fa que la fitxa de cada persona pugui dir quantes vegades ha anat
 * a llistes. Comprovat el 31-08-2026 que `xnfg-weec` porta les tres senceres,
 * amb `electe` i `candidat_posicio` (42.867, 43.543 i 43.710 files).
 */
it("les eleccions per defecte de J4 són les tres municipals compartides", () => {
  expect([...MUNICIPAL_ELECTIONS]).toEqual(["M20231", "M20191", "M20151"]);
});
