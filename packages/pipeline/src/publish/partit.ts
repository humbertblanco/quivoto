import { eq, sql, type SQLWrapper } from "drizzle-orm";
import {
  candidatures, electionResults, municipalities, municipalityMetrics, type Db,
} from "@quivoto/db";
import { BRANDS_BY_ID, PARTY_BRANDS, siglesFamily } from "@quivoto/shared-schemas/brands";
import { absoluteMajority } from "@quivoto/shared-schemas/seats";
import { INDEXABLE, SITE } from "./config";
import { tintaSobre as tintaDeContrast } from "./contrast";
import { RADIOGRAFIA_CSS } from "./estil";
import { serieTemporal } from "./grafics";
import { geometria } from "./mapa-catalunya";
import { assignaSlugs, clau } from "./candidatura";
import { capcalera } from "./capcalera";
import { cercador } from "./cercador";
import { peu } from "./peu";

/**
 * La pàgina d'**una marca a tot Catalunya**.
 *
 * L'Observatori ja sap explicar un municipi (la radiografia), una comarca i una
 * candidatura a un poble. El que no sabia dir és el subjecte del qual tothom
 * parla als titulars —«ERC perd pobles», «el PSC recupera el territori»— i que
 * no és cap d'aquells tres: és la marca sumada als 947 ajuntaments. Sense
 * aquesta pàgina, la xifra que surt a la premsa cada nit electoral no es podia
 * comprovar enlloc del web, tot i que la teníem sencera a la base.
 *
 * N'hi ha una per marca de `PARTY_BRANDS` amb alguna alcaldia o alguna
 * regidoria **al mandat 2023-2027**, i cap per a «local». «Local» no és un
 * partit: és el calaix de les llistes que no reconeixem, 226 marques que no
 * tenen res a veure les unes amb les altres, i fer-ne una pàgina diria que
 * existeix un «partit de les llistes locals» que no existeix enlloc. És la
 * mateixa raó per la qual el mapa dels 947 no els dona cap color.
 *
 * ## Una sola regla per a totes les xifres
 *
 * Qui compta com a d'aquesta marca es decideix a `marcaDe()` i **a cap altre
 * lloc**: les alcaldies, les regidories, els vots i el mapa surten tots
 * d'aquella funció. Amb dues regles —una per a les alcaldies i una per als
 * regidors— la pàgina podia dir que un partit té l'alcaldia d'un poble on no
 * hi té cap regidor, que és una contradicció que el lector no pot resoldre i
 * nosaltres sí.
 */

const ELECCIO = "M20231";
/** El mandat que va obrir aquella elecció, tal com l'escriu la taula d'alcaldes. */
const MANDAT_ARA = "2023-2027";
const ANY_ARA = 2023;

/**
 * Quant s'han de semblar les dues fonts perquè dibuixem la sèrie llarga.
 *
 * Les sèries des del 1979 vénen de dos conjunts que no classifiquen igual que
 * el recompte del 2023: la de regidories agrupa les marques comarcals dins de
 * «local», i la d'alcaldies només sap el nom del partit tal com el va escriure
 * cada ajuntament. Es comprova contra l'any que sabem de cert —el 2023— i, si
 * la sèrie no hi arriba, no es dibuixa: una corba que comença en fals és pitjor
 * que no tenir-ne cap, perquè sembla una davallada quan és un forat de dades.
 *
 * El llindar és 0,7 i no 0,8 perquè amb 0,8 el **PSC** en quedava fora: la
 * sèrie de l'AOC li'n compta 1.156 regidories el 2023 i nosaltres 1.463 —un
 * 79 %—, perquè les seves coalicions locals («UA-PSC-CP» i companyia) hi entren
 * com a llista local. La diferència és sistemàtica i la forma de la corba és
 * seva. Els Comuns, que sí que s'han d'amagar, hi són al 20 % (48 de 244), i
 * les federacions comarcals a zero: entre el 20 % i el 79 % hi cap qualsevol
 * llindar, i el que no hi cap és deixar fora la sèrie més llarga que tenim.
 */
const MINIM_ACORD = 0.7;

/**
 * Les dues fonts diuen prou el mateix?
 *
 * A banda de la proporció hi ha la tolerància d'una unitat, que és per a les
 * marques petites: Aliança Catalana té dues alcaldies i l'historial n'hi troba
 * una, i un 50 % de diferència aquí no vol dir que la sèrie sigui d'una altra
 * força —vol dir que un ajuntament va escriure les sigles d'una altra manera.
 */
const acorden = (troba: number, real: number): boolean =>
  real === 0 || troba >= real * MINIM_ACORD || real - troba <= 1;

// ------------------------------------------------------------------- tipus

/** Un municipi on la marca té representació. */
export type PartitMunicipi = {
  slug: string;
  name: string;
  comarca: string | null;
  population: number;
  /** Com s'hi diu la llista en aquell poble: «PSC-CP», «ERC-AM», «JxG»… */
  sigles: string;
  /** Slug de la seva candidatura dins del municipi, per anar a la fitxa. */
  candidatura: string | null;
  seats: number;
  totalSeats: number;
  alcaldia: boolean;
  mayorName: string | null;
  /** L'alcaldia surt d'una llista que tota sola ja té la majoria absoluta. */
  majoria: boolean;
};

/** Una convocatòria de la sèrie llarga. `null` vol dir «no ho sabem», no «zero». */
export type PartitEleccio = {
  year: number;
  regidories: number | null;
  /** Totes les regidories de Catalunya aquell any: el denominador honest. */
  regidoriesCatalunya: number;
  /** Municipis on va ser la força més votada. */
  guanyats: number | null;
  alcaldies: number | null;
  /** De quants municipis tenim la sèrie aquell any. */
  municipisAmbSerie: number;
};

export type PartitData = {
  id: string;
  /** Les sigles curtes, que són les que caben a un titular i a una capçalera. */
  sigles: string;
  name: string;
  kind: string;
  color: string;
  /** Marca de la qual prové, quan hi ha hagut escissió o refundació. */
  lineage: string | null;
  lineageSigles: string | null;

  alcaldies: number;
  regidories: number;
  /** Municipis on té alguna regidoria. */
  municipis: number;
  /** Comarques on té alguna alcaldia. */
  comarques: number;
  /** Alcaldies que no van necessitar cap pacte. */
  majories: number;

  /** Habitants dels municipis on té l'alcaldia. */
  poblacioGovernada: number;
  poblacioCatalunya: number;
  /** Vots del 2023 a tot Catalunya. */
  vots: number;
  votsCatalunya: number;

  llocs: PartitMunicipi[];
  serie: PartitEleccio[];
  serieRegidoriesFiable: boolean;
  serieAlcaldiesFiable: boolean;
  /** El que cada sèrie llarga troba al 2023, per poder dir per què no la dibuixem. */
  serieRegidories2023: number;
  serieAlcaldies2023: number;

  /** Les altres marques amb pàgina, per poder-hi saltar sense tornar enrere. */
  altres: { id: string; sigles: string; color: string; alcaldies: number; regidories: number }[];
};

