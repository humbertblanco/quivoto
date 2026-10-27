import { mkdir, writeFile } from "node:fs/promises";
import { clauCerca, classifica, qualitat, TIPUS } from "./cerca";
import { de, normalize, slugify } from "../lib/text";
import { CERCADOR_CSS, senseComentaris } from "./estil";
import { adrecaEns } from "./ens-tipus";

/**
 * La casella per anar a qualsevol lloc, a totes les pàgines.
 *
 * Vivia com una constant privada dins de `radiografia.ts` amb dos camins
 * relatius escrits a mà (`../../cerca.json` i `../` + slug), de manera que
 * només podia existir a les 947 fitxes de municipi: des del comparador, des
 * d'una comarca o des de la pàgina d'un regidor no hi havia manera d'anar a un
 * altre poble que no fos tornar enrere fins a la portada. Aquí és un mòdul, i
 * el que abans eren camins escrits a mà ara surten de `base`.
 *
 * ## Set menes de resultat, no una
 *
 * Trobava municipis i prou. L'Observatori publica 947 municipis, 43 comarques,
 * 2.626 candidatures i més de 9.000 fitxes de persona, i buscar-hi el nom del propi
 * regidor no tornava res: la pàgina existia i no hi havia manera d'arribar-hi
 * si no era pel poble. Ara hi són totes sis, cadascuna amb la seva fila, i la
 * setena són les 4.400 persones que han tingut l'alcaldia des del 1979 i avui
 * no seuen al ple: «roig castell» troba en Joan Roig Castell, alcalde
 * d'Alcanar del 2003 al 2023, amb el càrrec i els anys al costat del nom.
 *
 * La vuitena són els ens de per sobre de l'ajuntament: les quatre diputacions
 * i els consells comarcals. Van dins de `cerca.json` (són 44 files) i només
 * si l'índex les porta: un fitxer vell sense la clau `ens` continua servint,
 * simplement no les troba. L'adreça la deriva `adrecaEns()`, serialitzada com
 * les altres funcions, perquè l'enllaç vagi exactament al directori que
 * escriu el generador.
 *
 * ## El rànquing, i per què no n'hi ha prou amb «comença per»
 *
 * `puntuacio = qualitat * 8 + tipus`. La qualitat val 3 si la clau sencera
 * comença pel que s'ha escrit, 2 si hi comença una paraula interior —això és el
 * que fa que un cognom lligui: «riera» troba les 28 persones que el duen al mig
 * del nom, que sense el 2 quedarien totes per sota de qualsevol cosa— i 1 si
 * només hi és a dins. El tipus desempata entre
 * coses igual de ben trobades: municipi 5, alcaldia 4, comarca i partit 3,
 * candidatura 2, regidor 1, i qui va tenir l'alcaldia i ja no hi és, 0: amb
 * un cognom escrit a mitges, la gent d'avui surt abans que la de fa trenta
 * anys. Multiplicar la qualitat per 8 garanteix que cap tipus no passi mai al
 * davant d'una coincidència millor: qui escriu «sant» vol Sant Cugat abans que
 * un regidor que es digui Sant.
 *
 * **El desempat de debò és la població.** «marti» lliga uns 200 regidors amb la
 * mateixa puntuació, i el que decideix quins dotze es veuen és de quin poble
 * són: el de Barcelona surt i el d'Alins no. Sense això la llista sortiria en
 * l'ordre en què la base de dades va escriure les files, que no vol dir res.
 *
 * ## El que no fa, i per què
 *
 * **No hi ha cap control que no funcioni.** El botó el crea el guió: si no hi
 * ha JavaScript no hi ha botó, en comptes d'una lupa que no fa res. Per la
 * mateixa raó la finestra és un `dialog` de debò —el navegador ja hi posa el
 * focus, l'Esc i el fons— i no una capa reinventada.
 *
 * **No es baixa l'índex fins que no cal**, i quan cal es baixa en tres trossos.
 * Primer `cerca.json` (34 kB comprimits): els 947 municipis amb la seva
 * alcaldia, que és el que respon «i el meu poble?». Els electes —uns 130 kB—
 * vénen darrere sols, quan el primer ja ha arribat, perquè qui escriu «rubi»
 * no ha d'esperar nou mil regidors i 2.626 candidatures per veure el seu poble. I les
 * alcaldies d'abans —`cerca-alcaldies.json`, tantes files com regidors— vénen
 * darrere dels electes, perquè són la pregunta que menys gent fa.
 *
 * ## La normalització i el slug no es copien
 *
 * La funció que treu accents i article inicial existia per triplicat, i la del
 * guió estava **copiada a mà**: qualsevol canvi a `clauCerca()` la deixava
 * desincronitzada sense que res petés, i el símptoma hauria estat que un poble
 * deixa de trobar-se. Aquí es serialitzen les de debò amb `toString()`, que és
 * el mateix que ja fa `els947.ts` amb la seva.
 *
 * Amb els electes això deixa de ser higiene i passa a ser el que sosté les
 * adreces: el fitxer no porta el slug de cap regidor, el calcula el navegador
 * amb `slugify()`. Si la del guió divergís de la del generador, l'enllaç aniria
 * a un 404 —o, pitjor, a la fitxa d'una altra persona amb un nom semblant.
 *
 * ## Un cercador, dues sortides
 *
 * La landing (`tools/build_landing.py`) tenia el seu propi cercador: un altre
 * aspecte, sense fletxes ni accents ni alcaldies d'abans, i la seva capçalera
 * no tenia el botó. El propietari vol el mateix cercador a tot arreu, i la
 * manera de tenir-lo no és copiar-lo sinó que el guió, el full i el diàleg
 * surtin d'aquí en dues formes: incrustats a cada pàgina de l'Observatori,
 * com sempre, i escrits com a fitxers a `web/public/assets/` —`cercador.js`,
 * `cercador.css`, `cercador.html`— per a qui no passa pel generador. Les dues
 * formes són **la mateixa cadena**: `CERCADOR_JS` i `CERCADOR_CSS` no es
 * construeixen dos cops, i `cercador.test.ts` ho comprova.
 *
 * Perquè el mateix guió serveixi des de qualsevol lloc, el camí fins a
 * `/observatori/` ja no va escrit dins del guió: el porta el diàleg a
 * `data-base`, i el guió el llegeix. L'Observatori hi posa el camí relatiu del
 * seu nivell; la landing, `/observatori/` en absolut.
 */

