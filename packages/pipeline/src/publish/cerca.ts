import { writeFile } from "node:fs/promises";
import type { Els947Row } from "./els947";

/**
 * L'índex per anar d'un municipi a un altre sense passar per la portada.
 *
 * Avui, per anar de la fitxa de Barcelona a la de Rubí cal tornar enrere i
 * buscar-hi: la fitxa és un cul-de-sac de 947 possibles. Amb aquest fitxer, la
 * casella de la capçalera hi va escrivint.
 *
 * És deliberadament prim —slug, nom, comarca i habitants— perquè el baixa el
 * navegador de qualsevol que obri la casella: amb els 947 municipis són uns 40
 * kB, i el que hi afegiria pes de debò (els 4.807 electes, les 2.626
 * candidatures) demana un índex a part i una decisió de si val la pena. Aquí
 * només hi ha el que respon la pregunta que fa tothom: «i el meu poble?».
 *
 * La clau de cerca va precalculada i no la calcula el navegador: és la mateixa
 * normalització que fa servir el joc dels 947 —sense accents, sense l'article
 * inicial— i fer-la aquí estalvia normalitzar 947 noms a cada pulsació.
 */

export type FilaCerca = {
  /** slug, nom, comarca, habitants */
  s: string;
  n: string;
  c: string;
  h: number;
  /** clau de cerca ja normalitzada */
  k: string;
};

/** Sense accents, sense article inicial i sense signes. La mateixa d'els947. */
export function clauCerca(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, " ")
    .replace(/^(l|el|la|els|les|es|sa)\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function indexDeCerca(files: readonly Els947Row[]): FilaCerca[] {
  return files
    .map((f) => ({ s: f.s, n: f.n, c: f.c, h: f.p, k: clauCerca(f.n) }))
    .sort((a, b) => a.k.localeCompare(b.k, "ca"));
}

export async function escriuCerca(files: readonly Els947Row[], cami: string): Promise<number> {
  const index = indexDeCerca(files);
  await writeFile(cami, JSON.stringify(index), "utf8");
  return index.length;
}
