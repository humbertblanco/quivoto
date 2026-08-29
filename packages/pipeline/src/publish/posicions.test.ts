import { describe, expect, it } from "vitest";
import {
  orientaPelBloc,
  posicions,
  recompteDe,
  repartimentUnic,
  type Grup,
} from "./posicions";

/** El ple de Badalona del mandat 2023-2027: 27 escons, el PP en solitari. */
const BADALONA: Grup[] = [
  { nom: "PP", sigles: "PP", escons: 18, govern: true, color: null },
  { nom: "PSC-CP", sigles: "PSC-CP", escons: 4, govern: false, color: null },
  { nom: "ERC-AM", sigles: "ERC-AM", escons: 2, govern: false, color: null },
  { nom: "Badalona En Comú Podem", sigles: "BeCP-C", escons: 2, govern: false, color: null },
  { nom: "Guanyem Badalona", sigles: "GBeC-MCat", escons: 1, govern: false, color: null },
];

describe("recompteDe", () => {
  it("llegeix el recompte encara que els parèntesis portin comes", () => {
    expect(recompteDe("17 vots a favor (PP) i 9 en contra (Guanyem, BeCP, ERC i PSC)")).toEqual({
      favor: 17,
      contra: 9,
      abstencio: 0,
    });
  });

  it("recull les abstencions quan n'hi ha", () => {
    expect(recompteDe("rebutjada amb 3 vots a favor, 18 en contra i 4 abstencions")).toEqual({
      favor: 3,
      contra: 18,
      abstencio: 4,
    });
  });

  it("no llegeix res d'una frase sense recompte", () => {
    expect(recompteDe("aprovada la modificació de l'ordenança fiscal")).toBeNull();
  });
});

describe("repartimentUnic", () => {
  it("resol la votació quan només hi ha una manera de repartir els escons", () => {
    // 18 en contra només els pot posar el PP; els 9 restants són tota la resta.
    const r = repartimentUnic({ favor: 9, contra: 18, abstencio: 0 }, BADALONA);
    expect(r?.get("PP")).toBe("contra");
    expect(r?.get("PSC-CP")).toBe("favor");
    expect(r?.get("Guanyem Badalona")).toBe("favor");
  });

  it("no resol res quan hi ha més d'un repartiment possible", () => {
    // 2 abstencions les poden posar ERC o BeCP indistintament.
    expect(repartimentUnic({ favor: 18, contra: 7, abstencio: 2 }, BADALONA)).toBeNull();
  });

  it("no resol res si els números no sumen el ple sencer", () => {
    // 25 de 27: hi ha hagut dues absències i qualsevol repartiment és possible.
    expect(repartimentUnic({ favor: 18, contra: 7, abstencio: 0 }, BADALONA)).toBeNull();
  });
});

