import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { informe, validaConjunt, type Conjunt, type Veredicte } from "./llindar";
import { RADIOGRAFIA_CSS } from "./estil";
import { SITE } from "./config";

/**
 * Les preguntes de prova, tal com estan: en esborrany i sense validar.
 *
 * No és el test. El test es respon i et compara amb cada candidatura, i per
 * arribar-hi falta el que el llindar diu que falta. Això és el material de
 * treball posat a la vista perquè qui conegui el poble el pugui jutjar, que és
 * exactament el que ha passat amb la primera mostra: qui hi viu detecta en
 * quinze segons les afirmacions que podrien ser de qualsevol lloc.
 *
 * La pàgina ensenya el veredicte del llindar sencer, inclosos els incompliments.
 * Amagar-los seria estrany en un projecte que ven que ensenya l'evidència.
 */

const escape = (t: string): string =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type ConjuntAmbSlug = Conjunt & { slug: string; veredicte: Veredicte };

/** Llegeix tots els conjunts escrits, amb el seu veredicte ja calculat. */
export function carregaPreguntes(): ConjuntAmbSlug[] {
  const dir = join(dirname(fileURLToPath(import.meta.url)), "afirmacions");
  let fitxers: string[];
  try {
    fitxers = readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  return fitxers
    .map((fitxer) => {
      const conjunt = JSON.parse(readFileSync(join(dir, fitxer), "utf8")) as Conjunt;
      return { ...conjunt, slug: fitxer.replace(/\.json$/, ""), veredicte: validaConjunt(conjunt) };
    })
    .sort((a, b) => b.veredicte.resum.ambVotCitable - a.veredicte.resum.ambVotCitable);
}

function capcalera(titol: string, descripcio: string, canonical: string): string {
  return `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escape(titol)}</title>
<meta name="description" content="${escape(descripcio)}">
<link rel="canonical" href="${canonical}">
<style>${RADIOGRAFIA_CSS}${EXTRA_CSS}</style>
</head>
<body>
<a class="salta" href="#contingut">Ves al contingut</a>
<header class="capcalera">
  <a class="logo" href="/observatori/">Observatori</a>
  <span class="etiqueta">esborrany · sense validar</span>
</header>`;
}

const EXTRA_CSS = `
.pregunta{border-top:2.5px solid var(--ink);padding:var(--e3) 0}
.pregunta .num{font-family:var(--display);font-weight:900;font-size:.8rem;color:var(--coral);
  text-transform:uppercase;letter-spacing:.12em}
.pregunta h3{font-family:var(--display);font-weight:900;font-size:clamp(1.1rem,3.2vw,1.5rem);
  letter-spacing:-.02em;line-height:1.28;margin:6px 0 var(--e2);max-width:34ch}
.pregunta .tema{display:inline-block;background:var(--menta);color:#1E1B2E;border:1.5px solid var(--ink);
  border-radius:var(--r-max);padding:2px 10px;font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.07em}
.pregunta .govern{display:inline-block;border:1.5px dashed var(--ink);border-radius:var(--r-max);
  padding:2px 10px;font-size:.7rem;font-weight:800;margin-left:6px}
.pregunta dl{margin:var(--e2) 0 0;display:grid;gap:8px}
.pregunta dt{font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.09em;color:var(--ink-suau)}
.pregunta dd{margin:0;font-size:.92rem;line-height:1.5}
.veredicte-llindar{background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);
  box-shadow:var(--ombra);padding:var(--e2);margin:var(--e3) 0}
.veredicte-llindar h3{font-family:var(--display);font-weight:900;font-size:1.05rem;margin:0 0 var(--e1)}
.veredicte-llindar ul{margin:var(--e1) 0 0;padding-left:1.1em;font-size:.9rem}
.veredicte-llindar .bloqueja{color:var(--coral);font-weight:700}
.llista-municipis{list-style:none;margin:var(--e3) 0 0;padding:0;display:grid;gap:var(--e2)}
.llista-municipis a{display:flex;justify-content:space-between;align-items:baseline;gap:var(--e2);
  flex-wrap:wrap;background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);
  box-shadow:var(--ombra);padding:var(--e2);text-decoration:none;color:inherit}
.llista-municipis b{font-family:var(--display);font-weight:900;font-size:1.2rem;letter-spacing:-.02em}
`;

/** Una pàgina amb les 25 preguntes d'un municipi. */
export function renderPreguntes(conjunt: ConjuntAmbSlug, generatedAt: string): string {
  const v = conjunt.veredicte;
  const preguntes = conjunt.afirmacions
    .map(
      (a, i) => `<article class="pregunta">
    <span class="num">Pregunta ${i + 1} de ${conjunt.afirmacions.length}</span>
    <h3>${escape(a.text)}</h3>
    <span class="tema">${escape(a.tema)}</span>
    <span class="govern">el govern hi és ${escape(a.posicio_govern)}</span>
    <dl>
      ${a.context ? `<dt>Per què es pregunta això aquí</dt><dd>${escape(a.context)}</dd>` : ""}
      <dt>Evidència</dt>
      <dd>${escape(a.evidencia)}${
        a.url_evidencia
          ? ` <a href="${escape(a.url_evidencia)}" target="_blank" rel="noopener">obre el document</a>`
          : ""
      }</dd>
      ${a.discrimina ? `<dt>Per què hi pot haver desacord</dt><dd>${escape(a.discrimina)}</dd>` : ""}
    </dl>
  </article>`,
    )
    .join("");

  const bloquejos = v.incompliments.filter((i) => i.gravetat === "bloqueja");

  return `${capcalera(
    `Preguntes de prova · ${conjunt.municipi} — quivoto`,
    `Les 25 preguntes que la brúixola de quivoto faria a ${conjunt.municipi}, en esborrany i amb l'evidència de cadascuna.`,
    `${SITE}/observatori/preguntes/${conjunt.slug}/`,
  )}