// ------------------------------------------------------------------- format

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const number = (n: number): string => n.toLocaleString("ca-ES");
const percent = (n: number): string => `${n.toFixed(1).replace(".", ",")} %`;
const plural = (n: number, un: string, molts: string): string => (n === 1 ? un : molts);

/**
 * Les sigles curtes de cada marca. Les de `PARTY_BRANDS` són les oficials
 * senceres —«Esquerra Republicana de Catalunya»— i en una capçalera de 3,4 rem
 * ocupen tres línies i deixen d'assemblar-se a un logotip.
 */
const SIGLES_CURTES: Record<string, string> = {
  erc: "ERC", junts: "Junts", psc: "PSC", cup: "CUP", comuns: "Comuns",
  pp: "PP", vox: "Vox", cs: "Ciutadans", pdecat: "PDeCAT",
  aliancacat: "Aliança Catalana", ciu: "CiU", podem: "Podem",
  fic: "FIC", te: "Tots per l'Empordà", idselva: "Independents de la Selva",
  idc: "Independents de Catalunya", cda: "CDA",
};

/**
 * Colors de dades. Són els de `PARTY_BRANDS` excepte el groc pur de la CUP,
 * que damunt del paper cru no es veu; és el mateix fosquim que ja fan servir
 * el mapa dels 947 i les comarques, i ha de continuar sent el mateix.
 */
const COLORS: Record<string, string> = { cup: "#d8d000" };

const NOM_TIPUS: Record<string, string> = {
  state: "partit d'àmbit estatal",
  catalan: "partit d'àmbit català",
  regional: "federació d'àmbit comarcal",
  local: "llista local o d'electors",
};

const siglesDe = (id: string): string => SIGLES_CURTES[id] ?? BRANDS_BY_ID.get(id)?.name ?? id;
const colorDe = (id: string): string => COLORS[id] ?? BRANDS_BY_ID.get(id)?.color ?? "#8b8b8b";

/**
 * Cap color que no sigui un hexadecimal de sis xifres no entra a la pàgina: va
 * dins d'un atribut `style` i un valor amb un punt i coma en podria sortir.
 */
