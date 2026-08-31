import { asc, eq, sql } from "drizzle-orm";
import { councillorMandates, municipalityMetrics, people, type Db } from "@quivoto/db";
import { normalizePersonName } from "../lib/text";
import { adrecesRegidors } from "./regidor";

/**
 * Qui té l'alcaldia, dit una sola vegada per a tot el web.
 *
 * Tres pàgines responien la mateixa pregunta de tres maneres. La fitxa del
 * municipi buscava la paraula «alcald» al càrrec de la seu electrònica i, si
 * no hi era, provava pel nom que dona la font oficial; la llista dels 947 i
 * la taula de la comarca només feien el primer pas; el cercador només feia el
 * segon. El resultat era que l'Hospitalet de Llobregat —on l'alcaldia va
 * canviar a mig mandat i la seu electrònica encara no marca ningú— ensenyava
 * la cara de l'alcalde a la seva fitxa i les inicials «DQ» a la llista, dos
 * clics més enllà; a Lleida, Terrassa o Tarragona, on el portal de la ciutat
 * escriu el càrrec amb altres paraules, passava el mateix. I el nom de
 * l'alcaldia a la llista no portava enlloc.
 *
 * Aquí es decideix un cop i la resta de pàgines ho llegeixen. La regla:
 *
 *   1. Si la seu electrònica marca algú amb la paraula «alcald», mana ella:
 *      porta el càrrec escrit tal com el firma qui el té. **Llevat que la font
 *      oficial de la Generalitat digui que l'alcaldia és una altra persona**:
 *      llavors mana el nom oficial, perquè el registre es posa al dia després
 *      d'un relleu i hi ha seus que es queden amb l'«Alcalde» d'abans. Al
 *      Catllar, a Castellgalí o a Torredembarra la seu encara marcava
 *      l'alcaldia del mandat passat i la fitxa ensenyava una cara mentre la
 *      llista dels 947 i la taula d'alcaldies deien un altre nom.
 *   2. Si no, es busca a la mateixa llista la persona que la font oficial de
 *      la Generalitat diu que té l'alcaldia, pel nom normalitzat. La font
 *      oficial sí que està al dia; el que no té és ni la foto ni la fitxa.
 *   3. Si la seu electrònica no publica cap llista, l'adreça surt del ple
 *      segons el registre electoral, que és la llista amb què `escriuRegidors`
 *      escriu les fitxes de persona dels 483 municipis sense seu. Aquí només
 *      s'hi busca pel nom: el càrrec que hi consta és el del dia de la
 *      constitució del ple i, després d'un relleu, diria «Alcalde» de qui ja
 *      no ho és.
 *
 * L'adreça la mana `adrecesRegidors()` sobre la mateixa llista que fa servir
 * qui escriu les pàgines: si aquí es calculés d'una altra manera, l'enllaç
 * aniria a una pàgina que no hi és.
 */

/** El que cal d'una persona del ple per decidir si és l'alcaldia, i res més. */
export type CarrecAlcaldia = {
  nom: string;
  carrec: string;
  foto?: string | null;
  fotoPetita?: string | null;
};

export type Alcaldia<T extends CarrecAlcaldia = CarrecAlcaldia> = {
  /** L'entrada de la seu electrònica, quan l'alcaldia hi és. */
  carrec: T | null;
  /** El nom tal com l'escriu la seu electrònica si hi és; si no, el de la font oficial. */
  nom: string | null;
  /** El retrat gran, o el petit si només hi ha aquest. */
  foto: string | null;
  /** El retrat petit, o el gran si només hi ha aquest. */
  fotoPetita: string | null;
  /**
   * El camí de la fitxa de la persona, relatiu a `m/<slug>/`: «regidor/<persona>/».
   * `null` quan no en té: llavors el lloc on enviar és `#alcaldies` del municipi.
   */
  adreca: string | null;
};

