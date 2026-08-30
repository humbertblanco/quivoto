import { eq } from "drizzle-orm";
import { mayors, municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { fetchJson } from "../lib/http";
import { normalizePersonName } from "../lib/text";
import { withRun } from "../lib/run";

/**
 * J21 — d'on surten els que manen: l'alcaldia com a primer esglaó.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUINA ÉS LA DADA, I PER QUÈ AQUESTA I NO CAP ALTRA DE WIKIDATA
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * J20 ja va decidir què s'agafa de Wikidata per al municipi —la foto, l'escut,
 * l'OSM i l'enllaç— i què no: ni la població ni el nom de l'alcalde, perquè
 * d'això en tenim font oficial. Aquesta feina no hi torna: agafa **l'única cosa
 * que Wikidata sap i que no tenim de cap font agregada**, i que a més toca
 * justament les persones amb més poder.
 *
 * Consultat contra WDQS el 30-08-2026:
 *
 *   · **2.921 persones** tenen un mandat d'alcaldia catalana començat des del
 *     1979 (posicions P31 = Q5663900, «alcalde de X», amb P1001 a un municipi
 *     Q33146843 i qualificador P580 des del 1979). Són **3.324 mandats** i
 *     cobreixen els **947 municipis**.
 *   · **284 d'aquestes persones han ocupat després —o abans— un càrrec per
 *     sobre del seu ajuntament**: 213 al Parlament de Catalunya, 46 al Congrés,
 *     46 al Senat, 36 al Govern (Generalitat o Estat), 29 presidències de
 *     diputació i 3 al Parlament Europeu. Surten de **195 municipis diferents**
 *     dels 947.
 *   · **603 tenen una ocupació anterior a la política** (P106, tret de Q82955
 *     «polític», que és soroll): 68 empresaris, 57 professors, 50 advocats.
 *
 * Això és el que aquesta feina desa, i res més. P102 (partit amb dates) queda
 * fora: només 276 persones el porten amb dates i sense referències, i el canvi
 * de partit el detectem molt millor amb les **nostres** sigles per mandat.
 * P1971 (fills) i P26 (cònjuge) també queden fora: és vida privada i no té cap
 * relleu per al control democràtic d'un ajuntament.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL RISC NO ÉS L'HOMONÍMIA: SÓN ELS DUPLICATS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * La por raonable d'aparellar persones per nom és trobar dos «Josep Pujol»
 * diferents i atribuir a l'un la carrera de l'altre. Dins d'aquestes 2.921
 * persones això **no passa**: hi ha 4 parells de noms repetits i els 4 són
 * ítems **duplicats de la mateixa persona**, amb el mateix municipi i els
 * mateixos mandats:
 *
 *   · Josep Pujadas i Maspons a Granollers, Q76350582 i Q140645246, amb els
 *     tres mandats idèntics a totes dues fitxes.
 *   · Jaume Montalbo Roige al Lloar, Carles Català Visa a la Portella i
 *     Montserrat Cañas Moldón a Cervelló, tres més del mateix.
 *
 * Fusionats, queden **2.917 persones i 3.318 mandats**.
 *
 * Per tant la regla d'aparellament no els ha de **descartar** —seria perdre
 * quatre alcaldes de debò— sinó **fusionar-los**: mateix nom normalitzat +
 * mateix municipi + mandats solapats = la mateixa persona. Descartar-los seria
 * protegir-se d'un perill que no existeix pagant-ho amb dades que sí.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * L'APARELLAMENT AMB EL NOSTRE HISTORIAL, I QUAN NO ES FA
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * La posició de Wikidata ja és específica del municipi («alcalde de Reus») i un
 * municipi només té un alcalde alhora, o sigui que aparellar és quasi
 * determinista. Es demanen tres coses alhora i no dues:
 *
 *   1. **Codi INE del municipi** (P1001 → P772), no el nom.
 *   2. **Solapament de mandat** amb una fila del nostre historial d'alcaldies.
 *   3. **Nom normalitzat igual**, amb la mateixa funció que fa servir la resta
 *      del projecte per creuar persones entre fonts.
 *
 * Si les tres no es donen, **la persona no s'aparella**: es desa igualment amb
 * el seu QID i la seva font —és una dada de Wikidata, i com a tal es publica—
 * però amb `aparellat: false`, i queda una incidència perquè algú s'ho miri. El
 * que no es fa mai és penjar la carrera política d'algú a la fitxa d'una altra
 * persona amb un nom semblant: en una pàgina que porta el nom al títol, aquest
 * és el pitjor error possible.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TRES CONSULTES I NO UNA
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * La consulta que ho demana tot de cop —alcaldies, càrrecs i perfil— respon
 * **504 de WDQS**: provada quatre vegades seguides, cap va tornar. El que sí
 * que funciona és partir-la: una consulta per a les alcaldies (3.324 files,
 * respon a la primera) i després dues més que passen els QID ja sabuts en lots
 * de 300 amb VALUES, que són 10 crides cadascuna i cap no passa dels segons.
 * Són 21 peticions per a tota la feina, amb pausa entremig.
 *
 * Font: https://query.wikidata.org/sparql. Les dades de Wikidata són **CC0
 * 1.0**, i la fitxa en desa la llicència i la data d'extracció perquè sense any
 * cap dada no entra a la fitxa.
 */

export const KIND = "trajectoriaElectes";

const FONT = "Wikidata (wikidata.org)";
const ENDPOINT_SPARQL = "https://query.wikidata.org/sparql";
const LLICENCIA = "CC0 1.0";

/**
 * Wikidata deixa sense servei els clients anònims i exigeix un User-Agent que
 * identifiqui qui pregunta. El de `lib/http` ja porta el nom del projecte i una
 * adreça de contacte, i és el mateix que fa servir J20: per això aquí no se
 * n'escriu cap altre.
 */

/**
 * Quants QID caben a un VALUES. Amb 300 la consulta dels càrrecs triga uns
 * segons; amb els 2.921 de cop, WDQS respon 504.
 */
const QIDS_PER_CRIDA = 300;

/**
 * Pausa entre crides. No és por del bloqueig: són 21 peticions per a tota la
 * feina i no hi ha cap pressa que justifiqui martellejar un servei que ens dona
 * les dades de franc.
 */
const PAUSA_MS = 600;

/** El primer any de la sèrie: les eleccions municipals que van tornar el 1979. */
export const ANY_INICIAL = 1979;

/**
 * L'ocupació «polític» (Q82955) no és una ocupació anterior a la política: és
 * la política mateixa. Dels 2.921, la porten centenars i no diu res de ningú.
 */
export const OCUPACIO_POLITIC = "Q82955";

// ─────────────────────────────────────────────────────────────────────────────
// Les famílies de càrrec
// ─────────────────────────────────────────────────────────────────────────────

export type Familia = "parlament" | "congres" | "senat" | "diputacio" | "govern" | "europeu";

/**
 * Les sis menes de càrrec que compten com a salt per sobre de l'ajuntament.
 *
 * Es classifica **per l'etiqueta catalana del càrrec**, i és una decisió
 * comprovada: dels 506 càrrecs diferents que surten d'aquestes 2.921 persones,
 * **els 506 tenen etiqueta en català** a Wikidata. Classificar pel QID voldria
 * dir una llista tancada de centenars d'ítems que envelliria sola; classificar
 * per l'etiqueta que retorna el servei d'etiquetes en un idioma qualsevol
 * voldria dir que el mateix càrrec canvia de família segons què hi hagi aquell
 * dia. Per això la consulta demana `rdfs:label` amb `lang = "ca"` i prou.
 *
 * La llista és **tancada a posta**: un càrrec que no hi encaixi es compta com a
 * «altres» i no s'infla cap xifra. Val més dir 284 i saber què són que dir 400
 * i no saber-ho.
 */
export const FAMILIES: ReadonlyArray<{
  clau: Familia;
  etiqueta: string;
  /** Com se'n parla a la pàgina: «al Parlament», «al Senat», «a una diputació». */
  frase: string;
  patro: RegExp;
}> = [
  {
    clau: "parlament",
    etiqueta: "Parlament de Catalunya",
    frase: "al Parlament de Catalunya",
    patro: /\bparlament de catalunya\b/,
  },
  {
    clau: "congres",
    etiqueta: "Congrés dels Diputats",
    frase: "al Congrés dels Diputats",
    patro: /\bcongrés dels diputats\b/,
  },
  {
    clau: "senat",
    etiqueta: "Senat",
    frase: "al Senat",
    patro: /\bsenat espanyol\b|^senador|^senadora/,
  },
  {
    clau: "diputacio",
    etiqueta: "Presidència de diputació",
    frase: "a la presidència d'una diputació",
    patro: /^president(a)? de la diputació/,
  },
  {
    clau: "govern",
    etiqueta: "Govern",
    frase: "al Govern",
    /*
     * «conseller d'Interior» no porta espai darrere de la d, i «conseller de la
     * Presidència» sí: si el patró en demana un de sol, la meitat de les
     * conselleries no hi entren. Les comarcals i les del Consell General d'Aran
     * ja han caigut abans, a NO_ES_SALT.
     */
    patro: /^president(a)? de la generalitat|^conseller(a)? (de\s|d['’])|^ministr[ea]\b/,
  },
  {
    clau: "europeu",
    etiqueta: "Parlament Europeu",
    frase: "al Parlament Europeu",
    patro: /\bparlament europeu\b/,
  },
];

/**
 * El que **no** és cap salt, per molt que el nom s'hi assembli.
 *
 * «Conseller comarcal del Baix Empordà» i «conseller del Consell General
 * d'Aran» comencen igual que «conseller d'Interior» i no són el mateix ofici ni
 * de bon tros: el consell comarcal és el següent graó del mateix món local i
 * n'hi ha 42 persones només al Baix Empordà. Sense aquesta exclusió, la xifra
 * de «consellers» es multiplicaria per deu amb gent que no ha estat mai al
 * Govern. Es mira **abans** que els patrons de família, que és el que fa que
 * l'ordre importi.
 */
const NO_ES_SALT = /conseller(a)? comarcal|conseller(a)? del consell/;

/**
 * L'ordre en què es proven els patrons, que **no** és el de la llista de dalt.
 *
 * Wikidata té «Senador designat pel Parlament de Catalunya»: és una senaduria
 * autonòmica, i qui la té l'ha rebuda del Parlament però no hi seu. Amb l'ordre
 * de lectura —Parlament primer— aquella persona sortia comptada com a diputada
 * al Parlament, que és fals. Aquí el Senat es mira abans, i el que queda per al
 * Parlament és el que hi seu de debò.
 *
 * `FAMILIES` conserva l'ordre en què es llegeixen a la pàgina, que és un altre
 * problema i no s'ha de barrejar amb aquest.
 */
const ORDRE_CLASSIFICACIO: readonly Familia[] = [
  "senat", "parlament", "congres", "europeu", "diputacio", "govern",
];

/** La família d'un càrrec a partir de la seva etiqueta catalana, o `null`. */
export function familiaDe(etiqueta: string): Familia | null {
  const net = etiqueta.trim().toLowerCase();
  if (net === "" || NO_ES_SALT.test(net)) return null;
  for (const clau of ORDRE_CLASSIFICACIO) {
    const familia = FAMILIES.find((f) => f.clau === clau)!;
    if (familia.patro.test(net)) return clau;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Les consultes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Els mandats d'alcaldia catalana des del 1979.
 *
 * `P1001` (àmbit d'aplicació) del càrrec és el que lliga la posició amb el
 * municipi, i d'allà en surt el codi INE (P772). El qualificador `P580` és
 * obligatori i no va dins d'OPTIONAL: un mandat sense data d'inici no es pot
 * solapar amb res i, per tant, no es pot aparellar. `P582` sí que és opcional,
 * perquè els 1.040 mandats en curs no en tenen.
 */
export const CONSULTA_ALCALDIES = [
  "SELECT ?persona ?nom ?ine ?municipi ?inici ?fi WHERE {",
  "  ?persona p:P39 ?mandat .",
  "  ?mandat ps:P39 ?posicio ; pq:P580 ?inici .",
  "  OPTIONAL { ?mandat pq:P582 ?fi }",
  "  ?posicio wdt:P31 wd:Q5663900 ; wdt:P1001 ?muni .",
  "  ?muni wdt:P31 wd:Q33146843 ; wdt:P772 ?ine .",
  `  FILTER(YEAR(?inici) >= ${ANY_INICIAL})`,
  '  ?persona rdfs:label ?nom FILTER(lang(?nom) = "ca")',
  '  ?muni rdfs:label ?municipi FILTER(lang(?municipi) = "ca")',
  "}",
].join("\n");

/**
 * Tots els altres càrrecs de les persones que ja sabem que han estat alcaldes.
 *
 * `FILTER NOT EXISTS` treu les alcaldies, que ja les tenim de la primera
 * consulta i que aquí només farien soroll. L'etiqueta es demana amb
 * `rdfs:label` en català i no amb el servei d'etiquetes: és el que fa que la
 * classificació per família no depengui de quin idioma tingui aquell ítem.
 */
export function consultaCarrecs(qids: readonly string[]): string {
  return [
    "SELECT ?persona ?carrec ?etiqueta ?inici ?fi WHERE {",
    `  VALUES ?persona { ${qids.map((q) => `wd:${q}`).join(" ")} }`,
    "  ?persona p:P39 ?st .",
    "  ?st ps:P39 ?carrec .",
    "  OPTIONAL { ?st pq:P580 ?inici }",
    "  OPTIONAL { ?st pq:P582 ?fi }",
    "  FILTER NOT EXISTS { ?carrec wdt:P31 wd:Q5663900 }",
    '  ?carrec rdfs:label ?etiqueta FILTER(lang(?etiqueta) = "ca")',
    "}",
  ].join("\n");
}

/**
 * El perfil: què feien abans, quan van néixer i si tenen article a la
 * Viquipedia catalana. L'ocupació i l'article van dins d'OPTIONAL perquè la
 * majoria no en tenen: 603 de 2.921 amb ocupació i 613 amb article.
 */
export function consultaPerfil(qids: readonly string[]): string {
  return [
    "PREFIX schema: <http://schema.org/>",
    "SELECT ?persona ?ocupacio ?ocupacioNom ?naixement ?article WHERE {",
    `  VALUES ?persona { ${qids.map((q) => `wd:${q}`).join(" ")} }`,
    "  OPTIONAL { ?persona wdt:P569 ?naixement }",
    "  OPTIONAL { ?article schema:about ?persona ; schema:isPartOf <https://ca.wikipedia.org/> }",
    "  OPTIONAL {",
    "    ?persona wdt:P106 ?ocupacio .",
    '    ?ocupacio rdfs:label ?ocupacioNom FILTER(lang(?ocupacioNom) = "ca")',
    "  }",
    "}",
  ].join("\n");
}

export function urlConsulta(consulta: string): string {
  return `${ENDPOINT_SPARQL}?format=json&query=${encodeURIComponent(consulta)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lectura de les respostes
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

/** El QID d'un URI d'entitat: `http://www.wikidata.org/entity/Q14320` → `Q14320`. */
export const qidDeUri = (uri: string | null): string | null =>
  uri === null ? null : (uri.match(/\/(Q\d+)$/)?.[1] ?? null);

/**
 * El codi INE a 5 xifres. P772 el publica com a text i els municipis de menys
 * de 10.000 comencen per zero: qualsevol pas per un número se'l menjaria i
 * Abrera (08001) passaria a ser el 8001, que no és de ningú.
 */
export function normalitzaIne(brut: string | null): string | null {
  if (brut === null) return null;
  const xifres = brut.replace(/\D/g, "");
  if (xifres.length === 0 || xifres.length > 5) return null;
  return xifres.padStart(5, "0");
}

/** Una data ISO retallada a `AAAA-MM-DD`; les de Wikidata vénen amb hora. */
export const dataCurtaIso = (brut: string | null): string | null =>
  brut === null ? null : (brut.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null);

export type MandatWikidata = {
  qid: string;
  nom: string;
  ine5: string;
  municipi: string;
  inici: string;
  fi: string | null;
};

export function parseAlcaldies(json: unknown): MandatWikidata[] {
  const files: MandatWikidata[] = [];
  const vistos = new Set<string>();
  for (const b of bindings(json)) {
    const qid = qidDeUri(valor(b, "persona"));
    const ine5 = normalitzaIne(valor(b, "ine"));
    const inici = dataCurtaIso(valor(b, "inici"));
    const nom = valor(b, "nom");
    // Sense QID, sense INE, sense nom o sense data d'inici no hi ha res a
    // aparellar: la fila no serveix i no s'inventa cap valor per defecte.
    if (qid === null || ine5 === null || inici === null || nom === null) continue;
    // El mateix mandat pot tornar duplicat quan l'ítem porta dues etiquetes
    // catalanes o dos valors a P1001. Comptar-lo dos cops inflaria els 3.324.
    const clau = `${qid}|${ine5}|${inici}`;
    if (vistos.has(clau)) continue;
    vistos.add(clau);
    files.push({
      qid,
      nom,
      ine5,
      municipi: valor(b, "municipi") ?? "",
      inici,
      fi: dataCurtaIso(valor(b, "fi")),
    });
  }
  return files;
}

export type CarrecWikidata = {
  qid: string;
  carrecQid: string;
  carrec: string;
  familia: Familia | null;
  inici: string | null;
  fi: string | null;
};

export function parseCarrecs(json: unknown): CarrecWikidata[] {
  const files: CarrecWikidata[] = [];
  const vistos = new Set<string>();
  for (const b of bindings(json)) {
    const qid = qidDeUri(valor(b, "persona"));
    const carrecQid = qidDeUri(valor(b, "carrec"));
    const carrec = valor(b, "etiqueta");
    if (qid === null || carrecQid === null || carrec === null) continue;
    const inici = dataCurtaIso(valor(b, "inici"));
    const clau = `${qid}|${carrecQid}|${inici ?? ""}`;
    if (vistos.has(clau)) continue;
    vistos.add(clau);
    files.push({
      qid,
      carrecQid,
      carrec,
      familia: familiaDe(carrec),
      inici,
      fi: dataCurtaIso(valor(b, "fi")),
    });
  }
  return files;
}

export type PerfilWikidata = {
  qid: string;
  naixement: string | null;
  viquipedia: string | null;
  ocupacions: string[];
};

export function parsePerfil(json: unknown): PerfilWikidata[] {
  const perQid = new Map<string, PerfilWikidata & { vistes: Set<string> }>();
  for (const b of bindings(json)) {
    const qid = qidDeUri(valor(b, "persona"));
    if (qid === null) continue;
    let perfil = perQid.get(qid);
    if (perfil === undefined) {
      perfil = { qid, naixement: null, viquipedia: null, ocupacions: [], vistes: new Set() };
      perQid.set(qid, perfil);
    }
    perfil.naixement ??= dataCurtaIso(valor(b, "naixement"));
    perfil.viquipedia ??= valor(b, "article");
    const ocupacioQid = qidDeUri(valor(b, "ocupacio"));
    const ocupacio = valor(b, "ocupacioNom");
    // «Polític» no és una ocupació anterior a la política: és la política.
    if (ocupacioQid !== null && ocupacioQid !== OCUPACIO_POLITIC && ocupacio !== null) {
      if (!perfil.vistes.has(ocupacioQid)) {
        perfil.vistes.add(ocupacioQid);
        perfil.ocupacions.push(ocupacio);
      }
    }
  }
  return [...perQid.values()].map(({ vistes: _vistes, ...perfil }) => perfil);
}

// ─────────────────────────────────────────────────────────────────────────────
// De files a persones
// ─────────────────────────────────────────────────────────────────────────────

/** Un pas per una alcaldia, ja lligat a la persona. */
export type MandatAlcaldia = { ine5: string; municipi: string; inici: string; fi: string | null };

export type PersonaWikidata = {
  qid: string;
  /** Els QID d'ítems duplicats que s'han fusionat en aquest. */
  qidsFusionats: string[];
  nom: string;
  nomNormalitzat: string;
  naixement: string | null;
  viquipedia: string | null;
  ocupacions: string[];
  mandats: MandatAlcaldia[];
  /** Els càrrecs per sobre de l'ajuntament, ja classificats. */
  carrecs: CarrecWikidata[];
  /** Quants altres càrrecs té que no encaixen a cap família. També és informació. */
  altresCarrecs: number;
};

const ordenaMandats = (mandats: MandatAlcaldia[]): MandatAlcaldia[] =>
  [...mandats].sort((a, b) => a.inici.localeCompare(b.inici) || a.ine5.localeCompare(b.ine5));

/** Agrupa les tres consultes en una persona per QID. */
export function agrupaPersones(
  alcaldies: readonly MandatWikidata[],
  carrecs: readonly CarrecWikidata[],
  perfils: readonly PerfilWikidata[],
): PersonaWikidata[] {
  const perQid = new Map<string, PersonaWikidata>();
  for (const m of alcaldies) {
    let persona = perQid.get(m.qid);
    if (persona === undefined) {
      persona = {
        qid: m.qid,
        qidsFusionats: [],
        nom: m.nom,
        nomNormalitzat: normalizePersonName(m.nom),
        naixement: null,
        viquipedia: null,
        ocupacions: [],
        mandats: [],
        carrecs: [],
        altresCarrecs: 0,
      };
      perQid.set(m.qid, persona);
    }
    persona.mandats.push({ ine5: m.ine5, municipi: m.municipi, inici: m.inici, fi: m.fi });
  }

  for (const c of carrecs) {
    const persona = perQid.get(c.qid);
    if (persona === undefined) continue;
    if (c.familia === null) persona.altresCarrecs += 1;
    else persona.carrecs.push(c);
  }

  for (const p of perfils) {
    const persona = perQid.get(p.qid);
    if (persona === undefined) continue;
    persona.naixement = p.naixement;
    persona.viquipedia = p.viquipedia;
    persona.ocupacions = p.ocupacions;
  }

  for (const persona of perQid.values()) {
    persona.mandats = ordenaMandats(persona.mandats);
    persona.carrecs.sort((a, b) => (a.inici ?? "9999").localeCompare(b.inici ?? "9999"));
  }
  return [...perQid.values()];
}

// ─────────────────────────────────────────────────────────────────────────────
// La fusió de duplicats
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dos intervals de dates es toquen. Un mandat sense data de fi es considera
 * obert fins avui: dels 3.324 mandats, 1.040 no en tenen perquè encara duren.
 */
export function solapen(
  a: { inici: string; fi: string | null },
  b: { inici: string; fi: string | null },
  avui = "9999-12-31",
): boolean {
  return a.inici <= (b.fi ?? avui) && b.inici <= (a.fi ?? avui);
}

/** Dues fitxes són la mateixa persona: mateix municipi i mandats que es toquen. */
export function mateixaPersona(a: PersonaWikidata, b: PersonaWikidata): boolean {
  if (a.nomNormalitzat === "" || a.nomNormalitzat !== b.nomNormalitzat) return false;
  return a.mandats.some((ma) => b.mandats.some((mb) => ma.ine5 === mb.ine5 && solapen(ma, mb)));
}

export type Fusio = { conservat: string; absorbits: string[]; nom: string; ine5: string };

/**
 * Fusiona els ítems duplicats. Es conserva **el que porta més informació** —el
 * que té article a la Viquipedia, data de naixement, ocupacions i càrrecs— i no
 * el de QID més baix: dels dos Josep Pujadas de Granollers, un és una fitxa
 * gairebé buida creada després i triar-la per número perdria la bona.
 */
export function fusionaDuplicats(persones: readonly PersonaWikidata[]): {
  persones: PersonaWikidata[];
  fusions: Fusio[];
} {
  const perNom = new Map<string, PersonaWikidata[]>();
  for (const p of persones) {
    const grup = perNom.get(p.nomNormalitzat);
    if (grup === undefined) perNom.set(p.nomNormalitzat, [p]);
    else grup.push(p);
  }

  const riquesa = (p: PersonaWikidata): number =>
    (p.viquipedia === null ? 0 : 4) +
    (p.naixement === null ? 0 : 2) +
    p.ocupacions.length +
    p.carrecs.length * 2 +
    p.mandats.length;

  const resultat: PersonaWikidata[] = [];
  const fusions: Fusio[] = [];

  for (const grup of perNom.values()) {
    if (grup.length === 1) {
      resultat.push(grup[0]!);
      continue;
    }
    // Grups petitíssims (mai més de 2 fitxes en tot el conjunt), així que la
    // comparació de tots contra tots no és cap problema de rendiment.
    const pendents = [...grup];
    while (pendents.length > 0) {
      const cap = pendents.shift()!;
      const bloc = [cap];
      for (let i = pendents.length - 1; i >= 0; i -= 1) {
        if (bloc.some((b) => mateixaPersona(b, pendents[i]!))) bloc.push(...pendents.splice(i, 1));
      }
      if (bloc.length === 1) {
        resultat.push(cap);
        continue;
      }
      bloc.sort((a, b) => riquesa(b) - riquesa(a) || a.qid.localeCompare(b.qid));
      const conservat = bloc[0]!;
      const absorbits = bloc.slice(1);
      resultat.push(fon(conservat, absorbits));
      fusions.push({
        conservat: conservat.qid,
        absorbits: absorbits.map((p) => p.qid),
        nom: conservat.nom,
        ine5: conservat.mandats[0]?.ine5 ?? "",
      });
    }
  }
  return { persones: resultat, fusions };
}

/** Ajunta el que sap cada duplicat sense repetir res. */
function fon(base: PersonaWikidata, altres: readonly PersonaWikidata[]): PersonaWikidata {
  const mandats = new Map(base.mandats.map((m) => [`${m.ine5}|${m.inici}`, m]));
  const carrecs = new Map(base.carrecs.map((c) => [`${c.carrecQid}|${c.inici ?? ""}`, c]));
  const ocupacions = new Set(base.ocupacions);
  let naixement = base.naixement;
  let viquipedia = base.viquipedia;
  let altresCarrecs = base.altresCarrecs;

  for (const altre of altres) {
    for (const m of altre.mandats) mandats.set(`${m.ine5}|${m.inici}`, m);
    for (const c of altre.carrecs) carrecs.set(`${c.carrecQid}|${c.inici ?? ""}`, c);
    for (const o of altre.ocupacions) ocupacions.add(o);
    naixement ??= altre.naixement;
    viquipedia ??= altre.viquipedia;
    altresCarrecs = Math.max(altresCarrecs, altre.altresCarrecs);
  }

  return {
    ...base,
    qidsFusionats: altres.map((p) => p.qid),
    naixement,
    viquipedia,
    ocupacions: [...ocupacions],
    mandats: ordenaMandats([...mandats.values()]),
    carrecs: [...carrecs.values()].sort((a, b) => (a.inici ?? "9999").localeCompare(b.inici ?? "9999")),
    altresCarrecs,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// L'aparellament amb el nostre historial d'alcaldies
// ─────────────────────────────────────────────────────────────────────────────

/** Una fila del nostre historial d'alcaldies, la taula `mayors`. */
export type FilaAlcaldia = { term: string; nom: string };

/**
 * De «2023-2027» a les dates que ocupa. El mandat s'obre l'1 de gener del
 * primer any i es tanca el 31 de desembre de l'últim: no és exacte al dia —les
 * corporacions es constitueixen al juny— però per decidir si dos mandats es
 * toquen no cal el dia, i el que sí que cal és no descartar per un mes de
 * diferència algú que hi era.
 */
export function anysDelMandat(term: string): { inici: string; fi: string } | null {
  const m = term.match(/^(\d{4})\s*[-–/]\s*(\d{4})$/);
  if (!m) return null;
  return { inici: `${m[1]}-01-01`, fi: `${m[2]}-12-31` };
}

export type Aparellament =
  | { ok: true; termes: string[] }
  | { ok: false; motiu: string };

/**
 * Aparella una persona de Wikidata amb el nostre historial d'alcaldies d'aquell
 * municipi. Calen les tres coses alhora: mateix municipi (ja garantit, perquè
 * les files que arriben són les d'aquell INE), nom normalitzat igual i mandats
 * que es toquin. Si no lliga res, no s'aparella i el motiu s'escriu tal com és.
 */
export function aparella(
  persona: PersonaWikidata,
  ine5: string,
  files: readonly FilaAlcaldia[],
): Aparellament {
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
    // Un mandat nostre amb una legislatura que no sabem llegir no pot decidir
    // res: no s'aparella per ell, i tampoc es fa servir per descartar.
    if (anys === null) continue;
    if (seus.some((m) => solapen(m, { inici: anys.inici, fi: anys.fi }))) termes.push(fila.term);
  }
  if (termes.length === 0) {
    return { ok: false, motiu: "el nom lliga però les dates no es toquen" };
  }
  return { ok: true, termes: [...new Set(termes)].sort() };
}

// ─────────────────────────────────────────────────────────────────────────────
// La fitxa que es desa
// ─────────────────────────────────────────────────────────────────────────────

export type PersonaDesada = {
  qid: string;
  url: string;
  /** Els duplicats de Wikidata que s'han fusionat aquí dins. */
  qidsFusionats: string[];
  nom: string;
  naixement: string | null;
  viquipedia: string | null;
  ocupacions: string[];
  /** Els mandats d'alcaldia en **aquest** municipi. */
  mandats: { inici: string; fi: string | null }[];
  /** Altres municipis on Wikidata també li dona alcaldia. */
  altresMunicipis: string[];
  carrecs: { qid: string; nom: string; familia: Familia; inici: string | null; fi: string | null }[];
  altresCarrecs: number;
  /** Cert només si el nom i les dates lliguen amb el nostre historial. */
  aparellat: boolean;
  /** Les legislatures nostres amb què ha lligat: «2019-2023». */
  termes: string[];
  /** Quan no s'ha aparellat, per què. */
  motiuNoAparellat: string | null;
};

export type FitxaTrajectoria = {
  font: string;
  url: string;
  llicenciaDades: string;
  /** Data d'extracció: sense data, cap dada no entra a la fitxa. */
  descarregat: string;
  ine5: string;
  /** Persones que Wikidata dona com a alcaldes d'aquest municipi des del 1979. */
  totalPersones: number;
  aparellades: number;
  ambCarrecSuperior: number;
  persones: PersonaDesada[];
};

export function fitxaTrajectoria(
  ine5: string,
  persones: readonly { persona: PersonaWikidata; aparellament: Aparellament }[],
  descarregat: string,
): FitxaTrajectoria {
  const desades: PersonaDesada[] = persones.map(({ persona, aparellament }) => ({
    qid: persona.qid,
    url: `https://www.wikidata.org/wiki/${persona.qid}`,
    qidsFusionats: persona.qidsFusionats,
    nom: persona.nom,
    naixement: persona.naixement,
    viquipedia: persona.viquipedia,
    ocupacions: persona.ocupacions,
    mandats: persona.mandats
      .filter((m) => m.ine5 === ine5)
      .map((m) => ({ inici: m.inici, fi: m.fi })),
    altresMunicipis: [
      ...new Set(persona.mandats.filter((m) => m.ine5 !== ine5).map((m) => m.municipi)),
    ],
    carrecs: persona.carrecs
      .filter((c): c is CarrecWikidata & { familia: Familia } => c.familia !== null)
      .map((c) => ({ qid: c.carrecQid, nom: c.carrec, familia: c.familia, inici: c.inici, fi: c.fi })),
    altresCarrecs: persona.altresCarrecs,
    aparellat: aparellament.ok,
    termes: aparellament.ok ? aparellament.termes : [],
    motiuNoAparellat: aparellament.ok ? null : aparellament.motiu,
  }));

  return {
    font: FONT,
    url: ENDPOINT_SPARQL,
    llicenciaDades: LLICENCIA,
    descarregat,
    ine5,
    totalPersones: desades.length,
    aparellades: desades.filter((p) => p.aparellat).length,
    ambCarrecSuperior: desades.filter((p) => p.carrecs.length > 0).length,
    persones: desades,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// La feina
// ─────────────────────────────────────────────────────────────────────────────

export function trossos<T>(items: readonly T[], mida: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += mida) out.push(items.slice(i, i + mida));
  return out;
}

export async function j21TrajectoriaElectes(db: Db): Promise<void> {
  await withRun(db, "j21-trajectoria-electes", async (run) => {
    const munis = await db
      .select({ id: municipalities.id, ine5: municipalities.ine5, name: municipalities.name })
      .from(municipalities);
    const idPerIne = new Map(munis.map((m) => [m.ine5, m.id]));
    const nomPerIne = new Map(munis.map((m) => [m.ine5, m.name]));
    run.say(`${munis.length} municipis a aparellar`);

    // 1. Les alcaldies. Una sola consulta: 3.324 mandats, 2.921 persones, 947
    //    municipis a l'última execució contra WDQS.
    const alcaldies = parseAlcaldies(await fetchJson<unknown>(urlConsulta(CONSULTA_ALCALDIES)));
    run.rowsIn = alcaldies.length;
    const qids = [...new Set(alcaldies.map((m) => m.qid))];
    run.say(`${alcaldies.length} mandats d'alcaldia · ${qids.length} persones a Wikidata`);
    if (qids.length === 0) throw new Error("Wikidata no ha tornat cap alcaldia catalana");

    // 2. Els altres càrrecs i el perfil, en lots de 300 QID. Amb els 2.921 de
    //    cop, WDQS respon 504; en lots, cap crida no passa dels segons.
    const carrecs: CarrecWikidata[] = [];
    const perfils: PerfilWikidata[] = [];
    let crides = 0;
    for (const lot of trossos(qids, QIDS_PER_CRIDA)) {
      carrecs.push(
        ...parseCarrecs(await fetchJson<unknown>(urlConsulta(consultaCarrecs(lot)), { delayMs: PAUSA_MS })),
      );
      perfils.push(
        ...parsePerfil(await fetchJson<unknown>(urlConsulta(consultaPerfil(lot)), { delayMs: PAUSA_MS })),
      );
      crides += 2;
    }
    run.say(`${crides} crides en lots · ${carrecs.length} càrrecs · ${perfils.length} perfils`);

    const { persones, fusions } = fusionaDuplicats(agrupaPersones(alcaldies, carrecs, perfils));
    run.say(
      `${persones.length} persones després de fusionar ${fusions.length} parells de fitxes duplicades`,
    );
    for (const fusio of fusions) {
      // Els duplicats no són cap error nostre, però sí una cosa que algú hauria
      // d'arreglar a Wikidata, i per això queda escrit amb els dos QID.
      await run.issue({
        kind: "wikidata_persona_duplicada",
        severity: "baixa",
        municipalityId: idPerIne.get(fusio.ine5) ?? undefined,
        entity: fusio.conservat,
        detail: fusio,
      });
    }

    // 3. Per municipi: qui hi surt, i si lliga amb el nostre historial.
    const perIne = new Map<string, PersonaWikidata[]>();
    for (const persona of persones) {
      for (const ine5 of new Set(persona.mandats.map((m) => m.ine5))) {
        const grup = perIne.get(ine5);
        if (grup === undefined) perIne.set(ine5, [persona]);
        else grup.push(persona);
      }
    }

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

    const descarregat = new Date().toISOString().slice(0, 10);
    const comptador = {
      municipisAmbFitxa: 0,
      personesDesades: 0,
      aparellades: 0,
      senseAparellar: 0,
      passosAmbCarrecSuperior: 0,
      ambOcupacio: 0,
      ambViquipedia: 0,
      ineDesconegut: 0,
    };
    const perFamilia = new Map<Familia, Set<string>>(FAMILIES.map((f) => [f.clau, new Set()]));

    for (const [ine5, delMunicipi] of perIne) {
      const municipalityId = idPerIne.get(ine5);
      if (municipalityId === undefined) {
        // Un INE de Wikidata que no és de cap dels nostres 947. No es descarta
        // en silenci: si un dia una fusió de municipis en fa aparèixer un, ha
        // de sortir a la llista de coses per mirar.
        comptador.ineDesconegut += 1;
        await run.issue({
          kind: "wikidata_ine_desconegut",
          severity: "baixa",
          detail: { ine5, persones: delMunicipi.length },
        });
        continue;
      }

      const files = historialPerMunicipi.get(municipalityId) ?? [];
      const amb = delMunicipi.map((persona) => ({
        persona,
        aparellament: aparella(persona, ine5, files),
      }));

      for (const { persona, aparellament } of amb) {
        comptador.personesDesades += 1;
        if (aparellament.ok) comptador.aparellades += 1;
        else {
          comptador.senseAparellar += 1;
          await run.issue({
            kind: "wikidata_alcalde_no_aparellat",
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
        }
        if (persona.carrecs.length > 0) comptador.passosAmbCarrecSuperior += 1;
        if (persona.ocupacions.length > 0) comptador.ambOcupacio += 1;
        if (persona.viquipedia !== null) comptador.ambViquipedia += 1;
        for (const carrec of persona.carrecs) {
          if (carrec.familia !== null) perFamilia.get(carrec.familia)?.add(persona.qid);
        }
      }

      const fitxa = fitxaTrajectoria(ine5, amb, descarregat);
      await db
        .insert(municipalityMetrics)
        .values({ municipalityId, kind: KIND, data: fitxa })
        .onConflictDoUpdate({
          target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
          set: { data: fitxa, computedAt: new Date() },
        });
      comptador.municipisAmbFitxa += 1;
      run.rowsOut += 1;
    }

    // La mateixa persona surt a la fitxa de tots els municipis on ha estat
    // alcalde, i per això «personesDesades» pot passar de «persones»: aquesta és
    // la xifra de persones diferents, que és la que la pàgina ha de publicar.
    const ambSalt = new Set(persones.filter((p) => p.carrecs.length > 0).map((p) => p.qid));
    run.say(
      `${persones.length} alcaldes · ${ambSalt.size} amb càrrec per sobre de l'ajuntament ` +
        `(${((100 * ambSalt.size) / persones.length).toFixed(1)} %)`,
    );
    run.say(
      FAMILIES.map((f) => `${f.etiqueta}: ${perFamilia.get(f.clau)?.size ?? 0}`).join(" · "),
    );
    run.say(
      `aparellats amb el nostre historial: ${comptador.aparellades} de ` +
        `${comptador.personesDesades} passos per una alcaldia`,
    );

    return {
      font: FONT,
      llicenciaDades: LLICENCIA,
      descarregat,
      mandats: alcaldies.length,
      personesWikidata: qids.length,
      personesFusionades: persones.length,
      fusions: fusions.length,
      ambCarrecSuperior: ambSalt.size,
      perFamilia: Object.fromEntries(FAMILIES.map((f) => [f.clau, perFamilia.get(f.clau)?.size ?? 0])),
      crides: crides + 1,
      ...comptador,
    };
  });
}
