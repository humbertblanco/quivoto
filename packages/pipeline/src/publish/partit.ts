import { eq, sql, type SQLWrapper } from "drizzle-orm";
import {
  candidatures, councillorMandates, electionResults, municipalities, municipalityMetrics,
  people, type Db,
} from "@quivoto/db";
import { BRANDS_BY_ID, PARTY_BRANDS, siglesFamily } from "@quivoto/shared-schemas/brands";
import { absoluteMajority } from "@quivoto/shared-schemas/seats";
import { buildPeerGroups, medianOf } from "../derive/peers";
import { nomLlegible, normalizePersonName, slugify } from "../lib/text";
import { INDEXABLE, SITE } from "./config";
import { sobreColor, tintaSobre as tintaDeContrast } from "./contrast";
import { RADIOGRAFIA_CSS } from "./estil";
import { serieTemporal } from "./grafics";
import { geometria } from "./mapa-catalunya";
import { assignaSlugs, clau } from "./candidatura";
import { adrecesRegidors } from "./regidor";
import { capcalera } from "./capcalera";
import { cercador } from "./cercador";
import { peu } from "./peu";

/**
 * La pàgina d'**una marca a tot Catalunya**.
 *
 * L'Observatori ja sap explicar un municipi (la radiografia), una comarca i una
 * candidatura a un poble. El que no sabia dir és el subjecte del qual tothom
 * parla als titulars —«ERC perd pobles», «el PSC recupera el territori»— i que
 * no és cap d'aquells tres: és la marca sumada als 947 ajuntaments. Sense
 * aquesta pàgina, la xifra que surt a la premsa cada nit electoral no es podia
 * comprovar enlloc del web, tot i que la teníem sencera a la base.
 *
 * N'hi ha una per marca de `PARTY_BRANDS` amb alguna alcaldia o alguna
 * regidoria **al mandat 2023-2027**, i cap per a «local». «Local» no és un
 * partit: és el calaix de les llistes que no reconeixem, 226 marques que no
 * tenen res a veure les unes amb les altres, i fer-ne una pàgina diria que
 * existeix un «partit de les llistes locals» que no existeix enlloc. És la
 * mateixa raó per la qual el mapa dels 947 no els dona cap color.
 *
 * ## Una sola regla per a totes les xifres
 *
 * Qui compta com a d'aquesta marca es decideix a `marcaDe()` i **a cap altre
 * lloc**: les alcaldies, les regidories, els vots i el mapa surten tots
 * d'aquella funció. Amb dues regles —una per a les alcaldies i una per als
 * regidors— la pàgina podia dir que un partit té l'alcaldia d'un poble on no
 * hi té cap regidor, que és una contradicció que el lector no pot resoldre i
 * nosaltres sí.
 *
 * ## Les tres coses que hi ha a sobre de la xifra
 *
 * Un partit no és una taca al mapa. A sobre del recompte hi ha, per aquest
 * ordre, **qui** governa (les cares de les alcaldies, amb la regla dura que el
 * nom i el retrat han de sortir de la mateixa persona: vegeu `PartitMunicipi`),
 * **què cobren** aquelles alcaldies (`renderRetribucions`, on la xifra del
 * Ministeri no es pot anomenar sou i la comparació és sempre dins del mateix
 * tram de població) i **on** governa (`renderRenda`, que és context i no un
 * resultat del partit). Cadascun d'aquests blocs desapareix sencer quan la font
 * no hi arriba: la pàgina no ensenya mai una casella buida ni un zero que en
 * realitat vol dir «no ho sabem».
 */

const ELECCIO = "M20231";
/** El mandat que va obrir aquella elecció, tal com l'escriu la taula d'alcaldes. */
const MANDAT_ARA = "2023-2027";
const ANY_ARA = 2023;

/**
 * Quant s'han de semblar les dues fonts perquè dibuixem la sèrie llarga.
 *
 * Les sèries des del 1979 vénen de dos conjunts que no classifiquen igual que
 * el recompte del 2023: la de regidories agrupa les marques comarcals dins de
 * «local», i la d'alcaldies només sap el nom del partit tal com el va escriure
 * cada ajuntament. Es comprova contra l'any que sabem de cert —el 2023— i, si
 * la sèrie no hi arriba, no es dibuixa: una corba que comença en fals és pitjor
 * que no tenir-ne cap, perquè sembla una davallada quan és un forat de dades.
 *
 * El llindar és 0,7 i no 0,8 perquè amb 0,8 el **PSC** en quedava fora: la
 * sèrie de l'AOC li'n compta 1.156 regidories el 2023 i nosaltres 1.463 —un
 * 79 %—, perquè les seves coalicions locals («UA-PSC-CP» i companyia) hi entren
 * com a llista local. La diferència és sistemàtica i la forma de la corba és
 * seva. Els Comuns, que sí que s'han d'amagar, hi són al 20 % (48 de 244), i
 * les federacions comarcals a zero: entre el 20 % i el 79 % hi cap qualsevol
 * llindar, i el que no hi cap és deixar fora la sèrie més llarga que tenim.
 */
const MINIM_ACORD = 0.7;

/**
 * Les dues fonts diuen prou el mateix?
 *
 * A banda de la proporció hi ha la tolerància d'una unitat, que és per a les
 * marques petites: Aliança Catalana té dues alcaldies i l'historial n'hi troba
 * una, i un 50 % de diferència aquí no vol dir que la sèrie sigui d'una altra
 * força —vol dir que un ajuntament va escriure les sigles d'una altra manera.
 */
const acorden = (troba: number, real: number): boolean =>
  real === 0 || troba >= real * MINIM_ACORD || real - troba <= 1;

// ------------------------------------------------------------- el llinatge

/**
 * Un pas del llinatge: una altra marca, la data i què va passar.
 *
 * `sentit` és des d'on es llegeix la pàgina on surt: «ve» és una força
 * anterior i «va» una de posterior.
 */
type PasLlinatge = {
  /** L'`id` de l'altra marca. Pot no tenir pàgina; llavors no s'hi enllaça. */
  marca: string;
  sentit: "ve" | "va";
  any: number;
  que: string;
};

/**
 * D'on ve i cap a on va cada marca, amb la data de cada pas.
 *
 * Aquí hi ha una decisió i val la pena escriure-la sencera. **CiU, el PDeCAT i
 * Junts són tres marques separades a tot l'Observatori i ho continuen sent.**
 * Políticament hi ha una filiació que tothom reconeix; jurídicament no són la
 * mateixa persona: Convergència i Unió es va dissoldre el juny del 2015, el
 * PDeCAT es va constituir el 2016 i Junts el 2020, i Unió va marxar per un
 * altre camí fins a liquidar-se. Fusionar-les en una sola corba afirmaria una
 * continuïtat que la font no diu enlloc, i el projecte té per regla no afirmar
 * el que la font no diu. El que sí que és fals és el que passava fins ara:
 * Junts semblava néixer del no-res i CiU desaparèixer sense deixar rastre.
 * Aquesta taula ho explica sense ajuntar cap xifra.
 *
 * `desDe` i `finsA` són l'altra meitat de la feina: diuen a quina convocatòria
 * comença i s'acaba la vida de la marca, i les corbes es tallen allà. Sense
 * això, la sèrie de **Junts** arrencava el 2003, quatre eleccions abans que el
 * partit existís, perquè la taula de famílies de sigles llegeix el testimoni
 * «junts» allà on surti: les cinc alcaldies que la sèrie li dona el 2015 són
 * «ERC-JxC-AM» de Calaf, «Junts-ERC» de Fonollosa, «JxC - AM» de Cabanelles,
 * «JUNTS FEM CAMPR» de Camprodon i «Junts - AM» de la Torre de l'Espanyol
 * —llistes d'Acord Municipal i llistes locals, cap d'elles el partit.
 *
 * CiU no té pàgina pròpia avui —no li queda cap alcaldia ni cap regidoria del
 * 2023— i per això la seva entrada aquí només serveix perquè les de Junts i el
 * PDeCAT la puguin anomenar; el dia que una llista de CiU torni a treure un
 * regidor, la seva pàgina ja sabrà on s'acaba la corba.
 *
 * Cada data està comprovada i no n'hi ha cap que no sigui pública i indiscutible.
 * Els casos dels quals no n'estem segurs no hi són: ICV i els comuns, per
 * exemple, no hi surten perquè `PARTY_BRANDS` no té cap marca «icv» i qualsevol
 * frase que hi escriguéssim no tindria cap xifra nostra al darrere.
 *
 * Fonts (consultades el 30-08-2026):
 * · Trencament de la federació el 18-06-2015, anunciat per Josep Rull:
 *   https://www.vilaweb.cat/noticia/4384316/20150619/trencament-convergencia-unio-afectara-totes-institucions.html
 *   i https://ca.wikipedia.org/wiki/Convergència_i_Unió
 * · Congrés fundacional del PDeCAT, 8-10 de juliol del 2016:
 *   https://www.enciclopedia.cat/gran-enciclopedia-catalana/partit-democrata-europeu-catala
 * · Congrés constituent de Junts per Catalunya, 25 de juliol del 2020:
 *   https://ca.wikipedia.org/wiki/Junts_per_Catalunya_(partit_polític)
 * · Liquidació d'Unió, decretada el 24-03-2017:
 *   https://ca.wikipedia.org/wiki/Unió_Democràtica_de_Catalunya
 */
type Llinatge = {
  /** La primera convocatòria municipal en què la marca ja existia com a tal. */
  desDe?: number;
  /** L'última, quan la marca ja no existeix. */
  finsA?: number;
  /** Per què la corba comença o s'acaba on comença o s'acaba. */
  perque: string;
  passos: readonly PasLlinatge[];
};

const LLINATGE: Readonly<Record<string, Llinatge>> = {
  ciu: {
    // Les municipals del 2015 van ser el 24 de maig i la federació es va
    // trencar el 18 de juny: aquella convocatòria encara la va disputar CiU.
    finsA: 2015,
    perque:
      "La corba s'acaba el 2015 perquè la federació es va dissoldre el 18 de juny d'aquell any, " +
      "tres setmanes després de les municipals del 24 de maig. Del 2019 ençà, Convergència i Unió " +
      "no s'ha presentat enlloc.",
    passos: [
      {
        marca: "pdecat",
        sentit: "va",
        any: 2016,
        que:
          "El 18 de juny del 2015, Convergència va anunciar el final de la federació amb Unió. " +
          "El congrés fundacional del Partit Demòcrata Europeu Català es va fer del 8 al 10 de " +
          "juliol del 2016, com a partit successor de Convergència.",
      },
      {
        marca: "junts",
        sentit: "va",
        any: 2020,
        que:
          "El 25 de juliol del 2020, un cop trencada la negociació amb el PDeCAT, es va constituir " +
          "Junts per Catalunya com a partit.",
      },
    ],
  },
  pdecat: {
    // Es funda el juliol del 2016: les primeres municipals seves són les del 2019.
    desDe: 2019,
    perque:
      "La corba comença el 2019 perquè el partit es va constituir el juliol del 2016 i les del 2019 " +
      "van ser les seves primeres municipals.",
    passos: [
      {
        marca: "ciu",
        sentit: "ve",
        any: 2016,
        que:
          "Ve de Convergència, que era la meitat gran de Convergència i Unió fins que la federació " +
          "es va dissoldre el 18 de juny del 2015. El PDeCAT es va fundar del 8 al 10 de juliol del 2016.",
      },
      {
        marca: "junts",
        sentit: "va",
        any: 2020,
        que:
          "El juliol del 2020 se'n va separar Junts per Catalunya, que des d'aleshores és un partit " +
          "a part i es presenta contra el PDeCAT allà on tots dos hi són.",
      },
    ],
  },
  junts: {
    // El partit és del 2020, però la marca «Junts per Catalunya» ja té codi
    // d'agrupació propi a les municipals del 2019 (20191031), que és la
    // primera convocatòria en què la font la sap distingir de ningú altre.
    desDe: 2019,
    perque:
      "La corba comença el 2019 i no el 1979 perquè abans no hi havia cap Junts: el partit es va " +
      "constituir el 25 de juliol del 2020 i les municipals del 2019 són les primeres en què la " +
      "font electoral li dona una agrupació pròpia. El que la sèrie li comptava abans d'aquell any " +
      "eren llistes locals i d'Acord Municipal que porten la paraula «Junts» al nom, com «Junts-ERC» " +
      "de Fonollosa o «JUNTS FEM CAMPR» de Camprodon, i no tenen res a veure amb aquest partit.",
    passos: [
      {
        marca: "ciu",
        sentit: "ve",
        any: 2015,
        que:
          "El llinatge polític passa per Convergència, que fins al 18 de juny del 2015 formava " +
          "federació amb Unió sota el nom de Convergència i Unió.",
      },
      {
        marca: "pdecat",
        sentit: "ve",
        any: 2020,
        que:
          "Del 2016 al 2020, aquell espai era el PDeCAT. Junts se'n va separar amb el congrés " +
          "constituent del 25 de juliol del 2020, i des d'aleshores són dos partits diferents.",
      },
    ],
  },
};

/** Els anys en què la marca existia. Sense entrada al llinatge, tots. */
const dinsDeLaVida = (id: string, year: number): boolean => {
  const vida = LLINATGE[id];
  if (!vida) return true;
  return (
    (vida.desDe === undefined || year >= vida.desDe) && (vida.finsA === undefined || year <= vida.finsA)
  );
};

// ------------------------------------------------------------------- tipus

/** Un municipi on la marca té representació. */
export type PartitMunicipi = {
  slug: string;
  name: string;
  comarca: string | null;
  population: number;
  /** Com s'hi diu la llista en aquell poble: «PSC-CP», «ERC-AM», «JxG»… */
  sigles: string;
  /** Slug de la seva candidatura dins del municipi, per anar a la fitxa. */
  candidatura: string | null;
  seats: number;
  totalSeats: number;
  alcaldia: boolean;
  mayorName: string | null;
  /**
   * El retrat de qui hi mana, a 160 px, tal com el publica el seu ajuntament.
   *
   * Hi és quan **les dues fonts anomenen la mateixa persona**: la composició del
   * ple de la Generalitat, que és d'on surt `mayorName` i d'on surt que aquesta
   * alcaldia és d'aquesta marca, i la llista de càrrecs de la seu electrònica,
   * que és d'on surt la cara. Als 947 municipis hi ha 464 fitxes de seu-e, 455
   * hi marquen algú com a alcaldia i 419 lliguen pel nom amb la font oficial;
   * en 19 municipis les dues fonts diuen noms diferents, perquè hi ha hagut
   * relleu i una de les dues encara no ho sap.
   *
   * En aquells 19 no s'hi posa cara. Publicar el nom d'una persona amb el
   * retrat d'una altra és l'error que aquesta pàgina no es pot permetre, i el
   * preu de la prudència és petit: 293 alcaldies amb cara en comptes de 326.
   */
  mayorPhoto: string | null;
  /** L'adreça de la seva fitxa de persona dins del municipi, quan en té. */
  mayorSlug: string | null;
  /** L'alcaldia surt d'una llista que tota sola ja té la majoria absoluta. */
  majoria: boolean;
};

/**
 * El que consta que cobra l'alcaldia d'aquesta marca, dins d'un tram de mida.
 *
 * El tram és obligatori i no és cap escrúpol: la retribució d'una alcaldia la
 * marca la mida del municipi molt més que el color del partit, i una marca que
 * governa pobles de cinc-cents habitants sortiria «barata» al costat d'una que
 * governa ciutats de cent mil encara que totes dues paguessin exactament el que
 * toca. Els trams són els de la LOREG —els mateixos que decideixen quants
 * regidors té un ple— i els posa `buildPeerGroups()`, que ja els fa servir tota
 * la resta del web.
 */
export type PartitTramRetribucio = {
  tram: string;
  /** Alcaldies d'aquesta marca en aquest tram. */
  alcaldies: number;
  /** Les que consten a l'inventari del Ministeri. */
  ambImport: number;
  mediana: number | null;
  /** La mediana de **totes** les alcaldies del tram amb import comunicat. */
  medianaTram: number | null;
  alcaldiesTram: number;
};

