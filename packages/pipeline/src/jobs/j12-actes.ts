import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { sql } from "drizzle-orm";
import { ACTES_RESOURCE, ckanSql, MANDATE_START } from "../adapters/aoc";
import {
  esPdf,
  extreuActa,
  textDelPdf,
  type PuntActa,
  type SentitVot,
} from "../adapters/actes";
import { sleep } from "../lib/http";
import { withRun, type Run } from "../lib/run";

/**
 * J12 — què s'ha votat al ple, i qui hi ha votat què.
 *
 * Fins aquí el projecte comptava actes; aquesta feina les llegeix. Baixa els PDF
 * de l'acteca de l'AOC, en treu els punts de l'ordre del dia i, quan l'acta ho
 * desglossa, el vot de cada grup municipal amb la cita literal i l'enllaç al
 * document. És el material amb què es podrà respondre «què han fet aquests
 * quatre anys al meu poble».
 *
 * **Comença pels municipis de més de 20.000 habitants i prou.** No és una
 * decisió de comoditat: al tram de menys de 5.000, 77 de 79 punts votats
 * s'aproven per unanimitat i, amb una extracció perfecta, el poder discriminant
 * seria zero. Amb 70 municipis cobrim el 72% de la població amb evidència de vot
 * real (vegeu `docs/EXTRACCIO-ACTES.md`).
 *
 * **Sense cap model de llenguatge.** Aquesta primera versió és tota expressions
 * regulars i heurístiques perquè volem la xifra honesta de fins on s'arriba
 * sense IA abans de decidir si val la pena pagar-ne.
 */

const FONT = "Índex d'actes de sessions, dades obertes de l'AOC";
const FONT_URL = "https://dadesobertes.seu-e.cat/dataset/agn-a-actes-de-sessions";

/** Els PDF i el text pesen molt i no entren al repositori: `.data/` és ignorat. */
const DIRECTORI_ACTES =
  process.env.QUIVOTO_ACTES_DIR ?? new URL("../../../db/.data/actes/", import.meta.url).pathname;

/** Com a molt quatre descàrregues alhora. La font és d'un consorci públic. */
const PARAL·LEL = 4;

/** Pausa entre descàrregues d'un mateix fil, per no martellejar l'acteca. */
const PAUSA_MS = 250;

const MIDA_MAXIMA = 80 * 1024 * 1024;

type FilaIndex = {
  CODI_ENS: number | string;
  NOM_ENS: string;
  DATA_ACORD: string;
  TIPUS: string;
  CODI_ACTA: string;
  "ENLLAÇ_ACTA": string;
};

type ActaBaixada = {
  codiActa: string;
  data: string;
  tipus: string;
  url: string;
  sha256: string;
  text: string;
};

/**
 * Un punt tal com es desa. Guardem la cita i l'enllaç al costat del vot perquè
 * la regla del projecte és que cap dada es publica sense font: qui llegeixi la
 * fitxa ha de poder obrir el PDF i llegir-hi la frase.
 */
