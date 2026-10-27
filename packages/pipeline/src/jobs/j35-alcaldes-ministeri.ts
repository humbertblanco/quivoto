import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { USER_AGENT, sleep } from "../lib/http";
import { normalize } from "../lib/text";
import { withRun } from "../lib/run";
import { fetchText } from "./j23-riquesa";
import { parseCsv } from "./j22-retribucions";

/**
 * J35 — els alcaldes de cada mandat segons el Ministeri, amb la data de baixa.
 *
 * ─── LA FONT, I PER QUÈ AQUESTA ─────────────────────────────────────────────
 *
 * El **Sistema d'Informació Local (SIL)** del Ministeri de Política Territorial
 * publica, a la pàgina «Alcaldes y concejales», un full de càlcul per mandat:
 * «Alcaldes mandato 1979-1983» … «Alcaldes mandato 2019-2023», onze fitxers
 * XLSX d'uns 600 KB amb tots els alcaldes d'Espanya. Cada fila és una persona
 * en un municipi i un mandat: comunitat, província, municipi, **codi INE**,
 * nom, llista, **data de presa de possessió** i **data de baixa**.
 *
 * El que hi ve a buscar aquest projecte és l'última columna. L'historial de la
 * Generalitat diu qui va prendre possessió i quan, però **mai quan va plegar**;
 * Wikidata (J31) ho diu de les ciutats grans i de la gent coneguda i prou. El
 * Ministeri ho té de tothom: a Badalona, al 2019-2023, en Pastor «baixa» el
 * 2 de maig del 2020, Albiol pren possessió el 12 de maig i baixa el 8 de
 * novembre del 2021, i Guijarro hi és des d'aquell dia. Tampoc no diu **per
 * què** algú va deixar l'alcaldia, i aquí no s'inventa: només la data.
 *
 * Comprovat baixant els onze fitxers el 3 de setembre del 2026: al 2019-2023
 * hi ha 1.031 files catalanes de 950 codis INE (75 municipis amb més d'una).
 *
 * ─── EL QUE TÉ DE TORT, I COM ES LLEGEIX ────────────────────────────────────
 *
 * Els onze fitxers els va fer gent diferent en èpoques diferents, i cadascun
 * té la seva manera:
 *
 *   · **El codi INE** ve de cinc xifres («08015») o de sis amb el dígit de
 *     control («080155»), i a vegades com a nombre, que perd el zero del
 *     davant («80155»). `ine5DelCodi()` en treu sempre les cinc de
 *     `municipalities.ine5`, que és pel que es creua: **mai pel nom**.
 *   · **El nom** va «COGNOMS, NOM» fins al 1999-2003 i «NOM COGNOMS» després,
 *     amb algun malnom entre parèntesis («ALEJANDRO PASTOR LÓPEZ (ÀLEX)»).
 *     `nomEndret()` gira la coma; els parèntesis els desfà `normalizePersonName()`
 *     quan la fusió aparella persones.
 *   · **Les dates** són cel·les de data quasi sempre, però al 2019-2023 la de
 *     possessió és text «15/06/2019». `dataIso()` llegeix les dues formes.
 *   · **La llista** és una sigla a l'espanyola («PSOE», «CIU», «IND») fins al
 *     2011-2015 i, des del 2015, quasi sempre «C. ELECTORAL» o «OTROS», que
 *     no diuen res: la fusió no en fa partit.
 *   · **El full del 2019-2023 duu per títol «Alcaldes 2015-2019»**: el mandat
 *     es pren sempre del nom del fitxer, mai del full.
 *
 * Els XLSX es llegeixen amb **`python3` i `openpyxl`**, que hi són al sistema,
 * i no amb cap dependència nova de Node: un XLSX és un zip d'XML, i llegir-lo
 * a mà amb el que porta Node (que no descomprimeix zip) no val la pena per
 * onze fitxers un cop l'any. `csvDelXlsx()` els converteix a CSV per un
 * procés fill, com `adapters/actes.ts` fa amb `pdftotext`, i la resta és
 * text: `parseFullMinisteri()` és pura i es prova amb un CSV fals.
 *
 * Aquest job **només descarrega i desa**: una fitxa per municipi a
 * `municipality_metrics` amb `kind = "alcaldiesMinisteri"`. La fusió amb
 * l'historial és de `derive/alcaldies.ts` (`fusionaAmbMinisteri`), que crida
 * `derive/mayor-changes.ts`: així el que diu el Ministeri queda desat tal com
 * és i el criteri de fusió es pot canviar sense tornar a baixar res.
 *
 * Va a mà, després de J5: `pnpm ingest j35`. No és a `ORDER`.
 *
 * Font: https://mptmd.gob.es/portal/politica-territorial/local/sistema_de_informacion_local_-sil-/alcaldes_y_concejales
 * Llicència: avís legal del Ministeri (reutilització segons la Llei 37/2007).
 */

