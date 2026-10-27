import { mkdir, rename, stat, readFile, writeFile } from "node:fs/promises";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { parseEmexMassiu, urlEmexMassiu, PALMEROLA, type EmexMassiu, type EnllacMunicipi } from "../adapters/idescat";
import { buildPeerGroups } from "../derive/peers";
import { fetchJson, sleep } from "../lib/http";
import { withRun } from "../lib/run";
import { arrodoneix } from "./j9-habitatge-residus";
import { comparaDinsDelGrup, perTandes, LLICENCIA_IDESCAT, type ComparacioVehicles } from "./j34-vehicles";
import { fetchBytes } from "./j35-alcaldes-ministeri";
import { PROVINCIES_CATALANES } from "./j37-llistes-obertes";

/**
 * J44 — el context socioeconòmic: quanta gent és a l'atur, i de quina renda,
 * pensió i estudis és el poble on passa tot el que decideix el ple.
 *
 * No és un balanç del govern municipal. L'atur, la renda i les pensions
 * depenen de l'economia, de qui hi viu i de lleis que no vota cap ajuntament;
 * la fitxa les dona perquè sense elles la resta no s'entén —una taxa
 * d'escombraries no pesa igual a tot arreu—, i ho diu amb aquestes paraules.
 *
 * ─── LES FONTS, I PER QUÈ AQUESTES ──────────────────────────────────────────
 *
 * **1. SEPE, «Paro registrado por municipios».** El Servei Públic d'Ocupació
 * Estatal publica a la seva seu un CSV per any amb l'atur registrat de cada
 * municipi d'Espanya, mes a mes, per sexe i edat i per sector:
 * `…/datos_abiertos/datos/Paro_por_municipios_AAAA_csv.csv`. Comprovat el 27
 * d'octubre del 2026: fitxers del 2018 al 2026, uns 10 MB cadascun, en
 * Latin-1, separats per `;`, amb una línia de títol abans de la capçalera i
 * **947 municipis catalans a cada mes**. El del 2026 arriba fins al setembre
 * (202609). **El del 2020 no porta el desembre**: té onze mesos, i la mitjana
 * d'aquell any queda com a forat, no com una mitjana de onze. Els valors de
 * menys de cinc persones surten com a `<5`: és secret estadístic, i aquí
 * queden com a `null` —ni zero ni cinc—.
 *
 * Contrastat amb l'Idescat: la mitjana anual del 2025 que fa aquest job amb
 * els dotze mesos del SEPE és exactament l'indicador `f242` de l'EMEX («Atur
 * registrat», mitjanes anuals, Departament d'Empresa i Treball): 4.296,4 a
 * Girona, 63.038,8 a Barcelona, 10,2 a Abella de la Conca. Per això `f242` no
 * es demana: diria el mateix amb una altra font i un altre any.
 *
 * **2. Idescat, EMEX en mode massiu**, una sola crida per als 947
 * (`dades.json?tipus=mun&i=f385,f10,f376,f389,f377`). Cada codi comprovat
 * contra la resposta el 27 d'octubre del 2026 —nom, taula, any i font tal com
 * els declara l'API—:
 *
 *   · `f385` Índex socioeconòmic territorial (taula `t213`, Catalunya = 100),
 *     **2024 provisional** («2024 (p)»), Idescat.
 *   · `f10` IRPF, base imposable per declarant (`t9`), **2023**, euros, Idescat
 *     a partir de l'Agència Tributària.
 *   · `f376` Pensió contributiva mitjana (`t209`, desembre), **2025**, euros,
 *     Idescat a partir de l'INSS i l'ISM.
 *   · `f389` Educació superior (`t215`, població de 15 anys i més), **2024**,
 *     %, Idescat a partir del cens anual de l'INE.
 *   · `f377` Afiliats a la Seguretat Social segons residència (`t210`),
 *     **agost del 2026** («08/2026»), arrodonits a múltiples de cinc.
 *
 * El parser comú (`parseEmexMassiu`) només entén anys de quatre xifres, i dos
 * d'aquests indicadors no en porten: «2024 (p)» i «08/2026». Per això aquí es
 * fa la crida amb `fetchJson` i es llegeix el camp `r` de la resposta crua al
 * costat del parser comú (`periodesEmex`), en comptes de cridar `emexMassiu`.
 *
 * ─── LA TAXA, I PER QUÈ ÉS APROXIMADA ───────────────────────────────────────
 *
 * Ningú publica la taxa d'atur de cada municipi: l'EPA no baixa a municipis.
 * El que es pot fer és **atur registrat / (atur registrat + afiliats per
 * residència)** del mateix mes, que s'hi acosta però no ho és: l'atur
 * registrat no és l'atur de l'EPA (hi falta qui no s'inscriu i hi ha qui
 * s'inscriu treballant poques hores), i els afiliats compten afiliacions, no
 * persones. Es desa i es publica dient-ne «aproximada», i es compara amb la
 * mediana dels de la seva mida només quan totes dues xifres hi són.
 *
 * ─── LES LLICÈNCIES ─────────────────────────────────────────────────────────
 *
 * **SEPE**: avís legal de la seu (Llei 37/2007 i RD 1495/2011): cal citar la
 * font —«Origen de los datos: SEPE»—, dir la data de l'última actualització,
 * no desnaturalitzar-ne el sentit i no suggerir que el SEPE avala qui les
 * reutilitza. **Idescat**: les mateixes condicions que J18 i J34; el mode
 * massiu no dona enllaç per municipi, i es fa servir el que J18 va desar a
 * `poblacioEnllacos` per a cada taula (`t213`, `t9`, `t209`, `t215`, `t210`).
 *
 * ─── COM VA ─────────────────────────────────────────────────────────────────
 *
 * Els CSV es desen a `packages/db/.data/sepe/` (o a `QUIVOTO_SEPE_DIR`). Els
 * anys tancats —baixats després de l'1 de febrer de l'any següent— no es
 * tornen a baixar mai; l'any en curs es torna a baixar si la còpia té més de
 * tres dies. El primer cop són uns 75 MB; després, un fitxer de 8 MB.
 * Va a mà, després de J1 i de J18: `pnpm ingest j44`. No és a `ORDER`.
 */

