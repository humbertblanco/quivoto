import { eq } from "drizzle-orm";
import { candidacies, candidatures, municipalities, people, type Db } from "@quivoto/db";
import { MUNICIPAL_ELECTIONS } from "@quivoto/shared-schemas/brands";
import { DATASETS, socrataPages } from "../adapters/socrata";
import { normalize, normalizePersonName, titleCase, toInt } from "../lib/text";
import { withRun } from "../lib/run";

type CandidateRow = {
  territori_codi: string;
  candidatura_codi: string;
  candidatura_sigles?: string;
  candidatura_denominacio?: string;
  candidat_nom: string;
  candidat_primer_cognom?: string;
  candidat_segon_cognom?: string;
  candidat_sexe?: string;
  candidat_posicio: string;
  candidat_tipus?: string;
  electe?: string;
};

/** El que desem d'una fila del dataset, llegit una sola vegada i sense xarxa. */
export type CandidatLlegit = {
  fullName: string;
  normalized: string;
  /** `null` quan la font no dona el número (llistes obertes del 2023). Mai un 0 inventat. */
  posicio: number | null;
  kind: string;
  elected: boolean;
};

/**
 * Llegeix una fila de candidat tal com la desarem. El motiu entre parèntesis
 * («Concepción(conxi) Sierra Martín») el treu `normalizePersonName`, que és la
 * mateixa clau amb què tot el projecte aparella persones: normalitzar aquí
 * igual que a J3 és el que fa que la mateixa persona no es dupliqui entre
 * fonts ni entre eleccions. Torna `null` quan no en surt cap nom, perquè una
 * fila sense nom no és ningú.
 */
export function llegeixCandidat(row: CandidateRow): CandidatLlegit | null {
  const fullName = [row.candidat_nom, row.candidat_primer_cognom, row.candidat_segon_cognom]
    .filter(Boolean)
    .join(" ")
    .trim();
  const normalized = normalizePersonName(fullName);
  if (!normalized) return null;
  return {
    fullName,
    normalized,
    // Un 0 o un buit no és cap número de llista: és que la font no el dona.
    posicio: (() => {
      const n = toInt(row.candidat_posicio);
      return n !== null && n !== undefined && n > 0 ? n : null;
    })(),
    kind: row.candidat_tipus ?? "Titular",
    elected: String(row.electe ?? "N").toUpperCase() === "S",
  };
}

/**
 * Una llista tal com la porta el cens de persones candidates (`xnfg-weec`):
 * el municipi, el codi de candidatura i com s'anomena.
 */
export type LlistaDelCens = {
  municipalityId: number;
  codi: string;
  sigles: string;
  denominacio: string | null;
};

/** Una candidatura del dataset de vots (`ntc4-rnwr`), tal com la desa J2. */
export type CandidaturaDelsVots = {
  id: number;
  municipalityId: number;
  codi: string;
  sigles: string;
  denominacio: string | null;
};

/** Com ha anat l'aparellament de les llistes d'una elecció, per al resum de la feina. */
export type Aparellament = {
  /** De la clau de cada llista (`clauDeLlista`) a l'id de la candidatura de J2. */
  parelles: Map<string, number>;
  perCodi: number;
  perSigles: number;
  perDenominacio: number;
  senseParella: LlistaDelCens[];
};

/**
 * La clau d'una llista del cens. Hi entren les sigles, i no només el codi,
 * perquè el cens del 2015 dona **el mateix codi a dues llistes diferents** del
 * mateix municipi (Vilanova del Vallès, 08902: «193» és ERC-AM i també VST).
 */
export function clauDeLlista(llista: Pick<LlistaDelCens, "municipalityId" | "codi" | "sigles">): string {
  return `${llista.municipalityId}|${llista.codi}|${llista.sigles}`;
}

/**
 * El codi de candidatura sense zeros al davant. El dataset de vots del 2019
 * escriu els codis locals de la demarcació de Barcelona amb nou xifres
 * («080194192», el PSC de Barcelona) i el cens de candidats amb vuit
 * («80194192»): és el mateix número, i sense això no lligava cap llista local
 * de 315 municipis.
 */
