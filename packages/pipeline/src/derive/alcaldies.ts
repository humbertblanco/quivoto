import { siglesFamily } from "@quivoto/shared-schemas/brands";
import type { AlcaldiaWikidata } from "../jobs/j31-alcaldies-wikidata";
import type { AlcaldiaMinisteri } from "../jobs/j35-alcaldes-ministeri";
import { normalize, normalizePersonName } from "../lib/text";

/**
 * Fusió de l'historial d'alcaldies de la Generalitat amb el de Wikidata (J31)
 * i, després, amb el del Ministeri (J35): vegeu `fusionaAmbMinisteri` al final.
 *
 * La regla de la casa és que **la Generalitat mana i no se n'esborra res**:
 * cada fila seva es queda tal com és, amb el nom en majúscules i el partit
 * retallat inclosos. Wikidata només hi **afegeix** el que a la font oficial li
 * falta, i tot el que hi afegeix va marcat amb `font: "wikidata"` perquè la
 * pàgina ho pugui dir amb aquestes paraules. Tres coses:
 *
 *   1. **Els passos que hi falten.** Una alcaldia de Wikidata que comença dins
 *      d'un mandat que la Generalitat té, però amb una persona que la
 *      Generalitat no hi té, és un pas nou: a Badalona, Àlex Pastor al
 *      2015-2019 i Aïda Llauradó, Xavier García Albiol i Rubén Guijarro al
 *      2019-2023. Es compara la persona amb `normalizePersonName()` —que ja
 *      desfà «Ma.» i la «i» dels cognoms— i, per no duplicar algú que les
 *      dues fonts escriuen diferent («Alejandro» i «Àlex»), també pels cognoms
 *      i la inicial, dins del mateix mandat i prou.
 *   2. **El final i el motiu.** De la fila que sí que lliga amb la Generalitat
 *      se'n pren la data de fi (P582) i la causa (P1534): «va dimitir», «moció
 *      de censura». La Generalitat no ho diu mai, i és el que més explica.
 *   3. **El partit sencer.** La Generalitat retalla el partit a quinze
 *      caràcters («BADALONA EN COM»); quan el text és retallat i Wikidata en
 *      dona el nom sencer, es desa a `partitWikidata` al costat, i no a sobre.
 *
 * Una alcaldia de Wikidata sense data d'inici no es pot situar en cap mandat i
 * no s'hi afegeix; tampoc no s'afegeix cap mandat que la Generalitat no tingui
 * per a aquell municipi: es completen forats, no s'inventen files.
 */

/** Una fila de l'historial: de la Generalitat, o afegida de Wikidata o del Ministeri. */
export type PasAlcaldia = {
  term: string;
  name: string;
  partyRaw: string | null;
  tookOfficeOn: string | null;
  /** Només a les files que no són de la Generalitat: qui les ha afegides. */
  font?: "wikidata" | "ministeri";
  /** QID de la persona a Wikidata, quan la fila hi lliga. */
  qid?: string;
  /** Data de fi en `AAAA-MM-DD`: de Wikidata (P582) o, si ho diu `fontFi`, del Ministeri (FECHA BAJA). */
  finsA?: string | null;
  /** `finsA` no és de Wikidata sinó del Ministeri (J35). Absent quan és de Wikidata. */
  fontFi?: "ministeri";
  /** La Generalitat no tenia `tookOfficeOn` i l'ha posada el Ministeri (FECHA POSESIÓN). */
  fontInici?: "ministeri";
  /**
   * La columna LISTA del Ministeri («PSOE», «CIU», «IND»), només als passos
   * que ell afegeix i quan diu alguna cosa: «C. ELECTORAL» i «OTROS» no són
   * cap partit i es queden fora.
   */
  llistaMinisteri?: string | null;
  /** Causa del final (P1534), de Wikidata, com a etiqueta: «dimissió», «moció de censura». */
  motiuFinal?: string | null;
  /** Wikidata diu que va ser una alcaldia interina o en funcions. */
  interina?: boolean;
  /** El nom sencer del partit segons Wikidata, quan la Generalitat el retalla o no en té. */
  partitWikidata?: string | null;
};

/**
 * Amplada del camp de partit a l'historial de la Generalitat. «BADALONA EN
 * COM» fa exactament quinze caràcters: un text que arriba just a l'amplada del
 * camp és sospitós de retallat, i no només els que s'hi queden curts.
 */
const AMPLADA_PARTIT = 15;

