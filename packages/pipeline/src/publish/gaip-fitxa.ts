import { FONTS_GAIP, MANDATS_GAIP, type GaipMetric, type ReclamacioGaip, type ReclamantGaip, type SentitGaip } from "../jobs/j45-gaip";
import { dataCurta, de, delDia, elDia } from "../lib/text";

/**
 * «Quan algú demana informació i no li la donen»: el bloc de la fitxa amb les
 * reclamacions davant la GAIP (J45) contra l'ajuntament.
 *
 * Qui demana un document a l'ajuntament i no el rep —perquè li diuen que no o
 * perquè no li contesten— pot reclamar a la GAIP, la Comissió de Garantia del
 * Dret d'Accés a la Informació Pública. El que es publica aquí és el que la
 * GAIP ha resolt, i com.
 *
 * Quatre decisions de forma:
 *
 *   · **L'incompliment, primer i a la vista.** Si la GAIP fa constar que
 *     l'ajuntament no va complir alguna resolució seva, és el fet més fort del
 *     bloc i va abans que cap xifra, amb les dates i els enllaços.
 *   · **«Estimada» vol dir una cosa concreta.** Quan la GAIP estima una
 *     reclamació, del tot o en part, conclou que l'ajuntament havia de donar
 *     la informació. No diu res més: ni que l'ajuntament amagués res, ni que
 *     la informació fos comprometedora. La frase ho diu així.
 *   · **Zero no és un excel·lent.** Als pobles petits hi ha poques
 *     sol·licituds d'informació, i no tenir cap reclamació no vol dir que
 *     l'ajuntament ho publiqui tot. Tampoc no es fan taxes per habitant: una
 *     ciutat rep moltes més sol·licituds, i la font no diu quantes.
 *   · **La pèrdua d'objecte es diu a part.** És el sentit més freqüent, i sol
 *     voler dir que l'ajuntament va donar la informació un cop presentada la
 *     reclamació. No és ni una victòria ni una derrota de ningú.
 *
 * Mai cap nom de persona: la font no en porta de qui reclama, i el del membre
 * de la GAIP que fa de ponent J45 ni el demana.
 *
 * Les classes van amb el prefix `gaip-`.
 */

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const enter = (n: number): string => n.toLocaleString("ca-ES", { maximumFractionDigits: 0 });
const percent = (part: number, total: number): string =>
  `${((100 * part) / total).toLocaleString("ca-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}&nbsp;%`;

/** «una reclamació», «3 reclamacions». */
const reclamacions = (n: number): string => (n === 1 ? "una reclamació" : `${enter(n)} reclamacions`);

/** Com es diu cada sentit en una frase, en plural i en singular. */
const SENTIT_FRASE: Record<SentitGaip, [string, string]> = {
  estimacio: ["estimada del tot", "estimades del tot"],
  estimacioParcial: ["estimada en part", "estimades en part"],
  perduaObjecte: ["tancada per pèrdua d'objecte", "tancades per pèrdua d'objecte"],
  desestimacio: ["desestimada", "desestimades"],
  inadmissio: ["inadmesa", "inadmeses"],
  mediacio: ["resolta amb un acord de mediació", "resoltes amb un acord de mediació"],
  desistiment: ["retirada per qui reclamava", "retirades per qui reclamava"],
  altres: ["amb un altre sentit", "amb un altre sentit"],
};

/** L'etiqueta curta del sentit, per a la llista de recents. */
const SENTIT_CURT: Record<SentitGaip, string> = {
  estimacio: "Estimada",
  estimacioParcial: "Estimada en part",
  perduaObjecte: "Pèrdua d'objecte",
  desestimacio: "Desestimada",
  inadmissio: "Inadmesa",
  mediacio: "Mediació",
  desistiment: "Retirada",
  altres: "Altres",
};

/** Qui reclamava, en singular i en plural. */
const RECLAMANT_FRASE: Record<ReclamantGaip, [string, string]> = {
  particular: ["particular", "particulars"],
  electe: ["càrrec electe", "càrrecs electes"],
  entitat: ["entitat o fundació", "entitats i fundacions"],
  premsa: ["periodista", "periodistes"],
  sindicat: ["sindicat o representació dels treballadors", "sindicats i representants dels treballadors"],
  empresa: ["empresa", "empreses"],
  altres: ["altra condició", "altres condicions"],
};

