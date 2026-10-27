import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { de } from "../lib/text";
import type { Els947Row } from "./els947";
import { geometria, type Geometria } from "./mapa";

/**
 * «Els teus veïns»: els municipis que toquen de terme, amb una xifra cadascun.
 *
 * La fitxa ja compara cada municipi amb els de la seva mida (`derive/peers.ts`),
 * que és la comparació justa per a l'estadística. Però la que la gent fa de
 * debò és una altra: «i a Sant Just, quant paguen?». És la idea de marca «el
 * veïnat» presa al peu de la lletra, i la idea 15 de `PROPOSTES-DISSENY.md`:
 * una filera de quatre a sis caseretes, cadascuna amb el nom del veí i una
 * xifra —deute per habitant, rebut de l'IBI o participació—, que porten a la
 * seva fitxa.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUI TOCA AMB QUI
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Es calcula a l'hora de generar el web, de la mateixa geometria que pinta el
 * mapa (`geo/municipis.json`, els límits de l'ICGC que deixa
 * `tools/geo_repara_icgc.py`). Aquella geometria no és TopoJSON —no hi ha arcs
 * compartits que es puguin comparar per índex— sinó un camí SVG per municipi;
 * però la simplificació que la va fer és **topològica**: la frontera entre dos
 * municipis es va simplificar una sola vegada i tots dos en porten els
 * mateixos punts, arrodonits als mateixos enters. Per això dos municipis són
 * veïns si i només si comparteixen **un segment** sencer (dos punts seguits
 * iguals a tots dos camins), sense cap tolerància.
 *
 * Un sol punt en comú no basta: a les cantonades on es troben quatre termes,
 * els que només s'hi toquen en diagonal no són veïns. I tampoc no cal
 * tolerància: comprovat sobre els 947, cap parella que comparteixi un punt
 * deixa de compartir també un segment, i l'únic municipi sense cap veí és
 * Llívia, que és un enclavament dins de França.
 *
 * Comprovat sobre el fitxer real (vegeu les proves): Barcelona toca amb onze
 * municipis —l'Hospitalet, Esplugues, Sant Just Desvern, Sant Feliu, Molins de
 * Rei, Sant Cugat, Cerdanyola, Montcada i Reixac, Santa Coloma, Sant Adrià i
 * el Prat (pel port i la Zona Franca)—, i no amb Badalona, que queda a l'altra
 * banda de Sant Adrià.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CAP RÀNQUING
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Les caseretes van per ordre alfabètic, no per la xifra: la filera ensenya
 * com estan els veïns, no qui guanya. Quan n'hi ha més de sis es mostren els
 * més poblats —que són els que la gent coneix i amb qui es compara— i es diu
 * quants en queden fora. Un veí sense la dada surt igualment, amb «no consta».
 */

// ─────────────────────────────────────────────────────────────────────────────
// La geometria: els segments de cada camí
// ─────────────────────────────────────────────────────────────────────────────

type Punt = readonly [number, number];

/**
 * Els anells d'un camí, com a llistes de punts absoluts.
 *
 * Els camins de «geo_repara_icgc.py» només fan servir M absoluta, l, h i v
 * relatives i Z (ho comprova també `capsaCami()` de `mapa.ts`); aquí s'hi
 * afegeixen les variants que podrien sortir si un dia el fitxer es regenerés
 * amb una altra eina (m, L, H, V), que no costen res. Les corbes no hi són i
 * no s'hi admeten: un segment corb no es pot comparar punt a punt.
 */
