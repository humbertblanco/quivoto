import { de, nomLlegible } from "../lib/text";
import { RADIOGRAFIA_CSS } from "./estil";
import { SITE } from "./config";
import { ARREL_OBSERVATORI, capSeo, filAriadna, FITXER_OG, imatgeOg, titolAmbMarca, TITOL_MAXIM, DESCRIPCIO_MAXIMA } from "./seo";
import { ensLd, GEO_CSS, preguntesEns, preguntesRapides } from "./seo-ld";
import { GRAFICS_JS, serieTemporal, atributsEtiqueta, textEtiqueta, type PuntSerie } from "./grafics";
import { hemicycle, seientsHemicicle, type GrupHemicicle } from "./hemicycle";
import { quadres, type Caixa } from "./quadres";
import { renderUllada, type Pastilla } from "./comarques";
import { cara } from "./cara";
import { sigla } from "./sigla";
import { capcalera, tipografia } from "./capcalera";
import { cercador } from "./cercador";
import { peu } from "./peu";
import { PAPERETA_POSTURES_CSS, vinyetaPapereta } from "./mascota-postures";
import { GRIS_ENS, SENSE_PARTIT, colorSegur, ultimaDespesa } from "./ens-dades";
import { esSeientSenseNom } from "../jobs/j38-ens-supramunicipals";
import { SERVEIS_ENS_CSS, enllacosIndexServeis, renderContractacioEns, renderServeisSocialsEns } from "./serveis-ens-fitxa";
import { COOPERACIO_CSS, renderDinersGeneralitatEns } from "./cooperacio-fitxa";
import {
  adrecaEns,
  type DadesEns,
  type FontEns,
  type MembreEns,
  type RepartimentEns,
  type SubvencionsEns,
  type TipusEns,
} from "./ens-tipus";

/**
 * La fitxa d'un ens supramunicipal: una diputació o un consell comarcal.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PER QUÈ AQUESTA PÀGINA
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Quasi ningú no sap qui seu a la seva diputació ni al seu consell comarcal,
 * i és normal: **no es voten**. No hi ha cap papereta amb el seu nom. Els
 * seients se'ls reparteixen els partits a partir dels vots de les municipals
 * —les del 28 de maig del 2023— i cada partit hi envia regidors seus. Per això
 * el bloc que fa memorable la pàgina és la cadena: els vots del teu poble fan
 * regidors, i els regidors fan el ple de l'ens. Al costat hi ha el càlcul que
 * fa la llei amb aquells vots, i la pàgina només el presenta com «el que dona
 * la llei» quan quadra escó per escó amb el ple real; si no quadra, ho diu i
 * ensenya on no quadra, però mai no el pinta com si fos el ple.
 *
 * La resta és tranquil·la a propòsit: qui governa, tots els membres amb el
 * que **l'ens mateix** publica que els paga (mai sumat amb res d'un altre
 * pagador), d'on surten els diners i on van, què reparteix als ajuntaments i
 * els municipis de l'àmbit. Cada bloc té un estat buit escrit amb la veu de la
 * pàgina: si la font no publica una dada, es diu que no la publica, no es
 * converteix en un zero ni desapareix sense avisar.
 *
 * La pàgina és la mateixa per als dos tipus d'ens; el que canvia són les
 * paraules (diputats o consellers, demarcació o comarca, quina llei) i això
 * viu en una taula, `PARAULES`, com fa `territori.ts` per a comarca i AMB.
 *
 * L'esquelet és literalment el d'`amb.ts` i `comarques.ts`: capçalera,
 * cercador, portada, índex, blocs amb `h2`, fonts i peu. El CSS propi va amb
 * prefix `ens-` i només hi ha el que no tenia ja `RADIOGRAFIA_CSS`.
 */

// ------------------------------------------------------------------ paraules

/**
 * Les frases que canvien d'un tipus d'ens a l'altre, i només aquestes.
 *
 * El gènere va en plural genèric («diputats», «consellers») perquè són
 * recomptes de seients; quan es parla d'una persona concreta, mana el càrrec
 * literal que publica la font («Presidenta», «Vicepresident 1r»).
 */
type Paraules = {
  /** La primera línia de la portada: «Diputació», «Consell comarcal». */
  micro: string;
  /** «la Diputació», «el consell». */
  ens: string;
  /** «La Diputació», «El consell». */
  Ens: string;
  /** «de la Diputació», «del consell». */
  delEns: string;
  /** «a la Diputació», «al consell». */
  alEns: string;
  membre: string;
  membres: string;
  /** «la demarcació», «la comarca». */
  territori: string;
  /** «de la demarcació», «de la comarca». */
  delTerritori: string;
  /** La llei que reparteix els seients, amb l'article. */
  llei: string;
  /** El text consolidat d'aquella llei. */
  lleiUrl: string;
  /** La preposició i l'article que porta el nom de la llei: «a la LOREG», «al Decret legislatiu». */
  aLaLlei: string;
};

const PARAULES: Record<TipusEns, Paraules> = {
  diputacio: {
    micro: "Diputació",
    ens: "la Diputació",
    Ens: "La Diputació",
    delEns: "de la Diputació",
    alEns: "a la Diputació",
    membre: "diputat",
    membres: "diputats",
    territori: "la demarcació",
    delTerritori: "de la demarcació",
    llei: "LOREG, articles 204 a 206",
    lleiUrl: "https://www.boe.es/buscar/act.php?id=BOE-A-1985-11672",
    aLaLlei: "a la",
  },
  consell: {
    micro: "Consell comarcal",
    ens: "el consell",
    Ens: "El consell",
    delEns: "del consell",
    alEns: "al consell",
    membre: "conseller",
    membres: "consellers",
    territori: "la comarca",
    delTerritori: "de la comarca",
    llei: "Decret legislatiu 4/2003, article 20",
    lleiUrl: "https://portaljuridic.gencat.cat/eli/es-ct/dlg/2003/11/04/4",
    aLaLlei: "al",
  },
};

/** «diputat» o «diputats», segons quants. */
function membresDe(p: Paraules, n: number): string {
  return n === 1 ? p.membre : p.membres;
}

// -------------------------------------------------------------- presentació

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const number = (n: number): string => Math.round(n).toLocaleString("ca-ES");
const decimal = (n: number, digits = 1): string =>
  n.toLocaleString("ca-ES", { minimumFractionDigits: digits, maximumFractionDigits: digits });

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/** Euros sencers: «1.234.567 €». Els cèntims d'un pressupost no diuen res. */
const euros = (n: number): string => `${number(n)} €`;

/**
 * Euros per habitant: sencers a partir de deu, amb un decimal per sota. «0 €»
 * per a un ajuntament que n'ha rebut trenta cèntims diria que no n'ha rebut cap.
 */
const eurosHab = (n: number): string => (Math.abs(n) < 10 && n !== 0 ? `${decimal(n)} €` : euros(n));

/**
 * Un import gran dit com es diu en veu alta: «412,3 milions d'euros». Per sota
 * del milió, l'import sencer. És el format del text; els eixos dels gràfics fan
 * servir `importCurt`, que hi cap.
 */
function milions(n: number): string {
  if (Math.abs(n) < 1_000_000) return euros(n);
  return `${decimal(n / 1_000_000)} milions d'euros`;
}

/**
 * Un import curt per a les xifres grosses, els eixos i les etiquetes: «412,3
 * M€» a partir del milió, «154 mil €» a partir del miler i els euros sencers
 * per sota. Mai «0,0 M€» per a un import que no és zero: el deute de 1.154 € del
 * Baix Llobregat s'escrivia així i semblava que no en tenia cap.
 */
function importCurt(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${decimal(n / 1_000_000)} M€`;
  if (a >= 1_000) return `${number(n / 1_000)} mil €`;
  return euros(n);
}

/**
 * El nom d'una persona com es llegeix, no com el desa la font en majúscules.
 *
 * Un escó que la font dona amb partit i sense nom (`NOM_NO_PUBLICAT` de la J38,
 * dos al Montsià) es desa amb el nom buit, i aquí es diu què és: «Seient de CP
 * (la font no en dona el nom)». Així surt igual a la llista dels membres, a
 * l'hemicicle i a qualsevol lloc que escrigui el nom, i mai com un forat.
 */
const nomDe = (m: Pick<MembreEns, "nom" | "partit">): string =>
  esSeientSenseNom(m.nom) ? `Seient de ${m.partit ?? "partit no conegut"} (la font no en dona el nom)` : nomLlegible(m.nom);

/** El que es passa a `cara()`: el nom, o un interrogant per a un escó sense nom, que no té inicials. */
const nomCara = (m: Pick<MembreEns, "nom" | "partit">): string => (esSeientSenseNom(m.nom) ? "?" : nomDe(m));

/** Una frase de text estàtic escrita en diverses línies, en una de sola. */
const pla = (text: string): string => text.replace(/\s+/g, " ").trim();

// ------------------------------------------------------------- les finances

/** Els totals d'un exercici, sumant només capítols del mateix pressupost. */
type Exercici = {
  any: number;
  /** Drets reconeguts de tots els capítols d'ingressos; null si cap no en té. */
  ingressos: number | null;
  /**
   * Despesa **no financera**: obligacions reconegudes dels capítols 1 a 7; null
   * si cap no en té. Els capítols 8 i 9 (préstecs donats i deute retornat) van a
   * part, a `financera`: comptar-los com a despesa faria que tornar un préstec
   * semblés gastar més.
   */
  despeses: number | null;
  /** Capítols 8 i 9 de despesa, si n'hi ha cap amb import. */
  financera: { actius: number | null; passius: number | null };
};

/**
 * Els totals de cada exercici liquidat.
 *
 * Aquí sí que se suma, i és l'única suma de la pàgina: els capítols d'un mateix
 * pressupost, del mateix ens i el mateix any, que és exactament el que fa la
 * liquidació quan escriu el total. Un capítol sense import no compta com a
 * zero —simplement no hi és—, i un exercici sense cap capítol amb import no té
 * total: és `null`, i es dibuixa com un forat.
 */
function exercicis(d: DadesEns): Exercici[] {
  if (!d.finances) return [];
  const suma = (valors: (number | null)[]): number | null => {
    const nets = valors.filter((v): v is number => v !== null);
    return nets.length === 0 ? null : nets.reduce((a, v) => a + v, 0);
  };
  return d.finances.anys.map(({ any, capitols }) => {
    const despesa = (n: number): number | null =>
      capitols.find((c) => c.tipus === "despeses" && c.capitol === n)?.liquidat ?? null;
    return {
      any,
      ingressos: suma(capitols.filter((c) => c.tipus === "ingressos").map((c) => c.liquidat)),
      despeses: suma(capitols.filter((c) => c.tipus === "despeses" && c.capitol <= 7).map((c) => c.liquidat)),
      financera: { actius: despesa(8), passius: despesa(9) },
    };
  });
}

/**
 * L'exercici que obre la pàgina: el de `ultimaDespesa()`, la mateixa regla que
 * fa servir l'índex (l'últim any amb els capítols 1, 2 i 4), perquè la fitxa i
 * l'índex diguin la mateixa xifra.
 */
function ultimExercici(d: DadesEns): Exercici | null {
  const u = ultimaDespesa(d);
  if (!u) return null;
  return exercicis(d).find((e) => e.any === u.any) ?? null;
}

/**
 * El deute viu que acompanya la despesa: el del mateix any si n'hi ha, perquè
 * les dues xifres de l'obertura parlin del mateix exercici; si no, l'últim
 * declarat (i la pastilla en diu l'any). `null` si l'ens no en declara cap.
 */
function ultimDeute(d: DadesEns): { any: number; deuteViu: number } | null {
  const deute = d.finances?.deute ?? [];
  if (deute.length === 0) return null;
  const any = ultimaDespesa(d)?.any;
  return deute.find((x) => x.any === any) ?? deute.reduce((a, e) => (e.any > a.any ? e : a));
}

/** Euros per habitant de l'àmbit, si hi ha padró per dividir. */
function perHabitant(d: DadesEns, total: number): number | null {
  return d.poblacio && d.poblacio > 0 ? total / d.poblacio : null;
}

// ----------------------------------------------------------------- adreces

/** El camí fins a `observatori/`: la diputació viu dos nivells avall, el consell tres. */
function baseDe(d: Pick<DadesEns, "tipus">): string {
  return d.tipus === "diputacio" ? "../../" : "../../../";
}

/** La fitxa del municipi. */
const adrecaMunicipi = (base: string, slug: string): string => `${base}m/${encodeURI(slug)}/`;

/**
 * La fitxa de la persona, només si l'aparellament amb el ple municipal és únic
 * (és el que vol dir que `adreca` no sigui null) i se sap de quin municipi és.
 */
function adrecaPersona(base: string, m: MembreEns): string | null {
  if (!m.adreca || !m.municipi) return null;
  return `${adrecaMunicipi(base, m.municipi.slug)}${m.adreca}`;
}

/** El nom de la persona, enllaçat a la seva fitxa quan n'hi ha. */
function nomEnllacat(base: string, m: MembreEns): string {
  const on = adrecaPersona(base, m);
  const nom = escape(nomDe(m));
  return on ? `<a href="${escape(on)}">${nom}</a>` : nom;
}

/**
 * «seu al ple de Manresa», «té l'alcaldia d'Algerri», amb el municipi enllaçat
 * i la preposició contreta (`de()`: «del Bruc», «d'Olot»); buit si no se sap.
 * Si el càrrec mateix ja diu «Alcalde President», la frase és la de l'alcaldia
 * encara que l'aparellament amb el ple no ho hagi pogut confirmar. La frase no
 * porta gènere perquè la font no el dona i endevinar-lo pel nom de pila és
 * equivocar-se de tant en tant.
 */
function dOn(base: string, m: MembreEns): string {
  if (!m.municipi) return "";
  const alcaldia = m.alcaldia || /\balcalde(ssa)?\b/i.test(m.carrec);
  // «de Manresa», «d'Olot», «del Bruc»: la preposició va fora de l'enllaç i,
  // quan s'ha contret amb l'article, el nom enllaçat és el que en queda.
  const nom = m.municipi.nom;
  const frase = de(nom);
  const tall = frase === `de ${nom}` ? 3 : frase === `d'${nom}` ? 2 : frase.indexOf(" ") + 1;
  const enllac = `<a href="${escape(adrecaMunicipi(base, m.municipi.slug))}">${escape(frase.slice(tall))}</a>`;
  return `${alcaldia ? "té l'alcaldia" : "seu al ple"} ${escape(frase.slice(0, tall))}${enllac}`;
}

