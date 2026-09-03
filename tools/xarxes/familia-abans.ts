/**
 * «Abans i ara»: dues xifres enfrontades. La participació del 2019 i del
 * 2023 surt de la secció «Qui hi va anar a votar» de cada fitxa; el cens del
 * 1979 i del 2023, de la curiositat del creixement del cens de la pàgina de
 * rànquings («de 61 a 2.734 electors»).
 *
 * v1: les dues xifres de costat amb la fletxa i la diferència; v2: dues
 * targetes apilades («abans» / «ara») sobre lavanda.
 */

import { escape, logo, n, peu, type Mida } from "./estil";
import { curiositat, enllacDe, OBS, type Dades, type Proposta } from "./propostes";

type Parell = {
  nom: string; municipi: string; que: string; abans: { any: number; text: string }; ara: { any: number; text: string };
  diferencia: string; font: string; enllac: string; tuit: string;
};

function parells(d: Dades): Parell[] {
  const out: Parell[] = [];
  const FONT_PART = "Generalitat de Catalunya · processos electorals, participació · municipals del 2019 i del 2023";

  for (const slug of ["barcelona", "girona", "rajadell"]) {
    const p = d.participacio[slug] ?? [];
    const ara = p.find((x) => x.any === 2023);
    const abans = p.find((x) => x.any === 2019);
    if (!ara || !abans) continue;
    const nom = d.files.find((f) => f.slug === slug)?.municipi ?? slug;
    const dif = ara.pct - abans.pct;
    out.push({
      nom: `${slug}-participacio`, municipi: nom, que: "Participació a les municipals",
      abans: { any: 2019, text: `${n(abans.pct, 1)} %` }, ara: { any: 2023, text: `${n(ara.pct, 1)} %` },
      diferencia: `${dif > 0 ? "+" : "−"}${n(Math.abs(dif), 1)} punts`,
      font: `${FONT_PART} · ${n(ara.votants)} votants de ${n(ara.cens)} el 2023`,
      enllac: `${OBS}/m/${slug}/#participacio`,
      tuit: `${nom}: a les municipals del 2019 hi va votar el ${n(abans.pct, 1)} % del cens; el 2023, el ${n(ara.pct, 1)} % (${n(ara.votants)} de ${n(ara.cens)}). Font: Generalitat de Catalunya, processos electorals.`,
    });
  }

  const c = curiositat(d, "cur-cens-creixement");
  for (const [llista, idx] of [[0, 0], [1, 7]] as const) {
    const it = c.llistes[llista]?.items[idx];
    const m = it?.sub.match(/de ([\d.]+) a ([\d.]+) electors/);
    if (!it || !m) continue;
    out.push({
      nom: `${it.href?.split("/")[2] ?? it.nom}-cens`, municipi: it.nom, que: "Cens electoral a les municipals",
      abans: { any: 1979, text: m[1]! }, ara: { any: 2023, text: m[2]! },
      diferencia: it.dada, font: c.font, enllac: enllacDe(it.href),
      tuit: `El cens electoral de ${it.nom} (${it.sub.split(" · ")[0]}) ha passat de ${m[1]} electors el 1979 a ${m[2]} el 2023: ${it.dada}. És demografia, no gestió. Font: ${c.font}.`,
    });
  }
  return out;
}

function cosEnfrontat(p: Parell, _m: Mida): string {
  return `<div class="marca">${logo(3)}</div>
<p class="etiqueta">Abans i ara · ${escape(p.municipi)}</p>
<div class="principal">
<h1 class="display titol">${escape(p.que)}</h1>
<div class="parell">
  <div class="costat"><span class="any">${p.abans.any}</span><b class="xifra">${escape(p.abans.text)}</b></div>
  <div class="fletxa"><svg viewBox="0 0 100 60" width="100" height="60"><path d="M6 30 H84 M62 10 l24 20 -24 20" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="dif">${escape(p.diferencia)}</span></div>
  <div class="costat ara"><span class="any">${p.ara.any}</span><b class="xifra">${escape(p.ara.text)}</b></div>
</div>
</div>
${peu(p.font)}`;
}

function cosTargetes(p: Parell, _m: Mida): string {
  return `<div class="marca">${logo(3)}</div>
<p class="etiqueta">Abans i ara</p>
<div class="principal">
<h1 class="display titol">${escape(p.municipi)}<br><small>${escape(p.que)}</small></h1>
<div class="targetes">
  <div class="targeta"><span class="cap">Abans · ${p.abans.any}</span><b class="xifra">${escape(p.abans.text)}</b></div>
  <div class="targeta ara"><span class="cap">Ara · ${p.ara.any}</span><b class="xifra">${escape(p.ara.text)}</b><span class="dif">${escape(p.diferencia)}</span></div>
</div>
</div>
${peu(p.font)}`;
}

const CSS = `
.titol{font-size:3.8rem;margin-top:.8rem}
.titol small{display:block;font-size:2.2rem;font-weight:700;letter-spacing:0;margin-top:.6rem;color:var(--suau)}
.parell{display:flex;align-items:center;gap:3rem;margin-top:3rem}
body.vertical .parell{flex-direction:column;align-items:flex-start;gap:2rem}
.costat{display:flex;flex-direction:column;gap:.6rem}
.any{font-weight:800;font-size:1.6rem;letter-spacing:.12em;text-transform:uppercase;color:var(--suau)}
.parell .xifra{font-size:11rem}
body.vertical .parell .xifra{font-size:12rem}
.costat.ara .xifra{color:var(--coral)}
body.tinta .costat.ara .xifra,body.presec .costat.ara .xifra{color:inherit}
.fletxa{display:flex;flex-direction:column;align-items:center;gap:.6rem;color:var(--tinta)}
.fletxa svg{width:7rem;height:auto}
body.vertical .fletxa{align-items:flex-start;flex-direction:row;gap:1.4rem}
body.vertical .fletxa svg{transform:rotate(90deg);width:4rem}
.dif{font-family:Gabarito,sans-serif;font-weight:900;font-size:2rem;white-space:nowrap}
.targetes{display:grid;grid-template-columns:1fr 1fr;gap:2.4rem;margin-top:2.6rem}
body.vertical .targetes{grid-template-columns:1fr;gap:2rem;margin-top:3rem}
.targeta{background:#fff;border:.3rem solid var(--ink);border-radius:2rem;box-shadow:1rem 1rem 0 var(--ink);padding:2.4rem 2.8rem;
  display:flex;flex-direction:column;gap:.8rem;color:var(--ink)}
.targeta.ara{background:var(--presec)}
.targeta .cap{font-weight:800;font-size:1.3rem;letter-spacing:.12em;text-transform:uppercase}
.targeta .xifra{font-size:8.5rem}
body.vertical .targeta .xifra{font-size:9.5rem}
.targeta .dif{color:#8E3A26}
`;

export function propostesAbans(d: Dades): Proposta[] {
  return parells(d).flatMap((p, i) => [
    { familia: "abans", nom: p.nom, variant: 1, fons: (["paper", "menta", "tinta"] as const)[i % 3]!, mides: ["16x9", "4x5"],
      tuit: p.tuit, enllac: p.enllac, css: CSS, cos: (m) => cosEnfrontat(p, m) },
    { familia: "abans", nom: p.nom, variant: 2, fons: "lavanda", mides: ["16x9", "4x5"],
      tuit: p.tuit, enllac: p.enllac, css: CSS, cos: (m) => cosTargetes(p, m) },
  ]);
}
