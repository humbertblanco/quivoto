import { municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import {
  FONT_ACA,
  descarregaPreusAca,
  type FilaAca,
  type PreusAca,
} from "../adapters/aca";
import { detectManagementChanges, MODEL_LABELS, type ManagementModel } from "./j8-diners";
import { arrodoneix, variacioEntre, type PuntSerie } from "./j9-habitatge-residus";
import { buildPeerGroups, medianOf, percentileOf, type PeerGroup } from "../derive/peers";
import { sleep } from "../lib/http";
import { withRun } from "../lib/run";

/**
 * J19 — què paga la gent: l'aigua i els impostos municipals.
 *
 * Les dues úniques xifres que existeixen, municipi a municipi, del que una
 * família paga per decisions que es prenen al ple:
 *
 *   · El **preu de l'aigua** de l'Observatori de l'ACA, en €/m³ i amb la
 *     mateixa definició per als 947: consum domèstic de 12 m³/mes, preu vigent
 *     a 1 de gener.
 *   · El **rebut mitjà d'IBI**, que és la quota íntegra dividida pels rebuts.
 *     No el tipus impositiu —que ja es va descartar perquè correlaciona +0,08
 *     amb el que es paga de veritat—, sinó els euros que porta el rebut.
 *
 * Totes dues es publiquen com a variació del mandat i al costat de la mediana
 * de la mateixa variació als municipis de la mateixa mida, mai com a xifra
 * solta. I totes dues porten a sobre la marca de si la variació **es pot
 * atribuir a l'ajuntament o no**, que és tota la feina d'aquest job.
 *
 * ── El que no hi entra, i està comprovat ────────────────────────────────────
 *
 *   · **Transport públic**: el preu és per zona tarifària, no per municipi, i
 *     el fixa el consell d'administració de l'ATM. Els 18 municipis de la zona
 *     1 paguen exactament el mateix: no discrimina ningú i no és atribuïble a
 *     cap ajuntament.
 *   · **Escola bressol i instal·lacions esportives**: no estan agregades
 *     enlloc, i a més l'I2 és gratuït a tot Catalunya des del curs 2022/23, o
 *     sigui que una comparativa que ho ignorés compararia zeros.
 *   · **Taxa d'escombraries**: no hi ha cap font pública amb el rebut per
 *     municipi. La recaptació del Ministeri barreja domèstica i comercial i
 *     falla justament allà on la cobra un ens supramunicipal —el Prat hi surt a
 *     1,12 €/habitant perquè la cobra l'AMB.
 */

/** Any de constitució dels ajuntaments: el mateix criteri que J9 i J8. */
const MANDAT = 2023;
const MANDAT_ANTERIOR = 2019;

/**
 * A partir de quin any una revisió de tarifes és d'aquest govern.
 *
 * Els ajuntaments es constitueixen al juny: una revisió del 2023 pot ser
 * anterior a les eleccions —la de Girona és del 9 de maig del 2023— i el preu
 * de la columna del 2023 és el vigent a 1 de gener, o sigui del govern
 * anterior. La primera revisió que només pot ser d'aquest mandat és la del
 * 2024.
 */
const PRIMER_ANY_REVISIO_DEL_MANDAT = 2024;

// ─────────────────────────────────────────────────────────────────────────────
// L'aigua: càlculs purs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * **Parany 1: el TOTAL no és el rebut sencer a 307 dels 947 municipis.**
 *
 * La nota del full ho diu amb totes les lletres: el TOTAL no inclou les tarifes
 * de clavegueram i depuració dels municipis que no les calculen sobre el consum
 * d'aigua, sinó sobre el valor cadastral, els metres de façana o els metres
 * edificats. Aquests municipis tenen la casella de clavegueram a zero (o amb el
 * text «Base imposable: …»), i entre ells hi ha **Sabadell, Badalona i
 * Terrassa**. Comparar el TOTAL de Sabadell amb el de Reus no és comparar el
 * mateix rebut.
 *
 * Per això la columna comparable és **Subministrament**, que la tenen 945 dels
 * 947 i vol dir el mateix a tot arreu. El TOTAL es desa igualment —és el que la
 * gent paga— però marcat amb `rebutSencer: false` allà on no ho és, i la fitxa
 * no hi pot construir cap rànquing.
 */
export function rebutSencer(fila: Pick<FilaAca, "clavegueram">): boolean {
  return fila.clavegueram !== null && fila.clavegueram > 0;
}

/**
 * **Parany 3: el cànon no és municipal.**
 *
 * El cànon de l'aigua el fixa la Generalitat i és idèntic el 2023 i el 2025 a
 * 913 dels 947 municipis: si es deixa dins del preu, mou la xifra de tots els
 * municipis alhora els anys que la Generalitat el toca i sembla que ho hagin
 * decidit 947 plens el mateix dia. Separat, tota la variació del que queda és
 * municipal, i **això és el que fa la xifra publicable**.
 *
 * El preu municipal és el subministrament més el clavegueram, que és exactament
 * el TOTAL menys el cànon (comprovat a Sabadell: 1,500 + 0,654 + 0 = 2,154).
 */
export function preuMunicipal(fila: Pick<FilaAca, "subministrament" | "clavegueram">): number | null {
  if (fila.subministrament === null) return null;
  return arrodoneix(fila.subministrament + (fila.clavegueram ?? 0), 4);
}

/** El TOTAL que el full publica hauria de ser municipal + cànon; si no, alguna cosa falla. */
export function quadraElTotal(fila: FilaAca, marge = 0.005): boolean | null {
  const municipal = preuMunicipal(fila);
  if (municipal === null || fila.total === null || fila.canon === null) return null;
  return Math.abs(municipal + fila.canon - fila.total) <= marge;
}

export type Interpretable = { valida: boolean; motiu: string | null; anyRevisio: number | null };

/**
 * **Parany 2: un preu «pla» pot ser un preu no revisat.**
 *
 * Dels 306 municipis amb data de revisió del 2022 o anterior, **cap ni un** no
 * mostra cap canvi entre el 2023 i el 2025; dels 566 revisats el 2024 o
 * després, el 91 % sí. O sigui que a un municipi no revisat la variació no diu
 * «aquest govern no ha apujat l'aigua», diu «aquestes tarifes no s'han tocat
 * des d'abans», que no és el mateix ni de lluny: Girona té la revisió del
 * 9-5-2023 i el preu clavat des d'aleshores.
 *
 * La regla, doncs: la variació del mandat només es dona per bona si la darrera
 * revisió és del 2024 o posterior. Si no ho és, es desa igualment però marcada
 * com a no interpretable i amb el motiu escrit, perquè qui llegeixi la fitxa
 * sàpiga per què no s'hi diu res.
 */
export function variacioInterpretable(dataRevisio: string | null): Interpretable {
  if (dataRevisio === null) {
    return {
      valida: false,
      motiu: "el full no diu quan es van revisar les tarifes per última vegada",
      anyRevisio: null,
    };
  }
  const anyRevisio = Number(dataRevisio.slice(0, 4));
  if (!Number.isInteger(anyRevisio)) {
    return { valida: false, motiu: "la data de revisió de les tarifes no es pot llegir", anyRevisio: null };
  }
  if (anyRevisio < PRIMER_ANY_REVISIO_DEL_MANDAT) {
    return {
      valida: false,
      anyRevisio,
      motiu:
        `les tarifes no es revisen des del ${anyRevisio}: que el preu no s'hagi mogut durant el mandat ` +
        "no vol dir que aquest govern hagi decidit no apujar-lo, vol dir que ningú no hi ha tocat",
    };
  }
  return { valida: true, motiu: null, anyRevisio };
}

/** El model de gestió tal com el diu el full de l'ACA, en el vocabulari de J8. */
export function modelDeGestio(text: string | null): ManagementModel | null {
  if (text === null) return null;
  const clau = text.trim().toLowerCase();
  if (clau.startsWith("directa")) return "directa";
  if (clau.startsWith("indirecta")) return "indirecta";
  if (clau.startsWith("no presta")) return "noPrestat";
  return null;
}

/**
 * Quan apareix per primera vegada la tarifa social a la sèrie.
 *
 * **Una casella buida no està definida enlloc del full**: pot voler dir que el
 * municipi no en té o que l'ACA no ho sap. Per això `tarifaSocial` és `true` o
 * `null` i mai `false`, i aquí només es mira on comença el `true`. Si el primer
 * any amb tarifa social cau dins del mandat, és una decisió del ple d'ara: n'hi
 * ha 82 de creades aquest mandat, i el total ha passat de 288 el 2018 a 403 el
 * 2025.
 */
export function primerAnyAmbTarifaSocial(
  serie: readonly { any: number; tarifaSocial: boolean | null }[],
): number | null {
  const amb = [...serie].sort((a, b) => a.any - b.any).find((punt) => punt.tarifaSocial === true);
  return amb?.any ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// L'IBI: càlculs purs
// ─────────────────────────────────────────────────────────────────────────────

export type FilaIbi = {
  any: number;
  /** L'Idescat marca amb «(p)» els anys provisionals. */
  provisional: boolean;
  /** «Últim any de valoració cadastral urbà»: el control de la revisió cadastral. */
  valoracio: number | null;
  rebuts: number | null;
  baseImposable: number | null;
  quota: number | null;
  rebutMitja: number | null;
};

export type SerieIbi = {
  municipi: string | null;
  /** La llicència de l'Idescat obliga a enllaçar la seva pàgina al costat de la xifra. */
  urlCanonica: string | null;
  files: FilaIbi[];
};

/**
 * El rebut mitjà: la quota íntegra dividida pels rebuts.
 *
 * És l'única xifra d'IBI que vol dir el que la gent entén. El tipus impositiu
 * ja es va descartar —correlaciona +0,08 amb el que es paga de veritat, perquè
 * un tipus alt sobre valors cadastrals del 1990 pot donar un rebut baix— i la
 * quota total sola només mesura la mida del municipi.
 */
export function rebutMitja(quota: number | null, rebuts: number | null): number | null {
  if (quota === null || rebuts === null || rebuts <= 0) return null;
  return arrodoneix(quota / rebuts, 2);
}

const nombreIdescat = (text: string | undefined): number | null => {
  const net = (text ?? "").trim();
  // «..» és el codi de l'Idescat per a dada confidencial, poc fiable o
  // inexistent. Un codi de municipi que no existeix torna una taula sencera de
  // «..» amb HTTP 200: si es llegissin com a zeros, un municipi inventat
  // sortiria publicat amb un rebut de zero euros.
  if (net === "" || net === ".." || net === ":" || net === "-") return null;
  const numero = Number(net.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(numero) ? numero : null;
};

/**
 * L'SSV de l'Idescat: unes quantes línies de capçalera en text lliure, després
 * la fila de columnes —que és la primera que comença amb `;`— i després un any
 * per línia. El nombre de línies de capçalera **canvia segons el municipi**
 * (els que no tenen cap dada confidencial no porten la línia que explica els
 * «..»), o sigui que saltar-ne un nombre fix trencaria uns quants municipis
 * sense avisar.
 */
export function parseSerieIbi(text: string): SerieIbi {
  const linies = text.replace(/^﻿/, "").split(/\r?\n/);
  const capcalera = linies.findIndex((linia) => linia.startsWith(";"));
  const previes = capcalera === -1 ? linies : linies.slice(0, capcalera);
  const urlCanonica = previes.find((l) => l.trim().startsWith("https://www.idescat.cat"))?.trim() ?? null;
  // La segona línia és el nom del municipi, tret que ja sigui el peu de font
  // (que és el que passa quan el codi demanat no existeix).
  const segona = (linies[1] ?? "").trim();
  const municipi = segona === "" || /^(Font|Nota|\()/.test(segona) ? null : segona;

  const files: FilaIbi[] = [];
  for (const linia of capcalera === -1 ? [] : linies.slice(capcalera + 1)) {
    const camps = linia.split(";");
    const any = Number((camps[0] ?? "").trim().split(/\s+/)[0]);
    if (!Number.isInteger(any) || any < 1900) continue;
    const rebuts = nombreIdescat(camps[2]);
    const quota = nombreIdescat(camps[4]);
    files.push({
      any,
      provisional: (camps[0] ?? "").includes("(p)"),
      valoracio: nombreIdescat(camps[1]),
      rebuts,
      baseImposable: nombreIdescat(camps[3]),
      quota,
      rebutMitja: rebutMitja(quota, rebuts),
    });
  }
  files.sort((a, b) => a.any - b.any);
  return { municipi, urlCanonica, files };
}

export type AnyImplausible = { any: number; valor: number; veins: number; rao: number };

/**
 * **La sèrie de l'Idescat té salts que no són pujades d'impostos.**
 *
 * Sabadell hi fa 30,95 M€ (2010), 55,87 M€ (2011) i 39,08 M€ (2012), i Girona
 * s'enfonsa el 2011 fins a la meitat del rebut dels anys del costat. Són
 * artefactes del calendari de cobrament o de la font, no decisions de cap ple, i
 * publicar-los seria mentir amb dades oficials.
 *
 * La comprovació: cada any interior es compara amb la mitjana dels dos anys que
 * l'envolten. Si se n'allunya més d'un 50 % amunt o avall, s'obre incidència en
 * comptes de publicar-ho. El marge és ample a posta —una revisió cadastral pot
 * moure un rebut un 30 % de cop i això sí que és real—, i el que busca és el
 * salt que torna al seu lloc l'any següent.
 */
export function anysImplausibles(
  serie: readonly { any: number; rebutMitja: number | null }[],
  marge = 0.5,
): AnyImplausible[] {
  const punts = serie
    .filter((p): p is { any: number; rebutMitja: number } => p.rebutMitja !== null && p.rebutMitja > 0)
    .sort((a, b) => a.any - b.any);
  const fora: AnyImplausible[] = [];
  for (let i = 1; i < punts.length - 1; i += 1) {
    const veins = (punts[i - 1]!.rebutMitja + punts[i + 1]!.rebutMitja) / 2;
    if (veins <= 0) continue;
    const rao = punts[i]!.rebutMitja / veins;
    if (rao > 1 + marge || rao < 1 / (1 + marge)) {
      fora.push({
        any: punts[i]!.any,
        valor: arrodoneix(punts[i]!.rebutMitja, 2),
        veins: arrodoneix(veins, 2),
        rao: arrodoneix(rao, 2),
      });
    }
  }
  return fora;
}

export type Revaloracio = { dins: boolean; anysDeCanvi: number[]; valoracions: number[] };

/**
 * Si hi ha hagut revisió cadastral dins de la finestra, la pujada del rebut
 * **no és una decisió del ple**: el que ha canviat és la base sobre la qual
 * s'aplica el tipus. La mateixa taula de l'Idescat porta l'«Últim any de
 * valoració cadastral urbà» any per any, i n'hi ha prou de mirar si canvia:
 * Terrassa hi passa de 1997 a 2018 el 2018, i Barcelona igual.
 */
export function revaloracioDinsFinestra(
  serie: readonly { any: number; valoracio: number | null }[],
  desDe: number,
  fins: number,
): Revaloracio {
  const tots = [...serie].filter((p) => p.valoracio !== null).sort((a, b) => a.any - b.any);
  const dins = tots.filter((p) => p.any >= desDe && p.any <= fins);
  const valoracions = [...new Set(dins.map((p) => p.valoracio!))];

  // L'any de canvi es busca contra l'any anterior de **tota** la sèrie, no
  // només dels que cauen dins de la finestra: si la revaloració arriba
  // justament el primer any del mandat, comparar-lo amb ell mateix no la veuria.
  const anysDeCanvi: number[] = [];
  for (const punt of dins) {
    const anterior = tots.filter((p) => p.any < punt.any).at(-1);
    if (anterior && anterior.valoracio !== punt.valoracio) anysDeCanvi.push(punt.any);
  }
  // I encara una segona porta: que la valoració vigent sigui d'un any de la
  // mateixa finestra, encara que la sèrie no arribi a ensenyar el canvi.
  const vigentDeDins = valoracions.some((v) => v >= desDe && v <= fins);
  return { dins: anysDeCanvi.length > 0 || vigentDeDins, anysDeCanvi, valoracions };
}

// ─────────────────────────────────────────────────────────────────────────────
// Comparació amb els municipis de la mateixa mida
// ─────────────────────────────────────────────────────────────────────────────

export type MedianaGrup = { mediana: number | null; municipis: number };

/**
 * Mediana d'un valor dins del grup de mida.
 *
 * Només hi entren els municipis on el valor **es pot interpretar**: si la
 * mediana de la variació del mandat es calculés amb els 306 municipis que no
 * revisen tarifes des d'abans del 2022, sortiria un zero que faria semblar que
 * a tot arreu s'ha congelat el preu, quan el que passa és que a tot arreu no
 * s'ha mirat.
 */
function medianaPerGrup(
  valors: ReadonlyMap<number, number>,
  grups: ReadonlyMap<number, PeerGroup>,
): Map<number, MedianaGrup> {
  const perGrup = new Map<string, number[]>();
  for (const [id, valor] of valors) {
    const grup = grups.get(id);
    if (!grup) continue;
    const llista = perGrup.get(grup.key);
    if (llista) llista.push(valor);
    else perGrup.set(grup.key, [valor]);
  }
  const sortida = new Map<number, MedianaGrup>();
  for (const [id] of valors) {
    const grup = grups.get(id);
    if (!grup) continue;
    const llista = perGrup.get(grup.key)!;
    sortida.set(id, {
      mediana: llista.length === 0 ? null : arrodoneix(medianOf(llista) ?? 0, 2),
      municipis: llista.length,
    });
  }
  return sortida;
}

/**
 * Percentil i mediana del valor d'avui dins del grup, amb quants hi tenen dada.
 *
 * És el bessó de la funció del mateix nom de J9, que allà és privada. Quan una
 * tercera feina la necessiti, el seu lloc és `derive/peers.ts` i aquestes dues
 * còpies han de desaparèixer: duplicar-la una vegada és barat, tres ja no.
 */
function comparaDinsDelGrup(
  valors: ReadonlyMap<number, number>,
  grups: ReadonlyMap<number, PeerGroup>,
): Map<number, { grup: { clau: string; etiqueta: string; mida: number; ambDada: number }; percentil: number; mediana: number }> {
  const perGrup = new Map<string, number[]>();
  for (const [id, valor] of valors) {
    const grup = grups.get(id);
    if (!grup) continue;
    const llista = perGrup.get(grup.key);
    if (llista) llista.push(valor);
    else perGrup.set(grup.key, [valor]);
  }
  const sortida = new Map<
    number,
    { grup: { clau: string; etiqueta: string; mida: number; ambDada: number }; percentil: number; mediana: number }
  >();
  for (const [id, valor] of valors) {
    const grup = grups.get(id);
    if (!grup) continue;
    const llista = perGrup.get(grup.key)!;
    const percentil = percentileOf(valor, llista);
    const mediana = medianOf(llista);
    if (percentil === null || mediana === null) continue;
    sortida.set(id, {
      grup: { clau: grup.key, etiqueta: grup.label, mida: grup.size, ambDada: llista.length },
      percentil,
      mediana: arrodoneix(mediana, 2),
    });
  }
  return sortida;
}

// ─────────────────────────────────────────────────────────────────────────────
// Descàrrega de l'Idescat
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Taula 173 de l'Idescat: IBI urbà, un municipi per petició i tota la sèrie
 * 2006-2025 dins de cada resposta. No hi ha cap manera de demanar-ho tot de
 * cop: el paràmetre `geo=mun` torna els 947 però només de l'últim any, i cap
 * variant de l'any (`t`, `a`, `any`) no fa res. Per això aquest job baixa 947
 * fitxes amb pausa entre elles i **no entra a l'ordre `all`**.
 */
const URL_IBI = (idescat6: string): string =>
  `https://www.idescat.cat/pub/?id=ibi&n=173&geo=mun:${idescat6}&f=ssv`;

const USER_AGENT = "quivoto/0.1 (brúixola electoral municipal; hola@quivoto.cat)";

/**
 * GET de text pla amb reintents. Viu aquí i no a `lib/http` perquè és un sol
 * endpoint d'una sola font; si algun dia n'hi ha un segon que llegeixi SSV de
 * l'Idescat, el lloc d'això és un adaptador.
 */
async function descarregaSsv(
  url: string,
  options: { retries?: number; timeoutMs?: number; delayMs?: number } = {},
): Promise<string | null> {
  const { retries = 3, timeoutMs = 60_000, delayMs = 0 } = options;
  if (delayMs > 0) await sleep(delayMs);
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        headers: { accept: "text/plain", "user-agent": USER_AGENT },
        signal: controller.signal,
        redirect: "follow",
      });
      if (response.status === 404) return null;
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status} a ${url}`);
        // Un 4xx que no sigui 429 vol dir que la petició està mal feta: 947
        // reintents no la milloraran i només castigarien la font.
        if (response.status < 500 && response.status !== 429) throw Object.assign(error, { definitiu: true });
        throw error;
      }
      return await response.text();
    } catch (error) {
      lastError = error;
      if ((error as { definitiu?: boolean })?.definitiu) throw error;
      if (attempt === retries) break;
      await sleep(500 * 2 ** attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ingesta
// ─────────────────────────────────────────────────────────────────────────────

type Municipi = { id: number; name: string; idescat6: string | null; population: number | null };

export async function j19Preus(db: Db): Promise<void> {
  const tots: Municipi[] = (await db.select().from(municipalities)).map((m) => ({
    id: m.id,
    name: m.name,
    idescat6: m.idescat6,
    population: m.population,
  }));
  const perIdescat6 = new Map<string, number>();
  for (const m of tots) if (m.idescat6) perIdescat6.set(m.idescat6, m.id);
  const grups = buildPeerGroups(tots);

  const desa = async (municipalityId: number, kind: string, data: unknown): Promise<void> => {
    await db
      .insert(municipalityMetrics)
      .values({ municipalityId, kind, data })
      .onConflictDoUpdate({
        target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
        set: { data, computedAt: new Date() },
      });
  };

  await j19Aigua(db, { tots, perIdescat6, grups, desa });
  await j19Ibi(db, { tots, perIdescat6, grups, desa });
}

type Context = {
  tots: readonly Municipi[];
  perIdescat6: ReadonlyMap<string, number>;
  grups: ReadonlyMap<number, PeerGroup>;
  desa: (municipalityId: number, kind: string, data: unknown) => Promise<void>;
};

/** Un any de la sèrie d'un municipi, tal com es desa a la fitxa. */
type PuntAigua = {
  any: number;
  subministrament: number | null;
  canon: number | null;
  clavegueram: number | null;
  clavegueramNota: string | null;
  municipal: number | null;
  total: number | null;
  rebutSencer: boolean;
  gestioSubministrament: string | null;
  gestioClavegueram: string | null;
  gestora: string | null;
  tarifaSocial: boolean | null;
  dataRevisio: string | null;
};

async function j19Aigua(db: Db, ctx: Context): Promise<void> {
  await withRun(db, "J19 preu de l'aigua (ACA)", async (run) => {
    const preus: PreusAca = await descarregaPreusAca();
    run.rowsIn = preus.anys.reduce((suma, any) => suma + any.files.length, 0);
    run.say(`fulls del ${preus.anys[0]?.any} al ${preus.anys.at(-1)?.any}`);
    run.say(`data d'actualització de l'origen: ${preus.dataActualitzacio ?? "no consta"}`);

    // La llicència de gencat obliga a informar de la darrera data
    // d'actualització al costat de la xifra. Sense aquesta data no podem
    // publicar complint-la, i val més saber-ho aquí que no pas a la fitxa.
    if (!preus.dataActualitzacio) {
      await run.issue({
        kind: "aca: sense data d'actualització",
        severity: "alta",
        detail: { efecte: "la llicència obliga a publicar-la al costat de la xifra", url: FONT_ACA.url },
      });
    }

    const series = new Map<number, PuntAigua[]>();
    const orfes = new Map<string, string>();
    for (const any of preus.anys) {
      for (const fila of any.files) {
        const municipalityId = ctx.perIdescat6.get(fila.idescat6);
        if (!municipalityId) {
          orfes.set(fila.idescat6, fila.municipi);
          continue;
        }
        const quadra = quadraElTotal(fila);
        if (quadra === false) {
          await run.issue({
            kind: "aca: el total no és subministrament + cànon + clavegueram",
            severity: "mitjana",
            municipalityId,
            detail: {
              any: any.any,
              subministrament: fila.subministrament,
              canon: fila.canon,
              clavegueram: fila.clavegueram,
              total: fila.total,
            },
          });
        }
        const punts = series.get(municipalityId) ?? [];
        punts.push({
          any: any.any,
          subministrament: fila.subministrament,
          canon: fila.canon,
          clavegueram: fila.clavegueram,
          clavegueramNota: fila.clavegueramNota,
          municipal: preuMunicipal(fila),
          total: fila.total,
          rebutSencer: rebutSencer(fila),
          gestioSubministrament: fila.gestioSubministrament,
          gestioClavegueram: fila.gestioClavegueram,
          gestora: fila.gestora,
          tarifaSocial: fila.tarifaSocial,
          dataRevisio: fila.dataRevisio,
        });
        series.set(municipalityId, punts);
      }
    }
    for (const punts of series.values()) punts.sort((a, b) => a.any - b.any);

    for (const [codi, nom] of orfes) {
      await run.issue({
        kind: "aca: codi sense municipi",
        severity: "baixa",
        entity: codi,
        detail: { font: FONT_ACA.url, idescat6: codi, municipi: nom },
      });
    }

    const darrerAny = Math.max(...[...series.values()].map((punts) => punts.at(-1)!.any));

    /**
     * Les variacions de tot Catalunya, per poder dir com ha anat el grup. Només
     * hi entren els municipis amb la variació interpretable: la mediana d'un
     * grup ple de municipis que no revisen tarifes no vol dir res.
     */
    const variacioSub = new Map<number, number>();
    const variacioMunicipal = new Map<number, number>();
    const preuAvui = new Map<number, number>();
    for (const [id, punts] of series) {
      const ultim = punts.find((p) => p.any === darrerAny);
      if (!ultim) continue;
      if (ultim.subministrament !== null) preuAvui.set(id, ultim.subministrament);
      if (!variacioInterpretable(ultim.dataRevisio).valida) continue;
      const sub = variacioEntre(
        punts.map((p) => ({ any: p.any, valor: p.subministrament })),
        MANDAT,
        darrerAny,
      );
      if (sub?.percentual != null) variacioSub.set(id, sub.percentual);
      const municipal = variacioEntre(
        punts.map((p) => ({ any: p.any, valor: p.municipal })),
        MANDAT,
        darrerAny,
      );
      if (municipal?.percentual != null) variacioMunicipal.set(id, municipal.percentual);
    }
    const medianaSub = medianaPerGrup(variacioSub, ctx.grups);
    const medianaMunicipal = medianaPerGrup(variacioMunicipal, ctx.grups);
    const comparacions = comparaDinsDelGrup(preuAvui, ctx.grups);

    let interpretables = 0;
    let senseRebutSencer = 0;
    let tarifesNoves = 0;
    let canvisDeGestio = 0;
    for (const [municipalityId, punts] of series) {
      const ultim = punts.find((p) => p.any === darrerAny) ?? punts.at(-1)!;
      const interpretable = variacioInterpretable(ultim.dataRevisio);
      if (interpretable.valida) interpretables += 1;
      if (!ultim.rebutSencer) senseRebutSencer += 1;

      const serieSub: PuntSerie[] = punts.map((p) => ({ any: p.any, valor: p.subministrament }));
      const serieMunicipal: PuntSerie[] = punts.map((p) => ({ any: p.any, valor: p.municipal }));
      const serieTotal: PuntSerie[] = punts.map((p) => ({ any: p.any, valor: p.total }));
      const serieCanon: PuntSerie[] = punts.map((p) => ({ any: p.any, valor: p.canon }));

      // El model de gestió, amb la regla de J8: un model nou no és un canvi
      // fins que s'ha vist dos anys seguits, perquè si no una errata d'un any
      // es publica com dues remunicipalitzacions.
      const historia = punts
        .map((p) => ({ year: p.any, model: modelDeGestio(p.gestioSubministrament) }))
        .filter((p): p is { year: number; model: ManagementModel } => p.model !== null);
      /**
       * Els canvis del mandat són els de **després** de la columna del 2023, no
       * els del 2023: el preu i el model d'aquella columna són els vigents a 1
       * de gener, mig any abans que aquest govern es constituís. Girona n'és
       * l'exemple —hi passa a gestió directa el 2023, amb el govern anterior— i
       * amb el tall a partir del 2024 en surten els cinc que hi ha de veritat.
       */
      const canvis = detectManagementChanges(historia)
        .filter((c) => c.year >= MANDAT_ANTERIOR)
        .map((c) => ({ ...c, delMandat: c.year > MANDAT }));
      canvisDeGestio += canvis.filter((c) => c.delMandat).length;

      const primerTarifa = primerAnyAmbTarifaSocial(punts);
      const creadaAquestMandat = primerTarifa !== null && primerTarifa > MANDAT;
      if (creadaAquestMandat) tarifesNoves += 1;

      await ctx.desa(municipalityId, "preuAigua", {
        font: { ...FONT_ACA, dataActualitzacio: preus.dataActualitzacio, peu: preus.font },
        darrerAny,
        serie: punts,
        preu: {
          subministrament: ultim.subministrament,
          canon: ultim.canon,
          clavegueram: ultim.clavegueram,
          municipal: ultim.municipal,
          total: ultim.total,
        },
        /**
         * La comparació ha d'anar sobre **subministrament**, no sobre el TOTAL:
         * a 307 municipis el TOTAL no inclou el clavegueram perquè no el
         * calculen sobre el consum d'aigua.
         */
        comparable: "subministrament",
        rebutSencer: ultim.rebutSencer,
        avisRebut: ultim.rebutSencer
          ? null
          : "El total no inclou el clavegueram i la depuració: aquest municipi no els calcula sobre el consum d'aigua" +
            (ultim.clavegueramNota ? ` (${ultim.clavegueramNota})` : "") +
            ". Per comparar amb altres municipis cal fer servir el preu del subministrament.",
        dataRevisio: ultim.dataRevisio,
        interpretable,
        mandat: {
          subministrament: variacioEntre(serieSub, MANDAT, darrerAny),
          municipal: variacioEntre(serieMunicipal, MANDAT, darrerAny),
          total: variacioEntre(serieTotal, MANDAT, darrerAny),
        },
        mandatAnterior: {
          subministrament: variacioEntre(serieSub, MANDAT_ANTERIOR, MANDAT),
          municipal: variacioEntre(serieMunicipal, MANDAT_ANTERIOR, MANDAT),
        },
        mandatDelGrup: {
          subministrament: medianaSub.get(municipalityId) ?? null,
          municipal: medianaMunicipal.get(municipalityId) ?? null,
          nota: "Mediana de la mateixa variació als municipis de la mateixa mida, comptant només els que tenen la variació interpretable.",
        },
        comparacio: comparacions.get(municipalityId) ?? null,
        canon: {
          ara: ultim.canon,
          variacio: variacioEntre(serieCanon, MANDAT, darrerAny),
          nota: "El cànon de l'aigua el fixa la Generalitat, no l'ajuntament: és idèntic el 2023 i el 2025 a 913 dels 947 municipis i no compta com a decisió municipal.",
        },
        gestio: {
          subministrament: ultim.gestioSubministrament,
          clavegueram: ultim.gestioClavegueram,
          gestora: ultim.gestora,
          canvis,
          etiquetes: MODEL_LABELS,
        },
        tarifaSocial: {
          ara: ultim.tarifaSocial,
          desDe: primerTarifa,
          creadaAquestMandat,
          nota: "Una casella buida no està definida al full de l'ACA: no vol dir que el municipi no tingui tarifa social, vol dir que la font no ho diu.",
        },
      });
      run.rowsOut += 1;
    }

    const sense = ctx.tots.filter((m) => !series.has(m.id));
    for (const m of sense) {
      await run.issue({
        kind: "aca: sense preu de l'aigua",
        severity: "mitjana",
        municipalityId: m.id,
        detail: { municipi: m.name, idescat6: m.idescat6 },
      });
    }

    run.say(`${series.size} municipis amb sèrie · ${sense.length} sense cap dada`);
    run.say(`${interpretables} amb variació del mandat interpretable (revisió del ${PRIMER_ANY_REVISIO_DEL_MANDAT} o posterior)`);
    run.say(`${senseRebutSencer} amb el clavegueram fora del total · ${tarifesNoves} amb tarifa social estrenada aquest mandat`);
    run.say(`${canvisDeGestio} canvis de model de gestió del subministrament a partir del ${MANDAT + 1}`);
    return {
      darrerAny,
      municipis: series.size,
      interpretables,
      senseRebutSencer,
      tarifesNoves,
      canvisDeGestio,
      dataActualitzacio: preus.dataActualitzacio,
    };
  });
}

async function j19Ibi(db: Db, ctx: Context): Promise<void> {
  await withRun(db, "J19 rebut mitjà d'IBI (Idescat)", async (run) => {
    const series = new Map<number, SerieIbi>();
    let sensePagina = 0;
    for (const m of ctx.tots) {
      if (!m.idescat6) {
        await run.issue({
          kind: "ibi: municipi sense codi Idescat",
          severity: "alta",
          municipalityId: m.id,
          detail: { municipi: m.name },
        });
        continue;
      }
      // Pausa entre peticions: són 947 crides a un servidor públic que ens
      // deixa les dades de franc.
      const text = await descarregaSsv(URL_IBI(m.idescat6), { delayMs: 250 });
      if (text === null) {
        sensePagina += 1;
        await run.issue({
          kind: "ibi: fitxa inexistent",
          severity: "mitjana",
          municipalityId: m.id,
          detail: { municipi: m.name, url: URL_IBI(m.idescat6) },
        });
        continue;
      }
      run.rowsIn += 1;
      const serie = parseSerieIbi(text);
      // Un codi que no existeix torna HTTP 200 amb la taula sencera de «..».
      if (serie.files.every((f) => f.quota === null && f.rebuts === null)) {
        await run.issue({
          kind: "ibi: sèrie buida",
          severity: "mitjana",
          municipalityId: m.id,
          detail: { municipi: m.name, idescat6: m.idescat6, url: URL_IBI(m.idescat6) },
        });
        continue;
      }
      series.set(m.id, serie);
    }

    const darrerAny = Math.max(...[...series.values()].map((s) => s.files.at(-1)!.any));

    const rebutAvui = new Map<number, number>();
    const variacions = new Map<number, number>();
    const dolents = new Map<number, AnyImplausible[]>();
    for (const [id, serie] of series) {
      const implausibles = anysImplausibles(serie.files);
      dolents.set(id, implausibles);
      const ultim = serie.files.find((f) => f.any === darrerAny);
      if (ultim?.rebutMitja != null) rebutAvui.set(id, ultim.rebutMitja);

      const dinsFinestra = implausibles.some((a) => a.any >= MANDAT && a.any <= darrerAny);
      const revaloracio = revaloracioDinsFinestra(serie.files, MANDAT, darrerAny);
      const variacio = variacioEntre(
        serie.files.map((f) => ({ any: f.any, valor: f.rebutMitja })),
        MANDAT,
        darrerAny,
      );
      // A la mediana del grup només hi entra el que és atribuïble al ple: ni
      // els anys que la font es contradiu, ni els municipis on el que ha
      // canviat és el cadastre.
      if (variacio?.percentual != null && !dinsFinestra && !revaloracio.dins) {
        variacions.set(id, variacio.percentual);
      }
    }
    const medianes = medianaPerGrup(variacions, ctx.grups);
    const comparacions = comparaDinsDelGrup(rebutAvui, ctx.grups);

    let ambRevaloracio = 0;
    let ambSalt = 0;
    let publicables = 0;
    for (const [municipalityId, serie] of series) {
      const implausibles = dolents.get(municipalityId) ?? [];
      const revaloracio = revaloracioDinsFinestra(serie.files, MANDAT, darrerAny);
      const saltDinsFinestra = implausibles.filter((a) => a.any >= MANDAT && a.any <= darrerAny);
      if (revaloracio.dins) ambRevaloracio += 1;
      if (implausibles.length > 0) ambSalt += 1;

      for (const salt of implausibles) {
        await run.issue({
          kind: "ibi: any fora del rang plausible",
          severity: salt.any >= MANDAT ? "alta" : "baixa",
          municipalityId,
          detail: { ...salt, url: serie.urlCanonica },
        });
      }

      const ultim = serie.files.find((f) => f.any === darrerAny) ?? serie.files.at(-1)!;
      const variacio = variacioEntre(
        serie.files.map((f) => ({ any: f.any, valor: f.rebutMitja })),
        MANDAT,
        darrerAny,
      );
      const motius: string[] = [];
      if (revaloracio.dins) {
        motius.push(
          `hi ha hagut revisió cadastral dins de la finestra (valoracions ${revaloracio.valoracions.join(", ")}): ` +
            "el que ha pujat és la base sobre la qual s'aplica el tipus, i això no ho decideix el ple",
        );
      }
      if (saltDinsFinestra.length > 0) {
        motius.push(
          `la sèrie de l'origen fa un salt que no quadra amb els anys del costat (${saltDinsFinestra
            .map((s) => s.any)
            .join(", ")})`,
        );
      }
      const publicable = variacio !== null && motius.length === 0;
      if (publicable) publicables += 1;

      await ctx.desa(municipalityId, "rebutIbi", {
        font: {
          nom: "Impost de béns immobles de naturalesa urbana (IBI), taula 173",
          organisme: "Idescat, a partir de la Direcció General del Cadastre",
          url: serie.urlCanonica ?? `https://www.idescat.cat/pub/?id=ibi&n=173`,
          /** L'Idescat demana que el seu enllaç surti al costat de la xifra. */
          llicencia: "Cal enllaçar la pàgina de l'Idescat al costat de la xifra.",
        },
        darrerAny,
        base: "Rebut mitjà = quota íntegra dividida pels rebuts. No és el tipus impositiu.",
        serie: serie.files,
        rebutMitja: ultim.rebutMitja,
        rebuts: ultim.rebuts,
        provisional: ultim.provisional,
        mandat: variacio,
        mandatAnterior: variacioEntre(
          serie.files.map((f) => ({ any: f.any, valor: f.rebutMitja })),
          MANDAT_ANTERIOR,
          MANDAT,
        ),
        mandatDelGrup: medianes.get(municipalityId) ?? null,
        comparacio: comparacions.get(municipalityId) ?? null,
        revaloracio,
        anysImplausibles: implausibles,
        publicable,
        motius,
      });
      run.rowsOut += 1;
    }

    run.say(`últim any: ${darrerAny} · ${series.size} municipis amb sèrie · ${sensePagina} sense fitxa`);
    run.say(`${publicables} amb variació de mandat publicable · ${ambRevaloracio} amb revisió cadastral dins la finestra`);
    run.say(`${ambSalt} amb algun any fora del rang plausible`);
    return { darrerAny, municipis: series.size, publicables, ambRevaloracio, ambSalt };
  });
}