describe("posicions", () => {
  it("llegeix els grups quan l'acta els anomena i orienta el sentit pel govern", () => {
    // El govern (PP) vota a favor de pujar l'IBI; l'afirmació diu que caldria
    // abaixar-lo, i per això la seva posició és «desacord». Llavors votar-hi a
    // favor vol dir estar en desacord amb l'afirmació.
    const p = posicions(
      "s'aprova incrementar un 2,4% els tipus de l'IBI, amb 17 vots a favor (PP) i 9 en contra (Guanyem, BeCP, ERC i PSC)",
      "desacord",
      BADALONA,
    );
    const per = new Map(p.map((x) => [x.grup, x]));
    expect(per.get("PP")?.valor).toBe(-2);
    expect(per.get("PSC-CP")?.valor).toBe(2);
    expect(per.get("ERC-AM")?.valor).toBe(2);
    expect(per.get("PP")?.base).toBe("nominal");
  });

  it("dedueix els grups dels números quan el repartiment és únic", () => {
    const p = posicions(
      "moció per limitar els habitatges d'ús turístic, rebutjada amb 9 vots a favor i 18 en contra",
      "desacord",
      BADALONA,
    );
    const per = new Map(p.map((x) => [x.grup, x]));
    // El govern vota en contra i està en desacord amb l'afirmació: qui hi vota
    // en contra hi està en desacord, i qui hi vota a favor hi està d'acord.
    expect(per.get("PP")?.valor).toBe(-2);
    expect(per.get("PSC-CP")?.valor).toBe(2);
    expect(per.get("PP")?.base).toBe("aritmetica");
  });

  it("posa a zero qui s'absté", () => {
    const p = posicions(
      "aprovada amb 18 vots a favor (PP), 4 en contra (PSC) i 5 abstencions (ERC, BeCP i Guanyem)",
      "acord",
      BADALONA,
    );
    const per = new Map(p.map((x) => [x.grup, x]));
    expect(per.get("PP")?.valor).toBe(2);
    expect(per.get("PSC-CP")?.valor).toBe(-2);
    // L'abstenció es registra però no puntua: qui s'absté no diu «ni sí ni no».
    expect(per.get("ERC-AM")?.valor).toBeNull();
    expect(per.get("ERC-AM")?.costat).toBe("abstencio");
    expect(per.get("Badalona En Comú Podem")?.valor).toBeNull();
  });

  it("posa tothom al mateix costat quan és per unanimitat", () => {
    const p = posicions("aprovada per unanimitat al ple del 12/03/2025", "acord", BADALONA);
    expect(p).toHaveLength(BADALONA.length);
    expect(p.every((x) => x.valor === 2)).toBe(true);
  });

  it("no dedueix res si el govern es parteix entre els dos costats", () => {
    const coalicio: Grup[] = [
      { nom: "PSC", sigles: "PSC", escons: 10, govern: true, color: null },
      { nom: "ECP", sigles: "ECP", escons: 2, govern: true, color: null },
      { nom: "ERC", sigles: "ERC", escons: 3, govern: false, color: null },
    ];
    const p = posicions("aprovat amb 10 a favor (PSC) i 5 en contra (ECP i ERC)", "acord", coalicio);
    expect(p).toEqual([]);
  });

  it("no dedueix res si la posició del govern no consta", () => {
    expect(posicions("17 a favor (PP) i 9 en contra (PSC)", "desconeguda", BADALONA)).toEqual([]);
  });

  it("no dedueix res quan un nom de l'acta no lliga amb cap grup del ple", () => {
    // «Compromís per Badalona» no existeix: si no entenem la frase, val més
    // callar que repartir malament els grups que sí que hem entès.
    const p = posicions(
      "aprovat amb 17 a favor (PP) i 9 en contra (Compromís per Badalona)",
      "acord",
      BADALONA,
    );
    expect(p).toEqual([]);
  });

  it("no dedueix res d'una evidència sense votació", () => {
    expect(posicions("segons la liquidació del 2025, el romanent és de 342 M€", "acord", BADALONA))
      .toEqual([]);
  });
});

/** Esplugues: govern de 13 (PSC 10 + ECP 2 + una no adscrita), oposició de 8. */
const ESPLUGUES: Grup[] = [
  { nom: "PSC-CP", sigles: null, escons: 10, govern: true, color: null },
  { nom: "ECP-C", sigles: null, escons: 2, govern: true, color: null },
  { nom: "Regidora no adscrita", sigles: null, escons: 1, govern: true, color: null },
  { nom: "Grup Municipal Republicà", sigles: null, escons: 3, govern: false, color: null },
  { nom: "Grup Municipal Popular", sigles: null, escons: 3, govern: false, color: null },
  { nom: "Junts per Esplugues", sigles: null, escons: 1, govern: false, color: null },
  { nom: "VOX", sigles: null, escons: 1, govern: false, color: null },
];

