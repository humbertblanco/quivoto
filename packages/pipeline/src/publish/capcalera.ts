/**
 * La capçalera compartida: qui som, on ets, on pots anar i la casella per anar-hi.
 *
 * Cada pàgina de l'Observatori se n'escrivia una —un logotip i una etiqueta— i
 * el resultat és que des d'una fitxa de municipi no es pot arribar enlloc: ni al
 * mapa, ni al comparador, ni a un altre poble. La fitxa és una pantalla final
 * quan hauria de ser una parada. Dotze fitxers la copiaven amb dotze camins
 * relatius diferents i **cap no la feia servir**, tot i que aquest mòdul ja
 * existia.
 *
 * El logotip diu **quivoto**, que és el nom del web, i no «Observatori», que és
 * el nom d'una secció: qui arriba a la pàgina d'un regidor per un enllaç ha de
 * poder saber a casa de qui és. L'Observatori hi va al costat, com a rastre, i
 * porta a la seva portada.
 *
 * El menú és curt a propòsit: quatre destins i cap desplegable. Amb això s'hi
 * arriba a tot el que és una pàgina de debò, i el que no hi cap no hi ha de ser.
 *
 * ## `base`
 *
 * És el camí relatiu fins a `/observatori/` des de la pàgina que la demana, amb
 * la barra final. Va com a paràmetre i no calculat perquè les pàgines es poden
 * obrir des d'un fitxer local i no hi ha cap arrel de la qual penjar. La taula,
 * comprovada sobre el que hi ha publicat:
 *
 * | Pàgina                            | `base`          |
 * |-----------------------------------|-----------------|
 * | `observatori/` i `els947.html`    | `./`            |
 * | `mapa/`, `comparador/`, `dades/`, `amb/`, `preguntes/` | `../` |
 * | `c/<slug>/`, `m/<slug>/`, `preguntes/<slug>/`          | `../../` |
 * | `m/<slug>/<candidatura>/`, `preguntes/<slug>/prova/`   | `../../../` |
 * | `m/<slug>/regidor/<persona>/`     | `../../../../`  |
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

/**
 * L'arrel del web des d'una pàgina de l'Observatori: un nivell per sobre de
 * `base`. El logotip hi porta perquè quivoto és més que l'Observatori.
 */
const arrel = (base: string): string => (base === "./" ? "../" : `${base}../`);

export function capcalera(base: string, actual: Destí = "cap", etiqueta = "esborrany · dades obertes"): string {
  const menu = DESTINS.map((d) =>
    d.clau === actual
      ? `<span class="ara" aria-current="page">${escape(d.text)}</span>`
      : `<a href="${escape(base + d.on)}">${escape(d.text)}</a>`,
  ).join("");
  return `<header class="capcalera">
  <a class="logo" href="${escape(arrel(base))}">quivoto</a>
  ${
    actual === "portada"
      ? `<span class="seccio ara" aria-current="page">Observatori</span>`
      : `<a class="seccio" href="${escape(base)}">Observatori</a>`
  }
  <nav class="menu" aria-label="Seccions de l'Observatori">${menu}</nav>
  <span class="ranura-cerca"></span>
  <span class="etiqueta">${escape(etiqueta)}</span>
</header>`;
}
