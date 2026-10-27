/**
 * El territori a la fitxa i als rànquings: superfície, altitud, densitat i
 * gentilici, tal com els desa J32 (`kind = "territori"`).
 *
 * Dues peces, i totes dues pures:
 *
 *   · `renderTerritori()` escriu la línia d'entrada de la fitxa —«496
 *     habitants · 32,5 km² · 15 hab./km² · 980 m · vilallerencs»— amb el que
 *     hi ha i prou: una dada que falta no hi deixa cap forat ni cap zero, i
 *     la línia s'escurça.
 *   · `curiositatsTerritori()` torna els fets del territori en el mateix
 *     format que `curiositats.ts`, perquè la pàgina de rànquings els pinti
 *     amb `targetaCuriositat()` sense saber d'on surten: el més extens i el
 *     més petit, el més alt i el més baix, els més i els menys densos, i els
 *     gentilicis més llargs.
 *
 * Es viu en un mòdul a part de `curiositats.ts` i de `radiografia.ts` perquè
 * es pugui provar sol i cablejar-lo després, i perquè les regles editorials
 * d'aquells mòduls —cada fet diu sobre quants s'ha mirat, un buit no és un
 * zero, cap veredicte— s'apliquin aquí sense tocar-los.
 *
 * Una cautela que cal repetir a la pàgina: l'altitud de la font és la del
 * nucli on hi ha l'ajuntament, no la mitjana del terme ni el cim més alt.
 * «El municipi més alt» vol dir «l'ajuntament més alt».
 */

import { consultatEl } from "../lib/text";
import { primers, type Curiositat, type FilaCuriosa } from "./curiositats";

const escape = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n = (v: number, d = 0): string =>
  v.toLocaleString("ca-ES", { minimumFractionDigits: d, maximumFractionDigits: d });

// --------------------------------------------------------------- capçalera

/** El que la línia d'entrada de la fitxa necessita. Tot pot faltar. */
export type TerritoriCapcalera = {
  /** El padró vigent, el mateix que la fitxa ja escriu. */
  habitants: number | null;
  /** km² */
  superficie: number | null;
  /** metres, del nucli de l'ajuntament */
  altitud: number | null;
  /** hab./km²; si no ve, es calcula amb els habitants i la superfície */
  densitat?: number | null;
  /** en masculí plural, com el publica la Generalitat */
  gentilici: string | null;
};

const esXifra = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

/** La densitat que es pot dir: la que ve, o la que surt del padró i la superfície. */
export function densitatDe(habitants: number | null | undefined, superficie: number | null | undefined, densitat?: number | null): number | null {
  if (esXifra(densitat)) return densitat;
  if (!esXifra(habitants) || !esXifra(superficie) || habitants <= 0 || superficie <= 0) return null;
  return habitants / superficie;
}

/** Els km² sempre amb un decimal: «9,7 km²», «101,4 km²». */
export const superficieText = (km2: number): string => `${n(km2, 1)} km²`;

/** Per sota de 10 hab./km² el decimal distingeix pobles; per sobre només fa soroll. */
export const densitatText = (d: number): string => `${n(d, d < 10 ? 1 : 0)} hab./km²`;

export const altitudText = (m: number): string => `${n(m)} m`;

/**
 * La línia de la capçalera de la fitxa: «496 habitants · 32,5 km² · 15
 * hab./km² · 980 m · vilallerencs». Cada tros hi és només si la dada hi és;
 * amb res de res torna una cadena buida, perquè qui la cableja decideixi què
 * hi posa en lloc seu.
 */
export function renderTerritori(dades: TerritoriCapcalera): string {
  const densitat = densitatDe(dades.habitants, dades.superficie, dades.densitat);
  const trossos: string[] = [];
  if (esXifra(dades.habitants) && dades.habitants > 0) trossos.push(`${n(dades.habitants)} habitants`);
  if (esXifra(dades.superficie) && dades.superficie > 0) trossos.push(superficieText(dades.superficie));
  if (densitat !== null) trossos.push(`<span title="habitants per quilòmetre quadrat, amb el padró vigent">${densitatText(densitat)}</span>`);
  if (esXifra(dades.altitud)) {
    trossos.push(`<span title="altitud del nucli on hi ha l'ajuntament, segons la Generalitat">${altitudText(dades.altitud)}</span>`);
  }
  if (dades.gentilici) trossos.push(`<span class="gentilici" title="gentilici">${escape(dades.gentilici)}</span>`);
  return trossos.join(" · ");
}

// ------------------------------------------------------------ curiositats

/**
 * El que els fets del territori necessiten de cada fila dels 947. És el
 * subconjunt d'`Els947Row` amb els quatre camps que `loadEls947()` hi ha
 * d'afegir des de la mètrica «territori»: `sup` (km²), `alt` (m), `gen`
 * (gentilici) i `dens` (hab./km²). Tots opcionals: `null` i «no hi és» volen
 * dir el mateix, absència.
 */
export type FilaTerritori = {
  s: string; n: string; c: string; p: number;
  sup?: number | null;
  alt?: number | null;
  gen?: string | null;
  dens?: number | null;
};

const FONT = "Generalitat de Catalunya · dades generals dels ens locals";

const municipi = (f: FilaTerritori): FilaCuriosa["municipi"] => ({ s: f.s, n: f.n, c: f.c });

const sobre = (quants: number, que: string, total: number): string =>
  `S'ha mirat ${que} de ${n(quants)} municipis${quants < total ? ` dels ${n(total)}` : ""}.`;

/** Les lletres d'un gentilici, sense espais ni guions: «sant-cugatencs» en té 13. */
export const lletresDe = (text: string): number => text.replace(/[^\p{L}]/gu, "").length;

