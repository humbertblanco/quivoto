import { fetchJson } from "../lib/http";

/**
 * API de l'Idescat: taules estadístiques (JSON-stat 2.0) i fitxes municipals.
 *
 * Fa per a l'Idescat el mateix paper que `socrata.ts` fa per al portal de dades
 * obertes de la Generalitat: demanar, parsejar i tornar files planes. La
 * diferència és el format. Socrata torna un array d'objectes; l'Idescat torna
 * **JSON-stat**, que és un hipercub: una llista plana de valors més les mides de
 * cada dimensió, i cal reconstruir a quina combinació correspon cada valor.
 *
 * Dues coses d'aquesta API que no es veuen fins que t'hi trobes:
 *
 *   · **La dimensió `MUN` porta una categoria `TOTAL` que és Catalunya.** Les
 *     taules diuen 948 municipis i n'hi ha 947: el 948è és el país sencer. Qui
 *     no la separi ingerirà Catalunya com si fos un poble, i tots els percentils
 *     i totes les medianes de grup quedaran contaminats per una fila de vuit
 *     milions d'habitants. Aquí surt per separat, a `catalunya`.
 *   · **Un filtre mal escrit no dona error.** `?FOO=BAR` torna un 200 i la taula
 *     sencera; només passar-se de cel·les dona error (416). Per això
 *     `filtresNoAplicats` compara el que hem demanat amb el que ha tornat: sense
 *     aquesta comprovació, un dia canvia un codi de categoria i ingerim en
 *     silenci una xifra que compta una altra cosa.
 *
 * ─── LLICÈNCIA ──────────────────────────────────────────────────────────────
 * Les dades de l'Idescat **no** són CC-BY i les condicions d'ús de les seves
 * API imposen una obligació concreta que aquest mòdul existeix per complir:
 *
 *   «Heu de reconèixer l'origen de les dades, ja sigui utilitzant els enllaços
 *   que proporcionin les APIs, ja sigui enllaçant amb Idescat.cat. […] En
 *   presentar-los, no esteu autoritzat a modificar o editar les dades,
 *   metadades o enllaços proporcionats per les APIs.»
 *
 * Per tant: tot el que l'API dona com a enllaç, etiqueta, font o data
 * d'actualització es desa **verbatim** i no es toca. No es construeixen URL per
 * concatenació ni se'n retallen paràmetres: construir-ne una és editar-la. La
 * fitxa de cada municipi ha de poder posar l'enllaç al costat de la xifra, i
 * l'enllaç per municipi el dona `emexFitxa`, no les taules.
 */

const BASE_TAULES = "https://api.idescat.cat/taules/v2";
const BASE_EMEX = "https://api.idescat.cat/emex/v1";

/**
 * La categoria de `MUN` que no és cap municipi sinó tot Catalunya. Val per a
 * totes les taules menys la creuada de naixement × nacionalitat, que no la
 * publica.
 */
export const MUN_CATALUNYA = "TOTAL";

/** Codi Idescat de Palmerola, que surt a la classificació però no té dades. */
export const PALMEROLA = "171220";

// ─── Tipus ───────────────────────────────────────────────────────────────────

/**
 * Un enllaç tal com el dona l'API. `href` i `label` es guarden sense tocar-los:
 * és el que la llicència obliga a mostrar i prohibeix editar.
 */
export type EnllacApi = {
  /** `self`, `describedby` o `related`, segons on l'ha posat l'API. */
  rel: string;
  href: string;
  label: string;
};

/** Una cel·la de l'hipercub, ja resolta a municipi, any i categories. */
export type CelaJsonStat = {
  /** Codi Idescat de 6 xifres, o `TOTAL` quan la fila és Catalunya. */
  mun: string;
  /** Nom del municipi tal com l'escriu l'Idescat. */
  municipi: string;
  any: number;
  /** Categoria triada de cada dimensió que no és `MUN` ni `YEAR`. */
  categories: Record<string, string>;
  valor: number | null;
  /**
   * Marca d'estat de la cel·la. `..` vol dir dada confidencial, de baixa
   * fiabilitat o no disponible: **no** vol dir zero.
   */
  estat: string | null;
};