const colorSegur = (color: string): string => (/^#[0-9a-f]{6}$/i.test(color) ? color : "#8b8b8b");

/** Quina tinta es llegeix damunt del color de la marca. El càlcul és a `contrast.ts`. */
export const tintaSobre = (color: string): string => tintaDeContrast(colorSegur(color));

// --------------------------------------------------------------- fragments

/**
 * El mapa dels 947 amb els seus municipis encesos.
 *
 * No es crida `renderMapaCatalunya()` perquè aquella funció no és una peça sinó
 * una **pàgina sencera** —capçalera, cercador, tries de capa i peu— i aquí en
 * caldria només el dibuix. El que sí que es reaprofita és el que costa de tenir:
 * `geometria`, els límits municipals reparats que aquell mòdul exporta. Si un
 * dia el mapa se separa de la seva pàgina, aquesta funció ha de desaparèixer.
 *
 * Hi ha tres estats i no dos: on té l'alcaldia, on hi és sense manar-hi i on no
 * hi és. Amb dos, un poble on la marca té sis regidors de tretze es pintaria
 * igual que un on no s'hi ha presentat mai, i això no és apagat: és fals.
 *
 * Només els municipis encesos són clicables. Els altres no porten enlloc que
 * tingui a veure amb aquesta pàgina, i 947 enllaços perquè 700 no diguin res
 * és el que fa que un lector de pantalla trigui un minut a travessar el mapa.
 */
function renderMapa(data: PartitData): string {
  const perSlug = new Map(data.llocs.map((m) => [m.slug, m]));
  const slugs = Object.keys(geometria.municipis).sort();
  const camins = slugs
    .map((slug) => {
      const d = geometria.municipis[slug]!;
      const lloc = perSlug.get(slug);
      // Els apagats van sense classe: són la majoria —de 700 a 940 dels 947
      // segons la marca— i escriure-la a cadascun costava 14 kB per pàgina de
      // dir el que el color per defecte ja diu. L'apagat és l'estat de base
      // del mapa i el CSS ho ha de dir així.
      if (!lloc) return `<path d="${d}"/>`;
      const on = lloc.candidatura
        ? `../../m/${lloc.slug}/${lloc.candidatura}/`
        : `../../m/${lloc.slug}/`;
      const que = lloc.alcaldia
        ? `${lloc.name}: hi té l'alcaldia, amb ${lloc.seats} de ${lloc.totalSeats} ${plural(lloc.totalSeats, "regidoria", "regidories")}`
        : `${lloc.name}: ${lloc.seats} de ${lloc.totalSeats} ${plural(lloc.totalSeats, "regidoria", "regidories")}, sense l'alcaldia`;
      return `<a href="${escape(on)}"><title>${escape(que)}</title><path class="${
        lloc.alcaldia ? "mana" : "hi-es"
      }" d="${d}"/></a>`;
    })
    .join("");

  const senseAlcaldia = data.municipis - data.alcaldies;
  return `<figure class="partit-mapa">
  <svg viewBox="${escape(geometria.viewBox)}" role="img"
    aria-label="Els 947 municipis de Catalunya. ${escape(data.sigles)} té l'alcaldia de ${data.alcaldies}
    i ${senseAlcaldia} més on hi té regidories sense manar-hi.">
    ${camins}
    ${geometria.contorn ? `<path class="contorn" d="${geometria.contorn}"/>` : ""}
  </svg>
  <ul class="partit-clau">
    <li><i class="mana"></i>${data.alcaldies} amb l'alcaldia</li>
    <li><i class="hi-es"></i>${senseAlcaldia} amb regidories i sense alcaldia</li>
    <li><i class="apagat"></i>${slugs.length - data.municipis} on no hi té representació</li>
  </ul>
  <figcaption>Cada taca encesa és clicable i porta a la fitxa d'aquesta marca en aquell poble.
  <b>Un mapa de municipis sobrerepresenta el buit</b>: el Pallars Sobirà hi ocupa molta més taca
  que el Barcelonès i hi viu una fracció de la gent, de manera que la superfície pintada no és
  la gent governada. Aquesta xifra és més avall, en habitants.</figcaption>
</figure>`;
}

/**
 * Les dues sèries llargues, cadascuna amb el seu eix.
 *
 * Van en dos gràfics i no en un: regidories i alcaldies es compten per milers i
 * per centenars, i posar-les al mateix eix faria que la línia de les alcaldies
 * s'arrapés a zero i semblés que no s'hi mou res. `serieTemporal()` ja hi posa
 * l'eix des de zero i la taula equivalent per a qui no hi veu.
 */
function renderEvolucio(data: PartitData): string {
  const anys = data.serie.map((p) => p.year);
  const primer = anys[0] ?? 1979;
  const ultim = anys[anys.length - 1] ?? ANY_ARA;

  const regidories = data.serieRegidoriesFiable
    ? serieTemporal(
        data.serie
          .filter((p): p is PartitEleccio & { regidories: number } => p.regidories !== null)
          .map((p) => ({ any: p.year, valor: p.regidories })),
        { titol: `${data.sigles} · regidories a tot Catalunya`, format: (v) => number(Math.round(v)) },
      )
    : "";
  // Una línia plana damunt del zero no és una sèrie: és soroll amb eix. Qui no
  // ha tingut mai cap alcaldia ho llegeix escrit, que ocupa menys i diu més.
  const capAlcaldia = data.serie.every((p) => !p.alcaldies);
  const alcaldies = data.serieAlcaldiesFiable && !capAlcaldia
    ? serieTemporal(
        data.serie
          .filter((p): p is PartitEleccio & { alcaldies: number } => p.alcaldies !== null)
          .map((p) => ({ any: p.year, valor: p.alcaldies })),
        { titol: `${data.sigles} · alcaldies a tot Catalunya`, format: (v) => number(Math.round(v)) },
      )
    : "";

  if (!data.serieRegidoriesFiable && !data.serieAlcaldiesFiable) {
    return `<p class="nota feble">D'aquesta marca no en tenim sèrie llarga.</p>
    <p class="nota">Els resultats des del 1979 i l'historial d'alcaldes vénen de dos conjunts
    diferents del recompte del 2023, i cap dels dos no sap veure-hi ${escape(data.sigles)}: el
    primer compta les marques comarcals dins de les llistes locals i el segon només porta el nom
    del partit tal com el va escriure cada ajuntament. Comprovat contra l'any que sabem de cert:
    al 2023 la sèrie de regidories li'n troba ${data.serieRegidories2023} de les
    ${data.regidories} que va treure, i la d'alcaldies ${data.serieAlcaldies2023} de les
    ${data.alcaldies} que té. Amb aquesta diferència, una corba des del 1979 no seria la seva
    història sinó la d'una altra força.</p>`;
  }

  /**
   * La taula respecta les mateixes dues comprovacions que els gràfics.
   *
   * Sense això, Tots per l'Empordà —que té set alcaldies i cap sèrie de
   * regidories— sortia amb una columna de zeros del 1979 al 2023: el gràfic
   * s'amagava i la taula deia igualment que no hi havia tret mai cap regidor.
   * Un guionet vol dir «no ho sabem» i un zero vol dir «cap»; aquí la
   * diferència és tota la feina.
   */
  const files = data.serie
    .map((p) => {
      const reg = data.serieRegidoriesFiable ? p.regidories : null;
      const alc = data.serieAlcaldiesFiable || p.year === ANY_ARA ? p.alcaldies : null;
      const guanyats = data.serieRegidoriesFiable ? p.guanyats : null;
      return `<tr>
      <th scope="row">${p.year}</th>
      <td class="xifra">${reg === null ? "—" : number(reg)}</td>
      <td class="xifra">${
        reg === null || p.regidoriesCatalunya === 0
          ? "—"
          : percent((100 * reg) / p.regidoriesCatalunya)
      }</td>
      <td class="xifra">${alc === null ? "—" : number(alc)}</td>
      <td class="xifra">${guanyats === null ? "—" : number(guanyats)}</td>
    </tr>`;
    })
    .join("");

  /** Per què una columna és tota de guionets, quan ho és. */
  const forats = [
    data.serieRegidoriesFiable
      ? ""
      : `De les <b>regidories</b> anteriors al ${ANY_ARA} no en tenim sèrie: el conjunt del 1979
         ençà compta aquesta marca dins de les llistes locals i al ${ANY_ARA} només li'n troba
         ${data.serieRegidories2023} de les ${data.regidories} que va treure.`,
    data.serieAlcaldiesFiable
      ? ""
      : `De les <b>alcaldies</b> anteriors al ${ANY_ARA} tampoc: l'historial d'alcaldes només
         porta el nom del partit tal com el va escriure cada ajuntament, i al ${ANY_ARA} li'n
         troba ${data.serieAlcaldies2023} de les ${data.alcaldies} que té.`,
  ]
    .filter(Boolean)
    .join(" ");

  return `${regidories === "" ? "" : `<h3 class="subtitol">Regidories, elecció a elecció</h3>${regidories}`}
  ${
    alcaldies === ""
      ? capAlcaldia
        ? `<p class="nota">No ha tingut mai cap alcaldia a Catalunya, ni el ${ANY_ARA} ni cap any
           d'ençà del ${primer}. Per això aquí no hi ha cap corba d'alcaldies: una línia plana
           damunt del zero no diria res que no digui aquesta frase.</p>`
        : ""
      : `<h3 class="subtitol">Alcaldies, mandat a mandat</h3>${alcaldies}`
  }
  <h3 class="subtitol">Les xifres de cada convocatòria</h3>
  <table class="partit-serie">
    <caption class="nomes-lectors">Regidories, part del total català, alcaldies i municipis
    guanyats per ${escape(data.sigles)} a cada elecció municipal del ${primer} al ${ultim}</caption>
    <thead><tr><th>Elecció</th><th>Regidories</th><th>De totes les de Catalunya</th>
      <th>Alcaldies</th><th>Municipis guanyats</th></tr></thead>
    <tbody>${files}</tbody>
  </table>
  <p class="nota">La columna d'alcaldies del <b>${ANY_ARA}</b> és la mateixa llista que hi ha
  més avall, comptada municipi a municipi amb les sigles de cada candidatura; les dels mandats
  anteriors surten de l'historial d'alcaldes, que només porta el nom del partit tal com el va
  escriure cada ajuntament. Són dues maneres de comptar i per això es diuen. «Municipis guanyats»
  són on va ser la <b>força més votada</b>, que no és el mateix que governar-hi: l'alcaldia la
  vota el ple.${
    data.lineage
      ? ` La sèrie no arrossega el passat de ${escape(data.lineageSigles ?? data.lineage)}, la força
         de la qual prové: hi ha una filiació, però no és el mateix partit i no ho volem fer passar per continuïtat.`
      : ""
  }</p>
  ${forats === "" ? "" : `<p class="nota feble">Un guionet no és un zero.</p><p class="nota">${forats}</p>`}`;
}

/** Quants municipis s'ensenyen abans de plegar la resta. */
const VISIBLES = 30;

/**
 * On mana, de més gent a menys.
 *
 * Ordenat per població i no alfabèticament perquè l'ordre ja és una dada: dir
 * que una marca té 121 alcaldies no distingeix 121 pobles de 300 habitants de
 * 121 ciutats, i aquesta llista comença per on viu més gent justament per no
 * amagar aquella diferència.
 */
function renderOnMana(data: PartitData): string {
  const mana = data.llocs.filter((m) => m.alcaldia);
  if (mana.length === 0) {
    return `<p class="veredicte pacte">No té cap alcaldia al mandat ${MANDAT_ARA}.</p>
    <p class="nota">Té ${number(data.regidories)} ${plural(data.regidories, "regidoria", "regidories")}
    repartides per ${number(data.municipis)} ${plural(data.municipis, "municipi", "municipis")},
    totes a l'oposició.</p>`;
  }

  const fila = (m: PartitMunicipi): string => {
    const on = m.candidatura ? `../../m/${m.slug}/${m.candidatura}/` : `../../m/${m.slug}/`;
    return `<li><a href="${escape(on)}">
      <b>${escape(m.name)}</b>
      <span class="hab">${number(m.population)} hab.</span>
      <span class="detall">${escape(m.sigles)} · ${m.seats} de ${m.totalSeats}${
        m.majoria ? " · majoria absoluta" : ""
      }${m.comarca ? ` · ${escape(m.comarca)}` : ""}</span>
    </a></li>`;
  };

  const davant = mana.slice(0, VISIBLES).map(fila).join("");
  const resta = mana.slice(VISIBLES);

  return `<ul class="partit-llocs">${davant}</ul>
  ${
    resta.length > 0
      ? `<details class="partit-resta">
    <summary>Els altres ${number(resta.length)} municipis, del més gran al més petit</summary>
    <ul class="partit-llocs">${resta.map(fila).join("")}</ul>
  </details>`
      : ""
  }
  <p class="nota">Cada enllaç porta a la fitxa d'aquesta marca en aquell poble: què hi va treure,
  qui la representa al ple i si hi va caldre pacte. ${data.majories} d'aquestes
  ${plural(data.majories, "alcaldia", "alcaldies")} ${plural(data.majories, "surt", "surten")} d'una
  llista que tota sola ja tenia la majoria absoluta; les altres ${data.alcaldies - data.majories}
  van necessitar un pacte, o com a mínim que algú s'abstingués.</p>`;
}

/**
 * Les dues poblacions, que no són la mateixa i que sovint es confonen.
 *
 * És la distinció que fa que la xifra gran de la capçalera no enganyi: un
 * partit que governa 1,2 milions d'habitants no té 1,2 milions de votants, i un
 * partit amb molts vots repartits pot no governar gairebé ningú. Van les dues
 * juntes i amb la mateixa mida perquè cap no pugui passar per l'altra.
 */
function renderPoblacio(data: PartitData): string {
  const pctVots = data.votsCatalunya > 0 ? (100 * data.vots) / data.votsCatalunya : 0;
  const pctPoblacio =
    data.poblacioCatalunya > 0 ? (100 * data.poblacioGovernada) / data.poblacioCatalunya : 0;
  return `<ul class="partit-dues">
    <li>
      <span class="etq">La població que el vota</span>
      <span class="gran">${number(data.vots)}</span>
      <span class="secundari">vots a les municipals del ${ANY_ARA}, el ${percent(pctVots)}
      dels ${number(data.votsCatalunya)} vots a candidatures de tot Catalunya</span>
    </li>
    <li class="governa">
      <span class="etq">La població que governa</span>
      <span class="gran">${number(data.poblacioGovernada)}</span>
      <span class="secundari">${
        data.alcaldies === 0
          ? "no té cap alcaldia: no governa cap habitant de Catalunya"
          : `habitants dels ${number(data.alcaldies)} ${plural(data.alcaldies, "municipi", "municipis")} on té l'alcaldia, el ${percent(pctPoblacio)} de Catalunya`
      }</span>
    </li>
  </ul>
  <p class="veredicte">Els vots són qui el va triar; els habitants governats són tothom qui viu on té l'alcaldia, l'hagi votat o no.</p>
  <p class="nota">Per això les dues xifres no es poden sumar ni comparar directament: als vots
  només hi compta qui podia votar i va anar a votar, i a la població governada hi compta tothom
  —criatures, gent sense dret de vot i qui va votar una altra cosa. En un municipi governat, la
  majoria dels habitants no l'han votat mai: és així a tot arreu i no és cap anomalia
  d'aquesta marca.</p>`;
}

