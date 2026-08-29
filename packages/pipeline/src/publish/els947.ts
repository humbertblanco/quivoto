import { eq } from "drizzle-orm";
import { municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { BRANDS_BY_ID, siglesFamily } from "@quivoto/shared-schemas/brands";
import { sobreColor } from "./contrast";
import { carregaMetriques } from "./metriques";
import { RADIOGRAFIA_CSS } from "./estil";
import { MASCOTA_CSS, papereta } from "./mascota";
import { icona } from "./icones";
import { SITE } from "./config";
import { nomLlegible, slugify } from "../lib/text";

/**
 * «Els 947» — l'índex de tots els municipis de Catalunya amb el que en sabem.
 *
 * 947 és el nombre de municipis que té Catalunya, i la pàgina existeix per
 * ensenyar-los tots amb la seva dada: no una demostració amb tres pobles triats,
 * sinó els 947 alhora, amb el que en sabem i el forat on no n'hi ha.
 *
 * El nom coincideix amb el d'els947.cat, un joc de geografia catalana. La
 * coincidència és de la xifra i de res més: el joc és d'una altra gent, no hi
 * tenim cap relació ni cap acord, i aquesta pàgina no en depèn gens. L'enllaç
 * que hi ha a baix és un guinyo, i s'ha de continuar llegint com a tal.
 *
 * La llista va escrita a l'HTML, fila a fila: sense JavaScript es llegeix
 * sencera i s'arriba a totes les fitxes. Els filtres són caselles i CSS, i el
 * cercador és l'única peça que necessita el navegador. No surt res d'aquí: ni
 * peticions ni manera de saber qui mira què.
 */

export type Els947Row = {
  /** slug, nom, comarca, població, regidories */
  s: string; n: string; c: string; p: number; r: number;
  /** alcaldia i sigles */
  a: string | null; g: string | null;
  /** el retrat que publica el mateix ajuntament, si en publica */
  ar: string | null;
  /** el color de la força de l'alcaldia, quan les sigles el deixen deduir */
  ac: string | null;
  /** governa el més votat: 1 sí, 0 no, null desconegut */
  w: 0 | 1 | null;
  /** majoria absoluta d'una sola llista */
  m: 0 | 1;
  /** canvi d'alcaldia a mig mandat */
  k: 0 | 1;
  /** actes indexades */
  t: number;
  /** deute per habitant, en euros */
  d: number | null;
  /** estalvi net en percentatge */
  e: number | null;
  /** dones al ple, en percentatge */
  f: number | null;
  /** canvis de la força més votada des del 1979, i quantes eleccions */
  v: number | null; q: number | null;
  /** compliment del portal de transparència, en percentatge */
  y: number | null;
  /** ple amb una sola candidatura */
  o: 0 | 1;
};

/**
 * Les mètriques que la llista dels 947 llegeix, i cap més.
 *
 * Demanar-ne una que no hi és no falla: `own?.has(...)` torna fals i la columna
 * surt buida sense dir res. Va passar amb `singleList`, que no hi era: el
 * comptador de la portada dels 947 deia que cap municipi no té una sola
 * candidatura al ple quan el Síndic n'hi compta **185**, i el filtre no trobava
 * res. La llista de dalt s'ha de mirar cada cop que la fila creixi.
 *
 * Aquí hi havia també `"actes"`, que cap job no escriu —J12 i J16 desen
 * `mocions`— i que aquí no caldria igualment: les actes indexades surten de
 * `municipalities.minutesCount`, no de cap mètrica.
 */
const KINDS_ELS947: string[] = [
  // «carrecs» hi és només per una cosa: el retrat de l'alcaldia. Són 5 kB per
  // municipi —uns 4,7 MB en total— i `carregaMetriques` ja els demana en blocs
  // de 200, que és el que fa que això no repeteixi el problema de memòria de
  // les actes. Si un dia aquesta mètrica creix, el primer que s'ha de mirar és
  // si val la pena continuar-la llegint aquí per una sola imatge.
  "carrecs",
  "electoralHistory",
  "finances",
  "government",
  "mayors",
  "parity",
  "transparency",
  "results",
  "singleList",
];

/**
 * Llegir una mètrica **només** si s'ha demanat a la consulta.
 *
 * Sense això, demanar una clau que no és a `KINDS_ELS947` torna `undefined` i
 * la columna surt buida per als 947 sense dir-ho enlloc. És com el comptador de
 * plens amb una sola candidatura va estar dient 0 quan n'hi ha 185: no fallava
 * res, simplement no s'havia demanat. Ara peta, i peta a la primera fila.
 */
export function lectorDe(own: Map<string, unknown> | undefined): {
  llegeix: (kind: string) => unknown;
  te: (kind: string) => boolean;
} {
  const comprova = (kind: string): void => {
    if (!KINDS_ELS947.includes(kind)) {
      throw new Error(`els947 llegeix la mètrica «${kind}» i no la demana: afegeix-la a KINDS_ELS947`);
    }
  };
  return {
    llegeix: (kind) => {
      comprova(kind);
      return own?.get(kind);
    },
    te: (kind) => {
      comprova(kind);
      return own?.has(kind) ?? false;
    },
  };
}

export async function loadEls947(db: Db): Promise<Els947Row[]> {
  const all = await db.select().from(municipalities);
  /**
   * Les mètriques, només les que calen i **de tros en tros**.
   *
   * Aquesta consulta portava la taula sencera. Quan J12 hi va afegir els punts
   * votats de les actes —41.113 punts amb el seu text i el vot de cada grup, 18
   * MB en 67 files— el motor de WebAssembly de PGlite es quedava sense memòria
   * («memory access out of bounds») i la publicació sencera fallava abans de
   * generar res, per una columna que aquí no es mira mai.
   *
   * Filtrar per tipus no n'hi havia prou: només la liquidació ja són 8 MB, i el
   * resultat sencer ha de cabre a la memòria del motor d'una tirada. Es demana
   * en blocs, que és el que fa que això aguanti quan la base de dades creixi
   * —i creixerà, perquè les actes són el que més té per créixer.
   */
  const metrics = await carregaMetriques(db, KINDS_ELS947);

  const byMunicipality = new Map<number, Map<string, unknown>>();
  for (const metric of metrics) {
    let map = byMunicipality.get(metric.municipalityId);
    if (!map) byMunicipality.set(metric.municipalityId, (map = new Map()));
    map.set(metric.kind, metric.data);
  }

  return all
    .map((m): Els947Row => {
      const own = byMunicipality.get(m.id);
      const { llegeix, te } = lectorDe(own);
      const government = llegeix("government") as
        | { winnerGoverns: boolean | null; winnerHasMajority: boolean; mayorSigles: string | null }
        | undefined;
      const mayors = llegeix("mayors") as { currentTermChange: unknown } | undefined;
      const parity = llegeix("parity") as { womenElectedPct: number | null; complet?: boolean } | undefined;
      const history = llegeix("electoralHistory") as { alternances: number; elections: number } | undefined;
      const transparency = llegeix("transparency") as { pct: number | null } | undefined;
      const finances = llegeix("finances") as
        | { indicators: { key: string; value: number | null }[] }
        | undefined;
      const indicator = (key: string): number | null =>
        finances?.indicators.find((i) => i.key === key)?.value ?? null;

      // El retrat de qui té l'alcaldia. S'aparella pel càrrec i no pel nom:
      // la seu electrònica escriu «Alcalde», «Alcaldessa» o «Alcaldia» i això
      // és més estable que el nom, que cada font escriu a la seva manera.
      const carrecs = llegeix("carrecs") as
        | { carrecs: { nom: string; carrec: string; fotoPetita: string | null }[] }
        | undefined;
      const capDeCasa = carrecs?.carrecs.find((c) => /alcald/i.test(c.carrec)) ?? null;
      const sigles = government?.mayorSigles ?? m.mayorPartyRaw ?? null;
      const familia = sigles ? siglesFamily(sigles) : null;

      return {
        s: m.slug,
        n: m.name,
        c: m.comarca ?? "",
        p: m.population ?? 0,
        r: government ? (government as unknown as { totalSeats: number }).totalSeats : (m.councilSeats ?? 0),
        a: m.mayorName,
        g: sigles,
        ar: capDeCasa?.fotoPetita ?? null,
        ac: familia ? BRANDS_BY_ID.get(familia)?.color ?? null : null,
        w: government?.winnerGoverns === null || government === undefined ? null : government.winnerGoverns ? 1 : 0,
        m: government?.winnerHasMajority ? 1 : 0,
        k: mayors?.currentTermChange ? 1 : 0,
        t: m.minutesCount ?? 0,
        d: indicator("deute-habitant"),
        e: indicator("estalvi-net"),
        f: parity?.complet === false ? null : parity?.womenElectedPct ?? null,
        v: history?.alternances ?? null,
        q: history?.elections ?? null,
        y: transparency?.pct ?? null,
        o: te("singleList") ? 1 : 0,
      };
    })
    .sort((a, b) => b.p - a.p);
}

const escape = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Una fila amb el que la pàgina hi afegeix: si el municipi ja té radiografia. */
export type Fila = Els947Row & { x: 0 | 1 };

/**
 * La normalització de la cerca.
 *
 * Es fa servir dos cops: aquí per escriure la clau de cada fila a l'HTML, i al
 * navegador per normalitzar el que s'escriu. Va serialitzada amb `toString()` i
 * no copiada, perquè no hi pugui haver mai dues versions que es desincronitzin:
 * que un municipi no es trobés escrivint el seu propi nom seria l'error més
 * ridícul possible en una llista que es diu «els 947».
 */
export function clauCerca(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, " ")
    .replace(/^(l|el|la|els|les|es|sa)\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** La mediana d'una llista de xifres, o `null` si no n'hi ha cap. */
export function mediana(valors: readonly number[]): number | null {
  const nets = valors.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (nets.length === 0) return null;
  const mig = Math.floor(nets.length / 2);
  return nets.length % 2 === 1 ? nets[mig]! : (nets[mig - 1]! + nets[mig]!) / 2;
}

/**
 * Els dos llindars que es calculen del conjunt i no vénen de cap font.
 *
 * Són medianes, i van arrodonides perquè l'etiqueta del filtre digui exactament
 * la regla que s'aplica: si el botó diu «per sobre de 1.204 €», el que filtra ha
 * de ser 1.204 i no 1.203,5. També hi va quants municipis tenen la dada: amb
 * quatre no té sentit oferir cap mediana, i el filtre desapareix.
 */
export type Llindars = {
  deute: number | null;
  transparencia: number | null;
  ambDeute: number;
  ambTransparencia: number;
};

/** Per sota d'això, una mediana diu més del forat de dades que dels municipis. */
const MINIM_PER_A_MEDIANA = 40;

export function llindarsDe(files: readonly Els947Row[]): Llindars {
  const deutes = files.map((f) => f.d).filter((v): v is number => v !== null);
  const transparencies = files.map((f) => f.y).filter((v): v is number => v !== null);
  const arrodoneix = (v: number | null): number | null => (v === null ? null : Math.round(v));
  return {
    deute: deutes.length >= MINIM_PER_A_MEDIANA ? arrodoneix(mediana(deutes)) : null,
    transparencia:
      transparencies.length >= MINIM_PER_A_MEDIANA ? arrodoneix(mediana(transparencies)) : null,
    ambDeute: deutes.length,
    ambTransparencia: transparencies.length,
  };
}

const xifra = (n: number): string => n.toLocaleString("ca-ES");

/**
 * Els filtres, agrupats per la pregunta que responen.
 *
 * Cap filtre no diu si el que troba està bé o malament: «deute per sobre de la
 * mediana» és una posició dins dels 947, no una nota de gestió. Els quatre
 * últims (dones al ple, deute, transparència i mida) són camps que ja hi eren a
 * cada fila i que no es podien filtrar: la pàgina els ensenyava i no deixava
 * preguntar-los, que és la manera més segura de tenir una dada que no serveix.
 */
type GrupFiltres = { clau: string; titol: string; tema: string };

const GRUPS_FILTRE: readonly GrupFiltres[] = [
  { clau: "mana", titol: "Qui hi mana", tema: "participació" },
  { clau: "ple", titol: "Com és el ple", tema: "el ple" },
  { clau: "papers", titol: "Els comptes i els papers", tema: "fiscalitat" },
  { clau: "municipi", titol: "Quin municipi", tema: "urbanisme" },
];

type Filtre = {
  clau: string;
  grup: string;
  text: (l: Llindars) => string;
  te: (f: Fila, l: Llindars) => boolean;
  /** Si el conjunt no dóna per a aquest filtre, no es dibuixa. */
  hi?: (l: Llindars) => boolean;
};

export const FILTRES: readonly Filtre[] = [
  { clau: "pacte", grup: "mana", text: () => "Governa qui no va guanyar", te: (f) => f.w === 0 },
  { clau: "canvi", grup: "mana", text: () => "Canvi d'alcaldia a mig mandat", te: (f) => f.k === 1 },
  {
    clau: "sempre",
    grup: "mana",
    text: () => "La mateixa força des del 1979",
    te: (f) => f.v === 0 && (f.q ?? 0) >= 8,
  },
  { clau: "majoria", grup: "ple", text: () => "Majoria absoluta", te: (f) => f.m === 1 },
  { clau: "unica", grup: "ple", text: () => "Una sola candidatura", te: (f) => f.o === 1 },
  {
    clau: "dones",
    grup: "ple",
    text: () => "Més dones que homes al ple",
    te: (f) => f.f !== null && f.f > 50,
  },
  {
    clau: "deute",
    grup: "papers",
    text: (l) => `Deute per sobre de ${xifra(l.deute ?? 0)} €`,
    te: (f, l) => l.deute !== null && f.d !== null && f.d > l.deute,
    hi: (l) => l.deute !== null,
  },
  {
    clau: "opac",
    grup: "papers",
    text: (l) => `Transparència per sota del ${xifra(l.transparencia ?? 0)} %`,
    te: (f, l) => l.transparencia !== null && f.y !== null && f.y < l.transparencia,
    hi: (l) => l.transparencia !== null,
  },
  { clau: "sense", grup: "papers", text: () => "Sense cap acta del ple", te: (f) => f.t === 0 },
  { clau: "petits", grup: "municipi", text: () => "Menys de 1.000 habitants", te: (f) => f.p < 1000 },
  { clau: "fitxa", grup: "municipi", text: () => "Amb radiografia", te: (f) => f.x === 1 },
];

/** Els filtres que aquest conjunt de dades permet oferir. */
export function filtresDisponibles(l: Llindars): readonly Filtre[] {
  return FILTRES.filter((f) => (f.hi ? f.hi(l) : true));
}

/** Les marques d'una fila: el que el filtre de CSS busca amb `[data-f~=…]`. */
export function marques(fila: Fila, l: Llindars): string[] {
  return filtresDisponibles(l)
    .filter((f) => f.te(fila, l))
    .map((f) => f.clau);
}

/** Les pastilles d'una fila, en l'ordre en què es llegeixen. */
export function pastilles(fila: Fila, l: Llindars): string[] {
  const out: string[] = [];
  const posa = (text: string, mena = ""): number =>
    out.push(`<span class="pastilla${mena ? ` ${mena}` : ""}">${escape(text)}</span>`);

  if (fila.w === 0) posa("Governa qui no va guanyar", "pacte");
  if (fila.k === 1) posa("Canvi d'alcaldia a mig mandat", "canvi");
  if (fila.m === 1) posa("Majoria absoluta", "majoria");
  if (fila.o === 1) posa("Una sola candidatura", "unica");
  if (fila.v === 0 && (fila.q ?? 0) >= 8) posa("La mateixa força des del 1979", "sempre");
  else if (fila.v !== null && fila.q !== null)
    posa(`${fila.v} canvis de mans en ${fila.q} eleccions`);
  // El nom de l'alcaldia i les seves sigles ja tenen la seva pròpia línia amb
  // la cara i el color: com a pastilles hi sortien una segona vegada, en text
  // pla i barrejades amb les xifres del poble.
  posa(`${fila.r} regidories`);
  posa(fila.t > 0 ? `${xifra(fila.t)} actes indexades` : "Sense actes", fila.t > 0 ? "" : "sense");
  if (fila.d !== null) posa(`${xifra(fila.d)} € de deute per habitant`);
  if (fila.f !== null) posa(`${xifra(fila.f)} % de dones al ple`);
  if (fila.y !== null) posa(`Transparència ${xifra(fila.y)} %`);
  return out;
}

/**
 * El CSS propi. Tota la resta —tipografies, colors, capçalera, `.destins`,
 * `.bloc`, `.index`— surt de `RADIOGRAFIA_CSS`, que és el que fa que aquesta
 * pàgina rebi les correccions de la resta de l'Observatori en comptes de
 * quedar-se amb una còpia vella dels mateixos estils.
 */
const CSS = `
.xifres{list-style:none;display:grid;gap:var(--e2);grid-template-columns:repeat(auto-fit,minmax(150px,1fr));
  margin:var(--e4) 0 0;padding:0}
.xifres li{background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);
  box-shadow:var(--ombra);padding:var(--e2)}
.xifres b{display:block;font-family:var(--display);font-weight:900;font-size:2.1rem;line-height:1;
  letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.xifres span{font-size:.82rem;color:var(--ink-suau)}
.pistes{display:flex;flex-wrap:wrap;gap:8px;margin:var(--e3) 0 0}

/* --- qui mana a cada poble, a la llista dels 947 -------------------------
   Amb 947 files, un nom i unes sigles en text pla es llegeixen d'una en una.
   La cara i el color de la força es recullen d'una passada, que és el que fa
   que la llista es pugui recórrer. Sense fotografia hi van les inicials amb el
   color del partit: mai un buit, que faria semblar que d'aquell poble no en
   sabem qui mana quan el que passa és que l'ajuntament no en publica el retrat. */
.mana{display:flex;align-items:center;gap:9px;margin:6px 0 0;flex-wrap:wrap}
.mana .cara{width:30px;height:30px;border-radius:50%;object-fit:cover;object-position:50% 22%;
  border:2px solid var(--ink);background:var(--paper-2);flex:none}
.mana .cara.inicials{display:flex;align-items:center;justify-content:center;font-family:var(--display);
  font-weight:900;font-size:.72rem;background:var(--c);color:var(--t)}
.mana .qui-mana{font-weight:800;font-size:.9rem;min-width:0;overflow-wrap:anywhere}
.mana .sigla{font-size:.72rem;padding:0 9px}

/* --- el tauler: cercador, filtres i llista ---------------------------- */
.tauler{margin:var(--e4) 0 0}
.cercador{position:sticky;top:0;z-index:5;background:var(--paper);padding:var(--e2) 0;
  border-bottom:2.5px solid var(--ink)}
/* El cercador és l'única peça que necessita JavaScript: sense ell no faria res
   i seria un camp que enganya. Els filtres, en canvi, són caselles i CSS. */
.cercador{display:none}
.js .cercador{display:block}
#cerca{width:100%;font:inherit;font-size:1.1rem;padding:13px 16px;border:2.5px solid var(--ink);
  border-radius:var(--r-m);background:var(--paper-2);color:var(--ink);box-shadow:var(--ombra)}

.filtres{margin:var(--e3) 0 0}
.colla{margin:0 0 var(--e2)}
.colla h3{display:flex;align-items:center;gap:8px;margin:0 0 8px;font-family:var(--text);
  font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--ink-suau)}
.colla h3 .icona{width:26px;height:26px}
.tries{display:flex;flex-wrap:wrap;gap:8px}
.filtre{display:inline-flex;align-items:center;min-height:44px;padding:0 15px;font-size:.82rem;
  font-weight:800;border:2px solid var(--ink);border-radius:var(--r-max);cursor:pointer;
  overflow-wrap:anywhere}
.commutador:checked+.filtre{background:var(--ink);color:var(--paper)}
.commutador:focus-visible+.filtre{outline:3px solid var(--coral);outline-offset:2px}
.eines{display:flex;flex-wrap:wrap;align-items:center;gap:var(--e2);margin:var(--e2) 0 0}
.neteja{font:inherit;font-size:.82rem;font-weight:800;display:inline-flex;align-items:center;
  min-height:44px;padding:0 15px;border:2px dashed var(--ink);border-radius:var(--r-max);
  background:transparent;color:inherit;cursor:pointer}
.recompte{font-size:.86rem;color:var(--ink-suau);margin:0}

.llista{list-style:none;margin:var(--e2) 0 0;padding:0}
.fila{border-bottom:1px solid var(--vora);padding:2px 0 var(--e2);min-width:0}
.fila .titol{display:flex;flex-wrap:wrap;align-items:baseline;gap:0 var(--e2);margin:0}
.fila .municipi{display:inline-flex;align-items:center;min-height:44px;font-family:var(--display);
  font-weight:900;font-size:1.15rem;letter-spacing:-.02em;text-decoration:none;overflow-wrap:anywhere}
.fila a.municipi{border-bottom:2.5px solid var(--coral)}
.fila .pob{font-size:.9rem;font-weight:800;color:var(--ink-suau);font-variant-numeric:tabular-nums;
  margin-left:auto}
.fila .lloc{margin:0;font-size:.82rem;color:var(--ink-suau)}
.fila .lloc a{display:inline-flex;align-items:center;min-height:44px;text-decoration:none;
  border-bottom:1.5px solid var(--vora)}
/* Una pastilla com «Josep Maria Gras Charles» o «AGRUPACIÓ D'ELECTORS-PROGRÉS
   MUNICIPAL» feia 453 px amb «white-space:nowrap» i desplaçava la pàgina
   sencera de costat en un mòbil de 320. Aquí no hi ha cap «nowrap»: el nom i
   les sigles van en pastilles separades i totes dues es poden partir. */
.fila .dades{display:flex;flex-wrap:wrap;gap:6px;margin:var(--e1) 0 0;min-width:0}
.pastilla{font-size:.72rem;font-weight:700;line-height:1.4;border:1.5px solid var(--vora);
  border-radius:var(--r-max);padding:3px 10px;max-width:100%;min-width:0;overflow-wrap:anywhere}
.pastilla.pacte{background:var(--presec);border-color:var(--ink);color:#1E1B2E}
.pastilla.canvi{background:var(--lavanda);border-color:var(--ink);color:#1E1B2E}
.pastilla.majoria{background:var(--menta);border-color:var(--ink);color:#1E1B2E}
.pastilla.sempre{background:var(--coral);border-color:var(--ink);color:#1E1B2E}
.pastilla.unica{background:var(--ink);border-color:var(--ink);color:var(--paper)}
.pastilla.sigles{border-color:var(--ink);font-weight:900}
.pastilla.sense{border-style:dashed;color:var(--ink-suau)}
.buit{padding:var(--e4) 0;color:var(--ink-suau)}
.fila.fora{display:none}

/* Les 43 comarques reaprofiten les pastilles de l'índex de la fitxa, però aquí
   van dins d'un bloc que ja porta la seva ratlla: dues de seguides es llegien
   com una separació doble. */
.bloc .index{border-top:0;margin-top:var(--e2);padding-top:0}

/* --- els filtres, sense JavaScript ------------------------------------
   Cada casella amaga les files que no porten la seva marca. Ho fa el navegador
   amb «:has()»; si algun no el sap fer, no passa res greu: la llista es queda
   sencera i llegible, que és el mínim que aquesta pàgina ha de complir sempre. */
${FILTRES.map(
  (f) =>
    `.tauler:has(#f-${f.clau}:checked) .fila:not([data-f~="${f.clau}"]){display:none}`,
).join("\n")}
`;

export function renderEls947(
  rows: readonly Els947Row[],
  generatedAt: string,
  withPage: ReadonlySet<string>,
): string {
  const files: Fila[] = rows.map((r) => ({ ...r, x: withPage.has(r.s) ? 1 : 0 }));
  const llindars = llindarsDe(rows);
  const disponibles = filtresDisponibles(llindars);

  const totals = {
    municipis: files.length,
    regidories: files.reduce((a, r) => a + r.r, 0),
    pacte: files.filter((r) => r.w === 0).length,
    majoria: files.filter((r) => r.m === 1).length,
    canvis: files.filter((r) => r.k === 1).length,
    sempre: files.filter((r) => r.v === 0 && (r.q ?? 0) >= 8).length,
    senseOposicio: files.filter((r) => r.o === 1).length,
    senseActes: files.filter((r) => r.t === 0).length,
    comarques: new Set(files.map((r) => r.c).filter(Boolean)).size,
  };

  const comarques = [...new Set(files.map((r) => r.c).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ca"),
  );

  /**
   * La llista va sencera a l'HTML, fila a fila.
   *
   * Abans es dibuixava amb JavaScript des d'un JSON incrustat, i sense
   * JavaScript la pàgina era un títol i una llista buida: ni es podia llegir ni
   * s'arribava a cap fitxa. Ara el navegador només hi fa dues coses —cercar i
   * comptar—, i el que hi ha escrit no depèn que cap script s'executi.
   */
  const llista = files
    .map((f) => {
      const nom = escape(f.n);
      const titol =
        f.x === 1
          ? `<a class="municipi" href="m/${escape(f.s)}/">${nom}</a>`
          : `<span class="municipi">${nom}</span>`;
      const lloc = f.c
        ? `<a href="c/${escape(slugify(f.c))}/">${escape(f.c)}</a>`
        : "<span>sense comarca</span>";
      // Qui mana, amb la cara que publica el seu ajuntament i el color de la
      // seva força. Amb 947 files, un nom i unes sigles en text pla es
      // llegeixen d'una en una; la cara i el color es recullen d'una passada,
      // que és el que fa que aquesta llista es pugui recórrer de debò.
      const qui = f.a
        ? (() => {
            const { fons, tinta } = sobreColor(f.ac ?? "#8b8b8b");
            const inicials = f.a
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((w) => w[0]!.toUpperCase())
              .join("");
            const cara = f.ar
              ? `<img class="cara" src="${escape(f.ar)}" alt="" loading="lazy" width="30" height="30">`
              : `<span class="cara inicials" style="--c:${fons};--t:${tinta}" aria-hidden="true">${escape(inicials)}</span>`;
            return `<p class="mana">${cara}<span class="qui-mana">${escape(nomLlegible(f.a))}</span>${
              f.g ? `<b class="sigla" style="--c:${fons};--t:${tinta}">${escape(f.g)}</b>` : ""
            }</p>`;
          })()
        : "";
      return `<li class="fila" data-k="${escape(clauCerca(f.n) + " " + clauCerca(f.c))}" data-f="${escape(
        marques(f, llindars).join(" "),
      )}">
