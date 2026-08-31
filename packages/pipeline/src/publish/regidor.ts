import { tintaSobre } from "./contrast";
import { RADIOGRAFIA_CSS } from "./estil";
import { SITE } from "./config";
import { de, delDia, elDia, nomLlegible, normalizePersonName, slugify } from "../lib/text";
import { capcalera, tipografia } from "./capcalera";
import { sigla } from "./sigla";
import { cercador } from "./cercador";
import { peu } from "./peu";
import type { FitxaTrajectoria } from "../jobs/j21-trajectoria-electes";
import type { FitxaCapsDeLlista } from "../jobs/j27-caps-de-llista";

/**
 * Una pàgina per a cada persona que seu al ple.
 *
 * Són càrrecs públics electes i la seva identitat ja és oberta; el que aporta
 * la pàgina és reunir en un lloc el que avui està escampat: de quina llista va
 * sortir, en quina posició, si és a l'equip de govern, si va entrar el dia de
 * la constitució o a mig mandat, i què ha votat el seu grup.
 *
 * **Quan es pot dir què va votar aquesta persona, es diu.** Les actes no
 * publiquen una llista de vots individuals, però sovint no cal: si un grup de
 * divuit regidories hi posa divuit vots, tots divuit han votat allò. No és una
 * suposició sobre el que sol passar, és aritmètica —no queda ningú a qui
 * atribuir un vot diferent.
 *
 * Quan el grup hi posa menys vots que regidories té, algú no hi era o algú hi va
 * votar diferent, i llavors no es pot dir qui: aquells punts es marquen com a
 * vot del grup i no de la persona. És la diferència que importa, i és
 * precisament el cas on equivocar-se seria greu.
 *
 * El que no hi surt mai: cap dada de contacte, res que no derivi del càrrec, i
 * cap fotografia de qui no sigui electe en actiu.
 */

/** Un import en euros sencers, amb els milers a la catalana. */
const euros = (n: number): string => `${Math.round(n).toLocaleString("ca-ES")} €`;

/**
 * El salari mínim interprofessional de cada any, brut anual amb catorze pagues.
 *
 * Un sou tot sol no diu res: 102.120 € és molt o poc segons amb què es
 * compari, i publicar la xifra pelada és deixar que cadascú s'inventi la vara.
 * L'altra vara possible era **l'import per habitant** —el que costa aquest
 * càrrec a cada veí— i s'ha descartat: divideix el mateix sou per 947
 * denominadors diferents, de manera que l'alcalde d'un poble de tres-cents
 * habitants surt a 100 € per cap i el de Barcelona a 0,06 €. El que es
 * llegiria no seria el sou sinó la mida del municipi, i la comparació faria
 * semblar cars els pobles petits, que és justament el contrari del que passa.
 *
 * El salari mínim és la mateixa vara per als 947 i respon la pregunta que es
 * fa qui ho mira: quantes vegades el que cobra qui menys cobra en aquest país.
 *
 * Cada xifra és la del reial decret d'aquell any, mensual × 14. Els anys que
 * no hi són no s'inventen: el bloc ensenya l'import i es queda sense la
 * comparació, que és el que ha de passar quan no ho hem comprovat al BOE.
 */
const SMI_ANUAL: Record<number, number> = {
  2021: 13_510, // 965 € × 14
  2022: 14_000, // 1.000 € × 14
  2023: 15_120, // 1.080 € × 14
  2024: 15_876, // 1.134 € × 14
  2025: 16_576, // 1.184 € × 14
};

/**
 * L'import dit en vegades el salari mínim del **mateix any** de l'import.
 *
 * Comparar un sou del 2024 amb el salari mínim del 2025 seria barrejar dos
 * anys per estalviar-se una condició: sense l'any de l'import no hi ha
 * comparació, i prou.
 */
function contraElSalariMinim(anualBrut: number, any: number | null): string | null {
  if (any === null) return null;
  const smi = SMI_ANUAL[any];
  if (smi === undefined || anualBrut <= 0) return null;
  const cops = anualBrut / smi;
  const quant =
    cops >= 1
      ? `<b>${cops.toFixed(1).replace(".", ",")} vegades</b> el salari mínim`
      : `<b>el ${Math.round(cops * 100)} %</b> del salari mínim`;
  return `${quant} del ${any}, que aquell any era de ${euros(smi)} bruts en catorze pagues.`;
}

/**
 * Quant fa, des d'una data fins a una altra, dit en anys i mesos.
 *
 * Es compta per calendari i no per dies dividits per 30: «fa 2 anys i 11
 * mesos» ha de canviar a «3 anys» el dia que toca i no una setmana abans.
 */
function faQue(desDe: string, ara: string): string | null {
  const inici = /^(\d{4})-(\d{2})-(\d{2})/.exec(desDe);
  const fi = /^(\d{4})-(\d{2})-(\d{2})/.exec(ara);
  if (!inici || !fi) return null;
  const mesos =
    (Number(fi[1]) - Number(inici[1])) * 12 +
    (Number(fi[2]) - Number(inici[2])) -
    (Number(fi[3]) < Number(inici[3]) ? 1 : 0);
  if (mesos < 0) return null;
  const anys = Math.floor(mesos / 12);
  const resta = mesos % 12;
  if (anys === 0) return resta === 1 ? "1 mes" : `${resta} mesos`;
  const cap = anys === 1 ? "1 any" : `${anys} anys`;
  if (resta === 0) return cap;
  return `${cap} i ${resta === 1 ? "1 mes" : `${resta} mesos`}`;
}

const escape = (t: string): string =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type Regidor = {
  nom: string;
  carrec: string;
  grup: string | null;
  sigles: string | null;
  color: string | null;
  equipGovern: boolean;
  foto: string | null;
  fitxaOficial: string | null;
  /**
   * Posició a la llista amb què es va presentar el 2023, si l'hem pogut lligar.
   *
   * Surt de les candidatures proclamades (`candidacies.list_position`) i no
   * del número d'ordre del registre d'electes: aquell és l'ordre en què el
   * registre escriu el ple sencer, i a Barcelona feia sortir la cap de llista
   * d'ERC com a «número 32 de la llista». Sense candidatura lligada, `null`.
   */
  posicioLlista: number | null;
  /** Va entrar després de la constitució del ple. */
  entradaTardana: boolean;
  /** Va deixar el grup pel qual va ser elegit. */
  canviDeGrup: { de: string | null; a: string | null } | null;
  /**
   * El dia que va prendre possessió, quan el sabem d'aquesta persona.
   *
   * Només el tenim d'algunes: de les alcaldies, perquè el registre en desa la
   * data de presa de possessió, i de qui entra a mig mandat quan l'acta ho
   * diu. Quan no hi és no es dedueix de res: la resta del ple hi seu des de la
   * constitució, i això ja ho diu `ContextRegidor.mandat`.
   */
  desDe?: string | null;
};