export function codiCanonic(codi: string): string {
  return codi.trim().replace(/^0+(?=\d)/, "");
}

/** Sigles o denominació reduïdes a lletres i xifres: «C's» i «Cs», «ERCAM» i «ERC-AM». */
function clauDeText(text: string | null | undefined): string {
  return text ? normalize(text).replace(/[^a-z0-9]/g, "") : "";
}

/**
 * Lliga cada llista del cens de candidats amb la candidatura que J2 va desar
 * dels resultats, municipi per municipi.
 *
 * ─── PER QUÈ NO N'HI HA PROU AMB EL CODI ────────────────────────────────────
 *
 * Els dos datasets de la Generalitat no sempre donen el mateix codi a la
 * mateixa llista. Comprovat el 27-10-2026 amb crides reals:
 *
 *   · **2019**: 820 de 3.542 llistes no lligaven pel codi literal, totes per
 *     un zero al davant (`codiCanonic`). Hi havia 2.150 persones electes.
 *   · **2015**: 478 llistes no lligaven, i aquí el codi és un altre de
 *     debò. El PSC de Barcelona és «842» als vots i «82924151» al cens; ERC,
 *     «80194153» i «170794152». Hi havia 1.163 persones electes.
 *
 * Sense aquestes llistes, la fitxa de Jaume Collboni deia «elegit per primera
 * vegada el 2023», quan és regidor des del 2015: les seves candidatures del
 * 2015 i del 2019 no havien entrat mai a la base.
 *
 * ─── L'ORDRE, I EL QUE NO ES FA ─────────────────────────────────────────────
 *
 *   1. **El codi**, sense zeros al davant. Si dues llistes del cens comparteixen
 *      codi, només el pren la que també porta les mateixes sigles.
 *   2. **Les sigles**, reduïdes a lletres i xifres, si són úniques als dos
 *      costats entre el que encara no s'ha lligat del municipi.
 *   3. **La denominació**, amb la mateixa exigència.
 *
 * El que queda es queda sense lligar, encara que al municipi només en quedi
 * una de cada costat: s'ha mirat i aquell «l'única que queda» aparellava
 * Solidaridad y Autogestión Internacionalista amb Solidaritat per la
 * Independència, i el Partit Llibertari amb Barcelona Ets Tu. Penjar a algú
 * les sigles d'una altra llista és pitjor que no dir-ne res; la publicació ja
 * sap callar quan d'una municipal hi falta alguna llista.
 */
export function aparellaLlistes(
  llistes: readonly LlistaDelCens[],
  candidatures: readonly CandidaturaDelsVots[],
): Aparellament {
  const resultat: Aparellament = { parelles: new Map(), perCodi: 0, perSigles: 0, perDenominacio: 0, senseParella: [] };
  const perMunicipi = <T extends { municipalityId: number }>(files: readonly T[]): Map<number, T[]> => {
    const grups = new Map<number, T[]>();
    for (const f of files) {
      const grup = grups.get(f.municipalityId);
      if (grup) grup.push(f);
      else grups.set(f.municipalityId, [f]);
    }
    return grups;
  };
  const candidaturesDe = perMunicipi(candidatures);
  const llistesDe = perMunicipi(llistes);

  for (const [municipalityId, delMunicipi] of llistesDe) {
    const lliures = new Set(candidaturesDe.get(municipalityId) ?? []);
    const pendents = new Set(delMunicipi);
    const lliga = (llista: LlistaDelCens, candidatura: CandidaturaDelsVots): void => {
      resultat.parelles.set(clauDeLlista(llista), candidatura.id);
      lliures.delete(candidatura);
      pendents.delete(llista);
    };

    // 1. El codi. Si als vots dos codis només es distingeixen pels zeros, mana el literal.
    for (const llista of [...pendents]) {
      const codi = codiCanonic(llista.codi);
      const mateixCodi = [...lliures].filter((c) => codiCanonic(c.codi) === codi);
      const literals = mateixCodi.filter((c) => c.codi === llista.codi);
      const triada = mateixCodi.length === 1 ? mateixCodi[0]! : literals.length === 1 ? literals[0]! : null;
      if (triada === null) continue;
      const germanes = [...pendents].filter((o) => codiCanonic(o.codi) === codi);
      if (germanes.length > 1 && clauDeText(triada.sigles) !== clauDeText(llista.sigles)) continue;
      lliga(llista, triada);
      resultat.perCodi += 1;
    }

    // 2 i 3. Les sigles i després la denominació, només si són úniques als dos costats.
    for (const camp of ["sigles", "denominacio"] as const) {
      const tanda = [...pendents];
      for (const llista of tanda) {
        const clau = clauDeText(llista[camp]);
        if (clau === "") continue;
        if (tanda.filter((o) => clauDeText(o[camp]) === clau).length !== 1) continue;
        const iguals = [...lliures].filter((c) => clauDeText(c[camp]) === clau);
        if (iguals.length !== 1) continue;
        lliga(llista, iguals[0]!);
        if (camp === "sigles") resultat.perSigles += 1;
        else resultat.perDenominacio += 1;
      }
    }

    resultat.senseParella.push(...pendents);
  }
  return resultat;
}

