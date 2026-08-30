import { RADIOGRAFIA_CSS } from "./estil";
import { geometria } from "./mapa";
import { siglesFamily } from "@quivoto/shared-schemas/brands";
import { SITE } from "./config";
import type { Els947Row } from "./els947";
import { MASCOTA_CSS, papereta } from "./mascota";
import { capcalera } from "./capcalera";
import { cercador } from "./cercador";
import { peu } from "./peu";

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
  /** Valor d'un municipi, o null si no en tenim. */
  valor: (r: Els947Row) => number | null;
  /** Els talls entre graons; si no n'hi ha, es fan per quantils. */
  talls?: number[];
  etiquetes?: string[];
  format: (v: number) => string;
  /**
   * Colors propis de la capa, un per graó, quan el que separa els municipis no
   * és una escala sinó una categoria. La rampa coral de la resta de capes diu
   * «més o menys»; els partits no són més ni menys que els altres, i pintar-los
   * amb una rampa faria que el mapa digués una cosa que no és.
   */
  colors?: string[];
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

const CAPA_PARTIT: Capa = {
  id: "partit",
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
  talls: FAMILIES_MAPA.map((_, i) => i + 0.5).slice(0, -1),
  etiquetes: FAMILIES_MAPA.map(([, nom]) => nom),
  colors: FAMILIES_MAPA.map(([, , color]) => color),
  format: (v) => FAMILIES_MAPA[v]?.[1] ?? "sense marca",
};

/**
 * Les dues xifres que el mapa sap pintar i que la fila dels 947 encara no porta.
 *
 * Són a la base —`municipality_metrics`, kind «riquesa» (J23, la renda neta per
 * persona de l'Atlas de distribución de renta de los hogares de l'INE) i kind
 * «retribucions» (J22, el que el Ministeri publica del sou de cada alcaldia)—
 * però no passen per `loadEls947()`, que és qui munta la fila que arriba aquí.
 * Afegir-les-hi és una línia a `els947.ts` i toca un fitxer que no és d'aquest
 * encàrrec, o sigui que aquí s'hi llegeixen com a camps opcionals.
 *
 * Mentre la fila no els porti, les dues capes no tenen dada enlloc i el filtre
 * de més avall les treu del mapa: no surt cap botó, cap llegenda ni cap taca
 * grisa. **Un botó que pinta els 947 de gris és pitjor que un botó que no hi
 * és**, perquè el lector no pot saber si el que falla és la dada o el mapa.
 */
type FilaAmpliada = Els947Row & {
  /** renda neta mitjana per persona i any, en euros */
  rn?: number | null;
  /** el que cobra l'alcaldia en un any, en euros, quan és un sou i no assistències */
  sa?: number | null;
};

