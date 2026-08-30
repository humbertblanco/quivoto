/**
 * El glossari: una definició per indicador, i una de sola per a tot el portal.
 *
 * Fins ara cada pàgina explicava les seves xifres pel seu compte: el
 * comparador amb una `nota` per fila, les comarques amb una frase sota cada
 * targeta i l'AMB amb una altra que no deia ben bé el mateix. El deute per
 * habitant tenia tres definicions, i dues d'elles no citaven la font. Aquí
 * n'hi ha una per clau, amb què és, d'on surt i en quina unitat va, i les
 * pàgines la demanen per la clau en comptes de tornar-la a escriure.
 *
 * Les regles del text són les del portal: es diu **què mesura** cada xifra i
 * **qui la publica**, i no es diu mai si una xifra és bona o dolenta. Un deute
 * alt pot venir d'una operació de fa vint anys; un sou alt pot ser el d'una
 * alcaldia a dedicació exclusiva d'una ciutat gran. El glossari explica; el
 * judici és de qui llegeix. Els tests miren que cap entrada no digui «millor»
 * ni «pitjor».
 */

// -------------------------------------------------------------- les claus

/**
 * Les claus canòniques. Són les que fan servir les mètriques i els indicadors
 * de comarca i d'AMB; el comparador en té d'antigues («deute», «dones») que
 * s'hi hauran d'aparellar el dia que el consumeixi.
 */
export const CLAUS_GLOSSARI = [
  "habitants",
  "regidories",
  "participacio",
  "alternances",
  "deute-habitant",
  "deute-ingressos",
  "deute-mandat",
  "estalvi-net",
  "estalvi-brut",
  "saldo-no-financer",
  "carrega-financera",
  "execucio-inversions",
  "pmp",
  "ibi-tipus",
  "rebut-ibi",
  "despesa-habitant",
  "cost-govern",
  "sou-alcaldia",
  "renda",
  "preu-aigua",
  "lloguer",
  "selectiva",
  "residus-kg",
  "dones-ple",
  "transparencia",
  "estrangera-pct",
] as const;

export type ClauGlossari = (typeof CLAUS_GLOSSARI)[number];

export type EntradaGlossari = {
  /** El nom amb què surt a les pàgines. */
  etiqueta: string;
  /** Què mesura, exactament, i què no. Sense cap veredicte. */
  que: string;
  /** Qui la publica, amb l'identificador del conjunt de dades quan en té. */
  font: string;
  /** La unitat, quan no és evident pel nom. */
  unitat?: string;
};