/**
 * Les retribucions de les alcaldies d'aquesta marca.
 *
 * **L'import no és un sou i no se n'hi pot dir.** L'inventari del Ministeri
 * suma, en una sola xifra per alcaldia, la retribució del càrrec i les
 * assistències a plens i comissions, i les dues coses no són el mateix: de les
 * 866 alcaldies que hi consten, 659 tenen dedicació (exclusiva o parcial) i
 * cobren un sou de debò, 149 no en tenen cap i el que hi consta són
 * assistències que es cobren per sessió, i 58 hi consten amb zero euros.
 *
 * Els 81 municipis que no hi són **no són municipis on l'alcaldia no cobri**:
 * són municipis que no ho han comunicat al Ministeri. La pàgina ho diu amb
 * aquestes paraules i mai amb un zero, perquè un zero al costat d'un nom és una
 * acusació.
 */
export type PartitRetribucions = {
  /** L'exercici de l'inventari. */
  any: number | null;
  /** Alcaldies d'aquesta marca. */
  alcaldies: number;
  ambImport: number;
  /** Alcaldies seves que no consten a l'inventari: no ho han comunicat. */
  senseComunicar: number;
  /** De les que hi consten: quantes tenen dedicació exclusiva o parcial. */
  ambDedicacio: number;
  /** Quantes hi consten només amb assistències —«sense dedicació» amb import. */
  nomesAssistencies: number;
  /** Quantes hi consten amb zero euros. */
  senseCapImport: number;
  mediana: number | null;
  media: number | null;
  /** La mediana de les 866 alcaldies de Catalunya amb import comunicat. */
  medianaCatalunya: number | null;
  /** Municipis catalans amb dada a l'inventari, i de quants. */
  municipisAmbDada: number;
  municipisTotals: number;
  /** La comparació honesta: dins de cada tram de població. */
  trams: PartitTramRetribucio[];
};

/**
 * La renda dels municipis on mana aquesta marca.
 *
 * És **context, no resultat**: un ajuntament no decideix quant guanya la gent
 * que hi viu, i la sèrie de l'INE s'acaba justament l'any en què es va
 * constituir aquest mandat. Les dues coses es diuen a la pàgina, i sense
 * elles aquest bloc no s'hauria d'escriure.
 *
 * La mediana és **per municipi i no per persona**: diu com és el poble típic on
 * governa la marca, no quant guanya de mitjana la gent que hi viu. Barrejar-ho
 * faria que una marca amb l'alcaldia d'una capital i vint pobles petits sortís
 * amb la renda de la capital.
 */
export type PartitRenda = {
  any: number;
  /** Alcaldies d'aquesta marca. */
  municipis: number;
  /** Les que tenen xifra de renda: l'INE tapa la dels més petits. */
  ambDada: number;
  mediana: number | null;
  /** La mediana dels municipis de Catalunya amb dada, per poder-s'hi comparar. */
  medianaCatalunya: number | null;
  municipisCatalunyaAmbDada: number;
  /** Els dos extrems de la seva llista, que diuen més que la mediana sola. */
  mesBaixa: { name: string; slug: string; valor: number } | null;
  mesAlta: { name: string; slug: string; valor: number } | null;
};

/** Una convocatòria de la sèrie llarga. `null` vol dir «no ho sabem», no «zero». */
export type PartitEleccio = {
  year: number;
  regidories: number | null;
  /** Totes les regidories de Catalunya aquell any: el denominador honest. */
  regidoriesCatalunya: number;
  /** Municipis on va ser la força més votada. */
  guanyats: number | null;
  alcaldies: number | null;
  /** De quants municipis tenim la sèrie aquell any. */
  municipisAmbSerie: number;
};

/**
 * Un punt de la sèrie de **població governada**: quanta gent vivia als municipis
 * on la marca tenia l'alcaldia, l'any d'aquella elecció.
 *
 * La població és la del padró **d'aquell mateix any**, i no la d'avui. Fer-ho
 * amb la d'avui per a tots els anys és la mentida còmoda d'aquesta gràfica: el
 * padró de tot Catalunya ha passat de 7.508.106 empadronats el 2015 a 8.146.265
 * el 2025 (+8,5 %), de manera que cada mandat vell sortiria inflat amb gent que
 * encara no hi vivia, i la corba pujaria sola encara que la marca no hagués
 * guanyat ni perdut cap ajuntament.
 */
export type PartitPoblacio = {
  year: number;
  /** Les alcaldies d'aquell mandat que sumen aquests habitants. */
  alcaldies: number;
  /** Habitants d'aquells municipis segons el padró d'aquell any. */
  habitants: number;
  /** Tot Catalunya al padró del mateix any: el denominador honest. */
  catalunya: number;
};

export type PartitData = {
  id: string;
  /** Les sigles curtes, que són les que caben a un titular i a una capçalera. */
  sigles: string;
  name: string;
  kind: string;
  color: string;
  /** Marca de la qual prové, quan hi ha hagut escissió o refundació. */
  lineage: string | null;
  lineageSigles: string | null;

  alcaldies: number;
  regidories: number;
  /** Municipis on té alguna regidoria. */
  municipis: number;
  /** Comarques on té alguna alcaldia. */
  comarques: number;
  /** Alcaldies que no van necessitar cap pacte. */
  majories: number;

  /** Habitants dels municipis on té l'alcaldia. */
  poblacioGovernada: number;
  poblacioCatalunya: number;
  /** L'any de padró de les dues xifres de dalt, que no és el de la sèrie. */
  poblacioAny: number | null;
  /** Vots del 2023 a tot Catalunya. */
  vots: number;
  votsCatalunya: number;

  llocs: PartitMunicipi[];
  serie: PartitEleccio[];
  /**
   * La població governada convocatòria a convocatòria, tan enrere com arriba el
   * padró que tenim i ni un any més. Buida quan no n'hi ha prou per a una línia.
   */
  poblacioSerie: PartitPoblacio[];
  serieRegidoriesFiable: boolean;
  serieAlcaldiesFiable: boolean;
  /** El que cada sèrie llarga troba al 2023, per poder dir per què no la dibuixem. */
  serieRegidories2023: number;
  serieAlcaldies2023: number;

  /** Retribucions de les seves alcaldies. `null` quan no en consta cap. */
  retribucions: PartitRetribucions | null;
  /** La renda dels pobles que governa. `null` quan la font encara no hi és. */
  renda: PartitRenda | null;

  /** Les altres marques amb pàgina, per poder-hi saltar sense tornar enrere. */
  altres: { id: string; sigles: string; color: string; alcaldies: number; regidories: number }[];
};

// ------------------------------------------------------------------- format

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const number = (n: number): string => n.toLocaleString("ca-ES");
const percent = (n: number): string => `${n.toFixed(1).replace(".", ",")} %`;
const plural = (n: number, un: string, molts: string): string => (n === 1 ? un : molts);

/**
 * Les sigles curtes de cada marca. Les de `PARTY_BRANDS` són les oficials
 * senceres —«Esquerra Republicana de Catalunya»— i en una capçalera de 3,4 rem
 * ocupen tres línies i deixen d'assemblar-se a un logotip.
 */
const SIGLES_CURTES: Record<string, string> = {
  erc: "ERC", junts: "Junts", psc: "PSC", cup: "CUP", comuns: "Comuns",
  pp: "PP", vox: "Vox", cs: "Ciutadans", pdecat: "PDeCAT",
  aliancacat: "Aliança Catalana", ciu: "CiU", podem: "Podem",
  fic: "FIC", te: "Tots per l'Empordà", idselva: "Independents de la Selva",
  idc: "Independents de Catalunya", cda: "CDA",
};

/**
 * Colors de dades. Són els de `PARTY_BRANDS` excepte el groc pur de la CUP,
 * que damunt del paper cru no es veu; és el mateix fosquim que ja fan servir
 * el mapa dels 947 i les comarques, i ha de continuar sent el mateix.
 */
const COLORS: Record<string, string> = { cup: "#d8d000" };

const NOM_TIPUS: Record<string, string> = {
  state: "partit d'àmbit estatal",
  catalan: "partit d'àmbit català",
  regional: "federació d'àmbit comarcal",
  local: "llista local o d'electors",
};

const siglesDe = (id: string): string => SIGLES_CURTES[id] ?? BRANDS_BY_ID.get(id)?.name ?? id;
const colorDe = (id: string): string => COLORS[id] ?? BRANDS_BY_ID.get(id)?.color ?? "#8b8b8b";

/**
 * Cap color que no sigui un hexadecimal de sis xifres no entra a la pàgina: va
 * dins d'un atribut `style` i un valor amb un punt i coma en podria sortir.
 */