<main id="contingut">
  <section class="portada">
    <p class="micro">Esborrany de la brúixola</p>
    <h1>${escape(conjunt.municipi)}</h1>
    <p class="entrada">Les ${conjunt.afirmacions.length} preguntes que faríem aquí, cadascuna amb
    l'evidència que la sosté. <b>Encara no es poden respondre</b>: primer han de passar el
    llindar de publicació.</p>
  </section>

  <div class="veredicte-llindar">
    <h3>${v.publicable ? "Passa el llindar" : "Encara no passa el llindar"}</h3>
    <p class="secundari">${v.resum.ambVotCitable} de ${v.total} lligades a una votació del ple ·
    ${v.resum.ambPrograma} amb cita de programa · el govern hi és d'acord en ${v.resum.acordAmbGovern}
    · com a molt ${v.resum.paraulesMaxim} paraules</p>
    ${
      bloquejos.length > 0
        ? `<ul>${bloquejos.map((i) => `<li><span class="bloqueja">${escape(i.regla)}</span>: ${escape(i.detall)}</li>`).join("")}</ul>`
        : ""
    }
  </div>

  ${preguntes}

  <section class="bloc anar">
    <h2>Segueix estirant</h2>
    <ul class="destins">
      <li><a href="../../m/${escape(conjunt.slug)}/"><b>La fitxa de ${escape(conjunt.municipi)}</b>
        <span>Qui mana, els comptes, el ple i com queda respecte dels municipis de la seva mida</span></a></li>
      <li><a href="../"><b>Les altres proves</b>
        <span>Els municipis on ja hem escrit les preguntes</span></a></li>
    </ul>
  </section>

  <section class="bloc fonts">
    <h2>Per què això és un esborrany</h2>
    <p class="nota">Aquestes preguntes les ha redactades una màquina llegint les actes del ple i
    les dades obertes del municipi, i les ha repassades una altra buscant-hi biaix, errors de
    mètode i evidències que no existeixen. Cap persona les ha validades encara, i el llindar de
    publicació diu què hi falta. Les ensenyem així perquè qui conegui el poble ens digui què hi
    sobra i què hi falta: escriu-nos a hola@quivoto.cat.</p>
  </section>
</main>
<footer class="peu"><p>quivoto · generat el ${escape(generatedAt)} · esborrany, no indexat</p></footer>
</body></html>`;
}

/** L'índex de les proves. */
export function renderIndexPreguntes(conjunts: readonly ConjuntAmbSlug[], generatedAt: string): string {
  const files = conjunts
    .map(
      (c) => `<li><a href="${escape(c.slug)}/">
      <b>${escape(c.municipi)}</b>
      <span class="secundari">${c.veredicte.resum.ambVotCitable} de ${c.veredicte.total} preguntes
      lligades a una votació del ple</span>
    </a></li>`,
    )
    .join("");

  return `${capcalera(
    "Preguntes de prova · Observatori de quivoto",
    "Les preguntes que la brúixola de quivoto faria a cada municipi, en esborrany i amb l'evidència de cadascuna.",
    `${SITE}/observatori/preguntes/`,
  )}
<main id="contingut">
  <section class="portada">
    <p class="micro">Esborrany</p>
    <h1>Preguntes de prova</h1>
    <p class="entrada">La brúixola farà 25 preguntes sobre cada municipi i compararà les teves
    respostes amb la posició de cada candidatura. Aquí hi ha les primeres, escrites llegint les
    actes del ple, <b>encara sense validar i sense poder-se respondre</b>.</p>
    <p class="entrada">Les ensenyem perquè qui conegui el poble ens digui què hi sobra: és
    exactament així com hem descobert els sis errors de redacció que ara són a la metodologia.</p>
  </section>
  <ul class="llista-municipis">${files}</ul>
  <section class="bloc fonts">
    <h2>Què vol dir «lligada a una votació»</h2>
    <p class="nota">Que l'afirmació surt d'un punt que el ple va votar de manera dividida, amb el
    recompte i l'acta al costat. És el que permet ensenyar què ha votat cada grup en comptes de
    deduir-ho. On l'ajuntament no publica les actes amb el sentit del vot, aquesta xifra és
    baixa i el conjunt no es pot publicar: no és desídia de qui les escriu, és que la matèria
    no hi és.</p>
  </section>
</main>
<footer class="peu"><p>quivoto · generat el ${escape(generatedAt)} · esborrany, no indexat</p></footer>
</body></html>`;
}
