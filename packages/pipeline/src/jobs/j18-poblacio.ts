import { eq } from "drizzle-orm";
import { municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import {
  PALMEROLA,
  emexFitxa,
  filtresNoAplicats,
  taulaIdescat,
  type EnllacMunicipi,
  type TaulaIngerida,
} from "../adapters/idescat";
import { buildPeerGroups, medianOf, percentileOf, type PeerGroup } from "../derive/peers";
import { arrodoneix, variacioEntre, type PuntSerie, type Variacio } from "./j9-habitatge-residus";
import { medianaPerGrup, partDelTotal, type MedianaDelGrup } from "./j15-despesa-serveis";
import { withRun } from "../lib/run";

/**
 * J18 — com ha canviat la població de cada municipi.
 *
 * És la pregunta que la gent es fa sola i que ningú no li respon amb dades del
 * seu poble: quanta gent hi viu, si n'hi ha més o menys que fa quatre anys, si
 * és més gran o més jove, i d'on ve. La font són les taules de l'Idescat, que
 * són l'estadística oficial i cobreixen els 947 municipis amb la mateixa vara
 * de mesurar.
 *
 * Tres regles governen tot el fitxer, i cap no és negociable.
 *
 * ─── 1. Cada xifra desa què compta exactament ───────────────────────────────
 *
 * **Nacionalitat no és lloc de naixement, i cap de les dues no és
 * «immigrant».** No és una precisió d'estadístic: és la diferència entre
 * informar i encendre un poble. A Sabadell, el 2025:
 *
 *   · 34.062 persones tenen **nacionalitat** estrangera (15,2 %).
 *   · 46.870 persones han **nascut** a l'estranger (20,9 %).
 *
 * Són 12.808 persones de diferència al mateix municipi el mateix any. La
 * taula creuada explica per què: 15.780 persones nascudes fora d'Espanya tenen
 * nacionalitat espanyola, i 2.970 estrangers han nascut aquí. Les dues xifres
 * es desen totes dues, cadascuna amb el seu `compta`, i **no se'n calcula cap
 * tercera que barregi definicions**: no existeix cap indicador «immigrants» en
 * aquest fitxer, ni n'hi pot haver cap.
 *
 * El mateix val per al padró: compta **empadronats**, no residents. Comparat
 * amb el cens als 947 municipis la mediana de diferència és 0,0 %, però 35
 * municipis se'n van més del 2 %, i els turístics sobreregistren de manera
 * sistemàtica (Lloret, +2,5 %). Per això es desen les dues sèries i la
 * diferència entre elles, i no se'n tria una com «la població».
 *
 * ─── 2. Cap variació no es publica sola ─────────────────────────────────────
 *
 * «La població ha pujat un 3 %» no vol dir res. Si als municipis de la seva
 * mida ha pujat un 6 %, aquest poble s'està buidant en termes relatius; si ha
 * pujat un 1 %, hi està passant alguna cosa. Cada indicador desa la variació
 * del mandat (2023 → últim any), la del mandat anterior quan hi ha sèrie, i
 * **la mediana de la mateixa variació als municipis del seu grup de mida**.
 *
 * ─── 3. Res d'això no ho decideix l'ajuntament ──────────────────────────────
 *
 * Un ajuntament no decideix qui neix, qui mor ni qui es muda. Aquestes xifres
 * són el **context** en què governa, no un resultat de la seva gestió, i es
 * desen marcades com a tal (`context.decideixLAjuntament: false`) perquè la
 * fitxa no les pugui presentar mai com un mèrit ni com una culpa.
 *
 * ─── La llicència, que aquí no és un tràmit ─────────────────────────────────
 *
 * Les dades de l'Idescat **no** són CC. Les condicions d'ús de les seves API
 * diuen, literalment: «Heu de reconèixer l'origen de les dades, ja sigui
 * utilitzant els enllaços que proporcionin les APIs, ja sigui enllaçant amb
 * Idescat.cat. […] En presentar-los, no esteu autoritzat a modificar o editar
 * les dades, metadades o enllaços proporcionats per les APIs.»
 *
 * Per això aquesta feina desa, amb cada xifra, **l'enllaç exacte que dona
 * l'API** —el de la taula i, quan n'hi ha, el de la pàgina d'aquest municipi—
 * tal com arriba, sense construir-ne cap ni retocar-ne cap. Un municipi que
 * acabi sense enllaços genera una incidència de **gravetat alta**, que és el
 * mecanisme del projecte per impedir que la seva fitxa es publiqui.
 */

// ─── Fonts ───────────────────────────────────────────────────────────────────

/**
 * Les taules de l'API Taules v2 de l'Idescat, comprovades amb crides reals.
 * L'identificador és el que va al camí de l'URL: `censph/5992/5987`.
 */
const TAULES = {
  /** Població per nacionalitat (espanyola/estrangera). 947 municipis, 2021-2025. */
  nacionalitat: "censph/5992/5987",
  /** Població per lloc de naixement. 947 municipis, 2021-2025. */
  llocNaixement: "censph/293/296",
  /** Creuament lloc de naixement × nacionalitat. **Només 623 municipis.** */
  creuament: "censph/5990/25049",
  /** Població per edat any a any. 947 municipis, 2021-2025. */
  edatAnyAAny: "censph/10/5975",
  /** Població per edat quinquennal, fins a 100 anys o més. 947 municipis. */
  edatQuinquennal: "censph/539/5976",
  /** Indicadors d'edat: proporcions i edat mitjana. 947 municipis. */
  indicadorsEdat: "censph/16400/19880",
  /** Padró municipal continu. 947 municipis, 1998-2025: la demanem sencera. */
  padro: "pmh/446/477",
  /** Padró d'espanyols residents a l'estranger (CERA). 947 municipis, 2009-2026. */
  cera: "phre/3697/3577",
} as const;

/**
 * Dues fonts que semblen bones i **no ho són**. Es deixen escrites perquè el
 * dia que algú les trobi al portal obert i pensi que ens hem descuidat una
 * font de població més fresca, hi trobi també per què no hi és.
 */
export const FONTS_DESCARTADES = [
  {
    origen: "Socrata 7yq2-acdk",
    nom: "Població del CatSalut (registre central d'assegurats)",
    motiu:
      "No és padró ni cens: és qui està donat d'alta al CatSalut. Comparat amb el cens del 2025, " +
      "613 dels 947 municipis se'n van més d'un 5 %, i l'error escala a l'inrevés de la mida —el 96 % " +
      "dels municipis de menys de 500 habitants queden fora del 5 %, i Tiurana hi surt amb 9 persones " +
      "contra les 69 del cens. No serveix per dir quanta gent viu en un poble.",
  },
  {
    origen: "Socrata x5sz-niat",
    nom: "Població per sexe",
    motiu:
      "El camp `total` és exacte, però les columnes `homes` i `dones` del 2025 són brossa: a Sabadell " +
      "hi diu 184.859 homes, que és la població total del municipi el 1998. Qualsevol repartiment per " +
      "sexe que en surti és fals.",
  },
] as const;

/**
 * Text literal de les condicions d'ús de les API de l'Idescat, per si algun dia
 * es discuteix per què la fitxa ha de portar els enllaços.
 */
const LLICENCIA = {
  organisme: "Institut d'Estadística de Catalunya (Idescat)",
  condicions: "https://www.idescat.cat/dev/api/condicions/",
  literal:
    "Heu de reconèixer l'origen de les dades, ja sigui utilitzant els enllaços que proporcionin les APIs, " +
    "ja sigui enllaçant amb Idescat.cat. […] En presentar-los, no esteu autoritzat a modificar o editar " +
    "les dades, metadades o enllaços proporcionats per les APIs.",
  /** El que això ens obliga a fer, dit en una frase que es pugui complir. */
  obliga:
    "Cada xifra s'ha de presentar amb l'enllaç que ha donat l'API, tal com l'ha donat. No se'n pot " +
    "construir cap ni modificar-ne cap.",
} as const;

// ─── Mandats ─────────────────────────────────────────────────────────────────

/**
 * Els ajuntaments es constitueixen al juny, o sigui que l'any electoral és mig
 * d'un mandat i mig de l'altre. El prenem com a punt de partida perquè és
 * l'últim any tancat que no ha decidit qui governa avui, i perquè és el criteri
 * que fa servir tot l'Observatori (J9, J15).
 */
const MANDAT = 2023;
const MANDAT_ANTERIOR = 2019;

/** La sèrie que publiquem de les taules del cens, que arrenquen el 2021. */
const SERIE_CENS = [2021, 2022, 2023, 2024, 2025] as const;

/**
 * Els anys de padró que demanem: **la taula sencera, del 1998 al 2025**.
 *
 * Abans aquí hi havia set anys triats a mà —2015, 2019 i del 2021 al 2025— amb
 * l'argument que «només ens calen els que serveixen per a alguna cosa». No era
 * cert: la fitxa dibuixa la corba d'empadronats, i una corba que salta del 2015
 * al 2019 amb una recta enmig diu que aquells quatre anys no s'hi va moure
 * ningú. La retallàvem nosaltres, no la font.
 *
 * Comprovat contra l'API el 30 d'agost del 2026: `pmh/446/477` té la dimensió
 * YEAR amb 28 categories, del 1998 al 2025, per als 948 codis MUN (947
 * municipis més la fila TOTAL, que és Catalunya). L'`updated` que declara la
 * taula és 2025-12-12.
 *
 * ─── El que això costa ──────────────────────────────────────────────────────
 * **Demanar-ne onze de cop fa que l'Idescat respongui 504**, i per això
 * l'adaptador ho parteix de quatre en quatre. Passar de 7 anys a 28 vol dir
 * passar de 2 crides a 7: **cinc peticions més**, no cent. Cronometrada, la
 * crida de 1998-2001 per als 948 municipis triga 25 s, o sigui que la sèrie
 * sencera són uns tres minuts d'una API que ens serveix les dades de franc.
 *
 * ─── Els forats són de debò ─────────────────────────────────────────────────
 * Els primers anys tenen cel·les amb estat `..` que **no són zeros**: són
 * municipis que encara no existien. Comprovat a la crida 1998-2001: la Canonja
 * (segregada de Tarragona) no té xifra fins al 2010, i la Palma de Cervelló i
 * Riu de Cerdanya no en tenen el 1998. Es desen com a `valor: null` i qui les
 * dibuixi ho ha de fer com un forat, no saltant-se l'any.
 */
const SERIE_PADRO = Array.from({ length: 2025 - 1998 + 1 }, (_, i) => 1998 + i);

/**
 * Canvi de metodologia enmig de la sèrie del padró, tal com el declara la
 * mateixa API al camp `note` de la taula. Va al costat de la corba: qui miri
 * els anys del final ha de saber que no li estan comptant el mateix detall que
 * als del principi.
 */
export const NOTA_PADRO =
  "A partir del 2023 el Padró municipal d'habitants només publica la xifra de població dels municipis, " +
  "les comarques i Aran i les províncies. Abans en publicava més desagregacions. La xifra total de " +
  "Catalunya s'ofereix a títol informatiu.";

/**
 * Els anys del padró de residents a l'estranger (CERA), que **no** és cap taula
 * del cens i no té per què acabar-se on s'acaba el cens.
 *
 * Anava enganxat a `SERIE_CENS` per comoditat nostra, i això li retallava tretze
 * anys pel davant i un pel darrere. Comprovat contra l'API: `phre/3697/3577` té
 * YEAR del 2009 al 2026 —divuit anys— per als 948 codis MUN, amb `updated`
 * 2026-04-22, i la crida 2009-2011 torna 2.844 cel·les amb només 3 buides. És
 * una sèrie anual seguida, sense cap tall de metodologia declarat.
 *
 * Cost: de tres en tres, són 6 crides en comptes de 2. **Quatre peticions més**,
 * uns 19 s cadascuna.
 */
const SERIE_CERA = Array.from({ length: 2026 - 2009 + 1 }, (_, i) => 2009 + i);

/**
 * Els anys de les taules cares (edat any a any, edat quinquennal, creuament).
 * Amb l'inici del mandat i l'últim any n'hi ha prou per a la variació que
 * publiquem, i estalvia crides a una API que ens serveix les dades de franc.
 */
const ANYS_MANDAT = [MANDAT, 2025] as const;

/**
 * L'any de la taula creuada. Només se'n publiquen dues xifres derivades, no cap
 * sèrie: no cal demanar-ne més d'un any.
 */
const ANY_CREUAMENT = 2025;

// ─── Indicadors ──────────────────────────────────────────────────────────────

/**
 * Cada indicador declara **què compta exactament**. `compta` no és documentació
 * interna: és el text que la fitxa ha de poder posar al costat de la xifra, i
 * és el que impedeix que «població estrangera» i «nascuts a l'estranger`
 * acabin dient el mateix a la pantalla.
 */
export type Indicador = {
  clau: string;
  etiqueta: string;
  unitat: "persones" | "%" | "anys";
  compta: string;
  /** La taula de l'API d'on surt la xifra. */
  taula: string;
  /**
   * La taula de la fitxa municipal de l'Idescat (EMEX) que en publica la pàgina
   * d'aquest municipi, o `null` si l'EMEX no en té cap que sigui la mateixa
   * estadística. Quan és `null` la fitxa ha de fer servir l'enllaç de la taula,
   * que també el dona l'API: mai no se'n construeix cap.
   */
  emex: string | null;
  decimals: number;
};

/**
 * Els catorze indicadors que es publiquen. L'ordre és el de lectura de la
 * fitxa: primer quanta gent hi ha, després d'on ve, i finalment quina edat té.
 */
export const INDICADORS: readonly Indicador[] = [
  {
    clau: "padroHabitants",
    etiqueta: "Persones empadronades",
    unitat: "persones",
    compta:
      "Persones inscrites al padró municipal d'habitants a 1 de gener. Compta empadronats, no residents: " +
      "qui viu al poble sense empadronar-s'hi no hi surt, i qui hi manté l'empadronament sense viure-hi sí.",
    taula: TAULES.padro,
    emex: null,
    decimals: 0,
  },
  {
    clau: "censHabitants",
    etiqueta: "Població censada",
    unitat: "persones",
    compta:
      "Població resident segons el Cens de població anual de l'INE a 1 de gener. És l'estimació de qui hi " +
      "viu de veritat, i no coincideix exactament amb el padró.",
    taula: TAULES.nacionalitat,
    emex: "t195",
    decimals: 0,
  },
  {
    clau: "nacionalitatEstrangera",
    etiqueta: "Persones de nacionalitat estrangera",
    unitat: "persones",
    compta:
      "Persones que no tenen la nacionalitat espanyola. NO és el mateix que haver nascut fora: n'hi ha " +
      "que han nascut aquí, i n'hi ha de nascudes fora que sí que tenen nacionalitat espanyola.",
    taula: TAULES.nacionalitat,
    emex: "t75",
    decimals: 0,
  },
  {
    clau: "pctNacionalitatEstrangera",
    etiqueta: "Pes de la població de nacionalitat estrangera",
    unitat: "%",
    compta: "Persones sense nacionalitat espanyola sobre el total de població censada.",
    taula: TAULES.nacionalitat,
    emex: "t75",
    decimals: 1,
  },
  {
    clau: "nascutsAEstranger",
    etiqueta: "Persones nascudes a l'estranger",
    unitat: "persones",
    compta:
      "Persones nascudes fora d'Espanya, tinguin la nacionalitat que tinguin. NO és el mateix que ser " +
      "estranger: la majoria de qui fa anys que hi viu té nacionalitat espanyola.",
    taula: TAULES.llocNaixement,
    emex: "t68",
    decimals: 0,
  },
  {
    clau: "pctNascutsAEstranger",
    etiqueta: "Pes de la població nascuda a l'estranger",
    unitat: "%",
    compta: "Persones nascudes fora d'Espanya sobre el total de població censada.",
    taula: TAULES.llocNaixement,
    emex: "t68",
    decimals: 1,
  },
  {
    clau: "nascutsACatalunya",
    etiqueta: "Persones nascudes a Catalunya",
    unitat: "persones",
    compta: "Persones nascudes a Catalunya, a qualsevol comarca.",
    taula: TAULES.llocNaixement,
    emex: "t68",
    decimals: 0,
  },
  {
    clau: "nascutsAlaRestaDEspanya",
    etiqueta: "Persones nascudes a la resta d'Espanya",
    unitat: "persones",
    compta: "Persones nascudes a Espanya fora de Catalunya.",
    taula: TAULES.llocNaixement,
    emex: "t68",
    decimals: 0,
  },
  {
    clau: "pct65iMes",
    etiqueta: "Pes de la població de 65 anys o més",
    unitat: "%",
    compta: "Persones de 65 anys o més sobre el total de població censada, tal com ho calcula l'Idescat.",
    taula: TAULES.indicadorsEdat,
    emex: "t25",
    decimals: 1,
  },
  {
    clau: "pct0a15",
    etiqueta: "Pes de la població de 0 a 15 anys",
    unitat: "%",
    compta: "Persones de 0 a 15 anys sobre el total de població censada, tal com ho calcula l'Idescat.",
    taula: TAULES.indicadorsEdat,
    emex: "t25",
    decimals: 1,
  },
  {
    clau: "edatMitjana",
    etiqueta: "Edat mitjana",
    unitat: "anys",
    compta: "Edat mitjana de la població censada, calculada per l'Idescat.",
    taula: TAULES.indicadorsEdat,
    emex: "t25",
    decimals: 1,
  },
  {
    clau: "infants0a2",
    etiqueta: "Infants de 0 a 2 anys",
    unitat: "persones",
    compta:
      "Suma de les persones de 0, 1 i 2 anys. És la població a qui van adreçades les llars d'infants, " +
      "que sí que són competència municipal.",
    taula: TAULES.edatAnyAAny,
    emex: "t25",
    decimals: 0,
  },
  {
    clau: "de85iMes",
    etiqueta: "Persones de 85 anys o més",
    unitat: "persones",
    compta:
      "Suma dels trams de 85 a 89, de 90 a 94, de 95 a 99 i de 100 anys o més. És la població a qui " +
      "s'adrecen els serveis d'atenció domiciliària, que sí que són competència municipal.",
    taula: TAULES.edatQuinquennal,
    emex: "t25",
    decimals: 0,
  },
  {
    clau: "residentsAEstranger",
    etiqueta: "Persones empadronades que viuen a l'estranger",
    unitat: "persones",
    compta:
      "Espanyols inscrits al padró d'aquest municipi que resideixen a l'estranger (CERA). Compten per al " +
      "cens electoral del municipi, però no viuen al poble.",
    taula: TAULES.cera,
    emex: "t197",
    decimals: 0,
  },
];

// ─── Càlculs purs ────────────────────────────────────────────────────────────

/**
 * Suma unes quantes categories d'una mateixa dimensió.
 *
 * Torna `null` si en falta cap, i no la suma de les que hi són. Els trams de
 * població molt gran d'un poble petit poden venir marcats com a confidencials:
 * sumar només els que es publiquen donaria una xifra més baixa de la real i
 * ningú no sabria que hi falta una part.
 */
export function sumaExacta(valors: readonly (number | null)[]): number | null {
  if (valors.length === 0) return null;
  let total = 0;
  for (const valor of valors) {
    if (valor === null) return null;
    total += valor;
  }
  return total;
}

/**
 * Les dues xifres que la gent confon, posades una al costat de l'altra amb la
 * diferència explícita.
 *
 * **No en surt cap tercera xifra.** Aquesta funció existeix precisament per no
 * haver-ne de fer cap: dona els dos recomptes, els dos percentatges i les
 * persones que separen l'un de l'altre, i prou. Qualsevol suma o resta que
 * barregi les dues definicions —«població d'origen estranger», «immigrants»—
 * és una xifra inventada, i aquí no n'hi ha cap manera de fabricar-ne.
 */
export type Divergencia = {
  any: number;
  poblacio: number;
  nacionalitatEstrangera: number;
  nascutsAEstranger: number;
  pctNacionalitatEstrangera: number | null;
  pctNascutsAEstranger: number | null;
  /** Persones de diferència entre els dos recomptes. No és cap col·lectiu. */
  persones: number;
  /** Quin dels dos recomptes és més gran, per no haver de restar per saber-ho. */
  mesGran: "lloc de naixement" | "nacionalitat" | "iguals";
  nota: string;
};

export function divergencia(
  any: number,
  poblacio: number | null,
  nacionalitatEstrangera: number | null,
  nascutsAEstranger: number | null,
): Divergencia | null {
  if (poblacio === null || nacionalitatEstrangera === null || nascutsAEstranger === null) return null;
  const persones = Math.abs(nascutsAEstranger - nacionalitatEstrangera);
  return {
    any,
    poblacio,
    nacionalitatEstrangera,
    nascutsAEstranger,
    pctNacionalitatEstrangera: partDelTotal(nacionalitatEstrangera, poblacio),
    pctNascutsAEstranger: partDelTotal(nascutsAEstranger, poblacio),
    persones,
    mesGran:
      nascutsAEstranger > nacionalitatEstrangera
        ? "lloc de naixement"
        : nascutsAEstranger < nacionalitatEstrangera
          ? "nacionalitat"
          : "iguals",
    nota:
      "Són dos recomptes de coses diferents, no dues estimacions de la mateixa cosa. Ni la suma ni la " +
      "resta de tots dos vol dir res.",
  };
}

/**
 * Les dues xifres que expliquen la divergència, i que **només** surten de la
 * taula creuada.
 *
 * Aquesta taula està arrodonida: comparat amb la taula principal de
 * nacionalitat, el seu total d'estrangers balla fins a un parell o tres de
 * persones. Per això els totals que es publiquen surten sempre de la taula
 * principal, aquestes xifres es marquen com a derivades i arrodonides, i es
 * desa el desquadrament perquè la fitxa no pugui afirmar exactitud a la unitat.
 *
 * I cobreix **623 municipis dels 947**: la resta no en tenen, i no és cap error.
 */
export type Creuament = {
  any: number;
  /** Nascudes fora d'Espanya que tenen nacionalitat espanyola. */
  nascutsForaAmbNacionalitatEspanyola: number | null;
  /** Estrangers nascuts a Espanya. */
  estrangersNascutsAEspanya: number | null;
  /**
   * Diferència entre el total d'estrangers d'aquesta taula i el de la taula
   * principal. Si no és zero, aquestes xifres són aproximades.
   */
  desquadrament: number | null;
  /** Sempre cert: la font està arrodonida i no es pot afirmar la unitat. */
  arrodonit: true;
  nota: string;
};

export function creuament(params: {
  any: number;
  /** NATION=ESPA, PBIRTH=TOTAL */
  espanyolaTotal: number | null;
  /** NATION=ESPA, PBIRTH=ES */
  espanyolaNascudaAEspanya: number | null;
  /** NATION=TOT_FOREIGN, PBIRTH=ES */
  estrangeraNascudaAEspanya: number | null;
  /** NATION=TOT_FOREIGN, PBIRTH=TOTAL, de la taula creuada */
  estrangeraTotalCreuada: number | null;
  /** NATION=ESTR de la taula principal, que és la que mana */
  estrangeraTotalPrincipal: number | null;
}): Creuament {
  const { espanyolaTotal, espanyolaNascudaAEspanya } = params;
  return {
    any: params.any,
    nascutsForaAmbNacionalitatEspanyola:
      espanyolaTotal === null || espanyolaNascudaAEspanya === null
        ? null
        : espanyolaTotal - espanyolaNascudaAEspanya,
    estrangersNascutsAEspanya: params.estrangeraNascudaAEspanya,
    desquadrament:
      params.estrangeraTotalCreuada === null || params.estrangeraTotalPrincipal === null
        ? null
        : params.estrangeraTotalCreuada - params.estrangeraTotalPrincipal,
    arrodonit: true,
    nota:
      "Xifres derivades de la taula creuada, que l'Idescat publica arrodonida. Els totals de la fitxa " +
      "surten de les taules principals; aquestes dues són aproximades i no es poden afirmar a la unitat.",
  };
}

/**
 * El padró comparat amb el cens, que compten coses diferents.
 *
 * La mediana de diferència als 947 és 0,0 %, però 35 municipis se'n van més del
 * 2 % i els turístics sobreregistren de manera sistemàtica. Es desa perquè la
 * fitxa pugui triar quina de les dues xifres ensenya i dir per què.
 */
export type PadroContraCens = {
  any: number;
  padro: number;
  cens: number;
  persones: number;
  percentual: number | null;
  /** Cert quan la diferència és prou gran perquè la fitxa l'hagi d'explicar. */
  divergeix: boolean;
  nota: string;
};

/** A partir d'aquí la diferència entre padró i cens deixa de ser soroll. */
export const LLINDAR_PADRO_CENS = 2;

export function padroContraCens(any: number, padro: number | null, cens: number | null): PadroContraCens | null {
  if (padro === null || cens === null || cens <= 0) return null;
  const percentual = arrodoneix((100 * (padro - cens)) / cens, 1);
  return {
    any,
    padro,
    cens,
    persones: padro - cens,
    percentual,
    divergeix: Math.abs(percentual) > LLINDAR_PADRO_CENS,
    nota:
      "El padró compta persones empadronades i el cens estima qui hi resideix. Als municipis turístics " +
      "el padró sol anar per sobre.",
  };
}

// ─── Comparació dins del grup ────────────────────────────────────────────────

export type Comparacio = {
  grup: { clau: string; etiqueta: string; mida: number; ambDada: number };
  percentil: number;
  mediana: number;
};

/**
 * Percentil i mediana de cada municipi dins del seu grup de mida, comptant
 * només els que tenen dada. `ambDada` va al costat del percentil perquè un
 * percentil calculat sobre poques dades s'ha de poder llegir amb la
 * desconfiança que mereix.
 */
function comparaDinsDelGrup(
  valors: ReadonlyMap<number, number>,
  grups: ReadonlyMap<number, PeerGroup>,
  decimals: number,
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
      mediana: arrodoneix(mediana, decimals),
    });
  }
  return resultat;
}

