/**
 * Regenera només les pàgines de preguntes (índex i detall), que no depenen de
 * la base de dades. La demostració jugable no s'hi inclou: aquella necessita el
 * ple d'avui i, per tant, la base de dades.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { carregaPreguntes, renderIndexPreguntes, renderPreguntes } from "./publish/preguntes";

const ARREL = new URL("../../../web/public/observatori/preguntes/", import.meta.url).pathname;
const data = new Date().toISOString().slice(0, 10);
const conjunts = carregaPreguntes();
for (const conjunt of conjunts) {
  mkdirSync(join(ARREL, conjunt.slug), { recursive: true });
  writeFileSync(join(ARREL, conjunt.slug, "index.html"), renderPreguntes(conjunt, data), "utf8");
}
writeFileSync(join(ARREL, "index.html"), renderIndexPreguntes(conjunts, data), "utf8");
process.stdout.write(`${conjunts.length} conjunts de preguntes regenerats\n`);
