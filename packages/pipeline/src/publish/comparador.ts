import { eq, inArray } from "drizzle-orm";
import { electionParticipation, municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { buildPeerGroups, percentileOf } from "../derive/peers";
import { RADIOGRAFIA_CSS } from "./estil";

/**
 * El comparador: de dos a quatre municipis, un al costat de l'altre.
 *
 * És la pregunta que la gent es fa sola quan llegeix la fitxa del seu poble —«i
 * al del costat, com ho tenen?»— i la que un regidor de l'oposició farà servir
 * el 23-M. Per això la pàgina no és un explorador de dades: són onze files
 * triades, cadascuna amb la seva font i amb el seu sentit escrit a sobre.
 *
 * Tot passa al navegador amb el conjunt incrustat, com a «Els 947»: sense
 * servidor, sense peticions i sense que ningú sàpiga quins municipis compares.
 *
 * Dues decisions que expliquen la meitat del fitxer:
 *
 * 1. **La direcció de cada indicador va escrita, no deduïda.** Menys deute és
 *    millor i menys participació és pitjor: el signe no ho diu. Cada indicador
 *    porta `sentit`, i n'hi ha que no en tenen cap («qui governa», la població)
 *    o que no tenen un «millor» defensable (el tipus de l'IBI: pagar menys no
 *    és objectivament millor, depèn de què vulguis que faci l'ajuntament).
 * 2. **Cada xifra porta el seu percentil dins del grup de comparació.** Que un
 *    municipi tingui menys deute que un altre no vol dir gaire si són de mides
 *    diferents; el percentil diu on és cadascun dins de la seva pròpia lliga,
 *    que és la comparació que sí que és justa.
 */

// ------------------------------------------------------------- els indicadors

type Sentit =
  /** com més alt, millor */
  | "amunt"
  /** com més baix, millor */
  | "avall"
  /** millor com més a prop de l'objectiu */
  | "objectiu"
  /** no hi ha un «millor», però els extrems es marquen sense jutjar-los */
  | "neutre"
  /** no es marca res */
  | "cap";

type Indicador = {
  clau: string;
  etiqueta: string;
  seccio: string;
  mena: "xifra" | "text";
  format: "nombre" | "euros" | "percent" | "tipus" | "dies";
  sentit: Sentit;
  objectiu?: number;
  /** si es calcula el percentil dins del grup de comparació */
  percentil: boolean;
  nota: string;
  /** identificador del conjunt de dades, perquè cada fila pugui dir d'on surt */
  font: string;
};

const SECCIONS = ["El poble", "Qui mana", "Els comptes", "Com es governa"] as const;

/**
 * L'ordre d'aquesta llista és l'ordre de la taula, i les claus són les mateixes
 * que fa servir `ComparadorRow`. Afegir-hi una fila vol dir afegir-la aquí i
 * omplir-la a `loadComparador`: la pàgina no s'ha de tocar.
 */
const INDICADORS: readonly Indicador[] = [
  {
    clau: "poblacio", etiqueta: "Habitants", seccio: "El poble", mena: "xifra", format: "nombre",
    sentit: "cap", percentil: false, font: "6nei-4b44",
    nota: "Padró municipal de l'últim any publicat.",
  },
  {
    clau: "regidories", etiqueta: "Regidories al ple", seccio: "El poble", mena: "xifra", format: "nombre",
    sentit: "cap", percentil: false, font: "LOREG art. 179",
    nota: "Les fixa la llei segons la població: no és una decisió de l'ajuntament.",
  },
  {
    clau: "govern", etiqueta: "Qui governa", seccio: "Qui mana", mena: "text", format: "nombre",
    sentit: "cap", percentil: false, font: "6nei-4b44 · ntc4-rnwr",
    nota: "L'alcaldia actual i la seva candidatura, aparellada amb els resultats del 2023.",
  },
  {
    clau: "majoria", etiqueta: "Majoria absoluta", seccio: "Qui mana", mena: "text", format: "nombre",
    sentit: "cap", percentil: false, font: "ntc4-rnwr",
    nota: "Si la llista que té l'alcaldia arriba sola a la meitat més un del ple.",
  },
  {
    clau: "participacio", etiqueta: "Participació el 2023", seccio: "Qui mana", mena: "xifra", format: "percent",
    sentit: "amunt", percentil: true, font: "irrv-2mfc",
    nota: "Votants sobre el cens a les municipals del 28 de maig del 2023.",
  },
  {
    clau: "deute", etiqueta: "Deute per habitant", seccio: "Els comptes", mena: "xifra", format: "euros",
    sentit: "avall", percentil: true, font: "34db8dc5",
    nota: "Deute viu a 31 de desembre dividit pel padró.",
  },
  {
    clau: "estalvi", etiqueta: "Estalvi net", seccio: "Els comptes", mena: "xifra", format: "percent",
    sentit: "amunt", percentil: true, font: "81f18313",
    nota: "El que sobra dels ingressos corrents un cop pagat el dia a dia i el deute que toca tornar. Negatiu obliga a fer un pla de sanejament.",
  },
  {
    clau: "pmp", etiqueta: "Dies per pagar els proveïdors", seccio: "Els comptes", mena: "xifra", format: "dies",
    sentit: "avall", percentil: true, font: "eecca986",
    nota: "Període mitjà de pagament. Per sobre de 30 dies és un incompliment; per sobre de 60, greu.",
  },
  {
    // Sense sentit: pagar menys IBI no és objectivament millor —depèn de què
    // esperis de l'ajuntament—, així que es marquen els extrems i prou.
    clau: "ibi", etiqueta: "Tipus de l'IBI urbà", seccio: "Els comptes", mena: "xifra", format: "tipus",
    sentit: "neutre", percentil: true, font: "82ae0ea2",
    nota: "Tipus de gravamen dels béns immobles urbans. El rebut també depèn del valor cadastral i de l'any de la revisió, que no són comparables entre municipis.",
  },
  {
    clau: "selectiva", etiqueta: "Recollida selectiva", seccio: "Com es governa", mena: "xifra", format: "percent",
    sentit: "amunt", percentil: true, font: "69zu-w48s",
    nota: "Part dels residus municipals recollits selectivament. És dels pocs resultats directes d'una decisió de govern que es pot seguir any a any.",
  },
  {
    // La paritat no és «com més dones, millor» sinó com més a prop del 50 %:
    // marcar com a millor un ple de 80 % de dones seria tan fals com al revés.
    clau: "dones", etiqueta: "Dones al ple", seccio: "Com es governa", mena: "xifra", format: "percent",
    sentit: "objectiu", objectiu: 50, percentil: true, font: "xnfg-weec",
    nota: "Percentatge de dones entre les persones electes el 2023.",
  },
  {
    clau: "transparencia", etiqueta: "Portal de transparència", seccio: "Com es governa", mena: "xifra", format: "percent",
    sentit: "amunt", percentil: true, font: "1a9c1ede",
    nota: "Apartats publicats dels que li tocarien, segons l'emplenament del portal de transparència que mesura el Consorci AOC.",
  },
];

// -------------------------------------------------------- les dues funcions
// que també s'executen al navegador
//
// S'incrusten a la pàgina amb `toString()` en comptes de reescriure-les dins
// del `<script>`: així la regla que decideix qui és el millor és literalment la
// mateixa que passa pels tests, i no hi pot haver dues versions que divergeixin.
// Per això no poden fer servir res de fora seu ni sintaxi que TypeScript
// esborri: han de ser JavaScript vàlid tal com estan escrites.

/**
 * La mateixa normalització que «Els 947»: sense accents, sense apòstrofs i
 * sense l'article davant, perquè «hospitalet» trobi «l'Hospitalet de Llobregat»
 * i «seu» trobi «la Seu d'Urgell».
 */
export function normalitza(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['\u2019]/g, " ")
    .replace(/^(l|el|la|els|les|es|sa)\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Qui es marca com a millor i qui com a pitjor en una fila.
 *
 * Torna una etiqueta per posició: `"millor"`, `"pitjor"`, `"alt"`, `"baix"` o
 * `""`. Les regles, totes deliberades:
 *
 * - amb menys de dos valors no hi ha comparació i no es marca res;
 * - si tots els valors empaten, tampoc: marcar-los tots de «millor» no diu res;
 * - els empats a dalt o a baix es marquen tots, no només el primer;
 * - `neutre` marca els extrems sense dir que cap sigui millor.
 */
export function marquesDe(
  sentit: Sentit,
  objectiu: number | undefined,
  valors: readonly (number | null)[],
): string[] {
  // Tot en un sol bucle i sense funcions auxiliars a dins: aquesta funció
  // s'incrusta a la pàgina amb `toString()` i qualsevol tancament intern hi
  // arribaria embolicat amb els ajudants del transpilador, que al navegador no
  // existeixen. El test l'avalua aïllada justament per no tornar-hi a caure.
  const marques: string[] = [];
  const posicions: number[] = [];
  const rangs: number[] = [];
  for (let i = 0; i < valors.length; i += 1) {
    marques.push("");
    const valor = valors[i];
    if (typeof valor !== "number") continue;
    posicions.push(i);
    // Tot es converteix a «com més petit, millor» per no repetir la comparació
    // quatre vegades. Al cas neutre el rang és el valor mateix i les etiquetes
    // no diuen «millor», sinó «el més alt» i «el més baix».
    rangs.push(
      sentit === "amunt" ? -valor : sentit === "objectiu" ? Math.abs(valor - (objectiu ?? 0)) : valor,
    );
  }
  if (sentit === "cap" || posicions.length < 2) return marques;

  const millor = Math.min.apply(null, rangs);
  const pitjor = Math.max.apply(null, rangs);
  if (millor === pitjor) return marques;

  for (let n = 0; n < posicions.length; n += 1) {
    const i = posicions[n] as number;
    if (rangs[n] === millor) marques[i] = sentit === "neutre" ? "baix" : "millor";
    else if (rangs[n] === pitjor) marques[i] = sentit === "neutre" ? "alt" : "pitjor";
  }
  return marques;
}

// -------------------------------------------------------------------- càrrega

export type ComparadorRow = {
  slug: string;
  nom: string;
  comarca: string;
  /** grup de comparació de la LOREG: amb qui és just comparar aquest municipi */
  grup: string;
  /** valors dels indicadors numèrics, per clau */
  valors: Record<string, number | null>;
  /** percentil de cada valor dins del seu grup de comparació */
  percentils: Record<string, number | null>;
  /** cel·les de text, per clau */
  textos: Record<string, { principal: string; secundari: string }>;
};

type GovernmentMetric = {
  mayorName: string | null; mayorSigles: string | null; mayorSeats: number | null;
  winnerSigles: string; winnerSeats: number; totalSeats: number;
  majority: number; winnerHasMajority: boolean; winnerGoverns: boolean | null;
};
type FinancesMetric = { indicators: { key: string; value: number | null }[] };
type TaxesMetric = { taxes: Record<string, { value: number }> };
type ParityMetric = { womenElectedPct: number | null };
type TransparencyMetric = { pct: number | null };

/**
 * Els `kind` que necessita la taula. Es demanen per nom i no es carrega tot
 * `municipality_metrics`: són 13.000 files de JSON i la pàgina només en fa
 * servir sis.
 */
const KINDS = ["government", "finances", "taxes", "parity", "transparency", "residus"] as const;

/**
 * La recollida selectiva encara no està ingerida (és la feina J9 del pla). La
 * lectura és tolerant a propòsit: el dia que hi sigui, la fila apareix sola
 * sense tornar a tocar aquest fitxer, i mentrestant no surt una columna de
 * guions que faci pensar que ho hem mirat i no hi ha res.
 */
function recollidaSelectiva(data: unknown): number | null {
  if (!data || typeof data !== "object") return null;
  // La clau és `taxaSelectiva`, la que desa J9. Abans es provaven quatre noms
  // possibles i cap no era el bo: la fila desapareixia sola i el codi callava,
  // que és la manera més fàcil de publicar un forat sense adonar-se'n.
  const valor = (data as { taxaSelectiva?: unknown }).taxaSelectiva;
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

export async function loadComparador(db: Db): Promise<ComparadorRow[]> {
  const all = await db
    .select({
      id: municipalities.id,
      slug: municipalities.slug,
      name: municipalities.name,
      comarca: municipalities.comarca,
      population: municipalities.population,
      councilSeats: municipalities.councilSeats,
      mayorName: municipalities.mayorName,
      mayorPartyRaw: municipalities.mayorPartyRaw,
    })
    .from(municipalities);

  const metrics = await db
    .select()
    .from(municipalityMetrics)
    .where(inArray(municipalityMetrics.kind, [...KINDS]));

  const turnout = await db
    .select()
    .from(electionParticipation)
    .where(eq(electionParticipation.electionId, "M20231"));

  const byMunicipality = new Map<number, Map<string, unknown>>();
  for (const metric of metrics) {
    let map = byMunicipality.get(metric.municipalityId);
    if (!map) byMunicipality.set(metric.municipalityId, (map = new Map()));
    map.set(metric.kind, metric.data);
  }
  const turnoutBy = new Map(turnout.map((row) => [row.municipalityId, row]));
  const groups = buildPeerGroups(all);

  const rows = all.map((m): ComparadorRow & { id: number } => {
    const own = byMunicipality.get(m.id);
    const government = own?.get("government") as GovernmentMetric | undefined;
    const finances = own?.get("finances") as FinancesMetric | undefined;
    const taxes = own?.get("taxes") as TaxesMetric | undefined;
    const parity = own?.get("parity") as ParityMetric | undefined;
    const transparency = own?.get("transparency") as TransparencyMetric | undefined;
    const indicator = (key: string): number | null =>
      finances?.indicators.find((i) => i.key === key)?.value ?? null;

    const census = turnoutBy.get(m.id);
    const participacio =
      census?.censusSize && census.voters
        ? Math.round((1000 * census.voters) / census.censusSize) / 10
        : null;

    const seats = government?.totalSeats ?? m.councilSeats ?? null;
    // Qui té l'alcaldia és qui compta per a la majoria, no qui va guanyar: en
    // 180 municipis no són el mateix i és justament el que es vol veure.
    const governSeats = government?.mayorSeats ?? null;
    const majority = government?.majority ?? null;
    const teMajoria =
      governSeats !== null && majority !== null ? governSeats >= majority : government?.winnerHasMajority ?? null;

    const sigles = government?.mayorSigles ?? m.mayorPartyRaw ?? null;

    return {
      id: m.id,
      slug: m.slug,
      nom: m.name,
      comarca: m.comarca ?? "",
      grup: groups.get(m.id)?.label ?? "sense grup",
      valors: {
        poblacio: m.population ?? null,
        regidories: seats,
        participacio,
        deute: indicator("deute-habitant"),
        estalvi: indicator("estalvi-net"),
        pmp: indicator("pmp"),
        ibi: taxes?.taxes?.ibi?.value ?? null,
        selectiva: recollidaSelectiva(own?.get("residus")),
        dones: parity?.womenElectedPct ?? null,
        transparencia: transparency?.pct ?? null,
      },
      percentils: {},
      textos: {
        govern: {
          principal: sigles ?? "No consta",
          secundari: [
            government?.mayorName ?? m.mayorName ?? "",
            government?.winnerGoverns === false
              ? `no va ser la llista més votada; la més votada va ser ${government.winnerSigles}`
              : government?.winnerGoverns === true
                ? "va ser la llista més votada"
                : "",
          ]
            .filter(Boolean)
            .join(" · "),
        },
        majoria: {
          principal: teMajoria === null ? "No consta" : teMajoria ? "Sí" : "No",
          secundari:
            governSeats !== null && seats !== null && majority !== null
              ? teMajoria
                ? `${governSeats} de ${seats} ${seats === 1 ? "regidoria" : "regidories"}`
                : `${governSeats} de ${seats}; en calen ${majority}`
              : seats !== null
                ? `${seats} ${seats === 1 ? "regidoria" : "regidories"} al ple`
                : "",
        },
      },
    };
  });

  // Percentils dins del grup de comparació, no de tot Catalunya: comparar un
  // poble de 300 habitants amb la mediana catalana és comparar-lo amb Barcelona.
  const perGroup = new Map<string, ComparadorRow[]>();
  for (const row of rows) {
    const key = groups.get(row.id)?.key ?? "sense-grup";
    const list = perGroup.get(key);
    if (list) list.push(row);
    else perGroup.set(key, [row]);
  }
  for (const members of perGroup.values()) {
    for (const indicador of INDICADORS) {
      if (!indicador.percentil) continue;
      const valors = members
        .map((r) => r.valors[indicador.clau])
        .filter((v): v is number => typeof v === "number");
      for (const member of members) {
        const valor = member.valors[indicador.clau];
        member.percentils[indicador.clau] = typeof valor === "number" ? percentileOf(valor, valors) : null;
      }
    }
  }

  return rows
    .map(({ id: _id, ...row }) => row)
    .sort((a, b) => (b.valors.poblacio ?? 0) - (a.valors.poblacio ?? 0));
}

// ---------------------------------------------------------------- la pàgina

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** JSON que es pot posar dins d'un `<script>` sense que el tanqui cap cadena. */
const jsonSegur = (value: unknown): string =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

/**
 * El codi d'una funció, tal com anirà a dins del `<script>`.
 *
 * El transpilador embolica les funcions internes amb ajudants seus —`__name`,
 * per conservar-ne el nom—, que existeixen al mòdul però no al navegador: la
 * pàgina es generaria sencera i petaria en obrir-la. Val més no publicar-la.
 */
export function codiPerAlNavegador(fn: { toString(): string }): string {
  const codi = fn.toString();
  const ajudant = codi.match(/\b__[A-Za-z0-9_$]+\s*\(/);
  if (ajudant) {
    throw new Error(
      `El transpilador ha ficat «${ajudant[0]}» dins d'una funció que s'incrusta a la pàgina. ` +
        "Treu-ne les funcions internes: al navegador aquest ajudant no hi és.",
    );
  }
  return codi;
}

/** Com es llegeix la marca de cada fila, escrit a la capçalera de la fila. */
function textDelSentit(indicador: Indicador): string {
  if (indicador.sentit === "amunt") return "com més alt, millor";
  if (indicador.sentit === "avall") return "com més baix, millor";
  if (indicador.sentit === "objectiu") return `com més a prop del ${indicador.objectiu} %, millor`;
  if (indicador.sentit === "neutre") return "no hi ha un «millor»: es marquen els extrems";
  return "no es compara";
}

/**
 * Comparacions per començar. Són suggeriments de municipis del mateix tram de
 * població: si la primera cosa que veu algú fos Barcelona contra un poble de
 * 300 habitants, la pàgina ja hauria ensenyat malament què és comparar.
 */
const SUGGERIMENTS: readonly { titol: string; slugs: readonly string[] }[] = [
  { titol: "Dos veïns del Baix Llobregat", slugs: ["esplugues-de-llobregat", "sant-just-desvern"] },
  { titol: "Tres capitals de província", slugs: ["girona", "lleida", "tarragona"] },
  { titol: "Dues ciutats gironines de mida semblant", slugs: ["olot", "salt"] },
];

const CSS = `
.entradeta{font-size:1.1rem;color:var(--ink-suau);max-width:52ch;margin:var(--e2) 0 var(--e4)}

/* --- el cercador i els municipis triats --- */
.tria{margin-bottom:var(--e3)}
.camp{position:relative;max-width:34rem}
#cerca{width:100%;font:inherit;font-size:1.05rem;padding:13px 15px;border:2.5px solid var(--ink);
  border-radius:var(--r-m);background:var(--paper-2);color:var(--ink);box-shadow:var(--ombra)}
#cerca[disabled]{opacity:.55;box-shadow:none}
.resultats{list-style:none;margin:6px 0 0;padding:0;position:absolute;z-index:9;left:0;right:0;
  background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);box-shadow:var(--ombra);
  max-height:19rem;overflow-y:auto}
.resultats:empty,.resultats[hidden]{display:none}
.resultats li{padding:9px 14px;cursor:pointer;display:flex;justify-content:space-between;gap:var(--e2);align-items:baseline}
.resultats li+li{border-top:1px solid var(--vora)}
.resultats li[aria-selected="true"]{background:var(--lavanda);color:#1E1B2E}
.resultats b{font-family:var(--display);font-weight:900;letter-spacing:-.02em}
.resultats span{font-size:.8rem;opacity:.75;white-space:nowrap}

.triats{list-style:none;margin:var(--e2) 0 0;padding:0;display:flex;flex-wrap:wrap;gap:var(--e1)}
.triats li{display:flex;align-items:center;gap:9px;background:var(--menta);color:#1E1B2E;
  border:2.5px solid #1E1B2E;border-radius:var(--r-max);padding:5px 6px 5px 15px;font-weight:800}
.triats .treu{font:inherit;font-weight:900;line-height:1;cursor:pointer;background:#1E1B2E;color:#FBF7EE;
  border:0;border-radius:var(--r-max);width:26px;height:26px}
.eines{display:flex;flex-wrap:wrap;gap:var(--e2);align-items:center;margin-top:var(--e2)}
.neteja{font:inherit;font-size:.84rem;font-weight:800;background:transparent;color:inherit;cursor:pointer;
  border:2px solid var(--ink);border-radius:var(--r-max);padding:6px 13px}
.compte{font-size:.84rem;color:var(--ink-suau)}

/* --- estat buit: ha de servir per començar, no per disculpar-se --- */
.buit{background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);box-shadow:var(--ombra);
  padding:var(--e3);margin:var(--e3) 0}
.buit h2{font-size:1.4rem}
.buit p{max-width:52ch}
.suggeriments{list-style:none;margin:var(--e2) 0 0;padding:0;display:grid;gap:var(--e1)}
.suggeriments button{font:inherit;text-align:left;width:100%;background:transparent;color:inherit;cursor:pointer;
  border:2px solid var(--ink);border-radius:var(--r-m);padding:11px 15px}
.suggeriments button:hover{background:var(--ink);color:var(--paper)}
.suggeriments b{font-family:var(--display);font-weight:900;letter-spacing:-.02em;display:block}
.suggeriments span{font-size:.86rem;opacity:.8}

/* --- avís de mides diferents --- */
.desigual{background:var(--presec);color:#1E1B2E;border:2.5px solid #1E1B2E;border-radius:var(--r-m);
  padding:var(--e2);margin:var(--e3) 0;font-size:.94rem}
.desigual[hidden]{display:none}

/* --- la taula ---------------------------------------------------------
   Amb quatre municipis no hi caben quatre columnes en un telèfon, així que la
   taula es desplaça de costat i la columna dels indicadors es queda enganxada:
   sense el nom de la fila a la vista, una xifra sola no vol dir res. */
.marc{overflow-x:auto;border:2.5px solid var(--ink);border-radius:var(--r-m);background:var(--paper-2)}
.marc[hidden]{display:none}
.comparativa{border-collapse:separate;border-spacing:0;width:max-content;min-width:100%;font-size:.95rem}
.comparativa th,.comparativa td{text-align:left;vertical-align:top;padding:13px 15px;border-bottom:1px solid var(--vora)}
/* La taula es dimensiona pel contingut; sense un sostre, una frase llarga
   —el nom de l'alcaldia amb el «no va ser la llista més votada»— faria una
   columna de mig metre i obligaria a desplaçar-se per res. */
.comparativa td,.comparativa thead th:not(.cantonada){min-width:11.5rem;max-width:14rem}
.comparativa tbody th{position:sticky;left:0;z-index:2;background:var(--paper-2);border-right:2.5px solid var(--ink);
  min-width:12rem;max-width:12rem;font-weight:800}
.comparativa thead th{position:sticky;top:0;z-index:3;background:var(--paper-2);border-bottom:2.5px solid var(--ink)}
.comparativa thead th.cantonada{left:0;z-index:4;border-right:2.5px solid var(--ink)}
.comparativa .municipi{font-family:var(--display);font-weight:900;font-size:1.15rem;letter-spacing:-.02em;display:block}
.comparativa .municipi a{text-decoration:none;border-bottom:2.5px solid var(--coral)}
.comparativa .lloc{font-size:.78rem;color:var(--ink-suau);display:block;margin-top:2px}
.comparativa .grup{font-size:.72rem;color:var(--ink-suau);display:block;margin-top:4px}
.comparativa tr.seccio th{background:var(--ink);color:var(--paper);font-family:var(--display);font-weight:900;
  font-size:.8rem;text-transform:uppercase;letter-spacing:.12em;position:static;max-width:none;border-right:0}
.comparativa tr.seccio th span{position:sticky;left:15px;display:inline-block}
.comparativa .etq{display:block}
.comparativa .sentit{display:block;font-weight:400;font-size:.74rem;color:var(--ink-suau);margin-top:3px}
.comparativa .valor{font-family:var(--display);font-weight:900;font-size:1.25rem;letter-spacing:-.02em;
  font-variant-numeric:tabular-nums;display:block}
.comparativa .valor.sense{font-size:1rem;color:var(--ink-suau);font-family:var(--text);font-weight:700}
.comparativa .sec{display:block;font-size:.8rem;color:var(--ink-suau);margin-top:2px}
.comparativa .percentil{display:block;font-size:.74rem;color:var(--ink-suau);margin-top:4px}
.marca{display:inline-block;margin-top:6px;border:2px solid #1E1B2E;border-radius:var(--r-max);
  padding:2px 10px;font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#1E1B2E}
.marca.millor{background:var(--menta)}
.marca.pitjor{background:var(--coral)}
.marca.alt,.marca.baix{background:transparent;border-style:dashed;color:var(--ink-suau);border-color:var(--ink-suau)}
.comparativa td.millor{background:rgba(191,232,210,.34)}
.comparativa td.pitjor{background:rgba(226,115,90,.16)}
.pista{font-size:.82rem;color:var(--ink-suau);margin:var(--e1) 0 0}
.llegenda-taula{font-size:.86rem;color:var(--ink-suau);margin:var(--e3) 0 0;max-width:60ch}
.fonts-fila{width:100%;border-collapse:collapse;font-size:.86rem;margin-top:var(--e2)}
.fonts-fila th,.fonts-fila td{text-align:left;padding:7px 10px 7px 0;border-bottom:1px solid var(--vora);vertical-align:top}
.fonts-fila code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.9em;background:var(--paper-2);
  border:1px solid var(--vora);border-radius:5px;padding:1px 5px;white-space:nowrap}
@media (max-width:620px){
  .comparativa tbody th{min-width:10rem;max-width:10rem;padding:11px}
  .comparativa td,.comparativa thead th:not(.cantonada){min-width:11rem;max-width:12rem;padding:11px}
}
`;

export function renderComparador(rows: readonly ComparadorRow[], generatedAt: string): string {
  const perSlug = new Map(rows.map((r) => [r.slug, r]));

  // La recollida selectiva només és una fila el dia que hi hagi la dada: una
  // columna de guions no informa de res i fa la taula més llarga.
  const indicadors = INDICADORS.filter(
    (i) => i.clau !== "selectiva" || rows.some((r) => r.valors.selectiva !== null),
  );

  // Comarques i grups s'internen: són 43 i una dotzena, repetits 947 vegades.
  const comarques: string[] = [];
  const grups: string[] = [];
  const indexDe = (taula: string[], valor: string): number => {
    const i = taula.indexOf(valor);
    if (i !== -1) return i;
    taula.push(valor);
    return taula.length - 1;
  };
  const xifres = indicadors.filter((i) => i.mena === "xifra");
  const textos = indicadors.filter((i) => i.mena === "text");

  const dades = rows.map((r) => ({
    s: r.slug,
    n: r.nom,
    c: indexDe(comarques, r.comarca),
    g: indexDe(grups, r.grup),
    v: xifres.map((i) => r.valors[i.clau] ?? null),
    p: xifres.map((i) => r.percentils[i.clau] ?? null),
    t: textos.map((i) => [r.textos[i.clau]?.principal ?? "", r.textos[i.clau]?.secundari ?? ""]),
  }));

  // Els suggeriments es comproven contra el conjunt: si un slug canvia, el
  // suggeriment desapareix en comptes de portar a una comparació buida.
  const suggeriments = SUGGERIMENTS.map((s) => ({
    titol: s.titol,
    slugs: s.slugs.filter((slug) => perSlug.has(slug)),
  }))
    .filter((s) => s.slugs.length >= 2)
    .map((s) => ({ ...s, noms: s.slugs.map((slug) => perSlug.get(slug)!.nom) }));

  const fonts = indicadors
    .map(
      (i) => `<tr><th scope="row">${escape(i.etiqueta)}</th>
      <td>${escape(i.nota)}</td><td><code>${escape(i.font)}</code></td></tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Comparador de municipis · Observatori de quivoto</title>
<meta name="description" content="Tria de dos a quatre municipis catalans i mira'ls costat a costat: qui governa, participació, deute, estalvi, IBI, paritat i transparència. Només amb dades obertes.">
<style>${RADIOGRAFIA_CSS}${CSS}</style>
</head>
<body>
<a class="salta" href="#comparacio">Ves a la comparació</a>

<header class="capcalera">
  <a class="logo" href="../">Observatori</a>
  <span class="etiqueta">esborrany · dades obertes</span>
</header>

<main>
<section class="portada">
  <p class="micro">Comparador</p>
  <h1>El teu poble, al costat</h1>
  <p class="entradeta">Tria de dos a quatre municipis i mira'ls a la mateixa taula.
  Cada fila diu si «més» vol dir millor o pitjor, i cada xifra porta el seu lloc dins del
  grup de municipis de la mateixa mida, que és l'única comparació que és justa.</p>
</section>

<section class="tria">
  <div class="camp">
    <label class="nomes-lectors" for="cerca">Afegeix un municipi</label>
    <input id="cerca" type="text" role="combobox" aria-expanded="false" aria-controls="resultats"
      aria-autocomplete="list" autocomplete="off" spellcheck="false"
      placeholder="Escriu un poble: esplugues, la seu, hospitalet…">
    <ul class="resultats" id="resultats" role="listbox" aria-label="Municipis que coincideixen" hidden></ul>
  </div>
  <ul class="triats" id="triats" aria-label="Municipis que compares"></ul>
  <div class="eines">
    <button class="neteja" id="neteja" type="button" hidden>Buida la comparació</button>
    <span class="compte" id="compte"></span>
  </div>
  <p class="nomes-lectors" id="avis" role="status" aria-live="polite"></p>
</section>

<div class="desigual" id="desigual" hidden></div>

<section id="comparacio">
  <div class="buit" id="buit">
    <h2>Encara no hi ha res a comparar</h2>
    <p>Afegeix-hi dos municipis com a mínim —i quatre com a màxim— amb el cercador de dalt.
    L'adreça d'aquesta pàgina es va actualitzant sola, així que la comparació que muntis es
    pot enviar tal qual.</p>
    <ul class="suggeriments">
      ${suggeriments
        .map(
          (s) => `<li><button type="button" data-m="${escape(s.slugs.join(","))}">
        <b>${escape(s.titol)}</b><span>${escape(s.noms.join(" · "))}</span></button></li>`,
        )
        .join("\n      ")}
    </ul>
  </div>

  <div class="marc" id="marc" role="region" aria-label="Taula de comparació, es pot desplaçar de costat" tabindex="0" hidden>
    <table class="comparativa" id="taula">
      <caption class="nomes-lectors">Indicadors dels municipis triats, un per columna</caption>
      <thead id="capcalera-taula"></thead>
      <tbody id="cos-taula"></tbody>
    </table>
  </div>
  <p class="pista" id="pista" hidden>Amb tres o quatre municipis la taula es desplaça de costat;
  la columna dels indicadors es queda fixa.</p>

  <p class="llegenda-taula" id="llegenda" hidden><b>Millor</b> i <b>pitjor</b> es marquen només dins dels municipis que
  has triat, i només a les files on hi ha un sentit clar: menys deute és millor, menys participació
  no ho és. A les que no en tenen —quants habitants, quantes regidories, qui governa— no es marca res,
  i al tipus de l'IBI només s'assenyalen l'extrem alt i el baix, sense dir que cap sigui millor.
  El <b>percentil</b> diu on queda cada xifra entre els municipis de la seva mida: p10 vol dir que
  només un 10 % del seu grup té un valor més baix.</p>
</section>

<section class="bloc fonts">
  <h2>Què hi ha a cada fila i d'on surt</h2>
  <table class="fonts-fila">
    <thead><tr><th scope="col">Fila</th><th scope="col">Què vol dir</th><th scope="col">Conjunt</th></tr></thead>
    <tbody>${fonts}</tbody>
  </table>
  <p class="nota">Els conjunts amb identificador de vuit caràcters són del Consorci AOC; els altres,
  del portal de dades obertes de la Generalitat. Els percentils i els grups de comparació són
  càlculs nostres i es poden repetir amb el codi del projecte.</p>
</section>
</main>

<footer class="peu">
  <p>quivoto · pàgina generada el ${escape(generatedAt)} · esborrany intern, no indexat</p>
</footer>

<script>
const DADES = ${jsonSegur(dades)};
const COMARQUES = ${jsonSegur(comarques)};
const GRUPS = ${jsonSegur(grups)};
const XIFRES = ${jsonSegur(xifres.map((i) => ({ clau: i.clau, etiqueta: i.etiqueta, seccio: i.seccio, format: i.format, sentit: i.sentit, objectiu: i.objectiu ?? null, percentil: i.percentil, com: textDelSentit(i) })))};
const TEXTOS = ${jsonSegur(textos.map((i) => ({ clau: i.clau, etiqueta: i.etiqueta, seccio: i.seccio, com: textDelSentit(i) })))};
const SECCIONS = ${jsonSegur(SECCIONS)};
const MAXIM = 4;

const normalitza = ${codiPerAlNavegador(normalitza)};
const marquesDe = ${codiPerAlNavegador(marquesDe)};

for (const row of DADES) row.k = normalitza(row.n) + " " + normalitza(COMARQUES[row.c]);
const PER_SLUG = new Map(DADES.map((row) => [row.s, row]));

const cerca = document.getElementById("cerca");
const resultats = document.getElementById("resultats");
const triatsUl = document.getElementById("triats");
const neteja = document.getElementById("neteja");
const compte = document.getElementById("compte");
const avis = document.getElementById("avis");
const buit = document.getElementById("buit");
const marc = document.getElementById("marc");
const pista = document.getElementById("pista");
const llegenda = document.getElementById("llegenda");
const desigual = document.getElementById("desigual");
const capcalera = document.getElementById("capcalera-taula");
const cos = document.getElementById("cos-taula");

let triats = [];
let candidats = [];
let actiu = -1;

const esc = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const milers = (n) => n.toLocaleString("ca-ES");

function formata(def, valor){
  if (valor === null || valor === undefined) return null;
  if (def.format === "euros") return milers(Math.round(valor)) + " €";
  if (def.format === "dies") return milers(Math.round(valor)) + " dies";
  if (def.format === "percent") return valor.toLocaleString("ca-ES", { maximumFractionDigits: 1 }) + " %";
  if (def.format === "tipus") return valor.toLocaleString("ca-ES", { minimumFractionDigits: 2, maximumFractionDigits: 3 }) + " %";
  return milers(valor);
}

const NOM_MARCA = { millor: "millor", pitjor: "pitjor", alt: "el més alt", baix: "el més baix" };
// La població surt a la llista de resultats i a l'avís de mides; es busca per
// clau i no per posició perquè reordenar els indicadors no la faci ballar.
const POBLACIO = XIFRES.findIndex((def) => def.clau === "poblacio");

// ------------------------------------------------------------- adreça i estat

function llegeixAdreca(){
  const parametre = new URLSearchParams(location.search).get("m") || "";
  const vistos = new Set();
  const out = [];
  for (const brut of parametre.split(",")) {
    const slug = brut.trim();
    if (!slug || vistos.has(slug) || !PER_SLUG.has(slug) || out.length >= MAXIM) continue;
    vistos.add(slug);
    out.push(slug);
  }
  return out;
}

// L'adreça s'actualitza sense afegir entrades a l'historial: enrere ha de sortir
// d'aquí, no desfer municipi a municipi.
function desaAdreca(){
  const query = triats.length > 0 ? "?m=" + triats.join(",") : "";
  // Amb el fitxer obert des del disc (file://) hi ha navegadors que no deixen
  // tocar l'adreça; que no funcioni l'enllaç no ha de trencar la taula.
  try { history.replaceState(null, "", location.pathname + query); } catch (error) { /* res a fer */ }
}

function afegeix(slug){
  if (triats.length >= MAXIM || triats.includes(slug) || !PER_SLUG.has(slug)) return;
  triats.push(slug);
  canvia();
}

function treu(slug){
  triats = triats.filter((s) => s !== slug);
  canvia();
}

function canvia(){
  desaAdreca();
  pinta();
  const noms = triats.map((s) => PER_SLUG.get(s).n);
  avis.textContent = triats.length === 0
    ? "No hi ha cap municipi triat."
    : triats.length === 1
      ? "Només hi ha " + noms[0] + ". En cal un altre per comparar."
      : "Compares " + noms.join(", ") + ".";
}

// ------------------------------------------------------------------ cercador

function pintaResultats(){
  const q = normalitza(cerca.value);
  candidats = q.length === 0 ? [] : DADES.filter((row) => row.k.includes(q) && !triats.includes(row.s)).slice(0, 8);
  actiu = candidats.length > 0 ? 0 : -1;
  resultats.innerHTML = candidats.map((row, i) =>
    '<li id="opcio-' + i + '" role="option" aria-selected="' + (i === actiu) + '" data-s="' + esc(row.s) + '">' +
    "<b>" + esc(row.n) + "</b><span>" + esc(COMARQUES[row.c]) + " · " + milers(row.v[POBLACIO] || 0) + " hab.</span></li>").join("");
  resultats.hidden = candidats.length === 0;
  cerca.setAttribute("aria-expanded", candidats.length > 0 ? "true" : "false");
  cerca.setAttribute("aria-activedescendant", actiu === -1 ? "" : "opcio-" + actiu);
}

function mouActiu(pas){
  if (candidats.length === 0) return;
  actiu = (actiu + pas + candidats.length) % candidats.length;
  for (let i = 0; i < resultats.children.length; i += 1) {
    resultats.children[i].setAttribute("aria-selected", i === actiu ? "true" : "false");
  }
  cerca.setAttribute("aria-activedescendant", "opcio-" + actiu);
  resultats.children[actiu].scrollIntoView({ block: "nearest" });
}

function tanca(){
  resultats.hidden = true;
  candidats = [];
  actiu = -1;
  cerca.setAttribute("aria-expanded", "false");
  cerca.removeAttribute("aria-activedescendant");
}

function tria(slug){
  afegeix(slug);
  cerca.value = "";
  tanca();
  // Amb quatre municipis el cercador queda desactivat: el focus ha d'anar a un
  // lloc útil —treure el que s'acaba d'afegir— i no perdre's al document.
  if (cerca.disabled) {
    const boto = triatsUl.querySelector('button[data-s="' + slug + '"]');
    if (boto) boto.focus();
  } else {
    cerca.focus();
  }
}

cerca.addEventListener("input", pintaResultats);
cerca.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown") { event.preventDefault(); if (resultats.hidden) pintaResultats(); else mouActiu(1); }
  else if (event.key === "ArrowUp") { event.preventDefault(); mouActiu(-1); }
  else if (event.key === "Enter") { if (actiu !== -1) { event.preventDefault(); tria(candidats[actiu].s); } }
  else if (event.key === "Escape") { if (!resultats.hidden) { event.preventDefault(); tanca(); } else cerca.value = ""; }
});
// Amb 'mousedown' el clic no perd el focus abans d'hora i la tria no s'escapa.
resultats.addEventListener("mousedown", (event) => {
  const li = event.target.closest("li[data-s]");
  if (!li) return;
  event.preventDefault();
  tria(li.dataset.s);
});
cerca.addEventListener("blur", () => { window.setTimeout(tanca, 120); });

triatsUl.addEventListener("click", (event) => {
  const boto = event.target.closest("button[data-s]");
  if (!boto) return;
  treu(boto.dataset.s);
  cerca.focus();
});
neteja.addEventListener("click", () => { triats = []; canvia(); cerca.focus(); });
for (const boto of document.querySelectorAll(".suggeriments button")) {
  boto.addEventListener("click", () => {
    triats = boto.dataset.m.split(",").filter((s) => PER_SLUG.has(s)).slice(0, MAXIM);
    canvia();
  });
}

// -------------------------------------------------------------------- taula

function celaXifra(def, row, marca, posicio){
  const valor = row.v[posicio];
  const text = formata(def, valor);
  const percentil = def.percentil ? row.p[posicio] : null;
  return '<td' + (marca ? ' class="' + marca + '"' : "") + ">" +
    (text === null
      ? '<span class="valor sense">sense dada</span>'
      : '<span class="valor">' + esc(text) + "</span>") +
    (percentil === null || percentil === undefined
      ? ""
      : '<span class="percentil">p' + percentil + " entre els municipis de la seva mida</span>") +
    (marca ? '<span class="marca ' + marca + '">' + NOM_MARCA[marca] + "</span>" : "") +
    "</td>";
}

// «tots els municipis» és una etiqueta de grup possible i no encaixa amb la
// frase, així que la frase s'adapta i no al revés.
function compara(grup){
  return grup.indexOf("tots") === 0 ? "es compara amb " + grup : "es compara amb els municipis " + grup;
}

function pintaTaula(){
  const files = triats.map((slug) => PER_SLUG.get(slug));

  capcalera.innerHTML = '<tr><th class="cantonada" scope="col"><span class="nomes-lectors">Indicador</span></th>' +
    files.map((row) =>
      '<th scope="col"><span class="municipi"><a href="../m/' + esc(row.s) + '/">' + esc(row.n) + "</a></span>" +
      '<span class="lloc">' + esc(COMARQUES[row.c]) + "</span>" +
      '<span class="grup">' + esc(compara(GRUPS[row.g])) + "</span></th>").join("") +
    "</tr>";

  let html = "";
  for (const seccio of SECCIONS) {
    const deLaSeccio = [];
    XIFRES.forEach((def, i) => { if (def.seccio === seccio) deLaSeccio.push({ def: def, i: i, mena: "xifra" }); });
    TEXTOS.forEach((def, i) => { if (def.seccio === seccio) deLaSeccio.push({ def: def, i: i, mena: "text" }); });
    if (deLaSeccio.length === 0) continue;
    // El títol de secció va dins d'un span enganxat a l'esquerra: la cel·la ocupa
    // tota l'amplada de la taula i, en desplaçar-se de costat, el text se n'anava.
    html += '<tr class="seccio"><th scope="colgroup" colspan="' + (files.length + 1) + '"><span>' + esc(seccio) + "</span></th></tr>";
    for (const fila of deLaSeccio) {
      const def = fila.def;
      html += '<tr><th scope="row"><span class="etq">' + esc(def.etiqueta) + "</span>" +
        (def.com ? '<span class="sentit">' + esc(def.com) + "</span>" : "") + "</th>";
      if (fila.mena === "text") {
        html += files.map((row) => {
          const cela = row.t[fila.i] || ["", ""];
          return '<td><span class="valor">' + esc(cela[0]) + "</span>" +
            (cela[1] ? '<span class="sec">' + esc(cela[1]) + "</span>" : "") + "</td>";
        }).join("");
      } else {
        const valors = files.map((row) => row.v[fila.i]);
        const marques = marquesDe(def.sentit, def.objectiu === null ? undefined : def.objectiu, valors);
        html += files.map((row, n) => celaXifra(def, row, marques[n], fila.i)).join("");
      }
      html += "</tr>";
    }
  }
  cos.innerHTML = html;
}

function pintaTriats(){
  triatsUl.innerHTML = triats.map((slug) => {
    const row = PER_SLUG.get(slug);
    return "<li>" + esc(row.n) +
      '<button class="treu" type="button" data-s="' + esc(slug) + '" aria-label="Treu ' + esc(row.n) + ' de la comparació">×</button></li>';
  }).join("");
}

// Quan els municipis triats no són del mateix grup, els percentils surten de
// llistes diferents i no es poden posar en fila; i si a més les mides ballen
// molt, les xifres per habitant tampoc no volen dir el mateix. Són dos avisos
// diferents i el segon no sempre toca.
function pintaDesigual(){
  const files = triats.map((slug) => PER_SLUG.get(slug));
  const grups = new Set(files.map((row) => row.g));
  if (files.length < 2 || grups.size < 2) { desigual.hidden = true; return; }
  const poblacions = files.map((row) => row.v[POBLACIO]).filter((v) => typeof v === "number");
  const proporcio = poblacions.length > 1 ? Math.max.apply(null, poblacions) / Math.min.apply(null, poblacions) : 1;
  const noms = files.map((row) => row.n + " (" + GRUPS[row.g] + ")");
  desigual.hidden = false;
  desigual.innerHTML = "<b>No són tots de la mateixa mida:</b> " + esc(noms.join(", ")) +
    ". Cada percentil compara el municipi amb els del seu grup, així que entre ells no es poden posar en fila; " +
    "les xifres sí." +
    (proporcio >= 5
      ? " I amb aquesta diferència de població, el que es gasta i es deu per habitant tampoc no vol dir el mateix: " +
        "una ciutat presta serveis que el seu voltant també fa servir."
      : "");
}

function pinta(){
  pintaTriats();
  pintaDesigual();
  const nhiha = triats.length >= 2;
  buit.hidden = nhiha;
  marc.hidden = !nhiha;
  llegenda.hidden = !nhiha;
  pista.hidden = triats.length < 3;
  if (nhiha) pintaTaula();
  neteja.hidden = triats.length === 0;
  compte.textContent = triats.length >= MAXIM
    ? "Ja n'hi ha quatre, que és el màxim. Treu-ne un per canviar-lo."
    : triats.length === 1
      ? "N'hi falta un altre per poder comparar."
      : triats.length === 0
        ? DADES.length + " municipis per triar"
        : "Encara n'hi pots afegir " + (MAXIM - triats.length) + ".";
  cerca.disabled = triats.length >= MAXIM;
}

triats = llegeixAdreca();
// L'adreça es torna a escriure d'entrada: si arriba amb municipis repetits, amb
// slugs que no existeixen o amb més de quatre, l'enllaç que es comparteixi a
// partir d'aquí ja és el net.
desaAdreca();
pinta();
</script>
</body>
</html>`;
}
