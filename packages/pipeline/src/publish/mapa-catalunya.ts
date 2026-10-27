import { RADIOGRAFIA_CSS } from "./estil";
import { geometria } from "./mapa";
import { siglesFamily } from "@quivoto/shared-schemas/brands";
import { SITE } from "./config";
import { ARREL_OBSERVATORI, capSeo, filAriadna, FITXER_OG, imatgeOg } from "./seo";
import type { Els947Row } from "./els947";
import { MASCOTA_CSS, papereta } from "./mascota";
import { capcalera, tipografia } from "./capcalera";
import { cercador } from "./cercador";
import { peu } from "./peu";
import { dataEscrita, de, elDia } from "../lib/text";
import { atributsEtiqueta, GRAFICS_JS, type DadaEtiqueta } from "./grafics";
import { buildPeerGroups } from "../derive/peers";
import { preuAiguaComparable } from "./contracte-metriques";
import {
  colorDe, etiquetesPct, graoDe, MARQUES, quintilsDe, rampaDe, siglesDe, type VotsPartit,
} from "./vots-partit";

/**
 * El mapa dels 947, pintat per indicador.
 *
 * Fins ara el mapa de l'Observatori era un núvol de punts: servia per situar un
 * municipi però no per veure res. Amb els límits municipals de veritat es pot
 * veure d'una ullada on hi ha majories absolutes, on l'alcaldia ha canviat a mig
 * mandat i on la mateixa força guanya des del 1979 —coses que en una llista de
 * 947 files no es veuen mai.
 *
 * La geometria està desada al repositori i no es baixa en temps de compilació:
 * els límits municipals canvien molt de tant en tant, i dependre d'un servei
 * extern per generar el web seria fer-se dependent d'una cosa que no controlem.
 * `tools/geo_repara_icgc.py` documenta com s'obté i, sobretot, com es repara —el
 * GeoJSON que serveix l'ICGC aplana cada MultiPolygon i, si te'l creus tal com
 * ve, Barcelona i 43 municipis més desapareixen del mapa.
 *
 * **Un mapa de municipis sobrerepresenta el buit.** El Pallars ocupa molta més
 * taca que el Barcelonès i hi viu una fracció de la gent. Durant un temps això
 * va servir per no posar-hi cap xifra de diners: la por era que un mapa del
 * deute per habitant es llegís com un mapa d'on hi ha muntanya. La por continua
 * sent justa i la solució no és amagar la dada, que la tenim i és pública, sinó
 * dir-ho a sota de cada capa i escriure la mediana al peu, perquè el lector
 * sàpiga contra què compara la taca que està mirant. Qui vulgui la xifra pesada
 * per habitants la té al comparador, que és on hi ha la vara de mesurar.
 */

const escape = (t: string): string =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * La geometria viu a «mapa.ts» i aquí només es torna a exportar.
 *
 * Els dos mapes —el gran dels 947 i el petit de cada fitxa— llegeixen el mateix
 * fitxer de 81 kB, i tenir-ne dues còpies volia dir llegir-lo dues vegades a
 * cada publicació. Es torna a exportar amb el mateix nom perquè «mapa-ara.ts»,
 * la vista prèvia del mapa, el demana d'aquí.
 */
export { geometria } from "./mapa";

type Capa = {
  id: string;
  titol: string;
  /**
   * El nom curt del botó. Amb onze capes, el títol sencer al botó feia una
   * paret de text on no es podia triar res: «Quantes vegades ha canviat qui
   * guanya, des del 1979» ocupa tres línies i el que el lector busca és
   * «alternança». El títol llarg continua manant a l'encapçalament del mapa.
   */
  boto: string;
  peu: string;
  /**
   * La família de la capa al desplegable del mòbil.
   *
   * Amb vint-i-vuit capes, una llista plana és una tira on no es troba res; el
   * `<select>` les agrupa amb `<optgroup>` per la pregunta que responen —qui
   * governa, com es vota, qui hi viu, els diners— i les dels partits van al
   * seu grup de sempre. A l'escriptori no canvia res: els botons continuen en
   * les dues fileres d'abans i en el mateix ordre.
   */
  grup: string;
  /**
   * Què mesura la xifra, dit per a la clau: «€ per habitant», «% del cens».
   *
   * Les etiquetes de la clau ja porten el símbol —«menys de 81 €»—, però el
   * símbol sol no diu de què: 81 € de deute per habitant no és el mateix que
   * 81 € de sou. Les capes de categories no en tenen.
   */
  unitat?: string;
  /**
   * D'on surt la dada, curt, per a la clau: «Consorci AOC», «Idescat».
   *
   * La font llarga, amb l'enllaç, és a «D'on surt el mapa» i al peu de la capa.
   * Aquí va el nom que cap en una línia, perquè la clau de dins del dibuix és
   * la que viatja amb una captura i una captura sense font és una xifra que
   * ningú pot comprovar.
   */
  font: string;
  /**
   * Quan no hi ha any (`any` buit), el que la clau diu en lloc seu: «últim
   * exercici liquidat», «darrer cens publicat». És veritat i no s'inventa cap
   * any: el deute de cada ajuntament és del seu últim exercici, i no és el
   * mateix a tot arreu.
   */
  quan?: string;
  /** Valor d'un municipi, o null si no en tenim. */
  valor: (r: Els947Row) => number | null;
  /** Els talls entre graons; si no n'hi ha, es fan per quantils. */
  talls?: number[];
  etiquetes?: string[];
  format: (v: number) => string;
  /**
   * El que diu l'etiqueta d'un municipi quan el valor formatat no ho diu tot.
   *
   * A «qui mana» el valor és el número de la família a la taula i el format
   * en treu el nom de la força, i el que el lector vol saber en passar-hi el
   * ratolí és també qui és l'alcaldia: aquesta funció ho pot escriure perquè
   * rep la fila sencera. `null` és «sense dada» i es diu com la clau.
   */
  text?: (r: Els947Row, v: number | null) => string | null;
  /**
   * De quan és la dada, per dir-ho a l'etiqueta al costat del valor.
   *
   * Un text quan és el mateix per a tothom —«2023», «mandat 2023-2027»— i
   * una funció quan cada fila porta el seu any, que és el que passa amb el
   * preu de l'aigua i la renda: allà un municipi amb la xifra d'un any vell
   * no ha de fer semblar que la capa sencera és d'aquell any. Sense res, la
   * capa no diu any, que és millor que dir-ne un que no és segur: el deute
   * és de «l'últim exercici liquidat» i aquest no és el mateix a tot arreu.
   */
  any?: string | ((r: Els947Row) => number | string | null);
  /**
   * Colors propis de la capa, un per graó, quan el que separa els municipis no
   * és una escala sinó una categoria (o, a les capes de xifres, la rampa del
   * seu tema: vegeu TO_DE_CAPA). Una rampa d'una sola tinta diu
   * «més o menys»; els partits no són més ni menys que els altres, i pintar-los
   * amb una rampa faria que el mapa digués una cosa que no és.
   */
  colors?: string[];
  /**
   * Els mateixos graons en mode fosc, quan la rampa és d'una sola tinta i s'ha
   * de girar sencera com la coral. Les capes de categories no en tenen: el
   * color d'un partit no es gira.
   */
  colorsFosc?: string[];
  /** Com es diu el forat a la clau. Si no es diu res, «sense dada». */
  senseDada?: string;
  /** El títol de la clau de dins del dibuix, si no ha de ser el del botó. */
  clau?: string;
  /** Les etiquetes a partir dels talls, quan els talls surten per quantils i cal dir-los d'una altra manera. */
  etiquetesDe?: (talls: readonly number[]) => string[];
  /** La frase de sota el mapa: quants municipis tenen la dada i on cau el del mig. */
  cobertura?: (ambDada: number, total: number, mig: string) => string;
  /** On porta la capa, quan porta a algun lloc: la pàgina del partit. */
  enllac?: { href: string; text: string };
};

const coma = (v: number, decimals = 0): string => v.toFixed(decimals).replace(".", ",");
const pct = (v: number): string => `${coma(v)} %`;
/** Un decimal, per a les xifres on l'enter s'empassa les diferències. */
const pct1 = (v: number): string => `${coma(v, 1)} %`;
/** Punt de miler a mà: el mapa s'escriu una vegada i no ha de dependre del locale. */
const milers = (v: number): string => Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/**
 * De quina força és l'alcaldia de cada poble.
 *
 * Les sigles no serveixen per pintar: el PSC es presenta com a PSC-CP, PSC-PM
 * o PSC-PSOE segons el poble i l'any, i pintades una a una el mapa sortiria
 * clapejat de vermells diferents que no volen dir res. El que agrupa és la
 * **família** —la mateixa funció que ja fa servir tota la resta del projecte—
 * i per això «unificar noms de partit diferents» no és cap feina a part: és el
 * que fa `siglesFamily()`.
 *
 * Les llistes locals no s'ajunten en cap categoria: són 226 marques que no
 * tenen res a veure les unes amb les altres, i pintar-les del mateix color
 * diria que hi ha un «partit de les llistes locals» que no existeix. Van amb
 * el gris de sense marca, que és exactament el que són aquí.
 */
const FAMILIES_MAPA: ReadonlyArray<readonly [string, string, string]> = [
  ["psc", "PSC", "#d00c3c"],
  ["junts", "Junts", "#00c3b2"],
  ["erc", "ERC", "#ffb232"],
  ["comuns", "Comuns", "#662483"],
  ["cup", "CUP", "#d8d000"],
  ["pp", "PP", "#234b90"],
  ["cs", "Ciutadans", "#ff5824"],
  ["vox", "Vox", "#00c118"],
  ["pdecat", "PDeCAT", "#7f9ac9"],
  ["aliancacat", "Aliança Catalana", "#1d3f6e"],
  ["ciu", "CiU", "#18307b"],
  ["cda", "CDA", "#a05a2c"],
];

/**
 * De quina família és una alcaldia, i per què no s'endevina de l'acrònim.
 *
 * Aquesta funció existeix perquè 94 municipis amb 640.193 habitants sortien
 * grisos amb `siglesFamily()` sol. El cas que ho explica és el Prat de
 * Llobregat: l'alcaldia hi és d'«EPCP-C», que vol dir El Prat en Comú Podem,
 * i l'expressió dels comuns busca «ecp» o «en-comu» —que allà van plegats dins
 * d'un acrònim que només existeix al Prat. Ampliar l'expressió per encabir-hi
 * cada plegat local és el camí segur cap a l'error: és el mateix mecanisme que
 * pintava Copons d'extrema dreta perquè la seva llista d'electors es diu «AC».
 *
 * El senyal fiable no és l'acrònim sinó **el codi d'agrupació de la font
 * electoral**, que arriba a la fila com a `b`. Per això mana ell i les sigles
 * només hi són de reserva. Sobre les 2.626 candidatures del 2023 les dues coses
 * diuen el mateix 2.189 vegades i només xoquen cinc, i els cinc són coalicions
 * on les sigles porten dos noms —«JUNTS-ERC-AM», «CM-CUP-AMUNT»— i on triar-ne
 * un llegint-lo d'esquerra a dreta és arbitrari. El codi d'agrupació diu sota
 * quina de les dues es va registrar la llista, que és la resposta que existeix.
 *
 * I al revés, Terrassa continua grisa. «TxT» és Tot per Terrassa i no és cap
 * marca gran: el codi d'agrupació diu que és una llista d'electors i el mapa
 * l'ha de deixar en gris. Un gris de més val més que una taca de color d'un
 * partit que en aquell poble no existeix.
 *
 * Comptat sobre els 947: dels 94, el codi n'acaba pintant **dotze** —el Prat,
 * Santa Perpètua de Mogoda, Montornès del Vallès, Pallejà i vuit més, 133.952
 * habitants—, i els altres es queden grisos perquè el codi diu que són llistes
 * d'electors o marques comarcals que el mapa no pinta. Els grisos passen de 118
 * a 107, i cinc municipis que ja tenien color en canvien perquè el tenien
 * equivocat.
 */
function familiaAlcaldia(r: Els947Row): string | null {
  const marca = r.b ?? null;
  if (marca && FAMILIES_MAPA.some(([id]) => id === marca)) return marca;
  // Ni «local» ni una federació comarcal no són una negació: «local» és alhora
  // la marca de les agrupacions d'electors i la casella on cau tot codi que
  // encara no s'ha repassat, i a Tiana la llista es diu literalment «JUNTS».
  return r.g ? siglesFamily(r.g) : null;
}

/**
 * El mandat que el mapa retrata a les capes de govern: qui mana, majories,
 * pactes, canvis i dones al ple són de la composició d'ara dels plens, no
 * d'un any concret, i l'etiqueta ho diu així.
 */
const MANDAT = "mandat 2023-2027";

