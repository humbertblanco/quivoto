import { and, eq, inArray } from "drizzle-orm";
import {
  candidacies, candidatures, councilTerms, councillorMandates, electionResults, municipalities,
  municipalityMetrics, people, politicalGroups, type Db,
} from "@quivoto/db";
import { BRANDS_BY_ID, PARTY_BRANDS, siglesFamily } from "@quivoto/shared-schemas/brands";
import { absoluteMajority } from "@quivoto/shared-schemas/seats";
import { INDEXABLE, SITE } from "./config";
import { sobreColor, tintaSobre as tintaDeContrast } from "./contrast";
import { RADIOGRAFIA_CSS } from "./estil";
import { de, nomPreferit, nomsOficials, normalizePersonName, slugify } from "../lib/text";
import { adrecesRegidors } from "./regidor";
import { capcalera, tipografia } from "./capcalera";
import { cercador } from "./cercador";
import { peu } from "./peu";

/**
 * La pàgina d'**una candidatura a un municipi**.
 *
 * La fitxa municipal diu quantes regidories té cada llista i prou. Qui vol
 * saber d'un partit concret al seu poble —que és la pregunta que porta la gent
 * al cercador: «ERC Balaguer», «Junts Vic»— no té on anar. I és exactament el
 * subjecte que la brúixola compararà el 2027: no la marca catalana, sinó la
 * candidatura d'aquell ajuntament, que pot pactar en direcció contrària a la
 * seva marca i que sovint només existeix en aquell poble.
 *
 * N'hi ha una per a cada candidatura **amb representació** al mandat 2023-2027.
 * Les que no van treure cap regidoria no tenen pàgina: no hi ha res a explicar
 * d'elles que no digui ja la fitxa del municipi, i serien milers de pàgines
 * buides.
 */

const ELECCIO = "M20231";
/** Les altres dues convocatòries que tenim candidatura a candidatura. */
const ANTERIORS = ["M20191", "M20151"] as const;
const ANY_ELECCIO: Record<string, number> = { M20231: 2023, M20191: 2019, M20151: 2015 };

// ------------------------------------------------------------------- tipus

/** Un any de la sèrie de la força a aquell municipi, des del 1979. */
export type PuntSerie = {
  year: number;
  /** Regidories del ple aquell any. */
  seats: number;
  /** Regidories que va treure la força d'aquesta candidatura. */
  familySeats: number;
  /** Cert quan la força d'aquesta candidatura va ser la més votada. */
  won: boolean;
  /** Regidories de la força predecessora (CiU per a Junts i PDeCAT). */
  lineageSeats: number | null;
};

/** Com es deia i què va treure la mateixa marca a les eleccions anteriors. */
export type PassadaRecent = { year: number; sigles: string; votes: number; seats: number };

export type RegidorPle = {
  name: string;
  /** «Alcalde President», «2a Tinent d'Alcalde», «Regidora»… tal com ho publica la font. */
  role: string | null;
  /** Com hem lligat aquesta persona amb la candidatura. */
  match: "grup" | "sigles" | "agrupacio";
  /** La fotografia que publica el mateix ajuntament, si en publica. */
  foto: string | null;
  /** L'adreça de la nostra fitxa d'aquesta persona. */
  fitxa: string | null;
  /**
   * Si va encapçalar aquesta llista el 2023: l'alcaldable.
   *
   * Surt de les candidatures proclamades (`candidacies.is_head`), creuades
   * pel nom normalitzat amb el registre d'electes. Un nom que lligui amb dues
   * persones de la mateixa llista no s'hi marca, com sempre.
   */
  capDeLlista: boolean;
  /** El número amb què hi anava, de la mateixa font. `null` si no l'hem lligat. */
  posicioLlista: number | null;
};

export type GermanaPle = { slug: string; sigles: string; seats: number; color: string };

export type CandidaturaData = {
  municipality: {
    slug: string; name: string; comarca: string | null; provincia: string | null;
    population: number | null; electoralSystem: string;
  };
  /** Slug de les sigles dins del municipi; l'adreça és `m/<municipi>/<slug>/`. */
  slug: string;
  sigles: string;
  denominacio: string | null;
  /** Marca supramunicipal a la qual pertany, si n'hi ha cap. */
  brandId: string | null;
  brandName: string | null;
  brandKind: string | null;
  /**
   * La marca que **té pàgina pròpia** a `/observatori/partit/<id>/`, si n'hi ha.
   *
   * Aquesta candidatura és aquell partit en aquest municipi, i fins ara no hi
   * havia manera d'anar de l'una a l'altra: la pàgina de partit sí que enllaça
   * les seves 2.626 candidatures i el camí de tornada no existia. És `null`
   * quan les sigles no són de cap marca coneguda —una llista d'electors, una
   * coalició que apunta a dues marques alhora— i llavors no hi ha pàgina on
   * anar i no s'hi enllaça.
   */
  partitId: string | null;
  /** Força amb què surt a la sèrie històrica; les marques petites hi van com a «local». */
  family: string;
  /** Força de la qual prové (CiU per a Junts i PDeCAT), si n'hi ha. */
  lineage: string | null;
  /** Color oficial de la candidatura, o el de la marca com a reserva. */
  color: string;
  /** Cert quan el color surt del dataset electoral i no de la nostra taula de marques. */
  colorIsOfficial: boolean;

  votes: number;
  seats: number;
  /** Percentatge sobre els vots a candidatures del municipi. */
  share: number;
  totalVotes: number;
  totalSeats: number;
  majority: number;
  isWinner: boolean;
  winnerSigles: string;
  winnerSeats: number;
  winnerHasMajority: boolean;

  /** Cert quan una persona d'aquesta llista ocupa l'alcaldia. */
  hasMayoralty: boolean | null;
  mayorName: string | null;
  /** Sigles de qui té l'alcaldia quan no és aquesta candidatura. */
  mayorSigles: string | null;
  /** Com hem sabut de qui és l'alcaldia. */
  mayoraltySource: "ple" | "metrica" | null;

  history: PuntSerie[];
  /** Primer any en què la força apareix al municipi. */
  firstYear: number | null;
  /**
   * Cert quan la sèrie de l'AOC no compta aquesta candidatura dins de la força
   * que li hem assignat: el 2023 hi surt amb menys regidories de les que va
   * treure. Quan passa, la sèrie no és seva i no la dibuixem.
   */
  historyMismatch: boolean;
  recent: PassadaRecent[];

  councillors: RegidorPle[];
  /** Regidors del ple que no hem pogut lligar amb cap llista. */
  unattached: number;
  siblings: GermanaPle[];
  /**
   * Els noms tal com els escriu la seu electrònica del municipi.
   *
   * Els regidors d'aquesta pàgina vénen del registre d'electes, que els dona
   * sense accents («Marta Farres Falgueras»); la fitxa de cada persona, de la
   * seu electrònica, que els accentua. Són les mateixes fitxes d'on surten les
   * fotografies, i serveixen per escriure aquí cada nom exactament com a la
   * pàgina que l'enllaç del costat obre (`nomPreferit`).
   */
  nomsSeu: string[];
  /**
   * Qui encapçalava aquesta llista el 2023, tal com el dona la font electoral.
   *
   * Sol ser algú de la taula del ple, i llavors hi surt marcat. Quan no hi és
   * —va plegar, o el registre l'escriu d'una manera que no lliga—, es diu, en
   * comptes de deixar que la llista sembli que no en tenia.
   */
  capDeLlista: string | null;
};

// ------------------------------------------------------------------- format

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const number = (n: number): string => n.toLocaleString("ca-ES");
const percent = (n: number): string => `${n.toFixed(1).replace(".", ",")} %`;

/**
 * Clau dura per aparellar sigles escrites de maneres diferents. La font de la
 * composició dels plens escriu «ERC - AM» on el dataset electoral escriu
 * «ERC-AM», i «PSC - CP» on n'hi diu «PSC-CP»: sense treure-ho tot menys
 * lletres i xifres, un de cada cinc regidors es queda sense grup.
 */
export const clau = (text: string): string =>
  text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Forces de la sèrie històrica. Són les úniques claus que fa servir la mètrica
 * `electoralHistory`; les marques comarcals (FIC, Tots per l'Empordà,
 * Independents de la Selva…) hi van comptades com a llistes locals, i aquí ho
 * hem de fer igual o la sèrie d'aquesta pàgina sortiria tota a zero.
 */