/**
 * El partit de la Generalitat sembla retallat: curt com l'amplada del camp i
 * sense cap família que el reconegui. «ERC-AM» és curt però es reconeix;
 * «BADALONA EN COM» no és res.
 */
export function partitTruncat(partyRaw: string | null): boolean {
  if (partyRaw === null) return false;
  const net = partyRaw.trim();
  return net.length > 0 && net.length <= AMPLADA_PARTIT && siglesFamily(net) === null;
}

/**
 * Les errades d'escriptura de l'historial que no són de cap persona sinó de la
 * codificació, reparades abans de publicar o de comparar res.
 *
 *   · **«Ð» per «Ñ».** L'historial de la Generalitat té «JOAN CASAS MONTAÐA» a
 *     Cornellà del Terri i «JORDI DELGADO PEÐA» a Gratallops: és la «Ñ» llegida
 *     amb la taula de caràcters que no tocava (la «Ñ» i la «Ð» són veïnes a
 *     totes dues). Cap nom català ni castellà no porta «ð», i la reparació no
 *     pot fer mal enlloc; sense ella, el slug sortia «monta-a» i la mateixa
 *     persona tenia dues fitxes.
 *   · **Un parèntesi que no tanca o no obre** («EDUARD MONTSENY I MASIP
 *     PONS)»): el que hi havia dins es conserva, el signe solt no.
 *
 * El nom es retorna en la mateixa caixa: majúscules si venia en majúscules.
 */
export function reparaNomAlcaldia(nom: string): string {
  let net = nom.replace(/Ð/g, "Ñ").replace(/ð/g, "ñ");
  const obre = (net.match(/\(/g) ?? []).length;
  const tanca = (net.match(/\)/g) ?? []).length;
  if (obre !== tanca) net = net.replace(/[()]/g, " ");
  return net.replace(/\s+/g, " ").trim();
}

/**
 * Un partit de l'historial que diu alguna cosa. «N/A» —que surt, per exemple,
 * a les comissions gestores— no és cap partit: és la manera de la font de dir
 * que no n'hi ha, i publicar-lo com si fos una sigla fa dir a la pàgina que
 * algú ha governat «per N/A». Torna `null` i la pàgina diu «sense partit».
 */
export function partitAmbSentit(partyRaw: string | null | undefined): string | null {
  if (partyRaw === null || partyRaw === undefined) return null;
  const net = partyRaw.trim();
  if (net === "") return null;
  const n = normalize(net).replace(/\s+/g, "");
  if (n === "na" || n === "n-a" || n === "nd" || n === "-" || n === "" || /^(sense|sin)partit|^(sense|sin)partido/.test(n)) return null;
  return net;
}

/**
 * El partit per escriure'l **entre parèntesis** darrere d'un nom. La
 * Generalitat escriu alguna sigla amb el parèntesi ja posat —«(PSC-PSOE)-PM»—
 * i, embolicada en un altre, la línia deia «Joan Clos i Matheu
 * ((PSC-PSOE)-PM)». Els parèntesis de dins es treuen («PSC-PSOE-PM») i la
 * sigla queda llegible i sencera.
 */
export function partitSenseParentesis(partit: string): string {
  return partit
    .replace(/[()]/g, " ")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^-+|-+$/g, "")
    .trim();
}

/**
 * Els trossos d'un nom per comparar-lo amb un altre: normalitzat amb
 * `normalizePersonName()` (sense accents, sense el que va entre parèntesis i
 * sense la «i» dels cognoms), sense la «y» castellana que fa el mateix paper,
 * amb els guions partits («Puig-Gros» són dos trossos com «Puig Gros») i sense
 * cap tros d'una sola lletra que no sigui la inicial («Josep M. Pou»).
 */
function trossosDeNom(nom: string): string[] {
  const n = normalizePersonName(reparaNomAlcaldia(nom)).replace(/-/g, " ");
  return n
    .split(" ")
    .filter((t, i) => t !== "" && t !== "y" && (i === 0 || t.length > 1));
}

/**
 * Plec fonètic per a la comparació aproximada: les lletres que les fonts
 * canvien d'una llengua a l'altra o d'un ofici a l'altre sense que la persona
 * canviï. «Zaragoza» i «Saragossa», «Vives» i «Bibes».
 */
const plec = (t: string): string => t.replace(/ss/g, "s").replace(/z/g, "s").replace(/v/g, "b").replace(/y/g, "i");

/**
 * Distància d'edició amb les transposicions de dues lletres veïnes comptades
 * com una sola errada (Damerau, en la variant d'alineació òptima): «Mitjavila»
 * i «Mijtavila» són a 1, que és el que són, un dit que s'ha avançat.
 */