/** El text de la casella quan és buida; la landing castellana en posa un altre. */
export const PLACEHOLDER_CERCA = "Un municipi, un alcalde, un regidor, un partit";

const escape = (t: string): string =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * El diàleg sol, sense guió. `base` és el camí fins a `/observatori/` amb la
 * barra final; la taula de bases per nivell és al capçal de `capcalera.ts`.
 */
export function dialegCercador(base: string, placeholder = PLACEHOLDER_CERCA): string {
  return `<dialog class="cercador" data-base="${escape(base)}" aria-label="Cerca un municipi, una persona, un partit o un bloc d'aquesta pàgina">
  <form method="dialog" class="cerca-cap">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5 L21 21"/></svg>
    <input type="search" id="cerca-camp" autocomplete="off" spellcheck="false"
           role="combobox" aria-expanded="false" aria-controls="cerca-llista" aria-autocomplete="list"
           placeholder="${escape(placeholder)}" aria-label="Cerca">
    <button value="tanca" class="cerca-tanca">Esc</button>
  </form>
  <div class="cerca-resultats" id="cerca-llista" role="listbox" aria-label="Resultats"></div>
</dialog>`;
}

/**
 * El guió, un sol cop per a tothom. Es construeix en carregar el mòdul perquè
 * la serialització de les funcions del generador (`toString()`) no es repeteixi
 * a cada pàgina, i perquè l'asset i l'incrustat siguin, literalment, la mateixa
 * cadena.
 */
