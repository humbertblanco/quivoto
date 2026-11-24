import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { and, eq, notInArray } from "drizzle-orm";
import { municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { BRANDS_BY_ID, resolveBrand, siglesFamily } from "@quivoto/shared-schemas/brands";
import { DATASETS, socrataAll } from "../adapters/socrata";
import { llegeixDbf, llegeixShp, type Anell } from "../lib/shapefile";
import { llegeixZip } from "../lib/zip";
import { withRun } from "../lib/run";
import { codiIne, familiaNacional } from "./j43-altres-eleccions";
import { fetchText, parseImportIne, TAULES_ADRH, urlDescarregaAdrh, urlTaulaAdrh } from "./j23-riquesa";

/**
 * J47 — com vota cada barri: el vot per secció censal, dibuixat sobre el mapa
 * de les seccions del municipi.
 *
 * ─── D'ON VE LA IDEA ────────────────────────────────────────────────────────
 *
 * És la col·laboració amb **Xamfrà**, el visor urbà 3D de l'àrea
 * metropolitana. Xamfrà ja publica el vot per secció dels 36 municipis de
 * l'AMB, amb un mètode comprovat (`scripts/build-elections.py` i
 * `docs/ELECTIONS.md` del seu repositori). Aquí se'n porta el mètode, no el
 * visor: la mateixa font de la Generalitat cobreix les 947 municipis, i la
 * fitxa de quivoto la dibuixa amb el seu propi SVG, sense carregar res de
 * Xamfrà. Als municipis de l'AMB la fitxa enllaça el visor 3D, que és on es
 * pot creuar amb tota la resta.
 *
 * ─── LES FONTS ──────────────────────────────────────────────────────────────
 *
 *   · **Vots i participació per secció**: els conjunts `ntc4-rnwr` i
 *     `irrv-2mfc` de la Generalitat, els mateixos de J2, J5 i J43, al nivell
 *     `SE` (secció electoral). La secció electoral d'una elecció és la secció
 *     censal d'aquell any.
 *   · **Geometria**: les seccions censals de l'ICGC a 1-1-2025 (ETRS89 / UTM
 *     31N, CC BY 4.0). Es baixa un cop a `packages/db/.data/icgc/`.
 *   · **Renda neta per persona per secció**: l'ADRH de l'INE, els mateixos
 *     quatre CSV provincials de J23, ara llegint les files de secció que J23
 *     descarta perquè no tenia on posar-les.
 *
 * ─── LES REGLES ─────────────────────────────────────────────────────────────
 *
 *   · **La unió és pel codi**, mai per superposició: municipi (5) + districte
 *     (2) + secció (3). Una secció de 2025 sense resultat és un buit, mai un
 *     zero, i un resultat sense secció de 2025 es compta i es diu.
 *   · **Els vots es desen tal com els dona la font.** Percentatges i
 *     guanyadors es calculen a la fitxa i sobre vots a candidatures, com a la
 *     resta de quivoto.
 *   · **Només els municipis amb dues seccions o més.** Amb una sola, el mapa
 *     seria el municipi sencer d'un sol color, i això la fitxa ja ho diu.
 *   · **Cap creuament amb nom de persona**: una secció té de 600 a 2.500
 *     electors, i no es publica res per mesa.
 *
 * ─── EL MODE XAMFRÀ ─────────────────────────────────────────────────────────
 *
 * Amb `QUIVOTO_XAMFRA_DADES=<checkout de Xamfrà>/public/data` la feina llegeix
 * els fitxers que Xamfrà ja ha publicat (eleccions, seccions i renda dels 36
 * de l'AMB) en comptes de demanar res a la xarxa. Serveix per provar-ho sense
 * connexió i per comprovar que els dos projectes diuen el mateix.
 */

export const KIND = "votSeccions";

/** Les dues eleccions del mapa, la primera és la que es veu en obrir la fitxa. */
export const ELECCIONS_SECCIONS = [
  { id: "M20231", etiqueta: "Municipals 2023", tipus: "municipals", data: "2023-05-28" },
  { id: "A20241", etiqueta: "Parlament 2024", tipus: "parlament", data: "2024-05-12" },
] as const;
export type IdEleccioSeccions = (typeof ELECCIONS_SECCIONS)[number]["id"];

/** Quantes llistes porten nom propi al mapa; la resta va a «Altres». */
export const LLISTES_AMB_NOM = 7;
/** I quin pes mínim han de tenir al municipi per portar-ne. */
export const PES_MINIM_LLISTA = 1;

export const URL_ICGC_SECCIONS =
  "https://datacloud.icgc.cat/datacloud/bseccen_etrs89/shp/bseccenv10sh1f1_20250101_1.zip";
export const URL_FITXA_ICGC_SECCIONS =
  "https://www.icgc.cat/ca/Geoinformacio-i-mapes/Dades-i-productes/Geoinformacio-cartografica/Seccions-censals";
export const URL_VOTS_SECCIO = "https://analisi.transparenciacatalunya.cat/d/ntc4-rnwr";
export const URL_PARTICIPACIO_SECCIO = "https://analisi.transparenciacatalunya.cat/d/irrv-2mfc";
export const URL_XAMFRA = "https://xamfra.damosenelblanco.com";

/** Amplada del llenç del mapa, en unitats de l'SVG. L'alçada surt de la forma del municipi. */
export const AMPLADA_MAPA = 1000;

// ─────────────────────────────────────────────────────────────────────────────
// Tipus
// ─────────────────────────────────────────────────────────────────────────────

/** Una secció ja dibuixada: el codi INE de 10 xifres i el camí de l'SVG. */
export type SeccioMapa = { codi: string; d: string };

export type LlistaSeccions = {
  sigles: string;
  /** La família de la casa (psc, erc…), «local» o null si no en té. */
  familia: string | null;
  color: string;
  /** Vots al conjunt del municipi, sumant les seccions. */
  vots: number;
};

/**
 * Una elecció d'un municipi. `files[codi]` és
 * `[cens, votants, nuls, blancs, ...vots de cada llista en l'ordre de `llistes`]`;
 * si hi ha «Altres», és l'última llista.
 */
export type EleccioSeccions = {
  id: IdEleccioSeccions;
  etiqueta: string;
  llistes: LlistaSeccions[];
  files: Record<string, number[]>;
};

export type VotSeccionsMetric = {
  origen: "generalitat" | "xamfra";
  consultat: string;
  amplada: number;
  alcada: number;
  seccions: SeccioMapa[];
  eleccions: EleccioSeccions[];
  /** Renda neta per persona de cada secció, si n'hi ha. */
  renda: { any: number; font: string; url: string; valors: Record<string, number> } | null;
  /** Municipi de l'AMB: la pàgina de Xamfrà que la fitxa enllaça. Null a la resta. */
  xamfra: string | null;
  /** Seccions amb vots i sense geometria de 2025, per elecció: es diuen, no es dibuixen. */
  senseGeometria: Record<string, string[]>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Geometria
// ─────────────────────────────────────────────────────────────────────────────

export type SeccioGeo = { codi: string; anells: Anell[] };

/** Douglas–Peucker: treu els punts que es desvien menys de `tol` de la recta. */
export function simplifica(punts: Anell, tol: number): Anell {
  if (punts.length <= 3) return punts.slice();
  const guarda = new Uint8Array(punts.length);
  guarda[0] = 1;
  guarda[punts.length - 1] = 1;
  const pila: [number, number][] = [[0, punts.length - 1]];
  const tol2 = tol * tol;
  while (pila.length) {
    const [a, b] = pila.pop()!;
    const [ax, ay] = punts[a]!;
    const [bx, by] = punts[b]!;
    const dx = bx - ax;
    const dy = by - ay;
    const ll = dx * dx + dy * dy;
    let max = -1;
    let idx = -1;
    for (let i = a + 1; i < b; i += 1) {
      const [px, py] = punts[i]!;
      let d2: number;
      if (ll === 0) d2 = (px - ax) ** 2 + (py - ay) ** 2;
      else {
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / ll));
        d2 = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2;
      }
      if (d2 > max) {
        max = d2;
        idx = i;
      }
    }
    if (idx >= 0 && max > tol2) {
      guarda[idx] = 1;
      pila.push([a, idx], [idx, b]);
    }
  }
  return punts.filter((_, i) => guarda[i] === 1);
}

