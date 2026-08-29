import { municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { socrataAll } from "../adapters/socrata";
import { buildPeerGroups, medianOf, percentileOf, type PeerGroup } from "../derive/peers";
import { withRun } from "../lib/run";

/**
 * J9 — el lloguer i les escombraries, que són les dues coses que la gent nota.
 *
 * Totes dues entren perquè responen la pregunta del projecte —«què han fet
 * aquests quatre anys al meu poble?»— d'una manera que la resta d'indicadors no:
 *
 *   · El **preu del lloguer** no el fixa l'ajuntament, però el que hi passa
 *     durant un mandat és el primer tema de conversa municipal, i posat al
 *     costat del que l'ajuntament hi gasta és la comparació més eloqüent que
 *     podem fer. Es publica sempre com a variació de mandat, mai com a xifra
 *     solta, precisament perquè no atribuïm el preu a ningú: el que es compara
 *     és el ritme d'aquest mandat amb el de l'anterior.
 *   · La **taxa de recollida selectiva** sí que és un resultat directe d'una
 *     decisió de govern —posar porta a porta o no, contenidors intel·ligents o
 *     no— i es pot seguir any a any dins del mandat.
 *
 * Cap de les dues xifres es desa sense el percentil dins del grup de comparació:
 * un lloguer de 700 € vol dir coses molt diferents en un poble de 800 habitants
 * i a l'àrea metropolitana, i un 35 % de selectiva també.
 */

/** Preu mitjà del lloguer de l'Agència de l'Habitatge, per municipi i trimestre. */
const LLOGUER = "qww9-bvhh";
/** Estadística de residus municipals de l'Agència de Residus de Catalunya. */
const RESIDUS = "69zu-w48s";

/** Des d'aquí la sèrie cobreix tres mandats sencers: 2015, 2019 i 2023. */
const SERIE_DES_DE = 2015;

/**
 * Anys de constitució dels ajuntaments. Els ajuntaments es constitueixen al juny,
 * o sigui que l'any electoral és mig d'un mandat i mig de l'altre; el prenem com
 * a punt de partida perquè és l'últim any tancat que no ha decidit qui governa
 * avui, i perquè és el criteri que fa servir tot l'Observatori.
 */
const MANDAT = 2023;
const MANDAT_ANTERIOR = 2019;

/** La fila que el conjunt del lloguer publica com a resum de l'any. */
const PERIODE_ANUAL = "gener-desembre";

/**
 * Els quatre trimestres que **no** se solapen. El parany d'aquest conjunt és que
 * també publica «gener-juny» i «gener-setembre», que són acumulats: qui sumi
 * tots els períodes d'un any compta els mateixos contractes fins a tres vegades.
 * Comprovat amb Abrera 2023: els quatre trimestres sumen 207 contractes, que és
 * exactament el que diu la fila anual, i la mitjana ponderada pel nombre de
 * contractes dona 675,58 €, que és exactament la renda de la fila anual. O sigui
 * que l'origen ja fa la ponderació que ens caldria fer, i la fem servir.
 */
const TRIMESTRES: ReadonlySet<string> = new Set([
  "gener-març",
  "abril-juny",
  "juliol-setembre",
  "octubre-desembre",
]);

/**
 * Fraccions de la recollida selectiva que una persona reconeix quan les veu. La
 * resta del conjunt (piles, medicaments, olis, ferralla…) són quantitats
 * testimonials que només afegirien soroll al gràfic; van totes a «Altres».
 */
const FRACCIONS: ReadonlyArray<readonly [string, string]> = [
  ["mat_ria_org_nica", "Matèria orgànica"],
  ["poda_i_jardineria", "Poda i jardineria"],
  ["paper_i_cartr", "Paper i cartró"],
  ["vidre", "Vidre"],
  ["envasos_lleugers", "Envasos lleugers"],
  ["residus_voluminosos_fusta", "Voluminosos i fusta"],
  ["raee", "Aparells elèctrics"],
  ["runes", "Runes"],
  ["t_xtil", "Tèxtil"],
];

/**
 * El conjunt de residus porta una fila «No territorialitzable» amb el codi tot
 * zeros: són els residus que l'Agència no sap assignar a cap municipi. Té un
 * 100 % de selectiva i falsejaria el màxim de qualsevol rànquing.
 */
const SENSE_TERRITORI = "000000";

// ─── Càlculs purs ────────────────────────────────────────────────────────────

export type PuntSerie = { any: number; valor: number | null };

export type Variacio = {
  desDe: number;
  fins: number;
  inici: number;
  final: number;
  /** Diferència absoluta: euros al lloguer, punts percentuals a la taxa. */
  diferencia: number;
  /** Variació relativa en %, o `null` quan el punt de partida és zero. */
  percentual: number | null;
  /**
   * Anys que cobreix la variació.
   *
   * El mandat en curs sovint només té un exercici i l'anterior en té quatre.
   * Posar «+2 punts» al costat de «+9 punts» com si fossin xifres del mateix
   * tipus fa que el mandat actual sembli sempre més tranquil pel sol fet de ser
   * més curt. **`diferencia` i `percentual` no es poden comparar entre mandats
   * de durada diferent: per a això hi ha les xifres anuals.**
   */
  anys: number;
  diferenciaAnual: number;
  percentualAnual: number | null;
};

export function arrodoneix(valor: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(valor * factor) / factor;
}

/**
 * Taxa de recollida selectiva en percentatge. Torna `null` i no zero quan no hi
 * ha generació: un municipi sense dada i un municipi que no recicla res no són
 * la mateixa cosa, i publicar-los igual seria mentir.
 */
export function taxaSelectiva(selectiva: number | null, generacio: number | null): number | null {
  if (selectiva === null || generacio === null || generacio <= 0) return null;
  return arrodoneix((100 * selectiva) / generacio, 2);
}

/**
 * Mitjana ponderada pel pes de cada tram. Serveix per reconstruir el preu anual
 * a partir dels trimestres quan la fila anual no hi és: la mitjana simple dels
 * quatre trimestres donaria el mateix pes a un trimestre de 5 contractes que a
 * un de 200.
 */
export function mitjanaPonderada(items: readonly { valor: number | null; pes: number }[]): number | null {
  let suma = 0;
  let pesos = 0;
  for (const item of items) {
    if (item.valor === null || item.pes <= 0) continue;
    suma += item.valor * item.pes;
    pesos += item.pes;
  }
  return pesos === 0 ? null : arrodoneix(suma / pesos, 2);
}

/**
 * Variació d'una sèrie entre dos anys. Torna `null` si a qualsevol dels dos
 * extrems no hi ha dada: dir «ha pujat un 12 %» comparant el 2023 amb el 2021
 * perquè el 2019 faltava seria inventar-se el mandat anterior.
 */
export function variacioEntre(serie: readonly PuntSerie[], desDe: number, fins: number): Variacio | null {
  if (fins <= desDe) return null;
  const inici = serie.find((p) => p.any === desDe)?.valor ?? null;
  const final = serie.find((p) => p.any === fins)?.valor ?? null;
  if (inici === null || final === null) return null;
  const anys = fins - desDe;
  const diferencia = arrodoneix(final - inici, 2);
  const percentual = inici === 0 ? null : arrodoneix((100 * (final - inici)) / inici, 1);
  return {
    desDe,
    fins,
    inici,
    final,
    diferencia,
    percentual,
    /**
     * Anys que cobreix la variació, i el ritme anual.
     *
     * Sense això, la fitxa posava el mandat actual —que sovint només té un any
     * liquidat— al costat de l'anterior, que en té quatre, com si les dues
     * xifres volguessin dir el mateix. El mandat en curs sortia sempre més
     * tranquil pel simple fet de ser més curt. **`diferencia` i `percentual` no
     * es poden comparar entre mandats de durada diferent: per a això hi ha
     * `diferenciaAnual` i `percentualAnual`.**
     */
    anys,
    diferenciaAnual: arrodoneix(diferencia / anys, 2),
    percentualAnual: percentual === null ? null : arrodoneix(percentual / anys, 1),
  };
}

// ─── Comparació dins del grup ────────────────────────────────────────────────

export type Comparacio = {
  grup: { clau: string; etiqueta: string; mida: number; ambDada: number };
  percentil: number;
  mediana: number;
};

/**
 * Percentil i mediana de cada municipi dins del seu grup de comparació, comptant
 * només els que tenen dada. `ambDada` va al costat del percentil perquè un
 * percentil calculat sobre 14 municipis d'un grup de 300 s'ha de poder llegir
 * amb la desconfiança que mereix.
 */
function comparaDinsDelGrup(
  valors: ReadonlyMap<number, number>,
  grups: ReadonlyMap<number, PeerGroup>,
): Map<number, Comparacio> {
  const perGrup = new Map<string, number[]>();
  for (const [id, valor] of valors) {
    const grup = grups.get(id);
    if (!grup) continue;
    const llista = perGrup.get(grup.key);
    if (llista) llista.push(valor);
    else perGrup.set(grup.key, [valor]);
  }

  const resultat = new Map<number, Comparacio>();
  for (const [id, valor] of valors) {
    const grup = grups.get(id);
    if (!grup) continue;
    const llista = perGrup.get(grup.key)!;
    const percentil = percentileOf(valor, llista);
    const mediana = medianOf(llista);
    if (percentil === null || mediana === null) continue;
    resultat.set(id, {
      grup: { clau: grup.key, etiqueta: grup.label, mida: grup.size, ambDada: llista.length },
      percentil,
      mediana: arrodoneix(mediana, 2),
    });
  }
  return resultat;
}

// ─── Ingesta ─────────────────────────────────────────────────────────────────

type FilaLloguer = {
  codi_territorial: string;
  nom_territori?: string;
  any: string;
  periode: string;
  habitatges?: string;
  renda?: string;
};

type FilaResidus = Record<string, string | undefined> & {
  codi_municipi: string;
  any: string;
};

const nombre = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export async function j9HabitatgeResidus(db: Db): Promise<void> {
  const tots = await db.select().from(municipalities);
  const perIne5 = new Map<string, number>();
  const perIdescat6 = new Map<string, number>();
  for (const m of tots) {
    perIne5.set(m.ine5, m.id);
    if (m.idescat6) perIdescat6.set(m.idescat6, m.id);
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

  await withRun(db, "J9 preu del lloguer", async (run) => {
    const files = await socrataAll<FilaLloguer>(LLOGUER, {
      select: "codi_territorial,nom_territori,any,periode,habitatges,renda",
      where: `ambit_territorial='Municipi' AND any >= '${SERIE_DES_DE}'`,
      order: "codi_territorial,any,periode",
    });
    run.rowsIn = files.length;

    // Un acumulat per municipi i any: la fila anual si hi és, i els trimestres
    // que no se solapen per si no hi és.
    type Acumulat = {
      anual: { renda: number | null; contractes: number } | null;
      trimestres: { valor: number | null; pes: number }[];
    };
    const acumulats = new Map<number, Map<number, Acumulat>>();
    // Nom inclòs: una incidència amb només un codi no la pot triar ningú a mà.
    const orfes = new Map<string, string>();

    for (const fila of files) {
      const municipalityId = perIne5.get(fila.codi_territorial);
      if (!municipalityId) {
        orfes.set(fila.codi_territorial, fila.nom_territori ?? "");
        continue;
      }
      const any = Number(fila.any);
      if (!Number.isFinite(any)) continue;
      const perAny = acumulats.get(municipalityId) ?? new Map<number, Acumulat>();
      const acumulat = perAny.get(any) ?? { anual: null, trimestres: [] };
      const renda = nombre(fila.renda);
      const contractes = nombre(fila.habitatges) ?? 0;

      if (fila.periode === PERIODE_ANUAL) acumulat.anual = { renda, contractes };
      else if (TRIMESTRES.has(fila.periode)) acumulat.trimestres.push({ valor: renda, pes: contractes });

      perAny.set(any, acumulat);
      acumulats.set(municipalityId, perAny);
    }

    for (const [codi, nom] of orfes) {
      await run.issue({
        kind: "lloguer: codi sense municipi",
        severity: "baixa",
        entity: codi,
        detail: { dataset: LLOGUER, codi_territorial: codi, nom_territori: nom },
      });
    }

    /**
     * Un any només compta com a tancat si l'origen n'ha publicat la fila anual o
     * els quatre trimestres. Sense aquesta condició, el trimestre de gener-març
     * de l'any en curs entraria com si fos l'any sencer i la variació de mandat
     * compararia un any amb un trimestre.
     */
    const series = new Map<number, { any: number; preu: number | null; contractes: number }[]>();
    for (const [municipalityId, perAny] of acumulats) {
      const serie: { any: number; preu: number | null; contractes: number }[] = [];
      for (const [any, acumulat] of [...perAny].sort(([a], [b]) => a - b)) {
        const tancat = acumulat.anual !== null || acumulat.trimestres.length === 4;
        if (!tancat) continue;
        serie.push({
          any,
          preu: acumulat.anual?.renda ?? mitjanaPonderada(acumulat.trimestres),
          contractes:
            acumulat.anual?.contractes ?? acumulat.trimestres.reduce((suma, t) => suma + t.pes, 0),
        });
      }
      if (serie.length > 0) series.set(municipalityId, serie);
    }

    const darrerAny = Math.max(
      ...[...series.values()].map((serie) => serie[serie.length - 1]!.any),
    );

    // El percentil es calcula amb el preu de l'últim any tancat, que és l'única
    // xifra que tots els municipis amb dada tenen en comú.
    const preusDarrerAny = new Map<number, number>();
    for (const [municipalityId, serie] of series) {
      const preu = serie.find((p) => p.any === darrerAny)?.preu;
      if (preu !== null && preu !== undefined) preusDarrerAny.set(municipalityId, preu);
    }
    const comparacions = comparaDinsDelGrup(preusDarrerAny, grups);

    let ambMandat = 0;
    for (const [municipalityId, serie] of series) {
      const punts: PuntSerie[] = serie.map((p) => ({ any: p.any, valor: p.preu }));
      const mandat = variacioEntre(punts, MANDAT, darrerAny);
      if (mandat) ambMandat += 1;
      await desa(municipalityId, "habitatge", {
        font: {
          dataset: LLOGUER,
          nom: "Preu mitjà del lloguer",
          organisme: "Agència de l'Habitatge de Catalunya",
          portal: "analisi.transparenciacatalunya.cat",
        },
        darrerAny,
        serie: serie.map((p) => ({ any: p.any, preu: p.preu, contractes: p.contractes })),
        preu: preusDarrerAny.get(municipalityId) ?? null,
        contractes: serie.find((p) => p.any === darrerAny)?.contractes ?? null,
        mandat,
        mandatAnterior: variacioEntre(punts, MANDAT_ANTERIOR, MANDAT),
        comparacio: comparacions.get(municipalityId) ?? null,
      });
      run.rowsOut += 1;
    }

    // Els municipis sense cap contracte declarat no són un error nostre, però
    // han de sortir a l'índex de cobertura de la fitxa.
    const sense = tots.filter((m) => !series.has(m.id));
    for (const m of sense) {
      await run.issue({
        kind: "lloguer: sense dades",
        severity: "baixa",
        municipalityId: m.id,
        detail: { dataset: LLOGUER, municipi: m.name },
      });
    }

    run.say(`últim any tancat: ${darrerAny}`);
    run.say(`${series.size} municipis amb sèrie · ${preusDarrerAny.size} amb preu el ${darrerAny}`);
    run.say(`${ambMandat} amb variació de mandat ${MANDAT}-${darrerAny} · ${sense.length} sense cap dada`);
    return { darrerAny, municipis: series.size, ambPreu: preusDarrerAny.size, ambMandat };
  });

  await withRun(db, "J9 residus municipals", async (run) => {
    const columnes = [
      "codi_municipi",
      "municipi",
      "any",
      "total_recollida_selectiva",
      "generaci_residus_municipal",
      "kg_hab_any",
      "kg_hab_any_recollida_selectiva",
      ...FRACCIONS.map(([camp]) => camp),
    ];
    const files = await socrataAll<FilaResidus>(RESIDUS, {
      select: columnes.join(","),
      where: `any >= '${SERIE_DES_DE}'`,
      order: "codi_municipi,any",
    });
    run.rowsIn = files.length;

    type Punt = {
      any: number;
      taxa: number | null;
      kgHabAny: number | null;
      kgHabAnySelectiva: number | null;
      selectiva: number | null;
      generacio: number | null;
      fraccions: { etiqueta: string; tones: number }[];
    };
    const series = new Map<number, Punt[]>();
    const orfes = new Map<string, string>();

    for (const fila of files) {
      /**
       * L'origen publica el codi Idescat com a número, i això li menja el zero
       * inicial: Abrera hi surt com a 80018 i Barcelona com a 80193. Tots els
       * municipis de la província de Barcelona hi passen, o sigui que sense
       * reomplir-lo a sis xifres se'n perdrien 311 de cop.
       */
      const codi = String(fila.codi_municipi).padStart(6, "0");
      if (codi === SENSE_TERRITORI) continue;
      const municipalityId = perIdescat6.get(codi);
      if (!municipalityId) {
        orfes.set(codi, fila.municipi ?? "");
        continue;
      }
      const any = Number(fila.any);
      if (!Number.isFinite(any)) continue;

      const selectiva = nombre(fila.total_recollida_selectiva);
      const generacio = nombre(fila.generaci_residus_municipal);
      const punts = series.get(municipalityId) ?? [];
      punts.push({
        any,
        taxa: taxaSelectiva(selectiva, generacio),
        kgHabAny: nombre(fila.kg_hab_any),
        kgHabAnySelectiva: nombre(fila.kg_hab_any_recollida_selectiva),
        selectiva,
        generacio,
        fraccions: FRACCIONS.map(([camp, etiqueta]) => ({ etiqueta, tones: nombre(fila[camp]) ?? 0 })),
      });
      series.set(municipalityId, punts);
    }

    for (const [codi, nom] of orfes) {
      await run.issue({
        kind: "residus: codi sense municipi",
        severity: "baixa",
        entity: codi,
        detail: { dataset: RESIDUS, codi_municipi: codi, municipi: nom },
      });
    }

    for (const punts of series.values()) punts.sort((a, b) => a.any - b.any);
    const darrerAny = Math.max(...[...series.values()].map((punts) => punts[punts.length - 1]!.any));

    const taxesDarrerAny = new Map<number, number>();
    for (const [municipalityId, punts] of series) {
      const taxa = punts.find((p) => p.any === darrerAny)?.taxa;
      if (taxa !== null && taxa !== undefined) taxesDarrerAny.set(municipalityId, taxa);
    }
    const comparacions = comparaDinsDelGrup(taxesDarrerAny, grups);

    let ambMandat = 0;
    for (const [municipalityId, punts] of series) {
      const serie: PuntSerie[] = punts.map((p) => ({ any: p.any, valor: p.taxa }));
      const mandat = variacioEntre(serie, MANDAT, darrerAny);
      if (mandat) ambMandat += 1;
      const ultim = punts.find((p) => p.any === darrerAny) ?? null;

      // La suma de les fraccions amb nom no arriba mai al total de selectiva:
      // hi falten les recollides petites. La diferència es publica com a
      // «Altres» perquè el gràfic sumi el que diu que suma.
      const ambNom = (ultim?.fraccions ?? []).filter((f) => f.tones > 0);
      const restant = (ultim?.selectiva ?? 0) - ambNom.reduce((suma, f) => suma + f.tones, 0);
      const fraccions = [...ambNom];
      if (restant > 0) fraccions.push({ etiqueta: "Altres", tones: arrodoneix(restant, 2) });
      const totalFraccions = fraccions.reduce((suma, f) => suma + f.tones, 0);

      await desa(municipalityId, "residus", {
        font: {
          dataset: RESIDUS,
          nom: "Estadística de residus municipals",
          organisme: "Agència de Residus de Catalunya",
          portal: "analisi.transparenciacatalunya.cat",
        },
        darrerAny,
        serie: punts.map((p) => ({
          any: p.any,
          taxaSelectiva: p.taxa,
          kgHabAny: p.kgHabAny,
          kgHabAnySelectiva: p.kgHabAnySelectiva,
        })),
        taxaSelectiva: ultim?.taxa ?? null,
        kgHabAny: ultim?.kgHabAny ?? null,
        tonesGenerades: ultim?.generacio ?? null,
        fraccions: fraccions
          .map((f) => ({
            ...f,
            part: totalFraccions === 0 ? 0 : arrodoneix((100 * f.tones) / totalFraccions, 1),
          }))
          .sort((a, b) => b.tones - a.tones),
        mandat,
        mandatAnterior: variacioEntre(serie, MANDAT_ANTERIOR, MANDAT),
        comparacio: comparacions.get(municipalityId) ?? null,
      });
      run.rowsOut += 1;
    }

    const sense = tots.filter((m) => !series.has(m.id));
    for (const m of sense) {
      await run.issue({
        kind: "residus: sense dades",
        severity: "mitjana",
        municipalityId: m.id,
        detail: { dataset: RESIDUS, municipi: m.name, idescat6: m.idescat6 },
      });
    }

    run.say(`últim any: ${darrerAny}`);
    run.say(`${series.size} municipis amb sèrie · ${taxesDarrerAny.size} amb taxa el ${darrerAny}`);
    run.say(`${ambMandat} amb variació de mandat ${MANDAT}-${darrerAny} · ${sense.length} sense cap dada`);
    return { darrerAny, municipis: series.size, ambTaxa: taxesDarrerAny.size, ambMandat };
  });
}