const FAMILIES = new Set([
  "psc", "ciu", "junts", "erc", "comuns", "cup", "pp", "cs", "vox", "pdecat", "aliancacat", "local",
]);
const NOM_FAMILIA: Record<string, string> = {
  psc: "PSC", ciu: "CiU", junts: "Junts", erc: "ERC", comuns: "Comuns / ICV",
  cup: "CUP", pp: "PP", cs: "Ciutadans", vox: "Vox", pdecat: "PDeCAT",
  aliancacat: "Aliança Catalana", local: "llistes locals",
};
/**
 * Les marques de debò, que són les que poden tenir pàgina pròpia. «local» no hi
 * és perquè no és cap partit: és el calaix de les llistes d'electors.
 */
const MARQUES_AMB_PAGINA = new Set(PARTY_BRANDS.filter((b) => b.id !== "local").map((b) => b.id));

/**
 * De quina marca amb pàgina és aquesta candidatura, o `null`.
 *
 * És **la mateixa regla que `marcaDe()` de `partit.ts`**, i ha de continuar
 * sent-ho: primer l'agrupació electoral que la Generalitat publica i, quan allò
 * diu «local» o no diu res, les sigles amb `siglesFamily()`. Aquesta és la
 * garantia que l'enllaç no cau enlloc: `loadPartits()` compta les regidories de
 * cada marca amb aquesta mateixa funció i només fa pàgina de les marques que en
 * tenen alguna, de manera que tota candidatura amb representació que resolgui
 * una marca en fa existir la pàgina. Si un dia allò canvia, això ha de canviar
 * el mateix dia.
 */
export function marcaAmbPagina(brandId: string | null, sigles: string): string | null {
  if (brandId && MARQUES_AMB_PAGINA.has(brandId)) return brandId;
  const familia = siglesFamily(sigles);
  return familia && MARQUES_AMB_PAGINA.has(familia) ? familia : null;
}

const NOM_TIPUS: Record<string, string> = {
  state: "partit d'àmbit estatal",
  catalan: "partit d'àmbit català",
  regional: "federació d'àmbit comarcal",
  local: "llista local o d'electors",
};

/**
 * Cap color que no sigui un hexadecimal de sis xifres no entra a la pàgina: va
 * dins d'un atribut `style`, i un valor amb un punt i coma en podria sortir.
 */
