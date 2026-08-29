/**
 * Votacions del Plenari del Consell Municipal de Barcelona.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * D'ON SURT
 * ─────────────────────────────────────────────────────────────────────────────
 * No és a Open Data BCN. Ho vam comprovar: `package_search` del CKAN de
 * `opendata-ajuntament.barcelona.cat` retorna **0 resultats** per «votacions» i
 * cap dels conjunts de «plenari» o «consell municipal» porta vots (només
 * catàlegs documentals del repositori BCNROC). El fitxer viu penjat de la
 * pàgina d'acords del plenari, sota el botó «Acords del mandat en CSV»:
 *
 *   Mandat 2023-2027 (actual)
 *     pàgina  https://ajuntament.barcelona.cat/ca/accio-de-govern/el-consell-municipal/acords-del-plenari
 *     fitxer  https://ajuntament.barcelona.cat/sites/default/files/votacions_plenari/votacions_plenari_mandat_actual.csv
 *
 *   Mandat 2019-2023
 *     pàgina  https://ajuntament.barcelona.cat/ca/mandat-2019-2023/accio-de-govern/el-consell-municipal/acords-del-plenari
 *     fitxer  https://ajuntament.barcelona.cat/sites/default/files/votacions_plenari/votacions_plenari_mandat_2019_2023.csv
 *
 * Que no sigui al portal de dades obertes importa: **no té llicència CC BY**.
 * S'hi aplica l'avís legal general de `ajuntament.barcelona.cat`, que permet
 * reutilitzar-ho tot «sempre que no s'indiqui el contrari» amb quatre
 * condicions: no alterar el contingut, no desnaturalitzar-ne el sentit,
 * **esmentar la font** i no donar a entendre que l'Ajuntament patrocina
 * l'activitat. Complim-les citant font i data a la fitxa.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * COBERTURA MESURADA (descàrrega del 29/08/2026)
 * ─────────────────────────────────────────────────────────────────────────────
 *   2023-2027 · 814 propostes · 39 sessions · 11/07/2023 → 27/03/2026 · 1,3 MB
 *               800/814 (98,3 %) amb vot de grup → 4.800 vots de grup
 *               200 files a «D) Part d'impuls i control», 198 amb vot: les mocions
 *   2019-2023 · 1.031 propostes · 55 sessions · 16/07/2019 → 11/05/2023 · 323 kB
 *               1.023/1.031 (99,2 %) amb vot de grup → 7.120 vots de grup
 *               225 files a la part d'impuls i control, 220 amb vot
 *
 * El fitxer del mandat actual va amb un desfasament d'uns cinc mesos: l'última
 * sessió publicada és de març de 2026 i el `Last-Modified` és de maig de 2026.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL VOT NOMINAL NO HI ÉS (correcció a docs/EXTRACCIO-ACTES.md)
 * ─────────────────────────────────────────────────────────────────────────────
 * El CSV del mandat actual **té** 41 columnes, una per regidor. Però només
 * n'hi ha **una fila plena** de 814: la votació nominal de la sessió CP 14/25
 * EXT. Són 41 cel·les de vot nominal a tot el fitxer, contra 4.800 de grup.
 * Al mandat 2019-2023 no hi ha ni tan sols les columnes.
 *
 * Per tant Barcelona **no** publica «el vot de cada regidor»: publica el vot de
 * cada **grup**, amb les columnes de regidor reservades per a les comptades
 * votacions nominals. Com a conjunt de validació daurat segueix valent —és
 * registre oficial de vot per grup, que és el que l'extractor d'actes ha
 * d'encertar— però no serveix per validar atribució individual.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PER QUÈ NO ES POT FER SERVIR UN LECTOR DE CSV NORMAL (mandat actual)
 * ─────────────────────────────────────────────────────────────────────────────
 * El fitxer del mandat actual **no és CSV vàlid**: el camp `text` conté `;`
 * sense cometes. 242 de les 814 files tenen més camps dels que toca (fins a
 * 91 en comptes de 61). Un `split(";")` posicional pel davant desalinea totes
 * les columnes de vot d'aquestes 242 files, que és exactament la informació que
 * anem a buscar.
 *
 * La sortida és ancorar pels dos extrems, perquè els extrems sí que són fixos:
 *
 *   · Per la DRETA, 55 camps invariables: `resultat`, `sistema_votacio`,
 *     `part_acta`, `tema_cat`, `tema_cast`, `organ_resolucio`, les 48 columnes
 *     de vot i un camp buit final (la línia acaba en `;`). Verificat a les 814
 *     files: el camp final és sempre buit, `organ_resolucio` és sempre «Consell
 *     Municipal» i els vots només prenen cinc valors.
 *   · Per l'ESQUERRA, `ref_sessio`, després `ref_proposta` i després
 *     `data_sessio`. Aquí tampoc es pot comptar camps: una fila (CP 13/25) porta
 *     tres referències de proposta separades per `;` dins de `ref_proposta`.
 *     Ancorem, doncs, en el **primer camp amb forma de data** `dd/mm/aaaa`, que
 *     és `data_sessio`; tot el que queda entre `ref_sessio` i la data és
 *     `ref_proposta`.
 *   · El que sobra al mig és `resum_cat`, `resum_cast` i `text`. Les dues
 *     primeres no porten mai `;` —comprovat a les 814 files—, així que
 *     `resum_cat` és la primera peça, `resum_cast` la segona i `text` la resta
 *     tornada a unir amb `;`.
 *
 * El fitxer 2019-2023, en canvi, **sí** és CSV correcte (cometes RFC 4180 i
 * salts de línia dins dels camps), però amb un esquema completament diferent:
 * 17 columnes, sense castellà, sense columnes de regidor, amb `Proposta`
 * (qui ho proposa) i `equip_govern`, i una primera línia «sense filtres» que és
 * un rètol del generador i no una capçalera. Són dos parsers, no un.
 *
 * Rareses de les dades, totes conservades i documentades, no maquillades:
 *   · El grup de Junts canvia d'etiqueta a mitja legislatura: «Junts per
 *     Catalunya» a 39 files (2023) i «Junts per Barcelona» a 761. Mai les dues
 *     alhora. Al mandat anterior passa igual amb «BCN Canvi» → «Valents»
 *     (rebateig del 2022), però allà hi ha 3 files amb les dues columnes plenes.
 *     Per això `VotGrup` porta l'etiqueta literal **i** el nom canònic: qui
 *     vulgui sèries llargues agrupa per `grup`, qui vulgui auditar mira
 *     `etiqueta`.
 *   · `-` no és el mateix que buit. `-` vol dir que el grup **no va participar**
 *     en la votació (23 files, gairebé sempre VOX o PP fent abandonament de
 *     sala); buit vol dir que no en consta res. Els distingim: `absent` vs
 *     `no_consta`.
 *   · Al mandat 2019-2023 el sentit «a favor» apareix escrit de dues maneres,
 *     `a_favor` (5.577 cops) i `A favor` (111). Normalitzem.
 *   · Quatre files tenen `resum_cat` en castellà i `resum_cast` en català,
 *     invertides a l'origen. No ho toquem: no ens toca corregir la font.
 */