// -------------------------------------------------------------------- estil

/**
 * L'accent d'aquesta pàgina és el color de la marca, com a la fitxa de
 * candidatura i per la mateixa raó: la pàgina és d'aquella marca i de cap
 * altra. El fons continua sent el paper de la casa i el color només omple
 * peces —la pastilla del títol, les taques enceses del mapa, els filets—,
 * mai text llarg ni el fons de la pàgina. El portal ha de ser visiblement
 * de ningú fins i tot aquí.
 */
export const PARTIT_CSS = `
.partit-dalt{height:10px;background:var(--accent);border-bottom:2.5px solid var(--ink)}
.partit-portada{padding:var(--e3) 0 var(--e4)}
.partit-tornar{font-size:.82rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;
  color:var(--ink-suau);text-decoration:none;display:inline-block;margin-bottom:var(--e2)}
.partit-tornar:hover{color:var(--ink)}
.partit-sigles{display:inline-block;background:var(--accent);color:var(--accent-tinta);
  border:2.5px solid var(--ink);border-radius:var(--r-m);box-shadow:var(--ombra);
  padding:6px 16px;margin:0 0 var(--e2);font-family:var(--display);font-weight:900;
  letter-spacing:-.03em;font-size:clamp(1.9rem,7vw,3.4rem);line-height:1.12;max-width:100%;
  overflow-wrap:anywhere}
.partit-nom{font-size:1.15rem;color:var(--ink-suau);margin:0 0 var(--e2);max-width:46ch}
.partit-xifres{list-style:none;margin:var(--e3) 0 0;padding:0;display:grid;gap:var(--e2);
  grid-template-columns:repeat(auto-fit,minmax(165px,1fr))}
.partit-xifres li{background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);
  box-shadow:var(--ombra);padding:var(--e2);display:flex;flex-direction:column;gap:3px}
.partit-xifres .gran{font-family:var(--display);font-weight:900;font-size:2.1rem;line-height:1;
  letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.partit-xifres .etq,.partit-dues .etq{font-size:.68rem;font-weight:800;text-transform:uppercase;
  letter-spacing:.1em;color:var(--ink-suau)}

/* --- el mapa dels 947 amb els seus municipis encesos --------------------- */
.partit-mapa{margin:var(--e2) 0 0;padding:0}
.partit-mapa svg{width:100%;height:auto;display:block;max-width:900px;margin:0 auto}
.partit-mapa path{fill:#DED8CB;stroke:var(--ink);stroke-width:.7;stroke-linejoin:round}
.partit-mapa a:hover path,.partit-mapa a:focus path{stroke-width:3.5}
.partit-mapa .contorn{fill:none;stroke:var(--ink);stroke-width:3.5}
.partit-mapa .mana{fill:var(--accent)}
/* On hi és sense manar-hi va del mateix color rebaixat i no d'un color nou:
   la diferència entre els dos estats és de quantitat, i inventar-hi un segon
   to faria pensar en una segona força. */
.partit-mapa .hi-es{fill:var(--accent);fill-opacity:.3}
.partit-clau{display:flex;gap:var(--e2);flex-wrap:wrap;align-items:center;margin:var(--e3) 0 0;
  font-size:.84rem;font-weight:700;list-style:none;padding:0}
.partit-clau li{display:flex;align-items:center;gap:6px}
.partit-clau i{width:22px;height:22px;border:2px solid var(--ink);border-radius:5px;display:inline-block}
.partit-clau i.mana{background:var(--accent)}
.partit-clau i.hi-es{background:var(--accent-esvait)}
.partit-clau i.apagat{background:#DED8CB}
.partit-mapa figcaption{font-size:.84rem;color:var(--ink-suau);margin-top:var(--e2)}
.partit-mapa figcaption b{color:var(--ink)}

/* --- la sèrie llarga ----------------------------------------------------- */
.subtitol{font-family:var(--display);font-weight:900;font-size:1.05rem;letter-spacing:-.02em;
  margin:var(--e3) 0 0}
.partit-serie{width:100%;border-collapse:collapse;font-size:.95rem;margin-top:var(--e2)}
.partit-serie th,.partit-serie td{text-align:left;padding:9px 12px 9px 0;
  border-bottom:1px solid var(--vora);vertical-align:top}
.partit-serie thead th{font-size:.7rem;text-transform:uppercase;letter-spacing:.1em;
  color:var(--ink-suau);border-bottom:2.5px solid var(--ink)}
.partit-serie tbody th{font-weight:800;font-variant-numeric:tabular-nums}
.partit-serie .xifra{font-variant-numeric:tabular-nums;white-space:nowrap}

/* --- on mana ------------------------------------------------------------- */
.partit-llocs{list-style:none;margin:0;padding:0;display:grid;gap:var(--e1);
  grid-template-columns:repeat(auto-fit,minmax(250px,1fr))}
.partit-llocs a{display:flex;flex-wrap:wrap;align-items:baseline;gap:0 8px;background:var(--paper-2);
  border:2.5px solid var(--ink);border-radius:var(--r-m);box-shadow:var(--ombra);
  padding:11px var(--e2);text-decoration:none;color:inherit;
  transition:transform .12s ease,box-shadow .12s ease}
.partit-llocs a:hover{transform:translate(2px,2px);box-shadow:1px 1px 0 var(--ink)}
.partit-llocs b{font-family:var(--display);font-weight:900;font-size:1.02rem;letter-spacing:-.02em;
  overflow-wrap:anywhere}
.partit-llocs .hab{margin-left:auto;font-size:.82rem;font-weight:800;color:var(--ink-suau);
  font-variant-numeric:tabular-nums;white-space:nowrap}
.partit-llocs .detall{flex-basis:100%;font-size:.78rem;color:var(--ink-suau);overflow-wrap:anywhere}
.partit-resta{margin-top:var(--e2)}
.partit-resta > summary{font-size:.85rem;font-weight:800;cursor:pointer;padding:10px 0;
  color:var(--ink-suau)}
.partit-resta > summary:hover{color:var(--ink)}
.partit-resta[open] > summary{margin-bottom:var(--e2)}
@media (prefers-reduced-motion:reduce){.partit-llocs a{transition:none}}

/* --- les dues poblacions ------------------------------------------------- */
.partit-dues{list-style:none;margin:0 0 var(--e3);padding:0;display:grid;gap:var(--e2);
  grid-template-columns:repeat(auto-fit,minmax(230px,1fr))}
.partit-dues li{background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);
  box-shadow:var(--ombra);padding:var(--e2);display:flex;flex-direction:column;gap:4px}
/* La targeta de la població governada porta el filet del color de la marca:
   és l'única de les dues que depèn de qui té l'alcaldia. */
.partit-dues li.governa{border-left-width:10px;border-left-color:var(--accent)}
.partit-dues .gran{font-family:var(--display);font-weight:900;font-size:2.4rem;line-height:1;
  letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.partit-dues .secundari{font-size:.84rem;color:var(--ink-suau)}

/* --- les altres marques -------------------------------------------------- */
.partit-altres{list-style:none;margin:0;padding:0;display:grid;gap:var(--e1);
  grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}
.partit-altres a{display:flex;align-items:center;gap:9px;background:var(--paper-2);
  border:2.5px solid var(--ink);border-radius:var(--r-m);box-shadow:var(--ombra);
  padding:11px var(--e2);text-decoration:none;color:inherit;
  transition:transform .12s ease,box-shadow .12s ease}
.partit-altres a:hover{transform:translate(2px,2px);box-shadow:1px 1px 0 var(--ink)}
.partit-altres .mostra{width:14px;height:14px;border-radius:4px;background:var(--c);
  border:1.5px solid var(--ink);flex:none}
.partit-altres b{font-weight:800;overflow-wrap:anywhere}
.partit-altres span.quantes{margin-left:auto;color:var(--ink-suau);font-size:.84rem;white-space:nowrap}
@media (prefers-reduced-motion:reduce){.partit-altres a{transition:none}}
`;

