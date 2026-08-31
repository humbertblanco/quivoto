import { RADIOGRAFIA_CSS } from "./estil";
import { SITE } from "./config";
import { MASCOTA_CSS, catalunya } from "./mascota";
import { capcalera, tipografia } from "./capcalera";
import { cercador } from "./cercador";
import { geometria } from "./mapa";
import { peu } from "./peu";
import { sigla } from "./sigla";
import type { MostraMunicipi, PortadaMostra } from "./portada-mostra";

/**
 * La portada de l'Observatori.
 *
 * Era un fitxer escrit a mà amb dues targetes, després deu targetes generades
 * que explicaven què hi havia darrere de cada enllaç: «la fitxa d'un poble:
 * qui mana i amb qui, el ple amb nom i cognoms, les dotze eleccions…». Cada
 * una era una descripció d'una pàgina, i una descripció no és una dada. Qui
 * arribava a la portada llegia deu vegades «aquí hi ha coses» i no en veia cap.
 *
 * Ara la portada **ensenya** en comptes d'explicar: les vuit ciutats més grans
 * amb el nom de qui hi mana, el mapa dels 947 pintat per força, les quinze
 * marques amb les seves alcaldies, les sis comarques més poblades, els pobles
 * que ja tenen preguntes i tres comparacions per començar. Cada bloc és un
 * tros de la pàgina a què porta, i el títol del bloc és l'enllaç.
 *
 * ## Les ciutats grans, sense cares
 *
 * Cada capsa havia portat el retrat de l'alcaldia. Les cares són de persones,
 * no dels pobles, i a la pàgina que és de tot el país feien semblar la ciutat
 * seva; a més, qui té foto i qui no en té feien vuit capses de vuit mides.
 * Fora: el nom enllaçat hi porta igual, i les capses fan totes la mateixa.
 *
 * ## Les dues versions
 *
 * `renderPortada()` rep la mostra quan qui la crida ha obert la base de dades
 * —`publish.ts`— i no la rep quan no pot —`portada-ara.ts`, que refresca la
 * portada mentre una ingesta llarga té la base ocupada. Sense mostra no hi ha
 * targetes que expliquin res: només els enllaços a les seccions, que és el
 * mínim que fa que la portada no sigui un carreró.
 *
 * ## El mapa petit
 *
 * És la mateixa geometria de l'ICGC que dibuixa el mapa dels 947 i la silueta
 * de cada fitxa, i pesa el que pesa: 62 kB de camins a 1.600 unitats. Aquí es
 * torna a escriure a 800 —a l'amplada que té a la portada, mig píxel per unitat
 * ja és més fi que la pantalla—, es treuen els punts que en arrodonir queden
 * a sobre l'un de l'altre, i els municipis de la mateixa força s'escriuen en un
 * sol camí, que és el que estalvia 947 etiquetes i deixa que la taca d'una
 * força es vegi com una taca. En surten uns 50 kB en comptes de 66.
 *
 * ## Per què el botó de cerca no va dins de cap enllaç
 *
 * Un control interactiu dins d'un altre no és HTML vàlid, i el clic pujaria
 * fins a l'enllaç i canviaria de pàgina alhora que obre el diàleg. Va sol, neix
 * amagat i el guió del cercador l'ensenya: sense JavaScript, al costat hi ha
 * l'enllaç a la llista dels 947, on el poble es pot trobar a mà.
 *
 * ## La descàrrega
 *
 * Era una targeta amb el recompte de fitxers. Per a qui ve a mirar el seu
 * poble és soroll, i qui la vol la troba: una línia al final, sense xifres.
 */

