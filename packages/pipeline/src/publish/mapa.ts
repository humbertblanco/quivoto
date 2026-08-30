import { readFileSync } from "node:fs";

/**
 * El mapa petit de la fitxa municipal: on és aquest poble, i res més.
 *
 * ─── Per què això s'ha reescrit ────────────────────────────────────────────
 *
 * Fins ara aquest mapa era un núvol de 947 cercles: un per municipi, pintats
 * de gris, amb una anella al que toca destacar. Mesurat amb els 300 px
 * d'amplada amb què el demana la fitxa, el dibuix pesava **67.906 bytes** de
 * mediana i anava repetit a cada una de les 947 fitxes: **64,3 MB** de
 * l'estàtic que es publica. I el que en treia el lector era poc: 947 taques
 * grises totes iguals on la que busca és la de sota l'anella.
 *
 * La geometria de veritat ja era al repositori —«geo/municipis.json», els
 * límits municipals de l'ICGC que fan servir el mapa dels 947— i porta dues
 * coses que aquí ho resolen: el **contorn** de Catalunya, que són 2.162
 * caràcters de camí, i el **polígon de cada municipi**, que en fa 58 de
 * mediana i 250 el més detallat. Amb aquestes dues el mapa de la fitxa passa
 * a ser una silueta amb el poble pintat a dins: **2.683 bytes** de mediana en
 * comptes de 67.906 —un 96,0 % menys— i **2,5 MB en comptes de 64,3** en el
 * conjunt dels 947, o sigui **61,8 MB d'estalvi**. Els 947 tenen polígon, o
 * sigui que l'estalvi el fan totes les fitxes i no unes quantes. I es
 * llegeix millor, perquè la forma que es veu és Catalunya i no un núvol de
 * punts.
 *
 * El núvol de punts no s'ha esborrat: continua sent el que es dibuixa quan el
 * municipi que s'ha de destacar no té geometria, i és el que fa que aquesta
 * peça continuï funcionant amb qualsevol llista de punts.
 *
 * ─── La projecció del núvol ────────────────────────────────────────────────
 *
 * Equirectangular amb la correcció del cosinus de la latitud: a l'alçada de
 * Catalunya un grau de longitud fa uns 74 km i un de latitud 111, i sense
 * corregir-ho el país surt estirat de costat. Amb la correcció, Catalunya fa
 * 2,26 graus corregits d'ample per 2,30 d'alt —quasi un quadrat, un 1,6 % més
 * alta que ampla—, que és exactament la proporció del llenç de 1600 × 1600
 * que porta la geometria de l'ICGC. Les dues maneres de dibuixar-la, doncs,
 * donen la mateixa forma.
 */

export type PuntMapa = {
  slug: string;
  nom: string;
  lat: number;
  lon: number;
  /** Color del punt. Si no se'n dona, el gris de fons. */
  color?: string;
  /** Mida relativa, típicament per població. */
  pes?: number;
};

export type OpcionsMapa = {
  amplada?: number;
  /** Municipi que s'ha de destacar per damunt de tots. */
  destacat?: string;
  /** Etiqueta per als lectors de pantalla. */
  descripcio?: string;
  /**
   * Dibuixa el núvol de 947 punts encara que el destacat tingui geometria.
   * Només per poder mesurar què costava abans; no ho fa servir cap fitxa.
   */
  nuvol?: boolean;
};

/**
 * Els límits municipals, tal com els deixa «tools/geo_repara_icgc.py».
 *
 * Viu aquí i no a «mapa-catalunya.ts» perquè aquest fitxer és la peça de sota:
 * el mapa gran en depèn i el petit també, i tenir-ne dues còpies voldria dir
 * llegir el fitxer de 81 kB dues vegades a cada publicació.
 */
export type Geometria = {
  font: string;
  fontUrl: string;
  llicencia: string;
  llicenciaUrl: string;
  actualitzat: string;
  viewBox: string;
  contorn: string | null;
  municipis: Record<string, string>;
};

export const geometria: Geometria = JSON.parse(
  readFileSync(new URL("./geo/municipis.json", import.meta.url), "utf8"),
) as Geometria;

/** Latitud central de Catalunya, per a la correcció de la projecció. */
const LAT_CENTRAL = 41.7;

export function projecta(
  punts: readonly PuntMapa[],
  amplada: number,
): { x: number; y: number; punt: PuntMapa }[] & { alcada?: number } {
  const k = Math.cos((LAT_CENTRAL * Math.PI) / 180);
  const xs = punts.map((p) => p.lon * k);
  const ys = punts.map((p) => -p.lat);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const escala = amplada / (maxX - minX || 1);
  return punts.map((punt, i) => ({
    punt,
    x: Math.round((xs[i]! - minX) * escala * 10) / 10,
    y: Math.round((ys[i]! - minY) * escala * 10) / 10,
  }));
}