<p class="titol">${titol}<span class="pob">${xifra(f.p)} hab.</span></p>
<p class="lloc">${lloc}</p>
${qui}
<p class="dades">${pastilles(f, llindars).join("")}</p>
</li>`;
    })
    .join("\n");

  const tries = GRUPS_FILTRE.map((grup) => {
    const seus = disponibles.filter((f) => f.grup === grup.clau);
    if (seus.length === 0) return "";
    const botons = seus
      .map(
        (f) => `<input class="commutador nomes-lectors" type="checkbox" id="f-${f.clau}" value="${f.clau}">
      <label class="filtre" for="f-${f.clau}">${escape(f.text(llindars))}</label>`,
      )
      .join("\n      ");
    return `<section class="colla">
    <h3>${icona(grup.tema)}${escape(grup.titol)}</h3>
    <div class="tries">
      ${botons}
    </div>
  </section>`;
  }).join("\n  ");

  return `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Els 947 · Observatori de quivoto</title>
<meta name="description" content="Els 947 municipis de Catalunya en una llista, amb el que en sabem de cadascun: qui hi mana, si va guanyar, si ha canviat d'alcaldia, com estan els comptes i quantes actes del ple en tenim.">
<link rel="canonical" href="${SITE}/observatori/els947.html">
<style>${RADIOGRAFIA_CSS}${MASCOTA_CSS}${CSS}</style>
<script>document.documentElement.className += " js";</script>
</head>
<body>
<a class="salta" href="#llista">Ves a la llista</a>

