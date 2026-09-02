import { mkdir, writeFile } from "node:fs/promises";
import { isNotNull } from "drizzle-orm";
import { people, type Db } from "@quivoto/db";
import { BRANDS_BY_ID, siglesFamily } from "@quivoto/shared-schemas/brands";
import type { FitxaTrajectoria } from "../jobs/j21-trajectoria-electes";
import type { FitxaFotosExalcaldes } from "../jobs/j28-fotos-exalcaldes";
import { de, elDia, nomLlegible, normalizePersonName, slugify } from "../lib/text";
import { esAlcaldia, resolAlcaldia } from "./alcaldia";
import { capcalera, tipografia } from "./capcalera";
import { cercador } from "./cercador";
import { SITE } from "./config";
import { sobreColor } from "./contrast";
import { RADIOGRAFIA_CSS } from "./estil";
import { FOTOS_WIKIMEDIA_CSS, creditRetrat, retratsPerNom, type Retrat } from "./fotos-wikidata";
import { peu } from "./peu";
import type { RadiografiaData } from "./radiografia";
import { frasesQueCaben, titolQueCap } from "./regidor";
import { ARREL_OBSERVATORI, capSeo, filAriadna, FITXER_OG, imatgeOg } from "./seo";
import { partitDe, sigla } from "./sigla";

/**
 * La fitxa de cada persona que ha tingut l'alcaldia d'un municipi des del 1979.
 *
 * La taula «Les alcaldies des del 1979» de la fitxa municipal porta, per a
 * cada mandat, un nom que fins ara era text mort: les persones electes d'avui
 * tenen pàgina (`regidor.ts`) i les d'abans, que són unes 2.900 a tot
 * Catalunya, no en tenien cap. Aquí se'n fa una per persona i municipi, amb
 * el que ja hi havia desat i cap pàgina no llegia junt:
 *
 *   · l'historial d'alcaldies de la Generalitat (`MayorsMetric`, J5/J25), que
 *     és l'espina dorsal: els mandats, el partit, la presa de possessió i els
 *     relleus a mig mandat;
 *   · els resultats de les tres municipals que tenim (2015, 2019 i 2023), per
 *     dir què va treure la seva llista quan es va obrir cada mandat;
 *   · el que Wikidata en sap (J21): la data de naixement, l'ofici, els càrrecs
 *     per sobre de l'ajuntament i l'article a la Viquipèdia;
 *   · el retrat de Wikimedia Commons (J28), amb el crèdit que la llicència
 *     obliga a fer.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * UNA PERSONA, UNA FITXA
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * La clau és el nom normalitzat (`normalizePersonName`), la mateixa amb què
 * tot el projecte creua persones: «JOAN ROIG CASTELL» del 2015 i «Joan Roig i
 * Castell» del 2019 són la mateixa persona i tenen una sola fitxa amb els dos
 * mandats. L'adreça és **`m/<municipi>/alcaldia/<slug>/`** amb el slug de
 * `slugify(nomLlegible(nom))` sobre el nom que dona l'historial al seu mandat
 * més recent. És una convenció fixa: la pàgina de trajectòries hi enllaça amb
 * exactament aquesta regla. Si dues persones del mateix municipi donen el
 * mateix slug —no passa avui a cap dels 947, però el que ho evita no ha de
 * ser la sort— la segona en ordre cronològic porta el sufix «-2», la tercera
 * «-3», com fa `adrecesRegidors()`.
 *
 * **Qui té l'alcaldia avui no en té dues.** Si l'alcaldia vigent ja té fitxa
 * de regidor, la taula d'alcaldies i les fitxes de qui la va precedir hi
 * enllacen, i a la seva adreça d'`alcaldia/` només s'hi escriu una redirecció
 * (`renderRedireccioAlcaldia`), perquè qui hi arribi per la convenció no
 * trobi una porta tancada. La redirecció no va al sitemap.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL GÈNERE NO S'ENDEVINA
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * «Alcalde» o «alcaldessa» només quan una font ho diu: el càrrec que escriu la
 * seu electrònica de qui hi és avui, o el sexe que publica el registre de
 * candidatures per a qui hi ha anat a una llista des del 2015. Per a la resta
 * —la majoria de qui va manar abans del 2015— la pàgina diu «a l'alcaldia
 * de…», que és neutre i és cert. És la mateixa regla que `carrecCurt()` de la
 * fitxa de regidor: el gènere d'una persona no es dedueix del nom.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CAP VEREDICTE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * La font no diu per què algú va plegar a mig mandat —dimissió, moció de
 * censura, pacte de rotació— i la pàgina tampoc. Es diu qui hi havia abans,
 * qui va venir després, quant de temps i amb quins vots, i cada dada porta la
 * seva font al costat.
 */

// ─────────────────────────────────────────────────────────────────────────────
// El que arriba
// ─────────────────────────────────────────────────────────────────────────────

/** Una fila de l'historial d'alcaldies, tal com la desa la mètrica `mayors`. */
export type FilaHistorial = { term: string; name: string; partyRaw: string | null; tookOfficeOn: string | null };

/**
 * L'historial i els relleus, tal com els desa la mètrica `mayors` de
 * `derive/mayor-changes.ts`. Es declara estructuralment perquè
 * `radiografia.ts` no exporta el seu `MayorsMetric` i aquest mòdul no ha de
 * dependre'n: el que hi ha de coincidir és la forma, i el compilador la
 * comprova a cada crida.
 */
export type HistorialAlcaldies = {
  history: FilaHistorial[];
  changes: {
    term: string;
    mayors: { name: string; tookOfficeOn: string | null }[];
    partyChanged: boolean;
    onlySuccessorKnown?: boolean;
  }[];
};

/** Els resultats per elecció (`results` de la fitxa), només amb el que cal aquí. */
export type ResultatsPerEleccio = Record<
  string,
  { totalVotes: number; seats: number; candidatures: { sigles: string; brandId: string | null; votes: number; seats: number; share: number }[] }
>;

export type Genere = "alcalde" | "alcaldessa";