/**
 * Si el càrrec, tal com l'escriu la seu, és el de l'alcaldia.
 *
 * La fitxa del municipi mirava només que hi fos la paraula «alcald», i la
 * paraula hi és també a «tinent d'alcalde», que és un càrrec de debò que les
 * seus escriuen, i a «regidor d'Alcaldia», que és l'àrea que porta el nom de
 * qui mana sense ser-ho. Amb aquella regla, un tinent d'alcalde escrit abans
 * que l'alcalde —o en una seu on l'alcalde no porta cap càrrec— sortia amb la
 * cara de qui mana. Aquí es descarten els dos casos; qui quedi sense càrrec es
 * troba pel nom, al pas següent.
 *
 * «tinen» sense acabar cobreix el «1ª Tinença Alcaldia» de la Sénia; «tta» és
 * l'abreviatura «5aTta.Alcaldessa» amb què Viladecans escriu les tinences; i
 * «vice» és el «Vicealcalde» de Cardedeu, que sortia a la portada de la fitxa
 * en lloc de l'alcalde perquè la seu l'escriu abans. S'ha comprovat sobre els
 * càrrecs de les 947 fitxes publicades que cap alcaldia de debò no porta cap
 * d'aquests trossos al seu càrrec.
 */
export const esAlcaldia = (carrec: string | null | undefined): boolean =>
  /alcald/i.test(carrec ?? "") && !/tinen|tta|vice|d.alcald|adjunt/i.test(carrec ?? "");

/** Qui surt primer amb aquest nom. Dues persones del mateix ple que es diguin igual no passa avui a cap dels 947. */
function pelNom<T extends { nom: string }>(llista: readonly T[], nom: string | null): T | null {
  if (!nom) return null;
  const clau = normalizePersonName(nom);
  if (clau === "") return null;
  return llista.find((c) => normalizePersonName(c.nom) === clau) ?? null;
}

/**
 * Si dos noms escrits per dues fonts poden ser la mateixa persona.
 *
 * La seu escriu «Josep Ramon Llavero Rodríguez» i el registre «José Ramón
 * Llavero Rodríguez»: la clau normalitzada no lliga —el nom de pila canvia
 * d'idioma— però els cognoms sí. El llindar són **dos trossos compartits** de
 * més de dues lletres: sobre les 947 fitxes publicades separa totes les
 * variants d'escriptura reals —Albons, Begues, Montgat, «Falgàs Marco
 * Margaleff» girat de Torrelles— de tots els relleus de debò —el Catllar,
 * Castellgalí, Torredembarra—, on els dos noms no comparteixen ni un cognom.
 * Un nom molt curt es conforma amb el que té: «Margarida Feliu» i «Margarida
 * Feliu Portabella» comparteixen tot el que el primer pot compartir.
 */
function mateixaPersona(a: string, b: string): boolean {
  const na = normalizePersonName(a);
  const nb = normalizePersonName(b);
  if (na === "" || nb === "") return false;
  if (na === nb) return true;
  const trossos = (s: string): string[] => s.split(" ").filter((t) => t.length > 2);
  const ta = trossos(na);
  const tb = new Set(trossos(nb));
  const compartits = ta.filter((t) => tb.has(t)).length;
  return compartits > 0 && compartits >= Math.min(2, ta.length, tb.size);
}

export function resolAlcaldia<T extends CarrecAlcaldia>(
  carrecs: readonly T[] | null | undefined,
  government: { mayorName: string | null; mayorSigles?: string | null } | null | undefined,
  registre: readonly { nom: string }[] | null = null,
): Alcaldia<T> {
  const oficial = government?.mayorName?.trim() || null;
  const seu = carrecs ?? [];

  // El càrrec de la seu mana mentre no digui el contrari del registre. Quan la
  // seu marca la persona A i la font oficial diu que l'alcaldia és la persona
  // B —dos noms que no s'assemblen, no dues grafies del mateix—, la seu s'ha
  // quedat enrere: el registre es posa al dia després d'un relleu i el càrrec
  // de la seu és el d'abans. Llavors es busca la persona B a la mateixa
  // llista; si no hi és, val més el nom oficial pelat que la cara d'algú que
  // ja no ho és.
  const marcat = seu.find((c) => esAlcaldia(c.carrec)) ?? null;
  const oficialALaSeu = pelNom(seu, oficial);
  const trobat =
    marcat && oficial && !mateixaPersona(marcat.nom, oficial) ? oficialALaSeu : (marcat ?? oficialALaSeu);
  if (trobat) {
    return {
      carrec: trobat,
      nom: trobat.nom,
      foto: trobat.foto ?? trobat.fotoPetita ?? null,
      fotoPetita: trobat.fotoPetita ?? trobat.foto ?? null,
      adreca: `regidor/${adrecesRegidors(seu).get(trobat)!}/`,
    };
  }

  // Sense llista a la seu, la fitxa de la persona la té el registre. Amb
  // llista, no: `escriuRegidors` només mira el registre quan la seu no diu res,
  // i una alcaldia que no és a la llista de la seva seu no té pàgina.
  const delRegistre = seu.length === 0 && registre ? pelNom(registre, oficial) : null;
  return {
    carrec: null,
    nom: oficial,
    foto: null,
    fotoPetita: null,
    adreca: delRegistre ? `regidor/${adrecesRegidors(registre!).get(delRegistre)!}/` : null,
  };
}