/**
 * El càrrec tal com es mostra. Si la persona presideix però el càrrec literal
 * no ho diu (el registre de plens la té de «Conseller» i és el registre d'ens
 * locals qui diu que presideix), s'escriu així, amb la font, i l'avís de la
 * pàgina ho explica.
 */
function carrecVisible(m: MembreEns): string {
  if (m.rol === "presidencia" && !/presid/i.test(m.carrec)) return "Presidència, segons el registre d'ens locals";
  return m.carrec;
}

/** La pastilla del partit amb què hi seu, o res si la font no ho diu. */
function pastillaPartit(base: string, m: Pick<MembreEns, "partit" | "color">): string {
  return m.partit ? sigla(m.partit, { base, color: colorSegur(m.color) }) : "";
}

// ------------------------------------------------------------------ portada

/** La persona que presideix, en la mateixa forma que l'alcaldia de la fitxa municipal. */
function renderPresidencia(d: DadesEns, base: string): string {
  const p = d.presidencia;
  if (!p) {
    return `<p class="nota">La font no diu qui presideix ${escape(PARAULES[d.tipus].ens)}.</p>`;
  }
  const on = dOn(base, p);
  return `<div class="alcaldia ens-presidencia">
    ${cara(nomCara(p), p.foto, { color: colorSegur(p.color) })}
    <div class="qui-mana">
      <span class="carrec-alcaldia">${escape(carrecVisible(p))} ${pastillaPartit(base, p)}</span>
      <span class="nom-alcaldia">${nomEnllacat(base, p)}</span>
      ${on ? `<span class="relleu-alcaldia">${on}</span>` : ""}
    </div>
  </div>`;
}

/**
 * Les quatre xifres de l'obertura: quants seients, quants municipis, quant gasta
 * i quant deu. Cap xifra no és nova: cada pastilla porta al bloc que l'explica.
 * Quan no hi ha dada, la pastilla no desapareix: diu «no consta» o «no en
 * declara», que també és una resposta.
 */
function ulladaEns(d: DadesEns): string {
  const p = PARAULES[d.tipus];
  const despesa = ultimaDespesa(d);
  const deute = ultimDeute(d);
  const pastilles: Pastilla[] = [
    {
      etq: "Seients al ple",
      xifra: number(d.seients),
      part: null,
      peu: `${membresDe(p, d.seients)}, i cap no surt d'una papereta`,
      on: "#qui-hi-seu",
      tema: "regidories",
    },
    {
      etq: "Municipis",
      xifra: d.municipis.length > 0 ? number(d.municipis.length) : "no consta",
      part: null,
      peu: d.poblacio ? `${number(d.poblacio)} habitants` : "sense padró de l'àmbit",
      on: "#municipis",
      tema: "municipis",
    },
  ];
  if (despesa) {
    const ph = despesa.perHabitant;
    pastilles.push({
      etq: `Despesa ${despesa.any}${despesa.parcial ? " (provisional)" : ""}`,
      xifra: importCurt(despesa.total),
      part: null,
      peu: ph !== null ? `${eurosHab(ph)} per habitant ${p.delTerritori}, sense préstecs` : "sense préstecs ni amortitzacions",
      on: "#diners",
      tema: "despesa total",
    });
  } else {
    pastilles.push({ etq: "Despesa liquidada", xifra: "no consta", part: null, peu: "la liquidació no és a la font", on: "#diners", tema: "despesa total" });
  }
  pastilles.push(
    deute
      ? { etq: `Deute viu ${deute.any}`, xifra: importCurt(deute.deuteViu), part: null, peu: "a 31 de desembre", on: "#diners", tema: "deute public" }
      : { etq: "Deute viu", xifra: "no en declara", part: null, peu: "cap any a la font", on: "#diners", tema: "deute public" },
  );
  return renderUllada(pastilles, `${d.nom} en quatre xifres`);
}

/** La portada: qui és l'ens, per què no el votes i qui el presideix. */
function renderPortada(d: DadesEns, base: string): string {
  const p = PARAULES[d.tipus];
  const territori = d.article ?? d.territori;
  const escut = d.escut
    ? `<img class="ens-escut" src="${escape(d.escut.url)}" alt="" width="44" height="44" loading="lazy">`
    : "";
  return `<section class="portada ens-portada">
  <p class="micro">${escape(p.micro)} · ${escape(territori)}</p>
  <div class="ens-titol">${escut}<h1>${escape(d.nom)}</h1></div>
  <p class="entrada">Ningú no vota aquest ple directament. Els seus ${number(d.seients)}
  ${membresDe(p, d.seients)} són regidors que hi envien els partits segons els vots de les
  municipals del 28 de maig del 2023.</p>
  ${renderPresidencia(d, base)}
  ${ulladaEns(d)}
</section>`;
}

// ------------------------------------------------------- què fa i què no fa

/** Una línia de llei: què diu, en una frase, i on ho diu. */
type Encarrec = { titol: string; text: string; cita: string };

const LRBRL = "https://www.boe.es/buscar/act.php?id=BOE-A-1985-5392";

/**
 * Què posa la llei a mans d'una diputació i d'un consell, i què no.
 *
 * És text fix i ho ha de ser: no és l'inventari del que fa cada ens aquest any
 * —que no és a cap font oberta en una forma comparable— sinó el que la llei
 * diu que li toca. Per això cada línia porta la cita, i la pàgina ho escriu
 * a sota amb totes les lletres. La columna del «no» és la que costa més de
 * trobar en cap altre lloc: és la que diu a qui no has de reclamar.
 */
const QUE_FA: Record<TipusEns, { fa: Encarrec[]; noFa: Encarrec[]; font: { text: string; url: string } }> = {
  diputacio: {
    fa: [
      {
        titol: "Ajuda els ajuntaments, sobretot els petits",
        text: "Assistència i cooperació jurídica, econòmica i tècnica als municipis, especialment als de menys capacitat: secretaria, informes, projectes d'obra, diners per fer-les.",
        cita: "LRBRL, art. 36.1.b",
      },
      {
        titol: "Fa que els serveis arribin a tot arreu",
        text: "Coordina els serveis municipals entre ells perquè el veí d'un poble petit tingui els mateixos serveis mínims que el d'una ciutat, i aprova cada any un pla de cooperació a les obres municipals.",
        cita: "LRBRL, art. 36.1.a i 36.2.a",
      },
      {
        titol: "Presta serveis que passen d'un municipi",
        text: "Serveis de caràcter supramunicipal, i serveis d'administració electrònica i de contractació centralitzada als municipis de menys de 20.000 habitants.",
        cita: "LRBRL, art. 36.1.c i 36.1.g",
      },
      {
        titol: "Les carreteres de la xarxa local",
        text: "És titular de les carreteres locals que són seves, i en té cura: no són ni les de la Generalitat ni les de l'Estat.",
        cita: "Decret legislatiu 2/2009, de carreteres",
      },
    ],
    noFa: [
      {
        titol: "Escoles, hospitals i ambulatoris",
        text: "Són de la Generalitat. La diputació pot ajudar un ajuntament a arreglar un edifici, però no porta cap escola ni cap CAP.",
        cita: "Estatut d'autonomia, art. 131 i 162",
      },
      {
        titol: "Els serveis del teu carrer",
        text: "Les escombraries, l'enllumenat, l'aigua o la policia local són de l'ajuntament. La diputació hi coopera quan l'ajuntament no arriba; no els decideix.",
        cita: "LRBRL, art. 25 i 26",
      },
    ],
    font: { text: "Llei 7/1985, reguladora de les bases del règim local (LRBRL)", url: LRBRL },
  },
  consell: {
    fa: [
      {
        titol: "Serveis socials als pobles de menys de 20.000",
        text: "Els serveis socials bàsics dels municipis que no arriben a 20.000 habitants els presta el consell comarcal: l'àrea bàsica és la comarca.",
        cita: "Llei 12/2007, de serveis socials",
      },
      {
        titol: "El transport i el menjador escolar",
        text: "Organitza l'autobús que porta l'alumnat que viu lluny de l'escola i el servei de menjador, per delegació del Departament d'Educació.",
        cita: "Decrets 160/1996 i 161/1996",
      },
      {
        titol: "El que li deleguen la Generalitat i els ajuntaments",
        text: "Exerceix les competències que li atribueixen les lleis i les que li deleguen o encarreguen la Generalitat i els municipis de la comarca.",
        cita: "DL 4/2003, art. 25",
      },
      {
        titol: "Assistència als ajuntaments",
        text: "Cooperació i assistència tècnica, jurídica i econòmica als municipis, sobretot als que no tenen prou mitjans per fer-ho sols.",
        cita: "DL 4/2003, art. 28",
      },
    ],
    noFa: [
      {
        titol: "Les escoles i els CAP",
        text: "Són de la Generalitat. El consell porta l'alumnat a l'escola, però no porta l'escola.",
        cita: "Estatut d'autonomia, art. 131 i 162",
      },
      {
        titol: "Els serveis socials de les ciutats grans",
        text: "Els municipis de més de 20.000 habitants tenen els seus propis serveis socials bàsics, i no passen pel consell.",
        cita: "Llei 12/2007, de serveis socials",
      },
    ],
    font: {
      text: "Decret legislatiu 4/2003, text refós de la Llei de l'organització comarcal de Catalunya",
      url: "https://portaljuridic.gencat.cat/eli/es-ct/dlg/2003/11/04/4",
    },
  },
};

/** Una columna de la llei: el «sí» o el «no». */
function llistaEncarrecs(items: readonly Encarrec[]): string {
  return `<ul class="ens-llei">${items
    .map(
      (e) => `<li><b>${escape(e.titol)}</b>
      <span>${escape(e.text)}</span>
      <span class="ens-cita">${escape(e.cita)}</span></li>`,
    )
    .join("")}</ul>`;
}

function renderQueFa(d: DadesEns): string {
  const p = PARAULES[d.tipus];
  const q = QUE_FA[d.tipus];
  const article = d.tipus === "diputacio" ? "una diputació" : "un consell comarcal";
  return `<section class="bloc" id="que-fa">
  <h2>Què fa ${escape(p.ens)}, i què no</h2>
  <p class="entrada-bloc">El que la llei encarrega a ${article}, en poques línies. No és la llista
  del que fa aquest en concret: és el marc dins del qual ho fa.</p>
  <div class="ens-que-fa">
    <div><h3>Què li toca</h3>${llistaEncarrecs(q.fa)}</div>
    <div class="ens-no"><h3>Què no li toca</h3>${llistaEncarrecs(q.noFa)}</div>
  </div>
  <p class="nota">Font: <a href="${escape(q.font.url)}" rel="noopener">${escape(q.font.text)}</a>,
  i les lleis que s'hi citen. Què fa cada any, al seu pressupost (més avall) i a ${d.web
    ? `<a href="${escape(d.web)}" rel="noopener">la seva web</a>`
    : "la seva web"}.</p>
</section>`;
}

// ------------------------------------------------ qui hi seu, i com hi arriba

/** El gris de «no se sap»: el mateix que `colorSegur()` torna quan no hi ha color. */
const GRIS = GRIS_ENS;

