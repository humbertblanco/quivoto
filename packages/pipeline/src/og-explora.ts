import { openDb, municipalities, municipalityMetrics } from "@quivoto/db";
import { inArray } from "drizzle-orm";
const { db, close } = await openDb();
const mets = await db.select().from(municipalityMetrics).where(inArray(municipalityMetrics.kind, ["government","results","singleList","mayors","electoralHistory"]));
const by = new Map<number, any>();
for (const m of mets) { const o = by.get(m.municipalityId) ?? {}; o[m.kind] = m.data; by.set(m.municipalityId, o); }
const muns = await db.select().from(municipalities);
const lens: number[] = []; let ambMaj = 0, senseMaj = 0, coalicio = 0;
const marques = new Map<string,string>();
for (const m of muns) {
  const d = by.get(m.id) ?? {}; const g = d.government;
  if (!g?.mayorSigles) continue;
  lens.push(g.mayorSigles.length);
  if (g.winnerHasMajority && g.winnerGoverns) ambMaj++; else senseMaj++;
  if (g.coalitionLikely) coalicio++;
  const cands = d.results?.M20231?.candidatures ?? [];
  const c = cands.find((x: any) => x.sigles === g.mayorSigles);
  if (c) marques.set(g.mayorSigles, c.brandId);
}
lens.sort((a,b)=>a-b);
console.log({ n: lens.length, p50: lens[Math.floor(lens.length*.5)], p90: lens[Math.floor(lens.length*.9)], p99: lens[Math.floor(lens.length*.99)], max: lens[lens.length-1] });
console.log({ ambMaj, senseMaj, coalicio });
console.log("sigles >20:", lens.filter(l=>l>20).length, "| >26:", lens.filter(l=>l>26).length);
console.log("aparellades amb marca:", marques.size, "de", lens.length);
console.log("mostra llargues:", [...marques].filter(([s])=>s.length>20).slice(0,10));
await close();
