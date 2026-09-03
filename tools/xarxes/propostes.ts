/**
 * Què és una proposta d'imatge i què comparteixen totes les famílies.
 *
 * Una proposta és una composició (cos HTML + CSS propi) que es pot dibuixar a
 * una o dues mides, més el text suggerit per al tuit i l'enllaç de la pàgina
 * d'on surt la dada. Cada família (`familia-*.ts`) en fabrica unes quantes a
 * partir de les dades de disc; `genera.ts` les dibuixa totes i escriu l'índex.
 */

import type { Curiositat, Fila, Ranquings } from "./dades";
import type { Fons, Mida } from "./estil";

/** Tot el que les famílies poden necessitar, ja llegit de disc. */
export type Dades = {
  generat: string;
  files: Fila[];
  curiositats: Curiositat[];
  ranquings: Ranquings;
  titolsRanquings: Record<string, { titol: string; font: string }>;
  /** Participació de les fitxes que s'han llegit, per slug. */
  participacio: Record<string, { any: number; pct: number; votants: number; cens: number }[]>;
  /** Captures del web ja fetes, com a `data:` PNG, per nom. */
  captures: Record<string, string>;
};

export type Proposta = {
  /** Subdirectori i prefix del fitxer: `friki`, `top`, `abans`, `mapa`, `captura`, `fil`, `marca`. */
  familia: string;
  /** Part descriptiva del nom del fitxer: `rajadell-vehicles`. */
  nom: string;
  variant: number;
  fons: Fons;
  mides: Mida["nom"][];
  /** Text suggerit per al tuit, curt i amb la font. */
  tuit: string;
  /** La pàgina de quivoto.cat on és la dada. */
  enllac: string;
  css?: string;
  cos: (mida: Mida) => string;
};

export const SITE = "https://quivoto.cat";
export const OBS = `${SITE}/observatori`;

export function fitxerDe(p: Proposta, mida: Mida): string {
  return `${p.familia}/${p.familia}-${p.nom}-${mida.nom}-v${p.variant}.png`;
}

/** Enllaç absolut a partir del `href` relatiu de la pàgina de rànquings («../m/x/»). */
export function enllacDe(href: string | null): string {
  if (!href) return `${OBS}/ranquings/`;
  return `${OBS}/${href.replace(/^\.\.\//, "")}`;
}

export function curiositat(d: Dades, id: string): Curiositat {
  const c = d.curiositats.find((x) => x.id === id);
  if (!c) throw new Error(`no hi ha la curiositat «${id}» a la pàgina de rànquings`);
  return c;
}

/** Els fons que van rotant entre variants perquè la carpeta no sigui monòtona. */
export const ROTACIO: readonly Fons[] = ["menta", "paper", "lavanda", "presec", "tinta"];
