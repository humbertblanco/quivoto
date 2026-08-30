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
 * Les animacions de les dues mascotes.
 *
 * Parpellegen cada tants segons i miren de reüll, que és el que les fa semblar
 * vives sense que es mogui res més de la pàgina. Tot va dins d'un
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

/* --- la silueta de Catalunya -----------------------------------------------
   Comparteix els keyframes de la papereta a posta: si aquí es reescrivissin el
   parpelleig i la surada amb altres temps, les dues mascotes semblarien de dues
   cases diferents.

   Del catàleg de «design/MOVIMENT.md» aquesta només fa el moviment 5, «Vida»:
   respira molt a poc a poc, parpelleja i mira de reüll. Els punts de poble
   s'encenen UNA vegada en carregar, com la creu de la papereta que es dibuixa,
   i es queden encesos; no hi ha cap bucle fora de la cara, que és el que diu la
   regla 6. El que no fa, i s'ha descartat expressament, és encendre els punts
   en bucle: seria un bucle a la vista principal i, pitjor, un dibuix que sembla
   que compta alguna cosa quan no compta res. */
.catalunya{display:block}
.catalunya .terra{animation:sura 7s ease-in-out infinite;transform-origin:60px 100px}
.catalunya .parpelles circle{transform-box:fill-box;transform-origin:center;transform:scaleY(0);
  animation:parpelleig 6.5s infinite}
.catalunya .pupilles{transform-box:fill-box;transform-origin:center;animation:reull 9s ease-in-out infinite}
.catalunya .pobles circle{transform-box:fill-box;transform-origin:center;opacity:0;transform:scale(.4);
  animation:poble 240ms cubic-bezier(.4,0,.2,1) var(--retard,0s) forwards}
@keyframes poble{to{opacity:1;transform:scale(1)}}
.cara-escala{display:block;transition:transform .18s cubic-bezier(.34,1.56,.64,1)}
button:hover>.cara-escala{transform:scale(1.14) rotate(-6deg)}
button[aria-pressed="true"]>.cara-escala{transform:scale(1.06)}
@media (prefers-reduced-motion:reduce){
  .papereta .parpelles circle,.papereta .pupilles,.papereta .cos{animation:none}
  .papereta .parpelles circle{transform:scaleY(0)}
  .catalunya .terra,.catalunya .pupilles,.catalunya .parpelles circle,
  .catalunya .pobles circle{animation:none}
  .catalunya .parpelles circle{transform:scaleY(0)}
  .catalunya .pobles circle{opacity:1;transform:none}
  .cara-escala{transition:none}
  button:hover>.cara-escala,button[aria-pressed="true"]>.cara-escala{transform:none}
}
`;

/* ==========================================================================
   La segona mascota: Catalunya.
   ========================================================================== */

/**
 * Les boques de la silueta, amb les mateixes claus que les de la papereta.
 *
 * Són a part perquè la cara de la silueta no seu al mateix lloc que la de la
 * papereta: si es compartissin els camins, la boca quedaria fora de la costa.
 */
const BOQUES_CAT: Record<string, string> = {
  felic: `<path class="boca" d="M40 68 q10 9 20 0" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  neutre: `<path class="boca" d="M42 70 h18" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  pregunta: `<path class="boca" d="M44 70 q8 -5 16 0" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
};

/**
 * La silueta, dibuixada a mà i deliberadament curta de detall.
 *
 * No surt de simplificar el contorn de `geo/municipis.json`: aquell camí té 351
 * punts i, reduït a 40 px, la costa i la ratlla del Pirineu es tapen les unes
 * amb les altres i queda una taca. El que es reconeix de Catalunya a mida
 * d'icona són quatre coses, i només n'hi ha aquestes quatre: la ratlla del
 * Pirineu que baixa cap a llevant, la punta del cap de Creus, la diagonal
 * llarga de la costa i la punta de baix amb el nas del delta. Tota la resta
 * s'ha tret a posta.
 *
 * Els punts de referència sí que surten del contorn de debò (mostrejat i
 * normalitzat a 0–100, i després portat a aquest quadre de 120), i per això la
 * proporció i la inclinació són les que toquen encara que el traç no ho sigui.
 */
