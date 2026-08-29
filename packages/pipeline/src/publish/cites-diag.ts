/**
 * Per a cada cita que no s'ha trobat, diu fins on coincideix amb el document.
 *
 * Serveix per distingir dues coses que el verificador tot sol no distingeix: una
 * cita inventada, que no coincideix des del principi, i una cita bona que el PDF
 * trenca pel mig amb una capçalera o un número de pàgina, que coincideix cent
 * caràcters i s'atura de cop.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { nucli, textDeLActa, verificaCites } from "./cites";
import type { Conjunt } from "./llindar";

const DIR = new URL("./afirmacions/", import.meta.url).pathname;

/** Fins a quin caràcter de la cita el document encara la segueix. */
function prefixMesLlarg(cita: string, doc: string): number {
  // Es mira només el primer tros de l'el·lipsi: si aquell ja no hi és, la cita
  // no s'assembla al document des del principi.
  const n = nucli(cita.split(/\.{3}|…/)[0] ?? cita);
  let baix = 0;
  let alt = n.length;
  while (baix < alt) {
    const mig = Math.ceil((baix + alt) / 2);
    if (doc.includes(n.slice(0, mig))) baix = mig;
    else alt = mig - 1;
  }
  return baix;
}

for (const fitxer of readdirSync(DIR).filter((f) => f.endsWith(".json"))) {
  const conjunt = JSON.parse(readFileSync(join(DIR, fitxer), "utf8")) as Conjunt;
  for (const cita of verificaCites(conjunt).filter((c) => c.estat === "no-hi-es")) {
    const doc = textDeLActa(cita.url);
    if (doc === null) continue;
    const n = nucli(cita.text);
    const fins = prefixMesLlarg(cita.text, doc);
    const pct = Math.round((100 * fins) / n.length);
    const diagnostic = pct >= 60 ? "TALL DEL PDF?" : pct >= 20 ? "dubtosa" : "NO HI ÉS";
    process.stdout.write(
      `${fitxer.replace(".json", "")} #${cita.afirmacio} · coincideix ${pct}% (${fins}/${n.length}) · ${diagnostic}\n` +
        `   «${cita.text.slice(0, 95).replace(/\n/g, " ")}…»\n`,
    );
  }
}
