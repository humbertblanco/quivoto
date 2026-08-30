import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { informe, validaConjunt, type Conjunt, type Veredicte } from "./llindar";
import { RADIOGRAFIA_CSS } from "./estil";
import { SITE } from "./config";
import { verifica } from "./verificacio";
import { verificaCites } from "./cites";
import { MASCOTA_CSS, papereta } from "./mascota";
import { icona } from "./icones";
import { capcalera, tipografia } from "./capcalera";
import { cercador } from "./cercador";
import { peu, type EnllacPeu } from "./peu";

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

export type ConjuntAmbSlug = Conjunt & {
  slug: string;
  veredicte: Veredicte;
  /**
   * Els índexs de les afirmacions amb alguna cita que no és al document que
   * diuen citar. Es queden a la pàgina d'esborrany, marcades, perquè qui les
   * vulgui criticar les vegi; però no entren al test, perquè respondre-les
   * seria fer decidir algú a partir d'una frase que ningú no ha dit.
   */
  citesFallides: readonly number[];
};

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
      /**
       * Un fitxer mal format **no pot tombar la publicació sencera**.
       *
       * Els conjunts d'afirmacions s'escriuen a mà i de vegades s'estan
       * escrivint mentre es publica. Un JSON a mitges feia petar `JSON.parse`
       * i amb ell les 947 fitxes, el mapa i tota la resta, per un fitxer que
       * només afectava un municipi. Es queda fora amb un avís i el web surt.
       */
      let conjunt: Conjunt;
      try {
        conjunt = JSON.parse(readFileSync(join(dir, fitxer), "utf8")) as Conjunt;
      } catch (error) {
        process.stderr.write(
          `  avís: ${fitxer} no es pot llegir i queda fora (${String(error).slice(0, 90)})\n`,
        );
        return null;
      }
      if (!Array.isArray(conjunt.afirmacions) || conjunt.afirmacions.length === 0) {
        process.stderr.write(`  avís: ${fitxer} no té cap afirmació i queda fora\n`);
        return null;
      }
      const amb: ConjuntAmbSlug = {
        ...conjunt,
        slug: fitxer.replace(/\.json$/, ""),
        veredicte: validaConjunt(conjunt),
        citesFallides: [
          ...new Set(
            verificaCites(conjunt)
              .filter((c) => c.estat === "no-hi-es")
              .map((c) => c.afirmacio),
          ),
        ],
      };
      return amb;
    })
    .filter((c): c is ConjuntAmbSlug => c !== null)
    .sort((a, b) => b.veredicte.resum.ambVotCitable - a.veredicte.resum.ambVotCitable);
}

/**
 * El capçal sencer de les dues pàgines: el `<head>` i l'obertura del `<body>`
 * amb la capçalera, el cercador i el peu compartits de la resta de
 * l'Observatori.
 *
 * Aquestes pàgines duien una capçalera pròpia —un logotip que deia
 * «Observatori» i una etiqueta— i un peu d'una línia, de manera que des de les
 * preguntes no es podia anar enlloc: ni al mapa, ni a un altre poble, ni a les
 * dades. Eren les úniques del web que no feien servir la capa compartida.
 *
 * `base` és el camí fins a `/observatori/` (taula al capçal de `capcalera.ts`):
 * `../` des de `preguntes/` i `../../` des de `preguntes/<slug>/`.
 */
