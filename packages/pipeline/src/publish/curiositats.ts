/**
 * Les curiositats: els fets singulars dels 947 que un rànquing no ensenya.
 *
 * Els rànquings de `ranquings.ts` ordenen una mètrica per als 947 municipis
 * i exigeixen que el 90 % la tinguin del mateix any. Hi ha coses que no
 * s'ordenen —qui fa més anys que mana, quin ple és d'una sola llista, quina
 * regidoria ha costat més vots— i que valen per elles mateixes, en una llista
 * de cinc o deu. Són les «dades frikis» de la pàgina, i per això tenen tres
 * regles pròpies:
 *
 *   1. **Cada curiositat diu sobre quants s'ha mirat.** No hi ha llindar del
 *      90 %: una llista de cinc alcaldies amb any de naixement a Wikidata és
 *      publicable si diu «de les 212 alcaldies amb data a Wikidata». La frase
 *      de cobertura és part del fet, no una nota al peu.
 *   2. **Si la dada no hi és, el fet no surt.** Cap curiositat s'escriu amb
 *      una llista buida ni amb un recompte que no s'ha pogut fer.
 *   3. **Cap veredicte.** Que una alcaldia cobri més o que un ple sigui d'una
 *      sola llista es diu tal com és, amb la font i l'any, i que jutgi qui
 *      llegeix.
 *
 * El mòdul té tres peces: `loadCuriositats()` llegeix de la base el que la
 * fila dels 947 no porta (l'historial d'alcaldies, les llistes del 2023, els
 * anys de naixement de Wikidata i la mena de retribució), `preparaCuriositats()`
 * ho converteix en fets amb dades sintètiques o reals —és el que es prova—, i
 * `renderCuriositats()` els escriu amb el mateix llenguatge que la resta de la
 * pàgina de rànquings.
 */

import { and, asc, eq, sql } from "drizzle-orm";
import {
  candidatures, councilTerms, electionResults, mayors, municipalities, municipalityMetrics, type Db,
} from "@quivoto/db";
import { nomLlegible, normalizePersonName, slugify } from "../lib/text";
import { enBlocs } from "./vots-partit";

const escape = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n = (v: number, d = 0): string =>
  v.toLocaleString("ca-ES", { minimumFractionDigits: d, maximumFractionDigits: d });

// ------------------------------------------------------------------- dades

/**
 * El que les curiositats necessiten de cada fila dels 947. És el subconjunt
 * d'`Els947Row` que ja porta la pàgina de rànquings: la fila no es torna a
 * carregar, es comparteix. Tot el que no és la identitat del municipi és
 * opcional perquè `null` i «no hi és» volen dir el mateix: absència.
 */
export type FilaCuriositat = {
  s: string; n: string; c: string; p: number;
  /** regidories del ple */
  r?: number | null;
  /** nom de l'alcaldia, i el camí de la seva fitxa relatiu a `m/<slug>/` («regidor/<persona>/») */
  a?: string | null; ad?: string | null;
  /** dones al ple en percentatge; `null` quan la llista d'electes no és completa */
  f?: number | null;
  /** sou anual de l'alcaldia, només quan és un sou */
  sa?: number | null;
};

/** Un pas per l'alcaldia segons el registre de la Generalitat: el mandat, el nom i la presa de possessió. */
export type PasAlcaldia = { mandat: string; nom: string; possessio: string | null };

/** Una llista amb regidoria a les municipals del 2023. */
export type Llista2023 = { sigles: string; vots: number; regidories: number };

/**
 * El que `loadCuriositats()` llegeix de la base i la fila dels 947 no porta.
 * Tot va indexat per slug, que és la clau que la fila sí que té. Són
 * diccionaris i no mapes perquè es puguin escriure a mà als tests i, si un
 * dia cal, desar-los com a JSON.
 */
export type DadesCuriositats = {
  /** L'historial d'alcaldies des del 1979, mandat a mandat. */
  alcaldies: Record<string, PasAlcaldia[]>;
  /** Les llistes amb regidoria del 2023 i el sistema electoral del municipi. */
  llistes2023: Record<string, Llista2023[]>;
  ple2023: Record<string, { sistema: string; regidories: number }>;
  /** Any de naixement de les persones amb fitxa a Wikidata, per nom normalitzat. */
  naixements: Record<string, Record<string, number>>;
  /** L'alcaldia al full de retribucions del Ministeri: la mena d'import i l'exercici. */
  retribucions: Record<string, { mena: string; euros: number; any: number | null }>;
};

export const DADES_BUIDES: DadesCuriositats = {
  alcaldies: {}, llistes2023: {}, ple2023: {}, naixements: {}, retribucions: {},
};

/** Un camp d'una mètrica com a text, sense portar-ne el document. */
const camp = (path: readonly string[]) =>
  sql<string | null>`${municipalityMetrics.data}#>>${sql.raw(`'{${path.join(",")}}'`)}`;

/** El jsonb pot arribar com a text des del Postgres de debò: es llegeix igual als dos motors. */
const jsonb = <T>(valor: T | string | null): T | null =>
  typeof valor === "string" ? (JSON.parse(valor) as T) : valor;

