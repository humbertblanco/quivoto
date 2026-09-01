import { buildPeerGroups } from "../derive/peers";
import { capcalera, tipografia } from "./capcalera";
import { cercador } from "./cercador";
import { INDEXABLE, SITE } from "./config";
import { GRAFICS_CSS, regleDispersio } from "./grafics";
import { peu } from "./peu";
import { RADIOGRAFIA_CSS } from "./estil";

const escape = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n = (v: number, d = 0): string => v.toLocaleString("ca-ES", { minimumFractionDigits: d, maximumFractionDigits: d });

/**
 * La fila mínima que necessita la pàgina. Els camps nous són opcionals perquè
 * la integració els pot afegir a la projecció global sense acoblar aquest
 * mòdul a la base de dades. `null` és absència; zero és sempre una dada vàlida.
 */
export type RankingRow = {
  s: string; n: string; c: string; p: number;
  pt?: number | null;
  rn?: number | null; ra?: number | null;
  /** Recollida selectiva bruta i any de referència. */
  rs?: number | null; rsa?: number | null;
  /** Preu domèstic comparable de l'aigua i any de referència. */
  pa?: number | null; paa?: number | null;
  /** Rebut mitjà d'IBI urbà i any de referència. */
  ibi?: number | null; ibia?: number | null;
  /** Alternances de la força més votada i eleccions amb dada des del 1979. */
  v?: number | null; q?: number | null;
};

type Met = {
  id: string; titol: string; any: number | string; unitat: string;
  valor: (r: RankingRow) => number | null;
  format: (v: number) => string; font: string; metode: string; cautela: string;
};

const finit = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const mateixAny = (valor: number | null | undefined, any: number | null | undefined, esperat: number): number | null =>
  finit(valor) && any === esperat ? valor : null;

const METRIQUES: readonly Met[] = [
  { id: "poblacio", titol: "Població", any: 2025, unitat: "habitants", valor: r => finit(r.p) ? r.p : null,
    format: v => n(v), font: "Idescat · padró municipal", metode: "Padró de 2025; comparació en nombres absoluts.",
    cautela: "La població és context i no una valoració del govern municipal." },
  { id: "participacio", titol: "Participació municipal", any: 2023, unitat: "%", valor: r => finit(r.pt) ? r.pt : null,
    format: v => `${n(v, 2)}%`, font: "Generalitat de Catalunya · resultats electorals",
    metode: "Votants sobre el cens a les municipals de 2023.", cautela: "La mida i la competència electoral influeixen en la participació." },
  { id: "renda", titol: "Renda neta per persona", any: 2023, unitat: "€/any", valor: r => mateixAny(r.rn, r.ra, 2023),
    format: v => `${n(v)} €`, font: "INE · Atles de distribució de renda de les llars",
    metode: "Només municipis amb renda del mateix any, 2023.", cautela: "Descriu la població resident; no els recursos ni l'acció de l'ajuntament." },
  { id: "selectiva", titol: "Recollida selectiva", any: 2024, unitat: "%", valor: r => mateixAny(r.rs, r.rsa, 2024),
    format: v => `${n(v, 1)}%`, font: "Agència de Residus de Catalunya",
    metode: "Percentatge brut de recollida selectiva sobre residus municipals, 2024.", cautela: "La recollida bruta inclou impropis i depèn del model i de la població estacional." },
  { id: "aigua", titol: "Preu de l'aigua", any: 2025, unitat: "€/m³", valor: r => mateixAny(r.pa, r.paa, 2025),
    format: v => `${n(v, 3)} €/m³`, font: "Agència Catalana de l'Aigua · Observatori del preu de l'aigua",
    metode: "Mateix consum domèstic de referència i tarifes de 2025.", cautela: "El preu no mesura la qualitat i varia amb costos físics i estructura tarifària." },
  { id: "ibi", titol: "Rebut mitjà d'IBI urbà", any: 2025, unitat: "€", valor: r => mateixAny(r.ibi, r.ibia, 2025),
    format: v => `${n(v, 2)} €`, font: "Idescat · impost sobre béns immobles urbans",
    metode: "Quota íntegra urbana dividida pels rebuts, exercici 2025.", cautela: "Depèn alhora del tipus municipal i dels valors cadastrals dels immobles." },
  { id: "alternances", titol: "Canvis de força més votada", any: "1979–2023", unitat: "canvis", valor: r => finit(r.v) && r.q === 12 ? r.v : null,
    format: v => `${n(v)} canvis`, font: "AOC i Generalitat · resultats municipals històrics",
    metode: "Només sèries completes de les dotze eleccions municipals de 1979 a 2023.", cautela: "Compta canvis de sigles guanyadores, no necessàriament canvis d'alcaldia o de bloc." },
] as const;