// -------------------------------------------------------------------- pàgina

export function renderPartit(data: PartitData, generatedAt: string): string {
  const color = colorSegur(data.color);
  const title = `${data.sigles} als ajuntaments — Observatori municipal de quivoto`;
  const resum =
    data.alcaldies > 0
      ? `${data.sigles} té ${number(data.alcaldies)} ${plural(data.alcaldies, "alcaldia", "alcaldies")}, ${number(data.regidories)} ${plural(data.regidories, "regidoria", "regidories")} i governa ${number(data.poblacioGovernada)} habitants de Catalunya.`
      : `${data.sigles} no té cap alcaldia a Catalunya: hi té ${number(data.regidories)} ${plural(data.regidories, "regidoria", "regidories")}, ${plural(data.regidories, "tota", "totes")} a l'oposició.`;
  const description = `Quantes alcaldies i quantes regidories té ${data.sigles} als 947 municipis de Catalunya, on mana, quanta gent governa i com li ha anat des del 1979. Només amb dades obertes.`;

  return `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${INDEXABLE ? "" : '<meta name="robots" content="noindex, nofollow">'}
<title>${escape(title)}</title>
<meta name="description" content="${escape(description)}">
<link rel="canonical" href="${SITE}/observatori/partit/${escape(data.id)}/">
<meta property="og:type" content="article">
<meta property="og:site_name" content="quivoto">
<meta property="og:locale" content="ca_ES">
<meta property="og:title" content="${escape(`${data.sigles} als ajuntaments de Catalunya`)}">
<meta property="og:description" content="${escape(resum)}">
<meta property="og:url" content="${SITE}/observatori/partit/${escape(data.id)}/">
<meta property="og:image" content="${SITE}/assets/og.png">
<meta name="twitter:card" content="summary_large_image">
<style>${RADIOGRAFIA_CSS}${PARTIT_CSS}</style>
</head>
<body style="--accent:${color};--accent-tinta:${tintaSobre(color)};--accent-esvait:${color}4d">
<a class="salta" href="#contingut">Ves al contingut</a>
<div class="partit-dalt" aria-hidden="true"></div>

${capcalera("../../", "partits")}
${cercador("../../")}

<main id="contingut">

<section class="partit-portada">
  <a class="partit-tornar" href="../../">← Observatori municipal</a>
  <h1><span class="partit-sigles">${escape(data.sigles)}</span></h1>
  <p class="partit-nom">${escape(data.name)}${
    NOM_TIPUS[data.kind] ? ` · ${escape(NOM_TIPUS[data.kind]!)}` : ""
  }</p>
  <p class="resum">${escape(resum)}</p>
  <ul class="partit-xifres">
    <li><span class="etq">Alcaldies</span><span class="gran">${number(data.alcaldies)}</span>
      <span class="secundari">${
        data.alcaldies === 0
          ? "de 947 municipis: no en governa cap"
          : `de 947 municipis, a ${number(data.comarques)} ${plural(data.comarques, "comarca", "comarques")}`
      }</span></li>
    <li><span class="etq">Regidories</span><span class="gran">${number(data.regidories)}</span>
      <span class="secundari">a ${number(data.municipis)}
      ${plural(data.municipis, "municipi", "municipis")} amb representació</span></li>
    <li><span class="etq">Població governada</span><span class="gran">${number(data.poblacioGovernada)}</span>
      <span class="secundari">habitants als municipis on té l'alcaldia</span></li>
  </ul>
</section>

<nav class="index" aria-label="Seccions d'aquesta pàgina">
  <a href="#mapa">El mapa</a>
  <a href="#evolucio">Des del 1979</a>
  <a href="#mana">On mana</a>
  <a href="#poblacio">Vots i habitants</a>
  <a href="#altres">Les altres marques</a>
</nav>

<section class="bloc" id="mapa">
  <h2>On és, als 947</h2>
  <p class="entrada-bloc">Els municipis amb l'alcaldia van del color de la marca; els que hi tenen
  regidories sense manar-hi, del mateix color rebaixat; la resta, apagats.</p>
  ${renderMapa(data)}
</section>

<section class="bloc" id="evolucio">
  <h2>Com li ha anat des del 1979</h2>
  <p class="entrada-bloc">Dotze eleccions municipals. La comparació va <b>per força i no per
  sigles</b>: les candidatures es rebategen cada poques convocatòries i comparar-les pel nom no
  diria res.</p>
  ${renderEvolucio(data)}
</section>

<section class="bloc" id="mana">
  <h2>On mana</h2>
  <p class="entrada-bloc">Els municipis amb l'alcaldia, del que té més habitants al que en té
  menys.</p>
  ${renderOnMana(data)}
</section>

<section class="bloc" id="poblacio">
  <h2>La gent que el vota i la gent que governa</h2>
  ${renderPoblacio(data)}
</section>

<section class="bloc" id="altres">
  <h2>Les altres marques</h2>
  ${
    data.altres.length > 0
      ? `<ul class="partit-altres">${data.altres
          .map(
            (a) => `<li><a href="../${escape(a.id)}/">
        <span class="mostra" style="--c:${colorSegur(a.color)}"></span>
        <b>${escape(a.sigles)}</b>
        <span class="quantes">${a.alcaldies} ${plural(a.alcaldies, "alcaldia", "alcaldies")}</span>
      </a></li>`,
          )
          .join("")}</ul>`
      : "<p>Ara mateix aquesta és l'única marca amb pàgina pròpia.</p>"
  }
  <p class="nota">No hi ha cap pàgina de «llistes locals», i no és un oblit: sota aquella etiqueta
  hi ha centenars de candidatures que no tenen res a veure les unes amb les altres, i ajuntar-les
  diria que existeix un partit que no existeix. Cadascuna té la seva pàgina al seu municipi.</p>
</section>

<section class="bloc anar">
  <h2>Segueix estirant</h2>
  <ul class="destins">
    <li><a href="../../mapa/"><b>El mapa dels 947</b>
      <span>Els mateixos municipis pintats per força, majoria absoluta i alternança des del
      1979</span></a></li>
    <li><a href="../../els947.html"><b>Els 947, en llista</b>
      <span>Amb cercador i filtres, per si busques un poble concret</span></a></li>
    <li><a href="../../dades/"><b>Baixa't les dades</b>
      <span>Tot això en CSV i JSON, amb l'esquema documentat i la font de cada xifra</span></a></li>
  </ul>
</section>

<section class="bloc fonts">
  <h2>D'on surt tot això</h2>
  <ul>
    <li>Vots, regidories i agrupació de cada candidatura: Generalitat de Catalunya, <code>ntc4-rnwr</code>.</li>
    <li>Alcaldia de cada municipi i historial d'alcaldes des del 1979: Generalitat de Catalunya, <code>6nei-4b44</code>.</li>
    <li>Resultats de les dotze eleccions municipals des del 1979: Consorci AOC, <code>3539f7e6</code>.</li>
    <li>Padró: Generalitat de Catalunya, <code>6nei-4b44</code>.</li>
    <li>Límits municipals del mapa: <a href="${escape(geometria.fontUrl)}" target="_blank" rel="noopener">${escape(geometria.font)}</a>,
      sota <a href="${escape(geometria.llicenciaUrl)}" target="_blank" rel="noopener">${escape(geometria.llicencia)}</a>.</li>
  </ul>
  <p class="nota">Quines candidatures són d'aquesta marca és un càlcul nostre i es pot reproduir
  amb el codi del projecte: surt de l'agrupació electoral que publica la Generalitat i, quan
  aquella no ho diu, de les sigles. Davant del dubte no s'atribueix res a ningú: una alcaldia mal
  assignada és una acusació, i val més una xifra curta que una de falsa. Cap frase d'aquesta
  pàgina l'ha escrita un model de llenguatge.</p>
</section>

</main>
${peu("../../", generatedAt)}

</body>
</html>`;
}

