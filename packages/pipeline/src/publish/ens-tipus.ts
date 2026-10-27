/**
 * El contracte de les fitxes dels ens supramunicipals: les quatre diputacions
 * i els consells comarcals.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PER QUÈ UN FITXER NOMÉS DE TIPUS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * La feina passa per tres mans que no es veuen entre elles: la J38 desa a la
 * base de dades el que diuen les fonts (`EnsDesat`), el carregador
 * (`ens-dades.ts`) hi afegeix el que només sap el publicador —les adreces de
 * les fitxes de persona, les fotos, els sous de la J24 i la J30— i les pàgines
 * (`ens.ts`, `ens-index.ts`) en pinten el resultat (`DadesEns`). Aquest fitxer
 * és l'única cosa que totes tres comparteixen, i per això no importa res de
 * cap d'elles.
 *
 * Les regles de sempre hi valen igual:
 *
 *   · **Un buit és un buit.** Si una font no publica una dada, el camp és
 *     `null` i la pàgina diu «no consta»; mai no es converteix en un zero.
 *   · **Res no se suma entre pagadors.** El sou d'una persona a la diputació i
 *     el del seu ajuntament viuen en llocs diferents i no es fan mai un total.
 *   · **Una persona només s'enllaça si l'aparellament és únic.** Si el nom pot
 *     ser de dues persones, no és de cap.
 *
 * On ho desa la J38: a `municipality_metrics`, al municipi que és la **seu**
 * de l'ens segons el registre d'ens locals (`6nei-4b44.codi_municipi`), amb
 * els kinds `KIND_DIPUTACIO` i `KIND_CONSELL`. Girona és seu de tots dos i per
 * això són dos kinds i no un.
 */

// Només tipus: les dues formes que desen la J41 i la J42 viatgen tal qual fins
// a la pàgina, i redefinir-les aquí seria tenir dues veritats.
import type { DinersGeneralitatEnsDesat } from "../jobs/j41-diners-generalitat";
import type { ServeisEnsDesats } from "../jobs/j42-serveis-ens";

export const KIND_DIPUTACIO = "ensDiputacio";
export const KIND_CONSELL = "ensConsell";

export type TipusEns = "diputacio" | "consell";

/** Una font tal com la cita el peu de la pàgina. */
export type FontEns = {
  nom: string;
  url: string;
  llicencia: string | null;
  /** Data de consulta, `AAAA-MM-DD`. */
  consultat: string | null;
};

/** El paper de cada membre dins l'ens, deduït del text del càrrec. */
export type RolEns = "presidencia" | "vicepresidencia" | "membre";

// ─────────────────────────────────────────────────────────────────────────────
// El que desa la J38
// ─────────────────────────────────────────────────────────────────────────────

/** Un membre del ple de l'ens, tal com l'escriuen les fonts. */
export type MembreDesat = {
  /** El nom tal com el publica la font (sovint en majúscules o amb «(Ind.)»). */
  nom: string;
  /** El càrrec literal: «Presidenta», «Vicepresident 1r», «Conseller»… */
  carrec: string;
  rol: RolEns;
  /** L'ordre del registre, si n'hi ha. */
  ordre: number | null;
  /** Les sigles amb què hi seu, si la font les dona. */
  partit: string | null;
  /** D'on surt `partit`: de l'ens mateix o del seu ple municipal. */
  partitFont: "ens" | "ple municipal" | null;
  /**
   * El municipi del qual és regidor o regidora, si es pot saber: pel camp
   * `municipi_representa` del registre de plens o per un aparellament de nom
   * únic amb els plens municipals. `municipalityId` de la nostra base.
   */
  municipalityId: number | null;
  /** Com s'ha sabut el municipi. */
  municipiFont: "registre" | "aparellament" | null;
  /** Cert si té l'alcaldia d'aquell municipi. */
  alcaldia: boolean;
  /**
   * El nom amb què la persona seu al ple municipal, si la J38 l'hi ha aparellat
   * (per inicials, per cognoms dins del seu municipi…). El carregador hi busca
   * l'adreça, la cara i el sou amb aquest nom i no amb el de la font de l'ens,
   * que sovint l'escriu d'una altra manera («Eva M. Martinez Morales»).
   * Opcional perquè les dades desades abans no el porten.
   */
  nomAlPle?: string | null;
};

/** Una partida de la liquidació (classificació econòmica, per capítols). */
export type CapitolDesat = {
  tipus: "ingressos" | "despeses";
  capitol: number;
  nom: string;
  /** Drets reconeguts o obligacions reconegudes, en euros. */
  liquidat: number | null;
  pressupostat: number | null;
};