const colorSegur = (color: string): string => (/^#[0-9a-f]{6}$/i.test(color) ? color : "#8b8b8b");

/**
 * Sobre el color del partit, quina tinta es llegeix. Hi ha candidatures grogues
 * (#ffff00 de la CUP) i grises molt clares: posar-hi text blanc a sobre les fa
 * il·legibles, i el contrari passa amb les fosques. El càlcul és a `contrast.ts`
 * i és el mateix a totes les pàgines de l'observatori.
 */
export const tintaSobre = (color: string): string => tintaDeContrast(colorSegur(color));

const ESVAIT = (color: string): string => `${color}2e`;

/**
 * La sèrie de sempre del més antic al més nou.
 *
 * La mètrica `electoralHistory` ve ordenada, però la pàgina no ho pot donar per
 * fet: si un dia arribés d'una altra manera, aquí no petaria res —sortirien les
 * dotze columnes barrejades i el text diria «com li ha anat des del 2011» amb
 * la primera columna al 1979. Un gràfic mal ordenat no s'assembla a un error,
 * s'assembla a una dada, i és la mena de cosa que ningú no mira dues vegades.
 */
const ordenada = (history: readonly PuntSerie[]): PuntSerie[] =>
  [...history].sort((a, b) => a.year - b.year);

/** El primer any de la sèrie, vingui com vingui. */
const primerAny = (data: CandidaturaData): number =>
  data.history.length > 0 ? Math.min(...data.history.map((p) => p.year)) : 1979;

// --------------------------------------------------------------- fragments

/**
 * Quaranta-cinc anys de la força en una tira. L'alçada de cada columna és la
 * part del ple que va treure, no un valor absolut: el que interessa és si
 * dominava l'ajuntament, i per això hi ha la ratlla de la majoria absoluta.
 *
 * Els anys sense cap regidoria no s'amaguen: hi queda el buit i la casella
 * marcada, perquè «aquí no hi eren» és informació i no una absència de dada.
 */
function renderSerie(data: CandidaturaData): string {
  const columns = ordenada(data.history)
    .map((point) => {
      const share = point.seats > 0 ? (100 * point.familySeats) / point.seats : 0;
      const lineageShare =
        point.lineageSeats && point.seats > 0 ? (100 * point.lineageSeats) / point.seats : 0;
      const title = point.familySeats > 0
        ? `${point.year}: ${point.familySeats} de ${point.seats} regidories${point.won ? ", la força més votada" : ""}`
        : point.lineageSeats
          ? `${point.year}: cap regidoria; ${NOM_FAMILIA[data.lineage ?? ""] ?? data.lineage}, ${point.lineageSeats}`
          : `${point.year}: cap regidoria`;
      return `<li>
      <span class="pila" title="${escape(title)}">
        ${lineageShare > 0 ? `<span class="tros llinatge" style="--h:${lineageShare.toFixed(1)}%"></span>` : ""}
        ${share > 0
          ? `<span class="tros${point.won ? " guanya" : ""}" style="--h:${share.toFixed(1)}%">${share >= 14 ? point.familySeats : ""}</span>`
          : ""}
      </span>
      <span class="peu-any"><b>${point.year}</b><i>${point.familySeats || "—"}</i></span>
    </li>`;
    })
    .join("");

  const etiqueta = ordenada(data.history)
    .map((p) => `${p.year}: ${p.familySeats} de ${p.seats}`)
    .join("; ");

  return `<figure class="cand-serie">
  <div class="cand-marc">
    <span class="majoria" aria-hidden="true"></span>
    <ul class="cand-anys" role="img" aria-label="Regidories de ${escape(NOM_FAMILIA[data.family] ?? data.family)} a ${escape(data.municipality.name)}. ${escape(etiqueta)}.">${columns}</ul>
  </div>
  <figcaption>Cada columna és una elecció i l'alçada és la part del ple que va treure
  <b>${escape(NOM_FAMILIA[data.family] ?? data.family)}</b> en aquest municipi. La ratlla és la
  <b>majoria absoluta</b>. Els anys amb contorn gruixut hi va ser la força més votada; els que
  no tenen columna, no hi va treure cap regidoria.</figcaption>
</figure>`;
}

/**
 * El ple d'ara: nom, càrrec i grup. Cap dada de contacte, mai.
 *
 * Cada nom s'escriu com a la fitxa de la persona que l'enllaç obre: la seu
 * electrònica mana sobre el registre, que ve sense accents (`nomPreferit`).
 */
function renderRegidors(data: CandidaturaData, oficials: ReadonlyMap<string, string>): string {
  if (data.councillors.length === 0) {
    return `<p class="nota feble">No hem pogut lligar cap regidor del ple d'ara amb aquesta llista.
    La font escriu les sigles en text lliure i aquí no hi encaixen amb prou seguretat; abans que
    atribuir una persona a una llista que potser no és la seva, ho deixem en blanc.</p>`;
  }
  const inicials = (nom: string): string =>
    nom.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
  const ambFoto = data.councillors.filter((r) => r.foto).length;
  const totesAmbFoto = ambFoto === data.councillors.length && ambFoto > 0;
  /*
   * Les cares s'ensenyen quan les tenim, i qui no en té rep la seva inicial.
   *
   * Abans hi havia aquí la mateixa regla de tot-o-res que a la fitxa del
   * municipi: si l'ajuntament no publicava la fotografia de TOTS els regidors
   * del grup, no se'n mostrava cap. A Esplugues de Llobregat en publica 6 de
   * 10 i per això no en sortia ni una, l'alcalde inclòs.
   *
   * El que la regla volia protegir és just: que qui no en té no quedi com a
   * regidor de segona, cosa que no depèn d'ell sinó del que publica el seu
   * ajuntament. Però es respecta millor d'una altra manera —i és la que ja fa
   * la fitxa del municipi—: la inicial no és el forat que queda quan falta una
   * foto, és una peça dissenyada, amb el color de la seva llista i la mateixa
   * mida i la mateixa vora que el retrat. Les dues formes són deliberades i cap
   * de les dues no es llegeix com una absència. Amagar sis cares perquè en
   * falten quatre no igualava ningú: buidava la pàgina.
   */
  const rows = data.councillors
    .map((regidor) => {
      const nom = nomPreferit(oficials, regidor.name);
      return `<tr>
      <th scope="row">${
        regidor.foto
          ? `<img class="cara-cand" src="${escape(regidor.foto)}" alt="" width="36" height="36" loading="lazy">`
          : `<span class="cara-cand inicials" aria-hidden="true">${escape(inicials(nom))}</span>`
      }<span class="qui-cand">${
        regidor.fitxa ? `<a href="${escape(regidor.fitxa)}">${escape(nom)}</a>` : escape(nom)
      }${
        // L'alcaldable, dit amb totes les lletres al costat del nom: és la
        // persona per qui es va votar aquesta llista, i la taula no ho deia.
        // Els altres porten el número amb què hi anaven, en cos petit i dins
        // de la mateixa cel·la: la taula ha de continuar tenint dues columnes
        // per plegar-se bé a 320 px.
        regidor.capDeLlista
          ? ' <span class="cap-llista">cap de llista</span>'
          : regidor.posicioLlista === null
            ? ""
            : ` <span class="num-llista">núm. ${regidor.posicioLlista} de la llista</span>`
      }</span></th>
      <td>${escape(regidor.role ?? "Regidoria")}</td>
    </tr>`;
    })
    .join("");

  /*
   * Qui encapçalava la llista i no és a la taula. Passa: a Barcelona, Ada Colau
   * va encapçalar la llista de Barcelona en Comú el 2023 i va deixar el ple el
   * 2024. Sense aquesta línia, la taula d'aquella llista semblaria que no
   * havia tingut mai cap de llista. Però un nom que no lliga pot ser també un
   * registre que l'escriu diferent, i per això es diuen les dues coses.
   */
  const capNoHiEs =
    data.capDeLlista !== null && !data.councillors.some((r) => r.capDeLlista)
      ? `<p class="nota">Qui encapçalava aquesta llista el 2023, <b>${escape(
          nomPreferit(oficials, data.capDeLlista),
        )}</b>, no surt a la taula: o ja no seu al ple, o el registre d'electes escriu el nom d'una
        manera que no hem sabut lligar amb la llista. Abans d'afirmar que ha plegat, ho deixem així.</p>`
      : "";

  return `<table class="cand-ple">
    <caption class="nomes-lectors">Regidors d'aquesta candidatura al ple 2023-2027</caption>
    <thead><tr><th>Nom</th><th>Càrrec</th><th>A la llista</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${capNoHiEs}
  ${
    ambFoto > 0
      ? `<p class="nota">Les fotografies les publica el mateix ajuntament al seu portal de
         transparència; les reproduïm en mida petita i les retirem a la primera petició de la
         persona, sense demanar-ne el motiu.${
           totesAmbFoto
             ? ""
             : ` D'aquest grup en publica ${ambFoto} de ${data.councillors.length}: qui no hi surt
                no és que no en tingui, és que el seu ajuntament no l'ha publicada, i per això hi
                va la inicial amb el color de la llista i no un buit.`
         }</p>`
      : `<p class="nota">L'ajuntament no publica la fotografia de cap d'aquests regidors, i per
         això hi van les inicials amb el color de la llista.</p>`
  }
  <p class="nota">Grup municipal <b>${escape(data.sigles)}</b>. Publiquem el nom i el càrrec i res més:
  ni correu, ni telèfon, ni cap altra dada de contacte, tot i que la font oberta en porta.
  ${data.councillors.length !== data.seats
    ? `Al ple hi consten ${data.councillors.length} ${data.councillors.length === 1 ? "persona" : "persones"} d'aquesta llista i
       a les urnes en va treure ${data.seats}: la diferència sol ser una substitució a mig mandat,
       o bé que la font escriu les sigles d'una manera que no hem sabut lligar.`
    : ""}</p>`;
}

function renderAlcaldia(data: CandidaturaData, oficials: ReadonlyMap<string, string>): string {
  // Qui té l'alcaldia, escrit com a la seva fitxa i com a la taula de sobre.
  const alcalde = data.mayorName ? nomPreferit(oficials, data.mayorName) : null;
  if (data.hasMayoralty === null) {
    return `<p class="veredicte">No sabem de quina llista és l'alcaldia.</p>
    <p class="nota">La font que publica la composició del ple no diu quin és el partit de
    l'alcaldia amb prou claredat per lligar-lo amb cap candidatura del 2023. Ho tenim per revisar.</p>`;
  }
  if (data.hasMayoralty) {
    const solitud = data.seats >= data.majority;
    return `<p class="veredicte">Aquesta llista té l'alcaldia${alcalde ? `: <b>${escape(alcalde)}</b>` : ""}.</p>
    <p class="nota">${solitud
      ? `Amb ${data.seats} de ${data.totalSeats} regidories tenia la majoria absoluta (${data.majority}), així que <b>no li va caldre pactar amb ningú</b>.`
      : `Amb ${data.seats} de ${data.totalSeats} regidories no arribava a la majoria absoluta, que són ${data.majority}: <b>va caldre un pacte</b>, o com a mínim que algú s'abstingués.${
          data.isWinner ? "" : ` I això que la llista més votada va ser ${escape(data.winnerSigles)}.`
        }`}</p>`;
  }
  return `<p class="veredicte pacte">Aquesta llista no té l'alcaldia${data.mayorSigles ? `: la té ${escape(data.mayorSigles)}` : ""}.</p>
  <p class="nota">${data.isWinner
    ? `Va ser <b>la llista més votada</b> i tot i així no governa: vol dir que la resta del ple va pactar.`
    : `És a l'oposició del mandat 2023-2027.`}${
      alcalde ? ` L'alcaldia és de ${escape(alcalde)}.` : ""
    }</p>`;
}

function renderRecents(data: CandidaturaData): string {
  if (data.recent.length === 0) return "";
  const rows = data.recent
    .map(
      (p) => `<tr>
      <th scope="row">${p.year}</th>
      <td>${escape(p.sigles)}</td>
      <td class="xifra">${number(p.votes)} vots</td>
      <td class="xifra">${p.seats} ${p.seats === 1 ? "regidoria" : "regidories"}</td>
    </tr>`,
    )
    .join("");
  /*
   * La taula va dins d'una caixa que es desplaça ella sola.
   *
   * Quatre columnes amb «9.200 vots» i «11 regidories» sense partir demanen
   * 330 px, i a 320 el document sencer en feia 330: la pàgina s'arrossegava
   * de costat i amb ella la capçalera, el títol i tota la resta. Les xifres no
   * es poden partir —«11 regi- dories» no és una xifra— i escurçar-les seria
   * canviar la dada per fer-la cabre. El que ha de desplaçar-se és la taula, i
   * `.taula-envolta` és la peça que la casa ja té per a això.
   */
  return `<div class="taula-envolta" tabindex="0" role="region"
    aria-label="La mateixa marca a les eleccions anteriors">
    <table class="cand-recents">
    <caption class="nomes-lectors">La mateixa marca a les eleccions anteriors</caption>
    <thead><tr><th>Any</th><th>Es deia</th><th>Vots</th><th>Regidories</th></tr></thead>
    <tbody>${rows}</tbody>
    </table>
  </div>
  <p class="nota">Les mateixes sigles no duren: aquí hi ha què va presentar la mateixa marca
  a les dues eleccions anteriors en aquest municipi, amb el nom exacte que duia cada cop.
  Quan un any no hi surt és que la marca no s'hi va presentar.</p>`;
}

// -------------------------------------------------------------------- estil

/**
 * L'accent d'aquesta pàgina és el color del partit. És l'únic lloc de tot
 * l'observatori on això no trenca la neutralitat: la pàgina és d'aquella
 * candidatura i de cap altra. Fins i tot així, el fons continua sent el paper
 * de la marca i el color només omple peces —barres, filets, la pastilla del
 * títol—, mai text llarg ni el fons de la pàgina.
 */
