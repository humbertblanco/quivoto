import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  ELECCIONS_SECCIONS,
  LLISTES_AMB_NOM,
  codiDesDeXamfra,
  codiSeccio,
  eleccioDelMunicipi,
  geometriaMunicipi,
  metricaDelMunicipi,
  rendaSeccionsAdrh,
  seccionsDesDeZipIcgc,
  simplifica,
  type FilaParticipacioSeccio,
  type FilaVotsSeccio,
  type SeccioGeo,
} from "./j47-vot-seccions";

const MUNICIPALS = ELECCIONS_SECCIONS[0];
const PARLAMENT = ELECCIONS_SECCIONS[1];

const quadrat = (x: number, y: number, c = 100): [number, number][] => [[x, y], [x + c, y], [x + c, y + c], [x, y + c], [x, y]];

// ── Un shapefile i un ZIP fets a mà, per no dependre de cap fitxer de l'ICGC ──

function shp(poligons: [number, number][][]): Uint8Array {
  const registres = poligons.map((anell) => {
    const b = new DataView(new ArrayBuffer(44 + 4 + 16 * anell.length));
    b.setInt32(0, 5, true);
    b.setInt32(36, 1, true);
    b.setInt32(40, anell.length, true);
    b.setInt32(44, 0, true);
    anell.forEach(([x, y], i) => { b.setFloat64(48 + 16 * i, x, true); b.setFloat64(56 + 16 * i, y, true); });
    return new Uint8Array(b.buffer);
  });
  const total = 100 + registres.reduce((s, r) => s + 8 + r.length, 0);
  const out = new Uint8Array(total);
  const v = new DataView(out.buffer);
  v.setInt32(0, 9994, false);
  v.setInt32(24, total / 2, false);
  let p = 100;
  registres.forEach((r, i) => {
    v.setInt32(p, i + 1, false);
    v.setInt32(p + 4, r.length / 2, false);
    out.set(r, p + 8);
    p += 8 + r.length;
  });
  return out;
}

function dbf(camps: [string, number][], files: string[][]): Uint8Array {
  const llargCap = 32 + 32 * camps.length + 1;
  const llargReg = 1 + camps.reduce((s, [, l]) => s + l, 0);
  const out = new Uint8Array(llargCap + llargReg * files.length);
  const v = new DataView(out.buffer);
  v.setUint32(4, files.length, true);
  v.setUint16(8, llargCap, true);
  v.setUint16(10, llargReg, true);
  camps.forEach(([nom, l], i) => {
    out.set(new TextEncoder().encode(nom), 32 + 32 * i);
    out[32 + 32 * i + 11] = 67;
    out[32 + 32 * i + 16] = l;
  });
  out[llargCap - 1] = 0x0d;
  files.forEach((fila, r) => {
    let p = llargCap + r * llargReg;
    out[p++] = 0x20;
    fila.forEach((valor, i) => {
      const l = camps[i]![1];
      out.set(new TextEncoder().encode(valor.padEnd(l, " ")), p);
      p += l;
    });
  });
  return out;
}

function zip(fitxers: Record<string, Uint8Array>): Uint8Array {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  Object.entries(fitxers).forEach(([nom, dades], i) => {
    const comprimeix = i % 2 === 0;
    const cos = comprimeix ? deflateRawSync(dades) : Buffer.from(dades);
    const n = Buffer.from(nom);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(comprimeix ? 8 : 0, 8);
    local.writeUInt32LE(cos.length, 18);
    local.writeUInt32LE(dades.length, 22);
    local.writeUInt16LE(n.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(comprimeix ? 8 : 0, 10);
    central.writeUInt32LE(cos.length, 20);
    central.writeUInt32LE(dades.length, 24);
    central.writeUInt16LE(n.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, n, cos);
    centrals.push(central, n);
    offset += 30 + n.length + cos.length;
  });
  const dir = Buffer.concat(centrals);
  const fi = Buffer.alloc(22);
  fi.writeUInt32LE(0x06054b50, 0);
  fi.writeUInt16LE(Object.keys(fitxers).length, 8);
  fi.writeUInt16LE(Object.keys(fitxers).length, 10);
  fi.writeUInt32LE(dir.length, 12);
  fi.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, dir, fi]));
}