const CAPES: Capa[] = [
  CAPA_PARTIT,
  {
    id: "majoria",
    titol: "On governa algú amb majoria absoluta",
    boto: "Majoria absoluta",
    peu: `Una llista sola amb prou regidories per aprovar el que vulgui sense pactar amb ningú.
      És la diferència entre un mandat on cada punt es negocia i un on no cal.`,
    valor: (r) => r.m,
    talls: [0.5],
    etiquetes: ["cap llista sola", "majoria absoluta"],
    format: (v) => (v === 1 ? "amb majoria absoluta" : "sense majoria absoluta"),
  },
  {
    id: "guanyador",
    titol: "On no governa la llista més votada",
    boto: "Pactes",
    peu: `Guanyar unes municipals no vol dir governar-les: l'alcaldia la vota el ple. Aquí es veu
      on el primer no mana, que és on el pacte va decidir més que els vots.`,
    valor: (r) => (r.w === null ? null : r.w === 1 ? 0 : 1),
    talls: [0.5],
    etiquetes: ["governa qui va guanyar", "governa un altre"],
    format: (v) => (v === 1 ? "no governa la llista més votada" : "governa la llista més votada"),
  },
  {
    id: "canvi",
    titol: "On ha canviat l'alcaldia a mig mandat",
    boto: "Canvis d'alcaldia",
    peu: `Una moció de censura, una dimissió o un relleu pactat. No diu què va passar, però diu
      on va passar alguna cosa.`,
    valor: (r) => r.k,
    talls: [0.5],
    etiquetes: ["la mateixa alcaldia", "hi ha canviat"],
    format: (v) => (v === 1 ? "l'alcaldia ha canviat a mig mandat" : "la mateixa alcaldia tot el mandat"),
  },
  {
    id: "alternances",
    titol: "Quantes vegades ha canviat qui guanya, des del 1979",
    boto: "Alternança des del 1979",
    peu: `Dotze eleccions. Zero vol dir que la mateixa força les ha guanyat totes; com més alt,
      més s'hi mou el vot. És la millor pista de si el 2027 està decidit o obert.`,
    valor: (r) => r.v,
    talls: [0.5, 1.5, 2.5, 3.5],
    etiquetes: ["cap canvi", "1", "2", "3", "4 o més"],
    format: (v) => (v === 0 ? "sempre la mateixa força" : `${v} canvis de força més votada`),
  },
  {
    id: "participacio",
    titol: "Quanta gent va anar a votar el 2023",
    boto: "Participació",
    peu: `Votants sobre el cens a les municipals del maig del 2023, amb les xifres oficials de la
      Generalitat. Als pobles petits sol ser altíssima i a les ciutats grans, molt més baixa: la
      taca gran, aquí, mesura sobretot la mida del municipi.`,
    valor: (r) => r.pt ?? null,
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
    titol: "Què costa l'aigua a cada municipi",
    boto: "Preu de l'aigua",
    peu: `Preu del tram de subministrament per a un consum domèstic de 12 m³ al mes, segons
      l'Observatori del preu de l'aigua de l'ACA. És el tram comparable entre municipis: el cànon
      i el clavegueram no els fixa l'ajuntament i no hi entren.`,
    valor: (r) => r.pa ?? null,
    format: (v) => `${coma(v, 2)} €/m³`,
  },
  {
    id: "estrangera",
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
    titol: "Quantes dones hi ha al ple",
    boto: "Dones al ple",
    peu: `Percentatge de regidories ocupades per dones. La llei obliga a llistes paritàries des del
      2007, però qui acaba entrant depèn de l'ordre i dels escons.`,
    valor: (r) => r.f,
    format: pct,
  },
  {
    id: "transparencia",
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
    titol: "Quants diners entren a les cases",
    boto: "Renda per persona",
    peu: `Renda neta mitjana per persona i any, de l'Atlas de distribución de renta de los hogares
      de l'INE. És el que queda a la llar després d'impostos i cotitzacions, repartit entre tots els
      seus membres. No ho decideix cap ajuntament: depèn de qui hi viu i de què hi treballa.`,
    valor: (r) => (r as FilaAmpliada).rn ?? null,
    format: (v) => `${milers(v)} €`,
  },
  {
    /*
     * «Sense dedicació» amb import no és un sou: són assistències a plens i
     * indemnitzacions. Comptar-les com a sou faria semblar que hi ha alcaldies
     * que cobren cent euros l'any per fer d'alcalde, i el que passa és que no en
     * cobren cap. Per això aquí només hi entra el que J22 marca com a sou, i la
     * resta compta com a sense dada.
     */
    id: "sou-alcaldia",
    titol: "Quant cobra l'alcaldia",
    boto: "Sou de l'alcaldia",
    peu: `El que percep l'alcaldia en un any, segons l'Inventari de retribucions dels membres de les
      corporacions locals que publica el Ministeri per a la Transformació Digital i de la Funció
      Pública. Només hi compten les dedicacions exclusives i parcials: les assistències a plens no
      són un sou i aquí no hi surten. Un poble petit sense dedicació no és un poble on l'alcaldia
      cobri poc: és un on no cobra.`,
    valor: (r) => (r as FilaAmpliada).sa ?? null,
    format: (v) => `${milers(v)} €`,
  },
];

/** Talls per quantils, ignorant els municipis sense dada. */
function quantils(valors: readonly number[], graons: number): number[] {
  const ordenats = [...valors].sort((a, b) => a - b);
  if (ordenats.length === 0) return [];
  const talls: number[] = [];
  for (let i = 1; i < graons; i += 1) {
    talls.push(ordenats[Math.floor((i * ordenats.length) / graons)] ?? 0);
  }
  // Amb molts empats, dos talls poden coincidir i un graó quedaria buit.
  //
  // I un tall que valgui el mínim també en deixa un de buit, però per davant i
  // sense que es noti a la llegenda: el deute per habitant té 400 municipis a
  // zero, el primer quantil valia 0 i la clau del mapa deia «menys de 0 €», un
  // graó on no hi pot caure ningú i un color que no s'arribava a fer servir.
  const minim = ordenats[0]!;
  return [...new Set(talls)].filter((t) => t > minim);
}

