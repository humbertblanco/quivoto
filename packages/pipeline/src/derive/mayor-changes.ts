import { asc, eq } from "drizzle-orm";
import { mayors, municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { KIND as KIND_ALCALDIES_WIKIDATA, type FitxaAlcaldiesWikidata } from "../jobs/j31-alcaldies-wikidata";
import { KIND as KIND_ALCALDIES_MINISTERI, type FitxaAlcaldiesMinisteri } from "../jobs/j35-alcaldes-ministeri";
import { normalize } from "../lib/text";
import { withRun } from "../lib/run";
import { familiaDelPartit, fusionaAmbMinisteri, fusionaAmbWikidata, mateixaPersona, type PasAlcaldia } from "./alcaldies";

/**
 * Canvis d'alcaldia a mig mandat.
 *
 * L'historial d'alcaldies de la Generalitat arriba fins al 1979 i registra els
 * relleus dins d'un mateix mandat. Ningú no ho publica com a sèrie comparable, i
 * és de les poques dades que expliquen la política municipal real: un alcalde
 * que plega, un pacte de rotació que es compleix, o una moció de censura.
 *
 * No podem distingir amb certesa una dimissió d'una moció de censura —la font no
 * ho diu—, així que ens limitem al que sí que se'n desprèn: si el relleu es queda
 * dins del mateix partit o canvia de color. Ho etiquetem d'aquesta manera i no
 * n'inventem el motiu.
 *
 * El que la font no diu, de vegades ho diu Wikidata (J31): els relleus que a
 * la Generalitat li falten a les ciutats grans, la data en què cada alcaldia
 * va acabar i per què. `derive/alcaldies.ts` ho fusiona amb l'historial
 * oficial sense esborrar-ne res, i cada pas que ve de Wikidata queda marcat
 * amb `font: "wikidata"`. Si J31 no s'ha executat, tot funciona igual que
 * abans, només amb la Generalitat.
 *
 * I el que ni la Generalitat ni Wikidata diuen —**quan** va acabar cada
 * alcaldia, de tots els municipis i no només de les ciutats— ho diu el
 * Ministeri (J35, «Alcaldes por mandato» del SIL), que es fusiona darrere de
 * Wikidata amb la mateixa regla i marca el que hi posa amb `fontFi`,
 * `fontInici` o `font: "ministeri"`. El motiu no el diu ningú més que
 * Wikidata, i no s'inventa.
 */

/**
 * Un pas de l'historial: qui, de quin partit i des de quan. Els camps
 * opcionals són els que Wikidata hi afegeix (`PasAlcaldia`), i es conserven
 * als relleus perquè la pàgina els pugui dir.
 */
export type MayorSpell = Omit<PasAlcaldia, "term">;

export type TermChange = {
  term: string;
  mayors: MayorSpell[];
  /** Cert si el relleu va portar l'alcaldia a un partit diferent. */
  partyChanged: boolean;
  /**
   * Cert quan de la font només en surt qui va arribar després: sabem que hi va
   * haver relleu per la data, però no qui hi havia abans.
   */
  onlySuccessorKnown?: boolean;
  daysIntoTerm?: number;
};

/**
 * Dies de marge sobre la constitució del ple. Qui pren possessió més tard que
 * això no va sortir del ple de constitució: hi va arribar a mig mandat.
 */
const MID_TERM_DAYS = 45;

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

/**
 * Un mandat és un relleu si hi consta més d'una persona o si l'única que hi
 * consta va prendre possessió molt després del ple de constitució.
 *
 * La segona regla és imprescindible: per al mandat en curs la font només desa
 * l'alcaldia vigent, així que un relleu com el d'Esplugues de Llobregat
 * —Pilar Díaz substituïda per Eduard Sanz l'octubre del 2024— hi seria invisible
 * si només comptéssim files.
 */
/**
 * La data de constitució de cada mandat: la presa de possessió més repetida
 * de totes les que consten, i en cas d'empat la primera. La mínima no servia:
 * un sol municipi amb «1995-01-01» al mandat 1995-1999 feia que tots els
 * altres semblessin arribats 167 dies tard, i un «1983-05-08» (el dia de les
 * eleccions, no del ple) partia en dos un alcalde que plegava el 24 de maig.
 */
export function datesDeConstitucio(passos: Iterable<{ term: string; data: string | null }>): Map<string, string> {
  const compte = new Map<string, Map<string, number>>();
  for (const { term, data } of passos) {
    if (!data) continue;
    const perData = compte.get(term) ?? new Map<string, number>();
    perData.set(data, (perData.get(data) ?? 0) + 1);
    compte.set(term, perData);
  }
  const inicis = new Map<string, string>();
  for (const [term, perData] of compte) {
    const [millor] = [...perData].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    if (millor) inicis.set(term, millor[0]);
  }
  return inicis;
}

export function findChanges(
  rows: readonly (MayorSpell & { term: string })[],
  termStarts: ReadonlyMap<string, string> = new Map(),
): TermChange[] {
  const byTerm = new Map<string, MayorSpell[]>();
  for (const row of rows) {
    const list = byTerm.get(row.term);
    const { term: _term, ...spell } = row;
    if (!list) byTerm.set(row.term, [spell]);
    else if (!list.some((s) => normalize(s.name) === normalize(spell.name))) list.push(spell);
  }

  const changes: TermChange[] = [];
  for (const [term, spells] of byTerm) {
    const ordered = [...spells].sort((a, b) => (a.tookOfficeOn ?? "").localeCompare(b.tookOfficeOn ?? ""));
    const start = termStarts.get(term);
    const arrivedLate =
      ordered.length === 1 &&
      start !== undefined &&
      ordered[0]!.tookOfficeOn !== null &&
      daysBetween(start, ordered[0]!.tookOfficeOn!) > MID_TERM_DAYS;
    if (ordered.length < 2 && !arrivedLate) continue;
    // Canvi de color: entre els partits que escriu la Generalitat, tal com
    // els escriu (és la regla de sempre), i a més entre les famílies que es
    // reconeixen del partit sencer de Wikidata: els passos que només Wikidata
    // té no porten `partyRaw`, i sense això Badalona 2019-2023 —PSC, comuns,
    // PP i PSC— semblaria un relleu sense canviar de mans.
    const parties = new Set(ordered.map((s) => normalize(s.partyRaw ?? "")).filter(Boolean));
    const families = new Set(
      ordered
        .map((s) => familiaDelPartit(s.partyRaw) ?? familiaDelPartit(s.partitWikidata) ?? familiaDelPartit(s.llistaMinisteri))
        .filter((f): f is string => f !== null),
    );
    changes.push({
      term,
      mayors: ordered,
      partyChanged: parties.size > 1 || families.size > 1,
      ...(arrivedLate ? { onlySuccessorKnown: true, daysIntoTerm: daysBetween(start!, ordered[0]!.tookOfficeOn!) } : {}),
    });
  }
  return changes.sort((a, b) => b.term.localeCompare(a.term));
}

export async function deriveMayorChanges(db: Db): Promise<void> {
  await withRun(db, "derive: canvis d'alcaldia", async (run) => {
    const rows = await db
      .select({
        municipalityId: mayors.municipalityId,
        term: mayors.term,
        name: mayors.name,
        partyRaw: mayors.partyRaw,
        tookOfficeOn: mayors.tookOfficeOn,
      })
      .from(mayors)
      .orderBy(asc(mayors.municipalityId), asc(mayors.term));
    run.rowsIn = rows.length;

    // El que Wikidata en sap (J31), si s'ha executat. Sense fitxa, la fusió no
    // afegeix res i l'historial és el de la Generalitat i prou.
    const wikidata = new Map<number, FitxaAlcaldiesWikidata>();
    for (const f of await db
      .select({ municipalityId: municipalityMetrics.municipalityId, data: municipalityMetrics.data })
      .from(municipalityMetrics)
      .where(eq(municipalityMetrics.kind, KIND_ALCALDIES_WIKIDATA))) {
      const fitxa = f.data as FitxaAlcaldiesWikidata;
      if (Array.isArray(fitxa?.alcaldies)) wikidata.set(f.municipalityId, fitxa);
    }
    if (wikidata.size > 0) run.say(`${wikidata.size} municipis amb alcaldies segons Wikidata (J31)`);

    // I el que el Ministeri en sap (J35), si s'ha executat: sobretot la data
    // de baixa, que cap altra font dona de tots els municipis.
    const ministeri = new Map<number, FitxaAlcaldiesMinisteri>();
    for (const f of await db
      .select({ municipalityId: municipalityMetrics.municipalityId, data: municipalityMetrics.data })
      .from(municipalityMetrics)
      .where(eq(municipalityMetrics.kind, KIND_ALCALDIES_MINISTERI))) {
      const fitxa = f.data as FitxaAlcaldiesMinisteri;
      if (Array.isArray(fitxa?.alcaldies)) ministeri.set(f.municipalityId, fitxa);
    }
    if (ministeri.size > 0) run.say(`${ministeri.size} municipis amb alcaldies segons el Ministeri (J35)`);

    // Data de constitució de cada mandat, treta de les dades i no d'una taula
    // a mà: la presa de possessió més repetida a tot Catalunya, entre les de
    // la Generalitat i les del Ministeri (que en té dels mandats en què la
    // Generalitat no en dona cap, del 2011 ençà).
    const termStarts = datesDeConstitucio([
      ...rows.map((r) => ({ term: r.term, data: r.tookOfficeOn })),
      ...[...ministeri.values()].flatMap((f) => f.alcaldies.map((a) => ({ term: a.mandat, data: a.possessio }))),
    ]);

    const byMunicipality = new Map<number, typeof rows>();
    for (const row of rows) {
      const list = byMunicipality.get(row.municipalityId);
      if (list) list.push(row);
      else byMunicipality.set(row.municipalityId, [row]);
    }

    let currentTermChanges = 0;
    let currentTermPartyChanges = 0;
    const names = new Map<number, string>();
    for (const m of await db.select().from(municipalities)) names.set(m.id, m.name);
    const currentList: { name: string; from: string; to: string; date: string | null; partyChanged: boolean }[] = [];

    let passosDeWikidata = 0;
    let municipisCompletats = 0;
    let passosDelMinisteri = 0;
    let finalsDelMinisteri = 0;
    let inicisDelMinisteri = 0;
    for (const [municipalityId, list] of byMunicipality) {
      const generalitat: PasAlcaldia[] = list.map((r) => ({ term: r.term, name: r.name, partyRaw: r.partyRaw, tookOfficeOn: r.tookOfficeOn }));
      const fitxaWikidata = wikidata.get(municipalityId) ?? null;
      const fitxaMinisteri = ministeri.get(municipalityId) ?? null;
      const history = fusionaAmbMinisteri(
        fusionaAmbWikidata(generalitat, fitxaWikidata?.alcaldies ?? [], termStarts),
        fitxaMinisteri?.alcaldies ?? [],
      );
      const afegits = history.filter((h) => h.font === "wikidata").length;
      passosDeWikidata += afegits;
      if (afegits > 0) municipisCompletats += 1;
      const afegitsMinisteri = history.filter((h) => h.font === "ministeri").length;
      const finalsMinisteri = history.filter((h) => h.fontFi === "ministeri").length;
      const inicisMinisteri = history.filter((h) => h.fontInici === "ministeri").length;
      passosDelMinisteri += afegitsMinisteri;
      finalsDelMinisteri += finalsMinisteri;
      inicisDelMinisteri += inicisMinisteri;
      const changes = findChanges(history, termStarts);
      const current = changes.find((c) => c.term === "2023-2027");
      if (current) {
        currentTermChanges += 1;
        if (current.partyChanged) currentTermPartyChanges += 1;
        const first = current.mayors[0]!;
        const last = current.mayors[current.mayors.length - 1]!;
        currentList.push({
          name: names.get(municipalityId) ?? String(municipalityId),
          from: first.name,
          to: last.name,
          date: last.tookOfficeOn,
          partyChanged: current.partyChanged,
        });
      }

      // Sèrie llarga: quantes persones diferents han estat alcaldes des del
      // 1979, comptant també les que només Wikidata té. La mateixa persona
      // escrita diferent per les dues fonts en mandats diferents («ALEJANDRO
      // PASTOR» i «Àlex Pastor») s'ha de comptar un cop: `mateixaPersona()`.
      const people: string[] = [];
      for (const h of history) if (!people.some((n) => mateixaPersona(n, h.name))) people.push(h.name);
      const terms = new Set(list.map((r) => r.term));
      const data = {
        history,
        changes,
        currentTermChange: current ?? null,
        distinctPeople: people.length,
        termsCovered: terms.size,
        firstTerm: [...terms].sort()[0] ?? null,
        wikidata: fitxaWikidata
          ? { font: fitxaWikidata.font, llicencia: fitxaWikidata.llicenciaDades, consultat: fitxaWikidata.consultat, url: fitxaWikidata.url, passosAfegits: afegits }
          : null,
        ministeri: fitxaMinisteri
          ? {
              font: fitxaMinisteri.font,
              organisme: fitxaMinisteri.organisme,
              llicencia: fitxaMinisteri.llicencia,
              consultat: fitxaMinisteri.consultat,
              url: fitxaMinisteri.url,
              passosAfegits: afegitsMinisteri,
              finalsCompletats: finalsMinisteri,
              inicisCompletats: inicisMinisteri,
            }
          : null,
      };

      await db
        .insert(municipalityMetrics)
        .values({ municipalityId, kind: "mayors", data })
        .onConflictDoUpdate({
          target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
          set: { data, computedAt: new Date() },
        });
      run.rowsOut += 1;
    }

    run.say(`${currentTermChanges} municipis han canviat d'alcaldia en el mandat actual`);
    run.say(`${currentTermPartyChanges} d'aquests van canviar també de partit`);
    if (passosDeWikidata > 0) run.say(`${passosDeWikidata} passos afegits de Wikidata a ${municipisCompletats} municipis`);
    if (ministeri.size > 0) {
      run.say(`del Ministeri: ${finalsDelMinisteri} dates de baixa, ${inicisDelMinisteri} dates de possessió que faltaven i ${passosDelMinisteri} passos que cap altra font tenia`);
    }
    return {
      municipis: run.rowsOut,
      passos_de_wikidata: passosDeWikidata,
      municipis_completats_amb_wikidata: municipisCompletats,
      passos_del_ministeri: passosDelMinisteri,
      finals_del_ministeri: finalsDelMinisteri,
      inicis_del_ministeri: inicisDelMinisteri,
      canvis_mandat_actual: currentTermChanges,
      canvis_amb_color_diferent: currentTermPartyChanges,
      mostra: currentList.slice(0, 25),
    };
  });
}