const CANDIDATURA_CSS = `
.cand-dalt{height:10px;background:var(--accent);border-bottom:2.5px solid var(--ink)}
.cand-portada{padding:var(--e3) 0 var(--e4)}
.cand-tornar{font-size:.82rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;
  color:var(--ink-suau);text-decoration:none;display:inline-block;margin-bottom:var(--e2)}
.cand-tornar:hover{color:var(--ink)}
.cand-sigles{display:inline-block;background:var(--accent);color:var(--accent-tinta);
  border:2.5px solid var(--ink);border-radius:var(--r-m);box-shadow:var(--ombra);
  padding:6px 16px;margin:0 0 var(--e2);font-family:var(--display);font-weight:900;
  letter-spacing:-.03em;font-size:clamp(1.9rem,7vw,3.4rem);line-height:1.12;max-width:100%;
  overflow-wrap:anywhere}
.cand-denominacio{font-size:1.15rem;color:var(--ink-suau);margin:0 0 var(--e2);max-width:44ch}
.cand-marca{list-style:none;margin:var(--e3) 0 0;padding:0;display:flex;flex-wrap:wrap;gap:var(--e2)}
.cand-marca li{display:flex;flex-direction:column;gap:2px;font-size:.9rem}
.cand-marca .etq{font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-suau)}
.cand-marca .mostra-color{display:inline-flex;align-items:center;gap:7px;font-variant-numeric:tabular-nums}
.cand-marca .mostra-color i{width:15px;height:15px;border-radius:4px;background:var(--accent);
  border:1.5px solid var(--ink);display:inline-block}

/* --- el resultat del 2023: la xifra gran i el pes al ple --- */
.cand-resultat{list-style:none;margin:0 0 var(--e3);padding:0;display:grid;gap:var(--e2);
  grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}
.cand-resultat li{background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);
  box-shadow:var(--ombra);padding:var(--e2);display:flex;flex-direction:column;gap:3px}
.cand-resultat .etq{font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-suau)}
.cand-resultat .gran{font-family:var(--display);font-weight:900;font-size:2.1rem;line-height:1;letter-spacing:-.03em}
.cand-pes{display:flex;height:34px;border:2.5px solid var(--ink);border-radius:var(--r-s);overflow:hidden;margin:0 0 var(--e1)}
.cand-pes .seu{flex:1 1 0;border-right:1.5px solid var(--ink);background:var(--paper-2)}
.cand-pes .seu:last-child{border-right:0}
.cand-pes .seu.propia{background:var(--accent)}
.cand-pes-peu{font-size:.84rem;color:var(--ink-suau);margin:0 0 var(--e3)}

/* --- la sèrie des del 1979, en el color del partit --- */
.cand-serie{margin:0 0 var(--e3)}
.cand-marc{position:relative;padding-top:var(--e2)}
.cand-marc .majoria{position:absolute;left:0;right:0;top:calc(var(--e2) + 108px);height:0;
  border-top:2.5px dashed var(--ink);opacity:.5;pointer-events:none;z-index:2}
.cand-anys{list-style:none;margin:0;padding:0;display:flex;gap:4px;align-items:flex-end}
.cand-anys li{flex:1 1 0;display:flex;flex-direction:column;gap:6px;min-width:0}
.cand-anys .pila{height:216px;display:flex;flex-direction:column-reverse;border:2px solid var(--ink);
  border-radius:var(--r-s);overflow:hidden;background:var(--paper-2)}
.cand-anys .tros{height:var(--h);min-height:3px;flex:none;background:var(--accent);color:var(--accent-tinta);
  font-size:.66rem;font-weight:900;display:flex;align-items:center;justify-content:center}
.cand-anys .tros.guanya{box-shadow:inset 0 0 0 2.5px var(--ink)}
.cand-anys .tros.llinatge{background:var(--accent-esvait);border-top:1.5px dashed var(--ink)}
.cand-anys .peu-any{display:flex;flex-direction:column;align-items:center;line-height:1.15}
.cand-anys .peu-any b{font-family:var(--display);font-weight:900;font-size:.8rem;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.cand-anys .peu-any i{font-style:normal;font-size:.62rem;color:var(--ink-suau);font-variant-numeric:tabular-nums}
.cand-serie figcaption{font-size:.84rem;color:var(--ink-suau);margin-top:var(--e2)}
.cand-serie figcaption b{color:var(--ink)}
@media (max-width:620px){
  .cand-anys{gap:2px}
  .cand-anys .pila{height:160px}
  .cand-marc .majoria{top:calc(var(--e2) + 80px)}
  .cand-anys .peu-any b{font-size:.64rem}
  .cand-anys .peu-any i{display:none}
}

/* --- taules pròpies --- */
.cand-ple,.cand-recents{width:100%;border-collapse:collapse;font-size:.95rem}
.cand-ple th,.cand-ple td,.cand-recents th,.cand-recents td{text-align:left;padding:10px 12px 10px 0;
  border-bottom:1px solid var(--vora);vertical-align:top}
.cand-ple thead th,.cand-recents thead th{font-size:.7rem;text-transform:uppercase;letter-spacing:.1em;
  color:var(--ink-suau);border-bottom:2.5px solid var(--ink)}
.cand-ple tbody th,.cand-recents tbody th{font-weight:800}
.cand-recents .xifra{font-variant-numeric:tabular-nums;white-space:nowrap}
.cand-ple tbody tr:first-child th{position:relative;padding-left:16px}
.cand-ple tbody tr:first-child th::before{content:"";position:absolute;left:0;top:14px;width:7px;height:7px;
  border-radius:50%;background:var(--accent);border:1.5px solid var(--ink)}

/* --- els altres grups del mateix ple --- */
.cand-germanes{list-style:none;margin:0;padding:0;display:grid;gap:var(--e1);
  grid-template-columns:repeat(auto-fit,minmax(215px,1fr))}
.cand-germanes a{display:flex;align-items:center;gap:9px;background:var(--paper-2);
  border:2.5px solid var(--ink);border-radius:var(--r-m);box-shadow:var(--ombra);padding:11px var(--e2);
  text-decoration:none;color:inherit;transition:transform .12s ease,box-shadow .12s ease}
.cand-germanes a:hover{transform:translate(2px,2px);box-shadow:1px 1px 0 var(--ink)}
.cand-germanes .mostra{width:14px;height:14px;border-radius:4px;background:var(--c);
  border:1.5px solid var(--ink);flex:none}
.cand-germanes b{font-weight:800;overflow-wrap:anywhere}
.cand-germanes span{margin-left:auto;color:var(--ink-suau);font-size:.86rem;white-space:nowrap}
@media (prefers-reduced-motion:reduce){.cand-germanes a{transition:none}}

.cand-fitxa{display:inline-block;background:var(--ink);color:var(--paper);text-decoration:none;
  border-radius:var(--r-max);padding:9px 20px;font-weight:800;font-size:.95rem;margin-top:var(--e2)}
/* Les dues sortides d'aquesta pàgina: amunt cap al municipi, al costat cap a la
   marca. La segona va buida perquè la primera continuï sent la principal. */
.cand-sortides{display:flex;flex-wrap:wrap;gap:var(--e1);margin:0}
.cand-fitxa.buida{background:transparent;color:var(--ink);border:2.5px solid var(--ink);
  padding:6.5px 17.5px}
/* El nom del poble al títol: la mateixa línia, mig to més petit, perquè les
   sigles continuïn sent el que es veu primer. */
.cand-a-on{display:block;font-family:var(--display);font-weight:900;letter-spacing:-.02em;
  font-size:clamp(1.1rem,3.4vw,1.6rem);line-height:1.15;color:var(--ink-suau);margin-top:2px}
/* El poble del títol és un enllaç que no ho sembla fins que s'hi passa per
   sobre: el mateix color que el text, i el subratllat només en passar-hi. */
.cand-a-on a{color:inherit;text-decoration:none}
.cand-a-on a:hover,.cand-a-on a:focus-visible{text-decoration:underline;text-decoration-thickness:2.5px;
  text-underline-offset:5px}
/* Les sortides de dalt: la mateixa fila de pastilles que la del final, sense
   el marge de sobre que allà les separa del text i sense els punts de llista. */
.cand-sortides.dalt{list-style:none;padding:0;margin-top:var(--e2)}
.cand-sortides.dalt .cand-fitxa{margin-top:0}
/* El cap de llista i el número de llista, al costat del nom a la taula del ple:
   la pastilla en lavanda per a qui encapçalava, i el número en cos petit i
   gris per als altres. Cap dels dos no trenca la línia del nom en un mòbil. */
.cap-llista{display:inline-block;background:var(--lavanda);color:#1E1B2E;border:2px solid var(--ink);
  border-radius:var(--r-max);padding:1px 10px;font-size:.72rem;font-weight:800;white-space:nowrap;
  vertical-align:middle;margin-left:4px}
.num-llista{font-size:.76rem;font-weight:700;color:var(--ink-suau);white-space:nowrap;margin-left:4px}

/* Les cares dels regidors a la taula del ple. Van dins de la mateixa cel·la que
   el nom perquè la taula continuï tenint dues columnes i es plegui bé en un
   mòbil de 320 px. */
.cara-cand{width:36px;height:36px;border-radius:50%;border:2px solid var(--ink);
  object-fit:cover;vertical-align:middle;margin-right:9px;background:var(--paper-2);
  display:inline-block;flex:none}
/* La inicial de qui no té retrat publicat: mateixa mida i mateixa vora que la
   fotografia, i el color de la llista a dins. No és el buit que queda quan
   falta una foto: és l'altra manera d'ensenyar una persona. El fons i la tinta
   surten de «sobreColor()», que garanteix els 4,5:1 de la norma fins i tot amb
   el groc de la CUP i el turquesa de Junts. */
.cara-cand.inicials{display:inline-flex;align-items:center;justify-content:center;
  font-family:var(--display);font-weight:900;font-size:.78rem;
  background:var(--inicial-fons);color:var(--inicial-tinta)}
.cand-ple th[scope="row"]{display:flex;align-items:center;gap:0;flex-wrap:wrap}
/* Els noms llargs es parteixen dins de la seva columna en comptes d'estirar la
   taula: «Maria del Carme Fernández-Villaverde» no ha de desplaçar la pàgina. */
.cand-ple .qui-cand{min-width:0;overflow-wrap:anywhere}
/* La taula de les eleccions anteriors mai no estreny les seves columnes: si no
   hi cap, es desplaça la caixa (vegeu «renderRecents»). */
.taula-envolta .cand-recents{width:auto;min-width:100%}
.taula-envolta:focus-visible{outline:2.5px solid var(--ink);outline-offset:2px}
`;