export async function loadCuriositats(db: Db): Promise<DadesCuriositats> {
  const muns = await db
    .select({ id: municipalities.id, slug: municipalities.slug, sistema: municipalities.electoralSystem })
    .from(municipalities);
  const slugDe = new Map(muns.map((m) => [m.id, m.slug]));
  const sistemaDe = new Map(muns.map((m) => [m.id, m.sistema]));

  // L'historial sencer: 11.873 files de quatre camps, que caben de sobres.
  // No es llegeix de la mètrica «mayors» perquè aquella porta el mateix
  // historial dins d'un document amb els relleus ja calculats, i aquí es
  // recorre mandat a mandat, que és el que la taula ja és.
  const alcaldies: DadesCuriositats["alcaldies"] = {};
  const passos = await db
    .select({ municipalityId: mayors.municipalityId, mandat: mayors.term, nom: mayors.name, possessio: mayors.tookOfficeOn })
    .from(mayors)
    .orderBy(asc(mayors.municipalityId), asc(mayors.term), asc(mayors.tookOfficeOn));
  for (const p of passos) {
    const slug = slugDe.get(p.municipalityId);
    if (!slug) continue;
    (alcaldies[slug] ??= []).push({ mandat: p.mandat, nom: p.nom, possessio: p.possessio });
  }

  const llistes2023: DadesCuriositats["llistes2023"] = {};
  const llistes = await db
    .select({
      municipalityId: candidatures.municipalityId,
      sigles: candidatures.sigles,
      vots: electionResults.votes,
      regidories: electionResults.seats,
    })
    .from(candidatures)
    .innerJoin(electionResults, eq(electionResults.candidatureId, candidatures.id))
    .where(eq(candidatures.electionId, "M20231"));
  for (const l of llistes) {
    const slug = slugDe.get(l.municipalityId);
    if (!slug) continue;
    (llistes2023[slug] ??= []).push({ sigles: l.sigles, vots: l.vots, regidories: l.regidories });
  }

  const ple2023: DadesCuriositats["ple2023"] = {};
  const mandats = await db
    .select({ municipalityId: councilTerms.municipalityId, regidories: councilTerms.seats })
    .from(councilTerms)
    .where(eq(councilTerms.electionId, "M20231"));
  for (const t of mandats) {
    const slug = slugDe.get(t.municipalityId);
    if (slug) ple2023[slug] = { sistema: sistemaDe.get(t.municipalityId) ?? "", regidories: t.regidories };
  }

  /*
   * Els anys de naixement, de dues feines que pregunten el mateix a Wikidata
   * per a gent diferent: J27 per a les persones del ple del 2023 (desa només
   * l'any) i J21 per a qui Wikidata dona com a alcalde del municipi (desa la
   * data). D'aquí només en surt l'any, i només de les persones que J21 ha
   * pogut aparellar amb el nostre historial: una fitxa que no lliga amb cap
   * mandat nostre no ha de posar l'edat a ningú.
   */
  const naixements: DadesCuriositats["naixements"] = {};
  const posaNaixement = (municipalityId: number, nom: string, any: number): void => {
    const slug = slugDe.get(municipalityId);
    if (!slug || !Number.isFinite(any)) return;
    (naixements[slug] ??= {})[normalizePersonName(nom)] = any;
  };
  type PersonaAny = { nom: string; naixement: string | number | null };
  const capsRows = await enBlocs((limit, salta) =>
    db
      .select({
        municipalityId: municipalityMetrics.municipalityId,
        persones: sql<PersonaAny[] | null>`(SELECT jsonb_agg(jsonb_build_object('nom', p->>'nom', 'naixement', p->'naixement'))
          FROM jsonb_array_elements(${municipalityMetrics.data}->'persones') AS p WHERE p->>'naixement' IS NOT NULL)`,
      })
      .from(municipalityMetrics)
      .where(eq(municipalityMetrics.kind, "capsDeLlista"))
      .orderBy(municipalityMetrics.municipalityId)
      .limit(limit)
      .offset(salta),
  );
  for (const fila of capsRows) {
    for (const p of jsonb(fila.persones) ?? []) posaNaixement(fila.municipalityId, p.nom, Number(p.naixement));
  }
  const trajectoriaRows = await enBlocs((limit, salta) =>
    db
      .select({
        municipalityId: municipalityMetrics.municipalityId,
        persones: sql<PersonaAny[] | null>`(SELECT jsonb_agg(jsonb_build_object('nom', p->>'nom', 'naixement', p->>'naixement'))
          FROM jsonb_array_elements(${municipalityMetrics.data}->'persones') AS p
          WHERE p->>'naixement' IS NOT NULL AND (p->>'aparellat')::boolean)`,
      })
      .from(municipalityMetrics)
      .where(eq(municipalityMetrics.kind, "trajectoriaElectes"))
      .orderBy(municipalityMetrics.municipalityId)
      .limit(limit)
      .offset(salta),
  );
  for (const fila of trajectoriaRows) {
    for (const p of jsonb(fila.persones) ?? []) {
      posaNaixement(fila.municipalityId, p.nom, Number(String(p.naixement).slice(0, 4)));
    }
  }

  const retribucions: DadesCuriositats["retribucions"] = {};
  const retribRows = await enBlocs((limit, salta) =>
    db
      .select({
        municipalityId: municipalityMetrics.municipalityId,
        mena: camp(["ministeri", "alcaldia", "mena"]),
        euros: camp(["ministeri", "alcaldia", "euros"]),
        any: camp(["ministeri", "any"]),
      })
      .from(municipalityMetrics)
      .where(and(eq(municipalityMetrics.kind, "retribucions"), sql`${camp(["ministeri", "alcaldia"])} IS NOT NULL`))
      .orderBy(municipalityMetrics.municipalityId)
      .limit(limit)
      .offset(salta),
  );
  for (const r of retribRows) {
    const slug = slugDe.get(r.municipalityId);
    if (!slug || !r.mena) continue;
    retribucions[slug] = { mena: r.mena, euros: Number(r.euros ?? 0), any: r.any === null ? null : Number(r.any) };
  }

  return { alcaldies, llistes2023, ple2023, naixements, retribucions };
}

