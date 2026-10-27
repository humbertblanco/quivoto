/**
 * La papereta com a narradora: sis postures per als estats editorials que es
 * repeteixen a les fitxes.
 *
 * Fins ara la mascota només sortia quieta a les capçaleres (Els 947, el mapa,
 * l'AMB) i en gran a la portada. Les fitxes, que és on passa tot, no la feien
 * servir mai. Aquí la papereta fa de veu: quan una dada no consta arronsa les
 * espatlles, quan dues llistes empaten sosté dues boles iguals, quan l'alcaldia
 * canvia a mig mandat mira cap al costat sorpresa, quan hi ha majoria absoluta
 * es posa les mans a la cintura, i al final de la pàgina saluda.
 *
 * Per què és un fitxer a part i no unes boques més a `mascota.ts`:
 *  - `papereta(mida, humor)` de `mascota.ts` porta la classe `papereta`, i el
 *    `MASCOTA_CSS` la fa parpellejar, mirar de reüll i surar en bucle. Això va bé
 *    per a una capçalera, però una fitxa amb cinc mascotes que suren alhora
 *    seria una pàgina que no para quieta. Aquestes són quietes per defecte i
 *    porten classes pròpies (`pap-`) perquè cap regla d'aquell full les toqui.
 *  - Les postures necessiten braços, i un braç es dibuixa en dues meitats, una
 *    darrere del cos i l'altra davant (vegeu `brasVora`), cosa que demana un
 *    ordre de dibuix diferent del de la papereta de capçalera.
 *
 * El que no canvia, i no ha de canviar mai: el cos, la doblegada de color
 * préssec, les dues ratlles, els ulls de radi 9 amb traç 3, les pupil·les de
 * 4,2, la boca de traç 4 i la creu coral de traç 6, tot dins del mateix
 * viewBox 0 0 120 140 i amb el mateix factor d'alçada 1,17. Una papereta que
 * canviés de proporcions segons la fitxa deixaria de ser el mateix personatge.
 *
 * Neutralitat: cap postura no jutja. La majoria absoluta no és «bé» ni
 * l'empat «malament»; la papereta explica un fet, no hi posa nota. Per això no
 * hi ha cap color nou: els mateixos cinc de sempre (blanc, tinta, coral, menta i
 * préssec), i cap verd o vermell de veredicte.
 */

const INK = "#1E1B2E";
const WHITE = "#FFFFFF";
const CORAL = "#E2735A";
const MINT = "#BFE8D2";
const PEACH = "#FFD8B8";

/** Les sis postures, amb el nom que farà servir qui les crida. */
export const POSTURES = ["noConsta", "empat", "canviMigMandat", "majoria", "final", "pregunta"] as const;
export type Postura = (typeof POSTURES)[number];

export interface OpcionsPapereta {
  /** Amplada en píxels; l'alçada en surt amb el factor 1,17 de la mascota. */
  mida?: number;
  /**
   * El nom accessible. Si hi és, el dibuix és una imatge amb `<title>`; si no,
   * és decoratiu i el lector de pantalla se'l salta. Al costat d'un text que ja
   * diu el mateix («no consta») ha d'anar sense títol: llegir-ho dues vegades
   * no informa, entrebanca.
   */
  titol?: string;
  /**
   * Només per a `final`: la papereta saluda dues vegades en arribar-hi i es
   * queda quieta. Res no es mou si qui mira demana menys moviment.
   */
  animada?: boolean;
  /** Un id fix per al `<title>`, per si qui crida vol una sortida estable. */
  id?: string;
}

