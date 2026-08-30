import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import {
  CopiaDesadaAbsentError,
  FONTS,
  LlicenciaDenegadaError,
  fotosDe,
  type CarrecCiutat,
  type CopiaDesada,
  type Font,
} from "../adapters/fotos-ciutats";
import { camiPublic, directoriFotos } from "./j11-fotos";
import { withRun } from "../lib/run";

/**
 * J13 — les cares de les ciutats que no són al portal de l'AOC.
 *
 * Barcelona, Terrassa, Lleida, Tarragona, l'Hospitalet i Mataró tenen seu
 * electrònica pròpia i a `seu-e.cat` hi donen 404 o una pàgina buida. Són
 * justament els municipis on més gent mirarà, i quedaven sense cara mentre
 * pobles de mil habitants en tenien.
 *
 * La diferència important respecte de seu-e és la **llicència**: Barcelona
 * publica els seus càrrecs electes amb **CC BY 4.0**, que és permís explícit i
 * no la zona grisa on ens movem amb l'AOC. Per això aquesta via és millor
 * encara que doni menys municipis.
 *
 * Mataró queda fora **a propòsit**: el seu avís legal prohibeix expressament la
 * reproducció sense permís escrit. L'adaptador ho comprova i llança abans de fer
 * cap petició, i aquí es registra com a incidència perquè quedi constància que
 * no és un oblit sinó una decisió.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Terrassa: la pàgina hi és, la llicència ho permet, el servidor no obre
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Terrassa constava aquí dalt des del primer dia i no tenia lector: la seva
 * fitxa sortia amb inicials perquè **no hi havia cap font declarada**. Quan
 * s'ha anat a escriure-la s'ha trobat el problema de debò: tot `terrassa.cat`
 * respon 403 amb un repte de Cloudflare a qualsevol client que no sigui un
 * navegador. Ni `curl`, ni el `fetch` de Node, ni cap capçalera hi fan res, i
 * burlar el repte no és el que fa aquest projecte.
 *
 * El que sí que fa: llegir una **còpia desada amb el navegador**. Una persona
 * obre https://www.terrassa.cat/consistori, la desa amb «Pàgina web, completa»
 * dins de `packages/db/.data/copies/terrassa/` (o on digui `QUIVOTO_COPIES_DIR`),
 * i aquest job la llegeix del disc: el HTML i les 27 imatges de la carpeta
 * `_files` del costat. Les miniatures es fan igual que amb les altres ciutats
 * i l'identificador de cada foto és estable entre la web i la còpia, així que
 * tornar a desar la pàgina d'aquí a un any no en canvia cap nom de fitxer.
 * Sense còpia, el job no fa cap petició: deixa una incidència que diu què cal
 * fer i passa a la ciutat següent.
 *
 * Per fer només una ciutat, `QUIVOTO_CIUTATS=terrassa` (o una llista separada
 * per comes); sense la variable es fan totes, com sempre.
 */

const exec = promisify(execFile);

/** Les mateixes mides que les fotos de seu-e, perquè la fitxa no ho noti. */
const MIDES = [160, 320] as const;
/**
 * Mínim de píndols del costat curt.
 *
 * Més baix que el de seu-e (160) a propòsit: aquestes ciutats publiquen retrats
 * ja retallats i normalitzats —Barcelona els dona a 143×192— i descartar-los per
 * tretze píxels ens deixaria sense les cares de la capital. A 112, que és com de
 * gran es veu el retrat de l'alcaldia, 143 fa de sobres.
 */
const MINIM_PX = 120;

/**
 * On van les còpies desades amb el navegador, una carpeta per municipi. Pesen
 * i no entren al repositori: `.data/` és ignorat, com les actes de J12.
 */
export function directoriCopies(): string {
  return (
    process.env.QUIVOTO_COPIES_DIR ??
    join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "db", ".data", "copies")
  );
}