const CAPA_PARTIT: Capa = {
  id: "partit",
  grup: "Qui governa",
  font: "Generalitat de Catalunya",
  titol: "De quina força és cada alcaldia",
  boto: "Qui mana",
  peu: `El color és el de la força de qui té l'alcaldia, no el de la llista més votada.
    Les candidatures del mateix partit s'ajunten pel codi d'agrupació amb què es van presentar,
    encara que les sigles siguin diferents a cada poble; les llistes locals no s'ajunten amb
    ningú, perquè no són el mateix partit, i es queden grises.`,
  valor: (r) => {
    const familia = familiaAlcaldia(r);
    if (!familia) return null;
    const i = FAMILIES_MAPA.findIndex(([id]) => id === familia);
    return i === -1 ? null : i;
  },
  any: MANDAT,
  talls: FAMILIES_MAPA.map((_, i) => i + 0.5).slice(0, -1),
  etiquetes: FAMILIES_MAPA.map(([, nom]) => nom),
  colors: FAMILIES_MAPA.map(([, , color]) => color),
  format: (v) => FAMILIES_MAPA[v]?.[1] ?? "sense marca",
  // «ERC (alcaldia: Nom Cognom)». Un municipi gris no és un municipi sense
  // alcaldia: si en sabem les sigles es diuen, amb el que són —una llista
  // local o una marca que el mapa no pinta— perquè el gris no es llegeixi
  // com un forat.
  text: (r, v) => {
    const forca = v === null ? (r.g ? `${r.g}, llista local o sense marca` : null) : FAMILIES_MAPA[v]![1];
    if (!forca) return null;
    return r.a ? `${forca} (alcaldia: ${r.a})` : forca;
  },
};

/**
 * Els dos colors de les capes de «sí o no»: majoria absoluta, pactes i canvis.
 *
 * Abans feien servir els dos primers graons de la rampa coral, #FBEFE6 i
 * #F0BFA9, que tenen un contrast d'1,5 entre ells —i en fosc, #3B2119 contra
 * #6A3524, el mateix—: el «sí» i el «no» es confonien just a la capa on només
 * hi ha dues coses per distingir. Ara el «no» és el paper de les
 * targetes (`--paper-2`) i el «sí», el coral de la marca (`--coral`), que és el
 * color que assenyala allò que pregunta el títol —on hi ha majoria, on no
 * governa el primer, on ha canviat l'alcaldia— i no cap veredicte: no hi ha
 * cap verd que digui «bé» ni cap vermell que digui «malament». Contrast entre
 * tots dos: 3,1 en clar i 5,3 en fosc. Són variables de la marca i giren
 * soles en mode fosc, de manera que no cal cap parell fosc a part.
 */
const SI_O_NO = ["var(--paper-2)", "var(--coral)"];

/** Una variació amb el signe de debò: «+12,3 %», «−4,0 %», «0,0 %». */
const ambSignePct = (v: number): string => `${v > 0 ? "+" : v < 0 ? "−" : ""}${coma(Math.abs(v), 1)} %`;

/** Els dos models de gestió de l'aigua, en dos blaus de la capa del preu: cap no és «el bo». */
const BLAUS_AIGUA = rampaDe("#2F6FD6");

/**
 * Les capes que fins ara només eren a la fitxa: com es vota i qui pot votar,
 * qui contracta amb una sola oferta, l'habitatge. Totes descriuen; cap no
 * puntua cap govern, i les que depenen de la mida ho diuen al peu perquè la
 * taca no es llegeixi sola. El color de cadascuna és a `TO_DE_CAPA`.
 */
const CAPES_NOVES: Capa[] = [
  {
    id: "veins-voten",
    grup: "Com es vota",
    unitat: "% del padró que és al cens",
    font: "Generalitat de Catalunya i Idescat",
    titol: "Quants veïns podien votar a les municipals del 2023",
    boto: "Veïns que poden votar",
    peu: `Electors del cens de les municipals del 2023 sobre els habitants del padró a 1 de gener del 2023.
      Hi voten les persones de nacionalitat espanyola i les de la Unió Europea —i d'uns quants països amb
      conveni— inscrites al cens; no hi voten els menors ni la resta de veïns estrangers. No és cap
      valoració: diu qui viu al poble. Pot passar del 100 % perquè padró i cens es tanquen en dates diferents.`,
    valor: (r) => r.vv ?? null,
    any: "2023",
    format: pct1,
  },
  {
    id: "fragmentacio",
    grup: "Com es vota",
    unitat: "partits efectius al ple",
    font: "Generalitat de Catalunya",
    titol: "Com de repartit és el ple",
    boto: "Fragmentació",
    peu: `Nombre efectiu de partits (Laakso-Taagepera) sobre les regidories del 2023: 1 és un ple d'una
      sola llista i, com més alt, més repartit. Un ple de cinc regidories no es pot repartir tant com un
      de vint-i-cinc, i per això la taca segueix molt la mida del municipi.`,
    valor: (r) => r.ne ?? null,
    any: "2023",
    format: (v) => coma(v, 2),
  },
  {
    id: "volatilitat",
    grup: "Com es vota",
    unitat: "índex de Pedersen, de 0 a 100",
    font: "Consorci AOC",
    titol: "Quant es va moure el ple del 2019 al 2023",
    boto: "Volatilitat",
    peu: `Índex de Pedersen sobre les quotes de regidories entre dues eleccions: 0 és un ple calcat a
      l'anterior i 100, que no en queda res. Només amb el càlcul fiable; on massa regidories són de
      llistes locals que canvien de nom, el municipi va ratllat. Moure's molt no és ni bo ni dolent.`,
    valor: (r) => (r.vola === 2023 ? r.vol ?? null : null),
    any: "2019-2023",
    format: (v) => coma(v, 1),
  },
  {
    id: "vot-perdut",
    grup: "Com es vota",
    unitat: "% dels vots emesos",
    font: "Generalitat de Catalunya",
    titol: "Quants vots no van arribar al ple el 2023",
    boto: "Vot sense representació",
    peu: `Vots a llistes que no van treure cap regidoria, més nuls i blancs, sobre els vots emesos del 2023.
      Depèn sobretot de quantes llistes es presenten i de la barrera del 5 %. Als municipis de llistes
      obertes la font no quadra i no es pot calcular.`,
    valor: (r) => r.vp ?? null,
    any: "2023",
    format: pct1,
  },
  {
    id: "ultima-regidoria",
    grup: "Com es vota",
    unitat: "vots",
    font: "Generalitat de Catalunya i Ministeri de l'Interior",
    titol: "Per quants vots es va decidir l'última regidoria",
    boto: "Última regidoria",
    peu: `Quants vots de més li calien a qui va quedar més a prop de prendre l'última regidoria del 2023,
      amb tota la resta igual. És aritmètica sobre els resultats oficials, no una predicció. Com més gran
      el municipi, més vots calen: la taca segueix la mida, i la comparació justa és amb els de la seva.`,
    valor: (r) => r.mg ?? null,
    any: "2023",
    format: (v) => `${milers(v)} vot${v === 1 ? "" : "s"}`,
  },
  {
    id: "forca-alcaldia",
    grup: "Qui governa",
    unitat: "anys seguits",
    quan: "comptats fins a la darrera actualització",
    font: "Generalitat de Catalunya",
    titol: "Quants anys fa que mana la mateixa força",
    boto: "Anys de la mateixa força",
    peu: `Anys seguits que la força que avui té l'alcaldia l'ha tinguda, encara que hagi canviat la
      persona. Una ratxa llarga pot ser una majoria estable o la falta d'alternativa: la taca no ho
      distingeix.`,
    valor: (r) => r.cfa ?? null,
    format: (v) => `${milers(v)} any${v === 1 ? "" : "s"}`,
  },
  {
    id: "una-oferta",
    grup: "Què fa i què costa l'ajuntament",
    unitat: "% de licitacions",
    font: "Plataforma de Serveis de Contractació Pública",
    titol: "Quines licitacions van rebre una sola oferta",
    boto: "Una sola oferta",
    peu: `De les licitacions de l'ajuntament que diuen quantes ofertes van rebre, quina part en va rebre
      només una. Només amb cinc licitacions o més; la resta va ratllada. No és cap irregularitat: als
      pobles petits sovint no hi ha més empreses, i la xifra s'ha de llegir amb els de la mateixa mida.`,
    valor: (r) => r.uo ?? null,
    any: (r) => (r.uo == null ? null : r.uop ?? null),
    format: pct,
    cobertura: (n, total, mig) =>
      `${n} dels ${total} municipis tenen prou licitacions per dir-ho. Al municipi del mig, ${mig}.`,
  },
  {
    id: "gestio-aigua",
    grup: "Què fa i què costa l'ajuntament",
    font: "Agència Catalana de l'Aigua",
    titol: "Qui presta el servei d'aigua",
    boto: "Gestió de l'aigua",
    peu: `Directa vol dir que presta el subministrament el mateix ajuntament o un ens seu; indirecta, que el
      presta una empresa per concessió o una societat mixta. Segons l'Observatori del preu de l'aigua de
      l'ACA. Cap dels dos models no és el bo: el mapa diu on hi ha cadascun.`,
    valor: (r) => (r.pag === "directa" ? 0 : r.pag === "indirecta" ? 1 : null),
    any: (r) => (r.pag === "directa" || r.pag === "indirecta" ? r.paa ?? null : null),
    talls: [0.5],
    etiquetes: ["gestió directa", "gestió indirecta"],
    colors: [BLAUS_AIGUA.clar[1]!, BLAUS_AIGUA.clar[3]!],
    colorsFosc: [BLAUS_AIGUA.fosc[1]!, BLAUS_AIGUA.fosc[3]!],
    format: (v) => (v === 0 ? "gestió directa" : "gestió indirecta"),
  },
  {
    id: "pla-urbanistic",
    grup: "Què fa i què costa l'ajuntament",
    unitat: "anys del pla vigent",
    font: "Observatori del Territori",
    titol: "Quants anys té el pla urbanístic",
    boto: "Pla urbanístic",
    peu: `Anys que fa que es va aprovar el pla urbanístic general vigent. El POUM és la figura d'ara; les
      normes subsidiàries i els altres plans generals són d'abans del 2002. Un pla vell no és un pla
      dolent: diu quan es va fer.`,
    valor: (r) => r.pla ?? null,
    any: (r) => (r.pla == null ? null : r.plaa ?? null),
    format: (v) => `${milers(v)} any${v === 1 ? "" : "s"}`,
    text: (r, v) => (v === null ? null : `${milers(v)} any${v === 1 ? "" : "s"}${r.plas ? ` (${r.plas})` : ""}`),
  },
  {
    id: "pisos-turistics",
    grup: "L'habitatge",
    unitat: "per 100 habitants",
    font: "Registre de Turisme de Catalunya",
    titol: "Quants pisos turístics hi ha",
    boto: "Pisos turístics",
    peu: `Habitatges d'ús turístic en alta al Registre de Turisme de Catalunya el dia de la consulta, per cada
      100 habitants del padró. Compta els inscrits, no els que funcionen sense registre, i depèn sobretot de
      la costa i la muntanya.`,
    valor: (r) => r.hut ?? null,
    any: (r) => (r.hut == null ? null : r.huta ?? null),
    format: (v) => coma(v, 2),
  },
  {
    id: "lloguer",
    grup: "L'habitatge",
    unitat: "€ al mes",
    font: "Agència de l'Habitatge de Catalunya",
    titol: "Quant costa llogar un pis",
    boto: "Lloguer",
    peu: `Preu mitjà dels contractes de lloguer amb fiança dipositada de l'últim any publicat. Als pobles
      petits sovint no hi ha prou contractes i el municipi va ratllat. És el preu dels contractes nous,
      no el que paguen tots els llogaters.`,
    valor: (r) => r.ll ?? null,
    any: (r) => (r.ll == null ? null : r.lla ?? null),
    format: (v) => `${milers(v)} €`,
  },
  {
    id: "lloguer-canvi",
    grup: "L'habitatge",
    unitat: "% des del 2023",
    font: "Agència de l'Habitatge de Catalunya",
    titol: "Com ha canviat el lloguer des del 2023",
    boto: "Canvi del lloguer",
    peu: `Variació del preu mitjà del lloguer entre el 2023 i l'últim any publicat. Amb pocs contractes,
      uns quants pisos mouen molt la mitjana; depèn del mercat de la zona més que de cap decisió municipal.`,
    valor: (r) => r.llv ?? null,
    any: (r) => (r.llv == null ? null : r.llp ?? null),
    format: ambSignePct,
  },
  {
    id: "habitatge-protegit",
    grup: "L'habitatge",
    unitat: "acabats per 1.000 habitants",
    font: "Departament de Territori",
    titol: "Quant habitatge protegit s'ha acabat des del 2023",
    boto: "Habitatge protegit",
    peu: `Habitatges amb protecció oficial acabats des del 2023 fins al darrer any publicat, per cada 1.000
      habitants. Una sola promoció mou molt la xifra d'un poble petit, i zero vol dir que la font no en
      compta cap d'acabat aquests anys.`,
    valor: (r) => r.hpo ?? null,
    any: (r) => (r.hpo == null ? null : r.hpop ?? null),
    format: (v) => coma(v, 1),
  },
];