// -------------------------------------------------------------------- fets

export type FilaCuriosa = {
  municipi: { s: string; n: string; c: string };
  /** La persona de qui és el fet, i on és la seva fitxa (relativa a l'arrel de l'Observatori); `null` si no en té. */
  persona?: { nom: string; href: string | null };
  /** La xifra, ja escrita. */
  valor: string;
  /** El que la xifra no diu sola: les sigles, els vots, les regidories. */
  detall?: string;
};

export type LlistaCuriosa = {
  /** «Els que fa més anys que manen», «Les cinc més poblades de les 185». */
  cap: string;
  files: FilaCuriosa[];
  /** Quants més hi ha amb la mateixa xifra que l'última fila, i que no s'escriuen. */
  empatats?: number;
};

export type Curiositat = {
  id: string;
  titol: string;
  /** Com s'ha mirat, en una frase. */
  metode: string;
  periode: string;
  font: string;
  llistes: LlistaCuriosa[];
  /** Sobre quants municipis o persones s'ha mirat: obligatòria, i és part del fet. */
  cobertura: string;
  cautela?: string;
};

/**
 * Les primeres `quants` files per un valor, i quantes en queden amb el mateix
 * valor que l'última. Els empats surten per nom; l'excés no s'escriu però es
 * compta, perquè «5 llistes» a la desena fila no vol dir que només n'hi hagi
 * deu amb cinc.
 */
export function primers<T>(
  items: readonly T[],
  valor: (t: T) => number,
  nom: (t: T) => string,
  quants: number,
  sentit: "max" | "min",
): { files: T[]; empatats: number } {
  const ordenats = [...items].sort((a, b) => {
    const dif = sentit === "max" ? valor(b) - valor(a) : valor(a) - valor(b);
    return dif || nom(a).localeCompare(nom(b), "ca");
  });
  const files = ordenats.slice(0, quants);
  const ultim = files[files.length - 1];
  const empatats = ultim === undefined ? 0 : ordenats.slice(quants).filter((t) => valor(t) === valor(ultim)).length;
  return { files, empatats };
}

const municipi = (f: FilaCuriositat): FilaCuriosa["municipi"] => ({ s: f.s, n: f.n, c: f.c });

/** Els més poblats primer: és com s'escullen els exemples d'un recompte. */
const mesPoblats = (files: readonly FilaCuriositat[], quants: number): FilaCuriositat[] =>
  [...files].sort((a, b) => b.p - a.p || a.n.localeCompare(b.n, "ca")).slice(0, quants);

/** «Els cinc més poblats dels 185» o, si no arriben a cinc, «Tots N». */
function capDeMostra(total: number, mostra: number, femeni = false): string {
  if (total <= mostra) return total === 1 ? (femeni ? "L'única" : "L'únic") : `${femeni ? "Totes les" : "Tots els"} ${n(total)}`;
  const quants = mostra === 5 ? "cinc" : n(mostra);
  return `${femeni ? "Les" : "Els"} ${quants} més poblat${femeni ? "es" : "s"} d${femeni ? "e les" : "els"} ${n(total)}`;
}

/**
 * La fitxa d'una alcaldia. L'actual té pàgina de regidor —la que fa
 * `resolAlcaldia()`, que la fila ja porta a `ad`— i s'hi envia si el nom del
 * registre d'alcaldies és el mateix que el de la fila. Si no, o si és una
 * alcaldia d'un altre mandat, la pàgina és la de l'historial: `alcaldia/<slug>`
 * amb el nom llegible, que és la regla amb què s'escriuen aquelles pàgines.
 */
export function hrefAlcaldia(fila: FilaCuriositat, nom: string): string {
  if (fila.ad && fila.a && normalizePersonName(fila.a) === normalizePersonName(nom)) return `../m/${fila.s}/${fila.ad}`;
  return `../m/${fila.s}/alcaldia/${slugify(nomLlegible(nom))}/`;
}

const anyDelMandat = (mandat: string): number => Number.parseInt(mandat, 10);

/**
 * Quants mandats seguits porta l'alcaldia actual d'un municipi, i des de quan.
 *
 * Es parteix de l'últim mandat del registre —la persona amb la presa de
 * possessió més recent— i es recula mandat a mandat mentre el mateix nom hi
 * consti. Un mandat que falta al registre trenca la sèrie: un buit no és una
 * continuïtat. Torna `null` si el municipi no té el mandat en curs.
 *
 * `primerMandat` és l'any del primer mandat **del registre sencer** (1979),
 * no del municipi: un poble que només hi té el mandat en curs no mana «des del
 * principi» pel fet que el seu principi sigui el 2023.
 */
export function mandatsSeguits(
  passos: readonly PasAlcaldia[],
  mandatActual: string,
  primerMandat: number = Math.min(...passos.map((p) => anyDelMandat(p.mandat))),
): { nom: string; mandats: number; desDe: number; desDelPrincipi: boolean } | null {
  const perAny = new Map<number, PasAlcaldia[]>();
  for (const p of passos) {
    const any = anyDelMandat(p.mandat);
    const del = perAny.get(any);
    if (del) del.push(p);
    else perAny.set(any, [p]);
  }
  const actuals = perAny.get(anyDelMandat(mandatActual)) ?? [];
  if (actuals.length === 0) return null;
  const ordenats = [...actuals].sort((a, b) => (a.possessio ?? "").localeCompare(b.possessio ?? ""));
  const actual = ordenats[ordenats.length - 1]!;
  const clau = normalizePersonName(actual.nom);
  if (clau === "") return null;

  let mandats = 0;
  let desDe = anyDelMandat(mandatActual);
  for (let any = anyDelMandat(mandatActual); ; any -= 4) {
    const propi = (perAny.get(any) ?? []).filter((p) => normalizePersonName(p.nom) === clau);
    if (propi.length === 0) break;
    mandats += 1;
    const possessio = propi.map((p) => p.possessio).filter((d): d is string => d !== null).sort()[0];
    desDe = possessio ? Number(possessio.slice(0, 4)) : any;
  }
  return { nom: actual.nom, mandats, desDe, desDelPrincipi: desDe <= primerMandat + 1 && mandats > 0 };
}

