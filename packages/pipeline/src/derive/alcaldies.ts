import { siglesFamily } from "@quivoto/shared-schemas/brands";
import type { AlcaldiaWikidata } from "../jobs/j31-alcaldies-wikidata";
import { normalize, normalizePersonName } from "../lib/text";

/**
 * Fusió de l'historial d'alcaldies de la Generalitat amb el de Wikidata (J31).
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

/** Una fila de l'historial, de la Generalitat o afegida de Wikidata. */
export type PasAlcaldia = {
  term: string;
  name: string;
  partyRaw: string | null;
  tookOfficeOn: string | null;
  /** Només a les files que no són de la Generalitat. */
  font?: "wikidata";
  /** QID de la persona a Wikidata, quan la fila hi lliga. */
  qid?: string;
  /** Data de fi (P582), de Wikidata, en `AAAA-MM-DD`. */
  finsA?: string | null;
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
 * La mateixa persona escrita per dues fonts. Primer el nom sencer normalitzat;
 * si no lliga, els dos últims cognoms iguals i la mateixa inicial del nom de
 * pila, que és com «Alejandro Pastor López» i «Àlex Pastor López» s'ajunten.
 * Només es fa servir dins d'un mateix mandat, on la probabilitat que hi hagi
 * dues persones amb els mateixos cognoms i la mateixa inicial és negligible.
 */
export function mateixaPersona(a: string, b: string): boolean {
  const na = normalizePersonName(a);
  const nb = normalizePersonName(b);
  if (na === "" || nb === "") return false;
  if (na === nb) return true;
  const parts = (n: string): { inicial: string; cognoms: string } => {
    const tokens = n.split(" ");
    return { inicial: tokens[0]![0] ?? "", cognoms: tokens.length >= 3 ? tokens.slice(-2).join(" ") : tokens.slice(-1).join(" ") };
  };
  const pa = parts(na);
  const pb = parts(nb);
  return pa.inicial === pb.inicial && pa.cognoms.length >= 5 && pa.cognoms === pb.cognoms;
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
): PasAlcaldia[] {
  const terms = [...new Set(generalitat.map((r) => r.term))];
  const resultat: PasAlcaldia[] = generalitat.map((r) => ({ ...r }));

  for (const alcaldia of wikidata) {
    if (alcaldia.inici === null) continue;
    const term = termDe(alcaldia.inici, terms, termStarts);
    if (term === null) continue;
    // Si Wikidata diu que va acabar abans que el mandat comencés, la data
    // d'inici és sospitosa; no s'hi afegeix res.
    if (alcaldia.fi !== null && alcaldia.fi < alcaldia.inici) continue;

    const delMandat = resultat.filter((r) => r.term === term);
    const seves = delMandat.filter((r) => mateixaPersona(r.name, alcaldia.nom));
    if (seves.length > 0) {
      // Lliga amb la Generalitat: s'enriqueix la fila més propera en data, i
      // només amb el que la Generalitat no té.
      const distancia = (r: PasAlcaldia): number =>
        r.tookOfficeOn === null ? Number.POSITIVE_INFINITY : Math.abs(Date.parse(r.tookOfficeOn) - Date.parse(alcaldia.inici!));
      const fila = [...seves].sort((a, b) => distancia(a) - distancia(b))[0]!;
      if (fila.qid === undefined) fila.qid = alcaldia.qid;
      if (fila.finsA === undefined || fila.finsA === null) fila.finsA = alcaldia.fi;
      if (fila.motiuFinal === undefined || fila.motiuFinal === null) fila.motiuFinal = alcaldia.motiuFinal;
      if (alcaldia.interina) fila.interina = true;
      if (alcaldia.partit !== null && (fila.partyRaw === null || partitTruncat(fila.partyRaw)) && !fila.partitWikidata) {
        fila.partitWikidata = alcaldia.partit;
      }
      continue;
    }

    resultat.push({
      term,
      name: alcaldia.nom,
      partyRaw: null,
      tookOfficeOn: alcaldia.inici,
      font: "wikidata",
      qid: alcaldia.qid,
      finsA: alcaldia.fi,
      motiuFinal: alcaldia.motiuFinal,
      interina: alcaldia.interina,
      partitWikidata: alcaldia.partit,
    });
  }

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
