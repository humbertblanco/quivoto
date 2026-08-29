/**
 * Quina tinta va damunt del color d'un partit, i què fer quan cap no s'hi
 * llegeix.
 *
 * Fins ara ho decidia la fórmula YIQ (`0,299·R + 0,587·G + 0,114·B > 150`), que
 * és una regla de televisió analògica i no té res a veure amb el contrast que
 * mesura la norma. El resultat era que el turquesa de Junts (#00c3b2) rebia
 * tinta clara i les sigles hi quedaven a 2,08:1 —el mínim per a text petit és
 * 4,5:1—, i el mateix passava amb el verd de Vox, el taronja de Ciutadans i el
 * gris de les llistes locals. Aquí es calcula el contrast de debò i es tria la
 * tinta que en dona més; només si cap de les dues hi arriba es toca el color.
 *
 * Els colors dels partits són seus i no els volem canviar: `sobreColor()`
 * només s'usa allà on hi va text a sobre, i quan hi ha d'intervenir mou la
 * lluminositat el mínim imprescindible i deixa el to i la saturació igual. Per
 * a les mostres, els cercles de l'hemicicle i les franges de color —on no hi ha
 * cap text— es fa servir el color tal com ve.
 */

/** La tinta fosca i la clara de la casa. No n'hi ha cap altra. */
export const TINTA_FOSCA = "#1E1B2E";
export const TINTA_CLARA = "#FBF7EE";

/** El mínim de la norma per a text petit (WCAG 2.1, nivell AA). */
export const MINIM_TEXT = 4.5;

function aRgb(color: string): [number, number, number] | null {
  const hex = color.trim().replace("#", "");
  const complet = hex.length === 3 ? hex.replace(/./g, (c) => c + c) : hex;
  if (!/^[0-9a-f]{6}$/i.test(complet)) return null;
  return [0, 2, 4].map((i) => Number.parseInt(complet.slice(i, i + 2), 16)) as [number, number, number];
}

const aHex = (rgb: readonly number[]): string =>
  `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;

/** Lluminància relativa tal com la defineix la norma, no la mitjana ponderada. */
function lluminancia(rgb: readonly [number, number, number]): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** El contrast entre dos colors, de 1:1 a 21:1. Si un no es pot llegir, 1. */
export function contrast(a: string, b: string): number {
  const ra = aRgb(a);
  const rb = aRgb(b);
  if (!ra || !rb) return 1;
  const la = lluminancia(ra);
  const lb = lluminancia(rb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** La tinta de les dues que es llegeix millor damunt d'aquest color. */
export function tintaSobre(color: string): string {
  return contrast(color, TINTA_FOSCA) >= contrast(color, TINTA_CLARA) ? TINTA_FOSCA : TINTA_CLARA;
}

// --- conversió HSL, per moure la lluminositat sense tocar el to ------------

function aHsl(rgb: readonly [number, number, number]): [number, number, number] {
  const [r, g, b] = rgb.map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function deHsl([h, s, l]: readonly [number, number, number]): [number, number, number] {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const canal = (t: number): number => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [canal(h + 1 / 3) * 255, canal(h) * 255, canal(h - 1 / 3) * 255];
}

/**
 * El fons i la tinta per a escriure damunt del color d'una candidatura.
 *
 * Primer prova el color tal com ve amb la tinta que s'hi llegeix millor. Si
 * amb aquella ja hi arriba —i amb els colors de partit hi arriba gairebé
 * sempre— el retorna sense tocar-lo. Quan no (el gris blavós d'Independents de
 * Catalunya es queda a 4,04:1 amb totes dues tintes) mou la lluminositat en
 * passos d'un 1,5 % cap on el contrast creix, fins que el text s'hi llegeix.
 * És l'única manera de tenir la xifra llegible sense inventar-se un color nou.
 */
export function sobreColor(color: string, minim: number = MINIM_TEXT): { fons: string; tinta: string } {
  const rgb = aRgb(color);
  if (!rgb) return { fons: color, tinta: TINTA_FOSCA };
  const net = aHex(rgb);
  const tinta = tintaSobre(net);
  if (contrast(net, tinta) >= minim) return { fons: net, tinta };

  // Amb tinta fosca el fons ha d'aclarir-se; amb tinta clara, enfosquir-se.
  const cap = tinta === TINTA_FOSCA ? 1 : -1;
  const [h, s, l] = aHsl(rgb);
  for (let pas = 1; pas <= 67; pas += 1) {
    const nova = Math.max(0, Math.min(1, l + cap * pas * 0.015));
    const fons = aHex(deHsl([h, s, nova]));
    if (contrast(fons, tinta) >= minim) return { fons, tinta };
    if (nova === 0 || nova === 1) break;
  }
  // Un color que no arriba enlloc (no n'hi ha cap de real): blanc o negre.
  return { fons: cap === 1 ? "#ffffff" : "#000000", tinta };
}
