/**
 * La papereta, que és la mascota, i les cinc cares de l'escala.
 *
 * Vivien només al generador de la portada (`tools/icons_lib.py`) i per això
 * l'Observatori feia cara de full de càlcul: les preguntes es responien amb
 * emojis del sistema, que són d'una altra família i canvien de dibuix segons el
 * telèfon. Aquí hi ha les mateixes que a la portada, dibuixades igual.
 *
 * Els grups `parpelles` i `pupilles` existeixen per animar-los: el CSS els fa
 * parpellejar i mirar de reüll. Sense animació el dibuix es veu igualment bé,
 * que és el que ha de passar quan algú demana que no li moguin la pantalla.
 */

const INK = "#1E1B2E";
const PAPER = "#FBF7EE";
const WHITE = "#FFFFFF";
const CORAL = "#E2735A";
const MINT = "#BFE8D2";
const PEACH = "#FFD8B8";

/** Les boques de la papereta gran. */
const BOQUES: Record<string, string> = {
  felic: `<path class="boca" d="M44 92 q16 14 32 0" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  neutre: `<path class="boca" d="M46 94 h28" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  pregunta: `<path class="boca" d="M50 94 q10 -6 20 0" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
};

/** La mascota: una papereta de vot amb cara. */
export function papereta(mida = 180, humor: keyof typeof BOQUES | string = "felic"): string {
  const boca = BOQUES[humor] ?? BOQUES["felic"]!;
  return `<svg class="papereta" width="${mida}" height="${Math.round(mida * 1.17)}" viewBox="0 0 120 140" role="img" aria-label="La papereta, mascota de quivoto">
  <g class="cos">
    <path d="M18 14 H80 L102 36 V126 H18 Z" fill="${WHITE}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M80 14 V36 H102 Z" fill="${PEACH}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <g class="ratlles">
      <path d="M32 112 H88" stroke="${CORAL}" stroke-width="5" stroke-linecap="round"/>
      <path d="M32 122 H70" stroke="${MINT}" stroke-width="5" stroke-linecap="round"/>
    </g>
    <g class="cara">
      <circle cx="46" cy="70" r="9" fill="${WHITE}" stroke="${INK}" stroke-width="3"/>
      <circle cx="76" cy="70" r="9" fill="${WHITE}" stroke="${INK}" stroke-width="3"/>
      <g class="pupilles"><circle cx="46" cy="71" r="4.2" fill="${INK}"/><circle cx="76" cy="71" r="4.2" fill="${INK}"/></g>
      <g class="parpelles">
        <circle cx="46" cy="70" r="9.6" fill="${WHITE}"/>
        <circle cx="76" cy="70" r="9.6" fill="${WHITE}"/>
      </g>
      ${boca}
    </g>
    <path class="creu" d="M31 46 l7 8 l14 -16" stroke="${CORAL}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
}

/**
 * Les cinc cares de l'escala, de gens d'acord a totalment d'acord.
 *
 * Les dues dels extrems no porten ulls rodons: la de l'esquerra té les celles
 * caigudes i la de la dreta riu amb els ulls tancats. És el que les fa
 * distingibles d'una ullada sense haver de llegir-ne el text, que és
 * exactament el que ha de passar en un test de vint-i-cinc preguntes.
 */
export const CARES: ReadonlyArray<{ valor: -2 | -1 | 0 | 1 | 2; text: string; svg: string }> = [
  { valor: -2, text: "Gens d'acord", svg: cara(CORAL, "enfadat") },
  { valor: -1, text: "Més aviat no", svg: cara(PEACH, "trist") },
  { valor: 0, text: "Ni sí ni no", svg: cara(PAPER, "recte") },
  { valor: 1, text: "Més aviat sí", svg: cara(MINT, "content") },
  { valor: 2, text: "Totalment d'acord", svg: cara(MINT, "rient") },
];

function cara(color: string, humor: string): string {
  const boques: Record<string, string> = {
    enfadat: `<path d="M20 34 q4 -3 8 0" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M14 20 l5 3 M34 20 l-5 3" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`,
    trist: `<path d="M20 33 q4 -2 8 0" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
    recte: `<path d="M20 32 h8" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`,
    content: `<path d="M20 30 q4 3 8 0" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
    rient: `<path d="M19 29 q5 6 10 0 z" fill="${INK}"/><path d="M15 21 q3 -4 6 0 M27 21 q3 -4 6 0" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
  };
  const ulls =
    humor === "enfadat" || humor === "rient"
      ? ""
      : `<circle cx="19" cy="23" r="2.4" fill="${INK}"/><circle cx="29" cy="23" r="2.4" fill="${INK}"/>`;
  return `<svg class="cara-escala" width="48" height="48" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="${color}" stroke="${INK}" stroke-width="2.5"/>${ulls}${boques[humor] ?? ""}</svg>`;
}

/**
 * Les animacions de la mascota.
 *
 * Parpelleja cada tants segons i mira de reüll, que és el que la fa semblar
 * viva sense que es mogui res més de la pàgina. Tot va dins d'un
 * `prefers-reduced-motion`: qui demana que no li moguin la pantalla veu el
 * mateix dibuix quiet, no una versió pitjor.
 */
export const MASCOTA_CSS = `
.papereta{display:block}
.papereta .parpelles circle{transform-origin:center;transform:scaleY(0);animation:parpelleig 6.5s infinite}
.papereta .pupilles{animation:reull 9s ease-in-out infinite}
.papereta .cos{animation:sura 7s ease-in-out infinite;transform-origin:60px 120px}
@keyframes parpelleig{0%,92%,100%{transform:scaleY(0)}94%,96%{transform:scaleY(1)}}
@keyframes reull{0%,40%,100%{transform:translateX(0)}50%,60%{transform:translateX(3px)}75%,85%{transform:translateX(-3px)}}
@keyframes sura{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-6px) rotate(-1.2deg)}}
.cara-escala{display:block;transition:transform .18s cubic-bezier(.34,1.56,.64,1)}
button:hover>.cara-escala{transform:scale(1.14) rotate(-6deg)}
button[aria-pressed="true"]>.cara-escala{transform:scale(1.06)}
@media (prefers-reduced-motion:reduce){
  .papereta .parpelles circle,.papereta .pupilles,.papereta .cos{animation:none}
  .papereta .parpelles circle{transform:scaleY(0)}
  .cara-escala{transition:none}
  button:hover>.cara-escala,button[aria-pressed="true"]>.cara-escala{transform:none}
}
`;
