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
 * El menú és curt a propòsit: vuit destins i cap desplegable (el full del mòbil,
 * més avall, és el mateix menú plegat, no un segon nivell). Amb això s'hi
 * arriba a tot el que és una pàgina de debò, i el que no hi cap no hi ha de ser.
 *
 * La portada de l'Observatori hi va com a primera entrada i no com a etiqueta al
 * costat del logotip: escrita al costat semblava un rètol i no un enllaç.
 *
 * La taula filtrable es va dir «La llista» una temporada, perquè la portada es
 * deia «Els 947 municipis» i dues coses amb el mateix nom i només una clicable
 * confonien. Ara la portada es diu «Observatori municipal» i el nom «Els 947»
 * torna a la taula, que és la pàgina que la gent en diu així: al peu, a la
 * portada i aquí es diu igual, i «La llista» no deia de què.
 *
 * «Comarques» és la sisena entrada, i és nova per una raó concreta: hi havia 43
 * pàgines de comarca i la de l'Àrea Metropolitana i **cap índex**. El peu i la
 * portada enviaven al Barcelonès i prou, com si fos l'única, i a la resta només
 * s'hi arribava pel cercador o des d'una fitxa. La capçalera ja fa embolcallar
 * la fila quan no hi cap, així que sis hi caben igual que cinc.
 *
 * ## Al mòbil, un botó «Menú»
 *
 * Embolcallar la fila tenia un preu que al telèfon es pagava a cada pàgina: a
 * 360 px la capçalera feia **180 px** —el logotip i la casella a dalt, i els
 * vuit enllaços en dues files de 44 px a sota—, i sota encara hi venien el rètol
 * i el títol. Una quarta part de la primera pantalla per a una cosa que la gent
 * no ha vingut a llegir.
 *
 * Hi havia dues sortides: una sola fila d'enllaços que llisqui de costat, o un
 * botó «Menú» que obri un full. Hem triat el botó perquè és la més accessible:
 *
 * - **És un patró que els lectors de pantalla ja coneixen.** Un `<button>` amb
 *   `aria-expanded` i `aria-controls` es llegeix «Menú, botó, replegat» i diu
 *   què passarà en prémer-lo. Una fila que llisca no avisa de res: qui no hi
 *   veu no sap que n'hi ha més a la dreta, i qui hi veu poc tampoc, perquè la
 *   vora esvaïda és justament el que no es distingeix.
 * - **El full és una llista vertical.** Cada enllaç fa 48 px d'alt i tota
 *   l'amplada, i amb el text ampliat al 200 % la llista creix cap avall com la
 *   resta de la pàgina, en comptes de demanar desplaçament en dues direccions.
 * - **La fila que llisca no cabia d'una peça.** Al costat del logotip i de la
 *   casella, a 360 px n'hi caben dues entrades i mitja: hauria estat una
 *   segona fila igualment, i l'apartat on ets podia quedar fora de la vista.
 *
 * El botó el posa un guió petit que va enganxat a la capçalera (`PLEC_JS`), com
 * el de la casella de cerca: **sense JavaScript no hi ha botó** i el menú es
 * queda tal com era, embolcallat en dues files, amb tots els enllaços a la
 * vista. Va en línia i just després de la capçalera, i no al final de la
 * pàgina, perquè s'executi abans que el navegador pinti res: si arribés tard,
 * el menú es veuria obert un instant i la pàgina saltaria cap amunt en plegar-se.
 *
 * Amb el full obert, l'**Esc** el tanca i torna el focus al botó; un clic fora
 * del menú, o un Tab que en surti, també el tanca, perquè un full que tapa la
 * pàgina no pot quedar-se obert damunt del lloc on és el focus. A l'escriptori
 * (més de 720 px) el botó no hi és i el menú és el de sempre.
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

export type Destí = "portada" | "947" | "mapa" | "comarques" | "comparador" | "partits" | "dades" | "trajectoria" | "ranquings" | "cap";

/**
 * Les descàrregues **no hi són**, i no és un oblit: qui es baixa 1.897 fitxers
 * de CSV no hi arriba per un menú, hi arriba perquè el busca, i el peu i la
 * portada l'hi porten. Un menú de consulta ha de dur als llocs on es mira una
 * cosa, no als llocs on se'n treu una còpia.
 */
const DESTINS: ReadonlyArray<{ clau: Destí; text: string; on: string }> = [
  { clau: "portada", text: "Observatori", on: "" },
  { clau: "947", text: "Els 947", on: "els947.html" },
  { clau: "mapa", text: "Mapa", on: "mapa/" },
  { clau: "ranquings", text: "Rànquings", on: "ranquings/" },
  { clau: "comarques", text: "Comarques", on: "c/" },
  { clau: "partits", text: "Partits", on: "partit/" },
  { clau: "trajectoria", text: "Trajectòries", on: "trajectoria/" },
  { clau: "comparador", text: "Comparador", on: "comparador/" },
];

