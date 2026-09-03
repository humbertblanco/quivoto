/**
 * «Sèrie / fil»: una portada i cinc targetes numerades amb el mateix estil,
 * per publicar com a fil: «5 coses que no sabies dels ajuntaments catalans».
 * Cada fet surt d'una curiositat de la pàgina de rànquings o de
 * `catalunya.json`, amb la font de la pàgina.
 */

import { escape, logo, n, papereta, peu, type Fons, type Mida } from "./estil";
import { curiositat, enllacDe, OBS, type Dades, type Proposta } from "./propostes";

type Targeta = { num: number; titol: string; text: string; font: string; enllac: string; tuit: string };

function targetes(d: Dades): Targeta[] {
  const out: Targeta[] = [];
  const total = 5;
  out.push({ num: 0, titol: `${total} coses que no sabies dels ajuntaments catalans`, text: "Un fil amb dades de l'Observatori municipal: 947 fitxes, cada xifra amb la font i l'any.",
    font: "Observatori municipal de quivoto · municipals del 23 de maig del 2027", enllac: `${OBS}/`,
    tuit: `${total} coses que no sabies dels ajuntaments catalans. Un fil amb dades públiques, cada una amb la font. Obrim:` });

  { const c = curiositat(d, "cur-voten-persones"); const q = c.cobertura.match(/de (\d+) municipis/)?.[1] ?? "";
    out.push({ num: 1, titol: `A ${q} municipis no es vota cap llista: s'escriuen noms.`, text: "Llista oberta o consell obert als pobles de menys de 250 habitants. Cada elector tria persones, no sigles.",
      font: c.font, enllac: `${OBS}/ranquings/#${c.id}`, tuit: `1/${total} A ${q} municipis catalans no es vota una llista: s'escriuen noms. Són els de menys de 250 habitants, amb llista oberta o consell obert. Font: ${c.font}.` }); }

  { const c = curiositat(d, "cur-mana-mes"); const it = c.llistes[0]!.items[0]!;
    out.push({ num: 2, titol: `A ${it.sub.split(" · ")[0]} mana la mateixa persona des del 1979.`, text: `${it.nom}: ${it.dada}, l'únic de Catalunya que hi és des de les primeres municipals democràtiques.`,
      font: c.font, enllac: enllacDe(it.href), tuit: `2/${total} ${it.nom} és alcalde de ${it.sub.split(" · ")[0]} des del 1979: ${it.dada}, l'únic de Catalunya. Font: ${c.font}.` }); }

  { const c = curiositat(d, "cur-regidories-habitant"); const it = c.llistes[0]!.items[0]!; const bcn = c.llistes[1]!.items[0]!;
    out.push({ num: 3, titol: `A ${it.nom}, una regidoria per cada 8 habitants. A ${bcn.nom}, una per cada ${bcn.dada.match(/cada ([\d.]+)/)?.[1] ?? ""}.`, text: `${it.sub} contra ${bcn.sub}. Quantes regidories té un ple ho fixa la llei per trams de població.`,
      font: c.font, enllac: enllacDe(it.href), tuit: `3/${total} ${it.nom} té ${it.sub}: ${it.dada}. ${bcn.nom}, ${bcn.sub}: ${bcn.dada}. Ho fixa la llei, no el poble. Font: ${c.font}.` }); }

  { const canvis = d.files.filter((f) => f.alcaldia_canvi_mandat === true).length;
    out.push({ num: 4, titol: `${n(canvis)} municipis han canviat d'alcaldia a mig mandat.`, text: "Dels 947, entre la constitució del ple del 2023 i avui. La font no en diu el motiu; la fitxa de cada poble diu qui.",
      font: "mandat 2023-2027 · Generalitat de Catalunya · historial d'alcaldies", enllac: `${OBS}/mapa/`, tuit: `4/${total} ${n(canvis)} dels 947 municipis han canviat d'alcaldia a mig mandat 2023-2027. Font: Generalitat de Catalunya, historial d'alcaldies.` }); }

  { const c = curiositat(d, "cur-regidoria-vots"); const cara = c.llistes[0]!.items[0]!; const barata = c.llistes[1]!.items[0]!;
    out.push({ num: 5, titol: `Una regidoria val ${barata.dada.match(/^\d+/)?.[0]} vots a ${barata.nom} i ${cara.dada.match(/^[\d.]+/)?.[0]} a ${cara.nom}.`, text: `${barata.sub}; ${cara.sub}. El preu en vots depèn de la mida del municipi, no de cap llista.`,
      font: c.font, enllac: enllacDe(barata.href), tuit: `5/${total} La regidoria més barata en vots: ${barata.nom}, ${barata.dada}. La més cara: ${cara.nom}, ${cara.dada}. Depèn de la mida del municipi, no de cap llista. Font: ${c.font}.` }); }
  return out;
}

function cos(t: Targeta, total: number, _m: Mida): string {
  const portada = t.num === 0;
  return `<div class="marca">${logo(3)}</div>
<p class="etiqueta">${portada ? "Un fil" : `Fil · ${t.num} de ${total}`}</p>
<div class="principal">
  ${portada ? `<div class="mascota">${papereta(180)}</div>` : `<div class="num display">${t.num}<span>/${total}</span></div>`}
  <h1 class="display titol${portada ? " portada" : ""}">${escape(t.titol)}</h1>
  <p class="text">${escape(t.text)}</p>
</div>
${peu(t.font)}`;
}

const CSS = `
.num{font-size:7rem;line-height:1;color:var(--coral);margin-bottom:1.6rem}
body.tinta .num{color:var(--presec)}
body.menta .num,body.lavanda .num,body.presec .num{color:var(--ink)}
.num span{font-size:2.6rem;letter-spacing:0;color:var(--suau);margin-left:.3rem}
.mascota{margin-bottom:2rem}
.mascota svg{width:11rem;height:auto}
.titol{font-size:4.6rem;max-width:88%}
.titol.portada{font-size:6rem;max-width:90%}
body.vertical .titol{font-size:5rem;max-width:100%}
body.vertical .titol.portada{font-size:6.2rem}
.text{font-size:2.1rem;font-weight:600;line-height:1.35;margin-top:1.8rem;max-width:70%;color:var(--suau)}
body.vertical .text{max-width:100%;font-size:2.3rem}
`;

export function propostesFil(d: Dades): Proposta[] {
  const ts = targetes(d);
  const total = ts.length - 1;
  const fons: Record<number, Fons> = { 1: "presec", 2: "tinta" };
  return ts.flatMap((t) => [1, 2].map((variant) => ({
    familia: "fil", nom: `5-coses-${t.num}`, variant, fons: fons[variant]!, mides: ["16x9", "4x5"] as Mida["nom"][],
    tuit: t.tuit, enllac: t.enllac, css: CSS, cos: (m: Mida) => cos(t, total, m),
  })));
}
