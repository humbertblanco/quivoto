import { and, asc, eq, or } from "drizzle-orm";
import { councillorMandates, municipalities, municipalityMetrics, people, type Db } from "@quivoto/db";
import { INE_BARCELONA, descarregaText } from "../adapters/barcelona";
import { descarregaXlsx, llegeixLlibre, type Cella, type Full } from "../adapters/aca";
import { medianOf } from "../derive/peers";
import { normalize, normalizePersonName, slugifyMunicipality, uninvertArticle } from "../lib/text";
import { indexUnic } from "./j14-electes-cost";
import { withRun, type Run } from "../lib/run";

/**
 * J22 — els sous que sí que existeixen.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PER QUÈ HI HA AQUEST FITXER SI J14 DIU QUE NO S'INGEREIX CAP SOU
 * ─────────────────────────────────────────────────────────────────────────────
 * J14 no diu «cap import»: diu **cap import que no el publiqui qui el paga**. El
 * camp de retribució que un ajuntament escriu a seu-e no val perquè és text
 * lliure i només recull la part que paga ell (l'alcaldessa de Rubí hi surt amb
 * 17.027,7 € quan en cobra ~107.968). Aquestes dues fonts són l'altra cosa:
 *
 *   1. **L'Ajuntament de Barcelona** publica, al seu portal de dades obertes i
 *      amb llicència CC BY 4.0, la remuneració bruta anual de cadascun dels
 *      seus càrrecs electes, comissionats i gerents. És qui paga qui ho publica,
 *      amb nom i cognoms. Comprovat el 30-08-2026: 858 files, 743 amb
 *      remuneració > 0, i «Albert Batlle Bastardas, Regidor, 102.119,64 €».
 *   2. **El Ministeri** publica a l'espai ISPA el total percebut per l'alcaldia
 *      i per cada regidoria de tots els ajuntaments d'Espanya. No hi ha noms a
 *      les files de regidor, i per això no s'atribueixen a ningú: serveixen per
 *      dir «al teu ajuntament, N regidories cobren i el repartiment és aquest»,
 *      que és una dada de municipi i cobreix 866 dels 947.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LES QUATRE REGLES QUE AQUEST FITXER NO POT TRENCAR
 * ─────────────────────────────────────────────────────────────────────────────
 *   · **Mai se sumen imports de fonts diferents.** Cada euro es desa dins del
 *     bloc de qui el publica, amb la font, la llicència, l'any i la data
 *     d'extracció al costat. El que cobra una persona de l'Ajuntament i del
 *     Ministeri alhora no ho ha publicat mai ningú, i sumar-ho seria inventar
 *     una xifra. Ni tan sols es desa un camp que ho convidi.
 *   · **Les files de regidor de l'ISPA no porten nom i no s'atribueixen a
 *     ningú.** Ni tan sols per descart: en un ple de nou, saber que dos cobren
 *     no diu quins dos.
 *   · **«Sin dedicación» amb import no és un sou**, són assistències i
 *     indemnitzacions. Es desa amb la mena marcada. Comprovat: 149 de les 207
 *     alcaldies catalanes sense dedicació hi tenen un import, de 180 € a
 *     l'Alcosser fins a desenes de milers.
 *   · **Un nom que lliga amb més d'una persona no lliga amb ningú.** Per això
 *     l'aparellament passa per `indexUnic`, que descarta els repetits a les
 *     dues bandes.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * COBERTURA MESURADA (descàrrega del 30-08-2026)
 * ─────────────────────────────────────────────────────────────────────────────
 *   ISPA alcaldes    · 6.934 files, 866 catalanes (283 BCN, 201 GI, 213 LL,
 *                      169 TA). 219 exclusives, 440 parcials, 207 sense
 *                      dedicació. 861 dels 866 noms lliguen sols amb els 947;
 *                      els 5 que no, per les raons de `RENOMS` i `clauMunicipi`.
 *   ISPA regidors    · 51.320 files, 7.588 catalanes: 612 exclusives, 1.559
 *                      parcials i 5.417 sense dedicació (4.768 amb import, que
 *                      són assistències).
 *   Barcelona        · 858 files i 417 persones. 41 tenen un càrrec de regidor
 *                      o d'alcaldia —els 41 del ple— i 37 amb import > 0. Els
 *                      quatre zeros no són un error: són els regidors que
 *                      cobren d'una altra administració, i el zero de
 *                      l'Ajuntament és exactament el que ell declara pagar.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DUES LLICÈNCIES DIFERENTS, I ES NOTA
 * ─────────────────────────────────────────────────────────────────────────────
 * Barcelona és CC BY 4.0 (verificat al `package_show` del CKAN: `license_id`
 * «CC-BY-4.0»). L'ISPA **no** és CC: s'hi aplica l'avís legal del portal del
 * Ministeri i la Llei 37/2007 de reutilització, que obliga a no desnaturalitzar
 * la informació, a citar la font i a dir la data d'actualització. Per això cada
 * bloc porta la seva llicència a dins i no n'hi ha cap de comuna.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Fonts
// ─────────────────────────────────────────────────────────────────────────────

/** Clau nova a `municipality_metrics`. */
export const KIND = "retribucions";