export const KIND = "socioeconomia";

/** El mes que el ple d'ara va prendre possessió (17 de juny del 2023). */
export const MES_INICI_MANDAT = "2023-06";
/** El primer any de la sèrie de mitjanes anuals. */
export const PRIMER_ANY = 2019;

export const BASE_SEPE = "https://sede.sepe.gob.es/es/portaltrabaja/resources/sede/datos_abiertos/datos/";
export const PAGINA_SEPE = "https://www.sepe.es/HomeSepe/que-es-el-sepe/estadisticas/datos-estadisticos/municipios.html";

export const FONT_SEPE = {
  nom: "Paro registrado por municipios",
  organisme: "Servei Públic d'Ocupació Estatal (SEPE)",
  url: PAGINA_SEPE,
  llicencia:
    "Avís legal del SEPE (Llei 37/2007): citar la font («Origen de los datos: SEPE») i la data de l'última " +
    "actualització, sense desnaturalitzar-ne el sentit",
} as const;

/** On es desen els CSV. `.data/` és ignorat pel repositori, com els zips de J37. */
export const DIR_CAU =
  process.env.QUIVOTO_SEPE_DIR ?? new URL("../../../db/.data/sepe/", import.meta.url).pathname;

/** Quant pot tenir la còpia de l'any en curs abans de tornar-la a baixar. */
const VIDA_ANY_OBERT_MS = 3 * 24 * 60 * 60 * 1000;
const PAUSA_MS = 1_000;

export const urlSepe = (any: number): string => `${BASE_SEPE}Paro_por_municipios_${any}_csv.csv`;
export const nomFitxerSepe = (any: number): string => `Paro_por_municipios_${any}_csv.csv`;

export const NOTA_COMPETENCIES =
  "L'atur, la renda, les pensions i els estudis depenen de l'economia, de qui hi viu i de lleis estatals i " +
  "catalanes. L'ajuntament hi pot fer poc: plans d'ocupació, el servei local d'ocupació si en té, la " +
  "promoció econòmica i els ajuts socials. És el context on treballa el ple, no el balanç del que ha fet.";

export const NOTA_ATUR =
  "L'atur registrat compta les persones inscrites a les oficines d'ocupació sense feina l'últim dia del mes; " +
  "no és la taxa d'atur de l'EPA. Varia amb les estacions: per comparar mesos de dos anys, el mateix mes.";

// ─────────────────────────────────────────────────────────────────────────────
// El CSV del SEPE
// ─────────────────────────────────────────────────────────────────────────────

/** Els cinc sectors del CSV, amb el nom de la columna tal com ve. */
export const SECTORS = {
  agricultura: "Paro Agricultura",
  industria: "Paro Industria",
  construccio: "Paro Construcción",
  serveis: "Paro Servicios",
  senseOcupacioAnterior: "Paro Sin empleo Anterior",
} as const;
export type Sector = keyof typeof SECTORS;

const COLUMNES_HOMES = ["Paro hombre edad < 25", "Paro hombre edad 25 -45", "Paro hombre edad >=45"] as const;
const COLUMNES_DONES = ["Paro mujer edad < 25", "Paro mujer edad 25 -45", "Paro mujer edad >=45"] as const;

/** Una fila catalana del CSV: un municipi en un mes. `null` és «menys de cinc» o buit. */
export type FilaAtur = {
  /** «2026-09». */
  mes: string;
  ine5: string;
  municipi: string;
  total: number | null;
  /** Suma de les tres franges d'edat, o `null` si alguna és `<5`: no es pot sumar un secret. */
  homes: number | null;
  dones: number | null;
  sectors: Record<Sector, number | null>;
};

/** Els bytes del CSV, que el SEPE escriu en Latin-1 (ISO-8859-1). */
export function decodificaLatin1(bytes: Uint8Array): string {
  return new TextDecoder("latin1").decode(bytes);
}

/**
 * Una cel·la de recompte: un enter, o `null` si és `<5` (secret estadístic:
 * entre una i quatre persones) o si és buida. Mai un zero inventat.
 */
