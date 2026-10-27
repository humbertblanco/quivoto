import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join } from "node:path";
import { asc, count, eq, inArray } from "drizzle-orm";
import {
  candidatures, councillorMandates, municipalities, municipalityMetrics, people, politicalGroups, type Db,
} from "@quivoto/db";
import { BRANDS_BY_ID } from "@quivoto/shared-schemas/brands";
import type { FitxaFotosExalcaldes } from "../jobs/j28-fotos-exalcaldes";
import { de, nomLlegible, normalizePersonName } from "../lib/text";
import { resolAlcaldia } from "./alcaldia";
import {
  alcaldiesHistoriques, anysDeLaPersona, duradaEscrita, genereDe, sexesPerNom,
  type HistorialAlcaldies, type ResultatsPerEleccio,
} from "./alcaldia-historica";
import { loadAmb } from "./amb";
import { inicials } from "./cara";
import { loadComarques, renderMapaComarca, type TacaComarca } from "./comarques";
import { SENSE_PARTIT } from "./ens-dades";
import type { DadesEns } from "./ens-tipus";
import { sobreColor } from "./contrast";
import type { Retrat } from "./fotos-wikidata";
import { hemicycle, seientsHemicicle } from "./hemicycle";
import { geometria, renderSilueta } from "./mapa";
import { catalunya, papereta } from "./mascota";
import { loadPartits } from "./partit";
import { carregaPreguntes } from "./preguntes";
import { adrecesRegidors, carrecAmbMunicipi } from "./regidor";
import { FITXER_OG } from "./seo";
import { partitDe, sigla } from "./sigla";
import { colorDe } from "./vots-partit";

/**
 * Les imatges socials (1200×630): la que surt quan algú comparteix una pàgina
 * de l'Observatori a WhatsApp, Bluesky o X.
 *
 * Fins ara les 947 fitxes compartien la mateixa imatge, i per tant compartir-ne
 * una no deia de quin poble era. Aquí cada municipi en té una de seva, amb el
 * nom, la comarca i **un fet que canvia segons el poble**. El fet no és
 * decoratiu: és el mateix criteri que mana a tot el projecte —«què han fet
 * aquests quatre anys al meu poble»— reduït a una frase.
 *
 * I des d'ara també en tenen les altres pàgines que es comparteixen: la de
 * cada persona del ple i de cada alcaldia històrica (amb el retrat, que és el
 * que fa que algú s'aturi), la de cada comarca i de l'AMB (amb el mapa pintat
 * de qui hi mana), la de cada partit i les globals. On va cada fitxer ho diu
 * `FITXER_OG` de `seo.ts`, que és el mateix lloc on les plantilles el demanen.
 *
 * Es dibuixa amb Chrome sense finestra perquè és l'única manera d'aconseguir la
 * tipografia del projecte (Gabarito 900 i Nunito Sans, incrustades al document)
 * sense afegir cap dependència al `package.json`. Chrome s'obre **una sola
 * vegada** i es parla amb ell pel protocol de depuració: obrir-lo una vegada per
 * imatge costava 2,6 s cadascuna —41 minuts per als 947— i així baixa a
 * desenes de mil·lisegons. Amb les persones són unes deu mil imatges, i per
 * això cada una porta un resum del que la fa (`.hashos.json`): la que no ha
 * canviat no es torna a dibuixar.
 */

// ------------------------------------------------------------------ mesures
// El format el fixen les xarxes: 1200×630 és el que demanen Open Graph i
// Twitter Cards, i és el que es retalla bé a la previsualització de WhatsApp.
const AMPLE = 1200;
const ALT = 630;

/** Alçades de les tres franges. Sumen 630 i han de quedar fixes: l'ajust
 *  automàtic de la mida de lletra mesura contra caixes d'alçada coneguda. */
const ALT_CAPCALERA = 100;
const ALT_COS = 362;
const ALT_BANDA = 168;

const ARREL_WEB = new URL("../../../../web/", import.meta.url).pathname;