export const CERCADOR_JS = `(function(){
  var dialeg = document.querySelector(".cercador");
  if (!dialeg || typeof dialeg.showModal !== "function") return;
  var camp = dialeg.querySelector("#cerca-camp");
  var caixa = dialeg.querySelector(".cerca-resultats");
  // El camí fins a /observatori/ el porta el diàleg, no el guió: així el mateix
  // fitxer serveix des d'una fitxa («../../») i des de la landing («/observatori/»).
  var BASE = dialeg.getAttribute("data-base") || "/observatori/";

  // El botó el posa el guió: sense ell seria un control que no fa res. Va a la
  // ranura que la capçalera li deixa, i si aquella pàgina encara no en té, al
  // final de la capçalera.
  var boto = document.createElement("button");
  boto.type = "button";
  boto.className = "obre-cerca";
  boto.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5 L21 21"/></svg><span>Cerca</span>';
  boto.setAttribute("aria-label", "Cerca un municipi, una persona o un bloc");
  var ranura = document.querySelector(".capcalera .ranura-cerca");
  var capcalera = document.querySelector(".capcalera");
  if (ranura) ranura.appendChild(boto);
  else if (capcalera) capcalera.appendChild(boto);

  // Les funcions del generador, serialitzades i no copiades: la normalització,
  // el slug, la preposició («d'Alcanar», «del Prat», «de l'Hospitalet») i **el
  // rànquing sencer**, que així es pot provar amb vitest en comptes de viure
  // dins d'una cadena que no mira ningú. «slugify» crida «normalize» i
  // «classifica» crida «qualitat» i «TIPUS»: per això tots hi són amb el seu nom.
  var clau = ${clauCerca.toString()};
  var normalize = ${normalize.toString()};
  var slugify = ${slugify.toString()};
  var de = ${de.toString()};
  var TIPUS = ${JSON.stringify(TIPUS)};
  var qualitat = ${qualitat.toString()};
  var classifica = ${classifica.toString()};
  var adrecaEns = ${adrecaEns.toString()};

  // Els blocs d'aquesta pàgina surten de l'índex, quan la pàgina en té.
  var blocs = [].map.call(document.querySelectorAll(".index a[href^='#']"), function(a){
    var t = a.textContent.trim();
    return { text: t, k: clau(t), on: a.getAttribute("href") };
  });

  var dades = null, electes = null, alcaldies = null;
  var baixant = false, baixantElectes = false, baixantAlcaldies = false;
  var comarques = [], tots = [];

  /**
   * La llista de candidats es fa **un sol cop**, quan arriben les dades, i no a
   * cada pulsació: són 9.400 files entre municipis, alcaldies, comarques,
   * partits, candidatures i regidors, i derivar-ne la clau a cada lletra
   * escrita serien 9.400 normalitzacions per tecla. Res d'això depèn del que
   * s'escriu; només la puntuació en depèn.
   */
  function refes(){
    tots = [];
    var i, n;
    for (i = 0; i < blocs.length; i++) {
      tots.push({ m: "Bloc", k: blocs[i].k, t: blocs[i].text, w: 0, i: i });
    }
    if (dades) {
      var m = dades.mun;
      for (i = 0, n = m.length; i < n; i++) {
        // La clau del municipi ja ve feta del generador; la de l'alcaldia no,
        // perquè el nom de la persona hi va tal com el publica la font.
        tots.push({ m: "Municipi", k: m[i].k, t: m[i].n, w: m[i].h, i: i });
        if (m[i].a) tots.push({ m: "Alcaldia", k: clau(m[i].a), t: m[i].a, w: m[i].h, i: i });
      }
      comarques = [];
      var perComarca = {};
      for (i = 0, n = m.length; i < n; i++) {
        if (!m[i].c) continue;
        var e = perComarca[m[i].c];
        if (!e) {
          e = perComarca[m[i].c] = { nom: m[i].c, quants: 0, pes: 0 };
          comarques.push(e);
        }
        e.quants += 1;
        e.pes += m[i].h;
      }
      for (i = 0; i < comarques.length; i++) {
        tots.push({ m: "Comarca", k: clau(comarques[i].nom), t: comarques[i].nom,
                    w: comarques[i].pes, i: i });
      }
      // Un partit es busca pel nom sencer i per la sigla curta, i per això hi
      // entra dues vegades: «Esquerra Republicana de Catalunya» no conté «erc»
      // enlloc, i ningú no n'escriu el nom sencer.
      for (i = 0; i < dades.par.length; i++) {
        tots.push({ m: "Partit", k: clau(dades.par[i][0]), t: dades.par[i][0], w: dades.par[i][3], i: i });
        tots.push({ m: "Partit", k: clau(dades.par[i][1]), t: dades.par[i][0], w: dades.par[i][3], i: i });
      }
      // Les diputacions i els consells, si l'índex en porta: un cerca.json
      // d'abans no té la clau i la cerca ha de continuar igual.
      if (dades.ens) {
        for (i = 0; i < dades.ens.length; i++) {
          tots.push({ m: "Ens", k: clau(dades.ens[i][0]), t: dades.ens[i][0], w: dades.ens[i][3], i: i });
        }
      }
      if (electes) {
        for (i = 0, n = electes.cand.length; i < n; i++) {
          var sigles = electes.sig[electes.cand[i][0]];
          tots.push({ m: "Candidatura", k: clau(sigles), t: sigles,
                      w: m[electes.cand[i][1]].h, i: i });
        }
        for (i = 0, n = electes.reg.length; i < n; i++) {
          tots.push({ m: "Regidor", k: clau(electes.reg[i][0]), t: electes.reg[i][0],
                      w: m[electes.reg[i][1]].h, i: i });
        }
      }
      if (alcaldies) {
        for (i = 0, n = alcaldies.alc.length; i < n; i++) {
          tots.push({ m: "Exalcaldia", k: clau(alcaldies.alc[i][0]), t: alcaldies.alc[i][0],
                      w: m[alcaldies.alc[i][1]].h, i: i });
        }
      }
    }
  }

  function baixa(){
    if (dades || baixant) return;
    baixant = true;
    fetch(BASE + "cerca.json").then(function(r){ return r.json(); }).then(function(d){
      dades = d; baixant = false; refes(); pinta(); baixaElectes();
    }).catch(function(){ baixant = false; dades = { sig: [], mun: [], par: [] }; refes(); pinta(); });
  }

  function baixaElectes(){
    if (electes || baixantElectes) return;
    baixantElectes = true;
    fetch(BASE + "cerca-electes.json").then(function(r){ return r.json(); }).then(function(d){
      electes = d;
      refes();
      // Només es repinta si qui busca no ha triat res encara: canviar-li la
      // llista sota els dits mentre baixa amb les fletxes seria pitjor que
      // esperar-se a la pulsació següent.
      if (tria <= 0) pinta();
      baixaAlcaldies();
    }).catch(function(){ /* sense electes la cerca continua fent la seva feina */ baixaAlcaldies(); });
  }

  // El tercer fitxer, darrere del segon: qui ha tingut l'alcaldia i avui no
  // seu al ple. Va últim perquè és la pregunta que menys gent fa.
  function baixaAlcaldies(){
    if (alcaldies || baixantAlcaldies) return;
    baixantAlcaldies = true;
    fetch(BASE + "cerca-alcaldies.json").then(function(r){ return r.json(); }).then(function(d){
      alcaldies = d;
      refes();
      if (tria <= 0) pinta();
    }).catch(function(){ /* sense les alcaldies d'abans, la cerca continua */ });
  }

  // Els noms venen de dades obertes i no d'aquí: escapar-los és el que impedeix
  // que un nom amb un signe rar es converteixi en marques dins de la llista.
  function net(t){
    return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /** D'un candidat a la fila que es veu: mena, títol, context i on va. */
  function fila(f){
    var m;
    if (f.m === "Bloc") {
      return { mena: "Bloc", text: f.t, sub: "en aquesta pàgina", on: blocs[f.i].on };
    }
    if (f.m === "Municipi") {
      m = dades.mun[f.i];
      return { mena: "Municipi", text: m.n, on: BASE + "m/" + m.s + "/",
               sub: m.c + " · " + m.h.toLocaleString("ca-ES") + " habitants" };
    }
    if (f.m === "Alcaldia") {
      m = dades.mun[f.i];
      // El camí de la fitxa de la persona el porta l'índex d'electes, decidit
      // per la mateixa regla que la llista dels 947; si no en té cap de
      // regidor, l'índex d'alcaldies li sap la pàgina d'alcaldia. Mentre no
      // han arribat, o quan l'alcaldia no té pàgina, es va a l'apartat
      // d'alcaldies del seu municipi, que és on hi ha el que en sabem.
      var propia = (electes && electes.alc[f.i]) || (alcaldies && alcaldies.act[f.i]) || null;
      return { mena: "Alcaldia", text: m.a,
               sub: "alcaldia " + de(m.n) + (m.g === null ? "" : " · " + dades.sig[m.g]),
               on: BASE + "m/" + m.s + "/" + (propia || "#alcaldies") };
    }
    if (f.m === "Comarca") {
      var c = comarques[f.i];
      return { mena: "Comarca", text: c.nom,
               sub: c.quants + (c.quants === 1 ? " municipi" : " municipis"),
               on: BASE + "c/" + slugify(c.nom) + "/" };
    }
    if (f.m === "Partit") {
      var p = dades.par[f.i];
      // El dia que hi hagi pàgina per marca, aquest camí ha de ser el seu. Avui
      // el mapa de forces és l'única pàgina que respon «on mana aquesta gent»,
      // que és el que busca qui escriu «ERC», i enviar a una adreça que encara
      // no existeix seria pitjor que enviar a una que en diu una part.
      // Les fitxes de partit les escriu partit.ts a /observatori/partit/<id>/.
      // Quan es va escriure aquest guió encara no existien i els resultats de
      // partit anaven a parar al mapa de forces, que era el més semblant.
      return { mena: "Partit", text: p[0],
               sub: p[2] + (p[2] === 1 ? " alcaldia" : " alcaldies"),
               on: BASE + "partit/" + p[1] + "/" };
    }
    if (f.m === "Ens") {
      var en = dades.ens[f.i];
      return { mena: en[1] === "diputacio" ? "Diputació" : "Consell", text: en[0],
               sub: en[4] + (en[4] === 1 ? " municipi" : " municipis"),
               on: BASE + adrecaEns(en[1], en[2]) };
    }
    if (f.m === "Candidatura") {
      var cc = electes.cand[f.i];
      m = dades.mun[cc[1]];
      var sigles = electes.sig[cc[0]];
      return { mena: "Candidatura", text: sigles, sub: m.n,
               on: BASE + "m/" + m.s + "/" + (electes.exc[f.i] || slugify(sigles)) + "/" };
    }
    if (f.m === "Exalcaldia") {
      var x = alcaldies.alc[f.i];
      m = dades.mun[x[1]];
      // «alcalde», «alcaldessa» o, quan cap font ho diu, «a l'alcaldia»: la
      // mateixa regla que el títol de la seva fitxa. Els anys i les sigles del
      // mandat més recent vénen escrits de l'índex.
      var carrec = x[4] === 2 ? "alcaldessa " : x[4] === 1 ? "alcalde " : "a l'alcaldia ";
      return { mena: "Alcaldia", text: x[0],
               sub: carrec + de(m.n) + " · " + x[2] + (x[3] < 0 ? "" : " · " + alcaldies.sig[x[3]]),
               on: BASE + "m/" + m.s + "/" + (alcaldies.exa[f.i] || "alcaldia/" + slugify(x[0]) + "/") };
    }
    var r = electes.reg[f.i];
    m = dades.mun[r[1]];
    return { mena: "Regidor", text: r[0],
             sub: m.n + (r[2] < 0 ? "" : " · " + electes.sig[r[2]]),
             on: BASE + "m/" + m.s + "/regidor/" + (electes.exr[f.i] || slugify(r[0])) + "/" };
  }

  var tria = -1, files = [];
  function pinta(){
    var q = clau(camp.value);
    files = q.length > 0 ? classifica(q, tots, 12).map(fila) : [];
    tria = files.length > 0 ? 0 : -1;
    camp.setAttribute("aria-expanded", files.length > 0 ? "true" : "false");
    if (q.length === 0) {
      caixa.innerHTML = "<p class=\\"cerca-buit\\">Escriu el nom d'un poble, d'una persona del ple, d'un alcalde d'ara o d'abans, o d'un partit; o una paraula per trobar-la en aquesta pàgina.</p>";
      camp.removeAttribute("aria-activedescendant");
      return;
    }
    if (files.length === 0) {
      caixa.innerHTML = '<p class="cerca-buit">' + (dades === null ? "Carregant els 947 municipis…" : "Cap resultat.") + '</p>';
      camp.removeAttribute("aria-activedescendant");
      return;
    }
    caixa.innerHTML = files.map(function(f, i){
      return '<a class="cerca-fila' + (i === 0 ? " tria" : "") + '" role="option" id="cerca-op-' + i +
        '" aria-selected="' + (i === 0 ? "true" : "false") + '" href="' + f.on + '">' +
        '<span class="mena">' + net(f.mena) + '</span>' +
        '<span class="qui"><b>' + net(f.text) + '</b><span>' + net(f.sub) + '</span></span></a>';
    }).join("");
    camp.setAttribute("aria-activedescendant", "cerca-op-0");
  }
  function mou(d){
    var nodes = caixa.querySelectorAll(".cerca-fila");
    if (!nodes.length) return;
    if (nodes[tria]) { nodes[tria].classList.remove("tria"); nodes[tria].setAttribute("aria-selected", "false"); }
    tria = (tria + d + nodes.length) % nodes.length;
    nodes[tria].classList.add("tria");
    nodes[tria].setAttribute("aria-selected", "true");
    camp.setAttribute("aria-activedescendant", nodes[tria].id);
    nodes[tria].scrollIntoView({ block: "nearest" });
  }

  /**
   * Obre el diàleg, buit o amb un text ja escrit: el que s'ha teclejat a una
   * casella de fora o el que porta l'adreça a «?q=». El cursor va al final,
   * que és on continua escrivint qui ja havia començat.
   */
  function obre(text){
    if (!dialeg.open) dialeg.showModal();
    camp.value = typeof text === "string" ? text : "";
    pinta(); baixa(); camp.focus();
    if (camp.value && camp.setSelectionRange) camp.setSelectionRange(camp.value.length, camp.value.length);
  }
  boto.addEventListener("click", obre);
  // Les caselles que una pàgina posa al seu contingut —la landing en té una de
  // gran al primer bloc— són camps de debò dins d'un formulari: sense guió
  // porten a la portada de l'Observatori amb «?q=» i el que s'hi ha escrit;
  // amb guió, el primer clic o la primera lletra obren el diàleg amb aquest
  // text. No s'obre en rebre el focus perquè, en tancar el diàleg, el focus hi
  // torna i el tornaria a obrir.
  // El guió va just després de la capçalera, abans que el contingut de la
  // pàgina existeixi: les caselles i els botons propis es lliguen quan el
  // document ja és sencer, o tots els de dins del <main> es quedarien amagats.
  function lligaPropis(){
    var camps = document.querySelectorAll("[data-cerca-camp]");
    for (var c = 0; c < camps.length; c++) {
      (function(extern){
        extern.addEventListener("click", function(){ obre(extern.value); });
        extern.addEventListener("input", function(){ obre(extern.value); });
        if (extern.form) extern.form.addEventListener("submit", function(e){ e.preventDefault(); obre(extern.value); });
      })(camps[c]);
    }
    // Els botons que una pàgina posa dins del seu contingut —la portada en té
    // un a la targeta de la fitxa: «Escriu el nom del teu poble»— neixen amb
    // «hidden» i s'ensenyen aquí, per la mateixa regla que el de dalt: sense
    // guió no hi ha cap control que no faci res.
    var propis = document.querySelectorAll("[data-obre-cerca]");
    for (var p = 0; p < propis.length; p++) {
      propis[p].hidden = false;
      propis[p].addEventListener("click", obre);
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", lligaPropis);
  else lligaPropis();
  camp.addEventListener("input", pinta);
  dialeg.addEventListener("keydown", function(e){
    if (e.key === "ArrowDown") { e.preventDefault(); mou(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); mou(-1); }
    else if (e.key === "Enter") {
      var n = caixa.querySelectorAll(".cerca-fila")[tria];
      if (n) { e.preventDefault(); window.location.href = n.getAttribute("href"); }
    }
  });
  // La barra inclinada obre la cerca, com a tot arreu; no si s'està escrivint.
  document.addEventListener("keydown", function(e){
    var dins = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || "");
    if (!dialeg.open && !dins && (e.key === "/" || (e.key === "k" && (e.metaKey || e.ctrlKey)))) {
      e.preventDefault(); obre();
    }
  });
  // Qui arriba amb «?q=» a l'adreça ve del formulari d'una pàgina sense guió:
  // se li obre el diàleg amb el que hi havia escrit, com si l'hagués obert aquí.
  var q = window.location && /[?&]q=([^&]*)/.exec(window.location.search || "");
  if (q && q[1]) {
    try { obre(decodeURIComponent(q[1].replace(/\\+/g, " "))); } catch (err) { /* una adreça mal escrita no és cosa nostra */ }
  }
})();`;