export type TaulaJsonStat = {
  /** Títol de la taula, tal com el dona l'API. */
  label: string;
  /** Atribució de la font, literal. */
  source: string;
  /** Data d'actualització que declara l'Idescat. */
  updated: string | null;
  /** URL exacta d'aquesta crida, tal com la torna l'API al camp `href`. */
  href: string;
  enllacos: EnllacApi[];
  /** Text de cada marca d'estat, del bloc `extension.status.label`. */
  estats: Record<string, string>;
  /** Categories de cada dimensió, en l'ordre en què les dona l'API. */
  dimensions: Record<string, { label: string; categories: { id: string; label: string }[] }>;
  /** Les cel·les dels municipis. Catalunya **no** hi és. */
  celes: CelaJsonStat[];
  /** Les cel·les de la fila `MUN=TOTAL`, que és Catalunya i no un municipi. */
  catalunya: CelaJsonStat[];
};

/** El resultat d'ingerir una taula sencera, possiblement en diverses crides. */
export type TaulaIngerida = {
  /** Identificador de la taula: `censph/5992/5987`. */
  taula: string;
  label: string;
  source: string;
  updated: string | null;
  /** Tots els enllaços que ha donat l'API, sense repetir i sense modificar. */
  enllacos: EnllacApi[];
  /** Les URL de cada crida, tal com les torna l'API. */
  crides: string[];
  estats: Record<string, string>;
  dimensions: Record<string, { label: string; categories: { id: string; label: string }[] }>;
  celes: CelaJsonStat[];
  catalunya: CelaJsonStat[];
};

// ─── Parseig de JSON-stat ────────────────────────────────────────────────────

/**
 * Sostre de cel·les que acceptem parsejar d'una sola resposta. L'API tallaria
 * abans amb un 416, però si un dia el seu límit puja, una crida mal filtrada
 * podria tornar milions de cel·les i deixar el procés penjat sense dir per què.
 */
const MAX_CELES = 500_000;

type Categoria = { index?: string[] | Record<string, number>; label?: Record<string, string> };

/**
 * L'índex d'una dimensió com a llista ordenada. JSON-stat en permet dues
 * formes: una llista d'identificadors, o un objecte identificador → posició.
 * L'Idescat fa servir la llista, però l'altra és igual de vàlida i no costa res
 * acceptar-la.
 */
function indexOrdenat(categoria: Categoria): string[] {
  const index = categoria.index;
  if (Array.isArray(index)) return [...index];
  if (index && typeof index === "object") {
    return Object.entries(index)
      .sort((a, b) => a[1] - b[1])
      .map(([id]) => id);
  }
  // Sense índex, l'ordre és el de les etiquetes.
  return Object.keys(categoria.label ?? {});
}

/** Llegeix `value` i `status`, que poden venir com a llista o com a diccionari. */
function lector<T>(font: unknown): (posicio: number) => T | null {
  if (Array.isArray(font)) return (posicio) => (font[posicio] ?? null) as T | null;
  if (font && typeof font === "object") {
    const diccionari = font as Record<string, T>;
    return (posicio) => diccionari[String(posicio)] ?? null;
  }
  return () => null;
}

/**
 * Converteix una resposta JSON-stat 2.0 en files planes.
 *
 * És pura i és la peça que es prova: tota la resta d'aquest mòdul és xarxa.
 */
