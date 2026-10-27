import { municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { socrataAll } from "../adapters/socrata";
import { fetchJson, sleep } from "../lib/http";
import { withRun } from "../lib/run";

/**
 * J40 — urbanisme i habitatge: quin pla urbanístic té cada municipi i de quan
 * és, quants pisos turístics hi ha, quina part del sou se'n va a pagar la
 * casa, quants habitatges protegits s'hi fan i si és zona tensa.
 *
 * Són cinc preguntes que el veí es fa i que l'Observatori no responia. Les
 * respostes surten de tres conjunts del portal de Dades Obertes de Catalunya,
 * tots per municipi i tots amb els 947:
 *
 *   · `8aaj-ypcb`, **Indicadors territorials de l'Observatori del Territori**
 *     (domini públic). Una fila per municipi i any (2023 i 2024) amb una
 *     setantena d'indicadors. N'agafem només els que no tenim d'una altra
 *     banda: la figura de planejament general vigent i l'antiguitat
 *     (`_61`, `_62`, `_63`), els habitatges d'ús turístic i les seves places
 *     (`_25`–`_28`), les places turístiques totals (`_23`, `_24`), el cost del
 *     lloguer i de la hipoteca sobre els ingressos (`_13`, `_14`) i els
 *     habitatges acabats (`_10`, `_11`). El preu del lloguer (`_12`) no: ja el
 *     dona J9 a partir de les fiances, que és la font original.
 *   · `v8i4-fa4q`, **habitatges amb protecció oficial iniciats i acabats**, del
 *     2002 ençà, any per any.
 *   · `fftm-v9b6`, **àrees de referència en política d'habitatge**: si el
 *     municipi és zona de mercat residencial tensat (ZMRT 1, ZMRT 2 o cap).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL QUE AQUESTA FEINA NO FA, A POSTA
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   · **No publica cap veredicte.** El conjunt de l'Observatori porta, al costat
 *     de cada percentatge d'habitatge, un camp `*_compliment_llindar` que diu
 *     «Compleix requisit» o «No compleix requisit». És el criteri d'una política
 *     concreta, no una dada, i dit sense context sona a suspens. Es desa el
 *     percentatge cru i prou; aquests camps ni es demanen a l'API.
 *   · **No converteix un buit en zero.** Els textos «NA», «-» o una cel·la buida
 *     són `null`, i la fitxa diu «no consta». El cost del lloguer només hi és
 *     per a uns 550 municipis i el de la hipoteca per a uns 210: als altres la
 *     font no té prou contractes per fer la xifra, i no és que no costi res.
 *     Els zeros del conjunt d'HPO sí que són zeros: la font hi escriu una fila
 *     per a cada municipi i any, amb 0 quan no s'ha iniciat ni acabat res.
 *   · **No inventa la data d'aprovació del pla.** La font dona l'antiguitat en
 *     anys a l'any de la dada (Barcelona, Pla general metropolità: 48 el 2024),
 *     no la data del diari oficial. L'any d'aprovació que es desa és la resta
 *     i per això es diu «cap al 1976», no «el 1976».
 *   · **No llegeix números absurds.** El mateix conjunt té alguna xifra amb el
 *     separador decimal perdut (un 248.566.532 % de variació del lloguer).
 *     Els camps que fem servir es validen pel seu rang: un percentatge fora de
 *     0-100 o una antiguitat de més de 150 anys són `null` i una incidència.
 *
 * La clau de tots tres és el codi INE: de cinc xifres a `v8i4-fa4q` i a
 * `fftm-v9b6`, i de sis (el de l'Idescat, amb el dígit de control) a
 * `8aaj-ypcb`. Les cinc primeres xifres del de sis són l'INE, i la taula de
 * municipis ja té `ine5` per a tots 947, o sigui que el lligam es fa per aquí.
 * El conjunt de l'Observatori porta, a més, una fila sense codi que és el
 * total de Catalunya: se'n desa el cost del lloguer i de la hipoteca com a
 * referència, no com a municipi.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Les fonts
// ─────────────────────────────────────────────────────────────────────────────

export const DATASET_TERRITORI = "8aaj-ypcb";
export const DATASET_HPO = "v8i4-fa4q";
export const DATASET_ZONES = "fftm-v9b6";

/** Una font tal com la cita la fitxa: nom, qui la fa, enllaç, llicència i data. */
export type FontUrbanisme = {
  nom: string;
  organisme: string;
  dataset: string;
  url: string;
  llicencia: string;
  /** El dia que la font diu que va actualitzar les files, ISO, o `null` si no ho diu. */
  actualitzat: string | null;
};

const LLICENCIA_GENCAT =
  "Condicions d'ús del portal de Dades Obertes de Catalunya: reutilització amb atribució i sense alterar el sentit";

export const FONTS_URBANISME = {
  territori: {
    nom: "Indicadors territorials de l'Observatori del Territori",
    organisme: "Departament de Territori, Habitatge i Transició Ecològica",
    dataset: DATASET_TERRITORI,
    url: `https://analisi.transparenciacatalunya.cat/d/${DATASET_TERRITORI}`,
    llicencia: "Domini públic",
  },
  hpo: {
    nom: "Habitatges amb protecció oficial iniciats i acabats",
    organisme: "Departament de Territori, Habitatge i Transició Ecològica",
    dataset: DATASET_HPO,
    url: `https://analisi.transparenciacatalunya.cat/d/${DATASET_HPO}`,
    llicencia: LLICENCIA_GENCAT,
  },
  zones: {
    nom: "Àrees de referència en matèria de política d'habitatge",
    organisme: "Departament de Territori, Habitatge i Transició Ecològica",
    dataset: DATASET_ZONES,
    url: `https://analisi.transparenciacatalunya.cat/d/${DATASET_ZONES}`,
    llicencia: LLICENCIA_GENCAT,
  },
} as const;

/**
 * Des de quan és vigent cada zona tensa. La font ho diu a la descripció de la
 * columna, no a cada fila: ZMRT 1, 140 municipis, publicada al BOE el 15 de
 * març del 2024 i efectiva l'endemà; ZMRT 2, 131 municipis, publicada el 9
 * d'octubre del 2024 i efectiva el 10.
 */
export const VIGENCIA_ZONES = { ZMRT1: "2024-03-16", ZMRT2: "2024-10-10" } as const;

// ─────────────────────────────────────────────────────────────────────────────
// El que es desa
// ─────────────────────────────────────────────────────────────────────────────

export type Planejament = {
  /** L'any de la fila de la font d'on surt (2024, per exemple). */
  any: number;
  /** La figura tal com l'escriu la font: «Pla d'ordenació urbanística municipal». */
  figura: string | null;
  /** La sigla habitual (POUM, NNSS, PGM…), o `null` si no n'hi ha una d'establerta. */
  sigla: string | null;
  /** Anys que tenia el pla vigent l'any de la dada. */
  antiguitat: number | null;
  /** `any - antiguitat`: aproximat, per això la fitxa diu «cap al». */
  anyAprovacioAprox: number | null;
  /** Si el pla està adaptat a la Llei 2/2002 d'urbanisme (camp `_63`). */
  adaptatLlei2002: boolean | null;
};

export type PisosTuristics = {
  any: number;
  /** Habitatges d'ús turístic (HUT) inscrits. */
  huts: number | null;
  /** Places d'aquests HUT. */
  placesHuts: number | null;
  /** HUT per cada 100 habitants, tal com el calcula la font. */
  hutsPer100: number | null;
  /** Places de tots els establiments turístics, HUT inclosos (la font les suma). */
  placesTuristiques: number | null;
  placesTuristiquesPer100: number | null;
};

export type CostHabitatge = {
  any: number;
  /** % dels ingressos de la llar que se'n va en lloguer, tal com el publica la font. */
  lloguerPerc: number | null;
  /** % dels ingressos que se'n va en la quota de la hipoteca. */
  hipotecaPerc: number | null;
  /** Les mateixes dues xifres per al conjunt de Catalunya i el mateix any: referència, no rànquing. */
  catalunya: { lloguerPerc: number | null; hipotecaPerc: number | null } | null;
};

export type HabitatgesAcabats = { any: number; total: number | null; protegits: number | null };

export type AnyProtegits = { any: number; iniciats: number | null; acabats: number | null };

/** Una suma d'HPO entre dos anys, tots dos inclosos. */
export type SumaProtegits = { des: number; fins: number; iniciats: number; acabats: number };

export type HabitatgeProtegit = {
  /** La sèrie sencera, any per any, del més antic al més recent. */
  serie: AnyProtegits[];
  darrer: AnyProtegits;
  /** Des del 2023, l'any de les darreres municipals, fins al darrer publicat. */
  desDe2023: SumaProtegits | null;
  /** Des del primer any de la sèrie fins al darrer. */
  total: SumaProtegits | null;
};

export type ZonaTensa = {
  /** `null` vol dir que el municipi és a la llista i **no** és zona tensa. */
  zona: "ZMRT1" | "ZMRT2" | null;
  vigentDes: string | null;
};

/** El que es desa a `municipality_metrics` amb `kind = "urbanismeHabitatge"`. */
export type UrbanismeHabitatgeMetric = {
  planejament: Planejament | null;
  pisosTuristics: PisosTuristics | null;
  cost: CostHabitatge | null;
  habitatgesAcabats: HabitatgesAcabats | null;
  protegit: HabitatgeProtegit | null;
  /** `null` si el municipi no surt a la llista de zones (no és el mateix que «no és zona tensa»). */
  zonaTensa: ZonaTensa | null;
  fonts: { territori: FontUrbanisme; hpo: FontUrbanisme; zones: FontUrbanisme };
  /** El dia que s'han llegit les fonts, ISO. */
  consultat: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Les files tal com arriben (tot són textos)
// ─────────────────────────────────────────────────────────────────────────────

/** Una fila de `8aaj-ypcb` amb només els camps que demanem. */
export type FilaObservatori = {
  codi_municipi?: string | null;
  any?: string | null;
  _10_hab_acabats_total?: string | null;
  _11_hab_acabats_hpo?: string | null;
  _13_hab_cost_ingressos_perc?: string | null;
  _14_hab_hipoteca_ingressos_perc?: string | null;
  _23_tur_places?: string | null;
  _24_tur_places_100hab?: string | null;
  _25_tur_places_huts?: string | null;
  _27_tur_nombre_huts?: string | null;
  _28_tur_nombre_huts_100hab?: string | null;
  _61_plj_pg_vigent?: string | null;
  _62_plj_pg_anitguitat?: string | null;
  _63_plj_munis_adapt_llei?: string | null;
};

/** Els camps de `8aaj-ypcb` que es demanen: cap `*_compliment_llindar`. */
export const CAMPS_OBSERVATORI = [
  "codi_municipi", "any",
  "_10_hab_acabats_total", "_11_hab_acabats_hpo",
  "_13_hab_cost_ingressos_perc", "_14_hab_hipoteca_ingressos_perc",
  "_23_tur_places", "_24_tur_places_100hab", "_25_tur_places_huts",
  "_27_tur_nombre_huts", "_28_tur_nombre_huts_100hab",
  "_61_plj_pg_vigent", "_62_plj_pg_anitguitat", "_63_plj_munis_adapt_llei",
] as const;

export type FilaHpo = { codi_ine?: string | null; any?: string | null; iniciats_hpo?: string | null; acabats_hpo?: string | null };

export type FilaZona = { codmuni?: string | null; zona_de_mercat_residencial_tensat?: string | null };

// ─────────────────────────────────────────────────────────────────────────────
// Lectura de valors
// ─────────────────────────────────────────────────────────────────────────────

/** Els textos que la font fa servir per dir «no hi ha dada». */
const BUITS = new Set(["", "-", "na", "n/a", "n/d", "nd", "null"]);

/** Un text net, o `null` si és un dels buits de la font. */
export function textNet(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const text = String(valor).trim();
  return BUITS.has(text.toLowerCase()) ? null : text;
}

/**
 * Un número tal com ve de Socrata («28.20589847», «1004»), o `null`. Accepta
 * negatius perquè la funció és general, però cada camp en valida el rang a
 * `dinsRang`.
 */
export function nombreNet(valor: unknown): number | null {
  const text = textNet(valor);
  if (text === null || !/^-?\d+(\.\d+)?$/.test(text)) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/** El número només si és dins del rang que té sentit per al camp. */
export function dinsRang(n: number | null, min: number, max: number): number | null {
  return n !== null && n >= min && n <= max ? n : null;
}

/** Un comptatge: enter i no negatiu. Un decimal en un comptatge és una xifra trencada. */
export function comptatge(valor: unknown): number | null {
  const n = nombreNet(valor);
  return n !== null && n >= 0 && Number.isInteger(n) ? n : null;
}

/** Arrodoneix a un decimal: la font en dona vuit i cap no vol dir res. */
const u1 = (n: number | null): number | null => (n === null ? null : Math.round(n * 10) / 10);
/** Dos decimals per a les ràtios per 100 habitants, que als pobles petits són fraccions. */
const u2 = (n: number | null): number | null => (n === null ? null : Math.round(n * 100) / 100);

/**
 * L'INE de cinc xifres a partir del codi que porti la fila: «17015» tal qual,
 * «170157» (Idescat, amb el dígit de control) en treu les cinc primeres, i
 * «8015» (un zero inicial perdut per un full de càlcul) es completa. Qualsevol
 * altra cosa és `null`: val més perdre una fila que desar-la a un altre poble.
 */
export function ine5De(codi: unknown): string | null {
  const text = textNet(codi);
  if (text === null || !/^\d+$/.test(text)) return null;
  if (text.length === 6) return text.slice(0, 5);
  if (text.length === 5) return text;
  if (text.length === 4) return text.padStart(5, "0");
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Planejament
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Les figures de planejament general que surten a la font (2024: POUM 417,
 * normes subsidiàries 289, PGO 109, normes de planejament urbanístic 76, PGM
 * 27, POUM plurimunicipal 26, PGO plurimunicipal 3), amb la sigla habitual i
 * una frase que diu què és. La sigla del PGO plurimunicipal no es posa perquè
 * no n'hi ha cap d'establerta.
 */
export const FIGURES_PLANEJAMENT: Record<string, { sigla: string | null; que: string }> = {
  "Pla d'ordenació urbanística municipal": {
    sigla: "POUM",
    que: "el pla general que preveu la llei d'urbanisme catalana des del 2002",
  },
  "Pla d'ordenació urbanística plurimunicipal": {
    sigla: "POUPM",
    que: "un pla general de la llei d'urbanisme del 2002 compartit per més d'un municipi",
  },
  "Pla general d'ordenació": {
    sigla: "PGO",
    que: "un pla general fet amb la legislació d'abans de la llei d'urbanisme catalana del 2002",
  },
  "Pla general d'ordenació plurimunicipal": {
    sigla: null,
    que: "un pla general d'abans de la llei del 2002 compartit per més d'un municipi",
  },
  "Normes subsidiàries del planejament": {
    sigla: "NNSS",
    que: "una figura d'abans de la llei d'urbanisme del 2002, més senzilla que un pla general, pensada per als municipis que no en tenien",
  },
  "Normes de planejament urbanístic": {
    sigla: "NPU",
    que: "unes normes que aprova la Generalitat per suplir o completar el pla general d'un municipi",
  },
  "Pla general metropolità": {
    sigla: "PGM",
    que: "el pla del 1976 que comparteixen els municipis de l'antiga Corporació Metropolitana de Barcelona",
  },
};

/** Sigla i explicació d'una figura; una figura nova que no coneixem no en té cap. */
export function figuraConeguda(figura: string | null): { sigla: string | null; que: string | null } {
  if (figura === null) return { sigla: null, que: null };
  const f = FIGURES_PLANEJAMENT[figura];
  return f ? { sigla: f.sigla, que: f.que } : { sigla: null, que: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Plegat de l'Observatori del Territori
// ─────────────────────────────────────────────────────────────────────────────

/** Una xifra que la font publica però que és fora del rang que té sentit. */
export type Anomalia = { camp: string; valor: string; any: number | null };

const anyDe = (fila: { any?: string | null }): number | null => {
  const n = comptatge(fila.any);
  return n !== null && n >= 1900 && n <= 2100 ? n : null;
};

/**
 * Llegeix un camp numèric i el valida pel rang. Si la font hi posa un número
 * però és absurd, a més de tornar `null` ho apunta a `avisos`, perquè una
 * xifra trencada ha de sortir a la llista d'incidències i no desaparèixer.
 */
function campValidat(
  fila: FilaObservatori,
  camp: keyof FilaObservatori,
  min: number,
  max: number,
  avisos: Anomalia[],
  enter = false,
): number | null {
  const n = enter ? comptatge(fila[camp]) : nombreNet(fila[camp]);
  if (n === null) {
    // Un text que no és buit ni número també és una anomalia.
    const text = textNet(fila[camp]);
    if (text !== null) avisos.push({ camp, valor: text, any: anyDe(fila) });
    return null;
  }
  const valid = dinsRang(n, min, max);
  if (valid === null) avisos.push({ camp, valor: String(fila[camp]), any: anyDe(fila) });
  return valid;
}

export type CostCatalunya = { lloguerPerc: number | null; hipotecaPerc: number | null };

/**
 * Agrupa les files de l'Observatori per municipi (INE de cinc xifres) i en
 * separa la fila de Catalunya, que és la que no porta codi. Si un any hi ha
 * més d'una fila sense codi no se sap quina és la de Catalunya i no se'n fa
 * servir cap: una referència dubtosa és pitjor que cap referència.
 */
export function plegaObservatori(files: readonly FilaObservatori[]): {
  perIne5: Map<string, FilaObservatori[]>;
  catalunya: Map<number, CostCatalunya>;
} {
  const perIne5 = new Map<string, FilaObservatori[]>();
  const senseCodi = new Map<number, FilaObservatori[]>();
  for (const fila of files) {
    const ine5 = ine5De(fila.codi_municipi);
    if (ine5 !== null) {
      const llista = perIne5.get(ine5) ?? [];
      llista.push(fila);
      perIne5.set(ine5, llista);
      continue;
    }
    const any = anyDe(fila);
    if (any === null || textNet(fila.codi_municipi) !== null) continue;
    senseCodi.set(any, [...(senseCodi.get(any) ?? []), fila]);
  }
  const catalunya = new Map<number, CostCatalunya>();
  for (const [any, llista] of senseCodi) {
    if (llista.length !== 1) continue;
    const fila = llista[0]!;
    catalunya.set(any, {
      lloguerPerc: u1(dinsRang(nombreNet(fila._13_hab_cost_ingressos_perc), 0, 100)),
      hipotecaPerc: u1(dinsRang(nombreNet(fila._14_hab_hipoteca_ingressos_perc), 0, 100)),
    });
  }
  return { perIne5, catalunya };
}

/**
 * Recorre les files d'un municipi de l'any més recent al més antic i torna la
 * primera secció que no és buida. Cada secció porta el seu any: si el 2024 la
 * font no té el cost del lloguer i el 2023 sí, es fa servir el del 2023 i la
 * fitxa diu «2023».
 */
function darreraAmb<T>(files: readonly FilaObservatori[], fer: (fila: FilaObservatori, any: number) => T | null): T | null {
  const ordenades = files
    .map((fila) => ({ fila, any: anyDe(fila) }))
    .filter((x): x is { fila: FilaObservatori; any: number } => x.any !== null)
    .sort((a, b) => b.any - a.any);
  for (const { fila, any } of ordenades) {
    const valor = fer(fila, any);
    if (valor !== null) return valor;
  }
  return null;
}

/** El pla general vigent, amb l'antiguitat i l'any d'aprovació aproximat. */
export function planejamentDe(files: readonly FilaObservatori[], avisos: Anomalia[] = []): Planejament | null {
  return darreraAmb(files, (fila, any) => {
    const figura = textNet(fila._61_plj_pg_vigent);
    const antiguitat = campValidat(fila, "_62_plj_pg_anitguitat", 0, 150, avisos, true);
    if (figura === null && antiguitat === null) return null;
    const adaptat = textNet(fila._63_plj_munis_adapt_llei);
    return {
      any,
      figura,
      sigla: figuraConeguda(figura).sigla,
      antiguitat,
      anyAprovacioAprox: antiguitat === null ? null : any - antiguitat,
      adaptatLlei2002: adaptat === "1" ? true : adaptat === "0" ? false : null,
    };
  });
}

/** Els pisos turístics (HUT) i les places turístiques. */
export function pisosTuristicsDe(files: readonly FilaObservatori[], avisos: Anomalia[] = []): PisosTuristics | null {
  return darreraAmb(files, (fila, any) => {
    const t: PisosTuristics = {
      any,
      huts: campValidat(fila, "_27_tur_nombre_huts", 0, 1_000_000, avisos, true),
      placesHuts: campValidat(fila, "_25_tur_places_huts", 0, 10_000_000, avisos, true),
      hutsPer100: u2(campValidat(fila, "_28_tur_nombre_huts_100hab", 0, 10_000, avisos)),
      placesTuristiques: campValidat(fila, "_23_tur_places", 0, 10_000_000, avisos, true),
      placesTuristiquesPer100: u1(campValidat(fila, "_24_tur_places_100hab", 0, 100_000, avisos)),
    };
    return t.huts === null && t.placesHuts === null && t.placesTuristiques === null ? null : t;
  });
}

/** El cost del lloguer i de la hipoteca sobre els ingressos, amb la referència de Catalunya. */
export function costDe(
  files: readonly FilaObservatori[],
  catalunya: ReadonlyMap<number, CostCatalunya>,
  avisos: Anomalia[] = [],
): CostHabitatge | null {
  return darreraAmb(files, (fila, any) => {
    const lloguerPerc = u1(campValidat(fila, "_13_hab_cost_ingressos_perc", 0, 100, avisos));
    const hipotecaPerc = u1(campValidat(fila, "_14_hab_hipoteca_ingressos_perc", 0, 100, avisos));
    if (lloguerPerc === null && hipotecaPerc === null) return null;
    return { any, lloguerPerc, hipotecaPerc, catalunya: catalunya.get(any) ?? null };
  });
}

/** Els habitatges acabats l'any, tots i els protegits, de la mateixa font. */
export function acabatsDe(files: readonly FilaObservatori[], avisos: Anomalia[] = []): HabitatgesAcabats | null {
  return darreraAmb(files, (fila, any) => {
    const total = campValidat(fila, "_10_hab_acabats_total", 0, 1_000_000, avisos, true);
    const protegits = campValidat(fila, "_11_hab_acabats_hpo", 0, 1_000_000, avisos, true);
    return total === null && protegits === null ? null : { any, total, protegits };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Habitatge protegit i zona tensa
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Agrupa la sèrie d'HPO per municipi, ordenada per any. Si un any surt dues
 * vegades per al mateix municipi es queda la primera i es compta a
 * `repetits`: sumar-les doblaria els pisos.
 */
export function plegaHpo(files: readonly FilaHpo[]): { perIne5: Map<string, AnyProtegits[]>; repetits: number } {
  const perIne5 = new Map<string, Map<number, AnyProtegits>>();
  let repetits = 0;
  for (const fila of files) {
    const ine5 = ine5De(fila.codi_ine);
    const any = anyDe(fila);
    if (ine5 === null || any === null) continue;
    const anys = perIne5.get(ine5) ?? new Map<number, AnyProtegits>();
    if (anys.has(any)) {
      repetits += 1;
      continue;
    }
    anys.set(any, { any, iniciats: comptatge(fila.iniciats_hpo), acabats: comptatge(fila.acabats_hpo) });
    perIne5.set(ine5, anys);
  }
  const ordenat = new Map<string, AnyProtegits[]>();
  for (const [ine5, anys] of perIne5) ordenat.set(ine5, [...anys.values()].sort((a, b) => a.any - b.any));
  return { perIne5: ordenat, repetits };
}

/**
 * La suma d'iniciats i acabats entre dos anys. Només es fa si **cada** any del
 * tram hi és i té les dues xifres: una suma amb un any que falta seria una
 * xifra més petita que la real, presentada com si fos sencera.
 */
export function sumaProtegits(serie: readonly AnyProtegits[], des: number, fins: number): SumaProtegits | null {
  if (des > fins) return null;
  let iniciats = 0;
  let acabats = 0;
  for (let any = des; any <= fins; any += 1) {
    const a = serie.find((x) => x.any === any);
    if (!a || a.iniciats === null || a.acabats === null) return null;
    iniciats += a.iniciats;
    acabats += a.acabats;
  }
  return { des, fins, iniciats, acabats };
}

/** L'any de les darreres municipals: «des del 2023» és el que va d'aquest mandat. */
export const ANY_MANDAT = 2023;

/** El resum de la sèrie d'HPO d'un municipi, o `null` si la font no en porta cap any. */
export function protegitDe(serie: readonly AnyProtegits[] | undefined): HabitatgeProtegit | null {
  if (!serie || serie.length === 0) return null;
  const ordenada = [...serie].sort((a, b) => a.any - b.any);
  const primer = ordenada[0]!.any;
  const darrer = ordenada[ordenada.length - 1]!;
  return {
    serie: ordenada,
    darrer,
    desDe2023: darrer.any >= ANY_MANDAT ? sumaProtegits(ordenada, Math.max(ANY_MANDAT, primer), darrer.any) : null,
    total: sumaProtegits(ordenada, primer, darrer.any),
  };
}

/**
 * La zona tensa d'una fila. La font escriu «ZMRT 1», «ZMRT 2» o «NA»; «NA»
 * vol dir que el municipi és a la llista i no és zona tensa. Un valor que no
 * coneixem (una futura «ZMRT 3», per exemple) torna `null`: no se sap què és,
 * i dir «no és zona tensa» seria inventar-ho.
 */
export function zonaDeFila(fila: FilaZona | undefined): ZonaTensa | null {
  if (!fila) return null;
  const text = textNet(fila.zona_de_mercat_residencial_tensat);
  if (text === null) return { zona: null, vigentDes: null };
  const compacte = text.replace(/\s+/g, "").toUpperCase();
  if (compacte === "ZMRT1") return { zona: "ZMRT1", vigentDes: VIGENCIA_ZONES.ZMRT1 };
  if (compacte === "ZMRT2") return { zona: "ZMRT2", vigentDes: VIGENCIA_ZONES.ZMRT2 };
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// La mètrica d'un municipi
// ─────────────────────────────────────────────────────────────────────────────

export type PecesMunicipi = {
  observatori: readonly FilaObservatori[];
  catalunya: ReadonlyMap<number, CostCatalunya>;
  hpo: readonly AnyProtegits[] | undefined;
  zona: FilaZona | undefined;
  fonts: UrbanismeHabitatgeMetric["fonts"];
  consultat: string;
};

/**
 * Ajunta les tres fonts d'un municipi. És pura a posta: és el que es prova, i
 * és tot el criteri de la feina. Torna `null` si cap de les tres no diu res
 * del municipi; si n'hi ha alguna, la mètrica es desa amb les seccions buides
 * a `null`, que és com la fitxa sap què ha de dir «no consta».
 */
export function urbanismeDeMunicipi(
  peces: PecesMunicipi,
  avisos: Anomalia[] = [],
): UrbanismeHabitatgeMetric | null {
  const metrica: UrbanismeHabitatgeMetric = {
    planejament: planejamentDe(peces.observatori, avisos),
    pisosTuristics: pisosTuristicsDe(peces.observatori, avisos),
    cost: costDe(peces.observatori, peces.catalunya, avisos),
    habitatgesAcabats: acabatsDe(peces.observatori, avisos),
    protegit: protegitDe(peces.hpo),
    zonaTensa: zonaDeFila(peces.zona),
    fonts: peces.fonts,
    consultat: peces.consultat,
  };
  const algunaCosa =
    metrica.planejament || metrica.pisosTuristics || metrica.cost || metrica.habitatgesAcabats ||
    metrica.protegit || metrica.zonaTensa;
  return algunaCosa ? metrica : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// La feina
// ─────────────────────────────────────────────────────────────────────────────

/** Pausa entre conjunts: Socrata torna 429 si se l'apreta. */
const PAUSA_MS = 1_000;

/**
 * La data d'actualització que el portal declara per a un conjunt
 * (`rowsUpdatedAt`, en segons), com a «AAAA-MM-DD». Si la crida falla es torna
 * `null` i la fitxa diu només la data de consulta: no és motiu per aturar res.
 */
async function dataActualitzacio(dataset: string): Promise<string | null> {
  try {
    const vista = await fetchJson<{ rowsUpdatedAt?: number }>(
      `https://analisi.transparenciacatalunya.cat/api/views/${dataset}.json`,
      { delayMs: PAUSA_MS, retries: 2 },
    );
    return typeof vista.rowsUpdatedAt === "number" ? new Date(vista.rowsUpdatedAt * 1000).toISOString().slice(0, 10) : null;
  } catch {
    return null;
  }
}

async function desa(db: Db, municipalityId: number, kind: string, data: unknown): Promise<void> {
  await db
    .insert(municipalityMetrics)
    .values({ municipalityId, kind, data })
    .onConflictDoUpdate({
      target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
      set: { data, computedAt: new Date() },
    });
}

export async function j40UrbanismeHabitatge(db: Db): Promise<void> {
  await withRun(db, "J40 urbanisme i habitatge: pla vigent, pisos turístics, cost, HPO i zona tensa", async (run) => {
    const consultat = new Date().toISOString().slice(0, 10);

    const observatori = await socrataAll<FilaObservatori>(DATASET_TERRITORI, {
      select: CAMPS_OBSERVATORI.join(","),
      order: "codi_municipi,any",
    });
    await sleep(PAUSA_MS);
    const hpo = await socrataAll<FilaHpo>(DATASET_HPO, {
      select: "codi_ine,any,iniciats_hpo,acabats_hpo",
      order: "codi_ine,any",
    });
    await sleep(PAUSA_MS);
    const zones = await socrataAll<FilaZona>(DATASET_ZONES, {
      select: "codmuni,zona_de_mercat_residencial_tensat",
      order: "codmuni",
    });
    run.rowsIn = observatori.length + hpo.length + zones.length;
    run.say(`${observatori.length} files de l'Observatori, ${hpo.length} d'HPO, ${zones.length} de zones`);

    const fonts: UrbanismeHabitatgeMetric["fonts"] = {
      territori: { ...FONTS_URBANISME.territori, actualitzat: await dataActualitzacio(DATASET_TERRITORI) },
      hpo: { ...FONTS_URBANISME.hpo, actualitzat: await dataActualitzacio(DATASET_HPO) },
      zones: { ...FONTS_URBANISME.zones, actualitzat: await dataActualitzacio(DATASET_ZONES) },
    };

    const { perIne5: obsPerIne5, catalunya } = plegaObservatori(observatori);
    const { perIne5: hpoPerIne5, repetits } = plegaHpo(hpo);
    if (repetits > 0) {
      await run.issue({ kind: "hpo_any_repetit", severity: "mitjana", detail: { repetits, dataset: DATASET_HPO } });
    }
    const zonaPerIne5 = new Map<string, FilaZona>();
    for (const fila of zones) {
      const ine5 = ine5De(fila.codmuni);
      if (ine5 !== null && !zonaPerIne5.has(ine5)) zonaPerIne5.set(ine5, fila);
    }
    if (catalunya.size === 0) run.say("cap fila de Catalunya identificable: el cost es desa sense referència");

    const tots = await db.select({ id: municipalities.id, ine5: municipalities.ine5, name: municipalities.name }).from(municipalities);
    const compte = { planejament: 0, pisos: 0, cost: 0, hipoteca: 0, protegit: 0, zonaLlista: 0, zmrt1: 0, zmrt2: 0, sense: 0 };

    for (const m of tots) {
      const avisos: Anomalia[] = [];
      const zona = zonaPerIne5.get(m.ine5);
      const data = urbanismeDeMunicipi(
        { observatori: obsPerIne5.get(m.ine5) ?? [], catalunya, hpo: hpoPerIne5.get(m.ine5), zona, fonts, consultat },
        avisos,
      );
      for (const a of avisos) {
        await run.issue({ kind: "urbanisme_xifra_fora_de_rang", severity: "baixa", municipalityId: m.id, entity: m.name, detail: a });
      }
      if (zona && textNet(zona.zona_de_mercat_residencial_tensat) !== null && zonaDeFila(zona) === null) {
        await run.issue({
          kind: "zona_tensa_desconeguda", severity: "mitjana", municipalityId: m.id, entity: m.name,
          detail: { valor: zona.zona_de_mercat_residencial_tensat },
        });
      }
      if (!data) {
        // Cap de les tres fonts no porta el municipi: no s'hi desa res, i la
        // fitxa dirà que no consta. Passa si un municipi és nou o canvia de codi.
        compte.sense += 1;
        await run.issue({ kind: "urbanisme_sense_dades", severity: "baixa", municipalityId: m.id, entity: m.name, detail: { ine5: m.ine5 } });
        continue;
      }
      if (data.planejament) compte.planejament += 1;
      if (data.pisosTuristics) compte.pisos += 1;
      if (data.cost?.lloguerPerc != null) compte.cost += 1;
      if (data.cost?.hipotecaPerc != null) compte.hipoteca += 1;
      if (data.protegit) compte.protegit += 1;
      if (data.zonaTensa) compte.zonaLlista += 1;
      if (data.zonaTensa?.zona === "ZMRT1") compte.zmrt1 += 1;
      if (data.zonaTensa?.zona === "ZMRT2") compte.zmrt2 += 1;
      await desa(db, m.id, "urbanismeHabitatge", data);
      run.rowsOut += 1;
    }

    run.say(
      `${run.rowsOut} municipis desats · pla ${compte.planejament}, HUT ${compte.pisos}, cost del lloguer ${compte.cost}, ` +
        `de la hipoteca ${compte.hipoteca}, HPO ${compte.protegit}, a la llista de zones ${compte.zonaLlista} ` +
        `(ZMRT1 ${compte.zmrt1}, ZMRT2 ${compte.zmrt2})${compte.sense ? ` · ${compte.sense} sense cap dada` : ""}`,
    );
    return { ...compte, municipis: run.rowsOut, consultat };
  });
}