export function distanciaNoms(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
    }
  }
  return d[a.length]![b.length]!;
}

/** Dos trossos de nom iguals, o a una errada si tots dos són prou llargs per tenir-ne. */
function trosSemblant(a: string, b: string): "igual" | "errada" | "no" {
  const pa = plec(a);
  const pb = plec(b);
  if (pa === pb) return "igual";
  return Math.min(pa.length, pb.length) >= 4 && distanciaNoms(pa, pb) <= 1 ? "errada" : "no";
}

/**
 * Dos noms de pila que poden ser de la mateixa persona. Sempre: iguals; amb
 * una lletra doblada de més o de menys («Vanesa» i «Vanessa»); sense la
 * primera lletra, que és l'«Àngel» que una font escriu «Ngel» perquè s'ha
 * menjat la majúscula accentuada; amb una lletra final de més («Adolf» i
 * «Adolfo», «Jose» i «Josep»), o l'un el diminutiu final de l'altre («Toni» i
 * «Antoni»).
 *
 * Una errada qualsevol d'una lletra («Gudald» i «Eudald», «Joan» i «Juan»)
 * només quan no és `estricte`, és a dir quan hi ha dos cognoms per lligar:
 * amb un sol cognom, «Maria Puig» i «Marta Puig» són a una lletra i són dues
 * persones.
 */
function pilaCompatible(a: string, b: string, estricte: boolean): boolean {
  const pa = plec(a);
  const pb = plec(b);
  if (pa === pb) return true;
  const senseDobles = (t: string): string => t.replace(/(.)\1/g, "$1");
  if (senseDobles(pa) === senseDobles(pb)) return true;
  const [curt, llarg] = pa.length <= pb.length ? [pa, pb] : [pb, pa];
  if (curt.length >= 3 && llarg.slice(1) === curt) return true;
  if (llarg.length >= 5 && llarg.length === curt.length + 1 && llarg.startsWith(curt)) return true;
  if (curt.length >= 4 && llarg.endsWith(curt)) return true;
  return !estricte && curt.length >= 3 && distanciaNoms(pa, pb) <= 1;
}

/**
 * Dos noms amb el mateix nombre de trossos: el de pila compatible i la resta
 * igual o amb errades d'una lletra. Com a molt `maxErrades` trossos diferents
 * (el de pila inclòs), i almenys un tros que lligui sencer a banda del de pila
 * si el de pila també és diferent: «Joan Moncosi Sisach» i «Joan Moncusi
 * Susach» sí; «Gudald Picas Mijtavila» i «Eudald Picas Mitjavila» també
 * («Picas» lliga); dos noms amb tot diferent per una lletra, no.
 */
function trossosSemblants(a: readonly string[], b: readonly string[], maxErrades: number): boolean {
  if (a.length !== b.length || a.length < 2) return false;
  if (!pilaCompatible(a[0]!, b[0]!, a.length < 3)) return false;
  let errades = plec(a[0]!) === plec(b[0]!) ? 0 : 1;
  let iguals = 0;
  for (let i = 1; i < a.length; i += 1) {
    const s = trosSemblant(a[i]!, b[i]!);
    if (s === "no") return false;
    if (s === "errada") errades += 1;
    else if (a[i]!.length >= 3) iguals += 1;
  }
  if (errades > maxErrades) return false;
  return errades === 0 || iguals > 0 || plec(a[0]!) === plec(b[0]!);
}

/**
 * La mateixa persona escrita de dues maneres. Les regles, de la més segura a
 * la més arriscada, i **només per comparar dins d'un mateix municipi** (i a la
 * fusió de fonts, dins d'un mateix mandat), on dues persones diferents amb
 * noms tan semblants són una raresa:
 *
 *   1. El nom sencer normalitzat: «Jordi Hereu i Boher» i «JORDI HEREU BOHER»
 *      (sense la «i» ni la «y» dels cognoms, sense accents, sense el que va
 *      entre parèntesis com «Alejandro Pastor López (Àlex)»).
 *   2. Els dos últims cognoms iguals i la mateixa inicial: «Alejandro Pastor
 *      López» i «Àlex Pastor López», «Josep Ramon Ibarz Gilart» i «Josep Ibarz
 *      i Gilart».
 *   3. Els guions i els espais no compten: «Pujol-Casanovas» i «Pujol
 *      Casanovas», «Ruiz- Canela» i «Ruiz-Canela».
 *   4. Errades d'una lletra (o dues lletres veïnes girades) en un o dos
 *      trossos: «Piqué»/«Pique», «Almacellas»/«Almacelles», «Pascual»/
 *      «Pasqual», «Mitjavila»/«Mijtavila», «Gudald»/«Eudald».
 *   5. Un cognom de menys: «Jordi Cabezas» i «Jordi Cabezas Llobet», «Vanessa
 *      Olivart» i «Vanesa Olivart Rosicart». Qui crida ha de comprovar que el
 *      nom curt no lligui amb dues persones diferents (`alcaldia-historica.ts`
 *      ho fa): «Josep March» pot ser Minguell o Silart.
 */