export type ContextRegidor = {
  municipi: string;
  slug: string;
  regidories: number;
  majoria: number;
  /**
   * Punts del ple votats pel seu grup. `tot` indica si el grup hi va votar
   * sencer: llavors el vot d'aquesta persona queda determinat.
   */
  votsDelGrup: {
    data: string;
    titol: string;
    sentit: string;
    url: string;
    tot: boolean;
    /** Diferència entre els dos costats. `null` si l'acta no dona el recompte. */
    marge: number | null;
    favor: number;
    contra: number;
  }[];
  /** Quantes actes s'han pogut llegir, per dir per què la llista és curta. */
  actesLlegides: number;
  /**
   * Quantes actes hi ha indexades a la seu, quan la mètrica ho diu. La fitxa
   * del municipi escriu «Tenim indexades 40 actes» i aquesta pàgina deia «40
   * actes llegides»: la mateixa xifra amb dues paraules, que llegides seguides
   * semblaven dues coses. Amb totes dues es pot escriure «les 40 actes
   * indexades, totes llegides», que és un sol vocabulari.
   */
  actesIndexades?: number | null;
  /**
   * En quants punts hem pogut llegir el vot d'ALGUN grup del ple. Separa dues
   * situacions que no es poden confondre a la pàgina d'una persona: «no n'hem
   * sabut llegir cap vot per grup» i «n'hem llegit d'altres grups però no hem
   * sabut reconèixer el seu».
   */
  puntsAmbDesglos?: number;
  /**
   * A quants plens ha anat, de quants en tenim la llista d'assistents.
   *
   * És l'única dada del projecte que és **de la persona i no del grup**:
   * assistir o no assistir a un ple no ho decideix ningú més. Per això va aquí
   * i no en cap altre lloc.
   */
  assistencia: { hi: number; de: number } | null;
  /**
   * L'adreça d'aquesta pàgina, la mateixa que ha fet servir qui l'ha escrita.
   *
   * El canònic la tornava a calcular amb `slugRegidor(r.nom)`, que no
   * desambigua: el dia que dues persones del mateix ple es diguin igual, la
   * pàgina «-2» es declararia canònica a l'adreça de l'altra i el cercador es
   * quedaria amb una de les dues. Avui no passa a cap dels 947, però el que ho
   * evita no ha de ser la sort: l'adreça la mana `adrecesRegidors()` i s'ha de
   * passar, no recalcular.
   */
  adreca: string;
  /**
   * Si la fitxa d'aquest ajuntament marca qui és a l'equip de govern.
   *
   * `equipGovern` és un booleà i un booleà no té manera de dir «no consta»: a
   * onze ajuntaments —Barcelona entre ells— la seu electrònica no marca ningú,
   * i el fals sortia escrit com **«a l'oposició»** a les 163 persones del ple,
   * l'alcalde inclòs. No és un matís: és publicar el contrari del que passa a
   * la pàgina que porta el seu nom al títol.
   *
   * Quan ningú del ple no hi consta marcat, la dada no hi és i no es diu res.
   * Quan n'hi ha algun, el fals dels altres sí que vol dir oposició.
   */
  governConegut: boolean;
  /**
   * Els càrrecs que aquesta persona ocupa en un altre ens, amb el que en cobra
   * quan qui la paga ho publica.
   *
   * Fins ara això només sortia a la fitxa del municipi, en una llista de nou
   * noms. És una dada **de la persona**, com l'assistència, i el lloc on la
   * busca qui la busca és la pàgina que porta el seu nom al títol. Les regles
   * són les mateixes d'allà i no es relaxen aquí: només hi va l'import que
   * publica l'ens que el paga, mai una suma dels dos càrrecs, i quan no el
   * publica es diu per què en comptes de deixar-ho en blanc.
   */
  altresCarrecs: {
    ens: string;
    carrec: string;
    anualBrut: number | null;
    concepte: string | null;
    dedicacio: string | null;
    motiuSenseImport: string | null;
    /**
     * El màxim anual d'indemnitzacions per assistència que publica l'ens, quan
     * no paga cap retribució fixa (J24). **Un sostre, no un sou**: no va mai a
     * `anualBrut` ni se suma amb res.
     */
    sostreAssistencies?: number | null;
    font: { nom: string; url: string; llicencia?: string | null; consultat?: string | null } | null;
  }[];
  /** L'avís de la font sobre què és i què no és cadascun d'aquests imports. */
  avisRetribucions: string | null;
  /**
   * El que l'ajuntament declara al Ministeri de la seva alcaldia (J22), a la
   * pàgina de qui la té.
   *
   * El full de l'ISPA no porta cap nom: és el total que l'ajuntament diu haver
   * pagat a l'alcaldia aquell exercici. Qui el paga és l'ajuntament; qui ho
   * publica, el Ministeri, i la targeta ho escriu així. `mena` és el que J22
   * ja ha decidit: només «sou» és un sou; «assistencies» són plens cobrats per
   * sessió i «cap» és no cobrar res. Si dins del mandat l'alcaldia ha canviat
   * de mans (`canviDAlcaldia`), el total és de dues persones i no s'atribueix.
   */
  alcaldiaSegonsMinisteri?: {
    any: number | null;
    euros: number;
    regim: string;
    mena: "sou" | "assistencies" | "cap";
    canviDAlcaldia: boolean;
    font: { nom: string; organisme: string; url: string; llicencia: string; consultat: string };
    avis: string | null;
  } | null;
  /**
   * El que cobra pel càrrec municipal, quan hi ha una xifra comprovable.
   *
   * **No totes les xifres d'un sou municipal són la mateixa cosa, i barrejar-les
   * és l'error que aquest camp existeix per evitar.** N'hi ha de dues menes:
   *
   * · La que publica **qui la paga** —el CSV de retribucions de l'Ajuntament de
   *   Barcelona en dona l'import brut anual de 858 càrrecs amb nom i dedicació,
   *   i el Ministeri publica cada any el total percebut de cada alcalde— és
   *   l'import sencer d'aquell pagador per aquell càrrec: `abast: "tot"`.
   *
   * · La que hi ha al camp de retribució de **seu-e.cat** és només la part que
   *   paga l'ajuntament, i deixa fora el que la persona cobri d'una altra
   *   administració: a Rubí l'alcaldessa hi consta amb 17.027 € quan en cobra
   *   107.968 comptant la Diputació. Publicada com si fos el sou, aquella
   *   xifra exculpa qui més cobra. Va amb `abast: "nomes-ajuntament"`, i el
   *   bloc l'escriu dient amb totes les lletres que no és el que cobra i sense
   *   comparar-la amb res: comparar-la seria tornar-la a presentar com un sou.
   *
   * L'any hi és perquè cap import no es compara amb el salari mínim d'un altre
   * any, i la llicència perquè la font es cita sencera allà on surt la xifra.
   */
  retribucio?: {
    /** Import brut anual. `null` quan la fitxa hi és però la font no en dona cap. */
    anualBrut: number | null;
    /** Què cobreix l'import: tot el que paga aquest ens, o només la part municipal. */
    abast: "tot" | "nomes-ajuntament";
    /** Qui el paga, escrit com surt a la font: «Ajuntament de Barcelona». */
    paga: string;
    /** «Dedicació exclusiva», «dedicació parcial al 75 %», tal com ho diu la font. */
    dedicacio: string | null;
    /** L'exercici de l'import. Sense any no hi ha comparació amb el salari mínim. */
    any: number | null;
    /** Per què la font no en publica cap import, quan `anualBrut` és nul. */
    motiuSenseImport?: string | null;
    font: { nom: string; url: string | null; llicencia: string | null; consultat?: string | null };
    /** L'enllaç a la seva declaració de béns i activitats, si la font el dona. */
    declaracioBens?: string | null;
    /** L'advertiment de la font sobre què és i què no és aquest import. */
    avis: string | null;
  } | null;
  /**
   * El ple on seu, per poder dir quant fa que hi és.
   *
   * La data de constitució és la del ple sencer i no de la persona: qui va
   * entrar a mig mandat no hi és des d'aquell dia, i llavors el que mana és
   * `Regidor.desDe`. Si no en tenim cap de les dues, no es diu res —«fa dos
   * anys» a qui va entrar fa tres mesos és una dada falsa sobre una persona.
   */
  mandat?: { constitucio: string; nom: string } | null;
  /**
   * Què en publica el seu propi ajuntament: si hi consta la retribució, la
   * declaració de béns, les dietes.
   *
   * **No és el que cobra.** El camp de la seu electrònica no porta cap import
   * aprofitable —a Rubí l'alcaldessa hi consta amb 17.027 € quan en cobra
   * 90.940 més de la Diputació, perquè només recull la part que paga
   * l'ajuntament— i publicar-lo seria publicar una xifra que exculpa. El que
   * sí que es pot dir, i és una dada de debò, és si l'ajuntament ho publica o
   * no: això no depèn de la persona però sí del ple que hi seu.
   */
  /**
   * El que Wikidata sap d'aquesta persona i el nostre registre no sap de ningú:
   * si ha ocupat un càrrec per sobre de l'ajuntament i què feia abans de la
   * política.
   *
   * És la contrapartida de la pàgina /observatori/trajectoria/, que llista les
   * 283 persones que han fet el salt i fins ara acabava en un nom que no
   * portava enlloc. Una pàgina que diu «aquest home va ser diputat» i una altra
   * que porta el seu nom al títol i no ho diu són dues pàgines que es
   * contradiuen; aquest camp és el que les tanca.
   *
   * `null` quan aquesta persona no és a la fitxa de J21 del seu municipi, que
   * és el cas de la gran majoria: Wikidata en coneix 2.917 des del 1979 i el
   * nostre historial en porta molts més. No saber-ne res no s'escriu enlloc.
   */
  trajectoria?: {
    qid: string;
    /** L'ítem de Wikidata d'on surt tot això. */
    url: string;
    /** L'article de la Viquipèdia catalana, que en tenen 613 de les 2.917. */
    viquipedia: string | null;
    /** L'ofici anterior a la política (P106), que en tenen 603. */
    ocupacions: string[];
    /** Els càrrecs per sobre de l'ajuntament, amb les dates que en dona la font. */
    carrecs: { nom: string; inici: string | null; fi: string | null }[];
    /**
     * Si el nom i les dates lliguen amb el nostre historial oficial d'alcaldies.
     *
     * Quan no lliguen, la dada es publica igual —és de Wikidata i com a tal se
     * cita— però amb l'avís al costat: el que no es pot fer és penjar la
     * carrera d'algú a la fitxa d'un altre sense dir que no ho hem pogut
     * comprovar contra la font oficial.
     */
    aparellat: boolean;
    font: string;
    llicencia: string;
    /** Data d'extracció: sense any, cap dada no entra a la fitxa. */
    descarregat: string | null;
    /**
     * D'on surt: de la fitxa d'alcaldies de J21 o de la de caps de llista de
     * J27. Canvia què es diu i com es diu: les alcaldies porten només els
     * càrrecs per sobre de l'ajuntament i lliguen amb el nostre historial; els
     * caps de llista porten el perfil sencer i lliguen pel municipi o el partit.
     */
    origen?: "alcaldies" | "caps-de-llista";
    /** L'any de naixement, i només l'any. Dels caps de llista. */
    naixement?: number | null;
    /** El partit segons Wikidata (P102), escrit com l'escriu Wikidata. */
    partit?: string | null;
    /** L'article de la Wikipedia castellana, per a qui no en té a la catalana. */
    wikipediaEs?: string | null;
    /** Per què diem que aquesta fitxa és aquesta persona, quan és un cap de llista. */
    motiu?: "carrec-al-municipi" | "lloc-al-municipi" | "partit-i-catalunya";
  } | null;
  /**
   * La candidatura amb què es va presentar el 2023, si l'hem pogut lligar.
   *
   * És el que fa que la pàgina de qui va encapçalar una llista digui alguna
   * cosa més que on seu: quants vots va treure la seva llista, quantes
   * regidories, quina força va ser i si va aconseguir l'alcaldia. `es` diu si
   * hi anava de cap. Les xifres són les de la candidatura, no de la persona:
   * a les municipals es voten llistes.
   */
  capDeLlista?: {
    es: boolean;
    posicio: number;
    sigles: string;
    vots: number;
    regidories: number;
    /** Quina força va ser per vots: 1 la més votada. */
    forca: number;
    /** Quantes candidatures hi havia al municipi. */
    forces: number;
    vaGuanyar: boolean;
    /** Si l'alcaldia és d'aquesta llista. `null` quan no sabem de qui és. */
    teAlcaldia: boolean | null;
  } | null;
  /**
   * D'on surten els vots del bloc «Què ha votat», per citar-ho al costat.
   *
   * A Barcelona no són actes llegides sinó el registre de votacions del
   * plenari que publica el mateix Ajuntament, amb el seu avís legal i no una
   * llicència Creative Commons: la citació ha de dir el que la font diu.
   */
  fontVots?: {
    nom: string;
    url: string | null;
    llicencia: string | null;
    llicenciaUrl: string | null;
    consultat: string | null;
  } | null;
  /**
   * Quants mandats porta en aquest ple, segons el registre d'electes de les
   * municipals que tenim ingerides.
   *
   * `null` quan no es pot dir res: el registre només porta una municipal i el
   * silenci de les altres no és una absència. `iniciConegut` diu si la
   * municipal anterior al primer mandat és al registre —només llavors «des del
   * 2019» vol dir que el 2015 no hi era—, i `llistesSenseEntrar` són les
   * municipals en què va anar en una llista i no va entrar al ple.
   */
  mandats?: {
    anys: number[];
    primer: number;
    quants: number;
    seguits: boolean;
    iniciConegut: boolean;
    /** La primera municipal que el registre porta d'aquest municipi. */
    cobertesDesDe: number;
    llistesSenseEntrar: number[];
  } | null;
  /**
   * Les llistes municipals on ha anat de titular, any per any: la llista, el
   * número i si en va sortir elegit. És la resposta directa a «quantes vegades
   * s'ha presentat», i només arriba quan el registre cobreix més d'una
   * municipal: amb una de sola, una llista d'una sola anada faria semblar que
   * abans no s'hi presentava quan senzillament no ho tenim ingerit.
   */
  llistes?: { any: number; sigles: string; posicio: number | null; capDeLlista: boolean; elegit: boolean }[] | null;
  publicaDeLaPersona: {
    /** `null` vol dir que la fitxa de la seu no s'ha pogut llegir: J14 ho desa així. */
    retribucio: "xifra" | "sense-xifra" | "cap" | null;
    declaracioBens: boolean;
    dietes: boolean;
    indemnitzacions: boolean;
    altresRetribucions: boolean;
    fitxa: string | null;
    font: { nom: string; url: string; consultat: string } | null;
  } | null;
};

export const slugRegidor = (nom: string): string => slugify(nom);

/**
 * L'adreça de cada regidor del ple, calculada una sola vegada.
 *
 * Dues persones amb el mateix nom donarien el mateix slug i una escriuria
 * damunt de l'altra: desapareixeria del web sense que ho notés ningú. Es
 * desambigua amb un sufix, i com que la fitxa del municipi i el generador de
 * pàgines fan servir aquesta mateixa funció sobre la mateixa llista i en el
 * mateix ordre, l'enllaç i el directori no poden divergir.
 */
export function adrecesRegidors<T extends { nom: string }>(carrecs: readonly T[]): Map<T, string> {
  const vistos = new Set<string>();
  const sortida = new Map<T, string>();
  for (const carrec of carrecs) {
    let adreca = slugRegidor(carrec.nom);
    if (vistos.has(adreca)) {
      let n = 2;
      while (vistos.has(`${adreca}-${n}`)) n += 1;
      adreca = `${adreca}-${n}`;
    }
    vistos.add(adreca);
    sortida.set(carrec, adreca);
  }
  return sortida;
}

/**
 * El que J21 sap d'aquesta persona, buscat pel nom dins de la fitxa del seu
 * municipi.
 *
 * L'aparellament és el mateix que fa la resta del projecte per creuar persones
 * entre fonts —nom normalitzat— i amb la mateixa cautela que `publicaDe()`: si
 * el nom lliga amb més d'una fitxa de Wikidata, **no es retorna res**. En una
 * pàgina que porta el nom d'una persona al títol, atribuir-li la carrera d'una
 * altra és el pitjor error possible, i val més el bloc buit.
 *
 * La fitxa de J21 és la del municipi, o sigui que aquí només hi entra qui
 * Wikidata dona com a alcalde d'aquest mateix poble: no és una cerca per nom
 * per tot Catalunya.
 */
export function trajectoriaDePersona(
  fitxa: FitxaTrajectoria | null | undefined,
  nom: string,
): ContextRegidor["trajectoria"] {
  if (!fitxa || !Array.isArray(fitxa.persones)) return null;
  const clau = normalizePersonName(nom);
  const iguals = fitxa.persones.filter((p) => normalizePersonName(p.nom) === clau);
  if (iguals.length !== 1) return null;
  const p = iguals[0]!;
  // Ni càrrec per sobre de l'ajuntament, ni ofici, ni article: no hi ha res a
  // dir i el bloc no s'escriu. La fitxa de Wikidata tota sola no és una dada.
  if (p.carrecs.length === 0 && p.ocupacions.length === 0 && p.viquipedia === null) return null;
  return {
    qid: p.qid,
    url: p.url,
    viquipedia: p.viquipedia,
    ocupacions: p.ocupacions,
    /*
     * Del més recent al més antic, i sense repetits. Un mandat per línia és el
     * correcte —Josep Tutusaus va ser al Parlament el 1999 i el 2003-2005, i
     * són dues coses— però la mateixa línia dues vegades amb les mateixes
     * dates només pot ser un duplicat de la font, i llavors s'ensenya un cop.
     */
    carrecs: [
      ...new Map(
        p.carrecs.map((c) => [`${c.nom}|${c.inici ?? ""}|${c.fi ?? ""}`, {
          nom: c.nom,
          inici: c.inici,
          fi: c.fi,
        }]),
      ).values(),
    ].sort((a, b) => (b.inici ?? "").localeCompare(a.inici ?? "")),
    aparellat: p.aparellat,
    font: fitxa.font,
    llicencia: fitxa.llicenciaDades,
    descarregat: fitxa.descarregat ?? null,
  };
}

