import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Conjunt } from "./llindar";

/**
 * Comprova que cada cita entre cometes existeixi de veritat al document citat.
 *
 * Va sortir d'una auditoria de les 175 primeres afirmacions: 115 tenien algun
 * problema i, entre elles, **cites entre cometes que no eren al document**. Un
 * alcalde deia una cosa que no havia dit; una xifra del 8,5% no sortia en cap
 * dels 125 documents del corpus; una moció es citava tallant-li la part que la
 * caracteritzava políticament.
 *
 * Cap d'aquelles afirmacions no era mala fe: totes venien d'escriure a partir
 * del record d'un document en comptes del document. I l'antídot és mecànic, que
 * és el que fa que valgui la pena tenir-lo aquí i no en un encàrrec puntual:
 * els tres conjunts que es van escriure amb aquesta comprovació engegada van
 * sortir amb 176 cites de 176 verificades, i els set que es van escriure sense,
 * amb 60 afirmacions netes de 175.
 *
 * La comparació es fa sobre lletres i xifres, ignorant espais, salts de línia,
 * accents i signes. Un PDF trenca les paraules pel marge, hi cola números de
 * pàgina enmig d'una frase i escriu les cometes de quatre maneres; exigir una
 * coincidència exacta faria saltar cites bones i ningú no s'ho miraria.
 */

/** El text de les actes ja baixades, indexat per identificador del document. */
const DIRECTORI =
  process.env.QUIVOTO_ACTES_DIR ?? new URL("../../../db/.data/actes/", import.meta.url).pathname;

export type Cita = {
  text: string;
  /** L'afirmació d'on surt, per poder-la trobar. */
  afirmacio: number;
  url: string | null;
  estat: "verificada" | "no-hi-es" | "sense-document";
};

/**
 * El mateix text sense les marques d'aigua del PDF.
 *
 * Les actes de moltes seus electròniques porten una marca vertical al marge
 * —«DOCUMENT PENDENT D'APROVACIÓ» escrit lletra a lletra cap avall— i el codi
 * segur de verificació. L'extractor de text les deixa anar **enmig de la
 * frase**: a Lleida, «…19 vots en contra dels membres» + «T» + «dels grups
 * municipals PSC-UNITS-CP». Cinc cites perfectament literals sortien com a
 * inventades per una lletra que no hi era.
 *
 * Es treuen només les **majúscules soles** i les línies de codi de verificació.
 * En minúscula no es toca res, perquè «a», «i» i «o» són paraules del català i
 * treure-les trencaria cites bones. I es fa com a **segona lectura**: primer es
 * busca al text tal com és, i només si no hi és s'hi torna sense les marques.
 */
export function senseMarquesDaigua(text: string): string {
  return text
    .replace(/^\s*CSV\s*:.*$/gim, " ")
    .replace(/(^|\s)[A-ZÀ-ÚÇ](?=\s)/g, " ");
}

/** Només lletres i xifres, en minúscules i sense accents. */
export function nucli(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Les cites d'un text. Es reconeixen les cometes baixes «...», que són les que
 * fem servir, i les altes "..." per si algú n'escriu.
 *
 * Les cites de menys de 25 caràcters no es comproven: «IBI», «aprovat» o una
 * xifra solta apareixen a qualsevol document i verificar-les no diria res.
 */
export function citesDe(text: string): string[] {
  const trobades: string[] = [];
  for (const re of [/«([^»]{25,})»/g, /"([^"]{25,})"/g, /“([^”]{25,})”/g]) {
    for (const m of text.matchAll(re)) trobades.push(m[1]!.trim());
  }
  return trobades;
}

/**
 * L'identificador del document dins de l'adreça de l'acteca.
 *
 * L'adreça escriu el codi d'ens **sense el zero inicial** (`801550006`) i el
 * directori on es desen les actes el porta (`0801550006`). És el mateix parany
 * que ja fa saltar l'aparellament de municipis a la província de Barcelona, i
 * aquí feia que cap cita de Badalona, Esplugues o Sabadell no es pogués
 * verificar mentre les de Lleida i Reus sí.
 */
