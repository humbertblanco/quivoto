import { readFileSync } from "node:fs";
import { RADIOGRAFIA_CSS } from "./estil";
import { siglesFamily } from "@quivoto/shared-schemas/brands";
import { SITE } from "./config";
import type { Els947Row } from "./els947";
import { MASCOTA_CSS, papereta } from "./mascota";
import { capcalera } from "./capcalera";
import { cercador } from "./cercador";

/**
 * El mapa dels 947, pintat per indicador.
 *
 * Fins ara el mapa de l'Observatori era un núvol de punts: servia per situar un
 * municipi però no per veure res. Amb els límits municipals de veritat es pot
 * veure d'una ullada on hi ha majories absolutes, on l'alcaldia ha canviat a mig
 * mandat i on la mateixa força guanya des del 1979 —coses que en una llista de
 * 947 files no es veuen mai.
 *
 * La geometria està desada al repositori i no es baixa en temps de compilació:
 * els límits municipals canvien molt de tant en tant, i dependre d'un servei
 * extern per generar el web seria fer-se dependent d'una cosa que no controlem.
 * `tools/geo_repara_icgc.py` documenta com s'obté i, sobretot, com es repara —el
 * GeoJSON que serveix l'ICGC aplana cada MultiPolygon i, si te'l creus tal com
 * ve, Barcelona i 43 municipis més desapareixen del mapa.
 *
 * **Un mapa de municipis sobrerepresenta el buit.** El Pallars ocupa molta més
 * taca que el Barcelonès i hi viu una fracció de la gent. Per això aquí no hi ha
 * cap indicador de diners per habitant: es llegiria com un mapa de densitat de
 * població i no del que ha fet cada ajuntament.
 */

const escape = (t: string): string =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type Geometria = {
  font: string;
  fontUrl: string;
  llicencia: string;
  llicenciaUrl: string;
  actualitzat: string;
  viewBox: string;
  contorn: string | null;
  municipis: Record<string, string>;
};

export const geometria: Geometria = JSON.parse(
  readFileSync(new URL("./geo/municipis.json", import.meta.url), "utf8"),
) as Geometria;

type Capa = {
  id: string;
  titol: string;
  peu: string;
  /** Valor d'un municipi, o null si no en tenim. */
  valor: (r: Els947Row) => number | null;
  /** Els talls entre graons; si no n'hi ha, es fan per quantils. */
  talls?: number[];
  etiquetes?: string[];
  format: (v: number) => string;
  /**
   * Colors propis de la capa, un per graó, quan el que separa els municipis no
   * és una escala sinó una categoria. La rampa coral de la resta de capes diu
   * «més o menys»; els partits no són més ni menys que els altres, i pintar-los
   * amb una rampa faria que el mapa digués una cosa que no és.
   */
  colors?: string[];
};

const pct = (v: number): string => `${v.toString().replace(".", ",")} %`;

/**
 * De quina força és l'alcaldia de cada poble.
 *
 * Les sigles no serveixen per pintar: el PSC es presenta com a PSC-CP, PSC-PM
 * o PSC-PSOE segons el poble i l'any, i pintades una a una el mapa sortiria
 * clapejat de vermells diferents que no volen dir res. El que agrupa és la
 * **família** —la mateixa funció que ja fa servir tota la resta del projecte—
 * i per això «unificar noms de partit diferents» no és cap feina a part: és el
 * que fa `siglesFamily()`.
 *
 * Les llistes locals no s'ajunten en cap categoria: són 226 marques que no
 * tenen res a veure les unes amb les altres, i pintar-les del mateix color
 * diria que hi ha un «partit de les llistes locals» que no existeix. Van amb
 * el gris de sense marca, que és exactament el que són aquí.
 */
