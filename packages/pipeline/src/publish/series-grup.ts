import { municipalFinances, municipalities, type Db } from "@quivoto/db";
import { buildPeerGroups } from "../derive/peers";
import type { BandaGrup } from "./grafics";

/**
 * On es movien els municipis de la seva mida, **any per any**.
 *
 * La fitxa ja comparava amb el grup, però sempre a l'últim exercici: una sola
 * marca damunt d'un regle. Amb això, una xifra que fa deu anys que és per sobre
 * i una que hi ha arribat el mes passat es llegeixen igual. El pla de dades ho
 * diu amb totes les lletres: «l'única sèrie completa és el deute (2015-2025,
 * 947 municipis) i no es dibuixa enlloc. Com ha anat el deute comparat amb els
 * del seu grup és la peça que converteix una foto en un judici, i es pot fer
 * sense cap dada nova».
 *
 * Aquí es calcula un cop per a les 947 fitxes, com les medianes: per saber on
 * queda un municipi cal llegir-los tots, i fer-ho fitxa per fitxa serien 947
 * lectures de la taula sencera.
 *
 * Es publica la **meitat central** del grup —del percentil 25 al 75— i no el
 * mínim i el màxim. El màxim d'un grup de dos-cents municipis és sempre un cas
 * extrem, i una banda que va de 0 a 4.000 € no diu res de com es mouen els
 * altres cent noranta-vuit.
 */

/** Quants municipis del grup han de tenir la dada d'un any perquè es publiqui. */
const MINIM_PER_ANY = 12;

/** Primer exercici que es dibuixa: el mateix que ja fa servir la fitxa. */
const DES_DE = 2015;

export type SeriesMunicipi = {
  /** Deute per habitant del municipi, any a any. */
  deute: { any: number; valor: number }[];
  /** La meitat central del seu grup, any a any. */
  deuteGrup: BandaGrup[];
  /** Com es diu el grup, per dir amb qui es compara. */
  grup: string | null;
  /** Quants municipis del grup entren a la banda de l'últim any dibuixat. */
  quants: number;
};

/** Percentil d'una llista **ja ordenada**, per interpolació lineal. */
export function percentilOrdenat(ordenats: readonly number[], p: number): number | null {
  if (ordenats.length === 0) return null;
  if (ordenats.length === 1) return ordenats[0]!;
  const lloc = (p / 100) * (ordenats.length - 1);
  const baix = Math.floor(lloc);
  const dalt = Math.ceil(lloc);
  if (baix === dalt) return ordenats[baix]!;
  return ordenats[baix]! + (ordenats[dalt]! - ordenats[baix]!) * (lloc - baix);
}

/** Files de comptes, demanades de tros en tros com la resta. */
async function totsElsComptes(db: Db): Promise<(typeof municipalFinances.$inferSelect)[]> {
  const BLOC = 4_000;
  const files: (typeof municipalFinances.$inferSelect)[] = [];
  for (let salta = 0; ; salta += BLOC) {
    const tros = await db
      .select()
      .from(municipalFinances)
      .orderBy(municipalFinances.municipalityId, municipalFinances.year)
      .limit(BLOC)
      .offset(salta);
    files.push(...tros);
    if (tros.length < BLOC) break;
  }
  return files;
}

export async function carregaSeriesGrup(db: Db): Promise<Map<number, SeriesMunicipi>> {
  const tots = await db
    .select({ id: municipalities.id, population: municipalities.population })
    .from(municipalities);
  const grups = buildPeerGroups(tots);

  const comptes = await totsElsComptes(db);

  // Deute per habitant de cada municipi i any. La població és la de l'exercici,
  // no la d'ara: dividir el deute del 2015 per la gent del 2025 faria baixar el
  // deute de tots els pobles que han crescut sense que ningú hagi pagat res.
  const perMunicipi = new Map<number, { any: number; valor: number }[]>();
  for (const fila of comptes) {
    if (fila.year < DES_DE) continue;
    const deute = fila.debt === null ? null : Number(fila.debt);
    const habitants = fila.population ?? 0;
    if (deute === null || !Number.isFinite(deute) || habitants <= 0) continue;
    const valor = Math.round(deute / habitants);
    const seves = perMunicipi.get(fila.municipalityId);
    if (seves) seves.push({ any: fila.year, valor });
    else perMunicipi.set(fila.municipalityId, [{ any: fila.year, valor }]);
  }

  // Els valors del grup, any per any.
  const perGrupIAny = new Map<string, Map<number, number[]>>();
  for (const [municipalityId, serie] of perMunicipi) {
    const grup = grups.get(municipalityId);
    if (!grup) continue;
    let anys = perGrupIAny.get(grup.key);
    if (!anys) perGrupIAny.set(grup.key, (anys = new Map()));
    for (const punt of serie) {
      const llista = anys.get(punt.any);
      if (llista) llista.push(punt.valor);
      else anys.set(punt.any, [punt.valor]);
    }
  }

  const bandes = new Map<string, BandaGrup[]>();
  for (const [clau, anys] of perGrupIAny) {
    const banda: BandaGrup[] = [];
    for (const [any, valors] of [...anys].sort((a, b) => a[0] - b[0])) {
      // Un any amb quatre municipis no és un grup: la banda sortiria estretíssima
      // o amplíssima segons quins quatre fossin, i faria semblar precisa una
      // comparació que no ho és.
      if (valors.length < MINIM_PER_ANY) continue;
      const ordenats = [...valors].sort((a, b) => a - b);
      banda.push({
        any,
        p25: Math.round(percentilOrdenat(ordenats, 25)!),
        p50: Math.round(percentilOrdenat(ordenats, 50)!),
        p75: Math.round(percentilOrdenat(ordenats, 75)!),
      });
    }
    bandes.set(clau, banda);
  }

  const resultat = new Map<number, SeriesMunicipi>();
  for (const [municipalityId, grup] of grups) {
    const deute = (perMunicipi.get(municipalityId) ?? []).sort((a, b) => a.any - b.any);
    const banda = bandes.get(grup.key) ?? [];
    const ultimAny = deute[deute.length - 1]?.any ?? null;
    resultat.set(municipalityId, {
      deute,
      deuteGrup: banda,
      grup: grup.label,
      quants: (perGrupIAny.get(grup.key)?.get(ultimAny ?? -1) ?? []).length,
    });
  }
  return resultat;
}
