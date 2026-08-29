import { RADIOGRAFIA_CSS } from "./estil";
import { SITE } from "./config";
import type { ConjuntAmbSlug } from "./preguntes";
import { posicions, type Grup } from "./posicions";
import { puntDe, type PuntActa } from "./enllac-actes";
import { CARES, MASCOTA_CSS, papereta } from "./mascota";
import { icona } from "./icones";

/**
 * La demo del test: les preguntes d'un municipi, per respondre de veritat.
 *
 * Compara amb **cada grup del ple**, no només amb el govern. La posició de cada
 * grup surt de com va votar el punt que l'afirmació resumeix, deduïda a
 * `posicions.ts`: o bé l'acta anomena els grups de cada costat, o bé els
 * números només admeten un repartiment possible. Quan no es compleix cap de les
 * dues coses, aquell grup no té posició en aquella afirmació i queda fora del
 * càlcul. No s'endevina.
 *
 * Per això cada grup porta la seva **cobertura** a la vista: amb quantes de les
 * afirmacions se'l pot situar. Un grup amb cinc afirmacions no es pot comparar
 * amb un que en té vint, i amagar-ho faria semblar precisa una xifra que no ho és.
 *
 * El que això **no** és: la posició que el partit diu que té. És la que es
 * dedueix del que ha votat, i votar en contra d'una moció pot voler dir estar en
 * contra de qui la presenta i no del que hi diu. Al 2027 seran les candidatures
 * qui respondran les preguntes; llavors les dues columnes es podran comparar, i
 * aquesta serà la manera de veure qui fa el que diu.
 *
 * El càlcul es fa al navegador i les respostes no surten del dispositiu. La
 * fórmula és la mateixa de `packages/shared-schemas/src/matching.ts`: distància
 * de Manhattan sobre l'escala −2..2, pes doble per a les marcades com a molt
 * importants, i les omeses fora del numerador i del denominador.
 */

