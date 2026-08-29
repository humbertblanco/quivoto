import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inArray } from "drizzle-orm";
import { municipalities, municipalityMetrics, type Db } from "@quivoto/db";

/**
 * Una imatge social per municipi (1200×630), la que surt quan algú comparteix
 * la fitxa a WhatsApp, Bluesky o X.
 *
 * Fins ara les 947 fitxes compartien la mateixa imatge, i per tant compartir-ne
 * una no deia de quin poble era. Aquí cada municipi en té una de seva, amb el
 * nom, la comarca i **un fet que canvia segons el poble**. El fet no és
 * decoratiu: és el mateix criteri que mana a tot el projecte —«què han fet
 * aquests quatre anys al meu poble»— reduït a una frase.
 *
 * Es dibuixa amb Chrome sense finestra perquè és l'única manera d'aconseguir la
 * tipografia del projecte (Gabarito 900 i Nunito Sans, incrustades al document)
 * sense afegir cap dependència al `package.json`. Chrome s'obre **una sola
 * vegada** i es parla amb ell pel protocol de depuració: obrir-lo una vegada per
 * imatge costava 2,6 s cadascuna —41 minuts per als 947— i així baixa a
 * desenes de mil·lisegons.
 */

// ------------------------------------------------------------------ mesures
// El format el fixen les xarxes: 1200×630 és el que demanen Open Graph i
// Twitter Cards, i és el que es retalla bé a la previsualització de WhatsApp.
const AMPLE = 1200;
const ALT = 630;

/** Alçades de les tres franges. Sumen 630 i han de quedar fixes: l'ajust
 *  automàtic de la mida de lletra mesura contra caixes d'alçada coneguda. */
const ALT_CAPCALERA = 100;
const ALT_COS = 362;
const ALT_BANDA = 168;

const ARREL_WEB = new URL("../../../../web/", import.meta.url).pathname;

