import { asc, eq, like, sql } from "drizzle-orm";
import {
  candidatures,
  councillorMandates,
  electionParticipation,
  electionResults,
  municipalities,
  municipalityMetrics,
  people,
  type Db,
} from "@quivoto/db";
import { BRANDS_BY_ID, siglesFamily } from "@quivoto/shared-schemas/brands";
import { normalize, normalizePersonName, slugify } from "../lib/text";
import { familiaDelPartit } from "../derive/alcaldies";
import { nomsLliguenAmbInicials } from "../jobs/j30-sous-consells";
import {
  repartimentConsell,
  repartimentDiputacio,
  seientsDiputacio,
  type CandidaturaMunicipi,
  type VotsMunicipi,
} from "../derive/escons-ens";
import { esSeientSenseNom } from "../jobs/j38-ens-supramunicipals";
import { PREFIX_KIND_SUBVENCIONS, type SubvencionsEnsDesades } from "../jobs/j39-subvencions-ens";
import { PREFIX_KIND_SERVEIS_ENS, type ServeisEnsDesats } from "../jobs/j42-serveis-ens";
import { PREFIX_KIND_DINERS_GENERALITAT_ENS, type DinersGeneralitatEnsDesat } from "../jobs/j41-diners-generalitat";
import { indexaDinersGeneralitatEns } from "./cooperacio-fitxa";
import { colorDeCandidatura } from "./llistes-obertes-fitxa";
import { carregaMetriques } from "./metriques";
import { adrecesRegidors, slugRegidor } from "./regidor";
import {
  KIND_CONSELL,
  KIND_DIPUTACIO,
  type DadesEns,
  type EnsDesat,
  type FontEns,
  type MembreDesat,
  type MembreEns,
  type MunicipiEns,
  type RepartimentEns,
  type RetribucioMembre,
  type SubvencionsEns,
} from "./ens-tipus";

/**
 * El carregador de les fitxes de les diputacions i dels consells comarcals.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÈ HI POSA AQUEST FITXER QUE LA J38 NO SAP
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * La J38 desa el que diuen les fonts de l'ens (`EnsDesat`): qui seu al ple, amb
 * quin càrrec i amb quines sigles, i els comptes. El que no pot saber és el que
 * només sap el publicador: a quina adreça viu la fitxa de cada persona, quina
 * cara hi ha a la seu electrònica del seu ajuntament, què en publica el sou la
 * J24 o la J30, i com quedaria el ple si s'apliqués la llei als vots del 2023.
 * Tot això s'hi afegeix aquí i en surt `DadesEns`, que és el que pinten
 * `ens.ts` i `ens-index.ts`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LES REGLES QUE NO ES RELAXEN
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   · **Una persona només s'enllaça si l'aparellament és únic, i dins del seu
 *     municipi.** El nom del membre es busca al ple del municipi que
 *     representa, i si hi lliga amb dues persones —o amb cap— no s'hi posa ni
 *     adreça, ni cara, ni sou. Mai no es busca per tot Catalunya: dos «Joan
 *     Puig» de pobles diferents són dues persones.
 *   · **L'adreça és la que escriu el generador, no una que s'hi assembli.** Es
 *     calcula amb `adrecesRegidors()` sobre la mateixa llista i en el mateix
 *     ordre que `publish.ts` —la seu electrònica quan n'hi ha, el registre
 *     d'electes quan no—, que és el que garanteix que l'enllaç porti a una
 *     pàgina que existeix.
 *   · **El sou és el que publica qui paga.** De la J24 per a les diputacions i
 *     de la J30 per als consells; el màxim per assistències hi va com a sostre i
 *     mai com a import cobrat.
 *   · **Un buit és un buit.** Sense població coneguda de tots els municipis, la
 *     població de l'àmbit és `null`, no una suma a mitges que faria sortir uns
 *     euros per habitant inflats.
 *
 * Les transformacions són funcions pures i exportades, provades a
 * `ens-dades.test.ts` amb fixtures; `loadEns` només fa les consultes —poques i
 * per tipus sencer, com demana PGlite (vegeu `metriques.ts`)— i les hi passa.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Partits: una clau comparable per a «ERC-AM», «ERC» i «Esquerra Republicana»
// ─────────────────────────────────────────────────────────────────────────────

/** El que surt al final de la composició quan no se sap amb quines sigles hi seu. */
export const SENSE_PARTIT = "sense partit conegut";

/**
 * Les sigles curtes de cada família. Les de `PARTY_BRANDS` són els noms
 * oficials sencers, i en una fila de composició «Esquerra Republicana de
 * Catalunya» ocupa tres línies. Són les mateixes que fan servir `vots-partit.ts`
 * i `comarques.ts`, que no les exporten.
 */
const SIGLES_FAMILIA: Readonly<Record<string, string>> = {
  erc: "ERC", junts: "Junts", psc: "PSC", cup: "CUP", comuns: "Comuns",
  pp: "PP", vox: "Vox", cs: "Ciutadans", pdecat: "PDeCAT",
  aliancacat: "Aliança Catalana", ciu: "CiU", podem: "Podem",
  fic: "FIC", te: "Tots per l'Empordà", idselva: "Independents de la Selva",
  idc: "Independents de Catalunya", cda: "CDA",
};

/**
 * El groc pur de la CUP no es veu damunt del paper cru: és el mateix fosquim
 * que ja fan servir el mapa dels 947, les comarques i `vots-partit.ts`.
 */
const COLOR_PROPI: Readonly<Record<string, string>> = { cup: "#d8d000" };

/** Un partit, amb la clau que el fa comparable entre fonts. */
export type PartitComparable = {
  /** El que es mostra i el que es compara: «ERC», «PSC» o les sigles locals tal qual. */
  clau: string;
  /** La família de `PARTY_BRANDS`, si n'és d'alguna. */
  familia: string | null;
};

/**
 * Etiquetes que no són cap partit: el seient té nom però la font no diu amb qui
 * hi seu («No adscrita», «N/A»), o és un regidor que ha deixat el grup. Compten
 * com a seients de partit no conegut; l'etiqueta literal es manté al costat del
 * nom perquè és informació de debò.
 */
const SENSE_GRUP = /^(n\/?a|no adscrit[ao]?s?|regidora? no adscrit[ao]?|no consta|sense grup|-+)$/i;

/**
 * Les etiquetes paraigua de les municipals del 2023: el sufix amb què cada força
 * agrupa les seves llistes locals. És la regla que decideix «Aramoià - AM»,
 * «ENTESA - AM» o «BCN en Comú - C», i va **abans** que el nom del davant:
 *
 *   · «-AM» és l'**Acord Municipal**, la marca municipal d'Esquerra. «ENTESA -
 *     AM» (Sant Pere de Torelló) és ERC encara que «Entesa» soni a ICV: la
 *     Diputació de Barcelona en compta l'alcalde al grup d'ERC-AM
 *     (diba.cat/web/ladiputacio/-/jordi-fabrega-colomer). L'única excepció és
 *     una etiqueta que porta la CUP al davant («SP-CUP-AM», «CUP-AM»): llavors
 *     «AM» és l'Alternativa Municipalista de la CUP.
 *   · «-CM» és la coalició de **Junts** (TriasxBCN-CM, JperSC-CM, JXF-CM).
 *   · «-CP» és la **Candidatura de Progrés** del PSC (PSC-CP, UA-PSC-CP).
 *   · «-C» és la marca municipal dels **Comuns** (BCN en Comú - C, MOVEM ECP - C,
 *     BComúP - C, LHECP-C).
 *   · «-AMUNT» és la de la **CUP** (ACR- SP-AMUNT, CUP-ALL- AMUNT).
 *   · «-ARA PL» és la del **PDeCAT** (CSJ-ARA PL).
 *   · «-TE» i «-IdSELVA» són Tots per l'Empordà i Independents de la Selva.
 *
 * Són els `agrupacio_sigles` dels resultats oficials del 2023 —la Junta Electoral
 * agrupa així les llistes d'una coalició—, i per això el ple i el càlcul de la
 * llei hi coincideixen. Una llista local sense sufix paraigua («TxT», «JxLF»)
 * es decideix pel nom com sempre, i si no és de cap família, és local.
 */
const PARAIGUES: ReadonlyArray<readonly [RegExp, string]> = [
  [/(^|-)amunt$/, "cup"],
  [/(^|-)ara-?pl$/, "pdecat"],
  [/(^|-)cm$/, "junts"],
  [/(^|-)cp$/, "psc"],
  [/(^|-)c$/, "comuns"],
  [/(^|-)am$/, "erc"],
  // Les dues agrupacions gironines: «TFS-TE», «TSF-TE» i l'agrupació «TE» sola
  // són Tots per l'Empordà; «EA - IdSELVA» i «IdSELVA», Independents de la Selva.
  [/(^|-)te$/, "te"],
  [/(^|-)idselva$/, "idselva"],
];

