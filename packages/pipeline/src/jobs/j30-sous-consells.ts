import { municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { socrataAll } from "../adapters/socrata";
import { fetchText, parseCarrecs, senseTokenAuth, titolMunicipi, urlCarrecs } from "../adapters/seue";
import { esAlcaldia, importEnEuros, indexUnic, PLENS, valorCamp } from "./j14-electes-cost";
import { LLICENCIA_SEUE } from "./j24-diputacions";
import { sleep } from "../lib/http";
import { normalize, normalizePersonName, titleCase } from "../lib/text";
import { withRun, type Run } from "../lib/run";

/**
 * J30 — el segon sou, capítol dels consells comarcals: què paga cada consell
 * als seus consellers, dit per ell mateix.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PER QUÈ AQUESTA FEINA EXISTEIX SI LA J14 JA VISITA ELS CONSELLS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * El cas que la va fer néixer és la presidenta del Consell Comarcal del Baix
 * Llobregat, que és alhora l'alcaldessa de Vallirana. El consell publica a la
 * fitxa d'ella, a seu-e, «Retribució anual bruta: 47.150,00 € bruts (dedicació
 * exclusiva)» —comprovat baixant-la el 31-08-2026—, i la nostra fitxa deia
 * «no en consta cap per a aquesta persona». No era un buit de la font: era
 * un desencaix de dues lletres.
 *
 * La J14 creua el ple municipal amb el del consell fent servir el conjunt de
 * plens de la Generalitat (`nm3n-3vbj`) a totes dues bandes, amb el nom
 * normalitzat i **exacte**. I aquell conjunt escriu la mateixa persona de dues
 * maneres: «EVA MARÍA MARTÍNEZ MORALES» a la fila de Vallirana i
 * «EVA M. MARTINEZ MORALES» a la del consell. Amb el nom exacte no lliguen
 * mai, el creuament la perd, i amb ella tothom que una font escrigui amb la
 * inicial i l'altra amb el nom sencer.
 *
 * El que aquesta feina hi afegeix, doncs, són dues coses:
 *
 *   · **Llegir els 40 consells sencers**, no només els que ja tenien un lligam:
 *     la J14 només visita un ens si el creuament exacte li ha donat algú, així
 *     que un consell on tots els noms vinguin abreujats no es visita mai.
 *   · **L'aparellament per inicial**, amb la prudència de sempre: «Eva M.» pot
 *     lligar amb «Eva María» perquè una lletra amb punt és una abreviatura i
 *     no un altre nom. La J24 va deixar fora «Ana M. Martínez Martínez» per
 *     «ANA MARIA MARTÍNEZ MARTÍNEZ» juntament amb els «Filo» i els «Xesco»;
 *     aquí se'n separa el cas de la inicial —i només aquest— perquè és l'únic
 *     on l'abreviatura és mecànica i comprovable lletra a lletra. Un «Filo»
 *     continua sense lligar amb ningú. I la regla d'or no es toca: si el nom
 *     pot ser de dues persones, no és de cap.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA FONT, COMPROVADA CONSELL A CONSELL EL 31-08-2026
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Al cens de plens de la Generalitat hi ha **40 consells comarcals** (el del
 * Barcelonès es va dissoldre el 2019, l'Aran té el Conselh Generau amb règim
 * propi i el Lluçanès encara no hi surt). Els seus slugs de seu-e no es
 * dedueixen amb cap regla fiable —la lliçó de la J24— i per això aquí van
 * comprovats un a un contra el `<title>` de la seva pàgina: **37 responen**
 * i 3 no hi són (Baix Ebre i Garrotxa responen amb una pantalla d'inici de
 * sessió, com ja sabia la J14, i el Baix Penedès no té la pàgina).
 *
 * Dels 37, només **20 publiquen el mòdul estàndard amb contingut** (uns 525
 * consellers en total). 16 el tenen buit, i el Vallès Occidental el serveix en
 * un format propi —un acordió de text lliure amb enllaços a les fitxes d'un
 * altre mòdul— que aquest lector no llegeix: val més un consell sense dades
 * que un import pescat d'una pàgina que no s'entén.
 *
 * L'import surt de la fitxa `veureCarrec` de cada persona, camp
 * `carrec-retribucio`: el mateix camp que a un **ajuntament** no s'ha de creure
 * mai (la J14 ho demostra amb Rubí) i que a un **consell** sí, perquè allà el
 * càrrec el paga l'ens que publica la fitxa. És el patró de la Diputació de
 * Lleida a la J24. El portal de dades obertes de l'AOC no en té cap alternativa
 * llegible: el conjunt «Cartipàs: organització política» (`iio-op-cartipas`,
 * comprovat el 31-08-2026) porta enllaços als documents del cartipàs al CIDO,
 * sense cap persona ni cap import, i per això aquí es llegeix HTML.
 *
 * Tres paranys reals d'aquest camp, trobats mostrejant fitxes el 31-08-2026:
 *
 *   · **El Maresme hi escriu preus per sessió** («Ple 200€ per sessió…»).
 *     200 € no és el sou de ningú: si el text parla d'assistències o de
 *     sessions, no se'n desa cap import anual i es diu per què.
 *   · **El Tarragonès hi escriu un màxim** («15.000 euros màxim anuals»).
 *     Un sostre no és un sou; queda al motiu, amb les paraules de la font.
 *   · **L'Anoia hi posa l'any dins del text** («l'any 2025 22.200 €»), i el
 *     lector de números de la J14 enganxaria el 2025 amb el 22.200. Per això
 *     els anys es treuen abans de llegir l'import (`eurosDelText`).
 *
 * El màxim d'indemnitzacions per assistència, quan la fitxa el publica al camp
 * `carrec-indemnitzacionsAnuals`, es desa a `maximPerAssistencies`: **un sostre,
 * mai un sou, mai sumable**, exactament com a la J24.
 *
 * Llicència: els portals de seu-e remeten a la Llei 37/2007 (LRISP); es reusa
 * la constant de la J24. Ritme: com a molt dues peticions per segon, que per
 * a un servei públic que ens dona això de franc ja és anar de pressa.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Fonts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Els slugs de seu-e dels consells comarcals, comprovats un a un el 31-08-2026
 * contra el `<title>` de la seva pàgina de càrrecs electes. No es dedueixen amb
 * cap regla: es va provar la regla «cc + comarca» sobre els 40 i tres no
 * responen, així que cada entrada d'aquí és una pàgina que va respondre amb el
 * nom de l'ens al títol. Les claus són els `nom_ens` exactes del conjunt de
 * plens de la Generalitat, perquè és amb ells que es creua.
 */
export const SLUGS_CONSELLS: Readonly<Record<string, string>> = {
  "Consell Comarcal de la Cerdanya": "cccerdanya",
  "Consell Comarcal de la Conca de Barberà": "ccconcadebarbera",
  "Consell Comarcal de l'Alta Ribagorça": "ccaltaribagorca",
  "Consell Comarcal de l'Alt Camp": "ccaltcamp",
  "Consell Comarcal de l'Alt Empordà": "ccaltemporda",
  "Consell Comarcal de l'Alt Penedès": "ccaltpenedes",
  "Consell Comarcal de l'Alt Urgell": "ccalturgell",
  "Consell Comarcal de la Noguera": "ccnoguera",
  "Consell Comarcal de l'Anoia": "ccanoia",
  "Consell Comarcal de la Ribera d'Ebre": "ccriberadebre",
  "Consell Comarcal de la Segarra": "ccsegarra",
  "Consell Comarcal de la Selva": "ccselva",
  "Consell Comarcal de la Terra Alta": "ccterraalta",
  "Consell Comarcal del Bages": "ccbages",
  "Consell Comarcal del Baix Camp": "ccbaixcamp",
  "Consell Comarcal del Baix Empordà": "ccbaixemporda",
  "Consell Comarcal del Baix Llobregat": "ccbaixllobregat",
  "Consell Comarcal del Berguedà": "ccbergueda",
  "Consell Comarcal de les Garrigues": "ccgarrigues",
  "Consell Comarcal del Garraf": "ccgarraf",
  "Consell Comarcal del Gironès": "ccgirones",
  "Consell Comarcal del Maresme": "ccmaresme",
  "Consell Comarcal del Moianès": "ccmoianes",
  "Consell Comarcal del Montsià": "ccmontsia",
  "Consell Comarcal del Pallars Jussà": "ccpallarsjussa",
  "Consell Comarcal del Pallars Sobirà": "ccpallarssobira",
  "Consell Comarcal del Pla de l'Estany": "ccpladelestany",
  "Consell Comarcal del Pla d'Urgell": "ccpladurgell",
  "Consell Comarcal del Priorat": "ccpriorat",
  "Consell Comarcal del Ripollès": "ccripolles",
  "Consell Comarcal del Segrià": "ccsegria",
  "Consell Comarcal del Solsonès": "ccsolsones",
  "Consell Comarcal del Tarragonès": "cctarragones",
  "Consell Comarcal de l'Urgell": "ccurgell",
  "Consell Comarcal del Vallès Occidental": "ccvallesoccidental",
  "Consell Comarcal del Vallès Oriental": "ccvallesoriental",
  "Consell Comarcal d'Osona": "ccosona",
};

/**
 * Els que no són a seu-e, amb el motiu comprovat el 31-08-2026. Hi són perquè
 * la seva absència es publiqui com a fet i no com a silenci: un consell que no
 * surt enlloc sembla que no pagui res, i això no ho diu cap font.
 */
export const CONSELLS_SENSE_SEUE: Readonly<Record<string, string>> = {
  "Consell Comarcal de la Garrotxa":
    "el seu slug de seu-e respon amb una pantalla d'inici de sessió i cap candidat no torna la pàgina de càrrecs electes",
  "Consell Comarcal del Baix Ebre":
    "el seu slug de seu-e respon amb una pantalla d'inici de sessió i cap candidat no torna la pàgina de càrrecs electes",
  "Consell Comarcal del Baix Penedès": "no té pàgina de càrrecs electes a seu-e amb cap dels slugs provats",
};

const PAUSA_MS = 500; // com a molt dues peticions per segon

const avui = (): string => new Date().toISOString().slice(0, 10);

// ─────────────────────────────────────────────────────────────────────────────
// Funcions pures: llegir els euros d'una fitxa de consell
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Els euros d'un text que pot portar l'any a dins.
 *
 * «l'any 2025 22.200 €» és com l'Anoia escriu el seu màxim d'indemnitzacions, i
 * `importEnEuros` —que admet espais dins del número per culpa dels punts de
 * milers— hi llegiria 202.522.200 €. Es treuen primer els anys que no van
 * enganxats al símbol: un «2025» seguit de més xifres és una data, i un
 * «2020 €» és un import i es queda.
 */
export function eurosDelText(text: string): number | null {
  const senseAnys = text.replace(/\b(?:19|20)\d{2}\b(?!\s*(?:€|euros?\b|eur\b))/gi, " ");
  return importEnEuros(senseAnys);
}

/** El text, escurçat per citar-lo en un motiu sense empassar-se la pàgina. */
function citat(text: string): string {
  const net = text.replace(/\s+/g, " ").trim();
  return net.length > 160 ? `${net.slice(0, 157)}…` : net;
}

/**
 * La dedicació, quan el consell l'escriu dins del mateix camp de l'import:
 * «(dedicació exclusiva)» al Baix Llobregat, «(50% de dedicació)» a Osona,
 * «al 100% jornada» al Segrià, «dedicació parcial del 40%…» al Bages.
 */
export function dedicacioDeText(text: string): string | null {
  const match = text.match(
    /dedicaci[oó]\s+(?:exclusiva|parcial)(?:\s+del?\s+\d{1,3}\s*%)?|\d{1,3}\s*%\s+de\s+dedicaci[oó]|al\s+\d{1,3}\s*%\s+(?:de\s+)?(?:la\s+)?jornada(?:\s+laboral)?/i,
  );
  return match ? match[0].replace(/\s+/g, " ").trim() : null;
}

export type LecturaFitxa = {
  /** Euros bruts a l'any que el consell diu que paga pel càrrec. */
  retribucioAnualBruta: number | null;
  dedicacio: string | null;
  /** Sostre anual d'indemnitzacions per assistència. **No és un sou.** */
  maximPerAssistencies: number | null;
  /** Per què no hi ha import, amb les paraules de la font quan cal. */
  motiu: string | null;
};

/**
 * El que la fitxa `veureCarrec` d'un conseller diu del que cobra.
 *
 * El camp de retribució només es desa com a import anual quan ho és: si el
 * consell hi escriu preus per sessió (el Maresme) o un màxim (el Tarragonès),
 * allò no és el sou de ningú i queda al motiu, citant la font. El camp
 * d'indemnitzacions, quan porta xifra, és el sostre per assistències.
 */
export function llegeixFitxaConsell(ens: string, html: string): LecturaFitxa {
  const indemnitzacions = valorCamp(html, "carrec-indemnitzacionsAnuals");
  const maximPerAssistencies = indemnitzacions === null ? null : eurosDelText(indemnitzacions);

  const sostre = (): string =>
    maximPerAssistencies === null
      ? ""
      : " Sí que publica un màxim anual d'indemnitzacions per assistència, que és un sostre i no el que ha cobrat.";

  const retribucio = valorCamp(html, "carrec-retribucio");
  if (retribucio === null || retribucio.length === 0) {
    return {
      retribucioAnualBruta: null,
      dedicacio: null,
      maximPerAssistencies,
      motiu: `${ens} no publica cap import anual per a aquesta persona: el camp de retribució de la seva fitxa és buit.${sostre()}`,
    };
  }
  if (/per\s+sessi[oó]|assist[eè]nci/i.test(retribucio)) {
    return {
      retribucioAnualBruta: null,
      dedicacio: dedicacioDeText(retribucio),
      maximPerAssistencies,
      motiu:
        `${ens} no en publica cap import anual: al camp de retribució hi escriu el que es cobra per sessió ` +
        `(«${citat(retribucio)}»), i un preu per sessió no és un sou.`,
    };
  }
  if (/m[aà]xim/i.test(retribucio)) {
    return {
      retribucioAnualBruta: null,
      dedicacio: dedicacioDeText(retribucio),
      maximPerAssistencies,
      motiu:
        `${ens} hi publica un màxim («${citat(retribucio)}»), que és un sostre i no el que ha cobrat: ` +
        "desar-lo com a sou seria inventar-lo.",
    };
  }
  const euros = eurosDelText(retribucio);
  if (euros === null) {
    return {
      retribucioAnualBruta: null,
      dedicacio: dedicacioDeText(retribucio),
      maximPerAssistencies,
      motiu: `${ens} hi escriu un text sense cap import que es pugui llegir («${citat(retribucio)}»).${sostre()}`,
    };
  }
  return { retribucioAnualBruta: euros, dedicacio: dedicacioDeText(retribucio), maximPerAssistencies, motiu: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Funcions pures: aparellament amb inicials
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Si dos noms són la mateixa persona escrita amb una inicial.
 *
 * «EVA MARÍA MARTÍNEZ MORALES» i «Eva M. Martínez Morales» lliguen: mateixos
 * trossos, en el mateix ordre, i on una font posa la paraula sencera l'altra
 * en posa la primera lletra. La regla és mecànica i estreta a consciència:
 *
 *   · Mateix nombre de trossos, i com a mínim tres: amb dos, una inicial
 *     encertaria massa sovint per atzar.
 *   · Cada parell o és idèntic o és una lletra sola contra una paraula que
 *     comença per ella. Cap altre desajust no es perdona: «Filo» no és una
 *     inicial i continua sense lligar, com a la J24.
 *   · Com a mínim una inicial (si no, ja hauria lligat pel camí exacte) i com
 *     a mínim dos trossos llargs idèntics, que és el que fa la coincidència
 *     comprovable i no una endevinalla.
 */
export function nomsLliguenAmbInicials(a: string, b: string): boolean {
  const ta = normalizePersonName(a).split(" ").filter((t) => t.length > 0);
  const tb = normalizePersonName(b).split(" ").filter((t) => t.length > 0);
  if (ta.length !== tb.length || ta.length < 3) return false;
  let inicials = 0;
  let exactesLlargs = 0;
  for (let i = 0; i < ta.length; i += 1) {
    const x = ta[i]!;
    const y = tb[i]!;
    if (x === y) {
      if (x.length > 1) exactesLlargs += 1;
      continue;
    }
    if ((x.length === 1 && y.startsWith(x)) || (y.length === 1 && x.startsWith(y))) {
      inicials += 1;
      continue;
    }
    return false;
  }
  return inicials > 0 && exactesLlargs >= 2;
}

export type CreuamentConsell<M, S> = {
  lligams: { municipal: M; conseller: S; perInicials: boolean }[];
  /** Noms que no identifiquen una sola persona: no se'ls atribueix res. */
  ambigus: string[];
  senseParella: S[];
};

/**
 * Lliga cada conseller comarcal publicat pel consell amb el regidor municipal
 * que és la mateixa persona.
 *
 * Primer el camí de sempre, el de la J24: nom normalitzat exacte i únic a
 * totes dues bandes. Després, i només per als que han quedat sense parella, el
 * de les inicials —i amb el mateix escrúpol: un conseller que lliga amb dos
 * regidors no lliga amb cap, i un regidor reclamat per dos consellers no és
 * de cap dels dos. Una atribució errònia aquí diria que una persona cobra el
 * que no cobra, que és el pitjor error que pot fer aquesta fitxa.
 */
export function creuaAmbInicials<M extends { nom: string }, S extends { nom: string }>(
  municipals: readonly M[],
  consellers: readonly S[],
): CreuamentConsell<M, S> {
  const clau = (x: { nom: string }): string => normalizePersonName(x.nom);
  const mun = indexUnic(municipals, clau);
  const con = indexUnic(consellers, clau);

  const lligams: CreuamentConsell<M, S>["lligams"] = [];
  const ambigus: string[] = [...con.ambigus.keys()];
  const pendents: S[] = [];
  const municipalsOcupats = new Set<string>();

  for (const [k, conseller] of con.unics) {
    const municipal = mun.unics.get(k);
    if (municipal) {
      lligams.push({ municipal, conseller, perInicials: false });
      municipalsOcupats.add(k);
    } else if (mun.ambigus.has(k)) {
      // Dos regidors de Catalunya amb aquest nom exacte: el conseller és real,
      // però no sabem quin dels dos és, i per tant no és cap.
      ambigus.push(k);
    } else {
      pendents.push(conseller);
    }
  }

  // La volta de les inicials, sobre els municipals únics que ningú ha reclamat.
  const candidats = pendents.map((conseller) => ({
    conseller,
    municipals: [...mun.unics.entries()].filter(
      ([mk, m]) => !municipalsOcupats.has(mk) && nomsLliguenAmbInicials(m.nom, conseller.nom),
    ),
  }));
  const reclamats = new Map<string, number>();
  for (const c of candidats) {
    for (const [mk] of c.municipals) reclamats.set(mk, (reclamats.get(mk) ?? 0) + 1);
  }

  const senseParella: S[] = [];
  for (const { conseller, municipals: cands } of candidats) {
    if (cands.length === 0) {
      senseParella.push(conseller);
    } else if (cands.length === 1 && reclamats.get(cands[0]![0]) === 1) {
      lligams.push({ municipal: cands[0]![1], conseller, perInicials: true });
    } else {
      ambigus.push(clau(conseller));
    }
  }
  return { lligams, ambigus, senseParella };
}

// ─────────────────────────────────────────────────────────────────────────────
// La feina
// ─────────────────────────────────────────────────────────────────────────────

type FilaPle = { codi_10: string; nom_ens: string; tipus_ens: string; nom?: string; carrec?: string };

export type FontConsell = {
  nom: string;
  url: string;
  format: string;
  llicencia: string;
  consultat: string;
};

/** El càrrec al consell, amb qui el paga sempre enganxat a l'import. */
export type CarrecAlConsell = {
  ens: string;
  tipus: "consell comarcal";
  carrec: string;
  dedicacio: string | null;
  retribucioAnualBruta: number | null;
  /** Sostre d'indemnitzacions per assistència. Mai un sou; mai sumable. */
  maximPerAssistencies: number | null;
  /** Per què no hi ha import, quan no n'hi ha. */
  motiu: string | null;
  font: FontConsell;
  metode: string;
};

export type PersonaAmbSouDeConsell = {
  nom: string;
  carrecMunicipal: string;
  alcaldia: boolean;
  /** El nom tal com l'escriu el consell, quan no és lletra per lletra el mateix. */
  nomAlConsell: string | null;
  consell: CarrecAlConsell;
};

/** Comprova que la pàgina del consell doni el ple sencer segons el cens. */
async function comprovaRecompte(ens: string, llegits: number, alCens: number, run: Run): Promise<void> {
  if (llegits === alCens) return;
  await run.issue({
    kind: "consell_recompte_diferent",
    severity: "mitjana",
    entity: ens,
    detail: {
      llegits,
      censGeneralitat: alCens,
      efecte: "la pàgina no dona el ple sencer: el que se'n desa pot ser incomplet",
    },
  });
}

export async function j30SousConsells(db: Db): Promise<void> {
  await withRun(db, "J30 sous dels consells comarcals", async (run) => {
    const perCodiEns = new Map<string, number>();
    for (const m of await db.select().from(municipalities)) perCodiEns.set(m.codiEns, m.id);
    // El codi d'ens de la província de Barcelona comença per zero i Socrata el
    // torna com a text: sense el padStart, 311 municipis quedarien orfes.
    const resol = (codi: unknown): number | undefined => perCodiEns.get(String(codi).padStart(10, "0"));

    const files = await socrataAll<FilaPle>(PLENS, { select: "codi_10,nom_ens,tipus_ens,nom,carrec" });
    run.rowsIn = files.length;
    const regidors = files.filter((f) => f.tipus_ens === "Municipis" && f.nom).map((f) => ({ ...f, nom: f.nom! }));
    // El cens de cada consell, que aquí serveix d'invariant de recompte i de
    // llista de quins consells existeixen: qui no hi surt no es busca.
    const censPerConsell = new Map<string, number>();
    for (const f of files) {
      if (f.tipus_ens !== "Comarques" || !f.nom) continue;
      censPerConsell.set(f.nom_ens, (censPerConsell.get(f.nom_ens) ?? 0) + 1);
    }
    run.say(`${regidors.length} regidors municipals per creuar · ${censPerConsell.size} consells comarcals al cens`);

    const consultat = avui();
    const metode = "camp «Retribució anual bruta» de la fitxa de cada càrrec electe del consell a seu-e";
    const perMunicipi = new Map<number, PersonaAmbSouDeConsell[]>();
    const consellsLlegits: { ens: string; consellers: number; ambRetribucioPublicada: number; font: FontConsell }[] = [];
    let lligats = 0;
    let perInicials = 0;
    let ambImportTotal = 0;
    let ambigusTotal = 0;

    for (const ens of [...censPerConsell.keys()].sort((a, b) => a.localeCompare(b, "ca"))) {
      const slug = SLUGS_CONSELLS[ens];
      if (!slug) {
        await run.issue({
          kind: "consell_sense_seue",
          severity: "mitjana",
          entity: ens,
          detail: {
            motiu: CONSELLS_SENSE_SEUE[ens] ?? "no en tenim cap slug de seu-e comprovat",
            efecte: "del que aquest consell paga als seus consellers no en podem dir res",
          },
        });
        continue;
      }

      const url = urlCarrecs(slug);
      const font: FontConsell = { nom: ens, url, format: "HTML", llicencia: LLICENCIA_SEUE, consultat };
      await sleep(PAUSA_MS);
      let html = "";
      try {
        const resposta = await fetchText(url);
        if (resposta.status !== 200 || !resposta.html) throw new Error(`HTTP ${resposta.status}`);
        html = resposta.html;
      } catch (error) {
        await run.issue({ kind: "consell_font_inaccessible", severity: "alta", entity: ens, detail: { url, error: String(error) } });
        continue;
      }
      // El títol diu de qui és la pàgina. Sense comprovar-ho, una redirecció o
      // una pantalla d'inici de sessió desaria els sous d'un altre lloc.
      const titol = titolMunicipi(html);
      if (!titol || normalize(titol) !== normalize(ens)) {
        await run.issue({ kind: "consell_pagina_inesperada", severity: "alta", entity: ens, detail: { url, titol } });
        continue;
      }

      const publicats = parseCarrecs(html);
      if (publicats.length === 0) {
        /*
         * Setze consells tenen el mòdul buit i el Vallès Occidental el serveix
         * en un format propi que aquest lector no entén (comprovat el
         * 31-08-2026). En tots els casos la resposta bona és la mateixa: cap
         * import atribuït i una incidència, no un lector a mida per a cada
         * variant que un dia canviarà sense avisar.
         */
        await run.issue({
          kind: "consell_modul_buit_o_illegible",
          severity: "mitjana",
          entity: ens,
          detail: { url, efecte: "el mòdul de càrrecs electes és buit o té un format propi: no se n'atribueix cap import" },
        });
        continue;
      }
      await comprovaRecompte(ens, publicats.length, censPerConsell.get(ens) ?? 0, run);

      const creuament = creuaAmbInicials(regidors, publicats);
      ambigusTotal += creuament.ambigus.length;
      for (const nom of creuament.ambigus) {
        await run.issue({
          kind: "conseller_nom_ambigu",
          severity: "mitjana",
          entity: `${ens} · ${nom}`,
          detail: { efecte: "el nom no identifica una sola persona: no se li atribueix cap sou del consell" },
        });
      }

      let ambImportDelConsell = 0;
      for (const { municipal, conseller, perInicials: ambInicial } of creuament.lligams) {
        const municipalityId = resol(municipal.codi_10);
        if (!municipalityId) continue;

        let lectura: LecturaFitxa;
        if (!conseller.fitxa) {
          lectura = {
            retribucioAnualBruta: null,
            dedicacio: null,
            maximPerAssistencies: null,
            motiu: `${ens} no obre cap fitxa per a aquesta persona a seu-e i al costat del nom no hi publica cap import`,
          };
        } else {
          await sleep(PAUSA_MS);
          try {
            const fitxa = await fetchText(senseTokenAuth(conseller.fitxa));
            if (fitxa.status !== 200 || !fitxa.html) throw new Error(`HTTP ${fitxa.status}`);
            lectura = llegeixFitxaConsell(ens, fitxa.html);
          } catch (error) {
            await run.issue({
              kind: "consell_fitxa_error",
              severity: "baixa",
              entity: `${ens} · ${conseller.nom}`,
              detail: { error: String(error) },
            });
            lectura = {
              retribucioAnualBruta: null,
              dedicacio: null,
              maximPerAssistencies: null,
              motiu: `la fitxa d'aquesta persona a la seu del consell no s'ha pogut llegir: no se li atribueix cap import`,
            };
          }
        }

        lligats += 1;
        if (ambInicial) perInicials += 1;
        if (lectura.retribucioAnualBruta !== null) {
          ambImportTotal += 1;
          ambImportDelConsell += 1;
        }
        const llista = perMunicipi.get(municipalityId) ?? [];
        llista.push({
          nom: titleCase(municipal.nom),
          carrecMunicipal: municipal.carrec ?? "Regidor",
          alcaldia: esAlcaldia(municipal.carrec ?? ""),
          // Quan el lligam és per inicial, el lector ha de poder comprovar-lo:
          // es publica el nom tal com l'escriu el consell.
          nomAlConsell:
            normalizePersonName(conseller.nom) === normalizePersonName(municipal.nom) ? null : conseller.nom,
          consell: {
            ens,
            tipus: "consell comarcal",
            carrec: conseller.carrec || "Conseller/a comarcal",
            dedicacio: lectura.dedicacio,
            retribucioAnualBruta: lectura.retribucioAnualBruta,
            maximPerAssistencies: lectura.maximPerAssistencies,
            motiu: lectura.motiu,
            font,
            metode,
          },
        });
        perMunicipi.set(municipalityId, llista);
      }

      consellsLlegits.push({ ens, consellers: publicats.length, ambRetribucioPublicada: ambImportDelConsell, font });
      run.say(`${ens}: ${publicats.length} consellers llegits, ${ambImportDelConsell} amb retribució anual publicada`);
    }

    const catalunya = {
      consellsLlegits,
      consellsSenseDades: [...censPerConsell.keys()]
        .filter((ens) => !consellsLlegits.some((c) => c.ens === ens))
        .sort((a, b) => a.localeCompare(b, "ca")),
      consellersQueTambeSonRegidors: lligats,
      ambImportPublicat: ambImportTotal,
      lligatsPerInicial: perInicials,
      nomsAmbigusDescartats: ambigusTotal,
      consultat,
    };

    for (const [municipalityId, llista] of perMunicipi) {
      llista.sort((a, b) => a.nom.localeCompare(b.nom, "ca"));
      await desa(db, municipalityId, "sousConsells", {
        persones: llista,
        alcaldia: llista.find((p) => p.alcaldia) ?? null,
        catalunya,
        advertiment:
          "Cada import és el que publica el consell comarcal que el paga, i només ell. Aquí no s'hi suma cap total: " +
          "el que cobra una persona de l'ajuntament i del consell alhora no ho ha publicat mai ningú. " +
          "El «màxim per assistències» és un sostre anual, no el que ha cobrat, i per això va en un camp a part.",
      });
      run.rowsOut += 1;
    }

    run.say(
      `${lligats} consellers comarcals que també són regidors (${perInicials} lligats per la inicial), ` +
        `${ambImportTotal} amb sou publicat pel seu consell`,
    );
    run.say(`${ambigusTotal} noms ambigus descartats · ${run.rowsOut} municipis amb algú al ple d'un consell`);
    return {
      municipis: run.rowsOut,
      lligats,
      perInicials,
      ambImportTotal,
      ambigus: ambigusTotal,
      consells: consellsLlegits.map((c) => `${c.ens}: ${c.ambRetribucioPublicada}/${c.consellers}`),
    };
  });
}

async function desa(db: Db, municipalityId: number, kind: string, data: unknown): Promise<void> {
  await db
    .insert(municipalityMetrics)
    .values({ municipalityId, kind, data })
    .onConflictDoUpdate({
      target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
      set: { data, computedAt: new Date() },
    });
}
