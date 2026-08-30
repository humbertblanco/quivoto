import { municipalFinances, municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { ckanSql } from "../adapters/aoc";
import { buildPeerGroups, medianOf, percentileOf, type PeerGroup } from "../derive/peers";
import { arrodoneix, variacioEntre, type PuntSerie, type Variacio } from "./j9-habitatge-residus";
import { withRun } from "../lib/run";

/**
 * J15 — què gasta l'ajuntament en cada servei, any a any.
 *
 * Fins ara la fitxa només sabia dir en què es gasten els diners amb sis calaixos
 * enormes —«serveis públics bàsics», «administració general»— que no responen
 * cap pregunta que es faci ningú. Amb això no es pot dir quants diners van a les
 * escombraries del meu poble, i sobretot no es pot posar **el que costa la
 * recollida al costat de la taxa de reciclatge que en surt**, que és la
 * comparació que converteix un pressupost en un resultat. La taxa la tenim a J9
 * (`kind: "residus"`, camp `serie[].taxaSelectiva`); aquí hi posem els euros.
 *
 * La font és la liquidació del pressupost **per programes** que tots els ens
 * locals trameten, publicada per l'AOC. És l'únic lloc on «recollida de residus»
 * vol dir el mateix als 947 municipis, perquè el codi de programa el fixa una
 * ordre ministerial i no el criteri comptable de cada casa.
 *
 * Dues regles governen tot el fitxer:
 *
 *   · **Un municipi sense un programa no és un forat de dades: és un zero.** Si
 *     l'ajuntament ha liquidat l'exercici i no hi apareix «Neteja viària», és
 *     que aquell any no hi va destinar ni un euro —una decisió política, no una
 *     mancança nostra. El forat de veritat és l'altre: l'exercici que encara no
 *     s'ha liquidat. Els dos casos es desen diferent i es poden distingir sempre
 *     (`liquidacio: false` vol dir «no ho sabem»; `total: 0` vol dir «zero»).
 *   · **Cap variació es publica sola.** Que la despesa en residus hagi pujat un
 *     5 % no vol dir res fins que se sap què han fet els municipis de la mateixa
 *     mida en el mateix període.
 */

/** Liquidació del pressupost per programes (CKAN de l'AOC). 4.644.984 files. */
const LIQUIDACIO_PROGRAMES = "5b96829f-d724-4059-a38a-abf514830558";

/**
 * Classificació funcional («per programes»), que és la que diu **en què** es
 * gasta. L'altra que porta el conjunt és l'econòmica, que diu **en què consisteix
 * la despesa** (personal, béns, inversió) i ja la tenim a J6.
 */
const CLASSIFICACIO_FUNCIONAL = "F";

/**
 * Comprovat el 29-08-2026: dins de `TIPUS_CLASSIF='F'` totes les 838.943 files
 * són de despesa. El filtre hi és igualment perquè el dia que el portal hi
 * afegeixi ingressos per programa no ens els sumem a la despesa sense adonar-nos.
 */
const PARTIDA_DESPESA = "D";

/**
 * Nivells de la classificació funcional que fem servir.
 *
 * El nivell 1 són les sis àrees de despesa que ja publica J8; el 2 són les
 * polítiques de despesa; el 3, els **grups de programa**, que són els 88 calaixos
 * on «Enllumenat públic» és una línia pròpia. El nivell 4 és el detall opcional
 * que només desglossen alguns ajuntaments i **no es pot sumar**: comprovat a
 * Berga 2024, els nivells 1, 2 i 3 sumen exactament el mateix (16.940.503,01 €) i
 * el 4 en suma 497.036,21, perquè només hi ha les partides que aquell ens ha
 * volgut obrir.
 */
const NIVELL_POLITICA = "2";
const NIVELL_GRUP_PROGRAMA = "3";

/** Des d'aquí la sèrie cobreix el mandat actual sencer i l'anterior. */
const SERIE_DES_DE = 2019;

/**
 * Any de constitució dels ajuntaments, com a J9. L'agafem com a punt de partida
 * perquè és l'últim exercici tancat que no ha decidit qui governa avui.
 */
const MANDAT = 2023;
const MANDAT_ANTERIOR = 2019;

/**
 * El datastore de l'AOC talla les respostes a 32.000 files i ho fa **en silenci**:
 * torna `success: true` amb mitja consulta. Verificat el 29-08-2026 demanant
 * `LIMIT 40000` d'un sol any i un sol nivell: en tornen exactament 32.000, i
 * aquell tall (nivell 3 del 2024) en té 32.585, o sigui que un sol any ja hi
 * cabria just.
 *
 * Per això es pagina amb cursor sobre `_id` en comptes de `OFFSET`: el cursor no
 * depèn de si l'origen reordena res entre pàgina i pàgina, i no es fa lent quan
 * s'endinsa al conjunt.
 */
const CKAN_MAX_FILES = 32_000;
const PAGINA = 25_000;

/**
 * A partir de quina cobertura un exercici es considera comparable a tot
 * Catalunya. El 2025 el tenen liquidat 827 dels 947 ajuntaments: comparar el
 * percentil d'un municipi que ja l'ha tancat contra els 827 que també l'han
 * tancat mesuraria qui presenta els comptes aviat, no qui gasta més. El llindar
 * s'aplica sol i s'ajustarà quan la resta vagi arribant.
 */
const COBERTURA_MINIMA = 0.9;

/**
 * Aquesta xifra no és negociable: un programa no pot costar més que tota la
 * despesa liquidada del municipi aquell any. Quan passa, és un error de qui ha
 * omplert el formulari, i el que toca és apartar-lo i deixar-ne constància.
 * S'ha triat aquest criteri i no un sostre d'euros per habitant perquè un sostre
 * fix castiga els pobles petits: en un poble de trenta habitants, un clavegueram
 * nou són 5.000 € per cap i no és cap error.
 */
const MARGE_ARRODONIMENT = 1.01;

/**
 * Els programes que es publiquen, i per què.
 *
 * De 88 grups de programa se n'han triat quinze amb tres condicions: que una
 * persona sàpiga què és sense que li ho expliquin, que respongui una pregunta que
 * es discuteix al ple, i que la cobertura permeti comparar. La cobertura anotada
 * és el nombre d'**ajuntaments** (no d'ens: el conjunt també porta consells
 * comarcals, EMD i diputacions) que hi declaren alguna cosa el 2024, verificada
 * amb consultes reals el 29-08-2026.
 *
 * S'han deixat fora els calaixos administratius grossos —«Administració general»
 * (944) i «Gestió del sistema tributari» (581)— perquè són residuals per
 * construcció: hi va a parar tot el que no s'ha classificat, i comparar-los
 * mesura la comptabilitat de cada casa i no cap decisió de govern. «Òrgans de
 * govern» sí que hi entra, perquè és exactament el contrari: és el que costen les
 * persones i els grups que decideixen la resta.
 */
export type Programa = {
  /** Codi de grup de programa, tal com arriba de l'origen (sense zeros al davant). */
  codi: string;
  /** Nom curt per a la fitxa; el de l'origen és massa llarg o és abreujat. */
  nom: string;
  /** Ajuntaments que hi declaren alguna cosa el 2024. */
  cobertura2024: number;
  /** La pregunta electoral que respon. */
  perque: string;
  /** Indicador d'una altra feina amb què es pot posar al costat. */
  relacionatAmb?: { kind: string; camp: string };
};

export const PROGRAMES: readonly Programa[] = [
  {
    codi: "1602",
    nom: "Escombraries i residus",
    cobertura2024: 830,
    perque:
      "Quants diners costa recollir les escombraries, que és la despesa que tothom paga per taxa i tothom veu passar pel carrer.",
    // El motiu de ser d'aquesta feina: euros contra resultat. J9 ja desa la taxa
    // de recollida selectiva any a any amb la mateixa base temporal.
    relacionatAmb: { kind: "residus", camp: "serie[].taxaSelectiva" },
  },
  {
    codi: "1603",
    nom: "Neteja viària",
    cobertura2024: 574,
    perque: "És la queixa municipal número u, i es pot mirar si hi ha diners al darrere o no.",
  },
  {
    codi: "1605",
    nom: "Enllumenat públic",
    cobertura2024: 899,
    perque:
      "La millor cobertura de tots els serveis reals, i la línia on es veu de cop la crisi energètica del 2022 i qui va canviar els fanals.",
  },
  {
    codi: "1601",
    nom: "Aigua potable",
    cobertura2024: 844,
    perque: "Qui s'ha remunicipalitzat l'aigua i qui no és una decisió de mandat que es veu en aquesta línia.",
  },
  {
    codi: "1600",
    nom: "Clavegueram",
    cobertura2024: 614,
    perque: "La infraestructura que només surt als plens quan s'inunda un barri.",
  },
  {
    codi: "1701",
    nom: "Parcs i jardins",
    cobertura2024: 708,
    perque: "L'espai públic que la gent fa servir cada dia i el primer que es retalla quan falten diners.",
  },
  {
    codi: "1503",
    nom: "Vies públiques",
    cobertura2024: 814,
    perque: "Voreres, asfalt i manteniment del carrer: la despesa que es nota caminant.",
  },
  {
    codi: "1502",
    nom: "Habitatge",
    cobertura2024: 393,
    perque:
      "La cobertura és la més baixa de la llista i precisament per això s'hi publica: 552 dels 945 ajuntaments que van liquidar el 2024 no hi destinen ni un euro mentre el lloguer puja, i això és una decisió, no una manca de dades.",
    relacionatAmb: { kind: "habitatge", camp: "serie[].preu" },
  },
  {
    codi: "2301",
    nom: "Serveis socials",
    cobertura2024: 844,
    perque: "Assistència social primària: el que l'ajuntament dedica a la gent que ho passa malament.",
  },
  {
    codi: "3203",
    nom: "Escoles d'infantil i primària",
    cobertura2024: 632,
    perque: "El manteniment i el funcionament de les escoles del poble, que la llei posa a càrrec de l'ajuntament.",
  },
  {
    codi: "3302",
    nom: "Biblioteques i arxius",
    cobertura2024: 429,
    perque: "L'equipament cultural que més es visita i el que millor mesura si la cultura és una prioritat o un cartell.",
  },
  {
    codi: "3402",
    nom: "Instal·lacions esportives",
    cobertura2024: 768,
    perque: "Piscines i pavellons: molta inversió, molt debat i molta diferència entre municipis de la mateixa mida.",
  },
  {
    codi: "1302",
    nom: "Policia local i seguretat",
    cobertura2024: 344,
    perque:
      "És el servei més polititzat i el que té els zeros més eloqüents: 601 dels 945 ajuntaments que van liquidar el 2024 no hi gasten res perquè no tenen policia local.",
  },
  {
    codi: "9102",
    nom: "Òrgans de govern",
    cobertura2024: 914,
    perque:
      "El que costen l'alcaldia, els regidors i els grups municipals. Posat al costat de qualsevol servei, és la comparació que la gent fa sola.",
  },
  {
    // Arriba com a «101» i no com a «0101»: vegeu `codiPrograma`.
    //
    // Es diu «Pagar el deute» i no «Deute públic», que és el nom del grup a
    // l'ordre ministerial: a la fitxa aquest programa surt a la mateixa llista
    // que «Deute per habitant», i amb dos rètols que comencen igual es llegien
    // com la mateixa xifra dues vegades. No ho són: l'un és el que es deu, i
    // l'altre el que es paga cada any per deure-ho.
    codi: "101",
    nom: "Pagar el deute",
    cobertura2024: 649,
    perque:
      "Interessos i amortització: els diners que van al banc en comptes d'anar a un servei. 296 dels 945 ajuntaments que van liquidar el 2024 hi tenen zero, que aquí vol dir que no deuen res.",
  },
] as const;

// ─── Càlculs purs ────────────────────────────────────────────────────────────

/**
 * Import en euros tal com el publica aquest conjunt.
 *
 * Parany verificat: en aquest conjunt els decimals van amb **coma** i no hi ha
 * separador de milers («103555042,41» són cent tres milions), mentre que altres
 * conjunts del mateix portal els porten amb punt. Passar-ho per `Number()` a
 * seques dona `NaN` i, si algú el converteix a zero, un ajuntament que gasta
 * dos milions en residus surt gastant-ne zero.
 *
 * També hi ha imports **negatius** —reintegraments i rectificacions d'exercicis
 * tancats; el 2024 n'hi ha tres al nivell 3, un de gairebé divuit milions— i es
 * conserven amb el seu signe: són despesa real que s'ha desfet.
 *
 * Torna `null`, i no zero, quan no hi ha xifra: la diferència entre «no consta»
 * i «zero euros» és tota la gràcia d'aquesta feina.
 */
export function euros(brut: unknown): number | null {
  if (brut === null || brut === undefined) return null;
  const text = String(brut).trim();
  if (text === "") return null;
  // La coma és decimal. Els espais (fins i tot els fins, que algun formulari hi
  // cola) no separen res que ens importi.
  const net = text.replace(/\s| /g, "").replace(",", ".");
  const valor = Number(net);
  return Number.isFinite(valor) ? valor : null;
}

/**
 * Codi de grup de programa normalitzat.
 *
 * Parany verificat: al datastore la columna `ESTRUCTURA` és de tipus **numèric**,
 * o sigui que els codis hi perden el zero del davant. «Pagar el deute», que a
 * l'ordre ministerial és el grup 0101 («Deuda pública»), hi arriba com a «101», i qui escrigui el
 * catàleg amb el zero no hi lligarà mai cap fila —sense error, simplement sense
 * dades. Per si algun dia el portal el retorna com a número de debò, també es
 * treu el «.0» final.
 */
export function codiPrograma(brut: unknown): string {
  return String(brut ?? "").trim().replace(/\.0+$/, "");
}

/**
 * Què va gastar un municipi en un programa un any, distingint el zero del buit.
 *
 * `null` vol dir «aquell exercici encara no s'ha liquidat»: no en sabem res.
 * `0` vol dir «l'ajuntament ha presentat la liquidació i aquest programa no hi
 * surt», que és una decisió de govern i s'ha de poder dir en veu alta. Confondre
 * les dues coses ja ens va mossegar amb la despesa de deute, on 295 municipis
 * sense deute es llegien com un forat de cobertura.
 */
export function despesaDelPrograma(
  programes: ReadonlyMap<string, number> | undefined,
  codi: string,
  teLiquidacio: boolean,
): number | null {
  if (!teLiquidacio) return null;
  return programes?.get(codi) ?? 0;
}

/** Euros per habitant, amb el padró de l'any que toca. */
export function perHabitant(total: number | null, habitants: number | null): number | null {
  if (total === null || habitants === null || habitants <= 0) return null;
  return arrodoneix(total / habitants, 2);
}

/** Quina part del total de despesa del municipi se'n va en aquest programa. */
export function partDelTotal(valor: number | null, total: number | null): number | null {
  if (valor === null || total === null || total <= 0) return null;
  return arrodoneix((100 * valor) / total, 1);
}

export type VariacioAmbFinal = { fins: number; diferencia: number; percentual: number | null };
export type MedianaDelGrup = {
  fins: number;
  diferencia: number | null;
  percentual: number | null;
  municipis: number;
};

/**
 * Com ha canviat el mateix programa als municipis de la mateixa mida.
 *
 * Sense això, «la despesa en residus ha pujat un 5 %» no és cap informació: si
 * al grup ha pujat un 12 %, aquest ajuntament hi ha destinat menys diners en
 * termes reals tot i gastar-ne més.
 *
 * La mediana s'agrupa per grup **i per any final**. Aquest conjunt no arriba
 * alhora a tothom —el 2025 el tenen liquidat 827 dels 947— i comparar el
 * 2023→2025 d'un municipi amb el 2023→2024 dels seus veïns és comparar un
 * període de dos anys amb un d'un any: la xifra del veí sortiria sempre més
 * baixa pel sol fet de ser més curta.
 */
export function medianaPerGrup(
  variacions: ReadonlyMap<number, VariacioAmbFinal>,
  grups: ReadonlyMap<number, PeerGroup>,
): Map<number, MedianaDelGrup> {
  const acumulat = new Map<string, { dif: number[]; pct: number[] }>();
  const clauDe = (grup: PeerGroup, fins: number): string => `${grup.key}|${fins}`;

  for (const [id, v] of variacions) {
    const grup = grups.get(id);
    if (!grup) continue;
    const clau = clauDe(grup, v.fins);
    const acumula = acumulat.get(clau) ?? { dif: [], pct: [] };
    acumula.dif.push(v.diferencia);
    if (v.percentual !== null) acumula.pct.push(v.percentual);
    acumulat.set(clau, acumula);
  }

  const sortida = new Map<number, MedianaDelGrup>();
  for (const [id, v] of variacions) {
    const grup = grups.get(id);
    if (!grup) continue;
    const acumula = acumulat.get(clauDe(grup, v.fins))!;
    const mediana = medianOf(acumula.dif);
    const medianaPct = acumula.pct.length > 0 ? medianOf(acumula.pct) : null;
    sortida.set(id, {
      fins: v.fins,
      diferencia: mediana === null ? null : arrodoneix(mediana, 2),
      percentual: medianaPct === null ? null : arrodoneix(medianaPct, 1),
      municipis: acumula.dif.length,
    });
  }
  return sortida;
}

/**
 * L'exercici més recent que es pot comparar a tot Catalunya: el més nou que
 * tenen liquidat almenys el 90 % dels municipis que en tenen cap. Amb el 2025 a
 * 827 de 947 (87 %), avui surt el 2024, i sortirà el 2025 tot sol quan la resta
 * el presentin.
 */
export function darrerAnyComparable(
  municipisPerAny: ReadonlyMap<number, number>,
  llindar = COBERTURA_MINIMA,
): number | null {
  const anys = [...municipisPerAny.keys()].sort((a, b) => b - a);
  if (anys.length === 0) return null;
  const sostre = Math.max(...municipisPerAny.values());
  for (const any of anys) {
    if ((municipisPerAny.get(any) ?? 0) >= sostre * llindar) return any;
  }
  return anys[anys.length - 1] ?? null;
}

// ─── Ingesta ─────────────────────────────────────────────────────────────────

type FilaCkan = {
  _id: number | string;
  CODI_ENS: string | number;
  ANY_EXERCICI: string;
  NIVELL: string;
  ESTRUCTURA: string | number;
  DESCRIPCIO: string;
  IMPORT_DRET_OBLIG: string;
  NOM_COMPLERT: string;
};

/**
 * Un tall del conjunt (un exercici i un nivell), paginat amb cursor.
 *
 * La pàgina és més petita que el tall silenciós de l'AOC a posta: així una
 * pàgina plena vol dir «hi ha més files», mai «t'han retallat la consulta».
 */
async function filesDelTall(any: number, nivell: string): Promise<FilaCkan[]> {
  const files: FilaCkan[] = [];
  let cursor = 0;
  for (;;) {
    const tanda = await ckanSql<FilaCkan>(
      `SELECT "_id","CODI_ENS","ANY_EXERCICI","NIVELL","ESTRUCTURA","DESCRIPCIO","IMPORT_DRET_OBLIG","NOM_COMPLERT"
       FROM "${LIQUIDACIO_PROGRAMES}"
       WHERE "TIPUS_CLASSIF"='${CLASSIFICACIO_FUNCIONAL}'
         AND "TIPUS_PARTIDA"='${PARTIDA_DESPESA}'
         AND "NIVELL"='${nivell}'
         AND "ANY_EXERCICI"='${any}'
         AND "_id" > ${cursor}
       ORDER BY "_id" LIMIT ${PAGINA}`,
    );
    files.push(...tanda);
    if (tanda.length < PAGINA) return files;

    const ultim = Number(tanda[tanda.length - 1]!._id);
    // Si el cursor no avança, la pàgina següent seria la mateixa i el bucle no
    // s'acabaria mai. Val més parar amb un error que penjar-se ingerint.
    if (!Number.isFinite(ultim) || ultim <= cursor) {
      throw new Error(`paginació encallada al ${any} nivell ${nivell} (cursor ${cursor})`);
    }
    cursor = ultim;
  }
}

/** Un municipi, un any: què hi ha declarat. */
type AnyDelMunicipi = {
  /** Total de despesa liquidada, pres del nivell 2 (les polítiques de despesa). */
  totalPolitiques: number;
  /** El mateix total sumat des del nivell 3; ha de coincidir. */
  totalGrups: number;
  /** Grup de programa → euros. Només els programes que l'ajuntament declara. */
  programes: Map<string, number>;
};

export async function j15DespesaServeis(db: Db): Promise<void> {
  const tots = await db.select().from(municipalities);
  const perCodiEns = new Map<string, number>();
  const nomDe = new Map<number, string>();
  const padroVigent = new Map<number, number>();
  for (const m of tots) {
    perCodiEns.set(m.codiEns, m.id);
    nomDe.set(m.id, m.name);
    if (m.population) padroVigent.set(m.id, m.population);
  }
  const grups = buildPeerGroups(tots);

  const desa = async (municipalityId: number, kind: string, data: unknown): Promise<void> => {
    await db
      .insert(municipalityMetrics)
      .values({ municipalityId, kind, data })
      .onConflictDoUpdate({
        target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
        set: { data, computedAt: new Date() },
      });
  };

  await withRun(db, "J15 despesa per programes", async (run) => {
    // El padró de cada exercici, com a J8: el cost per habitant del 2019 s'ha de
    // dividir per la gent que hi vivia el 2019. Si es fes servir sempre el padró
    // d'ara, un poble que ha crescut semblaria que ha abaratit tots els serveis
    // sense haver-hi tocat res. Surt de `municipal_finances`, que omple J6.
    const padroDelAny = new Map<number, Map<number, number>>();
    for (const fila of await db
      .select({
        municipalityId: municipalFinances.municipalityId,
        year: municipalFinances.year,
        population: municipalFinances.population,
      })
      .from(municipalFinances)) {
      if (!fila.population) continue;
      const delAny = padroDelAny.get(fila.year) ?? new Map<number, number>();
      delAny.set(fila.municipalityId, fila.population);
      padroDelAny.set(fila.year, delAny);
    }
    const habitants = (municipalityId: number, any: number): number | null =>
      padroDelAny.get(any)?.get(municipalityId) ?? padroVigent.get(municipalityId) ?? null;

    // Quins exercicis porta el conjunt. Es demana a l'origen i no es fixa aquí
    // perquè l'any que ve el 2026 hi entrarà tot sol.
    const anysCruus = await ckanSql<{ any: string }>(
      `SELECT DISTINCT "ANY_EXERCICI" AS any FROM "${LIQUIDACIO_PROGRAMES}"
       WHERE "TIPUS_CLASSIF"='${CLASSIFICACIO_FUNCIONAL}' AND "ANY_EXERCICI" >= '${SERIE_DES_DE}'`,
    );
    const anys = anysCruus
      .map((fila) => Number(fila.any))
      .filter((any) => Number.isFinite(any) && any >= SERIE_DES_DE)
      .sort((a, b) => a - b);
    // Si l'origen deixa de publicar exercicis, val més parar que desar 947
    // fitxes buides per sobre de les bones.
    if (anys.length === 0) throw new Error("la liquidació per programes no torna cap exercici");
    run.say(`exercicis ${anys[0]}-${anys[anys.length - 1]}`);

    /** municipi → any → què hi ha declarat. */
    const declarat = new Map<number, Map<number, AnyDelMunicipi>>();
    /** Els noms de l'origen, per si el catàleg es queda enrere d'una renumeració. */
    const nomOrigen = new Map<string, string>();
    let ensForaDeCataleg = 0;
    const ajuntamentsOrfes = new Map<string, string>();
    let duplicats = 0;

    for (const any of anys) {
      for (const nivell of [NIVELL_POLITICA, NIVELL_GRUP_PROGRAMA]) {
        const files = await filesDelTall(any, nivell);
        run.rowsIn += files.length;
        if (files.length >= CKAN_MAX_FILES) {
          // No hauria de passar mai amb pàgines de 25.000, però si l'AOC canvia
          // el sostre val més assabentar-se'n per la incidència que per una sèrie
          // mig buida publicada.
          await run.issue({
            kind: "programes: tall sospitós de truncament",
            severity: "alta",
            detail: { any, nivell, files: files.length, sostre: CKAN_MAX_FILES },
          });
        }

        for (const fila of files) {
          /**
           * `CODI_ENS` és numèric a l'origen i els municipis de Barcelona hi
           * perden el zero del davant (Berga `0802290004` → `802290004`).
           */
          const codiEns = String(fila.CODI_ENS).padStart(10, "0");
          const municipalityId = perCodiEns.get(codiEns);
          if (!municipalityId) {
            // El conjunt porta consells comarcals, EMD, mancomunitats i
            // diputacions: que no lliguin no és cap error, i inundar les
            // incidències amb 170 ens per any taparia les que sí que importen.
            // El que sí que és un error és un ens que es diu «Ajuntament de…»
            // i no tenim.
            if (String(fila.NOM_COMPLERT ?? "").startsWith("Ajuntament")) {
              ajuntamentsOrfes.set(codiEns, String(fila.NOM_COMPLERT));
            } else {
              ensForaDeCataleg += 1;
            }
            continue;
          }
          const import_ = euros(fila.IMPORT_DRET_OBLIG);
          if (import_ === null) continue;

          const perAny = declarat.get(municipalityId) ?? new Map<number, AnyDelMunicipi>();
          const delAny =
            perAny.get(any) ?? { totalPolitiques: 0, totalGrups: 0, programes: new Map<string, number>() };

          if (nivell === NIVELL_POLITICA) {
            delAny.totalPolitiques += import_;
          } else {
            delAny.totalGrups += import_;
            const codi = codiPrograma(fila.ESTRUCTURA);
            const descripcio = String(fila.DESCRIPCIO ?? "").trim();
            // La descripció de l'origen ve amb espais al final en alguns grups.
            if (descripcio !== "" && !nomOrigen.has(codi)) nomOrigen.set(codi, descripcio);
            if (delAny.programes.has(codi)) duplicats += 1;
            delAny.programes.set(codi, (delAny.programes.get(codi) ?? 0) + import_);
          }

          perAny.set(any, delAny);
          declarat.set(municipalityId, perAny);
        }
      }
      run.say(`${any}: ${declarat.size} municipis acumulats`);
    }

    for (const [codi, nom] of ajuntamentsOrfes) {
      await run.issue({
        kind: "programes: ajuntament sense municipi",
        severity: "alta",
        entity: codi,
        detail: { dataset: LIQUIDACIO_PROGRAMES, codiEns: codi, nom },
      });
    }
    if (duplicats > 0) {
      // El 2024 no n'hi ha cap (32.585 files, 32.585 parells ens-programa
      // diferents). Si un dia n'hi ha, s'han sumat i cal saber-ho.
      await run.issue({
        kind: "programes: files repetides d'un mateix programa",
        severity: "mitjana",
        detail: { files: duplicats, criteri: "sumades" },
      });
    }
    run.say(`${ensForaDeCataleg} files d'ens que no són municipis (consells, EMD, diputacions), descartades`);

    /** Municipi → exercicis que té liquidats. Aquesta és la frontera del «no ho sabem». */
    const liquidats = new Map<number, Set<number>>();
    for (const [municipalityId, perAny] of declarat) {
      liquidats.set(municipalityId, new Set([...perAny.keys()]));
    }

    const municipisPerAny = new Map<number, number>();
    for (const any of anys) {
      municipisPerAny.set(any, [...liquidats.values()].filter((quins) => quins.has(any)).length);
    }
    const anyComparable = darrerAnyComparable(municipisPerAny)!;
    run.say(
      `liquidacions per any: ${anys.map((a) => `${a}:${municipisPerAny.get(a)}`).join(" ")} · any comparable ${anyComparable}`,
    );

    /**
     * Detall fiable: el nivell 3 ha de sumar el mateix que el nivell 2. Quan no
     * ho fa, l'ajuntament ha declarat les polítiques però no ha obert tots els
     * grups de programa, i llavors els percentatges sobre el total mentirien —hi
     * hauria despesa que no és a cap programa. Es desa el senyal, no s'amaga la
     * dada.
     */
    const detallFiable = (delAny: AnyDelMunicipi): boolean => {
      if (delAny.totalPolitiques <= 0) return delAny.totalGrups <= 0;
      const desviacio = Math.abs(delAny.totalGrups - delAny.totalPolitiques) / delAny.totalPolitiques;
      return desviacio <= 0.01;
    };

    // Guarda contra els errors de qui ompleix el formulari: cap programa pot
    // costar més que tota la despesa liquidada del municipi aquell any.
    const implausibles: { municipalityId: number; any: number; codi: string; import: number; total: number }[] = [];
    for (const [municipalityId, perAny] of declarat) {
      for (const [any, delAny] of perAny) {
        const total = Math.max(delAny.totalPolitiques, delAny.totalGrups);
        if (total <= 0) continue;
        for (const [codi, import_] of delAny.programes) {
          if (import_ > total * MARGE_ARRODONIMENT) {
            implausibles.push({ municipalityId, any, codi, import: import_, total });
            delAny.programes.delete(codi);
          }
        }
      }
    }
    for (const cas of implausibles) {
      await run.issue({
        kind: "programes: import més gran que tota la despesa del municipi",
        severity: "alta",
        municipalityId: cas.municipalityId,
        entity: cas.codi,
        detail: { any: cas.any, import: cas.import, totalMunicipi: cas.total, efecte: "descartat" },
      });
    }

    // ── Sèries per municipi i programa ────────────────────────────────────────

    type PuntPrograma = {
      any: number;
      /** `false` vol dir que aquell exercici no s'ha liquidat: no en sabem res. */
      liquidacio: boolean;
      total: number | null;
      perHabitant: number | null;
      part: number | null;
      habitants: number | null;
    };

    /** municipi → codi de programa → sèrie completa. */
    const series = new Map<number, Map<string, PuntPrograma[]>>();
    /** Total de despesa del municipi, any a any. */
    const totals = new Map<number, Map<number, { total: number; perHabitant: number | null; fiable: boolean }>>();

    for (const [municipalityId, perAny] of declarat) {
      const teAny = liquidats.get(municipalityId)!;
      const perPrograma = new Map<string, PuntPrograma[]>();
      const totalsDelMunicipi = new Map<number, { total: number; perHabitant: number | null; fiable: boolean }>();

      for (const any of anys) {
        const delAny = perAny.get(any);
        const gent = habitants(municipalityId, any);
        if (delAny) {
          const total = delAny.totalPolitiques > 0 ? delAny.totalPolitiques : delAny.totalGrups;
          totalsDelMunicipi.set(any, {
            total: arrodoneix(total, 2),
            perHabitant: perHabitant(total, gent),
            fiable: detallFiable(delAny),
          });
        }
        for (const programa of PROGRAMES) {
          const import_ = despesaDelPrograma(delAny?.programes, programa.codi, teAny.has(any));
          const total = totalsDelMunicipi.get(any)?.total ?? null;
          const punts = perPrograma.get(programa.codi) ?? [];
          punts.push({
            any,
            liquidacio: teAny.has(any),
            total: import_ === null ? null : arrodoneix(import_, 2),
            perHabitant: perHabitant(import_, gent),
            part: partDelTotal(import_, total),
            habitants: gent,
          });
          perPrograma.set(programa.codi, punts);
        }
      }
      series.set(municipalityId, perPrograma);
      totals.set(municipalityId, totalsDelMunicipi);
    }

    // ── Variacions de mandat i comparacions dins del grup ─────────────────────

    /** L'últim exercici liquidat de cada municipi: el seu, no el de tothom. */
    const darrerDelMunicipi = new Map<number, number>();
    for (const [municipalityId, quins] of liquidats) {
      const darrer = Math.max(...quins);
      if (Number.isFinite(darrer)) darrerDelMunicipi.set(municipalityId, darrer);
    }

    /** codi → municipi → variació 2023 → últim any seu, sobre euros per habitant. */
    const mandats = new Map<string, Map<number, Variacio>>();
    /** codi → municipi → mediana del seu grup per al mateix període. */
    const mandatsDelGrup = new Map<string, Map<number, MedianaDelGrup>>();
    /** codi → municipi → euros per habitant de l'any comparable. */
    const valorsComparables = new Map<string, Map<number, number>>();

    for (const programa of PROGRAMES) {
      const delPrograma = new Map<number, Variacio>();
      const ambFinal = new Map<number, VariacioAmbFinal>();
      const comparables = new Map<number, number>();

      for (const [municipalityId, perPrograma] of series) {
        const punts = perPrograma.get(programa.codi) ?? [];
        const serie: PuntSerie[] = punts.map((p) => ({ any: p.any, valor: p.perHabitant }));
        const fins = darrerDelMunicipi.get(municipalityId);
        if (fins !== undefined) {
          const variacio = variacioEntre(serie, MANDAT, fins);
          if (variacio) {
            delPrograma.set(municipalityId, variacio);
            ambFinal.set(municipalityId, {
              fins,
              diferencia: variacio.diferencia,
              percentual: variacio.percentual,
            });
          }
        }
        const comparable = punts.find((p) => p.any === anyComparable)?.perHabitant;
        if (comparable !== null && comparable !== undefined) comparables.set(municipalityId, comparable);
      }

      mandats.set(programa.codi, delPrograma);
      mandatsDelGrup.set(programa.codi, medianaPerGrup(ambFinal, grups));
      valorsComparables.set(programa.codi, comparables);
    }

    /** Percentil i mediana de cada municipi dins del seu grup, per programa. */
    const comparacions = new Map<string, Map<number, { percentil: number; mediana: number; ambDada: number }>>();
    for (const programa of PROGRAMES) {
      const valors = valorsComparables.get(programa.codi)!;
      const perGrup = new Map<string, number[]>();
      for (const [id, valor] of valors) {
        const grup = grups.get(id);
        if (!grup) continue;
        const llista = perGrup.get(grup.key);
        if (llista) llista.push(valor);
        else perGrup.set(grup.key, [valor]);
      }
      const resultat = new Map<number, { percentil: number; mediana: number; ambDada: number }>();
      for (const [id, valor] of valors) {
        const grup = grups.get(id);
        if (!grup) continue;
        const llista = perGrup.get(grup.key)!;
        const percentil = percentileOf(valor, llista);
        const mediana = medianOf(llista);
        if (percentil === null || mediana === null) continue;
        resultat.set(id, { percentil, mediana: arrodoneix(mediana, 2), ambDada: llista.length });
      }
      comparacions.set(programa.codi, resultat);
    }

    /**
     * Cobertura real de cada programa l'any comparable, sobre els municipis que
     * el tenen liquidat. Va desada al costat de cada programa perquè qui llegeixi
     * «553 ajuntaments no hi destinen res» sàpiga que el denominador són els que
     * han presentat comptes, no els 947 en abstracte.
     */
    const cobertura = new Map<string, { ambImport: number; ambZero: number; ambLiquidacio: number }>();
    const ambLiquidacioComparable = [...liquidats.values()].filter((quins) => quins.has(anyComparable)).length;
    for (const programa of PROGRAMES) {
      let ambImport = 0;
      for (const perPrograma of series.values()) {
        const punt = perPrograma.get(programa.codi)?.find((p) => p.any === anyComparable);
        if (punt?.liquidacio && punt.total !== null && punt.total !== 0) ambImport += 1;
      }
      cobertura.set(programa.codi, {
        ambImport,
        ambZero: ambLiquidacioComparable - ambImport,
        ambLiquidacio: ambLiquidacioComparable,
      });
    }

    // ── Desat ────────────────────────────────────────────────────────────────

    let ambMandat = 0;
    for (const [municipalityId, perPrograma] of series) {
      const grup = grups.get(municipalityId) ?? null;
      const darrer = darrerDelMunicipi.get(municipalityId) ?? null;
      const totalsDelMunicipi = totals.get(municipalityId) ?? new Map();
      const quins = liquidats.get(municipalityId)!;
      const senseLiquidacio = anys.filter((any) => !quins.has(any));

      const programes = PROGRAMES.map((programa) => {
        const punts = perPrograma.get(programa.codi) ?? [];
        const serie: PuntSerie[] = punts.map((p) => ({ any: p.any, valor: p.perHabitant }));
        const mandat = mandats.get(programa.codi)?.get(municipalityId) ?? null;
        return {
          codi: programa.codi,
          nom: programa.nom,
          nomOrigen: nomOrigen.get(programa.codi) ?? null,
          perque: programa.perque,
          relacionatAmb: programa.relacionatAmb ?? null,
          serie: punts,
          darrer: punts.find((p) => p.any === darrer) ?? null,
          /** 2023 → últim exercici liquidat d'aquest municipi, sobre euros per habitant. */
          mandat,
          /** La mateixa variació als municipis de la seva mida i amb el mateix any final. */
          mandatDelGrup: mandatsDelGrup.get(programa.codi)?.get(municipalityId) ?? null,
          mandatAnterior: variacioEntre(serie, MANDAT_ANTERIOR, MANDAT),
          comparacio: comparacions.get(programa.codi)?.get(municipalityId) ?? null,
          cobertura: cobertura.get(programa.codi) ?? null,
        };
      });
      if (programes.some((p) => p.mandat !== null)) ambMandat += 1;

      await desa(municipalityId, "despesaProgrames", {
        font: {
          dataset: LIQUIDACIO_PROGRAMES,
          nom: "Liquidació del pressupost per programes",
          organisme: "Consorci AOC, a partir de les liquidacions dels ens locals",
          portal: "dadesobertes.seu-e.cat",
          classificacio: "Classificació funcional, grups de programa (nivell 3)",
        },
        anys,
        /** L'últim exercici que ha liquidat aquest ajuntament. */
        darrerAny: darrer,
        /** L'últim que es pot comparar amb tot Catalunya; és el de les medianes. */
        anyComparable,
        anysSenseLiquidacio: senseLiquidacio,
        total: [...totalsDelMunicipi.entries()]
          .sort(([a], [b]) => a - b)
          .map(([any, valors]) => ({ any, ...valors })),
        programes,
        grup: grup
          ? { clau: grup.key, etiqueta: grup.label, mida: grup.size, ambLiquidacio: ambLiquidacioComparable }
          : null,
        mandat: { actual: MANDAT, anterior: MANDAT_ANTERIOR },
        base:
          "Obligacions reconegudes netes, en euros corrents i sense descomptar la inflació. Els euros per habitant de cada exercici es divideixen pel padró d'aquell any.",
        // Aquesta nota va a la fitxa perquè qui la llegeixi no confongui les
        // dues coses; a la sèrie ja hi són separades pel camp `liquidacio`.
        zeroIBuit:
          "«liquidacio: false» vol dir que aquell exercici encara no s'ha liquidat i no en sabem res. Un import de 0 € vol dir que l'ajuntament ha presentat els comptes i no hi ha destinat cap euro.",
      });
      run.rowsOut += 1;
    }

    // Els municipis sense cap liquidació des del 2019 no existeixen avui, però si
    // un dia n'hi ha cap ha de sortir a l'índex de cobertura i no desaparèixer.
    const sense = tots.filter((m) => !series.has(m.id));
    for (const m of sense) {
      await run.issue({
        kind: "programes: sense cap liquidació",
        severity: "mitjana",
        municipalityId: m.id,
        detail: { dataset: LIQUIDACIO_PROGRAMES, municipi: m.name, codiEns: m.codiEns },
      });
    }
    // I els que sí que en tenen però els falta algun exercici del mandat: no és
    // un error nostre, però decideix fins on arriba la variació que publiquem.
    let ambForatDeMandat = 0;
    for (const [municipalityId, quins] of liquidats) {
      const falten = anys.filter((any) => any >= MANDAT && !quins.has(any));
      if (falten.length === 0) continue;
      ambForatDeMandat += 1;
      await run.issue({
        kind: "programes: exercici del mandat sense liquidar",
        severity: "baixa",
        municipalityId,
        detail: { municipi: nomDe.get(municipalityId), anys: falten },
      });
    }

    run.say(`${series.size} municipis desats · ${ambMandat} amb variació de mandat des del ${MANDAT}`);
    run.say(`${ambForatDeMandat} amb algun exercici del mandat sense liquidar · ${sense.length} sense cap dada`);
    return {
      anys,
      anyComparable,
      municipis: series.size,
      programes: PROGRAMES.length,
      ambMandat,
      ambForatDeMandat,
      sense: sense.length,
    };
  });
}
