import { municipalities, municipalityMetrics, people, councillorMandates, politicalGroups, candidatures, type Db } from "@quivoto/db";
import { and, asc, eq, or, sql } from "drizzle-orm";
import { MANDATE_START } from "../adapters/aoc";
import type { SentitVot as SentitJ12, TipusPunt } from "../adapters/actes";
import {
  INE_BARCELONA,
  PAGINA_MANDAT_2019_2023,
  PAGINA_MANDAT_ACTUAL,
  URL_MANDAT_2019_2023,
  URL_MANDAT_ACTUAL,
  fetchAcordsPlenari,
  type AcordPlenari,
  type Mandat,
  type SentitVot as SentitBarcelona,
} from "../adapters/barcelona";
import { encaixa, type Grup } from "../publish/posicions";
import { normalizePersonName } from "../lib/text";
import { withRun, type Run } from "../lib/run";

/**
 * J16 — què s'ha votat al Plenari de Barcelona, i què hi ha votat cada grup.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PER QUÈ EXISTEIX
 * ─────────────────────────────────────────────────────────────────────────────
 * Barcelona és l'únic municipi gran on J12 no serveix. El que l'AOC hi diposita
 * no són actes sinó **extractes d'acords**: porten què es va aprovar, però no el
 * sentit del vot de ningú. Per això el conjunt de preguntes de Barcelona està
 * bloquejat amb una sola afirmació de vint-i-cinc sostinguda en una acta.
 *
 * L'Ajuntament, en canvi, publica el vot de cada grup de totes les propostes del
 * plenari en dos CSV. L'adaptador `adapters/barcelona.ts` ja els sap llegir des
 * de fa temps i mai no s'havia connectat a res. Això és connectar-lo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DUES FILES, I PER QUÈ
 * ─────────────────────────────────────────────────────────────────────────────
 * `kind: "votacionsPlenari"` és la fila pròpia d'aquesta feina: font, llicència,
 * data de descàrrega, cobertura mesurada de cada mandat, l'avís del retard i el
 * detall sencer del mandat 2019-2023.
 *
 * `kind: "mocions"` és la **mateixa forma que desa J12**. Sense això no serviria
 * de res: tot el `publish/` llegeix `byKind.get("mocions")` i cap altra clau, i
 * canviar-ho voldria dir tocar codi que ara mateix és d'altri. Escrivint-hi la
 * mateixa forma, la fitxa, la demostració i les fitxes de regidor de Barcelona
 * troben el vot per grup sense que ningú hi hagi de canviar una línia.
 *
 * Dues conseqüències que val més dir que amagar:
 *   · Aquesta fila **substitueix** la que J12 hagi pogut deixar per a Barcelona.
 *     És el que volem —el registre oficial de vot per grup val infinitament més
 *     que un extracte sense vots—, però vol dir que executar J12 després de J16
 *     desfà la feina. L'`assistencia`, que surt del capçal de les actes i que
 *     aquest CSV no pot donar, es conserva de la fila anterior en comptes de
 *     perdre's.
 *   · A `mocions` **només hi va el mandat 2023-2027**. Les fitxes de regidor
 *     ensenyen «els vots del seu grup» sense filtrar per data: si hi entressin
 *     les votacions del 2019-2023, a un regidor entrat el 2023 se li atribuirien
 *     vots emesos quan encara no seia al ple. El mandat anterior es desa sencer,
 *     però a la fila pròpia.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA LLICÈNCIA NO ÉS CC BY
 * ─────────────────────────────────────────────────────────────────────────────
 * El fitxer no és al portal de dades obertes: penja de la pàgina d'acords del
 * plenari i s'hi aplica l'avís legal general de l'Ajuntament. Permet reutilitzar
 * amb quatre condicions —no alterar el contingut, no desnaturalitzar-ne el
 * sentit, esmentar la font i no donar a entendre que ens patrocinen— i per això
 * la font, l'adreça i la data de descàrrega es desen **amb les dades** i no en
 * cap document a part: si algú publica un número d'aquí sense la citació, és que
 * no l'ha anat a buscar on toca.
 */

/** Clau pròpia d'aquesta feina. La de J12 («mocions») s'escriu a més a més. */
const KIND_PROPI = "votacionsPlenari";

const FONT = "Votacions del Plenari del Consell Municipal, Ajuntament de Barcelona";

const AVIS_LEGAL = "https://ajuntament.barcelona.cat/ca/avis-legal";

/**
 * Les quatre condicions de l'avís legal, escrites aquí perquè viatgin amb les
 * dades. Una llicència que només és a la documentació no obliga ningú.
 */