export type OpcionsAlcaldies = {
  results?: ResultatsPerEleccio | null;
  fotos?: FitxaFotosExalcaldes | null;
  trajectoria?: FitxaTrajectoria | null;
  /** L'alcaldia vigent segons `resolAlcaldia`: el nom i, si en té, la fitxa de regidor. */
  actual?: { nom: string | null; adreca: string | null } | null;
  /** El dia d'avui en ISO, per comptar els anys de qui encara hi és. */
  avui?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// El que en surt
// ─────────────────────────────────────────────────────────────────────────────

/** El resultat de la llista de l'alcaldia a les eleccions que van obrir el mandat. */
export type ResultatLlista = {
  eleccio: string;
  any: number;
  sigles: string;
  vots: number;
  percentatge: number;
  regidories: number;
  deRegidories: number;
  /** Quina força va ser per vots: 1 la més votada. */
  forca: number;
  forces: number;
};

export type Mandat = {
  term: string;
  anyInici: number;
  anyFi: number;
  partyRaw: string | null;
  tookOfficeOn: string | null;
  /** Va prendre possessió a mig mandat, rellevant algú altre. */
  arribaAMigMandat: boolean;
  /** Algú altre el va rellevar abans que s'acabés el mandat. */
  marxaAMigMandat: boolean;
  /** Dins del mateix mandat: qui hi havia just abans i qui va venir just després. */
  abansEnElMandat: VeiAlcaldia | null;
  despresEnElMandat: VeiAlcaldia | null;
  resultat: ResultatLlista | null;
};

/** Una altra persona de l'historial, amb l'adreça on porta el seu nom. */
export type VeiAlcaldia = { nom: string; clau: string; adreca: string; term: string; tookOfficeOn: string | null };

export type WikidataAlcaldia = {
  qid: string;
  url: string;
  viquipedia: string | null;
  ocupacions: string[];
  carrecs: { nom: string; inici: string | null; fi: string | null }[];
  /** Si el nom i les dates lliguen amb el nostre historial (J21). */
  aparellat: boolean;
  /** La data de naixement (ISO, de J21) o només l'any (de J28), i l'any de defunció si consta. */
  naixement: string | null;
  defuncio: number | null;
  font: string;
  llicencia: string;
  consultat: string | null;
};

export type PersonaAlcaldia = {
  clau: string;
  nom: string;
  slug: string;
  /** On porta el seu nom, relatiu a `m/<slug>/`: `alcaldia/<slug>/` o la fitxa de regidor. */
  adreca: string;
  /** La fitxa de regidor, quan és l'alcaldia vigent i en té. */
  fitxaRegidor: string | null;
  /** Té l'alcaldia avui segons l'historial. */
  actual: boolean;
  /** Cronològics, del primer a l'últim. */
  mandats: Mandat[];
  /** Del primer any a l'últim: «2015-2023», o «des del 2019» si encara hi és. */
  primerAny: number;
  ultimAny: number;
  sigles: string | null;
  color: string | null;
  /** Quant de temps a l'alcaldia, sumant tots els mandats. */
  durada: { dies: number; aproximat: boolean };
  abans: VeiAlcaldia | null;
  despres: VeiAlcaldia | null;
  /** Qui hi va haver entre dos dels seus mandats no consecutius. */
  entremig: VeiAlcaldia[];
  retrat: Retrat | null;
  wikidata: WikidataAlcaldia | null;
};

const escape = (t: string): string =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const number = (n: number): string => n.toLocaleString("ca-ES");

/** El camí fins a `/observatori/` des de `m/<slug>/alcaldia/<persona>/`. */
const BASE = "../../../../";

// ─────────────────────────────────────────────────────────────────────────────
// De l'historial a persones
// ─────────────────────────────────────────────────────────────────────────────

/** Els dos anys d'un mandat: «2015-2019» → 2015 i 2019. */
export function anysDelTerm(term: string): { inici: number; fi: number } {
  const [a, b] = term.split("-");
  const inici = Number(a) || 0;
  return { inici, fi: Number(b) || inici + 4 };
}

/**
 * Un mandat obre amb les eleccions del seu primer any: «2015-2019» són les
 * municipals del 2015, que la base identifica com a `M20151`.
 */
export const eleccioDelTerm = (term: string): string => `M${anysDelTerm(term).inici}1`;

/**
 * El resultat de la llista de l'alcaldia a les eleccions que van obrir el
 * mandat, si el tenim i si es pot dir sense dubte quina llista era.
 *
 * L'historial escriu el partit com vol («PSC-CP», «CiU», «ERC-AM») i els
 * resultats tenen les sigles de la candidatura: primer es busca la mateixa
 * sigla, i si no hi és, la mateixa família de marca. Si el partit de
 * l'alcaldia lliga amb dues llistes —o amb cap— no s'hi posa res: atribuir a
 * algú els vots d'una altra llista és pitjor que no dir-ne cap.
 */
export function resultatDeLaLlista(
  results: ResultatsPerEleccio | null | undefined,
  term: string,
  partyRaw: string | null,
): ResultatLlista | null {
  if (!results || !partyRaw) return null;
  const eleccio = eleccioDelTerm(term);
  const resultats = results[eleccio];
  if (!resultats || resultats.candidatures.length === 0) return null;
  const perVots = [...resultats.candidatures].sort((a, b) => b.votes - a.votes);
  const compacta = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  let candidates = perVots.filter((c) => compacta(c.sigles) === compacta(partyRaw));
  if (candidates.length === 0) {
    const familia = siglesFamily(partyRaw);
    if (familia && familia !== "local") {
      candidates = perVots.filter((c) => (c.brandId ?? siglesFamily(c.sigles)) === familia);
    }
  }
  if (candidates.length !== 1) return null;
  const llista = candidates[0]!;
  return {
    eleccio,
    any: anysDelTerm(term).inici,
    sigles: llista.sigles,
    vots: llista.votes,
    percentatge: llista.share,
    regidories: llista.seats,
    deRegidories: resultats.seats,
    forca: perVots.indexOf(llista) + 1,
    forces: perVots.length,
  };
}

/**
 * El que Wikidata sap d'aquesta persona, si en sap res i si el nom no lliga
 * amb més d'una fitxa: la mateixa cautela que `trajectoriaDePersona()`.
 *
 * J21 porta la data de naixement sencera i els càrrecs; J28, que només
 * busca cares, porta l'any de naixement i el de defunció. Es combinen: la
 * data mana sobre l'any, i la defunció només la té J28.
 */
export function wikidataDe(
  trajectoria: FitxaTrajectoria | null | undefined,
  fotos: FitxaFotosExalcaldes | null | undefined,
  clau: string,
): WikidataAlcaldia | null {
  const deJ21 = (trajectoria?.persones ?? []).filter((p) => normalizePersonName(p.nom) === clau);
  const deJ28 = (fotos?.persones ?? []).filter((p) => normalizePersonName(p.nom) === clau);
  const p21 = deJ21.length === 1 ? deJ21[0]! : null;
  const p28 = deJ28.length === 1 ? deJ28[0]! : null;
  if (!p21 && !p28) return null;
  const naixement = p21?.naixement ?? (p28?.naixement === null || p28?.naixement === undefined ? null : String(p28.naixement));
  const defuncio = p28?.defuncio ?? null;
  const carrecs = [
    ...new Map(
      (p21?.carrecs ?? []).map((c) => [`${c.nom}|${c.inici ?? ""}|${c.fi ?? ""}`, { nom: c.nom, inici: c.inici, fi: c.fi }]),
    ).values(),
  ].sort((a, b) => (b.inici ?? "").localeCompare(a.inici ?? ""));
  const ocupacions = p21?.ocupacions ?? [];
  const viquipedia = p21?.viquipedia ?? null;
  // Una fitxa que no diu res —ni data, ni ofici, ni càrrec, ni article— no és
  // cap dada, i el bloc no s'escriu.
  if (naixement === null && defuncio === null && carrecs.length === 0 && ocupacions.length === 0 && viquipedia === null) {
    return null;
  }
  const qid = p21?.qid ?? p28!.qid;
  return {
    qid,
    url: p21?.url ?? `https://www.wikidata.org/wiki/${qid}`,
    viquipedia,
    ocupacions,
    carrecs,
    aparellat: p21?.aparellat ?? false,
    naixement,
    defuncio,
    font: trajectoria?.font ?? fotos?.font ?? "Wikidata",
    llicencia: trajectoria?.llicenciaDades ?? fotos?.llicenciaDades ?? "CC0 1.0",
    consultat: trajectoria?.descarregat ?? fotos?.consultat ?? null,
  };
}

/** Un pas per l'alcaldia, posat en ordre: qui, quan i en quin mandat. */
type Pas = FilaHistorial & { clau: string; anyInici: number; anyFi: number };

/**
 * Tots els passos per l'alcaldia en ordre cronològic: per mandat i, dins del
 * mandat, per data de presa de possessió. Una fila sense data va primer: a
 * l'historial, qui no en té és qui va sortir del ple de constitució, i qui va
 * arribar després sempre la porta.
 */
function passos(historial: HistorialAlcaldies): Pas[] {
  const ordenats = historial.history
    .map((h) => {
      const anys = anysDelTerm(h.term);
      return { ...h, clau: normalizePersonName(h.name), anyInici: anys.inici, anyFi: anys.fi };
    })
    .filter((h) => h.clau !== "")
    .sort((a, b) => a.term.localeCompare(b.term) || (a.tookOfficeOn ?? "").localeCompare(b.tookOfficeOn ?? ""));
  return unificaVariants(ordenats);
}

/** Distància d'edició entre dues cadenes curtes (Levenshtein), per a cognoms amb una lletra de més. */
function distancia(a: string, b: string): number {
  const fila = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let anterior = fila[0]!;
    fila[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = fila[j]!;
      fila[j] = Math.min(fila[j]! + 1, fila[j - 1]! + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1));
      anterior = temp;
    }
  }
  return fila[b.length]!;
}