const colorSegur = (color: string): string => (/^#[0-9a-f]{6}$/i.test(color) ? color : "#8b8b8b");

/** Quina tinta es llegeix damunt del color de la marca. El càlcul és a `contrast.ts`. */
export const tintaSobre = (color: string): string => tintaDeContrast(colorSegur(color));

// --------------------------------------------------------------- fragments

/**
 * El mapa dels 947 amb els seus municipis encesos.
 *
 * No es crida `renderMapaCatalunya()` perquè aquella funció no és una peça sinó
 * una **pàgina sencera** —capçalera, cercador, tries de capa i peu— i aquí en
 * caldria només el dibuix. El que sí que es reaprofita és el que costa de tenir:
 * `geometria`, els límits municipals reparats que aquell mòdul exporta. Si un
 * dia el mapa se separa de la seva pàgina, aquesta funció ha de desaparèixer.
 *
 * Hi ha tres estats i no dos: on té l'alcaldia, on hi és sense manar-hi i on no
 * hi és. Amb dos, un poble on la marca té sis regidors de tretze es pintaria
 * igual que un on no s'hi ha presentat mai, i això no és apagat: és fals.
 *
 * Només els municipis encesos són clicables. Els altres no porten enlloc que
 * tingui a veure amb aquesta pàgina, i 947 enllaços perquè 700 no diguin res
 * és el que fa que un lector de pantalla trigui un minut a travessar el mapa.
 */
function renderMapa(data: PartitData): string {
  const perSlug = new Map(data.llocs.map((m) => [m.slug, m]));
  const slugs = Object.keys(geometria.municipis).sort();
  const camins = slugs
    .map((slug) => {
      const d = geometria.municipis[slug]!;
      const lloc = perSlug.get(slug);
      // Els apagats van sense classe: són la majoria —de 700 a 940 dels 947
      // segons la marca— i escriure-la a cadascun costava 14 kB per pàgina de
      // dir el que el color per defecte ja diu. L'apagat és l'estat de base
      // del mapa i el CSS ho ha de dir així.
      if (!lloc) return `<path d="${d}"/>`;
      const on = lloc.candidatura
        ? `../../m/${lloc.slug}/${lloc.candidatura}/`
        : `../../m/${lloc.slug}/`;
      const que = lloc.alcaldia
        ? `${lloc.name}: hi té l'alcaldia, amb ${lloc.seats} de ${lloc.totalSeats} ${plural(lloc.totalSeats, "regidoria", "regidories")}`
        : `${lloc.name}: ${lloc.seats} de ${lloc.totalSeats} ${plural(lloc.totalSeats, "regidoria", "regidories")}, sense l'alcaldia`;
      return `<a href="${escape(on)}"><title>${escape(que)}</title><path class="${
        lloc.alcaldia ? "mana" : "hi-es"
      }" d="${d}"/></a>`;
    })
    .join("");

  const senseAlcaldia = data.municipis - data.alcaldies;
  return `<figure class="partit-mapa">
  <svg viewBox="${escape(geometria.viewBox)}" role="img"
    aria-label="Els 947 municipis de Catalunya. ${escape(data.sigles)} té l'alcaldia de ${data.alcaldies}
    i ${senseAlcaldia} més on hi té regidories sense manar-hi.">
    ${camins}
    ${geometria.contorn ? `<path class="contorn" d="${geometria.contorn}"/>` : ""}
  </svg>
  <ul class="partit-clau">
    <li><i class="mana"></i>${data.alcaldies} amb l'alcaldia</li>
    <li><i class="hi-es"></i>${senseAlcaldia} amb regidories i sense alcaldia</li>
    <li><i class="apagat"></i>${slugs.length - data.municipis} on no hi té representació</li>
  </ul>
  <figcaption>Cada taca encesa és clicable i porta a la fitxa d'aquesta marca en aquell poble.
  <b>Un mapa de municipis sobrerepresenta el buit</b>: el Pallars Sobirà hi ocupa molta més taca
  que el Barcelonès i hi viu una fracció de la gent, de manera que la superfície pintada no és
  la gent governada. Aquesta xifra és més avall, en habitants.</figcaption>
</figure>`;
}

/**
 * D'on ve i cap a on va aquesta marca.
 *
 * Sense això, la pàgina de Junts feia l'efecte que el partit havia nascut del
 * no-res i la de CiU que la federació s'havia esfumat sense deixar rastre. Amb
 * això, el lector veu la filiació i la data de cada pas i pot saltar a la
 * pàgina de l'altra marca —**i les xifres continuen separades**, que és
 * exactament el que la font permet afirmar.
 *
 * Només s'hi enllaça quan l'altra marca té pàgina, i en té una si i només si
 * avui li queda alguna alcaldia o alguna regidoria: CiU, per exemple, ja no en
 * té cap i el seu nom hi surt escrit sense enllaç.
 */
function renderLlinatge(data: PartitData): string {
  const vida = LLINATGE[data.id];
  if (!vida) return "";
  const ambPagina = new Set(data.altres.map((a) => a.id));

  const passos = vida.passos
    .map((pas) => {
      const sigles = siglesDe(pas.marca);
      const nom = ambPagina.has(pas.marca)
        ? `<a href="../${escape(pas.marca)}/">${escape(sigles)}</a>`
        : `<b>${escape(sigles)}</b>`;
      return `<li>
      <span class="quan">${pas.any}</span>
      <span class="que"><span class="cap">${pas.sentit === "ve" ? "Ve de" : "En surt"}</span>
      ${nom} · ${escape(pas.que)}</span>
    </li>`;
    })
    .join("");

  return `<aside class="partit-llinatge">
    <h3 class="subtitol">D'on ve i cap a on va</h3>
    <ul>${passos}</ul>
    <p class="nota">${escape(vida.perque)}</p>
    <p class="nota">Continuen sent partits separats a tot l'Observatori, i cap corba d'aquesta
    pàgina no arrossega les xifres de l'altra. Hi ha una filiació política que tothom reconeix i,
    alhora, no són la mateixa persona jurídica: ajuntar-les en una sola sèrie afirmaria una
    continuïtat que la font no diu enlloc.</p>
  </aside>`;
}

/**
 * La població governada, convocatòria a convocatòria.
 *
 * ## Quina població, la de quin any
 *
 * La de **cada any d'elecció**, no la d'avui. La d'avui per a tots els anys és
 * la sortida fàcil i és falsa: el padró de Catalunya ha passat de 7.508.106
 * empadronats el 2015 a 8.146.265 el 2025, un 8,5 % més, i amb la població
 * d'ara cada mandat vell sortiria inflat amb gent que encara no hi vivia.
 *
 * ## Per què no comença el 1979
 *
 * Perquè el padró que tenim no hi arriba. La sèrie de l'Idescat que ingereix
 * `j18-poblacio.ts` demana set anys —2015, 2019 i del 2021 al 2025— i no la
 * sèrie sencera de la font, que va del 1998 ençà. Dels dotze anys d'elecció
 * municipal, doncs, només en tenim padró de tres: 2015, 2019 i 2023, i tots
 * tres cobreixen els 947 municipis. Els anys s'agafen de la intersecció i no
 * escrits a mà: el dia que J18 demani el padró del 1998 ençà, aquesta corba
 * s'allargarà tota sola fins al 1999 sense tocar aquesta funció.
 *
 * Dibuixar la línia des del 1979 amb la població que fos exigiria inventar-se
 * nou punts de dotze. Val més una corba de tres punts que digui quan comença
 * que no pas dotze punts dels quals nou són fets a mà.
 *
 * ## Absoluta o percentatge
 *
 * La corba és l'**absoluta**, i el percentatge de Catalunya va a la columna del
 * costat de la taula. Amb tres punts, una segona corba de tres punts amb la
 * mateixa forma és tinta i no informació: entre el 2015 i el 2023 Catalunya va
 * créixer un 5,3 % (de 7.508.106 a 7.909.125 empadronats) mentre el PSC passava
 * de governar-ne 2.203.671 a 4.634.658 —del 29,4 % al 58,6 %—, de manera que el
 * que mou la línia és el partit i no el denominador. L'absoluta, a més, és la
 * que el lector pot comprovar sumant els municipis de la llista d'aquesta
 * mateixa pàgina; el percentatge, que és el que fa comparable una marca petita
 * amb una de gran, es llegeix a la taula, on és exacte i no s'ha d'estimar a ull.
 */
function renderPoblacioSerie(data: PartitData): string {
  const punts = data.poblacioSerie.filter((p) => dinsDeLaVida(data.id, p.year));
  if (punts.length === 0) return "";
  // Qui no ha governat mai enlloc no té cap població governada, i una línia
  // plana damunt del zero amb una taula de zeros al costat no diu res que la
  // frase de la secció d'alcaldies no digui ja.
  if (punts.every((p) => p.habitants === 0)) return "";

  // La font d'aquesta sèrie és la mateixa que la de les alcaldies —l'historial
  // d'alcaldes— i per tant hereta la mateixa comprovació. Si no sabem dir
  // quantes alcaldies tenia el 2019, tampoc no podem dir quanta gent hi vivia.
  if (!data.serieAlcaldiesFiable) return "";

  // La primera convocatòria que aquesta pàgina dibuixa, no la primera que hi ha
  // hagut: si la marca no existia el 1979, dir «comença el 2015 i no el 1979»
  // seria retreure un forat a una font que no en té cap.
  const primerElectoral = data.serie.filter((p) => dinsDeLaVida(data.id, p.year))[0]?.year ?? null;
  const graella = serieTemporal(
    punts.map((p) => ({ any: p.year, valor: p.habitants })),
    {
      titol: `${data.sigles} · habitants dels municipis que governa`,
      format: (v) => number(Math.round(v)),
      mida: "mitjana",
    },
  );

  const files = punts
    .map(
      (p) => `<tr>
      <th scope="row">${p.year}</th>
      <td class="xifra">${number(p.alcaldies)}</td>
      <td class="xifra">${number(p.habitants)}</td>
      <td class="xifra">${
        p.catalunya === 0 ? "—" : percent((100 * p.habitants) / p.catalunya)
      }</td>
    </tr>`,
    )
    .join("");

  return `<h3 class="subtitol">Població governada, elecció a elecció</h3>
  ${
    graella === ""
      ? `<p class="nota">D'un sol any no en surt cap línia: una tendència d'un punt és una tendència
         inventada. La xifra hi és igualment, a la taula d'aquí sota.</p>`
      : graella
  }
  <div class="taula-ampla">
  <table class="partit-serie">
    <caption class="nomes-lectors">Alcaldies, habitants d'aquells municipis i part de la població de
    Catalunya que governava ${escape(data.sigles)} a cada convocatòria amb padró</caption>
    <thead><tr><th>Elecció</th><th>Alcaldies</th><th>Habitants governats</th>
      <th>De tot Catalunya</th></tr></thead>
    <tbody>${files}</tbody>
  </table>
  </div>
  <p class="nota feble">Cada any amb la població d'aquell any.</p>
  <p class="nota">Els habitants són els del <b>padró de l'any de cada elecció</b>, no els d'avui:
  amb la població d'ara, un mandat de fa deu anys sortiria inflat amb gent que encara no hi vivia
  —Catalunya ha passat de 7.508.106 empadronats el 2015 a 8.146.265 el 2025.${
    primerElectoral === null || primerElectoral >= punts[0]!.year
      ? ""
      : ` Per això aquesta sèrie <b>comença el ${punts[0]!.year} i no el ${primerElectoral}</b>, que
         és on comencen les altres dues d'aquesta pàgina: el padró que hem ingerit de l'Idescat no
         va més enrere, i dibuixar els anys anteriors voldria dir posar-hi una població inventada.`
  }${
    data.poblacioAny === null || data.poblacioAny === punts[punts.length - 1]!.year
      ? ""
      : ` La xifra gran de dalt de tot d'aquesta pàgina és una altra cosa: és el padró del
         ${data.poblacioAny}, el més recent, aplicat als municipis que la marca governa ara.`
  }</p>`;
}

/**
 * Les dues sèries llargues, cadascuna amb el seu eix.
 *
 * Van en dos gràfics i no en un: regidories i alcaldies es compten per milers i
 * per centenars, i posar-les al mateix eix faria que la línia de les alcaldies
 * s'arrapés a zero i semblés que no s'hi mou res. `serieTemporal()` ja hi posa
 * l'eix des de zero i la taula equivalent per a qui no hi veu.
 */
function renderEvolucio(data: PartitData): string {
  // La sèrie es talla a la vida de la marca abans de dibuixar res. Una corba
  // que arrenca quatre eleccions abans que el partit existeixi no és una
  // sèrie curta mal retallada: és una història d'algú altre amb el seu nom.
  const serie = data.serie.filter((p) => dinsDeLaVida(data.id, p.year));
  const anys = serie.map((p) => p.year);
  const primer = anys[0] ?? 1979;
  const ultim = anys[anys.length - 1] ?? ANY_ARA;

  const regidories = data.serieRegidoriesFiable
    ? serieTemporal(
        serie
          .filter((p): p is PartitEleccio & { regidories: number } => p.regidories !== null)
          .map((p) => ({ any: p.year, valor: p.regidories })),
        { titol: `${data.sigles} · regidories a tot Catalunya`, format: (v) => number(Math.round(v)) },
      )
    : "";
  // Una línia plana damunt del zero no és una sèrie: és soroll amb eix. Qui no
  // ha tingut mai cap alcaldia ho llegeix escrit, que ocupa menys i diu més.
  const capAlcaldia = serie.every((p) => !p.alcaldies);
  const alcaldies = data.serieAlcaldiesFiable && !capAlcaldia
    ? serieTemporal(
        serie
          .filter((p): p is PartitEleccio & { alcaldies: number } => p.alcaldies !== null)
          .map((p) => ({ any: p.year, valor: p.alcaldies })),
        { titol: `${data.sigles} · alcaldies a tot Catalunya`, format: (v) => number(Math.round(v)) },
      )
    : "";

  if (!data.serieRegidoriesFiable && !data.serieAlcaldiesFiable) {
    return `<p class="nota feble">D'aquesta marca no en tenim sèrie llarga.</p>
    <p class="nota">Els resultats des del 1979 i l'historial d'alcaldes vénen de dos conjunts
    diferents del recompte del 2023, i cap dels dos no sap veure-hi ${escape(data.sigles)}: el
    primer compta les marques comarcals dins de les llistes locals i el segon només porta el nom
    del partit tal com el va escriure cada ajuntament. Comprovat contra l'any que sabem de cert:
    al 2023 la sèrie de regidories li'n troba ${data.serieRegidories2023} de les
    ${data.regidories} que va treure, i la d'alcaldies ${data.serieAlcaldies2023} de les
    ${data.alcaldies} que té. Amb aquesta diferència, una corba des del 1979 no seria la seva
    història sinó la d'una altra força.</p>`;
  }

  /**
   * La taula respecta les mateixes dues comprovacions que els gràfics.
   *
   * Sense això, Tots per l'Empordà —que té set alcaldies i cap sèrie de
   * regidories— sortia amb una columna de zeros del 1979 al 2023: el gràfic
   * s'amagava i la taula deia igualment que no hi havia tret mai cap regidor.
   * Un guionet vol dir «no ho sabem» i un zero vol dir «cap»; aquí la
   * diferència és tota la feina.
   */
  const files = serie
    .map((p) => {
      const reg = data.serieRegidoriesFiable ? p.regidories : null;
      const alc = data.serieAlcaldiesFiable || p.year === ANY_ARA ? p.alcaldies : null;
      const guanyats = data.serieRegidoriesFiable ? p.guanyats : null;
      return `<tr>
      <th scope="row">${p.year}</th>
      <td class="xifra">${reg === null ? "—" : number(reg)}</td>
      <td class="xifra">${
        reg === null || p.regidoriesCatalunya === 0
          ? "—"
          : percent((100 * reg) / p.regidoriesCatalunya)
      }</td>
      <td class="xifra">${alc === null ? "—" : number(alc)}</td>
      <td class="xifra">${guanyats === null ? "—" : number(guanyats)}</td>
    </tr>`;
    })
    .join("");

  /** Per què una columna és tota de guionets, quan ho és. */
  const forats = [
    data.serieRegidoriesFiable
      ? ""
      : `De les <b>regidories</b> anteriors al ${ANY_ARA} no en tenim sèrie: el conjunt del 1979
         ençà compta aquesta marca dins de les llistes locals i al ${ANY_ARA} només li'n troba
         ${data.serieRegidories2023} de les ${data.regidories} que va treure.`,
    data.serieAlcaldiesFiable
      ? ""
      : `De les <b>alcaldies</b> anteriors al ${ANY_ARA} tampoc: l'historial d'alcaldes només
         porta el nom del partit tal com el va escriure cada ajuntament, i al ${ANY_ARA} li'n
         troba ${data.serieAlcaldies2023} de les ${data.alcaldies} que té.`,
  ]
    .filter(Boolean)
    .join(" ");

  return `${regidories === "" ? "" : `<h3 class="subtitol">Regidories, elecció a elecció</h3>${regidories}`}
  ${
    alcaldies === ""
      ? capAlcaldia
        ? `<p class="nota">No ha tingut mai cap alcaldia a Catalunya, ni el ${ANY_ARA} ni cap any
           d'ençà del ${primer}. Per això aquí no hi ha cap corba d'alcaldies: una línia plana
           damunt del zero no diria res que no digui aquesta frase.</p>`
        : ""
      : `<h3 class="subtitol">Alcaldies, mandat a mandat</h3>${alcaldies}`
  }
  ${renderPoblacioSerie(data)}
  <h3 class="subtitol">Les xifres de cada convocatòria</h3>
  <div class="taula-ampla">
  <table class="partit-serie">
    <caption class="nomes-lectors">Regidories, part del total català, alcaldies i municipis
    guanyats per ${escape(data.sigles)} a cada elecció municipal del ${primer} al ${ultim}</caption>
    <thead><tr><th>Elecció</th><th>Regidories</th><th>De totes les de Catalunya</th>
      <th>Alcaldies</th><th>Municipis guanyats</th></tr></thead>
    <tbody>${files}</tbody>
  </table>
  </div>
  <p class="nota">La columna d'alcaldies del <b>${ANY_ARA}</b> és la mateixa llista que hi ha
  més avall, comptada municipi a municipi amb les sigles de cada candidatura; les dels mandats
  anteriors surten de l'historial d'alcaldes, que només porta el nom del partit tal com el va
  escriure cada ajuntament. Són dues maneres de comptar i per això es diuen. «Municipis guanyats»
  són on va ser la <b>força més votada</b>, que no és el mateix que governar-hi: l'alcaldia la
  vota el ple.${
    data.lineage
      ? ` Cap columna no arrossega el passat de ${escape(data.lineageSigles ?? data.lineage)}, la força
         de la qual prové: hi ha una filiació —explicada més amunt, amb les dates— però no és el
         mateix partit i no ho volem fer passar per continuïtat.`
      : ""
  }</p>
  ${forats === "" ? "" : `<p class="nota feble">Un guionet no és un zero.</p><p class="nota">${forats}</p>`}`;
}

/** Quants municipis s'ensenyen abans de plegar la resta. */
const VISIBLES = 30;

/** Els euros de l'inventari, sense cèntims: la precisió no és la del cèntim. */
const euros = (n: number): string => `${Math.round(n).toLocaleString("ca-ES")} €`;

/**
 * La cara de qui mana en un municipi, o la seva inicial.
 *
 * Qui no té retrat publicat surt amb les inicials i el color de la marca, mai
 * amb un forat ni amb una silueta genèrica. És la regla que ja segueixen la
 * composició del ple i la fitxa de persona, i el motiu és el mateix: un buit
 * diria que d'aquella alcaldessa no en sabem res, quan el que passa és que el
 * seu ajuntament no publica la fotografia.
 */
function caraDe(m: PartitMunicipi, color: string, mida: "petita" | "tira"): string {
  const nom = m.mayorName ? nomLlegible(m.mayorName) : "";
  const inicials = nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((mot) => mot[0]!.toLocaleUpperCase("ca"))
    .join("");
  const { fons, tinta } = sobreColor(color);
  const classe = mida === "tira" ? "retrat retrat-tira" : "retrat";
  // Els atributs han de dir la mida a què es dibuixa i no la del fitxer: el
  // full d'estil ja la fixa, i posar-n'hi una altra confon qui llegeixi el HTML.
  const px = mida === "tira" ? 64 : 34;
  return m.mayorPhoto
    ? `<img class="${classe}" src="${escape(m.mayorPhoto)}" alt="" loading="lazy" width="${px}" height="${px}">`
    : `<span class="${classe} inicials sense-foto" style="--c:${fons};--t:${tinta}"
        aria-hidden="true">${escape(inicials)}</span>`;
}

/**
 * La tira de cares de les alcaldies d'una marca.
 *
 * **Per què hi és.** «ERC té 330 alcaldies» és una xifra que no es pot mirar.
 * Qui són aquelles 330 persones no es pot veure enlloc: ni al mapa, que pinta
 * termes municipals, ni a la llista, que és text. Aquesta tira és l'única peça
 * de la pàgina que ensenya el partit com el que és, un conjunt de gent que
 * governa pobles.
 *
 * **El criteri, dit i defensable.** Són les alcaldies dels municipis **més
 * poblats** que en publiquen el retrat, en el mateix ordre que la llista de
 * sota. No és una tria editorial: és el mateix ordre que ja mana a «On mana», i
 * la població és el criteri que evita que 121 alcaldies de pobles de 300
 * habitants semblin el mateix que 121 ciutats. El peu diu quantes en publiquen
 * retrat de quantes n'hi ha, perquè la tira no es pugui llegir com si fossin
 * totes les que té.
 *
 * **Per què no hi ha escuts.** Al costat del mapa, 330 escuts municipals
 * competirien amb el mapa i no dirien res que el mapa no digui ja millor.
 *
 * No es dibuixa amb poques cares: una tira de tres retrats sembla una llista
 * escapçada i no una fotografia del partit.
 */
const CARES_TIRA = 24;
const CARES_MINIM = 8;