const CHROME_CANDIDATS = [
  process.env.QUIVOTO_CHROME,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter((x): x is string => Boolean(x));

// ----------------------------------------------------------------- feines

/**
 * El que la plantilla necessita per pintar cada mena d'imatge. Tot hi va ja
 * resolt —el retrat com a `data:`, el mapa com a SVG, la sigla com a HTML—
 * perquè el document de Chrome es carrega des d'un fitxer temporal i no pot
 * anar a buscar res al web. I perquè així el resum de la imatge (vegeu
 * `resumDe`) inclou tot el que la fa: si canvia la foto, canvia la imatge.
 */
export type DadesImatge =
  | {
      tipus: "municipi";
      comarca: string | null;
      nom: string;
      /** HTML, només amb `<b>`. */
      frase: string;
      banda: string;
      /** L'escut o la silueta, com a HTML; buit si no hi ha res a ensenyar. */
      figura: string;
    }
  | {
      tipus: "persona";
      /** El text de la pastilla de dalt a la dreta: «Qui seu al ple», «Alcaldies des del 1979». */
      pastilla: string;
      /** «Sabadell · Vallès Occidental». */
      on: string;
      nom: string;
      /** «Alcaldessa de Sabadell», «Alcaldia d'Alcanar · 2003-2023». */
      carrec: string;
      /** La pastilla de sigles, com a HTML de `sigla()`; buida si no en té. */
      sigla: string;
      /** El retrat com a `data:`; sense, les inicials. */
      retrat: string | null;
      inicials: string;
      fons: string;
      tinta: string;
      /** El crèdit de Commons, en text pla; només quan el retrat és d'allà. */
      credit: string | null;
      frase: string;
      banda: string;
    }
  | {
      tipus: "territori";
      /** «Comarca», «Àrea metropolitana», «Diputació», «Consell comarcal». */
      ambit: string;
      nom: string;
      /** «30 municipis · 812.000 habitants». */
      xifres: string;
      frase: string;
      banda: string;
      figura: string;
    }
  | {
      tipus: "partit";
      sigles: string;
      nom: string;
      fons: string;
      tinta: string;
      frase: string;
      banda: string;
    }
  | {
      tipus: "global";
      titol: string;
      sota: string;
      /** La mascota o el senyal, com a SVG. */
      figura: string;
      frase: string;
      banda: string;
    };

/** Una imatge per fer: on va (relatiu a `og/`), en quin format i amb què. */
export type Feina = {
  fitxer: string;
  /** JPEG per a les persones: un retrat en PNG pesa cinc vegades més. */
  format: "png" | "jpeg";
  dades: DadesImatge;
};

// ------------------------------------------------------------- recursos

/** L'arrel del que se serveix: on són les fotos, els escuts i les imatges. */
const ARREL_PUBLIC = join(ARREL_WEB, "public");

const MIME: Record<string, string> = {
  ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml",
};

/**
 * Un fitxer del web com a `data:`, o `null` si no hi és.
 *
 * `cami` és el públic, amb la barra inicial (`/observatori/fotos/320/25009.webp`),
 * que és com el desen les fitxes de càrrecs i els retrats de Commons. Es mira el
 * disc perquè una fitxa pot apuntar a una foto que una ingesta posterior ha
 * retirat, i una imatge social amb un retrat trencat és pitjor que una amb
 * les inicials.
 */
export function fitxerPublic(cami: string | null | undefined): string | null {
  if (!cami) return null;
  const mime = MIME[extname(cami).toLowerCase()];
  if (!mime) return null;
  const ruta = join(ARREL_PUBLIC, cami);
  if (!existsSync(ruta)) return null;
  return `data:${mime};base64,${readFileSync(ruta).toString("base64")}`;
}

/**
 * L'escut del municipi, si J26 el va baixar, i si no la silueta del poble dins
 * de Catalunya —la mateixa de la fitxa. Els escuts són de Commons i el `.json`
 * del costat en porta la llicència; a la imatge social no hi cap el crèdit i
 * per això només s'hi posen els que J26 ha desat, que són els que la fitxa ja
 * acredita al bloc de fonts.
 */
export function figuraMunicipi(slug: string, ine5: string): string {
  const escut = fitxerPublic(`/observatori/escuts/${ine5}.svg`);
  if (escut && existsSync(join(ARREL_PUBLIC, "observatori/escuts", `${ine5}.json`))) {
    return `<img class="escut" src="${escut}" alt="">`;
  }
  return renderSilueta(slug, { descripcio: `On és ${slug}` });
}

// ---------------------------------------------------------------- les dades

type GovernmentMetric = {
  mayorName: string | null; mayorSigles: string | null; mayorSeats: number | null;
  winnerSigles: string | null; winnerSeats: number | null; totalSeats: number | null;
  winnerGoverns: boolean | null; winnerHasMajority: boolean | null;
};
type MayorsMetric = {
  currentTermChange: { term: string; mayors: { name: string; tookOfficeOn: string | null }[] } | null;
  /** L'historial sencer i els relleus, que és el que llegeixen les alcaldies històriques. */
  history?: HistorialAlcaldies["history"];
  changes?: HistorialAlcaldies["changes"];
};
type ElectoralHistory = { series: { year: number; winnerFamily: string | null }[] };
type ResultsMetric = Record<string, { candidatures: { sigles: string; brandId: string | null }[] }>;

/** El que li cal a una imatge: prou per triar la frase i escriure-la. */
export type OgMunicipi = {
  slug: string;
  name: string;
  comarca: string | null;
  government: GovernmentMetric | null;
  mayors: MayorsMetric | null;
  history: ElectoralHistory | null;
  /** Candidatures del 2023: l'únic lloc on les sigles porten marca. */
  results: ResultsMetric | null;
  /** El Síndic compta aquest ajuntament entre els que no tenen oposició. */
  singleList: boolean;
};

/**
 * Com anomenem cada família política en una frase. Les marques de
 * `shared-schemas` porten el nom llarg («Esquerra Republicana de Catalunya»),
 * que en una imatge de 1200 px es menja la frase sencera. En calen dues
 * versions perquè el català demana article dins d'una frase («mana el PSC»)
 * i no en vol dins d'un parèntesi («Mana Anna Puig (PSC)»).
 */
const FAMILIES: Record<string, { nom: string; ambArticle: string }> = {
  erc: { nom: "ERC", ambArticle: "ERC" },
  junts: { nom: "Junts", ambArticle: "Junts" },
  psc: { nom: "PSC", ambArticle: "el PSC" },
  cup: { nom: "CUP", ambArticle: "la CUP" },
  comuns: { nom: "comuns", ambArticle: "els comuns" },
  pp: { nom: "PP", ambArticle: "el PP" },
  vox: { nom: "Vox", ambArticle: "Vox" },
  cs: { nom: "Ciutadans", ambArticle: "Ciutadans" },
  pdecat: { nom: "PDeCAT", ambArticle: "el PDeCAT" },
  aliancacat: { nom: "Aliança Catalana", ambArticle: "Aliança Catalana" },
  ciu: { nom: "CiU", ambArticle: "CiU" },
  podem: { nom: "Podem", ambArticle: "Podem" },
  fic: { nom: "FIC", ambArticle: "la FIC" },
  te: { nom: "Tots per l'Empordà", ambArticle: "Tots per l'Empordà" },
  idselva: { nom: "Independents de la Selva", ambArticle: "els Independents de la Selva" },
  idc: { nom: "Independents de Catalunya", ambArticle: "els Independents de Catalunya" },
  cda: { nom: "CDA", ambArticle: "la CDA" },
};

/**
 * Sigles que no diuen res. **Aquesta és la sorpresa gran de la font**: el
 * dataset electoral desa el codi de la coalició, no el nom de la llista local,
 * i per això «CM» —Compromís Municipal, la marca amb què Junts es presenta als
 * pobles— surt com a sigles guanyadores a 338 municipis, «AM» (Acord Municipal,
 * ERC) a 10 i «CP» (Candidatura de Progrés, PSC) a 10. Una imatge que digués
 * «hi va guanyar CM» no informaria de res, així que en aquests casos posem la
 * família política, que sí que es reconeix.
 */
const SIGLES_BUIDES = new Set(["CM", "AM", "CP", "PM", "AMUNT"]);

/** Ratxa mínima per dir que una força «hi guanya sempre»: quatre eleccions
 *  seguides són setze anys, prou per ser un fet i no una coincidència. */
const RATXA_MINIMA = 4;

/** Sigles més llargues que això no caben enlloc; la font n'hi posa de 63 lletres. */
const MAX_SIGLES = 24;

const MESOS = [
  "gener", "febrer", "març", "abril", "maig", "juny",
  "juliol", "agost", "setembre", "octubre", "novembre", "desembre",
];

const escapa = (t: string): string =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** La font desa uns noms en majúscules i uns altres no. En una imatge que es
 *  comparteix, un nom cridant en majúscules sembla un error nostre. */
function capsAlta(nom: string): string {
  const base = nom === nom.toUpperCase()
    ? nom
      .toLocaleLowerCase("ca")
      .replace(/(^|[\s'’-])(\p{L})/gu, (_, abans: string, lletra: string) => abans + lletra.toLocaleUpperCase("ca"))
    : nom;
  // La font desa «Xavier Fonollosa I Comas»: la «i» de connexió dels cognoms
  // catalans va en minúscula, i en majúscula sembla una inicial. 138 noms.
  return base.replace(/(\s)I(\s)/g, "$1i$2");
}

/** La marca de la candidatura del 2023 que porta aquestes sigles, si la sabem. */
function marcaDe(m: OgMunicipi, text: string): string | null {
  const candidatures = m.results?.M20231?.candidatures;
  if (!Array.isArray(candidatures)) return null;
  return candidatures.find((c) => c.sigles === text)?.brandId ?? null;
}

/**
 * Com anomenem una candidatura dins la frase. Les sigles en brut valen gairebé
 * sempre («ERC-AM», «TxA», «CANETENCS»), però hi ha dos casos en què no:
 * quan són un codi de coalició buit (vegeu `SIGLES_BUIDES`) i quan són tan
 * llargues que no caben («VIU SORIGUERA-ESQUERRA REPUBLICANA DE CATALUNYA-ACORD
 * MUNICIPAL», 63 lletres). En tots dos casos la família política diu més.
 */
function etiqueta(m: OgMunicipi, text: string | null, ambArticle: boolean): string | null {
  if (!text) return null;
  const net = text.trim().replace(/\s+/g, " ");
  if (!net) return null;
  if (!SIGLES_BUIDES.has(net.toUpperCase()) && net.length <= MAX_SIGLES) return net;

  const marca = marcaDe(m, net);
  const familia = marca ? FAMILIES[marca] : undefined;
  if (familia) return ambArticle ? familia.ambArticle : familia.nom;
  if (marca === "local") return ambArticle ? "una llista local" : "llista local";
  return net.length > MAX_SIGLES ? `${net.slice(0, MAX_SIGLES - 1).trimEnd()}…` : net;
}

function mesIAny(iso: string | null): string | null {
  if (!iso) return null;
  const [any, mes] = iso.slice(0, 10).split("-");
  const nom = MESOS[Number(mes) - 1];
  return nom && any ? `${nom} del ${any}` : null;
}

/**
 * La ratxa de la força que va guanyar l'última elecció: quantes eleccions
 * seguides la guanya i des de quin any.
 *
 * S'hi exclou la família `local` a posta. Sota aquesta etiqueta hi ha totes les
 * llistes d'electors i les candidatures sense marca supramunicipal, i dues
 * llistes locals de dues eleccions diferents no són la mateixa força: dir «la
 * mateixa força hi guanya des del 1991» quan el que hi ha són tres agrupacions
 * d'independents diferents seria fals.
 */
function ratxaGuanyadora(history: ElectoralHistory | null): { anys: number; desde: number; familia: string } | null {
  const serie = history?.series;
  if (!Array.isArray(serie) || serie.length === 0) return null;
  const familia = serie[serie.length - 1]?.winnerFamily;
  if (!familia || familia === "local") return null;
  let i = serie.length - 1;
  while (i - 1 >= 0 && serie[i - 1]?.winnerFamily === familia) i -= 1;
  return { anys: serie.length - i, desde: serie[i]!.year, familia };
}

export type Frase = {
  /** HTML: només hi pot haver `<b>`, que la plantilla pinta subratllat. */
  html: string;
  /** Quina regla ha guanyat. Serveix per als tests i per comptar la barreja. */
  regla: "canvi-alcaldia" | "pacte" | "llista-unica" | "ratxa" | "qui-mana" | "guanyador" | "sense-dades";
  /** Color de la banda; el tria la regla, no el municipi (vegeu `triaFrase`). */
  banda: "presec" | "lavanda" | "menta";
};

/**
 * La frase de la imatge: **una sola**, i la més rellevant de cada poble.
 *
 * L'ordre de les regles no és arbitrari. Va del fet que més contradiu el que un
 * veí donaria per fet al que menys:
 *
 *  1. **L'alcaldia ha canviat a mig mandat** (97 municipis). És el que ningú no
 *     va votar: el ple d'ara no és el que va sortir de les urnes.
 *  2. **Mana qui no va guanyar** (31). El pacte hi ha pesat més que el vot.
 *  3. **Una sola candidatura** (181). No hi va haver elecció de veritat, i
 *     aquest és el fet més gros que es pot dir d'aquell ajuntament.
 *  4. **La mateixa força hi guanya des de fa setze anys o més** (82). Continuïtat
 *     llarga, que és informació encara que no hi hagi passat res.
 *  5. **Qui mana i amb quina força**, i si té majoria absoluta o no (547). Sempre
 *     n'hi ha, perquè els 947 municipis tenen la mètrica `government`; quan no
 *     sabem de quina llista és l'alcaldia (9 municipis), diem qui va guanyar.
 *
 * Sobre els 947: 97 · 31 · 181 · 82 · 547 · 9.
 *
 * El color de la banda segueix el mateix eix i no el municipi: préssec quan el
 * ple ha canviat de mans, lavanda quan mana el pacte i no el vot, menta quan hi
 * ha continuïtat. Així la imatge ja diu alguna cosa abans de llegir-la.
 */
export function triaFrase(m: OgMunicipi): Frase {
  const g = m.government;

  // 1 · Canvi d'alcaldia dins del mandat 2023-2027.
  const canvi = m.mayors?.currentTermChange;
  const entrant = canvi?.mayors?.[canvi.mayors.length - 1];
  if (entrant) {
    const quan = mesIAny(entrant.tookOfficeOn);
    return {
      regla: "canvi-alcaldia",
      banda: "presec",
      html: quan
        ? `L'alcaldia ha canviat a mig mandat: <b>${escapa(capsAlta(entrant.name))}</b> hi mana des del ${escapa(quan)}.`
        : `L'alcaldia ha canviat a mig mandat: ara hi mana <b>${escapa(capsAlta(entrant.name))}</b>.`,
    };
  }

  // 2 · Mana qui no va guanyar les eleccions.
  const guanyadora = etiqueta(m, g?.winnerSigles ?? null, true);
  const alcaldia = etiqueta(m, g?.mayorSigles ?? null, true);
  if (g && g.winnerGoverns === false && alcaldia && guanyadora) {
    const seus = g.mayorSeats !== null && g.totalSeats !== null
      ? `, amb ${g.mayorSeats} dels ${g.totalSeats} regidors`
      : "";
    return {
      regla: "pacte",
      banda: "lavanda",
      html: `Hi va guanyar ${escapa(guanyadora)}, però mana <b>${escapa(alcaldia)}</b>${seus}.`,
    };
  }

  // 3 · Ajuntament sense oposició.
  if (m.singleList) {
    return {
      regla: "llista-unica",
      banda: "menta",
      html: `Al ple hi ha <b>una sola candidatura</b>: el Síndic de Greuges hi compta un ajuntament sense oposició.`,
    };
  }

  // 4 · La mateixa força hi guanya des de fa quatre eleccions o més.
  const ratxa = ratxaGuanyadora(m.history);
  if (ratxa && ratxa.anys >= RATXA_MINIMA) {
    const nom = FAMILIES[ratxa.familia]?.ambArticle ?? ratxa.familia;
    return {
      regla: "ratxa",
      banda: "menta",
      html: `Hi guanya <b>${escapa(nom)}</b> des del ${ratxa.desde}: ${ratxa.anys} eleccions municipals seguides.`,
    };
  }

  // 5 · Qui mana. Distingim majoria absoluta de govern en minoria, que és el
  //     que decideix si l'alcaldia pot aprovar res sense demanar permís.
  const marcaAlcaldia = etiqueta(m, g?.mayorSigles ?? null, false);
  if (g?.mayorName && marcaAlcaldia) {
    const qui = `<b>${escapa(capsAlta(g.mayorName))}</b> (${escapa(marcaAlcaldia)})`;
    if (g.mayorSeats !== null && g.totalSeats !== null) {
      const majoria = g.mayorSeats * 2 > g.totalSeats;
      return {
        regla: "qui-mana",
        banda: "menta",
        html: majoria
          ? `Mana ${qui} amb majoria absoluta: ${g.mayorSeats} dels ${g.totalSeats} regidors.`
          : `Mana ${qui} sense majoria: ${g.mayorSeats} dels ${g.totalSeats} regidors.`,
      };
    }
    return { regla: "qui-mana", banda: "menta", html: `Hi mana ${qui}.` };
  }

  // 5 bis · 23 municipis on no hem pogut lligar l'alcaldia amb cap llista.
  //         Diem el que sí que sabem: qui va guanyar el 2023.
  if (guanyadora && g?.winnerSeats !== null && g?.totalSeats !== null && g) {
    return {
      regla: "guanyador",
      banda: "menta",
      html: `El 2023 hi va guanyar <b>${escapa(guanyadora)}</b>, amb ${g.winnerSeats} dels ${g.totalSeats} regidors.`,
    };
  }

  return {
    regla: "sense-dades",
    banda: "menta",
    html: `Resultats, comptes i alcaldies des del 1979, amb dades obertes.`,
  };
}

// ------------------------------------------------------------- la plantilla

/** Incrusta un woff2 del web com a `data:`. Sense això Chrome no pot carregar
 *  la tipografia des d'un document servit per `file:`, i la imatge sortiria
 *  amb la lletra del sistema. */
function fontIncrustada(fitxer: string): string {
  const dades = readFileSync(join(ARREL_WEB, "public/assets/fonts", fitxer));
  return `url(data:font/woff2;base64,${dades.toString("base64")}) format('woff2')`;
}

const COLORS_BANDA: Record<Frase["banda"], string> = {
  presec: "#FFD8B8",
  lavanda: "#C9C4F2",
  menta: "#BFE8D2",
};

/**
 * El document que Chrome té obert tota l'estona. Es carrega una vegada i
 * després només se li crida `pinta()` amb les dades de cada imatge: així les
 * tipografies es descodifiquen un sol cop per a les deu mil.
 *
 * Totes les menes d'imatge comparteixen la mateixa ossada —capçalera amb la
 * marca, cos amb un text a l'esquerra i una figura a la dreta, banda de color
 * a baix— i `data-tipus` al `body` és el que decideix què s'hi posa i com:
 * per a una persona la figura és el retrat i va a l'esquerra; per a un
 * municipi és l'escut; per a una comarca, el mapa. Així un lector que vegi
 * dues imatges de quivoto seguides a la mateixa xarxa les reconeix com a
 * germanes, que és el que fa que la marca existeixi.
 */
export function plantilla(): string {
  // Gabarito i Nunito Sans són variables: el mateix fitxer serveix totes les
  // gruixàries. Calen els dos subconjunts (llatí i llatí estès) perquè el
  // català hi porta «ŀ», «ï» i «à» repartits entre tots dos.
  const gabaritoLlati = fontIncrustada("QGYtz_0dZAGKJJ4t3HtoW4XGnfBI.woff2");
  const gabaritoEstes = fontIncrustada("QGYtz_0dZAGKJJ4t3HtmW4XGnfBI2fk.woff2");
  const nunitoLlati = fontIncrustada("pe0AMImSLYBIv1o4X1M8ce2xCx3yop4tQpF_MeTm0lfUVwoNnq4CLz0_kJ3xzHGGVFM.woff2");
  const nunitoEstes = fontIncrustada("pe0AMImSLYBIv1o4X1M8ce2xCx3yop4tQpF_MeTm0lfUVwoNnq4CLz0_kJPxzHGGVFMV2w.woff2");

  return `<!doctype html>
<html lang="ca"><head><meta charset="utf-8"><title>og</title>
<style>
@font-face{font-family:Gabarito;font-weight:400 900;src:${gabaritoLlati}}
@font-face{font-family:Gabarito;font-weight:400 900;src:${gabaritoEstes}}
@font-face{font-family:"Nunito Sans";font-weight:200 1000;src:${nunitoLlati}}
@font-face{font-family:"Nunito Sans";font-weight:200 1000;src:${nunitoEstes}}
:root{--paper:#FBF7EE;--ink:#1E1B2E;--ink-suau:#5B5870;--coral:#E2735A;--presec:#FFD8B8;--vora:#EDE7DA}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${AMPLE}px;height:${ALT}px;overflow:hidden}
body{background:var(--paper);color:var(--ink);font-family:"Nunito Sans",sans-serif;
  -webkit-font-smoothing:antialiased;display:flex;flex-direction:column}

/* La marca, petita: la imatge és del poble, no nostra. */
.capcalera{height:${ALT_CAPCALERA}px;padding:0 64px;display:flex;align-items:center;justify-content:space-between;flex:none}
.logo{font-family:Gabarito,sans-serif;font-weight:900;font-size:34px;letter-spacing:-.05em}
.pastilla{background:var(--presec);border:2.5px solid var(--ink);border-radius:999px;
  box-shadow:3px 3px 0 var(--ink);padding:7px 18px;font-size:17px;font-weight:800;
  text-transform:uppercase;letter-spacing:.09em}

/* El cos: el text a l'esquerra, la figura a la dreta. Les alçades són fixes
   perquè l'ajust de la mida de lletra mesura contra caixes conegudes. */
.cos{height:${ALT_COS}px;padding:0 64px;display:flex;align-items:center;gap:44px;flex:none}
.text{flex:1 1 auto;min-width:0;height:100%;padding:8px 0 22px;display:flex;flex-direction:column;justify-content:center}
.sobre{flex:none;height:34px;line-height:34px;font-size:24px;font-weight:800;letter-spacing:.15em;
  text-transform:uppercase;color:var(--coral);white-space:nowrap;overflow:hidden}
.caixa-nom{flex:1 1 0;min-height:0;display:flex;align-items:center;overflow:hidden;margin-top:10px}
#nom{width:100%;font-family:Gabarito,sans-serif;font-weight:900;letter-spacing:-.035em;line-height:.98}
.sota{flex:none;margin-top:14px;font-size:30px;font-weight:600;line-height:1.2;
  display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.sota:empty{display:none;margin:0}
.figura{flex:none;display:none;align-items:center;justify-content:center}
.figura:not(:empty){display:flex}

/* La pastilla de sigles, com a les pàgines, però a mida d'imatge. */
.sigla{display:inline-block;background:var(--c);color:var(--t);font-weight:900;font-size:24px;
  letter-spacing:.04em;padding:5px 16px;border-radius:999px;border:2.5px solid var(--ink);white-space:nowrap}

/* Municipi: l'escut o la silueta, a la dreta. */
body[data-tipus="municipi"] .figura{width:270px;height:300px}
body[data-tipus="municipi"] .figura>*{max-width:270px;max-height:300px}

/* Persona: el retrat a l'esquerra, en cercle i sempre de la mateixa mida. */
body[data-tipus="persona"] .cos{flex-direction:row-reverse}
body[data-tipus="persona"] .figura{width:290px;flex-direction:column;gap:12px}
.retrat,.inicials{width:260px;height:260px;border-radius:50%;flex:none;border:4px solid var(--ink);
  box-shadow:7px 7px 0 var(--ink);background:#fff}
.retrat{object-fit:cover}
.inicials{display:flex;align-items:center;justify-content:center;background:var(--c);color:var(--t);
  font-family:Gabarito,sans-serif;font-weight:900;font-size:112px;letter-spacing:-.04em}
.credit{font-size:14px;line-height:1.3;color:var(--ink-suau);text-align:center;max-width:290px;margin-top:6px}

/* Territori: el mapa de la comarca amb cada terme del color de qui hi mana, i
   Catalunya sencera a dalt a la dreta per dir on cau. Els gruixos van en
   píxels i no en unitats del llenç, que aquí canvia de mida amb cada comarca. */
body[data-tipus="territori"] .figura{width:380px;height:340px}
.mapa-comarca{width:100%;height:100%}
.mapa-comarca .llenc{position:relative;width:100%;height:100%}
.mapa-comarca svg.gran{width:100%;height:100%;overflow:hidden}
.mapa-comarca path{vector-effect:non-scaling-stroke}
.mapa-comarca .fora path{fill:var(--vora);stroke:var(--paper);stroke-width:1.5px}
.mapa-comarca .contorn{fill:none;stroke:var(--ink);stroke-width:2.5px}
.mapa-comarca .dins{fill:var(--c);stroke:var(--ink);stroke-width:2px;stroke-linejoin:round}
/* «On cau»: Catalunya petita a la cantonada de baix a la dreta del mapa, sobre
   un disc de paper perquè no es confongui amb els veïns grisos de sota. */
.mapa-comarca .situacio{position:absolute;right:-6px;bottom:-6px;width:104px;height:104px;
  background:var(--paper);border:2.5px solid var(--ink);border-radius:50%;display:flex;align-items:center;justify-content:center}
.mapa-comarca .situacio span,.mapa-comarca figcaption{display:none}
.mapa-comarca .on-cau{width:80px;height:80px;overflow:visible}
.mapa-comarca .on-cau .pais{fill:#fff;stroke:var(--ink);stroke-width:1.5px}
.mapa-comarca .on-cau .aqui{fill:var(--coral);stroke:none}
.mapa-comarca .on-cau .anella{fill:none;stroke:var(--ink);stroke-width:1.5px}
/* Sense mapa de la comarca, Catalunya sencera amb la comarca en coral. */
.senyal-territori{width:340px;height:340px}

/* Partit: les sigles dins d'una pastilla amb el seu color, i el nom a sota. */
body[data-tipus="partit"] #nom{width:auto;max-width:100%;background:var(--c);color:var(--t);
  padding:.06em .3em .1em;border-radius:.28em;border:4px solid var(--ink);box-shadow:9px 9px 0 var(--ink)}

/* Global: la mascota o el senyal, a la dreta. */
body[data-tipus="global"] .figura{width:300px;height:330px}
body[data-tipus="global"] .figura svg{width:280px;height:auto}

/* La banda de color: l'única superfície pintada de la imatge, i el que fa que
   dues fitxes diferents es distingeixin d'una ullada. */
.banda{height:${ALT_BANDA}px;padding:0 64px;border-top:3px solid var(--ink);
  display:flex;align-items:center;flex:none}
.caixa-frase{width:100%;height:104px;display:flex;align-items:center;overflow:hidden}
#frase{width:100%;font-weight:600;line-height:1.26}
/* Ressaltat de retolador en comptes de coral: sobre menta o lavanda el coral no
   té prou contrast, i aquí el que importa és que es llegeixi en un mòbil. */
#frase b{font-weight:900;box-shadow:inset 0 -.26em 0 rgba(255,255,255,.72)}
/* Damunt d'un color fosc (el d'un partit) el ressaltat blanc taparia el text. */
#frase.clara b{box-shadow:inset 0 -.26em 0 rgba(0,0,0,.35)}
</style></head>
<body>
<div class="capcalera"><span class="logo">quivoto</span><span class="pastilla" id="pastilla">Observatori municipal</span></div>
<div class="cos">
  <div class="text"><p class="sobre" id="sobre"></p><div class="caixa-nom"><h1 id="nom"></h1></div><p class="sota" id="sota"></p></div>
  <div class="figura" id="figura"></div>
</div>
<div class="banda" id="banda"><div class="caixa-frase"><p id="frase"></p></div></div>
<script>
const $ = (id) => document.getElementById(id);
const nom = $("nom"), frase = $("frase"), sobre = $("sobre"), sota = $("sota");
const figura = $("figura"), banda = $("banda"), pastilla = $("pastilla");
const escapa = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * La mida de lletra més gran que hi cap, per cerca binària. Un nom de 43
 * lletres com «Cruïlles, Monells i Sant Sadurní de l'Heura» i un de 10 com
 * «Castellcir» han de quedar tots dos bé, i cap regla fixa no ho aconsegueix:
 * val més mesurar. Es comprova l'alçada (que no surti de la caixa) i també
 * l'amplada (que una paraula llarga i sense partició no vessi pels costats, i
 * que la pastilla d'un partit no surti del cos).
 */
function encaixa(el, minim, maxim) {
  const caixa = el.parentElement;
  let baix = minim, alt = maxim, millor = minim;
  while (baix <= alt) {
    const mig = (baix + alt) >> 1;
    el.style.fontSize = mig + "px";
    const hiCap = el.scrollHeight <= caixa.clientHeight
      && el.scrollWidth <= el.clientWidth + 1
      && el.getBoundingClientRect().width <= caixa.clientWidth + 1;
    if (hiCap) { millor = mig; baix = mig + 1; } else { alt = mig - 1; }
  }
  el.style.fontSize = millor + "px";
}

const PASTILLES = { municipi: "Observatori municipal", persona: "Qui seu al ple", territori: "Qui mana", partit: "Els partits", global: "Observatori municipal" };

window.pinta = async (d) => {
  document.body.dataset.tipus = d.tipus;
  pastilla.textContent = d.pastilla || PASTILLES[d.tipus];
  nom.removeAttribute("style");
  sota.innerHTML = ""; figura.innerHTML = "";
  if (d.tipus === "municipi") {
    sobre.textContent = d.comarca || "Catalunya"; nom.textContent = d.nom; figura.innerHTML = d.figura;
  } else if (d.tipus === "persona") {
    sobre.textContent = d.on; nom.textContent = d.nom;
    sota.innerHTML = "<span>" + escapa(d.carrec) + "</span>" + d.sigla;
    figura.innerHTML = d.retrat
      ? '<img class="retrat" src="' + d.retrat + '" alt="">'
      : '<span class="inicials" style="--c:' + escapa(d.fons) + ';--t:' + escapa(d.tinta) + '">' + escapa(d.inicials) + "</span>";
    if (d.credit) figura.insertAdjacentHTML("beforeend", '<p class="credit">' + escapa(d.credit) + "</p>");
  } else if (d.tipus === "territori") {
    sobre.textContent = d.ambit; nom.textContent = d.nom; sota.textContent = d.xifres; figura.innerHTML = d.figura;
  } else if (d.tipus === "partit") {
    sobre.textContent = "Als ajuntaments de Catalunya"; nom.textContent = d.sigles; sota.textContent = d.nom;
    nom.style.setProperty("--c", d.fons); nom.style.setProperty("--t", d.tinta);
  } else {
    sobre.textContent = "Catalunya · quivoto.cat"; nom.textContent = d.titol; sota.textContent = d.sota; figura.innerHTML = d.figura;
  }
  frase.innerHTML = d.frase;
  banda.style.background = d.banda;
  banda.style.color = d.tipus === "partit" ? d.tinta : "";
  frase.classList.toggle("clara", d.tipus === "partit" && d.tinta.toLowerCase() === "#fbf7ee");
  await document.fonts.ready;
  // Els retrats van com a data: però igualment es descodifiquen a part: sense
  // esperar-los, la captura pot sortir amb el cercle buit.
  await Promise.all([...document.images].map((img) => img.complete ? null : new Promise((fet) => { img.onload = img.onerror = fet; })));
  encaixa(nom, 40, 144);
  encaixa(frase, 24, 38);
  // Dos fotogrames: el primer aplica l'estil, el segon garanteix que ja s'ha
  // pintat abans que Chrome faci la captura.
  await new Promise((fet) => requestAnimationFrame(() => requestAnimationFrame(fet)));
  return true;
};
</script>
</body></html>`;
}

// ---------------------------------------------------- Chrome sense finestra

type Cdp = {
  crida: (metode: string, params?: Record<string, unknown>) => Promise<any>;
  tanca: () => Promise<void>;
};

/** Espera que Chrome escrigui el port del protocol de depuració. El demanem
 *  amb `--remote-debugging-port=0` perquè triï un port lliure: si el fixéssim,
 *  dues execucions alhora es trepitjarien. */
async function esperaPort(perfil: string, proces: ChildProcess): Promise<number> {
  const fins = Date.now() + 20_000;
  while (Date.now() < fins) {
    if (proces.exitCode !== null) throw new Error(`Chrome ha sortit amb codi ${proces.exitCode}`);
    try {
      const text = await readFile(join(perfil, "DevToolsActivePort"), "utf8");
      const port = Number(text.split("\n")[0]);
      if (Number.isFinite(port) && port > 0) return port;
    } catch { /* encara no hi és */ }
    await new Promise((fet) => setTimeout(fet, 50));
  }
  throw new Error("Chrome no ha obert el port de depuració en 20 s");
}

/** Obre Chrome amb el document ja carregat i retorna com parlar-hi. */
async function obreChrome(documentUrl: string): Promise<Cdp> {
  const binari = CHROME_CANDIDATS.find((ruta) => {
    try { readFileSync(ruta, { flag: "r" }); return true; } catch { return false; }
  });
  if (!binari) {
    throw new Error(
      `No s'ha trobat Chrome. Provats: ${CHROME_CANDIDATS.join(", ")}. ` +
      `Es pot indicar amb la variable QUIVOTO_CHROME.`,
    );
  }

  const perfil = await mkdtemp(join(tmpdir(), "quivoto-og-"));
  const proces = spawn(binari, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-sync",
    "--mute-audio",
    `--user-data-dir=${perfil}`,
    `--window-size=${AMPLE},${ALT}`,
    "--remote-debugging-port=0",
    documentUrl,
  ], { stdio: "ignore" });

  const port = await esperaPort(perfil, proces);

  // La pestanya que ja té el document obert.
  const objectius = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()) as
    { type: string; webSocketDebuggerUrl?: string }[];
  const pagina = objectius.find((o) => o.type === "page" && o.webSocketDebuggerUrl);
  if (!pagina?.webSocketDebuggerUrl) throw new Error("Chrome no ha obert cap pestanya");

  const ws = new WebSocket(pagina.webSocketDebuggerUrl);
  const pendents = new Map<number, { fet: (v: any) => void; fallat: (e: Error) => void }>();
  let seguent = 0;

  await new Promise<void>((fet, fallat) => {
    ws.addEventListener("open", () => fet(), { once: true });
    ws.addEventListener("error", () => fallat(new Error("no s'ha pogut connectar amb Chrome")), { once: true });
  });

  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(String(event.data));
    const espera = pendents.get(msg.id);
    if (!espera) return;
    pendents.delete(msg.id);
    if (msg.error) espera.fallat(new Error(`${msg.error.message ?? "error"} (${msg.method ?? ""})`));
    else espera.fet(msg.result);
  });

  const crida = (metode: string, params: Record<string, unknown> = {}): Promise<any> => {
    seguent += 1;
    const id = seguent;
    return new Promise((fet, fallat) => {
      pendents.set(id, { fet, fallat });
      ws.send(JSON.stringify({ id, method: metode, params }));
    });
  };

  // Fixem la mida del llenç: `--window-size` no sempre acaba donant un
  // finestral de 1200×630 exactes, i una imatge social de mida variable
  // se serveix retallada.
  await crida("Emulation.setDeviceMetricsOverride", {
    width: AMPLE, height: ALT, deviceScaleFactor: 1, mobile: false,
  });

  // El document pot no haver acabat de carregar quan connectem: hi insistim
  // fins que `pinta()` hi és.
  const fins = Date.now() + 20_000;
  for (;;) {
    const { result } = await crida("Runtime.evaluate", { expression: "typeof window.pinta" });
    if (result?.value === "function") break;
    if (Date.now() > fins) throw new Error("el document de la imatge no s'ha carregat");
    await new Promise((fet) => setTimeout(fet, 50));
  }

  return {
    crida,
    tanca: async () => {
      try { ws.close(); } catch { /* tant se val */ }

      // Cal esperar que Chrome hagi sortit de debò abans d'esborrar-li el
      // perfil: mentre es tanca encara hi escriu, i un `rm` immediat peta amb
      // ENOTEMPTY *després* d'haver generat les 947 imatges, cosa que fa que
      // una feina acabada sembli fallida.
      await new Promise<void>((fet) => {
        if (proces.exitCode !== null || proces.signalCode !== null) return fet();
        const insisteix = setTimeout(() => proces.kill("SIGKILL"), 3_000);
        proces.once("exit", () => { clearTimeout(insisteix); fet(); });
        proces.kill();
      });

      // I si tot i així queda alguna cosa a mig escriure, tant se val: és un
      // directori temporal i no val la pena perdre-hi la feina feta.
      try {
        await rm(perfil, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
      } catch { /* el sistema ja el buidarà */ }
    },
  };
}

// ------------------------------------------------------------------ resums

const sha1 = (text: string): string => createHash("sha1").update(text).digest("hex");

/**
 * El resum del que fa una imatge: la plantilla, el format i les dades ja
 * resoltes (retrat inclòs). Dues execucions amb el mateix resum dibuixen el
 * mateix píxel a píxel, i per això n'hi ha prou amb comparar-lo per saber si
 * cal tornar a dibuixar.
 */
export function resumDe(feina: Feina, resumPlantilla: string): string {
  return sha1(`${resumPlantilla}\n${feina.format}\n${JSON.stringify(feina.dades)}`);
}

type Hashos = Record<string, string>;

/** On es desen els resums: dins d'`og/`, amb punt perquè el web no el llisti. */
const FITXER_HASHOS = ".hashos.json";

/**
 * Els resums de l'última execució, sense els de les imatges que ja no hi són:
 * si algú esborra un fitxer per forçar-ne la regeneració, el resum vell no
 * l'ha de salvar.
 */
async function llegeixHashos(outDir: string): Promise<Hashos> {
  let hashos: Hashos = {};
  try {
    hashos = JSON.parse(await readFile(join(outDir, FITXER_HASHOS), "utf8")) as Hashos;
  } catch { /* primera execució, o fitxer trencat: es refà tot */ }
  for (const fitxer of Object.keys(hashos)) {
    if (!existsSync(join(outDir, fitxer))) delete hashos[fitxer];
  }
  return hashos;
}

// --------------------------------------------------------------- generació

/**
 * Dibuixa les feines que han canviat i deixa constància del resum de cada
 * una. Retorna quantes n'ha escrit, quant ocupen i quantes s'ha estalviat.
 */
export async function generaImatges(
  feines: readonly Feina[],
  outDir: string,
): Promise<{ images: number; bytes: number; saltades: number }> {
  if (feines.length === 0) return { images: 0, bytes: 0, saltades: 0 };
  await mkdir(outDir, { recursive: true });

  const hashos = await llegeixHashos(outDir);
  const document = plantilla();
  const resumPlantilla = sha1(document);
  const pendents = feines
    .map((feina) => ({ feina, resum: resumDe(feina, resumPlantilla) }))
    .filter(({ feina, resum }) => hashos[feina.fitxer] !== resum);
  const saltades = feines.length - pendents.length;
  if (pendents.length === 0) return { images: 0, bytes: 0, saltades };

  // El document viu en un directori temporal: no ha d'anar al repositori ni
  // acabar servit pel web.
  const treball = await mkdtemp(join(tmpdir(), "quivoto-og-doc-"));
  const documentPath = join(treball, "og.html");
  await writeFile(documentPath, document, "utf8");

  const chrome = await obreChrome(`file://${documentPath}`);
  let bytes = 0;
  let fetes = 0;
  try {
    for (const { feina, resum } of pendents) {
      await chrome.crida("Runtime.evaluate", {
        expression: `window.pinta(${JSON.stringify(feina.dades)})`,
        awaitPromise: true,
      });
      const { data } = await chrome.crida(
        "Page.captureScreenshot",
        feina.format === "jpeg" ? { format: "jpeg", quality: 85 } : { format: "png" },
      );
      const imatge = Buffer.from(data as string, "base64");
      const desti = join(outDir, feina.fitxer);
      await mkdir(dirname(desti), { recursive: true });
      await writeFile(desti, imatge);
      hashos[feina.fitxer] = resum;
      bytes += imatge.byteLength;
      fetes += 1;
    }
  } finally {
    // Els resums es desen encara que Chrome peti a mig camí: el que s'ha
    // escrit fins llavors és bo i no s'ha de repetir.
    await writeFile(join(outDir, FITXER_HASHOS), `${JSON.stringify(hashos, null, 0)}\n`, "utf8");
    await chrome.tanca();
    await rm(treball, { recursive: true, force: true });
  }

  return { images: fetes, bytes, saltades };
}

// ------------------------------------------------------------------- accés

type CarrecSeu = {
  nom: string; carrec: string; grup: string | null; equipGovern: boolean;
  foto: string | null; fotoPetita: string | null; fitxa: string | null;
};
type Councillor = {
  municipalityId: number; name: string; role: string | null; groupName: string | null;
  sigles: string | null; color: string | null; brandId: string | null; orderNum: number | null;
};

/** El que cal, a més d'`OgMunicipi`, per a les persones i l'escut. */
export type OgFitxa = Omit<OgMunicipi, "results"> & {
  ine5: string;
  results: ResultatsPerEleccio | null;
  /** La fitxa de càrrecs de la seu electrònica (J11), quan n'hi ha. */
  carrecs: { carrecs: CarrecSeu[] } | null;
  /** Qui seu al ple segons el registre d'electes, en l'ordre del registre. */
  councillors: Councillor[];
  fotosExalcaldes: FitxaFotosExalcaldes | null;
};

/** Carrega només el que necessiten les imatges dels municipis demanats. */
export async function loadOgMunicipis(db: Db, slugs?: readonly string[]): Promise<OgFitxa[]> {
  const files = slugs && slugs.length > 0
    ? await db.select().from(municipalities).where(inArray(municipalities.slug, [...slugs]))
    : await db.select().from(municipalities);
  if (files.length === 0) return [];

  const ids = files.map((f) => f.id);
  const mesures = await db
    .select()
    .from(municipalityMetrics)
    .where(inArray(municipalityMetrics.kind, [
      "government", "mayors", "electoralHistory", "results", "singleList", "carrecs", "fotosExalcaldes",
    ]));

  const perMunicipi = new Map<number, Record<string, unknown>>();
  const volguts = new Set(ids);
  for (const m of mesures) {
    if (!volguts.has(m.municipalityId)) continue;
    const bossa = perMunicipi.get(m.municipalityId) ?? {};
    bossa[m.kind] = m.data;
    perMunicipi.set(m.municipalityId, bossa);
  }

  // Els mateixos camps i el mateix ordre que `loadRadiografia`: l'adreça de
  // cada persona surt de la llista en aquest ordre i ha de coincidir.
  const electes: Councillor[] = await db
    .select({
      municipalityId: councillorMandates.municipalityId,
      name: people.fullName,
      role: councillorMandates.role,
      groupName: politicalGroups.name,
      sigles: candidatures.sigles,
      color: candidatures.color,
      brandId: candidatures.brandId,
      orderNum: councillorMandates.orderNum,
    })
    .from(councillorMandates)
    .innerJoin(people, eq(people.id, councillorMandates.personId))
    .leftJoin(politicalGroups, eq(politicalGroups.id, councillorMandates.groupId))
    .leftJoin(candidatures, eq(candidatures.id, politicalGroups.candidatureId))
    .where(inArray(councillorMandates.municipalityId, ids))
    .orderBy(asc(councillorMandates.municipalityId), asc(councillorMandates.orderNum));
  const electesPerMunicipi = new Map<number, Councillor[]>();
  for (const e of electes) {
    const llista = electesPerMunicipi.get(e.municipalityId) ?? [];
    llista.push(e);
    electesPerMunicipi.set(e.municipalityId, llista);
  }

  return files
    .map((f) => {
      const bossa = perMunicipi.get(f.id) ?? {};
      return {
        slug: f.slug,
        name: f.name,
        comarca: f.comarca,
        ine5: f.ine5,
        government: (bossa.government ?? null) as GovernmentMetric | null,
        mayors: (bossa.mayors ?? null) as MayorsMetric | null,
        history: (bossa.electoralHistory ?? null) as ElectoralHistory | null,
        results: (bossa.results ?? null) as ResultatsPerEleccio | null,
        singleList: "singleList" in bossa,
        carrecs: (bossa.carrecs ?? null) as OgFitxa["carrecs"],
        councillors: electesPerMunicipi.get(f.id) ?? [],
        fotosExalcaldes: (bossa.fotosExalcaldes ?? null) as FitxaFotosExalcaldes | null,
      };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

// ------------------------------------------------------------- les feines

/** La imatge d'un municipi: neutra, sense cap cara; el fet del poble i l'escut. */
export function feinaMunicipi(m: OgMunicipi & { ine5: string }): Feina {
  const frase = triaFrase(m);
  return {
    fitxer: FITXER_OG.municipi(m.slug),
    format: "png",
    dades: {
      tipus: "municipi",
      comarca: m.comarca,
      nom: m.name,
      frase: frase.html,
      banda: COLORS_BANDA[frase.banda],
      figura: figuraMunicipi(m.slug, m.ine5),
    },
  };
}

// ------------------------------------------------------------ les persones

const majuscula = (t: string): string => t.charAt(0).toLocaleUpperCase("ca") + t.slice(1);

/**
 * El color de la força d'una persona, amb la mateixa regla que la pastilla de
 * `sigla()`: mana la marca quan la sabem, i el color de la font només quan no.
 * Les inicials de qui no té foto van d'aquest color, i per això ha de ser el
 * mateix que el de la pastilla del costat.
 */
export function colorForca(sigles: string | null, brandId?: string | null, color?: string | null): string {
  const id = partitDe(sigles, brandId);
  const marca = id ? BRANDS_BY_ID.get(id)?.color : null;
  const oficial = color?.trim();
  return marca ?? (oficial && /^#[0-9a-f]{6}$/i.test(oficial) ? oficial : "#8b8b8b");
}

/**
 * El crèdit d'un retrat de Commons, en una línia de text pla: l'autor si se
 * sap (si no, el fitxer, que identifica l'obra), la llicència i l'origen. La
 * imatge social és una còpia més del retrat i la BY de la llicència hi
 * arriba igual.
 */
export function creditPla(r: Retrat): string {
  const autor = r.autor ?? (r.fitxer ? r.fitxer.replace(/^File:/, "") : "autoria no declarada");
  return `Foto: ${autor} · ${r.llicencia.nom} · Wikimedia Commons`;
}

const quantsMandats = (n: number): string => (n === 1 ? "Un mandat" : `${n} mandats`);

/**
 * Les imatges de les persones d'un municipi: una per fitxa de regidor i una
 * per alcaldia històrica que té pàgina pròpia.
 *
 * Qui hi ha i a quina adreça ho decideix el mateix codi que escriu les
 * pàgines —`escriuRegidors` a `publish.ts` i `escriuAlcaldiesHistoriques`—,
 * i aquí se'n repeteix la tria amb les mateixes funcions (`adrecesRegidors`,
 * `alcaldiesHistoriques`, `resolAlcaldia`): la seu electrònica quan hi és, el
 * registre d'electes quan no, i les alcaldies que redirigeixen a una fitxa de
 * regidor no tenen imatge perquè no tenen pàgina.
 */
export function feinesPersones(m: OgFitxa, sexes: ReadonlyMap<string, "H" | "D">): Feina[] {
  const feines: Feina[] = [];
  const on = m.comarca ? `${m.name} · ${m.comarca}` : m.name;

  // 1 · Qui seu al ple.
  const deLaSeu = m.carrecs?.carrecs ?? [];
  const carrecs: CarrecSeu[] = deLaSeu.length > 0
    ? deLaSeu
    : m.councillors.map((c) => ({
        nom: c.name, carrec: c.role ?? "Regidoria", grup: c.groupName,
        equipGovern: false, foto: null, fotoPetita: null, fitxa: null,
      }));
  const perNom = new Map(m.councillors.map((c) => [normalizePersonName(c.name), c]));
  const adreces = adrecesRegidors(carrecs);
  for (const c of carrecs) {
    const registre = perNom.get(normalizePersonName(c.nom)) ?? null;
    const sigles = registre?.sigles ?? null;
    const color = colorForca(sigles, registre?.brandId, registre?.color);
    const { fons, tinta } = sobreColor(color);
    const nom = nomLlegible(c.nom);
    feines.push({
      fitxer: FITXER_OG.regidor(m.slug, adreces.get(c)!),
      format: "jpeg",
      dades: {
        tipus: "persona",
        pastilla: "Qui seu al ple",
        on,
        nom,
        carrec: majuscula(carrecAmbMunicipi(c.carrec, m.name)),
        sigla: c.grup ? sigla(sigles ?? c.grup, { color }) : "",
        retrat: fitxerPublic(c.foto ?? c.fotoPetita),
        inicials: inicials(nom),
        fons,
        tinta,
        credit: null,
        frase: `Què ha votat el seu grup al ple ${escapa(de(m.name))}, què cobra i <b>d'on surt cada dada</b>.`,
        banda: COLORS_BANDA.menta,
      },
    });
  }

  // 2 · Les alcaldies des del 1979.
  const historial = m.mayors?.history && m.mayors.changes ? (m.mayors as HistorialAlcaldies) : null;
  const actual = resolAlcaldia(m.carrecs?.carrecs ?? null, m.government, m.councillors.map((c) => ({ nom: c.name })));
  const persones = alcaldiesHistoriques(historial, {
    results: m.results,
    fotos: m.fotosExalcaldes,
    actual: { nom: actual.nom, adreca: actual.adreca },
  });
  for (const p of persones) {
    if (p.fitxaRegidor) continue;
    const genere = genereDe(p.clau, m.carrecs?.carrecs ?? null, sexes);
    const { fons, tinta } = sobreColor(p.color ?? "#8b8b8b");
    // J28 no baixa el retrat de l'alcaldia vigent; per a ella val el de la seu.
    const retratSeu = p.actual ? fitxerPublic(actual.foto) : null;
    const retratCommons = retratSeu ? null : fitxerPublic(p.retrat?.cami);
    feines.push({
      fitxer: FITXER_OG.alcaldia(m.slug, p.slug),
      format: "jpeg",
      dades: {
        tipus: "persona",
        pastilla: "Alcaldies des del 1979",
        on,
        nom: p.nom,
        carrec: `${majuscula(genere ?? "alcaldia")} ${de(m.name)} · ${anysDeLaPersona(p)}`,
        sigla: p.sigles ? sigla(p.sigles, { color: p.color }) : "",
        retrat: retratSeu ?? retratCommons,
        inicials: inicials(p.nom),
        fons,
        tinta,
        credit: retratCommons && p.retrat ? creditPla(p.retrat) : null,
        frase: `<b>${quantsMandats(p.mandats.length)}</b> a l'alcaldia ${escapa(de(m.name))}, ${escapa(duradaEscrita(p.durada))}: resultats, relleus i qui hi va haver abans i després.`,
        banda: COLORS_BANDA.lavanda,
      },
    });
  }
  return feines;
}

// ------------------------------------------------ comarques, AMB i partits

const xifra = (n: number): string => n.toLocaleString("ca-ES");

/** El mínim que cal d'una comarca o de l'AMB per fer-ne la imatge. */
export type TerritoriOg = {
  slug: string;
  name: string;
  municipis: readonly TacaComarca[];
  habitants: number;
  /** Les forces per alcaldies, de més a menys, com a la pàgina. */
  forces: readonly { label: string; color: string; alcaldies: number }[];
};

/**
 * Catalunya sencera amb els municipis del territori pintats de qui hi mana:
 * el que es dibuixa quan `renderMapaComarca` no pot (un ens sense geometria
 * als límits de l'ICGC). El mateix senyal que la fitxa municipal, però amb
 * més d'un terme encès.
 */
export function senyalTerritori(municipis: readonly TacaComarca[]): string {
  if (!geometria.contorn) return "";
  const taques = municipis
    .filter((m) => geometria.municipis[m.slug])
    .map((m) => `<path d="${geometria.municipis[m.slug]}" fill="${colorDe(m.mayorBrandId ?? "")}" stroke="var(--ink)" stroke-width="3"/>`)
    .join("");
  return `<svg class="senyal-territori" viewBox="${escapa(geometria.viewBox)}" role="img" aria-label="Catalunya">
  <path d="${geometria.contorn}" fill="var(--vora)" stroke="var(--ink)" stroke-width="6" stroke-linejoin="round"/>${taques}</svg>`;
}

/** La imatge d'una comarca o de l'AMB: el mapa pintat per força i qui hi té més alcaldies. */
export function feinaTerritori(t: TerritoriOg, ambit: "comarca" | "amb"): Feina {
  const quants = t.municipis.length;
  const [primera, segona] = t.forces;
  const alcaldies = (n: number): string => (n === 1 ? "1 alcaldia" : `${xifra(n)} alcaldies`);
  const frase = primera
    ? `<b>${escapa(primera.label)}</b> té ${alcaldies(primera.alcaldies)} de ${xifra(quants)}${
        segona ? `; ${escapa(segona.label)}, ${xifra(segona.alcaldies)}.` : "."
      }`
    : `Qui mana a cada un dels ${xifra(quants)} municipis, i què en diuen els comptes.`;
  return {
    fitxer: ambit === "amb" ? FITXER_OG.amb() : FITXER_OG.comarca(t.slug),
    format: "png",
    dades: {
      tipus: "territori",
      ambit: ambit === "amb" ? "Àrea metropolitana" : "Comarca",
      nom: t.name,
      xifres: `${xifra(quants)} municipis · ${xifra(t.habitants)} habitants`,
      frase,
      banda: COLORS_BANDA.presec,
      figura: renderMapaComarca(t.municipis, "", t.name) || senyalTerritori(t.municipis),
    },
  };
}

// ------------------------------------------------ diputacions i consells

/**
 * L'hemicicle d'un ens, per a la imatge: un cercle per escó, del color de
 * dada de cada partit i en l'ordre de la composició. És el que respon «qui hi
 * mana» d'una ullada, i el que una diputació té i una comarca no.
 *
 * Es fa amb la suma dels escons de la composició i no amb `seients` del
 * registre: si no quadren, el dibuix ha de ser fidel als grups que ensenya.
 * Un color que no és hexadecimal no entra a l'atribut (el mateix gris que a
 * `feinaPartit`). Sense composició, no hi ha hemicicle.
 */
export function hemicicleEns(d: Pick<DadesEns, "nom" | "composicio">): string {
  const grups = d.composicio
    .filter((g) => g.seients > 0)
    .map((g) => ({
      nom: g.partit,
      regidories: g.seients,
      color: g.color && /^#[0-9a-f]{6}$/i.test(g.color) ? g.color : "#8b8b8b",
    }));
  const total = grups.reduce((suma, g) => suma + g.regidories, 0);
  const sala = hemicycle(total, { width: 360 });
  if (sala.seats.length === 0) return "";
  return `<svg class="ens-hemicicle" viewBox="0 0 ${sala.width} ${sala.height}" width="${sala.width}" height="${sala.height}" role="img" aria-label="${escapa(`${d.nom}: ${xifra(total)} escons`)}">
    ${seientsHemicicle(sala.seats, grups, total)}</svg>`;
}

/**
 * La imatge d'una diputació o d'un consell comarcal.
 *
 * Reaprofita la plantilla del territori —la de les comarques i l'AMB— per no
 * tocar el document de Chrome: canviar-lo canviaria el resum de les deu mil
 * imatges que ja hi ha i les tornaria a dibuixar totes. La figura és
 * l'hemicicle; si la font no dona prou per fer-lo, Catalunya amb els
 * municipis de l'ens encesos.
 *
 * La frase diu qui té la presidència i quin partit hi té més escons, i res
 * més: cap valoració. Si no se sap qui la presideix (Barcelona i Girona no
 * publiquen els noms al registre de plens), se'n diu només la composició.
 */
export function feinaEns(d: DadesEns): Feina {
  const quants = d.municipis.length;
  const escons = d.seients > 0 ? d.seients : d.composicio.reduce((suma, g) => suma + g.seients, 0);
  // El partit amb més escons, si se sap: la fila «sense partit conegut» va
  // al final de la composició i no és cap partit que pugui tenir-ne més.
  // Si dos partits empaten al capdamunt, la frase ho diu: triar-ne un seria
  // l'ordre alfabètic fent de resultat (Osona, ERC 11 i Junts 11).
  const coneguts = d.composicio.filter((g) => g.seients > 0 && g.partit !== SENSE_PARTIT);
  const maxim = coneguts.reduce((m, g) => Math.max(m, g.seients), 0);
  const capdamunt = coneguts.filter((g) => g.seients === maxim);
  const primer = capdamunt.length === 1 ? capdamunt[0]! : null;
  const pres = d.presidencia;
  const trossos: string[] = [];
  if (pres) {
    trossos.push(`<b>${escapa(nomLlegible(pres.nom))}</b> en té la presidència${pres.partit ? ` (${escapa(pres.partit)})` : ""}.`);
  }
  if (primer && escons > 0) {
    trossos.push(`${pres ? "" : "<b>"}${escapa(primer.partit)}${pres ? "" : "</b>"} hi té ${xifra(primer.seients)} dels ${xifra(escons)} escons.`);
  } else if (capdamunt.length > 1 && escons > 0) {
    const noms = capdamunt.map((g) => escapa(g.partit));
    const llista = `${noms.slice(0, -1).join(", ")} i ${noms[noms.length - 1]}`;
    trossos.push(`${llista} hi empaten amb ${xifra(maxim)} dels ${xifra(escons)} escons.`);
  }
  const frase = trossos.length > 0
    ? trossos.join(" ")
    : "Qui hi seu, com hi arriba i què gasta, amb la font de cada xifra.";
  const taques: TacaComarca[] = d.municipis.map((m) => ({
    slug: m.slug, name: m.nom, mayorName: null, mayorSigles: null, mayorBrandId: null,
  }));
  return {
    fitxer: d.tipus === "diputacio" ? FITXER_OG.diputacio(d.slug) : FITXER_OG.consell(d.slug),
    format: "png",
    dades: {
      tipus: "territori",
      ambit: d.tipus === "diputacio" ? "Diputació" : "Consell comarcal",
      nom: d.nom,
      // Sense escons coneguts no es diu «0 escons»: un buit és un buit.
      xifres: `${xifra(quants)} ${quants === 1 ? "municipi" : "municipis"}${escons > 0 ? ` · ${xifra(escons)} escons` : ""}`,
      frase,
      banda: d.tipus === "diputacio" ? COLORS_BANDA.lavanda : COLORS_BANDA.presec,
      figura: hemicicleEns(d) || senyalTerritori(taques),
    },
  };
}

/** La imatge de l'índex `ens/`: quantes diputacions i quants consells hi ha. */
export function feinaIndexEns(llista: readonly Pick<DadesEns, "tipus">[]): Feina {
  const diputacions = llista.filter((e) => e.tipus === "diputacio").length;
  const consells = llista.filter((e) => e.tipus === "consell").length;
  return {
    fitxer: FITXER_OG.ens(),
    format: "png",
    dades: {
      tipus: "global",
      titol: "Diputacions i consells comarcals",
      sota: "Els ens que decideixen per sobre de l'ajuntament",
      figura: catalunya(280, "felic", null),
      frase: `<b>${xifra(diputacions)} ${diputacions === 1 ? "diputació" : "diputacions"}</b> i ${xifra(consells)} ${
        consells === 1 ? "consell comarcal" : "consells comarcals"
      }: qui hi seu, com hi arriba i què gasta cadascun.`,
      banda: COLORS_BANDA.menta,
    },
  };
}

/** El mínim que cal d'un partit per fer-ne la imatge: el que porta `PartitData`. */
export type PartitOg = {
  id: string; sigles: string; name: string; color: string;
  alcaldies: number; regidories: number; poblacioGovernada: number;
};

/** La imatge d'un partit: les sigles amb el seu color i les tres xifres de la pàgina. */
export function feinaPartit(p: PartitOg): Feina {
  const color = /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : "#8b8b8b";
  const { fons, tinta } = sobreColor(color);
  return {
    fitxer: FITXER_OG.partit(p.id),
    format: "png",
    dades: {
      tipus: "partit",
      sigles: p.sigles,
      nom: p.name,
      fons,
      tinta,
      frase: `<b>${xifra(p.alcaldies)} ${p.alcaldies === 1 ? "alcaldia" : "alcaldies"}</b> · ${xifra(p.regidories)} regidories · ${xifra(p.poblacioGovernada)} habitants governats`,
      banda: fons,
    },
  };
}

// ---------------------------------------------------------------- globals

/** Les xifres que les pàgines globals diuen al titular, un cop per publicació. */
export type XifresGlobals = {
  municipis: number;
  comarques: number;
  partits: number;
  regidories: number;
  habitants: number;
  /** Conjunts de preguntes en esborrany. */
  preguntes: number;
};

/**
 * Les imatges de les pàgines que no són de cap lloc: la portada de
 * l'Observatori, els 947, el mapa, els rànquings, el comparador, les dades,
 * les preguntes i la trajectòria. Cadascuna amb el seu títol, la mascota (per
 * a les eines) o el senyal (per a les del territori) i una xifra.
 */
export function feinesGlobals(x: XifresGlobals): Feina[] {
  const senyal = catalunya(280, "felic", null);
  const paperetaFelic = papereta(280);
  const municipis = `<b>${xifra(x.municipis)} municipis</b>`;
  const globals: { nom: string; titol: string; sota: string; figura: string; frase: string }[] = [
    { nom: "observatori", titol: "Qui mana al teu poble", sota: "L'Observatori municipal de quivoto", figura: paperetaFelic,
      frase: `${municipis}, ${xifra(x.comarques)} comarques i ${xifra(x.partits)} partits: resultats, comptes i actes del ple des del 1979.` },
    { nom: "els947", titol: `Els ${xifra(x.municipis)} municipis, un per un`, sota: "Qui hi mana, els comptes i les actes del ple", figura: senyal,
      frase: `<b>${xifra(x.regidories)} regidories</b> i ${xifra(x.habitants)} habitants: cada municipi porta a la seva fitxa.` },
    { nom: "mapa", titol: `El mapa dels ${xifra(x.municipis)}`, sota: "Pintat per qui mana, pels pactes i pels comptes", figura: senyal,
      frase: `${municipis} amb els seus límits: cada terme porta a la fitxa del seu poble.` },
    { nom: "ranquings", titol: "Rànquings municipals", sota: "Qui és a dalt i qui a baix de cada indicador", figura: paperetaFelic,
      frase: `${municipis} ordenats per deute, IBI, residus, habitatge i més, amb l'any i la font de cada xifra.` },
    { nom: "comparador", titol: "Comparador de municipis", sota: "De dos a quatre, costat a costat", figura: paperetaFelic,
      frase: `Tria fins a quatre dels ${municipis} i compara'n el govern, el deute, l'IBI i la resta d'indicadors.` },
    { nom: "dades", titol: "Dades obertes", sota: "CSV i JSON, amb la font de cada camp", figura: paperetaFelic,
      frase: `Els indicadors dels ${municipis} per baixar i reutilitzar, amb llicència <b>CC BY 4.0</b>.` },
    { nom: "preguntes", titol: "Preguntes per municipi", sota: "En esborrany, amb l'evidència de cadascuna", figura: papereta(280, "pregunta"),
      frase: `<b>${xifra(x.preguntes)} municipis</b> amb preguntes que es poden respondre amb les actes del ple.` },
    { nom: "trajectoria", titol: "Quant duren els que manen", sota: "Mandats, relleus i salts des del 1979", figura: senyal,
      frase: `Les alcaldies dels ${municipis} des del 1979: quants mandats duren i qui fa el salt a un altre càrrec.` },
  ];
  return globals.map((g) => ({
    fitxer: FITXER_OG.global(g.nom),
    format: "png",
    dades: { tipus: "global", titol: g.titol, sota: g.sota, figura: g.figura, frase: g.frase, banda: COLORS_BANDA.menta },
  }));
}

/**
 * Genera les imatges socials a `<outDir>/` seguint `FITXER_OG`.
 *
 * Les dels municipis i les de les seves persones es fan per a la tanda
 * (`slugs`); sense `slugs`, per als 947. Les de les comarques, els partits i
 * les pàgines globals es fan sempre, perquè canvien amb qualsevol municipi.
 * Retorna quantes n'ha escrit i quant ocupen, per poder-ho dir al registre.
 *
 * Les diputacions i els consells (`ens`) les rep ja carregades de la
 * publicació, que és qui en té la llista: tornar-la a llegir aquí voldria dir
 * lligar un altre cop membres, sous i finances de quaranta-quatre ens. Sense
 * llista (J38 no ha corregut), no se'n fa cap, ni la de l'índex.
 */
export async function writeOgImages(
  db: Db,
  outDir: string,
  slugs?: readonly string[],
  ens: readonly DadesEns[] = [],
): Promise<{ images: number; bytes: number }> {
  const municipis = await loadOgMunicipis(db, slugs);
  // El sexe del registre de candidatures, per escriure «alcaldessa» quan la
  // seu no ho diu: una consulta per a totes les alcaldies de la tanda.
  const sexes = municipis.length > 0 ? await sexesPerNom(db) : new Map<string, "H" | "D">();
  const feines: Feina[] = [];
  for (const m of municipis) feines.push(feinaMunicipi(m), ...feinesPersones(m, sexes));

  // Les comarques, l'AMB i els partits, amb els mateixos carregadors que les
  // pàgines: la xifra de la imatge ha de ser la de la pàgina que ensenya.
  const comarques = await loadComarques(db);
  for (const c of comarques) feines.push(feinaTerritori(c, "comarca"));
  const amb = await loadAmb(db, comarques);
  if (amb) feines.push(feinaTerritori({ ...amb, slug: "amb", name: amb.nom }, "amb"));
  const partits = await loadPartits(db);
  for (const p of partits) feines.push(feinaPartit(p));
  for (const e of ens) feines.push(feinaEns(e));
  if (ens.length > 0) feines.push(feinaIndexEns(ens));
  feines.push(...feinesGlobals(await loadXifresGlobals(db, comarques.length, partits.length)));

  const fet = await generaImatges(feines, outDir);
  return { images: fet.images, bytes: fet.bytes };
}

/** Les xifres de les pàgines globals: dues consultes lleugeres i els fitxers de preguntes. */
async function loadXifresGlobals(db: Db, comarques: number, partits: number): Promise<XifresGlobals> {
  const files = await db.select({ population: municipalities.population }).from(municipalities);
  const [regidories] = await db.select({ n: count() }).from(councillorMandates);
  return {
    municipis: files.length,
    comarques,
    partits,
    regidories: regidories?.n ?? 0,
    habitants: files.reduce((suma, f) => suma + (f.population ?? 0), 0),
    preguntes: carregaPreguntes().length,
  };
}