const escape = (t: string): string =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const CSS = `
.prova{max-width:var(--ample);margin:0 auto;padding:0 var(--e3) var(--e5)}
.progres{display:flex;align-items:center;gap:var(--e2);padding:var(--e3) 0 0}
.progres .barra{flex:1 1 auto;height:10px;background:var(--vora);border-radius:var(--r-max);overflow:hidden}
.progres .barra i{display:block;height:100%;width:var(--w,0%);background:var(--coral);border-radius:var(--r-max);transition:width .24s ease}
.progres .compte{font-weight:800;font-size:.85rem;color:var(--ink-suau);white-space:nowrap;font-variant-numeric:tabular-nums}

.targeta{background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-l);
  box-shadow:8px 8px 0 var(--ink);padding:var(--e4) var(--e3);margin-top:var(--e3)}
.targeta .tema{display:inline-flex;align-items:center;gap:7px;background:var(--menta);color:#1E1B2E;
  border:1.5px solid var(--ink);border-radius:var(--r-max);padding:3px 12px 3px 4px;font-size:.7rem;
  font-weight:800;text-transform:uppercase;letter-spacing:.08em}
.targeta .tema .icona{width:26px;height:26px;flex:0 0 auto}
.targeta .tema:not(:has(.icona)){padding-left:12px}
.targeta h2{font-size:clamp(1.35rem,4.4vw,2rem);margin:var(--e2) 0 0;max-width:24ch;line-height:1.22}

.escala{display:grid;gap:8px;grid-template-columns:repeat(5,1fr);margin:var(--e4) 0 0}
.escala button{font:inherit;font-weight:800;font-size:.76rem;line-height:1.2;cursor:pointer;
  background:var(--paper);color:inherit;border:2.5px solid var(--ink);border-radius:var(--r-m);
  padding:14px 6px;min-height:86px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;
  box-shadow:var(--ombra);transition:transform .12s ease,box-shadow .12s ease,background .12s ease}
.escala button:hover{transform:translate(2px,2px);box-shadow:1px 1px 0 var(--ink)}
.escala button[aria-pressed="true"]{background:var(--coral);color:#FBF7EE}
.escala .cara-escala{width:38px;height:38px}
.escala .etq-cara{display:block}
/* El districte, quan la decisió n'afecta un de concret: a Barcelona, una
   superilla de l'Eixample o un tram del tramvia no toquen igual algú de Sants. */
.districte{display:inline-block;margin-left:8px;background:var(--lavanda);color:#1E1B2E;
  border:1.5px solid var(--ink);border-radius:var(--r-max);padding:3px 12px;font-size:.7rem;
  font-weight:800;text-transform:uppercase;letter-spacing:.06em}
.presenta{display:flex;align-items:center;gap:var(--e3);flex-wrap:wrap}
.presenta .papereta{flex:0 0 auto}
@media (max-width:520px){.presenta .papereta{width:76px;height:89px}}
.sota{display:flex;gap:var(--e2);flex-wrap:wrap;align-items:center;margin-top:var(--e3)}
.sota button{font:inherit;font-weight:800;font-size:.85rem;cursor:pointer;background:transparent;color:inherit;
  border:2px solid var(--ink);border-radius:var(--r-max);padding:8px 16px}
.sota button[aria-pressed="true"]{background:var(--presec);color:#1E1B2E}
.sota button:disabled{opacity:.35;cursor:default}
.detall{margin-top:var(--e3);font-size:.9rem}
.detall summary{cursor:pointer;font-weight:800}
.detall p{margin:var(--e2) 0 0;color:var(--ink-suau);line-height:1.5}

/* El resultat: una barra per grup, amb el color del grup i la cobertura al costat. */
.classificacio{list-style:none;margin:var(--e4) 0 0;padding:0}
.classificacio li{margin-bottom:var(--e3)}
.classificacio .fila{display:flex;align-items:baseline;gap:var(--e2);flex-wrap:wrap}
.classificacio .nom{font-family:var(--display);font-weight:900;font-size:1.05rem;letter-spacing:-.01em}
.classificacio .pct{margin-left:auto;font-family:var(--display);font-weight:900;font-size:1.5rem;font-variant-numeric:tabular-nums}
.classificacio .cobertura{font-size:.8rem;color:var(--ink-suau);font-weight:700}
.classificacio .via{height:16px;border:2.5px solid var(--ink);border-radius:var(--r-max);background:var(--paper);
  overflow:hidden;margin-top:6px}
.classificacio .via i{display:block;height:100%;width:var(--w,0%);background:var(--c,var(--coral));transition:width .5s ease}
.classificacio li.poca .pct{opacity:.5}

.repas{list-style:none;margin:var(--e4) 0 0;padding:0;text-align:left}
.repas li{border-top:2.5px solid var(--ink);padding:var(--e3) 0}
.repas .afirmacio{font-family:var(--display);font-weight:900;font-size:1.05rem;letter-spacing:-.01em;line-height:1.3}
.repas .comparacio{display:flex;gap:6px;flex-wrap:wrap;margin-top:var(--e2);font-size:.8rem}
.repas .qui{border:2px solid var(--ink);border-radius:var(--r-max);padding:3px 11px;font-weight:800;
  background:var(--c,transparent);color:var(--sobre,inherit)}
.repas .qui.tu{background:var(--lavanda);color:#1E1B2E}
.repas .evidencia{font-size:.84rem;color:var(--ink-suau);margin-top:var(--e2);line-height:1.5}
.repas .sensedada{font-size:.8rem;color:var(--ink-suau);margin-top:6px}
.avis-demo{background:var(--presec);color:#1E1B2E;border:2.5px solid var(--ink);border-radius:var(--r-m);
  box-shadow:var(--ombra);padding:var(--e3);margin:var(--e3) 0;font-size:.94rem}
.avis-demo p{margin:0 0 var(--e2)}
.avis-demo p:last-child{margin-bottom:0}
.gros{font:inherit;font-weight:800;font-size:1rem;cursor:pointer;background:var(--ink);color:var(--paper);
  border:2.5px solid var(--ink);border-radius:var(--r-max);padding:12px 26px}
@media (prefers-reduced-motion:reduce){.escala button,.progres .barra i,.classificacio .via i{transition:none}}
@media (max-width:560px){.escala{gap:5px}.escala button{padding:10px 2px;min-height:76px;font-size:.6rem}}
`;

