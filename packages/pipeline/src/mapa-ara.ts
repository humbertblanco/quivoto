import { writeFileSync } from "node:fs";
import { geometria, renderMapaCatalunya } from "./publish/mapa-catalunya";
import type { Els947Row } from "./publish/els947";
const slugs = Object.keys(geometria.municipis);
const files: Els947Row[] = slugs.map((s, i) => ({
  s, n: s.replace(/-/g, " "), c: "comarca", p: 1000 + i, r: 11,
  a: null, g: null, w: (i % 3 === 0 ? 0 : 1) as 0 | 1, m: (i % 4 === 0 ? 1 : 0) as 0 | 1,
  k: (i % 9 === 0 ? 1 : 0) as 0 | 1, t: 0, d: i % 900, e: 5, f: i % 60, v: i % 5,
  q: 12, y: i % 100, o: 0,
}));
writeFileSync(process.argv[2]!, renderMapaCatalunya(files, "2026-08-29"), "utf8");
process.stdout.write("mapa de prova escrit\n");