const escape = (t: string): string =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * L'arrel del web des d'una pàgina de l'Observatori: un nivell per sobre de
 * `base`. El logotip hi porta perquè quivoto és més que l'Observatori.
 */
const arrel = (base: string): string => (base === "./" ? "../" : `${base}../`);

/**
 * Les tipografies de la marca, enllaçades des de cada pàgina.
 *
 * `estil.ts` declara `--display:"Gabarito"` i `--text:"Nunito Sans"` des del
 * primer dia, però cap pàgina de l'Observatori enllaçava `/assets/fonts.css`:
 * tot es veia amb la font del sistema i només les imatges socials portaven la
 * marca de debò. El full és el mateix que fa servir la landing, amb rutes
 * absolutes a `/assets/fonts/`, així que serveix des de qualsevol profunditat;
 * el que canvia és el camí fins al full, que surt de `base` com el logotip.
 *
 * Es pre-carrega només el fitxer llatí de Gabarito, que és el que pinta els
 * titulars: és el text que es veu primer i el que més canvia de mida quan la
 * tipografia arriba tard.
 */
export function tipografia(base: string): string {
  const a = escape(arrel(base));
  return `<link rel="preload" as="font" type="font/woff2" crossorigin href="${a}assets/fonts/QGYtz_0dZAGKJJ4t3HtoW4XGnfBI.woff2">
<link rel="stylesheet" href="${a}assets/fonts.css">`;
}

/**
 * El guió del botó «Menú», que va en línia just després de la capçalera.
 *
 * Fa quatre coses i prou: crea el botó, el posa davant del menú (perquè l'ordre
 * del Tab sigui el que es veu: logotip, Menú, els enllaços del full, Cerca),
 * marca la capçalera amb `amb-plec` —que és el que fa que el CSS plegui el menú
 * al mòbil— i obre i tanca el full. Tota la presentació és a `estil.ts`; aquí no
 * hi ha cap mida ni cap amplada, i per això el botó no fa res a l'escriptori,
 * on el CSS l'amaga.
 *
 * La capçalera la troba com el germà d'abans del mateix `<script>`, i no amb
 * `querySelector`, perquè quan s'executa la resta de la pàgina encara no
 * existeix i així no depèn de quantes capçaleres hi hagi.
 *
 * Porta `id` perquè les proves que busquen el `<script>` pelat d'una pàgina
 * (el del comparador, el dels rànquings) no l'agafin per un altre.
 */
const PLEC_JS = `(function () {
  var cap = document.currentScript && document.currentScript.previousElementSibling;
  if (!cap || !cap.classList.contains("capcalera")) return;
  var menu = cap.querySelector(".menu");
  if (!menu) return;
  var boto = document.createElement("button");
  boto.type = "button";
  boto.className = "obre-menu";
  boto.textContent = "Menú";
  boto.setAttribute("aria-expanded", "false");
  boto.setAttribute("aria-controls", menu.id);
  cap.insertBefore(boto, menu);
  cap.classList.add("amb-plec");
  function obert() { return boto.getAttribute("aria-expanded") === "true"; }
  function posa(si) {
    boto.setAttribute("aria-expanded", si ? "true" : "false");
    cap.classList.toggle("obert", si);
  }
  boto.addEventListener("click", function () { posa(!obert()); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && obert()) { posa(false); boto.focus(); }
  });
  document.addEventListener("click", function (e) {
    if (obert() && !menu.contains(e.target) && !boto.contains(e.target)) posa(false);
  });
  cap.addEventListener("focusout", function (e) {
    if (obert() && e.relatedTarget && !menu.contains(e.relatedTarget) && e.relatedTarget !== boto) posa(false);
  });
})();`;

/**
 * L'etiqueta va en minúscula a les crides («càrrec electe», «esborrany») i es
 * pintava en majúscules espaiades. Ara que el CSS ja no ho fa, la primera lletra
 * la posa aquí: una etiqueta d'estat comença amb majúscula, com una frase.
 */
const majusculaInicial = (t: string): string => t.charAt(0).toLocaleUpperCase("ca") + t.slice(1);

export function capcalera(base: string, actual: Destí = "cap", etiqueta = "esborrany · dades obertes"): string {
  const menu = DESTINS.map((d) =>
    d.clau === actual
      ? `<span class="ara" aria-current="page">${escape(d.text)}</span>`
      : `<a href="${escape(base + d.on)}">${escape(d.text)}</a>`,
  ).join("");
  return `<header class="capcalera">
  <a class="logo" href="${escape(arrel(base))}">quivoto</a>
  <nav class="menu" id="menu-seccions" aria-label="Seccions de l'Observatori">${menu}</nav>
  <span class="ranura-cerca"></span>
  <span class="etiqueta">${escape(majusculaInicial(etiqueta))}</span>
</header>
<script id="capcalera-menu">${PLEC_JS}</script>`;
}
