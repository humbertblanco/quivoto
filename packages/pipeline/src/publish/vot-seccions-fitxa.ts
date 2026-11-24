import {
  URL_FITXA_ICGC_SECCIONS,
  URL_PARTICIPACIO_SECCIO,
  URL_VOTS_SECCIO,
  URL_XAMFRA,
  type EleccioSeccions,
  type VotSeccionsMetric,
} from "../jobs/j47-vot-seccions";

/**
 * «Com vota cada barri»: el mapa del vot per secció censal (J47).
 *
 * Una peça de la col·laboració amb Xamfrà: el mètode i les dades obertes que
 * el visor 3D ja fa servir a l'àrea metropolitana, portats a les fitxes dels
 * municipis amb més d'una secció, i dibuixats amb l'SVG de la casa.
 *
 * ─── DECISIONS DE FORMA ─────────────────────────────────────────────────────
 *
 *   · **Primer qui guanya, després tot el que vulguis.** Sense JavaScript el
 *     mapa ja és llegible: cada secció pintada amb la llista més votada a les
 *     municipals, amb la llegenda i les frases. Amb JavaScript es pot canviar
 *     d'elecció, pintar un partit, la participació o la renda, i tocar una
 *     secció per veure-la sencera.
 *   · **La intensitat és el marge, no el partit.** Al mode «qui guanya» el
 *     color diu qui i l'opacitat diu de quant: tres graons, i la llegenda ho
 *     explica. Un color de partit no fa fosos ni pulsa (MOVIMENT.md).
 *   · **Escales de graons, amb els talls escrits.** Cinc graons d'ample igual
 *     i rodons (de 5 en 5 punts, o de 2.000 en 2.000 €). Res de degradats
 *     continus, perquè ningú no sap llegir-ne el valor.
 *   · **La renda i el vot, de costat i sense causa.** El gràfic de punts posa
 *     cada secció segons la renda i la participació (o el partit que es pinta),
 *     i la frase compara el quart més ric amb el quart més pobre. No diu per
 *     què: ho ensenya.
 *   · **Una taula equivalent**, com tots els gràfics de la fitxa: per secció
 *     fins a 250, i per districte a les ciutats grans.
 */

