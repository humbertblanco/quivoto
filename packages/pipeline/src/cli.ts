import { openDb } from "@quivoto/db";
import { j1Territory } from "./jobs/j1-territory";
import { j2Results } from "./jobs/j2-results";
import { j3Councillors } from "./jobs/j3-councillors";
import { j4Candidates } from "./jobs/j4-candidates";
import { j5Context } from "./jobs/j5-context";
import { j6Finances } from "./jobs/j6-finances";
import { j7ContextObert } from "./jobs/j7-context-obert";
import { j8Diners } from "./jobs/j8-diners";
import { j9HabitatgeResidus } from "./jobs/j9-habitatge-residus";
import { j10Activitat } from "./jobs/j10-activitat";
import { j11Fotos } from "./jobs/j11-fotos";
import { j12Actes } from "./jobs/j12-actes";
import { j13FotosCiutats } from "./jobs/j13-fotos-ciutats";
import { j14ElectesCost } from "./jobs/j14-electes-cost";
import { j15DespesaServeis } from "./jobs/j15-despesa-serveis";
import { j16BarcelonaPlenari } from "./jobs/j16-barcelona-plenari";
import { j17Amb } from "./jobs/j17-amb";
import { j18Poblacio } from "./jobs/j18-poblacio";
import { j19Preus } from "./jobs/j19-preus";
import { j20Wikidata } from "./jobs/j20-wikidata";
import { deriveMetrics } from "./derive/metrics";
import { deriveMayorChanges } from "./derive/mayor-changes";
import { deriveFinances } from "./derive/finances";
import { deriveCouncilChanges } from "./derive/council-changes";
import { deriveTrajectoria } from "./derive/trajectoria";
import { report } from "./report";
import { publish } from "./publish/publish";

const COMMANDS = {
  j1: j1Territory,
  j2: j2Results,
  j3: j3Councillors,
  j4: (db: Parameters<typeof j4Candidates>[0]) => j4Candidates(db),
  j5: j5Context,
  j6: j6Finances,
  j7: j7ContextObert,
  j8: j8Diners,
  j9: j9HabitatgeResidus,
  j10: j10Activitat,
  j11: j11Fotos,
  j12: j12Actes,
  j13: j13FotosCiutats,
  j14: (db: Parameters<typeof j14ElectesCost>[0]) => j14ElectesCost(db),
  j15: j15DespesaServeis,
  j16: j16BarcelonaPlenari,
  j17: j17Amb,
  j18: j18Poblacio,
  j19: j19Preus,
  j20: (db: Parameters<typeof j20Wikidata>[0]) => j20Wikidata(db),
  derive: deriveMetrics,
  alcaldies: deriveMayorChanges,
  comptes: deriveFinances,
  ple: deriveCouncilChanges,
  trajectoria: deriveTrajectoria,
  report,
  publica: publish,
} as const;

type Command = keyof typeof COMMANDS;