/**
 * J4 — les llistes senceres de les tres municipals: 2023, 2019 i 2015.
 *
 * Serveixen per a quatre coses: saber qui encapçalava cada llista
 * (l'alcaldable), poder mesurar la paritat i la renovació, tenir ja creades
 * les persones que el 2027 tornaran a presentar-se, i —des que s'ingereixen
 * les tres eleccions— poder dir de cada persona del ple quantes vegades ha
 * anat a llistes i des de quan la hi elegeixen.
 *
 * Comprovat el 31-08-2026 amb crides reals: `xnfg-weec` porta les persones
 * candidates amb `electe` i `candidat_posicio` de les municipals des del 2011
 * (M20151: 42.867 files; M20191: 43.543; M20231: 43.710); de les anteriors al
 * 2011 només en porta ~8.300 per elecció, que no són les llistes senceres.
 * S'ingereixen les mateixes tres que J2 ja carrega de resultats.
 *
 * Cada llista del cens es penja de la candidatura que J2 va desar dels vots, i
 * fins a l'octubre del 2026 això es feia només pel codi literal: 1.298 llistes
 * del 2015 i del 2019 (3.313 persones electes) es quedaven fora sense fer
 * soroll. Ara ho fa `aparellaLlistes`, que explica per què i amb quins límits.
 *
 * Les persones es reaprofiten per `name_normalized`, la mateixa clau i la
 * mateixa exigència que fins ara: la mateixa dona a la llista del 2015 i a la
 * del 2023 és una sola fila, i no s'hi afegeix cap heurística nova, perquè
 * una fusió equivocada és pitjor que un duplicat.
 */
export async function j4Candidates(db: Db, electionIds: readonly string[] = MUNICIPAL_ELECTIONS): Promise<void> {
  for (const electionId of electionIds) {
    await j4CandidatesEleccio(db, electionId);
  }
}

