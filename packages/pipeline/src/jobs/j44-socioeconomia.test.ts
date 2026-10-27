import { mkdtemp, rm, utimes } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseEmexMassiu } from "../adapters/idescat";
import {
  aturCatalunya,
  aturDelMunicipi,
  calBaixar,
  comprovaIndicadors,
  decodificaLatin1,
  fitxerDeLAny,
  indicadorsDelMunicipi,
  llegeixPeriode,
  llegeixRecompte,
  mesosEntre,
  mitjanesAnuals,
  parseAturSepe,
  periodesEmex,
  sumaMesos,
  taxaDelMes,
  type FilaAtur,
} from "./j44-socioeconomia";

/**
 * Els fixtures són reals, retallats: els CSV del SEPE del 2023 i del 2026
 * baixats el 27 d'octubre del 2026 amb només set municipis catalans —Abella
 * de la Conca, Abrera, Barcelona, el Brull, Girona, Sabadell i Xerta— i una
 * fila d'Abla (Almeria) que no ha de passar el filtre; i la resposta massiva
 * de l'EMEX del mateix dia retallada als mateixos municipis. Girona és la que
 * s'ha contrastat a mà; el Brull és el que té mesos amagats com a `<5`.
 */
const FIXTURES = join(__dirname, "..", "adapters", "__fixtures__");
const csv = (any: number): string => decodificaLatin1(readFileSync(join(FIXTURES, `sepe-atur-${any}.csv`)));
const brut = JSON.parse(readFileSync(join(FIXTURES, "idescat-emex-socioeconomia-mun.json"), "utf8")) as unknown;
const emex = parseEmexMassiu(brut);
const periodes = periodesEmex(brut);

const files2023 = parseAturSepe(csv(2023)).files;
const files2026 = parseAturSepe(csv(2026)).files;
const perMesDe = (ine5: string): Map<string, FilaAtur> =>
  new Map([...files2023, ...files2026].filter((f) => f.ine5 === ine5).map((f) => [f.mes, f]));

describe("el CSV del SEPE", () => {
  it("només deixa passar els municipis catalans, i tots els mesos", () => {
    expect(files2023).toHaveLength(7 * 12);
    expect(files2026).toHaveLength(7 * 9);
    expect(files2023.some((f) => f.ine5 === "04001")).toBe(false);
  });

  it("llegeix Girona el juny del 2023 xifra a xifra, i les parts sumen el total", () => {
    const g = files2023.find((f) => f.ine5 === "17079" && f.mes === "2023-06")!;
    expect(g).toMatchObject({ municipi: "Girona", total: 4435, homes: 180 + 737 + 1032, dones: 184 + 1015 + 1287 });
    expect(g.sectors).toEqual({ agricultura: 81, industria: 458, construccio: 374, serveis: 3100, senseOcupacioAnterior: 422 });
    expect(g.homes! + g.dones!).toBe(g.total);
    expect(Object.values(g.sectors).reduce((a, b) => a! + b!, 0)).toBe(g.total);
  });

  it("«<5» és un secret i no un zero: el total queda null, i el sexe no es pot sumar", () => {
    expect(llegeixRecompte("<5")).toBeNull();
    expect(llegeixRecompte("0")).toBe(0);
    expect(llegeixRecompte(" 12 ")).toBe(12);
    const brull = files2023.find((f) => f.ine5 === "08026" && f.mes === "2023-07")!;
    expect(brull.total).toBeNull();
    const brull2026 = files2026.find((f) => f.ine5 === "08026" && f.mes === "2026-09")!;
    expect(brull2026.total).toBe(5);
    expect(brull2026.homes).toBeNull();
  });

  it("es planta si falta la capçalera o una columna", () => {
    expect(() => parseAturSepe("res;de;res\n1;2;3")).toThrow(/Código mes/);
    const senseSexe = csv(2023).replace("Paro mujer edad < 25", "Una altra cosa");
    expect(() => parseAturSepe(senseSexe)).toThrow(/Paro mujer edad < 25/);
  });
});

