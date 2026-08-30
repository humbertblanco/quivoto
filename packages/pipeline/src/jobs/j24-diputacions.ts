import { municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { socrataAll } from "../adapters/socrata";
import { fetchText, parseCarrecs, senseTokenAuth, titolMunicipi, urlCarrecs } from "../adapters/seue";
import {
  campFitxa,
  creuaSegonsCarrecs,
  esAlcaldia,
  importEnEuros,
  MENSUALITATS_DIBA,
  parseRetribucionsDiba,
  PLENS,
  retribucioAnualDiba,
  taulesHtml,
  textNet,
  URL_DIBA,
} from "./j14-electes-cost";
import { sleep } from "../lib/http";
import { normalize, normalizePersonName, titleCase } from "../lib/text";
import { withRun, type Run } from "../lib/run";

/**
 * J24 — el segon sou: què paga cada diputació als seus diputats provincials.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PER QUÈ AQUESTA FEINA EXISTEIX SI JA HI HA LA J14
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * La J14 ja destapa el cas de Rubí: la fitxa de seu-e de l'alcaldessa diu
 * «retribució 17.027,70 €» i dos paràgrafs més avall confessa 90.940,08 € més
 * de la Diputació de Barcelona. La conclusió d'allò va ser que **l'import només
 * val si el publica qui el paga**, i per això la J14 en desa els de la Diputació
 * de Barcelona i els de la de Lleida.
 *
 * De les altres dues en deia que «no publiquen res». Comprovat el 30-08-2026,
 * **això és fals**, i el motiu és un detall de codi: la J14 busca els ens a
 * seu-e amb slugs deduïts del nom (`slugsSupramunicipals` genera
 * `diputaciotarragona` i `diptarragona`), i els slugs reals no s'hi assemblen:
 *
 *   · Diputació de Tarragona → `dipta`
 *   · Diputació de Girona    → `ddgi`
 *   · Diputació de Barcelona → `diba`
 *   · Diputació de Lleida    → `diputaciolleida`   ← l'únic que la regla encerta
 *
 * Amb els slugs bons, les quatre diputacions publiquen les retribucions dels
 * seus diputats, amb nom i cognoms, i tres de les quatre les publiquen en una
 * taula de HTML que es pot llegir. La J14 se'n perdia 54 de 130.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LES QUATRE FONTS, COMPROVADES DESCARREGANT-LES EL 30-08-2026
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * **Diputació de Barcelona** — `diba.cat`, HTML, sense taula d'imports per
 * persona: publica un codi retributiu (A1…A5) per electe i, a part, la taula
 * que el converteix en euros bruts mensuals (A1 8.144,08 · A2 7.295,75 ·
 * A3 6.495,72, per 14 mensualitats). 51 diputats. La conversió quadra a l'euro
 * amb el que declara la fitxa de Rubí (A3 × 14 = 90.940,08 €). El lector d'això
 * és el de la J14 i aquí es reaprofita tal qual, no se'n fa un de nou.
 *
 * **Diputació de Girona** — seu-e `ddgi`, mòdul «Retribucions alts càrrecs»
 * (`retribucions-alts-carrecs-207`), HTML, taula de 27 diputats amb columnes
 * Nom · Cognoms · Càrrec · Data de nomenament · Dedicació · Retribucions brutes
 * anuals · Indemnització màxima per assistències. La pàgina data la seva última
 * actualització: 05-02-2026. Mostra real: «Miquel · Noguer Planas · President ·
 * Exclusiva · 91.526,82».
 *
 * **Diputació de Tarragona** — seu-e `dipta`, mateix mòdul
 * (`retribucions-alts-carrecs-198`), HTML, taula de 27 diputats del mandat
 * 2023-2027 amb columnes Relació de diputats · Grup polític · Govern/Oposició ·
 * Relació de càrrecs · Règim de dedicació · Retribucions anuals brutes ·
 * Indemnització màxima bruta per assistències. Mostra real: «Noemí Llauradó i
 * Sans · ERC · Govern · Presidenta · exclusiva · 93.810,42 € · No aplica».
 *
 * **Diputació de Lleida** — seu-e `diputaciolleida`, mòdul de càrrecs electes,
 * HTML: 25 càrrecs, cadascun amb fitxa pròpia i el camp «Retribució anual
 * bruta». Mostra real, la del president: «Retribució anual bruta: 82.081.76 €»
 * —amb punt de milers i punt decimal, que és per què l'import es llegeix amb
 * `importEnEuros` de la J14 i no amb un `parseFloat`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL QUE S'HI DESA I EL QUE NO
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   · **Un import només si el paga la diputació que el publica.** L'ens, la
 *     URL, el format i la data de consulta van dins de cada import.
 *   · **Mai una suma.** Un regidor que és diputat provincial cobra de dues
 *     administracions; la suma no l'ha publicada mai ningú i aquí no es fa.
 *   · **La indemnització màxima per assistències no és un sou.** Girona i
 *     Tarragona publiquen, per als diputats sense dedicació, un **sostre**
 *     anual d'indemnitzacions, no el que han cobrat. Va a un camp propi, dit
 *     pel seu nom, i mai al camp de retribució: dir que un diputat sense
 *     dedicació de Girona «cobra 52.775,24 €» seria inventar-s'ho.
 *   · **Aparellament pel nom normalitzat i només si és inequívoc.** Si el nom
 *     d'un diputat lliga amb més d'un regidor de Catalunya, o si dos diputats
 *     de la mateixa diputació normalitzen igual, no se li atribueix res i queda
 *     com a incidència. Una atribució errònia aquí diria que una persona cobra
 *     el que no cobra, que és el pitjor error que pot fer aquesta fitxa.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Fonts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Els slugs de seu-e de les quatre diputacions, comprovats un a un el
 * 30-08-2026 contra el `<title>` de la seva pàgina. No es dedueixen del nom: cap
 * regla els encerta i inventar-los és el que ha fet que la J14 donés per mudes
 * dues diputacions que parlen.
 */
export const SLUGS_DIPUTACIONS: Readonly<Record<string, string>> = {
  "Diputació de Barcelona": "diba",
  "Diputació de Girona": "ddgi",
  "Diputació de Lleida": "diputaciolleida",
  "Diputació de Tarragona": "dipta",
};

/** El mòdul de seu-e on Girona i Tarragona publiquen la taula de retribucions. */
export const URL_ALTS_CARRECS: Readonly<Record<string, string>> = {
  "Diputació de Girona":
    "https://seu-e.cat/ca/web/ddgi/govern-obert-i-transparencia/informacio-institucional-i-organitzativa" +
    "/organitzacio-politica-i-retribucions/retribucions-alts-carrecs-207",
  "Diputació de Tarragona":
    "https://seu-e.cat/ca/web/dipta/govern-obert-i-transparencia/informacio-institucional-i-organitzativa" +
    "/organitzacio-politica-i-retribucions/retribucions-alts-carrecs-198",
};

/**
 * Quants diputats hi ha a cada diputació segons el cens de la Generalitat
 * («Càrrecs electes dels ens locals», `m5nd-xjza`, consultat el 30-08-2026).
 *
 * Serveix d'invariant, no de dada: aquell conjunt té les 130 files però amb el
 * nom buit, i per tant només diu **quants n'hi ha d'haver**. Si el lector d'una
 * pàgina en treu menys, no és que la diputació hagi aprimat el ple: és que la
 * pàgina ha canviat de forma i el que en surt ja no és de fiar.
 */
export const DIPUTATS_AL_CENS: Readonly<Record<string, number>> = {
  "Diputació de Barcelona": 51,
  "Diputació de Girona": 27,
  "Diputació de Lleida": 25,
  "Diputació de Tarragona": 27,
};

/**
 * La llicència amb què cada font es deixa reutilitzar, comprovada al seu avís
 * legal el 30-08-2026. No és el mateix per a totes i per això va per font:
 *
 *   · Els portals de seu-e (Girona, Lleida, Tarragona) remeten a la Llei
 *     37/2007 de reutilització de la informació del sector públic: reutilització
 *     lliure, amb l'obligació de citar la font i de no alterar el contingut.
 *   · `diba.cat` **no declara cap llicència oberta**. El seu avís legal diu que
 *     «queda totalment prohibit distribuir, copiar, modificar o trametre tant el
 *     contingut de les pàgines com el codi» sense autorització escrita. Aquí no
 *     se'n copia la pàgina: se'n cita una xifra amb l'enllaç a l'original, que
 *     és el que la mateixa Diputació publica per obligació de transparència.
 *     Queda dit perquè qui reutilitzi això ho sàpiga.
 */
export const LLICENCIA_SEUE =
  "Reutilització segons la Llei 37/2007 (LRISP): lliure citant la font i sense alterar-ne el contingut";
export const LLICENCIA_DIBA =
  "L'avís legal de diba.cat no declara cap llicència oberta; aquí només se'n cita la xifra amb l'enllaç a l'original";

/**
 * L'AMB no hi és, i no per oblit. Comprovat el 30-08-2026 a
 * `amb.cat/web/amb/administracio-metropolitana/empleatspublics-i-retribucions/retribucions`,
 * ho diu ella mateixa amb totes les lletres: «Els càrrecs electes de l'AMB no
 * desenvolupen les seves responsabilitats institucionals en règim de dedicació
 * exclusiva ni parcial i, per tant, no perceben retribucions per l'exercici del
 * seu càrrec». Només hi ha indemnitzacions per assistència efectiva (Consell
 * Metropolità 368 €, Junta de Govern 420 €, Junta de Portaveus 578 €,
 * comissions informatives 168 €, acord del Consell Metropolità del 26-09-2024).
 *
 * Un preu per sessió no és un import anual i no se'n pot fer un sense saber a
 * quantes sessions ha anat cadascú. Per això de l'AMB no en surt cap euro
 * atribuït a ningú: el que se'n desa és el fet que no en paga cap de fix.
 */
export const AMB_SENSE_RETRIBUCIO = {
  ens: "Àrea Metropolitana de Barcelona",
  url: "https://www.amb.cat/web/amb/administracio-metropolitana/empleatspublics-i-retribucions/retribucions",
  motiu:
    "els càrrecs electes de l'AMB no tenen dedicació exclusiva ni parcial i no perceben cap retribució pel càrrec: " +
    "només indemnitzacions per assistència efectiva, que no són un import anual",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Funcions pures: la taula de retribucions de seu-e
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Els euros d'una cel·la de la taula.
 *
 * Les dues taules escriuen l'import de manera diferent —Tarragona hi posa el
 * símbol («93.810,42 €») i Girona no («91.526,82»)— i totes dues fan servir
 * cel·les buides, guions i «No aplica» per dir «aquí no hi ha xifra». La
 * lectura del número la fa `importEnEuros` de la J14, que ja sap desfer els
 * casos lletjos del punt de milers; aquí només se li dona el símbol que la
 * cel·la de Girona no porta, i es guarda que un text sense cap dígit no és un
 * zero sinó un «no n'hi ha».
 */
export function eurosDeCella(text: string): number | null {
  const net = textNet(text).replace(/ /g, " ").trim();
  if (!/\d/.test(net)) return null;
  return importEnEuros(/€|euros?\b/i.test(net) ? net : `${net} €`);
}

/** Què vol dir cada columna de la taula, segons el que digui la seva capçalera. */
export type ColumnesTaula = {
  nom: number;
  cognoms: number;
  carrec: number;
  dedicacio: number;
  retribucio: number;
  assistencies: number;
};

/**
 * Localitza les columnes pel títol i no per la posició.
 *
 * Les dues diputacions publiquen la mateixa informació amb capçaleres diferents
 * («Nom» / «Relació de diputats», «Dedicació» / «Règim de dedicació») i amb un
 * nombre de columnes diferent —Girona parteix el nom en dues. Amb índexs fixos
 * caldrien dos lectors, i el dia que una d'elles hi afegís una columna el
 * lector passaria a desar el grup polític com si fos un import.
 */
export function columnesTaula(capcalera: readonly string[]): ColumnesTaula | null {
  const cols: ColumnesTaula = { nom: -1, cognoms: -1, carrec: -1, dedicacio: -1, retribucio: -1, assistencies: -1 };
  capcalera.forEach((cru, i) => {
    const c = normalize(textNet(cru));
    if (!c) return;
    // L'ordre importa: «indemnitzacio maxima per assistencies» no és cap
    // retribució, i s'ha de descartar abans de mirar si parla de diners.
    if (c.includes("assistencies") || c.includes("assistencia")) {
      if (cols.assistencies === -1) cols.assistencies = i;
      return;
    }
    if (c.includes("retribuc")) {
      if (cols.retribucio === -1) cols.retribucio = i;
      return;
    }
    if (c.includes("dedicacio")) {
      if (cols.dedicacio === -1) cols.dedicacio = i;
      return;
    }
    if (c === "cognoms") {
      cols.cognoms = i;
      return;
    }
    if (c === "nom" || /^relacio de diputat/.test(c) || c === "diputat" || c === "diputats") {
      if (cols.nom === -1) cols.nom = i;
      return;
    }
    // «Data de nomenament Diputat/da» també conté «carrec»? No: aquesta guarda
    // és per a «Relació de càrrecs» i «Càrrec», i es mira l'última perquè cap
    // altra capçalera de les dues taules porta la paraula.
    if (c.includes("carrec") && cols.carrec === -1) cols.carrec = i;
  });
  // Sense nom i sense import no hi ha res a publicar, i llavors val més tornar
  // null que una taula mig entesa.
  return cols.nom === -1 || cols.retribucio === -1 ? null : cols;
}

export type DiputatPublicat = {
  nom: string;
  carrec: string;
  dedicacio: string | null;
  /** Euros bruts a l'any que la diputació diu que li paga. */
  retribucioAnualBruta: number | null;
  /** Sostre anual d'indemnitzacions per assistència. **No és un sou.** */
  maximPerAssistencies: number | null;
};

export type TaulaAltsCarrecs = {
  diputats: DiputatPublicat[];
  /** Data que la mateixa pàgina es posa, en format dd-mm-aaaa. */
  actualitzat: string | null;
  /** Mandat que la pàgina diu que retrata, si el diu. */
  mandat: string | null;
};

/**
 * Llegeix la taula de «Retribucions alts càrrecs» d'un ens a seu-e.
 *
 * Busca la fila de capçalera dins de cada taula en comptes de suposar que és la
 * primera: la de Girona té tres files de títol i de text abans, i agafar la
 * primera fila com a capçalera hi donava una taula de zero diputats.
 */
export function parseAltsCarrecsSeue(html: string): TaulaAltsCarrecs {
  const diputats: DiputatPublicat[] = [];

  for (const taula of taulesHtml(html)) {
    let cols: ColumnesTaula | null = null;
    for (const fila of taula) {
      if (cols === null) {
        cols = columnesTaula(fila);
        continue;
      }
      const nom = textNet(fila[cols.nom] ?? "");
      const cognoms = cols.cognoms === -1 ? "" : textNet(fila[cols.cognoms] ?? "");
      const complet = [nom, cognoms].filter((p) => p).join(" ").trim();
      // Les taules porten files buides de separació i, a Tarragona, una nota al
      // peu dins de la mateixa taula. Sense nom no hi ha persona.
      if (complet.length < 4 || !/[a-zàéèíóòúüïçñ]/i.test(complet)) continue;

      const dedicacio = cols.dedicacio === -1 ? "" : textNet(fila[cols.dedicacio] ?? "");
      diputats.push({
        nom: complet,
        carrec: cols.carrec === -1 ? "" : textNet(fila[cols.carrec] ?? ""),
        dedicacio: dedicacio || null,
        retribucioAnualBruta: eurosDeCella(fila[cols.retribucio] ?? ""),
        maximPerAssistencies: cols.assistencies === -1 ? null : eurosDeCella(fila[cols.assistencies] ?? ""),
      });
    }
  }

  const text = textNet(html);
  const actualitzat = text.match(/ltima actualitzaci[^\d]{0,12}(\d{2}-\d{2}-\d{4})/i);
  const mandat = text.match(/\bMandat\s+(\d{4}\s*-\s*\d{4})/i);
  return {
    diputats,
    actualitzat: actualitzat ? actualitzat[1]! : null,
    mandat: mandat ? mandat[1]!.replace(/\s+/g, "") : null,
  };
}

/**
 * La retribució que una fitxa de càrrec de seu-e publica, en euros.
 *
 * És el mateix camp `carrec-retribucio` que a un **ajuntament** no s'ha de
 * creure mai —a Rubí en publica el 16 % del que cobra l'alcaldessa—, i que a una
 * **diputació** sí, perquè allà el càrrec és l'únic que paga aquell ens i la
 * xifra la publica qui la paga. La diferència no és del camp: és de qui el
 * respon.
 */
export function retribucioDeFitxa(html: string): number | null {
  const text = campFitxa(html, "carrec-retribucio");
  return text === null ? null : importEnEuros(text);
}

// ─────────────────────────────────────────────────────────────────────────────
// Lectura de cada diputació
// ─────────────────────────────────────────────────────────────────────────────

export type FontDiputacio = {
  nom: string;
  url: string;
  /** CSV, JSON, HTML… El que hi ha, dit tal com és. */
  format: string;
  llicencia: string;
  consultat: string;
};

export type LecturaDiputacio = {
  ens: string;
  diputats: DiputatPublicat[];
  font: FontDiputacio;
  /** Nota del lector: d'on surt l'import i què hi falta. */
  metode: string;
};

const avui = (): string => new Date().toISOString().slice(0, 10);

/** Girona i Tarragona: una taula de HTML amb l'import al costat del nom. */
async function llegeixTaula(ens: string, run: Run): Promise<LecturaDiputacio | null> {
  const url = URL_ALTS_CARRECS[ens]!;
  const font: FontDiputacio = { nom: ens, url, format: "HTML", llicencia: LLICENCIA_SEUE, consultat: avui() };
  let html = "";
  try {
    const resposta = await fetchText(url);
    if (resposta.status !== 200 || !resposta.html) throw new Error(`HTTP ${resposta.status}`);
    html = resposta.html;
  } catch (error) {
    await run.issue({ kind: "diputacio_font_inaccessible", severity: "alta", entity: ens, detail: { url, error: String(error) } });
    return null;
  }

  const taula = parseAltsCarrecsSeue(html);
  if (taula.diputats.length === 0) {
    await run.issue({
      kind: "diputacio_taula_illegible",
      severity: "alta",
      entity: ens,
      detail: { url, efecte: "la pàgina ha canviat de forma: no se n'atribueix cap import a ningú" },
    });
    return null;
  }
  return {
    ens,
    diputats: taula.diputats,
    font,
    metode:
      `taula de retribucions del portal de transparència${taula.mandat ? `, mandat ${taula.mandat}` : ""}` +
      `${taula.actualitzat ? `, actualitzada el ${taula.actualitzat}` : ""}`,
  };
}

/** Lleida: el mòdul de càrrecs electes, una fitxa per persona. */
async function llegeixLleida(run: Run): Promise<LecturaDiputacio | null> {
  const ens = "Diputació de Lleida";
  const url = urlCarrecs(SLUGS_DIPUTACIONS[ens]!);
  const font: FontDiputacio = { nom: ens, url, format: "HTML", llicencia: LLICENCIA_SEUE, consultat: avui() };

  let html = "";
  try {
    const resposta = await fetchText(url);
    if (resposta.status !== 200 || !resposta.html) throw new Error(`HTTP ${resposta.status}`);
    html = resposta.html;
  } catch (error) {
    await run.issue({ kind: "diputacio_font_inaccessible", severity: "alta", entity: ens, detail: { url, error: String(error) } });
    return null;
  }
  // El títol diu de qui és la pàgina. Sense comprovar-ho, un dia de redirecció
  // desaria els sous d'un altre ens amb el nom d'aquest.
  const titol = titolMunicipi(html);
  if (!titol || normalize(titol) !== normalize(ens)) {
    await run.issue({ kind: "diputacio_pagina_inesperada", severity: "alta", entity: ens, detail: { url, titol } });
    return null;
  }

  const diputats: DiputatPublicat[] = [];
  for (const carrec of parseCarrecs(html)) {
    if (!carrec.fitxa) continue;
    let retribucio: number | null = null;
    try {
      const fitxa = await fetchText(senseTokenAuth(carrec.fitxa));
      if (fitxa.status === 200 && fitxa.html) retribucio = retribucioDeFitxa(fitxa.html);
    } catch (error) {
      await run.issue({ kind: "diputacio_fitxa_error", severity: "baixa", entity: carrec.nom, detail: { error: String(error) } });
    }
    diputats.push({
      nom: carrec.nom,
      carrec: carrec.carrec,
      dedicacio: null,
      retribucioAnualBruta: retribucio,
      maximPerAssistencies: null,
    });
    // Són 25 peticions a un servei públic; no hi ha cap pressa.
    await sleep(150);
  }

  if (diputats.length === 0) {
    await run.issue({ kind: "diputacio_taula_illegible", severity: "alta", entity: ens, detail: { url } });
    return null;
  }
  return { ens, diputats, font, metode: "camp «Retribució anual bruta» de la fitxa de cada càrrec electe a seu-e" };
}

/**
 * Barcelona: codi retributiu per persona i taula que el converteix en euros.
 *
 * El lector és el de la J14 i aquí no se'n fa cap de nou: la pàgina és la
 * mateixa i duplicar-lo voldria dir tenir dos llocs on arreglar-la el dia que
 * canviï. El que aquesta feina hi afegeix és la resta de Catalunya.
 */
async function llegeixBarcelona(run: Run): Promise<LecturaDiputacio | null> {
  const ens = "Diputació de Barcelona";
  const font: FontDiputacio = {
    nom: ens,
    url: URL_DIBA,
    format: "HTML",
    llicencia: LLICENCIA_DIBA,
    consultat: avui(),
  };
  let html = "";
  try {
    const resposta = await fetchText(URL_DIBA);
    if (resposta.status !== 200 || !resposta.html) throw new Error(`HTTP ${resposta.status}`);
    html = resposta.html;
  } catch (error) {
    await run.issue({ kind: "diputacio_font_inaccessible", severity: "alta", entity: ens, detail: { url: URL_DIBA, error: String(error) } });
    return null;
  }

  const dades = parseRetribucionsDiba(html);
  if (dades.electes.length === 0 || dades.tarifes.size === 0) {
    await run.issue({
      kind: "diputacio_taula_illegible",
      severity: "alta",
      entity: ens,
      detail: { electes: dades.electes.length, tarifes: dades.tarifes.size },
    });
    return null;
  }

  const diputats: DiputatPublicat[] = dades.electes.map((e) => ({
    nom: e.nom,
    carrec: e.carrec,
    dedicacio:
      e.dedicacio === "exclusiva"
        ? "dedicació exclusiva"
        : `dedicació parcial${e.percentatge ? ` (${e.percentatge} %)` : ""}`,
    retribucioAnualBruta: retribucioAnualDiba(e, dades.tarifes),
    maximPerAssistencies: null,
  }));
  /*
   * Els que no tenen dedicació cobren per sessió i no tenen cap import anual
   * publicat. Hi són igualment, amb la xifra a null: que un diputat provincial
   * no cobri sou fix també és una resposta, i amagar-lo el faria semblar un
   * regidor sense segon càrrec.
   */
  for (const persona of dades.perAssistencia) {
    diputats.push({
      nom: persona.nom,
      carrec: persona.carrec,
      dedicacio: "sense dedicació: cobra per assistència",
      retribucioAnualBruta: null,
      maximPerAssistencies: null,
    });
  }

  return {
    ens,
    diputats,
    font,
    metode:
      `codi retributiu per electe convertit amb la taula de la mateixa pàgina, ${MENSUALITATS_DIBA} mensualitats` +
      `${dades.anyTarifa ? ` (taula del ${dades.anyTarifa})` : ""}`,
  };
}

/** Comprova que el recompte quadri amb el cens de la Generalitat. */
async function comprovaRecompte(lectura: LecturaDiputacio, run: Run): Promise<void> {
  const esperats = DIPUTATS_AL_CENS[lectura.ens];
  if (esperats === undefined || lectura.diputats.length === esperats) return;
  await run.issue({
    kind: "diputacio_recompte_diferent",
    severity: "mitjana",
    entity: lectura.ens,
    detail: {
      llegits: lectura.diputats.length,
      censGeneralitat: esperats,
      efecte: "la pàgina no dona el ple sencer: el que se'n desa pot ser incomplet",
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// La feina
// ─────────────────────────────────────────────────────────────────────────────

type FilaPle = { codi_10: string; nom_ens: string; tipus_ens: string; nom?: string; carrec?: string };

/** El segon càrrec d'una persona, amb qui el paga sempre enganxat a l'import. */
export type SegonCarrec = {
  ens: string;
  tipus: "diputació";
  carrec: string;
  dedicacio: string | null;
  retribucioAnualBruta: number | null;
  /** Sostre d'indemnitzacions per assistència. Mai un sou; mai sumable. */
  maximPerAssistencies: number | null;
  /** Per què no hi ha import, quan no n'hi ha. */
  motiu: string | null;
  font: FontDiputacio;
  metode: string;
};

export type PersonaAmbSegonSou = {
  nom: string;
  carrecMunicipal: string;
  alcaldia: boolean;
  diputacio: SegonCarrec;
};

/**
 * Per què un diputat sense import publicat no en té, dit amb les paraules de la
 * seva font. Un buit sense explicació es llegeix com «no cobra res», que no és
 * el que diu cap d'aquestes pàgines.
 */
export function motiuSenseImport(ens: string, diputat: DiputatPublicat): string | null {
  if (diputat.retribucioAnualBruta !== null) return null;
  if (diputat.maximPerAssistencies !== null) {
    return (
      `${ens} no li paga cap retribució pel càrrec: sense dedicació, en publica un màxim anual ` +
      "d'indemnitzacions per assistència, que és un sostre i no el que ha cobrat"
    );
  }
  return `${ens} no publica cap import anual per a aquesta persona`;
}

export async function j24Diputacions(db: Db): Promise<void> {
  await withRun(db, "J24 sous de les diputacions", async (run) => {
    const perCodiEns = new Map<string, number>();
    for (const m of await db.select().from(municipalities)) perCodiEns.set(m.codiEns, m.id);
    // El codi d'ens de la província de Barcelona comença per zero i Socrata el
    // torna com a text: sense el padStart, 311 municipis quedarien orfes.
    const resol = (codi: unknown): number | undefined => perCodiEns.get(String(codi).padStart(10, "0"));

    const files = await socrataAll<FilaPle>(PLENS, { select: "codi_10,nom_ens,tipus_ens,nom,carrec" });
    run.rowsIn = files.length;
    const regidors = files
      .filter((f) => f.tipus_ens === "Municipis" && f.nom)
      .map((f) => ({ ...f, nom: f.nom! }));
    run.say(`${regidors.length} regidors municipals per creuar`);

    const lectures: LecturaDiputacio[] = [];
    for (const ens of Object.keys(SLUGS_DIPUTACIONS)) {
      const lectura =
        ens === "Diputació de Barcelona"
          ? await llegeixBarcelona(run)
          : ens === "Diputació de Lleida"
            ? await llegeixLleida(run)
            : await llegeixTaula(ens, run);
      if (!lectura) continue;
      await comprovaRecompte(lectura, run);
      lectures.push(lectura);
      const ambImport = lectura.diputats.filter((d) => d.retribucioAnualBruta !== null).length;
      run.say(
        `${lectura.ens}: ${lectura.diputats.length} diputats llegits, ${ambImport} amb retribució anual publicada`,
      );
    }

    const perMunicipi = new Map<number, PersonaAmbSegonSou[]>();
    let ambigus = 0;
    let lligats = 0;
    let ambImportTotal = 0;

    for (const lectura of lectures) {
      /*
       * L'aparellament: nom normalitzat, i **només si és inequívoc a totes dues
       * bandes**. `creuaSegonsCarrecs` descarta tant el diputat que lliga amb
       * dos regidors de Catalunya com els dos diputats que normalitzen igual.
       * Aquí és on una drecera diria que algú cobra el que no cobra.
       */
      const creuament = creuaSegonsCarrecs(regidors, lectura.diputats);
      ambigus += creuament.ambigusSupramunicipals.length;
      for (const nom of creuament.ambigusSupramunicipals) {
        await run.issue({
          kind: "diputat_nom_ambigu",
          severity: "mitjana",
          entity: `${lectura.ens} · ${nom}`,
          detail: { efecte: "el nom no identifica una sola persona: no se li atribueix cap sou de la diputació" },
        });
      }

      for (const { municipal, supramunicipal } of creuament.lligams) {
        const municipalityId = resol(municipal.codi_10);
        if (!municipalityId) continue;
        lligats += 1;
        if (supramunicipal.retribucioAnualBruta !== null) ambImportTotal += 1;
        const llista = perMunicipi.get(municipalityId) ?? [];
        llista.push({
          nom: titleCase(municipal.nom),
          carrecMunicipal: municipal.carrec ?? "Regidor",
          alcaldia: esAlcaldia(municipal.carrec ?? ""),
          diputacio: {
            ens: lectura.ens,
            tipus: "diputació",
            carrec: supramunicipal.carrec,
            dedicacio: supramunicipal.dedicacio,
            retribucioAnualBruta: supramunicipal.retribucioAnualBruta,
            maximPerAssistencies: supramunicipal.maximPerAssistencies,
            motiu: motiuSenseImport(lectura.ens, supramunicipal),
            font: lectura.font,
            metode: lectura.metode,
          },
        });
        perMunicipi.set(municipalityId, llista);
      }
    }

    const catalunya = {
      diputacionsLlegides: lectures.map((l) => ({
        ens: l.ens,
        diputats: l.diputats.length,
        ambRetribucioPublicada: l.diputats.filter((d) => d.retribucioAnualBruta !== null).length,
        font: l.font,
        metode: l.metode,
      })),
      diputatsQueTambeSonRegidors: lligats,
      ambImportPublicat: ambImportTotal,
      nomsAmbigusDescartats: ambigus,
      amb: AMB_SENSE_RETRIBUCIO,
      consultat: avui(),
    };

    for (const [municipalityId, llista] of perMunicipi) {
      llista.sort((a, b) => a.nom.localeCompare(b.nom, "ca"));
      await desa(db, municipalityId, "sousDiputacions", {
        persones: llista,
        alcaldia: llista.find((p) => p.alcaldia) ?? null,
        catalunya,
        advertiment:
          "Cada import és el que publica la diputació que el paga, i només ella. Aquí no s'hi suma cap total: " +
          "el que cobra una persona de l'ajuntament i de la diputació alhora no ho ha publicat mai ningú. " +
          "El «màxim per assistències» és un sostre anual, no el que ha cobrat, i per això va en un camp a part.",
      });
      run.rowsOut += 1;
    }

    run.say(`${lligats} diputats provincials que també són regidors, ${ambImportTotal} amb sou publicat per la diputació`);
    run.say(`${ambigus} noms ambigus descartats · ${run.rowsOut} municipis amb algú al ple d'una diputació`);
    return {
      municipis: run.rowsOut,
      lligats,
      ambImportTotal,
      ambigus,
      diputacions: catalunya.diputacionsLlegides.map((d) => `${d.ens}: ${d.ambRetribucioPublicada}/${d.diputats}`),
    };
  });
}

async function desa(db: Db, municipalityId: number, kind: string, data: unknown): Promise<void> {
  await db
    .insert(municipalityMetrics)
    .values({ municipalityId, kind, data })
    .onConflictDoUpdate({
      target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
      set: { data, computedAt: new Date() },
    });
}
