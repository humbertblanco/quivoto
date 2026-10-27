import { writeFile } from "node:fs/promises";
import { asc, eq } from "drizzle-orm";
import {
  candidatures,
  councilTerms,
  councillorMandates,
  electionResults,
  municipalities,
  people,
  politicalGroups,
  type Db,
} from "@quivoto/db";
import { PARTY_BRANDS, siglesFamily } from "@quivoto/shared-schemas/brands";
import { normalizePersonName, slugify } from "../lib/text";
import { carregaMetriques } from "./metriques";
import { adrecesRegidors } from "./regidor";
import { assignaSlugs } from "./candidatura";
import {
  adrecesAlcaldies,
  alcaldiesHistoriques,
  genereDe,
  periodesDeLaPersona,
  sexesPerNom,
  type HistorialAlcaldies,
} from "./alcaldia-historica";
import type { Els947Row } from "./els947";
import type { DadesEns, TipusEns } from "./ens-tipus";

/**
 * L'índex per anar a qualsevol lloc de l'Observatori sense passar per la portada.
 *
 * Va néixer amb 947 municipis i prou, i el que hi faltava era justament el que
 * la gent escriu: el nom de l'alcaldessa, el del seu regidor, les sigles de la
 * llista del seu poble. Buscar «Collboni» no trobava res i buscar «ERC» tampoc,
 * quan de totes dues coses n'hi ha pàgina publicada.
 *
 * ## Tres fitxers, i per què
 *
 * `cerca.json` són els 947 municipis amb l'alcaldia **plegada dins la fila**
 * —116 kB, 34 kB comprimits— i és el que es baixa quan s'obre la casella.
 * `cerca-electes.json` són els regidors —tots els que tenen fitxa, uns 9.100
 * dels 947 municipis— i les 2.626 candidatures: uns 370 kB, 130 kB
 * comprimits, que es baixa tot sol darrere del primer. Partir-ho no és
 * una manieta: la major part de les cerques s'acaben al primer fitxer, i qui
 * escriu «rubi» ha de tenir el resultat abans que arribin els electes.
 *
 * `cerca-alcaldies.json` és el tercer: les 4.400 persones que han tingut
 * l'alcaldia des del 1979 i que avui no seuen al ple, cadascuna amb la seva
 * fitxa a `m/<municipi>/alcaldia/<persona>/`. Són tantes com els regidors
 * —uns 200 kB més— per a la pregunta que menys gent fa, i per això no van
 * dins del segon: es baixen darrere seu, i buscar «roig castell» troba en
 * Joan Roig Castell, alcalde d'Alcanar del 2003 al 2023, quan arriben.
 *
 * ## El que no es precalcula
 *
 * Per als electes **no hi ha ni clau de cerca ni slug al fitxer**. Escriure-hi
 * la clau de 7.433 files serien uns 90 kB de text repetit; el navegador la
 * deriva un sol cop en arribar amb la mateixa `clauCerca()` d'aquí, serialitzada
 * amb `toString()` i no copiada a mà, que és el patró que ja fa `els947.ts:217`.
 * El slug igual, amb `slugify()`.
 *
 * L'excepció és el que `slugify()` **no pot** endevinar, perquè no depèn del
 * nom sinó de qui més hi ha: dues persones del mateix ple que es diguin igual
 * van a `-2`, i unes sigles que no deixen cap lletra van a `llista-N`. Avui no
 * n'hi havia cap de cada mena entre els regidors de la seu i les 2.626
 * candidatures —els dos diccionaris sortien buits—, i justament per això les excepcions es **calculen** amb
 * `adrecesRegidors()` i `assignaSlugs()`, les mateixes funcions que decideixen
 * el nom del directori, en comptes d'escriure-les a mà: el dia que entri un
 * regidor amb el nom d'un company, l'enllaç aniria a la fitxa de l'altre i no
 * ho notaria ningú. Publicar l'adreça d'una altra persona és el pitjor error
 * que pot cometre aquest cercador.
 */

