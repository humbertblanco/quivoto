import { describe, expect, it } from "vitest";
import {
  codiEns10,
  dataIso,
  resumContractacio,
  resumOrdenances,
  resumOrganismes,
  triaCartipas,
  ultimAnyComplet,
  type FilaContractacio,
} from "./j10-activitat";

describe("codiEns10", () => {
  it("recupera el zero inicial que les fonts perden", () => {
    expect(codiEns10("801930008")).toBe("0801930008");
    expect(codiEns10("2500190004")).toBe("2500190004");
  });

  it("descarta els valors escombraria de la font", () => {
    // Les ordenances porten 516 files amb «None» i 455 amb «0»: cap és un municipi.
    expect(codiEns10("None")).toBe("");
    expect(codiEns10(null)).toBe("");
    expect(codiEns10("0")).toBe("0000000000");
  });
});

describe("dataIso", () => {
  const avui = new Date("2026-08-29T00:00:00Z");

  it("es queda amb la part de la data", () => {
    expect(dataIso("2024-12-04T00:00:00", avui)).toBe("2024-12-04");
  });

  it("rebutja les dates impossibles que hi ha a la font", () => {
    expect(dataIso("0011-02-10T00:00:00", avui)).toBeNull();
    expect(dataIso("2026-10-22T00:00:00", avui)).toBeNull();
    expect(dataIso("", avui)).toBeNull();
    expect(dataIso(null, avui)).toBeNull();
  });
});

describe("ultimAnyComplet", () => {
  it("no dona per tancat l'any que encara s'està omplint", () => {
    expect(ultimAnyComplet("2026-08-21")).toBe(2025);
    expect(ultimAnyComplet("2025-12-31")).toBe(2025);
    expect(ultimAnyComplet(null)).toBeNull();
  });
});

describe("resumContractacio", () => {
  const files: FilaContractacio[] = [
    { ens: "0801930008", any: 2025, contractes: 100, volum: 500_000, licitacions: 20, ambOfertes: 20, sumaOfertes: 60, unaOferta: 8 },
    { ens: "0801930008", any: 2026, contractes: 40, volum: 200_000, licitacions: 10, ambOfertes: 10, sumaOfertes: 20, unaOferta: 6 },
  ];

  it("calcula el volum per habitant de l'últim any sencer, no de la finestra sencera", () => {
    const resum = resumContractacio(files, 1_000, 2025);
    expect(resum.volumPerHabitant).toBe(500);
    expect(resum.anys.find((a) => a.any === 2026)?.complet).toBe(false);
  });

  it("mesura la competència sobre tota la finestra", () => {
    const resum = resumContractacio(files, 1_000, 2025);
    // 14 licitacions amb una sola oferta de 30 amb ofertes informades.
    expect(resum.finestra.unaOfertaPct).toBe(47);
    expect(resum.finestra.ofertesMitjana).toBeCloseTo(2.7, 1);
    expect(resum.finestra.licitacions).toBe(30);
  });

  it("no inventa un per habitant quan no hi ha padró", () => {
    const resum = resumContractacio(files, null, 2025);
    expect(resum.volumPerHabitant).toBeNull();
    expect(resum.anys[0]!.volumPerHabitant).toBeNull();
  });

  it("deixa la competència en blanc si cap licitació no diu quantes ofertes va rebre", () => {
    const menors: FilaContractacio[] = [
      { ens: "x", any: 2025, contractes: 12, volum: 30_000, licitacions: 0, ambOfertes: 0, sumaOfertes: 0, unaOferta: 0 },
    ];
    const resum = resumContractacio(menors, 500, 2025);
    expect(resum.finestra.unaOfertaPct).toBeNull();
    expect(resum.finestra.ofertesMitjana).toBeNull();
    expect(resum.finestra.contractes).toBe(12);
  });
});