/** «l'Hospitalet de Llobregat» → «l-hospitalet-de-llobregat», per comparar noms sense mania. */
export function normalitzaCiutat(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Les ciutats demanades a `QUIVOTO_CIUTATS`, normalitzades, o `null` si no
 * se n'ha demanat cap i toca fer-les totes.
 */
export function ciutatsDemanades(valor: string | undefined = process.env.QUIVOTO_CIUTATS): Set<string> | null {
  const noms = (valor ?? "")
    .split(",")
    .map((n) => normalitzaCiutat(n))
    .filter(Boolean);
  return noms.length ? new Set(noms) : null;
}

/** Si una font entra en el que s'ha demanat: per la clau, pel nom o pel slug de la base. */
export function ciutatDemanada(
  demanades: ReadonlySet<string> | null,
  candidats: readonly (string | null | undefined)[],
): boolean {
  if (!demanades) return true;
  return candidats.some((c) => c && demanades.has(normalitzaCiutat(c)));
}

/**
 * La còpia desada més recent d'una carpeta: el `.html` de data més nova, amb
 * el seu `file://` perquè les imatges de la carpeta `_files` es resolguin al
 * seu costat. `null` si no n'hi ha cap.
 */
export async function copiaDesadaDe(dir: string): Promise<(CopiaDesada & { desat: string }) | null> {
  let noms: string[];
  try {
    noms = await readdir(dir);
  } catch {
    return null;
  }
  let millor: { cami: string; mtime: Date } | null = null;
  for (const nom of noms) {
    if (!/\.html?$/i.test(nom)) continue;
    const cami = join(dir, nom);
    const s = await stat(cami);
    if (!s.isFile() || s.size === 0) continue;
    if (!millor || s.mtime > millor.mtime) millor = { cami, mtime: s.mtime };
  }
  if (!millor) return null;
  return {
    html: await readFile(millor.cami, "utf8"),
    base: pathToFileURL(millor.cami).href,
    desat: millor.mtime.toISOString().slice(0, 10),
  };
}

/**
 * Identificador estable d'una foto a partir de la seva adreça (o de la clau
 * que la font declari en lloc seu). Les fotos de les ciutats no porten cap id
 * com els de seu-e, i necessitem un nom de fitxer que no canviï entre
 * execucions.
 */
export function idDeUrl(url: string): number {
  const hash = createHash("sha256").update(url).digest();
  // 40 bits: prou per a milers de fotos sense col·lisions, i cap dins d'un
  // enter segur de JavaScript.
  return hash.readUIntBE(0, 5);
}

/** La clau que identifica la foto d'un càrrec: la declarada, o la URL. */
export function clauDeFoto(c: Pick<CarrecCiutat, "foto" | "fotoClau">): string | null {
  return c.foto ? (c.fotoClau ?? c.foto) : null;
}

async function existeix(cami: string): Promise<boolean> {
  try {
    return (await stat(cami)).size > 0;
  } catch {
    return false;
  }
}

/**
 * Els bytes d'una imatge, vingui de la web o d'una còpia desada al disc.
 * `null` si no s'han pogut llegir o no són una imatge.
 */
export async function bytesDeFoto(url: string): Promise<Buffer | null> {
  if (url.startsWith("file:")) {
    try {
      return await readFile(fileURLToPath(url));
    } catch {
      return null;
    }
  }
  const resposta = await fetch(url, {
    headers: { "user-agent": "quivoto/0.1 (observatori municipal; hola@quivoto.cat)" },
  }).catch(() => null);
  if (!resposta?.ok) return null;
  const tipus = resposta.headers.get("content-type") ?? "";
  if (!tipus.startsWith("image/")) return null;
  return Buffer.from(await resposta.arrayBuffer());
}

/** Baixa (o llegeix) una imatge i en fa les miniatures. Torna si s'ha pogut fer servir. */
async function baixaIRedimensiona(url: string, id: number, arrel: string): Promise<boolean> {
  const destins = MIDES.map((m) => join(arrel, String(m), `${id}.webp`));
  if ((await Promise.all(destins.map(existeix))).every(Boolean)) return true;

  const bytes = await bytesDeFoto(url);
  if (!bytes) return false;

  const temporal = join(tmpdir(), `quivoto-ciutat-${id}-${process.pid}`);
  try {
    await writeFile(temporal, bytes);
    const { stdout } = await exec("sips", ["-g", "pixelWidth", "-g", "pixelHeight", temporal]);
    const mides = [...stdout.matchAll(/pixel(?:Width|Height):\s*(\d+)/g)].map((m) => Number(m[1]));
    if (mides.length < 2 || Math.min(...mides) < MINIM_PX) return false;

    // `sips` sap llegir de tot però no sap escriure webp: redimensiona a jpeg i
    // després `cwebp` en fa el webp, que és el que fa la feina de fotos de
    // seu-e i el que la fitxa espera trobar.
    for (const [i, mida] of MIDES.entries()) {
      await mkdir(join(arrel, String(mida)), { recursive: true });
      const intermedi = `${temporal}-${mida}.jpg`;
      try {
        await exec("sips", ["-Z", String(mida), "-s", "format", "jpeg", temporal, "--out", intermedi]);
        await exec("cwebp", ["-quiet", "-q", "82", intermedi, "-o", destins[i]!]);
      } finally {
        await rm(intermedi, { force: true });
      }
    }
    return true;
  } catch {
    // Un fitxer que `sips` no sap obrir —Terrassa en serveix un que ni el
    // navegador descodifica— és una foto que no tenim, no una execució fallida.
    return false;
  } finally {
    await rm(temporal, { force: true });
  }
}

/** La fitxa de càrrecs, amb la mateixa forma que la de seu-e. */
export function fitxaDeCiutat(
  font: Font,
  carrecs: readonly CarrecCiutat[],
  fotosBones: ReadonlySet<number>,
  descarregat: string,
): Record<string, unknown> {
  const desats = carrecs.map((c) => {
    const clau = clauDeFoto(c);
    const id = clau ? idDeUrl(clau) : null;
    const te = id !== null && fotosBones.has(id);
    return {
      nom: c.nom,
      carrec: c.carrec,
      grup: c.grup,
      // La majoria d'aquestes fonts no diuen qui és de l'equip de govern; seu-e
      // sí, i Terrassa també. Sense la dada, la fitxa no en marca cap: no ens
      // ho inventem.
      equipGovern: c.equipGovern ?? false,
      fotoId: id,
      foto: te ? camiPublic(320, id!) : null,
      fotoPetita: te ? camiPublic(160, id!) : null,
      fitxa: c.fitxa,
    };
  });
  const ambFoto = desats.filter((c) => c.foto !== null).length;
  return {
    font: `${font.municipi} · ${font.citacio}`,
    url: font.urlAvisLegal ?? font.url,
    slug: font.municipi,
    descarregat,
    totalCarrecs: desats.length,
    ambFoto,
    cobertura: ambFoto === 0 ? "cap" : ambFoto === desats.length ? "completa" : "parcial",
    carrecs: desats,
  };
}

export async function j13FotosCiutats(db: Db): Promise<void> {
  await withRun(db, "J13 cares de les ciutats grans", async (run) => {
    const arrel = directoriFotos();
    const avui = new Date().toISOString().slice(0, 10);
    const demanades = ciutatsDemanades();
    const tots = await db.select().from(municipalities);
    const perNom = new Map(tots.map((m) => [m.name, m]));

    for (const [clau, font] of Object.entries(FONTS)) {
      const municipi = perNom.get(font.municipi) ?? perNom.get(clau);
      if (!ciutatDemanada(demanades, [clau, font.municipi, municipi?.slug])) continue;
      if (!municipi) {
        await run.issue({ kind: "ciutat_desconeguda", severity: "baixa", entity: font.municipi });
        continue;
      }
      run.rowsIn += 1;

      // Les fonts que no s'obren per HTTP es llegeixen de la còpia que una
      // persona ha desat amb el navegador, si hi és.
      let copiaDesada: (CopiaDesada & { desat: string }) | undefined;
      let carpetaCopia: string | null = null;
      if (font.nomesCopiaDesada) {
        carpetaCopia = join(directoriCopies(), municipi.slug);
        copiaDesada = (await copiaDesadaDe(carpetaCopia)) ?? undefined;
      }

      let carrecs: CarrecCiutat[];
      try {
        carrecs = await fotosDe(clau, { delayMs: 1_000, copiaDesada });
      } catch (error) {
        if (error instanceof LlicenciaDenegadaError) {
          // No és un error: és la decisió, i ha de quedar escrita.
          await run.issue({
            kind: "fotos_llicencia_prohibida",
            severity: "baixa",
            municipalityId: municipi.id,
            entity: font.municipi,
            detail: { citacio: font.citacio, avisLegal: font.urlAvisLegal },
          });
          run.say(`${font.municipi}: no, l'avís legal ho prohibeix`);
          continue;
        }
        if (error instanceof CopiaDesadaAbsentError) {
          // Tampoc no és un error del job: és feina que cal fer a mà, i la
          // incidència diu exactament quina.
          await run.issue({
            kind: "fotos_cal_copia_desada",
            severity: "baixa",
            municipalityId: municipi.id,
            entity: font.municipi,
            detail: { url: font.url, carpeta: carpetaCopia, motiu: font.nomesCopiaDesada },
          });
          run.say(
            `${font.municipi}: cal desar ${font.url} amb el navegador («Pàgina web, completa») ` +
              `dins de ${carpetaCopia}; ${font.nomesCopiaDesada}`,
          );
          continue;
        }
        await run.issue({
          kind: "fotos_ciutat_error",
          severity: "mitjana",
          municipalityId: municipi.id,
          entity: font.municipi,
          detail: { error: String(error).slice(0, 200) },
        });
        continue;
      }

      const bones = new Set<number>();
      const fallides: string[] = [];
      for (const carrec of carrecs) {
        const clauFoto = clauDeFoto(carrec);
        if (!carrec.foto || !clauFoto) continue;
        const id = idDeUrl(clauFoto);
        if (await baixaIRedimensiona(carrec.foto, id, arrel)) bones.add(id);
        else fallides.push(carrec.nom);
      }

      const descarregat = copiaDesada?.desat ?? avui;
      const fitxa = fitxaDeCiutat(font, carrecs, bones, descarregat);
      await db
        .insert(municipalityMetrics)
        .values({ municipalityId: municipi.id, kind: "carrecs", data: fitxa })
        .onConflictDoUpdate({
          target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
          set: { data: fitxa, computedAt: new Date() },
        });
      run.rowsOut += 1;
      const origen = copiaDesada ? ` · còpia desada el ${copiaDesada.desat}` : "";
      run.say(`${font.municipi}: ${bones.size} de ${carrecs.length} amb foto · ${font.llicencia}${origen}`);
      if (fallides.length) {
        // Qui s'ha quedat sense cara i per què s'ha de poder llegir a l'informe,
        // no endevinar-se: a Terrassa és un fitxer que no es descodifica; a la
        // web seria un 403 o una imatge massa petita.
        run.say(`  sense foto aprofitable: ${fallides.join(", ")}`);
      }
    }

    return { ciutats: run.rowsOut };
  });
}
