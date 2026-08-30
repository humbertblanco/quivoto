import { mkdir, writeFile } from "node:fs/promises";
import { asc, eq, sql } from "drizzle-orm";
import { dataIssues, electionParticipation, municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { buildPeerGroups, percentileOf } from "../derive/peers";
import type { RadiografiaData } from "./radiografia";
import { capcalera, tipografia } from "./capcalera";
import { cercador } from "./cercador";
import { peu } from "./peu";
import { RADIOGRAFIA_CSS } from "./estil";

/**
 * La descàrrega de dades.
 *
 * Això **no és un portal de dades obertes ni una API**. És un grapat de fitxers
 * estàtics perquè un periodista local ens pugui comprovar i reutilitzar sense
 * demanar-nos permís ni esperar cap resposta. No prometem estabilitat de les
 * claus més enllà del que puguem sostenir, i per això tot va datat.
 *
 * Regla que ordena el mòdul: **el que es publica aquí és exactament el que
 * mostra la fitxa del municipi**. Per això els indicadors surten de
 * `RadiografiaData`, el mateix tipus que fa servir `radiografia.ts`: si demà la
 * fitxa canvia, aquest fitxer deixa de compilar i algú se n'ha d'adonar.
 */

// ------------------------------------------------------------------- fonts

type Font = {
  /** Identificador del conjunt al portal d'origen. És el que fa comprovable la xifra. */
  id: string;
  titol: string;
  portal: string;
  llicencia: string;
  url: string;
};

const SOCRATA = "Generalitat de Catalunya · Dades Obertes";
const AOC = "Consorci AOC · dadesobertes.seu-e.cat";

/**
 * Llicències comprovades amb crides reals al portal el 29-08-2026. Al catàleg
 * de l'AOC hi ha conjunts duplicats amb el mateix títol i llicències diferents
 * (`cc-nc`, `cc-by`, «no especificada»); els identificadors que fem servir són
 * tots CC0, i per això aquí hi va l'identificador i no el nom del conjunt.
 */
const FONTS = {
  ensLocals: {
    id: "6nei-4b44", titol: "Dades generals dels ens locals de Catalunya", portal: SOCRATA,
    llicencia: "Condicions d'ús del portal (reutilització lliure amb atribució)",
    url: "https://analisi.transparenciacatalunya.cat/d/6nei-4b44",
  },
  resultats: {
    id: "ntc4-rnwr", titol: "Processos electorals · Vots", portal: SOCRATA,
    llicencia: "Condicions d'ús del portal (reutilització lliure amb atribució)",
    url: "https://analisi.transparenciacatalunya.cat/d/ntc4-rnwr",
  },
  participacio: {
    id: "irrv-2mfc", titol: "Processos electorals · Participació", portal: SOCRATA,
    llicencia: "Condicions d'ús del portal (reutilització lliure amb atribució)",
    url: "https://analisi.transparenciacatalunya.cat/d/irrv-2mfc",
  },
  candidats: {
    id: "xnfg-weec", titol: "Processos electorals · Persones candidates", portal: SOCRATA,
    llicencia: "Condicions d'ús del portal (reutilització lliure amb atribució)",
    url: "https://analisi.transparenciacatalunya.cat/d/xnfg-weec",
  },
  alcaldies: {
    id: "2v2p-vu4h", titol: "Historial d'alcaldes/esses 1979-2027", portal: SOCRATA,
    llicencia: "Condicions d'ús del portal (reutilització lliure amb atribució)",
    url: "https://analisi.transparenciacatalunya.cat/d/2v2p-vu4h",
  },
  plens: {
    id: "nm3n-3vbj", titol: "Composició dels plens municipals", portal: SOCRATA,
    llicencia: "Condicions d'ús del portal (reutilització lliure amb atribució)",
    url: "https://analisi.transparenciacatalunya.cat/d/nm3n-3vbj",
  },
  liquidacionsGencat: {
    id: "ytva-5kp3", titol: "Liquidació dels pressupostos dels ens locals", portal: SOCRATA,
    llicencia: "Condicions d'ús del portal (reutilització lliure amb atribució)",
    url: "https://analisi.transparenciacatalunya.cat/d/ytva-5kp3",
  },
  historic: {
    id: "3539f7e6", titol: "Eleccions municipals: resultats històrics en vots 1979-2023", portal: AOC,
    llicencia: "CC0", url: "https://dadesobertes.seu-e.cat/dataset/eleccions-municipals-resultats-historics-en-vots",
  },
  liquidacio: {
    id: "81f18313", titol: "Liquidació del pressupost (execució per capítols)", portal: AOC,
    llicencia: "CC0", url: "https://dadesobertes.seu-e.cat/dataset/liquidacio-del-pressupost-execucio-per-capitols",
  },
  deute: {
    id: "34db8dc5", titol: "Endeutament (deute viu a 31/12)", portal: AOC,
    llicencia: "CC0", url: "https://dadesobertes.seu-e.cat/dataset/ge-ge-endeutament",
  },
  pmp: {
    id: "eecca986", titol: "Període mitjà de pagament a proveïdors", portal: AOC,
    llicencia: "CC0", url: "https://dadesobertes.seu-e.cat/dataset/ge-ge-termini-pagament-proveidors",
  },
  impostos: {
    id: "82ae0ea2", titol: "Tipus impositius municipals", portal: AOC,
    llicencia: "CC0", url: "https://dadesobertes.seu-e.cat/dataset/agn-npp-tipus-impositius",
  },
  costEfectiu: {
    id: "12c13cdd", titol: "Cost efectiu dels serveis (Ministeri d'Hisenda)", portal: AOC,
    llicencia: "CC0", url: "https://dadesobertes.seu-e.cat/dataset/ge-ge-cost-efectiu-serveis-minhap",
  },
  transparencia: {
    id: "1a9c1ede", titol: "Emplenament dels portals de transparència", portal: AOC,
    llicencia: "CC0", url: "https://dadesobertes.seu-e.cat/dataset/emplenament-dels-portals-de-transparencia",
  },
  actes: {
    id: "b5d370d0", titol: "Actes del Ple", portal: AOC,
    llicencia: "CC0", url: "https://dadesobertes.seu-e.cat/dataset/agn-ag-actes-de-ple",
  },
  sindic: {
    id: "943d6174", titol: "Ajuntaments sense regidors de l'oposició (Síndic de Greuges)", portal: AOC,
    llicencia: "CC0", url: "https://dadesobertes.seu-e.cat/dataset/sindic-de-greuges-ajuntaments-sense-regidors-de-l-oposicio",
  },
  liquidacioEconomica: {
    id: "8squ-bk4r", titol: "Liquidació del pressupost, econòmic i per programes", portal: SOCRATA,
    llicencia: "Condicions d'ús del portal (reutilització lliure amb atribució)",
    url: "https://analisi.transparenciacatalunya.cat/d/8squ-bk4r",
  },
  liquidacioProgrames: {
    // Comprovat al CKAN de l'AOC el 30-08-2026: el paquet `f65ae930` és `cc-zero`.
    id: "5b96829f", titol: "Liquidació del pressupost per programes (grups de programa)", portal: AOC,
    llicencia: "CC0", url: "https://dadesobertes.seu-e.cat/dataset/ge-p-liquidacions-per-programes-detallat",
  },
  ambEns: {
    id: "2r5q-tsxs", titol: "Ens on participa cada ens local", portal: SOCRATA,
    llicencia: "Condicions d'ús del portal (reutilització lliure amb atribució)",
    url: "https://analisi.transparenciacatalunya.cat/d/2r5q-tsxs",
  },
  arc: {
    id: "69zu-w48s", titol: "Estadística de residus municipals (Agència de Residus de Catalunya)", portal: SOCRATA,
    llicencia: "Condicions d'ús del portal (reutilització lliure amb atribució)",
    url: "https://analisi.transparenciacatalunya.cat/d/69zu-w48s",
  },
  fiances: {
    id: "qww9-bvhh", titol: "Preu mitjà del lloguer, per les fiances dipositades (Agència de l'Habitatge)", portal: SOCRATA,
    llicencia: "Condicions d'ús del portal (reutilització lliure amb atribució)",
    url: "https://analisi.transparenciacatalunya.cat/d/qww9-bvhh",
  },
  aca: {
    id: "aca-preus", titol: "Observatori del preu de l'aigua", portal: "Agència Catalana de l'Aigua · aca.gencat.cat",
    llicencia: "Llicència oberta d'ús d'informació – Catalunya (avís legal de gencat.cat): citar la font i no alterar-ne el sentit",
    url: "https://aca.gencat.cat/ca/laigua/consulta-de-dades/observatori-del-preu-de-laigua/",
  },
  /*
   * L'Idescat no és CC: les condicions de les seves API obliguen a presentar
   * cada xifra amb l'enllaç que l'API ha donat, tal com l'ha donat. Aquí hi va
   * la pàgina general; l'enllaç de cada municipi va al JSON del municipi.
   */
  idescatPoblacio: {
    id: "censph/5992/5987", titol: "Cens de població: nacionalitat espanyola i estrangera", portal: "Idescat · idescat.cat",
    llicencia: "Condicions d'ús de l'Idescat: cal enllaçar la pàgina de l'Idescat al costat de la xifra",
    // La mateixa pàgina que l'API dona per municipi (`&geo=mun:…`), sense el municipi.
    url: "https://www.idescat.cat/pub/?id=censph&n=479",
  },
  idescatIbi: {
    id: "ibi/173", titol: "Impost de béns immobles de naturalesa urbana (IBI), taula 173", portal: "Idescat · idescat.cat",
    llicencia: "Condicions d'ús de l'Idescat: cal enllaçar la pàgina de l'Idescat al costat de la xifra",
    url: "https://www.idescat.cat/pub/?id=ibi&n=173",
  },
  /*
   * L'INE permet reutilitzar citant la font i la data de l'última actualització,
   * i imposa la forma de la citació quan les dades s'elaboren, que és el cas:
   * la fórmula literal va a la llicència i la data de la taula, al JSON del
   * municipi.
   */
  ineAdrh: {
    id: "ADRH", titol: "Atlas de distribución de renta de los hogares (ADRH)", portal: "INE · ine.es",
    llicencia: "Reutilització lliure citant la font i la data d'actualització: «Elaboración propia con datos extraídos del sitio web del INE: www.ine.es»",
    // El catàleg de l'operació, que és d'on J23 treu les quatre taules provincials.
    url: "https://servicios.ine.es/wstempus/js/ES/TABLAS_OPERACION/ADRH",
  },
} as const satisfies Record<string, Font>;

type ClauFont = keyof typeof FONTS;

// ------------------------------------------------------------------- camps

type Camp = {
  /** Nom de columna al fitxer global i clau al JSON. */
  clau: string;
  /** Nom llegible: és el que va a la columna `indicador` del CSV per municipi. */
  etiqueta: string;
  unitat: string;
  font: ClauFont;
  descripcio: string;
  /** Surt al fitxer de tot Catalunya, que és d'una fila per municipi. */
  global?: boolean;
  /** El valor el calculem nosaltres a partir de la font indicada. */
  propi?: boolean;
};

type Bloc = { titol: string; nota: string; camps: readonly Camp[] };

/**
 * El catàleg de camps mana sobre tot: d'aquí surten les columnes del fitxer
 * global, les files del fitxer per municipi i les taules de l'`ESQUEMA.md`.
 * Afegir un indicador vol dir afegir-hi una fila, i queda documentat sol.
 */
const BLOCS: readonly Bloc[] = [
  {
    titol: "El municipi",
    nota: "Identificació i mida. El padró és el vigent al portal el dia de la generació.",
    camps: [
      { clau: "poblacio", etiqueta: "Població", unitat: "habitants", font: "ensLocals", global: true,
        descripcio: "Padró municipal d'habitants. L'any és el de la revisió que consta a la font." },
      { clau: "regidories", etiqueta: "Regidories al ple", unitat: "regidories", font: "ensLocals", global: true, propi: true,
        descripcio: "Escons del ple del mandat 2023-2027. Calculat pel tram de població de la LOREG (art. 179) i contrastat amb els resultats." },
      { clau: "sistema_electoral", etiqueta: "Sistema electoral", unitat: "", font: "ensLocals", global: true, propi: true,
        descripcio: "`llistes tancades`, `llistes obertes` o `consell obert`, sempre en minúscules perquè s'hi pugui agrupar. 178 municipis catalans no reparteixen els escons per la llei d'Hondt (LOREG art. 179.2 i 184)." },
      { clau: "grup_comparacio", etiqueta: "Grup de comparació", unitat: "", font: "ensLocals", global: true, propi: true,
        descripcio: "Municipis de la mateixa mida amb qui és honest comparar-lo. El criteri és el tram de població de la LOREG, i els trams amb menys de 12 municipis s'ajunten amb el veí." },
      { clau: "grup_mida", etiqueta: "Municipis del grup de comparació", unitat: "municipis", font: "ensLocals", global: true, propi: true,
        descripcio: "Quants municipis hi ha al grup. Un percentil sobre quatre municipis és soroll, i cal poder-ho veure." },
      { clau: "poblacio_estrangera_pct", etiqueta: "Població de nacionalitat estrangera", unitat: "%", font: "idescatPoblacio", global: true,
        descripcio: "Persones sense nacionalitat espanyola sobre el total de població censada. No és el mateix que «nascuts a l'estranger». Res d'això no ho decideix l'ajuntament: és el context en què governa." },
      { clau: "renda_neta_persona", etiqueta: "Renda neta mitjana per persona", unitat: "€/any", font: "ineAdrh", global: true,
        descripcio: "Renda de la llar després d'impostos i cotitzacions, repartida entre tots els seus membres. L'INE tapa per secret estadístic els municipis més petits: un municipi sense xifra no és un municipi sense renda." },
      { clau: "renda_any", etiqueta: "Any de la renda", unitat: "any", font: "ineAdrh", global: true,
        descripcio: "L'any a què es refereix la renda, repetit al fitxer global perquè hi càpiga: la sèrie de l'INE arriba amb dos o tres anys de retard i sovint acaba abans de les eleccions del 2023." },
    ],
  },
  {
    titol: "Qui governa",
    nota: "El mandat 2023-2027, tal com està avui. Res d'això és una valoració: són els fets que consten a les fonts.",
    camps: [
      { clau: "alcaldia", etiqueta: "Alcaldia", unitat: "", font: "ensLocals", global: true,
        descripcio: "Nom de l'alcalde o alcaldessa en actiu. És un càrrec electe: publiquem nom, càrrec i candidatura, mai dades de contacte." },
      { clau: "alcaldia_sigles", etiqueta: "Candidatura de l'alcaldia", unitat: "", font: "resultats", global: true, propi: true,
        descripcio: "Sigles de la llista amb què va concórrer. Lligar el partit que declara la font amb una llista del 2023 és un aparellament nostre i pot fallar." },
      { clau: "alcaldia_presa_possessio", etiqueta: "Presa de possessió de l'alcaldia", unitat: "data", font: "alcaldies",
        descripcio: "Data en què va prendre possessió la persona que ocupa l'alcaldia ara." },
      { clau: "alcaldia_canvi_mandat", etiqueta: "Canvi d'alcaldia a mig mandat", unitat: "sí/no", font: "alcaldies", global: true, propi: true,
        descripcio: "Cert si l'alcaldia ha canviat de mans després de la constitució del ple del 2023. La font no en diu el motiu." },
      { clau: "alcaldies_persones", etiqueta: "Persones que han ocupat l'alcaldia des del 1979", unitat: "persones", font: "alcaldies", global: true, propi: true,
        descripcio: "Noms diferents a l'historial d'alcaldies. La font escriu el mateix nom de maneres diferents segons l'any: normalitzem accents i majúscules abans de comptar." },
      { clau: "llista_mes_votada", etiqueta: "Llista més votada el 2023", unitat: "", font: "resultats", global: true,
        descripcio: "Sigles de la candidatura amb més vots a les municipals del 2023." },
      { clau: "regidories_mes_votada", etiqueta: "Regidories de la llista més votada", unitat: "regidories", font: "resultats", global: true,
        descripcio: "Escons que va obtenir la llista més votada." },
      { clau: "regidories_alcaldia", etiqueta: "Regidories de la candidatura de l'alcaldia", unitat: "regidories", font: "resultats", global: true, propi: true,
        descripcio: "Escons de la llista que ocupa l'alcaldia. Buit quan no hem pogut aparellar l'alcaldia amb cap llista." },
      { clau: "governa_mes_votat", etiqueta: "Governa la llista més votada", unitat: "sí/no", font: "resultats", global: true, propi: true,
        descripcio: "Cert quan l'alcaldia és de la llista que va guanyar. Fals vol dir que hi va haver pacte. Buit quan l'aparellament no és fiable." },
      { clau: "majoria_absoluta", etiqueta: "Majoria absoluta d'una sola llista", unitat: "sí/no", font: "resultats", global: true, propi: true,
        descripcio: "Cert quan la llista més votada té prou escons per governar sola." },
      { clau: "regidories_per_governar", etiqueta: "Regidories per a la majoria absoluta", unitat: "regidories", font: "resultats", propi: true,
        descripcio: "La meitat més un dels escons del ple." },
      { clau: "partits_efectius", etiqueta: "Partits efectius al ple", unitat: "índex", font: "resultats", global: true, propi: true,
        descripcio: "Índex de Laakso-Taagepera sobre els escons: 1 és un ple d'un sol color i, com més alt, més repartit. Mesura la fragmentació, no la qualitat del govern." },
      { clau: "sense_oposicio", etiqueta: "Ple sense oposició", unitat: "sí/no", font: "sindic", global: true,
        descripcio: "Cert quan el Síndic de Greuges compta aquest ajuntament entre els que només tenen una candidatura al ple." },
      { clau: "substitucions_ple", etiqueta: "Persones que han entrat al ple després de la constitució", unitat: "persones", font: "plens", propi: true,
        descripcio: "Regidors que seuen al ple i no eren a la llista d'elegits del 2023: algú va plegar i el va rellevar el següent de la seva llista. No en publiquem el motiu perquè cap font el dona, ni els canvis de grup, perquè les sigles s'escriuen de massa maneres per afirmar-ho sense equivocar-nos." },
    ],
  },
  {
    titol: "Les eleccions",
    nota: "Una fila per any electoral. Del 1979 al 2011 la font és el recull històric de l'AOC; del 2015 al 2023, el conjunt de la Generalitat.",
    camps: [
      { clau: "guanyador", etiqueta: "Llista més votada", unitat: "", font: "historic",
        descripcio: "Sigles de la llista guanyadora de cada convocatòria, del 1979 al 2023." },
      { clau: "guanyador_regidories", etiqueta: "Regidories de la llista més votada", unitat: "regidories", font: "historic",
        descripcio: "Escons de la llista guanyadora aquell any." },
      { clau: "regidories_ple", etiqueta: "Regidories del ple", unitat: "regidories", font: "historic",
        descripcio: "Mida del ple sortit de cada elecció. Canvia quan canvia el padró." },
      { clau: "candidatures", etiqueta: "Candidatures presentades", unitat: "candidatures", font: "historic",
        descripcio: "Llistes que van concórrer aquell any, amb escons o sense." },
      { clau: "vots_valids", etiqueta: "Vots a candidatures", unitat: "vots", font: "historic",
        descripcio: "Suma dels vots de totes les candidatures. No hi entren els blancs ni els nuls." },
      { clau: "alternances", etiqueta: "Canvis de força més votada des del 1979", unitat: "vegades", font: "historic", global: true, propi: true,
        descripcio: "Cops que la força guanyadora ha canviat entre dues eleccions seguides. Zero vol dir que sempre ha guanyat la mateixa. Comparem per força i no per sigles, perquè les coalicions locals es rebategen sovint." },
      { clau: "eleccions_comptades", etiqueta: "Eleccions amb dada", unitat: "eleccions", font: "historic", global: true,
        descripcio: "De les dotze convocatòries del 1979 al 2023, quantes en tenim. Els municipis creats després del 1979 en tenen menys." },
    ],
  },
  {
    titol: "Participació",
    nota: "Les tres últimes municipals. Els vots en blanc compten per a la barrera del 5 % (LOREG art. 180), i per això els donem a part.",
    camps: [
      { clau: "cens", etiqueta: "Cens electoral", unitat: "persones", font: "participacio",
        descripcio: "Persones amb dret a vot." },
      { clau: "votants", etiqueta: "Votants", unitat: "persones", font: "participacio",
        descripcio: "Persones que hi van votar." },
      { clau: "participacio", etiqueta: "Participació", unitat: "%", font: "participacio", propi: true,
        descripcio: "Votants dividit pel cens. El càlcul és nostre; la font dona els dos comptatges." },
      { clau: "vots_blancs", etiqueta: "Vots en blanc", unitat: "vots", font: "participacio",
        descripcio: "Vots en blanc emesos." },
      { clau: "vots_nuls", etiqueta: "Vots nuls", unitat: "vots", font: "participacio",
        descripcio: "Vots nuls emesos." },
      { clau: "participacio_2023", etiqueta: "Participació del 2023", unitat: "%", font: "participacio", global: true, propi: true,
        descripcio: "La participació de la convocatòria del 2023, repetida al fitxer global perquè hi càpiga en una sola columna." },
    ],
  },
  {
    titol: "Els comptes",
    nota: "L'últim exercici liquidat que consta. Els indicadors són nostres, calculats sobre els capítols en brut: si demà canviem una fórmula, no cal tornar a baixar res. **No són una nota al govern**: diuen com estan els comptes.",
    camps: [
      { clau: "estalvi_net", etiqueta: "Estalvi net", unitat: "%", font: "liquidacio", global: true, propi: true,
        descripcio: "El que sobra dels ingressos corrents un cop pagat el dia a dia i l'amortització del deute. Negatiu obliga a aprovar un pla de sanejament (TRLRHL art. 193)." },
      { clau: "estalvi_brut", etiqueta: "Estalvi brut", unitat: "%", font: "liquidacio", global: true, propi: true,
        descripcio: "El que sobra dels ingressos corrents un cop pagat el funcionament ordinari, sense descomptar-hi el deute." },
      { clau: "deute_habitant", etiqueta: "Deute per habitant", unitat: "€/habitant", font: "deute", global: true, propi: true,
        descripcio: "Deute viu a 31 de desembre dividit pel padró. Quatre-cents municipis catalans no en tenen gens: la mediana és molt baixa i els percentils s'hi empaten." },
      { clau: "deute_ingressos", etiqueta: "Deute sobre ingressos corrents", unitat: "%", font: "deute", global: true, propi: true,
        descripcio: "Per sobre del 110 % la llei no permet endeutar-se més sense autorització (TRLRHL art. 53)." },
      { clau: "saldo_no_financer", etiqueta: "Saldo no financer", unitat: "%", font: "liquidacio", global: true, propi: true,
        descripcio: "Tots els ingressos menys totes les despeses, sense comptar-hi el deute, sobre els ingressos corrents." },
      { clau: "carrega_financera", etiqueta: "Càrrega financera", unitat: "%", font: "liquidacio", global: true, propi: true,
        descripcio: "Part dels ingressos corrents que se'n va en interessos i en tornar deute." },
      { clau: "execucio_inversions", etiqueta: "Execució d'inversions", unitat: "%", font: "liquidacio", global: true, propi: true,
        descripcio: "Inversió liquidada sobre la pressupostada. Diu quant del que es va prometre s'ha arribat a fer." },
      { clau: "pmp", etiqueta: "Període mitjà de pagament a proveïdors", unitat: "dies", font: "pmp", global: true,
        descripcio: "Dies que triga a pagar. Per sobre de 60 la llei el considera incompliment (LO 2/2012 i RD 635/2014)." },
      { clau: "deute_habitant_serie", etiqueta: "Deute per habitant", unitat: "€/habitant", font: "deute", propi: true,
        descripcio: "El mateix indicador any a any des del 2015, per veure si el deute puja o baixa dins del mandat." },
    ],
  },
  {
    titol: "D'on surten els diners",
    nota: "Recaptació liquidada per concepte, en euros per habitant. Una xifra per habitant només informa si es compara amb municipis de la mateixa mida.",
    camps: [
      { clau: "ingressos_ibi", etiqueta: "IBI", unitat: "€/habitant", font: "liquidacionsGencat", global: true,
        descripcio: "Impost sobre béns immobles recaptat, per habitant." },
      { clau: "ingressos_taxes", etiqueta: "Taxes", unitat: "€/habitant", font: "liquidacionsGencat",
        descripcio: "Taxes municipals recaptades, per habitant." },
      { clau: "ingressos_plusvalua", etiqueta: "Plusvàlua", unitat: "€/habitant", font: "liquidacionsGencat",
        descripcio: "Impost sobre l'increment de valor dels terrenys, per habitant." },
      { clau: "ingressos_vehicles", etiqueta: "Vehicles", unitat: "€/habitant", font: "liquidacionsGencat",
        descripcio: "Impost sobre vehicles de tracció mecànica recaptat, per habitant." },
      { clau: "ingressos_activitats", etiqueta: "Activitats econòmiques", unitat: "€/habitant", font: "liquidacionsGencat",
        descripcio: "IAE recaptat, per habitant." },
      { clau: "ingressos_preus_publics", etiqueta: "Preus públics", unitat: "€/habitant", font: "liquidacionsGencat",
        descripcio: "Preus públics recaptats, per habitant." },
      { clau: "ingressos_obres", etiqueta: "Obres", unitat: "€/habitant", font: "liquidacionsGencat",
        descripcio: "Impost sobre construccions, instal·lacions i obres, per habitant. Molts municipis no el declaren." },
    ],
  },
  {
    titol: "On van els diners",
    nota: "Despesa liquidada per àrea de la classificació per programes, igual per a tots els ajuntaments.",
    camps: [
      { clau: "despesa_total", etiqueta: "Despesa total", unitat: "€/habitant", font: "liquidacionsGencat", global: true,
        descripcio: "Tot el que s'ha liquidat, per habitant." },
      { clau: "despesa_serveis_basics", etiqueta: "Serveis públics bàsics", unitat: "€/habitant", font: "liquidacionsGencat", global: true,
        descripcio: "Seguretat, mobilitat, habitatge, urbanisme, aigua, residus i enllumenat." },
      { clau: "despesa_educacio_cultura_esport", etiqueta: "Educació, cultura i esport", unitat: "€/habitant", font: "liquidacionsGencat", global: true,
        descripcio: "Escoles bressol, equipaments culturals i esportius." },
      { clau: "despesa_administracio", etiqueta: "Administració general", unitat: "€/habitant", font: "liquidacionsGencat", global: true,
        descripcio: "Òrgans de govern i serveis generals de l'ajuntament." },
      { clau: "despesa_proteccio_social", etiqueta: "Protecció i promoció social", unitat: "€/habitant", font: "liquidacionsGencat", global: true,
        descripcio: "Serveis socials i promoció social." },
      { clau: "despesa_deute", etiqueta: "Deute públic", unitat: "€/habitant", font: "liquidacionsGencat",
        descripcio: "Interessos i amortització." },
      { clau: "despesa_actuacions_economiques", etiqueta: "Actuacions econòmiques", unitat: "€/habitant", font: "liquidacionsGencat",
        descripcio: "Comerç, turisme, ocupació i altres actuacions de caràcter econòmic." },
      { clau: "cost_govern_habitant", etiqueta: "Cost dels òrgans de govern", unitat: "€/habitant", font: "liquidacioEconomica", global: true, propi: true,
        descripcio: "Retribucions dels membres dels òrgans de govern (concepte 1000 de la liquidació) dividides pel padró, de l'últim exercici complet. És el que costa el govern en conjunt, no el que cobra cap regidor. Euros corrents, sense descomptar la inflació." },
    ],
  },
  {
    titol: "Què costa cada servei",
    nota: "Cost efectiu calculat amb el mateix criteri del Ministeri d'Hisenda per a tots els ajuntaments d'Espanya. És el que costa prestar el servei, no el que es cobra per ell. La forma de gestió ve en castellà a l'origen i la traduïm.",
    camps: [
      { clau: "servei_aigua", etiqueta: "Aigua potable", unitat: "€/habitant", font: "costEfectiu", descripcio: "Cost efectiu del subministrament d'aigua potable, per habitant." },
      { clau: "servei_escombraries", etiqueta: "Recollida d'escombraries", unitat: "€/habitant", font: "costEfectiu", descripcio: "Cost efectiu de la recollida de residus, per habitant." },
      { clau: "servei_neteja_viaria", etiqueta: "Neteja viària", unitat: "€/habitant", font: "costEfectiu", descripcio: "Cost efectiu de la neteja dels carrers, per habitant." },
      { clau: "servei_clavegueram", etiqueta: "Clavegueram", unitat: "€/habitant", font: "costEfectiu", descripcio: "Cost efectiu del clavegueram, per habitant." },
      { clau: "servei_enllumenat", etiqueta: "Enllumenat públic", unitat: "€/habitant", font: "costEfectiu", descripcio: "Cost efectiu de l'enllumenat públic, per habitant." },
      { clau: "servei_parcs", etiqueta: "Parcs i jardins", unitat: "€/habitant", font: "costEfectiu", descripcio: "Cost efectiu del manteniment de parcs i jardins, per habitant." },
      { clau: "servei_tractament_residus", etiqueta: "Tractament de residus", unitat: "€/habitant", font: "costEfectiu", descripcio: "Cost efectiu del tractament de residus, per habitant. És una partida diferent de la recollida." },
      { clau: "servei_atencio_social", etiqueta: "Atenció social", unitat: "€/habitant", font: "costEfectiu", descripcio: "Cost efectiu dels serveis socials, per habitant." },
      { clau: "servei_biblioteca", etiqueta: "Biblioteca", unitat: "€/habitant", font: "costEfectiu", descripcio: "Cost efectiu del servei de biblioteca, per habitant." },
      { clau: "servei_esports", etiqueta: "Instal·lacions esportives", unitat: "€/habitant", font: "costEfectiu", descripcio: "Cost efectiu de les instal·lacions esportives, per habitant." },
      { clau: "servei_cementiri", etiqueta: "Cementiri", unitat: "€/habitant", font: "costEfectiu", descripcio: "Cost efectiu del cementiri, per habitant." },
      { clau: "gestio_servei", etiqueta: "Gestió del servei", unitat: "", font: "costEfectiu", propi: true,
        descripcio: "Com es presta cada servei: gestió directa, contractat, mancomunat o no es presta. Va una fila per servei, amb el nom del servei entre parèntesis." },
    ],
  },
  {
    titol: "Què es paga aquí",
    nota: "Tipus vigents declarats per cada ajuntament al mateix formulari, per això són comparables. Un tipus no és el rebut: el rebut depèn del valor cadastral, i la data de l'última revisió cadastral hi pesa tant com el tipus.",
    camps: [
      { clau: "ibi_urba", etiqueta: "IBI urbà", unitat: "%", font: "impostos", global: true,
        descripcio: "Tipus de gravamen de l'IBI de béns urbans." },
      { clau: "ivtm_12_16cv", etiqueta: "Cotxe de 12-16 CV", unitat: "€", font: "impostos", global: true,
        descripcio: "Quota anual de l'impost de vehicles per a un turisme de 12 a 16 cavalls fiscals. És el tram més comú i el fem servir com a referència comparable." },
      { clau: "iae_maxim", etiqueta: "Activitats (IAE), coeficient màxim", unitat: "coeficient", font: "impostos",
        descripcio: "Coeficient de situació màxim de l'IAE." },
      { clau: "revisio_cadastral", etiqueta: "Última revisió cadastral", unitat: "any", font: "impostos", global: true,
        descripcio: "Any de l'última ponència de valors. Com més antiga, més desajustada està la base sobre la qual s'aplica el tipus de l'IBI." },
      { clau: "preu_aigua_subministrament", etiqueta: "Preu de l'aigua (subministrament)", unitat: "€/m³", font: "aca", global: true,
        descripcio: "El tram de subministrament del preu de l'aigua per a un consum domèstic de 12 m³ al mes, que és l'únic tram comparable entre municipis. No hi entren el cànon ni el clavegueram: el rebut sencer és més alt." },
      { clau: "rebut_ibi_mitja", etiqueta: "Rebut mitjà d'IBI urbà", unitat: "€", font: "idescatIbi", global: true,
        descripcio: "Quota íntegra dividida pels rebuts. No és el tipus impositiu. Només es publica quan la variació és atribuïble al ple i no a una revisió cadastral; als altres municipis la fila no hi és." },
    ],
  },
  {
    titol: "Com es governa",
    nota: "El que es veu del govern més enllà dels comptes: què fa amb els residus, què costa viure-hi, si una part del que paga no ho decideix el ple, quant fa que mana la mateixa força i quants vots no van arribar a cap regidoria. Els residus i el lloguer són context —l'ajuntament hi pesa, no els decideix sol— i les files de despesa per programa van una per programa.",
    camps: [
      { clau: "residus_selectiva_pct", etiqueta: "Recollida selectiva", unitat: "%", font: "arc", global: true,
        descripcio: "Part dels residus municipals que es recullen separats, l'últim any amb dada de l'Agència de Residus." },
      { clau: "residus_kg_habitant", etiqueta: "Residus generats", unitat: "kg/habitant", font: "arc", global: true,
        descripcio: "Quilos de residus municipals per habitant i any." },
      { clau: "lloguer_mitja", etiqueta: "Lloguer mitjà", unitat: "€/mes", font: "fiances", global: true,
        descripcio: "Preu mitjà dels contractes de lloguer amb fiança dipositada a l'Incasòl, l'últim any amb dada. Als municipis amb pocs contractes la font no en publica." },
      { clau: "amb_membre", etiqueta: "Membre de l'Àrea Metropolitana de Barcelona", unitat: "sí/no", font: "ambEns", global: true,
        descripcio: "Cert als 36 municipis que la Llei 31/2010 posa dins de l'AMB. Allà el transport, l'aigua i el tractament de residus no els decideix el ple, sinó un consell que no vota ningú en una papereta." },
      { clau: "alcaldia_forca_anys", etiqueta: "Anys de la mateixa força a l'alcaldia", unitat: "anys", font: "alcaldies", global: true, propi: true,
        descripcio: "Anys sencers que la força política de l'alcaldia actual porta al càrrec sense interrupció. Es compta per força i no per sigles, perquè les coalicions locals es rebategen. Quan la font no dona data de presa de possessió, s'aproxima per la legislatura." },
      { clau: "alcaldia_forca_des_de", etiqueta: "La força de l'alcaldia hi és des de", unitat: "any", font: "alcaldies", propi: true,
        descripcio: "Any de la legislatura en què va començar la ratxa de la força que ocupa l'alcaldia." },
      { clau: "alcaldia_persona_anys", etiqueta: "Anys de la mateixa persona a l'alcaldia", unitat: "anys", font: "alcaldies", global: true, propi: true,
        descripcio: "Anys sencers que la persona que ocupa l'alcaldia hi és sense interrupció." },
      { clau: "alcaldia_forces", etiqueta: "Forces diferents a l'alcaldia des del 1979", unitat: "forces", font: "alcaldies", propi: true,
        descripcio: "Quantes forces polítiques diferents han ocupat l'alcaldia a l'historial." },
      { clau: "alcaldia_alternances", etiqueta: "Canvis de força a l'alcaldia des del 1979", unitat: "vegades", font: "alcaldies", global: true, propi: true,
        descripcio: "Cops que l'alcaldia ha passat d'una força a una altra. No és el mateix que `alternances`, que compta canvis de llista més votada: es pot guanyar i no governar." },
      { clau: "volatilitat_ultima", etiqueta: "Volatilitat electoral", unitat: "índex", font: "historic", global: true, propi: true,
        descripcio: "Índex de Pedersen entre les dues últimes eleccions amb càlcul fiable, sobre quotes d'escons: 0 és un ple calcat i 100, cap resta del repartiment anterior. L'any és el de la segona elecció del parell." },
      { clau: "volatilitat_mitjana", etiqueta: "Volatilitat electoral mitjana", unitat: "índex", font: "historic", global: true, propi: true,
        descripcio: "Mitjana de l'índex de Pedersen als trams fiables des del 1979. Els trams amb massa escons de llistes locals no hi compten." },
      { clau: "vot_perdut_pct", etiqueta: "Vot sense representació", unitat: "%", font: "resultats", propi: true,
        descripcio: "Part dels vots emesos que no va arribar a cap regidoria: llistes sense escó, més nuls, més blancs. Una fila per convocatòria. Només quan els vots per candidatura de la font quadren amb els que ella mateixa declara; als 178 municipis de llistes obertes no quadren mai." },
      { clau: "vot_sense_esco_pct", etiqueta: "Vot a llistes sense escó", unitat: "%", font: "resultats", propi: true,
        descripcio: "Part dels vots emesos que va anar a candidatures que no van treure cap regidor. Una fila per convocatòria." },
      { clau: "vot_perdut_2023_pct", etiqueta: "Vot sense representació el 2023", unitat: "%", font: "resultats", global: true, propi: true,
        descripcio: "El mateix indicador de la convocatòria del 2023, repetit al fitxer global perquè hi càpiga en una sola columna." },
      { clau: "vot_perdut_regidories", etiqueta: "Regidories que valdria el vot sense representació", unitat: "regidories", font: "resultats", global: true, propi: true,
        descripcio: "Quants escons del ple representaria el vot sense representació del 2023 si hagués tingut traducció. És la manera més entenedora de dir què val." },
      { clau: "despesa_programa", etiqueta: "Despesa del programa", unitat: "€/habitant", font: "liquidacioProgrames",
        descripcio: "Despesa liquidada d'un grup de programa de la classificació funcional, per habitant, l'últim exercici liquidat. Una fila per programa, amb el codi i el nom entre parèntesis. Un exercici sense liquidació no és un zero: la fila no hi és." },
      { clau: "despesa_programa_mandat", etiqueta: "Variació al mandat del programa", unitat: "%", font: "liquidacioProgrames", propi: true,
        descripcio: "Com ha canviat la despesa per habitant del programa des del primer exercici del mandat fins a l'últim liquidat. Una fila per programa. Euros corrents." },
    ],
  },
  {
    titol: "Transparència",
    nota: "Emplenament del portal de transparència, tal com el mesura l'AOC. Mesura si els apartats estan plens, no si el que hi ha és bo.",
    camps: [
      { clau: "transparencia_pct", etiqueta: "Emplenament del portal de transparència", unitat: "%", font: "transparencia", global: true,
        descripcio: "Percentatge dels apartats obligatoris que el portal té publicats." },
      { clau: "transparencia_apartats", etiqueta: "Apartats que li toquen", unitat: "apartats", font: "transparencia",
        descripcio: "Apartats exigibles a aquest ens." },
      { clau: "transparencia_publicats", etiqueta: "Apartats publicats", unitat: "apartats", font: "transparencia",
        descripcio: "Apartats que consten publicats." },
    ],
  },
  {
    titol: "Dones i homes",
    nota: "Sexe tal com el declara el conjunt de persones candidates. No en fem cap altra inferència.",
    camps: [
      { clau: "dones_ple_pct", etiqueta: "Dones al ple", unitat: "%", font: "candidats", global: true, propi: true,
        descripcio: "Percentatge de dones entre les persones elegides el 2023." },
      { clau: "dones_ple", etiqueta: "Dones elegides", unitat: "persones", font: "candidats",
        descripcio: "Dones entre les persones elegides el 2023." },
      { clau: "elegides_total", etiqueta: "Persones elegides", unitat: "persones", font: "candidats",
        descripcio: "Total de persones elegides el 2023." },
      { clau: "dones_llistes_pct", etiqueta: "Dones a les llistes", unitat: "%", font: "candidats", global: true, propi: true,
        descripcio: "Percentatge de dones entre totes les persones candidates del 2023." },
      { clau: "dones_llistes", etiqueta: "Dones candidates", unitat: "persones", font: "candidats",
        descripcio: "Dones entre les persones candidates del 2023." },
      { clau: "candidates_total", etiqueta: "Persones candidates", unitat: "persones", font: "candidats",
        descripcio: "Total de persones candidates del 2023, de totes les llistes." },
      { clau: "caps_llista_dones", etiqueta: "Caps de llista dones", unitat: "persones", font: "candidats", global: true,
        descripcio: "Dones que encapçalaven una candidatura el 2023." },
      { clau: "caps_llista", etiqueta: "Caps de llista", unitat: "persones", font: "candidats",
        descripcio: "Candidatures presentades, i per tant caps de llista, el 2023." },
    ],
  },
  {
    titol: "Què en sabem",
    nota: "Fins on arriba la nostra cobertura d'aquest municipi. Publicar el forat val tant com publicar la dada.",
    camps: [
      { clau: "actes_indexades", etiqueta: "Actes de ple indexades", unitat: "actes", font: "actes", global: true,
        descripcio: "Actes de sessions al feed obert de l'AOC des del juny del 2023. Indexades per a tots; llegides i buidades punt per punt només als municipis de més de 20.000 habitants, que és on J12 arriba." },
      { clau: "acta_ultima", etiqueta: "Última acta indexada", unitat: "data", font: "actes",
        descripcio: "Data de l'última acta que consta al feed." },
      { clau: "cobertura_pct", etiqueta: "Cobertura d'indicadors", unitat: "%", font: "ensLocals", global: true, propi: true,
        descripcio: "Quants dels indicadors del fitxer global tenim per a aquest municipi. Sota el 60 % vol dir que la fitxa va coixa i cal dir-ho." },
    ],
  },
];

const CAMPS: readonly Camp[] = BLOCS.flatMap((bloc) => bloc.camps);
const CAMP_PER_CLAU = new Map(CAMPS.map((camp) => [camp.clau, camp]));

/** Columnes d'identificació del fitxer global. No són indicadors: són el municipi. */
const IDENTITAT = [
  { clau: "municipi", descripcio: "Nom oficial del municipi, sense l'article invertit («Els Hostalets», no «Hostalets, Els»)." },
  { clau: "slug", descripcio: "Identificador que fem servir a les adreces: `quivoto.cat/observatori/m/<slug>/`." },
  { clau: "codi_ine", descripcio: "Codi INE de 5 xifres. És el codi electoral i el que fa servir tothom per creuar dades." },
  { clau: "codi_ens", descripcio: "Codi d'ens de 10 caràcters de la Generalitat i l'AOC. Les primeres 5 xifres són l'INE." },
  { clau: "comarca", descripcio: "Comarca." },
  { clau: "provincia", descripcio: "Província." },
] as const;

/**
 * Percentils dins del grup de comparació. Només d'un grapat de xifres: són les
 * que un mitjà voldrà ordenar, i ordenar-les contra tot Catalunya és el que fa
 * que un poble de 300 habitants surti a la mateixa taula que Barcelona.
 */
const PERCENTILS: readonly { clau: string; sobre: string; descripcio: string }[] = [
  { clau: "percentil_deute_habitant", sobre: "deute_habitant", descripcio: "Percentil del deute per habitant dins del grup de comparació. 100 és el més endeutat del grup." },
  { clau: "percentil_despesa_total", sobre: "despesa_total", descripcio: "Percentil de la despesa total per habitant dins del grup." },
  { clau: "percentil_transparencia", sobre: "transparencia_pct", descripcio: "Percentil d'emplenament del portal de transparència dins del grup." },
  { clau: "percentil_dones_ple", sobre: "dones_ple_pct", descripcio: "Percentil de dones al ple dins del grup." },
  { clau: "percentil_participacio_2023", sobre: "participacio_2023", descripcio: "Percentil de participació del 2023 dins del grup." },
];

const CAMPS_GLOBALS: readonly Camp[] = CAMPS.filter((camp) => camp.global);

/** Columnes de `catalunya.csv`, perquè qui cridi `renderDadesIndex` pugui dir-ne el nombre. */
export const CAMPS_CATALUNYA = IDENTITAT.length + CAMPS_GLOBALS.length + PERCENTILS.length;

// -------------------------------------------------------------------- files

type Valor = number | string | boolean;

type Fila = {
  clau: string;
  indicador: string;
  valor: Valor;
  unitat: string;
  any: number | null;
  font: string;
};

/**
 * El que ens cal de la fitxa. Es tria camp a camp i no amb `RadiografiaData`
 * sencer perquè la fitxa hi pot afegir coses que no són indicadors del municipi
 * i que no han d'anar a la descàrrega. Si hi apareix un bloc nou de dades, la
 * llista s'ha d'ampliar aquí a mà: és la contrapartida d'aquesta tria.
 */
type Fitxa = Pick<
  RadiografiaData,
  | "municipality" | "results" | "government" | "parity" | "mayors" | "finances"
  | "history" | "taxes" | "transparency" | "singleList" | "revenue" | "spending"
  | "services" | "councilChanges" | "participation" | "issues"
  | "residus" | "habitatge" | "preuAigua" | "rebutIbi" | "costGovern" | "continuitat" | "votPerdut"
> & {
  grup: { label: string; size: number } | null;
  /**
   * `null` quan no sabem res de l'AMB (la feina no ha desat cap municipi);
   * `member: false` quan sí que ho sabem i aquest no hi és. La diferència
   * importa: un «no» en un fitxer de dades és una afirmació.
   */
  amb: { member: boolean } | null;
  poblacio: PoblacioResum | null;
  riquesa: RiquesaResum | null;
  despesaProgrames: ProgramesResum | null;
};

/*
 * Tres `kind` es carreguen retallats i no sencers. Els documents de població i
 * de renda porten sèries de catorze i sis indicadors per municipi —3,4 MB per
 * `kind`— i el de programes, una sèrie per programa; d'aquí només en surt el
 * que publiquem, projectat amb `jsonb` a la mateixa consulta, com fa
 * `comarques.ts`. Els tipus són els d'aquesta projecció, no els de la fitxa.
 */

/** L'indicador de nacionalitat estrangera de J18, amb l'enllaç que l'Idescat obliga a mostrar. */
type PoblacioResum = {
  estrangera: { valor: number | null; darrerAny: number | null; enllac: { href: string } | null } | null;
  /** El primer enllaç del municipi que l'API de l'Idescat ha donat, per si l'indicador no en porta. */
  enllacIdescat: string | null;
};

/** La renda neta per persona de J23 i la taula provincial de l'INE d'on surt, amb la seva data. */
type RiquesaResum = {
  valor: number | null;
  any: number | null;
  taules: { provincia: string; urlTaula: string; actualitzada: string | null }[];
};

/** Els programes de J15, cadascun amb només l'últim exercici i la variació al mandat. */
type ProgramesResum = {
  programes: {
    codi: string;
    nom: string;
    darrer: { any: number; liquidacio: boolean; perHabitant: number | null } | null;
    mandat: { fins: number; percentual: number | null } | null;
  }[];
};

/** Etiqueta d'una sèrie: l'indicador amb el detall entre parèntesis. */
const amb = (etiqueta: string, detall: string): string => `${etiqueta} (${detall})`;

function afegeix(
  files: Fila[],
  clau: string,
  valor: Valor | null | undefined,
  any: number | null,
  etiqueta?: string,
): void {
  if (valor === null || valor === undefined) return;
  if (typeof valor === "number" && !Number.isFinite(valor)) return;
  if (typeof valor === "string" && valor.trim() === "") return;
  const camp = CAMP_PER_CLAU.get(clau);
  if (!camp) return;
  files.push({
    clau,
    indicador: etiqueta ?? camp.etiqueta,
    valor: typeof valor === "number" ? Number(valor.toFixed(4)) : valor,
    unitat: camp.unitat,
    any,
    font: FONTS[camp.font].id,
  });
}

/** Any electoral d'un identificador de convocatòria: `M20231` → 2023. */
const anyElectoral = (electionId: string): number => Number(electionId.slice(1, 5));

/**
 * Tots els indicadors d'un municipi, en l'ordre del catàleg. És la font única
 * del CSV llarg, del JSON del municipi i de la fila del fitxer global: els tres
 * fitxers no poden dir coses diferents perquè surten d'aquesta llista.
 */
function indicadorsDe(fitxa: Fitxa): Fila[] {
  const files: Fila[] = [];
  const m = fitxa.municipality;
  const g = fitxa.government;
  const mandat = 2023;

  // --- el municipi
  afegeix(files, "poblacio", m.population, m.populationYear);
  afegeix(files, "regidories", g?.totalSeats ?? m.councilSeats, mandat);
  // El camp arriba amb majúscula o sense segons per quina banda hagi entrat
  // («llistes tancades» és el valor per defecte de l'esquema i «Llistes obertes»
  // el que escriu J1). En un fitxer de dades això és una categoria trencada:
  // qui hi agrupi n'obtindria dos grups per a la mateixa cosa.
  afegeix(files, "sistema_electoral", m.electoralSystem.toLowerCase(), mandat);
  afegeix(files, "grup_comparacio", fitxa.grup?.label, null);
  afegeix(files, "grup_mida", fitxa.grup?.size, null);

  // --- qui governa
  afegeix(files, "alcaldia", m.mayorName, mandat);
  afegeix(files, "alcaldia_sigles", g?.mayorSigles, mandat);
  const alcaldiaActual = [...(fitxa.mayors?.history ?? [])]
    .filter((h) => h.term === "2023-2027" && h.tookOfficeOn)
    .sort((a, b) => (a.tookOfficeOn ?? "").localeCompare(b.tookOfficeOn ?? ""))
    .pop();
  afegeix(files, "alcaldia_presa_possessio", alcaldiaActual?.tookOfficeOn, mandat);
  afegeix(files, "alcaldia_canvi_mandat", Boolean(fitxa.mayors?.currentTermChange), mandat);
  afegeix(files, "alcaldies_persones", fitxa.mayors?.distinctPeople, null);
  afegeix(files, "llista_mes_votada", g?.winnerSigles, mandat);
  afegeix(files, "regidories_mes_votada", g?.winnerSeats, mandat);
  afegeix(files, "regidories_alcaldia", g?.mayorSeats, mandat);
  // `winnerGoverns` a null vol dir que no hem sabut lligar l'alcaldia amb cap
  // llista. Publicar-hi un «no» seria afirmar que hi va haver pacte sense saber-ho.
  afegeix(files, "governa_mes_votat", g?.winnerGoverns ?? null, mandat);
  afegeix(files, "majoria_absoluta", g?.winnerHasMajority, mandat);
  afegeix(files, "regidories_per_governar", g?.majority, mandat);
  afegeix(files, "partits_efectius", g?.effectiveParties, mandat);
  afegeix(files, "sense_oposicio", fitxa.singleList, mandat);
  afegeix(files, "substitucions_ple", fitxa.councilChanges?.substitutions, mandat);

  // --- les eleccions, una fila per any
  for (const punt of fitxa.history?.series ?? []) {
    afegeix(files, "guanyador", punt.winner?.sigles, punt.year);
    afegeix(files, "guanyador_regidories", punt.winner?.seats, punt.year);
    afegeix(files, "regidories_ple", punt.seats, punt.year);
    afegeix(files, "candidatures", punt.candidatures, punt.year);
    afegeix(files, "vots_valids", punt.totalVotes, punt.year);
  }
  afegeix(files, "alternances", fitxa.history?.alternances, null);
  afegeix(files, "eleccions_comptades", fitxa.history?.elections, null);

  // --- participació, una fila per convocatòria
  for (const p of fitxa.participation) {
    const any = anyElectoral(p.electionId);
    afegeix(files, "cens", p.censusSize, any);
    afegeix(files, "votants", p.voters, any);
    const participacio = p.censusSize && p.voters ? (100 * p.voters) / p.censusSize : null;
    afegeix(files, "participacio", participacio, any);
    afegeix(files, "vots_blancs", p.blankVotes, any);
    afegeix(files, "vots_nuls", p.nullVotes, any);
    if (any === 2023) afegeix(files, "participacio_2023", participacio, any);
  }

  // --- els comptes
  const comptes = fitxa.finances;
  if (comptes) {
    const per = new Map(comptes.indicators.map((i) => [i.key, i]));
    const claus: readonly [string, string][] = [
      ["estalvi_net", "estalvi-net"], ["estalvi_brut", "estalvi-brut"],
      ["deute_habitant", "deute-habitant"], ["deute_ingressos", "deute-ingressos"],
      ["saldo_no_financer", "saldo-no-financer"], ["carrega_financera", "carrega-financera"],
      ["execucio_inversions", "execucio-inversions"], ["pmp", "pmp"],
    ];
    for (const [clau, key] of claus) afegeix(files, clau, per.get(key)?.value ?? null, comptes.year);
    for (const punt of comptes.debtSeries) {
      if (punt.year >= 2015) afegeix(files, "deute_habitant_serie", punt.perHead, punt.year);
    }
  }

  // --- d'on surten els diners
  const ingressos: Record<string, string> = {
    IBI: "ingressos_ibi", Taxes: "ingressos_taxes", Plusvàlua: "ingressos_plusvalua",
    Vehicles: "ingressos_vehicles", "Activitats econòmiques": "ingressos_activitats",
    "Preus públics": "ingressos_preus_publics", Obres: "ingressos_obres",
  };
  for (const figura of fitxa.revenue?.figures ?? []) {
    afegeix(files, ingressos[figura.label] ?? "", figura.perHead, fitxa.revenue!.year);
  }

  // --- on van els diners
  const despeses: Record<string, string> = {
    "Serveis públics bàsics": "despesa_serveis_basics",
    "Educació, cultura i esport": "despesa_educacio_cultura_esport",
    "Administració general": "despesa_administracio",
    "Protecció i promoció social": "despesa_proteccio_social",
    "Deute públic": "despesa_deute",
    "Actuacions econòmiques": "despesa_actuacions_economiques",
  };
  if (fitxa.spending) {
    afegeix(files, "despesa_total", fitxa.spending.totalPerHead, fitxa.spending.year);
    for (const area of fitxa.spending.areas) {
      afegeix(files, despeses[area.label] ?? "", area.perHead, fitxa.spending.year);
    }
  }

  // --- què costa cada servei
  const serveis: Record<string, string> = {
    "Aigua potable": "servei_aigua", "Recollida d'escombraries": "servei_escombraries",
    "Tractament de residus": "servei_tractament_residus",
    "Neteja viària": "servei_neteja_viaria", Clavegueram: "servei_clavegueram",
    "Enllumenat públic": "servei_enllumenat", "Parcs i jardins": "servei_parcs",
    "Atenció social": "servei_atencio_social", Biblioteca: "servei_biblioteca",
    "Instal·lacions esportives": "servei_esports", Cementiri: "servei_cementiri",
  };
  for (const servei of fitxa.services?.services ?? []) {
    afegeix(files, serveis[servei.label] ?? "", servei.perHead, fitxa.services!.year);
    afegeix(files, "gestio_servei", gestio(servei.management), fitxa.services!.year,
      amb("Gestió del servei", servei.label));
  }

  // --- què es paga aquí
  const impostos = fitxa.taxes;
  if (impostos) {
    afegeix(files, "ibi_urba", impostos.taxes.ibi?.value, impostos.year);
    afegeix(files, "ivtm_12_16cv", impostos.taxes.ivtm?.value, impostos.year);
    afegeix(files, "iae_maxim", impostos.taxes.iae?.value, impostos.year);
    // La revisió cadastral ve com a any dins d'un camp de valor: aquí és la dada,
    // no la data de la dada, i per això no li posem `any`.
    afegeix(files, "revisio_cadastral", impostos.taxes.cadastre?.value, null);
  }

  // --- transparència
  afegeix(files, "transparencia_pct", fitxa.transparency?.pct, null);
  afegeix(files, "transparencia_apartats", fitxa.transparency?.items, null);
  afegeix(files, "transparencia_publicats", fitxa.transparency?.published, null);

  // --- dones i homes
  const paritat = fitxa.parity;
  if (paritat) {
    // Només quan la llista d'electes quadra amb les regidories del ple: a 213
    // municipis la font en dona menys, i el percentatge no és el del ple.
    afegeix(
      files,
      "dones_ple_pct",
      (paritat as { complet?: boolean }).complet === false ? null : paritat.womenElectedPct,
      mandat,
    );
    afegeix(files, "dones_ple", paritat.womenElected, mandat);
    afegeix(files, "elegides_total", paritat.elected, mandat);
    afegeix(files, "dones_llistes_pct", paritat.womenCandidatesPct, mandat);
    afegeix(files, "dones_llistes", paritat.womenCandidates, mandat);
    afegeix(files, "candidates_total", paritat.candidates, mandat);
    afegeix(files, "caps_llista_dones", paritat.womenHeads, mandat);
    afegeix(files, "caps_llista", paritat.heads, mandat);
  }

  // --- el municipi, segona part: el context que l'ajuntament no decideix
  afegeix(files, "poblacio_estrangera_pct", fitxa.poblacio?.estrangera?.valor, fitxa.poblacio?.estrangera?.darrerAny ?? null);
  if (fitxa.riquesa?.any != null) {
    afegeix(files, "renda_neta_persona", fitxa.riquesa.valor, fitxa.riquesa.any);
    if (fitxa.riquesa.valor != null) afegeix(files, "renda_any", fitxa.riquesa.any, null);
  }

  // --- què es paga aquí, segona part
  afegeix(files, "preu_aigua_subministrament", fitxa.preuAigua?.preu.subministrament, fitxa.preuAigua?.darrerAny ?? null);
  // El rebut mitjà només quan J19 el dona per publicable: si ha pujat perquè
  // el cadastre ha revalorat, no és una decisió del ple i publicar-lo sense
  // el context de la fitxa seria atribuir-l'hi.
  if (fitxa.rebutIbi?.publicable) afegeix(files, "rebut_ibi_mitja", fitxa.rebutIbi.rebutMitja, fitxa.rebutIbi.darrerAny);

  // --- on van els diners, segona part
  const govern = fitxa.costGovern?.darrer;
  // Una xifra sospitosa (per sobre del llindar de J14) la fitxa l'ensenya amb
  // l'advertiment al costat; un fitxer no pot, i s'estima més no dur-la.
  if (govern && !govern.parcial && !govern.sospitos) {
    afegeix(files, "cost_govern_habitant", govern.organs?.perHabitant, govern.any);
  }

  // --- com es governa
  afegeix(files, "residus_selectiva_pct", fitxa.residus?.taxaSelectiva, fitxa.residus?.darrerAny ?? null);
  afegeix(files, "residus_kg_habitant", fitxa.residus?.kgHabAny, fitxa.residus?.darrerAny ?? null);
  afegeix(files, "lloguer_mitja", fitxa.habitatge?.preu, fitxa.habitatge?.darrerAny ?? null);
  afegeix(files, "amb_membre", fitxa.amb?.member, null);

  const continuitat = fitxa.continuitat;
  if (continuitat) {
    afegeix(files, "alcaldia_forca_anys", continuitat.partit?.anys, null);
    afegeix(files, "alcaldia_forca_des_de", continuitat.partit?.desDeAny, null);
    afegeix(files, "alcaldia_persona_anys", continuitat.persona?.anys, null);
    afegeix(files, "alcaldia_forces", continuitat.forcesDiferents, null);
    afegeix(files, "alcaldia_alternances", continuitat.alternances, null);
    const ultima = continuitat.volatilitat.ultima;
    afegeix(files, "volatilitat_ultima", ultima?.index, ultima?.a ?? null);
    afegeix(files, "volatilitat_mitjana", continuitat.volatilitat.mitjana, null);
  }

  const votPerdut = fitxa.votPerdut;
  if (votPerdut) {
    for (const [electionId, eleccio] of Object.entries(votPerdut.eleccions)) {
      const any = anyElectoral(electionId);
      // `total` és nul quan la font no quadra i `senseEsco` també: publicar-hi
      // només els nuls i blancs faria semblar que el vot perdut és petit.
      afegeix(files, "vot_perdut_pct", eleccio.total?.pct, any);
      afegeix(files, "vot_sense_esco_pct", eleccio.senseEsco?.pct, any);
    }
    const darrera = votPerdut.darrera ? votPerdut.eleccions[votPerdut.darrera] : null;
    if (darrera && votPerdut.darrera && anyElectoral(votPerdut.darrera) === mandat) {
      afegeix(files, "vot_perdut_2023_pct", darrera.total?.pct, mandat);
      afegeix(files, "vot_perdut_regidories", votPerdut.regidorsEquivalents, mandat);
    }
  }

  for (const programa of fitxa.despesaProgrames?.programes ?? []) {
    const nom = `${programa.codi} ${programa.nom}`;
    // Un exercici sense liquidació no és un zero: el punt no es publica.
    if (programa.darrer?.liquidacio) {
      afegeix(files, "despesa_programa", programa.darrer.perHabitant, programa.darrer.any, amb("Despesa del programa", nom));
    }
    if (programa.mandat) {
      afegeix(files, "despesa_programa_mandat", programa.mandat.percentual, programa.mandat.fins,
        amb("Variació al mandat del programa", nom));
    }
  }

  // --- què en sabem
  afegeix(files, "actes_indexades", m.minutesCount, null);
  afegeix(files, "acta_ultima", m.minutesLastDate, null);

  // --- vots i regidories de cada candidatura, a les tres últimes convocatòries.
  // És el detall que sosté l'hemicicle de la fitxa, i el format llarg l'aguanta
  // sense haver d'inventar una columna per sigla.
  for (const [electionId, eleccio] of Object.entries(fitxa.results)) {
    const any = anyElectoral(electionId);
    for (const candidatura of eleccio.candidatures) {
      files.push({
        clau: "vots_candidatura", indicador: amb("Vots", candidatura.sigles),
        valor: candidatura.votes, unitat: "vots", any, font: FONTS.resultats.id,
      });
      files.push({
        clau: "regidories_candidatura", indicador: amb("Regidories", candidatura.sigles),
        valor: candidatura.seats, unitat: "regidories", any, font: FONTS.resultats.id,
      });
    }
  }

  return files;
}

/** Traducció de la forma de gestió, que la font del Ministeri dona en castellà. */
function gestio(raw: string): string {
  const key = raw.toLowerCase();
  if (key.includes("no se presta")) return "no es presta";
  if (key.includes("directa")) return "gestió directa";
  if (key.includes("indirecta") || key.includes("contrat")) return "contractat";
  if (key.includes("consorcio") || key.includes("mancomun") || key.includes("comarca")) return "mancomunat";
  return raw;
}

// ---------------------------------------------------------------------- csv

/**
 * Decisió sobre el CSV, i és la que més s'ha de justificar.
 *
 * Qui obrirà aquests fitxers és un periodista local amb un Excel en català, i
 * en català el separador decimal és la coma. Si escrivíssim `1,5` amb comes
 * també entre columnes, el fitxer es trencaria a la primera xifra amb decimals.
 * Per això el separador de columnes és el **punt i coma**, que és el que espera
 * l'Excel configurat en català, i el decimal és la **coma**. Amb el BOM d'UTF-8
 * al davant, s'obre amb doble clic i amb els accents bé.
 *
 * Qui vulgui punt decimal i coma de separador —pandas, R, `csv` de Python— té
 * el JSON al costat, amb els números en cru i sense cap format. És l'única
 * manera de servir els dos públics sense enganyar-ne cap.
 */
const BOM = "﻿";
const SEP = ";";
const FI = "\r\n";

function cella(valor: Valor | null | undefined): string {
  if (valor === null || valor === undefined) return "";
  let text: string;
  if (typeof valor === "boolean") text = valor ? "sí" : "no";
  else if (typeof valor === "number") text = String(Number(valor.toFixed(4))).replace(".", ",");
  else text = valor;
  return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csv(capcalera: readonly string[], files: readonly (readonly (Valor | null | undefined)[])[]): string {
  const linies = [capcalera.join(SEP), ...files.map((fila) => fila.map(cella).join(SEP))];
  return BOM + linies.join(FI) + FI;
}

/**
 * JSON amb una fila per línia. Amb sagnat de dos espais, els fitxers dels 947
 * ocupen el triple i cada regeneració fa un diff il·legible al repositori; en
 * una sola línia no es poden llegir. Una fila per línia és el punt mig: es pot
 * mirar amb `grep`, es pot versionar i pesa el que ha de pesar.
 */
function jsonPerLinies(capsalera: Record<string, unknown>, clauLlista: string, files: readonly unknown[]): string {
  const dalt = Object.entries(capsalera)
    .map(([clau, valor]) => `  ${JSON.stringify(clau)}: ${JSON.stringify(valor)}`)
    .join(",\n");
  const cos = files.map((fila) => `    ${JSON.stringify(fila)}`).join(",\n");
  return `{\n${dalt},\n  ${JSON.stringify(clauLlista)}: [\n${cos}\n  ]\n}\n`;
}

// ------------------------------------------------------------------ esquema

const CAPCALERA_MUNICIPI = ["municipi", "codi_ine", "indicador", "valor", "unitat", "any", "font"] as const;

function taulaFonts(): string {
  const files = Object.values(FONTS).map(
    (font) => `| \`${font.id}\` | ${font.titol} | ${font.portal} | ${font.llicencia} | [conjunt](${font.url}) |`,
  );
  return `| Identificador | Conjunt | Portal | Llicència | Enllaç |\n|---|---|---|---|---|\n${files.join("\n")}`;
}

function taulaCamps(camps: readonly Camp[]): string {
  const files = camps.map((camp) => {
    const font = FONTS[camp.font];
    const origen = camp.propi ? `càlcul de quivoto sobre \`${font.id}\`` : `\`${font.id}\``;
    const on = camp.global ? "municipi + Catalunya" : "municipi";
    return `| \`${camp.clau}\` | ${camp.etiqueta} | ${camp.unitat || "—"} | ${origen} | ${on} | ${camp.descripcio} |`;
  });
  return `| Camp | Indicador | Unitat | Font | Fitxers | Què vol dir |\n|---|---|---|---|---|---|\n${files.join("\n")}`;
}

function esquema(
  generatedAt: string,
  municipis: number,
  files: number,
  cobertura: ReadonlyMap<string, number>,
): string {
  // La cobertura de cada bloc es compta sobre els fitxers que acabem d'escriure,
  // no es teclegeja aquí: una xifra escrita a mà a la documentació és una xifra
  // que demà serà mentida.
  const blocs = BLOCS.map((bloc) => {
    const amb = cobertura.get(bloc.titol) ?? 0;
    const quants = `**${amb} dels ${municipis} municipis** tenen almenys un indicador d'aquest bloc.`;
    return `### ${bloc.titol}\n\n${bloc.nota}\n\n${quants}\n\n${taulaCamps(bloc.camps)}`;
  }).join("\n\n");
  const identitat = IDENTITAT.map((c) => `| \`${c.clau}\` | ${c.descripcio} |`).join("\n");
  const percentils = PERCENTILS.map(
    (p) => `| \`${p.clau}\` | ${p.descripcio} Es calcula sobre \`${p.sobre}\` amb la definició de rang mitjà. |`,
  ).join("\n");

  return `# Esquema de les dades de l'Observatori de quivoto

Generat el ${generatedAt}. ${municipis} municipis, ${files} fitxers.

Aquest document és el que fa que les dades siguin **fiables i no només
descarregables**: cada camp diu què vol dir, en quines unitats va, de quin any
és i de quin conjunt obert surt, amb l'identificador per anar-lo a comprovar.

**Això no és una API.** Són fitxers estàtics que es regeneren quan regenerem
l'Observatori. No prometem que les claus no canviïn mai; prometem que, si
canvien, aquest document ho dirà.

## Què hi ha

| Fitxer | Què és |
|---|---|
| \`catalunya.csv\` · \`.json\` | Tots els municipis amb els indicadors principals. **Una fila per municipi.** És el fitxer que fareu servir. |
| \`m/<slug>.csv\` · \`.json\` | Tot el que mostra la fitxa d'un municipi. **Una fila per indicador.** |
| \`ESQUEMA.md\` | Això. |

El \`<slug>\` és el mateix de l'adreça de la fitxa: \`quivoto.cat/observatori/m/barcelona/\`
→ \`m/barcelona.csv\`.

## Per què el fitxer per municipi és llarg i el global és ample

Cada municipi té dades diferents: no tots tenen liquidació de la Generalitat, ni
cost efectiu dels serveis, ni tipus impositius declarats. Sota cada bloc
d'indicadors hi ha quants municipis en tenen. Un fitxer ample per municipi seria
una taula plena de columnes buides i diferents a cada fitxer; en format llarg
—una fila per indicador— l'indicador que no tenim **no hi és**, i això és una
informació, no un forat.

El fitxer global, en canvi, ha de ser una graella per poder ordenar i filtrar:
allà una dada que falta és una cel·la buida.

## El format dels CSV

- **Codificació UTF-8 amb BOM.** Perquè l'Excel en català obri els accents bé amb doble clic.
- **Separador de columnes: punt i coma (\`;\`).**
- **Separador decimal: coma (\`1234,5\`).** Sense separador de milers.
- **Fi de línia CRLF**, i els valors amb \`;\`, cometes o salts de línia van entre cometes dobles.

La raó és una sola: en català el separador decimal és la coma, i un CSV amb
comes a tot arreu es trenca a la primera xifra amb decimals. Amb punt i coma,
l'Excel en català l'obre bé sense tocar res.

**Si feu servir pandas, R o qualsevol altra cosa**, useu el JSON: hi ha els
mateixos valors amb punt decimal, sense format i sense text. O bé:

\`\`\`python
pandas.read_csv("catalunya.csv", sep=";", decimal=",", encoding="utf-8-sig")
\`\`\`

## Convencions de valor

| Cosa | Com va al CSV | Com va al JSON |
|---|---|---|
| Sí / no | \`sí\` / \`no\` | \`true\` / \`false\` |
| Dada que no tenim | cel·la buida (global) o fila absent (municipi) | \`null\` (global) o fila absent (municipi) |
| Dates | \`2024-10-02\` (ISO) | igual |
| Percentatges | el número sol, sense el símbol | igual |
| Euros | el número sol, sense el símbol | igual |

La columna \`any\` és **l'any a què es refereix la dada**, no el de la descàrrega.
Quan és buida, l'indicador no té any: o és una situació actual (l'alcaldia, les
actes indexades) o és un acumulat de tota la sèrie (les alternances des del 1979).

## Identificació del municipi

| Camp | Què és |
|---|---|
${identitat}

## Els indicadors

${blocs}

## Vots i regidories de cada candidatura

Al fitxer per municipi, a més dels indicadors de dalt, hi ha una fila per
candidatura i convocatòria de les tres últimes eleccions (2015, 2019 i 2023).
L'indicador porta les sigles entre parèntesis:

\`\`\`
Barcelona;08019;Vots (PSC-CP);7794;vots;2023;ntc4-rnwr
Barcelona;08019;Regidories (PSC-CP);11;regidories;2023;ntc4-rnwr
\`\`\`

Al JSON, aquestes files porten \`clau\` \`vots_candidatura\` i \`regidories_candidatura\`.
Les sigles són les del conjunt oficial i **canvien entre convocatòries**: la
mateixa força hi surt com a \`PSC-PSOE\`, \`PSC-PM\` i \`PSC-CP\` segons l'any. Si
voleu seguir una força a través del temps, no us fieu de les sigles.

## El que sabem que no quadra

El JSON de cada municipi porta un camp \`incidencies\` amb el que la nostra ingesta
ha detectat que no acaba de lligar en aquell municipi: un recompte d'escons que
no quadra amb la font, una alcaldia que no hem sabut aparellar amb cap llista, un
nom que apareix escrit de dues maneres. Cada entrada té \`tipus\`, \`gravetat\`
(\`alta\`, \`mitjana\` o \`baixa\`) i \`entitat\`.

Ho publiquem perquè un fitxer de dades que amaga el que ja sabem que no quadra
val menys que un que ho diu. Si el municipi que mireu en té una de gravetat alta,
mireu-vos la xifra amb lupa abans de publicar-la.

## Els enllaços que la llicència obliga a mostrar

Dues fonts no són CC i demanen alguna cosa més que citar-les. L'Idescat obliga a
presentar cada xifra **amb l'enllaç que la seva API ha donat**, tal com l'ha
donat; l'INE obliga a citar la font amb una fórmula literal **i la data
d'actualització de la taula**. Al fitxer per municipi no hi cap una columna
més, i per això van a la capçalera del JSON:

\`\`\`json
"enllacos": {
  "idescat": "l'enllaç del municipi que ha donat l'API de l'Idescat, tal com l'ha donat",
  "idescat_ibi": "la pàgina de l'Idescat del rebut d'IBI d'aquest municipi",
  "ine": "la taula provincial de l'ADRH d'on surt la renda"
},
"ine": { "citacio": "Elaboración propia con datos extraídos del sitio web del INE: www.ine.es", "actualitzat": "la data d'actualització de la taula, ISO" }
\`\`\`

Els enllaços van **tal com els han donat les fonts**: no en construïm cap.
Si torneu a publicar \`poblacio_estrangera_pct\`, \`rebut_ibi_mitja\` o
\`renda_neta_persona\`, porteu-vos l'enllaç i la citació amb la xifra. Els
camps són \`null\` als municipis sense la dada.

## Comparar sense fer trampa

Comparar un municipi amb la mediana de tot Catalunya barreja Barcelona amb un
poble de tres-cents habitants, i el resultat no vol dir res. Per això el fitxer
global porta \`grup_comparacio\` i \`grup_mida\`: el conjunt de municipis de la
mateixa mida amb qui és honest comparar-lo. El criteri és el **tram de població
de la LOREG (art. 179)**, que és la classificació oficial que decideix quants
regidors té cada ple; els trams amb menys de 12 municipis s'ajunten amb el veí,
perquè un percentil sobre quatre municipis és soroll.

Els percentils que donem ja van calculats dins del grup:

| Camp | Què és |
|---|---|
${percentils}

**Si en feu un rànquing, feu-lo dins del grup** i digueu quants municipis hi ha
amb dada. És l'única manera que la xifra vulgui dir alguna cosa.

## D'on surt cada cosa

${taulaFonts()}

Els conjunts de l'AOC que fem servir són tots CC0, comprovat amb crides al
portal. Al catàleg de l'AOC hi ha **conjunts duplicats amb el mateix títol i
llicències diferents** (\`cc-nc\`, \`cc-by\`, «no especificada»): per això a la
columna de font hi va l'identificador del recurs i no el nom, que no és unívoc.

Els conjunts de la Generalitat es publiquen sota les condicions d'ús del portal
de transparència, que permeten la reutilització citant-ne l'origen i sense
alterar el sentit de la informació (Llei 37/2007 i Llei 19/2014). El full de
l'ACA va amb la llicència oberta de gencat.cat, que demana el mateix.

L'Idescat i l'INE no són CC i demanen una cosa més cadascun: l'enllaç que dona
l'API, i la citació literal amb la data de la taula. Tots dos van a la capçalera
del JSON de cada municipi, a la secció de dalt.

## Llicència i com citar-nos

Les dades derivades —tot el que porta «càlcul de quivoto» a la columna de font—
es publiquen sota **Creative Commons BY 4.0**. Les dades d'origen mantenen la
seva llicència, que és la de la taula de dalt.

> quivoto, *Observatori municipal*, ${generatedAt}. https://quivoto.cat/observatori/dades/

## El que no hi trobareu, i per què

- **Cap dada personal** més enllà de càrrecs electes: nom, càrrec i candidatura.
  Ni correus, ni adreces, ni telèfons, encara que la font els publiqui.
- **Canvis de grup al ple.** Les fonts escriuen les mateixes sigles de maneres
  diferents i qualsevol xifra que en donéssim seria una acusació sense fonament.
- **El que cobra cada electe.** Ni les retribucions que publica cada seu
  electrònica, ni les de l'inventari del Ministeri, ni els sous de les
  diputacions, ni qui acumula un càrrec en un altre ens: són dades d'una
  persona amb nom i cognoms, cada ajuntament les publica amb un esquema
  diferent i fora de la fitxa —sense el context de la dedicació— es
  converteixen en una llista de sous. El que sí que hi ha és el cost del
  govern en conjunt (\`cost_govern_habitant\`).
- **Els càrrecs i els retrats** de la seu electrònica de cada ajuntament, el
  cartipàs, els organismes dependents i les ordenances. Són llistes amb noms i
  amb esquemes que canvien a cada seu, i no hi ha cap manera de comparar-les.
- **Les mocions** dels plens i **la contractació** de la Plataforma de serveis
  de contractació pública. Es llegeixen a la fitxa amb el context de cada
  sessió i cada expedient; sense ell, una xifra sola diu més del que sabem.
- **Cap dada que no puguem dir d'on surt.**
`;
}

// ------------------------------------------------------------------ càrrega

/**
 * Els `kind` que es carreguen sencers. La resta no entren a la descàrrega, tret
 * dels tres que es carreguen retallats (`poblacio`, `riquesa`,
 * `despesaProgrames`) i que tenen la seva consulta més avall.
 */
const KINDS = [
  "results", "government", "parity", "mayors", "finances", "electoralHistory",
  "taxes", "transparency", "singleList", "revenue", "spending", "services", "councilChanges",
  "residus", "habitatge", "preuAigua", "rebutIbi", "costGovern", "amb", "continuitat", "votPerdut",
] as const;

/**
 * Carrega els 947 amb poques consultes en comptes de 2.841: `loadRadiografia`
 * en fa tres per municipi, que per a una fitxa està bé i per a la descàrrega
 * sencera no.
 *
 * Les mètriques es demanen **una consulta per `kind`**. Portar-se tota la taula
 * d'un cop rebenta el WASM de PGlite amb un «memory access out of bounds»: hi ha
 * `kind` que desen llistes senceres —ordenances, contractes— i el resultat no hi
 * cap. Aquí, a més, només demanem els que publiquem, i els tres més grossos
 * arriben ja retallats des de la consulta.
 */
async function carregaFitxes(db: Db): Promise<Fitxa[]> {
  const municipis = await db.select().from(municipalities).orderBy(asc(municipalities.name));
  const participacio = await db
    .select()
    .from(electionParticipation)
    .orderBy(asc(electionParticipation.electionId));

  // Les incidències obertes: la fitxa les ensenya i la descàrrega també les ha
  // de dur. Un fitxer de dades que amaga el que sabem que no quadra val menys
  // que un que ho diu. El `detail` no surt: és el bolcat intern de la ingesta i
  // hi pot haver-hi qualsevol cosa, incloent-hi noms de persones.
  const incidencies = await db
    .select({
      municipalityId: dataIssues.municipalityId, kind: dataIssues.kind,
      severity: dataIssues.severity, entity: dataIssues.entity,
    })
    .from(dataIssues)
    .where(eq(dataIssues.resolved, false));
  const incidenciesPer = new Map<number, Fitxa["issues"]>();
  for (const fila of incidencies) {
    if (fila.municipalityId === null) continue;
    const llista = incidenciesPer.get(fila.municipalityId);
    const entrada = { kind: fila.kind, severity: fila.severity, entity: fila.entity, detail: null };
    if (llista) llista.push(entrada);
    else incidenciesPer.set(fila.municipalityId, [entrada]);
  }

  const perMunicipi = new Map<number, Map<string, unknown>>();
  for (const kind of KINDS) {
    const files = await db
      .select({ municipalityId: municipalityMetrics.municipalityId, data: municipalityMetrics.data })
      .from(municipalityMetrics)
      .where(eq(municipalityMetrics.kind, kind));
    for (const fila of files) {
      let mapa = perMunicipi.get(fila.municipalityId);
      if (!mapa) perMunicipi.set(fila.municipalityId, (mapa = new Map()));
      mapa.set(kind, fila.data);
    }
  }
  const participacioPer = new Map<number, typeof participacio>();
  for (const fila of participacio) {
    const llista = participacioPer.get(fila.municipalityId);
    if (llista) llista.push(fila);
    else participacioPer.set(fila.municipalityId, [fila]);
  }

  // Si J17 no ha desat cap municipi, no sabem qui és de l'AMB i no ho diem;
  // si n'ha desat, els que no hi són no hi són, i això sí que és una dada.
  const hiHaAmb = [...perMunicipi.values()].some((mapa) => mapa.has("amb"));

  const data = municipalityMetrics.data;
  const poblacioPer = new Map<number, PoblacioResum>();
  for (const fila of await db
    .select({
      municipalityId: municipalityMetrics.municipalityId,
      estrangera: sql<PoblacioResum["estrangera"]>`jsonb_path_query_first(${data}, '$.indicadors[*] ? (@.clau == "pctNacionalitatEstrangera")')`,
      enllacIdescat: sql<string | null>`${data}->'font'->'enllacosMunicipi'->0->>'href'`,
    })
    .from(municipalityMetrics)
    .where(eq(municipalityMetrics.kind, "poblacio"))) {
    poblacioPer.set(fila.municipalityId, { estrangera: fila.estrangera ?? null, enllacIdescat: fila.enllacIdescat });
  }

  const riquesaPer = new Map<number, RiquesaResum>();
  for (const fila of await db
    .select({
      municipalityId: municipalityMetrics.municipalityId,
      valor: sql<string | null>`(jsonb_path_query_first(${data}, '$.indicadors[*] ? (@.clau == "rendaNetaPersona")'))->>'valor'`,
      any: sql<string | null>`${data}->>'any'`,
      taules: sql<RiquesaResum["taules"] | null>`${data}->'font'->'ine'->'taules'`,
    })
    .from(municipalityMetrics)
    .where(eq(municipalityMetrics.kind, "riquesa"))) {
    riquesaPer.set(fila.municipalityId, { valor: numero(fila.valor), any: numero(fila.any), taules: fila.taules ?? [] });
  }

  const programesPer = new Map<number, ProgramesResum>();
  for (const fila of await db
    .select({
      municipalityId: municipalityMetrics.municipalityId,
      programes: sql<ProgramesResum["programes"] | null>`(SELECT jsonb_agg(jsonb_build_object(
        'codi', p->>'codi', 'nom', p->>'nom', 'darrer', p->'darrer', 'mandat', p->'mandat'))
        FROM jsonb_array_elements(${data}->'programes') AS p)`,
    })
    .from(municipalityMetrics)
    .where(eq(municipalityMetrics.kind, "despesaProgrames"))) {
    programesPer.set(fila.municipalityId, { programes: fila.programes ?? [] });
  }

  const grups = buildPeerGroups(municipis.map((m) => ({ id: m.id, population: m.population })));

  return municipis.map((municipality): Fitxa => {
    const own = perMunicipi.get(municipality.id);
    const get = <K extends keyof RadiografiaData>(kind: string): RadiografiaData[K] =>
      (own?.get(kind) ?? null) as RadiografiaData[K];
    const grup = grups.get(municipality.id);
    return {
      municipality,
      results: (own?.get("results") ?? {}) as RadiografiaData["results"],
      government: get<"government">("government"),
      parity: get<"parity">("parity"),
      mayors: get<"mayors">("mayors"),
      finances: get<"finances">("finances"),
      history: get<"history">("electoralHistory"),
      taxes: get<"taxes">("taxes"),
      transparency: get<"transparency">("transparency"),
      singleList: own?.has("singleList") ?? false,
      revenue: get<"revenue">("revenue"),
      spending: get<"spending">("spending"),
      services: get<"services">("services"),
      councilChanges: get<"councilChanges">("councilChanges"),
      residus: get<"residus">("residus"),
      habitatge: get<"habitatge">("habitatge"),
      preuAigua: get<"preuAigua">("preuAigua"),
      rebutIbi: get<"rebutIbi">("rebutIbi"),
      costGovern: get<"costGovern">("costGovern"),
      continuitat: get<"continuitat">("continuitat"),
      votPerdut: get<"votPerdut">("votPerdut"),
      amb: get<"amb">("amb") ?? (hiHaAmb ? { member: false } : null),
      poblacio: poblacioPer.get(municipality.id) ?? null,
      riquesa: riquesaPer.get(municipality.id) ?? null,
      despesaProgrames: programesPer.get(municipality.id) ?? null,
      participation: participacioPer.get(municipality.id) ?? [],
      issues: incidenciesPer.get(municipality.id) ?? [],
      grup: grup ? { label: grup.label, size: grup.size } : null,
    };
  });
}

/** Els `->>` tornen text als dos motors; el número surt d'aquí o no surt. */
function numero(text: string | null): number | null {
  if (text === null) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/**
 * Els enllaços i la citació que dues llicències obliguen a mostrar al costat de
 * la xifra. Van a la capçalera del JSON del municipi: el CSV llarg té set
 * columnes i no en guanya cap per això.
 */
function obligacions(fitxa: Fitxa): {
  enllacos: { idescat: string | null; idescat_ibi: string | null; ine: string | null };
  ine: { citacio: string; actualitzat: string | null } | null;
} {
  const poblacio = fitxa.poblacio;
  const idescat = poblacio?.estrangera?.enllac?.href ?? poblacio?.enllacIdescat ?? null;
  // La taula de l'INE és provincial: la del municipi és la que comença pels
  // dos dígits de província del seu codi INE.
  const taula = fitxa.riquesa?.taules.find((t) => t.provincia === fitxa.municipality.ine5.slice(0, 2)) ?? null;
  const ambRenda = fitxa.riquesa?.valor != null;
  return {
    enllacos: {
      idescat,
      idescat_ibi: fitxa.rebutIbi?.publicable ? fitxa.rebutIbi.font.url : null,
      ine: ambRenda ? (taula?.urlTaula ?? FONTS.ineAdrh.url) : null,
    },
    ine: ambRenda
      ? { citacio: "Elaboración propia con datos extraídos del sitio web del INE: www.ine.es", actualitzat: taula?.actualitzada ?? null }
      : null,
  };
}

// ---------------------------------------------------------------- descàrrega

/**
 * Escriu tots els fitxers de descàrrega a `outDir` i en retorna el compte.
 * `outDir` és el directori de la secció (`web/public/observatori/dades/`);
 * els fitxers per municipi van a `<outDir>/m/`.
 */
/**
 * Els fitxers de descàrrega, i **quants municipis i quants camps hi ha a dins**.
 *
 * Els dos números tornen d'aquí i no els compta qui crida perquè els fitxers
 * sempre porten els municipis sencers de la base de dades, publiqui's una fitxa
 * o les 947. Quan la pàgina de `/dades/` els comptava pel seu compte deia «6
 * municipis · 0 camps» al costat d'un CSV de 947 files i 53 columnes.
 */
export async function writeDownloads(
  db: Db,
  outDir: string,
): Promise<{ files: number; bytes: number; municipis: number; camps: number }> {
  const arrel = outDir.endsWith("/") ? outDir : `${outDir}/`;
  const generatedAt = new Date().toISOString().slice(0, 10);
  const fitxes = await carregaFitxes(db);

  await mkdir(`${arrel}m`, { recursive: true });

  let files = 0;
  let bytes = 0;
  const desa = async (ruta: string, contingut: string): Promise<void> => {
    await writeFile(ruta, contingut, "utf8");
    files += 1;
    bytes += Buffer.byteLength(contingut, "utf8");
  };

  // Els indicadors es calculen un sol cop: serveixen el fitxer del municipi i
  // la fila del global, i així els dos no poden dir coses diferents.
  const totes = fitxes.map((fitxa) => ({ fitxa, files: indicadorsDe(fitxa) }));

  // Percentils dins del grup de comparació: cal recollir abans tots els valors
  // del grup, i per això va en una passada a part.
  const valorsPerGrup = new Map<string, Map<string, number[]>>();
  for (const { fitxa, files: indicadors } of totes) {
    const clauGrup = fitxa.grup?.label ?? "";
    let delGrup = valorsPerGrup.get(clauGrup);
    if (!delGrup) valorsPerGrup.set(clauGrup, (delGrup = new Map()));
    for (const percentil of PERCENTILS) {
      const fila = indicadors.find((f) => f.clau === percentil.sobre);
      if (typeof fila?.valor !== "number") continue;
      const llista = delGrup.get(percentil.sobre);
      if (llista) llista.push(fila.valor);
      else delGrup.set(percentil.sobre, [fila.valor]);
    }
  }

  const globals: Record<string, unknown>[] = [];
  const coberturaBloc = new Map<string, number>();

  for (const { fitxa, files: indicadors } of totes) {
    const m = fitxa.municipality;

    // Cobertura: dels indicadors que surten al fitxer global, quants en tenim.
    const presents = new Set(indicadors.map((f) => f.clau));
    const cobertura = Math.round((100 * CAMPS_GLOBALS.filter((c) => presents.has(c.clau)).length) / CAMPS_GLOBALS.length);
    afegeix(indicadors, "cobertura_pct", cobertura, null);
    for (const bloc of BLOCS) {
      if (bloc.camps.some((camp) => presents.has(camp.clau))) {
        coberturaBloc.set(bloc.titol, (coberturaBloc.get(bloc.titol) ?? 0) + 1);
      }
    }

    // --- fitxer llarg del municipi
    await desa(
      `${arrel}m/${m.slug}.csv`,
      csv(CAPCALERA_MUNICIPI, indicadors.map((f) => [m.name, m.ine5, f.indicador, f.valor, f.unitat, f.any, f.font])),
    );
    await desa(
      `${arrel}m/${m.slug}.json`,
      jsonPerLinies(
        {
          municipi: {
            nom: m.name, slug: m.slug, codi_ine: m.ine5, codi_ens: m.codiEns,
            comarca: m.comarca, provincia: m.provincia,
          },
          generat: generatedAt,
          llicencia: "CC BY 4.0",
          esquema: "https://quivoto.cat/observatori/dades/ESQUEMA.md",
          fitxa: `https://quivoto.cat/observatori/m/${m.slug}/`,
          ...obligacions(fitxa),
          incidencies: fitxa.issues.map((i) => ({ tipus: i.kind, gravetat: i.severity, entitat: i.entity })),
        },
        "indicadors",
        indicadors.map((f) => ({
          clau: f.clau, indicador: f.indicador, valor: f.valor,
          unitat: f.unitat, any: f.any, font: f.font,
        })),
      ),
    );

    // --- fila del fitxer global
    const per = new Map(indicadors.filter((f) => f.clau !== "deute_habitant_serie").map((f) => [f.clau, f.valor]));
    const fila: Record<string, unknown> = {
      municipi: m.name, slug: m.slug, codi_ine: m.ine5, codi_ens: m.codiEns,
      comarca: m.comarca, provincia: m.provincia,
    };
    for (const camp of CAMPS_GLOBALS) fila[camp.clau] = per.get(camp.clau) ?? null;
    for (const percentil of PERCENTILS) {
      const valor = per.get(percentil.sobre);
      const llista = valorsPerGrup.get(fitxa.grup?.label ?? "")?.get(percentil.sobre) ?? [];
      fila[percentil.clau] = typeof valor === "number" ? percentileOf(valor, llista) : null;
    }
    globals.push(fila);
  }

  const columnes = [
    ...IDENTITAT.map((c) => c.clau),
    ...CAMPS_GLOBALS.map((c) => c.clau),
    ...PERCENTILS.map((p) => p.clau),
  ];
  await desa(
    `${arrel}catalunya.csv`,
    csv(columnes, globals.map((fila) => columnes.map((clau) => fila[clau] as Valor | null))),
  );
  await desa(
    `${arrel}catalunya.json`,
    jsonPerLinies(
      {
        generat: generatedAt,
        municipis: globals.length,
        llicencia: "CC BY 4.0",
        esquema: "https://quivoto.cat/observatori/dades/ESQUEMA.md",
      },
      "dades",
      globals,
    ),
  );

  // L'esquema es genera l'últim perquè hi consti el compte de fitxers real,
  // ell inclòs.
  await desa(`${arrel}ESQUEMA.md`, esquema(generatedAt, globals.length, files + 1, coberturaBloc));

  return { files, bytes, municipis: globals.length, camps: columnes.length };
}

// -------------------------------------------------------------------- pàgina

const escapa = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * La pàgina de `/observatori/dades/`. Explica què hi ha, com es fa servir, amb
 * quina llicència i com citar-nos, i res més: no volem que sembli un portal de
 * dades obertes, perquè no ho és.
 */
/**
 * El que és propi d'aquesta pàgina, i res més.
 *
 * Aquí hi havia una còpia sencera dels tokens, de la tipografia i de la
 * capçalera, escrita a mà abans que existís la capçalera compartida. Havia
 * envellit: quan la capçalera va guanyar el menú i el cercador, aquesta pàgina
 * es va quedar amb la versió d'abans —sense embolcallar i sense cap media
 * query— i era **l'única de tot el web on la capçalera desbordava**: 228 px de
 * més a 320. Ara fa servir el full compartit, com la resta.
 */
const DADES_CSS = `${RADIOGRAFIA_CSS}
.baixades{list-style:none;padding:0;margin:var(--e3) 0 0;display:grid;gap:var(--e2)}
.baixades a{display:block;background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);box-shadow:var(--ombra);
  padding:var(--e3);text-decoration:none;transition:transform .12s ease,box-shadow .12s ease}
.baixades a:hover{transform:translate(2px,2px);box-shadow:1px 1px 0 var(--ink)}
.baixades b{font-family:var(--display);font-weight:900;font-size:1.35rem;letter-spacing:-.02em;display:block;margin-bottom:4px}
.baixades span{color:var(--ink-suau);font-size:.95rem}
.parell{display:flex;flex-wrap:wrap;gap:var(--e1);margin-top:var(--e2)}
.parell a{border:2px solid var(--ink);border-radius:var(--r-max);padding:4px 13px;font-size:.8rem;font-weight:800;text-decoration:none;background:var(--paper)}
.xifres{list-style:none;padding:0;margin:var(--e3) 0 0;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:var(--e2)}
.xifres li{background:var(--menta);color:#1E1B2E;border:2.5px solid #1E1B2E;border-radius:var(--r-m);padding:var(--e2);box-shadow:3px 3px 0 #1E1B2E}
.xifres b{display:block;font-family:var(--display);font-weight:900;font-size:2.2rem;letter-spacing:-.03em;line-height:1}
.xifres span{font-size:.86rem}
pre{background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);padding:var(--e2);overflow-x:auto;font-size:.85rem}
pre code{background:none;border:0;padding:0}
table{border-collapse:collapse;width:100%;font-size:.92rem;margin-top:var(--e2)}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--vora);vertical-align:top}
th{font-family:var(--display);font-weight:900}
.cita{background:var(--lavanda);color:#1E1B2E;border:2.5px solid #1E1B2E;border-radius:var(--r-m);padding:var(--e3);box-shadow:3px 3px 0 #1E1B2E;margin-top:var(--e2)}
`;

export function renderDadesIndex(generatedAt: string, stats: { municipis: number; camps: number }): string {
  const municipis = stats.municipis.toLocaleString("ca-ES");
  return `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Descarrega les dades · Observatori de quivoto</title>
<meta name="description" content="Els indicadors dels ${municipis} municipis de l'Observatori en CSV i JSON, amb l'esquema documentat i la font de cada camp. Fitxers, no una API.">
${tipografia("../")}
<style>${DADES_CSS}</style>
</head>
<body>
<a class="salta" href="#contingut">Ves al contingut</a>

${capcalera("../", "dades", "dades obertes")}
${cercador("../")}

<main id="contingut">

<p class="micro">Descàrrega</p>
<h1>Les dades, en cru</h1>
<p class="entrada">Tot el que mostra l'Observatori, en fitxers que podeu obrir, comprovar i
tornar a publicar. Ho posem aquí perquè un periodista local ens pugui contrastar sense
demanar-nos permís ni esperar cap resposta.</p>

<ul class="xifres">
  <li><b>${municipis}</b><span>municipis</span></li>
  <li><b>${stats.camps}</b><span>camps al fitxer de Catalunya</span></li>
  <li><b>CC BY</b><span>i cada camp amb la seva font</span></li>
</ul>

<section class="bloc">
  <h2>Què hi ha</h2>
  <ul class="baixades">
    <li><a href="catalunya.csv"><b>Tot Catalunya</b>
      <span>Els ${municipis} municipis amb els indicadors principals, una fila per municipi.
      És el fitxer que fareu servir.</span></a>
      <div class="parell"><a href="catalunya.csv">CSV</a><a href="catalunya.json">JSON</a></div></li>
    <li><a href="ESQUEMA.md"><b>L'esquema</b>
      <span>Cada camp: què vol dir, en quines unitats va, de quin any és i de quin conjunt
      obert surt, amb l'identificador per anar-lo a comprovar.</span></a></li>
  </ul>
  <h2 style="margin-top:var(--e4)">Un municipi sol</h2>
  <p>Cada fitxa té el seu parell de fitxers amb tot el que ensenya. El nom és el mateix de
  l'adreça de la fitxa:</p>
  <pre><code>quivoto.cat/observatori/m/<b>barcelona</b>/
quivoto.cat/observatori/dades/m/<b>barcelona</b>.csv
quivoto.cat/observatori/dades/m/<b>barcelona</b>.json</code></pre>
  <p class="nota">El fitxer del municipi va en format llarg —una fila per indicador— perquè
  cada municipi té dades diferents. Així l'indicador que no tenim no hi és, i això és una
  informació i no un forat en una graella.</p>
</section>

<section class="bloc">
  <h2>Com obrir-los</h2>
  <p>Els CSV van amb <b>UTF-8 amb BOM, punt i coma de separador i coma decimal</b>. En català
  el separador decimal és la coma, i un CSV amb comes a tot arreu es trenca a la primera
  xifra amb decimals: així l'Excel en català els obre bé amb doble clic i sense tocar res.</p>
  <p>Si treballeu amb codi, el JSON té els mateixos valors amb punt decimal i sense format.
  I si voleu el CSV igualment:</p>
  <pre><code>pandas.read_csv("catalunya.csv", sep=";", decimal=",", encoding="utf-8-sig")</code></pre>
</section>

<section class="bloc">
  <h2>Abans de fer-ne un rànquing</h2>
  <p>Comparar un municipi amb la mediana de tot Catalunya barreja Barcelona amb un poble de
  tres-cents habitants, i el resultat no vol dir res. Per això el fitxer global porta
  <code>grup_comparacio</code>: els municipis de la mateixa mida amb qui és honest comparar-lo,
  pel tram de població de la LOREG, que és la classificació oficial que decideix quants
  regidors té cada ple.</p>
  <p><b>Ordeneu dins del grup</b> i digueu quants municipis hi ha amb dada. Els percentils que
  us donem ja van calculats així.</p>
</section>

<section class="bloc">
  <h2>Llicència i com citar-nos</h2>
  <table>
    <tbody>
      <tr><th>Les nostres dades derivades</th><td>Creative Commons BY 4.0. Feu-ne el que vulgueu, digueu d'on surten.</td></tr>
      <tr><th>Les dades d'origen</th><td>Mantenen la seva llicència. Els conjunts de l'AOC que fem servir són CC0; els de la Generalitat, les condicions d'ús del portal de transparència. L'Idescat demana el seu enllaç al costat de la xifra i l'INE, una citació literal amb la data de la taula: tots dos van al JSON de cada municipi.</td></tr>
      <tr><th>Cap dada personal</th><td>Només càrrecs electes, i només nom, càrrec i candidatura. Cap correu, cap adreça, cap telèfon, encara que la font els publiqui.</td></tr>
    </tbody>
  </table>
  <div class="cita">
    <p style="margin:0"><b>quivoto</b>, <i>Observatori municipal</i>, ${escapa(generatedAt)}.<br>
    https://quivoto.cat/observatori/dades/</p>
  </div>
</section>

<section class="bloc">
  <h2>Això no és una API</h2>
  <p>Són fitxers estàtics que es regeneren quan regenerem l'Observatori. No hi ha
  autenticació, no hi ha peticions per municipi i no prometem que les claus no canviïn mai:
  prometem que, si canvien, l'esquema ho dirà. No fem el portal de dades obertes més complet
  de Catalunya; fem que es pugui comprovar el que publiquem.</p>
</section>

</main>
${peu("../", generatedAt)}
</body>
</html>`;
}