import { HttpError, sleep } from "../lib/http";

// ─────────────────────────────────────────────────────────────────────────────
// Tipus
// ─────────────────────────────────────────────────────────────────────────────

/** Codi INE de Barcelona, per lligar amb `municipalities`. */
export const INE_BARCELONA = "080193";

export type Mandat = "2019-2023" | "2023-2027";

/**
 * Cinc valors, com demana l'esquema de votacions de docs/EXTRACCIO-ACTES.md.
 * `absent` és participació negada explícitament («-»); `no_consta` és silenci
 * de la font. Barrejar-los faria passar per abstenció el que és un plantó.
 */
export type SentitVot = "a_favor" | "en_contra" | "abstencio" | "absent" | "no_consta";

export type VotGrup = {
  /** Nom canònic, estable entre mandats i entre rebateigs. */
  grup: string;
  /** Etiqueta literal de la columna del CSV, per poder auditar l'origen. */
  etiqueta: string;
  sentit: SentitVot;
};

export type VotRegidor = {
  nom: string;
  /** Grup canònic del regidor, tal com el declara la capçalera «Nom (Grup)». */
  grup: string;
  sentit: SentitVot;
};

export type ResultatAcord =
  | "aprovat"
  | "aprovat_per_unanimitat"
  | "aprovat_amb_modificacions"
  | "rebutjat";

export type SistemaVotacio = "grup" | "nominal" | "no_consta";

