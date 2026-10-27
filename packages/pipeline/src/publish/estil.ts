import { GRAFICS_CSS } from "./grafics";
import { PEU_CSS } from "./peu";
import { ESCUT_CSS } from "./escut";

/**
 * Estil de la radiografia. Els tokens són els mateixos que la landing i que
 * `design/prototip/base.css`; aquí només hi ha el que aquesta pàgina necessita.
 * Va incrustat perquè cada radiografia sigui un fitxer autònom: es pot obrir
 * des de qualsevol lloc, arxivar i enviar sense que se'n trenqui res.
 */
/**
 * El full del cercador, a part de la resta perquè té dues sortides.
 *
 * Les pàgines de l'Observatori l'incrusten dins de `RADIOGRAFIA_CSS`, com
 * sempre; la landing, que té el seu propi full a `web/public/assets/styles.css`,
 * l'enllaça com a `assets/cercador.css`, que escriu `escriuCercadorCompartit()`
 * a partir d'aquesta mateixa constant. El cercador s'ha de veure igual a la
 * portada de quivoto que a la fitxa d'un poble, i la manera de garantir-ho no
 * és copiar-ne les regles a dos llocs sinó que només n'hi hagi un.
 *
 * Els tokens que fa servir (`--ink`, `--paper-2`, `--vora`, `--r-m`, `--e2`,
 * `--presec`, `--display`, `--text`) es diuen igual als dos fulls.
 */
export const CERCADOR_CSS = `
/* --- el cercador --------------------------------------------------------
   El botó el posa el guió, així que aquí no hi ha res que quedi penjat sense
   JavaScript. La finestra és un «dialog» de debò: el navegador ja hi fa el
   focus, l'Esc i el fons, i no cal reinventar-ho.

   La ranura és el lloc de la capçalera on el guió posa el botó: hi és a la
   capçalera de l'Observatori (capcalera.ts) i a la de la landing
   (build_landing.py), i per això la regla viatja amb el cercador i no amb la
   capçalera. */
.capcalera .ranura-cerca{display:inline-flex;align-items:center}
.obre-cerca{display:inline-flex;align-items:center;gap:8px;margin-left:auto;margin-right:var(--e2);
  font-family:var(--text);font-weight:800;font-size:.82rem;color:var(--ink);cursor:pointer;
  background:var(--paper-2);border:2px solid var(--ink);border-radius:var(--r-max);
  padding:0 16px;min-height:38px;transition:background .12s ease,color .12s ease}
.obre-cerca:hover{background:var(--ink);color:var(--paper)}
@media (prefers-reduced-motion:reduce){.obre-cerca{transition:none}}
@media (max-width:520px){ .obre-cerca span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)} .obre-cerca{padding:0 11px} }

.cercador{width:min(560px,calc(100vw - 32px));padding:0;border:2.5px solid var(--ink);
  border-radius:var(--r-m);box-shadow:6px 6px 0 var(--ink);background:var(--paper-2);color:var(--ink);
  margin-top:12vh}
.cercador::backdrop{background:rgba(30,27,46,.45)}
.cerca-cap{display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--paper);
  border-bottom:2.5px solid var(--ink);color:var(--ink)}
.cerca-cap input{flex:1 1 auto;min-width:0;border:0;background:none;font-family:var(--text);
  font-size:1rem;font-weight:700;color:var(--ink);outline:none}
.cerca-cap input::placeholder{color:var(--ink-suau);font-weight:600}
/* «Esc» i la mena de cada fila, tal com estan escrits: en majúscules
   espaiades eren rètols de plantilla, i «CANDIDATURA» ni hi cabia. */
.cerca-tanca{font-family:var(--text);font-size:.74rem;font-weight:700;letter-spacing:0;
  color:var(--ink-suau);background:none;border:2px solid var(--vora);
  border-radius:6px;padding:3px 7px;cursor:pointer}
.cerca-resultats{max-height:min(420px,54vh);overflow-y:auto}
.cerca-buit{font-size:.9rem;color:var(--ink-suau);margin:0;padding:20px 18px;line-height:1.45}
.cerca-fila{display:flex;align-items:center;gap:12px;padding:11px 16px;text-decoration:none;
  color:inherit;border-top:1px solid var(--vora)}
.cerca-fila:first-child{border-top:0}
.cerca-fila.tria{background:var(--presec);color:#1E1B2E}
.cerca-fila .mena{flex:none;font-size:.74rem;font-weight:700;letter-spacing:0;
  color:var(--ink-suau);width:6.4em}
.cerca-fila.tria .mena{color:rgba(30,27,46,.66)}
.cerca-fila .qui{display:flex;flex-direction:column;gap:1px;min-width:0}
.cerca-fila .qui b{font-family:var(--display);font-weight:900;font-size:1rem;letter-spacing:-.01em}
.cerca-fila .qui span{font-size:.76rem;color:var(--ink-suau);font-weight:700}
.cerca-fila.tria .qui span{color:rgba(30,27,46,.7)}
`;

/**
 * El selector de la llegenda de l'hemicicle: qui té quantes regidories o quants
 * seients, una fila per força amb la barra de la proporció a sota.
 *
 * Era `.llegenda` a seques, i un nom tan genèric el pot fer servir qualsevol
 * pàgina per a una llegenda que no s'hi assembla gens: la clau del mapa dels
 * 947 en va heretar la graella de dues columnes i el filet de sota de cada
 * fila, i el mapa va haver de canviar de nom per escapar-se'n. Ara la regla
 * només val per a les dues llegendes que són d'aquest disseny: la que va just
 * sota d'un hemicicle (la fitxa municipal i les de diputació i consell) i la
 * de la composició de les diputacions i els consells, que hi va fins i tot quan
 * la font no diu quants seients té l'ens i no hi ha hemicicle per dibuixar.
 *
 * Va dins de `:where()` perquè pesi el mateix que el `.llegenda` d'abans: una
 * pàgina que en retoca un marge (`.ens-composicio{margin-bottom}`) ha de poder
 * guanyar-li com fins ara, sense haver de pujar l'especificitat.
 */
const LLEGENDA = ".llegenda:where(.hemicicle + *,.ens-composicio)";