/** Els grups del ple tal com els dibuixa l'hemicicle, amb el forat del que no se sap. */
function grupsDelPle(d: DadesEns): { grups: GrupHemicicle[]; total: number } {
  const ordre = (m: MembreEns): number =>
    (m.rol === "presidencia" ? 0 : m.rol === "vicepresidencia" ? 1 : 2) * 1000 + (m.ordre ?? 999);
  const grups: GrupHemicicle[] = d.composicio
    .filter((c) => c.seients > 0)
    .map((c) => ({
      nom: c.partit === SENSE_PARTIT ? "Partit no consta" : c.partit,
      regidories: c.seients,
      color: colorSegur(c.color),
      persones: d.membres
        .filter((m) => m.grup === c.partit)
        .sort((a, b) => ordre(a) - ordre(b))
        .map((m) => nomDe(m)),
    }));
  const sumats = grups.reduce((a, g) => a + g.regidories, 0);
  // Els seients que el registre compta i que no sabem de qui són: es dibuixen
  // en gris i amb l'etiqueta que ho diu, perquè el ple tingui la mida de debò.
  if (sumats < d.seients) {
    grups.push({ nom: "Seient sense nom a la font", regidories: d.seients - sumats, color: GRIS });
  }
  return { grups, total: Math.max(d.seients, sumats) };
}

/**
 * Un hemicicle petit, sense etiquetes, per a la tercera baula de la cadena. És
 * el mateix dibuix que el gran en miniatura: és el que fa que la cadena acabi,
 * literalment, en el ple que hi ha a sota.
 */
function hemicicleMini(d: DadesEns): string {
  const { grups, total } = grupsDelPle(d);
  const { seats, width, height } = hemicycle(total, { width: 120 });
  if (seats.length === 0) return "";
  let cursor = 0;
  const cercles: string[] = [];
  for (const g of grups) {
    for (let i = 0; i < g.regidories && cursor < seats.length; i += 1, cursor += 1) {
      const s = seats[cursor]!;
      cercles.push(`<circle cx="${s.x}" cy="${s.y}" r="${s.r}" fill="${g.color}"/>`);
    }
  }
  return `<svg class="ens-mini" viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">${cercles.join("")}</svg>`;
}

/** La papereta de la primera baula: un sobre amb la papereta que en treu el cap. */
const DIBUIX_PAPERETA = `<svg class="ens-mini" viewBox="0 0 120 64" aria-hidden="true" focusable="false">
  <rect x="38" y="4" width="44" height="34" rx="3" fill="#FFFFFF" stroke="#1E1B2E" stroke-width="2.5"/>
  <path d="M48 16h24M48 24h16" stroke="#1E1B2E" stroke-width="2.5" stroke-linecap="round"/>
  <rect x="26" y="26" width="68" height="34" rx="4" fill="#FBF7EE" stroke="#1E1B2E" stroke-width="2.5"/>
  <path d="M26 30l34 18 34-18" fill="none" stroke="#1E1B2E" stroke-width="2.5" stroke-linejoin="round"/>
</svg>`;

/** Un ple municipal de nou regidors, per a la segona baula. */
const DIBUIX_REGIDORS = (() => {
  const { seats, width, height } = hemicycle(9, { width: 120 });
  const cercles = seats
    .map((s) => `<circle cx="${s.x}" cy="${s.y}" r="${s.r}" fill="#FFFFFF" stroke="#1E1B2E" stroke-width="2.5"/>`)
    .join("");
  return `<svg class="ens-mini" viewBox="-3 -3 ${width + 6} ${height + 6}" aria-hidden="true" focusable="false">${cercles}</svg>`;
})();

/** La fletxa entre baules, feta a mà: un traç corbat i una punta. */
const FLETXA = `<svg class="ens-fletxa" viewBox="0 0 48 32" aria-hidden="true" focusable="false">
  <path d="M3 20c12-12 26-12 38-2" fill="none" stroke="#1E1B2E" stroke-width="3" stroke-linecap="round"/>
  <path d="M33 12l9 7-11 3" fill="none" stroke="#1E1B2E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

/**
 * La cadena: vots al teu poble → regidors → membres de l'ens.
 *
 * És una seqüència de debò —cada pas surt de l'anterior— i per això és una
 * llista ordenada i porta números. Les xifres de les dues primeres baules
 * surten del càlcul de la llei (`repartiment`): són els vots i els regidors de
 * les llistes que hi entren, no de totes. Sense càlcul, la cadena s'explica
 * igual, amb el nombre d'ajuntaments en comptes dels vots.
 */
function renderCadena(d: DadesEns): string {
  const p = PARAULES[d.tipus];
  const r = d.repartiment;
  const vots = r ? r.files.reduce((a, f) => a + f.vots, 0) : null;
  const regidors = r ? r.files.reduce((a, f) => a + f.regidors, 0) : null;
  const ajuntaments = d.municipis.length;
  const regla =
    d.tipus === "diputacio"
      ? "segons els vots de cada partit judicial"
      : "segons els vots (dos terços) i els regidors (un terç) de cada llista";
  const baula = (n: number, classe: string, dibuix: string, xifra: string, etq: string, text: string, fletxa: boolean): string =>
    `<li class="ens-baula ${classe}">
      <span class="ens-pas" aria-hidden="true">${n}</span>
      ${dibuix}
      <span class="ens-xifra">${xifra}</span>
      <span class="ens-etq">${etq}</span>
      <span class="ens-text">${text}</span>
      ${fletxa ? FLETXA : ""}
    </li>`;
  return `<ol class="ens-cadena" aria-label="Com s'arriba ${escape(p.alEns)}, en tres passos">
    ${baula(
      1, "ens-b1", DIBUIX_PAPERETA,
      vots !== null ? number(vots) : ajuntaments > 0 ? number(ajuntaments) : "",
      vots !== null ? "vots" : plural(ajuntaments, "ajuntament", "ajuntaments"),
      `El 28 de maig del 2023 votes el ple del teu ajuntament. ${escape(p.Ens)} no surt a la papereta.`,
      true,
    )}
    ${baula(
      2, "ens-b2", DIBUIX_REGIDORS,
      regidors !== null ? number(regidors) : "",
      "regidors",
      ajuntaments > 0
        ? `Els vots fan els regidors ${ajuntaments === 1 ? "de l'únic ajuntament" : `dels ${number(ajuntaments)} ajuntaments`} ${escape(p.delTerritori)}.`
        : `Els vots fan els regidors de cada ajuntament ${escape(p.delTerritori)}.`,
      true,
    )}
    ${baula(
      3, "ens-b3", hemicicleMini(d),
      number(d.seients),
      escape(membresDe(p, d.seients)),
      `Els partits es reparteixen els seients ${regla}, i hi envien regidors seus.`,
      false,
    )}
  </ol>`;
}

/**
 * L'hemicicle gran: un cercle per seient, amb el color del partit com a marca
 * de dada i el nom de qui hi seu a l'etiqueta de cada cercle quan se sap.
 */
function renderHemicicle(d: DadesEns): string {
  const p = PARAULES[d.tipus];
  const { grups, total } = grupsDelPle(d);
  if (total <= 0) {
    return `<p class="nota">El registre de plens no diu quants seients té ${escape(p.ens)}.</p>`;
  }
  const { seats, width, height } = hemicycle(total, { width: 660 });
  const majoria = Math.floor(total / 2) + 1;
  const cercles = seientsHemicicle(seats, grups, total, { singular: "seient", plural: "seients" });
  const mig = width / 2;
  return `<figure class="hemicicle ens-hemicicle">
  <svg viewBox="0 0 ${width} ${height + 6}" role="img"
    aria-label="Hemicicle de ${total} seients. ${escape(grups.map((g) => `${g.nom}, ${g.regidories}`).join("; "))}.">
    <line x1="${mig}" y1="0" x2="${mig}" y2="${height}" stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="5 5" opacity=".45"/>
    ${cercles}
  </svg>
  <figcaption>${total} seients · la ratlla marca la majoria absoluta, que són ${majoria}.
  Passa per sobre d'un cercle per saber qui hi seu.</figcaption>
</figure>`;
}

/** Qui té quants seients, amb la pastilla del partit i la barra de la proporció. */
function renderComposicio(d: DadesEns, base: string): string {
  if (d.composicio.length === 0) {
    return `<p class="nota">La font no diu de quin partit és cap dels seients.</p>`;
  }
  const total = Math.max(1, d.seients, d.composicio.reduce((a, c) => a + c.seients, 0));
  return `<ul class="llegenda ens-composicio">${d.composicio
    .map((c) => {
      const color = colorSegur(c.color);
      return `<li>
      <span class="qui">${c.partit === SENSE_PARTIT ? '<span class="ens-sense">Partit no consta</span>' : sigla(c.partit, { base, color })}</span>
      <span class="xifra"><b>${number(c.seients)}</b> ${plural(c.seients, "seient", "seients")}</span>
      <span class="proporcio"><i style="--w:${((100 * c.seients) / total).toFixed(1)}%;--c:${color}"></i></span>
    </li>`;
    })
    .join("")}</ul>`;
}

/** La regla de la llei, dita en dues frases. */
function reglaDeLaLlei(d: DadesEns): string {
  const p = PARAULES[d.tipus];
  return d.tipus === "diputacio"
    ? `La llei fixa ${number(d.seients)} seients per la població de la província i els reparteix entre
       els partits judicials del 1979 segons els residents. Dins de cada un, els seients van per
       D'Hondt sobre els vots dels partits que hi han tret almenys un regidor.`
    : `La llei fixa ${number(d.seients)} ${p.membres} per la població de la comarca. Hi entren les llistes
       amb un 3 % dels vots o més; cada una rep una puntuació —un terç el seu tant per cent de
       regidors, dos terços el de vots— i els seients van per D'Hondt sobre aquesta puntuació.`;
}

/**
 * El càlcul de la llei al costat del ple real.
 *
 * És la peça on la pàgina pot equivocar-se més fàcilment, i per això té dues
 * cares que no es barregen. Si el càlcul quadra partit per partit, es diu i la
 * taula explica el ple. Si no quadra, la frase ho diu abans que la taula, les
 * diferències van en una llista a la vista i la columna del ple real és la que
 * mana: el càlcul no es presenta mai com si fos el ple.
 */
function renderRepartiment(d: DadesEns, r: RepartimentEns | null): string {
  const p = PARAULES[d.tipus];
  if (!r) {
    return `<p class="nota">Encara no hem pogut refer el càlcul de la llei per a aquest ple: hi falten
    els vots o els regidors del 2023 d'algun municipi ${escape(p.delTerritori)}. ${pla(reglaDeLaLlei(d))}</p>`;
  }
  const ambPuntuacio = r.files.some((f) => f.puntuacio !== null);
  // Els sortejos i l'avís del padró van a part: no són diferències amb el ple.
  const sortejos = r.diferencies.filter((t) => /sorteig/.test(t));
  const aproximat = r.diferencies.filter((t) => /^El càlcul és aproximat/.test(t));
  const reconciliat = r.quadra && r.diferencies.some((t) => /^Quadra amb els/.test(t));
  const diferencies = r.diferencies.filter((t) => !sortejos.includes(t) && !aproximat.includes(t));
  const llista = (frases: readonly string[]): string =>
    frases.length > 0 ? `<ul class="ens-diferencies">${frases.map((t) => `<li>${escape(t)}</li>`).join("")}</ul>` : "";
  const veredicte = r.quadra
    ? `<div class="ens-calcul"><span class="ens-signe" aria-hidden="true">=</span>
       <div><p>${reconciliat
         ? `Amb els vots del 2023 i la regla de la llei, el càlcul dona <b>aquest ple en tot el que sabem</b>.`
         : `Amb els vots del 2023 i la regla de la llei, el càlcul dona <b>exactament aquest ple</b>, partit per partit.`}</p>
       ${llista(diferencies)}${llista(aproximat)}</div></div>`
    : `<div class="ens-calcul"><span class="ens-signe" aria-hidden="true">≠</span>
       <div><p>El càlcul <b>no dona exactament aquest ple</b>. La taula diu el que donaria la llei amb
       els vots; el ple de debò és la darrera columna. La diferència pot venir de canvis de grup durant
       el mandat, de llistes que la junta va comptar amb un altre partit o de com la font escriu el ple:
       aquí no es diu qui té raó.</p>
       ${diferencies.length > 0 ? llista(diferencies) : `<p>La font no explica on és la diferència.</p>`}
       ${llista(aproximat)}</div></div>`;
  const empat = sortejos.length > 0
    ? vinyetaPapereta("empat", `${sortejos.join(" ")} El càlcul n'ha triat un a l'atzar; la junta ho va fer amb un sorteig de debò.`)
    : "";
  // Només les llistes que treuen algun seient, al càlcul o al ple. Les altres
  // (a Lleida, una trentena amb algun regidor i cap escó) es diuen en una línia.
  const files = [...r.files]
    .filter((f) => f.seientsCalculats > 0 || (f.seientsReals ?? 0) > 0)
    .sort((a, b) => b.seientsCalculats - a.seientsCalculats || b.vots - a.vots);
  const sense = r.files.length - files.length;
  return `<h3 class="ens-sub">El que dona la llei amb els vots del 2023</h3>
  <p>${pla(reglaDeLaLlei(d))}</p>
  ${veredicte}
  ${empat}
  <div class="ens-taula-flux"><table class="ens-taula">
    <caption class="nomes-lectors">Seients que dona la llei${r.quadra ? "" : " (no és el ple real)"} i seients reals, per llista</caption>
    <thead><tr><th scope="col">Llista</th><th scope="col" class="xifra">Vots</th><th scope="col" class="xifra">Regidors</th>
    ${ambPuntuacio ? '<th scope="col" class="xifra">Puntuació</th>' : ""}
    <th scope="col" class="xifra">Segons la llei</th><th scope="col" class="xifra">Al ple</th></tr></thead>
    <tbody>${files
      .map(
        (f) => `<tr><th scope="row">${escape(f.partit)}</th>
      <td class="xifra">${number(f.vots)}</td><td class="xifra">${number(f.regidors)}</td>
      ${ambPuntuacio ? `<td class="xifra">${f.puntuacio !== null ? decimal(f.puntuacio, 2) : "—"}</td>` : ""}
      <td class="xifra">${number(f.seientsCalculats)}</td>
      <td class="xifra">${f.seientsReals !== null ? number(f.seientsReals) : '<span class="secundari">no consta</span>'}</td></tr>`,
      )
      .join("")}</tbody>
  </table></div>
  ${sense > 0
    ? `<p class="nota">I ${number(sense)} ${plural(sense, "llista més", "llistes més")} que ${plural(sense, "entra", "entren")} al
       repartiment ${d.tipus === "diputacio" ? "(amb algun regidor al seu partit judicial)" : "(amb el 3 % dels vots)"} i no
       ${plural(sense, "en treu", "en treuen")} cap seient.</p>`
    : ""}`;
}