export type AcordPlenari = {
  municipiIne: string;
  mandat: Mandat;
  /** Referència de la sessió, p. ex. «CP 12/23». */
  refSessio: string;
  /** Referències d'expedient. Gairebé sempre una; una fila en porta tres. */
  refPropostes: string[];
  /** Data de la sessió en ISO `aaaa-mm-dd`. */
  data: string;
  titol: string;
  titolCastella: string | null;
  /** Text de l'acord. Absent al mandat 2019-2023, que no el publica. */
  text: string | null;
  organ: string;
  /** Literal del CSV, p. ex. «D) Part d'impuls i control». */
  partActa: string;
  /**
   * Cert per a la part d'impuls i control: mocions, precs i preguntes. És el
   * bloc que diu què ha volgut fer cada grup, no què ha hagut de tramitar
   * el govern, i per tant el que discrimina de cara al 23-M.
   */
  esImpulsIControl: boolean;
  tema: string | null;
  resultat: ResultatAcord;
  /** Literal del CSV, perquè la normalització sigui reversible. */
  resultatOriginal: string;
  sistemaVotacio: SistemaVotacio;
  /** Qui proposa. Només el mandat 2019-2023 ho publica. */
  proponent: string | null;
  /** Grups al govern segons la font. Només el mandat 2019-2023 ho publica. */
  equipGovern: string[];
  votsGrup: VotGrup[];
  votsRegidor: VotRegidor[];
  /** URL exacta d'on surt la fila, per a la citació de la fitxa. */
  font: string;
};

export class BarcelonaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BarcelonaError";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Adreces
// ─────────────────────────────────────────────────────────────────────────────

const ARREL = "https://ajuntament.barcelona.cat/sites/default/files/votacions_plenari";

export const URL_MANDAT_ACTUAL = `${ARREL}/votacions_plenari_mandat_actual.csv`;
export const URL_MANDAT_2019_2023 = `${ARREL}/votacions_plenari_mandat_2019_2023.csv`;

/** Pàgines que publiquen cada fitxer, per citar-les i per detectar-hi canvis. */
export const PAGINA_MANDAT_ACTUAL =
  "https://ajuntament.barcelona.cat/ca/accio-de-govern/el-consell-municipal/acords-del-plenari";
export const PAGINA_MANDAT_2019_2023 =
  "https://ajuntament.barcelona.cat/ca/mandat-2019-2023/accio-de-govern/el-consell-municipal/acords-del-plenari";

// ─────────────────────────────────────────────────────────────────────────────
// Normalització
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Etiquetes de columna → nom canònic del grup. Recull els dos rebateigs de
 * mitja legislatura (Junts, i BCN Canvi → Valents) perquè una mateixa força
 * política no aparegui partida en dues sèries.
 */
const GRUP_CANONIC: Record<string, string> = {
  // Mandat 2023-2027
  "Barcelona en Comú": "Barcelona en Comú",
  "Partit dels Socialistes de Catalunya": "Partit dels Socialistes de Catalunya",
  "Esquerra Republicana": "Esquerra Republicana",
  "Partit Popular": "Partit Popular",
  "VOX Barcelona": "VOX",
  "Junts per Catalunya": "Junts",
  "Junts per Barcelona": "Junts",
  // Mandat 2019-2023
  BComú: "Barcelona en Comú",
  PSC: "Partit dels Socialistes de Catalunya",
  ERC: "Esquerra Republicana",
  PP: "Partit Popular",
  JxCat: "Junts",
  Cs: "Ciutadans",
  "BCN Canvi": "Valents",
  Valents: "Valents",
};

export function grupCanonic(etiqueta: string): string {
  return GRUP_CANONIC[etiqueta.trim()] ?? etiqueta.trim();
}

/**
 * Els dos fitxers escriuen el sentit del vot diferent, i el del mandat anterior
 * fins i tot es contradiu a si mateix (`a_favor` i `A favor`). Comparem sense
 * accents ni majúscules per no dependre de com ho escriguin demà.
 */
function plana(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, " ");
}

export function sentitVot(valor: string): SentitVot {
  const v = plana(valor);
  if (v === "" ) return "no_consta";
  if (v === "-") return "absent";
  if (v === "a favor") return "a_favor";
  if (v === "en contra") return "en_contra";
  if (v === "abstencio") return "abstencio";
  if (v === "absencia" || v === "absent") return "absent";
  throw new BarcelonaError(`sentit de vot desconegut: ${JSON.stringify(valor)}`);
}

