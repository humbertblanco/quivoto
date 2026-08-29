import { siglesFamily } from "@quivoto/shared-schemas/brands";
import type { PuntActa } from "./enllac-actes";

/**
 * Qui va votar què, deduït de l'evidència d'una afirmació.
 *
 * L'evidència de cada afirmació descriu una votació del ple: «17 vots a favor
 * (PP) i 9 en contra (Guanyem, BeCP, ERC i PSC)». D'aquí en volem treure la
 * posició de **cada grup**, que és el que permet comparar-s'hi.
 *
 * Hi ha dos camins, i cap dels dos endevina:
 *
 *   · **nominal** — l'acta anomena els grups de cada costat. No hi ha res a
 *     deduir: es llegeix.
 *   · **aritmètica** — l'acta només dona els números («9 a favor i 18 en
 *     contra»). Llavors es prova de repartir els escons dels grups entre els
 *     tres costats i **només s'accepta si hi ha una única manera de fer-ho**.
 *     A Badalona el PP té 18 dels 27 escons: si en contra n'hi ha 18, no hi ha
 *     cap altra combinació possible i el repartiment és tan cert com si l'acta
 *     el digués. Quan n'hi ha més d'una, no se'n diu res.
 *
 * Falta encara el **sentit**: saber que un grup va votar a favor no diu si està
 * d'acord amb l'afirmació, perquè l'afirmació pot anar en contra del que es
 * votava («cal abaixar l'IBI» contra un punt que el puja). Això ho fixa
 * `posicio_govern`, que és la posició del govern establerta per qui va escriure
 * l'afirmació i comprovada obrint l'acta. Sabent on cau el govern i com hi va
 * votar, el sentit dels dos costats queda determinat.
 *
 * Si el govern es parteix entre els dos costats, no es dedueix res: no hi ha
 * manera d'orientar l'escala i qualsevol tria seria inventada.
 */

export type Costat = "favor" | "contra" | "abstencio";

export type Grup = {
  nom: string;
  sigles: string | null;
  escons: number;
  govern: boolean;
  color: string | null;
};

export type PosicioGrup = {
  grup: string;
  /**
   * L'escala de la brúixola: −2 gens d'acord, +2 totalment d'acord.
   *
   * `null` per a qui es va abstenir. La metodologia publicada
   * (`docs/metodologia/02-posicions.md`) diu que l'abstenció no puntua: queda
   * fora del numerador i del denominador. Una abstenció no és el punt mig entre
   * el sí i el no —sovint és procedimental, o una manera de no retratar-se— i
   * comptar-la com a «ni una cosa ni l'altra» seria posar-li una opinió a algú
   * que precisament no n'ha expressat cap. Es mostra, però no es puntua.
   */
  valor: -2 | 2 | null;
  costat: Costat;
  base: Base;
};

/** D'on surt la posició d'un grup, que no és igual de forta en tots els casos. */
export type Base =
  /** L'acta desglossa el vot d'aquell grup: no hi ha res a deduir. */
  | "acta"
  /** El resum de l'evidència l'anomena a un costat. */
  | "nominal"
  /** Els escons només es podien repartir d'una manera. */
  | "aritmetica"
  /** Els vots contraris no cabien a l'oposició: el govern hi va votar sencer. */
  | "bloc";

export type Recompte = { favor: number; contra: number; abstencio: number };

/** El recompte d'una votació, tal com surt escrit a l'evidència. */
export function recompteDe(evidencia: string): Recompte | null {
  if (/\bper unanimitat\b/i.test(evidencia)) return null; // el tracta `unanimitat()`
  // «17 vots a favor (PP) i 9 en contra», «rebutjada amb 3 vots a favor, 18 en
  // contra i 4 abstencions», «aprovat amb 12 a favor». El text entre parèntesis
  // pot dur-hi comes, i per això es descarta abans de comptar.
  const net = evidencia.replace(/\([^)]*\)/g, " ");
  const num = (re: RegExp): number | null => {
    const m = net.match(re);
    return m ? Number.parseInt(m[1]!, 10) : null;
  };
  const favor = num(/(\d+)\s+(?:vots?\s+)?(?:a\s+)?favor/i);
  const contra = num(/(\d+)\s+(?:vots?\s+)?en\s+contra/i);
  if (favor === null || contra === null) return null;
  const abstencio = num(/(\d+)\s+abstenci/i) ?? 0;
  return { favor, contra, abstencio };
}

