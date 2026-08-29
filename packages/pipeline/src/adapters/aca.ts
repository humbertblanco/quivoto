import { inflateRawSync } from "node:zlib";
import { normalize } from "../lib/text";
import { sleep } from "../lib/http";

/**
 * Observatori del preu de l'aigua de l'Agència Catalana de l'Aigua.
 *
 * És l'única font que diu, amb la mateixa definició per als 947 municipis, què
 * paga una família pel metre cúbic d'aigua: preu vigent a 1 de gener, consum
 * domèstic de 12 m³/mes, habitatge de tres persones empadronades, sense IVA.
 * Ve en un sol full de càlcul amb un full per any (2015-2025) i, a diferència
 * de la resta de fonts del projecte, **no hi ha cap API**: o es llegeix
 * l'`.xlsx` o no hi ha dada.
 *
 * Font: https://aca.gencat.cat · Agència Catalana de l'Aigua. L'avís legal de
 * gencat permet reutilitzar-ho «en els termes establerts per la Llicència
 * oberta d'ús d'informació – Catalunya o […] CC0», amb quatre condicions que
 * ens obliguen: no alterar el contingut, no desnaturalitzar-ne el sentit,
 * **citar la font** i **informar de la darrera data d'actualització**. Per això
 * `parseNotaAca` treu la data del full «Nota» i la retorna amb les dades: la
 * fitxa l'ha de poder ensenyar, i sense ella no complim la llicència.
 */

export const URL_PREUS_ACA =
  "https://aca.gencat.cat/web/.content/10_ACA/L_Observatori_preu_aigua" +
  "/03-Preu-per-municipis-i-evolucio/Preus_per_municipi_ca.xlsx";

export const FONT_ACA = {
  nom: "Observatori del preu de l'aigua",
  organisme: "Agència Catalana de l'Aigua (ACA)",
  url: URL_PREUS_ACA,
  pagina:
    "https://aca.gencat.cat/ca/laigua/consulta-de-dades/observatori-del-preu-de-laigua/",
  llicencia: "Llicència oberta d'ús d'informació – Catalunya (avís legal de gencat.cat)",
  /** Les quatre condicions de l'avís legal, desades perquè la fitxa les compleixi. */
  condicions: [
    "no alterar el contingut de la informació",
    "no desnaturalitzar-ne el sentit",
    "citar la font",
    "informar de la darrera data d'actualització",
  ],
  base: "Preu vigent a 1 de gener, ús domèstic, consum de 12 m³/mes, habitatge de 3 persones, sense IVA.",
} as const;

const USER_AGENT = "quivoto/0.1 (brúixola electoral municipal; hola@quivoto.cat)";

// ─────────────────────────────────────────────────────────────────────────────
// Descàrrega
// ─────────────────────────────────────────────────────────────────────────────

export class AcaError extends Error {
  constructor(readonly status: number, readonly url: string) {
    super(`HTTP ${status} a ${url}`);
    this.name = "AcaError";
  }
}

/**
 * Baixa el llibre sencer. Són 950 KB en una sola petició —a diferència de les
 * fonts que es baixen fitxa a fitxa, aquí no castiguem ningú— i per això no cal
 * cap pausa entre crides ni cap paginació.
 */