/** L'ordre en què es diuen els sentits: primer els que donen la raó a qui reclama. */
const ORDRE_SENTITS: readonly SentitGaip[] = [
  "estimacio", "estimacioParcial", "perduaObjecte", "mediacio", "desestimacio", "inadmissio", "desistiment", "altres",
];

/** «a, b i c». */
function llista(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} i ${parts[parts.length - 1]}`;
}

/** Les tessel·les de la fitxa: el mateix HTML que `tira()` de radiografia.ts. */
function tira(t: { etq: string; xifra: string; peu?: string }): string {
  return `<li class="tira"><span class="etq">${escape(t.etq)}</span>
      <span class="xifra">${t.xifra}</span>
      ${t.peu ? `<span class="peu">${t.peu}</span>` : ""}</li>`;
}

/** Quantes la GAIP en va estimar, del tot o en part. */
const estimades = (m: GaipMetric["mandat"]): number => m.sentit.estimacio + m.sentit.estimacioParcial;

/** L'avís dels incompliments, si n'hi ha. */
export function avisIncompliments(dades: GaipMetric): string {
  const inc = dades.incompliments;
  if (inc.length === 0) return "";
  const dates = inc.map((i) => i.dataResolucio).filter((d): d is string => d !== null).sort();
  const quan =
    dates.length === 0
      ? ""
      : dates[0]!.slice(0, 4) === dates.at(-1)!.slice(0, 4)
        ? ` (resolucions del ${dates[0]!.slice(0, 4)})`
        : ` (resolucions del ${dates[0]!.slice(0, 4)} al ${dates.at(-1)!.slice(0, 4)})`;
  const files = inc
    .map((i) => {
      const enllac = i.url
        ? `<a href="${escape(i.url)}" rel="noopener nofollow">Resolució ${escape(i.resolucio ?? i.reclamacio)}</a>`
        : `Resolució ${escape(i.resolucio ?? i.reclamacio)}`;
      const detall = [
        i.dataResolucio ? `resolta ${elDia(i.dataResolucio)}` : null,
        i.dataRequeriment ? `requeriment ${elDia(i.dataRequeriment)}` : null,
        i.sentitText ? i.sentitText.toLocaleLowerCase("ca") : null,
      ].filter(Boolean).join(" · ");
      return `<li>${enllac}${detall ? ` <small>${escape(detall)}</small>` : ""}</li>`;
    })
    .join("");
  const n = inc.length;
  return `<div class="gaip-incompliment" role="note">
    <p><b>Segons la GAIP, l'ajuntament no va complir ${n === 1 ? "una resolució seva" : `${enter(n)} resolucions seves`}</b>${quan}:
    la GAIP li va requerir que ${n === 1 ? "la" : "les"} complís i no consta que ho fes. És el registre d'incompliments que publica la
    mateixa GAIP.</p>
    <details><summary>${n === 1 ? "La resolució" : `Les ${enter(n)} resolucions`}</summary><ul class="gaip-llista">${files}</ul></details>
  </div>`;
}

/** «Del mandat: 5 reclamacions; la GAIP en va estimar 3, del tot o en part.» */
function fraseMandat(dades: GaipMetric, nom: string | null): string {
  const m = dades.mandat;
  const contra = nom ? `contra l'Ajuntament ${escape(de(nom))}` : "contra l'ajuntament";
  if (m.reclamacions === 0) {
    const ant = dades.anterior.reclamacions;
    return `<p class="entrada-bloc">Aquest mandat (des ${escape(delDia(m.des))}) no consta cap reclamació ${contra} que la
    GAIP hagi resolt${ant > 0 ? `; el mandat anterior, ${reclamacions(ant)}` : ""}.</p>`;
  }
  const e = estimades(m);
  const raons =
    e === 0
      ? "La GAIP no en va estimar cap."
      : `La GAIP en va estimar <b>${enter(e)}</b>, del tot o en part (${percent(e, m.reclamacions)}): en aquests casos va
      concloure que l'ajuntament havia de donar la informació que se li demanava.`;
  return `<p class="entrada-bloc">Aquest mandat, des ${escape(delDia(m.des))}, la GAIP ha resolt
  <b>${reclamacions(m.reclamacions)}</b> ${contra}. ${raons}</p>`;
}