const escape = (t: string): string =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const xifra = (n: number): string => n.toLocaleString("ca-ES");
/** «3,4 M» a partir del milió; per sota, la xifra sencera. */
const milions = (n: number): string => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(".", ",")} M` : xifra(n));
const plural = (n: number, un: string, molts: string): string => (n === 1 ? un : molts);

export type ComptesPortada = {
  municipis: number;
  comarques: number;
  candidatures: number;
  fitxersDades: number;
  conjuntsPreguntes: number;
  /** Municipis de l'Àrea Metropolitana, o null si encara no s'ha ingerit. */
  amb: number | null;
  /** Marques amb pàgina pròpia a `partit/`. */
  partits: number;
  /**
   * Persones de la pàgina «D'on surten els que manen», o null si no s'ha
   * pogut generar: llavors no hi ha pàgina i no s'hi enllaça.
   */
  trajectoria: number | null;
  /** El municipi de la fitxa d'exemple: el que té les preguntes més sòlides. */
  exemple: { slug: string; nom: string } | null;
  /** El que té demostració de preguntes, per enllaçar-la des de la portada. */
  provaDestacada: { slug: string; nom: string } | null;
};

// ------------------------------------------------------------------ el mapa

/** Les unitats del llenç del mapa petit: la meitat de les 1.600 de la geometria. */
const FACTOR_MINIMAPA = 0.5;
const LLENC_MINIMAPA = 800;

type Punt = readonly [number, number];

/**
 * Els anells d'un camí de la nostra geometria, en coordenades absolutes.
 *
 * Com `capsaCami()` a `mapa.ts`, només entén el que escriu
 * «geo_repara_icgc.py»: M i L absolutes, m, l, h i v relatives i Z. Cada M
 * obre un anell —els 44 municipis amb enclavaments o illes en tenen més d'un.
 */
export function anellsDe(d: string): Punt[][] {
  const anells: Punt[][] = [];
  let actual: Punt[] = [];
  let x = 0;
  let y = 0;
  const tanca = (): void => {
    if (actual.length > 0) anells.push(actual);
    actual = [];
  };
  for (const tros of d.match(/[MmLlHhVvZz][^MmLlHhVvZz]*/g) ?? []) {
    const ordre = tros[0]!;
    const n = (tros.slice(1).match(/-?\d*\.?\d+/g) ?? []).map(Number);
    if (ordre === "M" || ordre === "m") tanca();
    if (ordre === "M" || ordre === "L") {
      for (let i = 0; i + 1 < n.length; i += 2) actual.push([(x = n[i]!), (y = n[i + 1]!)]);
    } else if (ordre === "m" || ordre === "l") {
      for (let i = 0; i + 1 < n.length; i += 2) actual.push([(x += n[i]!), (y += n[i + 1]!)]);
    } else if (ordre === "H") for (const v of n) actual.push([(x = v), y]);
    else if (ordre === "h") for (const v of n) actual.push([(x += v), y]);
    else if (ordre === "V") for (const v of n) actual.push([x, (y = v)]);
    else if (ordre === "v") for (const v of n) actual.push([x, (y += v)]);
    else if (ordre === "Z" || ordre === "z") tanca();
  }
  tanca();
  return anells;
}

/**
 * El mateix camí, escalat i escrit curt: enters, «h» i «v» quan es pot, sense
 * espais sobrers i sense els punts que en arrodonir cauen sobre l'anterior.
 * Un anell que es queda amb menys de tres punts no és res i no s'escriu.
 */
export function camiCompacte(d: string, factor = FACTOR_MINIMAPA): string {
  let sortida = "";
  for (const anell of anellsDe(d)) {
    const punts: Punt[] = [];
    for (const [x, y] of anell) {
      const p: Punt = [Math.round(x * factor), Math.round(y * factor)];
      const u = punts[punts.length - 1];
      if (!u || u[0] !== p[0] || u[1] !== p[1]) punts.push(p);
    }
    const primer = punts[0];
    const ultim = punts[punts.length - 1];
    if (primer && ultim && punts.length > 1 && primer[0] === ultim[0] && primer[1] === ultim[1]) punts.pop();
    if (punts.length < 3) continue;
    let [px, py] = punts[0]!;
    sortida += `M${px} ${py}`;
    for (let i = 1; i < punts.length; i++) {
      const [x, y] = punts[i]!;
      const dx = x - px;
      const dy = y - py;
      sortida += dy === 0 ? `h${dx}` : dx === 0 ? `v${dy}` : `l${dx} ${dy}`;
      px = x;
      py = y;
    }
    sortida += "z";
  }
  return sortida;
}

/** La geometria compactada, un cop per procés: la portada es genera una vegada. */
let compacta: { contorn: string; municipis: ReadonlyMap<string, string> } | null = null;
function geometriaCompacta(): NonNullable<typeof compacta> {
  if (!compacta) {
    compacta = {
      contorn: geometria.contorn ? camiCompacte(geometria.contorn) : "",
      municipis: new Map(Object.entries(geometria.municipis).map(([slug, d]) => [slug, camiCompacte(d)])),
    };
  }
  return compacta;
}

/** El gris de «no sabem de quina marca és», el mateix que fa servir `sigla()`. */
const GRIS_LOCAL = "#8b8b8b";

/**
 * Els 947 pintats per la força de l'alcaldia, en un sol camí per força.
 *
 * Els municipis que la mostra no anomena es pinten com «sense identificar»:
 * el contorn de Catalunya ha de sortir sencer encara que la base tingui sis
 * municipis, que és el que passa a les proves.
 */
export function mapaQuiMana(mostra: PortadaMostra): string {
  const geo = geometriaCompacta();
  const colors = new Map(mostra.partits.map((p) => [p.id, p.color]));
  const marcaDe = new Map(mostra.quiMana.map((q) => [q.slug, q.brandId]));
  const grups = new Map<string, string[]>();
  for (const [slug, cami] of geo.municipis) {
    const marca = marcaDe.get(slug) ?? null;
    const grup = marca && colors.has(marca) ? marca : marca === "local" ? "local" : "cap";
    grups.set(grup, [...(grups.get(grup) ?? []), cami]);
  }
  const camins = [...grups]
    .map(([grup, seus]) => {
      const d = seus.join("");
      if (grup === "cap") return `<path class="cap" d="${d}"/>`;
      if (grup === "local") return `<path class="local" d="${d}"/>`;
      return `<path fill="${escape(colors.get(grup)!)}" d="${d}"/>`;
    })
    .join("\n  ");
  return `<svg class="minimapa" viewBox="0 0 ${LLENC_MINIMAPA} ${LLENC_MINIMAPA}" role="img"
  aria-label="Mapa de Catalunya amb cada municipi pintat del color de la força que hi té l'alcaldia">
  <defs><pattern id="pm-ratlles" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect width="6" height="6" fill="var(--nd-fons)"/><rect width="2.8" height="6" fill="var(--nd-ratlla)"/>
  </pattern></defs>
  ${camins}
  ${geo.contorn ? `<path class="contorn" d="${geo.contorn}"/>` : ""}