export type OpcionsTerritori = {
  /** El dia que J32 va llegir el conjunt, ISO; surt al període del fet. */
  consultat?: string | null;
};

/**
 * Els fets del territori, en l'ordre en què surten. Cada un només s'escriu si
 * hi ha almenys un municipi amb la dada, i diu sobre quants s'ha mirat.
 */
export function curiositatsTerritori(files: readonly FilaTerritori[], opcions: OpcionsTerritori = {}): Curiositat[] {
  const total = files.length;
  const periode = opcions.consultat ? `registre vigent, ${consultatEl(opcions.consultat)}` : "registre vigent";
  const fets: Curiositat[] = [];

  // ---- els més extensos i els més petits -----------------------------------
  {
    const ambSuperficie = files.filter((f) => esXifra(f.sup) && f.sup > 0);
    if (ambSuperficie.length > 0) {
      const filaDe = (f: FilaTerritori): FilaCuriosa => ({
        municipi: municipi(f),
        valor: superficieText(f.sup!),
        detall: `${n(f.p)} habitants`,
      });
      const grans = primers(ambSuperficie, (f) => f.sup!, (f) => f.n, 5, "max");
      const petits = primers(ambSuperficie, (f) => f.sup!, (f) => f.n, 5, "min");
      fets.push({
        id: "extensio",
        titol: "Els termes més extensos i els més petits",
        metode: "La superfície del terme municipal en quilòmetres quadrats, tal com la publica el registre d'ens locals de la Generalitat.",
        periode,
        font: FONT,
        llistes: [
          { cap: "Els més extensos", files: grans.files.map(filaDe), empatats: grans.empatats },
          { cap: "Els més petits", files: petits.files.map(filaDe), empatats: petits.empatats },
        ],
        cobertura: sobre(ambSuperficie.length, "la superfície", total),
      });
    }
  }

  // ---- els més alts i els més baixos ---------------------------------------
  {
    const ambAltitud = files.filter((f) => esXifra(f.alt));
    if (ambAltitud.length > 0) {
      const filaDe = (f: FilaTerritori): FilaCuriosa => ({
        municipi: municipi(f),
        valor: altitudText(f.alt!),
        detall: `${n(f.p)} habitants`,
      });
      const alts = primers(ambAltitud, (f) => f.alt!, (f) => f.n, 5, "max");
      const baixos = primers(ambAltitud, (f) => f.alt!, (f) => f.n, 5, "min");
      fets.push({
        id: "altitud",
        titol: "Els ajuntaments més alts i els més baixos",
        metode: "L'altitud en metres del nucli on hi ha l'ajuntament, segons el registre d'ens locals de la Generalitat.",
        periode,
        font: FONT,
        llistes: [
          { cap: "Els més alts", files: alts.files.map(filaDe), empatats: alts.empatats },
          { cap: "Els més baixos", files: baixos.files.map(filaDe), empatats: baixos.empatats },
        ],
        cobertura: sobre(ambAltitud.length, "l'altitud", total),
        cautela: "És l'altitud de la casa de la vila, no la mitjana del terme ni el punt més alt: un municipi de muntanya amb l'ajuntament a la vall surt més avall del que sembla.",
      });
    }
  }

  // ---- els més densos i els menys ------------------------------------------
  {
    const ambDensitat = files
      .map((f) => ({ fila: f, densitat: densitatDe(f.p, f.sup, f.dens) }))
      .filter((x): x is { fila: FilaTerritori; densitat: number } => x.densitat !== null);
    if (ambDensitat.length > 0) {
      const filaDe = (x: (typeof ambDensitat)[number]): FilaCuriosa => ({
        municipi: municipi(x.fila),
        valor: densitatText(x.densitat),
        detall: `${n(x.fila.p)} habitants${esXifra(x.fila.sup) ? ` · ${superficieText(x.fila.sup)}` : ""}`,
      });
      const densos = primers(ambDensitat, (x) => x.densitat, (x) => x.fila.n, 5, "max");
      const buits = primers(ambDensitat, (x) => x.densitat, (x) => x.fila.n, 5, "min");
      fets.push({
        id: "densitat",
        titol: "Els municipis més densos i els més buits",
        metode: "Els habitants del padró vigent dividits pels quilòmetres quadrats del terme.",
        periode,
        font: FONT,
        llistes: [
          { cap: "Més habitants per km²", files: densos.files.map(filaDe), empatats: densos.empatats },
          { cap: "Menys habitants per km²", files: buits.files.map(filaDe), empatats: buits.empatats },
        ],
        cobertura: sobre(ambDensitat.length, "el padró i la superfície", total),
        cautela: "La densitat és sobre tot el terme, boscos i camps inclosos: no diu com d'atapeït és el nucli.",
      });
    }
  }

  // ---- els gentilicis més llargs -------------------------------------------
  {
    const ambGentilici = files.filter((f) => typeof f.gen === "string" && f.gen.trim() !== "");
    if (ambGentilici.length > 0) {
      const filaDe = (f: FilaTerritori): FilaCuriosa => ({
        municipi: municipi(f),
        valor: f.gen!,
        detall: `${n(lletresDe(f.gen!))} lletres`,
      });
      const llargs = primers(ambGentilici, (f) => lletresDe(f.gen!), (f) => f.n, 10, "max");
      fets.push({
        id: "gentilicis",
        titol: "Els gentilicis més llargs",
        metode: "Les lletres del gentilici que publica el registre d'ens locals, sense comptar espais ni guions. El registre només en dona la forma masculina plural.",
        periode,
        font: FONT,
        llistes: [{ cap: "Els deu més llargs", files: llargs.files.map(filaDe), empatats: llargs.empatats }],
        cobertura: sobre(ambGentilici.length, "el gentilici", total),
      });
    }
  }

  return fets;
}
