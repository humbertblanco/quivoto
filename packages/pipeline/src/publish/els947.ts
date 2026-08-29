import { eq } from "drizzle-orm";
import { municipalities, municipalityMetrics, type Db } from "@quivoto/db";

/**
 * «Els 947» — l'índex de tots els municipis de Catalunya amb el que en sabem.
 *
 * És un guinyo a els947.cat, el repte de geografia catalana, i alhora la manera
 * més honesta d'ensenyar què hem construït: no una demostració amb tres pobles
 * triats, sinó els 947 alhora, amb la dada que hi tenim i el forat on no n'hi ha.
 *
 * Tot el conjunt va incrustat a la pàgina i el filtre és al navegador: són poques
 * dades i així funciona sense servidor, sense peticions i sense saber qui mira què.
 */

export type Els947Row = {
  /** slug, nom, comarca, població, regidories */
  s: string; n: string; c: string; p: number; r: number;
  /** alcaldia i sigles */
  a: string | null; g: string | null;
  /** governa el més votat: 1 sí, 0 no, null desconegut */
  w: 0 | 1 | null;
  /** majoria absoluta d'una sola llista */
  m: 0 | 1;
  /** canvi d'alcaldia a mig mandat */
  k: 0 | 1;
  /** actes indexades */
  t: number;
  /** deute per habitant, en euros */
  d: number | null;
  /** estalvi net en percentatge */
  e: number | null;
  /** dones al ple, en percentatge */
  f: number | null;
  /** canvis de la força més votada des del 1979, i quantes eleccions */
  v: number | null; q: number | null;
  /** compliment del portal de transparència, en percentatge */
  y: number | null;
  /** ple amb una sola candidatura */
  o: 0 | 1;
};