export async function descarregaXlsx(
  url: string = URL_PREUS_ACA,
  options: { retries?: number; timeoutMs?: number } = {},
): Promise<Buffer> {
  const { retries = 3, timeoutMs = 120_000 } = options;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        headers: { accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "user-agent": USER_AGENT },
        signal: controller.signal,
        redirect: "follow",
      });
      if (!response.ok) throw new AcaError(response.status, url);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      // Un 4xx vol dir que el fitxer ha canviat de lloc: reintentar-ho no
      // l'hi tornarà, i el que cal és que surti a la incidència de seguida.
      if (error instanceof AcaError && error.status < 500) throw error;
      if (attempt === retries) break;
      await sleep(1_000 * 2 ** attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lector d'.xlsx
// ─────────────────────────────────────────────────────────────────────────────

/**
 * **Per què hi ha un lector d'`.xlsx` escrit a mà dins d'aquest repositori.**
 *
 * El projecte no té cap dependència que llegeixi fulls de càlcul i la regla és
 * no afegir-ne cap per una sola font. Un `.xlsx` és un ZIP amb XML a dins, i
 * Node ja porta el `inflate` a `node:zlib`: el que falta és el sobre del ZIP i
 * quatre expressions regulars. Són dues-centes línies que llegim i controlem
 * nosaltres, contra una llibreria de mig megabyte que llegeix macros, gràfics i
 * fórmules que no farem servir mai.
 *
 * El que **no** fa, dit clar perquè ningú no ho doni per fet: no avalua
 * fórmules —llegeix el valor calculat que Excel hi ha desat—, no interpreta
 * formats de cel·la (els números de data surten com el nombre de dies que són,
 * i qui sap que una columna és de dates la converteix amb `dataDeSerie`), i no
 * entén ZIP64. Si un dia el fitxer de l'ACA passa dels 4 GB o de 65.535
 * entrades, això peta amb un missatge explícit en comptes de mentir.
 */

const SIG_EOCD = 0x06054b50;
const SIG_CD = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

/** Fitxers d'un ZIP, ja descomprimits, per camí. */
export function llegeixZip(buf: Buffer): Map<string, Buffer> {
  const eocd = trobaEocd(buf);
  const entrades = buf.readUInt16LE(eocd + 10);
  const inici = buf.readUInt32LE(eocd + 16);
  if (entrades === 0xffff || inici === 0xffffffff) {
    throw new Error("ZIP64: aquest lector no el sap llegir");
  }

  const fitxers = new Map<string, Buffer>();
  let cursor = inici;
  for (let i = 0; i < entrades; i += 1) {
    if (buf.readUInt32LE(cursor) !== SIG_CD) throw new Error("directori central corromput");
    const metode = buf.readUInt16LE(cursor + 10);
    const comprimit = buf.readUInt32LE(cursor + 20);
    const nomLen = buf.readUInt16LE(cursor + 28);
    const extraLen = buf.readUInt16LE(cursor + 30);
    const comentariLen = buf.readUInt16LE(cursor + 32);
    const desplacament = buf.readUInt32LE(cursor + 42);
    const nom = buf.toString("utf8", cursor + 46, cursor + 46 + nomLen);
    cursor += 46 + nomLen + extraLen + comentariLen;

    if (buf.readUInt32LE(desplacament) !== SIG_LOCAL) throw new Error(`capçalera local corrompuda a ${nom}`);
    // La capçalera local repeteix el nom i l'extra amb longituds **pròpies**:
    // no són sempre les del directori central, i fer-les servir del central és
    // l'error clàssic que desplaça les dades uns quants bytes.
    const dadesA =
      desplacament + 30 + buf.readUInt16LE(desplacament + 26) + buf.readUInt16LE(desplacament + 28);
    const cru = buf.subarray(dadesA, dadesA + comprimit);
    if (metode === 0) fitxers.set(nom, Buffer.from(cru));
    else if (metode === 8) fitxers.set(nom, inflateRawSync(cru));
    else throw new Error(`mètode de compressió ${metode} no suportat a ${nom}`);
  }
  return fitxers;
}

/**
 * El final del directori central és l'últim lloc on hi ha la seva signatura, i
 * s'ha de buscar del final cap enrere perquè el comentari del ZIP (fins a 64 KB)
 * podria contenir-ne una de falsa.
 */
function trobaEocd(buf: Buffer): number {
  const minim = Math.max(0, buf.length - 22 - 0xffff);
  for (let i = buf.length - 22; i >= minim; i -= 1) {
    if (buf.readUInt32LE(i) === SIG_EOCD) return i;
  }
  throw new Error("no sembla un fitxer ZIP: no hi ha directori central");
}

const ENTITATS: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
};

