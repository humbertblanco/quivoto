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
}
@media (prefers-color-scheme: dark){
  :root{ --paper:#17141F; --paper-2:#211D2C; --ink:#F4F0E6; --ink-suau:#A9A3B8; --vora:rgba(244,240,230,.16); }
}
*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--text);font-size:17px;line-height:1.55;-webkit-font-smoothing:antialiased}
h1,h2{font-family:var(--display);font-weight:900;letter-spacing:-.025em;line-height:1.03;margin:0}
h1{font-size:clamp(2.6rem,9vw,4.6rem)}
h2{font-size:clamp(1.5rem,4vw,2.1rem);margin-bottom:var(--e2)}
p{margin:0 0 var(--e2)}
a{color:inherit;text-underline-offset:3px}
:focus-visible{outline:3px solid var(--coral);outline-offset:3px;border-radius:4px}
.salta{position:absolute;left:-9999px;background:var(--ink);color:var(--paper);padding:var(--e1) var(--e2);z-index:9}
.salta:focus{left:0}
.nomes-lectors{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

.capcalera{display:flex;justify-content:space-between;align-items:center;gap:var(--e2);max-width:var(--ample);margin:0 auto;padding:var(--e3)}
.logo{font-family:var(--display);font-weight:900;letter-spacing:-.05em;font-size:1.3rem;text-decoration:none}
.etiqueta{background:var(--presec);color:#1E1B2E;border-radius:var(--r-max);padding:5px 12px;font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em}

main{max-width:var(--ample);margin:0 auto;padding:0 var(--e3) var(--e5)}
.portada{padding:var(--e3) 0 var(--e4)}
.micro{font-size:.76rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--coral);margin:0 0 var(--e2)}
.entrada{font-size:1.15rem;color:var(--ink-suau);margin:var(--e2) 0 0}
.entrada-bloc{color:var(--ink-suau)}
.bloc{padding:var(--e4) 0;border-top:2.5px solid var(--ink);scroll-margin-top:var(--e3)}

/* --- el resum d'una frase: el que es llegeix abans de fer scroll --- */
.resum{font-family:var(--display);font-weight:900;font-size:clamp(1.15rem,3.2vw,1.5rem);
  letter-spacing:-.02em;line-height:1.25;margin:var(--e3) 0 0;max-width:30ch}
.resum b{color:var(--coral)}

/* --- índex: amb dotze blocs, cal poder-hi saltar --- */
.index{display:flex;flex-wrap:wrap;gap:6px;padding:var(--e3) 0 0;border-top:2.5px solid var(--ink);margin-top:var(--e4)}
.index a{font-size:.78rem;font-weight:800;text-decoration:none;border:2px solid var(--ink);
  border-radius:var(--r-max);padding:6px 13px;transition:background var(--t,.12s) ease,color .12s ease}
.index a:hover{background:var(--ink);color:var(--paper)}
@media (prefers-reduced-motion:reduce){.index a{transition:none}}
.nota{font-size:.92rem;color:var(--ink-suau);margin-top:var(--e2)}
.nota.feble{color:var(--coral);font-weight:700}
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
.credit-foto{font-size:.76rem;color:rgba(30,27,46,.6);margin:var(--e2) 0 0}
@media (prefers-color-scheme:dark){.credit-foto{color:var(--ink-suau)}}
.veredicte{font-weight:800;font-size:1.05rem;margin:0 0 var(--e1)}
.veredicte.pacte{color:var(--coral)}
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
.serie{width:100%;border-collapse:collapse}
.serie th{text-align:left;font-family:var(--display);font-weight:900;font-size:1.3rem;width:4.2em;vertical-align:middle}
.serie td{padding:8px 0}
.barra{display:flex;height:46px;border:2.5px solid var(--ink);border-radius:var(--r-s);overflow:hidden}
.tram{width:var(--w);background:var(--c);display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;border-right:1.5px solid var(--ink);color:#1E1B2E}
.tram:last-child{border-right:0}
.tram b{font-size:.9rem;font-weight:900;line-height:1}
.tram i{font-size:.6rem;font-style:normal;opacity:.75;white-space:nowrap;max-width:100%;overflow:hidden}

/* --- participació i paritat --- */
.participacio,.paritat{list-style:none;margin:0;padding:0;display:grid;gap:var(--e2);grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}
.participacio li,.paritat li{background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);box-shadow:var(--ombra);padding:var(--e2);display:flex;flex-direction:column;gap:4px}
.paritat li{flex-direction:row;align-items:baseline;gap:var(--e2)}
.gran{font-family:var(--display);font-weight:900;font-size:2.1rem;line-height:1;letter-spacing:-.03em}

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
.eleccions .tros{height:var(--h);min-height:3px;background:var(--c);color:#1E1B2E;font-size:.66rem;font-weight:900;
  display:flex;align-items:center;justify-content:center;box-shadow:inset 0 1px 0 rgba(30,27,46,.28)}
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
  .eleccions .peu-any b{font-size:.66rem}
  .eleccions .peu-any i{display:none}
  .eleccions .tros{font-size:.55rem}
}

