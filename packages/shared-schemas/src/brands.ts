/**
 * Marques polítiques i com lligar-les amb les dades obertes de la Generalitat.
 *
 * A cada elecció, el dataset «Processos electorals» agrupa les candidatures
 * locals sota un `agrupacio_codi` que canvia d'una elecció a l'altra
 * (ERC és `2015193` el 2015, `2019839` el 2019 i `20231127` el 2023). Sense
 * aquesta taula no es poden comparar dues eleccions, que és justament el que
 * volem fer a la radiografia de cada municipi.
 *
 * Els colors només s'utilitzen com a marca de dades als gràfics, mai com a
 * color d'interfície: el portal ha de ser visiblement de ningú.
 */

export type BrandKind =
  /** Partit d'àmbit estatal. */
  | "state"
  /** Partit d'àmbit català. */
  | "catalan"
  /** Federació o marca d'àmbit comarcal. */
  | "regional"
  /** Llista local sense marca supramunicipal. */
  | "local";

export type PartyBrand = {
  id: string;
  name: string;
  /** Color oficial de la candidatura al dataset electoral, com a reserva. */
  color: string;
  kind: BrandKind;
  /**
   * Marca de la qual prové, quan el 2015–2023 hi ha hagut escissió o refundació.
   * Serveix per explicar les sèries històriques sense fingir continuïtat.
   */
  lineage?: string;
};

export const PARTY_BRANDS: readonly PartyBrand[] = [
  { id: "erc", name: "Esquerra Republicana de Catalunya", color: "#ffb232", kind: "catalan" },
  { id: "junts", name: "Junts per Catalunya", color: "#00c3b2", kind: "catalan", lineage: "ciu" },
  { id: "psc", name: "Partit dels Socialistes de Catalunya", color: "#d00c3c", kind: "catalan" },
  { id: "cup", name: "Candidatura d'Unitat Popular", color: "#ffff00", kind: "catalan" },
  { id: "comuns", name: "Comuns", color: "#662483", kind: "catalan" },
  { id: "pp", name: "Partit Popular", color: "#234b90", kind: "state" },
  { id: "vox", name: "Vox", color: "#00c118", kind: "state" },
  { id: "cs", name: "Ciutadans", color: "#ff5824", kind: "state" },
  { id: "pdecat", name: "PDeCAT / PNC", color: "#7f9ac9", kind: "catalan", lineage: "ciu" },
  { id: "aliancacat", name: "Aliança Catalana", color: "#1d3f6e", kind: "catalan" },
  { id: "ciu", name: "Convergència i Unió", color: "#18307b", kind: "catalan" },
  { id: "podem", name: "Podem", color: "#6b2b73", kind: "state" },
  { id: "fic", name: "Federació d'Independents de Catalunya", color: "#5a9e5a", kind: "regional" },
  { id: "te", name: "Tots per l'Empordà", color: "#3f8f8f", kind: "regional" },
  { id: "idselva", name: "Independents de la Selva", color: "#8a7f4a", kind: "regional" },
  { id: "idc", name: "Independents de Catalunya", color: "#6d7f8a", kind: "regional" },
  { id: "cda", name: "Convergéncia Democratica Aranesa", color: "#a05a2c", kind: "regional" },
  { id: "local", name: "Llista local o d'electors", color: "#8b8b8b", kind: "local" },
];

export const BRANDS_BY_ID: ReadonlyMap<string, PartyBrand> = new Map(
  PARTY_BRANDS.map((b) => [b.id, b]),
);

/**
 * `agrupacio_codi` → marca, per elecció. Els codis surten de comptar els escons
 * per agrupació als datasets `ntc4-rnwr` de cada convocatòria (verificat 28-08-2026).
 * El que no hi és cau a `local` i entra a la cua de revisió: preferim una llista
 * local mal classificada com a local abans que atribuir-la a una marca que no és.
 */