/**
 * Les cinc respostes possibles, amb les cares de la mascota.
 *
 * Abans eren emojis del sistema. Un emoji canvia de dibuix a cada telèfon, no
 * s'assembla a res més de la pàgina i en alguns Android surt d'una altra
 * família: el test semblava un formulari amb adhesius. Aquestes són les mateixes
 * cares de la portada.
 */
const ESCALA = CARES.map((c) => ({ valor: c.valor, text: c.text, svg: c.svg }));

/** Text negre o blanc segons què es llegeixi millor sobre el color del grup. */
function sobre(color: string): string {
  const hex = color.replace("#", "");
  if (hex.length < 6) return "#1E1B2E";
  const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  // Luminància relativa aproximada, prou per triar entre dos colors.
  return 0.299 * r! + 0.587 * g! + 0.114 * b! > 150 ? "#1E1B2E" : "#FBF7EE";
}

export function renderProva(
  conjunt: ConjuntAmbSlug,
  grups: readonly Grup[],
  punts: readonly PuntActa[],
  generatedAt: string,
): string {
  // Fora les afirmacions amb una cita que no és al document que diu citar. La
  // pàgina d'esborrany les ensenya marcades perquè es puguin criticar; aquí no
  // hi entren, perquè fer decidir algú a partir d'una frase que ningú no ha dit
  // és exactament el que aquest projecte no pot fer.
  const fallides = new Set(conjunt.citesFallides);
  const dades = conjunt.afirmacions
    .map((a, i) => ({ a, i }))
    .filter(({ i }) => !fallides.has(i))
    .map(({ a }) => a)
    .filter((a) => a.posicio_govern === "acord" || a.posicio_govern === "desacord")
    .map((a) => {
      // Si s'ha llegit l'acta del ple que cita, el vot hi és desglossat i no
      // cal deduir-lo.
      const p = posicions(a.evidencia, a.posicio_govern, grups, puntDe(a.evidencia, punts));
      return {
        t: a.text,
        tema: a.tema,
        d: a.districte ?? null,
        // La icona del tema: en un test de vint-i-cinc preguntes, saber de què
        // va la següent d'una ullada és la diferència entre continuar i plegar.
        i: icona(a.tema),
        // La posició del govern, que és la que sabem del cert i s'ha comprovat
        // obrint l'acta.
        g: a.posicio_govern === "acord" ? 2 : -2,
        // La de cada grup, deduïda del vot. Buida quan no se'n pot deduir res.
        p: Object.fromEntries(p.map((x) => [x.grup, x.valor])),
        base: p[0]?.base ?? null,
        e: a.evidencia,
        u: a.url_evidencia ?? null,
        c: a.context ?? null,
      };
    });

  // Amb quantes afirmacions es pot situar cada grup. Si no s'arriba a un mínim,
  // el percentatge no vol dir res i s'ha de dir.
  const cobertura = new Map<string, number>();
  // Només compten les que puntuen: qui es va abstenir surt a la pàgina però no
  // entra al càlcul, i comptar-lo aquí inflaria la cobertura amb no-respostes.
  for (const d of dades) {
    for (const [nom, valor] of Object.entries(d.p)) {
      if (valor === null) continue;
      cobertura.set(nom, (cobertura.get(nom) ?? 0) + 1);
    }
  }

  const ambPosicio = grups
    .filter((g) => (cobertura.get(g.nom) ?? 0) > 0)
    .map((g) => ({
      nom: g.nom,
      escons: g.escons,
      govern: g.govern,
      color: g.color ?? "#8b8b8b",
      sobre: sobre(g.color ?? "#8b8b8b"),
      n: cobertura.get(g.nom) ?? 0,
    }))
    .sort((a, b) => b.escons - a.escons);

  const compta = (base: string): number => dades.filter((d) => d.base === base).length;
  const desActes = compta("acta");
  /**
   * Quins grups no es poden distingir amb aquestes preguntes.
   *
   * Si dos grups voten igual a totes les afirmacions on tots dos hi són, la
   * brúixola no els sap separar: qui la respongui els veurà empatats i no serà
   * perquè s'assemblin, sinó perquè no els hem preguntat res que els separi. A
   * Badalona passa amb quatre grups de l'oposició, perquè el govern hi té
   * majoria absoluta i tots quatre hi voten en contra de gairebé tot.
   *
   * És el defecte més fàcil de no veure d'un conjunt de preguntes, i el més
   * important: vint-i-cinc afirmacions que parteixen el ple sempre igual són
   * una sola pregunta escrita vint-i-cinc vegades. Es diu a la pàgina perquè
   * qui l'escrigui sàpiga on ha de buscar —una moció de llengua, una
   * d'urbanisme, una que enfronti dos partits que solen anar junts.
   */
  const bessons: string[][] = [];
  for (let a = 0; a < ambPosicio.length; a += 1) {
    for (let b = a + 1; b < ambPosicio.length; b += 1) {
      const x = ambPosicio[a]!.nom;
      const y = ambPosicio[b]!.nom;
      let comparades = 0;
      let iguals = 0;
      for (const d of dades) {
        const vx = d.p[x];
        const vy = d.p[y];
        if (vx === undefined || vy === undefined || vx === null || vy === null) continue;
        comparades += 1;
        if (vx === vy) iguals += 1;
      }
      if (comparades >= 5 && iguals === comparades) bessons.push([x, y]);
    }
  }

  const nominals = compta("nominal");
  const deduides = compta("aritmetica") + compta("bloc");

  return `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Prova el test · ${escape(conjunt.municipi)} — quivoto</title>
<meta name="description" content="Respon ${dades.length} preguntes sobre ${escape(conjunt.municipi)} i mira amb quin grup del ple coincideixes més.">
<link rel="canonical" href="${SITE}/observatori/preguntes/${escape(conjunt.slug)}/prova/">
<style>${RADIOGRAFIA_CSS}${MASCOTA_CSS}${CSS}</style>
</head>
<body>
<a class="salta" href="#contingut">Ves al contingut</a>
<header class="capcalera">
  <a class="logo" href="/observatori/">Observatori</a>
  <span class="etiqueta">avaluació del mandat</span>
</header>

<main class="prova" id="contingut">
  <section id="intro">
    <div class="presenta">${papereta(120, "pregunta")}<div>
      <p class="micro">Demostració</p>
      <h1>${escape(conjunt.municipi)}</h1>
    </div></div>
    <p class="entrada">Respon ${dades.length} afirmacions sobre el teu poble i mira
    <b>amb quin grup del ple coincideixes més</b>. Cada una porta el ple on es va votar.</p>
    <div class="avis-demo">
      ${
        conjunt.citesFallides.length > 0
          ? `<p><b>${conjunt.citesFallides.length}
             ${conjunt.citesFallides.length === 1 ? "afirmació s'ha tret" : "afirmacions s'han tret"}
             d'aquest test</b> perquè alguna cita seva no s'ha trobat al document que diu citar.
             ${conjunt.citesFallides.length === 1 ? "És" : "Són"} a la
             <a href="../">pàgina de l'esborrany</a>, marcades, per si les vols mirar.</p>`
          : ""
      }
      <p><b>Això és una demostració, i les afirmacions encara no estan validades.</b>
      Mira'n el <a href="../">detall, l'evidència i el veredicte</a> abans de fer-ne cas.</p>
      <p>La posició de cada grup no és la que el partit diu que té: és <b>com va votar al
      ple</b>. ${
        ambPosicio.length > 0
          ? `De ${dades.length} afirmacions, ${desActes} surten de l'acta llegida, on el vot de
             cada grup hi és escrit; ${nominals} de l'evidència, que anomena els grups; i
             ${deduides} dels números, quan només admetien una lectura possible.`
          : "En aquest municipi encara no se n'ha pogut situar cap grup."
      }
      Quan cap de les tres coses no es compleix, aquell grup queda fora d'aquella pregunta
      —per això cada grup porta al costat amb quantes se'l pot situar.</p>
      <p>Un partit pot votar en contra d'una moció per qui la presenta i no pel que hi diu.
      Al 2027 seran les candidatures qui respondran, i llavors es podran comparar les dues coses.</p>
      ${
        bessons.length > 0
          ? `<p><b>Aquestes preguntes no separen tots els grups.</b> ${bessons
              .map(([a, b]) => `${escape(a!)} i ${escape(b!)}`)
              .join("; ")} ${bessons.length === 1 ? "voten" : "voten"} igual a totes les
             afirmacions on se'ls pot situar. Si et surten empatats no és perquè s'assemblin:
             és que no els hem preguntat res que els separi, i això és cosa nostra.</p>`
          : ""
      }
    </div>
    <p><button class="gros" id="comenca">Comença</button></p>
    <p class="nota">Les teves respostes es queden al navegador. No se n'envia cap enlloc.</p>
  </section>

  <section id="test" hidden>
    <div class="progres">
      <span class="compte" id="compte"></span>
      <span class="barra"><i id="barra"></i></span>
    </div>
    <article class="targeta">
      <span class="tema" id="tema"></span>
      <span class="districte" id="districte" hidden></span>
      <h2 id="afirmacio"></h2>
      <div class="escala" id="escala" role="group" aria-label="Què hi dius"></div>
      <div class="sota">
        <button type="button" id="important" aria-pressed="false">Això m'importa molt</button>
        <button type="button" id="omet">Ometre</button>
        <button type="button" id="enrere">Enrere</button>
      </div>
      <details class="detall"><summary>Per què ho preguntem</summary><p id="context"></p></details>
    </article>
  </section>

  <section id="resultat" hidden>
    <div class="presenta">${papereta(96, "felic")}<div>
      <p class="micro">El teu resultat</p>
      <h2 id="titol-resultat" style="margin:0"></h2>
    </div></div>
    <ul class="classificacio" id="classificacio"></ul>
    <p class="nota" id="nota-cobertura"></p>
    <h2 style="margin-top:var(--e5)">Pregunta per pregunta</h2>
    <ul class="repas" id="repas"></ul>
    <p class="nota" style="margin-top:var(--e4)">
      <button type="button" class="gros" id="mes" hidden></button>
      <button type="button" id="altre" style="font:inherit;font-weight:800;cursor:pointer;background:transparent;border:2px solid var(--ink);border-radius:var(--r-max);padding:10px 20px;margin-left:var(--e2)">Torna-hi</button>
      <a href="../../../m/${escape(conjunt.slug)}/" style="margin-left:var(--e2)">Mira la fitxa de ${escape(conjunt.municipi)}</a>
    </p>
  </section>