export function mateixaPersona(a: string, b: string): boolean {
  const na = normalizePersonName(reparaNomAlcaldia(a));
  const nb = normalizePersonName(reparaNomAlcaldia(b));
  if (na === "" || nb === "") return false;
  if (na === nb) return true;
  const ta = trossosDeNom(a);
  const tb = trossosDeNom(b);
  if (ta.length === 0 || tb.length === 0) return false;
  if (ta.join(" ") === tb.join(" ")) return true;

  // 2. Cognoms i inicial, la regla de sempre.
  const parts = (tokens: readonly string[]): { inicial: string; cognoms: string } => ({
    inicial: tokens[0]![0] ?? "",
    cognoms: (tokens.length >= 3 ? tokens.slice(-2) : tokens.slice(-1)).map(plec).join(" "),
  });
  const pa = parts(ta);
  const pb = parts(tb);
  if (pa.inicial === pb.inicial && pa.cognoms.length >= 5 && pa.cognoms === pb.cognoms) return true;

  // 3. Junts, sense espais ni guions.
  const compacteA = ta.map(plec).join("");
  const compacteB = tb.map(plec).join("");
  if (compacteA === compacteB) return true;
  if (ta[0]![0] === tb[0]![0] && Math.min(compacteA.length, compacteB.length) >= 20 && distanciaNoms(compacteA, compacteB) <= 2) return true;

  // 4. Errades de lletra, amb el mateix nombre de trossos.
  if (trossosSemblants(ta, tb, ta.length >= 3 ? 2 : 1)) return true;

  // 5. Un cognom de menys: el nom llarg sense l'últim tros és el curt.
  const [curt, llarg] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  if (curt.length >= 2 && llarg.length === curt.length + 1) {
    if (trossosSemblants(curt, llarg.slice(0, -1), 1)) return true;
  }
  return false;
}

/** L'any en què comença un mandat «2015-2019». */
const anyDelTerm = (term: string): number => Number(term.slice(0, 4)) || 0;

/**
 * El mandat en què cau una data. Es prova amb la data de constitució real del
 * mandat quan es té (la primera presa de possessió a Catalunya, que calcula
 * `deriveMayorChanges`), i si no, amb l'1 de juny de l'any, que és abans de
 * qualsevol constitució de ple. Una data anterior al primer mandat no és de cap.
 */
export function termDe(data: string, terms: readonly string[], termStarts: ReadonlyMap<string, string> = new Map()): string | null {
  const ordenats = [...terms].sort();
  let trobat: string | null = null;
  for (const term of ordenats) {
    const inici = termStarts.get(term) ?? `${anyDelTerm(term)}-06-01`;
    if (data >= inici) trobat = term;
  }
  return trobat;
}

/** Dies entre dues dates ISO, de la primera a la segona. */
const diesEntre = (a: string, b: string): number => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/**
 * La presa de possessió del qui va obrir un mandat segons una font oficial
 * (no Wikidata), si n'hi ha: la primera del mandat, i només si cau dins dels
 * quaranta-cinc dies de la constitució general. Un que arriba més tard —
 * Guijarro, el novembre del 2021— és un relleu, no qui va obrir el mandat, i
 * no diu res de fins quan va durar l'alcalde sortint en funcions.
 */
function primerOficialDe(
  historial: readonly PasAlcaldia[],
  term: string,
  inici: string,
  ministeri: readonly AlcaldiaMinisteri[] = [],
): string | undefined {
  const primera = obridorsOficials(historial, term, inici, ministeri).map((o) => o.data).sort()[0];
  return primera;
}

/** Dies de marge sobre la constitució del ple: qui pren possessió dins d'aquest marge va obrir el mandat. */
const MARGE_CONSTITUCIO = 45;