describe("els mesos i les mitjanes", () => {
  it("compta mesos per sobre del canvi d'any", () => {
    expect(sumaMesos("2026-01", -1)).toBe("2025-12");
    expect(sumaMesos("2025-09", 12)).toBe("2026-09");
    expect(mesosEntre("2023-06", "2026-09")).toHaveLength(40);
  });

  it("la mitjana de l'any només amb els dotze mesos", () => {
    const girona = new Map([...perMesDe("17079")].map(([m, f]) => [m, f.total]));
    expect(mitjanesAnuals(girona, [2023])).toEqual([{ any: 2023, mitjana: 4568.1, mesos: 12 }]);
    // El Brull té el juliol del 2023 amagat: sense dotze mesos no hi ha mitjana.
    const brull = new Map([...perMesDe("08026")].map(([m, f]) => [m, f.total]));
    expect(mitjanesAnuals(brull, [2023])).toEqual([{ any: 2023, mitjana: null, mesos: 11 }]);
    // Un any sense el desembre, com el 2020 del SEPE, tampoc.
    const onzeMesos = new Map(Array.from({ length: 11 }, (_, i) => [`2020-${String(i + 1).padStart(2, "0")}`, 10]));
    expect(mitjanesAnuals(onzeMesos, [2020])[0]!.mitjana).toBeNull();
  });
});

describe("l'atur d'un municipi", () => {
  it("és el de Girona: ara, a l'inici del mandat i el canvi", () => {
    const g = aturDelMunicipi(perMesDe("17079"), "2026-09", [2023])!;
    expect(g.ara).toMatchObject({ mes: "2026-09", total: 4275, homes: 267 + 752 + 935 });
    expect(g.iniciMandat).toEqual({ mes: "2023-06", total: 4435 });
    expect(g.respecteMandat).toEqual({ absoluta: -160, percent: -3.6 });
    // El setembre del 2025 no és al fixture: un buit, no un zero.
    expect(g.faUnAny).toEqual({ mes: "2025-09", total: null });
    expect(g.respecteFaUnAny).toBeNull();
    expect(g.mensual.desDe).toBe("2023-06");
    expect(g.mensual.valors).toHaveLength(40);
    expect(g.mensual.valors[0]).toBe(4435);
    expect(g.mensual.valors[39]).toBe(4275);
    expect(g.anual).toEqual([{ any: 2023, mitjana: 4568.1, mesos: 12 }]);
    expect(g.mesosAmagats).toBe(0);
  });

  it("compta els mesos amagats, i sense cap fila no hi ha atur", () => {
    expect(aturDelMunicipi(perMesDe("08026"), "2026-09", [])!.mesosAmagats).toBeGreaterThan(0);
    expect(aturDelMunicipi(new Map(), "2026-09", [])).toBeNull();
  });

  it("Catalunya és la suma dels que tenen xifra als dos mesos, i diu quants", () => {
    const tots = ["25001", "08001", "08019", "08026", "17079", "08187", "43052"].map(
      (ine5) => aturDelMunicipi(perMesDe(ine5), "2026-09", [])!,
    );
    const cat = aturCatalunya(tots, "2026-09");
    const ambDos = tots.filter((a) => a.iniciMandat.total !== null && a.ara.total !== null);
    expect(cat.municipis).toBe(ambDos.length);
    expect(cat.ara).toBe(ambDos.reduce((s, a) => s + a.ara.total!, 0));
  });
});