const FULL = `
:root{
  --paper:#FBF7EE; --paper-2:#FFFFFF; --ink:#1E1B2E; --ink-suau:#6B6680;
  --coral:#E2735A; --menta:#BFE8D2; --lavanda:#C9C4F2; --presec:#FFD8B8;
  --vora:rgba(30,27,46,.12);
  --r-s:10px; --r-m:18px; --r-l:26px; --r-max:999px;
  --e1:8px; --e2:16px; --e3:24px; --e4:40px; --e5:64px;
  --display:"Gabarito",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  --text:"Nunito Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;
  --ample-columna:900px; --ample:var(--ample-columna); --ombra:3px 3px 0 var(--ink);
  /* El coral de marca sobre el paper clar es queda a 2,9:1 i no arriba al 4,5:1
     que demana el text petit. Com que també fa de fons (botons, pastilles), on
     hi va tinta fosca a sobre, no el podem enfosquir: cal un to germà només per
     al text i per a l'anell del focus. En fosc el coral ja hi contrasta prou. */
  --coral-text:#C24429;
  /* El gris del text secundari es llegeix sobre el paper (5,1:1) però no sobre
     els fons tenyits de la casa: cau a 4,1:1 damunt del presec, a 4,1 damunt de
     la menta i a 3,3 damunt de la lavanda, que és per sota del mínim. Dins
     d'una pastilla de color, doncs, hi va aquest altre, que damunt de les tres
     passa de 4,8:1 sense deixar de ser el mateix gris de la família. */
  --ink-suau-tint:#524D63;
}
@media (prefers-color-scheme: dark){
  :root{ --paper:#17141F; --paper-2:#211D2C; --ink:#F4F0E6; --ink-suau:#A9A3B8; --vora:rgba(244,240,230,.16);
    --coral-text:#E2735A;
    /* En fosc el gris de les pastilles s'ha de girar: les targetes de la
       participació i de la paritat porten fons fosc i l'etiqueta del regle hi
       desapareixia. Les poques pastilles que es queden clares —el presec i la
       lavanda amb tinta fosca escrita a mà— es tornen a posar el gris fosc
       elles mateixes, més avall. */
    --ink-suau-tint:#B7B1C4; }
}
*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--text);font-size:17px;line-height:1.55;-webkit-font-smoothing:antialiased}
h1,h2{font-family:var(--display);font-weight:900;letter-spacing:-.025em;line-height:1.03;margin:0}
h1{font-size:clamp(2.6rem,9vw,4.6rem)}
h2{font-size:clamp(1.5rem,4vw,2.1rem);margin-bottom:var(--e2)}
p{margin:0 0 var(--e2)}
a{color:inherit;text-underline-offset:3px}
:focus-visible{outline:3px solid var(--coral-text);outline-offset:3px;border-radius:4px}
.salta{position:absolute;left:-9999px;background:var(--ink);color:var(--paper);padding:var(--e1) var(--e2);z-index:9}
.salta:focus{left:0}
/* Amagar a la vista i deixar-ho per a qui llegeix amb veu.
 *
 * Va bé per a tot **menys per a una taula**: una taula no es creu l'amplada
 * d'un píxel i creix fins al seu contingut, i ni la disposició fixa la hi fa
 * respectar. Per això la taula que acompanya cada gràfica de sèrie temporal va
 * dins d'un div amb aquesta classe i no la porta ella mateixa: un div sí que
 * s'encongeix i retalla. Vegeu la nota de grafics.ts, que és on es dibuixa.
 *
 * El retall per forma és el rellevat de l'antic, que va de baixa; el marge i el
 * farciment a zero eviten que la caixa d'un píxel n'ocupi tres.
 */
.nomes-lectors{position:absolute;width:1px;height:1px;overflow:hidden;
  clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;margin:-1px;padding:0;border:0}

/* --- la capçalera compartida -------------------------------------------
   Tres peces en una fila: la marca, el menú i la casella. La marca és
   «quivoto» i no «Observatori» perquè qui arriba a la pàgina d'un regidor per
   un enllaç ha de poder saber a casa de qui és; l'Observatori és la primera
   entrada del menú.

   A l'escriptori el menú no es plega darrere de cap botó: hi cap sencer, i un
   botó que amaga vuit coses que hi caben és més feina que les vuit coses. Entre
   720 i 900 px baixa sencer a una segona fila, que encara és una sola fila. Al
   mòbil, en canvi, eren dues files més i la capçalera feia 180 px: allà el menú
   es plega darrere d'un botó «Menú» (vegeu més avall i capcalera.ts). */
.capcalera{display:flex;align-items:center;gap:var(--e2);flex-wrap:wrap;
  max-width:var(--ample);margin:0 auto;padding:var(--e3)}
.capcalera .menu{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-left:auto}
.capcalera .menu a,.capcalera .menu .ara{font-family:var(--text);font-weight:800;font-size:.82rem;
  text-decoration:none;display:inline-flex;align-items:center;min-height:44px;white-space:nowrap}
.capcalera .menu a:hover{text-decoration:underline;text-decoration-thickness:2.5px;text-underline-offset:5px}
/* On ets, subratllat amb el coral de la casa. És l'única marca de color de la
   fila: si tot hi cridés, no s'hi sabria on ets. */
.capcalera .ara{color:var(--coral-text);text-decoration:underline;
  text-decoration-thickness:2.5px;text-underline-offset:5px}
/* Amb set entrades el menú ja no cap al costat del logotip a partir de 900px:
   s'hi quedava a mitges i l'etiqueta queia sola a una segona fila. Aquí el menú
   baixa sencer a la seva pròpia fila —com fa la landing— i la fila de dalt es
   queda amb el logotip, el rastre, la casella i l'etiqueta a la dreta. El gap
   vertical del menú embolcallat és de 4px: dues files d'enllaços de 44px amb
   els 14 d'espai normal serien una capçalera de tres dits. */
@media (max-width:900px){
  .capcalera{gap:12px}
  .capcalera .menu{order:1;flex:1 1 100%;margin-left:0;gap:4px 14px}
  .capcalera .etiqueta{margin-left:auto}
}
/* Sota de 720px la fila ja va justa i l'etiqueta d'esborrany és el primer que
   sobra: no diu on ets ni t'hi porta. El logotip i la casella no es mouen mai
   de lloc. */
@media (max-width:720px){
  .capcalera{padding:var(--e2) var(--e3)}
  .capcalera .etiqueta{display:none}
}
/* Sense JavaScript no hi ha botó i el menú es queda embolcallat a sota, amb
   tots els enllaços a la vista: aquesta és la mida de les seves lletres. Els
   enllaços porten la seva pròpia mida escrita, i encongir el contenidor no els
   encongia a ells. */
@media (max-width:420px){
  .capcalera .menu a,.capcalera .menu .ara{font-size:.78rem}
}

/* --- el botó «Menú» i el full ------------------------------------------
   El botó el crea el guió de capcalera.ts, que també marca la capçalera amb
   «amb-plec»: totes les regles del plec hi pengen, i per això sense guió no es
   plega res. Fora del mòbil el botó no es veu mai.

   Una sola fila: logotip a l'esquerra, i a la dreta «Menú» i la casella, en
   aquest ordre perquè és el del Tab. Els dos botons fan el mateix dibuix
   —pastilla amb vora de tinta, com la casella de sempre— i el mateix alt de
   44 px, que és l'objectiu de toc de la casa. La fletxa del botó és la del plec
   dels grups del ple: gira quan s'obre i no és l'única cosa que ho diu, perquè
   el botó també s'omple de tinta.

   El full penja de sota de la capçalera, de punta a punta, i tapa la pàgina en
   comptes d'empènyer-la: obrir el menú no ha de moure el que hi ha a sota. És
   una llista vertical d'enllaços de 48 px separats per un filet, sense ombra
   (la marca no en vol, de targetes flotants), tancada per la ratlla de tinta de
   la casa. On ets va en coral i subratllat, com a la fila de l'escriptori. */
.obre-menu{display:none}
@media (max-width:720px){
  .capcalera.amb-plec{position:relative;flex-wrap:nowrap;gap:10px}
  .capcalera.amb-plec .logo{margin-right:auto}
  .capcalera.amb-plec .obre-cerca{margin:0;min-height:44px}
  .capcalera .obre-menu{display:inline-flex;align-items:center;gap:9px;flex:none;min-height:44px;
    padding:0 15px 0 16px;font-family:var(--text);font-weight:800;font-size:.86rem;color:var(--ink);
    background:var(--paper-2);border:2px solid var(--ink);border-radius:var(--r-max);cursor:pointer}
  .capcalera .obre-menu::after{content:"";width:7px;height:7px;flex:none;
    border-right:2.5px solid currentColor;border-bottom:2.5px solid currentColor;
    transform:translateY(-2px) rotate(45deg)}
  .capcalera .obre-menu:hover,.capcalera .obre-menu[aria-expanded="true"]{background:var(--ink);color:var(--paper)}
  .capcalera .obre-menu[aria-expanded="true"]::after{transform:translateY(2px) rotate(-135deg)}
  .capcalera.amb-plec .menu{display:none}
  .capcalera.amb-plec.obert .menu{display:flex;flex-direction:column;align-items:stretch;flex-wrap:nowrap;gap:0;
    position:absolute;z-index:30;top:100%;left:0;right:0;margin:0;padding:0 var(--e3) var(--e1);
    background:var(--paper);border-top:1px solid var(--vora);border-bottom:2.5px solid var(--ink)}
  .capcalera.amb-plec .menu a,.capcalera.amb-plec .menu .ara{min-height:48px;font-size:1rem;
    border-top:1px solid var(--vora)}
  .capcalera.amb-plec .menu > :first-child{border-top:0}
}
/* Els objectius de toc que van sols (no els enllaços dins d'una frase) han de
   fer 44px d'alt: la mida on un dit hi encerta sense ampliar la pàgina. */
.logo{font-family:var(--display);font-weight:900;letter-spacing:-.05em;font-size:1.3rem;text-decoration:none;
  display:inline-flex;align-items:center;min-height:44px}

${CERCADOR_CSS}

main{max-width:var(--ample);margin:0 auto;padding:0 var(--e3) var(--e5)}
.portada{padding:var(--e3) 0 var(--e4)}
/* El rètol de sobre del títol és un fil d'Ariadna —«Vallès Occidental ·
   Barcelona», «Comarca», «Poble a poble»— i no un cartell. Anava en majúscules
   espaiades i en coral, que és el rètol de plantilla que la marca no vol: ara
   és una línia de text petit, tal com està escrita, amb els enllaços subratllats
   perquè es vegi que porten a algun lloc. */
.micro{font-size:.88rem;font-weight:700;letter-spacing:0;line-height:1.4;color:var(--ink-suau);margin:0 0 var(--e2)}
.micro a{color:var(--ink);text-decoration-color:var(--coral);text-decoration-thickness:2px}
.micro a:hover{color:var(--coral-text)}
.entrada{font-size:1.15rem;color:var(--ink-suau);margin:var(--e2) 0 0}
.entrada-bloc{color:var(--ink-suau)}
.bloc{padding:var(--e4) 0;border-top:2.5px solid var(--ink)}
/* Tot el que té id és una àncora, i no només els blocs: els subtítols de dins
   d'un bloc fusionat —«#alcaldies», «#balanc»— també hi porten, i sense el
   marge el títol quedava enganxat a la vora de dalt de la pantalla. */
[id]{scroll-margin-top:var(--e3)}

/* --- el resum d'una frase: el que es llegeix abans de fer scroll --- */
.resum{font-family:var(--display);font-weight:900;font-size:clamp(1.15rem,3.2vw,1.5rem);
  letter-spacing:-.02em;line-height:1.25;margin:var(--e3) 0 0;max-width:30ch}
.resum b{color:var(--coral-text)}
/* «.resum b» és més específic que «.sigla» i li guanyava el color: les sigles
   del resum sortien en coral damunt del color del seu partit, i «PSC-CP» hi
   quedava a 1,09:1 —coral sobre vermell— i «TriasxBCN-CM» a 2,28. La pastilla
   mana sobre el seu propi text, tant si és un «b» com si és l'enllaç a la
   pàgina del partit. */
.resum .sigla{color:var(--t,#FBF7EE)}
/* Les sigles d'un partit, amb el seu color de fons i la tinta triada per
   lluminància: escrites amb el color del partit damunt del paper n'hi ha que no
   arriben a cap mínim de contrast. Quan la pastilla és un enllaç no va
   subratllada: el fons de color ja diu que és una peça, i el subratllat hi
   trencava la vora de sota. */
.sigla{display:inline-block;background:var(--c,var(--coral));color:var(--t,#FBF7EE);
  border:2px solid var(--ink);border-radius:var(--r-max);padding:0 9px;font-weight:900;
  font-size:.82em;line-height:1.45;white-space:nowrap;letter-spacing:0;
  vertical-align:.06em;text-decoration:none;max-width:100%}
/* Unes sigles no es parteixen mai, però a la fitxa hi ha pastilles amb el nom
   sencer del grup («PARTIT DELS SOCIALISTES DE CATALUNYA»), i a 360 px una
   pastilla d'una sola línia feia sobresortir la pàgina per la dreta. A partir
   de vint lletres la pastilla es pot partir; les sigles curtes, mai. */
@media (max-width:560px){.sigla.llarga{white-space:normal;overflow-wrap:anywhere;line-height:1.25;padding-top:2px;padding-bottom:2px}}
a.sigla:hover,a.sigla:focus-visible{box-shadow:var(--ombra)}
/* Dins d'una frase de titular la pastilla no ha de fer de botó: amb la mida de
   la lletra del voltant trencava el ritme de lectura i pesava més que el nom
   del poble. Encongida i sense el descens de la caixa, es llegeix com una
   paraula més que casualment porta color. */
.resum .sigla{font-size:.74em;padding:0 10px;vertical-align:.1em}

/* --- les pastilles: tres menes i prou -----------------------------------
   La mateixa pastilla arrodonida feia massa feines —índex, destins, estats,
   sigles— i a la pàgina d'una persona n'hi havia cinc dibuixos en una sola
   fila. Ara cada feina té una cara, i només una:

   1. **La sigla d'un partit** («.sigla», a dalt): xip ple del color del partit,
      amb vora de tinta. És una marca de dada i és l'única pastilla arrodonida.
   2. **Un estat** («.estat», i les classes antigues que fan aquesta feina):
      etiqueta petita i plana, sense vora, cantons poc arrodonits i en
      minúscula com una frase. Diu com està una cosa; no porta enlloc. El fons
      és un gris de tinta; les que ja tenien un color de la casa per un motiu
      (el presec de l'esborrany, la menta del govern) el conserven.
   3. **Navegar** («.navega», «.index», «.pastilles-context», «.destins»,
      «.prova-enllac»): text subratllat i prou. El subratllat ja diu que és un
      enllaç; la vora i el fons de pastilla el feien semblar un botó, i la
      fletxa del final («→») hi sobrava.

   Els botons de debò (la casella, «Menú», «Respon les preguntes») no són
   pastilles: fan una acció i porten el seu propi dibuix. */
.estat,.etiqueta,.marca-canvi,.marca-govern,.districte,.punt-tipus,.vot-unanim,.vot-grup{
  display:inline-block;font-family:var(--text);font-size:.74rem;font-weight:700;line-height:1.35;
  letter-spacing:0;text-transform:none;white-space:nowrap;
  border:0;border-radius:5px;padding:2px 8px;background:var(--vora);color:var(--ink)}
.etiqueta,.marca-canvi{background:var(--presec);color:#1E1B2E}
/* El «display» de dalt guanya l'atribut «hidden»: la prova escriu el districte
   buit i amagat fins que el guió el sap, i sense això sortia una capsa buida. */
:is(.estat,.etiqueta,.marca-canvi,.marca-govern,.districte,.punt-tipus,.vot-unanim,.vot-grup)[hidden]{display:none}
.navega{display:inline-flex;align-items:center;min-height:44px;font-weight:800;color:inherit;
  text-decoration:underline;text-decoration-color:var(--coral);text-decoration-thickness:2px;
  text-underline-offset:4px}
.navega:hover{color:var(--coral-text)}
.alcaldia{display:flex;align-items:center;gap:var(--e2);margin:var(--e3) 0 0}
.cara-alcaldia{width:52px;height:52px;border-radius:50%;border:2.5px solid var(--ink);
  box-shadow:var(--ombra);object-fit:cover;flex:0 0 auto;background:var(--paper-2)}
/* El retrat va amb «loading=lazy» i, fins que arriba, el cercle era blanc i
   buit: a la portada, vuit anelles sense res a dins. Mentre carrega, el fons
   dibuixa una silueta —cap i espatlles— amb el gris dels filets, que diu «aquí
   hi va una cara» sense fer veure que és de ningú en concret; la foto, opaca, la
   tapa sencera quan arriba. Són dos cercles plens i no cap degradat: les
   parades de color van enganxades. Les inicials sota la foto, que seria encara
   millor, demanen un segon element a l'HTML, i la fitxa del regidor, que ja les
   hi posa pel seu compte, deixa la foto transparent i no veu aquesta silueta. */
img.cara-alcaldia{background:
  radial-gradient(ellipse 19% 19% at 50% 39%,var(--vora) 97%,transparent 100%),
  radial-gradient(ellipse 36% 30% at 50% 100%,var(--vora) 97%,transparent 100%),
  var(--paper-2)}
.cara-alcaldia.inicials{display:flex;align-items:center;justify-content:center;
  font-family:var(--display);font-weight:900;font-size:1.05rem;background:var(--c);color:var(--t)}
/* La mateixa cara més petita (vegeu cara.ts): la mida va a --mida. */
.cara-alcaldia.petita{width:var(--mida);height:var(--mida);border-width:2px;box-shadow:2px 2px 0 var(--ink);font-size:calc(var(--mida) * .36)}
.qui-mana{display:flex;flex-direction:column;gap:3px;min-width:0}
.nom-alcaldia{font-family:var(--display);font-weight:900;font-size:1.05rem;letter-spacing:-.01em}
.nom-alcaldia a{color:inherit;text-decoration:none;border-bottom:2.5px solid var(--coral)}
.relleu-alcaldia{display:block;font-size:.78rem;color:var(--ink-suau);font-weight:700;margin-top:2px}
.relleu-alcaldia a{color:inherit;text-decoration-color:var(--vora)}
.carrec-alcaldia{font-size:.84rem;color:var(--ink-suau);font-weight:700;
  display:flex;align-items:center;gap:6px;flex-wrap:wrap}

/* --- el poble en quatre xifres ------------------------------------------
   La fitxa fa 28.000 píxels. Qui l'obre per saber com està el seu poble no ha
   de recórrer-la sencera per treure'n res: aquí hi ha les xifres que responen
   la pregunta, cadascuna amb on queda dins del seu grup i amb l'enllaç al bloc
   que l'explica. Va sense contorn ni ombra a propòsit: és un índex amb números
   i no una targeta més de dades, i si pesés com les de sota competiria amb
   elles en comptes de deixar-hi anar. */
/* --- la graella de xifres («ullada») -----------------------------------
   Les tres, quatre, cinc o sis xifres que obren la fitxa del poble, la de la
   comarca, la de l'AMB i les de diputacions i consells. És un sol component, i
   per això ha de fer el mateix a totes les pàgines i a totes les amplades.

   Abans els separadors eren vores esquerra i de dalt a cada pastilla, i qui
   obria fila —qui no n'havia de portar— es decidia amb una cadena de
   «:nth-child» diferent per a cada tram de columnes. Les regles de tram
   estaven dins de @container i les d'una columna també, però «li:nth-child(3n+1)»
   pesa més que «li» a seques: a mòbil la quarta pastilla recuperava la vora
   esquerra i el farciment, i la graella alternava pastilles amb caixa i sense.
   Ara no hi ha vores verticals: cada pastilla porta només un filet a sobre, la
   separació entre columnes és un buit, i el filet de la primera fila el talla
   el mateix <ul> (marge negatiu de la pastilla + «overflow:hidden»), perquè
   allà ja hi ha la ratlla de tinta del bloc. No hi ha cap regla que depengui de
   quantes columnes hi ha, i per tant cap que es pugui contradir.

   Les files internes de cada pastilla són fixes —etiqueta, xifra, barra i
   peu— perquè el peu d'una pastilla sense barra no pugi respecte del de la del
   costat. */
.ullada{margin:var(--e3) 0 0;border-top:2.5px solid var(--ink);container-type:inline-size}
/* Les columnes les decideix l'amplada del CONTENIDOR i no la de la finestra.
   Amb els media queries, la pàgina de comarca —que té el rail de l'índex i
   deixa la columna molt més estreta que la fitxa— rebia tres columnes a
   pantalla ampla i escapçava les etiquetes: «REGIDORIES EN JOC EL 23…» i
   «GOVERNA QUI NO VA…». L'etiqueta és el que dona sentit a la xifra, i tallada
   deixa el número sense voler dir res. */
.ullada ul{list-style:none;margin:0;padding:0;display:grid;column-gap:var(--e3);row-gap:0;
  grid-template-columns:minmax(0,1fr);overflow:hidden}
.ullada li{min-width:0;margin-top:-1.5px;border-top:1.5px solid var(--vora)}
@container (min-width:470px){ .ullada ul{grid-template-columns:repeat(2,minmax(0,1fr))} }
@container (min-width:820px){ .ullada ul{grid-template-columns:repeat(3,minmax(0,1fr))} }
/* Les fitxes de diputació i de consell en porten quatre: en tres columnes en
   quedava una sola a la segona fila. Fan dues i dues, i quatre en fila quan hi
   caben. */
@container (min-width:820px){
  .ullada ul:has(> li:nth-child(4):last-child){grid-template-columns:repeat(4,minmax(0,1fr))}
}
/* En dues columnes, una última pastilla senar no deixa cap forat al costat:
   ocupa la fila sencera. */
@container (min-width:470px) and (max-width:819px){
  .ullada:not(.cinc) li:last-child:nth-child(odd){grid-column:1 / -1}
}
/* La fitxa municipal en porta cinc —gasta, deu, paga, vota, mana— i van en
   una fila a partir de 900 px de contenidor. Entre 600 i 899 fan tres i dues
   sobre sis columnes de fons, de manera que les dues de baix omplen la fila en
   comptes de deixar-hi una cel·la buida; entre 470 i 599 fan dues, dues i una
   d'ample. Va amb classe pròpia perquè «.ullada» la comparteixen la comarca i
   l'AMB, que en tenen sis. */
@container (min-width:900px){ .ullada.cinc ul{grid-template-columns:repeat(5,minmax(0,1fr))} }
@container (min-width:600px) and (max-width:899px){
  .ullada.cinc ul{grid-template-columns:repeat(6,minmax(0,1fr))}
  .ullada.cinc li{grid-column:span 2}
  .ullada.cinc li:nth-child(n+4){grid-column:span 3}
}
@container (min-width:470px) and (max-width:599px){ .ullada.cinc li:last-child{grid-column:1 / -1} }
/* La pastilla de sigles com a xifra, i el «des de» petit al costat: la
   pastilla no ha de fer la mida del número, que la faria un botó. */
.ullada .xifra .sigla{font-size:.55em;display:inline-block;width:auto;height:auto;
  min-height:0;line-height:1.4;padding:1px 12px;vertical-align:.22em}
/* El «des del 2019 · 2 legislatures» va sota el xip, petit i sense estirar-lo. */
.ullada .xifra .des-de{display:block;font-size:.45em;font-weight:700;color:var(--ink-suau);margin-top:4px}
.ullada .xifra .des-de{display:block;font-family:var(--text);font-size:.74rem;font-weight:800;
  letter-spacing:0;color:var(--ink-suau);margin-top:4px;line-height:1.3}
/* La icona del tema al davant de cada xifra: és el que fa que el resum es
   reculli d'una ullada en comptes de llegir-se etiqueta per etiqueta. Va a
   l'esquerra i no a sobre perquè la columna de dibuixos guiï la vista avall.
   Files fixes: etiqueta, xifra, barra i peu. Amb alçada automàtica la
   pastilla sense percentil desalineava el seu peu respecte de la del costat;
   amb una alçada demanada per a la barra, totes quatre comencen a la mateixa
   línia. El farciment és només de dalt i de baix: entre columnes ja hi ha el
   buit de la graella, i així el text de totes les pastilles comença al mateix
   lloc, siguin a la primera columna o no. */
.ullada a{display:grid;grid-template-columns:26px minmax(0,1fr);column-gap:11px;
  grid-template-rows:auto auto 5px auto;align-content:start;min-height:124px;
  text-decoration:none;color:inherit;padding:var(--e2) 0}
/* El <ul> retalla el que en surt (és el que amaga el filet de la primera
   fila), i un contorn per fora quedaria tallat: va per dins. */
.ullada a:focus-visible{outline-offset:-3px}
@container (max-width:469px){ .ullada a{min-height:0} }
.ullada .dibuix{grid-row:1 / span 4;align-self:start;margin-top:2px}
.ullada .dibuix .icona{width:26px;height:26px;display:block}
.ullada .etq,.ullada .xifra,.ullada .on,.ullada .peu{grid-column:2}
.ullada a:hover .xifra{color:var(--coral-text)}
/* Dues línies sempre, tant si el nom n'ocupa una com si n'ocupa dues.
   «Estalvi net» en fa una i «Òrgans de govern, per habitant» en fa dues, i
   sense una alçada demanada la xifra de la primera començava una línia més
   amunt que la de la segona: la fila sencera quedava escapçada.
   L'etiqueta va com està escrita, en minúscula de frase: en majúscules
   espaiades era el rètol de plantilla que la marca no vol, i ocupava un terç
   més d'amplada per dir el mateix. */
.ullada .etq{font-size:.8rem;font-weight:700;letter-spacing:0;
  color:var(--ink-suau);line-height:1.25;min-height:2.5em;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
@container (max-width:469px){ .ullada .etq{min-height:0} }
.ullada .xifra{font-family:var(--display);font-weight:900;font-size:1.9rem;line-height:1.05;
  letter-spacing:-.03em;font-variant-numeric:tabular-nums;transition:color .12s ease}
.ullada .on{display:block;height:5px;background:var(--vora);border-radius:var(--r-max);
  align-self:center}
/* Sense percentil no hi ha res a marcar, i marcar-hi el zero seria dir que el
   municipi és l'últim de tots. La barra buida només guarda el lloc —perquè el
   peu comenci a la mateixa línia que el de la pastilla del costat— i no
   pinta res: ni canaleta plena, que al costat d'una barra de debò es llegeix
   com un cent per cent, ni la ratlla de punts d'abans, que sota el número feia
   una segona línia sense voler dir res. Una barra, doncs, només on hi ha una
   proporció. */
.ullada .on.buida{background:none}
/* Un zero de debò —un partit sense cap alcaldia— no dibuixa res; una part
   petita però no nul·la —2 alcaldies de 947, un 0,2 %— en dibuixa com a mínim
   4 px, perquè es vegi que hi és. Amb un «min-width:4px» a seques el zero
   també en treia 4, i una barra de zero es llegeix com «una mica». La fórmula
   ho distingeix sense saber res de l'HTML: «--w × 1000» és zero només si --w
   és zero, i qualsevol altra cosa passa de 4 px de seguida. Ho fa amb el que
   l'HTML escriu: si qui la crida arrodoneix el 0,2 % a «0%», aquí és un zero. */
.ullada .on i{display:block;height:100%;width:max(var(--w),min(4px,var(--w) * 1000));background:var(--lavanda);
  border-radius:var(--r-max)}
/* Dues línies i para: un peu de tres estirava tota la fila de la graella. */
.ullada .peu{font-size:.74rem;color:var(--ink-suau);line-height:1.3;margin-top:7px;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
/* «entre els 947»: l'enllaç al rànquing d'aquella xifra, a les pastilles que
   en tenen. Va FORA de la tessel·la —que ja és un enllaç sencer— com a segon
   fill del <li>, i per això «.ullada a» l'agafava i en feia una segona graella
   de 124 px: aquí es desfà tot això. La pastilla es fa columna flexible i la
   tessel·la s'estira, perquè l'enllaç quedi enganxat a baix a la dreta a totes
   les pastilles de la fila, tinguin el peu d'una línia o de dues. Va a
   l'esquerra, a la columna del text (26 px d'icona + 11 de separació), com
   l'etiqueta, la xifra i el peu: ara que cap pastilla no té farciment lateral,
   el marge esquerre és el mateix a totes les columnes. */
.ullada li:has(> .entre-947){display:flex;flex-direction:column}
.ullada li:has(> .entre-947) > a:first-child{flex:1 0 auto}
/* Va subratllat sempre, i no només en passar-hi per sobre: és un enllaç dins
   d'una peça que ja n'és un altre, i sense el subratllat semblava una nota. La
   fletxa «→» que portava al final no hi és: el subratllat ja ho diu. */
.ullada a.entre-947{display:block;flex:0 0 auto;min-height:0;margin-top:-10px;padding:0 0 var(--e2) 37px;
  text-align:left;font-size:.76rem;font-weight:800;letter-spacing:0;color:var(--coral-text);
  text-decoration:underline;text-decoration-thickness:1.5px;text-underline-offset:3px}
.ullada a.entre-947:hover,.ullada a.entre-947:focus-visible{text-decoration-thickness:2.5px}
/* A les tires («.tires .peu») l'enllaç va dins del peu, en línia, i només
   canvia de color: allà el peu no és cap enllaç i no cal treure'l de res. */
.tires .peu .entre-947{color:var(--coral-text);font-weight:800;display:inline-block}
@media (prefers-reduced-motion:reduce){.ullada .xifra{transition:none}}

/* --- una persona amb cara i partit --------------------------------------
   Allà on surt el nom d'algú del ple, hi surt la cara que publica el seu propi
   ajuntament i la pastilla del seu grup. Una llista de noms sense res més són
   cadenes de text: qui són i de qui són no s'hi veu. */
.cap-persona{display:flex;align-items:center;gap:11px;min-width:0}
.cap-persona .qui-es{display:flex;flex-direction:column;gap:3px;min-width:0}
.cap-persona .qui-es > b{font-family:var(--display);font-weight:900;font-size:1rem;
  letter-spacing:-.01em;line-height:1.2;overflow-wrap:anywhere}
.cap-persona .sota{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.cap-persona .carrec{font-size:.76rem;color:var(--ink-suau);font-weight:700}
/* Sense fotografia van les inicials amb el color del partit, a plena tinta:
   el gris esvaït de la composició del ple hi era perquè no competís amb les
   cares del costat, i aquí no n'hi ha cap altra amb què competir. */
.retrat.inicials.sense-foto{filter:none;color:var(--t);background:var(--c);font-size:.9rem}

/* --- índex: amb dotze blocs, cal poder-hi saltar --- */
/* És navegació, i per tant text subratllat (vegeu «les pastilles», a dalt):
   abans era una filera de pastilles amb vora, com un grup de botons, i a un
   telèfon les vint entrades feien set files de 44 px. En text n'hi caben tres
   o quatre per fila i el bloc fa la meitat. El subratllat és fluix en repòs i
   s'omple en passar-hi per sobre. */
.index{display:flex;flex-wrap:wrap;gap:0 18px;padding:var(--e2) 0 0;border-top:2.5px solid var(--ink);margin-top:var(--e4)}
.index a{font-size:.86rem;font-weight:800;display:inline-flex;align-items:center;min-height:44px;
  text-decoration:underline;text-decoration-color:var(--vora);text-decoration-thickness:2px;
  text-underline-offset:5px;transition:color .12s ease,text-decoration-color .12s ease}
.index a:hover{color:var(--coral-text);text-decoration-color:currentColor}
/* La secció que s'està llegint: en coral i amb el subratllat ple, com l'apartat
   actual del menú de la capçalera. */
.index a[aria-current]{color:var(--coral-text);text-decoration-color:currentColor}
@media (prefers-reduced-motion:reduce){.index a{transition:none}}
/* Entre la portada i l'índex hi ha d'haver un sol pas de --e4, com entre dos
   blocs. Hi havia el farciment de baix de la portada (40) i el marge de dalt
   de l'índex (40) un damunt de l'altre: al telèfon, entre la darrera xifra de
   la ullada i la ratlla de l'índex quedaven cent píxels buits. Quan el que hi
   ha al davant ja porta el seu farciment —la portada i les seves bessones de
   partit i de candidatura, o un bloc—, l'índex no n'hi afegeix; quan no en
   porta —la ullada solta de la fitxa municipal, la banda del joc, la portada
   de les diputacions, que es posa el seu propi marge—, es queda amb el seu. */
.portada + .index,.partit-portada + .index,.cand-portada + .index,.bloc + .index{margin-top:0}
/* --- la lletra petita ----------------------------------------------------
   Trenta-vuit notes al peu, 1.592 paraules: el 22 % del text de la fitxa era
   com es compta cada cosa i d'on surt. No en sobra cap —és el que fa que una
   xifra es pugui comprovar— però tampoc no s'ha de llegir per entendre la
   pàgina, i llegint-ho tot seguit la fitxa semblava un annex metodològic amb
   dades pel mig. Ara cada nota és una línia que s'obre.

   Es plega, no s'esborra: hi és sencera al codi, s'imprimeix, la troba el
   cercador de la pàgina i qui la busqui la té a un clic. Les que no expliquen
   com es compta res sinó que impedeixen que la xifra de sobre es llegeixi al
   revés —«el cànon no és municipal», «no hi posem cap veredicte»— no es
   pleguen mai: van amb «.oberta» i es llegeixen sempre. */
.nota{font-size:.92rem;color:var(--ink-suau);margin-top:var(--e2)}
details.nota{margin-top:var(--e2)}
details.nota > summary{font-size:.8rem;font-weight:700;color:var(--ink-suau);cursor:pointer;
  list-style:none;display:inline-flex;align-items:center;gap:6px;min-height:26px;
  text-decoration:underline;text-decoration-color:var(--vora);text-underline-offset:3px}
details.nota > summary::-webkit-details-marker{display:none}
details.nota > summary::before{content:"+";font-weight:900;font-size:.9rem;line-height:1}
details.nota[open] > summary::before{content:"−"}
details.nota > summary:hover{color:var(--coral-text);text-decoration-color:currentColor}
details.nota > summary:focus-visible{outline:3px solid var(--coral-text);outline-offset:2px;border-radius:4px}
/* El text de la nota, un cop oberta: mateixa mida i mateix gris que abans. */
details.nota[open] > summary{margin-bottom:4px}
details.nota > :not(summary){font-size:.92rem;color:var(--ink-suau);max-width:70ch;margin:0}
/* Les taules que viuen dins d'una nota —les tres últimes eleccions, la
   llista d'apartats de transparència, la taula de què publica l'ajuntament—
   són dades i no lletra petita: tinta sencera, tota l'amplada i un respir. */
details.nota > .serie,details.nota > .transparencia,details.nota > .taula-envolta,
details.nota > .divergents{color:var(--ink);max-width:none;margin-top:10px}
details.nota > .serie{font-size:1rem}
.nota.feble{color:var(--coral-text);font-weight:700}
.secundari{color:var(--ink-suau);font-size:.86rem}

/* --- qui mana: la peça amb més valor de la pàgina, i es nota --- */
.banda{background:var(--menta);margin:var(--e3) calc(-1 * var(--e3)) 0;padding:var(--e4) var(--e3);border-top:2.5px solid var(--ink);border-bottom:2.5px solid var(--ink)}
@media (prefers-color-scheme: dark){ .banda{background:#243b31} }
.banda .cos{max-width:var(--ample);margin:0 auto}
.titular{font-family:var(--display);font-weight:900;font-size:clamp(1.4rem,4.5vw,2rem);letter-spacing:-.02em;margin:0}

/* --- l'alcaldia: retrat i color del partit -----------------------------
   El color del partit hi és com a franja i com a marca, no com a fons: la
   banda continua sent de la marca de quivoto. Si un dia el color d'un partit
   pinta el bloc sencer, la pàgina deixa de ser de ningú. */
.banda-qui-mana{border-left:12px solid var(--partit)}
.alcaldia-cap{display:flex;align-items:center;gap:var(--e3);margin-bottom:var(--e2);flex-wrap:wrap}
.retrat-alcaldia{width:112px;height:112px;border-radius:50%;object-fit:cover;object-position:50% 22%;
  border:3px solid var(--ink);box-shadow:var(--ombra);background:var(--paper-2);flex:none}
.sigles-alcaldia{display:flex;align-items:center;gap:8px;font-weight:800;font-size:1.05rem;margin:6px 0 0}
.sigles-alcaldia .marca-partit{width:15px;height:15px;border-radius:4px;background:var(--partit);
  border:2px solid var(--ink);flex:none}
/* .6 damunt la menta són 4,0:1, per sota del mínim del text petit. */
.credit-foto{font-size:.76rem;color:rgba(30,27,46,.72);margin:var(--e2) 0 0}
@media (prefers-color-scheme:dark){.credit-foto{color:var(--ink-suau)}}
.veredicte{font-weight:800;font-size:1.05rem;margin:0 0 var(--e1)}
.veredicte.pacte{color:var(--coral-text)}
.avis{background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);box-shadow:var(--ombra);padding:var(--e2);margin-top:var(--e3);font-size:.95rem}

/* --- hemicicle --- */
.hemicicle{margin:0 0 var(--e3)}
.hemicicle svg{width:100%;height:auto;display:block}
.hemicicle figcaption{font-size:.86rem;color:var(--ink-suau);text-align:center;margin-top:var(--e1)}
/* Tres posicions fixes per força: marca i sigles, regidories, vots. Amb
   «flex-wrap» cada fila partia per un lloc diferent i no es podien comparar.
   El selector és la constant LLEGENDA (vegeu-la a dalt): només la llegenda de
   l'hemicicle, i no qualsevol llista que es digui «llegenda». */
${LLEGENDA}{list-style:none;margin:0;padding:0;display:grid;gap:0;
  grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr));column-gap:var(--e3)}
${LLEGENDA} > li{display:grid;grid-template-columns:1fr auto;align-items:baseline;
  gap:2px var(--e2);padding:9px 0;border-bottom:1px solid var(--vora)}
${LLEGENDA} .qui{display:flex;align-items:center;gap:8px;min-width:0}
${LLEGENDA} .qui b{font-weight:800;overflow-wrap:anywhere}
${LLEGENDA} .xifra{font-weight:700;font-size:.82rem;color:var(--ink-suau);white-space:nowrap}
${LLEGENDA} .xifra b{font-family:var(--display);font-weight:900;font-size:1.35rem;
  letter-spacing:-.02em;color:var(--ink);font-variant-numeric:tabular-nums;margin-right:2px}
/* La proporció de vot, que a l'hemicicle no es pot mesurar: dos cercles de
   diferència no es veuen, un 2,7 % de barra sí. Un zero no hi pinta res i una
   part minúscula, com a mínim 3 px: és la mateixa fórmula que la de la ullada. */
${LLEGENDA} .proporcio{grid-column:1/-1;height:6px;background:var(--vora);border-radius:var(--r-max);
  margin:3px 0 1px}
${LLEGENDA} .proporcio i{display:block;height:100%;width:max(var(--w),min(3px,var(--w) * 1000));background:var(--c);
  border-radius:var(--r-max)}
${LLEGENDA} .secundari{grid-column:1/-1;font-size:.78rem;font-variant-numeric:tabular-nums}
.mostra{width:14px;height:14px;border-radius:4px;background:var(--c);border:1.5px solid var(--ink);flex:none;align-self:center}
.xifra{font-weight:800}

/* --- sèrie històrica --- */
/* L'amplada mínima de la taula la manaven els noms de candidatura de dins dels
   trams, que van amb white-space:nowrap: amb un nom llarg («JUNTS PER ABELLA
   DE LA CONCA-...») la taula creixia fins a 485px i empenyia la pàgina sencera
   de costat en un mòbil. Per això va amb «table-layout:fixed», que sí que la
   subjecta. Ara bé: amb el fix, l'amplada declarada a la cel·la no es té en
   compte i el navegador partia la taula a mitges, de manera que la barra —que
   és tot el contingut d'aquest bloc— es quedava amb mig full mentre quatre
   xifres d'any se'n quedaven l'altre mig. Qui sí que mana amb el fix és el
   «colgroup», i per això la taula en porta un. */
.serie{width:100%;border-collapse:collapse;table-layout:fixed}
.serie col.any-serie{width:4.4em}
.serie th{text-align:left;font-family:var(--display);font-weight:900;font-size:1.3rem;width:4.2em;vertical-align:middle}
/* Amb «table-layout:fixed» i una sola columna amidada, el navegador repartia
   l'amplada sobrera entre totes dues i l'any es quedava mig full per escriure
   quatre xifres: la barra, que és el contingut, començava a la meitat de la
   pàgina. Amb el 99 % declarat aquí la columna de la barra s'ho queda tot
   menys el que demana l'any. */
.serie td{padding:8px 0}
.barra{display:flex;height:46px;border:2.5px solid var(--ink);border-radius:var(--r-s);overflow:hidden}
.tram{width:var(--w);min-width:0;background:var(--c);display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;border-right:1.5px solid var(--ink);color:var(--t,#1E1B2E)}
.tram:last-child{border-right:0}
/* Aquí hi havia un halo de paper darrere de cada xifra, que era el pedaç d'una
   tinta mal triada: es calculava amb la fórmula YIQ i sobre mig catàleg de
   colors sortia la que menys contrasta. Ara la tria «contrast.ts» mesurant-lo
   de debò, la xifra hi és neta i el contorn desapareix. */
.tram b{font-size:.9rem;font-weight:900;line-height:1;font-variant-numeric:tabular-nums}
/* Un nom que no hi cap s'acaba amb tres punts i no a mitja lletra: així es veu
   que la paraula continua i no que la barra l'hagi menjada. El nom sencer és a
   l'atribut «title» i a la llista de sota. */
.tram i{font-size:.62rem;font-style:normal;font-weight:700;white-space:nowrap;
  max-width:100%;overflow:hidden;text-overflow:ellipsis;opacity:.82;letter-spacing:.01em;
  padding:0 4px}
/* Per sota d'aquesta amplada el tram més gran fa cinquanta píxels i el nom hi
   surt com a «Triasx…», que no és el nom de ningú. Val més la barra neta: el
   bloc de sota diu qui és cada color i el número hi continua sent exacte. */
@media (max-width:559px){ .tram i{display:none} }
/* Els noms de sota, que és on van quan no caben a dins. Van sempre al codi i
   només se'n veu un dels dos: el bloc promet «el nom exacte de cada llista» i
   en un mòbil també l'ha de complir. */
.noms-serie{list-style:none;margin:6px 0 0;padding:0;display:none;flex-wrap:wrap;gap:2px 12px;font-size:.76rem}
.noms-serie li{display:flex;align-items:center;gap:5px;font-weight:700;color:var(--ink-suau)}
.noms-serie b{color:var(--ink);font-variant-numeric:tabular-nums}
.noms-serie .mostra{width:10px;height:10px;border-radius:3px}
@media (max-width:559px){
  .noms-serie{display:flex}
  /* En vertical la columna de l'any es menja una quarta part de l'amplada per
     escriure quatre xifres, i deixa la barra i la llista escanyades. Apilat,
     tot tres es queden l'amplada sencera. */
  .serie,.serie tbody,.serie tr,.serie th,.serie td{display:block;width:auto}
  .serie th{padding:0 0 6px;font-size:1.15rem}
  .serie tr{padding-bottom:var(--e3)}
  .serie td{padding:0}
}

/* --- participació i paritat --- */
/* Cada xifra amb la mediana del seu grup marcada al regle: sense la marca, un
   60,6 % de participació o un 36,6 % de dones al ple no es poden jutjar, i el
   bloc es llegia com una xifra que no diu res. Les targetes creixen una mica
   perquè hi càpiga la comparació, i per això demanen més amplada mínima. */
/* Sense contorn ni ombra: eren targetes idèntiques en filera, que és el kit que
   la marca no vol, i ara són el mateix que l'ullada —un filet a sobre de cada
   xifra i un buit entre columnes—. Les xifres de tota la fitxa es llegeixen
   així com una sola peça, i no com cinc menes de capsa. */
.participacio,.paritat{list-style:none;margin:0;padding:0;display:grid;gap:0 var(--e3);grid-template-columns:repeat(auto-fit,minmax(min(250px,100%),1fr))}
.participacio li,.paritat li{border-top:1.5px solid var(--vora);padding:var(--e2) 0;display:flex;flex-direction:column;gap:4px;min-width:0}
/* El regle dins d'una targeta no té els 32px de marge que necessita al bloc
   dels diners, on l'etiqueta penja de la marca i pot anar al 94 % del recorregut. */
.participacio .regle,.paritat .regle{margin:16px 22px 2px}
.participacio .comparativa,.paritat .comparativa{font-size:.78rem;line-height:1.35;color:var(--ink-suau)}
/* El regle de dispersió del grup va sota les targetes de participació i ha de
   respirar: sense marge, el seu títol tocava la vora de la targeta de sobre. */
.participacio + .dispersio{margin-top:var(--e3)}
.paritat .etq{font-size:.8rem;font-weight:700;color:var(--ink-suau)}
.gran{font-family:var(--display);font-weight:900;font-size:2.1rem;line-height:1;letter-spacing:-.03em}
/* Una xifra de set dígits («2.416.005») no cap en una targeta de mòbil i
   sortia per sobre del text del costat. No es pot partir: només encongir. */
@media (max-width:430px){ .gran{font-size:1.55rem} }

/* --- qui seu al ple --------------------------------------------------
   El color de la candidatura hi és perquè es vegi el repartiment d'una ullada,
   i és el mateix que a l'hemicicle. Va a la barra lateral i a la marca del
   títol, mai al fons: el paper continua sent el de la marca, no el del partit. */
/* Les targetes s'estiraven fins a l'alçada de la més alta de la seva fila, i
   com que els grups no tenen la mateixa mida el resultat era mig full de caixes
   buides: a 900px, 513px de targeta amb el contorn pintat i res a dins. Amb
   «align-items:start» cada grup fa l'alçada que li toca. */
.plens{display:grid;gap:var(--e2);grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr));
  align-items:start;align-content:start;margin-bottom:var(--e2)}
/* El grup plegable és un «details» i la regla hi va lligada: «.grup» a seques
   casava també amb el <span class="grup"> que el comparador escriu a la
   capçalera de la taula, i li posava contorn, ombra i farciment de targeta.
   Sense contorn ni ombra, com el ple compacte: el color del grup fa de franja
   a l'esquerra, que és on diu de qui és, i la resta és paper. */
details.grup{border-left:10px solid var(--c);padding:4px 0 4px 14px;container-type:inline-size}
/* El grup es pot plegar. Amb 41 regidories el bloc són quatre pantalles de
   telèfon, i qui ja ha vist qui hi ha a un grup ha de poder passar de llarg
   sense recórrer-les totes. Va amb «details» i no amb un guió: sense CSS i
   sense JavaScript continua obert i s'hi veu tothom, que és com ha d'arribar. */
.grup > summary{list-style:none;cursor:pointer;min-height:44px;display:flex;align-items:center}
.grup > summary::-webkit-details-marker{display:none}
.grup > summary:focus-visible{outline:3px solid var(--coral-text);outline-offset:2px;border-radius:6px}
.grup h3{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-family:var(--display);font-weight:900;
  font-size:1rem;letter-spacing:-.01em;margin:0;width:100%}
/* La fletxa del plec: gira quan s'obre i no és l'única cosa que ho diu, perquè
   la llista de sota hi és o no hi és. */
.grup h3::after{content:"";flex:none;width:9px;height:9px;margin-left:2px;
  border-right:2.5px solid var(--ink-suau);border-bottom:2.5px solid var(--ink-suau);
  transform:rotate(45deg) translate(-2px,-2px);transition:transform .12s ease}
.grup[open] h3::after{transform:rotate(-135deg) translate(-2px,-2px)}
@media (prefers-reduced-motion:reduce){.grup h3::after{transition:none}}
.grup > ul{margin-top:var(--e1)}
.grup .marca-grup{width:13px;height:13px;border-radius:4px;background:var(--c);border:1.5px solid var(--ink);flex:none}
.grup .quants{font-family:var(--text);font-weight:700;font-size:.74rem;color:var(--ink-suau);margin-left:auto}
.grup ul{list-style:none;margin:0;padding:0}
.grup li{padding:6px 0;border-top:1px solid var(--vora);display:flex;align-items:center;gap:10px;flex-wrap:wrap}
/* Amb «flex:1 1 8em» el nom s'encongeix fins on pot i, quan ja no hi cap la
   pastilla de govern al costat, la pastilla baixa de línia en comptes de
   partir el nom en tres trossos. */
.grup .dades{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1 1 8em}
.retrat{width:44px;height:44px;border-radius:50%;object-fit:cover;object-position:50% 22%;
  border:2px solid var(--ink);background:var(--paper);flex:none}
/* La inicial anava esvaïda a posta, perquè quan hi havia cares no els fes la
   competència. Ara ja no és el forat que queda quan falta una foto: és la peça
   que porta qui no en té, amb el color del seu grup i la mateixa mida i vora que
   el retrat. Esvaïda tornaria a dir el que volem que no digui, que és que aquell
   regidor val menys. */
.retrat.inicials{display:flex;align-items:center;justify-content:center;font-family:var(--display);
  font-weight:900;font-size:.86rem;color:var(--t,var(--ink));background:var(--c,var(--paper-2))}
details.grup.noadscrit{border-left-style:dashed}
/* Al govern: fons lleugerament tenyit i marca a cada regidoria. El govern pot
   ser de més d'un partit, i per això la marca va per persona i no per grup. */
details.grup.al-govern{background:rgba(191,232,210,.16);border-radius:0 var(--r-s) var(--r-s) 0}
/* El nom complet no ocupa una línia sota cada cara, però no queda amagat:
   surt en passar-hi el ratolí i també en posar-hi el focus de teclat. */
.retrats a[data-tip]{position:relative}
.retrats a[data-tip]::after{content:attr(data-tip);position:absolute;z-index:20;left:50%;bottom:calc(100% + 7px);
  transform:translateX(-50%);width:max-content;max-width:240px;padding:6px 9px;border:1.5px solid var(--ink);
  border-radius:7px;background:var(--ink);color:var(--paper);font:700 .74rem/1.2 var(--text);
  pointer-events:none;display:none;box-shadow:var(--ombra)}
/* Amagat amb «display:none» i no amb «visibility:hidden» A POSTA: un rètol
   invisible però present segueix comptant per a l'amplada de la pàgina, i a
   un telèfon el nom llarg de l'última cara de cada fila feia sobresortir tota
   la fitxa 10 px per la dreta. Es perd el fos en aparèixer; no es perd res més. */
.retrats a[data-tip]:hover::after,.retrats a[data-tip]:focus-visible::after{display:block}
/* Els títols natius de les minigràfiques són útils però massa discrets i no es
   poden llegir bé en pantalles tàctils. Repetim el context en una etiqueta
   visual quan l'element rep focus o hover; la taula accessible continua sent
   la font completa per a lectors de pantalla. */
.grafic [title]{position:relative}
.grafic [title]:hover::after,.grafic [title]:focus-visible::after{content:attr(title);position:absolute;z-index:25;
  left:50%;bottom:calc(100% + 6px);transform:translateX(-50%);width:max-content;max-width:220px;padding:5px 8px;
  border:1.5px solid var(--ink);border-radius:6px;background:var(--ink);color:var(--paper);
  font:700 .72rem/1.2 var(--text);white-space:normal;pointer-events:none;box-shadow:var(--ombra)}
@media (prefers-reduced-motion:reduce){.retrats a[data-tip]::after{transition:none}}
/* Un estat (vegeu «les pastilles»): la forma la dona la regla comuna, i aquí
   només hi ha el color, que és la menta del govern, i el lloc. */
.marca-govern{background:var(--menta);color:#1E1B2E}
.grup li.govern .marca-govern{margin-left:auto;flex:none}
.resum-govern{background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);
  box-shadow:var(--ombra);padding:var(--e2);margin:0 0 var(--e3);font-size:1rem}
.grup .qui a{text-decoration:none;border-bottom:1.5px solid var(--vora)}
.grup li:first-child{border-top:0}
.grup li.alcaldia .qui{font-weight:900}
.grup .qui{font-size:.92rem;line-height:1.3}
.grup .carrec{font-size:.74rem;color:var(--ink-suau)}
/* La fila compacta. Hi ha dos motius per demanar-la i són diferents, i per
   això hi ha dues regles i no una:

   · **La targeta és estreta.** Amb tres columnes la targeta fa 273px i al nom
     li'n queden 187: vuit dels 41 noms es partien en dues línies. Ho mana la
     targeta i no la finestra —a 900px de pantalla la targeta pot ser de 273 o
     de 418 segons quantes columnes hi càpiguen—, i per això ho decideix una
     consulta de contenidor. Compactada, dels vuit en queda un, i el bloc passa
     de 1.399 a 1.184px.
   · **La pantalla és un telèfon.** Allà la targeta és ampla (327px) i el
     problema no és el nom sinó el recorregut: 41 regidories eren 3.206px,
     gairebé quatre pantalles per a un sol bloc. */
@container (max-width:300px){
  .retrat{width:36px;height:36px}
  .retrat.inicials{font-size:.74rem}
  .grup li{padding:5px 0;gap:9px}
  .grup .qui{font-size:.86rem;line-height:1.25}
  .grup .carrec{font-size:.7rem}
}
@media (max-width:560px){
  .retrat{width:36px;height:36px}
  .retrat.inicials{font-size:.74rem}
  .grup li{padding:4px 0;gap:9px}
  .grup .qui{font-size:.88rem;line-height:1.25}
  .grup .carrec{font-size:.7rem}
}

/* --- el ple compacte: una fila de cares per grup ---------------------------
   Cada regidoria era una targeta de tres línies i un ple de vint-i-set feia
   quatre pantalles amb mitja de buit. Aquí cada grup és una línia amb la marca
   del color, el nom i el recompte, i a sota les cares en fila; el càrrec només
   s'escriu sota de qui mana. El nom hi és al «title» de l'enllaç i, per a qui
   llegeix amb veu, dins de l'enllaç mateix. */
.ple-compacte{display:grid;gap:var(--e2);margin-bottom:var(--e2)}
.grup-compacte{padding:10px 0 10px 14px;border-left:10px solid var(--c);border-radius:4px}
.grup-compacte.noadscrit{border-left-style:dashed}
.grup-compacte.al-govern{background:rgba(191,232,210,.16);border-radius:0 var(--r-s) var(--r-s) 0}
.grup-compacte h4{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-family:var(--display);
  font-weight:900;font-size:1rem;letter-spacing:-.01em;margin:0 0 8px}
.grup-compacte .marca-grup{width:13px;height:13px;border-radius:4px;background:var(--c);border:1.5px solid var(--ink);flex:none}
.grup-compacte .quants{font-family:var(--text);font-weight:700;font-size:.74rem;color:var(--ink-suau)}
.retrats{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:8px 6px;align-items:flex-start}
.retrats .persona{display:flex;flex-direction:column;align-items:center;gap:3px;width:60px}
.retrats .persona > a{display:block;border-radius:50%;line-height:0}
.retrats .persona > a:hover .retrat,.retrats .persona > a:focus-visible .retrat{box-shadow:var(--ombra);
  transform:translate(-1px,-1px)}
.retrats .retrat{transition:transform .12s ease,box-shadow .12s ease}
@media (prefers-reduced-motion:reduce){.retrats .retrat{transition:none}}
/* Qui mana porta la vora més gruixuda: l'alcaldia, i el govern quan les
   banderes es poden creure. És una diferència que es veu sense el color. */
.retrats .alcaldia .retrat{border-width:3px;width:48px;height:48px}
.retrats .govern .retrat{border-color:var(--ink);box-shadow:0 0 0 2px var(--menta)}
.retrats .carrec{font-size:.62rem;line-height:1.2;color:var(--ink-suau);font-weight:700;text-align:center;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;max-width:100%}
.retrats .alcaldia .carrec{color:var(--ink);font-weight:800}

/* --- alcaldies --- */
.alcaldies{width:100%;border-collapse:collapse;font-size:.94rem}
.alcaldies th,.alcaldies td{text-align:left;padding:9px 10px 9px 0;border-bottom:1px solid var(--vora);vertical-align:top}
/* Les capçaleres de taula, com estan escrites: «Any», «Alcaldia». En
   majúscules espaiades eren rètols, i les columnes no en necessiten cap. */
.alcaldies thead th{font-size:.8rem;font-weight:700;color:var(--ink-suau);border-bottom:2.5px solid var(--ink)}
.alcaldies tbody th{font-weight:800;white-space:nowrap;font-variant-numeric:tabular-nums}
/* El partit és la segona columna en importància i era la més esvaïda de la
   taula: anava amb el gris del text secundari, com la data. Ara va amb la
   tinta del cos i porta el color de la força al davant. */
.alcaldies .partit{font-weight:700;white-space:nowrap}
.alcaldies .punt-partit{display:inline-block;width:11px;height:11px;border-radius:3px;
  background:var(--c);border:1.5px solid var(--ink);margin-right:7px;vertical-align:-1px}
/* Dues files amb el mateix mandat volen dir un relleu a mig mandat: no és cap
   duplicat. El mandat continua escrit —amagar-lo obliga a mirar la fila de
   dalt— però esvaït, que és el que diu que ja s'ha llegit. */
.alcaldies tr.mateix-mandat th{color:var(--ink-suau);font-weight:600}
/* El nom de cada alcaldia porta a la seva fitxa, amb la cara al davant (vegeu
   cara.ts, en petit): tot dins del mateix enllaç, perquè la cara sola no
   sigui un segon lloc on clicar. */
.alcaldies .qui-alcaldia{display:inline-flex;align-items:center;gap:8px;font-weight:700;text-decoration:none}
.alcaldies .qui-alcaldia:hover,.alcaldies .qui-alcaldia:focus-visible{text-decoration:underline;text-decoration-thickness:2px}
/* «.marca-canvi» («canvi a mig mandat», «segons Wikidata») és un estat: la
   forma i el presec els porta la regla comuna de «les pastilles». */
/* Les alcaldies de fa més de deu anys. Mateixa manera de plegar que la lletra
   petita, perquè és el mateix tracte: hi són senceres, no s'obren soles. */
.mes-enrere{margin-top:var(--e2)}
.mes-enrere > summary{font-size:.82rem;font-weight:800;color:var(--ink-suau);cursor:pointer;
  list-style:none;display:inline-flex;align-items:center;gap:6px;min-height:30px;
  text-decoration:underline;text-decoration-color:var(--vora);text-underline-offset:3px}
.mes-enrere > summary::-webkit-details-marker{display:none}
.mes-enrere > summary::before{content:"+";font-weight:900;font-size:.92rem;line-height:1}
.mes-enrere[open] > summary::before{content:"−"}
.mes-enrere > summary:hover{color:var(--coral-text);text-decoration-color:currentColor}
.mes-enrere .alcaldies thead{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}

/* --- dotze eleccions, una columna cadascuna ---------------------------
   L'alçada de cada tros és la seva part del ple, no un valor absolut: el que
   interessa és qui el domina, no com de gran és. Per això hi ha la línia de la
   majoria absoluta al mig, que és l'única referència que importa de debò.
   El marge de la figura «.grafic» no és aquí: és a GRAFICS_CSS (grafics.ts),
   que va al final del full. Aquí n'hi havia un segon, i com que l'altre venia
   després i li guanyava, el «0 0 var(--e3)» d'aquí no feia res. */
.eleccions-marc{position:relative;padding-top:var(--e2)}
/* La línia de la majoria: al 50% de l'alçada de les columnes. */
.eleccions-marc .majoria{position:absolute;left:0;right:0;top:calc(var(--e2) + 108px);height:0;
  border-top:2.5px dashed var(--paper);pointer-events:none;z-index:2;mix-blend-mode:difference}
/* La ratlla no porta etiqueta a sobre: trepitjava les columnes. S'explica al peu. */
.eleccions{list-style:none;margin:0;padding:0;display:flex;gap:4px;align-items:flex-end}
.eleccions li{flex:1 1 0;display:flex;flex-direction:column;gap:6px;min-width:0}
.eleccions .pila{height:216px;display:flex;flex-direction:column-reverse;border:2px solid var(--ink);
  border-radius:var(--r-s);overflow:hidden;background:var(--paper-2)}
.eleccions .tros{height:var(--h);min-height:3px;background:var(--c);color:var(--t,#1E1B2E);font-size:.66rem;font-weight:900;
  display:flex;align-items:center;justify-content:center;box-shadow:inset 0 1px 0 rgba(30,27,46,.28);
  font-variant-numeric:tabular-nums}
.eleccions .tros.guanya{box-shadow:inset 0 0 0 2px var(--ink)}
.eleccions .peu-any{display:flex;flex-direction:column;align-items:center;line-height:1.15}
.eleccions .peu-any b{font-family:var(--display);font-weight:900;font-size:.82rem;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.eleccions .peu-any i{font-style:normal;font-size:.62rem;color:var(--ink-suau);font-variant-numeric:tabular-nums}
.clau{list-style:none;margin:var(--e2) 0 0;padding:0;display:flex;flex-wrap:wrap;gap:6px 14px;font-size:.8rem}
.clau li{display:flex;align-items:center;gap:6px}
.clau .mostra{width:12px;height:12px;border-radius:3px;background:var(--c);border:1.5px solid var(--ink)}
.grafic figcaption{font-size:.84rem;color:var(--ink-suau);margin-top:var(--e2)}
.grafic figcaption b{color:var(--ink)}
@media (max-width:620px){
  .eleccions{gap:2px}
  .eleccions .pila{height:160px}
  .eleccions-marc .majoria{top:calc(var(--e2) + 80px)}
  /* A 320px cada columna fa 21px i l'any en fa 25: els dotze anys es
     trepitjaven i quedaven il·legibles. */
  .eleccions .peu-any b{font-size:.58rem;letter-spacing:-.05em}
  .eleccions .peu-any i{display:none}
  .eleccions .tros{font-size:.55rem}
}

/* --- diners: import, regle i mediana --------------------------------- */
.diners{list-style:none;margin:0 0 var(--e2);padding:0;display:grid;gap:var(--e2)}
.diners li{display:grid;grid-template-columns:minmax(9em,auto) auto 1fr;gap:4px var(--e2);align-items:center}
.diners .etq{font-weight:800;font-size:.92rem}
.diners .imp{font-family:var(--display);font-weight:900;font-size:1.25rem;letter-spacing:-.02em;font-variant-numeric:tabular-nums;text-align:right}
/* L'etiqueta «mediana» penja de la marca, i la marca pot anar al 94% del
   regle: amb l'etiqueta a la dreta sortia de la pantalla i desplaçava la pàgina
   a totes les amplades. Ara va centrada a la marca i el regle es reserva el
   marge que li cal, perquè totes les files comparteixin la mateixa escala. */
.regle,.diners .regle{position:relative;height:16px;background:var(--vora);border-radius:var(--r-max);overflow:visible;margin:0 32px}
/* L'etiqueta de la mediana anava damunt del regle i el tapava justament allà
   on cal mirar-lo. Ara va per sobre, i la primera fila es reserva l'espai. */
.diners li:first-child .regle{margin-top:14px}
.regle i,.diners .regle i{display:block;height:100%;width:var(--w);background:var(--lavanda);border:1.5px solid var(--ink);border-radius:var(--r-max);min-width:3px}
.regle b,.diners .regle b{position:absolute;top:-5px;left:var(--m);width:2.5px;height:26px;background:var(--ink);border-radius:2px}
/* L'etiqueta de la marca cau damunt del regle, que ja va tenyit: amb el gris
   del text secundari s'hi quedava a 4,2:1, i a 9 px de lletra. Puja de mida i
   agafa el gris de les pastilles, que és el que aguanta damunt d'un fons. */
/* La paraula de la marca («habitual») va com està escrita: és una anotació
   del regle, no un rètol, i en majúscules espaiades feia el doble d'ample. */
.regle b span,.diners .regle b span{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(100% - 3px);text-align:center;
  font-size:.72rem;font-weight:700;letter-spacing:0;color:var(--ink-suau-tint);white-space:nowrap}
.diners li:not(:first-child) .regle b span{display:none}
.diners .comparativa{grid-column:1/-1;font-size:.8rem;margin-top:-2px}
/* A mòbil el regle ocupa tota la fila i no li sobra amplada per al marge: hi
   traiem l'etiqueta, que la frase de sota ja diu on és la mediana catalana. */
@media (max-width:560px){
  .diners li{grid-template-columns:1fr auto}
  .diners .regle{grid-column:1/-1;margin:0}
  .diners .regle b span{display:none}
}

/* Els mapes de quadres dels diners (el «treemap» d'on surten i on van) ja no
   hi són: deien la mateixa proporció que les barres de sota i les tapaven.
   El que en queda —«quadres.ts»— el fa servir l'índex de partits, que hi té
   el seu propi CSS. */

/* --- el rebut: una fila per cosa ------------------------------------------
   L'aigua eren sis paràgrafs i els tipus impositius, quatre targetes: ara és
   una llista de definició, amb el terme a l'esquerra i la xifra a la dreta, que
   es llegeix de dalt a baix. Els avisos que impedeixen llegir una xifra al
   revés —el total que no és el rebut sencer, la variació que no es pot
   interpretar— van a la seva fila, amb el presec de sempre, i no es pleguen. */
.rebut{margin:var(--e2) 0 0;display:grid;gap:0}
.rebut > div{display:grid;grid-template-columns:minmax(9em,13em) minmax(0,1fr);gap:4px var(--e3);
  padding:10px 0;border-top:1px solid var(--vora);align-items:baseline}
.rebut > div:first-child{border-top:0}
.rebut dt{font-weight:800;font-size:.9rem;line-height:1.3}
.rebut dd{margin:0;min-width:0;display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 8px}
.rebut dd > b{font-family:var(--display);font-weight:900;font-size:1.15rem;letter-spacing:-.02em;
  font-variant-numeric:tabular-nums}
.rebut .principal dd > .xifra{font-size:1.9rem;letter-spacing:-.03em;line-height:1}
.rebut dd .sub{font-size:.82rem;color:var(--ink-suau);font-weight:700}
.rebut dd .nota-linia,.rebut dd .avis-dada{flex:1 0 100%;margin:4px 0 0}
.rebut dd .avis-dada{display:block;font-size:.88rem;padding:10px 12px}
.rebut dd .espurna{flex:1 0 100%;max-width:200px}
@media (max-width:520px){ .rebut > div{grid-template-columns:1fr;gap:2px} }
.comparativa{font-size:.78rem;color:var(--ink-suau)}
/* «Per sobre» i «per sota» de la mediana porten el mateix pes i el mateix
   color. Abans el «per sobre» anava en coral i el «per sota» en gris, i això
   és un veredicte pintat: diu que gastar més que la mediana és l'alarma i
   gastar-ne menys, la calma, quan la xifra sola no diu si és bo ni dolent. El
   negre marca que la distància és gran (més d'un 15 %), en un sentit o en
   l'altre; «a tocar» queda en gris perquè no hi ha distància a dir. */
.comparativa.mes,.comparativa.menys{color:var(--ink);font-weight:700}

/* --- el balanç del mandat -------------------------------------------
   Tres columnes de xifra i una fletxa al mig. La diferència va en tinta
   normal, A POSTA: abans anava en verd quan la xifra «millorava» i en coral
   quan «empitjorava», i això és un veredicte pintat sobre una dada, que és el
   que la metodologia (docs/METODOLOGIA.md) no permet. Un deute que baixa no
   és «bo» sense saber què s'ha deixat de fer, i el color ho deia igualment.
   La direcció es llegeix per la fletxa, pel signe i per la lletra petita; les
   classes «millor», «pitjor» i «igual» de la fila es queden a l'HTML per a
   qui les vulgui llegir, però no pinten cap color. «igual» només s'atenua:
   «sense canvi» no és cap judici. */
.balanc{width:100%;border-collapse:collapse;font-size:.95rem}
.balanc thead th{font-size:.8rem;color:var(--ink-suau);
  text-align:right;padding:0 0 8px;border-bottom:2.5px solid var(--ink);font-weight:700}
.balanc thead th:first-child{text-align:left}
.balanc tbody th{text-align:left;font-weight:800;padding:14px 12px 14px 0;vertical-align:top;line-height:1.25}
.balanc td{text-align:right;padding:14px 0;vertical-align:top;font-variant-numeric:tabular-nums;
  border-bottom:1px solid var(--vora)}
.balanc tbody th{border-bottom:1px solid var(--vora)}
.balanc .abans{color:var(--ink-suau)}
.balanc .ara{font-family:var(--display);font-weight:900;font-size:1.2rem;letter-spacing:-.02em}
.balanc .fletxa{width:2.2em;font-size:1.1rem;color:var(--ink-suau)}
.balanc .canvi{font-weight:800;padding-left:12px;white-space:nowrap}
.balanc tr.igual .canvi{color:var(--ink-suau);font-weight:600}
.peu-nota{display:block;font-size:.76rem;font-weight:500;color:var(--ink-suau);margin-top:3px;line-height:1.35;max-width:34ch}
.balanc .canvi .peu-nota{text-align:right;max-width:none}
.destacat{background:var(--presec);color:#1E1B2E;border:2.5px solid var(--ink);border-radius:var(--r-m);
  box-shadow:var(--ombra);padding:var(--e2);margin:var(--e3) 0 0;font-size:1rem}
/* A mòbil, el balanç del mandat es plega en fitxes: el nom a dalt, «abans →
   ara» a sota i la diferència al peu. Aquest plegat només té sentit per a la
   taula que té aquestes cel·les —abans, fletxa, ara, diferència— i per això va
   lligat a «:has(td.fletxa)»: la cel·la, i no el <span class="fletxa"> que la
   criminalitat posa dins del canvi. La classe «balanc» la reutilitzen altres taules
   (criminalitat, la sèrie any a any, cens, llistes obertes, vehicles) amb
   columnes que no són aquestes: plegades així perdien la capçalera i
   quedaven com una tira de números sense nom, amb una fletxa enganxada a la
   mediana. Aquelles es queden en taula, dins de «.taula-envolta», que llisca
   de costat i manté la capçalera a la vista. */
/* Les altres taules «balanc» posen xifra al costat de xifra, i sense cap
   coixí entre columnes les capçaleres s'enganxaven: «2025» i «per 1.000 hab.»
   es llegien «20251.000 hab.». */
.balanc:not(:has(td.fletxa)) thead th + th,.balanc:not(:has(td.fletxa)) td{padding-left:12px}
@media (max-width:620px){
  .balanc:has(td.fletxa) thead{display:none}
  .balanc:has(td.fletxa) tr{display:grid;grid-template-columns:1fr auto;gap:2px 10px;padding:12px 0;border-bottom:1px solid var(--vora)}
  .balanc:has(td.fletxa) tbody th,.balanc:has(td.fletxa) td{border:0;padding:0;text-align:left}
  .balanc:has(td.fletxa) tbody th{grid-column:1/-1}
  .balanc:has(td.fletxa) .fletxa{display:none}
  .balanc:has(td.fletxa) .abans::after{content:" →";color:var(--ink-suau)}
  .balanc:has(td.fletxa) .abans,.balanc:has(td.fletxa) .ara{display:inline}
  .balanc:has(td.fletxa) .canvi{grid-column:1/-1;text-align:left;padding:2px 0 0}
}

/* --- de qui és cada tram de la sèrie --- */
.clau-mandats{list-style:none;margin:var(--e2) 0 0;padding:0;display:flex;flex-wrap:wrap;gap:6px 16px;font-size:.78rem;color:var(--ink-suau)}
.clau-mandats li{display:flex;align-items:center;gap:6px}
.clau-mandats .tram-mandat{width:14px;height:14px;border-radius:3px;border:1.5px solid var(--ink);background:var(--lavanda)}
.clau-mandats .mandat-2019-2023 .tram-mandat,li.mandat-2019-2023 .tram-mandat{background:var(--menta)}
.clau-mandats li.mandat-2015-2019 .tram-mandat{background:var(--presec)}

/* --- els indicadors de la comarca -------------------------------------
   Era el «semàfor financer»: targetes amb una franja menta, presec o coral
   segons si la xifra era «bona», «d'avís» o «d'alerta». Això és un veredicte
   pintat, i cap pàgina ja no el fa servir —les classes «nivell-*» no surten
   enlloc—, així que les regles s'han tret. El que en queda són xifres en
   filera, i van com l'ullada: un filet a sobre i un buit entre columnes, sense
   contorn, ombra ni franja. */
.indicadors{list-style:none;margin:0 0 var(--e3);padding:0;display:grid;gap:0 var(--e3);grid-template-columns:repeat(auto-fit,minmax(min(230px,100%),1fr))}
.indicador{border-top:1.5px solid var(--vora);padding:var(--e2) 0;display:flex;flex-direction:column;gap:6px;min-width:0}
.indicador .nom{font-size:.8rem;font-weight:700;color:var(--ink-suau)}
/* La sèrie de dotze anys dins de la targeta de l'indicador: més curta que la
   de les targetes grans, perquè aquí competeix amb la xifra i no l'ha de
   guanyar. */
.indicador .espurna{margin:4px 0 0}
.indicador .espurna svg{height:34px}
.indicador .espurna .ara{width:8px;height:8px}
.indicador .secundari{font-size:.82rem;line-height:1.4}
.subtitol{font-family:var(--display);font-weight:900;font-size:1.05rem;margin:var(--e3) 0 var(--e2)}
/* Un subtítol amb àncora dins d'un bloc fusionat («#balanc», «#com-queda»)
   es llegeix com el títol que era, una mica més gran que el subtítol corrent. */
.subtitol[id]{font-size:1.25rem;margin-top:var(--e4)}
.subtitol.primer[id]{margin-top:0}

/* --- el pont amb l'elecció -------------------------------------------
   Tota fitxa ha d'acabar parlant del 23-M: si no, això és un dossier
   d'estadística municipal i no una eina per decidir un vot. */
.bloc.joc{background:var(--lavanda);color:#1E1B2E;border:2.5px solid #1E1B2E;border-radius:var(--r-l);
  box-shadow:6px 6px 0 #1E1B2E;padding:var(--e4) var(--e3);margin-top:var(--e4)}
.bloc.joc h2{margin-bottom:var(--e2)}
.bloc.joc .entrada-bloc,.bloc.joc p{color:#1E1B2E}
.bloc.joc .nota{color:rgba(30,27,46,.74)}
.bloc.joc .crida{font-family:var(--display);font-weight:900;font-size:1.15rem;letter-spacing:-.02em;
  line-height:1.35;margin-top:var(--e3)}
.bloc.joc .crida a{background:#1E1B2E;color:#FBF7EE;text-decoration:none;border-radius:var(--r-max);
  padding:8px 18px;display:inline-flex;align-items:center;min-height:44px;margin-top:var(--e1);font-size:.95rem;
  box-shadow:3px 3px 0 rgba(30,27,46,.3);transition:transform .12s ease,box-shadow .12s ease}
.bloc.joc .crida a:hover{transform:translate(2px,2px);box-shadow:1px 1px 0 rgba(30,27,46,.3)}
@media (prefers-reduced-motion:reduce){.bloc.joc .crida a{transition:none}}

/* --- la banda del 23-M, sota l'ullada --------------------------------------
   Era l'última secció de la fitxa i és l'única que parla de l'elecció: ara va
   abans de l'índex. La papereta hi és a l'esquerra en una columna de 96 px,
   que és la mida a què la cara encara es llegeix; les quatre tires de sota
   són les mateixes que a la resta de la fitxa, però damunt de la lavanda van
   sempre de paper blanc amb tinta fosca, també en fosc: la banda porta la
   tinta escrita a mà i el gris del text s'hi ha de girar amb ella. */
.joc-banda{background:var(--lavanda);color:#1E1B2E;border:2.5px solid #1E1B2E;border-radius:var(--r-l);
  box-shadow:6px 6px 0 #1E1B2E;padding:var(--e3);margin-top:var(--e4);
  display:grid;grid-template-columns:96px minmax(0,1fr);column-gap:var(--e3);align-items:start}
.joc-banda .mascota{grid-column:1;padding-top:4px}
.joc-banda .cos-joc{grid-column:2;min-width:0}
.joc-banda h2{margin-bottom:var(--e2)}
.joc-banda p{color:#1E1B2E}
.joc-banda .nota,.joc-banda .nota > summary,.joc-banda .nota > :not(summary){color:rgba(30,27,46,.74)}
.joc-banda .nota-linia{font-size:.9rem;margin:var(--e2) 0 0}
/* Les tires d'aquí eren capses blanques amb ombra damunt de la lavanda. Ara
   són com totes les altres —un filet a sobre i prou—, amb el filet de tinta
   fosca perquè el gris de la casa no es veu damunt del lila. */
.joc-banda .tires > li{color:#1E1B2E;border-top-color:rgba(30,27,46,.24)}
.joc-banda .tires .etq,.joc-banda .tires .peu{color:#524D63}
/* La lavanda no s'enfosqueix en mode fosc, i la tinta del cos sí: el que
   dins de les tires va amb «var(--ink)» s'hi tornaria clar sobre clar. */
.joc-banda .tires .peu b,.joc-banda .tires .canvi b,.joc-banda .espurna{color:#1E1B2E}
/* I el coral de text, que damunt del blanc de les capses d'abans feia 5:1,
   damunt de la lavanda es queda a 3,5:1: l'enllaç «entre els 947» hi va de
   tinta fosca, amb el subratllat coral que ja diu que és un enllaç. */
.joc-banda .tires .peu .entre-947{color:#1E1B2E;text-decoration-color:var(--coral-text)}
.joc-banda .crida{display:flex;flex-wrap:wrap;align-items:center;gap:var(--e2);margin:var(--e3) 0 0;
  font-family:var(--display);font-weight:900;font-size:1.05rem;letter-spacing:-.02em;line-height:1.35}
.joc-banda .crida-text{flex:1 1 20rem;min-width:0}
.joc-banda .boto-joc{background:#1E1B2E;color:#FBF7EE;text-decoration:none;border-radius:var(--r-max);
  padding:8px 20px;display:inline-flex;align-items:center;min-height:44px;font-size:.95rem;
  box-shadow:3px 3px 0 rgba(30,27,46,.3);transition:transform .12s ease,box-shadow .12s ease}
.joc-banda .boto-joc:hover{transform:translate(2px,2px);box-shadow:1px 1px 0 rgba(30,27,46,.3)}
.joc-banda .avisa{display:inline-flex;align-items:center;min-height:44px;font-family:var(--text);
  font-weight:800;font-size:.88rem;color:#1E1B2E;text-underline-offset:4px}
.joc-banda .pastilles-context a{color:#1E1B2E}
.joc-banda .pastilles-context a b{text-decoration-color:#1E1B2E}
.joc-banda .pastilles-context a span{color:#524D63}
.joc-banda .pastilles-context a:hover b{color:#1E1B2E;text-decoration-thickness:3px}
@media (prefers-reduced-motion:reduce){.joc-banda .boto-joc{transition:none}}
/* Les pastilles de la banda del joc a un mòbil: 2+2 i no una columna de
   quatre, que era mitja pantalla. Dins de la banda el mínim general de 160 px
   no hi cap mai —la mascota ja es menja 80— i per això es fixen dues columnes
   i es rebaixa el coixí. */
@media (max-width:620px){
  .joc-banda .tires{grid-template-columns:repeat(2,minmax(0,1fr));column-gap:var(--e2)}
  .joc-banda .tires > li{padding:12px 0}
  .joc-banda .tires .xifra{font-size:1.4rem}
}
@media (max-width:560px){
  .joc-banda{grid-template-columns:64px minmax(0,1fr);column-gap:var(--e2);padding:var(--e2)}
  .joc-banda .papereta{width:64px;height:75px}
}

/* --- les tires: la xifra petita de tota la fitxa --------------------------
   Etiqueta, xifra gran i peu petit, com a l'ullada. Les targetes de «Qui hi
   viu» i de «Quant fa que mana» eren cadascuna d'una mida i amb quatre línies
   de text a dins; aquestes en tenen tres i el que no hi cap va a la lletra
   petita. La graella s'omple amb les que hi ha: cinc caben en una fila a
   900 px i en dues a un telèfon.

   Eren capses amb contorn de tinta i ombra dura, totes iguals en filera: el
   kit de targetes que la marca no vol, i una cinquena manera de dibuixar una
   xifra a la mateixa fitxa. Ara són el component de l'ullada —filet a sobre,
   buit entre columnes— i res més. */
.tires{list-style:none;margin:var(--e2) 0 0;padding:0;display:grid;
  grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:0 var(--e3)}
/* Les d'una mateixa fila fan la mateixa alçada —l'estirament per defecte de
   la graella— i el peu es queda enganxat a baix: l'espai que sobra queda entre
   la xifra i el peu, i els peus de la fila comencen a la mateixa línia. */
.tires > li{border-top:1.5px solid var(--vora);padding:var(--e2) 0;display:flex;flex-direction:column;gap:3px;min-width:0}
.tires > li > a{display:flex;flex-direction:column;gap:3px;text-decoration:none;color:inherit;flex:1 1 auto}
.tires > li > a:hover .xifra{color:var(--coral-text)}
.tires .peu:last-child{margin-top:auto}
.tires .etq{font-size:.8rem;font-weight:700;color:var(--ink-suau);line-height:1.25}
.tires .xifra{font-family:var(--display);font-weight:900;font-size:1.7rem;line-height:1.05;
  letter-spacing:-.03em;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.tires .xifra .sigla{font-size:.62em;vertical-align:.18em}
.tires .peu{font-size:.76rem;color:var(--ink-suau);line-height:1.35;font-weight:700}
.tires .peu b,.tires .canvi b{color:var(--ink)}
.tires .canvi,.tires .compta{font-size:.74rem;color:var(--ink-suau);font-weight:700;line-height:1.35;margin:0}
.tires .espurna{margin:6px 0 0}
.tires .espurna svg{height:34px}
.tires .font-idescat{padding-top:6px}
/* «Qui hi viu» no s'omple amb les que hi ha: són tres columnes i prou.
   Amb «auto-fit» i sis tessel·les, a 1.100 px en sortien sis en una fila de
   160 px cadascuna, amb l'espurna i tres línies de peu esclafades a dins, i
   es llegia com un tauler i no com tres xifres. Tres a escriptori, dues a una
   tauleta i una a un telèfon; les edats, que eren tres tessel·les més, van a
   la taula de sota. */
.gent-tires{grid-template-columns:repeat(3,minmax(0,1fr))}
@media (max-width:760px){ .gent-tires{grid-template-columns:repeat(2,minmax(0,1fr))} }
@media (max-width:440px){ .gent-tires{grid-template-columns:minmax(0,1fr)} }
/* La taula de les edats: una fila per tram, la xifra d'aquí en gran, la
   forma de la sèrie al costat i, a la dreta, amb qui es compara. Va dins de
   «.taula-envolta» perquè a 320 px llisqui ella i no la pàgina. */
.edats{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}
.edats caption{text-align:left;font-weight:800;font-size:.95rem;padding:0 0 8px;caption-side:top}
.edats th,.edats td{text-align:right;padding:8px 10px;border-bottom:1px solid var(--vora);
  font-size:.92rem;white-space:nowrap;vertical-align:middle}
.edats thead th{font-family:var(--display);font-weight:900;font-size:.78rem;color:var(--ink-suau);
  white-space:normal;vertical-align:bottom;line-height:1.2}
.edats tbody th{text-align:left;font-weight:900;white-space:normal;min-width:9em}
.edats td.aqui{font-family:var(--display);font-weight:900;font-size:1.15rem;letter-spacing:-.02em}
.edats td.serie-edat{padding-top:4px;padding-bottom:4px}
.edats .espurna{width:120px;margin:0}
.edats .espurna svg{height:30px}
@media (max-width:400px){ .edats th,.edats td{padding:8px 5px;font-size:.84rem} }
/* Una nota d'una línia i prou, dins d'un bloc: no és lletra petita que es
   plega ni un avís de color, és una frase que es llegeix de passada. */
.nota-linia{font-size:.9rem;color:var(--ink-suau);margin:var(--e2) 0 0}
.nota-linia b{color:var(--ink)}

/* Text secundari dins d'una pastilla de color. Va junt perquè la llista de
   pastilles és tancada i perquè si un dia se n'afegeix una, aquí es veu que
   li falta. */
.destacat .peu-nota,.destacat .secundari,.destacat .nota,
.avis-dades .secundari,.avis-dades .nota,
.avis-dada .secundari,.avis-dada .nota,.avis-dada .compta,
.context-avis .secundari,.context-avis .nota,.context-avis .compta,
.bloc.joc .secundari,.banda .secundari,.banda .nota{color:var(--ink-suau-tint)}
/* Aquestes tres es queden clares també en fosc: hi porten la tinta fosca
   escrita a mà, i per tant el gris secundari hi ha de tornar a ser el fosc. */
@media (prefers-color-scheme:dark){
  .destacat,.avis-dades,.bloc.joc{--ink-suau-tint:#524D63}
}
.avis-dades{background:var(--presec);color:#1E1B2E;border:2.5px solid var(--ink);border-radius:var(--r-m);
  box-shadow:var(--ombra);padding:var(--e2);margin:0 0 var(--e2);font-size:.95rem}

/* --- on anar després: les peces han d'estar connectades entre elles ------
   «Segueix estirant», al final de la pàgina d'una persona, d'una alcaldia
   històrica o de les preguntes. Eren tres o quatre targetes idèntiques amb
   contorn de tinta i ombra que s'enfonsava en passar-hi per sobre: el kit de
   targetes de plantilla que la marca no vol, i amb pinta de botó per a una
   cosa que és un enllaç.

   Ara és una llista de files amb un filet entre elles, com el rebut o els
   acumulats: el destí en titular subratllat —que és el que diu que s'hi pot
   anar— i a sota, en gris, què s'hi troba. Amb amplada en fan dues columnes. */
.destins{list-style:none;margin:0;padding:0;display:grid;gap:0 var(--e4);
  grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr))}
.destins > li{border-top:1px solid var(--vora)}
.destins > li > a{display:flex;flex-direction:column;gap:3px;padding:14px 0;min-height:44px;
  text-decoration:none;color:inherit}
.destins b{font-family:var(--display);font-weight:900;font-size:1.1rem;letter-spacing:-.02em;line-height:1.2;
  text-decoration:underline;text-decoration-color:var(--coral);text-decoration-thickness:2px;text-underline-offset:4px}
.destins > li > a:hover b{color:var(--coral-text)}
.destins span{font-size:.86rem;color:var(--ink-suau);line-height:1.4}
.destins span a{color:inherit}

/* --- què publica i què no ---------------------------------------------
   El senyal no és només color: hi ha la marca, la paraula i la posició. Qui no
   distingeixi el verd del vermell ho ha de poder llegir igual. */
.transparencia{list-style:none;margin:0 0 var(--e2);padding:0}
.transparencia li{display:flex;align-items:baseline;gap:10px;padding:9px 0;border-bottom:1px solid var(--vora)}
.transparencia .senyal{font-weight:900;font-size:1rem;flex:none;width:1.1em;text-align:center}
.transparencia .hi-es .senyal{color:var(--ink)}
.transparencia .no-hi-es .senyal{color:var(--ink-suau)}
@media (prefers-color-scheme:dark){.transparencia .hi-es .senyal{color:var(--paper)}}
/* flex-basis:0 en comptes d'auto: amb auto, un nom llarg («Incompatibilitats
   dels càrrecs») feia que el bloc no hi cabés i saltés de línia deixant el
   senyal sol. Ara el nom s'encongeix i el senyal es queda al seu costat. */
.transparencia .dades{display:flex;flex-direction:column;gap:1px;flex:1 1 0;min-width:0}
.transparencia .nom{font-weight:800;font-size:.94rem;overflow-wrap:anywhere}
.transparencia .no-hi-es .nom{color:var(--coral-text)}
.transparencia .quan{font-size:.76rem;color:var(--ink-suau);white-space:nowrap;flex:none}
/* Com de comú és publicar aquest apartat, en barra. La proporció es veu; el
   percentatge hi és al costat perquè una barra sola no és una dada llegible. */
.transparencia .quants-cat{display:flex;align-items:center;gap:8px;margin-top:3px;max-width:230px}
.transparencia .quants-cat i{display:block;flex:1 1 auto;height:5px;background:var(--vora);
  border-radius:var(--r-max);position:relative;overflow:hidden}
.transparencia .quants-cat i::after{content:"";position:absolute;inset:0 auto 0 0;width:var(--w);
  background:var(--menta);border-radius:var(--r-max)}
.transparencia .quants-cat b{font-size:.72rem;font-weight:800;color:var(--ink-suau);
  font-variant-numeric:tabular-nums;flex:none;min-width:2.6em}
/* A mòbil la data no hi cap al costat del nom i s'hi encavalcava a sobre. */
@media (max-width:560px){
  .transparencia li{flex-wrap:wrap}
  .transparencia .quan{flex:1 0 100%;padding-left:calc(1.1em + 10px)}
}

/* --- on és, i com queda ---------------------------------------------- */
.on-es{margin:var(--e3) 0 0;max-width:300px}
.on-es .mapa{width:100%;height:auto;display:block}
.on-es .mapa .punts circle{fill:var(--vora)}
.on-es figcaption{font-size:.78rem;color:var(--ink-suau);margin-top:6px}

.com-queda{list-style:none;margin:0 0 var(--e2);padding:0;display:grid;gap:10px}
.com-queda li{display:grid;grid-template-columns:minmax(9em,14em) 1fr auto;gap:4px var(--e2);align-items:center}
.com-queda .etq{font-weight:800;font-size:.9rem}
.com-queda .barra-peer{height:14px;background:var(--vora);border-radius:var(--r-max);overflow:hidden}
.com-queda .barra-peer i{display:block;height:100%;width:var(--w);border-radius:var(--r-max);
  border:1.5px solid var(--ink);background:var(--lavanda);min-width:4px}
.com-queda .posicio-dalt .barra-peer i{background:var(--menta)}
.com-queda .posicio-baix .barra-peer i{background:var(--coral)}
.com-queda .lloc{font-size:.8rem;color:var(--ink-suau);white-space:nowrap;font-variant-numeric:tabular-nums}
@media (max-width:560px){
  .com-queda li{grid-template-columns:1fr auto}
  .com-queda .barra-peer{grid-column:1/-1}
}

/* --- cobertura --- */
.cobertura{border-left:10px solid var(--menta);padding-left:var(--e3)}
.cobertura-parcial{border-left-color:var(--presec)}
.cobertura-cap{border-left-color:var(--coral)}
.fonts ul{margin:0;padding-left:1.1em;font-size:.92rem;color:var(--ink-suau)}
.fonts code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.85em;background:var(--paper-2);border:1px solid var(--vora);border-radius:5px;padding:1px 5px}
/* Aquí hi havia «.peu{…}», la regla del peu de pàgina antic: 900 px d'ample,
   «margin:0 auto», farciment i una ratlla de tinta a sobre. El peu de pàgina
   d'ara és «footer.peu» i té el seu full (peu.ts, PEU_CSS, que va al final i
   ho reescriu tot), però la regla nua casava també amb cada
   <span class="peu"> de les pastilles —ullada, tires, regidor, vehicles—: el
   peu de cada xifra quedava centrat i amb una ratlla negra flotant a sobre.
   No en queda res que la necessiti, i per això s'ha tret sencera. */

/* --- la portada, en dues columnes ------------------------------------
   El mapa anava sota de tot i amidava 300px: en una pantalla d'escriptori
   quedava mig full buit a la dreta del títol i el mapa empenyia l'índex fora de
   la primera pantalla. Posat al costat fa la feina que ha de fer —situar el
   poble abans de començar a llegir— i deixa la portada plena. */
@media (min-width:820px){
  .portada{display:grid;grid-template-columns:minmax(0,1fr) minmax(230px,300px);
    column-gap:var(--e5);align-items:start}
  .portada > *{grid-column:1}
  .portada .on-es{grid-column:2;grid-row:1 / span 99;max-width:none;width:100%;margin:6px 0 0}
}

/* --- l'índex com a rail, quan hi ha marge per posar-l'hi ---------------
   Amb dotze blocs, l'índex és el que fa navegable la pàgina, i com a filera de
   pastilles només serveix un cop: en el moment que s'ha passat de llarg ja no
   hi és. A partir de 1180px hi ha lloc per deixar-lo a la vista tota l'estona
   sense robar amplada al text, que es queda igual d'ample que abans.

   Les dues columnes són NOMÉS per a les pàgines que tenen rail, és a dir, les
   que porten el <nav class="index"> com a fill directe del <main> (fitxa
   municipal, comarca, partit, candidatura, diputació i consell, AMB, els que
   manen). Abans la graella era de tot <main>, i les pàgines sense índex —els
   partits, el comparador, els rànquings, la fitxa de regidor, els 947—
   quedaven amb 186 px de no-res a l'esquerra i el contingut empès a la dreta;
   dues s'ho havien arreglat cadascuna pel seu compte. Ara la regla de base és
   la d'abans i la que la desfà demana «:has()»: un navegador que no l'entén
   llença la regla sencera i es queda amb el comportament antic, que és lleig
   però es llegeix. Sense rail, el <main> torna a la columna de sempre
   (--ample-columna) i la capçalera es queda a 1.180, com a totes les altres. */
@media (min-width:1180px){
  :root{ --ample:1180px }
  main{display:grid;grid-template-columns:186px minmax(0,1fr);column-gap:var(--e5);align-items:start}
  main > *{grid-column:2;min-width:0}
  main:not(:has(> .index)){display:block;max-width:var(--ample-columna)}
  /* El rail és l'índex fill directe del <main>. Un «.index» de dins d'un bloc
     —la llista de les 42 comarques dels 947— és una llista d'enllaços i prou,
     i amb «.index» a seques es convertia en una columna de 42 files. */
  main > .index{grid-column:1;grid-row:1 / span 99;position:sticky;top:var(--e3);align-self:start;
    display:flex;flex-direction:column;gap:0;border-top:0;margin-top:0;padding:var(--e5) 0 0}
  main > .index a{border:0;border-left:2.5px solid var(--vora);border-radius:0;min-height:0;
    padding:8px 0 8px 14px;font-size:.82rem;justify-content:flex-start;line-height:1.25;
    text-decoration:none;transition:border-color .12s ease,color .12s ease}
  main > .index a:hover{background:none;color:var(--coral-text);border-left-color:var(--coral)}
  /* Al rail la marca és la barra de l'esquerra, que és el que dibuixa el
     recorregut de la pàgina: es veu on ets i quant en queda. */
  main > .index a[aria-current]{background:none;color:var(--ink);font-weight:900;
    border-left-color:var(--ink);border-left-width:4px;padding-left:12px}
  /* Una línia de text de 1.180px no es llegeix: l'amplada de més va als blocs
     de dades i la prosa es queda on ha d'estar. */
  .bloc > p,.entrada-bloc,.nota,.compta,figcaption,.peu-nota{max-width:70ch}
}
/* El «transition:none» de dalt (el de l'índex en pastilles) arriba abans i pesa
   menys que el rail: sense repetir-lo aquí, qui demana menys moviment el tenia
   igualment a la barra de l'esquerra. */
@media (min-width:1180px) and (prefers-reduced-motion:reduce){ main > .index a{transition:none} }
@media (max-width:560px){ .alcaldies thead{display:none} .alcaldies tr{display:grid;grid-template-columns:auto 1fr;gap:0 var(--e2);padding:var(--e1) 0;border-bottom:1px solid var(--vora)} .alcaldies th,.alcaldies td{border:0;padding:1px 0} .alcaldies tbody th{grid-row:span 3} }

/* La crida a respondre les preguntes: ha de destacar sobre el text de la pàgina
   sense semblar publicitat, perquè el que hi ha darrere és un esborrany.
   El text hi va en tinta fosca i no en paper: paper sobre coral es queda a
   2,9:1, i la tinta hi puja a 5,5:1 amb el mateix parell de colors que ja fan
   servir les altres pastilles de la casa. */
/* La mascota presentant una pàgina: al costat del títol i no a sobre, perquè
   en mòbil un dibuix de 120 px damunt del títol empeny el contingut fora de
   la primera pantalla. */
.presenta{display:flex;align-items:center;gap:var(--e3);flex-wrap:wrap}
.presenta>div{flex:1 1 14rem;min-width:0}
.presenta .papereta{flex:0 0 auto}
@media (max-width:520px){.presenta .papereta{width:84px;height:98px}}
/* Per sota de 420 px la papereta de 84 i el bloc del títol, que demana 14rem,
   no hi cabien de costat: la papereta queia sola a una fila i es menjava 120 px
   de la primera pantalla a cada pàgina que la porta. Aquí es queden de costat,
   amb la papereta a 64 i el títol amb base zero, que vol dir «ocupa el que
   quedi» i no «salta de línia si no tens 14rem». El títol baixa una mica de
   cos perquè hi càpiga un nom de poble llarg sense sortir de la pantalla, i si
   una paraula encara no hi cap es parteix abans que fer lliscar la pàgina.
   Va lligat a la papereta («.papereta + div») a posta: la Catalunya de la
   portada, de 150 px, no hi cap de costat ni amb tot això i continua a sobre. */
@media (max-width:420px){
  .presenta{column-gap:var(--e2)}
  .presenta .papereta{width:64px;height:75px}
  .presenta .papereta + div{flex-basis:0}
  .presenta .papereta + div h1{font-size:clamp(1.9rem,8.2vw,2.6rem);overflow-wrap:break-word}
}
/* Una afirmació amb una cita que no hem trobat: es veu que està tocada sense
   haver de llegir el text, i no es confon amb les bones. */
.pregunta.cita-fallida{border-style:dashed;opacity:.85}
.avis-cita{background:var(--coral);color:#FBF7EE;border:2.5px solid var(--ink);
  border-radius:var(--r-m);padding:var(--e2);margin:0 0 var(--e2);font-size:.9rem}
/* El districte d'una afirmació, a les ciutats que en tenen. */
/* És un estat (vegeu «les pastilles»): sense vora ni majúscules, i amb la
   lavanda que ja portava. */
.districte{margin-left:8px;background:var(--lavanda);color:#1E1B2E}
/* Com ha anat el mandat: el canvi del poble i el dels seus, un al costat de
   l'altre. El salt va en color de tinta, A POSTA, com a la taula del balanç:
   abans anava en verd quan «millorava» i en coral quan «empitjorava», i això
   és un veredicte pintat sobre una dada. El signe i la frase de sota diuen cap
   on va; qui jutja és qui llegeix. Les classes millora/empitjora es queden per
   a qui vulgui llegir-les al codi, sense color. */
/* Sis targetes amb contorn de 2,5px i ombra dura per a una etiqueta i un salt:
   el marc pesava més que la dada i les sis juntes feien 2.751px. És una taula
   de comparació, no sis fets independents, i com a llista amb un filet i la
   icona del tema al davant es compara millor i ocupa la meitat. */
.mandat{list-style:none;margin:var(--e3) 0 0;padding:0;display:grid;gap:0}
.mandat li{padding:12px 0;border-top:1px solid var(--vora);display:grid;gap:1px var(--e2);
  grid-template-columns:32px 1fr auto;align-items:baseline}
.mandat li:first-child{border-top:0}
.mandat .tema{grid-row:1 / span 2;align-self:center}
.mandat .tema .icona{width:28px;height:28px;display:block}
.mandat .etq{font-family:var(--display);font-weight:900;font-size:1.05rem;letter-spacing:-.01em}
.mandat .salt{font-family:var(--display);font-weight:900;font-size:1.35rem;text-align:right;
  font-variant-numeric:tabular-nums}
.mandat .dedes{grid-column:2;font-size:.84rem;color:var(--ink-suau);font-weight:700}
.mandat .del-grup{grid-column:3;text-align:right;font-size:.8rem;color:var(--ink-suau);font-weight:700}
@media (max-width:520px){
  .mandat li{grid-template-columns:32px 1fr}
  .mandat .salt{grid-column:2;text-align:left}
  .mandat .del-grup{grid-column:2;text-align:left}
  .mandat .dedes{grid-column:2}
  .mandat .tema{grid-row:1 / span 4}
}
/* --- qui hi viu i què paga la gent ---------------------------------------
   Dos blocs de xifres amb molt text al costat: cada número hi va acompanyat de
   què compta exactament i de l'enllaç de la font, que a l'Idescat no és cap
   cortesia sinó una condició de la llicència. La targeta és la mateixa peça de
   sempre —contorn negre, ombra dura, fons paper— perquè es llegeixin com el
   mateix objecte que la resta de la fitxa. */
h2.amb-icona{display:flex;align-items:center;gap:12px}
h2.amb-icona .icona{width:40px;height:40px;flex:0 0 auto}
@media (max-width:400px){ h2.amb-icona .icona{width:32px;height:32px} }

/* --- la vida de les icones ------------------------------------------------
   Els mateixos keyframes de la identitat, copiats de «design/prototip/base.css»
   i no reinventats: si aquí es fes una altra versió del parpelleig, la portada i
   la fitxa serien dues cases diferents. El retard el porta cada icona escrit a
   l'atribut «style», i és el que fa que setze cares no parpellegin alhora.

   Les parpelles estan aixafades en repòs i s'obren per parpellejar, no al
   revés: així, sense animació, l'ull es queda obert i no mig tapat. */
.icona .parpelles{transform-box:fill-box;transform-origin:center;transform:scaleY(0);
  animation:parpelleig 6.5s var(--retard,0s) infinite}
.icona .pupilles{transform-box:fill-box;transform-origin:center;
  animation:mirar 9s var(--retard,0s) infinite}
@keyframes parpelleig{0%,93%{transform:scaleY(0)}94.5%{transform:scaleY(1)}96%,100%{transform:scaleY(0)}}
@keyframes mirar{0%,38%{transform:translate(0,0)}44%,56%{transform:translate(1.5px,0)}62%,74%{transform:translate(-1.5px,.4px)}80%,100%{transform:translate(0,0)}}
@media (prefers-reduced-motion:reduce){
  .icona .parpelles{animation:none;transform:scaleY(0)}
  .icona .pupilles{animation:none}
}

/* El context que no es pot llegir després de les xifres: si va al peu, quan
   s'hi arriba ja s'han llegit com un mèrit o com una culpa. */
.context-avis{background:var(--lavanda);color:#1E1B2E;border:2.5px solid var(--ink);
  border-radius:var(--r-m);box-shadow:var(--ombra);padding:var(--e2);font-size:.95rem}
@media (prefers-color-scheme:dark){ .context-avis{background:#332f57;color:var(--ink)} }
/* Un avís que afecta la lectura d'una xifra concreta (el total que no és el
   rebut sencer, la variació que no es pot interpretar, l'IBI no publicable). */
.avis-dada{background:var(--presec);color:#1E1B2E;border:2.5px solid var(--ink);
  border-radius:var(--r-m);padding:var(--e2);font-size:.92rem;margin:var(--e2) 0}
@media (prefers-color-scheme:dark){ .avis-dada{background:#4a3a26;color:var(--ink)} }
/* La frase que impedeix que les dues xifres d'origen es llegeixin com una sola.
   Va amb el coral de la casa perquè és el que més s'ha de veure del bloc. */
.avis-definicions{border-left:12px solid var(--coral);background:var(--paper-2);
  border:2.5px solid var(--ink);border-left-width:12px;border-radius:var(--r-m);
  box-shadow:var(--ombra);padding:var(--e2);font-size:.95rem;margin:var(--e2) 0}
.apart{margin:var(--e2) 0 0}

.gent,.origens,.preus{list-style:none;margin:var(--e2) 0 0;padding:0;display:grid;gap:var(--e2)}
/* Quatre targetes en tres columnes deixen la darrera fila amb una sola i dos
   forats al costat, que és el que més crida l'atenció de tot el bloc. Amb la
   mida mínima més gran en surten dues columnes i les quatre queden quadrades. */
/* Les capses d'una fila fan totes la mateixa alçada. Havien anat amb
   «align-items:start» perquè una targeta sense espurna no s'estirés buida;
   el resultat eren capses desiguals de costat, que és pitjor de llegir: ara
   s'estiren totes, i el que sobra queda dins de la targeta amb el darrer peu
   —i l'enllaç de la font, que ja porta «margin-top:auto»— enganxat a baix. */
.gent .sub:last-child,.origens .sub:last-child,.preus .sub:last-child{margin-top:auto}
/* «min(300px,100%)» i no «300px» a seques: a 320 px la columna mínima era més
   ampla que la pàgina i la targeta sobresortia per la dreta. */
.gent{grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr))}
.origens{grid-template-columns:repeat(auto-fit,minmax(min(250px,100%),1fr))}
/* Les targetes de «Què costa el govern», «Què contracta» i «Quant fa que
   mana» no tenien columnes i s'apilaven a tota amplada: tres targetes d'una
   xifra cadascuna feien tres pantalles. En fila, com les de «Qui hi viu». */
.preus{grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))}
/* Fill directe i no qualsevol «li»: dins d'aquestes targetes n'hi ha una altra
   llista —els càrrecs que té algú en un altre ens— i heretava la targeta
   sencera, contorn i ombra incloses, i el «flex-direction:column» hi partia
   «Diputació de Barcelona, Presidències delegades» en dues línies amb la coma
   penjant al principi de la segona. */
/* Sense contorn ni ombra: eren el mateix kit de targetes idèntiques que les
   tires, i ara són el mateix que l'ullada, un filet a sobre de cada xifra. */
.gent > li,.origens > li,.preus > li{border-top:1.5px solid var(--vora);padding:var(--e2) 0;
  display:flex;flex-direction:column;gap:4px;min-width:0}
/* La llista de dins: text i prou. */
.gent .apart li{padding:0;margin:0 0 8px;font-size:.9rem;line-height:1.45}
.gent .apart{list-style:none;padding:0}
.gent .etq,.origens .etq,.preus .etq{font-family:var(--display);font-weight:900;font-size:.98rem;
  letter-spacing:-.01em;line-height:1.15}
.gent .gran,.origens .gran,.preus .gran{font-family:var(--display);font-weight:900;
  font-size:clamp(1.8rem,7vw,2.4rem);line-height:1;letter-spacing:-.03em;
  font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.gent .sub,.origens .sub,.preus .sub{font-size:.82rem;color:var(--ink-suau);font-weight:700}
.gent .canvi b,.origens .canvi b,.preus .canvi b{color:var(--ink)}
/* El sou que paga una altra administració es marca amb el filet de dalt en
   coral i gruixut, ara que no hi ha contorn per pintar. L'etiqueta va amb el
   coral de text: el de fons es quedava a 2,9:1 damunt del paper. */
.preus .sou-diputacio{border-top:2.5px solid var(--coral)}
.preus .sou-diputacio .etq{color:var(--coral-text)}
.vots-resum{margin-top:var(--e2)}
.punts-ple{list-style:none;margin:var(--e3) 0 0;padding:0;display:grid;gap:var(--e2)}
.punts-ple>li{border-left:5px solid var(--ink);padding:var(--e2) var(--e3);background:var(--paper-2);display:grid;gap:6px}
.punt-cap{display:flex;gap:8px;align-items:center;flex-wrap:wrap;color:var(--ink-suau);font-size:.78rem;font-weight:800}
/* «.punt-tipus», «.vot-unanim» i «.vot-grup» són estats (vegeu «les
   pastilles»): la forma la porta la regla comuna. La unanimitat anava en
   «var(--green)», un color que la casa no té —el navegador el descartava— i
   que, si n'hi hagués, faria de veredicte: votar tots el mateix no és bo ni
   dolent. El sentit del vot d'un grup pot ser llarg i es parteix. */
.resultat-vot{font-weight:800;color:var(--ink-suau)}
.vots-grups{display:flex;flex-wrap:wrap;gap:5px;margin-top:3px}
.vot-grup{white-space:normal}
.font-acta{font-size:.78rem;font-weight:800;color:var(--coral)}
/* Què compta exactament la xifra: no és lletra petita decorativa, és el que
   impedeix confondre nacionalitat amb lloc de naixement. Per això es llegeix. */
/* Què compta exactament una xifra. A les dues targetes de l'origen es llegeix
   sempre —és l'única cosa que impedeix confondre nacionalitat amb lloc de
   naixement, i per això hi ha una prova que ho vigila—; a les de l'edat és una
   definició i es pot plegar, que és el que fa que la targeta càpiga d'un cop
   d'ull en comptes de ser tres línies de lletra grisa. */
.compta{font-size:.84rem;color:var(--ink-suau);margin:6px 0 0;line-height:1.4}
details.compta > summary{font-size:.76rem;font-weight:700;color:var(--ink-suau);cursor:pointer;
  list-style:none;display:inline-flex;align-items:center;gap:5px;min-height:24px;
  text-decoration:underline;text-decoration-color:var(--vora);text-underline-offset:3px}
details.compta > summary::-webkit-details-marker{display:none}
details.compta > summary::before{content:"+";font-weight:900}
details.compta[open] > summary::before{content:"−"}
details.compta > summary:hover{color:var(--coral-text);text-decoration-color:currentColor}
.subtitol.primer{margin-top:0}
/* L'enllaç de la font, que la llicència de l'Idescat obliga a mostrar a cada
   xifra. Hi era en majúscules, en negreta i en coral, i amb set targetes al
   bloc el que més cridava de «Qui hi viu» era set vegades el nom d'una taula.
   Continua sent-hi, sencer i clicable —això no és negociable—, però amb la
   mida i el pes d'una nota al peu, que és el que és. */
.font-idescat{display:inline-block;margin-top:auto;padding-top:10px;font-size:.72rem;
  font-weight:700;color:var(--ink-suau);text-decoration:underline;
  text-decoration-color:var(--vora);text-underline-offset:2px}
.font-idescat:hover{color:var(--coral-text);text-decoration-color:currentColor}

/* --- l'espurna: la forma d'una sèrie al costat de la xifra --------------- */
/* La línia va amb la tinta del cos i no amb el gris del text secundari: és
   dada, no decoració. L'«non-scaling-stroke» del traç hi és perquè el dibuix
   s'estira en amplada i no en alçada, i sense ell la línia sortiria gruixuda
   als trams horitzontals i fina als verticals. */
.espurna{display:block;margin:8px 0 2px;color:var(--ink)}
/* El punt d'ara es col·loca respecte del dibuix i no de tot el bloc: si la
   referència inclogués la fila dels anys, el «top» en tant per cent cauria
   massa avall i el punt anava a parar damunt de l'últim any. */
.espurna .linia{display:block;position:relative;padding-right:6px}
.espurna .ara{position:absolute;right:0;top:var(--y);width:9px;height:9px;border-radius:50%;
  background:var(--coral);border:1.5px solid var(--ink);transform:translateY(-50%)}
/* 34px d'alt damunt d'una targeta de 340 era una proporció de 10 a 1: una
   pujada del 30 % —de 337.637 a 437.663 persones— hi sortia com una ratlla
   gairebé plana. A 46 la forma es veu. */
.espurna svg{display:block;width:100%;height:46px;overflow:visible}
.espurna i{display:flex;justify-content:space-between;font-style:normal;
  font-size:.6rem;font-weight:800;color:var(--ink-suau);font-variant-numeric:tabular-nums;
  letter-spacing:.02em;margin-top:2px}
/* --- qui té un càrrec en un altre ens ------------------------------------
   Una fila per persona i no una targeta: nou targetes de 216px eren un terç del
   bloc, i vuit deien la mateixa frase perquè totes vuit són de la mateixa
   diputació. La cara i el partit a l'esquerra, l'ens i l'import a la dreta, i
   el que comparteixen escrit un sol cop a sota. */
.acumulats{list-style:none;margin:var(--e2) 0 0;padding:0;display:grid;gap:0}
.acumulats > li{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);
  gap:6px var(--e3);align-items:center;padding:11px 0;border-top:1px solid var(--vora)}
.acumulats > li:first-child{border-top:0}
.acumulats .altres{display:flex;flex-direction:column;gap:4px;min-width:0}
.acumulats .altre{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 8px;min-width:0}
.acumulats .ens{font-weight:800;font-size:.88rem}
.acumulats .import{font-family:var(--display);font-weight:900;font-size:1.05rem;
  letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.acumulats .concepte,.acumulats .buit{font-size:.76rem;color:var(--ink-suau);font-weight:700}
.acumulats .cap-persona .retrat{width:38px;height:38px}
@media (max-width:560px){
  .acumulats > li{grid-template-columns:1fr}
  .acumulats .altres{padding-left:49px}
}
.fonts-idescat{list-style:none;margin:0 0 var(--e2);padding:0;display:grid;gap:4px}
.fonts-idescat a{font-size:.86rem;font-weight:700}

/* --- els euros al costat del resultat ------------------------------------
   Una taula de tres columnes que ha de cabre a 320px sense desplaçar la
   pàgina: per això va dins d'un contenidor que es desplaça ell sol. */
.taula-envolta{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:var(--e2) 0}
.euros-resultat{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}
.euros-resultat th,.euros-resultat td{text-align:right;padding:8px 10px;border-bottom:1px solid var(--vora);
  font-size:.92rem;white-space:nowrap}
/* Els encapçalaments sí que poden fer dues línies: amb ells en una sola, la
   taula demanava 385px i a 320 calia arrossegar-la per veure la columna que fa
   que el bloc tingui sentit. Les xifres, en canvi, no es parteixen mai. */
.euros-resultat thead th{font-family:var(--text);font-weight:700;font-size:.8rem;
  color:var(--ink-suau);border-bottom:2.5px solid var(--ink);white-space:normal;line-height:1.15}
@media (max-width:400px){ .euros-resultat th,.euros-resultat td{padding:8px 3px;font-size:.84rem} }
.euros-resultat tbody th{text-align:left;font-weight:900}
.euros-resultat .buit{color:var(--ink-suau);font-weight:700;font-size:.8rem}
.canvis-parell{list-style:none;margin:var(--e2) 0 0;padding:0;display:grid;gap:var(--e1)}
.canvis-parell li{display:flex;flex-wrap:wrap;gap:4px var(--e2);align-items:baseline;
  padding:8px 0;border-bottom:1px solid var(--vora)}
.canvis-parell .etq{font-family:var(--display);font-weight:900;font-size:1rem}
.canvis-parell .sub{font-size:.86rem;color:var(--ink-suau);font-weight:700}
/* Dues sèries de la mateixa cosa amb unitats diferents, de costat i cadascuna
   amb la seva escala: el que val la pena mirar és si van juntes. */
.dues-series{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));
  gap:var(--e2) var(--e4);margin:var(--e3) 0 0}
.rotul-serie{display:block;font-size:.8rem;font-weight:700;color:var(--ink-suau)}

/* --- on continua la fitxa ----------------------------------------------
   Els tres o quatre llocs on continua la fitxa —la comarca, l'AMB si hi és,
   les preguntes o la prova, el comparador— en una filera d'enllaços i no en
   targetes de tres línies: el peu ja porta la resta de destins del web.
   Es diu «pastilles» perquè ho van ser; ara és navegació i, com tota la
   navegació, text subratllat: el nom del lloc subratllat, i al costat, en gris,
   què s'hi troba. */
.pastilles-context{list-style:none;margin:var(--e2) 0 0;padding:0;display:flex;flex-wrap:wrap;gap:0 var(--e3)}
.pastilles-context a{display:inline-flex;align-items:baseline;flex-wrap:wrap;gap:0 7px;min-height:44px;
  padding:11px 0;font-weight:800;font-size:.92rem;text-decoration:none;color:inherit}
.pastilles-context a b{font-weight:900;text-decoration:underline;text-decoration-color:var(--coral);
  text-decoration-thickness:2px;text-underline-offset:4px}
.pastilles-context a:hover b{color:var(--coral-text)}
.pastilles-context a span{font-weight:700;color:var(--ink-suau);font-size:.8rem}
@media (prefers-color-scheme:dark){ .bloc.joc .pastilles-context a{color:#1E1B2E} }

/* El botó de la prova sí que és un botó —obre el joc— i per això conserva el
   dibuix de botó de la casa. L'enllaç de sota no: és navegació, i va com tota
   la navegació, subratllat (vegeu «les pastilles»). */
.boto-prova{display:inline-block;font-weight:800;font-size:1rem;text-decoration:none;
  background:var(--coral);color:#1E1B2E;border:2.5px solid var(--ink);border-radius:var(--r-max);
  padding:12px 26px;box-shadow:var(--ombra);transition:transform .12s ease,box-shadow .12s ease}
.boto-prova:hover{transform:translate(2px,2px);box-shadow:1px 1px 0 var(--ink)}
/* El subratllat, només quan és un enllaç: a la llista de preguntes, la prova
   que encara està en revisió surt com a <span class="prova-enllac bloquejada">,
   i subratllada semblaria que s'hi pot anar. */
.prova-enllac{display:inline-flex;align-items:center;min-height:44px;margin-top:6px;margin-right:var(--e3);
  font-weight:800;font-size:.92rem}
a.prova-enllac{text-decoration:underline;text-decoration-color:var(--coral);
  text-decoration-thickness:2px;text-underline-offset:4px}
a.prova-enllac:hover{color:var(--coral-text)}

/* --- on cau entre els seus ---------------------------------------------
   Deu files iguals: etiqueta i any, la xifra en gros, una barra del percentil
   dins del grup i una frase. La barra és la posició de 0 a 100 i no l'escala
   dels valors, per això la mediana és sempre al mig i totes es llegeixen igual.
   Res no té amplada fixa ni «nowrap»: a 390px la barra s'encongeix amb la fila
   i els textos es parteixen on calgui, i cap fila no surt per la dreta. */
/* Els tres extrems de l'escala («el més baix del grup», «el del mig», «el més
   alt») en minúscula de frase i sense espaiar: en majúscules espaiades eren
   un rètol, i a 360 px «EL MÉS BAIX DEL GRUP» feia tres línies. La primera
   lletra la posa el CSS perquè el text ve escrit en minúscula. */
.comparat-llegenda{display:flex;justify-content:space-between;gap:var(--e1);margin:var(--e3) 0 0;
  font-size:.76rem;font-weight:700;color:var(--ink-suau)}
.comparat-llegenda span{min-width:0;overflow-wrap:anywhere}
.comparat-llegenda span::first-letter{text-transform:uppercase}
.comparat-llegenda span:nth-child(2){text-align:center}
.comparat-llegenda span:last-child{text-align:right}
.comparat-files{list-style:none;margin:var(--e1) 0 0;padding:0}
.comparat-files li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px var(--e2);align-items:center;
  min-width:0;padding:12px 0;border-bottom:1px solid var(--vora)}
.comparat-files .etq{min-width:0;overflow-wrap:anywhere;font-family:var(--display);font-weight:900;
  font-size:1rem;line-height:1.2}
.comparat-files .etq a{color:inherit;text-decoration:none}
.comparat-files .etq a:hover,.comparat-files .etq a:focus-visible{text-decoration:underline;text-decoration-thickness:2px}
.comparat-files .etq small{display:block;font-family:var(--text);font-weight:700;font-size:.74rem;
  letter-spacing:0;color:var(--ink-suau);margin-top:2px}
.comparat-files .xifra{min-width:0;overflow-wrap:anywhere;text-align:right;font-family:var(--display);
  font-weight:900;font-size:1.45rem;line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.comparat-files .xifra.buit{font-family:var(--text);font-weight:700;font-size:.86rem;color:var(--ink-suau)}
/* La barra ocupa tota l'amplada de la fila: és fluida, i el punt s'hi col·loca
   en percentatge. Sobresurt per dalt i per baix (el punt fa 20px sobre 14px)
   però mai per la dreta: el 97 % més mig punt cap dins de la barra. */
.comparat-barra{grid-column:1/-1;position:relative;display:block;width:100%;min-width:0;height:14px;
  margin:6px 0;background:var(--vora);border-radius:var(--r-max)}
.comparat-barra .mig{position:absolute;left:50%;top:-4px;bottom:-4px;width:2.5px;margin-left:-1.25px;
  background:var(--ink);border-radius:2px}
.comparat-barra .punt{position:absolute;left:var(--p);top:-3px;width:20px;height:20px;margin-left:-10px;
  box-sizing:border-box;background:var(--coral);border:2px solid var(--ink);border-radius:50%;cursor:default}
.comparat-barra .punt:focus-visible{outline:3px solid var(--ink);outline-offset:2px}
.comparat-barra.buida{background:repeating-linear-gradient(90deg,var(--vora) 0 6px,transparent 6px 12px)}
.comparat-files .frase{grid-column:1/-1;min-width:0;overflow-wrap:anywhere;font-size:.86rem;line-height:1.35;
  font-weight:700;color:var(--ink-suau)}
.comparat-files .sense .etq,.comparat-files .sense-posicio .etq{color:var(--ink-suau)}
/* Amb lloc, tres columnes: la barra i la frase van a la dreta de la xifra i
   deu files hi caben en una pantalla, que és la gràcia d'un resum. */
@media (min-width:760px){
  .comparat-files li{grid-template-columns:minmax(0,220px) minmax(0,130px) minmax(0,1fr);gap:2px var(--e3)}
  .comparat-files .etq,.comparat-files .xifra{grid-row:1/3;align-self:center}
  .comparat-barra{grid-column:3;grid-row:1;margin:8px 0 2px}
  .comparat-files .frase{grid-column:3;grid-row:2}
  .comparat-llegenda{margin-left:calc(220px + 130px + 2 * var(--e3))}
}
${GRAFICS_CSS}${PEU_CSS}${ESCUT_CSS}`;

/**
 * El full sense els comentaris.
 *
 * Els comentaris d'aquest fitxer són la memòria de per què cada regla és com
 * és, i s'han de quedar al codi; però a la pàgina publicada no hi diuen res a
 * ningú i pesen: 31 kB per fitxa, per 947 fitxes i per les catorze menes de
 * pàgina que comparteixen aquest full. Es treuen aquí, una vegada, en carregar
 * el mòdul. Només els comentaris de bloc: el CSS no en té d'altres, i un
 * «//» dins d'una adreça no és un comentari.
 */
export function senseComentaris(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    // Els forats que deixen: línies buides seguides, i espais al final de línia.
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{2,}/g, "\n");
}

export const RADIOGRAFIA_CSS = senseComentaris(FULL);