export type RankingPreparat = { metrica: Met; files: Array<{ fila: RankingRow; valor: number; grup: string; grupNom: string }>; cobertura: number; exclosos: string };

/** Aplica els llindars abans de renderitzar: 90% de Catalunya i vint valors. */
export function preparaRanquings(rows: readonly RankingRow[]): RankingPreparat[] {
  const grups = buildPeerGroups(rows.map((r, id) => ({ id, population: r.p })));
  return METRIQUES.flatMap((metrica) => {
    const files = rows.flatMap((fila, id) => {
      const valor = metrica.valor(fila);
      const grup = grups.get(id);
      return valor === null || !grup ? [] : [{ fila, valor, grup: grup.key, grupNom: grup.label }];
    });
    const cobertura = rows.length === 0 ? 0 : files.length / rows.length;
    if (files.length < 20 || cobertura < 0.9) return [];
    files.sort((a, b) => b.valor - a.valor || a.fila.n.localeCompare(b.fila.n, "ca"));
    return [{ metrica, files, cobertura, exclosos: `${rows.length - files.length} sense una dada comparable de ${String(metrica.any)}` }];
  });
}

function bloc(r: RankingPreparat): string {
  const fmt = r.metrica.format;
  const grups = [...new Map(r.files.map(x => [x.grup, x.grupNom])).entries()];
  const grupInicial = grups[0]?.[0] ?? "cat";
  let posicioInicial = 0;
  const dispersio = regleDispersio(r.metrica.titol, r.files.map(x => ({ valor: x.valor, nom: x.fila.n, slug: x.fila.s })), {
    base: "../", format: fmt, quants: `${r.files.length} municipis amb dada`, etiquetaMediana: "La mediana", sotaMediana: "municipi del mig",
  });
  const files = r.files.map(x => { const visible = x.grup === grupInicial; const pos = visible ? ++posicioInicial : 0; return `<li${visible ? "" : " hidden"} data-grup="${escape(x.grup)}" data-nom="${escape(`${x.fila.n} ${x.fila.c}`.toLocaleLowerCase("ca"))}"><span class="pos">${pos || ""}</span><span class="municipi"><a href="../m/${escape(x.fila.s)}/">${escape(x.fila.n)}</a><small>${escape(x.fila.c)}</small></span><b class="dada">${escape(fmt(x.valor))}</b></li>`; }).join("");
  const top = r.files.filter(x => x.grup === grupInicial).slice(0, 10)
    .map((x, i) => `<li><span>${i + 1}</span><a href="../m/${escape(x.fila.s)}/">${escape(x.fila.n)}</a><b>${escape(fmt(x.valor))}</b></li>`).join("");
  return `<section class="ranquing" id="${escape(r.metrica.id)}"><p class="micro">${escape(String(r.metrica.any))}</p><h2>${escape(r.metrica.titol)}</h2>
  <ol class="top">${top}</ol>
  ${dispersio}<div class="controls"><label>Àmbit <select data-cohort>${grups.map(([key, nom]) => `<option value="${escape(key)}">${escape(nom)}</option>`).join("")}<option value="cat">Tot Catalunya</option></select></label><label>Cerca <input data-filtre type="search" placeholder="Municipi o comarca"></label></div>
  <p class="resum">Comencem per municipis d'una mida semblant. Canvia l'àmbit per explorar altres municipis o tot Catalunya.</p>
  <ol class="llista-ranquing" aria-label="Classificació de ${escape(r.metrica.titol)}">${files}</ol>
  <details><summary>D'on surt aquesta comparació?</summary><p><b>${escape(r.metrica.font)}</b> · ${escape(r.metrica.metode)}</p><p>${escape(r.metrica.cautela)}</p></details></section>`;
}

