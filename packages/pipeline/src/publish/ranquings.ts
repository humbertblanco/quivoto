/**
 * Els rànquings: qui és a dalt i qui a baix de cada indicador.
 *
 * Una sola pàgina, `/observatori/ranquings/`, que fa dues coses que abans
 * eren dues pàgines separades («Destaquen» i «Rànquings») i que deien el
 * mateix dues vegades: els extrems d'un indicador són la primera i l'última
 * fila del seu rànquing, i tenir-los en una pàgina a part, amb un altre nom
 * al menú, era fer triar el lector entre dues portes que duien al mateix
 * lloc. Ara els extrems obren la pàgina —amb els empats sencers, que és
 * l'única cosa que un rànquing ordenat no ensenya bé— i cada targeta porta al
 * rànquing complet de sota.
 *
 * ## Què es publica i què no
 *
 * Una mètrica només surt si té **un mateix període** per a almenys el 90 %
 * dels municipis i vint valors. No es barregen anys per fer créixer la
 * cobertura: el que decideix el període és `cohortHomogenia()`, que tria el
 * més recent que arriba al llindar. Un zero publicat és una dada; un buit no.
 *
 * ## Per què la pàgina porta les dades a dins i no 6.600 files escrites
 *
 * La primera versió escrivia les 947 files de cada indicador, amagades, i
 * un top 10 a part que repetia les deu primeres: dos megabytes i mig d'HTML
 * per a una pàgina que a cada moment n'ensenya quaranta. Ara el servidor
 * escriu les primeres files de cada rànquing (perquè sense JavaScript hi hagi
 * alguna cosa a llegir) i la resta viu en un bloc JSON compacte al final,
 * amb el qual el navegador refà la llista i el regle quan es canvia l'àmbit
 * o s'escriu al cercador.
 */

import { buildPeerGroups, type PeerGroup } from "../derive/peers";
import { slugify } from "../lib/text";
import { capcalera, tipografia } from "./capcalera";
import { cercador } from "./cercador";
import { INDEXABLE, SITE } from "./config";
import { cohortHomogenia, extremsEmpatats } from "./contracte-metriques";
import { GRAFICS_CSS } from "./grafics";
import { peu } from "./peu";
import { RADIOGRAFIA_CSS } from "./estil";

const escape = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n = (v: number, d = 0): string =>
  v.toLocaleString("ca-ES", { minimumFractionDigits: d, maximumFractionDigits: d });

/**
 * La fila mínima que necessita la pàgina: el subconjunt d'`Els947Row` que
 * es compara. Els camps de valor són opcionals perquè la projecció global els
 * pot anar afegint sense acoblar aquest mòdul a la base de dades. `null` és
 * absència; zero és sempre una dada vàlida.
 */
export type RankingRow = {
  s: string; n: string; c: string; p: number;
  /** participació a les municipals del 2023, en percentatge */
  pt?: number | null;
  /** mediana de renda per unitat de consum i any */
  rm?: number | null; rma?: number | null;
  /** recollida selectiva bruta i any */
  rs?: number | null; rsa?: number | null;
  /** preu domèstic de l'aigua i any */
  pa?: number | null; paa?: number | null;
  /** rebut mitjà d'IBI urbà i any */
  ibi?: number | null; ibia?: number | null;
  /** canvis de la força més votada des del 1979, i quantes eleccions tenen dada */
  v?: number | null; q?: number | null;
};

/**
 * Una mètrica comparable. `decimals` i `sufix` són els que fan servir alhora el
 * generador i el navegador per escriure el valor: van al JSON de la pàgina
 * perquè el JavaScript no hagi de saber res més de la mètrica.
 */
export type Metrica = {
  id: string;
  titol: string;
  valor: (r: RankingRow) => number | null | undefined;
  /** El període de la dada d'aquesta fila: un any, o un text quan és un mandat o una sèrie. */
  periode: (r: RankingRow) => number | string | null | undefined;
  decimals: number;
  sufix: string;
  font: string;
  metode: string;
  cautela: string;
};