/**
 * Noms de llista que la taula de famílies de `brands.ts` no entén i que al 2023
 * són d'una força sense dubte: «BComúP» i «BComú» (Badalona i Barcelona en
 * Comú), «TriasxBCN» (la llista de Junts a Barcelona) i «Unitat d'Aran», que és
 * la federació aranesa del PSC (es presenta com a «Unitat d'Aran–PSC» i a la
 * Diputació de Lleida seu al grup socialista).
 */
const NOMS_PROPIS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^bcomu/, "comuns"],
  [/^movem/, "comuns"],
  [/^triasxbcn/, "junts"],
  [/^unitat-?d-?aran/, "psc"],
];

/**
 * Etiquetes del registre de plens dels consells que no es poden decidir per la
 * forma i que la validació del càlcul (27-10-2026) va resoldre una a una contra
 * els resultats del 2023: grups comarcals amb nom propi («GCP», «GCC»), la
 * marca antiga de la CUP («CAM», «Alternativa»), Independents pel Solsonès,
 * que es va presentar amb l'agrupació d'Ara Pacte Local, i les maneres com
 * els consells escriuen Ara Pacte Local, Confluència i Tots per l'Empordà. «GCAECP» és una llista
 * local (CEP), encara que acabi en «CP»: `null` vol dir que és local.
 * Clau: l'etiqueta en minúscules sense res que no sigui lletra o xifra.
 */
const ETIQUETES_EXACTES: Readonly<Record<string, string | null>> = {
  gcp: "psc",
  gccp: "psc",
  gcc: "comuns",
  cam: "cup",
  alternativa: "cup",
  indepsolsones: "pdecat",
  gcaecp: null,
  // Ara Pacte Local (l'agrupació del PDeCAT el 2023), escrita de quatre maneres.
  ara: "pdecat",
  apl: "pdecat",
  arapactelocal: "pdecat",
  // Confluència és el nom del grup dels Comuns en alguns consells.
  confluencia: "comuns",
  // Tots per l'Empordà, al Consell Comarcal de l'Alt i del Baix Empordà.
  txe: "te",
  totsemporda: "te",
  // Les dues federacions d'independents: als resultats porten la marca i aquí
  // s'han de dir igual, «FIC» i «Independents de Catalunya».
  fic: "fic",
  idc: "idc",
  // Independents de la Selva: l'agrupació dels resultats és «IdLS», i el
  // Consell Comarcal de la Selva escriu els seus cinc consellers com a «IS».
  // Al registre de plens (27-10-2026) «IS» no surt a cap altre ens; si mai hi
  // sortís amb un altre sentit, s'hauria de decidir per ple, com l'«AM».
  idls: "idselva",
  is: "idselva",
};

/** La clau que es mostra per a una família: les sigles curtes, o el nom de `PARTY_BRANDS`. */
function clauDeFamilia(familia: string, recanvi: string): string {
  return SIGLES_FAMILIA[familia] ?? BRANDS_BY_ID.get(familia)?.name ?? recanvi;
}

/** L'etiqueta en minúscules, sense accents i amb guions com a únic separador. */
function etiquetaCompacta(etiqueta: string): string {
  return etiqueta
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s/+'’]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * La família d'una etiqueta del 2023: primer el sufix paraigua, després els
 * noms propis i, si no, la taula general (`familiaDelPartit`).
 *
 * `etiquetesDelPle` resol l'únic cas que no es pot decidir sol: un «AM» nu. A la
 * majoria de plens és l'Acord Municipal d'ERC; però si el mateix ple ja escriu
 * ERC d'una altra manera («ERC», «ERC-AM»), l'«AM» sol és l'Alternativa
 * Municipalista de la CUP. És la mateixa regla amb què es va validar el càlcul.
 */
function familiaDeLEtiqueta(neta: string, etiquetesDelPle: readonly (string | null)[]): string | null {
  const c = etiquetaCompacta(neta);
  const enganxada = c.replace(/-/g, "");
  if (enganxada in ETIQUETES_EXACTES) return ETIQUETES_EXACTES[enganxada]!;
  if (c === "am") {
    const altraErc = etiquetesDelPle.some((e) => e !== null && /^(erc|erc-am|acord-municipal)$/.test(etiquetaCompacta(e)));
    return altraErc ? "cup" : "erc";
  }
  for (const [patro, familia] of PARAIGUES) {
    if (!patro.test(c)) continue;
    if (familia === "erc" && /(^|-)cup(-|$)/.test(c)) return "cup";
    return familia;
  }
  for (const [patro, familia] of NOMS_PROPIS) if (patro.test(c)) return familia;
  const general = familiaDelPartit(neta);
  return general === "local" ? null : general;
}

/**
 * La clau d'un partit tal com l'escriu una font qualsevol.
 *
 * El registre de plens escriu «ERC-AM», la seu de l'ens «Esquerra Republicana»
 * i els resultats del 2023 «ERC-AM» o «AM» segons el poble. Si cadascuna fos
 * una fila, la composició del ple diria que ERC hi té tres grups. La família
 * (sufix paraigua, noms propis i `familiaDelPartit`) les ajunta; el que no és de
 * cap família és una llista local i es queda amb les seves sigles, que és el
 * que és. `null` vol dir que la font no diu res, o que diu «No adscrita» o
 * «N/A», que tampoc no és cap partit.
 */
export function partitComparable(
  etiqueta: string | null | undefined,
  etiquetesDelPle: readonly (string | null)[] = [],
): PartitComparable | null {
  if (etiqueta === null || etiqueta === undefined) return null;
  const neta = etiqueta.replace(/\s+/g, " ").trim();
  if (neta === "" || SENSE_GRUP.test(neta)) return null;
  const familia = familiaDeLEtiqueta(neta, etiquetesDelPle);
  if (familia !== null) return { clau: clauDeFamilia(familia, neta), familia };
  return { clau: neta, familia: null };
}

/** La clau de grup d'un membre: la de la composició, o `SENSE_PARTIT`. */
export function grupDe(etiqueta: string | null | undefined, etiquetesDelPle: readonly (string | null)[] = []): string {
  return partitComparable(etiqueta, etiquetesDelPle)?.clau ?? SENSE_PARTIT;
}

/**
 * El color de dada d'un partit: el de la seva família, o cap. Mai un color de
 * veredicte; una llista local no en té, i val més gris que inventar-n'hi un.
 */
export function colorDePartit(partit: PartitComparable | null): string | null {
  if (partit === null || partit.familia === null) return null;
  return COLOR_PROPI[partit.familia] ?? colorDeCandidatura(partit.clau) ?? BRANDS_BY_ID.get(partit.familia)?.color ?? null;
}

/**
 * Els escons per partit, de més a menys, amb els que no se sap el partit al
 * final i en una sola fila.
 *
 * Es compta sobre els membres que publica la font i no sobre `seients`: si la
 * font no dona els noms (la Diputació de Barcelona al registre de plens, per
 * exemple), no hi ha composició i la llista és buida. Un empat d'escons
 * s'ordena per nom, que no vol dir res i per això és neutral.
 */
export function composicioDe(membres: readonly { partit: string | null }[]): DadesEns["composicio"] {
  const perClau = new Map<string, { partit: string; seients: number; color: string | null }>();
  const etiquetes = membres.map((m) => m.partit);
  let sensePartit = 0;
  for (const membre of membres) {
    const partit = partitComparable(membre.partit, etiquetes);
    if (partit === null) {
      sensePartit += 1;
      continue;
    }
    const fila = perClau.get(partit.clau) ?? { partit: partit.clau, seients: 0, color: colorDePartit(partit) };
    fila.seients += 1;
    perClau.set(partit.clau, fila);
  }
  const files = [...perClau.values()].sort(
    (a, b) => b.seients - a.seients || a.partit.localeCompare(b.partit, "ca"),
  );
  if (sensePartit > 0) files.push({ partit: SENSE_PARTIT, seients: sensePartit, color: null });
  return files;
}

/**
 * Un color de dada que es pot escriure dins d'un `style` sense por: només
 * hexadecimals de tres o sis xifres. El color ve d'una taula nostra, però és
 * l'únic camp de les fitxes que va a parar dins d'una declaració CSS, i un punt
 * i coma de més hi podria colar qualsevol cosa. Sense color vàlid, el gris de
 * «no se sap», que no vol dir res.
 */
export const GRIS_ENS = "#9a9a9a";
export function colorSegur(color: string | null | undefined): string {
  return color && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color) ? color : GRIS_ENS;
}

// ─────────────────────────────────────────────────────────────────────────────
// Diners: la despesa que obre la fitxa i l'índex
// ─────────────────────────────────────────────────────────────────────────────

/** Els capítols de despesa no financera (1 a 7): sense préstecs ni amortitzacions. */
const CAPITOLS_NO_FINANCERS = new Set([1, 2, 3, 4, 5, 6, 7]);
/** Els capítols sense els quals un exercici no es pot donar per liquidat: personal, béns i serveis, transferències. */
const CAPITOLS_PRINCIPALS = [1, 2, 4] as const;