export function llegeixRecompte(text: string | undefined): number | null {
  const net = (text ?? "").trim();
  if (!/^\d+$/.test(net)) return null;
  return Number(net);
}

const sumaSiTotes = (valors: readonly (number | null)[]): number | null =>
  valors.some((v) => v === null) ? null : valors.reduce<number>((a, b) => a + (b as number), 0);

/**
 * Llegeix un CSV anual del SEPE i en torna només les files catalanes.
 *
 * La capçalera no és la primera línia —abans hi ha un títol— i porta espais
 * de més («Código mes », « Municipio», «Paro hombre edad 25 -45 »): es busca
 * la línia que comença per «Código mes» i les columnes s'aparellen pel nom
 * net, mai per la posició. Si en falta alguna, el fitxer no és el que
 * s'esperava i val més plantar-se que ingerir dones on tocaven homes.
 * Catalunya es tria pel codi INE (`08`, `17`, `25`, `43`), no pel nom.
 */
export function parseAturSepe(text: string): { files: FilaAtur[]; estranyes: number } {
  const linies = text.split(/\r?\n/);
  const iCapcalera = linies.findIndex((l) => /^C[oó]digo mes/i.test(l.trim()));
  if (iCapcalera === -1) throw new Error("el CSV del SEPE no porta la capçalera «Código mes»");
  const capcalera = linies[iCapcalera]!.split(";").map((c) => c.trim());
  const columna = (nom: string): number => {
    const i = capcalera.indexOf(nom);
    if (i === -1) throw new Error(`al CSV del SEPE li falta la columna «${nom}»`);
    return i;
  };
  const cMes = columna("Código mes");
  const cMunicipi = columna("Codigo Municipio");
  const cNom = columna("Municipio");
  const cTotal = columna("total Paro Registrado");
  const cHomes = COLUMNES_HOMES.map(columna);
  const cDones = COLUMNES_DONES.map(columna);
  const cSectors = Object.fromEntries(
    (Object.entries(SECTORS) as [Sector, string][]).map(([clau, nom]) => [clau, columna(nom)]),
  ) as Record<Sector, number>;

  const files: FilaAtur[] = [];
  let estranyes = 0;
  for (const linia of linies.slice(iCapcalera + 1)) {
    if (linia.trim() === "") continue;
    const camps = linia.split(";");
    const codiMes = (camps[cMes] ?? "").trim();
    const ine5 = (camps[cMunicipi] ?? "").trim().padStart(5, "0");
    if (!/^\d{6}$/.test(codiMes) || !/^\d{5}$/.test(ine5)) {
      estranyes += 1;
      continue;
    }
    if (!PROVINCIES_CATALANES.has(ine5.slice(0, 2))) continue;
    files.push({
      mes: `${codiMes.slice(0, 4)}-${codiMes.slice(4, 6)}`,
      ine5,
      municipi: (camps[cNom] ?? "").trim(),
      total: llegeixRecompte(camps[cTotal]),
      homes: sumaSiTotes(cHomes.map((i) => llegeixRecompte(camps[i]))),
      dones: sumaSiTotes(cDones.map((i) => llegeixRecompte(camps[i]))),
      sectors: Object.fromEntries(
        (Object.keys(SECTORS) as Sector[]).map((s) => [s, llegeixRecompte(camps[cSectors[s]])]),
      ) as Record<Sector, number | null>,
    });
  }
  return { files, estranyes };
}

// ─────────────────────────────────────────────────────────────────────────────
// De les files d'un municipi a la seva sèrie
// ─────────────────────────────────────────────────────────────────────────────

/** «2026-09» → el mes anterior o posterior. */
export function sumaMesos(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number) as [number, number];
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** Tots els mesos de `desDe` a `finsA`, tots dos inclosos. */
export function mesosEntre(desDe: string, finsA: string): string[] {
  const mesos: string[] = [];
  for (let mes = desDe; mes <= finsA; mes = sumaMesos(mes, 1)) mesos.push(mes);
  return mesos;
}

export type MitjanaAnual = {
  any: number;
  /** Mitjana dels dotze mesos amb un decimal, o `null` si en falta algun o n'hi ha d'amagats. */
  mitjana: number | null;
  /** Quants mesos té la font amb xifra, de dotze. */
  mesos: number;
};

/**
 * La mitjana de cada any, **només amb els dotze mesos**. Un any amb un mes
 * que la font no publica (el desembre del 2020) o amagat per secret (`<5`)
 * no té mitjana: una mitjana d'onze mesos d'una sèrie estacional no és la de
 * l'any, i la gràfica ho ha de dibuixar com un forat.
 */
export function mitjanesAnuals(perMes: ReadonlyMap<string, number | null>, anys: readonly number[]): MitjanaAnual[] {
  return anys.map((any) => {
    const valors: number[] = [];
    for (let m = 1; m <= 12; m += 1) {
      const v = perMes.get(`${any}-${String(m).padStart(2, "0")}`);
      if (typeof v === "number") valors.push(v);
    }
    return {
      any,
      mitjana: valors.length === 12 ? arrodoneix(valors.reduce((a, b) => a + b, 0) / 12, 1) : null,
      mesos: valors.length,
    };
  });
}

