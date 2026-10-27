import { and, eq, notInArray } from "drizzle-orm";
import { municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { siglesFamily } from "@quivoto/shared-schemas/brands";
import { DATASETS, socrataAll } from "../adapters/socrata";
import { normalize, toInt } from "../lib/text";
import { withRun } from "../lib/run";
import { arrodoneix } from "./j9-habitatge-residus";

/**
 * J43 — com vota cada municipi quan no vota el seu ajuntament: el Parlament
 * de Catalunya, el Congrés i el Parlament Europeu, al costat de les
 * municipals que la fitxa ja explica.
 *
 * ─── LA FONT, I PER QUÈ AQUESTA ─────────────────────────────────────────────
 *
 * **Generalitat de Catalunya, «Processos electorals» (conjunts `ntc4-rnwr`,
 * vots per candidatura, i `irrv-2mfc`, participació).** Són els mateixos dos
 * conjunts que J2, J5 i J36 ja llegeixen per a les municipals, i porten totes
 * les altres convocatòries amb el mateix format i els mateixos codis INE: `A`
 * és el Parlament, `G` les generals (el Congrés), `E` les europees. Comprovat
 * el 27 d'octubre del 2026: cada una de les cinc eleccions d'aquí sota té 951
 * territoris de nivell municipi —els 947 municipis i quatre «Residents
 * absents» (codis `08998`, `17998`, `25998`, `43998`), el vot de l'estranger
 * per província—, cap sigla repetida dins d'un municipi i cap vot buit. La
 * suma de vots a candidatures més els blancs dona els vots vàlids. La
 * participació de Catalunya sumant els 947 dona el 57,9 % al Parlament del
 * 2024, el 65,4 % a les generals del 2023, el 43,5 % a les europees del 2024,
 * el 53,5 % al Parlament del 2021 i el 72,1 % a les generals del novembre del
 * 2019: les xifres oficials sense el vot de l'estranger.
 *
 * ─── EL QUE S'HA MIRAT I S'HA DESCARTAT, I PER QUÈ ──────────────────────────
 *
 *   · **El Ministeri de l'Interior (infoelectoral).** Té les generals i les
 *     europees, però no el Parlament, i en fitxers DAT de posicions fixes: la
 *     Generalitat ja dona les tres en JSON amb els codis que la base fa servir.
 *   · **Totes les convocatòries des del 1977.** Hi són, però la fitxa vol dir
 *     com vota avui el poble, no fer-ne la història: les tres darreres, i la
 *     de just abans al Parlament i al Congrés per veure si es mou.
 *   · **El vot de l'estranger (CERA).** La font el dona per província i no per
 *     municipi: no es pot repartir, i no es reparteix. La participació d'aquí
 *     és la dels residents, igual que a les municipals.
 *
 * ─── LES REGLES QUE MANEN AQUÍ ──────────────────────────────────────────────
 *
 * **El percentatge d'una llista és sobre els vots a candidatures**, sense
 * blancs ni nuls, com el `share` de les municipals que desa `derive/metrics.ts`:
 * si no, la mateixa llista tindria dos percentatges diferents a la mateixa
 * fitxa. **La participació és votants sobre cens**, amb un decimal, calculada
 * aquí. **La família de cada llista** (PSC, Junts, Comuns…) surt d'una taula
 * explícita per a les sigles nacionals d'aquestes cinc eleccions i, si no hi
 * és, de `siglesFamily()`; una llista sense família és «altres», mai una
 * família endevinada. **Cap veredicte**: que un poble voti diferent a cada
 * elecció és el que fa tothom, i les llistes locals només es presenten a les
 * municipals, així que la comparació per família és aproximada i la fitxa ho
 * diu.
 */

export const KIND = "altresEleccions";
export const CONJUNT_VOTS = DATASETS.resultats;
export const CONJUNT_PARTICIPACIO = "irrv-2mfc";
export const URL_VOTS = "https://analisi.transparenciacatalunya.cat/d/ntc4-rnwr";
export const URL_PARTICIPACIO = "https://analisi.transparenciacatalunya.cat/d/irrv-2mfc";

export type TipusEleccio = "parlament" | "generals" | "europees";

export type EleccioDeLaLlista = {
  id: string;
  tipus: TipusEleccio;
  any: number;
  data: string;
  /** Les tres que la fitxa compara amb les municipals; les altres dues són per veure la tendència. */
  principal: boolean;
};

/**
 * Les cinc eleccions que es desen, primer les tres principals. La llista és
 * la que decideix què és un buit: una elecció que hi és aquí i no a la
 * resposta d'un municipi es desa com a «sense dada», no es calla.
 */
export const ELECCIONS_ALTRES: readonly EleccioDeLaLlista[] = [
  { id: "A20241", tipus: "parlament", any: 2024, data: "2024-05-12", principal: true },
  { id: "G20231", tipus: "generals", any: 2023, data: "2023-07-23", principal: true },
  { id: "E20241", tipus: "europees", any: 2024, data: "2024-06-09", principal: true },
  { id: "A20211", tipus: "parlament", any: 2021, data: "2021-02-14", principal: false },
  { id: "G20192", tipus: "generals", any: 2019, data: "2019-11-10", principal: false },
];

/** Quantes llistes es desen amb nom i vots; la resta van juntes a «altres». */
export const LLISTES_DESADES = 6;

/**
 * El codi INE de cinc xifres d'una fila. **Les europees del 2024 el porten
 * sense el zero del davant a la província de Barcelona** («8001» per Abrera,
 * 10.608 files de 32.334), quan les altres quatre eleccions i la participació
 * el porten sencer: sense refer-lo, els 311 municipis de la província es
 * quedaven sense europees i ningú no ho hauria vist.
 */
export const codiIne = (codi: string): string => codi.trim().padStart(5, "0");

/** Els territoris de «Residents absents» que la font posa al nivell municipi: no són cap municipi. */
export const esResidentsAbsents = (codi: string): boolean => /^\d{2}998$/.test(codiIne(codi));

/**
 * Les sigles nacionals d'aquestes cinc eleccions, a la família de la casa.
 *
 * `siglesFamily()` les encerta totes menys una (comprovat amb les 73 sigles
 * diferents que surten a les cinc convocatòries): **Podemos**, que a les
 * europees del 2024 va anar sol i no amb els Comuns, i no té cap patró. La
 * taula les diu totes igualment perquè són les que pesen: si algun dia algú
 * toca un patró de `brands.ts` pensant en una llista local, el vot del
 * Parlament no ha de canviar de família sense que un test ho digui. La clau
 * és la sigla normalitzada sense res que no sigui lletra o xifra.
 */
export const FAMILIA_SIGLES_NACIONALS: Readonly<Record<string, string>> = {
  psc: "psc",
  erc: "erc",
  ercararepubl: "erc",
  ercsobiranistes: "erc",
  catjunts: "junts",
  jxcat: "junts",
  jxcatjunts: "junts",
  pp: "pp",
  vox: "vox",
  cs: "cs",
  comunssumar: "comuns",
  sumarecp: "comuns",
  ecppec: "comuns",
  ecpguanyem: "comuns",
  podemos: "podem",
  cupdt: "cup",
  cupg: "cup",
  cuppr: "cup",
  aliancacat: "aliancacat",
  pdecat: "pdecat",
  pdecateciu: "pdecat",
  pnc: "pdecat",
};

const clauSigles = (sigles: string): string => normalize(sigles).replace(/[^a-z0-9]/g, "");

/** La família d'unes sigles nacionals: la taula, i si no hi són, `siglesFamily()`; `null` és «altres». */
export function familiaNacional(sigles: string): string | null {
  return FAMILIA_SIGLES_NACIONALS[clauSigles(sigles)] ?? siglesFamily(sigles);
}

// ─────────────────────────────────────────────────────────────────────────────
// De les files del portal a les eleccions d'un municipi
// ─────────────────────────────────────────────────────────────────────────────

/** Una fila de `ntc4-rnwr`, tal com arriba: tot són textos. */
export type FilaVots = {
  id_eleccio: string;
  territori_codi: string;
  candidatura_codi?: string;
  candidatura_sigles?: string;
  candidatura_denominacio?: string;
  candidatura_color?: string;
  vots?: string;
};

/** Una fila de `irrv-2mfc`, tal com arriba. */
export type FilaParticipacioAltres = {
  id_eleccio: string;
  territori_codi: string;
  territori_nom?: string;
  cens_electoral?: string;
  votants?: string;
  vots_nuls?: string;
  vots_blancs?: string;
  vots_valids?: string;
};

export type LlistaAltra = {
  sigles: string;
  vots: number;
  /** Sobre els vots a candidatures, amb un decimal. */
  pct: number;
  /** El color de la candidatura a la font, només com a marca de dades; `null` si no és un hexadecimal. */
  color: string | null;
  /** La família de la casa (`psc`, `junts`…) o `null`: «altres». */
  familia: string | null;
};

export type EleccioAltra = {
  id: string;
  tipus: TipusEleccio;
  any: number;
  data: string;
  principal: boolean;
  cens: number | null;
  votants: number | null;
  /** Votants sobre cens, amb un decimal; `null` si falta el cens o els votants. */
  participacio: number | null;
  vots_valids: number | null;
  blancs: number | null;
  nuls: number | null;
  /** La suma dels vots de totes les llistes: el denominador dels percentatges. */
  votsCandidatures: number;
  /** Les `LLISTES_DESADES` més votades, de més a menys. */
  llistes: LlistaAltra[];
  /** La resta, juntes; `null` si no n'hi ha cap més. */
  altres: { llistes: number; vots: number; pct: number } | null;
  /** El percentatge de cada família sumant totes les llistes, no només les desades. */
  families: Record<string, number>;
};

const pctDe = (part: number, total: number): number => (total > 0 ? arrodoneix((100 * part) / total, 1) : 0);
const colorValid = (color: string | undefined): string | null =>
  color && /^#[0-9a-f]{6}$/i.test(color.trim()) ? color.trim().toUpperCase() : null;

/**
 * Una elecció d'un municipi a partir de les seves files de vots i de la seva
 * fila de participació. Sense cap vot a cap llista i sense participació no hi
 * ha elecció: `null`, que la mètrica desa com a buit.
 */
export function eleccioDelMunicipi(
  eleccio: EleccioDeLaLlista,
  vots: readonly FilaVots[],
  participacio: FilaParticipacioAltres | undefined,
): EleccioAltra | null {
  const llistes = vots
    .map((f) => ({ f, vots: toInt(f.vots) ?? 0 }))
    .filter(({ f }) => (f.candidatura_sigles ?? "").trim() !== "")
    .sort((a, b) => b.vots - a.vots || a.f.candidatura_sigles!.localeCompare(b.f.candidatura_sigles!, "ca"));
  const votsCandidatures = llistes.reduce((suma, l) => suma + l.vots, 0);
  const cens = toInt(participacio?.cens_electoral);
  const votants = toInt(participacio?.votants);
  if (votsCandidatures === 0 && (cens === null || votants === null)) return null;

  const families: Record<string, number> = {};
  const votsFamilia = new Map<string, number>();
  for (const l of llistes) {
    const familia = familiaNacional(l.f.candidatura_sigles!);
    if (familia) votsFamilia.set(familia, (votsFamilia.get(familia) ?? 0) + l.vots);
  }
  for (const [familia, v] of [...votsFamilia].sort((a, b) => b[1] - a[1])) families[familia] = pctDe(v, votsCandidatures);

  const desades = llistes.slice(0, LLISTES_DESADES);
  const resta = llistes.slice(LLISTES_DESADES);
  const votsResta = resta.reduce((suma, l) => suma + l.vots, 0);
  return {
    id: eleccio.id,
    tipus: eleccio.tipus,
    any: eleccio.any,
    data: eleccio.data,
    principal: eleccio.principal,
    cens,
    votants,
    participacio: cens !== null && cens > 0 && votants !== null ? arrodoneix((100 * votants) / cens, 1) : null,
    vots_valids: toInt(participacio?.vots_valids),
    blancs: toInt(participacio?.vots_blancs),
    nuls: toInt(participacio?.vots_nuls),
    votsCandidatures,
    llistes: desades.map(({ f, vots: v }) => ({
      sigles: f.candidatura_sigles!.trim(),
      vots: v,
      pct: pctDe(v, votsCandidatures),
      color: colorValid(f.candidatura_color),
      familia: familiaNacional(f.candidatura_sigles!),
    })),
    altres: resta.length > 0 ? { llistes: resta.length, vots: votsResta, pct: pctDe(votsResta, votsCandidatures) } : null,
    families,
  };
}

/**
 * Les cinc eleccions d'un municipi, en l'ordre de `ELECCIONS_ALTRES`, i les
 * que no hi són. Les files poden portar altres eleccions: s'ignoren.
 */
export function eleccionsAltresDelMunicipi(
  vots: readonly FilaVots[],
  participacio: readonly FilaParticipacioAltres[],
): { eleccions: EleccioAltra[]; buits: string[] } {
  const eleccions: EleccioAltra[] = [];
  const buits: string[] = [];
  for (const eleccio of ELECCIONS_ALTRES) {
    const resultat = eleccioDelMunicipi(
      eleccio,
      vots.filter((f) => f.id_eleccio === eleccio.id),
      participacio.find((f) => f.id_eleccio === eleccio.id),
    );
    if (resultat) eleccions.push(resultat);
    else buits.push(eleccio.id);
  }
  return { eleccions, buits };
}

// ─────────────────────────────────────────────────────────────────────────────
// La mètrica, i la feina
// ─────────────────────────────────────────────────────────────────────────────

export const FONT_ALTRES = {
  nom: "Processos electorals · Vots i Participació",
  organisme: "Generalitat de Catalunya, Subdirecció General de Processos Electorals i Democràcia Directa",
  url: URL_VOTS,
  urlParticipacio: URL_PARTICIPACIO,
  llicencia: "Condicions d'ús del portal de dades obertes: reutilització amb atribució i sense alterar el sentit",
} as const;

export const NOTA_ALTRES =
  "Els percentatges de cada llista són sobre els vots a candidatures, sense blancs ni nuls, com els de les " +
  "municipals de la fitxa. La participació és la dels residents al municipi: el vot de l'estranger la font el " +
  "dona per província i no s'hi compta. Les llistes locals i d'independents només es presenten a les " +
  "municipals, i una mateixa força canvia de nom i de socis d'una elecció a l'altra: la comparació per família " +
  "política és aproximada.";

export type AltresEleccionsMetric = {
  font: typeof FONT_ALTRES & { consultat: string };
  /** Les eleccions amb dada, en l'ordre de `ELECCIONS_ALTRES`: primer les tres principals. */
  eleccions: EleccioAltra[];
  /** Les de la llista que no tenen dada: buits, no zeros. */
  buits: string[];
  nota: string;
};

/**
 * Una crida paginada per elecció a `ntc4-rnwr` (unes 90.000 files entre les
 * cinc, la majoria de les europees, que porten 34 llistes) i una de sola a
 * `irrv-2mfc`; després, la mètrica `altresEleccions` de cada municipi amb
 * almenys una elecció. És idempotent i **esborra** la mètrica dels municipis
 * que ja no en tenen cap. No llegeix cap altra mètrica: només la taula de
 * municipis.
 */
export async function j43AltresEleccions(db: Db): Promise<void> {
  const tots = await db
    .select({ id: municipalities.id, name: municipalities.name, ine5: municipalities.ine5 })
    .from(municipalities);
  const perIne = new Map(tots.map((m) => [m.ine5, m]));

  await withRun(db, "J43 altres eleccions: Parlament, Congrés i Parlament Europeu per municipi", async (run) => {
    const consultat = new Date().toISOString().slice(0, 10);
    const ids = ELECCIONS_ALTRES.map((e) => `'${e.id}'`).join(",");

    // ── 1. Les crides: vots elecció a elecció, i la participació d'un cop ────
    const vots: FilaVots[] = [];
    for (const eleccio of ELECCIONS_ALTRES) {
      const files = await socrataAll<FilaVots>(CONJUNT_VOTS, {
        where: `id_eleccio='${eleccio.id}' AND id_nivell_territorial='MU'`,
        select: "id_eleccio,territori_codi,candidatura_codi,candidatura_sigles,candidatura_color,vots",
      }, 10_000);
      if (files.length === 0) {
        await run.issue({ kind: "altres eleccions: elecció sense cap vot a la font", severity: "alta", entity: eleccio.id });
      }
      vots.push(...files);
    }
    const participacio = await socrataAll<FilaParticipacioAltres>(CONJUNT_PARTICIPACIO, {
      where: `id_nivell_territorial='MU' AND id_eleccio in(${ids})`,
      select: "id_eleccio,territori_codi,cens_electoral,votants,vots_nuls,vots_blancs,vots_valids",
    }, 10_000);
    run.rowsIn = vots.length + participacio.length;

    // ── 2. Repartir per municipi; els «Residents absents» no en són cap ─────
    const votsPerIne = new Map<string, FilaVots[]>();
    const partPerIne = new Map<string, FilaParticipacioAltres[]>();
    const desconeguts = new Set<string>();
    const reparteix = <F extends { territori_codi: string }>(files: readonly F[], desti: Map<string, F[]>): void => {
      for (const fila of files) {
        const codi = codiIne(fila.territori_codi);
        if (esResidentsAbsents(codi)) continue;
        if (!perIne.has(codi)) {
          desconeguts.add(codi);
          continue;
        }
        const llista = desti.get(codi);
        if (llista) llista.push(fila);
        else desti.set(codi, [fila]);
      }
    };
    reparteix(vots, votsPerIne);
    reparteix(participacio, partPerIne);
    for (const codi of desconeguts) await run.issue({ kind: "unknown_municipality", severity: "baixa", entity: codi });
    run.say(`${vots.length} files de vots · ${participacio.length} de participació · ${desconeguts.size} codis desconeguts`);

    // ── 3. La mètrica de cada municipi ──────────────────────────────────────
    const desats: number[] = [];
    let ambBuits = 0;
    for (const municipi of tots) {
      const { eleccions, buits } = eleccionsAltresDelMunicipi(
        votsPerIne.get(municipi.ine5) ?? [],
        partPerIne.get(municipi.ine5) ?? [],
      );
      if (eleccions.length === 0) {
        await run.issue({
          kind: "altres eleccions: municipi sense cap elecció amb dada",
          severity: "mitjana",
          municipalityId: municipi.id,
          entity: municipi.name,
        });
        continue;
      }
      if (buits.length > 0) ambBuits += 1;
      const metrica: AltresEleccionsMetric = { font: { ...FONT_ALTRES, consultat }, eleccions, buits, nota: NOTA_ALTRES };
      await db
        .insert(municipalityMetrics)
        .values({ municipalityId: municipi.id, kind: KIND, data: metrica })
        .onConflictDoUpdate({
          target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
          set: { data: metrica, computedAt: new Date() },
        });
      desats.push(municipi.id);
      run.rowsOut += 1;
    }
    await db.delete(municipalityMetrics).where(
      desats.length > 0
        ? and(eq(municipalityMetrics.kind, KIND), notInArray(municipalityMetrics.municipalityId, desats))
        : eq(municipalityMetrics.kind, KIND),
    );

    run.say(`${run.rowsOut} municipis amb altres eleccions · ${ambBuits} amb alguna elecció sense dada`);
    return { municipis: run.rowsOut, ambBuits, codisDesconeguts: [...desconeguts] };
  });
}