/** La despesa de l'últim exercici, tal com l'ensenyen la fitxa i l'índex. */
export type UltimaDespesa = { any: number; total: number; perHabitant: number | null; parcial: boolean };

/**
 * La despesa liquidada de l'últim exercici que es pot donar per bo. La fan
 * servir la capçalera de la fitxa i l'índex, i per això és aquí i és una sola.
 *
 *   · **Despesa no financera**: la suma dels capítols 1 a 7. Els capítols 8 i
 *     9 són préstecs i amortitzacions: la Diputació de Lleida «gasta» 27,8 M€
 *     més el 2025 perquè torna deute, i la de Barcelona n'hi suma 180 de
 *     préstecs nous. Comptar-los com a despesa faria salts que no són res.
 *   · **Quin any**: el més recent on hi ha els tres capítols principals (1, 2 i
 *     4) amb import. Un capítol menor sense import no compta com a zero ni fa
 *     descartar l'any; simplement no se suma.
 *   · **Parcial**: l'exercici és el que encara s'està tancant (l'any anterior
 *     al de la consulta, o posterior) i porta menys capítols de despesa amb
 *     import que l'exercici d'abans. Passa amb el 2025 d'alguns ens, que l'AOC
 *     carrega a mesura que arriben les liquidacions.
 *   · **Per habitant**: sobre la població de l'àmbit; `null` si no se sap.
 */
export function ultimaDespesa(d: DadesEns): UltimaDespesa | null {
  const anys = d.finances?.anys ?? [];
  const despeses = (a: (typeof anys)[number]) =>
    a.capitols.filter((c) => c.tipus === "despeses" && c.liquidat !== null);
  const valids = anys.filter((a) => {
    const caps = despeses(a);
    return CAPITOLS_PRINCIPALS.every((n) => caps.some((c) => c.capitol === n));
  });
  if (valids.length === 0) return null;
  const ex = valids.reduce((a, e) => (e.any > a.any ? e : a));
  const total = despeses(ex)
    .filter((c) => CAPITOLS_NO_FINANCERS.has(c.capitol))
    .reduce((s, c) => s + c.liquidat!, 0);
  const anyConsulta = Number(String(d.consultat ?? "").slice(0, 4));
  const abans = anys.find((a) => a.any === ex.any - 1);
  const parcial =
    Number.isFinite(anyConsulta) && ex.any >= anyConsulta - 1 && abans !== undefined && despeses(ex).length < despeses(abans).length;
  return { any: ex.any, total, perHabitant: d.poblacio && d.poblacio > 0 ? total / d.poblacio : null, parcial };
}

// ─────────────────────────────────────────────────────────────────────────────
// Persones: l'aparellament únic dins del municipi
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Les claus amb què es pot buscar un nom. Algunes fonts de l'ens l'escriuen
 * «COGNOMS, NOM»; si hi ha una coma, també es prova girat. Com que després es
 * demana que entre totes les claus només lligui **una** persona, provar-ne dues
 * no afluixa la regla.
 */
export function clausDeNom(nom: string): string[] {
  const claus = new Set<string>();
  const directa = normalizePersonName(nom);
  if (directa !== "") claus.add(directa);
  const coma = nom.indexOf(",");
  if (coma > 0) {
    const girat = normalizePersonName(`${nom.slice(coma + 1)} ${nom.slice(0, coma)}`);
    if (girat !== "") claus.add(girat);
  }
  return [...claus];
}

/**
 * L'única entrada de la llista que porta aquest nom, o `null` si n'hi ha cap o
 * més d'una. És la regla de tot el projecte: si el nom pot ser de dues
 * persones, no és de cap.
 */
export function aparellaUnic<T extends { nom: string }>(nom: string, llista: readonly T[]): T | null {
  const claus = new Set(clausDeNom(nom));
  if (claus.size === 0) return null;
  const iguals = llista.filter((p) => claus.has(normalizePersonName(p.nom)));
  return iguals.length === 1 ? iguals[0]! : null;
}

/** Una persona del ple municipal, amb l'adreça de la seva fitxa i la cara. */
export type PersonaPle = {
  nom: string;
  /** `regidor/<slug>/`, relativa a `m/<municipi>/`; `null` si no és segura. */
  adreca: string | null;
  foto: string | null;
};

/** El que la seu electrònica publica de cada persona del ple (mètrica `carrecs`). */
export type CarrecSeu = { nom: string; foto?: string | null; fotoPetita?: string | null };

/**
 * El ple d'un municipi tal com en surten les fitxes de persona.
 *
 * La llista és la que fa servir `publish.ts`: la de la seu electrònica quan en
 * té, i la del registre d'electes (per número d'ordre) als 483 pobles on no.
 * L'adreça surt de `adrecesRegidors()` sobre aquesta llista i en aquest ordre.
 *
 * Amb la del registre hi ha una cautela de més: el sufix «-2» que posa
 * `adrecesRegidors()` quan dos noms fan el mateix slug depèn de l'ordre, i
 * l'ordre per número del registre pot tenir empats. Si el slug d'una persona no
 * és únic al ple, no s'hi posa adreça; a la seu electrònica l'ordre és el de la
 * llista desada, que és fix, i no cal.
 */
