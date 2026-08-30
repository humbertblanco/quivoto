import { GRAFICS_CSS } from "./grafics";

/**
 * Estil de la radiografia. Els tokens són els mateixos que la landing i que
 * `design/prototip/base.css`; aquí només hi ha el que aquesta pàgina necessita.
 * Va incrustat perquè cada radiografia sigui un fitxer autònom: es pot obrir
 * des de qualsevol lloc, arxivar i enviar sense que se'n trenqui res.
 */
export const RADIOGRAFIA_CSS = `
:root{
  --paper:#FBF7EE; --paper-2:#FFFFFF; --ink:#1E1B2E; --ink-suau:#6B6680;
  --coral:#E2735A; --menta:#BFE8D2; --lavanda:#C9C4F2; --presec:#FFD8B8;
  --vora:rgba(30,27,46,.12);
  --r-s:10px; --r-m:18px; --r-l:26px; --r-max:999px;
  --e1:8px; --e2:16px; --e3:24px; --e4:40px; --e5:64px;
  --display:"Gabarito",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  --text:"Nunito Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;
  --ample:900px; --ombra:3px 3px 0 var(--ink);
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

.capcalera{display:flex;justify-content:space-between;align-items:center;gap:var(--e2);max-width:var(--ample);margin:0 auto;padding:var(--e3)}
/* Els objectius de toc que van sols (no els enllaços dins d'una frase) han de
   fer 44px d'alt: la mida on un dit hi encerta sense ampliar la pàgina. */
.logo{font-family:var(--display);font-weight:900;letter-spacing:-.05em;font-size:1.3rem;text-decoration:none;
  display:inline-flex;align-items:center;min-height:44px}
.etiqueta{background:var(--presec);color:#1E1B2E;border-radius:var(--r-max);padding:5px 12px;font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em}

/* --- el cercador --------------------------------------------------------
   El botó el posa el guió, així que aquí no hi ha res que quedi penjat sense
   JavaScript. La finestra és un «dialog» de debò: el navegador ja hi fa el
   focus, l'Esc i el fons, i no cal reinventar-ho. */
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
.cerca-tanca{font-family:var(--text);font-size:.66rem;font-weight:800;letter-spacing:.08em;
  text-transform:uppercase;color:var(--ink-suau);background:none;border:2px solid var(--vora);
  border-radius:6px;padding:3px 7px;cursor:pointer}
.cerca-resultats{max-height:min(420px,54vh);overflow-y:auto}
.cerca-buit{font-size:.9rem;color:var(--ink-suau);margin:0;padding:20px 18px;line-height:1.45}
.cerca-fila{display:flex;align-items:center;gap:12px;padding:11px 16px;text-decoration:none;
  color:inherit;border-top:1px solid var(--vora)}
.cerca-fila:first-child{border-top:0}
.cerca-fila.tria{background:var(--presec);color:#1E1B2E}
.cerca-fila .mena{flex:none;font-size:.6rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;
  color:var(--ink-suau);width:4.6em}
.cerca-fila.tria .mena{color:rgba(30,27,46,.66)}
.cerca-fila .qui{display:flex;flex-direction:column;gap:1px;min-width:0}
.cerca-fila .qui b{font-family:var(--display);font-weight:900;font-size:1rem;letter-spacing:-.01em}
.cerca-fila .qui span{font-size:.76rem;color:var(--ink-suau);font-weight:700}
.cerca-fila.tria .qui span{color:rgba(30,27,46,.7)}

main{max-width:var(--ample);margin:0 auto;padding:0 var(--e3) var(--e5)}
.portada{padding:var(--e3) 0 var(--e4)}
.micro{font-size:.76rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--coral-text);margin:0 0 var(--e2)}
.entrada{font-size:1.15rem;color:var(--ink-suau);margin:var(--e2) 0 0}
.entrada-bloc{color:var(--ink-suau)}
.bloc{padding:var(--e4) 0;border-top:2.5px solid var(--ink);scroll-margin-top:var(--e3)}

/* --- el resum d'una frase: el que es llegeix abans de fer scroll --- */
.resum{font-family:var(--display);font-weight:900;font-size:clamp(1.15rem,3.2vw,1.5rem);
  letter-spacing:-.02em;line-height:1.25;margin:var(--e3) 0 0;max-width:30ch}
.resum b{color:var(--coral-text)}
/* «.resum b» és més específic que «.sigla» i li guanyava el color: les sigles
   del resum sortien en coral damunt del color del seu partit, i «PSC-CP» hi
   quedava a 1,09:1 —coral sobre vermell— i «TriasxBCN-CM» a 2,28. La pastilla
   mana sobre el seu propi text. */
.resum b.sigla{color:var(--t,#FBF7EE)}
/* Les sigles d'un partit, amb el seu color de fons i la tinta triada per
   lluminància: escrites amb el color del partit damunt del paper n'hi ha que no
   arriben a cap mínim de contrast. */
.sigla{display:inline-block;background:var(--c,var(--coral));color:var(--t,#FBF7EE);
  border:2px solid var(--ink);border-radius:var(--r-max);padding:0 9px;font-weight:900;
  font-size:.82em;line-height:1.45;white-space:nowrap;letter-spacing:0;
  vertical-align:.06em}
/* Dins d'una frase de titular la pastilla no ha de fer de botó: amb la mida de
   la lletra del voltant trencava el ritme de lectura i pesava més que el nom
   del poble. Encongida i sense el descens de la caixa, es llegeix com una
   paraula més que casualment porta color. */
.resum .sigla{font-size:.74em;padding:0 10px;vertical-align:.1em}
.alcaldia{display:flex;align-items:center;gap:var(--e2);margin:var(--e3) 0 0}
.cara-alcaldia{width:52px;height:52px;border-radius:50%;border:2.5px solid var(--ink);
  box-shadow:var(--ombra);object-fit:cover;flex:0 0 auto;background:var(--paper-2)}
.cara-alcaldia.inicials{display:flex;align-items:center;justify-content:center;
  font-family:var(--display);font-weight:900;font-size:1.05rem;background:var(--c);color:var(--t)}
.qui-mana{display:flex;flex-direction:column;gap:3px;min-width:0}
.nom-alcaldia{font-family:var(--display);font-weight:900;font-size:1.05rem;letter-spacing:-.01em}
.nom-alcaldia a{color:inherit;text-decoration:none;border-bottom:2.5px solid var(--coral)}
.carrec-alcaldia{font-size:.84rem;color:var(--ink-suau);font-weight:700;
  display:flex;align-items:center;gap:6px;flex-wrap:wrap}

/* --- el poble en quatre xifres ------------------------------------------
   La fitxa fa 28.000 píxels. Qui l'obre per saber com està el seu poble no ha
   de recórrer-la sencera per treure'n res: aquí hi ha les xifres que responen
   la pregunta, cadascuna amb on queda dins del seu grup i amb l'enllaç al bloc
   que l'explica. Va sense contorn ni ombra a propòsit: és un índex amb números
   i no una targeta més de dades, i si pesés com les de sota competiria amb
   elles en comptes de deixar-hi anar. */
.ullada{margin:var(--e3) 0 0;border-top:2.5px solid var(--ink);padding-top:var(--e2)}
.ullada ul{list-style:none;margin:0;padding:0;display:grid;gap:2px var(--e3);
  grid-template-columns:repeat(auto-fit,minmax(230px,1fr));align-items:start}
/* La icona del tema al davant de cada xifra: és el que fa que el resum es
   reculli d'una ullada en comptes de llegir-se etiqueta per etiqueta. Va a
   l'esquerra i no a sobre perquè la columna de dibuixos guiï la vista avall. */
.ullada a{display:grid;grid-template-columns:26px minmax(0,1fr);column-gap:11px;
  text-decoration:none;color:inherit;padding:11px 0;border-radius:8px}
.ullada .dibuix{grid-row:1 / span 4;align-self:start;margin-top:2px}
.ullada .dibuix .icona{width:26px;height:26px;display:block}
.ullada .etq,.ullada .xifra,.ullada .on,.ullada .peu{grid-column:2}
.ullada a:hover .xifra{color:var(--coral-text)}
.ullada .etq{font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.09em;
  color:var(--ink-suau);line-height:1.25}
.ullada .xifra{font-family:var(--display);font-weight:900;font-size:1.9rem;line-height:1.05;
  letter-spacing:-.03em;font-variant-numeric:tabular-nums;transition:color .12s ease}
.ullada .on{display:block;height:5px;background:var(--vora);border-radius:var(--r-max);margin:3px 0 1px}
.ullada .on i{display:block;height:100%;width:var(--w);min-width:4px;background:var(--lavanda);
  border-radius:var(--r-max)}
.ullada .peu{font-size:.74rem;color:var(--ink-suau);line-height:1.3}
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
.index{display:flex;flex-wrap:wrap;gap:6px;padding:var(--e3) 0 0;border-top:2.5px solid var(--ink);margin-top:var(--e4)}
.index a{font-size:.78rem;font-weight:800;text-decoration:none;border:2px solid var(--ink);
  border-radius:var(--r-max);padding:0 15px;display:inline-flex;align-items:center;min-height:44px;
  transition:background .12s ease,color .12s ease}
.index a:hover{background:var(--ink);color:var(--paper)}
/* La secció que s'està llegint. Com a filera de pastilles es marca amb el
   presec de la casa i no amb la tinta plena, que és el que fa el «:hover»: si
   fossin iguals, passar-hi el ratolí per sobre semblaria que s'hi ha anat. */
.index a[aria-current]{background:var(--presec);color:#1E1B2E}
@media (prefers-reduced-motion:reduce){.index a{transition:none}}
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
   «flex-wrap» cada fila partia per un lloc diferent i no es podien comparar. */
.llegenda{list-style:none;margin:0;padding:0;display:grid;gap:0;
  grid-template-columns:repeat(auto-fit,minmax(280px,1fr));column-gap:var(--e3)}
.llegenda li{display:grid;grid-template-columns:1fr auto;align-items:baseline;
  gap:2px var(--e2);padding:9px 0;border-bottom:1px solid var(--vora)}
.llegenda .qui{display:flex;align-items:center;gap:8px;min-width:0}
.llegenda .qui b{font-weight:800;overflow-wrap:anywhere}
.llegenda .xifra{font-weight:700;font-size:.82rem;color:var(--ink-suau);white-space:nowrap}
.llegenda .xifra b{font-family:var(--display);font-weight:900;font-size:1.35rem;
  letter-spacing:-.02em;color:var(--ink);font-variant-numeric:tabular-nums;margin-right:2px}
/* La proporció de vot, que a l'hemicicle no es pot mesurar: dos cercles de
   diferència no es veuen, un 2,7 % de barra sí. */
.llegenda .proporcio{grid-column:1/-1;height:6px;background:var(--vora);border-radius:var(--r-max);
  margin:3px 0 1px}
.llegenda .proporcio i{display:block;height:100%;width:var(--w);min-width:3px;background:var(--c);
  border-radius:var(--r-max)}
.llegenda .secundari{grid-column:1/-1;font-size:.78rem;font-variant-numeric:tabular-nums}
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
.participacio,.paritat{list-style:none;margin:0;padding:0;display:grid;gap:var(--e2);grid-template-columns:repeat(auto-fit,minmax(250px,1fr))}
.participacio li,.paritat li{background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);box-shadow:var(--ombra);padding:var(--e2);display:flex;flex-direction:column;gap:4px}
/* El regle dins d'una targeta no té els 32px de marge que necessita al bloc
   dels diners, on l'etiqueta penja de la marca i pot anar al 94 % del recorregut. */
.participacio .regle,.paritat .regle{margin:16px 22px 2px}
.participacio .comparativa,.paritat .comparativa{font-size:.78rem;line-height:1.35;color:var(--ink-suau)}
.paritat .etq{font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.09em;color:var(--ink-suau)}
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
.plens{display:grid;gap:var(--e2);grid-template-columns:repeat(auto-fit,minmax(260px,1fr));
  align-items:start;align-content:start;margin-bottom:var(--e2)}
.grup{background:var(--paper-2);border:2.5px solid var(--ink);border-left-width:10px;border-left-color:var(--c);
  border-radius:var(--r-m);box-shadow:var(--ombra);padding:var(--e2);container-type:inline-size}
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
.retrat.inicials{display:flex;align-items:center;justify-content:center;font-family:var(--display);
  font-weight:900;font-size:.86rem;color:var(--ink-suau);background:var(--c);
  filter:saturate(.35) opacity(.5)}
.grup.noadscrit{border-left-style:dashed}
/* Al govern: fons lleugerament tenyit i marca a cada regidoria. El govern pot
   ser de més d'un partit, i per això la marca va per persona i no per grup. */
.grup.al-govern{box-shadow:var(--ombra),inset 0 0 0 999px rgba(191,232,210,.16)}
.grup li.govern .marca-govern{font-size:.6rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;
  background:var(--menta);color:#1E1B2E;border:1.5px solid var(--ink);border-radius:var(--r-max);
  padding:2px 7px;white-space:nowrap;margin-left:auto;flex:none}
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

/* --- alcaldies --- */
.alcaldies{width:100%;border-collapse:collapse;font-size:.94rem}
.alcaldies th,.alcaldies td{text-align:left;padding:9px 10px 9px 0;border-bottom:1px solid var(--vora);vertical-align:top}
.alcaldies thead th{font-size:.72rem;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-suau);border-bottom:2.5px solid var(--ink)}
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
.marca-canvi{display:inline-block;background:var(--presec);color:#1E1B2E;border-radius:var(--r-max);padding:2px 9px;font-size:.7rem;font-weight:800;white-space:nowrap}
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
   majoria absoluta al mig, que és l'única referència que importa de debò. */
.grafic{margin:0 0 var(--e3)}
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
.regle b span,.diners .regle b span{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(100% - 3px);text-align:center;
  font-size:.66rem;font-weight:800;text-transform:uppercase;
  letter-spacing:.06em;color:var(--ink-suau-tint);white-space:nowrap}
.diners li:not(:first-child) .regle b span{display:none}
.diners .comparativa{grid-column:1/-1;font-size:.8rem;margin-top:-2px}
/* A mòbil el regle ocupa tota la fila i no li sobra amplada per al marge: hi
   traiem l'etiqueta, que la frase de sota ja diu on és la mediana catalana. */
@media (max-width:560px){
  .diners li{grid-template-columns:1fr auto}
  .diners .regle{grid-column:1/-1;margin:0}
  .diners .regle b span{display:none}
}

/* --- el repartiment en quadres ------------------------------------------
   Cada quadre és una part del total i ocupa el que li toca: l'IBI deixa de ser
   «la barra més llarga» i passa a ser el 57 % de tot el que entra, que és el
   que sis regles paral·leles no poden dir. Els requadres van en percentatges,
   de manera que el dibuix s'estira amb la columna sense cap JavaScript.

   El to el posa qui el fa servir: lavanda el que entra, menta el que surt. Dins
   d'un to, cada tros s'aclareix segons l'ordre —el més gran, el més ple— i per
   això la tinta va sempre fosca: sobre el més clar de la família, el blanc no
   s'hi llegiria. */
.quadres{position:relative;width:100%;aspect-ratio:2/1;margin:var(--e2) 0 var(--e3);
  border:2.5px solid var(--ink);border-radius:var(--r-m);overflow:hidden;box-shadow:var(--ombra)}
@media (max-width:560px){ .quadres{aspect-ratio:1/1} }
.quadre{position:absolute;left:var(--x);top:var(--y);width:var(--w);height:var(--h);
  border-right:2px solid var(--paper);border-bottom:2px solid var(--paper);
  padding:7px 9px;overflow:hidden;display:flex;flex-direction:column;gap:1px;
  color:#1E1B2E;line-height:1.15;container-type:size}
/* El degradat s'atura al 60 %: si cada tros s'aclarís igual fins al final, el
   sisè seria el color del paper i semblaria un forat, no una partida petita. */
.quadres[style*="lavanda"] .quadre{background:color-mix(in oklab,#C9C4F2 calc(100% - min(var(--n) * 12%,60%)),#FBF7EE)}
.quadres[style*="menta"] .quadre{background:color-mix(in oklab,#BFE8D2 calc(100% - min(var(--n) * 12%,60%)),#FBF7EE)}
/* Qui decideix què hi cap és la mida real del requadre i no un tant per cent
   calculat en generar la pàgina: el mateix 11 % són 90 px en un ordinador i 36
   en un telèfon. */
.quadre b,.quadre i,.quadre em{display:none}
@container (min-width:74px) and (min-height:34px){ .quadre b{display:block} }
@container (min-width:96px) and (min-height:56px){ .quadre i{display:block} }
@container (min-width:110px) and (min-height:78px){ .quadre em{display:block} }
.quadre b{font-size:.78rem;font-weight:800;letter-spacing:-.01em;overflow-wrap:anywhere}
.quadre i{font-family:var(--display);font-weight:900;font-size:1.15rem;font-style:normal;
  letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.quadre em{font-size:.7rem;font-style:normal;font-weight:800;opacity:.66}

/* --- serveis --- */
.serveis{list-style:none;margin:0 0 var(--e2);padding:0;display:grid;gap:var(--e2);grid-template-columns:repeat(auto-fit,minmax(215px,1fr))}
.serveis li{background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);box-shadow:var(--ombra);padding:var(--e2);display:flex;flex-direction:column;gap:3px}
.serveis .etq{font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.09em;color:var(--ink-suau)}
.serveis .imp{font-family:var(--display);font-weight:900;font-size:1.7rem;line-height:1;letter-spacing:-.03em}

/* --- impostos --- */
.impostos{list-style:none;margin:0 0 var(--e2);padding:0;display:grid;gap:var(--e2);grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}
.impostos li{background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);box-shadow:var(--ombra);padding:var(--e2);display:flex;flex-direction:column;gap:4px}
.impostos .nom{font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.09em;color:var(--ink-suau)}
.comparativa{font-size:.78rem;color:var(--ink-suau)}
.comparativa.mes{color:var(--coral-text);font-weight:700}
.comparativa.menys{font-weight:700}

/* --- el balanç del mandat -------------------------------------------
   Tres columnes de xifra i una fletxa al mig. El color diu si la xifra ha anat
   cap on convenia, però mai sol: al costat sempre hi ha la paraula, perquè qui
   no distingeixi colors ho llegeixi igual. */
.balanc{width:100%;border-collapse:collapse;font-size:.95rem}
.balanc thead th{font-size:.68rem;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-suau);
  text-align:right;padding:0 0 8px;border-bottom:2.5px solid var(--ink);font-weight:800}
.balanc thead th:first-child{text-align:left}
.balanc tbody th{text-align:left;font-weight:800;padding:14px 12px 14px 0;vertical-align:top;line-height:1.25}
.balanc td{text-align:right;padding:14px 0;vertical-align:top;font-variant-numeric:tabular-nums;
  border-bottom:1px solid var(--vora)}
.balanc tbody th{border-bottom:1px solid var(--vora)}
.balanc .abans{color:var(--ink-suau)}
.balanc .ara{font-family:var(--display);font-weight:900;font-size:1.2rem;letter-spacing:-.02em}
.balanc .fletxa{width:2.2em;font-size:1.1rem;color:var(--ink-suau)}
.balanc .canvi{font-weight:800;padding-left:12px;white-space:nowrap}
.balanc tr.millor .canvi{color:#1d7a4f}
.balanc tr.pitjor .canvi{color:var(--coral-text)}
.balanc tr.igual .canvi{color:var(--ink-suau);font-weight:600}
@media (prefers-color-scheme:dark){.balanc tr.millor .canvi{color:#7fd6a8}}
.peu-nota{display:block;font-size:.76rem;font-weight:500;color:var(--ink-suau);margin-top:3px;line-height:1.35;max-width:34ch}
.balanc .canvi .peu-nota{text-align:right;max-width:none}
.destacat{background:var(--presec);color:#1E1B2E;border:2.5px solid var(--ink);border-radius:var(--r-m);
  box-shadow:var(--ombra);padding:var(--e2);margin:var(--e3) 0 0;font-size:1rem}
@media (max-width:620px){
  .balanc thead{display:none}
  .balanc tr{display:grid;grid-template-columns:1fr auto;gap:2px 10px;padding:12px 0;border-bottom:1px solid var(--vora)}
  .balanc tbody th,.balanc td{border:0;padding:0;text-align:left}
  .balanc tbody th{grid-column:1/-1}
  .balanc .fletxa{display:none}
  .balanc .abans::after{content:" →";color:var(--ink-suau)}
  .balanc .abans,.balanc .ara{display:inline}
  .balanc .canvi{grid-column:1/-1;text-align:left;padding:2px 0 0}
}

/* --- de qui és cada tram de la sèrie --- */
.clau-mandats{list-style:none;margin:var(--e2) 0 0;padding:0;display:flex;flex-wrap:wrap;gap:6px 16px;font-size:.78rem;color:var(--ink-suau)}
.clau-mandats li{display:flex;align-items:center;gap:6px}
.clau-mandats .tram-mandat{width:14px;height:14px;border-radius:3px;border:1.5px solid var(--ink);background:var(--lavanda)}
.clau-mandats .mandat-2019-2023 .tram-mandat,li.mandat-2019-2023 .tram-mandat{background:var(--menta)}
.clau-mandats li.mandat-2015-2019 .tram-mandat{background:var(--presec)}
.columnes li.mandat-2019-2023{background:var(--menta)}
.columnes li.mandat-2015-2019{background:var(--presec)}

/* --- semàfor financer --------------------------------------------------
   El color no és l'única senyal: cada targeta porta també una barra lateral de
   gruix diferent, perquè es distingeixin sense veure els colors. */
.indicadors{list-style:none;margin:0 0 var(--e3);padding:0;display:grid;gap:var(--e2);grid-template-columns:repeat(auto-fit,minmax(230px,1fr))}
.indicador{background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);box-shadow:var(--ombra);padding:var(--e2);display:flex;flex-direction:column;gap:6px;border-left-width:10px}
.indicador .nom{font-size:.74rem;font-weight:800;text-transform:uppercase;letter-spacing:.09em;color:var(--ink-suau)}
/* La sèrie de dotze anys dins de la targeta de l'indicador: més curta que la
   de les targetes grans, perquè aquí competeix amb la xifra i no l'ha de
   guanyar. */
.indicador .espurna{margin:4px 0 0}
.indicador .espurna svg{height:34px}
.indicador .espurna .ara{width:8px;height:8px}
.indicador .secundari{font-size:.82rem;line-height:1.4}
.nivell-bo{border-left-color:var(--menta)}
.nivell-avis{border-left-color:var(--presec)}
.nivell-alerta{border-left-color:var(--coral)}
.nivell-sense-dades{border-left-color:var(--vora)}
.subtitol{font-family:var(--display);font-weight:900;font-size:1.05rem;margin:var(--e3) 0 var(--e2)}
.columnes{list-style:none;margin:0;padding:0;display:flex;align-items:flex-end;gap:5px;height:150px;border-bottom:2.5px solid var(--ink)}
.columnes li{flex:1 1 0;height:var(--h);background:var(--lavanda);border:1.5px solid var(--ink);border-bottom:0;border-radius:var(--r-s) var(--r-s) 0 0;position:relative;min-width:0}
.columnes .valor{position:absolute;top:-19px;left:0;right:0;text-align:center;font-size:.62rem;font-weight:800;color:var(--ink-suau)}
.columnes .any{position:absolute;bottom:-20px;left:0;right:0;text-align:center;font-size:.68rem;color:var(--ink-suau)}
/* Amb onze columnes en 272px, cada una fa 18px: les etiquetes es tocaven. */
@media (max-width:430px){ .columnes .valor{font-size:.56rem} .columnes .any{font-size:.6rem} }
.columnes{margin-bottom:26px}

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

/* --- on anar després: les peces han d'estar connectades entre elles --- */
.destins{list-style:none;margin:0;padding:0;display:grid;gap:var(--e2);grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
.destins > li > a{display:flex;flex-direction:column;gap:4px;background:var(--paper-2);border:2.5px solid var(--ink);
  border-radius:var(--r-m);box-shadow:var(--ombra);padding:var(--e2);text-decoration:none;color:inherit;height:100%;
  transition:transform .12s ease,box-shadow .12s ease}
.destins > li > a:hover{transform:translate(2px,2px);box-shadow:1px 1px 0 var(--ink)}
.destins b{font-family:var(--display);font-weight:900;font-size:1.1rem;letter-spacing:-.02em}
.destins span{font-size:.86rem;color:var(--ink-suau);line-height:1.4}
.destins span a{color:inherit}
@media (prefers-reduced-motion:reduce){.destins > li > a{transition:none}}

/* --- què publica i què no ---------------------------------------------
   El senyal no és només color: hi ha la marca, la paraula i la posició. Qui no
   distingeixi el verd del vermell ho ha de poder llegir igual. */
.transparencia{list-style:none;margin:0 0 var(--e2);padding:0}
.transparencia li{display:flex;align-items:baseline;gap:10px;padding:9px 0;border-bottom:1px solid var(--vora)}
.transparencia .senyal{font-weight:900;font-size:1rem;flex:none;width:1.1em;text-align:center}
.transparencia .hi-es .senyal{color:#1d7a4f}
.transparencia .no-hi-es .senyal{color:var(--coral-text)}
@media (prefers-color-scheme:dark){.transparencia .hi-es .senyal{color:#7fd6a8}}
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
.peu{max-width:var(--ample);margin:0 auto;padding:var(--e3);border-top:2.5px solid var(--ink);font-size:.84rem;color:var(--ink-suau)}

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
   sense robar amplada al text, que es queda igual d'ample que abans. */
@media (min-width:1180px){
  :root{ --ample:1180px }
  main{display:grid;grid-template-columns:186px minmax(0,1fr);column-gap:var(--e5);align-items:start}
  main > *{grid-column:2;min-width:0}
  .index{grid-column:1;grid-row:1 / span 99;position:sticky;top:var(--e3);align-self:start;
    display:flex;flex-direction:column;gap:0;border-top:0;margin-top:0;padding:var(--e5) 0 0}
  .index a{border:0;border-left:2.5px solid var(--vora);border-radius:0;min-height:0;
    padding:8px 0 8px 14px;font-size:.82rem;justify-content:flex-start;line-height:1.25;
    transition:border-color .12s ease,color .12s ease}
  .index a:hover{background:none;color:var(--coral-text);border-left-color:var(--coral)}
  /* Al rail la marca és la barra de l'esquerra, que és el que dibuixa el
     recorregut de la pàgina: es veu on ets i quant en queda. */
  .index a[aria-current]{background:none;color:var(--ink);font-weight:900;
    border-left-color:var(--ink);border-left-width:4px;padding-left:12px}
  /* Una línia de text de 1.180px no es llegeix: l'amplada de més va als blocs
     de dades i la prosa es queda on ha d'estar. */
  .bloc > p,.entrada-bloc,.nota,.compta,figcaption,.peu-nota{max-width:70ch}
}
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
/* Una afirmació amb una cita que no hem trobat: es veu que està tocada sense
   haver de llegir el text, i no es confon amb les bones. */
.pregunta.cita-fallida{border-style:dashed;opacity:.85}
.avis-cita{background:var(--coral);color:#FBF7EE;border:2.5px solid var(--ink);
  border-radius:var(--r-m);padding:var(--e2);margin:0 0 var(--e2);font-size:.9rem}
/* El districte d'una afirmació, a les ciutats que en tenen. */
.districte{display:inline-block;margin-left:8px;background:var(--lavanda);color:#1E1B2E;
  border:1.5px solid var(--ink);border-radius:var(--r-max);padding:3px 12px;font-size:.7rem;
  font-weight:800;text-transform:uppercase;letter-spacing:.06em}
/* Com ha anat el mandat: el canvi del poble i el dels seus, un al costat de
   l'altre. El color marca millora o empitjorament, però la frase de sota deixa
   clar que qui jutja és qui llegeix. */
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
.mandat li.millora .salt{color:#1E6B4A}
.mandat li.empitjora .salt{color:var(--coral-text,#C24429)}
/* En fosc, el verd de la millora es queda a 2,55:1 damunt de la targeta: és el
   mateix cas que ja estava resolt a la taula del balanç i aquí s'havia quedat
   sense resoldre. */
@media (prefers-color-scheme:dark){ .mandat li.millora .salt{color:#7FD6A8} }
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
/* Les targetes sense espurna —les que no tenen prou anys de sèrie— s'estiraven
   fins a l'alçada de la que en té, i hi quedava un pam de targeta buida. */
.gent,.origens,.preus{align-items:start}
.gent{grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}
.origens{grid-template-columns:repeat(auto-fit,minmax(250px,1fr))}
/* Fill directe i no qualsevol «li»: dins d'aquestes targetes n'hi ha una altra
   llista —els càrrecs que té algú en un altre ens— i heretava la targeta
   sencera, contorn i ombra incloses, i el «flex-direction:column» hi partia
   «Diputació de Barcelona, Presidències delegades» en dues línies amb la coma
   penjant al principi de la segona. */
.gent > li,.origens > li,.preus > li{background:var(--paper-2);border:2.5px solid var(--ink);
  border-radius:var(--r-m);box-shadow:var(--ombra);padding:var(--e2) var(--e3);
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
.euros-resultat thead th{font-family:var(--display);font-weight:900;font-size:.8rem;
  text-transform:uppercase;letter-spacing:.06em;color:var(--ink-suau);
  border-bottom:2.5px solid var(--ink);white-space:normal;line-height:1.15}
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
.rotul-serie{display:block;font-size:.68rem;font-weight:800;letter-spacing:.1em;
  text-transform:uppercase;color:var(--ink-suau)}

.boto-prova{display:inline-block;font-weight:800;font-size:1rem;text-decoration:none;
  background:var(--coral);color:#1E1B2E;border:2.5px solid var(--ink);border-radius:var(--r-max);
  padding:12px 26px;box-shadow:var(--ombra);transition:transform .12s ease,box-shadow .12s ease}
.boto-prova:hover{transform:translate(2px,2px);box-shadow:1px 1px 0 var(--ink)}
.prova-enllac{display:inline-flex;align-items:center;min-height:44px;margin-top:6px;font-weight:800;font-size:.85rem;
  border:2px solid var(--ink);border-radius:var(--r-max);padding:0 16px;text-decoration:none}
.prova-enllac:hover{background:var(--presec);color:#1E1B2E}
${GRAFICS_CSS}`;
