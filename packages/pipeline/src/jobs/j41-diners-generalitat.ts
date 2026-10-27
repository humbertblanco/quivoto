import { municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { DATASETS, socrataAll } from "../adapters/socrata";
import { sleep } from "../lib/http";
import { withRun } from "../lib/run";

/**
 * J41 — els diners que la Generalitat dona a cada ajuntament (i a cada
 * consell comarcal, a l'AMB i a les diputacions), si li ha enviat els comptes
 * i el que encara li deu.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LES QUATRE FONTS, I PER QUÈ VAN JUNTES
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Totes quatre les publica la Secretaria de Governs Locals al portal de dades
 * obertes, i totes quatre responen la mateixa pregunta del veí: «què hi ha
 * entre el meu ajuntament i la Generalitat?».
 *
 *   · **Fons de Cooperació Local** (`ka4a-fyht`, 2010-2025). Una fila per ens
 *     i any, amb tres imports que són tres trams diferents del fons: el de
 *     lliure disposició (`import`), el que es dona per fomentar serveis
 *     supramunicipals (`fclc_supramunicipal`) i l'extraordinari
 *     (`fclc_extraordinari`). **No se sumen entre ells**: cada any la llei de
 *     pressupostos els reparteix per separat i la font els dona separats. És
 *     un repartiment per fórmula (població per trams, superfície, nuclis,
 *     capitalitat…), **no cap premi a la gestió**, i la fitxa ho diu.
 *   · **PUOSC** (`v5fj-86q3`). Una fila per obra: títol, tipus, subvenció i
 *     pressupost. Cobreix les convocatòries 1996-2012 i 2020-2029; **del 2013
 *     al 2019 no hi ha res**, i això és un buit de la font. Les anualitats
 *     d'un any igual o posterior al de la consulta són **programades**: diuen
 *     què preveu pagar la Generalitat, no que l'obra s'hagi fet.
 *   · **Inventari de trameses** (`7fnj-etev`, llicència ODC-By). Per a cada ens
 *     i any, si ha enviat el pressupost, la liquidació, l'estat del deute i el
 *     compte general, i quan. Es desa el document i la data; el camp
 *     `compliment` («Compleix»/«No compleix») és un estat acumulat que la font
 *     repeteix a cada any, i es desa a part però la fitxa no el pinta: el
 *     principi és publicar la dada, no l'adjectiu.
 *   · **Obligacions pendents de pagament** (`4w8y-gf8x`). Una instantània
 *     mensual del que la Generalitat ha reconegut i encara no ha pagat, per
 *     NIF del creditor i tipus d'ajut. Només es fa servir **la darrera
 *     instantània**, amb la seva data al costat: és un calendari de pagaments
 *     normal, no un deute escandalós.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ON ES DESA
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Per a cada municipi, a `municipality_metrics` amb el kind
 * `dinersGeneralitat`. Per a cada diputació, consell comarcal i l'AMB, al
 * municipi que n'és la seu segons el registre d'ens locals
 * (`6nei-4b44.codi_municipi`), amb el kind `dinersGeneralitatEns:<codiEns>`:
 * Barcelona és seu de la diputació i de l'AMB, i Girona de la diputació i del
 * consell, i per això el codi va dins del kind (el mateix patró que la J39).
 *
 * Les regles de sempre:
 *
 *   · **Un buit és un buit.** Un any sense fila al FCL no és un any amb zero
 *     euros; un document sense estat a l'inventari és «no consta», no «no
 *     tramès». Els zeros que la font publica com a zeros es queden zeros.
 *   · **No se sumen pagadors.** Res d'aquí no es barreja amb les subvencions
 *     de la diputació o del consell (J39, RAISC): són diners d'un altre.
 *   · **Consultes agregades quan es pot.** El FCL es demana ja sumat per ens i
 *     any; el PUOSC i l'inventari s'han de llegir fila a fila (una obra, un
 *     any d'un ens), però són conjunts petits (24.000 i 18.000 files) i es
 *     demanen amb una pausa entre fonts.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Les fonts
// ─────────────────────────────────────────────────────────────────────────────

export const DATASET_FCL = "ka4a-fyht";
export const DATASET_PUOSC = "v5fj-86q3";
export const DATASET_TRAMESES = "7fnj-etev";
export const DATASET_PENDENTS = "4w8y-gf8x";

export const KIND_DINERS_GENERALITAT = "dinersGeneralitat";
export const PREFIX_KIND_DINERS_GENERALITAT_ENS = "dinersGeneralitatEns:";

const ORGANISME = "Generalitat de Catalunya, Secretaria de Governs Locals i de Relacions amb l'Aran";
const CONDICIONS = "Condicions d'ús del portal: reutilització amb atribució i sense alterar el sentit";

/** Una font tal com la cita el peu del bloc. */
export type FontDiners = {
  id: string;
  titol: string;
  organisme: string;
  url: string;
  llicencia: string;
  /** Data de consulta, `AAAA-MM-DD`. */
  consultat: string;
};

export const FONTS_DINERS = {
  fcl: {
    id: DATASET_FCL,
    titol: "Distribució del Fons de Cooperació Local de Catalunya",
    organisme: ORGANISME,
    url: `https://analisi.transparenciacatalunya.cat/d/${DATASET_FCL}`,
    llicencia: CONDICIONS,
  },
  puosc: {
    id: DATASET_PUOSC,
    titol: "Pla únic d'obres i serveis de Catalunya (PUOSC)",
    organisme: ORGANISME,
    url: `https://analisi.transparenciacatalunya.cat/d/${DATASET_PUOSC}`,
    llicencia: CONDICIONS,
  },
  trameses: {
    id: DATASET_TRAMESES,
    titol: "Inventari de compliment de les obligacions de tramesa d'informació economicofinancera",
    organisme: ORGANISME,
    url: `https://analisi.transparenciacatalunya.cat/d/${DATASET_TRAMESES}`,
    llicencia: "Open Data Commons Attribution License (ODC-By)",
  },
  pendents: {
    id: DATASET_PENDENTS,
    titol: "Obligacions reconegudes pendents de pagament als ens locals",
    organisme: ORGANISME,
    url: `https://analisi.transparenciacatalunya.cat/d/${DATASET_PENDENTS}`,
    llicencia: CONDICIONS,
  },
} as const satisfies Record<string, Omit<FontDiners, "consultat">>;

// ─────────────────────────────────────────────────────────────────────────────
// El que es desa
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Un any del Fons de Cooperació Local. Els tres trams van per separat i cap
 * no es converteix en zero si la font no el porta: el supramunicipal només
 * existeix uns anys (2010-2012 i 2014) i l'extraordinari uns altres.
 */
export type AnyFcl = {
  any: number;
  /** Tram de lliure disposició (`import`). */
  lliure: number | null;
  /** Tram per al foment de la prestació supramunicipal de serveis. */
  supramunicipal: number | null;
  /** FCLC extraordinari. */
  extraordinari: number | null;
};

/**
 * Una obra del PUOSC. `estat` distingeix el que ja s'ha assignat (un any
 * anterior al de la consulta) del que és una anualitat programada (l'any de
 * la consulta o posteriors). La font no diu mai si l'obra s'ha acabat: ni
 * «assignada» vol dir «feta», ni «programada» vol dir «segura».
 */
export type ObraPuosc = {
  any: number;
  estat: "assignada" | "programada";
  /** El títol de l'actuació; les convocatòries del 1996-2012 no en porten. */
  titol: string | null;
  tipologia: string | null;
  /** La línia de la convocatòria 2020-2029: inversions o municipis petits. */
  linia: "inversions" | "municipis petits" | null;
  /** El que hi posa la Generalitat. */
  subvencio: number | null;
  /** El pressupost inicial de l'obra (només 2020-2029). */
  pressupost: number | null;
  expedient: string | null;
};

/**
 * L'estat d'un document a l'inventari: tramès o no, amb la data de tramesa
 * (`AAAA-MM-DD`) i l'observació literal de la font («En revisió»,
 * «Pressupost prorrogat»…). `null` vol dir que la font no hi diu res.
 */
export type EstatDocument = { trames: boolean; data: string | null; observacio: string | null };

/**
 * Un any de l'inventari. El pressupost i la liquidació tenen dues trameses
 * cadascun (les dades economicofinanceres i la documentació administrativa),
 * i es desen totes dues: la fitxa decideix com les pinta.
 */
export type TramesaAny = {
  any: number;
  pressupost: { economic: EstatDocument | null; administratiu: EstatDocument | null };
  liquidacio: { economic: EstatDocument | null; administratiu: EstatDocument | null };
  deute: EstatDocument | null;
  compteGeneral: EstatDocument | null;
};

export type TramesesDesades = {
  anys: TramesaAny[];
  /**
   * L'estat acumulat que la font repeteix a cada fila («Compleix» o «No
   * compleix»), tal com ve. Es desa per traçabilitat; la fitxa no el pinta.
   */
  estatInventari: string | null;
  /** La data de la darrera càrrega de l'inventari (`AAAA-MM-DD`). */
  actualitzat: string | null;
};

/** Un concepte pendent de pagament a la darrera instantània. */
export type ConceptePendent = {
  /** El tipus d'ajut literal: «FCL», «PUOSC», «Càrrecs electes»… */
  tipus: string;
  exercici: number | null;
  import: number;
  /** Si la font el marca com a «Pagament retingut». */
  retingut: boolean;
};

/**
 * El que la Generalitat deu a l'ens a la data de la instantània. Si l'ens no
 * hi surt, `conceptes` és buit: la font llista tots els ens amb obligacions
 * pendents, i no sortir-hi vol dir que no n'hi consta cap aquell dia.
 */
export type PendentsDesats = { data: string; conceptes: ConceptePendent[] };

/** El que tenen en comú la fitxa d'un municipi i la d'un ens. */
export type DinersGeneralitatBase = {
  codiEns: string;
  /** `null` si l'ens no és destinatari del fons (les diputacions). */
  fcl: AnyFcl[] | null;
  obres: ObraPuosc[];
  trameses: TramesesDesades;
  /** `null` si la instantània no s'ha pogut llegir. */
  pendents: PendentsDesats | null;
  /** L'any de la consulta: el que separa les obres assignades de les programades. */
  anyConsulta: number;
  fonts: { fcl: FontDiners; puosc: FontDiners; trameses: FontDiners; pendents: FontDiners };
};

/** Kind `dinersGeneralitat`, un per municipi. */
export type DinersGeneralitat = DinersGeneralitatBase;

export type TipusEnsDiners = "diputacio" | "consell" | "amb";

/** Kind `dinersGeneralitatEns:<codiEns>`, al municipi seu de l'ens. */
export type DinersGeneralitatEnsDesat = DinersGeneralitatBase & {
  nom: string;
  tipus: TipusEnsDiners;
};

// ─────────────────────────────────────────────────────────────────────────────
// Lectura de camps
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Un codi d'ens de 10 xifres. Socrata el torna com a text i alguns conjunts
 * (el PUOSC, sobretot) hi perden el zero inicial de la província de
 * Barcelona: «825150006» és Santa Margarida i els Monjos, `0825150006`.
 */
export function codi10(codi: unknown): string | null {
  const net = String(codi ?? "").trim();
  if (!/^\d{1,10}$/.test(net)) return null;
  return net.padStart(10, "0");
}

/** Un número que ve com a text; buit, «N/A» o il·legible → `null`, mai zero. */
export function numero(text: unknown): number | null {
  if (typeof text === "number") return Number.isFinite(text) ? text : null;
  if (typeof text !== "string") return null;
  const net = text.trim();
  if (net === "" || net === "N/A") return null;
  const n = Number(net);
  return Number.isFinite(n) ? n : null;
}

/**
 * El pressupost del PUOSC, que la font escriu com a text amb punts per a tot:
 * «247.806.98» són 247.806,98 €, «1.504.817.12» són 1.504.817,12 € i
 * «164.000» són 164.000 €. La regla, comprovada amb les 4.521 obres que en
 * porten (el 27-10-2026, totes menys una tenen la subvenció per sota del
 * pressupost llegit així):
 *
 *   · si el darrer grup té una o dues xifres, són els cèntims;
 *   · tots els altres punts separen milers, i per tant els grups del mig han
 *     de tenir exactament tres xifres i el primer, d'una a tres;
 *   · si porta una coma, és la forma catalana normal («1.234,56»).
 *
 * Qualsevol altra forma («1234.567», «12.34.56») és ambigua i torna `null`:
 * un pressupost mal llegit per mil seria pitjor que cap.
 */
export function llegeixImportAmbPunts(text: unknown): number | null {
  if (typeof text === "number") return Number.isFinite(text) ? text : null;
  if (typeof text !== "string") return null;
  let net = text.trim().replace(/\s|€/g, "");
  if (net === "" || net === "N/A") return null;
  let centims = "";
  if (net.includes(",")) {
    const parts = net.split(",");
    if (parts.length !== 2 || !/^\d{1,2}$/.test(parts[1]!)) return null;
    [net, centims] = [parts[0]!, parts[1]!];
  } else {
    const grups = net.split(".");
    if (grups.length > 1 && /^\d{1,2}$/.test(grups[grups.length - 1]!)) {
      centims = grups.pop()!;
      net = grups.join(".");
    }
  }
  const grups = net.split(".");
  if (!grups.every((g) => /^\d+$/.test(g))) return null;
  if (grups.length > 1) {
    if (!/^\d{1,3}$/.test(grups[0]!) || !grups.slice(1).every((g) => g.length === 3)) return null;
  }
  const n = Number(`${grups.join("")}${centims ? `.${centims}` : ""}`);
  return Number.isFinite(n) ? n : null;
}

/** Una data de Socrata (`2024-04-19T00:00:00.000`) com a `AAAA-MM-DD`. */
export function dataCurta(text: unknown): string | null {
  if (typeof text !== "string") return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(text.trim());
  return m ? m[1]! : null;
}

/** Un text de la font, sense els «N/A» i els buits que fa servir per dir «res». */
function text(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const net = valor.trim();
  return net === "" || net === "N/A" || net === "NA" ? null : net;
}

/** Un euro arrodonit al cèntim, per no arrossegar la coma flotant de les sumes. */
const centim = (n: number): number => Math.round(n * 100) / 100;

// ─────────────────────────────────────────────────────────────────────────────
// Fons de Cooperació Local
// ─────────────────────────────────────────────────────────────────────────────

/** Una fila de la consulta agregada del FCL: ja sumada per ens i any al servidor. */
export type FilaFcl = {
  codi_10?: string;
  any?: string;
  lliure?: string;
  supramunicipal?: string;
  extraordinari?: string;
  files?: string;
};

/**
 * La consulta del FCL: una fila per ens i any, ja sumada. Si un ens surt dues
 * vegades el mateix any, `files` ho diu i la feina n'aixeca una incidència
 * (la suma, aleshores, és la de les dues files, com fa la font a les seves
 * pròpies agregacions). `sum` d'una columna tota buida no torna res, i això
 * es queda `null`.
 */
export const CONSULTA_FCL = {
  select:
    "codi_10,any,sum(import) as lliure,sum(fclc_supramunicipal) as supramunicipal," +
    "sum(fclc_extraordinari) as extraordinari,count(*) as files",
  where: "ens_beneficiari in ('Municipi','Comarca','Àrea Metropolitana de Barcelona')",
  group: "codi_10,any",
  order: "codi_10,any",
} as const;

export function llegeixFcl(files: readonly FilaFcl[]): {
  perCodi: Map<string, AnyFcl[]>;
  repetides: { codiEns: string; any: number; files: number }[];
  illegibles: number;
} {
  const perCodi = new Map<string, AnyFcl[]>();
  const repetides: { codiEns: string; any: number; files: number }[] = [];
  let illegibles = 0;
  for (const f of files) {
    const codiEns = codi10(f.codi_10);
    const any = numero(f.any);
    if (!codiEns || any === null) {
      illegibles += 1;
      continue;
    }
    const n = numero(f.files) ?? 1;
    if (n > 1) repetides.push({ codiEns, any, files: n });
    const fila: AnyFcl = {
      any,
      lliure: arrodonit(numero(f.lliure)),
      supramunicipal: arrodonit(numero(f.supramunicipal)),
      extraordinari: arrodonit(numero(f.extraordinari)),
    };
    perCodi.set(codiEns, [...(perCodi.get(codiEns) ?? []), fila]);
  }
  for (const anys of perCodi.values()) anys.sort((a, b) => a.any - b.any);
  return { perCodi, repetides, illegibles };
}

const arrodonit = (n: number | null): number | null => (n === null ? null : centim(n));

// ─────────────────────────────────────────────────────────────────────────────
// PUOSC
// ─────────────────────────────────────────────────────────────────────────────

export type FilaPuosc = {
  expedient?: string;
  l_nia?: string;
  any?: string;
  titol_actuacio?: string;
  tipologia_obra?: string;
  pressupost?: string;
  subvenci_puosc?: string;
  codi_ens?: string;
};

export const CAMPS_PUOSC = "expedient,l_nia,any,titol_actuacio,tipologia_obra,pressupost,subvenci_puosc,codi_ens";

const LINIES: Readonly<Record<string, ObraPuosc["linia"]>> = { INV: "inversions", MP: "municipis petits" };

/**
 * Una fila del PUOSC com a obra. Torna també els avisos que la feina converteix
 * en incidències: un pressupost que no es pot llegir sense endevinar, o una
 * subvenció més gran que el pressupost (n'hi ha una el 27-10-2026: 916.410 €
 * sobre 91.648,02 €, que sembla un error de la font i es desa tal com ve).
 */
export function llegeixObra(
  f: FilaPuosc,
  anyConsulta: number,
): { codiEns: string; obra: ObraPuosc; avisos: ("pressupost_illegible" | "subvencio_sobre_pressupost")[] } | null {
  const codiEns = codi10(f.codi_ens);
  const any = numero(f.any);
  if (!codiEns || any === null) return null;
  const avisos: ("pressupost_illegible" | "subvencio_sobre_pressupost")[] = [];
  const pressupost = llegeixImportAmbPunts(f.pressupost);
  if (pressupost === null && text(f.pressupost) !== null) avisos.push("pressupost_illegible");
  const subvencio = arrodonit(numero(f.subvenci_puosc));
  if (subvencio !== null && pressupost !== null && subvencio > pressupost * 1.0001) avisos.push("subvencio_sobre_pressupost");
  const obra: ObraPuosc = {
    any,
    estat: any >= anyConsulta ? "programada" : "assignada",
    titol: text(f.titol_actuacio),
    tipologia: text(f.tipologia_obra),
    linia: LINIES[text(f.l_nia) ?? ""] ?? null,
    subvencio,
    pressupost,
    expedient: text(f.expedient),
  };
  return { codiEns, obra, avisos };
}

/** Les obres d'un ens, de la més recent a la més antiga i, dins l'any, per subvenció. */
export function ordenaObres(obres: readonly ObraPuosc[]): ObraPuosc[] {
  return [...obres].sort(
    (a, b) => b.any - a.any || (b.subvencio ?? -1) - (a.subvencio ?? -1) || (a.titol ?? "").localeCompare(b.titol ?? "", "ca"),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inventari de trameses
// ─────────────────────────────────────────────────────────────────────────────

export type FilaTramesa = {
  codi10?: string;
  tipusens?: string;
  any?: string;
  compliment?: string;
  pressupostdecofin?: string;
  datapressupostdecofin?: string;
  obspressupostdecofin?: string;
  pressupostdocadm?: string;
  datapressupostdocadm?: string;
  obspressupostdocadm?: string;
  liquidaci_decofin?: string;
  dataliquidaci_decofin?: string;
  obsliquidaci_decofin?: string;
  liquidaci_docadm?: string;
  dataliquidaci_docadm?: string;
  obsliquidaci_docadm?: string;
  estatdeutefiex?: string;
  dataestatdeutefiex?: string;
  obsestatdeutefiex?: string;
  comptegeneral?: string;
  datacomptegeneral?: string;
  obscomptegeneral?: string;
  dataultimacarrega?: string;
};

/** Només els ens que tenen fitxa: ni consorcis, ni societats, ni ens de gestió. */
export const CONSULTA_TRAMESES = {
  select: [
    "codi10,tipusens,any,compliment",
    "pressupostdecofin,datapressupostdecofin,obspressupostdecofin",
    "pressupostdocadm,datapressupostdocadm,obspressupostdocadm",
    "liquidaci_decofin,dataliquidaci_decofin,obsliquidaci_decofin",
    "liquidaci_docadm,dataliquidaci_docadm,obsliquidaci_docadm",
    "estatdeutefiex,dataestatdeutefiex,obsestatdeutefiex",
    "comptegeneral,datacomptegeneral,obscomptegeneral,dataultimacarrega",
  ].join(","),
  where: "tipusens in ('Municipis','Comarques','Províncies','Entitats metropolitanes')",
} as const;

/**
 * L'estat d'un document. «Tramès» i «No tramès» són els dos únics valors que
 * la font fa servir (comprovat el 27-10-2026); qualsevol altra cosa, o res, és
 * que la font no en diu res, i torna `null`: un buit no és un «no tramès».
 */
export function estatDocument(estat: unknown, data: unknown, observacio: unknown): EstatDocument | null {
  const e = text(estat);
  if (e === null) return null;
  const normal = e.toLowerCase();
  const trames = normal === "tramès" || normal === "trames" ? true : normal === "no tramès" || normal === "no trames" ? false : null;
  if (trames === null) return null;
  return { trames, data: trames ? dataCurta(data) : null, observacio: text(observacio) };
}

export function llegeixTramesa(f: FilaTramesa): { codiEns: string; any: TramesaAny } | null {
  const codiEns = codi10(f.codi10);
  const any = numero(f.any);
  if (!codiEns || any === null) return null;
  return {
    codiEns,
    any: {
      any,
      pressupost: {
        economic: estatDocument(f.pressupostdecofin, f.datapressupostdecofin, f.obspressupostdecofin),
        administratiu: estatDocument(f.pressupostdocadm, f.datapressupostdocadm, f.obspressupostdocadm),
      },
      liquidacio: {
        economic: estatDocument(f.liquidaci_decofin, f.dataliquidaci_decofin, f.obsliquidaci_decofin),
        administratiu: estatDocument(f.liquidaci_docadm, f.dataliquidaci_docadm, f.obsliquidaci_docadm),
      },
      deute: estatDocument(f.estatdeutefiex, f.dataestatdeutefiex, f.obsestatdeutefiex),
      compteGeneral: estatDocument(f.comptegeneral, f.datacomptegeneral, f.obscomptegeneral),
    },
  };
}

/**
 * Totes les files de l'inventari, plegades per ens. L'estat acumulat
 * (`compliment`) és el de la fila de l'any més recent, i la data de càrrega,
 * la més recent que es vegi.
 */
export function llegeixTrameses(files: readonly FilaTramesa[]): { perCodi: Map<string, TramesesDesades>; illegibles: number } {
  const perCodi = new Map<string, TramesesDesades & { anyEstat: number }>();
  let illegibles = 0;
  for (const f of files) {
    const llegida = llegeixTramesa(f);
    if (!llegida) {
      illegibles += 1;
      continue;
    }
    const acc = perCodi.get(llegida.codiEns) ?? { anys: [], estatInventari: null, actualitzat: null, anyEstat: -Infinity };
    acc.anys.push(llegida.any);
    const estat = text(f.compliment);
    if (estat !== null && llegida.any.any > acc.anyEstat) {
      acc.estatInventari = estat;
      acc.anyEstat = llegida.any.any;
    }
    const carrega = dataCurta(f.dataultimacarrega);
    if (carrega && (acc.actualitzat === null || carrega > acc.actualitzat)) acc.actualitzat = carrega;
    perCodi.set(llegida.codiEns, acc);
  }
  const net = new Map<string, TramesesDesades>();
  for (const [codi, { anyEstat: _anyEstat, ...t }] of perCodi) {
    t.anys.sort((a, b) => a.any - b.any);
    net.set(codi, t);
  }
  return { perCodi: net, illegibles };
}

/** Un ens que no surt a l'inventari: cap any, cap estat. */
export const SENSE_TRAMESES: TramesesDesades = { anys: [], estatInventari: null, actualitzat: null };

// ─────────────────────────────────────────────────────────────────────────────
// El que deu la Generalitat
// ─────────────────────────────────────────────────────────────────────────────

export type FilaPendent = {
  data?: string;
  tipusens?: string;
  nifcreditor?: string;
  nomcreditor?: string;
  tipusajut?: string;
  exercici?: string;
  importnet?: string;
  retenci?: string;
};

export const CAMPS_PENDENTS = "data,tipusens,nifcreditor,nomcreditor,tipusajut,exercici,importnet,retenci";

/** Un NIF net: majúscules, sense espais, punts ni guions; si no en té la forma, `null`. */
export function normalitzaNif(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const net = valor.toUpperCase().replace(/[\s.\-/]/g, "");
  return /^[A-Z]\d{7}[A-Z0-9]$/.test(net) ? net : null;
}

/**
 * Les files de la darrera instantània, plegades per NIF. Dues files del mateix
 * tipus, exercici i estat de retenció es fan una (la font ja diu que l'import
 * és «acumulat per ens, exercici i tipus d'ajut»; el plec només evita
 * duplicats). Els imports no positius no són un deute i no es desen.
 */
export function llegeixPendents(files: readonly FilaPendent[]): Map<string, ConceptePendent[]> {
  const perNif = new Map<string, Map<string, ConceptePendent>>();
  for (const f of files) {
    const nif = normalitzaNif(f.nifcreditor);
    const imp = numero(f.importnet);
    const tipus = text(f.tipusajut);
    if (!nif || imp === null || imp <= 0 || !tipus) continue;
    const exercici = numero(f.exercici);
    const retingut = /retingut/i.test(f.retenci ?? "");
    const clau = `${tipus}|${exercici ?? ""}|${retingut}`;
    const del = perNif.get(nif) ?? new Map<string, ConceptePendent>();
    const ja = del.get(clau);
    if (ja) ja.import = centim(ja.import + imp);
    else del.set(clau, { tipus, exercici, import: centim(imp), retingut });
    perNif.set(nif, del);
  }
  const net = new Map<string, ConceptePendent[]>();
  for (const [nif, conceptes] of perNif) {
    net.set(nif, [...conceptes.values()].sort((a, b) => (b.exercici ?? 0) - (a.exercici ?? 0) || b.import - a.import));
  }
  return net;
}

// ─────────────────────────────────────────────────────────────────────────────
// El registre d'ens locals
// ─────────────────────────────────────────────────────────────────────────────

export type FilaRegistre = {
  codi_ens?: string;
  nomtipus?: string;
  nom_complert?: string;
  cif?: string;
  codi_municipi?: string;
  dissolt?: string;
};

export type EnsDiners = { codiEns: string; nom: string; tipus: TipusEnsDiners; seuCodiEns: string | null; nif: string | null };

/** El codi d'ens de l'Àrea Metropolitana de Barcelona al registre i al FCL. */
export const CODI_AMB = "8200330008";

/**
 * Del registre d'ens locals, els ens que tenen fitxa (les quatre diputacions,
 * els consells comarcals vius i l'AMB) i el NIF de cada ens, municipis
 * inclosos, que és la clau de la instantània de pagaments pendents. Com a la
 * J39, de les «Comarques» només són consells les que es diuen «Consell
 * Comarcal…»: el Barcelonès (dissolt el 2019), el Lluçanès (sense consell fins
 * al 2027) i el Conselh Generau d'Aran (elecció directa) no ho són.
 */
export function llegeixRegistre(files: readonly FilaRegistre[]): { ens: EnsDiners[]; nifPerCodi: Map<string, string> } {
  const ens: EnsDiners[] = [];
  const nifPerCodi = new Map<string, string>();
  for (const f of files) {
    const codiEns = codi10(f.codi_ens);
    if (!codiEns || f.dissolt === "S") continue;
    const nif = normalitzaNif(f.cif);
    if (nif) nifPerCodi.set(codiEns, nif);
    const nom = (f.nom_complert ?? "").trim();
    const seuCodiEns = codi10(f.codi_municipi);
    const tipus: TipusEnsDiners | null =
      f.nomtipus === "Províncies"
        ? "diputacio"
        : f.nomtipus === "Comarques" && /^consell comarcal\b/i.test(nom)
          ? "consell"
          : f.nomtipus === "Entitats metropolitanes" && codiEns === CODI_AMB
            ? "amb"
            : null;
    if (tipus && nom) ens.push({ codiEns, nom, tipus, seuCodiEns, nif });
  }
  ens.sort((a, b) => a.codiEns.localeCompare(b.codiEns));
  return { ens, nifPerCodi };
}

export const CONSULTA_REGISTRE = {
  select: "codi_ens,nomtipus,nom_complert,cif,codi_municipi,dissolt",
  where: "nomtipus in ('Comarques','Províncies','Municipis','Entitats metropolitanes')",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Muntatge
// ─────────────────────────────────────────────────────────────────────────────

/** Tot el que s'ha llegit de les quatre fonts, indexat per codi d'ens o per NIF. */
export type Llegit = {
  fcl: ReadonlyMap<string, AnyFcl[]>;
  obres: ReadonlyMap<string, ObraPuosc[]>;
  trameses: ReadonlyMap<string, TramesesDesades>;
  /** `null` si la instantània no s'ha pogut llegir. */
  pendents: { data: string; perNif: ReadonlyMap<string, ConceptePendent[]> } | null;
  nifPerCodi: ReadonlyMap<string, string>;
  anyConsulta: number;
  consultat: string;
};

/**
 * El que es desa per a un ens. `rebFcl` és fals per a les diputacions, que no
 * són destinatàries del fons: aleshores `fcl` és `null` («no li toca»), que no
 * és el mateix que una llista buida («la font no en porta cap any»). Sense NIF
 * al registre no es pot buscar a la instantània, i `pendents` és `null`.
 */
export function muntaDiners(codiEns: string, llegit: Llegit, rebFcl = true): DinersGeneralitatBase {
  const nif = llegit.nifPerCodi.get(codiEns) ?? null;
  const consultat = llegit.consultat;
  return {
    codiEns,
    fcl: rebFcl ? [...(llegit.fcl.get(codiEns) ?? [])] : null,
    obres: ordenaObres(llegit.obres.get(codiEns) ?? []),
    trameses: llegit.trameses.get(codiEns) ?? { ...SENSE_TRAMESES, anys: [] },
    pendents: llegit.pendents && nif ? { data: llegit.pendents.data, conceptes: [...(llegit.pendents.perNif.get(nif) ?? [])] } : null,
    anyConsulta: llegit.anyConsulta,
    fonts: {
      fcl: { ...FONTS_DINERS.fcl, consultat },
      puosc: { ...FONTS_DINERS.puosc, consultat },
      trameses: { ...FONTS_DINERS.trameses, consultat },
      pendents: { ...FONTS_DINERS.pendents, consultat },
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// La feina
// ─────────────────────────────────────────────────────────────────────────────

/** La pausa entre fonts: el portal torna 429 si se l'apreta. */
const PAUSA_MS = 1_500;

const mostra = <T>(llista: readonly T[], n = 15): T[] => llista.slice(0, n);

export async function j41DinersGeneralitat(db: Db): Promise<void> {
  await withRun(db, "J41 diners de la Generalitat", async (run) => {
    const avui = new Date();
    const consultat = avui.toISOString().slice(0, 10);
    const anyConsulta = avui.getUTCFullYear();

    const perCodiEns = new Map<string, number>();
    for (const m of await db.select({ id: municipalities.id, codiEns: municipalities.codiEns }).from(municipalities)) {
      const codi = codi10(m.codiEns);
      if (codi) perCodiEns.set(codi, m.id);
    }

    // ── El registre: els ens amb fitxa i el NIF de tothom.
    const registre = llegeixRegistre(await socrataAll<FilaRegistre>(DATASETS.ensLocals, CONSULTA_REGISTRE));
    run.say(`${registre.ens.length} ens amb fitxa al registre · ${registre.nifPerCodi.size} NIF`);

    // ── El FCL, ja sumat per ens i any.
    await sleep(PAUSA_MS);
    const filesFcl = await socrataAll<FilaFcl>(DATASET_FCL, CONSULTA_FCL);
    run.rowsIn += filesFcl.length;
    const fcl = llegeixFcl(filesFcl);
    if (fcl.repetides.length > 0) {
      await run.issue({ kind: "fcl_fila_repetida", severity: "mitjana", detail: { files: mostra(fcl.repetides, 30), total: fcl.repetides.length } });
    }
    const anysFcl = [...new Set([...fcl.perCodi.values()].flat().map((a) => a.any))].sort((a, b) => a - b);
    run.say(`FCL: ${fcl.perCodi.size} ens, ${anysFcl[0] ?? "?"}-${anysFcl[anysFcl.length - 1] ?? "?"}`);

    // ── El PUOSC, obra a obra.
    await sleep(PAUSA_MS);
    const filesPuosc = await socrataAll<FilaPuosc>(DATASET_PUOSC, { select: CAMPS_PUOSC });
    run.rowsIn += filesPuosc.length;
    const obres = new Map<string, ObraPuosc[]>();
    const illegibles: unknown[] = [];
    const sobrePressupost: unknown[] = [];
    for (const f of filesPuosc) {
      const llegida = llegeixObra(f, anyConsulta);
      if (!llegida) continue;
      obres.set(llegida.codiEns, [...(obres.get(llegida.codiEns) ?? []), llegida.obra]);
      if (llegida.avisos.includes("pressupost_illegible")) illegibles.push({ codiEns: llegida.codiEns, any: llegida.obra.any, pressupost: f.pressupost });
      if (llegida.avisos.includes("subvencio_sobre_pressupost")) {
        sobrePressupost.push({ codiEns: llegida.codiEns, expedient: llegida.obra.expedient, subvencio: f.subvenci_puosc, pressupost: f.pressupost });
      }
    }
    if (illegibles.length > 0) {
      await run.issue({ kind: "puosc_pressupost_illegible", severity: "baixa", detail: { files: mostra(illegibles), total: illegibles.length } });
    }
    if (sobrePressupost.length > 0) {
      await run.issue({ kind: "puosc_subvencio_sobre_pressupost", severity: "baixa", detail: { files: mostra(sobrePressupost), total: sobrePressupost.length } });
    }
    const programades = [...obres.values()].flat().filter((o) => o.estat === "programada").length;
    run.say(`PUOSC: ${filesPuosc.length} obres de ${obres.size} ens · ${programades} anualitats programades (${anyConsulta} o després)`);

    // ── L'inventari de trameses.
    await sleep(PAUSA_MS);
    const filesTrameses = await socrataAll<FilaTramesa>(DATASET_TRAMESES, CONSULTA_TRAMESES);
    run.rowsIn += filesTrameses.length;
    const trameses = llegeixTrameses(filesTrameses);
    const anysTrameses = [...new Set(filesTrameses.map((f) => numero(f.any)).filter((a): a is number => a !== null))].sort((a, b) => a - b);
    run.say(`Trameses: ${trameses.perCodi.size} ens, ${anysTrameses[0] ?? "?"}-${anysTrameses[anysTrameses.length - 1] ?? "?"}`);

    // ── La darrera instantània del que deu la Generalitat.
    await sleep(PAUSA_MS);
    let pendents: Llegit["pendents"] = null;
    const dates = await socrataAll<{ data?: string }>(DATASET_PENDENTS, { select: "data,count(*) as files", group: "data", order: "data DESC" });
    const darrera = dates.map((d) => d.data).find((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}T[\d:.]+$/.test(d));
    if (!darrera) {
      await run.issue({ kind: "pendents_sense_instantania", severity: "mitjana", detail: { efecte: "la fitxa no dirà què li deu la Generalitat" } });
    } else {
      await sleep(PAUSA_MS);
      // La data es posa tal com la torna Socrata, sense escapar res: és un
      // valor del mateix portal i la regex de dalt n'ha comprovat la forma.
      const filesPendents = await socrataAll<FilaPendent>(DATASET_PENDENTS, { select: CAMPS_PENDENTS, where: `data='${darrera}'` });
      run.rowsIn += filesPendents.length;
      pendents = { data: dataCurta(darrera)!, perNif: llegeixPendents(filesPendents) };
      const nifsConeguts = new Set(registre.nifPerCodi.values());
      const orfes = filesPendents
        .filter((f) => f.tipusens === "Ajuntaments" || f.tipusens === "Consells comarcals" || f.tipusens === "Diputacions")
        .filter((f) => !nifsConeguts.has(normalitzaNif(f.nifcreditor) ?? ""))
        .map((f) => ({ nif: f.nifcreditor ?? null, nom: f.nomcreditor ?? null }));
      if (orfes.length > 0) {
        await run.issue({ kind: "pendents_nif_desconegut", severity: "mitjana", detail: { files: mostra(orfes), total: orfes.length } });
      }
      run.say(`Pendents a ${pendents.data}: ${filesPendents.length} files, ${pendents.perNif.size} creditors`);
    }

    const llegit: Llegit = {
      fcl: fcl.perCodi,
      obres,
      trameses: trameses.perCodi,
      pendents,
      nifPerCodi: registre.nifPerCodi,
      anyConsulta,
      consultat,
    };

    // ── Codis que no lliguen amb cap municipi: al FCL només hi ha municipis,
    // comarques i l'AMB, i qualsevol codi que no sigui supramunicipal (8…) ha
    // de ser un municipi; a l'inventari, les files de «Municipis».
    const codisEns = new Set(registre.ens.map((e) => e.codiEns));
    const fclOrfes = [...fcl.perCodi.keys()].filter((c) => !c.startsWith("8") && !perCodiEns.has(c));
    if (fclOrfes.length > 0) await run.issue({ kind: "fcl_municipi_desconegut", severity: "baixa", detail: { codis: mostra(fclOrfes, 30), total: fclOrfes.length } });
    const tramesesOrfes = [...new Set(filesTrameses.filter((f) => f.tipusens === "Municipis").map((f) => codi10(f.codi10)))]
      .filter((c): c is string => c !== null && !perCodiEns.has(c));
    if (tramesesOrfes.length > 0) {
      await run.issue({ kind: "trameses_municipi_desconegut", severity: "baixa", detail: { codis: mostra(tramesesOrfes, 30), total: tramesesOrfes.length } });
    }
    const puoscAltres = [...obres.keys()].filter((c) => !perCodiEns.has(c) && !codisEns.has(c)).length;
    run.say(`PUOSC: ${puoscAltres} ens beneficiaris que no són ni municipi ni ens amb fitxa (EMD, consorcis, mancomunitats…)`);

    // ── Un per municipi.
    let ambFcl = 0;
    let ambObres = 0;
    let ambTrameses = 0;
    let ambPendents = 0;
    for (const [codiEns, municipalityId] of perCodiEns) {
      const dades: DinersGeneralitat = muntaDiners(codiEns, llegit);
      if (dades.fcl && dades.fcl.length > 0) ambFcl += 1;
      if (dades.obres.length > 0) ambObres += 1;
      if (dades.trameses.anys.length > 0) ambTrameses += 1;
      if (dades.pendents && dades.pendents.conceptes.length > 0) ambPendents += 1;
      await desa(db, municipalityId, KIND_DINERS_GENERALITAT, dades);
      run.rowsOut += 1;
    }
    run.say(
      `${perCodiEns.size} municipis: ${ambFcl} amb FCL · ${ambObres} amb obres del PUOSC · ` +
        `${ambTrameses} a l'inventari · ${ambPendents} amb pagaments pendents`,
    );

    // ── Un per ens, al municipi seu.
    const ensDesats: string[] = [];
    for (const ens of registre.ens) {
      const seu = ens.seuCodiEns ? perCodiEns.get(ens.seuCodiEns) : undefined;
      if (seu === undefined) {
        await run.issue({ kind: "diners_generalitat_ens_sense_seu", severity: "alta", entity: ens.nom, detail: { seu: ens.seuCodiEns } });
        continue;
      }
      const dades: DinersGeneralitatEnsDesat = { ...muntaDiners(ens.codiEns, llegit, ens.tipus !== "diputacio"), nom: ens.nom, tipus: ens.tipus };
      if (ens.tipus !== "diputacio" && dades.fcl!.length === 0) {
        await run.issue({ kind: "fcl_ens_sense_files", severity: "mitjana", entity: ens.nom, detail: { codiEns: ens.codiEns } });
      }
      if (dades.trameses.anys.length === 0) {
        await run.issue({ kind: "trameses_ens_sense_files", severity: "mitjana", entity: ens.nom, detail: { codiEns: ens.codiEns } });
      }
      await desa(db, seu, `${PREFIX_KIND_DINERS_GENERALITAT_ENS}${ens.codiEns}`, dades);
      run.rowsOut += 1;
      ensDesats.push(ens.nom);
    }
    run.say(`${ensDesats.length}/${registre.ens.length} ens desats al municipi seu`);

    return {
      consultat,
      anyConsulta,
      anysFcl: anysFcl.length > 0 ? [anysFcl[0], anysFcl[anysFcl.length - 1]] : null,
      anysTrameses: anysTrameses.length > 0 ? [anysTrameses[0], anysTrameses[anysTrameses.length - 1]] : null,
      instantaniaPendents: pendents?.data ?? null,
      municipis: { total: perCodiEns.size, ambFcl, ambObres, ambTrameses, ambPendents },
      ens: ensDesats.length,
      obresProgramades: programades,
    };
  });
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