/** Diputacions: quants seients té cada partit judicial i qui se'ls endú. */
function renderDistrictes(d: DadesEns, base: string): string {
  if (d.tipus !== "diputacio") return "";
  const r = d.repartiment?.districtes;
  if (r && r.length > 0) {
    return `<h3 class="ens-sub">Seient a seient, per partit judicial</h3>
  <ul class="ens-districtes">${r
    .map(
      (x) => `<li><b>${escape(x.nom)}</b>
      <span class="secundari">${number(x.seients)} ${plural(x.seients, "seient", "seients")} · ${number(x.poblacio)} habitants</span>
      <span class="ens-pastilles">${x.perPartit
        .filter((pp) => pp.seients > 0)
        .map((pp) => `${sigla(pp.partit, { base })} ${number(pp.seients)}`)
        .join(" ")}</span></li>`,
    )
    .join("")}</ul>`;
  }
  if (d.districtes && d.districtes.length > 0) {
    return `<p class="nota">Els seients es reparteixen entre ${number(d.districtes.length)} partits judicials del 1979:
    ${escape(d.districtes.map((x) => x.nom).join(", "))}. No en tenim el càlcul seient a seient.</p>`;
  }
  return "";
}

function renderQuiHiSeu(d: DadesEns, base: string): string {
  const p = PARAULES[d.tipus];
  return `<section class="bloc ens-arriba" id="qui-hi-seu">
  <h2>Qui hi seu, i com hi arriba</h2>
  <p class="entrada-bloc">Tres passos separen la teva papereta del ple ${escape(p.delEns)}. Només el
  primer el fas tu.</p>
  ${renderCadena(d)}
  ${renderHemicicle(d)}
  ${renderComposicio(d, base)}
  ${renderRepartiment(d, d.repartiment)}
  ${renderDistrictes(d, base)}
  <p class="nota">La regla, ${p.aLaLlei} <a href="${escape(p.lleiUrl)}" rel="noopener">${escape(p.llei)}</a>.
  El càlcul és nostre, amb els resultats municipals oficials del 2023, i es pot repetir amb el codi del projecte.</p>
</section>`;
}

// -------------------------------------------------------------- qui governa

/** Una persona en una fila: cara, nom, càrrec, partit i d'on és regidora. */
function filaPersona(base: string, m: MembreEns, mida: number, ambPartit = true): string {
  const on = dOn(base, m);
  // Dins d'un grup, l'etiqueta literal de la font només es diu si no és la del
  // grup: «Aramoià - AM» sota ERC sí, «ERC» sota ERC no.
  const literal = !ambPartit && m.partit && m.partit !== m.grup
    ? ` <span class="ens-etiqueta" title="Com ho escriu la font">${escape(m.partit)}</span>`
    : "";
  return `${cara(nomCara(m), m.foto, { mida, color: colorSegur(m.color) })}
      <span class="ens-qui">
        <span class="ens-nom">${nomEnllacat(base, m)}${ambPartit ? ` ${pastillaPartit(base, m)}` : literal}</span>
        <span class="secundari">${escape(carrecVisible(m))}${on ? ` · ${on}` : ""}</span>
      </span>`;
}

/**
 * La presidència i les vicepresidències, amb el càrrec literal de la font. El
 * gerent hi va a part i ho diu: no seu al ple ni el vota ningú, però és qui
 * porta la casa cada dia.
 */
function renderGovern(d: DadesEns, base: string): string {
  const p = PARAULES[d.tipus];
  const vices = d.membres
    .filter((m) => m.rol === "vicepresidencia")
    .sort((a, b) => (rangVice(a.carrec) ?? 99) - (rangVice(b.carrec) ?? 99) || (a.ordre ?? 999) - (b.ordre ?? 999));
  const rangs = vices.map((m) => rangVice(m.carrec)).filter((n): n is number => n !== null);
  const repetit = rangs.find((n, i) => rangs.indexOf(n) !== i);
  const govern = [...(d.presidencia ? [d.presidencia] : []), ...vices];
  const llista =
    govern.length > 0
      ? `<ul class="ens-govern">${govern.map((m) => `<li>${filaPersona(base, m, 44)}</li>`).join("")}</ul>`
      : `<p class="nota">La font no diu qui presideix ${escape(p.ens)} ni qui en té les vicepresidències.</p>`;
  const senseVices =
    d.presidencia && vices.length === 0
      ? `<p class="nota">La font no publica les vicepresidències, o ${escape(p.ens)} no en té.</p>`
      : "";
  const avisRepetit = repetit !== undefined
    ? `<p class="avis-dada">La font dona el mateix número de vicepresidència a més d'una persona; aquí surten
       totes dues tal com les escriu.</p>`
    : "";
  return `<section class="bloc" id="govern">
  <h2>Qui governa ${escape(p.ens)}</h2>
  <p class="entrada-bloc">La presidència la tria el ple entre els seus membres, i la presidència
  nomena les vicepresidències.</p>
  ${llista}
  ${avisRepetit}
  ${senseVices}
  ${d.gerent ? `<p class="nota">La gerència, que no és un càrrec electe ni seu al ple: ${escape(nomLlegible(d.gerent))}.</p>` : ""}
</section>`;
}

/**
 * El número d'una vicepresidència, del text del càrrec: «Vicepresident 1r»,
 * «Vicepresidenta segona», «Vicepresident 5è». Sense número, `null`, i va al
 * final. L'ordre del registre no serveix: no sempre segueix el rang.
 */
const ORDINALS: Readonly<Record<string, number>> = {
  primer: 1, primera: 1, segon: 2, segona: 2, tercer: 3, tercera: 3, quart: 4, quarta: 4,
  cinque: 5, cinquena: 5, sise: 6, sisena: 6, sete: 7, setena: 7, vuite: 8, vuitena: 8,
};
function rangVice(carrec: string): number | null {
  const net = carrec.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const xifra = net.match(/\b(\d{1,2})\s*(?:r|a|ra|n|na|t|ta|e|o|º|ª)?\b/);
  if (xifra) return Number(xifra[1]);
  for (const [paraula, n] of Object.entries(ORDINALS)) if (new RegExp(`\\b${paraula}\\b`).test(net)) return n;
  return null;
}

// ------------------------------------------------------------ tots els membres

/** Un avís de cobertura que parla dels noms: va al bloc dels membres i no al peu. */
const esAvisDeNoms = (avis: string): boolean => /\bnoms?\b/i.test(avis);

/** La dedicació sense la paraula «dedicació» al davant: la J24 ja la hi posa i la frase la tornava a dir. */
function dedicacioNeta(text: string | null): string | null {
  const net = (text ?? "").replace(/^\s*dedicaci[oó]\s+/i, "").trim();
  return net === "" ? null : net;
}

/**
 * El que l'ens publica que paga a aquella persona, i res més: un valor curt i,
 * si la font explica per què no hi ha import, aquella explicació a part.
 *
 * Tres estats que no es barregen:
 *   · **un import**: «90.940 € bruts l'any», amb la dedicació en petit;
 *   · **no cobra res d'aquest ens**: la font diu que no hi ha retribució (un 0
 *     publicat o un «Sense retribucions»), que és una dada;
 *   · **no consta**: la font no en diu res, que és un buit.
 * El sostre d'assistències és un màxim anual, no un import cobrat. No se suma
 * mai amb el que cobri del seu ajuntament ni de cap altre ens.
 */
function retribucio(m: MembreEns): { html: string; motiu: string | null } {
  const r = m.retribucio;
  if (!r) return { html: `<span class="ens-buit">no consta</span>`, motiu: null };
  if (r.anualBrut !== null && r.anualBrut > 0) {
    const ded = dedicacioNeta(r.dedicacio);
    return {
      html: `<b>${euros(r.anualBrut)}</b> bruts l'any${ded ? ` <span class="secundari">dedicació ${escape(ded)}</span>` : ""}`,
      motiu: null,
    };
  }
  if (r.anualBrut === 0) {
    return {
      html: r.sostreAssistencies !== null
        ? `cap sou; només assistències <span class="secundari">(màx. ${importCurt(r.sostreAssistencies)} l'any)</span>`
        : `no cobra res d'aquest ens`,
      motiu: null,
    };
  }
  if (r.sostreAssistencies !== null) {
    return { html: `només assistències <span class="secundari">(màx. ${importCurt(r.sostreAssistencies)} l'any)</span>`, motiu: r.motiu };
  }
  return { html: `<span class="ens-buit">no consta</span>`, motiu: r.motiu };
}

/**
 * Els membres agrupats per `grup` —la mateixa clau de la composició—, en
 * l'ordre de la composició, amb els de partit no conegut al final.
 */
function grupsDeMembres(d: DadesEns): { grup: string; color: string | null; membres: MembreEns[] }[] {
  const ordre = (m: MembreEns): number =>
    (m.rol === "presidencia" ? 0 : m.rol === "vicepresidencia" ? 1 : 2) * 1000 + (m.ordre ?? 999);
  const per = new Map<string, MembreEns[]>();
  for (const m of d.membres) per.set(m.grup, [...(per.get(m.grup) ?? []), m]);
  const claus = [
    ...d.composicio.map((c) => c.partit).filter((c) => c !== SENSE_PARTIT && per.has(c)),
    ...[...per.keys()].filter((k) => k !== SENSE_PARTIT && !d.composicio.some((c) => c.partit === k)),
    ...(per.has(SENSE_PARTIT) ? [SENSE_PARTIT] : []),
  ];
  return claus.map((grup) => ({
    grup,
    color: grup === SENSE_PARTIT ? null : (d.composicio.find((c) => c.partit === grup)?.color ?? per.get(grup)![0]!.color),
    membres: [...per.get(grup)!].sort((a, b) => ordre(a) - ordre(b)),
  }));
}

/** Les crides de nota: ¹, ², ³… */
const CRIDES = ["¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"];
const crida = (i: number): string => CRIDES[i] ?? `(${i + 1})`;