/** Els grups anomenats a cada costat, quan l'acta els anomena. */
export function grupsAnomenats(
  evidencia: string,
  grups: readonly Grup[],
): Map<string, Costat> | null {
  const trobats = new Map<string, Costat>();
  // «(PSC i Esplugues en Comú Podem)», «(Guanyem, BeCP, ERC i PSC)». El costat
  // el marca el que hi ha just abans del parèntesi.
  const re = /(a\s+favor|en\s+contra|abstenci\w*)\s*\(([^)]{2,200})\)/gi;
  for (const m of evidencia.matchAll(re)) {
    const costat: Costat = /favor/i.test(m[1]!)
      ? "favor"
      : /contra/i.test(m[1]!)
        ? "contra"
        : "abstencio";
    for (const cru of m[2]!.split(/\s*(?:,|\bi\b|\by\b)\s*/i)) {
      const nom = cru.trim();
      if (nom.length < 2) continue;
      const grup = encaixa(nom, grups);
      // Un nom que no lliga amb cap grup del ple vol dir que no hem entès la
      // frase: val més no deduir res que repartir malament els que sí que lliguen.
      if (!grup) return null;
      trobats.set(grup.nom, costat);
    }
  }
  return trobats.size > 0 ? trobats : null;
}

/**
 * Lliga un nom escrit a l'acta amb un grup del ple. Exportada perquè la fitxa de
 * cada regidor necessita saber de quin grup és cada línia de la votació.
 *
 * No fa servir `sameForce`, que davant del dubte diu que sí: aquí el dubte ha
 * de dir que no. Un nom només lliga si el text del grup i el de l'acta
 * comparteixen paraules, o si tots dos cauen a la mateixa família de sigles amb
 * la família coneguda. I si lliga amb més d'un grup, tampoc no val.
 */
export function encaixa(nom: string, grups: readonly Grup[]): Grup | null {
  const candidats = grups.filter((g) => nomIgual(g, nom) || familiaIgual(g, nom));
  return candidats.length === 1 ? candidats[0]! : null;
}

const neteja = (t: string): string =>
  t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Paraules que no distingeixen cap grup i que farien lligar qualsevol cosa. */
const BUIDES = new Set([
  "grup", "municipal", "de", "del", "dels", "la", "les", "el", "els", "i", "per",
  "candidatura", "progres", "am", "cp", "c", "cm", "acord", "alternativa",
]);

function nomIgual(g: Grup, nom: string): boolean {
  for (const forma of [g.sigles, g.nom]) {
    if (forma !== null && neteja(forma) === neteja(nom)) return true;
  }
  // Les actes escurcen el nom: «Guanyem» pel grup «Guanyem Badalona». Val si
  // totes les paraules que diu l'acta són del nom del grup.
  const paraules = new Set(neteja(g.nom).split(" ").filter((w) => w.length > 1 && !BUIDES.has(w)));
  const diu = neteja(nom).split(" ").filter((w) => w.length > 1 && !BUIDES.has(w));
  if (diu.length > 0 && diu.every((w) => paraules.has(w))) return true;
  // I les allarguen: «BeCP» és «Badalona En Comú Podem». Les sigles municipals
  // catalanes són gairebé sempre les inicials del nom, i comparar-les resol el
  // cas sense haver de tocar la taula de marques compartida —que la fan servir
  // les sèries històriques i qualsevol canvi allà els mouria els números.
  return diu.length === 1 && diu[0] === inicials(g.nom);
}

