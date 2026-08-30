import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { mayors, municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { fetchImatge } from "../adapters/seue";
import { fetchJson, sleep } from "../lib/http";
import { normalizePersonName } from "../lib/text";
import { withRun } from "../lib/run";
import { MINIM_PX, directoriFotos, miniaturesDeBytes, miniaturesFetes } from "./j11-fotos";
import { fitxerCommons, textPla, titolNormalitzat, veredicteLlicencia } from "./j20-wikidata";
import {
  ANY_INICIAL,
  anysDelMandat,
  dataCurtaIso,
  normalitzaIne,
  qidDeUri,
  solapen,
  urlConsulta,
  type FilaAlcaldia,
} from "./j21-trajectoria-electes";

/**
 * J25 — les cares dels alcaldes d'abans.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÈ HI HA, I QUANT ÉS DE POC
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * J11 i J13 posen cara a qui mana **ara**. De qui manava el 1983, el 1995 o el
 * 2011 només en tenim el nom en una taula. Wikimedia Commons en guarda uns
 * quants retrats, i aquesta feina els va a buscar.
 *
 * Comptat contra WDQS el 30 d'agost del 2026, amb la mateixa definició
 * d'alcaldia que fa servir J21 (posició P31 = Q5663900 amb P1001 a un municipi
 * Q33146843 i qualificador P580 des del 1979):
 *
 *   · **362 persones** tenen fotografia a Wikidata (P18), repartides en **221
 *     municipis** dels 947 i amb **364 fitxers** de Commons: dues persones en
 *     porten dos. Amb etiqueta catalana n'hi ha 361, i per tant 363 fitxers.
 *   · Aquestes 362 són el **12,4 %** de les 2.921 persones que Wikidata dona com
 *     a alcaldes catalans des del 1979, i molt menys encara del nostre historial
 *     sencer: **al voltant d'un 6 %** de tots els alcaldes que hi tenim.
 *
 * Aquest 6 % no és un detall d'implementació: és el titular. Una graella
 * d'alcaldes on n'hi ha tres amb cara i onze amb silueta buida no informa de
 * res i sembla que assenyali. Per això la fitxa desa **quants alcaldes hi ha i
 * quants en tenen retrat** (`totalAlcaldesNostres` i `ambRetrat`), i la pàgina
 * ha de dir la xifra en lletres abans d'ensenyar cap cara.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * L'APARELLAMENT: EL MATEIX QUE JA FA J21, I NO UN DE NOU
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Posar una cara al costat d'un nom equivocat és pitjor que no posar-n'hi cap:
 * és una difamació silenciosa. J21 ja va resoldre com es lliga una persona de
 * Wikidata amb el nostre historial d'alcaldies, i aquí es fa **exactament igual
 * i amb les seves peces**: `normalizePersonName` per al nom, `anysDelMandat` per
 * llegir «2019-2023» i `solapen` per decidir si dos mandats es toquen. Calen les
 * tres coses alhora —mateix municipi, mateix nom normalitzat i dates que es
 * toquin— i, si no lliguen, **la cara no es baixa ni es desa**.
 *
 * Això darrer és la diferència amb J21: allà una persona no aparellada es desa
 * igualment, perquè el que s'hi publica és la seva trajectòria i no cap imatge.
 * Aquí la fitxa només porta camins de miniatura, i un camí desat és un camí que
 * algú acabarà dibuixant. Val més que no hi sigui.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA LLICÈNCIA, FITXER A FITXER, ABANS DE BAIXAR RES
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Que una imatge sigui a Commons no vol dir que sigui de domini públic. Es fa el
 * mateix que J20 amb les fotografies dels municipis: es demana a l'API de
 * Commons la llicència de cada fitxer, es passa per una **llista tancada** i el
 * que no hi és es descarta amb el motiu escrit. L'ordre de les comprovacions
 * també és el de J20: primer el que prohibeix, després el que permet.
 *
 * Consultats els 363 fitxers a l'API de Commons el 30-08-2026, aquesta és la
 * realitat, que no és ben bé la que diuen els resums de Wikidata:
 *
 *   · **244 porten un codi de llicència que J20 ja accepta**: 107 CC BY-SA 4.0,
 *     50 CC BY 2.0, 24 CC BY-SA 2.0, 22 CC BY-SA 3.0, 15 CC0, 10 CC BY 4.0,
 *     10 domini públic i 6 CC BY 3.0.
 *   · **2 porten una versió adaptada a un país** —`cc-by-sa-3.0-de` i
 *     `cc-by-2.5-es`—, que són Creative Commons de ple dret però que la
 *     expressió regular de J20 no reconeix perquè acaba amb la versió. Aquí
 *     s'accepten amb un patró propi, i queda dit que J20 se'l podria quedar.
 *   · **117 no porten codi de llicència llegible per màquina.** No són fitxers
 *     dubtosos: tots 117 duen `LicenseShortName` igual a «Attribution», tots 117
 *     són a la categoria de Commons «Attribution only license» i tots 117
 *     porten el camp `Attribution` amb la citació exacta que cal reproduir
 *     («Ajuntament de Gelida», «Generalitat de Catalunya»…). Són plantilles
 *     d'atribució pròpies d'un ens, revisades per Commons, i deixar-les fora
 *     seria llençar una de cada tres cares per un buit de metadades. S'accepten,
 *     però **només si es compleixen les tres condicions alhora**, i la citació
 *     literal es desa al camp `atribucio` per publicar-la tal com és.
 *
 * O sigui: els 363 són publicables, però per tres camins diferents, i cadascun
 * es desa dient pel seu. **Cap retrat no es desa sense autor i sense
 * llicència**: si Commons no en dona un dels dos, es descarta.
 *
 * Fonts: Wikidata (CC0 1.0) per a l'aparellament; Wikimedia Commons per als
 * fitxers, cadascun amb la seva llicència i el seu autor.
 */

export const KIND = "fotosAlcaldesHistorics";

const FONT = "Wikidata (wikidata.org)";
const FONT_IMATGES = "Wikimedia Commons (commons.wikimedia.org)";
const LLICENCIA_DADES = "CC0 1.0";
const ENDPOINT_SPARQL = "https://query.wikidata.org/sparql";
const API_COMMONS = "https://commons.wikimedia.org/w/api.php";

/**
 * Cinquanta fitxers per crida, com J20. És el límit de l'API de Commons per als
 * comptes anònims i, amb 363 fitxers, vol dir vuit crides en total.
 */
const FITXERS_PER_CRIDA = 50;

/** Pausa entre crides. Commons és gratuït i de tothom: no és lloc per córrer. */
const PAUSA_MS = 600;

/** Pausa entre descàrregues d'imatge, pel mateix motiu. */
const PAUSA_IMATGE_MS = 300;

/**
 * On van les miniatures: un calaix propi dins del directori de fotos.
 *
 * Podrien anar barrejades amb les de J11, però l'identificador surt d'un lloc
 * ben diferent —el QID de Wikidata— i tenir dos espais de noms al mateix
 * directori és demanar que un dia un número coincideixi amb un altre i una cara
 * en substitueixi una altra sense que ningú ho vegi. Amb el calaix a part, el
 * camí mateix diu d'on ve la imatge.
 */
const SUBDIRECTORI = "historics";

export function directoriHistorics(arrel?: string): string {
  return join(directoriFotos(arrel), SUBDIRECTORI);
}

export function camiPublicHistoric(mida: number, fotoId: number): string {
  return `/observatori/fotos/${SUBDIRECTORI}/${mida}/${fotoId}.webp`;
}

/**
 * L'identificador del fitxer és el número del QID: Q14320 desa `14320.webp`.
 *
 * A Commons no hi ha cap id numèric com el `getPhotoBytes` de seu-e, i J13 se'n
 * va haver de fabricar un amb un resum criptogràfic de l'URL. Aquí no cal: el
 * retrat és **d'una persona**, la persona ja té un identificador estable i
 * públic, i fer-lo servir vol dir que qui trobi un fitxer al disc pot anar a
 * Wikidata a veure de qui és la cara sense preguntar-ho a ningú.
 */
export function idDeQid(qid: string): number | null {
  const n = Number.parseInt(qid.replace(/^Q/i, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// La consulta
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Els alcaldes des del 1979 que **tenen** fotografia.
 *
 * És la consulta d'alcaldies de J21 amb una línia més, `wdt:P18`, que aquí no va
 * dins d'OPTIONAL: sense imatge, aquesta feina no té res a fer amb la persona i
 * portar-se-la només faria la resposta deu vegades més grossa. La data de fi sí
 * que és opcional, perquè els mandats en curs no en tenen.
 *
 * Comprovat el 30-08-2026: torna 421 files, que són 361 persones i 363 fitxers.
 */
export const CONSULTA_RETRATS = [
  "SELECT ?persona ?nom ?ine ?municipi ?inici ?fi ?imatge WHERE {",
  "  ?persona p:P39 ?mandat .",
  "  ?mandat ps:P39 ?posicio ; pq:P580 ?inici .",
  "  OPTIONAL { ?mandat pq:P582 ?fi }",
  "  ?posicio wdt:P31 wd:Q5663900 ; wdt:P1001 ?muni .",
  "  ?muni wdt:P31 wd:Q33146843 ; wdt:P772 ?ine .",
  "  ?persona wdt:P18 ?imatge .",
  `  FILTER(YEAR(?inici) >= ${ANY_INICIAL})`,
  '  ?persona rdfs:label ?nom FILTER(lang(?nom) = "ca")',
  '  ?muni rdfs:label ?municipi FILTER(lang(?municipi) = "ca")',
  "}",
].join("\n");

/**
 * La crida a Commons per a un grup de fitxers.
 *
 * Demana dues metadades més que J20 —`Categories` i `Attribution`—, i totes dues
 * per la mateixa raó: són l'única manera de distingir una plantilla d'atribució
 * revisada per Commons d'un fitxer al qual senzillament li falta la llicència.
 * Sense el filtre, cada fitxer arribaria amb una trentena de camps.
 */
export function urlCommonsRetrats(fitxers: readonly string[]): string {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiextmetadatafilter: "License|LicenseShortName|Artist|Attribution|Categories",
    titles: fitxers.join("|"),
  });
  return `${API_COMMONS}?${params.toString()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lectura de la resposta SPARQL
// ─────────────────────────────────────────────────────────────────────────────

type BindingSparql = Record<string, { value?: unknown } | undefined>;

const valor = (b: BindingSparql, clau: string): string | null => {
  const v = b[clau]?.value;
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
};

const bindings = (json: unknown): BindingSparql[] => {
  const b = (json as { results?: { bindings?: BindingSparql[] } })?.results?.bindings;
  return Array.isArray(b) ? b : [];
};

/** Un pas per una alcaldia d'una persona que té retrat. */
export type MandatAmbRetrat = {
  ine5: string;
  municipi: string;
  inici: string;
  fi: string | null;
};

export type PersonaAmbRetrat = {
  qid: string;
  nom: string;
  nomNormalitzat: string;
  /** Títol del fitxer de Commons, ja normalitzat («File:Antoni Siurana.jpg»). */
  fitxer: string;
  mandats: MandatAmbRetrat[];
};

/**
 * Agrupa les files de SPARQL per persona.
 *
 * Dues persones porten dues imatges a P18. Es queda la primera i la segona es
 * descarta en silenci, com fa J20 amb les fotografies dels municipis: triar-ne
 * una és igual de bo que triar l'altra, i el que no pot passar és que la mateixa
 * persona surti dues vegades a la fitxa.
 */
export function parseRetrats(json: unknown): PersonaAmbRetrat[] {
  const perQid = new Map<string, PersonaAmbRetrat>();
  const mandatsVistos = new Set<string>();

  for (const b of bindings(json)) {
    const qid = qidDeUri(valor(b, "persona"));
    const nom = valor(b, "nom");
    const ine5 = normalitzaIne(valor(b, "ine"));
    const inici = dataCurtaIso(valor(b, "inici"));
    const fitxer = fitxerCommons(valor(b, "imatge"));
    // Sense qualsevol d'aquestes cinc coses no hi ha ni cara ni a qui posar-la.
    if (qid === null || nom === null || ine5 === null || inici === null) continue;
    if (fitxer === null || fitxer === "") continue;

    let persona = perQid.get(qid);
    if (persona === undefined) {
      persona = { qid, nom, nomNormalitzat: normalizePersonName(nom), fitxer, mandats: [] };
      perQid.set(qid, persona);
    }
    // El mateix mandat torna repetit quan l'ítem porta dues imatges o dues
    // etiquetes: comptar-lo dues vegades inflaria el recompte de la fitxa.
    const clau = `${qid}|${ine5}|${inici}`;
    if (mandatsVistos.has(clau)) continue;
    mandatsVistos.add(clau);
    persona.mandats.push({
      ine5,
      municipi: valor(b, "municipi") ?? "",
      inici,
      fi: dataCurtaIso(valor(b, "fi")),
    });
  }

  for (const persona of perQid.values()) {
    persona.mandats.sort((a, b) => a.inici.localeCompare(b.inici) || a.ine5.localeCompare(b.ine5));
  }
  return [...perQid.values()];
}

// ─────────────────────────────────────────────────────────────────────────────
// L'aparellament amb el nostre historial
// ─────────────────────────────────────────────────────────────────────────────

export type AparellamentRetrat =
  | { ok: true; termes: string[] }
  | { ok: false; motiu: string };

/**
 * La mateixa regla que `aparella()` de J21, dita sobre el tipus que té aquesta
 * feina: mateix municipi, nom normalitzat idèntic i mandats que es toquen.
 *
 * Les tres peces que decideixen —`normalizePersonName`, `anysDelMandat` i
 * `solapen`— són literalment les de J21, importades: si un dia canvia el criteri
 * de solapament, canvia per a totes dues feines alhora. El que no es podia
 * reaprofitar és la funció sencera, perquè demana una `PersonaWikidata` amb
 * trajectòria, ocupacions i càrrecs que aquí no tenim ni necessitem.
 */
export function aparellaRetrat(
  persona: PersonaAmbRetrat,
  ine5: string,
  files: readonly FilaAlcaldia[],
): AparellamentRetrat {
  const seus = persona.mandats.filter((m) => m.ine5 === ine5);
  if (seus.length === 0) return { ok: false, motiu: "cap mandat d'aquest municipi" };
  if (persona.nomNormalitzat === "") return { ok: false, motiu: "nom buit" };

  const pelNom = files.filter((f) => normalizePersonName(f.nom) === persona.nomNormalitzat);
  if (pelNom.length === 0) {
    return { ok: false, motiu: "cap alcaldia nostra amb aquest nom en aquest municipi" };
  }

  const termes: string[] = [];
  for (const fila of pelNom) {
    const anys = anysDelMandat(fila.term);
    // Una legislatura que no sabem llegir no aparella ni descarta.
    if (anys === null) continue;
    if (seus.some((m) => solapen(m, { inici: anys.inici, fi: anys.fi }))) termes.push(fila.term);
  }
  if (termes.length === 0) return { ok: false, motiu: "el nom lliga però les dates no es toquen" };
  return { ok: true, termes: [...new Set(termes)].sort() };
}

// ─────────────────────────────────────────────────────────────────────────────
// El filtre de llicència
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Les versions de Creative Commons adaptades a la legislació d'un país
 * («cc-by-sa-3.0-de», «cc-by-2.5-es»). Són llicències CC de ple dret i amb les
 * mateixes obligacions —autor i nom de la llicència—, però el patró de J20
 * s'acaba amb el número de versió i les deixa fora. Aquí n'hi ha dues de 363.
 */
const CC_ADAPTADA = /^cc-by(-sa)?-\d(\.\d+)?-[a-z]{2}$/;

/** El mateix tall de J20: res amb «nc» ni «nd» no entra per cap porta. */
const PATRONS_PROHIBITS: RegExp[] = [/(^|-)nc(-|$)/, /(^|-)nd(-|$)/, /fair/, /noncommercial/];

/**
 * L'etiqueta i la categoria que marquen una plantilla d'atribució de Commons.
 * Les dues juntes, mai una de sola: la categoria és la que hi posa Commons quan
 * la plantilla és de veritat una llicència d'atribució, i l'etiqueta sola també
 * la porten fitxers als quals només els falta la metadada.
 */
const ETIQUETA_ATRIBUCIO = "attribution";
const CATEGORIA_ATRIBUCIO = "Attribution only license";

export type VeredicteRetrat =
  | { lliure: true; codi: string; nom: string }
  | { lliure: false; motiu: string };

/**
 * Decideix si un fitxer de Commons es pot republicar aquí.
 *
 * L'ordre és el de J20 i importa: primer el que prohibeix, després el que
 * permet, perquè «cc-by-nc-sa-4.0» conté «cc-by» i sense aquest ordre passaria.
 * A la llista tancada de J20 s'hi afegeixen dues portes, i cap més:
 *
 *   1. Les versions CC adaptades a un país.
 *   2. Les plantilles d'atribució sense codi, i **només** quan hi ha les tres
 *      coses alhora: l'etiqueta «Attribution», la categoria de Commons i la
 *      citació literal que cal reproduir. Sense la citació no se sabria a qui
 *      s'ha d'atribuir, que és justament l'única condició de la llicència.
 */
export function veredicteRetrat(dades: {
  codi: string | null;
  etiqueta: string | null;
  categories: string | null;
  atribucio: string | null;
}): VeredicteRetrat {
  const codi = dades.codi?.trim().toLowerCase() ?? "";
  if (codi !== "" && PATRONS_PROHIBITS.some((p) => p.test(codi))) {
    return { lliure: false, motiu: `llicència no lliure: ${codi}` };
  }

  const deJ20 = veredicteLlicencia(dades.codi);
  if (deJ20.lliure) {
    return { lliure: true, codi: deJ20.codi, nom: dades.etiqueta ?? deJ20.codi.toUpperCase() };
  }
  if (codi !== "" && CC_ADAPTADA.test(codi)) {
    return { lliure: true, codi, nom: dades.etiqueta ?? codi.toUpperCase() };
  }

  if (codi === "") {
    const etiqueta = dades.etiqueta?.trim().toLowerCase() ?? "";
    const categories = dades.categories ?? "";
    const atribucio = textPla(dades.atribucio);
    if (
      etiqueta === ETIQUETA_ATRIBUCIO &&
      categories.includes(CATEGORIA_ATRIBUCIO) &&
      atribucio !== null
    ) {
      return { lliure: true, codi: "attribution", nom: "Attribution" };
    }
  }
  return { lliure: false, motiu: deJ20.lliure ? "llicència no reconeguda" : deJ20.motiu };
}

/** Un retrat de Commons que hem comprovat que es pot republicar. */
export type RetratCommons = {
  fitxer: string;
  /** URL del fitxer original a Commons. */
  url: string;
  /** Pàgina de descripció: on va a parar l'atribució. */
  pagina: string;
  /** Codi de llicència («cc-by-sa-4.0», «cc0», «attribution»…). */
  llicencia: string;
  /** Etiqueta humana («CC BY-SA 4.0», «Attribution»). */
  llicenciaNom: string;
  /** Autor en text pla. Mai `null`: sense autor el fitxer es descarta. */
  autor: string;
  /** Citació literal exigida per la plantilla d'atribució, quan n'hi ha. */
  atribucio: string | null;
};

export type RetratDescartat = { fitxer: string; llicencia: string | null; motiu: string };

export type ResultatRetrat =
  | { ok: true; retrat: RetratCommons }
  | { ok: false; descartat: RetratDescartat };

type PaginaCommons = {
  title?: unknown;
  imageinfo?: {
    url?: unknown;
    descriptionurl?: unknown;
    extmetadata?: Record<string, { value?: unknown } | undefined>;
  }[];
};

const metadada = (
  extra: Record<string, { value?: unknown } | undefined> | undefined,
  clau: string,
): string | null => {
  const v = extra?.[clau]?.value;
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
};

/**
 * Llegeix una resposta de l'API de Commons, fitxer a fitxer.
 *
 * Els títols demanats es passen a part, com a J20, perquè **el que no torna la
 * resposta també és informació**: un fitxer que Commons no coneix no és un
 * fitxer sense problema, és un fitxer del qual no sabem la llicència.
 */
export function llegeixRetrats(
  json: unknown,
  demanats: readonly string[],
): Map<string, ResultatRetrat> {
  const brut = (json as { query?: { pages?: unknown } })?.query?.pages;
  const pagines: PaginaCommons[] = Array.isArray(brut) ? (brut as PaginaCommons[]) : [];

  const resultats = new Map<string, ResultatRetrat>();
  for (const pagina of pagines) {
    const titol = typeof pagina.title === "string" ? titolNormalitzat(pagina.title) : "";
    if (titol === "") continue;

    const info = Array.isArray(pagina.imageinfo) ? pagina.imageinfo[0] : undefined;
    const extra = info?.extmetadata;
    const codi = metadada(extra, "License");
    const veredicte = veredicteRetrat({
      codi,
      etiqueta: metadada(extra, "LicenseShortName"),
      categories: metadada(extra, "Categories"),
      atribucio: metadada(extra, "Attribution"),
    });
    if (!veredicte.lliure) {
      resultats.set(titol, { ok: false, descartat: { fitxer: titol, llicencia: codi, motiu: veredicte.motiu } });
      continue;
    }

    const url = typeof info?.url === "string" ? info.url : null;
    const pagDescripcio = typeof info?.descriptionurl === "string" ? info.descriptionurl : null;
    if (url === null || pagDescripcio === null) {
      resultats.set(titol, {
        ok: false,
        descartat: { fitxer: titol, llicencia: codi, motiu: "Commons no en dona l'URL" },
      });
      continue;
    }

    /*
     * L'autor és obligatori i no un extra. Totes les portes per les quals pot
     * entrar un fitxer aquí —CC BY, CC BY-SA, adaptades, atribució— demanen
     * citar algú, i una foto publicada sense dir de qui és incompleix la
     * llicència tant si és per mala fe com si és per un camp buit.
     */
    const autor = textPla(metadada(extra, "Artist"));
    if (autor === null) {
      resultats.set(titol, {
        ok: false,
        descartat: { fitxer: titol, llicencia: codi, motiu: "Commons no en declara l'autor" },
      });
      continue;
    }

    resultats.set(titol, {
      ok: true,
      retrat: {
        fitxer: titol,
        url,
        pagina: pagDescripcio,
        llicencia: veredicte.codi,
        llicenciaNom: veredicte.nom,
        autor,
        atribucio: textPla(metadada(extra, "Attribution")),
      },
    });
  }

  for (const demanat of demanats) {
    const titol = titolNormalitzat(demanat);
    if (resultats.has(titol)) continue;
    resultats.set(titol, {
      ok: false,
      descartat: { fitxer: titol, llicencia: null, motiu: "Commons no coneix aquest fitxer" },
    });
  }
  return resultats;
}

// ─────────────────────────────────────────────────────────────────────────────
// La fitxa que es desa
// ─────────────────────────────────────────────────────────────────────────────

export type RetratDesat = {
  qid: string;
  url: string;
  nom: string;
  /** Les legislatures nostres amb què ha lligat: «1991-1995». */
  termes: string[];
  /** Els mandats que Wikidata li dona en aquest municipi. */
  mandats: { inici: string; fi: string | null }[];
  /** Miniatura de 320 px. */
  foto: string;
  /** La mateixa a 160 px, per a les llistes. */
  fotoPetita: string;
  /** Fitxer de Commons, per poder anar a la font. */
  fitxer: string;
  /** Pàgina de descripció: és on ha d'apuntar l'atribució. */
  pagina: string;
  autor: string;
  llicencia: string;
  llicenciaNom: string;
  /** Citació literal que exigeix la plantilla d'atribució, si n'hi ha. */
  atribucio: string | null;
};

export type FitxaRetrats = {
  font: string;
  fontImatges: string;
  url: string;
  llicenciaDades: string;
  /** Data d'extracció: sense data, cap dada no entra a la fitxa. */
  descarregat: string;
  ine5: string;
  /** Alcaldes que tenim al nostre historial d'aquest municipi. */
  totalAlcaldesNostres: number;
  /** Quants en tenen retrat lliure. La fitxa ha de dir aquesta xifra. */
  ambRetrat: number;
  retrats: RetratDesat[];
};

export function fitxaRetrats(
  ine5: string,
  totalAlcaldesNostres: number,
  retrats: readonly RetratDesat[],
  descarregat: string,
): FitxaRetrats {
  return {
    font: FONT,
    fontImatges: FONT_IMATGES,
    url: ENDPOINT_SPARQL,
    llicenciaDades: LLICENCIA_DADES,
    descarregat,
    ine5,
    totalAlcaldesNostres,
    ambRetrat: retrats.length,
    retrats: [...retrats].sort(
      (a, b) => (a.mandats[0]?.inici ?? "").localeCompare(b.mandats[0]?.inici ?? "") ||
        a.nom.localeCompare(b.nom, "ca"),
    ),
  };
}

/** Quantes persones diferents té l'historial d'un municipi, sense repetir-ne cap. */
export function alcaldesDiferents(files: readonly FilaAlcaldia[]): number {
  return new Set(files.map((f) => normalizePersonName(f.nom)).filter((n) => n !== "")).size;
}

export function trossos<T>(items: readonly T[], mida: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += mida) out.push(items.slice(i, i + mida));
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// La feina
// ─────────────────────────────────────────────────────────────────────────────

export type OpcionsJ25 = {
  /** Arrel del repositori, per als tests. */
  arrel?: string;
};

export async function j25FotosHistoriques(db: Db, options: OpcionsJ25 = {}): Promise<void> {
  await withRun(db, "j25-fotos-historiques", async (run) => {
    const arrelFotos = directoriHistorics(options.arrel);
    await mkdir(arrelFotos, { recursive: true });
    run.say(`miniatures a ${arrelFotos}`);

    const munis = await db
      .select({ id: municipalities.id, ine5: municipalities.ine5, name: municipalities.name })
      .from(municipalities);
    const idPerIne = new Map(munis.map((m) => [m.ine5, m.id]));
    const nomPerIne = new Map(munis.map((m) => [m.ine5, m.name]));

    // 1. Els alcaldes amb fotografia. Una sola consulta: 361 persones i 363
    //    fitxers a l'última execució contra WDQS.
    const persones = parseRetrats(await fetchJson<unknown>(urlConsulta(CONSULTA_RETRATS)));
    run.rowsIn = persones.length;
    if (persones.length === 0) throw new Error("Wikidata no ha tornat cap alcalde amb fotografia");
    run.say(
      `${persones.length} alcaldes amb fotografia a Wikidata · ` +
        `${new Set(persones.flatMap((p) => p.mandats.map((m) => m.ine5))).size} municipis`,
    );

    // 2. El nostre historial, per municipi. És l'única cosa que decideix si una
    //    cara es pot dibuixar al costat d'un nom.
    const historial = await db
      .select({ municipalityId: mayors.municipalityId, term: mayors.term, name: mayors.name })
      .from(mayors);
    const historialPerMunicipi = new Map<number, FilaAlcaldia[]>();
    for (const fila of historial) {
      const grup = historialPerMunicipi.get(fila.municipalityId);
      const seva = { term: fila.term, nom: fila.name };
      if (grup === undefined) historialPerMunicipi.set(fila.municipalityId, [seva]);
      else grup.push(seva);
    }
    run.say(`${historial.length} files d'historial d'alcaldies per contrastar`);

    // 3. L'aparellament, abans de demanar res a Commons. Una cara que no lliga
    //    amb cap nom nostre no s'ha de baixar: no la podríem dibuixar enlloc.
    type Encert = { persona: PersonaAmbRetrat; ine5: string; termes: string[] };
    const encerts: Encert[] = [];
    const comptador = {
      aparellats: 0,
      senseAparellar: 0,
      ineDesconegut: 0,
      lliures: 0,
      descartats: 0,
      desades: 0,
      jaHiEren: 0,
      petites: 0,
      illegibles: 0,
      senseImatge: 0,
      crides: 1,
    };

    for (const persona of persones) {
      for (const ine5 of new Set(persona.mandats.map((m) => m.ine5))) {
        const municipalityId = idPerIne.get(ine5);
        if (municipalityId === undefined) {
          comptador.ineDesconegut += 1;
          continue;
        }
        const aparellament = aparellaRetrat(
          persona,
          ine5,
          historialPerMunicipi.get(municipalityId) ?? [],
        );
        if (!aparellament.ok) {
          comptador.senseAparellar += 1;
          /*
           * No és cap error nostre ni de Wikidata: sovint és una grafia del nom
           * diferent, o un mandat que el nostre historial no cobreix. Queda
           * escrit amb el QID perquè algú ho pugui mirar un a un.
           */
          await run.issue({
            kind: "retrat_alcalde_no_aparellat",
            severity: "baixa",
            municipalityId,
            entity: persona.qid,
            detail: {
              nom: persona.nom,
              municipi: nomPerIne.get(ine5) ?? ine5,
              motiu: aparellament.motiu,
              mandats: persona.mandats.filter((m) => m.ine5 === ine5),
            },
          });
          continue;
        }
        comptador.aparellats += 1;
        encerts.push({ persona, ine5, termes: aparellament.termes });
      }
    }
    run.say(
      `${comptador.aparellats} passos per una alcaldia aparellats · ` +
        `${comptador.senseAparellar} sense aparellar · ${comptador.ineDesconegut} amb INE desconegut`,
    );

    // 4. La llicència, fitxer a fitxer i abans de baixar cap byte.
    const fitxers = [...new Set(encerts.map((e) => e.persona.fitxer))];
    run.say(`${fitxers.length} fitxers de Commons per comprovar`);
    const llicencies = new Map<string, ResultatRetrat>();
    for (const grup of trossos(fitxers, FITXERS_PER_CRIDA)) {
      try {
        const json = await fetchJson<unknown>(urlCommonsRetrats(grup), { delayMs: PAUSA_MS });
        comptador.crides += 1;
        for (const [titol, resultat] of llegeixRetrats(json, grup)) llicencies.set(titol, resultat);
      } catch (error) {
        /*
         * Un grup que peta deixa els seus 50 fitxers sense llicència i, per
         * tant, sense publicar, que és el comportament segur. La propera
         * execució els tornarà a demanar.
         */
        await run.issue({
          kind: "commons_retrat_error",
          severity: "mitjana",
          detail: { fitxers: grup.length, primer: grup[0] ?? null, error: String(error) },
        });
      }
    }

    // 5. Les miniatures, una vegada per persona encara que surti a dos municipis.
    const miniatures = new Map<string, { fotoId: number; retrat: RetratCommons }>();
    for (const fitxer of fitxers) {
      const resultat = llicencies.get(titolNormalitzat(fitxer));
      if (resultat === undefined || !resultat.ok) {
        comptador.descartats += 1;
        const descartat = resultat?.descartat ?? {
          fitxer,
          llicencia: null,
          motiu: "llicència no consultada",
        };
        await run.issue({ kind: "commons_retrat_descartat", severity: "baixa", detail: descartat });
        continue;
      }
      comptador.lliures += 1;

      const qid = encerts.find((e) => e.persona.fitxer === fitxer)!.persona.qid;
      const fotoId = idDeQid(qid);
      if (fotoId === null) continue;

      if (await miniaturesFetes(fotoId, arrelFotos)) {
        comptador.jaHiEren += 1;
        miniatures.set(fitxer, { fotoId, retrat: resultat.retrat });
        continue;
      }

      const bytes = await fetchImatge(resultat.retrat.url);
      await sleep(PAUSA_IMATGE_MS);
      if (!bytes) {
        comptador.senseImatge += 1;
        continue;
      }
      let estat: Awaited<ReturnType<typeof miniaturesDeBytes>>;
      try {
        estat = await miniaturesDeBytes(bytes, fotoId, arrelFotos, MINIM_PX);
      } catch {
        // Un JPEG corrupte no pot endur-se la resta de la feina.
        estat = "error";
      }
      if (estat === "desada" || estat === "ja-hi-era") {
        comptador.desades += 1;
        miniatures.set(fitxer, { fotoId, retrat: resultat.retrat });
      } else if (estat === "petita") comptador.petites += 1;
      else comptador.illegibles += 1;
    }
    run.say(
      `llicència lliure: ${comptador.lliures} · descartats: ${comptador.descartats} · ` +
        `miniatures noves: ${comptador.desades} · ja hi eren: ${comptador.jaHiEren} · ` +
        `massa petites: ${comptador.petites} · il·legibles: ${comptador.illegibles}`,
    );

    // 6. Una fitxa per municipi.
    const perIne = new Map<string, RetratDesat[]>();
    for (const encert of encerts) {
      const feta = miniatures.get(encert.persona.fitxer);
      if (feta === undefined) continue;
      const grup = perIne.get(encert.ine5) ?? [];
      grup.push({
        qid: encert.persona.qid,
        url: `https://www.wikidata.org/wiki/${encert.persona.qid}`,
        nom: encert.persona.nom,
        termes: encert.termes,
        mandats: encert.persona.mandats
          .filter((m) => m.ine5 === encert.ine5)
          .map((m) => ({ inici: m.inici, fi: m.fi })),
        foto: camiPublicHistoric(320, feta.fotoId),
        fotoPetita: camiPublicHistoric(160, feta.fotoId),
        fitxer: feta.retrat.fitxer,
        pagina: feta.retrat.pagina,
        autor: feta.retrat.autor,
        llicencia: feta.retrat.llicencia,
        llicenciaNom: feta.retrat.llicenciaNom,
        atribucio: feta.retrat.atribucio,
      });
      perIne.set(encert.ine5, grup);
    }

    const descarregat = new Date().toISOString().slice(0, 10);
    let alcaldesCoberts = 0;
    for (const [ine5, retrats] of perIne) {
      const municipalityId = idPerIne.get(ine5);
      if (municipalityId === undefined) continue;
      const totalAlcaldesNostres = alcaldesDiferents(historialPerMunicipi.get(municipalityId) ?? []);
      const fitxa = fitxaRetrats(ine5, totalAlcaldesNostres, retrats, descarregat);
      alcaldesCoberts += fitxa.ambRetrat;
      await db
        .insert(municipalityMetrics)
        .values({ municipalityId, kind: KIND, data: fitxa })
        .onConflictDoUpdate({
          target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
          set: { data: fitxa, computedAt: new Date() },
        });
      run.rowsOut += 1;
    }

    /*
     * La xifra honesta, i la que la fitxa ha de repetir. Els alcaldes del nostre
     * historial es compten per persona i municipi: qui ha fet quatre mandats
     * seguits és una cara, no quatre.
     */
    const alcaldesNostres = [...historialPerMunicipi.values()].reduce(
      (total, files) => total + alcaldesDiferents(files),
      0,
    );
    const percentatge = alcaldesNostres === 0 ? 0 : (100 * alcaldesCoberts) / alcaldesNostres;
    run.say(
      `${alcaldesCoberts} alcaldes amb cara de ${alcaldesNostres} del nostre historial ` +
        `(${percentatge.toFixed(1)} %), en ${run.rowsOut} municipis`,
    );

    return {
      font: FONT,
      fontImatges: FONT_IMATGES,
      llicenciaDades: LLICENCIA_DADES,
      descarregat,
      personesWikidata: persones.length,
      fitxersComprovats: fitxers.length,
      municipisAmbFitxa: run.rowsOut,
      alcaldesCoberts,
      alcaldesNostres,
      cobertura: Number(percentatge.toFixed(1)),
      ...comptador,
    };
  });
}