export const KIND = "alcaldiesMinisteri";

export const PAGINA = "https://mptmd.gob.es/portal/politica-territorial/local/sistema_de_informacion_local_-sil-/alcaldes_y_concejales";

const FONT = "Alcaldes por mandato · Sistema de Información Local (SIL)";
const ORGANISME = "Ministeri de Política Territorial i Memòria Democràtica";
const LLICENCIA = "Avís legal del Ministeri: reutilització segons la Llei 37/2007";

/** Pausa entre descàrregues: onze fitxers, cap pressa. */
const PAUSA_MS = 500;

// ─────────────────────────────────────────────────────────────────────────────
// El que es desa
// ─────────────────────────────────────────────────────────────────────────────

/** Una alcaldia tal com la dona el Ministeri, ja normalitzada. */
export type AlcaldiaMinisteri = {
  /** «2019-2023», del nom del fitxer. */
  mandat: string;
  /** «NOM COGNOMS», tal com l'escriu el Ministeri però amb la coma girada. */
  nom: string;
  /** La columna LISTA tal qual («PSOE», «C. ELECTORAL»); `null` si és buida. */
  llista: string | null;
  /** FECHA POSESIÓN en `AAAA-MM-DD`, o `null`. */
  possessio: string | null;
  /** FECHA BAJA en `AAAA-MM-DD`; `null` si va acabar el mandat o no consta. */
  baixa: string | null;
};

/** Una fila catalana d'un fitxer, amb el municipi per creuar-la. */
export type FilaMinisteri = AlcaldiaMinisteri & { ine5: string; municipi: string };

export type FitxerMandat = { mandat: string; url: string };

export type FitxaAlcaldiesMinisteri = {
  font: string;
  organisme: string;
  /** La pàgina on són els fitxers, per citar-la. */
  url: string;
  /** Els fitxers que s'han llegit, per si algú vol comprovar-ho. */
  fitxers: FitxerMandat[];
  llicencia: string;
  /** Data de consulta en ISO: sense data, cap dada no entra a la fitxa. */
  consultat: string;
  ine5: string;
  /** Cronològiques: per mandat i, dins del mandat, per data de possessió. */
  alcaldies: AlcaldiaMinisteri[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Funcions pures
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Els fitxers «Alcaldes_Mandato_AAAA_AAAA.xlsx» que enllaça la pàgina, un per
 * mandat i en ordre. No s'endevinen: si el Ministeri en canvia el nom o en
 * publica un de nou (2023-2027), això el troba o ho diu.
 */
export function descobreixFitxers(html: string, base: string = PAGINA): FitxerMandat[] {
  const perMandat = new Map<string, string>();
  const patro = /href="([^"]*Alcaldes_Mandato_(\d{4})_(\d{4})\.xlsx?)"/gi;
  for (let m = patro.exec(html); m !== null; m = patro.exec(html)) {
    const mandat = `${m[2]}-${m[3]}`;
    if (!perMandat.has(mandat)) perMandat.set(mandat, new URL(m[1]!.replace(/&amp;/g, "&"), base).toString());
  }
  return [...perMandat.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mandat, url]) => ({ mandat, url }));
}

