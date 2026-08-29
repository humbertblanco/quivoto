import { municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { ckanSql, MANDATE_START } from "../adapters/aoc";
import { buildPeerGroups, medianOf, percentileOf } from "../derive/peers";
import { withRun } from "../lib/run";

/**
 * J10 — què fa l'ajuntament, més enllà de qui el governa.
 *
 * Un ple es reuneix, aprova ordenances, reparteix càrrecs i, sobretot, gasta
 * diners contractant. Aquestes quatre fonts són l'única manera de dir-ho amb el
 * mateix criteri per als 947 municipis sense llegir-ne cap acta:
 *
 *   1. **Contractació pública (PSCP)**: quant s'adjudica per habitant i, molt més
 *      important, amb quanta competència. Un poble on el 80% de les licitacions
 *      reben una sola oferta no té un mercat, té un proveïdor.
 *   2. **Ordenances i reglaments**: quanta normativa pròpia ha aprovat aquest
 *      mandat i quina és l'última, amb l'enllaç al text oficial.
 *   3. **Cartipàs**: l'enllaç al document que diu qui té quina regidoria. La
 *      font no el desglossa, però l'enllaç ja val: és el paper que la gent busca
 *      i no troba.
 *   4. **Organismes dependents**: patronats, societats i consorcis que pengen de
 *      l'ajuntament. És on sovint viu la despesa que no surt al pressupost
 *      municipal, perquè la liquidació consolida organismes autònoms però no
 *      societats mercantils.
 *
 * Del PSCP només en publiquem agregats. La font porta nom i NIF de cada
 * adjudicatari i seria fàcil fer-ne un rànquing d'empreses, però això no
 * respon «què m'hi jugo el 23-M» i sí que assenyala persones i negocis
 * concrets: es queda fora, i qui vulgui el detall té l'enllaç a la font.
 */

const PSCP = "7448c675-8880-464e-9980-1b92119e59c8";
const ORDENANCES = "4597729c-7325-4525-bada-65c74dfd8877";
const CARTIPAS = "1dda84e8-1f08-415b-a7c7-c45b50424249";
const ORGANISMES = "a5773993-4992-4ec0-84e2-95d31ad8101c";

const FONT_PSCP = "https://dadesobertes.seu-e.cat/dataset/css-rc-contractes-pscp";
const FONT_ORDENANCES = "https://dadesobertes.seu-e.cat/dataset/agn-n-ordenances-reguladores-i-reglaments";
const FONT_CARTIPAS = "https://dadesobertes.seu-e.cat/dataset/iio-op-cartipas";
const FONT_ORGANISMES = "https://dadesobertes.seu-e.cat/dataset/iio-ii-organismes-dependents";

/**
 * L'àmbit dels ens locals dins del PSCP. Sense filtrar-lo, la meitat del conjunt
 * són contractes de les universitats i de la Generalitat, que no toquen cap
 * ajuntament.
 */
const AMBIT_LOCAL = "1500002";

/**
 * La fase «Publicació agregada de contractes» són els contractes menors, que per
 * llei s'adjudiquen sense concurrència. Comptar-los dins de l'indicador de
 * competència el falsejaria: el 80% en tenen una sola oferta perquè així funciona
 * el contracte menor, no perquè ningú no s'hi presenti.
 */
const FASE_MENORS = "Publicació agregada de contractes";

/**
 * El conjunt només conté adjudicacions des de l'1 de gener del 2025 —verificat
 * amb crides reals, malgrat que el catàleg parli del 2018, que és la data de
 * l'anunci més antic d'un contracte adjudicat després.
 *
 * La finestra es tanca per dalt el dia que s'executa la feina perquè hi ha
 * un centenar de contractes datats al futur (i algun a l'any 4006 o 5023): si
 * els deixéssim entrar, la fitxa diria que les dades arriben fins al desembre
 * quan de fet s'acaben a l'agost.
 */
const PSCP_DES_DE = "2025-01-01";

/**
 * Per sota d'aquest nombre de licitacions, el percentatge d'una sola oferta és
 * anecdòtic: amb tres licitacions els valors possibles són 0, 33, 67 i 100. El
 * calculem igualment però no entra a la distribució del grup de comparació.
 */
const MIN_LICITACIONS = 5;

type FilaCkan = Record<string, string | number | null>;

const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
const arrodoneix = (v: number, decimals = 2): number => {
  const factor = 10 ** decimals;
  return Math.round(v * factor) / factor;
};

/** Com `arrodoneix`, però conserva el `null` d'una mediana sense mostra. */
const arrodoneixSiHiHa = (v: number | null, decimals = 2): number | null =>
  v === null ? null : arrodoneix(v, decimals);

/**
 * El `CODI_ENS` d'aquestes fonts és text però ha passat per un full de càlcul: els
 * municipis de Barcelona hi perden el zero inicial («0801930008» → «801930008»).
 * Els valors escombraria («None», «0») no arriben a cap municipi real.
 */
export function codiEns10(value: unknown): string {
  const text = String(value ?? "").trim();
  return /^\d{1,10}$/.test(text) ? text.padStart(10, "0") : "";
}

/**
 * Data en ISO curt, o `null` si la font s'ha inventat l'any. A les ordenances hi
 * ha un document datat l'any 11 i n'hi ha dos amb data futura: no els volem ni
 * comptar ni ensenyar com a «l'última aprovada».
 */
export function dataIso(value: unknown, avui = new Date()): string | null {
  const text = String(value ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const limit = new Date(avui.getTime() + 86_400_000).toISOString().slice(0, 10);
  return text >= "1900-01-01" && text <= limit ? text : null;
}

// ------------------------------------------------------------- contractació

/** Una fila del CKAN ja agregada per ens i any d'adjudicació. */
export type FilaContractacio = {
  ens: string;
  any: number;
  contractes: number;
  volum: number;
  licitacions: number;
  ambOfertes: number;
  sumaOfertes: number;
  unaOferta: number;
};

export type AnyContractacio = {
  any: number;
  /** Complet o no: el 2026 va per la meitat i comparar-lo amb el 2025 enganya. */
  complet: boolean;
  contractes: number;
  volum: number;
  volumPerHabitant: number | null;
  licitacions: number;
  ofertesMitjana: number | null;
  unaOfertaPct: number | null;
};

export type ResumContractacio = {
  anys: AnyContractacio[];
  /** Tota la finestra junta: en un poble petit un sol any no dona ni per mirar-lo. */
  finestra: {
    contractes: number;
    volum: number;
    licitacions: number;
    ofertesMitjana: number | null;
    unaOfertaPct: number | null;
    /** Licitacions amb el nombre d'ofertes informat, que és sobre el que es calcula. */
    licitacionsAmbOfertes: number;
  };
  /** Volum per habitant de l'últim any sencer: la xifra que es pot comparar. */
  volumPerHabitant: number | null;
  ultimAnyComplet: number | null;
};

/**
 * Agrega les files d'un municipi. El volum per habitant surt de l'últim any
 * sencer —barrejar un any tancat amb mig any en curs dona una xifra que no vol
 * dir res—, mentre que la competència es mira sobre tota la finestra, perquè un
 * municipi de mil habitants no fa cinc licitacions l'any.
 */
export function resumContractacio(
  files: readonly FilaContractacio[],
  habitants: number | null,
  ultimAnyComplet: number | null,
): ResumContractacio {
  const anys = [...files]
    .sort((a, b) => a.any - b.any)
    .map((f): AnyContractacio => ({
      any: f.any,
      complet: ultimAnyComplet !== null && f.any <= ultimAnyComplet,
      contractes: f.contractes,
      volum: arrodoneix(f.volum),
      volumPerHabitant: habitants && habitants > 0 ? arrodoneix(f.volum / habitants) : null,
      licitacions: f.licitacions,
      ofertesMitjana: f.ambOfertes > 0 ? arrodoneix(f.sumaOfertes / f.ambOfertes, 1) : null,
      unaOfertaPct: f.ambOfertes > 0 ? Math.round((100 * f.unaOferta) / f.ambOfertes) : null,
    }));

  const suma = (pick: (f: FilaContractacio) => number): number => files.reduce((a, f) => a + pick(f), 0);
  const ambOfertes = suma((f) => f.ambOfertes);
  const darrer = ultimAnyComplet === null ? undefined : anys.find((a) => a.any === ultimAnyComplet);

  return {
    anys,
    finestra: {
      contractes: suma((f) => f.contractes),
      volum: arrodoneix(suma((f) => f.volum)),
      licitacions: suma((f) => f.licitacions),
      licitacionsAmbOfertes: ambOfertes,
      ofertesMitjana: ambOfertes > 0 ? arrodoneix(suma((f) => f.sumaOfertes) / ambOfertes, 1) : null,
      unaOfertaPct: ambOfertes > 0 ? Math.round((100 * suma((f) => f.unaOferta)) / ambOfertes) : null,
    },
    volumPerHabitant: darrer?.volumPerHabitant ?? null,
    ultimAnyComplet,
  };
}

/**
 * Últim any sencer que hi ha al conjunt. Si l'última adjudicació és del juliol
 * del 2026, l'any complet és el 2025: el 2026 encara s'està omplint.
 */
export function ultimAnyComplet(ultimaData: string | null): number | null {
  if (!ultimaData) return null;
  const any = Number(ultimaData.slice(0, 4));
  if (!Number.isFinite(any)) return null;
  return ultimaData.slice(5) === "12-31" ? any : any - 1;
}

// -------------------------------------------------------------- ordenances

export type Ordenanca = { titol: string; data: string; enllac: string | null };

/**
 * Compta la normativa aprovada durant el mandat i en desa les últimes cinc. El
 * títol es retalla perquè la font arrossega espais finals i files sense resum.
 */
export function resumOrdenances(
  files: readonly { titol: unknown; data: unknown; enllac: unknown }[],
  desDe: string,
  avui = new Date(),
): { mandat: number; ultimes: Ordenanca[] } {
  const netes: Ordenanca[] = [];
  for (const fila of files) {
    const data = dataIso(fila.data, avui);
    if (!data || data < desDe) continue;
    const titol = String(fila.titol ?? "").trim();
    if (titol === "") continue;
    const enllac = String(fila.enllac ?? "").trim();
    netes.push({ titol, data, enllac: enllac.startsWith("http") ? enllac : null });
  }
  netes.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
  return { mandat: netes.length, ultimes: netes.slice(0, 5) };
}

// ----------------------------------------------------------------- cartipàs

export type Cartipas = { titol: string; data: string | null; enllac: string | null };

/**
 * Tria el cartipàs de l'ajuntament. Els ajuntaments grans hi tenen una fila per
 * cada institut i patronat («Ajuntament de Barcelona - Institut de Cultura»):
 * el document que busca la gent és el de l'ajuntament sense sufix, i entre
 * diversos candidats, el publicat més tard.
 */
export function triaCartipas(
  files: readonly { nomEns: unknown; titol: unknown; data: unknown; enllac: unknown; vigent: unknown }[],
): Cartipas | null {
  const candidats = files
    .filter((f) => String(f.vigent ?? "") === "True")
    .map((f) => ({
      titol: String(f.titol ?? "").trim(),
      data: dataIso(f.data),
      enllac: String(f.enllac ?? "").trim() || null,
      // El sufix darrere del guió és sempre un organisme dependent, mai l'ajuntament.
      propi: !String(f.nomEns ?? "").includes(" - "),
    }))
    .sort((a, b) => Number(b.propi) - Number(a.propi) || String(b.data).localeCompare(String(a.data)));
  const millor = candidats[0];
  if (!millor) return null;
  return { titol: millor.titol, data: millor.data, enllac: millor.enllac };
}

// -------------------------------------------------------------- organismes

/**
 * La font retalla el nom del tipus a 40 caràcters i deixa «participades íntegr».
 * El desem sencer perquè a la fitxa no hi pot sortir una paraula partida.
 */
const TIPUS_ORGANISME: Record<string, string> = {
  "Societats mercantils participades íntegr": "Societats mercantils 100% municipals",
  "Societats mercantils de capital mixt": "Societats mercantils de capital mixt",
  "Entitats Municipals Descentralitzades": "Entitats municipals descentralitzades",
};

export type Organisme = { nom: string; tipus: string; relacio: string };

export type ResumOrganismes = {
  total: number;
  perTipus: Record<string, number>;
  organismes: Organisme[];
};

/** Ordena els organismes per tipus i nom perquè la fitxa surti igual cada cop. */
export function resumOrganismes(
  files: readonly { nom: unknown; tipus: unknown; relacio: unknown }[],
): ResumOrganismes {
  const organismes = files
    .map((f) => {
      const tipusCru = String(f.tipus ?? "").trim();
      return {
        nom: String(f.nom ?? "").trim(),
        tipus: TIPUS_ORGANISME[tipusCru] ?? tipusCru,
        relacio: String(f.relacio ?? "").trim(),
      };
    })
    .filter((o) => o.nom !== "")
    .sort((a, b) => a.tipus.localeCompare(b.tipus, "ca") || a.nom.localeCompare(b.nom, "ca"));

  const perTipus: Record<string, number> = {};
  for (const o of organismes) perTipus[o.tipus] = (perTipus[o.tipus] ?? 0) + 1;
  return { total: organismes.length, perTipus, organismes };
}

// ------------------------------------------------------------------- feina

export async function j10Activitat(db: Db): Promise<void> {
  const tots = await db.select().from(municipalities);
  const perCodiEns = new Map(tots.map((m) => [m.codiEns, m.id]));
  const habitants = new Map(tots.map((m) => [m.id, m.population]));
  const grups = buildPeerGroups(tots.map((m) => ({ id: m.id, population: m.population })));

  const desa = async (municipalityId: number, kind: string, data: unknown): Promise<void> => {
    await db
      .insert(municipalityMetrics)
      .values({ municipalityId, kind, data })
      .onConflictDoUpdate({
        target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
        set: { data, computedAt: new Date() },
      });
  };

  // -------------------------------------------------------- contractació
  await withRun(db, "J10 contractació pública", async (run) => {
    const avui = new Date().toISOString().slice(0, 10);
    // 477.888 files no caben en una resposta del CKAN (talla a 32.000), i tampoc
    // les volem: el que publiquem són agregats, així que l'agregació es fa al
    // servidor i en tornen ~2.300 files.
    //
    // Dos paranys d'aquesta consulta, tots dos verificats:
    //   · `COALESCE` està prohibit per l'API (torna 403), i `ANY` és paraula
    //     reservada i no pot ser àlies de columna (torna 409).
    //   · El mateix contracte hi surt fins a tres cops mentre avança per les
    //     fases (adjudicació → formalització → execució). El `DISTINCT ON` es
    //     queda amb la fila més nova de cada lot; sense això sobren 7.260 files.
    const files = await ckanSql<FilaCkan>(
      `SELECT ens, exercici,
              COUNT(*) contractes, SUM(import) volum,
              SUM(CASE WHEN licitacio THEN 1 ELSE 0 END) licitacions,
              SUM(CASE WHEN licitacio AND ofertes IS NOT NULL THEN 1 ELSE 0 END) amb_ofertes,
              SUM(CASE WHEN licitacio AND ofertes IS NOT NULL THEN ofertes ELSE 0 END) suma_ofertes,
              SUM(CASE WHEN licitacio AND ofertes = 1 THEN 1 ELSE 0 END) una_oferta
       FROM (
         SELECT DISTINCT ON ("CODI_ORGAN", "CODI_EXPEDIENT", "NUMERO_LOT")
                lpad("CODI_INE10", 10, '0') ens,
                to_char("DATA_ADJUDICACIO_CONTRACTE", 'YYYY') exercici,
                "IMPORT_ADJUDICACIO_SENSE_IVA"::numeric import,
                "OFERTES_REBUDES"::numeric ofertes,
                ("FASE_PUBLICACIO" <> '${FASE_MENORS}') licitacio
         FROM "${PSCP}"
         WHERE "CODI_AMBIT" = '${AMBIT_LOCAL}'
           AND "FASE_PUBLICACIO" <> 'Anul·lació'
           AND "DATA_ADJUDICACIO_CONTRACTE" >= '${PSCP_DES_DE}'
           AND "DATA_ADJUDICACIO_CONTRACTE" <= '${avui}'
         ORDER BY "CODI_ORGAN", "CODI_EXPEDIENT", "NUMERO_LOT", _id DESC
       ) t
       GROUP BY ens, exercici`,
    );
    run.rowsIn = files.length;

    const [finestra] = await ckanSql<FilaCkan>(
      `SELECT MIN("DATA_ADJUDICACIO_CONTRACTE") primera, MAX("DATA_ADJUDICACIO_CONTRACTE") ultima
       FROM "${PSCP}"
       WHERE "CODI_AMBIT" = '${AMBIT_LOCAL}'
         AND "DATA_ADJUDICACIO_CONTRACTE" >= '${PSCP_DES_DE}'
         AND "DATA_ADJUDICACIO_CONTRACTE" <= '${avui}'`,
    );
    const primeraData = dataIso(finestra?.primera) ?? PSCP_DES_DE;
    const ultimaData = dataIso(finestra?.ultima);
    const anyComplet = ultimAnyComplet(ultimaData);
    run.say(`adjudicacions de ${primeraData} a ${ultimaData ?? "?"} · últim any sencer: ${anyComplet ?? "cap"}`);

    const perMunicipi = new Map<number, FilaContractacio[]>();
    const forans = new Set<string>();
    for (const fila of files) {
      const ens = codiEns10(fila.ens);
      const municipalityId = perCodiEns.get(ens);
      if (!municipalityId) {
        // Diputacions, consells comarcals, consorcis i societats municipals: tenen
        // el seu codi propi i no són l'ajuntament, per molt que hi pengin.
        forans.add(ens);
        continue;
      }
      const llista = perMunicipi.get(municipalityId) ?? [];
      llista.push({
        ens,
        any: num(fila.exercici),
        contractes: num(fila.contractes),
        volum: num(fila.volum),
        licitacions: num(fila.licitacions),
        ambOfertes: num(fila.amb_ofertes),
        sumaOfertes: num(fila.suma_ofertes),
        unaOferta: num(fila.una_oferta),
      });
      perMunicipi.set(municipalityId, llista);
    }
    run.say(`${perMunicipi.size} ajuntaments · ${forans.size} ens locals que no són cap ajuntament`);

    const resums = new Map<number, ResumContractacio>();
    for (const [municipalityId, llista] of perMunicipi) {
      resums.set(municipalityId, resumContractacio(llista, habitants.get(municipalityId) ?? null, anyComplet));
    }

    // Distribucions dins del grup de comparació. Un ajuntament de 400 habitants
    // adjudica per força menys per habitant que una capital de comarca amb
    // piscina i escola de música: comparar-lo amb tot Catalunya no diria res.
    const volumsPerGrup = new Map<string, number[]>();
    const unaOfertaPerGrup = new Map<string, number[]>();
    for (const [municipalityId, resum] of resums) {
      const grup = grups.get(municipalityId);
      if (!grup) continue;
      if (resum.volumPerHabitant !== null) {
        volumsPerGrup.set(grup.key, [...(volumsPerGrup.get(grup.key) ?? []), resum.volumPerHabitant]);
      }
      if (resum.finestra.unaOfertaPct !== null && resum.finestra.licitacionsAmbOfertes >= MIN_LICITACIONS) {
        unaOfertaPerGrup.set(grup.key, [...(unaOfertaPerGrup.get(grup.key) ?? []), resum.finestra.unaOfertaPct]);
      }
    }

    for (const [municipalityId, resum] of resums) {
      const grup = grups.get(municipalityId);
      const volums = grup ? volumsPerGrup.get(grup.key) ?? [] : [];
      const solitaries = grup ? unaOfertaPerGrup.get(grup.key) ?? [] : [];
      const compta = resum.finestra.licitacionsAmbOfertes >= MIN_LICITACIONS;

      await desa(municipalityId, "contractacio", {
        ...resum,
        finestraDates: { desDe: primeraData, finsA: ultimaData },
        comparacio: grup
          ? {
              grup: grup.label,
              // Quants municipis del grup entren a cada distribució, que no és el
              // mateix nombre: al percentil d'una sola oferta només hi entren els
              // que tenen prou licitacions.
              municipisVolum: volums.length,
              percentilVolum:
                resum.volumPerHabitant === null ? null : percentileOf(resum.volumPerHabitant, volums),
              medianaVolum: arrodoneixSiHiHa(medianOf(volums)),
              // Amb menys de cinc licitacions el percentatge és anecdòtic i no el
              // situem: dir «està al percentil 90» sobre tres licitacions és fals.
              percentilUnaOferta:
                compta && resum.finestra.unaOfertaPct !== null
                  ? percentileOf(resum.finestra.unaOfertaPct, solitaries)
                  : null,
              medianaUnaOferta: arrodoneixSiHiHa(medianOf(solitaries), 1),
              municipisUnaOferta: solitaries.length,
            }
          : null,
        font: "Plataforma de Serveis de Contractació Pública (PSCP), via dades obertes de l'AOC",
        fontUrl: FONT_PSCP,
        // Els noms d'adjudicataris són a la font i no els publiquem: qui vulgui
        // saber qui ha guanyat cada contracte hi té l'enllaç.
        detall: "https://contractaciopublica.cat/",
      });
      run.rowsOut += 1;
    }

    if (perMunicipi.size < 700) {
      await run.issue({
        kind: "pscp_cobertura_baixa",
        severity: "mitjana",
        detail: { ajuntaments: perMunicipi.size },
      });
    }
    run.say(`${run.rowsOut} municipis amb contractació`);
    return { municipis: run.rowsOut, desDe: primeraData, finsA: ultimaData, anyComplet };
  });

  // ---------------------------------------------------------- ordenances
  await withRun(db, "J10 ordenances i reglaments", async (run) => {
    // El camp de l'enllaç porta cedilla al nom. Filtrem per data a la consulta
    // perquè el conjunt sencer (33.991 files) frega el límit del CKAN.
    const files = await ckanSql<FilaCkan>(
      `SELECT "CODI_ENS", "RESUM", "DATA_PUB", "ENLLAÇ"
       FROM "${ORDENANCES}" WHERE "DATA_PUB" >= '${MANDATE_START}'`,
    );
    run.rowsIn = files.length;

    const perMunicipi = new Map<number, { titol: unknown; data: unknown; enllac: unknown }[]>();
    for (const fila of files) {
      const municipalityId = perCodiEns.get(codiEns10(fila.CODI_ENS));
      if (!municipalityId) continue;
      const llista = perMunicipi.get(municipalityId) ?? [];
      llista.push({ titol: fila.RESUM, data: fila.DATA_PUB, enllac: fila["ENLLAÇ"] });
      perMunicipi.set(municipalityId, llista);
    }

    for (const [municipalityId, llista] of perMunicipi) {
      const resum = resumOrdenances(llista, MANDATE_START);
      await desa(municipalityId, "ordenances", {
        ...resum,
        desDe: MANDATE_START,
        font: "Ordenances reguladores i reglaments (CIDO), via dades obertes de l'AOC",
        fontUrl: FONT_ORDENANCES,
      });
      run.rowsOut += 1;
    }
    run.say(`${run.rowsOut} municipis amb normativa aprovada des del ${MANDATE_START}`);
    return { municipis: run.rowsOut };
  });

  // ------------------------------------------------------------ cartipàs
  await withRun(db, "J10 cartipàs", async (run) => {
    // El mandat va al text del resum, no a cap camp: unes files diuen «Cartipàs
    // municipal per al mandat 2023-2027» i altres «Cartipàs per al mandat
    // 2023-2027», i per això el filtre és per la part que comparteixen.
    const files = await ckanSql<FilaCkan>(
      `SELECT "CODI_ENS", "NOM_ENS", "RESUM", "DATA_PUB", "ENLLAÇ", "VIGENT"
       FROM "${CARTIPAS}" WHERE "RESUM" LIKE '%2023-2027%'`,
    );
    run.rowsIn = files.length;

    const perMunicipi = new Map<number, FilaCkan[]>();
    for (const fila of files) {
      const municipalityId = perCodiEns.get(codiEns10(fila.CODI_ENS));
      if (!municipalityId) continue;
      perMunicipi.set(municipalityId, [...(perMunicipi.get(municipalityId) ?? []), fila]);
    }

    for (const [municipalityId, llista] of perMunicipi) {
      const cartipas = triaCartipas(
        llista.map((f) => ({
          nomEns: f.NOM_ENS,
          titol: f.RESUM,
          data: f.DATA_PUB,
          enllac: f["ENLLAÇ"],
          vigent: f.VIGENT,
        })),
      );
      if (!cartipas) continue;
      await desa(municipalityId, "cartipas", {
        ...cartipas,
        mandat: "2023-2027",
        font: "Cartipàs: organització política (CIDO), via dades obertes de l'AOC",
        fontUrl: FONT_CARTIPAS,
      });
      run.rowsOut += 1;
    }
    run.say(`${run.rowsOut} municipis amb cartipàs del mandat 2023-2027`);
    return { municipis: run.rowsOut };
  });

  // ---------------------------------------------------------- organismes
  await withRun(db, "J10 organismes dependents", async (run) => {
    // El pare és `CODI_ENS_PARE`, i `DESCRIPCIO_TIPUS_PARE` diu de quina mena
    // d'ens és: sense filtrar per «Municipis» s'hi colen els organismes que
    // pengen de diputacions, consells comarcals i EMD.
    const files = await ckanSql<FilaCkan>(
      `SELECT "CODI_ENS_PARE", "NOM_ENS_DEPENDENT", "TIPUS_ENS_DEPENDENT", "TIPUS_RELACIO"
       FROM "${ORGANISMES}" WHERE "DESCRIPCIO_TIPUS_PARE" = 'Municipis'`,
    );
    run.rowsIn = files.length;

    const perMunicipi = new Map<number, { nom: unknown; tipus: unknown; relacio: unknown }[]>();
    for (const fila of files) {
      const municipalityId = perCodiEns.get(codiEns10(fila.CODI_ENS_PARE));
      if (!municipalityId) {
        await run.issue({
          kind: "organisme_pare_desconegut",
          severity: "baixa",
          entity: String(fila.NOM_ENS_DEPENDENT ?? ""),
          detail: { codiEnsPare: fila.CODI_ENS_PARE },
        });
        continue;
      }
      const llista = perMunicipi.get(municipalityId) ?? [];
      llista.push({
        nom: fila.NOM_ENS_DEPENDENT,
        tipus: fila.TIPUS_ENS_DEPENDENT,
        relacio: fila.TIPUS_RELACIO,
      });
      perMunicipi.set(municipalityId, llista);
    }

    for (const [municipalityId, llista] of perMunicipi) {
      await desa(municipalityId, "organismes", {
        ...resumOrganismes(llista),
        font: "Organismes dependents o vinculats, dades obertes de l'AOC",
        fontUrl: FONT_ORGANISMES,
      });
      run.rowsOut += 1;
    }
    run.say(`${run.rowsOut} municipis amb organismes dependents`);
    return { municipis: run.rowsOut };
  });
}
