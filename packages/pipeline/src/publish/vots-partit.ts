import { eq, sql } from "drizzle-orm";
import {
  candidatures, electionResults, municipalities, municipalityMetrics, type Db,
} from "@quivoto/db";
import { BRANDS_BY_ID, PARTY_BRANDS, siglesFamily } from "@quivoto/shared-schemas/brands";
import { clau } from "./candidatura";

/**
 * On es vota més cada partit: el pes dels seus vots a cada un dels 947.
 *
 * La pàgina de cada marca deia on **mana** i on **hi és**, i el mapa dels 947
 * deia de qui és cada alcaldia. Cap de les dues coses no diu on el voten: el
 * PSC té l'alcaldia de 125 municipis i treu vots a 615, i un partit que a un
 * poble és la segona força amb el 30 % hi sortia igual d'apagat que un que no
 * s'hi ha presentat mai. Aquest mòdul és la dada que falta, i és una de sola:
 * **els vots de les llistes d'una marca sobre els vots a candidatures del
 * municipi**, a les municipals del 28 de maig del 2023.
 *
 * ## El denominador
 *
 * És el mateix que a la fitxa de cada candidatura —«de 76.520 vots a
 * candidatures»—: la suma dels vots de totes les llistes del municipi, sense
 * els nuls ni els blancs. No es fa servir la columna de vots vàlids de la
 * participació perquè aquella hi compta els blancs, i llavors les xifres
 * d'aquí i les de la fitxa de candidatura no quadrarien.
 *
 * ## Qui compta com a d'una marca
 *
 * Es decideix a `marcaDe()` i **a cap altre lloc**: la pàgina del partit, la
 * seva capa al mapa i els vots de cada municipi surten d'aquesta funció. Viu
 * aquí i no a «partit.ts» perquè el mapa dels 947 també l'ha de fer servir, i
 * el mapa no pot importar la pàgina d'un partit sense fer una dependència
 * circular. Si en un municipi la marca porta dues llistes —passa tres vegades
 * el 2023, amb coalicions registrades a part— se sumen: la pregunta és quant
 * pesa la marca al poble, no la llista.
 *
 * ## Els municipis on no s'hi va presentar
 *
 * No hi són. Absent vol dir «no s'hi va presentar», i el mapa ho pinta
 * ratllat, no amb el to més clar de l'escala: un zero de vots seria una dada,
 * i no presentar-s'hi no ho és.
 */

const ELECCIO = "M20231";

// ------------------------------------------------------------------- marques

/** Les marques de debò: «local» no hi és, perquè no és cap partit. */
export const MARQUES = PARTY_BRANDS.filter((b) => b.id !== "local");
export const ES_MARCA = new Set(MARQUES.map((b) => b.id));

/**
 * Les sigles curtes de cada marca. Les de `PARTY_BRANDS` són les oficials
 * senceres —«Esquerra Republicana de Catalunya»— i en una capçalera de 3,4 rem
 * o en un botó del mapa ocupen tres línies i deixen d'assemblar-se a res.
 */
const SIGLES_CURTES: Record<string, string> = {
  erc: "ERC", junts: "Junts", psc: "PSC", cup: "CUP", comuns: "Comuns",
  pp: "PP", vox: "Vox", cs: "Ciutadans", pdecat: "PDeCAT",
  aliancacat: "Aliança Catalana", ciu: "CiU", podem: "Podem",
  fic: "FIC", te: "Tots per l'Empordà", idselva: "Independents de la Selva",
  idc: "Independents de Catalunya", cda: "CDA",
};

/**
 * Colors de dades. Són els de `PARTY_BRANDS` excepte el groc pur de la CUP,
 * que damunt del paper cru no es veu; és el mateix fosquim que ja fan servir
 * el mapa dels 947 i les comarques, i ha de continuar sent el mateix.
 */
const COLORS: Record<string, string> = { cup: "#d8d000" };

export const siglesDe = (id: string): string => SIGLES_CURTES[id] ?? BRANDS_BY_ID.get(id)?.name ?? id;
export const colorDe = (id: string): string => COLORS[id] ?? BRANDS_BY_ID.get(id)?.color ?? "#8b8b8b";

