/**
 * «Mapa»: Catalunya tenyida per una capa. La geometria és la del web
 * (`packages/pipeline/src/publish/geo/municipis.json`, ICGC, CC BY 4.0) i el
 * valor de cada municipi surt de `catalunya.json`. Només capes categòriques
 * —canvi d'alcaldia, sistema electoral, majoria absoluta, deute zero— amb els
 * colors del sistema de disseny, cap dels quals és de veredicte: menta i
 * lavanda diuen «sí» i «no», no «bé» i «malament».
 *
 * Un mapa de municipis sobrerepresenta el buit (el Pallars ocupa molta taca i
 * hi viu poca gent), i per això la llegenda porta el recompte de municipis de
 * cada color: la taca es mira amb la xifra al costat.
 */

import { readFileSync } from "node:fs";
import { escape, logo, n, peu, type Fons, type Mida } from "./estil";
import type { Fila } from "./dades";
import { OBS, type Dades, type Proposta } from "./propostes";
import { ARREL } from "./render";

type Geometria = { viewBox: string; contorn: string | null; municipis: Record<string, string>; font: string; llicencia: string };
const GEO: Geometria = JSON.parse(readFileSync(`${ARREL}packages/pipeline/src/publish/geo/municipis.json`, "utf8"));

type Categoria = { clau: string; text: string; color: string };
type Capa = {
  nom: string; titol: string; sota: string; font: string; enllac: string;
  categories: Categoria[];
  de: (f: Fila) => string | null;
  tuit: (recompte: Record<string, number>) => string;
};

const CAPES: Capa[] = [
  { nom: "canvi-alcaldia", titol: "On ha canviat l'alcaldia a mig mandat", sota: "Mandat 2023-2027. La font no en diu el motiu.",
    font: "mandat 2023-2027 · Generalitat de Catalunya · historial d'alcaldies", enllac: `${OBS}/mapa/`,
    categories: [{ clau: "si", text: "ha canviat", color: "#E2735A" }, { clau: "no", text: "la mateixa persona", color: "#BFE8D2" }],
    de: (f) => (f.alcaldia_canvi_mandat === true ? "si" : f.alcaldia_canvi_mandat === false ? "no" : null),
    tuit: (r) => `Mapa: a ${n(r["si"] ?? 0)} dels 947 municipis l'alcaldia ha canviat de mans a mig mandat 2023-2027. La font no en diu el motiu; la fitxa de cada poble diu qui. Font: Generalitat de Catalunya, historial d'alcaldies.` },
  { nom: "sistema-electoral", titol: "On es voten llistes i on es voten persones", sota: "Llistes obertes fins a 250 habitants; consell obert als més petits.",
    font: "mandat 2023-2027 · Generalitat de Catalunya · dades generals dels ens locals i LOREG art. 179 i 184", enllac: `${OBS}/mapa/`,
    categories: [{ clau: "llistes tancades", text: "llistes tancades", color: "#EDE7DA" }, { clau: "llistes obertes", text: "llistes obertes", color: "#C9C4F2" }, { clau: "consell obert", text: "consell obert", color: "#E2735A" }],
    de: (f) => (typeof f.sistema_electoral === "string" ? f.sistema_electoral : null),
    tuit: (r) => `Mapa: ${n(r["llistes obertes"] ?? 0)} municipis catalans voten en llista oberta i ${n(r["consell obert"] ?? 0)} en consell obert; els altres ${n(r["llistes tancades"] ?? 0)}, amb llistes tancades. Font: Generalitat de Catalunya, ens locals; LOREG.` },
  { nom: "majoria-absoluta", titol: "On una sola llista té majoria absoluta", sota: "Escons de la llista més votada a les municipals del 2023.",
    font: "2023 · Generalitat de Catalunya · processos electorals", enllac: `${OBS}/mapa/`,
    categories: [{ clau: "si", text: "majoria absoluta", color: "#C9C4F2" }, { clau: "no", text: "sense majoria", color: "#FFD8B8" }],
    de: (f) => (f.majoria_absoluta === true ? "si" : f.majoria_absoluta === false ? "no" : null),
    tuit: (r) => `Mapa: a ${n(r["si"] ?? 0)} dels 947 municipis la llista més votada del 2023 té majoria absoluta; a ${n(r["no"] ?? 0)}, no. Font: Generalitat de Catalunya, processos electorals.` },
  { nom: "deute-zero", titol: "Els ajuntaments sense deute", sota: "Deute viu a 31 de desembre, darrer any amb dada.",
    font: "deute viu a 31/12 · Ministeri d'Hisenda / Consorci AOC", enllac: `${OBS}/mapa/`,
    categories: [{ clau: "zero", text: "deute zero", color: "#BFE8D2" }, { clau: "algun", text: "amb deute", color: "#FFD8B8" }],
    de: (f) => (f.deute_habitant === 0 ? "zero" : typeof f.deute_habitant === "number" ? "algun" : null),
    tuit: (r) => `Mapa: ${n(r["zero"] ?? 0)} dels 947 ajuntaments catalans tenen deute viu zero; ${n(r["algun"] ?? 0)} en tenen algun. Deute, no dèficit. Font: Ministeri d'Hisenda / Consorci AOC.` },
];

