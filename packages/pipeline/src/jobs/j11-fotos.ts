import { execFile } from "node:child_process";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";
import { municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import {
  fetchImatge,
  fetchText,
  findSlugDetall,
  parseCarrecs,
  slugCandidates,
  urlCarrecs,
  urlFoto,
  type Carrec,
} from "../adapters/seue";
import { withRun } from "../lib/run";

/**
 * J11 — les cares de qui governa.
 *
 * La radiografia explica què s'ha fet aquests quatre anys al teu poble, i qui
 * ho ha fet té nom i cognoms. Fins ara només en teníem el nom: el cens de
 * càrrecs electes de l'AOC cobreix els 947 municipis però no porta ni una sola
 * fotografia. Les fotos són al mòdul de «Càrrecs electes» de seu-e.cat, i són
 * la diferència entre una llista de noms i reconèixer el regidor que et vas
 * trobar al mercat.
 *
 * Tres decisions que marquen la feina:
 *
 *   · **Tot o res per municipi.** Una fitxa amb la meitat de les cares i la
 *     meitat de silueta buida assenyala qui no té foto, i això no és
 *     informació: és un greuge. Per això la mètrica desa la `cobertura`, i és
 *     la fitxa qui decideix si les ensenya. Dels 464 municipis on el mòdul es
 *     llegeix, 217 tenen totes les cares, 129 només algunes i 118 cap.
 *   · **Miniatures, no un mirall.** Els originals de seu-e no estan
 *     normalitzats —de 120×151 a 4000×4000— i sumen uns 5,6 GB. Se'n desen
 *     dues mides quadrades i prou; els originals no es guarden.
 *   · **Ni borrós ni inflat.** La miniatura no s'estira mai per sobre de
 *     l'original: si la cara ve a 120 px, la «de 320» surt a 120 i el navegador
 *     ja l'encabeix. Inventar-se píxels només fa el fitxer més gros.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Els vint municipis més grans, oberts un a un (30 d'agost del 2026)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * On mira més gent és on més mal fa una fitxa sense cares, i per això ara la
 * feina va **de gran a petit** i informa municipi a municipi de què hi falta i
 * per què. Les vint primeres pàgines s'han obert una per una:
 *
 *   · **Nou surten del mòdul de seu-e**: Badalona, Sabadell i Girona (27), i
 *     Sant Cugat, Rubí, Castelldefels, Viladecans, el Prat de Llobregat i Sant
 *     Boi (25 cadascun). El lector no s'ha hagut de tocar: allà on el mòdul hi
 *     és, llegeix 27 de 27. El que fallava era el que ve després.
 *   · **Badalona es quedava a 26 de 27 per un perfil de color.** El retrat que
 *     faltava és un JPEG en **CMYK** amb perfil d'impremta (Coated FOGRA39):
 *     `cwebp` el rebutja amb «Unsupported color conversion request» i la cara
 *     es perdia com si el fitxer fos corrupte. Ara la miniatura es passa a
 *     sRGB abans de convertir-la i surt.
 *   · **Sant Boi de Llobregat en tenia 25 i les llençàvem totes.** Les serveix
 *     a 120×151 px —mesurades una a una: les 25 fan exactament 120×151— i el
 *     llindar de nitidesa era 160. El retrat més gran que dibuixa la fitxa fa
 *     120 px (`regidor.ts`), o sigui que 160 no protegia ningú de res: només
 *     deixava un ajuntament de 85.610 habitants sense cap cara. Ara el llindar
 *     és 120, el mateix que ja feia servir J13 per a Barcelona.
 *   · **Vuit tenen la pàgina però el mòdul buit**: l'Hospitalet, Lleida,
 *     Tarragona, Mataró, Santa Coloma de Gramenet, Cornellà, Manresa i Vilanova
 *     i la Geltrú serveixen un Tableau que ve de municat.gencat.cat i que no
 *     porta ni una fotografia. Quatre les rescata J13 anant a cal ajuntament;
 *     Mataró no, perquè el seu avís legal ho prohibeix i això és una decisió,
 *     no un oblit.
 *   · **Barcelona i Terrassa no hi són**: 404 al portal. Barcelona la cobreix
 *     J13 amb el conjunt «carrecs-electes-comissionats-i-gerents» del portal de
 *     dades obertes municipal, CC BY 4.0 i amb la URL de la foto a cada fila:
 *     comprovat que respon i que porta les cares dels 41 electes. És, de llarg,
 *     la millor font de totes, i per això la procedència es desa al costat de
 *     cada foto en comptes de barrejar-la amb les de l'AOC.
 *   · **Reus respon 200 amb 2 kB**: un testimoni de Dynatrace en comptes de la
 *     pàgina, tant a l'arrel de l'ens com al mòdul. No és cap canvi de format:
 *     és que d'allà no en surt res sense navegador. Abans això es comptava com
 *     si Reus no fos a seu-e; ara es diu pel seu nom a l'informe.
 *
 * Balanç dels vint: **13 tenen cara** —nou per seu-e (Sant Boi hi entra en
 * baixar el llindar) i quatre per J13— i **set es queden sense font
 * reutilitzable**: Terrassa, Santa Coloma, Reus, Cornellà, Manresa, Vilanova i
 * Mataró. De les set, sis són manca de font i la setena, Mataró, és una
 * prohibició escrita a l'avís legal.
 *
 * El conjunt, abans d'aquesta passada: 3.520 fotos de 4.807 càrrecs en 464
 * municipis (217 amb cobertura completa, 129 parcial, 118 sense cap). Les dues
 * correccions en recuperen 26 comptades una a una —25 a Sant Boi i la de
 * Badalona— i quantes més surtin de la resta de municipis ho diran els
 * comptadors `petites` i `fotoFallida` de la propera execució, que abans les
 * amuntegaven sense dir de qui eren.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * I una regla que no es negocia: **cap foto s'aparella per nom**. La imatge i
 * la persona surten del mateix bloc de HTML o no es desa. Val més una fitxa
 * sense cara que la cara d'algú altre.
 *
 * Font: https://seu-e.cat · Consorci AOC. Cada fitxa guarda l'enllaç a l'origen.
 */

const FONT = "seu-e.cat (Consorci AOC)";

/** Les dues mides que fa servir la fitxa: la llista i el detall. */
const MIDES = [160, 320] as const;

/**
 * Costat curt mínim per fer-ne miniatura.
 *
 * Era 160 i costava car: Sant Boi de Llobregat publica les 25 cares a 120×151 i
 * les perdia totes. El número no ha de sortir de les mides dels fitxers sinó de
 * com de gran es veu el retrat, i el més gran de tota la web fa 120 px. Per
 * sota d'això sí que es notaria, i per això el llindar es queda aquí.
 */
const MINIM_PX = 120;

/**
 * Sis peticions alhora. seu-e aguanta bé però és un servei públic i aquí s'hi
 * fan milers de crides: no és lloc per anar de pressa.
 */
const PARALEL = 6;

/**
 * Si el servidor comença a fallar de manera sostinguda val més plegar i tornar
 * demà que insistir-hi: el que ja s'hagi desat es conserva, i la feina és
 * represa a la següent execució perquè les miniatures que hi ha no es tornen a
 * baixar.
 */
const ERRORS_SEGUITS_MAXIM = 25;

/** Quants municipis grans es miren de prop i s'expliquen un a un. */
const GRANS_PER_DEFECTE = 20;

const exec = promisify(execFile);

export type CarrecDesat = {
  nom: string;
  carrec: string;
  grup: string | null;
  equipGovern: boolean;
  /** Id de la foto a seu-e; `null` si aquesta persona no en té. */
  fotoId: number | null;
  /** Miniatura de 320 px, o `null` si no s'ha pogut fer. */
  foto: string | null;
  /** La mateixa miniatura a 160 px, per a les llistes. */
  fotoPetita: string | null;
  /** Fitxa de la persona a seu-e, per poder anar a la font. */
  fitxa: string | null;
};

export type FitxaCarrecs = {
  font: string;
  url: string;
  slug: string;
  /** Data de descàrrega: sense any, cap dada no entra a la fitxa. */
  descarregat: string;
  totalCarrecs: number;
  ambFoto: number;
  /** `completa` · `parcial` · `cap`. La fitxa hi aplica la regla del tot o res. */
  cobertura: "completa" | "parcial" | "cap";
  carrecs: CarrecDesat[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Miniatures
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Arrel del repositori, calculada des d'aquest fitxer i no des del directori de
 * treball: la feina es crida tant des de l'arrel com des de `packages/pipeline`,
 * i amb `process.cwd()` les fotos acabarien en dos llocs diferents.
 */
const ARREL_REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

/** On van a parar les miniatures, servides pel web com a fitxers estàtics. */
export function directoriFotos(arrel: string = ARREL_REPO): string {
  return join(arrel, "web", "public", "observatori", "fotos");
}

export function camiPublic(mida: number, fotoId: number): string {
  return `/observatori/fotos/${mida}/${fotoId}.webp`;
}

async function existeix(cami: string): Promise<boolean> {
  try {
    const s = await stat(cami);
    return s.size > 0;
  } catch {
    return false;
  }
}

type Dimensions = { amplada: number; alcada: number };

async function dimensions(cami: string): Promise<Dimensions | null> {
  try {
    const { stdout } = await exec("sips", ["-g", "pixelWidth", "-g", "pixelHeight", cami]);
    const amplada = Number(stdout.match(/pixelWidth:\s*(\d+)/)?.[1]);
    const alcada = Number(stdout.match(/pixelHeight:\s*(\d+)/)?.[1]);
    if (!Number.isFinite(amplada) || !Number.isFinite(alcada)) return null;
    return { amplada, alcada };
  } catch {
    // Hi ha bytes que no són cap imatge que sips sàpiga llegir.
    return null;
  }
}

/**
 * Mida real de la miniatura: la demanada, o la de l'original si és més petit.
 *
 * Escalar cap amunt no afegeix ni un detall i sí que multiplica els bytes. Amb
 * les cares de Sant Boi (120×151) la miniatura «de 320» pesaria el triple per
 * ensenyar exactament la mateixa cara.
 */
export function midaMiniatura(mida: number, dim: Dimensions): number {
  return Math.min(mida, dim.amplada, dim.alcada);
}

/**
 * El perfil de color sRGB de macOS, si hi és.
 *
 * Fa falta perquè hi ha retrats en **CMYK**: el de l'alcalde de Badalona ve a
 * 1536×1920 amb el perfil «Coated FOGRA39», d'impremta. `sips` el redimensiona
 * sense queixar-se i després `cwebp` peta amb «Unsupported color conversion
 * request», i aquella cara es perdia com si el fitxer fos corrupte. Passant-lo
 * a sRGB, els 4 canals passen a 3 i la miniatura surt.
 *
 * Es comprova una sola vegada i es guarda: si el perfil no hi fos, val més fer
 * la miniatura com sempre que no pas quedar-se sense cap foto.
 */
const CAMI_SRGB = "/System/Library/ColorSync/Profiles/sRGB Profile.icc";
let perfilSRGB: Promise<string | null> | null = null;

function sRGB(): Promise<string | null> {
  perfilSRGB ??= existeix(CAMI_SRGB).then((hi) => (hi ? CAMI_SRGB : null));
  return perfilSRGB;
}

/**
 * Retalla un quadrat de `mida` píxels.
 *
 * Dues finors que es noten molt a la fitxa:
 *
 *   · L'escalat es fa pel **costat curt**, no pel llarg. `sips -Z` ajusta el
 *     costat llarg i deixa el curt per sota de la mida demanada; llavors el
 *     retall no troba prou píxels i sips **omple amb marges** en comptes de
 *     queixar-se, cosa que dona miniatures amb bandes blanques.
 *   · El retall vertical **no va centrat**: es despenja un quart en comptes de
 *     la meitat. Als retrats la cara és a la franja de dalt, i un retall
 *     centrat li talla el cap.
 */
async function miniatura(origen: string, desti: string, mida: number, dim: Dimensions): Promise<void> {
  /*
   * El fitxer de treball es fa al directori temporal i no al costat del destí:
   * si una conversió peta, el `finally` el neteja, però un `.tmp.jpg` que
   * s'escapés dins de `web/public` acabaria desplegat en producció.
   */
  const treball = join(tmpdir(), `quivoto-mini-${mida}-${process.pid}-${basename(desti)}.jpg`);
  const real = midaMiniatura(mida, dim);
  try {
    const vertical = dim.amplada < dim.alcada;
    const perfil = await sRGB();
    await exec("sips", [
      ...(perfil ? ["--matchTo", perfil] : []),
      vertical ? "--resampleWidth" : "--resampleHeight",
      String(real),
      origen,
      "--out",
      treball,
    ]);

    const escalada = await dimensions(treball);
    if (escalada) {
      const marge = (total: number) => Math.max(0, total - real);
      // Un quart per dalt (i no la meitat) per no decapitar els retrats.
      const desplacamentY = Math.floor(marge(escalada.alcada) / 4);
      const desplacamentX = Math.floor(marge(escalada.amplada) / 2);
      await exec("sips", [
        "--cropOffset",
        String(desplacamentY),
        String(desplacamentX),
        "--cropToHeightWidth",
        String(real),
        String(real),
        treball,
        "--out",
        treball,
      ]);
    }

    await exec("cwebp", ["-quiet", "-q", "82", treball, "-o", desti]);
  } finally {
    await rm(treball, { force: true });
  }
}

/** Comprova que hi ha les eines de macOS abans de començar res. */
export async function einesDisponibles(): Promise<{ ok: boolean; falta: string[] }> {
  const falta: string[] = [];
  for (const eina of ["sips", "cwebp"]) {
    try {
      await exec("which", [eina]);
    } catch {
      falta.push(eina);
    }
  }
  return { ok: falta.length === 0, falta };
}

export type ResultatFoto = "desada" | "ja-hi-era" | "petita" | "sense-foto" | "error";

/**
 * Baixa una fotografia i en desa les miniatures. Si ja hi són, no es torna a
 * demanar: és el que fa que una segona execució no repeteixi 5,6 GB de
 * descàrregues.
 */
export async function baixaFoto(
  slug: string,
  fotoId: number,
  arrelFotos: string,
  midaMinima = MINIM_PX,
): Promise<ResultatFoto> {
  const destins = MIDES.map((m) => join(arrelFotos, String(m), `${fotoId}.webp`));
  const fetes = await Promise.all(destins.map(existeix));
  if (fetes.every(Boolean)) return "ja-hi-era";

  const bytes = await fetchImatge(urlFoto(slug, fotoId));
  if (!bytes) return "sense-foto";

  const temporal = join(tmpdir(), `quivoto-foto-${fotoId}-${process.pid}`);
  try {
    await writeFile(temporal, bytes);
    const dim = await dimensions(temporal);
    if (!dim) return "error";
    // Res borrós: val més cap cara que una cara estirada.
    if (Math.min(dim.amplada, dim.alcada) < midaMinima) return "petita";

    for (let i = 0; i < MIDES.length; i += 1) {
      await mkdir(join(arrelFotos, String(MIDES[i])), { recursive: true });
      await miniatura(temporal, destins[i]!, MIDES[i]!, dim);
    }
    return "desada";
  } finally {
    await rm(temporal, { force: true });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Per què falta una cara
// ─────────────────────────────────────────────────────────────────────────────

/**
 * «No hi ha foto» no vol dir res per si sol: no és el mateix que l'ajuntament no
 * en publiqui cap, que la pàgina no s'hagi pogut obrir o que el mòdul hagi
 * canviat de forma. Sense separar-ho, cada revisió torna a començar de zero
 * mirant les mateixes vint pàgines a mà.
 */
export type MotiuFalta =
  /** El bloc de la persona hi és, però sense cap `getPhotoBytes`. */
  | "seu-e-no-publica-foto"
  /** seu-e anuncia la foto i la serveix buida o amb un 404. */
  | "foto-buida"
  /** Original per sota del llindar de nitidesa. */
  | "foto-massa-petita"
  /** Bytes que no són cap imatge que sips sàpiga llegir. */
  | "foto-illegible"
  /** La pàgina hi és i el mòdul no porta ningú. */
  | "modul-buit"
  /** La pàgina serveix un Tableau incrustat, que mai no porta fotografies. */
  | "modul-tableau"
  /** L'ens és a seu-e i no publica la pàgina de càrrecs electes. */
  | "sense-pagina"
  /** Cap slug de seu-e no respon per aquest municipi. */
  | "fora-de-seu-e"
  /** 200 amb un cos que no és la pàgina: verificació de bot, manteniment… */
  | "pagina-bloquejada"
  /** L'execució s'ha aturat abans d'arribar-hi. */
  | "no-mirat";

const ETIQUETA: Record<MotiuFalta, string> = {
  "seu-e-no-publica-foto": "seu-e no en publica la foto",
  "foto-buida": "la foto respon buida",
  "foto-massa-petita": `l'original no arriba a ${MINIM_PX} px`,
  "foto-illegible": "els bytes no són cap imatge llegible",
  "modul-buit": "la pàgina hi és però el mòdul de càrrecs és buit",
  "modul-tableau": "la pàgina serveix un Tableau de municat.gencat.cat, sense cap fotografia",
  "sense-pagina": "l'ens és a seu-e però no publica la pàgina de càrrecs",
  "fora-de-seu-e": "cap slug de seu-e no respon",
  "pagina-bloquejada": "seu-e respon 200 amb un cos que no és la pàgina",
  "no-mirat": "no s'hi ha arribat en aquesta execució",
};

export function motiuDelResultat(resultat: ResultatFoto): MotiuFalta | null {
  if (resultat === "desada" || resultat === "ja-hi-era") return null;
  if (resultat === "petita") return "foto-massa-petita";
  if (resultat === "sense-foto") return "foto-buida";
  return "foto-illegible";
}

export type EstatPagina = "modul" | "tableau" | "modul-buit" | "bloquejada";

/**
 * Què hem rebut de seu-e quan la resposta és 200.
 *
 * Reus n'és el motiu: respon 200 amb 2 kB de Dynatrace i cap `<title>`, i això
 * abans es comptava igual que un municipi que no és al portal. Són coses
 * diferents —una demana una altra font, l'altra demana un navegador— i han de
 * sortir separades a l'informe.
 */
export function classificaPagina(html: string): EstatPagina {
  if (!/<title>/i.test(html) || html.length < 5_000) return "bloquejada";
  if (/organ-principal-carrecs-item/.test(html)) return "modul";
  if (/tableau|dadesobertes\.seu-e\.cat/i.test(html)) return "tableau";
  return "modul-buit";
}

/** Traducció de l'estat de la pàgina al motiu que surt a l'informe. */
export function motiuDeLaPagina(estat: EstatPagina): MotiuFalta | null {
  if (estat === "modul") return null;
  if (estat === "bloquejada") return "pagina-bloquejada";
  return estat === "tableau" ? "modul-tableau" : "modul-buit";
}

export type FaltaPersona = { nom: string; motiu: MotiuFalta };

/** La fitxa de càrrecs que ja hi havia desada, vingui d'on vingui. */
export type FitxaPrevia = { font: string; ambFoto: number; totalCarrecs: number };

export type Diagnostic = {
  municipi: string;
  poblacio: number | null;
  slug: string | null;
  totalCarrecs: number;
  ambFoto: number;
  /** Per què no hi ha cap cara. `null` si el problema és de persones soltes. */
  motiu: MotiuFalta | null;
  falten: FaltaPersona[];
  /**
   * Qui mana de veritat en aquesta fitxa quan no som nosaltres: J13 baixa les
   * cares de mitja dotzena de ciutats grans de la web del seu ajuntament. Dir
   * «Tarragona: 0 de 27» perquè el mòdul de seu-e és buit seria fals: la fitxa
   * publicada les té totes.
   */
  altraFont: FitxaPrevia | null;
};

function milers(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** «3 sense foto a seu-e, 1 massa petita» a partir de la llista de faltes. */
export function resumFaltes(falten: readonly FaltaPersona[]): string {
  const per = new Map<MotiuFalta, number>();
  for (const f of falten) per.set(f.motiu, (per.get(f.motiu) ?? 0) + 1);
  return [...per.entries()].map(([motiu, quants]) => `${quants} · ${ETIQUETA[motiu]}`).join(" · ");
}

/**
 * Una línia per municipi, que és el que es llegeix a la consola quan es vol
 * saber com estan els grans sense obrir la base de dades.
 */
export function liniaInforme(d: Diagnostic): string {
  const cap = `${d.municipi} (${d.poblacio === null ? "?" : milers(d.poblacio)} hab.)`;
  if (d.altraFont) {
    const font = d.altraFont.font;
    const motiu = d.motiu ? ` — a seu-e, ${ETIQUETA[d.motiu]}` : "";
    return `${cap}: ${d.altraFont.ambFoto}/${d.altraFont.totalCarrecs} amb foto · font: ${font}${motiu}`;
  }
  if (d.totalCarrecs === 0) {
    return `${cap}: cap càrrec llegit — ${ETIQUETA[d.motiu ?? "no-mirat"]}`;
  }
  const cua = d.falten.length === 0 ? "" : ` — falten ${d.falten.length}: ${resumFaltes(d.falten)}`;
  return `${cap}: ${d.ambFoto}/${d.totalCarrecs} amb foto${cua}`;
}

/**
 * Per què no hem sabut trobar el slug d'un municipi gran.
 *
 * El descobriment de slug dona per bona una pàgina quan el `<title>` diu el nom
 * de l'ajuntament, i Reus no en té cap: respon 200 amb 2 kB de verificació de
 * bot. El resultat era el mateix que per a Terrassa, que sí que és fora del
 * portal, i les dues coses demanen feines diferents. Aquesta petició de més
 * només es fa per als municipis grans que han fallat: són comptats.
 */
async function motiuSenseSlug(nom: string): Promise<MotiuFalta> {
  const candidat = slugCandidates(nom)[0];
  if (!candidat) return "fora-de-seu-e";
  try {
    const { status, html } = await fetchText(urlCarrecs(candidat));
    if (status === 200 && classificaPagina(html) === "bloquejada") return "pagina-bloquejada";
  } catch {
    // Si tampoc no es pot comprovar, val més la resposta prudent.
  }
  return "fora-de-seu-e";
}

/** Té totes les cares que li toquen, vingui la fitxa d'on vingui. */
export function teTotesLesCares(d: Diagnostic): boolean {
  const f = d.altraFont ?? d;
  return f.totalCarrecs > 0 && f.ambFoto === f.totalCarrecs;
}

// ─────────────────────────────────────────────────────────────────────────────
// La feina
// ─────────────────────────────────────────────────────────────────────────────

/** Executa `fn` sobre la llista amb un límit de feines alhora. */
async function enParallel<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let seguent = 0;
  const obrers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (seguent < items.length) {
      const i = seguent;
      seguent += 1;
      await fn(items[i]!);
    }
  });
  await Promise.all(obrers);
}

export function cobertura(total: number, ambFoto: number): FitxaCarrecs["cobertura"] {
  if (ambFoto === 0) return "cap";
  return ambFoto === total ? "completa" : "parcial";
}

/**
 * De gran a petit, i els que no tenen padró al final.
 *
 * L'ordre no és cosmètic: amb sis obrers en paral·lel i una hora llarga de
 * feina, ser el primer de la cua vol dir que si la cosa peta a mitja tarda els
 * municipis on mira més gent ja estan desats. El desempat pel nom hi és perquè
 * dues execucions seguides facin exactament la mateixa cosa.
 */
export function gransPrimer<T extends { name: string; population: number | null }>(munis: T[]): T[] {
  return [...munis].sort((a, b) => {
    const pa = a.population ?? -1;
    const pb = b.population ?? -1;
    return pb - pa || a.name.localeCompare(b.name, "ca");
  });
}

/** Llegeix un número de l'entorn sense deixar passar brossa. */
export function nombreEntorn(valor: string | undefined, defecte: number): number {
  const n = Number.parseInt(valor ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : defecte;
}

/**
 * Si la fitxa que ja hi ha ve d'una altra font i té més cares, no es toca.
 *
 * J13 baixa les cares de Barcelona, Lleida, Tarragona i l'Hospitalet de la web
 * de cada ajuntament perquè a seu-e hi tenen la pàgina amb el mòdul buit. Sense
 * aquesta comprovació, passar J11 després de J13 substituiria les 41 cares de
 * Barcelona per una llista de noms sense cap foto, i ningú no se n'adonaria
 * fins a veure la fitxa publicada.
 */
export function potSubstituir(previa: FitxaPrevia | undefined, nova: { ambFoto: number }): boolean {
  // La nostra pròpia fitxa d'ahir sí que es refresca, encara que empitjori: si
  // seu-e ha tret una foto, la fitxa no pot seguir ensenyant-la.
  return fontQueMana(previa, nova.ambFoto) === null;
}

/** Munta el que es desa a la mètrica a partir del que diu la pàgina. */
export function fitxaCarrecs(
  slug: string,
  carrecs: Carrec[],
  fotosBones: ReadonlySet<number>,
  descarregat: string,
): FitxaCarrecs {
  const desats: CarrecDesat[] = carrecs.map((c) => {
    // Només s'hi posa el camí si la miniatura existeix de veritat: que seu-e
    // anunciï una foto no vol dir que se n'hagi pogut fer res. I el lligam és
    // sempre el `fotoId` que venia dins del bloc d'aquesta persona: mai el nom.
    const te = c.fotoId !== null && fotosBones.has(c.fotoId);
    return {
      nom: c.nom,
      carrec: c.carrec,
      grup: c.grup,
      equipGovern: c.equipGovern,
      fotoId: c.fotoId,
      foto: te ? camiPublic(320, c.fotoId!) : null,
      fotoPetita: te ? camiPublic(160, c.fotoId!) : null,
      fitxa: c.fitxa,
    };
  });
  const ambFoto = desats.filter((c) => c.foto !== null).length;
  return {
    font: FONT,
    url: urlCarrecs(slug),
    slug,
    descarregat,
    totalCarrecs: desats.length,
    ambFoto,
    cobertura: cobertura(desats.length, ambFoto),
    carrecs: desats,
  };
}

/** Les fitxes de càrrecs que ja hi ha, per no trepitjar les d'una font millor. */
async function fitxesPrevies(db: Db): Promise<Map<number, FitxaPrevia>> {
  const files = await db
    .select({ id: municipalityMetrics.municipalityId, data: municipalityMetrics.data })
    .from(municipalityMetrics)
    .where(eq(municipalityMetrics.kind, "carrecs"));

  const out = new Map<number, FitxaPrevia>();
  for (const fila of files) {
    const data = fila.data as { font?: unknown; ambFoto?: unknown; totalCarrecs?: unknown } | null;
    if (!data) continue;
    out.set(fila.id, {
      font: typeof data.font === "string" ? data.font : "",
      ambFoto: typeof data.ambFoto === "number" ? data.ambFoto : 0,
      totalCarrecs: typeof data.totalCarrecs === "number" ? data.totalCarrecs : 0,
    });
  }
  return out;
}

/** La fitxa desada que no és nostra i que val més que la que faríem ara. */
export function fontQueMana(previa: FitxaPrevia | undefined, ambFotoNostra: number): FitxaPrevia | null {
  if (!previa || previa.font.includes("seu-e")) return null;
  return previa.ambFoto > ambFotoNostra ? previa : null;
}

export type OpcionsJ11 = {
  arrel?: string;
  /** Quants municipis grans s'expliquen un a un a l'informe. */
  grans?: number;
  /**
   * Només els grans. Una passada de minuts en comptes d'una d'hores, per quan
   * el que es vol és comprovar que les vint fitxes que més es miren tenen cara.
   */
  nomesGrans?: boolean;
};

export async function j11Fotos(db: Db, options: OpcionsJ11 = {}): Promise<void> {
  await withRun(db, "j11-fotos", async (run) => {
    const eines = await einesDisponibles();
    if (!eines.ok) {
      throw new Error(
        `falten les eines d'imatge: ${eines.falta.join(", ")}. ` +
          "sips ve amb macOS; cwebp s'instal·la amb «brew install webp».",
      );
    }

    const arrelFotos = directoriFotos(options.arrel);
    await mkdir(arrelFotos, { recursive: true });
    run.say(`miniatures a ${arrelFotos}`);

    /*
     * L'ordre de la CLI no passa opcions a les feines, i posar-hi paràmetres
     * només per a aquesta obligaria a tocar `cli.ts`. Amb l'entorn n'hi ha prou
     * i és el que ja fan J12 i la publicació:
     *   QUIVOTO_FOTOS_GRANS=30 QUIVOTO_FOTOS_NOMES_GRANS=1 pnpm ingest j11
     */
    const quantsGrans = options.grans ?? nombreEntorn(process.env.QUIVOTO_FOTOS_GRANS, GRANS_PER_DEFECTE);
    const nomesGrans = options.nomesGrans ?? process.env.QUIVOTO_FOTOS_NOMES_GRANS === "1";

    const tots = await db
      .select({ id: municipalities.id, name: municipalities.name, population: municipalities.population })
      .from(municipalities);
    const ordenats = gransPrimer(tots);
    const prioritaris = ordenats.slice(0, quantsGrans);
    const feina = nomesGrans ? prioritaris : ordenats;

    run.rowsIn = feina.length;
    run.say(
      nomesGrans
        ? `només els ${feina.length} municipis més grans (de ${ordenats.length})`
        : `${feina.length} municipis a mirar, començant pels ${prioritaris.length} més grans`,
    );

    const previes = await fitxesPrevies(db);
    const diagnostics = new Map<number, Diagnostic>();
    const esPrioritari = new Set(prioritaris.map((m) => m.id));

    const avui = new Date().toISOString().slice(0, 10);
    let errorsSeguits = 0;
    let aturat = false;

    const comptador = {
      slugs: 0, senseSlug: 0, senseCarrecs: 0, ambModul: 0, ambFoto: 0,
      desades: 0, jaHiEren: 0, petites: 0, senseImatge: 0,
      fotoFallida: 0, errors: 0, bloquejades: 0, conservades: 0,
      completa: 0, parcial: 0, peticions: 0,
    };

    /** Deixa constància del municipi prioritari, tant si va bé com si no. */
    const anota = (
      muni: { id: number; name: string; population: number | null },
      dades: Partial<Diagnostic>,
    ) => {
      if (!esPrioritari.has(muni.id)) return;
      const ambFoto = dades.ambFoto ?? 0;
      diagnostics.set(muni.id, {
        municipi: muni.name,
        poblacio: muni.population,
        slug: null,
        totalCarrecs: 0,
        ambFoto: 0,
        motiu: null,
        falten: [],
        altraFont: fontQueMana(previes.get(muni.id), ambFoto),
        ...dades,
      });
    };

    await enParallel(feina, PARALEL, async (muni) => {
      if (aturat) return;
      try {
        const trobat = await findSlugDetall(muni.name);
        comptador.peticions += trobat?.peticions ?? 0;
        if (!trobat) {
          comptador.senseSlug += 1;
          // La segona mirada només per als grans: dir «no hi és» quan el que
          // passa és que la pàgina no arriba envia la feina cap on no toca.
          const motiu = esPrioritari.has(muni.id)
            ? await motiuSenseSlug(muni.name)
            : "fora-de-seu-e";
          if (motiu === "pagina-bloquejada") comptador.bloquejades += 1;
          anota(muni, { motiu });
          await run.issue({
            kind: "seue_slug_no_resolt",
            severity: "baixa",
            municipalityId: muni.id,
            detail: { nom: muni.name },
          });
          errorsSeguits = 0;
          return;
        }
        comptador.slugs += 1;
        if (!trobat.teCarrecs) {
          // És a seu-e però no publica la pàgina de càrrecs electes.
          comptador.senseCarrecs += 1;
          anota(muni, { slug: trobat.slug, motiu: "sense-pagina" });
          errorsSeguits = 0;
          return;
        }

        const estat = classificaPagina(trobat.html);
        const carrecs = estat === "modul" ? parseCarrecs(trobat.html) : [];
        if (carrecs.length === 0) {
          /*
           * Té la pàgina però no en surt ningú. Separar-ne el motiu és el que
           * va destapar que Reus no és «un municipi sense mòdul» sinó una
           * pàgina que no arriba: 2 kB de verificació de bot en comptes del
           * HTML. La resta són el Tableau de municat, que no porta cap cara.
           */
          if (estat === "bloquejada") comptador.bloquejades += 1;
          anota(muni, { slug: trobat.slug, motiu: motiuDeLaPagina(estat) });
          errorsSeguits = 0;
          return;
        }
        comptador.ambModul += 1;

        const fotosBones = new Set<number>();
        const falten: FaltaPersona[] = [];
        for (const c of carrecs) {
          if (c.fotoId === null) {
            falten.push({ nom: c.nom, motiu: "seu-e-no-publica-foto" });
            continue;
          }
          /*
           * Una foto que peta no pot endur-se el municipi sencer. N'hi ha que
           * són JPEG corruptes i fan petar sips o cwebp; si l'excepció pugés,
           * aquest ajuntament es quedaria sense cap fila i perdríem també els
           * noms i els càrrecs, que sí que teníem.
           */
          let resultat: ResultatFoto;
          try {
            resultat = await baixaFoto(trobat.slug, c.fotoId, arrelFotos);
          } catch {
            resultat = "error";
          }
          if (resultat === "desada") { comptador.desades += 1; fotosBones.add(c.fotoId); }
          else if (resultat === "ja-hi-era") { comptador.jaHiEren += 1; fotosBones.add(c.fotoId); }
          else if (resultat === "petita") comptador.petites += 1;
          else if (resultat === "sense-foto") comptador.senseImatge += 1;
          else comptador.fotoFallida += 1;

          const motiu = motiuDelResultat(resultat);
          if (motiu) falten.push({ nom: c.nom, motiu });
        }

        const fitxa = fitxaCarrecs(trobat.slug, carrecs, fotosBones, avui);
        if (fitxa.cobertura === "completa") comptador.completa += 1;
        if (fitxa.cobertura === "parcial") comptador.parcial += 1;
        if (fitxa.ambFoto > 0) comptador.ambFoto += 1;
        anota(muni, {
          slug: trobat.slug,
          totalCarrecs: fitxa.totalCarrecs,
          ambFoto: fitxa.ambFoto,
          falten,
        });

        if (!potSubstituir(previes.get(muni.id), fitxa)) {
          // La fitxa que hi havia ve de la web de l'ajuntament i té més cares.
          comptador.conservades += 1;
          run.say(`${muni.name}: es conserva la fitxa de ${previes.get(muni.id)!.font}`);
          errorsSeguits = 0;
          return;
        }

        await db
          .insert(municipalityMetrics)
          .values({ municipalityId: muni.id, kind: "carrecs", data: fitxa })
          .onConflictDoUpdate({
            target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
            set: { data: fitxa, computedAt: new Date() },
          });
        previes.set(muni.id, {
          font: fitxa.font,
          ambFoto: fitxa.ambFoto,
          totalCarrecs: fitxa.totalCarrecs,
        });
        run.rowsOut += 1;
        errorsSeguits = 0;
      } catch (error) {
        errorsSeguits += 1;
        comptador.errors += 1;
        anota(muni, { motiu: "no-mirat" });
        await run.issue({
          kind: "seue_error",
          severity: "baixa",
          municipalityId: muni.id,
          detail: { nom: muni.name, error: String(error) },
        });
        if (errorsSeguits >= ERRORS_SEGUITS_MAXIM) {
          aturat = true;
          run.say(`${errorsSeguits} errors seguits: s'atura per no insistir-hi`);
        }
      }
    });

    run.say(`slugs resolts: ${comptador.slugs}/${feina.length} (${comptador.senseSlug} sense)`);
    run.say(
      `sense pàgina de càrrecs: ${comptador.senseCarrecs} · amb mòdul emplenat: ${comptador.ambModul} · ` +
        `pàgines que no arriben: ${comptador.bloquejades} · fitxes d'una altra font respectades: ${comptador.conservades}`,
    );
    run.say(`municipis amb foto: ${comptador.ambFoto} (${comptador.completa} completa, ${comptador.parcial} parcial)`);
    run.say(
      `fotos: ${comptador.desades} noves, ${comptador.jaHiEren} ja hi eren, ` +
        `${comptador.petites} massa petites, ${comptador.fotoFallida} il·legibles`,
    );

    // Els grans, un a un: és l'única part de l'informe que es llegeix sencera.
    run.say(`— els ${prioritaris.length} municipis més grans —`);
    let gransComplets = 0;
    for (const muni of prioritaris) {
      const d = diagnostics.get(muni.id) ?? {
        municipi: muni.name,
        poblacio: muni.population,
        slug: null,
        totalCarrecs: 0,
        ambFoto: 0,
        motiu: "no-mirat" as MotiuFalta,
        falten: [],
        altraFont: fontQueMana(previes.get(muni.id), 0),
      };
      run.say(liniaInforme(d));
      if (teTotesLesCares(d)) {
        gransComplets += 1;
        continue;
      }
      /*
       * Els grans incomplets es desen com a incidència i no només com a línia
       * de consola: cadascun necessita que algú vagi a buscar una altra font, i
       * una traça que es perd amb el terminal no la busca ningú.
       */
      await run.issue({
        kind: "fotos_grans_incompleta",
        // Zero cares en un dels grans no és el mateix que un regidor sense
        // retrat: vol dir que allà hi anirà a parar molta gent i no hi haurà
        // ni una cara. Per això puja de severitat.
        severity: (d.altraFont?.ambFoto ?? d.ambFoto) === 0 ? "mitjana" : "baixa",
        municipalityId: muni.id,
        entity: muni.name,
        detail: {
          poblacio: d.poblacio,
          slug: d.slug,
          totalCarrecs: d.totalCarrecs,
          ambFoto: d.ambFoto,
          motiu: d.motiu,
          falten: d.falten,
          altraFont: d.altraFont,
        },
      });
    }
    run.say(`grans amb totes les cares: ${gransComplets}/${prioritaris.length}`);

    return {
      font: FONT,
      descarregat: avui,
      ...comptador,
      grans: prioritaris.length,
      gransComplets,
      informeGrans: prioritaris.map((m) => {
        const d = diagnostics.get(m.id);
        return d ? liniaInforme(d) : `${m.name}: no s'hi ha arribat`;
      }),
      nomesGrans,
      aturatPerErrors: aturat,
      pesMiniatures: await pesDirectori(arrelFotos),
    };
  });
}

/** Quant ocupen les miniatures, per tenir-ho a la traça de l'execució. */
async function pesDirectori(cami: string): Promise<string> {
  try {
    const { stdout } = await exec("du", ["-sh", cami]);
    return stdout.split(/\s+/)[0] ?? "?";
  } catch {
    return "?";
  }
}