function renderMembres(d: DadesEns, base: string): string {
  const p = PARAULES[d.tipus];
  const n = d.membres.length;
  const avisNoms = d.avisos.filter(esAvisDeNoms);
  if (n === 0) {
    return `<section class="bloc" id="membres">
  <h2>Tots els ${escape(p.membres)}</h2>
  <p>La font oficial no publica els noms de qui seu ${escape(p.alEns)}: només sabem que hi ha
  ${number(d.seients)} ${plural(d.seients, "seient", "seients")}.</p>
  ${avisNoms.map((a) => `<p class="avis-dada">${escape(a)}</p>`).join("")}
</section>`;
  }
  // Els motius iguals es diuen un sol cop, sota la llista, amb una crida.
  const motius: string[] = [];
  const grups = grupsDeMembres(d)
    .map((g) => {
      const titol = g.grup === SENSE_PARTIT ? "Partit no consta" : g.grup;
      const marca = g.grup === SENSE_PARTIT ? "" : `<i class="ens-marca-grup" style="--c:${colorSegur(g.color)}" aria-hidden="true"></i>`;
      const files = g.membres
        .map((m) => {
          const sou = retribucio(m);
          let nota = "";
          if (sou.motiu) {
            let i = motius.indexOf(sou.motiu);
            if (i === -1) i = motius.push(sou.motiu) - 1;
            nota = `<sup class="ens-crida"><a href="#ens-nota-${i + 1}" aria-label="Nota ${i + 1}">${crida(i)}</a></sup>`;
          }
          return `<li><span class="ens-persona">${filaPersona(base, m, 36, false)}</span><span class="ens-sou">${sou.html}${nota}</span></li>`;
        })
        .join("");
      return `<h3 class="ens-grup">${marca}<span>${escape(titol)}</span>
      <span class="ens-grup-n">${number(g.membres.length)} ${plural(g.membres.length, "seient", "seients")}</span></h3>
    <ul class="ens-membres">${files}</ul>`;
    })
    .join("");
  const notes = motius.length > 0
    ? `<ol class="ens-notes">${motius
        .map((t, i) => `<li id="ens-nota-${i + 1}"><span aria-hidden="true">${crida(i)}</span> ${escape(t)}</li>`)
        .join("")}</ol>`
    : "";
  // Els escons amb partit i sense nom són a la llista, però el nom no el
  // coneixem: no compten com a coneguts.
  const ambNom = d.membres.filter((m) => !esSeientSenseNom(m.nom)).length;
  const faltenNoms = ambNom < d.seients
    ? `<p class="nota">En coneixem ${number(ambNom)} de ${number(d.seients)}: la font no publica la resta de noms.</p>`
    : "";
  return `<section class="bloc" id="membres">
  <h2>Tots els ${escape(p.membres)}, i què els paga ${escape(p.ens)}</h2>
  <p class="entrada-bloc">Agrupats pel partit amb què hi seuen. Al costat de cada nom, el que
  <b>${escape(p.ens)} mateix publica</b> que li paga.</p>
  ${avisNoms.map((a) => `<p class="avis-dada">${escape(a)}</p>`).join("")}
  ${grups}
  ${faltenNoms}
  ${notes}
  <p class="nota">El sou és el que publica ${escape(p.ens)} per a aquell càrrec, no tot el que
  cobra la persona: el seu ajuntament o altres ens li poden pagar per altres càrrecs, i aquí no se
  suma res d'un altre pagador. «No consta» vol dir que la font no en diu res, no que no cobri; «no
  cobra res d'aquest ens» vol dir que la font diu que no hi té retribució.</p>
</section>`;
}

// ------------------------------------------------------------------ diners

/** Els fons dels quadres: els quatre tons de la casa, en roda. Cap no vol dir res. */
const FONS_QUADRES = ["var(--menta)", "var(--lavanda)", "var(--presec)", "#FFFFFF"] as const;

/**
 * Un mapa de quadres: on l'àrea de cada requadre és la seva part del total.
 *
 * El dibuix és HTML amb percentatges (`quadres.ts`) i el text de cada
 * requadre el decideix la seva mida real amb `@container`, com a l'índex de
 * partits: el mateix 3 % són 30 px en un ordinador i 10 en un telèfon. Les
 * xifres senceres hi són sempre al `title`, a l'`aria-label` i a la llista
 * plegable de sota, que és on es llegeixen quan el requadre és massa petit.
 */
function mapaQuadres(trossos: { etiqueta: string; valor: number }[], titol: string, total: number): string {
  const caixes: Caixa[] = quadres(trossos, total);
  if (caixes.length === 0) return "";
  const part = (c: Caixa): string => `${decimal(c.part)} %`;
  const requadres = caixes
    .map((c, i) => {
      const estil = `--x:${c.x.toFixed(2)}%;--y:${c.y.toFixed(2)}%;--w:${c.w.toFixed(2)}%;--h:${c.h.toFixed(2)}%;--c:${FONS_QUADRES[i % FONS_QUADRES.length]}`;
      const dada = { nom: c.etiqueta, valor: milions(c.valor), extres: [{ etq: "part del total", valor: part(c) }] };
      const llarg = c.etiqueta.length > 22 ? " data-llarg" : "";
      return `<span class="ens-tros"${llarg} style="${estil}"${atributsEtiqueta(dada)} title="${escape(textEtiqueta(dada))}">
        <b>${escape(c.etiqueta)}</b><i>${importCurt(c.valor)}</i><em>${Math.round(c.part)} %</em></span>`;
    })
    .join("");
  const etiqueta = `${titol}: ${caixes.map((c) => `${c.etiqueta}, ${milions(c.valor)}, ${part(c)}`).join("; ")}.`;
  return `<div class="ens-quadres" role="img" aria-label="${escape(etiqueta)}">${requadres}</div>
  <details class="ens-xifres"><summary>Les xifres, partida a partida</summary>
    <ul>${caixes.map((c) => `<li><span>${escape(c.etiqueta)}</span><b>${milions(c.valor)}</b><span class="secundari">${part(c)}</span></li>`).join("")}</ul>
  </details>`;
}

/** D'on surten els diners: els ingressos liquidats per capítol, l'últim any. */
function quadresIngressos(d: DadesEns, ex: Exercici): string {
  const any = d.finances!.anys.find((a) => a.any === ex.any)!;
  const trossos = any.capitols
    .filter((c) => c.tipus === "ingressos" && c.liquidat !== null && c.liquidat > 0)
    .map((c) => ({ etiqueta: c.nom, valor: c.liquidat! }));
  if (trossos.length === 0 || ex.ingressos === null) {
    return `<p class="nota">La liquidació del ${ex.any} no porta els ingressos per capítols.</p>`;
  }
  return `<h3 class="ens-sub">D'on surten: ${milions(ex.ingressos)} el ${ex.any}</h3>
  ${mapaQuadres(trossos, `Ingressos liquidats el ${ex.any}`, trossos.reduce((a, t) => a + t.valor, 0))}`;
}

/**
 * On van: la despesa per àrees (el primer nivell de la classificació per
 * programes), i si no n'hi ha, per capítols. Les àrees diuen «per a què»
 * —serveis socials, carreteres, deute—; els capítols només diuen «en què»
 * —personal, compres, transferències—, i per això són el pla B.
 */
function quadresDespeses(d: DadesEns, ex: Exercici): string {
  const programes = d.finances!.programes;
  const arees = programes
    ? programes.files.filter((f) => f.nivell === 1 && f.obligacions !== null && f.obligacions > 0)
    : [];
  if (programes && arees.length > 0) {
    const trossos = arees.map((f) => ({ etiqueta: f.nom, valor: f.obligacions! }));
    const total = trossos.reduce((a, t) => a + t.valor, 0);
    return `<h3 class="ens-sub">On van: ${milions(total)} el ${programes.any}, per àrees</h3>
    ${mapaQuadres(trossos, `Despesa per àrees el ${programes.any}`, total)}`;
  }
  const any = d.finances!.anys.find((a) => a.any === ex.any)!;
  const trossos = any.capitols
    .filter((c) => c.tipus === "despeses" && c.liquidat !== null && c.liquidat > 0)
    .map((c) => ({ etiqueta: c.nom, valor: c.liquidat! }));
  if (trossos.length === 0) return "";
  return `<h3 class="ens-sub">On van: ${milions(trossos.reduce((a, t) => a + t.valor, 0))} el ${ex.any}, per capítols</h3>
  <p class="nota">La font no porta la despesa per àrees d'aquest ens: els capítols diuen en què es
  gasta (personal, compres, transferències), no per a què.</p>
  ${mapaQuadres(trossos, `Despesa per capítols el ${ex.any}`, trossos.reduce((a, t) => a + t.valor, 0))}`;
}