export function anellsDelCami(d: string): Punt[][] {
  const anells: Punt[][] = [];
  let actual: Punt[] | null = null;
  let x = 0;
  let y = 0;
  let iniciX = 0;
  let iniciY = 0;
  const afegeix = (): void => {
    actual!.push([x, y]);
  };
  for (const tros of d.match(/[MmLlHhVvZz][^MmLlHhVvZz]*/g) ?? []) {
    const ordre = tros[0]!;
    const n = (tros.slice(1).match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
    if (ordre === "M" || ordre === "m") {
      // Una M obre un anell nou; els parells que la segueixen són línies.
      for (let i = 0; i + 1 < n.length; i += 2) {
        const relatiu = ordre === "m";
        x = (relatiu ? x : 0) + n[i]!;
        y = (relatiu ? y : 0) + n[i + 1]!;
        if (i === 0) {
          actual = [];
          anells.push(actual);
          iniciX = x;
          iniciY = y;
        }
        afegeix();
      }
    } else if (actual === null) {
      continue;
    } else if (ordre === "L" || ordre === "l") {
      for (let i = 0; i + 1 < n.length; i += 2) {
        x = (ordre === "l" ? x : 0) + n[i]!;
        y = (ordre === "l" ? y : 0) + n[i + 1]!;
        afegeix();
      }
    } else if (ordre === "H" || ordre === "h") {
      for (const v of n) {
        x = (ordre === "h" ? x : 0) + v;
        afegeix();
      }
    } else if (ordre === "V" || ordre === "v") {
      for (const v of n) {
        y = (ordre === "v" ? y : 0) + v;
        afegeix();
      }
    } else {
      // Z: l'anell es tanca tornant al primer punt, i el punt actual hi torna.
      const darrer = actual[actual.length - 1]!;
      x = iniciX;
      y = iniciY;
      if (darrer[0] !== x || darrer[1] !== y) afegeix();
    }
  }
  return anells;
}

/** La clau d'un segment sense direcció: A→B i B→A són el mateix tros de frontera. */
function clauSegment(a: Punt, b: Punt): string {
  const [p, q] = a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]) ? [a, b] : [b, a];
  return `${p[0]},${p[1]};${q[0]},${q[1]}`;
}

/** Adjacència: per a cada municipi, els seus veïns per slug, per ordre alfabètic. */
export type Adjacencia = ReadonlyMap<string, readonly string[]>;

/**
 * Qui toca de terme amb qui, a partir dels camins de cada municipi.
 *
 * Cada segment de cada anell va a un índex per la seva clau sense direcció; un
 * segment que surt a dos camins (o més: passa en dos llocs on la geometria
 * simplificada fa tocar tres termes en un mateix tros) fa veïns tots els que
 * el porten. És lineal en el nombre de segments —uns 4.700 als 947— i no cal
 * cap índex espacial.
 *
 * Tot municipi de l'entrada surt al resultat, encara que sigui amb la llista
 * buida (Llívia), perquè qui consulta distingeixi «no té veïns» de «no el
 * conec».
 */
export function adjacenciaDeCamins(camins: Readonly<Record<string, string>>): Map<string, string[]> {
  const perSegment = new Map<string, Set<string>>();
  for (const [slug, cami] of Object.entries(camins)) {
    for (const anell of anellsDelCami(cami)) {
      for (let i = 1; i < anell.length; i++) {
        const a = anell[i - 1]!;
        const b = anell[i]!;
        if (a[0] === b[0] && a[1] === b[1]) continue;
        const clau = clauSegment(a, b);
        const qui = perSegment.get(clau) ?? new Set<string>();
        qui.add(slug);
        perSegment.set(clau, qui);
      }
    }
  }
  const veins = new Map<string, Set<string>>(Object.keys(camins).map((s) => [s, new Set<string>()]));
  for (const qui of perSegment.values()) {
    if (qui.size < 2) continue;
    for (const a of qui) for (const b of qui) if (a !== b) veins.get(a)!.add(b);
  }
  return new Map([...veins].sort(([a], [b]) => a.localeCompare(b)).map(([s, v]) => [s, [...v].sort((a, b) => a.localeCompare(b))]));
}

let adjacenciaDesada: Map<string, string[]> | null = null;

/**
 * L'adjacència dels 947, de la geometria del mapa. Es calcula un sol cop per
 * publicació (són uns quants mil·lisegons, però la criden 947 fitxes).
 */
export function adjacenciaMunicipal(geo: Pick<Geometria, "municipis"> = geometria): Adjacencia {
  if (geo !== geometria) return adjacenciaDeCamins(geo.municipis);
  adjacenciaDesada ??= adjacenciaDeCamins(geometria.municipis);
  return adjacenciaDesada;
}

/** El que escriu `escriuVeins()`: la font de la geometria i la llista de cada municipi. */
export type FitxerVeins = {
  font: string;
  fontUrl: string;
  llicencia: string;
  llicenciaUrl: string;
  /** La data de la geometria, no la de generació: l'adjacència només canvia quan canvien els límits. */
  actualitzat: string;
  metode: string;
  veins: Record<string, string[]>;
};

