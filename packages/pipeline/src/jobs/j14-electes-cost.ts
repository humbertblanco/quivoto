import { eq } from "drizzle-orm";
import { municipalFinances, municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { socrataAll } from "../adapters/socrata";
import {
  fetchText,
  findSlugDetall,
  parseCarrecs,
  senseTokenAuth,
  titolMunicipi,
  urlCarrecs,
  type Carrec,
} from "../adapters/seue";
import { buildPeerGroups, medianOf } from "../derive/peers";
import { normalize, normalizePersonName, titleCase } from "../lib/text";
import { sleep } from "../lib/http";
import { withRun, type Run } from "../lib/run";

/**
 * J14 — què costen els electes.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PER QUÈ AQUÍ NO S'HI INGEREIX CAP RETRIBUCIÓ QUE PUBLIQUI UN AJUNTAMENT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * El mòdul de càrrecs electes de seu-e té un camp «Retribució anual bruta» que
 * sembla exactament el que aquesta fitxa hauria de publicar. No ho és, i el cas
 * que ho demostra està comprovat contra la font el 29-08-2026:
 *
 *   · A la fitxa de l'alcaldessa de Rubí, `carrec-retribucio` diu **17.027,7 €**.
 *   · Dos paràgrafs més avall, `carrec-altresRetribucions` diu **90.940,08 €
 *     (sou de la Diputació de Barcelona)**.
 *
 * El que cobra de debò és ~107.968 €, i el camp que du el títol de «retribució»
 * en publica el 16 %. A Barcelona el mateix camp arriba a dir 0,00 € d'una
 * regidora que cobra 102.140,50 € de la Diputació. Una xifra baixa **exculpa**:
 * publicar-la fa més mal que no publicar-ne cap, perquè el lector es queda amb
 * la impressió d'haver-ho comprovat.
 *
 * La regla d'aquesta feina no és, doncs, «cap import», sinó **cap import que no
 * el publiqui qui el paga**:
 *
 *   · Del text lliure de seu-e d'un ajuntament no en surt mai cap euro. D'aquest
 *     camp només se'n compta si hi ha xifra o no (bloc 2), que és el que mesura
 *     el comportament i és complet per als 947.
 *   · Del que publica la Diputació de Barcelona al seu propi web, o la Diputació
 *     de Lleida al seu mòdul de seu-e, sí que se'n desa l'import (bloc 3),
 *     atribuït a qui el paga, amb l'enllaç a la seva pàgina i la data de
 *     consulta. La Diputació de Barcelona publica el codi retributiu de cada
 *     electe i la taula que el converteix en euros: A1 114.017,12 €/any,
 *     A2 102.140,50, A3 90.940,08. Quadra a l'euro amb el que declara la fitxa
 *     de Rubí, i és el que permet ensenyar el cas sencer.
 *   · **Mai un total sumat.** Cada import va amb el nom de qui el paga i la font
 *     que el publica. Qui vulgui sumar, que sumi; nosaltres no ho fem, perquè
 *     un total nostre seria una xifra que no ha publicat ningú.
 *   · Quan l'ens que paga no publica res —les diputacions de Girona i de
 *     Tarragona—, això es desa dit tal com és. També és informació.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ELS TRES BLOCS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   1. **El cost dels òrgans de govern**, de la liquidació del pressupost
 *      (Socrata `8squ-bk4r`). És l'única xifra comparable entre els 947, perquè
 *      surt del mateix formulari per a tothom. Sèrie 2019-2025, no només
 *      l'últim any: el que val és poder dir com ha canviat durant el mandat.
 *   2. **Qui publica què cobra i qui no**, comptat a seu-e. Complet per als 947
 *      —de tots en sabem la resposta— i és el que discrimina el comportament.
 *   3. **Els càrrecs acumulats**: quins regidors d'aquí seuen també en un
 *      consell comarcal o una diputació, i què en publica aquell ens.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Fonts
// ─────────────────────────────────────────────────────────────────────────────

/** Liquidació del pressupost, econòmic i per programes (Generalitat, Socrata). */
export const LIQUIDACIO = "8squ-bk4r";

/** Composició dels plens: ajuntaments, consells comarcals i diputacions. */
export const PLENS = "nm3n-3vbj";

/** Retribucions dels electes de la Diputació de Barcelona, al seu propi web. */
export const URL_DIBA = "https://www.diba.cat/web/ladiputacio/retribucions-electes";

/**
 * Les tres partides de la classificació econòmica que toquen els electes.
 *
 * `1000` és **l'única** que és només d'ells: «Retr. bàs. i altres rem. membres
 * òrgans de govern». Les altres dues es desen a part i mai sumades:
 *
 *   · `2300` (dietes) i l'article `23` (indemnitzacions per raó del servei)
 *     **inclouen el personal**, no només els càrrecs electes, i a més `2300` és
 *     un subconcepte de dins de `23`: sumar-los comptaria dos cops el mateix.
 *
 * I el que **no** es fa servir: el programa `91` de la classificació per
 * programes. Sembla el bo pel nom («Òrgans de govern») però hi entra el
 * personal d'alcaldia i de protocol. A Rubí dona 3,04 M€ contra els 815.729 €
 * del concepte 1000; ensenyar-ho com «el que costen els polítics» seria fals.
 */
export const CONCEPTES = [
  {
    clau: "organs" as const,
    estructura: "1000",
    etiqueta: "Retribucions dels membres dels òrgans de govern",
    nomesElectes: true,
  },
  {
    clau: "dietes" as const,
    estructura: "2300",
    etiqueta: "Dietes",
    nomesElectes: false,
  },
  {
    clau: "indemnitzacions" as const,
    estructura: "23",
    etiqueta: "Indemnitzacions per raó del servei (article 23, inclou el personal)",
    nomesElectes: false,
  },
];

export type ClauConcepte = (typeof CONCEPTES)[number]["clau"];

/** Primer exercici que s'ingereix: el que obre el mandat anterior. */
export const PRIMER_EXERCICI = 2019;

/** Exercici que obre el mandat que s'està jutjant. */
export const INICI_MANDAT = 2023;

/**
 * Per sota d'aquesta part de la cobertura de l'any millor, un exercici encara
 * s'està liquidant i no es pot comparar amb els altres. El 2025 hi cau: 758
 * ajuntaments contra els 870 del 2023. Sense marcar-ho, la fitxa diria «el cost
 * ha baixat» quan el que passa és que encara falten cent ajuntaments per retre
 * comptes.
 */
const COBERTURA_MINIMA = 0.9;

/**
 * A partir d'aquí, la xifra per habitant es marca per mirar-la. No s'esborra:
 * en un poble de quaranta habitants un sol sou legal ja dispara la proporció, i
 * apartar-lo seria amagar una dada bona. La mediana catalana és de 23,4 €.
 */
const PER_HABITANT_SOSPITOS = 1_000;

// ─────────────────────────────────────────────────────────────────────────────
// Funcions pures: números
// ─────────────────────────────────────────────────────────────────────────────

const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Cost per habitant, a cèntims. `null` quan no sabem quanta gent hi viu. */
export function perHabitant(total: number | null, habitants: number | null): number | null {
  if (total === null || habitants === null || habitants <= 0) return null;
  return Math.round((100 * total) / habitants) / 100;
}

/**
 * Cost per regidoria del ple: el total dividit pels escons que li toquen al
 * municipi per població.
 *
 * **No és el que cobra cap regidor.** La majoria de plens tenen només una part
 * dels seus membres amb dedicació, i els que no en tenen cobren per assistència
 * o no cobren res. Serveix per comparar municipis de mides diferents amb la
 * mateixa vara, i la fitxa ho ha de dir amb aquestes paraules.
 */
export function perRegidoria(total: number | null, regidories: number | null): number | null {
  if (total === null || regidories === null || regidories <= 0) return null;
  return Math.round(total / regidories);
}

/**
 * L'import en euros que hi ha dins d'un text, o `null` si no n'hi ha cap.
 *
 * Els separadors no són consistents ni dins d'una mateixa font: Rubí escriu
 * «17.027,7 €» i la Diputació de Lleida, «82.081.76 €» —punt de milers i punt
 * decimal alhora. Les regles, en aquest ordre:
 *
 *   · Amb punt i coma, el punt és de milers i la coma és decimal.
 *   · Només amb coma: si darrere n'hi ha una o dues xifres és decimal.
 *   · Només amb punts: si n'hi ha més d'un, l'últim és el decimal (és el cas de
 *     Lleida); si només n'hi ha un i darrere hi ha tres xifres, és de milers.
 *
 * Si el text no porta ni «€» ni «euros» no es llegeix res: «Retribució: 3» pot
 * ser un nombre de dedicacions i no un sou, i endevinar-ho aquí és car.
 */
export function importEnEuros(text: string): number | null {
  const net = text.replace(/ /g, " ");
  const match = net.match(/(\d[\d.,\s]*)\s*(?:€|euros\b|eur\b)/i);
  if (!match) return null;
  const cru = match[1]!.replace(/\s/g, "");
  if (!/\d/.test(cru)) return null;

  const puntsI = [...cru.matchAll(/\./g)].map((m) => m.index!);
  const comes = [...cru.matchAll(/,/g)].map((m) => m.index!);

  let net2: string;
  if (comes.length > 0 && puntsI.length > 0) {
    net2 = cru.replace(/\./g, "").replace(/,/g, ".");
  } else if (comes.length > 0) {
    const ultima = comes[comes.length - 1]!;
    const decimals = cru.length - ultima - 1;
    net2 = decimals <= 2 ? cru.replace(/,/g, ".") : cru.replace(/,/g, "");
  } else if (puntsI.length > 1) {
    // «82.081.76»: tots els punts són de milers menys l'últim.
    const ultim = puntsI[puntsI.length - 1]!;
    net2 = cru.slice(0, ultim).replace(/\./g, "") + "." + cru.slice(ultim + 1);
  } else if (puntsI.length === 1) {
    const decimals = cru.length - puntsI[0]! - 1;
    net2 = decimals === 3 ? cru.replace(/\./g, "") : cru;
  } else {
    net2 = cru;
  }

  const valor = Number(net2);
  return Number.isFinite(valor) ? Math.round(valor * 100) / 100 : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Funcions pures: aparellament de noms
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Índex per nom normalitzat que **descarta els noms repetits**.
 *
 * És la regla més important de tot el fitxer. Si un nom normalitzat apareix a
 * dues persones, no és que sàpiguem menys de la segona: és que no sabem res de
 * cap de les dues, i atribuir un segon càrrec —i encara més un sou— a qui no el
 * té és difamatori. Als 9.146 regidors de Catalunya hi ha un nom compartit per
 * dues persones; aquesta funció el deixa fora, i el mateix criteri val a l'altra
 * banda del creuament.
 */
export function indexUnic<T>(items: readonly T[], clau: (item: T) => string): {
  unics: Map<string, T>;
  ambigus: Map<string, T[]>;
} {
  const totes = new Map<string, T[]>();
  for (const item of items) {
    const k = clau(item);
    if (!k) continue;
    const list = totes.get(k) ?? [];
    list.push(item);
    totes.set(k, list);
  }
  const unics = new Map<string, T>();
  const ambigus = new Map<string, T[]>();
  for (const [k, list] of totes) {
    if (list.length === 1) unics.set(k, list[0]!);
    else ambigus.set(k, list);
  }
  return { unics, ambigus };
}

/**
 * Lliga cada càrrec supramunicipal amb el regidor municipal que és la mateixa
 * persona, i **només** quan el nom normalitzat identifica exactament una
 * persona a cada banda.
 *
 * Comprovat el 29-08-2026 contra les dues fonts: dels 51 electes que la
 * Diputació de Barcelona publica, 46 lliguen amb un únic regidor municipal i 5
 * no lliguen amb ningú. Els cinc són els que dues fonts oficials escriuen
 * diferent —«Ana M. Martínez Martínez» contra «ANA MARIA MARTÍNEZ MARTÍNEZ»,
 * «Filo» per Filomena, «Xesco» per Francesc, «Javi» per Javier, i un
 * «Marc Serra Soler» que a l'Ajuntament de Barcelona és «Marc Serra Solé». Són
 * gairebé segur les mateixes persones i **no es lliguen igualment**: quan dues
 * fonts oficials no coincideixen ni en el cognom, qui s'ha d'equivocar no som
 * nosaltres.
 */
export function creuaSegonsCarrecs<M extends { nom: string }, S extends { nom: string }>(
  municipals: readonly M[],
  supramunicipals: readonly S[],
): {
  lligams: { municipal: M; supramunicipal: S }[];
  ambigusMunicipals: string[];
  ambigusSupramunicipals: string[];
  senseParella: S[];
} {
  const clau = (x: { nom: string }): string => normalizePersonName(x.nom);
  const mun = indexUnic(municipals, clau);
  const sup = indexUnic(supramunicipals, clau);

  const lligams: { municipal: M; supramunicipal: S }[] = [];
  const senseParella: S[] = [];
  for (const [k, supra] of sup.unics) {
    const municipal = mun.unics.get(k);
    if (municipal) lligams.push({ municipal, supramunicipal: supra });
    else senseParella.push(supra);
  }
  return {
    lligams,
    ambigusMunicipals: [...mun.ambigus.keys()],
    ambigusSupramunicipals: [...sup.ambigus.keys()],
    senseParella,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Funcions pures: el camp de retribució de seu-e
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Què diu la fitxa d'una persona sobre el que cobra. **No en torna l'import**:
 * de les fitxes d'un ajuntament només se'n compta la resposta, mai la xifra.
 *
 *   · `xifra` — el camp hi és i porta un import. Inclou el 0,00 €: declarar
 *     zero és haver respost, i el recompte mesura qui respon.
 *   · `sense-xifra` — el camp hi és i diu alguna cosa que no és un import («No
 *     percep cap retribució per aquest càrrec»). També és una resposta.
 *   · `cap` — el camp no hi és. L'ajuntament no ho ha publicat.
 */
export type EstatRetribucio = "xifra" | "sense-xifra" | "cap";

/** Llegeix un paràgraf `<p class="carrec-…">` de la fitxa de seu-e. */
export function campFitxa(html: string, classe: string): string | null {
  const re = new RegExp(`<p class="${classe}">([\\s\\S]*?)</p>`, "i");
  const match = html.match(re);
  if (!match) return null;
  return textNet(match[1]!);
}

/**
 * El **valor** d'un camp, sense l'etiqueta.
 *
 * Cada paràgraf de la fitxa és `<strong>Dietes:</strong> <span>…</span>`, i
 * l'etiqueta hi és sempre encara que el camp estigui buit. Per saber si
 * l'ajuntament ha respost cal mirar només el que hi ha dins del `<span>`; amb
 * el paràgraf sencer, un camp buit semblaria omplert perquè el títol hi és.
 */
export function valorCamp(html: string, classe: string): string | null {
  const re = new RegExp(`<p class="${classe}">([\\s\\S]*?)</p>`, "i");
  const match = html.match(re);
  if (!match) return null;
  const span = match[1]!.match(/<span[^>]*>([\s\S]*?)<\/span>/i);
  if (span) return textNet(span[1]!);
  const darrer = match[1]!.split(/<\/strong>/i);
  return textNet(darrer[darrer.length - 1] ?? "");
}

/** El camp hi és i l'ajuntament hi ha escrit alguna cosa. */
export function campOmplert(html: string, classe: string): boolean {
  const valor = valorCamp(html, classe);
  return valor !== null && valor.length > 0;
}

export function estatRetribucio(html: string): EstatRetribucio {
  const text = valorCamp(html, "carrec-retribucio");
  if (text === null || text.length === 0) return "cap";
  return importEnEuros(text) === null ? "sense-xifra" : "xifra";
}

/**
 * Si l'ajuntament publica la declaració de béns i activitats d'aquesta persona.
 *
 * **No se'n baixa el document, i no se'n baixarà.** L'enllaç de descàrrega de
 * seu-e va per paràmetre (`?p_p_id=gruppolitic_WAR_…`) i el `robots.txt` del
 * portal prohibeix expressament `/*?*p_p_id=`. El que sí que podem saber, i
 * dir, és si existeix: la fitxa `veureCarrec` s'hi arriba per ruta i és
 * pública. Amb això la nostra fitxa pot dir «l'ajuntament en publica la
 * declaració de béns» i enviar qui vulgui a la pàgina oficial a llegir-la, o
 * dir que no en publica cap —que informa exactament igual.
 */
export function publicaDeclaracioBens(html: string): boolean {
  return /class="carrec-declaracio-activitats-bens"/i.test(html);
}

/** La fitxa marca aquesta persona com a alcalde o alcaldessa. */
export function esAlcaldiaSegonsFitxa(html: string): boolean {
  return /class="carrec-isAlcalde"/i.test(html);
}

/**
 * Si la fitxa declara cobrar d'alguna altra administració. És el camp que a
 * Rubí destapa els 90.940,08 € de la Diputació, i el que la fitxa d'un
 * ajuntament pot amagar sense mentir del tot: se'n compta l'existència perquè
 * un consistori on ningú no declara res d'una altra banda no és el mateix que
 * un on ho declaren tots.
 */
export function declaraAltresRetribucions(html: string): boolean {
  const text = valorCamp(html, "carrec-altresRetribucions");
  return text !== null && importEnEuros(text) !== null;
}

/**
 * Què en publica l'ajuntament, d'una persona. **Cap import de cap dels camps.**
 *
 * De les dietes i les indemnitzacions només se'n desa si el camp està omplert,
 * pel mateix motiu que de la retribució: són text lliure i «400 €» tant hi pot
 * voler dir el que cobra per una sessió com el que cobra en tot l'any. S'ha
 * comprovat que 34 de 285 valors d'aquest camp són una dieta per sessió
 * escrita com si fos el sou anual, o sigui que llegir-los com a import és
 * publicar una xifra falsa d'una de cada vuit persones.
 */
export type EstatCarrec = {
  nom: string;
  /** Fitxa oficial a seu-e, per poder-hi enviar qui vulgui comprovar-ho. */
  fitxa: string | null;
  /** `null` quan la fitxa no s'ha pogut llegir; no és el mateix que no publicar. */
  retribucio: EstatRetribucio | null;
  altresRetribucions: boolean;
  dietes: boolean;
  indemnitzacions: boolean;
  declaracioBens: boolean;
  alcaldia: boolean;
};

/** Llegeix una fitxa `veureCarrec` sencera sense endur-se'n cap euro. */
export function llegeixFitxaCarrec(nom: string, fitxa: string | null, html: string): EstatCarrec {
  return {
    nom,
    fitxa,
    retribucio: estatRetribucio(html),
    altresRetribucions: declaraAltresRetribucions(html),
    dietes: campOmplert(html, "carrec-dietes"),
    indemnitzacions: campOmplert(html, "carrec-indemnitzacionsAnuals"),
    declaracioBens: publicaDeclaracioBens(html),
    alcaldia: esAlcaldiaSegonsFitxa(html),
  };
}

export type ResumRetribucions = {
  total: number;
  ambXifra: number;
  senseXifra: number;
  senseCamp: number;
  senseFitxa: number;
  ambAltresRetribucions: number;
  ambDietes: number;
  ambIndemnitzacions: number;
  ambDeclaracioBens: number;
  /** `tots` · `alguns` · `cap`, sobre els càrrecs que hem pogut mirar. */
  publica: "tots" | "alguns" | "cap";
  /** El mateix per a la declaració de béns, que és l'altra cosa que separa. */
  publicaBens: "tots" | "alguns" | "cap";
};

export function resumRetribucions(estats: readonly EstatCarrec[]): ResumRetribucions {
  const mirats = estats.filter((e) => e.retribucio !== null);
  const ambXifra = mirats.filter((e) => e.retribucio === "xifra").length;
  const ambBens = mirats.filter((e) => e.declaracioBens).length;
  const tramat = (quants: number): "tots" | "alguns" | "cap" =>
    quants === 0 ? "cap" : quants === mirats.length && mirats.length > 0 ? "tots" : "alguns";
  return {
    total: estats.length,
    ambXifra,
    senseXifra: mirats.filter((e) => e.retribucio === "sense-xifra").length,
    senseCamp: mirats.filter((e) => e.retribucio === "cap").length,
    senseFitxa: estats.length - mirats.length,
    ambAltresRetribucions: estats.filter((e) => e.altresRetribucions).length,
    ambDietes: estats.filter((e) => e.dietes).length,
    ambIndemnitzacions: estats.filter((e) => e.indemnitzacions).length,
    ambDeclaracioBens: ambBens,
    publica: tramat(ambXifra),
    publicaBens: tramat(ambBens),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Funcions pures: els ens que paguen el segon càrrec
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Candidats de slug de seu-e per a un consell comarcal o una diputació.
 *
 * El portal no fa servir el nom sencer sinó una abreviatura: «Consell Comarcal
 * del Baix Camp» és `ccbaixcamp` i la Diputació de Lleida és `diputaciolleida`.
 * Comprovat el 29-08-2026 contra els 40 consells comarcals del conjunt de
 * plens: 39 responen amb aquesta regla i només el del Baix Penedès no hi és.
 *
 * Dos d'aquests slugs —Baix Ebre i Garrotxa— responen **200 amb una pantalla
 * d'inici de sessió**, i per això el slug no es dona mai per bo sense comprovar
 * que el `<title>` és el de l'ens que buscàvem.
 */
export function slugsSupramunicipals(nomEns: string): string[] {
  const sencer = normalize(nomEns);
  const out: string[] = [];

  const comarcal = sencer.match(/^consell comarcal (?:de l |de la |de les |del |dels |de |d )?(.*)$/);
  if (comarcal) {
    const cos = comarcal[1]!.replace(/[\s-]/g, "");
    out.push(`cc${cos}`, `consellcomarcal${cos}`);
  }
  const diputacio = sencer.match(/^diputacio (?:de |d )?(.*)$/);
  if (diputacio) {
    const cos = diputacio[1]!.replace(/[\s-]/g, "");
    out.push(`diputacio${cos}`, `dip${cos}`);
  }
  out.push(sencer.replace(/[\s-]/g, ""));
  return [...new Set(out.filter((s) => s.length > 2))];
}

/**
 * Si un càrrec municipal és l'alcaldia.
 *
 * És la dada d'aquest bloc que més es buscarà —«el meu alcalde, cobra d'algun
 * altre lloc?»— i per això va marcada persona per persona i surt a part dins de
 * la mètrica, en comptes d'haver-la d'anar a pescar de la llista. El conjunt de
 * plens escriu «Alcalde President» i «Alcaldessa Presidenta».
 */
export function esAlcaldia(carrec: string): boolean {
  return /^alcald/.test(normalize(carrec));
}

/** Tipus d'ens tal com el diu la fitxa, a partir del `tipus_ens` del conjunt. */
export function tipusDens(tipusEns: string, nomEns: string): string {
  if (/^Diputaci/i.test(nomEns)) return "diputació";
  if (/^Consell Comarcal/i.test(nomEns)) return "consell comarcal";
  return tipusEns.toLowerCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// Funcions pures: la pàgina de retribucions de la Diputació de Barcelona
// ─────────────────────────────────────────────────────────────────────────────

const ENTITATS: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ordf: "ª", ordm: "º", deg: "°", middot: "·", hellip: "…",
  ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (tot, cos: string) => {
    if (cos.startsWith("#")) {
      const codi = cos[1] === "x" || cos[1] === "X"
        ? Number.parseInt(cos.slice(2), 16)
        : Number.parseInt(cos.slice(1), 10);
      return Number.isFinite(codi) ? String.fromCodePoint(codi) : tot;
    }
    return ENTITATS[cos.toLowerCase()] ?? tot;
  });
}

/** Text visible d'un fragment de HTML, amb els espais col·lapsats. */
export function textNet(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Les taules d'una pàgina, cada cel·la amb el HTML de dins encara sencer. */
export function taulesHtml(html: string): string[][][] {
  return [...html.matchAll(/<table[\s\S]*?<\/table>/gi)].map((taula) =>
    [...taula[0]!.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((fila) =>
      [...fila[0]!.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cel) => cel[1]!),
    ),
  );
}

/** Una llista de noms dins d'una cel·la: van separats per `<br>`, no per comes. */
export function nomsDeCella(cella: string): { nom: string; percentatge: number | null }[] {
  return cella
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .split("\n")
    .map((linia) => textNet(linia))
    .filter((linia) => /[a-zàéèíóòúüïçñ]/i.test(linia))
    .map((linia) => {
      const pct = linia.match(/\((\d{1,3})\s*%\)/);
      return {
        nom: linia.replace(/\s*\(\d{1,3}\s*%\)\s*/g, " ").replace(/\s+/g, " ").trim(),
        percentatge: pct ? Number(pct[1]) : null,
      };
    })
    .filter((e) => e.nom.length > 3);
}

/** Mensualitats que paga la Diputació de Barcelona; ho diu la seva pàgina. */
export const MENSUALITATS_DIBA = 14;

export type TarifaDiba = { percentatge: number | null; mensual: number };
export type ElecteDiba = {
  nom: string;
  codi: string;
  percentatge: number | null;
  carrec: string;
  /** Dedicació exclusiva (A1-A3) o parcial (A4-A5), segons la seva pàgina. */
  dedicacio: "exclusiva" | "parcial";
};

export type RetribucionsDiba = {
  tarifes: Map<string, TarifaDiba[]>;
  electes: ElecteDiba[];
  /** Els que no tenen sou fix i cobren per anar a les sessions. */
  perAssistencia: { nom: string; carrec: string }[];
  assistencies: { ple: number | null; comissio: number | null; maximComissionsMes: number | null };
  anyTarifa: number | null;
};

/**
 * Llegeix la pàgina de retribucions de la Diputació de Barcelona.
 *
 * La pàgina no publica cap import al costat de cap nom: publica un **codi
 * retributiu** (A1…A5) per persona i, a part, la taula que converteix el codi
 * en euros bruts mensuals. Aquesta separació és la que fa que valgui la pena
 * llegir-la amb codi i no a ull: la conversió és aritmètica i verificable, i
 * quadra a l'euro amb el que declara la fitxa de seu-e de qui cobra
 * (A3 = 6.495,72 × 14 = 90.940,08 €, exactament el que consta a Rubí).
 *
 * Els electes amb dedicació parcial porten el percentatge entre parèntesis
 * darrere del nom, i la taula dona una tarifa per a cada percentatge.
 */
export function parseRetribucionsDiba(html: string): RetribucionsDiba {
  const taules = taulesHtml(html);
  const tarifes = new Map<string, TarifaDiba[]>();
  const electes: ElecteDiba[] = [];
  const perAssistencia: { nom: string; carrec: string }[] = [];

  for (const taula of taules) {
    const capcalera = (taula[0] ?? []).map((c) => normalize(textNet(c)));
    const esTarifes = capcalera.some((c) => c.includes("retribucio bruta"));
    const teCodi = capcalera.some((c) => c.includes("codi retributiu"));
    const teElectes = capcalera.some((c) => c.includes("electes"));

    for (const fila of taula.slice(1)) {
      if (esTarifes && fila.length >= 2) {
        const codi = textNet(fila[0]!).toUpperCase().trim();
        if (!/^A\d$/.test(codi)) continue;
        // Una cel·la pot dur tres tarifes, una per percentatge de dedicació.
        const variants = fila[1]!
          .replace(/<\/p>/gi, "\n")
          .replace(/<br\s*\/?>/gi, "\n")
          .split("\n")
          .map((l) => textNet(l))
          .filter((l) => /\d/.test(l))
          .map((l) => {
            const pct = l.match(/\((\d{1,3})\s*%\)/);
            return { percentatge: pct ? Number(pct[1]) : null, mensual: importEnEuros(l) };
          })
          .filter((v): v is TarifaDiba => v.mensual !== null);
        if (variants.length > 0) tarifes.set(codi, variants);
        continue;
      }

      if (!teElectes) continue;
      const carrec = textNet(fila[0] ?? "");
      const codi = fila.length >= 3 ? textNet(fila[2]!).toUpperCase().trim() : "";
      const noms = nomsDeCella(fila[1] ?? "");
      if (teCodi && /^A\d$/.test(codi)) {
        for (const { nom, percentatge } of noms) {
          electes.push({
            nom,
            codi,
            percentatge,
            carrec,
            // A1-A3 són les taules de dedicació exclusiva i A4-A5 les de
            // parcial; ho diu la mateixa pàgina damunt de cada taula.
            dedicacio: codi <= "A3" ? "exclusiva" : "parcial",
          });
        }
      } else if (!teCodi) {
        // La taula sense codi retributiu és la dels que només cobren per anar a
        // les sessions: no tenen sou anual i no se'n pot publicar cap.
        for (const { nom } of noms) perAssistencia.push({ nom, carrec });
      }
    }
  }

  const text = textNet(html);
  const ple = text.match(/sessions del Ple:\s*([\d.,]+\s*€)/i);
  const comissio = text.match(/Comissi[^:]*Especial de Comptes:\s*([\d.,]+\s*€)/i);
  const maxim = text.match(/com a m[àa]xim de (dues|dos|\d+) al mes/i);
  const anyTarifa = text.match(/Taula retributiva[^.]{0,80}?any\s+(\d{4})/i);

  return {
    tarifes,
    electes,
    perAssistencia,
    assistencies: {
      ple: ple ? importEnEuros(ple[1]!) : null,
      comissio: comissio ? importEnEuros(comissio[1]!) : null,
      maximComissionsMes: maxim ? (/^\d+$/.test(maxim[1]!) ? Number(maxim[1]) : 2) : null,
    },
    anyTarifa: anyTarifa ? Number(anyTarifa[1]) : null,
  };
}

/**
 * Els euros bruts a l'any d'un electe de la Diputació de Barcelona.
 *
 * Torna `null` sempre que la conversió no sigui inequívoca: un codi que no és a
 * la taula, o un codi amb tarifes per percentatge quan el nom no en porta cap.
 * Val més no dir res que dir un sou aproximat de ningú.
 */
export function retribucioAnualDiba(
  electe: { codi: string; percentatge: number | null },
  tarifes: Map<string, TarifaDiba[]>,
): number | null {
  const variants = tarifes.get(electe.codi);
  if (!variants || variants.length === 0) return null;
  const tria =
    variants.length === 1 && electe.percentatge === null
      ? variants[0]
      : variants.find((v) => v.percentatge === electe.percentatge);
  if (!tria) return null;
  return Math.round(tria.mensual * MENSUALITATS_DIBA * 100) / 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilitats d'execució
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Quatre peticions alhora. seu-e i diba.cat aguanten molt més, però són serveis
 * públics i aquí s'hi fan més de deu mil crides: no és lloc per anar de pressa.
 */
const PARALEL = 4;

/** Si el servidor falla de manera sostinguda, val més plegar que insistir-hi. */
const ERRORS_SEGUITS_MAXIM = 25;

async function enParallel<T>(items: readonly T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let seguent = 0;
  const obrers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (seguent < items.length) {
      const i = seguent;
      seguent += 1;
      await fn(items[i]!);
    }
  });
  await Promise.all(obrers);
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

const avui = (): string => new Date().toISOString().slice(0, 10);

const arrodoneix = (v: number | null): number | null => (v === null ? null : Math.round(v * 100) / 100);

export type OpcionsJ14 = {
  /** Salta el bloc de seu-e, que és el que dura una hora llarga. */
  senseSeue?: boolean;
  /** Limita quants municipis es miren a seu-e; per a proves. */
  maxMunicipis?: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// La feina
// ─────────────────────────────────────────────────────────────────────────────

export async function j14ElectesCost(db: Db, options: OpcionsJ14 = {}): Promise<void> {
  await j14CostOrgans(db);
  if (options.senseSeue) return;
  await j14QuiPublicaQueCobra(db, options);
  await j14CarrecsAcumulats(db);
}

// ── 1. El cost dels òrgans de govern ────────────────────────────────────────

type FilaLiquidacio = {
  any_exercici: string;
  codi_ens: string;
  estructura: string;
  import_dret_oblig: string;
};

export async function j14CostOrgans(db: Db): Promise<void> {
  await withRun(db, "J14 cost dels òrgans de govern", async (run) => {
    const munis = await db.select().from(municipalities);
    const perCodiEns = new Map<string, number>();
    const poblacioVigent = new Map<number, number>();
    const regidories = new Map<number, number>();
    for (const m of munis) {
      perCodiEns.set(m.codiEns, m.id);
      if (m.population) poblacioVigent.set(m.id, m.population);
      if (m.councilSeats) regidories.set(m.id, m.councilSeats);
    }
    // El `codi_ens` de la província de Barcelona comença per zero i Socrata el
    // torna com a text: si algun dia arriba com a número, el zero es perdria i
    // 311 municipis quedarien orfes sense que ho digués res.
    const resol = (codi: unknown): number | undefined => perCodiEns.get(String(codi).padStart(10, "0"));

    /**
     * Padró de cada exercici. El cost per habitant del 2019 s'ha de dividir per
     * la gent que hi vivia el 2019: si no, un poble que ha crescut sembla que
     * hagi abaratit els seus càrrecs sense haver-hi tocat res. Surt de
     * `municipal_finances`, que omple J6.
     */
    const poblacioPerAny = new Map<number, Map<number, number>>();
    for (const fila of await db
      .select({
        municipalityId: municipalFinances.municipalityId,
        year: municipalFinances.year,
        population: municipalFinances.population,
      })
      .from(municipalFinances)) {
      if (!fila.population) continue;
      const delAny = poblacioPerAny.get(fila.year) ?? new Map<number, number>();
      delAny.set(fila.municipalityId, fila.population);
      poblacioPerAny.set(fila.year, delAny);
    }
    const gentA = (municipalityId: number, any: number): number | null =>
      poblacioPerAny.get(any)?.get(municipalityId) ?? poblacioVigent.get(municipalityId) ?? null;

    const anysRows = await socrataAll<{ any_exercici: string }>(LIQUIDACIO, {
      select: "any_exercici",
      group: "any_exercici",
      order: "any_exercici",
      where: `tipus_classif='E' and tipus_partida='D' and estructura='1000'`,
    });
    const anys = anysRows
      .map((r) => Number(r.any_exercici))
      .filter((a) => Number.isFinite(a) && a >= PRIMER_EXERCICI)
      .sort((a, b) => a - b);
    if (anys.length === 0) {
      await run.issue({ kind: "liquidacio_sense_exercicis", severity: "alta", entity: LIQUIDACIO });
      return { municipis: 0 };
    }
    run.say(`exercicis ${anys[0]}-${anys[anys.length - 1]}`);

    const estructures = CONCEPTES.map((c) => `'${c.estructura}'`).join(",");
    const files = await socrataAll<FilaLiquidacio>(LIQUIDACIO, {
      select: "any_exercici,codi_ens,estructura,import_dret_oblig",
      where:
        `tipus_classif='E' and tipus_partida='D' and estructura in(${estructures})` +
        ` and any_exercici>='${anys[0]}' and starts_with(nom_complert,'Ajuntament')`,
      // Sense ordre explícit, `socrataAll` pagina per `:id`, que és l'únic camp
      // únic del conjunt: ordenar per `codi_ens` —que es repeteix per any i per
      // concepte— pot fer que la paginació salti o repeteixi files.
    });
    run.rowsIn = files.length;

    /** municipi → any → concepte → euros liquidats. */
    const totals = new Map<number, Map<number, Partial<Record<ClauConcepte, number>>>>();
    const perEstructura = new Map<string, ClauConcepte>(
      CONCEPTES.map((c) => [c.estructura, c.clau] as const),
    );
    const cobertura = new Map<number, Set<number>>();

    for (const fila of files) {
      const municipalityId = resol(fila.codi_ens);
      if (!municipalityId) continue;
      const any = Number(fila.any_exercici);
      const clau = perEstructura.get(String(fila.estructura));
      if (!clau || !Number.isFinite(any) || any < PRIMER_EXERCICI) continue;
      const total = num(fila.import_dret_oblig);
      // Un import negatiu és una devolució o una correcció comptable; com a
      // «què costa» no vol dir res, i publicar-lo com a cost seria fals.
      if (total < 0) {
        await run.issue({
          kind: "cost_organs_negatiu",
          severity: "baixa",
          municipalityId,
          detail: { any, concepte: clau, import: total },
        });
        continue;
      }
      const perAny = totals.get(municipalityId) ?? new Map();
      const bucket = perAny.get(any) ?? {};
      bucket[clau] = total;
      perAny.set(any, bucket);
      totals.set(municipalityId, perAny);
      if (clau === "organs") {
        const set = cobertura.get(any) ?? new Set<number>();
        set.add(municipalityId);
        cobertura.set(any, set);
      }
    }

    // Exercicis encara oberts: els que cobreixen molt menys país que el millor.
    const maxCobertura = Math.max(...[...cobertura.values()].map((s) => s.size), 0);
    const parcials = new Set<number>();
    for (const any of anys) {
      const quants = cobertura.get(any)?.size ?? 0;
      if (maxCobertura > 0 && quants < maxCobertura * COBERTURA_MINIMA) {
        parcials.add(any);
        await run.issue({
          kind: "exercici_incomplet",
          severity: "mitjana",
          detail: {
            any,
            ajuntaments: quants,
            millorAny: maxCobertura,
            efecte: "aquest exercici no es pot comparar amb els altres: encara s'està liquidant",
          },
        });
      }
      run.say(`${any}: ${quants} ajuntaments${parcials.has(any) ? " (incomplet)" : ""}`);
    }

    const darrerComplet = [...anys].reverse().find((a) => !parcials.has(a)) ?? anys[anys.length - 1]!;

    type AnyDesat = {
      any: number;
      parcial: boolean;
      habitants: number | null;
      regidories: number | null;
      organs: { total: number; perHabitant: number | null; perRegidoria: number | null } | null;
      dietes: { total: number; perHabitant: number | null } | null;
      indemnitzacions: { total: number; perHabitant: number | null } | null;
      sospitos: boolean;
    };

    const series = new Map<number, AnyDesat[]>();
    for (const [municipalityId, perAny] of totals) {
      const seients = regidories.get(municipalityId) ?? null;
      const serie: AnyDesat[] = [];
      for (const any of anys) {
        const bucket = perAny.get(any);
        if (!bucket) continue;
        const habitants = gentA(municipalityId, any);
        const organs = bucket.organs ?? null;
        const perHab = perHabitant(organs, habitants);
        const sospitos = perHab !== null && perHab > PER_HABITANT_SOSPITOS;
        if (sospitos) {
          await run.issue({
            kind: "cost_organs_implausible",
            severity: "baixa",
            municipalityId,
            detail: { any, import: organs, habitants, perHabitant: perHab },
          });
        }
        serie.push({
          any,
          parcial: parcials.has(any),
          habitants,
          regidories: seients,
          organs:
            organs === null
              ? null
              : { total: Math.round(organs), perHabitant: perHab, perRegidoria: perRegidoria(organs, seients) },
          dietes:
            bucket.dietes === undefined
              ? null
              : { total: Math.round(bucket.dietes), perHabitant: perHabitant(bucket.dietes, habitants) },
          indemnitzacions:
            bucket.indemnitzacions === undefined
              ? null
              : {
                  total: Math.round(bucket.indemnitzacions),
                  perHabitant: perHabitant(bucket.indemnitzacions, habitants),
                },
          sospitos,
        });
      }
      if (serie.length > 0) series.set(municipalityId, serie);
    }

    // Medianes de l'últim exercici complet: una xifra per habitant tota sola no
    // diu res, i la mediana catalana barreja Barcelona amb un poble de tres-cents.
    const delDarrer = (municipalityId: number): AnyDesat | undefined =>
      series.get(municipalityId)?.find((a) => a.any === darrerComplet);

    const grups = buildPeerGroups(munis.map((m) => ({ id: m.id, population: m.population })));
    const membres = new Map<string, number[]>();
    for (const [id, grup] of grups) {
      const list = membres.get(grup.key) ?? [];
      list.push(id);
      membres.set(grup.key, list);
    }
    const valors = (ids: Iterable<number>, camp: "perHabitant" | "perRegidoria"): number[] =>
      [...ids]
        .map((id) => delDarrer(id)?.organs?.[camp])
        .filter((v): v is number => v !== null && v !== undefined && v > 0);

    const medianes = {
      perHabitant: arrodoneix(medianOf(valors(series.keys(), "perHabitant"))),
      perRegidoria: arrodoneix(medianOf(valors(series.keys(), "perRegidoria"))),
    };
    const medianesGrup = new Map<string, typeof medianes>();
    for (const [clau, ids] of membres) {
      medianesGrup.set(clau, {
        perHabitant: arrodoneix(medianOf(valors(ids, "perHabitant"))),
        perRegidoria: arrodoneix(medianOf(valors(ids, "perRegidoria"))),
      });
    }

    for (const [municipalityId, serie] of series) {
      const grup = grups.get(municipalityId) ?? null;
      // El canvi del mandat: el primer exercici del mandat contra l'últim
      // complet. És l'única comparació que atribueix el cost a qui governa ara.
      const delMandat = serie.filter((a) => a.any >= INICI_MANDAT && !a.parcial && a.organs !== null);
      const primer = delMandat[0];
      const ultim = delMandat[delMandat.length - 1];
      const mandat =
        primer && ultim && primer.any !== ultim.any && primer.organs!.total > 0
          ? {
              de: primer.any,
              a: ultim.any,
              deTotal: primer.organs!.total,
              aTotal: ultim.organs!.total,
              canviPct: Math.round((1000 * (ultim.organs!.total - primer.organs!.total)) / primer.organs!.total) / 10,
            }
          : null;

      await desa(db, municipalityId, "costGovern", {
        serie,
        darrerAnyComplet: darrerComplet,
        darrer: serie.find((a) => a.any === darrerComplet) ?? null,
        mandat,
        medianes,
        grup: grup
          ? {
              etiqueta: grup.label,
              mida: grup.size,
              ambDada: (membres.get(grup.key) ?? []).filter((id) => delDarrer(id)?.organs).length,
            }
          : null,
        medianesGrup: grup ? medianesGrup.get(grup.key) ?? null : null,
        conceptes: CONCEPTES,
        font: {
          nom: "Liquidació del pressupost, econòmic i per programes (Generalitat de Catalunya)",
          dataset: LIQUIDACIO,
          exercicis: `${anys[0]}-${anys[anys.length - 1]}`,
          consultat: avui(),
        },
        advertiment:
          "Euros corrents, sense descomptar la inflació. «Per regidoria» és el total del municipi dividit " +
          "pels escons del ple, no el que cobra cap regidor: en la majoria de plens només una part dels " +
          "membres té dedicació. Les dietes i les indemnitzacions de l'article 23 inclouen el personal i " +
          "no només els electes, i no se sumen mai amb les retribucions dels òrgans de govern.",
      });
      run.rowsOut += 1;
    }

    run.say(`${run.rowsOut} municipis amb cost dels òrgans de govern`);
    run.say(`mediana catalana del ${darrerComplet}: ${medianes.perHabitant} €/habitant`);
    return {
      municipis: run.rowsOut,
      exercicis: anys,
      darrerComplet,
      parcials: [...parcials],
      medianes,
    };
  });
}

// ── 2. Qui publica què cobra i qui no ───────────────────────────────────────

type CarrecsDesats = { slug?: string; carrecs?: { nom?: string; fitxa?: string | null }[] };

export async function j14QuiPublicaQueCobra(db: Db, options: OpcionsJ14 = {}): Promise<void> {
  await withRun(db, "J14 qui publica què cobra", async (run) => {
    const munis = await db
      .select({ id: municipalities.id, name: municipalities.name })
      .from(municipalities);
    const llista = options.maxMunicipis ? munis.slice(0, options.maxMunicipis) : munis;
    run.rowsIn = llista.length;

    /*
     * J11 ja ha visitat aquestes pàgines per a les fotos i n'ha desat el slug i
     * l'enllaç de cada fitxa. Reaprofitar-ho estalvia 947 peticions de
     * descobriment a un servei públic; si J11 no ha passat, es descobreix aquí.
     */
    const jaVisitat = new Map<number, CarrecsDesats>();
    for (const fila of await db
      .select({ municipalityId: municipalityMetrics.municipalityId, data: municipalityMetrics.data })
      .from(municipalityMetrics)
      .where(eq(municipalityMetrics.kind, "carrecs"))) {
      const data = fila.data as CarrecsDesats & { slug?: string };
      if (data && typeof data === "object" && Array.isArray(data.carrecs) && data.slug) {
        jaVisitat.set(fila.municipalityId, data);
      }
    }
    run.say(`${jaVisitat.size} municipis amb les fitxes ja localitzades per J11`);

    const consultat = avui();
    let errorsSeguits = 0;
    let aturat = false;
    const comptador = { senseSlug: 0, senseModul: 0, fitxes: 0, errors: 0, publiquenTots: 0, publiquenCap: 0 };
    const globalPerEstat = {
      total: 0, ambXifra: 0, senseXifra: 0, senseCamp: 0, senseFitxa: 0,
      ambAltres: 0, ambDietes: 0, ambIndemnitzacions: 0, ambDeclaracioBens: 0,
    };

    await enParallel(llista, PARALEL, async (muni) => {
      if (aturat) return;
      try {
        let slug: string | null = null;
        let carrecs: { nom: string; fitxa: string | null }[] = [];

        const desat = jaVisitat.get(muni.id);
        if (desat?.slug && desat.carrecs) {
          slug = desat.slug;
          carrecs = desat.carrecs.map((c) => ({ nom: String(c.nom ?? ""), fitxa: c.fitxa ?? null }));
        } else {
          const trobat = await findSlugDetall(muni.name);
          if (!trobat) {
            comptador.senseSlug += 1;
            errorsSeguits = 0;
            return;
          }
          slug = trobat.slug;
          if (!trobat.teCarrecs) {
            comptador.senseModul += 1;
            errorsSeguits = 0;
            return;
          }
          carrecs = parseCarrecs(trobat.html).map((c: Carrec) => ({ nom: c.nom, fitxa: c.fitxa }));
        }

        if (carrecs.length === 0) {
          comptador.senseModul += 1;
          errorsSeguits = 0;
          return;
        }

        const estats: EstatCarrec[] = [];
        for (const carrec of carrecs) {
          const buida: EstatCarrec = {
            nom: carrec.nom,
            fitxa: carrec.fitxa,
            retribucio: null,
            altresRetribucions: false,
            dietes: false,
            indemnitzacions: false,
            declaracioBens: false,
            alcaldia: false,
          };
          if (!carrec.fitxa) {
            estats.push(buida);
            continue;
          }
          // El `robots.txt` de seu-e prohibeix les URL amb `p_auth`; a més el
          // token caduca. `senseTokenAuth` el treu, i sense ell la pàgina
          // respon exactament igual.
          const { status, html } = await fetchText(senseTokenAuth(carrec.fitxa));
          comptador.fitxes += 1;
          if (status !== 200 || !html) {
            estats.push(buida);
            continue;
          }
          estats.push(llegeixFitxaCarrec(carrec.nom, senseTokenAuth(carrec.fitxa), html));
        }

        const resum = resumRetribucions(estats);
        globalPerEstat.total += resum.total;
        globalPerEstat.ambXifra += resum.ambXifra;
        globalPerEstat.senseXifra += resum.senseXifra;
        globalPerEstat.senseCamp += resum.senseCamp;
        globalPerEstat.senseFitxa += resum.senseFitxa;
        globalPerEstat.ambAltres += resum.ambAltresRetribucions;
        globalPerEstat.ambDietes += resum.ambDietes;
        globalPerEstat.ambIndemnitzacions += resum.ambIndemnitzacions;
        globalPerEstat.ambDeclaracioBens += resum.ambDeclaracioBens;
        if (resum.publica === "tots") comptador.publiquenTots += 1;
        if (resum.publica === "cap") comptador.publiquenCap += 1;

        await desa(db, muni.id, "transparenciaRetribucions", {
          ...resum,
          // Un booleà per persona, mai un euro: és el que permet que la fitxa
          // de cadascú digui «l'ajuntament en publica la declaració de béns»
          // amb l'enllaç a la pàgina oficial, o que no en publica cap.
          carrecs: estats,
          font: "seu-e.cat (Consorci AOC), mòdul de càrrecs electes",
          url: urlCarrecs(slug!),
          slug,
          consultat,
          advertiment:
            "D'aquests camps només se'n compta la resposta, mai l'import. La xifra que hi publica un " +
            "ajuntament sol ser només la part que paga ell: a Rubí, l'alcaldessa hi consta amb " +
            "17.027,70 € quan cobra 90.940,08 € més de la Diputació de Barcelona. Una xifra baixa " +
            "exculpa, i publicar-la faria més mal que no publicar-ne cap. La declaració de béns no " +
            "se'n descarrega: el robots.txt de seu-e prohibeix l'enllaç del document, i aquí només " +
            "es diu si existeix, amb l'enllaç a la fitxa oficial per a qui la vulgui llegir.",
        });
        run.rowsOut += 1;
        errorsSeguits = 0;
      } catch (error) {
        errorsSeguits += 1;
        comptador.errors += 1;
        await run.issue({
          kind: "seue_retribucions_error",
          severity: "baixa",
          municipalityId: muni.id,
          detail: { nom: muni.name, error: String(error) },
        });
        if (errorsSeguits >= ERRORS_SEGUITS_MAXIM) {
          aturat = true;
          run.say(`${errorsSeguits} errors seguits: s'atura per no insistir-hi`);
        }
      }
    });

    run.say(`${run.rowsOut} municipis mirats · ${comptador.fitxes} fitxes de càrrec llegides`);
    run.say(`${comptador.publiquenTots} publiquen la xifra de tots els seus càrrecs, ${comptador.publiquenCap} de cap`);
    run.say(
      `càrrecs: ${globalPerEstat.ambXifra} amb xifra, ${globalPerEstat.senseXifra} amb resposta sense xifra, ` +
        `${globalPerEstat.senseCamp} sense el camp`,
    );
    run.say(`${globalPerEstat.ambAltres} càrrecs declaren cobrar també d'una altra administració`);
    run.say(
      `${globalPerEstat.ambDeclaracioBens} càrrecs amb la declaració de béns publicada · ` +
        `${globalPerEstat.ambDietes} amb el camp de dietes omplert · ` +
        `${globalPerEstat.ambIndemnitzacions} amb el d'indemnitzacions anuals`,
    );
    return { ...comptador, ...globalPerEstat, consultat, aturatPerErrors: aturat };
  });
}

// ── 3. Els càrrecs acumulats ────────────────────────────────────────────────

type FilaPle = {
  codi_10: string;
  nom_ens: string;
  tipus_ens: string;
  nom?: string;
  carrec?: string;
};

/** El que publica l'ens que paga el segon càrrec, persona per persona. */
type PublicaEns = {
  /** Nom normalitzat → import anual brut en euros, si l'ens el publica. */
  imports: Map<string, { anual: number | null; detall: string; dedicacio: string | null }>;
  publica: boolean;
  motiu: string | null;
  url: string;
  consultat: string;
};

export async function j14CarrecsAcumulats(db: Db): Promise<void> {
  await withRun(db, "J14 càrrecs acumulats", async (run) => {
    const perCodiEns = new Map<string, number>();
    for (const m of await db.select().from(municipalities)) perCodiEns.set(m.codiEns, m.id);
    const resol = (codi: unknown): number | undefined => perCodiEns.get(String(codi).padStart(10, "0"));

    const files = await socrataAll<FilaPle>(PLENS, {
      select: "codi_10,nom_ens,tipus_ens,nom,carrec",
    });
    run.rowsIn = files.length;

    const municipals = files.filter((f) => f.tipus_ens === "Municipis" && f.nom);
    /*
     * Només consells comarcals i diputacions. Les entitats metropolitanes i les
     * EMD són al conjunt però **no hi publiquen cap nom** (91 i 195 files, zero
     * noms), i sense nom no hi ha res a creuar.
     */
    const supramunicipals = files.filter(
      (f) => (f.tipus_ens === "Comarques" || f.tipus_ens === "Províncies") && f.nom,
    );
    run.say(`${municipals.length} regidors · ${supramunicipals.length} càrrecs supramunicipals amb nom`);

    const creuament = creuaSegonsCarrecs(
      municipals.map((f) => ({ ...f, nom: f.nom! })),
      supramunicipals.map((f) => ({ ...f, nom: f.nom! })),
    );
    for (const nom of creuament.ambigusSupramunicipals) {
      await run.issue({
        kind: "carrec_acumulat_ambigu",
        severity: "mitjana",
        entity: nom,
        detail: { efecte: "el nom no identifica una sola persona: no se li atribueix cap segon càrrec" },
      });
    }
    run.say(
      `${creuament.lligams.length} càrrecs supramunicipals lligats a un regidor · ` +
        `${creuament.ambigusSupramunicipals.length + creuament.ambigusMunicipals.length} noms ambigus descartats`,
    );

    // Els ens que apareixen com a segon càrrec: només d'aquests cal saber què
    // publiquen, i cadascun es visita una sola vegada.
    const ensNecessaris = new Map<string, { nomEns: string; tipusEns: string }>();
    for (const { supramunicipal } of creuament.lligams) {
      ensNecessaris.set(supramunicipal.nom_ens, {
        nomEns: supramunicipal.nom_ens,
        tipusEns: supramunicipal.tipus_ens,
      });
    }

    const publicat = new Map<string, PublicaEns>();
    for (const [nomEns, ens] of ensNecessaris) {
      publicat.set(nomEns, await retribucionsDelEns(ens.nomEns, run));
    }
    const publiquen = [...publicat.entries()].filter(([, p]) => p.publica).map(([n]) => n);
    const noPubliquen = [...publicat.entries()].filter(([, p]) => !p.publica).map(([n]) => n);
    run.say(`${publiquen.length} ens publiquen les retribucions dels seus electes, ${noPubliquen.length} no`);

    /*
     * La Diputació de Barcelona no posa cap nom al conjunt de plens (51 files,
     * zero noms) i per tant no pot entrar pel creuament de dalt. Hi entra per
     * la seva pròpia pàgina de retribucions, que sí que publica els noms: allà
     * el segon càrrec i l'import surten de la mateixa font, que és qui el paga.
     */
    const diba = await electesDiba(run);
    const municipalsIndex = indexUnic(
      municipals.map((f) => ({ ...f, nom: f.nom! })),
      (f) => normalizePersonName(f.nom),
    );

    type Altre = {
      ens: string;
      tipus: string;
      carrec: string;
      retribucio: {
        anualBrut: number | null;
        concepte: string;
        dedicacio: string | null;
        font: { nom: string; url: string; consultat: string };
      } | null;
      senseRetribucioPublicada: { motiu: string; font: { nom: string; url: string; consultat: string } } | null;
    };
    type Persona = { nom: string; carrecMunicipal: string; alcaldia: boolean; altres: Altre[] };
    const perMunicipi = new Map<number, Map<string, Persona>>();

    const afegeix = (municipalityId: number, nom: string, carrecMunicipal: string, altre: Altre): void => {
      const persones = perMunicipi.get(municipalityId) ?? new Map<string, Persona>();
      const clau = normalizePersonName(nom);
      const persona: Persona = persones.get(clau) ?? {
        nom: titleCase(nom),
        carrecMunicipal,
        alcaldia: esAlcaldia(carrecMunicipal),
        altres: [],
      };
      persona.altres.push(altre);
      persones.set(clau, persona);
      perMunicipi.set(municipalityId, persones);
    };

    for (const { municipal, supramunicipal } of creuament.lligams) {
      const municipalityId = resol(municipal.codi_10);
      if (!municipalityId) continue;
      const font = publicat.get(supramunicipal.nom_ens)!;
      const publicacio = font.imports.get(normalizePersonName(supramunicipal.nom));
      afegeix(municipalityId, municipal.nom, municipal.carrec ?? "Regidor", {
        ens: supramunicipal.nom_ens,
        tipus: tipusDens(supramunicipal.tipus_ens, supramunicipal.nom_ens),
        carrec: supramunicipal.carrec ?? "",
        retribucio:
          publicacio && publicacio.anual !== null
            ? {
                anualBrut: publicacio.anual,
                concepte: publicacio.detall,
                dedicacio: publicacio.dedicacio,
                font: { nom: supramunicipal.nom_ens, url: font.url, consultat: font.consultat },
              }
            : null,
        senseRetribucioPublicada:
          publicacio && publicacio.anual !== null
            ? null
            : {
                motiu: font.publica
                  ? `${supramunicipal.nom_ens} publica les retribucions dels seus electes, però no en consta cap per a aquesta persona`
                  : font.motiu ?? `${supramunicipal.nom_ens} no publica les retribucions dels seus electes`,
                font: { nom: supramunicipal.nom_ens, url: font.url, consultat: font.consultat },
              },
      });
    }

    let ambImport = 0;
    for (const electe of diba.electes) {
      const municipal = municipalsIndex.unics.get(normalizePersonName(electe.nom));
      if (!municipal) continue;
      const municipalityId = resol(municipal.codi_10);
      if (!municipalityId) continue;
      afegeix(municipalityId, municipal.nom, municipal.carrec ?? "Regidor", {
        ens: "Diputació de Barcelona",
        tipus: "diputació",
        carrec: electe.carrec,
        retribucio:
          electe.anual === null
            ? null
            : {
                anualBrut: electe.anual,
                concepte: `codi retributiu ${electe.codi}, ${MENSUALITATS_DIBA} mensualitats`,
                dedicacio: electe.dedicacio,
                font: { nom: "Diputació de Barcelona", url: URL_DIBA, consultat: diba.consultat },
              },
        senseRetribucioPublicada:
          electe.anual === null
            ? {
                motiu: electe.motiu ?? "la Diputació de Barcelona no en publica cap import per a aquesta persona",
                font: { nom: "Diputació de Barcelona", url: URL_DIBA, consultat: diba.consultat },
              }
            : null,
      });
    }

    /*
     * Les alcaldies, comptades a part. «El meu alcalde, cobra d'algun altre
     * lloc?» és la pregunta que es fa tothom d'aquest bloc, i haver-la de
     * pescar de la llista de regidors convidava a no fer-ho.
     */
    let alcaldiesAmbSegonCarrec = 0;
    let alcaldiesAmbImport = 0;
    for (const persones of perMunicipi.values()) {
      for (const persona of persones.values()) {
        if (!persona.alcaldia) continue;
        alcaldiesAmbSegonCarrec += 1;
        if (persona.altres.some((a) => a.retribucio !== null)) alcaldiesAmbImport += 1;
      }
    }

    for (const [municipalityId, persones] of perMunicipi) {
      const llista = [...persones.values()].sort((a, b) => a.nom.localeCompare(b.nom, "ca"));
      ambImport += llista.filter((p) => p.altres.some((a) => a.retribucio !== null)).length;
      await desa(db, municipalityId, "carrecsAcumulats", {
        persones: llista,
        alcaldia: llista.find((p) => p.alcaldia) ?? null,
        consultat: avui(),
        catalunya: {
          alcaldiesAmbSegonCarrec,
          alcaldiesAmbImportPublicat: alcaldiesAmbImport,
          carrecsLligats: creuament.lligams.length + diba.lligats,
          nomsAmbigusDescartats: creuament.ambigusSupramunicipals.length,
          ensQuePubliquen: publiquen,
          ensQueNoPubliquen: noPubliquen,
        },
        fonts: {
          segonCarrec: { nom: "Composició dels plens (Generalitat de Catalunya)", dataset: PLENS },
          imports: "cada import el publica el mateix ens que el paga; l'enllaç va dins de cada càrrec",
        },
        advertiment:
          "Cada import és el que publica l'ens que el paga, i només ell. Aquí no s'hi suma cap total: " +
          "el que cobra una persona de dues administracions diferents no l'ha publicat mai ningú, i " +
          "una suma nostra seria una xifra sense font. Del camp de retribució que publiquen els " +
          "ajuntaments a seu-e no se n'agafa cap euro, perquè només recull la part que paga l'ajuntament.",
      });
      run.rowsOut += 1;
    }

    run.say(`${run.rowsOut} municipis amb algun regidor amb un segon càrrec`);
    run.say(`${ambImport} persones amb un import publicat per l'ens que el paga`);
    run.say(
      `${alcaldiesAmbSegonCarrec} alcaldies amb un segon càrrec, ` +
        `${alcaldiesAmbImport} amb l'import publicat per qui el paga`,
    );
    return {
      municipis: run.rowsOut,
      lligams: creuament.lligams.length,
      dibaLligats: diba.lligats,
      ambImport,
      alcaldiesAmbSegonCarrec,
      alcaldiesAmbImport,
      ensQuePubliquen: publiquen,
      ensQueNoPubliquen: noPubliquen,
    };
  });
}

/**
 * Què publica un consell comarcal o una diputació sobre el que cobren els seus
 * electes, llegit del seu propi mòdul de seu-e.
 *
 * Aquí sí que se'n desa l'import, i no és una contradicció amb la regla del
 * capçal: aquest camp el publica **l'ens que paga aquest càrrec**, i l'import
 * s'atribueix a ell i a ningú més. El que no es pot fer —i no es fa enlloc— és
 * presentar-lo com el que cobra la persona.
 *
 * Comprovat el 29-08-2026: la Diputació de Lleida hi publica els 25 càrrecs amb
 * «Retribució anual bruta», i les de Girona i Tarragona no són a seu-e.
 */
async function retribucionsDelEns(nomEns: string, run: Run): Promise<PublicaEns> {
  const consultat = avui();
  const buit = (url: string, motiu: string): PublicaEns => ({
    imports: new Map(),
    publica: false,
    motiu,
    url,
    consultat,
  });

  for (const slug of slugsSupramunicipals(nomEns)) {
    let resposta: { status: number; html: string };
    try {
      resposta = await fetchText(urlCarrecs(slug));
    } catch (error) {
      await run.issue({
        kind: "ens_supramunicipal_error",
        severity: "baixa",
        entity: nomEns,
        detail: { slug, error: String(error) },
      });
      continue;
    }
    if (resposta.status !== 200 || !resposta.html) continue;
    // Dos consells comarcals responen 200 amb una pantalla d'inici de sessió:
    // sense comprovar el títol, l'ens quedaria com a «no publica res» quan el
    // que passa és que hem trucat a la porta equivocada.
    const titol = titolMunicipi(resposta.html);
    if (!titol || normalize(titol) !== normalize(nomEns)) continue;

    const carrecs = parseCarrecs(resposta.html);
    if (carrecs.length === 0) {
      return buit(urlCarrecs(slug), `${nomEns} té el mòdul de càrrecs electes buit a seu-e`);
    }

    const imports = new Map<string, { anual: number | null; detall: string; dedicacio: string | null }>();
    for (const carrec of carrecs) {
      if (!carrec.fitxa) continue;
      const fitxa = await fetchText(senseTokenAuth(carrec.fitxa));
      if (fitxa.status !== 200 || !fitxa.html) continue;
      const text = campFitxa(fitxa.html, "carrec-retribucio");
      if (text === null) continue;
      const anual = importEnEuros(text);
      if (anual === null) continue;
      imports.set(normalizePersonName(carrec.nom), {
        anual,
        detall: "retribució anual bruta publicada per l'ens",
        dedicacio: carrec.carrec || null,
      });
      await sleep(100);
    }

    if (imports.size === 0) {
      return buit(urlCarrecs(slug), `${nomEns} publica els seus càrrecs electes però no cap retribució`);
    }
    return { imports, publica: true, motiu: null, url: urlCarrecs(slug), consultat };
  }

  await run.issue({
    kind: "ens_supramunicipal_sense_portal",
    severity: "baixa",
    entity: nomEns,
    detail: { efecte: "no se li ha trobat cap pàgina de càrrecs electes: no se li atribueix cap import" },
  });
  return buit("", `no s'ha trobat cap pàgina on ${nomEns} publiqui les retribucions dels seus electes`);
}

/** Els electes de la Diputació de Barcelona amb el sou que ella mateixa publica. */
async function electesDiba(run: Run): Promise<{
  electes: { nom: string; codi: string; carrec: string; dedicacio: string; anual: number | null; motiu: string | null }[];
  consultat: string;
  lligats: number;
}> {
  const consultat = avui();
  try {
    const { status, html } = await fetchText(URL_DIBA);
    if (status !== 200 || !html) throw new Error(`HTTP ${status}`);
    const dades = parseRetribucionsDiba(html);
    if (dades.electes.length === 0 || dades.tarifes.size === 0) {
      await run.issue({
        kind: "diba_retribucions_illegible",
        severity: "alta",
        entity: URL_DIBA,
        detail: { electes: dades.electes.length, tarifes: dades.tarifes.size },
      });
      return { electes: [], consultat, lligats: 0 };
    }
    run.say(
      `Diputació de Barcelona: ${dades.electes.length} electes amb codi retributiu` +
        `${dades.anyTarifa ? ` (taula del ${dades.anyTarifa})` : ""}`,
    );

    const electes = dades.electes.map((e) => {
      const anual = retribucioAnualDiba(e, dades.tarifes);
      return {
        nom: e.nom,
        codi: e.codi,
        carrec: e.carrec,
        dedicacio: e.dedicacio === "exclusiva"
          ? "dedicació exclusiva"
          : `dedicació parcial${e.percentatge ? ` (${e.percentatge} %)` : ""}`,
        anual,
        motiu: anual === null ? `el codi ${e.codi} no es pot convertir en euros sense endevinar-hi res` : null,
      };
    });
    /*
     * Els que només cobren per assistència no tenen sou anual publicat: la
     * pàgina en dona el preu per sessió i un màxim de comissions al mes, que
     * no és un import anual i no es pot convertir en un sense inventar-se
     * quantes sessions ha fet cadascú.
     */
    for (const persona of dades.perAssistencia) {
      electes.push({
        nom: persona.nom,
        codi: "",
        carrec: persona.carrec,
        dedicacio: "sense dedicació: cobra per assistència",
        anual: null,
        motiu:
          `la Diputació de Barcelona en publica el preu per sessió (${dades.assistencies.ple ?? "?"} € per ple, ` +
          `${dades.assistencies.comissio ?? "?"} € per comissió) i no cap import anual`,
      });
    }
    return { electes, consultat, lligats: electes.length };
  } catch (error) {
    await run.issue({
      kind: "diba_retribucions_error",
      severity: "alta",
      entity: URL_DIBA,
      detail: { error: String(error) },
    });
    return { electes: [], consultat, lligats: 0 };
  }
}
