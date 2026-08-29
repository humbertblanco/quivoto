/**
 * Actes de ple dels portals municipals propis.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUIN PROBLEMA RESOL
 * ─────────────────────────────────────────────────────────────────────────────
 * De les 26 ciutats més poblades de Catalunya n'hi ha divuit que **no** tenen
 * actes aprofitables a l'acteca de l'AOC. Barcelona ja la resol `barcelona.ts`
 * amb el seu CSV de votacions. Aquest fitxer és per a les altres: cada una
 * publica el ple al seu propi web, cada una a la seva manera, i la pregunta que
 * ho decideix tot no és si publica res sinó si el que publica **porta el sentit
 * del vot**. Un extracte d'acords sense recompte no ens serveix de res.
 *
 * La mesura és del 29 d'agost del 2026 i està feta amb documents reals: per a
 * cada ciutat s'han obert dues o tres sessions i s'hi ha buscat el desglossament
 * del vot. El que hi ha aquí és el que s'ha vist, no el que hauria de ser-hi.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA TROBALLA QUE CANVIA LA IMATGE QUE EN TENÍEM: GIRONA
 * ─────────────────────────────────────────────────────────────────────────────
 * `docs/EXTRACCIO-ACTES.md` diu que Girona no publica actes, sinó «Acords
 * adoptats» sense cap ocurrència de «vots a favor» ni «unanimitat». Això és cert
 * **del que Girona puja a l'AOC**, i deixa de ser-ho al seu portal propi. Al
 * portal de transparència hi ha l'acta sencera i porta el vot **nominal**:
 *
 *   «Vots a favor: Grup Municipal GUANYEM GIRONA: senyors/es Lluc Salellas
 *    Vilar, Aminata Sabaly Balde, […] Vots en contra: Grup Municipal VOX:
 *    senyor Francisco Javier Domínguez García. Abstencions: Grup Municipal PP:
 *    senyor Jaume Veray Cama.»
 *      — Acta del Ple del 10/11/2025, punt de la Resolució 2025000330,
 *        `seu.girona.cat/cdn/dades/actes_plenaries/_descarrega/Acta-Ple-10-11-25.pdf`
 *
 * És a dir: la ciutat que teníem per impossible és de les millors que hi ha, i
 * a més amb atribució individual, que Barcelona no dona. La lliçó general és
 * que **«no és a l'AOC» no vol dir «no es publica»**.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÈ HI HA A CADA CIUTAT (mesurat, no suposat)
 * ─────────────────────────────────────────────────────────────────────────────
 * Les sis que porten vot per grup en PDF de text, amb índex llistable i sense
 * cap prohibició al `robots.txt`, són les que implementa aquest fitxer:
 *
 *   Girona      · acta sencera, vot **nominal** per grup · índex any per any
 *   Manresa     · acta sencera, vot per grup amb xifres · índex únic, 237 actes
 *   Cerdanyola  · acta sencera, vot per grup amb xifres · índex any per any
 *   Rubí        · acta sencera, vot per grup amb xifres · índex paginat
 *   Sant Cugat  · acta sencera, vot per grup amb xifres · índex d'una finestra curta
 *   Vilanova    · acta sencera, vot per grup · **només fins al 2016**
 *   Granollers  · acta sencera, vot per grup · **només fins al juny del 2019**
 *
 * I una que no dona vot per grup però sí el recompte de cada votació:
 *
 *   Gavà        · videoacta pròpia, HTML, «A favor: 11 · En contra: 7 ·
 *                 Abstenció: 3» punt per punt, **sense dir quin grup és quin**
 *
 * Les altres deu són a `PORTALS_DESCARTATS`, amb el motiu escrit. Val la pena
 * llegir-les: la meitat no és que no publiquin, és que publiquen el vídeo i
 * prou, i el vot només existeix mirant-lo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * UN AVÍS QUE NO S'HA DE PASSAR PER ALT
 * ─────────────────────────────────────────────────────────────────────────────
 * Tot el que diu «no es pot» en aquest fitxer és **sobre el portal propi de
 * l'ajuntament**, que és el que s'ha anat a mirar. No és una afirmació sobre
 * totes les vies possibles, i hi ha una prova a tocar: `__fixtures__/actes/`
 * conté retalls d'actes reals amb el vot desglossat de **Vic, Mollet, Cornellà,
 * el Prat i Santa Coloma**, cinc de les que aquí surten com a descartades:
 *
 *   «El Ple, amb 21 vots a favor [PSC i C'S], 6 vots en contra [ERC i PP] i 2
 *    abstencions [VOX] dels/de les 27 regidors assistents…»
 *      — `__fixtures__/actes/santa-coloma-claudators.txt`
 *
 * Aquells retalls van entrar per una altra porta —l'acteca o una baixada a
 * mà— i qui munti el job hauria de comprovar-ho abans de donar cap d'aquestes
 * cinc ciutats per perduda. El que aquest fitxer sap del cert és que **pel seu
 * portal municipal propi** no s'hi arriba.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LES REGLES QUE ENS IMPOSEM I QUE SÓN CODI
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. **`robots.txt` manda.** Els portals de videoacta d'eCityClic (Gavà, Vic,
 *    Mollet, Rubí, Sant Cugat, Manresa, Granollers, Tarragona, Cornellà, Sant
 *    Boi, Castelldefels, el Prat, Vilanova) porten tots el mateix fitxer:
 *
 *      User-agent: *
 *      Allow: /session/portadaPublica
 *      Allow: /session/sessionDetail
 *      Allow: /councilor/councilorsTab
 *      Allow: /councilor/councilorTabDetail
 *      Disallow:/
 *
 *    Vol dir que la llista i la fitxa de sessió es poden llegir i que
 *    `/session/downloadItem/…` —el PDF de l'acta— **no**. On el vot només és
 *    dins d'aquest PDF, per a nosaltres no existeix. Aquesta és la raó exacta
 *    per la qual Vic i Mollet queden fora, i no cap altra.
 * 2. **Una petició per segon i per host.** `pausaPerHost` ho fa sol; no hi ha
 *    cap camí per saltar-s'ho des de fora del mòdul.
 * 3. **No es construeixen URLs de document.** Sempre se segueix l'enllaç de
 *    l'índex. Girona ho demostra: les actes del 2023 viuen a `/portal/dades/…`
 *    i es diuen `ActaPle-22-12-23.pdf`, i les del 2024 endavant a `/cdn/dades/…`
 *    i es diuen `Acta-Ple-09-12-24.pdf`. Qui endevini el nom, falla un any de
 *    dos.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LLICÈNCIES: CADA AJUNTAMENT LA SEVA, I CAP NO ÉS CC BY
 * ─────────────────────────────────────────────────────────────────────────────
 * Cap dels set portals implementats no publica les actes amb una llicència
 * oberta estàndard. N'hi ha tres menes i la diferència importa:
 *
 *   · **Reutilització permesa citant la font** (el règim de la Llei 37/2007):
 *     Girona i Manresa ho diuen explícitament. Són les dues úniques on el que
 *     fem té una base escrita al mateix web.
 *   · **Avís legal mut**: Rubí només parla de protecció de dades. No autoritza
 *     ni prohibeix la reutilització.
 *   · **Avís legal restrictiu**: Sant Cugat, Cerdanyola i Vilanova reserven els
 *     drets de propietat intel·lectual sobre els continguts del web.
 *
 * El tercer cas no ens atura, però obliga a ser exactes en què en fem: les
 * actes de ple són **informació pública** i el que en publiquem és el fet
 * verificable (qui va votar què, amb la cita i l'enllaç al document original),
 * no una reproducció del document. Cada afirmació ha de portar l'enllaç a
 * l'acta al portal municipal, que és el que converteix això en una citació i no
 * en una còpia. On l'avís legal és restrictiu, **no** se'n pot fer un mirall ni
 * republicar el PDF.
 *
 * Cada portal duu la seva `llicencia` amb l'URL de l'avís legal. Si es fa servir
 * per publicar, s'ha de citar tal com diu.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL QUE AQUEST FITXER NO FA
 * ─────────────────────────────────────────────────────────────────────────────
 * No llegeix els PDF: d'això ja se n'ocupa `actes.ts`, i les actes d'aquests
 * portals són de la mateixa mena que les de l'acteca (PDF amb capa de text,
 * `pdftotext -layout`, marge de signatura inclòs). Aquí només hi ha les dues
 * peces que faltaven: **on és l'índex** i **com se'n baixa un document**.
 */

