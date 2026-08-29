import { and, eq } from "drizzle-orm";
import {
  councilTerms, councillorMandates, municipalities, people, politicalGroups, type Db,
} from "@quivoto/db";
import { DATASETS, socrataAll } from "../adapters/socrata";
import { normalizePersonName, titleCase, toInt } from "../lib/text";
import { withRun } from "../lib/run";

type PleRow = {
  codi_10: string;
  nom_ens: string;
  nom: string;
  carrec?: string;
  partit_politic?: string;
  ordre?: string;
  tipus_ens: string;
};

type CarrecRow = {
  codi_ens: string;
  nom_regidor?: string;
  nom_complert?: string;
  carrec?: string;
  sexe?: string;
  ordre?: string;
};

/** «EVA LABRADOR CUADRADO (Ind.)» → nom net i anotació entre parèntesis a part. */
function splitName(raw: string): { name: string; note: string | null } {
  const match = raw.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (!match) return { name: raw.trim(), note: null };
  return { name: match[1]!.trim(), note: match[2]!.trim() };
}

/**
 * J3 — qui seu avui al ple. És la font que permet detectar el que passa entre
 * eleccions: substitucions, dimissions i canvis de grup. Per això cada canvi
 * genera una fila nova en comptes de sobreescriure l'anterior.
 *
 * Comprovat el 28-08-2026: el dataset de càrrecs electes de la Generalitat
 * **no porta cap correu electrònic** (`count(e_mail) = 0`), contra el que
 * suposava el pla. Els contactes per a l'outreach del 2027 hauran de sortir
 * d'una altra banda, i mentrestant queda registrat com a incidència.
 */
export async function j3Councillors(db: Db): Promise<void> {
  await withRun(db, "J3 composició dels plens", async (run) => {
    const byCodiEns = new Map<string, number>();
    for (const m of await db.select().from(municipalities)) byCodiEns.set(m.codiEns, m.id);

    const terms = new Map<number, number>();
    for (const t of await db.select().from(councilTerms).where(eq(councilTerms.electionId, "M20231"))) {
      terms.set(t.municipalityId, t.id);
    }

    const groups = new Map<string, number>();
    for (const g of await db.select().from(politicalGroups)) {
      groups.set(`${g.municipalityId}|${normalizePersonName(g.name)}`, g.id);
    }

    // Sexe des del segon dataset, aparellat per ens i nom normalitzat.
    const sexByKey = new Map<string, string>();
    try {
      const carrecs = await socrataAll<CarrecRow>(DATASETS.carrecs, {
        select: "codi_ens,nom_regidor,carrec,sexe,ordre",
      });
      for (const c of carrecs) {
        if (!c.nom_regidor || !c.sexe) continue;
        const codi = String(c.codi_ens).padStart(10, "0");
        sexByKey.set(`${codi}|${normalizePersonName(splitName(c.nom_regidor).name)}`, c.sexe);
      }
      run.say(`${sexByKey.size} càrrecs amb sexe al dataset complementari`);
    } catch (error) {
      run.say(`dataset de càrrecs no disponible: ${String(error)}`);
    }

    await run.issue({
      kind: "missing_contact_source",
      severity: "alta",
      entity: "m5nd-xjza",
      detail: {
        comprovat: "2026-08-28",
        fet: "count(e_mail) = 0: el dataset no publica correus",
        implicacio: "cal una altra font per als contactes de l'outreach del 2027",
      },
    });

    const rows = (await socrataAll<PleRow>(DATASETS.plens, {
      select: "codi_10,nom_ens,nom,carrec,partit_politic,ordre,tipus_ens",
    })).filter((r) => r.tipus_ens === "Municipis");
    run.rowsIn = rows.length;
    run.say(`${rows.length} regidors i regidores al ple`);

    let orphans = 0;
    for (const row of rows) {
      const codiEns = String(row.codi_10).padStart(10, "0");
      const municipalityId = byCodiEns.get(codiEns);
      if (!municipalityId) {
        orphans += 1;
        continue;
      }

      if (!row.nom) {
        await run.issue({ kind: "councillor_without_name", severity: "baixa", entity: row.nom_ens });
        continue;
      }
      const { name, note } = splitName(row.nom);
      const normalized = normalizePersonName(name);
      if (!normalized) continue;

      const existing = await db.select({ id: people.id }).from(people).where(eq(people.nameNormalized, normalized));
      let personId = existing[0]?.id;
      if (!personId) {
        const [created] = await db
          .insert(people)
          .values({
            fullName: titleCase(name),
            nameNormalized: normalized,
            sex: sexByKey.get(`${codiEns}|${normalized}`) ?? null,
          })
          .returning({ id: people.id });
        personId = created!.id;
      }

      const partyRaw = row.partit_politic ?? note ?? null;
      const groupId = partyRaw ? groups.get(`${municipalityId}|${normalizePersonName(partyRaw)}`) ?? null : null;

      const already = await db
        .select({ id: councillorMandates.id })
        .from(councillorMandates)
        .where(and(eq(councillorMandates.personId, personId), eq(councillorMandates.municipalityId, municipalityId)));

      if (already.length === 0) {
        await db.insert(councillorMandates).values({
          municipalityId,
          termId: terms.get(municipalityId) ?? null,
          personId,
          groupId,
          role: row.carrec ?? null,
          partyRaw,
          orderNum: toInt(row.ordre),
          source: "socrata_nm3n",
        });
        run.rowsOut += 1;
      }
    }

    if (orphans > 0) {
      await run.issue({ kind: "orphan_councillor", severity: "baixa", detail: { files: orphans } });
    }
    return { regidors: rows.length, sense_municipi: orphans };
  });
}