// ─── El que es desa de cada indicador ────────────────────────────────────────

export type IndicadorPublicat = Indicador & {
  darrerAny: number | null;
  valor: number | null;
  serie: PuntSerie[];
  mandat: Variacio | null;
  mandatAnterior: Variacio | null;
  /** La mateixa variació de mandat als municipis de la seva mida. */
  mandatDelGrup: MedianaDelGrup | null;
  /**
   * Percentil dins del grup. Només per als indicadors que no són recomptes de
   * persones: el percentil de «quants estrangers hi ha» dins d'un tram de mida
   * és, a la pràctica, el percentil de la població, i no informa de res.
   */
  comparacio: Comparacio | null;
  /** L'enllaç d'aquest municipi que dona l'API, verbatim, o `null`. */
  enllac: EnllacMunicipi | null;
  /** La xifra de Catalunya sencera el mateix any, per poder-s'hi comparar. */
  catalunya: { valor: number | null; mandat: Variacio | null } | null;
};

// ─── Ingesta ─────────────────────────────────────────────────────────────────

/** Clau de la mètrica amb les dades de població. */
const KIND = "poblacio";
/** Clau de la mètrica amb els enllaços per municipi, que es reaprofiten. */
const KIND_ENLLACOS = "poblacioEnllacos";