/**
 * La mateixa persona escrita de dues maneres és una sola persona.
 *
 * L'historial de la Generalitat escriu el nom a cada mandat, i a Alcanar hi
 * havia «Alfons Monserrat Esteller» i «Alfons Montserrat Esteller», i «Joan
 * B. Beltran Queralt» i «Juan Bautista Beltran Queralt»: quatre fitxes per a
 * dues persones, i cap de les dues amb la trajectòria sencera. Dins d'un
 * mateix municipi, dos noms amb els mateixos cognoms (o amb una lletra de
 * diferència) i la mateixa inicial del nom es donen per la mateixa persona,
 * i la clau que mana és la del mandat més recent, que és també la que fa el
 * slug de la fitxa a totes les pàgines. Entre municipis no es fusiona res.
 */
function unificaVariants(ordenats: Pas[]): Pas[] {
  const parts = (clau: string): { inicial: string; cognoms: string } => {
    const tokens = clau.split(/\s+/).filter((t) => t.length > 0);
    const cognoms = tokens.length >= 3 ? tokens.slice(-2).join(" ") : tokens.slice(-1).join(" ");
    return { inicial: tokens[0]?.[0] ?? "", cognoms };
  };
  const mateixa = (a: string, b: string): boolean => {
    const pa = parts(a);
    const pb = parts(b);
    if (pa.inicial === "" || pa.inicial !== pb.inicial || pa.cognoms.length < 5) return false;
    return pa.cognoms === pb.cognoms || distancia(pa.cognoms, pb.cognoms) <= 1;
  };
  // Del més recent al més antic: cada clau nova busca una de posterior amb qui
  // s'assembli, i s'hi ajunta. Així la canònica és sempre la del mandat més tard.
  const canonica = new Map<string, string>();
  const claus = [...new Set([...ordenats].reverse().map((p) => p.clau))];
  for (const clau of claus) {
    const iguals = claus.find((c) => canonica.has(c) && c !== clau && mateixa(c, clau));
    canonica.set(clau, iguals ? canonica.get(iguals)! : clau);
  }
  return ordenats.map((p) => ({ ...p, clau: canonica.get(p.clau) ?? p.clau }));
}

/** Els dies entre dues dates ISO. */
const dies = (a: string, b: string): number => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/**
 * Quan comença cada pas i quan s'acaba: la seva presa de possessió, i la del
 * pas següent —el relleu dins del mandat, o el primer del mandat vinent—. Si
 * no hi ha pas següent perquè el mandat és el vigent, s'acaba avui. Quan a la
 * font li falta una data, es posa el 15 de juny de l'any del mandat, que és
 * quan es constitueixen els plens amb un marge de setmanes, i es marca com a
 * aproximat: la pàgina diu «uns dotze anys» i no «dotze anys».
 */
function periodes(cadena: readonly Pas[], avui: string): { inici: string; fi: string; aproximat: boolean }[] {
  const inicis = cadena.map((p) => ({ data: p.tookOfficeOn ?? `${p.anyInici}-06-15`, aproximat: p.tookOfficeOn === null }));
  return cadena.map((p, i) => {
    const seguent = inicis[i + 1];
    const inici = inicis[i]!;
    if (seguent) return { inici: inici.data, fi: seguent.data, aproximat: inici.aproximat || seguent.aproximat };
    const mandatObert = p.anyFi > Number(avui.slice(0, 4)) || (p.anyFi === Number(avui.slice(0, 4)) && avui < `${p.anyFi}-06-15`);
    return mandatObert
      ? { inici: inici.data, fi: avui, aproximat: inici.aproximat }
      : { inici: inici.data, fi: `${p.anyFi}-06-15`, aproximat: true };
  });
}

/**
 * Les persones que han tingut l'alcaldia, una per nom normalitzat, amb tots
 * els seus mandats, l'adreça de cadascuna i qui hi havia abans i després.
 * En ordre cronològic del primer mandat.
 */