import { sleep } from "../lib/http";

// ─────────────────────────────────────────────────────────────────────────────
// Tipus
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Quatre menes, no dues. La diferència entre `acta` i `extracte_acords` és la
 * que decideix si el document serveix: l'extracte diu què es va acordar i
 * l'acta diu qui ho va votar. `desconegut` és honest i necessari: hi ha índexs
 * (Sant Cugat) on la columna sí que ho diu però l'enllaç no, i preferim dir-ho
 * que no pas endevinar-ho.
 */
export type MenaDocument = "acta" | "extracte_acords" | "ordre_del_dia" | "desconegut";

export type DocumentPle = {
  /** Slug del municipi, tal com el genera `slugifyMunicipality`. */
  slug: string;
  municipi: string;
  mena: MenaDocument;
  /** Data de la sessió en ISO `aaaa-mm-dd`, o `null` si l'índex no la diu clara. */
  data: string | null;
  /** El text de l'enllaç a l'índex, tal com el llegeix una persona. */
  titol: string;
  /** URL absoluta del document. Sempre surt de l'índex, mai es construeix. */
  url: string;
  /** Pàgina d'índex d'on surt, per poder citar-la i per detectar-hi canvis. */
  urlIndex: string;
};

export type Portal = {
  slug: string;
  municipi: string;
  /** La pàgina que obriria una persona. És la que s'ha de citar a la fitxa. */
  paginaHumana: string;
  /**
   * Les URL d'índex a recórrer. `any` filtra quan el portal té una pàgina per
   * any; els portals d'índex únic l'ignoren i sempre tornen la mateixa.
   */
  urlsIndex(opcions?: OpcionsIndex): string[];
  /** Pur: d'HTML a documents. Es prova amb retalls literals de l'índex real. */
  extreu(html: string, urlIndex: string): DocumentPle[];
  /** Què diu l'avís legal, amb l'URL. Vegeu el capçal. */
  llicencia: string;
  /** Què diu el `robots.txt` per al camí que fem servir. */
  robots: string;
  /** Fins on arriba, mesurat el 29/08/2026. */
  cobertura: string;
};

export type OpcionsIndex = {
  /** Anys a recórrer, del més nou al més vell. Per defecte, el mandat en curs. */
  anys?: readonly number[];
  /** Pàgines a recórrer, per als índexs paginats (Rubí, Granollers). */
  pagines?: number;
};

export class PortalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PortalError";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML: enllaços i text
// ─────────────────────────────────────────────────────────────────────────────

export type Enllac = {
  href: string;
  /** Text visible de l'enllaç, ja net d'etiquetes i d'entitats. */
  text: string;
  /** El `alt`/`title` de la imatge de dins, si n'hi ha. Granollers hi posa el títol. */
  alt: string;
};

const RE_ENLLAC = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;

/**
 * Les cometes s'han d'aparellar amb elles mateixes i no valdre'n una de sola.
 * Girona escriu els atributs amb cometes simples i Granollers hi escriu
 * apòstrofs a dins («alt="Acta de Ple extraordinari d'11 de juny de 2019"»).
 * Un `["']([^"']*)["']` talla aquest títol per l'apòstrof i el deixa en «…d», i
 * llavors l'acta es queda sense data sense que ho digui ningú.
 */
const RE_HREF = /href\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
const RE_ALT = /\b(?:alt|title)\s*=\s*(?:"([^"]*)"|'([^']*)')/i;

/**
 * Les cinc entitats que surten de debò en aquests índexs, més les numèriques.
 * No cal un analitzador d'HTML per a això i no en volem la dependència.
 */
function desEntitats(text: string): string {
  return text
    .replace(/&nbsp;?/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)));
}