/**
 * Qui va obrir un mandat segons les fonts oficials: les files de la
 * Generalitat amb data de presa de possessió dins dels quaranta-cinc dies de
 * la constitució i, com que la Generalitat no en dona cap data del 2011 ençà,
 * també les preses de possessió del Ministeri (J35) dins del mateix marge. Una
 * fila de la Generalitat sense data que lliga amb una persona del Ministeri en
 * pren la data del Ministeri. Una fila sense data enlloc no compta: no se sap
 * si va obrir el mandat o va arribar-hi tard.
 *
 * És el que fa que **la font oficial mani sobre Wikidata**: si una font
 * oficial diu que el mandat el va obrir una altra persona, un tram de
 * Wikidata que travessa la constitució (Jordi Hereu, que Wikidata data fins a
 * l'1 de juliol del 2011) no hi pot crear cap mandat.
 */
function obridorsOficials(
  historial: readonly PasAlcaldia[],
  term: string,
  inici: string,
  ministeri: readonly AlcaldiaMinisteri[],
): { nom: string; data: string }[] {
  const delMinisteri = ministeri.filter((m) => m.mandat === term && m.possessio !== null);
  const obridors: { nom: string; data: string }[] = [];
  for (const r of historial) {
    if (r.term !== term || r.font !== undefined) continue;
    const data = r.tookOfficeOn ?? delMinisteri.find((m) => mateixaPersona(m.nom, r.name))?.possessio ?? null;
    if (data !== null && Math.abs(diesEntre(inici, data)) <= MARGE_CONSTITUCIO) obridors.push({ nom: r.name, data });
  }
  for (const m of delMinisteri) {
    if (Math.abs(diesEntre(inici, m.possessio!)) <= MARGE_CONSTITUCIO) obridors.push({ nom: m.nom, data: m.possessio! });
  }
  return obridors;
}

const compareDates = (a: string | null, b: string | null): number => (a ?? "").localeCompare(b ?? "");

/**
 * Completa l'historial d'un municipi amb el que Wikidata en sap. Torna un
 * historial nou, ordenat per mandat i data de presa de possessió, amb totes
 * les files de la Generalitat intactes en els seus camps originals.
 */
