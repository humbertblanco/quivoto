/**
 * «Dada friki»: una xifra enorme i una frase. Les xifres surten de les
 * curiositats de la pàgina de rànquings i de `catalunya.json`; cada una porta
 * la font i l'any tal com els publica la pàgina.
 *
 * Dues composicions per fet: la xifra a tota amplada sobre fons de color (v1)
 * i la targeta amb ombra dura sobre paper (v2), que és la de les fitxes.
 */

import { escape, logo, n, papereta, peu, type Mida } from "./estil";
import { curiositat, enllacDe, OBS, ROTACIO, type Dades, type Proposta } from "./propostes";

type Fet = {
  nom: string; xifra: string; unitat?: string; frase: string; font: string; enllac: string; tuit: string;
};

/** Separa «44.737 per 1.000 hab.» en xifra i unitat. */
function partsDe(dada: string): { xifra: string; unitat: string } {
  const m = dada.match(/^([+−-]?[\d.,]+)\s*(.*)$/);
  return m ? { xifra: m[1]!, unitat: m[2]! } : { xifra: dada, unitat: "" };
}

function fets(d: Dades): Fet[] {
  const out: Fet[] = [];
  const primer = (id: string, llista = 0) => {
    const c = curiositat(d, id);
    const it = c.llistes[llista]?.items[0];
    if (!it) throw new Error(`la curiositat ${id} no té ítems`);
    return { c, it };
  };

  { const { c, it } = primer("cur-mes-vehicles-que-persones");
    const p = partsDe(it.dada);
    out.push({ nom: `${it.href?.split("/")[2] ?? "vehicles"}-vehicles`, xifra: p.xifra, unitat: p.unitat,
      frase: `vehicles domiciliats a <b class="ressalt">${escape(it.nom)}</b> (${escape(it.sub)}). Són flotes d'empresa, no cotxes dels veïns.`,
      font: c.font, enllac: enllacDe(it.href),
      tuit: `${it.nom} té ${it.dada}: ${it.sub}. El parc compta els vehicles domiciliats, no els que hi circulen. Font: ${c.font}.` }); }

  { const { c, it } = primer("cur-edat-alcaldies");
    const anys = it.dada.match(/uns (\d+) anys/)?.[1] ?? "";
    out.push({ nom: "alcaldia-mes-jove", xifra: anys, unitat: "anys",
      frase: `té l'alcaldia més jove amb fitxa a Wikidata: <b class="ressalt">${escape(it.nom)}</b>, a ${escape(it.sub)}.`,
      font: `${c.font} · ${c.cobertura}`, enllac: enllacDe(it.href),
      tuit: `L'alcaldia més jove de Catalunya amb any de naixement a Wikidata té uns ${anys} anys: ${it.nom}, a ${it.sub}. ${c.cobertura} Font: Wikidata (CC0).` }); }

  { const { c, it } = primer("cur-mana-mes");
    out.push({ nom: "fogars-mandats", xifra: it.dada.match(/\d+/)?.[0] ?? "", unitat: "mandats seguits",
      frase: `porta <b class="ressalt">${escape(it.nom)}</b> a l'alcaldia de ${escape(it.sub)}. És l'únic que hi és des de les primeres municipals.`,
      font: c.font, enllac: enllacDe(it.href),
      tuit: `${it.nom} és alcalde de ${it.sub.split(" · ")[0]} des del 1979: ${it.dada}, l'únic de Catalunya. Font: ${c.font}.` }); }

  { const canvis = d.files.filter((f) => f.alcaldia_canvi_mandat === true).length;
    out.push({ nom: "canvi-alcaldia", xifra: n(canvis), unitat: "municipis",
      frase: `han canviat d'alcaldia a mig mandat, dels <b class="ressalt">947</b>. La font no en diu el motiu.`,
      font: "mandat 2023-2027 · Generalitat de Catalunya · historial d'alcaldies", enllac: `${OBS}/mapa/`,
      tuit: `${n(canvis)} dels 947 municipis catalans han canviat d'alcaldia a mig mandat 2023-2027. La font no en diu el motiu; la fitxa de cada poble, sí qui. Font: Generalitat, historial d'alcaldies.` }); }

  { const c = curiositat(d, "cur-voten-persones");
    const quants = c.cobertura.match(/de (\d+) municipis/)?.[1] ?? "";
    out.push({ nom: "voten-persones", xifra: quants, unitat: "municipis",
      frase: `voten <b class="ressalt">persones i no llistes</b>: llista oberta o consell obert als pobles de menys de 250 habitants.`,
      font: c.font, enllac: `${OBS}/ranquings/#${c.id}`,
      tuit: `A ${quants} municipis catalans no es vota una llista: s'escriuen noms. Són els de menys de 250 habitants, amb llista oberta o consell obert. Font: ${c.font}.` }); }

  { const { c, it } = primer("cur-cens-creixement");
    out.push({ nom: "olivella-cens", xifra: it.dada.replace(/\s*%$/, ""), unitat: "%",
      frase: `ha crescut el cens electoral d'<b class="ressalt">${escape(it.nom)}</b> des del 1979: ${escape(it.sub.split(" · ").slice(1).join(", "))}.`,
      font: c.font, enllac: enllacDe(it.href),
      tuit: `El cens d'${it.nom} ha passat ${it.sub.split(" · ")[1]} entre les municipals del 1979 i les del 2023: ${it.dada}. És demografia, no gestió. Font: ${c.font}.` }); }

  { const { c, it } = primer("cur-regidories-habitant");
    out.push({ nom: "frontanya-regidoria", xifra: "1 de 8", unitat: "",
      frase: `A <b class="ressalt">${escape(it.nom)}</b> hi ha una regidoria per cada 8 habitants: ${escape(it.sub)}. Ho fixa la llei, no el poble.`,
      font: c.font, enllac: enllacDe(it.href),
      tuit: `${it.nom} té ${it.sub}: ${it.dada}. Quantes regidories té un ple ho fixa la llei per trams de població. Font: ${c.font}.` }); }

  { const zero = d.files.filter((f) => f.deute_habitant === 0).length;
    out.push({ nom: "deute-zero", xifra: n(zero), unitat: "ajuntaments",
      frase: `no deuen <b class="ressalt">ni un euro</b>: deute viu zero a 31 de desembre, dels 947.`,
      font: "deute viu a 31/12 · Ministeri d'Hisenda / Consorci AOC · darrer any amb dada", enllac: `${OBS}/ranquings/`,
      tuit: `${n(zero)} dels 947 ajuntaments catalans tenen deute viu zero. Deute, no dèficit: la fitxa de cada poble ensenya la sèrie sencera. Font: Ministeri d'Hisenda / Consorci AOC.` }); }

  { const { c, it } = primer("cur-regidoria-vots", 1);
    out.push({ nom: "cabanelles-vots", xifra: it.dada.match(/^\d+/)?.[0] ?? "", unitat: "vots per regidoria",
      frase: `a <b class="ressalt">${escape(it.nom)}</b> (${escape(it.sub)}). La regidoria més barata de Catalunya, en vots.`,
      font: c.font, enllac: enllacDe(it.href),
      tuit: `La regidoria més barata de Catalunya, en vots: ${it.nom}, ${it.sub}, ${it.dada}. La més cara, a Barcelona, en va costar 18.995. Font: ${c.font}.` }); }

  return out;
}