export type Municipi = { id: number; name: string; idescat6: string | null; population: number | null };

/**
 * Índex `municipi → any → categoria → valor` d'una taula ingerida.
 *
 * `dimensio` és la dimensió que ens interessa (`NATION`, `PBIRTH`, `AGE`,
 * `CONCEPT`…). Les taules amb una sola dimensió útil hi passen igual: la clau
 * és llavors la seva única categoria.
 */
function indexa(
  taula: TaulaIngerida,
  dimensio: string,
): Map<string, Map<number, Map<string, number | null>>> {
  const index = new Map<string, Map<number, Map<string, number | null>>>();
  for (const cela of taula.celes) {
    let perAny = index.get(cela.mun);
    if (!perAny) index.set(cela.mun, (perAny = new Map()));
    let perCategoria = perAny.get(cela.any);
    if (!perCategoria) perAny.set(cela.any, (perCategoria = new Map()));
    perCategoria.set(cela.categories[dimensio] ?? "", cela.valor);
  }
  return index;
}

/** El mateix, però de la fila de Catalunya, que no és cap municipi. */
function indexaCatalunya(taula: TaulaIngerida, dimensio: string): Map<number, Map<string, number | null>> {
  const index = new Map<number, Map<string, number | null>>();
  for (const cela of taula.catalunya) {
    let perCategoria = index.get(cela.any);
    if (!perCategoria) index.set(cela.any, (perCategoria = new Map()));
    perCategoria.set(cela.categories[dimensio] ?? "", cela.valor);
  }
  return index;
}

