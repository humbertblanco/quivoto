/**
 * Genera les imatges per a xarxes (X, 16:9 i 4:5) a `exports/xarxes/`.
 *
 * Com s'executa (des de l'arrel del monorepo, amb l'Observatori ja publicat a
 * `web/public/observatori/`):
 *
 *     node_modules/.bin/tsx tools/xarxes/genera.ts            # tot
 *     node_modules/.bin/tsx tools/xarxes/genera.ts friki top  # només unes famílies
 *     node_modules/.bin/tsx tools/xarxes/genera.ts --sense-captures
 *
 * o bé `cd packages/pipeline && ../../node_modules/.bin/tsx ../../tools/xarxes/genera.ts`.
 * Cal un Chrome (o `QUIVOTO_CHROME=/camí/al/binari`) i, per a la família
 * «captura», `python3` per servir el web en local mentre dura la feina.
 *
 * Les dades surten només de fitxers ja publicats (vegeu `dades.ts`): no obre
 * cap base de dades ni executa cap feina del pipeline. La sortida:
 *
 *     exports/xarxes/<familia>/<familia>-<nom>-<mida>-v<variant>.png
 *     exports/xarxes/INDEX.md        text suggerit per a cada imatge, amb l'enllaç
 *     exports/xarxes/CONTACTE.html   totes les imatges en una graella
 *
 * Els tests: `node_modules/.bin/vitest run --config tools/xarxes/vitest.config.ts`.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { llegeixCatalunya, llegeixFitxa, llegeixRanquingsHtml, parseCuriositats, parseParticipacio, parseRanquings, parseTitolsRanquings } from "./dades";
import { composa, MIDES, type Mida } from "./estil";
import { propostesAbans } from "./familia-abans";
import { propostesCaptura, SLUGS_CAPTURA } from "./familia-captura";
import { propostesFil } from "./familia-fil";
import { propostesFriki } from "./familia-friki";
import { propostesMapa } from "./familia-mapa";
import { propostesMarca } from "./familia-marca";
import { propostesTop } from "./familia-top";
import { captures } from "./captures";
import { escriuContacte, escriuIndex } from "./index-sortida";
import { fitxerDe, type Dades, type Proposta } from "./propostes";
import { ARREL, obreDibuixant } from "./render";

const SORTIDA = join(ARREL, "exports/xarxes");

const FAMILIES: Record<string, (d: Dades) => Proposta[]> = {
  friki: propostesFriki, top: propostesTop, abans: propostesAbans, mapa: propostesMapa,
  captura: propostesCaptura, fil: propostesFil, marca: propostesMarca,
};

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const senseCaptures = args.includes("--sense-captures");
  const demanades = args.filter((a) => !a.startsWith("--"));
  const families = demanades.length ? demanades : Object.keys(FAMILIES);
  for (const f of families) if (!FAMILIES[f]) throw new Error(`família desconeguda: ${f} (hi ha ${Object.keys(FAMILIES).join(", ")})`);

  const { generat, files } = llegeixCatalunya();
  const ranquingsHtml = llegeixRanquingsHtml();
  const dades: Dades = {
    generat, files,
    curiositats: parseCuriositats(ranquingsHtml),
    ranquings: parseRanquings(ranquingsHtml),
    titolsRanquings: parseTitolsRanquings(ranquingsHtml),
    participacio: Object.fromEntries(["barcelona", "girona", "rajadell", "portbou", "olivella", "lleida"].map((s) => [s, parseParticipacio(llegeixFitxa(s))])),
    captures: families.includes("captura") && !senseCaptures ? await captures(SLUGS_CAPTURA) : {},
  };

  const propostes = families.flatMap((f) => FAMILIES[f]!(dades))
    .filter((p) => p.familia !== "captura" || Object.keys(dades.captures).length > 0);

  const dibuixant = await obreDibuixant();
  const fetes: { proposta: Proposta; mida: Mida; fitxer: string }[] = [];
  try {
    for (const p of propostes) {
      for (const nomMida of p.mides) {
        const mida = MIDES.find((m) => m.nom === nomMida)!;
        const fitxer = fitxerDe(p, mida);
        const desti = join(SORTIDA, fitxer);
        await mkdir(dirname(desti), { recursive: true });
        await writeFile(desti, await dibuixant.png(composa(mida, p.fons, p.cos(mida), p.css ?? "")));
        fetes.push({ proposta: p, mida, fitxer });
        process.stdout.write(`  ${fitxer}\n`);
      }
    }
  } finally {
    await dibuixant.tanca();
  }

  // L'índex i el contacte es refan sencers només quan s'han generat totes les
  // famílies; si se'n demana una, no s'ha de perdre el que hi havia de les altres.
  if (!demanades.length) {
    await escriuIndex(SORTIDA, fetes, generat);
    await escriuContacte(SORTIDA, fetes, generat);
  }
  console.log(`${fetes.length} imatges a ${SORTIDA}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