function documentDe(url: string | null | undefined): { ens: string; doc: string } | null {
  if (!url) return null;
  const m = url.match(/\/acteca\/(\d+)\/\d{4}\/([0-9a-f-]{36})\//i);
  return m ? { ens: m[1]!.padStart(10, "0"), doc: m[2]! } : null;
}

const memoria = new Map<string, string | null>();
const memoriaNeta = new Map<string, string>();

/** El mateix document sense marques d'aigua, si l'hem llegit. */
export function textNetDeLActa(url: string | null | undefined): string | null {
  const ref = documentDe(url);
  return ref ? memoriaNeta.get(`${ref.ens}/${ref.doc}`) ?? null : null;
}

/** El text d'una acta ja baixada, o `null` si no la tenim a disc. */
export function textDeLActa(url: string | null | undefined): string | null {
  const ref = documentDe(url);
  if (!ref) return null;
  const clau = `${ref.ens}/${ref.doc}`;
  if (memoria.has(clau)) return memoria.get(clau)!;
  let text: string | null = null;
  try {
    const cru = readFileSync(join(DIRECTORI, ref.ens, `${ref.doc}.txt`), "utf8");
    text = nucli(cru);
    // La segona lectura, sense les marques d'aigua, es desa a part i només es
    // consulta si la cita no s'ha trobat a la primera.
    memoriaNeta.set(clau, nucli(senseMarquesDaigua(cru)));
  } catch {
    text = null;
  }
  memoria.set(clau, text);
  return text;
}

/**
 * El document conté la cita, tolerant els números de pàgina que el PDF cola
 * enmig d'una paraula.
 *
 * A l'acta d'un ple de Lleida, «…reforçar la seguretat ciutadana» surt al text
 * extret com a «reforcarla38seguretatciutadana»: el 38 és el número de pàgina i
 * el PDF el deixa caure al mig del salt de línia. La cita és bona i el
 * verificador la donava per inventada.
 *
 * Només es permet saltar **dígits**, com a molt quatre seguits, i només quan el
 * caràcter que toca a la cita és una lletra. Així un número de pàgina no fa
 * fallar la comprovació, però una xifra canviada dins de la cita —que és
 * precisament el que volem enxampar— continua fent-la saltar: si la cita diu
 * 8,5% i el document diu 6%, el 6 no es pot saltar perquè a la cita hi toca un
 * dígit i no una lletra.
 */
function conteTolerant(doc: string, cita: string): boolean {
  if (doc.includes(cita)) return true;
  // Vuit caràcters i no setze: el número de pàgina pot caure a la primera
  // paraula de la cita, i llavors una àncora llarga ja no la troba enlloc.
  const ancora = cita.slice(0, 8);
  if (ancora.length < 8) return false;
  let des = doc.indexOf(ancora);
  while (des !== -1) {
    let i = 0;
    let j = des;
    while (i < cita.length && j < doc.length) {
      if (doc[j] === cita[i]) {
        i += 1;
        j += 1;
        continue;
      }
      // Un número de pàgina: dígits al document allà on la cita porta lletra.
      if (/[a-z]/.test(cita[i]!) && /[0-9]/.test(doc[j]!)) {
        let salt = 0;
        while (salt < 4 && j + salt < doc.length && /[0-9]/.test(doc[j + salt]!)) salt += 1;
        j += salt;
        continue;
      }
      break;
    }
    if (i === cita.length) return true;
    des = doc.indexOf(ancora, des + 1);
  }
  return false;
}

/**
 * La cita és al document?
 *
 * Els punts suspensius d'una cita són una el·lipsi: «el servei... i el preu»
 * vol dir que entremig hi ha text que no s'ha copiat. Comparar-ho tot seguit
 * no troba mai res, i el verificador donava per falses cites perfectament
 * bones. Cada tros s'ha de trobar per separat i **en ordre**: si sortissin
 * desordenats, la cita estaria dient una cosa que el document no diu.
 *
 * Un tros de menys de vuit caràcters no es comprova: «i el preu» surt a
 * qualsevol document i exigir-lo només afegiria falsos negatius.
 */
export function hiEs(cita: string, doc: string): boolean {
  const trossos = cita
    .split(/\.{3}|…/)
    .map((t) => nucli(t))
    .filter((t) => t.length >= 8);
  if (trossos.length === 0) return conteTolerant(doc, nucli(cita));
  // Cada tros ha de sortir després de l'anterior: desordenats, la cita diria
  // una cosa que el document no diu.
  let des = 0;
  for (const tros of trossos) {
    const resta = doc.slice(des);
    if (!conteTolerant(resta, tros)) return false;
    const on = resta.indexOf(tros);
    des += (on === -1 ? 0 : on) + tros.length;
  }
  return true;
}

/** Segona oportunitat: el mateix document sense les marques d'aigua del PDF. */
function hiEsSenseMarques(cita: string, url: string | null | undefined): boolean {
  const net = textNetDeLActa(url);
  return net !== null && hiEs(cita, net);
}

/** Comprova totes les cites d'un conjunt d'afirmacions. */
export function verificaCites(conjunt: Conjunt): Cita[] {
  const sortida: Cita[] = [];
  for (const [i, a] of conjunt.afirmacions.entries()) {
    const acta = textDeLActa(a.url_evidencia);
    for (const cita of citesDe(a.evidencia)) {
      sortida.push({
        text: cita,
        afirmacio: i,
        url: a.url_evidencia ?? null,
        estat:
          acta === null
            ? "sense-document"
            : hiEs(cita, acta) || hiEsSenseMarques(cita, a.url_evidencia)
              ? "verificada"
              : "no-hi-es",
      });
    }
  }
  return sortida;
}

export type ResumCites = {
  total: number;
  verificades: number;
  noHiSon: number;
  senseDocument: number;
  /** Les que no s'han trobat: són les que bloquegen la publicació. */
  problemes: Cita[];
};

export function resumeixCites(conjunt: Conjunt): ResumCites {
  const cites = verificaCites(conjunt);
  const problemes = cites.filter((c) => c.estat === "no-hi-es");
  return {
    total: cites.length,
    verificades: cites.filter((c) => c.estat === "verificada").length,
    noHiSon: problemes.length,
    senseDocument: cites.filter((c) => c.estat === "sense-document").length,
    problemes,
  };
}