export function parseJsonStat(brut: unknown): TaulaJsonStat {
  const dades = brut as Record<string, unknown>;

  // L'API respon els errors amb cos JSON. El 416 arriba amb estat HTTP i el
  // captura `fetchJson`, però n'hi ha que arriben amb 200.
  if (dades.class === "error") {
    throw new Error(`Idescat ha respost un error ${String(dades.status)}: ${String(dades.label)}`);
  }

  const ids = dades.id as string[] | undefined;
  const size = dades.size as number[] | undefined;
  if (!Array.isArray(ids) || !Array.isArray(size) || ids.length !== size.length) {
    throw new Error("resposta de l'Idescat sense `id`/`size`: no és JSON-stat 2.0");
  }
  if (!ids.includes("MUN") || !ids.includes("YEAR")) {
    throw new Error(`taula sense dimensió MUN o YEAR: ${ids.join(", ")}`);
  }

  const total = size.reduce((a, b) => a * b, 1);
  if (total > MAX_CELES) {
    throw new Error(`la taula té ${total} cel·les, massa per parsejar: cal filtrar-la més`);
  }

  const dimensionsBrutes = (dades.dimension ?? {}) as Record<string, { category?: Categoria; label?: string }>;
  const index: Record<string, string[]> = {};
  const etiquetes: Record<string, Record<string, string>> = {};
  const dimensions: TaulaJsonStat["dimensions"] = {};
  for (const dim of ids) {
    const categoria = dimensionsBrutes[dim]?.category ?? {};
    index[dim] = indexOrdenat(categoria);
    etiquetes[dim] = categoria.label ?? {};
    dimensions[dim] = {
      label: dimensionsBrutes[dim]?.label ?? dim,
      categories: index[dim]!.map((id) => ({ id, label: etiquetes[dim]![id] ?? id })),
    };
  }

  const valor = lector<number>(dades.value);
  const estat = lector<string>(dades.status);

  // Passos de cada dimensió a l'hipercub: JSON-stat guarda els valors en ordre
  // de files, amb l'última dimensió com la que varia més de pressa.
  const passos: number[] = new Array(ids.length).fill(1);
  for (let i = ids.length - 2; i >= 0; i -= 1) passos[i] = passos[i + 1]! * size[i + 1]!;

  const posMun = ids.indexOf("MUN");
  const posAny = ids.indexOf("YEAR");

  const celes: CelaJsonStat[] = [];
  const catalunya: CelaJsonStat[] = [];

  for (let posicio = 0; posicio < total; posicio += 1) {
    const coordenades: number[] = new Array(ids.length);
    let resta = posicio;
    for (let i = 0; i < ids.length; i += 1) {
      coordenades[i] = Math.floor(resta / passos[i]!);
      resta %= passos[i]!;
    }

    const mun = index.MUN![coordenades[posMun]!]!;
    const anyText = index.YEAR![coordenades[posAny]!]!;
    const categories: Record<string, string> = {};
    for (let i = 0; i < ids.length; i += 1) {
      const dim = ids[i]!;
      if (dim === "MUN" || dim === "YEAR") continue;
      categories[dim] = index[dim]![coordenades[i]!]!;
    }

    const brutValor = valor(posicio);
    const cela: CelaJsonStat = {
      mun,
      municipi: etiquetes.MUN?.[mun] ?? mun,
      any: Number(anyText),
      categories,
      valor: typeof brutValor === "number" && Number.isFinite(brutValor) ? brutValor : null,
      estat: estat(posicio),
    };
    if (mun === MUN_CATALUNYA) catalunya.push(cela);
    else celes.push(cela);
  }

  const enllacos: EnllacApi[] = [];
  const href = String(dades.href ?? "");
  if (href) enllacos.push({ rel: "self", href, label: String(dades.label ?? "") });
  const link = (dades.link ?? {}) as Record<string, { href?: string; label?: string }[]>;
  for (const [rel, llista] of Object.entries(link)) {
    for (const item of llista ?? []) {
      if (item?.href) enllacos.push({ rel, href: item.href, label: item.label ?? "" });
    }
  }

  const extension = (dades.extension ?? {}) as { status?: { label?: Record<string, string> } };

  return {
    label: String(dades.label ?? ""),
    source: String(dades.source ?? ""),
    updated: dades.updated ? String(dades.updated) : null,
    href,
    enllacos,
    estats: extension.status?.label ?? {},
    dimensions,
    celes,
    catalunya,
  };
}

/**
 * Les categories que hem demanat i que la taula no ha aplicat.
 *
 * Existeix perquè l'API **no** es queixa d'un filtre desconegut: torna 200 i la
 * taula sencera. Sense comparar el que hem demanat amb el que ha tornat, el dia
 * que l'Idescat reanomeni una categoria continuaríem ingerint —i publicant— una
 * xifra que compta una altra cosa.
 */