const LLICENCIA = {
  nom: "Avís legal de l'Ajuntament de Barcelona",
  url: AVIS_LEGAL,
  esCcBy: false,
  condicions: [
    "no alterar el contingut",
    "no desnaturalitzar-ne el sentit",
    "esmentar la font",
    "no donar a entendre que l'Ajuntament patrocina l'activitat",
  ],
  citacio: `${FONT}. Consultat a ${PAGINA_MANDAT_ACTUAL}`,
} as const;

const METODE =
  "lectura dels dos CSV oficials de votacions del plenari, sense cap model de llenguatge; " +
  "el sentit del vot és el que publica l'Ajuntament, no una deducció nostra";

/**
 * Quan una sessió publicada té més dies que això, la fitxa ha d'advertir-ho.
 * Noranta dies és un trimestre: el plenari ordinari es reuneix cada mes, així
 * que tres mesos de silenci ja no s'expliquen pel calendari.
 */
const DIES_DE_RETARD_QUE_PREOCUPEN = 90;

// ─────────────────────────────────────────────────────────────────────────────
// Traducció de vocabularis
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Del vocabulari de l'adaptador al de J12.
 *
 * Els quatre primers són el mateix vot dit de dues maneres. `no_consta` **no
 * es tradueix**: J12 no té cap valor per a «la font no diu res». El que s'hi
 * assembla, `blanc`, és un vot en blanc emès de veritat («5 en blanc del PSC»,
 * Alcarràs), i convertir un silenci en un vot en blanc seria posar-li a algú una
 * papereta a la mà. Per això val `null` i la cel·la no genera cap vot.
 *
 * A l'inrevés tampoc no hi ha pèrdua: el CSV de Barcelona no té cap valor per al
 * vot en blanc, de manera que `blanc` simplement no hi surt mai.
 *
 * `absent` sí que es conserva. `deLActa()` l'ignora igual que ignora `blanc`
 * —qui no vota no diu res—, però un plantó de sala és un fet i s'ha de poder
 * llegir a la dada.
 */
export const SENTIT_J12: Readonly<Record<SentitBarcelona, SentitJ12 | null>> = {
  a_favor: "favor",
  en_contra: "contra",
  abstencio: "abstencio",
  absent: "absent",
  no_consta: null,
};

export function sentitJ12(sentit: SentitBarcelona): SentitJ12 | null {
  return SENTIT_J12[sentit];
}

/**
 * Etiqueta amb què s'escriu cada grup a la dada desada.
 *
 * No és cosmètica: `encaixa()` ha de poder lligar aquesta etiqueta amb el grup
 * del ple tal com el té la fitxa, i els dos costats escriuen el nom diferent.
 * La fitxa de Barcelona treu els grups del registre de càrrecs municipal, que
 * els escriu amb sigles («PSC», «ERC», «PP»); l'adaptador els canonitza amb el
 * nom llarg («Partit dels Socialistes de Catalunya»). Comparar-los mai no lliga.
 *
 * El que sí que lliga sempre és la **família de sigles**, i per travessar-la cal
 * una forma que `siglesFamily()` reconegui: «PSC» sí, «Partit dels Socialistes
 * de Catalunya» no; i al revés, «Barcelona en Comú» sí (la taula hi busca
 * «encomu» a dins) i «BComú» no. Per això la llista barreja sigles i noms
 * llargs: cadascú hi és en la forma que la taula de marques sap classificar.
 *
 * Les altres formes no es llencen: `alies()` les torna totes i el job tria, ple
 * a la mà, la que de debò hi encaixa. Si no n'hi encaixa cap, ho diu.
 */
const FORMES_DEL_GRUP: Record<string, readonly string[]> = {
  "Barcelona en Comú": ["Barcelona en Comú", "BComú"],
  "Partit dels Socialistes de Catalunya": ["PSC", "Partit dels Socialistes de Catalunya"],
  "Esquerra Republicana": ["ERC", "Esquerra Republicana"],
  "Partit Popular": ["PP", "Partit Popular"],
  VOX: ["VOX", "VOX Barcelona"],
  Junts: ["Junts", "Junts per Barcelona", "Junts per Catalunya", "JxCat"],
  Ciutadans: ["Cs", "Ciutadans"],
  Valents: ["Valents", "BCN Canvi"],
};

/**
 * Totes les maneres conegudes d'escriure un grup, de la més probable a la menys.
 * Serveix per provar-les contra el ple i quedar-se amb la que hi lliga.
 */
export function alies(canonic: string, etiquetaCsv: string = canonic): string[] {
  const formes = [...(FORMES_DEL_GRUP[canonic] ?? [canonic]), canonic, etiquetaCsv];
  return [...new Set(formes.filter((f) => f !== ""))];
}

export function etiquetaPreferida(canonic: string, etiquetaCsv: string = canonic): string {
  return alies(canonic, etiquetaCsv)[0]!;
}

