/**
 * El que totes les propostes comparteixen: la marca, la mascota, el peu amb la
 * font i l'any, i l'estil base que fa que dues imatges de famílies diferents
 * es reconeguin com a germanes.
 *
 * Les mides van en `rem` i l'arrel val l'1 % de l'amplada: així la mateixa
 * composició es dibuixa igual de proporcionada a 1600×900 i a 1080×1350, i
 * només cal tocar el que canvia de debò entre apaïsat i vertical (la classe
 * `vertical` al cos).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { catalunya, papereta } from "../../packages/pipeline/src/publish/mascota";
import { ARREL, type Composicio } from "./render";

export type Mida = { nom: "16x9" | "4x5"; ample: number; alt: number };
export const MIDES: readonly Mida[] = [
  { nom: "16x9", ample: 1600, alt: 900 },
  { nom: "4x5", ample: 1080, alt: 1350 },
];

export const escape = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Xifres en català: «1.731.649», «44,7». */
export const n = (v: number, d = 0): string =>
  v.toLocaleString("ca-ES", { minimumFractionDigits: d, maximumFractionDigits: d });

/**
 * El logotip del web, com a `<img>` amb `data:` (porta la font incrustada).
 * En surten dos, el de tinta i el de paper, i el CSS ensenya el que toca
 * segons el fons: sobre tinta el logotip fosc no es veuria.
 */
const LOGO = readFileSync(join(ARREL, "web/public/assets/logo.svg"), "utf8");
const LOGO_CLAR = LOGO.replace(/(fill|stroke)="#1E1B2E"/g, '$1="#FBF7EE"');
const dataSvg = (svg: string): string => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
export function logo(alcadaRem = 4): string {
  return `<img class="logo logo-fosc" alt="quivoto" style="height:${alcadaRem}rem" src="${dataSvg(LOGO)}">`
    + `<img class="logo logo-clar" alt="quivoto" style="height:${alcadaRem}rem" src="${dataSvg(LOGO_CLAR)}">`;
}

export { catalunya, papereta };

/**
 * El peu de cada imatge: la font i l'any a l'esquerra (cada xifra n'ha de
 * portar, és la regla del projecte), l'adreça a la dreta, discreta.
 */
export function peu(font: string, adreca = "quivoto.cat"): string {
  return `<footer class="peu"><span class="font">${escape(font)}</span><span class="adreca">${escape(adreca)}</span></footer>`;
}

/** Els fons possibles d'una proposta; el nom també va al fitxer. */
export type Fons = "paper" | "menta" | "lavanda" | "presec" | "tinta";
export const FONS: Record<Fons, { fons: string; tinta: string; suau: string }> = {
  paper: { fons: "#FBF7EE", tinta: "#1E1B2E", suau: "#5B5870" },
  menta: { fons: "#BFE8D2", tinta: "#1E1B2E", suau: "#3E4A44" },
  lavanda: { fons: "#C9C4F2", tinta: "#1E1B2E", suau: "#48446A" },
  presec: { fons: "#FFD8B8", tinta: "#1E1B2E", suau: "#5B4A40" },
  tinta: { fons: "#1E1B2E", tinta: "#FBF7EE", suau: "#C9C4F2" },
};

/** L'estil comú. `rem` = 1 % de l'amplada. */
export function cssBase(mida: Mida, fons: Fons): string {
  const f = FONS[fons];
  return `
html{font-size:${((mida.ample / 100) * (mida.nom === "4x5" ? 1.32 : 1)).toFixed(2)}px}
body{background:${f.fons};color:${f.tinta};--tinta:${f.tinta};--suau:${f.suau};--fons:${f.fons};
  display:flex;flex-direction:column;padding:4.2rem 5rem 3.4rem;position:relative}
/* Al vertical el contingut es reparteix entre l'etiqueta de dalt i el peu: així no queda un forat a baix. */
body.vertical{padding:4rem 4.6rem 3.2rem;justify-content:space-between}
.display{font-family:Gabarito,sans-serif;font-weight:900;letter-spacing:-.035em;line-height:.95}
.xifra{font-family:Gabarito,sans-serif;font-weight:900;letter-spacing:-.05em;line-height:.9;font-variant-numeric:tabular-nums}
.etiqueta{font-weight:800;text-transform:uppercase;letter-spacing:.14em;font-size:1.25rem;color:var(--tinta)}
/* Sobre paper el coral llueix; sobre menta o lavanda no té prou contrast i l'etiqueta va en tinta. */
body.paper .etiqueta{color:var(--coral)}
body.tinta .etiqueta{color:var(--presec)}
/* El bloc principal de cada proposta: ocupa el que queda entre l'etiqueta i el peu i s'hi centra,
   que és el que fa que el vertical no quedi amb un forat a baix. */
.principal{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;justify-content:center;padding-bottom:1.5rem}
.peu{margin-top:auto;display:flex;justify-content:space-between;align-items:flex-end;gap:2rem;
  font-size:1.15rem;font-weight:700;color:var(--suau);line-height:1.3}
.peu .adreca{font-family:Gabarito,sans-serif;font-weight:900;letter-spacing:-.03em;font-size:1.5rem;color:var(--tinta);opacity:.85;white-space:nowrap}
.peu .font{max-width:78%}
.marca{position:absolute;top:3.2rem;right:5rem;display:flex;align-items:center;gap:1rem}
body.vertical .marca{right:4.6rem;top:3.4rem}
.marca .logo{display:block}
.logo-clar{display:none!important}
body.tinta .logo-fosc{display:none!important}
body.tinta .logo-clar{display:block!important}
b.ressalt{font-weight:900;box-shadow:inset 0 -.28em 0 rgba(255,255,255,.75)}
body.tinta b.ressalt{box-shadow:inset 0 -.28em 0 rgba(226,115,90,.85)}
.papereta,.catalunya{display:block}
`;
}

/** Munta una composició sencera a partir del cos i el CSS propi. */
export function composa(mida: Mida, fons: Fons, cos: string, cssPropi: string): Composicio {
  const classes = [mida.nom === "4x5" ? "vertical" : "apaisat", fons].join(" ");
  return { ample: mida.ample, alt: mida.alt, classes, css: cssBase(mida, fons) + cssPropi, html: cos };
}