/** Sobre quants: la frase que tot fet porta, escrita igual a tot arreu. */
const sobre = (quants: number, que: string, total: number): string =>
  `S'ha mirat ${que} de ${n(quants)} municipis${quants < total ? ` dels ${n(total)}` : ""}.`;

export function preparaCuriositats(files: readonly FilaCuriositat[], dades: DadesCuriositats): Curiositat[] {
  const total = files.length;
  const fets: Curiositat[] = [];

  // ---- qui fa més anys que mana ----------------------------------------
  {
    // El mandat en curs i el primer són els del registre sencer: el més recent
    // i el més antic que hi consta a qualsevol municipi.
    const anys = Object.values(dades.alcaldies).flatMap((ps) => ps.map((p) => anyDelMandat(p.mandat)));
    const mandatActual = anys.length
      ? Object.values(dades.alcaldies).flat().find((p) => anyDelMandat(p.mandat) === Math.max(...anys))!.mandat
      : null;
    const primerMandat = anys.length ? Math.min(...anys) : 0;
    const seguits = mandatActual
      ? files.flatMap((f) => {
          const passos = dades.alcaldies[f.s];
          const s = passos ? mandatsSeguits(passos, mandatActual, primerMandat) : null;
          return s ? [{ fila: f, ...s }] : [];
        })
      : [];
    if (mandatActual && seguits.length > 0) {
      const { files: llargs, empatats } = primers(seguits, (s) => s.mandats * 10_000 - s.desDe, (s) => s.fila.n, 10, "max");
      const desDelPrincipi = seguits.filter((s) => s.desDelPrincipi);
      const filaDe = (s: (typeof seguits)[number]): FilaCuriosa => ({
        municipi: municipi(s.fila),
        persona: { nom: nomLlegible(s.nom), href: hrefAlcaldia(s.fila, s.nom) },
        valor: `${n(s.mandats)} mandat${s.mandats === 1 ? "" : "s"} seguit${s.mandats === 1 ? "" : "s"}`,
        detall: `des del ${s.desDe}`,
      });
      const llistes: LlistaCuriosa[] = [{ cap: "Els que fa més mandats seguits que hi són", files: llargs.map(filaDe), empatats }];
      if (desDelPrincipi.length > 0) {
        const primerAny = Math.min(...desDelPrincipi.map((s) => s.desDe));
        const mostra = primers(desDelPrincipi, (s) => s.fila.p, (s) => s.fila.n, 10, "max");
        llistes.push({
          cap: `${capDeMostra(desDelPrincipi.length, 10)} on mana la mateixa persona des del ${primerAny}`,
          files: mostra.files.map(filaDe),
        });
      }
      fets.push({
        id: "mana-mes",
        titol: "Qui fa més anys que mana",
        metode: `L'alcaldia del mandat ${mandatActual} i quants mandats seguits porta la mateixa persona, segons el registre d'alcaldies de la Generalitat.`,
        periode: `1979-${mandatActual.slice(-4)}`,
        font: "Generalitat de Catalunya · historial d'alcaldies",
        llistes,
        cobertura: sobre(seguits.length, `l'historial d'alcaldies amb el mandat ${mandatActual}`, total),
        cautela: "Un mandat compta com a seguit quan el mateix nom consta al mandat anterior. Un nom escrit de dues maneres al registre trenca la sèrie, i un mandat que hi falta també: aquí un buit no és una continuïtat.",
      });
    }
  }

  // ---- els plens que han tingut més alcaldes diferents ------------------
  {
    const comptats = files.flatMap((f) => {
      const passos = dades.alcaldies[f.s];
      if (!passos || passos.length === 0) return [];
      const persones = new Set(passos.map((p) => normalizePersonName(p.nom)).filter(Boolean));
      return [{ fila: f, persones: persones.size, mandats: new Set(passos.map((p) => p.mandat)).size }];
    });
    if (comptats.length > 0) {
      const { files: mes, empatats } = primers(comptats, (c) => c.persones, (c) => c.fila.n, 10, "max");
      fets.push({
        id: "mes-alcaldes",
        titol: "Els ajuntaments que han tingut més alcaldes diferents",
        metode: "Quantes persones diferents han tingut l'alcaldia des del 1979, comptant relleus a mig mandat.",
        periode: "1979-2027",
        font: "Generalitat de Catalunya · historial d'alcaldies",
        llistes: [{
          cap: "Els que n'han tingut més",
          files: mes.map((c) => ({
            municipi: municipi(c.fila),
            valor: `${n(c.persones)} persones`,
            detall: `en ${n(c.mandats)} mandats`,
          })),
          empatats,
        }],
        cobertura: sobre(comptats.length, "l'historial d'alcaldies", total),
        cautela: "Compta noms diferents al registre: una mateixa persona escrita de dues maneres hi compta dues vegades.",
      });
    }
  }

  // ---- les alcaldies més joves i més grans -----------------------------
  {
    const ambAny = files.flatMap((f) => {
      const any = f.a ? dades.naixements[f.s]?.[normalizePersonName(f.a)] : undefined;
      return f.a && any !== undefined ? [{ fila: f, nom: f.a, any }] : [];
    });
    if (ambAny.length >= 10) {
      const anyAvui = new Date().getFullYear();
      const filaDe = (x: (typeof ambAny)[number]): FilaCuriosa => ({
        municipi: municipi(x.fila),
        persona: { nom: nomLlegible(x.nom), href: x.fila.ad ? `../m/${x.fila.s}/${x.fila.ad}` : null },
        // L'edat és el que es vol llegir, i l'any en petit al costat. Només
        // amb l'any de naixement, l'edat pot ballar un any: per això va amb
        // «uns». Sense participis («nascut») perquè el sexe no es carrega aquí.
        valor: `uns ${anyAvui - x.any} anys · any ${x.any}`,
      });
      const joves = primers(ambAny, (x) => x.any, (x) => x.fila.n, 5, "max");
      const grans = primers(ambAny, (x) => x.any, (x) => x.fila.n, 5, "min");
      fets.push({
        id: "edat-alcaldies",
        titol: "Les alcaldies més joves, i les més grans",
        metode: "L'edat de l'alcaldia actual, calculada de l'any de naixement que dona la seva fitxa de Wikidata; només l'any, i per això l'edat és aproximada.",
        periode: "mandat 2023-2027",
        font: "Wikidata (CC0) · aparellat pel nom amb el registre d'electes",
        llistes: [
          { cap: "Les més joves", files: joves.files.map(filaDe), empatats: joves.empatats },
          { cap: "Les més grans", files: grans.files.map(filaDe), empatats: grans.empatats },
        ],
        cobertura: `S'han mirat les ${n(ambAny.length)} alcaldies de ${n(total)} que tenen any de naixement a Wikidata; de la resta no se'n sap.`,
        cautela: "Wikidata té fitxa sobretot de qui ha tingut càrrecs més enllà del seu poble: la mostra tira cap a les ciutats grans i no diu res de l'edat de les alcaldies en general.",
      });
    }
  }

  // ---- els sous d'alcaldia més alts i les alcaldies sense cap import ----
  {
    const ambSou = files.filter((f) => typeof f.sa === "number" && Number.isFinite(f.sa));
    const alFull = files.filter((f) => dades.retribucions[f.s] !== undefined);
    if (ambSou.length > 0 && alFull.length > 0) {
      const anys = alFull.map((f) => dades.retribucions[f.s]!.any).filter((a): a is number => a !== null);
      const any = anys.length ? [...new Set(anys)].sort((a, b) => b - a)[0]! : null;
      const senseImport = alFull.filter((f) => dades.retribucions[f.s]!.mena === "cap");
      const nomesAssistencies = alFull.filter((f) => dades.retribucions[f.s]!.mena === "assistencies");
      const alts = primers(ambSou, (f) => f.sa!, (f) => f.n, 5, "max");
      const persona = (f: FilaCuriositat): FilaCuriosa["persona"] =>
        f.a ? { nom: nomLlegible(f.a), href: f.ad ? `../m/${f.s}/${f.ad}` : null } : undefined;
      const llistes: LlistaCuriosa[] = [{
        cap: "Els sous més alts",
        files: alts.files.map((f) => ({ municipi: municipi(f), persona: persona(f), valor: `${n(f.sa!)} € l'any` })),
        empatats: alts.empatats,
      }];
      if (senseImport.length > 0) {
        llistes.push({
          cap: `${capDeMostra(senseImport.length, 5, true)} alcaldies sense cap import declarat`,
          files: mesPoblats(senseImport, 5).map((f) => ({ municipi: municipi(f), persona: persona(f), valor: "cap import" })),
        });
      }
      fets.push({
        id: "sou-alcaldia",
        titol: "Els sous d'alcaldia més alts, i les alcaldies que no cobren res",
        metode: `El total que cada ajuntament declara al Ministeri haver pagat a l'alcaldia en un any. Només compta com a sou el d'una dedicació exclusiva o parcial: ${n(nomesAssistencies.length)} alcaldies cobren només assistències als plens i no són a cap de les dues llistes.`,
        periode: any === null ? "exercici sense data" : `exercici ${any}`,
        font: "Ministeri per a la Transformació Digital i de la Funció Pública · ISPA",
        llistes,
        cobertura: `S'han mirat els ${n(alFull.length)} municipis que consten al full del Ministeri${alFull.length < total ? `; dels ${n(total)} n'hi falten ${n(total - alFull.length)}` : ""}. Amb sou: ${n(ambSou.length)}.`,
        cautela: "És el que declara pagar l'ajuntament. No inclou el que la mateixa persona pugui cobrar d'un consell comarcal, d'una diputació o d'una empresa municipal, i per tant no és el que cobra.",
      });
    }
  }

  // ---- els plens amb més llistes, i els d'una de sola --------------------
  {
    const ambLlistes = files.flatMap((f) => {
      const llistes = (dades.llistes2023[f.s] ?? []).filter((l) => l.regidories > 0);
      return llistes.length > 0 ? [{ fila: f, llistes }] : [];
    });
    if (ambLlistes.length > 0) {
      const mes = primers(ambLlistes, (x) => x.llistes.length, (x) => x.fila.n, 10, "max");
      const unaSola = ambLlistes.filter((x) => x.llistes.length === 1);
      const sigles = (llistes: Llista2023[]): string =>
        [...llistes].sort((a, b) => b.regidories - a.regidories).map((l) => `${l.sigles} ${n(l.regidories)}`).join(" · ");
      const llistes: LlistaCuriosa[] = [{
        cap: "Els plens amb més llistes",
        files: mes.files.map((x) => ({
          municipi: municipi(x.fila),
          valor: `${n(x.llistes.length)} llistes`,
          detall: sigles(x.llistes),
        })),
        empatats: mes.empatats,
      }];
      if (unaSola.length > 0) {
        llistes.push({
          cap: `${capDeMostra(unaSola.length, 5)} plens on una sola llista va treure regidories`,
          files: primers(unaSola, (x) => x.fila.p, (x) => x.fila.n, 5, "max").files.map((x) => ({
            municipi: municipi(x.fila),
            valor: "1 llista",
            detall: `${x.llistes[0]!.sigles} · ${n(x.fila.p)} habitants`,
          })),
        });
      }
      fets.push({
        id: "fragmentacio",
        titol: "El ple més repartit, i els plens d'una sola llista",
        metode: "Quantes candidatures van obtenir com a mínim una regidoria a les municipals del 2023.",
        periode: "2023",
        font: "Generalitat de Catalunya · processos electorals",
        llistes,
        cobertura: sobre(ambLlistes.length, "els resultats de les municipals del 2023", total),
        cautela: "Compta llistes el dia de les eleccions: els regidors que després han canviat de grup o han quedat no adscrits no hi surten.",
      });
    }
  }

  // ---- la regidoria més cara i la més barata en vots ---------------------
  {
    // Als municipis de menys de 250 habitants es vota amb llistes obertes: el
    // vot és a la persona, no a la llista, i «vots per regidoria» no vol dir
    // res. La mateixa regla que fa servir J2 per decidir on s'aplica Hondt.
    const tancades = files.filter((f) => {
      const ple = dades.ple2023[f.s];
      return ple !== undefined && ple.sistema === "llistes tancades" && ple.regidories > 5;
    });
    const candidatures = tancades.flatMap((f) =>
      (dades.llistes2023[f.s] ?? [])
        .filter((l) => l.regidories > 0 && l.vots > 0)
        .map((l) => ({ fila: f, l, perRegidoria: l.vots / l.regidories })),
    );
    if (candidatures.length > 0) {
      const filaDe = (x: (typeof candidatures)[number]): FilaCuriosa => ({
        municipi: municipi(x.fila),
        valor: `${n(x.perRegidoria)} vots per regidoria`,
        detall: `${x.l.sigles} · ${n(x.l.vots)} vots, ${n(x.l.regidories)} regidor${x.l.regidories === 1 ? "ia" : "ies"}`,
      });
      const cares = primers(candidatures, (x) => x.perRegidoria, (x) => `${x.fila.n} ${x.l.sigles}`, 5, "max");
      const barates = primers(candidatures, (x) => x.perRegidoria, (x) => `${x.fila.n} ${x.l.sigles}`, 5, "min");
      fets.push({
        id: "regidoria-vots",
        titol: "La regidoria més cara i la més barata, en vots",
        metode: "Els vots de cada candidatura dividits per les regidories que va obtenir, a les municipals del 2023.",
        periode: "2023",
        font: "Generalitat de Catalunya · processos electorals",
        llistes: [
          { cap: "Les que han costat més vots", files: cares.files.map(filaDe), empatats: cares.empatats },
          { cap: "Les que han costat menys vots", files: barates.files.map(filaDe), empatats: barates.empatats },
        ],
        cobertura: `S'han mirat ${n(candidatures.length)} candidatures amb regidoria de ${n(tancades.length)} municipis${tancades.length < total ? ` dels ${n(total)}` : ""}: els de llistes tancades amb més de cinc regidories.`,
        cautela: "Als municipis de menys de 250 habitants es vota amb llistes obertes i el vot va a la persona, no a la llista: no hi entren. El preu en vots depèn de la mida del municipi, no de cap llista.",
      });
    }
  }

  // ---- plens només de dones i plens sense cap dona -----------------------
  {
    const complets = files.filter((f) => typeof f.f === "number" && Number.isFinite(f.f));
    if (complets.length > 0) {
      const totes = complets.filter((f) => f.f === 100);
      const cap = complets.filter((f) => f.f === 0);
      const filaDe = (f: FilaCuriositat): FilaCuriosa => ({
        municipi: municipi(f),
        valor: `${n(f.f!)} % dones`,
        detall: `${n(f.r ?? 0)} regidories · ${n(f.p)} habitants`,
      });
      const llistes: LlistaCuriosa[] = [];
      if (totes.length > 0) llistes.push({ cap: `${capDeMostra(totes.length, 5)} plens on totes les regidories són dones`, files: mesPoblats(totes, 5).map(filaDe) });
      if (cap.length > 0) llistes.push({ cap: `${capDeMostra(cap.length, 5)} plens sense cap dona`, files: mesPoblats(cap, 5).map(filaDe) });
      if (llistes.length > 0) {
        fets.push({
          id: "dones-ple",
          titol: "Plens només de dones, i plens sense cap dona",
          metode: "El sexe de les persones electes el 2023 segons el registre de candidatures, només als municipis on el registre en porta tantes com regidories té el ple.",
          periode: "2023",
          font: "Generalitat de Catalunya · candidatures proclamades",
          llistes,
          cobertura: `${sobre(complets.length, "la llista d'electes", total)}${complets.length < total ? ` Els altres ${n(total - complets.length)} no tenen la llista sencera al registre i no s'hi compten.` : ""}`,
          cautela: "És la composició del dia de les eleccions: els relleus posteriors no hi són.",
        });
      }
    }
  }

  // ---- regidories per habitant -------------------------------------------
  {
    const ambPle = files.filter((f) => f.p > 0 && typeof f.r === "number" && f.r > 0);
    if (ambPle.length > 0) {
      const perRegidoria = (f: FilaCuriositat): number => f.p / f.r!;
      const filaDe = (f: FilaCuriositat): FilaCuriosa => ({
        municipi: municipi(f),
        valor: `1 per cada ${n(perRegidoria(f))} habitants`,
        detall: `${n(f.r!)} regidories · ${n(f.p)} habitants`,
      });
      const mes = primers(ambPle, perRegidoria, (f) => f.n, 5, "min");
      const menys = primers(ambPle, perRegidoria, (f) => f.n, 5, "max");
      fets.push({
        id: "regidories-habitant",
        titol: "On hi ha més regidories per habitant, i on menys",
        metode: "Els habitants del padró vigent dividits per les regidories del ple.",
        periode: "padró vigent",
        font: "Generalitat de Catalunya · dades generals dels ens locals i LOREG art. 179",
        llistes: [
          { cap: "Més regidories per habitant", files: mes.files.map(filaDe), empatats: mes.empatats },
          { cap: "Menys regidories per habitant", files: menys.files.map(filaDe), empatats: menys.empatats },
        ],
        cobertura: sobre(ambPle.length, "el padró i les regidories", total),
        cautela: "Quantes regidories té un ple ho fixa la llei per trams de població: no ho tria cap ajuntament.",
      });
    }
  }

  // ---- els noms més llargs i més curts ------------------------------------
  {
    const lletres = (f: FilaCuriositat): number => f.n.replace(/[^\p{L}]/gu, "").length;
    if (files.length > 0) {
      const filaDe = (f: FilaCuriositat): FilaCuriosa => ({ municipi: municipi(f), valor: `${n(lletres(f))} lletres` });
      const llargs = primers(files, lletres, (f) => f.n, 5, "max");
      const curts = primers(files, lletres, (f) => f.n, 5, "min");
      fets.push({
        id: "noms",
        titol: "Els noms més llargs i els més curts",
        metode: "Les lletres del nom oficial, sense comptar espais, guions ni apòstrofs.",
        periode: "nomenclàtor vigent",
        font: "Generalitat de Catalunya · dades generals dels ens locals",
        llistes: [
          { cap: "Els més llargs", files: llargs.files.map(filaDe), empatats: llargs.empatats },
          { cap: "Els més curts", files: curts.files.map(filaDe), empatats: curts.empatats },
        ],
        cobertura: sobre(files.length, "el nom oficial", total),
      });
    }
  }

  return fets;
}

