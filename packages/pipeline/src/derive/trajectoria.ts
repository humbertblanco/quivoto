import { eq } from "drizzle-orm";
import {
  candidatures, electionParticipation, electionResults, mayors, municipalities,
  municipalityMetrics, type Db,
} from "@quivoto/db";
import { MUNICIPAL_ELECTIONS, sameForce, siglesFamily } from "@quivoto/shared-schemas/brands";
import { MIN_GROUP, buildPeerGroups, medianOf, percentileOf } from "./peers";
import { normalizePersonName } from "../lib/text";
import { withRun } from "../lib/run";

/**
 * Trajectòria: quants anys porta manant el mateix, i el vot que no va servir.
 *
 * Dues preguntes que la fitxa encara no respon i que es poden contestar amb el
 * que ja tenim carregat, sense demanar res a ningú:
 *
 *   1. **Continuïtat al poder.** L'historial d'alcaldies arriba al 1979 i la
 *      sèrie electoral també. Amb això es pot dir quants anys seguits governa la
 *      mateixa força, quants en porta la persona que hi és ara, quanta gent hi ha
 *      passat i —amb l'índex de Pedersen sobre els escons— si el poble és
 *      previsible o si es mou. Davant d'una elecció, saber si el resultat sol
 *      moure's és tan informatiu com saber qui va guanyar l'última.
 *   2. **El vot que no va treure representació.** La participació ja porta els
 *      nuls i els blancs, i els resultats diuen quines candidatures es van quedar
 *      a zero. Sumat, això respon «quina part dels vots del meu poble no va
 *      arribar al ple», que és una manera molt concreta de dir què s'hi juga qui
 *      dubta entre votar una llista petita o no votar.
 *
 * Tot són càlculs deterministes sobre dades oficials: es poden refer i es poden
 * discutir amb la font a la mà.
 */

// ----------------------------------------------------------------- continuïtat

/** Un pas per l'alcaldia: qui, amb quines sigles, en quina legislatura i des de quan. */
export type PasAlcaldia = {
  /** «2023-2027», tal com ho publica la font. */
  legislatura: string;
  nom: string;
  sigles: string | null;
  /** Presa de possessió, quan la font la dona. */
  desDe: string | null;
};

export type Ratxa = {
  desDeLegislatura: string;
  desDeAny: number;
  /** Data d'inici de la ratxa, si es pot afirmar. */
  desDe: string | null;
  anys: number;
  legislatures: number;
  /**
   * Cert quan la data d'inici s'ha hagut de deduir de la legislatura perquè la
   * font no la dona. Les legislatures del 2011 al 2023 no porten cap data.
   */
  aproximat: boolean;
  /** Cert si la ratxa arriba fins a la primera legislatura que consta. */
  ininterromput: boolean;
  /**
   * Legislatures que la ratxa travessa **sense cap alcalde registrat**.
   *
   * Sense això, Torroella de Fluvià publicava «el PSC porta 47 anys a
   * l'alcaldia, ininterromput» quan a la font no hi ha ningú per al 1983-1987
   * ni per al 1995-1999. Arribar a la primera fila que tenim no és el mateix
   * que no haver-se interromput mai.
   */
  forats: string[];
  /**
   * Cert quan la ratxa s'ha aturat perquè el pas anterior no diu de quin partit
   * era. `sameForce` és prudent i davant del dubte diu que és la mateixa força,
   * cosa que va bé per no inventar alternances però que aquí allargava la ratxa
   * cap enrere dins d'un mandat del qual no sabem res.
   */
  aturadaPerDesconegut: boolean;
};

export type Alternanca = { legislatura: string; de: string | null; a: string | null };

export type Continuitat = {
  actual: { nom: string; sigles: string | null; familia: string | null; legislatura: string } | null;
  partit: (Ratxa & { sigles: string | null; familia: string | null }) | null;
  persona: (Ratxa & { nom: string }) | null;
  personesDiferents: number;
  forcesDiferents: number;
  legislatures: number;
  primeraLegislatura: string | null;
  alternances: number;
  alternancesDetall: Alternanca[];
};

/**
 * Les municipals es constitueixen al juny. Només serveix de reserva quan la font
 * no dona cap data ni per a aquella legislatura ni per a cap altre municipi.
 */
const CONSTITUCIO_PER_DEFECTE = "-06-15";