const CAPES: Capa[] = [
  CAPA_PARTIT,
  {
    id: "majoria",
    grup: "Qui governa",
    font: "Generalitat de Catalunya",
    titol: "On governa algú amb majoria absoluta",
    boto: "Majoria absoluta",
    peu: `Una llista sola amb prou regidories per aprovar el que vulgui sense pactar amb ningú.
      És la diferència entre un mandat on cada punt es negocia i un on no cal.`,
    valor: (r) => r.m,
    any: MANDAT,
    talls: [0.5],
    etiquetes: ["cap llista sola", "majoria absoluta"],
    colors: SI_O_NO,
    format: (v) => (v === 1 ? "amb majoria absoluta" : "sense majoria absoluta"),
  },
  {
    id: "guanyador",
    grup: "Qui governa",
    font: "Generalitat de Catalunya",
    titol: "On no governa la llista més votada",
    boto: "Pactes",
    peu: `Guanyar unes municipals no vol dir governar-les: l'alcaldia la vota el ple. Aquí es veu
      on el primer no mana, que és on el pacte va decidir més que els vots.`,
    valor: (r) => (r.w === null ? null : r.w === 1 ? 0 : 1),
    any: MANDAT,
    talls: [0.5],
    etiquetes: ["governa qui va guanyar", "governa un altre"],
    colors: SI_O_NO,
    format: (v) => (v === 1 ? "no governa la llista més votada" : "governa la llista més votada"),
  },
  {
    id: "canvi",
    grup: "Qui governa",
    font: "Generalitat de Catalunya",
    titol: "On ha canviat l'alcaldia a mig mandat",
    boto: "Canvis d'alcaldia",
    peu: `Una moció de censura, una dimissió o un relleu pactat. No diu què va passar, però diu
      on va passar alguna cosa.`,
    valor: (r) => r.k,
    any: MANDAT,
    talls: [0.5],
    etiquetes: ["la mateixa alcaldia", "hi ha canviat"],
    colors: SI_O_NO,
    format: (v) => (v === 1 ? "l'alcaldia ha canviat a mig mandat" : "la mateixa alcaldia tot el mandat"),
  },
  {
    id: "alternances",
    grup: "Com es vota",
    unitat: "canvis de força més votada",
    font: "Consorci AOC",
    titol: "Quantes vegades ha canviat qui guanya, des del 1979",
    boto: "Alternança des del 1979",
    peu: `Dotze eleccions. Zero vol dir que la mateixa força les ha guanyat totes; com més alt,
      més s'hi mou el vot. És la millor pista de si el 2027 està decidit o obert.`,
    valor: (r) => r.v,
    any: "1979-2023",
    talls: [0.5, 1.5, 2.5, 3.5],
    etiquetes: ["cap canvi", "1", "2", "3", "4 o més"],
    format: (v) => (v === 0 ? "sempre la mateixa força" : `${v} canvis de força més votada`),
  },
  {
    id: "participacio",
    grup: "Com es vota",
    unitat: "% del cens que va votar",
    font: "Generalitat de Catalunya",
    titol: "Quanta gent va anar a votar el 2023",
    boto: "Participació",
    peu: `Votants sobre el cens a les municipals del maig del 2023, amb les xifres oficials de la
      Generalitat. Als pobles petits sol ser altíssima i a les ciutats grans, molt més baixa: la
      taca gran, aquí, mesura sobretot la mida del municipi.`,
    valor: (r) => r.pt ?? null,
    any: "2023",
    format: pct1,
  },
  {
    /*
     * La primera xifra de diners que entra al mapa, i la que obliga a l'avís.
     * Aquí una taca gran i fosca pot ser un poble de dos-cents habitants amb
     * una obra pagada a terminis, i una de petita i clara, una ciutat de cent
     * mil. La xifra ja va per habitant, o sigui que no és el mapa qui compara
     * malament: és l'ull, que compta superfície. Per això el peu diu la mediana
     * i envia al comparador, que és on la comparació es fa amb la vara bona.
     */
    id: "deute",
    grup: "Què fa i què costa l'ajuntament",
    unitat: "€ per habitant",
    quan: "últim exercici liquidat",
    font: "Consorci AOC",
    titol: "Quant deu cada ajuntament per habitant",
    boto: "Deute per habitant",
    peu: `Deute viu a 31 de desembre de l'últim exercici liquidat, dividit pel padró. Quatre-cents
      municipis no en tenen gens. No és cap nota al govern: hi ha deute que és una escola pagada a
      terminis i n'hi ha que no.`,
    valor: (r) => r.d,
    format: (v) => `${milers(v)} €`,
  },
  {
    id: "aigua",
    grup: "Què fa i què costa l'ajuntament",
    unitat: "€/m³, consum de 12 m³ al mes",
    font: "Agència Catalana de l'Aigua",
    titol: "Què costa l'aigua a cada municipi",
    boto: "Preu de l'aigua",
    peu: `Preu del tram de subministrament per a un consum domèstic de 12 m³ al mes, segons
      l'Observatori del preu de l'aigua de l'ACA. És el tram comparable entre municipis: el cànon
      i el clavegueram no els fixa l'ajuntament i no hi entren.`,
    // Un zero no és un preu sinó un municipi sense tarifa publicada: la regla
    // és `preuAiguaComparable()`, la mateixa del rànquing i del comparador.
    valor: (r) => preuAiguaComparable(r.pa),
    any: (r) => (preuAiguaComparable(r.pa) === null ? null : r.paa ?? null),
    format: (v) => `${coma(v, 2)} €/m³`,
  },
  {
    id: "estrangera",
    grup: "Qui hi viu",
    unitat: "% de la població",
    quan: "darrer cens publicat",
    font: "Idescat, a partir de l'INE",
    titol: "Quanta gent hi viu amb nacionalitat estrangera",
    boto: "Població estrangera",
    peu: `Persones sense nacionalitat espanyola sobre el total de població censada, segons el Cens
      de població de l'INE que publica l'Idescat. No és el mateix que haver nascut fora: qui fa
      anys que hi viu sovint ja té la nacionalitat. I no ho decideix cap ajuntament.`,
    valor: (r) => r.pe ?? null,
    format: pct1,
  },
  {
    id: "dones",
    grup: "Qui governa",
    unitat: "% de les regidories",
    font: "Generalitat de Catalunya",
    titol: "Quantes dones hi ha al ple",
    boto: "Dones al ple",
    peu: `Percentatge de regidories ocupades per dones. La llei obliga a llistes paritàries des del
      2007, però qui acaba entrant depèn de l'ordre i dels escons.`,
    valor: (r) => r.f,
    any: MANDAT,
    format: pct,
  },
  {
    id: "transparencia",
    grup: "Què fa i què costa l'ajuntament",
    unitat: "% d'apartats publicats",
    quan: "darrer mesurament",
    font: "Consorci AOC",
    titol: "Què publica cada ajuntament",
    boto: "Transparència",
    peu: `Percentatge dels apartats del portal de transparència que l'ajuntament té publicats,
      segons el mesurament de l'AOC. No mesura la qualitat del que hi ha, només que hi sigui.`,
    valor: (r) => r.y,
    format: pct,
  },
  {
    /*
     * La segona xifra de diners, i la que menys decideix l'ajuntament de totes.
     * Un ple no fixa quant guanya la gent que hi viu: fixa quines taxes cobra i
     * a qui les bonifica. Va al mapa igualment perquè és el context en què es
     * governa —el mateix pressupost per habitant no vol dir el mateix a Sant
     * Cugat que a la Franja— i perquè és l'única capa que explica per què moltes
     * de les altres surten com surten.
     *
     * L'INE tapa per secret estadístic la renda dels municipis més petits: un
     * municipi sense xifra no és un municipi sense renda, i per això el gris de
     * «sense dada» va ratllat i no pintat d'un to de la rampa.
     */
    id: "renda",
    grup: "Qui hi viu",
    unitat: "€ per persona i any",
    font: "INE, Atlas de renda de les llars",
    titol: "Quants diners entren a les cases",
    boto: "Renda per persona",
    peu: `Renda neta mitjana per persona i any, de l'Atlas de distribución de renta de los hogares
      de l'INE. És el que queda a la llar després d'impostos i cotitzacions, repartit entre tots els
      seus membres. No ho decideix cap ajuntament: depèn de qui hi viu i de què hi treballa.`,
    valor: (r) => r.rn ?? null,
    any: (r) => r.ra ?? null,
    format: (v) => `${milers(v)} €`,
  },
  {
    /*
     * «Sense dedicació» amb import no és un sou: són assistències a plens i
     * indemnitzacions. Comptar-les com a sou faria semblar que hi ha alcaldies
     * que cobren cent euros l'any per fer d'alcalde, i el que passa és que no en
     * cobren cap. Qui ho decideix és `souAlcaldia()` a `els947.ts`, que
     * escriu `sa` només quan J22 ho marca com a sou, i la resta arriba aquí com
     * a `null`, que és «sense dada». Mentre J22 no s'hagi passat, la capa no té
     * dada enlloc i el filtre de més avall la treu del mapa sencera: ni botó,
     * ni llegenda, ni taca grisa. **Un botó que pinta els 947 de gris és pitjor
     * que un botó que no hi és**, perquè el lector no pot saber si el que falla
     * és la dada o el mapa.
     */
    id: "sou-alcaldia",
    grup: "Què fa i què costa l'ajuntament",
    unitat: "€ l'any",
    quan: "darrer inventari publicat",
    font: "Ministeri de Funció Pública",
    titol: "Quant cobra l'alcaldia",
    boto: "Sou de l'alcaldia",
    peu: `El que percep l'alcaldia en un any, segons l'Inventari de retribucions dels membres de les
      corporacions locals que publica el Ministeri per a la Transformació Digital i de la Funció
      Pública. Només hi compten les dedicacions exclusives i parcials: les assistències a plens no
      són un sou i aquí no hi surten. Un poble petit sense dedicació no és un poble on l'alcaldia
      cobri poc: és un on no cobra.`,
    valor: (r) => r.sa ?? null,
    format: (v) => `${milers(v)} €`,
  },
  ...CAPES_NOVES,
];

/**
 * El color de cada capa de xifres, pel que mesura.
 *
 * Totes les capes d'escala anaven amb la mateixa rampa coral, i el mapa deia
 * «més o menys» sense dir de què: la mateixa taca fosca era deute a una capa
 * i participació a la següent. Ara cada tema té el seu to —l'aigua en blaus,
 * les dones al ple en liles, els diners en coral— i la rampa de cinc graons es
 * fa amb `rampaDe()`, la mateixa que pinta els vots de cada partit, en clar i
 * en fosc. Les capes de categories («qui mana») ja porten els colors de cada
 * força i les de «sí o no» el parell de `SI_O_NO`, i no es toquen.
 *
 * Tres tons han canviat després de passar les rampes pel validador de paletes
 * (diferència de lluminositat perceptual entre graons veïns, en clar i en
 * fosc):
 *
 * - **La renda ja no és verda.** Una rampa verda per als diners que entren a
 *   les cases, al costat de la coral del deute, deia «verd = bé, vermell =
 *   malament», que és justament el color de veredicte que el lloc no fa
 *   servir. Ara és gerd, un to que no vol dir res.
 * - **Participació i transparència** eren el mateix turquesa saturat
 *   (#1C8C8C i #1F9E9E), i a aquella saturació els graons segon, tercer i
 *   quart quedaven a menys de 0,06 de lluminositat l'un de l'altre: tres
 *   colors que l'ull llegeix com un de sol. Amb la mateixa família de to i
 *   menys saturació els cinc graons se separen, i cada capa té el seu.
 */
const TO_DE_CAPA: Readonly<Record<string, string>> = {
  aigua: "#2F6FD6",         // blau: l'aigua
  dones: "#7C5CC4",         // lila: dones al ple
  renda: "#B04A7A",         // gerd: renda (no verd, que diria «bé»)
  participacio: "#2B8C8C",  // verd-blau: participació
  estrangera: "#C28A1E",    // ocre: població de nacionalitat estrangera
  transparencia: "#2A7F86", // blau petroli: transparència
  alternances: "#5B6B8A",   // gris blau: alternança des del 1979
  deute: "#E2735A",         // coral: els diners, com fins ara
  "sou-alcaldia": "#C9932A",// daurat: el sou de l'alcaldia
  // Les capes noves. Cap verd ni cap vermell, pel mateix motiu que la renda:
  // un to que no vol dir res més que «aquesta capa».
  "veins-voten": "#4A6FA5",        // blau acer: qui pot votar
  fragmentacio: "#6B5B95",         // violeta gris: com de repartit és el ple
  volatilitat: "#8C6D46",          // bru: quant es mou el ple
  "vot-perdut": "#5E7A8A",         // pissarra: el vot que no arriba al ple
  "ultima-regidoria": "#7A5C8C",   // pruna: els vots de l'última regidoria
  "forca-alcaldia": "#56708C",     // blau gris: anys de la mateixa força
  "una-oferta": "#A86B3C",         // coure: licitacions amb una sola oferta
  "pla-urbanistic": "#7D6E57",     // terra: l'antiguitat del pla
  "pisos-turistics": "#D08A3C",    // taronja: pisos turístics
  lloguer: "#9C4F6E",              // vi: el lloguer
  "lloguer-canvi": "#8E5A7A",      // malva: com ha canviat el lloguer
  "habitatge-protegit": "#4F7C9E", // blau mitjà: habitatge protegit
};
for (const capa of CAPES) {
  const to = TO_DE_CAPA[capa.id];
  if (!to || capa.colors) continue;
  const rampa = rampaDe(to);
  capa.colors = rampa.clar;
  capa.colorsFosc = rampa.fosc;
}

