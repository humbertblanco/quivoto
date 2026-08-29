import { eq } from "drizzle-orm";
import { municipalities, partyBrands, elections, type Db } from "@quivoto/db";
import { PARTY_BRANDS } from "@quivoto/shared-schemas/brands";
import { councilSeats } from "@quivoto/shared-schemas/seats";
import { minutesCoverage } from "../adapters/aoc";
import { DATASETS, socrataAll } from "../adapters/socrata";
import { municipalityName, slugifyMunicipality, toInt } from "../lib/text";
import { withRun } from "../lib/run";

type EnsRow = {
  codi_ens: string;
  nom_complert: string;
  comarca?: string;
  provincia?: string;
  cens?: string;
  any_cens?: string;
  president?: string;
  partitpol?: string;
  web?: string;
  e_mail?: string;
  latitud?: string;
  longitud?: string;
};

/**
 * J1 — territori. Carrega els 947 municipis amb el padró vigent, l'alcaldia en
 * actiu i els tres sistemes de codis, calcula els regidors que els toquen per
 * llei i hi enganxa la cobertura d'actes de l'AOC, que és el semàfor que dirà
 * fins on pot arribar la brúixola a cada poble.
 *
 * Ho fem per als 947 i no per als 200 més poblats: aquestes consultes són
 * gratuïtes i limitar-les no estalviaria res.
 */
export async function j1Territory(db: Db): Promise<void> {
  await withRun(db, "J1 territori", async (run) => {
    // Llavors que la resta de feines pressuposen.
    await db
      .insert(partyBrands)
      .values(PARTY_BRANDS.map((b) => ({ id: b.id, name: b.name, color: b.color, kind: b.kind, lineage: b.lineage ?? null })))
      .onConflictDoNothing();
    await db
      .insert(elections)
      .values([
        { id: "M20231", name: "Eleccions municipals 2023", kind: "municipal", votedOn: "2023-05-28" },
        { id: "M20191", name: "Eleccions municipals 2019", kind: "municipal", votedOn: "2019-05-26" },
        { id: "M20151", name: "Eleccions municipals 2015", kind: "municipal", votedOn: "2015-05-24" },
      ])
      .onConflictDoNothing();

    const rows = await socrataAll<EnsRow>(DATASETS.ensLocals, {
      where: "nomtipus='Municipis'",
      select: "codi_ens,nom_complert,comarca,provincia,cens,any_cens,president,partitpol,web,e_mail,latitud,longitud",
      order: "codi_ens",
    });
    run.rowsIn = rows.length;
    run.say(`${rows.length} municipis al padró de la Generalitat`);

    // Cobertura d'actes: una sola consulta per a tot Catalunya.
    const coverage = new Map<number, { count: number; lastDate: string }>();
    try {
      for (const c of await minutesCoverage()) coverage.set(c.codiEns, { count: c.count, lastDate: c.lastDate });
      run.say(`${coverage.size} ens amb actes al feed de l'AOC des del 17-06-2023`);
    } catch (error) {
      run.say(`no s'ha pogut llegir la cobertura d'actes: ${String(error)}`);
      await run.issue({ kind: "aoc_unavailable", severity: "alta", detail: { error: String(error) } });
    }

    // Els noms de municipi són únics a Catalunya, però ho comprovem: si algun dia
    // deixen de ser-ho, val més descobrir-ho aquí que a la pàgina pública.
    const usedSlugs = new Map<string, string>();
    let withoutMinutes = 0;

    for (const row of rows) {
      const codiEns = String(row.codi_ens).padStart(10, "0");
      const name = municipalityName(row.nom_complert);
      const population = toInt(row.cens);
      let slug = slugifyMunicipality(name);
      if (usedSlugs.has(slug)) {
        await run.issue({
          kind: "slug_collision",
          severity: "alta",
          entity: name,
          detail: { slug, altre: usedSlugs.get(slug) },
        });
        slug = `${slug}-${slugifyMunicipality(row.comarca ?? codiEns)}`;
      }
      usedSlugs.set(slug, name);

      const cover = coverage.get(Number(codiEns));
      if (!cover) withoutMinutes += 1;

      const values = {
        ine5: codiEns.slice(0, 5),
        idescat6: codiEns.slice(0, 6),
        codiEns,
        slug,
        name,
        comarca: row.comarca ?? null,
        provincia: row.provincia ?? null,
        population,
        populationYear: toInt(row.any_cens),
        lat: row.latitud ?? null,
        lon: row.longitud ?? null,
        web: row.web ?? null,
        email: row.e_mail ?? null,
        mayorName: row.president ?? null,
        mayorPartyRaw: row.partitpol ?? null,
        councilSeats: population === null ? null : councilSeats(population),
        minutesCount: cover?.count ?? 0,
        minutesLastDate: cover?.lastDate ?? null,
        minutesAdapter: cover ? "aoc" : "cap",
        updatedAt: new Date(),
      };

      await db
        .insert(municipalities)
        .values(values)
        .onConflictDoUpdate({ target: municipalities.codiEns, set: values });
      run.rowsOut += 1;
    }

    // Els municipis grans sense actes necessiten adaptador propi: que quedi escrit.
    const big = await db.select().from(municipalities).where(eq(municipalities.minutesAdapter, "cap"));
    for (const m of big) {
      if ((m.population ?? 0) < 20_000) continue;
      // No és un error nostre sinó una absència a la font, i la fitxa ja ho diu
      // obertament. Marcar-ho com a greu bloquejaria la publicació de municipis
      // que no tenen cap problema de dades.
      await run.issue({
        kind: "missing_minutes",
        severity: "mitjana",
        municipalityId: m.id,
        entity: m.name,
        detail: { population: m.population, motiu: "cap acta al feed de l'AOC; cal adaptador propi" },
      });
    }

    return { municipis: rows.length, senseActes: withoutMinutes };
  });
}