// --------------------------------------------------------------------- accés

/** Les marques de debò: «local» no hi és, perquè no és cap partit. */
const MARQUES = PARTY_BRANDS.filter((b) => b.id !== "local");
const ES_MARCA = new Set(MARQUES.map((b) => b.id));

/**
 * De quina marca és una candidatura.
 *
 * Primer l'agrupació electoral, que és el que la Generalitat publica i el que
 * `resolveBrand()` ja ha desat a `candidatures.brandId`. Quan allò diu «local»
 * o no diu res, es miren les sigles amb la mateixa funció que fa servir tota la
 * resta del projecte: hi ha coalicions locals registrades com a agrupació
 * d'electors que porten la marca escrita a les sigles («UA-PSC-CP»), i deixar-les
 * fora faria que un partit tingués menys regidories de les que té.
 *
 * Torna `null` quan cap de les dues coses no ho aclareix, i això vol dir que
 * aquella llista no compta enlloc: preferim una xifra curta a una d'inventada.
 */
export function marcaDe(brandId: string | null, sigles: string): string | null {
  if (brandId && ES_MARCA.has(brandId)) return brandId;
  const familia = siglesFamily(sigles);
  return familia && ES_MARCA.has(familia) ? familia : null;
}

/**
 * L'ordre amb què `candidatura.ts` reparteix els slugs dins d'un municipi.
 *
 * Aquesta funció és una **còpia deliberada** de l'ordenació de
 * `loadCandidatures()`, i ha de continuar sent-ne una: els slugs de les fitxes
 * de candidatura surten d'aquell ordre, i si aquí s'ordenés diferent tots els
 * enllaços d'aquesta pàgina anirien a la llista del costat o enlloc. Si un dia
 * allò canvia, això ha de canviar el mateix dia.
 */
