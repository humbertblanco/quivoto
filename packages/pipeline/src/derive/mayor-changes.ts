import { asc, eq } from "drizzle-orm";
import { mayors, municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { KIND as KIND_ALCALDIES_WIKIDATA, type FitxaAlcaldiesWikidata } from "../jobs/j31-alcaldies-wikidata";
import { normalize } from "../lib/text";
import { withRun } from "../lib/run";
import { familiaDelPartit, fusionaAmbWikidata, mateixaPersona, type PasAlcaldia } from "./alcaldies";

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
      ordered.map((s) => familiaDelPartit(s.partyRaw) ?? familiaDelPartit(s.partitWikidata)).filter((f): f is string => f !== null),
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

    // Data de constitució de cada mandat: la primera presa de possessió que
    // consta a tot Catalunya. Sortir-la de les dades evita haver de mantenir una
    // taula de dates a mà i que se'n desactualitzi cap.
    const termStarts = new Map<string, string>();
    for (const row of rows) {
      if (!row.tookOfficeOn) continue;
      const current = termStarts.get(row.term);
      if (!current || row.tookOfficeOn < current) termStarts.set(row.term, row.tookOfficeOn);
    }

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
    for (const [municipalityId, list] of byMunicipality) {
      const generalitat: PasAlcaldia[] = list.map((r) => ({ term: r.term, name: r.name, partyRaw: r.partyRaw, tookOfficeOn: r.tookOfficeOn }));
      const fitxaWikidata = wikidata.get(municipalityId) ?? null;
      const history = fusionaAmbWikidata(generalitat, fitxaWikidata?.alcaldies ?? [], termStarts);
      const afegits = history.filter((h) => h.font === "wikidata").length;
      passosDeWikidata += afegits;
      if (afegits > 0) municipisCompletats += 1;
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
    return {
      municipis: run.rowsOut,
      passos_de_wikidata: passosDeWikidata,
      municipis_completats_amb_wikidata: municipisCompletats,
      canvis_mandat_actual: currentTermChanges,
      canvis_amb_color_diferent: currentTermPartyChanges,
      mostra: currentList.slice(0, 25),
    };
  });
}