const finit = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export const METRIQUES: readonly Metrica[] = [
  {
    id: "poblacio", titol: "Població",
    valor: (r) => (finit(r.p) ? r.p : null), periode: () => "padró vigent",
    decimals: 0, sufix: "",
    font: "Generalitat de Catalunya · dades generals dels ens locals",
    metode: "Habitants del padró vigent, en nombres absoluts.",
    cautela: "La població és context: no valora cap govern municipal.",
  },
  {
    id: "participacio", titol: "Participació a les municipals",
    valor: (r) => r.pt, periode: () => 2023,
    decimals: 2, sufix: "%",
    font: "Generalitat de Catalunya · processos electorals",
    metode: "Votants sobre el cens a les eleccions municipals del 2023.",
    cautela: "La mida del municipi i la competència electoral pesen molt en la participació: un poble de trenta veïns arriba al cent per cent amb més facilitat que una ciutat.",
  },
  {
    id: "renda", titol: "Renda de les llars",
    valor: (r) => r.rm, periode: (r) => r.rma,
    decimals: 0, sufix: " €",
    font: "INE · Atles de distribució de renda de les llars",
    metode: "Mediana anual de la renda per unitat de consum, el mateix any i la mateixa definició per a tothom.",
    cautela: "Descriu les llars que hi viuen, no els recursos de l'ajuntament ni l'efecte del govern municipal.",
  },
  {
    id: "selectiva", titol: "Recollida selectiva",
    valor: (r) => r.rs, periode: (r) => r.rsa,
    decimals: 1, sufix: "%",
    font: "Agència de Residus de Catalunya",
    metode: "Percentatge brut de recollida selectiva sobre els residus municipals.",
    cautela: "El percentatge brut inclou impropis i depèn del model de recollida i de la població estacional.",
  },
  {
    id: "aigua", titol: "Preu de l'aigua",
    // Un zero aquí no és un preu: és un municipi que no publica cap tarifa de
    // subministrament (dotze pobles del Pirineu, el 2025). A la fitxa es diu
    // tal com ve; al rànquing, «el més barat: 0,000 €» seria una comparació
    // falsa, i per això el zero es tracta com a absència. Decisió editorial
    // de l'1-09-2026.
    valor: (r) => (finit(r.pa) && r.pa > 0 ? r.pa : null), periode: (r) => r.paa,
    decimals: 3, sufix: " €/m³",
    font: "Agència Catalana de l'Aigua · Observatori del preu de l'aigua",
    metode: "Tram de subministrament domèstic, amb el mateix consum de referència per a tothom.",
    cautela: "El preu no mesura la qualitat del servei: depèn dels costos físics de portar l'aigua i de com és l'estructura tarifària.",
  },
  {
    id: "ibi", titol: "Rebut mitjà d'IBI urbà",
    valor: (r) => r.ibi, periode: (r) => r.ibia,
    decimals: 2, sufix: " €",
    font: "Idescat · impost sobre béns immobles urbans",
    metode: "Quota íntegra urbana dividida pel nombre de rebuts de l'exercici.",
    cautela: "Depèn alhora del tipus que fixa l'ajuntament i dels valors cadastrals dels immobles, que no els fixa ell.",
  },
  {
    id: "alternances", titol: "Canvis de força més votada",
    valor: (r) => (finit(r.v) && r.q === 12 ? r.v : null), periode: () => "1979-2023",
    decimals: 0, sufix: " canvis",
    font: "Consorci AOC i Generalitat · resultats municipals històrics",
    metode: "Quantes vegades ha canviat la llista més votada, només als municipis amb dada a les dotze eleccions municipals.",
    cautela: "Compta canvis de sigles guanyadores: no necessàriament canvis d'alcaldia ni de bloc.",
  },
];