export const AGRUPACIO_TO_BRAND: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  M20231: {
    "20231127": "erc",
    "20231121": "junts",
    "2023842": "psc",
    "20231128": "cup",
    "20231119": "comuns",
    "202386": "pp",
    "693": "vox",
    "301": "cs",
    "20231124": "pdecat",
    "1130": "aliancacat",
    "20231050": "te",
    "2023548": "fic",
    "20231051": "idselva",
    "20231047": "idc",
    "2023434": "cda",
    "3000000": "local",
  },
  M20191: {
    "2019839": "erc",
    "20191031": "junts",
    "2019838": "psc",
    "20191039": "cup",
    "20191043": "comuns",
    "86": "pp",
    "301": "cs",
    "739": "podem",
    "2019548": "fic",
    "20191050": "te",
    "20191051": "idselva",
    "20191047": "idc",
    "434": "cda",
    "3000000": "local",
  },
  M20151: {
    "2015193": "erc",
    "2015012": "ciu",
    "2015838": "psc",
    "2015673": "cup",
    "2015837": "comuns",
    "86": "pp",
    "301": "cs",
    "2015548": "fic",
    "20151012": "idselva",
    "434": "cda",
    "5000000": "local",
  },
};

/** Eleccions municipals que ingerim, de la més recent a la més antiga. */
export const MUNICIPAL_ELECTIONS = ["M20231", "M20191", "M20151"] as const;
export type MunicipalElection = (typeof MUNICIPAL_ELECTIONS)[number];

export type BrandResolution = {
  brandId: string;
  /** Cert quan el codi no és a la taula i hem caigut a `local`. */
  needsReview: boolean;
};

export function resolveBrand(election: string, agrupacioCodi: string | null | undefined): BrandResolution {
  const table = AGRUPACIO_TO_BRAND[election];
  const brandId = table && agrupacioCodi ? table[String(agrupacioCodi)] : undefined;
  return brandId ? { brandId, needsReview: false } : { brandId: "local", needsReview: true };
}

/**
 * Famílies de sigles a través del temps.
 *
 * La sèrie electoral des del 1979 només porta les sigles tal com es van
 * presentar, i una mateixa força canvia de nom cada poques eleccions: el PSC hi
 * surt com a PSC-PSOE, PSC-PM, PSC-CP, PSC CP i PSCPMC. Comparar cadenes és, per
 * tant, la manera segura d'afirmar que un poble ha canviat de mans quan no ho ha
 * fet mai. Aquesta taula existeix per no dir aquesta mentida.
 *
 * On no arriba la taula —les llistes locals, que són centenars i irrepetibles—
 * es compara l'arrel del nom, i davant del dubte es considera **la mateixa**
 * força: preferim no detectar una alternança abans que inventar-ne una.
 */
const SIGLES_FAMILIES: ReadonlyArray<readonly [RegExp, string]> = [
  // El «-CP» final és la Candidatura de Progrés, l'etiqueta amb què el PSC es
  // presenta en coalició a molts pobles: «SS-CP», «UB-CP», «CxB-CP». Hi és per
  // la mateixa raó que l'«am» d'aquí sota és d'Esquerra i l'«amunt» és de la
  // CUP —són marques de coalició registrades, no acrònims que sonin— i sense
  // ell 33 alcaldies del PSC es quedaven sense color mentre les d'ERC i la CUP
  // el tenien. La forma sencera «psccp» ja hi era; el que faltava era el tros.
  [/^(psc|pscpsoe|pscpm|psccp|pscpmc|psoe|pscunits)|(^|-)cp$/, "psc"],
  [/^(ciu|cdc|convergencia|uniodemocratica|udc)/, "ciu"],
  // «juntsxcat» hi és perquè a Tàrrega les sigles s'escriuen senceres i el
  // token «junts» no hi surt sol: sense això, l'alcaldia de Junts d'un poble de
  // dinou mil habitants sortia sense marca.
  [/(^|-)(junts|juntsxcat|jxcat|jxc|cm)($|-)/, "junts"],
  [/^(erc|esquerra|am$)/, "erc"],
  [/^(pp|ppc|apap|alianzapopular)/, "pp"],
  // «en comú» surt enmig del nom i no al principi: «Barcelona en Comú-C»,
  // «LHECP-C», «Sabadell en Comú Podem». Sense buscar-ho a dins, nou regidors
  // de Barcelona es quedaven sense grup.
  // «en-?comu» amb el guionet opcional: ara que `compact()` converteix l'espai
  // en separador en comptes d'esborrar-lo, «Barcelona en Comú-C» és
  // «barcelona-en-comu-c» i el testimoni enganxat ja no hi era.
  [/^(icv|iniciativa|euia|entesa|ecp|eacp|comuns|ecg|psuc|pcc)|en-?comu/, "comuns"],
  [/^(cup|amunt)/, "cup"],
  [/^(cs|ciutadans|ciudadanos)/, "cs"],
  [/^vox/, "vox"],
  [/^(pdecat|arapl|pnc)/, "pdecat"],
  [/^(aliancacat|ac$)/, "aliancacat"],
  // La Convergéncia Democratica Aranesa tenia marca i color però cap patró que
  // hi arribés: a Naut Aran les sigles són «CDA-PNA» i es quedava en gris.
  [/(^|-)(cda|cdaranesa)($|-)/, "cda"],
  // «Independents de la Selva» i «Tots per l'Empordà» s'escriuen com a sufix
  // dins de les sigles de la llista local amb qui van: «EA-IdSELVA»,
  // «TFS-TE». Ancorats al final i no en qualsevol lloc: a l'Espluga Calba hi
  // ha «TE-XTU», on «TE» no és Tots per l'Empordà i pintar-lo seria un error.
  [/-idselva$/, "idselva"],
  [/-te$/, "te"],
  // L'Acord Municipal d'Esquerra escrit sencer. El testimoni «am» ja hi és a
  // la línia d'ERC: deixar gris la forma llarga és incoherència, no prudència.
  [/(^|-)acord-?municipal($|-)/, "erc"],
];

