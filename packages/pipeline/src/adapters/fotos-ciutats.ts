import { fetchText } from "./seue";
import { sleep } from "../lib/http";

/**
 * Fotografies dels càrrecs electes de les ciutats grans, que **no són a seu-e**.
 *
 * L'adaptador de `seue.ts` resol 342 municipis, però hi falla justament allà on
 * hi haurà més ulls: Barcelona i Terrassa responen 404 al portal de l'AOC, i
 * l'Hospitalet, Lleida, Tarragona, Mataró, Santa Coloma i Reus hi tenen la
 * pàgina però amb **zero** `getPhotoBytes`. Comprovat una a una: dels onze
 * municipis més grans, només Badalona, Sabadell i Girona surten de seu-e amb
 * les 27 fotos, i aquests tres ja els cobreix l'adaptador de sempre.
 *
 * Per a la resta cal anar a cal ajuntament. Cada web és diferent, i per això
 * aquí no hi ha un lector genèric sinó una funció per ciutat: intentar unificar
 * cinc HTML que no s'assemblen en res només amagaria on es trenca cada cop que
 * un ajuntament redissenyi el web.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * La llicència mana més que el HTML
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Que una foto es pugui baixar no vol dir que es pugui republicar, i en aquest
 * projecte la diferència és tot el que separa Barcelona de Mataró. Per això
 * cada font porta la seva llicència comprovada i `fotosDe()` **es nega** a
 * baixar les que la tenen prohibida. La comprovació viu al costat del lector, i
 * no en un document a part, precisament perquè no se'n pugui perdre el rastre.
 *
 * Font i data de verificació: peticions reals fetes el 29 d'agost de 2026.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Tipus
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Una persona amb càrrec electe. Només allò que deriva del càrrec: qui és, què
 * fa, amb qui, i la cara oficial. Cap altra dada personal no entra aquí.
 */
export type CarrecCiutat = {
  nom: string;
  /** Càrrec tal com l'escriu l'ajuntament; buit si la pàgina no el diu. */
  carrec: string;
  /** Grup municipal; `null` quan la font no el separa del càrrec. */
  grup: string | null;
  /** URL absoluta de la fotografia, o `null` si aquesta persona no en té. */
  foto: string | null;
  /** Fitxa de detall a la web municipal, quan n'hi ha. */
  fitxa: string | null;
};

/**
 * Estat legal de la reutilització de les imatges, verificat a l'avís legal de
 * cada web. Els quatre valors no són graus d'una mateixa cosa: són decisions
 * diferents sobre què es pot fer.
 */
export type EstatLlicencia =
  /** Llicència oberta i llegible per màquina. Es pot republicar citant la font. */
  | "oberta"
  /** L'avís legal reserva la reutilització comercial; la resta, no la prohibeix. */
  | "no-comercial"
  /** No hem sabut trobar cap avís legal. No és permís: és desconeixement. */
  | "sense-avis-legal"
  /** L'avís legal prohibeix expressament la reproducció. */
  | "prohibida";