// ------------------------------------------------------------- preparació

export type FilaRanquing = { fila: RankingRow; valor: number; grup: PeerGroup };

export type RanquingPreparat = {
  metrica: Metrica;
  /** El període de la cohort publicada, ja escrit: «2023», «mandat 2023-2027». */
  periode: string;
  /** De més a menys valor, i per nom quan empaten. */
  files: FilaRanquing[];
  observades: number;
  total: number;
};

export type Extrem = { valor: number; files: readonly RankingRow[] };

/** Els grups de mida, del més gran al més petit, que és l'ordre del desplegable. */
function grupsOrdenats(rows: readonly RankingRow[], perFila: Map<number, PeerGroup>): PeerGroup[] {
  const maxim = new Map<string, { grup: PeerGroup; poblacio: number }>();
  rows.forEach((r, id) => {
    const grup = perFila.get(id);
    if (!grup) return;
    const actual = maxim.get(grup.key);
    if (!actual || r.p > actual.poblacio) maxim.set(grup.key, { grup, poblacio: r.p });
  });
  return [...maxim.values()].sort((a, b) => b.poblacio - a.poblacio).map((x) => x.grup);
}

/**
 * Aplica els llindars i ordena. Una mètrica que no arribi al 90 % i vint
 * valors en un mateix període no es publica, i no cal cap avís a la pàgina:
 * la seva absència ja és el missatge, i el bloc de mètode explica el criteri.
 */
export function preparaRanquings(rows: readonly RankingRow[]): RanquingPreparat[] {
  const perFila = buildPeerGroups(rows.map((r, id) => ({ id, population: r.p })));
  const index = new Map(rows.map((r, i) => [r, i]));
  return METRIQUES.flatMap((metrica) => {
    const cohort = cohortHomogenia(rows, (r) => ({ valor: metrica.valor(r), periode: metrica.periode(r) }));
    if (!cohort) return [];
    const files = cohort.files.flatMap(({ fila, valor }) => {
      const grup = perFila.get(index.get(fila) ?? -1);
      return grup ? [{ fila, valor, grup }] : [];
    });
    files.sort((a, b) => b.valor - a.valor || a.fila.n.localeCompare(b.fila.n, "ca"));
    return [{ metrica, periode: cohort.periode, files, observades: cohort.observades, total: cohort.total }];
  });
}

/** Els dos extrems d'un rànquing, amb tots els empats. */
export function extrems(r: RanquingPreparat): { alt: Extrem; baix: Extrem } | null {
  const valors = r.files.map((f) => ({ fila: f.fila, valor: f.valor }));
  const alt = extremsEmpatats(valors, "max");
  const baix = extremsEmpatats(valors, "min");
  return alt && baix ? { alt, baix } : null;
}

// ------------------------------------------------------------------ peces

const format = (m: Metrica) => (v: number): string => `${n(v, m.decimals)}${m.sufix}`;

const fitxa = (r: RankingRow): string => `<a href="../m/${escape(r.s)}/">${escape(r.n)}</a>`;
/** La comarca, en petit i enllaçada a la seva pàgina: és l'altra manera d'agrupar els 947. */
const comarca = (r: RankingRow): string => `<a class="comarca" href="../c/${escape(slugify(r.c))}/">${escape(r.c)}</a>`;

/**
 * Els empatats, escrits com una frase: «Fulleda, Esterri de Cardós i Granyena
 * de les Garrigues». A partir de cinc, els quatre primers i «i 8 més», perquè
 * una targeta no és el lloc per a una llista de dotze pobles; el rànquing de
 * sota els té tots.
 */
function llistaNoms(files: readonly RankingRow[], ancora: string): string {
  const ordenats = [...files].sort((a, b) => a.n.localeCompare(b.n, "ca"));
  const noms = ordenats.slice(0, 4).map(fitxa);
  const resta = ordenats.length - noms.length;
  if (resta > 0) noms.push(`<a href="#${escape(ancora)}">i ${n(resta)} més</a>`);
  if (noms.length === 1) return noms[0]!;
  return `${noms.slice(0, -1).join(", ")} i ${noms[noms.length - 1]}`;
}