const anyDe = (legislatura: string): number => Number(legislatura.slice(0, 4));

/** Anys sencers entre dues dates: «en porta 3» no pot arrodonir cap amunt. */
export function anysComplets(desDe: string, fins: Date): number {
  const inici = new Date(desDe);
  const anys = fins.getUTCFullYear() - inici.getUTCFullYear();
  const abansDeLAniversari =
    fins.getUTCMonth() < inici.getUTCMonth() ||
    (fins.getUTCMonth() === inici.getUTCMonth() && fins.getUTCDate() < inici.getUTCDate());
  return Math.max(0, abansDeLAniversari ? anys - 1 : anys);
}

/**
 * Dos noms són la mateixa persona si difereixen com a molt en una lletra.
 *
 * No és una floritura: l'historial d'alcaldies escriu el mateix alcalde
 * d'Esplugues com a «LORENZO PALACIN BADORREY» i «LORENZO PALACÍN BODORREY».
 * Comptats com a dues persones, un poble que ha tingut cinc alcaldes en surt amb
 * sis i la xifra publicada seria falsa.
 */
export function mateixaPersona(a: string, b: string): boolean {
  const x = normalizePersonName(a);
  const y = normalizePersonName(b);
  if (x === y) return true;
  if (x.length < 8 || Math.abs(x.length - y.length) > 1) return false;
  // Distància d'edició amb sostre 1: n'hi ha prou per a les errates de teclat.
  let i = 0;
  while (i < x.length && i < y.length && x[i] === y[i]) i += 1;
  let j = 0;
  while (j < x.length - i && j < y.length - i && x[x.length - 1 - j] === y[y.length - 1 - j]) j += 1;
  return x.length - i - j <= 1 && y.length - i - j <= 1;
}

/**
 * Ordena els passos per l'alcaldia del més antic al més recent.
 *
 * Dins d'una legislatura sense dates no es pot saber qui va anar primer, i això
 * passa a totes les del 2011 al 2023: la font no en publica cap presa de
 * possessió. Per això la ratxa que en surt es marca com a aproximada en comptes
 * de fingir una precisió que no tenim.
 */
function ordena(passos: readonly PasAlcaldia[]): PasAlcaldia[] {
  return [...passos].sort(
    (a, b) => anyDe(a.legislatura) - anyDe(b.legislatura) || (a.desDe ?? "").localeCompare(b.desDe ?? ""),
  );
}

function ratxaDes(
  passos: readonly PasAlcaldia[],
  primerIndex: number,
  inicis: ReadonlyMap<string, string>,
  avui: Date,
): Ratxa {
  const primer = passos[primerIndex]!;
  const legislatura = primer.legislatura;
  const anyInici = anyDe(legislatura);
  // Si la ratxa comença enmig d'una legislatura, l'inici és el dia que va
  // prendre possessió, no el ple de constitució: qui arriba per una moció de
  // censura no hi és des del juny.
  const aMigMandat = primerIndex > 0 && passos[primerIndex - 1]!.legislatura === legislatura;
  const desDe = primer.desDe ?? (aMigMandat ? null : inicis.get(legislatura) ?? `${anyInici}${CONSTITUCIO_PER_DEFECTE}`);
  const presents = new Set(passos.slice(primerIndex).map((p) => p.legislatura));
  const legislatures = presents.size;

  // Legislatures que hi hauria d'haver entre l'inici de la ratxa i avui, i que
  // la font no registra: la ratxa hi passa per sobre sense saber què hi va
  // haver, i això s'ha de dir.
  // Les municipals són cada quatre anys des del 1979, així que l'etiqueta de
  // cada legislatura es pot construir: 1979-1983, 1983-1987, i així fins avui.
  const forats: string[] = [];
  for (let any = anyInici; any < avui.getUTCFullYear(); any += 4) {
    const esperada = `${any}-${any + 4}`;
    if (!presents.has(esperada)) forats.push(esperada);
  }

  return {
    desDeLegislatura: legislatura,
    desDeAny: anyInici,
    desDe,
    anys: desDe === null ? avui.getUTCFullYear() - anyInici : anysComplets(desDe, avui),
    legislatures,
    aproximat: primer.desDe === null,
    ininterromput: primerIndex === 0 && forats.length === 0,
    forats,
    aturadaPerDesconegut: primerIndex > 0 && passos[primerIndex - 1]!.sigles === null,
  };
}