// J5 va abans que J2: la participació i el sistema electoral condicionen el recompte.
/**
 * L'ordre de `all`. **Els que baixen fitxa a fitxa no hi són**: J11 (fotos i
 * composició del ple), J12 (actes), J13 (cares de les ciutats) i J14 (el que
 * publica cada ajuntament de les seves retribucions) fan milers de peticions a
 * servidors públics i triguen d'una a dues hores. Tenir-los aquí voldria dir
 * que qualsevol reingesta completa els torna a passar tots, castigant unes
 * fonts que ens deixen les dades de franc. S'executen a mà quan toca.
 *
 * J16 sí que hi és, i no és una excepció a la regla sinó un cas que no hi cau:
 * són **dues** peticions per a tot el mandat de Barcelona, no una per document.
 * Va després de J10 perquè necessita els municipis ja ingerits, i abans de
 * `derive` i `publica` perquè el vot per grup que desa és el que la fitxa de
 * Barcelona ha de publicar.
 *
 * J18 sí que hi és, tot i que el primer cop contra una base nova demana la
 * fitxa municipi a municipi. La diferència amb J19 és que aquí les 947
 * peticions es fan **una sola vegada**: només serveixen per obtenir l'enllaç
 * que la llicència de l'Idescat obliga a mostrar de cada municipi, i queden
 * desades. Les dades, que és el que canvia cada any, són una dotzena llarga de
 * crides per als 947 alhora. Una reingesta normal no torna a demanar cap fitxa.
 *
 * J20 sí que hi és, i no és cap excepció a la regla sinó un cas que no hi cau:
 * és **una** consulta SPARQL per als 947 municipis alhora i una trentena de
 * crides a Commons el primer cop, per llegir la llicència de cada imatge. Les
 * llicències ja llegides queden desades, així que una reingesta normal no en
 * torna a demanar cap. Va després de J18 perquè necessita els municipis ingerits.
 *
 * J19 tampoc hi és, i per la mateixa raó: el preu de l'aigua és una sola
 * descàrrega, però el rebut d'IBI de l'Idescat només es pot demanar municipi a
 * municipi —el seu paràmetre d'any no fa res— i són 947 peticions amb pausa.
 * S'executa a mà: `pnpm ingest j19`.
 */
const ORDER: Command[] = [
  "j1", "j5", "j2", "j3", "j4", "j6", "j7", "j8", "j9", "j15", "j10", "j16", "j17", "j18", "j20",
  "derive", "alcaldies", "comptes", "ple", "trajectoria", "report", "publica",
];

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  // «publica» accepta municipis darrere: `publica esplugues-de-llobregat girona`.
  const publishAt = args.indexOf("publica");
  const publishSlugs = publishAt === -1 ? [] : args.slice(publishAt + 1);
  const isAll = args.length === 0 || args[0] === "all";
  const requested = isAll
    ? ORDER
    : ((publishAt === -1 ? args : args.slice(0, publishAt + 1)) as Command[]);
  // Amb `all` es publiquen els 947: ingerir-ho tot i després generar-ne només
  // sis fitxes seria una trampa fàcil de no adonar-se'n.
  const slugs = isAll ? ["tots"] : publishSlugs;

  for (const command of requested) {
    if (!(command in COMMANDS)) {
      process.stderr.write(`ordre desconeguda: ${command}\nDisponibles: ${ORDER.join(", ")}, all\n`);
      process.exit(1);
    }
  }

  const { db, close, kind } = await openDb();
  process.stdout.write(`base de dades: ${kind}\n`);
  const started = Date.now();
  try {
    for (const command of requested) {
      if (command === "publica") await publish(db, slugs);
      else await COMMANDS[command](db);
    }
    process.stdout.write(`\nfet en ${Math.round((Date.now() - started) / 1000)} s\n`);
    // La feina ja és feta i desada: el que passi tancant la base de dades ja no
    // ha de fer fallar l'ordre.
    finished = true;
  } finally {
    await close();
  }
}

/**
 * PGlite atura el motor de WebAssembly de manera bruta després d'una sessió
 * llarga i llança l'error fora de qualsevol `try`. Quan això passa la feina ja
 * és feta i desada, així que ens interessa sortir bé: si no, una ingesta
 * correcta acaba amb codi 1 i trenca qualsevol `&&` que la faci servir.
 */
let finished = false;
for (const event of ["uncaughtException", "unhandledRejection"] as const) {
  process.on(event, (error: unknown) => {
    if (finished) process.exit(0);
    process.stderr.write(`\n${String((error as Error)?.stack ?? error)}\n`);
    process.exit(1);
  });
}

main()
  .then(() => {
    // Sortida explícita: PGlite deixa el motor de WebAssembly en un estat que a
    // vegades peta en aturar-se, i sense això una ingesta acabada i desada
    // sortiria amb codi d'error i semblaria que ha fallat.
    process.exit(0);
  })
  .catch((error) => {
    process.stderr.write(`\n${String(error?.stack ?? error)}\n`);
    process.exit(1);
  });