function slugsDelMunicipi(
  llistes: readonly { id: number; sigles: string; votes: number; seats: number }[],
): Map<number, string> {
  const ambEscons = llistes
    .filter((l) => l.seats > 0)
    .sort((a, b) => b.seats - a.seats || b.votes - a.votes || a.sigles.localeCompare(b.sigles, "ca"));
  const slugs = assignaSlugs(ambEscons.map((l) => l.sigles));
  return new Map(ambEscons.map((l, i) => [l.id, slugs[i]!]));
}

/** L'any en què va començar un mandat: «2023-2027» → 2023. */
function anyDelMandat(term: string): number | null {
  const trobat = /^(\d{4})/.exec(term);
  return trobat ? Number(trobat[1]) : null;
}

type SerieAny = {
  year: number;
  seats: number;
  families: Record<string, number>;
  winnerFamily: string | null;
};
type AlcaldeHistoric = {
  term: string;
  name: string;
  partyRaw: string | null;
  tookOfficeOn: string | null;
};

/**
 * Un camp concret d'una mètrica, com a text i sense portar-ne el document
 * sencer. És el mateix que fa `comarques.ts` i pel mateix motiu: el document
 * d'alcaldes porta l'historial des del 1979 de cada municipi i aquí només en
 * cal una part.
 */
const text = (column: SQLWrapper, path: string) =>
  sql<string | null>`${column}->>${sql.raw(`'${path.replace(/'/g, "''")}'`)}`;

