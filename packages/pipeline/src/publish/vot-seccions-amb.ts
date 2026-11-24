import { BRANDS_BY_ID } from "@quivoto/shared-schemas/brands";
import type { EleccioSeccions, LlistaSeccions, VotSeccionsMetric } from "../jobs/j47-vot-seccions";

/**
 * Els mapes de vot per secció de diversos municipis en un sol llenç: la peça
 * de la pàgina de l'AMB, que posa les 2.151 seccions dels 36 municipis de
 * costat. És l'aparador de la col·laboració amb Xamfrà, que és qui va fer
 * primer aquest mapa per a l'àrea metropolitana.
 *
 * Dues coses canvien respecte de la fitxa d'un municipi:
 *
 *   · **Les llistes es comparen per família.** Cada municipi té les seves
 *     llistes municipals (PSC-CP, TriasxBCN, Barcelona en Comú…); al mapa de
 *     l'àrea es pinten per força (PSC, Junts, Comuns…) i les llistes locals
 *     van juntes. Els vots se sumen tal com són: cap vot no es reparteix.
 *   · **La geometria no es torna a llegir.** Cada mètrica porta el marc amb
 *     què es va dibuixar el seu municipi (J47), i aquí es passen els camins
 *     al llenç comú. Les mètriques sense marc (desades abans) es deixen fora.
 */

const NOM_FAMILIA: Record<string, string> = {
  psc: "PSC", erc: "ERC", junts: "Junts", pp: "PP", vox: "Vox", cs: "Ciutadans", comuns: "Comuns",
  podem: "Podem", cup: "CUP", aliancacat: "Aliança Catalana", pdecat: "PDeCAT", ciu: "CiU",
  local: "Llistes locals",
};
const COLOR_LOCAL = "#A79E8B";
const COLOR_ALTRES = "#9C97A8";
/** Les famílies amb menys d'aquest percentatge dels vots de l'àrea van a «Altres». */
const PES_MINIM = 1;

export type PecaMunicipi = { ine5: string; nom: string; m: VotSeccionsMetric };

/**
 * Passa un camí del llenç d'un municipi al llenç comú. Els camins són
 * `M x y l dx dy … z`: el punt de l'M es mou i s'escala, els relatius només
 * s'escalen. Es desa amb un decimal perquè els trossos petits no col·lapsin.
 */
export function transformaCami(d: string, de: { x0: number; y1: number; escala: number; marge: number }, a: { X0: number; Y1: number; E: number; marge: number }): string {
  const k = a.E / de.escala;
  const r = (n: number): string => {
    const v = Math.round(n * 10) / 10;
    return Object.is(v, -0) ? "0" : String(v);
  };
  return d.replace(/M(-?[\d.]+) (-?[\d.]+)l([^z]*)z/g, (_t, xs: string, ys: string, rel: string) => {
    const X = de.x0 + (Number(xs) - de.marge) / de.escala;
    const Y = de.y1 - (Number(ys) - de.marge) / de.escala;
    const x = (X - a.X0) * a.E + a.marge;
    const y = (a.Y1 - Y) * a.E + a.marge;
    const nums = rel.match(/-?\d+(\.\d+)?/g) ?? [];
    let out = "";
    nums.forEach((n, i) => {
      const v = r(Number(n) * k);
      out += `${i > 0 && !v.startsWith("-") ? " " : ""}${v}`;
    });
    return `M${r(x)} ${r(y)}l${out}z`;
  });
}

const familiaDe = (l: LlistaSeccions): string => (l.sigles === "Altres" && !l.familia ? "altres" : l.familia ?? "altres");