// ------------------------------------------------------------------ lectura

/**
 * La llista de la seu electrònica de cada municipi, retallada al que cal aquí.
 *
 * El document sencer de càrrecs són uns 5 kB per municipi —el grup, l'equip de
 * govern, l'enllaç a la fitxa oficial, dues mides de retrat— i portar-lo tot a
 * JavaScript per treure'n una cara i una adreça és el que la llista dels 947
 * feia i la pàgina de comarca s'estalviava amb una subconsulta. Ara totes dues
 * llegeixen això: el nom i el càrrec de cada persona, que és el que decideix
 * qui és l'alcaldia, i el retrat petit, que és l'únic que ensenyen. La resta no
 * surt mai de la base de dades.
 *
 * El nom de **tothom** hi ha d'anar, no només el de l'alcaldia: l'adreça de la
 * seva fitxa depèn de qui més hi ha al ple —`adrecesRegidors()` posa un sufix
 * a la segona persona amb el mateix nom— i per calcular-la cal la llista sencera.
 */
export async function carregaCarrecsAlcaldia(db: Db): Promise<Map<number, CarrecAlcaldia[]>> {
  const data = municipalityMetrics.data;
  const files = await db
    .select({
      municipalityId: municipalityMetrics.municipalityId,
      carrecs: sql<CarrecAlcaldia[] | null>`(SELECT jsonb_agg(jsonb_build_object(
          'nom', c->>'nom', 'carrec', c->>'carrec', 'fotoPetita', c->>'fotoPetita'))
        FROM jsonb_array_elements(${data}->'carrecs') AS c)`,
    })
    .from(municipalityMetrics)
    .where(eq(municipalityMetrics.kind, "carrecs"));
  const sortida = new Map<number, CarrecAlcaldia[]>();
  for (const fila of files) {
    // `jsonb_agg` d'una llista buida és NULL, i el motor de Postgres de debò
    // pot tornar el jsonb com a text: es llegeix igual als dos motors.
    const llista = typeof fila.carrecs === "string" ? (JSON.parse(fila.carrecs) as CarrecAlcaldia[]) : fila.carrecs;
    if (!llista || llista.length === 0) continue;
    sortida.set(
      fila.municipalityId,
      llista.map((c) => ({ nom: c.nom ?? "", carrec: c.carrec ?? "", fotoPetita: c.fotoPetita ?? null })),
    );
  }
  return sortida;
}

/**
 * El ple segons el registre electoral, municipi per municipi.
 *
 * És **la mateixa consulta i el mateix ordre** que `loadRadiografia` posa a
 * `councillors` i amb què `escriuRegidors` anomena les fitxes de persona dels
 * municipis sense llista a la seu: tots els mandats del municipi, per número
 * d'ordre. No es filtra per mandat a posta, perquè la llista que anomena els
 * directoris tampoc no ho fa, i el que compta aquí és que l'adreça que en surti
 * sigui la d'una pàgina que existeix.
 */
export async function carregaPleDelRegistre(db: Db): Promise<Map<number, { nom: string }[]>> {
  const files = await db
    .select({ municipalityId: councillorMandates.municipalityId, nom: people.fullName })
    .from(councillorMandates)
    .innerJoin(people, eq(people.id, councillorMandates.personId))
    .orderBy(asc(councillorMandates.municipalityId), asc(councillorMandates.orderNum));
  const sortida = new Map<number, { nom: string }[]>();
  for (const fila of files) {
    const llista = sortida.get(fila.municipalityId) ?? [];
    llista.push({ nom: fila.nom });
    sortida.set(fila.municipalityId, llista);
  }
  return sortida;
}