/** Cada xifra sense la seva font i la seva unitat no és una dada, és un número. */
export const GLOSSARI: Record<ClauGlossari, EntradaGlossari> = {
  habitants: {
    etiqueta: "Habitants",
    que: "Padró municipal de l'últim any publicat.",
    font: "Generalitat de Catalunya, 6nei-4b44",
    unitat: "persones",
  },
  regidories: {
    etiqueta: "Regidories al ple",
    que: "Les fixa la llei segons la població, per trams: no és una decisió de l'ajuntament.",
    font: "LOREG, article 179; composició dels plens, ntc4-rnwr",
  },
  participacio: {
    etiqueta: "Participació",
    que: "Vots emesos sobre el cens a les municipals del 28 de maig del 2023.",
    font: "Generalitat de Catalunya, irrv-2mfc",
    unitat: "% del cens",
  },
  alternances: {
    etiqueta: "Canvis de força més votada",
    que:
      "Vegades que la força més votada ha canviat de família política a les municipals des del 1979. " +
      "Zero vol dir que sempre ha guanyat la mateixa.",
    font: "Consorci AOC, 3539f7e6",
    unitat: "vegades",
  },
  "deute-habitant": {
    etiqueta: "Deute per habitant",
    que:
      "Deute viu a 31 de desembre dividit pel padró, de l'últim exercici tancat que consta a cada " +
      "ajuntament. És un nivell, no el balanç d'un govern: pot venir d'una operació de fa vint anys.",
    font: "Consorci AOC, 34db8dc5",
    unitat: "€ per habitant",
  },
  "deute-ingressos": {
    etiqueta: "Deute sobre ingressos corrents",
    que:
      "Deute viu dividit pels ingressos corrents de l'any. Per sobre del 110 % la llei no permet " +
      "endeutar-se més sense autorització (TRLRHL, article 53).",
    font: "Consorci AOC, 34db8dc5 i 81f18313",
    unitat: "% dels ingressos corrents",
  },
  "deute-mandat": {
    etiqueta: "Deute: del 2019 al 2023",
    que:
      "Diferència entre el deute per habitant del 2019 i el del 2023: el tros del deute que ha " +
      "passat durant el mandat 2019-2023, amb la candidatura que tenia l'alcaldia aquells anys.",
    font: "Consorci AOC, 34db8dc5",
    unitat: "€ per habitant",
  },
  "estalvi-net": {
    etiqueta: "Estalvi net",
    que:
      "El que sobra dels ingressos corrents un cop pagat el dia a dia i el deute que toca tornar, " +
      "sobre els ingressos corrents. Negatiu obliga a aprovar un pla de sanejament (TRLRHL, article 193).",
    font: "Consorci AOC, 81f18313",
    unitat: "% dels ingressos corrents",
  },
  "estalvi-brut": {
    etiqueta: "Estalvi brut",
    que:
      "El que sobra dels ingressos corrents un cop pagat el funcionament ordinari, sense " +
      "descomptar-hi el deute.",
    font: "Consorci AOC, 81f18313",
    unitat: "% dels ingressos corrents",
  },
  "saldo-no-financer": {
    etiqueta: "Saldo no financer",
    que:
      "Tot el que entra menys tot el que es gasta, sense comptar-hi préstecs, sobre els ingressos " +
      "corrents. Negatiu vol dir que l'any es va tancar gastant més del que va entrar.",
    font: "Consorci AOC, 81f18313",
    unitat: "% dels ingressos corrents",
  },
  "carrega-financera": {
    etiqueta: "Càrrega financera",
    que:
      "Interessos i amortització del deute sobre els ingressos corrents: la part del pressupost " +
      "que ja està compromesa abans que el govern decideixi res.",
    font: "Consorci AOC, 81f18313",
    unitat: "% dels ingressos corrents",
  },
  "execucio-inversions": {
    etiqueta: "Inversions executades",
    que:
      "Del que l'ajuntament tenia pressupostat per invertir, la part que va arribar a executar. " +
      "Per sobre del 100 % vol dir que el pressupost es va ampliar durant l'any.",
    font: "Consorci AOC, 81f18313",
    unitat: "% del pressupostat",
  },
  pmp: {
    etiqueta: "Dies per pagar els proveïdors",
    que:
      "Període mitjà de pagament a proveïdors. Per sobre de 30 dies és un incompliment de la llei " +
      "de morositat; per sobre de 60, greu (LO 2/2012 i RD 635/2014).",
    font: "Consorci AOC, eecca986",
    unitat: "dies",
  },
  "ibi-tipus": {
    etiqueta: "Tipus de l'IBI urbà",
    que:
      "Tipus de gravamen dels béns immobles urbans. El rebut és el tipus multiplicat pel valor " +
      "cadastral: dos municipis amb el mateix tipus i revisions cadastrals de dècades diferents " +
      "no cobren el mateix.",
    font: "Consorci AOC, 82ae0ea2",
    unitat: "% del valor cadastral",
  },
  "rebut-ibi": {
    etiqueta: "Rebut mitjà de l'IBI",
    que:
      "Quota íntegra dividida pels rebuts d'IBI urbà. No és el tipus impositiu: el tipus el fixa " +
      "l'ajuntament, i als municipis metropolitans el recàrrec que la llei permet damunt d'aquest " +
      "impost, no.",
    font: "Idescat, taula 173, a partir de la Direcció General del Cadastre",
    unitat: "€ per rebut",
  },
  "despesa-habitant": {
    etiqueta: "Despesa per habitant",
    que:
      "Obligacions reconegudes netes de la liquidació del pressupost, dividides pel padró de " +
      "l'exercici. Només l'últim exercici marcat com a fiable: una liquidació truncada dispararia la xifra.",
    font: "Generalitat de Catalunya, liquidació per programes, 5b96829f-d724-4059-a38a-abf514830558",
    unitat: "€ per habitant",
  },
  "cost-govern": {
    etiqueta: "Cost del govern",
    que:
      "El que l'ajuntament dedica als seus òrgans de govern —el capítol 1000 de la liquidació— " +
      "dividit pel padró. És el mateix formulari per als 947 municipis; no diu què cobra ningú en concret.",
    font: "Generalitat de Catalunya, liquidacions, 8squ-bk4r",
    unitat: "€ per habitant",
  },
  "sou-alcaldia": {
    etiqueta: "Sou de l'alcaldia",
    que:
      "Retribució anual de l'alcaldia amb dedicació exclusiva o parcial. Les alcaldies sense " +
      "dedicació no hi compten: cobren per assistència a les sessions, i això no és un sou.",
    font: "Inventari ISPA del Ministeri per a la Transformació Digital i de la Funció Pública",
    unitat: "€ l'any",
  },
  renda: {
    etiqueta: "Renda neta per persona",
    que:
      "Renda neta mitjana per habitant. No la decideix l'ajuntament: diu qui hi viu i de què, " +
      "no com governa.",
    font: "INE, Atles de distribució de renda de les llars",
    unitat: "€ l'any",
  },
  "preu-aigua": {
    etiqueta: "Preu de l'aigua",
    que:
      "Preu del subministrament domiciliari a l'1 de gener, ús domèstic, consum de 12 m³ al mes en " +
      "un habitatge de tres persones i sense IVA. És el tram comparable entre municipis: el cànon i " +
      "el clavegueram no hi entren.",
    font: "Observatori del preu de l'aigua, Agència Catalana de l'Aigua",
    unitat: "€ per m³",
  },
  lloguer: {
    etiqueta: "Lloguer mitjà",
    que:
      "Renda mitjana dels contractes de lloguer registrats a la fiança durant l'any. No la fixa " +
      "cap administració.",
    font: "Agència de l'Habitatge de Catalunya, qww9-bvhh",
    unitat: "€ al mes",
  },
  selectiva: {
    etiqueta: "Recollida selectiva",
    que: "Part dels residus municipals que es recull separadament.",
    font: "Agència de Residus de Catalunya, 69zu-w48s",
    unitat: "% dels residus",
  },
  "residus-kg": {
    etiqueta: "Residus per habitant",
    que: "Quilos de residus municipals generats per habitant i any.",
    font: "Agència de Residus de Catalunya, 69zu-w48s",
    unitat: "kg per habitant i any",
  },
  "dones-ple": {
    etiqueta: "Dones al ple",
    que:
      "Regidories ocupades per dones al ple sortit de les municipals del 2023. La llei obliga a " +
      "llistes paritàries des del 2007, però qui acaba entrant depèn de l'ordre i dels escons.",
    font: "Generalitat de Catalunya, xnfg-weec",
    unitat: "% de les regidories",
  },
  transparencia: {
    etiqueta: "Portal de transparència",
    que:
      "Part dels ítems del portal de transparència que l'ajuntament té publicats, segons " +
      "l'emplenament que mesura el Consorci AOC.",
    font: "Consorci AOC, 1a9c1ede",
    unitat: "% dels ítems",
  },
  "estrangera-pct": {
    etiqueta: "Població de nacionalitat estrangera",
    que:
      "Persones sense nacionalitat espanyola sobre el total de població censada. No és el mateix " +
      "que haver nascut fora: qui fa anys que hi viu sovint ja té la nacionalitat. I no ho decideix " +
      "cap ajuntament.",
    font: "Idescat, Cens de població de l'INE, taula censph/5992/5987",
    unitat: "% de la població",
  },
};