/**
 * El diàleg i el seu guió, incrustats: el que posen les pàgines de l'Observatori.
 */
export function cercador(base: string): string {
  return `
${dialegCercador(base)}
<script>
${CERCADOR_JS}
</script>`;
}

/**
 * Les tres peces del cercador com a fitxers, per a les pàgines que no fa el
 * generador: la landing de quivoto i el que vingui. `dir` és `web/public/assets/`
 * amb la barra final. El diàleg va amb la base absoluta perquè des de la
 * landing els índexs viuen a `/observatori/`; el guió i el full són les
 * mateixes constants que s'incrusten, amb una ratlla al davant que diu d'on
 * surten perquè ningú no els editi a mà.
 */
export async function escriuCercadorCompartit(dir: string): Promise<void> {
  const avis = "generat per packages/pipeline/src/publish/cercador.ts: no editar a mà";
  await mkdir(dir, { recursive: true });
  await Promise.all([
    writeFile(`${dir}cercador.js`, `/* ${avis} */\n${CERCADOR_JS}\n`, "utf8"),
    writeFile(`${dir}cercador.css`, `/* ${avis} */\n${senseComentaris(CERCADOR_CSS).trim()}\n`, "utf8"),
    writeFile(`${dir}cercador.html`, `<!-- ${avis} -->\n${dialegCercador("/observatori/")}\n`, "utf8"),
  ]);
}