export function fusionaAmbWikidata(
  generalitat: readonly PasAlcaldia[],
  wikidata: readonly AlcaldiaWikidata[],
  termStarts: ReadonlyMap<string, string> = new Map(),
  /**
   * Les alcaldies del Ministeri (J35), si n'hi ha, només per saber qui va
   * obrir cada mandat segons una font oficial (`obridorsOficials`). No
   * s'afegeix res d'aquí: això ho fa `fusionaAmbMinisteri`, després.
   */
  ministeri: readonly AlcaldiaMinisteri[] = [],
): PasAlcaldia[] {
  const terms = [...new Set(generalitat.map((r) => r.term))];
  const resultat: PasAlcaldia[] = generalitat.map((r) => ({ ...r }));

  const ordenatsPerTram = [...terms].sort();
  for (const alcaldia of wikidata) {
    if (alcaldia.inici === null) continue;
    const term = termDe(alcaldia.inici, terms, termStarts);
    if (term === null) continue;
    // Si Wikidata diu que va acabar abans que el mandat comencés, la data
    // d'inici és sospitosa; no s'hi afegeix res.
    if (alcaldia.fi !== null && alcaldia.fi < alcaldia.inici) continue;
    // Si el tram continua al mandat següent, el final i el seu motiu no són
    // d'aquest mandat: van al tram de després (vegeu més avall).
    const seguent = ordenatsPerTram[ordenatsPerTram.indexOf(term) + 1];
    const iniciSeguent = seguent !== undefined ? (termStarts.get(seguent) ?? `${seguent.slice(0, 4)}-06-15`) : null;
    // Acaba en aquest mandat si plega abans del ple següent, o el mateix dia
    // (o abans) que el primer alcalde oficial del següent pren possessió al
    // seu poble: fins llavors era l'alcalde sortint en funcions, no un
    // alcalde del mandat nou (vegeu més avall, on el tram no es duplica).
    const primerOficialSeguent =
      seguent === undefined || iniciSeguent === null ? undefined : primerOficialDe(resultat, seguent, iniciSeguent, ministeri);
    const acabaEnAquest =
      alcaldia.fi !== null &&
      (iniciSeguent === null || alcaldia.fi < iniciSeguent || (primerOficialSeguent !== undefined && alcaldia.fi <= primerOficialSeguent));
    // Si continua, el tram d'aquest mandat s'acaba on comença el següent:
    // la durada surt bé i el motiu de deixar-ho, que és d'un altre any, no.
    const fi = acabaEnAquest ? alcaldia.fi : iniciSeguent;
    const motiuFinal = acabaEnAquest ? alcaldia.motiuFinal : null;

    const delMandat = resultat.filter((r) => r.term === term);
    const seves = delMandat.filter((r) => mateixaPersona(r.name, alcaldia.nom));
    if (seves.length > 0) {
      // Lliga amb la Generalitat: s'enriqueix la fila més propera en data, i
      // només amb el que la Generalitat no té.
      const distancia = (r: PasAlcaldia): number =>
        r.tookOfficeOn === null ? Number.POSITIVE_INFINITY : Math.abs(Date.parse(r.tookOfficeOn) - Date.parse(alcaldia.inici!));
      const fila = [...seves].sort((a, b) => distancia(a) - distancia(b))[0]!;
      // La Generalitat sovint no dona la data de presa de possessió de qui
      // arriba a mig mandat (Guijarro, 2021): si Wikidata la té, es completa.
      if (fila.tookOfficeOn === null) fila.tookOfficeOn = alcaldia.inici;
      if (fila.qid === undefined) fila.qid = alcaldia.qid;
      if (fila.finsA === undefined || fila.finsA === null) fila.finsA = fi;
      if (fila.motiuFinal === undefined || fila.motiuFinal === null) fila.motiuFinal = motiuFinal;
      if (alcaldia.interina) fila.interina = true;
      if (alcaldia.partit !== null && (fila.partyRaw === null || partitTruncat(fila.partyRaw)) && !fila.partitWikidata) {
        fila.partitWikidata = alcaldia.partit;
      }
      continue;
    }

    // Un pas nou que diu haver obert el mandat (comença dins del marge de la
    // constitució) quan una font oficial diu que el va obrir una altra
    // persona: no és un forat de la Generalitat, és una contradicció, i mana
    // la font oficial. Els relleus a mig mandat sí que s'hi afegeixen.
    const iniciTerm = termStarts.get(term) ?? `${anyDelTerm(term)}-06-15`;
    if (Math.abs(diesEntre(iniciTerm, alcaldia.inici)) <= MARGE_CONSTITUCIO) {
      const obridors = obridorsOficials(resultat, term, iniciTerm, ministeri);
      if (obridors.length > 0 && !obridors.some((o) => mateixaPersona(o.nom, alcaldia.nom))) continue;
    }

    resultat.push({
      term,
      name: alcaldia.nom,
      partyRaw: null,
      tookOfficeOn: alcaldia.inici,
      font: "wikidata",
      qid: alcaldia.qid,
      finsA: fi,
      motiuFinal,
      interina: alcaldia.interina,
      partitWikidata: alcaldia.partit,
    });
  }

  /*
   * Un tram de Wikidata que travessa un ple de constitució és la mateixa
   * persona a dos mandats: Àlex Pastor va ser alcalde del juny del 2018 a
   * l'abril del 2020, o sigui el final del 2015-2019 i el començament del
   * 2019-2023. Sense això el segon mandat començava per qui el va rellevar i
   * no per qui el va obrir. Als mandats següents la data d'inici és la del
   * ple de constitució, i el motiu del final només va al darrer tram.
   */
  const ordenats = [...terms].sort();
  for (const alcaldia of wikidata) {
    if (alcaldia.inici === null) continue;
    const primer = termDe(alcaldia.inici, ordenats, termStarts);
    if (primer === null) continue;
    for (const term of ordenats) {
      if (term <= primer) continue;
      const inici = termStarts.get(term) ?? `${term.slice(0, 4)}-06-15`;
      if (inici < alcaldia.inici) continue;
      if (alcaldia.fi !== null && alcaldia.fi <= inici) break;
      if (resultat.some((r) => r.term === term && mateixaPersona(r.name, alcaldia.nom))) continue;
      // Qui deixa l'alcaldia el mateix dia (o abans) que el primer alcalde
      // oficial del mandat pren possessió no va ser alcalde d'aquest mandat:
      // era el sortint en funcions fins al ple de constitució del seu poble.
      // Wikidata data Màrius Díaz fins al 24 de maig del 1983, que és el dia
      // que Joan Blanch va prendre possessió a Badalona; sense això, un tram
      // de setze dies de Díaz encapçalaria el 1983-1987.
      //
      // I en general: si una font oficial (la Generalitat o el Ministeri) diu
      // que aquest mandat el va obrir una altra persona, el tram de Wikidata
      // s'atura aquí, plegui quan plegui segons Wikidata. Jordi Hereu, que
      // Wikidata data fins a l'1 de juliol del 2011, no té cap mandat
      // 2011-2015: aquell mandat el va obrir Xavier Trias.
      const obridors = obridorsOficials(resultat, term, inici, ministeri);
      if (obridors.length > 0 && !obridors.some((o) => mateixaPersona(o.nom, alcaldia.nom))) break;
      const primerOficial = primerOficialDe(resultat, term, inici, ministeri);
      if (alcaldia.fi !== null && primerOficial !== undefined && alcaldia.fi <= primerOficial) break;
      const seguent = ordenats[ordenats.indexOf(term) + 1];
      const finsAlMandat = seguent !== undefined ? (termStarts.get(seguent) ?? `${seguent.slice(0, 4)}-06-15`) : null;
      const acabaAqui = alcaldia.fi !== null && (finsAlMandat === null || alcaldia.fi < finsAlMandat);
      resultat.push({
        term,
        name: alcaldia.nom,
        partyRaw: null,
        tookOfficeOn: inici,
        font: "wikidata",
        qid: alcaldia.qid,
        finsA: acabaAqui ? alcaldia.fi : null,
        motiuFinal: acabaAqui ? alcaldia.motiuFinal : null,
        interina: alcaldia.interina,
        partitWikidata: alcaldia.partit,
      });
    }
  }

  return resultat.sort((a, b) => a.term.localeCompare(b.term) || compareDates(a.tookOfficeOn, b.tookOfficeOn));
}