function resultatAcord(valor: string): ResultatAcord {
  const v = plana(valor);
  if (v === "aprovat per unanimitat" || v === "aprovat unanimitat") {
    return "aprovat_per_unanimitat";
  }
  if (v === "aprovada amb modificacions") return "aprovat_amb_modificacions";
  // «Aprovada amb text transaccionat» és una aprovació, amb el text negociat
  // al ple; el matís es conserva a `resultatOriginal`.
  if (v.startsWith("aprovad") || v.startsWith("aprovat")) return "aprovat";
  if (v.startsWith("rebutjad") || v.startsWith("rebutjat")) return "rebutjat";
  if (v === "no aprovada" || v === "no aprovat") return "rebutjat";
  throw new BarcelonaError(`resultat desconegut: ${JSON.stringify(valor)}`);
}

function sistemaVotacio(valor: string): SistemaVotacio {
  const v = plana(valor);
  if (v === "") return "no_consta";
  if (v.includes("nominal")) return "nominal";
  if (v.includes("grup")) return "grup";
  throw new BarcelonaError(`sistema de votació desconegut: ${JSON.stringify(valor)}`);
}

/** `dd/mm/aaaa` (i `d/m/aaaa`, que és com ho escriu el mandat anterior) → ISO. */
const RE_DATA = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/;

