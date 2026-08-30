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
 * poder saber a casa de qui és. La secció, en canvi, és la primera entrada del
 * menú.
 *
 * El menú és curt a propòsit: quatre destins i cap desplegable. Amb això s'hi
 * arriba a tot el que és una pàgina de debò, i el que no hi cap no hi ha de ser.
 *
 * La portada de l'Observatori hi va com a primera entrada i no com a etiqueta al
 * costat del logotip: escrita al costat semblava un rètol i no un enllaç, i el
 * primer destí del menú es deia «Els 947» quan la portada es diu «Els 947
 * municipis». Dues coses amb el mateix nom i només una clicable. Ara la portada
 * és «Observatori» i la taula filtrable és «La llista», que és el que és.
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

export type Destí = "portada" | "947" | "mapa" | "comparador" | "partits" | "dades" | "cap";

/**
 * Les descàrregues **no hi són**, i no és un oblit: qui es baixa 1.897 fitxers
 * de CSV no hi arriba per un menú, hi arriba perquè el busca, i el peu i la
 * portada l'hi porten. Un menú de consulta ha de dur als llocs on es mira una
 * cosa, no als llocs on se'n treu una còpia.
 */
const DESTINS: ReadonlyArray<{ clau: Destí; text: string; on: string }> = [
  { clau: "portada", text: "Observatori", on: "" },
  { clau: "947", text: "La llista", on: "els947.html" },
  { clau: "mapa", text: "Mapa", on: "mapa/" },
  { clau: "partits", text: "Partits", on: "partit/" },
  { clau: "comparador", text: "Comparador", on: "comparador/" },
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
  <nav class="menu" aria-label="Seccions de l'Observatori">${menu}</nav>
  <span class="ranura-cerca"></span>
  <span class="etiqueta">${escape(etiqueta)}</span>
</header>`;
}
