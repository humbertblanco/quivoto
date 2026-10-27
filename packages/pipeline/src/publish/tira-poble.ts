import { BRANDS_BY_ID } from "@quivoto/shared-schemas/brands";
import { familiaDelPartit, type PasAlcaldia } from "../derive/alcaldies";
import { dataCurta, de, nomLlegible, normalizePersonName } from "../lib/text";
import { atributsEtiqueta, textEtiqueta, type DadaEtiqueta } from "./grafics";

/**
 * «La tira del poble»: qui ha tingut l'alcaldia, mandat a mandat, del 1979 al
 * 2027, en una sola franja que es reconeix d'una ullada.
 *
 * Una fitxa municipal té moltes xifres i cap imatge que digui «aquest és el
 * meu poble». La taula «Les alcaldies des del 1979» ho diu tot, però s'ha de
 * llegir fila a fila; la tira ho diu sense llegir: un poble que ha estat de la
 * mateixa força quaranta anys és una franja d'un sol color, un poble
 * d'alternança és un mosaic, i un relleu a mig mandat és una osca. És la idea
 * 15 de `PROPOSTES-DISSENY.md`, i té tres llocs:
 *
 *   · la capçalera de la fitxa (`mida: "gran"`), amb els anys als extrems i la
 *     dada de cada tram en passar-hi el ratolí o tocar-lo;
 *   · cada fila d'els947 i de comarques (`mida: "fina"`), de 6 px d'alt;
 *   · la imatge per a xarxes, que pot llegir les mateixes `DadesTira`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * D'ON SURT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * De l'historial que ja tenim: la mètrica `mayors` de
 * `derive/mayor-changes.ts` (la Generalitat, completada amb Wikidata i el
 * Ministeri per `derive/alcaldies.ts`), que és el mateix `HistorialAlcaldies`
 * que llegeixen la taula de la fitxa i `alcaldia-historica.ts`. Aquí només se
 * n'agafa la forma mínima (`history`, i `changes` si hi és) perquè la tira no
 * depengui de cap dels dos mòduls que la pinten.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * UN BUIT ÉS UN BUIT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Un mandat sense cap fila a l'historial no es pinta del color del d'abans ni
 * del de després: és un tram en blanc que diu «no consta». El mateix amb el
 * tros d'un mandat on la font només sap qui va arribar a mig mandat i no qui
 * hi havia abans (`onlySuccessorKnown`): el principi del mandat queda en
 * blanc i l'osca marca on comença el que sabem. I el tros del mandat en curs
 * que encara no ha passat no és de ningú: queda en blanc fins al 2027.
 *
 * El color és la marca de la força (la família de `familiaDelPartit`, el
 * mateix camí que el punt de color de la taula d'alcaldies) i no diu res més:
 * cap color de veredicte. Una força que no es reconeix va de gris neutre, que
 * no és el mateix que el blanc del «no consta»: el partit hi és, el que no hi
 * ha és una marca a la qual lligar-lo.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Els mandats
// ─────────────────────────────────────────────────────────────────────────────

/** Un mandat municipal, amb el dia en què es van constituir els ajuntaments. */
export type MandatNominal = {
  /** La clau de l'historial: «1979-1983». */
  term: string;
  inici: number;
  fi: number;
  /** Dia de constitució general dels ajuntaments (LOREG art. 195), `AAAA-MM-DD`. */
  constitucio: string;
};

/**
 * Els dotze mandats des de les primeres municipals, amb el dia en què es van
 * constituir els ajuntaments. Tots són de quatre anys i comencen el mateix dia
 * a tot l'Estat: la LOREG no preveu mandats municipals que comencin a mitges.
 *
 * El dia serveix per dues coses: posar l'osca d'un relleu al seu lloc dins del
 * mandat, i decidir si qui apareix sol en un mandat hi va arribar el dia de la
 * constitució o més tard (llavors el principi del mandat no consta). El del
 * 2027 és previst: la constitució ve vint dies després de les eleccions del
 * maig.
 */