/** Els indicadors de comarca i d'AMB porten `key: string`: això diu si és del glossari. */
export function esClauGlossari(clau: string): clau is ClauGlossari {
  return Object.prototype.hasOwnProperty.call(GLOSSARI, clau);
}

// -------------------------------------------------------------- presentació

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * El glossari d'una pàgina, plegat.
 *
 * Va amb `details.nota` i no en clar: la definició no és el que la gent ve a
 * llegir, és el que ha de poder trobar quan una etiqueta no li diu res. Sota
 * cada targeta hi havia la mateixa frase repetida a cada pàgina; aquí hi ha
 * les definicions de les claus que la pàgina ensenya, una vegada i amb la font.
 *
 * Amb cap clau no s'obre res: un glossari buit seria un desplegable que no
 * desplega res.
 */
export function renderGlossari(
  claus: readonly ClauGlossari[],
  opcions: { titol?: string } = {},
): string {
  const uniques = [...new Set(claus)];
  if (uniques.length === 0) return "";
  const entrades = uniques
    .map((clau) => {
      const e = GLOSSARI[clau];
      return `<dt>${escape(e.etiqueta)}${e.unitat ? ` <span class="unitat">${escape(e.unitat)}</span>` : ""}</dt>
    <dd>${escape(e.que)} <span class="font">Font: ${escape(e.font)}.</span></dd>`;
    })
    .join("\n    ");
  return `<details class="nota glossari">
  <summary>${escape(opcions.titol ?? "Què vol dir cada xifra")}</summary>
  <dl>
    ${entrades}
  </dl>
</details>`;
}

/**
 * El full del glossari. `details.nota` ja posa la mida i el gris del text; aquí
 * només hi ha el que és propi de la llista de definicions: el terme en negreta
 * amb la unitat al costat, i la font en una línia més petita a sota.
 */
export const GLOSSARI_CSS = `
.glossari dl{margin:0;display:grid;gap:4px 0}
.glossari dt{font-weight:800;color:var(--ink);font-size:.86rem;margin-top:8px}
.glossari dt:first-child{margin-top:0}
.glossari dt .unitat{font-weight:400;color:var(--ink-suau)}
.glossari dd{margin:0}
.glossari .font{display:block;font-size:.8rem}
`;