/** Una targeta de «Destaquen»: la mètrica, el més alt i el més baix, amb empats. */
function targetaExtrems(r: RanquingPreparat): string {
  const e = extrems(r);
  if (!e) return "";
  const fmt = format(r.metrica);
  const pol = (classe: string, cap: string, x: Extrem): string =>
    `<div class="pol ${classe}"><span class="cap">${cap}</span><b>${escape(fmt(x.valor))}</b>
      <span class="qui">${x.files.length > 1 ? `<i>${n(x.files.length)} empatats:</i> ` : ""}${llistaNoms(x.files, r.metrica.id)}</span></div>`;
  return `<li class="extrem">
    <a class="quina" href="#${escape(r.metrica.id)}"><span class="micro">${escape(r.periode)}</span><b>${escape(r.metrica.titol)}</b><span class="secundari">${n(r.files.length)} municipis</span></a>
    ${pol("alt", "El més alt", e.alt)}
    ${pol("baix", "El més baix", e.baix)}
  </li>`;
}

/**
 * El regle de dispersió d'aquest rànquing, escrit pel servidor per a l'àmbit
 * inicial. Fa el mateix dibuix que `regleDispersio()` de `grafics.ts` i en
 * reutilitza el CSS, però no en crida la funció per dues raons: aquella posa
 * un enllaç per municipi —947 enllaços en una barra de 46 píxels no són
 * clicables i pesen 130 bytes cadascun— i la mediana la calcula del que
 * dibuixa, i aquí les marques es resumeixen (dues del mateix valor són una)
 * mentre que la mediana ha de ser la de tots. El navegador refà aquest mateix
 * dibuix quan canvia l'àmbit, amb `regle()` del JavaScript de sota.
 */
function regle(r: RanquingPreparat): string {
  if (r.files.length < 4) return "";
  const fmt = format(r.metrica);
  const asc = [...r.files].reverse();
  const baix = asc[0]!;
  const alt = asc[asc.length - 1]!;
  if (alt.valor === baix.valor) return "";
  const meitat = Math.floor(asc.length / 2);
  const mig = asc.length % 2 === 0 ? (asc[meitat - 1]!.valor + asc[meitat]!.valor) / 2 : asc[meitat]!.valor;
  const on = (v: number): string => (4 + (92 * (v - baix.valor)) / (alt.valor - baix.valor)).toFixed(1);
  const posicions = [...new Set(asc.map((f) => on(f.valor)))];
  const marques = posicions.map((p) => `<i class="marca" style="--p:${p}%"></i>`).join("");
  return `<figure class="dispersio">
  <figcaption class="titol">Del més baix al més alt <span class="secundari">${n(r.files.length)} municipis amb dada</span></figcaption>
  <div class="regle-dispersio" aria-hidden="true"><i class="mig" style="--p:${on(mig)}%"></i>${marques}</div>
  <ul class="extrems">
    <li><span class="cap">El més baix</span>${fitxa(baix.fila)}<b>${escape(fmt(baix.valor))}</b></li>
    <li><span class="cap">La mediana</span><span class="secundari">el municipi del mig</span><b>${escape(fmt(mig))}</b></li>
    <li><span class="cap">El més alt</span>${fitxa(alt.fila)}<b>${escape(fmt(alt.valor))}</b></li>
  </ul>
</figure>`;
}

/** Quantes files escriu el servidor i quantes n'afegeix cada «Mostra'n més». */
export const PAS = 40;

function filaHtml(f: FilaRanquing, pos: number, fmt: (v: number) => string): string {
  return `<li><span class="pos">${pos}</span><span class="municipi">${fitxa(f.fila)}<small>${comarca(f.fila)}</small></span><b class="dada">${escape(fmt(f.valor))}</b></li>`;
}