function renderCares(data: PartitData): string {
  const mana = data.llocs.filter((m) => m.alcaldia);
  const ambCara = mana.filter((m) => m.mayorPhoto !== null && m.mayorName !== null);
  if (ambCara.length < CARES_MINIM) return "";
  const color = colorSegur(data.color);
  const tira = ambCara.slice(0, CARES_TIRA);
  const cara = (m: PartitMunicipi): string => {
    const nom = nomLlegible(m.mayorName!);
    const dins = `${caraDe(m, color, "tira")}
      <span class="qui">${escape(nom)}</span>
      <span class="on">${escape(m.name)}</span>`;
    return m.mayorSlug
      ? `<li><a href="../../m/${escape(m.slug)}/regidor/${escape(m.mayorSlug)}/">${dins}</a></li>`
      : `<li><span class="sense-fitxa">${dins}</span></li>`;
  };
  return `<ul class="partit-cares">${tira.map(cara).join("")}</ul>
  <p class="nota">${
    tira.length === ambCara.length
      ? `Són les ${number(ambCara.length)} alcaldies d'aquesta marca que publiquen el retrat`
      : `Són les ${number(tira.length)} primeres de les ${number(
          ambCara.length,
        )} alcaldies d'aquesta marca que publiquen el retrat`
  }, dels municipis més poblats als menys, que és el mateix ordre de la llista de sota. En
  té ${number(mana.length)} en total: ${number(mana.length - ambCara.length)} no
  ${plural(mana.length - ambCara.length, "surt", "surten")} aquí perquè el seu ajuntament no
  publica la fotografia de qui hi mana, o perquè la font que la publica i la que diu qui és
  l'alcaldia encara no diuen el mateix nom. No hi ha cap retrat que no vingui de la seu
  electrònica del mateix ajuntament.</p>`;
}

/**
 * On mana, de més gent a menys.
 *
 * Ordenat per població i no alfabèticament perquè l'ordre ja és una dada: dir
 * que una marca té 121 alcaldies no distingeix 121 pobles de 300 habitants de
 * 121 ciutats, i aquesta llista comença per on viu més gent justament per no
 * amagar aquella diferència.
 */
function renderOnMana(data: PartitData): string {
  const mana = data.llocs.filter((m) => m.alcaldia);
  if (mana.length === 0) {
    return `<p class="veredicte pacte">No té cap alcaldia al mandat ${MANDAT_ARA}.</p>
    <p class="nota">Té ${number(data.regidories)} ${plural(data.regidories, "regidoria", "regidories")}
    repartides per ${number(data.municipis)} ${plural(data.municipis, "municipi", "municipis")},
    totes a l'oposició.</p>`;
  }

  const color = colorSegur(data.color);
  /**
   * Cada fila porta dos enllaços i no un: el municipi i la persona.
   *
   * Anaven tots dos dins d'un sol `<a>` i no s'hi podien posar: una àncora dins
   * d'una altra no és HTML vàlid i el navegador la desfà com vol. Van a part,
   * i qui no té fitxa de persona porta el nom en text pla; qui no té retrat
   * porta la inicial amb el color de la marca.
   */
  const fila = (m: PartitMunicipi): string => {
    const on = m.candidatura ? `../../m/${m.slug}/${m.candidatura}/` : `../../m/${m.slug}/`;
    const nom = m.mayorName ? nomLlegible(m.mayorName) : null;
    const dins = `${caraDe(m, color, "petita")}<span class="nom">${escape(nom ?? "")}</span>`;
    return `<li>
      <a class="lloc-on" href="${escape(on)}">
        <b>${escape(m.name)}</b>
        <span class="hab">${number(m.population)} hab.</span>
        <span class="detall">${escape(m.sigles)} · ${m.seats} de ${m.totalSeats}${
          m.majoria ? " · majoria absoluta" : ""
        }${m.comarca ? ` · ${escape(m.comarca)}` : ""}</span>
      </a>
      ${
        nom === null
          ? ""
          : m.mayorSlug
            ? `<a class="lloc-qui" href="../../m/${escape(m.slug)}/regidor/${escape(
                m.mayorSlug,
              )}/">${dins}</a>`
            : `<span class="lloc-qui">${dins}</span>`
      }
    </li>`;
  };

  const davant = mana.slice(0, VISIBLES).map(fila).join("");
  const resta = mana.slice(VISIBLES);
  const ambFitxa = mana.filter((m) => m.mayorSlug !== null).length;

  return `<ul class="partit-llocs">${davant}</ul>
  ${
    resta.length > 0
      ? `<details class="partit-resta">
    <summary>Els altres ${number(resta.length)} municipis, del més gran al més petit</summary>
    <ul class="partit-llocs">${resta.map(fila).join("")}</ul>
  </details>`
      : ""
  }
  <p class="nota">Cada fila porta a dos llocs: el nom del municipi, a la fitxa d'aquesta marca en
  aquell poble —què hi va treure, qui la representa al ple i si hi va caldre pacte—, i la cara, a
  la fitxa de qui hi mana${
    ambFitxa < mana.length
      ? `. ${number(mana.length - ambFitxa)} ${plural(
          mana.length - ambFitxa,
          "alcaldia no hi porta",
          "alcaldies no hi porten",
        )}, perquè el nom que en dona la font de govern no lliga amb cap dels noms del ple`
      : ""
  }. ${data.majories} d'aquestes
  ${plural(data.majories, "alcaldia", "alcaldies")} ${plural(data.majories, "surt", "surten")} d'una
  llista que tota sola ja tenia la majoria absoluta; les altres ${data.alcaldies - data.majories}
  van necessitar un pacte, o com a mínim que algú s'abstingués.</p>`;
}

/**
 * Amb quantes alcaldies amb import una mediana diu alguna cosa del partit.
 *
 * Per sota d'aquí, la «mediana d'aquesta marca» és una xifra o dues: seria fer
 * passar el que cobra una persona concreta per una tendència d'un partit. Les
 * xifres per municipi no s'amaguen —són públiques i són a la fitxa de cada
 * poble—, el que no es fa és presentar-les com el que no són.
 */
const MINIM_MEDIANA = 5;

/**
 * Què cobren les alcaldies d'aquesta marca.
 *
 * **La regla dura d'aquest bloc: aquí no hi surt la paraula «sou» a seques.**
 * L'import de l'inventari del Ministeri és una sola xifra per alcaldia que suma
 * la retribució del càrrec **i** les assistències a plens i comissions, i
 * anomenar-lo sou faria creure que un alcalde de poble cobra cada mes una cosa
 * que en realitat cobra per sessió. De les 866 alcaldies que hi consten, 659
 * tenen dedicació exclusiva o parcial —allà sí que hi ha un sou— i 149 no en
 * tenen cap.
 *
 * **La segona regla: no es compara una marca amb una altra sense el tram.** El
 * PSC té una mediana de 32.537 € i ERC de 15.295 €, i posades l'una al costat
 * de l'altra semblen dir alguna cosa dels dos partits quan diuen la mida dels
 * pobles que governen: el PSC té l'alcaldia de 125 municipis que de mitjana són
 * molt més grans que els 330 d'ERC. Per això la comparació d'aquest bloc és
 * sempre dins del mateix tram de població, i la xifra global hi va acompanyada
 * de la frase que diu que no es pot fer servir per comparar.
 *
 * **La tercera: qui no ho ha comunicat no és qui no cobra.** 81 dels 947
 * municipis no consten a l'inventari, i escriure-hi un zero seria acusar-los de
 * no pagar l'alcaldia quan el que han fet és no enviar la dada al Ministeri.
 */
function renderRetribucions(data: PartitData): string {
  const r = data.retribucions;
  if (r === null || r.ambImport === 0) return "";
  const prou = r.ambImport >= MINIM_MEDIANA;
  const pctSense = r.alcaldies > 0 ? (100 * r.senseComunicar) / r.alcaldies : 0;

  const resumXifres = prou
    ? `<ul class="partit-dues">
    <li>
      <span class="etq">Mediana</span>
      <span class="gran">${euros(r.mediana!)}</span>
      <span class="secundari">l'any, a les ${number(r.ambImport)}
      ${plural(r.ambImport, "alcaldia", "alcaldies")} d'aquesta marca que consten a l'inventari.
      La meitat en tenen assignat més i l'altra meitat, menys</span>
    </li>
    <li class="governa">
      <span class="etq">Mitjana</span>
      <span class="gran">${euros(r.media!)}</span>
      <span class="secundari">l'any. ${
        // Les dues xifres hi van juntes perquè la distància entre elles és una
        // dada: quan la mitjana passa la mediana, hi ha unes poques alcaldies
        // grans que l'estiren; quan queda per sota, n'hi ha que no cobren gaire
        // o no cobren res. Dir sempre el mateix seria fals la meitat de les
        // vegades, i és exactament la frase que un lector no pot comprovar.
        Math.round(r.media!) > Math.round(r.mediana!)
          ? "Passa de la mediana perquè unes quantes alcaldies grans estiren la xifra amunt"
          : Math.round(r.media!) < Math.round(r.mediana!)
            ? "Queda per sota de la mediana: hi ha alcaldies que cobren molt poc, o res, i l'estiren avall"
            : "Va a la par de la mediana: les seves alcaldies cobren xifres semblants"
      }</span>
    </li>
  </ul>`
    : `<p class="veredicte pacte">Amb ${number(r.ambImport)}
    ${plural(r.ambImport, "alcaldia", "alcaldies")} amb import comunicat, una mediana no diria res
    d'aquesta marca: seria la xifra d'una persona o dues. Les tens una per una a la fitxa de cada
    municipi.</p>`;

  return `<p class="entrada-bloc">L'inventari del Ministeri publica, per a cada ajuntament, una
  sola xifra anual per a l'alcaldia. <b>Aquella xifra no és un sou:</b> hi entren la retribució
  del càrrec i les assistències a plens i comissions, que es cobren per sessió i no cada mes.</p>
  ${resumXifres}
  <ul class="partit-desglossa">
    <li>${
      r.alcaldies === 1
        ? "La seva <b>única</b> alcaldia consta"
        : `<b>${number(r.ambImport)}</b> de les ${number(r.alcaldies)} alcaldies que té ${plural(
            r.ambImport,
            "consta",
            "consten",
          )}`
    } a l'inventari${r.any === null ? "" : ` de l'exercici ${r.any}`}.</li>
    ${
      // Les files que valen zero no s'escriuen. «0 hi consten sense dedicació»
      // no informa de res i fa que la llista es llegeixi com un formulari buit.
      r.ambDedicacio > 0
        ? `<li><b>${number(r.ambDedicacio)}</b> ${plural(
            r.ambDedicacio,
            "hi té",
            "hi tenen",
          )} dedicació exclusiva o parcial: allà l'import sí que és una retribució periòdica del
          càrrec.</li>`
        : ""
    }
    ${
      r.nomesAssistencies > 0
        ? `<li><b>${number(r.nomesAssistencies)}</b> ${plural(
            r.nomesAssistencies,
            "hi consta sense dedicació",
            "hi consten sense dedicació",
          )}: el que hi surt són assistències i indemnitzacions, cobrades per sessió, i no un sou.</li>`
        : ""
    }
    ${
      r.senseCapImport > 0
        ? `<li><b>${number(r.senseCapImport)}</b> ${plural(
            r.senseCapImport,
            "hi consta",
            "hi consten",
          )} amb zero euros: l'alcaldia no cobra res de l'ajuntament.</li>`
        : ""
    }
    ${
      r.senseComunicar > 0
        ? `<li class="sense"><b>${number(r.senseComunicar)}</b> ${plural(
            r.senseComunicar,
            "alcaldia no hi consta",
            "alcaldies no hi consten",
          )} —el ${percent(pctSense)} de les seves—. <b>No vol dir que no cobrin:</b> vol dir que
          aquell ajuntament no ho ha comunicat al Ministeri. A tot Catalunya en falten
          ${number(r.municipisTotals - r.municipisAmbDada)} de ${number(r.municipisTotals)}.</li>`
        : `<li>Totes les seves alcaldies hi consten. A tot Catalunya en falten
          ${number(r.municipisTotals - r.municipisAmbDada)} de ${number(
            r.municipisTotals,
          )}: municipis que no ho han comunicat al Ministeri, que no és el mateix que municipis on
          l'alcaldia no cobri.</li>`
    }
  </ul>
  ${
    r.trams.length > 0
      ? `<h3>Com queda, tram per tram</h3>
  <p>La retribució d'una alcaldia la marca la mida del municipi molt abans que el color de qui
  la té. Comparar la xifra global d'una marca amb la d'una altra és comparar la mida dels pobles
  que governen, i per això aquí cada tram es compara amb ell mateix: al costat de la mediana
  d'aquesta marca hi va la de <b>totes</b> les alcaldies del tram, siguin de qui siguin.</p>
  <div class="taula-envolta">
  <table class="euros-resultat">
    <thead><tr>
      <th scope="col">Tram de població</th>
      <th scope="col">Alcaldies seves amb import</th>
      <th scope="col">Mediana d'aquesta marca</th>
      <th scope="col">Mediana del tram</th>
    </tr></thead>
    <tbody>${r.trams
      .map(
        (t) => `<tr>
      <th scope="row">${escape(t.tram)}</th>
      <td>${number(t.ambImport)} de ${number(t.alcaldies)}</td>
      <td>${t.mediana === null ? '<span class="buit">—</span>' : euros(t.mediana)}</td>
      <td>${
        t.medianaTram === null
          ? '<span class="buit">—</span>'
          : `${euros(t.medianaTram)} <span class="buit">(${number(t.alcaldiesTram)})</span>`
      }</td>
    </tr>`,
      )
      .join("")}</tbody>
  </table>
  </div>
  <p class="nota">Només hi surten els trams on aquesta marca té tres o més alcaldies amb
  import comunicat. El nombre entre parèntesis és quantes alcaldies de tot Catalunya hi ha en
  aquell tram amb import, que és el denominador de la columna del costat.</p>`
      : `<p class="nota">No hi ha cap tram de població on aquesta marca tingui prou alcaldies amb
  import comunicat per poder-la comparar amb les altres sense que la comparació digui la mida
  dels pobles en comptes del partit.</p>`
  }
  <p class="nota">Font: inventari de retribucions dels membres de les corporacions locals (ISPA
  2025), Ministeri per a la Transformació Digital i de la Funció Pública. La xifra és la que
  l'ajuntament comunica al Ministeri, no la que hem calculat nosaltres; el que és nostre és
  agrupar-la per marca i per tram. Les regidories no hi entren: aquelles files no porten nom i no
  es poden atribuir a cap persona ni a cap llista.</p>`;
}

/**
 * La renda dels pobles que governa.
 *
 * **Aquest bloc no és un resultat d'aquest partit i ho ha de dir en veu alta.**
 * Un ajuntament no decideix quant guanya la gent que hi viu: la renda depèn de
 * qui hi viu, de què hi treballa i de com va l'economia. El que sí que decideix
 * el ple és què en fa a partir d'aquí —quines taxes cobra, a qui les bonifica i
 * en què gasta—, i això és a la fitxa de cada municipi.
 *
 * I la sèrie de l'INE **s'acaba el 2023**, que és l'any en què es van constituir
 * aquests ajuntaments: no hi ha ni un any de dades posterior a les eleccions. El
 * que es veu aquí és el context on van entrar a governar, no el que ha passat
 * des que hi són.
 *
 * La mediana és **per municipi i no per persona**: diu com és el poble típic on
 * mana la marca. Fer-la per persona la convertiria en la renda de les quatre
 * ciutats grans que hi hagi a la llista.
 */
function renderRenda(data: PartitData): string {
  const r = data.renda;
  if (r === null || r.mediana === null || r.ambDada < MINIM_MEDIANA) return "";
  const cat = r.medianaCatalunya;
  return `<p class="entrada-bloc"><b>La renda no la decideix l'ajuntament.</b> És el context on
  aquesta marca ha governat, no un resultat seu: depèn de qui viu en aquells pobles, de què hi
  treballa i de com va l'economia. I la sèrie de l'INE s'acaba el ${r.any}, l'any en què es van
  constituir aquests ajuntaments: no hi ha cap dada posterior a les eleccions.</p>
  <ul class="partit-dues">
    <li>
      <span class="etq">Els municipis on mana</span>
      <span class="gran">${euros(r.mediana)}</span>
      <span class="secundari">de renda neta per persona l'any ${r.any}, al municipi que queda
      al mig dels ${number(r.ambDada)} que governa i que tenen xifra</span>
    </li>
    <li class="governa">
      <span class="etq">Els 947, per comparar</span>
      <span class="gran">${cat === null ? "—" : euros(cat)}</span>
      <span class="secundari">${
        cat === null
          ? "sense mediana catalana no hi ha comparació possible"
          : `al municipi que queda al mig dels ${number(
              r.municipisCatalunyaAmbDada,
            )} municipis de Catalunya amb xifra`
      }</span>
    </li>
  </ul>
  ${
    r.mesBaixa && r.mesAlta
      ? `<p class="veredicte">Entre els seus, va de
    ${euros(r.mesBaixa.valor)} a <a href="../../m/${escape(r.mesBaixa.slug)}/">${escape(
      r.mesBaixa.name,
    )}</a> fins a ${euros(r.mesAlta.valor)} a
    <a href="../../m/${escape(r.mesAlta.slug)}/">${escape(r.mesAlta.name)}</a>: la mediana d'una
    marca amb alcaldies a mig Catalunya amaga una distància que la xifra sola no deixa veure.</p>`
      : ""
  }
  <p class="nota">${number(r.municipis - r.ambDada)} de les seves
  ${number(r.municipis)} ${plural(r.municipis, "alcaldia", "alcaldies")} no hi
  ${plural(r.municipis - r.ambDada, "surt", "surten")}: l'INE tapa per secret estadístic la renda
  dels municipis més petits, i un municipi sense xifra no és un municipi sense renda. La mediana
  és per municipi i no per persona —diu com és el poble típic on mana aquesta marca, no quant
  guanya de mitjana qui hi viu—, i barrejar-ho faria que una capital arrossegués vint pobles.</p>
  <p class="nota">Font: INE, Atles de distribució de renda de les llars, sèrie 2015-2023.</p>`;
}

/**
 * Les dues poblacions, que no són la mateixa i que sovint es confonen.
 *
 * És la distinció que fa que la xifra gran de la capçalera no enganyi: un
 * partit que governa 1,2 milions d'habitants no té 1,2 milions de votants, i un
 * partit amb molts vots repartits pot no governar gairebé ningú. Van les dues
 * juntes i amb la mateixa mida perquè cap no pugui passar per l'altra.
 */
function renderPoblacio(data: PartitData): string {
  const pctVots = data.votsCatalunya > 0 ? (100 * data.vots) / data.votsCatalunya : 0;
  const pctPoblacio =
    data.poblacioCatalunya > 0 ? (100 * data.poblacioGovernada) / data.poblacioCatalunya : 0;
  return `<ul class="partit-dues">
    <li>
      <span class="etq">La població que el vota</span>
      <span class="gran">${number(data.vots)}</span>
      <span class="secundari">vots a les municipals del ${ANY_ARA}, el ${percent(pctVots)}
      dels ${number(data.votsCatalunya)} vots a candidatures de tot Catalunya</span>
    </li>
    <li class="governa">
      <span class="etq">La població que governa</span>
      <span class="gran">${number(data.poblacioGovernada)}</span>
      <span class="secundari">${
        data.alcaldies === 0
          ? "no té cap alcaldia: no governa cap habitant de Catalunya"
          : `habitants dels ${number(data.alcaldies)} ${plural(data.alcaldies, "municipi", "municipis")} on té l'alcaldia, el ${percent(pctPoblacio)} de Catalunya`
      }</span>
    </li>
  </ul>
  <p class="veredicte">Els vots són qui el va triar; els habitants governats són tothom qui viu on té l'alcaldia, l'hagi votat o no.</p>
  <p class="nota">Per això les dues xifres no es poden sumar ni comparar directament: als vots
  només hi compta qui podia votar i va anar a votar, i a la població governada hi compta tothom
  —criatures, gent sense dret de vot i qui va votar una altra cosa. En un municipi governat, la
  majoria dels habitants no l'han votat mai: és així a tot arreu i no és cap anomalia
  d'aquesta marca.</p>`;
}