const FAMILIES_MAPA: ReadonlyArray<readonly [string, string, string]> = [
  ["psc", "PSC", "#d00c3c"],
  ["junts", "Junts", "#00c3b2"],
  ["erc", "ERC", "#ffb232"],
  ["comuns", "Comuns", "#662483"],
  ["cup", "CUP", "#d8d000"],
  ["pp", "PP", "#234b90"],
  ["cs", "Ciutadans", "#ff5824"],
  ["vox", "Vox", "#00c118"],
  ["pdecat", "PDeCAT", "#7f9ac9"],
  ["aliancacat", "Aliança Catalana", "#1d3f6e"],
  ["ciu", "CiU", "#18307b"],
  ["cda", "CDA", "#a05a2c"],
];

const CAPA_PARTIT: Capa = {
  id: "partit",
  titol: "De quina força és cada alcaldia",
  peu: `El color és el de la força de qui té l'alcaldia, no el de la llista més votada.
    Les candidatures del mateix partit s'ajunten encara que es presentin amb sigles diferents
    a cada poble; les llistes locals no s'ajunten amb ningú, perquè no són el mateix partit.`,
  valor: (r) => {
    if (!r.g) return null;
    const familia = siglesFamily(r.g);
    if (!familia) return null;
    const i = FAMILIES_MAPA.findIndex(([id]) => id === familia);
    return i === -1 ? null : i;
  },
  talls: FAMILIES_MAPA.map((_, i) => i + 0.5).slice(0, -1),
  etiquetes: FAMILIES_MAPA.map(([, nom]) => nom),
  colors: FAMILIES_MAPA.map(([, , color]) => color),
  format: (v) => FAMILIES_MAPA[v]?.[1] ?? "sense marca",
};

const CAPES: Capa[] = [
  CAPA_PARTIT,
  {
    id: "majoria",
    titol: "On governa algú amb majoria absoluta",
    peu: `Una llista sola amb prou regidories per aprovar el que vulgui sense pactar amb ningú.
      És la diferència entre un mandat on cada punt es negocia i un on no cal.`,
    valor: (r) => r.m,
    talls: [0.5],
    etiquetes: ["cap llista sola", "majoria absoluta"],
    format: (v) => (v === 1 ? "amb majoria absoluta" : "sense majoria absoluta"),
  },
  {
    id: "guanyador",
    titol: "On no governa la llista més votada",
    peu: `Guanyar unes municipals no vol dir governar-les: l'alcaldia la vota el ple. Aquí es veu
      on el primer no mana, que és on el pacte va decidir més que els vots.`,
    valor: (r) => (r.w === null ? null : r.w === 1 ? 0 : 1),
    talls: [0.5],
    etiquetes: ["governa qui va guanyar", "governa un altre"],
    format: (v) => (v === 1 ? "no governa la llista més votada" : "governa la llista més votada"),
  },
  {
    id: "canvi",
    titol: "On ha canviat l'alcaldia a mig mandat",
    peu: `Una moció de censura, una dimissió o un relleu pactat. No diu què va passar, però diu
      on va passar alguna cosa.`,
    valor: (r) => r.k,
    talls: [0.5],
    etiquetes: ["la mateixa alcaldia", "hi ha canviat"],
    format: (v) => (v === 1 ? "l'alcaldia ha canviat a mig mandat" : "la mateixa alcaldia tot el mandat"),
  },
  {
    id: "alternances",
    titol: "Quantes vegades ha canviat qui guanya, des del 1979",
    peu: `Dotze eleccions. Zero vol dir que la mateixa força les ha guanyat totes; com més alt,
      més s'hi mou el vot. És la millor pista de si el 2027 està decidit o obert.`,
    valor: (r) => r.v,
    talls: [0.5, 1.5, 2.5, 3.5],
    etiquetes: ["cap canvi", "1", "2", "3", "4 o més"],
    format: (v) => (v === 0 ? "sempre la mateixa força" : `${v} canvis de força més votada`),
  },
  {
    id: "dones",
    titol: "Quantes dones hi ha al ple",
    peu: `Percentatge de regidories ocupades per dones. La llei obliga a llistes paritàries des del
      2007, però qui acaba entrant depèn de l'ordre i dels escons.`,
    valor: (r) => r.f,
    format: pct,
  },
  {
    id: "transparencia",
    titol: "Què publica cada ajuntament",
    peu: `Percentatge dels apartats del portal de transparència que l'ajuntament té publicats,
      segons el mesurament de l'AOC. No mesura la qualitat del que hi ha, només que hi sigui.`,
    valor: (r) => r.y,
    format: pct,
  },
];