/** El nom canònic d'una etiqueta ja emesa, per poder-ne provar les altres formes. */
function canonicDe(etiqueta: string): string {
  return Object.keys(FORMES_DEL_GRUP).find((c) => alies(c).includes(etiqueta)) ?? etiqueta;
}

/**
 * De quina mena és el punt, amb el vocabulari de J12.
 *
 * Es decideix per `part_acta`, que és el que la font declara, i no pel títol com
 * fa l'extractor d'actes: aquí els títols són resums escrits per l'Ajuntament i
 * no comencen per «Moció del Grup Municipal…», de manera que endevinar-ho pel
 * text donaria pitjor resultat que llegir el camp que ja ho diu.
 */
export function tipusDelAcord(acord: AcordPlenari): TipusPunt {
  if (/declaracions institucionals/i.test(acord.partActa)) return "declaracio";
  if (acord.esImpulsIControl) return "mocio";
  return "acord";
}

// ─────────────────────────────────────────────────────────────────────────────
// D'un acord de Barcelona a un punt en la forma de J12
// ─────────────────────────────────────────────────────────────────────────────

export type VotDesat = { grup: string; sentit: SentitJ12; vots: number | null };

/**
 * La mateixa forma que `PuntDesat` de J12, amb dos camps més que allà no tenen
 * sentit i aquí sí: de quin mandat surt i quina sessió el va votar. Els camps de
 * més no molesten ningú —el `publish/` llegeix per nom— i estalvien haver de
 * tornar a l'origen per saber d'on ve una fila.
 */
export type PuntDesat = {
  data: string;
  codiActa: string;
  url: string;
  numero: string | null;
  titol: string;
  tipus: TipusPunt;
  proposant: string | null;
  resultat: string | null;
  unanimitat: boolean;
  recompte: Record<SentitJ12, number | null> | null;
  vots: VotDesat[];
  cita: string | null;
  mandat: Mandat;
  refPropostes: string[];
};

/** Incidència detectada convertint, per registrar-la fora de la funció pura. */
export type Retret = {
  kind: string;
  entity: string;
  detail: Record<string, unknown>;
};

const PAGINA_DEL_MANDAT: Record<Mandat, string> = {
  "2023-2027": PAGINA_MANDAT_ACTUAL,
  "2019-2023": PAGINA_MANDAT_2019_2023,
};

const CSV_DEL_MANDAT: Record<Mandat, string> = {
  "2023-2027": URL_MANDAT_ACTUAL,
  "2019-2023": URL_MANDAT_2019_2023,
};

/**
 * El vot de cada grup d'un acord, ja en el vocabulari de J12.
 *
 * Dos casos, i el segon és el que rescata la votació més important del mandat:
 *
 *   · **vot per grup** (el 98 % dels acords). Una cel·la per grup i prou. No hi
 *     ha recompte: la font no publica quants regidors hi va posar cadascú, i
 *     omplir-ho amb els escons del grup seria inventar-se una dada que ningú no
 *     ha publicat. Va a `null`, que és com el `publish/` llegeix «tot el grup».
 *   · **vot nominal**. Aquí no hi ha columnes de grup plenes, però sí les de
 *     cada regidor, i la capçalera declara de quin grup és cadascun. Agregar-ho
 *     per grup no és deduir res: és comptar. Amb això, la qüestió de confiança
 *     de la sessió CP 14/25 EXT —l'única votació nominal del mandat— deixa de
 *     ser una fila sense vots i passa a tenir recompte de veritat.
 *
 * Un grup que es parteix en una votació nominal **no emet cap vot**: no té una
 * posició sola i triar-ne la majoritària seria posar-li a la minoria un vot que
 * no va fer. Es registra i s'ignora.
 */
