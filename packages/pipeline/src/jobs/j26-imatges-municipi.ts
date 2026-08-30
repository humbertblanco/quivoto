import { execFile } from "node:child_process";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";
import { municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { fetchImatge } from "../adapters/seue";
import { sleep } from "../lib/http";
import { withRun } from "../lib/run";
import { directoriFotos, einesDisponibles, gransPrimer } from "./j11-fotos";
import { KIND as KIND_WIKIDATA, type FitxaWikidata, type ImatgeCommons } from "./j20-wikidata";

/**
 * J26 — l'escut i la fotografia de cada poble, baixats i desats a casa.
 *
 * J20 ja va aparellar els 947 municipis amb Wikidata pel codi INE i va guardar,
 * fitxer a fitxer, la llicència que Commons en declara: **916 municipis amb
 * fotografia i 877 amb escut**. El que va desar és una **URL** a
 * upload.wikimedia.org, i publicar-la tal qual seria fer dues coses que aquí no
 * fem:
 *
 *   · **Fer pagar la banda a qui ens dona les dades de franc.** Són 947 fitxes
 *     × 2 imatges cada vegada que algú les obre, i la Fundació Wikimedia ens
 *     serviria fins a l'última. L'original d'Abrera pesa **6,7 MB** —mesurat
 *     amb una crida de capçalera el 30-08-2026—; multiplicat per les visites,
 *     és abusar-ne.
 *   · **Trencar la promesa del fitxer autònom.** Cada radiografia és un HTML
 *     que es pot arxivar i obrir sense xarxa; una imatge remota la converteix
 *     en una pàgina que depèn d'un tercer per veure's sencera.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NO ES BAIXA L'ORIGINAL: ES DEMANA LA MINIATURA QUE COMMONS JA TÉ FETA
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `Special:FilePath/<fitxer>?width=1024` retorna la còpia reduïda que Commons ja
 * té generada i a la memòria cau. La comprovació d'Abrera-57.jpg, feta el
 * 30-08-2026: **6.702.968 bytes** l'original i **358.832** la de 1024 px. És
 * **dinou vegades menys** per una imatge que la pàgina no ensenyarà mai més
 * gran de 900 px, i evita que el servidor hagi de servir 6 GB per fer-ne 100 MB.
 * És la interfície documentada de MediaWiki; endevinar el camí intern de
 * `/thumb/` estalviaria dues redireccions i es trencaria el dia que el canviïn.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * L'ESCUT SVG NO ES RASTERITZA
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * La majoria d'escuts són SVG i es desen **tal com són**, sense tocar-los ni un
 * byte. Tres raons, per aquest ordre:
 *
 *   1. **Es veu net a qualsevol mida.** L'escut surt petit al costat del nom i
 *      gran a la capçalera; una sola rasterització no pot servir per a totes
 *      dues sense o bé pesar de més o bé veure's borrós al zoom.
 *   2. **Pesa menys.** El d'Abrera fa **32.966 bytes** en SVG; el PNG que en
 *      renderitza Commons a 330 px ja en fa 40.342, i encara seria d'una sola
 *      mida.
 *   3. **És l'obra original, no una derivada.** La CC BY-SA 4.0 obliga a dir
 *      quan una obra s'ha modificat. Servint el fitxer verbatim no hi ha res a
 *      dir; una còpia reduïda sí que és una adaptació i el crèdit ho ha
 *      d'admetre (ho fa: vegeu `derivada`, que la pàgina escriu).
 *
 * Amb dues excepcions, totes dues comprovades abans de desar:
 *
 *   · **SVG amb codi executable.** Un `<script>` dins d'un SVG no s'executa mai
 *     dins d'un `<img>`, però el fitxer es publica al **nostre domini** i qui
 *     obri `/observatori/escuts/08001.svg` a una pestanya sí que el fa córrer,
 *     amb el nostre origen. No val la pena: aquests es rasteritzen.
 *   · **SVG desmesurats.** Per sobre de 300 kB el vector ja no és l'opció
 *     lleugera i es renderitza a PNG, que és el que fa Commons mateix.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL CRÈDIT VIATJA AMB EL FITXER
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Al costat de cada imatge s'hi desa un `.json` amb l'autor, la llicència, el
 * nom del fitxer i la pàgina de Commons. Dues raons: la pàgina pot citar-los
 * sense tornar a la base de dades, i un directori d'imatges sense la seva
 * atribució, si algú se'l copia, és un directori d'imatges que incompleix la
 * llicència de totes. La mateixa informació es desa a `municipality_metrics`
 * amb `kind = "imatges"`, que és d'on la llegeix la publicació.
 *
 * **Idempotent**: si el fitxer hi és i el `.json` del costat diu que ve del
 * mateix fitxer de Commons, no es torna a demanar res. Una segona execució no
 * baixa ni un byte; i si a Wikidata li canvien l'escut, el nom del fitxer del
 * `.json` deixa de coincidir i aquell —només aquell— es torna a baixar.
 *
 * **Respectuós**: una petició cada cop, amb pausa entremig i amb l'User-Agent
 * que identifica el projecte i una adreça de contacte. Són 1.793 fitxers una
 * sola vegada; no hi ha cap pressa que justifiqui anar de quatre en quatre.
 *
 * Font: Wikimedia Commons. La llicència, l'autor i la pàgina de cada fitxer
 * surten de J20, que ja els va comprovar un a un contra l'API de Commons.
 */

export const KIND = "imatges";

const FONT = "Wikimedia Commons (commons.wikimedia.org)";

const API_FILEPATH = "https://commons.wikimedia.org/wiki/Special:FilePath/";

/**
 * Amplada que es demana a Commons i que es desa.
 *
 * La columna de la radiografia fa 900 px (`--ample` de `estil.ts`), o sigui que
 * 1.024 la cobreix sencera i encara sobra. L'escut es demana a 512 perquè el
 * més gran que en dibuixa la pàgina fa 200 px i 512 el deixa net també a les
 * pantalles que dupliquen els píxels.
 */
const AMPLADA = { vista: 1024, escut: 512 } as const;

/**
 * Qualitat del WebP, diferent per a cada mena a posta.
 *
 * La fotografia d'un poble és degradat i fullatge i el 76 no s'hi nota: la
 * d'Abrera passa de 358 kB de JPEG a **127 kB**. L'escut renderitzat és color
 * pla amb vores dures, on el mateix 76 deixa halos visibles al voltant de les
 * línies; per això va al 90.
 */
const QUALITAT = { vista: 76, escut: 90 } as const;

/**
 * Per sobre d'aquí, un SVG ja no és l'opció lleugera i es rasteritza. El límit
 * és generós a posta: l'escut d'Abrera en fa 33 kB i cap escut normal no s'hi
 * acosta; els que el passen són els traçats a mà amb desenes de milers de nodes.
 */
const SVG_MAXIM = 300_000;

/**
 * Pausa entre peticions. Una crida cada 300 ms són uns nou minuts per als 1.793
 * fitxers, i es fa una sola vegada a la vida del projecte. Wikimedia demana
 * peticions en sèrie per a les descàrregues massives i això és exactament el
 * que fem: cap paral·lelisme.
 */
const PAUSA_MS = 300;

/**
 * Si Commons comença a fallar de manera sostinguda val més plegar: el que ja
 * s'ha desat es conserva i la propera execució continua on era, perquè els
 * fitxers que hi són no es tornen a demanar.
 */
const ERRORS_SEGUITS_MAXIM = 20;

const exec = promisify(execFile);

// ─────────────────────────────────────────────────────────────────────────────
// Tipus
// ─────────────────────────────────────────────────────────────────────────────

export type MenaImatge = "escut" | "vista";

/** Una imatge desada a casa, amb tot el que la pàgina necessita per citar-la. */
export type ImatgeDesada = {
  mena: MenaImatge;
  /** Camí públic tal com l'escriurà la pàgina: `/observatori/escuts/08001.svg`. */
  cami: string;
  format: "svg" | "webp";
  /** Mides reals del fitxer desat; `null` per als SVG, que no en tenen de fixes. */
  amplada: number | null;
  alcada: number | null;
  /**
   * Cert quan el que servim no és el fitxer de Commons sinó una còpia reduïda.
   * La CC BY-SA obliga a dir-ho, i el crèdit de la pàgina ho llegeix d'aquí.
   */
  derivada: boolean;
  /** Títol a Commons, que és el que identifica l'obra. */
  fitxer: string;
  /** Pàgina de descripció: on va a parar l'atribució. */
  pagina: string;
  llicencia: string;
  llicenciaNom: string;
  autor: string | null;
  font: string;
  descarregat: string;
};

/** El que es desa a `municipality_metrics` per a cada municipi. */
export type FitxaImatges = {
  font: string;
  ine5: string;
  descarregat: string;
  escut: ImatgeDesada | null;
  vista: ImatgeDesada | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// On van i com es diuen
// ─────────────────────────────────────────────────────────────────────────────

/** El nom del directori públic de cada mena. */
const CARPETA: Record<MenaImatge, string> = { escut: "escuts", vista: "vistes" };

/**
 * L'arrel de la sortida de l'Observatori.
 *
 * Es demana a `directoriFotos()` de J11 i se'n puja un nivell en comptes de
 * tornar a calcular l'arrel del repositori: si un dia la sortida canvia de
 * lloc, ha de canviar en un sol fitxer i no en dos.
 */
export function directoriImatges(mena: MenaImatge, arrel?: string): string {
  return join(dirname(directoriFotos(arrel)), CARPETA[mena]);
}

/**
 * El nom és el **codi INE**, que és la clau estable: els noms canvien
 * d'ortografia i els identificadors de Wikidata poden fusionar-se, però el codi
 * INE d'un municipi és el mateix des de fa dècades i és el que ja fa servir
 * tota la resta del projecte per creuar dades.
 */
export function camiPublicImatge(mena: MenaImatge, ine5: string, format: "svg" | "webp"): string {
  return `/observatori/${CARPETA[mena]}/${ine5}.${format}`;
}

/** El fitxer del crèdit, sempre al costat de la imatge i amb el mateix nom. */
export function camiCredit(mena: MenaImatge, ine5: string, arrel?: string): string {
  return join(directoriImatges(mena, arrel), `${ine5}.json`);
}

/** «File:Escudo de Abrera (Barcelona).svg» → «Escudo de Abrera (Barcelona).svg». */
export function nomDeCommons(titol: string): string {
  return titol.replace(/^(File|Fitxer|Image|Imatge):\s*/i, "").trim();
}

/**
 * La URL de descàrrega.
 *
 * Sense amplada es demana l'original —és el cas de l'SVG, que volem verbatim—;
 * amb amplada, Commons redirigeix a la miniatura que ja té feta. La demanada no
 * sempre és la que arriba: MediaWiki l'ajusta al graó més proper (256 → 330 amb
 * l'escut d'Abrera), i per això després es torna a ajustar aquí.
 */
export function urlDescarrega(fitxer: string, amplada: number | null = null): string {
  const base = `${API_FILEPATH}${encodeURIComponent(nomDeCommons(fitxer))}`;
  return amplada === null ? base : `${base}?width=${amplada}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Què fem amb els bytes que arriben
// ─────────────────────────────────────────────────────────────────────────────

/** Els primers bytes diuen si és un SVG millor que qualsevol capçalera. */
export function semblaSvg(text: string): boolean {
  const cap = text.slice(0, 1000).toLowerCase();
  return cap.includes("<svg") || (cap.includes("<?xml") && text.toLowerCase().includes("<svg"));
}

export type VeredicteSvg = { publicable: true } | { publicable: false; motiu: string };

/**
 * Decideix si un SVG es pot servir tal com és.
 *
 * El perill no és el `<img>` —allà dins un SVG no executa res mai— sinó que el
 * fitxer viu al **nostre domini**: qui obri `/observatori/escuts/08001.svg` en
 * una pestanya el fa córrer amb el nostre origen. Com que el que ens interessa
 * de l'escut és el dibuix i no el codi, el que en porti es rasteritza i llestos.
 */
export function veredicteSvg(text: string, bytes: number, maxim = SVG_MAXIM): VeredicteSvg {
  if (bytes > maxim) return { publicable: false, motiu: `SVG de ${bytes} bytes` };
  const net = text.toLowerCase();
  if (net.includes("<script")) return { publicable: false, motiu: "l'SVG porta <script>" };
  if (net.includes("<foreignobject")) return { publicable: false, motiu: "l'SVG porta <foreignObject>" };
  if (/\son[a-z]+\s*=/.test(net)) return { publicable: false, motiu: "l'SVG porta gestors d'esdeveniments" };
  return { publicable: true };
}

type Dimensions = { amplada: number; alcada: number };

/**
 * Mides d'un fitxer amb `sips`, igual que J11. Allà la funció és privada; si
 * algun dia se n'exporta una de sola, aquesta ha de desaparèixer.
 */
async function mides(cami: string): Promise<Dimensions | null> {
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
 * Amplada final: la demanada, o la de l'original si ja és més petit.
 *
 * És la mateixa regla que `midaMiniatura()` de J11 —no inventar-se píxels— però
 * no la mateixa funció: allà la miniatura és **quadrada** i mira els dos
 * costats, i aquí no es retalla res. Un retall quadrat li trauria la corona a
 * l'escut i convertiria la panoràmica d'un poble en una altra fotografia.
 */
export function ampladaDesti(demanada: number, dim: Dimensions): number {
  return Math.min(demanada, dim.amplada);
}

/**
 * El perfil sRGB de macOS, comprovat una sola vegada. J11 el va haver d'afegir
 * per la fotografia en CMYK de l'alcalde de Badalona, que feia petar `cwebp`
 * amb «Unsupported color conversion request».
 */
const CAMI_SRGB = "/System/Library/ColorSync/Profiles/sRGB Profile.icc";
let perfilSRGB: Promise<boolean> | null = null;

async function existeix(cami: string): Promise<boolean> {
  try {
    return (await stat(cami)).size > 0;
  } catch {
    return false;
  }
}

/**
 * Redueix i converteix a WebP conservant la proporció.
 *
 * El pas per sRGB és el mateix que J11 va haver d'afegir per la fotografia de
 * l'alcalde de Badalona: hi ha originals en CMYK amb perfil d'impremta que fan
 * petar `cwebp` amb «Unsupported color conversion request». Aquí encara hi és
 * més probable, perquè les fotografies de Commons vénen de càmeres de tothom.
 */
async function aWebp(origen: string, desti: string, amplada: number, qualitat: number): Promise<Dimensions | null> {
  const treball = `${origen}.escalat.png`;
  try {
    perfilSRGB ??= existeix(CAMI_SRGB);
    const perfil = (await perfilSRGB) ? ["--matchTo", CAMI_SRGB] : [];
    await exec("sips", [...perfil, "--resampleWidth", String(amplada), origen, "--out", treball]);
    // cwebp conserva el canal alfa, i és el que salva els escuts: el WebP de
    // l'escut d'Abrera surt de 512×614 amb transparència, comprovat.
    await exec("cwebp", ["-quiet", "-q", String(qualitat), treball, "-o", desti]);
    return await mides(desti);
  } finally {
    await rm(treball, { force: true });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Idempotència
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El crèdit que hi ha desat al costat de la imatge, si hi és i es pot llegir.
 * Un JSON trencat es tracta com si no hi fos: es tornarà a baixar, que és barat.
 */
export async function creditDesat(mena: MenaImatge, ine5: string, arrel?: string): Promise<ImatgeDesada | null> {
  try {
    const brut = JSON.parse(await readFile(camiCredit(mena, ine5, arrel), "utf8")) as ImatgeDesada;
    return typeof brut?.fitxer === "string" && typeof brut?.cami === "string" ? brut : null;
  } catch {
    return null;
  }
}

/**
 * Serveix el que ja hi ha?
 *
 * Només si és el **mateix fitxer de Commons**. Comparar el camí local no
 * bastaria: el nom és el codi INE i no canvia mai, de manera que un escut
 * substituït a Wikidata passaria desapercebut per sempre.
 */
export function serveixElQueHiHa(previ: ImatgeDesada | null, imatge: ImatgeCommons): boolean {
  return previ !== null && previ.fitxer === imatge.fitxer;
}

export type Estat = "desada" | "ja-hi-era" | "sense-resposta" | "illegible" | "error";

export type Resultat = { estat: Estat; imatge: ImatgeDesada | null };

/**
 * Baixa una imatge i la desa, amb el seu crèdit al costat.
 *
 * Cada peça de decisió està en funcions pures a sobre; aquí només hi ha
 * l'entrada i la sortida, que és el que no es pot provar sense xarxa.
 */
export async function baixaImatge(
  imatge: ImatgeCommons,
  mena: MenaImatge,
  ine5: string,
  descarregat: string,
  arrel?: string,
): Promise<Resultat> {
  const carpeta = directoriImatges(mena, arrel);
  const previ = await creditDesat(mena, ine5, arrel);
  if (serveixElQueHiHa(previ, imatge) && (await existeix(join(carpeta, `${ine5}.${previ!.format}`)))) {
    return { estat: "ja-hi-era", imatge: previ };
  }

  /*
   * L'SVG es demana sencer i la resta reduïda. Que Wikidata digui «.svg» no vol
   * dir que ho sigui —hi ha fitxers reanomenats—, i per això després es mira el
   * contingut i no el nom. L'`.svgz` en queda fora a posta: arriba comprimit i
   * el navegador no el desemboliraria; se'n demana la còpia renderitzada com
   * de qualsevol altre format.
   */
  const sembla = /\.svg$/i.test(imatge.fitxer);
  const bytes = await fetchImatge(urlDescarrega(imatge.fitxer, sembla ? null : AMPLADA[mena]));
  if (bytes === null) return { estat: "sense-resposta", imatge: null };

  await mkdir(carpeta, { recursive: true });
  const text = Buffer.from(bytes).toString("utf8");
  const esVector = semblaSvg(text);
  const veredicte = esVector ? veredicteSvg(text, bytes.byteLength) : null;

  if (esVector && veredicte?.publicable) {
    // Verbatim: ni es minifica ni es toca. Així el que servim és exactament
    // l'obra que el crèdit diu que és.
    const desti = join(carpeta, `${ine5}.svg`);
    await writeFile(desti, bytes);
    await rm(join(carpeta, `${ine5}.webp`), { force: true });
    return { estat: "desada", imatge: await desaCredit({
      mena, cami: camiPublicImatge(mena, ine5, "svg"), format: "svg",
      amplada: null, alcada: null, derivada: false, ...credit(imatge, descarregat),
    }, ine5, arrel) };
  }

  /*
   * O no és vector, o és un vector que no volem servir. Si el que hem baixat és
   * l'SVG sencer, la còpia rasteritzada la fa Commons: `sips` no sap llegir
   * SVG i qualsevol altra eina seria una dependència nova per a quatre fitxers.
   */
  const origen = join(tmpdir(), `quivoto-imatge-${mena}-${ine5}-${process.pid}`);
  try {
    if (esVector) {
      const png = await fetchImatge(urlDescarrega(imatge.fitxer, AMPLADA[mena]));
      if (png === null) return { estat: "sense-resposta", imatge: null };
      await writeFile(origen, png);
    } else {
      await writeFile(origen, bytes);
    }

    const dim = await mides(origen);
    if (dim === null) return { estat: "illegible", imatge: null };

    const desti = join(carpeta, `${ine5}.webp`);
    const final = await aWebp(origen, desti, ampladaDesti(AMPLADA[mena], dim), QUALITAT[mena]);
    if (final === null) return { estat: "illegible", imatge: null };
    await rm(join(carpeta, `${ine5}.svg`), { force: true });

    return { estat: "desada", imatge: await desaCredit({
      mena, cami: camiPublicImatge(mena, ine5, "webp"), format: "webp",
      amplada: final.amplada, alcada: final.alcada,
      // Reduïda i recomprimida: és una obra derivada i el crèdit ho ha de dir.
      derivada: true, ...credit(imatge, descarregat),
    }, ine5, arrel) };
  } finally {
    await rm(origen, { force: true });
  }
}

/** La part del crèdit que ve de Commons, tal com J20 la va comprovar. */
function credit(imatge: ImatgeCommons, descarregat: string) {
  return {
    fitxer: imatge.fitxer,
    pagina: imatge.pagina,
    llicencia: imatge.llicencia,
    llicenciaNom: imatge.llicenciaNom,
    autor: imatge.autor,
    font: FONT,
    descarregat,
  };
}

async function desaCredit(imatge: ImatgeDesada, ine5: string, arrel?: string): Promise<ImatgeDesada> {
  await writeFile(camiCredit(imatge.mena, ine5, arrel), `${JSON.stringify(imatge, null, 2)}\n`, "utf8");
  return imatge;
}

// ─────────────────────────────────────────────────────────────────────────────
// La feina
// ─────────────────────────────────────────────────────────────────────────────

export function fitxaImatges(
  ine5: string,
  escut: ImatgeDesada | null,
  vista: ImatgeDesada | null,
  descarregat: string,
): FitxaImatges {
  return { font: FONT, ine5, descarregat, escut, vista };
}

export type OpcionsJ26 = {
  /** Arrel del repositori; només per a les proves. */
  arrel?: string;
  /** Quants municipis com a màxim, de més gran a més petit. */
  limit?: number;
};

export async function j26ImatgesMunicipi(db: Db, options: OpcionsJ26 = {}): Promise<void> {
  await withRun(db, "j26-imatges-municipi", async (run) => {
    const eines = await einesDisponibles();
    if (!eines.ok) {
      throw new Error(
        `falten les eines d'imatge: ${eines.falta.join(", ")}. ` +
          "sips ve amb macOS; cwebp s'instal·la amb «brew install webp».",
      );
    }

    for (const mena of ["escut", "vista"] as const) {
      await mkdir(directoriImatges(mena, options.arrel), { recursive: true });
    }
    run.say(`escuts a ${directoriImatges("escut", options.arrel)}`);
    run.say(`vistes a ${directoriImatges("vista", options.arrel)}`);

    const munis = await db
      .select({
        id: municipalities.id,
        ine5: municipalities.ine5,
        name: municipalities.name,
        population: municipalities.population,
      })
      .from(municipalities);

    const files = await db
      .select({ id: municipalityMetrics.municipalityId, data: municipalityMetrics.data })
      .from(municipalityMetrics)
      .where(eq(municipalityMetrics.kind, KIND_WIKIDATA));
    const perMunicipi = new Map<number, FitxaWikidata>();
    for (const fila of files) perMunicipi.set(fila.id, fila.data as FitxaWikidata);

    /*
     * De gran a petit, com J11: amb una hora de descàrregues, ser el primer de
     * la cua vol dir que si la cosa s'atura a mig matí les fitxes on mira més
     * gent ja tenen la seva imatge.
     */
    const ordenats = gransPrimer(munis);
    const feina = options.limit ? ordenats.slice(0, options.limit) : ordenats;
    run.rowsIn = feina.length;
    run.say(`${feina.length} municipis · ${perMunicipi.size} amb fitxa de Wikidata`);

    const avui = new Date().toISOString().slice(0, 10);
    const c = {
      ambEscut: 0, ambVista: 0, senseCap: 0,
      desades: 0, jaHiEren: 0, svg: 0, webp: 0,
      senseResposta: 0, illegibles: 0, errors: 0, peticions: 0,
    };
    let errorsSeguits = 0;

    for (const muni of feina) {
      const wiki = perMunicipi.get(muni.id);
      if (wiki === undefined) {
        // Sense fitxa de Wikidata no hi ha res a baixar. J20 ja va desar la
        // incidència de per què; repetir-la aquí només duplicaria la llista.
        c.senseCap += 1;
        continue;
      }

      const desades: { escut: ImatgeDesada | null; vista: ImatgeDesada | null } = { escut: null, vista: null };
      for (const [mena, imatge] of [["escut", wiki.escut], ["vista", wiki.imatge]] as const) {
        if (imatge === null) continue;
        try {
          const { estat, imatge: desada } = await baixaImatge(imatge, mena, muni.ine5, avui, options.arrel);
          if (estat === "desada") {
            c.desades += 1;
            c.peticions += 1;
            // La pausa només després d'haver demanat res: les represes, que
            // són la majoria a partir de la segona execució, van a disc i prou.
            await sleep(PAUSA_MS);
          } else if (estat === "ja-hi-era") c.jaHiEren += 1;
          else if (estat === "sense-resposta") { c.senseResposta += 1; c.peticions += 1; }
          else c.illegibles += 1;

          if (desada !== null) {
            desades[mena] = desada;
            if (desada.format === "svg") c.svg += 1;
            else c.webp += 1;
          }
          if (estat === "sense-resposta" || estat === "illegible") {
            await run.issue({
              kind: "imatge_municipi_no_desada",
              severity: "baixa",
              municipalityId: muni.id,
              entity: imatge.fitxer,
              detail: { nom: muni.name, mena, estat, url: urlDescarrega(imatge.fitxer) },
            });
          }
          errorsSeguits = 0;
        } catch (error) {
          /*
           * Una imatge que peta no pot endur-se el municipi: l'altra pot estar
           * bé i val més una fitxa amb escut i sense fotografia que cap de les
           * dues.
           */
          c.errors += 1;
          errorsSeguits += 1;
          await run.issue({
            kind: "imatge_municipi_error",
            severity: "baixa",
            municipalityId: muni.id,
            entity: imatge.fitxer,
            detail: { nom: muni.name, mena, error: String(error) },
          });
          if (errorsSeguits >= ERRORS_SEGUITS_MAXIM) {
            run.say(`${errorsSeguits} errors seguits: s'atura per no insistir-hi`);
            break;
          }
        }
      }

      if (desades.escut !== null) c.ambEscut += 1;
      if (desades.vista !== null) c.ambVista += 1;
      if (desades.escut === null && desades.vista === null) {
        c.senseCap += 1;
        continue;
      }

      const fitxa = fitxaImatges(muni.ine5, desades.escut, desades.vista, avui);
      await db
        .insert(municipalityMetrics)
        .values({ municipalityId: muni.id, kind: KIND, data: fitxa })
        .onConflictDoUpdate({
          target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
          set: { data: fitxa, computedAt: new Date() },
        });
      run.rowsOut += 1;

      if (errorsSeguits >= ERRORS_SEGUITS_MAXIM) break;
    }

    run.say(`municipis amb escut: ${c.ambEscut} · amb fotografia: ${c.ambVista} · sense cap imatge: ${c.senseCap}`);
    run.say(`fitxers: ${c.desades} nous, ${c.jaHiEren} ja hi eren (${c.svg} SVG servits verbatim, ${c.webp} WebP)`);
    run.say(`${c.senseResposta} sense resposta · ${c.illegibles} il·legibles · ${c.errors} errors`);
    run.say(`${c.peticions} peticions a Commons`);

    return {
      font: FONT,
      descarregat: avui,
      ...c,
      pesEscuts: await pesDirectori(directoriImatges("escut", options.arrel)),
      pesVistes: await pesDirectori(directoriImatges("vista", options.arrel)),
    };
  });
}

/** Quant ocupa cada directori, per tenir-ho a la traça de l'execució. */
async function pesDirectori(cami: string): Promise<string> {
  try {
    const { stdout } = await exec("du", ["-sh", cami]);
    return stdout.split(/\s+/)[0] ?? "?";
  } catch {
    return "?";
  }
}
