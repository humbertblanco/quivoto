/* ==========================================================================
   quivoto — moviment.js
   Utilitats de moviment compartides. Sense dependències, sense mòduls (les
   pantalles s'han de poder obrir amb doble clic des del disc, i `import` des
   de file:// no funciona). S'exposa un sol objecte global: window.moviment.

   Contracte amb base.css:
     <html class="js-mou">        la posa un script en línia al <head> de cada
                                  pantalla, abans del primer pintat; aquest
                                  fitxer només la manté. Sense ella res no
                                  s'amaga mai, i per tant sense JS tot es veu.
     [data-entrada]  + .dins      aparició escalonada
     --retard                     el graó de cada element de la tanda
     .pujada                      confirmació d'una acció

   Regla de rendiment que val per a tot el fitxer: només es toquen transform i
   opacity, i `will-change` només existeix mentre l'animació dura.
   ========================================================================== */
(function (window, document) {
  'use strict';

  /* --- 1. L'ajudant que totes les pantalles han de fer servir ------------
     No es consulta prefers-reduced-motion a mà enlloc més. Es consulta aquí,
     en viu (l'usuari pot canviar-ho amb la pàgina oberta), i tota la resta del
     sistema hi passa per sobre. */
  var consulta = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false, addEventListener: null };

  function movimentReduit() {
    return !!consulta.matches;
  }

  /* siEsMou(anima, alDirecte)
     `anima` només s'executa si l'usuari accepta moviment. `alDirecte` és
     l'altra meitat de la feina, no un consol: hi va el resultat final, ja
     posat, perquè la pantalla sigui igual de comprensible sense animació.
     Retorna el que retorni la branca que s'hagi executat. */
  function siEsMou(anima, alDirecte) {
    if (movimentReduit()) return typeof alDirecte === 'function' ? alDirecte() : undefined;
    return typeof anima === 'function' ? anima() : undefined;
  }

  /* --- 1 bis. L'escala de cinc graons ------------------------------------
     UNA sola taula per a tot el producte. La brúixola i el resultat parlaven
     de la mateixa resposta amb dos vocabularis («Totalment d'acord» a la
     brúixola, «Molt d'acord» al resultat), i «La teva resposta» no coincidia
     amb el que l'usuari havia premut. Els índexs van d'1 a 5; la posició 0 hi
     és perquè ESCALA[v] funcioni sense restar.
       CURT   el que es veu escrit al botó, que ha de cabre en dues línies
       LLARG  el nom sencer, que és el nom accessible i el que es repeteix
              a totes les altres pantalles */
  var ESCALA_CURT = ['', 'Gens', 'Poc', 'Ni sí ni no', 'Sí', 'Molt'];
  var ESCALA_LLARG = ['',
    'Totalment en desacord',
    'Més aviat en desacord',
    "Ni d'acord ni en desacord",
    "Més aviat d'acord",
    "Totalment d'acord"];

  /* --- 2. Utilitats internes -------------------------------------------- */
  function llista(objectiu, arrel) {
    if (!objectiu) return [];
    if (typeof objectiu === 'string') return Array.prototype.slice.call((arrel || document).querySelectorAll(objectiu));
    if (objectiu.nodeType === 1) return [objectiu];
    return Array.prototype.slice.call(objectiu);
  }

  /* will-change només mentre dura. Posar-lo fix a la fulla d'estil reserva una
     capa de composició per sempre i és una de les maneres més fàcils de fer
     que un mòbil modest vagi a empentes. */
  function capaTemporal(el, ms) {
    el.style.willChange = 'transform, opacity';
    window.setTimeout(function () { el.style.willChange = ''; }, ms + 80);
  }

  function msDeToken(nom, perDefecte) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(nom).trim();
    if (!v) return perDefecte;
    return v.indexOf('ms') > -1 ? parseFloat(v) : parseFloat(v) * 1000;
  }

  /* --- 3. Escalonament ---------------------------------------------------
     El graó per defecte surt de --t-pas: si algun dia es canvia el token, tot
     el producte canvia alhora. Es talla als 8 elements: a partir d'aquí el
     darrer arribaria tan tard que semblaria que la pàgina s'ha encallat. */
  function escalona(nodes, pas, maxim) {
    var els = llista(nodes);
    var graon = pas != null ? pas : msDeToken('--t-pas', 60);
    var sostre = maxim != null ? maxim : 8;
    els.forEach(function (el, i) {
      el.style.setProperty('--retard', (Math.min(i, sostre) * graon) + 'ms');
    });
    return els;
  }

  /* --- 4. Entrada a la vista --------------------------------------------
     Un sol IntersectionObserver per a tota la pantalla. Cada element s'observa
     una vegada i prou: les coses no tornen a entrar quan es torna a passar
     amunt i avall, perquè això és mareig, no informació.
     Els elements que ja es veuen en carregar entren tots alhora i sense retard
     acumulat: el retard s'escalona per grup, no per posició al document. */
  function observaEntrada(opcions) {
    var o = opcions || {};
    var selector = o.selector || '[data-entrada]';
    var arrel = o.arrel || document;
    var llindar = o.llindar != null ? o.llindar : 0.15;
    var marge = o.marge || '0px 0px -8% 0px';
    // El que ja ha entrat no es torna a observar mai: una segona crida sobre
    // el mateix arrel (per exemple, en desplegar-ne més) tornava a fer entrar
    // el que ja hi era i, per a cadascun, tornava a escriure i esborrar
    // `will-change` sense cap animació al davant.
    var els = llista(selector, arrel).filter(function (el) {
      return !el.classList.contains('dins');
    });
    if (!els.length) return null;

    // Sense moviment (o sense IntersectionObserver): tot visible, ara.
    if (movimentReduit() || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('dins'); el.style.removeProperty('--retard'); });
      return null;
    }

    var durada = msDeToken('--t-mig', 240);
    var pendents = els.length;
    var observador = new IntersectionObserver(function (entrades) {
      // Les que entren al mateix fotograma són una tanda: s'escalonen entre
      // elles, no segons on siguin al document.
      var tanda = entrades.filter(function (e) { return e.isIntersecting; })
                          .map(function (e) { return e.target; });
      if (!tanda.length) return;
      escalona(tanda, o.pas, o.maxim);
      tanda.forEach(function (el) {
        el.classList.add('dins');
        capaTemporal(el, durada + parseFloat(el.style.getPropertyValue('--retard') || 0));
        observador.unobserve(el);
        // Quan no queda res per observar, l'observador es desconnecta sol. Si
        // no ho fes, cada repintada d'una llista en deixaria un de viu amb els
        // seus elements ja fora del document.
        if (--pendents <= 0) observador.disconnect();
      });
    }, { threshold: llindar, rootMargin: marge });

    // El que ja es veu al primer pintat entra ARA i no espera la primera
    // devolució de crida de l'IntersectionObserver: l'heroi de la portada no
    // pot dependre d'un salt al bucle d'esdeveniments.
    var alt = window.innerHeight || 800;
    var jaHiSon = [], resta = [];
    els.forEach(function (el) {
      var r = el.getBoundingClientRect();
      (r.top < alt && r.bottom > 0 ? jaHiSon : resta).push(el);
    });
    // El retard s'escriu ABANS de la classe: si s'escrivís després, l'animació
    // ja hauria arrencat amb retard zero.
    escalona(jaHiSon, o.pas, o.maxim);
    jaHiSon.forEach(function (el) {
      el.classList.add('dins');
      capaTemporal(el, durada + parseFloat(el.style.getPropertyValue('--retard') || 0));
      pendents--;
    });
    if (!resta.length) { observador.disconnect(); return null; }
    resta.forEach(function (el) { observador.observe(el); });
    return observador;
  }

  /* --- 5. Números que compten amunt --------------------------------------
     Serveix per a vots, regidors i padró. Tres decisions:
       · el valor final s'escriu al DOM abans de començar, i el compte només
         reescriu text: si el rAF no arriba mai, la xifra correcta ja hi és;
       · s'atura quan la pestanya no es veu (no es compta a fosques);
       · la sortida va formatada en català (35.799, no 35799) i l'element hauria
         de portar la classe .xifra-num, que fixa l'amplada dels dígits. */
  var format = window.Intl && window.Intl.NumberFormat
    ? new window.Intl.NumberFormat('ca-ES')
    : { format: function (n) { return String(n); } };

  function comptaFins(el, final, opcions) {
    var node = llista(el)[0];
    if (!node) return Promise.resolve();
    var o = opcions || {};
    var desde = o.desde != null ? o.desde : 0;
    var decimals = o.decimals != null ? o.decimals : 0;
    var sufix = o.sufix || '';
    var durada = o.durada != null ? o.durada : Math.max(msDeToken('--t-lent', 420), 900);

    function escriu(v) {
      var n = decimals ? Number(v.toFixed(decimals)) : Math.round(v);
      node.textContent = format.format(n) + sufix;
    }

    if (movimentReduit() || document.hidden) { escriu(final); return Promise.resolve(); }

    return new Promise(function (resol) {
      var inici = null;
      function pas(ara) {
        if (inici === null) inici = ara;
        var t = Math.min((ara - inici) / durada, 1);
        // Frenada cúbica: la xifra arriba de pressa i s'atura tranquil·la, que
        // és quan es pot llegir. Res d'elàstic: un número que passa de llarg i
        // torna enrere és un número que ha estat mal escrit un moment.
        var f = 1 - Math.pow(1 - t, 3);
        escriu(desde + (final - desde) * f);
        if (t < 1) window.requestAnimationFrame(pas);
        else { escriu(final); resol(); }
      }
      window.requestAnimationFrame(pas);
    });
  }

  /* --- 6. Barres --------------------------------------------------------
     Escriu --valor (0..1). L'animació la fa el CSS amb scaleX. Aquí no es toca
     mai `width`. */
  function animaBarra(el, valor, opcions) {
    var o = opcions || {};
    llista(el).forEach(function (node, i) {
      var v = Math.max(0, Math.min(1, valor));
      var aplica = function () { node.style.setProperty('--valor', v); };
      if (movimentReduit() || !o.retard) aplica();
      else window.setTimeout(aplica, i * (o.pas != null ? o.pas : msDeToken('--t-pas', 60)));
    });
  }

  /* --- 6 bis. Grup de tria única ------------------------------------------
     Cinc botons de commutació NO són una tria única: un lector de pantalla hi
     diu «premut / no premut» cinc vegades i mai «opció 3 de 5». Això els
     converteix en un radiogrup de debò —role=radio, aria-checked i un sol
     tabulador— i hi posa les fletxes. `aria-pressed` es queda només per als
     commutadors de veritat, com el botó de pes de la brúixola.
     Retorna una funció per marcar el triat des de fora. */
  function radiogrup(contenidor, opcions) {
    var o = opcions || {};
    var node = llista(contenidor)[0];
    if (!node) return function () {};
    var sel = o.selector || 'button';
    node.setAttribute('role', 'radiogroup');

    function botons() { return llista(sel, node); }

    function marca(triat) {
      botons().forEach(function (b) {
        var actiu = b === triat;
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', actiu ? 'true' : 'false');
        b.removeAttribute('aria-pressed');
        b.tabIndex = actiu ? 0 : -1;
      });
    }

    // Estat inicial: el que ja venia marcat del marcatge, o el primer.
    var bs = botons();
    var inicial = bs.filter(function (b) {
      return b.getAttribute('aria-pressed') === 'true' || b.getAttribute('aria-checked') === 'true';
    })[0] || bs[0];
    marca(inicial);

    node.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest(sel) : null;
      if (b && node.contains(b)) marca(b);
    });

    node.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var bs = botons();
      var i = bs.indexOf(document.activeElement);
      if (i < 0) return;
      var j = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % bs.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + bs.length) % bs.length;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = bs.length - 1;
      if (j === null) return;
      e.preventDefault();
      bs[j].focus();
      if (o.mouTria !== false) bs[j].click();
    });

    return marca;
  }

  /* --- 7. Confirmació ---------------------------------------------------- */
  function salta(el) {
    var node = llista(el)[0];
    if (!node || movimentReduit()) return;
    node.classList.remove('pujada');
    void node.offsetWidth;               // reinicia l'animació
    node.classList.add('pujada');
    node.addEventListener('animationend', function net() {
      node.classList.remove('pujada');
      node.removeEventListener('animationend', net);
    });
  }

  /* --- 8. Icones del sprite ---------------------------------------------
     El sprite s'incrusta a la pàgina i les icones es CLONEN, no es referencien
     amb <use>. Motiu: <use> crea un arbre a l'ombra que el CSS del document no
     pot seleccionar, i llavors els ulls no parpellegen ni miren. Clonant, les
     icones són nodes normals i les animacions de base.css hi funcionen.
     <use> continua sent correcte per a icones sense cara, on no cal res. */
  function icona(destinacio, id, opcions) {
    var o = opcions || {};
    var symbol = document.getElementById(id);
    var node = llista(destinacio)[0];
    if (!symbol || !node) return null;
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', symbol.getAttribute('viewBox') || '0 0 48 48');
    // `base` és la primitiva de mida ('ico' per defecte, 'mascota' per a la
    // papereta, que té una altra proporció); `classe` és el que hi afegeix la
    // pantalla.
    svg.setAttribute('class', (o.base || 'ico') + (o.classe ? ' ' + o.classe : ''));
    if (o.etiqueta) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', o.etiqueta); }
    else { svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false'); }
    if (o.retard) svg.style.setProperty('--retard', o.retard + 's');
    Array.prototype.forEach.call(symbol.childNodes, function (fill) {
      // El <title> del sprite no es clona: o l'icona és decorativa
      // (aria-hidden) o porta aria-label. Dues fonts de nom accessible al
      // mateix node és una manera segura de contradir-se.
      if (fill.nodeName === 'title') return;
      svg.appendChild(fill.cloneNode(true));
    });
    node.appendChild(svg);
    return svg;
  }

  /* --- 9. Engegada -------------------------------------------------------
     Cada pantalla crida moviment.inicia() un cop. Fa tres coses i cap més:
       · omple <span data-icona="vei-mobilitat"> amb la icona clonada;
       · engega l'observador d'entrada;
       · prepara els comptadors <b data-compta="35799"> perquè comptin quan es
         vegin (i no abans: comptar fora de pantalla és comptar per a ningú). */
  function inicia(arrel) {
    var base = arrel || document;

    // La classe només es posa si hi ha moviment: així l'estat amagat de
    // [data-entrada] no arriba a existir mai per a qui no vol animacions.
    if (!movimentReduit()) document.documentElement.classList.add('js-mou');

    llista('[data-icona]', base).forEach(function (node) {
      if (node.firstElementChild) return;
      icona(node, node.getAttribute('data-icona'), {
        etiqueta: node.getAttribute('data-etiqueta') || null,
        base: node.getAttribute('data-base') || 'ico',
        classe: node.getAttribute('data-classe') || '',
        retard: parseFloat(node.getAttribute('data-retard') || 0)
      });
    });

    var comptadors = llista('[data-compta]', base);
    if (comptadors.length) {
      comptadors.forEach(function (node) {
        var final = parseFloat(node.getAttribute('data-compta'));
        var op = {
          decimals: parseInt(node.getAttribute('data-decimals') || 0, 10),
          sufix: node.getAttribute('data-sufix') || ''
        };
        if (movimentReduit() || !('IntersectionObserver' in window)) {
          comptaFins(node, final, op);
          return;
        }
        var ob = new IntersectionObserver(function (ents) {
          ents.forEach(function (e) {
            if (!e.isIntersecting) return;
            ob.unobserve(e.target);
            comptaFins(e.target, final, op);
          });
        }, { threshold: 0.4 });
        ob.observe(node);
      });
    }

    observaEntrada({ arrel: base });
  }

  /* Si l'usuari canvia la preferència amb la pàgina oberta, es deixa d'amagar
     res immediatament. No es reprodueix res: només es rendeix. */
  if (consulta.addEventListener) {
    consulta.addEventListener('change', function () {
      if (movimentReduit()) {
        document.documentElement.classList.remove('js-mou');
        llista('[data-entrada]').forEach(function (el) { el.classList.add('dins'); });
      } else {
        document.documentElement.classList.add('js-mou');
      }
    });
  }

  window.moviment = {
    ESCALA_CURT: ESCALA_CURT,
    ESCALA_LLARG: ESCALA_LLARG,
    radiogrup: radiogrup,
    movimentReduit: movimentReduit,
    siEsMou: siEsMou,
    escalona: escalona,
    observaEntrada: observaEntrada,
    comptaFins: comptaFins,
    animaBarra: animaBarra,
    salta: salta,
    icona: icona,
    inicia: inicia
  };
})(window, document);
