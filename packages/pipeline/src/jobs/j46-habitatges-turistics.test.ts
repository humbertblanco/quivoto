import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  consultaRegistre,
  metricaDeMunicipi,
  perCentHabitants,
  plegaRegistre,
  type FilaRegistreAgregada,
} from "./j46-habitatges-turistics";

/**
 * La resposta és la real de la consulta agregada del registre de turisme
 * (`t2h3-cgys`) del 27 d'octubre del 2026, retallada a tres municipis:
 * Abella de la Conca (6 HUT i 2 cases de turisme rural), Bellver de
 * Cerdanya (152 HUT, 10 hotels, un càmping, 8 de turisme rural i 3
 * apartaments) i Cadaqués (997 HUT, 31 hotels, un càmping, un apartament i
 * 21 llars compartides). Cap fila no porta cap camp del titular.
 */
const FIXTURES = join(__dirname, "..", "adapters", "__fixtures__");
const files = JSON.parse(readFileSync(join(FIXTURES, "registre-turisme-agregat.json"), "utf8")) as FilaRegistreAgregada[];

describe("la consulta", () => {
  it("és agregada i no demana cap camp del titular", () => {
    const c = consultaRegistre();
    expect(c.select).toContain("count(*)");
    expect(c.where).toBe("estat='Alta'");
    for (const camp of ["nom_del_titular", "primer_cognom", "segon_cognom", "ra_social_del_titular", "cif", "nom_de_la_via"]) {
      expect(c.select).not.toContain(camp);
      expect(c.group).not.toContain(camp);
    }
  });

  it("la fixture tampoc no en porta cap", () => {
    const camps = new Set(files.flatMap((f) => Object.keys(f)));
    expect([...camps].sort()).toEqual(["codi_municipi_idescat", "n", "tipus_establiment", "total_places"]);
  });
});

describe("el plegat", () => {
  const { perCodi, tipusDesconeguts, senseCodi } = plegaRegistre(files);

  it("compta els establiments per tipus i municipi", () => {
    const cadaques = perCodi.get("170329")!;
    expect(cadaques.hut.establiments).toBe(997);
    expect(cadaques.hotels.establiments).toBe(31);
    expect(cadaques.campings.establiments).toBe(1);
    expect(cadaques.turismeRural.establiments).toBe(0);
    expect(cadaques.altres.establiments).toBe(22);
    expect(cadaques.altresDetall).toEqual({ apartaments: 1, llarsCompartides: 21, autocaravanes: 0, desconegut: 0 });
    expect(perCodi.get("250019")!.hut.establiments).toBe(6);
    expect(perCodi.get("250518")!.turismeRural.establiments).toBe(8);
    expect(tipusDesconeguts.size).toBe(0);
    expect(senseCodi).toBe(0);
  });

  it("suma les places només dels que les declaren, i diu quants són", () => {
    const cadaques = perCodi.get("170329")!;
    // Només 62 dels 997 HUT porten places: la suma és un mínim, no el total.
    expect(cadaques.hut).toEqual({ establiments: 997, places: 324, ambPlaces: 62 });
    expect(cadaques.hotels).toEqual({ establiments: 31, places: 1271, ambPlaces: 31 });
  });

  it("aparta un tipus nou, una fila sense codi i unes places absurdes", () => {
    const r = plegaRegistre([
      { codi_municipi_idescat: "170329", tipus_establiment: "Albergs", n: "2" },
      { codi_municipi_idescat: null, tipus_establiment: "Hotels", n: "3" },
      { codi_municipi_idescat: "170329", tipus_establiment: "Hotels", total_places: "999999", n: "1" },
    ]);
    expect([...r.tipusDesconeguts]).toEqual(["Albergs"]);
    expect(r.perCodi.get("170329")!.altresDetall.desconegut).toBe(2);
    expect(r.senseCodi).toBe(3);
    expect(r.placesFora).toBe(1);
    expect(r.perCodi.get("170329")!.hotels).toEqual({ establiments: 1, places: 0, ambPlaces: 0 });
  });
});

describe("la mètrica", () => {
  const { perCodi } = plegaRegistre(files);
  const ctx = {
    poblacioAny: 2025,
    dataConsulta: "2026-10-27",
    actualitzat: "2026-10-05",
    catalunya: { hut: 104_502, municipisAmbHut: 874, hutPer100Hab: 1.3 },
  };

  it("fa els HUT per 100 habitants amb el padró", () => {
    const m = metricaDeMunicipi(perCodi.get("170329"), { ...ctx, poblacio: 2918 });
    expect(m.hutPer100Hab).toBe(34.17);
    expect(m.hut.establiments).toBe(997);
    expect(m.font.dataset).toBe("t2h3-cgys");
  });

  it("un municipi que no surt al registre té zeros, no buits", () => {
    const m = metricaDeMunicipi(undefined, { ...ctx, poblacio: 120 });
    expect(m.hut.establiments).toBe(0);
    expect(m.hotels.establiments).toBe(0);
    expect(m.hutPer100Hab).toBe(0);
  });

  it("sense padró, la ràtio és nul·la", () => {
    expect(perCentHabitants(10, null)).toBeNull();
    expect(perCentHabitants(10, 0)).toBeNull();
  });
});
