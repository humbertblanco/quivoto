import { electionParticipation, municipalities, type Db } from "@quivoto/db";
import { buildPeerGroups, medianOf, percentileOf, type PeerGroup } from "../derive/peers";
import { carregaMetriques } from "./metriques";

/**
 * Amb què es compara una xifra que fins ara es llegia sola.
 *
 * Els comptes ja porten la mediana del grup damunt del regle, i és el que fa
 * que un import vulgui dir alguna cosa: 458 € d'IBI no són ni molt ni poc fins
 * que no se sap què paga la resta. La participació i la paritat sortien sense
 * cap referència —un 60,6 % i prou—, i qui llegeix no té manera de saber si
 * això és normal al seu poble o és una anomalia. Aquí es calcula la mediana per
 * a totes dues.
 *
 * El grup de comparació és el mateix que fan servir els comptes: el tram de
 * població de la LOREG, no tot Catalunya. Comparar la participació de Barcelona
 * amb la d'un poble de dos-cents habitants no diu res —als pobles petits sempre
 * hi vota molta més gent, i és una propietat de la mida, no del municipi.
 */

export type MedianaGrup = {
  /** La mediana del grup, en la mateixa unitat que la xifra. */
  mediana: number;
  /** Quants municipis del grup tenen la dada. Sense això la mediana no es pot jutjar. */
  quants: number;
  /** Com es diu el grup: «de 20.001 a 50.000 habitants». */
  etiqueta: string;
  /** On queda aquest municipi dins del grup, de 0 a 100. */
  percentil: number | null;
  /**
   * Tots els valors del grup, ordenats.
   *
   * Hi són perquè la fitxa en pugui dibuixar la forma. Amb la mediana sola, un
   * percentil 70 d'un grup atapeït i un percentil 70 d'un grup partit en dos es
   * llegeixen igual, i no volen dir el mateix. No arriben a la pàgina tal com
   * són: el que s'hi publica són les caselles de l'histograma.
   */
  valors: readonly number[];
};

export type MedianesMunicipi = {
  /** Participació per elecció, en percentatge del cens. */
  participacio: Record<string, MedianaGrup | null>;
  /** Dones al ple, en percentatge de les regidories. */
  donesAlPle: MedianaGrup | null;
};

/**
 * De la paritat només entra a la mediana **el que és una paritat de debò**.
 *
 * El conjunt de candidatures no porta la llista sencera dels municipis petits:
 * 213 dels 947 tenen menys electes que regidories, i entre ells tots els 152
 * plens de cinc. Amb ells a dins, la mediana del tram de 101 a 250 habitants
 * sortia **0 %** i mostrava pobles amb un 100 %, que són un de zero i un d'un.
 * Una mediana calculada sobre denominadors que no són el ple no és la mediana
 * de res.
 */
type ParityMetric = { womenElectedPct: number | null; complet?: boolean } | null;

/** Files de participació, demanades de tros en tros com la resta. */
async function totaLaParticipacio(db: Db): Promise<(typeof electionParticipation.$inferSelect)[]> {
  const BLOC = 4_000;
  const files: (typeof electionParticipation.$inferSelect)[] = [];
  for (let salta = 0; ; salta += BLOC) {
    const tros = await db
      .select()
      .from(electionParticipation)
      .orderBy(electionParticipation.municipalityId)
      .limit(BLOC)
      .offset(salta);
    files.push(...tros);
    if (tros.length < BLOC) break;
  }
  return files;
}

/**
 * La mediana d'un valor dins del grup d'un municipi, i on hi queda ell.
 *
 * El municipi **no s'exclou** del seu propi grup: la mediana que s'ensenya és
 * la del conjunt de municipis de la seva mida, ell inclòs, que és el que diu
 * la frase. Amb 12 municipis com a mínim per grup, treure'n un no mou la xifra
 * i sí que faria que dos pobles del mateix tram veiessin medianes diferents.
 */
export function medianaDelGrup(
  valorsPerGrup: Map<string, number[]>,
  grup: PeerGroup,
  valor: number | null,
): MedianaGrup | null {
  const valors = valorsPerGrup.get(grup.key);
  if (!valors || valors.length === 0) return null;
  const mediana = medianOf(valors);
  if (mediana === null) return null;
  return {
    mediana,
    quants: valors.length,
    etiqueta: grup.label,
    percentil: valor === null ? null : percentileOf(valor, valors),
    valors: [...valors].sort((a, b) => a - b),
  };
}

export async function carregaMedianes(db: Db): Promise<Map<number, MedianesMunicipi>> {
  const tots = await db
    .select({ id: municipalities.id, population: municipalities.population })
    .from(municipalities);
  const grups = buildPeerGroups(tots);

  // --- participació: percentatge del cens que va votar, elecció per elecció
  const participacio = await totaLaParticipacio(db);
  const percentatgePerMunicipi = new Map<number, Map<string, number>>();
  for (const fila of participacio) {
    // Sense cens no hi ha percentatge, i un cens de zero seria una divisió que
    // no es pot fer: aquestes files no compten ni per a la mediana ni per al
    // municipi. Val més no dir res que dir un 0 %.
    if (!fila.censusSize || fila.voters === null) continue;
    let seves = percentatgePerMunicipi.get(fila.municipalityId);
    if (!seves) percentatgePerMunicipi.set(fila.municipalityId, (seves = new Map()));
    seves.set(fila.electionId, (100 * fila.voters) / fila.censusSize);
  }
  const eleccions = new Set<string>();
  for (const seves of percentatgePerMunicipi.values()) for (const id of seves.keys()) eleccions.add(id);

  const participacioPerGrup = new Map<string, Map<string, number[]>>();
  for (const electionId of eleccions) {
    const perGrup = new Map<string, number[]>();
    for (const [municipalityId, seves] of percentatgePerMunicipi) {
      const valor = seves.get(electionId);
      const grup = grups.get(municipalityId);
      if (valor === undefined || !grup) continue;
      const llista = perGrup.get(grup.key);
      if (llista) llista.push(valor);
      else perGrup.set(grup.key, [valor]);
    }
    participacioPerGrup.set(electionId, perGrup);
  }

  // --- paritat: percentatge de dones al ple
  const paritats = await carregaMetriques(db, ["parity"]);
  const donesPerMunicipi = new Map<number, number>();
  for (const fila of paritats) {
    const dada = fila.data as ParityMetric;
    if (dada?.complet !== true) continue;
    const pct = dada.womenElectedPct;
    if (typeof pct === "number") donesPerMunicipi.set(fila.municipalityId, pct);
  }
  const donesPerGrup = new Map<string, number[]>();
  for (const [municipalityId, pct] of donesPerMunicipi) {
    const grup = grups.get(municipalityId);
    if (!grup) continue;
    const llista = donesPerGrup.get(grup.key);
    if (llista) llista.push(pct);
    else donesPerGrup.set(grup.key, [pct]);
  }

  const resultat = new Map<number, MedianesMunicipi>();
  for (const [municipalityId, grup] of grups) {
    const seves = percentatgePerMunicipi.get(municipalityId);
    const perEleccio: Record<string, MedianaGrup | null> = {};
    for (const electionId of eleccions) {
      perEleccio[electionId] = medianaDelGrup(
        participacioPerGrup.get(electionId) ?? new Map(),
        grup,
        seves?.get(electionId) ?? null,
      );
    }
    resultat.set(municipalityId, {
      participacio: perEleccio,
      donesAlPle: medianaDelGrup(donesPerGrup, grup, donesPerMunicipi.get(municipalityId) ?? null),
    });
  }
  return resultat;
}