// ------------------------------------------------------------------- HTML

const enllacMunicipi = (m: FilaCuriosa["municipi"]): string => `<a href="../m/${escape(m.s)}/">${escape(m.n)}</a>`;
const enllacComarca = (m: FilaCuriosa["municipi"]): string =>
  m.c ? `<a class="comarca" href="../c/${escape(slugify(m.c))}/">${escape(m.c)}</a>` : "";

function filaHtml(f: FilaCuriosa, pos: number): string {
  // Quan el fet és d'una persona, la persona va al davant i el municipi a sota;
  // si no, el municipi al davant i la comarca a sota.
  const principal = f.persona
    ? f.persona.href
      ? `<a href="${escape(f.persona.href)}">${escape(f.persona.nom)}</a>`
      : `<span class="sense-fitxa">${escape(f.persona.nom)}</span>`
    : enllacMunicipi(f.municipi);
  const sota = [f.persona ? enllacMunicipi(f.municipi) : "", enllacComarca(f.municipi), f.detall ? escape(f.detall) : ""]
    .filter(Boolean)
    .join(" · ");
  return `<li><span class="pos">${pos}</span><span class="municipi">${principal}<small>${sota}</small></span><b class="dada">${escape(f.valor)}</b></li>`;
}

function llistaHtml(l: LlistaCuriosa, id: string): string {
  const files = l.files.map((f, i) => filaHtml(f, i + 1)).join("\n        ");
  const cua = l.empatats ? `<p class="secundari">i ${n(l.empatats)} més amb la mateixa xifra.</p>` : "";
  return `<h4 class="cap">${escape(l.cap)}</h4>
      <ol class="llista-curiosa" aria-label="${escape(`${l.cap} · ${id}`)}">
        ${files}
      </ol>${cua}`;
}

