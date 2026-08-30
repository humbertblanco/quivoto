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
 *      porta el càrrec escrit tal com el firma qui el té.
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
 */
const esAlcaldia = (carrec: string | null | undefined): boolean =>
  /alcald/i.test(carrec ?? "") && !/tinent|tinenta|d.alcald|adjunt/i.test(carrec ?? "");

/** Qui surt primer amb aquest nom. Dues persones del mateix ple que es diguin igual no passa avui a cap dels 947. */
function pelNom<T extends { nom: string }>(llista: readonly T[], nom: string | null): T | null {
  if (!nom) return null;
  const clau = normalizePersonName(nom);
  if (clau === "") return null;
  return llista.find((c) => normalizePersonName(c.nom) === clau) ?? null;
}

export function resolAlcaldia<T extends CarrecAlcaldia>(
  carrecs: readonly T[] | null | undefined,
  government: { mayorName: string | null; mayorSigles?: string | null } | null | undefined,
  registre: readonly { nom: string }[] | null = null,
): Alcaldia<T> {
  const oficial = government?.mayorName?.trim() || null;
  const seu = carrecs ?? [];

  const trobat = seu.find((c) => esAlcaldia(c.carrec)) ?? pelNom(seu, oficial);
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
