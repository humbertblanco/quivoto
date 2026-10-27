import { municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { socrataAll } from "../adapters/socrata";
import { fetchJson } from "../lib/http";
import { withRun } from "../lib/run";

/**
 * J46 — el registre de turisme viu: quants pisos turístics (HUT), hotels,
 * càmpings i cases de turisme rural té inscrits cada municipi **avui**.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PER QUÈ UNA FEINA A PART DE J40
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * J40 ja dona els HUT de cada municipi, però de l'Observatori del Territori
 * (`8aaj-ypcb`), que els publica un cop l'any i amb retard: el setembre del
 * 2026 la xifra més nova era la del 2024. Des del Decret llei 3/2023 els
 * pisos turístics són una de les qüestions de la campanya municipal, i el
 * veí vol saber quants n'hi ha ara, no fa dos anys. La resposta és el
 * **Registre de Turisme de Catalunya** (`t2h3-cgys`, Departament d'Empresa i
 * Treball), que el portal refresca cada poques setmanes (l'última, el 5
 * d'octubre del 2026) i que porta una fila per establiment inscrit.
 *
 * La sèrie de J40 no es llença: és la que permet dir com ha anat (2023,
 * 2024), i aquesta és la foto d'avui. La fitxa d'urbanisme les posa juntes.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL QUE AQUESTA FEINA NO FA, A POSTA
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   · **No baixa cap fila crua.** Cada fila del registre porta el nom i els
 *     cognoms del titular, la raó social, el CIF i l'adreça. Res d'això no ens
 *     cal i res d'això no ha de passar per la nostra base de dades: la
 *     consulta és agregada al servidor (`$select=…,count(*)&$group=…`) i només
 *     torna codi de municipi, tipus, estat, places i quants. Vegeu
 *     `consultaRegistre()`.
 *   · **No suma les places dels HUT.** El camp `total_places` només és ple a
 *     uns 25.000 dels 104.502 HUT (el 27-10-2026): els inscrits abans que el
 *     registre el demanés no el porten. Sumar els que en tenen faria semblar
 *     que un poble té una quarta part de les places que té. Es desa la suma
 *     i quants establiments la porten (`ambPlaces`), perquè la pàgina pugui
 *     dir «almenys» o callar, però la fitxa no la publica per als HUT.
 *   · **No converteix l'absència en buit.** El registre és el cens oficial
 *     dels establiments legals: un municipi que no hi surt no té cap
 *     establiment inscrit, i això és un zero de veritat. Es desa la mètrica
 *     per als 947, amb zeros on toca. El que no compta, i la fitxa ho diu, són
 *     els pisos que es lloguen sense inscriure's.
 *
 * La clau del registre és el codi de municipi de l'Idescat, de sis xifres
 * (`codi_municipi_idescat`), que és el mateix `idescat6` de la taula de
 * municipis. El 27-10-2026 tots 922 codis del registre hi lligaven.
 *
 * Els HUT per cada 100 habitants es calculen aquí amb el padró de la taula de
 * municipis (el mateix que fa servir la resta de la fitxa), i se'n desa l'any
 * perquè la pàgina el pugui dir. Per 100 habitatges no es calcula: el projecte
 * no té encara el parc d'habitatges de cada municipi.
 */

export const DATASET_REGISTRE_TURISME = "t2h3-cgys";
export const KIND_ESTABLIMENTS_TURISTICS = "establimentsTuristics";

const LLICENCIA_GENCAT =
  "Condicions d'ús del portal de Dades Obertes de Catalunya: reutilització amb atribució i sense alterar el sentit";

export const FONT_REGISTRE_TURISME = {
  nom: "Establiments d'allotjament turístic inscrits al Registre de Turisme de Catalunya",
  organisme: "Departament d'Empresa i Treball",
  dataset: DATASET_REGISTRE_TURISME,
  url: `https://analisi.transparenciacatalunya.cat/d/${DATASET_REGISTRE_TURISME}`,
  llicencia: LLICENCIA_GENCAT,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// El que es desa
// ─────────────────────────────────────────────────────────────────────────────

/** Els tipus del registre que la fitxa nomena; la resta van a `altres`. */
export type TipusPrincipal = "hut" | "hotels" | "campings" | "turismeRural";
export type TipusAltre = "apartaments" | "llarsCompartides" | "autocaravanes" | "desconegut";

/**
 * Els noms tal com els escriu el registre (comprovats el 27-10-2026: set
 * tipus, tots en estat «Alta»). Un tipus nou va a `desconegut` i surt com a
 * incidència, no es perd.
 */
export const TIPUS_REGISTRE: Readonly<Record<string, TipusPrincipal | TipusAltre>> = {
  "Habitatges d'ús turístic": "hut",
  Hotels: "hotels",
  "Càmpings": "campings",
  "Turisme rural": "turismeRural",
  "Apartaments Turístics": "apartaments",
  "Llars compartides": "llarsCompartides",
  Autocaravanes: "autocaravanes",
};

/**
 * Un recompte: quants establiments i, dels que porten places, quantes en
 * sumen. `places` és la suma només dels `ambPlaces` establiments que les
 * declaren; si `ambPlaces < establiments`, és un mínim i no el total.
 */
export type Comptatge = { establiments: number; places: number; ambPlaces: number };

/** El que es desa a `municipality_metrics` amb `kind = "establimentsTuristics"`. */
export type EstablimentsTuristicsMetric = {
  /** El dia que s'ha consultat el registre, ISO. */
  dataConsulta: string;
  /** El dia que el portal diu que va actualitzar les files, ISO, o `null`. */
  actualitzat: string | null;
  hut: Comptatge;
  hotels: Comptatge;
  campings: Comptatge;
  turismeRural: Comptatge;
  /** Apartaments turístics, llars compartides, àrees d'autocaravanes i tipus nous, plegats. */
  altres: Comptatge;
  altresDetall: Record<TipusAltre, number>;
  /** HUT per cada 100 habitants amb el padró de `poblacio`, a dos decimals; `null` sense padró. */
  hutPer100Hab: number | null;
  /** El padró amb què s'ha fet la ràtio, i de quin any. */
  poblacio: number | null;
  poblacioAny: number | null;
  /** Referència de tot Catalunya, el mateix dia: no és un rànquing. */
  catalunya: { hut: number; municipisAmbHut: number; hutPer100Hab: number | null };
  font: typeof FONT_REGISTRE_TURISME;
};

// ─────────────────────────────────────────────────────────────────────────────
// La consulta i el plegat
// ─────────────────────────────────────────────────────────────────────────────

/** Una fila de la consulta agregada: mai porta cap camp del titular. */
export type FilaRegistreAgregada = {
  codi_municipi_idescat?: string | null;
  tipus_establiment?: string | null;
  total_places?: string | null;
  n?: string | null;
};

/**
 * La consulta agregada. Agrupa també per `total_places` perquè Socrata desa
 * el camp com a text i no el deixa sumar (`sum` torna «type-mismatch»): la
 * suma es fa aquí, a partir de grups de «quants establiments tenen N places».
 * Són unes 11.000 files. Només els establiments en estat «Alta».
 */
export function consultaRegistre(): { select: string; where: string; group: string; order: string } {
  return {
    select: "codi_municipi_idescat,tipus_establiment,total_places,count(*) as n",
    where: "estat='Alta'",
    group: "codi_municipi_idescat,tipus_establiment,total_places",
    order: "codi_municipi_idescat,tipus_establiment,total_places",
  };
}

const buit = (): Comptatge => ({ establiments: 0, places: 0, ambPlaces: 0 });

/** El que es plega per municipi abans de saber-ne el padró. */
export type RecompteMunicipi = {
  hut: Comptatge;
  hotels: Comptatge;
  campings: Comptatge;
  turismeRural: Comptatge;
  altres: Comptatge;
  altresDetall: Record<TipusAltre, number>;
};

export const recompteBuit = (): RecompteMunicipi => ({
  hut: buit(),
  hotels: buit(),
  campings: buit(),
  turismeRural: buit(),
  altres: buit(),
  altresDetall: { apartaments: 0, llarsCompartides: 0, autocaravanes: 0, desconegut: 0 },
});

/** Un enter positiu d'un text de Socrata, o `null`. */
function enterPositiu(valor: unknown): number | null {
  if (valor === null || valor === undefined) return null;
  const text = String(valor).trim();
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * Plega les files agregades en un recompte per codi Idescat. Les places
 * absurdes (més de 10.000 en un sol establiment) no se sumen: compten com a
 * establiment sense places, i surten a `placesFora`.
 */
export function plegaRegistre(files: readonly FilaRegistreAgregada[]): {
  perCodi: Map<string, RecompteMunicipi>;
  tipusDesconeguts: Set<string>;
  senseCodi: number;
  placesFora: number;
} {
  const perCodi = new Map<string, RecompteMunicipi>();
  const tipusDesconeguts = new Set<string>();
  let senseCodi = 0;
  let placesFora = 0;
  for (const fila of files) {
    const n = enterPositiu(fila.n) ?? 0;
    if (n === 0) continue;
    const codi = String(fila.codi_municipi_idescat ?? "").trim();
    if (!/^\d{6}$/.test(codi)) {
      senseCodi += n;
      continue;
    }
    const nomTipus = String(fila.tipus_establiment ?? "").trim();
    const tipus = TIPUS_REGISTRE[nomTipus] ?? "desconegut";
    if (tipus === "desconegut") tipusDesconeguts.add(nomTipus);
    let r = perCodi.get(codi);
    if (!r) perCodi.set(codi, (r = recompteBuit()));
    const principal = tipus === "hut" || tipus === "hotels" || tipus === "campings" || tipus === "turismeRural";
    const c = principal ? r[tipus] : r.altres;
    if (!principal) r.altresDetall[tipus] += n;
    c.establiments += n;
    const places = enterPositiu(fila.total_places);
    if (places !== null && places <= 10_000) {
      c.places += places * n;
      c.ambPlaces += n;
    } else if (places !== null) {
      placesFora += n;
    }
  }
  return { perCodi, tipusDesconeguts, senseCodi, placesFora };
}

/** HUT per cada 100 habitants, a dos decimals. Sense padró, `null`. */
export function perCentHabitants(n: number, poblacio: number | null | undefined): number | null {
  if (typeof poblacio !== "number" || !(poblacio > 0)) return null;
  return Math.round((n / poblacio) * 100 * 100) / 100;
}

/** La mètrica d'un municipi a partir del seu recompte (o d'un de buit) i del padró. */
export function metricaDeMunicipi(
  recompte: RecompteMunicipi | undefined,
  ctx: {
    poblacio: number | null;
    poblacioAny: number | null;
    dataConsulta: string;
    actualitzat: string | null;
    catalunya: EstablimentsTuristicsMetric["catalunya"];
  },
): EstablimentsTuristicsMetric {
  const r = recompte ?? recompteBuit();
  return {
    dataConsulta: ctx.dataConsulta,
    actualitzat: ctx.actualitzat,
    hut: r.hut,
    hotels: r.hotels,
    campings: r.campings,
    turismeRural: r.turismeRural,
    altres: r.altres,
    altresDetall: r.altresDetall,
    hutPer100Hab: perCentHabitants(r.hut.establiments, ctx.poblacio),
    poblacio: ctx.poblacio,
    poblacioAny: ctx.poblacioAny,
    catalunya: ctx.catalunya,
    font: FONT_REGISTRE_TURISME,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// La feina
// ─────────────────────────────────────────────────────────────────────────────

/**
 * La data d'actualització que el portal declara per a un conjunt
 * (`rowsUpdatedAt`, en segons), «AAAA-MM-DD», o `null` si la crida falla: no
 * és motiu per aturar res. J45 també la fa servir.
 */
export async function dataActualitzacioSocrata(dataset: string): Promise<string | null> {
  try {
    const vista = await fetchJson<{ rowsUpdatedAt?: number }>(
      `https://analisi.transparenciacatalunya.cat/api/views/${dataset}.json`,
      { delayMs: 1_000, retries: 2 },
    );
    return typeof vista.rowsUpdatedAt === "number" ? new Date(vista.rowsUpdatedAt * 1000).toISOString().slice(0, 10) : null;
  } catch {
    return null;
  }
}

async function desa(db: Db, municipalityId: number, data: EstablimentsTuristicsMetric): Promise<void> {
  await db
    .insert(municipalityMetrics)
    .values({ municipalityId, kind: KIND_ESTABLIMENTS_TURISTICS, data })
    .onConflictDoUpdate({
      target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
      set: { data, computedAt: new Date() },
    });
}

export async function j46HabitatgesTuristics(db: Db): Promise<void> {
  await withRun(db, "J46 registre de turisme: pisos turístics, hotels, càmpings i turisme rural inscrits avui", async (run) => {
    const dataConsulta = new Date().toISOString().slice(0, 10);
    const files = await socrataAll<FilaRegistreAgregada>(DATASET_REGISTRE_TURISME, consultaRegistre());
    const actualitzat = await dataActualitzacioSocrata(DATASET_REGISTRE_TURISME);
    run.rowsIn = files.length;

    const { perCodi, tipusDesconeguts, senseCodi, placesFora } = plegaRegistre(files);
    for (const tipus of tipusDesconeguts) {
      await run.issue({ kind: "registre_turisme_tipus_desconegut", severity: "mitjana", detail: { tipus, dataset: DATASET_REGISTRE_TURISME } });
    }
    if (senseCodi > 0) {
      await run.issue({ kind: "registre_turisme_sense_codi", severity: "baixa", detail: { establiments: senseCodi } });
    }
    if (placesFora > 0) run.say(`${placesFora} establiments amb un nombre de places absurd: no se sumen`);

    const tots = await db
      .select({ id: municipalities.id, idescat6: municipalities.idescat6, name: municipalities.name, population: municipalities.population, populationYear: municipalities.populationYear })
      .from(municipalities);
    const nostres = new Set(tots.map((m) => m.idescat6).filter((c): c is string => !!c));
    const forans = [...perCodi.keys()].filter((c) => !nostres.has(c));
    for (const codi of forans) {
      await run.issue({ kind: "registre_turisme_codi_sense_municipi", severity: "mitjana", entity: codi, detail: { ...perCodi.get(codi)!.hut } });
    }

    let hutCat = 0;
    let municipisAmbHut = 0;
    for (const [codi, r] of perCodi) {
      if (!nostres.has(codi)) continue;
      hutCat += r.hut.establiments;
      if (r.hut.establiments > 0) municipisAmbHut += 1;
    }
    const poblacioCat = tots.reduce((s, m) => s + (m.population ?? 0), 0);
    const catalunya = { hut: hutCat, municipisAmbHut, hutPer100Hab: perCentHabitants(hutCat, poblacioCat) };

    let ambAlgun = 0;
    for (const m of tots) {
      const r = m.idescat6 ? perCodi.get(m.idescat6) : undefined;
      if (r) ambAlgun += 1;
      await desa(
        db,
        m.id,
        metricaDeMunicipi(r, { poblacio: m.population ?? null, poblacioAny: m.populationYear ?? null, dataConsulta, actualitzat, catalunya }),
      );
      run.rowsOut += 1;
    }
    run.say(
      `${run.rowsOut} municipis desats · ${ambAlgun} amb algun establiment inscrit, ${municipisAmbHut} amb HUT · ` +
        `${hutCat.toLocaleString("ca-ES")} HUT a Catalunya${forans.length ? ` · ${forans.length} codis sense municipi` : ""}`,
    );
    return { municipis: run.rowsOut, ambAlgun, municipisAmbHut, hut: hutCat, actualitzat, dataConsulta };
  });
}