const areaAnell = (a: Anell): number => {
  let s = 0;
  for (let i = 0, j = a.length - 1; i < a.length; j = i, i += 1) s += (a[j]![0] + a[i]![0]) * (a[j]![1] - a[i]![1]);
  return Math.abs(s / 2);
};

/**
 * Les seccions d'un municipi, de coordenades planes (x a l'est, y al nord) a
 * camins d'SVG en un llenç de `amplada` d'ample. Els camins són relatius i
 * d'enters: un camí de Barcelona fa uns 60 caràcters de mediana.
 *
 * Els anells de menys d'un 0,5 % de la secció (illots, restes de
 * digitalització) no es dibuixen si la secció en té un altre de més gran: al
 * mapa d'una fitxa no es veurien i pesarien igual.
 */
export function geometriaMunicipi(
  seccions: readonly SeccioGeo[],
  amplada = AMPLADA_MAPA,
): { amplada: number; alcada: number; seccions: SeccioMapa[] } {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of seccions) for (const anell of s.anells) for (const [x, y] of anell) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  const marge = 6;
  const escala = (amplada - 2 * marge) / Math.max(x1 - x0, 1e-9);
  const alcada = Math.round((y1 - y0) * escala + 2 * marge);
  // Un píxel del llenç, en unitats d'origen, és el que es pot permetre perdre.
  const tol = 0.7 / escala;
  const fora: SeccioMapa[] = [];
  for (const s of [...seccions].sort((a, b) => a.codi.localeCompare(b.codi))) {
    const gran = Math.max(...s.anells.map(areaAnell));
    let d = "";
    for (const anell of s.anells) {
      if (s.anells.length > 1 && areaAnell(anell) < gran * 0.005) continue;
      const simple = simplifica(anell, tol);
      const punts: [number, number][] = [];
      for (const [x, y] of simple) {
        const p: [number, number] = [Math.round((x - x0) * escala + marge), Math.round((y1 - y) * escala + marge)];
        const darrer = punts.at(-1);
        if (!darrer || darrer[0] !== p[0] || darrer[1] !== p[1]) punts.push(p);
      }
      if (punts.length > 1 && punts[0]![0] === punts.at(-1)![0] && punts[0]![1] === punts.at(-1)![1]) punts.pop();
      if (punts.length < 3) continue;
      d += `M${punts[0]![0]} ${punts[0]![1]}`;
      let l = "l";
      for (let i = 1; i < punts.length; i += 1) {
        const dx = punts[i]![0] - punts[i - 1]![0];
        const dy = punts[i]![1] - punts[i - 1]![1];
        l += `${i > 1 && dx >= 0 ? " " : ""}${dx}${dy >= 0 ? " " : ""}${dy}`;
      }
      d += `${l}z`;
    }
    if (d) fora.push({ codi: s.codi, d });
  }
  return { amplada, alcada, seccions: fora };
}

