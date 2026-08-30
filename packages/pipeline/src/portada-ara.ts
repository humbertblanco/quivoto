/**
 * Genera només la portada de l'Observatori, comptant els fitxers ja publicats.
 *
 * Existeix perquè la portada es pugui refrescar sense obrir la base de dades,
 * que durant les ingestes llargues està ocupada per un altre procés. El
 * `publica` sencer la torna a generar igual.
 */
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderPortada } from "./publish/portada";
import { carregaPreguntes } from "./publish/preguntes";

const ARREL = new URL("../../../web/public/observatori/", import.meta.url).pathname;
const compta = (dir: string, filtre: (n: string) => boolean): number => {
  try {
    return readdirSync(join(ARREL, dir)).filter(filtre).length;
  } catch {
    return 0;
  }
};

const municipis = compta("m", (n) => statSync(join(ARREL, "m", n)).isDirectory());
const comarques = compta("c", (n) => statSync(join(ARREL, "c", n)).isDirectory());
const fitxersDades = compta("dades/m", (n) => n.endsWith(".json") || n.endsWith(".csv"));
let candidatures = 0;
for (const m of readdirSync(join(ARREL, "m"))) {
  try {
    candidatures += readdirSync(join(ARREL, "m", m)).filter((n) =>
      statSync(join(ARREL, "m", m, n)).isDirectory(),
    ).length;
  } catch {}
}
const partits = compta("partit", (n) => statSync(join(ARREL, "partit", n)).isDirectory());
const preguntes = carregaPreguntes();
const data = new Date().toISOString().slice(0, 10);

writeFileSync(
  join(ARREL, "index.html"),
  renderPortada(
    {
      municipis,
      comarques,
      candidatures,
      fitxersDades,
      conjuntsPreguntes: preguntes.length,
      // Aquest generador ràpid no obre la base de dades i no en sap res: ni de
      // l'AMB ni de quantes persones té la trajectòria, i sense el recompte
      // l'enllaç no surt. Tampoc no li passa la mostra —les ciutats amb cara,
      // el mapa, les marques—, i per això aquesta portada surt amb els enllaços
      // a les seccions i prou. El «publica» sencer ho posa tot.
      amb: null,
      partits,
      trajectoria: null,
      exemple: preguntes[0] ? { slug: preguntes[0].slug, nom: preguntes[0].municipi } : null,
      provaDestacada: preguntes[0] ? { slug: preguntes[0].slug, nom: preguntes[0].municipi } : null,
    },
    data,
  ),
  "utf8",
);
process.stdout.write(
  `portada: ${municipis} municipis · ${candidatures} candidatures · ${comarques} comarques · ${fitxersDades} fitxers · ${preguntes.length} conjunts\n`,
);