/**
 * El que J27 sap d'aquesta persona, si va encapçalar una llista el 2023.
 *
 * Mateix aparellament i mateixa cautela que `trajectoriaDePersona()`: pel nom
 * normalitzat, dins de la fitxa del seu municipi, i si el nom lliga amb més
 * d'una persona no es retorna res. La fitxa de J27 ja ha exigit, abans de
 * desar ningú, que la fitxa de Wikidata lligui amb el municipi o amb el partit;
 * aquí només queda no confondre dues persones del mateix ple.
 *
 * Es fa servir només quan J21 no en sap res: els alcaldes surten a totes dues
 * i la de J21 mana, perquè lliga amb el nostre historial oficial d'alcaldies.
 */
export function quiEsDeWikidata(
  fitxa: FitxaCapsDeLlista | null | undefined,
  nom: string,
): ContextRegidor["trajectoria"] {
  if (!fitxa || !Array.isArray(fitxa.persones)) return null;
  const clau = normalizePersonName(nom);
  const iguals = fitxa.persones.filter((p) => p.normalitzat === clau || normalizePersonName(p.nom) === clau);
  if (iguals.length !== 1) return null;
  const p = iguals[0]!;
  // Una fitxa que no diu res —ni ofici, ni càrrec, ni any, ni partit, ni
  // article— no és cap dada, i el bloc no s'escriu.
  if (
    p.carrecs.length === 0 && p.ocupacio.length === 0 && p.naixement === null &&
    p.partit === null && p.article.ca === null && p.article.es === null
  ) {
    return null;
  }
  return {
    qid: p.qid,
    url: p.url,
    viquipedia: p.article.ca,
    wikipediaEs: p.article.es,
    ocupacions: p.ocupacio,
    carrecs: [
      ...new Map(
        p.carrecs.map((c) => [`${c.nom}|${c.inici ?? ""}|${c.fi ?? ""}`, { nom: c.nom, inici: c.inici, fi: c.fi }]),
      ).values(),
    ].sort((a, b) => (b.inici ?? "").localeCompare(a.inici ?? "")),
    // La fitxa de J27 no s'aparella amb el nostre historial d'alcaldies sinó
    // amb el municipi o el partit; el motiu es publica al costat.
    aparellat: true,
    origen: "caps-de-llista",
    naixement: p.naixement,
    partit: p.partit,
    motiu: p.motiu,
    font: fitxa.font,
    llicencia: fitxa.llicenciaDades,
    descarregat: fitxa.consultat ?? null,
  };
}

const SENTITS: Record<string, { text: string; grup: string; classe: string }> = {
  favor: { text: "hi va votar a favor", grup: "el seu grup hi va votar a favor", classe: "favor" },
  contra: { text: "hi va votar en contra", grup: "el seu grup hi va votar en contra", classe: "contra" },
  abstencio: { text: "s'hi va abstenir", grup: "el seu grup s'hi va abstenir", classe: "abstencio" },
  blanc: { text: "hi va votar en blanc", grup: "el seu grup hi va votar en blanc", classe: "" },
  absent: { text: "no hi era", grup: "el seu grup no hi era", classe: "" },
};

const CSS = `
.persona{display:flex;gap:var(--e3);align-items:center;flex-wrap:wrap;margin-top:var(--e3)}
.persona .retrat-gran{width:120px;height:120px;border-radius:var(--r-m);border:2.5px solid var(--ink);
  box-shadow:var(--ombra);object-fit:cover;background:var(--paper-2)}
.persona .inicials-gran{width:120px;height:120px;border-radius:var(--r-m);border:2.5px solid var(--ink);
  box-shadow:var(--ombra);display:flex;align-items:center;justify-content:center;
  font-family:var(--display);font-weight:900;font-size:2.6rem;background:var(--c,var(--paper-2));color:var(--t,inherit)}
.etiquetes{display:flex;gap:8px;flex-wrap:wrap;margin-top:var(--e2)}
/* La pastilla de les sigles es deia «grup», i a l'estil compartit aquest nom ja
   és una altra cosa: la targeta desplegable d'un grup municipal al ple, amb vora
   esquerra de 10px i display de bloc. La pastilla d'aquesta pàgina n'heretava la
   caixa i «PSC-CP» sortia com una taca rodona de 31 px amb dues lletres a dins:
   feia de logotip deformat del partit a la pàgina de cada alcalde i de cada
   regidor, i no era cap problema de responsive sinó una col·lisió de noms.
   Ara fa servir «sigla», que és la mateixa pastilla que la fitxa del municipi i
   la de la candidatura: el mateix component i no una còpia. */
.etiquetes span:not(.sigla){border:2px solid var(--ink);border-radius:var(--r-max);padding:4px 14px;
  font-size:.8rem;font-weight:800;flex:none;white-space:nowrap;max-width:100%}
.etiquetes .sigla{flex:none;font-size:.86rem;padding:3px 12px}
/* L'alcaldia és el càrrec que fa mirar la pàgina: va en coral, que és l'accent
   de la casa, i és l'única pastilla plena de la fila que no depèn del partit. */
.etiquetes .alcaldia-etiqueta{background:var(--coral);color:#FBF7EE;text-transform:uppercase;
  letter-spacing:.08em;font-size:.68rem}
.etiquetes .govern{background:var(--menta);color:#1E1B2E}
.etiquetes .oposicio{background:transparent}
/* «No consta» no és una tercera posició política: és una absència, i per això
   va amb el gris de la lletra petita i sense pastilla. */
.etiquetes .sense-govern{background:transparent;border-style:dashed;color:var(--ink-suau);
  font-weight:700;text-transform:none;letter-spacing:0}
.vots{list-style:none;padding:0;margin:var(--e3) 0 0}
.vots li{border-top:2.5px solid var(--ink);padding:var(--e2) 0;display:flex;gap:var(--e2);
  align-items:baseline;flex-wrap:wrap}
.vots .data{font-weight:800;font-size:.8rem;color:var(--ink-suau);font-variant-numeric:tabular-nums;
  white-space:nowrap}
.vots .titol{flex:1 1 16rem;min-width:0;overflow-wrap:anywhere}
.vots .sentit{font-size:.78rem;font-weight:800;border:2px solid var(--ink);border-radius:var(--r-max);padding:2px 11px}
.vots .sentit.favor{background:var(--menta);color:#1E1B2E}
.vots .sentit.contra{background:var(--coral);color:#FBF7EE}
.vots .sentit.abstencio{background:var(--presec);color:#1E1B2E}
/* Quan el vot és del grup i no es pot atribuir a la persona, la pastilla va
   buida: la diferència s'ha de veure sense haver de llegir el peu. */
.vots .sentit.del-grup{background:transparent!important;color:inherit!important;border-style:dashed}
.vots li.renyida{background:var(--paper-2);border-left:6px solid var(--coral);padding-left:var(--e2)}
.vots .recompte{display:block;font-size:.76rem;color:var(--ink-suau);font-weight:700;
  font-variant-numeric:tabular-nums;margin-top:3px}
.resum-vot{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin:var(--e2) 0 0}
.resum-vot span{display:flex;flex-direction:column;border:2px solid var(--ink);padding:8px 10px;background:var(--paper-2)}
.resum-vot b{font-family:var(--display);font-size:1.35rem;line-height:1}
.resum-vot small{font-size:.72rem;font-weight:800;color:var(--ink-suau);margin-top:4px}
.resum-vot .favor b{color:#2f8f68}.resum-vot .contra b{color:var(--coral)}.resum-vot .abstencio b{color:#9a7b18}
.nav-fitxa{display:flex;gap:7px;flex-wrap:wrap;margin:var(--e2) 0 0;padding:0;list-style:none}
.nav-fitxa a{display:block;border:1.5px solid var(--vora);border-radius:999px;padding:5px 10px;font-size:.76rem;font-weight:800;text-decoration:none}
.nav-fitxa a:hover,.nav-fitxa a:focus-visible{border-color:var(--coral);color:var(--coral)}
.cronologia{list-style:none;margin:var(--e3) 0 0;padding:0;border-left:3px solid var(--coral)}
.cronologia li{display:grid;grid-template-columns:5rem 1fr;gap:var(--e2);padding:0 0 var(--e2) var(--e3);position:relative}
.cronologia li::before{content:"";position:absolute;left:-7px;top:4px;width:9px;height:9px;border-radius:50%;background:var(--coral);border:2px solid var(--paper)}
.cronologia-any{font-family:var(--display);font-weight:900;font-variant-numeric:tabular-nums}

/* --- què cobra ------------------------------------------------------------
   Una targeta per pagador i cap total: l'import gran, qui el paga al capdamunt
   i la font sempre a la vista. Sense import no hi va un buit sinó el motiu,
   que és el que distingeix «no en cobra» de «qui el paga no ho publica». */
.sous{list-style:none;margin:var(--e2) 0 0;padding:0;display:grid;gap:var(--e2)}
.sous li{background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);
  box-shadow:var(--ombra);padding:var(--e2) var(--e3);display:flex;flex-direction:column;gap:3px}
.sous .ens{font-family:var(--display);font-weight:900;font-size:1.05rem;letter-spacing:-.01em}
.sous .quin{display:block;font-family:var(--text);font-weight:700;font-size:.8rem;
  color:var(--ink-suau);letter-spacing:0;margin-top:2px}
.sous .import{font-family:var(--display);font-weight:900;font-size:1.6rem;
  letter-spacing:-.03em;font-variant-numeric:tabular-nums;margin-top:6px}
.sous .concepte{font-size:.82rem;color:var(--ink-suau);font-weight:700}
.sous .relacio{font-size:.86rem;font-weight:700;margin-top:8px;border-top:1.5px solid var(--vora);
  padding-top:8px;color:var(--ink-suau)}
.sous .relacio b{color:var(--ink)}
.sous .buit{font-size:.9rem;color:var(--ink-suau);font-weight:700;margin-top:6px}
.sous .font{margin-top:8px;font-size:.74rem;font-weight:800;color:var(--ink-suau);
  text-decoration:underline;text-decoration-color:var(--vora);text-underline-offset:2px;align-self:flex-start}
.sous .llicencia{font-size:.72rem;color:var(--ink-suau);font-weight:700;margin-top:4px}
/* La xifra de la seu electrònica no és un sou i no pot semblar-ho: va amb la
   vora ratllada, en cos petit i amb l'avís A SOBRE, perquè qui només miri el
   número gros no en pugui treure la conclusió que la xifra no aguanta. */
.sous li.parcial{border-style:dashed;box-shadow:none;background:none}
.sous li.parcial .import{font-size:1.15rem;color:var(--ink-suau)}
.sous .adverteix{font-size:.88rem;font-weight:700;margin-top:8px;
  border-left:6px solid var(--coral);padding-left:11px}

/* --- el seu pas pel ple ---------------------------------------------------
   Quatre xifres seguides: quant fa que hi seu, a quants plens ha anat, quants
   punts votats en tenim i quants es van decidir per no res. Sense això la
   pàgina d'una regidora sense càrrecs acumulats era mitja pantalla en blanc. */
.pas{list-style:none;margin:var(--e3) 0 0;padding:0;display:grid;gap:var(--e2);
  grid-template-columns:repeat(auto-fit,minmax(160px,1fr))}
.pas li{border-top:2.5px solid var(--ink);padding-top:var(--e2)}
.pas .etq{display:block;font-size:.7rem;font-weight:800;text-transform:uppercase;
  letter-spacing:.09em;color:var(--ink-suau)}
.pas .xifra{display:block;font-family:var(--display);font-weight:900;font-size:1.9rem;
  line-height:1.1;letter-spacing:-.03em;margin-top:4px}
.pas .peu{display:block;font-size:.76rem;color:var(--ink-suau);line-height:1.35;margin-top:5px}
.activitat-vot{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin:var(--e2) 0 0}
.activitat-vot span{border:1.5px solid var(--vora);padding:8px 10px;background:var(--paper-2);display:flex;flex-direction:column}
.activitat-vot b{font-family:var(--display);font-size:1.25rem;line-height:1}
.activitat-vot small{font-size:.7rem;font-weight:800;color:var(--ink-suau);margin-top:4px}

/* --- què en sabem ---------------------------------------------------------
   El bloc únic de qui no tenim ni sou, ni vots, ni fitxa: l'única casella que
   sí que tenim a dalt, i a sota tres línies que diuen què falta i per què.
   L'etiqueta va a l'esquerra amb el mateix cos que les de «.pas», perquè és
   la mateixa cosa dita en una frase en comptes d'en una xifra. */
.fets{list-style:none;margin:var(--e3) 0 0;padding:0}
.fets li{border-top:2.5px solid var(--ink);padding:var(--e2) 0;display:flex;gap:var(--e2);
  flex-wrap:wrap;align-items:baseline}
.fets .etq{flex:0 0 8.5rem;font-size:.7rem;font-weight:800;text-transform:uppercase;
  letter-spacing:.09em;color:var(--ink-suau)}
.fets .fet{flex:1 1 16rem;min-width:0;font-size:.95rem;line-height:1.45}

/* --- més enllà de l'ajuntament -------------------------------------------
   Els càrrecs per sobre de l'ajuntament, un per línia i amb els anys a sota:
   són pocs —qui en té, en té un o dos— i una graella o unes pastilles serien
   disfressar de taulell una frase de dotze paraules. La vora esquerra en coral
   és la mateixa marca que porta l'avís dels sous, i aquí vol dir el mateix:
   «això no ho diu el seu ajuntament». */
.salts{list-style:none;margin:var(--e2) 0 0;padding:0;display:flex;flex-direction:column;gap:8px}
.salts li{border-left:6px solid var(--coral);padding:2px 0 2px 12px;font-weight:700}
.salts .quan{display:block;font-size:.8rem;font-weight:800;color:var(--ink-suau);
  font-variant-numeric:tabular-nums;margin-top:2px}
.ofici-abans{margin:var(--e3) 0 0}
.viqui{margin:var(--e2) 0 0;font-size:.9rem;font-weight:700}

/* --- cap de llista ---------------------------------------------------------
   La pastilla va en lavanda, que és el tercer color de la casa i encara no
   tenia feina en aquesta fila: el coral és l'alcaldia i la menta el govern.
   La frase del bloc porta les xifres en negreta i amb números tabulars, com
   les caselles del pas pel ple: és la mateixa mena de dada, dita en una línia. */
.etiquetes .cap-llista{background:var(--lavanda);color:#1E1B2E}
.encapcala{font-size:1.05rem;line-height:1.5}
.encapcala b{font-variant-numeric:tabular-nums}
/* La frase dels mandats, sota la del càrrec i abans de les pastilles: el gris
   del text secundari, que és el to de la resta de context de la capçalera. */
.persona .mandats{margin:6px 0 0;font-size:.95rem;color:var(--ink-suau);font-weight:700}
.persona .mandats b{color:var(--ink)}

/* --- qui és ----------------------------------------------------------------
   El perfil d'un cap de llista són les mateixes files etiquetades que «Què en
   sabem» —una dada per línia, amb el nom a l'esquerra— i no un bloc nou que
   s'hagi d'aprendre a llegir. Els càrrecs hi van amb la llista de «Més enllà
   de l'ajuntament», que és la mateixa cosa. */
.qui-es .fets{margin-top:var(--e2)}
.qui-es .salts{margin-top:var(--e2)}
`;

