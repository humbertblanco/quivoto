import { eq } from "drizzle-orm";
import { mayors, municipalities, municipalityMetrics, type Db } from "@quivoto/db";
import { dataCurta, nomLlegible, normalizePersonName, slugify } from "../lib/text";
import { findChanges } from "../derive/mayor-changes";
import { GRAFICS_JS, serieTemporal } from "./grafics";
import { RADIOGRAFIA_CSS } from "./estil";
import { SITE } from "./config";
import { ARREL_OBSERVATORI, capSeo, filAriadna, FITXER_OG, imatgeOg } from "./seo";
import { MASCOTA_CSS, papereta } from "./mascota";
import { capcalera, tipografia } from "./capcalera";
import { cara } from "./cara";
import { carregaCarrecsAlcaldia, carregaPleDelRegistre, resolAlcaldia } from "./alcaldia";
import { cercador } from "./cercador";
import { peu } from "./peu";
import {
  FAMILIES,
  KIND,
  anysDelMandat,
  type Familia,
  type FitxaTrajectoria,
} from "../jobs/j21-trajectoria-electes";
import { KIND as KIND_FOTOS, type FitxaFotosExalcaldes } from "../jobs/j28-fotos-exalcaldes";
import { FOTOS_WIKIMEDIA_CSS, creditRetrat, retratWikimedia, type Retrat } from "./fotos-wikidata";

/**
 * Què passa amb els que manen als pobles: quant duren, si repeteixen i on van.
 *
 * La primera versió d'aquesta pàgina («D'on surten els que manen») només
 * explicava l'última de les tres preguntes, i la responia amb Wikidata: 283
 * dels 2.907 alcaldes que la font coneix han ocupat un càrrec per sobre de
 * l'ajuntament. Era una pàgina sencera construïda sobre la font més prima que
 * tenim, i el propietari va dir que «ara no tenia gaire sentit»: qui arriba a
 * la fitxa del seu alcalde no es pregunta tant si arribarà al Parlament com
 * **quant durarà**, i això sí que ho sabem de tothom.
 *
 * Aquesta versió posa cada pregunta sobre la font que la pot respondre:
 *
 *   · **Quant duren i si repeteixen** surt de l'historial d'alcaldies de la
 *     Generalitat —la taula `mayors`—, que porta tots els mandats dels 947
 *     municipis des del 1979. És un cens, no una mostra: cada persona que hi
 *     ha tingut l'alcaldia hi és, hagi sortit al diari o no.
 *   · **Els relleus a mig mandat** surten de la mateixa taula, amb la regla
 *     que ja fa servir la fitxa de cada municipi (`derive/mayor-changes.ts`):
 *     aquí no es torna a decidir què és un relleu, es compten els que allà
 *     ja hi consten.
 *   · **On van després** continua sent Wikidata, i es diu amb el denominador
 *     que toca: «dels 283 que Wikidata sap que han fet el salt». La font
 *     cobreix molt millor la gent famosa —dels que hi tenen el salt escrit,
 *     un 96 % té article a la Viquipedia; dels altres, un 13 %— i per això
 *     aquesta part no porta cap rànquing de municipis ni cap mapa: ordenarien
 *     qui té més article, no qui fa més carrera.
 *
 * Les tres regles editorials que valen a tota la pàgina: cap veredicte —quatre
 * mandats no són ni bons ni dolents—, cada xifra amb el seu denominador i la
 * seva font, i un buit no és un zero: qui encara mana no ha «durat» un mandat,
 * en porta un, i es diu al costat de la barra.
 *
 * Els anys que s'escriuen són aproximats i s'explica com: de ple de constitució
 * a ple de constitució, o fins avui per a qui encara hi és, i dins d'un mandat
 * amb relleu, per la data de presa de possessió que dona la font. Quan la font
 * no dona la data, es pren la primera presa de possessió d'aquell mandat a tot
 * Catalunya, que és el mateix dia de constitució que fa servir la derivació.
 */

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const nombre = (n: number): string => n.toLocaleString("ca-ES");

/** Un tant per cent amb una xifra decimal, i sense decimal quan és rodó. */
export function percent(part: number, total: number): string {
  if (total <= 0) return "—";
  const p = (100 * part) / total;
  return `${p.toFixed(p >= 10 ? 0 : 1).replace(".", ",")} %`;
}

const plural = (n: number, un: string, molts: string): string => (n === 1 ? un : molts);

// ─────────────────────────────────────────────────────────────────────────────
// Les formes de la pàgina: l'historial oficial
// ─────────────────────────────────────────────────────────────────────────────

/** Una fila de la taula `mayors`, tal com la dona la Generalitat. */
export type FilaHistorial = {
  municipalityId: number;
  /** «2023-2027», tal com ho publica la font. */
  term: string;
  name: string;
  partyRaw: string | null;
  tookOfficeOn: string | null;
};

export type MunicipiBasic = { slug: string; nom: string };

/**
 * On és la fitxa de qui té l'alcaldia avui, quan en té: la clau del nom amb
 * què tot el projecte creua persones i el camí relatiu a `m/<slug>/`
 * («regidor/<persona>/»), tal com el decideix `resolAlcaldia()`.
 */
export type AdrecaActual = { clau: string; adreca: string };

/** Una persona de l'historial oficial, ja ajuntada de tots els seus mandats en un municipi. */
export type PersonaHistorial = {
  municipi: MunicipiBasic;
  nom: string;
  /** Mandats en què consta com a alcaldia, sencers o no. */
  mandats: number;
  /** Anys aproximats a l'alcaldia, amb una xifra decimal. */
  anys: number;
  primerMandat: string;
  ultimMandat: string;
  /** Cert si és qui té l'alcaldia avui. */
  actual: boolean;
  /** On porta el seu nom: la fitxa de regidor si en té, i si no, la d'alcaldia històrica. */
  fitxa: string;
};

/** Un tram de la distribució: quantes persones han tingut un, dos, tres o més mandats. */
export type TramDurada = {
  mandats: 1 | 2 | 3 | 4;
  etiqueta: string;
  persones: number;
  /** Les que encara hi són: la seva alcaldia no s'ha acabat i el tram no és definitiu. */
  enCurs: number;
};

/** Els relleus d'un mandat a tot Catalunya. */
export type RelleuMandat = {
  term: string;
  /** Municipis on l'alcaldia va canviar de mans dins del mandat. */
  municipis: number;
  /** Dels quals, on va canviar també de partit. */
  ambCanviDeColor: number;
  /** Dels quals, on la font només diu qui va arribar: no se sap si va canviar el color. */
  nomesSuccessor: number;
};

export type MunicipiRelleus = MunicipiBasic & { relleus: number; ambCanviDeColor: number };