const toNumber = (value: string | null): number | null => {
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/**
 * PGlite fa córrer Postgres dins de WebAssembly i el resultat d'una consulta hi
 * ha de cabre sencer. Les mètriques es demanen en blocs pel mateix motiu que
 * explica `metriques.ts`, i el pitjor d'aquell error és com peta: després
 * d'haver escrit part del web.
 */
const BLOC = 200;

async function enBlocs<T>(consulta: (limit: number, salta: number) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (let salta = 0; ; salta += BLOC) {
    const tros = await consulta(BLOC, salta);
    out.push(...tros);
    if (tros.length < BLOC) break;
  }
  return out;
}

/**
 * Carrega **totes** les marques d'un sol cop, com fa `loadCandidatures()`.
 *
 * Són com a molt disset pàgines, però cadascuna necessita els 947 municipis
 * sencers: fer-ho marca a marca voldria dir llegir els 947 disset vegades.
 */
export async function loadPartits(db: Db): Promise<PartitData[]> {
  const muns = await db
    .select({
      id: municipalities.id,
      slug: municipalities.slug,
      name: municipalities.name,
      comarca: municipalities.comarca,
      population: municipalities.population,
      councilSeats: municipalities.councilSeats,
    })
    .from(municipalities);
  const munById = new Map(muns.map((m) => [m.id, m]));
  const poblacioCatalunya = muns.reduce((suma, m) => suma + (m.population ?? 0), 0);

  const llistes = await db
    .select({
      id: candidatures.id,
      municipalityId: candidatures.municipalityId,
      sigles: candidatures.sigles,
      brandId: candidatures.brandId,
      votes: electionResults.votes,
      seats: electionResults.seats,
    })
    .from(candidatures)
    .innerJoin(electionResults, eq(electionResults.candidatureId, candidatures.id))
    .where(eq(candidatures.electionId, ELECCIO));

  const data = municipalityMetrics.data;

  const governRows = await enBlocs((limit, salta) =>
    db
      .select({
        municipalityId: municipalityMetrics.municipalityId,
        mayorName: text(data, "mayorName"),
        mayorSigles: text(data, "mayorSigles"),
        totalSeats: text(data, "totalSeats"),
      })
      .from(municipalityMetrics)
      .where(eq(municipalityMetrics.kind, "government"))
      .orderBy(municipalityMetrics.municipalityId)
      .limit(limit)
      .offset(salta),
  );

  const serieRows = await enBlocs((limit, salta) =>
    db
      .select({
        municipalityId: municipalityMetrics.municipalityId,
        series: sql<SerieAny[] | null>`${data}->'series'`,
      })
      .from(municipalityMetrics)
      .where(eq(municipalityMetrics.kind, "electoralHistory"))
      .orderBy(municipalityMetrics.municipalityId)
      .limit(limit)
      .offset(salta),
  );

  const alcaldeRows = await enBlocs((limit, salta) =>
    db
      .select({
        municipalityId: municipalityMetrics.municipalityId,
        history: sql<AlcaldeHistoric[] | null>`${data}->'history'`,
      })
      .from(municipalityMetrics)
      .where(eq(municipalityMetrics.kind, "mayors"))
      .orderBy(municipalityMetrics.municipalityId)
      .limit(limit)
      .offset(salta),
  );

  // ---- índexs per municipi

  const perMunicipi = new Map<number, typeof llistes>();
  for (const l of llistes) {
    const seves = perMunicipi.get(l.municipalityId) ?? [];
    seves.push(l);
    perMunicipi.set(l.municipalityId, seves);
  }
  const govern = new Map(governRows.map((r) => [r.municipalityId, r]));

  // ---- el mandat d'ara, municipi a municipi

  const llocsPerMarca = new Map<string, PartitMunicipi[]>();
  const votsPerMarca = new Map<string, number>();
  const regidoriesPerMarca = new Map<string, number>();
  let votsCatalunya = 0;

  for (const [municipalityId, seves] of perMunicipi) {
    const municipi = munById.get(municipalityId);
    if (!municipi) continue;
    const g = govern.get(municipalityId);
    // El ple del 2023 tal com el compta la mètrica de govern; si no hi és, la
    // suma de les regidories repartides, i encara com a últim recurs el nombre
    // d'escons que consta al padró de l'ens.
    const totalSeats =
      toNumber(g?.totalSeats ?? null) ??
      (seves.reduce((suma, l) => suma + l.seats, 0) || municipi.councilSeats || 0);
    const majoria = absoluteMajority(totalSeats);
    votsCatalunya += seves.reduce((suma, l) => suma + l.votes, 0);

    const slugs = slugsDelMunicipi(seves);

    /**
     * De quina candidatura és l'alcaldia.
     *
     * Primer per les sigles exactes, amb la clau dura de `candidatura.ts` —la
     * font de la composició del ple escriu «PSC - CP» on el dataset electoral
     * escriu «PSC-CP»— i, si allò no lliga, per família de sigles i només quan
     * una sola llista d'aquell ple hi encaixa. Si n'hi encaixen dues no se'n
     * tria cap: atribuir una alcaldia a la llista equivocada és el pitjor error
     * que pot cometre aquesta pàgina.
     */
    let alcaldiaDe: number | null = null;
    if (g?.mayorSigles) {
      const k = clau(g.mayorSigles);
      const exactes = seves.filter((l) => clau(l.sigles) === k);
      if (exactes.length === 1) alcaldiaDe = exactes[0]!.id;
      else {
        const familia = siglesFamily(g.mayorSigles);
        const candidates = familia
          ? seves.filter((l) => l.seats > 0 && marcaDe(l.brandId, l.sigles) === familia)
          : [];
        if (candidates.length === 1) alcaldiaDe = candidates[0]!.id;
      }
    }

    for (const l of seves) {
      const marca = marcaDe(l.brandId, l.sigles);
      if (!marca) continue;
      votsPerMarca.set(marca, (votsPerMarca.get(marca) ?? 0) + l.votes);
      if (l.seats === 0 && l.id !== alcaldiaDe) continue;
      regidoriesPerMarca.set(marca, (regidoriesPerMarca.get(marca) ?? 0) + l.seats);
      const llista = llocsPerMarca.get(marca) ?? [];
      llista.push({
        slug: municipi.slug,
        name: municipi.name,
        comarca: municipi.comarca,
        population: municipi.population ?? 0,
        sigles: l.sigles,
        candidatura: slugs.get(l.id) ?? null,
        seats: l.seats,
        totalSeats,
        alcaldia: l.id === alcaldiaDe,
        mayorName: l.id === alcaldiaDe ? g?.mayorName ?? null : null,
        majoria: l.id === alcaldiaDe && majoria > 0 && l.seats >= majoria,
      });
      llocsPerMarca.set(marca, llista);
    }
  }

  // ---- la sèrie de regidories des del 1979, del conjunt de l'AOC

  const regidoriesAny = new Map<number, Map<string, number>>();
  const guanyatsAny = new Map<number, Map<string, number>>();
  const totalAny = new Map<number, number>();
  const municipisAny = new Map<number, number>();
  for (const fila of serieRows) {
    for (const punt of fila.series ?? []) {
      totalAny.set(punt.year, (totalAny.get(punt.year) ?? 0) + punt.seats);
      municipisAny.set(punt.year, (municipisAny.get(punt.year) ?? 0) + 1);
      const perMarca = regidoriesAny.get(punt.year) ?? new Map<string, number>();
      for (const [familia, escons] of Object.entries(punt.families ?? {})) {
        if (!ES_MARCA.has(familia)) continue;
        perMarca.set(familia, (perMarca.get(familia) ?? 0) + escons);
      }
      regidoriesAny.set(punt.year, perMarca);
      if (punt.winnerFamily && ES_MARCA.has(punt.winnerFamily)) {
        const guanyats = guanyatsAny.get(punt.year) ?? new Map<string, number>();
        guanyats.set(punt.winnerFamily, (guanyats.get(punt.winnerFamily) ?? 0) + 1);
        guanyatsAny.set(punt.year, guanyats);
      }
    }
  }

  // ---- les alcaldies de cada mandat, de l'historial d'alcaldes
  //
  // Es compta **el primer alcalde de cada mandat** i no tots els que hi ha
  // passat: qui entra per una moció de censura a mig camí no va guanyar aquella
  // elecció, i comptar-lo faria que la suma d'un any superés els 947.

  const alcaldiesAny = new Map<number, Map<string, number>>();
  for (const fila of alcaldeRows) {
    const perMandat = new Map<string, AlcaldeHistoric>();
    for (const alcalde of fila.history ?? []) {
      const previ = perMandat.get(alcalde.term);
      const abans =
        !previ ||
        (alcalde.tookOfficeOn !== null &&
          (previ.tookOfficeOn === null || alcalde.tookOfficeOn < previ.tookOfficeOn));
      if (abans) perMandat.set(alcalde.term, alcalde);
    }
    for (const [term, alcalde] of perMandat) {
      const year = anyDelMandat(term);
      if (year === null || !alcalde.partyRaw) continue;
      const familia = siglesFamily(alcalde.partyRaw);
      if (!familia || !ES_MARCA.has(familia)) continue;
      const perMarca = alcaldiesAny.get(year) ?? new Map<string, number>();
      perMarca.set(familia, (perMarca.get(familia) ?? 0) + 1);
      alcaldiesAny.set(year, perMarca);
    }
  }

  const anys = [...new Set([...totalAny.keys(), ...alcaldiesAny.keys()])].sort((a, b) => a - b);

  // ---- una pàgina per marca amb alguna alcaldia o alguna regidoria ara

  const ambPagina = MARQUES.filter((brand) => {
    const llocs = llocsPerMarca.get(brand.id) ?? [];
    return llocs.some((m) => m.alcaldia) || (regidoriesPerMarca.get(brand.id) ?? 0) > 0;
  });

  const resum = ambPagina.map((brand) => {
    const llocs = llocsPerMarca.get(brand.id) ?? [];
    return {
      id: brand.id,
      sigles: siglesDe(brand.id),
      color: colorDe(brand.id),
      alcaldies: llocs.filter((m) => m.alcaldia).length,
      regidories: regidoriesPerMarca.get(brand.id) ?? 0,
    };
  });
  resum.sort((a, b) => b.alcaldies - a.alcaldies || b.regidories - a.regidories);

  return ambPagina.map((brand): PartitData => {
    const llocs = [...(llocsPerMarca.get(brand.id) ?? [])].sort(
      (a, b) => b.population - a.population || a.name.localeCompare(b.name, "ca"),
    );
    const mana = llocs.filter((m) => m.alcaldia);
    const regidories = regidoriesPerMarca.get(brand.id) ?? 0;

    const serie: PartitEleccio[] = anys.map((year) => ({
      year,
      regidories: regidoriesAny.get(year)?.get(brand.id) ?? (totalAny.has(year) ? 0 : null),
      regidoriesCatalunya: totalAny.get(year) ?? 0,
      guanyats: totalAny.has(year) ? guanyatsAny.get(year)?.get(brand.id) ?? 0 : null,
      alcaldies:
        year === ANY_ARA
          ? mana.length
          : alcaldiesAny.has(year)
            ? alcaldiesAny.get(year)?.get(brand.id) ?? 0
            : null,
      municipisAmbSerie: municipisAny.get(year) ?? 0,
    }));

    // Les dues comprovacions contra l'any que sabem de cert. Amb el 2023 a
    // zero i desenes d'alcaldies de veritat, la sèrie no és d'aquesta marca.
    const serieRegidories2023 = regidoriesAny.get(ANY_ARA)?.get(brand.id) ?? 0;
    const serieAlcaldies2023 = alcaldiesAny.get(ANY_ARA)?.get(brand.id) ?? 0;

    return {
      id: brand.id,
      sigles: siglesDe(brand.id),
      name: brand.name,
      kind: brand.kind,
      color: colorDe(brand.id),
      lineage: brand.lineage ?? null,
      lineageSigles: brand.lineage ? siglesDe(brand.lineage) : null,

      alcaldies: mana.length,
      regidories,
      municipis: llocs.length,
      comarques: new Set(mana.map((m) => m.comarca).filter(Boolean)).size,
      majories: mana.filter((m) => m.majoria).length,

      poblacioGovernada: mana.reduce((suma, m) => suma + m.population, 0),
      poblacioCatalunya,
      vots: votsPerMarca.get(brand.id) ?? 0,
      votsCatalunya,

      llocs,
      serie,
      serieRegidoriesFiable: acorden(serieRegidories2023, regidories),
      serieAlcaldiesFiable: acorden(serieAlcaldies2023, mana.length),
      serieRegidories2023,
      serieAlcaldies2023,

      altres: resum.filter((a) => a.id !== brand.id),
    };
  });
}