/** Longitud i latitud a un pla on un grau d'est fa el mateix que un de nord a l'alçada del municipi. */
export function planaDesDeLonLat(seccions: readonly SeccioGeo[]): SeccioGeo[] {
  let suma = 0, n = 0;
  for (const s of seccions) for (const a of s.anells) for (const [, lat] of a) { suma += lat; n += 1; }
  const k = Math.cos(((n ? suma / n : 41.5) * Math.PI) / 180);
  return seccions.map((s) => ({ codi: s.codi, anells: s.anells.map((a) => a.map(([lon, lat]) => [lon * k, lat] as [number, number])) }));
}

/** Les seccions de l'ICGC del ZIP, agrupades per municipi (INE 5). */
export function seccionsDesDeZipIcgc(zip: Uint8Array): Map<string, SeccioGeo[]> {
  const fitxers = llegeixZip(zip);
  const nom = [...fitxers.keys()].find((k) => /\.shp$/i.test(k));
  if (!nom) throw new Error("ICGC: el ZIP no porta cap .shp");
  const arrel = nom.slice(0, -4);
  const prj = fitxers.get(`${arrel}.prj`);
  if (prj && !/31N/.test(new TextDecoder().decode(prj))) throw new Error("ICGC: les seccions no són en UTM 31N");
  const formes = llegeixShp(fitxers.get(nom)!);
  const registres = llegeixDbf(fitxers.get(`${arrel}.dbf`) ?? fitxers.get(`${arrel}.DBF`)!);
  if (formes.length !== registres.length) throw new Error("ICGC: el .shp i el .dbf no tenen les mateixes files");
  const perMunicipi = new Map<string, SeccioGeo[]>();
  registres.forEach((r, i) => {
    const forma = formes[i];
    if (!forma) return;
    const ine5 = (r.MUNICIPI ?? "").slice(0, 5);
    const codi = `${ine5}${(r.DISTRICTE ?? "").padStart(2, "0")}${(r.SECCIO ?? "").padStart(3, "0")}`;
    if (!/^\d{10}$/.test(codi)) return;
    const llista = perMunicipi.get(ine5) ?? [];
    llista.push({ codi, anells: forma.anells });
    perMunicipi.set(ine5, llista);
  });
  return perMunicipi;
}