/** Tinta llegible damunt del color del grup. Ho decideix `contrast.ts`. */
function tinta(color: string | null): string {
  if (!color) return "inherit";
  if (!/^#[0-9a-f]{3,8}$/i.test(color.trim())) return "inherit";
  return tintaSobre(color);
}

/** Un import publicat, amb qui el paga. Mai dos de sumats. */
type SouPublicat = {
  /** Qui el paga, tal com ho escriu la font. */
  paga: string;
  /** El càrrec pel qual el paga. */
  quin: string | null;
  anualBrut: number | null;
  concepte: string | null;
  dedicacio: string | null;
  any: number | null;
  /** L'import només recull la part d'un pagador i no tot el que cobra pel càrrec. */
  parcial: boolean;
  /**
   * Si l'import és un sou o són assistències i indemnitzacions.
   *
   * «Sense dedicació» amb import no és un sou: són plens i comissions cobrats
   * per sessió, i dir-ne sou faria semblar que una alcaldia de poble cobra 180 €
   * l'any per fer d'alcalde. Un import que no és un sou no es compara amb el
   * salari mínim, que és una comparació entre sous.
   */
  esSou: boolean;
  motiuSenseImport: string | null;
  /**
   * El màxim anual d'indemnitzacions per assistència que publica qui el paga,
   * quan no hi ha cap import fix. **És un sostre, no el que ha cobrat**, i per
   * això no va mai a `anualBrut`: va escrit com a sostre i sense comparació.
   */
  sostreAssistencies?: number | null;
  font: { nom: string; url: string | null; llicencia?: string | null; consultat?: string | null } | null;
  declaracioBens?: string | null;
  /**
   * Si l'avís de la xifra parcial pot citar el cas de Rubí.
   *
   * És l'exemple que ho explica en una frase, però a la pàgina d'algú de Rubí
   * sonaria a que parlem d'una altra persona quan parlaríem d'ella mateixa,
   * i no sabem què cobra: allà l'avís es diu sense l'exemple.
   */
  exempleRubi?: boolean;
};

/**
 * Una targeta per pagador.
 *
 * L'avís de la xifra parcial va **abans** de l'import i no a sota: qui només
 * mira el número gros no ha de poder-ne treure una conclusió que la xifra no
 * aguanta. I una xifra parcial no es compara amb res —comparar-la amb el
 * salari mínim seria tornar-la a presentar com un sou. Tampoc no s'hi compara
 * el que no és un sou: les assistències als plens, ni un sostre.
 *
 * Un zero publicat no és cap buit: és qui paga dient que no paga res per
 * aquest càrrec, i s'escriu així.
 */
function targetaSou(s: SouPublicat): string {
  const detall = [s.concepte, s.dedicacio, s.any === null ? null : `exercici ${s.any}`]
    .filter((t): t is string => typeof t === "string" && t.trim() !== "")
    .map((t) => escape(t))
    .join(" · ");
  const relacio =
    s.parcial || !s.esSou || s.anualBrut === null ? null : contraElSalariMinim(s.anualBrut, s.any);
  const sostre =
    s.sostreAssistencies === null || s.sostreAssistencies === undefined
      ? ""
      : ` El màxim anual per assistències que publica és de <b>${euros(s.sostreAssistencies)}</b>: és un
         sostre, no el que ha cobrat, i no se suma amb res.`;
  return `<li${s.parcial ? ' class="parcial"' : ""}>
      <span class="ens">${escape(s.paga)}${s.quin ? `<span class="quin">${escape(s.quin)}</span>` : ""}</span>
      ${
        s.parcial
          ? `<span class="adverteix">Això <b>no és el que cobra</b>: la seu electrònica només hi recull
             la part que paga l'ajuntament, i el que li pagui una diputació, un consell comarcal o una
             àrea metropolitana per un càrrec que li ve d'aquesta regidoria no hi surt.${
               s.exempleRubi
                 ? " A Rubí l'alcaldessa hi consta amb 17.027 € quan en cobra 107.968."
                 : ""
             }</span>`
          : ""
      }
      ${
        s.anualBrut === null
          ? `<span class="buit">${escape(s.motiuSenseImport ?? "qui el paga no en publica cap import")}.${sostre}</span>`
          : s.anualBrut === 0
            ? `<span class="import">0 €</span>
             <span class="concepte">qui el paga declara que no li paga res per aquest càrrec${
               detall ? ` · ${detall}` : ""
             }</span>`
            : `<span class="import">${euros(s.anualBrut)} l'any bruts</span>
             ${detall ? `<span class="concepte">${detall}</span>` : ""}`
      }
      ${relacio === null ? "" : `<span class="relacio">${relacio}</span>`}
      ${
        s.font
          ? s.font.url
            ? `<a class="font" href="${escape(s.font.url)}" rel="noopener nofollow">${escape(s.font.nom)}</a>`
            : `<span class="font">${escape(s.font.nom)}</span>`
          : ""
      }
      ${
        s.font?.llicencia || s.font?.consultat
          ? `<span class="llicencia">${[
              s.font.llicencia ? escape(s.font.llicencia) : null,
              s.font.consultat ? `consultat ${escape(elDia(s.font.consultat))}` : null,
            ]
              .filter((t): t is string => t !== null)
              .join(" · ")}</span>`
          : ""
      }
      ${
        s.declaracioBens
          ? `<a class="font" href="${escape(s.declaracioBens)}" rel="noopener nofollow">La seva declaració de béns i activitats</a>`
          : ""
      }
    </li>`;
}

/**
 * El bloc «Què cobra».
 *
 * Tres regles dures, i totes tres són per no publicar una xifra que no ha
 * publicat ningú:
 *
 * 1. **Cap import no se suma amb cap altre.** El sou de l'ajuntament i el del
 *    consell comarcal els publiquen dues fonts, sovint de dos anys i amb dos
 *    criteris: el total seria una xifra nova, nostra, que no consta enlloc i
 *    que ningú no podria comprovar. Cada import va a la seva targeta amb qui
 *    el paga al capdamunt, i qui vulgui sumar-los ho farà sabent què suma.
 * 2. **La xifra de la seu electrònica no és el que cobra**, i s'escriu
 *    dient-ho amb totes les lletres. És l'error que més exculpa: a Rubí
 *    l'alcaldessa hi consta amb 17.027 € quan en cobra 107.968 comptant la
 *    Diputació, i publicada com un sou faria quedar barat qui més cobra.
 * 3. **Sense cap import el bloc no desapareix.** Que no ho publiqui ningú és
 *    la situació de la immensa majoria dels 947 i és una dada del ple, no un
 *    buit de la pàgina: si el bloc s'amagués, la pàgina diria exactament el
 *    mateix tant si la persona cobra cent mil euros com si no en cobra cap.
 */