const SILUETA =
  "M26 18 Q36 20 48 25 Q55 28 62 30 Q70 33 77 33 Q85 33 91 29 L101 37 " +
  "Q98 47 91 57 Q84 62 75 66 Q67 72 59 77 L41 83 Q34 86 32 91 " +
  "L37 96 L28 98 L21 103 Q14 100 14 93 L16 79 Q17 71 17 64 Q19 57 24 52 Q28 44 27 34 Z";

/**
 * Set punts de poble, que són textura i no són dada.
 *
 * **No són els 947 ni en són una mostra**: no estan on són els municipis, no en
 * representen cap i no se'n pot comptar res. El mapa de debò és a
 * `mapa-catalunya.ts` i aquest personatge no hi ha de competir. Set és el
 * nombre que cabia sense tocar la cara ni sortir de la costa; si algun dia se
 * n'hi posen més, el sostre d'escalonament de `design/MOVIMENT.md` són vuit.
 */
const POBLES: ReadonlyArray<readonly [number, number]> = [
  [36, 30],
  [58, 37],
  [81, 42],
  [33, 39],
  [23, 68],
  [32, 85],
  [24, 94],
];

/**
 * La germana de la papereta: Catalunya amb cara.
 *
 * Es crida igual que `papereta()` —mida i variant— perquè les dues mascotes
 * són intercanviables a la capçalera d'una pantalla i qui les posa no hagi de
 * recordar dues formes de fer-ho. El quadre és quadrat, i per això aquí no hi
 * ha el factor 1,17 de la papereta.
 *
 * `etiqueta` a `null` la fa decorativa (`aria-hidden`). Serveix per quan al
 * costat ja hi ha el títol que diu el mateix: un lector de pantalla que llegeix
 * dues vegades seguides «Catalunya» no informa, entrebanca.
 */
export function catalunya(
  mida = 180,
  humor: keyof typeof BOQUES_CAT | string = "felic",
  etiqueta: string | null = "Catalunya, mascota de quivoto",
): string {
  const boca = BOQUES_CAT[humor] ?? BOQUES_CAT["felic"]!;
  // El retard de cada poble és el graó de 60 ms de «design/MOVIMENT.md», i va
  // escrit a l'atribut «style» com el de les icones: així el CSS no ha de
  // conèixer quants punts hi ha.
  const pobles = POBLES.map(
    ([x, y], i) =>
      `<circle cx="${x}" cy="${y}" r="2.6" fill="${CORAL}" style="--retard:${(0.18 + i * 0.06).toFixed(2)}s"/>`,
  ).join("");
  const accessible =
    etiqueta === null
      ? 'aria-hidden="true"'
      : `role="img" aria-label="${etiqueta.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;")}"`;
  return `<svg class="catalunya" width="${mida}" height="${mida}" viewBox="0 0 120 120" ${accessible}>
  <g class="terra">
    <path class="costa" d="${SILUETA}" fill="${MINT}" stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
    <g class="pobles">${pobles}</g>
    <g class="cara">
      <circle cx="40" cy="53" r="9" fill="${WHITE}" stroke="${INK}" stroke-width="3"/>
      <circle cx="62" cy="53" r="9" fill="${WHITE}" stroke="${INK}" stroke-width="3"/>
      <g class="pupilles"><circle cx="40" cy="54" r="4.2" fill="${INK}"/><circle cx="62" cy="54" r="4.2" fill="${INK}"/></g>
      <g class="parpelles">
        <circle cx="40" cy="53" r="9.6" fill="${WHITE}"/>
        <circle cx="62" cy="53" r="9.6" fill="${WHITE}"/>
      </g>
      ${boca}
    </g>
  </g>
</svg>`;
}