// ─────────────────────────────────────────────────────────────────────────────
// Vots
// ─────────────────────────────────────────────────────────────────────────────

export type FilaVotsSeccio = {
  territori_codi: string;
  districte?: string;
  secci_?: string;
  candidatura_codi?: string;
  candidatura_sigles?: string;
  candidatura_color?: string;
  agrupacio_codi?: string;
  vots?: string;
};

export type FilaParticipacioSeccio = {
  territori_codi: string;
  districte?: string;
  seccio?: string;
  cens_electoral?: string;
  votants?: string;
  vots_nuls?: string;
  vots_blancs?: string;
};

const enter = (t: string | undefined): number => {
  const n = Number((t ?? "").trim());
  return Number.isFinite(n) ? Math.round(n) : 0;
};

/** Codi de 10 xifres d'una fila de secció del portal. */
export const codiSeccio = (territori: string, districte: string | undefined, seccio: string | undefined): string =>
  `${codiIne(territori)}${(districte ?? "").trim().padStart(2, "0")}${(seccio ?? "").trim().padStart(3, "0")}`;

const COLOR_ALTRES = "#9C97A8";
/** Colors de reserva per a llistes locals sense color oficial: apagats i distingibles entre ells. */
const COLORS_RESERVA = ["#8E7DBE", "#5B9A8B", "#C49A6C", "#7A8FA6", "#B07AA1", "#9C9C5E"];
const colorValid = (c: string | null | undefined): c is string =>
  !!c && /^#[0-9a-f]{6}$/i.test(c.trim()) && !/^#(f{6}|fefefe|000000)$/i.test(c.trim());

/** La família i el color d'una llista, amb la regla de la resta de la fitxa. */
export function colorLlista(
  tipus: "municipals" | "parlament",
  sigles: string,
  agrupacio: string | null,
  oficial: string | null,
  reserva: number,
): { familia: string | null; color: string } {
  let familia: string | null;
  if (tipus === "municipals") {
    const marca = resolveBrand("M20231", agrupacio).brandId;
    const f = marca !== "local" ? marca : siglesFamily(sigles) ?? "local";
    const k = BRANDS_BY_ID.get(f)?.kind;
    familia = k === "local" || k === "regional" ? "local" : f;
  } else familia = familiaNacional(sigles);
  const marca = familia && familia !== "local" ? BRANDS_BY_ID.get(familia)?.color : undefined;
  if (marca) return { familia, color: marca };
  if (colorValid(oficial)) return { familia, color: oficial.trim() };
  return { familia, color: COLORS_RESERVA[reserva % COLORS_RESERVA.length]! };
}

/** Una llista mentre s'acumula: vots per secció i el que cal per pintar-la. */
type Acumulada = { sigles: string; agrupacio: string | null; oficial: string | null; perSeccio: Map<string, number>; total: number };

/**
 * Les files d'una elecció, ja d'un sol municipi, a la forma que desa la
 * mètrica. Les llistes s'ordenen pels vots al municipi; les que passen de
 * `PES_MINIM_LLISTA` % porten nom, fins a `LLISTES_AMB_NOM`, i la resta se
 * sumen a «Altres» sense perdre cap vot.
 */