</main>

<footer class="peu"><p>quivoto · demostració generada el ${escape(generatedAt)} · les afirmacions no estan validades</p></footer>

<script>
const D = ${JSON.stringify(dades)};
const GRUPS = ${JSON.stringify(ambPosicio)};
const ESCALA = ${JSON.stringify(ESCALA)};
const CLAU = "quivoto-prova-${escape(conjunt.slug)}";
/* Les preguntes es donen per tandes.
   Vint-i-cinc és el que aguanta algú d'una tirada; a partir d'aquí, qui vulgui
   afinar més pot demanar-ne més, i qui no, ja té el seu resultat. Fer-ne
   respondre quaranta de cop faria plegar la meitat de la gent a la quinzena, i
   una brúixola que ningú no acaba no serveix de res. */
var TANDA = 25;
var limit = Math.min(TANDA, D.length);
/* Amb menys d'aquestes afirmacions situades, el percentatge d'un grup no diu res. */
const MINIM = 5;

/* La mateixa fórmula que packages/shared-schemas/src/matching.ts: distància de
   Manhattan sobre −2..2, pes doble a les marcades com a molt importants, i les
   omeses fora del numerador i del denominador. Si allà canvia, aquí també. */
function coincidencia(respostes, posicioDe) {
  let num = 0, den = 0, n = 0;
  D.forEach((d, i) => {
    const r = respostes[i];
    if (!r || r.v === null) return;
    const p = posicioDe(d, i);
    if (p === null || p === undefined) return;
    const pes = r.important ? 2 : 1;
    num += pes * (4 - Math.abs(r.v - p));
    den += pes * 4;
    n += 1;
  });
  return den === 0 ? null : { pct: Math.max(0, Math.min(100, Math.round(100 * num / den))), n };
}