</svg>`;
}

// ------------------------------------------------------------------ l'estil

const CSS = `
/* --- l'entrada: la mascota, una frase i el botó que obre el cercador --- */
.portada .cerca-poble{display:flex;align-items:center;gap:var(--e2);flex-wrap:wrap;margin:var(--e3) 0 0}
.portada .obre-cerca{margin:0;background:var(--presec);color:#1E1B2E;box-shadow:var(--ombra);
  min-height:44px;font-size:.9rem}
.portada .obre-cerca:hover{background:var(--ink);color:var(--paper)}
.portada .obre-cerca[hidden]{display:none}
/* El botó de la capçalera amaga el text en pantalles estretes i es queda amb
   la lupa; aquest és la crida de la portada i el text és el que la fa. */
.portada .obre-cerca span{position:static;width:auto;height:auto;overflow:visible;clip:auto}
.portada .cerca-poble a{font-weight:700;font-size:.92rem}

/* --- els blocs: el títol és l'enllaç a la pàgina sencera --- */
.bloc h2 a{color:inherit;text-decoration:none}
.bloc h2 a::after{content:" →";color:var(--coral-text);font-weight:900}
.bloc h2 a:hover{text-decoration:underline;text-decoration-thickness:3px;text-underline-offset:6px}
.mes{margin:var(--e2) 0 0;font-weight:800;font-size:.92rem}