/**
 * Les cinc xifres del codi INE, vingui com vingui: «08015», «080155» (amb el
 * dígit de control), o com a nombre sense el zero del davant («8001» per
 * Abrera, «80155» per Badalona). Un codi de cinc xifres que comença per més
 * de 52 no és cap província: és un de sis a qui li falta el zero.
 */
export function ine5DelCodi(valor: string): string | null {
  const digits = valor.trim().replace(/\.0$/, "");
  if (!/^\d{4,6}$/.test(digits)) return null;
  let codi = digits;
  if (codi.length === 4) codi = `0${codi}`;
  else if (codi.length === 5 && Number(codi.slice(0, 2)) > 52) codi = `0${codi}`;
  return codi.slice(0, 5);
}

/**
 * «LOPEZ LOZANO, MANUEL» → «MANUEL LOPEZ LOZANO»; sense coma, tal qual.
 *
 * La «Ð» es torna «Ñ» de passada: és la «Ñ» llegida amb una taula de
 * caràcters que no tocava, la mateixa errada que l'historial de la
 * Generalitat té a «MONTAÐA» i «PEÐA» (vegeu `reparaNomAlcaldia()` a
 * `derive/alcaldies.ts`). Cap nom català ni castellà no porta «ð».
 */
export function nomEndret(nom: string): string {
  const net = nom.replace(/Ð/g, "Ñ").replace(/ð/g, "ñ").replace(/\s+/g, " ").trim();
  const coma = net.indexOf(",");
  if (coma < 0) return net;
  const cognoms = net.slice(0, coma).trim();
  const pila = net.slice(coma + 1).replace(/,/g, " ").replace(/\s+/g, " ").trim();
  return pila === "" ? cognoms : `${pila} ${cognoms}`;
}

/** «2019-06-15», «2019-06-15 00:00:00» o «15/06/2019» → «2019-06-15»; la resta, `null`. */
export function dataIso(valor: string): string | null {
  const v = valor.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (!m) {
    const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
    if (!dmy) return null;
    m = [v, dmy[3]!, dmy[2]!.padStart(2, "0"), dmy[1]!.padStart(2, "0")] as unknown as RegExpExecArray;
  }
  const [, any, mes, dia] = m;
  if (Number(mes) < 1 || Number(mes) > 12 || Number(dia) < 1 || Number(dia) > 31) return null;
  return `${any}-${mes}-${dia}`;
}

/** Les capçaleres que es busquen, normalitzades. */
const COLUMNES = {
  ccaa: "comunidad autonoma",
  municipi: "municipio",
  codi: "codigo ine",
  nom: "nombre",
  llista: "lista",
  possessio: "fecha posesion",
  baixa: "fecha baja",
} as const;

export type LecturaFull = {
  files: FilaMinisteri[];
  /** Files d'altres comunitats, que són la immensa majoria. */
  altresComunitats: number;
  /** Codis INE catalans que no s'han sabut llegir. */
  senseCodi: string[];
  /** Dates que no s'han sabut llegir, per dir-ho. */
  datesEstranyes: string[];
};

/**
 * Les files catalanes d'un fitxer, ja convertit a CSV. La capçalera es busca
 * per text i no per posició: és a la fila 8 i comença a la columna D, però
 * ningú no ha promès que hi continuï. Si no hi ha cap fila amb «CÓDIGO INE»,
 * el fitxer ha canviat d'esquema i val més aturar-se que llegir-lo malament.
 */