/** Tots els anys entre el primer i l'últim, perquè un any sense dada es vegi com un forat. */
function rang(anys: readonly number[]): number[] {
  if (anys.length === 0) return [];
  const [min, max] = [Math.min(...anys), Math.max(...anys)];
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

/**
 * La despesa de cada any, en euros i no per habitant: el padró que tenim és el
 * d'avui, i dividir el 2012 pels habitants del 2026 seria inventar-se una
 * xifra. Els euros per habitant només van amb l'últim exercici.
 */
function serieDespesa(d: DadesEns): string {
  const tots = exercicis(d);
  const punts: PuntSerie[] = tots
    .filter((e) => e.despeses !== null)
    .map((e) => ({ any: e.any, valor: e.despeses! }));
  if (punts.length < 2) return "";
  return `<h3 class="ens-sub">Quant gasta cada any</h3>
  ${serieTemporal(punts, {
    format: importCurt,
    titol: "Despesa no financera liquidada",
    mida: "mitjana",
    anysEsperats: rang(tots.map((e) => e.any)),
    nota: "liquidació pressupostària, Consorci AOC",
  })}`;
}

function serieDeute(d: DadesEns): string {
  const p = PARAULES[d.tipus];
  const deute = d.finances?.deute ?? [];
  if (deute.length === 0) {
    return `<p class="nota">La font del deute viu no en recull cap xifra declarada per ${escape(p.ens)}.</p>`;
  }
  const ultim = ultimDeute(d)!;
  const grafic =
    deute.length >= 2
      ? serieTemporal(
          deute.map((x) => ({ any: x.any, valor: x.deuteViu })),
          { format: importCurt, titol: "Deute viu a 31 de desembre", mida: "mitjana", anysEsperats: rang(deute.map((x) => x.any)), nota: "deute viu, Consorci AOC" },
        )
      : "";
  return `<h3 class="ens-sub">Quant deu</h3>
  <p>A 31 de desembre del ${ultim.any}, ${escape(p.ens)} declarava un deute viu de <b>${milions(ultim.deuteViu)}</b>.</p>
  ${grafic}`;
}

function renderDiners(d: DadesEns): string {
  const p = PARAULES[d.tipus];
  const ex = ultimExercici(d);
  if (!d.finances || !ex) {
    return `<section class="bloc" id="diners">
  <h2>D'on surten els diners ${escape(p.delEns)}, i on van</h2>
  <p>No tenim cap liquidació del pressupost ${escape(p.delEns)}: la font del Consorci AOC no en
  publica cap exercici per a aquest ens.</p>
  ${serieDeute(d)}
</section>`;
  }
  const ph = perHabitant(d, ex.despeses!);
  const primerAny = Math.min(...d.finances.anys.map((a) => a.any));
  const parcial = ultimaDespesa(d)?.parcial ?? false;
  const { actius, passius } = ex.financera;
  const financera = [
    passius !== null && passius > 0 ? `${milions(passius)} a tornar préstecs (capítol 9)` : null,
    actius !== null && actius > 0 ? `${milions(actius)} en préstecs i participacions que dona (capítol 8)` : null,
  ].filter((t): t is string => t !== null);
  return `<section class="bloc" id="diners">
  <h2>D'on surten els diners ${escape(p.delEns)}, i on van</h2>
  <p class="entrada-bloc">El ${ex.any}, ${escape(p.ens)} va gastar <b>${milions(ex.despeses!)}</b>${
    ph !== null ? `, que són ${eurosHab(ph)} per cada habitant ${escape(p.delTerritori)}` : ""
  }. Són diners liquidats: el que es va gastar de debò, no el que es va pressupostar.${
    parcial ? ` La liquidació del ${ex.any} encara no hi és sencera: la xifra pot créixer.` : ""
  }</p>
  <p class="nota">És la despesa no financera (capítols 1 a 7). Els préstecs i el deute que es torna van a part${
    financera.length > 0 ? `: el ${ex.any}, ${financera.join(" i ")}` : ""
  }. Comptar-los com a despesa faria semblar que gasta més l'any que torna un préstec.</p>
  <div class="ens-diners">
    <div>${quadresIngressos(d, ex)}</div>
    <div>${quadresDespeses(d, ex)}</div>
  </div>
  ${serieDespesa(d)}
  ${serieDeute(d)}
  <p class="nota">Font: liquidació pressupostària i deute viu dels ens locals, Consorci AOC
  (dades obertes), ${primerAny < ex.any ? `exercicis ${primerAny}-${ex.any}` : `exercici ${ex.any}`}.
  Els euros per habitant fan servir el padró actual ${escape(p.delTerritori)}.</p>
</section>`;
}

// ------------------------------------------------- què reparteix als ajuntaments

/** La mediana d'una llista de nombres; null si és buida. */
function mediana(valors: readonly number[]): number | null {
  if (valors.length === 0) return null;
  const v = [...valors].sort((a, b) => a - b);
  const mig = Math.floor(v.length / 2);
  return v.length % 2 === 1 ? v[mig]! : (v[mig - 1]! + v[mig]!) / 2;
}

type FilaReparteix = { slug: string; nom: string; import: number | null; perHab: number | null };

/** Les files de l'últim any: import concedit a l'ajuntament i euros per habitant. */
function filesReparteix(s: SubvencionsEns): FilaReparteix[] {
  const i = s.anys.length - 1;
  return s.perMunicipi.map((m) => {
    const imp = i >= 0 ? (m.imports[i] ?? null) : null;
    return { slug: m.slug, nom: m.nom, import: imp, perHab: imp !== null && m.poblacio ? imp / m.poblacio : null };
  });
}

/**
 * Tots els municipis en una sola ratlla: un punt cadascun, i la mediana. És la
 * forma de la distribució d'un cop d'ull —si n'hi ha pocs de molt amunt o si
 * van tots junts— sense haver de recórrer la llista. Sense colors de veredicte:
 * un punt a la dreta no és millor ni pitjor, és més diners per habitant.
 */
function ratllaReparteix(files: readonly FilaReparteix[], med: number): string {
  const amb = files.filter((f) => f.perHab !== null);
  const max = Math.max(...amb.map((f) => f.perHab!), med) || 1;
  const [ample, alt, marge] = [660, 64, 10];
  const x = (v: number): string => (marge + ((ample - 2 * marge) * v) / max).toFixed(1);
  const punts = amb
    .map((f, i) => {
      const y = (alt / 2 + (((i * 7) % 5) - 2) * 6).toFixed(1);
      const dada = { nom: f.nom, valor: `${eurosHab(f.perHab!)} per habitant`, extres: [{ etq: "concedit", valor: euros(f.import!) }] };
      return `<circle cx="${x(f.perHab!)}" cy="${y}" r="4.5" fill="var(--lavanda)" stroke="var(--ink)" stroke-width="1.2"${atributsEtiqueta(dada)}><title>${escape(textEtiqueta(dada))}</title></circle>`;
    })
    .join("");
  return `<figure class="ens-ratlla">
  <svg viewBox="0 0 ${ample} ${alt + 18}" role="img" aria-label="Euros per habitant concedits a cada ajuntament, de 0 a ${eurosHab(max)}. La mediana és de ${eurosHab(med)}.">
    <line x1="${marge}" y1="${alt}" x2="${ample - marge}" y2="${alt}" stroke="var(--vora)" stroke-width="2"/>
    <line x1="${x(med)}" y1="4" x2="${x(med)}" y2="${alt}" stroke="var(--ink)" stroke-width="2" stroke-dasharray="4 4"/>
    ${punts}
    <text x="${marge}" y="${alt + 15}" font-size="12" fill="var(--ink-suau)">0 €</text>
    <text x="${ample - marge}" y="${alt + 15}" font-size="12" fill="var(--ink-suau)" text-anchor="end">${eurosHab(max)}</text>
  </svg>
  <figcaption>Un punt per ajuntament. La ratlla discontínua és la mediana: ${eurosHab(med)} per habitant.</figcaption>
</figure>`;
}

/** La llista de municipis, de més a menys euros per habitant, amb la mediana marcada a cada barra. */
function llistaReparteix(files: readonly FilaReparteix[], med: number | null, base: string): string {
  const amb = files.filter((f) => f.perHab !== null).sort((a, b) => b.perHab! - a.perHab!);
  const max = Math.max(amb[0]?.perHab ?? 0, med ?? 0) || 1;
  const sense = files.filter((f) => f.perHab === null);
  const files_ = amb
    .map(
      (f) => `<li><a href="${escape(adrecaMunicipi(base, f.slug))}">${escape(f.nom)}</a>
      <span class="ens-barra" aria-hidden="true"><i style="--w:${((100 * f.perHab!) / max).toFixed(1)}%"></i></span>
      <b>${eurosHab(f.perHab!)}</b></li>`,
    )
    .join("");
  const llista = `<ol class="ens-reparteix${med === null ? " ens-sense-mediana" : ""}"${med !== null ? ` style="--med:${((100 * med) / max).toFixed(1)}%"` : ""}>${files_}</ol>
  ${sense.length > 0
    ? `<p class="nota">Sense dada: ${escape(sense.map((f) => f.nom).join(", "))}. No vol dir zero: o no hi ha cap concessió registrada amb el CIF de l'ajuntament, o no en tenim el padró.</p>`
    : ""}`;
  return amb.length > 24
    ? `<details class="ens-tots"><summary>Els ${number(amb.length)} ajuntaments, de més a menys euros per habitant</summary>${llista}</details>`
    : llista;
}

/** «A», «A i B», «A, B i C». */
function llistaI(noms: readonly string[]): string {
  return noms.length <= 1 ? (noms[0] ?? "") : `${noms.slice(0, -1).join(", ")} i ${noms[noms.length - 1]}`;
}

/**
 * L'avís del que l'ens registra amb el beneficiari amagat («no publicable»).
 *
 * Hi ha ens que hi posen gairebé tot: la Diputació de Tarragona hi té uns 181
 * milions el 2024 contra mig milió amb nom. Sense dir-ho a dalt de tot, la
 * pàgina llegiria «no reparteix res» quan el que passa és que no diu a qui.
 * Si l'import amagat és més gran que el que arriba amb nom als ajuntaments,
 * l'avís va destacat i abans de les xifres; si és petit, és una nota.
 */
function avisNoPublicable(d: DadesEns, s: SubvencionsEns, concedit: number): string {
  const i = s.anys.length - 1;
  const np = i >= 0 ? s.noPublicable?.[i] : undefined;
  if (!np || np.import <= 0) return "";
  const p = PARAULES[d.tipus];
  const frase = `El ${s.anys[i]}, ${escape(p.ens)} va registrar ${milions(np.import)} en
    ${number(np.concessions)} ${plural(np.concessions, "concessió", "concessions")} amb el beneficiari amagat
    («no publicable»). Una part pot ser per a ajuntaments, però no es pot saber de quins.`;
  return np.import >= concedit
    ? `<p class="avis-dada"><b>Compte: la major part del que reparteix no diu a qui.</b> ${frase}
       Per això les xifres per municipi d'aquí sota es queden molt curtes.</p>`
    : `<p class="nota">${frase}</p>`;
}

function renderSubvencions(d: DadesEns, base: string): string {
  const s = d.subvencions;
  if (!s) return "";
  const p = PARAULES[d.tipus];
  const any = s.anys[s.anys.length - 1];
  const files = filesReparteix(s);
  const perHab = files.filter((f) => f.perHab !== null).map((f) => f.perHab!);
  // La mediana i la ratlla de punts només amb prou dades: amb un sol municipi
  // (el Ripollès) o amb 15 de 184 (Tarragona) no descriuen res. Amb menys de
  // deu ajuntaments amb dada, o menys de la meitat, es diu la cobertura.
  const ambProu = perHab.length >= 10 && perHab.length * 2 >= files.length;
  const med = mediana(perHab);
  const concedit = files.filter((f) => f.import !== null).reduce((a, f) => a + f.import!, 0);
  // Un zero aquí és un recompte de debò: l'ens no registra res al RAISC.
  const capRegistre = s.concessionsEns !== null && s.concessionsEns.length > 0 && s.concessionsEns.every((n) => n === 0);
  const anysText = s.anys.length > 1 ? `entre el ${s.anys[0]} i el ${any}` : `el ${any}`;
  const cos = capRegistre
    ? `<p>${escape(p.Ens)} no registra cap concessió al RAISC ${anysText}, ni als ajuntaments ni a
    ningú. No vol dir que no ajudi els municipis: pot ser que ho faci amb serveis o amb diners que
    no passen per aquest registre, però aquí no es pot comptar.</p>`
    : any === undefined || med === null
      ? `<p>La font no hi registra cap concessió ${escape(p.delEns)} als ajuntaments que puguem lligar pel CIF.</p>`
      : ambProu
        ? `<p class="entrada-bloc">El ${any}, l'últim any complet, ${escape(p.ens)} va concedir
    <b>${milions(concedit)}</b> amb nom als ajuntaments ${escape(p.delTerritori)}. Per habitant, la
    meitat dels ajuntaments en va rebre més de ${eurosHab(med)} i l'altra meitat, menys.</p>
    ${avisNoPublicable(d, s, concedit)}
    ${ratllaReparteix(files, med)}
    ${llistaReparteix(files, med, base)}`
        : `<p class="entrada-bloc">El ${any}, l'últim any complet, ${escape(p.ens)} va concedir
    <b>${milions(concedit)}</b> amb nom als ajuntaments ${escape(p.delTerritori)}, però només en
    ${number(perHab.length)} dels ${number(files.length)} ${plural(files.length, "ajuntament", "ajuntaments")} de la llista
    se'n pot lligar alguna. Amb tan poca cobertura, una mitjana no diria res.</p>
    ${avisNoPublicable(d, s, concedit)}
    ${llistaReparteix(files, null, base)}`;
  const avisSol = capRegistre || (any !== undefined && med !== null) ? "" : avisNoPublicable(d, s, concedit);
  const conv = !capRegistre && s.convocatories.length > 0
    ? `<h3 class="ens-sub">Les convocatòries que més reparteixen${any !== undefined ? `, el ${any}` : ""}</h3>
    <div class="ens-taula-flux"><table class="ens-taula">
      <thead><tr><th scope="col">Convocatòria</th><th scope="col" class="xifra">Import</th><th scope="col" class="xifra">Concessions</th></tr></thead>
      <tbody>${s.convocatories
        .map((c) => `<tr><th scope="row">${escape(c.titol)}</th><td class="xifra">${milions(c.import)}</td><td class="xifra">${number(c.concessions)}</td></tr>`)
        .join("")}</tbody>
    </table></div>`
    : "";
  const agencies = s.agenciesExcloses.length > 0
    ? ` Tampoc no hi compten els organismes propis: ${escape(llistaI(s.agenciesExcloses))}.`
    : "";
  return `<section class="bloc" id="reparteix">
  <h2>Què reparteix als ajuntaments</h2>
  ${cos}
  ${avisSol}
  ${conv}
  <p class="nota">Només hi ha les subvencions registrades al RAISC amb el CIF de l'ajuntament mateix.
  No hi són els serveis que ${escape(p.ens)} presta directament ni l'assistència tècnica.${agencies}
  L'any és el de la data de concessió, no el de la convocatòria: per això d'un any a l'altre hi pot
  haver salts grans. Font: <a href="${escape(s.font.url)}" rel="noopener">${escape(s.font.nom)}</a>.</p>
</section>`;
}

// ------------------------------------------------------------- els municipis

function renderMunicipis(d: DadesEns, base: string): string {
  const p = PARAULES[d.tipus];
  const n = d.municipis.length;
  if (n === 0) {
    return `<section class="bloc" id="municipis">
  <h2>Els municipis ${escape(p.delTerritori)}</h2>
  <p>No tenim la llista de municipis d'aquest ens.</p>
</section>`;
  }
  const ambComarca = d.tipus === "diputacio";
  const ordenats = [...d.municipis].sort((a, b) => (b.poblacio ?? -1) - (a.poblacio ?? -1) || a.nom.localeCompare(b.nom, "ca"));
  const files = ordenats
    .map(
      (m) => `<tr><th scope="row"><a href="${escape(adrecaMunicipi(base, m.slug))}">${escape(m.nom)}</a></th>
      ${ambComarca ? `<td class="secundari ens-com">${escape(m.comarca ?? "—")}</td>` : ""}
      <td class="xifra ens-pob">${m.poblacio !== null ? number(m.poblacio) : "no consta"}</td>
      <td class="xifra ens-seu">${m.membres !== null ? number(m.membres) : '<span class="ens-buit">no consta</span>'}</td></tr>`,
    )
    .join("");
  const ambMembres = d.municipis.filter((m) => (m.membres ?? 0) > 0).length;
  // «La resta, ningú» només es pot dir si sabem d'on és tothom.
  const senseMunicipi = d.membres.filter((m) => m.municipi === null).length;
  const tothomConegut = d.membres.length > 0 && senseMunicipi === 0 && d.membres.length >= d.seients;
  const resta = tothomConegut
    ? "la resta, ningú"
    : senseMunicipi > 0
      ? `de ${number(senseMunicipi)} ${membresDe(p, senseMunicipi)} no en sabem el municipi`
      : "dels seients sense nom no en sabem el municipi";
  return `<section class="bloc" id="municipis">
  <h2>${n === 1 ? "L'únic municipi" : `Els ${number(n)} municipis`}</h2>
  <p class="entrada-bloc">Ordenats per població. ${ambMembres > 0
    ? ambMembres === n
      ? `Tots tenen algú assegut ${escape(p.alEns)}.`
      : `${number(ambMembres)} ${plural(ambMembres, "té", "tenen")} algú assegut ${escape(p.alEns)}; ${resta}.`
    : `No sabem de quin municipi és cap dels ${escape(p.membres)}.`}</p>
  <table class="ens-municipis">
    <thead><tr><th scope="col">Municipi</th>${ambComarca ? '<th scope="col">Comarca</th>' : ""}
    <th scope="col">Habitants</th><th scope="col">${escape(p.membres.charAt(0).toUpperCase() + p.membres.slice(1))} que hi seuen</th></tr></thead>
    <tbody>${files}</tbody>
  </table>
</section>`;
}