export function votsDelAcord(acord: AcordPlenari): { vots: VotDesat[]; retrets: Retret[] } {
  const retrets: Retret[] = [];

  if (acord.votsGrup.length > 0) {
    // Un mateix grup pot ocupar dues columnes quan la font arrossega el nom vell
    // i el nou («BCN Canvi» i «Valents», tres files del mandat anterior). Si les
    // dues diuen el mateix és una redundància; si es contradiuen, no hi ha
    // manera de saber quina val i no se n'emet cap.
    const perGrup = new Map<string, { etiqueta: string; sentits: Set<SentitJ12> }>();
    for (const vot of acord.votsGrup) {
      const sentit = sentitJ12(vot.sentit);
      if (sentit === null) continue;
      const acumulat = perGrup.get(vot.grup) ?? { etiqueta: vot.etiqueta, sentits: new Set() };
      acumulat.sentits.add(sentit);
      perGrup.set(vot.grup, acumulat);
    }

    const vots: VotDesat[] = [];
    for (const [canonic, { etiqueta, sentits }] of perGrup) {
      if (sentits.size !== 1) {
        retrets.push({
          kind: "barcelona_grup_amb_dos_sentits",
          entity: `${acord.refSessio} · ${canonic}`,
          detail: { sentits: [...sentits], data: acord.data, titol: acord.titol.slice(0, 120) },
        });
        continue;
      }
      vots.push({ grup: etiquetaPreferida(canonic, etiqueta), sentit: [...sentits][0]!, vots: null });
    }
    return { vots, retrets };
  }

  // Votació nominal: el vot del grup és el dels seus regidors, comptats.
  const perGrupNominal = new Map<string, Map<SentitJ12, number>>();
  for (const vot of acord.votsRegidor) {
    const sentit = sentitJ12(vot.sentit);
    if (sentit === null) continue;
    const compte = perGrupNominal.get(vot.grup) ?? new Map<SentitJ12, number>();
    compte.set(sentit, (compte.get(sentit) ?? 0) + 1);
    perGrupNominal.set(vot.grup, compte);
  }

  const vots: VotDesat[] = [];
  for (const [canonic, compte] of perGrupNominal) {
    // Absent i blanc no són una posició: no compten per decidir si el grup s'ha
    // partit ni per al nombre de vots que hi va posar.
    const posicions = [...compte].filter(([sentit]) => sentit !== "absent" && sentit !== "blanc");
    if (posicions.length === 0) continue;
    if (posicions.length > 1) {
      retrets.push({
        kind: "barcelona_grup_partit_en_votacio_nominal",
        entity: `${acord.refSessio} · ${canonic}`,
        detail: {
          repartiment: Object.fromEntries(posicions),
          data: acord.data,
          titol: acord.titol.slice(0, 120),
        },
      });
      continue;
    }
    const [sentit, quants] = posicions[0]!;
    vots.push({ grup: etiquetaPreferida(canonic, canonic), sentit, vots: quants });
  }
  return { vots, retrets };
}

/**
 * El recompte d'una votació nominal. Per a les votacions per grup val `null`:
 * la font no en publica cap xifra i J12 ja té `null` per a això.
 */
export function recompteDelAcord(acord: AcordPlenari): Record<SentitJ12, number | null> | null {
  if (acord.votsRegidor.length === 0) return null;
  const compte: Record<SentitJ12, number | null> = {
    favor: 0,
    contra: 0,
    abstencio: 0,
    blanc: null,
    absent: 0,
  };
  for (const vot of acord.votsRegidor) {
    const sentit = sentitJ12(vot.sentit);
    if (sentit === null || compte[sentit] === null) continue;
    compte[sentit] = (compte[sentit] ?? 0) + 1;
  }
  return compte;
}

/**
 * Un acord del CSV, en la forma que desa J12.
 *
 * `numero` va a `null` a propòsit. J12 hi posa el número del punt de l'ordre del
 * dia i `enllac-actes.ts` l'aparella amb «acord núm. 6» de les evidències,
 * quedant-se'n els dígits. Barcelona no publica cap ordinal: el que hi ha és la
 * referència d'expedient («23XI0095»), de la qual `netejaNumero()` en trauria
 * «23» i la faria coincidir amb l'«acord núm. 23» d'una altra proposta. Un punt
 * sense número no s'aparella; un punt amb un número inventat s'aparella
 * malament, que és molt pitjor. Les referències es desen a `refPropostes`.
 *
 * `cita` és el text literal de l'acord quan la font el publica —el mandat actual
 * sí, l'anterior no—, retallat com el retalla J12. És una citació de debò, no
 * una frase muntada per nosaltres: la llicència demana no alterar el contingut.
 */
export function puntDesat(acord: AcordPlenari): { punt: PuntDesat; retrets: Retret[] } {
  const { vots, retrets } = votsDelAcord(acord);
  return {
    punt: {
      data: acord.data,
      codiActa: acord.refSessio,
      url: PAGINA_DEL_MANDAT[acord.mandat],
      numero: null,
      titol: acord.titol.slice(0, 300),
      tipus: tipusDelAcord(acord),
      proposant: acord.proponent,
      resultat: acord.resultatOriginal,
      unanimitat: acord.resultat === "aprovat_per_unanimitat",
      recompte: recompteDelAcord(acord),
      vots,
      cita: acord.text ? acord.text.slice(0, 400) : null,
      mandat: acord.mandat,
      refPropostes: acord.refPropostes,
    },
    retrets,
  };
}

/**
 * Val la pena desar-lo? Mateixa regla que J12: les mocions i les declaracions hi
 * són sempre —són el que diu què ha volgut fer cada grup— i la resta només si hi
 * consta el vot. Un acord del qual no sabem qui va votar què no respon cap
 * pregunta i només fa créixer el document.
 */