const graoDe = (valor: number, talls: readonly number[]): number => {
  let g = 0;
  for (const t of talls) if (valor >= t) g += 1;
  return g;
};

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
 * La llegenda dibuixada dins de l'SVG, al racó de mar.
 *
 * El lloc no és arbitrari. Amb el «viewBox» de 1600 × 1600 que porta la
 * geometria, Catalunya deixa dos buits grossos: el de dalt a l'esquerra, que és
 * l'Aragó, i el de baix a la dreta, que és el Mediterrani. La llegenda va al
 * segon perquè és el que no toca cap municipi en tot el traçat —comprovat
 * recorrent els 947 camins i marcant una graella de 32 × 32 caselles— i perquè
 * és on la posa qualsevol mapa de tota la vida.
 *
 * Les mides van en unitats del «viewBox» i no en píxels: el dibuix s'escala
 * sencer, i per això a partir de nou entrades es passa a tres columnes en
 * comptes d'allargar-se cap amunt, on ja hi hauria terra a sota. Amb les dotze
 * famílies i el gris de «sense dada» són tretze, i la caixa acaba fent 944 ×
 * 360 unitats, que és el que cap sense tocar cap municipi.
 */
function clauSvg(i: number, titol: string, entrades: readonly { classe: string; text: string }[]): string {
  const columnes = entrades.length > 8 ? 3 : 1;
  const ampleCol = columnes === 1 ? 470 : 300;
  const files = Math.ceil(entrades.length / columnes);
  const alcadaFila = 56;
  const ample = 44 + ampleCol * columnes;
  const alt = 18 + 46 + files * alcadaFila + 16;
  const x0 = 1592 - ample;
  const y0 = 1592 - alt;
  const lletra = columnes === 1 ? 28 : 26;

  const fileres = entrades
    .map((e, k) => {
      const columna = Math.floor(k / files);
      const fila = k % files;
      const x = x0 + 22 + columna * ampleCol;
      const y = y0 + 18 + 46 + fila * alcadaFila;
      return (
        `<rect class="mostra ${e.classe}" x="${x}" y="${y}" width="36" height="36" rx="7"/>` +
        `<text x="${x + 50}" y="${y + 27}" font-size="${lletra}">${escape(e.text)}</text>`
      );
    })
    .join("");

  return `<g class="clau-mapa" data-clau="${i}" aria-hidden="true">
    <rect class="fons" x="${x0}" y="${y0}" width="${ample}" height="${alt}" rx="16"/>
    <text class="cap" x="${x0 + 22}" y="${y0 + 46}">${escape(titol)}</text>
    ${fileres}
  </g>`;
}