/** Les inicials de cada paraula del nom: «Badalona En Comú Podem» → «becp». */
function inicials(nom: string): string {
  return neteja(nom)
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0]!)
    .join("");
}

/** Mateixa família de sigles, amb la família coneguda a totes dues bandes. */
function familiaIgual(g: Grup, nom: string): boolean {
  const a = siglesFamily(g.sigles ?? g.nom);
  const b = siglesFamily(nom);
  return a !== null && b !== null && a === b;
}

/**
 * Reparteix els escons entre els tres costats i torna el repartiment **només
 * si n'hi ha un de sol**. Amb deu grups són 59.049 combinacions: es poden
 * provar totes i no cal cap heurística.
 */
export function repartimentUnic(
  recompte: Recompte,
  grups: readonly Grup[],
): Map<string, Costat> | null {
  const total = grups.reduce((s, g) => s + g.escons, 0);
  // Si els números no sumen el ple sencer hi ha hagut absències, i llavors
  // qualsevol repartiment és possible: no es dedueix res.
  if (recompte.favor + recompte.contra + recompte.abstencio !== total) return null;
  if (grups.length === 0 || grups.length > 12) return null;

  const COSTATS: Costat[] = ["favor", "contra", "abstencio"];
  let solucio: Map<string, Costat> | null = null;
  const assignacio: Costat[] = [];

  const prova = (i: number, favor: number, contra: number, abstencio: number): boolean => {
    if (favor > recompte.favor || contra > recompte.contra || abstencio > recompte.abstencio) {
      return false;
    }
    if (i === grups.length) {
      if (favor !== recompte.favor || contra !== recompte.contra) return false;
      if (solucio !== null) return true; // una segona: ja no és única
      solucio = new Map(grups.map((g, n) => [g.nom, assignacio[n]!]));
      return false;
    }
    const e = grups[i]!.escons;
    for (const c of COSTATS) {
      assignacio[i] = c;
      const atura = prova(
        i + 1,
        favor + (c === "favor" ? e : 0),
        contra + (c === "contra" ? e : 0),
        abstencio + (c === "abstencio" ? e : 0),
      );
      if (atura) return true; // n'hi ha dues: s'atura tot
    }
    return false;
  };

  return prova(0, 0, 0, 0) ? null : solucio;
}

/**
 * El vot de cada grup tal com el desglossa l'acta.
 *
 * «Blanc» i «absent» no són una posició: qui no vota no diu res, i comptar-ho
 * com una abstenció seria posar-li una opinió que no ha expressat.
 */
export function deLActa(punt: PuntActa, grups: readonly Grup[]): Map<string, Costat> | null {
  if (punt.unanimitat && punt.vots.length === 0) {
    return new Map(grups.map((g) => [g.nom, "favor" as Costat]));
  }
  const costats = new Map<string, Costat>();
  for (const vot of punt.vots) {
    if (vot.sentit !== "favor" && vot.sentit !== "contra" && vot.sentit !== "abstencio") continue;
    const grup = encaixa(vot.grup, grups);
    if (grup === null) continue;
    costats.set(grup.nom, vot.sentit);
  }
  return costats.size > 0 ? costats : null;
}

/**
 * De quin costat va votar el govern, quan els números no deixen cap altra
 * opció.
 *
 * Si els vots contraris i les abstencions plegats no arriben ni a totes les
 * regidories de l'oposició, i els vots a favor són com a mínim tants com en té
 * el govern, no hi ha manera que cap regidor del govern hagi votat en contra:
 * el govern hi va votar sencer. No és una estimació, és el que permeten els
 * números.
 *
 * Serveix per orientar el sentit de l'afirmació quan l'acta dona el recompte
 * però no diu qui és qui, que és el cas més comú.
 */