function seccio(r: RanquingPreparat, grups: readonly PeerGroup[]): string {
  const m = r.metrica;
  const fmt = format(m);
  const opcions = grups.map((g) => `<option value="${escape(g.key)}">${escape(g.label)}</option>`).join("");
  const files = r.files.slice(0, PAS).map((f, i) => filaHtml(f, i + 1, fmt)).join("\n    ");
  const resta = r.files.length - Math.min(PAS, r.files.length);
  return `<section class="bloc ranquing" id="${escape(m.id)}" data-metrica="${escape(m.id)}">
  <p class="micro">${escape(r.periode)} · ${escape(m.font)}</p>
  <h2>${escape(m.titol)}</h2>
  <p class="entrada-bloc">${escape(m.metode)}</p>
  ${regle(r)}
  <div class="controls">
    <label>Àmbit <select data-ambit><option value="cat">Tot Catalunya</option>${opcions}</select></label>
    <label>Cerca <input data-cerca type="search" autocomplete="off" placeholder="Municipi o comarca"></label>
  </div>
  <ol class="llista-ranquing" aria-label="Rànquing de ${escape(m.titol.toLocaleLowerCase("ca"))}">
    ${files}
  </ol>
  <p class="mes-fila"><button type="button" class="mes" data-mes hidden>Mostra'n ${PAS} més</button>
    <noscript>${resta > 0 ? `Aquí surten els ${PAS} primers de ${n(r.files.length)}; la llista sencera és a <a href="../dades/">les dades</a>.` : ""}</noscript>
    <span class="buit" data-buit hidden>Cap municipi no coincideix amb la cerca en aquest àmbit.</span></p>
  <p class="nota">${escape(m.cautela)}</p>
</section>`;
}

/**
 * El bloc JSON amb què el navegador refà les llistes: cada municipi un sol
 * cop, i per mètrica només l'índex del municipi i el valor. Els noms ja hi
 * són, així que el JavaScript no escriu res que no vingui d'aquí.
 */
function dadesJson(rows: readonly RankingRow[], preparats: readonly RanquingPreparat[], grups: readonly PeerGroup[]): string {
  const perFila = buildPeerGroups(rows.map((r, id) => ({ id, population: r.p })));
  const index = new Map(rows.map((r, i) => [r, i]));
  const municipis = rows.map((r, id) => [r.s, r.n, r.c, perFila.get(id)?.key ?? "", slugify(r.c)]);
  const metriques = Object.fromEntries(
    preparats.map((r) => [
      r.metrica.id,
      { d: r.metrica.decimals, s: r.metrica.sufix, files: r.files.map((f) => [index.get(f.fila), f.valor]) },
    ]),
  );
  return JSON.stringify({ municipis, grups: Object.fromEntries(grups.map((g) => [g.key, g.label])), metriques })
    .replace(/</g, "\\u003c");
}

// -------------------------------------------------------------------- estil