export function alcaldiesHistoriques(historial: HistorialAlcaldies | null | undefined, opcions: OpcionsAlcaldies = {}): PersonaAlcaldia[] {
  if (!historial || historial.history.length === 0) return [];
  const avui = opcions.avui ?? new Date().toISOString().slice(0, 10);
  const cadena = passos(historial);
  const durades = periodes(cadena, avui);
  const ultim = cadena[cadena.length - 1]!;
  const clauActual = opcions.actual?.nom ? normalizePersonName(opcions.actual.nom) : "";
  const retrats = retratsPerNom(opcions.fotos);

  // Primer les persones i les seves adreces, perquè els veïns de cadascuna
  // s'hi puguin enllaçar al pas següent.
  const persones = new Map<string, PersonaAlcaldia>();
  for (const pas of cadena) {
    if (persones.has(pas.clau)) continue;
    const seus = cadena.filter((p) => p.clau === pas.clau);
    // El nom que dona l'historial al mandat més recent: és el que tindrà el
    // slug, i és el que la pàgina de trajectòries reprodueix.
    const nomFont = seus[seus.length - 1]!.name;
    const actual = ultim.clau === pas.clau;
    const fitxaRegidor = actual && clauActual === pas.clau ? (opcions.actual?.adreca ?? null) : null;
    persones.set(pas.clau, {
      clau: pas.clau,
      nom: nomLlegible(nomFont),
      slug: slugify(nomLlegible(nomFont)),
      adreca: "",
      fitxaRegidor,
      actual,
      mandats: [],
      primerAny: 0,
      ultimAny: 0,
      sigles: seus[seus.length - 1]!.partyRaw,
      color: colorDe(seus[seus.length - 1]!.partyRaw),
      durada: { dies: 0, aproximat: false },
      abans: null,
      despres: null,
      entremig: [],
      retrat: retrats.get(pas.clau) ?? null,
      wikidata: wikidataDe(opcions.trajectoria, opcions.fotos, pas.clau),
    });
  }
  const slugs = new Set<string>();
  for (const persona of persones.values()) {
    let slug = persona.slug;
    if (slugs.has(slug)) {
      let n = 2;
      while (slugs.has(`${slug}-${n}`)) n += 1;
      slug = `${slug}-${n}`;
    }
    slugs.add(slug);
    persona.slug = slug;
    persona.adreca = persona.fitxaRegidor ?? `alcaldia/${slug}/`;
  }
  const vei = (pas: Pas): VeiAlcaldia => {
    const p = persones.get(pas.clau)!;
    return { nom: p.nom, clau: p.clau, adreca: p.adreca, term: pas.term, tookOfficeOn: pas.tookOfficeOn };
  };

  // Ara els mandats, amb els relleus que diu la mètrica de canvis.
  for (const [i, pas] of cadena.entries()) {
    const persona = persones.get(pas.clau)!;
    const canvi = historial.changes.find((c) => c.term === pas.term) ?? null;
    const ordre = canvi ? canvi.mayors.map((m) => normalizePersonName(m.name)) : [];
    const pos = ordre.indexOf(pas.clau);
    const arriba = canvi !== null && pos >= 0 && (canvi.onlySuccessorKnown ? pos === 0 : pos > 0);
    const marxa = canvi !== null && !canvi.onlySuccessorKnown && pos >= 0 && pos < ordre.length - 1;
    const anterior = cadena[i - 1];
    const seguent = cadena[i + 1];
    persona.mandats.push({
      term: pas.term,
      anyInici: pas.anyInici,
      anyFi: pas.anyFi,
      partyRaw: pas.partyRaw,
      tookOfficeOn: pas.tookOfficeOn,
      arribaAMigMandat: arriba,
      marxaAMigMandat: marxa,
      abansEnElMandat: arriba && anterior && anterior.term === pas.term ? vei(anterior) : null,
      despresEnElMandat: marxa && seguent && seguent.term === pas.term ? vei(seguent) : null,
      resultat: resultatDeLaLlista(opcions.results, pas.term, pas.partyRaw),
    });
    const durada = durades[i]!;
    persona.durada.dies += Math.max(0, dies(durada.inici, durada.fi));
    persona.durada.aproximat = persona.durada.aproximat || durada.aproximat;
  }

  // I els veïns: qui hi havia just abans del primer pas i just després de
  // l'últim, i qui hi va haver entre dos passos no consecutius.
  for (const persona of persones.values()) {
    const indexs = cadena.map((p, i) => (p.clau === persona.clau ? i : -1)).filter((i) => i >= 0);
    const primer = indexs[0]!;
    const darrer = indexs[indexs.length - 1]!;
    persona.abans = primer > 0 ? vei(cadena[primer - 1]!) : null;
    persona.despres = darrer < cadena.length - 1 ? vei(cadena[darrer + 1]!) : null;
    const entremig = new Map<string, VeiAlcaldia>();
    for (let i = primer + 1; i < darrer; i += 1) {
      const pas = cadena[i]!;
      if (pas.clau !== persona.clau && !entremig.has(pas.clau)) entremig.set(pas.clau, vei(pas));
    }
    persona.entremig = [...entremig.values()];
    persona.primerAny = anyDInici(persona.mandats[0]!);
    persona.ultimAny = anyDeFi(persona.mandats[persona.mandats.length - 1]!);
  }
  return [...persones.values()];
}

/** L'any en què va començar de debò un mandat: el de la presa de possessió si la sabem. */
const anyDInici = (m: Mandat): number => (m.tookOfficeOn ? Number(m.tookOfficeOn.slice(0, 4)) : m.anyInici);

/** L'any en què va acabar: el del relleu si va plegar abans d'hora, i si no, el del mandat. */
const anyDeFi = (m: Mandat): number =>
  m.marxaAMigMandat && m.despresEnElMandat?.tookOfficeOn ? Number(m.despresEnElMandat.tookOfficeOn.slice(0, 4)) || m.anyFi : m.anyFi;

/** El color de la marca del partit, per a les inicials; `null` si no la sabem. */
function colorDe(partyRaw: string | null): string | null {
  const familia = partyRaw ? siglesFamily(partyRaw) : null;
  return familia && familia !== "local" ? (BRANDS_BY_ID.get(familia)?.color ?? null) : null;
}

/**
 * L'adreça de cada persona de l'historial, per nom normalitzat: el que la
 * taula d'alcaldies de la fitxa municipal necessita per enllaçar cada fila.
 * Relatives a `m/<slug>/`.
 */
export function adrecesAlcaldies(persones: readonly PersonaAlcaldia[]): ReadonlyMap<string, string> {
  return new Map(persones.map((p) => [p.clau, p.adreca]));
}

// ─────────────────────────────────────────────────────────────────────────────
// Les frases
// ─────────────────────────────────────────────────────────────────────────────

/** «2015-2023», o «des del 2019» si encara hi és. */
export function anysDeLaPersona(p: PersonaAlcaldia): string {
  if (p.actual) return `des del ${p.primerAny}`;
  return p.primerAny === p.ultimAny ? String(p.primerAny) : `${p.primerAny}-${p.ultimAny}`;
}

/**
 * Els mateixos anys, però per períodes: «2003-2023», o «1991-1995 i 2003-2011»
 * quan hi va haver algú altre entremig. És el que ensenya el cercador al
 * costat del nom, on «1991-2011» faria pensar en vint anys seguits que no ho
 * van ser. Dos mandats van junts si el segon comença l'any que acaba el
 * primer i cap relleu a mig mandat no hi posa una altra persona pel mig; si
 * encara hi és, l'últim període diu «des del», com `anysDeLaPersona()`.
 */
export function periodesDeLaPersona(p: PersonaAlcaldia): string {
  const trams: { inici: number; fi: number }[] = [];
  let anterior: Mandat | null = null;
  for (const m of p.mandats) {
    const seguit = anterior !== null && m.anyInici === anterior.anyFi && !anterior.marxaAMigMandat && !m.arribaAMigMandat;
    if (seguit) trams[trams.length - 1]!.fi = anyDeFi(m);
    else trams.push({ inici: anyDInici(m), fi: anyDeFi(m) });
    anterior = m;
  }
  return llistaAmbI(
    trams.map((t, i) =>
      p.actual && i === trams.length - 1 ? `des del ${t.inici}` : t.inici === t.fi ? String(t.inici) : `${t.inici}-${t.fi}`,
    ),
  );
}

/** «un mandat», «dos mandats», «tres mandats»… */
function quantsMandats(n: number): string {
  const noms = ["cap mandat", "un mandat", "dos mandats", "tres mandats", "quatre mandats", "cinc mandats", "sis mandats", "set mandats", "vuit mandats", "nou mandats", "deu mandats", "onze mandats", "dotze mandats"];
  return noms[n] ?? `${n} mandats`;
}

/**
 * La durada escrita: «12 anys», «3 anys i 7 mesos», «10 mesos», i «uns 12
 * anys» quan alguna data falta i s'ha hagut de suposar.
 */
export function duradaEscrita(durada: { dies: number; aproximat: boolean }): string {
  const mesos = Math.round(durada.dies / 30.4375);
  const anys = Math.floor(mesos / 12);
  const resta = mesos % 12;
  if (durada.aproximat) {
    const arrodonits = Math.round(mesos / 12);
    return arrodonits === 0 ? "menys d'un any" : arrodonits === 1 ? "prop d'un any" : `uns ${arrodonits} anys`;
  }
  const elsMesos = resta === 1 ? "1 mes" : `${resta} mesos`;
  if (anys === 0) return mesos === 0 ? "menys d'un mes" : elsMesos;
  const elsAnys = anys === 1 ? "1 any" : `${anys} anys`;
  return resta === 0 ? elsAnys : `${elsAnys} i ${elsMesos}`;
}

