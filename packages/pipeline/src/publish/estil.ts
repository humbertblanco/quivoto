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
    --coral-text:#E2735A; --ink-suau-tint:#4A4559; }
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
.nomes-lectors{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

.capcalera{display:flex;justify-content:space-between;align-items:center;gap:var(--e2);max-width:var(--ample);margin:0 auto;padding:var(--e3)}
/* Els objectius de toc que van sols (no els enllaços dins d'una frase) han de
   fer 44px d'alt: la mida on un dit hi encerta sense ampliar la pàgina. */
.logo{font-family:var(--display);font-weight:900;letter-spacing:-.05em;font-size:1.3rem;text-decoration:none;
  display:inline-flex;align-items:center;min-height:44px}
.etiqueta{background:var(--presec);color:#1E1B2E;border-radius:var(--r-max);padding:5px 12px;font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em}

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
/* `.resum b` és més específic que `.sigla` i li guanyava el color: les sigles
   del resum sortien en coral damunt del color del seu partit, i «PSC-CP» hi
   quedava a 1,09:1 —coral sobre vermell— i «TriasxBCN-CM» a 2,28. La pastilla
   mana sobre el seu propi text. */
.resum b.sigla{color:var(--t,#FBF7EE)}
/* Les sigles d'un partit, amb el seu color de fons i la tinta triada per
   lluminància: escrites amb el color del partit damunt del paper n'hi ha que no
   arriben a cap mínim de contrast. */
.sigla{display:inline-block;background:var(--c,var(--coral));color:var(--t,#FBF7EE);
  border:2px solid var(--ink);border-radius:var(--r-max);padding:1px 10px;font-weight:900;
  font-size:.92em;line-height:1.35;white-space:nowrap}
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

/* --- índex: amb dotze blocs, cal poder-hi saltar --- */
.index{display:flex;flex-wrap:wrap;gap:6px;padding:var(--e3) 0 0;border-top:2.5px solid var(--ink);margin-top:var(--e4)}
.index a{font-size:.78rem;font-weight:800;text-decoration:none;border:2px solid var(--ink);
  border-radius:var(--r-max);padding:0 15px;display:inline-flex;align-items:center;min-height:44px;
  transition:background .12s ease,color .12s ease}
.index a:hover{background:var(--ink);color:var(--paper)}
@media (prefers-reduced-motion:reduce){.index a{transition:none}}
.nota{font-size:.92rem;color:var(--ink-suau);margin-top:var(--e2)}
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
.llegenda{list-style:none;margin:0;padding:0;display:grid;gap:var(--e1);grid-template-columns:repeat(auto-fit,minmax(230px,1fr))}
.llegenda li{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;padding:6px 0;border-bottom:1px solid var(--vora)}
.mostra{width:14px;height:14px;border-radius:4px;background:var(--c);border:1.5px solid var(--ink);flex:none;align-self:center}
.xifra{font-weight:800}

/* --- sèrie històrica --- */
/* Sense table-layout:fixed, l'amplada mínima de la taula la manaven els noms
   de candidatura del dins dels trams, que van amb white-space:nowrap: amb un
   nom llarg («JUNTS PER ABELLA DE LA CONCA-...») la taula creixia fins a 485px
   i empenyia la pàgina sencera de costat en un mòbil. Ara mana el 100%. */
.serie{width:100%;border-collapse:collapse;table-layout:fixed}
.serie th{text-align:left;font-family:var(--display);font-weight:900;font-size:1.3rem;width:4.2em;vertical-align:middle}
.serie td{padding:8px 0}
.barra{display:flex;height:46px;border:2.5px solid var(--ink);border-radius:var(--r-s);overflow:hidden}
.tram{width:var(--w);min-width:0;background:var(--c);display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;border-right:1.5px solid var(--ink);color:var(--t,#1E1B2E)}
.tram:last-child{border-right:0}
/* Les xifres van en tinta fosca damunt del color de la candidatura, i n'hi ha
   de molt fosques (CiU, PP, Comuns): allà la xifra queda per sota d'1,5:1 i no
   es llegeix. L'halo de paper li dibuixa el contorn, que és el que la fa
   llegible tant si el color de sota és clar com si és fosc. */
.tram b{font-size:.9rem;font-weight:900;line-height:1;
  text-shadow:0 0 3px rgba(251,247,238,.95),0 0 1px rgba(251,247,238,.9)}
.tram i{font-size:.6rem;font-style:normal;opacity:.75;white-space:nowrap;max-width:100%;overflow:hidden}

/* --- participació i paritat --- */
.participacio,.paritat{list-style:none;margin:0;padding:0;display:grid;gap:var(--e2);grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}
.participacio li,.paritat li{background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);box-shadow:var(--ombra);padding:var(--e2);display:flex;flex-direction:column;gap:4px}
.paritat li{flex-direction:row;align-items:baseline;gap:var(--e2)}
.gran{font-family:var(--display);font-weight:900;font-size:2.1rem;line-height:1;letter-spacing:-.03em}
/* Una xifra de set dígits («2.416.005») no cap en una targeta de mòbil i
   sortia per sobre del text del costat. No es pot partir: només encongir. */
@media (max-width:430px){ .gran{font-size:1.55rem} }

/* --- qui seu al ple --------------------------------------------------
   El color de la candidatura hi és perquè es vegi el repartiment d'una ullada,
   i és el mateix que a l'hemicicle. Va a la barra lateral i a la marca del
   títol, mai al fons: el paper continua sent el de la marca, no el del partit. */
.plens{display:grid;gap:var(--e2);grid-template-columns:repeat(auto-fit,minmax(260px,1fr));margin-bottom:var(--e2)}
.grup{background:var(--paper-2);border:2.5px solid var(--ink);border-left-width:10px;border-left-color:var(--c);
  border-radius:var(--r-m);box-shadow:var(--ombra);padding:var(--e2)}
.grup h3{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-family:var(--display);font-weight:900;
  font-size:1rem;letter-spacing:-.01em;margin:0 0 var(--e1)}
.grup .marca-grup{width:13px;height:13px;border-radius:4px;background:var(--c);border:1.5px solid var(--ink);flex:none}
.grup .quants{font-family:var(--text);font-weight:700;font-size:.74rem;color:var(--ink-suau);margin-left:auto}
.grup ul{list-style:none;margin:0;padding:0}
.grup li{padding:6px 0;border-top:1px solid var(--vora);display:flex;align-items:center;gap:10px}
.grup .dades{display:flex;flex-direction:column;gap:1px;min-width:0}
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

/* --- alcaldies --- */
.alcaldies{width:100%;border-collapse:collapse;font-size:.94rem}
.alcaldies th,.alcaldies td{text-align:left;padding:9px 10px 9px 0;border-bottom:1px solid var(--vora);vertical-align:top}
.alcaldies thead th{font-size:.72rem;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-suau);border-bottom:2.5px solid var(--ink)}
.alcaldies tbody th{font-weight:800;white-space:nowrap}
.marca-canvi{display:inline-block;background:var(--presec);color:#1E1B2E;border-radius:var(--r-max);padding:2px 9px;font-size:.7rem;font-weight:800;white-space:nowrap}

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
  text-shadow:0 0 3px rgba(251,247,238,.95),0 0 1px rgba(251,247,238,.9)}
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
.diners .regle{position:relative;height:16px;background:var(--vora);border-radius:var(--r-max);overflow:visible;margin:0 32px}
.diners .regle i{display:block;height:100%;width:var(--w);background:var(--lavanda);border:1.5px solid var(--ink);border-radius:var(--r-max);min-width:3px}
.diners .regle b{position:absolute;top:-5px;left:var(--m);width:2.5px;height:26px;background:var(--ink);border-radius:2px}
.diners .regle b span{position:absolute;left:50%;transform:translateX(-50%);top:-2px;text-align:center;
  font-size:.58rem;font-weight:800;text-transform:uppercase;
  letter-spacing:.08em;color:var(--ink-suau);white-space:nowrap}
.diners li:not(:first-child) .regle b span{display:none}
.diners .comparativa{grid-column:1/-1;font-size:.8rem;margin-top:-2px}
/* A mòbil el regle ocupa tota la fila i no li sobra amplada per al marge: hi
   traiem l'etiqueta, que la frase de sota ja diu on és la mediana catalana. */
@media (max-width:560px){
  .diners li{grid-template-columns:1fr auto}
  .diners .regle{grid-column:1/-1;margin:0}
  .diners .regle b span{display:none}
}

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
.mandat{list-style:none;margin:var(--e3) 0 0;padding:0;display:grid;gap:var(--e2)}
.mandat li{background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);
  box-shadow:var(--ombra);padding:var(--e2) var(--e3);display:grid;gap:2px;
  grid-template-columns:1fr auto;align-items:baseline}
.mandat .etq{font-family:var(--display);font-weight:900;font-size:1.05rem;letter-spacing:-.01em}
.mandat .salt{font-family:var(--display);font-weight:900;font-size:1.35rem;text-align:right;
  font-variant-numeric:tabular-nums}
.mandat li.millora .salt{color:#1E6B4A}
.mandat li.empitjora .salt{color:var(--coral-text,#C24429)}
.mandat .dedes{grid-column:1;font-size:.84rem;color:var(--ink-suau);font-weight:700}
.mandat .del-grup{grid-column:2;text-align:right;font-size:.8rem;color:var(--ink-suau);font-weight:700}
@media (max-width:520px){
  .mandat li{grid-template-columns:1fr}
  .mandat .salt,.mandat .del-grup{grid-column:1;text-align:left}
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
.gent{grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
.origens{grid-template-columns:repeat(auto-fit,minmax(250px,1fr))}
.gent li,.origens li,.preus li{background:var(--paper-2);border:2.5px solid var(--ink);
  border-radius:var(--r-m);box-shadow:var(--ombra);padding:var(--e2) var(--e3);
  display:flex;flex-direction:column;gap:4px;min-width:0}
.gent .etq,.origens .etq,.preus .etq{font-family:var(--display);font-weight:900;font-size:.98rem;
  letter-spacing:-.01em;line-height:1.15}
.gent .gran,.origens .gran,.preus .gran{font-family:var(--display);font-weight:900;
  font-size:clamp(1.8rem,7vw,2.4rem);line-height:1;letter-spacing:-.03em;
  font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.gent .sub,.origens .sub,.preus .sub{font-size:.82rem;color:var(--ink-suau);font-weight:700}
.gent .canvi b,.origens .canvi b,.preus .canvi b{color:var(--ink)}
/* Què compta exactament la xifra: no és lletra petita decorativa, és el que
   impedeix confondre nacionalitat amb lloc de naixement. Per això es llegeix. */
.compta{font-size:.84rem;color:var(--ink-suau);margin:6px 0 0;line-height:1.4}
.font-idescat{display:inline-block;margin-top:auto;padding-top:8px;font-size:.76rem;
  font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--coral-text)}
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

.boto-prova{display:inline-block;font-weight:800;font-size:1rem;text-decoration:none;
  background:var(--coral);color:#1E1B2E;border:2.5px solid var(--ink);border-radius:var(--r-max);
  padding:12px 26px;box-shadow:var(--ombra);transition:transform .12s ease,box-shadow .12s ease}
.boto-prova:hover{transform:translate(2px,2px);box-shadow:1px 1px 0 var(--ink)}
.prova-enllac{display:inline-flex;align-items:center;min-height:44px;margin-top:6px;font-weight:800;font-size:.85rem;
  border:2px solid var(--ink);border-radius:var(--r-max);padding:0 16px;text-decoration:none}
.prova-enllac:hover{background:var(--presec);color:#1E1B2E}
`;
