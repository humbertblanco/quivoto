import { normalize } from "../lib/text";
import { sleep } from "../lib/http";

/**
 * Càrrecs electes a seu-e.cat, el portal de transparència que el Consorci AOC
 * manté per als ajuntaments que no en tenen un de propi.
 *
 * D'aquí en surt l'única cosa que cap dataset obert no dona: **la cara de qui
 * governa el teu poble**. El cens de càrrecs de l'AOC porta noms, partits i
 * càrrecs dels 947 municipis, però no una sola fotografia; el mòdul de
 * «Càrrecs electes» de seu-e sí, i les serveix dins del propi HTML.
 *
 * Dues coses fan que això sigui explotable sense endevinar res:
 *
 *   · L'aparellament foto-persona és **exacte**. Cada regidor viu dins d'un
 *     `organ-principal-carrecs-item` que conté alhora el seu nom i el seu
 *     `getPhotoBytes/<id>`. No cal comparar noms per aproximació —que és el que
 *     ens hauria obligat a descartar la meitat dels casos.
 *   · El `<title>` de la pàgina porta el nom oficial de l'ajuntament, i això
 *     converteix el descobriment del slug en una comprovació, no en una aposta.
 *
 * Font: https://seu-e.cat · Consorci Administració Oberta de Catalunya.
 */

/** El camí del mòdul de càrrecs electes, igual per a tots els ens. */
const CAMI_CARRECS =
  "govern-obert-i-transparencia/informacio-institucional-i-organitzativa" +
  "/organitzacio-politica-i-retribucions/carrecs-electes";

const ARREL = "https://seu-e.cat/ca/web";

const USER_AGENT = "quivoto/0.1 (brúixola electoral municipal; hola@quivoto.cat)";

export function urlCarrecs(slug: string): string {
  return `${ARREL}/${slug}/${CAMI_CARRECS}`;
}

export function urlFoto(slug: string, fotoId: number): string {
  return `${ARREL}/${slug}/${CAMI_CARRECS}/-/grupPolitic/getPhotoBytes/${fotoId}`;
}

/**
 * El `carrecId` és global a tot seu-e, però el slug del camí no és decoratiu:
 * amb un slug inventat la petició de la imatge respon 404. Cal, doncs, demanar
 * sempre la foto pel slug del municipi a qui pertany.
 */

// ─────────────────────────────────────────────────────────────────────────────
// HTTP
// ─────────────────────────────────────────────────────────────────────────────

export class SeueError extends Error {
  constructor(readonly status: number, readonly url: string) {
    super(`HTTP ${status} a ${url}`);
    this.name = "SeueError";
  }
}

export type RespostaText = { status: number; html: string };

/**
 * GET pelat: seu-e serveix aquestes pàgines sense cookies ni capçaleres
 * especials. Els 404 es tornen com a resposta, no com a excepció, perquè
 * descobrir un slug consisteix precisament a provocar-ne uns quants.
 */
