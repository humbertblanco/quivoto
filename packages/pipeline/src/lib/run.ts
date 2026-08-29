import { eq } from "drizzle-orm";
import { dataIssues, ingestRuns, type Db } from "@quivoto/db";

/**
 * Cada execució queda registrada, i tot el que no quadra es desa com a
 * incidència en comptes de morir amb una excepció. La regla del projecte és que
 * una dada estranya no ha d'aturar la ingesta, però tampoc ha de passar
 * desapercebuda: ha de sortir a la llista de coses per mirar.
 */
export class Run {
  private constructor(
    readonly db: Db,
    readonly job: string,
    readonly id: number,
  ) {}

  rowsIn = 0;
  rowsOut = 0;
  private issueCount = 0;
  private readonly log: string[] = [];

  static async start(db: Db, job: string): Promise<Run> {
    const [row] = await db.insert(ingestRuns).values({ job }).returning({ id: ingestRuns.id });
    return new Run(db, job, row!.id);
  }

  say(message: string): void {
    this.log.push(message);
    process.stdout.write(`  ${message}\n`);
  }

  async issue(params: {
    kind: string;
    severity?: "alta" | "mitjana" | "baixa";
    municipalityId?: number;
    entity?: string;
    detail?: Record<string, unknown>;
  }): Promise<void> {
    this.issueCount += 1;
    await this.db.insert(dataIssues).values({
      kind: params.kind,
      severity: params.severity ?? "mitjana",
      municipalityId: params.municipalityId ?? null,
      entity: params.entity ?? null,
      detail: params.detail ?? {},
    });
  }

  async finish(summary: Record<string, unknown> = {}): Promise<void> {
    await this.db
      .update(ingestRuns)
      .set({
        status: "ok",
        rowsIn: this.rowsIn,
        rowsOut: this.rowsOut,
        issues: this.issueCount,
        summary: { ...summary, log: this.log },
        finishedAt: new Date(),
      })
      .where(eq(ingestRuns.id, this.id));
    process.stdout.write(
      `  → ${this.job}: ${this.rowsIn} llegides, ${this.rowsOut} desades, ${this.issueCount} incidències\n`,
    );
  }

  async fail(error: unknown): Promise<void> {
    await this.db
      .update(ingestRuns)
      .set({
        status: "error",
        summary: { error: String(error), log: this.log },
        finishedAt: new Date(),
      })
      .where(eq(ingestRuns.id, this.id));
  }
}

/** Executa una feina deixant-ne sempre traça, tant si va bé com si no. */
export async function withRun(db: Db, job: string, fn: (run: Run) => Promise<Record<string, unknown> | void>): Promise<void> {
  process.stdout.write(`\n▸ ${job}\n`);
  const run = await Run.start(db, job);
  try {
    const summary = await fn(run);
    await run.finish(summary ?? {});
  } catch (error) {
    await run.fail(error);
    throw error;
  }
}