/**
 * Conjunt «Càrrecs electes, comissionats i gerents» d'Open Data BCN. L'adreça de
 * `/download` respon 302 cap al CSV de debò a `opendata-ajuntament...`, i per
 * això la descàrrega ha de seguir la redirecció.
 */
export const URL_BARCELONA =
  "https://opendata-ajuntament.barcelona.cat/data/dataset/906a207a-a0d0-41f7-bf28-09c23320ea1f" +
  "/resource/77c47da6-9e4f-46de-8c37-d0bff307a725/download";

export const FONT_BARCELONA = {
  nom: "Càrrecs electes, comissionats i gerents del govern municipal",
  organisme: "Ajuntament de Barcelona",
  portal: "https://opendata-ajuntament.barcelona.cat/data/ca/dataset/carrecs-electes-comissionats-i-gerents",
  url: URL_BARCELONA,
  llicencia: "CC BY 4.0",
  base: "Remuneració bruta anual del càrrec, tal com la publica qui la paga.",
} as const;

/** Espai ISPA del Ministeri: un full per any amb el total percebut de cada electe. */
export const URL_ISPA_ALCALDES =
  "https://digital.gob.es/content/dam/portal-mtdfp/funcion-publica/dgfp/ispa/ispa2025" +
  "/retrib_2024/retribuciones_alcaldes.xlsx";

export const URL_ISPA_REGIDORS =
  "https://digital.gob.es/content/dam/portal-mtdfp/funcion-publica/dgfp/ispa/ispa2025" +
  "/retrib_2024/retribuciones_concejales.xlsx";

export const FONT_ISPA = {
  nom: "Inventari de retribucions dels membres de les corporacions locals (ISPA 2025)",
  organisme: "Ministeri per a la Transformació Digital i de la Funció Pública",
  pagina: "https://digital.gob.es/",
  llicencia:
    "Avís legal del portal del Ministeri (reutilització segons la Llei 37/2007). No és Creative Commons.",
  condicions: [
    "no desnaturalitzar el sentit de la informació",
    "citar la font",
    "dir la data de l'última actualització",
  ],
  base: "Total percebut per l'exercici, declarat per cada ajuntament al Ministeri.",
} as const;

/** Nom de la comunitat tal com l'escriu el full del Ministeri. */
const CCAA_CATALUNYA = "cataluna";

// ─────────────────────────────────────────────────────────────────────────────
// Funcions pures: CSV
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lector de CSV amb cometes (RFC 4180). Aquí sí que en cal un de correcte i no
 * el truc d'ancorar pels extrems que fa `adapters/barcelona`: aquest fitxer és
 * CSV vàlid —les descripcions amb comes van entre cometes— i les 30 columnes
 * són sempre les mateixes. Comprovat a les 858 files del 30-08-2026.
 */
export function parseCsv(text: string): string[][] {
  const files: string[][] = [];
  let camp = "";
  let fila: string[] = [];
  let dinsCometes = false;

  // El BOM d'UTF-8 al davant faria que la primera capçalera no lligués mai.
  const net = text.replace(/^﻿/, "");
  for (let i = 0; i < net.length; i += 1) {
    const c = net[i]!;
    if (dinsCometes) {
      if (c !== '"') camp += c;
      else if (net[i + 1] === '"') {
        camp += '"';
        i += 1;
      } else dinsCometes = false;
    } else if (c === '"') dinsCometes = true;
    else if (c === ",") {
      fila.push(camp);
      camp = "";
    } else if (c === "\n") {
      fila.push(camp);
      files.push(fila);
      fila = [];
      camp = "";
    } else if (c !== "\r") camp += c;
  }
  if (camp.length > 0 || fila.length > 0) {
    fila.push(camp);
    files.push(fila);
  }
  return files.filter((f) => f.length > 1 || (f[0] ?? "").length > 0);
}

/** Una fila del CSV de Barcelona, només amb les columnes que fem servir. */
export type FilaBarcelona = {
  nom: string;
  carrec: string;
  partit: string | null;
  /** Text literal de la columna: `""` vol dir que no hi ha res escrit. */
  remuneracio: string;
  observacio: string | null;
  grauOcupacio: string | null;
  plenaDedicacio: boolean;
  dependencia: string | null;
  principal: boolean;
  foto: string | null;
  cv: string | null;
  declaracioActivitats: string | null;
  declaracioBens: string | null;
};

/**
 * El CSV, amb les columnes buscades **pel nom de la capçalera** i no per posició.
 * Són 30 columnes i la font n'hi pot afegir: comptar-les seria desalinear-ho tot
 * el dia que en posin una al mig.
 */