/** Talls per quantils, ignorant els municipis sense dada. */
function quantils(valors: readonly number[], graons: number): number[] {
  const ordenats = [...valors].sort((a, b) => a - b);
  const talls: number[] = [];
  for (let i = 1; i < graons; i += 1) {
    talls.push(ordenats[Math.floor((i * ordenats.length) / graons)] ?? 0);
  }
  // Amb molts empats, dos talls poden coincidir i un graó quedaria buit.
  return [...new Set(talls)];
}

const graoDe = (valor: number, talls: readonly number[]): number => {
  let g = 0;
  for (const t of talls) if (valor >= t) g += 1;
  return g;
};

const CSS = `
.mapa-marc{margin:var(--e4) 0 0;position:relative}
/* La fitxa que segueix el ratolí. No intercepta cap clic —el que hi ha a sota
   és l'enllaç al municipi— i no surt mai amb el dit: allà el toc ja obre la
   fitxa del poble, que és millor que qualsevol previsualització. */
.ullada-mapa{position:absolute;z-index:5;pointer-events:none;background:var(--paper-2);
  border:2.5px solid var(--ink);border-radius:var(--r-m);box-shadow:var(--ombra);
  padding:10px 14px;min-width:190px;max-width:280px;display:flex;flex-direction:column;gap:2px}
.ullada-mapa b{font-family:var(--display);font-weight:900;font-size:1.05rem;letter-spacing:-.01em;line-height:1.15}
.ullada-mapa .hab{font-size:.76rem;color:var(--ink-suau);font-weight:700;font-variant-numeric:tabular-nums}
.ullada-mapa .qui{display:flex;align-items:center;gap:7px;font-size:.82rem;font-weight:800;margin-top:4px}
.ullada-mapa .qui i{width:11px;height:11px;border-radius:3px;border:1.5px solid var(--ink);flex:none}
.ullada-mapa .qui i.sense{background:#DED8CB}
.ullada-mapa .capa{font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;
  color:var(--ink-suau);margin-top:5px;padding-top:5px;border-top:1px solid var(--vora)}
.mapa947{width:100%;height:auto;display:block;max-width:900px;margin:0 auto}
.mapa947 path{stroke:var(--ink);stroke-width:.7;stroke-linejoin:round;transition:fill .3s ease}
.mapa947 a:hover path,.mapa947 a:focus path{stroke-width:3.5}
.mapa947 .contorn{fill:none;stroke:var(--ink);stroke-width:3.5}
/* La rampa va d'una sola tinta i amb la lluminància sempre baixant, perquè els
   graons se sàpiguen distingir també sense veure el color: amb la rampa de
   menta a coral de la marca, els tres primers quedaven indistingibles en
   deuteranòpia. Els quadrets de la llegenda són HTML i volen «background»; els
   camins són SVG i volen «fill». */
${CAPES.map((c, i) =>
  c.colors
    ? c.colors
        .map(
          (col, k) =>
            `.mapa947[data-capa="${i}"] .g${k}{fill:${col}}.llegenda[data-capa="${i}"] .g${k}{background:${col}}`,
        )
        .join("")
    : "",
).join("")}
.mapa947 .g0{fill:#FBEFE6}.mapa947 .g1{fill:#F0BFA9}.mapa947 .g2{fill:#E2735A}
.mapa947 .g3{fill:#BE5138}.mapa947 .g4{fill:#8E2F1D}.mapa947 .gnd{fill:#DED8CB}
.llegenda .g0{background:#FBEFE6}.llegenda .g1{background:#F0BFA9}.llegenda .g2{background:#E2735A}
.llegenda .g3{background:#BE5138}.llegenda .g4{background:#8E2F1D}.llegenda .gnd{background:#DED8CB}
.tries{display:flex;gap:8px;flex-wrap:wrap;margin:var(--e3) 0 0;padding:0;list-style:none}
.tries button{font:inherit;font-weight:800;font-size:.85rem;cursor:pointer;background:var(--paper-2);
  color:inherit;border:2.5px solid var(--ink);border-radius:var(--r-max);padding:9px 16px;min-height:44px;
  box-shadow:var(--ombra)}
.tries button[aria-pressed="true"]{background:var(--ink);color:var(--paper)}
.llegenda{display:flex;gap:var(--e2);flex-wrap:wrap;align-items:center;margin:var(--e3) 0 0;
  font-size:.84rem;font-weight:700;list-style:none;padding:0}
.llegenda li{display:flex;align-items:center;gap:6px}
.llegenda i{width:22px;height:22px;border:2px solid var(--ink);border-radius:5px;display:inline-block}
@media (prefers-reduced-motion:reduce){.mapa947 path{transition:none}}
`;

