/**
 * La capçalera compartida: on ets, on pots anar i la casella per anar-hi.
 *
 * Cada pàgina de l'Observatori escrivia la seva —un logotip i una etiqueta— i
 * el resultat és que des d'una fitxa de municipi no es pot arribar enlloc:
 * ni al mapa, ni al comparador, ni a un altre poble. La fitxa és una pantalla
 * final quan hauria de ser una parada.
 *
 * El menú és curt a propòsit: sis destins i cap desplegable. Amb això s'hi
 * arriba a tot el que és una pàgina de debò, i el que no hi cap no hi ha de
 * ser.
 *
 * `base` és el camí relatiu fins a `/observatori/` des de la pàgina que la
 * demana, amb la barra final: `./` per a la portada, `../../` per a una fitxa
 * de municipi. Va com a paràmetre i no calculat perquè les pàgines es poden
 * obrir des d'un fitxer local i no hi ha cap arrel de la qual penjar.
 */

export type Destí = "portada" | "947" | "mapa" | "comparador" | "dades" | "cap";

const DESTINS: ReadonlyArray<{ clau: Destí; text: string; on: string }> = [
  { clau: "947", text: "Els 947", on: "els947.html" },
  { clau: "mapa", text: "Mapa", on: "mapa/" },
  { clau: "comparador", text: "Comparador", on: "comparador/" },
  { clau: "dades", text: "Dades", on: "dades/" },
];

const escape = (t: string): string =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function capcalera(base: string, actual: Destí = "cap", etiqueta = "esborrany · dades obertes"): string {
  const menu = DESTINS.map((d) =>
    d.clau === actual
      ? `<span class="ara" aria-current="page">${escape(d.text)}</span>`
      : `<a href="${escape(base + d.on)}">${escape(d.text)}</a>`,
  ).join("");
  return `<header class="capcalera">
  <a class="logo" href="${escape(base)}">Observatori</a>
  <nav class="menu" aria-label="Seccions de l'Observatori">${menu}</nav>
  <span class="etiqueta">${escape(etiqueta)}</span>
</header>`;
}