const CSS = `${GRAFICS_CSS}
.intro{max-width:72ch;margin-bottom:var(--e4)}

/* --- Destaquen: una fila per mètrica, els dos pols al costat --------------- */
.extrems-llista{list-style:none;padding:0;margin:var(--e3) 0 0;display:grid;gap:var(--e2)}
.extrem{display:grid;grid-template-columns:minmax(150px,.9fr) 1fr 1fr;gap:var(--e2) var(--e3);align-items:start;
  background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);box-shadow:var(--ombra);padding:var(--e2) var(--e3)}
.extrem .quina{display:flex;flex-direction:column;gap:2px;text-decoration:none;color:inherit;min-width:0}
.extrem .quina .micro{margin:0}
.extrem .quina b{font-family:var(--display);font-weight:900;font-size:1.15rem;letter-spacing:-.02em;line-height:1.15}
.extrem .quina:hover b{color:var(--coral-text)}
.extrem .pol{display:grid;gap:2px;min-width:0;border-left:2px solid var(--vora);padding-left:var(--e2)}
.extrem .cap{font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.09em;color:var(--ink-suau)}
.extrem .pol b{font-family:var(--display);font-weight:900;font-size:1.35rem;letter-spacing:-.03em;font-variant-numeric:tabular-nums;line-height:1.1}
.extrem .qui{font-size:.86rem;color:var(--ink-suau);overflow-wrap:anywhere}
.extrem .qui i{font-style:normal;font-weight:800;color:var(--ink)}
.extrem .qui a{color:var(--ink);font-weight:700}

/* --- cada rànquing --------------------------------------------------------- */
.ranquing .entrada-bloc{max-width:70ch}
.controls{display:flex;gap:var(--e2) var(--e3);flex-wrap:wrap;align-items:end;margin:var(--e3) 0 var(--e2)}
.controls label{font-weight:800;font-size:.9rem}
.controls select,.controls input{display:block;margin-top:4px;min-height:42px;border:2px solid var(--ink);border-radius:9px;
  background:var(--paper);padding:7px 10px;color:var(--ink);font:inherit;font-size:.95rem;min-width:220px}
.controls select:focus-visible,.controls input:focus-visible{outline:3px solid var(--coral-text);outline-offset:2px}
.llista-ranquing{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.llista-ranquing li{display:grid;grid-template-columns:2.4rem minmax(0,1fr) auto;gap:10px;align-items:center;
  border:2px solid var(--vora);border-radius:var(--r-m);padding:9px 12px;background:var(--paper-2)}
.llista-ranquing li:hover{border-color:var(--ink);box-shadow:var(--ombra)}
.llista-ranquing .pos{font-family:var(--display);font-weight:900;font-size:1.15rem;color:var(--coral-text);font-variant-numeric:tabular-nums}
.llista-ranquing .municipi a{font-weight:800;color:var(--ink)}
.llista-ranquing .municipi small{display:block;color:var(--ink-suau);font-size:.76rem;margin-top:1px}
.llista-ranquing .municipi small a{color:inherit;font-weight:600;text-decoration-color:var(--vora)}
.llista-ranquing .municipi small a:hover{color:var(--coral-text)}
.llista-ranquing .dada{font-family:var(--display);font-weight:900;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.mes-fila{margin:var(--e2) 0 0;display:flex;gap:var(--e2);align-items:center;flex-wrap:wrap;color:var(--ink-suau);font-size:.9rem}
.mes{font:inherit;font-weight:800;color:var(--ink);background:var(--paper);border:2px solid var(--ink);border-radius:var(--r-max);
  padding:9px 18px;cursor:pointer;box-shadow:var(--ombra)}
.mes:hover{background:var(--ink);color:var(--paper)}
.mes:focus-visible{outline:3px solid var(--coral-text);outline-offset:2px}

@media(max-width:760px){
  .extrem{grid-template-columns:1fr}
  .extrem .pol{border-left:0;border-top:2px solid var(--vora);padding:var(--e1) 0 0}
  .llista-ranquing{grid-template-columns:1fr}
  .controls select,.controls input{min-width:0;width:100%}
  .controls label{flex:1 1 100%}
}
`;

// --------------------------------------------------------------------- script

/**
 * El JavaScript de la pàgina. Escrit sencer i no minificat: és curt, es
 * llegeix al costat del CSS que el fa servir i el servidor ja serveix comprimit.
 */