/** Les tessel·les: aquest mandat, l'anterior, quantes estimades i quants dies. */
function tesselles(dades: GaipMetric): string {
  const m = dades.mandat;
  const a = dades.anterior;
  const tires = [
    tira({ etq: "Reclamacions aquest mandat", xifra: enter(m.reclamacions), peu: `des ${escape(delDia(m.des))}` }),
    tira({ etq: "El mandat anterior", xifra: enter(a.reclamacions), peu: `${a.des.slice(0, 4)}-${(a.fins ?? "").slice(0, 4)}` }),
  ];
  if (m.reclamacions > 0) {
    const e = estimades(m);
    tires.push(tira({ etq: "Estimades, del tot o en part", xifra: percent(e, m.reclamacions), peu: `${enter(e)} de ${enter(m.reclamacions)}` }));
  }
  if (m.medianaDies !== null) {
    tires.push(tira({ etq: "Dies que va trigar la GAIP", xifra: enter(m.medianaDies), peu: "la mediana del mandat" }));
  }
  return `<ul class="tires">${tires.join("")}</ul>`;
}

/** El desglossament per sentit i per qui reclamava, en frases. */
function desglos(dades: GaipMetric, ctx: { poblacio: number | null }): string {
  const m = dades.mandat;
  if (m.reclamacions === 0) return "";
  const sentits = ORDRE_SENTITS.filter((s) => m.sentit[s] > 0).map((s) => {
    const n = m.sentit[s];
    return `${enter(n)} ${SENTIT_FRASE[s][n === 1 ? 0 : 1]}`;
  });
  const perdua = m.sentit.perduaObjecte > 0
    ? ` La pèrdua d'objecte vol dir que la reclamació es va tancar sense pronunciar-s'hi perquè ja no hi havia res a
    resoldre; el cas més habitual és que l'ajuntament hagués donat la informació un cop presentada la reclamació.`
    : "";
  const quiNoms = (Object.keys(RECLAMANT_FRASE) as ReclamantGaip[])
    .filter((r) => m.reclamant[r] > 0)
    .sort((x, y) => m.reclamant[y] - m.reclamant[x])
    .map((r) => `${enter(m.reclamant[r])} ${RECLAMANT_FRASE[r][m.reclamant[r] === 1 ? 0 : 1]}`);
  const electes = m.reclamant.electe > 0
    ? " Els càrrecs electes que reclamen solen ser regidors que demanen documents del mateix ajuntament."
    : "";
  const ambits = m.ambits.length
    ? `<p>Els temes amb més reclamacions: ${escape(llista(m.ambits.map((a) => `${a.ambit.toLocaleLowerCase("ca")} (${enter(a.reclamacions)})`)))}.</p>`
    : "";
  return `<div class="gaip-desglos">
    <p>Com van acabar: ${escape(llista(sentits))}.${perdua}</p>
    <p>Qui reclamava: ${escape(llista(quiNoms))}.${electes}</p>
    ${ambits}
    ${onada(dades)}
    ${ctx.poblacio !== null && ctx.poblacio < 1000 && m.reclamacions <= 3
      ? `<p class="gaip-explica">En un municipi de ${enter(ctx.poblacio)} habitants, una sola persona o entitat pot fer totes les reclamacions d'un mandat.</p>`
      : ""}
  </div>`;
}

/**
 * Quan un tema del municipi és també el d'una onada a tot Catalunya (el
 * mandat actual, «Protecció d'animals», amb reclamacions contra 773
 * ajuntaments), ho diu: llegit sol, semblaria un problema del poble.
 */
function onada(dades: GaipMetric): string {
  const cat = dades.catalunya.ambits ?? [];
  const propis = new Map(dades.mandat.ambits.map((a) => [a.ambit, a.reclamacions]));
  const comuns = cat.filter((a) => a.ajuntaments >= 300 && propis.has(a.ambit));
  return comuns
    .map((a) => `<p class="gaip-explica">${enter(propis.get(a.ambit)!)} ${propis.get(a.ambit) === 1 ? "és" : "són"} de
    ${escape(a.ambit.toLocaleLowerCase("ca"))}, un tema en què aquest mandat s'han presentat ${enter(a.reclamacions)}
    reclamacions contra ${enter(a.ajuntaments)} ajuntaments de tot Catalunya, moltes alhora.</p>`)
    .join("");
}

/** Les reclamacions més recents: data, tema, com va acabar i el PDF. */
function taulaRecents(recents: readonly ReclamacioGaip[]): string {
  if (recents.length === 0) return "";
  const files = recents
    .map((r) => `<tr>
      <td><time datetime="${escape(r.dataReclamacio)}">${escape(dataCurta(r.dataReclamacio))}</time></td>
      <td>${r.ambit ? escape(r.ambit) : "—"}</td>
      <td>${escape(SENTIT_CURT[r.sentit])}</td>
      <td>${r.url
        ? `<a href="${escape(r.url)}" rel="noopener nofollow">${escape(r.resolucio ?? r.reclamacio)}</a>`
        : escape(r.resolucio ?? r.reclamacio)}</td>
    </tr>`)
    .join("");
  return `<details class="gaip-detall"><summary>${recents.length === 1 ? "La reclamació, amb la resolució" : `Les ${enter(recents.length)} més recents, de qualsevol mandat`}</summary>
  <div class="taula-envolta"><table class="balanc gaip-taula">
  <thead><tr><th scope="col">Reclamada</th><th scope="col">Tema</th><th scope="col">Com va acabar</th><th scope="col">Resolució</th></tr></thead>
  <tbody>${files}</tbody></table></div></details>`;
}

/** La referència de Catalunya: el mateix mandat, tots els ajuntaments. */
function referenciaCatalunya(dades: GaipMetric): string {
  const c = dades.catalunya;
  if (c.reclamacions === 0) return "";
  return `<p class="gaip-explica">A tot Catalunya, aquest mandat, la GAIP ha resolt ${enter(c.reclamacions)} reclamacions
  contra ${enter(c.ajuntaments)} ajuntaments, i n'ha estimat ${enter(c.estimades)} del tot o en part
  (${percent(c.estimades, c.reclamacions)}). És una referència, no una nota: una ciutat rep moltes més sol·licituds
  d'informació que un poble, i la GAIP no publica quantes en rep cada ajuntament.</p>`;
}

