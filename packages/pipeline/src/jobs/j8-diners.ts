import { municipalFinances, municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { ckanSql } from "../adapters/aoc";
import { socrataAll } from "../adapters/socrata";
import { buildPeerGroups, medianOf } from "../derive/peers";
import { normalize } from "../lib/text";
import { withRun } from "../lib/run";

/**
 * J8 — d'on surten els diners, on van, i què costa cada servei.
 *
 * És la part de la fitxa que la gent entén sense que ningú l'hi expliqui: quant
 * es paga d'IBI per habitant aquí i quant al poble del costat, quina part del
 * pressupost va a serveis bàsics, i què costa recollir les escombraries.
 *
 * Tres fonts, totes amb la mateixa definició per a tothom:
 *   · Liquidacions de la Generalitat (`ytva-5kp3`), que ja porten l'euro per
 *     habitant calculat i desglossen la recaptació figura per figura.
 *   · Cost efectiu dels serveis del Ministeri d'Hisenda via l'AOC, que és
 *     l'únic lloc on «què costa la recollida de residus» vol dir el mateix a
 *     tot arreu.
 *
 * Cap xifra es publica sola: al costat hi va sempre la mediana catalana, perquè
 * un import per habitant sense comparació no informa de res.
 */

const LIQUIDACIONS = "ytva-5kp3";
const COST_EFECTIU = "12c13cdd-03ca-48d3-92cb-f3e586e1135a";

/** Figures tributàries que la gent reconeix quan les veu. */
export const FIGURES: Record<string, string> = {
  "impost sobre bens immobles": "IBI",
  "impost sobre vehicles de traccio mecanica": "Vehicles",
  "impt s increment valor terrenys naturalesa urbana": "Plusvàlua",
  // El punt volat de «instal·lacions» el normalitzem a espai, així que la clau
  // ha de dur-hi l'espai: amb «installacions» no lligava mai i l'impost d'obres
  // no s'havia recollit a cap dels 947 municipis, tot i estar documentat a
  // l'esquema de descàrrega. És l'impost que grava les llicències d'obra, i en
  // un poble que construeix pot ser una part gens petita del que ingressa.
  "impost sobre construccions instal lacions i obres": "Obres",
  "impost sobre activitats economiques": "Activitats econòmiques",
  taxes: "Taxes",
  "preus publics": "Preus públics",
};

/** Grans blocs de despesa de la classificació per programes. */
export const AREES: Record<string, string> = {
  "serveis publics basics": "Serveis públics bàsics",
  "actuacions de proteccio i promocio social": "Protecció i promoció social",
  "produccio de bens publics de caracter preferent": "Educació, cultura i esport",
  "actuacions de caracter economic": "Actuacions econòmiques",
  "actuacions de caracter general": "Administració general",
  "deute public": "Deute públic",
};

/** Serveis del cost efectiu, en català i només els que s'entenen sols. */
/**
 * Serveis del cost efectiu, en català.
 *
 * Parany verificat el 29-08-2026: el conjunt té **dues files per a residus i
 * dues per a parcs**, i les que semblen les bones pel nom són les petites.
 * «Medio ambiente urbano: Gestión de los residuos sólidos urbanos» suma 57 M€ a
 * tot Catalunya; «Recogida de residuos», 549 M€. A Abrera la primera val 6.095 €
 * i la segona 637.818 €, i la de parcs val zero, o sigui que la fitxa arribava a
 * publicar que Abrera no té parcs ni jardins. Es fan servir les grans.
 */
export const SERVEIS: Record<string, string> = {
  "recogida de residuos": "Recollida d'escombraries",
  "tratamiento de residuos": "Tractament de residus",
  "parque publico": "Parcs i jardins",
  "limpieza viaria": "Neteja viària",
  "alumbrado publico": "Enllumenat públic",
  "abastecimiento domiciliario de agua potable": "Aigua potable",
  alcantarillado: "Clavegueram",
  "instalaciones deportivas de uso publico": "Instal·lacions esportives",
  "biblioteca publica": "Biblioteca",
  cementerio: "Cementiri",
  "evaluacion e informacion de situaciones de necesidad social y la atencion inmediata a personas en situacion o riesgo de exclusion social": "Atenció social",
};

type SocrataRow = {
  any: string; codi_ens: string; nom_document: string;
  desc_estructura: string; import: string; euros_habitant: string;
};
type CkanRow = Record<string, string | number | null>;

const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Mediana d'una llista de valors positius. */
function median(values: number[]): number | null {
  const clean = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (clean.length === 0) return null;
  return Math.round(clean[Math.floor(clean.length / 2)]! * 100) / 100;
}

/**
 * El datastore de l'AOC retalla les respostes a 32.000 files i no ho diu
 * enlloc: torna un `success: true` amb la meitat de la sèrie. Per això el cost
 * efectiu es demana any per any (17.000 files llargues cadascun) i es
 * comprova el sostre a cada tanda.
 */
const CKAN_MAX_ROWS = 32_000;

/** Primer exercici del mandat que s'està jutjant, i el del que el precedeix. */
const TERM_START_YEAR = 2023;
const PREVIOUS_TERM_START_YEAR = 2019;
const CURRENT_TERM = "2023-2027";

/**
 * Com es presta cada servei, i des de quan.
 *
 * `TIPUS_GESTIO` porta quinze etiquetes diferents, però la decisió que es vota
 * al ple només en té quatre formes: ho fem nosaltres, ho paguem a una empresa,
 * ho fa la comarca o la mancomunitat, o no es presta. Les quinze etiquetes es
 * redueixen a aquestes quatre perquè passar de «gestión directa por la entidad
 * local» a «gestión directa por sociedad mercantil local» és una
 * reclassificació comptable i no un canvi de política: si no s'agrupessin, el
 * soroll administratiu del formulari del Ministeri es publicaria com si fos
 * una remunicipalització.
 */
export type ManagementModel = "directa" | "indirecta" | "supramunicipal" | "noPrestat" | "altres";

/** Com es diu cada model a la fitxa; l'origen ve en castellà. */
export const MODEL_LABELS: Record<ManagementModel, string> = {
  directa: "gestió directa",
  indirecta: "contractat a una empresa",
  supramunicipal: "mancomunat, comarcal o consorciat",
  noPrestat: "no es presta",
  altres: "altres formes",
};

/** Redueix l'etiqueta del Ministeri al model de gestió que s'hi amaga. */
export function managementModel(raw: string): ManagementModel {
  const key = normalize(raw);
  if (key.includes("no se presta")) return "noPrestat";
  if (key.startsWith("gestion directa")) return "directa";
  if (key.startsWith("gestion indirecta")) return "indirecta";
  if (key.includes("mancomunada") || key.includes("consorciada") || key.includes("convenio de colaboracion"))
    return "supramunicipal";
  // «Otro tipo de gestión (**)» no diu res de qui presta el servei: es desa,
  // però no serveix ni per obrir ni per tancar un canvi.
  return "altres";
}

/** Mandat municipal al qual pertany un exercici. */
export function termOf(year: number): string {
  if (year >= TERM_START_YEAR) return CURRENT_TERM;
  if (year >= PREVIOUS_TERM_START_YEAR) return "2019-2023";
  return "2015-2019";
}

export type ManagementYear = { year: number; model: ManagementModel };
export type ManagementChange = {
  year: number;
  term: string;
  from: ManagementModel;
  to: ManagementModel;
  fromLabel: string;
  toLabel: string;
  /** Exercicis seguits en què s'ha vist el model nou; dos és el mínim per afirmar-ho. */
  heldYears: number;
  confirmed: boolean;
};
type ServiceChange = ManagementChange & { label: string };
type CostTrend = {
  fromYear: number; fromPerHead: number; toYear: number; toPerHead: number; changePct: number;
};

/**
 * Els canvis de model d'un servei al llarg de la sèrie.
 *
 * La regla contra els falsos positius, que aquí surten cars: un model nou no
 * és un canvi fins que s'ha declarat dos exercicis seguits. Cada any canvia
 * d'etiqueta el 5-6 % de les files de tot Catalunya i la majoria tornen al seu
 * lloc l'any següent, o sigui que un any solt enmig de la sèrie es descarta
 * abans de comparar res —si no, un sol any de A a B es publicaria com dos
 * canvis de govern en comptes de com cap. L'excepció és el tram final: un
 * model nou que només s'ha vist l'últim any encara no es pot confirmar, però
 * tampoc negar, i surt amb `confirmed: false` perquè qui l'ensenyi decideixi.
 */
export function detectManagementChanges(
  history: ManagementYear[],
  options: { compare?: ManagementModel[] } = {},
): ManagementChange[] {
  const compare = options.compare ?? ["directa", "indirecta", "supramunicipal"];
  const usable = [...history].sort((a, b) => a.year - b.year).filter((entry) => compare.includes(entry.model));

  type Streak = { model: ManagementModel; from: number; years: number };
  const streaks: Streak[] = [];
  for (const entry of usable) {
    const last = streaks[streaks.length - 1];
    if (last && last.model === entry.model) last.years += 1;
    else streaks.push({ model: entry.model, from: entry.year, years: 1 });
  }

  // Fora els trams interiors d'un sol exercici, i ajunta el que quedi tocant.
  const solid: Streak[] = [];
  streaks.forEach((streak, index) => {
    if (index > 0 && index < streaks.length - 1 && streak.years < 2) return;
    const last = solid[solid.length - 1];
    if (last && last.model === streak.model) last.years += streak.years;
    else solid.push({ ...streak });
  });

  const changes: ManagementChange[] = [];
  for (let i = 1; i < solid.length; i += 1) {
    const before = solid[i - 1]!;
    const after = solid[i]!;
    changes.push({
      year: after.from,
      term: termOf(after.from),
      from: before.model,
      to: after.model,
      fromLabel: MODEL_LABELS[before.model],
      toLabel: MODEL_LABELS[after.model],
      heldYears: after.years,
      confirmed: after.years >= 2,
    });
  }
  return changes;
}

const roundOrNull = (value: number | null): number | null =>
  value === null ? null : Math.round(value * 10) / 10;

export async function j8Diners(db: Db): Promise<void> {
  const byCodiEns = new Map<string, number>();
  const population = new Map<number, number>();
  for (const m of await db.select().from(municipalities)) {
    byCodiEns.set(m.codiEns, m.id);
    if (m.population) population.set(m.id, m.population);
  }
  const resolve = (codi: unknown): number | undefined => byCodiEns.get(String(codi).padStart(10, "0"));

  const save = async (municipalityId: number, kind: string, data: unknown): Promise<void> => {
    await db
      .insert(municipalityMetrics)
      .values({ municipalityId, kind, data })
      .onConflictDoUpdate({
        target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
        set: { data, computedAt: new Date() },
      });
  };

  await withRun(db, "J8 d'on surten i on van els diners", async (run) => {
    // Últim any amb liquidació completa.
    const years = await socrataAll<{ any: string; n: string }>(LIQUIDACIONS, {
      select: "any,count(*) AS n",
      group: "any",
      order: "any DESC",
    });
    const year = years.map((r) => r.any).sort().reverse()[0]!;
    run.say(`liquidacions del ${year}`);

    const rows = await socrataAll<SocrataRow>(LIQUIDACIONS, {
      filters: { any: year },
      select: "codi_ens,nom_document,desc_estructura,import,euros_habitant",
      order: "codi_ens",
    });
    run.rowsIn = rows.length;

    type Entry = { label: string; perHead: number; total: number };
    const revenue = new Map<number, Entry[]>();
    const spending = new Map<number, Entry[]>();

    for (const row of rows) {
      const municipalityId = resolve(row.codi_ens);
      if (!municipalityId) continue;
      const key = normalize(row.desc_estructura ?? "");
      const entry: Entry = { label: "", perHead: num(row.euros_habitant), total: num(row.import) };

      if (row.nom_document === "PRINCIPALS INGRESSOS TRIBUTARIS" && FIGURES[key]) {
        entry.label = FIGURES[key]!;
        const list = revenue.get(municipalityId) ?? [];
        list.push(entry);
        revenue.set(municipalityId, list);
      } else if (row.nom_document === "CLASSIFICACIÓ PER PROGRAMES" && AREES[key]) {
        entry.label = AREES[key]!;
        const list = spending.get(municipalityId) ?? [];
        list.push(entry);
        spending.set(municipalityId, list);
      }
    }

    const mediansFor = (
      source: Map<number, Entry[]>,
      labels: string[],
      quins?: ReadonlySet<number>,
    ): Record<string, number | null> =>
      Object.fromEntries(
        labels.map((label) => [
          label,
          median(
            [...source.entries()]
              .filter(([id]) => quins === undefined || quins.has(id))
              .map(([, list]) => list.find((e) => e.label === label)?.perHead ?? 0),
          ),
        ]),
      );

    const revenueMedians = mediansFor(revenue, Object.values(FIGURES));
    const spendingMedians = mediansFor(spending, Object.values(AREES));

    /**
     * Comparar els diners amb la mediana de tot Catalunya mesura la població i
     * no la gestió: els pobles de menys de 100 habitants gasten 4.964 €/habitant
     * de mediana i les ciutats de més de 50.000, 1.472 €. Amb la vara catalana,
     * el 96% dels pobles petits surten «per sobre» i el 4% de les ciutats grans
     * també —facin el que facin els seus governs—, i la frase no informa de res.
     * Per això cada xifra es compara també amb els municipis de la seva mida.
     */
    const grups = buildPeerGroups(
      [...population.entries()].map(([id, pop]) => ({ id, population: pop })),
    );
    const membres = new Map<string, Set<number>>();
    for (const [id, grup] of grups) {
      const conjunt = membres.get(grup.key) ?? new Set<number>();
      conjunt.add(id);
      membres.set(grup.key, conjunt);
    }
    const perGrup = (
      source: Map<number, Entry[]>,
      labels: string[],
    ): Map<string, Record<string, number | null>> => {
      const sortida = new Map<string, Record<string, number | null>>();
      for (const [clau, conjunt] of membres) sortida.set(clau, mediansFor(source, labels, conjunt));
      return sortida;
    };
    const revenueGroupMedians = perGrup(revenue, Object.values(FIGURES));
    const spendingGroupMedians = perGrup(spending, Object.values(AREES));

    /** Quants del grup tenen liquidació: sense això el percentil no es pot llegir. */
    const ambDada = (font: Map<number, Entry[]>, clau: string): number =>
      [...(membres.get(clau) ?? [])].filter((id) => font.has(id)).length;

    /**
     * Quina part del que gasta l'ajuntament la paguen els impostos i taxes
     * d'aquí. És la comparació més política de totes: com més baixa, més depèn
     * el pressupost del poble de decisions que no es prenen al seu ple. Va del
     * 15% de mediana als municipis de menys de 100 habitants al 56% als de
     * 10.001 a 20.000, i per això només es pot comparar dins del grup.
     *
     * El que no cobreixen els impostos propis no ve necessàriament de
     * transferències: pot ser deute, venda de patrimoni o altres ingressos. Es
     * diu «no surt d'impostos d'aquí», mai «ve de la Generalitat».
     */
    const propis = new Map<number, number>();
    for (const [id, list] of revenue) propis.set(id, list.reduce((a, e) => a + e.perHead, 0));
    const autofinancament = new Map<number, number>();
    for (const [id, list] of spending) {
      const gasta = list.reduce((a, e) => a + e.perHead, 0);
      const cobra = propis.get(id);
      if (cobra === undefined || gasta <= 0) continue;
      autofinancament.set(id, Math.round((1000 * cobra) / gasta) / 10);
    }
    const medianaDelGrup = (valors: Map<number, number>, clau: string | null): number | null =>
      clau === null
        ? null
        : roundOrNull(
            medianOf(
              [...(membres.get(clau) ?? [])]
                .map((id) => valors.get(id))
                .filter((v): v is number => v !== undefined),
            ),
          );
    const propisCatalunya = roundOrNull(medianOf([...propis.values()]));

    for (const [municipalityId, list] of revenue) {
      const grup = grups.get(municipalityId) ?? null;
      await save(municipalityId, "revenue", {
        year: Number(year),
        figures: list.filter((e) => e.perHead > 0).sort((a, b) => b.perHead - a.perHead),
        medians: revenueMedians,
        grup: grup
          ? { etiqueta: grup.label, mida: grup.size, ambDada: ambDada(revenue, grup.key) }
          : null,
        medianesGrup: grup ? revenueGroupMedians.get(grup.key) ?? null : null,
        propis: {
          perHabitant: Math.round(propis.get(municipalityId) ?? 0),
          // Aquesta sí que es pot comparar amb tot Catalunya: el que recapta un
          // ajuntament per habitant amb els seus propis impostos amb prou feines
          // depèn de la mida del municipi, a diferència de la despesa.
          medianaCatalunya: propisCatalunya,
          municipisAmbDada: propis.size,
        },
      });
    }
    for (const [municipalityId, list] of spending) {
      const total = list.reduce((a, e) => a + e.perHead, 0);
      const grup = grups.get(municipalityId) ?? null;
      const totalsDelGrup = [...(membres.get(grup?.key ?? "") ?? [])]
        .map((id) => spending.get(id))
        .filter((l): l is Entry[] => l !== undefined)
        .map((l) => l.reduce((a, e) => a + e.perHead, 0));
      await save(municipalityId, "spending", {
        year: Number(year),
        areas: list
          .filter((e) => e.perHead > 0)
          .map((e) => ({ ...e, share: total === 0 ? 0 : Math.round((1000 * e.perHead) / total) / 10 }))
          .sort((a, b) => b.perHead - a.perHead),
        totalPerHead: Math.round(total),
        medians: spendingMedians,
        grup: grup
          ? { etiqueta: grup.label, mida: grup.size, ambDada: ambDada(spending, grup.key) }
          : null,
        medianesGrup: grup ? spendingGroupMedians.get(grup.key) ?? null : null,
        // La mediana del total del grup: és la que permet dir quants euros de
        // pressupost separen aquest municipi dels de la seva mida.
        totalMediaGrup: roundOrNull(medianOf(totalsDelGrup)),
        poblacio: population.get(municipalityId) ?? null,
        autofinancament:
          autofinancament.get(municipalityId) === undefined
            ? null
            : {
                pct: autofinancament.get(municipalityId)!,
                medianaGrup: medianaDelGrup(autofinancament, grup?.key ?? null),
              },
      });
    }
    run.rowsOut = revenue.size + spending.size;
    run.say(`${revenue.size} municipis amb recaptació per figura · ${spending.size} amb despesa per àrea`);
    return { any: year, ingressos: revenue.size, despeses: spending.size };
  });

  await withRun(db, "J8 cost efectiu dels serveis", async (run) => {
    const yearRows = await ckanSql<{ any: string }>(
      `SELECT DISTINCT "ANY" AS any FROM "${COST_EFECTIU}" ORDER BY "ANY"`,
    );
    const years = yearRows.map((r) => num(r.any)).filter((y) => y > 0).sort((a, b) => a - b);
    const latest = years[years.length - 1]!;
    run.say(`sèrie del ${years[0]} al ${latest}`);

    // Padró de cada exercici: el cost per habitant del 2018 s'ha de dividir per
    // la gent que hi vivia el 2018, no per la d'ara, o un poble que ha crescut
    // sembla que ha abaratit el servei sense haver-hi tocat res. El padró surt
    // de `municipal_finances`, que omple J6: si J6 encara no ha passat, es cau
    // al padró vigent i queda dit a la incidència, perquè si no la sèrie
    // barrejaria dues bases sense que ho sabés ningú.
    const popOfYear = new Map<number, Map<number, number>>();
    for (const row of await db
      .select({ municipalityId: municipalFinances.municipalityId, year: municipalFinances.year, population: municipalFinances.population })
      .from(municipalFinances)) {
      if (!row.population) continue;
      const forYear = popOfYear.get(row.year) ?? new Map<number, number>();
      forYear.set(row.municipalityId, row.population);
      popOfYear.set(row.year, forYear);
    }
    const peopleIn = (municipalityId: number, year: number): number =>
      popOfYear.get(year)?.get(municipalityId) ?? population.get(municipalityId) ?? 0;
    for (const year of years) {
      if (popOfYear.has(year)) continue;
      await run.issue({
        kind: "padró de l'exercici desconegut",
        severity: "baixa",
        detail: { any: year, efecte: "el cost per habitant d'aquest any es calcula amb el padró vigent" },
      });
    }

    type Observation = {
      year: number; model: ManagementModel; management: string; cost: number; perHead: number; population: number;
    };
    /** municipi → servei → un registre per exercici. */
    const observed = new Map<number, Map<string, Observation[]>>();

    for (const year of years) {
      const rows = await ckanSql<CkanRow>(
        `SELECT "CODI_ENS", "DESCRIPCIO_SERVEI", "TIPUS_GESTIO", "COST_EFECTIU"
         FROM "${COST_EFECTIU}" WHERE "ANY" = ${year}`,
      );
      run.rowsIn += rows.length;
      // El datastore de l'AOC talla a 32.000 files sense dir-ho: si un any hi
      // arriba, la sèrie d'aquell any és incompleta i no ens en podem fiar.
      if (rows.length >= CKAN_MAX_ROWS) {
        await run.issue({
          kind: "cost efectiu truncat",
          severity: "alta",
          detail: { any: year, files: rows.length },
        });
      }
      for (const row of rows) {
        const municipalityId = resolve(row.CODI_ENS);
        if (!municipalityId) continue;
        const label = SERVEIS[normalize(String(row.DESCRIPCIO_SERVEI ?? ""))];
        if (!label) continue;
        const management = String(row.TIPUS_GESTIO ?? "");
        const cost = num(row.COST_EFECTIU);
        const people = peopleIn(municipalityId, year);
        // Guarda contra els errors de qui declara. Callús, un poble de 2.180
        // habitants, hi declarava 9.810 milions d'euros en atenció social, i la
        // fitxa ho publicava com a «4.500.455 € per habitant». Cap servei
        // municipal no costa mil euros per habitant: quan hi surt, és un error
        // de la font, i el que toca és apartar-lo i deixar-ne constància, no
        // publicar-lo perquè ho digui el conjunt oficial.
        if (people > 0 && cost / people > 1_000) {
          await run.issue({
            kind: "cost_efectiu_implausible",
            severity: "alta",
            municipalityId,
            entity: label,
            detail: { any: year, cost, habitants: people, perHabitant: Math.round(cost / people) },
          });
          continue;
        }
        const byService = observed.get(municipalityId) ?? new Map<string, Observation[]>();
        const list = byService.get(label) ?? [];
        list.push({
          year,
          model: managementModel(management),
          management,
          cost,
          perHead: people === 0 || cost <= 0 ? 0 : Math.round((100 * cost) / people) / 100,
          population: people,
        });
        byService.set(label, list);
        observed.set(municipalityId, byService);
      }
    }

    type Service = { label: string; perHead: number; total: number; management: string };
    /** L'últim any, tal com la fitxa ja el publica: població actual i cost > 0. */
    const byMunicipality = new Map<number, Service[]>();
    for (const [municipalityId, byService] of observed) {
      const people = population.get(municipalityId) ?? 0;
      const list: Service[] = [];
      for (const [label, entries] of byService) {
        const last = entries.find((e) => e.year === latest);
        if (!last || last.cost <= 0) continue;
        list.push({
          label,
          total: Math.round(last.cost),
          perHead: people === 0 ? 0 : Math.round((100 * last.cost) / people) / 100,
          management: last.management,
        });
      }
      if (list.length > 0) byMunicipality.set(municipalityId, list);
    }

    const medians = Object.fromEntries(
      Object.values(SERVEIS).map((label) => [
        label,
        median([...byMunicipality.values()].map((list) => list.find((s) => s.label === label)?.perHead ?? 0)),
      ]),
    );

    // Encariment del mandat, servei per servei, per poder dir si el d'aquí ha
    // pujat més o menys que la resta.
    const trendsByService = new Map<string, number[]>();
    const trendOf = (entries: Observation[]): CostTrend | null => {
      const inTerm = entries.filter((e) => e.year >= TERM_START_YEAR && e.perHead > 0).sort((a, b) => a.year - b.year);
      const first = inTerm[0];
      const last = inTerm[inTerm.length - 1];
      if (!first || !last || first.year === last.year) return null;
      return {
        fromYear: first.year,
        fromPerHead: first.perHead,
        toYear: last.year,
        toPerHead: last.perHead,
        changePct: Math.round((1000 * (last.perHead - first.perHead)) / first.perHead) / 10,
      };
    };

    type HistoryYear = { year: number; model: ManagementModel; total: number; perHead: number; population: number };
    type Saved = {
      history: { label: string; years: HistoryYear[] }[];
      managementChanges: ServiceChange[];
      provisionChanges: ServiceChange[];
      costTrend: (CostTrend & { label: string })[];
    };
    const extras = new Map<number, Saved>();

    for (const [municipalityId, byService] of observed) {
      const saved: Saved = { history: [], managementChanges: [], provisionChanges: [], costTrend: [] };
      for (const [label, entries] of byService) {
        const sorted = [...entries].sort((a, b) => a.year - b.year);
        // A la sèrie hi va el model, no l'etiqueta literal del Ministeri: la
        // traducció de cada model és una sola vegada, a `modelLabels`.
        saved.history.push({
          label,
          years: sorted.map((e) => ({
            year: e.year, model: e.model, total: Math.round(e.cost), perHead: e.perHead, population: e.population,
          })),
        });

        const changes = detectManagementChanges(sorted);
        for (const change of changes) {
          if (change.year < PREVIOUS_TERM_START_YEAR) continue;
          saved.managementChanges.push({ ...change, label });
        }
        // Altes i baixes declarades del servei: es guarden a part perquè són
        // molt més febles que un canvi de model. «No se presta» tant vol dir
        // que el poble no té el servei com que aquell any no el va declarar.
        for (const change of detectManagementChanges(sorted, {
          compare: ["directa", "indirecta", "supramunicipal", "noPrestat"],
        })) {
          if (change.year < PREVIOUS_TERM_START_YEAR) continue;
          if (change.from !== "noPrestat" && change.to !== "noPrestat") continue;
          saved.provisionChanges.push({ ...change, label });
        }

        const trend = trendOf(sorted);
        if (trend) {
          saved.costTrend.push({ label, ...trend });
          const list = trendsByService.get(label) ?? [];
          list.push(trend.changePct);
          trendsByService.set(label, list);
        }
      }
      saved.history.sort((a, b) => a.label.localeCompare(b.label, "ca"));
      saved.managementChanges.sort((a, b) => b.year - a.year);
      saved.provisionChanges.sort((a, b) => b.year - a.year);
      extras.set(municipalityId, saved);
    }

    const trendMedians = Object.fromEntries(
      Object.values(SERVEIS).map((label) => [label, roundOrNull(medianOf(trendsByService.get(label) ?? []))]),
    );

    let confirmats = 0;
    let municipisAmbCanvi = 0;
    for (const [municipalityId, list] of byMunicipality) {
      const extra = extras.get(municipalityId);
      const changes = extra?.managementChanges ?? [];
      const nowChanged = changes.filter((c) => c.confirmed && c.term === CURRENT_TERM);
      confirmats += nowChanged.length;
      if (nowChanged.length > 0) municipisAmbCanvi += 1;
      await save(municipalityId, "services", {
        year: latest,
        services: list.sort((a, b) => b.perHead - a.perHead),
        medians,
        // A partir d'aquí, el que és nou.
        years: [...new Set((extra?.history ?? []).flatMap((h) => h.years.map((y) => y.year)))].sort((a, b) => a - b),
        history: extra?.history ?? [],
        managementChanges: changes,
        provisionChanges: extra?.provisionChanges ?? [],
        costTrend: extra?.costTrend.sort((a, b) => b.changePct - a.changePct) ?? [],
        trendMedians,
        modelLabels: MODEL_LABELS,
        currentTerm: CURRENT_TERM,
        source: {
          name: "Cost efectiu dels serveis, Ministeri d'Hisenda (dades obertes de l'AOC)",
          resource: COST_EFECTIU,
          years: `${years[0]}-${latest}`,
        },
        costBasis:
          "Euros corrents, sense descomptar la inflació. El cost per habitant de cada exercici es divideix pel padró d'aquell any; el de la llista de dalt, pel padró vigent.",
      });
      run.rowsOut += 1;
    }

    run.say(`${run.rowsOut} municipis amb cost efectiu del ${latest}`);
    run.say(`${confirmats} canvis de model confirmats en ${municipisAmbCanvi} municipis durant el mandat ${CURRENT_TERM}`);
    return { municipis: run.rowsOut, any: latest, anys: years, canvisMandat: confirmats, municipisAmbCanvi };
  });
}