export type Font = {
  municipi: string;
  /** Pàgina o recurs d'on surten les dades. */
  url: string;
  llicencia: EstatLlicencia;
  /** Text literal de l'avís legal, o l'etiqueta de la llicència oberta. */
  citacio: string;
  /** On s'ha llegit la citació. Buit quan no s'ha trobat avís legal. */
  urlAvisLegal: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Barcelona — dades obertes, CC BY 4.0
// ─────────────────────────────────────────────────────────────────────────────

/*
 * El millor cas de tots i, de llarg, el que hauria de marcar el camí: Barcelona
 * no publica les cares dins d'un HTML sinó dins d'un dataset amb llicència
 * declarada, i el recurs JSON ja porta la URL de la foto a cada fila. No cal
 * aparellar noms ni endevinar res.
 *
 * El `robots.txt` d'`opendata-ajuntament.barcelona.cat` prohibeix `/data/api*`,
 * i per això aquí s'ataca el fitxer del recurs (`/data/dataset/…/download`), que
 * sí que és permès, en comptes de l'API de CKAN que seria la via natural.
 */
const BCN_RECURS_JSON =
  "https://opendata-ajuntament.barcelona.cat/data/dataset" +
  "/906a207a-a0d0-41f7-bf28-09c23320ea1f/resource/0951ae67-15bc-418d-a469-b37a30312960/download";

/**
 * El dataset barreja els 41 regidors amb ~800 gerents, consellers de districte,
 * vocals i assessors. Només els primers són càrrecs electes, i el filtre ha de
 * ser pel començament del càrrec: «Regidor Adscrit» i «Regidora del Districte»
 * ho són; «Conseller» —que a Barcelona vol dir conseller *de districte*, no
 * electe al Ple— no ho és.
 */
const BCN_CARREC_ELECTE = /^(Alcalde|Alcaldessa|Regidor|Regidora)\b/;

/**
 * Quan una persona encara no té retrat, el dataset hi posa la mateixa imatge de
 * plantilla per a tothom. Deixar-la passar ompliria fitxes diferents amb la
 * mateixa cara, que és pitjor que no tenir-ne cap.
 */
const BCN_FOTO_PLANTILLA = /dni[%20\s_-]*foto/i;

type FilaBcn = {
  partit_politic?: string;
  nom?: string;
  cognom_1?: string;
  cognom_2?: string;
  descripcio_carrec_ca?: string;
  dependencia_ca?: string;
  foto?: string;
};

/**
 * Llegeix el recurs JSON de càrrecs de Barcelona.
 *
 * Una mateixa persona hi surt en tantes files com càrrecs acumula —l'alcalde
 * n'arriba a tenir set—, i totes porten la mateixa foto. S'agrupa per nom
 * complet i es conserva el càrrec de més pes: la llista ha de dir «Alcalde», no
 * «Regidor del Districte», que és el que sortiria agafant la primera fila.
 */
export function parseBarcelona(json: string): CarrecCiutat[] {
  const files = JSON.parse(json) as FilaBcn[];
  const persones = new Map<string, CarrecCiutat & { pes: number }>();

  for (const fila of files) {
    const carrec = (fila.descripcio_carrec_ca ?? "").trim();
    if (!BCN_CARREC_ELECTE.test(carrec)) continue;

    const nom = [fila.nom, fila.cognom_1, fila.cognom_2]
      .map((part) => (part ?? "").trim())
      .filter(Boolean)
      .join(" ");
    if (!nom) continue;

    const fotoCru = (fila.foto ?? "").trim();
    const foto = fotoCru && !BCN_FOTO_PLANTILLA.test(fotoCru) ? fotoCru : null;

    const pes = pesCarrecBcn(carrec);
    const previ = persones.get(nom);
    if (previ && previ.pes >= pes) {
      // Ni que aquesta fila no guanyi, pot ser la que porta la foto.
      if (!previ.foto && foto) previ.foto = foto;
      continue;
    }
    persones.set(nom, {
      nom,
      carrec,
      grup: (fila.partit_politic ?? "").trim() || null,
      foto: foto ?? previ?.foto ?? null,
      fitxa: null,
      pes,
    });
  }

  return [...persones.values()]
    .sort((a, b) => b.pes - a.pes || a.nom.localeCompare(b.nom, "ca"))
    .map(({ pes: _pes, ...carrec }) => carrec);
}

function pesCarrecBcn(carrec: string): number {
  if (/^(Alcalde|Alcaldessa)\b/.test(carrec)) return 3;
  if (/Districte|President/.test(carrec)) return 2;
  return 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tarragona — targetes en una sola pàgina
// ─────────────────────────────────────────────────────────────────────────────

const TGN_URL = "https://www.tarragona.cat/lajuntament/govern/ple/conselleres-i-consellers";

/**
 * Els 27 electes de Tarragona —que allà se'n diuen consellers— caben en una
 * sola pàgina, cadascun dins d'una `card` amb foto, nom i càrrec. És l'única
 * de les cinc ciutats que es resol amb una única petició.
 *
 * La foto no penja de la fitxa de la persona sinó d'un `apartats/<slug>` germà,
 * i el slug hi arriba sovint amb un `copy_of_` al davant, herència de com es va
 * muntar la pàgina. Per això la imatge es llegeix de la targeta i no es
 * construeix a partir del nom: la regla que semblava òbvia falla en 6 de 27.
 */
export function parseTarragona(html: string): CarrecCiutat[] {
  const out: CarrecCiutat[] = [];
  const targetes = html.split(/<div class="card hovereffect/).slice(1);

  for (const bloc of targetes) {
    const nom = bloc.match(/class="card-title[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
    if (!nom) continue;
    const nomNet = textNet(nom[1]!);
    if (!nomNet) continue;

    const carrec = bloc.match(/class="card-text[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
    const foto = bloc.match(/<img[^>]*\ssrc="([^"]+)"/i);
    const fitxa = bloc.match(/<a[^>]*\shref="([^"]+)"/i);

    out.push({
      nom: nomNet,
      carrec: carrec ? textNet(carrec[1]!) : "",
      // La pàgina dona el càrrec de govern, no el grup municipal: no l'inventem.
      grup: null,
      foto: foto ? absolut(foto[1]!, TGN_URL) : null,
      fitxa: fitxa ? absolut(fitxa[1]!, TGN_URL) : null,
    });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lleida — una pàgina per a tots els grups municipals
// ─────────────────────────────────────────────────────────────────────────────

const LLE_URL = "https://www.paeria.cat/ca/ajuntament/grups-municipals";

/**
 * La Paeria posa els 27 regidors en una sola pàgina, agrupats per grup, dins de
 * `<figure class="grupMunicipal__regidor">`.
 *
 * El grup no s'escriu enlloc dins de la targeta: viu al **camí** de la URL de la
 * persona (`grups-municipals/erc-am/anna-costa-i-ramirez`). Llegir-lo d'allà és
 * segur perquè és la mateixa carpeta que Plone fa servir per ordenar la pàgina;
 * el títol de la secció, en canvi, va a part i no sempre coincideix amb el nom
 * oficial del grup.
 *
 * Es guarda el slug del grup, no una etiqueta bonica: convertir `erc-am` en
 * «ERC-AM» seria endevinar com s'escriu el nom, i això ja ho fa el cens de
 * l'AOC, que és qui mana en aquest camp.
 */
export function parseLleida(html: string): CarrecCiutat[] {
  const out: CarrecCiutat[] = [];
  const figures = html.split(/<figure class="grupMunicipal__regidor/).slice(1);

  for (const bloc of figures) {
    const enllac = bloc.match(/<a[^>]*\shref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!enllac) continue;
    const nom = textNet(enllac[2]!);
    if (!nom) continue;

    const fitxa = absolut(enllac[1]!, LLE_URL);
    const foto = bloc.match(/<img[^>]*\ssrc="([^"]+)"/i);
    const grup = fitxa.match(/\/grups-municipals\/([^/]+)\/[^/]+\/?$/i);

    out.push({
      nom,
      // La pàgina de grups no diu el càrrec de govern, només qui és regidor.
      carrec: "",
      grup: grup ? decodeURIComponent(grup[1]!) : null,
      foto: foto ? absolut(foto[1]!, LLE_URL) : null,
      fitxa,
    });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mataró — una pàgina per grup municipal
// ─────────────────────────────────────────────────────────────────────────────

const MAT_ARREL = "https://www.mataro.cat/ca/lajuntament/grups-municipals";

/**
 * Mataró és l'única que obliga a una petició per grup: no hi ha cap pàgina que
 * els reuneixi. Els slugs són fixos i s'han comprovat un a un, perquè
 * derivar-los del nom del partit no funciona (`grup-municipal-ecpm-ecg`).
 */
export const MATARO_GRUPS = [
  "grup-municipal-psc-cp",
  "grup-municipal-erc-mes-am",
  "grup-municipal-junts-per-mataro",
  "grup-municipal-vox",
  "grup-municipal-pp",
  "grup-municipal-ecpm-ecg",
  "grup-municipal-cup-pa",
] as const;

export function urlMataro(grup: string): string {
  return `${MAT_ARREL}/${grup}/regidors`;
}

/**
 * Cada regidor és un `<article class="tileItem">` de Plone amb el nom al titular
 * i el retrat a `@@images/<uuid>.jpeg`.
 *
 * Aquest `uuid` és el de la imatge, no el de la persona, i canvia cada vegada
 * que l'ajuntament en puja una de nova. La URL, doncs, **no es pot desar i
 * reutilitzar**: cal tornar a llegir la pàgina. La forma estable
 * (`…/<persona>/@@images/image/preview`) també respon, però serveix una mida que
 * l'ajuntament no controla des de la fitxa, i per això es fa servir la del HTML.
 */
export function parseMataro(html: string, grup: string | null = null): CarrecCiutat[] {
  const out: CarrecCiutat[] = [];
  const articles = html.split(/<article class="tileItem">/).slice(1);

  for (const bloc of articles) {
    const enllac = bloc.match(/<a[^>]*class="summary url"[^>]*\shref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!enllac) continue;
    const nom = textNet(enllac[2]!);
    if (!nom) continue;

    const foto = bloc.match(/<img[^>]*\ssrc="([^"]+@@images[^"]+)"/i);
    out.push({
      nom,
      carrec: "",
      grup,
      foto: foto ? absolut(foto[1]!, MAT_ARREL) : null,
      fitxa: absolut(enllac[1]!, MAT_ARREL),
    });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// L'Hospitalet de Llobregat — pàgina de biografies
// ─────────────────────────────────────────────────────────────────────────────

const LH_URL = "https://seuelectronica.l-h.cat/238633_1.aspx?id=1";

/**
 * L'Hospitalet no té pàgina de cartipàs amb fotos: les cares són a la pàgina de
 * **biografies** del consistori, i per això d'aquí no en surt cap càrrec de
 * govern, només qui és regidor i de quin grup.
 *
 * La imatge no té nom de fitxer sinó un testimoni opac
 * (`obreFitxer.ashx?Fw9EVw48XS6…`). No es pot construir ni endevinar, i no hi ha
 * cap garantia que sobrevisqui: qualsevol ús ha de tornar a llegir la pàgina.
 *
 * L'aparellament, en canvi, és exacte i barat: l'`alt` de cada imatge diu
 * «Fotografia de <nom>». No cal comparar-lo amb el `<h4>` del costat.
 */
export function parseHospitalet(html: string): CarrecCiutat[] {
  const out: CarrecCiutat[] = [];
  const re = /<img\s+src="([^"]*obreFitxer\.ashx[^"]*)"\s+alt="Fotografia de ([^"]+)"/gi;

  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const nom = textNet(m[2]!);
    if (!nom) continue;

    /*
     * El grup va entre parèntesis al titular que segueix la foto:
     * «David Quirós Brito (PSC-CP)». Es busca només en el tros de HTML que hi
     * ha fins a la imatge següent, per no arrossegar el grup del veí quan a
     * algú li falti el titular.
     */
    re.lastIndex = m.index + m[0].length;
    const seguent = html.slice(re.lastIndex).search(/<img\s+src="[^"]*obreFitxer\.ashx/i);
    const fins = seguent === -1 ? html.length : re.lastIndex + seguent;
    const titol = html.slice(re.lastIndex, fins).match(/<h4[^>]*>([\s\S]*?)<\/h4>/i);
    const grup = titol ? textNet(titol[1]!).match(/\(([^)]+)\)\s*$/) : null;

    out.push({
      nom,
      carrec: "",
      grup: grup ? grup[1]!.trim() : null,
      foto: absolut(m[1]!, LH_URL),
      fitxa: null,
    });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Les fonts i la seva llicència
// ─────────────────────────────────────────────────────────────────────────────

/**
 * L'estat legal de cada font, amb el text literal que l'aguanta. Barcelona és
 * l'única que publica una llicència oberta; les altres van del silenci a la
 * prohibició explícita, i això —no la dificultat tècnica— és el que decideix
 * quines es poden fer servir.
 */
export const FONTS: Readonly<Record<string, Font>> = Object.freeze({
  Barcelona: {
    municipi: "Barcelona",
    url: BCN_RECURS_JSON,
    llicencia: "oberta",
    citacio: "Llicència: Creative Commons Attribution 4.0",
    urlAvisLegal:
      "https://opendata-ajuntament.barcelona.cat/data/ca/dataset/carrecs-electes-comissionats-i-gerents",
  },
  Tarragona: {
    municipi: "Tarragona",
    url: TGN_URL,
    llicencia: "no-comercial",
    citacio:
      "l'Usuari no està autoritzat per procedir a la reproducció, distribució, cessió, " +
      "comunicació pública i / o transformació de la informació continguda en aquesta web " +
      "amb fins comercials, llevat que es compti amb l'autorització del titular dels " +
      "corresponents drets o això resulti legalment permès",
    urlAvisLegal: "https://www.tarragona.cat/avis-legal",
  },
  Lleida: {
    municipi: "Lleida",
    url: LLE_URL,
    llicencia: "sense-avis-legal",
    citacio: "",
    urlAvisLegal: null,
  },
  "l'Hospitalet de Llobregat": {
    municipi: "l'Hospitalet de Llobregat",
    url: LH_URL,
    llicencia: "sense-avis-legal",
    citacio: "",
    urlAvisLegal: null,
  },
  /*
   * Mataró és el cas que justifica tot aquest bloc: el HTML es llegeix sense cap
   * dificultat i les 27 fotos hi són, però l'avís legal les tanca amb totes les
   * lletres. Es deixa el lector escrit i la font declarada perquè quedi constància
   * que s'ha mirat i per què s'ha dit que no —esborrar-ho només faria que d'aquí
   * a sis mesos algú ho tornés a intentar.
   */
  Mataró: {
    municipi: "Mataró",
    url: MAT_ARREL,
    llicencia: "prohibida",
    citacio:
      "no es permet la reproducció parcial o total del portal, ni el seu tractament " +
      "informàtic, sense el permís previ i per escrit dels seus propietaris, és a dir, " +
      "de l'Ajuntament de Mataró",
    urlAvisLegal: "https://www.mataro.cat/ca/legal",
  },
});

export class LlicenciaDenegadaError extends Error {
  constructor(readonly font: Font) {
    super(
      `${font.municipi}: l'avís legal no permet reutilitzar les imatges. ` +
        `«${font.citacio}» (${font.urlAvisLegal})`,
    );
    this.name = "LlicenciaDenegadaError";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Descàrrega
// ─────────────────────────────────────────────────────────────────────────────

export type OpcionsFotos = {
  /** Pausa entre peticions. Només Mataró en fa més d'una. */
  delayMs?: number;
  /**
   * Baixa també les fonts amb la llicència prohibida. No hi ha cap ús legítim
   * dins del producte; existeix perquè els tests puguin recórrer el lector.
   */
  ignoraLlicencia?: boolean;
};

/**
 * Baixa els càrrecs amb foto d'un dels municipis coberts.
 *
 * La comprovació de llicència va **abans** de la petició i no després: si no
 * podem publicar la imatge, tampoc no cal anar a molestar el servidor de
 * l'ajuntament per mirar-la.
 */
export async function fotosDe(
  municipi: string,
  options: OpcionsFotos = {},
): Promise<CarrecCiutat[]> {
  const font = FONTS[municipi];
  if (!font) throw new Error(`No hi ha cap font de fotos per a «${municipi}»`);
  if (font.llicencia === "prohibida" && !options.ignoraLlicencia) {
    throw new LlicenciaDenegadaError(font);
  }

  const { delayMs = 1_000 } = options;

  switch (municipi) {
    case "Barcelona": {
      const { html } = await fetchText(font.url);
      return parseBarcelona(html);
    }
    case "Tarragona": {
      const { html } = await fetchText(font.url);
      return parseTarragona(html);
    }
    case "Lleida": {
      const { html } = await fetchText(font.url);
      return parseLleida(html);
    }
    case "l'Hospitalet de Llobregat": {
      const { html } = await fetchText(font.url);
      return parseHospitalet(html);
    }
    case "Mataró": {
      const out: CarrecCiutat[] = [];
      for (const [i, grup] of MATARO_GRUPS.entries()) {
        if (i > 0) await sleep(delayMs);
        const { status, html } = await fetchText(urlMataro(grup));
        // Un grup que desapareix no ha d'endur-se els altres sis.
        if (status === 200) out.push(...parseMataro(html, grup));
      }
      return out;
    }
    default:
      throw new Error(`Font declarada però sense lector: «${municipi}»`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilitats
// ─────────────────────────────────────────────────────────────────────────────

const ENTITATS: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ordf: "ª", ordm: "º", deg: "°", middot: "·", hellip: "…",
  ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
  eacute: "é", egrave: "è", agrave: "à", aacute: "á", iacute: "í", igrave: "ì",
  oacute: "ó", ograve: "ò", uacute: "ú", ugrave: "ù", ccedil: "ç",
  uuml: "ü", iuml: "ï", ntilde: "ñ",
  Eacute: "É", Egrave: "È", Agrave: "À", Aacute: "Á", Iacute: "Í",
  Oacute: "Ó", Ograve: "Ò", Uacute: "Ú", Ccedil: "Ç", Ntilde: "Ñ",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (tot, cos: string) => {
    if (cos.startsWith("#")) {
      const codi = cos[1] === "x" || cos[1] === "X"
        ? Number.parseInt(cos.slice(2), 16)
        : Number.parseInt(cos.slice(1), 10);
      return Number.isFinite(codi) ? String.fromCodePoint(codi) : tot;
    }
    return ENTITATS[cos] ?? ENTITATS[cos.toLowerCase()] ?? tot;
  });
}

/** Text visible d'un fragment de HTML, amb els espais col·lapsats. */
function textNet(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Els webs municipals barregen URL absolutes i relatives dins de la mateixa
 * pàgina —l'Hospitalet serveix les fotos com a `/utils/…`— i el que es desa a la
 * fitxa ha de ser sempre absolut.
 */
function absolut(url: string, base: string): string {
  try {
    return new URL(decodeEntities(url.trim()), base).toString();
  } catch {
    return url.trim();
  }
}
