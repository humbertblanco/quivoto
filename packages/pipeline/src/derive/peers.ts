import { councilSeats } from "@quivoto/shared-schemas/seats";

/**
 * Grups de comparació.
 *
 * Comparar un municipi amb la mediana de tot Catalunya barreja Barcelona amb un
 * poble de tres-cents habitants, i el resultat no vol dir res: és normal que una
 * ciutat gasti més per habitant en administració i que un poble petit no tingui
 * deute. Perquè un percentil informi, el municipi s'ha de comparar amb els que
 * s'hi assemblen.
 *
 * El criteri és el **tram de població de la LOREG** (article 179), que ja és una
 * classificació oficial: és la mateixa que decideix quants regidors té el ple, i
 * per tant no ens l'hem inventat nosaltres ni la pot discutir ningú. Quan un tram
 * té pocs municipis se li afegeixen els trams veïns, perquè un percentil sobre
 * quatre municipis és soroll.
 */

/** Sota d'aquesta mida, un percentil no significa res i cal eixamplar el grup. */
export const MIN_GROUP = 12;

export type PeerGroup = {
  key: string;
  label: string;
  size: number;
};

/**
 * Trams de la LOREG, de petit a gran. Es guarden els límits de població i no
 * només el text, perquè quan dos trams s'ajunten el nom del grup s'ha de tornar
 * a escriure a partir dels números: si no, en surten etiquetes com «de 50.001 a
 * de més de 100.000 habitants».
 */
const BRACKETS: ReadonlyArray<{ seats: number; min: number; max: number | null }> = [
  { seats: 3, min: 0, max: 100 },
  { seats: 5, min: 101, max: 250 },
  { seats: 7, min: 251, max: 1_000 },
  { seats: 9, min: 1_001, max: 2_000 },
  { seats: 11, min: 2_001, max: 5_000 },
  { seats: 13, min: 5_001, max: 10_000 },
  { seats: 17, min: 10_001, max: 20_000 },
  { seats: 21, min: 20_001, max: 50_000 },
  { seats: 25, min: 50_001, max: 100_000 },
];

const BIG = { seats: 27, min: 100_001, max: null };

const milers = (n: number): string => n.toLocaleString("ca-ES");

/** Nom del grup a partir dels límits de població, per dir amb qui es compara. */
function labelFor(min: number, max: number | null): string {
  // Un sol grup per a tot: passa quan hi ha pocs municipis, i el nom ho ha de dir.
  if (min === 0 && max === null) return "tots els municipis";
  if (max === null) return `de més de ${milers(min - 1)} habitants`;
  if (min === 0) return `fins a ${milers(max)} habitants`;
  return `de ${milers(min)} a ${milers(max)} habitants`;
}

/** Índex del tram al qual pertany una població. */
export function bracketIndexFor(population: number): number {
  const seats = councilSeats(population);
  const index = BRACKETS.findIndex((b) => b.seats === seats);
  return index === -1 ? BRACKETS.length : index;
}

/**
 * Assigna un grup a cada municipi. Els trams massa petits s'ajunten amb el veí
 * de sota fins que el grup arriba a `MIN_GROUP`, i el nom del grup ho reflecteix
 * perquè el lector sàpiga amb qui s'està comparant.
 */
export function buildPeerGroups(
  municipalities: readonly { id: number; population: number | null }[],
): Map<number, PeerGroup> {
  const all = [...BRACKETS, BIG];
  const byBracket = new Map<number, number[]>();
  for (const m of municipalities) {
    if (m.population === null) continue;
    const index = bracketIndexFor(m.population);
    const list = byBracket.get(index);
    if (list) list.push(m.id);
    else byBracket.set(index, [m.id]);
  }

  // Fusió de trams petits, de dalt a baix: el tram gran és el que sol quedar curt.
  const merged: { indices: number[]; members: number[] }[] = [];
  let pending: number[] = [];
  let pendingIndices: number[] = [];
  for (let i = all.length - 1; i >= 0; i -= 1) {
    pending = [...(byBracket.get(i) ?? []), ...pending];
    pendingIndices = [i, ...pendingIndices];
    if (pending.length >= MIN_GROUP) {
      merged.push({ indices: pendingIndices, members: pending });
      pending = [];
      pendingIndices = [];
    }
  }
  // El que quedi sense arribar al mínim s'enganxa al grup més petit ja tancat.
  if (pending.length > 0) {
    const last = merged[merged.length - 1];
    if (last) {
      last.members.push(...pending);
      last.indices.unshift(...pendingIndices);
    } else {
      merged.push({ indices: pendingIndices, members: pending });
    }
  }

  const result = new Map<number, PeerGroup>();
  for (const group of merged) {
    // El nom surt dels trams que **tenen** municipis, no de tots els que el grup
    // abraça. Si un grup arrossega trams buits perquè s'ha hagut d'eixamplar,
    // dir «fins a 20.000 habitants» quan tots en tenen menys de cent seria
    // descriure malament amb qui s'està comparant el lector.
    const populated = group.indices.filter((i) => (byBracket.get(i) ?? []).length > 0);
    const span = populated.length > 0 ? populated : group.indices;
    const first = span[0]!;
    const last = span[span.length - 1]!;
    const label = labelFor(all[first]!.min, all[last]!.max);
    const peer: PeerGroup = { key: `t${first}-${last}`, label, size: group.members.length };
    for (const id of group.members) result.set(id, peer);
  }
  return result;
}

/**
 * Percentil d'un valor dins d'una llista. 0 vol dir el més baix del grup i 100
 * el més alt. Es fa servir la definició de rang mitjà, que reparteix bé els
 * empats —i n'hi ha molts: 400 municipis tenen zero deute.
 */
export function percentileOf(value: number, values: readonly number[]): number | null {
  if (values.length === 0) return null;
  let below = 0;
  let equal = 0;
  for (const other of values) {
    if (other < value) below += 1;
    else if (other === value) equal += 1;
  }
  return Math.round((100 * (below + equal / 2)) / values.length);
}

/** Mediana d'una llista de números. */
export function medianOf(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}