/**
 * De quina marca és una candidatura.
 *
 * Primer l'agrupació electoral, que és el que la Generalitat publica i el que
 * `resolveBrand()` ja ha desat a `candidatures.brandId`. Quan allò diu «local»
 * o no diu res, es miren les sigles amb la mateixa funció que fa servir tota la
 * resta del projecte: hi ha coalicions locals registrades com a agrupació
 * d'electors que porten la marca escrita a les sigles («UA-PSC-CP»), i deixar-les
 * fora faria que un partit tingués menys regidories de les que té.
 *
 * Torna `null` quan cap de les dues coses no ho aclareix, i això vol dir que
 * aquella llista no compta enlloc: preferim una xifra curta a una d'inventada.
 */
export function marcaDe(brandId: string | null, sigles: string): string | null {
  if (brandId && ES_MARCA.has(brandId)) return brandId;
  const familia = siglesFamily(sigles);
  return familia && ES_MARCA.has(familia) ? familia : null;
}

/** Una llista d'un municipi, tal com surt del dataset electoral amb el seu resultat. */
export type LlistaAmbResultat = {
  id: number;
  municipalityId: number;
  sigles: string;
  brandId: string | null;
  votes: number;
  seats: number;
};

/**
 * De quina candidatura és l'alcaldia d'un municipi.
 *
 * Primer per les sigles exactes, amb la clau dura de `candidatura.ts` —la
 * font de la composició del ple escriu «PSC - CP» on el dataset electoral
 * escriu «PSC-CP»— i, si allò no lliga, per família de sigles i només quan
 * una sola llista d'aquell ple hi encaixa. Si n'hi encaixen dues no se'n
 * tria cap: atribuir una alcaldia a la llista equivocada és el pitjor error
 * que pot cometre una pàgina de partit, i aquí es decideix per a totes.
 */
export function llistaDeLAlcaldia(
  seves: readonly LlistaAmbResultat[],
  mayorSigles: string | null | undefined,
): number | null {
  if (!mayorSigles) return null;
  const k = clau(mayorSigles);
  const exactes = seves.filter((l) => clau(l.sigles) === k);
  if (exactes.length === 1) return exactes[0]!.id;
  const familia = siglesFamily(mayorSigles);
  const candidates = familia
    ? seves.filter((l) => l.seats > 0 && marcaDe(l.brandId, l.sigles) === familia)
    : [];
  return candidates.length === 1 ? candidates[0]!.id : null;
}

// ---------------------------------------------------------------------- dades

/** El pes d'una marca en un municipi on s'hi va presentar. */
export type VotsMunicipi = {
  /**
   * El nom del municipi. Hi va perquè la pàgina del partit només sap els noms
   * dels pobles on té regidories, i els que més cal anomenar aquí són sovint
   * els altres: on es va presentar, va treure un 30 % i no hi va entrar.
   */
  nom: string;
  /** Vots a les seves llistes sobre els vots a candidatures del municipi, en tant per cent. */
  pct: number;
  vots: number;
  regidories: number;
  alcaldia: boolean;
};

/** Per slug de municipi. Un municipi que no hi és és un on la marca no es va presentar. */
export type VotsMarca = Record<string, VotsMunicipi>;

/** Per `id` de marca. */
export type VotsPartit = Record<string, VotsMarca>;

/**
 * La suma, municipi a municipi, i sense tocar la base.
 *
 * Va separada de `loadVotsPartit()` perquè `loadPartits()` ja té a la memòria
 * les mateixes llistes i la mateixa alcaldia de cada municipi, i tornar-les a
 * demanar per a cada pàgina de partit seria llegir dues vegades el mateix. Les
 * dues pàgines —la del partit i el mapa— passen per aquí i per tant no poden
 * dir xifres diferents del mateix poble.
 */
