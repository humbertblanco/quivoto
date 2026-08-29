/**
 * Mapes de Catalunya fets amb els 947 punts, sense cap fitxer de fronteres.
 *
 * No dibuixem cap contorn perquè no ens cal: amb els 947 municipis pintats, la
 * silueta de Catalunya surt sola, i qui hi busqui el seu poble el reconeixerà
 * per on és respecte dels veïns. Estalviem un GeoJSON de diversos megues, una
 * llicència que caldria comprovar i una dependència més.
 *
 * La projecció és equirectangular amb la correcció del cosinus de la latitud:
 * a l'alçada de Catalunya, un grau de longitud fa uns 74 km i un de latitud
 * 111, i sense corregir-ho el país surt estirat de costat.
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
};

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
  const maxY = Math.max(...ys);
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
 * SVG amb un punt per municipi. El destacat es dibuixa l'últim i amb anella,
 * perquè quedi per damunt encara que tingui veïns a sobre.
 */
export function renderMapa(punts: readonly PuntMapa[], opcions: OpcionsMapa = {}): string {
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