export function parseBarcelona(text: string): FilaBarcelona[] {
  const files = parseCsv(text);
  const capcalera = files[0];
  if (!capcalera) return [];
  const col = new Map(capcalera.map((nom, i) => [normalize(nom), i]));
  const camp = (fila: string[], nom: string): string => {
    const i = col.get(normalize(nom));
    return i === undefined ? "" : (fila[i] ?? "").trim();
  };
  const opcional = (fila: string[], nom: string): string | null => camp(fila, nom) || null;

  const out: FilaBarcelona[] = [];
  for (const fila of files.slice(1)) {
    const nom = [camp(fila, "nom"), camp(fila, "cognom_1"), camp(fila, "cognom_2")]
      .filter((x) => x.length > 0)
      .join(" ");
    if (nom.length === 0) continue;
    out.push({
      nom,
      carrec: camp(fila, "descripcio_carrec_ca"),
      partit: opcional(fila, "partit_politic"),
      remuneracio: camp(fila, "remuneracio"),
      observacio: netejaHtml(camp(fila, "observacio_remuneracio_ca")) || null,
      grauOcupacio: opcional(fila, "grau_ocupacio"),
      plenaDedicacio: /^true$/i.test(camp(fila, "plena_dedicacio")),
      dependencia: opcional(fila, "dependencia_ca"),
      principal: camp(fila, "posicio_principal") === "Sí",
      foto: opcional(fila, "foto"),
      cv: opcional(fila, "cv_ca"),
      declaracioActivitats: opcional(fila, "declaracio_activitats_ca"),
      declaracioBens: opcional(fila, "declaracio_bens_ca"),
    });
  }
  return out;
}

/**
 * L'observació de la remuneració ve amb HTML a dins («…percep les <a href=…>
 * dietes que estableix la normativa</a>…»). Se'n treuen les etiquetes i prou:
 * el text és el que explica per què hi ha un zero, i és massa valuós per
 * llençar-lo, però publicar-hi una àncora de la font seria treure-la de context.
 * 123 de les 858 files en porten.
 */