export function filtresNoAplicats(
  taula: Pick<TaulaJsonStat, "dimensions">,
  filtres: Readonly<Record<string, readonly string[]>>,
): { dimensio: string; demanat: string[]; obtingut: string[] }[] {
  const problemes: { dimensio: string; demanat: string[]; obtingut: string[] }[] = [];
  for (const [dimensio, demanat] of Object.entries(filtres)) {
    const obtingut = taula.dimensions[dimensio]?.categories.map((c) => c.id) ?? [];
    const sobren = obtingut.filter((id) => !demanat.includes(id));
    const falten = demanat.filter((id) => !obtingut.includes(id));
    if (sobren.length > 0 || falten.length > 0) problemes.push({ dimensio, demanat: [...demanat], obtingut });
  }
  return problemes;
}

// ─── Crides a les taules ─────────────────────────────────────────────────────

/**
 * Anys per crida. **Filtrar poc mata la crida**: onze anys de padró per als 948
 * municipis fan que el servidor de l'Idescat respongui 504. Quatre és el que
 * hem comprovat que aguanta sempre, i el mòdul parteix la petició sol.
 */
export const ANYS_PER_CRIDA = 4;

function trossos<T>(llista: readonly T[], mida: number): T[][] {
  const resultat: T[][] = [];
  for (let i = 0; i < llista.length; i += mida) resultat.push(llista.slice(i, i + mida));
  return resultat;
}

export type OpcionsTaula = {
  /** Filtres per dimensió: `{ SEX: ["TOTAL"], NATION: ["ESTR", "TOTAL"] }`. */
  filtres: Readonly<Record<string, readonly string[]>>;
  anys: readonly number[];
  /** Per a taules amb moltes categories, cal baixar-ho encara més. */
  anysPerCrida?: number;
};

function urlTaula(taula: string, filtres: OpcionsTaula["filtres"], anys: readonly number[]): string {
  const url = new URL(`${BASE_TAULES}/${taula}/mun/data`);
  for (const [dimensio, categories] of Object.entries(filtres)) {
    url.searchParams.set(dimensio, categories.join(","));
  }
  url.searchParams.set("YEAR", anys.join(","));
  return url.toString();
}

/**
 * Baixa una taula sencera per als 947 municipis, partint-la per anys.
 *
 * Els enllaços i les metadades de totes les crides es conserven tal com han
 * arribat: `crides` guarda l'URL exacta de cadascuna i `enllacos` tot el que
 * l'API ha declarat, sense repetir-ho i sense retocar-ho.
 */
export async function taulaIdescat(taula: string, opcions: OpcionsTaula): Promise<TaulaIngerida> {
  const anysPerCrida = opcions.anysPerCrida ?? ANYS_PER_CRIDA;
  const grups = trossos([...opcions.anys].sort((a, b) => a - b), anysPerCrida);

  const celes: CelaJsonStat[] = [];
  const catalunya: CelaJsonStat[] = [];
  const crides: string[] = [];
  const perHref = new Map<string, EnllacApi>();
  let primera: TaulaJsonStat | null = null;

  for (const [i, anys] of grups.entries()) {
    const url = urlTaula(taula, opcions.filtres, anys);
    // Pausa entre crides: l'Idescat ens dona les dades de franc i aquestes
    // taules són cares de servir.
    const resposta = await fetchJson<unknown>(url, { delayMs: i === 0 ? 0 : 400, timeoutMs: 120_000 });
    const parsejada = parseJsonStat(resposta);
    primera ??= parsejada;
    celes.push(...parsejada.celes);
    catalunya.push(...parsejada.catalunya);
    crides.push(parsejada.href);
    for (const enllac of parsejada.enllacos) {
      if (!perHref.has(enllac.href)) perHref.set(enllac.href, enllac);
    }
  }

  if (!primera) throw new Error(`cap any demanat per a la taula ${taula}`);
  return {
    taula,
    label: primera.label,
    source: primera.source,
    updated: primera.updated,
    enllacos: [...perHref.values()],
    crides,
    estats: primera.estats,
    dimensions: primera.dimensions,
    celes,
    catalunya,
  };
}

// ─── Fitxa municipal (EMEX): els enllaços per municipi ───────────────────────