/**
 * Una capa per partit: on es vota més cadascun.
 *
 * «Qui mana» diu de qui és l'alcaldia i prou, i una alcaldia és el final d'un
 * pacte, no la mesura del vot: el PSC en té 125 i treu vots a 615 municipis.
 * Aquestes capes pinten el pes dels vots de cada marca a cada municipi, en
 * cinc quintils del seu propi color, i on no es va presentar hi va el ratllat
 * de «sense dada», que aquí es diu pel seu nom: «no s'hi va presentar».
 *
 * Els talls es fan per quantils sobre els municipis on la marca es va
 * presentar, i per això no es poden comparar entre partits: el cinquè de dalt
 * d'ERC comença al 62 % i el de Vox al 8,7 %. Cada capa és la geografia d'una
 * força, no una taula de lliga.
 *
 * Només hi ha capa per a les marques que tenen pàgina —les que van treure
 * alguna regidoria o tenen alguna alcaldia—, i van ordenades per quants
 * municipis les van poder votar, que és el mateix ordre en què el lector les
 * buscarà.
 */
function capesPartits(vots: VotsPartit): Capa[] {
  return MARQUES.filter((b) => {
    const seus = vots[b.id];
    return seus !== undefined && Object.values(seus).some((m) => m.regidories > 0 || m.alcaldia);
  })
    .sort((a, b) => Object.keys(vots[b.id]!).length - Object.keys(vots[a.id]!).length)
    .map((b) => {
      const seus = vots[b.id]!;
      const sigles = siglesDe(b.id);
      const rampa = rampaDe(colorDe(b.id));
      return {
        id: `vots-${b.id}`,
        grup: "On es vota més cada partit",
        unitat: "% dels vots a candidatures",
        font: "Generalitat de Catalunya",
        titol: `On es vota més ${sigles}`,
        boto: sigles,
        clau: `Vot a ${sigles}`,
        peu: `Vots a les llistes ${de(sigles)} sobre els vots a candidatures de cada municipi, a les
          municipals del 2023. Els talls són quintils dels municipis on es va presentar: cada color
          n'és un cinquè, i el de dalt no vol dir «molt» sinó «la cinquena part on més pesa». On no
          s'hi va presentar, el municipi va ratllat.`,
        valor: (r) => seus[r.s]?.pct ?? null,
        any: "2023",
        format: pct1,
        colors: rampa.clar,
        colorsFosc: rampa.fosc,
        senseDada: "no s'hi va presentar",
        etiquetesDe: etiquetesPct,
        cobertura: (n, total, mig) =>
          `S'hi va presentar a ${n} dels ${total} municipis. Al municipi del mig hi va treure el ${mig}.`,
        enllac: { href: `../partit/${b.id}/`, text: `La pàgina ${de(sigles)}: alcaldies, regidories i des del 1979` },
      };
    });
}

/**
 * El que l'etiqueta d'un municipi diu a totes les capes.
 *
 * Els habitants, perquè tot el mapa es llegeix contra la mida —una taca gran
 * i fosca pot ser un poble de dos-cents habitants—; la comarca, per situar
 * un nom que no es coneix; i l'alcaldia amb les sigles de la seva llista,
 * que és el que el lector pregunta primer d'un poble. Un municipi sense
 * alcaldia coneguda no en diu res, que és millor que dir «—».
 */
function extresFixos(r: Els947Row): { etq: string; valor: string }[] {
  const extres = [
    { etq: "habitants", valor: milers(r.p) },
    { etq: "comarca", valor: r.c },
  ];
  if (r.a) extres.push({ etq: "alcaldia", valor: r.g ? `${r.a} (${r.g})` : r.a });
  return extres;
}

/**
 * El municipi del mig. Va al peu de cada capa contínua perquè la taca sola no
 * diu res: un mapa on tot Catalunya és fosc i un on tot és clar es pinten
 * exactament igual si els talls es fan per quantils, que és el que fem.
 */
const mediana = (valors: readonly number[]): number | null => {
  if (valors.length === 0) return null;
  const o = [...valors].sort((a, b) => a - b);
  const mig = Math.floor(o.length / 2);
  return o.length % 2 === 1 ? o[mig]! : (o[mig - 1]! + o[mig]!) / 2;
};

/**
 * Les etiquetes d'una capa de xifres, una per graó, escrites com a intervals.
 *
 * Abans cada tall deia «81 € o més» i el graó del mig i el de dalt deien el
 * mateix tipus de frase: «81 € o més», «377 € o més». Per saber on cau un
 * color calia restar. Ara cada graó diu d'on a on va —«de 81 € a 377 €»— i
 * només els dos extrems queden oberts, que són els que han de dir «menys de»
 * i «o més». És la mateixa regla que `etiquetesPct()` aplica a les capes de
 * partit, amb el format de cada capa (euros, metres cúbics, tants per cent).
 */
function etiquetesInterval(talls: readonly number[], format: (v: number) => string): string[] {
  if (talls.length === 0) return [];
  const mig = talls.slice(0, -1).map((t, k) => `de ${format(t)} a ${format(talls[k + 1]!)}`);
  return [`menys de ${format(talls[0]!)}`, ...mig, `${format(talls[talls.length - 1]!)} o més`];
}

/**
 * Els colors de la rampa que fa servir una capa amb menys graons que colors.
 *
 * Una rampa té cinc colors, però una capa per quantils no sempre té cinc
 * graons: el deute per habitant té quatre-cents municipis a zero i els talls
 * repetits es fonen, de manera que queden tres graons. Abans aquests tres
 * agafaven els tres primers colors, i el graó de dalt —«377 € o més»— es
 * pintava amb el coral mitjà, no amb el fosc: el mapa del deute semblava pàl·lid
 * i el valor alt no cridava. Ara els graons es reparteixen per tota la rampa
 * (el primer, el del mig i l'últim, si n'hi ha tres), i el de dalt sempre és el
 * color més fort. Una capa de categories té tants colors com graons i no es
 * toca.
 */
export function colorsDelsGraons(colors: readonly string[], graons: number): string[] {
  if (graons >= colors.length || graons < 1) return [...colors];
  if (graons === 1) return [colors[Math.floor((colors.length - 1) / 2)]!];
  return Array.from({ length: graons }, (_, k) => colors[Math.round((k * (colors.length - 1)) / (graons - 1))]!);
}

/**
 * De quan és la dada, dit una sola vegada per a tota la capa, per a la clau.
 *
 * Si la capa té un any per a tothom, és aquell. Si cada municipi porta el seu,
 * la clau diu de quin a quin («2021-2023») o l'únic que hi ha. Si la capa no
 * en té cap, diu el `quan` («últim exercici liquidat»), que és la veritat, en
 * lloc d'inventar-ne un. Sense cap de les tres coses, no en diu res.
 */
function anyDeLaClau(capa: Capa, anys: readonly string[] | null): string | null {
  if (typeof capa.any === "string") return capa.any;
  if (anys && anys.length > 0) {
    const nums = anys.map(Number).filter((n) => Number.isFinite(n));
    if (nums.length === 0) return anys[0]!;
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    return min === max ? String(min) : `${min}-${max}`;
  }
  return capa.quan ?? null;
}

/**
 * Fins on pot créixer la clau dins del mar sense trepitjar cap municipi.
 *
 * Calculat recorrent els vèrtexs dels 947 camins i del contorn: per a cada
 * amplada de caixa ancorada al racó de baix a la dreta (1592, 1592), l'alçada
 * màxima que queda lliure amb deu unitats de marge. La costa va en diagonal, i
 * per això una caixa estreta pot ser alta i una d'ampla ha de ser baixa. Un
 * test torna a fer el càlcul amb la geometria del repositori, de manera que si
 * algun dia canvia el traçat, el test ho diu abans que la clau tapi la costa.
 */
const FORAT_DEL_MAR: ReadonlyArray<readonly [ample: number, alt: number]> = [
  [470, 648], [514, 625], [560, 570], [600, 519], [650, 493], [944, 419],
];

/**
 * La llegenda dibuixada dins de l'SVG, al racó de mar.
 *
 * El lloc no és arbitrari. Amb el «viewBox» de 1600 × 1600 que porta la
 * geometria, el buit gran que deixa Catalunya és el de baix a la dreta, que és
 * el Mediterrani: és el que no toca cap municipi en tot el traçat i és on la
 * posa qualsevol mapa de tota la vida (vegeu `FORAT_DEL_MAR`).
 *
 * Porta, sota el títol, **la unitat, l'any i la font**. És la clau que viatja
 * amb una captura —la llista d'HTML no hi va— i una captura amb una taca de
 * colors i quatre xifres, sense dir de què ni de quan ni d'on, és una dada que
 * ningú pot comprovar. Amb una columna són dues línies («€ per habitant · últim
 * exercici liquidat» i «Font: Consorci AOC»); amb tres, una sola, perquè la
 * caixa ampla ja va justa d'alçada.
 *
 * Les mides van en unitats del «viewBox» i no en píxels: el dibuix s'escala
 * sencer, i per això a partir de nou entrades es passa a tres columnes en
 * comptes d'allargar-se cap amunt. La lletra més petita és de 26 unitats, que
 * és el que fa 13 px quan el mapa en fa 800 d'ample: per sota d'aquesta mida la
 * clau de dins no s'ensenya (vegeu el full d'estil) i mana la d'HTML, que
 * s'escala amb la lletra del lector.
 */
function clauSvg(
  i: number,
  titol: string,
  meta: readonly string[],
  entrades: readonly { classe: string; text: string }[],
): string {
  const columnes = entrades.length > 8 ? 3 : 1;
  const ampleCol = columnes === 1 ? 470 : 300;
  const files = Math.ceil(entrades.length / columnes);
  const alcadaFila = 56;
  const lletraMeta = 26;
  const alcadaMeta = 36;
  const linies = columnes === 1 ? meta.filter((m) => m !== "") : [meta.filter((m) => m !== "").join(" · ")];
  const alt = 18 + 46 + linies.length * alcadaMeta + files * alcadaFila + 16;
  // L'amplada que demana el text de la font, estimada a 0,56 em per lletra (la
  // Nunito Sans en negreta), i la que permet el forat del mar per a aquesta alçada.
  const perText = 44 + Math.max(0, ...linies.map((l) => Math.ceil(l.length * 0.56 * lletraMeta)));
  const permesa = Math.max(...FORAT_DEL_MAR.filter(([, a]) => a >= alt).map(([w]) => w), 44 + ampleCol * columnes);
  const ample = Math.min(permesa, Math.max(44 + ampleCol * columnes, perText));
  const x0 = 1592 - ample;
  const y0 = 1592 - alt;
  const lletra = columnes === 1 ? 28 : 26;
  const iniciFiles = y0 + 18 + 46 + linies.length * alcadaMeta;

  const textMeta = linies
    .map((l, k) => `<text class="meta" x="${x0 + 22}" y="${y0 + 46 + (k + 1) * alcadaMeta}" font-size="${lletraMeta}">${escape(l)}</text>`)
    .join("");
  const fileres = entrades
    .map((e, k) => {
      const columna = Math.floor(k / files);
      const fila = k % files;
      const x = x0 + 22 + columna * ampleCol;
      const y = iniciFiles + fila * alcadaFila;
      return (
        `<rect class="quadre ${e.classe}" x="${x}" y="${y}" width="36" height="36" rx="7"/>` +
        `<text x="${x + 50}" y="${y + 27}" font-size="${lletra}">${escape(e.text)}</text>`
      );
    })
    .join("");

  return `<g class="clau-mapa" data-clau="${i}" aria-hidden="true">
    <rect class="fons" x="${x0}" y="${y0}" width="${ample}" height="${alt}" rx="16"/>
    <text class="cap" x="${x0 + 22}" y="${y0 + 46}">${escape(titol)}</text>
    ${textMeta}${fileres}
  </g>`;
}

/**
 * El full d'estil és una funció de les capes que es publiquen i no una
 * constant: els colors de cada graó i la clau que s'ensenya van lligats a
 * l'índex de la capa, i l'índex és el de la llista **final** —després de
 * treure les capes sense dada i d'afegir-hi una per partit—, no el de la
 * taula escrita a mà.
 */