function queCobra(r: Regidor, ctx: ContextRegidor): string {
  const sous: SouPublicat[] = [];
  if (ctx.retribucio) {
    sous.push({
      paga: ctx.retribucio.paga,
      // El càrrec pel qual el paga és el que porta al títol de la pàgina: qui
      // llegeix la targeta ha de veure què és el que es paga, no només qui paga.
      quin: r.carrec,
      anualBrut: ctx.retribucio.anualBrut,
      concepte: null,
      dedicacio: ctx.retribucio.dedicacio,
      any: ctx.retribucio.any,
      parcial: ctx.retribucio.abast === "nomes-ajuntament",
      esSou: true,
      motiuSenseImport: ctx.retribucio.motiuSenseImport ?? null,
      font: ctx.retribucio.font,
      declaracioBens: ctx.retribucio.declaracioBens ?? null,
      exempleRubi: !/^rub[íi]$/i.test(ctx.municipi.trim()),
    });
  }
  /*
   * El que l'ajuntament declara al Ministeri de la seva alcaldia. Qui el paga
   * és l'ajuntament; qui ho publica, el Ministeri, i la targeta ho diu així.
   * Tres casos i cap no es confon amb els altres: un sou; assistències, que
   * es diuen assistències; i res, que es diu que no cobra res de l'ajuntament.
   * Si l'alcaldia ha canviat de mans dins del mandat, el total de l'any no és
   * d'una sola persona i no se li penja: es diu per què.
   */
  const m = ctx.alcaldiaSegonsMinisteri;
  if (m) {
    const exercici = m.any === null ? "" : ` el ${m.any}`;
    const font = {
      nom: `${m.font.organisme}: ${m.font.nom}`,
      url: m.font.url,
      llicencia: m.font.llicencia,
      consultat: m.font.consultat,
    };
    if (m.canviDAlcaldia) {
      sous.push({
        paga: `Ajuntament ${de(ctx.municipi)}`,
        quin: "alcaldia, segons el que l'ajuntament declara al Ministeri",
        anualBrut: null,
        concepte: null,
        dedicacio: null,
        any: m.any,
        parcial: false,
        esSou: false,
        motiuSenseImport:
          `el Ministeri publica el total que va cobrar l'alcaldia${exercici}, però en aquest mandat ` +
          "l'alcaldia ha canviat de mans i aquell total no és d'una sola persona: no l'atribuïm a ningú",
        font,
      });
    } else if (m.mena === "cap") {
      sous.push({
        paga: `Ajuntament ${de(ctx.municipi)}`,
        quin: "alcaldia, segons el que l'ajuntament declara al Ministeri",
        anualBrut: null,
        concepte: null,
        dedicacio: m.regim,
        any: m.any,
        parcial: false,
        esSou: false,
        motiuSenseImport: `no cobra res de l'ajuntament: sense dedicació i sense cap import declarat${exercici}`,
        font,
      });
    } else {
      sous.push({
        paga: `Ajuntament ${de(ctx.municipi)}`,
        quin: "alcaldia, segons el que l'ajuntament declara al Ministeri",
        anualBrut: m.euros,
        concepte:
          m.mena === "sou"
            ? "total percebut"
            : "sense dedicació: no és un sou, són assistències als plens i indemnitzacions",
        dedicacio: `règim «${m.regim}»`,
        any: m.any,
        parcial: false,
        esSou: m.mena === "sou",
        motiuSenseImport: null,
        font,
      });
    }
  }
  for (const a of ctx.altresCarrecs) {
    sous.push({
      paga: a.ens,
      quin: a.carrec,
      anualBrut: a.anualBrut,
      concepte: a.concepte,
      dedicacio: a.dedicacio,
      any: null,
      parcial: false,
      esSou: true,
      motiuSenseImport: a.motiuSenseImport,
      sostreAssistencies: a.sostreAssistencies ?? null,
      font: a.font,
    });
  }

  const avisos = [
    ctx.retribucio?.avis ?? null,
    ctx.alcaldiaSegonsMinisteri?.avis ?? null,
    ctx.altresCarrecs.length > 0 ? ctx.avisRetribucions : null,
  ]
    .filter((t): t is string => typeof t === "string" && t.trim() !== "")
    .map((t) => `<p class="nota oberta">${escape(t)}</p>`)
    .join("");

  if (sous.length === 0) {
    const p = ctx.publicaDeLaPersona;
    /*
     * Quan la seu electrònica sí que publica una xifra, obrir el bloc amb «no
     * en tenim cap import» xocava amb el ✓ del bloc del costat i es llegia com
     * un error de la pàgina. La xifra existeix i es diu primer; el que no
     * canvia és que no es reprodueix, perquè només recull la part que paga
     * l'ajuntament i llegida com «el que cobra» exculparia.
     */
    if (p && p.retribucio === "xifra") {
      return `<section class="bloc" id="que-cobra">
    <h2>Què cobra</h2>
    <p class="entrada-bloc">L'ajuntament <b>en publica una xifra</b> a la seu electrònica: la part
    que paga ell mateix.</p>
    <p>No la reproduïm aquí perquè <b>no és el que cobra</b>: deixa fora el que li pagui qualsevol
    altra administració —una diputació, un consell comarcal, una àrea metropolitana— per càrrecs
    que vénen d'aquesta regidoria, i una xifra curta llegida com el sou sencer exculpa.${
      p.fitxa
        ? ` <a href="${escape(p.fitxa)}" rel="noopener nofollow">La xifra, a la seva fitxa de la seu electrònica</a>.`
        : ""
    }</p>
    <p class="nota">Quan qui paga en publiqui l'import sencer sortirà aquí, amb qui el paga al
    costat i sense sumar-lo amb cap altre.</p>
    ${avisos}
  </section>`;
    }
    return `<section class="bloc" id="que-cobra">
    <h2>Què cobra</h2>
    <p class="entrada-bloc">De ningú que li pagui aquest càrrec no en tenim cap import comprovat.</p>
    <p>Que no en tinguem <b>no vol dir que no en cobri</b>: vol dir que qui el paga no en publica la
    xifra, o que la publica d'una manera que encara no hem pogut llegir i comprovar. Dir-ho és una
    dada del ple i no un buit d'aquesta pàgina: sense aquesta línia, la pàgina diria el mateix tant
    si en cobra cent mil euros com si no en cobra cap.</p>
    <p class="nota">Qui n'hauria de publicar l'import és qui el paga: l'ajuntament del que li
    paga l'ajuntament, i cada altre ens del que li paga ell. Quan en tinguem un de comprovat
    sortirà aquí, amb qui el paga al costat i sense sumar-lo amb cap altre.</p>
    ${avisos}
  </section>`;
  }

  const nomesParcial = sous.every((s) => s.parcial);
  // Les targetes sense import —«no cobra res», «no ho publica»— no es compten
  // com a imports: dir «dos imports» amb una targeta que diu que no en cobra
  // cap seria comptar el buit com si fos una xifra.
  const ambImport = sous.filter((s) => s.anualBrut !== null).length;
  return `<section class="bloc" id="que-cobra">
    <h2>Què cobra</h2>
    <p class="entrada-bloc">${
      ambImport === 0
        ? "Cap import, però sí el que en diu qui el paga."
        : ambImport === 1
          ? `Un import, amb qui el paga${sous.length > 1 ? ", i el que en diuen els altres que li paguen un càrrec" : ""}.`
          : `${ambImport} imports, cadascun amb qui el paga.`
    } <b>No n'hi ha cap total</b>: sumar xifres que publiquen fonts diferents, d'anys diferents i amb
    criteris diferents donaria una xifra que no ha publicat ningú i que ningú no podria comprovar.</p>
    <ul class="sous">${sous.map((s) => targetaSou(s)).join("")}</ul>
    ${
      nomesParcial
        ? `<p class="nota">L'única xifra que en tenim és parcial, i per això no hi ha cap comparació:
           posar-la al costat del salari mínim seria presentar-la com un sou quan no ho és.</p>`
        : ""
    }
    ${avisos}
  </section>`;
}

/** Una xifra amb l'etiqueta a sobre i, a sota, el peu que diu d'on surt. */
const casella = (etq: string, xifra: string, peu: string): string =>
  `<li><span class="etq">${etq}</span><span class="xifra">${xifra}</span><span class="peu">${peu}</span></li>`;

/**
 * La casella «Fa que hi seu», o `null` quan no hi ha res a dir.
 *
 * És la mateixa al bloc del pas pel ple i al bloc únic de qui no en sabem res,
 * perquè la data és la mateixa i s'ha d'escriure igual. Qui va entrar a mig
 * mandat no hi seu des de la constitució, i comptar-li el mandat sencer seria
 * escriure una data falsa sobre una persona. Sense cap data no s'escriu res
 * —ni «no consta»—, llevat que sapiguem que va entrar tard: llavors la data
 * existeix, no la tenim, i dir-ho és la dada.
 */
function casellaDesDe(r: Regidor, ctx: ContextRegidor, generatedAt: string): string | null {
  const desDe = r.desDe ?? (r.entradaTardana ? null : ctx.mandat?.constitucio ?? null);
  if (desDe) {
    const temps = faQue(desDe, generatedAt);
    if (!temps) return null;
    return casella(
      "Fa que hi seu",
      escape(temps),
      r.desDe
        ? `des ${escape(delDia(desDe))}, el dia que consta que va prendre possessió`
        : `des ${escape(delDia(desDe))}, quan es va constituir el ple${
            ctx.mandat?.nom ? ` del mandat ${escape(ctx.mandat.nom)}` : ""
          }`,
    );
  }
  if (r.entradaTardana) {
    return casella(
      "Fa que hi seu",
      "no consta",
      "va entrar a mig mandat i no en tenim el dia: sense la data no ens l'inventem",
    );
  }
  return null;
}

/**
 * «les 40 actes indexades, totes llegides», «38 actes llegides de les 40
 * indexades» o «12 actes llegides»: el mateix vocabulari que la fitxa del
 * municipi, que diu «Tenim indexades 40 actes». Dues pàgines que s'enllacen
 * entre elles no poden dir «indexades» i «llegides» com si fossin coses
 * diferents; quan la mètrica no porta les indexades, es diu només el que sabem.
 */
function quantesActes(ctx: ContextRegidor): string {
  const n = ctx.actesLlegides;
  const llegides = `${n} ${n === 1 ? "acta llegida" : "actes llegides"}`;
  const i = ctx.actesIndexades ?? null;
  if (i === null || i <= 0) return llegides;
  if (i === n) return `les ${n} actes indexades, totes llegides`;
  return `${llegides} de les ${i} indexades`;
}

/**
 * El bloc «El seu pas pel ple»: quant fa que hi seu, quants plens ha fet i
 * quants punts en tenim del seu vot.
 *
 * La fitxa d'una regidora sense càrrecs acumulats eren quatre seccions i mitja
 * pantalla en blanc. Tot el que hi ha aquí ja era al context i no ho llegia
 * ningú: es diu junt, en xifres, i cadascuna amb el peu que diu d'on surt i
 * què no vol dir.
 */