let i = 0;
let respostes = [];
try { respostes = JSON.parse(localStorage.getItem(CLAU) || "[]"); } catch (e) { respostes = []; }

const $ = (id) => document.getElementById(id);
const desa = () => { try { localStorage.setItem(CLAU, JSON.stringify(respostes)); } catch (e) {} };

function pintaEscala() {
  $("escala").innerHTML = ESCALA.map((e) =>
    '<button type="button" data-v="' + e.valor + '" aria-pressed="false">' +
    e.svg + '<span class="etq-cara">' + e.text + '</span></button>').join("");
  for (const b of $("escala").children) b.addEventListener("click", () => respon(Number(b.dataset.v)));
}

function pinta() {
  if (i >= limit) return acaba();
  const d = D[i];
  $("tema").innerHTML = (d.i || "") + "<span>" + d.tema + "</span>";
  $("districte").textContent = d.d || "";
  $("districte").hidden = !d.d;
  $("afirmacio").textContent = d.t;
  $("context").textContent = d.c || "Surt d'un punt votat al ple; l'evidència és al resultat.";
  $("compte").textContent = (i + 1) + " de " + limit;
  $("barra").style.setProperty("--w", Math.round(100 * i / limit) + "%");
  const r = respostes[i];
  for (const b of $("escala").children) {
    b.setAttribute("aria-pressed", r && r.v === Number(b.dataset.v) ? "true" : "false");
  }
  $("important").setAttribute("aria-pressed", r && r.important ? "true" : "false");
  $("enrere").disabled = i === 0;
}