export function netejaHtml(text: string): string {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Si aquest càrrec és de regidor o d'alcaldia, i no de conseller de districte,
 * gerent, assessor ni vocal. Els districtes són l'entrellat: un «Conseller» de
 * districte no és membre del ple, i el fitxer en té 205.
 *
 * Amb aquesta regla surten exactament 41 persones, que són els 41 escons del
 * plenari de Barcelona. Comprovat el 30-08-2026.
 */
export function esCarrecElecte(carrec: string): boolean {
  return /^(regidor|regidora|alcalde|alcaldessa|tinent d|tinenta d)/.test(normalize(carrec).replace(/'/g, ""));
}

/** Una persona del fitxer de Barcelona, amb tots els seus càrrecs en una sola fitxa. */
export type PersonaBarcelona = {
  nom: string;
  carrecs: string[];
  partit: string | null;
  /** Retribució bruta anual publicada per l'Ajuntament. `null` si no en publica. */
  euros: number | null;
  /** Cert quan les files d'aquesta persona no diuen el mateix import. */
  importAmbigu: boolean;
  observacio: string | null;
  grauOcupacio: string | null;
  plenaDedicacio: boolean;
  electe: boolean;
  foto: string | null;
  cv: string | null;
  declaracioActivitats: string | null;
  declaracioBens: string | null;
};

/**
 * L'import d'una persona a partir de totes les seves files.
 *
 * **Aquesta funció és la que evita el pitjor error possible d'aquest fitxer.**
 * El CSV té una fila per càrrec, no per persona, i repeteix el mateix sou a
 * cada fila: Albert Batlle hi surt dotze vegades amb 102.119,64 €. Sumar les
 * files li atribuiria 1.225.435,68 €, dotze vegades el que cobra. Per això es
 * pren el valor **distint**, mai la suma, i si les files no diuen el mateix no
 * se'n desa cap, que val més no dir res que triar a l'atzar.
 *
 * La fila **buida** no compta com a valor, perquè no dir res no és contradir:
 * és el cas de Ricard Font Hereu, l'única de les 417 persones amb una fila amb
 * import i una altra sense. Amb aquesta regla, cap persona del fitxer del
 * 30-08-2026 es queda sense import per contradicció.
 */
export function importDeclarat(valors: readonly string[]): { euros: number | null; ambigu: boolean } {
  const nets = new Set<number>();
  for (const valor of valors) {
    const text = valor.trim();
    if (text.length === 0) continue;
    const numero = Number(text.replace(/\s/g, ""));
    if (Number.isFinite(numero)) nets.add(Math.round(numero * 100) / 100);
  }
  if (nets.size === 0) return { euros: null, ambigu: false };
  if (nets.size > 1) return { euros: null, ambigu: true };
  return { euros: [...nets][0]!, ambigu: false };
}

/** Agrupa les 858 files en les 417 persones, sense sumar-ne mai els imports. */
export function agrupaPersones(files: readonly FilaBarcelona[]): PersonaBarcelona[] {
  const per = new Map<string, FilaBarcelona[]>();
  for (const fila of files) {
    const clau = normalizePersonName(fila.nom);
    const llista = per.get(clau) ?? [];
    llista.push(fila);
    per.set(clau, llista);
  }

  const out: PersonaBarcelona[] = [];
  for (const grup of per.values()) {
    // La fila «principal» és la que la font marca com a càrrec principal; 352
    // de les 417 persones en tenen exactament una. Les altres 65 no en tenen
    // cap i llavors mana la primera, que és l'ordre en què la font les escriu.
    const principal = grup.find((f) => f.principal) ?? grup[0]!;
    const { euros, ambigu } = importDeclarat(grup.map((f) => f.remuneracio));
    out.push({
      nom: principal.nom,
      carrecs: [...new Set(grup.map((f) => f.carrec).filter((c) => c.length > 0))],
      partit: grup.map((f) => f.partit).find((p) => p !== null) ?? null,
      euros,
      importAmbigu: ambigu,
      observacio: grup.map((f) => f.observacio).find((o) => o !== null) ?? null,
      grauOcupacio: principal.grauOcupacio,
      plenaDedicacio: grup.some((f) => f.plenaDedicacio),
      electe: grup.some((f) => esCarrecElecte(f.carrec)),
      foto: grup.map((f) => f.foto).find((x) => x !== null) ?? null,
      cv: grup.map((f) => f.cv).find((x) => x !== null) ?? null,
      declaracioActivitats: grup.map((f) => f.declaracioActivitats).find((x) => x !== null) ?? null,
      declaracioBens: grup.map((f) => f.declaracioBens).find((x) => x !== null) ?? null,
    });
  }
  return out.sort((a, b) => a.nom.localeCompare(b.nom, "ca"));
}

// ─────────────────────────────────────────────────────────────────────────────
// Funcions pures: els fulls del Ministeri
// ─────────────────────────────────────────────────────────────────────────────

const textCella = (c: Cella | undefined): string => (c === null || c === undefined ? "" : String(c).trim());

/**
 * Quina fila és la capçalera. **No es pot fixar.** El full d'alcaldes la té a la
 * fila 10 i el de regidors a la 9, amb el mateix contingut: comptar-la com a
 * constant fa que un dels dos fitxers perdi la primera fila de dades o llegeixi
 * el títol com si fos un municipi.
 */
export function fileraCapcaleraIspa(files: readonly Cella[][]): number {
  return files.findIndex((fila) => fila.some((c) => /^ayuntamiento$/i.test(textCella(c))));
}

/**
 * L'exercici que hi ha dins del títol del full: «ISPA 2025 (RETRIBUCIONES AÑO
 * 2024)» vol dir que els imports són del **2024**, no del 2025. Publicar-hi el
 * 2025 seria enretardar un any tota la sèrie.
 */
export function anyIspa(files: readonly Cella[][]): number | null {
  for (const fila of files.slice(0, 20)) {
    for (const cella of fila) {
      const match = /a[ñn]o\s+(\d{4})/i.exec(textCella(cella));
      if (match) return Number(match[1]);
    }
  }
  return null;
}

export type FilaIspa = {
  municipi: string;
  provincia: string;
  regim: string;
  euros: number;
};

/**
 * Les files catalanes d'un full de l'ISPA, amb les columnes buscades pel nom.
 * Les de fora de Catalunya es descarten aquí mateix: són 6.068 i 43.732 files
 * que no anirien enlloc.
 */
export function parseIspa(full: Full): FilaIspa[] {
  const capcalera = fileraCapcaleraIspa(full.files);
  if (capcalera < 0) return [];
  const col = new Map<string, number>();
  full.files[capcalera]!.forEach((c, i) => col.set(normalize(textCella(c)), i));
  const iMunicipi = col.get("ayuntamiento");
  const iProvincia = col.get("provincia");
  const iCcaa = col.get("ccaa");
  const iRegim = col.get("regimen dedicacion");
  const iEuros = col.get("total percibido");
  if (iMunicipi === undefined || iCcaa === undefined || iEuros === undefined) return [];

  const out: FilaIspa[] = [];
  for (const fila of full.files.slice(capcalera + 1)) {
    if (normalize(textCella(fila[iCcaa])) !== CCAA_CATALUNYA) continue;
    const municipi = textCella(fila[iMunicipi]);
    if (municipi.length === 0) continue;
    const cru = iEuros === undefined ? null : fila[iEuros];
    // Una cel·la que no és un número no és un zero: un zero vol dir «no cobra»
    // i un forat vol dir «no ho sabem». Aquí la font sempre hi posa número
    // (0 de 8.454 files catalanes fallen), i si un dia deixa de fer-ho la fila
    // s'ha d'apartar en comptes de convertir-se en un zero fals.
    if (typeof cru !== "number" || !Number.isFinite(cru)) continue;
    out.push({
      municipi,
      provincia: iProvincia === undefined ? "" : textCella(fila[iProvincia]),
      regim: iRegim === undefined ? "" : textCella(fila[iRegim]),
      euros: Math.round(cru * 100) / 100,
    });
  }
  return out;
}

/**
 * Municipis que el Ministeri encara escriu amb el nom vell, per província.
 *
 * Són canvis de denominació oficials i comprovats contra el padró d'ens de la
 * Generalitat del 30-08-2026, no arreglaments d'ortografia:
 *
 *   · «Bigues i Riells» passa a «Bigues i Riells del Fai» (2021).
 *   · «Calonge» passa a «Calonge i Sant Antoni» (2020). Aquest **exigeix** la
 *     província: a la de Barcelona hi ha «Calonge de Segarra», que és un altre
 *     municipi i també és al full. Sense el filtre de província, l'import de
 *     l'alcaldia de Calonge (58.000 €) podria anar a parar a un poble de 200
 *     habitants de l'Anoia.
 */
const RENOMS: ReadonlyArray<{ clau: string; provincia: string; desti: string }> = [
  { clau: "bigues-i-riells", provincia: "barcelona", desti: "bigues-i-riells-del-fai" },
  { clau: "calonge", provincia: "girona", desti: "calonge-i-sant-antoni" },
];

/**
 * La clau amb què una fila de l'ISPA busca el seu municipi entre els 947.
 *
 * Tres coses que el full fa i el padró no:
 *
 *   · Escriu l'article invertit i en majúscula («Alamús, Els»). Ho desfà
 *     `uninvertArticle`, **excepte** l'aranès «Es» d'«es Bòrdes», que aquella
 *     funció no cobreix; aquí s'hi afegeix sense tocar `lib/text`, que és d'un
 *     altre encàrrec.
 *   · Desambigua amb la província entre parèntesis quan un nom es repeteix a
 *     Espanya: «la Granada (Barcelona)», «Mieres (Girona)». El parèntesi no
 *     forma part del nom oficial.
 *   · Conserva noms anteriors a un canvi de denominació: vegeu `RENOMS`.
 *
 * Amb això, els 866 municipis catalans dels dos fulls lliguen amb els 947.
 */
export function clauMunicipiIspa(nom: string, provincia: string): string {
  const senseProvincia = nom.replace(/\s*\((?:Barcelona|Girona|Lleida|Tarragona)\)\s*$/i, "").trim();
  const aranes = /^(.*),\s*es\s*\.?$/i.exec(senseProvincia);
  const dret = aranes ? `es ${aranes[1]!.trim()}` : uninvertArticle(senseProvincia);
  const clau = slugifyMunicipality(dret);
  const renom = RENOMS.find((r) => r.clau === clau && r.provincia === normalize(provincia));
  return renom ? renom.desti : clau;
}

/** Què vol dir de debò l'import d'una fila, segons el règim de dedicació. */
export type MenaImport = "sou" | "assistencies" | "cap";

/**
 * «Sin dedicación» amb import **no és un sou**: són assistències a plens i
 * comissions i indemnitzacions per despeses, que es cobren per sessió. Dir-ne
 * sou faria semblar que un regidor de poble cobra 180 € l'any per fer d'edil
 * quan el que ha fet és anar a dos plens. Són 149 de 207 alcaldies i 4.768 de
 * 5.417 regidories catalanes sense dedicació: no és un cas de vora.
 */
export function menaImport(regim: string, euros: number): MenaImport {
  if (euros <= 0) return "cap";
  return /^sin dedicacion/.test(normalize(regim)) ? "assistencies" : "sou";
}

export type ResumRegidoriesIspa = {
  files: number;
  dedicacioExclusiva: number;
  dedicacioParcial: number;
  senseDedicacio: number;
  /** Regidories amb un import que és un sou de debò (dedicació exclusiva o parcial). */
  ambSou: number;
  /** Regidories que només cobren per anar-hi: «Sin dedicación» amb import. */
  nomesAssistencies: number;
  /** Regidories que no cobren res. */
  senseCapImport: number;
  souMinim: number | null;
  souMedia: number | null;
  souMaxim: number | null;
  /**
   * Suma de les files **d'aquest mateix fitxer**, mai barrejada amb cap altra
   * font. Es desa amb aquest nom perquè ningú no la confongui amb «el que costen
   * els regidors»: no hi entren l'alcaldia (que és a l'altre full) ni les
   * quotes de la Seguretat Social que paga l'ajuntament a sobre.
   */
  sumaDelFullDeRegidories: number;
};

/** Com es reparteixen les retribucions de les regidories d'un ajuntament. */
export function resumRegidoriesIspa(files: readonly FilaIspa[]): ResumRegidoriesIspa {
  const menes = files.map((f) => ({ ...f, mena: menaImport(f.regim, f.euros) }));
  const sous = menes.filter((f) => f.mena === "sou").map((f) => f.euros);
  const regimEs = (patro: RegExp): number => files.filter((f) => patro.test(normalize(f.regim))).length;
  const mediana = medianOf(sous);
  return {
    files: files.length,
    dedicacioExclusiva: regimEs(/^exclusiva/),
    dedicacioParcial: regimEs(/^parcial/),
    senseDedicacio: regimEs(/^sin dedicacion/),
    ambSou: sous.length,
    nomesAssistencies: menes.filter((f) => f.mena === "assistencies").length,
    senseCapImport: menes.filter((f) => f.mena === "cap").length,
    souMinim: sous.length > 0 ? Math.min(...sous) : null,
    souMedia: mediana === null ? null : Math.round(mediana * 100) / 100,
    souMaxim: sous.length > 0 ? Math.max(...sous) : null,
    sumaDelFullDeRegidories: Math.round(files.reduce((a, f) => a + f.euros, 0) * 100) / 100,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// La feina
// ─────────────────────────────────────────────────────────────────────────────

export type OpcionsJ22 = {
  /** Salta el bloc de Barcelona; per si el portal de dades obertes cau. */
  senseBarcelona?: boolean;
};

const avui = (): string => new Date().toISOString().slice(0, 10);

async function desa(db: Db, municipalityId: number, data: unknown): Promise<void> {
  await db
    .insert(municipalityMetrics)
    .values({ municipalityId, kind: KIND, data })
    .onConflictDoUpdate({
      target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
      set: { data, computedAt: new Date() },
    });
}

const ADVERTIMENT =
  "Cada import és el que publica qui el paga, dins del bloc de la seva font i amb la seva llicència. " +
  "Aquí no s'hi suma res entre fonts: el que cobra una persona de l'Ajuntament i del Ministeri alhora " +
  "no ho ha publicat mai ningú. Les files de regidoria del Ministeri no porten nom i no s'atribueixen " +
  "a cap persona.";

export async function j22Retribucions(db: Db, options: OpcionsJ22 = {}): Promise<void> {
  await withRun(db, "j22-retribucions", async (run) => {
    const municipis = await db
      .select({
        id: municipalities.id,
        slug: municipalities.slug,
        name: municipalities.name,
        provincia: municipalities.provincia,
        ine5: municipalities.ine5,
      })
      .from(municipalities);
    if (municipis.length === 0) {
      await run.issue({
        kind: "municipis_buits",
        severity: "alta",
        detail: { motiu: "no hi ha municipis a la taula; executa J1 abans que J22" },
      });
      return { municipis: 0 };
    }
    const perSlug = new Map(municipis.map((m) => [m.slug, m]));

    const ministeri = await ispaPerMunicipi(perSlug, run);
    const llegit = options.senseBarcelona ? null : await personesBarcelona(run);
    const barcelona = llegit === null ? null : await lligaAmbElPle(db, llegit);

    /*
     * El context de tot Catalunya es calcula un sol cop i es desa a dins de cada
     * fila. La fitxa d'un municipi no pot fer una segona consulta, i «el teu
     * alcalde cobra X» no vol dir res sense «la mediana catalana és Y».
     */
    const sousAlcaldia = [...ministeri.values()]
      .map((m) => m.alcaldia)
      .filter((a): a is NonNullable<typeof a> => a !== null && a.mena === "sou")
      .map((a) => a.euros);
    const medianaAlcaldia = medianOf(sousAlcaldia);
    const catalunya = {
      municipisAmbDadaDelMinisteri: ministeri.size,
      municipisTotals: municipis.length,
      alcaldiesAmbSou: sousAlcaldia.length,
      alcaldiesNomesAmbAssistencies: [...ministeri.values()].filter((m) => m.alcaldia?.mena === "assistencies").length,
      alcaldiesSenseCapImport: [...ministeri.values()].filter((m) => m.alcaldia?.mena === "cap").length,
      souMedianaAlcaldia: medianaAlcaldia === null ? null : Math.round(medianaAlcaldia * 100) / 100,
    };

    const consultat = avui();
    let desats = 0;
    for (const [slug, dades] of ministeri) {
      const municipi = perSlug.get(slug)!;
      const esBarcelona = municipi.ine5 === INE_BARCELONA.slice(0, 5);
      await desa(db, municipi.id, {
        municipi: { nom: municipi.name, ine5: municipi.ine5 },
        ministeri: {
          any: dades.any,
          alcaldia: dades.alcaldia,
          regidories: dades.regidories,
          nomAlFull: dades.nomAlFull,
          font: { ...FONT_ISPA, urls: [URL_ISPA_ALCALDES, URL_ISPA_REGIDORS], consultat },
          advertiment:
            "Les files de regidoria d'aquest full no porten nom: diuen quantes en cobren i quant, " +
            "mai qui. «Sense dedicació» amb import vol dir assistències i indemnitzacions, no un sou.",
        },
        ajuntament:
          esBarcelona && barcelona
            ? { ...barcelona, font: { ...FONT_BARCELONA, consultat: barcelona.consultat } }
            : null,
        catalunya,
        advertiment: ADVERTIMENT,
      });
      desats += 1;
    }

    /*
     * Barcelona ha de tenir fila encara que el Ministeri no la publiqui: és
     * l'únic municipi amb sou per persona, i perdre'l per un forat de l'altra
     * font seria perdre justament la dada millor que tenim.
     */
    if (barcelona && !ministeri.has(perSlugBarcelona(municipis)?.slug ?? "")) {
      const bcn = perSlugBarcelona(municipis);
      if (bcn) {
        await desa(db, bcn.id, {
          municipi: { nom: bcn.name, ine5: bcn.ine5 },
          ministeri: null,
          ajuntament: { ...barcelona, font: { ...FONT_BARCELONA, consultat: barcelona.consultat } },
          catalunya,
          advertiment: ADVERTIMENT,
        });
        desats += 1;
      }
    }

    run.rowsOut = desats;
    run.say(`${desats} municipis amb alguna retribució publicada per qui la paga`);
    if (barcelona) {
      run.say(
        `Barcelona: ${barcelona.electes.length} càrrecs electes amb import de l'Ajuntament, ` +
          `${barcelona.lligatsAmbElPle} lligats amb un regidor del ple`,
      );
    }
    return {
      municipis: desats,
      ambMinisteri: ministeri.size,
      barcelonaElectes: barcelona?.electes.length ?? 0,
      barcelonaLligats: barcelona?.lligatsAmbElPle ?? 0,
      ...catalunya,
    };
  });
}

const perSlugBarcelona = <T extends { ine5: string }>(municipis: readonly T[]): T | undefined =>
  municipis.find((m) => m.ine5 === INE_BARCELONA.slice(0, 5));

// ── El Ministeri ────────────────────────────────────────────────────────────

type DadesIspa = {
  any: number | null;
  nomAlFull: string;
  alcaldia: { regim: string; euros: number; mena: MenaImport } | null;
  regidories: ResumRegidoriesIspa | null;
};

/**
 * Els dos fulls del Ministeri, ja lligats amb els municipis. Un nom que no lliga
 * amb cap dels 947 es desa com a incidència i **no** s'assigna per aproximació:
 * atribuir el sou d'una alcaldia al poble del costat és pitjor que no publicar-lo.
 */
async function ispaPerMunicipi(
  perSlug: ReadonlyMap<string, { id: number; slug: string }>,
  run: Run,
): Promise<Map<string, DadesIspa>> {
  const out = new Map<string, DadesIspa>();

  const fulls = await Promise.all(
    [URL_ISPA_ALCALDES, URL_ISPA_REGIDORS].map(async (url) => {
      try {
        return { url, full: llegeixLlibre(await descarregaXlsx(url))[0] ?? null };
      } catch (error) {
        await run.issue({
          kind: "ispa_descarrega_error",
          severity: "alta",
          entity: url,
          detail: { error: String(error) },
        });
        return { url, full: null };
      }
    }),
  );
  const [alcaldes, regidors] = fulls;
  if (!alcaldes?.full && !regidors?.full) return out;

  const any = (alcaldes?.full ? anyIspa(alcaldes.full.files) : null) ?? (regidors?.full ? anyIspa(regidors.full.files) : null);

  const perduts = new Set<string>();
  const posa = (slug: string, nomAlFull: string): DadesIspa => {
    const previ = out.get(slug);
    if (previ) return previ;
    const nou: DadesIspa = { any, nomAlFull, alcaldia: null, regidories: null };
    out.set(slug, nou);
    return nou;
  };

  if (alcaldes?.full) {
    const files = parseIspa(alcaldes.full);
    run.rowsIn += files.length;
    for (const fila of files) {
      const slug = clauMunicipiIspa(fila.municipi, fila.provincia);
      if (!perSlug.has(slug)) {
        perduts.add(`${fila.municipi} (${fila.provincia})`);
        continue;
      }
      const dades = posa(slug, fila.municipi);
      // Un municipi hauria de tenir una sola alcaldia al full; si n'hi surt una
      // segona, la primera mana i la segona es diu, perquè triar seria endevinar.
      if (dades.alcaldia !== null) {
        await run.issue({
          kind: "ispa_alcaldia_duplicada",
          severity: "mitjana",
          entity: fila.municipi,
          detail: { primera: dades.alcaldia.euros, segona: fila.euros },
        });
        continue;
      }
      dades.alcaldia = { regim: fila.regim, euros: fila.euros, mena: menaImport(fila.regim, fila.euros) };
    }
    run.say(`Ministeri, alcaldies: ${files.length} files catalanes`);
  }

  if (regidors?.full) {
    const files = parseIspa(regidors.full);
    run.rowsIn += files.length;
    const perMunicipi = new Map<string, FilaIspa[]>();
    for (const fila of files) {
      const slug = clauMunicipiIspa(fila.municipi, fila.provincia);
      if (!perSlug.has(slug)) {
        perduts.add(`${fila.municipi} (${fila.provincia})`);
        continue;
      }
      const llista = perMunicipi.get(slug) ?? [];
      llista.push(fila);
      perMunicipi.set(slug, llista);
    }
    for (const [slug, llista] of perMunicipi) {
      posa(slug, llista[0]!.municipi).regidories = resumRegidoriesIspa(llista);
    }
    run.say(`Ministeri, regidories: ${files.length} files catalanes a ${perMunicipi.size} municipis`);
  }

  for (const nom of perduts) {
    await run.issue({
      kind: "ispa_municipi_no_lligat",
      severity: "mitjana",
      entity: nom,
      detail: { efecte: "les seves retribucions no s'ingereixen: no s'assignen per aproximació" },
    });
  }
  if (perduts.size > 0) run.say(`${perduts.size} noms del Ministeri sense municipi: no s'assignen a ningú`);
  return out;
}

// ── Barcelona ───────────────────────────────────────────────────────────────

type DadesBarcelona = {
  consultat: string;
  /** Els 41 del ple, amb el sou que en publica l'Ajuntament. */
  electes: (PersonaBarcelona & { alPle: boolean })[];
  /**
   * Els comissionats, gerents, consellers de districte i personal eventual, en
   * recompte i no un per un: no són electes i la fitxa no els ha de nomenar,
   * però saber que l'Ajuntament en publica el sou de 376 més sí que informa.
   */
  altresCarrecs: {
    persones: number;
    ambImport: number;
    souMinim: number | null;
    souMedia: number | null;
    souMaxim: number | null;
  };
  lligatsAmbElPle: number;
  senseLligar: string[];
};

/**
 * El fitxer de Barcelona, agrupat per persona i creuat amb els regidors del ple
 * que ja tenim a la base de dades.
 *
 * El creuament fa servir `indexUnic` de J14: un nom normalitzat que aparegui a
 * dues persones no lliga amb ningú. Comprovat el 30-08-2026 contra la
 * composició oficial del ple: dels 41 electes del CSV en lliguen 36, i els 5
 * que no són els que dues fonts oficials escriuen diferent —«Guille» per
 * Guillermo, «Suriñach» contra «Surinyach», «Coronas Martorell» contra «Coronas
 * Carbonell», «Liberto Mariano» contra «Liberto», i una Sara Belbeida que a la
 * composició del ple encara hi consta com a «PENDENT». **No es forcen**: quan
 * dues fonts oficials no coincideixen ni en el cognom, qui s'ha d'equivocar no
 * som nosaltres. L'import s'hi desa igualment, perquè el publica l'Ajuntament
 * amb nom i cognoms; el que no es fa és penjar-lo d'una fitxa de regidor que
 * potser no és la seva.
 */
async function personesBarcelona(run: Run): Promise<DadesBarcelona | null> {
  const consultat = avui();
  let text: string;
  try {
    text = await descarregaText(URL_BARCELONA);
  } catch (error) {
    await run.issue({
      kind: "barcelona_retribucions_error",
      severity: "alta",
      entity: URL_BARCELONA,
      detail: { error: String(error) },
    });
    return null;
  }

  const files = parseBarcelona(text);
  run.rowsIn += files.length;
  const persones = agrupaPersones(files);
  const electes = persones.filter((p) => p.electe);
  if (electes.length === 0) {
    await run.issue({
      kind: "barcelona_retribucions_illegible",
      severity: "alta",
      entity: URL_BARCELONA,
      detail: { files: files.length, persones: persones.length },
    });
    return null;
  }
  for (const persona of persones.filter((p) => p.importAmbigu)) {
    await run.issue({
      kind: "barcelona_import_contradictori",
      severity: "baixa",
      entity: persona.nom,
      detail: { efecte: "les seves files no diuen el mateix import: no se'n desa cap" },
    });
  }

  const altres = persones.filter((p) => !p.electe);
  const sousAltres = altres.map((p) => p.euros).filter((e): e is number => e !== null && e > 0);
  const medianaAltres = medianOf(sousAltres);

  return {
    consultat,
    electes: electes.map((p) => ({ ...p, alPle: false })),
    altresCarrecs: {
      persones: altres.length,
      ambImport: sousAltres.length,
      souMinim: sousAltres.length > 0 ? Math.min(...sousAltres) : null,
      souMedia: medianaAltres === null ? null : Math.round(medianaAltres * 100) / 100,
      souMaxim: sousAltres.length > 0 ? Math.max(...sousAltres) : null,
    },
    lligatsAmbElPle: 0,
    senseLligar: [],
  };
}

/**
 * Marca quins electes del CSV són la mateixa persona que un regidor del ple.
 *
 * Es fa contra la base de dades i no dins de `personesBarcelona` perquè la
 * consulta necessita el municipi, i així la lectura del fitxer es pot provar
 * sense cap connexió.
 */
export async function lligaAmbElPle(db: Db, dades: DadesBarcelona): Promise<DadesBarcelona> {
  const [barcelona] = await db
    .select({ id: municipalities.id })
    .from(municipalities)
    .where(
      or(
        eq(municipalities.idescat6, INE_BARCELONA),
        eq(municipalities.ine5, INE_BARCELONA.slice(0, 5)),
      ),
    );
  if (!barcelona) return dades;

  const regidors = await db
    .select({ nom: people.fullName })
    .from(councillorMandates)
    .innerJoin(people, eq(people.id, councillorMandates.personId))
    .where(and(eq(councillorMandates.municipalityId, barcelona.id)))
    .orderBy(asc(councillorMandates.orderNum));

  const delPle = indexUnic(regidors, (r) => normalizePersonName(r.nom));
  const electes = dades.electes.map((p) => ({
    ...p,
    alPle: delPle.unics.has(normalizePersonName(p.nom)),
  }));
  return {
    ...dades,
    electes,
    lligatsAmbElPle: electes.filter((p) => p.alPle).length,
    senseLligar: electes.filter((p) => !p.alPle).map((p) => p.nom),
  };
}