function recompte(d: Dades, c: Capa): Record<string, number> {
  const r: Record<string, number> = {};
  for (const f of d.files) { const k = c.de(f); if (k) r[k] = (r[k] ?? 0) + 1; }
  return r;
}

/** Mida del mapa en píxels: el que queda entre el text i el peu a cada format. */
const MIDA_MAPA: Record<Mida["nom"], number> = { "16x9": 640, "4x5": 760 };

function svg(d: Dades, c: Capa, fosc: boolean, px: number): string {
  const color = new Map(c.categories.map((k) => [k.clau, k.color]));
  const camins = d.files.map((f) => {
    const cami = GEO.municipis[f.slug];
    if (!cami) return "";
    const k = c.de(f);
    return `<path d="${cami}" fill="${k ? color.get(k) ?? "#EDE7DA" : "#EDE7DA"}"/>`;
  }).join("");
  const vora = fosc ? "#1E1B2E" : "#FBF7EE";
  return `<svg class="mapa" viewBox="${GEO.viewBox}" width="${px}" height="${px}" style="width:${px}px;height:${px}px" xmlns="http://www.w3.org/2000/svg">
  <g stroke="${vora}" stroke-width="1.2" stroke-linejoin="round">${camins}</g>
  ${GEO.contorn ? `<path d="${GEO.contorn}" fill="none" stroke="${fosc ? "#FBF7EE" : "#1E1B2E"}" stroke-width="3" stroke-linejoin="round"/>` : ""}
</svg>`;
}

function cos(d: Dades, c: Capa, fosc: boolean, m: Mida): string {
  const r = recompte(d, c);
  const llegenda = c.categories.map((k) => `<li><i style="background:${k.color}"></i><b>${n(r[k.clau] ?? 0)}</b> ${escape(k.text)}</li>`).join("");
  return `<div class="marca">${logo(3)}</div>
<p class="etiqueta">Mapa dels 947</p>
<div class="principal escena">
  <div class="text">
    <h1 class="display titol">${escape(c.titol)}</h1>
    <p class="sota">${escape(c.sota)}</p>
    <ul class="llegenda">${llegenda}</ul>
    <p class="avis">Un mapa de municipis sobrerepresenta el buit: mireu la xifra, no la taca.</p>
  </div>
  <div class="figura">${svg(d, c, fosc, MIDA_MAPA[m.nom])}</div>
</div>
${peu(`${c.font} · límits: ICGC (${GEO.llicencia})`)}`;
}

const CSS = `
.escena{flex-direction:row;align-items:center;gap:3rem}
body.vertical .escena{flex-direction:column;align-items:stretch;gap:1rem;justify-content:flex-start}
.text{flex:0 0 42%}
.figura{flex:1 1 auto;display:flex;justify-content:center;align-items:center;min-width:0}
body.vertical .figura{justify-content:center}
.titol{font-size:4.2rem}
body.vertical .titol{font-size:4.4rem}
.sota{font-size:1.8rem;font-weight:600;color:var(--suau);margin-top:1.2rem;line-height:1.3}
.llegenda{list-style:none;display:grid;gap:.7rem;margin-top:2rem}
body.vertical .llegenda{grid-template-columns:repeat(2,minmax(0,1fr));gap:.6rem 2rem}
.llegenda li{display:flex;align-items:center;gap:1rem;font-size:1.7rem;font-weight:700}
.llegenda i{display:inline-block;width:2.2rem;height:2.2rem;border-radius:.6rem;border:.2rem solid var(--tinta);flex:none}
.llegenda b{font-family:Gabarito,sans-serif;font-weight:900;font-size:2.4rem;min-width:5rem}
.avis{font-size:1.15rem;color:var(--suau);margin-top:1.6rem;max-width:40rem;line-height:1.35}
body.vertical .avis{display:none}
`;

export function propostesMapa(d: Dades): Proposta[] {
  return CAPES.flatMap((c) => {
    const tuit = c.tuit(recompte(d, c));
    return ([["paper", 1], ["tinta", 2]] as [Fons, number][]).map(([fons, variant]) => ({
      familia: "mapa", nom: c.nom, variant, fons, mides: ["16x9", "4x5"] as Mida["nom"][],
      tuit, enllac: c.enllac, css: CSS, cos: (m: Mida) => cos(d, c, fons === "tinta", m),
    }));
  });
}