export const MANDATS_TIRA: readonly MandatNominal[] = [
  { term: "1979-1983", inici: 1979, fi: 1983, constitucio: "1979-04-19" },
  { term: "1983-1987", inici: 1983, fi: 1987, constitucio: "1983-05-23" },
  { term: "1987-1991", inici: 1987, fi: 1991, constitucio: "1987-06-30" },
  { term: "1991-1995", inici: 1991, fi: 1995, constitucio: "1991-06-15" },
  { term: "1995-1999", inici: 1995, fi: 1999, constitucio: "1995-06-17" },
  { term: "1999-2003", inici: 1999, fi: 2003, constitucio: "1999-07-03" },
  { term: "2003-2007", inici: 2003, fi: 2007, constitucio: "2003-06-14" },
  { term: "2007-2011", inici: 2007, fi: 2011, constitucio: "2007-06-16" },
  { term: "2011-2015", inici: 2011, fi: 2015, constitucio: "2011-06-11" },
  { term: "2015-2019", inici: 2015, fi: 2019, constitucio: "2015-06-13" },
  { term: "2019-2023", inici: 2019, fi: 2023, constitucio: "2019-06-15" },
  { term: "2023-2027", inici: 2023, fi: 2027, constitucio: "2023-06-17" },
];

/** El dia previst de constitució dels ajuntaments que sortiran del maig del 2027. */
export const FI_TIRA = "2027-06-12";

/**
 * Dies de marge sobre la constitució. Qui pren possessió més tard no va sortir
 * del ple de constitució: hi va arribar a mig mandat. És el mateix llindar que
 * `MID_TERM_DAYS` de `derive/mayor-changes.ts`, que no s'exporta; si un canvia,
 * l'altre també.
 */
const MARGE_CONSTITUCIO = 45;

// ─────────────────────────────────────────────────────────────────────────────
// El que arriba i el que en surt
// ─────────────────────────────────────────────────────────────────────────────

/**
 * La forma mínima de l'historial que la tira necessita: la de la mètrica
 * `mayors` (`HistorialAlcaldies` d'`alcaldia-historica.ts`). `changes` és
 * opcional perquè només se'n llegeix `onlySuccessorKnown`.
 */
export type HistorialPerTira = {
  history: readonly PasAlcaldia[];
  changes?: readonly { term: string; onlySuccessorKnown?: boolean }[] | null;
};

/** Un tros d'un mandat amb una persona a l'alcaldia. */
export type TramAlcaldia = {
  tipus: "alcaldia";
  /** El nom ja llegible («Joan Roig i Castell»). */
  nom: string;
  /** El partit tal com el diu la font: Generalitat, si no Wikidata, si no el Ministeri. */
  partit: string | null;
  /** La família de marca, o `null` si el partit no se'n reconeix cap. */
  familia: string | null;
  /** El color de la marca (`#rrggbb`), o `null`: llavors es pinta de gris neutre. */
  color: string | null;
  /** La presa de possessió, si consta. */
  desDe: string | null;
  /** On comença i on acaba dins del mandat, de 0 a 1. */
  de: number;
  fins: number;
  /** Comença a mig mandat: porta osca. */
  relleu: boolean;
  /** No hi ha data de possessió i l'osca s'ha posat a mig camí: es diu a l'etiqueta. */
  posicioAproximada: boolean;
  font: "generalitat" | "wikidata" | "ministeri";
};

/** Un tros d'un mandat que no consta a cap font. */
export type TramBuit = { tipus: "buit"; de: number; fins: number };

/** El tros del mandat en curs que encara no ha passat. */
export type TramFutur = { tipus: "futur"; de: number; fins: number };

export type TramTira = TramAlcaldia | TramBuit | TramFutur;

export type MandatTira = { term: string; inici: number; fi: number; trams: TramTira[] };

export type DadesTira = {
  /** El nom del municipi, per a la frase de l'`aria-label`. */
  municipi: string | null;
  mandats: MandatTira[];
};

