import type { Els947Row } from "./els947";
import { cohortHomogenia, extremsEmpatats, type FontMetrica } from "./contracte-metriques";
import { RADIOGRAFIA_CSS } from "./estil";
import { MASCOTA_CSS, papereta } from "./mascota";
import { capcalera, tipografia } from "./capcalera";
import { cercador } from "./cercador";
import { peu } from "./peu";
import { INDEXABLE, SITE } from "./config";

const escape = (t: string): string => t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const n = (v: number, d=0): string => v.toLocaleString("ca-ES",{minimumFractionDigits:d,maximumFractionDigits:d});
export type FilaDestaquen = Els947Row & { rm?: number|null; rma?: number|null };
export type Destacat = { municipis: readonly FilaDestaquen[]; titol:string; valor:string; periode:string; cobertura:string; comparacio:string; font:FontMetrica; advertencia:string };

const FONTS = {
  participacio:{nom:"Generalitat de Catalunya · participació electoral",url:"https://analisi.transparenciacatalunya.cat/d/irrv-2mfc"},
  candidats:{nom:"Generalitat de Catalunya · persones candidates",url:"https://analisi.transparenciacatalunya.cat/d/xnfg-weec"},
  renda:{nom:"INE · Atles de distribució de renda de les llars",url:"https://www.ine.es/experimental/atlas/experimental_atlas.htm"},
} as const satisfies Record<string,FontMetrica>;

function dosExtrems(files:readonly FilaDestaquen[], valor:(f:FilaDestaquen)=>number|null|undefined, periode:(f:FilaDestaquen)=>number|string|null|undefined, t:{max:string;min:string;format:(v:number)=>string;comparacio:string;font:FontMetrica;advertencia:string}):Destacat[]{
  const cohort=cohortHomogenia(files,f=>({valor:valor(f),periode:periode(f)}));
  if(!cohort)return [];
  return (["max","min"] as const).flatMap(mena=>{
    const e=extremsEmpatats(cohort.files,mena); if(!e)return [];
    return [{municipis:[...e.files].sort((a,b)=>a.n.localeCompare(b.n,"ca")),titol:t[mena],valor:t.format(e.valor),periode:cohort.periode,cobertura:`${n(cohort.observades)} de ${n(cohort.total)} municipis`,comparacio:t.comparacio,font:t.font,advertencia:t.advertencia}];
  });
}

export function calculaDestaquen(files:readonly FilaDestaquen[]):Destacat[]{
  if(files.length<20)return [];
  const participacio=dosExtrems(files,f=>f.pt,()=>2023,{max:"Participació més alta",min:"Participació més baixa",format:v=>`${n(v,2)}%`,comparacio:"Votants sobre el cens a les mateixes eleccions municipals.",font:FONTS.participacio,advertencia:"La participació depèn també de la mida, la competència electoral i el context local; no prova cap causa."});
  const paritat=dosExtrems(files,f=>f.f,()=>"mandat 2023–2027",{max:"Pes més alt de dones al ple",min:"Pes més baix de dones al ple",format:v=>`${n(v,1)}%`,comparacio:"Regidores sobre el total de persones electes del ple del mateix mandat.",font:FONTS.candidats,advertencia:"La composició pot canviar amb renúncies i substitucions; el percentatge no explica el poder exercit."});
  // J23 recomana la mediana per unitat de consum per ordenar. La preferim quan
  // la projecció la porta amb prou cobertura; mai no barregem definicions.
  const teMediana=cohortHomogenia(files,f=>({valor:f.rm,periode:f.rma??f.ra}))!==null;
  const renda=teMediana
    ? dosExtrems(files,f=>f.rm,f=>f.rma??f.ra,{max:"Mediana de renda equivalent més alta",min:"Mediana de renda equivalent més baixa",format:v=>`${n(v)} € l'any`,comparacio:"Mediana anual per unitat de consum, mateix any i definició.",font:FONTS.renda,advertencia:"Descriu les llars residents, no els recursos ni l'efecte del govern municipal."})
    : dosExtrems(files,f=>f.rn,f=>f.ra,{max:"Renda neta mitjana per persona més alta",min:"Renda neta mitjana per persona més baixa",format:v=>`${n(v)} € l'any`,comparacio:"Renda neta mitjana per persona, mateix any i definició.",font:FONTS.renda,advertencia:"És una mitjana i pot amagar desigualtats; no mesura els recursos ni l'efecte del govern municipal."});
  // Deute queda fora: Els947 no conserva l'any i una diferència absoluta entre
  // cohorts o grups de mida no és una comparació publicable.
  return [...participacio,...renda,...paritat];
}