/** Alçada del llenç per a una amplada donada, amb el mateix criteri. */
export function alcadaPer(punts: readonly PuntMapa[], amplada: number): number {
  const k = Math.cos((LAT_CENTRAL * Math.PI) / 180);
  const ampladaGraus = Math.max(...punts.map((p) => p.lon * k)) - Math.min(...punts.map((p) => p.lon * k));
  const alcadaGraus = Math.max(...punts.map((p) => p.lat)) - Math.min(...punts.map((p) => p.lat));
  return Math.round((amplada * alcadaGraus) / (ampladaGraus || 1));
}

const escape = (t: string): string =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * La capsa que ocupa un camí de la nostra geometria.
 *
 * No és un lector d'SVG de propòsit general i no ho ha de ser: els camins que
 * escriu «geo_repara_icgc.py» només fan servir M absoluta, l i h i v relatives
 * i Z —comprovat sobre els 947 i sobre el contorn—, que és el que surt de
 * simplificar polígons i arrodonir-ne els punts a l'enter. Si un dia la
 * geometria portés corbes, això les ignoraria i la capsa sortiria petita; per
 * això la funció torna null quan no ha llegit cap punt, i qui la crida ho
 * tracta com a «no en sé la posició».
 */
export function capsaCami(d: string): { x: number; y: number; ample: number; alt: number } | null {
  let x = 0;
  let y = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const marca = (): void => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  };
  const trossos = d.match(/[MmLlHhVvZz][^MmLlHhVvZz]*/g) ?? [];
  for (const tros of trossos) {
    const ordre = tros[0]!;
    const n = (tros.slice(1).match(/-?\d*\.?\d+/g) ?? []).map(Number);
    if (ordre === "M" || ordre === "L") {
      for (let i = 0; i + 1 < n.length; i += 2) {
        x = n[i]!;
        y = n[i + 1]!;
        marca();
      }
    } else if (ordre === "m" || ordre === "l") {
      for (let i = 0; i + 1 < n.length; i += 2) {
        x += n[i]!;
        y += n[i + 1]!;
        marca();
      }
    } else if (ordre === "H") {
      for (const v of n) {
        x = v;
        marca();
      }
    } else if (ordre === "h") {
      for (const v of n) {
        x += v;
        marca();
      }
    } else if (ordre === "V") {
      for (const v of n) {
        y = v;
        marca();
      }
    } else if (ordre === "v") {
      for (const v of n) {
        y += v;
        marca();
      }
    }
  }
  if (minX === Infinity) return null;
  return { x: minX, y: minY, ample: maxX - minX, alt: maxY - minY };
}

/**
 * La silueta de Catalunya amb un municipi pintat a dins.
 *
 * L'anella no és decoració: Puigdalber ocupa 4 × 6 unitats d'un llenç de 1600,
 * que a 300 px de pantalla és menys d'un píxel i mig. Sense un cercle que
 * digui on mirar, la meitat dels municipis de Catalunya serien invisibles al
 * seu propi mapa. El radi mínim de 42 unitats són 7,9 px a 300 px d'amplada,
 * que és el que es veu d'una ullada sense tapar mitja comarca.
 *
 * Els gruixos van en unitats del llenç i no en píxels perquè el dibuix
 * s'escala sencer: a 300 px, una unitat és 0,1875 px, i per això el contorn va
 * a 6 (1,1 px) i l'anella a 7 (1,3 px).
 */