/**
 * La resposta d'una línia: la primera fila de la primera llista, dita en text.
 *
 * Cada curiositat feia uns 2.100 px a 360 —títol, mètode, dues llistes de
 * deu i la cobertura— i les vint-i-quatre sumaven més de 50.000 px de
 * pàgina. Ara es pleguen, i el que queda a la vista ha de bastar per saber
 * si val la pena obrir-la: la pregunta (el títol) i qui encapçala la llista,
 * amb la xifra. «Els que fa més anys que manen: Joan Serra Vila, a Riubaix ·
 * 12 mandats seguits».
 *
 * Va en text i no en enllaços perquè és dins del `<summary>`: un enllaç dins
 * del botó que obre el calaix fa que el mateix toc faci dues coses. Els
 * enllaços hi són a dins, a la llista. Sense cap fila —no hauria de passar,
 * perquè un fet sense files no es publica— no es diu res.
 */
export function respostaCuriositat(c: Curiositat): string {
  const llista = c.llistes.find((l) => l.files.length > 0);
  const primera = llista?.files[0];
  if (!llista || !primera) return "";
  const qui = primera.persona
    ? `${primera.persona.nom}, a ${primera.municipi.n}`
    : primera.municipi.n;
  return `${llista.cap}: ${qui} · ${primera.valor}`;
}

