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
import { j21TrajectoriaElectes } from "./jobs/j21-trajectoria-electes";
import { j22Retribucions } from "./jobs/j22-retribucions";
import { j23Riquesa } from "./jobs/j23-riquesa";
import { j24Diputacions } from "./jobs/j24-diputacions";
import { j26ImatgesMunicipi } from "./jobs/j26-imatges-municipi";
import { j27CapsDeLlista } from "./jobs/j27-caps-de-llista";
import { j29Criminalitat } from "./jobs/j29-criminalitat";
import { j30SousConsells } from "./jobs/j30-sous-consells";
import { j28FotosExalcaldes } from "./jobs/j28-fotos-exalcaldes";
import { j31AlcaldiesWikidata } from "./jobs/j31-alcaldies-wikidata";
import { j34Vehicles } from "./jobs/j34-vehicles";
import { j35AlcaldesMinisteri } from "./jobs/j35-alcaldes-ministeri";
import { j37LlistesObertes } from "./jobs/j37-llistes-obertes";
import { j36CensElectoral } from "./jobs/j36-cens-electoral";
import { j33MunicipiWikidata } from "./jobs/j33-municipi-wikidata";
import { j32Territori } from "./jobs/j32-territori";
import { j38EnsSupramunicipals } from "./jobs/j38-ens-supramunicipals";
import { j39SubvencionsEns } from "./jobs/j39-subvencions-ens";
import { j40UrbanismeHabitatge } from "./jobs/j40-urbanisme-habitatge";
import { j41DinersGeneralitat } from "./jobs/j41-diners-generalitat";
import { j42ServeisEns } from "./jobs/j42-serveis-ens";
import { j43AltresEleccions } from "./jobs/j43-altres-eleccions";
import { j44Socioeconomia } from "./jobs/j44-socioeconomia";
import { j45Gaip } from "./jobs/j45-gaip";
import { j46HabitatgesTuristics } from "./jobs/j46-habitatges-turistics";
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
  j21: j21TrajectoriaElectes,
  j22: (db: Parameters<typeof j22Retribucions>[0]) => j22Retribucions(db),
  j23: (db: Parameters<typeof j23Riquesa>[0]) => j23Riquesa(db),
  j24: (db: Parameters<typeof j24Diputacions>[0]) => j24Diputacions(db),
  j26: (db: Parameters<typeof j26ImatgesMunicipi>[0]) => j26ImatgesMunicipi(db),
  // J27 va a mà, com J21 però pel nom: `pnpm ingest j27`. No és a `ORDER`.
  j27: j27CapsDeLlista,
  j29: j29Criminalitat,
  // J30 va a mà, com J24 però fitxa a fitxa: el que cada consell comarcal
  // publica del que paga als seus consellers. No és a `ORDER`.
  j30: j30SousConsells,
  // J28 també a mà i després de J21: baixa retrats de Commons d'exalcaldes.
  j28: (db: Parameters<typeof j28FotosExalcaldes>[0]) => j28FotosExalcaldes(db),
  // J31 també a mà i després de J20: les alcaldies segons Wikidata, que
  // «alcaldies» fusiona amb l'historial de la Generalitat. No és a `ORDER`.
  j31: (db: Parameters<typeof j31AlcaldiesWikidata>[0]) => j31AlcaldiesWikidata(db),
  j34: j34Vehicles,
  // J35 també a mà i després de J5: els alcaldes de cada mandat segons el
  // Ministeri (SIL), amb la data de baixa, que «alcaldies» fusiona darrere de
  // Wikidata. Onze XLSX; necessita `python3` amb `openpyxl`. No és a `ORDER`.
  j35: (db: Parameters<typeof j35AlcaldesMinisteri>[0]) => j35AlcaldesMinisteri(db),
  // J37 també a mà i després de J1: el vot per persona a les llistes obertes,
  // dels zips del Ministeri de l'Interior (1979-2023), desats a
  // `packages/db/.data/infoelectoral/`. Necessita `python3`. No és a `ORDER`.
  j37: (db: Parameters<typeof j37LlistesObertes>[0]) => j37LlistesObertes(db),
  // J36: el cens i la participació de les dotze municipals des del 1979, del
  // mateix conjunt que J5 però sencer. Una sola crida paginada; només llegeix
  // la taula de municipis. Va a mà, després de J1. No és a `ORDER`.
  j36: j36CensElectoral,
  // J33 també a mà i després de J20: agermanaments i persones nascudes al
  // municipi segons Wikidata, per a la fitxa i les curiositats. No és a `ORDER`.
  j33: (db: Parameters<typeof j33MunicipiWikidata>[0]) => j33MunicipiWikidata(db),
  // J32: superfície, altitud i gentilici, del mateix conjunt que J1. Una sola
  // consulta per als 947; va just després de J1 perquè en llegeix el padró.
  j32: j32Territori,
  // J38 va a mà, després de J3 i de J24: les fitxes de les quatre diputacions i
  // dels quaranta consells comarcals (ple, presidència, comptes del 2010 ençà i
  // districtes), desades a la seu de cada ens. Una vintena de consultes
  // agregades i les dues pàgines de diputació que ja llegeix J24. No és a `ORDER`.
  j38: j38EnsSupramunicipals,
  // J39 també a mà i després de J38: el que cada diputació i consell ha
  // concedit als ajuntaments segons el RAISC, en consultes agregades. No és a `ORDER`.
  j39: (db: Parameters<typeof j39SubvencionsEns>[0]) => j39SubvencionsEns(db),
  // J40 a mà, després de J1: pla urbanístic vigent, pisos turístics, cost del
  // lloguer sobre els ingressos, HPO del 2002 ençà i zona tensa. Tres conjunts
  // de Socrata (~25.600 files); només llegeix la taula de municipis. No és a `ORDER`.
  j40: j40UrbanismeHabitatge,
  // J41 a mà i després de J1 (fa servir municipalities.codiEns): FCL, obres del
  // PUOSC, trameses de comptes i el que deu la Generalitat, per municipi i per ens.
  j41: (db: Parameters<typeof j41DinersGeneralitat>[0]) => j41DinersGeneralitat(db),
  // J42 a mà, després de J38: serveis socials bàsics (persones ateses i SAD) dels
  // consells i dels municipis que són àrea bàsica, i agregats de contractació de
  // les 4 diputacions i els 40 consells. Consultes agregades, cap adjudicatari. No és a `ORDER`.
  j42: (db: Parameters<typeof j42ServeisEns>[0]) => j42ServeisEns(db),
  // J43 a mà, després de J1: com vota cada municipi al Parlament (2024, 2021), al Congrés
  // (2023, nov. 2019) i a les europees (2024). ~90.000 files de ntc4-rnwr i una consulta a irrv-2mfc. No és a `ORDER`.
  j43: j43AltresEleccions,
  // J44 a mà, després de J1 i J18: atur registrat del SEPE (CSV anuals del 2019 ençà,
  // desats a `packages/db/.data/sepe/`) i cinc indicadors de l'EMEX en una crida. No és a `ORDER`.
  j44: (db: Parameters<typeof j44Socioeconomia>[0]) => j44Socioeconomia(db),
  // J45 a mà, després de J1: reclamacions a la GAIP i incompliments, lligats pel nom. No és a `ORDER`.
  j45: j45Gaip,
  // J46 a mà, després de J1: registre de turisme viu, consulta agregada (cap titular). No és a `ORDER`.
  j46: j46HabitatgesTuristics,
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
 *
 * J23 (la renda de l'INE) va **just després de J18** i no al final: llegeix la
 * mètrica `poblacioEnllacos` que J18 escriu per citar l'Idescat, i abans de J18
 * la trobaria buida i deixaria els 947 sense enllaç. J24 (el segon sou: el que
 * paga cada diputació als seus diputats) va just després de J22 (el primer:
 * el del ple, de l'inventari del Ministeri), perquè els dos sous es llegeixin
 * de seguit i en aquest ordre. Cap dels dos no baixa fitxa a fitxa: J23 són
 * uns quants fulls de l'INE per a tot Catalunya, i J24 quatre pàgines de
 * diputació i una consulta al conjunt de plens de la Generalitat.
 *
 * J29 (la criminalitat: el balanç del Ministeri de l'Interior) va després de
 * J24 i no baixa fitxa a fitxa: són setze peticions per a tot Catalunya —vuit
 * índexs i vuit CSV anuals—. Llegeix el padró que J18 desa per fer les taxes
 * per 1.000 habitants, així que ha d'anar després de J18.
 *
 * J25 i J26 no hi són: baixen imatges municipi a municipi i van a mà, com J11.
 *
 * J32 (superfície, altitud i gentilici) va **just després de J1**: és el
 * mateix conjunt de la Generalitat en una sola consulta, i la densitat es
 * calcula amb el padró que J1 acaba de desar.
 */
const ORDER: Command[] = [
  "j1", "j32", "j5", "j2", "j3", "j4", "j6", "j7", "j8", "j9", "j15", "j10", "j16", "j17", "j18", "j23", "j20", "j21",
  "j22", "j24", "j29", "j34",
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