const JS = `<script>
(() => {
  const bloc = document.getElementById("dades-ranquings");
  if (!bloc) return;
  const dades = JSON.parse(bloc.textContent);
  const PAS = ${PAS};
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const formats = {};
  const fmt = (v, d, s) => {
    formats[d] ??= new Intl.NumberFormat("ca-ES", { minimumFractionDigits: d, maximumFractionDigits: d });
    return formats[d].format(v) + s;
  };
  const enllac = (m) => '<a href="../m/' + esc(m.s) + '/">' + esc(m.n) + "</a>";

  // El mateix dibuix que fa el servidor: mediana de tots, marques resumides.
  const regle = (files, d, s) => {
    if (files.length < 4) return "";
    const asc = files.slice().reverse();
    const baix = asc[0], alt = asc[asc.length - 1];
    if (alt.valor === baix.valor) return "";
    const meitat = Math.floor(asc.length / 2);
    const mig = asc.length % 2 === 0 ? (asc[meitat - 1].valor + asc[meitat].valor) / 2 : asc[meitat].valor;
    const on = (v) => (4 + (92 * (v - baix.valor)) / (alt.valor - baix.valor)).toFixed(1);
    const posicions = [...new Set(asc.map((f) => on(f.valor)))];
    return '<figcaption class="titol">Del més baix al més alt <span class="secundari">' + fmt(files.length, 0, "") + ' municipis amb dada</span></figcaption>' +
      '<div class="regle-dispersio" aria-hidden="true"><i class="mig" style="--p:' + on(mig) + '%"></i>' +
      posicions.map((p) => '<i class="marca" style="--p:' + p + '%"></i>').join("") + "</div>" +
      '<ul class="extrems"><li><span class="cap">El més baix</span>' + enllac(baix) + "<b>" + esc(fmt(baix.valor, d, s)) + "</b></li>" +
      '<li><span class="cap">La mediana</span><span class="secundari">el municipi del mig</span><b>' + esc(fmt(mig, d, s)) + "</b></li>" +
      '<li><span class="cap">El més alt</span>' + enllac(alt) + "<b>" + esc(fmt(alt.valor, d, s)) + "</b></li></ul>";
  };

  document.querySelectorAll(".ranquing").forEach((seccio) => {
    const m = dades.metriques[seccio.dataset.metrica];
    if (!m) return;
    const files = m.files.map(([i, valor]) => {
      const [s, n, c, grup, cs] = dades.municipis[i];
      return { s, n, c, cs, grup, valor, text: (n + " " + c).toLocaleLowerCase("ca") };
    });
    const ambit = seccio.querySelector("[data-ambit]");
    const cerca = seccio.querySelector("[data-cerca]");
    const llista = seccio.querySelector(".llista-ranquing");
    const mes = seccio.querySelector("[data-mes]");
    const buit = seccio.querySelector("[data-buit]");
    let figura = seccio.querySelector(".dispersio");
    let visibles = PAS;

    const pinta = () => {
      const grup = ambit.value;
      const terme = cerca.value.trim().toLocaleLowerCase("ca");
      const delAmbit = grup === "cat" ? files : files.filter((f) => f.grup === grup);
      // La posició és la de l'àmbit, no la de la cerca: qui busca «vall» ha de
      // veure que Matadepera és el primer de Catalunya, no el primer dels que
      // es diuen Vallès.
      const trobats = delAmbit.map((f, i) => ({ ...f, pos: i + 1 })).filter((f) => !terme || f.text.includes(terme));
      llista.innerHTML = trobats.slice(0, visibles).map((f) =>
        '<li><span class="pos">' + f.pos + '</span><span class="municipi">' + enllac(f) + '<small><a class="comarca" href="../c/' + esc(f.cs) + '/">' + esc(f.c) + "</a></small></span>" +
        '<b class="dada">' + esc(fmt(f.valor, m.d, m.s)) + "</b></li>").join("");
      const resten = trobats.length - Math.min(visibles, trobats.length);
      mes.hidden = resten <= 0;
      mes.textContent = "Mostra'n " + Math.min(PAS, resten) + " més (en queden " + resten + ")";
      buit.hidden = trobats.length > 0;
      // El regle és el de l'àmbit, no el de la cerca: la cerca troba, no compara.
      const dibuix = regle(delAmbit, m.d, m.s);
      if (!figura && dibuix) {
        figura = document.createElement("figure");
        figura.className = "dispersio";
        seccio.querySelector(".controls").before(figura);
      }
      if (figura) { figura.innerHTML = dibuix; figura.hidden = !dibuix; }
    };
    ambit.addEventListener("change", () => { visibles = PAS; pinta(); });
    cerca.addEventListener("input", () => { visibles = PAS; pinta(); });
    mes.addEventListener("click", () => { visibles += PAS; pinta(); });
    // Sense canviar res, la pàgina ja és la que ha escrit el servidor: només cal
    // el botó, que sense JavaScript no faria res i per això arriba amagat.
    const resten = files.length - Math.min(PAS, files.length);
    mes.hidden = resten <= 0;
    mes.textContent = "Mostra'n " + Math.min(PAS, resten) + " més (en queden " + resten + ")";
  });
})();
</script>`;