const valorDe = (
  index: ReadonlyMap<number, Map<string, number | null>> | undefined,
  any: number,
  categoria: string,
): number | null => index?.get(any)?.get(categoria) ?? null;

/** Ordena una sèrie i li treu els anys sense cap punt. */
function serieDe(punts: readonly PuntSerie[]): PuntSerie[] {
  return [...punts].sort((a, b) => a.any - b.any);
}

export async function j18Poblacio(db: Db): Promise<void> {
  const tots: Municipi[] = (await db.select().from(municipalities)).map((m) => ({
    id: m.id,
    name: m.name,
    idescat6: m.idescat6,
    population: m.population,
  }));

  await j18EnllacosIdescat(db, tots);
  await j18Dades(db, tots);
}

// ─── Pas 1: els enllaços que la llicència obliga a mostrar ───────────────────

/**
 * Baixa, per a cada municipi, els enllaços que l'API dona de les seves taules.
 *
 * **Per què una crida per municipi.** L'API de taules mai no dona un enllaç per
 * municipi: només el de la taula sencera. Qui sí que en dona és l'API de fitxes
 * municipals (EMEX), i només quan se li demana un municipi concret; en mode
 * massiu torna els 947 de cop però sense cap enllaç. O sigui que o es fan 947
 * crides o no tenim el que la llicència ens fa mostrar. **No es construeixen
 * URL a mà**: fabricar-ne una és exactament el que les condicions d'ús
 * prohibeixen.
 *
 * Per no repetir-ho cada vegada, els enllaços es desen a la seva pròpia
 * mètrica i només es demanen els que falten. Una reingesta normal no fa cap
 * crida; una base de dades nova en fa 947, que amb la pausa entre crides són
 * uns quants minuts.
 */