function respon(v) {
  respostes[i] = { v, important: (respostes[i] || {}).important || false };
  desa();
  i += 1;
  pinta();
}

/* null vol dir que el grup es va abstenir: es diu, però no puntua. */
const etiquetaDe = (v) => (v === null ? "es va abstenir" : (ESCALA.find((e) => e.valor === v) || {}).text || "sense posició");

function acaba() {
  $("test").hidden = true;
  $("resultat").hidden = false;

  const resultats = GRUPS.map((g) => {
    const r = coincidencia(respostes, (d) => (g.nom in d.p ? d.p[g.nom] : null));
    return { ...g, pct: r ? r.pct : null, respostes: r ? r.n : 0 };
  }).filter((r) => r.pct !== null);

  /* De més a menys, i prou.
     Abans els grups amb poques afirmacions situades anaven al final encara que
     tinguessin el percentatge més alt. Era ben intencionat —una xifra feta amb
     tres preguntes no es pot comparar amb una feta amb vint— però el resultat
     semblava desordenat i ningú no llegia per què. Ara l'ordre és el que
     s'espera i la poca cobertura es diu allà mateix, a cada fila. */
  const ordenats = resultats.slice().sort((a, b) => b.pct - a.pct);
  const escassos = ordenats.filter((r) => r.respostes < MINIM);

  if (ordenats.length === 0) {
    const gov = coincidencia(respostes, (d) => d.g);
    $("titol-resultat").textContent = gov
      ? "Coincideixes un " + gov.pct + " % amb el govern"
      : "No has respost cap afirmació";
    $("classificacio").innerHTML = "";
    $("nota-cobertura").textContent = gov
      ? "En aquest municipi encara no s'ha pogut deduir la posició de cap grup a partir de les actes, així que la comparació només es pot fer amb el govern."
      : "";
  } else {
    const cap = ordenats[0];
    $("titol-resultat").textContent = "T'assembles més a " + cap.nom;
    $("classificacio").innerHTML = ordenats.map((r) =>
      '<li class="' + (r.respostes < MINIM ? "poca" : "") + '">' +
      '<div class="fila"><span class="nom">' + r.nom + '</span>' +
      '<span class="cobertura">' + r.escons + (r.escons === 1 ? " regidoria" : " regidories") +
      (r.govern ? " · al govern" : "") +
      ' · situat en ' + r.respostes + ' de les que has respost</span>' +
      '<span class="pct">' + r.pct + ' %</span></div>' +
      '<div class="via"><i style="--w:' + r.pct + '%;--c:' + r.color + '"></i></div></li>').join("");
    $("nota-cobertura").textContent =
      "El percentatge de cada grup es calcula només sobre les afirmacions on se'l pot situar amb l'acta a la mà. " +
      (escassos.length > 0
        ? "Els que surten en gris estan situats en menys de " + MINIM + " afirmacions: la xifra no és comparable amb la resta."
        : "");
  }

  // Queden preguntes per respondre? S'ofereixen, no s'imposen.
  const resten = D.length - limit;
  $("mes").hidden = resten <= 0;
  if (resten > 0) {
    $("mes").textContent =
      "Afina-ho amb " + Math.min(TANDA, resten) + (resten === 1 ? " pregunta més" : " preguntes més");
  }

  $("repas").innerHTML = D.map((d, n) => {
    const r = respostes[n];
    if (!r || r.v === null) return "";
    const meu = etiquetaDe(r.v);
    const fitxes = GRUPS.filter((g) => g.nom in d.p).map((g) =>
      '<span class="qui" style="--c:' + g.color + ';--sobre:' + g.sobre + '">' +
      g.nom + ': ' + etiquetaDe(d.p[g.nom]) + '</span>').join("");
    const sensedada = GRUPS.filter((g) => !(g.nom in d.p)).map((g) => g.nom);
    return '<li><p class="afirmacio">' + d.t + '</p>' +
      '<div class="comparacio"><span class="qui tu">Tu: ' + meu + '</span>' +
      (fitxes || '<span class="qui">El govern: ' + etiquetaDe(d.g) + '</span>') + '</div>' +
      (sensedada.length > 0 && fitxes
        ? '<p class="sensedada">Sense posició deduïble en aquesta: ' + sensedada.join(", ") + '.</p>'
        : '') +
      '<p class="evidencia">' + d.e + (d.u ? ' <a href="' + d.u + '" target="_blank" rel="noopener">obre el document</a>' : '') + '</p></li>';
  }).join("");
}