const CSS = `
.mapa-marc{margin:var(--e4) 0 0;position:relative}
/* La fitxa que segueix el ratolí. No intercepta cap clic —el que hi ha a sota
   és l'enllaç al municipi— i no surt mai amb el dit: allà el toc ja obre la
   fitxa del poble, que és millor que qualsevol previsualització. */
.ullada-mapa{position:absolute;z-index:5;pointer-events:none;background:var(--paper-2);
  border:2.5px solid var(--ink);border-radius:var(--r-m);box-shadow:var(--ombra);
  padding:10px 14px;min-width:190px;max-width:280px;display:flex;flex-direction:column;gap:2px}
.ullada-mapa b{font-family:var(--display);font-weight:900;font-size:1.05rem;letter-spacing:-.01em;line-height:1.15}
.ullada-mapa .hab{font-size:.76rem;color:var(--ink-suau);font-weight:700;font-variant-numeric:tabular-nums}
.ullada-mapa .qui{display:flex;align-items:center;gap:7px;font-size:.82rem;font-weight:800;margin-top:4px}
.ullada-mapa .qui i{width:11px;height:11px;border-radius:3px;border:1.5px solid var(--ink);flex:none}
.ullada-mapa .qui i.sense{background:#DED8CB}
.ullada-mapa .capa{font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;
  color:var(--ink-suau);margin-top:5px;padding-top:5px;border-top:1px solid var(--vora)}
.mapa947{width:100%;height:auto;display:block;max-width:900px;margin:0 auto}
.mapa947 path{stroke:var(--ink);stroke-width:.7;stroke-linejoin:round;transition:fill .3s ease}
.mapa947 a:hover path,.mapa947 a:focus path{stroke-width:3.5}
.mapa947 .contorn{fill:none;stroke:var(--ink);stroke-width:3.5}
/* La rampa va d'una sola tinta i amb la lluminància sempre baixant, perquè els
   graons se sàpiguen distingir també sense veure el color: amb la rampa de
   menta a coral de la marca, els tres primers quedaven indistingibles en
   deuteranòpia. Els quadrets de la llegenda són HTML i volen «background»; els
   camins són SVG i volen «fill». */
${CAPES.map((c, i) =>
  c.colors
    ? c.colors
        .map(
          (col, k) =>
            `.mapa947[data-capa="${i}"] .g${k}{fill:${col}}.llegenda[data-capa="${i}"] .g${k}{background:${col}}`,
        )
        .join("")
    : "",
).join("")}
.mapa947 .g0{fill:#FBEFE6}.mapa947 .g1{fill:#F0BFA9}.mapa947 .g2{fill:#E2735A}
.mapa947 .g3{fill:#BE5138}.mapa947 .g4{fill:#8E2F1D}
.llegenda .g0{background:#FBEFE6}.llegenda .g1{background:#F0BFA9}.llegenda .g2{background:#E2735A}
.llegenda .g3{background:#BE5138}.llegenda .g4{background:#8E2F1D}
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
.mapa947,.llegenda,.clau-mapa{--nd-fons:#DDD9E6;--nd-ratlla:#7B7592}
.mapa947 .gnd{fill:url(#sense-dada)}
.llegenda .gnd{background:repeating-linear-gradient(45deg,
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
  .llegenda .g0{background:#3B2119}.llegenda .g1{background:#6A3524}.llegenda .g2{background:#9C4A31}
  .llegenda .g3{background:#D06A47}.llegenda .g4{background:#F5A583}
  /* En fosc les ratlles s'aclareixen i el fons s'enfosqueix, que és el mateix
     canvi que fa la rampa: el patró de l'SVG llegeix aquestes dues variables i
     no cal tornar-lo a declarar. */
  .mapa947,.llegenda,.clau-mapa{--nd-fons:#2E2A3A;--nd-ratlla:#8A83A3}
  .ullada-mapa .qui i.sense{background:#3A3545}
}
/* La llegenda escrita dins de l'SVG.
   Hi és perquè el mapa se'n va sol: quan algú en fa una captura o se'n desa el
   dibuix, la llista de colors que hi havia en HTML al costat no hi va, i el
   que queda és una taca de colors sense clau. Les onze van totes escrites i se
   n'ensenya una amb el mateix «data-capa» que pinta els municipis, així que
   funciona abans que arrenqui cap JavaScript. Per sota de 620 px es plega: el
   text de dins de l'SVG s'escala amb el dibuix i allà ja no es llegiria, i la
   llista d'HTML, que sí que s'escala amb la lletra del lector, la substitueix.
   Per això mateix va amb «aria-hidden»: qui llegeix amb veu ha de sentir la
   llista una sola vegada, i la bona és la d'HTML. */
.clau-mapa{display:none}
${CAPES.map((_, i) => `.mapa947[data-capa="${i}"] .clau-mapa[data-clau="${i}"]{display:block}`).join("")}
.clau-mapa .fons{fill:var(--paper-2);stroke:var(--ink);stroke-width:3}
.clau-mapa rect.mostra{stroke:var(--ink);stroke-width:2.5}
.clau-mapa text{fill:var(--ink);font-family:var(--text);font-weight:800}
.clau-mapa .cap{font-family:var(--display);font-weight:900;font-size:32px}
/* Amb la mateixa especificitat que la regla que l'ensenya i escrita després,
   que és el que la fa guanyar sense haver de posar-hi cap «important». */
@media (max-width:620px){.mapa947[data-capa] .clau-mapa[data-clau]{display:none}}
.tries{display:flex;gap:8px;flex-wrap:wrap;margin:var(--e3) 0 0;padding:0;list-style:none}
.tries button{font:inherit;font-weight:800;font-size:.85rem;cursor:pointer;background:var(--paper-2);
  color:inherit;border:2.5px solid var(--ink);border-radius:var(--r-max);padding:9px 16px;min-height:44px;
  box-shadow:var(--ombra)}
.tries button[aria-pressed="true"]{background:var(--ink);color:var(--paper)}
.llegenda{display:flex;gap:var(--e2);flex-wrap:wrap;align-items:center;margin:var(--e3) 0 0;
  font-size:.84rem;font-weight:700;list-style:none;padding:0}
.llegenda li{display:flex;align-items:center;gap:6px}
.llegenda i{width:22px;height:22px;border:2px solid var(--ink);border-radius:5px;display:inline-block}
@media (prefers-reduced-motion:reduce){.mapa947 path{transition:none}}
`;