export async function fetchText(
  url: string,
  options: { retries?: number; timeoutMs?: number } = {},
): Promise<RespostaText> {
  const { retries = 3, timeoutMs = 60_000 } = options;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        headers: { accept: "text/html", "user-agent": USER_AGENT },
        signal: controller.signal,
        redirect: "follow",
      });
      // Un 4xx és una resposta vàlida per a qui prova candidats: no s'hi insisteix.
      if (response.status >= 400 && response.status < 500) {
        return { status: response.status, html: "" };
      }
      if (!response.ok) throw new SeueError(response.status, url);
      return { status: response.status, html: await response.text() };
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      await sleep(500 * 2 ** attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

/** Baixa una imatge. Torna `null` si no hi és, en comptes de petar. */
export async function fetchImatge(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<Uint8Array | null> {
  const { timeoutMs = 120_000 } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { accept: "image/*", "user-agent": USER_AGENT },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    // Alguns ens responen 200 amb un cos buit quan la foto no hi és.
    return bytes.byteLength > 0 ? bytes : null;
  } finally {
    clearTimeout(timer);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Descobriment del slug
// ─────────────────────────────────────────────────────────────────────────────

const ARTICLE_INICIAL = /^(l|el|la|els|les|es|sa|s)\s+|^(l|s)['’]\s*/i;

/** Treu el prefix «Ajuntament de…» si el nom ve de la font i no de la nostra taula. */
function nomNu(name: string): string {
  const rest = name.replace(/^Ajuntament\s+/i, "").trim();
  if (rest === name.trim()) return rest;
  for (const [prefix, article] of [
    [/^dels\s+/i, "els "],
    [/^del\s+/i, "el "],
    [/^de\s+les\s+/i, "les "],
    [/^de\s+la\s+/i, "la "],
    [/^de\s+l['’]\s*/i, "l'"],
    [/^de\s+sa\s+/i, "sa "],
    [/^de\s+s['’]\s*/i, "s'"],
  ] as ReadonlyArray<readonly [RegExp, string]>) {
    if (prefix.test(rest)) return rest.replace(prefix, article);
  }
  return rest.replace(/^(de\s+|d['’]\s*)/i, "").trim();
}

/** Text a slug de seu-e: sense accents, sense espais, sense apòstrofs. */
function aSlug(text: string, ambGuionets: boolean): string {
  const base = normalize(text).replace(/\s+/g, "");
  return ambGuionets ? base : base.replace(/-/g, "");
}

/**
 * Candidats de slug per a un municipi, del més probable al menys.
 *
 * El slug de seu-e **no es dedueix amb una regla**: verificat contra els 933
 * que existeixen, cap fórmula sola en passa del 96%. Els tres desajustos són
 * sistemàtics i per això es poden generar com a alternatives:
 *
 *   · L'**article** cau gairebé sempre («l'Albi» → `albi`), però no és segur.
 *   · Els **guionets** del topònim desapareixen («Vila-seca» → `vilaseca`).
 *   · Els municipis **fusionats** conserven el nom antic, el d'abans de la
 *     fusió: «Calonge i Sant Antoni» → `calonge`, «Bigues i Riells del Fai» →
 *     `biguesiriells`. També hi ha noms escapçats pel complement:
 *     «Cornellà de Llobregat» → `cornella`.
 *
 * Amb aquesta llista el slug bo hi surt en **933 de 933** casos, i en 824 és el
 * primer candidat: de mitjana costa 1,2 peticions per municipi.
 */
export function slugCandidates(name: string): string[] {
  const nom = nomNu(name);
  const senseArticle = nom.replace(ARTICLE_INICIAL, "").trim();
  const out: string[] = [];

  for (const variant of [senseArticle, nom]) {
    out.push(aSlug(variant, false));
    out.push(aSlug(variant, true));
  }
  // Escapçats: el nom d'abans de la fusió i els primers mots del topònim.
  for (const variant of [senseArticle, nom]) {
    const abansDeLaI = variant.split(/\s+i\s+/i)[0];
    if (abansDeLaI && abansDeLaI !== variant) out.push(aSlug(abansDeLaI, false));
    const mots = variant.split(/\s+/);
    for (const k of [1, 2, 3]) {
      if (mots.length > k) out.push(aSlug(mots.slice(0, k).join(" "), false));
    }
  }
  return [...new Set(out.filter((s) => s.length > 0))];
}

/**
 * El `<title>` diu de qui és la pàgina: «Càrrecs electes - Ajuntament de
 * Girona». És el que permet acceptar `calonge` per a «Calonge i Sant Antoni» i
 * alhora rebutjar un slug que existeix però és d'un altre poble —cosa que els
 * candidats escapçats, per construcció, farien tard o d'hora.
 */
export function titolMunicipi(html: string): string | null {
  const match = html.match(/<title>([^<]*)<\/title>/i);
  if (!match) return null;
  const titol = decodeEntities(match[1]!).replace(/\\(['’])/g, "$1").trim();
  const guio = titol.lastIndexOf(" - ");
  return guio === -1 ? titol : titol.slice(guio + 3).trim();
}

function mateixMunicipi(esperat: string, titol: string): boolean {
  return normalize(nomNu(esperat)) === normalize(nomNu(titol));
}

export type SlugTrobat = {
  slug: string;
  peticions: number;
  /**
   * El HTML de la pàgina de càrrecs, que ja s'ha hagut de baixar per validar el
   * slug. Buit quan el municipi és a seu-e però no publica aquesta pàgina.
   */
  html: string;
  /** Fals si el slug s'ha validat contra l'arrel de l'ens i no contra els càrrecs. */
  teCarrecs: boolean;
};

export function urlEns(slug: string): string {
  return `${ARREL}/${slug}`;
}

/**
 * Descobreix el slug de seu-e d'un municipi provant candidats i comprovant-los
 * amb una petició real. No hi ha llista publicada —el sitemap de seu-e respon
 * 500— i per això cal anar a buscar-ho així.
 */
export async function findSlug(name: string): Promise<string | null> {
  const trobat = await findSlugDetall(name);
  return trobat ? trobat.slug : null;
}

/**
 * Igual que `findSlug`, però torna també el HTML que ja s'ha hagut de baixar
 * per validar el slug. Qui vulgui els càrrecs no ha de tornar a demanar la
 * pàgina: són 947 peticions estalviades.
 */
export async function findSlugDetall(
  name: string,
  options: { delayMs?: number } = {},
): Promise<SlugTrobat | null> {
  const { delayMs = 0 } = options;
  const candidats = slugCandidates(name);
  let peticions = 0;

  const prova = async (url: string): Promise<string | null> => {
    if (delayMs > 0 && peticions > 0) await sleep(delayMs);
    peticions += 1;
    const { status, html } = await fetchText(url);
    if (status !== 200) return null;
    const titol = titolMunicipi(html);
    return titol && mateixMunicipi(name, titol) ? html : null;
  };

  for (const candidat of candidats) {
    const html = await prova(urlCarrecs(candidat));
    if (html !== null) return { slug: candidat, peticions, html, teCarrecs: true };
  }

  /*
   * Segona volta contra l'arrel de l'ens. Una vintena de municipis són a seu-e
   * però **no publiquen la pàgina de càrrecs electes**: l'arrel respon 200 i el
   * mòdul, 404. Validar només contra els càrrecs els donaria per inexistents,
   * que no és el mateix que «no en té» i porta a buscar-los cada vegada.
   *
   * Va després i no barrejada perquè el cas normal es resolgui a la primera:
   * així el descobriment segueix costant 1,1 peticions de mitjana.
   */
  for (const candidat of candidats) {
    const html = await prova(urlEns(candidat));
    if (html !== null) return { slug: candidat, peticions, html: "", teCarrecs: false };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lectura del HTML
// ─────────────────────────────────────────────────────────────────────────────

export type Carrec = {
  nom: string;
  carrec: string;
  /** Grup polític tal com l'escriu l'ajuntament; `null` si la pàgina no l'obre. */
  grup: string | null;
  /** Id de la fotografia a seu-e, o `null` si aquesta persona no en té. */
  fotoId: number | null;
  /** Fitxa de detall de la persona a seu-e. */
  fitxa: string | null;
  /** El marca la pàgina amb «Membre d'equip de govern». */
  equipGovern: boolean;
};

const ENTITATS: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ordf: "ª", ordm: "º", deg: "°", middot: "·", hellip: "…",
  ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (tot, cos: string) => {
    if (cos.startsWith("#")) {
      const codi = cos[1] === "x" || cos[1] === "X"
        ? Number.parseInt(cos.slice(2), 16)
        : Number.parseInt(cos.slice(1), 10);
      return Number.isFinite(codi) ? String.fromCodePoint(codi) : tot;
    }
    return ENTITATS[cos.toLowerCase()] ?? tot;
  });
}

/** Text visible d'un fragment de HTML, amb els espais col·lapsats. */
function textNet(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Les URL de seu-e porten un `?p_auth=<token>` de sessió. Sense ell responen
 * igual, i convé treure'l: el `robots.txt` del portal prohibeix expressament
 * les URL amb `p_auth`, i a més el token caduca, cosa que deixaria la fitxa
 * plena d'enllaços morts al cap de pocs dies.
 */
export function senseTokenAuth(url: string): string {
  return url.replace(/[?&]p_auth=[^&"'\s]*/g, "").trim();
}

const RE_GRUP = /<div class="organ-principal-grup-div">/g;
const RE_ITEM = /<div class="organ-principal-carrecs-item">/g;

function posicions(html: string, re: RegExp): number[] {
  const out: number[] = [];
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.push(m.index);
  return out;
}

/** Nom del grup polític que obre una secció. */
function nomGrup(bloc: string): string | null {
  const nom = bloc.match(/class="organ-principal-grup-div-nom[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  if (nom) {
    // El `<small>(8 càrrecs electes)</small>` és un recompte, no part del nom.
    const net = textNet(nom[1]!.replace(/<small>[\s\S]*?<\/small>/gi, " "));
    if (net) return net;
  }
  const alt = bloc.match(/alt="Logo ([^"]+)"/i);
  return alt ? decodeEntities(alt[1]!).trim() : null;
}

/**
 * Extreu els càrrecs electes de la pàgina.
 *
 * El HTML és pla: els grups no embolcallen els seus regidors, sinó que els
 * precedeixen. Per això cada càrrec s'assigna a l'últim `organ-principal-grup-div`
 * que li queda per sobre, en comptes de buscar-lo dins d'un contenidor que no hi és.
 */
export function parseCarrecs(html: string): Carrec[] {
  const grups = posicions(html, RE_GRUP).map((inici) => ({ inici, nom: null as string | null }));
  const items = posicions(html, RE_ITEM);

  // El nom del grup es llegeix fins on comença el primer càrrec seu.
  for (let i = 0; i < grups.length; i += 1) {
    const fi = Math.min(
      grups[i + 1]?.inici ?? html.length,
      items.find((p) => p > grups[i]!.inici) ?? html.length,
    );
    grups[i]!.nom = nomGrup(html.slice(grups[i]!.inici, fi));
  }

  const carrecs: Carrec[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const inici = items[i]!;
    const bloc = html.slice(inici, items[i + 1] ?? html.length);

    const nom = bloc.match(/class="organ-principal-carrecs-item-dades-nom"[^>]*>([\s\S]*?)<\/p>/i);
    if (!nom) continue;
    const nomNet = textNet(nom[1]!);
    if (!nomNet) continue;

    const carrec = bloc.match(/class="organ-principal-carrecs-item-dades-carrec"[^>]*>([\s\S]*?)<\/p>/i);

    /*
     * Quan una persona no té fotografia, seu-e omple el mateix forat amb el
     * logotip del partit (`grupLogoImg`). No es pot, doncs, agafar la primera
     * imatge del bloc: cal exigir `getPhotoBytes`, que és l'única que és una
     * cara. Els logotips, a més, tenen l'ús prohibit a l'avís legal del portal.
     */
    const foto = bloc.match(/grupPolitic\/getPhotoBytes\/(\d+)/);
    const fitxa = bloc.match(/href="([^"]*grupPolitic\/veureCarrec\/\d+[^"]*)"/i);

    // L'últim grup obert per sobre d'aquest càrrec.
    let grup: string | null = null;
    for (const g of grups) {
      if (g.inici < inici) grup = g.nom;
      else break;
    }

    carrecs.push({
      nom: nomNet,
      carrec: carrec ? textNet(carrec[1]!) : "",
      grup,
      fotoId: foto ? Number.parseInt(foto[1]!, 10) : null,
      fitxa: fitxa ? senseTokenAuth(decodeEntities(fitxa[1]!)) : null,
      equipGovern: /dades-eqgob-membre/.test(bloc),
    });
  }
  return carrecs;
}