/** v1: la xifra a tota amplada, la mascota mirant-se-la. */
function cosGran(f: Fet, mida: Mida): string {
  const vertical = mida.nom === "4x5";
  return `<div class="marca">${logo(3)}</div>
<p class="etiqueta">Dada curiosa</p>
<div class="principal bloc">
  <div class="xifra gran">${escape(f.xifra)}${f.unitat ? `<span class="unitat">${escape(f.unitat)}</span>` : ""}</div>
  <p class="display frase">${f.frase}</p>
</div>
<div class="mascota">${papereta(vertical ? 200 : 210)}</div>
${peu(f.font)}`;
}

/** v2: la targeta amb ombra dura, com les fitxes de l'Observatori. */
function cosTargeta(f: Fet, _mida: Mida): string {
  return `<div class="marca">${logo(3)}</div>
<p class="etiqueta">Dada curiosa</p>
<div class="principal"><div class="targeta">
  <div class="xifra">${escape(f.xifra)}${f.unitat ? `<span class="unitat">${escape(f.unitat)}</span>` : ""}</div>
  <p class="frase">${f.frase}</p>
  <div class="mascota">${papereta(120)}</div>
</div></div>
${peu(f.font)}`;
}

const CSS_GRAN = `
.bloc{max-width:74%}
body.vertical .bloc{max-width:100%}
.xifra.gran{font-size:16rem}
body.vertical .xifra.gran{font-size:15rem}
.unitat{display:block;font-size:3.6rem;letter-spacing:-.02em;margin-top:.6rem}
.frase{font-size:3.4rem;margin-top:2rem;max-width:62rem}
body.vertical .frase{font-size:3.6rem}
.mascota{position:absolute;right:5rem;bottom:8rem}
body.vertical .mascota{right:4.6rem;bottom:7.5rem}
.mascota svg{width:13rem;height:auto}
`;
const CSS_TARGETA = `
.targeta{position:relative;margin-top:1.4rem;background:#fff;border:.3rem solid var(--ink);border-radius:2rem;
  box-shadow:1rem 1rem 0 var(--ink);padding:3rem 3.4rem 3.2rem;max-width:80%}
body.vertical .targeta{max-width:100%;margin-top:2.4rem}
.targeta .xifra{font-size:11rem;color:var(--ink)}
.unitat{display:inline-block;font-size:2.8rem;letter-spacing:-.02em;margin-left:1rem}
.targeta .frase{font-size:2.5rem;font-weight:600;line-height:1.25;margin-top:1.6rem;color:var(--ink);max-width:56rem}
.targeta .mascota{position:absolute;right:-2rem;top:-6rem}
/* Al vertical la targeta va d'amplada sencera i la mascota a dalt toparia amb el logotip: baixa a la cantonada de sota. */
body.vertical .targeta .mascota{top:auto;bottom:-6rem;right:1rem}
.targeta .mascota svg{width:8.5rem;height:auto}
`;

export function propostesFriki(d: Dades): Proposta[] {
  return fets(d).flatMap((f, i) => [
    { familia: "friki", nom: f.nom, variant: 1, fons: ROTACIO[i % ROTACIO.length]!, mides: ["16x9", "4x5"],
      tuit: f.tuit, enllac: f.enllac, css: CSS_GRAN, cos: (m) => cosGran(f, m) },
    { familia: "friki", nom: f.nom, variant: 2, fons: "paper", mides: ["16x9", "4x5"],
      tuit: f.tuit, enllac: f.enllac, css: CSS_TARGETA, cos: (m) => cosTargeta(f, m) },
  ]);
}