/**
 * Una LISTA del Ministeri que diu alguna cosa. Des del 2015 gairebé totes són
 * «C. ELECTORAL» (o «C.ELECTORAL») i «OTROS», que volen dir «una candidatura»
 * i «una altra»: no és cap partit i no es publica com si ho fos.
 */
export function llistaMinisteriAmbSentit(llista: string | null): string | null {
  if (llista === null) return null;
  const n = normalize(llista);
  if (n === "" || n === "c electoral" || n === "otros") return null;
  return llista.trim();
}

/**
 * Completa l'historial —el de la Generalitat ja fusionat amb Wikidata— amb el
 * que el Ministeri (J35) en sap. Va **després** de Wikidata i amb la mateixa
 * regla: no s'esborra ni es canvia res del que ja hi és; només s'omplen forats,
 * i cada forat omplert queda marcat perquè la pàgina digui «segons el
 * Ministeri». Tres coses, i una que no:
 *
 *   1. **Quan va acabar.** Un pas sense `finsA` de la mateixa persona i el
 *      mateix mandat que una fila del Ministeri amb FECHA BAJA en pren la
 *      data, amb `fontFi: "ministeri"`. Si Wikidata ja l'havia dita, mana la
 *      de Wikidata, que és la que ve amb el motiu.
 *   2. **Quan va començar.** La Generalitat sovint no dona la presa de
 *      possessió de qui arriba a mig mandat; si el Ministeri la té i ni la
 *      Generalitat ni Wikidata l'han posada, es completa amb `fontInici`.
 *   3. **Els passos que hi falten.** Una persona que el Ministeri té en un
 *      mandat i cap de les altres fonts hi té és un pas nou, amb
 *      `font: "ministeri"`, la possessió, la baixa i la llista si diu res.
 *   4. **El motiu, mai.** El Ministeri no diu per què algú va plegar, i
 *      `motiuFinal` no es toca en cap cas: no s'inventen motius.
 *
 * La persona es compara com sempre, amb `mateixaPersona()`: «XABIER García
 * Albiol» i «XAVIER GARCIA ALBIOL» són la mateixa pels cognoms i la inicial.
 * Només dins d'un mandat que l'historial ja tingui: no s'inventen mandats.
 * Una baixa anterior a la possessió és una errada del fitxer i no s'hi fa res.
 */
