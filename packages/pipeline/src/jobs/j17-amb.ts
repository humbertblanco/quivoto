import { municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { socrataAll } from "../adapters/socrata";
import { withRun } from "../lib/run";

/**
 * J17 — l'Àrea Metropolitana de Barcelona com un ens propi.
 *
 * L'Observatori agrupava els municipis només per comarca, i per als trenta-sis
 * municipis metropolitans la comarca no explica gairebé res del que comparteixen:
 * el Barcelonès en són cinc, i qui viu a Cornellà, a Castelldefels o a Montcada
 * comparteix autobús, aigua, depuradora, deixalleria i platja amb Barcelona
 * sense compartir-hi comarca. Una part del que paga i del que rep no la decideix
 * el seu ajuntament ni el seu consell comarcal, sinó l'AMB.
 *
 * Aquesta feina no calcula res: només llegeix **qui hi és**, que és el que ningú
 * no té a mà en un format utilitzable, i ho desa a cada municipi perquè la seva
 * fitxa ho pugui dir i perquè la pàgina de l'AMB es pugui generar sense tornar a
 * demanar-ho a la font.
 *
 * ## D'on surt la llista
 *
 * Del conjunt «ens on participa cada ens local» de la Generalitat
 * (`2r5q-tsxs`), filtrant els que participen en una entitat metropolitana. Hi ha
 * un mirall invers del mateix registre (`6vs9-4h2v`) i **les dues no diuen el
 * mateix**: en consorcis, una en compta 946 municipis i l'altra 873. En entitats
 * metropolitanes sí que coincideixen, i la llista que en surt és exactament la
 * mateixa que la de l'article 2 de la Llei 31/2010 —comprovat nom a nom—, que és
 * l'única llista amb valor legal. Per això es demana el nombre exacte: si un dia
 * la font en dona 35 o 37, val més no desar res que publicar una llista a mitges
 * i que la pàgina digui «els 35 municipis metropolitans».
 */

/** «Ens on participa cada ens local», Generalitat de Catalunya. */
const ENS_ON_PARTICIPA = "2r5q-tsxs";

/** El tipus d'ens que agrupa el que busquem. Avui a Catalunya només n'hi ha un. */
const TIPUS_METROPOLITA = "Entitats metropolitanes";

/** El codi d'ens de l'AMB al registre d'ens locals de la Generalitat. */
export const CODI_AMB = "8200330008";

export const NOM_AMB = "Àrea Metropolitana de Barcelona";

/**
 * Els municipis que la Llei 31/2010 posa dins de l'AMB. Si la font en dona un
 * nombre diferent, no és una dada nova: és un problema de la font o una llei
 * que ha canviat, i en tots dos casos ha de passar per davant d'una persona.
 */
export const MUNICIPIS_AMB = 36;

/**
 * Les matèries que la llei posa a mans de l'AMB, en curt.
 *
 * Van a la mètrica —i no només a la pàgina— perquè la fitxa d'un municipi
 * metropolità les pugui anomenar sense dependre del codi de publicació. El
 * detall article a article viu a `publish/amb.ts`, que és on es llegeix.
 */
export const MATERIES_AMB: readonly string[] = [
  "urbanisme",
  "transport i mobilitat",
  "aigües",
  "residus",
  "medi ambient",
  "infraestructures, parcs i platges",
  "desenvolupament econòmic",
  "cohesió social i territorial",
];

/** La norma que crea l'ens i li dona les competències. */
export const LLEI_AMB = {
  titol: "Llei 31/2010, del 3 d'agost, de l'Àrea Metropolitana de Barcelona",
  /** Els trenta-sis municipis hi són escrits un a un. */
  articleComposicio: "article 2",
  /** El repartiment de competències, de la A a la H. */
  articleCompetencies: "article 14",
  eli: "https://portaljuridic.gencat.cat/eli/es-ct/l/2010/08/03/31",
} as const;

/** Una fila del conjunt, amb els camps que ens interessen. */
export type FilaParticipacio = {
  codi_ens_pare?: string | null;
  nom_ens_pare?: string | null;
  descripcio_tipus_pare?: string | null;
  codi_ens_on_participa?: string | null;
  nom_ens_on_participa?: string | null;
};

/**
 * El codi d'ens a deu xifres.
 *
 * Els codis dels municipis de Barcelona comencen per zero i qualsevol pas per
 * un full de càlcul se l'endú («0801930008» → «801930008»). Ho tornem a posar,
 * i el que no és un codi es queda en cadena buida per no aparellar res per
 * accident.
 */
export function codiEns10(value: unknown): string {
  const text = String(value ?? "").trim();
  return /^\d{1,10}$/.test(text) ? text.padStart(10, "0") : "";
}

/**
 * Els codis d'ens dels municipis que participen a l'AMB, sense repeticions i en
 * ordre estable.
 *
 * Es filtra pel **codi** de l'ens metropolità i no pel tipus: el tipus
 * «Entitats metropolitanes» avui només conté l'AMB, però si demà el Parlament
 * en crea una altra —o si algú hi classifica l'Àrea Metropolitana del Transport—
 * la llista es barrejaria en silenci i la pàgina diria que Sabadell és a l'AMB.
 */
export function municipisDeLAmb(files: readonly FilaParticipacio[]): string[] {
  const codis = new Set<string>();
  for (const fila of files) {
    if (codiEns10(fila.codi_ens_on_participa) !== CODI_AMB) continue;
    // El registre relaciona ens de tota mena; aquí només volen dir res els
    // municipis, que són els que tenen fitxa a l'Observatori.
    const tipus = String(fila.descripcio_tipus_pare ?? "Municipis").trim();
    if (tipus !== "" && tipus !== "Municipis") continue;
    const codi = codiEns10(fila.codi_ens_pare);
    if (codi !== "") codis.add(codi);
  }
  return [...codis].sort();
}

/** Les altres entitats metropolitanes que surtin al conjunt, si n'hi ha cap. */
export function altresEntitats(files: readonly FilaParticipacio[]): string[] {
  const noms = new Set<string>();
  for (const fila of files) {
    const codi = codiEns10(fila.codi_ens_on_participa);
    if (codi !== "" && codi !== CODI_AMB) noms.add(`${codi} · ${String(fila.nom_ens_on_participa ?? "?")}`);
  }
  return [...noms].sort();
}

export async function j17Amb(db: Db): Promise<void> {
  await withRun(db, "J17 Àrea Metropolitana de Barcelona", async (run) => {
    const files = await socrataAll<FilaParticipacio>(ENS_ON_PARTICIPA, {
      select: "codi_ens_pare,nom_ens_pare,descripcio_tipus_pare,codi_ens_on_participa,nom_ens_on_participa",
      where: `tipus_ens_on_participa='${TIPUS_METROPOLITA}'`,
    });
    run.rowsIn = files.length;

    const altres = altresEntitats(files);
    if (altres.length > 0) {
      // No és un error: és que hi ha una entitat metropolitana més i algú ha de
      // decidir si l'Observatori també li ha de fer pàgina.
      await run.issue({ kind: "amb_altra_entitat_metropolitana", severity: "baixa", detail: { altres } });
      run.say(`atenció: ${altres.length} entitats metropolitanes més al conjunt`);
    }

    const codis = municipisDeLAmb(files);
    run.say(`${codis.length} municipis participen a l'AMB segons ${ENS_ON_PARTICIPA}`);

    const all = await db.select({ id: municipalities.id, codiEns: municipalities.codiEns, name: municipalities.name }).from(municipalities);
    const byCodiEns = new Map(all.map((m) => [m.codiEns, m]));
    const trobats = codis.map((codi) => ({ codi, municipi: byCodiEns.get(codi) ?? null }));
    const orfes = trobats.filter((t) => t.municipi === null).map((t) => t.codi);

    // Tot o res. Una AMB de trenta-cinc municipis no és una AMB incompleta: és
    // una pàgina que menteix, i la fitxa d'un municipi metropolità diria que no
    // hi és. Val més quedar-se sense pàgina i amb una incidència de gravetat
    // alta, que és el que fa que algú s'ho miri.
    if (codis.length !== MUNICIPIS_AMB || orfes.length > 0) {
      await run.issue({
        kind: "amb_composicio_incompleta",
        severity: "alta",
        detail: { esperats: MUNICIPIS_AMB, rebuts: codis.length, senseMunicipi: orfes },
      });
      run.say(`no es desa res: n'esperàvem ${MUNICIPIS_AMB} i n'han sortit ${codis.length}${
        orfes.length > 0 ? `, i ${orfes.length} no lliguen amb cap municipi nostre` : ""
      }`);
      return { municipis: 0, esperats: MUNICIPIS_AMB, rebuts: codis.length };
    }

    const data = {
      member: true,
      ens: { codi: CODI_AMB, nom: NOM_AMB, web: "https://www.amb.cat/" },
      municipis: MUNICIPIS_AMB,
      materies: MATERIES_AMB,
      llei: LLEI_AMB,
      source: {
        name: "Ens on participa cada ens local, Generalitat de Catalunya",
        dataset: ENS_ON_PARTICIPA,
        url: `https://analisi.transparenciacatalunya.cat/d/${ENS_ON_PARTICIPA}`,
      },
    };

    for (const { municipi } of trobats) {
      await db
        .insert(municipalityMetrics)
        .values({ municipalityId: municipi!.id, kind: "amb", data })
        .onConflictDoUpdate({
          target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
          set: { data, computedAt: new Date() },
        });
      run.rowsOut += 1;
    }

    run.say(`${run.rowsOut} municipis marcats com a metropolitans`);
    return { municipis: run.rowsOut, ens: NOM_AMB };
  });
}
