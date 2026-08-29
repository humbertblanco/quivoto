import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { informe, validaConjunt, type Conjunt } from "./llindar";

/**
 * Passa el llindar a tots els conjunts d'afirmacions que hi hagi escrits.
 * És el que hauria d'haver-hi hagut abans de donar per bona la primera mostra.
 */
const dir = join(dirname(fileURLToPath(import.meta.url)), "afirmacions");
let publicables = 0;
const fitxers = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();

for (const fitxer of fitxers) {
  const conjunt = JSON.parse(readFileSync(join(dir, fitxer), "utf8")) as Conjunt;
  const veredicte = validaConjunt(conjunt);
  if (veredicte.publicable) publicables += 1;
  process.stdout.write(`\n${informe(veredicte)}\n`);
}
process.stdout.write(`\n${publicables} de ${fitxers.length} passarien el llindar.\n`);