/**
 * Un enllaç a la pàgina de l'Idescat d'una taula **d'aquest municipi**.
 *
 * És l'enllaç que la llicència ens fa mostrar al costat de cada xifra, i el
 * dona l'API de fitxes municipals al camp `l` de cada taula. L'API de taules no
 * el dona: per municipi, només hi ha aquest.
 */
export type EnllacMunicipi = {
  /** Identificador de la taula dins de la fitxa: `t68`, `t75`, `t25`… */
  taula: string;
  /** Títol de la taula, tal com el dona l'API. */
  titol: string;
  /** URL exacta, verbatim. No es construeix ni es retoca mai. */
  href: string;
};

export type FitxaEmex = {
  idescat6: string;
  enllacos: EnllacMunicipi[];
};

/** L'API de fitxes torna a vegades una llista i a vegades un objecte sol. */
function llista<T>(valor: T | T[] | undefined): T[] {
  if (valor === undefined || valor === null) return [];
  return Array.isArray(valor) ? valor : [valor];
}

type NodeEmex = { id?: string; c?: string; l?: string; tt?: { t?: NodeEmex | NodeEmex[] } };

/**
 * Els enllaços per municipi d'una fitxa EMEX.
 *
 * Pura i provada: el format té dos paranys. Un grup amb una sola taula ve com a
 * objecte i no com a llista, i no totes les taules porten `l`.
 */
export function parseEmexFitxa(brut: unknown): FitxaEmex {
  const fitxes = (brut as { fitxes?: Record<string, unknown> })?.fitxes;
  if (!fitxes) throw new Error("resposta de l'EMEX sense el bloc `fitxes`");
  if (fitxes.error) throw new Error(`l'EMEX ha respost un error ${String(fitxes.error)}`);

  const cols = llista((fitxes.cols as { col?: unknown } | undefined)?.col as NodeEmex | NodeEmex[]);
  const municipi = cols.find((c) => (c as { scheme?: string }).scheme === "mun");
  const idescat6 = String(municipi?.id ?? "");

  const enllacos: EnllacMunicipi[] = [];
  const vistos = new Set<string>();
  for (const grup of llista((fitxes.gg as { g?: NodeEmex | NodeEmex[] } | undefined)?.g)) {
    for (const taula of llista(grup.tt?.t)) {
      if (!taula.l || !taula.id) continue;
      if (vistos.has(taula.id)) continue;
      vistos.add(taula.id);
      enllacos.push({ taula: taula.id, titol: taula.c ?? "", href: taula.l });
    }
  }
  return { idescat6, enllacos };
}

/**
 * La fitxa d'un municipi. Una crida per municipi: l'EMEX només dona el camp `l`
 * quan se li demana un municipi concret. En mode massiu (`tipus=mun`) torna els
 * 947 de cop però sense cap enllaç, que és precisament el que ens cal.
 */
export async function emexFitxa(idescat6: string, delayMs = 250): Promise<FitxaEmex> {
  const url = new URL(`${BASE_EMEX}/dades.json`);
  url.searchParams.set("id", idescat6);
  const resposta = await fetchJson<unknown>(url.toString(), { delayMs, timeoutMs: 60_000 });
  return parseEmexFitxa(resposta);
}

// ─── Fitxa municipal (EMEX), mode massiu: un indicador per als 947 alhora ────

/**
 * Un indicador de l'EMEX demanat en mode massiu: la mateixa xifra per a tots
 * els municipis d'una tirada, amb l'any i la font que declara l'API.
 */
export type IndicadorMassiu = {
  /** Identificador de l'indicador: `f19`, `f163`… */
  id: string;
  /** Nom de l'indicador, tal com el dona l'API («Turismes»). */
  nom: string;
  /** La taula de la fitxa d'on surt: `t18` «Parc de vehicles». */
  taula: { id: string; nom: string };
  /** Any de referència que declara l'API, o `null` si no és un any. */
  any: number | null;
  /** Atribució de la font, literal («Idescat, a partir de la DGT.»). */
  font: string;
  unitat: string;
  /** Data d'actualització que declara l'Idescat. */
  updated: string | null;
  /** Valor per municipi, per codi Idescat de sis xifres. `null` és «no hi ha dada». */
  valors: Map<string, number | null>;
};