<header class="capcalera">
  <a class="logo" href="./">Observatori</a>
  <span class="etiqueta">esborrany · dades obertes</span>
</header>

<main>
<section class="portada">
  <div class="presenta">${papereta(120, "felic")}<div>
    <p class="micro">Tot Catalunya, sense triar</p>
    <h1>Els 947</h1>
  </div></div>
  <p class="entrada">Tots els municipis de Catalunya i el que en sabem: qui hi mana, si va ser la
  llista més votada, si hi ha hagut canvi d'alcaldia a mig mandat, com estan els comptes i quantes
  actes del ple en tenim indexades. <b>Sense cap excepció i sense cap municipi triat a dit.</b>
  Si el que busques és posar a prova si te'ls saps tots de memòria, això ho fa
  <a href="https://els947.cat/" target="_blank" rel="noopener">els947.cat</a>, un joc d'una altra
  gent amb qui no tenim cap relació.</p>
  <p class="pistes">
    <a class="prova-enllac" href="mapa/">Els mateixos 947, al mapa →</a>
    <a class="prova-enllac" href="comparador/">Posa'n quatre de costat →</a>
  </p>
</section>

<ul class="xifres">
  <li><b>${totals.municipis}</b><span>municipis, de ${totals.comarques} comarques</span></li>
  <li><b>${xifra(totals.regidories)}</b><span>regidories el 2023</span></li>
  <li><b>${totals.pacte}</b><span>on governa una llista que no va guanyar</span></li>
  <li><b>${totals.canvis}</b><span>han canviat d'alcaldia a mig mandat</span></li>
  <li><b>${totals.majoria}</b><span>amb majoria absoluta d'una sola llista</span></li>
  <li><b>${totals.sempre}</b><span>on la mateixa força ha guanyat sempre des del 1979</span></li>
  <li><b>${totals.senseOposicio}</b><span>amb una sola candidatura al ple</span></li>
  <li><b>${totals.senseActes}</b><span>sense cap acta de ple publicada</span></li>