export function agregaVots(
  municipis: readonly { id: number; slug: string; name: string }[],
  llistes: readonly LlistaAmbResultat[],
  siglesAlcaldia: ReadonlyMap<number, string | null>,
): VotsPartit {
  const perId = new Map(municipis.map((m) => [m.id, m]));
  const perMunicipi = new Map<number, LlistaAmbResultat[]>();
  for (const l of llistes) {
    const seves = perMunicipi.get(l.municipalityId) ?? [];
    seves.push(l);
    perMunicipi.set(l.municipalityId, seves);
  }

  const out: VotsPartit = {};
  for (const [municipalityId, seves] of perMunicipi) {
    const municipi = perId.get(municipalityId);
    if (!municipi) continue;
    const total = seves.reduce((suma, l) => suma + l.votes, 0);
    const alcaldiaDe = llistaDeLAlcaldia(seves, siglesAlcaldia.get(municipalityId));
    for (const l of seves) {
      const marca = marcaDe(l.brandId, l.sigles);
      if (!marca) continue;
      const deLaMarca = (out[marca] ??= {});
      const abans = deLaMarca[municipi.slug];
      const vots = (abans?.vots ?? 0) + l.votes;
      deLaMarca[municipi.slug] = {
        nom: municipi.name,
        // Sense cap vot a cap llista no hi ha percentatge que valgui: zero i
        // no una divisió per zero. No passa a cap dels 947 el 2023.
        pct: total > 0 ? (100 * vots) / total : 0,
        vots,
        regidories: (abans?.regidories ?? 0) + l.seats,
        alcaldia: (abans?.alcaldia ?? false) || l.id === alcaldiaDe,
      };
    }
  }
  return out;
}

/**
 * PGlite fa córrer Postgres dins de WebAssembly i el resultat d'una consulta hi
 * ha de cabre sencer. Les mètriques es demanen en blocs pel mateix motiu que
 * explica `metriques.ts`, i el pitjor d'aquell error és com peta: després
 * d'haver escrit part del web.
 */
const BLOC = 200;

export async function enBlocs<T>(consulta: (limit: number, salta: number) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (let salta = 0; ; salta += BLOC) {
    const tros = await consulta(BLOC, salta);
    out.push(...tros);
    if (tros.length < BLOC) break;
  }
  return out;
}

/** Els vots del 2023 de cada marca, municipi a municipi, per al mapa dels 947. */
export async function loadVotsPartit(db: Db): Promise<VotsPartit> {
  const muns = await db
    .select({ id: municipalities.id, slug: municipalities.slug, name: municipalities.name })
    .from(municipalities);

  const llistes = await db
    .select({
      id: candidatures.id,
      municipalityId: candidatures.municipalityId,
      sigles: candidatures.sigles,
      brandId: candidatures.brandId,
      votes: electionResults.votes,
      seats: electionResults.seats,
    })
    .from(candidatures)
    .innerJoin(electionResults, eq(electionResults.candidatureId, candidatures.id))
    .where(eq(candidatures.electionId, ELECCIO));

  // Només les sigles de l'alcaldia, i no el document de govern sencer: és
  // l'única cosa que cal per saber quina llista mana.
  const govern = await enBlocs((limit, salta) =>
    db
      .select({
        municipalityId: municipalityMetrics.municipalityId,
        mayorSigles: sql<string | null>`${municipalityMetrics.data}->>'mayorSigles'`,
      })
      .from(municipalityMetrics)
      .where(eq(municipalityMetrics.kind, "government"))
      .orderBy(municipalityMetrics.municipalityId)
      .limit(limit)
      .offset(salta),
  );

  return agregaVots(muns, llistes, new Map(govern.map((g) => [g.municipalityId, g.mayorSigles])));
}

// ------------------------------------------------------------------- escala

/**
 * Els quatre talls que parteixen una llista en cinc parts iguals, ignorant
 * els municipis sense dada.
 *
 * Amb molts empats, dos talls poden coincidir i un graó quedaria buit.
 *
 * I un tall que valgui el mínim també en deixa un de buit, però per davant i
 * sense que es noti a la llegenda: el deute per habitant té 400 municipis a
 * zero, el primer quantil valia 0 i la clau del mapa deia «menys de 0 €», un
 * graó on no hi pot caure ningú i un color que no s'arribava a fer servir.
 */
export function quintilsDe(valors: readonly number[]): number[] {
  const ordenats = [...valors].sort((a, b) => a - b);
  if (ordenats.length === 0) return [];
  const talls: number[] = [];
  for (let i = 1; i < 5; i += 1) {
    talls.push(ordenats[Math.floor((i * ordenats.length) / 5)] ?? 0);
  }
  const minim = ordenats[0]!;
  return [...new Set(talls)].filter((t) => t > minim);
}

