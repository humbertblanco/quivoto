/**
 * Disposició dels escons en hemicicle. És la manera com la gent ha vist sempre un
 * ple i, a diferència d'un gràfic de sectors, deixa comptar els regidors un a un:
 * 11 de 21 és una majoria absoluta que es veu, no que s'ha de calcular.
 *
 * La feina de debò és l'empaquetat, i té una trampa. Si es fixen les fileres i
 * després es reparteixen els escons per tot l'arc, les fileres de fora queden
 * escampades: els cercles hi caben de sobres i el dibuix deixa de semblar una
 * sala. El camí correcte és el contrari —**el radi de l'escó decideix quants en
 * caben**— i és el que fa aquest fitxer: busca l'escó més gros que permet encabir
 * exactament els regidors que hi ha, amb la mateixa densitat a totes les fileres.
 *
 * La segona meitat del fitxer, `seientsHemicicle()`, escriu els cercles: qui
 * dibuixa la fitxa municipal hi passa els escons d'aquí i els grups del ple, i
 * cada cercle surt amb la seva etiqueta (`data-nom`, `data-valor`, les línies
 * de més a `data-extres` i el `<title>`), que és el contracte de `GRAFICS_JS`
 * a `grafics.ts`.
 */

import { atributsEtiqueta, textEtiqueta, type DadaEtiqueta } from "./grafics";

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type Seat = { x: number; y: number; r: number };

/** El dibuix sencer: els escons i la mida exacta del llenç que els conté. */
export type Hemicycle = { seats: Seat[]; width: number; height: number; seatRadius: number; rows: number };

/** Separació entre centres de fileres, en radis d'escó. */
const ROW_PITCH = 2.5;
/** Separació entre centres d'escons veïns de la mateixa filera, en radis. */
const SEAT_PITCH = 2.3;
/** Radi del forat del mig, com a fracció del radi exterior. */
const HOLE = 0.36;

type Packing = { radii: number[]; counts: number[]; seatRadius: number };

/**
 * Quants escons hi caben amb un radi donat, treballant en unitats on el radi
 * exterior val 1. Retorna també les fileres, perquè no s'hagin de recalcular.
 */
function capacityFor(seatRadius: number): { radii: number[]; capacity: number[] } {
  const usable = 1 - HOLE - seatRadius;
  if (usable <= 0) return { radii: [], capacity: [] };
  const rows = Math.max(1, Math.floor(usable / (ROW_PITCH * seatRadius)) + 1);
  const pitch = rows === 1 ? 0 : usable / (rows - 1);

  const radii: number[] = [];
  const capacity: number[] = [];
  for (let i = 0; i < rows; i += 1) {
    const radius = HOLE + i * pitch;
    radii.push(radius);
    // Mig cercle de radi `radius`: hi caben els escons que hi càpiguen amb la
    // separació mínima, i sempre almenys un.
    capacity.push(Math.max(1, Math.floor((Math.PI * radius) / (SEAT_PITCH * seatRadius)) + 1));
  }
  return { radii, capacity };
}

/** L'escó més gros amb què hi caben tots, per bisecció. */
function pack(total: number): Packing | null {
  let low = 0.004;
  let high = 0.5;
  let best: Packing | null = null;

  for (let step = 0; step < 60; step += 1) {
    const seatRadius = (low + high) / 2;
    const { radii, capacity } = capacityFor(seatRadius);
    const fits = capacity.reduce((a, n) => a + n, 0) >= total;
    if (fits) {
      best = { radii, counts: distribute(total, capacity), seatRadius };
      low = seatRadius; // prova d'engrandir-lo encara més
    } else {
      high = seatRadius;
    }
  }
  return best;
}

/**
 * Reparteix `total` escons entre les fileres, proporcionalment al que hi cap a
 * cadascuna, i sense passar-se de la capacitat de cap.
 */