export async function loadEls947(db: Db): Promise<Els947Row[]> {
  const all = await db.select().from(municipalities);
  const metrics = await db.select().from(municipalityMetrics);
  const byMunicipality = new Map<number, Map<string, unknown>>();
  for (const metric of metrics) {
    let map = byMunicipality.get(metric.municipalityId);
    if (!map) byMunicipality.set(metric.municipalityId, (map = new Map()));
    map.set(metric.kind, metric.data);
  }

  return all
    .map((m): Els947Row => {
      const own = byMunicipality.get(m.id);
      const government = own?.get("government") as
        | { winnerGoverns: boolean | null; winnerHasMajority: boolean; mayorSigles: string | null }
        | undefined;
      const mayors = own?.get("mayors") as { currentTermChange: unknown } | undefined;
      const parity = own?.get("parity") as { womenElectedPct: number | null } | undefined;
      const history = own?.get("electoralHistory") as { alternances: number; elections: number } | undefined;
      const transparency = own?.get("transparency") as { pct: number | null } | undefined;
      const finances = own?.get("finances") as
        | { indicators: { key: string; value: number | null }[] }
        | undefined;
      const indicator = (key: string): number | null =>
        finances?.indicators.find((i) => i.key === key)?.value ?? null;

      return {
        s: m.slug,
        n: m.name,
        c: m.comarca ?? "",
        p: m.population ?? 0,
        r: government ? (government as unknown as { totalSeats: number }).totalSeats : (m.councilSeats ?? 0),
        a: m.mayorName,
        g: government?.mayorSigles ?? m.mayorPartyRaw ?? null,
        w: government?.winnerGoverns === null || government === undefined ? null : government.winnerGoverns ? 1 : 0,
        m: government?.winnerHasMajority ? 1 : 0,
        k: mayors?.currentTermChange ? 1 : 0,
        t: m.minutesCount ?? 0,
        d: indicator("deute-habitant"),
        e: indicator("estalvi-net"),
        f: parity?.womenElectedPct ?? null,
        v: history?.alternances ?? null,
        q: history?.elections ?? null,
        y: transparency?.pct ?? null,
        o: own?.has("singleList") ? 1 : 0,
      };
    })
    .sort((a, b) => b.p - a.p);
}

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function renderEls947(rows: readonly Els947Row[], generatedAt: string, withPage: ReadonlySet<string>): string {
  const totals = {
    municipis: rows.length,
    regidories: rows.reduce((a, r) => a + r.r, 0),
    governaMesVotat: rows.filter((r) => r.w === 1).length,
    pacte: rows.filter((r) => r.w === 0).length,
    majoria: rows.filter((r) => r.m === 1).length,
    canvis: rows.filter((r) => r.k === 1).length,
    sempre: rows.filter((r) => r.v === 0 && (r.q ?? 0) >= 8).length,
    senseOposicio: rows.filter((r) => r.o === 1).length,
    senseActes: rows.filter((r) => r.t === 0).length,
    comarques: new Set(rows.map((r) => r.c)).size,
  };

  const data = JSON.stringify(rows.map((r) => ({ ...r, x: withPage.has(r.s) ? 1 : 0 })));

  return `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Els 947 · Observatori de quivoto</title>
<meta name="description" content="Tots els municipis de Catalunya, i el que en sabem: qui governa, si va guanyar, si ha canviat d'alcaldia, com estan els comptes i quantes actes del ple en tenim.">
<style>
:root{
  --paper:#FBF7EE;--paper-2:#FFFFFF;--ink:#1E1B2E;--ink-suau:#6B6680;
  --coral:#E2735A;--menta:#BFE8D2;--lavanda:#C9C4F2;--presec:#FFD8B8;
  --vora:rgba(30,27,46,.12);--r-s:10px;--r-m:18px;--r-max:999px;
  --e1:8px;--e2:16px;--e3:24px;--e4:40px;
  --display:"Gabarito",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  --text:"Nunito Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;
  --ombra:3px 3px 0 var(--ink);
}
@media (prefers-color-scheme:dark){:root{--paper:#17141F;--paper-2:#211D2C;--ink:#F4F0E6;--ink-suau:#A9A3B8;--vora:rgba(244,240,230,.16)}}
*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--text);font-size:16px;line-height:1.5;-webkit-font-smoothing:antialiased}
h1{font-family:var(--display);font-weight:900;letter-spacing:-.04em;line-height:.95;font-size:clamp(3rem,13vw,7rem);margin:0}
h2{font-family:var(--display);font-weight:900;letter-spacing:-.02em;font-size:1.2rem;margin:0 0 var(--e2)}
a{color:inherit}
:focus-visible{outline:3px solid var(--coral);outline-offset:2px;border-radius:4px}
.embolcall{max-width:1080px;margin:0 auto;padding:var(--e3)}
.capcalera{display:flex;justify-content:space-between;align-items:center;gap:var(--e2)}
.logo{font-family:var(--display);font-weight:900;letter-spacing:-.05em;font-size:1.25rem;text-decoration:none}
.etiqueta{background:var(--presec);color:#1E1B2E;border-radius:var(--r-max);padding:5px 12px;font-size:.66rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em}
.entradeta{font-size:1.1rem;color:var(--ink-suau);max-width:46ch;margin:var(--e2) 0 var(--e4)}
.entradeta b{color:var(--ink)}

.xifres{list-style:none;display:grid;gap:var(--e2);grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin:0 0 var(--e4);padding:0}
.xifres li{background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);box-shadow:var(--ombra);padding:var(--e2)}
.xifres b{display:block;font-family:var(--display);font-weight:900;font-size:2.1rem;line-height:1;letter-spacing:-.03em}
.xifres span{font-size:.82rem;color:var(--ink-suau)}

.controls{position:sticky;top:0;z-index:5;background:var(--paper);padding:var(--e2) 0;border-bottom:2.5px solid var(--ink);margin-bottom:var(--e2)}
#cerca{width:100%;font:inherit;font-size:1.15rem;padding:14px 16px;border:2.5px solid var(--ink);border-radius:var(--r-m);background:var(--paper-2);color:var(--ink);box-shadow:var(--ombra)}
.filtres{display:flex;gap:8px;flex-wrap:wrap;margin-top:var(--e2)}
.filtre{font:inherit;font-size:.82rem;font-weight:800;padding:7px 13px;border:2px solid var(--ink);border-radius:var(--r-max);background:transparent;color:inherit;cursor:pointer}
.filtre[aria-pressed="true"]{background:var(--ink);color:var(--paper)}
.recompte{font-size:.86rem;color:var(--ink-suau);margin:var(--e2) 0 0}

.llista{list-style:none;margin:0;padding:0}
.fila{border-bottom:1px solid var(--vora);padding:var(--e2) 0;display:grid;grid-template-columns:1fr auto;gap:4px var(--e2);align-items:baseline}
.nom{font-family:var(--display);font-weight:900;font-size:1.15rem;letter-spacing:-.02em}
.nom a{text-decoration:none;border-bottom:2.5px solid var(--coral)}
.lloc{font-size:.82rem;color:var(--ink-suau)}
.dades{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.pastilla{font-size:.72rem;font-weight:700;border:1.5px solid var(--vora);border-radius:var(--r-max);padding:3px 10px;white-space:nowrap}
.pastilla.pacte{background:var(--presec);border-color:var(--ink);color:#1E1B2E}
.pastilla.canvi{background:var(--lavanda);border-color:var(--ink);color:#1E1B2E}
.pastilla.majoria{background:var(--menta);border-color:var(--ink);color:#1E1B2E}
.pastilla.sense{background:transparent;border-style:dashed;color:var(--ink-suau)}
.pastilla.sempre{background:var(--coral);border-color:var(--ink);color:#FBF7EE}
.pastilla.unica{background:var(--ink);border-color:var(--ink);color:var(--paper)}
.pob{font-variant-numeric:tabular-nums;font-weight:800;font-size:.9rem;white-space:nowrap}
.buit{padding:var(--e4) 0;color:var(--ink-suau)}
.peu{border-top:2.5px solid var(--ink);margin-top:var(--e3);padding-top:var(--e3);font-size:.84rem;color:var(--ink-suau)}

/* --- el guinyo: convidar a jugar-hi, no només citar-los --- */
.joc{background:var(--lavanda);color:#1E1B2E;border:2.5px solid #1E1B2E;border-radius:var(--r-m);
  box-shadow:6px 6px 0 #1E1B2E;padding:var(--e3);margin:var(--e4) 0 var(--e3);transform:rotate(-.6deg)}
.joc h2{font-size:1.7rem;margin-bottom:var(--e1)}
.joc p{margin:0 0 var(--e2);max-width:52ch}
.joc .boto{display:inline-block;background:#1E1B2E;color:#FBF7EE;text-decoration:none;font-weight:800;
  padding:12px 22px;border-radius:var(--r-max);box-shadow:3px 3px 0 rgba(30,27,46,.35);
  transition:transform .12s ease,box-shadow .12s ease}
.joc .boto:hover{transform:translate(2px,2px);box-shadow:1px 1px 0 rgba(30,27,46,.35)}
.joc .lletra-petita{font-size:.82rem;opacity:.72;margin:0}
@media (prefers-reduced-motion:reduce){.joc{transform:none}.joc .boto{transition:none}}
</style>
</head>
<body>
<div class="embolcall">

<header class="capcalera">
  <a class="logo" href="./">Observatori</a>
  <span class="etiqueta">esborrany · dades obertes</span>
</header>

<h1>Els 947</h1>
<p class="entradeta">Tots els municipis de Catalunya i el que en sabem: qui hi mana,
si va ser la llista més votada, si hi ha hagut canvi d'alcaldia a mig mandat, com estan
els comptes i quantes actes del ple en tenim indexades. <b>Sense cap excepció i sense cap
municipi triat a dit.</b> I si el que vols és posar a prova si te'ls saps tots,
<a href="https://els947.cat/" target="_blank" rel="noopener">hi ha un joc per a això</a>.</p>

<ul class="xifres">
  <li><b>${totals.municipis}</b><span>municipis, de ${totals.comarques} comarques</span></li>
  <li><b>${totals.regidories.toLocaleString("ca-ES")}</b><span>regidories el 2023</span></li>
  <li><b>${totals.pacte}</b><span>on governa una llista que no va guanyar</span></li>
  <li><b>${totals.canvis}</b><span>han canviat d'alcaldia a mig mandat</span></li>
  <li><b>${totals.majoria}</b><span>amb majoria absoluta d'una sola llista</span></li>
  <li><b>${totals.sempre}</b><span>on la mateixa força ha guanyat sempre des del 1979</span></li>
  <li><b>${totals.senseOposicio}</b><span>amb una sola candidatura al ple</span></li>
  <li><b>${totals.senseActes}</b><span>sense cap acta de ple publicada</span></li>
</ul>

<div class="controls">
  <label class="nomes-lectors" for="cerca">Cerca un municipi</label>
  <input id="cerca" type="search" placeholder="Escriu un poble: esplugues, la seu, hospitalet…" autocomplete="off" spellcheck="false">
  <div class="filtres" role="group" aria-label="Filtres">
    <button class="filtre" data-f="pacte" aria-pressed="false">Hi va haver pacte</button>
    <button class="filtre" data-f="canvi" aria-pressed="false">Canvi d'alcaldia</button>
    <button class="filtre" data-f="majoria" aria-pressed="false">Majoria absoluta</button>
    <button class="filtre" data-f="sempre" aria-pressed="false">Sempre els mateixos</button>
    <button class="filtre" data-f="unica" aria-pressed="false">Sense oposició</button>
    <button class="filtre" data-f="sense" aria-pressed="false">Sense actes</button>
    <button class="filtre" data-f="fitxa" aria-pressed="false">Amb radiografia</button>
  </div>
  <p class="recompte" id="recompte" aria-live="polite"></p>
</div>

<ul class="llista" id="llista"></ul>
<p class="buit" id="buit" hidden>Cap municipi coincideix. Prova amb menys lletres.</p>

<aside class="joc">
  <h2>I tu, te'ls saps?</h2>
  <p>Nosaltres tenim les dades dels 947. Saber-ne els noms i on són ja és una altra cosa.
  Hi ha un joc que ho posa a prova, i és boníssim:</p>
  <p><a class="boto" href="https://els947.cat/" target="_blank" rel="noopener">Ves a jugar a els947.cat →</a></p>
  <p class="lletra-petita">No hi tenim res a veure: és el repte de geografia catalana d'algú altre,
  i ens va recordar que 947 no és una xifra abstracta sinó 947 llocs amb gent que hi vota.</p>
</aside>

<footer class="peu">
  <p>Generat el ${escape(generatedAt)} amb dades obertes de la Generalitat de Catalunya i del
  Consorci AOC.</p>
  <p>Esborrany intern de quivoto, no indexat.</p>
</footer>
</div>

<script>
const DADES = ${data};
const norm = (s) => s.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase()
  .replace(/['\\u2019]/g, " ").replace(/^(l|el|la|els|les|es|sa)\\s+/, "").replace(/\\s+/g, " ").trim();
for (const row of DADES) row._k = norm(row.n) + " " + norm(row.c);

const llista = document.getElementById("llista");
const recompte = document.getElementById("recompte");
const buit = document.getElementById("buit");
const cerca = document.getElementById("cerca");
const filtres = new Set();

const eur = (n) => n.toLocaleString("ca-ES");

function pastilles(row){
  const out = [];
  if (row.w === 0) out.push('<span class="pastilla pacte">Governa qui no va guanyar</span>');
  if (row.k === 1) out.push('<span class="pastilla canvi">Canvi d\\'alcaldia</span>');
  if (row.m === 1) out.push('<span class="pastilla majoria">Majoria absoluta</span>');
  if (row.o === 1) out.push('<span class="pastilla unica">Una sola candidatura</span>');
  if (row.v === 0 && row.q >= 8) out.push('<span class="pastilla sempre">Sempre la mateixa força des del 1979</span>');
  else if (row.v !== null && row.q !== null) out.push('<span class="pastilla">' + row.v + ' canvis de mans en ' + row.q + ' eleccions</span>');
  if (row.a) out.push('<span class="pastilla">' + row.a + (row.g ? " · " + row.g : "") + '</span>');
  out.push('<span class="pastilla">' + row.r + ' regidories</span>');
  out.push(row.t > 0
    ? '<span class="pastilla">' + row.t + ' actes indexades</span>'
    : '<span class="pastilla sense">Sense actes</span>');
  if (row.d !== null) out.push('<span class="pastilla">' + eur(row.d) + ' € de deute per habitant</span>');
  if (row.f !== null) out.push('<span class="pastilla">' + row.f + ' % de dones al ple</span>');
  if (row.y !== null) out.push('<span class="pastilla">transparència ' + row.y + ' %</span>');
  return out.join("");
}

function coincideix(row, q){
  if (q && !row._k.includes(q)) return false;
  if (filtres.has("pacte") && row.w !== 0) return false;
  if (filtres.has("canvi") && row.k !== 1) return false;
  if (filtres.has("majoria") && row.m !== 1) return false;
  if (filtres.has("sense") && row.t !== 0) return false;
  if (filtres.has("sempre") && !(row.v === 0 && row.q >= 8)) return false;
  if (filtres.has("unica") && row.o !== 1) return false;
  if (filtres.has("fitxa") && row.x !== 1) return false;
  return true;
}

function pinta(){
  const q = norm(cerca.value);
  const trobats = DADES.filter((row) => coincideix(row, q));
  // Amb 947 files no cal virtualitzar res, però sí evitar 947 reflows: una sola escriptura.
  llista.innerHTML = trobats.slice(0, 400).map((row) =>
    '<li class="fila"><span class="nom">' +
      (row.x ? '<a href="m/' + row.s + '/">' + row.n + '</a>' : row.n) +
    '</span><span class="pob">' + eur(row.p) + ' hab.</span>' +
    '<span class="lloc">' + row.c + '</span>' +
    '<span class="dades">' + pastilles(row) + '</span></li>').join("");
  buit.hidden = trobats.length > 0;
  recompte.textContent = trobats.length === DADES.length
    ? DADES.length + " municipis"
    : trobats.length + " de " + DADES.length + " municipis" + (trobats.length > 400 ? " · se'n mostren 400" : "");
}

cerca.addEventListener("input", pinta);
for (const boto of document.querySelectorAll(".filtre")) {
  boto.addEventListener("click", () => {
    const key = boto.dataset.f;
    if (filtres.has(key)) filtres.delete(key); else filtres.add(key);
    boto.setAttribute("aria-pressed", filtres.has(key) ? "true" : "false");
    pinta();
  });
}
pinta();
</script>
</body>
</html>`;
}
