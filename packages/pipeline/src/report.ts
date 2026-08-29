import { desc, eq, sql } from "drizzle-orm";
import {
  candidatures, dataIssues, municipalities, municipalityMetrics, people, type Db,
} from "@quivoto/db";

/**
 * Un cop d'ull a què hi ha a la base de dades i a què no quadra. És el primer
 * lloc on mirar després d'una ingesta, i el que ens ha de dir si la Fase 1 està
 * realment acabada o només sembla que ho està.
 */
export async function report(db: Db): Promise<void> {
  const count = async (table: Parameters<typeof db.select>[0] extends never ? never : any): Promise<number> => {
    const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(table);
    return row?.n ?? 0;
  };

  process.stdout.write("\n▸ resum\n");
  process.stdout.write(`  municipis            ${await count(municipalities)}\n`);
  process.stdout.write(`  candidatures         ${await count(candidatures)}\n`);
  process.stdout.write(`  persones             ${await count(people)}\n`);

  const [seats] = await db
    .select({ n: sql<number>`coalesce(sum(${municipalities.councilSeats}), 0)::int` })
    .from(municipalities);
  process.stdout.write(`  regidories previstes ${seats?.n ?? 0}\n`);

  const coverage = await db
    .select({
      tram: sql<string>`case
        when ${municipalities.minutesCount} = 0 then 'cap acta'
        when ${municipalities.minutesCount} < 10 then '1-9 actes'
        when ${municipalities.minutesCount} < 20 then '10-19 actes'
        else '20 o més' end`,
      n: sql<number>`count(*)::int`,
    })
    .from(municipalities)
    .groupBy(sql`1`)
    .orderBy(sql`2 desc`);
  process.stdout.write("\n▸ cobertura d'actes\n");
  for (const row of coverage) process.stdout.write(`  ${row.tram.padEnd(20)} ${row.n}\n`);

  const issues = await db
    .select({ kind: dataIssues.kind, severity: dataIssues.severity, n: sql<number>`count(*)::int` })
    .from(dataIssues)
    .where(eq(dataIssues.resolved, false))
    .groupBy(dataIssues.kind, dataIssues.severity)
    .orderBy(desc(sql`count(*)`));
  process.stdout.write("\n▸ incidències obertes\n");
  if (issues.length === 0) process.stdout.write("  cap\n");
  for (const row of issues) process.stdout.write(`  ${row.severity.padEnd(8)} ${row.kind.padEnd(32)} ${row.n}\n`);

  // La dada que ningú publica de manera comparable: on la llista més votada no governa.
  const government = await db
    .select({ data: municipalityMetrics.data })
    .from(municipalityMetrics)
    .where(eq(municipalityMetrics.kind, "government"));
  let winnerGoverns = 0;
  let winnerDoesNot = 0;
  let unknown = 0;
  let withMajority = 0;
  for (const row of government) {
    const d = row.data as { winnerGoverns: boolean | null; winnerHasMajority: boolean };
    if (d.winnerHasMajority) withMajority += 1;
    if (d.winnerGoverns === null) unknown += 1;
    else if (d.winnerGoverns) winnerGoverns += 1;
    else winnerDoesNot += 1;
  }
  if (government.length > 0) {
    process.stdout.write("\n▸ qui governa (mandat 2023-2027)\n");
    process.stdout.write(`  la llista més votada governa        ${winnerGoverns}\n`);
    process.stdout.write(`  governa una altra llista (pacte)    ${winnerDoesNot}\n`);
    process.stdout.write(`  no s'ha pogut determinar            ${unknown}\n`);
    process.stdout.write(`  amb majoria absoluta d'una llista   ${withMajority}\n`);
  }
}
