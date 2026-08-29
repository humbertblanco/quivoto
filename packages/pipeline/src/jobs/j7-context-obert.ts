import { municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { ckanSql } from "../adapters/aoc";
import { municipalityName, normalize, uninvertArticle } from "../lib/text";
import { sameForce, siglesFamily } from "@quivoto/shared-schemas/brands";
import { withRun } from "../lib/run";
import { buildPeerGroups, percentileOf } from "../derive/peers";

/**
 * J7 — el context obert que costa zero i explica molt.
 *
 * Quatre fonts que no demanen cap model de llenguatge ni cap descàrrega de PDF, i
 * que multipliquen el que la fitxa d'un municipi pot dir:
 *
 *   1. **La sèrie electoral des del 1979**: dotze eleccions municipals, no tres.
 *      Amb això es pot dir quants cops ha canviat de mans un ajuntament en
 *      quaranta-cinc anys, cosa que cap altre lloc explica per als 947.
 *   2. **Els tipus impositius**: l'IBI, l'IAE, l'ICIO i l'impost de vehicles,
 *      amb el mateix format per a tothom. És l'única manera honesta de respondre
 *      «aquí es paga més o menys que al poble del costat?».
 *   3. **El compliment del portal de transparència**: quants dels ítems obligatoris
 *      publica realment cada ajuntament. Un ajuntament que no publica és una dada.
 *   4. **Els plens sense oposició**: els 185 ajuntaments on només s'hi va
 *      presentar una candidatura, segons el Síndic de Greuges.
 */

const ELECCIONS = "3539f7e6-4a48-4b57-9b55-b8c41079b3cd";
const TIPUS_IMPOSITIUS = "82ae0ea2-6fc6-4fd5-b944-4ef6d18717bc";
const TRANSPARENCIA = "1a9c1ede-8486-4a00-a48f-1b3271f6115c";
const SENSE_OPOSICIO = "943d6174-f0cc-41b4-b7c7-3f92041b22c1";

/** Els impostos que la gent reconeix; la resta del conjunt és soroll per a la fitxa. */
const IMPOSTOS: Record<string, { key: string; label: string; unit: string }> = {
  "impost de bens immobles urbana": { key: "ibi", label: "IBI urbà", unit: "%" },
  "impost sobre construccions installacions i obres": { key: "icio", label: "Obres (ICIO)", unit: "%" },
  "impost d activitats economiques coeficient maxim": { key: "iae", label: "Activitats (IAE), màxim", unit: "" },
  "any de la darrere revisio cadastral": { key: "cadastre", label: "Última revisió cadastral", unit: "any" },
  "ivtm turismes de 12 a 15 99 cavalls fiscals": { key: "ivtm", label: "Cotxe de 12-16 CV", unit: "€" },
};

type Row = Record<string, string | number | null>;
const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Desa una mètrica, reescrivint la que hi hagués. */
async function save(db: Db, municipalityId: number, kind: string, data: unknown): Promise<void> {
  await db
    .insert(municipalityMetrics)
    .values({ municipalityId, kind, data })
    .onConflictDoUpdate({
      target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
      set: { data, computedAt: new Date() },
    });
}

export async function j7ContextObert(db: Db): Promise<void> {
  const all = await db.select().from(municipalities);
  const byCodiEns = new Map<string, number>();
  const byName = new Map<string, number>();
  for (const m of all) {
    byCodiEns.set(m.codiEns, m.id);
    byName.set(normalize(m.name), m.id);
  }
  const resolve = (codi: unknown): number | undefined => byCodiEns.get(String(codi).padStart(10, "0"));

  // ---------------------------------------------------------- 1979-2023
  await withRun(db, "J7 sèrie electoral 1979-2023", async (run) => {
    // CKAN talla a 32.000 files: la sèrie sencera en té 36.743 i tornava
    // incompleta, deixant 112 municipis fora sense cap avís.
    const rows: Row[] = [];
    for (const [from, to] of [[1979, 1999], [2003, 2023]] as const) {
      rows.push(
        ...(await ckanSql<Row>(
          `SELECT "CODI_ENS", "ANY_ELECCIO", "SIGLES", "VOTS", "REGIDORS" FROM "${ELECCIONS}"
           WHERE "ANY_ELECCIO" BETWEEN ${from} AND ${to}`,
        )),
      );
    }
    run.rowsIn = rows.length;

    type Entry = { sigles: string; votes: number; seats: number };
    const byMunicipality = new Map<number, Map<number, Entry[]>>();
    for (const row of rows) {
      const municipalityId = resolve(row.CODI_ENS);
      if (!municipalityId) continue;
      let years = byMunicipality.get(municipalityId);
      if (!years) byMunicipality.set(municipalityId, (years = new Map()));
      const year = num(row.ANY_ELECCIO);
      const list = years.get(year) ?? [];
      list.push({ sigles: String(row.SIGLES ?? "?"), votes: num(row.VOTS), seats: num(row.REGIDORS) });
      years.set(year, list);
    }

    const allYears = new Set<number>();
    for (const [municipalityId, years] of byMunicipality) {
      const series = [...years.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([year, list]) => {
          allYears.add(year);
          const sorted = [...list].sort((a, b) => b.seats - a.seats || b.votes - a.votes);
          const total = list.reduce((a, e) => a + e.votes, 0);
          // Escons per força, no per candidatura: és l'única manera de comparar
          // dotze eleccions en què les sigles canvien cada poques convocatòries.
          const byFamily = new Map<string, number>();
          for (const entry of list) {
            if (entry.seats <= 0) continue;
            const family = siglesFamily(entry.sigles) ?? "local";
            byFamily.set(family, (byFamily.get(family) ?? 0) + entry.seats);
          }

          return {
            year,
            seats: list.reduce((a, e) => a + e.seats, 0),
            totalVotes: total,
            winner: sorted[0] ? { sigles: sorted[0].sigles, seats: sorted[0].seats, votes: sorted[0].votes } : null,
            winnerFamily: sorted[0] ? siglesFamily(sorted[0].sigles) ?? "local" : null,
            families: Object.fromEntries([...byFamily.entries()].sort((a, b) => b[1] - a[1])),
            candidatures: sorted.length,
          };
        });

      // Quantes vegades ha canviat la llista més votada: la mesura més simple
      // d'alternança que es pot fer amb aquesta font.
      let alternances = 0;
      for (let i = 1; i < series.length; i += 1) {
        const previous = series[i - 1]!.winner?.sigles;
        const current = series[i]!.winner?.sigles;
        if (!sameForce(previous, current)) alternances += 1;
      }

      await save(db, municipalityId, "electoralHistory", {
        series,
        elections: series.length,
        firstYear: series[0]?.year ?? null,
        alternances,
      });
      run.rowsOut += 1;
    }
    run.say(`${run.rowsOut} municipis · ${allYears.size} convocatòries, de ${Math.min(...allYears)} a ${Math.max(...allYears)}`);
    return { municipis: run.rowsOut, convocatories: allYears.size };
  });

  // ------------------------------------------------------------ impostos
  await withRun(db, "J7 tipus impositius", async (run) => {
    // L'últim any del conjunt sol tenir quatre files de mostra. Ens quedem amb
    // l'últim que cobreix de debò el país.
    const perYear = await ckanSql<{ ANY: number; n: string }>(
      `SELECT "ANY", COUNT(DISTINCT "CODI_ENS") AS n FROM "${TIPUS_IMPOSITIUS}" GROUP BY "ANY" ORDER BY "ANY" DESC`,
    );
    const usable = perYear.find((r) => num(r.n) >= 500);
    if (!usable) {
      await run.issue({ kind: "taxes_unavailable", severity: "mitjana", detail: { perYear } });
      return { municipis: 0 };
    }
    const year = num(usable.ANY);
    run.say(`any triat: ${year} (${usable.n} municipis)`);
    const rows = await ckanSql<Row>(
      `SELECT "CODI_ENS", "DESC_ESTRUCTURA", "IMPORT" FROM "${TIPUS_IMPOSITIUS}" WHERE "ANY" = ${year}`,
    );
    run.rowsIn = rows.length;

    const byMunicipality = new Map<number, Record<string, { label: string; value: number; unit: string }>>();
    for (const row of rows) {
      const municipalityId = resolve(row.CODI_ENS);
      if (!municipalityId) continue;
      const spec = IMPOSTOS[normalize(String(row.DESC_ESTRUCTURA ?? ""))];
      if (!spec) continue;
      const bucket = byMunicipality.get(municipalityId) ?? {};
      bucket[spec.key] = { label: spec.label, value: num(row.IMPORT), unit: spec.unit };
      byMunicipality.set(municipalityId, bucket);
    }

    // Medianes catalanes: sense un punt de comparació, un tipus impositiu tot sol
    // no diu res a ningú.
    const medians: Record<string, number> = {};
    for (const key of Object.values(IMPOSTOS).map((s) => s.key)) {
      const values = [...byMunicipality.values()].map((b) => b[key]?.value).filter((v): v is number => v !== undefined && v > 0).sort((a, b) => a - b);
      if (values.length > 0) medians[key] = values[Math.floor(values.length / 2)]!;
    }

    for (const [municipalityId, taxes] of byMunicipality) {
      await save(db, municipalityId, "taxes", { year, taxes, medians });
      run.rowsOut += 1;
    }
    run.say(`${run.rowsOut} municipis amb tipus impositius del ${year}`);
    return { municipis: run.rowsOut, any: year };
  });

  // ------------------------------------------------------- transparència
  await j7Transparencia(db);

  // ---------------------------------------------------- sense oposició
  await withRun(db, "J7 plens sense oposició", async (run) => {
    const rows = await ckanSql<Row>(`SELECT "AJUNTAMENT", "CAMPANYA" FROM "${SENSE_OPOSICIO}"`);
    run.rowsIn = rows.length;
    for (const row of rows) {
      // El conjunt del Síndic identifica el municipi pel nom de l'ajuntament,
      // sense codi utilitzable: cal aparellar-lo pel nom normalitzat.
      const name = municipalityName(String(row.AJUNTAMENT ?? ""));
      const municipalityId = byName.get(normalize(name)) ?? byName.get(normalize(uninvertArticle(name)));
      if (!municipalityId) {
        await run.issue({ kind: "sense_oposicio_unmatched", severity: "baixa", entity: String(row.AJUNTAMENT) });
        continue;
      }
      await save(db, municipalityId, "singleList", { campaign: num(row.CAMPANYA) });
      run.rowsOut += 1;
    }
    run.say(`${run.rowsOut} ajuntaments amb una sola candidatura`);
    return { municipis: run.rowsOut };
  });
}

/**
 * Els ítems del portal de transparència que són rendició de comptes de veritat.
 *
 * El conjunt en té 151 d'estàndard per ajuntament, i la immensa majoria són de
 * tràmit: la instància genèrica, el calendari de dies inhàbils, el catàleg de
 * tràmits, les xarxes socials. Que un ajuntament els publiqui no diu res de com
 * ha governat. Aquests dotze sí, i s'han triat amb tres criteris:
 *
 *   1. **Responen «què han fet i amb quins diners»**: què cobren els seus,
 *      què declaren, què han contractat, què han subvencionat, com ha anat el
 *      pressupost, i què han respost a qui els ha demanat informació.
 *   2. **Els omple l'ajuntament, no el portal.** El camp `DADESAUTOMATIQUES`
 *      diu quins ítems els emplena sol el Consorci AOC des d'altres registres.
 *      «Tipus impositius» surt publicat al 99 % dels portals perquè les 939
 *      files són automàtiques totes: mesura la canonada, no la voluntat. Els «Actes de Ple» (99 %,
 *      856 automàtics) queden fora pel mateix motiu, i en canvi hi entra
 *      l'ordre del dia del ple, que sí que s'ha de penjar a mà.
 *   3. **Separen.** Un ítem que publiquen el 99 % no ordena res; se'n conserva
 *      un de sol —el compte general— perquè no publicar els comptes anuals és
 *      prou greu perquè valgui la pena assenyalar els dos que no ho fan.
 *
 * La clau d'unió és `NOMITEM` i **no** `CODIITEM`: el codi no identifica res.
 * El 146 són dos ítems diferents («Resolucions de les sol·licituds d'accés» i
 * «Informació proporcionada per entitats privades»), el 84 i el 86 en tenen
 * cinc cadascun, i l'ítem políticament més sensible de tots —les declaracions
 * de béns i activitats dels alts càrrecs— té el codi **buit**.
 */
export const ITEMS_TRANSPARENCIA: ReadonlyArray<{ key: string; nomItem: string; label: string }> = [
  { key: "retribucions", nomItem: "Retribucions, indemnitzacions i dietes dels empleats públics", label: "Retribucions, indemnitzacions i dietes" },
  { key: "declaracions", nomItem: "Resolucions relatives a les declaracions d'activitats, patrimonials i d'interessos dels alts càrrecs i del personal directiu", label: "Declaracions de béns i activitats dels càrrecs" },
  { key: "incompatibilitats", nomItem: "Resolucions sobre el règim d'incompatibilitats dels alts càrrecs i personal directiu", label: "Incompatibilitats dels càrrecs" },
  { key: "ordreDelDia", nomItem: "Convocatòries de sessions del Ple", label: "Ordre del dia dels plens" },
  { key: "acordsGovern", nomItem: "Acords d'òrgans de govern", label: "Acords dels òrgans de govern" },
  { key: "grupsMunicipals", nomItem: "Opinions i propostes dels grups municipals", label: "Opinions i propostes dels grups municipals" },
  { key: "compteGeneral", nomItem: "Compte general", label: "Compte general (els comptes anuals)" },
  { key: "execucioPressupost", nomItem: "Execució pressupostària trimestral", label: "Execució del pressupost, trimestre a trimestre" },
  { key: "auditories", nomItem: "Auditories de comptes", label: "Auditories de comptes" },
  { key: "contractes", nomItem: "Informe de contractes adjudicats segons el procediment", label: "Contractes adjudicats i per quin procediment" },
  { key: "subvencions", nomItem: "Ajuts atorgats", label: "Ajuts i subvencions atorgats" },
  { key: "dretAcces", nomItem: "Resolucions de les sol·licituds d'accés a la informació pública", label: "Respostes a les peticions d'accés a la informació" },
];

/**
 * Els quatre camps de data del conjunt, del més específic al més genèric. Cap
 * no està prou emplenat per fer-lo servir tot sol: en les files visibles,
 * `DARRERAACTUALITZACIODM` només en cobreix 10.670 de 177.105, i el més ple
 * —`DARRERAACTUALITZACIO`— es queda al 69 %. Ens quedem amb la més recent de
 * les quatre i deixem constància de quin camp l'ha donada.
 */
const CAMPS_DATA = ["DARRERAACTUALITZACIODM", "DARRERAACTUALITZACIOMI", "DARRERAACTUALITZACIODA", "DARRERAACTUALITZACIO"] as const;

/**
 * A partir de quants ítems del mateix dia i del mateix ajuntament una data
 * deixa de ser una actualització i passa a ser una operació del portal.
 *
 * Cal, i molt: el 20 de juny del 2022 l'Ajuntament de Llívia va quedar amb 104
 * ítems datats el mateix dia, i el 26 de novembre del 2015 hi ha 1.032 files
 * amb el mateix segell. Ningú no actualitza cent pàgines en una tarda; això és
 * una migració. Dir «publicat però sense tocar des del 2022» a partir d'una
 * data així seria acusar algú amb una dada falsa, i per això aquestes dates
 * surten marcades i la fitxa les ha de poder descartar.
 */
const DIA_MASSIU = 5;

export type ItemRow = Record<string, string | number | null>;

/** Escapa una cadena per posar-la dins d'un literal SQL de CKAN. */
export const sqlText = (value: string): string => `'${value.replace(/'/g, "''")}'`;

/** El dia (sense hora) d'una marca de temps de CKAN, o null si no n'hi ha. */
export const diaDe = (value: unknown): string | null => {
  const text = String(value ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
};

/**
 * La data més recent d'una fila i de quin dels quatre camps surt. Es diu d'on
 * ve perquè no valen el mateix: `DARRERAACTUALITZACIODA` és el dia que el
 * portal va reomplir l'ítem tot sol, i `DARRERAACTUALITZACIODM` el dia que algú
 * de l'ajuntament el va tocar a mà.
 */
export function dataMesRecent(row: ItemRow): { updatedOn: string | null; updatedFrom: string | null } {
  let updatedOn: string | null = null;
  let updatedFrom: string | null = null;
  for (const camp of CAMPS_DATA) {
    const dia = diaDe(row[camp]);
    if (dia !== null && (updatedOn === null || dia > updatedOn)) {
      updatedOn = dia;
      updatedFrom = camp;
    }
  }
  return { updatedOn, updatedFrom };
}

/**
 * Els dies en què un mateix ajuntament té datats `DIA_MASSIU` ítems o més.
 * Són segells del portal —una migració, un canvi de plantilla— i no volen dir
 * que ningú hagi actualitzat res.
 */
export function diesMassius(rows: Iterable<ItemRow>): Set<string> {
  const perDia = new Map<string, number>();
  for (const row of rows) {
    // Els quatre camps d'una mateixa fila poden caure el mateix dia; comptaria
    // quatre vegades i qualsevol data semblaria massiva.
    const dies = new Set(CAMPS_DATA.map((c) => diaDe(row[c])).filter((d): d is string => d !== null));
    for (const dia of dies) perDia.set(dia, (perDia.get(dia) ?? 0) + 1);
  }
  return new Set([...perDia.entries()].filter(([, n]) => n >= DIA_MASSIU).map(([dia]) => dia));
}

/**
 * Quatre ajuntaments tenen un ítem repetit al portal —Cardona, Das, Santa Fe
 * del Penedès i l'Hospitalet hi tenen dos «Compte general»—, i cal quedar-se
 * amb una sola fila: la que està publicada, i entre dues de publicades la que
 * té la data més recent.
 */
export function esMillorFila(candidata: ItemRow, actual: ItemRow | undefined): boolean {
  if (!actual) return true;
  const visible = (row: ItemRow): number => (Number(row.VISIBLE) === 1 ? 1 : 0);
  if (visible(candidata) !== visible(actual)) return visible(candidata) > visible(actual);
  return (dataMesRecent(candidata).updatedOn ?? "") > (dataMesRecent(actual).updatedOn ?? "");
}

type EstatItem = {
  key: string;
  label: string;
  published: boolean;
  /** Les dades les omple sol el portal: publicar-les no costa cap feina. */
  auto: boolean;
  /** El portal marca l'ítem com a no aplicable a aquest ens. */
  notApplicable: boolean;
  updatedOn: string | null;
  updatedYear: number | null;
  /** De quin dels quatre camps de data surt `updatedOn`. */
  updatedFrom: string | null;
  /** La data ve d'una operació massiva del portal i no diu res de l'ítem. */
  bulk: boolean;
  /** Quants ajuntaments de Catalunya publiquen aquest ítem, i sobre quants. */
  catalunya: { published: number; of: number };
};

/**
 * El portal de transparència, ítem a ítem.
 *
 * Fins ara aquesta feina publicava un percentatge global de compliment, i un
 * «publica el 78 %» no es pot jutjar: ningú no sap quin 78 %. Un «no publica les
 * declaracions de béns dels seus càrrecs electes» sí. El percentatge global es
 * manté intacte —la fitxa i `els947.html` en depenen— i el detall s'hi suma.
 */
export async function j7Transparencia(db: Db): Promise<void> {
  await withRun(db, "J7 portal de transparència", async (run) => {
    const all = await db.select().from(municipalities);
    const byCodiEns = new Map<string, number>();
    for (const m of all) byCodiEns.set(m.codiEns, m.id);
    const resolve = (codi: unknown): number | undefined => byCodiEns.get(String(codi).padStart(10, "0"));

    // ---- el percentatge global, tal com era ----------------------------
    const globals = await ckanSql<Row>(
      `SELECT "CODIINE", COUNT(*) AS total, SUM("VISIBLE") AS visibles
       FROM "${TRANSPARENCIA}" GROUP BY "CODIINE"`,
    );
    type Global = { items: number; published: number; pct: number | null };
    const perMunicipi = new Map<number, Global>();
    for (const row of globals) {
      const municipalityId = resolve(row.CODIINE);
      if (!municipalityId) continue;
      const total = num(row.total);
      const visible = num(row.visibles);
      perMunicipi.set(municipalityId, {
        items: total,
        published: visible,
        pct: total === 0 ? null : Math.round((100 * visible) / total),
      });
    }

    // ---- el detall dels dotze ítems triats -----------------------------
    // Es demanen de quatre en quatre. Cada ítem torna una fila per ens i el
    // conjunt en té 1.376, així que cada tanda són unes 5.500 files: ben lluny
    // del tall de 32.000 de CKAN fins i tot si el catàleg d'ens creix.
    const files: ItemRow[] = [];
    for (let i = 0; i < ITEMS_TRANSPARENCIA.length; i += 4) {
      const tanda = ITEMS_TRANSPARENCIA.slice(i, i + 4);
      files.push(
        ...(await ckanSql<ItemRow>(
          `SELECT "CODIINE", "NOMITEM", "VISIBLE", "NOAPLICA", "DADESAUTOMATIQUES", "DATAREVISIO",
                  ${CAMPS_DATA.map((c) => `"${c}"`).join(", ")}
           FROM "${TRANSPARENCIA}" WHERE "NOMITEM" IN (${tanda.map((it) => sqlText(it.nomItem)).join(", ")})`,
        )),
      );
    }

    run.rowsIn = globals.length + files.length;

    // Els dies de segell massiu s'han de comptar sobre **tot** el portal, no
    // sobre els dotze ítems que hem triat. El llindar de cinc ítems en un mateix
    // dia està calibrat sobre els 151 que té el portal sencer; aplicat a dotze,
    // gairebé cap data no arriba a massiva i la fitxa acabaria dient «publicat
    // però sense tocar des del 2015» a partir d'una data de migració.
    const massiusPerEns = new Map<number, Set<string>>();
    {
      const comptes = await ckanSql<{ CODIINE: number; dia: string; n: string }>(
        // El camp és un `timestamp` i CKAN no deixa cridar `CAST` ni `to_char`:
        // agrupem per la marca de temps sencera, que en aquest conjunt sempre va
        // a mitjanit i per tant equival a agrupar per dia. El dia se'n treu
        // després, retallant els deu primers caràcters.
        `SELECT "CODIINE", "DARRERAACTUALITZACIO" AS dia, COUNT(*) AS n
         FROM "${TRANSPARENCIA}" WHERE "DARRERAACTUALITZACIO" IS NOT NULL
         GROUP BY "CODIINE", "DARRERAACTUALITZACIO" HAVING COUNT(*) >= ${DIA_MASSIU}`,
      );
      for (const fila of comptes) {
        const municipalityId = resolve(fila.CODIINE);
        if (!municipalityId || !fila.dia) continue;
        const set = massiusPerEns.get(municipalityId) ?? new Set<string>();
        set.add(String(fila.dia).slice(0, 10));
        massiusPerEns.set(municipalityId, set);
      }
      run.say(`${massiusPerEns.size} ajuntaments amb algun dia de segell massiu al portal sencer`);
    }

    const perItem = new Map<number, Map<string, ItemRow>>();
    const nomToItem = new Map(ITEMS_TRANSPARENCIA.map((it) => [it.nomItem, it]));
    for (const row of files) {
      const municipalityId = resolve(row.CODIINE);
      const item = nomToItem.get(String(row.NOMITEM ?? ""));
      if (!municipalityId || !item) continue;
      let bucket = perItem.get(municipalityId);
      if (!bucket) perItem.set(municipalityId, (bucket = new Map()));
      if (esMillorFila(row, bucket.get(item.key))) bucket.set(item.key, row);
    }

    // Cobertura catalana de cada ítem: quants ajuntaments el publiquen. Aquesta
    // xifra és, tota sola, la notícia —«només 262 dels 936 ajuntaments publiquen
    // els acords dels seus òrgans de govern»— i va dins de cada fitxa perquè
    // pugui dir «com 674 ajuntaments més, aquí tampoc no es publica».
    const cobertura = new Map<string, { published: number; of: number }>();
    for (const item of ITEMS_TRANSPARENCIA) {
      let published = 0;
      let of = 0;
      for (const bucket of perItem.values()) {
        const row = bucket.get(item.key);
        if (!row) continue;
        of += 1;
        if (num(row.VISIBLE) === 1) published += 1;
      }
      cobertura.set(item.key, { published, of });
      run.say(`${item.label}: ${published} de ${of} ajuntaments`);
    }

    // ---- percentil dins del grup de comparació -------------------------
    // Mai la mediana de tot Catalunya: un poble de dos-cents habitants amb un
    // secretari a mitja jornada i Barcelona no juguen al mateix camp.
    const peers = buildPeerGroups(all.map((m) => ({ id: m.id, population: m.population })));
    const pctsPerGrup = new Map<string, number[]>();
    for (const [municipalityId, dades] of perMunicipi) {
      const peer = peers.get(municipalityId);
      if (!peer || dades.pct === null) continue;
      const list = pctsPerGrup.get(peer.key);
      if (list) list.push(dades.pct);
      else pctsPerGrup.set(peer.key, [dades.pct]);
    }

    let ambDetall = 0;
    for (const [municipalityId, dades] of perMunicipi) {
      const bucket = perItem.get(municipalityId) ?? new Map<string, ItemRow>();

      // Del portal sencer, i amb el recompte dels dotze ítems com a xarxa per
      // si la consulta global no ha pogut resoldre aquest ens.
      const massius = massiusPerEns.get(municipalityId) ?? diesMassius(bucket.values());

      const detail: EstatItem[] = ITEMS_TRANSPARENCIA.map((item) => {
        const row = bucket.get(item.key);
        const catalunya = cobertura.get(item.key)!;
        if (!row) {
          // El portal no té l'ítem per a aquest ens: no és el mateix que no
          // publicar-lo, i per això `published` va a fals però la data és nul·la.
          return { key: item.key, label: item.label, published: false, auto: false, notApplicable: false, updatedOn: null, updatedYear: null, updatedFrom: null, bulk: false, catalunya };
        }
        const { updatedOn, updatedFrom } = dataMesRecent(row);
        return {
          key: item.key,
          label: item.label,
          published: num(row.VISIBLE) === 1,
          auto: num(row.DADESAUTOMATIQUES) === 1,
          notApplicable: num(row.NOAPLICA) === 1,
          updatedOn,
          updatedYear: updatedOn === null ? null : Number(updatedOn.slice(0, 4)),
          updatedFrom,
          bulk: updatedOn !== null && massius.has(updatedOn),
          catalunya,
        };
      });

      const peer = peers.get(municipalityId);
      const pcts = peer ? pctsPerGrup.get(peer.key) ?? [] : [];
      const revisions = [...bucket.values()].map((r) => diaDe(r.DATAREVISIO)).filter((d): d is string => d !== null).sort();

      await save(db, municipalityId, "transparency", {
        items: dades.items,
        published: dades.published,
        pct: dades.pct,
        peer:
          peer && dades.pct !== null
            ? { key: peer.key, label: peer.label, size: peer.size, percentile: percentileOf(dades.pct, pcts) }
            : null,
        detail,
        // El resum que la fitxa mirarà primer: dels dotze ítems que compten,
        // quants en publica i quins li falten.
        chosen: {
          items: detail.length,
          published: detail.filter((d) => d.published).length,
          missing: detail.filter((d) => !d.published).map((d) => d.key),
        },
        source: {
          name: "Portal de transparència, Consorci AOC",
          dataset: TRANSPARENCIA,
          // Quan el Consorci va revisar el portal d'aquest ens. És la data que
          // dona any a tota la mètrica; les dates de cada ítem són una altra cosa.
          checkedOn: revisions.length > 0 ? revisions[revisions.length - 1]! : null,
        },
      });
      if (bucket.size > 0) ambDetall += 1;
      run.rowsOut += 1;
    }

    run.say(`${run.rowsOut} municipis amb índex de transparència, ${ambDetall} amb el detall dels ${ITEMS_TRANSPARENCIA.length} ítems`);
    // Els que falten no tenen portal en aquest conjunt; la fitxa ha de poder
    // dir «no en tenim dades» i no «no publica res».
    run.say(`${all.length - run.rowsOut} municipis sense portal al conjunt del Consorci`);
    return { municipis: run.rowsOut, ambDetall, items: ITEMS_TRANSPARENCIA.length };
  });
}
