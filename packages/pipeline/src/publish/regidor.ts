import { tintaSobre } from "./contrast";
import { RADIOGRAFIA_CSS } from "./estil";
import { SITE } from "./config";
import { de, delDia, nomLlegible, slugify } from "../lib/text";
import { capcalera } from "./capcalera";
import { cercador } from "./cercador";
import { peu } from "./peu";

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
  /** Posició a la llista amb què es va presentar, si l'hem pogut lligar. */
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
    font: { nom: string; url: string } | null;
  }[];
  /** L'avís de la font sobre què és i què no és cadascun d'aquests imports. */
  avisRetribucions: string | null;
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
  publicaDeLaPersona: {
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
  motiuSenseImport: string | null;
  font: { nom: string; url: string | null; llicencia?: string | null } | null;
  declaracioBens?: string | null;
};

/**
 * Una targeta per pagador.
 *
 * L'avís de la xifra parcial va **abans** de l'import i no a sota: qui només
 * mira el número gros no ha de poder-ne treure una conclusió que la xifra no
 * aguanta. I una xifra parcial no es compara amb res —comparar-la amb el
 * salari mínim seria tornar-la a presentar com un sou.
 */
function targetaSou(s: SouPublicat): string {
  const detall = [s.concepte, s.dedicacio, s.any === null ? null : `exercici ${s.any}`]
    .filter((t): t is string => typeof t === "string" && t.trim() !== "")
    .map((t) => escape(t))
    .join(" · ");
  const relacio = s.parcial || s.anualBrut === null ? null : contraElSalariMinim(s.anualBrut, s.any);
  return `<li${s.parcial ? ' class="parcial"' : ""}>
      <span class="ens">${escape(s.paga)}${s.quin ? `<span class="quin">${escape(s.quin)}</span>` : ""}</span>
      ${
        s.parcial
          ? `<span class="adverteix">Això <b>no és el que cobra</b>: la seu electrònica només hi recull
             la part que paga l'ajuntament, i el que li pagui una diputació, un consell comarcal o una
             àrea metropolitana per un càrrec que li ve d'aquesta regidoria no hi surt. A Rubí
             l'alcaldessa hi consta amb 17.027 € quan en cobra 107.968.</span>`
          : ""
      }
      ${
        s.anualBrut === null
          ? `<span class="buit">${escape(s.motiuSenseImport ?? "qui el paga no en publica cap import")}</span>`
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
      ${s.font?.llicencia ? `<span class="llicencia">${escape(s.font.llicencia)}</span>` : ""}
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
      motiuSenseImport: ctx.retribucio.motiuSenseImport ?? null,
      font: ctx.retribucio.font,
      declaracioBens: ctx.retribucio.declaracioBens ?? null,
    });
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
      motiuSenseImport: a.motiuSenseImport,
      font: a.font,
    });
  }

  const avisos = [ctx.retribucio?.avis ?? null, ctx.altresCarrecs.length > 0 ? ctx.avisRetribucions : null]
    .filter((t): t is string => typeof t === "string" && t.trim() !== "")
    .map((t) => `<p class="nota oberta">${escape(t)}</p>`)
    .join("");

  if (sous.length === 0) {
    const p = ctx.publicaDeLaPersona;
    return `<section class="bloc">
    <h2>Què cobra</h2>
    <p class="entrada-bloc">De ningú que li pagui aquest càrrec no en tenim cap import comprovat.</p>
    <p>Que no en tinguem <b>no vol dir que no en cobri</b>: vol dir que qui el paga no en publica la
    xifra, o que la publica d'una manera que encara no hem pogut llegir i comprovar. Dir-ho és una
    dada del ple i no un buit d'aquesta pàgina: sense aquesta línia, la pàgina diria el mateix tant
    si en cobra cent mil euros com si no en cobra cap.</p>
    ${
      p && p.retribucio === "xifra"
        ? `<p class="nota">El seu ajuntament sí que publica una xifra a la fitxa d'aquest càrrec, però
           <b>només recull la part que paga ell mateix</b> i no el que la persona cobri d'una altra
           administració: no és el que cobra, i per això no la copiem aquí com si ho fos.${
             p.fitxa
               ? ` <a href="${escape(p.fitxa)}" rel="noopener nofollow">La fitxa, a la seu electrònica</a>.`
               : ""
           }</p>`
        : `<p class="nota">Qui n'hauria de publicar l'import és qui el paga: l'ajuntament del que li
           paga l'ajuntament, i cada altre ens del que li paga ell. Quan en tinguem un de comprovat
           sortirà aquí, amb qui el paga al costat i sense sumar-lo amb cap altre.</p>`
    }
    ${avisos}
  </section>`;
  }

  const nomesParcial = sous.every((s) => s.parcial);
  return `<section class="bloc">
    <h2>Què cobra</h2>
    <p class="entrada-bloc">${
      sous.length === 1
        ? "Un import, amb qui el paga."
        : `${sous.length} imports, cadascun amb qui el paga.`
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
  const casella = (etq: string, xifra: string, peu: string): string =>
    `<li><span class="etq">${etq}</span><span class="xifra">${xifra}</span><span class="peu">${peu}</span></li>`;
  const caselles: string[] = [];

  // Qui va entrar a mig mandat no hi seu des de la constitució, i comptar-li
  // el mandat sencer seria escriure una data falsa sobre una persona.
  const desDe = r.desDe ?? (r.entradaTardana ? null : ctx.mandat?.constitucio ?? null);
  if (desDe) {
    const temps = faQue(desDe, generatedAt);
    if (temps) {
      caselles.push(
        casella(
          "Fa que hi seu",
          escape(temps),
          r.desDe
            ? `des ${escape(delDia(desDe))}, el dia que consta que va prendre possessió`
            : `des ${escape(delDia(desDe))}, quan es va constituir el ple${
                ctx.mandat?.nom ? ` del mandat ${escape(ctx.mandat.nom)}` : ""
              }`,
        ),
      );
    }
  } else if (r.entradaTardana) {
    caselles.push(
      casella(
        "Fa que hi seu",
        "no consta",
        "va entrar a mig mandat i no en tenim el dia: sense la data no ens l'inventem",
      ),
    );
  }

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
  caselles.push(
    casella(
      "Punts votats",
      ctx.votsDelGrup.length === 0 ? "cap" : String(ctx.votsDelGrup.length),
      ctx.votsDelGrup.length === 0
        ? `de ${ctx.actesLlegides} ${ctx.actesLlegides === 1 ? "acta llegida" : "actes llegides"}, cap no desglossa el vot per grup`
        : `punts del ple amb el sentit del vot del seu grup, tret de ${ctx.actesLlegides} ${
            ctx.actesLlegides === 1 ? "acta llegida" : "actes llegides"
          }`,
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

  return `<section class="bloc">
    <h2>El seu pas pel ple</h2>
    <ul class="pas">${caselles.join("")}</ul>
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
          : `<p class="nota">De l'assistència no en podem dir res: cap de les actes que hem llegit
            d'aquest ajuntament no porta la llista de qui hi era.</p>`
    }
  </section>`;
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
        <div class="etiquetes">
          ${r.grup ? `<span class="sigla" style="--c:${color};--t:${tinta(color)}">${escape(r.sigles ?? r.grup)}</span>` : ""}
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
          ${r.entradaTardana ? `<span>va entrar a mig mandat</span>` : ""}
        </div>
      </div>
    </div>
    ${
      r.canviDeGrup
        ? `<p class="nota">Va ser elegit${/a$/i.test(r.carrec) ? "da" : ""} per
           <b>${escape(r.canviDeGrup.de ?? "una altra llista")}</b> i avui consta
           ${r.canviDeGrup.a ? `a <b>${escape(r.canviDeGrup.a)}</b>` : "sense grup"}.
           Ho diem perquè consta a les dues fonts, no com a retret: canviar de grup és legal i
           té motius que la nostra base de dades no coneix.</p>`
        : ""
    }
  </section>

  ${
    ctx.assistencia && ctx.assistencia.de >= 5
      ? `<section class="bloc">
    <h2>Quants plens ha fet</h2>
    <p class="entrada-bloc"><b>${ctx.assistencia.hi} de ${ctx.assistencia.de}</b> plens en què consta
    la llista d'assistents.</p>
    <p class="nota">Ho diu l'acta de cada sessió al seu capçal. No en tenim la llista de tots els
    plens: ${ctx.assistencia.de} de ${ctx.actesLlegides} actes llegides la porten, i les altres no
    diuen qui hi era. <b>Una absència no és una falta</b>: hi ha baixes, permisos i motius que
    l'acta no explica, i nosaltres tampoc.</p>
  </section>`
      : ""
  }

  ${
    ctx.altresCarrecs.length === 0
      ? ""
      : `<section class="bloc">
    <h2>Què cobra d'un altre ens</h2>
    <p class="entrada-bloc">${
      ctx.altresCarrecs.length === 1 ? "Ocupa també un càrrec" : `Ocupa també ${ctx.altresCarrecs.length} càrrecs`
    } fora de l'ajuntament. Aquí hi ha el que en publica qui el paga.</p>
    <ul class="altres-carrecs">${ctx.altresCarrecs
      .map(
        (a) => `<li>
        <span class="ens">${escape(a.ens)}${a.carrec ? `<span class="quin">${escape(a.carrec)}</span>` : ""}</span>
        ${
          a.anualBrut === null
            ? `<span class="buit">${escape(a.motiuSenseImport ?? "l'ens que el paga no en publica cap import")}</span>`
            : `<span class="import"><b>${euros(a.anualBrut)}</b> l'any bruts</span>
               <span class="concepte">${escape(a.concepte ?? "")}${
                 a.dedicacio ? ` (${escape(a.dedicacio)})` : ""
               }</span>`
        }
        ${a.font ? `<a class="font" href="${escape(a.font.url)}" rel="noopener nofollow">${escape(a.font.nom)}</a>` : ""}
      </li>`,
      )
      .join("")}</ul>
    ${
      // L'avís de la font ja diu que no s'hi suma cap total i per què el sou
      // municipal no hi surt: escriure-ho una segona vegada amb altres paraules
      // era dir dues vegades el mateix a dos paràgrafs seguits.
      ctx.avisRetribucions ? `<p class="nota oberta">${escape(ctx.avisRetribucions)}</p>` : ""
    }
  </section>`
  }

  ${
    !ctx.publicaDeLaPersona
      ? ""
      : (() => {
          const p = ctx.publicaDeLaPersona;
          const fila = (hi: boolean, text: string): string =>
            `<li class="${hi ? "hi-es" : "no-hi-es"}"><span class="senyal" aria-hidden="true">${
              hi ? "✓" : "✕"
            }</span><span class="nom">${escape(text)}</span></li>`;
          return `<section class="bloc">
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
        : `<p class="nota oberta">D'aquest ajuntament no hem pogut obrir la fitxa de cap càrrec, i per
           tant no en podem dir ni que publiqui ni que no publiqui res. Les creus de sobre volen dir
           això i no una altra cosa.</p>`
    }
    <details class="nota"><summary>La lletra petita</summary>De l'import que hi publiquen els ajuntaments no se n'agafa cap euro:
    només recull la part que paga l'ajuntament i deixa fora el que la persona cobri d'una altra
    administració, de manera que una xifra baixa exculpa. El que sí que és comprovable és si hi
    consta o no.${p.font ? ` ${escape(p.font.nom)}, consultat el ${escape(p.font.consultat)}.` : ""}</details>
  </section>`;
        })()
  }

  <section class="bloc">
    <h2>Què ha votat</h2>
    ${
      ctx.votsDelGrup.length === 0
        ? `<p>${
            ctx.actesLlegides === 0
              ? `D'aquest ajuntament <b>encara no hem pogut llegir cap acta</b> amb el sentit del vot desglossat.`
              : `Hem llegit ${ctx.actesLlegides} actes d'aquest ajuntament, però <b>cap no desglossa el vot per grup</b>.`
          }
           Sense això no podem dir què s'hi ha votat, i preferim dir-ho a omplir-ho amb suposicions.</p>`
        : `<p class="entrada-bloc">Els punts que el ple va votar de manera dividida i on consta el
           sentit del vot del seu grup, <b>començant pels més renyits</b>. Un punt aprovat per
           tothom no separa ningú; un decidit per un vot o dos és on es veu qui és qui.</p>
           <ul class="vots">${vots}</ul>
           ${ctx.votsDelGrup.length > 40 ? `<p class="nota">Se n'ensenyen 40 dels ${ctx.votsDelGrup.length}.</p>` : ""}`
    }
    <p class="nota">Les actes no publiquen una llista de vots individuals, però sovint no cal:
    <b>quan un grup hi posa tants vots com regidories té, tots els seus regidors hi han votat
    allò</b>, perquè no queda ningú a qui atribuir un vot diferent. En aquests punts hi diu què va
    votar aquesta persona. Quan el grup hi va posar menys vots que regidories —algú no hi era, o
    algú hi va votar a part— no es pot saber qui, i llavors hi diu «el seu grup».</p>
  </section>

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