export type EmexMassiu = {
  /** Els municipis, en l'ordre de l'API, amb el nom tal com l'escriu l'Idescat. */
  municipis: { idescat6: string; nom: string }[];
  indicadors: IndicadorMassiu[];
};

/**
 * Llegeix la resposta de `dades.json?tipus=mun&i=…`.
 *
 * En mode massiu l'API no torna una fitxa per municipi sinó un vector `v` per
 * indicador: els valors dels 947 municipis separats per comes, **en l'ordre de
 * `cols`**. L'aparellament és per posició, i per això aquí es converteix de
 * seguida en un mapa per codi: qui llegeixi el vector per posició en un altre
 * lloc confondria municipis el dia que l'Idescat canviï l'ordre. Un vector més
 * curt o més llarg que la llista de municipis és un error i no una dada.
 *
 * Els valors que no són un número (una cel·la buida o un `..`) queden com a
 * `null`: no hi ha dada, i no és cap zero.
 */
export function parseEmexMassiu(brut: unknown): EmexMassiu {
  const fitxes = (brut as { fitxes?: Record<string, unknown> })?.fitxes;
  if (!fitxes) throw new Error("resposta de l'EMEX sense el bloc `fitxes`");
  if (fitxes.error) throw new Error(`l'EMEX ha respost un error ${String(fitxes.error)}`);

  const cols = llista((fitxes.cols as { col?: unknown } | undefined)?.col as NodeEmex | NodeEmex[]);
  const municipis = cols
    .filter((c) => (c as { scheme?: string }).scheme === "mun" && c.id)
    .map((c) => ({ idescat6: String(c.id), nom: String((c as { content?: string }).content ?? "") }));
  if (municipis.length === 0) throw new Error("resposta massiva de l'EMEX sense cap municipi a `cols`");

  type NodeIndicador = {
    id?: string; c?: string; r?: string; s?: string; u?: string; v?: string; updated?: string;
    t?: { id?: string; content?: string };
  };
  const nodes = llista((fitxes.indicadors as { i?: NodeIndicador | NodeIndicador[] } | undefined)?.i);
  const indicadors: IndicadorMassiu[] = [];
  for (const node of nodes) {
    if (!node.id) continue;
    const trossos = String(node.v ?? "").split(",");
    if (trossos.length !== municipis.length) {
      throw new Error(
        `l'indicador ${node.id} porta ${trossos.length} valors i hi ha ${municipis.length} municipis: no es pot aparellar`,
      );
    }
    const valors = new Map<string, number | null>();
    trossos.forEach((text, i) => {
      const net = text.trim();
      valors.set(municipis[i]!.idescat6, /^-?\d+(\.\d+)?$/.test(net) ? Number(net) : null);
    });
    const any = /^\d{4}$/.test(String(node.r ?? "")) ? Number(node.r) : null;
    indicadors.push({
      id: node.id,
      nom: node.c ?? "",
      taula: { id: node.t?.id ?? "", nom: node.t?.content ?? "" },
      any,
      font: node.s ?? "",
      unitat: node.u ?? "",
      updated: node.updated ?? null,
      valors,
    });
  }
  return { municipis, indicadors };
}

/** L'URL del mode massiu, que es desa a la mètrica com a crida feta. */
export function urlEmexMassiu(indicadors: readonly string[]): string {
  const url = new URL(`${BASE_EMEX}/dades.json`);
  url.searchParams.set("tipus", "mun");
  url.searchParams.set("i", indicadors.join(","));
  url.searchParams.set("lang", "ca");
  return url.toString();
}

/**
 * Uns quants indicadors per a tots els municipis en **una** crida.
 *
 * És el mode que no dona l'enllaç per municipi (`l`): l'enllaç que la
 * llicència obliga a ensenyar és el que J18 ja ha desat de cada fitxa, i el
 * job que faci servir això l'ha d'anar a buscar allà.
 */
export async function emexMassiu(indicadors: readonly string[]): Promise<{ url: string; dades: EmexMassiu }> {
  const url = urlEmexMassiu(indicadors);
  const resposta = await fetchJson<unknown>(url, { timeoutMs: 120_000 });
  return { url, dades: parseEmexMassiu(resposta) };
}
