import { and, eq, inArray, notInArray } from "drizzle-orm";
import { municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { arrodoneix, type PuntSerie } from "./j9-habitatge-residus";
import { fetchText } from "./j23-riquesa";
import { withRun } from "../lib/run";

/**
 * J29 — la seguretat: quants fets penals es coneixen a cada municipi, de quins
 * tipus, i si pugen o baixen.
 *
 * ─── LA FONT, I PER QUÈ AQUESTA ─────────────────────────────────────────────
 *
 * **Ministeri de l'Interior, Portal Estadístico de Criminalidad** (el portal
 * SEC, estadisticasdecriminalidad.ses.mir.es). Cada trimestre publica el
 * «Balance de criminalidad», i el del **quart trimestre porta l'any sencer**
 * (gener–desembre) amb l'any anterior al costat. La taula que ens interessa és
 * la tercera de cada balanç: «Municipios mayores de 20.000 habitantes e islas»
 * —fins al balanç del 2020, el llindar era 30.000—, amb **19 tipologies**:
 * homicidis consumats i en temptativa, lesions, segrestos, delictes sexuals
 * (amb el desglòs d'agressions amb penetració), robatoris amb violència, amb
 * força (i el desglòs en domicilis), furts, sostraccions de vehicles, tràfic
 * de drogues, cibercriminalitat (estafes informàtiques a part) i els totals.
 *
 * Comprovat baixant-los tots el 30 d'agost del 2026: el CSV pla surt de
 * `/sec/jaxiPx/files/_px/es/csv_bdsc/DatosBalanceAnt/l0/<fitxer>?nocab=1` amb
 * columnes `Geografía;Tipología penal;Periodos:;Total`, i l'identificador del
 * fitxer canvia cada trimestre (1509012.px el 4t del 2025, 1409012.px el del
 * 2024…), així que **es descobreix llegint l'índex** de cada balanç i no
 * s'endevina mai. Del 4t trimestre del 2025 en surten **71 municipis catalans**
 * (50 de Barcelona, 10 de Girona, 1 de Lleida i 10 de Tarragona).
 *
 * **El codi INE hi és des del balanç del 2024** («08015 Badalona»); als
 * anteriors la geografia només porta el nom («-Municipio de Badalona») sota la
 * capçalera de província. Per això el creuament va així: els balanços amb codi
 * manen, i d'ells se'n treu el diccionari nom+província → codi INE **del
 * mateix Ministeri**; els balanços vells s'hi resolen per aquest diccionari, i
 * el creuament amb els nostres municipis és **sempre pel codi INE de cinc
 * xifres** (`municipalities.ine5`), mai pel nom nostre. Un nom vell que el
 * diccionari no conegui no s'inventa: queda com a incidència.
 *
 * **Les revisions.** El Ministeri repassa les xifres: l'any 2024 surt al
 * balanç del 2024 i, revisat, al del 2025. Aquí sempre guanya el balanç més
 * nou, que és la xifra que el Ministeri mateix fa servir per comparar.
 *
 * ─── EL QUE S'HA MIRAT I S'HA DESCARTAT, I PER QUÈ ──────────────────────────
 *
 *   · **Mossos d'Esquadra a dades obertes** («Fets penals coneguts, fets
 *     coneguts resolts i detencions», analisi.transparenciacatalunya.cat/d/qnyt-emjc,
 *     llicència oberta de la Generalitat, mensual des del 2011, tipologia per
 *     títols del Codi Penal). Seria la font ideal i **no té columna de
 *     municipi**: comprovat llistant-ne els valors, publica per àrea bàsica
 *     policial (ABP), Barcelona hi surt partida en districtes i hi ha una «ABP
 *     Virtual» per als fets d'internet. Una ABP agrupa municipis sencers i no
 *     es pot atribuir a cap ple: val més cap xifra que una xifra d'una altra
 *     banda.
 *   · **L'únic conjunt dels Mossos amb columna de municipi** és el de delictes
 *     d'odi i discriminació (y48r-ae59), que no és la criminalitat general.
 *   · **Idescat**: no té cap taula municipal de delictes.
 *   · **datos.gob.es**: del balanç només hi ha els PDF antics (2013-2016).
 *
 * ─── LA LLICÈNCIA ───────────────────────────────────────────────────────────
 *
 * L'avís legal del portal permet la reutilització comercial i no comercial,
 * amb tres obligacions: citar la font amb la fórmula que ell mateix dona
 * («Origen de los datos: Portal Estadístico de Criminalidad»), dir la data de
 * l'última actualització quan consti, i no desnaturalitzar el sentit de la
 * informació. Es desa literal a la mètrica perquè la fitxa la posi tal com és.
 *
 * ─── LES REGLES QUE MANEN AQUÍ ──────────────────────────────────────────────
 *
 * **La cobertura no arriba al llindar del projecte** (71 municipis és menys
 * que els 200 que demana el mínim de PLA-DADES-2027) i per això el bloc només
 * entra a la fitxa amb el buit dit ben clar: els 71 coberts sumen 5,87 milions
 * d'empadronats —set de cada deu catalans— i els altres 876 municipis veuen
 * exactament per què no tenen xifra i on és el que sí que es publica. «El buit
 * s'ha de dir» és la condició d'entrada d'aquesta font, no una nota al peu.
 *
 * **Això no ho decideix (gairebé gens) l'ajuntament.** La seguretat la porten
 * sobretot els Mossos, i als ports, aeroports i fronteres la Policia Nacional
 * i la Guàrdia Civil; el ple hi posa la policia local, el civisme, l'enllumenat
 * i l'urbanisme. Es desa `context.decideixLAjuntament: false` amb la nota
 * escrita, com J18 i J23.
 *
 * **Fets coneguts no són fets comesos.** Es compta el que es denuncia i el que
 * la policia descobreix: una pujada pot ser més fets o més denúncies, i les
 * estafes per internet han inflat els totals de tot arreu. La nota va amb la
 * mètrica i la fitxa l'ha d'ensenyar.
 *
 * **El rànquing sempre amb el denominador.** Es desa la posició del municipi
 * en fets per 1.000 habitants entre els municipis **amb dada** («el 42è de
 * 71»), mai una posició sola: un rànquing sense denominador és un titular, no
 * una dada.
 */

export const KIND = "criminalitat";
export const LLINDAR_HABITANTS = 20_000;
export const MANDAT = 2023;
/** Primer balanç que s'ingereix: el del 4t trimestre del 2019 (anys 2018 i 2019). */
export const PRIMER_BALANC = 2019;
export const PORTAL = "https://estadisticasdecriminalidad.ses.mir.es";

export const PROVINCIES_CATALANES = new Set(["BARCELONA", "GIRONA", "LLEIDA", "TARRAGONA"]);

/** L'avís legal del portal, resumit literalment. No és cap llicència CC. */
export const LLICENCIA_INTERIOR = {
  organisme: "Ministeri de l'Interior, Portal Estadístico de Criminalidad",
  condicions: `${PORTAL}/publico/portalestadistico/avisoLegal.html`,
  /** La fórmula de citació que l'avís legal dona feta. */
  atribucio: "Origen de los datos: Portal Estadístico de Criminalidad",
  literal:
    "Las presentes condiciones generales permiten la reutilización de los documentos sometidos a ellas " +
    "para fines comerciales y no comerciales. Está prohibido desnaturalizar el sentido de la información. " +
    "Debe citarse la fuente de los documentos objeto de la reutilización. Debe mencionarse la fecha de la " +
    "última actualización de los documentos.",
  obliga:
    "Cada xifra ha d'anar amb la citació «Origen de los datos: Portal Estadístico de Criminalidad» i amb " +
    "la data de consulta, i no se'n pot alterar el sentit.",
} as const;

export const NOTA_COMPETENCIES =
  "La seguretat aquí la porten sobretot els Mossos d'Esquadra i, als ports, aeroports i fronteres, la " +
  "Policia Nacional i la Guàrdia Civil. El que hi posa l'ajuntament és la policia local, les ordenances " +
  "de civisme, l'enllumenat i l'urbanisme: l'entorn on passen les coses, no la investigació dels delictes.";

export const NOTA_FETS_CONEGUTS =
  "Són fets penals coneguts: els que algú denuncia i els que la policia descobreix. Una xifra que puja " +
  "pot voler dir més fets o més denúncies, i les estafes per internet han inflat els totals de tot arreu.";

export const NOTA_LLINDAR =
  "El Ministeri només publica els municipis de més de 20.000 habitants (fins al balanç del 2020, 30.000): " +
  "la resta de municipis no hi surt.";

// ─────────────────────────────────────────────────────────────────────────────
// URLs del portal, comprovades una per una
// ─────────────────────────────────────────────────────────────────────────────

/** L'índex de taules d'un balanç: és on es descobreix l'identificador del fitxer. */
export function urlIndexBalanc(any: number, trimestre = 4): string {
  return `${PORTAL}/sec/dynPx/inebase/index.htm?type=pcaxis&path=/DatosBalanceAnt/${any}${trimestre}/&file=pcaxis`;
}

/** El CSV pla d'una taula (format csv_bdsc: una fila per geografia, tipologia i període). */
export function urlCsvBalanc(fitxer: string): string {
  return `${PORTAL}/sec/jaxiPx/files/_px/es/csv_bdsc/DatosBalanceAnt/l0/${fitxer}?nocab=1`;
}

/** La pàgina llegible del balanç, que és la que es pot ensenyar a la fitxa. */
export function urlPaginaBalanc(any: number, trimestre = 4): string {
  return `${PORTAL}/publico/portalestadistico/datos.html?type=jaxi&title=Cuarto%20trimestre&path=/DatosBalanceAnt/${any}${trimestre}/`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Les tipologies, amb el número que fa servir la font
// ─────────────────────────────────────────────────────────────────────────────

export type DefinicioTipus = {
  clau: string;
  nom: string;
  /** 2 = desglòs d'una tipologia de nivell 1 (5.1, 5.2, 7.1, 12, 13). */
  nivell: 1 | 2;
  /** Si surt a la taula compacta de la fitxa o només al desplegable any a any. */
  fitxa: boolean;
};

export const TIPOLOGIA_TOTAL: DefinicioTipus = {
  clau: "total",
  nom: "Total d'infraccions penals",
  nivell: 1,
  fitxa: true,
};

/**
 * El mapa de tipologies. La clau d'aparellament és el **número** que la font
 * posa davant de cada etiqueta, perquè el text ha canviat amb els anys
 * («1.-Homicidios…» fins al 2021, «1. Homicidios…» després; «libertad e
 * indemnidad sexual» abans, «libertad sexual» ara) i el número no. Els grups
 * grossos van amb número romà: I convencional, II ciber, III total.
 *
 * El «Resto de infracciones penales» de l'esquema vell (2019-2021) **no es
 * mapa enlloc**: barrejava la resta convencional amb la cibercriminalitat i no
 * és comparable amb cap tipologia de l'esquema nou.
 */
export const TIPOLOGIES: readonly (DefinicioTipus & { numero: string })[] = [
  { clau: "convencional", numero: "I", nom: "Criminalitat convencional", nivell: 1, fitxa: false },
  { clau: "homicidis", numero: "1", nom: "Homicidis dolosos i assassinats consumats", nivell: 1, fitxa: true },
  { clau: "homicidis-temptativa", numero: "2", nom: "Homicidis i assassinats en grau de temptativa", nivell: 1, fitxa: false },
  { clau: "lesions", numero: "3", nom: "Delictes de lesions i baralla tumultuària", nivell: 1, fitxa: true },
  { clau: "segrest", numero: "4", nom: "Segrestos", nivell: 1, fitxa: false },
  { clau: "sexuals", numero: "5", nom: "Delictes contra la llibertat sexual", nivell: 1, fitxa: true },
  { clau: "sexuals-penetracio", numero: "5.1", nom: "Agressions sexuals amb penetració", nivell: 2, fitxa: false },
  { clau: "sexuals-resta", numero: "5.2", nom: "Resta de delictes contra la llibertat sexual", nivell: 2, fitxa: false },
  { clau: "robatoris-violencia", numero: "6", nom: "Robatoris amb violència o intimidació", nivell: 1, fitxa: true },
  { clau: "robatoris-forca", numero: "7", nom: "Robatoris amb força en domicilis i establiments", nivell: 1, fitxa: true },
  { clau: "robatoris-domicili", numero: "7.1", nom: "Robatoris amb força en domicilis", nivell: 2, fitxa: false },
  { clau: "furts", numero: "8", nom: "Furts", nivell: 1, fitxa: true },
  { clau: "vehicles", numero: "9", nom: "Sostraccions de vehicles", nivell: 1, fitxa: true },
  { clau: "drogues", numero: "10", nom: "Tràfic de drogues", nivell: 1, fitxa: true },
  { clau: "resta-convencional", numero: "11", nom: "Resta de criminalitat convencional", nivell: 1, fitxa: false },
  { clau: "ciber", numero: "II", nom: "Cibercriminalitat", nivell: 1, fitxa: true },
  { clau: "estafes-informatiques", numero: "12", nom: "Estafes informàtiques", nivell: 2, fitxa: false },
  { clau: "altres-ciberdelictes", numero: "13", nom: "Altres ciberdelictes", nivell: 2, fitxa: false },
];

const PER_NUMERO = new Map(TIPOLOGIES.map((t) => [t.numero, t.clau]));

/** Etiquetes de l'esquema vell que sabem que no es poden mapar, i per què no és un error. */
export const ETIQUETES_DESCARTADES = new Set(["Resto de infracciones penales"]);

/** De l'etiqueta de la font a la nostra clau de tipologia, o `null` si no es mapa. */
export function clauTipologia(etiqueta: string): string | null {
  const net = etiqueta.trim();
  if (/^(III\.|TOTAL INFRACCIONES)/i.test(net)) return "total";
  const roma = /^(II|I)\.\s/.exec(net);
  if (roma) return PER_NUMERO.get(roma[1]!) ?? null;
  const numero = /^(\d+(?:\.\d+)?)\s*\.?\s*-?\s*/.exec(net);
  if (numero) return PER_NUMERO.get(numero[1]!) ?? null;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parseig de l'índex i del CSV
// ─────────────────────────────────────────────────────────────────────────────

export type TaulaMunicipis = { fitxer: string; titol: string; llindar: number | null };

/** El llindar d'habitants que el títol de la taula declara («mayores de 20.000»). */
export function llindarDelTitol(titol: string): number | null {
  const trobat = /mayores de ([\d.]+)/i.exec(titol);
  return trobat ? parseXifra(trobat[1]!) : null;
}

/**
 * Troba la taula de municipis a l'índex d'un balanç. L'identificador del
 * fitxer canvia cada trimestre i per això es llegeix d'aquí i no s'endevina.
 */
export function taulaMunicipisDelIndex(html: string): TaulaMunicipis | null {
  const patro = /<a[^>]*href="[^"]*Tabla\.htm\?path=\/DatosBalanceAnt\/l0\/&amp;file=([^"&]+)&amp;L=0"[^>]*>([^<]+)<\/a>/g;
  for (const trobat of html.matchAll(patro)) {
    const titol = trobat[2]!.trim().replace(/\s+/g, " ");
    if (!/Municipios/i.test(titol)) continue;
    return { fitxer: trobat[1]!, titol, llindar: llindarDelTitol(titol) };
  }
  return null;
}

/**
 * «12.839» → 12839. El punt és separador de milers, com a l'INE; una cel·la
 * amb coma és un percentatge de variació i no és una xifra de fets.
 */
export function parseXifra(text: string): number | null {
  const net = text.trim().replace(/^"|"$/g, "");
  if (!/^-?\d{1,3}(\.\d{3})*$/.test(net) && !/^-?\d+$/.test(net)) return null;
  return Number.parseInt(net.replace(/\./g, ""), 10);
}

/**
 * De «enero-diciembre 2025» a 2025. El guionet doble no és un error nostre:
 * el balanç del 2024 escriu «enero--diciembre 2023» i s'ha de saber llegir.
 * Les files «Variación %» tornen `null` i es descarten: la variació la
 * calculem nosaltres de la sèrie, no la copiem.
 */
export function anyDelPeriode(text: string): number | null {
  const trobat = /^enero-+diciembre\s+(\d{4})$/i.exec(text.trim());
  return trobat ? Number.parseInt(trobat[1]!, 10) : null;
}

export type FilaBalanc = {
  /** Codi INE de 5 xifres quan la geografia el porta (balanços del 2024 ençà). */
  ine5: string | null;
  nom: string;
  /** La província de la capçalera anterior, tal com l'escriu la font (majúscules). */
  provincia: string | null;
  etiqueta: string;
  clau: string | null;
  any: number;
  fets: number;
};

const GEO_PROVINCIA = /^Provincia de (.+)$/;
const GEO_AMB_CODI = /^(\d{5})\s+(.+)$/;
const GEO_SENSE_CODI = /^-\s*Municipio de\s+(.+)$/;

/**
 * Una fila per municipi, tipologia i any. Les geografies que no són municipis
 * —comunitats, províncies, illes— no en treuen cap: la província només serveix
 * per recordar sota quina capçalera surt cada nom.
 */
export function parseCsvBalanc(csv: string): FilaBalanc[] {
  const files: FilaBalanc[] = [];
  let provincia: string | null = null;
  for (const linia of csv.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const camps = linia.split(";");
    if (camps.length < 4) continue;
    const geografia = camps[0]!.trim();
    const esProvincia = GEO_PROVINCIA.exec(geografia);
    if (esProvincia) {
      provincia = esProvincia[1]!.trim();
      continue;
    }
    let ine5: string | null = null;
    let nom: string;
    const ambCodi = GEO_AMB_CODI.exec(geografia);
    const senseCodi = GEO_SENSE_CODI.exec(geografia);
    if (ambCodi) {
      ine5 = ambCodi[1]!;
      nom = ambCodi[2]!.trim();
    } else if (senseCodi) {
      nom = senseCodi[1]!.trim();
    } else {
      continue;
    }
    const any = anyDelPeriode(camps[2]!);
    if (any === null) continue;
    const fets = parseXifra(camps[3]!);
    if (fets === null) continue;
    const etiqueta = camps[1]!.trim();
    files.push({ ine5, nom, provincia, etiqueta, clau: clauTipologia(etiqueta), any, fets });
  }
  return files;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ajuntar balanços: el codi mana, el nom es resol, el més nou guanya
// ─────────────────────────────────────────────────────────────────────────────

export type BalancParsat = { any: number; files: readonly FilaBalanc[] };

/**
 * Ajunta els balanços de tots els anys en una sèrie per municipi i tipologia.
 *
 * Tres regles, en aquest ordre:
 *   1. **El creuament és pel codi INE.** Els balanços vells, que només porten
 *      el nom, es resolen amb el diccionari nom+província → codi que surt dels
 *      balanços amb codi **de la mateixa font**; un nom que hi tingui dos codis
 *      es descarta com a ambigu i un que no hi sigui queda a `senseCodi`.
 *   2. **Només Catalunya.** La resta de codis i de províncies se salta sense
 *      soroll: no és cap incidència que Alacant no sigui nostre.
 *   3. **El balanç més nou guanya.** El Ministeri revisa les xifres, i quan un
 *      any surt a dos balanços es queda la del més recent.
 */
export function ajuntaBalancos(balancos: readonly BalancParsat[]): {
  perIne5: Map<string, Map<string, Map<number, number>>>;
  senseCodi: { nom: string; provincia: string | null }[];
} {
  const ordenats = [...balancos].sort((a, b) => a.any - b.any);

  // El diccionari del Ministeri: nom sota la seva província → codi INE. `null` = ambigu.
  const codiPerNom = new Map<string, string | null>();
  for (const balanc of ordenats) {
    for (const fila of balanc.files) {
      if (!fila.ine5 || !fila.provincia) continue;
      const clauNom = `${fila.provincia}|${fila.nom}`;
      const conegut = codiPerNom.get(clauNom);
      if (conegut === undefined) codiPerNom.set(clauNom, fila.ine5);
      else if (conegut !== null && conegut !== fila.ine5) codiPerNom.set(clauNom, null);
    }
  }

  const perIne5 = new Map<string, Map<string, Map<number, number>>>();
  const senseCodi = new Map<string, { nom: string; provincia: string | null }>();
  for (const balanc of ordenats) {
    for (const fila of balanc.files) {
      if (fila.clau === null) continue;
      let ine5 = fila.ine5;
      if (ine5 === null) {
        if (!fila.provincia || !PROVINCIES_CATALANES.has(fila.provincia)) continue;
        ine5 = codiPerNom.get(`${fila.provincia}|${fila.nom}`) ?? null;
        if (ine5 === null) {
          senseCodi.set(`${fila.provincia}|${fila.nom}`, { nom: fila.nom, provincia: fila.provincia });
          continue;
        }
      } else if (!/^(08|17|25|43)/.test(ine5)) {
        continue;
      }
      let perClau = perIne5.get(ine5);
      if (!perClau) perIne5.set(ine5, (perClau = new Map()));
      let perAny = perClau.get(fila.clau);
      if (!perAny) perClau.set(fila.clau, (perAny = new Map()));
      perAny.set(fila.any, fila.fets);
    }
  }
  return { perIne5, senseCodi: [...senseCodi.values()] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Taxes, canvis i rànquing
// ─────────────────────────────────────────────────────────────────────────────

export type PoblacioAny = {
  any: number;
  habitants: number;
  /** L'any del padró que s'ha fet servir, o `null` si és el padró vigent de la taula de municipis. */
  anyPadro: number | null;
};

/**
 * Quants habitants tenia el municipi cada any de la sèrie, per fer la taxa.
 *
 * Es fa servir el padró de J18 de l'any mateix o, si aquell any falta, el més
 * proper **fins a dos anys de distància** —la sèrie del padró té forats i un
 * padró de fa deu anys faria una taxa mentidera. Sense cap padró prou proper,
 * el padró vigent de la taula de municipis, marcat amb `anyPadro: null`.
 */
export function habitantsPerAny(
  anys: readonly number[],
  padro: readonly PuntSerie[] | null,
  poblacioVigent: number | null,
): PoblacioAny[] {
  const punts = (padro ?? []).filter((p): p is { any: number; valor: number } =>
    typeof p.valor === "number" && p.valor > 0);
  const resultat: PoblacioAny[] = [];
  for (const any of anys) {
    let millor: { any: number; valor: number } | null = null;
    for (const punt of punts) {
      if (millor === null) {
        millor = punt;
        continue;
      }
      const dAra = Math.abs(millor.any - any);
      const dNou = Math.abs(punt.any - any);
      if (dNou < dAra || (dNou === dAra && punt.any > millor.any)) millor = punt;
    }
    if (millor && Math.abs(millor.any - any) <= 2) {
      resultat.push({ any, habitants: millor.valor, anyPadro: millor.any });
    } else if (poblacioVigent !== null && poblacioVigent > 0) {
      resultat.push({ any, habitants: poblacioVigent, anyPadro: null });
    }
  }
  return resultat;
}

export type Canvi = {
  desDe: number;
  fins: number;
  /** Diferència en fets: +745 vol dir 745 fets més. */
  abs: number;
  /** Variació en %, o `null` quan el punt de partida és zero. */
  pct: number | null;
};

/** El canvi entre dos anys de la sèrie, o `null` si a un dels dos no hi ha dada. */
export function canviEntre(
  serie: readonly { any: number; fets: number }[],
  desDe: number,
  fins: number,
): Canvi | null {
  if (fins <= desDe) return null;
  const inici = serie.find((p) => p.any === desDe)?.fets;
  const final = serie.find((p) => p.any === fins)?.fets;
  if (inici === undefined || final === undefined) return null;
  return {
    desDe,
    fins,
    abs: final - inici,
    pct: inici === 0 ? null : arrodoneix((100 * (final - inici)) / inici, 1),
  };
}

export type TipusCriminalitat = {
  clau: string;
  nom: string;
  nivell: 1 | 2;
  fitxa: boolean;
  serie: { any: number; fets: number }[];
  perMil: { any: number; valor: number | null }[];
  /** El darrer any contra l'immediatament anterior; `null` si l'anterior falta. */
  canviUltimAny: Canvi | null;
  /** Des del primer any del mandat (2023). */
  canviMandat: Canvi | null;
};

/** La sèrie d'una tipologia amb la taxa i els dos canvis, o `null` si no hi ha cap dada. */
export function construeixTipus(
  def: DefinicioTipus,
  fetsPerAny: ReadonlyMap<number, number> | undefined,
  poblacio: readonly PoblacioAny[],
  mandat = MANDAT,
): TipusCriminalitat | null {
  if (!fetsPerAny || fetsPerAny.size === 0) return null;
  const serie = [...fetsPerAny.entries()]
    .map(([any, fets]) => ({ any, fets }))
    .sort((a, b) => a.any - b.any);
  const habitantsDe = new Map(poblacio.map((p) => [p.any, p.habitants]));
  const perMil = serie.map((p) => {
    const habitants = habitantsDe.get(p.any);
    return { any: p.any, valor: habitants ? arrodoneix((1000 * p.fets) / habitants, 1) : null };
  });
  const darrer = serie[serie.length - 1]!.any;
  return {
    clau: def.clau,
    nom: def.nom,
    nivell: def.nivell,
    fitxa: def.fitxa,
    serie,
    perMil,
    canviUltimAny: canviEntre(serie, darrer - 1, darrer),
    canviMandat: darrer > mandat ? canviEntre(serie, mandat, darrer) : null,
  };
}

/**
 * Posició d'un valor dins d'una llista, amb rànquing de competició: 1 el més
 * alt, i els empatats comparteixen posició. No treu el valor de la llista:
 * el municipi compta dins del seu propi rànquing.
 */
export function posicioDinsDe(valor: number, valors: readonly number[]): number {
  let davant = 0;
  for (const altre of valors) if (altre > valor) davant += 1;
  return davant + 1;
}

export type RanquingCriminalitat = {
  /** 1 = el municipi amb més fets per 1.000 habitants dels que tenen dada. */
  posicio: number;
  /** Quants municipis tenen la dada. Sense això la posició no es pot publicar. */
  de: number;
  any: number;
  criteri: string;
  ordre: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// La mètrica
// ─────────────────────────────────────────────────────────────────────────────

export type CriminalitatMetric = {
  font: {
    nom: string;
    organisme: string;
    url: string;
    llicencia: typeof LLICENCIA_INTERIOR;
    consultat: string;
    balancos: { any: number; trimestre: number; fitxer: string; titol: string; llindar: number | null; url: string }[];
  };
  cobertura: "mes-de-20000";
  llindar: { habitants: number; nota: string };
  context: { decideixLAjuntament: false; nota: string };
  mandat: { desDe: number };
  anys: number[];
  darrerAny: number;
  poblacio: PoblacioAny[];
  total: TipusCriminalitat;
  tipus: TipusCriminalitat[];
  ranquing: RanquingCriminalitat | null;
  nota: string;
};

type MetricaPoblacioDesada = {
  indicadors?: { clau?: unknown; serie?: { any?: unknown; valor?: unknown }[] }[];
} | null;

/** La sèrie del padró que J18 desa a la mètrica `poblacio`, si hi és. */
function seriePadro(dades: unknown): PuntSerie[] | null {
  const indicadors = (dades as MetricaPoblacioDesada)?.indicadors;
  if (!Array.isArray(indicadors)) return null;
  const padro = indicadors.find((i) => i?.clau === "padroHabitants");
  if (!padro || !Array.isArray(padro.serie)) return null;
  const punts: PuntSerie[] = [];
  for (const punt of padro.serie) {
    if (typeof punt?.any !== "number") continue;
    punts.push({ any: punt.any, valor: typeof punt.valor === "number" ? punt.valor : null });
  }
  return punts;
}

// ─────────────────────────────────────────────────────────────────────────────
// La feina
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Baixa l'índex i el CSV del balanç del 4t trimestre de cada any des del 2019,
 * els ajunta i desa la mètrica `criminalitat` dels municipis coberts. És
 * idempotent, i **esborra** la mètrica dels municipis que ja no surten al
 * balanç: un municipi que en cau no s'ha de quedar amb la sèrie vella com si
 * res.
 *
 * Són ~8 índexs i ~8 CSV d'uns 2 MB: dura un parell de minuts, amb pausa
 * entre peticions per no castigar el portal.
 */
export async function j29Criminalitat(db: Db): Promise<void> {
  const tots = await db
    .select({
      id: municipalities.id,
      ine5: municipalities.ine5,
      name: municipalities.name,
      population: municipalities.population,
    })
    .from(municipalities);

  await withRun(db, "J29 criminalitat: fets penals coneguts per municipi", async (run) => {
    const municipiPerIne5 = new Map(tots.map((m) => [m.ine5, m]));
    const consultat = new Date().toISOString().slice(0, 10);
    const darrerAnyPossible = new Date().getFullYear();

    // ── 1. Els balanços del 4t trimestre, un per any ─────────────────────────
    const balancos: (TaulaMunicipis & BalancParsat)[] = [];
    for (let any = PRIMER_BALANC; any <= darrerAnyPossible; any += 1) {
      // L'índex d'un balanç que encara no existeix pot no respondre: això no
      // és cap error. Que falli el CSV d'un balanç que l'índex anuncia, sí.
      const index = await fetchText(urlIndexBalanc(any), {
        delayMs: balancos.length === 0 ? 0 : 500,
        retries: 1,
      }).catch(() => null);
      const taula = index === null ? null : taulaMunicipisDelIndex(index);
      if (!taula) {
        run.say(`${any}: sense balanç del 4t trimestre (encara)`);
        continue;
      }
      const csv = await fetchText(urlCsvBalanc(taula.fitxer), { delayMs: 500 });
      const files = parseCsvBalanc(csv);
      run.rowsIn += files.length;
      balancos.push({ any, ...taula, files });
      run.say(`${any}: ${taula.fitxer} · ${files.length} files de municipi`);
    }
    if (balancos.length === 0) {
      throw new Error("cap balanç del Ministeri no s'ha pogut baixar: no es toca res");
    }

    // Etiquetes de tipologia que no sabem mapar i no esperàvem: si el Ministeri
    // canvia l'esquema, això ho diu abans que ho noti cap lector.
    const desconegudes = new Set<string>();
    for (const balanc of balancos) {
      for (const fila of balanc.files) {
        if (fila.clau === null && !ETIQUETES_DESCARTADES.has(fila.etiqueta)) desconegudes.add(fila.etiqueta);
      }
    }
    for (const etiqueta of desconegudes) {
      await run.issue({
        kind: "criminalitat: tipologia del balanç que no sabem mapar",
        severity: "mitjana",
        entity: etiqueta,
        detail: { remei: "afegeix-la a TIPOLOGIES de j29-criminalitat o a ETIQUETES_DESCARTADES" },
      });
    }

    // ── 2. Ajuntar, i dir el que no ha quadrat ───────────────────────────────
    const { perIne5, senseCodi } = ajuntaBalancos(balancos);
    for (const pendent of senseCodi) {
      await run.issue({
        kind: "criminalitat: municipi d'un balanç vell sense codi INE resolt",
        severity: "baixa",
        entity: `${pendent.nom} (${pendent.provincia ?? "?"})`,
        detail: {
          nom: pendent.nom,
          provincia: pendent.provincia,
          remei: "el nom no surt igual a cap balanç amb codi; comprova si el municipi ha canviat de nom",
        },
      });
    }

    const coberts: { municipi: (typeof tots)[number]; perClau: Map<string, Map<number, number>> }[] = [];
    for (const [ine5, perClau] of perIne5) {
      const municipi = municipiPerIne5.get(ine5);
      if (!municipi) {
        await run.issue({
          kind: "criminalitat: codi INE del balanç sense municipi nostre",
          severity: "alta",
          entity: ine5,
          detail: { remei: "comprova municipalities.ine5: el balanç diu que aquest codi és català" },
        });
        continue;
      }
      coberts.push({ municipi, perClau });
    }

    // ── 3. El padró de cada any, per fer taxes ───────────────────────────────
    const padroPer = new Map<number, PuntSerie[]>();
    if (coberts.length > 0) {
      const filesPoblacio = await db
        .select({ municipalityId: municipalityMetrics.municipalityId, data: municipalityMetrics.data })
        .from(municipalityMetrics)
        .where(and(
          eq(municipalityMetrics.kind, "poblacio"),
          inArray(municipalityMetrics.municipalityId, coberts.map((c) => c.municipi.id)),
        ));
      for (const fila of filesPoblacio) {
        const serie = seriePadro(fila.data);
        if (serie) padroPer.set(fila.municipalityId, serie);
      }
    }

    // ── 4. La mètrica de cada municipi ───────────────────────────────────────
    const font: CriminalitatMetric["font"] = {
      nom: "Balanç de criminalitat (4t trimestre: any sencer)",
      organisme: LLICENCIA_INTERIOR.organisme,
      url: urlPaginaBalanc(balancos[balancos.length - 1]!.any),
      llicencia: LLICENCIA_INTERIOR,
      consultat,
      balancos: balancos.map((b) => ({
        any: b.any,
        trimestre: 4,
        fitxer: b.fitxer,
        titol: b.titol,
        llindar: b.llindar,
        url: urlCsvBalanc(b.fitxer),
      })),
    };

    const candidats: { municipi: (typeof tots)[number]; dades: CriminalitatMetric }[] = [];
    for (const { municipi, perClau } of coberts) {
      const totalPerAny = perClau.get("total");
      if (!totalPerAny || totalPerAny.size === 0) {
        await run.issue({
          kind: "criminalitat: municipi al balanç sense fila de total",
          severity: "mitjana",
          municipalityId: municipi.id,
          entity: municipi.name,
        });
        continue;
      }
      const anys = [...totalPerAny.keys()].sort((a, b) => a - b);
      const poblacio = habitantsPerAny(anys, padroPer.get(municipi.id) ?? null, municipi.population);
      const total = construeixTipus(TIPOLOGIA_TOTAL, totalPerAny, poblacio)!;
      const tipus = TIPOLOGIES
        .map((def) => construeixTipus(def, perClau.get(def.clau), poblacio))
        .filter((t): t is TipusCriminalitat => t !== null);
      candidats.push({
        municipi,
        dades: {
          font,
          cobertura: "mes-de-20000",
          llindar: { habitants: LLINDAR_HABITANTS, nota: NOTA_LLINDAR },
          context: { decideixLAjuntament: false, nota: NOTA_COMPETENCIES },
          mandat: { desDe: MANDAT },
          anys,
          darrerAny: anys[anys.length - 1]!,
          poblacio,
          total,
          tipus,
          ranquing: null,
          nota: NOTA_FETS_CONEGUTS,
        },
      });
    }

    // ── 5. El rànquing, sempre amb el denominador ────────────────────────────
    const darrerAnyGlobal = Math.max(...candidats.map((c) => c.dades.darrerAny));
    const taxes = new Map<number, number>();
    for (const { municipi, dades } of candidats) {
      const valor = dades.total.perMil.find((p) => p.any === darrerAnyGlobal)?.valor;
      if (typeof valor === "number") taxes.set(municipi.id, valor);
    }
    const valors = [...taxes.values()];
    for (const candidat of candidats) {
      const valor = taxes.get(candidat.municipi.id);
      candidat.dades.ranquing = valor === undefined ? null : {
        posicio: posicioDinsDe(valor, valors),
        de: valors.length,
        any: darrerAnyGlobal,
        criteri: "fets penals coneguts per 1.000 habitants (total d'infraccions penals)",
        ordre: "el 1r és el que en té més per 1.000 habitants",
      };
    }

    // ── 6. Desar, i esborrar qui ja no surt al balanç ────────────────────────
    for (const { municipi, dades } of candidats) {
      await db
        .insert(municipalityMetrics)
        .values({ municipalityId: municipi.id, kind: KIND, data: dades })
        .onConflictDoUpdate({
          target: [municipalityMetrics.municipalityId, municipalityMetrics.kind],
          set: { data: dades, computedAt: new Date() },
        });
      run.rowsOut += 1;
    }
    const idsDesats = candidats.map((c) => c.municipi.id);
    await db.delete(municipalityMetrics).where(
      idsDesats.length > 0
        ? and(eq(municipalityMetrics.kind, KIND), notInArray(municipalityMetrics.municipalityId, idsDesats))
        : eq(municipalityMetrics.kind, KIND),
    );

    const poblacioCoberta = candidats.reduce((suma, c) => suma + (c.municipi.population ?? 0), 0);
    const poblacioTotal = tots.reduce((suma, m) => suma + (m.population ?? 0), 0);
    const pes = poblacioTotal > 0 ? Math.round((100 * poblacioCoberta) / poblacioTotal) : null;
    run.say(
      `${run.rowsOut} municipis amb balanç (${pes ?? "?"} % de la població) · sèrie fins al ${darrerAnyGlobal} · ` +
      `${senseCodi.length} noms vells sense codi`,
    );

    return {
      municipis: run.rowsOut,
      darrerAny: darrerAnyGlobal,
      balancos: balancos.map((b) => b.any),
      senseCodi: senseCodi.length,
      poblacioCobertaPct: pes,
    };
  });
}