// ─────────────────────────────────────────────────────────────────────────────
// L'adaptador: de l'historial a la tira
// ─────────────────────────────────────────────────────────────────────────────

const DIA = 86_400_000;
const dies = (des: string, a: string): number => (Date.parse(a) - Date.parse(des)) / DIA;
const limita = (v: number): number => Math.min(1, Math.max(0, v));
const arrodoneix = (v: number): number => Math.round(v * 10_000) / 10_000;

/** Un color que pot anar dins d'un `style=` sense escapar res. */
const colorSegur = (c: string | null | undefined): string | null => (c && /^#[0-9a-f]{3,8}$/i.test(c) ? c : null);

/**
 * La marca d'un pas: de la sigla de la Generalitat, si no del nom sencer de
 * Wikidata, si no de la llista del Ministeri. És el mateix ordre que fa servir
 * `findChanges()` per decidir si un relleu canvia de mans.
 */
export function familiaDelPas(pas: Pick<PasAlcaldia, "partyRaw" | "partitWikidata" | "llistaMinisteri">): string | null {
  return familiaDelPartit(pas.partyRaw) ?? familiaDelPartit(pas.partitWikidata) ?? familiaDelPartit(pas.llistaMinisteri);
}

/**
 * L'ordre dels passos d'un mandat. Els que tenen data, per data. Els que no en
 * tenen depenen del que diuen els altres: si algú va prendre possessió el dia
 * de la constitució, qui no té data va venir després (al final, amb l'osca
 * aproximada); si ningú no hi és des del principi, qui no té data és qui hi
 * era abans —és el cas habitual de l'historial antic de la Generalitat, que
 * sovint no porta la data del primer alcalde del mandat.
 */
function ordenaPassos(passos: readonly PasAlcaldia[], constitucio: string): PasAlcaldia[] {
  const ambData = passos.filter((p) => p.tookOfficeOn).sort((a, b) => a.tookOfficeOn!.localeCompare(b.tookOfficeOn!));
  const senseData = passos.filter((p) => !p.tookOfficeOn);
  const primer = ambData[0]?.tookOfficeOn;
  const hiEsDesDelPrincipi = primer !== undefined && primer !== null && dies(constitucio, primer) <= MARGE_CONSTITUCIO;
  return hiEsDesDelPrincipi ? [...ambData, ...senseData] : [...senseData, ...ambData];
}

/**
 * Converteix l'historial d'alcaldies en la tira: dotze mandats, i dins de cada
 * un els trams de cada persona, amb on comencen i on acaben (de 0 a 1).
 *
 * La posició d'una osca surt de la data de possessió comparada amb la
 * constitució del mandat i la del següent. Si un relleu no porta data, l'osca
 * va a mig camí entre la de davant i la de darrere i el tram ho diu
 * (`posicioAproximada`): l'ordre el sabem, el dia no.
 *
 * @param historial La mètrica `mayors` tal com la desa `derive/mayor-changes.ts`.
 * @param municipi El nom del municipi, per a l'`aria-label`.
 * @param avui El dia d'avui en ISO; el tros del mandat en curs que encara no
 *   ha passat queda en blanc. Per defecte, el dia en què es publica.
 */
export function tiraDesDeHistorial(
  historial: HistorialPerTira | null | undefined,
  municipi: string | null = null,
  avui: string = new Date().toISOString().slice(0, 10),
): DadesTira {
  const perMandat = new Map<string, PasAlcaldia[]>();
  for (const pas of historial?.history ?? []) {
    const llista = perMandat.get(pas.term) ?? [];
    // Una persona surt un sol cop per mandat, com a `findChanges()`: la
    // Generalitat i Wikidata de vegades escriuen la mateixa fila dues vegades.
    if (!llista.some((p) => normalizePersonName(p.name) === normalizePersonName(pas.name))) llista.push(pas);
    perMandat.set(pas.term, llista);
  }
  const nomesSuccessor = new Set((historial?.changes ?? []).filter((c) => c.onlySuccessorKnown).map((c) => c.term));

  const mandats = MANDATS_TIRA.map((m, i): MandatTira => {
    const final = MANDATS_TIRA[i + 1]?.constitucio ?? FI_TIRA;
    const durada = dies(m.constitucio, final);
    const fraccio = (iso: string): number => limita(dies(m.constitucio, iso) / durada);
    const passos = ordenaPassos(perMandat.get(m.term) ?? [], m.constitucio);
    const trams: TramTira[] = [];

    if (passos.length === 0) trams.push({ tipus: "buit", de: 0, fins: 1 });
    else {
      // On comença cada pas. El primer, al principi del mandat, llevat que
      // la font digui que hi va arribar tard: llavors el principi no consta.
      const inicis: (number | null)[] = passos.map((p) => (p.tookOfficeOn ? fraccio(p.tookOfficeOn) : null));
      const primer = passos[0]!;
      const arribaTard =
        nomesSuccessor.has(m.term) ||
        (primer.tookOfficeOn !== null && dies(m.constitucio, primer.tookOfficeOn) > MARGE_CONSTITUCIO);
      if (!arribaTard) inicis[0] = 0;
      // Els relleus sense data van a mig camí entre els coneguts del costat.
      for (let k = 1; k < inicis.length; k++) {
        if (inicis[k] !== null) continue;
        const abans = inicis[k - 1] ?? 0;
        let j = k + 1;
        while (j < inicis.length && inicis[j] === null) j++;
        const despres = j < inicis.length ? inicis[j]! : 1;
        inicis[k] = abans + (despres - abans) / (j - k + 1);
      }
      // I mai enrere: una data mal escrita no pot fer que un tram acabi abans de començar.
      for (let k = 1; k < inicis.length; k++) inicis[k] = Math.max(inicis[k]!, inicis[k - 1]!);
      if (arribaTard && inicis[0]! > 0) trams.push({ tipus: "buit", de: 0, fins: arrodoneix(inicis[0]!) });
      passos.forEach((p, k) => {
        const familia = familiaDelPas(p);
        trams.push({
          tipus: "alcaldia",
          nom: nomLlegible(p.name),
          partit: p.partyRaw ?? p.partitWikidata ?? p.llistaMinisteri ?? null,
          familia,
          color: colorSegur(familia ? BRANDS_BY_ID.get(familia)?.color : null),
          desDe: p.tookOfficeOn,
          de: arrodoneix(inicis[k]!),
          fins: arrodoneix(k + 1 < passos.length ? inicis[k + 1]! : 1),
          relleu: k > 0 || arribaTard,
          posicioAproximada: k > 0 && p.tookOfficeOn === null,
          font: p.font ?? "generalitat",
        });
      });
    }

    // El que encara no ha passat del mandat en curs no és de ningú.
    if (avui >= m.constitucio && avui < final) {
      const ara = arrodoneix(fraccio(avui));
      const retallats = trams.filter((t) => t.de < ara).map((t) => ({ ...t, fins: Math.min(t.fins, ara) }));
      trams.splice(0, trams.length, ...retallats, { tipus: "futur", de: ara, fins: 1 });
    } else if (avui < m.constitucio) trams.splice(0, trams.length, { tipus: "futur", de: 0, fins: 1 });

    return { term: m.term, inici: m.inici, fi: m.fi, trams: trams.filter((t) => t.fins > t.de) };
  });

  return { municipi, mandats };
}

// ─────────────────────────────────────────────────────────────────────────────
// La frase: el que diu la tira a qui no la veu
// ─────────────────────────────────────────────────────────────────────────────

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** L'any en què comença un tram: el de la possessió si consta, si no el del seu lloc al mandat. */
function anyDInici(t: TramTira, m: MandatTira): number {
  if (t.tipus === "alcaldia" && t.desDe) return Number(t.desDe.slice(0, 4));
  return Math.round(m.inici + t.de * (m.fi - m.inici));
}

/** Una tirada de trams seguits de la mateixa força (o del mateix buit). */
export type TiradaTira = { etiqueta: string; buit: boolean; anyInici: number; anyFi: number | null };

/**
 * Agrupa els trams seguits de la mateixa força, a través dels mandats: «CiU,
 * del 1979 al 2015». La clau és la família de marca quan n'hi ha —«CiU» i
 * «CIU» són la mateixa— i, si no, el partit tal com s'escriu. El tros que
 * encara no ha passat acaba la darrera tirada, que llavors no té any de fi
 * (`null`: «fins ara»).
 */
export function tiradesDeLaTira(dades: DadesTira): TiradaTira[] {
  // Mentre es recorre, l'any de fi d'una tirada oberta és `undefined`: el
  // posa el tram següent que ja no és seu, o el final de la tira.
  type Oberta = Omit<TiradaTira, "anyFi"> & { clau: string; anyFi?: number | null };
  const tirades: Oberta[] = [];
  let tancada = false;
  for (const m of dades.mandats) {
    for (const t of m.trams) {
      const darrera = tirades[tirades.length - 1];
      if (t.tipus === "futur") {
        if (darrera && darrera.anyFi === undefined) darrera.anyFi = null;
        tancada = true;
        continue;
      }
      const clau = t.tipus === "buit" ? "·buit" : (t.familia ?? `·${(t.partit ?? "").trim().toLowerCase()}`);
      if (darrera && darrera.clau === clau && !tancada) continue;
      const any = anyDInici(t, m);
      if (darrera && darrera.anyFi === undefined) darrera.anyFi = any;
      tirades.push({
        clau,
        etiqueta: t.tipus === "buit" ? "no consta" : (t.partit ?? "partit no consta"),
        buit: t.tipus === "buit",
        anyInici: any,
      });
    }
  }
  const ultim = dades.mandats[dades.mandats.length - 1];
  return tirades.map(({ clau: _clau, anyFi, ...t }) => ({ ...t, anyFi: anyFi === undefined ? (ultim?.fi ?? null) : anyFi }));
}

/** Quantes osques té la tira: relleus a mig mandat després d'una alcaldia coneguda. */
export function relleusDeLaTira(dades: DadesTira): number {
  let n = 0;
  for (const m of dades.mandats)
    m.trams.forEach((t, k) => {
      if (t.tipus === "alcaldia" && t.relleu && m.trams[k - 1]?.tipus === "alcaldia") n++;
    });
  return n;
}

/** Els mandats sencers que no consten a cap font (el que encara no ha passat no compta). */
export function mandatsSenseDades(dades: DadesTira): string[] {
  return dades.mandats
    .filter((m) => m.trams.some((t) => t.tipus === "buit") && m.trams.every((t) => t.tipus !== "alcaldia"))
    .map((m) => m.term);
}

const periode = (t: TiradaTira): string =>
  t.anyFi === null ? `del ${t.anyInici} fins ara` : t.anyFi <= t.anyInici ? `el ${t.anyInici}` : `del ${t.anyInici} al ${t.anyFi}`;

/**
 * La frase de l'`aria-label`: el mateix que es veu, dit en una tirada. «Qui ha
 * tingut l'alcaldia d'Alcanar, del 1979 al 2027: no consta, del 1979 al 2003;
 * ERC, del 2003 al 2007; … Un relleu a mig mandat.»
 */
export function resumTira(dades: DadesTira): string {
  const tirades = tiradesDeLaTira(dades);
  const on = dades.municipi ? ` ${de(dades.municipi)}` : "";
  if (tirades.every((t) => t.buit)) return `Qui ha tingut l'alcaldia${on} del 1979 al 2027: no consta a cap font.`;
  const cos = tirades.map((t) => `${t.etiqueta}, ${periode(t)}`).join("; ");
  const relleus = relleusDeLaTira(dades);
  const osques = relleus === 0 ? "" : relleus === 1 ? " Un relleu a mig mandat." : ` ${relleus} relleus a mig mandat.`;
  return `Qui ha tingut l'alcaldia${on}, del 1979 al 2027: ${cos}.${osques}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// El dibuix
// ─────────────────────────────────────────────────────────────────────────────

export type OpcionsTira = {
  /**
   * `gran`: la capçalera de la fitxa, amb els anys als extrems, l'etiqueta de
   * cada tram i la llista amagada per als lectors de pantalla.
   * `fina`: 6 px d'alt per a una fila de llista; només porta l'`aria-label`,
   * perquè 947 files amb dotze mandats cadascuna farien un arbre
   * d'accessibilitat il·legible, i la fila ja enllaça a la fitxa on hi ha tot.
   */
  mida: "gran" | "fina";
};

const pct = (v: number): string => `${Math.round(v * 100_000) / 1000}%`;

/** Els anys que cobreix un tram, per a l'etiqueta: «2013-2015», o el mandat sencer. */
function anysDelTram(t: TramTira, m: MandatTira): string {
  if (t.de === 0 && t.fins === 1) return m.term;
  const inici = anyDInici(t, m);
  const fi = Math.round(m.inici + t.fins * (m.fi - m.inici));
  return inici === fi ? String(inici) : `${inici}-${fi}`;
}

/** La dada que surt en passar per sobre d'un tram, amb el contracte de `GRAFICS_JS`. */
export function etiquetaDelTram(t: TramTira, m: MandatTira): DadaEtiqueta {
  const any = anysDelTram(t, m);
  if (t.tipus === "buit") return { any, valor: "no consta", nota: "cap font no diu qui tenia l'alcaldia" };
  if (t.tipus === "futur") return { any: m.term, valor: "encara no ha passat" };
  const notes = [
    t.font === "wikidata" ? "segons Wikidata" : t.font === "ministeri" ? "segons el Ministeri" : "",
    t.posicioAproximada ? "sense data de possessió: el lloc de l'osca és aproximat" : "",
  ].filter(Boolean);
  return {
    nom: t.nom,
    any,
    valor: t.partit ?? "partit no consta",
    extres: t.desDe ? [{ etq: "presa de possessió", valor: dataCurta(t.desDe) }] : null,
    nota: notes.length ? notes.join("; ") : null,
  };
}

/** Una línia de la llista amagada: «2011-2015: Anna Ferrer Roca (CiU); des del 1 de febrer del 2013, Pere Vidal Mas (CiU)». */
export function liniaDelMandat(m: MandatTira): string {
  const parts = m.trams
    .map((t, k) => {
      if (t.tipus === "futur") return k === 0 ? "encara no ha començat" : "";
      if (t.tipus === "buit") return t.de === 0 && t.fins === 1 ? "no consta" : "el principi del mandat no consta";
      const qui = `${t.nom} (${t.partit ?? "partit no consta"})`;
      return t.relleu && t.desDe ? `des del ${dataCurta(t.desDe)}, ${qui}` : t.relleu ? `després, ${qui}` : qui;
    })
    .filter(Boolean);
  return `${m.term}: ${parts.join("; ")}`;
}

function tramHtml(t: TramTira, m: MandatTira, gran: boolean): string {
  const classes = ["tp-tram", t.tipus === "buit" ? "tp-buit" : t.tipus === "futur" ? "tp-futur" : "", t.tipus === "alcaldia" && t.relleu ? "tp-relleu" : ""]
    .filter(Boolean)
    .join(" ");
  const color = t.tipus === "alcaldia" && t.color ? `;--c:${t.color}` : "";
  const estil = ` style="width:${pct(t.fins - t.de)}${color}"`;
  if (!gran) return `<span class="${classes}"${estil}></span>`;
  const dada = etiquetaDelTram(t, m);
  return `<span class="${classes}"${estil}${atributsEtiqueta(dada)} title="${escape(textEtiqueta(dada))}"></span>`;
}

/**
 * La tira, en HTML i CSS (cap SVG: amb amplades en percentatge s'estira a
 * qualsevol columna, de 360 px a la capçalera ampla, sense `viewBox`).
 *
 * La franja porta `role="img"` i l'`aria-label` de `resumTira()`; els trams de
 * dins són presentació. A la mida gran, cada tram porta els `data-*` de
 * `atributsEtiqueta()` perquè `GRAFICS_JS` hi posi l'etiqueta en passar-hi el
 * ratolí o tocar-lo, i un `title=` amb la mateixa frase per a quan no hi ha
 * script; no són focusables perquè un element amb focus dins d'una imatge és
 * una trampa per al teclat, i qui navega així té la mateixa dada a la llista.
 * La pàgina que la fa servir ha de portar `GRAFICS_JS` i `TIRA_POBLE_CSS`.
 */
export function tiraDelPoble(dades: DadesTira, opcions: OpcionsTira): string {
  const gran = opcions.mida === "gran";
  const franja = dades.mandats
    .map((m) => `<span class="tp-mandat">${m.trams.map((t) => tramHtml(t, m, gran)).join("")}</span>`)
    .join("");
  const etiqueta = escape(resumTira(dades));
  if (!gran) return `<span class="tp tp-fina" role="img" aria-label="${etiqueta}">${franja}</span>`;
  const primer = dades.mandats[0]?.inici ?? 1979;
  const darrer = dades.mandats[dades.mandats.length - 1]?.fi ?? 2027;
  return `<figure class="tp tp-gran">
  <div class="tp-franja" role="img" aria-label="${etiqueta}">${franja}</div>
  <div class="tp-anys" aria-hidden="true"><span>${primer}</span><span>${darrer}</span></div>
  <ul class="nomes-lectors">${dades.mandats.map((m) => `<li>${escape(liniaDelMandat(m))}</li>`).join("")}</ul>
</figure>`;
}

/**
 * L'estil de la tira. Els colors de dada van per `--c` a cada tram; la resta
 * són els tokens de la casa. El blanc del «no consta» és el `--vora` de les
 * línies, i el tros que encara no ha passat és només un contorn discontinu:
 * tots dos són buits, però un és un forat de la font i l'altre és el futur.
 */
export const TIRA_POBLE_CSS = `
.tp{margin:0;min-width:0}
.tp-franja,.tp-fina{display:flex;gap:2px;align-items:stretch}
.tp-gran .tp-franja{height:22px;padding:3px;border:2px solid var(--ink);border-radius:var(--r-s);background:var(--paper-2);margin-top:8px}
.tp-fina{gap:1px;height:6px;width:100%;min-width:72px}
.tp-mandat{display:flex;flex:1 1 0;min-width:0;height:100%}
.tp-tram{display:block;position:relative;height:100%;min-width:1px;box-sizing:border-box;background:var(--c,var(--ink-suau))}
.tp-buit{background:var(--vora)}
.tp-futur{background:transparent}
.tp-gran .tp-futur{border:1.5px dashed var(--vora)}
.tp-gran .tp-mandat:first-child .tp-tram:first-child{border-radius:6px 0 0 6px}
.tp-gran .tp-mandat:last-child .tp-tram:last-child{border-radius:0 6px 6px 0}
.tp-relleu{box-shadow:inset 2px 0 0 var(--paper-2)}
.tp-fina .tp-relleu{box-shadow:inset 1px 0 0 var(--paper)}
.tp-gran .tp-relleu::before{content:"";position:absolute;left:-4px;top:-10px;border:5px solid transparent;border-top-color:var(--ink);border-bottom:0}
.tp-gran .tp-tram[data-valor]{cursor:help}
.tp-gran .tp-tram[data-valor]:hover{outline:2px solid var(--ink);outline-offset:1px;z-index:1}
.tp-anys{display:flex;justify-content:space-between;margin-top:4px;font-size:.78rem;font-weight:800;color:var(--ink-suau);font-variant-numeric:tabular-nums}
`;