// -------------------------------------------------------------- els altres ens

/** Les quatre diputacions, amb el tros d'adreça que fa servir `adrecaEns()`. */
const DIPUTACIONS: readonly { slug: string; nom: string }[] = [
  { slug: "barcelona", nom: "Diputació de Barcelona" },
  { slug: "girona", nom: "Diputació de Girona" },
  { slug: "lleida", nom: "Diputació de Lleida" },
  { slug: "tarragona", nom: "Diputació de Tarragona" },
];

/**
 * La diputació de cada consell, pel codi d'ens del registre (`6nei-4b44`,
 * camp `codiprov`). No es pot deduir del codi —el dels consells no porta la
 * província— ni dels municipis, perquè hi ha comarques partides entre dues
 * províncies (la Cerdanya, la Selva, Osona); el registre diu a quina
 * diputació s'adscriu cada consell, i això és el que es copia aquí.
 */
const DIPUTACIO_DEL_CONSELL: Readonly<Record<string, string>> = Object.fromEntries([
  ...["8100380001", "8100690004", "8100750006", "8101150006", "8101410007", "8101730008", "8102130008",
    "8104240003", "8104020002", "8104190004", "8102490004"].map((c) => [c, "barcelona"]),
  ...["8101540003", "8101920002", "8100220002", "8103470005", "8101080001", "8102060009", "8102870005",
    "8103110007"].map((c) => [c, "girona"]),
  ...["8100560009", "8100430008", "8102340003", "8103260009", "8101890004", "8102520002", "8102650006",
    "8102710007", "8103320002", "8103500000", "8103850006"].map((c) => [c, "lleida"]),
  ...["8101670005", "8100170005", "8103040003", "8103790004", "8100810007", "8100940003", "8101200000",
    "8102280001", "8102900000", "8103630008"].map((c) => [c, "tarragona"]),
]);

function renderAltres(d: DadesEns, base: string): string {
  const enllac = (on: string, text: string, aqui = false): string =>
    `<li><a href="${escape(on)}"${aqui ? ' class="aqui" aria-current="page"' : ""}>${escape(text)}</a></li>`;
  const items: string[] = [];
  if (d.tipus === "diputacio") {
    for (const x of DIPUTACIONS) items.push(enllac(`${base}${adrecaEns("diputacio", x.slug)}`, x.nom, x.slug === d.slug));
  } else {
    if (d.comarca) items.push(enllac(`${base}c/${d.comarca.slug}/`, `La comarca: ${d.comarca.nom}`));
    const dip = DIPUTACIONS.find((x) => x.slug === DIPUTACIO_DEL_CONSELL[d.codiEns]);
    if (dip) items.push(enllac(`${base}${adrecaEns("diputacio", dip.slug)}`, dip.nom));
  }
  items.push(enllac(`${base}ens/`, "Totes les diputacions i els consells comarcals"));
  const comarques =
    d.tipus === "diputacio" && d.comarques.length > 0
      ? `<h3 class="ens-sub">Les comarques de la demarcació</h3>
  <ul class="ens-enllacos">${d.comarques.map((c) => enllac(`${base}c/${c.slug}/`, c.nom)).join("")}</ul>`
      : "";
  const titol = d.tipus === "diputacio" ? "Les altres diputacions" : "La comarca i la diputació";
  return `<nav class="bloc" aria-label="${escape(titol)}">
  <h2>${escape(titol)}</h2>
  <ul class="ens-enllacos">${items.join("")}</ul>
  ${comarques}
</nav>`;
}

// ------------------------------------------------------------------- fonts

/** Una font citada: el nom enllaçat, la llicència i quan es va consultar. */
function citaFont(f: FontEns): string {
  const extres = [f.llicencia, f.consultat ? `consultat el ${f.consultat}` : null].filter(Boolean).join(", ");
  return `<li><a href="${escape(f.url)}" rel="noopener">${escape(f.nom)}</a>${extres ? ` (${escape(extres)})` : ""}.</li>`;
}

function renderFonts(d: DadesEns): string {
  const vistes = new Set<string>();
  const g = d.dinersGeneralitat;
  // Només les fonts dels apartats que la pàgina ensenya: el fons només si l'ens
  // en rep, les obres i els pendents només si n'hi ha; els comptes, sempre.
  const fontsGeneralitat: FontEns[] = g
    ? [
        g.fcl !== null ? g.fonts.fcl : null,
        g.obres.length > 0 ? g.fonts.puosc : null,
        g.fonts.trameses,
        g.pendents && g.pendents.conceptes.length > 0 ? g.fonts.pendents : null,
      ]
        .filter((f): f is NonNullable<typeof f> => f !== null)
        .map((f) => ({ nom: `${f.titol}, ${f.organisme}`, url: f.url, llicencia: f.llicencia, consultat: f.consultat }))
    : [];
  const fonts = [
    ...d.fonts,
    ...(d.finances?.fonts ?? []),
    ...(d.subvencions ? [d.subvencions.font] : []),
    ...(d.serveis?.serveisSocials?.fonts ?? []),
    ...(d.serveis?.contractacio ? [d.serveis.contractacio.font] : []),
    ...fontsGeneralitat,
    ...(d.escut ? [d.escut.font] : []),
  ]
    .filter((f) => (vistes.has(f.url + f.nom) ? false : (vistes.add(f.url + f.nom), true)));
  // Els avisos sobre els noms ja surten al bloc dels membres, que és on fan falta.
  const avisos = d.avisos.filter((a) => !esAvisDeNoms(a));
  return `<section class="bloc fonts">
  <h2>D'on surt tot això</h2>
  ${avisos.map((a) => `<p class="avis-dada">${escape(a)}</p>`).join("")}
  <ul>
    ${fonts.map(citaFont).join("")}
    <li>Vots i regidories de les municipals del 2023: <code>ntc4-rnwr</code>.</li>
    <li>Municipi, comarca i partit judicial: <code>ehvx-5ty7</code>; registre d'ens locals: <code>6nei-4b44</code>.</li>
  </ul>
  <p class="nota">El repartiment de la llei, les agrupacions per partit i els euros per habitant són
  càlculs nostres sobre aquestes fonts, repetibles amb el codi del projecte. Consultat el ${escape(d.consultat)}.</p>
</section>`;
}

// ------------------------------------------------------------------- estil

/**
 * El que aquesta pàgina té i cap altra no tenia. La resta —portada, ullada,
 * hemicicle, llegenda, sèries, avisos, fonts— és `RADIOGRAFIA_CSS`.
 *
 * L'atreviment va tot a la cadena: tres baules de colors de la casa, amb la
 * tinta fosca escrita a mà perquè els tres fons (presec, menta i lavanda) no
 * canvien en mode fosc i la tinta de la pàgina sí. Una mica torçades, com
 * paperets enganxats a la nevera, i rectes en mòbil, on van una sota l'altra.
 * La resta de la pàgina és quieta a propòsit: filets, llistes i taules.
 */