/**
 * Una curiositat, plegada: el títol i la resposta d'una línia a la vista, i
 * la resta —la font, el mètode, les llistes, la cobertura— a dins.
 *
 * L'`<article>` amb l'`id` es queda com era: hi ha enllaços a `#cur-…` i
 * altres pàgines (`territori-fitxa.ts`) que pinten els seus fets amb aquesta
 * mateixa targeta. El que canvia és que a dins hi ha un `<details>`, que
 * s'obre i es tanca sense JavaScript; el títol hi va com a `<h3>` dins del
 * `<summary>`, que l'HTML permet, perquè l'esquema de la pàgina continuï
 * tenint un encapçalament per fet.
 */
export function targetaCuriositat(c: Curiositat): string {
  const resposta = respostaCuriositat(c);
  return `<article class="curiositat" id="cur-${escape(c.id)}">
    <details class="cur-plec">
    <summary class="cur-obre">
      <h3>${escape(c.titol)}</h3>
      ${resposta ? `<span class="cur-resposta">${escape(resposta)}</span>` : ""}
    </summary>
    <div class="cur-cos">
    <p class="micro">${escape(c.periode)} · ${escape(c.font)}</p>
    <p class="entrada-bloc">${escape(c.metode)}</p>
    ${c.llistes.map((l) => llistaHtml(l, c.id)).join("\n    ")}
    <p class="cobertura">${escape(c.cobertura)}</p>
    ${c.cautela ? `<p class="nota">${escape(c.cautela)}</p>` : ""}
    </div>
    </details>
  </article>`;
}