type PuntDesat = {
  data: string;
  codiActa: string;
  url: string;
  numero: string | null;
  titol: string;
  tipus: PuntActa["tipus"];
  proposant: string | null;
  resultat: string | null;
  unanimitat: boolean;
  recompte: Record<SentitVot, number | null> | null;
  vots: { grup: string; sentit: SentitVot; vots: number | null }[];
  cita: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────

const nomFitxer = (codiActa: string): string => codiActa.replace(/[^A-Za-z0-9_-]/g, "_");

/**
 * `CODI_ENS` és un enter al conjunt de l'AOC i els municipis de Barcelona hi
 * perden el zero inicial: «0818780001» hi arriba com a 818780001. Sense
 * restituir-lo, Sabadell no lliga amb la taula de municipis.
 */
const codiEns10 = (valor: number | string): string => String(valor).padStart(10, "0");

/**
 * Descàrrega amb memòria. Si el PDF ja és al disc i el text també, no es torna a
 * demanar res: una sola passada per als 70 municipis són uns 3.000 documents i
 * gairebé quatre gigabytes, i repetir-ho a cada execució seria maleducat amb la
 * font i lent per a nosaltres.
 */
async function baixaActa(fila: FilaIndex, run: Run, municipalityId: number): Promise<ActaBaixada | null> {
  const codiEns = codiEns10(fila.CODI_ENS);
  const codiActa = String(fila.CODI_ACTA);
  const url = String(fila["ENLLAÇ_ACTA"]);
  const data = String(fila.DATA_ACORD).slice(0, 10);
  const carpeta = `${DIRECTORI_ACTES}${codiEns}/`;
  const basePdf = `${carpeta}${nomFitxer(codiActa)}.pdf`;
  const baseTxt = `${carpeta}${nomFitxer(codiActa)}.txt`;

  const jaHiEs = await stat(baseTxt).then(() => true).catch(() => false);
  if (jaHiEs) {
    const text = await readFile(baseTxt, "utf8");
    const pdf = await readFile(basePdf).catch(() => null);
    return {
      codiActa,
      data,
      tipus: String(fila.TIPUS ?? ""),
      url,
      sha256: pdf ? createHash("sha256").update(pdf).digest("hex") : "",
      text,
    };
  }

  await mkdir(carpeta, { recursive: true });
  await sleep(PAUSA_MS);

  let dades: Buffer;
  try {
    const resposta = await fetch(url, {
      headers: { "user-agent": "quivoto/0.1 (brúixola electoral municipal; hola@quivoto.cat)" },
      signal: AbortSignal.timeout(120_000),
    });
    if (!resposta.ok) {
      await run.issue({
        kind: "acta_no_descarregable",
        severity: "baixa",
        municipalityId,
        entity: codiActa,
        detail: { estat: resposta.status, url },
      });
      return null;
    }
    dades = Buffer.from(await resposta.arrayBuffer());
  } catch (error) {
    await run.issue({
      kind: "acta_no_descarregable",
      severity: "baixa",
      municipalityId,
      entity: codiActa,
      detail: { error: String(error).slice(0, 200), url },
    });
    return null;
  }

  if (dades.length > MIDA_MAXIMA) {
    await run.issue({
      kind: "acta_massa_gran",
      severity: "baixa",
      municipalityId,
      entity: codiActa,
      detail: { bytes: dades.length, url },
    });
    return null;
  }

  // Sorpresa verificada: l'acteca serveix .doc i .docx amb l'URL acabada en
  // `.pdf` (Castelldefels, Sant Pere de Ribes). `pdftotext` hi peta sense dir
  // per què, i per això ho mirem abans.
  if (!esPdf(dades)) {
    await run.issue({
      kind: "acta_no_es_pdf",
      severity: "mitjana",
      municipalityId,
      entity: codiActa,
      detail: { url, capçalera: dades.subarray(0, 8).toString("hex") },
    });
    return null;
  }

  await writeFile(basePdf, dades);
  let text: string;
  try {
    text = await textDelPdf(basePdf);
  } catch (error) {
    await run.issue({
      kind: "acta_illegible",
      severity: "mitjana",
      municipalityId,
      entity: codiActa,
      detail: { error: String(error).slice(0, 200), url },
    });
    return null;
  }
  await writeFile(baseTxt, text);

  return {
    codiActa,
    data,
    tipus: String(fila.TIPUS ?? ""),
    url,
    sha256: createHash("sha256").update(dades).digest("hex"),
    text,
  };
}

/** Executa `feina` sobre `elements` amb un màxim de `PARAL·LEL` alhora. */
async function enParal·lel<T, R>(elements: T[], feina: (element: T) => Promise<R>): Promise<R[]> {
  const resultats: R[] = new Array(elements.length);
  let seguent = 0;
  const fil = async (): Promise<void> => {
    while (seguent < elements.length) {
      const i = seguent;
      seguent += 1;
      resultats[i] = await feina(elements[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARAL·LEL, elements.length) }, fil));
  return resultats;
}

/**
 * Del resultat de l'extracció al que es desa. Els punts sense votació i sense
 * interès («s'aprova l'acta anterior») es compten però no s'hi guarden un per un:
 * el jsonb de 70 municipis creixeria fins a fer nosa i no responen la pregunta.
 */
function valLaPenaDesar(punt: PuntActa): boolean {
  if (punt.tipus === "mocio" || punt.tipus === "declaracio") return true;
  if (!punt.votacio) return false;
  // Una votació dividida sempre val: és exactament el que diferencia els grups.
  if (punt.votacio.perGrup.length > 0) return true;
  return !punt.votacio.unanimitat;
}

/** Resum per grup: quantes vegades ha votat cada cosa, dins d'aquest municipi. */
function resumPerGrup(punts: PuntDesat[]): { grup: string; favor: number; contra: number; abstencio: number; blanc: number; punts: number }[] {
  const compte = new Map<string, { favor: number; contra: number; abstencio: number; blanc: number; punts: number }>();
  for (const punt of punts) {
    for (const vot of punt.vots) {
      const fila = compte.get(vot.grup) ?? { favor: 0, contra: 0, abstencio: 0, blanc: 0, punts: 0 };
      if (vot.sentit !== "absent") fila[vot.sentit] += 1;
      fila.punts += 1;
      compte.set(vot.grup, fila);
    }
  }
  return [...compte]
    .map(([grup, fila]) => ({ grup, ...fila }))
    .sort((a, b) => b.punts - a.punts);
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * ATURAT A PROPÒSIT: la descàrrega massiva d'actes no es fa.
 *
 * El `robots.txt` de `media.seu-e.cat` prohibeix la ruta `acteca`, que és on viuen els
 * PDF, i el de `seu-e.cat` prohibeix expressament les rutes d'actes de ple i el
 * recurs del conjunt `agn-ag-actes-de-ple`. `docs/FONTS-AOC.md` ja ho havia
 * recollit com a regla del projecte i ho vam passar per alt en escriure aquesta
 * feina: baixar-ne tres mil PDF a setze peticions per segon és exactament el
 * que el consorci demana que no es faci.
 *
 * Un projecte que demana als ajuntaments que siguin transparents no pot
 * començar saltant-se el que aquests ajuntaments han dit que no vol. Que la
 * informació sigui pública no vol dir que se'n pugui fer una còpia massiva
 * sense preguntar.
 *
 * **El camí correcte és demanar-ho.** L'avís legal de seu-e preveu la
 * «reutilització de documents prèvia sol·licitud» (art. 10 de la Llei 37/2007),
 * i és una petició d'una pàgina. Fins que no hi hagi resposta per escrit,
 * aquesta feina només s'executa amb `QUIVOTO_ACTES_AUTORITZAT=1`, que s'ha de
 * posar **quan es tingui el permís i no abans**.
 *
 * Mentrestant hi ha una via que sí que és neta i que cobreix el municipi més
 * gran: `adapters/barcelona.ts`, que llegeix el conjunt obert d'acords del
 * plenari de Barcelona amb el vot de cada grup.
 */
const AUTORITZAT = process.env.QUIVOTO_ACTES_AUTORITZAT === "1";

export async function j12Actes(
  db: Db,
  options?: { minPopulation?: number; maxActesPerMunicipi?: number },
): Promise<void> {
  if (!AUTORITZAT) {
    process.stdout.write(
      "\n▸ J12 actes de ple\n" +
      "  ATURAT: el robots.txt de media.seu-e.cat i de seu-e.cat no permet baixar les actes.\n" +
      "  Cal demanar la reutilització a l'AOC (art. 10 de la Llei 37/2007) i, amb el permís\n" +
      "  per escrit, executar-ho amb QUIVOTO_ACTES_AUTORITZAT=1.\n",
    );
    return;
  }

  const minPopulation = options?.minPopulation ?? 20_000;
  /**
   * Sense límit, una passada completa són ~3.100 PDF i prop de cinc gigabytes.
   * `maxActesPerMunicipi` agafa les N actes més recents de cada municipi: és el
   * que permet mesurar la qualitat de l'extracció en mitja hora i sense omplir
   * el disc, i és amb què s'han obtingut les xifres publicades del mètode.
   */
  const maxActesPerMunicipi = options?.maxActesPerMunicipi;

  await withRun(db, "j12-actes", async (run) => {
    const municipis = await db
      .select({
        id: municipalities.id,
        nom: municipalities.name,
        codiEns: municipalities.codiEns,
        poblacio: municipalities.population,
      })
      .from(municipalities)
      .where(sql`${municipalities.population} >= ${minPopulation}`)
      .orderBy(sql`${municipalities.population} desc`);

    run.say(`${municipis.length} municipis de ${minPopulation.toLocaleString("ca-ES")} habitants o més`);

    // L'índex de tot el mandat en una sola consulta per lots: el `CODI_ENS` de
    // l'AOC és un enter, així que hi entrem sense el zero inicial.
    const perCodiEns = new Map(municipis.map((m) => [m.codiEns, m]));
    const files: FilaIndex[] = [];
    const codis = municipis.map((m) => Number.parseInt(m.codiEns, 10));
    for (let i = 0; i < codis.length; i += 20) {
      const lot = codis.slice(i, i + 20);
      files.push(
        ...(await ckanSql<FilaIndex>(
          `SELECT "CODI_ENS","NOM_ENS","DATA_ACORD","TIPUS","CODI_ACTA","ENLLAÇ_ACTA"
           FROM "${ACTES_RESOURCE}"
           WHERE "CODI_ENS" IN (${lot.join(",")}) AND "DATA_ACORD" >= '${MANDATE_START}'`,
        )),
      );
    }
    run.rowsIn = files.length;
    run.say(`${files.length} actes indexades des del ${MANDATE_START}`);

    // L'índex té duplicats de la mateixa sessió (verificat a Girona, dues i tres
    // còpies). Deduplicar per CODI_ACTA abans de baixar res.
    const perMunicipi = new Map<number, FilaIndex[]>();
    const vistos = new Set<string>();
    for (const fila of files) {
      const codiActa = String(fila.CODI_ACTA);
      if (vistos.has(codiActa)) continue;
      vistos.add(codiActa);
      const municipi = perCodiEns.get(codiEns10(fila.CODI_ENS));
      if (!municipi) continue;
      const llista = perMunicipi.get(municipi.id) ?? [];
      llista.push(fila);
      perMunicipi.set(municipi.id, llista);
    }

    // Comptadors globals: són el que respon «fins on arriba això sense IA».
    let actesLlegides = 0;
    let actesFallides = 0;
    let actesJuntaDeGovern = 0;
    let actesSenseOrgan = 0;
    let puntsTotal = 0;
    let puntsAmbVotacio = 0;
    let puntsAmbGrup = 0;
    let puntsUnanimes = 0;
    let mocionsTotal = 0;
    let mocionsAmbGrup = 0;

    for (const municipi of municipis) {
      let llista = (perMunicipi.get(municipi.id) ?? []).sort((a, b) =>
        String(a.DATA_ACORD).localeCompare(String(b.DATA_ACORD)),
      );
      if (maxActesPerMunicipi !== undefined && llista.length > maxActesPerMunicipi) {
        llista = llista.slice(-maxActesPerMunicipi);
      }
      if (llista.length === 0) {
        await run.issue({
          kind: "municipi_sense_actes",
          severity: "alta",
          municipalityId: municipi.id,
          entity: municipi.nom,
          detail: { motiu: "cap registre a l'índex obert de l'AOC per al mandat actual" },
        });
        continue;
      }

      const baixades = (await enParal·lel(llista, (fila) => baixaActa(fila, run, municipi.id))).filter(
        (a): a is ActaBaixada => a !== null,
      );
      actesFallides += llista.length - baixades.length;

      const punts: PuntDesat[] = [];
      let omesos = 0;
      let plens = 0;
      let darrera = "";

      for (const acta of baixades) {
        const extreta = extreuActa(acta.text);
        // El camp TIPUS de l'AOC mai no diu l'òrgan i el dataset porta un 1-3%
        // de juntes de govern: si les ingerim com si fossin plens, publicarem
        // acords que el ple no ha votat mai.
        if (extreta.organ === "junta_de_govern") {
          actesJuntaDeGovern += 1;
          continue;
        }
        if (extreta.organ === "desconegut") actesSenseOrgan += 1;
        plens += 1;
        actesLlegides += 1;
        if (acta.data > darrera) darrera = acta.data;

        for (const punt of extreta.punts) {
          puntsTotal += 1;
          if (punt.votacio) puntsAmbVotacio += 1;
          if (punt.votacio?.unanimitat) puntsUnanimes += 1;
          if (punt.votacio && punt.votacio.perGrup.length > 0) puntsAmbGrup += 1;
          if (punt.tipus === "mocio") {
            mocionsTotal += 1;
            if (punt.votacio && punt.votacio.perGrup.length > 0) mocionsAmbGrup += 1;
          }
          if (!valLaPenaDesar(punt)) {
            omesos += 1;
            continue;
          }
          punts.push({
            data: acta.data,
            codiActa: acta.codiActa,
            url: acta.url,
            numero: punt.numero,
            titol: punt.titol.slice(0, 300),
            tipus: punt.tipus,
            proposant: punt.proposant,
            resultat: punt.votacio?.resultat ?? null,
            unanimitat: punt.votacio?.unanimitat ?? false,
            recompte: punt.votacio?.recompte ?? null,
            vots: punt.votacio?.perGrup ?? [],
            cita: punt.votacio ? punt.votacio.cita.slice(0, 400) : null,
          });
        }
      }

      if (plens === 0) continue;

      const ambGrup = punts.filter((p) => p.vots.length > 0).length;
      await db
        .insert(municipalityMetrics)
        .values({
          municipalityId: municipi.id,
          kind: "mocions",
          data: {
            font: FONT,
            fontUrl: FONT_URL,
            metode: "expressions regulars sobre el text de l'acta, sense model de llenguatge",
            mandatDesDe: MANDATE_START,
            actes: {
              indexades: llista.length,
              llegides: plens,
              fallides: llista.length - baixades.length,
              darrera: darrera || null,
            },
            punts: {
              desats: punts.length,
              omesos,
              ambVotPerGrup: ambGrup,
            },
            grups: resumPerGrup(punts),
            llista: punts,
          },
          computedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
          set: {
            data: sql`excluded.data`,
            computedAt: sql`excluded.computed_at`,
          },
        });
      run.rowsOut += 1;
      run.say(`${municipi.nom}: ${plens} actes, ${punts.length} punts desats, ${ambGrup} amb vot per grup`);
    }

    const pct = (part: number, tot: number): string => (tot === 0 ? "—" : `${Math.round((100 * part) / tot)}%`);
    run.say(
      `actes: ${actesLlegides} llegides, ${actesJuntaDeGovern} juntes de govern descartades, ` +
        `${actesSenseOrgan} sense òrgan identificat, ${actesFallides} no descarregades`,
    );
    run.say(
      `punts: ${puntsTotal} · amb votació ${puntsAmbVotacio} (${pct(puntsAmbVotacio, puntsTotal)}) · ` +
        `amb vot per grup ${puntsAmbGrup} (${pct(puntsAmbGrup, puntsTotal)}) · unànimes ${puntsUnanimes}`,
    );
    run.say(`mocions: ${mocionsTotal} · amb vot per grup ${mocionsAmbGrup} (${pct(mocionsAmbGrup, mocionsTotal)})`);

    return {
      municipis: run.rowsOut,
      actesLlegides,
      actesJuntaDeGovern,
      actesSenseOrgan,
      actesFallides,
      puntsTotal,
      puntsAmbVotacio,
      puntsAmbGrup,
      puntsUnanimes,
      mocionsTotal,
      mocionsAmbGrup,
    };
  });
}