/**
 * Continuïtat al poder a partir de l'historial d'alcaldies.
 *
 * La comparació de sigles va per `sameForce`, que sap que PSC-PSOE, PSC-PM i
 * PSC-CP són el mateix i que davant del dubte no afirma que hi hagi hagut canvi.
 * Aquí aquesta prudència és obligatòria: dir que un poble ha canviat de mans
 * quan només ha canviat el nom del partit és publicar una mentida.
 */
export function continuitatDe(
  passosOriginals: readonly PasAlcaldia[],
  inicis: ReadonlyMap<string, string> = new Map(),
  avui: Date = new Date(),
): Continuitat {
  const passos = ordena(passosOriginals);
  if (passos.length === 0) {
    return {
      actual: null, partit: null, persona: null, personesDiferents: 0, forcesDiferents: 0,
      legislatures: 0, primeraLegislatura: null, alternances: 0, alternancesDetall: [],
    };
  }

  const actual = passos[passos.length - 1]!;

  // La ratxa del partit s'atura al primer pas del qual no sabem les sigles.
  // `sameForce(null, X)` torna cert a propòsit —davant del dubte no afirmem que
  // hi hagi hagut canvi—, però aquí allargava la ratxa cap enrere a través de
  // mandats sense partit i publicava anys de govern que la font no diu:
  // Susqueda hi sortia amb «ERC-AM, 23 anys» quan la legislatura per la qual
  // començava la ratxa és precisament la que no té partit.
  let inicPartit = passos.length - 1;
  while (
    inicPartit > 0 &&
    passos[inicPartit - 1]!.sigles !== null &&
    sameForce(passos[inicPartit - 1]!.sigles, actual.sigles)
  ) {
    inicPartit -= 1;
  }

  let inicPersona = passos.length - 1;
  while (inicPersona > 0 && mateixaPersona(passos[inicPersona - 1]!.nom, actual.nom)) inicPersona -= 1;

  // Persones diferents: els noms mal escrits s'ajunten amb el primer que se'ls
  // assembla, i les forces amb el primer que `sameForce` considera la mateixa.
  const persones: string[] = [];
  for (const pas of passos) {
    if (!persones.some((nom) => mateixaPersona(nom, pas.nom))) persones.push(pas.nom);
  }
  const forces: (string | null)[] = [];
  for (const pas of passos) {
    if (!forces.some((sigles) => sameForce(sigles, pas.sigles))) forces.push(pas.sigles);
  }

  const alternancesDetall: Alternanca[] = [];
  for (let i = 1; i < passos.length; i += 1) {
    if (sameForce(passos[i - 1]!.sigles, passos[i]!.sigles)) continue;
    alternancesDetall.push({ legislatura: passos[i]!.legislatura, de: passos[i - 1]!.sigles, a: passos[i]!.sigles });
  }

  return {
    actual: {
      nom: actual.nom,
      sigles: actual.sigles,
      familia: actual.sigles ? siglesFamily(actual.sigles) : null,
      legislatura: actual.legislatura,
    },
    partit: {
      ...ratxaDes(passos, inicPartit, inicis, avui),
      sigles: actual.sigles,
      familia: actual.sigles ? siglesFamily(actual.sigles) : null,
    },
    persona: { ...ratxaDes(passos, inicPersona, inicis, avui), nom: actual.nom },
    personesDiferents: persones.length,
    forcesDiferents: forces.length,
    legislatures: new Set(passos.map((p) => p.legislatura)).size,
    primeraLegislatura: passos[0]!.legislatura,
    alternances: alternancesDetall.length,
    alternancesDetall,
  };
}

// ----------------------------------------------------------------- volatilitat

/** Un any de la sèrie electoral, tal com el desa `electoralHistory`. */
export type AnyElectoral = { year: number; families: Record<string, number> };

export type PuntVolatilitat = {
  de: number;
  a: number;
  index: number;
  /** Fals quan massa escons són de llistes locals i el càlcul no vol dir res. */
  fiable: boolean;
};

/**
 * Índex de volatilitat de Pedersen entre dues eleccions: la meitat de la suma
 * dels canvis absoluts de quota. 0 vol dir un ple calcat i 100 que no hi queda
 * res del repartiment anterior.
 *
 * Es calcula sobre **quotes d'escons**, no sobre escons: el nombre de regidors
 * canvia amb el padró i, sense normalitzar, un municipi que passa de 9 a 11
 * regidors semblaria un terratrèmol sense haver mogut ni un vot.
 */