export function fusionaAmbMinisteri(historial: readonly PasAlcaldia[], ministeri: readonly AlcaldiaMinisteri[]): PasAlcaldia[] {
  const terms = new Set(historial.map((r) => r.term));
  const resultat: PasAlcaldia[] = historial.map((r) => ({ ...r }));
  // Només es reordena si s'ha afegit o completat res: sense el Ministeri,
  // l'historial ha de sortir exactament com ha entrat.
  let tocat = false;

  for (const alcaldia of ministeri) {
    if (!terms.has(alcaldia.mandat)) continue;
    const baixa = alcaldia.baixa !== null && alcaldia.possessio !== null && alcaldia.baixa < alcaldia.possessio ? null : alcaldia.baixa;

    const seves = resultat.filter((r) => r.term === alcaldia.mandat && mateixaPersona(r.name, alcaldia.nom));
    if (seves.length > 0) {
      // La fila més propera en data de possessió: la mateixa persona pot
      // haver tingut dos trams en un mandat, i cadascun s'ha de completar amb
      // la seva baixa i no amb la de l'altre.
      const distancia = (r: PasAlcaldia): number =>
        r.tookOfficeOn === null || alcaldia.possessio === null ? Number.POSITIVE_INFINITY : Math.abs(Date.parse(r.tookOfficeOn) - Date.parse(alcaldia.possessio));
      const fila = [...seves].sort((a, b) => distancia(a) - distancia(b))[0]!;
      if ((fila.finsA === undefined || fila.finsA === null) && baixa !== null) {
        fila.finsA = baixa;
        fila.fontFi = "ministeri";
        tocat = true;
      }
      if (fila.tookOfficeOn === null && alcaldia.possessio !== null) {
        fila.tookOfficeOn = alcaldia.possessio;
        fila.fontInici = "ministeri";
        tocat = true;
      }
      continue;
    }

    tocat = true;
    resultat.push({
      term: alcaldia.mandat,
      name: alcaldia.nom,
      partyRaw: null,
      tookOfficeOn: alcaldia.possessio,
      font: "ministeri",
      finsA: baixa,
      llistaMinisteri: llistaMinisteriAmbSentit(alcaldia.llista),
    });
  }

  if (!tocat) return resultat;
  return resultat.sort((a, b) => a.term.localeCompare(b.term) || compareDates(a.tookOfficeOn, b.tookOfficeOn));
}

/**
 * Els noms sencers de partit que Wikidata dona i `siglesFamily()` no reconeix,
 * perquè està feta per a sigles de paperetes. Només les marques que el
 * projecte ja té (`BRANDS_BY_ID`): la família serveix per pintar el color i
 * per dir si un relleu va canviar de mans, i una família inventada faria
 * les dues coses malament.
 */
const NOMS_SENCERS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bpartit dels socialistes de catalunya\b|\bpartido socialista obrero espanol\b/, "psc"],
  [/\bpartit popular\b|\bpartido popular\b/, "pp"],
  [/\bcandidatura d unitat popular\b/, "cup"],
  [/\bciutadans\b|\bciudadanos\b/, "cs"],
  [/\bvox\b/, "vox"],
  [/\bpodem\b|\bpodemos\b/, "podem"],
  [/\bpartit democrata europeu catala\b|\bpartit democrata catala\b/, "pdecat"],
  [/\balianca catalana\b/, "aliancacat"],
  [/\bconvergencia democratica de catalunya\b|\bunio democratica de catalunya\b|\bconvergencia i unio\b/, "ciu"],
  [/\besquerra republicana de catalunya\b/, "erc"],
  [/\bjunts per catalunya\b/, "junts"],
  [/\biniciativa per catalunya\b|\ben comu podem\b|\bcatalunya en comu\b/, "comuns"],
];

/** La família d'un partit, escrit com a sigles o amb el nom sencer de Wikidata. */
export function familiaDelPartit(partit: string | null | undefined): string | null {
  if (partit === null || partit === undefined || partit.trim() === "") return null;
  const coneguda = siglesFamily(partit);
  if (coneguda !== null) return coneguda;
  const n = normalize(partit);
  for (const [patro, familia] of NOMS_SENCERS) if (patro.test(n)) return familia;
  return null;
}

/**
 * La causa del final tal com es diu a la pàgina. Wikidata en dona l'etiqueta
 * de l'element («dimissió», «moció de censura», «mort»), i la frase surt del
 * que hi diu; una etiqueta que no coneixem es mostra tal qual, que és millor
 * que callar-la.
 */
export function motiuFinalEscrit(motiu: string | null | undefined): string | null {
  if (motiu === null || motiu === undefined || motiu.trim() === "") return null;
  const n = normalize(motiu);
  if (/dimissi|resign/.test(n)) return "va dimitir";
  if (/censura|no confidence/.test(n)) return "moció de censura";
  if (/\b(mort|defuncio|deces|death)\b/.test(n)) return "va morir";
  if (/inhabilit/.test(n)) return "inhabilitació";
  if (/renunci/.test(n)) return "va renunciar";
  if (/eleccio|election/.test(n)) return "va acabar el mandat";
  return motiu.trim();
}
