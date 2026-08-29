import { fetchJson } from "../lib/http";

/**
 * Dades obertes del Consorci AOC (CKAN). D'aquí surt l'índex d'actes de tots els
 * ajuntaments catalans: 25.902 des del 17 de juny de 2023, que és l'inici del
 * mandat actual i per tant el punt on comença tot el que volem explicar.
 *
 * Parany verificat: `CODI_ENS` és un ENTER, així que els municipis de Barcelona
 * hi perden el zero inicial (Sabadell `0818780001` → `818780001`).
 */
const CKAN = "https://dadesobertes.seu-e.cat/api/3/action";

/** Índex d'actes: DATA_ACORD, TIPUS, ENLLAÇ_ACTA, CODI_ACTA, CODI_ENS, NOM_ENS. */
export const ACTES_RESOURCE = "b5d370d0-7916-48b6-8a69-3c7fa62a1467";

/** Inici del mandat 2023-2027: la data de constitució dels plens. */
export const MANDATE_START = "2023-06-17";

export type ActaRow = {
  _id: number;
  DATA_ACORD: string;
  TIPUS: string;
  "ENLLAÇ_ACTA": string;
  CODI_ACTA: string;
  CODI_ENS: number;
  NOM_ENS: string;
};

type SqlResponse<T> = { success: boolean; result: { records: T[] } };

export async function ckanSql<T>(sql: string): Promise<T[]> {
  const url = `${CKAN}/datastore_search_sql?sql=${encodeURIComponent(sql)}`;
  const response = await fetchJson<SqlResponse<T>>(url, { timeoutMs: 180_000 });
  if (!response.success) throw new Error(`consulta CKAN rebutjada: ${sql.slice(0, 120)}`);
  return response.result.records;
}

export type MinutesCoverage = {
  codiEns: number;
  count: number;
  firstDate: string;
  lastDate: string;
};

/**
 * Cobertura d'actes per ens des de l'inici del mandat. Una sola consulta per a
 * tot Catalunya: és el semàfor de dades de cada municipi i el que decideix on
 * podrà arribar la brúixola i on ens haurem de quedar a la radiografia.
 */
export async function minutesCoverage(since = MANDATE_START): Promise<MinutesCoverage[]> {
  const rows = await ckanSql<{ CODI_ENS: number; n: string; primera: string; ultima: string }>(
    `SELECT "CODI_ENS", COUNT(*) AS n, MIN("DATA_ACORD") AS primera, MAX("DATA_ACORD") AS ultima
     FROM "${ACTES_RESOURCE}" WHERE "DATA_ACORD" >= '${since}' GROUP BY "CODI_ENS"`,
  );
  return rows.map((r) => ({
    codiEns: Number(r.CODI_ENS),
    count: Number(r.n),
    firstDate: String(r.primera).slice(0, 10),
    lastDate: String(r.ultima).slice(0, 10),
  }));
}