export function valLaPenaDesar(punt: PuntDesat): boolean {
  if (punt.tipus === "mocio" || punt.tipus === "declaracio") return true;
  return punt.vots.length > 0;
}

/** Resum per grup, amb els mateixos camps que el de J12 perquè es pugui comparar. */
export type ResumGrup = {
  grup: string;
  favor: number;
  contra: number;
  abstencio: number;
  blanc: number;
  punts: number;
};

export function resumPerGrup(punts: readonly PuntDesat[]): ResumGrup[] {
  const compte = new Map<string, Omit<ResumGrup, "grup">>();
  for (const punt of punts) {
    for (const vot of punt.vots) {
      const fila = compte.get(vot.grup) ?? { favor: 0, contra: 0, abstencio: 0, blanc: 0, punts: 0 };
      if (vot.sentit !== "absent") fila[vot.sentit] += 1;
      fila.punts += 1;
      compte.set(vot.grup, fila);
    }
  }
  return [...compte]
    .map(([grup, fila]) => ({ grup, ...fila }))
    .sort((a, b) => b.punts - a.punts);
}

/** Quants vots de grup hi ha en una llista de punts. */
export const totalVots = (punts: readonly PuntDesat[]): number =>
  punts.reduce((suma, punt) => suma + punt.vots.length, 0);

/** Cobertura d'un mandat, tal com es publica a la fila pròpia. */
export type CoberturaMandat = {
  mandat: Mandat;
  font: string;
  pagina: string;
  acords: number;
  ambVotDeGrup: number;
  votsDeGrup: number;
  sessions: number;
  primeraSessio: string | null;
  darreraSessio: string | null;
};

export function cobertura(mandat: Mandat, punts: readonly PuntDesat[]): CoberturaMandat {
  const dates = punts.map((p) => p.data).sort();
  return {
    mandat,
    font: CSV_DEL_MANDAT[mandat],
    pagina: PAGINA_DEL_MANDAT[mandat],
    acords: punts.length,
    ambVotDeGrup: punts.filter((p) => p.vots.length > 0).length,
    votsDeGrup: totalVots(punts),
    sessions: new Set(punts.map((p) => p.codiActa)).size,
    primeraSessio: dates[0] ?? null,
    darreraSessio: dates[dates.length - 1] ?? null,
  };
}

/**
 * Quants dies fa de l'última sessió publicada.
 *
 * El fitxer del mandat actual va amb uns cinc mesos de retard —està documentat a
 * l'adaptador i comprovat: l'última sessió publicada és de març del 2026 quan el
 * `Last-Modified` ja és de maig. Això s'ha de desar i s'ha de dir. La fitxa que
 * ensenyi aquestes votacions ha de poder escriure «fins al 27 de març del 2026»
 * en comptes de deixar creure que hi és tot fins avui.
 */