/** Ajunta els municipis en una sola mètrica, amb les llistes per família. */
export function combinaMunicipis(peces: readonly PecaMunicipi[], amplada = 1000): { m: VotSeccionsMetric; municipis: Record<string, string> } | null {
  const amb = peces.filter((p) => p.m.marc && p.m.seccions.length > 0);
  if (amb.length < 2) return null;

  // ── el llenç comú ──
  let X0 = Infinity, X1 = -Infinity, Y0 = Infinity, Y1 = -Infinity;
  for (const { m } of amb) {
    const c = m.marc!;
    const x1 = c.x0 + (m.amplada - 2 * c.marge) / c.escala;
    const y0 = c.y1 - (m.alcada - 2 * c.marge) / c.escala;
    X0 = Math.min(X0, c.x0); X1 = Math.max(X1, x1); Y0 = Math.min(Y0, y0); Y1 = Math.max(Y1, c.y1);
  }
  const marge = 6;
  const E = (amplada - 2 * marge) / (X1 - X0);
  const alcada = Math.round((Y1 - Y0) * E + 2 * marge);
  const seccions = amb.flatMap(({ m }) => m.seccions.map((s) => ({ codi: s.codi, d: transformaCami(s.d, m.marc!, { X0, Y1, E, marge }) })));

  // ── les eleccions, per família ──
  const ids = [...new Set(amb.flatMap(({ m }) => m.eleccions.map((e) => e.id)))];
  const eleccions: EleccioSeccions[] = [];
  for (const id of ids) {
    const totals = new Map<string, number>();
    let etiqueta = id as string;
    for (const { m } of amb) {
      const e = m.eleccions.find((x) => x.id === id);
      if (!e) continue;
      etiqueta = e.etiqueta;
      for (const l of e.llistes) totals.set(familiaDe(l), (totals.get(familiaDe(l)) ?? 0) + l.vots);
    }
    const total = [...totals.values()].reduce((a, b) => a + b, 0);
    const ambNom = [...totals].filter(([f, v]) => f !== "altres" && (100 * v) / total >= PES_MINIM).sort((a, b) => b[1] - a[1]).map(([f]) => f);
    const index = new Map(ambNom.map((f, i) => [f, i]));
    const altres = ambNom.length;
    const llistes: LlistaSeccions[] = ambNom.map((f) => ({
      sigles: NOM_FAMILIA[f] ?? BRANDS_BY_ID.get(f)?.name ?? f,
      familia: f,
      color: f === "local" ? COLOR_LOCAL : BRANDS_BY_ID.get(f)?.color ?? COLOR_ALTRES,
      vots: totals.get(f)!,
    }));
    const restaVots = total - llistes.reduce((s, l) => s + l.vots, 0);
    if (restaVots > 0) llistes.push({ sigles: "Altres", familia: null, color: COLOR_ALTRES, vots: restaVots });

    const files: Record<string, number[]> = {};
    for (const { m } of amb) {
      const e = m.eleccions.find((x) => x.id === id);
      if (!e) continue;
      for (const [codi, fila] of Object.entries(e.files)) {
        const nova = [fila[0]!, fila[1]!, fila[2]!, fila[3]!, ...llistes.map(() => 0)];
        e.llistes.forEach((l, i) => {
          const j = index.get(familiaDe(l)) ?? altres;
          nova[4 + j]! += fila[4 + i] ?? 0;
        });
        files[codi] = nova;
      }
    }
    eleccions.push({ id, etiqueta, llistes, files });
  }

  const valors: Record<string, number> = {};
  let rendaAny: number | null = null;
  let rendaFont: { font: string; url: string } | null = null;
  for (const { m } of amb) {
    if (!m.renda) continue;
    Object.assign(valors, m.renda.valors);
    rendaAny = m.renda.any;
    rendaFont = { font: m.renda.font, url: m.renda.url };
  }

  return {
    m: {
      origen: amb[0]!.m.origen,
      consultat: amb[0]!.m.consultat,
      amplada,
      alcada,
      seccions,
      eleccions,
      renda: rendaAny !== null && rendaFont ? { any: rendaAny, ...rendaFont, valors } : null,
      xamfra: null,
      senseGeometria: {},
    },
    municipis: Object.fromEntries(amb.map((p) => [p.ine5, p.nom])),
  };
}