function pasPelPle(r: Regidor, ctx: ContextRegidor, generatedAt: string): string {
  const caselles: string[] = [];
  const desDe = casellaDesDe(r, ctx, generatedAt);
  if (desDe) caselles.push(desDe);

  if (ctx.assistencia && ctx.assistencia.de >= 5) {
    caselles.push(
      casella(
        "Plens",
        `${ctx.assistencia.hi} de ${ctx.assistencia.de}`,
        `dels plens on l'acta dona la llista d'assistents. <b>Una absència no és una falta</b>: hi ha
         baixes, permisos i motius que l'acta no explica, i nosaltres tampoc`,
      ),
    );
  }

  const renyits = ctx.votsDelGrup.filter((v) => v.marge !== null && v.marge <= 2).length;
  const votsDeterminats = ctx.votsDelGrup.filter((v) => v.tot);
  const comptaSentit = (sentit: string): number => votsDeterminats.filter((v) => v.sentit === sentit).length;
  const activitatVot = votsDeterminats.length > 0
    ? `<div class="activitat-vot" aria-label="Resum de l'activitat de vot"><span><b>${comptaSentit("favor")}</b><small>a favor</small></span><span><b>${comptaSentit("contra")}</b><small>en contra</small></span><span><b>${comptaSentit("abstencio")}</b><small>abstencions</small></span><span><b>${Math.round((100 * votsDeterminats.length) / ctx.votsDelGrup.length)}%</b><small>vot atribuïble</small></span></div>`
    : "";
  caselles.push(
    casella(
      "Punts votats",
      ctx.votsDelGrup.length === 0 ? "no disponible" : String(ctx.votsDelGrup.length),
      ctx.votsDelGrup.length === 0
        ? ctx.actesLlegides === 0
          ? "d'aquest ajuntament encara no n'hem pogut llegir cap acta"
          : (ctx.puntsAmbDesglos ?? 0) > 0
            ? `de ${quantesActes(ctx)}, no hem sabut reconèixer el seu grup en cap votació`
            : `de ${quantesActes(ctx)}, no n'hem sabut llegir cap vot per grup`
        : `${
            ctx.votsDelGrup.length === 1 ? "punt del ple" : "punts del ple"
          } on l'acta desglossa el vot del seu grup, de ${quantesActes(ctx)}`,
    ),
  );
  if (ctx.votsDelGrup.length > 0) {
    caselles.push(
      casella(
        "Decidits per no res",
        String(renyits),
        renyits === 0
          ? "cap dels punts que hem pogut llegir no es va decidir per dos vots o menys"
          : `d'aquells punts es van decidir <b>per dos vots o menys</b>: són els que separen qui és qui`,
      ),
    );
  }

  return `<section class="bloc" id="pas-pel-ple">
    <h2>El seu pas pel ple</h2>
    <ul class="pas">${caselles.join("")}</ul>
    ${activitatVot}
    ${votsDeterminats.length > 0 && votsDeterminats.length < ctx.votsDelGrup.length ? `<p class="nota">En ${votsDeterminats.length} punts el grup va votar sencer i el sentit es pot atribuir a aquesta persona. En els altres ${ctx.votsDelGrup.length - votsDeterminats.length}, l'acta només permet atribuir el vot al grup.</p>` : ""}
    ${
      ctx.assistencia && ctx.assistencia.de >= 5
        ? `<p class="nota">L'assistència la diu l'acta de cada sessió al seu capçal, i és
           <b>l'única dada d'aquesta pàgina que és de la persona i no del grup</b>: anar o no anar a
           un ple no ho decideix ningú més. No en tenim la llista de tots els plens: ${
             ctx.assistencia.de
           } de ${ctx.actesLlegides} actes llegides la porten, i les altres no diuen qui hi era.</p>`
        : ctx.assistencia
          ? `<p class="nota">De l'assistència només en tenim ${ctx.assistencia.de} ${
              ctx.assistencia.de === 1 ? "acta" : "actes"
            } amb la llista de qui hi era, i amb tan poques una absència no vol dir res: no en
            publiquem el compte fins que en tinguem cinc.</p>`
          : `<p class="nota">De l'assistència no en podem dir res: ${
              ctx.actesLlegides === 0
                ? "d'aquest ajuntament encara no hem pogut llegir cap acta"
                : "cap de les actes que hem llegit d'aquest ajuntament no porta la llista de qui hi era"
            }.</p>`
    }
  </section>`;
}

/**
 * Si d'aquesta persona no en sabem res més que on seu.
 *
 * És el cas de la majoria de les 4.834: cap sou publicat per ningú, cap acta
 * amb el vot desglossat, cap fitxa a Wikidata i massa poques llistes
 * d'assistents per comptar-les. Cadascun dels tres blocs que ho diuen —«Què
 * cobra», «El seu pas pel ple», «Què ha votat»— es quedava amb el seu titular
 * i la seva frase de «no ho sabem», i la pàgina sencera n'era la suma.
 *
 * Una fitxa de la seu sense import (`retribucio` amb `anualBrut` nul) no és no
 * saber-ne res: hi ha una font que diu que no el publica, i allò va a la seva
 * targeta amb el motiu. El mateix amb un càrrec en un altre ens sense xifra.
 */
const noEnSabemRes = (ctx: ContextRegidor): boolean =>
  !ctx.retribucio &&
  !ctx.alcaldiaSegonsMinisteri &&
  ctx.altresCarrecs.length === 0 &&
  ctx.votsDelGrup.length === 0 &&
  !ctx.trajectoria &&
  !(ctx.assistencia && ctx.assistencia.de >= 5);

/**
 * El bloc únic de qui no en sabem res.
 *
 * Tres blocs seguits que diuen tots tres «no ho sabem» no són tres dades: són
 * una, dita tres vegades, i qui acaba la pàgina en surt amb la sensació que
 * aquesta persona hi és menys que les altres. Es diu un sol cop, sota un sol
 * titular, i darrere de l'única xifra que sí que tenim: quant fa que hi seu.
 *
 * El que no canvia és què es diu. Cada absència continua escrita amb el seu
 * motiu, perquè «no en tenim cap import» i «no en cobra» són dues frases
 * diferents i la pàgina no pot deixar que una sembli l'altra: sense aquestes
 * línies, la pàgina diria el mateix tant si en cobra cent mil euros com si no
 * en cobra cap.
 */
function queEnSabem(r: Regidor, ctx: ContextRegidor, generatedAt: string): string {
  const desDe = casellaDesDe(r, ctx, generatedAt);
  const p = ctx.publicaDeLaPersona;
  const actes = ctx.actesLlegides;
  const fet = (etq: string, text: string): string =>
    `<li><span class="etq">${etq}</span><span class="fet">${text}</span></li>`;
  return `<section class="bloc" id="que-en-sabem">
    <h2>Què en sabem</h2>
    <p class="entrada-bloc">${
      desDe ? "Quant fa que hi seu, i tres coses" : "Tres coses"
    } que encara no en sabem, cadascuna amb el motiu.</p>
    ${desDe ? `<ul class="pas">${desDe}</ul>` : ""}
    <ul class="fets">
      ${fet(
        "Què cobra",
        `De ningú que li pagui aquest càrrec no en tenim cap import comprovat, i
         <b>no vol dir que no en cobri</b>: vol dir que qui el paga no en publica la xifra, o la
         publica d'una manera que encara no hem pogut llegir i comprovar.${
           p && p.retribucio === "xifra"
             ? ` El seu ajuntament sí que en publica una a la fitxa del càrrec, però
                <b>només recull la part que paga ell mateix</b>: no és el que cobra, i per això no
                la copiem aquí com si ho fos.${
                  p.fitxa
                    ? ` <a href="${escape(p.fitxa)}" rel="noopener nofollow">La fitxa, a la seu electrònica</a>.`
                    : ""
                }`
             : ""
         }`,
      )}
      ${fet(
        "Què ha votat",
        actes === 0
          ? `D'aquest ajuntament <b>encara no n'hem pogut llegir cap acta</b>, i sense actes no podem
             dir què ha votat: preferim dir-ho a omplir-ho amb suposicions.`
          : (ctx.puntsAmbDesglos ?? 0) > 0
            ? `De ${quantesActes(ctx)} n'hem pogut llegir vots per grup, però <b>no hem sabut
               reconèixer-hi el seu</b>: abans d'atribuir-li el vot d'un altre grup, no en diem cap.`
            : `De ${quantesActes(ctx)}, <b>no n'hem sabut llegir cap vot desglossat per grup</b>:
               n'hi pot haver escrit d'una manera que el nostre lector d'actes encara no entén, i
               sense això no podem dir què ha votat. Preferim dir-ho a omplir-ho amb suposicions.`,
      )}
      ${fet(
        "Plens",
        actes === 0
          ? "Tampoc no sabem a quants plens ha anat: la llista de qui hi era la porta l'acta, i sense actes no hi ha llista."
          : ctx.assistencia
            ? `Només ${
                ctx.assistencia.de === 1 ? "una acta porta" : `${ctx.assistencia.de} actes porten`
              } la llista de qui hi era, i amb tan poques una absència no vol dir res:
              no diem a quants plens ha anat fins que en tinguem cinc.`
            : `Cap de les actes que hem llegit no porta la llista de qui hi era, i per això no podem
               dir a quants plens ha anat.`,
      )}
    </ul>
    <p class="nota">Que tot això falti és una dada del ple i no un buit d'aquesta pàgina: sense
    aquestes línies, la pàgina diria el mateix tant si en cobra cent mil euros com si no en cobra
    cap. Qui n'hauria de publicar l'import és qui el paga; el vot i l'assistència els diu l'acta
    de cada sessió. Quan en tinguem res de comprovat sortirà aquí, amb la font al costat.</p>
  </section>`;
}

/** Els anys d'un càrrec, tal com els dona la font i sense inventar-ne cap. */
function anysDelCarrec(inici: string | null, fi: string | null): string {
  if (inici === null) return fi === null ? "" : `fins al ${fi.slice(0, 4)}`;
  const desDe = inici.slice(0, 4);
  if (fi === null) return `des del ${desDe}`;
  const fins = fi.slice(0, 4);
  return fins === desDe ? desDe : `${desDe}–${fins}`;
}

/**
 * On ha arribat aquesta persona per sobre del seu ajuntament, i què feia abans.
 *
 * És el bloc que tanca el cercle amb /observatori/trajectoria/: aquella pàgina
 * llista les 283 persones que han fet el salt i el seu nom porta aquí, i aquí
 * es diu el mateix de la persona i es torna cap allà. Que una de les dues ho
 * digués i l'altra no era el defecte que es corregeix.
 *
 * Wikidata **no és un cens**: dels que han fet el salt, el 95,8 % té article a
 * la Viquipedia, i dels que no consta que l'hagin fet, només el 12,9 %. O sigui
 * que el silenci d'aquest bloc no vol dir que la persona no hagi estat enlloc,
 * vol dir que no ho sabem —i per això, quan no en sabem res, no s'escriu ni una
 * línia en comptes d'escriure «no consta que hagi estat res».
 */
function mesEnllaDelPle(ctx: ContextRegidor): string {
  const t = ctx.trajectoria;
  if (!t) return "";
  const salts = t.carrecs
    .map((c) => {
      const quan = anysDelCarrec(c.inici, c.fi);
      return `<li>${escape(c.nom)}${quan === "" ? "" : `<span class="quan">${escape(quan)}</span>`}</li>`;
    })
    .join("");
  if (t.origen === "caps-de-llista") return quiEs(t, salts);
  return `<section class="bloc" id="mes-enlla">
    <h2>Més enllà de l'ajuntament</h2>
    ${
      t.carrecs.length === 0
        ? ""
        : `<p class="entrada-bloc">${
            t.carrecs.length === 1 ? "També ha ocupat aquest càrrec" : "També ha ocupat aquests càrrecs"
          } per sobre del seu ajuntament, i per això és a
          <a href="../../../../trajectoria/">la llista dels alcaldes que han fet el salt</a>.</p>
          <ul class="salts">${salts}</ul>`
    }
    ${
      t.ocupacions.length === 0
        ? ""
        : `<p class="ofici-abans">Abans de la política hi consta com a
           <b>${escape(t.ocupacions.join(", "))}</b>.</p>`
    }
    ${
      t.viquipedia === null
        ? ""
        : `<p class="viqui"><a href="${escape(t.viquipedia)}" rel="noopener nofollow">La seva pàgina a la Viquipèdia</a>.</p>`
    }
    <p class="nota">${escape(t.font)}, ítem
    <a href="${escape(t.url)}" rel="noopener nofollow">${escape(t.qid)}</a>${
      t.descarregat === null ? "" : `, consultat ${escape(elDia(t.descarregat))}`
    }. Les dades de Wikidata són <b>${escape(t.llicencia)}</b>.${
      t.aparellat
        ? " El nom i les dates lliguen amb el nostre historial oficial d'alcaldies."
        : " <b>Les dates no lliguen del tot amb el nostre historial oficial d'alcaldies</b>, i per això ho publiquem dient-ho: és el que diu Wikidata, no una comprovació nostra."
    } Wikidata l'escriu qui vol, i cobreix molt millor la gent coneguda: que aquí no hi surti res
    d'algú no vol dir que no hagi estat enlloc.</p>
  </section>`;
}

const MOTIU_APARELLAMENT: Record<NonNullable<NonNullable<ContextRegidor["trajectoria"]>["motiu"]>, string> = {
  "carrec-al-municipi": "la fitxa li dona un càrrec en aquest mateix municipi",
  "lloc-al-municipi": "la fitxa diu que hi va néixer o que hi viu",
  "partit-i-catalunya": "la fitxa la dona del mateix partit i amb arrels a Catalunya",
};

/**
 * El bloc «Qui és» de qui va encapçalar una llista el 2023 i no és alcalde.
 *
 * És el perfil que J27 ha trobat a Wikidata: any de naixement, ofici, partit,
 * càrrecs amb dates i article. Cada línia és una dada de la font, amb el seu
 * nom a l'esquerra, i el peu diu no només d'on surt sinó **per què diem que
 * aquesta fitxa és aquesta persona**: buscar per nom és trobar homònims, i
 * qui llegeix ha de poder jutjar el lligam que hem exigit.
 */
function quiEs(t: NonNullable<ContextRegidor["trajectoria"]>, salts: string): string {
  const fet = (etq: string, text: string): string =>
    `<li><span class="etq">${etq}</span><span class="fet">${text}</span></li>`;
  const fets: string[] = [];
  if (t.naixement !== null && t.naixement !== undefined) fets.push(fet("Naixement", String(t.naixement)));
  if (t.ocupacions.length > 0) fets.push(fet("Ofici", escape(t.ocupacions.join(", "))));
  if (t.partit) fets.push(fet("Partit", escape(t.partit)));
  const articles = [
    t.viquipedia ? `<a href="${escape(t.viquipedia)}" rel="noopener nofollow">a la Viquipèdia</a>` : null,
    t.wikipediaEs ? `<a href="${escape(t.wikipediaEs)}" rel="noopener nofollow">a la Wikipedia en castellà</a>` : null,
  ].filter((a): a is string => a !== null);
  if (articles.length > 0) fets.push(fet("Article", articles.join(" · ")));
  return `<section class="bloc qui-es" id="qui-es">
    <h2>Qui és</h2>
    <p class="entrada-bloc">El que Wikidata en sap, més enllà d'on seu.</p>
    ${fets.length > 0 ? `<ul class="fets">${fets.join("")}</ul>` : ""}
    ${
      t.carrecs.length === 0
        ? ""
        : `<p class="ofici-abans">${
            t.carrecs.length === 1 ? "El càrrec que hi consta" : "Els càrrecs que hi consten"
          }, amb les dates que en dona la font:</p>
          <ul class="salts">${salts}</ul>`
    }
    <p class="nota">${escape(t.font)}, ítem
    <a href="${escape(t.url)}" rel="noopener nofollow">${escape(t.qid)}</a>${
      t.descarregat === null ? "" : `, consultat ${escape(elDia(t.descarregat))}`
    }. Les dades de Wikidata són <b>${escape(t.llicencia)}</b>. L'hem lligada pel nom, i no només pel
    nom: ${escape(t.motiu ? MOTIU_APARELLAMENT[t.motiu] : "la fitxa lliga amb el municipi o amb el partit")}.
    Wikidata l'escriu qui vol, i cobreix molt millor la gent coneguda: el que no hi surt no vol dir
    que no sigui.</p>
  </section>`;
}

/** «segona», «tercera»… la força que va ser una llista per vots. */
function ordinalForca(n: number): string {
  const nomes = ["primera", "segona", "tercera", "quarta", "cinquena", "sisena", "setena", "vuitena", "novena", "desena"];
  return nomes[n - 1] ?? `${n}a`;
}

/** «del <b>2015</b>, del <b>2019</b> i del <b>2023</b>», per a les frases d'anys. */
function delsAnys(anys: readonly number[]): string {
  const parts = anys.map((a) => `del <b>${a}</b>`);
  if (parts.length === 1) return parts[0]!;
  return `${parts.slice(0, -1).join(", ")} i ${parts[parts.length - 1]}`;
}

/**
 * La frase dels mandats, sota la del càrrec: quantes municipals l'han elegit
 * en aquest ple i des de quan.
 *
 * Només s'escriu quan el registre porta més d'una municipal del municipi, i
 * parla d'**eleccions, no de cadires**: la font són les candidatures amb
 * `electe` (J4), i qui va entrar a mig mandat d'un ple antic per substitució
 * no hi consta. Per això «elegida per primera vegada el 2023» és una frase
 * que la font aguanta i «primer mandat» no ho seria —podria haver segut abans
 * sense sortir-ne elegida—. L'únic ordinal que es conserva és el de la tanda
 * seguida, on cada municipal l'ha elegida i la cadira es resegueix sencera.
 * Pel mateix motiu, de les llistes on va anar sense sortir-ne se'n diu això
 * mateix —«sense sortir-ne elegida»— i no «sense entrar al ple», que la font
 * no pot saber.
 */
function fraseMandats(r: Regidor, ctx: ContextRegidor): string {
  const m = ctx.mandats;
  if (!m) return "";
  const fem = /a$/i.test(r.carrec.trim());
  const elegit = fem ? "elegida" : "elegit";
  const ordinals = ["primer", "segon", "tercer", "quart", "cinquè", "sisè", "setè", "vuitè", "novè", "desè"];
  const ordinal = ordinals[m.quants - 1] ?? `${m.quants}è`;
  const majuscula = `${elegit.charAt(0).toUpperCase()}${elegit.slice(1)}`;
  const principal =
    m.quants === 1
      ? `${majuscula} <b>per primera vegada</b> a les municipals del ${m.primer}, fins on arriba
         el registre de llistes (cobreix des del ${m.cobertesDesDe})`
      : m.seguits
        ? `Al ple des del <b>${m.primer}</b>${
            m.iniciConegut ? "" : ", que és fins on arriba el registre"
          }: <b>${ordinal} mandat</b> seguit`
        : `${majuscula} a les municipals ${delsAnys(m.anys)}`;
  const llistes =
    m.llistesSenseEntrar.length === 0
      ? ""
      : ` També havia anat en una llista ${
          m.llistesSenseEntrar.length === 1
            ? `el ${m.llistesSenseEntrar[0]}`
            : `els anys ${m.llistesSenseEntrar.join(" i ")}`
        } sense sortir-ne ${elegit}.`;
  return `<p class="mandats">${principal}.${llistes}</p>`;
}

/**
 * La línia de les llistes on ha anat: any per any, amb el número, la llista i
 * si en va sortir. És la resposta directa a «quantes vegades s'ha presentat»,
 * que la frase dels mandats només respon a mitges: aquella parla de les
 * municipals que el van elegir, i aquesta també de les que no.
 *
 * Les sigles s'escriuen el primer any i quan canvien, no a cada any: «2015:
 * núm. 8 amb ERC-AM · 2019: núm. 4» ja diu que el 2019 hi anava amb la
 * mateixa llista, i repetir-les cada vegada faria la línia il·legible.
 */
function fraseLlistes(r: Regidor, ctx: ContextRegidor): string {
  const anades = ctx.llistes;
  if (!anades || anades.length === 0) return "";
  const fem = /a$/i.test(r.carrec.trim());
  const elegit = fem ? "elegida" : "elegit";
  let anteriors: string | null = null;
  const trossos = anades.map((a) => {
    const numero = a.capDeLlista ? "cap de llista" : a.posicio === null ? null : `núm. ${a.posicio}`;
    const sigles = a.sigles === anteriors ? null : `amb ${escape(a.sigles)}`;
    anteriors = a.sigles;
    const que = [numero, sigles].filter((t): t is string => t !== null).join(" ");
    return `<b>${a.any}</b>: ${que === "" ? "" : `${que} `}(${a.elegit ? elegit : `no ${elegit}`})`;
  });
  return `<p class="mandats">Les llistes on ha anat — ${trossos.join(" · ")}.</p>`;
}

/**
 * El bloc «Com a cap de llista»: una frase amb el que va treure la llista que
 * encapçalava i si té l'alcaldia.
 *
 * Són xifres de la candidatura, no de la persona —a les municipals es voten
 * llistes—, però és la persona per qui es va votar aquella llista, i la
 * pàgina que porta el seu nom ha de dir com li va anar. Només per a qui hi
 * anava de número u: els altres porten el número a la pastilla i prou.
 *
 * De l'alcaldia se'n diu el que sabem i res més: si la té ella, si la té la
 * seva llista amb una altra persona, o si no la va aconseguir; i quan no
 * sabem de qui és, la frase s'acaba abans.
 */
function comACapDeLlista(r: Regidor, ctx: ContextRegidor): string {
  const c = ctx.capDeLlista;
  if (!c || !c.es) return "";
  const alcaldia = /^alcald/i.test(r.carrec.trim())
    ? " I té l'alcaldia."
    : c.teAlcaldia === true
      ? " L'alcaldia és de la seva llista, però l'ocupa una altra persona."
      : c.teAlcaldia === false
        ? c.vaGuanyar
          ? " Va guanyar les eleccions i no té l'alcaldia."
          : " No va aconseguir l'alcaldia."
        : "";
  const forca =
    c.forces > 1 ? `, la <b>${ordinalForca(c.forca)} força</b> de ${c.forces}` : ", l'única candidatura";
  return `<section class="bloc" id="cap-de-llista">
    <h2>Com a cap de llista</h2>
    <p class="encapcala">Va encapçalar la llista de <b>${escape(c.sigles)}</b> a les municipals del
    2023: <b>${c.vots.toLocaleString("ca-ES")} vots</b> i <b>${c.regidories} ${
      c.regidories === 1 ? "regidoria" : "regidories"
    }</b>${forca}.${alcaldia}</p>
    <p class="nota">Vots i regidories de la candidatura, de les dades obertes electorals de la
    Generalitat de Catalunya; el cap de llista, de les candidatures proclamades. Són xifres de la
    llista i no de la persona: a les municipals es voten llistes.
    <a href="../../${escape(slugify(c.sigles))}/">La pàgina de ${escape(c.sigles)} a ${escape(ctx.municipi)}</a>.</p>
  </section>`;
}

/**
 * D'on surten els vots, dit al peu de la llista i amb la llicència que la font
 * declara —no una de suposada. A Barcelona és el registre de votacions del
 * plenari, sota l'avís legal de l'Ajuntament; a la resta, les actes llegides.
 */
function fontDelsVots(ctx: ContextRegidor): string {
  const f = ctx.fontVots;
  if (!f) return "";
  const nom = f.url
    ? `<a href="${escape(f.url)}" rel="noopener nofollow">${escape(f.nom)}</a>`
    : escape(f.nom);
  const llicencia = f.llicencia
    ? `, sota ${f.llicenciaUrl ? `<a href="${escape(f.llicenciaUrl)}" rel="noopener nofollow">${escape(f.llicencia)}</a>` : escape(f.llicencia)}`
    : "";
  const consultat = f.consultat ? `, consultat ${escape(elDia(f.consultat))}` : "";
  return `<p class="nota font-vots">Font dels vots: ${nom}${llicencia}${consultat}.</p>`;
}

/**
 * El bloc «Què ha votat»: els punts del ple on consta el sentit del vot del
 * seu grup, començant pels més renyits, i quan es pot dir què va votar ella.
 */
function queHaVotat(ctx: ContextRegidor): string {
  const vots = ctx.votsDelGrup
    .slice(0, 40)
    .map((v) => {
      const s = SENTITS[v.sentit] ?? { text: v.sentit, grup: v.sentit, classe: "" };
      const renyida = v.marge !== null && v.marge <= 2;
      return `<li${renyida ? ' class="renyida"' : ""}>
      <span class="data">${escape(v.data)}</span>
      <span class="titol"><a href="${escape(v.url)}" target="_blank" rel="noopener">${escape(v.titol)}</a>
        ${
          v.marge === null
            ? ""
            : `<span class="recompte">${v.favor} a favor · ${v.contra} en contra${renyida ? " · <b>per " + v.marge + (v.marge === 1 ? " vot" : " vots") + "</b>" : ""}</span>`
        }</span>
      <span class="sentit ${s.classe}${v.tot ? "" : " del-grup"}">${escape(v.tot ? s.text : s.grup)}</span>
    </li>`;
    })
    .join("");

  // El resum que quaranta files seguides no donen: de quants punts es pot dir
  // què va votar aquesta persona, i quantes vegades va dir que sí i que no.
  // Només compta els punts on el grup hi va votar sencer, que són els únics on
  // el vot queda determinat; als altres el compte seria del grup i no seu.
  const propis = ctx.votsDelGrup.filter((v) => v.tot);
  const compte = (sentit: string): number => propis.filter((v) => v.sentit === sentit).length;
  const abstencions = compte("abstencio");
  const resumComptes = propis.length > 0
    ? `<div class="resum-vot" aria-label="Resum dels vots atribuïbles a la persona"><span class="favor"><b>${compte("favor")}</b><small>a favor</small></span><span class="contra"><b>${compte("contra")}</b><small>en contra</small></span><span class="abstencio"><b>${abstencions}</b><small>abstencions</small></span><span><b>${ctx.votsDelGrup.length - propis.length}</b><small>només del grup</small></span></div>`
    : "";
  const resumDelVot =
    propis.length === 0
      ? ""
      : `<p class="destacat">${
          ctx.votsDelGrup.length === 1
            ? "De l'únic punt que n'hem pogut llegir"
            : `Dels ${ctx.votsDelGrup.length} punts`
        }, ${
          propis.length === ctx.votsDelGrup.length ? "en tots" : `en <b>${propis.length}</b>`
        } el seu grup hi va votar sencer i el vot queda determinat:
        <b>${compte("favor")}</b> a favor, <b>${compte("contra")}</b> en contra i
        <b>${abstencions}</b> ${abstencions === 1 ? "abstenció" : "abstencions"}.</p>`;

  return `<section class="bloc" id="que-ha-votat">
    <h2>Què ha votat</h2>
    ${
      ctx.votsDelGrup.length === 0
        ? `<p>${
            ctx.actesLlegides === 0
              ? `D'aquest ajuntament <b>encara no hem pogut llegir cap acta</b> amb el sentit del vot desglossat.`
              : (ctx.puntsAmbDesglos ?? 0) > 0
                ? `De ${quantesActes(ctx)} n'hem pogut llegir el vot per grup en ${ctx.puntsAmbDesglos}
                   ${ctx.puntsAmbDesglos === 1 ? "punt" : "punts"}, però <b>no hem sabut reconèixer-hi
                   el seu grup</b>: abans d'atribuir-li el vot d'un altre, no en diem cap.`
                : `De ${quantesActes(ctx)} d'aquest ajuntament,
                   <b>no n'hem sabut llegir cap vot desglossat per grup</b>: n'hi pot haver escrit
                   d'una manera que el nostre lector d'actes encara no entén.`
          }
           Sense això no podem dir què s'hi ha votat, i preferim dir-ho a omplir-ho amb suposicions.</p>`
        : `<p class="entrada-bloc">Els punts que el ple va votar de manera dividida i on consta el
           sentit del vot del seu grup, <b>començant pels més renyits</b>. Un punt aprovat per
           tothom no separa ningú; un decidit per un vot o dos és on es veu qui és qui.</p>
           ${resumDelVot}
           ${resumComptes}
           <ul class="vots">${vots}</ul>
           ${ctx.votsDelGrup.length > 40 ? `<p class="nota">Se n'ensenyen 40 dels ${ctx.votsDelGrup.length}.</p>` : ""}
           ${fontDelsVots(ctx)}`
    }
    <p class="nota">Les actes no publiquen una llista de vots individuals, però sovint no cal:
    <b>quan un grup hi posa tants vots com regidories té, tots els seus regidors hi han votat
    allò</b>, perquè no queda ningú a qui atribuir un vot diferent. En aquests punts hi diu què va
    votar aquesta persona. Quan el grup hi va posar menys vots que regidories —algú no hi era, o
    algú hi va votar a part— no es pot saber qui, i llavors hi diu «el seu grup».</p>
  </section>`;
}