export function eleccioDelMunicipi(
  eleccio: (typeof ELECCIONS_SECCIONS)[number],
  vots: readonly FilaVotsSeccio[],
  participacio: readonly FilaParticipacioSeccio[],
): EleccioSeccions | null {
  if (participacio.length === 0) return null;
  const llistes = new Map<string, Acumulada>();
  for (const f of vots) {
    const sigles = (f.candidatura_sigles ?? "").trim() || "?";
    const clau = eleccio.tipus === "municipals" ? (f.candidatura_codi ?? sigles) : sigles;
    const codi = codiSeccio(f.territori_codi, f.districte, f.secci_);
    const v = enter(f.vots);
    let l = llistes.get(clau);
    if (!l) {
      l = { sigles, agrupacio: f.agrupacio_codi ?? null, oficial: f.candidatura_color ?? null, perSeccio: new Map(), total: 0 };
      llistes.set(clau, l);
    }
    l.perSeccio.set(codi, (l.perSeccio.get(codi) ?? 0) + v);
    l.total += v;
  }
  const ordenades = [...llistes.values()].sort((a, b) => b.total - a.total || a.sigles.localeCompare(b.sigles));
  const total = ordenades.reduce((s, l) => s + l.total, 0);
  // «Altres» que ja arriba fet (el de Xamfrà) no porta mai nom propi.
  const ambNom = ordenades
    .filter((l) => l.sigles !== "Altres")
    .filter((l, i) => i < LLISTES_AMB_NOM && total > 0 && (100 * l.total) / total >= PES_MINIM_LLISTA);
  const restants = ordenades.filter((l) => !ambNom.includes(l));

  let reserva = 0;
  const sortida: LlistaSeccions[] = ambNom.map((l) => {
    const { familia, color } = colorLlista(eleccio.tipus, l.sigles, l.agrupacio, l.oficial, reserva);
    if (!BRANDS_BY_ID.get(familia ?? "")?.color && !colorValid(l.oficial)) reserva += 1;
    return { sigles: l.sigles, familia, color, vots: l.total };
  });
  const altresTotal = restants.reduce((s, l) => s + l.total, 0);
  if (altresTotal > 0) sortida.push({ sigles: "Altres", familia: null, color: COLOR_ALTRES, vots: altresTotal });

  const files: Record<string, number[]> = {};
  for (const p of [...participacio].sort((a, b) =>
    codiSeccio(a.territori_codi, a.districte, a.seccio).localeCompare(codiSeccio(b.territori_codi, b.districte, b.seccio)))) {
    const codi = codiSeccio(p.territori_codi, p.districte, p.seccio);
    const fila = [enter(p.cens_electoral), enter(p.votants), enter(p.vots_nuls), enter(p.vots_blancs)];
    for (const l of ambNom) fila.push(l.perSeccio.get(codi) ?? 0);
    if (altresTotal > 0) fila.push(restants.reduce((s, l) => s + (l.perSeccio.get(codi) ?? 0), 0));
    files[codi] = fila;
  }
  return { id: eleccio.id, etiqueta: eleccio.etiqueta, llistes: sortida, files };
}

// ─────────────────────────────────────────────────────────────────────────────
// Renda per secció (ADRH)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * La renda neta per persona de cada secció d'un CSV provincial de l'ADRH, de
 * l'any més recent que en porta. La columna `Secciones` comença pel codi de
 * deu xifres; les files de municipi i de districte no en porten i es deixen.
 */
