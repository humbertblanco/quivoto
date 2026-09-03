import {
  ELECCIONS_MUNICIPALS,
  URL_CONJUNT,
  type CensElectoralMetric,
  type EleccioCens,
} from "../jobs/j36-cens-electoral";
import { primers, type Curiositat, type FilaCuriosa, type FilaCuriositat } from "./curiositats";
import { ambSigne, atributsEtiqueta, marquesEix, textEtiqueta, type DadaEtiqueta } from "./grafics";

/**
 * «El cens i la participació des del 1979»: el bloc de la fitxa amb les
 * dotze municipals, i les curiositats que en surten per als 947.
 *
 * Tres decisions de forma, heretades de la resta de la fitxa:
 *
 *   · **Dos dibuixos, no un de dos eixos.** El cens són persones i la
 *     participació és un tant per cent: posar-los al mateix dibuix amb una
 *     escala a cada banda obliga a llegir dues escales alhora i fa que una
 *     pujada de l'un sembli la de l'altre. Van un sota l'altre, amb els
 *     mateixos dotze llocs a l'eix, i cada punt porta l'etiqueta de la casa
 *     (`GRAFICS_JS`) amb el cens, els votants, la participació, la diferència
 *     amb l'elecció anterior i la mediana dels de la seva mida.
 *   · **Un buit es dibuixa.** Les dotze eleccions hi són sempre a l'eix; la
 *     que no té dada surt com un cercle buit i una columna puntejada, com als
 *     altres gràfics, i el text ho diu: un municipi que no existia el 1979 no
 *     tenia zero electors.
 *   · **Cap veredicte.** Que el cens creixi és demografia i que la
 *     participació pugi o baixi depèn de la mida i de la disputa. Es diu la
 *     xifra, l'any, la font i amb qui es compara, i que jutgi qui llegeix.
 *
 * Les classes van totes amb el prefix `cens-`: una classe nua com `.marca` o
 * `.xifres li` xoca amb el peu i amb les tessel·les.
 */

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const enter = (n: number): string => n.toLocaleString("ca-ES", { maximumFractionDigits: 0 });
const decimal = (n: number): string =>
  n.toLocaleString("ca-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const percent = (n: number): string => `${decimal(n)}&nbsp;%`;
const n2 = (n: number): string => (Math.round(n * 100) / 100).toString();

/** «ha crescut un 12,3 %», «ha minvat un 25,1 %», «no s'ha mogut». */
function creixementEscrit(pct: number | null): string {
  if (pct === null) return "";
  if (pct === 0) return "no s'ha mogut";
  return `${pct > 0 ? "ha crescut" : "ha minvat"} un ${decimal(Math.abs(pct))}&nbsp;%`;
}

/**
 * «El 2023 el cens electoral era de 1.109.116 persones i hi van votar
 * 672.053, el 60,6 %. Des del 1979 el cens ha minvat un 25,1 %: el màxim va
 * ser el del 1979 i el mínim el del 2023. La participació més alta va ser la
 * del 1987 (68,9 %) i la més baixa la del 2007 (49,6 %).»
 */
export function fraseObertura(dades: CensElectoralMetric): string {
  const r = dades.resum;
  let frase = `El ${r.darrera.any} el cens electoral era de <b>${enter(r.darrera.cens)}</b> persones i hi van votar ` +
    `${enter(r.darrera.votants)}, <b>el ${percent(r.darrera.participacio)}</b>.`;
  if (r.creixementCens !== null) {
    frase += ` Des del ${r.primera.any} el cens ${creixementEscrit(r.creixementCens)}`;
    frase += r.censMaxim.any === r.censMinim.any
      ? "."
      : `: el màxim va ser el del ${r.censMaxim.any} (${enter(r.censMaxim.cens)}) i el mínim el del ${r.censMinim.any} (${enter(r.censMinim.cens)}).`;
  }
  if (r.eleccionsAmbDada >= 2 && r.participacioMaxima.any !== r.participacioMinima.any) {
    frase += ` La participació més alta va ser la del ${r.participacioMaxima.any} (${percent(r.participacioMaxima.participacio)}) ` +
      `i la més baixa la del ${r.participacioMinima.any} (${percent(r.participacioMinima.participacio)}).`;
  }
  return `<p class="entrada-bloc">${frase}</p>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Els dos dibuixos
// ─────────────────────────────────────────────────────────────────────────────

const AMPLE = 720;
const ALT = 220;
const MARGE = { dalt: 16, dreta: 14, baix: 30, esquerra: 66 } as const;
const TERRA = ALT - MARGE.baix;

/** La nota que porta cada punt: la font, tal com mana el portal, i quan s'ha consultat. */
const notaFont = (dades: CensElectoralMetric): string =>
  `Generalitat de Catalunya, processos electorals, consultat el ${dades.font.consultat}`;

/**
 * L'etiqueta d'un punt, la mateixa per als dos dibuixos: la xifra principal
 * canvia (cens o participació) i els extres són sempre els mateixos, perquè
 * qui toca la barra del cens també vol saber quanta gent hi va anar.
 */
export function etiquetaEleccio(
  dades: CensElectoralMetric,
  e: EleccioCens,
  anterior: EleccioCens | null,
  mena: "cens" | "participacio",
): DadaEtiqueta {
  const mediana = dades.comparacio?.participacio[e.id] ?? null;
  const extres: { etq: string; valor: string }[] = [];
  if (mena === "cens") {
    extres.push({ etq: "votants", valor: enter(e.votants) }, { etq: "participació", valor: `${decimal(e.participacio)} %` });
  } else {
    extres.push({ etq: "cens", valor: enter(e.cens) }, { etq: "votants", valor: enter(e.votants) });
  }
  if (anterior) {
    const dif = e.cens - anterior.cens;
    const pct = anterior.cens > 0 ? (100 * dif) / anterior.cens : null;
    extres.push({
      etq: `cens respecte al ${anterior.any}`,
      valor: `${ambSigne(enter, dif)}${pct === null ? "" : ` (${ambSigne(decimal, Math.round(pct * 10) / 10)} %)`}`,
    });
    extres.push({
      etq: `participació respecte al ${anterior.any}`,
      valor: `${ambSigne(decimal, Math.round((e.participacio - anterior.participacio) * 10) / 10)} punts`,
    });
  }
  if (mediana) {
    extres.push({ etq: `mediana dels ${mediana.quants} de la seva mida`, valor: `${decimal(mediana.mediana)} %` });
  }
  return {
    nom: mena === "cens" ? "Cens electoral" : "Participació",
    any: e.any,
    valor: mena === "cens" ? `${enter(e.cens)} electors` : `${decimal(e.participacio)} %`,
    extres,
    nota: notaFont(dades),
  };
}

/** L'etiqueta d'una elecció sense dada: diu que no n'hi ha, i per què pot ser. */
function etiquetaBuit(any: number, mena: "cens" | "participacio"): DadaEtiqueta {
  return {
    nom: mena === "cens" ? "Cens electoral" : "Participació",
    any,
    valor: "sense dada",
    nota: "un buit no és un zero: el municipi pot no existir encara, o la font no publica l'elecció",
  };
}

/** La posició d'un dels dotze llocs de l'eix, del 1979 al 2023. */
const xDe = (index: number): number =>
  MARGE.esquerra + ((index + 0.5) / ELECCIONS_MUNICIPALS.length) * (AMPLE - MARGE.esquerra - MARGE.dreta);
const AMPLE_LLOC = (AMPLE - MARGE.esquerra - MARGE.dreta) / ELECCIONS_MUNICIPALS.length;

/** L'eix de baix, amb les dotze eleccions; a la mitjana només s'escriuen la meitat dels anys. */
function eixAnys(): string {
  return ELECCIONS_MUNICIPALS.map((e, i) => {
    const x = n2(xDe(i));
    const marca = `<line class="marca-any" x1="${x}" x2="${x}" y1="${TERRA}" y2="${TERRA + 5}"/>`;
    if (i % 2 === 1) return marca;
    return `${marca}<text class="etiqueta-eix" x="${x}" y="${TERRA + 19}" text-anchor="middle">${e.any}</text>`;
  }).join("");
}

/** Un punt que es pot tocar: el grup amb els `data-*`, el `<title>` i la banda de tacte. */
function punt(etiqueta: DadaEtiqueta, index: number, contingut: string, classe: string): string {
  const esquerra = xDe(index) - AMPLE_LLOC / 2;
  return `<g class="punt ${classe}" tabindex="0"${atributsEtiqueta(etiqueta)}><title>${escape(textEtiqueta(etiqueta))}</title>
    <rect class="toc" x="${n2(esquerra)}" y="${MARGE.dalt}" width="${n2(AMPLE_LLOC)}" height="${TERRA - MARGE.dalt}"/>${contingut}</g>`;
}

/** El forat d'una elecció sense dada: la columna puntejada i el cercle buit dels altres gràfics. */
function forat(index: number): string {
  const x = n2(xDe(index));
  return `<line class="buit" x1="${x}" x2="${x}" y1="${MARGE.dalt}" y2="${TERRA}"/>
    <circle class="forat" cx="${x}" cy="${n2((MARGE.dalt + TERRA) / 2)}" r="4"/>`;
}

/** El dibuix del cens: una barra per elecció, la darrera de coral, i l'eix des de zero. */
export function graficCens(dades: CensElectoralMetric): string {
  const perId = new Map(dades.eleccions.map((e) => [e.id, e]));
  const max = Math.max(...dades.eleccions.map((e) => e.cens)) * 1.08 || 1;
  const y = (valor: number): number => TERRA - (valor / max) * (TERRA - MARGE.dalt);
  const graella = marquesEix(0, max, 4)
    .filter((v) => v > 0)
    .map((v) => `<line class="graella" x1="${MARGE.esquerra}" x2="${AMPLE - MARGE.dreta}" y1="${n2(y(v))}" y2="${n2(y(v))}"/>` +
      `<text class="etiqueta-eix" x="${MARGE.esquerra - 8}" y="${n2(y(v) + 4)}" text-anchor="end">${enter(v)}</text>`)
    .join("");
  const ultim = dades.eleccions[dades.eleccions.length - 1] ?? null;
  let anterior: EleccioCens | null = null;
  const barres = ELECCIONS_MUNICIPALS.map((eleccio, i) => {
    const e = perId.get(eleccio.id);
    if (!e) return punt(etiquetaBuit(eleccio.any, "cens"), i, forat(i), "cens-punt cens-sense");
    const ample = AMPLE_LLOC * 0.62;
    const barra = `<rect class="cens-barra${e === ultim ? " ara" : ""}" x="${n2(xDe(i) - ample / 2)}" y="${n2(y(e.cens))}" width="${n2(ample)}" height="${n2(TERRA - y(e.cens))}" rx="2"/>`;
    const html = punt(etiquetaEleccio(dades, e, anterior, "cens"), i, barra, "cens-punt");
    anterior = e;
    return html;
  }).join("");
  const r = dades.resum;
  const resum = `Cens electoral: de ${enter(r.primera.cens)} el ${r.primera.any} a ${enter(r.darrera.cens)} el ${r.darrera.any}.` +
    (dades.buits.length ? ` ${dades.buits.length === 1 ? "D'una elecció" : `De ${dades.buits.length} eleccions`} no en consta cap xifra.` : "");
  return `<figure class="grafic cens-grafic" role="img" aria-label="${escape(resum)}">
  <figcaption class="cens-titol">El cens electoral, elecció a elecció</figcaption>
  <svg viewBox="0 0 ${AMPLE} ${ALT}" xmlns="http://www.w3.org/2000/svg">${graella}
  <line class="eix" x1="${MARGE.esquerra}" x2="${AMPLE - MARGE.dreta}" y1="${TERRA}" y2="${TERRA}"/>${eixAnys()}${barres}</svg>
</figure>`;
}

/**
 * El dibuix de la participació: una línia de 0 a 100 partida on falta una
 * elecció, i la mediana dels de la seva mida en discontínua quan n'hi ha
 * prou eleccions per traçar-la. L'escala és sempre de 0 a 100: és l'única
 * manera que el 60 % d'un poble i el 60 % d'una ciutat siguin a la mateixa
 * alçada a totes les fitxes.
 */
export function graficParticipacio(dades: CensElectoralMetric): string {
  const perId = new Map(dades.eleccions.map((e) => [e.id, e]));
  const y = (pct: number): number => TERRA - (Math.max(0, Math.min(100, pct)) / 100) * (TERRA - MARGE.dalt);
  const graella = [25, 50, 75, 100]
    .map((v) => `<line class="graella" x1="${MARGE.esquerra}" x2="${AMPLE - MARGE.dreta}" y1="${n2(y(v))}" y2="${n2(y(v))}"/>` +
      `<text class="etiqueta-eix" x="${MARGE.esquerra - 8}" y="${n2(y(v) + 4)}" text-anchor="end">${v}&#160;%</text>`)
    .join("");

  // La línia: un tram nou cada cop que hi ha un buit entremig.
  const trams: string[][] = [];
  let obert = false;
  ELECCIONS_MUNICIPALS.forEach((eleccio, i) => {
    const e = perId.get(eleccio.id);
    if (!e) { obert = false; return; }
    const coord = `${n2(xDe(i))} ${n2(y(e.participacio))}`;
    if (obert) trams[trams.length - 1]!.push(coord);
    else { trams.push([coord]); obert = true; }
  });
  const linia = trams.filter((t) => t.length >= 2).map((t) => `M${t.join(" L")}`).join(" ");

  // La mediana del grup, només amb les eleccions que en tenen i sense saltar buits.
  const medianes = ELECCIONS_MUNICIPALS.map((eleccio, i) => {
    const m = dades.comparacio?.participacio[eleccio.id];
    return m ? `${n2(xDe(i))} ${n2(y(m.mediana))}` : null;
  });
  const tramsMediana: string[][] = [];
  for (const c of medianes) {
    if (!c) { tramsMediana.push([]); continue; }
    if (tramsMediana.length === 0) tramsMediana.push([]);
    tramsMediana[tramsMediana.length - 1]!.push(c);
  }
  const mediana = tramsMediana.filter((t) => t.length >= 2).map((t) => `M${t.join(" L")}`).join(" ");

  const ultim = dades.eleccions[dades.eleccions.length - 1] ?? null;
  let anterior: EleccioCens | null = null;
  const nusos = ELECCIONS_MUNICIPALS.map((eleccio, i) => {
    const e = perId.get(eleccio.id);
    if (!e) return punt(etiquetaBuit(eleccio.any, "participacio"), i, forat(i), "cens-punt cens-sense");
    const nus = `<circle class="nus${e === ultim ? " ara" : ""}" cx="${n2(xDe(i))}" cy="${n2(y(e.participacio))}" r="${e === ultim ? 5.5 : 4}"/>`;
    const html = punt(etiquetaEleccio(dades, e, anterior, "participacio"), i, nus, "cens-punt");
    anterior = e;
    return html;
  }).join("");
  const r = dades.resum;
  const resum = `Participació: de ${decimal(dades.eleccions[0]!.participacio)} % el ${r.primera.any} a ${decimal(r.darrera.participacio)} % el ${r.darrera.any}.`;
  const clau = mediana
    ? `<p class="clau-grafic cens-clau"><span class="mostra mostra-linia"></span> aquest municipi
  <span class="mostra mostra-mediana"></span> mediana dels ${escape(dades.comparacio!.grup.etiqueta)}${dades.buits.length ? `
  <span class="mostra mostra-forat"></span> elecció sense dada` : ""}</p>`
    : "";
  return `<figure class="grafic cens-grafic" role="img" aria-label="${escape(resum)}">
  <figcaption class="cens-titol">La participació, en percentatge del cens</figcaption>
  <svg viewBox="0 0 ${AMPLE} ${ALT}" xmlns="http://www.w3.org/2000/svg">${graella}
  <line class="eix" x1="${MARGE.esquerra}" x2="${AMPLE - MARGE.dreta}" y1="${TERRA}" y2="${TERRA}"/>${eixAnys()}${
    mediana ? `<path class="mediana-grup" d="${mediana}"/>` : ""
  }${linia ? `<path class="linia" d="${linia}"/>` : ""}${nusos}</svg>
  ${clau}
</figure>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// La taula, el peu i el bloc
// ─────────────────────────────────────────────────────────────────────────────

/** Les xifres elecció a elecció, plegades: el dibuix ja les diu; la taula és per a qui les vol copiar. */
function taulaEleccions(dades: CensElectoralMetric): string {
  const perId = new Map(dades.eleccions.map((e) => [e.id, e]));
  const files = ELECCIONS_MUNICIPALS.map((eleccio) => {
    const e = perId.get(eleccio.id);
    if (!e) {
      return `<tr class="cens-fila-buida"><th scope="row">${eleccio.any}</th><td colspan="5">sense dada</td></tr>`;
    }
    const m = dades.comparacio?.participacio[e.id];
    return `<tr><th scope="row">${e.any}</th><td>${enter(e.cens)}</td><td>${enter(e.votants)}</td>` +
      `<td>${percent(e.participacio)}</td><td>${m ? percent(m.mediana) : "—"}</td>` +
      `<td>${e.blancs === null ? "—" : enter(e.blancs)}</td></tr>`;
  }).join("");
  return `<details class="cens-detall"><summary>Les xifres, elecció a elecció</summary>
  <div class="taula-envolta"><table class="balanc cens-taula">
  <thead><tr><th>Elecció</th><th>Cens</th><th>Votants</th><th>Participació</th><th>Mediana dels de la seva mida</th><th>En blanc</th></tr></thead>
  <tbody>${files}</tbody>
  </table></div></details>`;
}

/** El peu amb la font, la llicència, la data de consulta i amb qui es compara. */
function peuFont(dades: CensElectoralMetric): string {
  const grup = dades.comparacio
    ? ` La mediana és la dels municipis ${escape(dades.comparacio.grup.etiqueta)} segons el padró d'avui, també a les eleccions antigues, i només amb els que tenen la dada.`
    : "";
  return `<p class="peu-nota">Font: <a href="${escape(dades.font.url)}" rel="noopener nofollow">${escape(dades.font.nom)}</a>,
  ${escape(dades.font.organisme)}, ${ELECCIONS_MUNICIPALS[0]!.any}-${ELECCIONS_MUNICIPALS[ELECCIONS_MUNICIPALS.length - 1]!.any},
  consultat el ${escape(dades.font.consultat)}. La participació és votants sobre cens, calculada aquí.${grup}</p>`;
}

/**
 * El contingut del bloc, sense la secció que l'embolcalla: és el que va a la
 * llista de blocs de la fitxa (`id`, `titol`, `html`) de radiografia.ts.
 * Mai retorna cadena buida: si no hi ha cap elecció amb dada, ho diu.
 */
export function renderCensBloc(dades: CensElectoralMetric | null): string {
  if (!dades || dades.eleccions.length === 0) {
    return `<p class="entrada-bloc">La Generalitat no publica el cens ni la participació d'aquest municipi a cap de les
  dotze eleccions municipals des del 1979, i sense la xifra no hi ha res a dibuixar: un buit no és un zero.</p>
  <p class="peu-nota">Font consultada: <a href="${URL_CONJUNT}" rel="noopener nofollow">Generalitat de Catalunya,
  processos electorals, participació</a>.</p>`;
  }
  const buits = dades.buits.length
    ? `<p class="nota">${dades.buits.length === 1 ? "Hi ha una elecció" : `Hi ha ${dades.buits.length} eleccions`} sense dada
  (${dades.buits.map((id) => ELECCIONS_MUNICIPALS.find((e) => e.id === id)?.any ?? id).join(", ")}). ${escape(dades.nota)}</p>`
    : "";
  return `${fraseObertura(dades)}
  ${graficCens(dades)}
  ${graficParticipacio(dades)}
  ${buits}
  ${taulaEleccions(dades)}
  <p class="nota"><b>Què hi decideix l'ajuntament.</b> ${escape(dades.context.nota)}</p>
  ${peuFont(dades)}`;
}

/** El bloc sencer com a secció de la fitxa, amb el títol. */
export function renderCens(dades: CensElectoralMetric | null): string {
  return `<section class="bloc" id="cens">
  <h2>El cens i la participació des del 1979</h2>
  ${renderCensBloc(dades)}
</section>`;
}

/**
 * L'estil propi del bloc. Les línies, els nusos, la graella i els forats
 * són els de `GRAFICS_CSS` (classe `grafic`); aquí només hi ha el que no hi
 * és: la barra del cens, el títol de cada dibuix i la fila buida de la taula.
 */
export const CENS_FITXA_CSS = `
.cens-grafic{margin:var(--e2) 0 0}
.cens-grafic + .cens-grafic{margin-top:var(--e1)}
.cens-titol{font-family:var(--display);font-weight:900;font-size:.8rem;letter-spacing:.03em;
  text-transform:uppercase;color:var(--ink-suau);margin:0 0 4px}
.cens-grafic .cens-barra{fill:var(--lavanda);stroke:var(--ink);stroke-width:1.5}
.cens-grafic .cens-barra.ara{fill:var(--coral)}
.cens-grafic .cens-punt:hover .cens-barra,.cens-grafic .cens-punt:focus-visible .cens-barra{stroke:var(--coral-text);stroke-width:3}
.cens-grafic .cens-sense:hover .forat,.cens-grafic .cens-sense:focus-visible .forat{stroke:var(--coral-text);stroke-width:2.5}
.cens-detall{margin:var(--e1) 0 0}
.cens-detall summary{cursor:pointer;font-weight:700}
.cens-taula td{font-variant-numeric:tabular-nums;text-align:right}
.cens-taula .cens-fila-buida td{text-align:left;color:var(--ink-suau);font-style:italic}
`;

// ------------------------------------------------------------ curiositats

/**
 * La fila dels 947 amb el que aquestes curiositats necessiten, amb els
 * mateixos noms que a `Els947Row`: el cens del 1979 i el de la darrera
 * elecció, el creixement entre tots dos, l'any de la primera elecció amb
 * dada, i la participació màxima i mínima amb el seu any. `null` o «no hi
 * és» volen dir el mateix: absència.
 */
export type FilaCens = FilaCuriositat & {
  cens79?: number | null; censUlt?: number | null; creixCens?: number | null; censDes?: number | null;
  partMax?: number | null; partMaxA?: number | null; partMin?: number | null; partMinA?: number | null;
};

const municipi = (f: FilaCens): FilaCuriosa["municipi"] => ({ s: f.s, n: f.n, c: f.c });
const esNombre = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Les tres curiositats del cens: on més ha crescut i on més ha minvat des
 * del 1979, la participació més alta i la més baixa mai registrades, i els
 * municipis que no van votar el 1979 perquè encara no existien. Al format
 * de `curiositats.ts`: cada fet diu sobre quants municipis s'ha mirat, i
 * sense cap dada no surt res.
 */
export function curiositatsCens(files: readonly FilaCens[]): Curiositat[] {
  const total = files.length;
  const font = "Generalitat de Catalunya · processos electorals, participació";
  const periode = `${ELECCIONS_MUNICIPALS[0]!.any}-${ELECCIONS_MUNICIPALS[ELECCIONS_MUNICIPALS.length - 1]!.any}`;
  const fets: Curiositat[] = [];

  // ---- el cens que més ha crescut i el que més ha minvat -----------------
  const ambCreix = files.filter(
    (f): f is FilaCens & { cens79: number; censUlt: number; creixCens: number } =>
      f.censDes === 1979 && esNombre(f.cens79) && esNombre(f.censUlt) && esNombre(f.creixCens),
  );
  if (ambCreix.length > 0) {
    const filaDe = (f: (typeof ambCreix)[number]): FilaCuriosa => ({
      municipi: municipi(f),
      valor: `${ambSigne(decimal, f.creixCens)} %`,
      detall: `de ${enter(f.cens79)} a ${enter(f.censUlt)} electors`,
    });
    const mes = primers(ambCreix, (f) => f.creixCens, (f) => f.n, 10, "max");
    const menys = primers(ambCreix, (f) => f.creixCens, (f) => f.n, 10, "min");
    fets.push({
      id: "cens-creixement",
      titol: "On el cens ha crescut més des del 1979, i on ha minvat més",
      metode: "El cens electoral de les municipals del 2023 respecte del de les del 1979, en percentatge, només als municipis amb dada de totes dues.",
      periode,
      font,
      llistes: [
        { cap: "Els que més han crescut", files: mes.files.map(filaDe), empatats: mes.empatats },
        { cap: "Els que més han minvat", files: menys.files.map(filaDe), empatats: menys.empatats },
      ],
      cobertura: `S'ha mirat el cens de ${enter(ambCreix.length)} municipis${ambCreix.length < total ? ` dels ${enter(total)}` : ""} amb dada del 1979 i del 2023.`,
      cautela: "El cens creix amb la gent que arriba i fa divuit anys, i minva amb la que marxa o mor: és demografia, no gestió. A les urbanitzacions que es van omplir als anys vuitanta el cens s'ha multiplicat, i als pobles petits pocs centenars d'electors mouen molt el percentatge.",
    });
  }

  // ---- la participació més alta i la més baixa mai registrades ------------
  const ambPart = files.filter(
    (f): f is FilaCens & { partMax: number; partMaxA: number; partMin: number; partMinA: number } =>
      esNombre(f.partMax) && esNombre(f.partMaxA) && esNombre(f.partMin) && esNombre(f.partMinA),
  );
  if (ambPart.length > 0) {
    const altes = primers(ambPart, (f) => f.partMax, (f) => f.n, 10, "max");
    const baixes = primers(ambPart, (f) => f.partMin, (f) => f.n, 10, "min");
    fets.push({
      id: "participacio-extrems",
      titol: "La participació més alta i la més baixa mai registrades",
      metode: "De cada municipi, la participació més alta i la més baixa de les dotze municipals des del 1979; s'ordenen els màxims i els mínims.",
      periode,
      font,
      llistes: [
        {
          cap: "Les participacions més altes",
          files: altes.files.map((f) => ({ municipi: municipi(f), valor: `${decimal(f.partMax)} %`, detall: `el ${f.partMaxA} · ${enter(f.p)} habitants avui` })),
          empatats: altes.empatats,
        },
        {
          cap: "Les més baixes",
          files: baixes.files.map((f) => ({ municipi: municipi(f), valor: `${decimal(f.partMin)} %`, detall: `el ${f.partMinA} · ${enter(f.p)} habitants avui` })),
          empatats: baixes.empatats,
        },
      ],
      cobertura: `S'ha mirat la participació de ${enter(ambPart.length)} municipis${ambPart.length < total ? ` dels ${enter(total)}` : ""} a totes les municipals amb dada.`,
      cautela: "Als pobles de menys de cent electors la participació arriba al cent per cent amb quatre persones, i una sola elecció disputada la dispara: la xifra diu més de la mida del municipi que de res que hagi decidit ningú.",
    });
  }

  // ---- els que no van votar el 1979 ----------------------------------------
  const posteriors = files.filter((f): f is FilaCens & { censDes: number } => esNombre(f.censDes) && f.censDes > 1979);
  if (posteriors.length > 0) {
    const { files: primeres, empatats } = primers(posteriors, (f) => f.censDes, (f) => f.n, 12, "min");
    fets.push({
      id: "municipis-posteriors-1979",
      titol: "Els municipis que no van votar el 1979",
      metode: "Municipis amb la primera elecció municipal amb dada després del 1979: els que es van segregar o crear més tard.",
      periode,
      font,
      llistes: [{
        cap: "Per any de la primera elecció amb dada",
        files: primeres.map((f) => ({
          municipi: municipi(f),
          valor: `des del ${f.censDes}`,
          detall: esNombre(f.censUlt) ? `${enter(f.censUlt)} electors a la darrera` : undefined,
        })),
        empatats,
      }],
      cobertura: `N'hi ha ${enter(posteriors.length)} dels ${enter(total)}.`,
      cautela: "Que no hi hagi dada d'una elecció no vol dir que ningú hi votés: la gent votava al municipi del qual formava part.",
    });
  }

  return fets;
}