/**
 * Escriu l'adjacència com a JSON a `cami` (crea la carpeta si cal) i torna el
 * que ha escrit. Serveix perquè el cercador o qualsevol altra peça del costat
 * del navegador sàpiga els veïns sense tornar a llegir la geometria, i perquè
 * qui reutilitzi les dades obertes la tingui amb la seva font i llicència: la
 * geometria és de l'ICGC (CC BY 4.0) i l'adjacència n'és una obra derivada.
 *
 * Lloc recomanat: `web/public/observatori/dades/veins.json`, al costat de la
 * resta de fitxers oberts. El JSON no porta la data de generació perquè dues
 * publicacions amb la mateixa geometria escriguin exactament el mateix fitxer.
 */
export async function escriuVeins(cami: string, geo: Geometria = geometria): Promise<FitxerVeins> {
  const adjacencia = adjacenciaMunicipal(geo);
  const fitxer: FitxerVeins = {
    font: geo.font,
    fontUrl: geo.fontUrl,
    llicencia: geo.llicencia,
    llicenciaUrl: geo.llicenciaUrl,
    actualitzat: geo.actualitzat,
    metode:
      "Dos municipis són veïns si els seus límits comparteixen almenys un segment de la geometria simplificada topològicament; un sol punt en comú no compta.",
    veins: Object.fromEntries([...adjacencia].map(([s, v]) => [s, [...v]])),
  };
  await mkdir(dirname(cami), { recursive: true });
  await writeFile(cami, `${JSON.stringify(fitxer)}\n`, "utf8");
  return fitxer;
}

// ─────────────────────────────────────────────────────────────────────────────
// La xifra de cada veí
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Una de les xifres que poden anar a les caseretes. Totes ja són a la fila
 * d'`els947` de cada municipi (`Els947Row`), i per això l'indicador porta com
 * llegir-la d'allà: la fitxa no ha de tornar a anar a la base de dades per
 * saber el deute de Sant Just.
 */
export type IndicadorVeins = {
  id: string;
  /** El títol del bloc, escrit com una pregunta del veí. Rep el nom del municipi. */
  titol: (nom: string) => string;
  /** El que és la xifra, en minúscula: «deute per habitant». */
  etiqueta: string;
  format: (v: number) => string;
  /** D'on surt, per al peu del bloc. */
  font: string;
  /** L'any, quan és el mateix per a tots (la participació del 2023); si no, el porta cada veí. */
  any: number | null;
  /** Com es llegeix de la fila d'els947: `null` és «no consta», mai zero. */
  valor: (r: Els947Row) => number | null;
  anyDe?: (r: Els947Row) => number | null;
};