export const ENS_CSS = `
/* L'obertura i l'índex, separats per un sol pas de ritme, com a la resta de fitxes. */
.ens-portada{padding-bottom:0}
.ens-portada + .index{margin-top:var(--e4)}
.ens-titol{display:flex;align-items:center;gap:var(--e2)}
.ens-titol h1{font-size:clamp(2rem,7.4vw,3.6rem);overflow-wrap:break-word;min-width:0}
.ens-escut{width:44px;height:44px;object-fit:contain;flex:0 0 auto}
.ens-presidencia{margin-top:var(--e3)}
.ens-sub{font-family:var(--display);font-weight:900;font-size:1.15rem;letter-spacing:-.015em;margin:var(--e4) 0 var(--e1)}

/* Què fa i què no: dues columnes de text, sense targetes. */
.ens-que-fa{display:grid;gap:var(--e3);grid-template-columns:minmax(0,3fr) minmax(0,2fr)}
.ens-que-fa h3{font-family:var(--display);font-weight:900;font-size:1.05rem;margin:0 0 var(--e1);
  padding-left:12px;border-left:6px solid var(--menta)}
.ens-que-fa .ens-no h3{border-left-color:var(--presec)}
.ens-llei{list-style:none;margin:0;padding:0}
.ens-llei li{display:flex;flex-direction:column;gap:2px;padding:10px 0;border-bottom:1px solid var(--vora);font-size:1rem}
.ens-cita{font-size:.875rem;font-weight:800;color:var(--coral-text)}
@media (max-width:700px){ .ens-que-fa{grid-template-columns:1fr} }

/* La cadena: el bloc que es recorda. */
.ens-cadena{list-style:none;margin:var(--e3) 0 var(--e4);padding:0;display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--e4)}
.ens-baula{position:relative;display:flex;flex-direction:column;gap:4px;padding:var(--e3) var(--e2) var(--e2);
  color:#1E1B2E;background:var(--f);border:2.5px solid var(--ink);border-radius:var(--r-m);box-shadow:var(--ombra)}
.ens-b1{--f:var(--presec);transform:rotate(-1.2deg)}
.ens-b2{--f:var(--menta);transform:rotate(.8deg) translateY(10px)}
.ens-b3{--f:var(--lavanda);transform:rotate(-.5deg)}
.ens-pas{position:absolute;top:-16px;left:14px;width:34px;height:34px;border-radius:50%;
  display:flex;align-items:center;justify-content:center;background:#1E1B2E;color:#FBF7EE;
  font-family:var(--display);font-weight:900;font-size:1.05rem}
.ens-mini{display:block;width:120px;height:64px;margin:0 0 var(--e1)}
.ens-xifra{font-family:var(--display);font-weight:900;font-size:clamp(1.9rem,4.4vw,2.6rem);
  letter-spacing:-.03em;line-height:1;font-variant-numeric:tabular-nums}
.ens-xifra:empty{display:none}
.ens-etq{font-weight:800;font-size:.95rem}
.ens-text{font-size:.9rem;line-height:1.4;color:#524D63}
.ens-fletxa{position:absolute;width:44px;height:30px;right:-44px;top:42%;color:var(--ink)}
.ens-fletxa path{stroke:var(--ink)}
@media (max-width:760px){
  .ens-cadena{grid-template-columns:1fr;gap:var(--e4)}
  .ens-baula{transform:none}
  .ens-fletxa{right:auto;left:50%;top:auto;bottom:-40px;transform:translateX(-50%) rotate(90deg)}
}
.ens-hemicicle{max-width:560px;margin-left:auto;margin-right:auto}
.ens-composicio{margin-bottom:var(--e3)}

/* El càlcul al costat del ple: el signe diu si quadra, sense cap color de veredicte. */
.ens-calcul{display:flex;gap:var(--e2);align-items:flex-start;margin:var(--e2) 0;padding:var(--e2);
  background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m)}
.ens-calcul p{margin:0 0 var(--e1)}
.ens-signe{flex:0 0 auto;width:40px;height:40px;border-radius:50%;border:2.5px solid var(--ink);
  display:flex;align-items:center;justify-content:center;font-family:var(--display);font-weight:900;font-size:1.4rem}
.ens-diferencies{margin:0 0 var(--e1);padding-left:1.1em;font-size:.94rem}
.ens-sense{font-weight:800;color:var(--ink-suau)}
.ens-taula-flux{overflow-x:auto;margin:0 0 var(--e2)}
.ens-taula{width:100%;border-collapse:collapse;font-size:.9rem}
.ens-taula th,.ens-taula td{text-align:left;padding:8px 10px 8px 0;border-bottom:1px solid var(--vora);vertical-align:top}
.ens-taula thead th{font-size:.875rem;font-weight:800;color:var(--ink-suau);border-bottom:2.5px solid var(--ink)}
.ens-taula .xifra{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.ens-districtes,.ens-govern,.ens-membres,.ens-enllacos{list-style:none;margin:0;padding:0}
.ens-districtes{display:grid;gap:0 var(--e3);grid-template-columns:repeat(auto-fill,minmax(min(260px,100%),1fr))}
.ens-districtes li{display:flex;flex-direction:column;gap:3px;padding:9px 0;border-bottom:1px solid var(--vora)}
.ens-pastilles{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center;font-weight:800;font-size:.9rem}

/* La gent: una fila per persona, i el sou en una columna prou ampla a la dreta. */
.ens-govern li,.ens-membres li{display:flex;align-items:center;gap:var(--e2);padding:10px 0;border-bottom:1px solid var(--vora)}
.ens-persona{display:flex;align-items:center;gap:var(--e2);flex:1 1 auto;min-width:0}
.ens-qui{display:flex;flex-direction:column;gap:2px;min-width:0}
.ens-nom{font-weight:800;display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px}
.ens-govern .secundari,.ens-membres .secundari{font-size:.875rem;line-height:1.4}
.ens-etiqueta{font-weight:700;font-size:.875rem;color:var(--ink-suau)}
.ens-sou{flex:0 0 16em;text-align:right;font-size:.94rem;line-height:1.35}
.ens-sou b{font-family:var(--display);font-weight:900;font-size:1.1rem}
.ens-sou .secundari{display:block}
.ens-crida{font-weight:800;margin-left:2px}
.ens-crida a{text-decoration:none}
.ens-buit{color:var(--ink-suau)}
.ens-grup{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 12px;font-family:var(--display);font-weight:900;
  font-size:1.35rem;letter-spacing:-.015em;margin:var(--e4) 0 var(--e1)}
.ens-marca-grup{align-self:center;width:14px;height:14px;border-radius:50%;background:var(--c);border:2px solid var(--ink);flex:0 0 auto}
.ens-grup-n{font-family:var(--text);font-weight:700;font-size:.94rem;color:var(--ink-suau);letter-spacing:0}
.ens-notes{margin:var(--e2) 0 0;padding:0;list-style:none;font-size:.875rem;color:var(--ink-suau)}
.ens-notes li{margin:0 0 6px}
@media (max-width:700px){
  .ens-membres li{flex-direction:column;align-items:stretch;gap:4px}
  .ens-sou{text-align:left;flex-basis:auto;padding-left:52px}
}

/* Els diners: dos mapes de quadres, l'un al costat de l'altre si hi caben. */
.ens-diners{display:grid;gap:var(--e3);grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr))}
.ens-diners .ens-sub{margin-top:var(--e2)}
.ens-quadres{position:relative;width:100%;aspect-ratio:4/3;border:2.5px solid var(--ink);border-radius:var(--r-m);overflow:hidden}
.ens-tros{position:absolute;left:var(--x);top:var(--y);width:var(--w);height:var(--h);background:var(--c);color:#1E1B2E;
  border-right:2px solid var(--ink);border-bottom:2px solid var(--ink);padding:6px 8px;overflow:hidden;
  display:flex;flex-direction:column;gap:1px;line-height:1.15;container-type:size}
.ens-tros b,.ens-tros i,.ens-tros em{display:none}
/* Una etiqueta que no hi cap no es talla a mitja paraula: no es mostra, i la
   xifra sencera és al «title» i a la llista plegable. Les llargues demanen més lloc. */
@container (min-width:96px) and (min-height:40px){ .ens-tros b{display:block} }
@container (min-width:96px) and (min-height:62px){ .ens-tros i{display:block} }
@container (min-width:120px) and (min-height:84px){ .ens-tros em{display:block} }
@container (max-width:170px) { .ens-tros[data-llarg] b{display:none} }
@container (max-height:62px) { .ens-tros[data-llarg] b{display:none} }
.ens-tros b{font-size:.8125rem;font-weight:800;overflow-wrap:normal;word-break:normal;hyphens:manual}
.ens-tros i{font-family:var(--display);font-weight:900;font-style:normal;font-size:1.05rem;font-variant-numeric:tabular-nums}
.ens-tros em{font-style:normal;font-size:.8125rem;font-weight:800;opacity:.8}
.ens-xifres{margin:var(--e1) 0 0;font-size:.94rem}
.ens-xifres summary,.ens-tots summary{cursor:pointer;font-weight:800;min-height:44px;display:flex;align-items:center}
.ens-xifres ul{list-style:none;margin:0;padding:0}
.ens-xifres li{display:grid;grid-template-columns:1fr auto auto;gap:var(--e2);padding:5px 0;border-bottom:1px solid var(--vora)}

/* Què reparteix: una ratlla de punts i la llista amb la mediana a cada barra. */
.ens-ratlla{margin:var(--e2) 0}
.ens-ratlla svg{display:block;width:100%;height:auto}
.ens-ratlla figcaption{font-size:.875rem;color:var(--ink-suau);margin-top:4px}
.ens-reparteix{list-style:none;margin:0;padding:0}
.ens-reparteix li{display:grid;grid-template-columns:minmax(0,11em) minmax(0,1fr) 6.5em;gap:var(--e2);align-items:center;
  padding:4px 0;font-size:.9rem;border-bottom:1px solid var(--vora)}
.ens-reparteix li a{font-weight:700;overflow-wrap:anywhere}
.ens-reparteix b{text-align:right;font-variant-numeric:tabular-nums}
.ens-barra{position:relative;display:block;height:10px;background:var(--vora);border-radius:var(--r-max)}
.ens-barra i{display:block;height:100%;width:var(--w);min-width:2px;background:var(--lavanda);border:1.5px solid var(--ink);border-radius:var(--r-max)}
.ens-barra::after{content:"";position:absolute;left:var(--med);top:-5px;bottom:-5px;border-left:2px dashed var(--ink)}
.ens-sense-mediana .ens-barra::after{display:none}
@media (max-width:560px){ .ens-reparteix li{grid-template-columns:minmax(0,1fr) 6em} .ens-barra{grid-column:1/-1;grid-row:2} }

/* La taula de municipis, que en mòbil es plega en fitxes d'una línia. */
.ens-municipis{width:100%;border-collapse:collapse;font-size:.92rem}
.ens-municipis th,.ens-municipis td{text-align:left;padding:8px 10px 8px 0;border-bottom:1px solid var(--vora);vertical-align:top}
.ens-municipis thead th{font-size:.875rem;font-weight:800;color:var(--ink-suau);border-bottom:2.5px solid var(--ink)}
.ens-municipis .xifra{font-variant-numeric:tabular-nums;white-space:nowrap}
@media (max-width:640px){
  .ens-municipis thead{display:none}
  .ens-municipis tr{display:block;padding:8px 0;border-bottom:1px solid var(--vora)}
  .ens-municipis th,.ens-municipis td{display:inline;border:0;padding:0}
  .ens-municipis tbody th{display:block;font-size:1rem}
  .ens-municipis td{font-weight:400;color:var(--ink-suau);font-size:.875rem}
  .ens-municipis .ens-com::after{content:" · "}
  .ens-municipis .ens-pob::after{content:" habitants · "}
  .ens-municipis .ens-seu::after{content:" hi seuen"}
}
.ens-enllacos{display:flex;flex-wrap:wrap;gap:8px}
.ens-enllacos a{display:inline-flex;align-items:center;min-height:44px;padding:0 14px;border:2px solid var(--ink);
  border-radius:var(--r-max);font-weight:800;font-size:.94rem;text-decoration:none}
.ens-enllacos a:hover{background:var(--ink);color:var(--paper)}
.ens-enllacos a.aqui{background:var(--presec);color:#1E1B2E}
`;

// ------------------------------------------------------------------ pàgina

/**
 * El títol per al cercador: el nom de l'ens i què hi trobaràs. «Consell
 * Comarcal del Vallès Occidental» ja fa 38 lletres, i per això es prova de més
 * llarg a més curt i es queda el primer que hi cap.
 */
export function titolEns(d: Pick<DadesEns, "nom">): string {
  const candidats = [`${d.nom}: qui hi seu i què gasta`, `${d.nom}: qui hi seu`, d.nom];
  return candidats.find((t) => titolAmbMarca(t).length <= TITOL_MAXIM) ?? d.nom.slice(0, TITOL_MAXIM);
}

/**
 * La descripció: per què no el votes i què hi ha a la pàgina, sense cap xifra
 * que no surti a la pàgina. Com el títol, de llarga a curta, perquè no s'hagi
 * de tallar a mitja paraula.
 */
export function descripcioEns(d: DadesEns): string {
  const p = PARAULES[d.tipus];
  const qui = `Els ${number(d.seients)} ${membresDe(p, d.seients)} ${d.tipus === "diputacio" ? "de la" : "del"} ${d.nom}`;
  const candidats = [
    `${qui} no es voten: surten de les municipals del 2023. Qui hi seu, què cobra, d'on treu els diners i què reparteix als ajuntaments.`,
    `${qui} no es voten: surten de les municipals del 2023. Qui hi seu, què cobra i què gasta.`,
    `${d.nom}: qui hi seu sense passar per cap papereta, què cobra i què gasta.`,
  ];
  return candidats.find((t) => t.length <= DESCRIPCIO_MAXIMA) ?? candidats[candidats.length - 1]!;
}

/**
 * La fitxa sencera d'una diputació o d'un consell comarcal.
 *
 * El cap porta l'ens com a `GovernmentOrganization` amb el graf complet
 * (`ensLd()` a `seo-ld.ts`): el territori que serveix amb l'`@id` de la
 * comarca, la seu amb el del municipi, la presidència i el ple amb l'`@id` de
 * la fitxa de cada persona quan l'aparellament és únic. L'`@id` és el de
 * sempre (`…#ens`): canviar-lo seria, per al graf, canviar de cosa.
 *
 * Les preguntes ràpides (qui el presideix, quants membres té, com s'escullen,
 * quant gasta…) surten dues vegades, i sempre juntes: a la vista, just després
 * de l'índex, i com a `FAQPage` al JSON-LD. Van tan amunt perquè són les frases
 * que un cercador amb IA cita senceres, cadascuna amb la seva font i la seva
 * data; i van juntes perquè unes dades estructurades que diuen una cosa que la
 * pàgina no ensenya són exactament el que un cercador penalitza.
 *
 * La data de les dades (`dataModificacio`, que surt al `dateModified` del node
 * de la pàgina i a l'`article:modified_time`) és el dia que es van consultar
 * les fonts (`d.consultat`), no el de la publicació: tornar a generar la pàgina
 * amb les mateixes dades no la fa més nova.
 */
export function renderEns(d: DadesEns, generatedAt: string): string {
  const base = baseDe(d);
  const p = PARAULES[d.tipus];
  const url = `${SITE}/observatori/${adrecaEns(d.tipus, d.slug)}`;
  const esglaons = [
    ...ARREL_OBSERVATORI,
    { nom: "Diputacions i consells", url: `${SITE}/observatori/ens/` },
    { nom: d.nom, url },
  ];
  const rapides = preguntesRapides(preguntesEns(d), url);
  const cap = capSeo({
    titol: titolEns(d),
    descripcio: descripcioEns(d),
    url,
    imatge: imatgeOg(d.tipus === "diputacio" ? FITXER_OG.diputacio(d.slug) : FITXER_OG.consell(d.slug)),
    // Una fitxa, com la del municipi o la del partit: «article» a l'Open Graph,
    // que és el que porta l'`article:modified_time` amb la data de les dades.
    tipus: "article",
    dataModificacio: d.consultat,
    jsonLd: [filAriadna(esglaons), ensLd(d), ...(rapides.jsonLd ? [rapides.jsonLd] : [])],
  });
  const teSubvencions = d.subvencions !== null;
  // El bloc de la Generalitat només hi és si la J41 en té alguna cosa: el
  // fragment torna buit si no, i una secció amb un títol i res a sota no diu res.
  const generalitat = renderDinersGeneralitatEns(d.dinersGeneralitat);

  return `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${cap}
${tipografia(base)}
<style>${RADIOGRAFIA_CSS}${ENS_CSS}${PAPERETA_POSTURES_CSS}${SERVEIS_ENS_CSS}${COOPERACIO_CSS}${rapides.html ? GEO_CSS : ""}</style>
</head>
<body>
<a class="salta" href="#contingut">Ves al contingut</a>

${capcalera(base, "cap")}
${cercador(base)}

<main id="contingut">

${renderPortada(d, base)}

<nav class="index" aria-label="Seccions d'aquesta pàgina">
  ${rapides.html ? '<a href="#preguntes-rapides">Preguntes ràpides</a>' : ""}
  <a href="#que-fa">Què fa</a>
  <a href="#qui-hi-seu">Com s'hi arriba</a>
  <a href="#govern">Qui governa</a>
  <a href="#membres">Els ${escape(p.membres)}</a>
  <a href="#diners">Els diners</a>
  ${teSubvencions ? '<a href="#reparteix">Què reparteix</a>' : ""}
  ${d.serveis ? enllacosIndexServeis(d.serveis) : ""}
  ${generalitat ? '<a href="#generalitat">La Generalitat</a>' : ""}
  <a href="#municipis">Els municipis</a>
</nav>

${rapides.html}

${renderQueFa(d)}

${renderQuiHiSeu(d, base)}

${renderGovern(d, base)}

${renderMembres(d, base)}

${renderDiners(d)}

${renderSubvencions(d, base)}

${d.serveis ? renderServeisSocialsEns(d.serveis) : ""}
${d.serveis ? renderContractacioEns(d.serveis) : ""}

${generalitat
  ? `<section class="bloc" id="generalitat">
  <h2>Què li dona la Generalitat, i si li envia els comptes</h2>
  ${generalitat}
</section>`
  : ""}

${renderMunicipis(d, base)}

${renderAltres(d, base)}

${renderFonts(d)}

${vinyetaPapereta("final", "Has arribat al final.", { enllac: { href: `${base}ens/`, text: "Mira qui governa per sobre dels altres pobles" } })}

</main>
${peu(base, generatedAt)}
${GRAFICS_JS}
</body>
</html>`;
}
