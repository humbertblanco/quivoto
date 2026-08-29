import { execFile } from "node:child_process";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import {
  fetchImatge,
  findSlugDetall,
  parseCarrecs,
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
 *     la fitxa qui decideix si les ensenya. De 350 municipis amb alguna foto,
 *     només 247 les tenen totes.
 *   · **Miniatures, no un mirall.** Els originals de seu-e no estan
 *     normalitzats —de 133×200 a 4000×4000— i sumen uns 5,6 GB. Se'n desen
 *     dues mides quadrades i prou; els originals no es guarden.
 *   · **Res borrós.** Per sota de 160 px pel costat curt la miniatura es veuria
 *     estirada, i val més no ensenyar la cara que ensenyar-la mal.
 *
 * Font: https://seu-e.cat · Consorci AOC. Cada fitxa guarda l'enllaç a l'origen.
 */

const FONT = "seu-e.cat (Consorci AOC)";

/** Les dues mides que fa servir la fitxa: la llista i el detall. */
const MIDES = [160, 320] as const;

/**
 * Per sota d'aquest costat curt la foto no dona per a la miniatura petita i es
 * veuria borrosa. Són poques: 2 de les 157 mesurades (1,3%).
 */
const MINIM_PX = 160;

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
  try {
    const vertical = dim.amplada < dim.alcada;
    await exec("sips", [
      vertical ? "--resampleWidth" : "--resampleHeight",
      String(mida),
      origen,
      "--out",
      treball,
    ]);

    const escalada = await dimensions(treball);
    if (escalada) {
      const marge = (total: number) => Math.max(0, total - mida);
      // Un quart per dalt (i no la meitat) per no decapitar els retrats.
      const desplacamentY = Math.floor(marge(escalada.alcada) / 4);
      const desplacamentX = Math.floor(marge(escalada.amplada) / 2);
      await exec("sips", [
        "--cropOffset",
        String(desplacamentY),
        String(desplacamentX),
        "--cropToHeightWidth",
        String(mida),
        String(mida),
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

/** Munta el que es desa a la mètrica a partir del que diu la pàgina. */
export function fitxaCarrecs(
  slug: string,
  carrecs: Carrec[],
  fotosBones: ReadonlySet<number>,
  descarregat: string,
): FitxaCarrecs {
  const desats: CarrecDesat[] = carrecs.map((c) => {
    // Només s'hi posa el camí si la miniatura existeix de veritat: que seu-e
    // anunciï una foto no vol dir que se n'hagi pogut fer res.
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

export async function j11Fotos(db: Db, options: { arrel?: string } = {}): Promise<void> {
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

    const munis = await db
      .select({ id: municipalities.id, name: municipalities.name })
      .from(municipalities);
    run.rowsIn = munis.length;
    run.say(`${munis.length} municipis a mirar`);

    const avui = new Date().toISOString().slice(0, 10);
    let errorsSeguits = 0;
    let aturat = false;

    const comptador = {
      slugs: 0, senseSlug: 0, senseCarrecs: 0, ambModul: 0, ambFoto: 0,
      desades: 0, jaHiEren: 0, petites: 0, senseImatge: 0,
      fotoFallida: 0, errors: 0,
      completa: 0, parcial: 0, peticions: 0,
    };

    await enParallel(munis, PARALEL, async (muni) => {
      if (aturat) return;
      try {
        const trobat = await findSlugDetall(muni.name);
        comptador.peticions += trobat?.peticions ?? 0;
        if (!trobat) {
          comptador.senseSlug += 1;
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
          errorsSeguits = 0;
          return;
        }

        const carrecs = parseCarrecs(trobat.html);
        if (carrecs.length === 0) {
          // Té la pàgina però el mòdul buit: la meitat dels ens són així, i
          // molts fan servir un Tableau incrustat que no porta cap fotografia.
          errorsSeguits = 0;
          return;
        }
        comptador.ambModul += 1;

        const fotosBones = new Set<number>();
        for (const c of carrecs) {
          if (c.fotoId === null) continue;
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
        }

        const fitxa = fitxaCarrecs(trobat.slug, carrecs, fotosBones, avui);
        if (fitxa.cobertura === "completa") comptador.completa += 1;
        if (fitxa.cobertura === "parcial") comptador.parcial += 1;
        if (fitxa.ambFoto > 0) comptador.ambFoto += 1;

        await db
          .insert(municipalityMetrics)
          .values({ municipalityId: muni.id, kind: "carrecs", data: fitxa })
          .onConflictDoUpdate({
            target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
            set: { data: fitxa, computedAt: new Date() },
          });
        run.rowsOut += 1;
        errorsSeguits = 0;
      } catch (error) {
        errorsSeguits += 1;
        comptador.errors += 1;
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

    run.say(`slugs resolts: ${comptador.slugs}/${munis.length} (${comptador.senseSlug} sense)`);
    run.say(`sense pàgina de càrrecs: ${comptador.senseCarrecs} · amb mòdul emplenat: ${comptador.ambModul}`);
    run.say(`municipis amb foto: ${comptador.ambFoto} (${comptador.completa} completa, ${comptador.parcial} parcial)`);
    run.say(
      `fotos: ${comptador.desades} noves, ${comptador.jaHiEren} ja hi eren, ` +
        `${comptador.petites} massa petites, ${comptador.fotoFallida} il·legibles`,
    );

    return {
      font: FONT,
      descarregat: avui,
      ...comptador,
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