export function indexPedersen(
  anterior: Readonly<Record<string, number>>,
  actual: Readonly<Record<string, number>>,
): number | null {
  const totalA = Object.values(anterior).reduce((a, b) => a + b, 0);
  const totalB = Object.values(actual).reduce((a, b) => a + b, 0);
  if (totalA <= 0 || totalB <= 0) return null;
  let suma = 0;
  for (const familia of new Set([...Object.keys(anterior), ...Object.keys(actual)])) {
    suma += Math.abs((100 * (anterior[familia] ?? 0)) / totalA - (100 * (actual[familia] ?? 0)) / totalB);
  }
  return Math.round(suma * 50) / 100;
}

/**
 * A partir d'aquesta quota d'escons de llistes locals, la volatilitat deixa de
 * ser interpretable: la sèrie del 1979 ençà agrupa **totes** les llistes locals
 * sota una sola etiqueta, i dues candidatures d'independents que no tenen res a
 * veure hi surten com la mateixa força. Quan això domina el ple, un índex baix
 * no vol dir estabilitat: vol dir que no ho sabem.
 */
const MAX_QUOTA_LOCAL = 50;

function quotaLocal(families: Readonly<Record<string, number>>): number {
  const total = Object.values(families).reduce((a, b) => a + b, 0);
  return total === 0 ? 100 : (100 * (families["local"] ?? 0)) / total;
}

export function serieVolatilitat(series: readonly AnyElectoral[]): PuntVolatilitat[] {
  const punts: PuntVolatilitat[] = [];
  const ordenada = [...series].sort((a, b) => a.year - b.year);
  for (let i = 1; i < ordenada.length; i += 1) {
    const anterior = ordenada[i - 1]!;
    const actual = ordenada[i]!;
    const index = indexPedersen(anterior.families, actual.families);
    if (index === null) continue;
    punts.push({
      de: anterior.year,
      a: actual.year,
      index,
      fiable: quotaLocal(anterior.families) <= MAX_QUOTA_LOCAL && quotaLocal(actual.families) <= MAX_QUOTA_LOCAL,
    });
  }
  return punts;
}

/** Mitjana dels trams fiables: un sol tram és massa soroll per publicar-lo sol. */
export function volatilitatMitjana(punts: readonly PuntVolatilitat[]): number | null {
  const fiables = punts.filter((p) => p.fiable);
  if (fiables.length === 0) return null;
  return Math.round((100 * fiables.reduce((a, p) => a + p.index, 0)) / fiables.length) / 100;
}

// ------------------------------------------------------------------ vot perdut

export type CandidaturaVots = { sigles: string; vots: number; escons: number };

export type Participacio = {
  cens: number | null;
  votants: number | null;
  nuls: number | null;
  blancs: number | null;
  votsCandidatures: number | null;
  votsValids: number | null;
};

export type Quantitat = { vots: number; pct: number };

export type VotPerdutElecció = {
  any: number;
  cens: number | null;
  emesos: number;
  /** Nul quan els vots per candidatura no són comparables amb els de la font. */
  senseEsco: (Quantitat & { candidatures: number; mesVotada: (Quantitat & { sigles: string }) | null }) | null;
  nuls: Quantitat;
  blancs: Quantitat;
  /** Nuls i blancs: la part del vot sense representació que sempre es pot dir. */
  nulsIBlancs: Quantitat;
  /** La suma de les tres coses, només quan es pot afirmar sencera. */
  total: Quantitat | null;
  /** Fals quan els vots per candidatura de la font no sumen els que ella mateixa declara. */
  quadra: boolean;
};

const pctDe = (part: number, total: number): number => (total <= 0 ? 0 : Math.round((10_000 * part) / total) / 100);

/**
 * El vot que no va tenir cap traducció al ple.
 *
 * Tres coses que sumen: els vots a candidatures que es van quedar sense cap
 * regidor, els nuls i els blancs. Els blancs hi entren tot i comptar per a la
 * barrera del 5% (LOREG art. 180), perquè no elegeixen ningú; i els nuls també,
 * perquè s'han dipositat a l'urna igual que la resta.
 *
 * El denominador són els **vots emesos**, no el cens: aquí no parlem de
 * l'abstenció, que ja té el seu lloc a la fitxa, sinó de la gent que sí que va
 * anar a votar i va tornar a casa sense representació.
 */