const CHROME_CANDIDATS = [
  process.env.QUIVOTO_CHROME,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter((x): x is string => Boolean(x));

// ---------------------------------------------------------------- les dades

type GovernmentMetric = {
  mayorName: string | null; mayorSigles: string | null; mayorSeats: number | null;
  winnerSigles: string | null; winnerSeats: number | null; totalSeats: number | null;
  winnerGoverns: boolean | null; winnerHasMajority: boolean | null;
};
type MayorsMetric = {
  currentTermChange: { term: string; mayors: { name: string; tookOfficeOn: string | null }[] } | null;
};
type ElectoralHistory = { series: { year: number; winnerFamily: string | null }[] };
type ResultsMetric = Record<string, { candidatures: { sigles: string; brandId: string | null }[] }>;

/** El que li cal a una imatge: prou per triar la frase i escriure-la. */
export type OgMunicipi = {
  slug: string;
  name: string;
  comarca: string | null;
  government: GovernmentMetric | null;
  mayors: MayorsMetric | null;
  history: ElectoralHistory | null;
  /** Candidatures del 2023: l'únic lloc on les sigles porten marca. */
  results: ResultsMetric | null;
  /** El Síndic compta aquest ajuntament entre els que no tenen oposició. */
  singleList: boolean;
};

/**
 * Com anomenem cada família política en una frase. Les marques de
 * `shared-schemas` porten el nom llarg («Esquerra Republicana de Catalunya»),
 * que en una imatge de 1200 px es menja la frase sencera. En calen dues
 * versions perquè el català demana article dins d'una frase («mana el PSC»)
 * i no en vol dins d'un parèntesi («Mana Anna Puig (PSC)»).
 */
const FAMILIES: Record<string, { nom: string; ambArticle: string }> = {
  erc: { nom: "ERC", ambArticle: "ERC" },
  junts: { nom: "Junts", ambArticle: "Junts" },
  psc: { nom: "PSC", ambArticle: "el PSC" },
  cup: { nom: "CUP", ambArticle: "la CUP" },
  comuns: { nom: "comuns", ambArticle: "els comuns" },
  pp: { nom: "PP", ambArticle: "el PP" },
  vox: { nom: "Vox", ambArticle: "Vox" },
  cs: { nom: "Ciutadans", ambArticle: "Ciutadans" },
  pdecat: { nom: "PDeCAT", ambArticle: "el PDeCAT" },
  aliancacat: { nom: "Aliança Catalana", ambArticle: "Aliança Catalana" },
  ciu: { nom: "CiU", ambArticle: "CiU" },
  podem: { nom: "Podem", ambArticle: "Podem" },
  fic: { nom: "FIC", ambArticle: "la FIC" },
  te: { nom: "Tots per l'Empordà", ambArticle: "Tots per l'Empordà" },
  idselva: { nom: "Independents de la Selva", ambArticle: "els Independents de la Selva" },
  idc: { nom: "Independents de Catalunya", ambArticle: "els Independents de Catalunya" },
  cda: { nom: "CDA", ambArticle: "la CDA" },
};

/**
 * Sigles que no diuen res. **Aquesta és la sorpresa gran de la font**: el
 * dataset electoral desa el codi de la coalició, no el nom de la llista local,
 * i per això «CM» —Compromís Municipal, la marca amb què Junts es presenta als
 * pobles— surt com a sigles guanyadores a 338 municipis, «AM» (Acord Municipal,
 * ERC) a 10 i «CP» (Candidatura de Progrés, PSC) a 10. Una imatge que digués
 * «hi va guanyar CM» no informaria de res, així que en aquests casos posem la
 * família política, que sí que es reconeix.
 */
const SIGLES_BUIDES = new Set(["CM", "AM", "CP", "PM", "AMUNT"]);

/** Ratxa mínima per dir que una força «hi guanya sempre»: quatre eleccions
 *  seguides són setze anys, prou per ser un fet i no una coincidència. */
const RATXA_MINIMA = 4;

/** Sigles més llargues que això no caben enlloc; la font n'hi posa de 63 lletres. */
const MAX_SIGLES = 24;

const MESOS = [
  "gener", "febrer", "març", "abril", "maig", "juny",
  "juliol", "agost", "setembre", "octubre", "novembre", "desembre",
];

const escapa = (t: string): string =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** La font desa uns noms en majúscules i uns altres no. En una imatge que es
 *  comparteix, un nom cridant en majúscules sembla un error nostre. */
function capsAlta(nom: string): string {
  const base = nom === nom.toUpperCase()
    ? nom
      .toLocaleLowerCase("ca")
      .replace(/(^|[\s'’-])(\p{L})/gu, (_, abans: string, lletra: string) => abans + lletra.toLocaleUpperCase("ca"))
    : nom;
  // La font desa «Xavier Fonollosa I Comas»: la «i» de connexió dels cognoms
  // catalans va en minúscula, i en majúscula sembla una inicial. 138 noms.
  return base.replace(/(\s)I(\s)/g, "$1i$2");
}

/** La marca de la candidatura del 2023 que porta aquestes sigles, si la sabem. */
function marcaDe(m: OgMunicipi, text: string): string | null {
  const candidatures = m.results?.M20231?.candidatures;
  if (!Array.isArray(candidatures)) return null;
  return candidatures.find((c) => c.sigles === text)?.brandId ?? null;
}

/**
 * Com anomenem una candidatura dins la frase. Les sigles en brut valen gairebé
 * sempre («ERC-AM», «TxA», «CANETENCS»), però hi ha dos casos en què no:
 * quan són un codi de coalició buit (vegeu `SIGLES_BUIDES`) i quan són tan
 * llargues que no caben («VIU SORIGUERA-ESQUERRA REPUBLICANA DE CATALUNYA-ACORD
 * MUNICIPAL», 63 lletres). En tots dos casos la família política diu més.
 */
function etiqueta(m: OgMunicipi, text: string | null, ambArticle: boolean): string | null {
  if (!text) return null;
  const net = text.trim().replace(/\s+/g, " ");
  if (!net) return null;
  if (!SIGLES_BUIDES.has(net.toUpperCase()) && net.length <= MAX_SIGLES) return net;

  const marca = marcaDe(m, net);
  const familia = marca ? FAMILIES[marca] : undefined;
  if (familia) return ambArticle ? familia.ambArticle : familia.nom;
  if (marca === "local") return ambArticle ? "una llista local" : "llista local";
  return net.length > MAX_SIGLES ? `${net.slice(0, MAX_SIGLES - 1).trimEnd()}…` : net;
}

function mesIAny(iso: string | null): string | null {
  if (!iso) return null;
  const [any, mes] = iso.slice(0, 10).split("-");
  const nom = MESOS[Number(mes) - 1];
  return nom && any ? `${nom} del ${any}` : null;
}

/**
 * La ratxa de la força que va guanyar l'última elecció: quantes eleccions
 * seguides la guanya i des de quin any.
 *
 * S'hi exclou la família `local` a posta. Sota aquesta etiqueta hi ha totes les
 * llistes d'electors i les candidatures sense marca supramunicipal, i dues
 * llistes locals de dues eleccions diferents no són la mateixa força: dir «la
 * mateixa força hi guanya des del 1991» quan el que hi ha són tres agrupacions
 * d'independents diferents seria fals.
 */
function ratxaGuanyadora(history: ElectoralHistory | null): { anys: number; desde: number; familia: string } | null {
  const serie = history?.series;
  if (!Array.isArray(serie) || serie.length === 0) return null;
  const familia = serie[serie.length - 1]?.winnerFamily;
  if (!familia || familia === "local") return null;
  let i = serie.length - 1;
  while (i - 1 >= 0 && serie[i - 1]?.winnerFamily === familia) i -= 1;
  return { anys: serie.length - i, desde: serie[i]!.year, familia };
}

export type Frase = {
  /** HTML: només hi pot haver `<b>`, que la plantilla pinta subratllat. */
  html: string;
  /** Quina regla ha guanyat. Serveix per als tests i per comptar la barreja. */
  regla: "canvi-alcaldia" | "pacte" | "llista-unica" | "ratxa" | "qui-mana" | "guanyador" | "sense-dades";
  /** Color de la banda; el tria la regla, no el municipi (vegeu `triaFrase`). */
  banda: "presec" | "lavanda" | "menta";
};

/**
 * La frase de la imatge: **una sola**, i la més rellevant de cada poble.
 *
 * L'ordre de les regles no és arbitrari. Va del fet que més contradiu el que un
 * veí donaria per fet al que menys:
 *
 *  1. **L'alcaldia ha canviat a mig mandat** (97 municipis). És el que ningú no
 *     va votar: el ple d'ara no és el que va sortir de les urnes.
 *  2. **Mana qui no va guanyar** (31). El pacte hi ha pesat més que el vot.
 *  3. **Una sola candidatura** (181). No hi va haver elecció de veritat, i
 *     aquest és el fet més gros que es pot dir d'aquell ajuntament.
 *  4. **La mateixa força hi guanya des de fa setze anys o més** (82). Continuïtat
 *     llarga, que és informació encara que no hi hagi passat res.
 *  5. **Qui mana i amb quina força**, i si té majoria absoluta o no (547). Sempre
 *     n'hi ha, perquè els 947 municipis tenen la mètrica `government`; quan no
 *     sabem de quina llista és l'alcaldia (9 municipis), diem qui va guanyar.
 *
 * Sobre els 947: 97 · 31 · 181 · 82 · 547 · 9.
 *
 * El color de la banda segueix el mateix eix i no el municipi: préssec quan el
 * ple ha canviat de mans, lavanda quan mana el pacte i no el vot, menta quan hi
 * ha continuïtat. Així la imatge ja diu alguna cosa abans de llegir-la.
 */
export function triaFrase(m: OgMunicipi): Frase {
  const g = m.government;

  // 1 · Canvi d'alcaldia dins del mandat 2023-2027.
  const canvi = m.mayors?.currentTermChange;
  const entrant = canvi?.mayors?.[canvi.mayors.length - 1];
  if (entrant) {
    const quan = mesIAny(entrant.tookOfficeOn);
    return {
      regla: "canvi-alcaldia",
      banda: "presec",
      html: quan
        ? `L'alcaldia ha canviat a mig mandat: <b>${escapa(capsAlta(entrant.name))}</b> hi mana des del ${escapa(quan)}.`
        : `L'alcaldia ha canviat a mig mandat: ara hi mana <b>${escapa(capsAlta(entrant.name))}</b>.`,
    };
  }

  // 2 · Mana qui no va guanyar les eleccions.
  const guanyadora = etiqueta(m, g?.winnerSigles ?? null, true);
  const alcaldia = etiqueta(m, g?.mayorSigles ?? null, true);
  if (g && g.winnerGoverns === false && alcaldia && guanyadora) {
    const seus = g.mayorSeats !== null && g.totalSeats !== null
      ? `, amb ${g.mayorSeats} dels ${g.totalSeats} regidors`
      : "";
    return {
      regla: "pacte",
      banda: "lavanda",
      html: `Hi va guanyar ${escapa(guanyadora)}, però mana <b>${escapa(alcaldia)}</b>${seus}.`,
    };
  }

  // 3 · Ajuntament sense oposició.
  if (m.singleList) {
    return {
      regla: "llista-unica",
      banda: "menta",
      html: `Al ple hi ha <b>una sola candidatura</b>: el Síndic de Greuges hi compta un ajuntament sense oposició.`,
    };
  }

  // 4 · La mateixa força hi guanya des de fa quatre eleccions o més.
  const ratxa = ratxaGuanyadora(m.history);
  if (ratxa && ratxa.anys >= RATXA_MINIMA) {
    const nom = FAMILIES[ratxa.familia]?.ambArticle ?? ratxa.familia;
    return {
      regla: "ratxa",
      banda: "menta",
      html: `Hi guanya <b>${escapa(nom)}</b> des del ${ratxa.desde}: ${ratxa.anys} eleccions municipals seguides.`,
    };
  }

  // 5 · Qui mana. Distingim majoria absoluta de govern en minoria, que és el
  //     que decideix si l'alcaldia pot aprovar res sense demanar permís.
  const marcaAlcaldia = etiqueta(m, g?.mayorSigles ?? null, false);
  if (g?.mayorName && marcaAlcaldia) {
    const qui = `<b>${escapa(capsAlta(g.mayorName))}</b> (${escapa(marcaAlcaldia)})`;
    if (g.mayorSeats !== null && g.totalSeats !== null) {
      const majoria = g.mayorSeats * 2 > g.totalSeats;
      return {
        regla: "qui-mana",
        banda: "menta",
        html: majoria
          ? `Mana ${qui} amb majoria absoluta: ${g.mayorSeats} dels ${g.totalSeats} regidors.`
          : `Mana ${qui} sense majoria: ${g.mayorSeats} dels ${g.totalSeats} regidors.`,
      };
    }
    return { regla: "qui-mana", banda: "menta", html: `Hi mana ${qui}.` };
  }

  // 5 bis · 23 municipis on no hem pogut lligar l'alcaldia amb cap llista.
  //         Diem el que sí que sabem: qui va guanyar el 2023.
  if (guanyadora && g?.winnerSeats !== null && g?.totalSeats !== null && g) {
    return {
      regla: "guanyador",
      banda: "menta",
      html: `El 2023 hi va guanyar <b>${escapa(guanyadora)}</b>, amb ${g.winnerSeats} dels ${g.totalSeats} regidors.`,
    };
  }

  return {
    regla: "sense-dades",
    banda: "menta",
    html: `Resultats, comptes i alcaldies des del 1979, amb dades obertes.`,
  };
}

// ------------------------------------------------------------- la plantilla

/** Incrusta un woff2 del web com a `data:`. Sense això Chrome no pot carregar
 *  la tipografia des d'un document servit per `file:`, i la imatge sortiria
 *  amb la lletra del sistema. */
function fontIncrustada(fitxer: string): string {
  const dades = readFileSync(join(ARREL_WEB, "public/assets/fonts", fitxer));
  return `url(data:font/woff2;base64,${dades.toString("base64")}) format('woff2')`;
}

const COLORS_BANDA: Record<Frase["banda"], string> = {
  presec: "#FFD8B8",
  lavanda: "#C9C4F2",
  menta: "#BFE8D2",
};

/**
 * El document que Chrome té obert tota l'estona. Es carrega una vegada i
 * després només se li crida `pinta()` amb les dades de cada municipi: així les
 * tipografies es descodifiquen un sol cop per als 947.
 */
function plantilla(): string {
  // Gabarito i Nunito Sans són variables: el mateix fitxer serveix totes les
  // gruixàries. Calen els dos subconjunts (llatí i llatí estès) perquè el
  // català hi porta «ŀ», «ï» i «à» repartits entre tots dos.
  const gabaritoLlati = fontIncrustada("QGYtz_0dZAGKJJ4t3HtoW4XGnfBI.woff2");
  const gabaritoEstes = fontIncrustada("QGYtz_0dZAGKJJ4t3HtmW4XGnfBI2fk.woff2");
  const nunitoLlati = fontIncrustada("pe0AMImSLYBIv1o4X1M8ce2xCx3yop4tQpF_MeTm0lfUVwoNnq4CLz0_kJ3xzHGGVFM.woff2");
  const nunitoEstes = fontIncrustada("pe0AMImSLYBIv1o4X1M8ce2xCx3yop4tQpF_MeTm0lfUVwoNnq4CLz0_kJPxzHGGVFMV2w.woff2");

  return `<!doctype html>
<html lang="ca"><head><meta charset="utf-8"><title>og</title>
<style>
@font-face{font-family:Gabarito;font-weight:400 900;src:${gabaritoLlati}}
@font-face{font-family:Gabarito;font-weight:400 900;src:${gabaritoEstes}}
@font-face{font-family:"Nunito Sans";font-weight:200 1000;src:${nunitoLlati}}
@font-face{font-family:"Nunito Sans";font-weight:200 1000;src:${nunitoEstes}}
:root{--paper:#FBF7EE;--ink:#1E1B2E;--coral:#E2735A;--presec:#FFD8B8}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${AMPLE}px;height:${ALT}px;overflow:hidden}
body{background:var(--paper);color:var(--ink);font-family:"Nunito Sans",sans-serif;
  -webkit-font-smoothing:antialiased;display:flex;flex-direction:column}

/* La marca, petita: la imatge és del poble, no nostra. */
.capcalera{height:${ALT_CAPCALERA}px;padding:0 64px;display:flex;align-items:center;justify-content:space-between;flex:none}
.logo{font-family:Gabarito,sans-serif;font-weight:900;font-size:34px;letter-spacing:-.05em}
.pastilla{background:var(--presec);border:2.5px solid var(--ink);border-radius:999px;
  box-shadow:3px 3px 0 var(--ink);padding:7px 18px;font-size:17px;font-weight:800;
  text-transform:uppercase;letter-spacing:.09em}

.cos{height:${ALT_COS}px;padding:0 64px;display:flex;flex-direction:column;justify-content:center;flex:none}
.comarca{height:34px;line-height:34px;font-size:24px;font-weight:800;letter-spacing:.15em;
  text-transform:uppercase;color:var(--coral);white-space:nowrap;overflow:hidden}
.caixa-nom{height:296px;display:flex;align-items:center;overflow:hidden;margin-top:10px}
#nom{width:100%;font-family:Gabarito,sans-serif;font-weight:900;letter-spacing:-.035em;line-height:.98}

/* La banda de color: l'única superfície pintada de la imatge, i el que fa que
   dues fitxes diferents es distingeixin d'una ullada. */
.banda{height:${ALT_BANDA}px;padding:0 64px;border-top:3px solid var(--ink);
  display:flex;align-items:center;flex:none}
.caixa-frase{width:100%;height:104px;display:flex;align-items:center;overflow:hidden}
#frase{width:100%;font-weight:600;line-height:1.26}
/* Ressaltat de retolador en comptes de coral: sobre menta o lavanda el coral no
   té prou contrast, i aquí el que importa és que es llegeixi en un mòbil. */
#frase b{font-weight:900;box-shadow:inset 0 -.26em 0 rgba(255,255,255,.72)}
</style></head>
<body>
<div class="capcalera"><span class="logo">quivoto</span><span class="pastilla">Observatori municipal</span></div>
<div class="cos"><p class="comarca" id="comarca"></p><div class="caixa-nom"><h1 id="nom"></h1></div></div>
<div class="banda" id="banda"><div class="caixa-frase"><p id="frase"></p></div></div>
<script>
const nom = document.getElementById("nom");
const frase = document.getElementById("frase");
const comarca = document.getElementById("comarca");
const banda = document.getElementById("banda");

/**
 * La mida de lletra més gran que hi cap, per cerca binària. Un nom de 43
 * lletres com «Cruïlles, Monells i Sant Sadurní de l'Heura» i un de 10 com
 * «Castellcir» han de quedar tots dos bé, i cap regla fixa no ho aconsegueix:
 * val més mesurar. Es comprova l'alçada (que no surti de la caixa) i també
 * l'amplada (que una paraula llarga i sense partició no vessi pels costats).
 */
function encaixa(el, minim, maxim) {
  const caixa = el.parentElement;
  let baix = minim, alt = maxim, millor = minim;
  while (baix <= alt) {
    const mig = (baix + alt) >> 1;
    el.style.fontSize = mig + "px";
    if (el.scrollHeight <= caixa.clientHeight && el.scrollWidth <= el.clientWidth + 1) {
      millor = mig; baix = mig + 1;
    } else { alt = mig - 1; }
  }
  el.style.fontSize = millor + "px";
}

window.pinta = async (d) => {
  comarca.textContent = d.comarca || "Catalunya";
  nom.textContent = d.nom;
  frase.innerHTML = d.frase;
  banda.style.background = d.banda;
  await document.fonts.ready;
  encaixa(nom, 44, 144);
  encaixa(frase, 24, 38);
  // Dos fotogrames: el primer aplica l'estil, el segon garanteix que ja s'ha
  // pintat abans que Chrome faci la captura.
  await new Promise((fet) => requestAnimationFrame(() => requestAnimationFrame(fet)));
  return true;
};
</script>
</body></html>`;
}

// ---------------------------------------------------- Chrome sense finestra

type Cdp = {
  crida: (metode: string, params?: Record<string, unknown>) => Promise<any>;
  tanca: () => Promise<void>;
};

/** Espera que Chrome escrigui el port del protocol de depuració. El demanem
 *  amb `--remote-debugging-port=0` perquè triï un port lliure: si el fixéssim,
 *  dues execucions alhora es trepitjarien. */
async function esperaPort(perfil: string, proces: ChildProcess): Promise<number> {
  const fins = Date.now() + 20_000;
  while (Date.now() < fins) {
    if (proces.exitCode !== null) throw new Error(`Chrome ha sortit amb codi ${proces.exitCode}`);
    try {
      const text = await readFile(join(perfil, "DevToolsActivePort"), "utf8");
      const port = Number(text.split("\n")[0]);
      if (Number.isFinite(port) && port > 0) return port;
    } catch { /* encara no hi és */ }
    await new Promise((fet) => setTimeout(fet, 50));
  }
  throw new Error("Chrome no ha obert el port de depuració en 20 s");
}

/** Obre Chrome amb el document ja carregat i retorna com parlar-hi. */
async function obreChrome(documentUrl: string): Promise<Cdp> {
  const binari = CHROME_CANDIDATS.find((ruta) => {
    try { readFileSync(ruta, { flag: "r" }); return true; } catch { return false; }
  });
  if (!binari) {
    throw new Error(
      `No s'ha trobat Chrome. Provats: ${CHROME_CANDIDATS.join(", ")}. ` +
      `Es pot indicar amb la variable QUIVOTO_CHROME.`,
    );
  }

  const perfil = await mkdtemp(join(tmpdir(), "quivoto-og-"));
  const proces = spawn(binari, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-sync",
    "--mute-audio",
    `--user-data-dir=${perfil}`,
    `--window-size=${AMPLE},${ALT}`,
    "--remote-debugging-port=0",
    documentUrl,
  ], { stdio: "ignore" });

  const port = await esperaPort(perfil, proces);

  // La pestanya que ja té el document obert.
  const objectius = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()) as
    { type: string; webSocketDebuggerUrl?: string }[];
  const pagina = objectius.find((o) => o.type === "page" && o.webSocketDebuggerUrl);
  if (!pagina?.webSocketDebuggerUrl) throw new Error("Chrome no ha obert cap pestanya");

  const ws = new WebSocket(pagina.webSocketDebuggerUrl);
  const pendents = new Map<number, { fet: (v: any) => void; fallat: (e: Error) => void }>();
  let seguent = 0;

  await new Promise<void>((fet, fallat) => {
    ws.addEventListener("open", () => fet(), { once: true });
    ws.addEventListener("error", () => fallat(new Error("no s'ha pogut connectar amb Chrome")), { once: true });
  });

  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(String(event.data));
    const espera = pendents.get(msg.id);
    if (!espera) return;
    pendents.delete(msg.id);
    if (msg.error) espera.fallat(new Error(`${msg.error.message ?? "error"} (${msg.method ?? ""})`));
    else espera.fet(msg.result);
  });

  const crida = (metode: string, params: Record<string, unknown> = {}): Promise<any> => {
    seguent += 1;
    const id = seguent;
    return new Promise((fet, fallat) => {
      pendents.set(id, { fet, fallat });
      ws.send(JSON.stringify({ id, method: metode, params }));
    });
  };

  // Fixem la mida del llenç: `--window-size` no sempre acaba donant un
  // finestral de 1200×630 exactes, i una imatge social de mida variable
  // se serveix retallada.
  await crida("Emulation.setDeviceMetricsOverride", {
    width: AMPLE, height: ALT, deviceScaleFactor: 1, mobile: false,
  });

  // El document pot no haver acabat de carregar quan connectem: hi insistim
  // fins que `pinta()` hi és.
  const fins = Date.now() + 20_000;
  for (;;) {
    const { result } = await crida("Runtime.evaluate", { expression: "typeof window.pinta" });
    if (result?.value === "function") break;
    if (Date.now() > fins) throw new Error("el document de la imatge no s'ha carregat");
    await new Promise((fet) => setTimeout(fet, 50));
  }

  return {
    crida,
    tanca: async () => {
      try { ws.close(); } catch { /* tant se val */ }

      // Cal esperar que Chrome hagi sortit de debò abans d'esborrar-li el
      // perfil: mentre es tanca encara hi escriu, i un `rm` immediat peta amb
      // ENOTEMPTY *després* d'haver generat les 947 imatges, cosa que fa que
      // una feina acabada sembli fallida.
      await new Promise<void>((fet) => {
        if (proces.exitCode !== null || proces.signalCode !== null) return fet();
        const insisteix = setTimeout(() => proces.kill("SIGKILL"), 3_000);
        proces.once("exit", () => { clearTimeout(insisteix); fet(); });
        proces.kill();
      });

      // I si tot i així queda alguna cosa a mig escriure, tant se val: és un
      // directori temporal i no val la pena perdre-hi la feina feta.
      try {
        await rm(perfil, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
      } catch { /* el sistema ja el buidarà */ }
    },
  };
}

// ------------------------------------------------------------------- accés

/** Carrega només el que necessita la imatge dels municipis demanats. */
export async function loadOgMunicipis(db: Db, slugs?: readonly string[]): Promise<OgMunicipi[]> {
  const files = slugs && slugs.length > 0
    ? await db.select().from(municipalities).where(inArray(municipalities.slug, [...slugs]))
    : await db.select().from(municipalities);
  if (files.length === 0) return [];

  const ids = files.map((f) => f.id);
  const mesures = await db
    .select()
    .from(municipalityMetrics)
    .where(inArray(municipalityMetrics.kind, ["government", "mayors", "electoralHistory", "results", "singleList"]));

  const perMunicipi = new Map<number, Record<string, unknown>>();
  const volguts = new Set(ids);
  for (const m of mesures) {
    if (!volguts.has(m.municipalityId)) continue;
    const bossa = perMunicipi.get(m.municipalityId) ?? {};
    bossa[m.kind] = m.data;
    perMunicipi.set(m.municipalityId, bossa);
  }

  return files
    .map((f) => {
      const bossa = perMunicipi.get(f.id) ?? {};
      return {
        slug: f.slug,
        name: f.name,
        comarca: f.comarca,
        government: (bossa.government ?? null) as GovernmentMetric | null,
        mayors: (bossa.mayors ?? null) as MayorsMetric | null,
        history: (bossa.electoralHistory ?? null) as ElectoralHistory | null,
        results: (bossa.results ?? null) as ResultsMetric | null,
        singleList: "singleList" in bossa,
      };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

/**
 * Genera una imatge social per municipi a `<outDir>/<slug>.png`.
 *
 * Sense `slugs` les fa totes. Retorna quantes n'ha escrit i quant ocupen, per
 * poder-ho dir al registre de l'execució.
 */
export async function writeOgImages(
  db: Db,
  outDir: string,
  slugs?: readonly string[],
): Promise<{ images: number; bytes: number }> {
  const municipis = await loadOgMunicipis(db, slugs);
  if (municipis.length === 0) return { images: 0, bytes: 0 };

  await mkdir(outDir, { recursive: true });

  // El document viu en un directori temporal: no ha d'anar al repositori ni
  // acabar servit pel web.
  const treball = await mkdtemp(join(tmpdir(), "quivoto-og-doc-"));
  const documentPath = join(treball, "og.html");
  await writeFile(documentPath, plantilla(), "utf8");

  const chrome = await obreChrome(`file://${documentPath}`);
  let bytes = 0;
  let fetes = 0;
  try {
    for (const municipi of municipis) {
      const frase = triaFrase(municipi);
      const dades = {
        nom: municipi.name,
        comarca: municipi.comarca,
        frase: frase.html,
        banda: COLORS_BANDA[frase.banda],
      };
      await chrome.crida("Runtime.evaluate", {
        expression: `window.pinta(${JSON.stringify(dades)})`,
        awaitPromise: true,
      });
      const { data } = await chrome.crida("Page.captureScreenshot", { format: "png" });
      const png = Buffer.from(data as string, "base64");
      await writeFile(join(outDir, `${municipi.slug}.png`), png);
      bytes += png.byteLength;
      fetes += 1;
    }
  } finally {
    await chrome.tanca();
    await rm(treball, { recursive: true, force: true });
  }

  return { images: fetes, bytes };
}