export function rendaSeccionsAdrh(text: string): { any: number; valors: Map<string, number> } | null {
  const perAny = new Map<number, Map<string, number>>();
  for (const linia of text.split(/\r?\n/)) {
    const camps = linia.split(";");
    if (camps.length !== 6) continue;
    const [, , seccions, indicador, periode, total] = camps as [string, string, string, string, string, string];
    const m = /^\s*"?(\d{10})\b/.exec(seccions);
    if (!m) continue;
    if (indicador.replace(/"/g, "").trim() !== "Renta neta media por persona") continue;
    const any = Number(periode.trim());
    const valor = parseImportIne(total);
    if (!Number.isInteger(any) || valor === null) continue;
    const mapa = perAny.get(any) ?? new Map<string, number>();
    mapa.set(m[1]!, valor);
    perAny.set(any, mapa);
  }
  const any = Math.max(...perAny.keys());
  return Number.isFinite(any) ? { any, valors: perAny.get(any)! } : null;
}

export const FONT_RENDA = "INE, Atlas de Distribución de Renta de los Hogares (ADRH)";

// ─────────────────────────────────────────────────────────────────────────────
// Muntar la mètrica
// ─────────────────────────────────────────────────────────────────────────────

/** Els 36 municipis de l'AMB i la seva pàgina a Xamfrà (`/municipis/<slug>.html`). */
export const XAMFRA_MUNICIPIS: Readonly<Record<string, string>> = {
  "08015": "badalona", "08019": "barcelona", "08020": "begues", "08054": "castellbisbal", "08056": "castelldefels",
  "08068": "cervello", "08072": "corbera-de-llobregat", "08073": "cornella-de-llobregat", "08077": "esplugues-de-llobregat",
  "08089": "gava", "08101": "l-hospitalet-de-llobregat", "08123": "molins-de-rei", "08125": "montcada-i-reixac",
  "08126": "montgat", "08157": "palleja", "08158": "el-papiol", "08169": "el-prat-de-llobregat", "08180": "ripollet",
  "08194": "sant-adria-de-besos", "08196": "sant-andreu-de-la-barca", "08200": "sant-boi-de-llobregat",
  "08204": "sant-climent-de-llobregat", "08205": "sant-cugat-del-valles", "08211": "sant-feliu-de-llobregat",
  "08217": "sant-joan-despi", "08221": "sant-just-desvern", "08244": "santa-coloma-de-cervello",
  "08245": "santa-coloma-de-gramenet", "08252": "barbera-del-valles", "08263": "sant-vicenc-dels-horts",
  "08266": "cerdanyola-del-valles", "08282": "tiana", "08289": "torrelles-de-llobregat", "08301": "viladecans",
  "08904": "badia-del-valles", "08905": "la-palma-de-cervello",
};

export function metricaDelMunicipi(params: {
  ine5: string;
  geo: readonly SeccioGeo[];
  eleccions: readonly EleccioSeccions[];
  renda: { any: number; font: string; url: string; valors: Map<string, number> } | null;
  origen: VotSeccionsMetric["origen"];
  consultat: string;
}): VotSeccionsMetric | null {
  if (params.geo.length < 2 || params.eleccions.length === 0) return null;
  const mapa = geometriaMunicipi(params.geo);
  const dibuixades = new Set(mapa.seccions.map((s) => s.codi));
  const senseGeometria: Record<string, string[]> = {};
  for (const e of params.eleccions) {
    const fora = Object.keys(e.files).filter((c) => !dibuixades.has(c));
    if (fora.length) senseGeometria[e.id] = fora;
  }
  let renda: VotSeccionsMetric["renda"] = null;
  if (params.renda) {
    const valors: Record<string, number> = {};
    for (const c of dibuixades) {
      const v = params.renda.valors.get(c);
      if (v !== undefined) valors[c] = v;
    }
    if (Object.keys(valors).length >= 2) renda = { any: params.renda.any, font: params.renda.font, url: params.renda.url, valors };
  }
  return {
    origen: params.origen,
    consultat: params.consultat,
    amplada: mapa.amplada,
    alcada: mapa.alcada,
    seccions: mapa.seccions,
    eleccions: [...params.eleccions],
    renda,
    xamfra: XAMFRA_MUNICIPIS[params.ine5] ?? null,
    senseGeometria,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mode Xamfrà: els fitxers ja publicats pel visor
// ─────────────────────────────────────────────────────────────────────────────

type XamfraEleccio = {
  parties: { id: string; short: string; color: string }[];
  sections: Record<string, (number | null | number[])[]>;
  lists?: Record<string, Record<string, string>>;
};

/** El codi de 2025 de Xamfrà (11 xifres, amb el dígit de control) al de 10 de l'INE. */
export const codiDesDeXamfra = (id: string): string => `${id.slice(0, 5)}${id.slice(6)}`;

/**
 * Llegeix el que Xamfrà publica a `public/data` i ho torna amb la mateixa
 * forma que la ingesta de la Generalitat: geometria per municipi, eleccions
 * per municipi i renda. Xamfrà desa els vots dels partits principals de l'AMB i
 * «altres» com la resta fins als vots a candidatures; aquí es refan les files
 * de secció amb aquest mateix criteri.
 */
export function llegeixXamfra(dir: string): {
  geo: Map<string, SeccioGeo[]>;
  eleccions: Map<string, EleccioSeccions[]>;
  renda: { any: number; font: string; url: string; valors: Map<string, number> } | null;
} {
  const geojson = JSON.parse(readFileSync(join(dir, "census", "sections-2025.geojson"), "utf8")) as {
    features: { id: string; geometry: { type: string; coordinates: unknown } }[];
  };
  const crua = new Map<string, SeccioGeo[]>();
  for (const f of geojson.features) {
    const codi = codiDesDeXamfra(String(f.id));
    const poligons = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as Anell[][];
    const anells = poligons.flatMap((p) => p);
    const llista = crua.get(codi.slice(0, 5)) ?? [];
    llista.push({ codi, anells });
    crua.set(codi.slice(0, 5), llista);
  }
  const geo = new Map([...crua].map(([k, v]) => [k, planaDesDeLonLat(v)]));

  const fitxers: Record<IdEleccioSeccions, string> = { M20231: "municipals-2023.json", A20241: "parlament-2024.json" };
  const eleccions = new Map<string, EleccioSeccions[]>();
  for (const e of ELECCIONS_SECCIONS) {
    const x = JSON.parse(readFileSync(join(dir, "elections", fitxers[e.id]), "utf8")) as XamfraEleccio;
    const perMunicipi = new Map<string, { vots: FilaVotsSeccio[]; part: FilaParticipacioSeccio[] }>();
    for (const [id, fila] of Object.entries(x.sections)) {
      const codi = codiDesDeXamfra(id);
      const ine5 = codi.slice(0, 5);
      const [cens, votants, nuls, blancs, candidatures, , partits] = fila as [number, number, number, number, number, number, number[]];
      const m = perMunicipi.get(ine5) ?? { vots: [], part: [] };
      const base = { territori_codi: ine5, districte: codi.slice(5, 7) };
      m.part.push({ ...base, seccio: codi.slice(7), cens_electoral: String(cens), votants: String(votants), vots_nuls: String(nuls), vots_blancs: String(blancs) });
      let suma = 0;
      partits.forEach((v, i) => {
        const p = x.parties[i];
        if (!p) return;
        const sigles = e.tipus === "municipals" ? x.lists?.[ine5]?.[String(i)] ?? null : p.short;
        // A les municipals, un partit de l'AMB que no es presenta en aquest municipi.
        if (sigles === null) return;
        suma += v;
        m.vots.push({ ...base, secci_: codi.slice(7), candidatura_codi: `${p.id}`, candidatura_sigles: sigles, candidatura_color: p.color, agrupacio_codi: p.id, vots: String(v) });
      });
      const altres = (candidatures ?? 0) - suma;
      if (altres > 0) m.vots.push({ ...base, secci_: codi.slice(7), candidatura_codi: "altres", candidatura_sigles: "Altres", candidatura_color: COLOR_ALTRES, vots: String(altres) });
      perMunicipi.set(ine5, m);
    }
    for (const [ine5, { vots, part }] of perMunicipi) {
      const r = eleccioDelMunicipi(e, vots, part);
      if (!r) continue;
      const llista = eleccions.get(ine5) ?? [];
      llista.push(r);
      eleccions.set(ine5, llista);
    }
  }

  let renda: ReturnType<typeof llegeixXamfra>["renda"] = null;
  const camiRenda = join(dir, "income", "income-sections.json");
  if (existsSync(camiRenda)) {
    const r = JSON.parse(readFileSync(camiRenda, "utf8")) as {
      income_reference_year: number;
      rows: Record<string, { values: { net_income_per_person_eur?: number | null } }>;
    };
    const valors = new Map<string, number>();
    for (const [id, fila] of Object.entries(r.rows)) {
      const v = fila.values.net_income_per_person_eur;
      if (typeof v === "number") valors.set(codiDesDeXamfra(id), v);
    }
    renda = { any: r.income_reference_year, font: `${FONT_RENDA}, via Xamfrà`, url: urlTaulaAdrh(TAULES_ADRH[0].taula), valors };
  }
  return { geo, eleccions, renda };
}

// ─────────────────────────────────────────────────────────────────────────────
// La feina
// ─────────────────────────────────────────────────────────────────────────────

const AQUI = dirname(fileURLToPath(import.meta.url));
const CAMI_ICGC = resolve(AQUI, "../../../db/.data/icgc/bseccen-2025.zip");

async function zipIcgc(): Promise<Uint8Array> {
  if (existsSync(CAMI_ICGC)) return readFileSync(CAMI_ICGC);
  const resposta = await fetch(URL_ICGC_SECCIONS);
  if (!resposta.ok) throw new Error(`ICGC: HTTP ${resposta.status}`);
  const bytes = new Uint8Array(await resposta.arrayBuffer());
  mkdirSync(dirname(CAMI_ICGC), { recursive: true });
  writeFileSync(CAMI_ICGC, bytes);
  return bytes;
}

export async function j47VotSeccions(db: Db): Promise<void> {
  const tots = await db.select({ id: municipalities.id, name: municipalities.name, ine5: municipalities.ine5 }).from(municipalities);

  await withRun(db, "J47 vot per secció censal (mètode de Xamfrà)", async (run) => {
    const consultat = new Date().toISOString().slice(0, 10);
    const dirXamfra = process.env.QUIVOTO_XAMFRA_DADES;
    let geo: Map<string, SeccioGeo[]>;
    let eleccions: Map<string, EleccioSeccions[]>;
    let renda: ReturnType<typeof llegeixXamfra>["renda"];
    let origen: VotSeccionsMetric["origen"];

    if (dirXamfra) {
      origen = "xamfra";
      ({ geo, eleccions, renda } = llegeixXamfra(dirXamfra));
      run.say(`mode Xamfrà: ${geo.size} municipis des de ${dirXamfra}`);
    } else {
      origen = "generalitat";
      geo = seccionsDesDeZipIcgc(await zipIcgc());
      eleccions = new Map();
      for (const e of ELECCIONS_SECCIONS) {
        const vots = await socrataAll<FilaVotsSeccio>(DATASETS.resultats, {
          where: `id_eleccio='${e.id}' AND id_nivell_territorial='SE'`,
          select: "territori_codi,districte,secci_,candidatura_codi,candidatura_sigles,candidatura_color,agrupacio_codi,vots",
        }, 50_000);
        const part = await socrataAll<FilaParticipacioSeccio>("irrv-2mfc", {
          where: `id_eleccio='${e.id}' AND id_nivell_territorial='SE'`,
          select: "territori_codi,districte,seccio,cens_electoral,votants,vots_nuls,vots_blancs",
        }, 50_000);
        run.rowsIn += vots.length + part.length;
        const v = new Map<string, FilaVotsSeccio[]>();
        const p = new Map<string, FilaParticipacioSeccio[]>();
        for (const f of vots) (v.get(codiIne(f.territori_codi)) ?? v.set(codiIne(f.territori_codi), []).get(codiIne(f.territori_codi))!).push(f);
        for (const f of part) (p.get(codiIne(f.territori_codi)) ?? p.set(codiIne(f.territori_codi), []).get(codiIne(f.territori_codi))!).push(f);
        for (const [ine5, files] of p) {
          const r = eleccioDelMunicipi(e, v.get(ine5) ?? [], files);
          if (r) (eleccions.get(ine5) ?? eleccions.set(ine5, []).get(ine5)!).push(r);
        }
        run.say(`${e.etiqueta}: ${vots.length} files de vots i ${part.length} de participació`);
      }
      const valors = new Map<string, number>();
      let anyRenda = 0;
      for (const t of TAULES_ADRH) {
        const r = rendaSeccionsAdrh(await fetchText(urlDescarregaAdrh(t.taula)));
        if (!r) continue;
        anyRenda = Math.max(anyRenda, r.any);
        for (const [c, val] of r.valors) valors.set(c, val);
      }
      renda = valors.size ? { any: anyRenda, font: FONT_RENDA, url: urlTaulaAdrh(TAULES_ADRH[0].taula), valors } : null;
    }

    const desats: number[] = [];
    for (const m of tots) {
      const metrica = metricaDelMunicipi({
        ine5: m.ine5, geo: geo.get(m.ine5) ?? [], eleccions: eleccions.get(m.ine5) ?? [], renda, origen, consultat,
      });
      if (!metrica) continue;
      for (const [id, codis] of Object.entries(metrica.senseGeometria)) {
        await run.issue({ kind: "vot per secció: secció sense geometria 2025", severity: "baixa", municipalityId: m.id, entity: id, detail: { codis } });
      }
      await db.insert(municipalityMetrics).values({ municipalityId: m.id, kind: KIND, data: metrica }).onConflictDoUpdate({
        target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
        set: { data: metrica, computedAt: new Date() },
      });
      desats.push(m.id);
      run.rowsOut += 1;
    }
    // En mode Xamfrà només es toquen els de l'AMB: la resta conserva el que tenia.
    if (origen === "generalitat") {
      await db.delete(municipalityMetrics).where(
        desats.length ? and(eq(municipalityMetrics.kind, KIND), notInArray(municipalityMetrics.municipalityId, desats)) : eq(municipalityMetrics.kind, KIND),
      );
    }
    run.say(`${run.rowsOut} municipis amb mapa de vot per secció`);
    return { municipis: run.rowsOut, origen };
  });
}