export function parseFullMinisteri(csv: string, mandat: string): LecturaFull {
  const files = parseCsv(csv);
  let capcalera: Map<string, number> | null = null;
  const resultat: LecturaFull = { files: [], altresComunitats: 0, senseCodi: [], datesEstranyes: [] };
  for (const fila of files) {
    if (capcalera === null) {
      const posicions = new Map(fila.map((c, i) => [normalize(c), i] as const));
      if (posicions.has(COLUMNES.codi)) {
        capcalera = posicions;
        for (const clau of Object.values(COLUMNES)) {
          if (!capcalera.has(clau)) throw new Error(`al fitxer del ${mandat} hi falta la columna «${clau}»`);
        }
      }
      continue;
    }
    const cel = (clau: string): string => fila[capcalera!.get(clau)!] ?? "";
    if (fila.every((c) => c.trim() === "")) continue;
    if (!normalize(cel(COLUMNES.ccaa)).startsWith("catalu")) {
      resultat.altresComunitats += 1;
      continue;
    }
    const ine5 = ine5DelCodi(cel(COLUMNES.codi));
    if (ine5 === null) {
      resultat.senseCodi.push(`${cel(COLUMNES.codi)} (${cel(COLUMNES.municipi).trim()})`);
      continue;
    }
    const data = (clau: string): string | null => {
      const text = cel(clau).trim();
      if (text === "") return null;
      const iso = dataIso(text);
      if (iso === null) resultat.datesEstranyes.push(`${text} (${cel(COLUMNES.municipi).trim()}, ${mandat})`);
      return iso;
    };
    const llista = cel(COLUMNES.llista).replace(/\s+/g, " ").trim();
    resultat.files.push({
      mandat,
      ine5,
      municipi: cel(COLUMNES.municipi).replace(/\s+/g, " ").trim(),
      nom: nomEndret(cel(COLUMNES.nom)),
      llista: llista === "" ? null : llista,
      possessio: data(COLUMNES.possessio),
      baixa: data(COLUMNES.baixa),
    });
  }
  if (capcalera === null) throw new Error(`al fitxer del ${mandat} no s'hi ha trobat cap capçalera amb «CÓDIGO INE»: ha canviat d'esquema?`);
  return resultat;
}

/** Per mandat i, dins del mandat, per data de possessió; les sense data, primer. */
export function ordenaAlcaldies(alcaldies: readonly AlcaldiaMinisteri[]): AlcaldiaMinisteri[] {
  return [...alcaldies].sort((a, b) => a.mandat.localeCompare(b.mandat) || (a.possessio ?? "").localeCompare(b.possessio ?? "") || a.nom.localeCompare(b.nom));
}

/**
 * La fitxa d'un municipi. Accepta les files senceres del fitxer i se'n queda
 * només l'alcaldia: el codi i el nom del municipi ja són a la fitxa, i
 * repetir-los 947 vegades per onze mandats no aporta res.
 */