const enter = (v: number): string => Math.round(v).toLocaleString("ca-ES");
const unDecimal = (v: number): string => v.toLocaleString("ca-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * Les tres xifres que la proposta demana. El deute i l'IBI són de l'ajuntament
 * i la participació és del veïnat; cap de les tres no porta color ni
 * qualificatiu: més deute no és pitjor govern (pot ser una escola pagada a
 * terminis) i un IBI més alt pot ser un parc d'habitatge més car.
 */
export const INDICADORS_VEINS = {
  deute: {
    id: "deute",
    titol: (nom) => `Quant deuen els ajuntaments veïns ${de(nom)}`,
    etiqueta: "deute per habitant",
    format: (v) => `${enter(v)} €`,
    font: "Consorci AOC, deute viu a 31 de desembre de l'últim exercici liquidat, dividit pel padró",
    any: null,
    valor: (r) => r.d,
  },
  ibi: {
    id: "ibi",
    titol: (nom) => `Quant es paga d'IBI als municipis veïns ${de(nom)}`,
    etiqueta: "rebut mitjà de l'IBI",
    format: (v) => `${enter(v)} €`,
    font: "Idescat, rebut mitjà de l'IBI urbà",
    any: null,
    valor: (r) => r.ibi ?? null,
    anyDe: (r) => r.ibia ?? null,
  },
  participacio: {
    id: "participacio",
    titol: (nom) => `Quanta gent va votar als municipis veïns ${de(nom)}`,
    etiqueta: "participació a les municipals",
    format: (v) => `${unDecimal(v)} %`,
    font: "Generalitat de Catalunya, resultats oficials de les municipals",
    any: 2023,
    valor: (r) => r.pt ?? null,
  },
} satisfies Record<string, IndicadorVeins>;

/** Un veí a punt per a la casereta. */
export type VeiAmbXifra = { slug: string; nom: string; valor: number | null; any: number | null };

/** El que torna `veinsAmbXifra()`: els que es mostren, i quants en queden fora. */
export type SeleccioVeins = { veins: VeiAmbXifra[]; total: number; fora: number };

/**
 * Els veïns d'un municipi amb la xifra de l'indicador, a partir de
 * l'adjacència i les files d'els947.
 *
 * Si en té més de `maxim`, es queda els més poblats (és una tria per qui
 * coneix la gent, no per la xifra) i els torna per ordre alfabètic. Un veí que
 * no és a les files —no hauria de passar, les dues llistes són els 947— no
 * s'inventa: es deixa fora i compta a `fora`.
 */
export function veinsAmbXifra(
  slug: string,
  adjacencia: Adjacencia,
  files: readonly Els947Row[],
  indicador: IndicadorVeins,
  maxim = 6,
): SeleccioVeins {
  const perSlug = new Map(files.map((r) => [r.s, r]));
  const tots = (adjacencia.get(slug) ?? []).map((s) => perSlug.get(s)).filter((r): r is Els947Row => r !== undefined);
  const triats = [...tots].sort((a, b) => b.p - a.p || a.n.localeCompare(b.n, "ca")).slice(0, maxim);
  const veins = triats
    .sort((a, b) => a.n.localeCompare(b.n, "ca"))
    .map((r) => ({ slug: r.s, nom: r.n, valor: indicador.valor(r), any: indicador.anyDe?.(r) ?? indicador.any }));
  const total = (adjacencia.get(slug) ?? []).length;
  return { veins, total, fora: total - veins.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// Les caseretes
// ─────────────────────────────────────────────────────────────────────────────

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** «A Vic», «Al Prat de Llobregat», «Als Hostalets de Pierola», «A l'Hospitalet»: la contracció de «a» amb l'article. */
export function aMunicipi(nom: string): string {
  if (/^els\s/i.test(nom)) return `Als ${nom.slice(4)}`;
  if (/^el\s/i.test(nom)) return `Al ${nom.slice(3)}`;
  return `A ${nom}`;
}

/** El municipi de la fitxa. Si porta `valor`, la seva xifra va a l'entrada, no a cap casereta. */
export type MunicipiVeins = { slug: string; nom: string; valor?: number | null; any?: number | null };

export type OpcionsVeins = {
  /** Quants veïns té en total, quan no es mostren tots (`SeleccioVeins.total`). */
  total?: number;
};

/** La teulada: un triangle que s'estira a l'amplada de la casa sense engruixir la ratlla. */
const TEULADA = `<svg class="vn-teulada" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M1.5 29 L50 2 L98.5 29 Z" vector-effect="non-scaling-stroke"/></svg>`;

function casereta(v: VeiAmbXifra, indicador: IndicadorVeins): string {
  const xifra =
    v.valor === null
      ? `<span class="vn-xifra vn-buit">no consta</span>`
      : `<span class="vn-xifra">${escape(indicador.format(v.valor))}</span>`;
  // L'any només es diu a la casa quan no és el de tothom: si l'indicador ja en
  // porta un de comú, va al peu del bloc i no cal repetir-lo sis vegades.
  const any = v.valor !== null && v.any !== null && v.any !== indicador.any ? `<span class="vn-any">${v.any}</span>` : "";
  return `<li class="vn-casa"><a href="../${encodeURIComponent(v.slug)}/">${TEULADA}<span class="vn-cos"><span class="vn-nom">${escape(v.nom)}</span><span class="nomes-lectors">, ${escape(indicador.etiqueta)}: </span>${xifra}${any}</span></a></li>`;
}

/**
 * El bloc «Els teus veïns»: un títol en forma de pregunta, una frase que diu
 * amb quants municipis toca de terme (i quants n'hi ha a la filera, si no hi
 * són tots), la filera de caseretes i la font.
 *
 * Les adreces són `../<slug>/`, relatives a la fitxa `m/<slug>/`. Torna una
 * cadena buida quan el municipi no té cap veí (Llívia): el bloc no té res a
 * dir i la fitxa no ha d'ensenyar una filera buida.
 *
 * @param municipi El de la fitxa; si porta `valor`, l'entrada diu la seva xifra
 *   perquè el lector tingui contra què comparar.
 * @param veins Els que van a la filera, ja triats i ordenats (`veinsAmbXifra`).
 * @param indicador Una de les `INDICADORS_VEINS`, o una altra amb la mateixa forma.
 */
export function renderVeins(
  municipi: MunicipiVeins,
  veins: readonly VeiAmbXifra[],
  indicador: IndicadorVeins,
  opcions: OpcionsVeins = {},
): string {
  if (veins.length === 0) return "";
  const total = Math.max(opcions.total ?? veins.length, veins.length);
  const nom = escape(municipi.nom);
  const quants = total === 1 ? "amb un sol municipi" : `amb ${total} municipis`;
  const tria = total > veins.length ? ` Aquí hi ha els ${veins.length} més poblats, per ordre alfabètic.` : "";
  const propi =
    municipi.valor === undefined
      ? ""
      : ` ${escape(aMunicipi(municipi.nom))}, ${municipi.valor === null ? "no consta" : escape(indicador.format(municipi.valor))}.`;
  const anyComu = indicador.any !== null ? ` (${indicador.any})` : "";
  const idTitol = `vn-${escape(indicador.id)}`;
  return `<section class="vn" aria-labelledby="${idTitol}">
  <h3 class="vn-titol" id="${idTitol}">${escape(indicador.titol(municipi.nom))}</h3>
  <p class="vn-entrada">${nom.charAt(0).toUpperCase()}${nom.slice(1)} toca de terme ${quants}.${tria}${propi}</p>
  <ul class="vn-fila">${veins.map((v) => casereta(v, indicador)).join("")}</ul>
  <p class="vn-font">Font: ${escape(indicador.font)}${anyComu}. Els veïns són els municipis que comparteixen límit, segons la geometria de l'ICGC.</p>
</section>`;
}

/**
 * L'estil de les caseretes, amb els tokens de la casa i el prefix `vn-`. La
 * teulada és de préssec per a tothom: un color diferent per casa semblaria
 * voler dir alguna cosa, i no en diu cap.
 */
export const VEINS_CSS = `
.vn{margin:var(--e3) 0 0}
.vn-titol{font-family:var(--display);font-size:1.2rem;line-height:1.2;margin:0 0 var(--e1)}
.vn-entrada{margin:0 0 var(--e2);color:var(--ink-suau)}
.vn-fila{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:var(--e2) 12px}
.vn-casa a{display:flex;flex-direction:column;height:100%;color:var(--ink);text-decoration:none;border-radius:var(--r-s)}
.vn-teulada{display:block;width:100%;height:22px;margin-bottom:-2px}
.vn-teulada path{fill:var(--presec);stroke:var(--ink);stroke-width:2px;stroke-linejoin:round}
.vn-cos{flex:1;display:flex;flex-direction:column;gap:2px;padding:8px 10px 10px;background:var(--paper-2);
  border:2px solid var(--ink);border-top-width:0;border-radius:0 0 var(--r-s) var(--r-s)}
.vn-nom{font-weight:800;font-size:.86rem;line-height:1.2;overflow-wrap:anywhere}
.vn-xifra{font-family:var(--display);font-weight:800;font-size:1.15rem;font-variant-numeric:tabular-nums}
.vn-buit{font-family:var(--text);font-size:.86rem;font-weight:700;color:var(--ink-suau)}
.vn-any{font-size:.72rem;font-weight:700;color:var(--ink-suau)}
.vn-casa a:hover .vn-nom{text-decoration:underline;text-underline-offset:3px}
.vn-casa a:focus-visible{outline:3px solid var(--coral-text);outline-offset:3px}
.vn-font{margin:var(--e2) 0 0;font-size:.78rem;color:var(--ink-suau)}
@media (prefers-reduced-motion:no-preference){
  .vn-casa a{transition:transform .15s ease}
  .vn-casa a:hover{transform:translateY(-2px)}
}
`;