export function votPerdutDe(
  any: number,
  participacio: Participacio,
  llistes: readonly CandidaturaVots[],
): VotPerdutElecció | null {
  const nuls = participacio.nuls ?? 0;
  const blancs = participacio.blancs ?? 0;
  const valids = participacio.votsValids;
  const emesos = participacio.votants ?? (valids === null ? 0 : valids + nuls);
  if (emesos <= 0) return null;

  // Comprovació de coherència de la font, no del nostre càlcul: els vots a
  // candidatura que sumem un per un han de coincidir amb els que la mateixa font
  // declara. Als 178 municipis de llistes obertes no hi coincideixen mai —allà
  // cada elector reparteix diversos vots entre persones— i per això aquesta
  // comprovació no és una formalitat: sense ella publicaríem que a Gallifa un
  // 300 % dels vots no va treure representació.
  const declarats = participacio.votsCandidatures;
  const sumats = llistes.reduce((a, c) => a + c.vots, 0);
  const quadra =
    llistes.length > 0 &&
    (declarats === null || Math.abs(declarats - sumats) <= Math.max(5, Math.round(declarats * 0.005)));

  const sensEsco = llistes.filter((c) => c.escons <= 0);
  const vots = sensEsco.reduce((a, c) => a + c.vots, 0);
  const mesVotada = [...sensEsco].sort((a, b) => b.vots - a.vots)[0] ?? null;

  return {
    any,
    cens: participacio.cens,
    emesos,
    senseEsco: quadra
      ? {
          vots,
          pct: pctDe(vots, emesos),
          candidatures: sensEsco.length,
          mesVotada: mesVotada ? { sigles: mesVotada.sigles, vots: mesVotada.vots, pct: pctDe(mesVotada.vots, emesos) } : null,
        }
      : null,
    nuls: { vots: nuls, pct: pctDe(nuls, emesos) },
    blancs: { vots: blancs, pct: pctDe(blancs, emesos) },
    nulsIBlancs: { vots: nuls + blancs, pct: pctDe(nuls + blancs, emesos) },
    total: quadra ? { vots: vots + nuls + blancs, pct: pctDe(vots + nuls + blancs, emesos) } : null,
    quadra,
  };
}

/** Any de cada convocatòria municipal, per no haver de llegir l'id enlloc més. */
const ANY_ELECCIO: Record<string, number> = { M20231: 2023, M20191: 2019, M20151: 2015 };

// ---------------------------------------------------------------------- feina

type Comparacio = { percentil: number; mediana: number; grup: string; grupMida: number };

/**
 * Percentil dins del grup de comparació. Els municipis sense valor no hi entren:
 * un grup on la meitat no té dada no és una referència, és una il·lusió.
 */
function comparaDinsDelGrup(
  valors: ReadonlyMap<number, number>,
  grups: ReadonlyMap<number, { key: string; label: string; size: number }>,
): Map<number, Comparacio> {
  const perGrup = new Map<string, number[]>();
  for (const [municipalityId, valor] of valors) {
    const grup = grups.get(municipalityId);
    if (!grup) continue;
    const llista = perGrup.get(grup.key);
    if (llista) llista.push(valor);
    else perGrup.set(grup.key, [valor]);
  }

  const resultat = new Map<number, Comparacio>();
  for (const [municipalityId, valor] of valors) {
    const grup = grups.get(municipalityId);
    if (!grup) continue;
    const llista = perGrup.get(grup.key);
    if (!llista || llista.length < MIN_GROUP) continue;
    const percentil = percentileOf(valor, llista);
    const mediana = medianOf(llista);
    if (percentil === null || mediana === null) continue;
    resultat.set(municipalityId, {
      percentil,
      mediana: Math.round(mediana * 100) / 100,
      grup: grup.label,
      grupMida: llista.length,
    });
  }
  return resultat;
}

const FONT_ALCALDIES = {
  nom: "Alcaldes i alcaldesses des del 1979",
  organisme: "Departament de la Presidència, Generalitat de Catalunya",
  portal: "analisi.transparenciacatalunya.cat",
};

const FONT_ELECCIONS = {
  nom: "Resultats electorals municipals 1979-2023",
  organisme: "Departament d'Economia i Hisenda, Generalitat de Catalunya",
  portal: "governobert.gencat.cat",
};