// -------------------------------------------------------------------- estil

/**
 * L'accent d'aquesta pàgina és el color de la marca, com a la fitxa de
 * candidatura i per la mateixa raó: la pàgina és d'aquella marca i de cap
 * altra. El fons continua sent el paper de la casa i el color només omple
 * peces —la pastilla del títol, les taques enceses del mapa, els filets—,
 * mai text llarg ni el fons de la pàgina. El portal ha de ser visiblement
 * de ningú fins i tot aquí.
 */
export const PARTIT_CSS = `
.partit-dalt{height:10px;background:var(--accent);border-bottom:2.5px solid var(--ink)}
.partit-portada{padding:var(--e3) 0 var(--e4)}
.partit-tornar{font-size:.82rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;
  color:var(--ink-suau);text-decoration:none;display:inline-block;margin-bottom:var(--e2)}
.partit-tornar:hover{color:var(--ink)}
.partit-sigles{display:inline-block;background:var(--accent);color:var(--accent-tinta);
  border:2.5px solid var(--ink);border-radius:var(--r-m);box-shadow:var(--ombra);
  padding:6px 16px;margin:0 0 var(--e2);font-family:var(--display);font-weight:900;
  letter-spacing:-.03em;font-size:clamp(1.9rem,7vw,3.4rem);line-height:1.12;max-width:100%;
  overflow-wrap:anywhere}
.partit-nom{font-size:1.15rem;color:var(--ink-suau);margin:0 0 var(--e2);max-width:46ch}
.partit-xifres{list-style:none;margin:var(--e3) 0 0;padding:0;display:grid;gap:var(--e2);
  grid-template-columns:repeat(auto-fit,minmax(165px,1fr))}
.partit-xifres li{background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);
  box-shadow:var(--ombra);padding:var(--e2);display:flex;flex-direction:column;gap:3px}
.partit-xifres .gran{font-family:var(--display);font-weight:900;font-size:2.1rem;line-height:1;
  letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.partit-xifres .etq,.partit-dues .etq{font-size:.68rem;font-weight:800;text-transform:uppercase;
  letter-spacing:.1em;color:var(--ink-suau)}

/* --- el mapa dels 947 amb els seus municipis encesos --------------------- */
.partit-mapa{margin:var(--e2) 0 0;padding:0}
.partit-mapa svg{width:100%;height:auto;display:block;max-width:900px;margin:0 auto}
.partit-mapa path{fill:#DED8CB;stroke:var(--ink);stroke-width:.7;stroke-linejoin:round}
.partit-mapa a:hover path,.partit-mapa a:focus path{stroke-width:3.5}
.partit-mapa .contorn{fill:none;stroke:var(--ink);stroke-width:3.5}
.partit-mapa .mana{fill:var(--accent)}
/* On hi és sense manar-hi va del mateix color rebaixat i no d'un color nou:
   la diferència entre els dos estats és de quantitat, i inventar-hi un segon
   to faria pensar en una segona força. */
.partit-mapa .hi-es{fill:var(--accent);fill-opacity:.3}
.partit-clau{display:flex;gap:var(--e2);flex-wrap:wrap;align-items:center;margin:var(--e3) 0 0;
  font-size:.84rem;font-weight:700;list-style:none;padding:0}
.partit-clau li{display:flex;align-items:center;gap:6px}
.partit-clau i{width:22px;height:22px;border:2px solid var(--ink);border-radius:5px;display:inline-block}
.partit-clau i.mana{background:var(--accent)}
.partit-clau i.hi-es{background:var(--accent-esvait)}
.partit-clau i.apagat{background:#DED8CB}
.partit-mapa figcaption{font-size:.84rem;color:var(--ink-suau);margin-top:var(--e2)}
.partit-mapa figcaption b{color:var(--ink)}

/* --- la sèrie llarga ----------------------------------------------------- */
.subtitol{font-family:var(--display);font-weight:900;font-size:1.05rem;letter-spacing:-.02em;
  margin:var(--e3) 0 0}
/* La taula de les dotze eleccions fa 426px de mínim i no s'encongeix més: sota
   els 480 estirava el document sencer i la pàgina lliscava de costat. El
   desplaçament ha de quedar DINS de la taula, com ja passa amb les gràfiques. */
.taula-ampla{overflow-x:auto;margin-top:var(--e2);-webkit-overflow-scrolling:touch}
.partit-serie{width:100%;min-width:420px;border-collapse:collapse;font-size:.95rem}
.partit-serie th,.partit-serie td{text-align:left;padding:9px 12px 9px 0;
  border-bottom:1px solid var(--vora);vertical-align:top}
.partit-serie thead th{font-size:.7rem;text-transform:uppercase;letter-spacing:.1em;
  color:var(--ink-suau);border-bottom:2.5px solid var(--ink)}
.partit-serie tbody th{font-weight:800;font-variant-numeric:tabular-nums}
.partit-serie .xifra{font-variant-numeric:tabular-nums;white-space:nowrap}

/* --- el llinatge --------------------------------------------------------- */
/* Va amb el filet del color de la marca a l'esquerra, com la targeta de la
   població governada, perquè és l'altra peça de la pàgina que parla d'aquesta
   marca i de cap altra. Mai amb el color de fons: el text llarg damunt del
   color de partit és el que fa que un portal deixi de ser de ningú. */
.partit-llinatge{background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);
  box-shadow:var(--ombra);border-left-width:10px;border-left-color:var(--accent);
  padding:var(--e2) var(--e2) 2px;margin:var(--e3) 0 0}
.partit-llinatge > .subtitol{margin:0 0 var(--e2)}
.partit-llinatge ul{list-style:none;margin:0;padding:0;display:grid;gap:var(--e2)}
.partit-llinatge li{display:flex;gap:12px;align-items:baseline;font-size:.92rem}
.partit-llinatge .quan{font-family:var(--display);font-weight:900;font-size:1.05rem;
  font-variant-numeric:tabular-nums;flex:none}
.partit-llinatge .cap{font-size:.68rem;font-weight:800;text-transform:uppercase;
  letter-spacing:.1em;color:var(--ink-suau)}
.partit-llinatge .que a{font-weight:800;color:inherit}
.partit-llinatge .que b{font-weight:800}

/* --- la tira de cares -----------------------------------------------------
   Retrats i no escuts, i a dalt de tot del bloc. Un escut municipal al costat
   del mapa no diria res que el mapa no digui, i les cares diuen l'única cosa
   que aquesta pàgina no podia dir enlloc: qui són les persones que hi ha
   darrere de la xifra d'alcaldies. */
.partit-cares{list-style:none;margin:0 0 var(--e3);padding:0;display:grid;
  grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:var(--e2) var(--e1)}
.partit-cares li{min-width:0}
.partit-cares a,.partit-cares .sense-fitxa{display:flex;flex-direction:column;align-items:center;
  gap:5px;text-align:center;text-decoration:none;color:inherit}
.partit-cares .retrat-tira{width:64px;height:64px;font-size:1.05rem}
.partit-cares .qui{font-size:.72rem;font-weight:800;line-height:1.2;overflow-wrap:anywhere}
.partit-cares .on{font-size:.68rem;font-weight:700;line-height:1.2;color:var(--ink-suau);
  overflow-wrap:anywhere}
.partit-cares a:hover .qui{text-decoration:underline}
@media (max-width:420px){
  .partit-cares{grid-template-columns:repeat(auto-fill,minmax(74px,1fr))}
  .partit-cares .retrat-tira{width:54px;height:54px}
}

/* --- on mana -------------------------------------------------------------
   La targeta és el <li> i ja no l'enllaç: ara hi ha dos destins a cada fila
   —la candidatura en aquell poble i la fitxa de qui hi mana— i una àncora dins
   d'una altra no és HTML vàlid. */
.partit-llocs{list-style:none;margin:0;padding:0;display:grid;gap:var(--e1);
  grid-template-columns:repeat(auto-fit,minmax(250px,1fr))}
.partit-llocs li{display:flex;flex-direction:column;background:var(--paper-2);
  border:2.5px solid var(--ink);border-radius:var(--r-m);box-shadow:var(--ombra);
  transition:transform .12s ease,box-shadow .12s ease}
.partit-llocs li:hover{transform:translate(2px,2px);box-shadow:1px 1px 0 var(--ink)}
.partit-llocs .lloc-on{display:flex;flex-wrap:wrap;align-items:baseline;gap:0 8px;
  padding:11px var(--e2);text-decoration:none;color:inherit}
.partit-llocs .lloc-on:hover b{text-decoration:underline}
.partit-llocs b{font-family:var(--display);font-weight:900;font-size:1.02rem;letter-spacing:-.02em;
  overflow-wrap:anywhere}
.partit-llocs .hab{margin-left:auto;font-size:.82rem;font-weight:800;color:var(--ink-suau);
  font-variant-numeric:tabular-nums;white-space:nowrap}
.partit-llocs .detall{flex-basis:100%;font-size:.78rem;color:var(--ink-suau);overflow-wrap:anywhere}
/* Qui hi mana, a peu de targeta i separat amb un filet: són dos destins i s'ha
   de veure que ho són. La cara va a l'esquerra i el nom al costat, com a la
   composició del ple, perquè la mateixa persona es reconegui a les dues pàgines. */
.partit-llocs .lloc-qui{display:flex;align-items:center;gap:9px;margin-top:auto;
  padding:8px var(--e2) 10px;border-top:2px solid var(--vora);text-decoration:none;color:inherit}
.partit-llocs .lloc-qui .retrat{width:34px;height:34px;border-width:2px;font-size:.72rem}
.partit-llocs .lloc-qui .nom{font-size:.82rem;font-weight:800;overflow-wrap:anywhere;min-width:0}
.partit-llocs a.lloc-qui:hover .nom{text-decoration:underline}
.partit-resta{margin-top:var(--e2)}
.partit-resta > summary{font-size:.85rem;font-weight:800;cursor:pointer;padding:10px 0;
  color:var(--ink-suau)}
.partit-resta > summary:hover{color:var(--ink)}
.partit-resta[open] > summary{margin-bottom:var(--e2)}
@media (prefers-reduced-motion:reduce){.partit-llocs li{transition:none}}

/* --- el desglossament de les retribucions --------------------------------
   L'última fila va marcada amb una vora discontínua a posta: és la que es
   llegeix malament amb més facilitat, i «no ho han comunicat» no és «no cobra». */
.partit-desglossa{list-style:none;margin:0 0 var(--e3);padding:0;display:grid;gap:6px}
.partit-desglossa li{font-size:.9rem;line-height:1.45;padding:9px var(--e2);
  background:var(--paper-2);border:2px solid var(--vora);border-radius:var(--r-s)}
.partit-desglossa li b{font-family:var(--display);font-weight:900;font-size:1.05rem;
  font-variant-numeric:tabular-nums}
.partit-desglossa .sense{border-color:var(--ink);border-style:dashed}

/* --- les dues poblacions ------------------------------------------------- */
.partit-dues{list-style:none;margin:0 0 var(--e3);padding:0;display:grid;gap:var(--e2);
  grid-template-columns:repeat(auto-fit,minmax(230px,1fr))}
.partit-dues li{background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);
  box-shadow:var(--ombra);padding:var(--e2);display:flex;flex-direction:column;gap:4px}
/* La targeta de la població governada porta el filet del color de la marca:
   és l'única de les dues que depèn de qui té l'alcaldia. */
.partit-dues li.governa{border-left-width:10px;border-left-color:var(--accent)}
.partit-dues .gran{font-family:var(--display);font-weight:900;font-size:2.4rem;line-height:1;
  letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.partit-dues .secundari{font-size:.84rem;color:var(--ink-suau)}

/* --- les altres marques -------------------------------------------------- */
/* Les targetes de les altres marques.
   Els 200px de mínim no donaven per a «Independents de Catalunya», i com que el
   nom portava un tall d'emergència que parteix DINS de la paraula, la targeta
   escrivia «Ciutadan / s» i «Tots per l'Empord / à». Aquell tall és per a una
   paraula que de debò no hi cap, no per a un nom que només necessita dues
   línies: amb el tall normal, «Ciutadans» hi cap sencer. La columna puja a 230,
   i com que el nom pot ocupar una línia o dues, les targetes s'estiren totes a
   l'alçada de la seva fila en comptes de quedar cadascuna de la seva mida. */
.partit-altres{list-style:none;margin:0;padding:0;display:grid;gap:var(--e1);
  grid-template-columns:repeat(auto-fit,minmax(230px,1fr));align-items:stretch}
.partit-altres li{display:flex}
.partit-altres a{display:flex;align-items:center;gap:9px;width:100%;background:var(--paper-2);
  border:2.5px solid var(--ink);border-radius:var(--r-m);box-shadow:var(--ombra);
  padding:11px var(--e2);text-decoration:none;color:inherit;
  transition:transform .12s ease,box-shadow .12s ease}
.partit-altres a:hover{transform:translate(2px,2px);box-shadow:1px 1px 0 var(--ink)}
.partit-altres .mostra{width:14px;height:14px;border-radius:4px;background:var(--c);
  border:1.5px solid var(--ink);flex:none}
.partit-altres b{font-weight:800;overflow-wrap:break-word;line-height:1.25}
.partit-altres span.quantes{margin-left:auto;padding-left:8px;color:var(--ink-suau);
  font-size:.84rem;white-space:nowrap}
@media (prefers-reduced-motion:reduce){.partit-altres a{transition:none}}
`;

