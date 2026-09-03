import { municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { DATASETS, socrataAll } from "../adapters/socrata";
import { withRun } from "../lib/run";

/**
 * J32 — el territori de cada municipi: superfície, altitud i gentilici.
 *
 * Són les tres dades que qualsevol fitxa d'un poble porta a la primera línia
 * i que l'Observatori no tenia: quants quilòmetres quadrats fa, a quina alçada
 * és i com se'n diu de la gent que hi viu. Amb el padró que J1 ja desa se'n
 * treu la quarta, la densitat, que és la que fa comparable un poble de
 * muntanya de 40 km² amb un del Baix Llobregat de 4.
 *
 * La font és la mateixa que J1: el conjunt «Dades generals dels ens locals»
 * de la Generalitat (`6nei-4b44`), que a més del padró i l'alcaldia porta
 * `superficie`, `altura`, `gentilici` i `ubicacio` per als 947. Es llegeix en
 * una feina a part i no dins de J1 perquè J1 escriu a la taula de municipis,
 * que és la columna vertebral de tot, i aquestes dades són context: van a
 * `municipality_metrics` amb `kind = "territori"`, com la resta de mètriques
 * que la fitxa llegeix i que es poden refer sense tocar res més.
 *
 * Tres coses que la font fa i que aquí es respecten:
 *
 *   · **El gentilici només ve en masculí plural** («abrerencs», «vilallerencs»).
 *     No se n'inventa el femení: hi ha massa excepcions («manresans» →
 *     «manresanes», però «barcelonins» → «barcelonines» i «bagencs» →
 *     «bagenques») perquè una regla surti bé als 947. Si un dia una font el
 *     dona, hi ha lloc per a `gentiliciFemeni`.
 *   · **Un buit no és un zero.** Una superfície en blanc, un «-» o un text que
 *     no és un número es desen com a `null`, i la densitat només es calcula
 *     quan hi ha superfície i padró tots dos.
 *   · **L'altitud és la que la Generalitat assigna a l'ens**, que a la
 *     pràctica és la del nucli on hi ha l'ajuntament, no la mitjana ni el cim.
 *     La fitxa ho ha de dir així: «980 m» és l'altitud de la casa de la vila.
 */

/** Una fila del conjunt tal com arriba de la Generalitat: tot són textos. */
export type FilaTerritori = {
  codi_ens: string;
  superficie?: string | null;
  altura?: string | null;
  gentilici?: string | null;
  /** «Interior», «Litoral» o «Muntanya», la classificació de la Generalitat. */
  ubicacio?: string | null;
  data_actualitzacio?: string | null;
};

/** El padró que J1 ha desat per al municipi: en fa falta per a la densitat. */
export type PadroMunicipi = { habitants: number; any: number | null };

/** Una xifra amb la unitat al costat, perquè cap consumidor no l'hagi d'endevinar. */
export type XifraTerritori = { valor: number; unitat: string };

/** El que es desa a `municipality_metrics` amb `kind = "territori"`. */
export type TerritoriMetric = {
  /** km², amb dos decimals com els publica la font. `null` quan la font no en porta. */
  superficie: XifraTerritori | null;
  /** Metres sobre el nivell del mar del nucli on hi ha l'ajuntament. */
  altitud: XifraTerritori | null;
  /** Habitants per km²: padró de J1 entre la superfície. Porta l'any del padró. */
  densitat: (XifraTerritori & { anyPadro: number | null }) | null;
  /** El gentilici tal com el publica la Generalitat, en masculí plural. */
  gentilici: string | null;
  /** Reservat per a una font que en doni el femení; avui sempre `null`. */
  gentiliciFemeni: string | null;
  ubicacio: string | null;
  source: {
    name: string;
    dataset: string;
    url: string;
    /** El dia que s'ha llegit el conjunt, ISO. */
    consultat: string;
    /** La data d'actualització de la fila, tal com la dona la font (ISO o `null`). */
    actualitzat: string | null;
    llicencia: string;
  };
};

export const FONT_TERRITORI = {
  name: "Dades generals dels ens locals, Generalitat de Catalunya",
  dataset: DATASETS.ensLocals,
  url: `https://analisi.transparenciacatalunya.cat/d/${DATASETS.ensLocals}`,
  llicencia: "Condicions d'ús del portal de Dades Obertes de Catalunya: reutilització amb atribució i sense alterar el sentit",
} as const;

/**
 * Un número tal com ve de Socrata, o `null`. La font escriu «19.98» amb punt,
 * però un buit, un «-» o un «n/d» hi han arribat alguna vegada des de fulls de
 * càlcul, i cap d'ells no és un zero. Els negatius tampoc: no hi ha
 * superfícies negatives ni cap municipi català sota el nivell del mar.
 */
export function xifra(valor: unknown, unitat: string): XifraTerritori | null {
  if (valor === null || valor === undefined) return null;
  const text = String(valor).trim().replace(",", ".");
  if (text === "" || !/^\d+(\.\d+)?$/.test(text)) return null;
  const n = Number(text);
  return Number.isFinite(n) ? { valor: n, unitat } : null;
}

/** Un text de la font, net; buit o «-» és que no n'hi ha. */
export function textNet(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const text = String(valor).trim();
  return text === "" || text === "-" ? null : text;
}

/** Només el dia de la data d'actualització («2026-07-18T00:00:00.000» → «2026-07-18»). */
const diaDe = (valor: unknown): string | null => {
  const text = textNet(valor);
  if (!text) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(text);
  return m ? m[1]! : text;
};

/**
 * La mètrica d'un municipi a partir de la seva fila i del padró que tenim.
 * És pura a posta: és el que es prova, i és tot el criteri de la feina.
 */
export function territoriDeFila(fila: FilaTerritori, padro: PadroMunicipi | null, consultat: string): TerritoriMetric {
  const superficie = xifra(fila.superficie, "km²");
  const altitud = xifra(fila.altura, "m");
  // Una superfície de zero no divideix res: també és «no ho sabem».
  const densitat =
    superficie && superficie.valor > 0 && padro && padro.habitants > 0
      ? { valor: Math.round((padro.habitants / superficie.valor) * 10) / 10, unitat: "hab./km²", anyPadro: padro.any }
      : null;
  return {
    superficie,
    altitud,
    densitat,
    gentilici: textNet(fila.gentilici),
    gentiliciFemeni: null,
    ubicacio: textNet(fila.ubicacio),
    source: { ...FONT_TERRITORI, consultat, actualitzat: diaDe(fila.data_actualitzacio) },
  };
}

export async function j32Territori(db: Db): Promise<void> {
  await withRun(db, "J32 territori: superfície, altitud i gentilici", async (run) => {
    const files = await socrataAll<FilaTerritori>(DATASETS.ensLocals, {
      where: "nomtipus='Municipis'",
      select: "codi_ens,superficie,altura,gentilici,ubicacio,data_actualitzacio",
      order: "codi_ens",
    });
    run.rowsIn = files.length;
    run.say(`${files.length} municipis al conjunt de la Generalitat`);

    const perCodi = new Map(files.map((f) => [String(f.codi_ens).padStart(10, "0"), f]));
    const consultat = new Date().toISOString().slice(0, 10);

    const all = await db
      .select({
        id: municipalities.id,
        codiEns: municipalities.codiEns,
        name: municipalities.name,
        population: municipalities.population,
        populationYear: municipalities.populationYear,
      })
      .from(municipalities);

    let senseFila = 0;
    let senseSuperficie = 0;
    let senseAltitud = 0;
    let senseGentilici = 0;
    for (const m of all) {
      const fila = perCodi.get(m.codiEns);
      if (!fila) {
        // El municipi és a la nostra taula i no al conjunt: no s'hi desa res,
        // que és com la fitxa sabrà que no en té. Passa si la font canvia de
        // codis o si un municipi és nou.
        senseFila += 1;
        await run.issue({ kind: "territori_sense_fila", severity: "baixa", municipalityId: m.id, entity: m.name, detail: { codiEns: m.codiEns } });
        continue;
      }
      const padro = m.population === null ? null : { habitants: m.population, any: m.populationYear };
      const data = territoriDeFila(fila, padro, consultat);
      if (!data.superficie) senseSuperficie += 1;
      if (!data.altitud) senseAltitud += 1;
      if (!data.gentilici) senseGentilici += 1;

      await db
        .insert(municipalityMetrics)
        .values({ municipalityId: m.id, kind: "territori", data })
        .onConflictDoUpdate({
          target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
          set: { data, computedAt: new Date() },
        });
      run.rowsOut += 1;
    }

    run.say(
      `${run.rowsOut} municipis amb territori · sense superfície ${senseSuperficie}, sense altitud ${senseAltitud}, sense gentilici ${senseGentilici}${
        senseFila > 0 ? ` · ${senseFila} sense fila al conjunt` : ""
      }`,
    );
    return { municipis: run.rowsOut, senseFila, senseSuperficie, senseAltitud, senseGentilici, consultat };
  });
}