</ul>

<form class="tauler" id="tauler">
  <div class="cercador">
    <label class="nomes-lectors" for="cerca">Cerca un municipi o una comarca</label>
    <input id="cerca" type="search" autocomplete="off" spellcheck="false"
      placeholder="Escriu un poble: esplugues, la seu, hospitalet…">
  </div>

  <div class="filtres" role="group" aria-label="Filtres">
  ${tries}
  </div>

  <div class="eines">
    <button class="neteja" type="reset">Treu-ho tot</button>
    <p class="recompte" id="recompte" aria-live="polite">${totals.municipis} municipis, dels més grans als més petits</p>
  </div>

  <p class="nota">Les medianes són el municipi que queda al mig dels ${totals.municipis}: diuen on
  cau cadascun respecte dels altres, no si això està bé o malament. Els filtres es poden combinar.</p>

  <ul class="llista" id="llista">
${llista}
  </ul>
  <p class="buit" id="buit" hidden>Cap municipi no coincideix. Prova amb menys lletres o treu algun filtre.</p>
</form>

<section class="bloc">
  <h2>Les ${comarques.length} comarques</h2>
  <p class="entrada-bloc">Cada comarca té la seva pàgina: quantes alcaldies hi té cada força i com
  hi queda cada municipi.</p>
  <nav class="index" aria-label="Comarques">${comarques
    .map((c) => `<a href="c/${escape(slugify(c))}/">${escape(c)}</a>`)
    .join("")}</nav>