const CSS = `${GRAFICS_CSS}
.intro{max-width:72ch}.index-r{display:flex;gap:8px;flex-wrap:wrap;margin:var(--e3) 0}.index-r a{border:2px solid var(--vora);border-radius:999px;padding:8px 13px;text-decoration:none}.ranquing{margin:var(--e5) 0;padding-top:var(--e3);border-top:3px solid var(--ink)}
.top{list-style:none;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.top li{display:grid;grid-template-columns:2rem 1fr auto;gap:8px;align-items:center;background:var(--paper-2);border:2px solid var(--vora);border-radius:var(--r-m);padding:10px}.top span,.top b{font-family:var(--display);font-weight:900}.controls{display:flex;gap:16px;flex-wrap:wrap;align-items:end;margin:var(--e3) 0}.controls label{font-weight:800}.controls select,.controls input{display:block;margin-top:4px;min-height:42px;border:2px solid var(--ink);border-radius:9px;background:var(--paper);padding:7px 10px;color:var(--ink)}.resum{color:var(--ink-suau)}
.llista-ranquing{list-style:none;padding:0;margin:var(--e2) 0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.llista-ranquing li{display:grid;grid-template-columns:2.5rem minmax(0,1fr) auto;gap:10px;align-items:center;border:2px solid var(--vora);border-radius:var(--r-m);padding:11px 13px;background:var(--paper-2);transition:transform .12s,box-shadow .12s}.llista-ranquing li:hover{transform:translate(-1px,-1px);box-shadow:3px 3px 0 var(--ink);border-color:var(--ink)}.llista-ranquing [hidden]{display:none}.pos{font-family:var(--display);font-weight:900;font-size:1.2rem;color:var(--coral)}.municipi a,.dada{font-family:var(--display);font-weight:900}.municipi small{display:block;color:var(--ink-suau);font-size:.78rem;margin-top:2px}.dada{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}details{margin-top:var(--e2);border:2px solid var(--vora);border-radius:var(--r-m);padding:var(--e2);background:var(--paper-2)}details summary{font-family:var(--display);font-weight:900;cursor:pointer}
@media(max-width:760px){.top,.llista-ranquing{grid-template-columns:1fr}.controls{display:block}.controls label{display:block;margin-top:10px}.controls select,.controls input{width:100%}}
`;

const JS = `<script>(()=>{document.querySelectorAll('.ranquing').forEach(s=>{const q=s.querySelector('[data-filtre]'),c=s.querySelector('[data-cohort]'),rows=[...s.querySelectorAll('.llista-ranquing>li')],top=s.querySelector('.top');const apply=()=>{const term=q.value.trim().toLocaleLowerCase('ca'),grup=c.value;let pos=0,primers=[];rows.forEach(r=>{const show=r.dataset.nom.includes(term)&&(grup==='cat'||r.dataset.grup===grup);r.hidden=!show;if(show){r.querySelector('.pos').textContent=String(++pos);if(primers.length<10)primers.push(r);}});top.innerHTML=primers.map((r,i)=>'<li><span>'+(i+1)+'</span>'+r.querySelector('.municipi a').outerHTML+'<b>'+r.querySelector('.dada').textContent+'</b></li>').join('');};q.addEventListener('input',apply);c.addEventListener('change',apply);apply();});})();</script>`;

/**
 * Signatura d'integració: `renderRanquings(files, generatedAt)`. `files` ha de
 * portar els set camps opcionals de `RankingRow`; les mètriques que no arribin
 * al 90%/20 simplement no es publiquen.
 */
export function renderRanquings(rows: readonly RankingRow[], generatedAt: string): string {
  const preparats = preparaRanquings(rows);
  const index = preparats.map(r => `<a href="#${escape(r.metrica.id)}">${escape(r.metrica.titol)}</a>`).join("");
  return `<!doctype html><html lang="ca"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rànquings municipals · Observatori · quivoto</title><meta name="description" content="Comparacions reproduïbles dels municipis de Catalunya, amb any, font i cauteles."><link rel="canonical" href="${SITE}/observatori/ranquings/">${INDEXABLE ? "" : '<meta name="robots" content="noindex,nofollow">'}${tipografia("../")}<style>${RADIOGRAFIA_CSS}${CSS}</style></head><body><a class="salta" href="#contingut">Ves al contingut</a>${capcalera("../", "ranquings", "dades obertes")}${cercador("../")}<main id="contingut"><header class="intro"><p class="micro">Comparar sense sentenciar</p><h1>Rànquings municipals</h1><p class="entrada">Descobreix quins municipis encapçalen cada indicador i compara’ls amb altres d’una mida semblant.</p><p>Una posició descriu una xifra concreta; no diu quin ajuntament és millor. L’any i la font sempre són visibles.</p></header><nav class="index-r" aria-label="Indicadors">${index}</nav>${preparats.map(bloc).join("")} ${preparats.length ? "" : '<p class="nota">Estem preparant comparacions que siguin prou sòlides per publicar-les.</p>'}</main>${peu("../", generatedAt)}${JS}</body></html>`;
}