export function desescapaXml(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (tot, codi: string) => {
    if (codi.startsWith("#x") || codi.startsWith("#X")) return String.fromCodePoint(Number.parseInt(codi.slice(2), 16));
    if (codi.startsWith("#")) return String.fromCodePoint(Number.parseInt(codi.slice(1), 10));
    return ENTITATS[codi] ?? tot;
  });
}

function atribut(atributs: string, nom: string): string | null {
  const match = new RegExp(`(?:^|\\s)${nom}="([^"]*)"`).exec(atributs);
  return match ? match[1]! : null;
}

/** Text de tots els `<t>` que hi hagi a dins, que és com es guarda el text ric. */
function textDe(xml: string): string {
  let text = "";
  for (const match of xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) text += desescapaXml(match[1]!);
  return text;
}

/**
 * Taula de cadenes compartides. Excel no repeteix el text a cada cel·la: hi posa
 * un índex a aquesta taula, i una cel·la amb `t="s"` i `<v>774</v>` vol dir la
 * cadena número 774. Sense això, totes les celles de text surten com a números.
 */
export function parseCadenes(xml: string): string[] {
  const cadenes: string[] = [];
  for (const match of xml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>|<si(?:\s[^>]*)?\/>/g)) {
    cadenes.push(match[1] === undefined ? "" : textDe(match[1]));
  }
  return cadenes;
}

export type Cella = string | number | boolean | null;
export type Full = { nom: string; files: Cella[][] };

/** Índex de columna a partir de la referència d'una cel·la: A→0, B→1, AA→26. */
export function indexColumna(referencia: string): number {
  const lletres = /^([A-Z]+)/.exec(referencia.toUpperCase());
  if (!lletres) return -1;
  let index = 0;
  for (const lletra of lletres[1]!) index = index * 26 + (lletra.charCodeAt(0) - 64);
  return index - 1;
}

/**
 * Files d'un full. Es tornen denses —els forats són `null`— perquè l'XML només
 * escriu les celles que tenen alguna cosa: si no s'omplen els buits, la columna
 * de la dreta se'n va cap a l'esquerra i el «Cànon» acaba llegint-se com a
 * «Clavegueram» sense que peti res.
 */