export async function deriveTrajectoria(db: Db): Promise<void> {
  const tots = await db.select().from(municipalities);
  const grups = buildPeerGroups(tots.map((m) => ({ id: m.id, population: m.population })));
  const regidorsPerMunicipi = new Map(tots.map((m) => [m.id, m.councilSeats]));
  const sistemes = new Map(tots.map((m) => [m.id, m.electoralSystem]));

  const desa = async (municipalityId: number, kind: string, data: unknown): Promise<void> => {
    await db
      .insert(municipalityMetrics)
      .values({ municipalityId, kind, data })
      .onConflictDoUpdate({
        target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
        set: { data, computedAt: new Date() },
      });
  };

  // ------------------------------------------------------- 1. continuïtat
  await withRun(db, "derive: continuïtat al poder", async (run) => {
    const avui = new Date();
    const files = await db
      .select({
        municipalityId: mayors.municipalityId,
        legislatura: mayors.term,
        nom: mayors.name,
        sigles: mayors.partyRaw,
        desDe: mayors.tookOfficeOn,
      })
      .from(mayors);
    run.rowsIn = files.length;

    // Data de constitució de cada legislatura: la primera presa de possessió que
    // consta a tot Catalunya. Surt de les mateixes dades per no haver de
    // mantenir a mà una taula de dates que es desactualitzaria.
    const inicis = new Map<string, string>();
    for (const fila of files) {
      if (!fila.desDe) continue;
      const actual = inicis.get(fila.legislatura);
      if (!actual || fila.desDe < actual) inicis.set(fila.legislatura, fila.desDe);
    }

    const perMunicipi = new Map<number, PasAlcaldia[]>();
    for (const fila of files) {
      const pas: PasAlcaldia = {
        legislatura: fila.legislatura,
        nom: fila.nom,
        sigles: fila.sigles,
        desDe: fila.desDe,
      };
      const llista = perMunicipi.get(fila.municipalityId);
      if (llista) llista.push(pas);
      else perMunicipi.set(fila.municipalityId, [pas]);
    }

    const historial = await db
      .select({ municipalityId: municipalityMetrics.municipalityId, data: municipalityMetrics.data })
      .from(municipalityMetrics)
      .where(eq(municipalityMetrics.kind, "electoralHistory"));

    const volatilitats = new Map<number, PuntVolatilitat[]>();
    for (const fila of historial) {
      const series = (fila.data as { series?: AnyElectoral[] }).series ?? [];
      volatilitats.set(fila.municipalityId, serieVolatilitat(series));
    }

    // El percentil es calcula sobre la mitjana, no sobre l'últim tram: entre dues
    // eleccions concretes hi pot haver hagut una escissió que no diu res del
    // costum del municipi.
    const mitjanes = new Map<number, number>();
    for (const [municipalityId, punts] of volatilitats) {
      const mitjana = volatilitatMitjana(punts);
      if (mitjana !== null) mitjanes.set(municipalityId, mitjana);
    }
    const comparacions = comparaDinsDelGrup(mitjanes, grups);

    let ambRatxaLlarga = 0;
    let sensAlternanca = 0;
    for (const [municipalityId, passos] of perMunicipi) {
      const continuitat = continuitatDe(passos, inicis, avui);
      const punts = volatilitats.get(municipalityId) ?? [];
      const fiables = punts.filter((p) => p.fiable);

      if ((continuitat.partit?.anys ?? 0) >= 20) ambRatxaLlarga += 1;
      if (continuitat.alternances === 0) sensAlternanca += 1;

      await desa(municipalityId, "continuitat", {
        font: FONT_ALCALDIES,
        anyReferencia: avui.getUTCFullYear(),
        ...continuitat,
        volatilitat: {
          font: FONT_ELECCIONS,
          serie: punts,
          ultima: fiables[fiables.length - 1] ?? null,
          mitjana: mitjanes.get(municipalityId) ?? null,
          trams: punts.length,
          tramsFiables: fiables.length,
          comparacio: comparacions.get(municipalityId) ?? null,
        },
      });
      run.rowsOut += 1;
    }

    run.say(`${ambRatxaLlarga} municipis porten 20 anys o més amb la mateixa força a l'alcaldia`);
    run.say(`${sensAlternanca} no han canviat de força ni una sola vegada des del 1979`);
    return {
      municipis: run.rowsOut,
      ratxes_de_20_anys_o_mes: ambRatxaLlarga,
      sense_cap_alternanca: sensAlternanca,
      amb_volatilitat: mitjanes.size,
    };
  });

  // -------------------------------------------------------- 2. vot perdut
  await withRun(db, "derive: vot sense representació", async (run) => {
    const participacions = await db.select().from(electionParticipation);
    run.rowsIn = participacions.length;

    const resultats = await db
      .select({
        municipalityId: candidatures.municipalityId,
        electionId: candidatures.electionId,
        sigles: candidatures.sigles,
        vots: electionResults.votes,
        escons: electionResults.seats,
      })
      .from(candidatures)
      .innerJoin(electionResults, eq(electionResults.candidatureId, candidatures.id));

    const llistes = new Map<string, CandidaturaVots[]>();
    for (const fila of resultats) {
      const clau = `${fila.municipalityId}|${fila.electionId}`;
      const llista = llistes.get(clau);
      const entrada = { sigles: fila.sigles, vots: fila.vots, escons: fila.escons };
      if (llista) llista.push(entrada);
      else llistes.set(clau, [entrada]);
    }

    const perMunicipi = new Map<number, Record<string, VotPerdutElecció>>();
    for (const fila of participacions) {
      const any = ANY_ELECCIO[fila.electionId];
      if (any === undefined) continue;
      const calcul = votPerdutDe(
        any,
        {
          cens: fila.censusSize,
          votants: fila.voters,
          nuls: fila.nullVotes,
          blancs: fila.blankVotes,
          votsCandidatures: fila.partyVotes,
          votsValids: fila.validVotes,
        },
        llistes.get(`${fila.municipalityId}|${fila.electionId}`) ?? [],
      );
      if (!calcul) continue;
      if (!calcul.quadra) {
        await run.issue({
          kind: "participacio_no_quadra",
          severity: "baixa",
          municipalityId: fila.municipalityId,
          entity: fila.electionId,
          detail: {
            sistema: sistemes.get(fila.municipalityId) ?? null,
            declarats: fila.partyVotes,
            sumats: (llistes.get(`${fila.municipalityId}|${fila.electionId}`) ?? []).reduce((a, c) => a + c.vots, 0),
          },
        });
      }
      const bloc = perMunicipi.get(fila.municipalityId) ?? {};
      bloc[fila.electionId] = calcul;
      perMunicipi.set(fila.municipalityId, bloc);
    }

    const darreres = new Map<number, number>();
    for (const [municipalityId, eleccions] of perMunicipi) {
      const total = eleccions["M20231"]?.total;
      if (total) darreres.set(municipalityId, total.pct);
    }
    const comparacions = comparaDinsDelGrup(darreres, grups);

    let sumaPct = 0;
    for (const [municipalityId, eleccions] of perMunicipi) {
      const darrera = eleccions["M20231"] ?? null;
      const anterior = eleccions["M20191"] ?? null;
      const regidors = regidorsPerMunicipi.get(municipalityId) ?? null;
      sumaPct += darrera?.total?.pct ?? 0;

      await desa(municipalityId, "votPerdut", {
        font: FONT_ELECCIONS,
        eleccions,
        darrera: darrera ? "M20231" : null,
        // Quants regidors representaria aquest vot si hagués tingut traducció:
        // és la manera més entenedora de dir què val un vot que no arriba al ple.
        regidorsEquivalents:
          darrera?.total && regidors ? Math.round((darrera.total.pct * regidors) / 10) / 10 : null,
        variacioDesDel2019:
          darrera?.total && anterior?.total
            ? Math.round((darrera.total.pct - anterior.total.pct) * 100) / 100
            : null,
        comparacio: comparacions.get(municipalityId) ?? null,
      });
      run.rowsOut += 1;
    }

    const mitjana = Math.round((100 * sumaPct) / Math.max(1, darreres.size)) / 100;
    run.say(`mitjana del 2023: ${mitjana} % dels vots emesos no van arribar al ple`);
    run.say(`${run.rowsOut - darreres.size} municipis sense xifra sencera: la font no permet sumar-hi els vots per candidatura`);
    return {
      municipis: run.rowsOut,
      mitjana_2023_pct: mitjana,
      amb_xifra_sencera: darreres.size,
      amb_comparacio: comparacions.size,
    };
  });
}