/* --- les ciutats més grans: quatre capses iguals per fila, dues en un telèfon ---
   Sense retrats, cada capsa són tres línies. Les files es reparteixen iguals
   (grid-auto-rows:1fr), un nom llarg es talla a dues línies perquè cap capsa
   no creixi pel seu compte, i els habitants s'enganxen a baix de tot: la
   línia de sota queda alineada d'una capsa a l'altra. */
.grans{list-style:none;margin:var(--e2) 0 0;padding:0;display:grid;gap:var(--e2);
  grid-template-columns:repeat(4,minmax(0,1fr));grid-auto-rows:1fr}
@media (max-width:760px){.grans{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:600px){.grans{grid-template-columns:repeat(2,minmax(0,1fr))}}
.grans li{display:flex;flex-direction:column;gap:4px;min-width:0;min-height:84px}
.grans .poble{font-family:var(--display);font-weight:900;font-size:1.15rem;letter-spacing:-.02em;
  line-height:1.1;text-decoration:none;overflow-wrap:anywhere;
  display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
.grans .poble:hover{text-decoration:underline;text-decoration-thickness:2.5px;text-underline-offset:4px}
.grans .alcaldia{font-size:.84rem;line-height:1.3;display:flex;flex-wrap:wrap;gap:3px 6px;align-items:center}
.grans .alcaldia a{font-weight:700}
.grans .hab{font-size:.76rem;color:var(--ink-suau);font-weight:700;font-variant-numeric:tabular-nums;margin-top:auto}

/* --- qui mana: el mapa i la clau, l'un al costat de l'altra --- */
.mana-reixa{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:var(--e3);align-items:center}
@media (max-width:640px){.mana-reixa{grid-template-columns:1fr}}
.minimapa-enllac{display:block;border-radius:var(--r-m)}
.minimapa{width:100%;height:auto;display:block}
/* La vora és del color del paper: separa dues forces veïnes i tapa les
   escletlles que deixa arrodonir cada municipi pel seu compte. */
.minimapa path{stroke:var(--paper);stroke-width:.6;stroke-linejoin:round}
.minimapa .contorn{fill:none;stroke:var(--ink);stroke-width:2.5}
.minimapa .local,.clau-mini .mostra.local{fill:${GRIS_LOCAL};background:${GRIS_LOCAL}}
/* Les ratlles de «sense identificar», les mateixes del mapa dels 947. */
.minimapa,.clau-mini{--nd-fons:#DDD9E6;--nd-ratlla:#7B7592}
@media (prefers-color-scheme:dark){.minimapa,.clau-mini{--nd-fons:#2E2A3A;--nd-ratlla:#8A83A3}}
.minimapa .cap{fill:url(#pm-ratlles)}
.clau-mini{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px;font-size:.9rem;line-height:1.45}
.clau-mini .forces{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.clau-mini .forces .sigla{font-size:.78rem}
.clau-mini .mostra{display:inline-block;width:16px;height:16px;border:1.5px solid var(--ink);border-radius:4px;
  vertical-align:-3px;margin-right:7px}
.clau-mini .mostra.cap{background:repeating-linear-gradient(45deg,var(--nd-ratlla) 0 3px,var(--nd-fons) 3px 6px)}
.clau-mini b{font-variant-numeric:tabular-nums}

/* --- les marques: la pastilla i les xifres, en una sola peça --- */
.marques{list-style:none;margin:var(--e2) 0 0;padding:0;display:flex;flex-wrap:wrap;gap:10px}
.marques a{display:inline-flex;align-items:center;gap:9px;text-decoration:none;color:inherit;
  border:2px solid var(--ink);border-radius:var(--r-max);padding:4px 13px 4px 5px;background:var(--paper-2);
  transition:transform .12s ease,box-shadow .12s ease}
.marques a:hover{box-shadow:var(--ombra);transform:translate(-1px,-1px)}
@media (prefers-reduced-motion:reduce){.marques a,.comparacions a,.xip{transition:none}}
.marques .compte{font-size:.8rem;font-weight:700;color:var(--ink-suau);white-space:nowrap;font-variant-numeric:tabular-nums}
.marques .compte b{color:var(--ink)}

/* --- les comarques: una taula curta --- */
.taula-desplacable{overflow-x:auto;margin-top:var(--e2)}
.comarques-taula{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;font-size:.95rem}
.comarques-taula th,.comarques-taula td{padding:9px 10px;text-align:right;vertical-align:middle;
  border-bottom:2px solid var(--vora);white-space:nowrap}
.comarques-taula th[scope="row"],.comarques-taula .mana-cela{text-align:left}
.comarques-taula thead th{font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;
  color:var(--ink-suau);border-bottom:2.5px solid var(--ink)}
/* La capçalera s'alinea com la seva columna: noms i sigles a l'esquerra,
   xifres a la dreta; si no, «Comarca» i «Qui hi mana més» suraven a la dreta
   de columnes escrites a l'esquerra. */
.comarques-taula thead th:first-child,.comarques-taula thead th:last-child{text-align:left}
.comarques-taula th[scope="row"] a{font-family:var(--display);font-weight:900;font-size:1.05rem;
  letter-spacing:-.01em;text-decoration:none}
.comarques-taula th[scope="row"] a:hover{text-decoration:underline;text-decoration-thickness:2.5px;text-underline-offset:4px}
.comarques-taula .sec{font-size:.78rem;color:var(--ink-suau);font-weight:700;margin-left:6px}

/* --- les preguntes: un xip per poble, i els que ja es responen com a botó --- */
.xips{list-style:none;margin:var(--e2) 0 0;padding:0;display:flex;flex-wrap:wrap;gap:8px}
.xip{display:inline-flex;align-items:center;gap:7px;min-height:36px;padding:0 14px;border:2px solid var(--ink);
  border-radius:var(--r-max);font-weight:800;font-size:.86rem;text-decoration:none;color:inherit;
  background:var(--paper-2);transition:transform .12s ease,box-shadow .12s ease}
.xip:hover{box-shadow:var(--ombra)}
.xip.jugable{background:var(--lavanda);color:#1E1B2E;border-color:#1E1B2E;box-shadow:var(--ombra)}
.xip.jugable:hover{transform:translate(2px,2px);box-shadow:1px 1px 0 #1E1B2E}
.xip small{font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;opacity:.75}

/* --- tres comparacions per començar ---
   Les targetes fan la mateixa alçada encara que un títol ocupi dues línies i
   els altres una: la fila és compartida i l'enllaç omple la seva capsa. */
.comparacions{list-style:none;margin:var(--e2) 0 0;padding:0;display:grid;gap:var(--e2);
  grid-template-columns:repeat(auto-fit,minmax(220px,1fr));grid-auto-rows:1fr}
.comparacions li{display:flex;min-width:0}
.comparacions a{flex:1;display:flex;flex-direction:column;gap:3px;text-decoration:none;color:inherit;
  border:2.5px solid var(--ink);border-radius:var(--r-m);padding:var(--e2);background:var(--paper-2);
  box-shadow:var(--ombra);transition:transform .12s ease,box-shadow .12s ease}
.comparacions a:hover{transform:translate(2px,2px);box-shadow:1px 1px 0 var(--ink)}
.comparacions b{font-family:var(--display);font-weight:900;font-size:1.05rem;letter-spacing:-.02em}
.comparacions span{font-size:.82rem;color:var(--ink-suau);font-weight:700}

/* --- una línia per a cada cosa que no necessita un bloc --- */
.linies{display:flex;flex-direction:column;gap:8px}
.linia{margin:0;font-size:1rem}
.linia a{font-weight:800}
.linia span{color:var(--ink-suau);font-weight:700;font-size:.9rem}
.baixa{font-size:.86rem;color:var(--ink-suau);margin:var(--e2) 0 0}

/* --- el mateix aire entre blocs a totes les mides ---
   Els 40px de --e4 entre bloc i bloc són aire en un portàtil i un desert en
   un telèfon de 390px: allà l'espai entre blocs baixa un graó, com el de
   dins de cada bloc. */
@media (max-width:600px){.portada{padding:var(--e2) 0 var(--e3)}.bloc{padding:var(--e3) 0}}

/* --- sense la base de dades: els enllaços i prou --- */
.seccions{list-style:none;margin:var(--e3) 0 0;padding:0;display:flex;flex-wrap:wrap;gap:10px}
.seccions a{display:inline-flex;align-items:center;min-height:40px;padding:0 16px;border:2px solid var(--ink);
  border-radius:var(--r-max);font-weight:800;font-size:.9rem;text-decoration:none;color:inherit;background:var(--paper-2)}
.seccions a:hover{box-shadow:var(--ombra)}
`;

const LUPA = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5 L21 21"/></svg>`;

// ------------------------------------------------------------------ els blocs

/* Una ciutat de la portada: el poble, qui hi mana i quants hi viuen. Sense
   retrat ni inicials: la capsa és del municipi i la cara era d'una persona. */
function municipiGran(m: MostraMunicipi): string {
  const a = m.alcaldia;
  // El nom de l'alcaldia porta a la fitxa de la persona i, quan no en té, a
  // l'apartat d'alcaldies del municipi: on va ho decideix `resolAlcaldia()`.
  const alcaldia = a
    ? `<span class="alcaldia"><a href="m/${escape(m.slug)}/${a.adreca ? escape(a.adreca) : "#alcaldies"}">${escape(a.nom)}</a>${
        a.sigles ? ` ${sigla(a.sigles, { base: "./", brandId: a.brandId })}` : ""
      }</span>`
    : `<span class="alcaldia">sense alcaldia identificada</span>`;
  return `<li>
      <a class="poble" href="m/${escape(m.slug)}/">${escape(m.nom)}</a>
      ${alcaldia}
      <span class="hab">${xifra(m.habitants)} habitants</span>
    </li>`;
}

function blocMunicipis(mostra: PortadaMostra): string {
  if (mostra.municipis.length === 0) return "";
  const resta = mostra.comptes.municipis - mostra.municipis.length;
  return `<section class="bloc" id="grans">
    <h2><a href="els947.html">Els municipis més grans</a></h2>
    <ol class="grans">${mostra.municipis.map(municipiGran).join("")}</ol>
    ${resta > 0 ? `<p class="mes"><a href="els947.html">i ${xifra(resta)} més →</a></p>` : ""}
  </section>`;
}

function blocQuiMana(mostra: PortadaMostra): string {
  if (mostra.quiMana.length === 0) return "";
  const ambAlcaldies = mostra.partits.filter((p) => p.alcaldies > 0);
  const { alcaldiesLocals, senseIdentificar } = mostra.comptes;
  const clau = [
    ambAlcaldies.length > 0
      ? `<li class="forces">${ambAlcaldies
          .map((p) => sigla(p.sigles, { base: "./", brandId: p.id, color: p.color }))
          .join("")} <span>una alcaldia de cada color</span></li>`
      : "",
    alcaldiesLocals > 0
      ? `<li><i class="mostra local"></i><b>${xifra(alcaldiesLocals)}</b> ${plural(alcaldiesLocals, "alcaldia", "alcaldies")} de llistes locals o sense marca</li>`
      : "",
    senseIdentificar > 0
      ? `<li><i class="mostra cap"></i><b>${xifra(senseIdentificar)}</b> sense identificar</li>`
      : "",
  ].join("");
  return `<section class="bloc" id="mana">
    <h2><a href="mapa/">Qui mana</a></h2>
    <div class="mana-reixa">
      <a class="minimapa-enllac" href="mapa/" title="El mapa dels 947, capa a capa">${mapaQuiMana(mostra)}</a>
      <ul class="clau-mini">${clau}</ul>
    </div>
  </section>`;
}

function blocPartits(mostra: PortadaMostra): string {
  if (mostra.partits.length === 0) return "";
  return `<section class="bloc" id="partits">
    <h2><a href="partit/">Els partits</a></h2>
    <ul class="marques">${mostra.partits
      .map(
        (p) => `<li><a href="partit/${escape(p.id)}/" title="${escape(p.nom)} a tot Catalunya">${sigla(p.sigles, {
          brandId: p.id,
          color: p.color,
        })}<span class="compte"><b>${xifra(p.alcaldies)}</b> ${plural(p.alcaldies, "alcaldia", "alcaldies")} · <b>${xifra(
          p.regidories,
        )}</b> ${plural(p.regidories, "regidoria", "regidories")}</span></a></li>`,
      )
      .join("")}</ul>
  </section>`;
}

function blocComarques(mostra: PortadaMostra): string {
  if (mostra.comarques.length === 0) return "";
  const colors = new Map(mostra.partits.map((p) => [p.id, p.color]));
  const files = mostra.comarques
    .map((c) => {
      const mana = c.forcaMes
        ? `${sigla(c.forcaMes.sigles, { base: "./", brandId: c.forcaMes.brandId, color: colors.get(c.forcaMes.brandId) })}<span class="sec">${xifra(
            c.forcaMes.alcaldies,
          )} de ${xifra(c.municipis)}</span>`
        : `<span class="sec">sense identificar</span>`;
      return `<tr><th scope="row"><a href="c/${escape(c.slug)}/">${escape(c.nom)}</a></th>
        <td>${xifra(c.municipis)}</td><td>${xifra(c.habitants)}</td><td class="mana-cela">${mana}</td></tr>`;
    })
    .join("");
  return `<section class="bloc" id="comarques">
    <h2><a href="c/">Les comarques</a></h2>
    <div class="taula-desplacable"><table class="comarques-taula">
      <thead><tr><th scope="col">Comarca</th><th scope="col">Municipis</th><th scope="col">Habitants</th><th scope="col">Qui hi mana més</th></tr></thead>
      <tbody>${files}</tbody>
    </table></div>
    <p class="mes"><a href="c/">totes ${xifra(mostra.comptes.comarques)} →</a></p>
  </section>`;
}

function blocPreguntes(mostra: PortadaMostra): string {
  if (mostra.preguntes.length === 0) return "";
  const jugables = mostra.preguntes.filter((p) => p.jugable).length;
  return `<section class="bloc" id="preguntes">
    <h2><a href="preguntes/">Respon les preguntes</a></h2>
    <p class="entrada-bloc">Les preguntes de la brúixola, escrites llegint les actes del ple de
    ${xifra(mostra.preguntes.length)} ${plural(mostra.preguntes.length, "municipi", "municipis")}${
      jugables > 0 ? `; a ${xifra(jugables)} ja es poden respondre.` : "."
    }</p>
    <ul class="xips">${mostra.preguntes
      .map((p) =>
        p.jugable
          ? `<li><a class="xip jugable" href="preguntes/${escape(p.slug)}/prova/">${escape(p.nom)} <small>respon</small></a></li>`
          : `<li><a class="xip" href="preguntes/${escape(p.slug)}/">${escape(p.nom)}</a></li>`,
      )
      .join("")}</ul>
  </section>`;
}

function blocCompara(mostra: PortadaMostra): string {
  if (mostra.comparacions.length === 0) return "";
  return `<section class="bloc" id="compara">
    <h2><a href="comparador/">Compara</a></h2>
    <ul class="comparacions">${mostra.comparacions
      .map(
        (c) => `<li><a href="comparador/?m=${escape(c.slugs.join(","))}"><b>${escape(c.titol)}</b><span>${c.noms
          .map(escape)
          .join(" · ")}</span></a></li>`,
      )
      .join("")}</ul>
  </section>`;
}

function blocLinies(comptes: ComptesPortada, mostra: PortadaMostra): string {
  const linies = [
    mostra.amb
      ? `<p class="linia"><a href="amb/">L'Àrea Metropolitana</a> <span>${xifra(mostra.amb.municipis)} municipis · ${milions(
          mostra.amb.habitants,
        )} habitants</span></p>`
      : "",
    comptes.trajectoria !== null
      ? `<p class="linia"><a href="trajectoria/">D'on surten els que manen</a> <span>${xifra(
          comptes.trajectoria,
        )} persones que han passat de l'ajuntament al Parlament, al Congrés, al Senat, a una diputació o al Govern</span></p>`
      : "",
  ].join("");
  return linies ? `<section class="bloc linies">${linies}</section>` : "";
}

/** Sense la base de dades: els enllaços a les seccions i prou. */
function seccions(comptes: ComptesPortada): string {
  const enllacos: [string, string][] = [
    ["els947.html", `Els ${xifra(comptes.municipis)} municipis`],
    ["mapa/", "El mapa"],
    ["partit/", "Els partits"],
    ["c/", "Les comarques"],
    ...(comptes.conjuntsPreguntes > 0 ? [["preguntes/", "Les preguntes"] as [string, string]] : []),
    ["comparador/", "El comparador"],
    ...(comptes.amb ? [["amb/", "L'Àrea Metropolitana"] as [string, string]] : []),
    ...(comptes.trajectoria !== null ? [["trajectoria/", "D'on surten els que manen"] as [string, string]] : []),
  ];
  return `<nav aria-label="Seccions de l'Observatori"><ul class="seccions">${enllacos
    .map(([on, text]) => `<li><a href="${on}">${escape(text)}</a></li>`)
    .join("")}</ul></nav>`;
}

export function renderPortada(comptes: ComptesPortada, generatedAt: string, mostra?: PortadaMostra): string {
  const cos = mostra
    ? [
        blocMunicipis(mostra),
        blocQuiMana(mostra),
        blocPartits(mostra),
        blocComarques(mostra),
        blocPreguntes(mostra),
        blocCompara(mostra),
        blocLinies(comptes, mostra),
      ].join("\n")
    : seccions(comptes);

  return `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Observatori municipal · quivoto</title>
<meta name="description" content="Els ${comptes.municipis} municipis de Catalunya amb dades obertes: qui governa, resultats des del 1979, comptes, impostos, el ple i les actes.">
<link rel="canonical" href="${SITE}/observatori/">
${tipografia("./")}
<style>${RADIOGRAFIA_CSS}${MASCOTA_CSS}${CSS}</style>
</head>
<body>
<a class="salta" href="#contingut">Ves al contingut</a>
${capcalera("./", "portada")}
${cercador("./")}

<main id="contingut">
  <section class="portada">
    <div class="presenta">${catalunya(150, "felic", null)}<div>
      <p class="micro">Poble a poble</p>
      <h1>Observatori municipal</h1>
    </div></div>
    <p class="entrada">Qui mana a cada un dels <b>${xifra(comptes.municipis)} municipis</b> de Catalunya, què s'hi
    ha votat des del 1979 i què en diuen els comptes, amb la font de cada xifra al costat.</p>
    <p class="cerca-poble"><button type="button" class="obre-cerca" data-obre-cerca hidden>${LUPA}<span>Escriu el nom del teu poble</span></button>
      <a href="els947.html">o busca'l a la llista dels ${xifra(comptes.municipis)}</a></p>
  </section>

  ${cos}

  <section class="bloc fonts">
    <h2>Per què això i no un portal de dades</h2>
    <p>El 23 de maig del 2027 hi ha eleccions municipals. La pregunta que volem que es pugui
    respondre és <b>«què han fet aquests quatre anys al meu poble i què m'hi jugo»</b>, i una dada
    que no ajuda a decidir un vot no entra, per bona que sigui.</p>
    <p class="baixa">Tot el que hi ha aquí es pot <a href="dades/">baixar en CSV i JSON</a>.</p>
  </section>
</main>
${peu("./", generatedAt)}
</body></html>`;
}