/** A quin graó cau un valor: tants com talls té per sota o iguals. */
export const graoDe = (valor: number, talls: readonly number[]): number => {
  let g = 0;
  for (const t of talls) if (valor >= t) g += 1;
  return g;
};

const coma = (v: number): string => v.toFixed(1).replace(".", ",");

/**
 * Les etiquetes de la clau, una per graó, escrites com a intervals.
 *
 * El mapa dels 947 escriu «12 % o més» a cada tall, que amb dues xifres es
 * llegeix i amb quatre no: «16,8 % o més», «29,6 % o més» i «42,3 % o més» un
 * sota l'altre obliguen a restar per saber on cau cada color. Aquí cada graó
 * diu d'on a on va, i només el de dalt queda obert.
 */
export function etiquetesPct(talls: readonly number[]): string[] {
  if (talls.length === 0) return [];
  const primera = `menys del ${coma(talls[0]!)} %`;
  const mig = talls.slice(0, -1).map((t, i) => `del ${coma(t)} % al ${coma(talls[i + 1]!)} %`);
  return [primera, ...mig, `${coma(talls[talls.length - 1]!)} % o més`];
}

// ---------------------------------------------------------------------- rampa

function aRgb(color: string): [number, number, number] | null {
  const hex = color.trim().replace("#", "");
  const complet = hex.length === 3 ? hex.replace(/./g, (c) => c + c) : hex;
  if (!/^[0-9a-f]{6}$/i.test(complet)) return null;
  return [0, 2, 4].map((i) => Number.parseInt(complet.slice(i, i + 2), 16)) as [number, number, number];
}

const aHex = (rgb: readonly number[]): string =>
  `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;

function aHsl(rgb: readonly [number, number, number]): [number, number, number] {
  const [r, g, b] = rgb.map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function deHsl([h, s, l]: readonly [number, number, number]): [number, number, number] {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const canal = (t: number): number => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [canal(h + 1 / 3) * 255, canal(h) * 255, canal(h - 1 / 3) * 255];
}

/**
 * Les cinc lluminositats de la rampa, de menys a més. En clar el graó alt és
 * el fosc; en fosc s'ha de girar sencera i no només enfosquir-la, perquè
 * damunt del paper fosc el que crida és el clar i el que ha de cridar és el
 * valor alt. Són les mateixes dues regles que segueix la rampa coral del
 * mapa dels 947.
 */
const LLUMS_CLAR = [0.92, 0.79, 0.65, 0.5, 0.33] as const;
const LLUMS_FOSC = [0.24, 0.36, 0.49, 0.63, 0.78] as const;

/**
 * Cinc graons del color d'una marca, amb la lluminància sempre en el mateix
 * sentit.
 *
 * El color d'un partit és seu i és una marca de dades: el mapa de «qui mana»
 * el fa servir tal qual. Aquí no es pot, perquè cinc taques del mateix
 * vermell no diuen «més o menys». La rampa manté el to i la saturació de la
 * marca i només mou la lluminositat, en passos iguals, que és el que fa que
 * els graons es distingeixin també sense veure el color —amb el to fix, la
 * lluminància relativa puja i baixa amb la lluminositat, i mai no s'encreua.
 * El groc de la CUP o el turquesa de Junts, que ja són clars, tenen la
 * mateixa escala que el blau fosc d'Aliança Catalana: el que canvia és el
 * to, no on cau cada cinquè.
 *
 * Un color que no es pugui llegir surt en gris, que és el que li passa a tot
 * el web amb un color que no és cap hexadecimal.
 */
export function rampaDe(color: string): { clar: string[]; fosc: string[] } {
  const rgb = aRgb(color) ?? aRgb("#8b8b8b")!;
  const [h, s] = aHsl(rgb);
  return {
    clar: LLUMS_CLAR.map((l) => aHex(deHsl([h, s, l]))),
    fosc: LLUMS_FOSC.map((l) => aHex(deHsl([h, s, l]))),
  };
}
