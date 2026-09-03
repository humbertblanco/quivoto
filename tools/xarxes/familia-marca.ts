/**
 * «Anunci del projecte»: la marca sola, sense cap dada d'un municipi. Tres
 * claims i tres composicions: la mascota gran amb el claim (v1), el claim a
 * tota amplada amb Catalunya de mascota (v2) i la versió fosca amb les xifres
 * globals del web (v3), que són les de `xifres.json` via `catalunya.json`.
 */

import { catalunya, escape, logo, n, papereta, peu, type Mida } from "./estil";
import { OBS, SITE, type Dades, type Proposta } from "./propostes";

type Claim = { nom: string; titol: string; sota: string; tuit: string; enllac: string };

function claims(d: Dades): Claim[] {
  const municipis = d.files.length;
  const regidories = d.files.reduce((a, f) => a + (Number(f.regidories) || 0), 0);
  return [
    { nom: "qui-mana", titol: "Qui mana al teu poble?<br>Ara ho pots mirar.",
      sota: `${n(municipis)} fitxes, una per municipi: qui governa, què s'ha fet i què paga cadascú.`,
      tuit: `Qui mana al teu poble? Ara ho pots mirar: ${n(municipis)} fitxes, una per municipi, amb qui governa, què ha passat aquest mandat i d'on surten les dades. Municipals del 23 de maig del 2027.`,
      enllac: `${OBS}/` },
    { nom: "zero-veredictes", titol: `${n(municipis)} municipis.<br>Zero veredictes.`,
      sota: "Cada xifra amb la font i l'any. Que jutgi qui llegeix.",
      tuit: `${n(municipis)} municipis, ${n(regidories)} regidories i zero veredictes: l'Observatori municipal de quivoto descriu, amb font i any a cada xifra, i deixa que jutgi qui llegeix.`,
      enllac: `${OBS}/els947.html` },
    { nom: "buit-no-zero", titol: "Un buit<br>no és un zero.",
      sota: "Quan una dada no hi és, ho diem. No la inventem ni la tapem amb una mitjana.",
      tuit: "Un buit no és un zero. A l'Observatori municipal, quan una dada no hi és, la fitxa ho diu; no s'inventa ni s'omple amb la mitjana dels veïns. Cada xifra, amb font i any.",
      enllac: `${SITE}/` },
  ];
}

function cosMascota(c: Claim, _m: Mida): string {
  return `<div class="marca">${logo(3)}</div>
<div class="principal escena">
  <div class="mascota">${papereta(300, "felic")}</div>
  <div class="text">
    <h1 class="display titol">${c.titol}</h1>
    <p class="sota">${escape(c.sota)}</p>
  </div>
</div>
${peu(`Observatori municipal · municipals del 23 de maig del 2027 · dades públiques amb font i any`)}`;
}

function cosCatalunya(c: Claim, _m: Mida): string {
  return `<div class="marca">${logo(3)}</div>
<div class="principal escena cat">
  <div class="text">
    <h1 class="display titol">${c.titol}</h1>
    <p class="sota">${escape(c.sota)}</p>
  </div>
  <div class="mascota">${catalunya(300, "felic", null)}</div>
</div>
${peu(`Observatori municipal · municipals del 23 de maig del 2027 · dades públiques amb font i any`)}`;
}

function cosFosc(c: Claim, d: Dades, _m: Mida): string {
  const municipis = d.files.length;
  const regidories = d.files.reduce((a, f) => a + (Number(f.regidories) || 0), 0);
  const comarques = new Set(d.files.map((f) => f.comarca)).size;
  return `<div class="marca">${logo(3)}</div>
<div class="principal escena fosc">
  <h1 class="display titol">${c.titol}</h1>
  <ul class="xifres">
    <li><b class="xifra">${n(municipis)}</b><span>municipis</span></li>
    <li><b class="xifra">${n(regidories)}</b><span>regidories</span></li>
    <li><b class="xifra">${n(comarques)}</b><span>comarques i l'Aran</span></li>
  </ul>
  <p class="sota">${escape(c.sota)}</p>
  <div class="mascota">${papereta(160, "felic")}</div>
</div>
${peu(`padró vigent · Generalitat de Catalunya · dades generals dels ens locals · Observatori publicat el ${d.generat}`)}`;
}

const CSS = `
.escena{flex-direction:row;align-items:center;gap:5rem}
body.vertical .escena{flex-direction:column;align-items:flex-start;gap:3rem}
.escena.cat{gap:4rem}
.mascota svg{width:22rem;height:auto}
body.vertical .mascota svg{width:20rem}
.titol{font-size:6.4rem}
body.vertical .titol{font-size:6.2rem}
.sota{font-size:2.2rem;font-weight:600;line-height:1.3;margin-top:1.8rem;max-width:56rem;color:var(--suau)}
.escena.fosc{flex-direction:column;align-items:flex-start;justify-content:center;gap:0;position:relative}
.escena.fosc .titol{font-size:7rem}
.xifres{list-style:none;display:flex;gap:4rem;margin-top:3rem}
body.vertical .xifres{flex-wrap:wrap;gap:2.4rem 3.6rem}
.xifres .xifra{display:block;font-size:6rem;color:var(--presec)}
.xifres span{font-size:1.6rem;font-weight:800;text-transform:uppercase;letter-spacing:.12em}
.escena.fosc .mascota{position:absolute;right:0;top:-1rem}
body.vertical .escena.fosc .mascota{position:static;margin-top:3rem;align-self:flex-end}
.escena.fosc .mascota svg{width:11rem}
`;

export function propostesMarca(d: Dades): Proposta[] {
  const base = { familia: "marca", mides: ["16x9", "4x5"] as Mida["nom"][], css: CSS };
  return claims(d).flatMap((c) => [
    { ...base, nom: c.nom, variant: 1, fons: "presec", tuit: c.tuit, enllac: c.enllac, cos: (m) => cosMascota(c, m) },
    { ...base, nom: c.nom, variant: 2, fons: "menta", tuit: c.tuit, enllac: c.enllac, cos: (m) => cosCatalunya(c, m) },
    { ...base, nom: c.nom, variant: 3, fons: "tinta", tuit: c.tuit, enllac: c.enllac, cos: (m) => cosFosc(c, d, m) },
  ]);
}