/**
 * El bloc «Què en publica el seu ajuntament», només quan la fitxa de la seu
 * electrònica s'ha pogut llegir de debò: llavors cada ✓ i cada ✕ diuen què hi
 * consta i què no. Quan no s'ha pogut obrir cap fitxa —o quan l'ajuntament no
 * en publica— cinc creus es llegien com «no publica res», que és una afirmació
 * que no podem fer, i la nota que ho matisava no desfeia la primera impressió:
 * l'usuari va demanar treure-ho, i el bloc sencer no s'escriu. El senyal és
 * `retribucio === null`, que és com J14 desa una fitxa no llegida.
 */
function queEnPublica(ctx: ContextRegidor): string {
  const p = ctx.publicaDeLaPersona;
  if (!p || p.retribucio === null) return "";
  const fila = (hi: boolean, text: string): string =>
    `<li class="${hi ? "hi-es" : "no-hi-es"}"><span class="senyal" aria-hidden="true">${
      hi ? "✓" : "✕"
    }</span><span class="nom">${escape(text)}</span></li>`;
  return `<section class="bloc" id="que-en-publica">
    <h2>Què en publica el seu ajuntament</h2>
    <p class="entrada-bloc">Del seu càrrec, què consta a la seu electrònica del mateix ajuntament.
    <b>No és el que cobra</b>: és què se'n pot saber.</p>
    <ul class="transparencia">
      ${fila(p.retribucio === "xifra", "La retribució del càrrec, amb import")}
      ${fila(p.declaracioBens, "La declaració de béns i activitats")}
      ${fila(p.dietes, "Les dietes")}
      ${fila(p.indemnitzacions, "Les indemnitzacions")}
      ${
        // Quan sí que en sabem un d'altre ens, la creu del costat diria el
        // contrari del bloc de sobre si es llegís de pressa: aquí no vol dir
        // que no en tingui, vol dir que el seu ajuntament no ho publica —i qui
        // ho publica és qui el paga.
        ctx.altresCarrecs.length > 0 && !p.altresRetribucions
          ? `<li class="no-hi-es"><span class="senyal" aria-hidden="true">✕</span><span class="nom">Les
             retribucions d'altres ens <b>—però en té ${
               ctx.altresCarrecs.length === 1 ? "una" : ctx.altresCarrecs.length
             }, i qui la paga sí que la publica: és al bloc de sobre</b></span></li>`
          : fila(p.altresRetribucions, "Les retribucions d'altres ens")
      }
    </ul>
    ${
      p.fitxa
        ? `<p class="nota oberta"><a href="${escape(p.fitxa)}" rel="noopener nofollow">La seva fitxa a la seu electrònica</a>.</p>`
        : ""
    }
    <details class="nota"><summary>La lletra petita</summary>De l'import que hi publiquen els ajuntaments no se n'agafa cap euro:
    només recull la part que paga l'ajuntament i deixa fora el que la persona cobri d'una altra
    administració, de manera que una xifra baixa exculpa. El que sí que és comprovable és si hi
    consta o no.${p.font ? ` ${escape(p.font.nom)}, consultat el ${escape(p.font.consultat)}.` : ""}</details>
  </section>`;
}