</section>

<section class="bloc joc">
  <h2>I tu, te'ls saps?</h2>
  <p>Nosaltres tenim les dades dels 947. Saber-ne els noms i on són ja és una altra cosa.
  Hi ha un joc que ho posa a prova, i és boníssim:</p>
  <p class="crida"><a href="https://els947.cat/" target="_blank" rel="noopener">Ves a jugar a els947.cat →</a></p>
  <p class="nota">No hi tenim res a veure: és el repte de geografia catalana d'algú altre,
  i ens va recordar que 947 no és una xifra abstracta sinó 947 llocs amb gent que hi vota.</p>
</section>

<section class="bloc anar">
  <h2>Segueix estirant</h2>
  <ul class="destins">
    <li><a href="mapa/"><b>El mapa dels 947</b>
      <span>Els mateixos municipis, pintats: on hi ha majoria absoluta, on no governa qui va
      guanyar i on mana la mateixa força des del 1979</span></a></li>
    <li><a href="comparador/"><b>El comparador</b>
      <span>De dos a quatre municipis a la mateixa taula, amb la mateixa vara</span></a></li>
    <li><a href="preguntes/"><b>Les preguntes</b>
      <span>Les afirmacions que la brúixola farà, escrites llegint les actes del ple</span></a></li>
    <li><a href="dades/"><b>Baixa't les dades</b>
      <span>Tot això en CSV i JSON, amb l'esquema documentat i la font de cada xifra</span></a></li>
  </ul>