/** Una línia de la despesa per programes (classificació per programes). */
export type ProgramaDesat = {
  codi: string;
  nom: string;
  /** 1 = àrea de despesa, 2 = política de despesa. */
  nivell: number;
  /** Obligacions reconegudes, en euros. */
  obligacions: number | null;
};

export type FinancesDesades = {
  /** Un any per exercici liquidat, de l'antic al recent. */
  anys: { any: number; capitols: CapitolDesat[] }[];
  /** La despesa per programes de l'últim exercici que en té. */
  programes: { any: number; files: ProgramaDesat[] } | null;
  /** Deute viu a 31 de desembre, si l'ens en declara. */
  deute: { any: number; deuteViu: number }[];
  fonts: FontEns[];
};

/** L'ens sencer, tal com la J38 el desa a la base. */
export type EnsDesat = {
  tipus: TipusEns;
  /** Codi d'ens de 10 xifres del registre de la Generalitat. */
  codiEns: string;
  /** «Diputació de Barcelona», «Consell Comarcal del Bages». */
  nom: string;
  /** El territori: «Barcelona», «Bages». */
  territori: string;
  /** L'article del territori quan en porta: «el Bages», «l'Anoia». */
  article: string | null;
  /** El municipi seu (`municipalityId`) segons el registre. */
  seuMunicipalityId: number | null;
  cif: string | null;
  /** El gerent o la gerent, tal com ho escriu el registre. */
  gerent: string | null;
  /** La fitxa al Municat. */
  municat: string | null;
  web: string | null;
  /** Escons del ple segons el registre de plens (encara que no hi hagi noms). */
  seients: number;
  membres: MembreDesat[];
  finances: FinancesDesades | null;
  /**
   * Només diputacions: els districtes electorals amb què es reparteixen els
   * escons (LOREG art. 204.3: els partits judicials **del 1979**, que són la
   * columna `partit_electoral` d'`ehvx-5ty7`, no els d'avui). Els escons de cada
   * districte els calcula `derive/escons-ens.ts`; aquí només hi ha qui hi va.
   */
  districtes: { nom: string; municipalityIds: number[] }[] | null;
  /** Ítem de Wikidata, si l'aparellament és segur. */
  wikidata: string | null;
  /** L'escut o emblema oficial (`2zbw-miu8`), si l'ens en té de propi. */
  escut: { url: string; font: FontEns } | null;
  fonts: FontEns[];
  /** Avisos de cobertura que la pàgina ha de dir (p. ex. «la font no publica els noms»). */
  avisos: string[];
  consultat: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// El que reben les pàgines
// ─────────────────────────────────────────────────────────────────────────────

/** El sou que publica l'ens mateix per a aquella persona (J24 o J30). */
export type RetribucioMembre = {
  anualBrut: number | null;
  dedicacio: string | null;
  /** «Màxim per assistències»: un sostre anual, mai un import cobrat. */
  sostreAssistencies: number | null;
  /** Per què no hi ha import, quan no n'hi ha. */
  motiu: string | null;
  font: FontEns | null;
};

export type MembreEns = Omit<MembreDesat, "municipalityId"> & {
  /** El municipi que representa, amb l'adreça de la seva fitxa (`m/<slug>/`). */
  municipi: { slug: string; nom: string } | null;
  /**
   * L'adreça de la fitxa de persona dins el municipi (`regidor/<slug>/`), si
   * l'aparellament amb el ple municipal és únic. Relativa a `m/<slug>/`.
   */
  adreca: string | null;
  foto: string | null;
  retribucio: RetribucioMembre | null;
  /**
   * La clau comparable del partit: la mateixa amb què es fa `composicio` i el
   * repartiment («PSC», «Junts», «ERC», «Comuns»…). `partit` és l'etiqueta
   * literal de la font («PSC-CP», «TriasxBCN-CM») i només es mostra en petit;
   * els membres s'agrupen per `grup`. `SENSE_PARTIT` si no se sap.
   */
  grup: string;
  /** El color de dada del partit (mai un color de veredicte). */
  color: string | null;
};

/** Un municipi de l'àmbit de l'ens, per a la llista i el mapa. */
export type MunicipiEns = {
  slug: string;
  nom: string;
  comarca: string | null;
  poblacio: number | null;
  /**
   * Quants membres de l'ens en surten. És `null` si algun membre de l'ens no té
   * el municipi conegut: llavors un 0 no es pot afirmar, perquè potser és d'aquí.
   */
  membres: number | null;
};

export type DadesEns = Omit<EnsDesat, "membres" | "seuMunicipalityId"> & {
  /**
   * El slug pelat del territori («barcelona», «alt-camp»), sense barres. L'adreça
   * sencera la dona sempre `adrecaEns(tipus, slug)`.
   */
  slug: string;
  seu: { slug: string; nom: string } | null;
  membres: MembreEns[];
  /** Escons per partit, de més a menys, amb els que no se sap el partit al final. */
  composicio: { partit: string; seients: number; color: string | null }[];
  presidencia: MembreEns | null;
  municipis: MunicipiEns[];
  /** Població de l'àmbit (suma del padró dels municipis), per fer euros per habitant. */
  poblacio: number | null;
  /** Per als consells: la comarca germana (`c/<slug>/`). Per a les diputacions: null. */
  comarca: { slug: string; nom: string } | null;
  /** Per a les diputacions: les comarques (senceres o en part) de la demarcació. */
  comarques: { slug: string; nom: string }[];
  repartiment: RepartimentEns | null;
  subvencions: SubvencionsEns | null;
  /** Serveis socials bàsics (consells) i agregats de contractació (J42), si n'hi ha. */
  serveis?: ServeisEnsDesats | null;
  /** Fons de Cooperació Local, obres del PUOSC, comptes tramesos i pendents de la Generalitat (J41). */
  dinersGeneralitat?: DinersGeneralitatEnsDesat | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Com hi arriben: el repartiment que fa la llei amb els vots del 2023
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El que calcula `derive/escons-ens.ts` amb els resultats municipals de 2023 i
 * les regles de la llei (LOREG art. 204-206 per a les diputacions; DL 4/2003
 * art. 20 per als consells). La pàgina el posa al costat de la composició
 * real: si quadren, el càlcul explica el ple; si no, ho diu i no l'ensenya
 * com si fos el ple.
 */
export type RepartimentEns = {
  /** Cada candidatura que entra al repartiment, amb el que li dona la llei. */
  files: {
    partit: string;
    vots: number;
    regidors: number;
    /** Només consells: 1/3 del % de regidors + 2/3 del % de vots. */
    puntuacio: number | null;
    seientsCalculats: number;
    /** Els escons que hi té de fet, per sigles comparables; null si no se sap. */
    seientsReals: number | null;
  }[];
  /** Només diputacions: escons de cada districte i qui se'ls endú. */
  districtes: { nom: string; poblacio: number; seients: number; perPartit: { partit: string; seients: number }[] }[] | null;
  /** Cert si el càlcul dona exactament la composició real, partit per partit. */
  quadra: boolean;
  /** Les diferències, dites en una frase cadascuna, si n'hi ha. */
  diferencies: string[];
};

/** Diners que l'ens ha concedit als ajuntaments, segons el RAISC (`s9xt-n979`). */
export type SubvencionsEns = {
  /** Els exercicis que es comparen, de l'antic al recent. */
  anys: number[];
  /** Per municipi, l'import concedit a l'ajuntament (per CIF) cada any. */
  perMunicipi: { slug: string; nom: string; poblacio: number | null; imports: (number | null)[] }[];
  /** Les convocatòries que més reparteixen, l'últim any complet. */
  convocatories: { titol: string; import: number; concessions: number }[];
  /** Organismes propis de l'ens (Dipsalut, IEI, patronats…) que no s'hi compten. */
  agenciesExcloses: string[];
  /**
   * Registres que l'ens mateix fa al RAISC cada any, a qualsevol beneficiari
   * (alineat amb `anys`). Aquí un 0 és un recompte de debò: vol dir que l'ens
   * no hi registra res, i la pàgina ho ha de dir en lloc d'ensenyar una taula
   * buida com si no donés res.
   */
  concessionsEns: number[] | null;
  /**
   * El que l'ens registra amb el beneficiari amagat («Benef. no publicable»),
   * per any. La Diputació de Tarragona hi posa gairebé tot (181 M€ el 2024):
   * sense aquest avís, la taula diria que no reparteix res.
   */
  noPublicable: { import: number; concessions: number }[] | null;
  font: FontEns;
};

/** L'adreça pública de cada fitxa, relativa a `observatori/`. */
export function adrecaEns(tipus: TipusEns, slug: string): string {
  return tipus === "diputacio" ? `diputacio/${slug}/` : `c/${slug}/consell/`;
}