export type Variacio = { absoluta: number; percent: number | null };

/** De `abans` a `ara`: la diferència i el canvi relatiu en %, amb un decimal. */
export function variacio(abans: number | null, ara: number | null): Variacio | null {
  if (abans === null || ara === null) return null;
  return { absoluta: ara - abans, percent: abans > 0 ? arrodoneix((100 * (ara - abans)) / abans, 1) : null };
}

/** La taxa aproximada en %, amb un decimal: atur / (atur + afiliats). */
export function taxaAproximada(atur: number | null, afiliats: number | null): number | null {
  if (atur === null || afiliats === null || atur + afiliats <= 0) return null;
  return arrodoneix((100 * atur) / (atur + afiliats), 1);
}

export type MesAtur = {
  mes: string;
  total: number | null;
  homes: number | null;
  dones: number | null;
  sectors: Record<Sector, number | null>;
};

export type AturMunicipi = {
  /** El darrer mes que publica el SEPE, el mateix per a tots: «2026-09». */
  ara: MesAtur;
  /** El juny del 2023, quan va prendre possessió el ple d'ara. */
  iniciMandat: { mes: string; total: number | null };
  /** El mateix mes de l'any abans, que és la comparació que no enganya l'estació. */
  faUnAny: { mes: string; total: number | null };
  respecteMandat: Variacio | null;
  respecteFaUnAny: Variacio | null;
  /** Mes a mes des de l'inici del mandat fins a `ara.mes`, en ordre; `null` és `<5` o sense fila. */
  mensual: { desDe: string; valors: (number | null)[] };
  /** Mitjanes anuals des del 2019, només dels anys sencers. */
  anual: MitjanaAnual[];
  /** Quants mesos del mandat surten com a `<5`: als pobles petits, la sèrie és poc més que soroll. */
  mesosAmagats: number;
};

const MES_BUIT = (mes: string): MesAtur => ({
  mes,
  total: null,
  homes: null,
  dones: null,
  sectors: Object.fromEntries(Object.keys(SECTORS).map((s) => [s, null])) as Record<Sector, number | null>,
});

/**
 * L'atur d'un municipi a partir de les seves files, indexades per mes. Torna
 * `null` si el municipi no té cap xifra en tot el mandat —ni tan sols un
 * `<5`—, que vol dir que el SEPE no el publica i no que no hi hagi atur.
 */
export function aturDelMunicipi(
  perMes: ReadonlyMap<string, FilaAtur>,
  ultimMes: string,
  anys: readonly number[],
): AturMunicipi | null {
  const mesos = mesosEntre(MES_INICI_MANDAT, ultimMes);
  if (!mesos.some((m) => perMes.has(m))) return null;
  const fila = perMes.get(ultimMes);
  const ara: MesAtur = fila
    ? { mes: ultimMes, total: fila.total, homes: fila.homes, dones: fila.dones, sectors: { ...fila.sectors } }
    : MES_BUIT(ultimMes);
  const totalDe = (mes: string): number | null => perMes.get(mes)?.total ?? null;
  const mesFaUnAny = sumaMesos(ultimMes, -12);
  const valors = mesos.map(totalDe);
  const totals = new Map<string, number | null>();
  for (const [mes, f] of perMes) totals.set(mes, f.total);
  return {
    ara,
    iniciMandat: { mes: MES_INICI_MANDAT, total: totalDe(MES_INICI_MANDAT) },
    faUnAny: { mes: mesFaUnAny, total: totalDe(mesFaUnAny) },
    respecteMandat: variacio(totalDe(MES_INICI_MANDAT), ara.total),
    respecteFaUnAny: variacio(totalDe(mesFaUnAny), ara.total),
    mensual: { desDe: MES_INICI_MANDAT, valors },
    anual: mitjanesAnuals(totals, anys),
    mesosAmagats: mesos.filter((m) => perMes.has(m) && perMes.get(m)!.total === null).length,
  };
}

export type AturCatalunya = {
  mes: string;
  /** Suma dels municipis amb xifra als dos mesos; els `<5` no hi caben. */
  iniciMandat: number;
  ara: number;
  respecteMandat: Variacio | null;
  /** Sobre quants municipis s'ha sumat. */
  municipis: number;
};

/**
 * Catalunya sencera, perquè el municipi tingui amb què comparar el seu canvi
 * des del 2023. El SEPE no publica cap fila de Catalunya: se sumen els
 * municipis que tenen xifra al juny del 2023 i al darrer mes, i es diu sobre
 * quants. Els `<5` que en queden fora són, com a molt, uns centenars de
 * persones de més de 300.000.
 */
export function aturCatalunya(atur: Iterable<AturMunicipi>, ultimMes: string): AturCatalunya {
  let abans = 0;
  let ara = 0;
  let municipis = 0;
  for (const a of atur) {
    if (a.iniciMandat.total === null || a.ara.total === null) continue;
    abans += a.iniciMandat.total;
    ara += a.ara.total;
    municipis += 1;
  }
  return { mes: ultimMes, iniciMandat: abans, ara, respecteMandat: variacio(abans, ara), municipis };
}