// -------------------------------------------------------------------- pàgina

export function renderRanquings(rows: readonly RankingRow[], generatedAt: string): string {
  const preparats = preparaRanquings(rows);
  const grups = grupsOrdenats(rows, buildPeerGroups(rows.map((r, id) => ({ id, population: r.p }))));
  const targetes = preparats.map(targetaExtrems).join("\n");
  const cos = preparats.length
    ? `<section class="bloc" id="destaquen">
  <h2>Destaquen</h2>
  <p class="entrada-bloc">El municipi més alt i el més baix de cada indicador, amb els empats sencers.
  Cada fila porta al rànquing complet.</p>
  <ul class="extrems-llista">
${targetes}
  </ul>
</section>
${preparats.map((r) => seccio(r, grups)).join("\n")}`
    : `<p class="nota">Cap indicador no arriba avui al llindar de publicació: un mateix període per a almenys el
  90 % dels municipis i vint valors.</p>`;

  return `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rànquings · Observatori · quivoto</title>
<meta name="description" content="Qui és a dalt i qui a baix de cada indicador als 947 municipis de Catalunya, amb l'any, la font i el que la xifra no diu.">
<link rel="canonical" href="${SITE}/observatori/ranquings/">
${INDEXABLE ? "" : '<meta name="robots" content="noindex,nofollow">'}
${tipografia("../")}
<style>${RADIOGRAFIA_CSS}${CSS}</style>
</head>
<body>
<a class="salta" href="#contingut">Ves al contingut</a>
${capcalera("../", "ranquings", "dades obertes")}
${cercador("../")}
<main id="contingut">
<header class="intro">
  <p class="micro">Comparar sense sentenciar</p>
  <h1>Rànquings</h1>
  <p class="entrada">Qui és a dalt i qui a baix de cada indicador, a tot Catalunya o entre municipis
  d'una mida semblant. Una posició descriu una xifra: no diu quin ajuntament ho fa millor.</p>
</header>
${cos}
<section class="bloc" id="metode">
  <h2>Com s'han triat</h2>
  <p>Un indicador només es publica quan té dada del mateix període per a almenys el 90 % dels
  municipis i per a vint com a mínim. No barregem anys ni definicions per completar una llista:
  si la font d'un municipi no ha publicat l'any que es compara, el municipi no hi surt, i el
  recompte de cada rànquing ho diu. Un zero publicat compta com a dada; un buit no.</p>
  <p>Els grups de mida són els trams de població que fixen quants regidors té cada ple, i per
  tant no els hem triat nosaltres. Els empats surten sencers i per ordre alfabètic.</p>
  <p><a href="../dades/">Les dades sencera i l'esquema de cada camp →</a></p>
</section>
</main>
${peu("../", generatedAt)}
<script type="application/json" id="dades-ranquings">${dadesJson(rows, preparats, grups)}</script>
${JS}
</body>
</html>`;
}