export function renderSilueta(slug: string, opcions: OpcionsMapa = {}): string {
  const cami = geometria.municipis[slug];
  if (!cami || !geometria.contorn) return "";
  const capsa = capsaCami(cami);
  // El radi surt de la mitja diagonal de la capsa, no de l'amplada: un municipi
  // llarg i estret com Castellfollit de la Roca (9 × 3) ha de quedar dins de
  // l'anella pel costat llarg.
  const radi = capsa
    ? Math.max(42, Math.round(Math.hypot(capsa.ample, capsa.alt) / 2) + 14)
    : 0;
  const cx = capsa ? Math.round(capsa.x + capsa.ample / 2) : 0;
  const cy = capsa ? Math.round(capsa.y + capsa.alt / 2) : 0;
  /*
   * El punt de coral per als municipis que a la pantalla no arriben a res.
   *
   * Dels 947, la capsa mediana fa 36 x 43 unitats —a 300 px, uns 7 px de
   * costat— i es veu perfectament. Els petits no: Puigdalber fa 4 x 6, que és
   * mig píxel, i dins de l'anella no s'hi veia res. Quan la diagonal de la
   * capsa baixa de 40 unitats (7,5 px a 300 px d'amplada) s'hi posa un disc
   * perquè el poble hi sigui i no només hi sigui l'anella. Als altres no s'hi
   * posa, perquè taparia la forma de veritat, que és millor que un punt.
   */
  const menut = capsa !== null && Math.hypot(capsa.ample, capsa.alt) < 40;

  return `<svg class="mapa mapa-silueta" viewBox="${escape(geometria.viewBox)}" role="img"
     style="width:100%;height:auto;display:block"
     aria-label="${escape(opcions.descripcio ?? "Mapa de Catalunya")}">
  <path d="${geometria.contorn}" fill="var(--vora)" stroke="var(--ink)" stroke-width="6" stroke-linejoin="round"/>
  <path d="${cami}" fill="var(--coral)" stroke="var(--ink)" stroke-width="5" stroke-linejoin="round"/>
  ${menut ? `<circle cx="${cx}" cy="${cy}" r="15" fill="var(--coral)" stroke="var(--ink)" stroke-width="5"/>` : ""}
  ${capsa ? `<circle cx="${cx}" cy="${cy}" r="${radi}" fill="none" stroke="var(--ink)" stroke-width="7"/>` : ""}
</svg>`;
}

/**
 * SVG amb un punt per municipi. El destacat es dibuixa l'últim i amb anella,
 * perquè quedi per damunt encara que tingui veïns a sobre.
 *
 * És el mapa d'abans, i ara només surt quan del municipi destacat no en tenim
 * el polígon —o quan qui crida demana el núvol expressament, que ho fa la
 * prova que mesura l'estalvi.
 */
export function renderNuvol(punts: readonly PuntMapa[], opcions: OpcionsMapa = {}): string {
  if (punts.length === 0) return "";
  const amplada = opcions.amplada ?? 320;
  const marge = 6;
  const alcada = alcadaPer(punts, amplada);
  const projectats = projecta(punts, amplada - 2 * marge);

  const radi = (p: PuntMapa): number => {
    const pes = p.pes ?? 0;
    // Arrel quarta: amb l'àrea proporcional a la població, Barcelona taparia
    // mig país; així es nota qui és gran sense que s'ho mengi tot.
    return Math.max(1.4, Math.min(7, 1.4 + Math.pow(pes, 0.25) / 3.4));
  };

  const normals = projectats.filter((p) => p.punt.slug !== opcions.destacat);
  const destacat = projectats.find((p) => p.punt.slug === opcions.destacat);

  const cercle = (p: (typeof projectats)[number]): string =>
    `<circle cx="${p.x + marge}" cy="${p.y + marge}" r="${radi(p.punt)}" fill="${p.punt.color ?? "var(--vora)"}"/>`;

  return `<svg class="mapa" viewBox="0 0 ${amplada} ${alcada + 2 * marge}" role="img"
     aria-label="${escape(opcions.descripcio ?? `Mapa amb ${punts.length} municipis`)}">
  <g class="punts">${normals.map(cercle).join("")}</g>
  ${
    destacat
      ? `<g class="destacat">
      <circle cx="${destacat.x + marge}" cy="${destacat.y + marge}" r="${radi(destacat.punt) + 5}"
        fill="none" stroke="var(--ink)" stroke-width="2"/>
      <circle cx="${destacat.x + marge}" cy="${destacat.y + marge}" r="${Math.max(3, radi(destacat.punt))}"
        fill="var(--coral)" stroke="var(--ink)" stroke-width="1.5"/>
    </g>`
      : ""
  }
</svg>`;
}

/**
 * El mapa que va a la fitxa: la silueta quan es pot, i el núvol quan no.
 *
 * La signatura és la d'abans a posta —«radiografia.ts» la crida amb els 947
 * punts i el slug del municipi— perquè el canvi de dibuix no obligui a tocar
 * res del que la crida. Els punts continuen fent falta per al cas de reserva.
 */
export function renderMapa(punts: readonly PuntMapa[], opcions: OpcionsMapa = {}): string {
  if (!opcions.nuvol && opcions.destacat) {
    const silueta = renderSilueta(opcions.destacat, opcions);
    if (silueta) return silueta;
  }
  return renderNuvol(punts, opcions);
}