export function pleDe(
  seu: readonly CarrecSeu[] | null | undefined,
  registre: readonly { nom: string }[],
): PersonaPle[] {
  if (seu && seu.length > 0) {
    const adreces = adrecesRegidors(seu);
    return seu.map((c) => ({
      nom: c.nom,
      adreca: `regidor/${adreces.get(c)!}/`,
      foto: c.fotoPetita ?? c.foto ?? null,
    }));
  }
  const adreces = adrecesRegidors(registre);
  const vegades = new Map<string, number>();
  for (const r of registre) vegades.set(slugRegidor(r.nom), (vegades.get(slugRegidor(r.nom)) ?? 0) + 1);
  return registre.map((r) => ({
    nom: r.nom,
    adreca: vegades.get(slugRegidor(r.nom)) === 1 ? `regidor/${adreces.get(r)!}/` : null,
    foto: null,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Retribucions: el que publica l'ens que paga (J24, J30)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El càrrec a l'ens tal com el desen la J24 (`sousDiputacions`, a dins de
 * `diputacio`) i la J30 (`sousConsells`, a dins de `consell`): la mateixa forma
 * a totes dues. Es llegeix sense refiar-se'n, perquè ve d'un JSON de la base.
 */
type CarrecRetribuit = {
  ens: string;
  dedicacio: string | null;
  retribucioAnualBruta: number | null;
  maximPerAssistencies: number | null;
  motiu: string | null;
  font: { nom: string; url: string; llicencia?: string | null; consultat?: string | null };
};

type PersonaRetribuida = { nom: string; diputacio?: CarrecRetribuit; consell?: CarrecRetribuit };

function personesRetribuides(metrica: unknown): PersonaRetribuida[] {
  if (typeof metrica !== "object" || metrica === null) return [];
  const persones = (metrica as { persones?: unknown }).persones;
  if (!Array.isArray(persones)) return [];
  return persones.filter(
    (p): p is PersonaRetribuida => typeof p === "object" && p !== null && typeof (p as PersonaRetribuida).nom === "string",
  );
}

/**
 * Si el text de la font diu, amb paraules, que la persona no cobra res d'aquest
 * ens: «Sense retribucions», «No percep retribució». La J30 el desa com a motiu
 * citat (no hi ha cap import que llegir), i deixar-lo com a «no consta» diria
 * el contrari del que diu la font. Aquí és un zero de debò —la font l'afirma—,
 * no un buit convertit en zero; la pàgina el diu «no cobra res d'aquest ens».
 */
export function diuQueNoCobra(motiu: string | null | undefined): boolean {
  if (!motiu) return false;
  const citat = motiu.match(/«([^»]*)»/)?.[1] ?? "";
  return /^\s*(sense retribuci|no percep (cap )?retribuci|sense dedicaci[oó] ni retribuci|no retribu[iï]t)/i.test(citat);
}

/**
 * El sou d'un membre de l'ens, de la mètrica del municipi que representa.
 *
 * La J24 i la J30 ja han aparellat el ple de l'ens amb el ple municipal, i
 * desen la fila al municipi de la persona amb el nom **del ple municipal**.
 * Aquí només cal tornar-la a trobar: pel nom (únic, com sempre) i pel nom de
 * l'ens, perquè una mateixa persona pot ser a la diputació i al consell. Si el
 * nom de l'ens no és lletra per lletra el nostre, n'hi ha prou que acabi amb el
 * territori, i si així n'hi lliguen dues, no se'n tria cap.
 *
 * `nomAlPle` és el nom amb què la persona seu al ple municipal, si s'ha
 * aparellat; si no, el de la font de l'ens.
 */
export function retribucioDe(
  ens: { tipus: EnsDesat["tipus"]; nom: string; territori: string },
  nomAlPle: string,
  metrica: unknown,
): RetribucioMembre | null {
  const camp = ens.tipus === "diputacio" ? "diputacio" : "consell";
  const ambCarrec = personesRetribuides(metrica).filter((p) => p[camp] && typeof p[camp]!.ens === "string");
  const nomEns = normalize(ens.nom);
  const territori = normalize(ens.territori);
  const exactes = ambCarrec.filter((p) => normalize(p[camp]!.ens) === nomEns);
  const candidates = exactes.length > 0 ? exactes : ambCarrec.filter((p) => normalize(p[camp]!.ens).endsWith(territori));
  const persona = aparellaUnic(nomAlPle, candidates);
  if (persona === null) return null;
  const c = persona[camp]!;
  const anualBrut = typeof c.retribucioAnualBruta === "number" ? c.retribucioAnualBruta : null;
  return {
    anualBrut: anualBrut === null && diuQueNoCobra(c.motiu) ? 0 : anualBrut,
    dedicacio: c.dedicacio ?? null,
    sostreAssistencies: typeof c.maximPerAssistencies === "number" ? c.maximPerAssistencies : null,
    motiu: c.motiu ?? null,
    font: c.font && typeof c.font.url === "string"
      ? { nom: c.font.nom, url: c.font.url, llicencia: c.font.llicencia ?? null, consultat: c.font.consultat ?? null }
      : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Territori: adreces, municipis de l'àmbit i comarques
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El tros d'adreça de l'ens: «barcelona», «alt-camp». El d'un consell ha de
 * ser exactament el de la pàgina de la seva comarca (`c/<slug>/` a
 * `comarques.ts`, que fa `slugify()` del nom de la comarca), perquè la fitxa
 * del consell viu a dins: `c/alt-camp/consell/`.
 */
export function slugEns(d: Pick<EnsDesat, "tipus" | "territori">): string {
  // Les comarques de la base van sense article («Selva», «Garrigues») i les
  // seves pàgines també: si una font escrivís «la Selva», l'article fora.
  return slugify(d.territori.trim().replace(/^(el|la|els|les)\s+|^l['’]\s*/i, ""));
}

/** Un municipi de la nostra base, amb el que en fa servir aquest carregador. */
export type MunicipiBase = {
  id: number;
  slug: string;
  nom: string;
  comarca: string | null;
  provincia: string | null;
  /** Codi INE de cinc xifres: les dues primeres són la província. */
  ine5: string;
  poblacio: number | null;
};

/** Els prefixos INE de cada província, la manera que no depèn de com s'escrigui el nom. */
const PREFIX_PROVINCIA: Readonly<Record<string, string>> = {
  barcelona: "08", girona: "17", lleida: "25", tarragona: "43",
};

/** El nom d'un territori per comparar-lo: sense accents ni article al davant. */
function territoriComparable(nom: string): string {
  return normalize(nom).replace(/^(el|la|els|les|l)\s+/, "");
}

/** Els municipis de la nostra base que són de l'àmbit de l'ens. */
export function municipisDeLAmbit(ens: Pick<EnsDesat, "tipus" | "territori" | "districtes">, base: readonly MunicipiBase[]): MunicipiBase[] {
  const territori = territoriComparable(ens.territori);
  if (ens.tipus === "consell") return base.filter((m) => m.comarca !== null && territoriComparable(m.comarca) === territori);
  const prefix = PREFIX_PROVINCIA[territori];
  const daProvincia = base.filter(
    (m) => (prefix !== undefined && m.ine5.startsWith(prefix)) || (m.provincia !== null && territoriComparable(m.provincia) === territori),
  );
  if (daProvincia.length > 0 || !ens.districtes) return daProvincia;
  // Sense prefix ni nom de província que hi lligui, els districtes de la J38
  // diuen igualment qui hi va.
  const ids = new Set(ens.districtes.flatMap((d) => d.municipalityIds));
  return base.filter((m) => ids.has(m.id));
}

/**
 * Les files de municipis de la fitxa, la població de l'àmbit i les comarques.
 *
 * Les files van de més a menys habitants —com a la pàgina de comarca— amb
 * quants membres de l'ens en surten. La població és la suma del padró i és
 * `null` si a algun municipi li falta: una suma a mitges faria uns euros per
 * habitant que no són de ningú.
 */
export function territoriDe(
  ens: Pick<EnsDesat, "tipus" | "territori" | "districtes">,
  base: readonly MunicipiBase[],
  membres: readonly Pick<MembreDesat, "municipalityId">[],
): Pick<DadesEns, "municipis" | "poblacio" | "comarca" | "comarques"> {
  const dins = municipisDeLAmbit(ens, base);
  const perMunicipi = new Map<number, number>();
  for (const m of membres) {
    if (m.municipalityId !== null) perMunicipi.set(m.municipalityId, (perMunicipi.get(m.municipalityId) ?? 0) + 1);
  }
  // Un zero només es pot afirmar si sabem d'on és tothom: amb un sol membre
  // sense municipi conegut (o sense cap nom), potser és d'aquí. Llavors els
  // municipis que no en tenen cap de conegut porten `null`, no 0.
  const totsConeguts = membres.length > 0 && membres.every((m) => m.municipalityId !== null);
  const municipis: MunicipiEns[] = dins
    .map((m) => ({
      slug: m.slug,
      nom: m.nom,
      comarca: m.comarca,
      poblacio: m.poblacio,
      membres: perMunicipi.get(m.id) ?? (totsConeguts ? 0 : null),
    }))
    .sort((a, b) => (b.poblacio ?? -1) - (a.poblacio ?? -1) || a.nom.localeCompare(b.nom, "ca"));
  const poblacio =
    dins.length === 0 || dins.some((m) => m.poblacio === null) ? null : dins.reduce((s, m) => s + m.poblacio!, 0);

  const nomsComarca = [...new Set(dins.map((m) => m.comarca).filter((c): c is string => c !== null))].sort((a, b) =>
    a.localeCompare(b, "ca"),
  );
  if (ens.tipus === "consell") {
    const nom = nomsComarca[0] ?? ens.territori;
    return { municipis, poblacio, comarca: { slug: slugify(nom), nom }, comarques: [] };
  }
  return { municipis, poblacio, comarca: null, comarques: nomsComarca.map((nom) => ({ slug: slugify(nom), nom })) };
}

/**
 * El consell i la diputació d'un municipi, pel seu slug: els que el tenen a la
 * llista de municipis de l'àmbit. Al Barcelonès no hi ha consell (dissolt el
 * 2019) i al Lluçanès encara no, i per això el consell pot ser `null`.
 */
export function ensDeMunicipi(
  llista: readonly DadesEns[],
  slug: string,
): { consell: DadesEns | null; diputacio: DadesEns | null } {
  const de = (tipus: DadesEns["tipus"]): DadesEns | null =>
    llista.find((e) => e.tipus === tipus && e.municipis.some((m) => m.slug === slug)) ?? null;
  return { consell: de("consell"), diputacio: de("diputacio") };
}

// ─────────────────────────────────────────────────────────────────────────────
// Subvencions: el RAISC de la J39, amb el municipi resolt
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Repara l'apòstrof que el RAISC perd en alguns títols: «Subvencions
 * d?ajuntaments», «l?Ajuntament». El conjunt arriba amb un «?» on hi havia un
 * apòstrof tipogràfic que no ha passat per la conversió de caràcters. Només es
 * toca el patró inequívoc —«d», «l», «D» o «L» soles davant del «?» i una vocal
 * o «h» darrere—; qualsevol altre «?» es queda tal com ve, perquè pot ser una
 * pregunta de debò.
 */
export function reparaApostrof(titol: string): string {
  return titol.replace(/(^|[\s(«"])([dlDL])\?(?=[aeiouàèéíòóúhAEIOUÀÈÉÍÒÓÚH])/g, "$1$2'");
}

/**
 * Les subvencions de l'ens als ajuntaments, amb cada `municipalityId` convertit
 * en l'adreça i el nom de la fitxa del municipi.
 *
 * Els imports passen tal com són: un `null` de la J39 és un any sense cap
 * concessió registrada a aquell CIF, i continua sent un buit. Un ajuntament que
 * no trobem a la base (no n'hi hauria d'haver cap) no s'inventa: es deixa fora.
 * Hi viatgen també les agències que la J39 exclou, el recompte de registres
 * propis de l'ens i el que registra amb el beneficiari amagat: sense aquests
 * dos, la pàgina de Tarragona diria que no reparteix res.
 */
export function subvencionsDe(
  desades: SubvencionsEnsDesades | null | undefined,
  municipis: ReadonlyMap<number, Pick<MunicipiBase, "slug" | "nom" | "poblacio">>,
): SubvencionsEns | null {
  if (!desades || !Array.isArray(desades.anys) || !Array.isArray(desades.perAjuntament)) return null;
  const perMunicipi: SubvencionsEns["perMunicipi"] = [];
  for (const fila of desades.perAjuntament) {
    const m = municipis.get(fila.municipalityId);
    if (!m) continue;
    perMunicipi.push({ slug: m.slug, nom: m.nom, poblacio: m.poblacio, imports: [...fila.imports] });
  }
  perMunicipi.sort((a, b) => a.nom.localeCompare(b.nom, "ca"));
  return {
    anys: [...desades.anys],
    perMunicipi,
    convocatories: (desades.convocatories ?? []).map((c) => ({ titol: reparaApostrof(c.titol), import: c.import, concessions: c.concessions })),
    font: desades.font as FontEns,
    agenciesExcloses: [...(desades.agenciesExcloses ?? [])],
    concessionsEns: Array.isArray(desades.concessionsEns) ? [...desades.concessionsEns] : null,
    noPublicable: Array.isArray(desades.noPublicable)
      ? desades.noPublicable.map((n) => ({ import: n.import, concessions: n.concessions }))
      : null,
  };
}

/** Àlies antic: el contracte ja porta `agenciesExcloses`. */
export type SubvencionsAmbExclusions = SubvencionsEns;

// ─────────────────────────────────────────────────────────────────────────────
// Vots del 2023: l'entrada del repartiment que fa la llei
// ─────────────────────────────────────────────────────────────────────────────

/** Una candidatura del 2023 tal com surt de la base. */
export type FilaResultat2023 = {
  municipalityId: number;
  sigles: string;
  /** La marca resolta pel codi d'agrupació electoral, si n'hi ha. */
  brandId: string | null;
  /**
   * Les sigles de l'agrupació de la Generalitat («AM», «CM», «PSC-CP», «C»,
   * «AMUNT», «ALTRES»…): és com la Junta Electoral ajunta les llistes d'una
   * mateixa coalició a l'hora de repartir.
   */
  agrupacioSigles?: string | null;
  vots: number;
  regidors: number;
  /**
   * Candidats titulars, per a la regla dels pobles de llista oberta. Els vots
   * de la base ja són el vot de candidatura que publica el Ministeri (ja
   * dividit), i per això el carregador hi passa `null`: dividir-los un altre
   * cop els faria quatre vegades més petits (vegeu `derive/escons-ens.ts`).
   */
  candidats: number | null;
};

/**
 * Les agrupacions del 2023 que són la marca municipal d'una família, i només
 * aquestes. Clau: les sigles de l'agrupació en la forma de `llistaComparable`;
 * valor: la família de `PARTY_BRANDS`.
 *
 * És una taula tancada, i no `partitComparable`, perquè als resultats cada
 * agrupació és una candidatura diferent per a la Junta Electoral encara que el
 * nom s'assembli al d'una família, i el repartiment les ha de comptar per
 * separat. Al 2023 n'hi ha quatre que la regla dels sufixos feia d'una família
 * i no ho són:
 *
 *   · «AM-LVDVDM» és Ara Montbui - la Veu dels Veïns de Montbui, una llista
 *     local de Santa Margarida de Montbui. El sufix «-AM» la sumava a ERC, i
 *     amb aquests 2.577 vots ERC passava per davant de Junts al districte
 *     d'Igualada: s'enduia l'únic escó del districte a la Diputació de
 *     Barcelona (el ple: Junts 12, ERC 11) i dos consellers de més a l'Anoia,
 *     on Ara Montbui en té un de propi.
 *   · «JUNTS» és Junts per Tiana i «JUNTS per SFC», Junts per Sant Feliu de
 *     Codines: dues agrupacions d'electors pròpies.
 *   · «CUP-AMUNT» és la CUP del Figueró, inscrita a part de l'agrupació AMUNT.
 *
 * Comptar cada agrupació per separat és el que va fer la validació del càlcul
 * (27-10-2026; vegeu `derive/escons-ens.ts`), i amb què quadren les quatre
 * diputacions. Una agrupació que no és aquí es queda amb les seves sigles.
 */
const AGRUPACIONS_DE_FAMILIA: Readonly<Record<string, string>> = {
  PSCCP: "psc",
  CM: "junts",
  AM: "erc",
  C: "comuns",
  AMUNT: "cup",
  ARAPL: "pdecat",
  PP: "pp",
  VOX: "vox",
  CS: "cs",
  ALIANCACAT: "aliancacat",
  TE: "te",
  IDLS: "idselva",
  FIC: "fic",
  IDC: "idc",
  CDAPNA: "cda",
};

/**
 * La clau de partit d'una candidatura del 2023, la mateixa que la de la
 * composició perquè els escons calculats i els reals es puguin comparar.
 *
 *   1. **Les sigles de l'agrupació**, si n'hi ha i no és «ALTRES»: és com la
 *      Junta Electoral ajunta les llistes d'una coalició («AM», «CM»,
 *      «PSC-CP», «C», «AMUNT», «TE»). Si l'agrupació és la marca d'una
 *      família (`AGRUPACIONS_DE_FAMILIA`), la clau és la de la família, la
 *      mateixa que en treu `partitComparable` a la composició; si no, les
 *      sigles de l'agrupació tal qual, perquè és una candidatura a part. Va
 *      per davant de la marca perquè és el que es va validar contra els plens.
 *   2. **Les sigles de la llista tal qual**, si l'agrupació és «ALTRES»: una
 *      llista local és ella mateixa, encara que la marca s'hagi resolt a una
 *      família.
 *   3. Sense agrupació (dades antigues), la marca del codi d'agrupació si no
 *      és local; si no, les sigles.
 */
export function partitDelResultat(sigles: string, brandId: string | null, agrupacioSigles: string | null = null): string {
  const agrupacio = agrupacioSigles?.trim() ?? "";
  if (agrupacio !== "" && agrupacio.toUpperCase() !== "ALTRES") {
    const familia = AGRUPACIONS_DE_FAMILIA[llistaComparable(agrupacio)];
    return familia ? clauDeFamilia(familia, agrupacio) : agrupacio;
  }
  if (agrupacio !== "") return sigles.trim();
  if (brandId !== null && brandId !== "local") return clauDeFamilia(brandId, sigles.trim());
  if (brandId === "local") return sigles.trim();
  return partitComparable(sigles)?.clau ?? sigles.trim();
}

/** Blancs i nuls d'un municipi el 2023 (`election_participation`). */
export type Participacio2023 = { blancs: number | null; nuls: number | null };

/**
 * Els vots de cada municipi en la forma que demana `derive/escons-ens.ts`.
 *
 * La població que s'hi posa és la del **padró de l'1 de gener del 2022**, que
 * és amb el que es va convocar l'elecció (RD 1037/2022) i, per tant, el que va
 * fixar els escons de cada ens i de cada districte: amb el del 2025, la
 * Diputació de Barcelona dona un escó de més al PSC i un de menys a ERC. El
 * mapa `municipis` ha de portar ja aquesta població; un municipi sense
 * resultats no hi és (no se li posen zeros), ni un sense padró.
 *
 * Els blancs i els nuls hi van perquè els consells els fan servir: la barrera
 * del 3 % es mira sobre els vots emesos i la puntuació sobre els vàlids. Dues
 * llistes del mateix poble que caiguin a la mateixa clau es queden separades:
 * les suma el càlcul.
 */
export function votsPerMunicipi(
  files: readonly FilaResultat2023[],
  municipis: ReadonlyMap<number, Pick<MunicipiBase, "poblacio">>,
  participacio: ReadonlyMap<number, Participacio2023> = new Map(),
): Map<number, VotsMunicipi> {
  const sortida = new Map<number, VotsMunicipi>();
  for (const f of files) {
    const m = municipis.get(f.municipalityId);
    if (!m || m.poblacio === null) continue;
    const p = participacio.get(f.municipalityId);
    const vots = sortida.get(f.municipalityId) ?? {
      municipalityId: f.municipalityId,
      poblacio: m.poblacio,
      candidatures: [],
      blancs: p?.blancs ?? null,
      nuls: p?.nuls ?? null,
    };
    const candidatura: CandidaturaMunicipi = {
      partit: partitDelResultat(f.sigles, f.brandId, f.agrupacioSigles ?? null),
      vots: f.vots,
      regidors: f.regidors,
      candidats: f.candidats,
    };
    vots.candidatures.push(candidatura);
    sortida.set(f.municipalityId, vots);
  }
  return sortida;
}

/**
 * Els municipis amb què es fa el càlcul de la llei, que no sempre són els
 * d'avui: el càlcul reprodueix el ple del 2023, i el 2023 els vuit municipis
 * del Lluçanès encara eren d'Osona (la comarca es va crear el maig del 2023 i
 * no tindrà consell fins després del 2027). Per al consell d'Osona, doncs, hi
 * van també els del Lluçanès; la llista de municipis de la fitxa és la d'avui.
 */
export function ambitDelCalcul(ens: Pick<EnsDesat, "tipus" | "territori" | "districtes">, base: readonly MunicipiBase[]): MunicipiBase[] {
  const ambit = municipisDeLAmbit(ens, base);
  if (ens.tipus !== "consell" || territoriComparable(ens.territori) !== "osona") return ambit;
  const llucanes = base.filter((m) => m.comarca !== null && territoriComparable(m.comarca) === "llucanes");
  return [...ambit, ...llucanes.filter((m) => !ambit.includes(m))];
}

/**
 * Quan alguns seients no tenen partit conegut, el càlcul no pot quadrar lletra
 * per lletra, però això no vol dir que hi hagi cap diferència.
 *
 * Si cada partit conegut té al ple **com a molt** els que li dona el càlcul, i
 * el que hi falta suma exactament els seients sense partit, totes les
 * diferències les expliquen aquells seients: el càlcul quadra amb tot el que
 * sabem. Llavors `quadra` és cert i la primera diferència ho diu («Quadra amb
 * els 47 seients de partit conegut…»), perquè la pàgina no l'ensenyi com un
 * acord perfecte. Si no, les diferències són de debò i es queden com eren.
 */
export function reconciliaDesconeguts(r: RepartimentEns, desconeguts: number): RepartimentEns {
  if (r.quadra || desconeguts <= 0 || r.files.some((f) => f.seientsReals === null)) return r;
  let falten = 0;
  for (const f of r.files) {
    const real = f.seientsReals ?? 0;
    if (real > f.seientsCalculats) return r;
    falten += f.seientsCalculats - real;
  }
  if (falten !== desconeguts) return r;
  const coneguts = r.files.reduce((a, f) => a + (f.seientsReals ?? 0), 0);
  const sortejos = r.diferencies.filter((t) => /sorteig/.test(t));
  return {
    ...r,
    quadra: true,
    diferencies: [
      `Quadra amb els ${coneguts} seients de partit conegut; ` +
        (desconeguts === 1
          ? "de l'altre, la font no diu de quin partit és."
          : `dels altres ${desconeguts}, la font no diu de quin partit són.`),
      ...sortejos,
    ],
  };
}

/** Un nom de llista per comparar-lo: majúscules, sense accents ni res que no sigui lletra o xifra. */
function llistaComparable(nom: string): string {
  return nom.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Llistes locals que el registre de plens escriu d'una manera i els resultats
 * del 2023 d'una altra. Totes comprovades contra els resultats oficials en la
 * validació del càlcul (27-10-2026; vegeu `derive/escons-ens.ts`): la clau és
 * l'etiqueta del registre de plens i el valor, les sigles de la candidatura o
 * de l'agrupació als resultats, totes dues en la forma de `llistaComparable`.
 */
const ALIES_LLISTES: Readonly<Record<string, string>> = {
  TOTHOMAEPS: "TOTHOMAGRUPACIOELECTORALDELPONTDESUERT",
  GCAE: "AAE1PALLARSSOBIRA",
  GCGP: "GENTDEPOBLE",
  AC: "APCANVI",
  FEMLLIVIA: "FLL",
  FXPUIGCERDA: "FTR",
  GCAECP: "CEP",
  BXREPPERTU: "XTU",
  SOMAVIA: "SA",
  MESXGIRONELLA: "MXGI",
  ARAMONTBUI: "AMLVDVDM",
  IDO: "AAE1OSONA",
};

/**
 * La clau dels resultats que correspon a una fila de la composició. Les
 * famílies ja hi coincideixen (la composició passa per `partitComparable` i
 * els resultats per `AGRUPACIONS_DE_FAMILIA`, que donen la mateixa clau); les
 * llistes locals, no sempre: el registre escriu «MÉS X GIRONELLA» i els
 * resultats «MxGi». Primer s'hi busca la mateixa llista escrita igual llevat
 * d'accents, espais i signes; després, la taula d'àlies comprovats. Si no n'hi
 * ha cap, la clau es queda com és i la comparació dirà que el càlcul no li
 * dona cap seient, que és el que sabem.
 *
 * `clausResultats` han de ser només les de l'àmbit de l'ens. Amb les de tot
 * Catalunya, «AC» (Alcoverencs pel Canvi, al Consell de l'Alt Camp) topava
 * amb l'agrupació «AC» d'Ara Copons, que és de l'Anoia, i els dos seients
 * d'Alcover es quedaven sense la seva llista.
 */
export function clauDelResultat(clau: string, clausResultats: ReadonlySet<string>): string {
  if (clausResultats.has(clau)) return clau;
  const n = llistaComparable(clau);
  const objectiu = ALIES_LLISTES[n] ?? n;
  const iguals = [...clausResultats].filter((k) => llistaComparable(k) === objectiu || llistaComparable(k) === n);
  return iguals.length === 1 ? iguals[0]! : clau;
}

/**
 * El repartiment que faria la llei amb els vots del 2023, al costat dels escons
 * reals. Els reals només hi van si la font dona els noms del ple; si no, no hi
 * ha res amb què comparar i el mapa és `null`. La fila «sense partit conegut»
 * no hi entra: no és cap candidatura, i els seients que no tenen partit
 * conegut (o ni tan sols nom) els mira `reconciliaDesconeguts`.
 *
 * Els seients desconeguts es compten contra el més gran de dos totals: els
 * escons del registre (`seients`) i els que fixa la llei, que són els que
 * reparteix el càlcul. Normalment són el mateix nombre; quan el registre
 * escriu una persona dues vegades, la J38 la compta com un sol escó i el ple
 * en té un menys que la llei. Al Vallès Occidental (39 per llei) el registre
 * dona dues files a la mateixa persona del PSC: hi ha 38 noms, i el seient que
 * falta és d'algú que la font no diu, no un escó que no existeix.
 */
export function repartimentDe(
  ens: Pick<EnsDesat, "tipus" | "districtes"> & { seients?: number },
  ambit: readonly Pick<MunicipiBase, "id">[],
  vots: ReadonlyMap<number, VotsMunicipi>,
  composicio: DadesEns["composicio"],
  ambNoms: boolean,
): RepartimentEns | null {
  const deIds = (ids: readonly number[]): VotsMunicipi[] =>
    ids.map((id) => vots.get(id)).filter((v): v is VotsMunicipi => v !== undefined);
  let municipis: VotsMunicipi[] = [];
  let districtes: { nom: string; municipis: VotsMunicipi[] }[] = [];
  if (ens.tipus === "consell") {
    municipis = deIds(ambit.map((m) => m.id));
    if (municipis.length === 0) return null;
  } else {
    if (!ens.districtes || ens.districtes.length === 0) return null;
    districtes = ens.districtes.map((d) => ({ nom: d.nom, municipis: deIds(d.municipalityIds) }));
    municipis = districtes.flatMap((d) => d.municipis);
  }

  // Les claus dels resultats, només de l'àmbit de l'ens (vegeu `clauDelResultat`).
  const clausResultats = new Set<string>();
  for (const v of municipis) for (const c of v.candidatures) clausResultats.add(c.partit);
  let reals: Map<string, number> | null = null;
  if (ambNoms) {
    reals = new Map();
    for (const f of composicio) {
      if (f.partit === SENSE_PARTIT) continue;
      const clau = clauDelResultat(f.partit, clausResultats);
      reals.set(clau, (reals.get(clau) ?? 0) + f.seients);
    }
  }

  let r: RepartimentEns;
  if (ens.tipus === "consell") {
    r = repartimentConsell(municipis, reals);
  } else {
    const residents = municipis.reduce((s, m) => s + m.poblacio, 0);
    if (residents === 0) return null;
    r = repartimentDiputacio(districtes, seientsDiputacio(residents), reals);
  }
  const coneguts = reals ? [...reals.values()].reduce((a, n) => a + n, 0) : 0;
  const deLaLlei = r.files.reduce((a, f) => a + f.seientsCalculats, 0);
  const desconeguts = Math.max(0, Math.max(ens.seients ?? coneguts, deLaLlei) - coneguts);
  return reconciliaDesconeguts(r, desconeguts);
}

// ─────────────────────────────────────────────────────────────────────────────
// L'ens sencer
// ─────────────────────────────────────────────────────────────────────────────

/** Tot el que el carregador ha llegit de la base, indexat per municipi. */
export type ContextEns = {
  municipis: ReadonlyMap<number, MunicipiBase>;
  /** El ple de cada municipi, amb adreces i cares (`pleDe`). */
  plens: ReadonlyMap<number, readonly PersonaPle[]>;
  /** Les mètriques `sousDiputacions` (J24) i `sousConsells` (J30), per municipi. */
  sousDiputacions: ReadonlyMap<number, unknown>;
  sousConsells: ReadonlyMap<number, unknown>;
  vots2023: ReadonlyMap<number, VotsMunicipi>;
  /** Les subvencions de la J39, pel codi d'ens. */
  subvencions: ReadonlyMap<string, SubvencionsEnsDesades>;
  /** Municipis que entren al càlcul amb el padró d'avui perquè no tenim el del 2022. */
  ambPadroActual?: ReadonlySet<number>;
  /** Serveis socials i contractació de la J42, pel codi d'ens. */
  serveis?: ReadonlyMap<string, ServeisEnsDesats>;
  /** Fons de Cooperació Local, PUOSC i comptes tramesos de la J41, pel codi d'ens. */
  dinersGeneralitat?: ReadonlyMap<string, DinersGeneralitatEnsDesat>;
};

const ORDRE_ROL: Readonly<Record<MembreDesat["rol"], number>> = { presidencia: 0, vicepresidencia: 1, membre: 2 };

/**
 * La persona del ple d'un municipi que és aquest membre. Es prova primer el nom
 * amb què la J38 l'ha trobada al registre de plens (`nomAlPle`) i després el
 * de la font de l'ens; si cap no lliga exactament, la regla de les inicials de
 * la J30 («Eva M. Martinez Morales» i «Eva Maria Martínez Morales»). Sempre
 * dins del ple d'aquell sol municipi, i sempre amb una sola persona: si en
 * lliguen dues, no és de cap.
 */
export function personaDelPle(noms: readonly (string | null)[], ple: readonly PersonaPle[]): PersonaPle | null {
  const nets = noms.filter((n): n is string => n !== null && n.trim() !== "");
  for (const nom of nets) {
    const exacta = aparellaUnic(nom, ple);
    if (exacta) return exacta;
  }
  const perInicials = ple.filter((p) => nets.some((n) => nomsLliguenAmbInicials(p.nom, n)));
  return perInicials.length === 1 ? perInicials[0]! : null;
}

/**
 * Un membre amb el que hi afegeix el publicador. El nom de la persona al ple
 * municipal, si s'hi ha aparellat, és el que es fa servir per buscar-ne el sou:
 * és el nom amb què la J24 i la J30 l'han desat.
 */
export function membreEns(
  m: MembreDesat,
  ens: Pick<EnsDesat, "tipus" | "nom" | "territori">,
  ctx: ContextEns,
  etiquetesDelPle: readonly (string | null)[] = [],
): MembreEns {
  const { municipalityId, nomAlPle, ...resta } = m;
  const municipi = municipalityId === null ? undefined : ctx.municipis.get(municipalityId);
  // Un escó que la font dona amb partit i sense nom (`NOM_NO_PUBLICAT`, el
  // Montsià) no és cap persona: no se li busca fitxa, cara ni sou, encara que
  // el registre en digui el municipi. Un nom buit no pot lligar amb ningú.
  const senseNom = esSeientSenseNom(m.nom);
  const persona = municipalityId === null || senseNom ? null : personaDelPle([nomAlPle ?? null, m.nom], ctx.plens.get(municipalityId) ?? []);
  const sous = municipalityId === null
    ? undefined
    : (ens.tipus === "diputacio" ? ctx.sousDiputacions : ctx.sousConsells).get(municipalityId);
  return {
    ...resta,
    municipi: municipi ? { slug: municipi.slug, nom: municipi.nom } : null,
    adreca: persona?.adreca ?? null,
    foto: persona?.foto ?? null,
    retribucio: municipalityId === null || senseNom ? null : retribucioDe(ens, persona?.nom ?? nomAlPle ?? m.nom, sous),
    grup: grupDe(m.partit, etiquetesDelPle),
    color: colorDePartit(partitComparable(m.partit, etiquetesDelPle)),
  };
}

/** De `EnsDesat` a `DadesEns`: tot pur, a partir del que ha llegit `loadEns`. */
export function construeixEns(desat: EnsDesat, ctx: ContextEns): DadesEns {
  const { membres: desats, seuMunicipalityId, ...resta } = desat;
  const etiquetes = desats.map((m) => m.partit);
  const membres = desats
    .map((m) => membreEns(m, desat, ctx, etiquetes))
    .sort(
      (a, b) =>
        ORDRE_ROL[a.rol] - ORDRE_ROL[b.rol] ||
        (a.ordre ?? Number.MAX_SAFE_INTEGER) - (b.ordre ?? Number.MAX_SAFE_INTEGER) ||
        a.nom.localeCompare(b.nom, "ca"),
    );
  const composicio = composicioDe(desats);
  const base = [...ctx.municipis.values()];
  const seu = seuMunicipalityId === null ? undefined : ctx.municipis.get(seuMunicipalityId);
  const territori = territoriDe(desat, base, desats);
  const ambitCalcul = ambitDelCalcul(desat, base);
  return {
    ...resta,
    slug: slugEns(desat),
    seu: seu ? { slug: seu.slug, nom: seu.nom } : null,
    membres,
    composicio,
    presidencia: membres.find((m) => m.rol === "presidencia") ?? null,
    ...territori,
    repartiment: avisaPadroActual(
      repartimentDe(desat, ambitCalcul, ctx.vots2023, composicio, desats.length > 0),
      ambitCalcul,
      ctx.ambPadroActual ?? new Set(),
    ),
    subvencions: subvencionsDe(ctx.subvencions.get(desat.codiEns), ctx.municipis),
    // Cada bloc amb els seus diners i la seva font: res d'aquí no se suma amb
    // les subvencions del RAISC ni amb el pressupost de l'ens.
    serveis: ctx.serveis?.get(desat.codiEns) ?? null,
    dinersGeneralitat: ctx.dinersGeneralitat?.get(desat.codiEns) ?? null,
  };
}

const ORDRE_DIPUTACIONS = ["barcelona", "girona", "lleida", "tarragona"];

/** Les diputacions primer (Barcelona, Girona, Lleida, Tarragona) i després els consells, de l'A a la Z. */
export function ordenaEns<T extends Pick<EnsDesat, "tipus" | "territori">>(llista: readonly T[]): T[] {
  const posicio = (e: T): number => {
    if (e.tipus === "consell") return ORDRE_DIPUTACIONS.length;
    const i = ORDRE_DIPUTACIONS.indexOf(territoriComparable(e.territori));
    // Una diputació que no fos de les quatre aniria darrere seu i davant dels consells.
    return i === -1 ? ORDRE_DIPUTACIONS.length - 0.5 : i;
  };
  return [...llista].sort((a, b) => posicio(a) - posicio(b) || a.territori.localeCompare(b.territori, "ca"));
}

/** La forma mínima d'un `EnsDesat` llegit de la base, sense refiar-se'n. */
export function esEnsDesat(x: unknown): x is EnsDesat {
  if (typeof x !== "object" || x === null) return false;
  const e = x as Partial<EnsDesat>;
  return (
    (e.tipus === "diputacio" || e.tipus === "consell") &&
    typeof e.codiEns === "string" &&
    typeof e.territori === "string" &&
    Array.isArray(e.membres)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// La lectura de la base
// ─────────────────────────────────────────────────────────────────────────────

/** L'elecció de la qual surten els plens d'avui. */
const ELECCIO_2023 = "M20231";

/** L'any del padró amb què es va convocar l'elecció del 2023 (padró a 1-1-2022, RD 1037/2022). */
export const ANY_PADRO_CONVOCATORIA = 2022;

/** El camí JSON del punt del 2022 a la sèrie `padroHabitants` de la mètrica `poblacio` (J18). */
const CAMI_PADRO_2022 = `$.indicadors[*] ? (@.clau == "padroHabitants").serie[*] ? (@.any == ${ANY_PADRO_CONVOCATORIA}).valor`;

/**
 * La població de cada municipi per al càlcul de la llei: la del padró del 2022
 * quan la tenim, i la vigent de la taula de municipis quan no. Un municipi sense
 * cap de les dues queda sense població i fora del càlcul, com fins ara.
 *
 * El recanvi no és silenciós: `ambPadroActual` diu quins municipis l'han fet
 * servir, el carregador ho escriu a la consola i la pàgina de l'ens que en
 * tingui algun diu que el càlcul és aproximat (`avisaPadroActual`). Un sol
 * municipi amb el padró d'avui rarament mou un escó, però pot fer-ho.
 */
export function poblacioDeLaConvocatoria(
  municipis: ReadonlyMap<number, Pick<MunicipiBase, "poblacio">>,
  padro2022: ReadonlyMap<number, number>,
): { poblacions: Map<number, { poblacio: number | null }>; ambPadroActual: Set<number> } {
  const poblacions = new Map<number, { poblacio: number | null }>();
  const ambPadroActual = new Set<number>();
  for (const [id, m] of municipis) {
    const del2022 = padro2022.get(id);
    if (del2022 === undefined && m.poblacio !== null) ambPadroActual.add(id);
    poblacions.set(id, { poblacio: del2022 ?? m.poblacio });
  }
  return { poblacions, ambPadroActual };
}

/**
 * Afegeix al repartiment l'avís que és aproximat si algun municipi del càlcul
 * hi ha entrat amb el padró d'avui i no amb el del 2022. No toca `quadra`: el
 * càlcul és el que és, i la frase diu per què pot no ser exacte.
 */
export function avisaPadroActual(
  r: RepartimentEns | null,
  ambit: readonly Pick<MunicipiBase, "id">[],
  ambPadroActual: ReadonlySet<number>,
): RepartimentEns | null {
  if (!r) return r;
  const n = ambit.filter((m) => ambPadroActual.has(m.id)).length;
  if (n === 0) return r;
  return {
    ...r,
    diferencies: [
      ...r.diferencies,
      `El càlcul és aproximat: per a ${n === 1 ? "un municipi" : `${n} municipis`} no tenim el padró del 2022, ` +
        "que és amb el que es va convocar l'elecció, i s'hi ha fet servir el d'avui.",
    ],
  };
}

/** Files d'una consulta en blocs, perquè cap resultat no hagi de cabre sencer a PGlite. */
async function perBlocs<T>(consulta: (limit: number, salta: number) => Promise<T[]>): Promise<T[]> {
  const BLOC = 2000;
  const files: T[] = [];
  for (let salta = 0; ; salta += BLOC) {
    const tros = await consulta(BLOC, salta);
    files.push(...tros);
    if (tros.length < BLOC) break;
  }
  return files;
}

/**
 * Totes les fitxes d'ens, a punt per pintar: les diputacions primer i després
 * els consells de l'A a la Z.
 *
 * Fa sis consultes, totes per tipus sencer i cap per ens: els municipis; les
 * mètriques dels ens, dels plens de les seus electròniques i dels sous (J24,
 * J30) amb `carregaMetriques`; les subvencions de la J39 (un sol `LIKE` per al
 * prefix); el registre d'electes, per als pobles sense seu electrònica; i els
 * vots i els candidats del 2023 per al repartiment. Sense cap ens desat (la J38
 * encara no ha corregut) torna una llista buida.
 */
export async function loadEns(db: Db): Promise<DadesEns[]> {
  const munis = await db
    .select({
      id: municipalities.id,
      slug: municipalities.slug,
      nom: municipalities.name,
      comarca: municipalities.comarca,
      provincia: municipalities.provincia,
      ine5: municipalities.ine5,
      poblacio: municipalities.population,
    })
    .from(municipalities);
  const municipis = new Map<number, MunicipiBase>(munis.map((m) => [m.id, m]));

  const metriques = await carregaMetriques(db, [KIND_DIPUTACIO, KIND_CONSELL, "carrecs", "sousDiputacions", "sousConsells"]);
  const perCodi = new Map<string, EnsDesat>();
  const carrecsSeu = new Map<number, CarrecSeu[]>();
  const sousDiputacions = new Map<number, unknown>();
  const sousConsells = new Map<number, unknown>();
  for (const fila of metriques) {
    if (fila.kind === KIND_DIPUTACIO || fila.kind === KIND_CONSELL) {
      if (esEnsDesat(fila.data)) perCodi.set(fila.data.codiEns, fila.data);
    } else if (fila.kind === "carrecs") {
      const llista = (fila.data as { carrecs?: unknown } | null)?.carrecs;
      if (Array.isArray(llista)) carrecsSeu.set(fila.municipalityId, llista as CarrecSeu[]);
    } else if (fila.kind === "sousDiputacions") {
      sousDiputacions.set(fila.municipalityId, fila.data);
    } else if (fila.kind === "sousConsells") {
      sousConsells.set(fila.municipalityId, fila.data);
    }
  }
  if (perCodi.size === 0) return [];

  const subvencions = new Map<string, SubvencionsEnsDesades>();
  const filesSubvencions = await db
    .select({ data: municipalityMetrics.data })
    .from(municipalityMetrics)
    .where(like(municipalityMetrics.kind, `${PREFIX_KIND_SUBVENCIONS}%`));
  for (const { data } of filesSubvencions) {
    const s = data as SubvencionsEnsDesades | null;
    if (s && typeof s.codiEns === "string") subvencions.set(s.codiEns, s);
  }

  // Serveis socials i contractació (J42) i diners de la Generalitat (J41): un
  // `LIKE` per prefix cadascun, com les subvencions.
  const serveis = new Map<string, ServeisEnsDesats>();
  for (const { data } of await db
    .select({ data: municipalityMetrics.data })
    .from(municipalityMetrics)
    .where(like(municipalityMetrics.kind, `${PREFIX_KIND_SERVEIS_ENS}%`))) {
    const d = data as ServeisEnsDesats | null;
    if (d && typeof d.codiEns === "string" && (d.tipus === "consell" || d.tipus === "diputacio")) serveis.set(d.codiEns, d);
  }
  const dinersGeneralitat = indexaDinersGeneralitatEns(
    await db
      .select({ kind: municipalityMetrics.kind, data: municipalityMetrics.data })
      .from(municipalityMetrics)
      .where(like(municipalityMetrics.kind, `${PREFIX_KIND_DINERS_GENERALITAT_ENS}%`)),
  );

  // El ple de cada municipi, en l'ordre de `loadRadiografia` (per número), que
  // és el que fa servir `publish.ts` als pobles sense seu electrònica.
  const registre = await perBlocs((limit, salta) =>
    db
      .select({ municipalityId: councillorMandates.municipalityId, nom: people.fullName })
      .from(councillorMandates)
      .innerJoin(people, eq(people.id, councillorMandates.personId))
      .orderBy(asc(councillorMandates.municipalityId), asc(councillorMandates.orderNum), asc(councillorMandates.id))
      .limit(limit)
      .offset(salta),
  );
  const registrePer = new Map<number, { nom: string }[]>();
  for (const r of registre) registrePer.set(r.municipalityId, [...(registrePer.get(r.municipalityId) ?? []), { nom: r.nom }]);
  const plens = new Map<number, PersonaPle[]>();
  for (const id of municipis.keys()) plens.set(id, pleDe(carrecsSeu.get(id), registrePer.get(id) ?? []));

  const resultats = await perBlocs((limit, salta) =>
    db
      .select({
        municipalityId: candidatures.municipalityId,
        sigles: candidatures.sigles,
        brandId: candidatures.brandId,
        agrupacioSigles: candidatures.agrupacioSigles,
        vots: electionResults.votes,
        regidors: electionResults.seats,
      })
      .from(candidatures)
      .innerJoin(electionResults, eq(electionResults.candidatureId, candidatures.id))
      .where(eq(candidatures.electionId, ELECCIO_2023))
      .orderBy(asc(candidatures.id))
      .limit(limit)
      .offset(salta),
  );
  const participacio = new Map<number, Participacio2023>();
  for (const p of await db
    .select({
      municipalityId: electionParticipation.municipalityId,
      blancs: electionParticipation.blankVotes,
      nuls: electionParticipation.nullVotes,
    })
    .from(electionParticipation)
    .where(eq(electionParticipation.electionId, ELECCIO_2023))) {
    participacio.set(p.municipalityId, { blancs: p.blancs, nuls: p.nuls });
  }
  // El padró amb què es va convocar l'elecció (1-1-2022), de la sèrie de la J18.
  // Només el punt del 2022, amb `jsonb_path_query_first`, perquè portar el
  // document de població sencer de 947 municipis fa petar PGlite.
  const padro2022 = new Map<number, number>();
  const filesPadro = await perBlocs((limit, salta) =>
    db
      .select({
        municipalityId: municipalityMetrics.municipalityId,
        valor: sql<unknown>`jsonb_path_query_first(${municipalityMetrics.data}, ${sql.raw(`'${CAMI_PADRO_2022}'`)})`,
      })
      .from(municipalityMetrics)
      .where(eq(municipalityMetrics.kind, "poblacio"))
      .orderBy(asc(municipalityMetrics.municipalityId))
      .limit(limit)
      .offset(salta),
  );
  for (const f of filesPadro) {
    const valor = Number(f.valor);
    if (f.valor !== null && Number.isFinite(valor) && valor > 0) padro2022.set(f.municipalityId, valor);
  }
  const convocatoria = poblacioDeLaConvocatoria(municipis, padro2022);
  if (convocatoria.ambPadroActual.size > 0) {
    console.warn(
      `ens: ${convocatoria.ambPadroActual.size} municipis sense padró del 2022 (mètrica poblacio de la J18); ` +
        "el repartiment hi fa servir el padró d'avui i les fitxes ho diuen.",
    );
  }
  const vots2023 = votsPerMunicipi(
    resultats.map((r) => ({ ...r, candidats: null })),
    convocatoria.poblacions,
    participacio,
  );

  const ctx: ContextEns = {
    municipis,
    plens,
    sousDiputacions,
    sousConsells,
    vots2023,
    subvencions,
    ambPadroActual: convocatoria.ambPadroActual,
    serveis,
    dinersGeneralitat,
  };
  return ordenaEns([...perCodi.values()]).map((e) => construeixEns(e, ctx));
}