/** Nom compacte i sense accents, per comparar. */
function compact(sigles: string): string {
  return sigles
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // L'espai i la barra separen trossos, i esborrar-los els enganxava: «JUNTS
    // PER RIALP CM» es convertia en «juntsperrialpcm», que no és cap testimoni
    // de res, i cinc alcaldies de Junts es quedaven sense marca. Els punts sí
    // que s'esborren: «F.I.C.» ha de continuar sent un sol tros.
    .replace(/[\s/]+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

/**
 * Família d'unes sigles, o `null` si no és cap marca coneguda.
 *
 * Mira la cadena sencera i també cada tros per separat, perquè les coalicions
 * locals amaguen la marca al mig: «UA-PSC-CP» és el PSC, i «SP-CUP-AM» és la CUP.
 * Sense mirar els trossos, aquestes files es llegirien com un canvi de partit
 * que no ha existit mai —i aquí això vol dir acusar algú de trànsfuga.
 */
export function siglesFamily(sigles: string): string | null {
  const key = compact(sigles);
  // Es prova amb els separadors i sense. Els patrons de dues paraules —«ARA
  // PL», «PSC PSOE», «Alianza Popular»— es van escriure quan `compact()`
  // esborrava els espais, i ara que els converteix en guió deixaven de casar:
  // vuit alcaldies del PDeCAT es van quedar sense marca en fer el canvi. Provar
  // les dues formes és el que fa que el canvi de separador no en trenqui cap.
  const enganxat = key.replace(/-/g, "");
  for (const [pattern, family] of SIGLES_FAMILIES) {
    if (pattern.test(key) || pattern.test(enganxat)) return family;
  }
  const found = new Set<string>();
  for (const token of key.split("-").filter(Boolean)) {
    for (const [pattern, family] of SIGLES_FAMILIES) {
      if (pattern.test(token)) found.add(family);
    }
  }
  // Si els trossos apunten a dues marques alhora és una coalició: no en triem cap.
  return found.size === 1 ? [...found][0]! : null;
}

/**
 * Dues sigles són la mateixa força? Es fa servir per comptar alternances a la
 * sèrie llarga, i per això és deliberadament conservadora.
 */
export function sameForce(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return true; // sense dades no afirmem que hi hagi hagut canvi
  const familyA = siglesFamily(a);
  const familyB = siglesFamily(b);
  if (familyA && familyB) return familyA === familyB;

  // Una de les dues és una coalició sense família clara: si comparteixen algun
  // tros significatiu, no afirmem que hagin canviat de bàndol.
  const tokensA = compact(a).split("-").filter((t) => t.length >= 2);
  const tokensB = compact(b).split("-").filter((t) => t.length >= 2);
  if (tokensA.some((t) => tokensB.includes(t))) return true;

  const keyA = compact(a).replace(/-/g, "");
  const keyB = compact(b).replace(/-/g, "");
  if (keyA === keyB) return true;
  if (keyA.startsWith(keyB) || keyB.startsWith(keyA)) return true;
  // Arrel compartida de quatre lletres: «indep. de Móra» i «independents Móra».
  return keyA.slice(0, 4) === keyB.slice(0, 4) && keyA.length >= 4;
}