/** Cronologia curta: només fets datats que provenen d'una font explícita. */
function cronologia(r: Regidor, ctx: ContextRegidor): string {
  const fets: { ordre: string; any: string; text: string }[] = [];
  for (const l of ctx.llistes ?? []) {
    fets.push({ ordre: String(l.any), any: String(l.any), text: `${l.capDeLlista ? "Va encapçalar" : `Va anar de número ${l.posicio ?? "?"}`} la llista ${escape(l.sigles)}${l.elegit ? " i en va sortir elegit" : " i no en va sortir elegit"}.` });
  }
  if (ctx.mandat?.constitucio) fets.push({ ordre: ctx.mandat.constitucio, any: ctx.mandat.constitucio.slice(0, 4), text: `Es va constituir el ple del mandat ${escape(ctx.mandat.nom)}.` });
  if (r.desDe) fets.push({ ordre: r.desDe, any: r.desDe.slice(0, 4), text: `Va prendre possessió del càrrec el ${escape(delDia(r.desDe))}.` });
  if (r.entradaTardana) fets.push({ ordre: "9999", any: "", text: "Va entrar a mig mandat; la font no en dona la data exacta." });
  if (r.canviDeGrup) fets.push({ ordre: "9998", any: "", text: `Avui consta ${r.canviDeGrup.a ? `al grup ${escape(r.canviDeGrup.a)}` : "sense grup"}; va ser elegit per ${escape(r.canviDeGrup.de ?? "una altra llista")}.` });
  for (const c of ctx.trajectoria?.carrecs ?? []) if (c.inici || c.fi) fets.push({ ordre: c.inici ?? c.fi ?? "", any: `${c.inici?.slice(0, 4) ?? ""}${c.fi ? `–${c.fi.slice(0, 4)}` : ""}`, text: `Va ocupar ${escape(c.nom)}.` });
  if (fets.length < 2) return "";
  fets.sort((a, b) => a.ordre.localeCompare(b.ordre));
  return `<section class="bloc" id="cronologia"><h2>Cronologia política</h2><p class="entrada-bloc">Només hi entren fets amb <b>data o període publicat</b>; el que no consta no s'omple amb una suposició.</p><ol class="cronologia">${fets.map((f) => `<li><span class="cronologia-any">${escape(f.any)}</span><span>${f.text}</span></li>`).join("")}</ol><p class="nota">La cronologia combina el registre d'electes, les candidatures i, quan n'hi ha, fonts de trajectòria. Cada bloc de la fitxa conserva l'enllaç a la font corresponent.</p></section>`;
}

export function renderRegidor(r: Regidor, ctx: ContextRegidor, generatedAt: string): string {
  const inicials = r.nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  const color = r.color ?? "#8b8b8b";
  const retrat = r.foto
    ? `<img class="retrat-gran" src="${escape(r.foto)}" alt="" width="120" height="120">`
    : `<span class="inicials-gran" style="--c:${color};--t:${tinta(color)}" aria-hidden="true">${escape(inicials)}</span>`;

  // Quan no en sabem res, els tres blocs que ho dirien es fonen en un de sol.
  const senseRes = noEnSabemRes(ctx);

  return `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escape(nomLlegible(r.nom))} · ${escape(ctx.municipi)} — Observatori municipal de quivoto</title>
<meta name="description" content="${escape(r.carrec)} ${escape(de(ctx.municipi))}${
    r.grup ? ` pel grup ${escape(r.grup)}` : ""
  }: de quina llista va sortir, si és a l'equip de govern i què ha votat el seu grup al ple.">
<link rel="canonical" href="${SITE}/observatori/m/${escape(ctx.slug)}/regidor/${escape(ctx.adreca)}/">
${tipografia("../../../../")}
<style>${RADIOGRAFIA_CSS}${CSS}</style>
</head>
<body>
<a class="salta" href="#contingut">Ves al contingut</a>
${capcalera("../../../../", "cap", "càrrec electe")}
${cercador("../../../../")}

<main id="contingut">
  <section class="portada">
    <p class="micro"><a href="../../">${escape(ctx.municipi)}</a></p>
    <h1>${escape(nomLlegible(r.nom))}</h1>
    <div class="persona">
      ${retrat}
      <div>
        <p class="entrada" style="margin:0">${escape(r.carrec)} ${escape(de(ctx.municipi))}${
          r.grup ? `, pel grup <b>${escape(r.grup)}</b>` : ""
        }.</p>
        ${fraseMandats(r, ctx)}
        ${fraseLlistes(r, ctx)}
        <div class="etiquetes">
          ${
            // Les sigles porten a la pàgina del partit a tot Catalunya, com el
            // nom de la persona porta a la seva. Des d'aquí, quatre nivells amunt.
            r.grup ? sigla(r.sigles ?? r.grup, { base: "../../../../", color }) : ""
          }
          ${
            // Qui té l'alcaldia hi surt dit amb totes les lletres i no només
            // dins de la frase: és el càrrec pel qual s'entra en aquesta pàgina.
            /alcald/i.test(r.carrec) ? '<span class="alcaldia-etiqueta">alcaldia</span>' : ""
          }
          ${
            // Qui té l'alcaldia és a l'equip de govern per definició, i això no
            // depèn que la font ho marqui: no és una deducció, és el càrrec.
            /alcald/i.test(r.carrec) || r.equipGovern
              ? '<span class="govern">a l\'equip de govern</span>'
              : ctx.governConegut
                ? '<span class="oposicio">a l\'oposició</span>'
                : '<span class="sense-govern">la seu electrònica no diu qui és a l\'equip de govern</span>'
          }
          ${r.posicioLlista !== null ? `<span>número ${r.posicioLlista} de la llista</span>` : ""}
          ${
            // L'alcaldable, dit amb totes les lletres: és la persona per qui
            // es va votar la llista, i la pàgina no ho deia.
            ctx.capDeLlista?.es ? '<span class="cap-llista">cap de llista el 2023</span>' : ""
          }
          ${r.entradaTardana ? `<span>va entrar a mig mandat</span>` : ""}
        </div>
      </div>
    </div>
    ${
      r.canviDeGrup
        ? `<p class="nota">Va ser ${/a$/i.test(r.carrec) ? "elegida" : "elegit"} per
           <b>${escape(r.canviDeGrup.de ?? "una altra llista")}</b> i avui consta
           ${r.canviDeGrup.a ? `a <b>${escape(r.canviDeGrup.a)}</b>` : "sense grup"}.
           Ho diem perquè consta a les dues fonts, no com a retret: canviar de grup és legal i
           té motius que la nostra base de dades no coneix.</p>`
        : ""
    }
  </section>

  <nav aria-label="Apartats d'aquesta fitxa">
    <ul class="nav-fitxa">
      ${senseRes ? '<li><a href="#que-en-sabem">Què en sabem</a></li>' : '<li><a href="#que-cobra">Què cobra</a></li><li><a href="#pas-pel-ple">Pas pel ple</a></li><li><a href="#que-ha-votat">Què ha votat</a></li><li><a href="#que-en-publica">Transparència</a></li>'}
      ${ctx.trajectoria ? '<li><a href="#mes-enlla">Trajectòria</a></li>' : ""}
      ${(ctx.llistes?.length ?? 0) > 1 || (ctx.trajectoria?.carrecs.length ?? 0) > 0 ? '<li><a href="#cronologia">Cronologia</a></li>' : ""}
    </ul>
  </nav>

  ${comACapDeLlista(r, ctx)}

  ${
    senseRes
      ? queEnSabem(r, ctx, generatedAt)
      : `${queCobra(r, ctx)}

  ${pasPelPle(r, ctx, generatedAt)}`
  }

  ${mesEnllaDelPle(ctx)}

  ${cronologia(r, ctx)}

  ${queEnPublica(ctx)}

  ${senseRes ? "" : queHaVotat(ctx)}

  <section class="bloc anar">
    <h2>Segueix estirant</h2>
    <ul class="destins">
      <li><a href="../../"><b>La fitxa ${escape(de(ctx.municipi))}</b>
        <span>El ple sencer, qui governa, els comptes i les dotze eleccions des del 1979</span></a></li>
      ${
        r.sigles
          ? `<li><a href="../../${escape(slugify(r.sigles))}/"><b>${escape(r.sigles)} a ${escape(ctx.municipi)}</b>
        <span>Els resultats de la candidatura i qui hi va anar a la llista</span></a></li>`
          : ""
      }
    </ul>
  </section>

  <section class="bloc fonts">
    <h2>D'on surt</h2>
    <p class="nota">Composició del ple segons la seu electrònica del mateix ajuntament i el
    registre d'electes de la Generalitat. Hi publiquem nom, càrrec, grup i mandat, que és el que
    deriva del càrrec públic; <b>cap dada de contacte</b>. La fotografia, quan n'hi ha, la publica
    el mateix ajuntament al seu portal de transparència${
      r.fitxaOficial
        ? ` (<a href="${escape(r.fitxaOficial)}" target="_blank" rel="noopener">fitxa original</a>)`
        : ""
    }, i la retirem a la primera petició de la persona, sense demanar-ne el motiu.</p>
  </section>
</main>
${peu("../../../../", generatedAt)}

</body></html>`;
}