export function renderMapaCatalunya(files: readonly Els947Row[], generatedAt: string): string {
  const perSlug = new Map(files.map((r) => [r.s, r]));
  const slugs = Object.keys(geometria.municipis).sort();

  // Cada capa es desa com una cadena d'un caràcter per municipi: amb 947
  // municipis i sis capes, són sis cadenes de 947 lletres. Canviar de capa és
  // reescriure una classe, no tornar a baixar el mapa.
  const capes = CAPES.map((capa) => {
    const valors = slugs
      .map((s) => (perSlug.has(s) ? capa.valor(perSlug.get(s)!) : null))
      .filter((v): v is number => v !== null);
    const talls = capa.talls ?? quantils(valors, 5);
    const graons = slugs
      .map((s) => {
        const fila = perSlug.get(s);
        const v = fila ? capa.valor(fila) : null;
        // Un caràcter per municipi i no un número escrit: amb dotze famílies
        // els graons 10 i 11 ocupaven dues lletres i la cadena sortia amb 949
        // caràcters per a 947 municipis. A partir del desè, tot el mapa
        // quedava desplaçat: Lleida, que és del PSC, es pintava d'ERC. En base
        // 36 el graó sempre és una lletra i el mecanisme aguanta fins a 36
        // categories.
        return v === null ? "x" : graoDe(v, talls).toString(36);
      })
      .join("");
    const etiquetes =
      capa.etiquetes ??
      talls
        .map((t, i) =>
          i === 0 ? `menys de ${capa.format(t)}` : `${capa.format(talls[i - 1]!)} o més`,
        )
        .concat([`${capa.format(talls[talls.length - 1]!)} o més`])
        .slice(0, talls.length + 1);
    const ambDada = graons.split("").filter((c) => c !== "x").length;
    return { ...capa, graons, etiquetes, ambDada, talls };
  });

  // El que ensenya la fitxa flotant, en el mateix ordre que els camins: nom,
  // habitants, alcaldia, sigles i color de la seva força. Va com una llista
  // paral·lela i no com a atributs de cada camí perquè 947 camins amb cinc
  // atributs cadascun són 947 lectures del DOM a cada moviment del ratolí.
  const info = slugs.map((slug) => {
    const f = perSlug.get(slug);
    if (!f) return [slug, 0, "", "", ""];
    const familia = f.g ? siglesFamily(f.g) : null;
    const color = familia ? FAMILIES_MAPA.find(([id]) => id === familia)?.[2] ?? "" : "";
    return [f.n, f.p, f.a ?? "", f.g ?? "", color];
  });

  const primera = capes[0]!;
  const camins = slugs
    .map((slug, i) => {
      const fila = perSlug.get(slug);
      const nom = fila?.n ?? slug;
      const g = primera.graons[i] === "x" ? "gnd" : `g${primera.graons[i]}`;
      return `<a href="/observatori/m/${escape(slug)}/"><title>${escape(nom)}</title><path class="${g}" d="${geometria.municipis[slug]}"/></a>`;
    })
    .join("");

  const tries = capes
    .map(
      (c, i) =>
        `<li><button type="button" data-capa="${i}" aria-pressed="${i === 0 ? "true" : "false"}">${escape(c.titol)}</button></li>`,
    )
    .join("");

  return `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>El mapa dels 947 — Observatori municipal de quivoto</title>
<meta name="description" content="Els 947 municipis de Catalunya pintats per majoria absoluta, pactes, canvis d'alcaldia i alternança des del 1979.">
<link rel="canonical" href="${SITE}/observatori/mapa/">
<style>${RADIOGRAFIA_CSS}${MASCOTA_CSS}${CSS}</style>
</head>
<body>
<a class="salta" href="#contingut">Ves al contingut</a>
${capcalera("../", "mapa")}
${cercador("../")}

<main id="contingut">
  <section class="portada">
    <div class="presenta">${papereta(110, "felic")}<div>
      <p class="micro">Tot Catalunya</p>
      <h1>El mapa dels 947</h1>
    </div></div>
    <p class="entrada">Cada municipi és clicable i porta a la seva fitxa. Tria què vols veure-hi
    pintat: hi ha coses que en una llista de 947 files no es veuen mai.</p>
  </section>

  <ul class="tries" id="tries">${tries}</ul>

  <div class="mapa-marc">
    <h2 id="titol-capa">${escape(primera.titol)}</h2>
    <p class="entrada-bloc" id="peu-capa">${primera.peu}</p>
    <ul class="llegenda" id="llegenda"></ul>
    <svg class="mapa947" viewBox="${escape(geometria.viewBox)}" role="img" aria-labelledby="titol-capa">
      ${camins}
      ${geometria.contorn ? `<path class="contorn" d="${geometria.contorn}"/>` : ""}
    </svg>
    <div class="ullada-mapa" id="ullada" hidden aria-hidden="true"></div>
    <p class="nota" id="cobertura-capa"></p>
  </div>

  <section class="bloc fonts">
    <h2>D'on surt el mapa</h2>
    <p class="nota">Límits municipals de les
    <a href="${escape(geometria.fontUrl)}" target="_blank" rel="noopener">Divisions administratives</a>
    de l'${escape(geometria.font.replace(/^Divisions administratives de l'/, ""))},
    sota <a href="${escape(geometria.llicenciaUrl)}" target="_blank" rel="noopener">${escape(geometria.llicencia)}</a>,
    amb dades actualitzades el ${escape(geometria.actualitzat)}. Simplificats per pesar poc; per a
    qualsevol ús on la frontera exacta importi, cal anar a l'original.</p>
    <p class="nota"><b>Un mapa de municipis sobrerepresenta el buit.</b> El Pallars Sobirà hi ocupa
    molta més taca que el Barcelonès i hi viu una fracció de la gent. Per això aquí no hi ha cap
    indicador de diners per habitant: es llegiria com un mapa d'on hi ha muntanya.</p>
  </section>

  <section class="bloc anar">
    <h2>Segueix estirant</h2>
    <ul class="destins">
      <li><a href="../els947.html"><b>Els 947, en llista</b>
        <span>Amb cercador i filtres, per si busques un poble concret</span></a></li>
      <li><a href="../comparador/"><b>El comparador</b>
        <span>Fins a quatre municipis costat a costat amb la mateixa vara</span></a></li>
    </ul>
  </section>
</main>

<footer class="peu"><p>quivoto · Observatori municipal · generat el ${escape(generatedAt)}</p></footer>

<script>
var CAPES = ${JSON.stringify(
    capes.map((c) => ({ t: c.titol, p: c.peu.replace(/\s+/g, " ").trim(), g: c.graons, e: c.etiquetes, n: c.ambDada })),
  )};
var camins = document.querySelectorAll('.mapa947 a path');
function pinta(i) {
  var c = CAPES[i];
  for (var n = 0; n < camins.length; n++) {
    var g = c.g.charAt(n);
    camins[n].setAttribute('class', g === 'x' ? 'gnd' : 'g' + parseInt(g, 36));
  }
  document.querySelector('.mapa947').setAttribute('data-capa', i);
  document.getElementById('llegenda').setAttribute('data-capa', i);
  document.getElementById('titol-capa').textContent = c.t;
  document.getElementById('peu-capa').textContent = c.p;
  document.getElementById('llegenda').innerHTML =
    c.e.map(function (et, k) { return '<li><i class="g' + k + '"></i>' + et + '</li>'; }).join('') +
    (c.n < camins.length ? '<li><i class="gnd"></i>sense dada</li>' : '');
  document.getElementById('cobertura-capa').textContent =
    c.n + ' dels ' + camins.length + ' municipis tenen aquesta dada.';
  capaAra = i;
  var botons = document.querySelectorAll('#tries button');
  for (var b = 0; b < botons.length; b++) botons[b].setAttribute('aria-pressed', b === i ? 'true' : 'false');
}
/* La fitxa que surt en passar el ratolí per un municipi.
   El mapa és de 947 taques i cap no diu com es diu: el títol nadiu del
   navegador triga un segon llarg i no hi cap res més que el nom. Aquí hi va
   qui mana i quant hi viu, que és el que fa que passar-hi el ratolí valgui la
   pena. Amb el dit no s'hi mostra res: el toc obre la fitxa del poble, que és
   millor que qualsevol previsualització. */
var INFO = ${JSON.stringify(info)};
var ullada = document.getElementById('ullada');
var marc = document.querySelector('.mapa-marc');
var capaAra = 0;
function ensenya(i, x, y) {
  var d = INFO[i];
  if (!d) return;
  var c = CAPES[capaAra];
  var g = c.g.charAt(i);
  var quin = g === 'x' ? 'sense dada' : c.e[parseInt(g, 36)];
  ullada.innerHTML =
    '<b>' + d[0] + '</b>' +
    '<span class="hab">' + d[1].toLocaleString('ca-ES') + ' habitants</span>' +
    (d[2] ? '<span class="qui">' + (d[4] ? '<i style="background:' + d[4] + '"></i>' : '<i class="sense"></i>') + d[2] + (d[3] ? ' · ' + d[3] : '') + '</span>' : '') +
    '<span class="capa">' + quin + '</span>';
  var r = marc.getBoundingClientRect();
  ullada.hidden = false;
  var w = ullada.offsetWidth, h = ullada.offsetHeight;
  var px = x - r.left + 16, py = y - r.top + 16;
  if (px + w > r.width) px = x - r.left - w - 16;
  if (py + h > r.height) py = y - r.top - h - 16;
  ullada.style.left = Math.max(0, px) + 'px';
  ullada.style.top = Math.max(0, py) + 'px';
}
if (window.matchMedia('(hover: hover)').matches) {
  for (var q = 0; q < camins.length; q++) {
    (function (n) {
      var a = camins[n].parentNode;
      a.addEventListener('mousemove', function (e) { ensenya(n, e.clientX, e.clientY); });
      a.addEventListener('mouseleave', function () { ullada.hidden = true; });
      a.addEventListener('focus', function () {
        var b = camins[n].getBoundingClientRect();
        ensenya(n, b.left + b.width / 2, b.top + b.height / 2);
      });
      a.addEventListener('blur', function () { ullada.hidden = true; });
    })(q);
  }
}
document.getElementById('tries').addEventListener('click', function (e) {
  var b = e.target.closest('button');
  if (b) pinta(Number(b.dataset.capa));
});
pinta(0);
</script>
</body></html>`;
}