export const TITOL_VOT_SECCIONS = "Com vota cada barri";
export const CURT_VOT_SECCIONS = "Vot per barri";

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const decimal = (n: number): string => n.toLocaleString("ca-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pct = (n: number): string => `${decimal(n)}&nbsp;%`;
const enter = (n: number): string => Math.round(n).toLocaleString("ca-ES");
const euros = (n: number): string => `${enter(n)}&nbsp;€`;

/** «Districte 2, secció 15» a partir del codi de deu xifres. */
export function nomSeccio(codi: string): string {
  return `Districte ${Number(codi.slice(5, 7))}, secció ${Number(codi.slice(7))}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Càlculs (els mateixos que fa el JavaScript del navegador)
// ─────────────────────────────────────────────────────────────────────────────

/** Vots a candidatures d'una fila: de la cinquena columna al final. */
export const votsCandidatures = (fila: readonly number[]): number => fila.slice(4).reduce((s, v) => s + v, 0);
export const participacio = (fila: readonly number[]): number | null => (fila[0]! > 0 ? (100 * fila[1]!) / fila[0]! : null);

/** L'índex de la llista guanyadora, -2 si hi ha empat i -1 si no hi ha vots. */
export function guanyador(fila: readonly number[]): number {
  let millor = -1, max = 0, empat = false;
  fila.slice(4).forEach((v, i) => {
    if (v > max) { max = v; millor = i; empat = false; }
    else if (v === max && v > 0) empat = true;
  });
  return empat ? -2 : millor;
}

/** Talls rodons de cinc graons entre `min` i `max`. */
export function talls(min: number, max: number, rodo: number): number[] {
  const baix = Math.floor(min / rodo) * rodo;
  const pas = Math.max(rodo, Math.ceil((max - baix) / 5 / rodo) * rodo);
  return [1, 2, 3, 4].map((i) => baix + i * pas).concat([baix, baix + 5 * pas]).sort((a, b) => a - b);
}

/** Les frases de dalt de tot: qui guanya on, i com d'ample és el ventall de la participació. */
export function frases(m: VotSeccionsMetric, e: EleccioSeccions): string[] {
  const codis = m.seccions.map((s) => s.codi).filter((c) => e.files[c]);
  const guanyades = new Map<number, number>();
  for (const c of codis) {
    const g = guanyador(e.files[c]!);
    guanyades.set(g, (guanyades.get(g) ?? 0) + 1);
  }
  const ordre = [...guanyades].filter(([i]) => i >= 0).sort((a, b) => b[1] - a[1]);
  const sortida: string[] = [];
  if (ordre.length === 1) {
    sortida.push(`A les ${e.etiqueta.toLowerCase()}, <strong>${escape(e.llistes[ordre[0]![0]]!.sigles)}</strong> va guanyar a totes les ${codis.length} seccions.`);
  } else if (ordre.length > 1) {
    const nomLl = (i: number): string => `<strong>${escape(e.llistes[i]!.sigles)}</strong>`;
    const [primer, ...resta] = ordre as [[number, number], ...[number, number][]];
    const mostrades = resta.slice(0, 3).map(([i, n]) => `${nomLl(i)} a ${n}`);
    const altres = resta.slice(3).reduce((s, [, n]) => s + n, 0);
    if (altres > 0) mostrades.push(`altres llistes a ${altres}`);
    const llista = mostrades.length > 1 ? `${mostrades.slice(0, -1).join(", ")} i ${mostrades.at(-1)}` : mostrades[0]!;
    sortida.push(`A les ${e.etiqueta.toLowerCase()}, ${nomLl(primer[0])} va guanyar a ${enter(primer[1])} de les ${enter(codis.length)} seccions; ${llista}.`);
  }
  const parts = codis.map((c) => ({ c, p: participacio(e.files[c]!) })).filter((x): x is { c: string; p: number } => x.p !== null);
  if (parts.length >= 2) {
    parts.sort((a, b) => a.p - b.p);
    const baix = parts[0]!, alt = parts.at(-1)!;
    sortida.push(
      `La participació va del <strong>${pct(baix.p)}</strong> (${nomSeccio(baix.c).toLowerCase()}) al <strong>${pct(alt.p)}</strong>` +
        ` (${nomSeccio(alt.c).toLowerCase()}): ${enter(alt.p - baix.p)} punts de diferència dins del mateix municipi.`,
    );
  }
  const rq = rendaQuarts(m, e);
  if (rq) {
    sortida.push(
      `Al quart de seccions amb més renda hi va votar el <strong>${pct(rq.rics)}</strong> del cens; al quart amb menys renda, el <strong>${pct(rq.pobres)}</strong>.`,
    );
  }
  return sortida;
}

/** Participació del quart de seccions amb més renda i del quart amb menys, sumant vots i cens. */
export function rendaQuarts(m: VotSeccionsMetric, e: EleccioSeccions): { rics: number; pobres: number; n: number } | null {
  if (!m.renda) return null;
  const amb = m.seccions.map((s) => s.codi).filter((c) => e.files[c] && m.renda!.valors[c] !== undefined && e.files[c]![0]! > 0);
  if (amb.length < 8) return null;
  amb.sort((a, b) => m.renda!.valors[a]! - m.renda!.valors[b]!);
  const n = Math.floor(amb.length / 4);
  const suma = (cs: string[]): number => {
    const v = cs.reduce((s, c) => s + e.files[c]![1]!, 0);
    const cens = cs.reduce((s, c) => s + e.files[c]![0]!, 0);
    return (100 * v) / cens;
  };
  return { pobres: suma(amb.slice(0, n)), rics: suma(amb.slice(-n)), n };
}

// ─────────────────────────────────────────────────────────────────────────────
// El que es pinta sense JavaScript
// ─────────────────────────────────────────────────────────────────────────────

/** Opacitat del guanyador segons el marge sobre el segon, en punts. */
export function opacitatMarge(fila: readonly number[]): number {
  const vots = fila.slice(4).slice().sort((a, b) => b - a);
  const total = vots.reduce((s, v) => s + v, 0);
  if (!total) return 1;
  const marge = (100 * ((vots[0] ?? 0) - (vots[1] ?? 0))) / total;
  return marge < 5 ? 0.45 : marge < 15 ? 0.72 : 1;
}

function mapaInicial(m: VotSeccionsMetric, e: EleccioSeccions, titol: string): string {
  const paths = m.seccions.map((s, i) => {
    const fila = e.files[s.codi];
    const g = fila ? guanyador(fila) : -1;
    const fill = g >= 0 ? e.llistes[g]!.color : g === -2 ? "var(--ink-suau)" : "var(--vs-buit)";
    const op = g >= 0 && fila ? opacitatMarge(fila) : 1;
    return `<path data-i="${i}" d="${s.d}" style="fill:${fill};fill-opacity:${op}"/>`;
  });
  return `<svg class="vs-mapa" viewBox="0 0 ${m.amplada} ${m.alcada}" role="img" aria-label="${escape(titol)}" preserveAspectRatio="xMidYMid meet">
<g class="vs-seccions">${paths.join("")}</g><path class="vs-sel" d=""/></svg>`;
}

function llegendaGuanyador(m: VotSeccionsMetric, e: EleccioSeccions): string {
  const comptes = new Map<number, number>();
  for (const s of m.seccions) {
    const f = e.files[s.codi];
    if (!f) continue;
    const g = guanyador(f);
    comptes.set(g, (comptes.get(g) ?? 0) + 1);
  }
  const items = [...comptes]
    .filter(([g]) => g >= 0)
    .sort((a, b) => b[1] - a[1])
    .map(([g, n]) => `<li><span class="mostra" style="--c:${e.llistes[g]!.color}"></span>${escape(e.llistes[g]!.sigles)} <b>${n}</b></li>`);
  if (comptes.get(-2)) items.push(`<li><span class="mostra vs-empat"></span>Empat <b>${comptes.get(-2)}</b></li>`);
  const buides = m.seccions.filter((s) => !e.files[s.codi]).length;
  if (buides) items.push(`<li><span class="mostra vs-buit"></span>Sense dada <b>${buides}</b></li>`);
  return `<ul class="vs-claus">${items.join("")}</ul>
<p class="vs-marge"><span class="vs-graons" aria-hidden="true"><i style="opacity:.45"></i><i style="opacity:.72"></i><i></i></span> Més intens, més ample el marge sobre la segona llista (menys de 5 punts, de 5 a 15, més de 15).</p>`;
}

/** La taula equivalent: per secció fins a 250, per districte a partir d'aquí. */
export function taulaEquivalent(m: VotSeccionsMetric, e: EleccioSeccions): string {
  const perSeccio = m.seccions.length <= 250;
  const grups = new Map<string, { nom: string; fila: number[]; renda: number[] }>();
  for (const s of m.seccions) {
    const f = e.files[s.codi];
    if (!f) continue;
    const clau = perSeccio ? s.codi : s.codi.slice(5, 7);
    const nom = perSeccio ? nomSeccio(s.codi) : `Districte ${Number(clau)}`;
    const g = grups.get(clau) ?? { nom, fila: f.map(() => 0), renda: [] };
    f.forEach((v, i) => (g.fila[i]! += v));
    const r = m.renda?.valors[s.codi];
    if (r !== undefined) g.renda.push(r);
    grups.set(clau, g);
  }
  const ambRenda = !!m.renda;
  const files = [...grups.values()].map(({ nom, fila, renda }) => {
    const g = guanyador(fila);
    const total = votsCandidatures(fila);
    const p = participacio(fila);
    const qui = g >= 0 ? `<span class="mostra" style="--c:${e.llistes[g]!.color}"></span>${escape(e.llistes[g]!.sigles)} ${pct((100 * fila[4 + g]!) / total)}` : g === -2 ? "Empat" : "—";
    const r = renda.length ? euros(renda.reduce((a, b) => a + b, 0) / renda.length) : "—";
    return `<tr><th scope="row">${escape(nom)}</th><td>${enter(fila[0]!)}</td><td>${p === null ? "—" : pct(p)}</td><td class="vs-qui">${qui}</td>${ambRenda ? `<td>${r}</td>` : ""}</tr>`;
  });
  return `<details class="vs-detall"><summary>${perSeccio ? "Les xifres de cada secció" : "Les xifres de cada districte"}</summary>
<div class="taula-envolta"><table class="balanc vs-taula"><thead><tr><th scope="col">${perSeccio ? "Secció" : "Districte"}</th><th scope="col">Cens</th><th scope="col">Participació</th><th scope="col">Més votada</th>${ambRenda ? `<th scope="col">Renda per persona${perSeccio ? "" : " (mitjana de seccions)"}</th>` : ""}</tr></thead>
<tbody>${files.join("")}</tbody></table></div>
<p class="nota">${escape(e.etiqueta)}. Percentatges sobre els vots a candidatures, sense blancs ni nuls; participació sobre el cens.</p></details>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Les dades que llegeix el navegador
// ─────────────────────────────────────────────────────────────────────────────

/** El JSON compacte del bloc: tot alineat amb l'ordre de les seccions del mapa. */
export function dadesNavegador(m: VotSeccionsMetric): string {
  const codis = m.seccions.map((s) => s.codi);
  const dades = {
    c: codis,
    e: m.eleccions.map((e) => ({
      id: e.id,
      et: e.etiqueta,
      ll: e.llistes.map((l) => [l.sigles, l.color]),
      f: codis.map((c) => e.files[c] ?? null),
    })),
    r: m.renda ? codis.map((c) => m.renda!.valors[c] ?? null) : null,
    ra: m.renda?.any ?? null,
  };
  // `</` no pot sortir mai dins d'un <script>.
  return JSON.stringify(dades).replace(/</g, "\\u003c");
}

// ─────────────────────────────────────────────────────────────────────────────
// El bloc
// ─────────────────────────────────────────────────────────────────────────────

export function renderVotSeccionsBloc(m: VotSeccionsMetric | null, opcions: { nom: string }): string {
  if (!m || m.seccions.length < 2 || m.eleccions.length === 0) return "";
  const e = m.eleccions[0]!;
  const titolMapa = `Mapa de les ${m.seccions.length} seccions censals de ${opcions.nom}, pintades per la llista més votada a les ${e.etiqueta.toLowerCase()}.`;
  const botonsEleccio = m.eleccions
    .map((x, i) => `<button type="button" role="radio" aria-checked="${i === 0}" data-e="${i}">${escape(x.etiqueta)}</button>`)
    .join("");
  const fr = frases(m, e).map((f) => `<li>${f}</li>`).join("");
  const xamfra = m.xamfra
    ? `<a class="vs-xamfra" href="${URL_XAMFRA}/municipis/${escape(m.xamfra)}.html" rel="noopener">
<span class="vs-xamfra-cub" aria-hidden="true"></span><span><b>Mira aquest vot en 3D a Xamfrà</b><br><span class="vs-xamfra-sub">El visor urbà de l'àrea metropolitana: el mateix mapa sobre els edificis, amb renda, edat i serveis de cada barri.</span></span></a>`
    : "";
  return `<p class="entrada-bloc">Cada municipi vota diferent d'un carrer a l'altre. Aquí hi ha les ${enter(m.seccions.length)} seccions censals de ${escape(opcions.nom)}, els trossos més petits on es compten els vots, de 600 a 2.500 electors cadascun.</p>
<ul class="vs-frases" data-vs-frases>${fr}</ul>
<div class="vs" data-vs>
  <div class="vs-controls">
    <div class="vs-segment" role="radiogroup" aria-label="Elecció">${botonsEleccio}</div>
    <div class="vs-modes" role="radiogroup" aria-label="Què es pinta al mapa" data-vs-modes></div>
  </div>
  <div class="vs-cos">
    <div class="vs-mapa-envolta">${mapaInicial(m, e, titolMapa)}</div>
    <aside class="vs-fitxa" aria-live="polite" data-vs-fitxa><p class="vs-fitxa-titol">${escape(opcions.nom)} sencer</p><p class="nota">Toca una secció del mapa per veure-la.</p></aside>
  </div>
  <div class="vs-llegenda" data-vs-llegenda>${llegendaGuanyador(m, e)}</div>
  ${m.renda ? `<figure class="vs-punts" data-vs-punts hidden><figcaption class="vs-punts-titol" data-vs-punts-titol></figcaption><svg viewBox="0 0 640 300" role="img" data-vs-punts-svg></svg></figure>` : ""}
  <div data-vs-taula>${taulaEquivalent(m, e)}</div>
  ${xamfra}
  <p class="peu-nota vs-fonts">Fonts: vots i participació per secció, <a href="${URL_VOTS_SECCIO}" rel="noopener nofollow">Generalitat de Catalunya</a> (<a href="${URL_PARTICIPACIO_SECCIO}" rel="noopener nofollow">participació</a>); seccions censals de l'<a href="${URL_FITXA_ICGC_SECCIONS}" rel="noopener nofollow">ICGC</a> (CC BY 4.0)${m.renda ? `; renda neta per persona ${m.renda.any}, <a href="${escape(m.renda.url)}" rel="noopener nofollow">INE (ADRH)</a>: elaboració pròpia amb dades extretes del web de l'INE` : ""}. Mètode compartit amb <a href="${URL_XAMFRA}" rel="noopener">Xamfrà</a>. Les seccions es dibuixen amb els límits del 2025; una secció sense dada és un buit, no un zero.</p>
</div>
<script type="application/json" class="vs-dades">${dadesNavegador(m)}</script>
${VOT_SECCIONS_JS}`;
}

/**
 * El comportament: canviar d'elecció i de mode, la fitxa de la secció, el
 * gràfic de punts i la taula. Una sola funció per bloc, sense dependències;
 * es pot carregar dues vegades sense efectes (marca `data-vs-viu`).
 */
export const VOT_SECCIONS_JS = `<script>
(function () {
  var NS = "http://www.w3.org/2000/svg";
  function fmt(n, d) { return n.toLocaleString("ca-ES", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  function pc(n) { return fmt(n, 1) + "\\u00a0%"; }
  function nom(c) { return "Districte " + Number(c.slice(5, 7)) + ", secció " + Number(c.slice(7)); }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (x) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[x]; }); }
  function cand(f) { var s = 0; for (var i = 4; i < f.length; i++) s += f[i]; return s; }
  function guany(f) { var m = -1, x = 0, emp = false; for (var i = 4; i < f.length; i++) { if (f[i] > x) { x = f[i]; m = i - 4; emp = false; } else if (f[i] === x && x > 0) emp = true; } return emp ? -2 : m; }
  function marge(f) { var v = f.slice(4).sort(function (a, b) { return b - a; }); var t = cand(f); if (!t) return 1; var m = 100 * ((v[0] || 0) - (v[1] || 0)) / t; return m < 5 ? .45 : m < 15 ? .72 : 1; }
  function talls(min, max, rodo) { var b = Math.floor(min / rodo) * rodo; var p = Math.max(rodo, Math.ceil((max - b) / 5 / rodo) * rodo); return [b, b + p, b + 2 * p, b + 3 * p, b + 4 * p, b + 5 * p]; }
  function graó(v, t) { for (var i = 1; i < t.length - 1; i++) if (v < t[i]) return i - 1; return 4; }
  var OPAC = [.14, .32, .52, .74, .96];

  function munta(arrel) {
    if (arrel.dataset.vsViu) return;
    arrel.dataset.vsViu = "1";
    var bloc = arrel.parentNode;
    var dades = JSON.parse(bloc.querySelector(".vs-dades").textContent);
    var paths = arrel.querySelectorAll(".vs-seccions path");
    var sel = arrel.querySelector(".vs-sel");
    var fitxa = arrel.querySelector("[data-vs-fitxa]");
    var modes = arrel.querySelector("[data-vs-modes]");
    var llegenda = arrel.querySelector("[data-vs-llegenda]");
    var punts = arrel.querySelector("[data-vs-punts]");
    var estat = { e: 0, mode: "guanya", fixat: -1 };
    var resumInicial = fitxa.innerHTML;

    function E() { return dades.e[estat.e]; }
    function valor(i) {
      var f = E().f[i]; if (!f) return null;
      if (estat.mode === "part") return f[0] > 0 ? 100 * f[1] / f[0] : null;
      if (estat.mode === "renda") return dades.r ? dades.r[i] : null;
      var t = cand(f); return t ? 100 * f[4 + estat.mode] / t : null;
    }
    function escala() {
      var vs = []; for (var i = 0; i < paths.length; i++) { var v = valor(i); if (v !== null) vs.push(v); }
      if (!vs.length) return null;
      var min = Math.min.apply(null, vs), max = Math.max.apply(null, vs);
      if (estat.mode === "renda") return talls(min, max, 1000);
      if (estat.mode === "part") return talls(min, max, 5);
      return talls(0, max, 5);
    }
    function colorMode() {
      if (estat.mode === "part") return "var(--vs-part)";
      if (estat.mode === "renda") return "var(--vs-renda)";
      return E().ll[estat.mode][1];
    }

    function pinta() {
      var e = E(), t = estat.mode === "guanya" ? null : escala(), c = estat.mode === "guanya" ? null : colorMode();
      for (var i = 0; i < paths.length; i++) {
        var f = e.f[i], p = paths[i];
        if (!f) { p.style.fill = "var(--vs-buit)"; p.style.fillOpacity = 1; continue; }
        if (estat.mode === "guanya") {
          var g = guany(f);
          p.style.fill = g >= 0 ? e.ll[g][1] : g === -2 ? "var(--ink-suau)" : "var(--vs-buit)";
          p.style.fillOpacity = g >= 0 ? marge(f) : 1;
        } else {
          var v = valor(i);
          p.style.fill = v === null ? "var(--vs-buit)" : c;
          p.style.fillOpacity = v === null ? 1 : OPAC[graó(v, t)];
        }
      }
      pintaLlegenda(t, c);
      pintaPunts();
      if (estat.fixat >= 0) mostra(estat.fixat); else fitxa.innerHTML = resumMunicipi();
    }

    function pintaLlegenda(t, c) {
      var e = E();
      if (estat.mode === "guanya") {
        var n = {}; for (var i = 0; i < e.f.length; i++) if (e.f[i]) { var g = guany(e.f[i]); n[g] = (n[g] || 0) + 1; }
        var ks = Object.keys(n).map(Number).filter(function (k) { return k >= 0; }).sort(function (a, b) { return n[b] - n[a]; });
        var h = ks.map(function (k) { return '<li><span class="mostra" style="--c:' + e.ll[k][1] + '"></span>' + esc(e.ll[k][0]) + " <b>" + n[k] + "</b></li>"; }).join("");
        if (n[-2]) h += '<li><span class="mostra vs-empat"></span>Empat <b>' + n[-2] + "</b></li>";
        var buides = 0; for (var q = 0; q < e.f.length; q++) if (!e.f[q]) buides++;
        if (buides) h += '<li><span class="mostra vs-buit"></span>Sense dada <b>' + buides + "</b></li>";
        llegenda.innerHTML = '<ul class="vs-claus">' + h + '</ul><p class="vs-marge"><span class="vs-graons" aria-hidden="true"><i style="opacity:.45"></i><i style="opacity:.72"></i><i></i></span> Més intens, més ample el marge sobre la segona llista (menys de 5 punts, de 5 a 15, més de 15).</p>';
        return;
      }
      if (!t) { llegenda.innerHTML = ""; return; }
      var unitat = estat.mode === "renda" ? function (v) { return fmt(v) + "\\u00a0€"; } : function (v) { return fmt(v) + "\\u00a0%"; };
      var cap = estat.mode === "part" ? "Participació, sobre el cens" : estat.mode === "renda" ? "Renda neta per persona, " + dades.ra : esc(e.ll[estat.mode][0]) + ", sobre els vots a candidatures";
      var gr = OPAC.map(function (o, i) { return '<li><i style="background:' + c + ";opacity:" + o + '"></i><span>' + unitat(t[i]) + "–" + unitat(t[i + 1]) + "</span></li>"; }).join("");
      llegenda.innerHTML = '<p class="vs-escala-titol">' + cap + '</p><ol class="vs-escala">' + gr + "</ol>";
    }

    function barres(f, e) {
      var t = cand(f), files = [];
      for (var k = 0; k < e.ll.length; k++) files.push({ k: k, v: f[4 + k] });
      files.sort(function (a, b) { return b.v - a.v; });
      return '<ol class="vs-barres">' + files.map(function (x) {
        var p = t ? 100 * x.v / t : 0;
        return '<li><span class="vs-b-nom"><span class="mostra" style="--c:' + e.ll[x.k][1] + '"></span>' + esc(e.ll[x.k][0]) + '</span><span class="vs-b-pct">' + pc(p) + '</span><span class="vs-b-pista" aria-hidden="true"><i style="--c:' + e.ll[x.k][1] + ";transform:scaleX(" + (p / 100).toFixed(3) + ')"></i></span></li>';
      }).join("") + "</ol>";
    }

    function resumMunicipi() {
      var e = E(), tot = null;
      for (var i = 0; i < e.f.length; i++) { var f = e.f[i]; if (!f) continue; if (!tot) tot = f.map(function () { return 0; }); for (var j = 0; j < f.length; j++) tot[j] += f[j]; }
      if (!tot) return resumInicial;
      return '<p class="vs-fitxa-titol">Tot el municipi</p><p class="vs-fitxa-sub">' + esc(e.et) + " · participació " + pc(100 * tot[1] / tot[0]) + "</p>" + barres(tot, e) + '<p class="nota">Toca una secció del mapa per comparar-la.</p>';
    }

    function mostra(i) {
      var e = E(), f = e.f[i], c = dades.c[i];
      paths[i].parentNode.appendChild(paths[i]);
      sel.setAttribute("d", paths[i].getAttribute("d"));
      if (!f) { fitxa.innerHTML = '<p class="vs-fitxa-titol">' + nom(c) + '</p><p class="nota">Sense dada en aquesta elecció: és un buit, no un zero.</p>'; return; }
      var r = dades.r && dades.r[i] !== null ? '<p class="vs-fitxa-sub">Renda neta per persona (' + dades.ra + "): <b>" + fmt(dades.r[i]) + "\\u00a0€</b></p>" : "";
      fitxa.innerHTML = '<p class="vs-fitxa-titol">' + nom(c) + '</p><p class="vs-fitxa-sub">' + fmt(f[0]) + " electors · participació <b>" + pc(100 * f[1] / f[0]) + "</b></p>" + r + barres(f, e) +
        (estat.fixat === i ? '<button type="button" class="vs-tanca" data-vs-tanca>Torna al municipi</button>' : "");
      pintaPuntSel(i);
    }
    function amaga() { sel.setAttribute("d", ""); fitxa.innerHTML = resumMunicipi(); pintaPuntSel(-1); }

    function botonsModes() {
      var e = E(), h = '<button type="button" role="radio" data-m="guanya">Qui guanya</button><button type="button" role="radio" data-m="part">Participació</button>';
      if (dades.r) h += '<button type="button" role="radio" data-m="renda">Renda</button>';
      for (var k = 0; k < e.ll.length; k++) if (e.ll[k][0] !== "Altres") h += '<button type="button" role="radio" data-m="' + k + '"><span class="mostra" style="--c:' + e.ll[k][1] + '"></span>' + esc(e.ll[k][0]) + "</button>";
      modes.innerHTML = h;
      if (estat.mode !== "guanya" && estat.mode !== "part" && estat.mode !== "renda" && estat.mode >= e.ll.length) estat.mode = "guanya";
      marca();
    }
    function marca() {
      modes.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-checked", String(String(estat.mode) === b.dataset.m)); });
      arrel.querySelectorAll(".vs-segment button").forEach(function (b) { b.setAttribute("aria-checked", String(Number(b.dataset.e) === estat.e)); });
    }

    // ---- El gràfic de punts: renda (x) contra el que es pinta (y)
    var puntsSvg = punts ? punts.querySelector("[data-vs-punts-svg]") : null;
    var cercles = [];
    function pintaPunts() {
      if (!punts) return;
      var e = E(), modeY = estat.mode === "guanya" || estat.mode === "renda" ? "part" : estat.mode;
      var xs = [], ys = [], is = [];
      for (var i = 0; i < dades.c.length; i++) {
        var f = e.f[i], r = dades.r[i]; if (!f || r === null || f[0] <= 0) continue;
        var y = modeY === "part" ? 100 * f[1] / f[0] : (cand(f) ? 100 * f[4 + modeY] / cand(f) : null);
        if (y === null) continue;
        xs.push(r); ys.push(y); is.push(i);
      }
      if (xs.length < 8) { punts.hidden = true; return; }
      punts.hidden = false;
      var W = Math.max(300, Math.round(puntsSvg.getBoundingClientRect().width) || 640), H = W < 520 ? 240 : 300, L = 44, R = 24, T = 12, B = 30, estret = W < 520;
      puntsSvg.setAttribute("viewBox", "0 0 " + W + " " + H);
      var tx = talls(Math.min.apply(null, xs), Math.max.apply(null, xs), 2000), ty = talls(modeY === "part" ? Math.min.apply(null, ys) : 0, Math.max.apply(null, ys), 5);
      function X(v) { return L + (W - L - R) * (v - tx[0]) / (tx[5] - tx[0]); }
      function Y(v) { return H - B - (H - B - T) * (v - ty[0]) / (ty[5] - ty[0]); }
      var h = "";
      for (var k = 0; k <= 5; k++) {
        h += '<line class="vs-eix" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(ty[k]) + '" y2="' + Y(ty[k]) + '"/><text class="vs-eix-t" x="' + (L - 6) + '" y="' + (Y(ty[k]) + 4) + '" text-anchor="end">' + fmt(ty[k]) + "\\u00a0%</text>";
        if (!estret || k % 2 === 0) h += '<text class="vs-eix-t" x="' + X(tx[k]) + '" y="' + (H - B + 18) + '" text-anchor="middle">' + fmt(tx[k] / 1000) + "k\\u00a0€</text>";
      }
      var color = modeY === "part" ? null : e.ll[modeY][1];
      for (var j = 0; j < xs.length; j++) {
        var g = guany(e.f[is[j]]);
        var c = color || (g >= 0 ? e.ll[g][1] : "var(--ink-suau)");
        h += '<circle data-i="' + is[j] + '" cx="' + X(xs[j]).toFixed(1) + '" cy="' + Y(ys[j]).toFixed(1) + '" r="' + (dades.c.length > 400 ? 2.6 : 4.2) + '" style="fill:' + c + '"/>';
      }
      h += '<circle class="vs-punt-sel" r="7" cx="-20" cy="-20"/>';
      puntsSvg.innerHTML = h;
      cercles = puntsSvg.querySelectorAll("circle[data-i]");
      punts.querySelector("[data-vs-punts-titol]").innerHTML = "Cada punt és una secció: renda neta per persona (" + dades.ra + ") i " +
        (modeY === "part" ? "participació" : "vot a " + esc(e.ll[modeY][0])) + " a les " + esc(e.et.toLowerCase()) + ".";
      puntsSvg.setAttribute("aria-label", "Gràfic de punts de les " + xs.length + " seccions amb renda coneguda. La taula de sota té les mateixes xifres.");
    }
    function pintaPuntSel(i) {
      if (!puntsSvg) return;
      var s = puntsSvg.querySelector(".vs-punt-sel"); if (!s) return;
      var c = puntsSvg.querySelector('circle[data-i="' + i + '"]');
      if (c) { s.setAttribute("cx", c.getAttribute("cx")); s.setAttribute("cy", c.getAttribute("cy")); } else { s.setAttribute("cx", -20); s.setAttribute("cy", -20); }
    }

    // ---- Esdeveniments
    var g = arrel.querySelector(".vs-seccions");
    function idx(ev) { var t = ev.target; return t && t.dataset && t.dataset.i !== undefined ? Number(t.dataset.i) : -1; }
    g.addEventListener("pointermove", function (ev) { if (estat.fixat < 0 && ev.pointerType === "mouse") { var i = idx(ev); if (i >= 0) mostra(i); } });
    g.addEventListener("pointerleave", function () { if (estat.fixat < 0) amaga(); });
    g.addEventListener("click", function (ev) { var i = idx(ev); if (i < 0) return; estat.fixat = estat.fixat === i ? -1 : i; if (estat.fixat < 0) amaga(); else mostra(i); });
    if (puntsSvg) {
      puntsSvg.addEventListener("pointermove", function (ev) { if (estat.fixat < 0 && ev.pointerType === "mouse") { var i = idx(ev); if (i >= 0) mostra(i); } });
      puntsSvg.addEventListener("pointerleave", function () { if (estat.fixat < 0) amaga(); });
      puntsSvg.addEventListener("click", function (ev) { var i = idx(ev); if (i < 0) return; estat.fixat = i; mostra(i); });
    }
    fitxa.addEventListener("click", function (ev) { if (ev.target.closest("[data-vs-tanca]")) { estat.fixat = -1; amaga(); } });
    document.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && estat.fixat >= 0) { estat.fixat = -1; amaga(); } });
    modes.addEventListener("click", function (ev) { var b = ev.target.closest("button"); if (!b) return; var m = b.dataset.m; estat.mode = isNaN(Number(m)) ? m : Number(m); marca(); pinta(); });
    arrel.querySelector(".vs-segment").addEventListener("click", function (ev) {
      var b = ev.target.closest("button"); if (!b) return;
      var abans = estat.mode !== "guanya" && estat.mode !== "part" && estat.mode !== "renda" ? E().ll[estat.mode][0] : null;
      estat.e = Number(b.dataset.e);
      botonsModes();
      if (abans !== null) { var k = E().ll.map(function (l) { return l[0]; }).indexOf(abans); estat.mode = k >= 0 ? k : "guanya"; marca(); }
      pinta();
    });
    botonsModes();
    pinta();
    var amplePunts = puntsSvg ? puntsSvg.getBoundingClientRect().width : 0;
    if (window.ResizeObserver && puntsSvg) new ResizeObserver(function () {
      var w = puntsSvg.getBoundingClientRect().width;
      if (Math.abs(w - amplePunts) > 24) { amplePunts = w; pintaPunts(); if (estat.fixat >= 0) pintaPuntSel(estat.fixat); }
    }).observe(punts);
  }
  document.querySelectorAll("[data-vs]").forEach(munta);
})();
</script>`;

/** L'estil del bloc, amb el prefix `vs-`. Els colors de dades no fan cap transició. */
export const VOT_SECCIONS_CSS = `
.vs{--vs-buit:#DDD8CE;--vs-part:#5B4FC4;--vs-renda:#2E8B6A;margin-top:var(--e2)}
.vs-frases{list-style:none;padding:0;margin:var(--e2) 0 0;display:grid;gap:6px}
.vs-frases li{padding-left:18px;position:relative}
.vs-frases li::before{content:"";position:absolute;left:2px;top:.55em;width:8px;height:8px;border-radius:50%;background:var(--coral)}
.vs-controls{display:flex;flex-direction:column;gap:8px;margin-bottom:var(--e1)}
.vs-segment{display:inline-flex;align-self:flex-start;border:1.5px solid var(--ink);border-radius:var(--r-max);overflow:hidden;background:var(--paper-2)}
.vs-segment button{font:inherit;font-weight:800;font-family:var(--display);border:0;background:none;color:var(--ink);padding:6px 14px;cursor:pointer;transition:background var(--t-rapid,120ms) var(--corba-seca,ease)}
.vs-segment button[aria-checked=true]{background:var(--ink);color:var(--paper)}
.vs-modes{display:flex;flex-wrap:wrap;gap:6px}
.vs-modes button{font:inherit;font-size:.85rem;display:inline-flex;align-items:center;gap:6px;border:1.5px solid var(--vora);background:var(--paper-2);color:var(--ink);border-radius:var(--r-max);padding:4px 11px;cursor:pointer;transition:border-color var(--t-rapid,120ms) var(--corba-seca,ease),transform var(--t-rapid,120ms) var(--corba-seca,ease)}
.vs-modes button:hover{border-color:var(--ink)}
.vs-modes button:active{transform:translateY(1px)}
.vs-modes button[aria-checked=true]{border-color:var(--ink);box-shadow:2px 2px 0 var(--ink);font-weight:700}
.vs-cos{display:grid;gap:var(--e1);grid-template-columns:1fr}
@media (min-width:760px){.vs-cos{grid-template-columns:minmax(0,1fr) 15.5rem;align-items:start}}
.vs-mapa-envolta{border:1.5px solid var(--ink);border-radius:var(--r-m);background:var(--paper-2);box-shadow:var(--ombra);padding:8px;overflow:hidden}
.vs-mapa{display:block;width:100%;height:auto;max-height:70vh}
.vs-seccions path{stroke:var(--paper-2);stroke-width:.8;vector-effect:non-scaling-stroke;stroke-linejoin:round;cursor:pointer}
.vs-seccions path:hover{stroke:var(--ink);stroke-width:1.5}
.vs-sel{fill:none;stroke:var(--ink);stroke-width:2.5;vector-effect:non-scaling-stroke;stroke-linejoin:round;pointer-events:none}
.vs-fitxa{border:1.5px solid var(--vora);border-radius:var(--r-m);background:var(--paper);padding:12px 14px;min-height:8rem}
.vs-fitxa-titol{font-family:var(--display);font-weight:800;margin:0}
.vs-fitxa-sub{font-size:.88rem;color:var(--ink-suau);margin:2px 0 0}
.vs-fitxa .nota{margin-top:8px}
.vs-barres{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:5px}
.vs-barres li{display:grid;grid-template-columns:1fr auto;gap:1px 8px;align-items:center;font-size:.86rem}
.vs-b-nom{display:flex;gap:6px;align-items:center;min-width:0;overflow-wrap:anywhere}
.vs-b-pct{font-variant-numeric:tabular-nums;font-weight:700}
.vs-b-pista{grid-column:1/-1;height:5px;background:var(--vora);border-radius:var(--r-max);overflow:hidden}
.vs-b-pista i{display:block;height:100%;width:100%;background:var(--c);transform-origin:left}
.vs-tanca{margin-top:10px;font:inherit;font-size:.82rem;border:1.5px solid var(--ink);border-radius:var(--r-max);background:var(--paper-2);color:var(--ink);padding:3px 10px;cursor:pointer}
.vs-llegenda{margin-top:var(--e1)}
.vs-claus{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px 14px;font-size:.88rem}
.vs-claus li{display:inline-flex;align-items:center;gap:6px}
.vs-claus b{font-variant-numeric:tabular-nums}
.vs-empat{background:var(--ink-suau)!important}
.vs-buit{background:var(--vs-buit)!important}
@media (prefers-color-scheme:dark){.vs{--vs-buit:#3A3546}}
.vs-marge{font-size:.8rem;color:var(--ink-suau);margin:6px 0 0;display:flex;gap:8px;align-items:center}
.vs-graons{display:inline-flex;gap:2px}
.vs-graons i{display:block;width:14px;height:10px;border-radius:3px;background:var(--ink)}
.vs-escala-titol{font-size:.85rem;font-weight:700;margin:0 0 4px}
.vs-escala{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:3px;max-width:34rem}
.vs-escala li{display:grid;gap:3px;font-size:.72rem;color:var(--ink-suau);font-variant-numeric:tabular-nums}
.vs-escala i{display:block;height:12px;border-radius:3px}
.vs-punts{margin:var(--e2) 0 0;border:1.5px solid var(--vora);border-radius:var(--r-m);padding:10px 12px;background:var(--paper)}
.vs-punts-titol{font-size:.88rem;font-weight:700;margin:0 0 6px}
.vs-punts svg{display:block;width:100%;height:auto}
.vs-punts circle[data-i]{fill-opacity:.85;stroke:var(--paper);stroke-width:.8;cursor:pointer}
.vs-punt-sel{fill:none;stroke:var(--ink);stroke-width:2;pointer-events:none}
.vs-eix{stroke:var(--vora);stroke-width:1}
.vs-eix-t{font-size:11px;fill:var(--ink-suau);font-family:var(--text)}
.vs-detall{margin:var(--e2) 0 0}
.vs-detall summary{cursor:pointer;font-weight:700}
.vs-taula td{font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}
.vs-taula td.vs-qui{text-align:left}
.vs-taula th[scope=row]{text-align:left;white-space:nowrap}
.vs-taula .mostra{display:inline-block;vertical-align:-2px;margin-right:6px}
.vs-xamfra{display:flex;gap:12px;align-items:center;margin-top:var(--e2);padding:12px 14px;border:1.5px solid var(--ink);border-radius:var(--r-m);background:var(--menta);color:#1E1B2E;text-decoration:none;box-shadow:var(--ombra);transition:transform var(--t-rapid,120ms) var(--corba-seca,ease),box-shadow var(--t-rapid,120ms) var(--corba-seca,ease)}
.vs-xamfra:hover{transform:translate(-1px,-1px);box-shadow:4px 4px 0 var(--ink)}
.vs-xamfra:active{transform:translate(2px,2px);box-shadow:1px 1px 0 var(--ink)}
.vs-xamfra-sub{font-size:.85rem}
.vs-xamfra-cub{flex:none;width:34px;height:34px;background:linear-gradient(135deg,#1E1B2E 0 33%,#5B9A8B 33% 66%,#FBF7EE 66%);clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)}
.vs-fonts{max-width:none!important;margin-top:var(--e1)}
@media (prefers-reduced-motion:reduce){.vs *{transition:none!important}}
`;