/** El que no diuen aquestes xifres, sempre. */
function cauteles(dades: GaipMetric): string {
  const fins = dades.darreraReclamacioFont ? ` La reclamació més nova del conjunt és ${escape(delDia(dades.darreraReclamacioFont))}.` : "";
  return `<p class="nota"><b>Què vol dir, i què no.</b> Reclamar a la GAIP és gratuït i el pot fer qualsevol persona a
  qui l'ajuntament no ha donat una informació pública que havia demanat. Que n'hi hagi poques o cap no vol dir que
  l'ajuntament ho publiqui tot: als pobles petits hi ha poques sol·licituds, i molta gent no reclama. Que n'hi hagi
  moltes pot voler dir un ajuntament que respon poc o uns quants veïns, regidors o entitats molt insistents. Aquí
  només hi ha les reclamacions que la GAIP ja ha resolt: les pendents no hi surten, i per això els darrers mesos
  surten curts.${fins}</p>`;
}

/** El peu amb les dues fonts, la llicència i les dates. */
function peuFonts(dades: GaipMetric): string {
  const una = (f: GaipMetric["fonts"]["resolucions"]): string =>
    `<a href="${escape(f.url)}" rel="noopener nofollow">${escape(f.nom)}</a>${f.actualitzat ? `, actualitzat ${escape(elDia(f.actualitzat))}` : ""}`;
  return `<p class="peu-nota gaip-peu">Fonts: ${una(dades.fonts.resolucions)} i ${una(dades.fonts.incompliments)}, al
  portal de Dades Obertes de Catalunya; ${escape(dades.fonts.resolucions.llicencia)}. Consultades ${escape(elDia(dades.consultat))}.
  La font no porta el codi del municipi: cada reclamació s'hi ha lligat pel nom de l'administració reclamada, i les que
  són contra un organisme o una empresa municipal sense nomenar l'ajuntament no s'hi compten. Les resolucions
  traduïdes al castellà es compten un sol cop.</p>`;
}

