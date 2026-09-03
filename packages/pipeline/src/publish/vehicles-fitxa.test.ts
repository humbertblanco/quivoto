import { describe, expect, it } from "vitest";
import type { VehiclesMetric } from "../jobs/j34-vehicles";
import { LLICENCIA_IDESCAT, NOTA_COMPETENCIES, NOTA_QUE_COMPTA, PAGINA_IDESCAT } from "../jobs/j34-vehicles";
import { curiositatsVehicles, esFlota, renderVehicles, renderVehiclesBloc, type FilaVehicles } from "./vehicles-fitxa";

/** Girona el 2024, amb les xifres reals de l'Idescat i el padró del mateix any. */
const girona: VehiclesMetric = {
  font: {
    nom: "Parc de vehicles",
    organisme: "Idescat, a partir de la DGT.",
    url: PAGINA_IDESCAT,
    enllac: { taula: "t18", titol: "Parc de vehicles", href: "https://www.idescat.cat/pub/?id=parcc&n=291&geo=mun:170792" },
    api: "https://api.idescat.cat/emex/v1/dades.json?tipus=mun&i=f19%2Cf325%2Cf272%2Cf326%2Cf163&lang=ca",
    taula: "t18",
    llicencia: LLICENCIA_IDESCAT,
    consultat: "2026-09-03",
    actualitzat: "2025-11-10T11:00:00+00:00",
  },
  any: 2024,
  parc: { total: 70297, turismes: 46124, motocicletes: 12436, industrials: 9815, altres: 1922 },
  pes: { turismes: 65.6, motocicletes: 17.7 },
  poblacio: { any: 2024, habitants: 105052, anyPadro: 2024 },
  perMil: { total: 669.2, turismes: 439.1, motocicletes: 118.4, industrials: 93.4, altres: 18.3 },
  comparacio: {
    grup: { clau: "t9-9", etiqueta: "de més de 100.000 habitants", mida: 11, ambDada: 11 },
    percentil: 45,
    mediana: 612.3,
  },
  context: { decideixLAjuntament: false, nota: NOTA_COMPETENCIES },
  nota: NOTA_QUE_COMPTA,
};

describe("renderVehicles", () => {
  const html = renderVehicles(girona);

  it("és una secció de la fitxa amb la tessel·la de vehicles per 1.000 habitants", () => {
    expect(html).toContain('<section class="bloc" id="vehicles">');
    expect(html).toContain("<h2>Quants vehicles hi ha</h2>");
    expect(html).toContain('<ul class="tires">');
    expect(html).toContain('<span class="etq">Vehicles per 1.000 habitants</span>');
    expect(html).toContain('<span class="xifra">669</span>');
  });

  it("compara amb els de la seva mida, amb la mediana, quants i el percentil", () => {
    expect(html).toContain("la mediana dels 11 de la seva mida, <b>612</b>");
    expect(html).toContain("percentil 45");
  });

  it("desglossa turismes i motocicletes, amb el pes i la taxa", () => {
    expect(html).toContain('<span class="etq">Turismes</span>');
    expect(html).toContain("46.124");
    expect(html).toContain("439 per 1.000 hab.");
    expect(html).toContain("65,6&nbsp;% del parc");
    expect(html).toContain("Camions, furgonetes i tractors industrials");
    expect(html).toContain("Autobusos i altres");
  });

  it("porta l'enllaç de l'Idescat tal com el va donar l'API, l'any, el padró i la data", () => {
    expect(html).toContain('href="https://www.idescat.cat/pub/?id=parcc&amp;n=291&amp;geo=mun:170792"');
    expect(html).toContain("Idescat, a partir de la DGT.");
    expect(html).toContain("parc de vehicles del 2024");
    expect(html).toContain("padró del 2024 (105.052 habitants)");
    expect(html).toContain("consultat el 2026-09-03");
    expect(html).toContain("actualitzat el 2025-11-10");
  });

  it("no jutja: diu què compta i què hi decideix l'ajuntament", () => {
    expect(html).toContain("Què hi decideix l'ajuntament.");
    expect(html).toContain("no els que hi circulen");
    expect(html).not.toMatch(/millor|pitjor/);
  });

  it("sense enllaç de municipi enllaça la pàgina general de l'Idescat, i sense padró no fa taxa", () => {
    const sense: VehiclesMetric = {
      ...girona,
      font: { ...girona.font, enllac: null },
      poblacio: null,
      perMil: null,
      comparacio: null,
    };
    const bloc = renderVehiclesBloc(sense);
    expect(bloc).toContain(`href="${PAGINA_IDESCAT}"`);
    expect(bloc).toContain("sense padró de l'any 2024 no es pot fer la taxa");
    expect(bloc).not.toContain("per cada 1.000 habitants</b>");
    expect(bloc).not.toContain("mediana");
  });

  it("amb el padró vigent en comptes del de l'any, ho diu", () => {
    const vigent: VehiclesMetric = { ...girona, poblacio: { any: 2024, habitants: 105052, anyPadro: null } };
    expect(renderVehiclesBloc(vigent)).toContain("padró vigent");
    const proper: VehiclesMetric = { ...girona, poblacio: { any: 2024, habitants: 104000, anyPadro: 2023 } };
    expect(renderVehiclesBloc(proper)).toContain("padró del 2023 (104.000 habitants), el més proper");
  });

  it("una mediana passada des de fora mana sobre la desada", () => {
    const bloc = renderVehiclesBloc(girona, {
      mediana: 700.4, quants: 9, etiqueta: "de més de 100.000 habitants", percentil: 30, valors: [],
    });
    expect(bloc).toContain("la mediana dels 9 de la seva mida, <b>700</b>");
    expect(bloc).toContain("percentil 30");
  });

  it("sense mètrica el buit es diu clar i la secció no desapareix", () => {
    const buit = renderVehicles(null);
    expect(buit).toContain('<section class="bloc" id="vehicles">');
    expect(buit).toContain("L'Idescat no publica el parc de vehicles d'aquest municipi");
    expect(buit).toContain("un buit no és un zero");
  });
});

