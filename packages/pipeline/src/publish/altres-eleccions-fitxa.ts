import { BRANDS_BY_ID, siglesFamily } from "@quivoto/shared-schemas/brands";
import {
  ELECCIONS_ALTRES,
  URL_PARTICIPACIO,
  URL_VOTS,
  type AltresEleccionsMetric,
  type EleccioAltra,
} from "../jobs/j43-altres-eleccions";
import { consultatEl } from "../lib/text";

/**
 * «Com vota aquest municipi a cada elecció»: les municipals del 2023 al costat
 * del Parlament del 2024, les generals del 2023 i les europees del 2024 (J43),
 * amb el Parlament del 2021 i les generals del novembre del 2019 a la taula.
 *
 * Tres decisions de forma, heretades de la resta de la fitxa:
 *
 *   · **La participació primer, en barres d'una sola escala.** És l'única
 *     xifra que es pot comparar tal qual entre eleccions: el cens és gairebé
 *     el mateix i la pregunta és la mateixa, qui hi va anar. Les barres van de
 *     0 a 100 i no de la mínima a la màxima, perquè deu punts han de fer deu
 *     punts d'ample.
 *   · **El vot dual es diu, no s'interpreta.** «A les municipals la llista
 *     més votada va ser X; al Parlament, Y» i prou. Que un poble voti una
 *     llista local a l'ajuntament i una altra cosa al Parlament és normal, i
 *     les llistes locals no es presenten a cap altra elecció: la comparació per
 *     família política és aproximada, i el bloc ho diu sempre.
 *   · **El color del partit és una marca de dades.** La mostra i la barra de
 *     cada llista porten el color de la seva família —el de la casa, el mateix
 *     a les cinc eleccions— o, si no en té, l'oficial de la candidatura; mai
 *     cap altra peça del bloc.
 *
 * Les classes van totes amb el prefix `altres-el-`; `.mostra`, `.taula-envolta`
 * i `.balanc` són les compartides de la fitxa.
 */

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const decimal = (n: number): string =>
  n.toLocaleString("ca-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const percent = (n: number): string => `${decimal(n)}&nbsp;%`;

/**
 * El que el bloc necessita de les municipals del 2023, tal com ja ho té la
 * fitxa: la fila `M20231` de `electionParticipation` (J5) i
 * `results["M20231"]` de la mètrica `results` (derive/metrics.ts). Cap de
 * les dues és obligatòria: sense elles el bloc parla només de les altres.
 */
export type Municipal2023 = {
  participacio: { censusSize: number | null; voters: number | null } | null;
  resultats: {
    totalVotes: number;
    candidatures: readonly { sigles: string; brandId: string | null; color: string | null; votes: number }[];
  } | null;
};

/** Una elecció com la llegeix el bloc, sigui la municipal o una de la J43. */
export type Columna = {
  id: string;
  etiqueta: string;
  frase: string;
  participacio: number | null;
  llistes: { sigles: string; pct: number; familia: string | null; color: string | null }[];
  families: Record<string, number>;
  municipal: boolean;
  principal: boolean;
};

/** El calaix de les llistes que només es presenten a les municipals. */
const LOCAL = "local";

const NOM_FAMILIA: Record<string, string> = {
  psc: "PSC", erc: "ERC", junts: "Junts", pp: "PP", vox: "Vox", cs: "Ciutadans", comuns: "Comuns",
  podem: "Podem", cup: "CUP", aliancacat: "Aliança Catalana", pdecat: "PDeCAT / PNC", ciu: "CiU",
  [LOCAL]: "Llistes locals i d'independents",
};
const nomFamilia = (id: string): string => NOM_FAMILIA[id] ?? BRANDS_BY_ID.get(id)?.name ?? id;

/** El color de la casa per a la família; si no en té, l'oficial; si tampoc, el gris de les locals. */
function colorDe(familia: string | null, oficial: string | null): string {
  const marca = familia && familia !== LOCAL ? BRANDS_BY_ID.get(familia)?.color : undefined;
  if (marca) return marca;
  if (oficial && /^#[0-9a-f]{6}$/i.test(oficial.trim())) return oficial.trim();
  return "#8b8b8b";
}

/**
 * La família d'una llista municipal: la marca que J2 ha desat pel codi
 * d'agrupació, o les sigles si no n'hi ha cap. Les federacions d'independents
 * (FIC, Tots per l'Empordà…) tampoc es presenten a les altres eleccions: van
 * al mateix calaix que les locals.
 */
function familiaMunicipal(c: { sigles: string; brandId: string | null }): string {
  const desada = c.brandId && c.brandId !== LOCAL ? c.brandId : null;
  const familia = desada ?? siglesFamily(c.sigles) ?? LOCAL;
  const tipus = BRANDS_BY_ID.get(familia)?.kind;
  return tipus === "local" || tipus === "regional" ? LOCAL : familia;
}

const arrodoneix1 = (n: number): number => Math.round(n * 10) / 10;

export function columnaMunicipal(m: Municipal2023 | null | undefined): Columna | null {
  if (!m) return null;
  const { participacio, resultats } = m;
  const pct =
    participacio?.censusSize && participacio.voters !== null && participacio.censusSize > 0
      ? arrodoneix1((100 * participacio.voters) / participacio.censusSize)
      : null;
  const total = resultats?.totalVotes ?? 0;
  if (pct === null && total <= 0) return null;
  const ordenades = [...(resultats?.candidatures ?? [])].sort((a, b) => b.votes - a.votes);
  const families: Record<string, number> = {};
  for (const c of ordenades) {
    const f = familiaMunicipal(c);
    families[f] = (families[f] ?? 0) + c.votes;
  }
  for (const f of Object.keys(families)) families[f] = total > 0 ? arrodoneix1((100 * families[f]!) / total) : 0;
  return {
    id: "M20231",
    etiqueta: "Municipals 2023",
    frase: "a les municipals del 2023",
    participacio: pct,
    llistes: total > 0
      ? ordenades.map((c) => ({ sigles: c.sigles, pct: arrodoneix1((100 * c.votes) / total), familia: familiaMunicipal(c), color: c.color }))
      : [],
    families,
    municipal: true,
    principal: true,
  };
}

/** «Parlament 2024», «Generals nov. 2019»: el nom curt de la barra, la targeta i la columna. */
export function etiquetaEleccio(e: Pick<EleccioAltra, "id" | "tipus" | "any">): string {
  const nom = { parlament: "Parlament", generals: "Generals", europees: "Europees" }[e.tipus];
  return `${nom} ${e.id === "G20192" ? "nov. " : ""}${e.any}`;
}

/** «al Parlament del 2024», «a les generals del novembre del 2019»: el tros de frase. */
export function fraseEleccio(e: Pick<EleccioAltra, "id" | "tipus" | "any">): string {
  return {
    parlament: `al Parlament del ${e.any}`,
    generals: `a les generals del ${e.id === "G20192" ? "novembre del " : ""}${e.any}`,
    europees: `a les europees del ${e.any}`,
  }[e.tipus];
}

export function columnaAltra(e: EleccioAltra): Columna {
  return {
    id: e.id,
    etiqueta: etiquetaEleccio(e),
    frase: fraseEleccio(e),
    participacio: e.participacio,
    llistes: e.llistes.map((l) => ({ sigles: l.sigles, pct: l.pct, familia: l.familia, color: l.color })),
    families: e.families,
    municipal: false,
    principal: e.principal,
  };
}

/** «a; b; c, i d»: la manera catalana d'acabar una enumeració llarga. */
function enumera(parts: readonly string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join("; ")}, i ${parts[parts.length - 1]}`;
}

const majuscula = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

// ─────────────────────────────────────────────────────────────────────────────
// Les peces del bloc
// ─────────────────────────────────────────────────────────────────────────────

/**
 * «A les municipals del 2023 hi va votar el 55,6 % del cens; al Parlament del
 * 2024, el 57,9 %; a les generals del 2023, el 65,4 %, i a les europees del
 * 2024, el 43,5 %.» Només les principals: les anteriors van a les barres.
 */
export function fraseParticipacio(columnes: readonly Columna[]): string {
  const amb = columnes.filter((c) => c.principal && c.participacio !== null);
  if (amb.length === 0) return "";
  const [primera, ...resta] = amb;
  const parts = [
    `${majuscula(primera!.frase)} hi va votar el <b>${percent(primera!.participacio!)}</b> del cens`,
    ...resta.map((c) => `${c.frase}, el <b>${percent(c.participacio!)}</b>`),
  ];
  return `<p class="entrada-bloc">${enumera(parts)}.</p>`;
}

/** Les barres de participació, de 0 a 100, una per elecció; les anteriors, més apagades. */
export function barresParticipacio(columnes: readonly Columna[]): string {
  const amb = columnes.filter((c) => c.participacio !== null);
  if (amb.length === 0) return "";
  const resum = amb.map((c) => `${c.etiqueta}: ${decimal(c.participacio!)} %`).join("; ");
  const files = amb
    .map((c) => {
      const classe = c.municipal ? " altres-el-municipal" : c.principal ? "" : " altres-el-abans";
      return `<li class="altres-el-fila${classe}"><span class="altres-el-etq">${escape(c.etiqueta)}</span>
      <span class="altres-el-pista" aria-hidden="true"><span class="altres-el-barra" style="--w:${arrodoneix1(Math.min(100, Math.max(0, c.participacio!)))}%"></span></span>
      <span class="altres-el-xifra">${percent(c.participacio!)}</span></li>`;
    })
    .join("");
  return `<figure class="altres-el-part" role="img" aria-label="${escape(`Participació, en percentatge del cens. ${resum}.`)}">
  <figcaption class="altres-el-titol">La participació, en percentatge del cens</figcaption>
  <ul class="altres-el-barres">${files}</ul>
</figure>`;
}

/**
 * «A les municipals del 2023 la llista més votada va ser Junts per Vic (31,2 %,
 * una llista local); al Parlament del 2024, CAT-JUNTS+ (40,1 %)…». Descriptiu i
 * prou: no diu si és «el mateix» ni si el poble «canvia».
 */
export function fraseVotDual(columnes: readonly Columna[]): string {
  const amb = columnes.filter((c) => c.principal && c.llistes.length > 0);
  if (amb.length < 2) return "";
  const guanyadora = (c: Columna): string => {
    const l = c.llistes[0]!;
    const local = c.municipal && l.familia === LOCAL ? ", una llista local" : "";
    return `<b>${escape(l.sigles)}</b> (${percent(l.pct)}${local})`;
  };
  const [primera, ...resta] = amb;
  const parts = [
    `${majuscula(primera!.frase)} la llista més votada va ser ${guanyadora(primera!)}`,
    ...resta.map((c) => `${c.frase}, ${guanyadora(c)}`),
  ];
  return `<p class="altres-el-dual">${enumera(parts)}.</p>`;
}

/** Quantes llistes surten a cada targeta. */
const LLISTES_TARGETA = 4;

/** Una targeta per elecció principal amb les llistes més votades, la mostra i la barra del seu color. */
export function graellaLlistes(columnes: readonly Columna[]): string {
  const amb = columnes.filter((c) => c.principal && c.llistes.length > 0);
  if (amb.length === 0) return "";
  const targetes = amb
    .map((c) => {
      const maxim = Math.max(...c.llistes.map((l) => l.pct), 1);
      const files = c.llistes
        .slice(0, LLISTES_TARGETA)
        .map((l) => {
          const color = colorDe(l.familia, l.color);
          return `<li><span class="altres-el-qui"><span class="mostra" style="--c:${color}"></span>${escape(l.sigles)}</span>
        <span class="altres-el-pct">${percent(l.pct)}</span>
        <span class="altres-el-prop" aria-hidden="true"><i style="--c:${color};--w:${arrodoneix1((100 * l.pct) / maxim)}%"></i></span></li>`;
        })
        .join("");
      return `<div class="altres-el-targeta${c.municipal ? " altres-el-municipal" : ""}">
    <p class="altres-el-nom">${escape(c.etiqueta)}</p>
    <ol class="altres-el-llistes">${files}</ol>
  </div>`;
    })
    .join("");
  return `<div class="altres-el-graella">${targetes}</div>`;
}

/** Per sota d'aquest percentatge a totes les eleccions, una família no fa fila a la taula. */
const LLINDAR_FAMILIA = 2;

/**
 * La mateixa família a cada elecció, en una taula plegada: una fila per
 * força amb algun 2 % en alguna elecció, i les llistes locals a part, que
 * només tenen la columna de les municipals. Un «—» vol dir que no s'hi va
 * presentar cap llista d'aquella família, no un zero.
 */
export function taulaFamilies(columnes: readonly Columna[]): string {
  if (columnes.length < 2) return "";
  const totes = new Set(columnes.flatMap((c) => Object.keys(c.families)).filter((f) => f !== LOCAL));
  const maxim = (f: string): number => Math.max(...columnes.map((c) => c.families[f] ?? 0));
  const referencia = columnes.find((c) => !c.municipal) ?? columnes[0]!;
  const families = [...totes]
    .filter((f) => maxim(f) >= LLINDAR_FAMILIA)
    .sort((a, b) => (referencia.families[b] ?? 0) - (referencia.families[a] ?? 0) || maxim(b) - maxim(a));
  if (families.length === 0) return "";
  const cel = (c: Columna, f: string): string => {
    const v = c.families[f];
    return `<td>${v === undefined ? "—" : percent(v)}</td>`;
  };
  const fila = (f: string): string =>
    `<tr><th scope="row"><span class="mostra" style="--c:${colorDe(f, null)}"></span>${escape(nomFamilia(f))}</th>${columnes.map((c) => cel(c, f)).join("")}</tr>`;
  const local = columnes.find((c) => c.municipal)?.families[LOCAL];
  const filaLocal = local
    ? `<tr class="altres-el-local"><th scope="row"><span class="mostra" style="--c:${colorDe(LOCAL, null)}"></span>${escape(nomFamilia(LOCAL))}</th>${columnes
        .map((c) => (c.municipal ? `<td>${percent(local)}</td>` : "<td>—</td>"))
        .join("")}</tr>`
    : "";
  return `<details class="altres-el-detall"><summary>La mateixa força a cada elecció</summary>
  <div class="taula-envolta"><table class="balanc altres-el-taula">
  <thead><tr><th scope="col">Família</th>${columnes.map((c) => `<th scope="col">${escape(c.etiqueta)}</th>`).join("")}</tr></thead>
  <tbody>${families.map(fila).join("")}${filaLocal}</tbody>
  </table></div>
  <p class="nota">Percentatge sobre els vots a candidatures de totes les llistes de cada família. Un «—» vol dir que
  no s'hi va presentar cap llista d'aquella família; no és un zero.</p>
</details>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// El bloc
// ─────────────────────────────────────────────────────────────────────────────

const NOTA_LOCALS =
  "Les llistes locals i d'independents només es presenten a les municipals, i al Parlament, al Congrés i a " +
  "Europa el veí vota llistes que a l'ajuntament potser no hi són: comparar per família política és " +
  "aproximat.";

/** El peu amb la font, els dos conjunts i la data de consulta. */
function peuFont(dades: AltresEleccionsMetric): string {
  return `<p class="peu-nota">Font: <a href="${escape(dades.font.url)}" rel="noopener nofollow">${escape(dades.font.nom)}</a>
  (<a href="${escape(dades.font.urlParticipacio)}" rel="noopener nofollow">participació</a>), ${escape(dades.font.organisme)},
  ${escape(consultatEl(dades.font.consultat))}. Les municipals són les de la resta de la fitxa. La participació és
  votants sobre cens, calculada aquí, sense el vot de l'estranger.</p>`;
}

/** Les eleccions de la llista que la font no dona per a aquest municipi: buits, no zeros. */
function notaBuits(dades: AltresEleccionsMetric): string {
  if (dades.buits.length === 0) return "";
  const noms = dades.buits.map((id) => {
    const e = ELECCIONS_ALTRES.find((x) => x.id === id);
    return e ? fraseEleccio(e) : id;
  });
  return `<p class="nota">La font no dona cap xifra d'aquest municipi ${enumera(noms)}: és un buit, no un zero.</p>`;
}

/**
 * El contingut del bloc, sense la secció que l'embolcalla: és el que va a la
 * llista de blocs de la fitxa (`id`, `titol`, `html`) de radiografia.ts.
 * Mai retorna cadena buida: si J43 no té res d'aquest municipi, ho diu.
 */
export function renderAltresEleccionsBloc(
  dades: AltresEleccionsMetric | null,
  municipal2023?: Municipal2023 | null,
): string {
  if (!dades || dades.eleccions.length === 0) {
    return `<p class="entrada-bloc">La Generalitat no publica com ha votat aquest municipi al Parlament, al Congrés
  ni al Parlament Europeu, i sense la xifra no hi ha res a comparar: un buit no és un zero.</p>
  <p class="peu-nota">Font consultada: <a href="${URL_VOTS}" rel="noopener nofollow">Generalitat de Catalunya,
  processos electorals, vots</a> i <a href="${URL_PARTICIPACIO}" rel="noopener nofollow">participació</a>.</p>`;
  }
  const municipal = columnaMunicipal(municipal2023);
  const columnes = [...(municipal ? [municipal] : []), ...dades.eleccions.map(columnaAltra)];
  return `${fraseParticipacio(columnes)}
  ${barresParticipacio(columnes)}
  ${fraseVotDual(columnes)}
  ${graellaLlistes(columnes)}
  ${taulaFamilies(columnes)}
  ${notaBuits(dades)}
  <p class="nota">${escape(NOTA_LOCALS)} Els percentatges de cada llista són sobre els vots a candidatures, sense
  blancs ni nuls, com els de les municipals de la fitxa.</p>
  ${peuFont(dades)}`;
}

/** El bloc sencer com a secció de la fitxa, amb el títol. */
export function renderAltresEleccions(dades: AltresEleccionsMetric | null, municipal2023?: Municipal2023 | null): string {
  return `<section class="bloc" id="altres-eleccions">
  <h2>Com vota a cada elecció</h2>
  ${renderAltresEleccionsBloc(dades, municipal2023)}
</section>`;
}

/**
 * L'estil propi del bloc. La barra de participació és d'un sol color, el de
 * la casa, i la de les municipals va en coral perquè és la del poble; les
 * anteriors, més apagades. Les targetes es reparteixen soles: una columna al
 * mòbil, dues o quatre a l'escriptori. Els comentaris van aquí i no dins del
 * full perquè la fitxa l'enganxa tal qual i hi vol el CSS net.
 */
export const ALTRES_ELECCIONS_CSS = `
.altres-el-part{margin:var(--e2) 0 0}
.altres-el-titol,.altres-el-nom{font-family:var(--display);font-weight:800;font-size:.9rem;color:var(--ink-suau);margin:0 0 6px}
.altres-el-barres{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.altres-el-fila{display:grid;grid-template-columns:minmax(7.5em,9.5em) 1fr 4.2em;gap:8px;align-items:center}
.altres-el-etq{font-size:.9rem}
.altres-el-pista{height:12px;background:var(--paper-2);border:1.5px solid var(--ink);border-radius:var(--r-max);overflow:hidden}
.altres-el-barra{display:block;height:100%;width:var(--w);background:var(--lavanda)}
.altres-el-fila.altres-el-municipal .altres-el-barra{background:var(--coral)}
.altres-el-fila.altres-el-abans{color:var(--ink-suau)}
.altres-el-fila.altres-el-abans .altres-el-pista{border-color:var(--ink-suau)}
.altres-el-xifra{font-variant-numeric:tabular-nums;text-align:right;font-weight:700}
.altres-el-dual{margin:var(--e2) 0 0}
.altres-el-graella{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,14rem),1fr));gap:var(--e1);margin:var(--e2) 0 0}
.altres-el-targeta{border:1.5px solid var(--vora);border-radius:var(--r-m);padding:10px 12px;background:var(--paper)}
.altres-el-targeta.altres-el-municipal{border-color:var(--ink)}
.altres-el-llistes{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.altres-el-llistes li{display:grid;grid-template-columns:1fr auto;gap:2px 8px;align-items:center}
.altres-el-qui{display:flex;gap:6px;align-items:center;min-width:0;overflow-wrap:anywhere;font-size:.9rem}
.altres-el-pct{font-variant-numeric:tabular-nums;font-weight:700;font-size:.9rem}
.altres-el-prop{grid-column:1/-1;height:6px;background:var(--vora);border-radius:var(--r-max);overflow:hidden}
.altres-el-prop i{display:block;height:100%;width:max(var(--w),3px);background:var(--c)}
.altres-el-detall{margin:var(--e2) 0 0}
.altres-el-detall summary{cursor:pointer;font-weight:700}
.altres-el-taula td{font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}
.altres-el-taula th[scope=row]{text-align:left;white-space:nowrap}
.altres-el-taula th[scope=row] .mostra{display:inline-block;vertical-align:-2px;margin-right:6px}
.altres-el-taula .altres-el-local td{color:var(--ink-suau)}
@media (max-width:420px){.altres-el-fila{grid-template-columns:6.5em 1fr 3.8em}}
`;
