import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { informe, validaConjunt, type Conjunt, type Veredicte } from "./llindar";
import { RADIOGRAFIA_CSS } from "./estil";
import { SITE } from "./config";
import { ARREL_OBSERVATORI, capSeo, filAriadna, FITXER_OG, imatgeOg, type MetaPagina } from "./seo";
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
 *
 * El cap SEO el fa `capSeo()` amb el que cada pàgina li passa; el conjunt que
 * està «en revisió» hi va amb `noIndex`, perquè és un esborrany editorial i
 * no ha d'entrar al cercador ni el dia que l'Observatori s'obri.
 */
function capsalPreguntes(meta: MetaPagina, base: string): string {
  return `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${capSeo(meta)}
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
/* La pastilla del govern és un enllaç a l'evidència de la mateixa targeta, que
   és d'on surt la posició: sense subratllat, que la vora discontínua ja diu
   que és una cosa deduïda i no una dada. */
.pregunta .govern{display:inline-block;border:1.5px dashed var(--ink);border-radius:var(--r-max);
  padding:2px 10px;font-size:.7rem;font-weight:800;margin-left:6px;color:inherit;text-decoration:none}
.pregunta .govern:hover{background:var(--presec);color:#1E1B2E}
.pregunta dl{margin:var(--e2) 0 0;display:grid;gap:8px}
.pregunta dt{font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.09em;color:var(--ink-suau)}
.pregunta dd{margin:0;font-size:.92rem;line-height:1.5}
.veredicte-llindar{background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);
  box-shadow:var(--ombra);padding:var(--e2);margin:var(--e3) 0}
.veredicte-llindar h3{font-family:var(--display);font-weight:900;font-size:1.05rem;margin:0 0 var(--e1)}
.veredicte-llindar ul{margin:var(--e1) 0 0;padding-left:1.1em;font-size:.9rem}
.veredicte-llindar .bloqueja{color:var(--coral);font-weight:700}
.llista-municipis{list-style:none;margin:var(--e3) 0 0;padding:0;display:grid;gap:var(--e2)}
/* La targeta és només l'enllaç al conjunt («a.conjunt»): sota hi van, en
   fila, les pastilles d'anar a respondre i d'anar a la fitxa, que abans
   heretaven la targeta sencera perquè la regla era «.llista-municipis a». */
.llista-municipis a.conjunt{display:flex;justify-content:space-between;align-items:baseline;gap:var(--e2);
  flex-wrap:wrap;background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);
  box-shadow:var(--ombra);padding:var(--e2);text-decoration:none;color:inherit}
.llista-municipis b{font-family:var(--display);font-weight:900;font-size:1.2rem;letter-spacing:-.02em}
.llista-municipis .accions{display:flex;flex-wrap:wrap;gap:8px;margin:0}
.llista-municipis .bloquejada{display:inline-block;margin-top:6px;padding:4px 10px;border-radius:var(--r-max);
  background:var(--vora);color:var(--ink-suau);font-size:.76rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em}
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
    <a class="govern" href="#evidencia-${i + 1}" title="Segons l'evidència d'aquesta mateixa targeta">el govern hi és ${escape(a.posicio_govern)}</a>
    <dl>
      ${a.context ? `<dt>Per què es pregunta això aquí</dt><dd>${escape(a.context)}</dd>` : ""}
      <dt>Evidència</dt>
      <dd id="evidencia-${i + 1}">${escape(a.evidencia)}${
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
  const disponible = estat.jugable && v.avaluable;
  // Els enllaços que només té aquesta pàgina: la fitxa del poble i, si la
  // demostració existeix, la demostració. La resta —les altres proves, el
  // mapa, els 947— ja és al peu de totes les pàgines.
  const fitxa: EnllacPeu = { text: `La fitxa de ${conjunt.municipi}`, on: `../../m/${conjunt.slug}/` };
  const extres: EnllacPeu[] = disponible
    ? [{ text: "Respon les preguntes", on: "prova/" }, fitxa]
    : [fitxa];

  // El títol i la descripció diuen quantes preguntes hi ha de debò i quantes
  // van lligades a una votació, que és la xifra que fa que el conjunt es pugui
  // respondre o no. Mentre no es pot —«En revisió» a l'índex— no s'indexa.
  const url = `${SITE}/observatori/preguntes/${conjunt.slug}/`;
  const arrelPreguntes = { nom: "Preguntes per municipi", url: `${SITE}/observatori/preguntes/` };
  return `${capsalPreguntes(
    {
      titol: `${conjunt.afirmacions.length} preguntes sobre ${conjunt.municipi}`,
      descripcio: `Les ${conjunt.afirmacions.length} preguntes que la brúixola de quivoto faria a ${conjunt.municipi}, en esborrany i amb l'evidència de cadascuna: ${v.resum.ambVotCitable} lligades a una votació del ple.`,
      url,
      noIndex: !disponible,
      jsonLd: [filAriadna([...ARREL_OBSERVATORI, arrelPreguntes, { nom: conjunt.municipi, url }])],
    },
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
           del ple que la sosté. <b>Ja es poden respondre</b> i comparar amb el que han votat els
           grups municipals, encara que els programes electorals del 2027 no estiguin publicats.
           Les anirem millorant a mesura que llegim més actes.`
        : `Les ${conjunt.afirmacions.length} preguntes que faríem aquí, cadascuna amb l'evidència
           que la sosté. Aquest conjunt <b>encara no es pot respondre</b>: mira'n el veredicte
           aquí sota per saber per què.`
    }</p>
    ${
      disponible
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
    <p class="secundari"><b>Aquestes preguntes ja es poden respondre.</b> La comparació actual
    mostra què han votat els grups durant el mandat i no necessita cap programa. La
    <b>brúixola electoral completa</b> hi afegirà què promet cada candidatura quan publiquin els
    programes i responguin, a partir de finals d'abril del 2027.</p>
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
        disponible
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
      // Cada municipi porta dos camins a més del conjunt: respondre'l, si es
      // pot, i la seva fitxa municipal, que és on es veu qui mana i què ha
      // votat de debò el ple del qual surten les preguntes.
      (c) => `<li><a class="conjunt" href="${escape(c.slug)}/">
      <b>${escape(c.municipi)}</b>
      <span class="secundari">${c.veredicte.resum.ambVotCitable} de ${c.veredicte.total} preguntes
      lligades a una votació del ple</span>
    </a>
    <p class="accions">
      ${c.veredicte.avaluable && verifica(c).jugable ? `<a class="prova-enllac" href="${escape(c.slug)}/prova/">Respon-les →</a>` : '<span class="prova-enllac bloquejada">En revisió</span>'}
      <a class="prova-enllac" href="../m/${escape(c.slug)}/">La fitxa de ${escape(c.municipi)} →</a>
    </p></li>`,
    )
    .join("");

  // Quants conjunts es poden respondre ja: la mateixa condició que posa el
  // botó «Respon-les» a cada fila, i no una altra.
  const responibles = conjunts.filter((c) => c.veredicte.avaluable && verifica(c).jugable).length;
  const url = `${SITE}/observatori/preguntes/`;
  return `${capsalPreguntes(
    {
      titol: "Preguntes per municipi",
      descripcio: `Les preguntes que la brúixola de quivoto faria a ${conjunts.length} municipis de Catalunya, en esborrany i amb l'evidència de cadascuna: ${responibles} ja es poden respondre.`,
      url,
      imatge: imatgeOg(FITXER_OG.global("preguntes")),
      jsonLd: [filAriadna([...ARREL_OBSERVATORI, { nom: "Preguntes per municipi", url }])],
    },
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