/**
 * Quan la sèrie no és seva, no es dibuixa. Val més no tenir el gràfic que
 * ensenyar-ne un que atribueix a aquesta candidatura les regidories d'una
 * altra força, o que li'n nega les que va treure.
 */
function mostraSerie(data: CandidaturaData): boolean {
  return data.history.length > 3 && !data.historyMismatch;
}

// -------------------------------------------------------------------- pàgina

export function renderCandidatura(data: CandidaturaData, generatedAt: string): string {
  const m = data.municipality;
  // El nom de la marca amb pàgina, que no sempre és el de `brandId`: hi ha
  // coalicions locals registrades com a agrupació d'electors que porten la
  // marca escrita a les sigles («UA-PSC-CP»), i aquelles també hi han d'anar.
  const nomPartit = data.partitId ? BRANDS_BY_ID.get(data.partitId)?.name ?? null : null;
  const marca = data.brandName ?? nomPartit;
  // Al botó hi va el nom curt, que és el que cap en una línia de 320 px:
  // «PSC a tot Catalunya» i no «Partit dels Socialistes de Catalunya a tot
  // Catalunya», que a més repetiria el país dues vegades.
  const siglesMarca = data.partitId ? NOM_FAMILIA[data.partitId] ?? nomPartit ?? data.sigles : data.sigles;
  const capAlPartit = data.partitId ? `../../../partit/${data.partitId}/` : null;
  // El fons i la tinta de les inicials de qui no té retrat publicat, calculats
  // un sol cop: és el color de la llista, mogut només si no s'hi llegiria.
  const inicial = sobreColor(colorSegur(data.color));
  // Els noms de la seu electrònica, indexats un sol cop per a la taula del ple
  // i la frase de l'alcaldia: un nom que lliga amb dues fitxes no hi entra.
  const oficials = nomsOficials(data.nomsSeu);
  const title = `${data.sigles} a ${m.name} — Observatori municipal de quivoto`;
  const description = `Què va treure ${data.sigles} a ${m.name} el 2023, com li ha anat des del 1979, qui la representa al ple i si té l'alcaldia. Només amb dades obertes.`;

  // Els escons del ple, dibuixats com a caselles: les d'aquesta llista amb el
  // seu color. És la manera més curta de dir «d'aquest ple, aquesta part és seva».
  const caselles = Array.from({ length: Math.max(data.totalSeats, data.seats) }, (_, i) =>
    `<span class="seu${i < data.seats ? " propia" : ""}"></span>`).join("");

  const resum = data.hasMayoralty
    ? `Té l'alcaldia ${de(m.name)}${data.seats >= data.majority ? " amb majoria absoluta" : " sense majoria absoluta, així que va caldre pacte"}.`
    : data.isWinner
      ? `Va ser la llista més votada ${de(m.name)} el 2023 i no governa.`
      : `${data.seats} ${data.seats === 1 ? "regidoria" : "regidories"} de ${data.totalSeats} al ple ${de(m.name)}.`;

  return `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${INDEXABLE ? "" : '<meta name="robots" content="noindex, nofollow">'}
<title>${escape(title)}</title>
<meta name="description" content="${escape(description)}">
<link rel="canonical" href="${SITE}/observatori/m/${escape(m.slug)}/${escape(data.slug)}/">
<meta property="og:type" content="article">
<meta property="og:site_name" content="quivoto">
<meta property="og:locale" content="ca_ES">
<meta property="og:title" content="${escape(`${data.sigles} a ${m.name}`)}">
<meta property="og:description" content="${escape(resum)}">
<meta property="og:url" content="${SITE}/observatori/m/${escape(m.slug)}/${escape(data.slug)}/">
<meta property="og:image" content="${SITE}/assets/og.png">
<meta name="twitter:card" content="summary_large_image">
${tipografia("../../../")}
<style>${RADIOGRAFIA_CSS}${CANDIDATURA_CSS}</style>
</head>
<body style="--accent:${colorSegur(data.color)};--accent-tinta:${tintaSobre(data.color)};--accent-esvait:${ESVAIT(colorSegur(data.color))};--inicial-fons:${colorSegur(inicial.fons)};--inicial-tinta:${inicial.tinta}">
<a class="salta" href="#contingut">Ves al contingut</a>
<div class="cand-dalt" aria-hidden="true"></div>

${capcalera("../../../", "cap")}
${cercador("../../../")}

<main id="contingut">

<section class="cand-portada">
  <a class="cand-tornar" href="../">← ${escape(m.name)}${m.comarca ? ` · ${escape(m.comarca)}` : ""}</a>
  <!-- El títol diu també de quin poble parla. Amb les sigles soles, aquesta
       pàgina i les altres 2.625 tenien un encapçalament que no distingia
       «PSC-CP» de Vic del de Reus: ni per a qui hi arriba des d'un cercador ni
       per a qui la llegeix amb un lector de pantalla, que sovint només en sent
       el primer encapçalament. -->
  <!-- El nom del poble al títol porta a la seva fitxa. Des d'aquesta pàgina
       només s'hi arribava pel micro-enllaç de dalt i pel botó del final, i
       «a Sabadell» és el que qui llegeix vol clicar. -->
  <h1><span class="cand-sigles">${escape(data.sigles)}</span>
    <span class="cand-a-on"><a href="../">a ${escape(m.name)}</a></span></h1>
  ${data.denominacio && data.denominacio !== data.sigles
    ? `<p class="cand-denominacio">${escape(data.denominacio)}</p>`
    : ""}
  <p class="resum">${escape(resum)}</p>
  <ul class="cand-marca">
    <li><span class="etq">Marca</span>${marca
      ? `<span>${capAlPartit
          ? `<a href="${escape(capAlPartit)}">${escape(marca)}</a>`
          : escape(marca)}${data.brandKind ? ` · ${escape(NOM_TIPUS[data.brandKind] ?? data.brandKind)}` : ""}</span>`
      : "<span>sense marca supramunicipal</span>"}</li>
    <li><span class="etq">Color oficial</span>
      <span class="mostra-color"><i></i>${escape(data.color.toUpperCase())}</span></li>
    <li><span class="etq">Municipi</span><span><a href="../">${escape(m.name)}</a>${m.population !== null ? ` · ${number(m.population)} hab.` : ""}</span></li>
  </ul>
  <!-- Les tres sortides, just sota del titular: la fitxa del municipi, qui
       seu al seu ple i la marca a tot Catalunya. Són les mateixes pastilles
       del final de la pàgina, aquí perquè es vegin sense haver-hi d'arribar. -->
  <ul class="cand-sortides dalt">
    <li><a class="cand-fitxa" href="../">La fitxa ${escape(de(m.name))} →</a></li>
    <li><a class="cand-fitxa buida" href="../#regidors">Qui seu al ple</a></li>
    ${capAlPartit
      ? `<li><a class="cand-fitxa buida" href="${escape(capAlPartit)}">${escape(siglesMarca)} a tot Catalunya</a></li>`
      : ""}
  </ul>
</section>

<nav class="index" aria-label="Seccions d'aquesta pàgina">
  <a href="#resultat">El 2023</a>
  ${mostraSerie(data) || data.historyMismatch ? `<a href="#serie">Des del ${primerAny(data)}</a>` : ""}
  <a href="#ple">Qui la representa</a>
  <a href="#alcaldia">L'alcaldia</a>
  <a href="#altres">Els altres grups</a>
</nav>

<section class="bloc" id="resultat">
  <h2>Què va treure el 2023</h2>
  <ul class="cand-resultat">
    <li><span class="etq">Vots</span><span class="gran">${number(data.votes)}</span>
      <span class="secundari">de ${number(data.totalVotes)} vots a candidatures</span></li>
    <li><span class="etq">Percentatge</span><span class="gran">${percent(data.share)}</span>
      <span class="secundari">${data.isWinner ? "la llista més votada" : `per darrere de ${escape(data.winnerSigles)}`}</span></li>
    <li><span class="etq">Regidories</span><span class="gran">${data.seats}</span>
      <span class="secundari">de ${data.totalSeats} · en calen ${data.majority} per governar sol</span></li>
  </ul>
  <div class="cand-pes" role="img" aria-label="${data.seats} de ${data.totalSeats} regidories del ple">${caselles}</div>
  <p class="cand-pes-peu">Cada casella és una regidoria del ple; les del color de la llista són seves.</p>
  <p class="nota">${data.isWinner
    ? `<b>Va guanyar les eleccions</b> del 28 de maig del 2023 en aquest municipi${
        data.winnerHasMajority ? ", i amb majoria absoluta" : ", però sense majoria absoluta"}.`
    : `Va guanyar <b>${escape(data.winnerSigles)}</b>, amb ${data.winnerSeats} ${data.winnerSeats === 1 ? "regidoria" : "regidories"}.`}
  El percentatge és sobre els vots a candidatures: no hi compten els nuls, i els blancs hi van a part.</p>
</section>

${data.recent.length > 0 ? `<section class="bloc">
  <h2>Com s'ha dit abans</h2>
  ${renderRecents(data)}
</section>` : ""}

${mostraSerie(data) ? `<section class="bloc" id="serie">
  <h2>Com li ha anat des del ${primerAny(data)}</h2>
  <p class="entrada-bloc">Hi ha tret representació a ${escape(m.name)} en
  <b>${data.history.filter((p) => p.familySeats > 0).length} de les ${data.history.length} eleccions</b>
  municipals des del ${primerAny(data)}${
    data.history.filter((p) => p.won).length > 0
      ? `, i n'ha guanyat ${data.history.filter((p) => p.won).length}`
      : ", i no n'ha guanyat cap"
  }.${data.firstYear && data.firstYear > primerAny(data)
    ? ` La primera va ser el ${data.firstYear}.`
    : ""}</p>
  ${renderSerie(data)}
  <p class="nota">La sèrie va <b>per força i no per sigles</b>: les candidatures locals es rebategen
  cada poques eleccions —el mateix partit hi surt com a PSC-PSOE, PSC-PM i PSC-CP segons l'any— i
  comparar-les pel nom no diria res. Aquí es compta com a <b>${escape(NOM_FAMILIA[data.family] ?? data.family)}</b>.
  ${data.family === "local" && data.brandId && data.brandId !== "local"
    ? `Aquesta candidatura és de ${escape(marca ?? data.brandId)}, però a la sèrie històrica les marques
       comarcals van comptades amb les llistes locals: no en tenim la sèrie separada des del 1979.`
    : ""}
  ${data.lineage
    ? `Els trams més clars són de <b>${escape(NOM_FAMILIA[data.lineage] ?? data.lineage)}</b>, la força de la qual prové.
       Van marcats a part expressament: hi ha una filiació, però no és el mateix partit i no ho volem fer passar per continuïtat.`
    : ""}</p>
</section>` : data.historyMismatch ? `<section class="bloc" id="serie">
  <h2>Com li ha anat des del 1979</h2>
  <p class="nota feble">Aquí no hi ha la sèrie històrica d'aquesta candidatura.</p>
  <p class="nota">Els resultats des del 1979 ens arriben d'un dataset diferent del de l'últim
  recompte, i els dos no classifiquen igual aquesta llista: la sèrie li atribuiria el 2023 menys
  regidories de les que va treure de veritat. Abans de dibuixar una història que no és la seva,
  la deixem fora. La sèrie del municipi sencer sí que és a
  <a href="../">la fitxa ${escape(de(m.name))}</a>.</p>
</section>` : ""}

<section class="bloc" id="ple">
  <h2>Qui la representa al ple ara</h2>
  ${renderRegidors(data, oficials)}
</section>

<section class="bloc" id="alcaldia">
  <h2>L'alcaldia</h2>
  ${renderAlcaldia(data, oficials)}
  ${data.unattached > 0
    ? `<p class="nota">D'aquest ple hi ha ${data.unattached}
       ${data.unattached === 1 ? "regidor que no hem pogut lligar" : "regidors que no hem pogut lligar"}
       amb cap candidatura: la font n'escriu les sigles en text lliure i no hi encaixen.</p>`
    : ""}