describe("resumOrdenances", () => {
  const avui = new Date("2026-08-29T00:00:00Z");
  const files = [
    { titol: "Ordenança de civisme ", data: "2024-03-01T00:00:00", enllac: "https://cido.diba.cat/normativa_local/1" },
    { titol: "Reglament del cementiri", data: "2025-09-10T00:00:00", enllac: "https://cido.diba.cat/normativa_local/2" },
    { titol: "Ordenança antiga", data: "2019-01-01T00:00:00", enllac: "https://cido.diba.cat/normativa_local/3" },
    { titol: "  ", data: "2025-01-01T00:00:00", enllac: "" },
  ];

  it("només compta el que s'ha aprovat durant el mandat", () => {
    const resum = resumOrdenances(files, "2023-06-17", avui);
    expect(resum.mandat).toBe(2);
  });

  it("posa la més recent la primera i neteja el títol", () => {
    const resum = resumOrdenances(files, "2023-06-17", avui);
    expect(resum.ultimes[0]!.data).toBe("2025-09-10");
    expect(resum.ultimes[1]!.titol).toBe("Ordenança de civisme");
  });

  it("no en desa més de cinc", () => {
    const moltes = Array.from({ length: 12 }, (_, i) => ({
      titol: `Ordenança ${i}`,
      data: `2025-01-${String(i + 1).padStart(2, "0")}T00:00:00`,
      enllac: "https://cido.diba.cat/normativa_local/9",
    }));
    expect(resumOrdenances(moltes, "2023-06-17", avui).ultimes).toHaveLength(5);
  });
});

describe("triaCartipas", () => {
  it("tria el document de l'ajuntament, no el dels seus instituts", () => {
    const cartipas = triaCartipas([
      {
        nomEns: "Ajuntament de Barcelona - Institut de Cultura de Barcelona",
        titol: "Cartipàs municipal per al mandat 2023-2027",
        data: "2026-08-20T00:00:00",
        enllac: "https://cido.diba.cat/normativa_local/1",
        vigent: "True",
      },
      {
        nomEns: "Ajuntament de Barcelona",
        titol: "Cartipàs municipal per al mandat 2023-2027",
        data: "2026-08-04T00:00:00",
        enllac: "https://cido.diba.cat/normativa_local/2",
        vigent: "True",
      },
    ]);
    expect(cartipas?.enllac).toBe("https://cido.diba.cat/normativa_local/2");
  });

  it("entre dos documents propis es queda amb el darrer publicat", () => {
    const cartipas = triaCartipas([
      { nomEns: "Ajuntament de Salt", titol: "Cartipàs", data: "2023-07-01T00:00:00", enllac: "a", vigent: "True" },
      { nomEns: "Ajuntament de Salt", titol: "Cartipàs", data: "2025-02-01T00:00:00", enllac: "b", vigent: "True" },
    ]);
    expect(cartipas?.data).toBe("2025-02-01");
  });

  it("no publica un cartipàs derogat", () => {
    // VIGENT val «True»/«False», no «S»/«N»: aquest camp ja ens havia enganyat.
    expect(
      triaCartipas([
        { nomEns: "Ajuntament de Salt", titol: "Cartipàs", data: "2023-07-01T00:00:00", enllac: "a", vigent: "False" },
      ]),
    ).toBeNull();
  });
});

describe("resumOrganismes", () => {
  const resum = resumOrganismes([
    { nom: "Residència Geriàtrica Mas Vell", tipus: "Ens de gestió", relacio: "Ens de gestió pertany a Ajuntament" },
    { nom: "Aigües SA", tipus: "Societats mercantils participades íntegr", relacio: "Societat ppl està adscrita a Ajuntament" },
    { nom: "Fundació Local", tipus: "Fundacions", relacio: "Fundació adscrita a municipi" },
    { nom: "  ", tipus: "Fundacions", relacio: "" },
  ]);

  it("compta els organismes i els agrupa per tipus", () => {
    expect(resum.total).toBe(3);
    expect(resum.perTipus).toEqual({
      "Ens de gestió": 1,
      Fundacions: 1,
      "Societats mercantils 100% municipals": 1,
    });
  });

  it("desfà el nom de tipus que la font deixa a mitges", () => {
    const societat = resum.organismes.find((o) => o.nom === "Aigües SA");
    expect(societat?.tipus).toBe("Societats mercantils 100% municipals");
  });
});
