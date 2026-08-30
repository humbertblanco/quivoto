import { clauCerca } from "./cerca";

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
 * ## El que no fa, i per què
 *
 * **No hi ha cap control que no funcioni.** El botó el crea el guió: si no hi
 * ha JavaScript no hi ha botó, en comptes d'una lupa que no fa res. Per la
 * mateixa raó la finestra és un `dialog` de debò —el navegador ja hi posa el
 * focus, l'Esc i el fons— i no una capa reinventada.
 *
 * **No es baixa l'índex fins que no cal.** Són 78 kB que no ha de pagar qui
 * només ve a llegir una fitxa: es demanen la primera vegada que s'obre la
 * casella, i el navegador ja se'ls guarda per a la resta de la visita.
 *
 * ## La normalització no es copia
 *
 * La funció que treu accents i article inicial existia per triplicat, i la del
 * guió estava **copiada a mà**: qualsevol canvi a `clauCerca()` la deixava
 * desincronitzada sense que res petés, i el símptoma hauria estat que un poble
 * deixa de trobar-se. Aquí es serialitza la de debò amb `toString()`, que és el
 * mateix que ja fa `els947.ts` amb la seva.
 */

/**
 * El diàleg i el seu guió. `base` és el camí fins a `/observatori/` amb la
 * barra final; la taula de bases per nivell és al capçal de `capcalera.ts`.
 */
export function cercador(base: string): string {
  return `
<dialog class="cercador" aria-label="Cerca un municipi o un bloc d'aquesta pàgina">
  <form method="dialog" class="cerca-cap">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5 L21 21"/></svg>
    <input type="search" id="cerca-camp" autocomplete="off" spellcheck="false"
           role="combobox" aria-expanded="false" aria-controls="cerca-llista" aria-autocomplete="list"
           placeholder="Un municipi, o què busques en aquesta pàgina" aria-label="Cerca">
    <button value="tanca" class="cerca-tanca">Esc</button>
  </form>
  <div class="cerca-resultats" id="cerca-llista" role="listbox" aria-label="Resultats"></div>
</dialog>
<script>
(function(){
  var dialeg = document.querySelector(".cercador");
  if (!dialeg || typeof dialeg.showModal !== "function") return;
  var camp = dialeg.querySelector("#cerca-camp");
  var caixa = dialeg.querySelector(".cerca-resultats");
  var BASE = ${JSON.stringify(base)};

  // El botó el posa el guió: sense ell seria un control que no fa res. Va a la
  // ranura que la capçalera li deixa, i si aquella pàgina encara no en té, al
  // final de la capçalera.
  var boto = document.createElement("button");
  boto.type = "button";
  boto.className = "obre-cerca";
  boto.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5 L21 21"/></svg><span>Cerca</span>';
  boto.setAttribute("aria-label", "Cerca un municipi o un bloc");
  var ranura = document.querySelector(".capcalera .ranura-cerca");
  var capcalera = document.querySelector(".capcalera");
  if (ranura) ranura.appendChild(boto);
  else if (capcalera) capcalera.appendChild(boto);

  // Els blocs d'aquesta pàgina surten de l'índex, quan la pàgina en té.
  var blocs = [].map.call(document.querySelectorAll(".index a[href^='#']"), function(a){
    return { text: a.textContent.trim(), on: a.getAttribute("href") };
  });

  var municipis = null, baixant = false;
  var clau = ${clauCerca.toString()};
  function baixa(){
    if (municipis || baixant) return;
    baixant = true;
    fetch(BASE + "cerca.json").then(function(r){ return r.json(); }).then(function(d){
      municipis = d; baixant = false; pinta();
    }).catch(function(){ baixant = false; municipis = []; pinta(); });
  }

  // Els noms venen de dades obertes i no d'aquí: escapar-los és el que impedeix
  // que un nom amb un signe rar es converteixi en marques dins de la llista.
  function net(t){
    return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  var tria = -1, files = [];
  function pinta(){
    var q = clau(camp.value);
    files = [];
    if (q.length > 0) {
      blocs.forEach(function(b){
        if (clau(b.text).indexOf(q) !== -1) files.push({ mena: "Bloc", text: b.text, on: b.on, sub: "en aquesta pàgina" });
      });
      if (municipis) {
        // Primer els que comencen pel que s'ha escrit i després els que el duen
        // a dins: qui escriu «sant» busca Sant Cugat abans que Vilassar.
        for (var i = 0; i < municipis.length && files.length < 12; i++) {
          var m = municipis[i];
          if (m.k.indexOf(q) === 0) files.push({ mena: "Municipi", text: m.n, on: BASE + "m/" + m.s + "/", sub: m.c + " · " + m.h.toLocaleString("ca-ES") + " habitants" });
        }
        for (var j = 0; j < municipis.length && files.length < 12; j++) {
          var n = municipis[j];
          if (n.k.indexOf(q) > 0) files.push({ mena: "Municipi", text: n.n, on: BASE + "m/" + n.s + "/", sub: n.c + " · " + n.h.toLocaleString("ca-ES") + " habitants" });
        }
      }
    }
    tria = files.length > 0 ? 0 : -1;
    camp.setAttribute("aria-expanded", files.length > 0 ? "true" : "false");
    if (q.length === 0) {
      caixa.innerHTML = "<p class=\\"cerca-buit\\">Escriu el nom d'un poble per anar-hi, o una paraula per trobar-la en aquesta pàgina.</p>";
      camp.removeAttribute("aria-activedescendant");
      return;
    }
    if (files.length === 0) {
      caixa.innerHTML = '<p class="cerca-buit">' + (municipis === null ? "Carregant els 947 municipis…" : "Cap resultat.") + '</p>';
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

  function obre(){ dialeg.showModal(); camp.value = ""; pinta(); baixa(); camp.focus(); }
  boto.addEventListener("click", obre);
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
})();
</script>`;
}