export type FilaCerca = {
  /** slug, nom, comarca, habitants */
  s: string;
  n: string;
  c: string;
  h: number;
  /** clau de cerca ja normalitzada */
  k: string;
  /** qui té l'alcaldia, i l'índex de les seves sigles al diccionari `sig` */
  a: string | null;
  g: number | null;
};

/**
 * El que es baixa a la primera: municipis, alcaldies i marques.
 *
 * Les sigles van a un diccionari perquè «ERC-AM» surt a 700 files i escrita
 * sencera a cadascuna són 6 kB de la mateixa cadena; els partits hi caben
 * perquè són divuit files i han de poder-se buscar sense esperar res.
 */
export type IndexCerca = {
  sig: string[];
  mun: FilaCerca[];
  /** nom de la marca, sigla curta amb què la busca la gent, alcaldies i habitants governats */
  par: [string, string, number, number][];
  /**
   * Les diputacions i els consells comarcals: nom, mena, slug, habitants de
   * l'àmbit (0 si no consta) i municipis. **És opcional a posta**: un
   * `cerca.json` d'abans no el porta, i el guió del navegador ha de continuar
   * funcionant amb un índex vell que encara sigui a la memòria cau d'algú.
   * L'adreça no hi va escrita: la deriva el navegador amb `adrecaEns()`, la
   * mateixa funció que decideix el directori de cada fitxa.
   */
  ens?: FilaEns[];
};

/** Una fila d'ens a l'índex: [nom, mena, slug, habitants, municipis]. */
export type FilaEns = [string, TipusEns, string, number, number];