</section>

<section class="bloc" id="altres">
  <h2>Els altres grups d'aquest ple</h2>
  ${data.siblings.length > 0
    ? `<ul class="cand-germanes">${data.siblings
        .map(
          (s) => `<li><a href="../${escape(s.slug)}/"><span class="mostra" style="--c:${colorSegur(s.color)}"></span>
      <b>${escape(s.sigles)}</b><span>${s.seats} ${s.seats === 1 ? "regidoria" : "regidories"}</span></a></li>`,
        )
        .join("")}</ul>`
    : `<p>Aquesta és l'única llista amb representació al ple ${escape(de(m.name))}.</p>`}
  <p class="cand-sortides">
    <a class="cand-fitxa" href="../">Tota la fitxa ${escape(de(m.name))}</a>${
      capAlPartit
        ? `<a class="cand-fitxa buida" href="${escape(capAlPartit)}">${escape(siglesMarca)} a tot Catalunya</a>`
        : ""
    }</p>
  ${capAlPartit
    ? `<p class="nota">Aquesta llista és <b>${escape(marca ?? data.sigles)} en aquest municipi</b>, i la
       marca té pàgina pròpia: quantes alcaldies i quantes regidories té a Catalunya, on mana i
       com li ha anat des del 1979. La relació entre les dues no és mecànica —una candidatura pot
       pactar en direcció contrària a la seva marca, i moltes només existeixen en un poble—, i per
       això les dues pàgines expliquen coses diferents.</p>`
    : `<p class="nota">Aquesta llista no té pàgina de marca: les seves sigles no són de cap partit
       d'àmbit català o estatal dels que en tenim la sèrie sencera, o bé són una coalició que
       n'apunta dos alhora. Quan no ho podem dir amb seguretat, no ho diem.</p>`}
</section>

<section class="bloc fonts">
  <h2>D'on surt tot això</h2>
  <ul>
    <li>Vots, regidories, denominació i color de la candidatura: Generalitat de Catalunya, <code>ntc4-rnwr</code>.</li>
    <li>Composició del ple i càrrecs: Generalitat de Catalunya, <code>nm3n-uhk3</code>.</li>
    <li>Cap de llista i número de cada persona a la llista: candidatures proclamades,
      Generalitat de Catalunya, <code>xnfg-weec</code>.</li>
    <li>Resultats de les dotze eleccions municipals des del 1979: Consorci AOC, <code>3539f7e6</code>.</li>
    <li>Padró i dades de l'ens: Generalitat de Catalunya, <code>6nei-4b44</code>.</li>
  </ul>
  <p class="nota">La marca de cada candidatura, l'agrupació per forces de la sèrie històrica i
  l'aparellament entre regidors i llista són càlculs nostres i es poden reproduir amb el codi
  del projecte. Cap frase d'aquesta pàgina l'ha escrita un model de llenguatge.</p>
</section>

</main>
${peu("../../../", generatedAt)}

