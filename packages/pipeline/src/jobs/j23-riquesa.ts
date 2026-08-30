import { eq } from "drizzle-orm";
import { municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { taulaIdescat, MUN_CATALUNYA, type CelaJsonStat, type EnllacMunicipi } from "../adapters/idescat";
import { arrodoneix, variacioEntre, type PuntSerie, type Variacio } from "./j9-habitatge-residus";
import { buildPeerGroups, medianOf, percentileOf, type PeerGroup } from "../derive/peers";
import { sleep } from "../lib/http";
import { withRun } from "../lib/run";

/**
 * J23 — la riquesa del municipi: quants diners entren a les cases.
 *
 * La fitxa ja sap quanta gent hi viu (J18), què paga per l'aigua i per l'IBI
 * (J19) i què gasta l'ajuntament (J8, J15). El que no diu enlloc és **de quants
 * diners disposa la gent que hi viu**, que és el context que fa llegible tota
 * la resta: una taxa d'escombraries de 120 € no vol dir el mateix a Matadepera
 * que a la Vall de Boí.
 *
 * ─── LA FONT, I PER QUÈ AQUESTA ─────────────────────────────────────────────
 *
 * **1. INE, Atlas de distribución de renta de los hogares (ADRH).** És l'única
 * font comprovada que arriba als **947 municipis** de Catalunya. Es construeix
 * amb dades fiscals de l'Agència Tributària i de les hisendes forals, i publica
 * sèrie **2015-2023**. Es baixa en quatre fitxers, un per província, del portal
 * de taules de l'INE. Comprovat baixant-los: 311 municipis a Barcelona, 221 a
 * Girona, 231 a Lleida i 184 a Tarragona — 947 exactes, cap ni un de menys.
 * Columnes reals del CSV: `Municipios;Distritos;Secciones;Indicadores de renta
 * media y mediana;Periodo;Total`, i sis indicadors per municipi i any.
 * Cobertura comprovada de la renda neta mitjana per persona: 947 municipis el
 * 2020, 945 el 2021, 932 el 2022 i **927 el 2023** (els altres 20 els amaga
 * l'INE per secret estadístic, i surten al CSV com un punt).
 *
 * **2. Idescat, renda disponible bruta de les llars (RFDB).** És la xifra
 * oficial catalana i porta l'índex Catalunya=100 fet de fàbrica, però
 * **l'Idescat només l'estima per als municipis de més de 5.000 habitants i les
 * capitals de comarca**: comprovat, la taula municipal en té **470**, no 947.
 * Per això va de complement i no de xifra principal — si fos la principal, la
 * meitat dels pobles del país es quedarien amb el forat.
 *
 * ─── EL QUE S'HA MIRAT I S'HA DESCARTAT, I PER QUÈ ──────────────────────────
 *
 *   · **PIB municipal de l'Idescat.** Existeix, però amb el mateix tall que la
 *     RFDB. Comprovat a la fitxa municipal de l'API: Barcelona té PIB i PIB per
 *     habitant; Gisclareny i Sant Jaume de Frontanyà no tenen ni l'un ni
 *     l'altre. A més, el PIB d'un municipi mesura el que s'hi **produeix**, no
 *     el que hi **entra a les cases**: un polígon industrial dispara el PIB per
 *     habitant d'un poble on no viu ningú que en cobri el sou. Per parlar de
 *     riquesa de la gent, la renda és millor mesura que el PIB.
 *   · **Nombre d'empreses per municipi.** A la fitxa municipal de l'Idescat no
 *     hi ha cap taula d'empreses: el que hi ha, a nivell de municipi, són
 *     **afiliacions a la Seguretat Social**, i arrodonides a múltiples de cinc.
 *     Afiliacions no són empreses, i no es publica una cosa dient-ne una altra.
 *   · **Seccions censals.** L'ADRH també les publica —i és on es veu la
 *     desigualtat de debò dins d'una ciutat— però una secció censal no té
 *     fitxa, no té ple i no té alcalde. Es filtren i no s'ingereixen.
 *
 * ─── LES DUES REGLES QUE MANEN AQUÍ ─────────────────────────────────────────
 *
 * **Això no ho decideix l'ajuntament.** La renda d'un poble és el resultat de
 * qui hi viu, de què hi treballa i de com va l'economia, no de què es vota al
 * ple. Es desa marcada amb `context.decideixLAjuntament: false` i amb la nota
 * escrita al costat, com ja fan J18 amb la població i J19 amb el preu de
 * l'aigua. I hi ha una segona raó, més crua: **la sèrie acaba el 2023, que és
 * l'any en què es van constituir aquests ajuntaments**. No hi ha ni un sol any
 * de dades posterior a les eleccions. Qui vulgui llegir-hi la gestió d'aquest
 * mandat, hi llegirà el mandat anterior.
 *
 * **La comparació és el que informa.** 15.200 € no diu res sol. El que diu
 * alguna cosa és on queda respecte dels municipis de la mateixa mida i
 * respecte de la resta del país. Per això de cada indicador es desa el
 * percentil dins del grup de mida (els trams de la LOREG, els mateixos que
 * fan servir J15 i J18), la mediana del grup, el rang dins dels 947 i la
 * mediana catalana; i la RFDB porta a més l'índex Catalunya=100 que dona
 * l'Idescat.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Les fonts, amb l'URL comprovat
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Les quatre taules provincials de l'ADRH. Els identificadors surten del
 * catàleg de l'operació (`TABLAS_OPERACION/ADRH` de l'API tempus3) i s'han
 * comprovat un per un baixant-ne la primera fila: 30896 comença per «08001
 * Abrera», 31016 per «17001 Agullana», 31079 per «25001 Abella de la Conca» i
 * 31223 per «43001 Aiguamúrcia».
 *
 * **No s'endevinen**: els identificadors no van de nou en nou ni segueixen
 * l'ordre dels codis de província, i provar-ho porta a baixar A Coruña pensant
 * que baixes Girona. Si un dia canvien, `provinciesInesperades` ho detecta a la
 * primera fila i la ingesta ho diu en comptes de desar dades d'una altra banda.
 */
export const TAULES_ADRH = [
  { provincia: "08", nom: "Barcelona", taula: 30896 },
  { provincia: "17", nom: "Girona", taula: 31016 },
  { provincia: "25", nom: "Lleida", taula: 31079 },
  { provincia: "43", nom: "Tarragona", taula: 31223 },
] as const;

/** El CSV pla de l'INE: una fila per municipi, indicador i any. */
export function urlDescarregaAdrh(taula: number): string {
  return `https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/${taula}.csv`;
}

/** La pàgina de la taula, que és el que es pot ensenyar a la fitxa. */
export function urlTaulaAdrh(taula: number): string {
  return `https://www.ine.es/jaxiT3/Tabla.htm?t=${taula}`;
}

/**
 * Condicions de reutilització de l'INE.
 *
 * L'INE permet la reutilització comercial i no comercial, però **imposa la
 * forma de la citació** i la fa diferent segons si les dades s'han elaborat o
 * no. Aquí s'elaboren —es calculen percentils, medianes i rangs— i per tant la
 * fórmula que toca és la d'elaboració pròpia. Es desa literal perquè la fitxa
 * la pugui posar tal com és.
 */
export const LLICENCIA_INE = {
  organisme: "Instituto Nacional de Estadística (INE)",
  condicions: "https://www.ine.es/ss/Satellite?L=es_ES&c=Page&cid=1254735849170&p=1254735849170&pagename=Ayuda%2FINELayout",
  /** La citació exacta que exigeix l'INE quan les dades s'elaboren. */
  atribucio: "Elaboración propia con datos extraídos del sitio web del INE: www.ine.es",
  literal:
    "Se permite la reutilizacion de los contenidos del INE citando la fuente y la fecha de la ultima " +
    "actualizacion. Se prohibe expresamente desnaturalizar el sentido de la informacion.",
  obliga:
    "Cada xifra ha d'anar amb la citació de l'INE i amb la data d'actualització de la taula, i no se'n " +
    "pot alterar el sentit.",
} as const;

/**
 * Condicions de l'Idescat, que no són CC i obliguen a ensenyar els enllaços
 * **tal com els dona l'API**. És el mateix text que fa servir J18, i el motiu
 * pel qual aquí no es construeix ni un sol URL de l'Idescat a mà.
 */
export const LLICENCIA_IDESCAT = {
  organisme: "Institut d'Estadística de Catalunya (Idescat)",
  condicions: "https://www.idescat.cat/dev/api/condicions/",
  literal:
    "Heu de reconèixer l'origen de les dades, ja sigui utilitzant els enllaços que proporcionin les APIs, " +
    "ja sigui enllaçant amb Idescat.cat. […] En presentar-los, no esteu autoritzat a modificar o editar " +
    "les dades, metadades o enllaços proporcionats per les APIs.",
  obliga:
    "Cada xifra s'ha de presentar amb l'enllaç que ha donat l'API, tal com l'ha donat. No se'n pot " +
    "construir cap ni modificar-ne cap.",
} as const;

/** Taula municipal de la RFDB de l'Idescat, revisió estadística 2024. */
export const TAULA_RFDB = "rfdbc/21181/25017";

/**
 * Identificador de la taula de RFDB dins de la fitxa municipal de l'Idescat.
 * És la clau amb què J18 té desats els enllaços per municipi, i és l'enllaç que
 * la llicència obliga a ensenyar al costat de la xifra.
 */
export const EMEX_TAULA_RFDB = "t5";

/** Clau de la mètrica amb els enllaços per municipi que baixa i desa J18. */
const KIND_ENLLACOS = "poblacioEnllacos";

/** Clau de la mètrica d'aquesta feina. */
const KIND = "riquesa";

/** El que s'ha mirat i no es publica, amb el motiu, perquè es pugui discutir. */
export const FONTS_DESCARTADES = [
  {
    font: "Idescat. Producte interior brut territorial (pibc), nivell municipal",
    motiu:
      "Només arriba als municipis de més de 5.000 habitants i a les capitals de comarca, i a més mesura " +
      "el que es produeix dins del terme, no el que entra a les cases: un polígon industrial dispara el " +
      "PIB per habitant d'un poble on no viu qui hi treballa.",
    comprovat:
      "La fitxa municipal de l'API dona PIB i PIB per habitant a Barcelona i no en dona cap dels dos a " +
      "Gisclareny ni a Sant Jaume de Frontanyà.",
  },
  {
    font: "Nombre d'empreses per municipi",
    motiu:
      "La fitxa municipal de l'Idescat no publica cap recompte d'empreses per municipi. El que sí que hi " +
      "ha són afiliacions a la Seguretat Social, arrodonides a múltiples de cinc, que no són empreses.",
    comprovat: "Repassades totes les taules de la fitxa municipal de l'API de l'Idescat.",
  },
  {
    font: "INE. ADRH per secció censal",
    motiu:
      "És on es veu la desigualtat dins d'una ciutat, però una secció censal no té ajuntament ni ple: " +
      "aquí no hi ha cap fitxa on posar-la.",
    comprovat: "Les files de secció i de districte del CSV es filtren abans d'ingerir res.",
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Els indicadors de l'ADRH
// ─────────────────────────────────────────────────────────────────────────────

export type ClauIndicador =
  | "rendaNetaPersona"
  | "rendaNetaLlar"
  | "mitjanaUnitatConsum"
  | "medianaUnitatConsum"
  | "rendaBrutaPersona"
  | "rendaBrutaLlar";

export type Indicador = {
  clau: ClauIndicador;
  /** Text exacte de la columna del CSV. Si canvia, la ingesta se n'adona. */
  origen: string;
  etiqueta: string;
  unitat: string;
  /** Què vol dir de debò, per si algú la vol comparar amb una altra cosa. */
  nota: string;
};

/**
 * Els sis indicadors que porta el fitxer, tots sis per municipi i any.
 *
 * Se'n publica el que la gent entén —la renda neta per persona— però el que
 * **compara millor** és la mediana per unitat de consum: és mediana i no
 * mitjana (quatre fortunes no l'aixequen) i està equivalitzada per mida de la
 * llar (un poble de famílies no surt més pobre que un de parelles pel sol fet
 * de tenir més boques per llar). Totes dues es desen, i `COMPARABLE` diu quina
 * és quina perquè la fitxa no hagi d'endevinar-ho.
 */
export const INDICADORS: readonly Indicador[] = [
  {
    clau: "rendaNetaPersona",
    origen: "Renta neta media por persona",
    etiqueta: "Renda neta mitjana per persona",
    unitat: "€/any",
    nota: "Renda de la llar després d'impostos i cotitzacions, repartida entre tots els seus membres.",
  },
  {
    clau: "rendaNetaLlar",
    origen: "Renta neta media por hogar",
    etiqueta: "Renda neta mitjana per llar",
    unitat: "€/any",
    nota: "La mateixa renda, sense repartir entre els membres. Puja allà on les llars són més grans.",
  },
  {
    clau: "mitjanaUnitatConsum",
    origen: "Media de la renta por unidad de consumo",
    etiqueta: "Mitjana de la renda per unitat de consum",
    unitat: "€/any",
    nota: "Equivalitzada per mida de la llar, que és com es mesura la pobresa a Europa.",
  },
  {
    clau: "medianaUnitatConsum",
    origen: "Mediana de la renta por unidad de consumo",
    etiqueta: "Mediana de la renda per unitat de consum",
    unitat: "€/any",
    nota: "La xifra del municipi que compara millor: mediana i equivalitzada. Quatre fortunes no la mouen.",
  },
  {
    clau: "rendaBrutaPersona",
    origen: "Renta bruta media por persona",
    etiqueta: "Renda bruta mitjana per persona",
    unitat: "€/any",
    nota: "Abans d'impostos i cotitzacions. La diferència amb la neta és el que se n'emporta l'Estat.",
  },
  {
    clau: "rendaBrutaLlar",
    origen: "Renta bruta media por hogar",
    etiqueta: "Renda bruta mitjana per llar",
    unitat: "€/any",
    nota: "Abans d'impostos i cotitzacions, sense repartir entre els membres de la llar.",
  },
] as const;

/** La que la fitxa ensenya gran. */
export const DESTACAT: ClauIndicador = "rendaNetaPersona";
/** La que s'ha de fer servir per comparar municipis entre ells. */
export const COMPARABLE: ClauIndicador = "medianaUnitatConsum";

/** Primer any de la sèrie de l'ADRH. */
export const PRIMER_ANY = 2015;

/**
 * Any de constitució d'aquests ajuntaments, el mateix criteri que J8, J9, J15,
 * J18 i J19. Aquí serveix per dir una cosa incòmoda: la sèrie s'acaba justament
 * aquí, i per tant no hi ha cap any d'aquest mandat.
 */
export const MANDAT = 2023;

/**
 * Cobertura mínima perquè un any es pugui publicar com **l'any de tothom**.
 *
 * L'INE amaga per secret estadístic els municipis més petits, i quants n'amaga
 * canvia cada any: el 2020 no en va amagar cap i el 2023 n'amaga vint. Si es
 * publiqués sempre l'últim any disponible de cada municipi, un poble amb dada
 * del 2019 quedaria comparat amb la mediana del 2023 dels seus veïns i sortiria
 * pobre pel sol fet de ser vell. Per això hi ha **un sol any comparable** per a
 * tothom, i qui no en tingui es queda sense xifra i amb la data de l'última que
 * va tenir.
 */
export const COBERTURA_MINIMA = 90;

// ─────────────────────────────────────────────────────────────────────────────
// Llegir el CSV de l'INE
// ─────────────────────────────────────────────────────────────────────────────

export type FilaAdrh = {
  /** Codi INE de 5 xifres, el mateix que `municipalities.ine5`. */
  ine5: string;
  municipi: string;
  origen: string;
  any: number;
  /** `null` quan l'INE amaga la cel·la per secret estadístic. */
  valor: number | null;
};

/**
 * **Parany 1: el punt no és una coma decimal, és el separador de milers.**
 *
 * L'INE escriu la renda com «16.682», que són setze mil sis-cents vuitanta-dos
 * euros i no setze euros amb sis-cents vuitanta-dos. Un `Number()` directe se'n
 * menja tres zeros i no es queixa. I un valor de quatre xifres —«9.999»— cau
 * exactament al mateix parany semblant correcte.
 *
 * **Parany 2: un punt tot sol vol dir «amagat», no zero.** Els municipis que
 * l'INE tapa per secret estadístic porten «.» o cadena buida (a vegades entre
 * cometes). Publicar-los com a zero seria dir que aquell poble no té renda.
 */
export function parseImportIne(text: string): number | null {
  const net = text.trim().replace(/^"+|"+$/g, "").trim();
  if (net === "" || net === "." || net === "..") return null;
  const xifres = net.replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(xifres)) return null;
  const valor = Number(xifres);
  return Number.isFinite(valor) ? valor : null;
}

/**
 * El codi INE de 5 xifres de la columna `Municipios`, que ve com «08001
 * Abrera». Torna `null` si el camp no comença per cinc xifres: val més perdre
 * una fila que ingerir-la contra el municipi equivocat.
 */
export function codiIne5(camp: string): string | null {
  const coincidencia = /^\s*"?(\d{5})\s/.exec(camp);
  return coincidencia ? coincidencia[1]! : null;
}

/**
 * Nom del municipi tal com l'escriu l'INE, sense el codi. L'INE inverteix
 * l'article —«Vajol, La»— i **no es toca**: el nom que publica la fitxa surt de
 * la nostra taula de municipis, aquest només serveix per poder comprovar que
 * hem creuat bé.
 */
export function nomIne(camp: string): string {
  return camp.trim().replace(/^"+|"+$/g, "").replace(/^\d{5}\s+/, "").trim();
}

/**
 * Llegeix el CSV provincial i es queda **només** amb les files de municipi.
 *
 * El fitxer barreja tres nivells territorials a les mateixes columnes: municipi
 * (`Distritos` i `Secciones` buits), districte (`Distritos` ple) i secció
 * censal (`Secciones` ple). Barcelona en té 242.622 files i només 16.794 són de
 * municipi: qui no filtri, ingerirà la renda del barri de Sant Antoni com si
 * fos la de Barcelona.
 *
 * El fitxer no porta cometes amb contingut —les úniques que hi ha són cel·les
 * buides escrites `""`— i cap nom de municipi no porta punt i coma, o sigui que
 * partir per `;` és correcte i s'ha comprovat: cap de les 242.622 files de
 * Barcelona no té un nombre de columnes diferent de sis.
 */
export function parseCsvAdrh(text: string): FilaAdrh[] {
  const linies = text.split(/\r?\n/);
  const files: FilaAdrh[] = [];
  const origens = new Set(INDICADORS.map((i) => i.origen));

  for (const [i, linia] of linies.entries()) {
    // La primera línia és la capçalera, i pot dur BOM.
    if (i === 0 || linia.trim() === "") continue;
    const camps = linia.split(";");
    if (camps.length !== 6) continue;
    const [municipis, districtes, seccions, indicador, periode, total] = camps as [
      string, string, string, string, string, string,
    ];
    // Només municipi: districte i secció no tenen ni ple ni alcalde.
    if (districtes.trim().replace(/"/g, "") !== "" || seccions.trim().replace(/"/g, "") !== "") continue;

    const ine5 = codiIne5(municipis);
    if (ine5 === null) continue;
    const origen = indicador.trim().replace(/^"+|"+$/g, "");
    if (!origens.has(origen)) continue;
    const any = Number(periode.trim());
    if (!Number.isInteger(any)) continue;

    files.push({ ine5, municipi: nomIne(municipis), origen, any, valor: parseImportIne(total) });
  }
  return files;
}

/**
 * Els codis de província que porta un fitxer i que no hi hauríem d'haver
 * trobat.
 *
 * Existeix perquè els identificadors de taula de l'INE **no** segueixen cap
 * ordre endevinable: entre Barcelona (30896) i Girona (31016) hi ha 120 números
 * i pel mig hi ha Ciudad Real i A Coruña. Si un dia l'INE els reordena, sense
 * aquesta comprovació ingeriríem la renda de Jaén amb els codis de Lleida i no
 * ens n'adonaria ningú, perquè els codis INE de 5 xifres no col·lideixen i el
 * creuament simplement no trobaria res.
 */
export function provinciesInesperades(files: readonly FilaAdrh[], provincia: string): string[] {
  const trobades = new Set<string>();
  for (const fila of files) trobades.add(fila.ine5.slice(0, 2));
  trobades.delete(provincia);
  return [...trobades].sort();
}

// ─────────────────────────────────────────────────────────────────────────────
// Triar l'any que es publica
// ─────────────────────────────────────────────────────────────────────────────

/**
 * L'any més recent que té dada a prou municipis per comparar-los entre ells.
 *
 * Amb la cobertura comprovada de la renda neta per persona —947 el 2020, 945 el
 * 2021, 932 el 2022 i 927 el 2023 sobre 947— surt el **2023**, i seguirà sortint
 * el més nou mentre l'INE no tapi de cop més d'un municipi de cada deu.
 */
export function anyComparable(
  ambDadaPerAny: ReadonlyMap<number, number>,
  total: number,
  llindar = COBERTURA_MINIMA,
): number | null {
  if (total <= 0) return null;
  const anys = [...ambDadaPerAny.keys()].sort((a, b) => b - a);
  for (const any of anys) {
    const ambDada = ambDadaPerAny.get(any) ?? 0;
    if ((100 * ambDada) / total >= llindar) return any;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// La comparació, que és el que informa
// ─────────────────────────────────────────────────────────────────────────────

export type Comparacio = {
  grup: { clau: string; etiqueta: string; mida: number; ambDada: number };
  percentil: number;
  mediana: number;
  /** Diferència amb la mediana del grup, en euros i en %. */
  diferencia: number;
  percentual: number | null;
};

/**
 * Percentil i mediana dins del grup de mida.
 *
 * El grup són els trams de la LOREG (article 179), els mateixos que decideixen
 * quants regidors té el ple: no ens els hem inventat i no els pot discutir
 * ningú. `ambDada` va al costat del percentil perquè un percentil calculat
 * sobre quatre municipis s'ha de poder llegir amb la desconfiança que mereix.
 */
export function comparaDinsDelGrup(
  valors: ReadonlyMap<number, number>,
  grups: ReadonlyMap<number, PeerGroup>,
): Map<number, Comparacio> {
  const perGrup = new Map<string, number[]>();
  for (const [id, valor] of valors) {
    const grup = grups.get(id);
    if (!grup) continue;
    const llista = perGrup.get(grup.key);
    if (llista) llista.push(valor);
    else perGrup.set(grup.key, [valor]);
  }

  const resultat = new Map<number, Comparacio>();
  for (const [id, valor] of valors) {
    const grup = grups.get(id);
    if (!grup) continue;
    const llista = perGrup.get(grup.key)!;
    const percentil = percentileOf(valor, llista);
    const mediana = medianOf(llista);
    if (percentil === null || mediana === null) continue;
    resultat.set(id, {
      grup: { clau: grup.key, etiqueta: grup.label, mida: grup.size, ambDada: llista.length },
      percentil,
      mediana: arrodoneix(mediana, 0),
      diferencia: arrodoneix(valor - mediana, 0),
      percentual: mediana === 0 ? null : arrodoneix((100 * (valor - mediana)) / mediana, 1),
    });
  }
  return resultat;
}

export type PosicioCatalunya = {
  /** 1 és el municipi amb la renda més alta de Catalunya. */
  rang: number;
  /** Sobre quants municipis, que no són sempre 947. */
  de: number;
  percentil: number;
  /** Mediana dels municipis catalans amb dada. **No** és la renda de Catalunya. */
  medianaMunicipal: number;
  diferencia: number;
  percentual: number | null;
  nota: string;
};

/**
 * Rang i percentil dins de tot Catalunya.
 *
 * **La mediana que es desa és la dels 947 municipis, no la de Catalunya.** Són
 * coses diferents i confondre-les és fàcil: la mediana municipal dona el mateix
 * pes a Barcelona que a Gisclareny, i per tant no és «la renda dels catalans»
 * sinó «la renda del municipi del mig». La nota ho diu perquè la fitxa no ho
 * pugui escriure malament.
 *
 * Els empats reben tots el mateix rang, el millor: dos municipis amb la
 * mateixa renda no poden ser el 12è i el 13è per l'ordre en què els hem llegit.
 */
export function posicioACatalunya(valors: ReadonlyMap<number, number>): Map<number, PosicioCatalunya> {
  const llista = [...valors.values()];
  const mediana = medianOf(llista);
  const resultat = new Map<number, PosicioCatalunya>();
  if (mediana === null) return resultat;

  const ordenats = [...llista].sort((a, b) => b - a);
  const rangDe = new Map<number, number>();
  for (const [i, valor] of ordenats.entries()) {
    if (!rangDe.has(valor)) rangDe.set(valor, i + 1);
  }

  for (const [id, valor] of valors) {
    const percentil = percentileOf(valor, llista);
    if (percentil === null) continue;
    resultat.set(id, {
      rang: rangDe.get(valor)!,
      de: llista.length,
      percentil,
      medianaMunicipal: arrodoneix(mediana, 0),
      diferencia: arrodoneix(valor - mediana, 0),
      percentual: mediana === 0 ? null : arrodoneix((100 * (valor - mediana)) / mediana, 1),
      nota:
        "Mediana dels municipis catalans amb dada, no la renda de Catalunya: dona el mateix pes a " +
        "Barcelona que a un poble de trenta habitants.",
    });
  }
  return resultat;
}

// ─────────────────────────────────────────────────────────────────────────────
// La RFDB de l'Idescat
// ─────────────────────────────────────────────────────────────────────────────

export type PuntRfdb = {
  any: number;
  /** Euros per habitant. */
  perHabitant: number | null;
  /** Índex amb Catalunya = 100, tal com el dona l'Idescat. No el calculem. */
  index: number | null;
};

/** Els codis d'indicador de la taula de RFDB, comprovats a la resposta de l'API. */
export const RFDB_PER_HABITANT = "PER_CAPITA_EUR";
export const RFDB_INDEX = "PER_CAPITA_INDEX";

/**
 * Converteix les cel·les JSON-stat de la RFDB en una sèrie per municipi.
 *
 * La clau és el codi Idescat de 6 xifres, que és el que fa servir aquesta API i
 * el que tenim a `municipalities.idescat6`. Les cel·les de Catalunya venen a
 * `catalunya` i no aquí: l'adaptador ja les separa, perquè la fila `MUN=TOTAL`
 * és el país sencer i no cap municipi.
 */
export function seriesRfdb(celes: readonly CelaJsonStat[]): Map<string, PuntRfdb[]> {
  const perMunicipi = new Map<string, Map<number, PuntRfdb>>();
  for (const cela of celes) {
    if (cela.mun === MUN_CATALUNYA) continue;
    const indicador = cela.categories.INDICATOR;
    if (indicador !== RFDB_PER_HABITANT && indicador !== RFDB_INDEX) continue;
    const anys = perMunicipi.get(cela.mun) ?? new Map<number, PuntRfdb>();
    const punt = anys.get(cela.any) ?? { any: cela.any, perHabitant: null, index: null };
    if (indicador === RFDB_PER_HABITANT) punt.perHabitant = cela.valor;
    else punt.index = cela.valor;
    anys.set(cela.any, punt);
    perMunicipi.set(cela.mun, anys);
  }

  const resultat = new Map<string, PuntRfdb[]>();
  for (const [mun, anys] of perMunicipi) {
    resultat.set(mun, [...anys.values()].sort((a, b) => a.any - b.any));
  }
  return resultat;
}

/** La sèrie de Catalunya, que és la referència de l'índex Catalunya=100. */
export function serieRfdbCatalunya(celes: readonly CelaJsonStat[]): PuntRfdb[] {
  const anys = new Map<number, PuntRfdb>();
  for (const cela of celes) {
    const indicador = cela.categories.INDICATOR;
    if (indicador !== RFDB_PER_HABITANT && indicador !== RFDB_INDEX) continue;
    const punt = anys.get(cela.any) ?? { any: cela.any, perHabitant: null, index: null };
    if (indicador === RFDB_PER_HABITANT) punt.perHabitant = cela.valor;
    else punt.index = cela.valor;
    anys.set(cela.any, punt);
  }
  return [...anys.values()].sort((a, b) => a.any - b.any);
}

/** L'últim any de la sèrie que té xifra de debò. */
export function darrerAmbValor(serie: readonly PuntSerie[]): number | null {
  for (let i = serie.length - 1; i >= 0; i -= 1) {
    if (serie[i]!.valor !== null) return serie[i]!.any;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// El que es desa de cada indicador
// ─────────────────────────────────────────────────────────────────────────────

export type IndicadorPublicat = Indicador & {
  /** L'any comparable per a tothom. */
  any: number | null;
  /** La xifra d'aquest municipi aquell any, o `null` si l'INE la tapa. */
  valor: number | null;
  /** Últim any en què aquest municipi va tenir xifra, encara que no sigui el comparable. */
  darrerAnyPropi: number | null;
  serie: PuntSerie[];
  /** Del primer any de la sèrie fins a l'any comparable. */
  variacio: Variacio | null;
  comparacio: Comparacio | null;
  catalunya: PosicioCatalunya | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Xarxa
// ─────────────────────────────────────────────────────────────────────────────

const USER_AGENT = "quivoto/0.1 (brúixola electoral municipal; hola@quivoto.cat)";

/**
 * Baixa un fitxer de text amb reintents, com fa `fetchJson` amb el JSON.
 *
 * Va a part perquè `lib/http.ts` només sap demanar JSON i aquests fitxers són
 * CSV. El de Barcelona fa 31 MB en clar; el servidor els serveix comprimits i
 * `fetch` els descomprimeix sol, o sigui que pel cable en passen uns 2 MB.
 */
export async function fetchText(
  url: string,
  options: { retries?: number; timeoutMs?: number; delayMs?: number } = {},
): Promise<string> {
  const { retries = 3, timeoutMs = 180_000, delayMs = 0 } = options;
  if (delayMs > 0) await sleep(delayMs);

  let ultimError: unknown;
  for (let intent = 0; intent <= retries; intent += 1) {
    const controlador = new AbortController();
    const rellotge = setTimeout(() => controlador.abort(), timeoutMs);
    try {
      const resposta = await fetch(url, {
        headers: { accept: "text/csv,text/plain,*/*", "user-agent": USER_AGENT },
        signal: controlador.signal,
      });
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status} a ${url}`);
      return await resposta.text();
    } catch (error) {
      ultimError = error;
      if (intent === retries) break;
      await sleep(1_000 * 2 ** intent);
    } finally {
      clearTimeout(rellotge);
    }
  }
  throw ultimError;
}

/** La data d'actualització que declara l'INE de cada taula, si la sap dir. */
export async function actualitzacionsAdrh(): Promise<Map<number, string>> {
  const url = "https://servicios.ine.es/wstempus/js/ES/TABLAS_OPERACION/ADRH";
  const cru = await fetchText(url, { timeoutMs: 60_000 });
  const catalog = JSON.parse(cru) as { Id?: number; Ultima_Modificacion?: number }[];
  const resultat = new Map<number, string>();
  for (const taula of catalog) {
    if (typeof taula.Id !== "number" || typeof taula.Ultima_Modificacion !== "number") continue;
    resultat.set(taula.Id, new Date(taula.Ultima_Modificacion).toISOString().slice(0, 10));
  }
  return resultat;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ingesta
// ─────────────────────────────────────────────────────────────────────────────

export type Municipi = {
  id: number;
  name: string;
  ine5: string;
  idescat6: string | null;
  population: number | null;
};

/**
 * La feina sencera: renda de l'INE per als 947 i RFDB de l'Idescat per als 470
 * que en tenen, totes dues amb la comparació al costat i marcades com a cosa
 * que **no decideix l'ajuntament**.
 *
 * És idempotent: torna a baixar els quatre fitxers i la taula de l'Idescat i
 * reescriu la mètrica `riquesa` de cada municipi amb `onConflictDoUpdate`.
 * Executar-la dues vegades seguides deixa exactament el mateix a la base de
 * dades.
 */
export async function j23Riquesa(db: Db): Promise<void> {
  const tots: Municipi[] = (await db.select().from(municipalities)).map((m) => ({
    id: m.id,
    name: m.name,
    ine5: m.ine5,
    idescat6: m.idescat6,
    population: m.population,
  }));

  await withRun(db, "J23 riquesa: renda per persona i RFDB", async (run) => {
    const perIne5 = new Map(tots.map((m) => [m.ine5, m]));
    const perIdescat6 = new Map(tots.filter((m) => m.idescat6).map((m) => [m.idescat6!, m]));
    const grups = buildPeerGroups(tots);

    // ── 1. L'ADRH de l'INE, província per província ──────────────────────────

    const actualitzada = await actualitzacionsAdrh().catch(() => new Map<number, string>());
    const extret = new Date().toISOString().slice(0, 10);

    /** municipi → indicador → any → valor */
    const dades = new Map<number, Map<string, Map<number, number | null>>>();
    const fontsIne: {
      provincia: string;
      nom: string;
      taula: number;
      urlTaula: string;
      urlDescarrega: string;
      actualitzada: string | null;
      municipis: number;
    }[] = [];
    let senseCreuar = 0;

    for (const [i, taula] of TAULES_ADRH.entries()) {
      const url = urlDescarregaAdrh(taula.taula);
      const cru = await fetchText(url, { delayMs: i === 0 ? 0 : 500 });
      const files = parseCsvAdrh(cru);
      run.rowsIn += files.length;

      const intruses = provinciesInesperades(files, taula.provincia);
      if (intruses.length > 0) {
        // La taula que hem baixat no és la província que pensàvem. No es desa
        // res d'aquest fitxer: val més un forat que una renda d'una altra banda.
        await run.issue({
          kind: "riquesa: la taula de l'INE no és la província esperada",
          severity: "alta",
          detail: {
            taula: taula.taula,
            esperada: taula.provincia,
            trobades: intruses,
            remei: "torna a mirar l'identificador de taula a TABLAS_OPERACION/ADRH",
          },
        });
        continue;
      }

      const municipisDelFitxer = new Set<string>();
      for (const fila of files) {
        municipisDelFitxer.add(fila.ine5);
        const municipi = perIne5.get(fila.ine5);
        if (!municipi) {
          senseCreuar += 1;
          continue;
        }
        const perIndicador = dades.get(municipi.id) ?? new Map<string, Map<number, number | null>>();
        const perAny = perIndicador.get(fila.origen) ?? new Map<number, number | null>();
        perAny.set(fila.any, fila.valor);
        perIndicador.set(fila.origen, perAny);
        dades.set(municipi.id, perIndicador);
      }

      fontsIne.push({
        provincia: taula.provincia,
        nom: taula.nom,
        taula: taula.taula,
        urlTaula: urlTaulaAdrh(taula.taula),
        urlDescarrega: url,
        actualitzada: actualitzada.get(taula.taula) ?? null,
        municipis: municipisDelFitxer.size,
      });
      run.say(`${taula.nom}: ${municipisDelFitxer.size} municipis, ${files.length} files de municipi`);
    }

    if (senseCreuar > 0) {
      await run.issue({
        kind: "riquesa: codi INE del fitxer sense municipi nostre",
        severity: "mitjana",
        detail: { files: senseCreuar },
      });
    }

    // ── 2. Quin any es publica ───────────────────────────────────────────────

    const anysDeLaSerie = new Set<number>();
    for (const perIndicador of dades.values()) {
      for (const perAny of perIndicador.values()) {
        for (const any of perAny.keys()) anysDeLaSerie.add(any);
      }
    }

    const indicadorDestacat = INDICADORS.find((i) => i.clau === DESTACAT)!;
    const ambDadaPerAny = new Map<number, number>();
    for (const any of anysDeLaSerie) {
      let compte = 0;
      for (const perIndicador of dades.values()) {
        if ((perIndicador.get(indicadorDestacat.origen)?.get(any) ?? null) !== null) compte += 1;
      }
      ambDadaPerAny.set(any, compte);
    }
    const any = anyComparable(ambDadaPerAny, tots.length);
    if (any === null) {
      await run.issue({
        kind: "riquesa: cap any de l'ADRH amb prou cobertura",
        severity: "alta",
        detail: { cobertura: Object.fromEntries(ambDadaPerAny), municipis: tots.length },
      });
    }
    const anys = [...anysDeLaSerie].sort((a, b) => a - b);
    run.say(
      any === null
        ? "cap any comparable: no es publica cap xifra de renda"
        : `any comparable ${any} · ${ambDadaPerAny.get(any) ?? 0} municipis de ${tots.length} amb dada`,
    );

    // ── 3. Comparacions, un cop per indicador ────────────────────────────────

    const comparacions = new Map<ClauIndicador, Map<number, Comparacio>>();
    const posicions = new Map<ClauIndicador, Map<number, PosicioCatalunya>>();
    for (const indicador of INDICADORS) {
      const valors = new Map<number, number>();
      if (any !== null) {
        for (const [id, perIndicador] of dades) {
          const valor = perIndicador.get(indicador.origen)?.get(any) ?? null;
          if (valor !== null) valors.set(id, valor);
        }
      }
      comparacions.set(indicador.clau, comparaDinsDelGrup(valors, grups));
      posicions.set(indicador.clau, posicioACatalunya(valors));
    }

    // ── 4. La RFDB de l'Idescat ──────────────────────────────────────────────

    let rfdbPerMunicipi = new Map<string, PuntRfdb[]>();
    let rfdbCatalunya: PuntRfdb[] = [];
    let fontRfdb: {
      taula: string;
      label: string;
      source: string;
      updated: string | null;
      enllacos: { rel: string; href: string; label: string }[];
      crides: string[];
      llicencia: typeof LLICENCIA_IDESCAT;
      abast: string;
    } | null = null;

    try {
      const ingerida = await taulaIdescat(TAULA_RFDB, { filtres: {}, anys });
      rfdbPerMunicipi = seriesRfdb(ingerida.celes);
      rfdbCatalunya = serieRfdbCatalunya(ingerida.catalunya);
      fontRfdb = {
        taula: TAULA_RFDB,
        label: ingerida.label,
        source: ingerida.source,
        updated: ingerida.updated,
        enllacos: ingerida.enllacos,
        crides: ingerida.crides,
        llicencia: LLICENCIA_IDESCAT,
        abast:
          "L'Idescat només estima la RFDB dels municipis de més de 5.000 habitants i de les capitals de " +
          "comarca. La resta no en tenen, i no és cap error de la ingesta.",
      };
      run.say(`RFDB de l'Idescat: ${rfdbPerMunicipi.size} municipis de ${tots.length}`);
    } catch (error) {
      // Sense RFDB la fitxa encara té la renda de l'INE per als 947. No és
      // motiu per aturar la feina, però sí per deixar-ho escrit.
      await run.issue({
        kind: "riquesa: la taula de RFDB de l'Idescat no s'ha pogut baixar",
        severity: "mitjana",
        detail: { taula: TAULA_RFDB, error: String(error) },
      });
    }

    /**
     * Els enllaços per municipi de l'Idescat, que ja té desats J18. La
     * llicència obliga a ensenyar-los tal com els dona l'API i **prohibeix
     * construir-ne cap**: si J18 no ha passat encara, la xifra de RFDB es desa
     * sense enllaç i la incidència ho diu.
     */
    const enllacRfdb = new Map<number, EnllacMunicipi>();
    const previs = await db
      .select()
      .from(municipalityMetrics)
      .where(eq(municipalityMetrics.kind, KIND_ENLLACOS));
    for (const fila of previs) {
      const desat = fila.data as { enllacos?: EnllacMunicipi[] } | null;
      const enllac = desat?.enllacos?.find((e) => e.taula === EMEX_TAULA_RFDB);
      if (enllac) enllacRfdb.set(fila.municipalityId, enllac);
    }

    // La comparació de la RFDB es fa entre els que en tenen, i es diu quants són.
    const anyRfdb = (() => {
      const perAny = new Map<number, number>();
      for (const serie of rfdbPerMunicipi.values()) {
        for (const punt of serie) {
          if (punt.perHabitant !== null) perAny.set(punt.any, (perAny.get(punt.any) ?? 0) + 1);
        }
      }
      const ordenats = [...perAny.keys()].sort((a, b) => b - a);
      return ordenats[0] ?? null;
    })();

    const valorsRfdb = new Map<number, number>();
    if (anyRfdb !== null) {
      for (const [idescat6, serie] of rfdbPerMunicipi) {
        const municipi = perIdescat6.get(idescat6);
        if (!municipi) continue;
        const valor = serie.find((p) => p.any === anyRfdb)?.perHabitant ?? null;
        if (valor !== null) valorsRfdb.set(municipi.id, valor);
      }
    }
    const comparacioRfdb = comparaDinsDelGrup(valorsRfdb, grups);
    const posicioRfdb = posicioACatalunya(valorsRfdb);

    // ── 5. Desar, municipi a municipi ────────────────────────────────────────

    let ambRenda = 0;
    let ambRfdb = 0;
    let senseEnllacRfdb = 0;
    let senseRenda = 0;

    for (const municipi of tots) {
      const perIndicador = dades.get(municipi.id);
      if (!perIndicador) {
        senseRenda += 1;
        await run.issue({
          kind: "riquesa: municipi sense cap fila a l'ADRH",
          severity: "mitjana",
          municipalityId: municipi.id,
          detail: { municipi: municipi.name, ine5: municipi.ine5 },
        });
      }

      const indicadors: IndicadorPublicat[] = INDICADORS.map((indicador) => {
        const perAny = perIndicador?.get(indicador.origen);
        const serie: PuntSerie[] = anys.map((a) => ({ any: a, valor: perAny?.get(a) ?? null }));
        const valor = any === null ? null : (perAny?.get(any) ?? null);
        return {
          ...indicador,
          any,
          valor,
          darrerAnyPropi: darrerAmbValor(serie),
          serie,
          variacio: any === null ? null : variacioEntre(serie, PRIMER_ANY, any),
          comparacio: comparacions.get(indicador.clau)?.get(municipi.id) ?? null,
          catalunya: posicions.get(indicador.clau)?.get(municipi.id) ?? null,
        };
      });

      if (indicadors.some((i) => i.valor !== null)) ambRenda += 1;

      const serieRfdb = municipi.idescat6 ? (rfdbPerMunicipi.get(municipi.idescat6) ?? null) : null;
      const puntRfdb = anyRfdb === null ? null : (serieRfdb?.find((p) => p.any === anyRfdb) ?? null);
      const enllac = enllacRfdb.get(municipi.id) ?? null;
      if (puntRfdb?.perHabitant != null) {
        ambRfdb += 1;
        if (!enllac) senseEnllacRfdb += 1;
      }

      const dadesMunicipi = {
        font: {
          ine: {
            organisme: LLICENCIA_INE.organisme,
            conjunt: "Atlas de distribución de renta de los hogares (ADRH)",
            operacio: "ADRH",
            taules: fontsIne,
            llicencia: LLICENCIA_INE,
            extret,
          },
          idescat: fontRfdb,
          descartades: FONTS_DESCARTADES,
        },
        /**
         * Res d'això no ho decideix l'ajuntament: és el context en què governa i
         * no un resultat de la seva gestió. La fitxa ho ha de dir al costat de
         * la xifra, com ja fa amb la població i amb el preu del lloguer.
         */
        context: {
          decideixLAjuntament: false,
          nota:
            "Un ajuntament no decideix quant guanya la gent que hi viu. La renda depèn de qui hi viu, de " +
            "què hi treballa i de com va l'economia; el que sí que depèn del ple és què en fa a partir " +
            "d'aquí: quines taxes cobra, a qui les bonifica i en què gasta.",
          /**
           * El segon motiu, i el més concret: la sèrie s'atura justament l'any
           * de les eleccions.
           */
          sensePostEleccions:
            any === null || any <= MANDAT
              ? "La sèrie acaba el " +
                String(any ?? PRIMER_ANY) +
                ", que és l'any en què es va constituir aquest ajuntament. No hi ha cap any de dades " +
                "posterior a les eleccions: el que es veu aquí és el mandat anterior."
              : null,
        },
        any,
        anys,
        cobertura: {
          municipisAmbDada: any === null ? 0 : (ambDadaPerAny.get(any) ?? 0),
          de: tots.length,
          nota:
            "L'INE tapa per secret estadístic la renda dels municipis més petits. Un municipi sense xifra " +
            "no és un municipi sense renda.",
        },
        destacat: DESTACAT,
        /** Quina de les sis compara bé, perquè la fitxa no hagi d'endevinar-ho. */
        comparable: COMPARABLE,
        comparableNota:
          "Per ordenar municipis, la mediana de la renda per unitat de consum: és mediana (quatre " +
          "fortunes no l'aixequen) i està equivalitzada per mida de la llar.",
        indicadors,
        mandat: { desDe: MANDAT },
        rfdb:
          puntRfdb === null || fontRfdb === null
            ? null
            : {
                any: puntRfdb.any,
                perHabitant: puntRfdb.perHabitant,
                /** Índex Catalunya=100 tal com el dona l'Idescat. No el calculem. */
                index: puntRfdb.index,
                serie: serieRfdb ?? [],
                catalunya: {
                  serie: rfdbCatalunya,
                  perHabitant: rfdbCatalunya.find((p) => p.any === puntRfdb.any)?.perHabitant ?? null,
                },
                comparacio: comparacioRfdb.get(municipi.id) ?? null,
                posicio: posicioRfdb.get(municipi.id) ?? null,
                municipisAmbRfdb: valorsRfdb.size,
                /** L'enllaç que la llicència de l'Idescat obliga a mostrar. */
                enllac,
              },
        /** Per què aquest municipi no té RFDB, quan no en té. */
        rfdbAbsent:
          puntRfdb !== null || fontRfdb === null
            ? null
            : "L'Idescat només estima la renda disponible bruta de les llars als municipis de més de " +
              "5.000 habitants i a les capitals de comarca.",
      };

      await db
        .insert(municipalityMetrics)
        .values({ municipalityId: municipi.id, kind: KIND, data: dadesMunicipi })
        .onConflictDoUpdate({
          target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
          set: { data: dadesMunicipi, computedAt: new Date() },
        });
      run.rowsOut += 1;
    }

    if (senseEnllacRfdb > 0) {
      // Sense enllaç no es compleix la llicència de l'Idescat, i la fitxa no
      // hauria de publicar la RFDB d'aquests municipis.
      await run.issue({
        kind: "riquesa: RFDB sense l'enllaç que la llicència obliga a mostrar",
        severity: "alta",
        detail: {
          municipis: senseEnllacRfdb,
          remei: "executa J18 (enllaços de l'Idescat) i torna a passar J23",
        },
      });
    }

    run.say(`${run.rowsOut} municipis desats · ${ambRenda} amb renda de l'INE · ${ambRfdb} amb RFDB`);
    if (senseRenda > 0) run.say(`${senseRenda} municipis sense cap fila a l'ADRH`);

    return {
      municipis: run.rowsOut,
      any,
      ambRenda,
      ambRfdb,
      senseRenda,
      senseEnllacRfdb,
      cobertura: Object.fromEntries(ambDadaPerAny),
    };
  });
}