function capsalPreguntes(titol: string, descripcio: string, canonical: string, base: string): string {
  return `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escape(titol)}</title>
<meta name="description" content="${escape(descripcio)}">
<link rel="canonical" href="${canonical}">
${tipografia(base)}
<style>${RADIOGRAFIA_CSS}${MASCOTA_CSS}${EXTRA_CSS}</style>
</head>
<body>
<a class="salta" href="#contingut">Ves al contingut</a>
${capcalera(base, "cap", "esborrany")}
${cercador(base)}`;
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
      (a, i) => `<article class="pregunta${conjunt.citesFallides.includes(i) ? " cita-fallida" : ""}">
    <span class="num">Pregunta ${i + 1} de ${conjunt.afirmacions.length}</span>
    ${
      conjunt.citesFallides.includes(i)
        ? `<p class="avis-cita"><b>Alguna cita d'aquesta afirmació no s'ha trobat al document
           que diu citar.</b> Queda fora del test fins que es corregeixi o es retiri. La deixem a
           la vista perquè el que s'ha de poder criticar és el que hem escrit, no una versió
           neta.</p>`
        : ""
    }
    <h3>${escape(a.text)}</h3>
    <span class="tema">${icona(a.tema)}<span>${escape(a.tema)}</span></span>
    ${a.districte ? `<span class="districte">${escape(a.districte)}</span>` : ""}
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
  const estat = verifica(conjunt);
  // Els enllaços que només té aquesta pàgina: la fitxa del poble i, si la
  // demostració existeix, la demostració. La resta —les altres proves, el
  // mapa, els 947— ja és al peu de totes les pàgines.
  const fitxa: EnllacPeu = { text: `La fitxa de ${conjunt.municipi}`, on: `../../m/${conjunt.slug}/` };
  const extres: EnllacPeu[] = estat.jugable
    ? [{ text: "Respon les preguntes", on: "prova/" }, fitxa]
    : [fitxa];

  return `${capsalPreguntes(
    `Preguntes de prova · ${conjunt.municipi} — quivoto`,
    `Les 25 preguntes que la brúixola de quivoto faria a ${conjunt.municipi}, en esborrany i amb l'evidència de cadascuna.`,
    `${SITE}/observatori/preguntes/${conjunt.slug}/`,
    "../../",
  )}
<main id="contingut">
  <section class="portada">
    <div class="presenta">${papereta(110, "pregunta")}<div>
      <p class="micro">${conjunt.veredicte.avaluable ? "Avaluació del mandat" : "Esborrany"}</p>
      <h1>${escape(conjunt.municipi)}</h1>
    </div></div>
    <p class="entrada">${
      conjunt.veredicte.avaluable
        ? `Les ${conjunt.afirmacions.length} preguntes d'aquest mandat, cadascuna amb la votació
           del ple que la sosté. <b>Es poden respondre</b>, i les anirem millorant els pròxims
           mesos a mesura que llegim més actes.`
        : `Les ${conjunt.afirmacions.length} preguntes que faríem aquí, cadascuna amb l'evidència
           que la sosté. Aquest conjunt <b>encara no es pot respondre</b>: mira'n el veredicte
           aquí sota per saber per què.`
    }</p>
    ${
      estat.jugable
        ? `<p><a class="boto-prova" href="prova/">Respon-les i mira amb qui coincideixes →</a></p>
    <p class="nota">És una demostració del que es pot fer avui, amb el que hi ha. Les
    afirmacions encara no estan validades.</p>`
        : `<p class="nota"><b>Aquest conjunt no es pot respondre.</b>
    ${escape(estat.motiu ?? "")}, i sense acta no podem dir què ha votat cada grup:
    el que ensenyaríem seria què n'ha dit la premsa, que és una altra cosa. Les afirmacions es
    queden aquí perquè es vegin i es puguin criticar.</p>`
    }
  </section>

  <div class="veredicte-llindar">
    <h3>${
      v.avaluable
        ? "Es pot respondre com a avaluació del mandat"
        : "Encara no es pot respondre"
    }</h3>
    <p class="secundari">La <b>brúixola electoral</b> —comparar el que una candidatura promet amb
    el que ha votat— arriba quan les candidatures responguin, a partir de finals d'abril del 2027.
    Això d'ara és l'altra meitat: <b>què s'ha votat aquests quatre anys</b>, que surt de les actes
    i no necessita cap programa.</p>
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
      ${
        // Només quan la demostració existeix: si no, l'enllaç seria un 404 i
        // la portada d'aquesta mateixa pàgina ja diu per què no hi és.
        estat.jugable
          ? `<li><a href="prova/"><b>Respon les preguntes</b>
        <span>La demostració: compara't amb els grups del ple a partir de com han votat</span></a></li>`
          : ""
      }
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
${peu("../../", generatedAt, extres)}
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
    </a>
    <a class="prova-enllac" href="${escape(c.slug)}/prova/">Respon-les →</a></li>`,
    )
    .join("");

  return `${capsalPreguntes(
    "Preguntes de prova · Observatori de quivoto",
    "Les preguntes que la brúixola de quivoto faria a cada municipi, en esborrany i amb l'evidència de cadascuna.",
    `${SITE}/observatori/preguntes/`,
    "../",
  )}
<main id="contingut">
  <section class="portada">
    <div class="presenta">${papereta(120, "pregunta")}<div>
      <p class="micro">Esborrany</p>
      <h1>Preguntes de prova</h1>
    </div></div>
    <p class="entrada">Vint-i-cinc preguntes sobre el teu municipi, escrites llegint les actes
    del ple, i la posició de cada grup treta de <b>com ha votat</b>. Les anirem millorant i
    ampliant els pròxims mesos.</p>
    <p class="entrada">Cadascuna es pot <b>respondre ja</b>, a tall de demostració: com que les
    candidatures del 2027 encara no existeixen, la comparació es fa amb els grups que hi ha ara
    al ple i amb la posició que es dedueix de <b>com han votat</b>.</p>
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
${peu("../", generatedAt)}
</body></html>`;
}
