import { createHash } from "node:crypto";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";
import { municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { FONTS, LlicenciaDenegadaError, fotosDe, type CarrecCiutat, type Font } from "../adapters/fotos-ciutats";
import { camiPublic, directoriFotos } from "./j11-fotos";
import { withRun } from "../lib/run";

/**
 * J13 — les cares de les ciutats que no són al portal de l'AOC.
 *
 * Barcelona, Terrassa, Lleida, Tarragona, Mataró i Reus tenen seu electrònica
 * pròpia i a `seu-e.cat` hi donen 404 o una pàgina buida. Són justament els
 * municipis on més gent mirarà, i quedaven sense cara mentre pobles de mil
 * habitants en tenien.
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
 * Identificador estable d'una foto a partir de la seva adreça. Les fotos de les
 * ciutats no porten cap id com els de seu-e, i necessitem un nom de fitxer que
 * no canviï entre execucions.
 */
export function idDeUrl(url: string): number {
  const hash = createHash("sha256").update(url).digest();
  // 40 bits: prou per a milers de fotos sense col·lisions, i cap dins d'un
  // enter segur de JavaScript.
  return hash.readUIntBE(0, 5);
}

async function existeix(cami: string): Promise<boolean> {
  try {
    return (await stat(cami)).size > 0;
  } catch {
    return false;
  }
}

/** Baixa una imatge i en fa les miniatures. Torna si s'ha pogut fer servir. */
async function baixaIRedimensiona(url: string, id: number, arrel: string): Promise<boolean> {
  const destins = MIDES.map((m) => join(arrel, String(m), `${id}.webp`));
  if ((await Promise.all(destins.map(existeix))).every(Boolean)) return true;

  const resposta = await fetch(url, {
    headers: { "user-agent": "quivoto/0.1 (observatori municipal; hola@quivoto.cat)" },
  }).catch(() => null);
  if (!resposta?.ok) return false;
  const tipus = resposta.headers.get("content-type") ?? "";
  if (!tipus.startsWith("image/")) return false;

  const temporal = join(tmpdir(), `quivoto-ciutat-${id}-${process.pid}`);
  try {
    await writeFile(temporal, Buffer.from(await resposta.arrayBuffer()));
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
    const id = c.foto ? idDeUrl(c.foto) : null;
    const te = id !== null && fotosBones.has(id);
    return {
      nom: c.nom,
      carrec: c.carrec,
      grup: c.grup,
      // Aquestes fonts no diuen qui és de l'equip de govern; seu-e sí. No ens ho
      // inventem: sense la dada, la fitxa no en marca cap.
      equipGovern: false,
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
    const descarregat = new Date().toISOString().slice(0, 10);
    const tots = await db.select().from(municipalities);
    const perNom = new Map(tots.map((m) => [m.name, m]));

    for (const [clau, font] of Object.entries(FONTS)) {
      const municipi = perNom.get(font.municipi) ?? perNom.get(clau);
      if (!municipi) {
        await run.issue({ kind: "ciutat_desconeguda", severity: "baixa", entity: font.municipi });
        continue;
      }
      run.rowsIn += 1;

      let carrecs: CarrecCiutat[];
      try {
        carrecs = await fotosDe(clau, { delayMs: 1_000 });
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
      for (const carrec of carrecs) {
        if (!carrec.foto) continue;
        const id = idDeUrl(carrec.foto);
        if (await baixaIRedimensiona(carrec.foto, id, arrel)) bones.add(id);
      }

      const fitxa = fitxaDeCiutat(font, carrecs, bones, descarregat);
      await db
        .insert(municipalityMetrics)
        .values({ municipalityId: municipi.id, kind: "carrecs", data: fitxa })
        .onConflictDoUpdate({
          target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
          set: { data: fitxa, computedAt: new Date() },
        });
      run.rowsOut += 1;
      run.say(`${font.municipi}: ${bones.size} de ${carrecs.length} amb foto · ${font.llicencia}`);
    }

    return { ciutats: run.rowsOut };
  });
}