export function textPla(html: string): string {
  return desEntitats(html.replace(/<[^>]*>/g, " "))
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tots els `<a>` de la pàgina, amb l'`href` ja resolt contra l'URL de l'índex. */
export function enllacos(html: string, base: string): Enllac[] {
  const trobats: Enllac[] = [];
  for (const m of html.matchAll(RE_ENLLAC)) {
    const atributs = m[1] ?? "";
    const cos = m[2] ?? "";
    const trobatHref = RE_HREF.exec(atributs);
    const href = trobatHref?.[1] ?? trobatHref?.[2];
    if (!href || href.trim() === "" || href.startsWith("#")) continue;
    let absolut: string;
    try {
      absolut = new URL(desEntitats(href.trim()), base).toString();
    } catch {
      continue;
    }
    trobats.push({
      href: absolut,
      text: textPla(cos),
      alt: (() => {
        const t = RE_ALT.exec(cos);
        return desEntitats(t?.[1] ?? t?.[2] ?? "").replace(/\s+/g, " ").trim();
      })(),
    });
  }
  return trobats;
}

/** El nom del fitxer, sense paràmetres i amb els `%20` desfets. */
export function nomFitxer(url: string): string {
  try {
    const cami = new URL(url).pathname;
    return decodeURIComponent(cami.slice(cami.lastIndexOf("/") + 1));
  } catch {
    return "";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dates
// ─────────────────────────────────────────────────────────────────────────────

function iso(any: number, mes: number, dia: number): string | null {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  return `${any}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** `30.04.2026`, `30/04/2026`, `30-4-2025`. */
export function dataDdMmAaaa(text: string): string | null {
  const m = /(\d{1,2})[./-](\d{1,2})[./-](\d{4})/.exec(text);
  if (!m) return null;
  return iso(Number(m[3]), Number(m[2]), Number(m[1]));
}

/**
 * `10-11-25` dels noms de fitxer de Girona. Dos dígits d'any: els resolem al
 * segle XXI, que és on són totes les actes que existeixen en línia.
 */
export function dataDdMmAa(text: string): string | null {
  const m = /(\d{2})-(\d{2})-(\d{2})(?!\d)/.exec(text);
  if (!m) return null;
  return iso(2000 + Number(m[3]), Number(m[2]), Number(m[1]));
}

/** `2026_05_21` i `20260227`. */
export function dataAaaaMmDd(text: string): string | null {
  const m = /(20\d{2})[_-]?(\d{2})[_-]?(\d{2})(?!\d)/.exec(text);
  if (!m) return null;
  return iso(Number(m[1]), Number(m[2]), Number(m[3]));
}

const MESOS: Record<string, number> = {
  gener: 1, febrer: 2, marc: 3, abril: 4, maig: 5, juny: 6,
  juliol: 7, agost: 8, setembre: 9, octubre: 10, novembre: 11, desembre: 12,
};

function senseAccents(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** «18 de gener de 2016», «11 de juny de 2019», «1 d'agost de 2020». */
export function dataCatalana(text: string): string | null {
  const pla = senseAccents(text);
  const m = /(\d{1,2})\s*d[e']?\s*([a-z]+)\s*(?:de\s*|del\s*|d')?(\d{4})/.exec(pla);
  if (!m) return null;
  const mes = MESOS[m[2]!];
  if (!mes) return null;
  return iso(Number(m[3]), mes, Number(m[1]));
}

/** Només el mes, per desambiguar Cerdanyola. */
export function mesCatala(text: string): number | null {
  const pla = senseAccents(text);
  for (const [nom, num] of Object.entries(MESOS)) {
    if (new RegExp(`\\b${nom}\\b`).test(pla)) return num;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Girona · www.girona.cat/transparencia
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Un `.php` per any: `acords_ple.php` és l'any en curs i `acords_ple2016.php`
 * fins a `acords_ple2025.php` són els tancats. Comprovat: 2025 → 16 actes,
 * 2024 → 23, 2023 → 22. L'any en curs (2026) el dia de la mesura només tenia
 * ordres del dia: les actes hi apareixen quan el ple següent les aprova, o
 * sigui amb un mes o dos de retard. No és un error de l'extractor.
 *
 * **La pàgina és ISO-8859-1 i no ho declara enlloc** —ni capçalera ni `meta`.
 * `descarregaHtml` ho detecta pel contingut; si algú la llegeix amb `fetch` i
 * `.text()`, els títols surten amb caràcters trencats.
 */
export const GIRONA: Portal = {
  slug: "girona",
  municipi: "Girona",
  paginaHumana: "https://www.girona.cat/transparencia/cat/acords_ple.php",
  urlsIndex(opcions = {}) {
    const anys = opcions.anys ?? [2026, 2025, 2024, 2023];
    return anys.map((any) =>
      any >= 2026
        ? "https://www.girona.cat/transparencia/cat/acords_ple.php"
        : `https://www.girona.cat/transparencia/cat/acords_ple${any}.php`,
    );
  },
  extreu(html, urlIndex) {
    const documents: DocumentPle[] = [];
    for (const e of enllacos(html, urlIndex)) {
      const nom = nomFitxer(e.href);
      if (!/\.pdf$/i.test(nom)) continue;
      // `Acta-Ple-…`, `ActaPle-…` (2023) i `Acta-Ple-Extraordinari-…`.
      const esActa = /^acta-?ple/i.test(nom);
      const esOrdre = /^ordre-dia/i.test(nom);
      if (!esActa && !esOrdre) continue;
      documents.push({
        slug: "girona",
        municipi: "Girona",
        mena: esActa ? "acta" : "ordre_del_dia",
        data: dataDdMmAa(nom) ?? dataDdMmAaaa(nom),
        titol: e.text || nom,
        url: e.href,
        urlIndex,
      });
    }
    return documents;
  },
  llicencia:
    "https://web.girona.cat/avislegal — l'Ajuntament de Girona hi declara la " +
    "reutilització de la informació pública citant-ne la font i la data " +
    "d'actualització. És, amb Manresa, l'únic dels set que ho diu per escrit.",
  robots:
    "www.girona.cat/robots.txt només prohibeix /ajuntament/junta_govern_local/, " +
    "/web/shared/admin/docs/ i /ccs/docs/. El camí /transparencia/ és permès. " +
    "seu.girona.cat, que serveix els PDF, no té robots.txt (404).",
  cobertura:
    "Actes des del 2016 com a mínim, any per any. 2025: 16 actes; 2024: 23; " +
    "2023: 22. L'any en curs va amb un mes o dos de retard perquè l'acta es " +
    "publica quan s'aprova.",
};

// ─────────────────────────────────────────────────────────────────────────────
// Manresa · web.manresa.cat
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Índex únic amb totes les actes des del 2018, en blocs `<li>` desplegables: el
 * títol és text solt dins d'un `div` i l'enllaç és un botó que només diu «PDF».
 * Per això no serveix llegir el text de l'enllaç i cal el bloc sencer.
 *
 * El nom del fitxer porta la data en `aaaa_mm_dd` i és més fiable que el títol,
 * però el títol la duu escrita («Acta de la sessió plenària núm. 1, de 26 de
 * gener de 2023») i serveix de xarxa quan el nom del fitxer és dels antics
 * (`7-1-81.pdf`).
 *
 * I és un índex molt més llarg del que sembla: **874 documents, 237 actes de
 * ple, i arriba fins al 1981**. Els d'aquella època escriuen el títol d'una
 * tercera manera —«Ple ordinari gener (07-01-1981)»— i per això la data es
 * busca de tres maneres.
 */
const RE_BLOC_LI = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;

export const MANRESA: Portal = {
  slug: "manresa",
  municipi: "Manresa",
  paginaHumana: "https://web.manresa.cat/web/menu/4444-plens-actes",
  urlsIndex() {
    return ["https://web.manresa.cat/web/menu/4444-plens-actes"];
  },
  extreu(html, urlIndex) {
    const documents: DocumentPle[] = [];
    for (const bloc of html.matchAll(RE_BLOC_LI)) {
      const cos = bloc[1] ?? "";
      const [enllac] = enllacos(cos, urlIndex).filter((e) => /\.pdf(\?|$)/i.test(e.href));
      if (!enllac) continue;
      // El títol és tot el text del bloc menys el «PDF» del botó i menys el
      // nom de la icona, que Material Icons escriu com a text de dins d'un
      // `<i>` («description») i que si no es treu queda enganxat al títol.
      const titol = textPla(cos.replace(RE_ENLLAC, " ").replace(/<i\b[^>]*>[\s\S]*?<\/i>/gi, " ")).trim();
      if (!/ple|plen/i.test(titol)) continue;
      const nom = nomFitxer(enllac.href);
      documents.push({
        slug: "manresa",
        municipi: "Manresa",
        mena: /acta/i.test(titol) ? "acta" : "desconegut",
        // Quatre formes, i calen totes quatre: el nom modern porta `aaaa_mm_dd`;
        // el títol modern escriu la data en català; l'arxiu dels vuitanta la
        // posa entre parèntesis al títol (`Ple ordinari gener (07-01-1981)`)
        // amb un nom que no en diu res (`7-1-81.pdf`); i el dels noranta la duu
        // només al nom (`30-12-93.pdf`) amb un títol que només diu el mes.
        // Amb la primera sola, 621 dels 874 documents d'aquest índex es
        // quedarien sense data; amb totes quatre en queden 45, tots dels anys
        // noranta i amb noms com `94-(15)_novembre-15_web.pdf`.
        data:
          dataAaaaMmDd(nom) ?? dataCatalana(titol) ?? dataDdMmAaaa(titol) ?? dataDdMmAa(nom),
        titol,
        url: enllac.href,
        urlIndex,
      });
    }
    return documents;
  },
  llicencia:
    "https://www.manresa.cat/seuelectronica/menu/14668-llicencia-termes-i-condicions-d-us-de-la-informacio " +
    "— condicions explícites de reutilització de la informació pública.",
  robots:
    "web.manresa.cat i www.manresa.cat només bloquegen camins d'oposicions; " +
    "/web/menu/ i /media/docs/ són permesos. Compte: videoactes.manresa.cat " +
    "prohibeix /session/downloadItem/, però no cal perquè el PDF és al web.",
  cobertura:
    "874 documents en un sol índex sense paginació, 237 dels quals són actes " +
    "de ple, del 1981 al juny del 2026. És l'arxiu més llarg dels set.",
};

// ─────────────────────────────────────────────────────────────────────────────
// Cerdanyola del Vallès · www.cerdanyola.cat
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Una pàgina per any (`/actes-del-ple-2025`) amb enllaços directes al PDF dins
 * de `/sites/default/files/fitxers/`. El títol de l'enllaç només diu el mes
 * («Acta de la sessió plenària Gener 2025») i el nom del fitxer porta la data
 * enganxada sense separadors i **sense zeros al davant**:
 *
 *   …actasessiordinriaplemunicipal3012025.pdf  → 30/01/2025
 *   …actasessiordinriaplemunicipal2662025.pdf  → 26/06/2025
 *
 * Set dígits que tant poden ser `d·mm·aaaa` com `dd·m·aaaa`. Mirar només el mes
 * del títol no basta: a «3012025» les dues lectures (3/01 i 30/1) donen gener.
 * El que les desfà és la convenció del propi generador de noms, que s'ha llegit
 * a tot un any de fitxers: **ni el dia ni el mes porten zero al davant**. Per
 * això `3012025` és 30/1 i no 3/01, i `1042025` és 10/4 i no 1/04. El mes del
 * títol es reserva per a comprovar-ho.
 *
 * Si tot i això queda empat, la data es queda a `null` i ja la dirà l'acta: el
 * que no farem és inventar-nos-la.
 */
export function dataCerdanyola(titol: string, nom: string): string | null {
  // Primer, la forma fàcil: uns quants fitxers porten la data amb separadors.
  const ambSeparadors = dataDdMmAaaa(nom.replace(/_/g, "-"));
  if (ambSeparadors) return ambSeparadors;

  // Fora l'extensió i fora el `_0` que hi afegeix el gestor quan un fitxer es
  // repeteix: si no, la cua de dígits que busquem és aquell zero.
  const arrel = nom.replace(/\.[a-z0-9]+$/i, "").replace(/_\d+$/, "");
  const m = /(\d{5,8})(?=[^\d]*$)/.exec(arrel);
  if (!m) return null;
  const digits = m[1]!;
  const any = Number(digits.slice(-4));
  const cap = digits.slice(0, -4);
  if (cap.length < 2 || cap.length > 4) return null;

  const mesTitol = mesCatala(titol);
  const candidats: Array<{ dia: number; mes: number }> = [];
  for (let tall = 1; tall <= 2 && tall < cap.length; tall += 1) {
    const dia = cap.slice(0, tall);
    const mes = cap.slice(tall);
    // La font escriu dia i mes **sense zero al davant** («2662025» és 26/6).
    // Aquesta és la regla que desfà l'empat de «3012025», que tant podria ser
    // 3/01 com 30/1: només la segona lectura respecta la convenció.
    if (dia.startsWith("0") || mes.startsWith("0")) continue;
    candidats.push({ dia: Number(dia), mes: Number(mes) });
  }
  const bons = candidats.filter(
    (c) =>
      c.dia >= 1 && c.dia <= 31 && c.mes >= 1 && c.mes <= 12 &&
      // El mes escrit al títol («… Gener 2025») és la comprovació final.
      (mesTitol === null || c.mes === mesTitol),
  );
  // Si continua havent-hi empat, la data no es dedueix: ja la dirà l'acta.
  if (bons.length !== 1) return null;
  return iso(any, bons[0]!.mes, bons[0]!.dia);
}

export const CERDANYOLA: Portal = {
  slug: "cerdanyola-del-valles",
  municipi: "Cerdanyola del Vallès",
  paginaHumana: "https://www.cerdanyola.cat/actes-del-ple-2025",
  urlsIndex(opcions = {}) {
    const anys = opcions.anys ?? [2026, 2025, 2024, 2023];
    return anys.map((any) => `https://www.cerdanyola.cat/actes-del-ple-${any}`);
  },
  extreu(html, urlIndex) {
    const documents: DocumentPle[] = [];
    for (const e of enllacos(html, urlIndex)) {
      if (!/\.pdf(\?|$)/i.test(e.href)) continue;
      if (!/acta/i.test(e.text)) continue;
      const nom = nomFitxer(e.href);
      documents.push({
        slug: "cerdanyola-del-valles",
        municipi: "Cerdanyola del Vallès",
        mena: "acta",
        data: dataCerdanyola(e.text, nom),
        titol: e.text,
        url: e.href,
        urlIndex,
      });
    }
    return documents;
  },
  llicencia:
    "https://www.cerdanyola.cat/avis-legal — avís restrictiu de propietat " +
    "intel·lectual, sense clàusula de reutilització. Es pot citar i enllaçar; " +
    "no se'n pot fer un mirall.",
  robots:
    "www.cerdanyola.cat/robots.txt és el de Drupal amb Crawl-delay: 10 i no " +
    "prohibeix ni /sites/default/files/ ni /actes-del-ple-*. El Crawl-delay " +
    "mana sobre la pausa d'un segon: vegeu `PAUSA_MS_PER_HOST`.",
  cobertura: "Una pàgina per any; el 2025 en porta catorze entre ordinàries i extraordinàries.",
};

// ─────────────────────────────────────────────────────────────────────────────
// Rubí · seu.rubi.cat
// ─────────────────────────────────────────────────────────────────────────────

/**
 * La seu electrònica pròpia, que no és seu-e.cat. Tres categories i cadascuna
 * és una llista paginada de deu en deu:
 *
 *   3  Ple municipal · Ordres del dia
 *   4  Ple municipal · Actes            ← la que volem
 *   25 Ple municipal · Històric d'actes
 *
 * La primera pàgina té un camí i les següents un altre, que és el que serveix
 * el paginador. El text de l'enllaç porta la data i la mida: «4_Acta Ple
 * 30.04.2026(Pdf, 294.22 Kb)».
 */
const RUBI_ARREL = "https://seu.rubi.cat";
const RUBI_CATEGORIA_ACTES = 4;

export function urlIndexRubi(pagina: number, categoria = RUBI_CATEGORIA_ACTES): string {
  if (pagina <= 1) return `${RUBI_ARREL}/actesIacordsCategoriaPublic/cercadorCategoria/${categoria}`;
  const offset = (pagina - 1) * 10;
  return (
    `${RUBI_ARREL}/actesIacordsCategoriaPublic/listPublicacionsAmbCategoria` +
    `?categoria.id=${categoria}&offset=${offset}&max=10`
  );
}

export const RUBI: Portal = {
  slug: "rubi",
  municipi: "Rubí",
  paginaHumana: `${RUBI_ARREL}/actesIacordsCategoriaPublic/cercadorCategoria/4`,
  urlsIndex(opcions = {}) {
    const pagines = opcions.pagines ?? 4;
    return Array.from({ length: pagines }, (_, i) => urlIndexRubi(i + 1));
  },
  extreu(html, urlIndex) {
    const documents: DocumentPle[] = [];
    for (const e of enllacos(html, urlIndex)) {
      if (!/\/documentPublic\/download\/\d+/.test(e.href)) continue;
      const titol = e.text;
      if (!/acta/i.test(titol)) continue;
      documents.push({
        slug: "rubi",
        municipi: "Rubí",
        mena: "acta",
        data: dataDdMmAaaa(titol),
        titol,
        url: e.href,
        urlIndex,
      });
    }
    return documents;
  },
  llicencia:
    `${RUBI_ARREL}/public/mostrar/avisLegal — l'avís legal només parla de ` +
    "protecció de dades: no autoritza ni prohibeix la reutilització.",
  robots:
    "seu.rubi.cat no té robots.txt (404). Compte amb els altres dos hosts de " +
    "Rubí: videoacta.rubi.cat és Disallow: / sencer i www.rubi.cat prohibeix " +
    "/fitxers/, que és on hi ha l'altre mirall d'actes. Cap dels dos no es toca.",
  cobertura:
    "Unes 189 publicacions a la categoria d'actes, de deu en deu; les quatre " +
    "primeres pàgines cobreixen el mandat en curs.",
};

// ─────────────────────────────────────────────────────────────────────────────
// Sant Cugat del Vallès · santcugat.cat
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Una sola pàgina, amb una taula per sessió i els documents penjats de
 * `/files/<id>-<id>-fitxer/<nom>.pdf`. El text de l'enllaç porta la data en
 * català («Sessió ordinària 24 de juliol de 2026») però **no** diu quina mena
 * de document és: això només és a la columna, que es perd quan es llegeixen
 * els enllaços. Ho decidim pel nom del fitxer, que sí que és regular:
 *
 *   Ple_Acta_20260227_Ordinari.pdf        → acta
 *   Ple_OrdreDia_20260327_Ordinari.pdf    → ordre del dia
 *   Ple_ExtracteAcords_20180618.pdf       → extracte
 *   07 PLE_24 07 2026.pdf                 → **desconegut**, i ho diem
 *
 * L'última forma és la que fa servir el que hi ha publicat més recentment i no
 * declara res. Marcar-la `desconegut` no és rendir-se: és el que permet que qui
 * consumeixi això decideixi si l'obre o l'ignora, en comptes de trobar-se un
 * ordre del dia etiquetat d'acta.
 *
 * Avís de cobertura, i és el defecte gros d'aquest portal: la pàgina només
 * ensenya una finestra curta. El dia de la mesura hi havia quatre actes del
 * 2026 i un bloc encallat del 2018, i res entremig.
 */
export const SANT_CUGAT: Portal = {
  slug: "sant-cugat-del-valles",
  municipi: "Sant Cugat del Vallès",
  paginaHumana: "https://santcugat.cat/web/el-ple",
  urlsIndex() {
    return ["https://santcugat.cat/web/el-ple"];
  },
  extreu(html, urlIndex) {
    const documents: DocumentPle[] = [];
    for (const e of enllacos(html, urlIndex)) {
      if (!/\.pdf(\?|$)/i.test(e.href)) continue;
      const nom = nomFitxer(e.href);
      if (!/ple/i.test(nom)) continue;
      const mena: MenaDocument = /ple_acta/i.test(nom)
        ? "acta"
        : /ordredia/i.test(nom)
          ? "ordre_del_dia"
          : /extracteacords/i.test(nom)
            ? "extracte_acords"
            : "desconegut";
      documents.push({
        slug: "sant-cugat-del-valles",
        municipi: "Sant Cugat del Vallès",
        mena,
        data: dataAaaaMmDd(nom) ?? dataCatalana(e.text) ?? dataDdMmAaaa(nom.replace(/ /g, "-")),
        titol: e.text || nom,
        url: e.href,
        urlIndex,
      });
    }
    return documents;
  },
  llicencia:
    "https://santcugat.cat/avis-legal — reserva de drets de propietat " +
    "intel·lectual, sense llicència oberta. Citar i enllaçar, no reproduir.",
  robots:
    "santcugat.cat/robots.txt només prohibeix /ajax/ i /handlers/; /web/el-ple " +
    "i /files/ són permesos. Que /ajax/ estigui prohibit importa: si algun dia " +
    "el llistat d'anys antics es carrega per AJAX, aquell camí queda fora.",
  cobertura:
    "Finestra curta: el 29/08/2026 la pàgina donava quatre actes del 2026 " +
    "(30/01, 27/02 i dues extraordinàries del març) i vuit extractes del 2018. " +
    "Per al mandat sencer no n'hi ha prou amb aquest índex.",
};

// ─────────────────────────────────────────────────────────────────────────────
// Vilanova i la Geltrú · www.vilanova.cat
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Arxiu històric d'actes en PDF, amb el text de l'enllaç dient la sessió i la
 * data («Sessió ordinària de 18 de gener de 2016») i el document a
 * `/doc/doc_<id>.pdf`. Porta el vot per grup amb xifres:
 *
 *   «Vots a favor: CIU (8), PP (3) i CUP (2) = 13 vots.
 *    Abstencions: PSC (7) i ICV (2) = 9 vots.»
 *      — Acta del Ple extraordinari del 20/05/2013
 *
 * **S'atura el 2016.** Des del 2017 el ple va a videoactes.vilanova.cat, que
 * no publica cap text de votació: només l'índex de punts amb marques de temps
 * del vídeo. Per al mandat 2023-2027, doncs, Vilanova no dona res; això és
 * matèria primera per a sèries llargues i prou.
 */
export const VILANOVA: Portal = {
  slug: "vilanova-i-la-geltru",
  municipi: "Vilanova i la Geltrú",
  paginaHumana: "https://www.vilanova.cat/ajuntament/actes_del_ple",
  urlsIndex() {
    return ["https://www.vilanova.cat/ajuntament/actes_del_ple"];
  },
  extreu(html, urlIndex) {
    const documents: DocumentPle[] = [];
    for (const e of enllacos(html, urlIndex)) {
      if (!/\/doc\/doc_\d+\.pdf/i.test(e.href)) continue;
      if (!/sessi/i.test(e.text)) continue;
      documents.push({
        slug: "vilanova-i-la-geltru",
        municipi: "Vilanova i la Geltrú",
        mena: "acta",
        data: dataCatalana(e.text),
        titol: e.text,
        url: e.href,
        urlIndex,
      });
    }
    return documents;
  },
  llicencia:
    "https://www.vilanova.cat/avis_legal — prohibeix expressament la " +
    "reproducció i la distribució sense autorització. El més restrictiu dels " +
    "set: citar i enllaçar, mai republicar.",
  robots: "www.vilanova.cat no serveix robots.txt (l'IIS torna la portada). Sense restriccions declarades.",
  cobertura:
    "Del 2009 al 2016 i prou. Des del 2017 el ple només és a la videoacta, " +
    "que no publica cap text de votació.",
};

// ─────────────────────────────────────────────────────────────────────────────
// Granollers · seuelectronica.granollers.cat
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Arxiu d'una seu electrònica antiga en JSP. El títol de la sessió no és al
 * text de l'enllaç sinó a l'`alt` de la imatge de dins («Acta de Ple
 * extraordinari d'11 de juny de 2019»), i els documents pengen de
 * `RecursosWeb/DOCUMENTOS/1/0_<id>_1.pdf`. Es pagina amb `numeroPagina=N`.
 *
 * Porta el vot per grup:
 *
 *   «S'aprova per majoria absoluta, amb els 16 vots favorables dels Grups
 *    Municipals del PSC-CP, de C'S i del PP; les 7 abstencions dels Grups
 *    Municipals del PdeCAT-Demòcrates i d'ERC-AG-AM i el vot en contra del grup
 *    municipal de la CpG»
 *      — Acta del Ple del 30/04/2019
 *
 * **S'atura el juny del 2019.** Des de llavors el ple va a
 * videoactes.granollers.cat, i allà l'acta signada penja de
 * `/session/downloadItem/…`, que el `robots.txt` prohibeix. Granollers, per
 * tant, és com Vilanova: serveix per a la sèrie llarga i no per al mandat en
 * curs. La diferència és que aquí el document existeix i som nosaltres qui ens
 * aturem, per respectar el `robots.txt`.
 */
const GRANOLLERS_INDEX =
  "https://seuelectronica.granollers.cat/portal/sede/se_contenedor1.jsp" +
  "?seccion=s_ldoc_d11_v1.jsp&codbusqueda=49&language=ca&codResi=1&codMenuPN=20&codMenu=70";

export const GRANOLLERS: Portal = {
  slug: "granollers",
  municipi: "Granollers",
  paginaHumana: GRANOLLERS_INDEX,
  urlsIndex(opcions = {}) {
    const pagines = opcions.pagines ?? 12;
    return Array.from({ length: pagines }, (_, i) =>
      i === 0 ? GRANOLLERS_INDEX : `${GRANOLLERS_INDEX}&numeroPagina=${i + 1}`,
    );
  },
  extreu(html, urlIndex) {
    const documents: DocumentPle[] = [];
    for (const e of enllacos(html, urlIndex)) {
      if (!/RecursosWeb\/DOCUMENTOS\/.*\.pdf$/i.test(e.href)) continue;
      const titol = e.alt || e.text;
      if (!/ple/i.test(titol)) continue;
      documents.push({
        slug: "granollers",
        municipi: "Granollers",
        mena: /acta/i.test(titol) ? "acta" : /convocat|ordre/i.test(titol) ? "ordre_del_dia" : "desconegut",
        data: dataCatalana(titol),
        titol,
        url: e.href,
        urlIndex,
      });
    }
    return documents;
  },
  llicencia:
    "https://www.granollers.cat/avis-legal — autoritza la reproducció excepte " +
    "amb finalitats comercials i sempre que se citi la font; no permet obres " +
    "derivades sense autorització.",
  robots:
    "seuelectronica.granollers.cat no té robots.txt (404). En canvi " +
    "videoactes.granollers.cat prohibeix /session/downloadItem/ i " +
    "/video/playvideo/: el canal modern queda fora, i per això aquest portal " +
    "només arriba al 2019.",
  cobertura: "Fins al juny del 2019, dotze pàgines de deu documents.",
};

// ─────────────────────────────────────────────────────────────────────────────
// Gavà · videoacta.gava.cat — l'única videoacta que publica el recompte
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tretze ajuntaments d'aquesta llista fan servir el mateix producte de
 * videoacta i **només Gavà** el té configurat perquè publiqui el resultat de
 * cada votació dins de l'HTML de la sessió, que és un camí que el `robots.txt`
 * permet. A Vic, Mollet, Castelldefels, el Prat, Tarragona, Cornellà i Sant Boi
 * s'ha comprovat el mateix HTML i no hi ha ni un «A favor».
 *
 * El que dona és el recompte, no el grup:
 *
 *   «8.-Aprovació definitiva de la modificació de l'estudi de viabilitat […]
 *    Resultat de la votació: A favor · Votació pública ·
 *    A favor: 11 · En contra: 7 · Abstenció: 3»
 *      — Ple ordinari del 18/06/2026
 *
 * Amb 21 regidories, un 11-7-3 diu que la votació va ser dividida i quant, però
 * no qui. `posicions.ts` en podrà treure alguna cosa per aritmètica d'escons
 * quan el repartiment no admeti cap altra combinació, i no ha de dir res quan
 * n'admeti més d'una. **No és el mateix que un vot per grup i no s'ha de
 * barrejar amb els que ho són.**
 */
export type PuntVotat = {
  /** Número i títol del punt, tal com surten a la fitxa de la sessió. */
  titol: string;
  favor: number;
  contra: number;
  abstencio: number;
  /** «Votació pública», «Votació nominal»… tal com ho diu la fitxa. */
  sistema: string | null;
};

export const GAVA_PORTADA = "https://videoacta.gava.cat/session/portadaPublica";

/** Fitxa d'una sessió. L'identificador surt de la portada. */
export function urlSessioGava(id: string): string {
  if (!/^[0-9a-f]{20,}$/i.test(id)) throw new PortalError(`identificador de sessió estrany: ${id}`);
  return `https://videoacta.gava.cat/session/sessionDetail/${id}`;
}

/** Identificadors de sessió de la portada, en l'ordre en què hi surten. */
export function sessionsVideoacta(html: string): string[] {
  const ids = new Set<string>();
  for (const m of html.matchAll(/sessionDetail\/([0-9a-f]{20,})/gi)) ids.add(m[1]!);
  return [...ids];
}

/**
 * El recompte de cada punt. El gràfic de sectors de la pàgina duu la sèrie
 * `data-series="[19, 2, 0]"` en l'ordre favor, contra, abstenció, i és més
 * segur de llegir que el text, que canvia de forma segons l'idioma. El text
 * serveix per comprovar que no hem llegit el gràfic d'un altre punt: si les
 * dues lectures no coincideixen, aturem, perquè aparellar malament un vot amb
 * un punt és pitjor que no publicar-lo.
 */
export function votacionsGava(html: string): PuntVotat[] {
  const punts: PuntVotat[] = [];
  const series = [...html.matchAll(/data-series\s*=\s*["']\[\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\]["']/gi)];
  const textos = [...html.matchAll(
    /A\s*favor:\s*(\d+)[\s\S]{0,200}?En\s*contra:\s*(\d+)[\s\S]{0,200}?Abstenci[óo]:\s*(\d+)/gi,
  )];
  if (series.length !== textos.length) {
    throw new PortalError(
      `Gavà: ${series.length} gràfics i ${textos.length} recomptes de text a la mateixa fitxa; ` +
        "la pàgina ha canviat i no es pot aparellar el vot amb el punt",
    );
  }
  for (let i = 0; i < series.length; i += 1) {
    const g = series[i]!;
    const t = textos[i]!;
    if (g[1] !== t[1] || g[2] !== t[2] || g[3] !== t[3]) {
      throw new PortalError(`Gavà: el gràfic i el text del punt ${i + 1} no diuen el mateix`);
    }
    // El títol és l'últim que hi ha escrit abans del recompte.
    const abans = html.slice(0, t.index);
    const titols = [...abans.matchAll(/>\s*([^<>]{12,300}?\.-)\s*</g)];
    const sistema = /Votaci[óo]\s+(p[úu]blica|nominal|secreta)/i.exec(abans.slice(-600));
    punts.push({
      titol: titols.length > 0 ? textPla(titols[titols.length - 1]![1]!) : "",
      favor: Number(g[1]),
      contra: Number(g[2]),
      abstencio: Number(g[3]),
      sistema: sistema ? textPla(sistema[0]) : null,
    });
  }
  return punts;
}

/** Aquest no és un `Portal`: no dona documents, dona recomptes. */
export const GAVA = {
  slug: "gava",
  municipi: "Gavà",
  paginaHumana: GAVA_PORTADA,
  llicencia:
    "https://www.gavaciutat.cat/avis-legal — avís legal general, sense " +
    "llicència oberta declarada.",
  robots:
    "videoacta.gava.cat/robots.txt: Disallow:/ amb Allow explícit per a " +
    "/session/portadaPublica, /session/sessionDetail i les dues de regidors. " +
    "Fem servir només les dues primeres. Tota la resta del portal és vedada, " +
    "inclòs /session/fragmentCustom.",
  cobertura:
    "Recompte per punt de totes les sessions publicades; sense atribució de " +
    "grup. Comprovat al Ple ordinari del 18/06/2026: nou punts votats, amb " +
    "resultats de 21-0-0 a 6-12-3.",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// El registre
// ─────────────────────────────────────────────────────────────────────────────

export const PORTALS: Record<string, Portal> = {
  [GIRONA.slug]: GIRONA,
  [MANRESA.slug]: MANRESA,
  [CERDANYOLA.slug]: CERDANYOLA,
  [RUBI.slug]: RUBI,
  [SANT_CUGAT.slug]: SANT_CUGAT,
  [VILANOVA.slug]: VILANOVA,
  [GRANOLLERS.slug]: GRANOLLERS,
};

/**
 * Les que no es poden fer, amb el motiu exacte. És documentació de projecte i
 * és tan útil com el registre de dalt: evita que d'aquí a sis mesos algú torni
 * a gastar-hi un dia. Cada motiu ve d'haver-hi obert una sessió real el
 * 29/08/2026.
 */
export const PORTALS_DESCARTATS: Record<string, string> = {
  tarragona:
    "No hi ha cap índex obert. La seu (seu.tarragona.cat) demana identificació " +
    "amb NIF; seu2.tarragona.cat prohibeix /documentPublic/ al robots.txt; la " +
    "videoacta (actes.tarragona.cat) llista les sessions però les del Ple " +
    "surten «sense documents publicats» i la fitxa no porta cap recompte; i " +
    "el que puja a l'AOC són PDF escanejats sense capa de text. És la ciutat " +
    "gran més tancada de les divuit.",
  "santa-coloma-de-gramenet":
    "No té cap font pròpia: gramenet.cat només publica el calendari de sessions " +
    "i no hi ha cap host de videoacta (actes., videoactes., seu. i " +
    "seuelectronica.gramenet.cat no resolen). Tot el que hi ha és a seu-e.cat, " +
    "carregat per AJAX contra el recurs CKAN agn-ag-actes-de-ple, que el " +
    "robots.txt de seu-e.cat prohibeix expressament.",
  "sant-boi-de-llobregat":
    "L'índex d'actes de la seu (Domino/Notes, Publi121.nsf) sí que és " +
    "llistable i arriba fins al 2025, però l'adjunt està trencat: l'enllaç " +
    "…/$FILE/1 Sessió del dia 30.01.2025 _SPL250001_.pdf torna 404 tant amb un " +
    "client HTTP com des d'un navegador de debò. No és un problema nostre de " +
    "capçaleres: el fitxer no s'hi serveix. La vista «Acords de Ple» " +
    "(Publi146.nsf) directament no porta cap adjunt.",
  viladecans:
    "Doble tancament. www.viladecans.cat és darrere d'un repte de Cloudflare " +
    "que cap client HTTP no passa; i quan s'obre amb navegador resulta que la " +
    "pàgina del Ple no publica actes, només la composició i una «crònica». " +
    "L'alternativa és seu-e.cat, on les dades reals venen del recurs CKAN que " +
    "el robots.txt prohibeix.",
  castelldefels:
    "actes.castelldefels.org publica la videoacta, però els únics documents " +
    "adjunts són previs a la sessió (convocatòria i ordre del dia) i la fitxa " +
    "no porta cap recompte de votació. El vot només existeix mirant el vídeo.",
  "el-prat-de-llobregat":
    "Igual que Castelldefels: actes.elprat.cat només dona ordre del dia i " +
    "vídeo. Val la pena deixar constància que l'avís legal del Prat és el més " +
    "favorable dels divuit —permet la reutilització citant-ne la font— i que " +
    "el que hi falta són les dades, no el permís.",
  "mollet-del-valles":
    "actes.molletvalles.cat llista les sessions i el títol de l'adjunt diu " +
    "«Acta Ple_Exp…», o sigui que l'acta existeix, però penja de " +
    "/session/downloadItem/, que el robots.txt no permet. La fitxa HTML no " +
    "porta cap recompte. Ens aturem nosaltres, i és la decisió correcta.",
  vic:
    "Exactament el mateix cas que Mollet a actes.vic.cat. A més, " +
    "seuelectronica.vic.cat prohibeix pràcticament tot el lloc.",
  figueres:
    "figueres.cat només publica les convocatòries (ordres del dia en PDF, amb " +
    "text però sense cap votació, perquè són prèvies a la sessió). Les actes " +
    "van a seu-e.cat. I videoacta.figueres.cat, que existeix i respon, té " +
    "Disallow: / sencer.",
  terrassa:
    "Cas a part, i el més frustrant: el material és excel·lent i el bloqueig " +
    "és tècnic. seuelectronica.terrassa.cat publica, any per any des del 2012, " +
    "la convocatòria, l'extracte d'acords i **l'acta** de cada sessió (per " +
    "exemple /documents/16/11893272/05_Acta_PLE_290526.pdf), i a més un " +
    "document de seguiment de totes les propostes de resolució del mandat que " +
    "el mateix portal descriu com a portador del «sentit de les votacions». " +
    "Però tot el domini —i també www.terrassa.cat, terrassa.cat i " +
    "opendata.terrassa.cat— respon 403 amb «cf-mitigated: challenge» a " +
    "qualsevol client HTTP, fins i tot per al robots.txt, i " +
    "videoacta.terrassa.cat té Disallow: /. Amb un navegador s'hi entra sol. " +
    "Resoldre-ho passa per una persona que baixi els fitxers o per demanar-los " +
    "a l'Ajuntament, no per burlar el repte.",
  "cornella-de-llobregat":
    "A mig camí. L'arxiu propi (arxiu.cornella.cat) serveix actes amb el vot " +
    "nominal complet i sense restriccions de robots.txt, però no s'hi ha " +
    "trobat cap índex sistemàtic: els PDF s'arriben a trobar des de pàgines " +
    "soltes. La videoacta (actes.cornella.cat) llista les sessions del Ple i " +
    "no porta cap recompte. Cal trobar l'índex de l'arxiu abans d'escriure'n " +
    "l'extractor; el que hi ha darrere val la pena.",
};

// ─────────────────────────────────────────────────────────────────────────────
// Descàrrega
// ─────────────────────────────────────────────────────────────────────────────

const USER_AGENT = "quivoto/0.1 (brúixola electoral municipal; hola@quivoto.cat)";

/**
 * Una petició per segon i per host, com a mínim. Cerdanyola demana deu segons
 * al seu `robots.txt` i els hi donem: el `Crawl-delay` és una petició explícita
 * del titular del web i no una recomanació que ens puguem passar per alt.
 */
export const PAUSA_MS_PER_HOST: Record<string, number> = {
  "www.cerdanyola.cat": 10_000,
  "www.granollers.cat": 10_000,
};

const PAUSA_MS = 1_100;
const ultimaPeticio = new Map<string, number>();

async function pausaPerHost(url: string): Promise<void> {
  const host = new URL(url).host;
  const minim = PAUSA_MS_PER_HOST[host] ?? PAUSA_MS;
  const ultima = ultimaPeticio.get(host);
  const ara = Date.now();
  if (ultima !== undefined) {
    const espera = ultima + minim - ara;
    if (espera > 0) await sleep(espera);
  }
  ultimaPeticio.set(host, Date.now());
}

export class HttpPortalError extends Error {
  constructor(readonly status: number, readonly url: string) {
    super(`HTTP ${status} a ${url}`);
    this.name = "HttpPortalError";
  }
}

async function demana(url: string, accept: string, reintents: number): Promise<Response> {
  let ultim: unknown;
  for (let intent = 0; intent <= reintents; intent += 1) {
    await pausaPerHost(url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    try {
      const resposta = await fetch(url, {
        headers: { accept, "user-agent": USER_AGENT },
        signal: controller.signal,
        redirect: "follow",
      });
      if (!resposta.ok) throw new HttpPortalError(resposta.status, url);
      return resposta;
    } catch (error) {
      ultim = error;
      // Un 4xx no millorarà repetint-lo; un 403 encara menys, que vol dir que
      // el portal no ens vol i que la resposta correcta és parar.
      if (error instanceof HttpPortalError && error.status < 500 && error.status !== 429) throw error;
      if (intent === reintents) break;
      await sleep(1_000 * 2 ** intent);
    } finally {
      clearTimeout(timer);
    }
  }
  throw ultim;
}

/**
 * Els índexs no van tots en UTF-8 i n'hi ha un que no ho declara enlloc:
 * `www.girona.cat` serveix `Content-Type: text/html` a seques i el cos és
 * ISO-8859-1. Si es llegeix com a UTF-8, «Sessions Plenàries» es converteix en
 * un títol trencat i les dates en català deixen d'aparellar.
 *
 * L'ordre és: el que digui la capçalera, si no el que digui el `meta` del
 * document, i si no res, prova d'UTF-8 estricte i cau a `windows-1252`, que és
 * el que fan els navegadors.
 */
export function decodeixHtml(bytes: Uint8Array, contentType: string | null): string {
  const declarat = /charset\s*=\s*["']?([\w-]+)/i.exec(contentType ?? "")?.[1];
  if (declarat) return new TextDecoder(declarat.toLowerCase()).decode(bytes);

  // El `meta` és dins del document: n'hi ha prou de mirar el començament.
  const cap = new TextDecoder("windows-1252").decode(bytes.subarray(0, 2048));
  const meta = /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(cap)?.[1];
  if (meta) return new TextDecoder(meta.toLowerCase()).decode(bytes);

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

export async function descarregaHtml(url: string, reintents = 3): Promise<string> {
  const resposta = await demana(url, "text/html,application/xhtml+xml", reintents);
  const bytes = new Uint8Array(await resposta.arrayBuffer());
  return decodeixHtml(bytes, resposta.headers.get("content-type"));
}

/**
 * Un document tal com el serveix el portal. Es torna en cru a posta: qui el
 * llegeixi (`actes.ts`) ja sap que la font serveix `.doc` i `.docx` amb URL
 * acabada en `.pdf`, i comprovar-ho aquí seria comprovar-ho dues vegades.
 */
export async function descarregaDocument(url: string, reintents = 3): Promise<Uint8Array> {
  const resposta = await demana(url, "application/pdf,*/*", reintents);
  return new Uint8Array(await resposta.arrayBuffer());
}

/**
 * Recorre l'índex d'un portal i torna els documents que hi troba, sense
 * duplicats i ordenats per data descendent (els que no en tenen, al final).
 *
 * Una pàgina d'índex que falla no atura la resta: els portals per anys tenen
 * forats (Cerdanyola no té pàgina per a tots els anys) i un 404 hi és una
 * resposta normal, no una avaria.
 */
export async function llistaDocuments(
  portal: Portal,
  opcions: OpcionsIndex = {},
): Promise<{ documents: DocumentPle[]; avisos: string[] }> {
  const documents: DocumentPle[] = [];
  const avisos: string[] = [];
  const vistos = new Set<string>();

  for (const urlIndex of portal.urlsIndex(opcions)) {
    let html: string;
    try {
      html = await descarregaHtml(urlIndex);
    } catch (error) {
      avisos.push(`${portal.slug}: no s'ha pogut llegir ${urlIndex} (${String(error)})`);
      continue;
    }
    const trobats = portal.extreu(html, urlIndex);
    if (trobats.length === 0) avisos.push(`${portal.slug}: cap document a ${urlIndex}`);
    for (const doc of trobats) {
      if (vistos.has(doc.url)) continue;
      vistos.add(doc.url);
      documents.push(doc);
    }
  }

  const senseData = documents.filter((d) => d.data === null).length;
  if (senseData > 0) {
    avisos.push(`${portal.slug}: ${senseData} documents sense data llegible a l'índex`);
  }

  documents.sort((a, b) => {
    if (a.data === b.data) return 0;
    if (a.data === null) return 1;
    if (b.data === null) return -1;
    return a.data < b.data ? 1 : -1;
  });
  return { documents, avisos };
}