/** Sense accents, sense article inicial i sense signes. La mateixa d'els947. */
export function clauCerca(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, " ")
    .replace(/^(l|el|la|els|les|es|sa)\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ----------------------------------------------------------------- rànquing

/**
 * Cada mena de resultat i el que val quan dues coses lliguen igual de bé.
 *
 * L'ordre no és una opinió sobre què importa més: és què s'ha escrit. Qui
 * escriu quatre lletres busca un lloc molt més sovint que una persona, i entre
 * les persones busca abans qui mana. Els blocs d'aquesta pàgina van al davant
 * de tot perquè són l'únic resultat que no fa marxar d'on s'és.
 *
 * Qui va tenir l'alcaldia i ja no seu al ple va l'últim de tot: amb un cognom
 * escrit a mitges, la gent que hi és avui ha de sortir abans que la de fa
 * trenta anys. Un exalcalde que **comença** pel que s'ha escrit continua
 * passant al davant de qualsevol regidor que només ho dugui a dins.
 */
export const TIPUS = {
  Bloc: 6,
  Municipi: 5,
  Alcaldia: 4,
  Comarca: 3,
  Ens: 3,
  Partit: 3,
  Candidatura: 2,
  Regidor: 1,
  Exalcaldia: 0,
} as const;

export type Mena = keyof typeof TIPUS;

/** Un candidat ja aplanat: mena, clau de cerca, què es veu, el pes i on tornar-lo a trobar. */
export type Candidat = { m: Mena; k: string; t: string; w: number; i: number };

/**
 * Com de bé lliga «q» amb aquesta clau.
 *
 * 3 si la clau sencera hi comença, 2 si hi comença una paraula interior, 1 si
 * només hi és a dins, 0 si no hi és. **El 2 és el que fa que els cognoms
 * lliguin**, que és el 90% del que s'escriu quan es busca una persona: «riera»
 * ha de trobar la Marta Riera Rovira i no només qui es digui Riera de cognom
 * primer. El guionet compta com a separador perquè «am» ha de trobar «ERC-AM».
 */
export function qualitat(k: string, q: string): number {
  var p = k.indexOf(q);
  if (p < 0) return 0;
  if (p === 0) return 3;
  while (p > 0) {
    var abans = k.charAt(p - 1);
    if (abans === " " || abans === "-") return 2;
    p = k.indexOf(q, p + 1);
  }
  return 1;
}

/**
 * El rànquing sencer: `qualitat * 8 + tipus`, i els empats per població.
 *
 * Multiplicar la qualitat per 8 és el que garanteix que cap mena no passi al
 * davant d'una coincidència millor: hi ha 7 punts de tipus com a màxim, així
 * que un regidor que comenci pel que s'ha escrit (3·8+1 = 25) queda per sota
 * de qualsevol municipi que hi comenci (3·8+5 = 29) i per sobre de tot el que
 * només ho dugui a dins.
 *
 * **El desempat de debò és el pes.** «marti» lliga uns dos-cents regidors amb
 * exactament la mateixa puntuació, i el que decideix quins dotze es veuen són
 * els habitants del seu municipi: sense això sortirien en l'ordre en què la
 * base de dades va escriure les files, que no vol dir res per a ningú. L'ordre
 * alfabètic només arriba a decidir entre dues persones del mateix poble.
 *
 * Va escrita amb `var` i sense res modern a posta: aquesta funció se serialitza
 * amb `toString()` i s'executa al navegador tal com és.
 */
export function classifica(
  q: string,
  tots: readonly Candidat[],
  quants: number,
): Candidat[] {
  var puntuats: { c: Candidat; p: number }[] = [];
  for (var i = 0; i < tots.length; i++) {
    var qual = qualitat(tots[i]!.k, q);
    if (qual > 0) puntuats.push({ c: tots[i]!, p: qual * 8 + TIPUS[tots[i]!.m] });
  }
  puntuats.sort(function (a, b) {
    return b.p - a.p || b.c.w - a.c.w || a.c.t.localeCompare(b.c.t, "ca");
  });
  // La mateixa cosa no hi pot sortir dues vegades. Un partit hi entra amb dues
  // claus —el nom sencer i la sigla curta, perquè ningú no escriu «Esquerra
  // Republicana de Catalunya»— i sense això «erc» tornaria ERC dos cops.
  var triats: Candidat[] = [];
  var vistos: Record<string, boolean> = {};
  for (var j = 0; j < puntuats.length && triats.length < quants; j++) {
    var seu = puntuats[j]!.c;
    var id = seu.m + " " + seu.i;
    if (vistos[id]) continue;
    vistos[id] = true;
    triats.push(seu);
  }
  return triats;
}

// -------------------------------------------------------------- els fitxers

/** Un diccionari de cadenes amb índexs estables, per no repetir «ERC-AM» 700 cops. */
function diccionari(): { id: (text: string | null) => number; llista: string[] } {
  const llista: string[] = [];
  const pos = new Map<string, number>();
  return {
    llista,
    id: (text) => {
      const net = (text ?? "").trim();
      if (net === "") return -1;
      let i = pos.get(net);
      if (i === undefined) {
        i = llista.length;
        llista.push(net);
        pos.set(net, i);
      }
      return i;
    },
  };
}

/**
 * Les 44 fitxes d'ens com a files de l'índex.
 *
 * Hi van amb el nom sencer —«Consell Comarcal del Bages»— perquè és el que
 * la gent copia d'una carta o d'una notícia, i el territori ja hi és a dins:
 * qui escriu «bages» troba primer la comarca (el nom hi comença) i just
 * darrere el consell (hi comença una paraula). La població és el pes, com a
 * tota la resta; si no consta s'hi posa 0, que només vol dir «va al final
 * dels empats», no que l'ens no tingui veïns.
 */
export function filesEnsDeCerca(ens: readonly DadesEns[]): FilaEns[] {
  return ens
    .map((e): FilaEns => [e.nom, e.tipus, e.slug, e.poblacio ?? 0, e.municipis.length])
    .sort((a, b) => clauCerca(a[0]).localeCompare(clauCerca(b[0]), "ca"));
}

/**
 * `ens` és opcional: sense, l'índex surt exactament com sortia abans, sense
 * ni tan sols la clau buida, perquè el fitxer no canviï de mida per res.
 */
export function indexDeCerca(files: readonly Els947Row[], ens?: readonly DadesEns[]): IndexCerca {
  const sigles = diccionari();
  const mun: FilaCerca[] = files
    .map((f) => {
      const g = sigles.id(f.g);
      return { s: f.s, n: f.n, c: f.c, h: f.p, k: clauCerca(f.n), a: f.a, g: g === -1 ? null : g };
    })
    .sort((a, b) => a.k.localeCompare(b.k, "ca"));

  /**
   * Els partits, comptats per alcaldies i no per candidatures.
   *
   * La pregunta que respon una fila de partit és «on mana aquesta gent», i per
   * això hi va la xifra d'alcaldies i no la de llistes presentades. Les llistes
   * locals en tenen centenars i **no hi surten**: «Llista local o d'electors»
   * no és un partit que es pugui buscar pel nom, és el calaix del que no en té.
   */
  const alcaldies = new Map<string, { quantes: number; habitants: number }>();
  for (const f of files) {
    const familia = f.g ? siglesFamily(f.g) : null;
    if (familia === null) continue;
    const compte = alcaldies.get(familia) ?? { quantes: 0, habitants: 0 };
    compte.quantes += 1;
    compte.habitants += f.p;
    alcaldies.set(familia, compte);
  }
  const par = PARTY_BRANDS.filter((b) => b.kind !== "local" && alcaldies.has(b.id))
    .map((b): [string, string, number, number] => {
      const compte = alcaldies.get(b.id)!;
      return [b.name, b.id, compte.quantes, compte.habitants];
    })
    .sort((a, b) => b[2] - a[2]);

  const index: IndexCerca = { sig: sigles.llista, mun, par };
  if (ens && ens.length > 0) index.ens = filesEnsDeCerca(ens);
  return index;
}

export async function escriuCerca(
  files: readonly Els947Row[],
  cami: string,
  ens?: readonly DadesEns[],
): Promise<number> {
  const index = indexDeCerca(files, ens);
  await writeFile(cami, JSON.stringify(index), "utf8");
  return index.mun.length;
}

// ------------------------------------------------------------------ electes

/**
 * L'única convocatòria que té pàgines publicades. Va escrita aquí com ja va
 * escrita a `comarques.ts`, `amb.ts` i `comparador.ts`: el dia que n'hi hagi
 * una altra s'ha de tocar a tots quatre llocs alhora, i és millor que es vegi.
 */
const ELECCIO = "M20231";

export type DadesElectes = {
  municipis: { id: number; slug: string }[];
  /**
   * Qui té fitxa pròpia, municipi per municipi, **en el mateix ordre i amb la
   * mateixa regla que `escriuRegidors()`** (vegeu `carrecsAmbFitxa()`): la
   * llista de la seu electrònica quan n'hi ha, i el registre electoral quan
   * no. Si l'índex sortís de cap altre lloc enviaria a adreces que no existeixen.
   */
  carrecs: { municipalityId: number; carrecs: { nom: string }[] }[];
  /** El ple segons el registre: és qui sap de quina llista va sortir cadascú. */
  mandats: { municipalityId: number; nom: string; sigles: string | null }[];
  /** Les llistes que van treure representació, amb el que ordena els seus slugs. */
  llistes: { municipalityId: number; sigles: string; seats: number; votes: number }[];
};

/**
 * El segon fitxer: qui seu als plens i amb quina llista s'hi va presentar.
 *
 * `reg` i `cand` no porten ni la clau ni el slug —els deriva el navegador— i
 * apunten al municipi per la seva **posició a `mun`**, que és el que fa que
 * 4.807 files ocupessin 190 kB i no 400 (avui en són el doble): repetir «sant-cugat-del-valles» a cada
 * regidor són 25 bytes per fila.
 */
export type IndexElectes = {
  sig: string[];
  /** nom, posició del municipi a `mun`, sigles (−1 si no se'n pot dir cap) */
  reg: [string, number, number][];
  /** sigles i posició del municipi a `mun` */
  cand: [number, number][];
  /**
   * posició del municipi → camí de la fitxa de qui hi té l'alcaldia, relatiu a
   * `m/<slug>/` («regidor/<persona>/»). Qui no hi és va a `#alcaldies`.
   */
  alc: Record<number, string>;
  /** les poques files on el slug no és `slugify()` del que es veu */
  exr: Record<number, string>;
  exc: Record<number, string>;
};

/**
 * Les persones que tenen fitxa a `m/<municipi>/regidor/`, amb la regla de
 * `escriuRegidors()` a `publish.ts`: **la seu electrònica mana quan hi és**, i
 * quan no hi és —483 dels 947 municipis, Santa Coloma de Gramenet inclosa—
 * la fitxa surt del registre electoral, en l'ordre del ple (`orderNum`).
 *
 * L'índex abans només llegia la seu, i per això trobava 4.807 persones de 464
 * municipis quan n'hi havia 9.094 pàgines a tots 947: qui buscava el nom
 * d'una regidora de Santa Coloma no la trobava, i la seva pàgina hi era.
 *
 * L'ordre importa: `adrecesRegidors()` dona el sufix `-2` a la segona persona
 * que es diu igual, i si aquí s'ordenés d'una altra manera l'enllaç aniria a
 * la fitxa de l'altra. Per això el registre arriba ja ordenat com el llegeix
 * la fitxa municipal (`loadRadiografia()`), i aquí només s'agrupa.
 */
export function carrecsAmbFitxa(
  seu: readonly { municipalityId: number; carrecs: { nom: string }[] }[],
  registre: readonly { municipalityId: number; nom: string }[],
): DadesElectes["carrecs"] {
  const deLaSeu = new Map(seu.filter((m) => m.carrecs.length > 0).map((m) => [m.municipalityId, m.carrecs]));
  const delRegistre = new Map<number, { nom: string }[]>();
  for (const r of registre) {
    if (deLaSeu.has(r.municipalityId)) continue;
    const llista = delRegistre.get(r.municipalityId) ?? [];
    llista.push({ nom: r.nom });
    delRegistre.set(r.municipalityId, llista);
  }
  return [
    ...[...deLaSeu].map(([municipalityId, carrecs]) => ({ municipalityId, carrecs })),
    ...[...delRegistre].map(([municipalityId, carrecs]) => ({ municipalityId, carrecs })),
  ];
}

export async function carregaElectes(db: Db): Promise<DadesElectes> {
  const municipis = await db
    .select({ id: municipalities.id, slug: municipalities.slug })
    .from(municipalities);

  // Els càrrecs van en blocs, com a `els947`: són uns 5 kB per municipi i
  // demanar la taula sencera de mètriques és el que fa petar PGlite.
  const metriques = await carregaMetriques(db, ["carrecs"]);
  const deLaSeu = metriques.map((m) => ({
    municipalityId: m.municipalityId,
    carrecs: ((m.data as { carrecs?: { nom: string }[] } | null)?.carrecs ?? []).map((c) => ({
      nom: c.nom,
    })),
  }));

  /**
   * Els mandats del mandat vigent, i només d'aquest.
   *
   * `councillor_mandates` desa una fila nova cada cop que canvia alguna cosa
   * —substitucions, canvis de grup—, i sense filtrar per mandat el mateix nom
   * hi surt amb les sigles del 2019 i les del 2023 alhora. Es filtra igual que
   * a `loadCandidatures()`.
   */
  const terms = await db
    .select({ id: councilTerms.id })
    .from(councilTerms)
    .where(eq(councilTerms.electionId, ELECCIO));
  const termIds = new Set(terms.map((t) => t.id));

  // Ni correu ni cap altra dada de contacte: només el que ha de sortir a la llista.
  // L'ordre és el de `loadRadiografia()` (`orderNum`), que és el que llegeix
  // `escriuRegidors()` quan la seu no diu res: vegeu `carrecsAmbFitxa()`.
  const files = await db
    .select({
      municipalityId: councillorMandates.municipalityId,
      termId: councillorMandates.termId,
      nom: people.fullName,
      sigles: candidatures.sigles,
      partyRaw: councillorMandates.partyRaw,
    })
    .from(councillorMandates)
    .innerJoin(people, eq(people.id, councillorMandates.personId))
    .leftJoin(politicalGroups, eq(politicalGroups.id, councillorMandates.groupId))
    .leftJoin(candidatures, eq(candidatures.id, politicalGroups.candidatureId))
    .orderBy(asc(councillorMandates.municipalityId), asc(councillorMandates.orderNum));
  /*
   * Les fitxes del registre: **totes les files** del municipi, sense filtrar
   * per mandat, perquè `loadRadiografia()` tampoc no hi filtra i
   * `escriuRegidors()` escriu una pàgina per cadascuna. Filtrar aquí faria
   * l'índex més net que el web, i enviaria a sufixos `-2` que no són on toca.
   */
  const carrecs = carrecsAmbFitxa(
    deLaSeu,
    files.map((f) => ({ municipalityId: f.municipalityId, nom: f.nom })),
  );
  const mandats = files
    .filter((m) => m.termId !== null && termIds.has(m.termId))
    .map((m) => ({
      municipalityId: m.municipalityId,
      nom: m.nom,
      // Les sigles de la candidatura són les bones; el text lliure de la font
      // només s'aprofita quan no hem sabut lligar el grup amb cap llista.
      sigles: m.sigles ?? m.partyRaw,
    }));

  const llistes = await db
    .select({
      municipalityId: candidatures.municipalityId,
      sigles: candidatures.sigles,
      seats: electionResults.seats,
      votes: electionResults.votes,
    })
    .from(candidatures)
    .innerJoin(electionResults, eq(electionResults.candidatureId, candidatures.id))
    .where(eq(candidatures.electionId, ELECCIO));

  return { municipis, carrecs, mandats, llistes };
}

/**
 * Construeix el segon índex a partir de **la mateixa llista de municipis** que
 * ha escrit el primer.
 *
 * Les posicions de `mun` són l'única cosa que lliga els dos fitxers, i tornar a
 * llegir els municipis de la base per calcular-les seria l'error que ningú no
 * veuria: n'hi hauria prou que l'ordenació canviés perquè cada regidor sortís
 * amb el poble del veí. Es passa `files` i es torna a ordenar aquí amb la
 * mateixa funció, que és determinista.
 */
export function indexDeCercaElectes(
  files: readonly Els947Row[],
  dades: DadesElectes,
): IndexElectes {
  const mun = indexDeCerca(files).mun;
  const posPerSlug = new Map(mun.map((m, i) => [m.s, i]));
  const slugPerId = new Map(dades.municipis.map((m) => [m.id, m.slug]));
  const sigles = diccionari();

  /**
   * De quina llista és cada persona del ple.
   *
   * Si el mateix nom hi surt amb dues sigles diferents —perquè va canviar de
   * grup a mig mandat, o perquè al ple hi ha dues persones que es diuen igual—
   * no se'n diu cap. Al costat d'un nom, unes sigles que no li toquen són pitjor
   * que cap sigla.
   */
  const siglesPerPersona = new Map<string, string | null>();
  for (const m of dades.mandats) {
    const clau = `${m.municipalityId}\u0000${normalizePersonName(m.nom)}`;
    if (!siglesPerPersona.has(clau)) siglesPerPersona.set(clau, m.sigles);
    else if (siglesPerPersona.get(clau) !== m.sigles) siglesPerPersona.set(clau, null);
  }

  /**
   * On va l'alcaldia de cada municipi.
   *
   * Aquí es tornava a decidir, aparellant el nom oficial amb la llista de la
   * seu electrònica, i era la tercera manera de decidir-ho del web: la fitxa
   * del municipi en tenia una, la llista dels 947 una altra i aquesta la
   * tercera. Ara ho decideix `resolAlcaldia()` una sola vegada, a
   * `loadEls947()`, i la fila ja ho porta: el cercador envia exactament on
   * envia el nom de l'alcaldia a la llista, amb la fitxa de persona dels
   * municipis sense seu inclosa. Qui no en té va a l'apartat d'alcaldies.
   */
  const alc: Record<number, string> = {};
  for (const f of files) {
    const iMun = posPerSlug.get(f.s);
    if (iMun !== undefined && f.ad) alc[iMun] = f.ad;
  }

  const reg: [string, number, number][] = [];
  const exr: Record<number, string> = {};
  for (const fitxa of dades.carrecs) {
    const slug = slugPerId.get(fitxa.municipalityId);
    if (slug === undefined) continue;
    const iMun = posPerSlug.get(slug);
    if (iMun === undefined) continue;

    // La mateixa funció que decideix el nom del directori: si aquí es
    // recalculés d'una altra manera, l'enllaç aniria a una pàgina que no hi és.
    const adreces = adrecesRegidors(fitxa.carrecs);
    for (const [carrec, adreca] of adreces) {
      const i = reg.length;
      const seves = siglesPerPersona.get(
        `${fitxa.municipalityId}\u0000${normalizePersonName(carrec.nom)}`,
      );
      reg.push([carrec.nom, iMun, sigles.id(seves ?? null)]);
      if (adreca !== slugify(carrec.nom)) exr[i] = adreca;
    }
  }

  const perMunicipi = new Map<number, DadesElectes["llistes"]>();
  for (const l of dades.llistes) {
    const llista = perMunicipi.get(l.municipalityId) ?? [];
    llista.push(l);
    perMunicipi.set(l.municipalityId, llista);
  }

  const cand: [number, number][] = [];
  const exc: Record<number, string> = {};
  for (const [municipalityId, totes] of perMunicipi) {
    const slug = slugPerId.get(municipalityId);
    if (slug === undefined) continue;
    const iMun = posPerSlug.get(slug);
    if (iMun === undefined) continue;
    // El mateix ordre que `loadCandidatures()`: el slug amb sufix depèn de qui
    // arriba primer, i ordenar-ho diferent el posaria a l'altra candidatura.
    const ambEscons = totes
      .filter((l) => l.seats > 0)
      .sort((a, b) => b.seats - a.seats || b.votes - a.votes || a.sigles.localeCompare(b.sigles, "ca"));
    const slugs = assignaSlugs(ambEscons.map((l) => l.sigles));
    ambEscons.forEach((l, j) => {
      const i = cand.length;
      cand.push([sigles.id(l.sigles), iMun]);
      if (slugs[j] !== slugify(l.sigles)) exc[i] = slugs[j]!;
    });
  }

  return { sig: sigles.llista, reg, cand, alc, exr, exc };
}

export async function escriuCercaElectes(
  db: Db,
  files: readonly Els947Row[],
  cami: string,
): Promise<{ regidors: number; candidatures: number }> {
  const index = indexDeCercaElectes(files, await carregaElectes(db));
  await writeFile(cami, JSON.stringify(index), "utf8");
  return { regidors: index.reg.length, candidatures: index.cand.length };
}

// ---------------------------------------------------------------- alcaldies

export type DadesAlcaldies = {
  municipis: { id: number; slug: string }[];
  /**
   * L'historial de cada municipi: **la mètrica `mayors`**, la mateixa que
   * llegeix `escriuAlcaldiesHistoriques()` per escriure les fitxes. Si l'índex
   * sortís de la taula crua, la fusió de variants i els relleus a mig mandat
   * es tornarien a decidir aquí i podrien no dir el mateix que la pàgina.
   */
  historials: { municipalityId: number; historial: HistorialAlcaldies }[];
  /** El sexe del registre de candidatures per nom normalitzat, per dir «alcalde» o «alcaldessa». */
  sexes: ReadonlyMap<string, "H" | "D">;
};

/**
 * El tercer fitxer: qui ha tingut l'alcaldia i avui no seu al ple.
 *
 * Com els electes, sense clau ni slug: el navegador deriva la clau amb
 * `clauCerca()` i l'adreça amb `"alcaldia/" + slugify(nom) + "/"`, i les
 * poques files on el directori no és aquest van a `exa` amb l'adreça sencera.
 * El càrrec va com un número i no com a text perquè són 4.400 files.
 */
export type IndexAlcaldies = {
  sig: string[];
  /**
   * nom, posició del municipi a `mun`, anys («2003-2023», «1991-1995 i
   * 2003-2011»), sigles del mandat més recent (−1 si no se'n pot dir cap) i
   * càrrec: 0 no se sap, 1 alcalde, 2 alcaldessa.
   */
  alc: [string, number, string, number, number][];
  /**
   * posició del municipi → fitxa d'alcaldia de qui hi té l'alcaldia avui i
   * **no** té fitxa de regidor. La fila d'alcaldia dels 947 va a `#alcaldies`
   * quan l'índex d'electes no li sap cap fitxa; amb això va a la seva pàgina.
   */
  act: Record<number, string>;
  /** les poques files on l'adreça no és `alcaldia/<slugify(nom)>/` */
  exa: Record<number, string>;
};

export async function carregaAlcaldies(db: Db): Promise<DadesAlcaldies> {
  const municipis = await db
    .select({ id: municipalities.id, slug: municipalities.slug })
    .from(municipalities);
  const historials = (await carregaMetriques(db, ["mayors"])).map((m) => ({
    municipalityId: m.municipalityId,
    historial: m.data as HistorialAlcaldies,
  }));
  return { municipis, historials, sexes: await sexesPerNom(db) };
}

/**
 * Construeix el tercer índex amb les mateixes persones, i els mateixos
 * directoris, que escriu `escriuAlcaldiesHistoriques()`.
 *
 * No es torna a decidir res: la fusió de «Joan Roig Castell» amb «Joan Roig i
 * Castell», el sufix `-2` de dos slugs iguals i l'adreça de cadascú els
 * decideix `alcaldiesHistoriques()` amb la fila dels 947 com a alcaldia vigent
 * —que és el que la fitxa li passa—, i `adrecesAlcaldies()` els llegeix. La
 * persona que hi és avui i que ja surt a l'índex —com a fila d'alcaldia del
 * municipi i, si en té, com a regidor— no s'hi repeteix: la seva pàgina
 * d'alcaldia és una redirecció, i l'índex no ha d'enviar a redireccions.
 */
export function indexDeCercaAlcaldies(
  files: readonly Els947Row[],
  dades: DadesAlcaldies,
): IndexAlcaldies {
  const mun = indexDeCerca(files).mun;
  const posPerSlug = new Map(mun.map((m, i) => [m.s, i]));
  const filaPerSlug = new Map(files.map((f) => [f.s, f]));
  const slugPerId = new Map(dades.municipis.map((m) => [m.id, m.slug]));
  const sigles = diccionari();

  const alc: IndexAlcaldies["alc"] = [];
  const act: Record<number, string> = {};
  const exa: Record<number, string> = {};
  for (const { municipalityId, historial } of dades.historials) {
    const slug = slugPerId.get(municipalityId);
    if (slug === undefined) continue;
    const iMun = posPerSlug.get(slug);
    const fila = filaPerSlug.get(slug);
    if (iMun === undefined || fila === undefined) continue;

    const persones = alcaldiesHistoriques(historial, {
      actual: { nom: fila.a, adreca: fila.ad ?? null },
    });
    const adreces = adrecesAlcaldies(persones);
    const clauVigent = fila.a ? normalizePersonName(fila.a) : "";
    for (const p of persones) {
      const adreca = adreces.get(p.clau)!;
      if (p.actual && p.clau === clauVigent) {
        // Ja hi és per la fila dels 947. Sense fitxa de regidor, aquella fila
        // no sabria on enviar: que vagi a la pàgina d'alcaldia, que és de debò.
        if (!p.fitxaRegidor) act[iMun] = adreca;
        continue;
      }
      // El càrrec de la seu no es mira: qui hi és avui ja ha quedat a dalt, i
      // per a la resta només parla el registre de candidatures.
      const genere = genereDe(p.clau, null, dades.sexes);
      const i = alc.length;
      alc.push([
        p.nom,
        iMun,
        periodesDeLaPersona(p),
        sigles.id(p.sigles),
        genere === "alcaldessa" ? 2 : genere === "alcalde" ? 1 : 0,
      ]);
      if (adreca !== `alcaldia/${slugify(p.nom)}/`) exa[i] = adreca;
    }
  }

  return { sig: sigles.llista, alc, act, exa };
}

export async function escriuCercaAlcaldies(
  db: Db,
  files: readonly Els947Row[],
  cami: string,
): Promise<number> {
  const index = indexDeCercaAlcaldies(files, await carregaAlcaldies(db));
  await writeFile(cami, JSON.stringify(index), "utf8");
  return index.alc.length;
}
