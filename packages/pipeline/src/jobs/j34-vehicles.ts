import { and, eq, notInArray } from "drizzle-orm";
import { municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import {
  emexMassiu,
  PALMEROLA,
  type EmexMassiu,
  type EnllacMunicipi,
} from "../adapters/idescat";
import { buildPeerGroups, medianOf, percentileOf, type PeerGroup } from "../derive/peers";
import { arrodoneix, type PuntSerie } from "./j9-habitatge-residus";
import { habitantsPerAny, type PoblacioAny } from "./j29-criminalitat";
import { withRun } from "../lib/run";

/**
 * J34 — el parc de vehicles: quants vehicles hi ha domiciliats a cada
 * municipi, de quina mena, i quants en toquen per cada 1.000 habitants.
 *
 * ─── LA FONT, I PER QUÈ AQUESTA ─────────────────────────────────────────────
 *
 * **Idescat, «Parc de vehicles» (taula `t18` d'El municipi en xifres), a
 * partir de la DGT.** La DGT és qui té el registre —el parc són els vehicles
 * amb permís de circulació domiciliats al municipi—, i l'Idescat el publica
 * municipi a municipi cada any, en cinc categories: turismes, motocicletes,
 * vehicles industrials, altres i el total. L'API de fitxes municipals (EMEX)
 * té un **mode massiu** que torna un indicador per als 947 municipis en una
 * sola crida: `dades.json?tipus=mun&i=f19,f325,f272,f326,f163`. Comprovat el
 * 3 de setembre del 2026: 947 columnes, cap valor buit, el total és la suma
 * exacta de les quatre parts, any de referència 2024 i data d'actualització
 * del 10 de novembre del 2025. Cinc peticions a la font per ingesta: una de
 * dades i cap de fitxa, perquè l'enllaç per municipi ja el té J18.
 *
 * Les categories, tal com les defineix la metodologia de l'Idescat
 * (idescat.cat/pub/?id=parcc&m=m): **turismes** són els de quatre rodes de
 * fins a nou places; **motocicletes** inclouen motocarros i cotxes de
 * discapacitats i exclouen els velomotors; **vehicles industrials** és com
 * l'EMEX agrupa els camions i furgonetes (transport de mercaderies) amb els
 * tractors industrials —comprovat amb Girona el 2024: 9.537 + 278 = 9.815—;
 * **altres** són els autobusos i la resta, sense els vehicles agrícoles.
 *
 * ─── EL QUE S'HA MIRAT I S'HA DESCARTAT, I PER QUÈ ──────────────────────────
 *
 *   · **La DGT directament.** El portal estadístic de la DGT publica «Parque
 *     de vehículos» per any, però el que hi ha a datos.gob.es
 *     (e00130502-parque-de-vehiculos-tablas-estadisticas-2025) és un Excel de
 *     82 KB per províncies i comunitats, no per municipis; el detall municipal
 *     només surt de l'aplicació de consulta de la seu (sedeapl.dgt.gob.es),
 *     que no és un fitxer estable ni té llicència escrita a la fitxa del
 *     catàleg. L'Idescat ja fa aquesta feina i la publica amb condicions d'ús
 *     que el projecte compleix des de J18.
 *   · **Les taules de l'API `taules/v2` de l'Idescat.** El parc de vehicles
 *     (`parcc`) no hi és: l'API d'aquell servei llista 33 estadístiques i cap
 *     és aquesta (comprovat el 3 de setembre del 2026). Només el té l'EMEX.
 *   · **La sèrie any a any.** La pàgina de cada municipi
 *     (idescat.cat/pub/?id=parcc&n=291&geo=mun:…) porta del 2000 ençà, però
 *     serien 947 pàgines per ingesta i el mode massiu només dona l'últim any.
 *     Es comença amb la foto de l'últim any; la sèrie, si algun dia cal, és
 *     una altra feina.
 *
 * ─── LA LLICÈNCIA ───────────────────────────────────────────────────────────
 *
 * Les condicions d'ús de les API de l'Idescat obliguen a reconèixer l'origen
 * amb els enllaços que dona l'API, sense modificar-los. El mode massiu **no
 * dona cap enllaç per municipi**: el que es desa és el que J18 ja va guardar
 * de cada fitxa a `poblacioEnllacos` (la taula `t18`), verbatim, i si a un
 * municipi li falta, la fitxa enllaça la pàgina general de l'estadística a
 * Idescat.cat, que les condicions també accepten.
 *
 * ─── LES REGLES QUE MANEN AQUÍ ──────────────────────────────────────────────
 *
 * **Les taxes es fan amb el padró de l'any de la dada**, el que J18 desa, o
 * el més proper fins a dos anys; sense cap de prou proper, el padró vigent
 * de la taula de municipis, i queda dit quin s'ha fet servir. **La comparació
 * és amb els de la seva mida**: mediana i percentil de vehicles per 1.000
 * habitants dins del tram de població de la LOREG (`derive/peers.ts`), i
 * sempre amb quants municipis del grup tenen la dada. **Cap veredicte**: tenir
 * més vehicles per habitant no és ni bo ni dolent; depèn de si hi ha tren, de
 * si el poble és dispers, de si hi ha empreses que hi domicilien flotes. I
 * **això no ho decideix l'ajuntament**: el permís de circulació és de la DGT;
 * el ple hi posa l'impost de vehicles, la zona blava i els carrils bici.
 */

export const KIND = "vehicles";
export const TAULA_EMEX = "t18";
export const PAGINA_IDESCAT = "https://www.idescat.cat/pub/?id=parcc";

/** Els cinc indicadors de la taula `t18` de l'EMEX, amb el codi que fa servir l'API. */
export const INDICADORS_EMEX = {
  turismes: "f19",
  motocicletes: "f325",
  industrials: "f272",
  altres: "f326",
  total: "f163",
} as const;

/** Text literal de les condicions d'ús de les API de l'Idescat, com a J18. */
export const LLICENCIA_IDESCAT = {
  organisme: "Institut d'Estadística de Catalunya (Idescat)",
  condicions: "https://www.idescat.cat/dev/api/condicions/",
  literal:
    "Heu de reconèixer l'origen de les dades, ja sigui utilitzant els enllaços que proporcionin les APIs, " +
    "ja sigui enllaçant amb Idescat.cat. […] En presentar-los, no esteu autoritzat a modificar o editar " +
    "les dades, metadades o enllaços proporcionats per les APIs.",
  obliga:
    "Cada xifra s'ha de presentar amb l'enllaç que ha donat l'API, tal com l'ha donat, o enllaçant " +
    "Idescat.cat. No se'n pot construir cap ni modificar-ne cap.",
} as const;

export const NOTA_COMPETENCIES =
  "El permís de circulació el dona la DGT, i que hi hagi més o menys vehicles depèn de si hi ha tren o " +
  "autobús, de si el poble és dispers i de si hi ha empreses que hi domicilien flotes. El que hi posa " +
  "l'ajuntament és l'impost de vehicles, l'aparcament regulat, els carrils bici i la zona de baixes " +
  "emissions si en té.";

export const NOTA_QUE_COMPTA =
  "Compta els vehicles amb permís de circulació domiciliats al municipi a final d'any, no els que hi " +
  "circulen: un poble amb una empresa de lloguer o una flota d'autocars pot tenir més vehicles que veïns. " +
  "Els ciclomotors no hi són.";

// ─────────────────────────────────────────────────────────────────────────────
// Del vector massiu de l'EMEX al parc d'un municipi
// ─────────────────────────────────────────────────────────────────────────────

export type ParcVehicles = {
  total: number;
  turismes: number;
  motocicletes: number;
  /** Camions, furgonetes i tractors industrials; `null` si la font no el porta. */
  industrials: number | null;
  /** Autobusos i la resta; `null` si la font no el porta. */
  altres: number | null;
};

/**
 * El parc d'un municipi a partir de la resposta massiva, o `null` si li falta
 * qualsevol de les tres xifres que la fitxa necessita (total, turismes,
 * motocicletes). Les altres dues poden faltar sense que el municipi caigui.
 */
export function parcDelMunicipi(dades: EmexMassiu, idescat6: string): { any: number; parc: ParcVehicles } | null {
  const valor = (id: string): number | null => {
    const indicador = dades.indicadors.find((i) => i.id === id);
    return indicador?.valors.get(idescat6) ?? null;
  };
  const total = valor(INDICADORS_EMEX.total);
  const turismes = valor(INDICADORS_EMEX.turismes);
  const motocicletes = valor(INDICADORS_EMEX.motocicletes);
  if (total === null || turismes === null || motocicletes === null) return null;
  const any = dades.indicadors.find((i) => i.id === INDICADORS_EMEX.total)?.any ?? null;
  if (any === null) return null;
  return {
    any,
    parc: {
      total,
      turismes,
      motocicletes,
      industrials: valor(INDICADORS_EMEX.industrials),
      altres: valor(INDICADORS_EMEX.altres),
    },
  };
}

/**
 * Comprova que la resposta porta els cinc indicadors, tots de la taula `t18`
 * i tots del mateix any. Si l'Idescat un dia reordena els codis, val més
 * plantar-se que ingerir turismes on tocaven motocicletes.
 */
export function comprovaIndicadors(dades: EmexMassiu): string[] {
  const problemes: string[] = [];
  const anys = new Set<number | null>();
  for (const [clau, id] of Object.entries(INDICADORS_EMEX)) {
    const indicador = dades.indicadors.find((i) => i.id === id);
    if (!indicador) {
      problemes.push(`falta l'indicador ${id} (${clau})`);
      continue;
    }
    if (indicador.taula.id !== TAULA_EMEX) {
      problemes.push(`l'indicador ${id} (${clau}) és de la taula ${indicador.taula.id || "?"} i no de ${TAULA_EMEX}`);
    }
    anys.add(indicador.any);
  }
  if (anys.size > 1) problemes.push(`els indicadors no són tots del mateix any: ${[...anys].join(", ")}`);
  if (anys.has(null)) problemes.push("hi ha un indicador sense any de referència");
  return problemes;
}

// ─────────────────────────────────────────────────────────────────────────────
// Taxes i comparació
// ─────────────────────────────────────────────────────────────────────────────

export type TaxesVehicles = {
  total: number;
  turismes: number;
  motocicletes: number;
  industrials: number | null;
  altres: number | null;
};

/** Vehicles per 1.000 habitants, amb un decimal, o `null` sense padró. */
export function taxesPerMil(parc: ParcVehicles, habitants: number | null): TaxesVehicles | null {
  if (habitants === null || habitants <= 0) return null;
  const perMil = (n: number | null): number | null => (n === null ? null : arrodoneix((1000 * n) / habitants, 1));
  return {
    total: perMil(parc.total)!,
    turismes: perMil(parc.turismes)!,
    motocicletes: perMil(parc.motocicletes)!,
    industrials: perMil(parc.industrials),
    altres: perMil(parc.altres),
  };
}

/** El pes de cada mena dins del parc, en percentatge amb un decimal. */
export function pesDelParc(parc: ParcVehicles): { turismes: number; motocicletes: number } | null {
  if (parc.total <= 0) return null;
  return {
    turismes: arrodoneix((100 * parc.turismes) / parc.total, 1),
    motocicletes: arrodoneix((100 * parc.motocicletes) / parc.total, 1),
  };
}

export type ComparacioVehicles = {
  grup: { clau: string; etiqueta: string; mida: number; ambDada: number };
  /** 0 és el que en té menys per habitant del grup, 100 el que en té més. */
  percentil: number;
  /** Mediana de vehicles per 1.000 habitants dels del grup amb dada. */
  mediana: number;
};

/**
 * Percentil i mediana de cada municipi dins del seu grup de mida, comptant
 * només els que tenen taxa. El municipi no s'exclou del seu propi grup, com a
 * la resta de la fitxa. `ambDada` acompanya sempre el percentil: un percentil
 * sobre quatre municipis s'ha de poder llegir amb la desconfiança que mereix.
 */
export function comparaDinsDelGrup(
  taxes: ReadonlyMap<number, number>,
  grups: ReadonlyMap<number, PeerGroup>,
): Map<number, ComparacioVehicles> {
  const valorsPerGrup = new Map<string, number[]>();
  for (const [id, valor] of taxes) {
    const grup = grups.get(id);
    if (!grup) continue;
    const llista = valorsPerGrup.get(grup.key);
    if (llista) llista.push(valor);
    else valorsPerGrup.set(grup.key, [valor]);
  }
  const resultat = new Map<number, ComparacioVehicles>();
  for (const [id, valor] of taxes) {
    const grup = grups.get(id);
    if (!grup) continue;
    const valors = valorsPerGrup.get(grup.key) ?? [];
    const mediana = medianOf(valors);
    const percentil = percentileOf(valor, valors);
    if (mediana === null || percentil === null) continue;
    resultat.set(id, {
      grup: { clau: grup.key, etiqueta: grup.label, mida: grup.size, ambDada: valors.length },
      percentil,
      mediana: arrodoneix(mediana, 1),
    });
  }
  return resultat;
}

// ─────────────────────────────────────────────────────────────────────────────
// La mètrica
// ─────────────────────────────────────────────────────────────────────────────

export type VehiclesMetric = {
  font: {
    nom: string;
    /** L'atribució literal que dona l'API: «Idescat, a partir de la DGT.». */
    organisme: string;
    /** La pàgina general de l'estadística a Idescat.cat, per quan no hi ha enllaç de municipi. */
    url: string;
    /** L'enllaç d'aquest municipi que va donar l'API a J18, verbatim, o `null`. */
    enllac: EnllacMunicipi | null;
    /** La crida massiva que s'ha fet, tal com s'ha fet. */
    api: string;
    taula: string;
    llicencia: typeof LLICENCIA_IDESCAT;
    consultat: string;
    /** Data d'actualització que declara l'Idescat. */
    actualitzat: string | null;
  };
  any: number;
  parc: ParcVehicles;
  pes: { turismes: number; motocicletes: number } | null;
  /** El padró amb què s'han fet les taxes, o `null` si no n'hi havia cap. */
  poblacio: PoblacioAny | null;
  perMil: TaxesVehicles | null;
  /** Vehicles per 1.000 habitants dins del grup de mida. */
  comparacio: ComparacioVehicles | null;
  context: { decideixLAjuntament: false; nota: string };
  nota: string;
};

type MetricaPoblacioDesada = {
  indicadors?: { clau?: unknown; serie?: { any?: unknown; valor?: unknown }[] }[];
} | null;

/** La sèrie del padró que J18 desa a la mètrica `poblacio`, si hi és. */
function seriePadro(dades: unknown): PuntSerie[] | null {
  const indicadors = (dades as MetricaPoblacioDesada)?.indicadors;
  if (!Array.isArray(indicadors)) return null;
  const padro = indicadors.find((i) => i?.clau === "padroHabitants");
  if (!padro || !Array.isArray(padro.serie)) return null;
  const punts: PuntSerie[] = [];
  for (const punt of padro.serie) {
    if (typeof punt?.any !== "number") continue;
    punts.push({ any: punt.any, valor: typeof punt.valor === "number" ? punt.valor : null });
  }
  return punts;
}

/** L'enllaç de la taula `t18` d'un municipi, del que J18 va desar a `poblacioEnllacos`. */
function enllacVehicles(dades: unknown): EnllacMunicipi | null {
  const enllacos = (dades as { enllacos?: EnllacMunicipi[] } | null)?.enllacos;
  if (!Array.isArray(enllacos)) return null;
  return enllacos.find((e) => e?.taula === TAULA_EMEX && typeof e.href === "string") ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// La feina
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Una crida massiva a l'EMEX, el padró i els enllaços que J18 ja té a la
 * base, i la mètrica `vehicles` de cada municipi amb dada. És idempotent i
 * **esborra** la mètrica dels municipis que ja no tenen dada: una foto vella
 * no s'ha de quedar com si fos d'ara.
 */
export async function j34Vehicles(db: Db): Promise<void> {
  const tots = await db
    .select({
      id: municipalities.id,
      name: municipalities.name,
      idescat6: municipalities.idescat6,
      population: municipalities.population,
    })
    .from(municipalities);

  await withRun(db, "J34 vehicles: parc de vehicles per municipi", async (run) => {
    const consultat = new Date().toISOString().slice(0, 10);

    // ── 1. La crida, i plantar-se si la resposta no és la que esperem ───────
    const { url, dades } = await emexMassiu(Object.values(INDICADORS_EMEX));
    run.rowsIn += dades.municipis.length * dades.indicadors.length;
    const problemes = comprovaIndicadors(dades);
    if (problemes.length > 0) {
      throw new Error(`la resposta massiva de l'EMEX no és la que s'esperava: ${problemes.join("; ")}. No es toca res`);
    }
    const total = dades.indicadors.find((i) => i.id === INDICADORS_EMEX.total)!;
    run.say(`${dades.municipis.length} municipis · any ${total.any} · actualitzat ${total.updated ?? "?"}`);

    // ── 2. El padró i els enllaços que J18 ja té ─────────────────────────────
    const padroPer = new Map<number, PuntSerie[]>();
    const filesPoblacio = await db
      .select({ municipalityId: municipalityMetrics.municipalityId, data: municipalityMetrics.data })
      .from(municipalityMetrics)
      .where(eq(municipalityMetrics.kind, "poblacio"));
    for (const fila of filesPoblacio) {
      const serie = seriePadro(fila.data);
      if (serie) padroPer.set(fila.municipalityId, serie);
    }
    const enllacPer = new Map<number, EnllacMunicipi>();
    const filesEnllacos = await db
      .select({ municipalityId: municipalityMetrics.municipalityId, data: municipalityMetrics.data })
      .from(municipalityMetrics)
      .where(eq(municipalityMetrics.kind, "poblacioEnllacos"));
    for (const fila of filesEnllacos) {
      const enllac = enllacVehicles(fila.data);
      if (enllac) enllacPer.set(fila.municipalityId, enllac);
    }

    // ── 3. La mètrica de cada municipi, sense comparació encara ─────────────
    const candidats: { municipi: (typeof tots)[number]; dades: VehiclesMetric }[] = [];
    let senseEnllac = 0;
    for (const municipi of tots) {
      if (!municipi.idescat6) {
        await run.issue({
          kind: "vehicles: municipi sense codi Idescat",
          severity: "alta",
          municipalityId: municipi.id,
          entity: municipi.name,
        });
        continue;
      }
      const trobat = parcDelMunicipi(dades, municipi.idescat6);
      if (!trobat) {
        // Palmerola surt a la classificació de l'Idescat i no té dades: és
        // un buit conegut, no cap incidència que calgui mirar cada cop.
        await run.issue({
          kind: "vehicles: municipi sense dada a l'EMEX",
          severity: municipi.idescat6 === PALMEROLA ? "baixa" : "mitjana",
          municipalityId: municipi.id,
          entity: municipi.name,
          detail: { idescat6: municipi.idescat6 },
        });
        continue;
      }
      const { any, parc } = trobat;
      const [poblacio] = habitantsPerAny([any], padroPer.get(municipi.id) ?? null, municipi.population);
      const enllac = enllacPer.get(municipi.id) ?? null;
      if (!enllac) senseEnllac += 1;
      candidats.push({
        municipi,
        dades: {
          font: {
            nom: total.taula.nom || "Parc de vehicles",
            organisme: total.font,
            url: PAGINA_IDESCAT,
            enllac,
            api: url,
            taula: TAULA_EMEX,
            llicencia: LLICENCIA_IDESCAT,
            consultat,
            actualitzat: total.updated,
          },
          any,
          parc,
          pes: pesDelParc(parc),
          poblacio: poblacio ?? null,
          perMil: taxesPerMil(parc, poblacio?.habitants ?? null),
          comparacio: null,
          context: { decideixLAjuntament: false, nota: NOTA_COMPETENCIES },
          nota: NOTA_QUE_COMPTA,
        },
      });
    }

    // ── 4. La comparació amb els de la seva mida ─────────────────────────────
    const grups = buildPeerGroups(tots);
    const taxes = new Map<number, number>();
    for (const { municipi, dades: metrica } of candidats) {
      if (metrica.perMil) taxes.set(municipi.id, metrica.perMil.total);
    }
    const comparacions = comparaDinsDelGrup(taxes, grups);
    for (const candidat of candidats) {
      candidat.dades.comparacio = comparacions.get(candidat.municipi.id) ?? null;
    }

    // ── 5. Desar, i esborrar qui ja no té dada ───────────────────────────────
    for (const { municipi, dades: metrica } of candidats) {
      await db
        .insert(municipalityMetrics)
        .values({ municipalityId: municipi.id, kind: KIND, data: metrica })
        .onConflictDoUpdate({
          target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
          set: { data: metrica, computedAt: new Date() },
        });
      run.rowsOut += 1;
    }
    const idsDesats = candidats.map((c) => c.municipi.id);
    await db.delete(municipalityMetrics).where(
      idsDesats.length > 0
        ? and(eq(municipalityMetrics.kind, KIND), notInArray(municipalityMetrics.municipalityId, idsDesats))
        : eq(municipalityMetrics.kind, KIND),
    );

    const sensePadro = candidats.filter((c) => c.dades.perMil === null).length;
    run.say(
      `${run.rowsOut} municipis amb parc · ${taxes.size} amb taxa · ${sensePadro} sense padró · ` +
      `${senseEnllac} sense enllaç de l'Idescat (J18 encara no l'ha desat)`,
    );
    return {
      municipis: run.rowsOut,
      any: total.any,
      actualitzat: total.updated,
      ambTaxa: taxes.size,
      sensePadro,
      senseEnllac,
    };
  });
}