async function j4CandidatesEleccio(db: Db, electionId: string): Promise<void> {
  await withRun(db, `J4 llistes ${electionId}`, async (run) => {
    const municipalityByIne = new Map<string, number>();
    for (const m of await db.select().from(municipalities)) municipalityByIne.set(m.ine5, m.id);

    const candidaturesDeLEleccio: CandidaturaDelsVots[] = await db
      .select({
        id: candidatures.id,
        municipalityId: candidatures.municipalityId,
        codi: candidatures.candidaturaCodi,
        sigles: candidatures.sigles,
        denominacio: candidatures.denominacio,
      })
      .from(candidatures)
      .where(eq(candidatures.electionId, electionId));

    // Cau de persones en memòria: sense això farien falta 43.710 consultes.
    // Es torna a llegir a cada elecció perquè l'anterior n'ha creat de noves.
    const peopleCache = new Map<string, number>();
    for (const p of await db.select({ id: people.id, key: people.nameNormalized }).from(people)) {
      peopleCache.set(p.key, p.id);
    }

    // Primer es llegeix l'elecció sencera i després s'aparellen les llistes:
    // el codi no sempre lliga (vegeu `aparellaLlistes`), i per lligar pel nom
    // cal veure totes les llistes del municipi alhora. Són ~43.000 files de
    // deu camps curts, que caben de sobres a la memòria.
    const files: { row: CandidateRow; municipalityId: number; clau: string }[] = [];
    const llistes = new Map<string, LlistaDelCens>();
    for await (const page of socrataPages<CandidateRow>(
      DATASETS.candidats,
      {
        filters: { id_eleccio: electionId },
        select:
          "territori_codi,candidatura_codi,candidatura_sigles,candidatura_denominacio,candidat_nom,candidat_primer_cognom,candidat_segon_cognom,candidat_sexe,candidat_posicio,candidat_tipus,electe",
      },
      5_000,
    )) {
      run.rowsIn += page.length;
      for (const row of page) {
        // Els codis INE es comparen amb cinc xifres: el dataset de vots del
        // 2019 escriu Olivella «8148», i podria passar també en aquest.
        const municipalityId = municipalityByIne.get(String(row.territori_codi ?? "").padStart(5, "0"));
        if (!municipalityId) continue;
        const llista: LlistaDelCens = {
          municipalityId,
          codi: row.candidatura_codi,
          sigles: row.candidatura_sigles ?? "",
          denominacio: row.candidatura_denominacio ?? null,
        };
        const clau = clauDeLlista(llista);
        if (!llistes.has(clau)) llistes.set(clau, llista);
        files.push({ row, municipalityId, clau });
      }
      if (run.rowsIn % 20_000 === 0) run.say(`${run.rowsIn} files llegides`);
    }

    const aparellament = aparellaLlistes([...llistes.values()], candidaturesDeLEleccio);
    run.say(
      `${llistes.size} llistes: ${aparellament.perCodi} lligades pel codi, ${aparellament.perSigles} per les sigles, ` +
        `${aparellament.perDenominacio} per la denominació i ${aparellament.senseParella.length} sense lligar`,
    );

    let missingCandidature = 0;
    for (const { row, clau } of files) {
      const candidatureId = aparellament.parelles.get(clau);
      if (!candidatureId) {
        missingCandidature += 1;
        continue;
      }

      const candidat = llegeixCandidat(row);
      if (!candidat) continue;

      let personId = peopleCache.get(candidat.normalized);
      if (!personId) {
        const [created] = await db
          .insert(people)
          .values({
            firstName: row.candidat_nom ?? null,
            lastName1: row.candidat_primer_cognom ?? null,
            lastName2: row.candidat_segon_cognom ?? null,
            fullName: titleCase(candidat.fullName),
            nameNormalized: candidat.normalized,
            sex: row.candidat_sexe ?? null,
          })
          .returning({ id: people.id });
        personId = created!.id;
        peopleCache.set(candidat.normalized, personId);
      }

      await db
        .insert(candidacies)
        .values({
          candidatureId,
          personId,
          listPosition: candidat.posicio,
          isHead: candidat.posicio === 1 && candidat.kind === "Titular",
          kind: candidat.kind,
          elected: candidat.elected,
          status: candidat.elected ? "elected" : "proclaimed",
        })
        .onConflictDoNothing();
      run.rowsOut += 1;
    }

    if (missingCandidature > 0) {
      // Les llistes que no s'han pogut lligar amb certesa no entren: la
      // publicació veu que a aquella municipal del municipi hi falta una
      // llista i no en fa cap afirmació que depengui de l'absència.
      await run.issue({
        kind: "candidacy_without_candidature",
        severity: "mitjana",
        detail: {
          files: missingCandidature,
          llistes: aparellament.senseParella.length,
          exemples: aparellament.senseParella
            .slice(0, 25)
            .map((l) => ({ municipalityId: l.municipalityId, codi: l.codi, sigles: l.sigles })),
          nota: "llistes del cens de candidats que no lliguen amb cap candidatura de J2 ni pel codi ni pel nom",
        },
      });
    }
    return {
      files: run.rowsIn,
      lligades_pel_codi: aparellament.perCodi,
      lligades_per_sigles: aparellament.perSigles,
      lligades_per_denominacio: aparellament.perDenominacio,
      llistes_sense_lligar: aparellament.senseParella.length,
      sense_candidatura: missingCandidature,
    };
  });
}
