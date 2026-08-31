import { and, eq, isNull } from "drizzle-orm";
import {
  councilTerms, councillorMandates, municipalities, people, politicalGroups, type Db,
} from "@quivoto/db";
import { DATASETS, socrataAll } from "../adapters/socrata";
import { normalizePersonName, titleCase, toInt } from "../lib/text";
import { sameForce } from "@quivoto/shared-schemas/brands";
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
export function splitName(raw: string): { name: string; note: string | null } {
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
 *
 * I comprovat el 31-08-2026: `nm3n-3vbj` només porta **la composició d'avui**
 * —les columnes són codi d'ens, nom, càrrec, partit, ordre i data de
 * nomenament, sense cap identificador d'elecció ni de mandat—, així que J3 no
 * pot ingerir els plens del 2015 ni del 2019. Qui hi seia llavors surt de les
 * candidatures amb `electe` de J4, que sí que en porta les tres eleccions.
 */
export async function j3Councillors(db: Db): Promise<void> {
  await withRun(db, "J3 composició dels plens", async (run) => {
    const byCodiEns = new Map<string, number>();
    for (const m of await db.select().from(municipalities)) byCodiEns.set(m.codiEns, m.id);

    const terms = new Map<number, number>();
    const termIds = new Set<number>();
    for (const t of await db.select().from(councilTerms).where(eq(councilTerms.electionId, "M20231"))) {
      terms.set(t.municipalityId, t.id);
      termIds.add(t.id);
    }

    /**
     * Clau de comparació de noms de grup: sense accents, sense signes i sense
     * espais. Les dues fonts escriuen el mateix grup amb l'espaiat dels guions
     * canviat —«ERC-EUiA - AM» contra «ERC-EUiA-AM», «BCN en Comú - C» contra
     * «Barcelona en Comú-C»— i comparar-los amb els guions dins deixava sense
     * grup nou dels quaranta-un regidors de Barcelona.
     */
    const clau = (nom: string): string => normalizePersonName(nom).replace(/[^a-z0-9]/g, "");

    // Només els grups del mandat actual: la taula en té dels tres mandats i
    // buscar-hi a cegues trobava dos candidats per a la mateixa força.
    const groups = new Map<string, number>();
    const groupsPerMunicipi = new Map<number, { id: number; name: string }[]>();
    for (const g of await db.select().from(politicalGroups)) {
      if (g.termId !== null && !termIds.has(g.termId)) continue;
      groups.set(`${g.municipalityId}|${clau(g.name)}`, g.id);
      const list = groupsPerMunicipi.get(g.municipalityId) ?? [];
      list.push({ id: g.id, name: g.name });
      groupsPerMunicipi.set(g.municipalityId, list);
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
      // Primer per nom exacte i, si no lliga, per força.
      //
      // El registre de plens escriu el grup a la seva manera i sovint no
      // coincideix amb el nom de la candidatura: a Barcelona hi diu «BCN en
      // Comú - C» quan el grup és «Barcelona en Comú-C», i nou dels quaranta-un
      // regidors es quedaven sense grup i sense color a la fitxa.
      let groupId: number | null = null;
      if (partyRaw) {
        groupId = groups.get(`${municipalityId}|${clau(partyRaw)}`) ?? null;
        if (groupId === null) {
          const candidats = groupsPerMunicipi.get(municipalityId) ?? [];
          const encaixen = candidats.filter((g) => sameForce(g.name, partyRaw));
          // Només si no hi ha empat: dos grups de la mateixa força al mateix
          // ple voldria dir que no en podem triar cap sense endevinar.
          if (encaixen.length === 1) groupId = encaixen[0]!.id;
        }
      }

      const already = await db
        .select({ id: councillorMandates.id })
        .from(councillorMandates)
        .where(and(eq(councillorMandates.personId, personId), eq(councillorMandates.municipalityId, municipalityId)));

      // Si el mandat ja hi és però es va desar sense grup, ara que sabem
      // resoldre'l per força l'hi posem: reingerir no serveix de res si les
      // files velles es queden com estaven.
      if (already.length > 0 && groupId !== null) {
        await db
          .update(councillorMandates)
          .set({ groupId })
          .where(and(eq(councillorMandates.id, already[0]!.id), isNull(councillorMandates.groupId)));
      }

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