export function renderMapaCatalunya(files: readonly Els947Row[], generatedAt: string): string {
  const perSlug = new Map(files.map((r) => [r.s, r]));
  const slugs = Object.keys(geometria.municipis).sort();

  // Cada capa es desa com una cadena d'un caràcter per municipi: amb 947
  // municipis i onze capes, són onze cadenes de 947 lletres. Canviar de capa és
  // reescriure una classe, no tornar a baixar el mapa.
  const totes = CAPES.map((capa) => {
    const valors = slugs
      .map((s) => (perSlug.has(s) ? capa.valor(perSlug.get(s)!) : null))
      .filter((v): v is number => v !== null);
    const talls = capa.talls ?? quantils(valors, 5);
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
        : [`menys de ${capa.format(talls[0]!)}`].concat(
            talls.map((t) => `${capa.format(t)} o més`),
          ));
    const ambDada = graons.split("").filter((c) => c !== "x").length;
    // La mediana només val per a una xifra que es pugui ordenar. A «qui mana»
    // el valor és el número de la família a la taula i fer-ne la mediana
    // donaria una cosa que sembla una xifra i no vol dir res.
    const mig = capa.colors || capa.etiquetes ? null : mediana(valors);
    return { ...capa, graons, etiquetes, ambDada, talls, mig: mig === null ? "" : capa.format(mig) };
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

  // El que ensenya la fitxa flotant, en el mateix ordre que els camins: nom,
  // habitants, alcaldia, sigles i color de la seva força. Va com una llista
  // paral·lela i no com a atributs de cada camí perquè 947 camins amb cinc
  // atributs cadascun són 947 lectures del DOM a cada moviment del ratolí.
  const info = slugs.map((slug) => {
    const f = perSlug.get(slug);
    if (!f) return [slug, 0, "", "", ""];
    // La mateixa regla que pinta el mapa. Si aquí es tornés a mirar només les
    // sigles, el Prat sortiria morat al mapa i sense color a la fitxa flotant.
    const familia = familiaAlcaldia(f);
    const color = familia ? FAMILIES_MAPA.find(([id]) => id === familia)?.[2] ?? "" : "";
    return [f.n, f.p, f.a ?? "", f.g ?? "", color];
  });

  const primera = capes[0]!;
  const camins = slugs
    .map((slug, i) => {
      const fila = perSlug.get(slug);
      const nom = fila?.n ?? slug;
      const g = primera.graons[i] === "x" ? "gnd" : `g${primera.graons[i]}`;
      return `<a href="/observatori/m/${escape(slug)}/"><title>${escape(nom)}</title><path class="${g}" d="${geometria.municipis[slug]}"/></a>`;
    })
    .join("");

  /*
   * El botó porta el nom curt a la vista i el títol sencer per a qui llegeix
   * amb veu: «Participació» sol no diu de quina votació, i el títol sí. El
   * títol va dins del botó i amagat, i no com a «aria-label», perquè amb
   * l'atribut el nom accessible deixaria de contenir el text que es veu i qui
   * navega per veu no podria dir «Participació» per prémer-lo.
   */
  const tries = capes
    .map(
      (c, i) =>
        `<li><button type="button" data-capa="${i}" aria-pressed="${i === 0 ? "true" : "false"}">${escape(c.boto)}<span class="nomes-lectors">: ${escape(c.titol)}</span></button></li>`,
    )
    .join("");

  /*
   * La descripció de la pàgina es fa de les capes que realment es publiquen.
   * Escrita a mà quedava desactualitzada cada cop que se n'afegia una, i
   * prometia al cercador capes que el mapa no acaba ensenyant quan la dada no
   * hi és —el mapa en treu el botó i la descripció es quedava dient-ho.
   */
  const llistaBotons =
    capes.length === 1
      ? capes[0]!.boto.toLowerCase()
      : capes
          .slice(0, -1)
          .map((c) => c.boto.toLowerCase())
          .join(", ") + ` i ${capes[capes.length - 1]!.boto.toLowerCase()}`;

  const claus = capes
    .map((c, i) =>
      clauSvg(
        i,
        c.boto,
        c.etiquetes
          .map((et, k) => ({ classe: `g${k}`, text: et }))
          .concat(c.ambDada < slugs.length ? [{ classe: "gnd", text: "sense dada" }] : []),
      ),
    )
    .join("");

  return `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>El mapa dels 947 — Observatori municipal de quivoto</title>
<meta name="description" content="Els 947 municipis de Catalunya pintats per ${escape(llistaBotons)}. Cada municipi porta a la seva fitxa.">
<link rel="canonical" href="${SITE}/observatori/mapa/">
<style>${RADIOGRAFIA_CSS}${MASCOTA_CSS}${CSS}</style>
</head>
<body>
<a class="salta" href="#contingut">Ves al contingut</a>
${capcalera("../", "mapa")}
${cercador("../")}

<main id="contingut">
  <section class="portada">
    <div class="presenta">${papereta(110, "felic")}<div>
      <p class="micro">Tot Catalunya</p>
      <h1>El mapa dels 947</h1>
    </div></div>
    <p class="entrada">Cada municipi és clicable i porta a la seva fitxa. Tria què vols veure-hi
    pintat: hi ha coses que en una llista de 947 files no es veuen mai.</p>
  </section>

  <ul class="tries" id="tries">${tries}</ul>

  <div class="mapa-marc">
    <h2 id="titol-capa">${escape(primera.titol)}</h2>
    <p class="entrada-bloc" id="peu-capa">${primera.peu}</p>
    <ul class="llegenda" id="llegenda" data-capa="0">${primera.etiquetes
      .map((et, k) => `<li><i class="g${k}"></i>${escape(et)}</li>`)
      .join("")}${primera.ambDada < slugs.length ? '<li><i class="gnd"></i>sense dada</li>' : ""}</ul>
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
      ${claus}
    </svg>
    <div class="ullada-mapa" id="ullada" hidden aria-hidden="true"></div>
    <p class="nota" id="cobertura-capa"></p>
  </div>

  <section class="bloc fonts">
    <h2>D'on surt el mapa</h2>
    <p class="nota">Límits municipals de les
    <a href="${escape(geometria.fontUrl)}" target="_blank" rel="noopener">Divisions administratives</a>
    de l'${escape(geometria.font.replace(/^Divisions administratives de l'/, ""))},
    sota <a href="${escape(geometria.llicenciaUrl)}" target="_blank" rel="noopener">${escape(geometria.llicencia)}</a>,
    amb dades actualitzades el ${escape(geometria.actualitzat)}. Simplificats per pesar poc; per a
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
    <p class="nota">Els colors de les capes de xifres van d'una sola tinta i amb la lluminància
    sempre en el mateix sentit, perquè els graons es puguin distingir també sense veure el color, i
    es giren quan el navegador demana el mode fosc. Els talls es fan per quantils: cada color n'és
    un cinquè, sempre, i per això la lectura ha de ser «està a la cinquena part de dalt», mai
    «està molt». Els municipis <b>sense dada</b> no porten cap color de l'escala sinó ratlles:
    un forat no és un valor baix, i pintat amb el to més clar ho semblava.</p>
  </section>

  <section class="bloc anar">
    <h2>Segueix estirant</h2>
    <ul class="destins">
      <li><a href="../els947.html"><b>Els 947, en llista</b>
        <span>Amb cercador i filtres, per si busques un poble concret</span></a></li>
      <li><a href="../comparador/"><b>El comparador</b>
        <span>Fins a quatre municipis costat a costat amb la mateixa vara</span></a></li>
    </ul>
  </section>
</main>
${peu("../", generatedAt)}


<script>
var CAPES = ${JSON.stringify(
    capes.map((c) => ({
      t: c.titol,
      p: c.peu.replace(/\s+/g, " ").trim(),
      g: c.graons,
      e: c.etiquetes,
      n: c.ambDada,
      m: c.mig,
    })),
  )};
var camins = document.querySelectorAll('.mapa947 a path');
function pinta(i) {
  var c = CAPES[i];
  for (var n = 0; n < camins.length; n++) {
    var g = c.g.charAt(n);
    camins[n].setAttribute('class', g === 'x' ? 'gnd' : 'g' + parseInt(g, 36));
  }
  document.querySelector('.mapa947').setAttribute('data-capa', i);
  document.getElementById('llegenda').setAttribute('data-capa', i);
  document.getElementById('titol-capa').textContent = c.t;
  document.getElementById('peu-capa').textContent = c.p;
  document.getElementById('llegenda').innerHTML =
    c.e.map(function (et, k) { return '<li><i class="g' + k + '"></i>' + et + '</li>'; }).join('') +
    (c.n < camins.length ? '<li><i class="gnd"></i>sense dada</li>' : '');
  /* La mediana al costat de la cobertura. Els talls d'una capa contínua es fan
     per quantils, o sigui que el mapa sempre surt amb un cinquè de cada color:
     sense dir contra què es compara, una taca fosca no vol dir «molt». */
  document.getElementById('cobertura-capa').textContent =
    c.n + ' dels ' + camins.length + ' municipis tenen aquesta dada.' +
    (c.m ? ' El municipi del mig en té ' + c.m + '.' : '');
  capaAra = i;
  var botons = document.querySelectorAll('#tries button');
  for (var b = 0; b < botons.length; b++) botons[b].setAttribute('aria-pressed', b === i ? 'true' : 'false');
}
/* La fitxa que surt en passar el ratolí per un municipi.
   El mapa és de 947 taques i cap no diu com es diu: el títol nadiu del
   navegador triga un segon llarg i no hi cap res més que el nom. Aquí hi va
   qui mana i quant hi viu, que és el que fa que passar-hi el ratolí valgui la
   pena. Amb el dit no s'hi mostra res: el toc obre la fitxa del poble, que és
   millor que qualsevol previsualització. */
var INFO = ${JSON.stringify(info)};
var ullada = document.getElementById('ullada');
var marc = document.querySelector('.mapa-marc');
var capaAra = 0;
function ensenya(i, x, y) {
  var d = INFO[i];
  if (!d) return;
  var c = CAPES[capaAra];
  var g = c.g.charAt(i);
  var quin = g === 'x' ? 'sense dada' : c.e[parseInt(g, 36)];
  ullada.innerHTML =
    '<b>' + d[0] + '</b>' +
    '<span class="hab">' + d[1].toLocaleString('ca-ES') + ' habitants</span>' +
    (d[2] ? '<span class="qui">' + (d[4] ? '<i style="background:' + d[4] + '"></i>' : '<i class="sense"></i>') + d[2] + (d[3] ? ' · ' + d[3] : '') + '</span>' : '') +
    '<span class="capa">' + quin + '</span>';
  var r = marc.getBoundingClientRect();
  ullada.hidden = false;
  var w = ullada.offsetWidth, h = ullada.offsetHeight;
  var px = x - r.left + 16, py = y - r.top + 16;
  if (px + w > r.width) px = x - r.left - w - 16;
  if (py + h > r.height) py = y - r.top - h - 16;
  ullada.style.left = Math.max(0, px) + 'px';
  ullada.style.top = Math.max(0, py) + 'px';
}
if (window.matchMedia('(hover: hover)').matches) {
  for (var q = 0; q < camins.length; q++) {
    (function (n) {
      var a = camins[n].parentNode;
      a.addEventListener('mousemove', function (e) { ensenya(n, e.clientX, e.clientY); });
      a.addEventListener('mouseleave', function () { ullada.hidden = true; });
      a.addEventListener('focus', function () {
        var b = camins[n].getBoundingClientRect();
        ensenya(n, b.left + b.width / 2, b.top + b.height / 2);
      });
      a.addEventListener('blur', function () { ullada.hidden = true; });
    })(q);
  }
}
document.getElementById('tries').addEventListener('click', function (e) {
  var b = e.target.closest('button');
  if (b) pinta(Number(b.dataset.capa));
});
pinta(0);
</script>
</body></html>`;
}