pintaEscala();
$("comenca").addEventListener("click", () => { $("intro").hidden = true; $("test").hidden = false; pinta(); });
$("omet").addEventListener("click", () => { respostes[i] = { v: null, important: false }; desa(); i += 1; pinta(); });
$("enrere").addEventListener("click", () => { if (i > 0) { i -= 1; pinta(); } });
$("important").addEventListener("click", () => {
  respostes[i] = respostes[i] || { v: null, important: false };
  respostes[i].important = !respostes[i].important;
  desa();
  pinta();
});
$("mes").addEventListener("click", () => {
  limit = Math.min(limit + TANDA, D.length);
  // Continua per la primera que encara no s'ha tocat, no des del principi:
  // qui demana més preguntes no vol tornar a respondre les que ja ha respost.
  i = 0;
  while (i < limit && respostes[i] !== undefined) i += 1;
  $("resultat").hidden = true;
  $("test").hidden = false;
  pinta();
});
$("altre").addEventListener("click", () => {
  respostes = []; i = 0; limit = Math.min(TANDA, D.length); desa();
  $("resultat").hidden = true; $("test").hidden = false; pinta();
});
document.addEventListener("keydown", (e) => {
  if ($("test").hidden) return;
  if (e.key >= "1" && e.key <= "5") respon(ESCALA[Number(e.key) - 1].valor);
  if (e.key.toLowerCase() === "o") $("omet").click();
  if (e.key.toLowerCase() === "e") $("enrere").click();
});
</script>
</body></html>`;
}