export async function j18EnllacosIdescat(db: Db, municipis?: Municipi[]): Promise<void> {
  const tots =
    municipis ??
    (await db.select().from(municipalities)).map((m) => ({
      id: m.id,
      name: m.name,
      idescat6: m.idescat6,
      population: m.population,
    }));

  await withRun(db, "J18 enllaços de l'Idescat per municipi", async (run) => {
    const previs = await db
      .select()
      .from(municipalityMetrics)
      .where(eq(municipalityMetrics.kind, KIND_ENLLACOS));
    const cache = new Map<number, EnllacMunicipi[]>();
    for (const fila of previs) {
      const dades = fila.data as { enllacos?: EnllacMunicipi[] } | null;
      if (dades?.enllacos?.length) cache.set(fila.municipalityId, dades.enllacos);
    }
    run.say(`${cache.size} municipis ja tenien enllaços desats`);

    let baixats = 0;
    let fallits = 0;
    for (const municipi of tots) {
      if (cache.has(municipi.id)) continue;
      /**
       * Palmerola surt a la classificació territorial de l'Idescat i no té ni
       * dades ni fitxa municipal. Si l'arrosseguéssim aquí, la incidència de
       * gravetat alta que impedeix publicar quedaria oberta per sempre i
       * bloquejaria els 947 per un municipi del qual **sabem** que l'Idescat no
       * publica res.
       */
      if (municipi.idescat6 === PALMEROLA) {
        await run.issue({
          kind: "poblacio: municipi sense estadística a l'Idescat",
          severity: "baixa",
          municipalityId: municipi.id,
          detail: { municipi: municipi.name, idescat6: municipi.idescat6 },
        });
        continue;
      }
      if (!municipi.idescat6) {
        await run.issue({
          kind: "poblacio: municipi sense codi Idescat",
          severity: "alta",
          municipalityId: municipi.id,
          detail: { municipi: municipi.name },
        });
        fallits += 1;
        continue;
      }
      try {
        const fitxa = await emexFitxa(municipi.idescat6);
        if (fitxa.enllacos.length === 0) throw new Error("la fitxa no porta cap enllaç");
        cache.set(municipi.id, fitxa.enllacos);
        await db
          .insert(municipalityMetrics)
          .values({
            municipalityId: municipi.id,
            kind: KIND_ENLLACOS,
            data: {
              idescat6: municipi.idescat6,
              enllacos: fitxa.enllacos,
              obtingutEl: new Date().toISOString(),
              llicencia: LLICENCIA,
            },
          })
          .onConflictDoUpdate({
            target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
            set: {
              data: {
                idescat6: municipi.idescat6,
                enllacos: fitxa.enllacos,
                obtingutEl: new Date().toISOString(),
                llicencia: LLICENCIA,
              },
              computedAt: new Date(),
            },
          });
        baixats += 1;
        run.rowsOut += 1;
      } catch (error) {
        fallits += 1;
        // La llicència obliga a mostrar l'enllaç: sense ell no es pot publicar
        // la fitxa, i per això la incidència és de gravetat alta.
        await run.issue({
          kind: "poblacio: sense enllaç de l'Idescat",
          severity: "alta",
          municipalityId: municipi.id,
          detail: { municipi: municipi.name, idescat6: municipi.idescat6, error: String(error) },
        });
      }
    }
    run.rowsIn = baixats;
    run.say(`${baixats} fitxes baixades · ${cache.size} municipis amb enllaços · ${fallits} sense`);
    return { baixats, ambEnllacos: cache.size, sense: fallits };
  });
}

