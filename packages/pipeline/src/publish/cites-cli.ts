/**
 * Passa el verificador de cites per tots els conjunts d'afirmacions i diu quines
 * cites no són al document que diuen citar. No toca la base de dades.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resumeixCites } from "./cites";
import type { Conjunt } from "./llindar";

const DIR = new URL("./afirmacions/", import.meta.url).pathname;
const nomes = process.argv[2] ?? null;
let totals = { total: 0, ok: 0, mal: 0, sense: 0 };

for (const fitxer of readdirSync(DIR).filter((f) => f.endsWith(".json"))) {
  if (nomes && !fitxer.startsWith(nomes)) continue;
  const conjunt = JSON.parse(readFileSync(join(DIR, fitxer), "utf8")) as Conjunt;
  const r = resumeixCites(conjunt);
  totals.total += r.total;
  totals.ok += r.verificades;
  totals.mal += r.noHiSon;
  totals.sense += r.senseDocument;
  const marca = r.noHiSon === 0 ? "·" : "!";
  process.stdout.write(
    `${marca} ${fitxer.replace(".json", "").padEnd(26)} ${String(r.verificades).padStart(3)} verificades · ` +
      `${String(r.noHiSon).padStart(3)} NO HI SÓN · ${String(r.senseDocument).padStart(3)} sense document a disc\n`,
  );
  for (const p of r.problemes) {
    process.stdout.write(`    afirmació ${p.afirmacio}: «${p.text.slice(0, 110)}…»\n`);
  }
}
process.stdout.write(
  `\nTOTAL ${totals.total} cites · ${totals.ok} verificades · ${totals.mal} no hi són · ${totals.sense} sense document\n`,
);
