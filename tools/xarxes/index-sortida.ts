/**
 * Els dos fitxers que acompanyen les imatges: `INDEX.md`, amb el text
 * suggerit per a cada tuit i l'enllaç de la pàgina d'on surt la dada, i
 * `CONTACTE.html`, la graella per fullejar-les d'un cop d'ull.
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { escape, type Mida } from "./estil";
import type { Proposta } from "./propostes";

export type Feta = { proposta: Proposta; mida: Mida; fitxer: string };

const NOMS_FAMILIA: Record<string, string> = {
  friki: "Dada curiosa", top: "Top 5 / Top 10", abans: "Abans i ara", mapa: "Mapa",
  captura: "Captura emmarcada", fil: "Sèrie per a un fil", marca: "Anunci del projecte",
};

function perFamilia(fetes: readonly Feta[]): Map<string, Feta[]> {
  const m = new Map<string, Feta[]>();
  for (const f of fetes) m.set(f.proposta.familia, [...(m.get(f.proposta.familia) ?? []), f]);
  return m;
}

export async function escriuIndex(dir: string, fetes: readonly Feta[], generat: string): Promise<void> {
  const linies: string[] = [
    "# Imatges per a xarxes", "",
    `Generades amb \`tools/xarxes/genera.ts\` a partir de l'Observatori publicat el ${generat}. `
    + "Cada imatge porta la font i l'any de la dada; el text de sota és una proposta de tuit, curta i en català.", "",
  ];
  for (const [familia, llista] of perFamilia(fetes)) {
    linies.push(`## ${NOMS_FAMILIA[familia] ?? familia} (\`${familia}/\`)`, "");
    // Una proposta té una o dues mides i potser dues variants: el text i
    // l'enllaç són els mateixos, i per això s'agrupen per nom.
    const perNom = new Map<string, Feta[]>();
    for (const f of llista) perNom.set(f.proposta.nom, [...(perNom.get(f.proposta.nom) ?? []), f]);
    for (const [nom, fs] of perNom) {
      const p = fs[0]!.proposta;
      linies.push(`### ${nom}`, "");
      linies.push(...fs.map((f) => `- \`${f.fitxer}\` (${f.mida.ample}×${f.mida.alt})`));
      linies.push("", `**Tuit:** ${p.tuit}`, "", `**Enllaç:** ${p.enllac}`, "");
    }
  }
  await writeFile(join(dir, "INDEX.md"), `${linies.join("\n")}\n`, "utf8");
}

export async function escriuContacte(dir: string, fetes: readonly Feta[], generat: string): Promise<void> {
  const seccions = [...perFamilia(fetes)].map(([familia, llista]) => `
<section>
  <h2>${escape(NOMS_FAMILIA[familia] ?? familia)} <small>${llista.length} imatges</small></h2>
  <div class="graella">
    ${llista.map((f) => `<figure class="${f.mida.nom}">
      <a href="${escape(f.fitxer)}"><img loading="lazy" src="${escape(f.fitxer)}" alt=""></a>
      <figcaption><code>${escape(f.fitxer)}</code><p>${escape(f.proposta.tuit)}</p><a href="${escape(f.proposta.enllac)}">${escape(f.proposta.enllac)}</a></figcaption>
    </figure>`).join("\n")}
  </div>
</section>`).join("\n");

  const html = `<!doctype html>
<html lang="ca"><head><meta charset="utf-8"><title>Contacte · imatges per a xarxes · quivoto</title>
<style>
body{margin:0;padding:2rem;background:#FBF7EE;color:#1E1B2E;font-family:"Nunito Sans",system-ui,sans-serif}
h1{font-size:1.8rem;margin:0 0 .3rem} h2{font-size:1.3rem;margin:2.4rem 0 1rem;border-bottom:3px solid #1E1B2E;padding-bottom:.3rem}
h2 small{font-weight:600;color:#5B5870;font-size:.85rem;margin-left:.6rem}
.graella{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:1.4rem;align-items:start}
figure{margin:0;background:#fff;border:2.5px solid #1E1B2E;border-radius:14px;box-shadow:6px 6px 0 #1E1B2E;overflow:hidden}
figure.\\34 x5{grid-row:span 1}
figure img{display:block;width:100%;height:auto}
figcaption{padding:.8rem 1rem 1rem;font-size:.82rem;line-height:1.4}
figcaption code{font-size:.72rem;color:#5B5870;word-break:break-all}
figcaption p{margin:.5rem 0}
figcaption a{color:#B54A33;word-break:break-all}
p.intro{color:#5B5870;margin:0 0 1rem}
</style></head><body>
<h1>Imatges per a xarxes</h1>
<p class="intro">${fetes.length} imatges · Observatori publicat el ${escape(generat)} · el text de cada peu és la proposta de tuit (vegeu <code>INDEX.md</code>).</p>
${seccions}
</body></html>`;
  await writeFile(join(dir, "CONTACTE.html"), html, "utf8");
}