// -------------------------------------------------------------------- pàgina

export function renderPartit(data: PartitData, generatedAt: string): string {
  const color = colorSegur(data.color);
  const title = `${data.sigles} als ajuntaments — Observatori municipal de quivoto`;
  const resum =
    data.alcaldies > 0
      ? `${data.sigles} té ${number(data.alcaldies)} ${plural(data.alcaldies, "alcaldia", "alcaldies")}, ${number(data.regidories)} ${plural(data.regidories, "regidoria", "regidories")} i governa ${number(data.poblacioGovernada)} habitants de Catalunya.`
      : `${data.sigles} no té cap alcaldia a Catalunya: hi té ${number(data.regidories)} ${plural(data.regidories, "regidoria", "regidories")}, ${plural(data.regidories, "tota", "totes")} a l'oposició.`;
  const description = `Quantes alcaldies i quantes regidories té ${data.sigles} als 947 municipis de Catalunya, on mana, quanta gent governa i com li ha anat des del 1979. Només amb dades obertes.`;
  // Els dos blocs que poden no existir es dibuixen un sol cop: l'índex de dalt i
  // la secció han de dir el mateix, i amb dues crides separades podien acabar
  // dient coses diferents si un dia el llindar de dins canviés.
  const retribucions = renderRetribucions(data);
  const renda = renderRenda(data);

  return `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${INDEXABLE ? "" : '<meta name="robots" content="noindex, nofollow">'}
<title>${escape(title)}</title>
<meta name="description" content="${escape(description)}">
<link rel="canonical" href="${SITE}/observatori/partit/${escape(data.id)}/">
<meta property="og:type" content="article">
<meta property="og:site_name" content="quivoto">
<meta property="og:locale" content="ca_ES">
<meta property="og:title" content="${escape(`${data.sigles} als ajuntaments de Catalunya`)}">
<meta property="og:description" content="${escape(resum)}">
<meta property="og:url" content="${SITE}/observatori/partit/${escape(data.id)}/">
<meta property="og:image" content="${SITE}/assets/og.png">
<meta name="twitter:card" content="summary_large_image">
<style>${RADIOGRAFIA_CSS}${PARTIT_CSS}</style>
</head>
<body style="--accent:${color};--accent-tinta:${tintaSobre(color)};--accent-esvait:${color}4d">
<a class="salta" href="#contingut">Ves al contingut</a>
<div class="partit-dalt" aria-hidden="true"></div>

${capcalera("../../", "partits")}
${cercador("../../")}

<main id="contingut">

<section class="partit-portada">
  <a class="partit-tornar" href="../../">← Observatori municipal</a>
  <h1><span class="partit-sigles">${escape(data.sigles)}</span></h1>
  <p class="partit-nom">${escape(data.name)}${
    NOM_TIPUS[data.kind] ? ` · ${escape(NOM_TIPUS[data.kind]!)}` : ""
  }</p>
  <p class="resum">${escape(resum)}</p>
  <ul class="partit-xifres">
    <li><span class="etq">Alcaldies</span><span class="gran">${number(data.alcaldies)}</span>
      <span class="secundari">${
        data.alcaldies === 0
          ? "de 947 municipis: no en governa cap"
          : `de 947 municipis, a ${number(data.comarques)} ${plural(data.comarques, "comarca", "comarques")}`
      }</span></li>
    <li><span class="etq">Regidories</span><span class="gran">${number(data.regidories)}</span>
      <span class="secundari">a ${number(data.municipis)}
      ${plural(data.municipis, "municipi", "municipis")} amb representació</span></li>
    <li><span class="etq">Població governada</span><span class="gran">${number(data.poblacioGovernada)}</span>
      <span class="secundari">${
        // El percentatge és el que fa comparable una marca amb l'altra: 947.665
        // habitants no diuen si això és molt o poc fins que no se sap que
        // Catalunya en té 7,9 milions. La xifra absoluta hi queda perquè és la
        // que es pot comprovar sumant els municipis de la llista de sota.
        data.poblacioCatalunya > 0
          ? `habitants, el ${percent((100 * data.poblacioGovernada) / data.poblacioCatalunya)} de Catalunya, als municipis on té l'alcaldia`
          : "habitants als municipis on té l'alcaldia"
      }</span></li>
  </ul>
</section>

<nav class="index" aria-label="Seccions d'aquesta pàgina">
  <a href="#mapa">El mapa</a>
  <a href="#evolucio">Des del 1979</a>
  <a href="#mana">On mana</a>
  <a href="#poblacio">Vots i habitants</a>
  ${retribucions ? '<a href="#retribucions">Què cobren les seves alcaldies</a>' : ""}
  ${renda ? '<a href="#renda">La renda dels pobles que governa</a>' : ""}
  <a href="#altres">Els altres partits</a>
</nav>

<section class="bloc" id="mapa">
  <h2>On és, als 947</h2>
  <p class="entrada-bloc">Els municipis amb l'alcaldia van del color de la marca; els que hi tenen
  regidories sense manar-hi, del mateix color rebaixat; la resta, apagats.</p>
  ${renderMapa(data)}
</section>

<section class="bloc" id="evolucio">
  <h2>Com li ha anat des del 1979</h2>
  <p class="entrada-bloc">Dotze eleccions municipals. La comparació va <b>per força i no per
  sigles</b>: les candidatures es rebategen cada poques convocatòries i comparar-les pel nom no
  diria res.</p>
  ${renderLlinatge(data)}
  ${renderEvolucio(data)}
</section>

<section class="bloc" id="mana">
  <h2>On mana</h2>
  <p class="entrada-bloc">Els municipis amb l'alcaldia, del que té més habitants al que en té
  menys, i qui hi mana.</p>
  ${renderCares(data)}
  ${renderOnMana(data)}
</section>

<section class="bloc" id="poblacio">
  <h2>La gent que el vota i la gent que governa</h2>
  ${renderPoblacio(data)}
</section>

${
  retribucions
    ? `<section class="bloc" id="retribucions">
  <h2>Què cobren les seves alcaldies</h2>
  ${retribucions}
</section>`
    : ""
}

${
  renda
    ? `<section class="bloc" id="renda">
  <h2>La renda dels pobles que governa</h2>
  ${renda}
</section>`
    : ""
}

<section class="bloc" id="altres">
  <h2>Els altres partits</h2>
  ${
    data.altres.length > 0
      ? `<ul class="partit-altres">${data.altres
          .map(
            (a) => `<li><a href="../${escape(a.id)}/">
        <span class="mostra" style="--c:${colorSegur(a.color)}"></span>
        <b>${escape(a.sigles)}</b>
        <span class="quantes">${a.alcaldies} ${plural(a.alcaldies, "alcaldia", "alcaldies")}</span>
      </a></li>`,
          )
          .join("")}</ul>`
      : "<p>Ara mateix aquesta és l'única marca amb pàgina pròpia.</p>"
  }
  <p class="nota">No hi ha cap pàgina de «llistes locals», i no és un oblit: sota aquella etiqueta
  hi ha centenars de candidatures que no tenen res a veure les unes amb les altres, i ajuntar-les
  diria que existeix un partit que no existeix. Cadascuna té la seva pàgina al seu municipi.</p>
</section>

<section class="bloc anar">
  <h2>Segueix estirant</h2>
  <ul class="destins">
    <li><a href="../../mapa/"><b>El mapa dels 947</b>
      <span>Els mateixos municipis pintats per força, majoria absoluta i alternança des del
      1979</span></a></li>
    <li><a href="../../els947.html"><b>Els 947, en llista</b>
      <span>Amb cercador i filtres, per si busques un poble concret</span></a></li>
    <li><a href="../../dades/"><b>Baixa't les dades</b>
      <span>Tot això en CSV i JSON, amb l'esquema documentat i la font de cada xifra</span></a></li>
  </ul>
</section>

<section class="bloc fonts">
  <h2>D'on surt tot això</h2>
  <ul>
    <li>Vots, regidories i agrupació de cada candidatura: Generalitat de Catalunya, <code>ntc4-rnwr</code>.</li>
    <li>Alcaldia de cada municipi i historial d'alcaldes des del 1979: Generalitat de Catalunya, <code>6nei-4b44</code>.</li>
    <li>Resultats de les dotze eleccions municipals des del 1979: Consorci AOC, <code>3539f7e6</code>.</li>
    <li>Padró: Generalitat de Catalunya, <code>6nei-4b44</code>.</li>
    ${
      data.llocs.some((m) => m.mayorPhoto !== null)
        ? "<li>Retrats de les alcaldies: seu electrònica de cada ajuntament, servida pel Consorci AOC a <code>seu-e.cat</code>. Cada cara ve del web del seu propi ajuntament i de cap altre lloc.</li>"
        : ""
    }
    ${
      data.retribucions
        ? "<li>Retribucions de les alcaldies: inventari de retribucions dels membres de les corporacions locals (ISPA 2025), Ministeri per a la Transformació Digital i de la Funció Pública.</li>"
        : ""
    }
    ${data.renda ? `<li>Renda neta per persona: INE, Atles de distribució de renda de les llars, sèrie 2015-${data.renda.any}.</li>` : ""}
    <li>Límits municipals del mapa: <a href="${escape(geometria.fontUrl)}" target="_blank" rel="noopener">${escape(geometria.font)}</a>,
      sota <a href="${escape(geometria.llicenciaUrl)}" target="_blank" rel="noopener">${escape(geometria.llicencia)}</a>.</li>
  </ul>
  <p class="nota">Quines candidatures són d'aquesta marca és un càlcul nostre i es pot reproduir
  amb el codi del projecte: surt de l'agrupació electoral que publica la Generalitat i, quan
  aquella no ho diu, de les sigles. Davant del dubte no s'atribueix res a ningú: una alcaldia mal
  assignada és una acusació, i val més una xifra curta que una de falsa. Cap frase d'aquesta
  pàgina l'ha escrita un model de llenguatge.</p>
</section>

</main>
${peu("../../", generatedAt)}