/** El títol del bloc, per a la llista de seccions de la fitxa. */
export const TITOL_GAIP = "Quan algú demana informació i no li la donen";

/**
 * El contingut del bloc, sense la secció que l'embolcalla: és el que va a la
 * llista de blocs de la fitxa (`id`, `titol`, `html`) de radiografia.ts.
 * Mai retorna cadena buida: sense J45 executat, diu que no consta.
 *
 * `poblacio` és el padró de la fitxa: només serveix per a l'avís dels pobles
 * molt petits, mai per fer taxes. `nom` és opcional i fa la frase més planera.
 */
export function renderGaipBloc(dades: GaipMetric | null, poblacio: number | null, nom?: string | null): string {
  const f = FONTS_GAIP;
  if (!dades) {
    return `<p class="entrada-bloc">No consta cap dada de les reclamacions d'accés a la informació d'aquest municipi.
  Un buit no és un zero.</p>
  <p class="peu-nota gaip-peu">Fonts consultades: <a href="${f.resolucions.url}" rel="noopener nofollow">${escape(f.resolucions.nom)}</a>
  i <a href="${f.incompliments.url}" rel="noopener nofollow">${escape(f.incompliments.nom)}</a>.</p>`;
  }
  return `<p class="gaip-que">Qui demana un document o una dada a l'ajuntament i no la rep —perquè li diuen que no o
  perquè no li contesten en un mes— pot reclamar a la GAIP, la Comissió de Garantia del Dret d'Accés a la Informació
  Pública, que resol si l'ajuntament l'havia de donar.</p>
  ${avisIncompliments(dades)}
  ${fraseMandat(dades, nom ?? null)}
  ${tesselles(dades)}
  ${desglos(dades, { poblacio })}
  ${taulaRecents(dades.recents)}
  ${referenciaCatalunya(dades)}
  ${cauteles(dades)}
  ${peuFonts(dades)}`;
}

/** El bloc sencer com a secció de la fitxa, amb el títol. */
export function renderGaip(dades: GaipMetric | null, poblacio: number | null, nom?: string | null): string {
  return `<section class="bloc" id="gaip">
  <h2>${escape(TITOL_GAIP)}</h2>
  ${renderGaipBloc(dades, poblacio, nom)}
</section>`;
}

/** Quan comença el mandat que compta la fitxa, per si un altre bloc ho vol dir igual. */
export const INICI_MANDAT_GAIP = MANDATS_GAIP.actual.des;

/**
 * L'estil propi del bloc. L'incompliment va en una franja amb una vora gruixuda
 * de tinta, sense vermell: és un fet que la GAIP fa constar, no una alarma.
 */
export const GAIP_FITXA_CSS = `
.gaip-que{margin:0 0 var(--e2);color:var(--ink-suau)}
.gaip-incompliment{border-left:6px solid var(--ink);background:var(--paper-2,transparent);padding:var(--e2) var(--e2) var(--e2) var(--e3);margin:0 0 var(--e3)}
.gaip-incompliment p{margin:0}
.gaip-incompliment summary{cursor:pointer;font-weight:700;margin-top:var(--e1)}
.gaip-llista{margin:var(--e1) 0 0;padding-left:1.2rem}
.gaip-llista li{margin:2px 0;overflow-wrap:anywhere}
.gaip-llista small{color:var(--ink-suau)}
.gaip-desglos p{margin:var(--e1) 0 0}
.gaip-explica{font-size:.9rem;color:var(--ink-suau);margin:var(--e2) 0 0}
.gaip-detall{margin:var(--e2) 0 0}
.gaip-detall summary{cursor:pointer;font-weight:700}
.gaip-taula td{overflow-wrap:anywhere}
.gaip-taula time{white-space:nowrap}
.gaip-peu{max-width:70ch;margin-top:var(--e3)}
`;