// ─────────────────────────────────────────────────────────────────────────────
// Els indicadors de l'EMEX
// ─────────────────────────────────────────────────────────────────────────────

/** Els cinc indicadors, amb el codi de l'API, la taula on viuen i la pàgina general de l'Idescat. */
export const INDICADORS_EMEX = {
  ist: { id: "f385", taula: "t213", nom: "Índex socioeconòmic territorial", pagina: "https://www.idescat.cat/pub/?id=ist" },
  irpfBase: { id: "f10", taula: "t9", nom: "Base imposable de l'IRPF per declarant", pagina: "https://www.idescat.cat/pub/?id=irpf" },
  pensio: { id: "f376", taula: "t209", nom: "Pensió contributiva mitjana", pagina: "https://www.idescat.cat/pub/?id=pens" },
  educacioSuperior: { id: "f389", taula: "t215", nom: "Població de 15 anys i més amb educació superior", pagina: "https://www.idescat.cat/pub/?id=censph" },
  afiliats: { id: "f377", taula: "t210", nom: "Afiliats a la Seguretat Social segons residència", pagina: "https://www.idescat.cat/pub/?id=afi" },
} as const;
export type ClauIndicador = keyof typeof INDICADORS_EMEX;

/** El període que declara l'API, entès: «2024 (p)», «2023», «08/2026». */
export type PeriodeEmex = {
  /** Tal com el dona l'API. */
  text: string;
  any: number | null;
  /** «2026-08» quan el període és un mes; si no, `null`. */
  mes: string | null;
  /** L'Idescat el marca com a provisional, «(p)». */
  provisional: boolean;
};

export function llegeixPeriode(text: string): PeriodeEmex {
  const net = text.trim();
  const mes = /^(\d{1,2})\/(\d{4})$/.exec(net);
  if (mes) return { text: net, any: Number(mes[2]), mes: `${mes[2]}-${mes[1]!.padStart(2, "0")}`, provisional: false };
  const any = /^(\d{4})\b/.exec(net);
  return { text: net, any: any ? Number(any[1]) : null, mes: null, provisional: /\(p\)/i.test(net) };
}

/** El camp `r` de cada indicador de la resposta crua, que el parser comú no guarda si no és un any net. */
export function periodesEmex(brut: unknown): Map<string, PeriodeEmex> {
  const nodes = (brut as { fitxes?: { indicadors?: { i?: unknown } } })?.fitxes?.indicadors?.i;
  const llista = (Array.isArray(nodes) ? nodes : nodes ? [nodes] : []) as { id?: string; r?: string }[];
  const periodes = new Map<string, PeriodeEmex>();
  for (const node of llista) if (node.id && node.r) periodes.set(node.id, llegeixPeriode(String(node.r)));
  return periodes;
}

/**
 * Comprova que la resposta porta els cinc indicadors i cadascun a la seva
 * taula. Si l'Idescat un dia reordena els codis, val més plantar-se que
 * publicar la pensió on tocava l'IRPF.
 */
export function comprovaIndicadors(dades: EmexMassiu, periodes: ReadonlyMap<string, PeriodeEmex>): string[] {
  const problemes: string[] = [];
  for (const [clau, def] of Object.entries(INDICADORS_EMEX)) {
    const indicador = dades.indicadors.find((i) => i.id === def.id);
    if (!indicador) {
      problemes.push(`falta l'indicador ${def.id} (${clau})`);
      continue;
    }
    if (indicador.taula.id !== def.taula) {
      problemes.push(`l'indicador ${def.id} (${clau}) és de la taula ${indicador.taula.id || "?"} i no de ${def.taula}`);
    }
    if (periodes.get(def.id)?.any == null) problemes.push(`l'indicador ${def.id} (${clau}) no porta cap període llegible`);
  }
  return problemes;
}

export type IndicadorSocio = {
  clau: ClauIndicador;
  /** El nom que fa servir la fitxa. */
  nom: string;
  /** El nom que dona l'API, verbatim. */
  nomApi: string;
  valor: number | null;
  /** La unitat que declara l'API: «índex Catalunya=100», «euros», «%», buit. */
  unitat: string;
  periode: PeriodeEmex;
  /** L'atribució literal de l'API («Idescat, a partir de l'Agència Estatal…»). */
  font: string;
  taula: { id: string; nom: string };
  /** L'enllaç d'aquest municipi que J18 va desar per a la taula, verbatim, o `null`. */
  enllac: EnllacMunicipi | null;
  /** La pàgina general de l'estadística a Idescat.cat, per quan no hi ha enllaç. */
  pagina: string;
  actualitzat: string | null;
  /** Context, no balanç: cap d'aquestes xifres no és ni bona ni dolenta per a l'ajuntament. */
  amuntEsMillor: null;
};