const CSS=`
.destaquen-cap{padding:var(--e3) 0 var(--e4);display:grid;grid-template-columns:1fr 150px;gap:var(--e3);align-items:end}.destaquen-cap .mascota svg{display:block;width:100%;height:auto}.criteri{max-width:68ch;color:var(--ink-suau)}
.destacats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--e3);list-style:none;padding:0;margin:0}.destacat{min-width:0;border:2.5px solid var(--ink);border-radius:var(--r-l);box-shadow:var(--ombra);padding:var(--e3);background:var(--paper-2)}.destacat:nth-child(3n+1){background:var(--menta);color:#1E1B2E}.destacat:nth-child(3n+2){background:var(--presec);color:#1E1B2E}
.municipis-empatats{margin:0;padding-left:1.2rem}.municipis-empatats.un{list-style:none;padding:0}.valor{font-family:var(--display);font-size:clamp(1.8rem,5vw,2.8rem);font-weight:900;letter-spacing:-.04em;margin:var(--e2) 0}.fitxa-dada{display:grid;grid-template-columns:7.5rem minmax(0,1fr);gap:6px 12px;border-top:2px solid rgba(30,27,46,.16);padding-top:var(--e2);font-size:.84rem}.fitxa-dada dt{font-weight:900}.fitxa-dada dd{margin:0;overflow-wrap:anywhere}.avis{margin-top:var(--e2);font-size:.82rem;font-weight:700}.metode{margin-top:var(--e4);padding:var(--e3);border:2px solid var(--vora);border-radius:var(--r-m)}
@media(max-width:680px){.destaquen-cap{grid-template-columns:1fr}.destaquen-cap .mascota{display:none}.destacats{grid-template-columns:1fr}.fitxa-dada{grid-template-columns:1fr}}
`;

export function renderDestaquen(files:readonly FilaDestaquen[],generatedAt:string):string{
  const cards=calculaDestaquen(files).map(d=>{const noms=d.municipis.map(m=>`<li><a href="../m/${escape(m.s)}/">${escape(m.n)}</a></li>`).join("");const cap=d.municipis.length>1?`${n(d.municipis.length)} municipis empatats`:"Municipi";return `<li class="destacat"><p class="micro">${escape(d.titol)}</p><h3>${escape(cap)}</h3><ul class="municipis-empatats${d.municipis.length===1?" un":""}">${noms}</ul><p class="valor">${escape(d.valor)}</p><dl class="fitxa-dada"><dt>Període</dt><dd>${escape(d.periode)}</dd><dt>Cobertura</dt><dd>${escape(d.cobertura)}</dd><dt>Comparació</dt><dd>${escape(d.comparacio)}</dd><dt>Font</dt><dd><a href="${escape(d.font.url)}" rel="noopener">${escape(d.font.nom)}</a></dd></dl><p class="avis">Compte: ${escape(d.advertencia)}</p></li>`}).join("\n");
  const llista=cards?`<ul class="destacats">${cards}</ul>`:'<p class="entrada-bloc"><b>Encara no hi ha cap cohort publicable.</b> Calen almenys 20 municipis, un 90% de cobertura i el mateix període.</p>';
  return `<!doctype html><html lang="ca"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Destaquen · Observatori · quivoto</title><meta name="description" content="Municipis que sobresurten en les dades públiques, amb cobertura i comparacions justes."><link rel="canonical" href="${SITE}/observatori/destaquen/">${INDEXABLE?"":'<meta name="robots" content="noindex,nofollow">'}${tipografia("../")}<style>${RADIOGRAFIA_CSS}${MASCOTA_CSS}${CSS}</style></head><body><a class="salta" href="#contingut">Ves al contingut</a>${capcalera("../","destaquen","dades obertes")}${cercador("../")}<main id="contingut"><section class="destaquen-cap"><div><p class="micro">Una lupa sobre els 947</p><h1>Destaquen</h1><p class="entrada">Municipis que surten de la norma, sense convertir una dada aïllada en un judici.</p></div><div class="mascota" aria-hidden="true">${papereta(150,"curios")}</div></section><p class="criteri">Només mostrem cohorts d'un mateix període amb almenys un 90% de cobertura i 20 municipis. Els empats es mostren sencers. No és una classificació dels millors ni dels pitjors.</p><section class="bloc" aria-labelledby="titol-destacats"><h2 id="titol-destacats">Les dades que sobresurten</h2>${llista}</section><section class="metode"><h2>Com s'ha triat</h2><p>Un zero publicat compta com a dada; un buit no. No barregem anys ni definicions per completar una classificació.</p><p><a href="../dades/">Consulta l'esquema i descarrega les dades →</a></p></section></main>${peu("../",generatedAt)}</body></html>`;
}