/** Escapa el text que va dins d'un atribut o d'un element. */
function escapa(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Un comptador per fer únics els ids dels títols dins d'una mateixa pàgina.
 *
 * No hi ha degradats ni màscares (no en fem servir enlloc de la casa), i per
 * tant l'únic id és el del `<title>`, que el lliga a l'SVG amb
 * `aria-labelledby`. El generador escriu les pàgines sempre en el mateix ordre,
 * i per això la sortida és igual d'una publicació a l'altra.
 */
let comptador = 0;

/**
 * Un braç: un traç gruixut de tinta amb un traç blanc a dins.
 *
 * És el mateix llenguatge que el cos —blanc amb vora de tinta— i té una raó
 * pràctica: en mode fosc el fons és gairebé de color tinta, i un braç fet
 * només de tinta hi desapareixeria.
 *
 * Les dues meitats es dibuixen en moments diferents. La vora va *darrere* del
 * cos, perquè el paper en tapi l'arrel; el blanc va *davant*, i a l'espatlla
 * tapa un tros de la vora del cos. Així el braç surt del paper sense cap
 * costura. Amb tot dibuixat darrere, sobre fons fosc la vora del cos (que no
 * s'hi veu) deixava una escletxa i els braços semblaven trossos solts surant al
 * costat de la papereta.
 */
function brasVora(d: string, classe: string): string {
  return `<path class="${classe}" d="${d}" stroke="${INK}" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
}
function brasNucli(d: string, classe: string): string {
  return `<path class="${classe}" d="${d}" stroke="${WHITE}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/** Els ulls oberts de sempre, amb les pupil·les desplaçades si cal mirar a algun lloc. */
function ulls(esq: readonly [number, number] = [46, 71], dre: readonly [number, number] = [76, 71]): string {
  return `<circle cx="46" cy="70" r="9" fill="${WHITE}" stroke="${INK}" stroke-width="3"/>
      <circle cx="76" cy="70" r="9" fill="${WHITE}" stroke="${INK}" stroke-width="3"/>
      <circle cx="${esq[0]}" cy="${esq[1]}" r="4.2" fill="${INK}"/><circle cx="${dre[0]}" cy="${dre[1]}" r="4.2" fill="${INK}"/>`;
}

/** Una boca de traç 4, com totes les de la mascota. */
function boca(d: string): string {
  return `<path d="${d}" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/** La creu coral, el vot fet. */
const CREU = `<path d="M31 46 l7 8 l14 -16" stroke="${CORAL}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;

/**
 * El que canvia d'una postura a l'altra. Tot és opcional i el que falta es
 * queda com a la papereta de sempre.
 */
interface Dibuix {
  /** Els camins dels braços (vegeu `brasVora` per l'ordre de dibuix). */
  bracos?: ReadonlyArray<string>;
  /** La marca de la papereta: per defecte la creu coral. */
  marca?: string;
  /** La cara sencera: ulls, celles i boca. */
  cara: string;
  /** Llargada de les dues ratlles de baix (coral i menta), en unitats del viewBox. */
  ratlles?: readonly [number, number];
  /** Coses que van per sobre del cos (les boles de l'empat). */
  davant?: string;
}

const DIBUIXOS: Record<Postura, Dibuix> = {
  /*
   * «No consta»: arronsa les espatlles. La creu no hi és i al seu lloc hi ha
   * una casella de traç discontinu, buida: és la papereta sense marcar, que és
   * exactament el que diu el principi «un buit és un buit». Una sola cella
   * aixecada fa el «qui sap», i va a l'ull de la dreta perquè a l'esquerra hi
   * ha la casella.
   */
  noConsta: {
    bracos: ["M22 90 L8 94 L5 81", "M98 90 L112 94 L115 81"],
    marca: `<rect x="30" y="36" width="22" height="19" rx="3" fill="none" stroke="${INK}" stroke-width="3" stroke-dasharray="4.5 4" stroke-linecap="round"/>`,
    cara: `${ulls([44, 69], [74, 69])}
      <path d="M67 55 q9 -7 18 0" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      ${boca("M49 95 q5.5 -4 11 0 q5.5 4 11 0")}`,
  },
  /*
   * «Empat»: estira els dos braços com una balança, amb una bola igual a cada
   * mà, i mira les dues alhora. Amb les boles enlaire semblaven antenes. Les
   * dues ratlles de baix, que normalment fan una llarga i una curta, aquí
   * fan igual. La boca és recta: un empat no és ni bona ni mala notícia.
   */
  empat: {
    bracos: ["M22 86 L8 86", "M98 86 L112 86"],
    cara: `${ulls([43, 71], [79, 71])}
      ${boca("M50 94 h20")}`,
    ratlles: [44, 44],
    davant: `<circle cx="9" cy="78" r="5.5" fill="${PEACH}" stroke="${INK}" stroke-width="3"/><circle cx="111" cy="78" r="5.5" fill="${PEACH}" stroke="${INK}" stroke-width="3"/>`,
  },
  /*
   * «Canvi d'alcaldia a mig mandat»: la creu es converteix en dues fletxes
   * que es creuen (la vara que passa d'una mà a l'altra), la boca fa una «o»
   * i els ulls miren cap a la dreta, que dins d'una vinyeta és on hi ha la
   * frase que ho explica. Sense braços: un de sol, assenyalant, semblava un
   * monyó a 48 px. Sorpresa, no escàndol: canviar d'alcalde a mig mandat és
   * legal i passa sovint.
   */
  canviMigMandat: {
    marca: `<g stroke="${CORAL}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M30 39 H50 M45 34 l5 5 l-5 5"/><path d="M52 51 H32 M37 46 l-5 5 l5 5"/></g>`,
    cara: `${ulls([49, 70], [79, 70])}
      <circle cx="60" cy="95" r="4.5" fill="none" stroke="${INK}" stroke-width="4"/>`,
  },
  /*
   * «Majoria absoluta»: les mans a la cintura, el gest de qui pot decidir sol.
   * Somriu com la papereta de sempre, però no fa cap salt ni aixeca els
   * braços: celebrar-ho seria prendre partit.
   */
  majoria: {
    bracos: ["M22 80 L5 88 L21 105", "M98 80 L115 88 L99 105"],
    cara: `${ulls()}
      ${boca("M44 92 q16 14 32 0")}`,
  },
  /*
   * «Final»: saluda amb la mà dreta i riu amb els ulls tancats, com la cara
   * de «totalment d'acord» de l'escala. És l'únic braç que es pot moure, i
   * només un cop (vegeu `PAPERETA_POSTURES_CSS`).
   */
  final: {
    bracos: ["M98 86 L111 76 L113 60"],
    cara: `<path d="M38 72 q8 -9 16 0" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M68 72 q8 -9 16 0" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>
      ${boca("M44 92 q16 14 32 0")}`,
  },
  /*
   * «Pregunta»: la de sempre, amb el somriure petit que va substituir la boca
   * cap avall (vegeu `mascota.ts`). Sense braços: la mascota pregunta, no
   * gesticula.
   */
  pregunta: {
    cara: `${ulls()}
      ${boca("M48 94 q12 8 24 0")}`,
  },
};

/**
 * La papereta en una de les sis postures, com a SVG en línia.
 *
 * Per defecte fa 48 px d'ample, que és la mida que demana una fitxa: com a
 * molt una per bloc i mai més gran que el títol que acompanya.
 */
export function paperetaPostura(postura: Postura, opcions: OpcionsPapereta = {}): string {
  const { mida = 48, titol, animada = false } = opcions;
  const d = DIBUIXOS[postura];
  const [coral, menta] = d.ratlles ?? [56, 38];
  const classes = ["pap-svg", `pap-${postura}`];
  if (animada && postura === "final") classes.push("pap-mou");
  // L'únic braç que saluda és el de «final»; la classe hi va sempre, però
  // només es mou si l'SVG porta també «pap-mou».
  const classeBras = postura === "final" ? "pap-bras pap-saluda" : "pap-bras";
  const bracos = d.bracos ?? [];

  let accessible: string;
  let titolSvg = "";
  if (titol !== undefined && titol.trim() !== "") {
    const id = opcions.id ?? `pap-t${++comptador}`;
    accessible = `role="img" aria-labelledby="${escapa(id)}"`;
    titolSvg = `<title id="${escapa(id)}">${escapa(titol)}</title>`;
  } else {
    accessible = 'aria-hidden="true" focusable="false"';
  }

  return `<svg class="${classes.join(" ")}" width="${mida}" height="${Math.round(mida * 1.17)}" viewBox="0 0 120 140" ${accessible}>${titolSvg}
  ${bracos.map((b) => brasVora(b, classeBras)).join("")}
  <path d="M18 14 H80 L102 36 V126 H18 Z" fill="${WHITE}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
  ${bracos.map((b) => brasNucli(b, classeBras)).join("")}
  <path d="M80 14 V36 H102 Z" fill="${PEACH}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
  <path d="M32 112 H${32 + coral}" stroke="${CORAL}" stroke-width="5" stroke-linecap="round"/>
  <path d="M32 122 H${32 + menta}" stroke="${MINT}" stroke-width="5" stroke-linecap="round"/>
  ${d.cara}
  ${d.marca ?? CREU}
  ${d.davant ?? ""}
</svg>`;
}

export interface OpcionsVinyeta {
  /** Mida de la papereta; 48 per defecte. */
  mida?: number;
  /** Un enllaç que segueix la frase, com el «El comparem amb un altre poble?» del final. */
  enllac?: { href: string; text: string };
}

/**
 * Una vinyeta: la papereta al costat d'una frase curta, com si la digués ella.
 *
 * El dibuix hi és decoratiu (`aria-hidden`) perquè la frase ja ho diu tot; el
 * contenidor és una nota (`role="note"`) i no un `<aside>`, perquè un `<aside>`
 * és una fita de navegació i una fitxa amb quatre vinyetes en tindria quatre de
 * més al menú del lector de pantalla.
 *
 * El text s'escapa sempre. Si cal un enllaç, va a part, a `enllac`, i així
 * ningú no ha de muntar HTML a mà dins d'una frase.
 */
export function vinyetaPapereta(postura: Postura, text: string, opcions: OpcionsVinyeta = {}): string {
  const { mida = 48, enllac } = opcions;
  const animada = postura === "final";
  const enllacHtml = enllac ? ` <a href="${escapa(enllac.href)}">${escapa(enllac.text)}</a>` : "";
  return `<div class="pap-vinyeta pap-v-${postura}" role="note">${paperetaPostura(postura, { mida, animada })}<p class="pap-text">${escapa(text)}${enllacHtml}</p></div>`;
}

/**
 * El full d'estil de les postures i de la vinyeta.
 *
 * Tot porta el prefix `pap-` perquè res d'aquí no xoqui amb `.papereta` (que
 * sura i parpelleja) ni amb les classes del peu. Els colors són els tokens de
 * `estil.ts`, amb el valor clar de recanvi per si la pàgina no els defineix.
 *
 * La bafarada és una vora de tinta i un fons de paper, sense ombra grisa: és la
 * papereta que parla, no una targeta més. La punta és un quadrat girat que
 * comparteix fons i vora amb la bafarada.
 *
 * Moviment: cap per defecte. Només la postura `final` amb `animada` saluda, dos
 * cops i prou, i només si qui mira no ha demanat menys moviment; per això
 * l'animació viu *dins* de `prefers-reduced-motion:no-preference` i no fora amb
 * una excepció a sota.
 */
export const PAPERETA_POSTURES_CSS = `
.pap-svg{display:block;flex:0 0 auto;overflow:visible}
.pap-vinyeta{display:flex;align-items:center;gap:var(--e2,16px);margin:var(--e3,24px) 0;max-width:38rem}
.pap-text{position:relative;min-width:0;margin:0;padding:10px 14px;background:var(--paper-2,#FFFFFF);color:var(--ink,#1E1B2E);
  border:2px solid var(--ink,#1E1B2E);border-radius:var(--r-m,18px);font-size:.95rem;line-height:1.4;font-weight:700}
.pap-text::before{content:"";position:absolute;left:-8px;top:50%;width:12px;height:12px;margin-top:-6px;
  background:inherit;border-left:2px solid var(--ink,#1E1B2E);border-bottom:2px solid var(--ink,#1E1B2E);
  border-bottom-left-radius:3px;transform:rotate(45deg)}
.pap-text a{color:var(--coral-text,#C24429);font-weight:800;text-decoration-thickness:2px;text-underline-offset:3px}
.pap-text a:focus-visible{outline:3px solid var(--coral-text,#C24429);outline-offset:2px;border-radius:4px}
@media (max-width:400px){
  .pap-vinyeta{gap:12px}
  .pap-vinyeta .pap-svg{width:40px;height:47px}
}
@media (prefers-reduced-motion:no-preference){
  .pap-mou .pap-saluda{transform-box:view-box;transform-origin:100px 86px;
    animation:pap-saluda 1.1s cubic-bezier(.4,0,.2,1) .4s 1 both}
  @keyframes pap-saluda{0%,100%{transform:rotate(0)}20%,60%{transform:rotate(-14deg)}40%,80%{transform:rotate(8deg)}}
}
`;