describe("J47 · geometria", () => {
  it("llegeix les seccions d'un ZIP de l'ICGC i les agrupa per municipi amb el codi de 10 xifres", () => {
    const z = zip({
      "bseccen.shp": shp([quadrat(420000, 4580000), quadrat(420100, 4580000), quadrat(500000, 4600000)]),
      "bseccen.dbf": dbf([["MUNICIPI", 6], ["DISTRICTE", 2], ["SECCIO", 3]], [["080193", "01", "001"], ["080193", "01", "002"], ["170792", "01", "001"]]),
      "bseccen.prj": new TextEncoder().encode('PROJCS["ETRS89 / UTM zone 31N"]'),
    });
    const perMunicipi = seccionsDesDeZipIcgc(z);
    expect([...perMunicipi.keys()].sort()).toEqual(["08019", "17079"]);
    expect(perMunicipi.get("08019")!.map((s) => s.codi)).toEqual(["0801901001", "0801901002"]);
    expect(perMunicipi.get("08019")![0]!.anells[0]).toEqual(quadrat(420000, 4580000));
  });

  it("refusa unes seccions que no són en UTM 31N", () => {
    const z = zip({
      "s.shp": shp([quadrat(0, 0)]),
      "s.dbf": dbf([["MUNICIPI", 6], ["DISTRICTE", 2], ["SECCIO", 3]], [["080193", "01", "001"]]),
      "s.prj": new TextEncoder().encode('GEOGCS["WGS 84"]'),
    });
    expect(() => seccionsDesDeZipIcgc(z)).toThrow(/UTM 31N/);
  });

  it("simplifica sense perdre els extrems ni els vèrtexs que importen", () => {
    const recta: [number, number][] = [[0, 0], [1, 0.01], [2, 0], [3, 0.01], [4, 0], [4, 4]];
    expect(simplifica(recta, 0.1)).toEqual([[0, 0], [4, 0], [4, 4]]);
  });

  it("dibuixa en un llenç de 1000 d'ample, amb el nord a dalt i camins tancats", () => {
    const geo: SeccioGeo[] = [
      { codi: "0801901002", anells: [quadrat(100, 0)] },
      { codi: "0801901001", anells: [quadrat(0, 0)] },
    ];
    const m = geometriaMunicipi(geo);
    expect(m.amplada).toBe(1000);
    expect(m.alcada).toBe(506); // 988 × ½ + els dos marges
    expect(m.seccions.map((s) => s.codi)).toEqual(["0801901001", "0801901002"]);
    for (const s of m.seccions) expect(s.d).toMatch(/^M\d+ \d+l[-\d ]+z$/);
    // El quadrat de l'esquerra comença a baix a l'esquerra: x = marge, y = alçada − marge.
    expect(m.seccions[0]!.d.startsWith("M6 500")).toBe(true);
  });

  it("no dibuixa els illots minúsculs d'una secció que té un anell gran", () => {
    const m = geometriaMunicipi([
      { codi: "0801901001", anells: [quadrat(0, 0, 1000), quadrat(2000, 0, 5)] },
      { codi: "0801901002", anells: [quadrat(1000, 0, 1000)] },
    ]);
    expect(m.seccions[0]!.d.match(/M/g)).toHaveLength(1);
  });

  it("passa els codis de Xamfrà (11 xifres amb el dígit de control) als de l'INE", () => {
    expect(codiDesDeXamfra("08019301008")).toBe("0801901008");
  });
});

