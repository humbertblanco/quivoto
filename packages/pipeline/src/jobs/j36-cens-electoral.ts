import { and, eq, notInArray } from "drizzle-orm";
import { municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { socrataAll } from "../adapters/socrata";
import { buildPeerGroups, medianOf, type PeerGroup } from "../derive/peers";
import { toInt } from "../lib/text";
import { withRun } from "../lib/run";
import { arrodoneix } from "./j9-habitatge-residus";

/**
 * J36 — el cens electoral i la participació de cada municipi a totes les
 * eleccions municipals des del 1979: dotze convocatòries, de la primera
 * democràtica a la del 2023.
 *
 * ─── LA FONT, I PER QUÈ AQUESTA ─────────────────────────────────────────────
 *
 * **Generalitat de Catalunya, «Processos electorals - Participació»
 * (conjunt `irrv-2mfc` del portal de dades obertes).** És el mateix conjunt
 * que J5 ja llegeix per a les tres últimes municipals, i porta molt més
 * enrere del que J5 en treu: comprovat el 3 de setembre del 2026, hi ha les
 * dotze eleccions municipals (`M19791` … `M20231`) amb 11.326 files de
 * nivell municipi, cap duplicat per municipi i elecció, cap cens buit ni a
 * zero i cap votants buit. Els municipis que faltaven a les primeres (935 el
 * 1979, 947 des del 2011) són els que encara no existien: Badia del Vallès
 * comença el 1995 i la Canonja el 2011. La productora és la Subdirecció
 * General de Processos Electorals, i s'hi va amb una sola crida paginada
 * (`$where=id_nivell_territorial='MU' AND starts_with(id_eleccio,'M')`).
 *
 * ─── EL QUE S'HA MIRAT I S'HA DESCARTAT, I PER QUÈ ──────────────────────────
 *
 *   · **El Ministeri de l'Interior (infoelectoral).** Té cens i votants per
 *     municipi de totes les convocatòries, però en fitxers DAT per
 *     convocatòria dins d'un ZIP, amb un format de posicions fixes i sense
 *     API: dotze descàrregues i un analitzador propi per obtenir el que la
 *     Generalitat ja dona en JSON amb els codis INE que la base fa servir.
 *   · **Ampliar la taula `electionParticipation`.** J5 hi desa 2015-2023 i
 *     J2, la derivació de trajectòries i la fitxa la llegeixen donant per fet
 *     que només hi ha aquestes tres. Posar-hi nou eleccions més hauria
 *     obligat a repassar-los tots; la sèrie sencera va a una mètrica pròpia.
 *
 * ─── LES REGLES QUE MANEN AQUÍ ──────────────────────────────────────────────
 *
 * **Un buit no és un zero**: la mètrica diu quines de les dotze eleccions
 * tenen dada i quines no, i cap resum no s'inventa la que falta. **La
 * participació és votants sobre cens**, amb un decimal, calculada aquí i no
 * llegida. **La comparació és amb els de la seva mida** —la mediana de
 * participació del tram de població de la LOREG (`derive/peers.ts`), elecció
 * per elecció i sempre amb quants municipis del grup la tenen—, feta amb el
 * padró d'avui, que és l'únic que la base té: un poble que era gran el 1979 i
 * ara és petit es compara amb els petits també el 1979, i la fitxa ho diu.
 * **Cap veredicte**: que el cens hagi crescut o minvat és demografia, no
 * gestió, i que la participació sigui alta o baixa depèn de la mida i de la
 * competència electoral tant com de res que decideixi un ajuntament.
 */

export const KIND = "censElectoral";
export const CONJUNT = "irrv-2mfc";
export const URL_CONJUNT = "https://analisi.transparenciacatalunya.cat/d/irrv-2mfc";
export const API_CONJUNT =
  "https://analisi.transparenciacatalunya.cat/resource/irrv-2mfc.json" +
  "?$where=id_nivell_territorial='MU' AND starts_with(id_eleccio,'M')";

export const FONT_CENS = {
  nom: "Processos electorals · Participació",
  organisme: "Generalitat de Catalunya, Subdirecció General de Processos Electorals i Democràcia Directa",
  url: URL_CONJUNT,
  api: API_CONJUNT,
  llicencia: "Condicions d'ús del portal de dades obertes: reutilització amb atribució i sense alterar el sentit",
} as const;

/**
 * Les dotze eleccions municipals que la font ha de donar, amb la data de la
 * votació. La llista és la que decideix què és un buit: una elecció que hi
 * és aquí i no a la resposta es desa com a «sense dada», no es calla.
 */
export const ELECCIONS_MUNICIPALS: readonly { id: string; any: number; data: string }[] = [
  { id: "M19791", any: 1979, data: "1979-04-03" },
  { id: "M19831", any: 1983, data: "1983-05-08" },
  { id: "M19871", any: 1987, data: "1987-06-10" },
  { id: "M19911", any: 1991, data: "1991-05-26" },
  { id: "M19951", any: 1995, data: "1995-05-28" },
  { id: "M19991", any: 1999, data: "1999-06-13" },
  { id: "M20031", any: 2003, data: "2003-05-25" },
  { id: "M20071", any: 2007, data: "2007-05-27" },
  { id: "M20111", any: 2011, data: "2011-05-22" },
  { id: "M20151", any: 2015, data: "2015-05-24" },
  { id: "M20191", any: 2019, data: "2019-05-26" },
  { id: "M20231", any: 2023, data: "2023-05-28" },
];

export const NOTA_BUITS =
  "Una elecció sense dada pot ser un municipi que encara no existia (Badia del Vallès es va segregar el 1994, " +
  "la Canonja el 2010) o una convocatòria que la font no publica: en cap cas és un zero.";

export const NOTA_COMPETENCIES =
  "El cens el fa l'Oficina del Cens Electoral a partir del padró, i que creixi o minvi és demografia: gent que " +
  "arriba, gent que marxa i gent que fa divuit anys. La participació depèn de la mida del municipi i de com de " +
  "disputada és l'elecció; un ajuntament hi pot posar informació i meses a prop, i poca cosa més.";

// ─────────────────────────────────────────────────────────────────────────────
// De les files del portal a la sèrie d'un municipi
// ─────────────────────────────────────────────────────────────────────────────

/** Una fila del conjunt, tal com arriba del portal: tot són textos. */
export type FilaParticipacio = {
  id_eleccio: string;
  territori_codi: string;
  cens_electoral?: string;
  votants?: string;
  vots_nuls?: string;
  vots_blancs?: string;
  vots_valids?: string;
};

export type EleccioCens = {
  id: string;
  any: number;
  data: string;
  cens: number;
  votants: number;
  /** Votants sobre cens, en percentatge amb un decimal. */
  participacio: number;
  vots_valids: number | null;
  blancs: number | null;
  nuls: number | null;
};

/**
 * La sèrie d'un municipi: només les eleccions de la llista, ordenades per
 * any, i només les que porten cens i votants. Un cens a zero no és una dada
 * —no hi ha ningú per anar a votar— i es tracta com un buit.
 */
export function eleccionsDelMunicipi(files: readonly FilaParticipacio[]): EleccioCens[] {
  const perId = new Map(files.map((f) => [f.id_eleccio, f]));
  const sortida: EleccioCens[] = [];
  for (const eleccio of ELECCIONS_MUNICIPALS) {
    const fila = perId.get(eleccio.id);
    if (!fila) continue;
    const cens = toInt(fila.cens_electoral);
    const votants = toInt(fila.votants);
    if (cens === null || cens <= 0 || votants === null) continue;
    sortida.push({
      id: eleccio.id,
      any: eleccio.any,
      data: eleccio.data,
      cens,
      votants,
      participacio: arrodoneix((100 * votants) / cens, 1),
      vots_valids: toInt(fila.vots_valids),
      blancs: toInt(fila.vots_blancs),
      nuls: toInt(fila.vots_nuls),
    });
  }
  return sortida;
}

/** Els identificadors de les eleccions que la llista espera i la sèrie no té. */
export function buitsDe(eleccions: readonly EleccioCens[]): string[] {
  const tinc = new Set(eleccions.map((e) => e.id));
  return ELECCIONS_MUNICIPALS.filter((e) => !tinc.has(e.id)).map((e) => e.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// El resum: la primera, la darrera i els extrems
// ─────────────────────────────────────────────────────────────────────────────

export type ResumCens = {
  primera: { any: number; cens: number };
  darrera: { any: number; cens: number; votants: number; participacio: number };
  /** Creixement del cens entre la primera elecció amb dada i la darrera, en percentatge amb un decimal. */
  creixementCens: number | null;
  /** El mateix, però només si la primera elecció amb dada és la del 1979: és el que compara el rànquing. */
  creixementDes1979: number | null;
  censMaxim: { any: number; cens: number };
  censMinim: { any: number; cens: number };
  participacioMaxima: { any: number; participacio: number };
  participacioMinima: { any: number; participacio: number };
  eleccionsAmbDada: number;
  eleccionsEsperades: number;
};

/** El creixement entre dues xifres, en percentatge amb un decimal, o `null` si no es pot dividir. */
export function creixement(abans: number, despres: number): number | null {
  if (abans <= 0) return null;
  return arrodoneix((100 * (despres - abans)) / abans, 1);
}

/**
 * Els extrems d'una sèrie amb un sol recorregut. Amb una sola elecció el
 * creixement és `null` —no hi ha res amb què comparar— però el resum
 * existeix: la fitxa pot dir el cens d'aquell any igualment.
 */
export function resumDe(eleccions: readonly EleccioCens[]): ResumCens | null {
  if (eleccions.length === 0) return null;
  const primera = eleccions[0]!;
  const darrera = eleccions[eleccions.length - 1]!;
  const extrem = <K extends "cens" | "participacio">(clau: K, sentit: "max" | "min"): EleccioCens =>
    eleccions.reduce((millor, e) =>
      (sentit === "max" ? e[clau] > millor[clau] : e[clau] < millor[clau]) ? e : millor);
  const censMax = extrem("cens", "max");
  const censMin = extrem("cens", "min");
  const partMax = extrem("participacio", "max");
  const partMin = extrem("participacio", "min");
  return {
    primera: { any: primera.any, cens: primera.cens },
    darrera: { any: darrera.any, cens: darrera.cens, votants: darrera.votants, participacio: darrera.participacio },
    creixementCens: eleccions.length >= 2 ? creixement(primera.cens, darrera.cens) : null,
    creixementDes1979: primera.any === 1979 && eleccions.length >= 2 ? creixement(primera.cens, darrera.cens) : null,
    censMaxim: { any: censMax.any, cens: censMax.cens },
    censMinim: { any: censMin.any, cens: censMin.cens },
    participacioMaxima: { any: partMax.any, participacio: partMax.participacio },
    participacioMinima: { any: partMin.any, participacio: partMin.participacio },
    eleccionsAmbDada: eleccions.length,
    eleccionsEsperades: ELECCIONS_MUNICIPALS.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// La comparació: la mediana de participació dels de la seva mida, elecció a elecció
// ─────────────────────────────────────────────────────────────────────────────

export type ComparacioCens = {
  grup: { clau: string; etiqueta: string; mida: number };
  /** Per identificador d'elecció: la mediana de participació del grup i quants municipis la tenen. */
  participacio: Record<string, { mediana: number; quants: number }>;
};

/**
 * La mediana de participació de cada grup de mida a cada elecció. El grup
 * és el del padró d'avui —l'únic que hi ha a la base— i el municipi no
 * s'exclou del seu propi grup, com a la resta de la fitxa. Un grup amb
 * menys de quatre municipis amb dada no dona mediana: seria dir la xifra
 * d'un veí.
 */
export function comparaDinsDelGrup(
  series: ReadonlyMap<number, readonly EleccioCens[]>,
  grups: ReadonlyMap<number, PeerGroup>,
): Map<number, ComparacioCens> {
  const valors = new Map<string, Map<string, number[]>>();
  for (const [id, eleccions] of series) {
    const grup = grups.get(id);
    if (!grup) continue;
    let perEleccio = valors.get(grup.key);
    if (!perEleccio) {
      perEleccio = new Map();
      valors.set(grup.key, perEleccio);
    }
    for (const e of eleccions) {
      const llista = perEleccio.get(e.id);
      if (llista) llista.push(e.participacio);
      else perEleccio.set(e.id, [e.participacio]);
    }
  }
  const resultat = new Map<number, ComparacioCens>();
  for (const id of series.keys()) {
    const grup = grups.get(id);
    const perEleccio = grup ? valors.get(grup.key) : undefined;
    if (!grup || !perEleccio) continue;
    const participacio: ComparacioCens["participacio"] = {};
    for (const [eleccioId, llista] of perEleccio) {
      const mediana = medianOf(llista);
      if (mediana === null || llista.length < 4) continue;
      participacio[eleccioId] = { mediana: arrodoneix(mediana, 1), quants: llista.length };
    }
    resultat.set(id, { grup: { clau: grup.key, etiqueta: grup.label, mida: grup.size }, participacio });
  }
  return resultat;
}

// ─────────────────────────────────────────────────────────────────────────────
// La mètrica, i la feina
// ─────────────────────────────────────────────────────────────────────────────

export type CensElectoralMetric = {
  font: typeof FONT_CENS & { consultat: string };
  /** Les eleccions amb dada, de la més antiga a la més recent. */
  eleccions: EleccioCens[];
  /** Les eleccions de la llista que no tenen dada: buits, no zeros. */
  buits: string[];
  resum: ResumCens;
  comparacio: ComparacioCens | null;
  context: { decideixLAjuntament: false; nota: string };
  nota: string;
};

/**
 * Una sola crida paginada al portal, la sèrie de cada municipi, el resum i
 * la mediana dels de la seva mida, i la mètrica `censElectoral` de cada
 * municipi amb almenys una elecció. És idempotent i **esborra** la mètrica
 * dels municipis que ja no tenen cap dada. No llegeix cap altra mètrica de
 * la base: només la taula de municipis, que és petita.
 */
export async function j36CensElectoral(db: Db): Promise<void> {
  const tots = await db
    .select({ id: municipalities.id, name: municipalities.name, ine5: municipalities.ine5, population: municipalities.population })
    .from(municipalities);
  const perIne = new Map(tots.map((m) => [m.ine5, m]));

  await withRun(db, "J36 cens electoral: cens i participació a les municipals des del 1979", async (run) => {
    const consultat = new Date().toISOString().slice(0, 10);

    // ── 1. La crida: totes les municipals de nivell municipi d'un cop ────────
    const files = await socrataAll<FilaParticipacio>(CONJUNT, {
      where: "id_nivell_territorial='MU' AND starts_with(id_eleccio,'M')",
      select: "id_eleccio,territori_codi,cens_electoral,votants,vots_nuls,vots_blancs,vots_valids",
    });
    run.rowsIn = files.length;
    const perMunicipi = new Map<string, FilaParticipacio[]>();
    const idsDesconeguts = new Set<string>();
    for (const fila of files) {
      if (!ELECCIONS_MUNICIPALS.some((e) => e.id === fila.id_eleccio)) {
        idsDesconeguts.add(fila.id_eleccio);
        continue;
      }
      const llista = perMunicipi.get(fila.territori_codi);
      if (llista) llista.push(fila);
      else perMunicipi.set(fila.territori_codi, [fila]);
    }
    // Una elecció que la font té i la llista no vol dir que la llista ha
    // envellit (una convocatòria nova) i s'ha de dir, no callar.
    for (const id of idsDesconeguts) {
      await run.issue({ kind: "cens electoral: elecció fora de la llista", severity: "alta", entity: id });
    }
    run.say(`${files.length} files · ${perMunicipi.size} municipis · ${idsDesconeguts.size} eleccions fora de la llista`);

    // ── 2. La sèrie de cada municipi ────────────────────────────────────────
    const series = new Map<number, EleccioCens[]>();
    for (const [ine5, llista] of perMunicipi) {
      const municipi = perIne.get(ine5);
      if (!municipi) {
        await run.issue({ kind: "unknown_municipality", severity: "baixa", entity: ine5 });
        continue;
      }
      const eleccions = eleccionsDelMunicipi(llista);
      if (eleccions.length > 0) series.set(municipi.id, eleccions);
    }
    for (const municipi of tots) {
      if (series.has(municipi.id)) continue;
      await run.issue({
        kind: "cens electoral: municipi sense cap elecció amb dada",
        severity: "mitjana",
        municipalityId: municipi.id,
        entity: municipi.name,
      });
    }

    // ── 3. La comparació amb els de la seva mida, i desar ───────────────────
    const comparacions = comparaDinsDelGrup(series, buildPeerGroups(tots));
    let ambBuits = 0;
    for (const [municipalityId, eleccions] of series) {
      const resum = resumDe(eleccions);
      if (!resum) continue;
      const buits = buitsDe(eleccions);
      if (buits.length > 0) ambBuits += 1;
      const metrica: CensElectoralMetric = {
        font: { ...FONT_CENS, consultat },
        eleccions,
        buits,
        resum,
        comparacio: comparacions.get(municipalityId) ?? null,
        context: { decideixLAjuntament: false, nota: NOTA_COMPETENCIES },
        nota: NOTA_BUITS,
      };
      await db
        .insert(municipalityMetrics)
        .values({ municipalityId, kind: KIND, data: metrica })
        .onConflictDoUpdate({
          target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
          set: { data: metrica, computedAt: new Date() },
        });
      run.rowsOut += 1;
    }
    const idsDesats = [...series.keys()];
    await db.delete(municipalityMetrics).where(
      idsDesats.length > 0
        ? and(eq(municipalityMetrics.kind, KIND), notInArray(municipalityMetrics.municipalityId, idsDesats))
        : eq(municipalityMetrics.kind, KIND),
    );

    run.say(`${run.rowsOut} municipis amb cens · ${ambBuits} amb alguna elecció sense dada`);
    return { municipis: run.rowsOut, ambBuits, eleccionsForaDeLaLlista: [...idsDesconeguts] };
  });
}