/** «segona», «tercera»… la força que va ser una llista per vots. */
function ordinalForca(n: number): string {
  const noms = ["primera", "segona", "tercera", "quarta", "cinquena", "sisena", "setena", "vuitena", "novena", "desena"];
  return noms[n - 1] ?? `${n}a`;
}

/** «alcalde», «alcaldessa» o, quan cap font ho diu, «a l'alcaldia». */
function carrecEscrit(genere: Genere | null, municipi: string): string {
  return genere ? `${genere} ${de(municipi)}` : `a l'alcaldia ${de(municipi)}`;
}

/** El títol: «Joan Roig Castell, alcalde d'Alcanar (2015-2023)», o el que hi càpiga. */
export function titolAlcaldia(p: PersonaAlcaldia, municipi: string, genere: Genere | null): string {
  const carrec = carrecEscrit(genere, municipi);
  return titolQueCap([
    `${p.nom}, ${carrec} (${anysDeLaPersona(p)})`,
    `${p.nom}, ${carrec}`,
    `${p.nom} (${anysDeLaPersona(p)})`,
    p.nom,
  ]);
}

/** La descripció per al cercador: mandats, partit, i qui hi havia abans i després. */
export function descripcioAlcaldia(p: PersonaAlcaldia, municipi: string, genere: Genere | null): string {
  const carrec = genere ? `${genere.charAt(0).toUpperCase()}${genere.slice(1)} ${de(municipi)}` : `A l'alcaldia ${de(municipi)}`;
  const mandats = quantsMandats(p.mandats.length);
  const partit = p.sigles ? ` per ${p.sigles}` : "";
  return frasesQueCaben([
    [
      `${carrec} durant ${mandats} (${anysDeLaPersona(p)})${partit}.`,
      `${carrec} (${anysDeLaPersona(p)})${partit}.`,
      `${carrec} (${anysDeLaPersona(p)}).`,
    ],
    p.abans ? `Abans, ${p.abans.nom}.` : null,
    p.despres ? `Després, ${p.despres.nom}.` : null,
    "Mandats, resultats i trajectòria, amb la font de cada dada.",
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// La pàgina
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Només el que és d'aquesta pàgina. La capçalera, els blocs, la lletra petita
 * i les pastilles vénen de `RADIOGRAFIA_CSS`; el retrat gran i les etiquetes
 * són els mateixos que la fitxa de regidor, que els té privats, i es tornen a
 * escriure aquí amb les mateixes mides perquè les dues pàgines de persona es
 * vegin iguals.
 */
const CSS = `
.persona{display:flex;gap:var(--e3);align-items:center;flex-wrap:wrap;margin-top:var(--e3)}
.persona .retrat-gran{width:120px;height:120px;border-radius:var(--r-m);border:2.5px solid var(--ink);
  box-shadow:var(--ombra);object-fit:cover;object-position:center 20%;background:var(--paper-2)}
.persona .inicials-gran{width:120px;height:120px;border-radius:var(--r-m);border:2.5px solid var(--ink);
  box-shadow:var(--ombra);display:flex;align-items:center;justify-content:center;
  font-family:var(--display);font-weight:900;font-size:2.6rem;background:var(--c,var(--paper-2));color:var(--t,inherit)}
.persona .amb-credit{display:flex;flex-direction:column;gap:6px;align-items:flex-start;max-width:100%}
.persona .amb-credit .credit-retrat{max-width:220px}
.etiquetes{display:flex;gap:8px;flex-wrap:wrap;margin-top:var(--e2)}
.etiquetes span:not(.sigla),.etiquetes a:not(.sigla){border:2px solid var(--ink);border-radius:var(--r-max);padding:4px 14px;
  font-size:.8rem;font-weight:800;flex:none;white-space:nowrap;max-width:100%;text-decoration:none}
.etiquetes .sigla{flex:none;font-size:.86rem;padding:3px 12px}
.etiquetes .alcaldia-etiqueta{background:var(--coral);color:#FBF7EE;text-transform:uppercase;letter-spacing:.08em;font-size:.68rem}
.etiquetes .vigent{background:var(--menta);color:#1E1B2E}
.nav-fitxa{display:flex;gap:7px;flex-wrap:wrap;margin:var(--e2) 0 0;padding:0;list-style:none}
.nav-fitxa a{display:block;border:1.5px solid var(--vora);border-radius:999px;padding:5px 10px;font-size:.76rem;font-weight:800;text-decoration:none}
.nav-fitxa a:hover,.nav-fitxa a:focus-visible{border-color:var(--coral);color:var(--coral)}
/* Un mandat per targeta: els anys grans, el partit al costat, i sota, en
   frases, el que en sabem. Les xifres de la llista van en negreta perquè són
   el que es busca. */
.mandats{list-style:none;margin:var(--e3) 0 0;padding:0;display:grid;gap:var(--e2)}
.mandats li{background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);box-shadow:var(--ombra);
  padding:var(--e2) var(--e3);display:flex;flex-direction:column;gap:6px}
.mandats .mandat-cap{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.mandats .mandat-anys{font-family:var(--display);font-weight:900;font-size:1.35rem;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.mandats p{margin:0;font-size:.94rem}
.mandats .relleu{font-weight:700}
.mandats .marca-canvi{margin-left:4px}
/* Abans i després: dues targetes cara a cara, amb la fletxa que diu el sentit. */
.veins{list-style:none;margin:var(--e3) 0 0;padding:0;display:grid;gap:var(--e2);grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
.veins li{display:flex;flex-direction:column;gap:4px;border-top:2.5px solid var(--ink);padding-top:var(--e2)}
.veins .etq{font-size:.72rem;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-suau);font-weight:800}
.veins .qui{font-family:var(--display);font-weight:900;font-size:1.1rem;letter-spacing:-.01em}
.veins .quan{font-size:.82rem;color:var(--ink-suau);font-weight:700}
.fets{list-style:none;margin:var(--e2) 0 0;padding:0;display:grid;gap:8px}
.fets li{display:grid;grid-template-columns:7rem 1fr;gap:var(--e2);border-top:1.5px solid var(--vora);padding-top:8px}
.fets .etq{font-size:.72rem;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-suau);font-weight:800;padding-top:3px}
.salts{list-style:none;margin:var(--e2) 0 0;padding:0}
.salts li{display:flex;gap:var(--e2);align-items:baseline;flex-wrap:wrap;border-top:1.5px solid var(--vora);padding:8px 0}
.salts .quan{font-size:.82rem;color:var(--ink-suau);font-weight:700;font-variant-numeric:tabular-nums}
@media (max-width:480px){.fets li{grid-template-columns:1fr;gap:2px}}
`;

export type MunicipiAlcaldia = { nom: string; slug: string; comarca: string | null };

export type ContextAlcaldia = {
  generatedAt: string;
  /** «alcalde» o «alcaldessa» quan una font ho diu; `null` és «a l'alcaldia». */
  genere: Genere | null;
  /** El dia d'avui en ISO, per a l'edat; si no es diu, el del rellotge. */
  avui?: string;
};

/** «A, B i C»: una llista escrita com es diu. */
const llistaAmbI = (parts: readonly string[]): string =>
  parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} i ${parts[parts.length - 1]}`;

const enllacVei = (v: VeiAlcaldia): string => `<a href="../../${escape(v.adreca)}">${escape(v.nom)}</a>`;

/** «des del 2015 fins al 2023», per a les targetes dels veïns. */
function quanVei(v: VeiAlcaldia): string {
  return `mandat ${escape(v.term)}`;
}

/** «d'<b>ERC-AM</b>», «de <b>CiU</b>»: la sigla en negreta darrere la preposició que li toca. */
const llistaDe = (sigles: string): string => {
  const frase = de(sigles);
  const on = frase.indexOf(sigles);
  return on < 0 ? escape(frase) : `${escape(frase.slice(0, on))}<b>${escape(sigles)}</b>`;
};

function renderMandats(p: PersonaAlcaldia): string {
  const targetes = p.mandats.map((m) => {
    const partit = m.partyRaw ? sigla(m.partyRaw, { base: BASE, color: p.color }) : `<span class="secundari">partit no consignat</span>`;
    const possessio = m.tookOfficeOn
      ? `<p>Va prendre possessió ${elDia(m.tookOfficeOn)}.</p>`
      : `<p class="secundari">La font no en dona la data de presa de possessió.</p>`;
    const arribada = m.arribaAMigMandat
      ? `<p class="relleu">Va arribar a mig mandat${m.abansEnElMandat ? `, rellevant ${enllacVei(m.abansEnElMandat)}` : ""}.
         <span class="marca-canvi">relleu sense urnes</span></p>`
      : "";
    const marxa = m.marxaAMigMandat
      ? `<p class="relleu">Va deixar l'alcaldia abans d'acabar el mandat${
          m.despresEnElMandat ? `: hi va seguir ${enllacVei(m.despresEnElMandat)}` : ""
        }. La font no en diu el motiu, i nosaltres tampoc.</p>`
      : "";
    const r = m.resultat;
    const resultat = r
      ? `<p class="resultat">A les municipals del ${r.any}, la llista ${llistaDe(r.sigles)} va treure
         <b>${number(r.vots)} vots</b> (${r.percentatge.toLocaleString("ca-ES")} %) i <b>${r.regidories} de les ${r.deRegidories} regidories</b>:
         va ser la ${ordinalForca(r.forca)} força de ${r.forces}.</p>`
      : "";
    return `<li>
      <div class="mandat-cap"><b class="mandat-anys">${escape(m.term)}</b>${partit}</div>
      ${possessio}${arribada}${marxa}${resultat}
    </li>`;
  });
  return `<section class="bloc" id="mandats">
    <h2>${p.mandats.length === 1 ? "El mandat" : "Els mandats"}</h2>
    <p class="entrada-bloc">${
      p.mandats.length === 1 ? "Un mandat a l'alcaldia" : `${quantsMandats(p.mandats.length).replace(/^./, (c) => c.toUpperCase())} a l'alcaldia`
    }, ${p.actual ? `des del ${p.primerAny} i encara en curs` : `del ${p.primerAny} al ${p.ultimAny}`}:
    <b>${escape(duradaEscrita(p.durada))}</b> en total${p.durada.aproximat ? ", comptats amb els anys dels mandats perquè a la font li falta alguna data" : ", de presa de possessió a relleu"}.</p>
    <ol class="mandats">${targetes.join("")}</ol>
    <p class="nota">Historial d'alcaldes i alcaldesses 1979-2027 de la Generalitat de Catalunya (Dades Obertes,
    conjunt <code>2v2p-vu4h</code>). Els resultats de cada llista són els de les municipals del mateix any segons
    el Departament d'Acció Exterior i Govern Obert; només es diuen quan la sigla de l'alcaldia lliga amb una sola llista.</p>
  </section>`;
}

function renderVeins(p: PersonaAlcaldia): string {
  if (!p.abans && !p.despres) return "";
  const targeta = (etq: string, v: VeiAlcaldia | null, buit: string): string =>
    `<li><span class="etq">${etq}</span>${
      v ? `<span class="qui">${enllacVei(v)}</span><span class="quan">${quanVei(v)}</span>` : `<span class="quan">${buit}</span>`
    }</li>`;
  return `<section class="bloc" id="abans-despres">
    <h2>Abans i després</h2>
    <ul class="veins">
      ${targeta("Abans", p.abans, "Ningú a l'historial: és la primera alcaldia des del 1979")}
      ${targeta("Després", p.despres, p.actual ? "Encara hi és" : "L'historial no en diu res")}
    </ul>
    ${
      p.entremig.length > 0
        ? `<p class="nota-linia">Entre els seus mandats hi va haver ${llistaAmbI(p.entremig.map(enllacVei))}.</p>`
        : ""
    }
  </section>`;
}

/** «des del 2003», «2003–2007», «2003», per als càrrecs de Wikidata. */
function anysDelCarrec(inici: string | null, fi: string | null): string {
  if (inici === null) return fi === null ? "" : `fins al ${fi.slice(0, 4)}`;
  const desDe = inici.slice(0, 4);
  if (fi === null) return `des del ${desDe}`;
  const fins = fi.slice(0, 4);
  return fins === desDe ? desDe : `${desDe}–${fins}`;
}

/**
 * L'edat només quan es pot dir sense por: cap defunció consignada i menys de
 * 95 anys. Wikidata no sempre sap qui ha mort, i escriure «té 104 anys» d'algú
 * és el tipus d'error que una pàgina amb nom i cognoms no es pot permetre.
 */
export function fraseNaixement(w: WikidataAlcaldia, avui: string): string {
  if (w.naixement === null) return "";
  const esData = w.naixement.length >= 10;
  const naixement = esData ? `Va néixer ${elDia(w.naixement)}` : `Va néixer el ${w.naixement}`;
  if (w.defuncio !== null) return `${naixement} i va morir el ${w.defuncio}.`;
  const anyNaix = Number(w.naixement.slice(0, 4));
  const anyAvui = Number(avui.slice(0, 4));
  let edat = anyAvui - anyNaix;
  if (esData && avui.slice(5) < w.naixement.slice(5, 10)) edat -= 1;
  return edat >= 0 && edat < 95 ? `${naixement} (${edat} anys).` : `${naixement}.`;
}

function renderWikidata(p: PersonaAlcaldia, avui: string): string {
  const w = p.wikidata;
  if (!w) return "";
  const fet = (etq: string, text: string): string => `<li><span class="etq">${etq}</span><span class="fet">${text}</span></li>`;
  const fets: string[] = [];
  const naixement = fraseNaixement(w, avui);
  if (naixement) fets.push(fet("Naixement", escape(naixement)));
  if (w.ocupacions.length > 0) fets.push(fet("Ofici", escape(w.ocupacions.join(", "))));
  if (w.viquipedia) fets.push(fet("Article", `<a href="${escape(w.viquipedia)}" rel="noopener nofollow">a la Viquipèdia</a>`));
  const salts = w.carrecs
    .map((c) => {
      const quan = anysDelCarrec(c.inici, c.fi);
      return `<li>${escape(c.nom)}${quan === "" ? "" : `<span class="quan">${escape(quan)}</span>`}</li>`;
    })
    .join("");
  return `<section class="bloc" id="mes-enlla">
    <h2>Més enllà de l'ajuntament</h2>
    <p class="entrada-bloc">El que Wikidata en sap, a més de l'alcaldia.</p>
    ${fets.length > 0 ? `<ul class="fets">${fets.join("")}</ul>` : ""}
    ${
      w.carrecs.length === 0
        ? ""
        : `<p class="ofici-abans">${w.carrecs.length === 1 ? "També ha ocupat aquest càrrec" : "També ha ocupat aquests càrrecs"}
           per sobre del seu ajuntament, i per això és a <a href="${BASE}trajectoria/">la llista de qui ha fet el salt</a>:</p>
           <ul class="salts">${salts}</ul>`
    }
    <p class="nota">${escape(w.font)}, ítem <a href="${escape(w.url)}" rel="noopener nofollow">${escape(w.qid)}</a>${
      w.consultat === null ? "" : `, consultat ${escape(elDia(w.consultat))}`
    }. Les dades de Wikidata són <b>${escape(w.llicencia)}</b>.${
      w.aparellat
        ? " El nom i les dates lliguen amb el nostre historial oficial d'alcaldies."
        : " <b>L'hem lligada només pel nom</b>, dins d'aquest mateix municipi: és el que diu Wikidata, no una comprovació nostra."
    } Wikidata l'escriu qui vol, i cobreix molt millor la gent coneguda: que aquí no hi surti res d'algú
    no vol dir que no hagi estat enlloc.</p>
  </section>`;
}

function personaJsonLd(p: PersonaAlcaldia, municipi: MunicipiAlcaldia, url: string, genere: Genere | null): Record<string, unknown> {
  const partitId = p.sigles ? partitDe(p.sigles) : null;
  const partit = partitId ? { id: partitId, name: BRANDS_BY_ID.get(partitId)?.name ?? p.sigles! } : null;
  const carrec = genere ? `${genere.charAt(0).toUpperCase()}${genere.slice(1)} ${de(municipi.nom)}` : `Titular de l'alcaldia ${de(municipi.nom)}`;
  return {
    "@type": "Person",
    name: p.nom,
    jobTitle: carrec,
    url,
    image: p.retrat ? new URL(p.retrat.cami, url).href : undefined,
    birthDate: p.wikidata?.naixement ?? undefined,
    worksFor: {
      "@type": "GovernmentOrganization",
      name: `Ajuntament ${de(municipi.nom)}`,
      url: `${SITE}/observatori/m/${municipi.slug}/`,
    },
    memberOf: partit ? { "@type": "Organization", name: partit.name, url: `${SITE}/observatori/partit/${partit.id}/` } : undefined,
  };
}