</body>
</html>`;
}

// --------------------------------------------------------------------- accés

/** Les marques de debò: «local» no hi és, perquè no és cap partit. */
const MARQUES = PARTY_BRANDS.filter((b) => b.id !== "local");
const ES_MARCA = new Set(MARQUES.map((b) => b.id));

/**
 * De quina marca és una candidatura.
 *
 * Primer l'agrupació electoral, que és el que la Generalitat publica i el que
 * `resolveBrand()` ja ha desat a `candidatures.brandId`. Quan allò diu «local»
 * o no diu res, es miren les sigles amb la mateixa funció que fa servir tota la
 * resta del projecte: hi ha coalicions locals registrades com a agrupació
 * d'electors que porten la marca escrita a les sigles («UA-PSC-CP»), i deixar-les
 * fora faria que un partit tingués menys regidories de les que té.
 *
 * Torna `null` quan cap de les dues coses no ho aclareix, i això vol dir que
 * aquella llista no compta enlloc: preferim una xifra curta a una d'inventada.
 */
export function marcaDe(brandId: string | null, sigles: string): string | null {
  if (brandId && ES_MARCA.has(brandId)) return brandId;
  const familia = siglesFamily(sigles);
  return familia && ES_MARCA.has(familia) ? familia : null;
}

/**
 * L'ordre amb què `candidatura.ts` reparteix els slugs dins d'un municipi.
 *
 * Aquesta funció és una **còpia deliberada** de l'ordenació de
 * `loadCandidatures()`, i ha de continuar sent-ne una: els slugs de les fitxes
 * de candidatura surten d'aquell ordre, i si aquí s'ordenés diferent tots els
 * enllaços d'aquesta pàgina anirien a la llista del costat o enlloc. Si un dia
 * allò canvia, això ha de canviar el mateix dia.
 */
function slugsDelMunicipi(
  llistes: readonly { id: number; sigles: string; votes: number; seats: number }[],
): Map<number, string> {
  const ambEscons = llistes
    .filter((l) => l.seats > 0)
    .sort((a, b) => b.seats - a.seats || b.votes - a.votes || a.sigles.localeCompare(b.sigles, "ca"));
  const slugs = assignaSlugs(ambEscons.map((l) => l.sigles));
  return new Map(ambEscons.map((l, i) => [l.id, slugs[i]!]));
}

/** L'any en què va començar un mandat: «2023-2027» → 2023. */
function anyDelMandat(term: string): number | null {
  const trobat = /^(\d{4})/.exec(term);
  return trobat ? Number(trobat[1]) : null;
}

type SerieAny = {
  year: number;
  seats: number;
  families: Record<string, number>;
  winnerFamily: string | null;
};
/** Un punt de la sèrie de padró que desa J18: `{ any, valor }`. */
type PuntPadro = { any: number; valor: number | null };

type AlcaldeHistoric = {
  term: string;
  name: string;
  partyRaw: string | null;
  tookOfficeOn: string | null;
};

/**
 * Un càrrec de la llista que publica una seu electrònica, retallat.
 *
 * De la fitxa de `carrecs` només se'n demanen tres camps. El document sencer
 * porta, per cada persona, el retrat gran, l'enllaç a la seva fitxa de seu-e i
 * el grup, i amb 464 municipis això és megabytes de JSON per quedar-se una
 * fotografia per poble: exactament el que fa petar PGlite amb «memory access
 * out of bounds», que és el motiu pel qual la sèrie de padró d'aquí sobre també
 * es demana retallada.
 *
 * L'ordre de la llista **s'ha de conservar** i per això es retalla amb
 * `jsonb_agg` sobre `jsonb_array_elements`, que el manté: l'adreça de la fitxa
 * de cada persona surt de `adrecesRegidors()` sobre aquesta mateixa llista i en
 * aquest mateix ordre, i si l'ordre canviés els enllaços anirien a la fitxa del
 * regidor del costat.
 */
type CarrecFitxa = { nom: string; carrec: string; fotoPetita: string | null };

/** El que consta a l'inventari del Ministeri sobre l'alcaldia d'un municipi. */
type RetribucioAlcaldia = {
  any: number | null;
  euros: number;
  /** `sou` (amb dedicació) · `assistencies` (per sessió) · `cap` (zero euros). */
  mena: "sou" | "assistencies" | "cap";
};

/**
 * Un camp concret d'una mètrica, com a text i sense portar-ne el document
 * sencer. És el mateix que fa `comarques.ts` i pel mateix motiu: el document
 * d'alcaldes porta l'historial des del 1979 de cada municipi i aquí només en
 * cal una part.
 */
const text = (column: SQLWrapper, path: string) =>
  sql<string | null>`${column}->>${sql.raw(`'${path.replace(/'/g, "''")}'`)}`;

const toNumber = (value: string | null): number | null => {
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/**
 * PGlite fa córrer Postgres dins de WebAssembly i el resultat d'una consulta hi
 * ha de cabre sencer. Les mètriques es demanen en blocs pel mateix motiu que
 * explica `metriques.ts`, i el pitjor d'aquell error és com peta: després
 * d'haver escrit part del web.
 */
const BLOC = 200;

async function enBlocs<T>(consulta: (limit: number, salta: number) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (let salta = 0; ; salta += BLOC) {
    const tros = await consulta(BLOC, salta);
    out.push(...tros);
    if (tros.length < BLOC) break;
  }
  return out;
}

/**
 * Carrega **totes** les marques d'un sol cop, com fa `loadCandidatures()`.
 *
 * Són com a molt disset pàgines, però cadascuna necessita els 947 municipis
 * sencers: fer-ho marca a marca voldria dir llegir els 947 disset vegades.
 */
export async function loadPartits(db: Db): Promise<PartitData[]> {
  const muns = await db
    .select({
      id: municipalities.id,
      slug: municipalities.slug,
      name: municipalities.name,
      comarca: municipalities.comarca,
      population: municipalities.population,
      populationYear: municipalities.populationYear,
      councilSeats: municipalities.councilSeats,
    })
    .from(municipalities);
  const munById = new Map(muns.map((m) => [m.id, m]));
  const poblacioCatalunya = muns.reduce((suma, m) => suma + (m.population ?? 0), 0);
  // De quin any és aquella xifra. Avui és el padró del 2025 als 947 municipis,
  // però es llegeix de la taula i no s'escriu aquí: la sèrie de més avall va
  // any per any i la pàgina ha de poder dir que la xifra gran és d'un altre any.
  const poblacioAny = muns.reduce<number | null>(
    (maxim, m) => (m.populationYear === null ? maxim : Math.max(maxim ?? m.populationYear, m.populationYear)),
    null,
  );

  const llistes = await db
    .select({
      id: candidatures.id,
      municipalityId: candidatures.municipalityId,
      sigles: candidatures.sigles,
      brandId: candidatures.brandId,
      votes: electionResults.votes,
      seats: electionResults.seats,
    })
    .from(candidatures)
    .innerJoin(electionResults, eq(electionResults.candidatureId, candidatures.id))
    .where(eq(candidatures.electionId, ELECCIO));

  const data = municipalityMetrics.data;

  const governRows = await enBlocs((limit, salta) =>
    db
      .select({
        municipalityId: municipalityMetrics.municipalityId,
        mayorName: text(data, "mayorName"),
        mayorSigles: text(data, "mayorSigles"),
        totalSeats: text(data, "totalSeats"),
      })
      .from(municipalityMetrics)
      .where(eq(municipalityMetrics.kind, "government"))
      .orderBy(municipalityMetrics.municipalityId)
      .limit(limit)
      .offset(salta),
  );

  const serieRows = await enBlocs((limit, salta) =>
    db
      .select({
        municipalityId: municipalityMetrics.municipalityId,
        series: sql<SerieAny[] | null>`${data}->'series'`,
      })
      .from(municipalityMetrics)
      .where(eq(municipalityMetrics.kind, "electoralHistory"))
      .orderBy(municipalityMetrics.municipalityId)
      .limit(limit)
      .offset(salta),
  );

  /**
   * El padró de cada municipi, any per any.
   *
   * Es demana només la sèrie del padró i no el document de població sencer, que
   * porta catorze indicadors amb la seva sèrie, els seus percentils i els seus
   * enllaços: amb 947 municipis, portar-ho tot per quedar-se una llista de set
   * parells és el que fa petar PGlite amb «memory access out of bounds».
   */
  const padroRows = await enBlocs((limit, salta) =>
    db
      .select({
        municipalityId: municipalityMetrics.municipalityId,
        padro: sql<
          PuntPadro[] | null
        >`jsonb_path_query_first(${data}, '$.indicadors[*] ? (@.clau == "padroHabitants").serie')`,
      })
      .from(municipalityMetrics)
      .where(eq(municipalityMetrics.kind, "poblacio"))
      .orderBy(municipalityMetrics.municipalityId)
      .limit(limit)
      .offset(salta),
  );

  const alcaldeRows = await enBlocs((limit, salta) =>
    db
      .select({
        municipalityId: municipalityMetrics.municipalityId,
        history: sql<AlcaldeHistoric[] | null>`${data}->'history'`,
      })
      .from(municipalityMetrics)
      .where(eq(municipalityMetrics.kind, "mayors"))
      .orderBy(municipalityMetrics.municipalityId)
      .limit(limit)
      .offset(salta),
  );

  /**
   * La llista de càrrecs que publica cada ajuntament a la seva seu electrònica.
   *
   * Només 464 dels 947 municipis en tenen: l'AOC hi serveix un mòdul que cada
   * ajuntament omple o no, i a Santa Coloma de Gramenet, amb 124.000 habitants,
   * no n'hi ha cap perquè hi publiquen un tauler incrustat. D'aquí en surt la
   * cara de l'alcaldia; el nom i les sigles ja els tenim dels 947 per la font
   * oficial de la Generalitat.
   */
  const carrecRows = await enBlocs((limit, salta) =>
    db
      .select({
        municipalityId: municipalityMetrics.municipalityId,
        carrecs: sql<CarrecFitxa[] | null>`(
          select jsonb_agg(jsonb_build_object(
            'nom', c->>'nom', 'carrec', c->>'carrec', 'fotoPetita', c->>'fotoPetita'
          ))
          from jsonb_array_elements(${data}->'carrecs') as c
        )`,
      })
      .from(municipalityMetrics)
      .where(eq(municipalityMetrics.kind, "carrecs"))
      .orderBy(municipalityMetrics.municipalityId)
      .limit(limit)
      .offset(salta),
  );

  /**
   * Qui seu a cada ple, dels 947, per poder enllaçar l'alcaldia amb la seva
   * fitxa de persona també allà on la seu electrònica no arriba.
   *
   * Es demanen els noms i prou. Serveixen per a dues coses i totes dues
   * necessiten la llista sencera del municipi i no només l'alcalde: saber si
   * aquell nom és **únic** al ple —si no ho fos, `adrecesRegidors()` hi
   * afegiria un sufix i l'enllaç aniria a la persona equivocada— i aparellar-lo
   * amb el nom que dona la font de govern, que no és la mateixa font.
   */
  const plenaris = await enBlocs((limit, salta) =>
    db
      .select({ municipalityId: councillorMandates.municipalityId, nom: people.fullName })
      .from(councillorMandates)
      .innerJoin(people, eq(people.id, councillorMandates.personId))
      .orderBy(councillorMandates.id)
      .limit(limit)
      .offset(salta),
  );

  /**
   * L'import que consta que cobra cada alcaldia, de l'inventari del Ministeri.
   *
   * 866 municipis dels 947. Els altres 81 **no ho han comunicat**, que no és el
   * mateix que no cobrar; la pàgina no els compta enlloc i diu quants són.
   */
  const retribucioRows = await enBlocs((limit, salta) =>
    db
      .select({
        municipalityId: municipalityMetrics.municipalityId,
        any: sql<string | null>`${data}#>>'{ministeri,any}'`,
        euros: sql<string | null>`${data}#>>'{ministeri,alcaldia,euros}'`,
        mena: sql<string | null>`${data}#>>'{ministeri,alcaldia,mena}'`,
      })
      .from(municipalityMetrics)
      .where(eq(municipalityMetrics.kind, "retribucions"))
      .orderBy(municipalityMetrics.municipalityId)
      .limit(limit)
      .offset(salta),
  );

  /**
   * La renda neta per persona de cada municipi, de l'Atles de l'INE.
   *
   * Es demana un sol indicador dels sis que desa J23 i sense la seva sèrie, pel
   * mateix motiu que el padró: el document sencer porta sis indicadors amb nou
   * anys de sèrie, percentils i comparacions per a cada municipi.
   */
  const rendaRows = await enBlocs((limit, salta) =>
    db
      .select({
        municipalityId: municipalityMetrics.municipalityId,
        any: sql<string | null>`${data}->>'any'`,
        valor: sql<string | null>`jsonb_path_query_first(
          ${data}, '$.indicadors[*] ? (@.clau == "rendaNetaPersona").valor'
        )#>>'{}'`,
      })
      .from(municipalityMetrics)
      .where(eq(municipalityMetrics.kind, "riquesa"))
      .orderBy(municipalityMetrics.municipalityId)
      .limit(limit)
      .offset(salta),
  );

  // ---- índexs per municipi

  const perMunicipi = new Map<number, typeof llistes>();
  for (const l of llistes) {
    const seves = perMunicipi.get(l.municipalityId) ?? [];
    seves.push(l);
    perMunicipi.set(l.municipalityId, seves);
  }
  const govern = new Map(governRows.map((r) => [r.municipalityId, r]));

  /**
   * La cara i la fitxa de qui mana a cada municipi.
   *
   * **La regla dura és que el nom i el retrat han de sortir de la mateixa
   * persona.** El nom de l'alcaldia i les sigles amb què aquesta pàgina
   * atribueix el municipi a una marca vénen de la composició del ple de la
   * Generalitat; la cara ve de la seu electrònica de l'ajuntament. Quan totes
   * dues anomenen la mateixa persona, hi va la cara; quan diuen noms diferents
   * —hi ha hagut relleu i una de les dues no ho sap encara— no s'hi posa res.
   *
   * Val la pena escriure el preu: `radiografia.ts` busca la paraula «alcald»
   * dins de la llista de la seu electrònica i això en troba 455 de 464, contra
   * les 419 que lliguen pel nom. Allà és correcte, perquè aquella fitxa escriu
   * el nom que dona la seu electrònica al costat de la seva pròpia cara. Aquí
   * el nom que s'escriu és l'altre, i en 19 municipis les dues fonts no diuen
   * la mateixa persona: agafar la cara de la seu electrònica hi posaria el
   * retrat d'algú sota el nom d'algú altre. Són 293 alcaldies amb cara en
   * comptes de 326, i el canvi val els 33.
   *
   * L'enllaç a la fitxa de persona, en canvi, arriba molt més lluny: n'hi ha
   * per als 947 municipis —les de la seu electrònica quan n'hi ha i les de la
   * font electoral als altres 483— i el nom de l'alcaldia lliga amb el ple en
   * 901 dels 947. On la seu electrònica publica la llista, l'adreça ha de
   * sortir d'ella, perquè és d'ella que surten els directoris que escriu
   * `publish.ts`; on no, del ple, i només si el nom hi és una sola vegada.
   */
  const caraAlcaldia = new Map<number, { foto: string | null; adreca: string }>();
  const noms = new Map<number, string[]>();
  for (const fila of plenaris) {
    const llista = noms.get(fila.municipalityId) ?? [];
    llista.push(fila.nom);
    noms.set(fila.municipalityId, llista);
  }
  const deLaSeu = new Map(carrecRows.map((r) => [r.municipalityId, r.carrecs ?? []]));
  for (const [municipalityId, g] of govern) {
    if (!g.mayorName) continue;
    const clauNom = normalizePersonName(g.mayorName);
    const carrecs = deLaSeu.get(municipalityId) ?? [];
    if (carrecs.length > 0) {
      const fitxa = carrecs.find((c) => normalizePersonName(c.nom) === clauNom);
      if (fitxa) {
        caraAlcaldia.set(municipalityId, {
          foto: fitxa.fotoPetita,
          adreca: adrecesRegidors(carrecs).get(fitxa)!,
        });
      }
      continue;
    }
    // Sense seu electrònica no hi ha retrat, però la fitxa de persona hi és
    // igual. El sufix de desambiguació de `adrecesRegidors()` només apareix
    // quan un nom es repeteix al ple; si es repetís, l'enllaç podria anar a
    // l'altra persona i val més no posar-n'hi cap.
    const alPle = (noms.get(municipalityId) ?? []).filter((n) => normalizePersonName(n) === clauNom);
    if (alPle.length === 1) caraAlcaldia.set(municipalityId, { foto: null, adreca: slugify(alPle[0]!) });
  }

  /**
   * L'import de cada alcaldia i el tram de població del seu municipi.
   *
   * El tram és el de la LOREG i el reparteix `buildPeerGroups()`, que és la
   * mateixa funció que fa servir la radiografia, la comarca i el comparador:
   * si aquí es fessin uns altres trams, la mateixa alcaldia sortiria a un grup
   * a una pàgina i a un altre a la del costat.
   */
  const retribucions = new Map<number, RetribucioAlcaldia>();
  for (const fila of retribucioRows) {
    const euros = toNumber(fila.euros);
    const mena = fila.mena;
    if (euros === null || (mena !== "sou" && mena !== "assistencies" && mena !== "cap")) continue;
    retribucions.set(fila.municipalityId, { any: toNumber(fila.any), euros, mena });
  }
  const trams = buildPeerGroups(muns);
  /** La mediana de totes les alcaldies del tram, sigui de qui sigui la marca. */
  const importsPerTram = new Map<string, number[]>();
  /**
   * De més petit a més gran, per poder ordenar la taula per mida i no per
   * casualitat. La clau del grup és «t{primer}-{últim}», amb els índexs dels
   * trams de la LOREG, i el primer número ja diu on cau el grup.
   */
  const midaDelTram = new Map<string, number>();
  for (const [municipalityId, r] of retribucions) {
    const tram = trams.get(municipalityId);
    if (!tram) continue;
    const llista = importsPerTram.get(tram.label) ?? [];
    llista.push(r.euros);
    importsPerTram.set(tram.label, llista);
    midaDelTram.set(tram.label, Number(/^t(\d+)/.exec(tram.key)?.[1] ?? 0));
  }
  const medianaCatalunyaRetribucio = medianOf([...retribucions.values()].map((r) => r.euros));
  const anyRetribucions =
    [...retribucions.values()].reduce<number | null>((any, r) => any ?? r.any, null) ?? null;

  /** La renda neta per persona de cada municipi, quan l'INE no la tapa. */
  const renda = new Map<number, number>();
  let anyRenda: number | null = null;
  for (const fila of rendaRows) {
    anyRenda = anyRenda ?? toNumber(fila.any);
    const valor = toNumber(fila.valor);
    if (valor !== null) renda.set(fila.municipalityId, valor);
  }
  const medianaCatalunyaRenda = medianOf([...renda.values()]);

  /**
   * Padró per municipi i any, i el total de Catalunya del mateix any.
   *
   * `anysPadroComplet` són els anys en què la font cobreix els 947 municipis, i
   * és el que decideix fins on arriba la sèrie de població governada. No hi ha
   * cap llista d'anys escrita a mà enlloc: si un any el padró només cobrís nou
   * municipis de cada deu, la suma de Catalunya seria menor de la que és i el
   * percentatge de cada marca sortiria inflat sense que ningú ho notés.
   */
  const padro = new Map<number, Map<number, number>>();
  const padroCatalunya = new Map<number, number>();
  const municipisAmbPadro = new Map<number, number>();
  for (const fila of padroRows) {
    const perAny = new Map<number, number>();
    for (const punt of fila.padro ?? []) {
      if (punt.valor === null || !Number.isFinite(punt.valor)) continue;
      perAny.set(punt.any, punt.valor);
      padroCatalunya.set(punt.any, (padroCatalunya.get(punt.any) ?? 0) + punt.valor);
      municipisAmbPadro.set(punt.any, (municipisAmbPadro.get(punt.any) ?? 0) + 1);
    }
    padro.set(fila.municipalityId, perAny);
  }
  const anysPadroComplet = new Set(
    [...municipisAmbPadro].filter(([, quants]) => quants === muns.length).map(([any]) => any),
  );

  // ---- el mandat d'ara, municipi a municipi

  const llocsPerMarca = new Map<string, PartitMunicipi[]>();
  const votsPerMarca = new Map<string, number>();
  const regidoriesPerMarca = new Map<string, number>();
  /**
   * Els habitants que governa ara segons el padró del **2023**, no el d'avui.
   *
   * És el punt del 2023 de la sèrie llarga, i ha de venir del mateix any que
   * els altres dos punts; la xifra de la capçalera, que és la població d'avui
   * d'aquests mateixos municipis, es calcula a part. Són dues preguntes
   * diferents —quanta gent hi vivia llavors i quanta n'hi viu ara— i barrejar-
   * les faria que l'últim punt de la corba pugés per un canvi de font.
   */
  const poblacioAraPerMarca = new Map<string, number>();
  const alcaldiesPerMarca = new Map<string, number[]>();
  let votsCatalunya = 0;

  for (const [municipalityId, seves] of perMunicipi) {
    const municipi = munById.get(municipalityId);
    if (!municipi) continue;
    const g = govern.get(municipalityId);
    // El ple del 2023 tal com el compta la mètrica de govern; si no hi és, la
    // suma de les regidories repartides, i encara com a últim recurs el nombre
    // d'escons que consta al padró de l'ens.
    const totalSeats =
      toNumber(g?.totalSeats ?? null) ??
      (seves.reduce((suma, l) => suma + l.seats, 0) || municipi.councilSeats || 0);
    const majoria = absoluteMajority(totalSeats);
    votsCatalunya += seves.reduce((suma, l) => suma + l.votes, 0);

    const slugs = slugsDelMunicipi(seves);

    /**
     * De quina candidatura és l'alcaldia.
     *
     * Primer per les sigles exactes, amb la clau dura de `candidatura.ts` —la
     * font de la composició del ple escriu «PSC - CP» on el dataset electoral
     * escriu «PSC-CP»— i, si allò no lliga, per família de sigles i només quan
     * una sola llista d'aquell ple hi encaixa. Si n'hi encaixen dues no se'n
     * tria cap: atribuir una alcaldia a la llista equivocada és el pitjor error
     * que pot cometre aquesta pàgina.
     */
    let alcaldiaDe: number | null = null;
    if (g?.mayorSigles) {
      const k = clau(g.mayorSigles);
      const exactes = seves.filter((l) => clau(l.sigles) === k);
      if (exactes.length === 1) alcaldiaDe = exactes[0]!.id;
      else {
        const familia = siglesFamily(g.mayorSigles);
        const candidates = familia
          ? seves.filter((l) => l.seats > 0 && marcaDe(l.brandId, l.sigles) === familia)
          : [];
        if (candidates.length === 1) alcaldiaDe = candidates[0]!.id;
      }
    }

    for (const l of seves) {
      const marca = marcaDe(l.brandId, l.sigles);
      if (!marca) continue;
      votsPerMarca.set(marca, (votsPerMarca.get(marca) ?? 0) + l.votes);
      if (l.id === alcaldiaDe) {
        const habitants = padro.get(municipalityId)?.get(ANY_ARA) ?? 0;
        poblacioAraPerMarca.set(marca, (poblacioAraPerMarca.get(marca) ?? 0) + habitants);
        // Els identificadors dels municipis que governa, que és el que
        // necessiten els blocs de retribucions i de renda: `PartitMunicipi` no
        // porta l'`id` de la base perquè no és cap dada de la pàgina.
        alcaldiesPerMarca.set(marca, [...(alcaldiesPerMarca.get(marca) ?? []), municipalityId]);
      }
      if (l.seats === 0 && l.id !== alcaldiaDe) continue;
      regidoriesPerMarca.set(marca, (regidoriesPerMarca.get(marca) ?? 0) + l.seats);
      const llista = llocsPerMarca.get(marca) ?? [];
      llista.push({
        slug: municipi.slug,
        name: municipi.name,
        comarca: municipi.comarca,
        population: municipi.population ?? 0,
        sigles: l.sigles,
        candidatura: slugs.get(l.id) ?? null,
        seats: l.seats,
        totalSeats,
        alcaldia: l.id === alcaldiaDe,
        mayorName: l.id === alcaldiaDe ? g?.mayorName ?? null : null,
        mayorPhoto: l.id === alcaldiaDe ? caraAlcaldia.get(municipalityId)?.foto ?? null : null,
        mayorSlug: l.id === alcaldiaDe ? caraAlcaldia.get(municipalityId)?.adreca ?? null : null,
        majoria: l.id === alcaldiaDe && majoria > 0 && l.seats >= majoria,
      });
      llocsPerMarca.set(marca, llista);
    }
  }

  // ---- la sèrie de regidories des del 1979, del conjunt de l'AOC

  const regidoriesAny = new Map<number, Map<string, number>>();
  const guanyatsAny = new Map<number, Map<string, number>>();
  const totalAny = new Map<number, number>();
  const municipisAny = new Map<number, number>();
  for (const fila of serieRows) {
    for (const punt of fila.series ?? []) {
      totalAny.set(punt.year, (totalAny.get(punt.year) ?? 0) + punt.seats);
      municipisAny.set(punt.year, (municipisAny.get(punt.year) ?? 0) + 1);
      const perMarca = regidoriesAny.get(punt.year) ?? new Map<string, number>();
      for (const [familia, escons] of Object.entries(punt.families ?? {})) {
        if (!ES_MARCA.has(familia)) continue;
        perMarca.set(familia, (perMarca.get(familia) ?? 0) + escons);
      }
      regidoriesAny.set(punt.year, perMarca);
      if (punt.winnerFamily && ES_MARCA.has(punt.winnerFamily)) {
        const guanyats = guanyatsAny.get(punt.year) ?? new Map<string, number>();
        guanyats.set(punt.winnerFamily, (guanyats.get(punt.winnerFamily) ?? 0) + 1);
        guanyatsAny.set(punt.year, guanyats);
      }
    }
  }

  // ---- les alcaldies de cada mandat, de l'historial d'alcaldes
  //
  // Es compta **el primer alcalde de cada mandat** i no tots els que hi ha
  // passat: qui entra per una moció de censura a mig camí no va guanyar aquella
  // elecció, i comptar-lo faria que la suma d'un any superés els 947.

  const alcaldiesAny = new Map<number, Map<string, number>>();
  /**
   * Els habitants d'aquells municipis el mateix any de l'elecció.
   *
   * Només per als anys en què el padró cobreix els 947: als altres la suma
   * seria una xifra curta que semblaria una davallada de la marca quan seria un
   * forat de la font, que és el mateix error que les dues sèries de dalt eviten
   * amb la comprovació contra el 2023.
   */
  const poblacioGovernadaAny = new Map<number, Map<string, number>>();
  for (const fila of alcaldeRows) {
    const perMandat = new Map<string, AlcaldeHistoric>();
    for (const alcalde of fila.history ?? []) {
      const previ = perMandat.get(alcalde.term);
      const abans =
        !previ ||
        (alcalde.tookOfficeOn !== null &&
          (previ.tookOfficeOn === null || alcalde.tookOfficeOn < previ.tookOfficeOn));
      if (abans) perMandat.set(alcalde.term, alcalde);
    }
    for (const [term, alcalde] of perMandat) {
      const year = anyDelMandat(term);
      if (year === null || !alcalde.partyRaw) continue;
      const familia = siglesFamily(alcalde.partyRaw);
      if (!familia || !ES_MARCA.has(familia)) continue;
      const perMarca = alcaldiesAny.get(year) ?? new Map<string, number>();
      perMarca.set(familia, (perMarca.get(familia) ?? 0) + 1);
      alcaldiesAny.set(year, perMarca);

      if (!anysPadroComplet.has(year)) continue;
      const habitants = padro.get(fila.municipalityId)?.get(year) ?? 0;
      const poblacioPerMarca = poblacioGovernadaAny.get(year) ?? new Map<string, number>();
      poblacioPerMarca.set(familia, (poblacioPerMarca.get(familia) ?? 0) + habitants);
      poblacioGovernadaAny.set(year, poblacioPerMarca);
    }
  }

  const anys = [...new Set([...totalAny.keys(), ...alcaldiesAny.keys()])].sort((a, b) => a - b);

  // ---- una pàgina per marca amb alguna alcaldia o alguna regidoria ara

  const ambPagina = MARQUES.filter((brand) => {
    const llocs = llocsPerMarca.get(brand.id) ?? [];
    return llocs.some((m) => m.alcaldia) || (regidoriesPerMarca.get(brand.id) ?? 0) > 0;
  });

  const resum = ambPagina.map((brand) => {
    const llocs = llocsPerMarca.get(brand.id) ?? [];
    return {
      id: brand.id,
      sigles: siglesDe(brand.id),
      color: colorDe(brand.id),
      alcaldies: llocs.filter((m) => m.alcaldia).length,
      regidories: regidoriesPerMarca.get(brand.id) ?? 0,
    };
  });
  resum.sort((a, b) => b.alcaldies - a.alcaldies || b.regidories - a.regidories);

  /** El mínim d'alcaldies amb import perquè una fila de tram vulgui dir res. */
  const MINIM_TRAM = 3;

  /**
   * Les retribucions de les alcaldies d'una marca, tram per tram.
   *
   * La mediana global hi és perquè és el que demana qualsevol lector —«quant
   * cobren les alcaldies d'aquest partit»— però la comparació **no** es fa amb
   * ella: es fa dins de cada tram de població, que és l'única manera que la
   * xifra digui alguna cosa del partit i no de la mida dels pobles que governa.
   * Els trams amb menys de tres alcaldies amb import no surten: una «mediana»
   * de dues xifres és les dues xifres, i publicar-la com si fos una mitjana del
   * partit seria fer passar una persona per una tendència.
   */
  const retribucionsDe = (ids: readonly number[]): PartitRetribucions | null => {
    if (ids.length === 0) return null;
    const seves = ids
      .map((id) => ({ id, r: retribucions.get(id) }))
      .filter((x): x is { id: number; r: RetribucioAlcaldia } => x.r !== undefined);
    if (seves.length === 0) return null;
    const imports = seves.map((x) => x.r.euros);
    const perTram = new Map<string, number[]>();
    for (const { id, r } of seves) {
      const tram = trams.get(id);
      if (!tram) continue;
      perTram.set(tram.label, [...(perTram.get(tram.label) ?? []), r.euros]);
    }
    /** Quantes alcaldies té la marca a cada tram, tinguin import o no. */
    const alcaldiesPerTram = new Map<string, number>();
    for (const id of ids) {
      const tram = trams.get(id);
      if (tram) alcaldiesPerTram.set(tram.label, (alcaldiesPerTram.get(tram.label) ?? 0) + 1);
    }
    // Del tram més gran al més petit, com la llista d'«On mana»: la pàgina
    // sencera va de més població a menys i la taula no pot anar a la seva.
    const ordre = [...perTram.keys()].sort(
      (a, b) => (midaDelTram.get(b) ?? 0) - (midaDelTram.get(a) ?? 0),
    );
    return {
      any: anyRetribucions,
      alcaldies: ids.length,
      ambImport: seves.length,
      senseComunicar: ids.length - seves.length,
      ambDedicacio: seves.filter((x) => x.r.mena === "sou").length,
      nomesAssistencies: seves.filter((x) => x.r.mena === "assistencies").length,
      senseCapImport: seves.filter((x) => x.r.mena === "cap").length,
      mediana: medianOf(imports),
      media: imports.length === 0 ? null : imports.reduce((a, b) => a + b, 0) / imports.length,
      medianaCatalunya: medianaCatalunyaRetribucio,
      municipisAmbDada: retribucions.size,
      municipisTotals: muns.length,
      trams: ordre
        .filter((label) => (perTram.get(label)?.length ?? 0) >= MINIM_TRAM)
        .map((label) => ({
          tram: label,
          alcaldies: alcaldiesPerTram.get(label) ?? 0,
          ambImport: perTram.get(label)!.length,
          mediana: medianOf(perTram.get(label)!),
          medianaTram: medianOf(importsPerTram.get(label) ?? []),
          alcaldiesTram: importsPerTram.get(label)?.length ?? 0,
        })),
    };
  };

  /** La renda dels municipis on mana una marca. Context, mai resultat seu. */
  const rendaDe = (ids: readonly number[]): PartitRenda | null => {
    if (anyRenda === null || ids.length === 0) return null;
    const seus = ids
      .map((id) => ({ municipi: munById.get(id), valor: renda.get(id) }))
      .filter((x): x is { municipi: NonNullable<typeof x.municipi>; valor: number } =>
        x.municipi !== undefined && x.valor !== undefined,
      );
    if (seus.length === 0) return null;
    const ordenats = [...seus].sort((a, b) => a.valor - b.valor);
    const extrem = (x: (typeof ordenats)[number]) => ({
      name: x.municipi.name,
      slug: x.municipi.slug,
      valor: x.valor,
    });
    return {
      any: anyRenda,
      municipis: ids.length,
      ambDada: seus.length,
      mediana: medianOf(seus.map((x) => x.valor)),
      medianaCatalunya: medianaCatalunyaRenda,
      municipisCatalunyaAmbDada: renda.size,
      // Els extrems només tenen sentit quan n'hi ha uns quants: amb dues
      // alcaldies, «la més pobra i la més rica» són les dues que té.
      mesBaixa: seus.length >= MINIM_TRAM ? extrem(ordenats[0]!) : null,
      mesAlta: seus.length >= MINIM_TRAM ? extrem(ordenats[ordenats.length - 1]!) : null,
    };
  };

  return ambPagina.map((brand): PartitData => {
    const llocs = [...(llocsPerMarca.get(brand.id) ?? [])].sort(
      (a, b) => b.population - a.population || a.name.localeCompare(b.name, "ca"),
    );
    const mana = llocs.filter((m) => m.alcaldia);
    const regidories = regidoriesPerMarca.get(brand.id) ?? 0;

    const serie: PartitEleccio[] = anys.map((year) => ({
      year,
      regidories: regidoriesAny.get(year)?.get(brand.id) ?? (totalAny.has(year) ? 0 : null),
      regidoriesCatalunya: totalAny.get(year) ?? 0,
      guanyats: totalAny.has(year) ? guanyatsAny.get(year)?.get(brand.id) ?? 0 : null,
      alcaldies:
        year === ANY_ARA
          ? mana.length
          : alcaldiesAny.has(year)
            ? alcaldiesAny.get(year)?.get(brand.id) ?? 0
            : null,
      municipisAmbSerie: municipisAny.get(year) ?? 0,
    }));

    /**
     * La població governada, un punt per convocatòria amb padró.
     *
     * El punt del 2023 surt de la llista de municipis d'aquesta pàgina —la
     * mateixa que hi ha a «On mana»— i els anteriors de l'historial d'alcaldes,
     * exactament com fa la sèrie d'alcaldies d'aquí sobre. Són dues maneres de
     * comptar i la pàgina ho diu; el que no es pot fer és que les dues corbes
     * de la mateixa pàgina comptin l'últim punt de manera diferent.
     */
    const poblacioSerie: PartitPoblacio[] = anys
      .filter((year) => anysPadroComplet.has(year))
      .map((year) => ({
        year,
        alcaldies:
          year === ANY_ARA ? mana.length : (alcaldiesAny.get(year)?.get(brand.id) ?? 0),
        habitants:
          year === ANY_ARA
            ? (poblacioAraPerMarca.get(brand.id) ?? 0)
            : (poblacioGovernadaAny.get(year)?.get(brand.id) ?? 0),
        catalunya: padroCatalunya.get(year) ?? 0,
      }));

    // Les dues comprovacions contra l'any que sabem de cert. Amb el 2023 a
    // zero i desenes d'alcaldies de veritat, la sèrie no és d'aquesta marca.
    const serieRegidories2023 = regidoriesAny.get(ANY_ARA)?.get(brand.id) ?? 0;
    const serieAlcaldies2023 = alcaldiesAny.get(ANY_ARA)?.get(brand.id) ?? 0;

    return {
      id: brand.id,
      sigles: siglesDe(brand.id),
      name: brand.name,
      kind: brand.kind,
      color: colorDe(brand.id),
      lineage: brand.lineage ?? null,
      lineageSigles: brand.lineage ? siglesDe(brand.lineage) : null,

      alcaldies: mana.length,
      regidories,
      municipis: llocs.length,
      comarques: new Set(mana.map((m) => m.comarca).filter(Boolean)).size,
      majories: mana.filter((m) => m.majoria).length,

      poblacioGovernada: mana.reduce((suma, m) => suma + m.population, 0),
      poblacioCatalunya,
      poblacioAny,
      vots: votsPerMarca.get(brand.id) ?? 0,
      votsCatalunya,

      llocs,
      serie,
      poblacioSerie,
      serieRegidoriesFiable: acorden(serieRegidories2023, regidories),
      serieAlcaldiesFiable: acorden(serieAlcaldies2023, mana.length),
      serieRegidories2023,
      serieAlcaldies2023,

      retribucions: retribucionsDe(alcaldiesPerMarca.get(brand.id) ?? []),
      renda: rendaDe(alcaldiesPerMarca.get(brand.id) ?? []),

      altres: resum.filter((a) => a.id !== brand.id),
    };
  });
}