describe("una flota domiciliada", () => {
  it("es diu per habitant i no per mil, s'explica, i no es compara amb els de la seva mida", () => {
    const rajadell: VehiclesMetric = {
      ...girona,
      parc: { total: 26574, turismes: 7508, motocicletes: 640, industrials: 11518, altres: 6908 },
      perMil: { total: 44737.4, turismes: 12640, motocicletes: 1077, industrials: 19391, altres: 11630 },
    };
    const html = renderVehicles(rajadell);
    expect(html).toContain("45 per cada habitant");
    expect(html).toContain("rènting");
    expect(html).toContain("no entra al rànquing");
    expect(html).toContain("flota domiciliada: no es compara");
    expect(html).not.toContain("percentil");
  });
  it("comença per sobre de dos vehicles per habitant", () => {
    expect(esFlota(2000)).toBe(false);
    expect(esFlota(2000.1)).toBe(true);
    expect(esFlota(null)).toBe(false);
  });
});

describe("curiositatsVehicles", () => {
  const fila = (s: string, p: number, veh: number | null, veha = 2024): FilaVehicles => ({
    s, n: s.toUpperCase(), c: "Comarca", p, veh, veha,
  });
  const files: FilaVehicles[] = [
    fila("a", 200, 1450),
    fila("b", 900, 1120),
    fila("c", 50_000, 640),
    fila("d", 1_600_000, 520),
    fila("e", 3_000, 700),
    fila("f", 400, null),
    { s: "g", n: "G", c: "Comarca", p: 120 },
  ];

  it("troba on hi ha més vehicles que persones, i els ordena de més a menys", () => {
    const fets = curiositatsVehicles(files);
    const mes = fets.find((f) => f.id === "mes-vehicles-que-persones")!;
    expect(mes.llistes[0]!.files.map((f) => f.municipi.s)).toEqual(["a", "b"]);
    expect(mes.llistes[0]!.files[0]!.valor).toBe("1.450 per 1.000 hab.");
    expect(mes.metode).toContain("n'hi ha 2");
    expect(mes.periode).toBe("2024");
    expect(mes.font).toContain("Idescat");
  });

  it("i on n'hi ha menys per habitant, de menys a més", () => {
    const menys = curiositatsVehicles(files).find((f) => f.id === "menys-vehicles")!;
    expect(menys.llistes[0]!.files.map((f) => f.municipi.s)).toEqual(["d", "c", "e", "b", "a"]);
  });

  it("diu sobre quants s'ha mirat: els que tenen dada, dels 947 de la fila", () => {
    const [fet] = curiositatsVehicles(files);
    expect(fet!.cobertura).toBe("S'ha mirat el parc de vehicles de 5 municipis dels 7.");
  });

  it("sense cap municipi per sobre de 1.000 no hi ha la primera curiositat, i sense cap dada no n'hi ha cap", () => {
    const totsSota = curiositatsVehicles(files.filter((f) => (f.veh ?? 0) <= 1000));
    expect(totsSota.map((f) => f.id)).toEqual(["menys-vehicles"]);
    expect(curiositatsVehicles([{ s: "g", n: "G", c: "Comarca", p: 120 }])).toEqual([]);
  });
});