export function fitxaAlcaldiesMinisteri(
  ine5: string,
  alcaldies: readonly (AlcaldiaMinisteri | FilaMinisteri)[],
  fitxers: readonly FitxerMandat[],
  consultat: string,
): FitxaAlcaldiesMinisteri {
  return {
    font: FONT,
    organisme: ORGANISME,
    url: PAGINA,
    fitxers: [...fitxers],
    llicencia: LLICENCIA,
    consultat,
    ine5,
    alcaldies: ordenaAlcaldies(alcaldies.map(({ mandat, nom, llista, possessio, baixa }) => ({ mandat, nom, llista, possessio, baixa }))),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// XLSX → CSV, amb Python
// ─────────────────────────────────────────────────────────────────────────────

const execFileAsync = promisify(execFile);

/**
 * El programa que llegeix el primer full i l'escriu com a CSV, cel·la per
 * cel·la: les dates en ISO, el buit com a buit i la resta com a text sense
 * espais als extrems (la columna de província porta centenars d'espais de
 * farciment). `read_only` perquè no carregui 9.000 files en memòria d'objectes.
 */
const PROGRAMA_PYTHON = `
import csv, datetime, sys
import openpyxl
wb = openpyxl.load_workbook(sys.argv[1], read_only=True, data_only=True)
ws = wb.worksheets[0]
w = csv.writer(sys.stdout, lineterminator="\\n")
for row in ws.iter_rows(values_only=True):
    out = []
    for c in row:
        if c is None:
            out.append("")
        elif isinstance(c, (datetime.datetime, datetime.date)):
            out.append(c.strftime("%Y-%m-%d"))
        else:
            out.append(str(c).strip())
    w.writerow(out)
`;

/**
 * El CSV del primer full d'un XLSX. Necessita `python3` amb `openpyxl`; si no
 * hi són, l'error ho diu amb aquestes paraules, que és millor que un
 * «ENOENT» sense context.
 */
export async function csvDelXlsx(rutaXlsx: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync("python3", ["-c", PROGRAMA_PYTHON, rutaXlsx], {
      maxBuffer: 64 * 1024 * 1024,
      encoding: "utf8",
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });
    return stdout;
  } catch (error) {
    const text = String((error as { stderr?: string })?.stderr ?? error);
    if (/No module named 'openpyxl'/.test(text)) throw new Error("cal `openpyxl` per llegir els XLSX del Ministeri: `python3 -m pip install openpyxl`");
    if (/ENOENT/.test(text)) throw new Error("cal `python3` al PATH per llegir els XLSX del Ministeri");
    throw error;
  }
}

/** Baixa un fitxer sencer a memòria, amb els mateixos reintents que `fetchText`. */
export async function fetchBytes(url: string, options: { retries?: number; timeoutMs?: number } = {}): Promise<Uint8Array> {
  const { retries = 3, timeoutMs = 180_000 } = options;
  let ultimError: unknown;
  for (let intent = 0; intent <= retries; intent += 1) {
    const controlador = new AbortController();
    const rellotge = setTimeout(() => controlador.abort(), timeoutMs);
    try {
      const resposta = await fetch(url, { headers: { accept: "*/*", "user-agent": USER_AGENT }, signal: controlador.signal });
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status} a ${url}`);
      return new Uint8Array(await resposta.arrayBuffer());
    } catch (error) {
      ultimError = error;
      if (intent === retries) break;
      await sleep(1_000 * 2 ** intent);
    } finally {
      clearTimeout(rellotge);
    }
  }
  throw ultimError;
}

// ─────────────────────────────────────────────────────────────────────────────
// El job
// ─────────────────────────────────────────────────────────────────────────────

export type OpcionsJ35 = {
  /** Qui llegeix la pàgina; només per a les proves, que no han de tocar la xarxa. */
  pagina?: () => Promise<string>;
  /** Qui baixa cada XLSX; només per a les proves. */
  baixa?: (url: string) => Promise<Uint8Array>;
  /** Quants fitxers com a màxim, per provar-ho amb pocs. */
  limit?: number;
};

export async function j35AlcaldesMinisteri(db: Db, options: OpcionsJ35 = {}): Promise<void> {
  await withRun(db, "j35-alcaldes-ministeri", async (run) => {
    const consultat = new Date().toISOString().slice(0, 10);
    const llegeixPagina = options.pagina ?? (() => fetchText(PAGINA));
    const baixa = options.baixa ?? ((url: string) => fetchBytes(url));

    // 1. Quins fitxers hi ha, llegint la pàgina: no s'endevina cap URL.
    const fitxers = descobreixFitxers(await llegeixPagina()).slice(0, options.limit ?? Infinity);
    if (fitxers.length === 0) throw new Error("no s'ha trobat cap «Alcaldes_Mandato_AAAA_AAAA.xlsx» a la pàgina del Ministeri: ha canviat?");
    run.say(`${fitxers.length} fitxers a la pàgina del Ministeri: del ${fitxers[0]!.mandat} al ${fitxers[fitxers.length - 1]!.mandat}`);

    // 2. Els municipis, pel codi INE de cinc xifres.
    const munis = await db.select({ id: municipalities.id, ine5: municipalities.ine5 }).from(municipalities);
    const perIne5 = new Map(munis.map((m) => [m.ine5, m.id]));

    // 3. Cada fitxer: baixar-lo, passar-lo a CSV i quedar-se amb Catalunya.
    const perMunicipi = new Map<number, FilaMinisteri[]>();
    const senseMunicipi = new Map<string, number>();
    const dir = await mkdtemp(join(tmpdir(), "quivoto-j35-"));
    try {
      for (const [i, fitxer] of fitxers.entries()) {
        if (i > 0) await sleep(PAUSA_MS);
        const ruta = join(dir, `${fitxer.mandat}.xlsx`);
        await writeFile(ruta, await baixa(fitxer.url));
        const lectura = parseFullMinisteri(await csvDelXlsx(ruta), fitxer.mandat);
        run.rowsIn += lectura.files.length;
        let ambBaixa = 0;
        for (const fila of lectura.files) {
          if (fila.baixa !== null) ambBaixa += 1;
          const id = perIne5.get(fila.ine5);
          if (id === undefined) {
            senseMunicipi.set(`${fila.ine5} ${fila.municipi}`, (senseMunicipi.get(`${fila.ine5} ${fila.municipi}`) ?? 0) + 1);
            continue;
          }
          const llista = perMunicipi.get(id) ?? [];
          llista.push(fila);
          perMunicipi.set(id, llista);
        }
        run.say(`${fitxer.mandat}: ${lectura.files.length} files catalanes · ${ambBaixa} amb data de baixa${
          lectura.senseCodi.length > 0 ? ` · ${lectura.senseCodi.length} sense codi INE llegible` : ""
        }${lectura.datesEstranyes.length > 0 ? ` · ${lectura.datesEstranyes.length} dates il·legibles` : ""}`);
        for (const codi of lectura.senseCodi) {
          await run.issue({ kind: "alcaldes-ministeri-codi-illegible", severity: "baixa", entity: codi, detail: { mandat: fitxer.mandat } });
        }
        for (const data of lectura.datesEstranyes) {
          await run.issue({ kind: "alcaldes-ministeri-data-illegible", severity: "baixa", entity: data, detail: { mandat: fitxer.mandat } });
        }
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }

    // Un codi català que no és cap dels 947: municipis agregats o segregats
    // després del mandat, o un codi mal escrit. Queda com a incidència, no
    // s'aparella per nom.
    for (const [codi, files] of senseMunicipi) {
      await run.issue({ kind: "alcaldes-ministeri-sense-municipi", severity: "baixa", entity: codi, detail: { files } });
    }
    if (senseMunicipi.size > 0) run.say(`${senseMunicipi.size} codis INE catalans que no són cap dels nostres municipis`);

    // 4. Una fitxa per municipi, també per als que no tenen cap fila: que
    //    quedi constància que s'ha mirat i quan.
    let total = 0;
    let ambBaixa = 0;
    for (const muni of munis) {
      const alcaldies = perMunicipi.get(muni.id) ?? [];
      total += alcaldies.length;
      ambBaixa += alcaldies.filter((a) => a.baixa !== null).length;
      const data = fitxaAlcaldiesMinisteri(muni.ine5, alcaldies, fitxers, consultat);
      await db
        .insert(municipalityMetrics)
        .values({ municipalityId: muni.id, kind: KIND, data })
        .onConflictDoUpdate({
          target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
          set: { data, computedAt: new Date() },
        });
      run.rowsOut += 1;
    }
    run.say(`${total} alcaldies a ${perMunicipi.size} municipis · ${ambBaixa} amb data de baixa`);
    return { font: FONT, consultat, fitxers: fitxers.length, municipis: perMunicipi.size, alcaldies: total, ambBaixa, senseMunicipi: senseMunicipi.size };
  });
}