export function retard(darreraSessio: string | null, avui: Date): {
  darreraSessio: string | null;
  dies: number | null;
  preocupant: boolean;
  avis: string | null;
} {
  if (darreraSessio === null) {
    return { darreraSessio: null, dies: null, preocupant: false, avis: null };
  }
  const dies = Math.floor(
    (Date.parse(`${avui.toISOString().slice(0, 10)}T00:00:00Z`) -
      Date.parse(`${darreraSessio}T00:00:00Z`)) /
      86_400_000,
  );
  const preocupant = dies >= DIES_DE_RETARD_QUE_PREOCUPEN;
  return {
    darreraSessio,
    dies,
    preocupant,
    avis: preocupant
      ? `L'Ajuntament publica aquest fitxer amb retard: l'última sessió que hi consta és del ` +
        `${darreraSessio} i fa ${dies} dies. El que s'hi veu arriba fins aquella data, no fins avui.`
      : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// El ple d'avui, per comprovar que les etiquetes hi lliguen
// ─────────────────────────────────────────────────────────────────────────────

type Carrec = { nom?: string; grup?: string | null; equipGovern?: boolean };
type FitxaCarrecs = { carrecs?: Carrec[] };

/**
 * Els grups del ple tal com els veurà el `publish/`.
 *
 * És una còpia curta de `grupsDelPle()`, que viu a `publish/publish.ts` i no
 * s'exporta. Es duplica a consciència: el que es vol comprovar és si les
 * etiquetes que desem lligaran **amb aquelles**, i comprovar-ho contra una altra
 * llista no comprovaria res. Si algun dia `grupsDelPle()` s'exporta, aquesta se
 * n'ha d'anar.
 */
async function grupsDelPle(db: Db, municipalityId: number): Promise<Grup[]> {
  const [fila] = await db
    .select({ data: municipalityMetrics.data })
    .from(municipalityMetrics)
    .where(
      and(
        eq(municipalityMetrics.municipalityId, municipalityId),
        eq(municipalityMetrics.kind, "carrecs"),
      ),
    );
  const carrecs = ((fila?.data as FitxaCarrecs | undefined)?.carrecs ?? []).filter(
    (c): c is Carrec & { nom: string } => typeof c.nom === "string",
  );
  if (carrecs.length === 0) return [];

  const regidors = await db
    .select({ name: people.fullName, sigles: candidatures.sigles })
    .from(councillorMandates)
    .innerJoin(people, eq(people.id, councillorMandates.personId))
    .leftJoin(politicalGroups, eq(politicalGroups.id, councillorMandates.groupId))
    .leftJoin(candidatures, eq(candidatures.id, politicalGroups.candidatureId))
    .where(eq(councillorMandates.municipalityId, municipalityId))
    .orderBy(asc(councillorMandates.orderNum));

  const siglesPerPersona = new Map<string, string>();
  for (const r of regidors) {
    if (r.sigles !== null) siglesPerPersona.set(normalizePersonName(r.name), r.sigles);
  }

  const per = new Map<string, { escons: number; govern: number; sigles: Map<string, number> }>();
  for (const c of carrecs) {
    const nom = c.grup ?? "Sense grup";
    const acumulat = per.get(nom) ?? { escons: 0, govern: 0, sigles: new Map<string, number>() };
    acumulat.escons += 1;
    if (c.equipGovern) acumulat.govern += 1;
    const sigles = siglesPerPersona.get(normalizePersonName(c.nom));
    if (sigles !== undefined) acumulat.sigles.set(sigles, (acumulat.sigles.get(sigles) ?? 0) + 1);
    per.set(nom, acumulat);
  }

  return [...per.entries()].map(([nom, { escons, govern, sigles }]) => {
    const majoritaries = [...sigles.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
    return {
      nom,
      sigles: majoritaries && majoritaries[1] > escons / 2 ? majoritaries[0] : null,
      escons,
      govern: govern === escons && govern > 0,
      color: null,
    };
  });
}

/**
 * Reescriu les etiquetes de grup amb la forma que de debò lliga amb el ple.
 *
 * Cada grup té diverses maneres d'escriure's i quina hi encaixa depèn de com
 * escrigui els noms el registre de càrrecs de l'Ajuntament, que no controlem.
 * En comptes d'endevinar-ho, es proven totes contra el ple d'avui i es desa la
 * que `encaixa()` resol. La que no en resol cap es queda com estava —la dada no
 * es perd— i surt com a incidència, que és exactament el cas que hem de saber.
 */
export function etiquetesQueLliguen(
  punts: readonly PuntDesat[],
  grups: readonly Grup[],
): { canvis: Map<string, string>; senseEncaix: string[] } {
  const canvis = new Map<string, string>();
  const senseEncaix: string[] = [];
  if (grups.length === 0) return { canvis, senseEncaix };

  for (const etiqueta of new Set(punts.flatMap((p) => p.vots.map((v) => v.grup)))) {
    if (encaixa(etiqueta, grups) !== null) continue;
    // L'etiqueta preferida no hi lliga: es proven les altres formes conegudes
    // del mateix grup abans de donar-ho per perdut.
    const alternativa = alies(canonicDe(etiqueta)).find((forma) => encaixa(forma, grups) !== null);
    if (alternativa !== undefined) canvis.set(etiqueta, alternativa);
    else senseEncaix.push(etiqueta);
  }
  return { canvis, senseEncaix };
}

export function aplicaCanvis(punts: PuntDesat[], canvis: ReadonlyMap<string, string>): void {
  if (canvis.size === 0) return;
  for (const punt of punts) {
    for (const vot of punt.vots) vot.grup = canvis.get(vot.grup) ?? vot.grup;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/** Agrupa els retrets iguals perquè una raresa repetida no ompli el registre. */
async function registra(run: Run, municipalityId: number, retrets: readonly Retret[]): Promise<void> {
  const perTipus = new Map<string, Retret[]>();
  for (const retret of retrets) {
    perTipus.set(retret.kind, [...(perTipus.get(retret.kind) ?? []), retret]);
  }
  for (const [kind, llista] of perTipus) {
    await run.issue({
      kind,
      severity: "mitjana",
      municipalityId,
      entity: `${llista.length} acords`,
      detail: { quants: llista.length, exemples: llista.slice(0, 10) },
    });
  }
}

/**
 * Baixa les votacions del plenari de Barcelona i les desa en les dues formes.
 *
 * Són dues peticions a un servidor municipal per a tot el mandat, no una per
 * document com J11-J14: per això aquesta feina sí que pot anar a `all` sense
 * castigar ningú.
 */
export async function j16BarcelonaPlenari(db: Db): Promise<void> {
  await withRun(db, "J16 votacions del plenari de Barcelona", async (run) => {
    const [barcelona] = await db
      .select({ id: municipalities.id, nom: municipalities.name })
      .from(municipalities)
      .where(
        or(
          eq(municipalities.idescat6, INE_BARCELONA),
          eq(municipalities.ine5, INE_BARCELONA.slice(0, 5)),
        ),
      );
    if (!barcelona) {
      // Sense J1 no hi ha municipis i aquesta feina no té on desar res. Es diu i
      // no es peta: la resta de la canonada no depèn d'això.
      await run.issue({
        kind: "municipi_desconegut",
        severity: "alta",
        entity: INE_BARCELONA,
        detail: { motiu: "Barcelona no és a la taula de municipis; executa J1 abans" },
      });
      return { acords: 0 };
    }

    const descarregatEl = new Date().toISOString().slice(0, 10);

    let acords: AcordPlenari[];
    try {
      acords = await fetchAcordsPlenari({ incloureMandatAnterior: true });
    } catch (error) {
      // L'adaptador crida quan la capçalera canvia, quan apareix un sentit de vot
      // nou o quan una fila deixa d'acabar en `;`. És el cas que ha de fer soroll:
      // significa que l'origen ha canviat de forma i que llegir-lo com fins ara
      // atribuiria vots al grup equivocat.
      await run.issue({
        kind: "barcelona_csv_illegible",
        severity: "alta",
        municipalityId: barcelona.id,
        entity: URL_MANDAT_ACTUAL,
        detail: { error: String(error).slice(0, 300), avis: "revisa les columnes del CSV oficial" },
      });
      throw error;
    }
    run.rowsIn = acords.length;

    const retrets: Retret[] = [];
    const tots: PuntDesat[] = [];
    let omesos = 0;
    for (const acord of acords) {
      const { punt, retrets: seus } = puntDesat(acord);
      retrets.push(...seus);
      if (punt.vots.length === 0) {
        // Un acord sense vot no és un error de la font: n'hi ha que només es
        // donen per assabentats. Però és la xifra que diu fins on arriba aquesta
        // via, i per això queda registrada encara que el punt es desi igualment.
        retrets.push({
          kind: "barcelona_acord_sense_vot",
          entity: `${punt.codiActa} · ${punt.data}`,
          detail: { titol: punt.titol.slice(0, 120), resultat: punt.resultat, mandat: punt.mandat },
        });
      }
      if (!valLaPenaDesar(punt)) {
        omesos += 1;
        continue;
      }
      tots.push(punt);
    }

    // Les etiquetes es fixen abans de desar res, i amb el ple d'avui a la mà.
    const grups = await grupsDelPle(db, barcelona.id);
    const { canvis, senseEncaix } = etiquetesQueLliguen(tots, grups);
    aplicaCanvis(tots, canvis);
    if (grups.length === 0) {
      await run.issue({
        kind: "barcelona_ple_desconegut",
        severity: "mitjana",
        municipalityId: barcelona.id,
        entity: barcelona.nom,
        detail: {
          motiu:
            "no hi ha la fitxa de càrrecs de Barcelona (J13): no s'ha pogut comprovar que les " +
            "etiquetes de grup lliguin amb els grups del ple",
        },
      });
    }
    for (const etiqueta of senseEncaix) {
      await run.issue({
        kind: "barcelona_grup_sense_encaix",
        severity: "alta",
        municipalityId: barcelona.id,
        entity: etiqueta,
        detail: {
          motiu: "cap forma coneguda d'aquest grup no lliga amb cap grup del ple",
          grupsDelPle: grups.map((g) => g.nom),
          provades: alies(canonicDe(etiqueta)),
        },
      });
    }

    // El mandat actual va a `mocions`; l'anterior, només a la fila pròpia. El
    // filtre per `MANDATE_START` és el mateix que fa servir J12: el mandat va
    // començar amb el ple de constitució i el que hi ha abans és d'una altra
    // legislatura encara que el CSV el posi al mateix fitxer.
    const actual = tots.filter((p) => p.mandat === "2023-2027" && p.data >= MANDATE_START);
    const anterior = tots.filter((p) => p.mandat === "2019-2023");

    const coberturaActual = cobertura("2023-2027", actual);
    const coberturaAnterior = cobertura("2019-2023", anterior);
    const avisRetard = retard(coberturaActual.darreraSessio, new Date());

    await registra(run, barcelona.id, retrets);
    if (avisRetard.preocupant) {
      await run.issue({
        kind: "barcelona_votacions_endarrerides",
        severity: "mitjana",
        municipalityId: barcelona.id,
        entity: coberturaActual.darreraSessio ?? "",
        detail: { dies: avisRetard.dies, avis: avisRetard.avis, font: URL_MANDAT_ACTUAL },
      });
    }

    const citacio = {
      font: FONT,
      fontUrl: PAGINA_MANDAT_ACTUAL,
      llicencia: LLICENCIA,
      descarregatEl,
      metode: METODE,
    };

    // ── La fila pròpia: font, llicència, cobertura i el mandat anterior sencer.
    await db
      .insert(municipalityMetrics)
      .values({
        municipalityId: barcelona.id,
        kind: KIND_PROPI,
        data: {
          ...citacio,
          mandats: [coberturaActual, coberturaAnterior],
          retard: avisRetard,
          grups: {
            "2023-2027": resumPerGrup(actual),
            "2019-2023": resumPerGrup(anterior),
          },
          acordsSenseVot: retrets.filter((r) => r.kind === "barcelona_acord_sense_vot").length,
          acordsOmesos: omesos,
          grupsSenseEncaix: senseEncaix,
          /**
           * El mandat anterior es desa aquí i no a `mocions` perquè les fitxes de
           * regidor ensenyen els vots del grup sense filtrar per data: barrejats,
           * atribuirien a un regidor entrat el 2023 vots emesos el 2021.
           */
          llistaMandatAnterior: anterior,
        },
        computedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
        set: { data: sql`excluded.data`, computedAt: sql`excluded.computed_at` },
      });
    run.rowsOut += 1;

    // ── La fila que llegeix el `publish/`, en la forma de J12.
    //
    // L'assistència no la pot donar aquest CSV: surt del capçal de les actes i
    // és l'única dada del projecte que és de la persona i no del grup. Si J12 ja
    // n'havia deixat, es conserva en comptes de perdre's en substituir la fila.
    const [previa] = await db
      .select({ data: municipalityMetrics.data })
      .from(municipalityMetrics)
      .where(
        and(
          eq(municipalityMetrics.municipalityId, barcelona.id),
          eq(municipalityMetrics.kind, "mocions"),
        ),
      );
    const assistencia = (previa?.data as { assistencia?: unknown } | undefined)?.assistencia ?? null;

    await db
      .insert(municipalityMetrics)
      .values({
        municipalityId: barcelona.id,
        kind: "mocions",
        data: {
          ...citacio,
          mandatDesDe: MANDATE_START,
          /**
           * «actes» aquí són sessions del plenari, no PDF baixats: aquesta font
           * no són documents sinó un registre de votacions. Es compten les
           * sessions perquè és el que respon la mateixa pregunta que a J12 —de
           * quantes sessions en sabem el vot— i perquè la fitxa de regidor ho
           * fa servir per dir per què la llista és curta.
           */
          actes: {
            indexades: coberturaActual.sessions,
            llegides: coberturaActual.sessions,
            fallides: 0,
            darrera: coberturaActual.darreraSessio,
          },
          punts: {
            desats: actual.length,
            omesos,
            ambVotPerGrup: coberturaActual.ambVotDeGrup,
          },
          grups: resumPerGrup(actual),
          assistencia,
          retard: avisRetard,
          llista: actual,
        },
        computedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
        set: { data: sql`excluded.data`, computedAt: sql`excluded.computed_at` },
      });
    run.rowsOut += 1;

    run.say(
      `mandat 2023-2027: ${coberturaActual.acords} acords desats · ` +
        `${coberturaActual.ambVotDeGrup} amb vot de grup · ${coberturaActual.votsDeGrup} vots · ` +
        `${coberturaActual.sessions} sessions fins al ${coberturaActual.darreraSessio ?? "—"}`,
    );
    run.say(
      `mandat 2019-2023: ${coberturaAnterior.acords} acords · ` +
        `${coberturaAnterior.ambVotDeGrup} amb vot de grup · ${coberturaAnterior.votsDeGrup} vots`,
    );
    if (avisRetard.avis) run.say(avisRetard.avis);
    if (canvis.size > 0) {
      run.say(`etiquetes de grup ajustades al ple: ${[...canvis].map(([a, b]) => `${a}→${b}`).join(", ")}`);
    }
    if (senseEncaix.length > 0) run.say(`grups que no lliguen amb el ple: ${senseEncaix.join(", ")}`);

    return {
      acordsMandatActual: coberturaActual.acords,
      votsMandatActual: coberturaActual.votsDeGrup,
      acordsMandatAnterior: coberturaAnterior.acords,
      votsMandatAnterior: coberturaAnterior.votsDeGrup,
      acordsSenseVot: retrets.filter((r) => r.kind === "barcelona_acord_sense_vot").length,
      acordsOmesos: omesos,
      grupsSenseEncaix: senseEncaix.length,
      darreraSessio: coberturaActual.darreraSessio,
      diesDeRetard: avisRetard.dies,
    };
  });
}