export function renderAlcaldiaHistorica(p: PersonaAlcaldia, municipi: MunicipiAlcaldia, ctx: ContextAlcaldia): string {
  const avui = ctx.avui ?? new Date().toISOString().slice(0, 10);
  const inicials = p.nom.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
  const { fons, tinta } = sobreColor(p.color ?? "#8b8b8b");
  // El retrat de Commons porta el crèdit a sota, sempre visible: és la
  // condició de la llicència, i en una pàgina d'una sola cara hi cap sencer.
  const retrat = p.retrat
    ? `<div class="amb-credit"><img class="retrat-gran" src="${escape(p.retrat.cami)}" alt="" width="120" height="120">${creditRetrat(p.retrat)}</div>`
    : `<span class="inicials-gran" style="--c:${fons};--t:${tinta}" aria-hidden="true">${escape(inicials)}</span>`;
  const partitId = p.sigles ? partitDe(p.sigles) : null;
  const partit = partitId ? { id: partitId, name: BRANDS_BY_ID.get(partitId)?.name ?? p.sigles! } : null;

  const url = `${SITE}/observatori/m/${municipi.slug}/alcaldia/${p.slug}/`;
  const fil = filAriadna([
    ...ARREL_OBSERVATORI,
    ...(municipi.comarca ? [{ nom: municipi.comarca, url: `${SITE}/observatori/c/${slugify(municipi.comarca)}/` }] : []),
    { nom: municipi.nom, url: `${SITE}/observatori/m/${municipi.slug}/` },
    { nom: p.nom, url },
  ]);
  const carrec = carrecEscrit(ctx.genere, municipi.nom);
  const entrada = `${carrec.charAt(0).toUpperCase()}${carrec.slice(1)} durant ${quantsMandats(p.mandats.length)} (${anysDeLaPersona(p)})${
    p.sigles ? `, per ${escape(p.sigles)}` : ""
  }.`;
  const wikidata = renderWikidata(p, avui);

  return `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${capSeo({
  titol: titolAlcaldia(p, municipi.nom, ctx.genere),
  descripcio: descripcioAlcaldia(p, municipi.nom, ctx.genere),
  url,
  imatge: imatgeOg(FITXER_OG.alcaldia(municipi.slug, p.slug)),
  tipus: "profile",
  jsonLd: [fil, personaJsonLd(p, municipi, url, ctx.genere)],
})}
${tipografia(BASE)}
<style>${RADIOGRAFIA_CSS}${FOTOS_WIKIMEDIA_CSS}${CSS}</style>
</head>
<body>
<a class="salta" href="#contingut">Ves al contingut</a>
${capcalera(BASE, "cap", "alcaldia històrica")}
${cercador(BASE)}

<main id="contingut">
  <section class="portada">
    <p class="micro"><a href="../../">${escape(municipi.nom)}</a> · <a href="../../#alcaldies">Les alcaldies des del 1979</a></p>
    <h1>${escape(p.nom)}</h1>
    <div class="persona">
      ${retrat}
      <div>
        <p class="entrada" style="margin:0">${entrada}</p>
        <div class="etiquetes">
          ${p.sigles ? sigla(p.sigles, { base: BASE, color: p.color }) : ""}
          <span class="alcaldia-etiqueta">alcaldia ${escape(anysDeLaPersona(p))}</span>
          ${p.actual ? '<span class="vigent">encara hi és</span>' : ""}
          <span>${escape(duradaEscrita(p.durada))} a l'alcaldia</span>
        </div>
      </div>
    </div>
  </section>

  <nav aria-label="Apartats d'aquesta fitxa">
    <ul class="nav-fitxa">
      <li><a href="#mandats">${p.mandats.length === 1 ? "El mandat" : "Els mandats"}</a></li>
      ${p.abans || p.despres ? '<li><a href="#abans-despres">Abans i després</a></li>' : ""}
      ${wikidata ? '<li><a href="#mes-enlla">Trajectòria</a></li>' : ""}
      <li><a href="#fonts">D'on surt</a></li>
    </ul>
  </nav>

  ${renderMandats(p)}

  ${renderVeins(p)}

  ${wikidata}

  <section class="bloc anar">
    <h2>Segueix estirant</h2>
    <ul class="destins">
      <li><a href="../../"><b>La fitxa ${escape(de(municipi.nom))}</b>
        <span>Qui hi mana avui, els comptes i les dotze eleccions des del 1979</span></a></li>
      <li><a href="../../#alcaldies"><b>Les alcaldies des del 1979</b>
        <span>Tots els mandats ${escape(de(municipi.nom))}, amb qui els va tenir</span></a></li>
      ${
        partit
          ? `<li><a href="${BASE}partit/${escape(partit.id)}/"><b>${escape(partit.name)} a tot Catalunya</b>
        <span>On governa, quants regidors té i com li ha anat a cada municipi</span></a></li>`
          : ""
      }
      ${
        municipi.comarca
          ? `<li><a href="${BASE}c/${escape(slugify(municipi.comarca))}/"><b>${escape(municipi.comarca)}</b>
        <span>Qui mana a la comarca, municipi per municipi</span></a></li>`
          : ""
      }
    </ul>
  </section>

  <section class="bloc fonts" id="fonts">
    <h2>D'on surt</h2>
    <p class="nota">Els mandats, el partit i les dates de presa de possessió són de l'historial d'alcaldes i
    alcaldesses 1979-2027 que publica la Generalitat de Catalunya a Dades Obertes; els resultats de cada llista,
    dels resultats oficials de les municipals. ${
      p.wikidata ? "La resta és de Wikidata, citat al seu bloc. " : ""
    }${
      p.retrat
        ? "El retrat és de Wikimedia Commons, amb l'autoria i la llicència al peu de la imatge. "
        : "No en tenim cap retrat amb llicència lliure, i per això surten les inicials. "
    }Hi publiquem el que deriva del càrrec públic i <b>cap dada de contacte</b>; retirem el retrat a la primera
    petició de la persona, sense demanar-ne el motiu.</p>
  </section>
</main>
${peu(BASE, ctx.generatedAt)}

</body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// La redirecció de qui ja té fitxa
// ─────────────────────────────────────────────────────────────────────────────

/** La marca que distingeix una redirecció d'una fitxa, per no posar-la al sitemap. */
const MARCA_REDIRECCIO = 'http-equiv="refresh"';

/**
 * La pàgina que hi ha a `alcaldia/<slug>/` de qui té l'alcaldia avui i ja té
 * fitxa de regidor: una redirecció a aquella, amb la canònica que hi apunta i
 * `noindex`, perquè per al cercador només hi hagi una pàgina d'aquesta
 * persona. No va al sitemap: `esRedireccioAlcaldia()` la reconeix.
 */
export function renderRedireccioAlcaldia(p: PersonaAlcaldia, municipi: MunicipiAlcaldia): string {
  const desti = `../../${p.fitxaRegidor ?? ""}`;
  const canonica = `${SITE}/observatori/m/${municipi.slug}/${p.fitxaRegidor ?? ""}`;
  return `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8">
<meta ${MARCA_REDIRECCIO} content="0; url=${escape(desti)}">
<meta name="robots" content="noindex,follow">
<link rel="canonical" href="${escape(canonica)}">
<title>${escape(p.nom)}</title>
</head>
<body>
<p>${escape(p.nom)} té l'alcaldia ${escape(de(municipi.nom))} avui i la seva fitxa és la de regidor:
<a href="${escape(desti)}">${escape(canonica)}</a>.</p>
</body></html>`;
}

export const esRedireccioAlcaldia = (html: string): boolean => html.includes(`<meta ${MARCA_REDIRECCIO}`);

// ─────────────────────────────────────────────────────────────────────────────
// El gènere, quan una font el diu
// ─────────────────────────────────────────────────────────────────────────────

let sexesCarregats: Promise<ReadonlyMap<string, "H" | "D">> | null = null;

/**
 * El sexe que publica el registre de candidatures (J3/J4, «H» o «D»), per nom
 * normalitzat i per a tot Catalunya, llegit una sola vegada per publicació.
 *
 * És estat de mòdul pel mateix motiu que `fixaXifresPeu()`: el generador
 * escriu 947 municipis en un sol procés, i llegir la taula de persones 947
 * vegades per una dada que hi cap sencera a la memòria no té sentit. Un nom
 * que consta amb els dos sexes —dues persones que es diuen igual— no hi és:
 * val més «a l'alcaldia» que «alcaldessa» a la pàgina d'un home.
 */
export function sexesPerNom(db: Db): Promise<ReadonlyMap<string, "H" | "D">> {
  sexesCarregats ??= (async () => {
    const files = await db.select({ nom: people.fullName, sex: people.sex }).from(people).where(isNotNull(people.sex));
    const vistos = new Map<string, "H" | "D" | null>();
    for (const f of files) {
      if (f.sex !== "H" && f.sex !== "D") continue;
      const clau = normalizePersonName(f.nom);
      if (clau === "") continue;
      const previ = vistos.get(clau);
      vistos.set(clau, previ === undefined || previ === f.sex ? f.sex : null);
    }
    return new Map([...vistos].filter((e): e is [string, "H" | "D"] => e[1] !== null));
  })();
  return sexesCarregats;
}

/**
 * «alcalde», «alcaldessa» o res: el càrrec de la seu electrònica de qui hi és
 * avui mana; si no, el sexe del registre de candidatures; si no, `null`.
 */
export function genereDe(
  clau: string,
  carrecs: readonly { nom: string; carrec: string }[] | null | undefined,
  sexes: ReadonlyMap<string, "H" | "D">,
): Genere | null {
  const deLaSeu = (carrecs ?? []).find((c) => normalizePersonName(c.nom) === clau && esAlcaldia(c.carrec));
  if (deLaSeu) {
    if (/alcaldessa/i.test(deLaSeu.carrec)) return "alcaldessa";
    if (/alcalde\b/i.test(deLaSeu.carrec)) return "alcalde";
  }
  const sexe = sexes.get(clau);
  return sexe === "D" ? "alcaldessa" : sexe === "H" ? "alcalde" : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// L'escriptura
// ─────────────────────────────────────────────────────────────────────────────

/** El que cal de la fitxa municipal carregada per escriure les alcaldies. */
export type DadesPerAlcaldies = Pick<
  RadiografiaData,
  "municipality" | "mayors" | "results" | "government" | "carrecs" | "councillors" | "fotosExalcaldes"
>;

/**
 * L'alcaldia vigent tal com la decideix `resolAlcaldia()` per a tot el web:
 * el nom i, si en té, l'adreça de la fitxa de regidor relativa a `m/<slug>/`.
 */
export function alcaldiaVigent(dades: DadesPerAlcaldies): { nom: string | null; adreca: string | null } {
  const a = resolAlcaldia(dades.carrecs?.carrecs ?? null, dades.government, dades.councillors.map((c) => ({ nom: c.name })));
  return { nom: a.nom, adreca: a.adreca };
}

/**
 * Les fitxes de les alcaldies d'un municipi, a `<outDir><slug>/alcaldia/<persona>/`.
 * Torna quantes fitxes de debò s'han escrit (les redireccions no compten).
 */
export async function escriuAlcaldiesHistoriques(
  db: Db,
  outDir: string,
  dades: DadesPerAlcaldies,
  slug: string,
  generatedAt: string,
  trajectoria: FitxaTrajectoria | null = null,
): Promise<number> {
  const persones = alcaldiesHistoriques(dades.mayors, {
    results: dades.results,
    fotos: dades.fotosExalcaldes ?? null,
    trajectoria,
    actual: alcaldiaVigent(dades),
  });
  if (persones.length === 0) return 0;
  const sexes = await sexesPerNom(db);
  const municipi: MunicipiAlcaldia = { nom: dades.municipality.name, slug, comarca: dades.municipality.comarca ?? null };
  let escrites = 0;
  for (const persona of persones) {
    const dir = `${outDir}${slug}/alcaldia/${persona.slug}`;
    await mkdir(dir, { recursive: true });
    if (persona.fitxaRegidor) {
      await writeFile(`${dir}/index.html`, renderRedireccioAlcaldia(persona, municipi), "utf8");
      continue;
    }
    const genere = genereDe(persona.clau, dades.carrecs?.carrecs ?? null, sexes);
    await writeFile(`${dir}/index.html`, renderAlcaldiaHistorica(persona, municipi, { generatedAt, genere }), "utf8");
    escrites += 1;
  }
  return escrites;
}