describe("orientaPelBloc", () => {
  it("sap que el govern va votar a favor quan els contraris no caben a l'oposició", () => {
    // 17-1-1: contra i abstencions sumen 2, i l'oposició en té 8. Els 17 vots a
    // favor no es poden fer sense el govern sencer.
    expect(orientaPelBloc({ favor: 17, contra: 1, abstencio: 1 }, ESPLUGUES)).toBe("favor");
  });

  it("no diu res quan un regidor del govern podria haver votat en contra", () => {
    // 12-4-4: els 8 vots que no són a favor caben justos a l'oposició, però els
    // 12 a favor no arriben als 13 del govern. Algú del govern no hi és.
    expect(orientaPelBloc({ favor: 12, contra: 4, abstencio: 4 }, ESPLUGUES)).toBeNull();
  });

  it("no raona sobre un recompte que suma més regidories que el ple", () => {
    // 4+17+6 = 27 de 21: el text barreja dues votacions.
    expect(orientaPelBloc({ favor: 4, contra: 17, abstencio: 6 }, ESPLUGUES)).toBeNull();
  });

  it("també val quan el govern vota en contra en bloc", () => {
    expect(orientaPelBloc({ favor: 1, contra: 17, abstencio: 3 }, ESPLUGUES)).toBe("contra");
  });
});

describe("posicions amb la regla del bloc", () => {
  it("situa els grups del govern encara que l'acta no els anomeni", () => {
    const p = posicions(
      "acord núm. 7: inici de la contractació del servei de recollida, aprovat amb 17 vots a favor, 1 en contra i 1 abstenció",
      "acord",
      ESPLUGUES,
    );
    const per = new Map(p.map((x) => [x.grup, x]));
    expect(per.get("PSC-CP")?.valor).toBe(2);
    expect(per.get("PSC-CP")?.base).toBe("bloc");
    expect(per.get("ECP-C")?.valor).toBe(2);
    // De l'oposició no en sabem res: 1 en contra i 1 abstenció els podia posar
    // qualsevol dels quatre grups.
    expect(per.has("VOX")).toBe(false);
  });

  it("l'acta mana sobre la deducció quan diu qui va votar què", () => {
    const p = posicions(
      "aprovat amb 17 vots a favor, 1 en contra (Junts per Esplugues) i 1 abstenció",
      "acord",
      ESPLUGUES,
    );
    const per = new Map(p.map((x) => [x.grup, x]));
    expect(per.get("Junts per Esplugues")?.valor).toBe(-2);
    expect(per.get("Junts per Esplugues")?.base).toBe("nominal");
    expect(per.get("PSC-CP")?.base).toBe("bloc");
  });
});

describe("posicions amb l'acta llegida", () => {
  const punt = {
    data: "2024-09-18",
    numero: "7",
    titol: "contractació del servei de recollida de residus",
    url: "https://example.org/acta.pdf",
    unanimitat: false,
    vots: [
      { grup: "PSC-CP", sentit: "favor", vots: 10 },
      { grup: "ECP-C", sentit: "favor", vots: 2 },
      { grup: "Grup Municipal Republicà", sentit: "abstencio", vots: 3 },
      { grup: "Junts per Esplugues", sentit: "contra", vots: 1 },
      { grup: "VOX", sentit: "blanc", vots: 1 },
    ],
  };

  it("fa servir el vot de l'acta i situa també l'oposició", () => {
    const p = posicions("Ple de 18 de setembre de 2024, acord núm. 7", "acord", ESPLUGUES, punt);
    const per = new Map(p.map((x) => [x.grup, x]));
    expect(per.get("PSC-CP")?.valor).toBe(2);
    expect(per.get("PSC-CP")?.base).toBe("acta");
    expect(per.get("Junts per Esplugues")?.valor).toBe(-2);
    expect(per.get("Grup Municipal Republicà")?.valor).toBeNull();
    expect(per.get("Grup Municipal Republicà")?.costat).toBe("abstencio");
    // Un vot en blanc no és una posició: qui no es pronuncia no diu res.
    expect(per.has("VOX")).toBe(false);
  });

  it("l'acta preval sobre el que es deduiria dels números", () => {
    // Els números del resum dirien que tot el govern hi va votar a favor; l'acta
    // diu el mateix, però amb l'oposició desglossada, i és la que compta.
    const p = posicions(
      "aprovat amb 12 vots a favor, 1 en contra i 3 abstencions",
      "acord",
      ESPLUGUES,
      punt,
    );
    expect(p.every((x) => x.base === "acta")).toBe(true);
  });
});