/* --- diners: import, regle i mediana --------------------------------- */
.diners{list-style:none;margin:0 0 var(--e2);padding:0;display:grid;gap:var(--e2)}
.diners li{display:grid;grid-template-columns:minmax(9em,auto) auto 1fr;gap:4px var(--e2);align-items:center}
.diners .etq{font-weight:800;font-size:.92rem}
.diners .imp{font-family:var(--display);font-weight:900;font-size:1.25rem;letter-spacing:-.02em;font-variant-numeric:tabular-nums;text-align:right}
.diners .regle{position:relative;height:16px;background:var(--vora);border-radius:var(--r-max);overflow:visible}
.diners .regle i{display:block;height:100%;width:var(--w);background:var(--lavanda);border:1.5px solid var(--ink);border-radius:var(--r-max);min-width:3px}
.diners .regle b{position:absolute;top:-5px;left:var(--m);width:2.5px;height:26px;background:var(--ink);border-radius:2px}
.diners .regle b span{position:absolute;left:5px;top:-2px;font-size:.58rem;font-weight:800;text-transform:uppercase;
  letter-spacing:.08em;color:var(--ink-suau);white-space:nowrap}
.diners li:not(:first-child) .regle b span{display:none}
.diners .comparativa{grid-column:1/-1;font-size:.8rem;margin-top:-2px}
@media (max-width:560px){.diners li{grid-template-columns:1fr auto}.diners .regle{grid-column:1/-1}}

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
.comparativa.mes{color:var(--coral);font-weight:700}
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
.balanc tr.pitjor .canvi{color:var(--coral)}
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
.columnes{margin-bottom:26px}

/* --- el pont amb l'elecció -------------------------------------------
   Tota fitxa ha d'acabar parlant del 23-M: si no, això és un dossier
   d'estadística municipal i no una eina per decidir un vot. */
.bloc.joc{background:var(--lavanda);color:#1E1B2E;border:2.5px solid #1E1B2E;border-radius:var(--r-l);
  box-shadow:6px 6px 0 #1E1B2E;padding:var(--e4) var(--e3);margin-top:var(--e4)}
.bloc.joc h2{margin-bottom:var(--e2)}
.bloc.joc .entrada-bloc,.bloc.joc p{color:#1E1B2E}
.bloc.joc .nota{color:rgba(30,27,46,.66)}
.bloc.joc .crida{font-family:var(--display);font-weight:900;font-size:1.15rem;letter-spacing:-.02em;
  line-height:1.35;margin-top:var(--e3)}
.bloc.joc .crida a{background:#1E1B2E;color:#FBF7EE;text-decoration:none;border-radius:var(--r-max);
  padding:8px 18px;display:inline-block;margin-top:var(--e1);font-size:.95rem;
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

/* --- cobertura --- */
.cobertura{border-left:10px solid var(--menta);padding-left:var(--e3)}
.cobertura-parcial{border-left-color:var(--presec)}
.cobertura-cap{border-left-color:var(--coral)}
.fonts ul{margin:0;padding-left:1.1em;font-size:.92rem;color:var(--ink-suau)}
.fonts code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.85em;background:var(--paper-2);border:1px solid var(--vora);border-radius:5px;padding:1px 5px}
.peu{max-width:var(--ample);margin:0 auto;padding:var(--e3);border-top:2.5px solid var(--ink);font-size:.84rem;color:var(--ink-suau)}
@media (max-width:560px){ .alcaldies thead{display:none} .alcaldies tr{display:grid;grid-template-columns:auto 1fr;gap:0 var(--e2);padding:var(--e1) 0;border-bottom:1px solid var(--vora)} .alcaldies th,.alcaldies td{border:0;padding:1px 0} .alcaldies tbody th{grid-row:span 3} }
`;