function dataIso(valor: string): string {
  const m = RE_DATA.exec(valor);
  if (!m) throw new BarcelonaError(`data no reconeguda: ${JSON.stringify(valor)}`);
  const [, d, mes, any] = m;
  return `${any}-${mes!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
}

/**
 * El CSV arrossega `&nbsp;` i espais durs de l'editor web del web municipal.
 * Si no es netegen, dos títols idèntics no s'assemblen.
 */
function net(text: string): string {
  return text
    .replace(/&nbsp;?/gi, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Mandat 2023-2027: parser ancorat pels dos extrems
// ─────────────────────────────────────────────────────────────────────────────

/** Camps fixos que la capçalera ha de dur, en aquest ordre, a l'esquerra. */
const CAPCALERA_ACTUAL = [
  "ref_sessio",
  "ref_proposta",
  "data_sessio",
  "resum_cat",
  "resum_cast",
  "text",
  "resultat",
  "sistema_votacio",
  "part_acta",
  "tema_cat",
  "tema_cast",
  "organ_resolucio",
] as const;

/** Camps de la dreta que no són vots: de `resultat` a `organ_resolucio`. */
const META_DRETA = 6;

type ColumnaVot =
  | { mena: "grup"; etiqueta: string; grup: string }
  | { mena: "regidor"; nom: string; grup: string };

/**
 * La capçalera distingeix grup de regidor per un detall estable: els regidors
 * hi surten com «Nom Cognoms (Grup)» i els grups no porten parèntesis.
 */
function columnesVot(noms: string[]): ColumnaVot[] {
  return noms.map((n) => {
    const m = /^(.*?)\s*\(([^()]+)\)\s*$/.exec(n);
    if (m) {
      return { mena: "regidor", nom: net(m[1]!), grup: grupCanonic(m[2]!) };
    }
    return { mena: "grup", etiqueta: n.trim(), grup: grupCanonic(n) };
  });
}

export function parseMandatActual(csv: string, font: string = URL_MANDAT_ACTUAL): AcordPlenari[] {
  const linies = csv.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (linies.length < 2) throw new BarcelonaError("el CSV del mandat actual és buit");

  const capcalera = linies[0]!.split(";");
  // La línia acaba en `;`, així que l'últim camp de la capçalera és buit i no
  // és cap columna. Si això canviés, tot el desplaçament per la dreta falla.
  if (capcalera[capcalera.length - 1] !== "") {
    throw new BarcelonaError("la capçalera ja no acaba en `;`: revisa l'ancoratge per la dreta");
  }
  const noms = capcalera.slice(0, -1);
  for (let i = 0; i < CAPCALERA_ACTUAL.length; i += 1) {
    if (noms[i] !== CAPCALERA_ACTUAL[i]) {
      throw new BarcelonaError(
        `capçalera inesperada a la columna ${i}: esperava «${CAPCALERA_ACTUAL[i]}», hi ha «${noms[i]}»`,
      );
    }
  }

  const columnes = columnesVot(noms.slice(CAPCALERA_ACTUAL.length));
  // Blocs invariables de la dreta: metadades + vots + el camp buit final.
  const dreta = META_DRETA + columnes.length + 1;

  return linies.slice(1).map((linia, i) => {
    const f = linia.split(";");
    if (f.length < CAPCALERA_ACTUAL.length + columnes.length + 1) {
      throw new BarcelonaError(`fila ${i + 1}: hi falten camps (${f.length})`);
    }
    if (f[f.length - 1] !== "") {
      throw new BarcelonaError(`fila ${i + 1}: no acaba en \`;\`, l'ancoratge per la dreta no val`);
    }

    // Ancoratge esquerre: la data és el primer camp amb forma `dd/mm/aaaa`.
    // Comptar camps no serviria: `ref_proposta` pot dur `;` a dins.
    const limit = f.length - dreta;
    let iData = -1;
    for (let k = 1; k < limit; k += 1) {
      if (RE_DATA.test(f[k]!)) {
        iData = k;
        break;
      }
    }
    if (iData < 0) throw new BarcelonaError(`fila ${i + 1}: no hi trobo la data de sessió`);

    const mig = f.slice(iData + 1, limit);
    if (mig.length < 3) throw new BarcelonaError(`fila ${i + 1}: bloc central incomplet`);

    const meta = f.slice(-dreta);
    const vots = meta.slice(META_DRETA, META_DRETA + columnes.length);

    const votsGrup: VotGrup[] = [];
    const votsRegidor: VotRegidor[] = [];
    columnes.forEach((col, k) => {
      const brut = vots[k] ?? "";
      // El silenci no és cap vot: només emetem el que la font declara.
      if (brut.trim() === "") return;
      const sentit = sentitVot(brut);
      if (col.mena === "grup") {
        votsGrup.push({ grup: col.grup, etiqueta: col.etiqueta, sentit });
      } else {
        votsRegidor.push({ nom: col.nom, grup: col.grup, sentit });
      }
    });

    const partActa = net(meta[2]!);
    const tema = net(meta[3]!);

    return {
      municipiIne: INE_BARCELONA,
      mandat: "2023-2027",
      refSessio: net(f[0]!),
      refPropostes: f
        .slice(1, iData)
        .map((r) => net(r))
        .filter((r) => r !== ""),
      data: dataIso(f[iData]!),
      titol: net(mig[0]!),
      titolCastella: net(mig[1]!) || null,
      // `text` és l'únic camp que pot dur `;`: el tornem a muntar tal com era.
      text: net(mig.slice(2).join(";")) || null,
      organ: net(meta[5]!),
      partActa,
      esImpulsIControl: /impuls i control/i.test(partActa),
      tema: tema || null,
      resultat: resultatAcord(meta[0]!),
      resultatOriginal: net(meta[0]!),
      sistemaVotacio: sistemaVotacio(meta[1]!),
      proponent: null,
      equipGovern: [],
      votsGrup,
      votsRegidor,
      font,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Mandat 2019-2023: CSV correcte, esquema diferent
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lector RFC 4180 mínim. Cal perquè el fitxer 2019-2023 posa salts de línia
 * **dins** dels camps entre cometes: tallar per `\n` en partiria 649 registres
 * de 1.031. No fem servir cap dependència perquè el paquet no en té cap per a
 * CSV i no val la pena afegir-ne una per a dotze línies.
 */
export function llegeixCsv(text: string, separador = ";"): string[][] {
  const files: string[][] = [];
  let fila: string[] = [];
  let camp = "";
  let entreCometes = false;

  // Fora el BOM, que si no s'enganxa al primer nom de columna.
  const s = text.replace(/^\ufeff/, "");

  for (let i = 0; i < s.length; i += 1) {
    const c = s[i]!;
    if (entreCometes) {
      if (c === '"') {
        // `""` és una cometa escapada, no el final del camp.
        if (s[i + 1] === '"') {
          camp += '"';
          i += 1;
        } else {
          entreCometes = false;
        }
      } else {
        camp += c;
      }
      continue;
    }
    if (c === '"') {
      entreCometes = true;
    } else if (c === separador) {
      fila.push(camp);
      camp = "";
    } else if (c === "\n") {
      fila.push(camp);
      files.push(fila);
      fila = [];
      camp = "";
    } else if (c !== "\r") {
      camp += c;
    }
  }
  if (camp !== "" || fila.length > 0) {
    fila.push(camp);
    files.push(fila);
  }
  return files.filter((f) => f.some((v) => v.trim() !== ""));
}

const CAPCALERA_2019 = [
  "ref_sessio",
  "data_sessio",
  "resum",
  "Proposta",
  "resultat",
  "part_acta",
  "sistema votació",
  "tema",
  "equip_govern",
] as const;

export function parseMandat20192023(
  csv: string,
  font: string = URL_MANDAT_2019_2023,
): AcordPlenari[] {
  const files = llegeixCsv(csv);
  // La primera línia és el rètol del generador («sense filtres»), no capçalera.
  const inici = files.findIndex((f) => f[0] === "ref_sessio");
  if (inici < 0) throw new BarcelonaError("no hi trobo la capçalera del mandat 2019-2023");

  const noms = files[inici]!;
  for (let i = 0; i < CAPCALERA_2019.length; i += 1) {
    if (noms[i] !== CAPCALERA_2019[i]) {
      throw new BarcelonaError(
        `capçalera 2019-2023 inesperada a la columna ${i}: esperava «${CAPCALERA_2019[i]}», hi ha «${noms[i]}»`,
      );
    }
  }
  // Tot el que ve després d'`equip_govern` són columnes de grup.
  const columnes = noms.slice(CAPCALERA_2019.length).map((n) => ({
    etiqueta: n.trim(),
    grup: grupCanonic(n),
  }));

  return files.slice(inici + 1).map((f, i) => {
    if (f.length !== noms.length) {
      throw new BarcelonaError(`fila ${i + 1} del mandat 2019-2023: ${f.length} camps de ${noms.length}`);
    }
    const votsGrup: VotGrup[] = [];
    columnes.forEach((col, k) => {
      const brut = f[CAPCALERA_2019.length + k] ?? "";
      if (brut.trim() === "") return;
      votsGrup.push({ grup: col.grup, etiqueta: col.etiqueta, sentit: sentitVot(brut) });
    });

    const partActa = net(f[5]!);
    const proponent = net(f[3]!);
    const tema = net(f[7]!);

    return {
      municipiIne: INE_BARCELONA,
      mandat: "2019-2023",
      refSessio: net(f[0]!),
      refPropostes: [],
      data: dataIso(f[1]!),
      titol: net(f[2]!),
      titolCastella: null,
      // Aquest mandat publica el resum però no el text de l'acord.
      text: null,
      organ: "Consell Municipal",
      partActa,
      esImpulsIControl: /impuls i control/i.test(partActa),
      tema: tema || null,
      resultat: resultatAcord(f[4]!),
      resultatOriginal: net(f[4]!),
      sistemaVotacio: sistemaVotacio(f[6]!),
      proponent: proponent || null,
      equipGovern: net(f[8]!)
        .split(",")
        .map((g) => grupCanonic(g))
        .filter((g) => g !== ""),
      votsGrup,
      votsRegidor: [],
      font,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Descàrrega
// ─────────────────────────────────────────────────────────────────────────────

const USER_AGENT = "quivoto/0.1 (brúixola electoral municipal; hola@quivoto.cat)";

/**
 * `lib/http.ts` només sap demanar JSON, i això és text. Mateixa política de
 * reintents: només val la pena repetir els 5xx i el 429.
 */
export async function descarregaText(url: string, reintents = 4): Promise<string> {
  let ultim: unknown;
  for (let intent = 0; intent <= reintents; intent += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);
    try {
      const resposta = await fetch(url, {
        headers: { accept: "text/csv,text/plain", "user-agent": USER_AGENT },
        signal: controller.signal,
      });
      if (!resposta.ok) {
        const cos = await resposta.text().catch(() => "");
        throw new HttpError(resposta.status, url, cos);
      }
      return await resposta.text();
    } catch (error) {
      ultim = error;
      if (error instanceof HttpError && error.status < 500 && error.status !== 429) throw error;
      if (intent === reintents) break;
      await sleep(500 * 2 ** intent);
    } finally {
      clearTimeout(timer);
    }
  }
  throw ultim;
}

export type OpcionsAcords = {
  /**
   * Inclou el mandat 2019-2023. Per defecte no: la fitxa parla del mandat que
   * s'acaba, i el mandat anterior només cal per a les sèries de trajectòria.
   */
  incloureMandatAnterior?: boolean;
};

/**
 * Descarrega i normalitza les votacions del plenari de Barcelona.
 *
 * Retorna els acords ordenats per data ascendent, que és com es llegeixen a la
 * fitxa: primer el que es va fer, després el que s'acaba de fer.
 */
export async function fetchAcordsPlenari(
  opcions: OpcionsAcords = {},
): Promise<AcordPlenari[]> {
  const acords = parseMandatActual(await descarregaText(URL_MANDAT_ACTUAL));

  if (opcions.incloureMandatAnterior) {
    acords.push(...parseMandat20192023(await descarregaText(URL_MANDAT_2019_2023)));
  }

  return acords.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
}