const css = (capes: readonly (Capa & { etiquetes: readonly string[] })[]): string => `
.mapa-marc{margin:var(--e4) 0 0;position:relative}
/* El rètol de cada municipi és l'etiqueta comuna de tots els gràfics
   —«.etiqueta-grafic», que ve amb GRAFICS_CSS dins de RADIOGRAFIA_CSS— i no
   una fitxa pròpia del mapa: una sola caixa per pàgina, que surt amb el
   ratolí, amb el dit i amb el tabulador, i que diu el nom i el que hi ha
   pintat a la capa d'ara. */
.mapa947{width:100%;height:auto;display:block;max-width:900px;margin:0 auto}
.mapa947 path{stroke:var(--ink);stroke-width:.7;stroke-linejoin:round;transition:fill .3s ease}
/* «focus-visible» i no «focus»: en tocar un municipi amb el dit el navegador hi
   posa el focus, i la vora gruixuda se sumava al ressalt de la fitxa. El
   tabulador sí que el marca, i a més hi dibuixa el ressalt (vegeu més avall). */
.mapa947 a:hover path,.mapa947 a:focus-visible path{stroke-width:3.5}
.mapa947 a:focus-visible{outline:none}
.mapa947 .contorn{fill:none;stroke:var(--ink);stroke-width:3.5}
/* La rampa va d'una sola tinta i amb la lluminància sempre baixant, perquè els
   graons se sàpiguen distingir també sense veure el color: amb la rampa de
   menta a coral de la marca, els tres primers quedaven indistingibles en
   deuteranòpia. Els quadrets de la llegenda són HTML i volen «background»; els
   camins són SVG i volen «fill». */
${capes.map((c, i) =>
  c.colors
    ? colorsDelsGraons(c.colors, c.etiquetes.length)
        .map(
          (col, k) =>
            `.mapa947[data-capa="${i}"] .g${k}{fill:${col}}.mapa-llegenda[data-capa="${i}"] .g${k}{background:${col}}`,
        )
        .join("")
    : "",
).join("")}
.mapa947 .g0{fill:#FBEFE6}.mapa947 .g1{fill:#F0BFA9}.mapa947 .g2{fill:#E2735A}
.mapa947 .g3{fill:#BE5138}.mapa947 .g4{fill:#8E2F1D}
.mapa-llegenda .g0{background:#FBEFE6}.mapa-llegenda .g1{background:#F0BFA9}.mapa-llegenda .g2{background:#E2735A}
.mapa-llegenda .g3{background:#BE5138}.mapa-llegenda .g4{background:#8E2F1D}
/* «Sense dada» no és un graó de l'escala, i per això no es pinta amb cap color.
   El gris de sorra d'abans (#DED8CB) tenia una lluminància de 0,69 sobre una
   rampa que va de 0,88 a 0,08: queia entre el primer graó i el segon, amb un
   contrast d'1,16 contra el segon, o sigui que **un municipi sense dada es
   llegia com un municipi amb poc**. Amb quatre-cents municipis sense deute i
   uns quants centenars sense renda, això no és un detall.
   La resposta és la de qualsevol atles: ratlles. La textura es distingeix del
   pla encara que no es distingeixi cap color, el to és blau-gris i no coral
   —o sigui de fora de la rampa— i la barreja de les ratlles amb el fons cau al
   mig de l'escala (0,41 en clar, 0,10 en fosc) i no a l'extrem clar, que és
   justament el que la feia semblar «poc». Les ratlles s'apliquen amb un patró
   d'SVG als camins i amb un degradat repetit als quadrets d'HTML, que són dues
   maneres de dibuixar la mateixa cosa. */
.mapa947,.mapa-llegenda,.clau-mapa{--nd-fons:#DDD9E6;--nd-ratlla:#7B7592}
.mapa947 .gnd{fill:url(#sense-dada)}
.mapa-llegenda .gnd{background:repeating-linear-gradient(45deg,
  var(--nd-ratlla) 0 3px,var(--nd-fons) 3px 6px)}
/* En fosc la rampa s'ha de girar sencera i no només enfosquir-la: sobre el
   paper fosc, el graó més clar és el que crida més, i amb la rampa de clar la
   taca que saltava a l'ull era la dels municipis sense deute. Aquí el que
   crida torna a ser el valor alt, la lluminància continua sent monòtona —cosa
   que és el que fa que els graons es distingeixin també sense veure el color—
   i el gris de «sense dada» surt de la família dels grisos i no de la de la
   rampa, perquè un forat no s'ha de poder confondre amb un valor. */
@media (prefers-color-scheme:dark){
  .mapa947 .g0{fill:#3B2119}.mapa947 .g1{fill:#6A3524}.mapa947 .g2{fill:#9C4A31}
  .mapa947 .g3{fill:#D06A47}.mapa947 .g4{fill:#F5A583}
  .mapa-llegenda .g0{background:#3B2119}.mapa-llegenda .g1{background:#6A3524}.mapa-llegenda .g2{background:#9C4A31}
  .mapa-llegenda .g3{background:#D06A47}.mapa-llegenda .g4{background:#F5A583}
  /* En fosc les ratlles s'aclareixen i el fons s'enfosqueix, que és el mateix
     canvi que fa la rampa: el patró de l'SVG llegeix aquestes dues variables i
     no cal tornar-lo a declarar. */
  .mapa947,.mapa-llegenda,.clau-mapa{--nd-fons:#2E2A3A;--nd-ratlla:#8A83A3}
}
/* Les rampes de cada partit, girades en fosc pel mateix motiu que la coral.
   Van després del bloc fosc de la coral i amb més especificitat que ella, que
   és el que fa que guanyin en els dos modes sense cap «important». */
@media (prefers-color-scheme:dark){${capes.map((c, i) =>
  c.colorsFosc
    ? colorsDelsGraons(c.colorsFosc, c.etiquetes.length)
        .map(
          (col, k) =>
            `.mapa947[data-capa="${i}"] .g${k}{fill:${col}}.mapa-llegenda[data-capa="${i}"] .g${k}{background:${col}}`,
        )
        .join("")
    : "",
).join("")}}
/* La llegenda escrita dins de l'SVG, i quan és la que es veu.
   Hi és perquè el mapa se'n va sol: quan algú en fa una captura o se'n desa el
   dibuix, la llista de colors que hi havia en HTML al costat no hi va, i el
   que queda és una taca de colors sense clau. Totes van escrites i se
   n'ensenya una amb el mateix «data-capa» que pinta els municipis, així que
   funciona abans que arrenqui cap JavaScript.
   Dues llegendes de la mateixa cosa a un pam l'una de l'altra fan dubtar de si
   volen dir el mateix, i per això se n'ensenya una sola: la de dins quan el
   mapa és prou gran perquè es llegeixi, i la d'HTML quan no. El tall ja no és
   una amplada de finestra sinó **l'amplada del mapa** («@container»): la
   lletra més petita de la clau de dins és de 26 unitats d'un llenç de 1.600, i
   fa 13 px just quan el mapa en fa 800. Amb el tall de finestra d'abans (761
   px) la clau de tres columnes sortia a 11,6 px. La llista d'HTML es queda al
   document per a qui llegeix amb veu —amb el mateix retall que
   «.nomes-lectors», i és per això que la de l'SVG va amb «aria-hidden»: la
   llegenda s'ha de sentir una sola vegada—. Un navegador que no entengui
   «@container» ensenya la d'HTML, que és la que es llegeix a qualsevol mida. */
.mapa-marc{container:mapa / inline-size}
.clau-mapa{display:none}
@container mapa (min-width:800px){
${capes.map((_, i) => `.mapa947[data-capa="${i}"] .clau-mapa[data-clau="${i}"]{display:block}`).join("")}
.mapa-clau{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);
  white-space:nowrap;margin:-1px;padding:0;border:0}
}
.clau-mapa .fons{fill:var(--paper-2);stroke:var(--ink);stroke-width:3}
/* «quadre» i no «mostra»: el full compartit dona a «.mostra» 14 px d'amplada i
   d'alçada, i el navegador aplica l'amplada de CSS també a un rectangle d'SVG.
   Amb aquell nom, els quadrets de 36 unitats sortien com a punts de 8 px. */
.clau-mapa rect.quadre{stroke:var(--ink);stroke-width:2.5}
.clau-mapa text{fill:var(--ink);font-family:var(--text);font-weight:800}
.clau-mapa .cap{font-family:var(--display);font-weight:900;font-size:32px}
.clau-mapa .meta{fill:var(--ink-suau);font-weight:700}
/* Els botons de les capes, a partir de 721 px. Fan de barra d'eines: el
   tabulador entra a cada filera una sola vegada i les fletxes es mouen per
   dins (vegeu el script), perquè vint-i-vuit parades de tabulador abans del
   mapa eren una paret per a qui no fa servir ratolí. */
.tries{display:flex;gap:8px;flex-wrap:wrap;margin:var(--e3) 0 0;padding:0}
.tries button{font:inherit;font-weight:800;font-size:.85rem;cursor:pointer;background:var(--paper-2);
  color:inherit;border:2.5px solid var(--ink);border-radius:var(--r-max);padding:9px 16px;min-height:44px;
  box-shadow:var(--ombra)}
.tries button[aria-pressed="true"]{background:var(--ink);color:var(--paper)}
/* La segona filera de botons, la dels partits, va sota la primera amb el seu
   rètol: quinze sigles barrejades amb «Deute per habitant» serien una paret
   on no es podria triar res. */
.tries-cap{margin:var(--e3) 0 0}
.tries-partits{margin-top:var(--e1)}
/* El desplegable de les capes, per sota de 721 px. Els vint-i-vuit botons
   ocupaven dues pantalles de mòbil abans del mapa: el lector havia de lliscar
   per veure què pintaven. Un «select» natiu ocupa una línia, el sistema
   l'obre a pantalla sencera amb els grups («optgroup») i és accessible sense fer
   res. La fletxa es dibuixa amb vores i «currentColor» perquè giri sola en
   fosc, i la lletra fa 16 px perquè l'iPhone no faci zoom en tocar-lo. */
.mapa-tria{display:none;margin:0 0 var(--e2)}
.mapa-tria label{display:block;font-weight:800;font-size:.95rem;margin:0 0 6px}
.mapa-tria-caixa{position:relative;color:var(--ink)}
.mapa-tria select{appearance:none;-webkit-appearance:none;width:100%;min-height:48px;margin:0;
  font:inherit;font-size:1rem;font-weight:800;color:var(--ink);background:var(--paper-2);
  border:2.5px solid var(--ink);border-radius:var(--r-s);padding:10px 46px 10px 14px;cursor:pointer}
.mapa-tria-caixa::after{content:"";position:absolute;right:19px;top:50%;width:9px;height:9px;
  border-right:3px solid currentColor;border-bottom:3px solid currentColor;
  transform:translateY(-70%) rotate(45deg);pointer-events:none}
/* La clau d'HTML: un rètol amb la unitat, l'any i la font, i a sota els graons.
   La lletra no baixa de 14 px: és la que es llegeix al mòbil, sola. Es diu
   «mapa-llegenda» i no «llegenda» perquè el full compartit ja té una
   «.llegenda li» d'un altre gràfic —graella de dues columnes, filet a sota de
   cada fila— que s'escolava aquí i posava una ratlla sota cada color. */
.mapa-clau{margin:var(--e3) 0 0}
.mapa-clau-cap{margin:0 0 var(--e1);font-size:.9rem;line-height:1.45;color:var(--ink-suau)}
.mapa-clau-cap b{color:var(--ink);font-weight:900;margin-right:.4em}
.mapa-llegenda{display:flex;gap:10px var(--e2);flex-wrap:wrap;align-items:center;margin:0;
  font-size:.9rem;font-weight:700;list-style:none;padding:0}
.mapa-llegenda li{display:flex;align-items:center;gap:7px}
.mapa-llegenda i{width:22px;height:22px;border:2px solid var(--ink);border-radius:5px;display:inline-block;flex:0 0 auto}
/* El llenç: el mapa i, a sobre, la fitxa que surt en tocar un municipi.
   «width:100%» és obligatori: al mòbil el marc és una columna flexible, i un
   fill amb marges automàtics s'encongeix fins a la mida del contingut; l'SVG,
   que fa el 100 % d'un pare sense amplada, queia als 300 px per defecte. */
.mapa-llenc{position:relative;width:100%;max-width:900px;margin:0 auto}
/* El ressalt del municipi triat o amb el focus: un camí a part, dibuixat a
   sobre de tots, perquè la vora gruixuda d'un camí de dins queda mig tapada
   pels veïns que es dibuixen després. Doble traç —paper a sota, tinta a
   sobre— perquè es vegi igual sobre un graó clar que sobre un de fosc. */
.mapa947 .mapa-ressalt{display:none;pointer-events:none}
.mapa947 .mapa-ressalt.actiu{display:inline}
.mapa947 .mapa-ressalt path{fill:none;stroke-linejoin:round;transition:none}
.mapa947 .mapa-ressalt-fons{stroke:var(--paper);stroke-width:11}
.mapa947 .mapa-ressalt-linia{stroke:var(--ink);stroke-width:5}
/* La fitxa del municipi tocat. Va al racó del mapa que menys tapa el
   municipi (el script tria entre els quatre), i és tan compacta com es pot
   sense baixar de 13 px de lletra ni de 44 px de zona de toc. */
.mapa-fitxa{position:absolute;left:8px;bottom:8px;z-index:2;width:min(290px,calc(100% - 16px));
  background:var(--paper-2);color:var(--ink);border:2.5px solid var(--ink);border-radius:var(--r-m);
  padding:10px 44px 2px 12px;box-shadow:var(--ombra)}
.mapa-fitxa[hidden]{display:none}
.mapa-fitxa p{margin:0}
.mapa-fitxa-nom{font-family:var(--display);font-weight:900;font-size:1.05rem;line-height:1.2}
.mapa-fitxa-dada{font-weight:800;font-size:.95rem;margin-top:2px;line-height:1.3}
.mapa-fitxa-seus,.mapa-fitxa-extres{font-size:.8125rem;line-height:1.35;color:var(--ink-suau);margin-top:2px}
.mapa-fitxa-enllac{display:inline-flex;align-items:center;min-height:44px;font-weight:800;font-size:.95rem;color:var(--ink);
  text-decoration:underline;text-decoration-color:var(--coral);text-decoration-thickness:2px;text-underline-offset:3px}
.mapa-fitxa-tanca{position:absolute;top:0;right:0;width:44px;height:44px;padding:0;border:0;background:none;
  color:inherit;font:inherit;font-size:1.5rem;line-height:1;cursor:pointer;border-radius:var(--r-s)}
/* El salt per sobre dels 947 enllaços del mapa: només es veu amb el focus. */
.mapa-salta{position:absolute;left:-9999px;top:auto}
.mapa-salta:focus{position:static;display:inline-block;margin:0 0 var(--e1);font-weight:800}
/* Al mòbil, el mapa a la primera pantalla. L'ordre de lectura és el de
   l'escriptori i l'ordre de pantalla es capgira: el desplegable i el títol de
   la capa, el mapa, la clau a tocar del mapa i, després, el peu i la
   cobertura, que es llegeixen amb el mapa ja vist. La portada es fa una mica
   més curta, que cada línia que s'hi estalvia és un tros de mapa que puja. */
@media (max-width:720px){
  .tries,.tries-cap{display:none}
  .mapa-tria{display:block;order:0}
  .mapa-marc{display:flex;flex-direction:column;margin-top:var(--e2)}
  .mapa-marc > h2{order:1;font-size:1.3rem;line-height:1.2;margin:0 0 var(--e2)}
  .mapa-salta,.mapa-llenc{order:2}
  .mapa-clau{order:3;margin-top:var(--e2)}
  #peu-capa{order:4;margin-top:var(--e3)}
  #cobertura-capa{order:5}
  #enllac-capa{order:6}
  .mapa-portada{padding-bottom:var(--e2)}
  .mapa-portada .entrada{font-size:1rem}
}
/* Per sota de 420 px la papereta del full compartit (84 px) i el bloc del
   títol (que demana 14rem) no hi caben de costat, i la papereta saltava a una
   línia sola: 120 px de pantalla abans del mapa. Aquí es queden de costat, amb
   la papereta més petita i el títol en dues línies. */
@media (max-width:420px){
  .mapa-portada .presenta{flex-wrap:nowrap;gap:var(--e2)}
  .mapa-portada .presenta .papereta{width:64px;height:75px}
}
@media (prefers-reduced-motion:reduce){.mapa947 path{transition:none}}
`;

