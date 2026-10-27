/**
 * Una cara: el retrat d'una persona electa quan en tenim, i si no, les seves
 * inicials sobre el color de la seva força.
 *
 * Va néixer a la fitxa municipal (`renderAlcaldia()` de `radiografia.ts`) i
 * viu aquí perquè la portada, les comarques, els partits i les fitxes de
 * persona puguin ensenyar la mateixa cara de la mateixa manera. La regla que
 * la fa servible a totes: **sempre fa la mateixa mida**, tingui foto o no. Va
 * ser el motiu pel qual la portada va renunciar a les cares —qui té foto i qui
 * no en feien vuit capses de vuit mides— i amb les inicials al mateix cercle
 * ja no passa.
 *
 * El CSS és `.cara-alcaldia` d'`estil.ts`, que ja carrega tota pàgina de
 * l'Observatori; la mida per defecte (52 px) és la de la fitxa. Una mida més
 * petita s'escriu amb la variable `--mida` i la classe `petita`.
 */

import { sobreColor } from "./contrast";

const escape = (t: string): string =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Les inicials del nom: les dues primeres paraules, «Marta Farrés» → «MF». */
export function inicials(nom: string): string {
  return nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export type OpcionsCara = {
  /** Mida en píxels; 52 si no es diu. */
  mida?: number;
  /** El color de la força, per a les inicials; gris si no se sap. */
  color?: string | null;
};

/**
 * La cara com a HTML: `<img>` amb el retrat, o un `<span>` amb les inicials.
 * És decorativa (`alt=""`, `aria-hidden`): el nom va sempre al costat, com a
 * text, i és el text el que enllaça.
 *
 * El retrat és un `<img>` sol, sense res al voltant, i ha de continuar sent-ho:
 * les pàgines el posen directament dins d'un enllaç o d'una graella
 * (`.partit-llocs li > .cara-alcaldia`), i la fitxa del regidor (`caraAmbInicials`)
 * ja hi apila a sota les inicials d'aquesta mateixa funció. Si aquí s'hi afegís
 * una segona capa d'inicials, allà en sortirien dues. Per això el «mentre
 * carrega» no és HTML sinó el fons de `img.cara-alcaldia` a `estil.ts`: una
 * silueta en comptes d'un cercle blanc buit, que la foto tapa quan arriba.
 */
export function cara(nom: string, foto: string | null | undefined, opcions: OpcionsCara = {}): string {
  const mida = opcions.mida ?? 52;
  const estilMida = mida === 52 ? "" : `--mida:${mida}px;`;
  if (foto) {
    return `<img class="cara-alcaldia${mida === 52 ? "" : " petita"}" style="${estilMida}" src="${escape(foto)}" alt="" width="${mida}" height="${mida}" loading="lazy">`;
  }
  const { fons, tinta } = sobreColor(opcions.color ?? "#9a9a9a");
  return `<span class="cara-alcaldia inicials${mida === 52 ? "" : " petita"}" style="${estilMida}--c:${fons};--t:${tinta}" aria-hidden="true">${escape(inicials(nom))}</span>`;
}