/** Els indicadors d'un municipi; els que la font no li publica no hi són. */
export function indicadorsDelMunicipi(
  dades: EmexMassiu,
  periodes: ReadonlyMap<string, PeriodeEmex>,
  idescat6: string,
  enllacos: ReadonlyMap<string, EnllacMunicipi>,
): IndicadorSocio[] {
  const out: IndicadorSocio[] = [];
  for (const [clau, def] of Object.entries(INDICADORS_EMEX) as [ClauIndicador, (typeof INDICADORS_EMEX)[ClauIndicador]][]) {
    const indicador = dades.indicadors.find((i) => i.id === def.id);
    const periode = periodes.get(def.id);
    const valor = indicador?.valors.get(idescat6) ?? null;
    if (!indicador || !periode || valor === null) continue;
    out.push({
      clau,
      nom: def.nom,
      nomApi: indicador.nom,
      valor,
      unitat: indicador.unitat,
      periode,
      font: indicador.font,
      taula: indicador.taula,
      enllac: enllacos.get(def.taula) ?? null,
      pagina: def.pagina,
      actualitzat: indicador.updated,
      amuntEsMillor: null,
    });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// La mètrica
// ─────────────────────────────────────────────────────────────────────────────

export type TaxaAproximada = {
  /** El mes dels afiliats, que és el que mana: «2026-08». */
  mes: string;
  atur: number;
  afiliats: number;
  /** atur / (atur + afiliats), en %, amb un decimal. **No** és la taxa d'atur de l'EPA. */
  taxa: number;
  aproximada: true;
  /** La mateixa taxa dins del grup de mida, només amb els que la tenen. */
  comparacio: ComparacioVehicles | null;
  amuntEsMillor: null;
};

export type SocioeconomiaMetric = {
  font: {
    sepe: typeof FONT_SEPE & {
      /** Els fitxers que s'han llegit, un per any. */
      fitxers: string[];
      /** El darrer mes publicat: la «data de l'última actualització» que demana l'avís legal. */
      actualitzat: string;
      consultat: string;
    };
    idescat: { api: string; llicencia: typeof LLICENCIA_IDESCAT; consultat: string };
  };
  /** `null` si el SEPE no publica el municipi. */
  atur: AturMunicipi | null;
  /** Catalunya sencera, per comparar el canvi des del 2023. */
  catalunya: AturCatalunya | null;
  taxa: TaxaAproximada | null;
  indicadors: IndicadorSocio[];
  context: { decideixLAjuntament: false; nota: string };
  nota: string;
};

/** Les dades de la taxa d'un mes, si hi ha atur publicat (no `<5`) i afiliats. */
export function taxaDelMes(
  perMes: ReadonlyMap<string, FilaAtur> | undefined,
  mes: string | null,
  afiliats: number | null,
): Omit<TaxaAproximada, "comparacio"> | null {
  if (!mes || afiliats === null) return null;
  const atur = perMes?.get(mes)?.total ?? null;
  const taxa = taxaAproximada(atur, afiliats);
  if (atur === null || taxa === null) return null;
  return { mes, atur, afiliats, taxa, aproximada: true, amuntEsMillor: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// La cau dels CSV
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Si cal tornar a baixar el fitxer d'un any. Un any és **tancat** si la
 * còpia es va baixar a partir de l'1 de febrer de l'any següent —el SEPE
 * publica el desembre a principis de gener— i llavors no es toca mai més.
 * L'any obert es refresca si la còpia té més de tres dies.
 */
export function calBaixar(any: number, copia: Date | null, ara: Date): boolean {
  if (copia === null) return true;
  if (copia.getTime() >= Date.UTC(any + 1, 1, 1)) return false;
  return ara.getTime() - copia.getTime() > VIDA_ANY_OBERT_MS;
}

export async function fitxerDeLAny(
  any: number,
  baixa: (url: string) => Promise<Uint8Array>,
  dir: string,
  ara: Date,
): Promise<{ bytes: Uint8Array; baixat: boolean; copiaVella?: string }> {
  const ruta = `${dir.replace(/\/$/, "")}/${nomFitxerSepe(any)}`;
  const copia = await stat(ruta).then((s) => (s.size > 0 ? s.mtime : null)).catch(() => null);
  if (!calBaixar(any, copia, ara)) return { bytes: new Uint8Array(await readFile(ruta)), baixat: false };
  await mkdir(dir, { recursive: true });
  let bytes: Uint8Array;
  try {
    bytes = await baixa(urlSepe(any));
  } catch (error) {
    // Si el SEPE no respon i hi ha una còpia, encara que sigui d'abans-d'ahir,
    // val més que no res: es fa servir i qui crida ho diu com a incidència.
    if (copia === null) throw error;
    const motiu = error instanceof Error ? error.message : String(error);
    return { bytes: new Uint8Array(await readFile(ruta)), baixat: false, copiaVella: motiu };
  }
  await writeFile(`${ruta}.part`, bytes);
  await rename(`${ruta}.part`, ruta);
  return { bytes, baixat: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// La feina
// ─────────────────────────────────────────────────────────────────────────────

export type OpcionsJ44 = {
  /** Qui baixa cada CSV; només per a les proves, que no han de tocar la xarxa. */
  baixa?: (url: string) => Promise<Uint8Array>;
  /** Qui fa la crida massiva a l'EMEX i en torna la resposta crua. */
  emex?: (url: string) => Promise<unknown>;
  /** On són o on es desen els CSV. */
  dir?: string;
  /** Avui, per decidir què és any obert. */
  ara?: Date;
};

/** Els enllaços de J18 que fan falta aquí: els de les cinc taules dels indicadors. */
function enllacosSocio(dades: unknown): Map<string, EnllacMunicipi> {
  const enllacos = (dades as { enllacos?: EnllacMunicipi[] } | null)?.enllacos;
  const taules = new Set<string>(Object.values(INDICADORS_EMEX).map((d) => d.taula));
  const out = new Map<string, EnllacMunicipi>();
  if (!Array.isArray(enllacos)) return out;
  for (const e of enllacos) if (e && taules.has(e.taula) && typeof e.href === "string") out.set(e.taula, e);
  return out;
}

/**
 * Els CSV del SEPE del 2019 ençà, una crida a l'EMEX, els enllaços de J18, i
 * la mètrica `socioeconomia` de cada municipi amb alguna dada. És idempotent
 * i **esborra** la mètrica dels municipis que ja no en tenen cap.
 */
export async function j44Socioeconomia(db: Db, options: OpcionsJ44 = {}): Promise<void> {
  const tots = await db
    .select({
      id: municipalities.id,
      name: municipalities.name,
      ine5: municipalities.ine5,
      idescat6: municipalities.idescat6,
      population: municipalities.population,
    })
    .from(municipalities);

  await withRun(db, "J44 socioeconomia: atur registrat i context socioeconòmic", async (run) => {
    const ara = options.ara ?? new Date();
    const consultat = ara.toISOString().slice(0, 10);
    const baixa = options.baixa ?? ((url: string) => fetchBytes(url));
    const dir = options.dir ?? DIR_CAU;

    // ── 1. Els CSV del SEPE, any per any, de la cau o de la xarxa ───────────
    const perMunicipi = new Map<string, Map<string, FilaAtur>>();
    const fitxers: string[] = [];
    const anys: number[] = [];
    let baixats = 0;
    for (let any = PRIMER_ANY; any <= ara.getUTCFullYear(); any += 1) {
      let fitxer: Awaited<ReturnType<typeof fitxerDeLAny>>;
      try {
        fitxer = await fitxerDeLAny(any, baixa, dir, ara);
      } catch (error) {
        // El gener, el fitxer de l'any nou encara no existeix: és normal.
        const motiu = error instanceof Error ? error.message : String(error);
        const nou = any === ara.getUTCFullYear();
        await run.issue({ kind: "socioeconomia: CSV del SEPE no baixat", severity: nou ? "baixa" : "alta", entity: nomFitxerSepe(any), detail: { url: urlSepe(any), motiu } });
        run.say(`${any}: no s'ha pogut baixar el CSV del SEPE (${motiu}); s'ignora`);
        continue;
      }
      if (fitxer.copiaVella) {
        await run.issue({ kind: "socioeconomia: SEPE no respon, es fa servir la còpia", severity: "mitjana", entity: nomFitxerSepe(any), detail: { motiu: fitxer.copiaVella } });
      }
      if (fitxer.baixat) {
        baixats += 1;
        await sleep(PAUSA_MS);
      }
      const { files, estranyes } = parseAturSepe(decodificaLatin1(fitxer.bytes));
      run.rowsIn += files.length;
      if (estranyes > 0) run.say(`${any}: ${estranyes} línies que no s'entenen, ignorades`);
      for (const fila of files) {
        let seves = perMunicipi.get(fila.ine5);
        if (!seves) perMunicipi.set(fila.ine5, (seves = new Map()));
        seves.set(fila.mes, fila);
      }
      fitxers.push(urlSepe(any));
      anys.push(any);
    }
    let ultimMes = "";
    for (const seves of perMunicipi.values()) for (const mes of seves.keys()) if (mes > ultimMes) ultimMes = mes;
    if (ultimMes === "") throw new Error("cap CSV del SEPE amb files catalanes: no es toca res");
    // Les mitjanes només dels anys sencers que ja s'han acabat.
    const anysTancats = anys.filter((a) => `${a}-12` <= ultimMes);
    run.say(`SEPE: ${fitxers.length} fitxers (${baixats} baixats) · ${perMunicipi.size} municipis · darrer mes ${ultimMes}`);

    // ── 2. L'EMEX, i plantar-se si la resposta no és la que esperem ─────────
    const url = urlEmexMassiu(Object.values(INDICADORS_EMEX).map((d) => d.id));
    const brut = await (options.emex ?? ((u: string) => fetchJson<unknown>(u, { timeoutMs: 120_000 })))(url);
    const emex = parseEmexMassiu(brut);
    const periodes = periodesEmex(brut);
    const problemes = comprovaIndicadors(emex, periodes);
    if (problemes.length > 0) {
      throw new Error(`la resposta massiva de l'EMEX no és la que s'esperava: ${problemes.join("; ")}. No es toca res`);
    }
    run.rowsIn += emex.municipis.length * emex.indicadors.length;

    // ── 3. Els enllaços que J18 ja té, de cent en cent ───────────────────────
    // Com a J34: demanar les 947 files de cop feia caure el PGlite («memory
    // access out of bounds»). De cent en cent, la resposta cap sempre.
    const enllacPer = new Map<number, Map<string, EnllacMunicipi>>();
    for (const tanda of perTandes(tots.map((m) => m.id), 100)) {
      const files = await db
        .select({ municipalityId: municipalityMetrics.municipalityId, data: municipalityMetrics.data })
        .from(municipalityMetrics)
        .where(and(eq(municipalityMetrics.kind, "poblacioEnllacos"), inArray(municipalityMetrics.municipalityId, tanda)));
      for (const fila of files) enllacPer.set(fila.municipalityId, enllacosSocio(fila.data));
    }

    // ── 4. La mètrica de cada municipi, sense comparació encara ─────────────
    const afiliats = emex.indicadors.find((i) => i.id === INDICADORS_EMEX.afiliats.id)!;
    const mesAfiliats = periodes.get(INDICADORS_EMEX.afiliats.id)?.mes ?? null;
    const aturPer = new Map<number, AturMunicipi>();
    for (const m of tots) {
      const seves = m.ine5 ? perMunicipi.get(m.ine5) : undefined;
      const atur = seves ? aturDelMunicipi(seves, ultimMes, anysTancats) : null;
      if (atur) aturPer.set(m.id, atur);
    }
    const catalunya = aturCatalunya(aturPer.values(), ultimMes);

    const candidats: { municipi: (typeof tots)[number]; dades: SocioeconomiaMetric }[] = [];
    for (const m of tots) {
      const atur = aturPer.get(m.id) ?? null;
      const indicadors = m.idescat6
        ? indicadorsDelMunicipi(emex, periodes, m.idescat6, enllacPer.get(m.id) ?? new Map())
        : [];
      if (!atur) {
        await run.issue({ kind: "socioeconomia: municipi sense atur al SEPE", severity: "mitjana", municipalityId: m.id, entity: m.name, detail: { ine5: m.ine5 } });
      }
      if (indicadors.length === 0) {
        await run.issue({
          kind: "socioeconomia: municipi sense cap indicador a l'EMEX",
          severity: m.idescat6 === PALMEROLA ? "baixa" : "mitjana",
          municipalityId: m.id,
          entity: m.name,
          detail: { idescat6: m.idescat6 },
        });
      }
      if (!atur && indicadors.length === 0) continue;
      const taxa = taxaDelMes(
        m.ine5 ? perMunicipi.get(m.ine5) : undefined,
        mesAfiliats,
        m.idescat6 ? (afiliats.valors.get(m.idescat6) ?? null) : null,
      );
      candidats.push({
        municipi: m,
        dades: {
          font: {
            sepe: { ...FONT_SEPE, fitxers, actualitzat: ultimMes, consultat },
            idescat: { api: url, llicencia: LLICENCIA_IDESCAT, consultat },
          },
          atur,
          catalunya,
          taxa: taxa ? { ...taxa, comparacio: null } : null,
          indicadors,
          context: { decideixLAjuntament: false, nota: NOTA_COMPETENCIES },
          nota: NOTA_ATUR,
        },
      });
    }

    // ── 5. La taxa aproximada, amb els de la seva mida ───────────────────────
    const grups = buildPeerGroups(tots);
    const taxes = new Map<number, number>();
    for (const { municipi, dades } of candidats) if (dades.taxa) taxes.set(municipi.id, dades.taxa.taxa);
    const comparacions = comparaDinsDelGrup(taxes, grups);
    for (const c of candidats) if (c.dades.taxa) c.dades.taxa.comparacio = comparacions.get(c.municipi.id) ?? null;

    // ── 6. Desar, i esborrar qui ja no té dada ───────────────────────────────
    for (const { municipi, dades } of candidats) {
      await db
        .insert(municipalityMetrics)
        .values({ municipalityId: municipi.id, kind: KIND, data: dades })
        .onConflictDoUpdate({
          target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
          set: { data: dades, computedAt: new Date() },
        });
      run.rowsOut += 1;
    }
    const idsDesats = candidats.map((c) => c.municipi.id);
    await db.delete(municipalityMetrics).where(
      idsDesats.length > 0
        ? and(eq(municipalityMetrics.kind, KIND), notInArray(municipalityMetrics.municipalityId, idsDesats))
        : eq(municipalityMetrics.kind, KIND),
    );

    const senseEnllac = candidats.filter((c) => c.dades.indicadors.some((i) => i.enllac === null)).length;
    run.say(
      `${run.rowsOut} municipis · ${aturPer.size} amb atur · ${taxes.size} amb taxa aproximada (${mesAfiliats ?? "?"}) · ` +
      `${senseEnllac} amb algun indicador sense enllaç de J18 · Catalunya ${ultimMes}: ${catalunya.ara} ` +
      `(${catalunya.respecteMandat?.percent ?? "?"} % des del ${MES_INICI_MANDAT})`,
    );
    return {
      municipis: run.rowsOut,
      ultimMes,
      ambAtur: aturPer.size,
      ambTaxa: taxes.size,
      fitxers: fitxers.length,
      baixats,
      senseEnllac,
    };
  });
}