// ─── Pas 2: les dades ────────────────────────────────────────────────────────

async function j18Dades(db: Db, tots: Municipi[]): Promise<void> {
  await withRun(db, "J18 població", async (run) => {
    const perIdescat6 = new Map<string, number>();
    for (const m of tots) if (m.idescat6) perIdescat6.set(m.idescat6, m.id);
    const grups = buildPeerGroups(tots);

    // ── Els enllaços per municipi, del pas anterior ────────────────────────
    const filesEnllacos = await db
      .select()
      .from(municipalityMetrics)
      .where(eq(municipalityMetrics.kind, KIND_ENLLACOS));
    const enllacosPerMunicipi = new Map<number, Map<string, EnllacMunicipi>>();
    for (const fila of filesEnllacos) {
      const dades = fila.data as { enllacos?: EnllacMunicipi[] } | null;
      if (!dades?.enllacos) continue;
      enllacosPerMunicipi.set(fila.municipalityId, new Map(dades.enllacos.map((e) => [e.taula, e])));
    }

    // ── Les taules ─────────────────────────────────────────────────────────
    const demana = async (
      taula: string,
      filtres: Record<string, readonly string[]>,
      anys: readonly number[],
      anysPerCrida?: number,
    ): Promise<TaulaIngerida> => {
      const ingerida = await taulaIdescat(taula, { filtres, anys, anysPerCrida });
      run.rowsIn += ingerida.celes.length;
      /**
       * L'API **no** es queixa d'un filtre desconegut: torna 200 i la taula
       * sencera. Sense aquesta comprovació, el dia que l'Idescat reanomeni una
       * categoria continuaríem publicant una xifra que compta una altra cosa.
       */
      for (const problema of filtresNoAplicats(ingerida, filtres)) {
        await run.issue({
          kind: "poblacio: filtre no aplicat",
          severity: "alta",
          entity: taula,
          detail: { taula, ...problema },
        });
      }
      run.say(`${taula}: ${ingerida.celes.length} cel·les en ${ingerida.crides.length} crides`);
      return ingerida;
    };

    const nacionalitat = await demana(TAULES.nacionalitat, { SEX: ["TOTAL"], NATION: ["ESTR", "TOTAL"] }, SERIE_CENS, 3);
    const llocNaixement = await demana(
      TAULES.llocNaixement,
      { PBIRTH: ["CA09", "RES", "ESTR", "TOTAL"] },
      SERIE_CENS,
      2,
    );
    const indicadorsEdat = await demana(
      TAULES.indicadorsEdat,
      { SEX: ["TOTAL"], CONCEPT: ["PP_Y00_15", "PP_Y_GE65", "AGE_MEAN"] },
      SERIE_CENS,
      2,
    );
    const padro = await demana(TAULES.padro, { SEX: ["TOTAL"] }, SERIE_PADRO, 4);
    const cera = await demana(TAULES.cera, { SEX: ["TOTAL"] }, SERIE_CERA, 3);
    const edatAnyAAny = await demana(
      TAULES.edatAnyAAny,
      { SEX: ["TOTAL"], AGE: ["Y000", "Y001", "Y002"] },
      ANYS_MANDAT,
      2,
    );
    const edatQuinquennal = await demana(
      TAULES.edatQuinquennal,
      { SEX: ["TOTAL"], AGE: ["Y085_089", "Y090_094", "Y095_099", "Y_GE100"] },
      ANYS_MANDAT,
      2,
    );
    /**
     * La creuada només cobreix 623 municipis i només serveix per a dues xifres
     * derivades. Es demana l'últim any i prou: no en publiquem cap sèrie.
     */
    const taulaCreuada = await demana(
      TAULES.creuament,
      { PBIRTH: ["ES", "TOTAL"], NATION: ["ESPA", "TOT_FOREIGN", "TOTAL"] },
      [ANY_CREUAMENT],
      1,
    );

    const perTaula: Record<string, TaulaIngerida> = {
      [TAULES.nacionalitat]: nacionalitat,
      [TAULES.llocNaixement]: llocNaixement,
      [TAULES.indicadorsEdat]: indicadorsEdat,
      [TAULES.padro]: padro,
      [TAULES.cera]: cera,
      [TAULES.edatAnyAAny]: edatAnyAAny,
      [TAULES.edatQuinquennal]: edatQuinquennal,
      [TAULES.creuament]: taulaCreuada,
    };

    // ── Índexs ─────────────────────────────────────────────────────────────
    const iNacionalitat = indexa(nacionalitat, "NATION");
    const iNaixement = indexa(llocNaixement, "PBIRTH");
    const iEdat = indexa(indicadorsEdat, "CONCEPT");
    const iPadro = indexa(padro, "SEX");
    const iCera = indexa(cera, "SEX");
    const iInfants = indexa(edatAnyAAny, "AGE");
    const iGrans = indexa(edatQuinquennal, "AGE");

    /**
     * La taula creuada té dues dimensions útils alhora —nacionalitat **i** lloc
     * de naixement— i `indexa` només en pren una. Es fa a part, amb la clau
     * composta, perquè és exactament el creuament el que ens interessa.
     */
    const creuada = new Map<string, Map<string, number | null>>();
    for (const cela of taulaCreuada.celes) {
      if (cela.any !== ANY_CREUAMENT) continue;
      let perClau = creuada.get(cela.mun);
      if (!perClau) creuada.set(cela.mun, (perClau = new Map()));
      perClau.set(`${cela.categories.NATION}|${cela.categories.PBIRTH}`, cela.valor);
    }

    const catNacionalitat = indexaCatalunya(nacionalitat, "NATION");
    const catNaixement = indexaCatalunya(llocNaixement, "PBIRTH");
    const catEdat = indexaCatalunya(indicadorsEdat, "CONCEPT");
    const catPadro = indexaCatalunya(padro, "SEX");
    const catCera = indexaCatalunya(cera, "SEX");
    const catInfants = indexaCatalunya(edatAnyAAny, "AGE");
    const catGrans = indexaCatalunya(edatQuinquennal, "AGE");

    // ── Les sèries de cada indicador, per municipi ─────────────────────────
    /**
     * Construeix la sèrie d'un indicador a partir dels índexs. Es fa amb una
     * sola funció perquè la sèrie de Catalunya i la de cada municipi es
     * calculin **exactament igual**: si divergissin, la comparació amb el país
     * no voldria dir res.
     */
    const seriesDe = (
      anys: readonly number[],
      fonts: {
        nacionalitat: ReadonlyMap<number, Map<string, number | null>> | undefined;
        naixement: ReadonlyMap<number, Map<string, number | null>> | undefined;
        edat: ReadonlyMap<number, Map<string, number | null>> | undefined;
        padro: ReadonlyMap<number, Map<string, number | null>> | undefined;
        cera: ReadonlyMap<number, Map<string, number | null>> | undefined;
        infants: ReadonlyMap<number, Map<string, number | null>> | undefined;
        grans: ReadonlyMap<number, Map<string, number | null>> | undefined;
      },
    ): Map<string, PuntSerie[]> => {
      const series = new Map<string, PuntSerie[]>();
      const afegeix = (clau: string, any: number, valor: number | null): void => {
        const punts = series.get(clau) ?? [];
        punts.push({ any, valor });
        series.set(clau, punts);
      };

      for (const any of SERIE_PADRO) afegeix("padroHabitants", any, valorDe(fonts.padro, any, "TOTAL"));
      for (const any of anys) {
        const poblacio = valorDe(fonts.nacionalitat, any, "TOTAL");
        const estrangera = valorDe(fonts.nacionalitat, any, "ESTR");
        const nascutsFora = valorDe(fonts.naixement, any, "ESTR");
        afegeix("censHabitants", any, poblacio);
        afegeix("nacionalitatEstrangera", any, estrangera);
        afegeix("pctNacionalitatEstrangera", any, partDelTotal(estrangera, poblacio));
        afegeix("nascutsAEstranger", any, nascutsFora);
        afegeix("pctNascutsAEstranger", any, partDelTotal(nascutsFora, poblacio));
        afegeix("nascutsACatalunya", any, valorDe(fonts.naixement, any, "CA09"));
        afegeix("nascutsAlaRestaDEspanya", any, valorDe(fonts.naixement, any, "RES"));
        afegeix("pct65iMes", any, valorDe(fonts.edat, any, "PP_Y_GE65"));
        afegeix("pct0a15", any, valorDe(fonts.edat, any, "PP_Y00_15"));
        afegeix("edatMitjana", any, valorDe(fonts.edat, any, "AGE_MEAN"));
      }
      // El CERA té sèrie pròpia i molt més llarga que la del cens: es recorre a
      // part, com el padró, i no s'escapça per fer-la coincidir amb les altres.
      for (const any of SERIE_CERA) {
        afegeix("residentsAEstranger", any, valorDe(fonts.cera, any, "TOTAL"));
      }
      for (const any of ANYS_MANDAT) {
        afegeix(
          "infants0a2",
          any,
          sumaExacta(["Y000", "Y001", "Y002"].map((tram) => valorDe(fonts.infants, any, tram))),
        );
        afegeix(
          "de85iMes",
          any,
          sumaExacta(
            ["Y085_089", "Y090_094", "Y095_099", "Y_GE100"].map((tram) => valorDe(fonts.grans, any, tram)),
          ),
        );
      }
      for (const [clau, punts] of series) series.set(clau, serieDe(punts));
      return series;
    };

    const seriesPerMunicipi = new Map<number, Map<string, PuntSerie[]>>();
    const orfes = new Map<string, string>();
    const codisVistos = new Set<string>();
    for (const taula of Object.values(perTaula)) {
      for (const cela of taula.celes) codisVistos.add(cela.mun);
    }
    for (const codi of codisVistos) {
      /**
       * Palmerola surt a la classificació territorial de l'Idescat i **no és**
       * cap dels 947: l'API no en publica cap dada i el nostre catàleg no la
       * té. No és un forat nostre i no ha de sortir a la llista d'incidències
       * cada vegada, que és com es perd la confiança en aquesta llista.
       */
      if (codi === PALMEROLA) continue;
      if (!perIdescat6.has(codi)) {
        const nom = nacionalitat.celes.find((c) => c.mun === codi)?.municipi ?? "";
        orfes.set(codi, nom);
      }
    }
    for (const [codi, nom] of orfes) {
      await run.issue({
        kind: "poblacio: codi sense municipi",
        severity: "baixa",
        entity: codi,
        detail: { idescat6: codi, municipi: nom },
      });
    }
    run.say(`${codisVistos.size} codis a les taules · ${orfes.size} sense municipi al catàleg`);

    for (const municipi of tots) {
      if (!municipi.idescat6) continue;
      const codi = municipi.idescat6;
      seriesPerMunicipi.set(
        municipi.id,
        seriesDe(SERIE_CENS, {
          nacionalitat: iNacionalitat.get(codi),
          naixement: iNaixement.get(codi),
          edat: iEdat.get(codi),
          padro: iPadro.get(codi),
          cera: iCera.get(codi),
          infants: iInfants.get(codi),
          grans: iGrans.get(codi),
        }),
      );
    }

    const seriesCatalunya = seriesDe(SERIE_CENS, {
      nacionalitat: catNacionalitat,
      naixement: catNaixement,
      edat: catEdat,
      padro: catPadro,
      cera: catCera,
      infants: catInfants,
      grans: catGrans,
    });

    // ── Variacions de mandat, del grup, i percentils ───────────────────────
    const darrerAnyDe = (clau: string): number | null => {
      let darrer: number | null = null;
      for (const series of seriesPerMunicipi.values()) {
        for (const punt of series.get(clau) ?? []) {
          if (punt.valor === null) continue;
          if (darrer === null || punt.any > darrer) darrer = punt.any;
        }
      }
      return darrer;
    };

    type Calculat = {
      darrerAny: number | null;
      mandats: Map<number, Variacio>;
      mandatsDelGrup: Map<number, MedianaDelGrup>;
      comparacions: Map<number, Comparacio>;
    };
    const calculats = new Map<string, Calculat>();

    for (const indicador of INDICADORS) {
      const darrerAny = darrerAnyDe(indicador.clau);
      const mandats = new Map<number, Variacio>();
      const valorsDarrerAny = new Map<number, number>();
      if (darrerAny !== null) {
        for (const [municipalityId, series] of seriesPerMunicipi) {
          const serie = series.get(indicador.clau) ?? [];
          const variacio = variacioEntre(serie, MANDAT, darrerAny);
          if (variacio) mandats.set(municipalityId, variacio);
          const valor = serie.find((p) => p.any === darrerAny)?.valor;
          if (valor !== null && valor !== undefined) valorsDarrerAny.set(municipalityId, valor);
        }
      }
      calculats.set(indicador.clau, {
        darrerAny,
        mandats,
        mandatsDelGrup: medianaPerGrup(
          new Map(
            [...mandats].map(([id, v]) => [id, { fins: v.fins, diferencia: v.diferencia, percentual: v.percentual }]),
          ),
          grups,
        ),
        // El percentil d'un recompte de persones dins d'un tram de mida és, a
        // la pràctica, el percentil de la població: no informa de res.
        comparacions:
          indicador.unitat === "persones"
            ? new Map()
            : comparaDinsDelGrup(valorsDarrerAny, grups, indicador.decimals),
      });
    }

    // ── Desa ───────────────────────────────────────────────────────────────
    const fonts = INDICADORS.map((i) => i.taula)
      .filter((taula, i, llista) => llista.indexOf(taula) === i)
      .concat(TAULES.creuament)
      .map((taula) => {
        const ingerida = perTaula[taula]!;
        return {
          taula,
          nom: ingerida.label,
          /** Atribució literal de l'Idescat. No es reescriu. */
          font: ingerida.source,
          actualitzat: ingerida.updated,
          /** Les URL exactes de cada crida, tal com les torna l'API. */
          crides: ingerida.crides,
          /** Els enllaços que l'API declara, verbatim. */
          enllacos: ingerida.enllacos,
        };
      });

    let ambMandat = 0;
    let ambCreuament = 0;
    let senseEnllac = 0;

    for (const municipi of tots) {
      const series = seriesPerMunicipi.get(municipi.id);
      if (!series || !municipi.idescat6) {
        await run.issue({
          kind: "poblacio: sense dades",
          severity: "mitjana",
          municipalityId: municipi.id,
          detail: { municipi: municipi.name, idescat6: municipi.idescat6 },
        });
        continue;
      }
      const codi = municipi.idescat6;
      const enllacos = enllacosPerMunicipi.get(municipi.id) ?? new Map<string, EnllacMunicipi>();
      // Palmerola no en té perquè l'Idescat no en publica res; no és un forat.
      if (enllacos.size === 0 && codi !== PALMEROLA) senseEnllac += 1;

      const indicadors: IndicadorPublicat[] = INDICADORS.map((indicador) => {
        const serie = series.get(indicador.clau) ?? [];
        const calculat = calculats.get(indicador.clau)!;
        const darrerAny = calculat.darrerAny;
        const serieCatalunya = seriesCatalunya.get(indicador.clau) ?? [];
        return {
          ...indicador,
          darrerAny,
          valor: darrerAny === null ? null : (serie.find((p) => p.any === darrerAny)?.valor ?? null),
          serie,
          mandat: darrerAny === null ? null : variacioEntre(serie, MANDAT, darrerAny),
          // Només el padró arriba prou enrere per tenir mandat anterior.
          mandatAnterior: variacioEntre(serie, MANDAT_ANTERIOR, MANDAT),
          mandatDelGrup: calculat.mandatsDelGrup.get(municipi.id) ?? null,
          comparacio: calculat.comparacions.get(municipi.id) ?? null,
          enllac: indicador.emex === null ? null : (enllacos.get(indicador.emex) ?? null),
          catalunya:
            darrerAny === null
              ? null
              : {
                  valor: serieCatalunya.find((p) => p.any === darrerAny)?.valor ?? null,
                  mandat: variacioEntre(serieCatalunya, MANDAT, darrerAny),
                },
        };
      });

      const perClau = new Map(indicadors.map((i) => [i.clau, i]));
      const anyCens = perClau.get("censHabitants")!.darrerAny;
      if (perClau.get("censHabitants")!.mandat) ambMandat += 1;

      const dades = {
        font: {
          organisme: LLICENCIA.organisme,
          /**
           * La llicència de l'Idescat **no** és CC i obliga a mostrar aquests
           * enllaços tal com els dona l'API. La fitxa n'ha de posar un al
           * costat de cada xifra.
           */
          llicencia: LLICENCIA,
          taules: fonts,
          /** L'enllaç d'aquest municipi, verbatim, per a cada taula de l'Idescat. */
          enllacosMunicipi: [...enllacos.values()],
          descartades: FONTS_DESCARTADES,
        },
        /**
         * Res d'això no ho decideix l'ajuntament: és el context en què governa,
         * no un resultat de la seva gestió.
         */
        context: {
          decideixLAjuntament: false,
          nota:
            "Un ajuntament no decideix qui neix, qui mor ni qui es muda. Aquestes xifres descriuen el " +
            "poble, no la gestió del consistori, i el que sí que en depèn és què hi fa a partir d'aquí: " +
            "llars d'infants, atenció domiciliària, habitatge.",
        },
        mandat: { desDe: MANDAT, anterior: MANDAT_ANTERIOR },
        darrerAny: anyCens,
        indicadors,
        /**
         * Les dues xifres que la gent confon, amb la diferència explícita i
         * sense cap tercera xifra que les barregi.
         */
        divergencia:
          anyCens === null
            ? null
            : divergencia(
                anyCens,
                valorDe(iNacionalitat.get(codi), anyCens, "TOTAL"),
                valorDe(iNacionalitat.get(codi), anyCens, "ESTR"),
                valorDe(iNaixement.get(codi), anyCens, "ESTR"),
              ),
        /** Per què es diferencien. Només per a 623 municipis, i arrodonit. */
        creuament: (() => {
          const cel = creuada.get(codi);
          if (!cel) return null;
          ambCreuament += 1;
          return creuament({
            any: ANY_CREUAMENT,
            espanyolaTotal: cel.get("ESPA|TOTAL") ?? null,
            espanyolaNascudaAEspanya: cel.get("ESPA|ES") ?? null,
            estrangeraNascudaAEspanya: cel.get("TOT_FOREIGN|ES") ?? null,
            estrangeraTotalCreuada: cel.get("TOT_FOREIGN|TOTAL") ?? null,
            estrangeraTotalPrincipal: valorDe(iNacionalitat.get(codi), ANY_CREUAMENT, "ESTR"),
          });
        })(),
        /** El padró i el cens no compten el mateix, i aquí es veu quant. */
        padroContraCens:
          anyCens === null
            ? null
            : padroContraCens(
                anyCens,
                valorDe(iPadro.get(codi), anyCens, "TOTAL"),
                valorDe(iNacionalitat.get(codi), anyCens, "TOTAL"),
              ),
      };

      await db
        .insert(municipalityMetrics)
        .values({ municipalityId: municipi.id, kind: KIND, data: dades })
        .onConflictDoUpdate({
          target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
          set: { data: dades, computedAt: new Date() },
        });
      run.rowsOut += 1;
    }

    if (senseEnllac > 0) {
      // Sense enllaç no es pot complir la llicència, i per tant no es publica.
      await run.issue({
        kind: "poblacio: fitxes sense enllaç de l'Idescat",
        severity: "alta",
        detail: {
          municipis: senseEnllac,
          remei: "torna a executar J18 perquè baixi les fitxes municipals que falten",
        },
      });
    }

    const darrerAnyCens = calculats.get("censHabitants")?.darrerAny ?? "?";
    run.say(`${run.rowsOut} municipis desats · ${ambMandat} amb variació de mandat ${MANDAT}-${darrerAnyCens}`);
    run.say(`${ambCreuament} amb la taula creuada (l'Idescat només en publica 623)`);
    run.say(`${senseEnllac} municipis sense l'enllaç que la llicència obliga a mostrar`);
    return {
      municipis: run.rowsOut,
      ambMandat,
      ambCreuament,
      senseEnllac,
      indicadors: INDICADORS.length,
      orfes: orfes.size,
    };
  });
}
