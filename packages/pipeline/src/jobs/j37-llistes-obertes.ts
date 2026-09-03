import { execFile } from "node:child_process";
import { mkdir, rename, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { and, eq, notInArray } from "drizzle-orm";
import { municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { sleep } from "../lib/http";
import { nomLlegible, normalizePersonName } from "../lib/text";
import { withRun } from "../lib/run";
import { fetchBytes } from "./j35-alcaldes-ministeri";

/**
 * J37 — el vot nominal a les llistes obertes: qui va rebre quants vots, i qui
 * va sortir elegit, a cada municipal des del 1979 als municipis on es vota
 * persones i no llistes.
 *
 * ─── EL SISTEMA, EN DUES LÍNIES ─────────────────────────────────────────────
 *
 * Als municipis de fins a 250 habitants l'article 184 de la LOREG fa que
 * cada elector escrigui **noms**, no una llista: fins a quatre on hi ha cinc
 * regidories (de 101 a 250 habitants) i fins a dos on n'hi ha tres (fins a
 * 100, des de la reforma del 2011; abans, els de menys de 100 anaven a
 * consell obert). Surten elegides les persones més votades, vinguin de la
 * candidatura que vinguin. Als municipis en **consell obert** s'elegeix
 * directament només l'alcaldia, i el Ministeri ho publica al mateix fitxer
 * amb una sola regidoria a elegir (Gisclareny el 2019: un nom, vint vots).
 *
 * ─── LA FONT, I PER QUÈ AQUESTA ─────────────────────────────────────────────
 *
 * **L'àrea de descàrregues del Ministeri de l'Interior** (infoelectoral):
 * per cada municipal hi ha un zip `04AAMM_MUNI.zip` amb els fitxers de text
 * d'amplada fixa del disseny de registre oficial, en ISO-8859-1, i tres són
 * els que fan falta:
 *
 *   · **`12`** — «Datos de candidatos de municipios menores de 250
 *     habitantes»: una fila per persona candidata amb els vots que ha rebut
 *     i si ha sortit elegida. És l'única font pública amb el vot per persona
 *     de tots els municipis i de totes les municipals des del 1979.
 *   · **`11`** — «Datos comunes de municipios menores de 250 habitantes»:
 *     el cens, els vots en blanc i nuls, i quantes regidories s'elegien.
 *   · **`03`** — les candidatures: del codi a les sigles i al nom sencer.
 *
 * El disseny de registre s'ha **comprovat amb dades reals el 3 de setembre
 * del 2026** —el web del Ministeri no responia (temps d'espera esgotat des
 * de dues xarxes), i els fitxers s'han llegit del mirall íntegre que en manté
 * el projecte lliure `JaimeObregon/infoelectoral`—: Sant Jaume de Frontanyà
 * el 2019, tres regidories i 26 electors, hi surt amb sis persones, dotze
 * vots per Nil i Manel Anselmo (elegits), sis per Lluïsa Vilalta (elegida),
 * cinc per Anna Rosa Sanromà i quatre per Jordi Codina, i Roc Carrion amb
 * zero. Casa amb el ple que publica la Generalitat i amb els vots de cada
 * candidatura (12, 5 i 4) del seu dataset. Al 2019 hi ha 186 municipis
 * catalans al fitxer, i 170 al 1979.
 *
 * ─── EL QUE S'HA MIRAT I S'HA DESCARTAT, I PER QUÈ ──────────────────────────
 *
 *   · **Els datasets de la Generalitat** («Processos electorals - Vots»,
 *     `ntc4-rnwr`, i «Persones candidates», `xnfg-weec`): porten totes les
 *     municipals des del 1979, però el vot és **per candidatura** també als
 *     municipis de llistes obertes, i la columna `candidat_posicio` és buida
 *     a totes les files (comprovat el 3 de setembre del 2026: 0 de 3.564
 *     files municipals del 2023 en porten). Diuen qui va sortir elegit
 *     (`electe`), no amb quants vots.
 *   · **L'API del portal de resultats** (resultats.dadeselectorals.gencat.cat,
 *     `/webelec/api`): cada fila de vot té un camp `candidat`, sempre `null`,
 *     i no hi ha cap ruta per persona (`/candidats/electes` torna buit al
 *     2023 i suma regidors per candidatura als anys anteriors).
 *   · **Les dades obertes de la Diputació de Barcelona**: només la
 *     demarcació de Barcelona, i les llistes sense vots.
 *
 * ─── LA LLICÈNCIA ───────────────────────────────────────────────────────────
 *
 * Avís legal del Ministeri de l'Interior: reutilització segons la Llei
 * 37/2007 amb citació de la font. És la mateixa base que J35 amb el Ministeri
 * de Política Territorial. Els fitxers no porten DNI ni data de naixement
 * (les columnes hi són, buides), i aquí el nom es publica tal com el publica
 * el Ministeri, passat per `nomLlegible()`.
 *
 * ─── COM VA ─────────────────────────────────────────────────────────────────
 *
 * Els zips es desen a `packages/db/.data/infoelectoral/` (o al directori de
 * `QUIVOTO_INFOELECTORAL_DIR`) i **no es tornen a baixar** si ja hi són: són
 * dotze fitxers de 1979 a 2023 que no canvien mai. Si el Ministeri no respon,
 * es pot baixar el zip a mà des de l'àrea de descàrregues i deixar-lo allà
 * amb el nom `04AAMM_MUNI.zip`; el job el troba. Els zips es llegeixen amb
 * `python3` i `zipfile`, com J35 llegeix els XLSX amb `openpyxl`: Node no
 * descomprimeix zip i una dependència nova per dotze fitxers no val la pena.
 *
 * Es desa **una fitxa per municipi que hagi votat en llista oberta alguna
 * vegada**, a `municipality_metrics` amb `kind = "llistesObertes"`; els que
 * no hi surten a cap elecció no en tenen. Va a mà, després de J1:
 * `pnpm ingest j37`. No és a `ORDER`.
 */

export const KIND = "llistesObertes";

export const BASE_DESCARREGUES = "https://infoelectoral.interior.gob.es/estaticos/docxl/apliextr/";
export const PAGINA = "https://infoelectoral.interior.gob.es/es/elecciones-celebradas/area-de-descargas/";

export const FONT = {
  nom: "Datos de candidatos de municipios menores de 250 habitantes (fitxers 11 i 12) · Área de descargas",
  organisme: "Ministeri de l'Interior",
  url: PAGINA,
  llicencia: "Avís legal del Ministeri de l'Interior: reutilització segons la Llei 37/2007, citant la font",
} as const;

/** On es desen els zips. `.data/` és ignorat pel repositori, com les actes de J12. */
export const DIR_CAU =
  process.env.QUIVOTO_INFOELECTORAL_DIR ?? new URL("../../../db/.data/infoelectoral/", import.meta.url).pathname;

/** Les dotze municipals, amb el mes que dona nom al zip i la data del diumenge. */
export const MUNICIPALS: readonly { any: number; mes: string; data: string }[] = [
  { any: 1979, mes: "04", data: "1979-04-03" },
  { any: 1983, mes: "05", data: "1983-05-08" },
  { any: 1987, mes: "06", data: "1987-06-10" },
  { any: 1991, mes: "05", data: "1991-05-26" },
  { any: 1995, mes: "05", data: "1995-05-28" },
  { any: 1999, mes: "06", data: "1999-06-13" },
  { any: 2003, mes: "05", data: "2003-05-25" },
  { any: 2007, mes: "05", data: "2007-05-27" },
  { any: 2011, mes: "05", data: "2011-05-22" },
  { any: 2015, mes: "05", data: "2015-05-24" },
  { any: 2019, mes: "05", data: "2019-05-26" },
  { any: 2023, mes: "05", data: "2023-05-28" },
];

/** Barcelona, Girona, Lleida i Tarragona: les dues primeres xifres del codi INE. */
export const PROVINCIES_CATALANES: ReadonlySet<string> = new Set(["08", "17", "25", "43"]);

/** Pausa entre descàrregues: dotze fitxers, cap pressa. */
const PAUSA_MS = 1_000;

export type Municipal = (typeof MUNICIPALS)[number];

/** `04202305_MUNI.zip`, tal com el Ministeri l'anomena. */
export const nomZip = (e: Municipal): string => `04${e.any}${e.mes}_MUNI.zip`;
export const urlZip = (e: Municipal): string => `${BASE_DESCARREGUES}${nomZip(e)}`;
/** `12042305.DAT`: tipus de fitxer, tipus d'elecció (04), any de dues xifres i mes. */
export const nomFitxer = (tipus: "03" | "11" | "12", e: Municipal): string =>
  `${tipus}04${String(e.any).slice(2)}${e.mes}.DAT`;

// ─────────────────────────────────────────────────────────────────────────────
// El que es desa
// ─────────────────────────────────────────────────────────────────────────────

export type CandidatLlistaOberta = {
  /** «Lluïsa Vilalta Pérez», passat per `nomLlegible()`; el Ministeri ho escriu en majúscules. */
  nom: string;
  /** `normalizePersonName(nom)`: la clau amb què tot el projecte aparella persones. */
  clau: string;
  /** H · D, del camp de sexe del Ministeri (M · F); `null` si no hi és. */
  sexe: "H" | "D" | null;
  candidatura: { codi: string; sigles: string; nom: string };
  vots: number;
  elegit: boolean;
  /** Al 1979 el Ministeri marca els suplents al mateix nom: «Mitjanes Llordes (Suplente)». */
  suplent: boolean;
};

export type EleccioLlistaOberta = {
  any: number;
  data: string;
  /** Regidories que s'elegien; en consell obert, 1 (només l'alcaldia). */
  regidors: number;
  /** Quants noms podia escriure cada elector (LOREG 184): 4 amb cinc regidories, 2 amb tres, 1 en consell obert. */
  nomsPerPapereta: number | null;
  /** Cens de l'escrutini, vots en blanc, nuls i a candidatures, del fitxer 11; `null` si el municipi no hi és. */
  electors: number | null;
  votants: number | null;
  blancs: number | null;
  nuls: number | null;
  /** De més a menys vots; a vots iguals, primer qui va sortir elegit. */
  candidats: CandidatLlistaOberta[];
};

export type LlistesObertesMetric = {
  font: {
    nom: string;
    organisme: string;
    url: string;
    llicencia: string;
    /** Els zips que s'han llegit, per si algú vol comprovar-ho. */
    fitxers: string[];
    /** Data de consulta en ISO: sense data, cap dada no entra a la fitxa. */
    consultat: string;
  };
  ine5: string;
  /** Cronològiques. */
  eleccions: EleccioLlistaOberta[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Els tres fitxers, camp a camp
// ─────────────────────────────────────────────────────────────────────────────

/** Una fila del fitxer 12, tal com és, amb el municipi per creuar-la. */
export type FilaCandidat12 = {
  ine5: string;
  candidatura: string;
  votsCandidatura: number;
  esconsCandidatura: number;
  nom: string;
  cognom1: string;
  cognom2: string;
  sexe: string;
  vots: number;
  elegit: boolean;
};

/** Una fila del fitxer 11: el que el municipi va posar a les urnes. */
export type FilaMunicipi11 = {
  ine5: string;
  poblacio: number;
  electors: number;
  blancs: number;
  nuls: number;
  aCandidatures: number;
  regidors: number;
};

const camp = (linia: string, de: number, a: number): string => linia.slice(de - 1, a).trim();
const enter = (linia: string, de: number, a: number): number => {
  const text = camp(linia, de, a);
  return /^\d+$/.test(text) ? Number(text) : 0;
};

/**
 * El fitxer 12, línia a línia. Posicions del disseny de registre, comprovades
 * amb el 2019 i el 1979: tipus d'elecció (1-2), any (3-6), mes (7-8), volta
 * (9), província (10-11), municipi (12-14), candidatura (15-20), vots de la
 * candidatura (21-23), regidories de la candidatura (24-25), nom (26-50),
 * primer cognom (51-75), segon cognom (76-100), sexe (101), naixement
 * (102-109, buit), DNI (110-119, buit), vots de la persona (120-122) i
 * elegit (123). Una línia que no fa 123 caràcters o no comença amb l'any que
 * toca es compta com a estranya i no s'ingereix: val més un buit que un nom
 * amb els vots d'un altre.
 */
export function parseCandidats12(text: string, any: number, provincies: ReadonlySet<string> = PROVINCIES_CATALANES): { files: FilaCandidat12[]; estranyes: number; altres: number } {
  const files: FilaCandidat12[] = [];
  let estranyes = 0;
  let altres = 0;
  for (const linia of text.split(/\r?\n/)) {
    if (linia.trim() === "") continue;
    if (linia.length !== 123 || camp(linia, 3, 6) !== String(any)) {
      estranyes += 1;
      continue;
    }
    const provincia = camp(linia, 10, 11);
    if (!provincies.has(provincia)) {
      altres += 1;
      continue;
    }
    files.push({
      ine5: `${provincia}${camp(linia, 12, 14)}`,
      candidatura: camp(linia, 15, 20),
      votsCandidatura: enter(linia, 21, 23),
      esconsCandidatura: enter(linia, 24, 25),
      nom: camp(linia, 26, 50),
      cognom1: camp(linia, 51, 75),
      cognom2: camp(linia, 76, 100),
      sexe: camp(linia, 101, 101),
      vots: enter(linia, 120, 122),
      elegit: camp(linia, 123, 123).toUpperCase() === "S",
    });
  }
  return { files, estranyes, altres };
}

/**
 * El fitxer 11 (160 caràcters): comunitat (10-11), província (12-13),
 * municipi (14-16), nom (17-116), partit judicial, diputació i comarca
 * (117-125), població de dret (126-128), meses (129-130), cens INE
 * (131-133), cens de l'escrutini (134-136), CERA (137-139), votants CERA
 * (140-142), dos avanços de participació (143-148), vots en blanc (149-151),
 * nuls (152-154), a candidatures (155-157), regidories (158-159) i si són
 * dades oficials (160). Els comptadors són de tres xifres perquè cap
 * d'aquests municipis passa de 250 habitants.
 */
export function parseMunicipis11(text: string, any: number, provincies: ReadonlySet<string> = PROVINCIES_CATALANES): Map<string, FilaMunicipi11> {
  const perIne5 = new Map<string, FilaMunicipi11>();
  for (const linia of text.split(/\r?\n/)) {
    if (linia.length !== 160 || camp(linia, 3, 6) !== String(any)) continue;
    const provincia = camp(linia, 12, 13);
    if (!provincies.has(provincia)) continue;
    const ine5 = `${provincia}${camp(linia, 14, 16)}`;
    perIne5.set(ine5, {
      ine5,
      poblacio: enter(linia, 126, 128),
      electors: enter(linia, 134, 136),
      blancs: enter(linia, 149, 151),
      nuls: enter(linia, 152, 154),
      aCandidatures: enter(linia, 155, 157),
      regidors: enter(linia, 158, 159),
    });
  }
  return perIne5;
}

/** El fitxer 03 (232 caràcters): codi (9-14), sigles (15-64) i denominació (65-214). */
export function parseCandidatures03(text: string): Map<string, { sigles: string; nom: string }> {
  const perCodi = new Map<string, { sigles: string; nom: string }>();
  for (const linia of text.split(/\r?\n/)) {
    if (linia.length < 214) continue;
    perCodi.set(camp(linia, 9, 14), { sigles: camp(linia, 15, 64), nom: camp(linia, 65, 214) });
  }
  return perCodi;
}

// ─────────────────────────────────────────────────────────────────────────────
// De les files a l'elecció d'un municipi
// ─────────────────────────────────────────────────────────────────────────────

/** «Mitjanes Llordes (Suplente)» → el cognom net i la marca de suplent a part. */
export function separaSuplent(cognom: string): { cognom: string; suplent: boolean } {
  const m = /^(.*?)\s*\(\s*suplente\s*\)\s*$/i.exec(cognom);
  return m ? { cognom: m[1]!.trim(), suplent: true } : { cognom: cognom.trim(), suplent: false };
}

/** Quants noms podia escriure cada elector, segons les regidories a elegir (LOREG 184; consell obert, 1). */
export function nomsPerPapereta(regidors: number): number | null {
  if (regidors === 5) return 4;
  if (regidors === 3) return 2;
  if (regidors === 1) return 1;
  return null;
}

/**
 * L'elecció d'un municipi a partir de les seves files del fitxer 12, del que
 * diu el fitxer 11 (si hi és) i de les candidatures del 03. Les regidories
 * són les del fitxer 11; si el municipi no hi surt, es compten els elegits,
 * que és el que la llei diu que han de ser. Els vots del 11 fan els votants
 * (blancs + nuls + a candidatures): el fitxer no porta la xifra directa.
 */
export function construeixEleccio(
  e: Municipal,
  files: readonly FilaCandidat12[],
  municipi: FilaMunicipi11 | undefined,
  candidatures: ReadonlyMap<string, { sigles: string; nom: string }>,
): EleccioLlistaOberta {
  const candidats: CandidatLlistaOberta[] = files.map((f) => {
    const { cognom: cognom2, suplent } = separaSuplent(f.cognom2);
    const nomSencer = [f.nom, f.cognom1, cognom2].filter((t) => t !== "").join(" ");
    const cand = candidatures.get(f.candidatura);
    return {
      nom: nomLlegible(nomSencer),
      clau: normalizePersonName(nomSencer),
      sexe: f.sexe === "M" ? "H" : f.sexe === "F" ? "D" : null,
      candidatura: { codi: f.candidatura, sigles: cand?.sigles ?? "", nom: cand?.nom ?? "" },
      vots: f.vots,
      elegit: f.elegit,
      suplent,
    };
  });
  candidats.sort((a, b) => b.vots - a.vots || Number(b.elegit) - Number(a.elegit) || a.nom.localeCompare(b.nom, "ca"));
  const elegits = candidats.filter((c) => c.elegit).length;
  const regidors = municipi && municipi.regidors > 0 ? municipi.regidors : elegits;
  return {
    any: e.any,
    data: e.data,
    regidors,
    nomsPerPapereta: nomsPerPapereta(regidors),
    electors: municipi?.electors ?? null,
    votants: municipi ? municipi.blancs + municipi.nuls + municipi.aCandidatures : null,
    blancs: municipi?.blancs ?? null,
    nuls: municipi?.nuls ?? null,
    candidats,
  };
}

/** La fitxa d'un municipi, amb les eleccions en ordre cronològic. */
export function fitxaLlistesObertes(
  ine5: string,
  eleccions: readonly EleccioLlistaOberta[],
  fitxers: readonly string[],
  consultat: string,
): LlistesObertesMetric {
  return {
    font: { ...FONT, fitxers: [...fitxers], consultat },
    ine5,
    eleccions: [...eleccions].sort((a, b) => a.any - b.any),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// El zip, amb Python
// ─────────────────────────────────────────────────────────────────────────────

const execFileAsync = promisify(execFile);

/**
 * Treu del zip els membres que casen amb l'expressió i els escriu com a JSON
 * `{ nom: text }`, descodificats d'ISO-8859-1. Els noms dels membres es
 * comparen en majúscules: el Ministeri els escriu `.DAT` però no promet res.
 */
const PROGRAMA_PYTHON = `
import json, re, sys, zipfile
patro = re.compile(sys.argv[2], re.I)
out = {}
with zipfile.ZipFile(sys.argv[1]) as z:
    for nom in z.namelist():
        base = nom.rsplit("/", 1)[-1]
        if patro.match(base):
            out[base.upper()] = z.read(nom).decode("iso-8859-1")
json.dump(out, sys.stdout, ensure_ascii=False)
`;

/** Els fitxers 03, 11 i 12 d'un zip, pel nom en majúscules. Necessita `python3`. */
export async function membresDelZip(rutaZip: string, patro = String.raw`^(03|11|12)04\d{4}\.dat$`): Promise<Map<string, string>> {
  try {
    const { stdout } = await execFileAsync("python3", ["-c", PROGRAMA_PYTHON, rutaZip, patro], {
      maxBuffer: 256 * 1024 * 1024,
      encoding: "utf8",
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });
    return new Map(Object.entries(JSON.parse(stdout) as Record<string, string>));
  } catch (error) {
    const text = String((error as { stderr?: string })?.stderr ?? error);
    if (/ENOENT/.test(text)) throw new Error("cal `python3` al PATH per llegir els zips del Ministeri");
    if (/BadZipFile/.test(text)) throw new Error(`${rutaZip} no és un zip: el Ministeri deu haver tornat una pàgina d'error. Esborra'l i torna-hi`);
    throw error;
  }
}

/**
 * El zip d'una municipal, del disc si ja hi és i de la xarxa si no. Es desa
 * abans de llegir-lo: si la descàrrega es talla a mig camí no queda cap
 * fitxer, i si el que arriba no és un zip `membresDelZip()` ho diu.
 */
export async function zipDeLaMunicipal(e: Municipal, baixa: (url: string) => Promise<Uint8Array>, dir = DIR_CAU): Promise<{ ruta: string; baixat: boolean }> {
  const ruta = join(dir, nomZip(e));
  const jaHiEs = await stat(ruta).then((s) => s.size > 0).catch(() => false);
  if (jaHiEs) return { ruta, baixat: false };
  await mkdir(dir, { recursive: true });
  const bytes = await baixa(urlZip(e));
  await writeFile(`${ruta}.part`, bytes);
  await rename(`${ruta}.part`, ruta);
  return { ruta, baixat: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// El job
// ─────────────────────────────────────────────────────────────────────────────

export type OpcionsJ37 = {
  /** Qui baixa cada zip; només per a les proves, que no han de tocar la xarxa. */
  baixa?: (url: string) => Promise<Uint8Array>;
  /** On són o on es desen els zips. */
  dir?: string;
  /** Quines municipals, per provar-ho amb poques. */
  municipals?: readonly Municipal[];
};

export async function j37LlistesObertes(db: Db, options: OpcionsJ37 = {}): Promise<void> {
  await withRun(db, "j37-llistes-obertes", async (run) => {
    const consultat = new Date().toISOString().slice(0, 10);
    const baixa = options.baixa ?? ((url: string) => fetchBytes(url));
    const dir = options.dir ?? DIR_CAU;
    const municipals = options.municipals ?? MUNICIPALS;

    // 1. Els municipis, pel codi INE de cinc xifres: mai pel nom.
    const munis = await db.select({ id: municipalities.id, ine5: municipalities.ine5, name: municipalities.name }).from(municipalities);
    const perIne5 = new Map(munis.map((m) => [m.ine5, m]));

    // 2. Cada municipal: el zip (del disc o de la xarxa), els tres fitxers, i
    //    les files catalanes agrupades per municipi.
    const eleccionsPer = new Map<string, EleccioLlistaOberta[]>();
    const senseMunicipi = new Map<string, number>();
    const fitxers: string[] = [];
    let baixats = 0;
    for (const [i, e] of municipals.entries()) {
      // Si el Ministeri no respon (li passa: el 3 de setembre del 2026 no
      // servia res), la municipal que falta és una incidència i les altres
      // segueixen: onze municipals al disc valen més que cap. La que falta
      // es baixa al proper cop, o a mà (vegeu el capçal).
      let zip: { ruta: string; baixat: boolean };
      try {
        zip = await zipDeLaMunicipal(e, baixa, dir);
      } catch (error) {
        const motiu = error instanceof Error ? error.message : String(error);
        await run.issue({ kind: "llistes-obertes-zip-no-baixat", severity: "alta", entity: nomZip(e), detail: { url: urlZip(e), motiu } });
        run.say(`${e.any}: no s'ha pogut baixar ${nomZip(e)} (${motiu}); s'ignora`);
        continue;
      }
      const { ruta, baixat } = zip;
      if (baixat) {
        baixats += 1;
        if (i < municipals.length - 1) await sleep(PAUSA_MS);
      }
      fitxers.push(urlZip(e));
      const membres = await membresDelZip(ruta);
      const text12 = membres.get(nomFitxer("12", e));
      if (text12 === undefined) {
        await run.issue({ kind: "llistes-obertes-sense-fitxer-12", severity: "alta", entity: nomZip(e), detail: { membres: [...membres.keys()] } });
        run.say(`${e.any}: el zip no porta ${nomFitxer("12", e)}; s'ignora`);
        continue;
      }
      const lectura = parseCandidats12(text12, e.any);
      const municipis11 = parseMunicipis11(membres.get(nomFitxer("11", e)) ?? "", e.any);
      const candidatures = parseCandidatures03(membres.get(nomFitxer("03", e)) ?? "");
      run.rowsIn += lectura.files.length;
      if (lectura.estranyes > 0) {
        await run.issue({ kind: "llistes-obertes-linies-estranyes", severity: "baixa", entity: nomFitxer("12", e), detail: { linies: lectura.estranyes } });
      }
      const perMunicipi = new Map<string, FilaCandidat12[]>();
      for (const fila of lectura.files) {
        const llista = perMunicipi.get(fila.ine5) ?? [];
        llista.push(fila);
        perMunicipi.set(fila.ine5, llista);
      }
      let senseCandidatura = 0;
      for (const [ine5, files] of perMunicipi) {
        if (!perIne5.has(ine5)) {
          // Un codi català que no és cap dels 947: municipis agregats o
          // segregats després d'aquella elecció. Queda dit, no s'aparella per nom.
          senseMunicipi.set(ine5, (senseMunicipi.get(ine5) ?? 0) + 1);
          continue;
        }
        const eleccio = construeixEleccio(e, files, municipis11.get(ine5), candidatures);
        senseCandidatura += eleccio.candidats.filter((c) => c.candidatura.sigles === "").length;
        const llista = eleccionsPer.get(ine5) ?? [];
        llista.push(eleccio);
        eleccionsPer.set(ine5, llista);
      }
      run.say(`${e.any}: ${lectura.files.length} persones a ${perMunicipi.size} municipis catalans · ${municipis11.size} al fitxer 11${
        senseCandidatura > 0 ? ` · ${senseCandidatura} sense candidatura al fitxer 03` : ""
      }${lectura.estranyes > 0 ? ` · ${lectura.estranyes} línies estranyes` : ""}`);
    }
    for (const [ine5, eleccions] of senseMunicipi) {
      await run.issue({ kind: "llistes-obertes-sense-municipi", severity: "baixa", entity: ine5, detail: { eleccions } });
    }

    // 3. Una fitxa per municipi amb alguna elecció en llista oberta, i fora
    //    la dels que ja no en tenen cap: una foto vella no s'ha de quedar.
    let persones = 0;
    const idsDesats: number[] = [];
    for (const [ine5, eleccions] of eleccionsPer) {
      const muni = perIne5.get(ine5)!;
      const data = fitxaLlistesObertes(ine5, eleccions, fitxers, consultat);
      persones += eleccions.reduce((n, el) => n + el.candidats.length, 0);
      await db
        .insert(municipalityMetrics)
        .values({ municipalityId: muni.id, kind: KIND, data })
        .onConflictDoUpdate({
          target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
          set: { data, computedAt: new Date() },
        });
      idsDesats.push(muni.id);
      run.rowsOut += 1;
    }
    await db.delete(municipalityMetrics).where(
      idsDesats.length > 0
        ? and(eq(municipalityMetrics.kind, KIND), notInArray(municipalityMetrics.municipalityId, idsDesats))
        : eq(municipalityMetrics.kind, KIND),
    );
    run.say(`${run.rowsOut} municipis amb alguna elecció en llista oberta · ${persones} candidatures de persona · ${baixats} zips baixats, ${municipals.length - baixats} del disc`);
    return { font: FONT.nom, consultat, municipals: municipals.length, baixats, municipis: run.rowsOut, persones, senseMunicipi: senseMunicipi.size };
  });
}