</section>

<section class="bloc fonts">
  <h2>D'on surt tot això</h2>
  <p class="nota">Padró, alcaldia i dades de l'ens, resultats des del 1979, llistes de candidats i
  historial d'alcaldies: dades obertes de la Generalitat de Catalunya. Comptes i deute: Ministeri
  d'Hisenda via el portal de la Generalitat. Índex d'actes del ple i compliment del portal de
  transparència: Consorci AOC. Cada fitxa de municipi porta el codi del conjunt d'on surt cada
  xifra, i a <a href="dades/">dades obertes</a> hi ha l'esquema camp a camp.</p>
  <p class="nota">Aquí no hi ha cap veredicte de gestió: hi ha la dada, la font i on queda respecte
  de la resta. El judici és de qui llegeix.</p>
</section>
</main>

<footer class="peu">
  <p>quivoto · Observatori municipal · pàgina generada el ${escape(generatedAt)} ·
  esborrany intern, no indexat</p>
</footer>

<script>
const norm = ${clauCerca.toString()};
const tauler = document.getElementById("tauler");
const files = Array.prototype.slice.call(tauler.querySelectorAll(".fila"));
const claus = files.map(function (el) { return el.getAttribute("data-k"); });
const marques = files.map(function (el) { return " " + el.getAttribute("data-f") + " "; });
const caselles = Array.prototype.slice.call(tauler.querySelectorAll(".commutador"));
const cerca = document.getElementById("cerca");
const recompte = document.getElementById("recompte");
const buit = document.getElementById("buit");
const TOTAL = files.length;

// El navegador ja amaga les files amb els filtres de CSS; això ho torna a fer
// perquè el recompte sigui cert i perquè funcioni igual si algun no sap «:has()».
function pinta() {
  const q = norm(cerca.value);
  const actius = caselles.filter(function (c) { return c.checked; })
    .map(function (c) { return " " + c.value + " "; });
  let quants = 0;
  for (let i = 0; i < TOTAL; i++) {
    let hi = q === "" || claus[i].indexOf(q) !== -1;
    for (let j = 0; hi && j < actius.length; j++) {
      if (marques[i].indexOf(actius[j]) === -1) hi = false;
    }
    if (hi) quants++;
    files[i].classList.toggle("fora", !hi);
  }
  buit.hidden = quants > 0;
  recompte.textContent = quants === TOTAL
    ? TOTAL + " municipis, dels més grans als més petits"
    : quants + " de " + TOTAL + " municipis";
}

cerca.addEventListener("input", pinta);
tauler.addEventListener("change", pinta);
tauler.addEventListener("reset", function () { setTimeout(pinta, 0); });
pinta();
</script>
</body>
</html>`;
}