describe("J47 · vots", () => {
  const part = (seccio: string, cens: number, votants: number): FilaParticipacioSeccio => ({
    territori_codi: "8019", districte: "1", seccio, cens_electoral: String(cens), votants: String(votants), vots_nuls: "1", vots_blancs: "2",
  });
  const vot = (seccio: string, sigles: string, vots: number, codi = sigles): FilaVotsSeccio => ({
    territori_codi: "08019", districte: "01", secci_: seccio, candidatura_sigles: sigles, candidatura_codi: codi, vots: String(vots),
  });

  it("refà el codi de secció amb els zeros del davant", () => {
    expect(codiSeccio("8019", "1", "8")).toBe("0801901008");
  });

  it("ordena les llistes pels vots al municipi i alinea les files amb aquest ordre", () => {
    const e = eleccioDelMunicipi(PARLAMENT, [vot("1", "ERC", 10), vot("1", "PSC", 30), vot("2", "ERC", 50), vot("2", "PSC", 5)], [part("1", 100, 45), part("2", 120, 60)])!;
    expect(e.llistes.map((l) => [l.sigles, l.vots])).toEqual([["ERC", 60], ["PSC", 35]]);
    expect(e.files["0801901001"]).toEqual([100, 45, 1, 2, 10, 30]);
    expect(e.files["0801901002"]).toEqual([120, 60, 1, 2, 50, 5]);
    expect(e.llistes[1]!.familia).toBe("psc");
  });

  it("suma a «Altres» les llistes de menys pes sense perdre cap vot", () => {
    const vots = [vot("1", "A", 500)];
    for (let i = 0; i < LLISTES_AMB_NOM + 2; i += 1) vots.push(vot("1", `L${i}`, 40 - i));
    vots.push(vot("1", "PETITA", 1));
    const e = eleccioDelMunicipi(PARLAMENT, vots, [part("1", 2000, 900)])!;
    expect(e.llistes).toHaveLength(LLISTES_AMB_NOM + 1);
    expect(e.llistes.at(-1)!.sigles).toBe("Altres");
    const fila = e.files["0801901001"]!;
    expect(fila.slice(4).reduce((a, b) => a + b, 0)).toBe(vots.reduce((s, v) => s + Number(v.vots), 0));
  });

  it("dona un color de reserva, i no el blanc oficial, a les llistes locals", () => {
    const e = eleccioDelMunicipi(MUNICIPALS, [{ ...vot("1", "VEINS", 10), candidatura_color: "#FFFFFF" }], [part("1", 30, 12)])!;
    expect(e.llistes[0]!.familia).toBe("local");
    expect(e.llistes[0]!.color).not.toMatch(/^#f{6}$/i);
  });

  it("sense participació no hi ha elecció", () => {
    expect(eleccioDelMunicipi(PARLAMENT, [vot("1", "PSC", 3)], [])).toBeNull();
  });
});

describe("J47 · renda i mètrica", () => {
  it("llegeix només les files de secció de la renda neta per persona, de l'any més recent", () => {
    const csv = [
      "Municipios;Distritos;Secciones;Indicadores de renta media y mediana;Periodo;Total",
      '08019 Barcelona;"";"";Renta neta media por persona;2023;22.000',
      "08019 Barcelona;0801901;0801901001 Barcelona sección 01001;Renta neta media por persona;2023;18.500",
      "08019 Barcelona;0801901;0801901001 Barcelona sección 01001;Renta neta media por persona;2022;17.000",
      "08019 Barcelona;0801901;0801901001 Barcelona sección 01001;Renta neta media por hogar;2023;45.000",
      "08019 Barcelona;0801901;0801901002 Barcelona sección 01002;Renta neta media por persona;2023;.",
    ].join("\n");
    const r = rendaSeccionsAdrh(csv)!;
    expect(r.any).toBe(2023);
    expect([...r.valors]).toEqual([["0801901001", 18500]]);
  });

  const geo: SeccioGeo[] = [
    { codi: "0807701001", anells: [quadrat(0, 0)] },
    { codi: "0807701002", anells: [quadrat(100, 0)] },
  ];
  const eleccio = { id: "M20231" as const, etiqueta: "Municipals 2023", llistes: [], files: { "0807701001": [1, 1, 0, 0], "0807701009": [1, 1, 0, 0] } };

  it("només desa els municipis de dues seccions o més", () => {
    expect(metricaDelMunicipi({ ine5: "08077", geo: geo.slice(0, 1), eleccions: [eleccio], renda: null, origen: "generalitat", consultat: "2026-11-24" })).toBeNull();
  });

  it("diu quines seccions amb vots no tenen geometria, i enllaça Xamfrà només a l'AMB", () => {
    const m = metricaDelMunicipi({ ine5: "08077", geo, eleccions: [eleccio], renda: null, origen: "generalitat", consultat: "2026-11-24" })!;
    expect(m.senseGeometria).toEqual({ M20231: ["0807701009"] });
    expect(m.xamfra).toBe("esplugues-de-llobregat");
    const girona = metricaDelMunicipi({ ine5: "17079", geo, eleccions: [eleccio], renda: null, origen: "generalitat", consultat: "2026-11-24" })!;
    expect(girona.xamfra).toBeNull();
  });

  it("només guarda la renda de les seccions dibuixades", () => {
    const renda = { any: 2023, font: "INE", url: "https://www.ine.es", valors: new Map([["0807701001", 20000], ["0807701002", 30000], ["0801901001", 1]]) };
    const m = metricaDelMunicipi({ ine5: "08077", geo, eleccions: [eleccio], renda, origen: "generalitat", consultat: "2026-11-24" })!;
    expect(m.renda!.valors).toEqual({ "0807701001": 20000, "0807701002": 30000 });
  });
});