/** La secció sencera, o res si no hi ha cap fet: una secció buida faria pensar que no hi ha res a dir. */
export function renderCuriositats(curiositats: readonly Curiositat[]): string {
  if (curiositats.length === 0) return "";
  return `<section class="bloc" id="curiositats">
  <h2>Curiositats</h2>
  <p class="entrada-bloc">Els fets singulars que cap rànquing de 947 no ensenya: llistes curtes, cadascuna
  amb la font, l'any i sobre quants municipis o persones s'ha mirat. Descriuen; no jutgen. Toca'n una
  per veure-la sencera.</p>
  <div class="curiositats">
  ${curiositats.map(targetaCuriositat).join("\n  ")}
  </div>
</section>`;
}

/**
 * El CSS de la secció. Les curiositats són una llista de calaixos, no una
 * graella de targetes: vint-i-quatre caixes iguals amb ombra eren el patró que
 * la marca vol evitar, i plegades es llegeixen millor com les preguntes d'un
 * índex, separades per un filet. A partir de 900 px, en dues columnes; cada
 * calaix s'obre sense estirar el del costat («align-items:start»).
 */
export const CURIOSITATS_CSS = `
.curiositats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 var(--e4);margin-top:var(--e3);align-items:start}
.curiositat{border-top:2px solid var(--ink);min-width:0}
.cur-obre{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 12px;align-items:start;cursor:pointer;
  list-style:none;padding:var(--e2) 2px;min-height:44px}
.cur-obre::-webkit-details-marker{display:none}
.cur-obre::after{content:"+";grid-column:2;grid-row:1;font-family:var(--display);font-weight:900;font-size:1.4rem;
  line-height:1;transition:transform .15s ease}
.cur-plec[open]>.cur-obre::after{transform:rotate(45deg)}
.cur-obre:focus-visible{outline:3px solid var(--coral-text);outline-offset:2px}
.cur-obre:hover h3{text-decoration:underline;text-decoration-thickness:2.5px;text-underline-offset:3px;
  text-decoration-color:var(--coral)}
.curiositat h3{grid-column:1;font-family:var(--display);font-weight:900;font-size:1.15rem;letter-spacing:-.02em;
  line-height:1.2;margin:0}
.cur-resposta{grid-column:1/-1;font-size:.88rem;color:var(--ink-suau);overflow-wrap:anywhere}
.cur-cos{display:flex;flex-direction:column;gap:var(--e2);padding:0 0 var(--e3)}
.curiositat .micro{margin:0}
.curiositat .entrada-bloc{margin:0}
.curiositat .cap{font-size:.86rem;font-weight:800;color:var(--ink-suau);margin:var(--e1) 0 0}
.llista-curiosa{list-style:none;padding:0;margin:0;display:grid;gap:8px}
.llista-curiosa li{display:grid;grid-template-columns:2.4rem minmax(0,1fr) auto;gap:10px;align-items:center;
  border:2px solid var(--vora);border-radius:var(--r-m);padding:9px 12px;background:var(--paper)}
.llista-curiosa li:hover{border-color:var(--ink)}
.llista-curiosa .pos{font-family:var(--display);font-weight:900;font-size:1.15rem;color:var(--coral-text);font-variant-numeric:tabular-nums}
.llista-curiosa .municipi a{font-weight:800;color:var(--ink)}
.llista-curiosa .municipi .sense-fitxa{font-weight:800}
.llista-curiosa .municipi small{display:block;color:var(--ink-suau);font-size:.76rem;margin-top:1px;overflow-wrap:anywhere}
.llista-curiosa .municipi small a{color:inherit;font-weight:600;text-decoration-color:var(--vora)}
.llista-curiosa .municipi small a:hover{color:var(--coral-text)}
.llista-curiosa .dada{font-family:var(--display);font-weight:900;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.curiositat .cobertura{font-size:.86rem;font-weight:700;margin:var(--e1) 0 0}
.curiositat .nota{margin-top:0}
@media (prefers-reduced-motion:reduce){.cur-obre::after{transition:none}}
@media(max-width:900px){.curiositats{grid-template-columns:1fr}}
@media(max-width:480px){.llista-curiosa .dada{white-space:normal;text-align:left;grid-column:2}}
`;