export function parseFull(xml: string, cadenes: readonly string[], nom: string): Full {
  const files: Cella[][] = [];
  for (const fila of xml.matchAll(/<row(?:\s([^>]*?))?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const numero = Number(atribut(fila[1] ?? "", "r") ?? files.length + 1);
    const celles: Cella[] = [];
    for (const cella of (fila[2] ?? "").matchAll(/<c(?:\s([^>]*?))?(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const atributs = cella[1] ?? "";
      const contingut = cella[2] ?? "";
      const referencia = atribut(atributs, "r");
      const index = referencia ? indexColumna(referencia) : celles.length;
      while (celles.length < index) celles.push(null);
      celles[index] = valorDeCella(atribut(atributs, "t"), contingut, cadenes);
    }
    // Les files buides tampoc s'escriuen: la numeració mana, i el full s'ha de
    // poder llegir per número de fila (la capçalera de l'ACA és sempre la 9a).
    while (files.length < numero - 1) files.push([]);
    files[numero - 1] = celles;
  }
  return { nom, files };
}

function valorDeCella(tipus: string | null, contingut: string, cadenes: readonly string[]): Cella {
  const valor = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(contingut);
  switch (tipus) {
    case "s": {
      const index = Number(valor?.[1] ?? "");
      return Number.isInteger(index) ? cadenes[index] ?? null : null;
    }
    case "inlineStr":
      return textDe(contingut);
    case "str":
      return valor ? desescapaXml(valor[1]!) : null;
    case "b":
      return valor?.[1] === "1";
    // Una cel·la amb error (#N/A, #REF!) no és cap valor: val més un forat que
    // publicar «#DIV/0!» com si fos el preu de l'aigua.
    case "e":
      return null;
    default: {
      if (!valor) return null;
      const numero = Number(valor[1]);
      return Number.isFinite(numero) ? numero : null;
    }
  }
}

/** Llibre sencer: els fulls en l'ordre en què surten a les pestanyes. */
export function llegeixLlibre(buf: Buffer): Full[] {
  const fitxers = llegeixZip(buf);
  const llegeix = (cami: string): string => {
    const dades = fitxers.get(cami);
    if (!dades) throw new Error(`falta ${cami} dins de l'.xlsx`);
    return dades.toString("utf8");
  };

  const cadenes = fitxers.has("xl/sharedStrings.xml") ? parseCadenes(llegeix("xl/sharedStrings.xml")) : [];
  const rels = new Map<string, string>();
  for (const match of llegeix("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\s([^>]*)\/>/g)) {
    const id = atribut(match[1]!, "Id");
    const desti = atribut(match[1]!, "Target");
    if (id && desti) rels.set(id, desti.replace(/^\/?xl\//, "").replace(/^\//, ""));
  }

  const fulls: Full[] = [];
  for (const match of llegeix("xl/workbook.xml").matchAll(/<sheet\s([^>]*?)\/>/g)) {
    const nom = desescapaXml(atribut(match[1]!, "name") ?? "");
    const id = atribut(match[1]!, "r:id");
    const desti = id ? rels.get(id) : undefined;
    if (!desti) continue;
    fulls.push(parseFull(llegeix(`xl/${desti}`), cadenes, nom));
  }
  return fulls;
}

/**
 * Data a partir del nombre de dies que Excel hi desa. L'origen de la sèrie és
 * el 30 de desembre de 1899 i no l'1 de gener de 1900 perquè Excel arrossega
 * des del 1985 un 29 de febrer de 1900 que no va existir mai; els números
 * anteriors al 61 cauen dins d'aquest forat i no els donem per bons, cosa que
 * aquí no perd res: serien dates del segle XIX.
 */
export function dataDeSerie(serie: number): string | null {
  if (!Number.isFinite(serie) || serie < 61) return null;
  const ms = Date.UTC(1899, 11, 30) + Math.round(serie) * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// El full de l'ACA
// ─────────────────────────────────────────────────────────────────────────────

/** Una fila del full d'un any: un municipi i el que pagava l'1 de gener. */
export type FilaAca = {
  idescat6: string;
  municipi: string;
  comarca: string | null;
  /** €/m³ del servei de subministrament, que és **la columna comparable**. */
  subministrament: number | null;
  /** Cànon de l'aigua: el fixa la Generalitat, no l'ajuntament. */
  canon: number | null;
  clavegueram: number | null;
  /**
   * Què diu el full a la casella de clavegueram quan no hi ha cap preu: «Base
   * imposable…» (el cobren sobre el valor cadastral) o «s. d.». Es desa el text
   * perquè un zero i un «no es calcula sobre el consum» no volen dir el mateix.
   */
  clavegueramNota: string | null;
  total: number | null;
  gestora: string | null;
  gestioSubministrament: string | null;
  gestioClavegueram: string | null;
  /** L'asterisc del full: cobra la conservació del comptador a part. */
  quotaComptadorApart: boolean;
  /**
   * `true` si el full diu que hi ha tarifa social, `null` si la casella és
   * buida. **Mai `false`**: la casella buida no està definida enlloc del full i
   * no és prova que el municipi no en tingui.
   */
  tarifaSocial: boolean | null;
  /** Data de l'última revisió de tarifes, en ISO. */
  dataRevisio: string | null;
};

export type AnyAca = { any: number; files: FilaAca[] };

export type PreusAca = {
  /** La data que la llicència ens obliga a ensenyar al costat de la xifra. */
  dataActualitzacio: string | null;
  /** El peu de font tal com el redacta l'ACA, per citar-la amb les seves paraules. */
  font: string | null;
  anys: AnyAca[];
};

/** Clau normalitzada d'una capçalera, amb l'asterisc a part perquè `normalize` se'l menja. */
function clauColumna(text: string): string {
  const net = text.replace(/\s+/g, " ").trim();
  if (net === "(*)" || net === "*") return "asterisc";
  return normalize(net);
}

const cadena = (valor: Cella): string | null => {
  if (typeof valor === "string") {
    const net = valor.replace(/\s+/g, " ").trim();
    return net === "" ? null : net;
  }
  if (typeof valor === "number") return String(valor);
  return null;
};

/**
 * Número d'una casella de preu. El full hi posa text quan no hi ha xifra —«s.
 * d.», «Base imposable de l'immoble»— i un guionet als anys vells. Tot això és
 * «no ho sabem», que no és el mateix que zero: si es convertís a zero, un
 * municipi sense dada baixaria la mediana de tot Catalunya.
 */
export function nombreAca(valor: Cella): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor !== "string") return null;
  const net = valor.replace(/\s/g, "").replace(/€.*$/, "").replace(",", ".");
  if (net === "" || net === "-" || net === "–") return null;
  const numero = Number(net);
  return Number.isFinite(numero) ? numero : null;
}

/** «Si», «sí», «SI» → `true`. Buit → `null`, que vol dir «el full no ho diu». */
export function tarifaSocialAca(valor: Cella): boolean | null {
  const text = cadena(valor);
  if (text === null) return null;
  const clau = normalize(text);
  if (clau === "si" || clau === "s") return true;
  if (clau === "no") return false;
  return null;
}

/** Data de revisió: ve com a nombre de sèrie d'Excel, i en algun full com a text. */
export function dataRevisioAca(valor: Cella): string | null {
  if (typeof valor === "number") return dataDeSerie(valor);
  const text = cadena(valor);
  if (text === null) return null;
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(text);
  if (dmy) return `${dmy[3]}-${dmy[2]!.padStart(2, "0")}-${dmy[1]!.padStart(2, "0")}`;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  return iso ? iso[0]! : null;
}

/**
 * Quina columna és cada cosa. Es fa pel nom de la capçalera i no per la posició
 * perquè el full n'hi va afegint amb els anys: el 2015 en tenia 7, el 2017 ja
 * portava l'entitat gestora, el 2018 les tarifes socials i el 2020 la data de
 * revisió. Amb índexs fixos, la sèrie es trencaria sola cada vegada que l'ACA
 * publiqués una columna nova.
 */
export function mapaColumnes(capcalera: readonly Cella[]): Record<string, number> {
  const mapa: Record<string, number> = {};
  capcalera.forEach((cella, index) => {
    const text = cadena(cella);
    if (text === null) return;
    const clau = clauColumna(text);
    const posa = (nom: string): void => {
      if (mapa[nom] === undefined) mapa[nom] = index;
    };
    // L'ordre importa: «Gestió Clavegueram» també conté «clavegueram».
    if (clau === "idescat") posa("idescat");
    else if (clau.startsWith("municipi")) posa("municipi");
    else if (clau.startsWith("comarca")) posa("comarca");
    else if (clau.startsWith("entitat gestora")) posa("gestora");
    else if (clau.startsWith("gestio subministrament")) posa("gestioSubministrament");
    else if (clau.startsWith("gestio clavegueram")) posa("gestioClavegueram");
    else if (clau.startsWith("subministrament")) posa("subministrament");
    else if (clau.startsWith("canon")) posa("canon");
    else if (clau.startsWith("clavegueram")) posa("clavegueram");
    else if (clau.startsWith("total")) posa("total");
    else if (clau.startsWith("tarifes socials")) posa("tarifaSocial");
    else if (clau.startsWith("data revisio")) posa("dataRevisio");
    else if (clau === "asterisc") posa("asterisc");
  });
  return mapa;
}

/** La fila de capçalera d'un full de l'ACA: la que té «Idescat» a la primera casella. */
export function fileraCapcalera(files: readonly Cella[][]): number {
  return files.findIndex((fila) => fila.some((cella) => clauColumna(cadena(cella) ?? "") === "idescat"));
}

/**
 * Files d'un full d'any. El codi Idescat es reomple a sis xifres: si algun any
 * l'ACA el desa com a número, els 311 municipis de la província de Barcelona
 * perdrien el zero inicial i deixarien de lligar amb el padró.
 */
export function parseFullAca(full: Full): FilaAca[] {
  const capcalera = fileraCapcalera(full.files);
  if (capcalera === -1) return [];
  const columnes = mapaColumnes(full.files[capcalera] ?? []);
  if (columnes.idescat === undefined) return [];

  const files: FilaAca[] = [];
  for (const fila of full.files.slice(capcalera + 1)) {
    const cella = (nom: string): Cella =>
      columnes[nom] === undefined ? null : fila[columnes[nom]!] ?? null;
    const codi = cadena(cella("idescat"));
    if (codi === null || !/^\d{1,6}$/.test(codi)) continue;
    const clavegueram = cella("clavegueram");
    files.push({
      idescat6: codi.padStart(6, "0"),
      municipi: cadena(cella("municipi")) ?? "",
      comarca: cadena(cella("comarca")),
      subministrament: nombreAca(cella("subministrament")),
      canon: nombreAca(cella("canon")),
      clavegueram: nombreAca(clavegueram),
      clavegueramNota: nombreAca(clavegueram) === null ? cadena(clavegueram) : null,
      total: nombreAca(cella("total")),
      gestora: cadena(cella("gestora")),
      gestioSubministrament: cadena(cella("gestioSubministrament")),
      gestioClavegueram: cadena(cella("gestioClavegueram")),
      quotaComptadorApart: (cadena(cella("asterisc")) ?? "").includes("*"),
      tarifaSocial: tarifaSocialAca(cella("tarifaSocial")),
      dataRevisio: dataRevisioAca(cella("dataRevisio")),
    });
  }
  return files;
}

/**
 * El full «Nota». D'aquí surten les dues coses que la llicència ens obliga a
 * publicar al costat de la xifra: la data d'actualització i el peu de font.
 */
export function parseNotaAca(full: Full | undefined): { dataActualitzacio: string | null; font: string | null } {
  let dataActualitzacio: string | null = null;
  let font: string | null = null;
  for (const fila of full?.files ?? []) {
    const etiqueta = normalize(cadena(fila[0] ?? null) ?? "");
    // La data pot venir com a nombre de sèrie d'Excel o com a text; el peu de
    // font sempre és text. Es busca la primera casella amb res a la dreta de
    // l'etiqueta perquè el full les mou de columna d'un any a l'altre.
    const primera: Cella = fila.slice(1).find((c) => cadena(c) !== null) ?? null;
    const valor = cadena(primera);
    if (valor === null) continue;
    if (etiqueta.startsWith("data d actualitzacio")) dataActualitzacio = dataRevisioAca(primera) ?? valor;
    if (etiqueta === "font") font = valor;
  }
  return { dataActualitzacio, font };
}

/** El llibre sencer convertit a sèries per any, amb el full «Nota» ja llegit. */
export function parseLlibreAca(fulls: readonly Full[]): PreusAca {
  const nota = parseNotaAca(fulls.find((f) => normalize(f.nom).startsWith("nota")));
  const anys: AnyAca[] = [];
  for (const full of fulls) {
    const any = Number(full.nom.trim());
    if (!Number.isInteger(any) || any < 2000 || any > 2100) continue;
    const files = parseFullAca(full);
    if (files.length > 0) anys.push({ any, files });
  }
  anys.sort((a, b) => a.any - b.any);
  return { ...nota, anys };
}

/** Baixa el llibre i el torna ja llegit. */
export async function descarregaPreusAca(url: string = URL_PREUS_ACA): Promise<PreusAca> {
  return parseLlibreAca(llegeixLlibre(await descarregaXlsx(url)));
}
