import { fetchJson } from "../lib/http";

/**
 * Portal de dades obertes de la Generalitat (Socrata). Tot el que necessitem per
 * a la Fase 1 —territori, resultats, plens i candidatures— hi és, i és gratuït i
 * sense clau. Els datasets grans s'han de paginar: `xnfg-weec` té 43.710 files.
 */
const BASE = "https://analisi.transparenciacatalunya.cat/resource";

/** Datasets verificats amb crides reals el 28-08-2026. */
export const DATASETS = {
  /** Dades generals dels ens locals: municipis, padró, alcaldia, contacte. */
  ensLocals: "6nei-4b44",
  /** Processos electorals — vots i escons per candidatura. */
  resultats: "ntc4-rnwr",
  /** Processos electorals — persones candidates, amb `electe`. */
  candidats: "xnfg-weec",
  /** Composició dels plens municipals. */
  plens: "nm3n-3vbj",
  /** Càrrecs electes, amb correu electrònic. */
  carrecs: "m5nd-xjza",
} as const;

export type SocrataQuery = {
  select?: string;
  where?: string;
  order?: string;
  group?: string;
  /** Filtres simples camp=valor, que Socrata accepta com a paràmetres directes. */
  filters?: Record<string, string>;
};

function buildUrl(dataset: string, query: SocrataQuery, limit: number, offset: number): string {
  const url = new URL(`${BASE}/${dataset}.json`);
  for (const [key, value] of Object.entries(query.filters ?? {})) url.searchParams.set(key, value);
  if (query.select) url.searchParams.set("$select", query.select);
  if (query.where) url.searchParams.set("$where", query.where);
  if (query.group) url.searchParams.set("$group", query.group);
  // Sense un ordre estable la paginació pot repetir o saltar files.
  url.searchParams.set("$order", query.order ?? ":id");
  url.searchParams.set("$limit", String(limit));
  url.searchParams.set("$offset", String(offset));
  return url.toString();
}

export async function* socrataPages<T>(
  dataset: string,
  query: SocrataQuery = {},
  pageSize = 5_000,
): AsyncGenerator<T[]> {
  let offset = 0;
  for (;;) {
    const url = buildUrl(dataset, query, pageSize, offset);
    const page = await fetchJson<T[]>(url, { delayMs: offset === 0 ? 0 : 250 });
    if (page.length === 0) return;
    yield page;
    if (page.length < pageSize) return;
    offset += pageSize;
  }
}

export async function socrataAll<T>(dataset: string, query: SocrataQuery = {}, pageSize = 5_000): Promise<T[]> {
  const rows: T[] = [];
  for await (const page of socrataPages<T>(dataset, query, pageSize)) rows.push(...page);
  return rows;
}