export type HistorialAlcaldies = {
  font: string;
  /** Persones diferents que han tingut l'alcaldia, comptades per municipi. */
  persones: number;
  /** Municipis amb algun mandat a l'historial. */
  municipis: number;
  municipisTotal: number;
  primerMandat: string;
  mandatActual: string;
  /** Mandats diferents que cobreix la font. */
  mandats: number;
  durades: TramDurada[];
  /** Persones amb dos mandats o més. */
  repeteixen: number;
  /** Les que tenen l'alcaldia avui. */
  actuals: number;
  longeus: PersonaHistorial[];
  relleus: RelleuMandat[];
  totalRelleus: number;
  totalAmbCanviDeColor: number;
  municipisAmbMesRelleus: MunicipiRelleus[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Les formes de la pàgina: el salt, segons Wikidata
// ─────────────────────────────────────────────────────────────────────────────

export type CarrecPagina = { nom: string; familia: Familia; inici: string | null; fi: string | null };

/** Una persona que ha fet el salt, ja ajuntada de tots els municipis on va manar. */
export type SaltPersona = {
  qid: string;
  url: string;
  nom: string;
  viquipedia: string | null;
  /** Els municipis on Wikidata li dona alcaldia, amb el nostre slug si el sabem. */
  municipis: { nom: string; slug: string | null }[];
  /** Any del primer mandat d'alcaldia: és l'ordre en què s'expliquen. */
  primerAny: number;
  ultimAny: number;
  families: Familia[];
  carrecs: CarrecPagina[];
  ocupacions: string[];
  /** Cert si el nom i les dates lliguen amb el nostre historial oficial. */
  aparellat: boolean;
  /**
   * On porta el seu nom. La fitxa de regidor si té l'alcaldia avui i en té;
   * la fitxa d'alcaldia històrica si lliga amb el nostre historial; i si no
   * lliga, l'historial d'alcaldies del municipi, que hi és sempre. Un nom que
   * no porta enlloc, en una llista de 283 noms, són 283 preguntes obertes.
   */
  fitxa: string;
  /** El retrat que publica el seu ajuntament, quan encara seu al ple. */
  foto: string | null;
  /** El retrat de Wikimedia Commons que J28 ha baixat, quan és un exalcalde amb fotografia lliure. */
  retrat: Retrat | null;
};

export type DecadaTrajectoria = { decada: number; alcaldes: number; ambSalt: number };

export type SaltWikidata = {
  font: string;
  fontUrl: string;
  llicencia: string;
  /** Data d'extracció de Wikidata; `null` si cap fitxa no la porta. */
  descarregat: string | null;
  /** Persones diferents amb alcaldia catalana des del 1979 a Wikidata. */
  totalPersones: number;
  /** Les que lliguen amb el nostre historial oficial. */
  aparellades: number;
  ambSalt: number;
  municipisAmbSalt: number;
  families: { clau: Familia; etiqueta: string; frase: string; persones: number }[];
  decades: DecadaTrajectoria[];
  ocupacions: { nom: string; quants: number }[];
  ambOcupacio: number;
  /** Article a la Viquipedia catalana: la mesura del biaix de la font. */
  ambViquipediaSalt: number;
  ambViquipediaSenseSalt: number;
};

export type TrajectoriaData = {
  historial: HistorialAlcaldies;
  /** `null` si J21 no s'ha executat: la pàgina surt igualment, sense l'apartat del salt. */
  salt: SaltWikidata | null;
  /** Els que han fet el salt; buit sense J21. Va aquí i no dins de `salt` perquè el publicador el compta. */
  persones: SaltPersona[];
};

// ─────────────────────────────────────────────────────────────────────────────
// On porta cada nom
// ─────────────────────────────────────────────────────────────────────────────

/**
 * La fitxa d'alcaldia històrica: `m/<municipi>/alcaldia/<persona>/`, amb el
 * nom escrit com el publiquem (`nomLlegible`) i convertit en slug. És la
 * mateixa regla amb què s'anomenen les fitxes, i si un dia canvia allà ha de
 * canviar aquí: un enllaç calculat d'una altra manera porta a una pàgina que
 * no hi és.
 */
export function fitxaAlcaldia(slug: string, nom: string): string {
  return `../m/${slug}/alcaldia/${slugify(nomLlegible(nom))}/`;
}

/**
 * On porta el nom d'una persona de l'historial: si és qui té l'alcaldia avui i
 * en té fitxa de regidor, allà, que és on hi ha la cara i el que cobra; si no,
 * a la seva fitxa d'alcaldia històrica.
 */
export function fitxaDe(muni: MunicipiBasic, nom: string, actual: AdrecaActual | null | undefined): string {
  if (actual && actual.clau === normalizePersonName(nom)) return `../m/${muni.slug}/${actual.adreca}`;
  return fitxaAlcaldia(muni.slug, nom);
}

// ─────────────────────────────────────────────────────────────────────────────
// El càlcul sobre l'historial oficial
// ─────────────────────────────────────────────────────────────────────────────

const DIA_MS = 86_400_000;
const dies = (a: string, b: string): number => Math.max(0, (Date.parse(b) - Date.parse(a)) / DIA_MS);

/**
 * El dia que va començar cada mandat a tot Catalunya: la primera presa de
 * possessió que consta, com fa la derivació dels relleus. Si cap fila d'un
 * mandat no porta data, es pren mitjan juny del primer any, que és quan es
 * constitueixen els plens des del 1983.
 */
export function inicisDeMandat(files: readonly FilaHistorial[]): Map<string, string> {
  const inicis = new Map<string, string>();
  for (const f of files) {
    if (!f.tookOfficeOn) continue;
    const ara = inicis.get(f.term);
    if (ara === undefined || f.tookOfficeOn < ara) inicis.set(f.term, f.tookOfficeOn);
  }
  for (const f of files) {
    if (inicis.has(f.term)) continue;
    const anys = anysDelMandat(f.term);
    inicis.set(f.term, anys === null ? `${f.term.slice(0, 4)}-06-15` : anys.inici.replace("-01-01", "-06-15"));
  }
  return inicis;
}

const TRAMS: readonly { mandats: 1 | 2 | 3 | 4; etiqueta: string }[] = [
  { mandats: 1, etiqueta: "Un mandat" },
  { mandats: 2, etiqueta: "Dos mandats" },
  { mandats: 3, etiqueta: "Tres mandats" },
  { mandats: 4, etiqueta: "Quatre o més" },
];

/** Quants dels més longeus i dels municipis amb més relleus s'ensenyen. */
const LONGEUS = 10;
const MUNICIPIS_RELLEUS = 8;

/**
 * Tot el que la pàgina diu de l'historial oficial, calculat d'una tirada.
 *
 * La persona es compta **per municipi**: qui ha manat a dos pobles —passa,
 * poc— és dues persones aquí, perquè la fitxa d'alcaldia històrica també és
 * per municipi i la pregunta «quant dura» es fa d'una alcaldia, no d'una
 * carrera. La clau és `normalizePersonName()`, la mateixa amb què J21 aparella
 * Wikidata amb aquesta taula.
 *
 * Torna `null` sense cap fila: una pàgina amb totes les barres a zero és
 * pitjor que cap pàgina.
 */
export function calculaHistorial(
  files: readonly FilaHistorial[],
  municipis: ReadonlyMap<number, MunicipiBasic>,
  opcions: { avui: string; actuals?: ReadonlyMap<number, AdrecaActual>; font?: string },
): HistorialAlcaldies | null {
  const bones = files.filter((f) => municipis.has(f.municipalityId) && normalizePersonName(f.name) !== "");
  if (bones.length === 0) return null;

  const termes = [...new Set(bones.map((f) => f.term))].sort();
  const mandatActual = termes[termes.length - 1]!;
  const inicis = inicisDeMandat(bones);
  // El mandat es tanca quan comença el següent, o avui si és el que corre.
  const finals = new Map<string, string>(
    termes.map((t, i) => [t, i + 1 < termes.length ? inicis.get(termes[i + 1]!)! : opcions.avui]),
  );

  const perMunicipi = new Map<number, FilaHistorial[]>();
  for (const f of bones) {
    const llista = perMunicipi.get(f.municipalityId);
    if (llista) llista.push(f);
    else perMunicipi.set(f.municipalityId, [f]);
  }

  type Acumulat = {
    municipalityId: number;
    /** El nom de la fila més recent: el que la font ha escrit més tard i el que lliga amb la fitxa d'avui. */
    nom: string;
    ultim: string;
    mandats: Set<string>;
    dies: number;
    actual: boolean;
  };
  const persones = new Map<string, Acumulat>();
  const relleusPerMandat = new Map<string, RelleuMandat>(
    termes.map((t) => [t, { term: t, municipis: 0, ambCanviDeColor: 0, nomesSuccessor: 0 }]),
  );
  const relleusPerMunicipi: MunicipiRelleus[] = [];
  let totalRelleus = 0;
  let totalAmbCanviDeColor = 0;

  for (const [municipalityId, llista] of perMunicipi) {
    const muni = municipis.get(municipalityId)!;
    const perTerm = new Map<string, FilaHistorial[]>();
    for (const f of llista) {
      const t = perTerm.get(f.term);
      if (t) t.push(f);
      else perTerm.set(f.term, [f]);
    }
    for (const [term, spells] of perTerm) {
      // Dins d'un mandat, per data de presa de possessió; qui no en té data
      // és el del ple de constitució i va primer.
      const ordenats = [...spells].sort((a, b) => (a.tookOfficeOn ?? "").localeCompare(b.tookOfficeOn ?? ""));
      const iniciMandat = inicis.get(term)!;
      const fiMandat = finals.get(term)!;
      ordenats.forEach((s, i) => {
        const inici = s.tookOfficeOn ?? iniciMandat;
        const seguent = ordenats[i + 1]?.tookOfficeOn ?? null;
        const fi = seguent && seguent > inici ? seguent : fiMandat;
        const clau = `${municipalityId}|${normalizePersonName(s.name)}`;
        const ja = persones.get(clau);
        const esActual = term === mandatActual && i === ordenats.length - 1;
        if (ja === undefined) {
          persones.set(clau, {
            municipalityId,
            nom: s.name,
            ultim: term,
            mandats: new Set([term]),
            dies: dies(inici, fi),
            actual: esActual,
          });
        } else {
          ja.mandats.add(term);
          ja.dies += dies(inici, fi);
          ja.actual = ja.actual || esActual;
          if (term >= ja.ultim) {
            ja.ultim = term;
            ja.nom = s.name;
          }
        }
      });
    }

    const canvis = findChanges(
      llista.map((f) => ({ term: f.term, name: f.name, partyRaw: f.partyRaw, tookOfficeOn: f.tookOfficeOn })),
      inicis,
    );
    if (canvis.length > 0) {
      let ambColor = 0;
      for (const c of canvis) {
        const compte = relleusPerMandat.get(c.term)!;
        compte.municipis += 1;
        if (c.partyChanged) {
          compte.ambCanviDeColor += 1;
          ambColor += 1;
        }
        if (c.onlySuccessorKnown) compte.nomesSuccessor += 1;
      }
      totalRelleus += canvis.length;
      totalAmbCanviDeColor += ambColor;
      relleusPerMunicipi.push({ slug: muni.slug, nom: muni.nom, relleus: canvis.length, ambCanviDeColor: ambColor });
    }
  }

  const durades: TramDurada[] = TRAMS.map((t) => ({ ...t, persones: 0, enCurs: 0 }));
  let repeteixen = 0;
  let actuals = 0;
  const totes: PersonaHistorial[] = [];
  for (const p of persones.values()) {
    const quants = p.mandats.size;
    const tram = durades[Math.min(4, quants) - 1]!;
    tram.persones += 1;
    if (p.actual) {
      tram.enCurs += 1;
      actuals += 1;
    }
    if (quants >= 2) repeteixen += 1;
    const muni = municipis.get(p.municipalityId)!;
    const ordenats = [...p.mandats].sort();
    totes.push({
      municipi: muni,
      nom: nomLlegible(p.nom),
      mandats: quants,
      anys: Math.round((10 * p.dies) / 365.25) / 10,
      primerMandat: ordenats[0]!,
      ultimMandat: ordenats[ordenats.length - 1]!,
      actual: p.actual,
      fitxa: fitxaDe(muni, p.nom, opcions.actuals?.get(p.municipalityId)),
    });
  }

  return {
    font: opcions.font ?? "Generalitat de Catalunya, historial d'alcaldies",
    persones: totes.length,
    municipis: perMunicipi.size,
    municipisTotal: municipis.size,
    primerMandat: termes[0]!,
    mandatActual,
    mandats: termes.length,
    durades,
    repeteixen,
    actuals,
    longeus: [...totes]
      .sort((a, b) => b.anys - a.anys || b.mandats - a.mandats || a.nom.localeCompare(b.nom, "ca"))
      .slice(0, LONGEUS),
    relleus: termes.map((t) => relleusPerMandat.get(t)!),
    totalRelleus,
    totalAmbCanviDeColor,
    municipisAmbMesRelleus: relleusPerMunicipi
      .sort((a, b) => b.relleus - a.relleus || b.ambCanviDeColor - a.ambCanviDeColor || a.nom.localeCompare(b.nom, "ca"))
      .slice(0, MUNICIPIS_RELLEUS),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Quant duren
// ─────────────────────────────────────────────────────────────────────────────

/** «1979–1983» a partir de «1979-1983»: el guió que toca a un interval. */
const mandatLlegible = (term: string): string => term.replace(/\s*-\s*/, "–");

/**
 * Quatre barres, una per tram, totes a la mateixa escala, amb la part de qui
 * encara hi és marcada dins de la barra: qui mana avui i porta un mandat no ha
 * «durat» un mandat, i pintar-lo igual que qui va plegar el 1987 diria que les
 * alcaldies duren menys del que duren.
 */
export function barresDurades(durades: readonly TramDurada[], total: number): string {
  if (total <= 0) return "";
  const maxim = Math.max(1, ...durades.map((d) => d.persones));
  const files = durades
    .map((d) => {
      const ample = d.persones === 0 ? 0 : Math.max(1.5, (100 * d.persones) / maxim);
      const enCurs = d.persones === 0 ? 0 : (100 * d.enCurs) / d.persones;
      return `<li>
      <span class="quin">${escape(d.etiqueta)}</span>
      <span class="barra"><span style="width:${ample.toFixed(1)}%"><i style="width:${enCurs.toFixed(1)}%"></i></span></span>
      <span class="quants"><b>${nombre(d.persones)}</b> ${escape(percent(d.persones, total))}${
        d.enCurs === 0 ? "" : `<small>${nombre(d.enCurs)} encara hi ${plural(d.enCurs, "és", "són")}</small>`
      }</span>
    </li>`;
    })
    .join("");
  return `<figure class="families durades">
  <ul>${files}</ul>
  <figcaption><span class="clau"><i class="tot"></i> Persones</span>
  <span class="clau"><i class="curs"></i> De les quals, tenen l'alcaldia avui</span>
  · Sobre les ${nombre(total)} persones que han tingut l'alcaldia d'algun municipi des del 1979.
  Un mandat compta sencer o no: qui va arribar a mig mandat i qui hi va ser quatre anys hi compten igual.</figcaption>
</figure>`;
}

const anysEscrits = (anys: number): string => {
  const rodons = Math.round(anys);
  return `${nombre(rodons)} ${plural(rodons, "any", "anys")}`;
};

/**
 * El rànquing curt dels que més anys hi han estat. Cada nom porta a la seva
 * fitxa —de regidor si mana avui i en té, d'alcaldia històrica si no— i cada
 * municipi a la seva. Els anys van amb «aprox.» a l'etiqueta de la llista, i
 * no a cada fila, perquè la nota que ho explica és una i és a sota.
 */
export function llistaLongeus(longeus: readonly PersonaHistorial[]): string {
  if (longeus.length === 0) return "";
  const files = longeus
    .map(
      (p, i) => `<li>
      <span class="pos">${i + 1}</span>
      <span class="qui"><a href="${escape(p.fitxa)}">${escape(p.nom)}</a>
        <small><a href="../m/${escape(p.municipi.slug)}/">${escape(p.municipi.nom)}</a> · ${escape(mandatLlegible(p.primerMandat).slice(0, 4))}–${
          p.actual ? "avui" : escape(mandatLlegible(p.ultimMandat).slice(5, 9))
        }</small></span>
      <span class="dada">${escape(anysEscrits(p.anys))}<small>${nombre(p.mandats)} ${plural(p.mandats, "mandat", "mandats")}</small></span>
    </li>`,
    )
    .join("");
  return `<ol class="longeus" aria-label="Les persones que més anys han tingut una alcaldia des del 1979">${files}</ol>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Relleus a mig mandat
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Una barra per mandat: quants municipis van canviar d'alcaldia sense passar
 * per les urnes, i dins de la barra, en quants va canviar també el partit. El
 * mandat en curs porta la seva xifra amb l'avís que encara no s'ha acabat.
 */
export function barresRelleus(relleus: readonly RelleuMandat[], mandatActual: string, municipis: number): string {
  const ambDades = relleus.filter((r) => r.municipis > 0);
  if (ambDades.length === 0) return "";
  const maxim = Math.max(1, ...relleus.map((r) => r.municipis));
  const files = relleus
    .map((r) => {
      const ample = r.municipis === 0 ? 0 : Math.max(1.5, (100 * r.municipis) / maxim);
      const color = r.municipis === 0 ? 0 : (100 * r.ambCanviDeColor) / r.municipis;
      const enCurs = r.term === mandatActual ? `<small>en curs</small>` : "";
      return `<li>
      <span class="quin">${escape(mandatLlegible(r.term))}</span>
      <span class="barra"><span style="width:${ample.toFixed(1)}%"><i style="width:${color.toFixed(1)}%"></i></span></span>
      <span class="quants"><b>${nombre(r.municipis)}</b> ${
        r.ambCanviDeColor === 0 ? "" : `${nombre(r.ambCanviDeColor)} amb canvi de color`
      }${enCurs}</span>
    </li>`;
    })
    .join("");
  return `<figure class="families relleus">
  <ul>${files}</ul>
  <figcaption><span class="clau"><i class="tot"></i> Municipis amb relleu</span>
  <span class="clau"><i class="curs"></i> Dels quals, amb canvi de partit</span>
  · Sobre els ${nombre(municipis)} municipis. Un relleu és un mandat amb més d'una alcaldia, o una
  sola que va prendre possessió molt després del ple de constitució: llavors la font només diu qui
  va arribar, i no es pot dir si el color va canviar.</figcaption>
</figure>`;
}

/** Els municipis on ha passat més vegades, amb l'enllaç a la seva taula d'alcaldies. */
export function llistaMunicipisRelleus(municipis: readonly MunicipiRelleus[]): string {
  const bons = municipis.filter((m) => m.relleus >= 2);
  if (bons.length === 0) return "";
  return `<ul class="mes-relleus">${bons
    .map(
      (m) => `<li><a href="../m/${escape(m.slug)}/#alcaldies">${escape(m.nom)}</a>
      <span>${nombre(m.relleus)} ${plural(m.relleus, "mandat", "mandats")} amb relleu${
        m.ambCanviDeColor === 0 ? "" : `, ${nombre(m.ambCanviDeColor)} amb canvi de color`
      }</span></li>`,
    )
    .join("")}</ul>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// On van després: les sis menes de càrrec
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Una barra per família, totes amb **la mateixa escala**, que és la regla 2 de
 * `grafics.ts`: 213 al Parlament i 3 al Parlament Europeu són dues coses molt
 * diferents i el dibuix ho ha de dir sense que calgui llegir el número.
 *
 * Les barres no sumen 284 i això s'escriu a sota: hi ha qui ha estat al
 * Parlament i després al Congrés, i comptar-lo un cop per lloc és el correcte.
 * Una suma de barres que no quadra amb el total i no s'explica és el que fa
 * desconfiar de tota la pàgina.
 */
export function barresFamilia(families: SaltWikidata["families"], total: number): string {
  const amb = families.filter((f) => f.persones > 0).sort((a, b) => b.persones - a.persones);
  if (amb.length === 0) return "";
  const maxim = Math.max(...amb.map((f) => f.persones));
  const files = amb
    .map((f) => {
      const ample = Math.max(1.5, (100 * f.persones) / maxim);
      return `<li>
      <span class="quin">${escape(f.etiqueta)}</span>
      <span class="barra"><span style="width:${ample.toFixed(1)}%"></span></span>
      <span class="quants"><b>${nombre(f.persones)}</b> ${escape(percent(f.persones, total))}</span>
    </li>`;
    })
    .join("");
  return `<figure class="families">
  <ul>${files}</ul>
  <figcaption>Cada barra és quanta gent hi ha arribat, sobre les ${nombre(total)} persones
  que Wikidata dona com a alcaldes catalans des del 1979. <b>Les barres no sumen ${nombre(total)}</b>:
  qui ha estat al Parlament i després al Congrés compta a totes dues.</figcaption>
</figure>`;
}

/**
 * La sèrie per dècada d'estrena a l'alcaldia, amb l'avís al costat.
 *
 * El pendent de baixada dels últims vint anys **no és una troballa**: qui va
 * estrenar alcaldia el 2015 encara té la carrera per fer. Dir-ho al costat del
 * dibuix, i no a la nota del final, és el que evita que la gent se'n vagi amb
 * la conclusió contrària.
 */
export function decades(files: readonly DecadaTrajectoria[]): string {
  const bones = files.filter((d) => d.alcaldes > 0);
  if (bones.length < 2) return "";
  const punts = bones.map((d) => ({ any: d.decada, valor: (100 * d.ambSalt) / d.alcaldes }));
  const grafic = serieTemporal(punts, {
    format: (v) => `${v.toFixed(1).replace(".", ",")} %`,
    titol: "Part dels alcaldes de cada dècada que després ocupen un càrrec superior",
    mida: "mitjana",
  });
  const llista = bones
    .map((d) => `<li><b>Anys ${d.decada}</b><span>${nombre(d.ambSalt)} de ${nombre(d.alcaldes)}</span></li>`)
    .join("");
  return `${grafic}<ul class="decades">${llista}</ul>`;
}

export function ocupacions(
  files: readonly { nom: string; quants: number }[],
  ambOcupacio: number,
  total: number,
): string {
  const top = files.slice(0, 8);
  if (top.length === 0) return "";
  const maxim = Math.max(...top.map((o) => o.quants));
  const files2 = top
    .map(
      (o) => `<li>
      <span class="quin">${escape(o.nom)}</span>
      <span class="barra"><span style="width:${((100 * o.quants) / maxim).toFixed(1)}%"></span></span>
      <span class="quants"><b>${nombre(o.quants)}</b></span>
    </li>`,
    )
    .join("");
  return `<figure class="families ofici">
  <ul>${files2}</ul>
  <figcaption>Les vuit més freqüents de les ${nombre(ambOcupacio)} persones que en declaren
  alguna, de ${nombre(total)}. Una persona pot tenir-ne més d'una.
  <b>De les altres ${nombre(total - ambOcupacio)}, Wikidata no en té cap d'escrita</b>: es mostren
  oficis quan n'hi ha, i no tenir-ne d'escrit no vol dir no tenir-ne.</figcaption>
</figure>`;
}

/**
 * «al Parlament, al Congrés… o al Govern», escrit a partir de les famílies que
 * de debò tenen algú i no a mà: si un dia s'hi afegeix una mena de càrrec, la
 * frase d'entrada l'ha de recollir sola en comptes de quedar-se curta.
 */
export function llistaDestins(families: SaltWikidata["families"]): string {
  const frases = families.filter((f) => f.persones > 0).map((f) => f.frase);
  if (frases.length === 0) return "";
  if (frases.length === 1) return frases[0]!;
  return `${frases.slice(0, -1).join(", ")} o ${frases[frases.length - 1]}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Qui són
// ─────────────────────────────────────────────────────────────────────────────

const anyDe = (iso: string | null): string => (iso === null ? "" : iso.slice(0, 4));

/**
 * Els noms de pila compostos més corrents, perquè «Joan Maria Roig» no vagi a
 * la M. Només fan falta quan el nom no porta la «i» entre cognoms, que és el
 * que delata on comencen: amb «Josep Maria Graells i Forcada», la «i» ja diu
 * que el primer cognom és Graells.
 */
const NOMS_COMPOSTOS: ReadonlySet<string> = new Set([
  "josep maria", "joan maria", "anna maria", "maria angels", "maria dolors", "maria teresa",
  "maria rosa", "maria carme", "maria jose", "maria jesus", "maria antonia", "joan carles",
  "joan josep", "joan manuel", "joan ramon", "joan antoni", "josep lluis", "josep antoni",
  "josep miquel", "josep ramon", "francesc xavier", "miquel angel", "lluis miquel", "pere joan",
  "jose maria", "juan carlos", "jose luis", "juan jose", "jose antonio", "juan antonio",
]);

/**
 * La lletra del primer cognom, per saltar per lletra a «Qui són».
 *
 * Els noms arriben com els escriu Wikidata o l'historial: «Montserrat Candini
 * i Puig», «Josep Maria Vila d'Abadal i Serra», «Román Ruiz Llamas». La
 * regla, de més segura a menys:
 *  - si hi ha una «i» entre cognoms, el primer cognom és la paraula d'abans
 *    (o les dues d'abans, si l'última comença amb «d'»: Vila d'Abadal);
 *  - si no n'hi ha, és la penúltima paraula, tret que el nom de pila sigui
 *    compost i només hi hagi un cognom («Joan Maria Roig»);
 *  - amb dues paraules, la segona.
 * És una eina per navegar, no una dada: si algun nom cau a la lletra que no
 * toca, la cerca el troba igual, i per això la cerca va primer.
 * Torna una lletra de la A a la Z sense accent, o «#» si no en surt cap.
 */
export function inicialCognom(nom: string): string {
  const paraules = nom.trim().split(/\s+/).filter(Boolean);
  const net = (w: string): string => w.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  let on = -1;
  const i = paraules.findIndex((w, k) => k > 1 && net(w) === "i");
  if (i > 1) on = i - 1;
  else if (paraules.length === 3 && NOMS_COMPOSTOS.has(net(`${paraules[0]} ${paraules[1]}`))) on = 2;
  else if (paraules.length >= 3) on = paraules.length - 2;
  else if (paraules.length === 2) on = 1;
  else on = 0;
  if (on > 1 && /^d['’]/i.test(paraules[on] ?? "")) on -= 1;
  const lletra = net(paraules[on] ?? "").replace(/^d['’]/, "").charAt(0).toUpperCase();
  return /^[A-Z]$/.test(lletra) ? lletra : "#";
}

/**
 * El pas d'una persona: d'on venia i on va arribar.
 *
 * Les famílies i el nom normalitzat van a atributs de dades de la mateixa
 * targeta perquè el filtre i la cerca de la llista no hagin de tornar a llegir
 * el text: amagar una fitxa és canviar `hidden`, i prou.
 */
export function fitxaPersona(p: SaltPersona): string {
  const on = p.municipis
    .map((m) => (m.slug === null ? escape(m.nom) : `<a href="../m/${escape(m.slug)}/">${escape(m.nom)}</a>`))
    .join(", ");
  const carrecs = p.carrecs
    .map((c) => {
      const anys =
        c.inici === null
          ? ""
          : ` <span class="quan">${anyDe(c.inici)}${c.fi === null ? "–" : c.fi.slice(0, 4) === c.inici.slice(0, 4) ? "" : `–${c.fi.slice(0, 4)}`}</span>`;
      return `<li class="f-${c.familia}">${escape(c.nom)}${anys}</li>`;
    })
    .join("");
  /*
   * La cara, per aquest ordre: el retrat oficial de l'ajuntament quan encara
   * seu al ple; si no, el de Wikimedia Commons que J28 ha baixat, amb el
   * crèdit al peu de la targeta; i si no hi ha cap dels dos, les inicials de
   * `cara()`, amb la mateixa mida i la mateixa vora que a la resta de
   * l'Observatori. No hi ha partit a les targetes, i per això les inicials no
   * porten el color de cap.
   */
  const retrat = p.foto === null && p.retrat !== null ? retratWikimedia(p.retrat, 56) : cara(p.nom, p.foto, { mida: 56 });
  // El crèdit va on la llicència el demana: a la vista, al peu de la mateixa
  // targeta que ensenya la cara, i mai darrere d'un «title».
  const credit = p.foto === null && p.retrat !== null ? ` · ${creditRetrat(p.retrat)}` : "";
  const anys = p.primerAny === 0 ? "" : p.ultimAny > p.primerAny ? `${p.primerAny}–${p.ultimAny}` : `${p.primerAny}`;
  return `<li class="persona" data-families="${escape(p.families.join(" "))}" data-nom="${escape(normalizePersonName(p.nom))}" data-lletra="${inicialCognom(p.nom)}">
  <div class="cap">${retrat}
    <p class="qui"><b><a href="${escape(p.fitxa)}">${escape(p.nom)}</a></b>
    <span class="alcaldia">alcaldia a ${on}${anys === "" ? "" : ` · ${anys}`}</span></p></div>
  <ul class="carrecs">${carrecs}</ul>
  ${p.ocupacions.length === 0 ? "" : `<p class="ofici">Abans: ${escape(p.ocupacions.join(", "))}</p>`}
  <p class="origen"><a href="${escape(p.url)}" rel="noopener">${escape(p.qid)}</a>${
    p.viquipedia === null ? "" : ` · <a href="${escape(p.viquipedia)}" rel="noopener">Viquipedia</a>`
  }${p.aparellat ? "" : " · no lliga amb el nostre historial"}${credit}</p>
</li>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// L'estil
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Només el que és d'aquesta pàgina. Tot el que és comú —la capçalera, els
 * blocs, la tipografia, les cares, les taules amagades dels gràfics— surt de
 * `RADIOGRAFIA_CSS`, i les barres fan servir els colors que ja hi ha declarats
 * en comptes d'inventar-ne cap de nou.
 */
export const TRAJECTORIA_CSS = `
.bloc h3{font-family:var(--display);font-weight:900;font-size:1.2rem;letter-spacing:-.02em;
  margin:var(--e4) 0 var(--e2)}

.families{margin:var(--e3) 0}
.families ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
.families li{display:grid;grid-template-columns:minmax(96px,9.5rem) minmax(0,1fr) auto;
  gap:var(--e2);align-items:center}
.families .quin{font-weight:700;font-size:.92rem;line-height:1.25;font-variant-numeric:tabular-nums}
.families .barra{height:20px;background:var(--vora);border-radius:var(--r-max);overflow:hidden}
.families .barra > span{display:block;height:100%;background:var(--coral);
  border-radius:var(--r-max);border:1.5px solid var(--ink);position:relative;overflow:hidden}
/* La part de dins de la barra: qui encara hi és, o on va canviar el color. */
.families .barra > span > i{position:absolute;left:0;top:0;bottom:0;display:block;background:var(--ink);opacity:.55}
.families.ofici .barra > span{background:var(--lavanda)}
.families .quants{font-size:.8rem;color:var(--ink-suau);white-space:nowrap;display:flex;flex-direction:column;line-height:1.2}
.families .quants b{font-family:var(--display);font-weight:900;font-size:1.25rem;color:var(--ink);
  margin-right:5px}
.families .quants small{font-size:.72rem;font-weight:700}
.families figcaption{font-size:.92rem;color:var(--ink-suau);margin-top:var(--e3);max-width:62ch}
.families .clau{display:inline-flex;align-items:center;gap:6px;margin-right:var(--e2);font-weight:700;color:var(--ink)}
.families .clau i{width:12px;height:12px;border-radius:3px;display:inline-block;border:1.5px solid var(--ink)}
.families .clau i.tot{background:var(--coral)}
.families .clau i.curs{background:color-mix(in srgb,var(--ink) 55%,var(--coral))}
@media (max-width:520px){
  .families li{grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"quin quants" "barra barra";row-gap:4px}
  .families .quin{grid-area:quin}.families .barra{grid-area:barra}.families .quants{grid-area:quants;text-align:right}
}

.longeus{list-style:none;padding:0;margin:var(--e2) 0 0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.longeus li{display:grid;grid-template-columns:2rem minmax(0,1fr) auto;gap:10px;align-items:center;
  border:2px solid var(--vora);border-radius:var(--r-m);padding:9px 12px;background:var(--paper-2)}
.longeus li:hover{border-color:var(--ink);box-shadow:var(--ombra)}
.longeus .pos{font-family:var(--display);font-weight:900;font-size:1.15rem;color:var(--coral-text);font-variant-numeric:tabular-nums}
.longeus .qui{min-width:0}
.longeus .qui > a{font-weight:800;color:var(--ink)}
.longeus .qui small{display:block;color:var(--ink-suau);font-size:.76rem;margin-top:1px}
.longeus .qui small a{color:inherit;font-weight:600;text-decoration-color:var(--vora)}
.longeus .dada{font-family:var(--display);font-weight:900;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;line-height:1.1}
.longeus .dada small{display:block;font-family:var(--text);font-weight:700;color:var(--ink-suau);font-size:.74rem}
@media (max-width:760px){.longeus{grid-template-columns:1fr}}

.mes-relleus{list-style:none;padding:0;margin:var(--e2) 0 0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px var(--e3)}
.mes-relleus li{display:flex;flex-direction:column;gap:1px;font-size:.92rem;padding:6px 0;border-bottom:1.5px solid var(--vora)}
.mes-relleus li a{font-weight:800}
.mes-relleus li span{font-size:.8rem;color:var(--ink-suau);font-weight:700}
@media (max-width:520px){.mes-relleus{grid-template-columns:1fr}}

.decades{list-style:none;margin:var(--e2) 0 0;padding:0;display:flex;flex-wrap:wrap;gap:var(--e2)}
.decades li{display:flex;flex-direction:column;gap:2px;font-size:.86rem;color:var(--ink-suau)}
.decades li b{font-family:var(--display);font-weight:900;font-size:.95rem;color:var(--ink)}

.gent{list-style:none;margin:var(--e3) 0 0;padding:0;display:grid;gap:var(--e2);
  grid-template-columns:repeat(auto-fill,minmax(280px,1fr))}
.persona{background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);
  padding:var(--e2);box-shadow:var(--ombra)}
.persona .cap{display:flex;gap:10px;align-items:flex-start;margin-bottom:10px}
/* El retrat de Commons pren la mateixa forma que la cara de la casa. */
.persona .retrat{width:56px;height:56px;flex:0 0 auto;border-radius:50%;
  border:2px solid var(--ink);box-shadow:2px 2px 0 var(--ink);object-fit:cover;background:var(--paper-2)}
.persona .qui{margin:0;line-height:1.3}
.persona .qui b{font-family:var(--display);font-weight:900;font-size:1.05rem;letter-spacing:-.02em}
.persona .qui a{color:inherit}
.persona .alcaldia{display:block;font-size:.84rem;color:var(--ink-suau);font-weight:700;margin-top:2px}
.persona .carrecs{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}
.persona .carrecs li{font-size:.86rem;padding-left:14px;position:relative;line-height:1.35}
.persona .carrecs li::before{content:"";position:absolute;left:0;top:.45em;width:8px;height:8px;
  border-radius:2px;background:var(--coral);border:1.5px solid var(--ink)}
.persona .carrecs .f-govern::before{background:var(--lavanda)}
.persona .carrecs .f-diputacio::before{background:var(--menta)}
.persona .carrecs .f-europeu::before{background:var(--presec)}
.persona .quan{color:var(--ink-suau);font-size:.8rem;white-space:nowrap}
.persona .ofici{margin:10px 0 0;font-size:.84rem;color:var(--ink-suau)}
.persona .origen{margin:8px 0 0;font-size:.74rem;color:var(--ink-suau)}
.persona .origen a{color:inherit}

.filtra{display:flex;flex-wrap:wrap;gap:8px;margin:var(--e3) 0 0;align-items:center}
.filtra button{font:inherit;font-size:.84rem;font-weight:800;cursor:pointer;
  background:var(--paper-2);color:var(--ink);border:2px solid var(--ink);
  border-radius:var(--r-max);padding:7px 14px;min-height:38px}
.filtra button[aria-pressed="true"]{background:var(--ink);color:var(--paper)}
.filtra label{flex:1 1 220px;display:flex;flex-direction:column;gap:3px;font-size:.8rem;font-weight:800}
.filtra input{font:inherit;font-size:.95rem;min-height:42px;border:2px solid var(--ink);border-radius:9px;
  background:var(--paper);padding:7px 10px;color:var(--ink)}
/* «.gent > li» d'estil.ts posa display:flex a cada targeta i, com que és una
   regla nostra, guanya al [hidden]{display:none} del navegador: el filtre
   canviava l'atribut i no s'amagava cap targeta. La caixa dels botons té el
   mateix problema al revés: neix amagada i el seu display:flex la ensenyava
   sense JavaScript. Les dues regles s'escriuen aquí perquè el [hidden] valgui. */
.gent > .persona[hidden],.filtra[hidden]{display:none}
.quants-gent{margin:var(--e2) 0 0;font-size:.86rem;color:var(--ink-suau);font-weight:700}

/* --- «Qui són»: la cerca primer, el salt per lletra i les pàgines ---------
   La cerca ocupa tota la fila i va primer: és com es busca algú concret. Les
   lletres van en una tira que llisca de costat quan no hi caben, en lloc de
   fer tres files de botons abans de la primera targeta; la tira té el seu
   propi desplaçament i la pàgina no se'n mou. Cada lletra és un objectiu de
   44 px. Les famílies, a sota, com abans. */
.filtra label{flex-basis:100%}
.tj-lletres{display:flex;gap:4px;flex:1 1 100%;overflow-x:auto;padding:2px 2px 6px;
  scrollbar-width:thin;-webkit-overflow-scrolling:touch}
.tj-lletres button{min-width:44px;min-height:44px;padding:0 10px;flex:none;border-radius:var(--r-s)}
.tj-families{display:flex;flex-wrap:wrap;gap:8px;flex:1 1 100%}
.filtra button:focus-visible{outline:3px solid var(--coral-text);outline-offset:2px}
.tj-mes-fila{margin:var(--e3) 0 0}
.tj-mes{font:inherit;font-weight:800;color:var(--ink);background:var(--paper);border:2px solid var(--ink);
  border-radius:var(--r-max);padding:0 18px;min-height:44px;cursor:pointer}
.tj-mes:hover{background:var(--ink);color:var(--paper)}
.tj-mes:focus-visible{outline:3px solid var(--coral-text);outline-offset:2px}
.tj-mes[hidden]{display:none}
`;

// ─────────────────────────────────────────────────────────────────────────────
// La pàgina
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Quantes targetes es veuen de cop a «Qui són», i quantes n'afegeix cada
 * «Mostra'n més».
 *
 * La llista eren totes les targetes obertes —908 en algun moment, 77.000 px a
 * 360—, i qui hi arriba o busca algú concret o en vol veure uns quants. Ara
 * la cerca va primer, sota hi ha el salt per lletra del primer cognom i la
 * llista es veu de 24 en 24. Sense JavaScript no hi ha ni cerca ni pàgines, i
 * la llista surt sencera: és el mínim que la pàgina ha de complir sempre.
 */
export const PAS_GENT = 24;

const FILTRE = `
<script>
(function(){
  // El filtre i la cerca els posa el guió: sense JavaScript no hi ha cap botó
  // que no faci res, i la llista surt sencera, que és el correcte.
  var caixa = document.querySelector(".filtra");
  var gent = document.querySelector(".gent");
  var quants = document.querySelector(".quants-gent");
  var mes = document.querySelector(".tj-mes");
  if (!caixa || !gent) return;
  caixa.hidden = false;
  var PAS = ${PAS_GENT};
  var botons = caixa.querySelectorAll("button[data-familia]");
  var lletres = caixa.querySelectorAll("button[data-lletra]");
  var cerca = caixa.querySelector("input[type=search]");
  var targetes = gent.querySelectorAll(".persona[data-families]");
  var clau = "tots";
  var lletra = "totes";
  var fins = PAS;
  // La mateixa neteja que el nom porta a data-nom: sense accents ni majúscules.
  var neteja = function(s){
    return (s || "").normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\\s+/g, " ").trim();
  };
  var aplica = function(){
    var text = neteja(cerca ? cerca.value : "");
    var visibles = 0;
    var trobades = 0;
    targetes.forEach(function(li){
      // Famílies senceres i no un tros de text: «senat» no ha de trobar res
      // dins de cap altra clau, ara ni quan se n'afegeixi una.
      var families = (li.getAttribute("data-families") || "").split(" ");
      var amaga = (clau !== "tots" && families.indexOf(clau) === -1)
        || (lletra !== "totes" && li.getAttribute("data-lletra") !== lletra)
        || (text !== "" && (li.getAttribute("data-nom") || "").indexOf(text) === -1);
      if (!amaga) trobades += 1;
      // Les que hi entren però passen de la pàgina també s'amaguen: es veuen
      // en tocar «Mostra'n més», sense haver de tornar a buscar.
      if (!amaga && trobades > fins) amaga = true;
      li.hidden = amaga;
      if (!amaga) visibles += 1;
    });
    if (quants) {
      quants.textContent = clau === "tots" && lletra === "totes" && text === "" && visibles === targetes.length
        ? "Es mostren les " + visibles + " persones."
        : "Es mostren " + visibles + " de " + (trobades === targetes.length ? targetes.length : trobades + " trobades, de " + targetes.length) + " persones.";
    }
    if (mes) {
      var resten = trobades - visibles;
      mes.hidden = resten <= 0;
      mes.textContent = "Mostra'n " + Math.min(PAS, resten) + " més (en queden " + resten + ")";
    }
  };
  var tria = function(grup, b, desa){
    grup.forEach(function(o){ o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
    desa();
    fins = PAS;
    aplica();
  };
  botons.forEach(function(b){
    b.addEventListener("click", function(){ tria(botons, b, function(){ clau = b.getAttribute("data-familia"); }); });
  });
  lletres.forEach(function(b){
    b.addEventListener("click", function(){ tria(lletres, b, function(){ lletra = b.getAttribute("data-lletra"); }); });
  });
  if (cerca) cerca.addEventListener("input", function(){ fins = PAS; aplica(); });
  if (mes) mes.addEventListener("click", function(){ fins += PAS; aplica(); });
  aplica();
})();
</script>`;

/** L'apartat del salt, només quan J21 s'ha executat. */
function seccioSalt(salt: SaltWikidata, historial: HistorialAlcaldies): string {
  const cobertura = `${nombre(salt.ambSalt)} de ${nombre(salt.totalPersones)}`;
  return `<section class="bloc" id="despres">
  <h2>On van després</h2>
  <p class="entrada-bloc">Això ja no ho diu la Generalitat: ho diu <b>Wikidata</b>, que coneix
  ${nombre(salt.totalPersones)} alcaldes catalans des del 1979 —dels ${nombre(historial.persones)} de
  l'historial oficial— i en té <b>${escape(cobertura)}</b> amb un càrrec per sobre de l'ajuntament escrit:
  ${escape(llistaDestins(salt.families))}. Surten de ${nombre(salt.municipisAmbSalt)} municipis.
  De la resta no se n'afirma res: <b>es mostren dades quan n'hi ha</b>.
  <a href="#cobertura">Com llegir aquestes xifres</a>.</p>
  ${barresFamilia(salt.families, salt.totalPersones)}

  <h3>Per dècades</h3>
  <p class="entrada-bloc">Cada persona compta a la dècada en què va estrenar alcaldia.</p>
  ${decades(salt.decades)}
  <p class="nota"><b>La baixada dels últims vint anys no vol dir que ara les carreres siguin
  més curtes</b>: vol dir que encara no han passat. Qui va estrenar alcaldia el 2015 té la
  carrera per fer, i el que aquest gràfic mesura d'aquella dècada és només el tros que ja s'ha
  esdevingut.</p>

  <h3>Què feien abans</h3>
  <p class="entrada-bloc">L'ocupació que Wikidata els atribueix, tret de «polític»,
  que no diu res de ningú.</p>
  ${ocupacions(salt.ocupacions, salt.ambOcupacio, salt.totalPersones)}

  <details class="nota" id="cobertura">
    <summary>Com llegir aquestes xifres</summary>
    <p>Aquest apartat ensenya el que Wikidata té escrit: <b>${escape(cobertura)}</b> són les
    persones que hi tenen un càrrec per sobre de l'ajuntament. De la resta no se n'afirma res,
    ni en un sentit ni en l'altre: <b>es mostren dades quan n'hi ha</b>.</p>
    <p>La font <b>cobreix molt millor la gent famosa</b>: dels ${nombre(salt.ambSalt)} amb el salt
    escrit, un ${escape(percent(salt.ambViquipediaSalt, salt.ambSalt))} té article a la Viquipedia
    catalana; dels altres ${nombre(salt.totalPersones - salt.ambSalt)}, un
    ${escape(percent(salt.ambViquipediaSenseSalt, salt.totalPersones - salt.ambSalt))}. És el que
    algú ha trobat prou notable per escriure'n, i per això aquí <b>no hi ha cap rànquing de
    municipis</b>: ordenaria qui té més article, no qui fa més carrera.</p>
    <p>L'historial oficial en porta ${nombre(historial.persones)} de diferents des del 1979; Wikidata
    en coneix ${nombre(salt.totalPersones)}, i ${nombre(salt.aparellades)} d'aquests lliguen amb el
    nostre pel nom i per les dates alhora. Els que no lliguen es publiquen igualment, marcats com a
    dades de Wikidata, i no s'enganxen a la fitxa de cap persona nostra: un càrrec atribuït a qui no
    toca és pitjor que un buit.</p>
  </details>
</section>`;
}

/** La llista dels que han fet el salt, amb la cerca i el filtre per mena de càrrec. */
function seccioGent(salt: SaltWikidata, persones: readonly SaltPersona[]): string {
  // La llista es llegeix del salt més recent al més antic i no per cap mesura
  // de rellevància: ordenar-la per «importància» del càrrec seria una opinió
  // nostra sobre què val més, i no és una cosa que sàpiga cap dada.
  const gent = [...persones].sort((a, b) => b.primerAny - a.primerAny || a.nom.localeCompare(b.nom, "ca"));
  const ambRetrat = gent.filter((p) => p.foto === null && p.retrat !== null).length;
  // Només les lletres que tenen algú: un botó «Q» que no troba ningú és un
  // carreró sense sortida.
  const lletres = [...new Set(gent.map((p) => inicialCognom(p.nom)))].sort((a, b) =>
    a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b, "ca"),
  );
  const botons = [
    `<button type="button" data-familia="tots" aria-pressed="true">Tots (${nombre(persones.length)})</button>`,
    ...salt.families
      .filter((f) => f.persones > 0)
      .map(
        (f) =>
          `<button type="button" data-familia="${escape(f.clau)}" aria-pressed="false">${escape(f.etiqueta)} (${nombre(f.persones)})</button>`,
      ),
  ].join("");
  return `<section class="bloc" id="gent">
  <h2>Qui són</h2>
  <p class="entrada-bloc">Els ${nombre(persones.length)} que Wikidata sap que han fet el salt, del més
  recent al més antic. <b>El nom porta a la seva fitxa</b>: la de regidor si encara seu al ple, i si no,
  la de la seva alcaldia. Cada targeta porta l'enllaç a l'ítem de Wikidata d'on surt.${
    ambRetrat === 0
      ? ""
      : ` La cara és el retrat que publica el seu ajuntament quan encara hi seu; ${nombre(ambRetrat)}
  porten un retrat de <b>Wikimedia Commons</b>, amb l'autor i la llicència al peu de la targeta;
  la resta, les inicials.`
  }</p>
  <div class="filtra" hidden>
    <label>Busca un nom <input type="search" autocomplete="off" placeholder="Nom o cognom"></label>
    <div class="tj-lletres" role="group" aria-label="Salta per la lletra del primer cognom">
      <button type="button" data-lletra="totes" aria-pressed="true">Totes</button>${lletres
        .map((l) => `<button type="button" data-lletra="${l}" aria-pressed="false">${l}</button>`)
        .join("")}
    </div>
    <div class="tj-families" role="group" aria-label="Quina mena de càrrec">${botons}</div>
  </div>
  <p class="quants-gent" aria-live="polite">Es mostren les ${nombre(persones.length)} persones.</p>
  <ul class="gent">${gent.map(fitxaPersona).join("")}</ul>
  <p class="tj-mes-fila"><button type="button" class="tj-mes" hidden></button></p>
</section>`;
}

export function renderTrajectoriaElectes(data: TrajectoriaData, generatedAt: string): string {
  const h = data.historial;
  const salt = data.salt;
  const unMandat = h.durades[0]!;
  const url = `${SITE}/observatori/trajectoria/`;
  // El cap per al cercador, amb les tres respostes de la pàgina i el
  // denominador de cadascuna: una xifra sola diria el que la font no diu.
  const cap = capSeo({
    titol: "Quant duren els que manen",
    descripcio: `Quants mandats duren les ${nombre(h.persones)} persones amb alcaldia als ${nombre(h.municipisTotal)} municipis des del ${h.primerMandat.slice(0, 4)}, ${nombre(h.totalRelleus)} relleus a mig mandat${
      salt === null ? "" : ` i els ${nombre(salt.ambSalt)} que han fet el salt`
    }.`,
    url,
    imatge: imatgeOg(FITXER_OG.global("trajectoria")),
    jsonLd: [filAriadna([...ARREL_OBSERVATORI, { nom: "Quant duren els que manen", url }])],
  });

  return `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${cap}
${tipografia("../")}
<style>${RADIOGRAFIA_CSS}${MASCOTA_CSS}${FOTOS_WIKIMEDIA_CSS}${TRAJECTORIA_CSS}</style>
</head>
<body>
<a class="salta" href="#contingut">Ves al contingut</a>

${capcalera("../", "trajectoria")}
${cercador("../")}

<main id="contingut">

<section class="portada">
  <div class="presenta">${papereta(120, "pregunta")}<div>
    <p class="micro">Els que manen als pobles</p>
    <h1>Quant duren, i on van</h1>
  </div></div>
  <p class="entrada">Qui arriba a la fitxa del seu alcalde es pregunta tres coses: quant
  durarà, si repetirà i què farà després. Les dues primeres es responen amb l'historial
  oficial d'alcaldies de tots els municipis des del ${h.primerMandat.slice(0, 4)}; la tercera,
  només amb el que Wikidata té escrit.</p>
  <p class="resum"><b>${nombre(h.persones)} persones</b> han tingut l'alcaldia d'algun dels
  ${nombre(h.municipisTotal)} municipis des del ${h.primerMandat.slice(0, 4)}. ${nombre(unMandat.persones)}
  (${escape(percent(unMandat.persones, h.persones))}) hi han estat un sol mandat i ${nombre(h.repeteixen)}
  n'han repetit. L'alcaldia ha canviat de mans a mig mandat ${nombre(h.totalRelleus)} vegades.</p>
  <p class="nota">Cada xifra porta el seu denominador i la seva font: l'historial de la Generalitat
  per als mandats i els relleus, Wikidata per als càrrecs de després. Qui mana avui encara no ha
  acabat, i es diu al costat de cada barra.</p>
</section>

<nav class="index" aria-label="Seccions d'aquesta pàgina">
  <a href="#duren">Quant duren</a>
  <a href="#relleus">Relleus a mig mandat</a>${
    salt === null ? "" : `
  <a href="#despres">On van després</a>
  <a href="#gent">Qui són</a>`
  }
  <a href="#font">D'on surt</a>
</nav>

<section class="bloc" id="duren">
  <h2>Quant duren</h2>
  <p class="entrada-bloc">Quants mandats ha tingut cada persona que ha estat alcaldia des del
  ${h.primerMandat.slice(0, 4)}, sobre les ${nombre(h.persones)} de l'historial oficial dels
  ${nombre(h.municipis)} municipis. ${nombre(h.actuals)} d'aquestes persones tenen l'alcaldia avui,
  i la seva encara no s'ha acabat: van marcades dins de la barra.</p>
  ${barresDurades(h.durades, h.persones)}
  <p class="nota">Un mandat en són quatre anys, del ${mandatLlegible(h.primerMandat)} al
  ${mandatLlegible(h.mandatActual)}, que és el que corre. Qui va entrar a mig mandat per un relleu
  compta aquell mandat com un de sencer: la font diu en quins mandats va tenir l'alcaldia, i és el que
  es compta.</p>

  <h3>Els que més anys hi han estat</h3>
  <p class="entrada-bloc">Les ${nombre(h.longeus.length)} persones amb més anys a la mateixa alcaldia.
  El nom porta a la seva fitxa; el municipi, a la del poble.</p>
  ${llistaLongeus(h.longeus)}
  <p class="nota">Els anys són aproximats: es compten de ple de constitució a ple de constitució
  —o fins avui per a qui encara hi és— i, dins d'un mandat amb relleu, per la data de presa de
  possessió que dona la font. Qui ha manat a dos municipis hi surt dues vegades, una per cada
  alcaldia.</p>
</section>

<section class="bloc" id="relleus">
  <h2>Relleus a mig mandat</h2>
  <p class="entrada-bloc">${nombre(h.totalRelleus)} vegades des del ${h.primerMandat.slice(0, 4)}
  l'alcaldia ha canviat de mans sense passar per les urnes: una dimissió, un pacte de rotació que
  es compleix, una moció de censura. La font no diu el motiu i aquí no s'inventa; el que sí que se'n
  desprèn és si el relleu es va quedar al mateix partit o va canviar de color, i va canviar en
  ${nombre(h.totalAmbCanviDeColor)}.</p>
  ${barresRelleus(h.relleus, h.mandatActual, h.municipis)}
  ${
    h.municipisAmbMesRelleus.filter((m) => m.relleus >= 2).length === 0
      ? ""
      : `<h3>On ha passat més cops</h3>
  <p class="entrada-bloc">Els municipis amb més mandats amb relleu. Cada nom porta a la seva taula
  d'alcaldies, que és on es veu qui va deixar pas a qui.</p>
  ${llistaMunicipisRelleus(h.municipisAmbMesRelleus)}`
  }
</section>

${salt === null ? "" : seccioSalt(salt, h)}
${salt === null || data.persones.length === 0 ? "" : seccioGent(salt, data.persones)}

<section class="bloc" id="font">
  <h2>D'on surt tot això</h2>
  <p><b>${escape(h.font)}</b>: tots els mandats dels ${nombre(h.municipis)} municipis del
  ${mandatLlegible(h.primerMandat)} al ${mandatLlegible(h.mandatActual)}, amb els relleus a mig mandat i
  la data de presa de possessió quan la font la dona. És la mateixa taula que publica la fitxa de cada
  municipi a l'apartat d'alcaldies, i els relleus es compten amb la mateixa regla que allà.</p>${
    salt === null
      ? `
  <p class="nota">L'apartat «On van després» surt de Wikidata i encara no s'ha carregat: es
  publicarà quan hi sigui.</p>`
      : `
  <p>${escape(salt.font)}, consultat amb SPARQL a
  <a href="${escape(salt.fontUrl)}" rel="noopener">${escape(salt.fontUrl)}</a>${
    salt.descarregat === null ? "" : ` el ${escape(dataCurta(salt.descarregat))}`
  }, per als càrrecs per sobre de l'ajuntament. Les dades de Wikidata són <b>${escape(salt.llicencia)}</b>.
  Es demanen les posicions «alcalde de…» amb àmbit d'aplicació a un municipi català i data d'inici a
  partir del 1979, i d'aquelles persones, tots els altres càrrecs amb la seva etiqueta en català. Els
  ítems duplicats —la mateixa persona amb dues fitxes— es fusionen en comptes de descartar-se.</p>`
  }
</section>

</main>

${
  // El mapa ja és al peu de totes les pàgines; el que aquesta té de propi és
  // que la gent que hi surt és de partits, i els partits no són al peu.
  peu("../", generatedAt, [{ text: "Els partits", on: "../partit/" }])
}
${FILTRE}
${GRAFICS_JS}
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// La càrrega
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El que ens cal de la fitxa de càrrecs de la seu electrònica: qui hi seu i
 * quin retrat en publica el seu ajuntament. La fitxa sencera la descriu
 * `radiografia.ts` i aquí no se'n toca res més.
 */
type GovernMetric = { mayorName?: string | null; mayorSigles?: string | null } | null;

/**
 * Qui té l'alcaldia avui a cada municipi i on és la seva fitxa, decidit per
 * `resolAlcaldia()` amb la mateixa regla que la fitxa del municipi i la llista
 * dels 947: si aquí es decidís d'una altra manera, l'enllaç aniria a una
 * pàgina que no hi és. Torna també el retrat petit, per a les targetes del
 * salt.
 */
async function carregaAlcaldiesActuals(
  db: Db,
  munis: readonly { id: number; mayorName: string | null }[],
): Promise<Map<number, AdrecaActual & { foto: string | null }>> {
  const carrecsSeu = await carregaCarrecsAlcaldia(db);
  const pleRegistre = await carregaPleDelRegistre(db);
  const governs = new Map<number, GovernMetric>();
  for (const fila of await db
    .select({ municipalityId: municipalityMetrics.municipalityId, data: municipalityMetrics.data })
    .from(municipalityMetrics)
    .where(eq(municipalityMetrics.kind, "government"))) {
    governs.set(fila.municipalityId, fila.data as GovernMetric);
  }
  const sortida = new Map<number, AdrecaActual & { foto: string | null }>();
  for (const m of munis) {
    const govern = governs.get(m.id) ?? null;
    const alcaldia = resolAlcaldia(
      carrecsSeu.get(m.id) ?? null,
      { mayorName: govern?.mayorName ?? m.mayorName, mayorSigles: govern?.mayorSigles ?? null },
      pleRegistre.get(m.id) ?? null,
    );
    if (alcaldia.nom === null || alcaldia.adreca === null) continue;
    const clau = normalizePersonName(alcaldia.nom);
    if (clau === "") continue;
    sortida.set(m.id, { clau, adreca: alcaldia.adreca, foto: alcaldia.fotoPetita });
  }
  return sortida;
}

/**
 * Ajunta l'historial oficial i, si J21 s'ha executat, les 947 fitxes del salt.
 *
 * La mateixa persona de Wikidata és a la fitxa de cada municipi on va ser
 * alcalde —n'hi ha que en tenen dos— i per això aquí es dedupliquen **pel
 * QID**: sense això, qui va manar a dos pobles comptaria dues vegades i el
 * total no quadraria amb el que diu la feina d'ingesta.
 *
 * Torna `null` només si no hi ha historial d'alcaldies: sense J21 la pàgina
 * surt igualment, amb les dues primeres preguntes respostes i la tercera
 * pendent, que és millor que cap pàgina.
 */
export async function loadTrajectoriaElectes(db: Db, avui: string = new Date().toISOString().slice(0, 10)): Promise<TrajectoriaData | null> {
  const munis = await db
    .select({ id: municipalities.id, slug: municipalities.slug, name: municipalities.name, mayorName: municipalities.mayorName })
    .from(municipalities);
  const perId = new Map<number, MunicipiBasic>(munis.map((m) => [m.id, { slug: m.slug, nom: m.name }]));

  const historialFiles = await db
    .select({
      municipalityId: mayors.municipalityId,
      term: mayors.term,
      name: mayors.name,
      partyRaw: mayors.partyRaw,
      tookOfficeOn: mayors.tookOfficeOn,
    })
    .from(mayors);
  const actuals = await carregaAlcaldiesActuals(db, munis);
  const historial = calculaHistorial(historialFiles, perId, { avui, actuals });
  if (historial === null) return null;

  // Qui de l'historial és a cada municipi, per donar la fitxa històrica a
  // qui Wikidata ha aparellat amb ell: el slug surt del nom que publiquem
  // nosaltres, no del que escriu Wikidata, que pot portar un segon cognom de
  // més o de menys.
  const nomsHistorial = new Map<string, { term: string; nom: string }>();
  for (const f of historialFiles) {
    const clau = `${f.municipalityId}|${normalizePersonName(f.name)}`;
    // La fila més recent mana el nom, com a `calculaHistorial`.
    const ja = nomsHistorial.get(clau);
    if (ja === undefined || f.term >= ja.term) nomsHistorial.set(clau, { term: f.term, nom: f.name });
  }

  const files = await db
    .select({ municipalityId: municipalityMetrics.municipalityId, data: municipalityMetrics.data })
    .from(municipalityMetrics)
    .where(eq(municipalityMetrics.kind, KIND));
  if (files.length === 0) return { historial, salt: null, persones: [] };

  /*
   * Els retrats de Wikimedia Commons que J28 ha baixat dels exalcaldes, per
   * QID: qui ha manat a dos pobles és a les dues fitxes amb el mateix fitxer,
   * i amb un se'n té prou. Si J28 no s'ha executat no n'hi ha cap i les
   * targetes porten inicials, que és el correcte.
   */
  const retrats = new Map<string, Retrat>();
  const fotos = await db
    .select({ data: municipalityMetrics.data })
    .from(municipalityMetrics)
    .where(eq(municipalityMetrics.kind, KIND_FOTOS));
  for (const fila of fotos) {
    const llista = (fila.data as FitxaFotosExalcaldes | null)?.persones;
    if (!Array.isArray(llista)) continue;
    for (const p of llista) if (!retrats.has(p.qid)) retrats.set(p.qid, p);
  }

  const persones = new Map<string, SaltPersona>();
  const totsElsQid = new Set<string>();
  const perDecada = new Map<number, { alcaldes: number; ambSalt: number }>();
  const primerAnyPerQid = new Map<string, number>();
  const teSalt = new Set<string>();
  const teViquipedia = new Set<string>();
  const teOcupacio = new Set<string>();
  const aparellats = new Set<string>();
  const comptaOcupacio = new Map<string, Set<string>>();
  const perFamilia = new Map<Familia, Set<string>>(FAMILIES.map((f) => [f.clau, new Set()]));
  let municipisAmbSalt = 0;

  let font = "Wikidata (wikidata.org)";
  let fontUrl = "https://query.wikidata.org/sparql";
  let llicencia = "CC0 1.0";
  let descarregat: string | null = null;

  for (const fila of files) {
    const fitxa = fila.data as FitxaTrajectoria;
    const muni = perId.get(fila.municipalityId);
    if (!Array.isArray(fitxa?.persones) || muni === undefined) continue;
    font = fitxa.font ?? font;
    fontUrl = fitxa.url ?? fontUrl;
    llicencia = fitxa.llicenciaDades ?? llicencia;
    // La data d'extracció és la mateixa per a totes les fitxes d'una execució;
    // si per un reintent a mitges n'hi hagués dues, es publica la més recent,
    // que és la que descriu el que el lector està veient.
    if (fitxa.descarregat && (descarregat === null || fitxa.descarregat > descarregat)) {
      descarregat = fitxa.descarregat;
    }
    if (fitxa.persones.some((p) => p.carrecs.length > 0)) municipisAmbSalt += 1;

    for (const p of fitxa.persones) {
      totsElsQid.add(p.qid);
      if (p.viquipedia) teViquipedia.add(p.qid);
      if (p.aparellat) aparellats.add(p.qid);
      if (p.ocupacions.length > 0) teOcupacio.add(p.qid);
      for (const ofici of p.ocupacions) {
        const grup = comptaOcupacio.get(ofici);
        if (grup === undefined) comptaOcupacio.set(ofici, new Set([p.qid]));
        else grup.add(p.qid);
      }

      const anys = p.mandats.map((m) => Number(m.inici.slice(0, 4))).filter(Number.isFinite);
      const finals = p.mandats.map((m) => Number((m.fi ?? m.inici).slice(0, 4))).filter(Number.isFinite);
      const primer = anys.length === 0 ? 0 : Math.min(...anys);
      if (primer > 0) {
        const previ = primerAnyPerQid.get(p.qid);
        // Qui ha manat a dos pobles compta a la dècada del primer dels dos.
        if (previ === undefined || primer < previ) primerAnyPerQid.set(p.qid, primer);
      }

      if (p.carrecs.length === 0) continue;
      teSalt.add(p.qid);
      for (const c of p.carrecs) perFamilia.get(c.familia)?.add(p.qid);

      /*
       * On porta el seu nom des d'aquesta pàgina. Si té l'alcaldia avui i
       * fitxa de regidor, allà; si lliga amb el nostre historial, a la fitxa
       * d'alcaldia històrica, anomenada pel nom que publiquem nosaltres; i si
       * no lliga, a l'historial d'alcaldies del municipi, que hi és sempre.
       * No s'enganxa mai una fitxa nostra a qui no lliga: un càrrec atribuït a
       * qui no toca és pitjor que un buit.
       */
      const clau = normalizePersonName(p.nom);
      const actual = actuals.get(fila.municipalityId);
      const propia = actual !== undefined && actual.clau === clau;
      const nomNostre = nomsHistorial.get(`${fila.municipalityId}|${clau}`)?.nom ?? null;
      const fitxaUrl = propia
        ? `../m/${muni.slug}/${actual.adreca}`
        : p.aparellat && nomNostre !== null
          ? fitxaAlcaldia(muni.slug, nomNostre)
          : `../m/${muni.slug}/#alcaldies`;
      const foto = propia ? actual.foto : null;

      const ja = persones.get(p.qid);
      const municipi = { nom: muni.nom, slug: muni.slug };
      if (ja === undefined) {
        persones.set(p.qid, {
          qid: p.qid,
          url: p.url,
          nom: p.nom,
          viquipedia: p.viquipedia,
          municipis: [municipi],
          primerAny: primer,
          ultimAny: finals.length === 0 ? primer : Math.max(...finals),
          families: [...new Set(p.carrecs.map((c) => c.familia))],
          carrecs: p.carrecs.map((c) => ({ nom: c.nom, familia: c.familia, inici: c.inici, fi: c.fi })),
          ocupacions: p.ocupacions,
          aparellat: p.aparellat,
          fitxa: fitxaUrl,
          foto,
          retrat: retrats.get(p.qid) ?? null,
        });
      } else {
        // Segon municipi de la mateixa persona: s'hi afegeix el poble i
        // s'eixamplen els anys. Els càrrecs ja hi són, són els mateixos.
        if (!ja.municipis.some((m) => m.slug === municipi.slug)) ja.municipis.push(municipi);
        if (primer > 0 && (ja.primerAny === 0 || primer < ja.primerAny)) ja.primerAny = primer;
        if (finals.length > 0) ja.ultimAny = Math.max(ja.ultimAny, ...finals);
        ja.aparellat = ja.aparellat || p.aparellat;
        // Qui ha manat a dos pobles: mana la fitxa de regidor si n'hi ha cap,
        // i si no, la primera fitxa d'alcaldia que lligui. L'historial del
        // municipi és el destí de segona i només s'hi va quan no n'hi ha cap.
        const rang = (u: string): number => (u.includes("/regidor/") ? 2 : u.includes("/alcaldia/") ? 1 : 0);
        if (rang(fitxaUrl) > rang(ja.fitxa)) {
          ja.fitxa = fitxaUrl;
          ja.foto = foto;
        }
      }
    }
  }

  for (const [qid, primer] of primerAnyPerQid) {
    const decada = Math.floor(primer / 10) * 10;
    const compte = perDecada.get(decada) ?? { alcaldes: 0, ambSalt: 0 };
    compte.alcaldes += 1;
    if (teSalt.has(qid)) compte.ambSalt += 1;
    perDecada.set(decada, compte);
  }

  const totalPersones = totsElsQid.size;
  return {
    historial,
    salt: {
      font,
      fontUrl,
      llicencia,
      descarregat,
      totalPersones,
      aparellades: aparellats.size,
      ambSalt: teSalt.size,
      municipisAmbSalt,
      families: FAMILIES.map((f) => ({
        clau: f.clau,
        etiqueta: f.etiqueta,
        frase: f.frase,
        persones: perFamilia.get(f.clau)?.size ?? 0,
      })),
      decades: [...perDecada.entries()]
        .map(([decada, v]) => ({ decada, ...v }))
        .sort((a, b) => a.decada - b.decada),
      ocupacions: [...comptaOcupacio.entries()]
        .map(([nom, qids]) => ({ nom, quants: qids.size }))
        .sort((a, b) => b.quants - a.quants || a.nom.localeCompare(b.nom, "ca")),
      ambOcupacio: teOcupacio.size,
      ambViquipediaSalt: [...teSalt].filter((q) => teViquipedia.has(q)).length,
      ambViquipediaSenseSalt: [...totsElsQid].filter((q) => !teSalt.has(q) && teViquipedia.has(q)).length,
    },
    persones: [...persones.values()],
  };
}
