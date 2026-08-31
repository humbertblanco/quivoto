import {
  LLINDAR_HABITANTS,
  NOTA_COMPETENCIES,
  type Canvi,
  type CriminalitatMetric,
  type TipusCriminalitat,
} from "../jobs/j29-criminalitat";
import { medianOf, type PeerGroup } from "../derive/peers";
import { serieTemporal } from "./grafics";

/**
 * «Com ha anat la seguretat»: el bloc de la fitxa que respon si els fets
 * penals pugen o baixen, de quins tipus, i on queda el municipi entre els que
 * tenen dada.
 *
 * Tres decisions de forma, totes heretades de la resta de la fitxa:
 *
 *   · **Una frase abans que una taula.** El primer que es llegeix és la xifra
 *     de l'últim any, la taxa per 1.000 i el canvi des del 2023; després la
 *     posició al rànquing —sempre amb el denominador, «el 42è de 71 municipis
 *     amb dada», mai una posició sola— i la mediana dels de la seva mida.
 *   · **Fletxes de tinta, mai vermell o verd.** Que hi hagi més furts coneguts
 *     no és «pitjor gestió» ni menys «millor»: la policia no és municipal, i
 *     una pujada pot ser més denúncies. Les fletxes són les mateixes que fa
 *     servir el balanç del mandat (↑ ↓ →), sense les classes de color.
 *   · **El buit s'ha de dir.** El Ministeri només publica els municipis de
 *     més de 20.000 habitants: als altres 876 el bloc no desapareix, sinó que
 *     diu per què no hi ha xifra i on és el que sí que es publica.
 */

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const enter = (n: number): string => n.toLocaleString("ca-ES");
const decimal = (n: number): string =>
  n.toLocaleString("ca-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Ordinals catalans en masculí: 1r, 2n, 3r, 4t i d'aquí en amunt tot és «è». */
export function ordinal(n: number): string {
  if (n === 1) return "1r";
  if (n === 2) return "2n";
  if (n === 3) return "3r";
  if (n === 4) return "4t";
  return `${n}è`;
}

export type GrupCriminalitat = {
  nom: string;
  /** Quants municipis del grup tenen la dada. Sense això la mediana no es pot jutjar. */
  quants?: number;
  /** Mediana de fets per 1.000 habitants del darrer any, per clau de tipologia. */
  medianaPerMil: Record<string, number>;
};

export type OpcionsCriminalitat = {
  grup?: GrupCriminalitat | null;
  /** El padró vigent del municipi, per dir si el buit és del Ministeri o de la mida. */
  poblacio?: number | null;
  /** Quants municipis catalans tenen la dada, per dir el buit amb la xifra. */
  coberts?: number | null;
};

/** La fletxa i el número del canvi, amb tinta i prou: aquí no hi ha millor ni pitjor. */
function canviCel(canvi: Canvi | null): string {
  if (!canvi) return "—";
  if (canvi.abs === 0) return `<span class="fletxa" aria-label="sense canvi">→</span> igual`;
  const puja = canvi.abs > 0;
  const signe = puja ? "+" : "−";
  const pct = canvi.pct === null ? "" : ` (${signe}${decimal(Math.abs(canvi.pct))}&nbsp;%)`;
  return `<span class="fletxa" aria-label="${puja ? "puja" : "baixa"}">${puja ? "↑" : "↓"}</span> ${signe}${enter(Math.abs(canvi.abs))}${pct}`;
}

/** «El 2025 es van conèixer 14.901 fets penals, 64,4 per cada 1.000 habitants: 745 més que el 2023 (+5,3 %).» */
function fraseObertura(metric: CriminalitatMetric): string {
  const fets = metric.total.serie.find((p) => p.any === metric.darrerAny)?.fets;
  if (fets === undefined) return "";
  const taxa = metric.total.perMil.find((p) => p.any === metric.darrerAny)?.valor ?? null;
  const canvi = metric.total.canviMandat ?? metric.total.canviUltimAny;
  let frase = `El ${metric.darrerAny} es van conèixer <b>${enter(fets)}</b> fets penals`;
  if (taxa !== null) frase += `, <b>${decimal(taxa)} per cada 1.000 habitants</b>`;
  if (canvi) {
    if (canvi.abs === 0) {
      frase += `: els mateixos que el ${canvi.desDe}`;
    } else {
      const signe = canvi.abs > 0 ? "+" : "−";
      const pct = canvi.pct === null ? "" : ` (${signe}${decimal(Math.abs(canvi.pct))}&nbsp;%)`;
      frase += `: ${enter(Math.abs(canvi.abs))} ${canvi.abs > 0 ? "més" : "menys"} que el ${canvi.desDe}${pct}`;
    }
  }
  return `<p class="entrada-bloc">${frase}.</p>`;
}

/** Amb menys de vuit anys, una espurna és soroll: la taula any a any ja ho diu tot. */
const ANYS_PER_ESPURNA = 8;

/**
 * La forma de la sèrie del total, sota la frase i només quan la història és
 * prou llarga: els municipis més grans arriben al 2015, i deu anys no es
 * llegeixen d'un cop d'ull en una taula d'onze columnes. És l'espurna de
 * `grafics.ts` —sense eixos, perquè la xifra ja és a la frase del costat— i
 * pesa un parell de KB per municipi: el preu just d'ensenyar la dècada.
 * Els forats de dins del seu propi tram es dibuixen com a forats; els anys
 * d'abans que el municipi passés el llindar del Ministeri no són forats de la
 * font sinó la vora de la sèrie, i per això no s'hi esperen.
 */
function espurnaTotal(metric: CriminalitatMetric): string {
  const serie = metric.total.serie;
  if (serie.length < ANYS_PER_ESPURNA) return "";
  const esperats: number[] = [];
  for (let any = serie[0]!.any; any <= metric.darrerAny; any += 1) esperats.push(any);
  return serieTemporal(
    serie.map((p) => ({ any: p.any, valor: p.fets })),
    {
      titol: "Fets penals coneguts, any a any",
      format: (v) => `${enter(v)} fets`,
      mida: "espurna",
      anysEsperats: esperats,
    },
  );
}

/**
 * La posició, dita amb totes les paraules i sempre amb el denominador: una
 * posició sense saber entre quants és un titular, no una dada. I al costat,
 * la mediana dels municipis de la seva mida, que és la comparació honesta.
 */
function frasePosicio(metric: CriminalitatMetric, grup: GrupCriminalitat | null | undefined): string {
  const trossos: string[] = [];
  if (metric.ranquing) {
    trossos.push(
      `En fets per cada 1.000 habitants és el <b>${ordinal(metric.ranquing.posicio)}</b> dels ` +
      `<b>${metric.ranquing.de}</b> municipis catalans amb dada — el 1r és el que en té més`,
    );
  }
  const mediana = grup?.medianaPerMil["total"];
  if (grup && mediana !== undefined) {
    trossos.push(
      grup.quants
        ? `entre els ${enter(grup.quants)} de la seva mida amb dada (${escape(grup.nom)}) la mediana és ${decimal(mediana)}`
        : `els de la seva mida (${escape(grup.nom)}) es mouen en una mediana de ${decimal(mediana)}`,
    );
  }
  if (trossos.length === 0) return "";
  return `<p class="entrada-bloc">${trossos.join("; ")}.</p>`;
}

/** La taula compacta: l'últim any, la taxa, el canvi des del 2023 i la mediana del grup. */
function taulaTipus(metric: CriminalitatMetric, grup: GrupCriminalitat | null | undefined): string {
  const files = [metric.total, ...metric.tipus.filter((t) => t.fitxa)]
    .map((tipus) => {
      const fets = tipus.serie.find((p) => p.any === metric.darrerAny)?.fets;
      if (fets === undefined) return "";
      const taxa = tipus.perMil.find((p) => p.any === metric.darrerAny)?.valor ?? null;
      const mediana = grup?.medianaPerMil[tipus.clau];
      return `<tr>
      <th scope="row">${escape(tipus.nom)}</th>
      <td class="ara">${enter(fets)}</td>
      <td>${taxa === null ? "—" : decimal(taxa)}</td>
      <td class="canvi">${canviCel(tipus.canviMandat)}</td>
      ${grup ? `<td class="abans">${mediana === undefined ? "—" : decimal(mediana)}</td>` : ""}
    </tr>`;
    })
    .join("");
  return `<div class="taula-envolta"><table class="balanc criminalitat">
  <thead><tr><th>Tipus de fet</th><th>${metric.darrerAny}</th><th>per 1.000 hab.</th><th>des del ${metric.mandat.desDe}</th>${
    grup ? `<th>els de la seva mida</th>` : ""
  }</tr></thead>
  <tbody>${files}</tbody>
  </table></div>`;
}

/** El desplegable amb la sèrie sencera, any a any i tipus a tipus. */
function taulaSerie(metric: CriminalitatMetric): string {
  const anys = metric.anys;
  const files = [metric.total, ...metric.tipus]
    .map((tipus) => {
      const cels = anys
        .map((any) => {
          const fets = tipus.serie.find((p) => p.any === any)?.fets;
          return `<td>${fets === undefined ? "—" : enter(fets)}</td>`;
        })
        .join("");
      const nom = tipus.nivell === 2 ? `— ${tipus.nom}` : tipus.nom;
      // Quan un tipus comença més tard que el total no és cap forat: la font
      // no el publicava —el desglòs ha crescut amb els anys— i l'any d'inici
      // escrit al costat és el que evita llegir-ho com una fila incompleta.
      const primerSeu = tipus.serie[0]?.any;
      const desDe = primerSeu !== undefined && primerSeu > anys[0]! ? ` (des del ${primerSeu})` : "";
      return `<tr><th scope="row">${escape(nom)}${desDe}</th>${cels}</tr>`;
    })
    .join("");
  return `<details class="nota"><summary>Any a any, per tipus de fet</summary>
  <div class="taula-envolta"><table class="balanc">
  <thead><tr><th>Tipus de fet</th>${anys.map((any) => `<th>${any}</th>`).join("")}</tr></thead>
  <tbody>${files}</tbody>
  </table></div>
  <span class="peu-nota">Fets coneguts de cada any sencer, del balanç més recent que el porta: el Ministeri
  revisa xifres d'anys anteriors. Un guionet és un any que la font no publica per a aquest municipi, i un
  tipus amb «des del» al costat és un desglòs que abans no existia: el balanç del 2016 tenia vuit
  tipologies, i la cibercriminalitat no baixa a municipis fins a l'any 2021.</span>
  </details>`;
}

/**
 * El bloc sencer, o el buit dit clar quan el municipi no és al balanç.
 *
 * Mai retorna cadena buida: un bloc que desapareix sense explicació fa pensar
 * que no hi ha res a dir, i aquí el que hi ha a dir és per què no hi ha xifra.
 */
export function renderCriminalitat(
  metric: CriminalitatMetric | null,
  opcions: OpcionsCriminalitat = {},
): string {
  if (!metric) {
    const poblacio = opcions.poblacio ?? null;
    const coberts = opcions.coberts ?? null;
    const hiHauriaDeSer = poblacio !== null && poblacio > LLINDAR_HABITANTS
      ? ` Amb <b>${enter(poblacio)}</b> habitants al padró n'hauria de formar part: si no hi surt, el forat és de la font.`
      : "";
    return `<p class="entrada-bloc">El Ministeri de l'Interior només publica el balanç de criminalitat dels
  municipis de més de ${enter(LLINDAR_HABITANTS)} habitants${
    coberts ? ` —${enter(coberts)} a Catalunya—` : ""
  }, i aquest no hi és.${hiHauriaDeSer}
  El que es publica per a tot Catalunya —els fets penals que coneixen els Mossos— va per àrea bàsica policial,
  que agrupa municipis sencers, i no es pot atribuir a un poble sol: val més cap xifra que una xifra
  d'una altra banda.</p>
  <p class="nota"><b>Què hi decideix l'ajuntament.</b> ${escape(NOTA_COMPETENCIES)}</p>`;
  }

  const grup = opcions.grup ?? null;
  const primerBalanc = metric.font.balancos[0]?.any;
  return `${fraseObertura(metric)}
  ${espurnaTotal(metric)}
  ${frasePosicio(metric, grup)}
  ${taulaTipus(metric, grup)}
  ${taulaSerie(metric)}
  <p class="nota">${escape(metric.nota)}</p>
  <p class="nota"><b>Què hi decideix l'ajuntament.</b> ${escape(metric.context.nota)}</p>
  <p class="peu-nota">Font: <a href="${escape(metric.font.url)}" rel="noopener nofollow">${escape(metric.font.organisme)}</a>,
  balanços del quart trimestre${primerBalanc ? ` del ${primerBalanc} al ${metric.darrerAny}` : ""},
  consultats el ${escape(metric.font.consultat)}. ${escape(metric.llindar.nota)}
  La reutilització obliga a citar-ho així: «${escape(metric.font.llicencia.atribucio)}».</p>`;
}

/**
 * La mediana de fets per 1.000 habitants de cada grup de mida, per tipologia.
 *
 * Es calcula sobre els municipis **amb dada** del grup —els altres no hi són,
 * i per això la mediana porta el `quants` al costat—, amb la taxa del darrer
 * any de cadascú. El grup és el mateix de tota la fitxa: el tram de població
 * de la LOREG que fa servir `derive/peers.ts`, construït sobre els 947.
 */
export function mitjanesPerGrup(
  metriques: readonly { municipalityId: number; data: CriminalitatMetric }[],
  grups: ReadonlyMap<number, PeerGroup>,
): Map<string, GrupCriminalitat> {
  const acumulat = new Map<string, { nom: string; municipis: Set<number>; perClau: Map<string, number[]> }>();
  for (const { municipalityId, data } of metriques) {
    const grup = grups.get(municipalityId);
    if (!grup) continue;
    let entrada = acumulat.get(grup.key);
    if (!entrada) acumulat.set(grup.key, (entrada = { nom: grup.label, municipis: new Set(), perClau: new Map() }));
    for (const tipus of [data.total, ...data.tipus]) {
      const valor = tipus.perMil.find((p) => p.any === data.darrerAny)?.valor;
      if (typeof valor !== "number") continue;
      entrada.municipis.add(municipalityId);
      const llista = entrada.perClau.get(tipus.clau);
      if (llista) llista.push(valor);
      else entrada.perClau.set(tipus.clau, [valor]);
    }
  }
  const resultat = new Map<string, GrupCriminalitat>();
  for (const [key, entrada] of acumulat) {
    const medianaPerMil: Record<string, number> = {};
    for (const [clau, valors] of entrada.perClau) {
      const mediana = medianOf(valors);
      if (mediana !== null) medianaPerMil[clau] = Math.round(mediana * 10) / 10;
    }
    resultat.set(key, { nom: entrada.nom, quants: entrada.municipis.size, medianaPerMil });
  }
  return resultat;
}