function distribute(total: number, capacity: readonly number[]): number[] {
  const room = capacity.reduce((a, n) => a + n, 0);
  const counts = capacity.map((n) => Math.min(n, Math.floor((total * n) / room)));
  let assigned = counts.reduce((a, n) => a + n, 0);

  // El que falta va a les fileres de fora, que és on hi ha més lloc.
  for (let i = counts.length - 1; assigned < total; i = i === 0 ? counts.length - 1 : i - 1) {
    if (counts[i]! < capacity[i]!) {
      counts[i]! += 1;
      assigned += 1;
    }
  }
  for (let i = 0; assigned > total; i = (i + 1) % counts.length) {
    if (counts[i]! > 0) {
      counts[i]! -= 1;
      assigned -= 1;
    }
  }
  return counts;
}

export function hemicycle(total: number, options: { width?: number } = {}): Hemicycle {
  const width = options.width ?? 660;
  if (total <= 0) return { seats: [], width, height: 0, seatRadius: 0, rows: 0 };

  const packing = pack(total);
  if (!packing) return { seats: [], width, height: 0, seatRadius: 0, rows: 0 };

  // Escala: el radi exterior més un escó han de cabre a mitja amplada.
  const scale = width / 2 / (1 + packing.seatRadius);
  const seatRadius = packing.seatRadius * scale;
  const centreX = width / 2;
  const baseline = scale;

  // Els escons s'ordenen per angle i no per filera: així cada candidatura ocupa
  // un sector continu de la sala, com passa de veritat.
  const seats: (Seat & { angle: number })[] = [];
  packing.radii.forEach((relativeRadius, row) => {
    const count = packing.counts[row]!;
    if (count === 0) return;
    const radius = relativeRadius * scale;
    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const angle = Math.PI - t * Math.PI;
      seats.push({
        x: centreX + radius * Math.cos(angle),
        y: baseline - radius * Math.sin(angle) + seatRadius,
        r: seatRadius,
        angle,
      });
    }
  });

  const round = (n: number): number => Math.round(n * 10) / 10;
  return {
    seats: seats
      .sort((a, b) => b.angle - a.angle)
      .map(({ x, y, r }) => ({ x: round(x), y: round(y), r: round(r) })),
    width,
    height: Math.ceil(baseline + 2 * seatRadius),
    seatRadius: round(seatRadius),
    rows: packing.radii.filter((_, i) => packing.counts[i]! > 0).length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Els cercles, amb l'etiqueta de cadascun
// ─────────────────────────────────────────────────────────────────────────────

/** Un grup del ple, tal com el rep el dibuix: sigles, escons i color. */
export type GrupHemicicle = {
  /** Les sigles o el nom del grup. És el que diu l'etiqueta quan no se sap qui hi seu. */
  nom: string;
  regidories: number;
  /** El color de dada, ja decidit per qui crida (`colorDeCandidatura` a la fitxa). */
  color: string;
  /**
   * Els vots de la candidatura i la part del total que són, si es coneixen.
   * L'hemicicle diu escons, i dos grups amb els mateixos escons poden tenir
   * mil vots de diferència: l'etiqueta és l'únic lloc del dibuix on es veu.
   */
  vots?: number | null;
  pctVots?: number | null;
  /** Cert si el grup forma govern: l'etiqueta hi afegeix «al govern». */
  govern?: boolean;
  /**
   * Qui hi seu, per ordre, si es coneix. Pot ser més curt que `regidories`
   * —els escons que no tenen nom tornen a dir el grup—; la fitxa el passa
   * quan té el ple de la seu electrònica o del registre de la Generalitat.
   */
  persones?: readonly (string | null | undefined)[];
};

/** Els mateixos formats que la fitxa: «35.799» i «46,8 %». */
const number = (n: number): string => n.toLocaleString("ca-ES");
const percent = (n: number): string => `${n.toFixed(1).replace(".", ",")} %`;

/**
 * L'etiqueta d'un escó. Quan es coneix la persona, el nom és el seu i el grup
 * passa a la dada («Marta Farrés: PSC · al govern»), amb el recompte com a
 * línia de més; quan no, el nom és el grup i la dada és el recompte, que si
 * no el `<title>` deia «ERC: ERC · 5 de 21 regidories». Els vots van sempre
 * com a línia de més («vots: 35.799 · 46,8 %»), perquè són el que l'hemicicle
 * no ensenya. L'ordre dels trossos és el de `textEtiqueta()`.
 */
/**
 * La unitat amb què es compten els escons a l'etiqueta. Un ple municipal té
 * regidories; una diputació o un consell comarcal, seients, i dir-hi
 * «regidories» confon justament el que aquelles fitxes expliquen.
 */
export type UnitatSeients = { singular: string; plural: string };
const REGIDORIES: UnitatSeients = { singular: "regidoria", plural: "regidories" };

export function etiquetaSeient(
  grup: GrupHemicicle,
  total: number,
  persona?: string | null,
  unitat: UnitatSeients = REGIDORIES,
): DadaEtiqueta {
  const recompte = `${grup.regidories} de ${total}`;
  const govern = grup.govern ? " · al govern" : "";
  const extres: { etq: string; valor: string }[] = [];
  if (grup.vots !== null && grup.vots !== undefined && grup.vots > 0) {
    extres.push({
      etq: "vots",
      valor: grup.pctVots !== null && grup.pctVots !== undefined ? `${number(grup.vots)} · ${percent(grup.pctVots)}` : number(grup.vots),
    });
  }
  // Amb persona, el recompte deixa de ser la dada i passa a línia de més; sense
  // persona ja és la dada, i repetir-lo sota seria dir-ho dues vegades.
  if (persona) extres.push({ etq: unitat.plural, valor: recompte });
  return {
    nom: persona || grup.nom,
    valor: persona ? `${grup.nom}${govern}` : `${recompte} ${total === 1 ? unitat.singular : unitat.plural}${govern}`,
    extres: extres.length > 0 ? extres : null,
  };
}

/**
 * Els cercles de l'hemicicle, un per escó i en l'ordre dels grups rebuts:
 * els escons van d'esquerra a dreta i cada grup n'omple un sector seguit.
 *
 * Cada cercle porta els `data-*` de l'etiqueta flotant i el `<title>` amb la
 * mateixa frase per a quan no hi ha script. No porta `tabindex`: l'SVG és
 * `role="img"` amb la seva frase i la llista de sota ja diu el mateix escó per
 * escó; vint-i-una parades de tabulador que diuen «ERC, 5 de 21» no ajudarien
 * ningú. El ratolí, el dit i el llapis sí que hi arriben, que és el que fa el
 * script amb qualsevol `[data-valor]`.
 *
 * Si hi ha més escons que regidories sumades, els que sobren no es dibuixen;
 * si n'hi ha menys, els grups de la cua queden escapçats. Totes dues coses
 * volen dir que `total` i els grups no quadren, i qui crida ho ha de saber
 * abans d'arribar aquí.
 */
export function seientsHemicicle(
  seats: readonly Seat[],
  grups: readonly GrupHemicicle[],
  total: number,
  unitat: UnitatSeients = REGIDORIES,
): string {
  let cursor = 0;
  const cercles: string[] = [];
  for (const grup of grups) {
    for (let i = 0; i < grup.regidories && cursor < seats.length; i += 1, cursor += 1) {
      const seat = seats[cursor]!;
      const dada = etiquetaSeient(grup, total, grup.persones?.[i], unitat);
      cercles.push(
        `<circle class="seient" cx="${seat.x}" cy="${seat.y}" r="${seat.r}" fill="${escape(grup.color)}" stroke="var(--ink)" stroke-width="1.5"${atributsEtiqueta(dada)}><title>${escape(textEtiqueta(dada))}</title></circle>`,
      );
    }
  }
  return cercles.join("\n    ");
}