export function orientaPelBloc(recompte: Recompte, grups: readonly Grup[]): Costat | null {
  const total = grups.reduce((s, g) => s + g.escons, 0);
  const suma = recompte.favor + recompte.contra + recompte.abstencio;
  // Més vots que regidories vol dir que hem barrejat dues votacions del mateix
  // text: no s'hi pot raonar a sobre.
  if (total === 0 || suma > total) return null;
  const govern = grups.filter((g) => g.govern).reduce((s, g) => s + g.escons, 0);
  const oposicio = total - govern;
  if (govern === 0) return null;
  if (recompte.contra + recompte.abstencio <= oposicio && recompte.favor >= govern) return "favor";
  if (recompte.favor + recompte.abstencio <= oposicio && recompte.contra >= govern) return "contra";
  return null;
}

/** «Aprovat per unanimitat»: tothom al mateix costat. */
export function unanimitat(evidencia: string, grups: readonly Grup[]): Map<string, Costat> | null {
  if (!/\bper unanimitat\b/i.test(evidencia)) return null;
  return new Map(grups.map((g) => [g.nom, "favor" as Costat]));
}

/**
 * La posició de cada grup sobre una afirmació, a l'escala de la brúixola.
 * Torna una llista buida quan no se'n pot deduir res, que és el cas per defecte.
 */
export function posicions(
  evidencia: string,
  posicioGovern: string,
  grups: readonly Grup[],
  punt: PuntActa | null = null,
): PosicioGrup[] {
  if (posicioGovern !== "acord" && posicioGovern !== "desacord") return [];
  if (grups.length === 0) return [];

  const costats = new Map<string, { costat: Costat; base: Base }>();
  const posa = (m: ReadonlyMap<string, Costat> | null, base: Base): void => {
    if (m === null) return;
    for (const [grup, costat] of m) if (!costats.has(grup)) costats.set(grup, { costat, base });
  };

  // L'acta mana per damunt de tot: si s'ha pogut llegir el punt, el vot hi és
  // escrit i no cal deduir res.
  if (punt !== null) posa(deLActa(punt, grups), "acta");
  if (costats.size === 0) posa(unanimitat(evidencia, grups), "nominal");
  if (costats.size === 0) {
    // El que l'acta diu amb noms és el més fort que tenim, encara que només
    // n'anomeni un parell.
    posa(grupsAnomenats(evidencia, grups), "nominal");
    const recompte = recompteDe(evidencia);
    if (recompte !== null) {
      // Amb sort, els escons només es podien repartir d'una manera i queda
      // resolt el ple sencer.
      const unic = repartimentUnic(recompte, grups);
      if (unic !== null) posa(unic, "aritmetica");
      else {
        // I si no, encara es pot saber de quin costat va votar el govern.
        const bloc = orientaPelBloc(recompte, grups);
        if (bloc !== null) {
          posa(new Map(grups.filter((g) => g.govern).map((g) => [g.nom, bloc])), "bloc");
        }
      }
    }
  }
  if (costats.size === 0) return [];

  // El sentit: on cau el govern. Si es parteix, no s'orienta res.
  const costatsGovern = new Set(
    grups
      .filter((g) => g.govern)
      .map((g) => costats.get(g.nom)?.costat)
      .filter((c): c is Costat => c !== undefined),
  );
  costatsGovern.delete("abstencio");
  if (costatsGovern.size !== 1) return [];
  const costatGovern = [...costatsGovern][0]!;

  // Si el govern va votar a favor i està d'acord amb l'afirmació, votar a favor
  // vol dir estar-hi d'acord. Si hi està en desacord, al revés.
  const favorEsAcord = (costatGovern === "favor") === (posicioGovern === "acord");

  const sortida: PosicioGrup[] = [];
  for (const g of grups) {
    const trobat = costats.get(g.nom);
    if (trobat === undefined) continue;
    const valor: -2 | 2 | null =
      trobat.costat === "abstencio" ? null : (trobat.costat === "favor") === favorEsAcord ? 2 : -2;
    sortida.push({ grup: g.nom, valor, costat: trobat.costat, base: trobat.base });
  }
  return sortida;
}