describe("els indicadors de l'EMEX", () => {
  it("entén els períodes que el parser comú no entén", () => {
    expect(llegeixPeriode("2024 (p)")).toEqual({ text: "2024 (p)", any: 2024, mes: null, provisional: true });
    expect(llegeixPeriode("08/2026")).toEqual({ text: "08/2026", any: 2026, mes: "2026-08", provisional: false });
    expect(llegeixPeriode("2023")).toMatchObject({ any: 2023, provisional: false });
  });

  it("porta els cinc indicadors, cadascun a la seva taula", () => {
    expect(comprovaIndicadors(emex, periodes)).toEqual([]);
    const altraTaula = { ...emex, indicadors: emex.indicadors.map((i) => (i.id === "f10" ? { ...i, taula: { id: "t99", nom: "" } } : i)) };
    expect(comprovaIndicadors(altraTaula, periodes)[0]).toMatch(/f10 \(irpfBase\) és de la taula t99/);
    const sense = { ...emex, indicadors: emex.indicadors.filter((i) => i.id !== "f376") };
    expect(comprovaIndicadors(sense, periodes)).toEqual(["falta l'indicador f376 (pensio)"]);
  });

  it("dona els de Girona, amb el període, la font i l'enllaç de J18", () => {
    const enllac = { taula: "t213", titol: "IST", href: "https://www.idescat.cat/pub/?id=ist&n=14034&geo=mun:170792" };
    const ind = indicadorsDelMunicipi(emex, periodes, "170792", new Map([["t213", enllac]]));
    const per = Object.fromEntries(ind.map((i) => [i.clau, i]));
    expect(per.ist).toMatchObject({ valor: 97.2, periode: { any: 2024, provisional: true }, enllac, amuntEsMillor: null });
    expect(per.irpfBase).toMatchObject({ valor: 28899, unitat: "euros", periode: { any: 2023 }, enllac: null });
    expect(per.pensio).toMatchObject({ valor: 1485.55, periode: { any: 2025 } });
    expect(per.educacioSuperior).toMatchObject({ valor: 39.1, unitat: "%", periode: { any: 2024 } });
    expect(per.afiliats).toMatchObject({ valor: 49595, periode: { mes: "2026-08" } });
    expect(per.irpfBase!.font).toMatch(/Agència Estatal d'Administració Tributària/);
  });

  it("un municipi que no hi és no té indicadors", () => {
    expect(indicadorsDelMunicipi(emex, periodes, "171220", new Map())).toEqual([]);
  });
});

describe("la taxa aproximada", () => {
  it("és atur / (atur + afiliats) del mes dels afiliats", () => {
    expect(taxaDelMes(perMesDe("17079"), "2026-08", 49595)).toEqual({
      mes: "2026-08", atur: 4283, afiliats: 49595, taxa: 7.9, aproximada: true, amuntEsMillor: null,
    });
  });

  it("sense atur publicat (<5) o sense afiliats, no n'hi ha", () => {
    const brull = perMesDe("08026");
    brull.set("2026-08", { ...brull.get("2026-08")!, total: null });
    expect(taxaDelMes(brull, "2026-08", 145)).toBeNull();
    expect(taxaDelMes(perMesDe("17079"), "2026-08", null)).toBeNull();
    expect(taxaDelMes(perMesDe("17079"), null, 49595)).toBeNull();
  });
});

describe("la cau dels CSV", () => {
  const ara = new Date("2026-10-27T10:00:00Z");
  it("un any tancat no es torna a baixar; l'obert, si té més de tres dies", () => {
    expect(calBaixar(2025, null, ara)).toBe(true);
    expect(calBaixar(2025, new Date("2026-03-01T00:00:00Z"), ara)).toBe(false);
    expect(calBaixar(2025, new Date("2025-12-20T00:00:00Z"), ara)).toBe(true);
    expect(calBaixar(2026, new Date("2026-10-26T00:00:00Z"), ara)).toBe(false);
    expect(calBaixar(2026, new Date("2026-10-20T00:00:00Z"), ara)).toBe(true);
  });

  it("baixa un cop i després llegeix del disc; si la font cau, fa servir la còpia", async () => {
    const dir = await mkdtemp(join(tmpdir(), "j44-"));
    try {
      let crides = 0;
      const baixa = async (): Promise<Uint8Array> => {
        crides += 1;
        return new TextEncoder().encode("hola");
      };
      expect((await fitxerDeLAny(2026, baixa, dir, ara)).baixat).toBe(true);
      const segona = await fitxerDeLAny(2026, baixa, dir, new Date());
      expect(segona.baixat).toBe(false);
      expect(crides).toBe(1);
      // Una còpia vella i una font que no respon: la còpia, i el motiu.
      const vell = new Date("2026-01-01T00:00:00Z");
      await utimes(join(dir, "Paro_por_municipios_2026_csv.csv"), vell, vell);
      const caiguda = await fitxerDeLAny(2026, async () => { throw new Error("HTTP 503"); }, dir, ara);
      expect(caiguda.copiaVella).toBe("HTTP 503");
      expect(new TextDecoder().decode(caiguda.bytes)).toBe("hola");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