/**
 * @param vots Els vots del 2023 de cada marca, municipi a municipi, de
 *   `loadVotsPartit()`. Sense ells el mapa surt com sempre, sense cap capa de
 *   partit: qui genera la vista prèvia no els necessita.
 */
export function renderMapaCatalunya(
  files: readonly Els947Row[],
  generatedAt: string,
  vots: VotsPartit = {},
): string {
  const perSlug = new Map(files.map((r) => [r.s, r]));
  const slugs = Object.keys(geometria.municipis).sort();

  /*
   * De quina mida és cada municipi, per poder dir a l'etiqueta «mediana dels
   * seus»: els seus són els del mateix tram de padró, amb els trams de la
   * LOREG ajuntats com els ajunta la resta del lloc (`buildPeerGroups`, que és
   * el que fa servir el comparador i la fitxa). Una cadena d'un caràcter per
   * municipi, com els graons: el tram no canvia amb la capa i s'escriu una
   * sola vegada. «x» és un municipi sense padró, que no és de cap tram.
   */
  const grups = buildPeerGroups(slugs.map((s, i) => ({ id: i, population: perSlug.get(s)?.p ?? null })));
  const clausTram = [...new Set([...grups.values()].map((g) => g.key))];
  const trams = slugs
    .map((_, i) => {
      const g = grups.get(i);
      return g ? clausTram.indexOf(g.key).toString(36) : "x";
    })
    .join("");

  // Cada capa es desa com una cadena d'un caràcter per municipi: amb 947
  // municipis i onze capes, són onze cadenes de 947 lletres. Canviar de capa és
  // reescriure una classe, no tornar a baixar el mapa. Les dels partits, quinze
  // més, van darrere de les de sempre i costen el mateix cadascuna.
  const totes = [...CAPES, ...capesPartits(vots)].map((capa) => {
    const valors = slugs
      .map((s) => (perSlug.has(s) ? capa.valor(perSlug.get(s)!) : null))
      .filter((v): v is number => v !== null);
    const talls = capa.talls ?? quintilsDe(valors);
    const graons = slugs
      .map((s) => {
        const fila = perSlug.get(s);
        const v = fila ? capa.valor(fila) : null;
        // Un caràcter per municipi i no un número escrit: amb dotze famílies
        // els graons 10 i 11 ocupaven dues lletres i la cadena sortia amb 949
        // caràcters per a 947 municipis. A partir del desè, tot el mapa
        // quedava desplaçat: Lleida, que és del PSC, es pintava d'ERC. En base
        // 36 el graó sempre és una lletra i el mecanisme aguanta fins a 36
        // categories.
        return v === null ? "x" : graoDe(v, talls).toString(36);
      })
      .join("");
    // Un graó més que talls, i el primer és el de sota de tot. Sense talls hi
    // ha un sol graó, que és el que passa quan tots els municipis valen el
    // mateix: llavors la clau ha de dir la xifra i prou, no un interval.
    const etiquetes =
      capa.etiquetes ??
      (talls.length === 0
        ? [valors.length === 0 ? "sense dada" : capa.format(valors[0]!)]
        : capa.etiquetesDe
          ? capa.etiquetesDe(talls)
          : etiquetesInterval(talls, capa.format));
    const ambDada = graons.split("").filter((c) => c !== "x").length;
    // La mediana només val per a una xifra que es pugui ordenar. A «qui mana»
    // el valor és el número de la família a la taula i fer-ne la mediana
    // donaria una cosa que sembla una xifra i no vol dir res.
    const mig = capa.etiquetes ? null : mediana(valors);
    const migText = mig === null ? "" : capa.format(mig);
    /* La frase de cobertura es fa aquí i no al navegador, perquè la primera
       capa la porti escrita abans que arrenqui cap JavaScript i perquè cada
       capa la pugui dir a la seva manera: «tenen aquesta dada» no val per a
       un partit, que el que té és haver-se presentat. La mediana hi va al
       costat perquè els talls d'una capa contínua es fan per quantils, o sigui
       que el mapa sempre surt amb un cinquè de cada color: sense dir contra
       què es compara, una taca fosca no vol dir «molt». */
    const textCobertura = capa.cobertura
      ? capa.cobertura(ambDada, slugs.length, migText)
      : `${ambDada} dels ${slugs.length} municipis tenen aquesta dada.` +
        (migText ? ` El municipi del mig en té ${migText}.` : "");
    /*
     * El que diu l'etiqueta de cada municipi en aquesta capa: «62,3 %»,
     * «420 €», «amb majoria absoluta». Es formata aquí, una sola vegada i amb
     * les mateixes funcions que la clau, i el navegador només ho llegeix.
     *
     * No es guarda un text per municipi sinó un diccionari dels textos
     * diferents i, per municipi, l'índex al diccionari: a les capes de
     * categories hi ha dos o tres textos per a 947 municipis, i a les de
     * xifres els repetits també hi són. L'índex va en base 36 i separat per
     * barres, perquè pot passar de 36; el buit és «sense dada» i es diu com
     * la clau.
     */
    const paraules: string[] = [];
    const posicioDe = new Map<string, number>();
    const textos = slugs.map((s) => {
      const fila = perSlug.get(s);
      if (!fila) return null;
      const v = capa.valor(fila);
      return capa.text ? capa.text(fila, v) : v === null ? null : capa.format(v);
    });
    const indexs = textos
      .map((t) => {
        if (t === null) return "";
        let i = posicioDe.get(t);
        if (i === undefined) {
          i = paraules.length;
          paraules.push(t);
          posicioDe.set(t, i);
        }
        return i.toString(36);
      })
      .join("|");
    /*
     * La mediana dels de la seva mida, per tram i formatada com la clau.
     *
     * Va a l'etiqueta de cada municipi com a «mediana dels seus», que és el
     * mateix que diu la sèrie de la fitxa: el peu ja diu el municipi del mig
     * de tot el país, i contra els 947 un poble de dos-cents habitants no es
     * pot comparar. Només a les capes de xifres: a «qui mana» o a «majoria»
     * el valor és una categoria i no té mediana. Un tram on cap municipi té
     * la dada queda en buit, i el navegador no en diu res.
     */
    const medianes = capa.etiquetes
      ? null
      : clausTram.map((clau) => {
          const seus = slugs
            .map((s, i) => (grups.get(i)?.key === clau ? perSlug.get(s) : undefined))
            .map((fila) => (fila ? capa.valor(fila) : null))
            .filter((v): v is number => v !== null);
          const m = mediana(seus);
          return m === null ? "" : capa.format(m);
        });
    /*
     * L'any de la dada de cada municipi. Quan és el mateix per a tothom no
     * cal escriure'l 947 vegades: el navegador el posa a tots els que tenen
     * dada. Quan cada fila porta el seu, el diccionari i un caràcter per
     * municipi, com els graons; «x» és un municipi sense any.
     */
    const anys: string[] = [];
    let anyDe: string | null = null;
    if (typeof capa.any === "string") anys.push(capa.any);
    else if (capa.any !== undefined) {
      const anyDeLaFila = capa.any;
      anyDe = slugs
        .map((s) => {
          const fila = perSlug.get(s);
          const a = fila ? anyDeLaFila(fila) : null;
          if (a === null) return "x";
          let i = anys.indexOf(String(a));
          if (i === -1) {
            i = anys.length;
            anys.push(String(a));
          }
          return i.toString(36);
        })
        .join("");
    }
    return {
      ...capa,
      graons,
      etiquetes,
      ambDada,
      talls,
      mig: migText,
      textCobertura,
      senseDada: capa.senseDada ?? "sense dada",
      textos,
      paraules,
      indexs,
      medianes,
      anys: capa.any === undefined ? null : anys,
      anyDe,
      /*
       * El rètol de la clau, sota el títol: què mesura, de quan és i d'on surt.
       * Es fa aquí una sola vegada i el fan servir les dues claus —la de dins
       * del dibuix i la d'HTML— i el script, que el reescriu en canviar de capa.
       */
      meta: {
        mesura: [capa.unitat ?? "", anyDeLaClau(capa, capa.any === undefined ? null : anys) ?? ""]
          .filter((t) => t !== "")
          .join(" · "),
        font: `Font: ${capa.font}`,
      },
    };
  });

  /**
   * Una capa que no té la dada enlloc no es publica.
   *
   * Un botó que pinta els 947 municipis de gris no és una capa buida: és una
   * promesa trencada, i el lector no té manera de saber si el problema és que
   * la dada no hi és o que el mapa està espatllat. La primera es queda sempre,
   * perquè és la que dona el color d'entrada i perquè sense cap capa no hi
   * hauria ni llegenda ni títol.
   */
  const capes = totes.filter((c, i) => i === 0 || c.ambDada > 0);

  const primera = capes[0]!;
  /*
   * Cada municipi porta el nom a «data-nom», a «data-valor» el que hi ha
   * pintat a la primera capa i, a «data-extres», el que és veritat d'ell a
   * totes les capes: els habitants, la comarca i l'alcaldia amb les sigles.
   * És el contracte de l'etiqueta comuna (`atributsEtiqueta`, a grafics.ts),
   * i és el que fa que el mapa digui alguna cosa en passar-hi per sobre
   * abans que arrenqui el JavaScript de les capes. Quan una altra capa es
   * pinta, el script reescriu el «data-valor» dels 947 amb el text d'aquella
   * capa, i hi afegeix l'any i la mediana dels seus, que sí que canvien; els
   * extres fixos no els toca.
   *
   * Els extres fixos s'escriuen aquí i no al diccionari de les capes perquè
   * no canvien mai: són uns 70 kB —947 vegades «habitants», «comarca» i
   * «alcaldia»— que es paguen una sola vegada. L'any de la primera capa no
   * s'escriu als 947: el posa el script en arrencar, com a totes les altres,
   * i 947 còpies de «mandat 2023-2027» serien 30 kB per dir el mateix.
   *
   * Els atributs van a l'enllaç i no al camí perquè l'enllaç és el que rep el
   * focus: el tabulador hi arriba i l'etiqueta hi surt. El `<title>` diu
   * només el nom: és el rètol de qui no té script, i 947 frases senceres
   * serien 60 kB per dir dues vegades el mateix.
   */
  const camins = slugs
    .map((slug, i) => {
      const fila = perSlug.get(slug);
      const nom = fila?.n ?? slug;
      const g = primera.graons[i] === "x" ? "gnd" : `g${primera.graons[i]}`;
      const dada: DadaEtiqueta = {
        nom,
        valor: primera.textos[i] ?? primera.senseDada,
        extres: fila ? extresFixos(fila) : null,
      };
      return `<a href="/observatori/m/${escape(slug)}/"${atributsEtiqueta(dada)}><title>${escape(nom)}</title><path class="${g}" d="${geometria.municipis[slug]}"/></a>`;
    })
    .join("");

  /*
   * El botó porta el nom curt a la vista i el títol sencer per a qui llegeix
   * amb veu: «Participació» sol no diu de quina votació, i el títol sí. El
   * títol va dins del botó i amagat, i no com a «aria-label», perquè amb
   * l'atribut el nom accessible deixaria de contenir el text que es veu i qui
   * navega per veu no podria dir «Participació» per prémer-lo.
   */
  const boto = (c: (typeof capes)[number], i: number): string =>
    `<button type="button" data-capa="${i}" aria-pressed="${i === 0 ? "true" : "false"}">${escape(c.boto)}<span class="nomes-lectors">: ${escape(c.titol)}</span></button>`;
  // Les capes de partit van en una segona filera i es reconeixen per l'id;
  // l'índex del botó és el de la llista sencera, que és el que llegeix «pinta».
  const esPartit = (c: Capa): boolean => c.id.startsWith("vots-");
  const tries = capes.map((c, i) => (esPartit(c) ? "" : boto(c, i))).join("");
  const triesPartits = capes.map((c, i) => (esPartit(c) ? boto(c, i) : "")).join("");

  /*
   * El desplegable del mòbil: les mateixes capes, agrupades per la pregunta
   * que responen. Cada opció porta com a valor l'índex de la capa a la llista
   * sencera —el mateix que els botons—, i els grups surten en l'ordre en què
   * apareix la primera capa de cadascun, de manera que «Qui mana» continua
   * sent la primera opció. El text de l'opció és el nom curt del botó; el
   * títol llarg ja el diu l'encapçalament que hi ha just a sota.
   */
  const familiesDeCapes = [...new Set(capes.map((c) => c.grup))];
  const opcions = familiesDeCapes
    .map((grup) => {
      const seves = capes
        .map((c, i) => (c.grup === grup ? `<option value="${i}"${i === 0 ? " selected" : ""}>${escape(c.boto)}</option>` : ""))
        .join("");
      return `<optgroup label="${escape(grup)}">${seves}</optgroup>`;
    })
    .join("");

  /*
   * La descripció de la pàgina es fa de les capes que realment es publiquen.
   * Escrita a mà quedava desactualitzada cada cop que se n'afegia una, i
   * prometia al cercador capes que el mapa no acaba ensenyant quan la dada no
   * hi és —el mapa en treu el botó i la descripció es quedava dient-ho. No
   * s'hi enumeren totes: tretze capes són dues-centes lletres i el cercador
   * en talla la descripció a 158, de manera que el «on es vota més cada
   * partit» del final no arribava mai a sortir. Es diuen les tres primeres
   * i es compten les altres; les quinze sigles es diuen d'un cop.
   */
  const deSempre = capes.filter((c) => !esPartit(c));
  const primeres = deSempre.slice(0, 3).map((c) => c.boto.toLowerCase());
  const restants = deSempre.length - primeres.length;
  const llistaBotons =
    primeres.join(", ") +
    (restants > 0 ? ` i ${restants} ${restants === 1 ? "capa" : "capes"} més` : "") +
    (triesPartits ? ", i on es vota més cada partit" : "");
  const url = `${SITE}/observatori/mapa/`;
  const cap = capSeo({
    titol: `Mapa dels ${slugs.length} municipis`,
    descripcio: `Els ${slugs.length} municipis de Catalunya pintats per ${llistaBotons}. Cada un porta a la seva fitxa.`,
    url,
    imatge: imatgeOg(FITXER_OG.global("mapa")),
    jsonLd: [filAriadna([...ARREL_OBSERVATORI, { nom: `Mapa dels ${slugs.length} municipis`, url }])],
  });

  const claus = capes
    .map((c, i) =>
      clauSvg(
        i,
        c.clau ?? c.boto,
        [c.meta.mesura, c.meta.font],
        c.etiquetes
          .map((et, k) => ({ classe: `g${k}`, text: et }))
          .concat(c.ambDada < slugs.length ? [{ classe: "gnd", text: c.senseDada }] : []),
      ),
    )
    .join("");

  return `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${cap}
${tipografia("../")}
<style>${RADIOGRAFIA_CSS}${MASCOTA_CSS}${css(capes)}</style>
</head>
<body>
<a class="salta" href="#contingut">Ves al contingut</a>
${capcalera("../", "mapa")}
${cercador("../")}

<main id="contingut">
  <section class="portada mapa-portada">
    <div class="presenta">${papereta(110, "felic")}<div>
      <p class="micro">Tot Catalunya</p>
      <h1>El mapa dels 947</h1>
    </div></div>
    <p class="entrada">Tria què vols veure-hi pintat: hi ha coses que en una llista de 947 files no
    es veuen mai. Cada municipi porta a la seva fitxa.</p>
  </section>

  <div class="tries" id="tries" role="toolbar" aria-label="Què vols veure al mapa">${tries}</div>
  ${
    triesPartits
      ? `<p class="micro tries-cap" id="tries-partits-cap">On es vota més cada partit</p>
  <div class="tries tries-partits" id="tries-partits" role="toolbar" aria-labelledby="tries-partits-cap">${triesPartits}</div>`
      : ""
  }

  <div class="mapa-marc">
    <div class="mapa-tria">
      <label for="tria-capa">Què vols veure al mapa</label>
      <div class="mapa-tria-caixa"><select id="tria-capa">${opcions}</select></div>
    </div>
    <h2 id="titol-capa">${escape(primera.titol)}</h2>
    <p class="entrada-bloc" id="peu-capa">${primera.peu}</p>
    <div class="mapa-clau">
      <p class="mapa-clau-cap" id="clau-cap"><b>${escape(primera.clau ?? primera.boto)}</b> ${escape(
        [primera.meta.mesura, primera.meta.font].filter((t) => t !== "").join(" · "),
      )}</p>
      <ul class="mapa-llegenda" id="llegenda" data-capa="0">${primera.etiquetes
        .map((et, k) => `<li><i class="g${k}"></i>${escape(et)}</li>`)
        .join("")}${primera.ambDada < slugs.length ? `<li><i class="gnd"></i>${escape(primera.senseDada)}</li>` : ""}</ul>
    </div>
    <a class="mapa-salta" href="#cobertura-capa">Salta els ${slugs.length} municipis del mapa</a>
    <div class="mapa-llenc">
    <svg class="mapa947" data-capa="0" viewBox="${escape(geometria.viewBox)}" role="img" aria-labelledby="titol-capa">
      ${
        /* Les ratlles de «sense dada». El pas és de 5 unitats del llenç de 1.600:
           al mapa gran, que s'ensenya com a molt a 900 px, són 2,8 px de pas, i
           en un municipi de mida mediana —36 x 43 unitats— hi caben set o vuit
           ratlles, prou per veure que allò és una textura i no un color. Quan el
           mapa es fa petit i el pas baixa d'un píxel, les dues tintes es fonen en
           el blau-gris del mig de l'escala, que continua sense ser cap graó. */ ""
      }
      <defs><pattern id="sense-dada" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="5" height="5" fill="var(--nd-fons)"/>
        <rect width="2.4" height="5" fill="var(--nd-ratlla)"/>
      </pattern></defs>
      ${camins}
      ${geometria.contorn ? `<path class="contorn" d="${geometria.contorn}"/>` : ""}
      <g class="mapa-ressalt" aria-hidden="true"><path class="mapa-ressalt-fons" d="M0 0"/><path class="mapa-ressalt-linia" d="M0 0"/></g>
      ${claus}
    </svg>
    ${
      /* La fitxa del municipi tocat amb el dit. Al mòbil, tocar un municipi
         portava directament a la seva fitxa i l'etiqueta flotant no s'arribava
         a veure: no hi havia manera de mirar la xifra d'un poble sense sortir
         del mapa. Ara el primer toc obre aquesta fitxa —nom, xifra de la capa,
         d'on és— amb l'enllaç, i el segon toc al mateix municipi hi porta. El
         ratolí i el teclat continuen com sempre: l'etiqueta en passar-hi i
         l'enllaç en fer-hi clic. «aria-live» perquè, si qui toca fa servir un
         lector de pantalla, la fitxa es llegeixi en obrir-se. */ ""
    }
    <div class="mapa-fitxa" id="mapa-fitxa" hidden>
      <div aria-live="polite">
        <p class="mapa-fitxa-nom"></p>
        <p class="mapa-fitxa-dada"></p>
        <p class="mapa-fitxa-seus"></p>
        <p class="mapa-fitxa-extres"></p>
      </div>
      <a class="mapa-fitxa-enllac" href="../m/">La fitxa del municipi</a>
      <button type="button" class="mapa-fitxa-tanca" aria-label="Tanca la fitxa">×</button>
    </div>
    </div>
    <p class="nota" id="cobertura-capa" tabindex="-1">${escape(primera.textCobertura)}</p>
    <p class="nota" id="enllac-capa"${primera.enllac ? "" : " hidden"}><a href="${escape(
      primera.enllac?.href ?? "",
    )}">${escape(primera.enllac?.text ?? "")}</a></p>
  </div>

  <section class="bloc fonts">
    <h2>D'on surt el mapa</h2>
    <p class="nota">Límits municipals de les
    <a href="${escape(geometria.fontUrl)}" target="_blank" rel="noopener">Divisions administratives</a>
    de l'${escape(geometria.font.replace(/^Divisions administratives de l'/, ""))},
    sota <a href="${escape(geometria.llicenciaUrl)}" target="_blank" rel="noopener">${escape(geometria.llicencia)}</a>,
    amb dades actualitzades ${escape(dataEscrita(geometria.actualitzat) ? elDia(geometria.actualitzat) : `el ${geometria.actualitzat}`)}. Simplificats per pesar poc; per a
    qualsevol ús on la frontera exacta importi, cal anar a l'original.</p>
    <p class="nota"><b>Un mapa de municipis sobrerepresenta el buit.</b> El Pallars Sobirà hi ocupa
    molta més taca que el Barcelonès i hi viu una fracció de la gent. Val per a totes les capes i
    val el doble per a les de diners: una taca gran i fosca al mapa del deute pot ser un poble de
    dos-cents habitants, i una de petita i clara, una ciutat de cent mil. Per això sota cada capa hi
    ha quants municipis tenen la dada i quant en té el municipi del mig, i per això les
    comparacions serioses es fan al <a href="../comparador/">comparador</a>, que compara municipis
    de la mateixa mida.</p>
    ${
      capes.some((c) => c.id === "renda")
        ? `<p class="nota">La renda per persona surt de l'<a href="https://www.ine.es/dynt3/inebase/es/index.htm?padre=7132"
      target="_blank" rel="noopener">Atlas de distribución de renta de los hogares</a> de l'Institut
      Nacional d'Estadística. L'INE tapa per secret estadístic la renda dels municipis més petits:
      un municipi sense xifra no és un municipi sense renda, i per això surt ratllat i no pintat.</p>`
        : ""
    }
    ${
      capes.some((c) => c.id === "sou-alcaldia")
        ? `<p class="nota">El sou de l'alcaldia surt de l'Inventari de retribucions dels membres de
      les corporacions locals que publica el Ministeri per a la Transformació Digital i de la Funció
      Pública. Hi entren les dedicacions exclusives i parcials; les assistències a plens no són un
      sou i no hi compten.</p>`
        : ""
    }
    ${
      triesPartits
        ? `<p class="nota">Les capes de cada partit són els vots a les seves llistes sobre els vots a
      candidatures de cada municipi —sense els nuls, i amb els blancs a part—, a les municipals del
      28 de maig del 2023 (Generalitat de Catalunya, <code>ntc4-rnwr</code>). Les candidatures
      s'ajunten per l'agrupació electoral amb què es van presentar i, quan aquella no ho diu, per
      les sigles: és la mateixa regla que fa servir la pàgina de cada partit, i per això les dues
      diuen la mateixa xifra del mateix poble. Els talls són quintils dels municipis on cada marca
      es va presentar, o sigui que <b>no es poden comparar entre partits</b>: el cinquè de dalt d'un
      partit gran comença molt més amunt que el d'un de petit. On un partit no es va presentar, el
      municipi va ratllat, que no és un zero.</p>`
        : ""
    }
    <p class="nota">Els colors de les capes de xifres van d'una sola tinta i amb la lluminància
    sempre en el mateix sentit, perquè els graons es puguin distingir també sense veure el color, i
    es giren quan el navegador demana el mode fosc. Els talls es fan per quantils: cada color n'és
    un cinquè, sempre, i per això la lectura ha de ser «està a la cinquena part de dalt», mai
    «està molt». Els municipis <b>sense dada</b> no porten cap color de l'escala sinó ratlles:
    un forat no és un valor baix, i pintat amb el to més clar ho semblava.</p>
  </section>
</main>
${peu("../", generatedAt)}


<script>
var CAPES = ${JSON.stringify(
    capes.map((c, i) => ({
      t: c.titol,
      p: c.peu.replace(/\s+/g, " ").trim(),
      g: c.graons,
      e: c.etiquetes,
      n: c.ambDada,
      m: c.mig,
      x: c.senseDada,
      c: c.textCobertura,
      u: c.enllac ? [c.enllac.href, c.enllac.text] : null,
      /* El text de l'etiqueta de cada municipi: el diccionari i els índexs.
         La primera capa no els porta: ja són escrits als «data-valor» dels
         camins, i el script els llegeix d'allà en arrencar. */
      w: i === 0 ? null : c.paraules,
      k: i === 0 ? null : c.indexs,
      /* La mediana dels de la seva mida, una per tram, i l'any de la dada:
         el diccionari d'anys i, si cada municipi té el seu, un caràcter per
         municipi; sense el caràcter, l'únic any del diccionari és de tots. */
      d: c.medianes,
      a: c.anys,
      y: c.anyDe,
      /* El rètol de la clau d'HTML: el nom curt i què mesura, de quan i d'on. */
      b: c.clau ?? c.boto,
      q: [c.meta.mesura, c.meta.font].filter((t) => t !== "").join(" · "),
    })),
  )};
/* El tram de mida de cada municipi, per trobar la seva mediana a cada capa. */
var TRAMS = ${JSON.stringify(trams)};
var camins = document.querySelectorAll('.mapa947 a path');
var enllacos = document.querySelectorAll('.mapa947 a');
var enllac = document.getElementById('enllac-capa');
/* El que diu cada municipi a la primera capa, tal com ha arribat escrit. */
var inicials = [];
for (var e = 0; e < enllacos.length; e++) inicials.push(enllacos[e].getAttribute('data-valor'));
function pinta(i) {
  var c = CAPES[i];
  var claus = c.k === null ? null : c.k.split('|');
  for (var n = 0; n < camins.length; n++) {
    var g = c.g.charAt(n);
    camins[n].setAttribute('class', g === 'x' ? 'gnd' : 'g' + parseInt(g, 36));
    /* L'etiqueta comuna llegeix «data-valor» en el moment de sortir: canviar
       de capa és també canviar què diu cada municipi. */
    var text = claus === null ? inicials[n] : claus[n] === '' ? c.x : c.w[parseInt(claus[n], 36)];
    enllacos[n].setAttribute('data-valor', text);
    /* L'any i la mediana dels seus van amb la capa, no amb el municipi: es
       reescriuen aquí i els extres fixos —habitants, comarca, alcaldia— es
       queden com han arribat. Un municipi sense dada no en diu cap dels dos. */
    var teDada = text !== c.x;
    var any = !teDada || c.a === null ? null : c.y === null ? c.a[0] : c.y.charAt(n) === 'x' ? null : c.a[parseInt(c.y.charAt(n), 36)];
    var tram = TRAMS.charAt(n);
    var mediana = !teDada || c.d === null || tram === 'x' ? '' : c.d[parseInt(tram, 36)];
    if (any) enllacos[n].setAttribute('data-any', any); else enllacos[n].removeAttribute('data-any');
    if (mediana) enllacos[n].setAttribute('data-mediana', mediana); else enllacos[n].removeAttribute('data-mediana');
  }
  document.querySelector('.mapa947').setAttribute('data-capa', i);
  document.getElementById('llegenda').setAttribute('data-capa', i);
  document.getElementById('titol-capa').textContent = c.t;
  document.getElementById('peu-capa').textContent = c.p;
  document.getElementById('llegenda').innerHTML =
    c.e.map(function (et, k) { return '<li><i class="g' + k + '"></i>' + esc(et) + '</li>'; }).join('') +
    (c.n < camins.length ? '<li><i class="gnd"></i>' + esc(c.x) + '</li>' : '');
  /* El rètol de la clau: el nom curt, la unitat, l'any i la font. */
  document.getElementById('clau-cap').innerHTML = '<b>' + esc(c.b) + '</b> ' + esc(c.q);
  document.getElementById('cobertura-capa').textContent = c.c;
  /* L'enllaç a la pàgina del partit, només a les capes que en tenen. */
  if (c.u) { enllac.querySelector('a').href = c.u[0]; enllac.querySelector('a').textContent = c.u[1]; }
  enllac.hidden = !c.u;
  /* Els botons van en dues fileres i l'índex que mana és el que porten escrit,
     no el lloc que ocupen: el primer botó de la segona filera és la capa dotze. */
  var botons = document.querySelectorAll('.tries button');
  for (var b = 0; b < botons.length; b++) botons[b].setAttribute('aria-pressed', Number(botons[b].getAttribute('data-capa')) === i ? 'true' : 'false');
  for (var f = 0; f < fileres.length; f++) {
    var premut = fileres[f].querySelector('button[aria-pressed="true"]');
    if (premut) tabulable(fileres[f], premut);
  }
  /* El desplegable del mòbil diu la mateixa capa que els botons. */
  if (tria) tria.value = String(i);
  /* Si hi ha una fitxa oberta, passa a dir la xifra de la capa nova. */
  if (triat) { omple(triat); situa(triat); }
}
/* Els textos de les capes arriben del servidor i no porten cap etiqueta, però
   van a «innerHTML»: un «&» o un «<» en un nom de partit no ha de trencar res. */
function esc(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
/* El rètol de cada municipi ja no és d'aquest script: és l'etiqueta comuna
   de tots els gràfics (GRAFICS_JS, just a sota), que llegeix el «data-nom» i
   el «data-valor» de l'enllaç que «pinta» acaba d'escriure. */

/* Les fileres de botons fan de barra d'eines: una sola parada de tabulador per
   filera —el botó de la capa pintada, o el primer— i les fletxes, Inici i Fi
   es mouen per dins; Retorn o l'espai pinten la capa. Es fa aquí i no a l'HTML
   perquè sense script els botons no pinten res. */
function tabulable(filera, boto) {
  var bs = filera.querySelectorAll('button');
  for (var k = 0; k < bs.length; k++) bs[k].tabIndex = bs[k] === boto ? 0 : -1;
}
var fileres = document.querySelectorAll('.tries');
for (var t = 0; t < fileres.length; t++) {
  tabulable(fileres[t], fileres[t].querySelector('button'));
  fileres[t].addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (b) pinta(Number(b.dataset.capa));
  });
  fileres[t].addEventListener('keydown', function (e) {
    var bs = Array.prototype.slice.call(this.querySelectorAll('button'));
    var ara = bs.indexOf(document.activeElement);
    if (ara === -1) return;
    var nou = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (ara + 1) % bs.length
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (ara - 1 + bs.length) % bs.length
      : e.key === 'Home' ? 0 : e.key === 'End' ? bs.length - 1 : -1;
    if (nou === -1) return;
    e.preventDefault();
    tabulable(this, bs[nou]);
    bs[nou].focus();
  });
}
var tria = document.getElementById('tria-capa');
if (tria) tria.addEventListener('change', function () { pinta(Number(tria.value)); });

/* La fitxa del municipi tocat, i el ressalt.
   Amb el dit, el primer toc a un municipi obre la fitxa en lloc de seguir
   l'enllaç; el segon toc al mateix municipi sí que el segueix. Es reconeix el
   dit pel «pointerdown» i no per la mida de la pantalla: una tauleta gran és
   tàctil i un portàtil estret no. El ratolí i el teclat no canvien: l'etiqueta
   comuna en passar-hi o en arribar-hi amb el tabulador, i l'enllaç en fer-hi
   clic o prémer Retorn. Mentre el dit mana, el focus que el navegador posa a
   l'enllaç tocat no arriba a l'etiqueta comuna, que sortiria sota el dit i
   repetiria el que diu la fitxa. */
var svg = document.querySelector('.mapa947');
var ressalt = svg.querySelector('.mapa-ressalt');
var fitxa = document.getElementById('mapa-fitxa');
var triat = null;
var tactil = false;
function ressalta(a) {
  if (!a) { ressalt.classList.remove('actiu'); return; }
  var d = a.querySelector('path').getAttribute('d');
  var ps = ressalt.querySelectorAll('path');
  for (var k = 0; k < ps.length; k++) ps[k].setAttribute('d', d);
  ressalt.classList.add('actiu');
}
function omple(a) {
  var nom = a.getAttribute('data-nom');
  var any = a.getAttribute('data-any');
  var mediana = a.getAttribute('data-mediana');
  var dades = {};
  (a.getAttribute('data-extres') || '').split('‖').forEach(function (linia) {
    var parts = linia.split('¦');
    if (parts.length > 1) dades[parts[0]] = parts.slice(1).join('¦');
  });
  fitxa.querySelector('.mapa-fitxa-nom').textContent = nom;
  fitxa.querySelector('.mapa-fitxa-dada').textContent = (any ? any + ' · ' : '') + a.getAttribute('data-valor');
  var seus = fitxa.querySelector('.mapa-fitxa-seus');
  seus.textContent = mediana ? 'mediana dels municipis de la seva mida: ' + mediana : '';
  seus.hidden = !mediana;
  fitxa.querySelector('.mapa-fitxa-extres').textContent =
    [dades.comarca, dades.habitants ? dades.habitants + ' habitants' : ''].filter(Boolean).join(' · ');
  var slug = a.getAttribute('href').split('/m/')[1].split('/')[0];
  var enllacFitxa = fitxa.querySelector('.mapa-fitxa-enllac');
  enllacFitxa.href = '../m/' + slug + '/';
  enllacFitxa.textContent = 'Obre la fitxa de ' + nom;
}
function obre(a) {
  triat = a;
  omple(a);
  ressalta(a);
  fitxa.hidden = false;
  situa(a);
}
/* Al racó del mapa que menys tapa el municipi tocat. Es proven els quatre i
   es queda el que trepitja menys superfície del municipi; la clau de dins del
   dibuix, quan es veu, també compta, però deu vegades menys. A igualtat guanya
   el de baix a la dreta, que és el mar. */
function situa(a) {
  var m = svg.getBoundingClientRect();
  var r = a.querySelector('path').getBoundingClientRect();
  var clau = svg.querySelector('.clau-mapa[data-clau="' + svg.getAttribute('data-capa') + '"]');
  var c = clau ? clau.getBoundingClientRect() : null;
  var w = fitxa.offsetWidth, h = fitxa.offsetHeight, marge = 8;
  function tros(x, y, o) {
    if (!o || !o.width) return 0;
    var dx = Math.min(x + w, o.right - m.left) - Math.max(x, o.left - m.left);
    var dy = Math.min(y + h, o.bottom - m.top) - Math.max(y, o.top - m.top);
    return dx > 0 && dy > 0 ? dx * dy : 0;
  }
  var racons = [[m.width - w - marge, m.height - h - marge], [marge, marge], [m.width - w - marge, marge], [marge, m.height - h - marge]];
  var millor = racons[0], menys = Infinity;
  for (var k = 0; k < racons.length; k++) {
    var cost = 10 * tros(racons[k][0], racons[k][1], r) + tros(racons[k][0], racons[k][1], c);
    if (cost < menys) { menys = cost; millor = racons[k]; }
  }
  fitxa.style.left = Math.max(marge, millor[0]) + 'px';
  fitxa.style.top = Math.max(marge, millor[1]) + 'px';
  fitxa.style.bottom = 'auto';
}
function tanca() {
  triat = null;
  fitxa.hidden = true;
  ressalta(null);
}
svg.addEventListener('pointerdown', function (e) { tactil = e.pointerType === 'touch'; });
document.addEventListener('keydown', function (e) {
  tactil = false;
  if (e.key === 'Escape' && triat) tanca();
}, true);
svg.addEventListener('focusin', function (e) {
  var a = e.target.closest ? e.target.closest('a') : null;
  if (!a) return;
  if (tactil) { e.stopPropagation(); return; }
  if (!triat) ressalta(a);
});
svg.addEventListener('focusout', function () { if (!triat) ressalta(null); });
svg.addEventListener('click', function (e) {
  if (!tactil) return;
  e.stopPropagation();
  var a = e.target.closest ? e.target.closest('a') : null;
  if (!a) { tanca(); return; }
  if (a === triat) return;
  e.preventDefault();
  obre(a);
});
fitxa.querySelector('.mapa-fitxa-tanca').addEventListener('click', tanca);
/* Un toc fora del mapa la tanca, tret que sigui per canviar de capa: amb la
   fitxa oberta es pot passar de capa en capa i veure com canvia la xifra del
   mateix poble, que és una de les coses que el mapa fa millor que una llista. */
document.addEventListener('click', function (e) {
  var t = e.target;
  if (!triat || fitxa.contains(t) || svg.contains(t)) return;
  if (t.closest && t.closest('.tries, .mapa-tria')) return;
  tanca();
});
pinta(0);
</script>
${GRAFICS_JS}
</body></html>`;
}