</body>
</html>`;
}

// --------------------------------------------------------------------- accés

/** Slugs únics dins d'un mateix municipi: «+P-AM» i «P-AM» no poden col·lidir. */
export function assignaSlugs(sigles: readonly string[]): string[] {
  const usats = new Map<string, number>();
  return sigles.map((s, i) => {
    const base = slugify(s) || `llista-${i + 1}`;
    const vistes = usats.get(base) ?? 0;
    usats.set(base, vistes + 1);
    return vistes === 0 ? base : `${base}-${vistes + 1}`;
  });
}

type SerieMetrica = {
  series: {
    year: number; seats: number; families: Record<string, number>; winnerFamily: string | null;
  }[];
};
type GovernMetrica = { mayorName: string | null; mayorSigles: string | null };

/**
 * Carrega **totes** les candidatures amb representació de Catalunya de cop.
 *
 * Es fa amb set consultes en comptes de dues per municipi perquè són 2.626
 * pàgines: amb l'altre patró serien milers d'anades i vingudes a la base i la
 * publicació passaria de segons a minuts.
 */
export async function loadCandidatures(db: Db): Promise<CandidaturaData[]> {
  const muns = await db
    .select({
      id: municipalities.id, slug: municipalities.slug, name: municipalities.name,
      comarca: municipalities.comarca, provincia: municipalities.provincia,
      population: municipalities.population, electoralSystem: municipalities.electoralSystem,
    })
    .from(municipalities);
  const munById = new Map(muns.map((m) => [m.id, m]));

  const llistes = await db
    .select({
      id: candidatures.id, municipalityId: candidatures.municipalityId,
      sigles: candidatures.sigles, denominacio: candidatures.denominacio,
      agrupacioSigles: candidatures.agrupacioSigles, brandId: candidatures.brandId,
      color: candidatures.color, votes: electionResults.votes, seats: electionResults.seats,
    })
    .from(candidatures)
    .innerJoin(electionResults, eq(electionResults.candidatureId, candidatures.id))
    .where(eq(candidatures.electionId, ELECCIO));

  const anteriors = await db
    .select({
      municipalityId: candidatures.municipalityId, electionId: candidatures.electionId,
      sigles: candidatures.sigles, brandId: candidatures.brandId,
      votes: electionResults.votes, seats: electionResults.seats,
    })
    .from(candidatures)
    .innerJoin(electionResults, eq(electionResults.candidatureId, candidatures.id))
    .where(inArray(candidatures.electionId, [...ANTERIORS]));

  const terms = await db
    .select({ id: councilTerms.id, municipalityId: councilTerms.municipalityId })
    .from(councilTerms)
    .where(eq(councilTerms.electionId, ELECCIO));
  const termIds = new Set(terms.map((t) => t.id));

  const grups = await db
    .select({
      id: politicalGroups.id, municipalityId: politicalGroups.municipalityId,
      termId: politicalGroups.termId, candidatureId: politicalGroups.candidatureId,
      name: politicalGroups.name,
    })
    .from(politicalGroups);

  // Ni `email` ni cap altra dada de contacte: només el que ha de sortir a la pàgina.
  const mandats = await db
    .select({
      municipalityId: councillorMandates.municipalityId, termId: councillorMandates.termId,
      groupId: councillorMandates.groupId, role: councillorMandates.role,
      partyRaw: councillorMandates.partyRaw, orderNum: councillorMandates.orderNum,
      fullName: people.fullName,
    })
    .from(councillorMandates)
    .innerJoin(people, eq(people.id, councillorMandates.personId));

  /*
   * Les candidatures proclamades del 2023: qui encapçalava cada llista i amb
   * quin número hi anava cadascú. Només els titulars, que els suplents també
   * porten número però és el d'una altra llista. Un nom repetit dins de la
   * mateixa llista no pot dir quin número és, i es deixa en blanc.
   */
  const proclamats = await db
    .select({
      candidatureId: candidacies.candidatureId, nom: people.fullName,
      posicio: candidacies.listPosition, capDeLlista: candidacies.isHead,
    })
    .from(candidacies)
    .innerJoin(candidatures, eq(candidatures.id, candidacies.candidatureId))
    .innerJoin(people, eq(people.id, candidacies.personId))
    .where(and(eq(candidatures.electionId, ELECCIO), eq(candidacies.kind, "Titular")));
  const llistaPerCandidatura = new Map<number, { cap: string | null; posicions: Map<string, number | null> }>();
  for (const p of proclamats) {
    const entrada = llistaPerCandidatura.get(p.candidatureId) ?? { cap: null, posicions: new Map() };
    const clauNom = normalizePersonName(p.nom);
    entrada.posicions.set(clauNom, entrada.posicions.has(clauNom) ? null : p.posicio);
    if (p.capDeLlista) entrada.cap = p.nom;
    llistaPerCandidatura.set(p.candidatureId, entrada);
  }

  const metriques = await db
    .select({
      municipalityId: municipalityMetrics.municipalityId,
      kind: municipalityMetrics.kind, data: municipalityMetrics.data,
    })
    .from(municipalityMetrics)
    .where(inArray(municipalityMetrics.kind, ["electoralHistory", "government", "carrecs"]));

  // ---- índexs auxiliars, tots per municipi

  const perMunicipi = new Map<number, typeof llistes>();
  for (const l of llistes) {
    const llista = perMunicipi.get(l.municipalityId) ?? [];
    llista.push(l);
    perMunicipi.set(l.municipalityId, llista);
  }

  /** Del grup a la candidatura, i les claus dures per repescar els regidors. */
  const grupsPerMunicipi = new Map<number, { candidatureId: number | null; clau: string }[]>();
  const candidaturaPerGrup = new Map<number, number>();
  for (const g of grups) {
    if (g.termId === null || !termIds.has(g.termId)) continue;
    if (g.candidatureId !== null) candidaturaPerGrup.set(g.id, g.candidatureId);
    const llista = grupsPerMunicipi.get(g.municipalityId) ?? [];
    llista.push({ candidatureId: g.candidatureId, clau: clau(g.name) });
    grupsPerMunicipi.set(g.municipalityId, llista);
  }

  const historyPerMunicipi = new Map<number, SerieMetrica>();
  const governPerMunicipi = new Map<number, GovernMetrica>();
  const carrecsPerMunicipi = new Map<
    number,
    { carrecs: { nom: string; foto: string | null; fotoPetita: string | null }[] }
  >();
  // Amb un `else` genèric, qualsevol mètrica nova que s'afegís a la consulta
  // entraria com si fos la del govern. Cada tipus, al seu lloc.
  for (const metric of metriques) {
    if (metric.kind === "electoralHistory") {
      historyPerMunicipi.set(metric.municipalityId, metric.data as SerieMetrica);
    } else if (metric.kind === "government") {
      governPerMunicipi.set(metric.municipalityId, metric.data as GovernMetrica);
    } else if (metric.kind === "carrecs") {
      carrecsPerMunicipi.set(
        metric.municipalityId,
        metric.data as { carrecs: { nom: string; foto: string | null; fotoPetita: string | null }[] },
      );
    }
  }

  const anteriorsPerMunicipi = new Map<number, typeof anteriors>();
  for (const a of anteriors) {
    const llista = anteriorsPerMunicipi.get(a.municipalityId) ?? [];
    llista.push(a);
    anteriorsPerMunicipi.set(a.municipalityId, llista);
  }

  const mandatsPerMunicipi = new Map<number, typeof mandats>();
  for (const mandat of mandats) {
    if (mandat.termId === null || !termIds.has(mandat.termId)) continue;
    const llista = mandatsPerMunicipi.get(mandat.municipalityId) ?? [];
    llista.push(mandat);
    mandatsPerMunicipi.set(mandat.municipalityId, llista);
  }

  // ---- una pàgina per candidatura amb representació

  const out: CandidaturaData[] = [];
  for (const [municipalityId, totes] of perMunicipi) {
    const municipality = munById.get(municipalityId);
    if (!municipality) continue;

    const totalVotes = totes.reduce((sum, l) => sum + l.votes, 0);
    const totalSeats = totes.reduce((sum, l) => sum + l.seats, 0);
    const majority = absoluteMajority(totalSeats);
    // Guanyador = la llista més votada, no la que governa.
    const winner = [...totes].sort((a, b) => b.votes - a.votes || b.seats - a.seats)[0];
    if (!winner) continue;

    const ambEscons = totes
      .filter((l) => l.seats > 0)
      .sort((a, b) => b.seats - a.seats || b.votes - a.votes || a.sigles.localeCompare(b.sigles, "ca"));
    const slugs = assignaSlugs(ambEscons.map((l) => l.sigles));
    const slugPerCandidatura = new Map(ambEscons.map((l, i) => [l.id, slugs[i]!]));

    // ---- els regidors del ple, lligats amb la seva llista
    const grupsMunicipi = grupsPerMunicipi.get(municipalityId) ?? [];
    const perClauGrup = new Map<string, number | null>();
    for (const g of grupsMunicipi) {
      // Una clau que aparegui a dos grups no serveix per decidir res.
      perClauGrup.set(g.clau, perClauGrup.has(g.clau) ? null : g.candidatureId);
    }
    const perClauAgrupacio = new Map<string, number | null>();
    for (const l of ambEscons) {
      if (!l.agrupacioSigles) continue;
      const k = clau(l.agrupacioSigles);
      perClauAgrupacio.set(k, perClauAgrupacio.has(k) ? null : l.id);
    }

    const regidorsPerCandidatura = new Map<number, RegidorPle[]>();
    let unattached = 0;
    /**
     * La fitxa de la seu electrònica d'aquest municipi, per a les cares.
     *
     * S'aparella per nom de persona normalitzat, i **si un nom lliga amb més
     * d'una fitxa no s'agafa cap foto**: posar la cara d'algú altre al costat
     * d'un nom és el pitjor error que pot cometre aquesta pàgina.
     */
    const fitxaSeu = carrecsPerMunicipi.get(municipalityId) ?? null;
    const fotoPerPersona = new Map<string, string | null>();
    for (const carrec of fitxaSeu?.carrecs ?? []) {
      const clauNom = normalizePersonName(carrec.nom);
      if (fotoPerPersona.has(clauNom)) fotoPerPersona.set(clauNom, null);
      else fotoPerPersona.set(clauNom, carrec.fotoPetita ?? carrec.foto ?? null);
    }
    // Els mateixos noms, per escriure'ls a la pàgina com a la fitxa de cada persona.
    const nomsSeu = (fitxaSeu?.carrecs ?? []).map((c) => c.nom);
    const adreces = adrecesRegidors(fitxaSeu?.carrecs ?? []);
    const fitxaPerPersona = new Map<string, string>();
    for (const [carrec, adreca] of adreces) {
      fitxaPerPersona.set(normalizePersonName((carrec as { nom: string }).nom), adreca);
    }

    const mandatsMunicipi = [...(mandatsPerMunicipi.get(municipalityId) ?? [])].sort(
      (a, b) => (a.orderNum ?? 9999) - (b.orderNum ?? 9999),
    );
    for (const mandat of mandatsMunicipi) {
      const k = mandat.partyRaw ? clau(mandat.partyRaw) : "";
      // Tres nivells, del més segur al menys: el grup que ja porta la base, les
      // sigles del grup escrites d'una altra manera i, per últim, l'agrupació.
      const directe = mandat.groupId !== null ? candidaturaPerGrup.get(mandat.groupId) ?? null : null;
      const perSigles = directe === null && k ? perClauGrup.get(k) ?? null : null;
      const perAgrupacio = directe === null && perSigles === null && k ? perClauAgrupacio.get(k) ?? null : null;
      const candidatureId = directe ?? perSigles ?? perAgrupacio;
      if (candidatureId === null || !slugPerCandidatura.has(candidatureId)) {
        unattached += 1;
        continue;
      }
      const llista = regidorsPerCandidatura.get(candidatureId) ?? [];
      const clauNom = normalizePersonName(mandat.fullName);
      const proclamada = llistaPerCandidatura.get(candidatureId) ?? null;
      const posicioLlista = proclamada?.posicions.get(clauNom) ?? null;
      llista.push({
        name: mandat.fullName,
        role: mandat.role,
        match: directe !== null ? "grup" : perSigles !== null ? "sigles" : "agrupacio",
        foto: fotoPerPersona.get(clauNom) ?? null,
        fitxa: (() => {
          const a = fitxaPerPersona.get(clauNom);
          return a ? `../regidor/${a}/` : null;
        })(),
        // Cap de llista només si el nom és inequívoc dins de la llista: un
        // número en blanc vol dir dos noms iguals, i llavors tampoc no es marca.
        capDeLlista:
          proclamada?.cap !== null && proclamada !== undefined && proclamada !== null &&
          normalizePersonName(proclamada.cap) === clauNom && posicioLlista !== null,
        posicioLlista,
      });
      regidorsPerCandidatura.set(candidatureId, llista);
    }

    // ---- de qui és l'alcaldia
    const govern = governPerMunicipi.get(municipalityId) ?? null;
    let candidaturaAlcaldia: number | null = null;
    for (const [candidatureId, regidors] of regidorsPerCandidatura) {
      if (regidors.some((r) => /^alcald/i.test(r.role ?? ""))) candidaturaAlcaldia = candidatureId;
    }
    const alcaldiaPerMetrica = govern?.mayorSigles
      ? ambEscons.find((l) => clau(l.sigles) === clau(govern.mayorSigles!))?.id ?? null
      : null;
    const alcaldia = candidaturaAlcaldia ?? alcaldiaPerMetrica;
    const alcaldiaFont: "ple" | "metrica" | null =
      candidaturaAlcaldia !== null ? "ple" : alcaldiaPerMetrica !== null ? "metrica" : null;
    const nomAlcalde =
      (candidaturaAlcaldia !== null
        ? regidorsPerCandidatura.get(candidaturaAlcaldia)?.find((r) => /^alcald/i.test(r.role ?? ""))?.name
        : null) ?? govern?.mayorName ?? null;

    // Del 1979 cap aquí, i sobre una còpia: la mètrica és compartida amb la
    // fitxa del municipi i no s'ha de reordenar la seva.
    const serie = [...(historyPerMunicipi.get(municipalityId)?.series ?? [])].sort(
      (a, b) => a.year - b.year,
    );
    const anteriorsMunicipi = anteriorsPerMunicipi.get(municipalityId) ?? [];

    for (const [i, llista] of ambEscons.entries()) {
      const brand = BRANDS_BY_ID.get(llista.brandId ?? "") ?? null;
      const oficial = llista.color?.trim();
      const colorIsOfficial = Boolean(oficial && /^#[0-9a-f]{6}$/i.test(oficial));
      const color = colorIsOfficial ? oficial! : brand?.color ?? "#8b8b8b";
      // Les marques comarcals no tenen sèrie pròpia des del 1979: `electoralHistory`
      // les compta amb les llistes locals, i aquí ho hem de fer igual.
      const family = llista.brandId && FAMILIES.has(llista.brandId) ? llista.brandId : "local";
      const lineage = brand?.lineage && FAMILIES.has(brand.lineage) ? brand.lineage : null;

      const history: PuntSerie[] = serie.map((point) => ({
        year: point.year,
        seats: point.seats,
        familySeats: point.families[family] ?? 0,
        won: point.winnerFamily === family,
        lineageSeats: lineage ? point.families[lineage] ?? null : null,
      }));
      const primer = history.find((p) => p.familySeats > 0)?.year ?? null;
      // Els dos datasets no classifiquen igual: el nostre `brandId` surt del
      // dataset electoral i les famílies de la sèrie de l'AOC, i en un 1 % dels
      // casos no coincideixen. Es detecta al 2023, l'any que sabem de cert.
      const darrer = history.find((p) => p.year === ANY_ELECCIO[ELECCIO]);
      const historyMismatch = darrer !== undefined && darrer.familySeats < llista.seats;

      // Amb la marca «local» no es pot dir «la mateixa llista»: dues llistes
      // locals d'un mateix poble comparteixen marca sense tenir res a veure.
      const recent: PassadaRecent[] = llista.brandId && brand?.kind !== "local"
        ? ANTERIORS.map((electionId) => {
            const iguals = anteriorsMunicipi.filter(
              (a) => a.electionId === electionId && a.brandId === llista.brandId && a.seats + a.votes > 0,
            );
            if (iguals.length === 0) return null;
            const millor = [...iguals].sort((a, b) => b.votes - a.votes)[0]!;
            return {
              year: ANY_ELECCIO[electionId]!,
              sigles: millor.sigles,
              votes: iguals.reduce((sum, a) => sum + a.votes, 0),
              seats: iguals.reduce((sum, a) => sum + a.seats, 0),
            };
          }).filter((p): p is PassadaRecent => p !== null)
        : [];

      out.push({
        municipality: {
          slug: municipality.slug, name: municipality.name, comarca: municipality.comarca,
          provincia: municipality.provincia, population: municipality.population,
          electoralSystem: municipality.electoralSystem,
        },
        slug: slugs[i]!,
        sigles: llista.sigles,
        denominacio: llista.denominacio,
        brandId: llista.brandId,
        brandName: brand?.name ?? null,
        brandKind: brand?.kind ?? null,
        partitId: marcaAmbPagina(llista.brandId, llista.sigles),
        family,
        lineage,
        color,
        colorIsOfficial,
        votes: llista.votes,
        seats: llista.seats,
        share: totalVotes > 0 ? (100 * llista.votes) / totalVotes : 0,
        totalVotes,
        totalSeats,
        majority,
        isWinner: llista.id === winner.id,
        winnerSigles: winner.sigles,
        winnerSeats: winner.seats,
        winnerHasMajority: winner.seats >= majority,
        hasMayoralty: alcaldia === null ? null : alcaldia === llista.id,
        mayorName: nomAlcalde,
        mayorSigles:
          alcaldia !== null && alcaldia !== llista.id
            ? ambEscons.find((l) => l.id === alcaldia)?.sigles ?? null
            : null,
        mayoraltySource: alcaldiaFont,
        history,
        firstYear: primer,
        historyMismatch,
        recent,
        councillors: regidorsPerCandidatura.get(llista.id) ?? [],
        unattached,
        siblings: ambEscons
          .filter((l) => l.id !== llista.id)
          .map((l) => ({
            slug: slugPerCandidatura.get(l.id)!,
            sigles: l.sigles,
            seats: l.seats,
            color: (l.color?.trim() && /^#[0-9a-f]{6}$/i.test(l.color.trim())
              ? l.color.trim()
              : BRANDS_BY_ID.get(l.brandId ?? "")?.color) ?? "#8b8b8b",
          })),
        nomsSeu,
        capDeLlista: llistaPerCandidatura.get(llista.id)?.cap ?? null,
      });
    }
  }

  return out;
}
