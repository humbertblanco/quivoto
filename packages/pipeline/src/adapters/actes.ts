/**
 * Lectura d'actes de ple en PDF.
 *
 * Fins ara el projecte només **comptava** actes. Aquest fitxer és el primer que
 * les **llegeix**: converteix un PDF de l'acteca de l'AOC en una llista de punts
 * de l'ordre del dia amb el resultat de la votació i, quan l'acta el desglossa,
 * el vot de cada grup municipal amb la cita literal que ho demostra.
 *
 * Tot és determinista —expressions regulars i heurístiques, cap model de
 * llenguatge— perquè volem saber fins on s'arriba sense IA abans de pagar-ne.
 *
 * L'ordre dels passos no és arbitrari; és el que hem mesurat que funciona:
 *
 *   1. `esPdf` — la font serveix .doc i .docx amb URL acabada en `.pdf`.
 *   2. `textDelPdf` — `pdftotext -layout`, que conserva les columnes.
 *   3. `netejaMarge` — **el pas que decideix el recall**. Vegeu-hi el comentari.
 *   4. `detectaOrgan` — el 1-3% del dataset són juntes de govern disfressades.
 *   5. `segmentaPunts` — el coll d'ampolla real, més difícil que el vot.
 *   6. `extreuVotacio` — resultat global i, si hi és, vot per grup.
 *
 * Les funcions són pures i es proven amb text real (`__fixtures__/actes/`).
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// ─────────────────────────────────────────────────────────────────────────────
// Tipus
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cinc valors, no tres. El vot en blanc existeix («5 en blanc del PSC», Alcarràs)
 * i els absents s'han de poder registrar per no atribuir una unanimitat a un grup
 * que no era a la sala.
 */
export type SentitVot = "favor" | "contra" | "abstencio" | "blanc" | "absent";

/**
 * Un grup pot partir el vot: a Tortosa el grup MT–PSC–CP va votar 5 a favor i 2
 * en contra al mateix punt. Per això el vot per grup és una llista de files
 * (grup, sentit, vots) i no un mapa de grup a sentit.
 */
export type VotGrup = {
  /** Tal com l'escriu l'acta. La correspondència amb la marca es fa més amunt. */
  grup: string;
  sentit: SentitVot;
  /** Nombre de vots, si l'acta el diu. `null` vol dir «tot el grup, sense xifra». */
  vots: number | null;
};

export type ResultatVotacio = "aprovat" | "rebutjat" | "empat" | "desconegut";

export type Votacio = {
  resultat: ResultatVotacio;
  /** Aprovat sense cap vot en contra ni abstenció registrats. */
  unanimitat: boolean;
  recompte: Record<SentitVot, number | null>;
  perGrup: VotGrup[];
  /** El fragment de l'acta d'on surt tot això. Sense cita no publiquem res. */
  cita: string;
  /** Quin extractor ha encertat. Serveix per saber què cal millorar. */
  patro: string;
};

export type TipusPunt =
  | "mocio"
  | "declaracio"
  | "acord"
  | "donar_compte"
  | "precs"
  | "acta"
  | "urgencia"
  | "altres";

export type PuntActa = {
  /** El número tal com el numera l'acta («7», «9.1»). */
  numero: string | null;
  titol: string;
  tipus: TipusPunt;
  /** Qui presenta la moció, si consta al títol. No sempre és un partit. */
  proposant: string | null;
  votacio: Votacio | null;
};

export type Assistent = {
  nom: string;
  grup: string | null;
};

export type Organ = "ple" | "junta_de_govern" | "desconegut";

export type ActaExtreta = {
  organ: Organ;
  punts: PuntActa[];
  assistents: Assistent[];
  /** Coses que no quadren i que han d'acabar a `data_issues`. */
  avisos: string[];
};

// ─────────────────────────────────────────────────────────────────────────────
// 1 i 2. Del fitxer al text
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sorpresa mesurada: l'acteca serveix documents de Word amb l'URL acabada en
 * `.pdf` (Castelldefels i Sant Pere de Ribes, 3 de 133 de la mostra). Si no es
 * mira la capçalera del fitxer, `pdftotext` falla sense dir per què.
 */
export function esPdf(dades: Uint8Array): boolean {
  return dades.length > 4 && dades[0] === 0x25 && dades[1] === 0x50 && dades[2] === 0x44 && dades[3] === 0x46;
}

/**
 * `-layout` no és opcional: la meitat de les actes posen el resultat de la
 * votació en columnes i sense conservar-les el text queda il·legible. El preu és
 * el marge de signatura, que resol `netejaMarge`.
 *
 * I **no** passem `-nopgbrk`: el salt de pàgina (`\f`) és justament el que
 * permet a `netejaMarge` saber què es repeteix a totes les pàgines.
 */
export async function textDelPdf(rutaPdf: string): Promise<string> {
  const { stdout } = await execFileAsync(
    "pdftotext",
    ["-layout", "-enc", "UTF-8", rutaPdf, "-"],
    { maxBuffer: 256 * 1024 * 1024, encoding: "utf8" },
  );
  return stdout;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Neteja del marge de signatura — el pas zero
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mai no esborrem un fragment que parli de votar. És la xarxa de seguretat de
 * tota la neteja: encara que l'heurística s'equivoqui, no pot fer caure el recall.
 */
const VOCABULARI_DE_VOT = /vot|favor|contra|abstenc|unanimitat|aprov|moci|rebutj|desestim|assentiment/i;

type Fragment = { inici: number; text: string };

/**
 * Un fragment és un tros de línia envoltat de blancs amples. Amb `-layout`, el
 * marge de signatura i el cos del document queden separats per tres o més
 * espais, i és així com els podem distingir sense saber res del document.
 */
export function fragmentsDeLinia(linia: string): Fragment[] {
  const fragments: Fragment[] = [];
  const re = /\S(?:.*?\S)?(?=\s{3,}|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(linia)) !== null) {
    if (m[0].trim()) fragments.push({ inici: m.index, text: m[0] });
    if (m.index === re.lastIndex) re.lastIndex += 1;
  }
  return fragments;
}

/** Les xifres canvien de pàgina a pàgina («Pàg. 3 de 45»); el motlle, no. */
const motlle = (text: string): string => text.trim().replace(/\d+/g, "#").replace(/\s+/g, " ");

/**
 * **El pas que decideix si tot això funciona o no.**
 *
 * El marge de signatura electrònica s'imprimeix a la mateixa capa que el text i
 * `pdftotext -layout` l'intercala enmig de les frases de votació, partint-les.
 * La temptació és fer una llista d'expressions regulars amb les fórmules de cada
 * plataforma («SIGNAT PER», «Codi Segur de Verificació», «esPublico Gestiona»…),
 * però n'hi ha desenes i cada ajuntament n'estrena una.
 *
 * El que sí que és universal: **el marge es repeteix a totes les pàgines i el
 * contingut no**. Així que no busquem fórmules, busquem repetició: un fragment
 * curt que apareix a la meitat de les pàgines o més és decoració —signatura,
 * capçalera, peu, codi de verificació— i fora. La condició de seguretat és que
 * mai no s'esborra un fragment amb vocabulari de vot.
 *
 * Mesurat sobre 130 actes reals de 65 municipis: treu entre el 3% i el 22% del
 * text i **no perd ni una sola** de les 992 aparicions de «vots a favor».
 */
export function netejaMarge(text: string): string {
  const pagines = text.split("\f");
  // Amb poques pàgines la repetició no és evidència de res.
  if (pagines.length < 4) return text;

  const paginesPerFragment = new Map<string, number>();
  for (const pagina of pagines) {
    const vistos = new Set<string>();
    for (const linia of pagina.split("\n")) {
      for (const fragment of fragmentsDeLinia(linia)) {
        const clau = motlle(fragment.text);
        if (clau.length >= 2 && clau.length <= 120) vistos.add(clau);
      }
    }
    for (const clau of vistos) paginesPerFragment.set(clau, (paginesPerFragment.get(clau) ?? 0) + 1);
  }

  const llindar = Math.max(3, Math.floor(pagines.length * 0.5));
  const decoracio = new Set<string>();
  for (const [clau, quantes] of paginesPerFragment) {
    if (quantes >= llindar && !VOCABULARI_DE_VOT.test(clau)) decoracio.add(clau);
  }
  if (decoracio.size === 0) return text;

  return pagines
    .map((pagina) =>
      pagina
        .split("\n")
        .map((linia) => {
          let resultat = linia;
          for (const fragment of fragmentsDeLinia(linia)) {
            if (!decoracio.has(motlle(fragment.text))) continue;
            // Substituïm per espais per no moure les columnes de la resta.
            resultat =
              resultat.slice(0, fragment.inici) +
              " ".repeat(fragment.text.length) +
              resultat.slice(fragment.inici + fragment.text.length);
          }
          return resultat.trimEnd();
        })
        .join("\n"),
    )
    .join("\f");
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Ple o junta de govern
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El camp `TIPUS` de l'AOC només diu Ordinària/Extraordinària, mai l'òrgan, i un
 * `grep` global de «junta de govern» classifica malament les actes de Ple que
 * ratifiquen acords de la junta. L'únic senyal fiable és el capçal, i només el
 * capçal: mirem els primers 3.500 caràcters i prou.
 */
/**
 * Vam començar amb una llista de fórmules («ACTA DEL PLE», «Òrgan: Ple»…) i
 * fallava a la meitat de les actes: n'hi ha tantes com programes de gestió
 * documental. El que sí que és constant és que **el capçal anomena l'òrgan
 * abans que res**, així que en comptes de reconèixer fórmules busquem quina de
 * les dues paraules apareix primer.
 *
 * `\bPle\b` no encaixa amb «Plens» ni amb «Plenària» —volem el mot sol—, i les
 * variants d'expedient (`PLN/2026/4`, `AYT/PLE/3/2026`, `S-PL-2026/007`) hi són
 * perquè a Calella i a Salou l'òrgan només surt com a codi.
 */
const MARCA_PLE =
  /\bPLE\b|\bPle\b|\bPLENARI\b|\bplenària\b|\bPLEN[ÀA]RIA\b|PLN\/\d{4}|S-PL-\d{4}|\/PLE\/\d/;

const MARCA_JG = /\bJunta\s+de\s+[Gg]overn\b|\bJUNTA\s+DE\s+GOVERN\b|\bJGL?\/\d{4}/;

export function detectaOrgan(text: string): Organ {
  // Només el capçal. Un `grep` global de «junta de govern» classificaria
  // malament les actes de Ple que ratifiquen acords de la junta: al cos d'una
  // acta de Tortosa hi surt fins a nou vegades.
  const capcal = text.slice(0, 4000);
  const ple = capcal.search(MARCA_PLE);
  const jg = capcal.search(MARCA_JG);
  if (ple === -1 && jg === -1) return "desconegut";
  if (jg === -1) return "ple";
  if (ple === -1) return "junta_de_govern";
  return ple <= jg ? "ple" : "junta_de_govern";
}

// ─────────────────────────────────────────────────────────────────────────────
// Numerals catalans
// ─────────────────────────────────────────────────────────────────────────────

const UNITATS: Record<string, number> = {
  zero: 0, cap: 0, ningu: 0, un: 1, una: 1, dos: 2, dues: 2, tres: 3, quatre: 4, cinc: 5,
  sis: 6, set: 7, vuit: 8, nou: 9, deu: 10, onze: 11, dotze: 12, tretze: 13, catorze: 14,
  quinze: 15, setze: 16, disset: 17, desset: 17, divuit: 18, devuit: 18,
  dinou: 19, denou: 19, vint: 20, trenta: 30, quaranta: 40,
};

const sensAccents = (t: string): string =>
  t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * Figueres, Tortosa i Sant Adrià escriuen els recomptes en lletres. Sense
 * convertir-los no es pot validar que la suma dels grups quadri amb el total, i
 * per tant no es detecta una extracció truncada.
 */
export function numeralCatala(paraula: string): number | null {
  const net = sensAccents(paraula).replace(/[^a-z-]/g, "");
  if (!net) return null;
  if (net in UNITATS) return UNITATS[net]!;
  // «vint-i-tres», «trenta-un»
  const compost = net.match(/^(vint|trenta|quaranta)-?i?-(.+)$/);
  if (compost) {
    const desena = UNITATS[compost[1]!];
    const unitat = UNITATS[compost[2]!];
    if (desena !== undefined && unitat !== undefined) return desena + unitat;
  }
  return null;
}

/** Un recompte pot venir en xifres o en lletres; les dues formes conviuen. */
export function aNombre(text: string | undefined | null): number | null {
  if (!text) return null;
  const net = text.trim();
  if (/^\d+$/.test(net)) return Number.parseInt(net, 10);
  return numeralCatala(net);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Segmentació per punt de l'ordre del dia
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verbs i substantius amb què comença un títol de punt. Serveixen per separar un
 * títol de veritat d'una llista d'antecedents numerada, que és el parany que
 * trenca qualsevol comptador.
 */
const INICI_DE_TITOL =
  /^(?:Aprovaci|Aprovar|Moci|Moció|Dació|Donar|Dictamen|Modificaci|Elecci|Ratificaci|Ratificar|Declaraci|Resoluci|Designaci|Adhesi|Nomenament|Delegaci|Proposta|Expedient|Precs|Preguntes|Informe|Acord|Compte|Compte|Sol·licitud|Presa|Cessi|Constituci|Creaci|Concessi|Rectificaci|Revocaci|Verificaci|Suport|Assabentat|Coneixement|Adjudicaci|Contracte|Conveni|Ordenança|Reglament|Pressupost|Pla|Prendre|Rebutjar|Desestimar|Estimar|Autoritzar|Establir|Fixar|Modificar|Aprovacio|[A-ZÀ-Ú]{4,})/;

type Capçalera = { pos: number; numero: string; ordre: number; titol: string };

/**
 * Els números de punt d'una acta. Cinc plantilles cobreixen tot el que hem vist:
 * `4. Títol`, `1.- Títol`, `9.1. - TÍTOL`, `07 – TÍTOL` i `1.0.- Títol`.
 *
 * El filtre que ho fa utilitzable no és la regex sinó el que ve després: només
 * ens quedem amb la seqüència creixent més llarga de números, que és el que
 * distingeix l'ordre del dia d'una llista d'«Antecedents» que reinicia a 1.
 */
const CAPCALERA =
  /(?:^|\n)[ \t]*(?:-{2,6}[ \t]*)?(\d{1,2})(?:\.(\d{1,2}))?[ \t]*(?:\.[ \t]*-|\.-|[.\-–—)])[ \t]+([^\n]{6,300})/g;

export function candidatsCapcalera(text: string): Capçalera[] {
  const fora: Capçalera[] = [];
  CAPCALERA.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CAPCALERA.exec(text)) !== null) {
    const titol = m[3]!.trim().replace(/\s{2,}/g, " ");
    if (!INICI_DE_TITOL.test(titol)) continue;
    // Un títol que acaba amb dos punts sol ser una entrada d'índex o un peu.
    if (/^\d/.test(titol)) continue;
    const principal = Number.parseInt(m[1]!, 10);
    const sub = m[2] ? Number.parseInt(m[2]!, 10) : 0;
    if (principal < 1 || principal > 60) continue;
    fora.push({
      pos: m.index,
      numero: m[2] ? `${principal}.${sub}` : String(principal),
      ordre: principal * 100 + sub,
      titol,
    });
  }
  return fora;
}

/**
 * La cadena de punts més llarga que **es compta de un en un**.
 *
 * Amb «creixent» n'hi havia prou en teoria i no en la pràctica: dins d'un
 * dictamen hi ha llistes numerades que també creixen, i la cadena més llarga
 * acabava barrejant punts de l'ordre del dia amb apartats d'un informe (mesurat
 * a Sabadell: 25 candidats, 13 segments, un d'ells de 153.000 caràcters).
 *
 * Un ordre del dia es numera 1, 2, 3…, i per això la condició és que cada punt
 * segueixi l'anterior. Deixem un salt de dos perquè alguns plens retiren un punt
 * de l'ordre del dia i el número no es reaprofita.
 */
export function cadenaDePunts<T extends { ordre: number }>(items: T[]): T[] {
  if (items.length === 0) return [];
  const principal = (t: T) => Math.floor(t.ordre / 100);
  const sub = (t: T) => t.ordre % 100;
  const llarg: number[] = new Array(items.length).fill(1);
  const previ: number[] = new Array(items.length).fill(-1);
  let fi = 0;
  for (let i = 0; i < items.length; i += 1) {
    for (let j = 0; j < i; j += 1) {
      const salt = principal(items[i]!) - principal(items[j]!);
      const seguit = salt === 1 || salt === 2 || (salt === 0 && sub(items[i]!) > sub(items[j]!));
      if (seguit && llarg[j]! + 1 > llarg[i]!) {
        llarg[i] = llarg[j]! + 1;
        previ[i] = j;
      }
    }
    if (llarg[i]! > llarg[fi]!) fi = i;
  }
  const cami: T[] = [];
  for (let i = fi; i >= 0; i = previ[i]!) {
    cami.push(items[i]!);
    if (previ[i] === -1) break;
  }
  return cami.reverse();
}

export type Segment = { numero: string; titol: string; text: string; inici: number };

/**
 * Moltes actes comencen amb l'índex de l'ordre del dia, i l'índex és una
 * seqüència de números creixent perfecta: la primera subseqüència que troba
 * l'algorisme és l'índex, no el cos, i llavors tots els punts queden buits i
 * tota l'acta cau dins de l'últim (mesurat a Sitges: 23 punts, 0 votacions).
 *
 * La solució és barata: buscar totes les seqüències del document —l'índex, el
 * cos, i el que hi hagi— i quedar-nos amb **la que cobreix més text**. L'índex
 * ocupa dues pàgines; el cos, tot el document.
 */
export function segmentaPunts(text: string): Segment[] {
  const tots = candidatsCapcalera(text);
  let restants = tots;
  let millor: Capçalera[] = [];
  let millorAbast = -1;
  for (let volta = 0; volta < 6 && restants.length > 0; volta += 1) {
    const seq = cadenaDePunts(restants);
    if (seq.length === 0) break;
    const primera = seq[0]!;
    const ultima = seq[seq.length - 1]!;
    const abast = ultima.pos - primera.pos;
    if (seq.length >= 2 && abast > millorAbast) {
      millorAbast = abast;
      millor = seq;
    }
    restants = restants.filter((c) => c.pos > ultima.pos);
  }
  if (millor.length === 0) millor = cadenaDePunts(tots);

  return millor.map((cap, i) => ({
    numero: cap.numero,
    titol: cap.titol,
    inici: cap.pos,
    text: text.slice(cap.pos, millor[i + 1]?.pos ?? text.length),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Tipus de punt i qui el proposa
// ─────────────────────────────────────────────────────────────────────────────

export function tipusDePunt(titol: string): TipusPunt {
  const t = sensAccents(titol);
  if (/\bmocio/.test(t)) return "mocio";
  if (/declaracio institucional|manifest institucional/.test(t)) return "declaracio";
  if (/precs i preguntes|\bprecs\b|\bpreguntes\b/.test(t)) return "precs";
  if (/aprovacio de (l'|les |l )?act|acta de la sessio|aprovar l'acta|lectura i aprovacio de l'acta/.test(t)) return "acta";
  if (/dacio de compte|donar compte|restar assabentat|coneixement de|assabentat/.test(t)) return "donar_compte";
  if (/urgencia|urgent/.test(t)) return "urgencia";
  if (/aprova|ratifica|modifica|adjudica|adhesi|designa|nomena|delega|conveni|ordenanc|pressupost|expedient|dictamen|proposta/.test(t)) {
    return "acord";
  }
  return "altres";
}

/**
 * Qui presenta la moció. **No sempre és un partit**: a Sabadell hi ha mocions
 * d'una federació d'associacions de veïns, d'un sindicat i d'un casal. Per això
 * es desa el text literal i no s'intenta encaixar-lo en cap llista de grups.
 */
const PROPOSANT =
  /moci(?:ó|ons|o)\s+(?:conjunta\s+)?(?:que\s+(?:presenta|presenten|presentaren)\s+)?(?:de(?:l|ls)?|d[’']|presentada\s+pe(?:l|ls|r)|la|el|els|les)?\s*(?:grups?\s+municipals?\s+)?(?:de(?:l|ls)?\s+|d[’'])?([^,.\n:;]{2,80}?)(?=\s*(?:,|:|\.|;|\n|\s+(?:per|per\s+a|referent|relatiu|relativa|de\s+suport|sobre|en\s+relaci|amb\s+motiu|contra|a\s+favor|per\s+la|per\s+al|perqu)\b))/i;

export function proposantDeTitol(titol: string): string | null {
  const m = titol.match(PROPOSANT);
  if (!m) return null;
  const net = m[1]!
    .trim()
    .replace(/^(?:la|el|els|les)\s+/i, "")
    .replace(/^(?:grups?\s+municipals?\s+)?(?:de(?:l|ls)?\s+|d[’'])/i, "")
    .trim();
  return net.length >= 2 && net.length <= 80 ? net : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. La votació
// ─────────────────────────────────────────────────────────────────────────────

const ETIQUETA_SENTIT: ReadonlyArray<readonly [RegExp, SentitVot]> = [
  [/^vots?\s+en\s+blanc$|^en\s+blanc$|^vots?\s+blancs?$/i, "blanc"],
  [/^vots?\s+en\s+contra$|^en\s+contra$|^vots?\s+contraris?$|^contraris?$/i, "contra"],
  // «S'abstenen: 3» és com el Prat encapçala el bloc d'abstencions; sense
  // aquesta etiqueta el bloc queda penjat del sentit anterior i els seus grups
  // s'atribueixen als vots en contra.
  [/^abstencions?$|^abstenci(?:ó|o)$|^vots?\s+d[’']abstenci(?:ó|o)$|^s[’']absten(?:en|ci(?:ó|o))?$|^s[’']abst[eé]$/i, "abstencio"],
  [/^absents?$|^no\s+assisteixen$/i, "absent"],
  [/^vots?\s+(?:a\s+)?favor$|^a\s+favor$|^vots?\s+favorables?$|^favorables?$/i, "favor"],
];

function sentitDEtiqueta(etiqueta: string): SentitVot | null {
  const net = etiqueta.trim().replace(/\s+/g, " ");
  for (const [re, sentit] of ETIQUETA_SENTIT) if (re.test(net)) return sentit;
  return null;
}

/**
 * Soroll que embolcalla els noms de grup i que no aporta res: «dels regidors i
 * les regidores del grup municipal de…». Es treu abans de partir la llista
 * perquè, si no, cada tros porta mitja frase enganxada.
 */
const SOROLL_DE_GRUP: ReadonlyArray<RegExp> = [
  /^\s*(?:\d+\s+)?(?:que\s+)?correspone?n?\s+(?:als?|a\s+la|a)\s+/i,
  /\bgrups?\s+pol[ií]tics?\s+municipals?\s*/gi,
  // «Vots a favor: 12. Dels grups del PSC-CP i ERC-AM.» (Ripollet). Sense
  // aquesta regla el grup es desava com a «grups del PSC-CP», que no encaixa
  // amb cap sigla de la taula de marques i, per tant, és un vot perdut.
  // Demana l'article («dels grups»), perquè un «GRUP» sol pot ser part del nom:
  // a Blanes hi ha un partit que es diu literalment «GRUP BLANES».
  /\bde(?:l|ls)?\s+grups?\s+(?:pol[ií]tics?\s+)?(?:municipals?\s+)?(?:de(?:l|ls)?\s+|d[’']\s*)?/gi,
  /\bde\s+la\s+corporaci(?:ó|o)\s+municipal\b/gi,
  /\bde(?:l|ls)?\s*\/\s*de\s+l(?:es|a)\s+/gi,
  // L'article davant de «regidor» és obligatori a posta. Sense ell, la taula
  // d'assistents del capçal —«María Carmen Olària Segret, regidora»— es
  // quedava sense la paraula que la delatava i els cognoms sortien publicats
  // com a grups amb un sentit de vot al costat (Mollet).
  /\b(?:de(?:l|ls)?|de\s+les|els|les)\s+regidor(?:s|a|es)?(?:\s*\/\s*(?:regidor)?(?:a|es|s)?)?\s*(?:i\s+(?:les\s+)?regidor(?:a|e)?s)?\s*(?:assistents?|presents?)?\s*/gi,
  /\b\d+\s+regidor(?:s|a|es)?(?:\s*\/\s*(?:regidor)?(?:a|es|s)?)?\s*(?:assistents?|presents?)?\s*/gi,
  /\b(?:de(?:l|ls)?\s+|els\s+|les\s+)?membres?\s+(?:electes\s+)?(?:de\s+la\s+corporaci(?:ó|o)\s+)?(?:de(?:l|ls)?\s+|d[’']\s*)?/gi,
  /\b(?:de\s+)?(?:l[’'])?assistents?\b/gi,
  /\bgrups?\s+municipals?\s*/gi,
  /\bde\s+la\s+corporaci(?:ó|o)\b/gi,
  /\bpresents?\b/gi,
  /\bGM\b\s*/g,
  // «21 vots corresponent als membres dels grups municipals de X»: la regla
  // ancorada de dalt no hi arriba perquè quan li toca el torn la frase encara
  // comença per una altra cosa, i sense aquesta el grup es desava com a
  // «corresponent als CUP Mataró».
  /\bcorresponents?\s+(?:als?|a\s+la|a)\s+/gi,
  // «l'abstenció de la resta de regidors dels grups municipals d'ENDAVANT SJ»:
  // «la resta» és una manera de dir «els altres», no part del nom del grup.
  /\b(?:la\s+)?resta\s+(?:de(?:l|ls)?\s+|d[’']\s*)?/gi,
  // «…l'abstenció de Poble Actiu del total de 21 regidors»: el que ve després
  // de «del total de» és la mida del ple, no part del nom del grup.
  /\bde(?:l)?\s+total\s+d[e’'].*$/i,
];

/**
 * Un tros de llista que en realitat és un nom de persona. Les actes que fan
 * crida nominal (Sabadell, Lleida, Reus, Banyoles) llisten regidors, no grups, i
 * si no es filtren acabem amb «Miquel Noguer Planas» com si fos un partit.
 */
const SEMBLA_PERSONA =
  /^(?:sr|sra|sres|srs|senyor|senyora|senyors|senyores)\b|^(?:el|la|les|els)\s+senyor|\b(?:regidor|regidora|alcalde|alcaldessa)\b/i;

/**
 * Beneficiaris jurídics, no grups municipals. A Ripollet un punt que adjudica
 * una obra diu «…a favor de l'empresa FEU I GODOY», i la lectura de prosa sense
 * xifres ho publicava com si l'empresa hagués votat a favor. «A favor de» hi vol
 * dir «en benefici de»: és l'única accepció de la frase que no és un vot, i és
 * prou freqüent (adjudicacions, cessions, bonificacions) per barrar-la a mà.
 */
const NO_ES_UN_GRUP =
  /^(?:(?:l[’']|la\s+|el\s+|els\s+|les\s+)?(?:empresa|societat|mercantil|entitat|fundaci|associaci|companyia|ajuntament|generalitat|diputaci|consorci|consell|àrea\s+metropolitana|junta\s+de\s+govern|comissi|titular|tipologia))\b/i;

/**
 * Referències normatives i identificadors fiscals que la partició deixava anar
 * («CIF núm. P0800258F», «l'art. 114.1 del Decret legislatiu»). Cap grup
 * municipal no es diu així, i tots dos casos surten d'actes reals.
 */
const REFERENCIA_LEGAL = /\b(?:núm|n[uú]m\.|nº|art|apartat|CIF|NIF|DNI|decret|llei|reial|expedient|exp)\b\.?/i;

/**
 * Paraules soltes que la partició de llistes deixa caure i que semblen sigles
 * però no ho són. Totes surten d'extraccions reals que publicaven un vot: a
 * Ripollet «***** URGÈNCIA» amb tres abstencions, al Prat «S'abstenen» amb vuit
 * vots en contra, a Vila-seca «Absents» amb una abstenció.
 */
const PARAULA_NO_GRUP = new Set([
  "urgencia", "urgencies", "absent", "absents", "assistents", "precs", "preguntes",
  "votacio", "votacions", "resultat", "resultats", "acord", "acords", "esmena", "esmenes",
  "cap", "ningu", "abstencio", "abstencions", "unanimitat", "majoria", "dictamen",
  "proposta", "mocio", "punt", "expedient", "total", "sabstenen", "sabste",
  // Formes jurídiques que queden soltes quan la llista parteix el nom d'una
  // empresa per la coma: «BANCO SANTANDER, SA», «RGB MUSIC, SL».
  "sa", "sl", "slu", "sau", "sccl", "sam", "cif", "nif",
]);

/**
 * Paraules que només surten en noms de candidatura. Són l'escapatòria del filtre
 * de persones: «Sitges Grup Independent» té la mateixa forma que «Elena López
 * Luján» —tres mots amb majúscula inicial— i sense aquesta llista es perdria.
 */
const VOCABULARI_DE_GRUP =
  /\b(?:grup|junts|esquerra|partit|candidatura|com[uú]|comuns|podem|independent|independents|municipal|municipalista|movem|guanyem|ara|sumem|som|compromís|alternativa|popular|socialista|socialistes|progrés|ciutadans|verds|units|acord|vox|activem|endavant|capgirem|decidim|avancem|prim[àa]ries|reagrupament|unitat|poble|gent|per|del?|en|la|el|els|les|i|d)\b/i;

/**
 * Els noms de grup tenen sigles, connectors o vocabulari de partit; els noms de
 * regidor són tres mots amb majúscula inicial i res més. Les actes que fan crida
 * nominal (Mollet, Badalona, Vilassar) llisten persones dins del mateix bloc que
 * les que llisten grups, i sense aquest filtre publicaríem «Elena López Luján»
 * com si fos un partit.
 */
export function semblaGrup(nom: string): boolean {
  if (nom.length < 2 || nom.length > 60) return false;
  if (SEMBLA_PERSONA.test(nom)) return false;
  if (NO_ES_UN_GRUP.test(nom)) return false;
  if (REFERENCIA_LEGAL.test(nom)) return false;
  if (PARAULA_NO_GRUP.has(sensAccents(nom).replace(/[^a-z]/g, ""))) return false;
  // Ha de començar per lletra: «***** URGÈNCIA», «-VOX», «]PP» són restes de la
  // partició, no noms. Els parèntesis els desembolcalla `netejaNomGrup`.
  if (!/^[A-Za-zÀ-úÇ(]/.test(nom)) return false;
  // Un tros de tres lletres o menys només és una sigla si va en majúscules:
  // «PP» i «CUP» sí, «Jav», «Car» i «Gl» són noms de pila tallats a mitges per
  // una línia partida, i publicar-los com a partit és inventar-se un grup.
  // L'excepció són els partits que el vocabulari coneix i que s'escriuen en
  // caixa mixta, com «Vox».
  if (nom.length <= 3 && nom !== nom.toUpperCase() && !VOCABULARI_DE_GRUP.test(nom)) return false;
  // Trossos de prosa que s'esmunyien com si fossin partits i acabaven a la
  // fitxa amb un sentit de vot al costat: «Resultat: s'aprova per unanimitat»
  // votant en abstenció, o «S'aprova el dictamen» amb nou vots en contra.
  if (nom.includes(":")) return false;
  // Una coma vol dir que hi ha quedat més d'un grup dins del mateix nom
  // («ERC-AM, JxS-CM i IPS-CUP», Salt): val més no publicar-ho que publicar un
  // partit inexistent amb el nom de tres.
  if (nom.includes(",")) return false;
  // Un punt seguit de text vol dir que hi hem enganxat la frase següent
  // («Olària. Total», «CUP... Per tant»). A Mollet això publicava el cognom de
  // l'última regidora d'una crida nominal com si fos un grup abstingut.
  if (/[.;]\s+\S/.test(nom)) return false;
  // Lletres soltes: a Lleida les columnes del marge deixen caure caràcters
  // orfes davant del nom («C O ERC-AM», «D PP»).
  if (/(?:^|\s)[A-ZÀ-ÚÇa-z](?:\s|$)/.test(nom.replace(/\b[iy]\b/g, ""))) return false;
  if (nom.split(/\s+/).length > 5) return false;
  if (VOCABULARI_DE_VOT.test(nom) || RESULTAT_APROVAT.test(nom) || RESULTAT_REBUTJAT.test(nom)) return false;
  if (!/[A-ZÀ-ÚÇ]/.test(nom)) return false;
  // Tres o més paraules en minúscula seguides és prosa, no una sigla.
  if (/(?:\b[a-zà-ú]+\b\s+){3,}/.test(nom)) return false;
  // Un sol mot amb la inicial en majúscula i la resta en minúscula és un cognom
  // o un nom de departament, no una candidatura: «Dalfó», «Gavara», «Reixac»,
  // «Compres», «Intervenció», «Administració». Les sigles de partit van en
  // majúscules («VOX», «NMC», «PECP») i els noms d'una sola paraula que sí que
  // són partits —Junts, Esquerra, Guanyem, Movem— els salva el vocabulari.
  if (/^[A-ZÀ-ÚÇ][a-zà-úç·'’]+$/.test(nom) && !VOCABULARI_DE_GRUP.test(nom)) return false;
  const mots = nom.split(/\s+/);
  // La classe de lletres ha d'arribar fins a la ü i admetre el punt volat, o
  // «Raül Asensio Gonzàlez» i «Marcel·Lina Bosch Costa» s'escapen del filtre de
  // persones i acaben publicats com si fossin partits.
  const totMajusculaInicial = mots.every((mot) =>
    /^[A-ZÀ-ÚÇ][a-zà-ÿç'’]{2,}(?:·[A-ZÀ-ÚÇ]?[a-zà-ÿç'’]+)*$/.test(mot),
  );
  if (mots.length >= 3 && totMajusculaInicial && !VOCABULARI_DE_GRUP.test(nom)) return false;
  return true;
}

const netejaNomGrup = (nom: string): string => {
  let net = nom
    // Glifs de la zona d'ús privat: els pics de llista de Wingdings arriben com
    // a U+F0D8 i s'enganxen al nom («VOX \uF0D8»).
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ue000-\uf8ff\ufffd]/g, " ")
    // «(sra. Sabater)», «(srs./sres. García, Agüera…)»: qui són els regidors del
    // grup, no el nom del grup.
    .replace(/\(\s*(?:sr|sra|srs|sres|senyor|senyora)[^)]*\)/gi, " ")
    .replace(/^[\s,;:.·•*\-–—]+|[\s,;:.·•*\-–—]+$/g, "")
    // Restes de la frase que s'arrosseguen quan el sentit ve en prosa:
    // «i 7 abstencions dels d'ERC», «grups de PSC-CP», «amb 1 abstenció de VOX».
    .replace(
      // El `grups?` demana que darrere hi vingui «municipal» o una preposició:
      // sense la condició, el grup de Blanes que es diu literalment «GRUP
      // BLANES» es desava com a «BLANES», que és una altra cosa.
      /^(?:(?:i|amb|amb\s+el|amb\s+els)\s+)?(?:\d+\s+)?(?:vots?\s+|abstenci(?:ó|ons)\s+|favorables?\s+|contraris?\s+)*(?:(?:a\s+favor|en\s+contra|en\s+blanc)\s+)?(?:grups?\s+(?=municipals?\b|de\b|del\b|dels\b|d[’']))?(?:municipals?\s+)?(?:de(?:l|ls)?\s+|d[’']\s*)*/i,
      "",
    )
    .replace(/^(?:de(?:l|ls)?|d[’']|la|les|el|els)\s+/i, "")
    // Banyoles encapçala cada grup amb «GM». Es treu aquí i no només al partidor
    // de llistes perquè, si no, «GM ERC-SomB» i «ERC-SomB» compten com a dos.
    .replace(/^GM[\s.]+/, "")
    // Amb `-layout` el guionet d'una sigla es queda a final de línia i el tros
    // següent baixa a la línia de sota: «ARA VIC-\n PL», «SF- ECP», «PSC- CP».
    // Sense tornar-los a ajuntar, el mateix grup compta com a dos.
    .replace(/([A-Za-zÀ-ÿÇ0-9])-\s+(?=[A-Za-zÀ-ÿÇ0-9])/g, "$1-")
    // A Lleida el marge deixa caure lletres soltes just davant del nom («C O
    // ERC-AM», «D PP», «'A P PSC-UNITS-CP»). Es treuen aquí perquè el grup és
    // correcte i només li sobra la brossa del davant.
    .replace(/^(?:[’'"]?[A-ZÀ-ÚÇ][\s.]+){1,3}(?=[A-ZÀ-ÚÇ][A-Za-zÀ-ÿÇ0-9])/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  // «9 (PSC-CP)» (Rubí) deixa el nom sencer dins d'un parèntesi.
  const embolcallat = net.match(/^[([](.+)[)\]]$/);
  if (embolcallat && !/[([]/.test(embolcallat[1]!)) net = embolcallat[1]!.trim();
  // Parèntesis desaparellats que ha deixat la partició de la llista. Els
  // claudàtors hi són perquè Santa Coloma de Gramenet hi tanca els grups
  // («21 vots a favor [PSC i C’S]») i la partició deixava «[PSC» i «C’S]».
  if (net.includes(")") && !net.includes("(")) net = net.replace(/\)/g, "").trim();
  if (net.includes("(") && !net.includes(")")) net = net.replace(/\(/g, "").trim();
  if (net.includes("]") && !net.includes("[")) net = net.replace(/\]/g, "").trim();
  if (net.includes("[") && !net.includes("]")) net = net.replace(/\[/g, "").trim();
  net = net.replace(/\s+\d{1,3}$/, "");
  // Connectors penjats al final («Partit dels Socialistes de», «PP i»): són
  // restes de la frase, i el nom que en queda ja és el bo.
  let anterior = "";
  while (anterior !== net) {
    anterior = net;
    net = net.replace(/\s+(?:de(?:l|ls)?|d[’']|i|amb|a|en|per|la|el|els|les)$/i, "").trim();
  }
  return net.replace(/^[\s,;:.·•*\-–—]+|[\s,;:.·•*\-–—]+$/g, "");
};

/**
 * Parteix una llista respectant els parèntesis. Sense això, «Badalona en Comú
 * Podem (sres. Llauradó i Trenado)» es parteix per la «i» de dins del parèntesi
 * i el grup es converteix en dos noms de regidora.
 */
export function parteixLlista(text: string): string[] {
  const trossos: string[] = [];
  let actual = "";
  let profunditat = 0;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]!;
    if (c === "(" || c === "[") profunditat += 1;
    if (c === ")" || c === "]") profunditat = Math.max(0, profunditat - 1);
    if (profunditat === 0) {
      if (c === "," || c === ";") {
        trossos.push(actual);
        actual = "";
        continue;
      }
      if ((c === "i" || c === "y") && /\s$/.test(actual) && /^\s/.test(text.slice(i + 1))) {
        trossos.push(actual);
        actual = "";
        continue;
      }
    }
    actual += c;
  }
  trossos.push(actual);
  return trossos.map((t) => t.trim()).filter(Boolean);
}

// ─────────────────────────────────────────────────────────────────────────────
// Crida nominal: la forma que més vots falsos publicava
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Les fórmules de tractament amb què les actes obren la llista de regidors d'un
 * grup: «senyors/a», «Senyora/or», «Sr.», «Sres.».
 */
const TRACTAMENT_RE =
  /(?:^|[\s,])(?:sr|sra|srs|sres|senyor|senyora|senyors|senyores)\.?(?:\s*\/\s*[a-zà-úç]{1,3}\.?)*\s*,?\s+/gi;

/**
 * On comença un grup dins d'una crida nominal. El lookbehind no és cosmètic:
 * «del grup municipal de VOX» **no** obre una llista de regidors, i sense
 * excloure'l el partidor s'engegava enmig d'una frase corrent.
 */
const INTRODUCTOR_DE_GRUP =
  /(?<![\wàèéíòóúïüç’'])(?<!\bde\s)(?<!\bdel\s)(?<!\bdels\s)(?<!\bd[’']\s?)(?:GM|[Gg]rups?\s+[Mm]unicipals?|GRUPS?\s+MUNICIPALS?|[Rr]egidor(?:a)?\s+[Nn]o\s+[Aa]dscrit(?:a)?)\b/g;

/**
 * Parteix «PSC-CP Senyors/es, Maria Garcia, Jose García…» en el nom del grup i
 * la llista de regidors. El separador ha d'estar a fora de qualsevol parèntesi:
 * a Badalona el tractament va **dins** («Esquerra Republicana de Catalunya
 * (sr./sra. Montornès, Gàmez)») i allà el nom del grup és tot el que hi ha
 * abans del parèntesi, no abans del «sr.».
 */
function parteixGrupIRegidors(tros: string): { nom: string; membres: string } | null {
  const candidats: { index: number; llarg: number }[] = [];
  const dosPunts = tros.indexOf(":");
  if (dosPunts >= 0) candidats.push({ index: dosPunts, llarg: 1 });
  TRACTAMENT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TRACTAMENT_RE.exec(tros)) !== null) candidats.push({ index: m.index, llarg: m[0].length });
  candidats.sort((a, b) => a.index - b.index);
  for (const { index, llarg } of candidats) {
    const abans = tros.slice(0, index);
    const obre = (abans.match(/[([]/g) ?? []).length;
    const tanca = (abans.match(/[)\]]/g) ?? []).length;
    if (obre > tanca) continue;
    return { nom: abans, membres: tros.slice(index + llarg) };
  }
  return null;
}

/**
 * Compta quants regidors hi ha en una enumeració de noms.
 *
 * La subtilesa és la «i»: a «Josep M. Teixidor Boadas i Ana Comalat Roca»
 * separa dues persones, però a «JORDI IBERN i TORTOSA» (el Prat) uneix els dos
 * cognoms d'una de sola. Els distingim perquè un cognom sol no fa un nom: si el
 * que ve després de la «i» té un sol mot, no és ningú nou.
 */
export function nomsDeRegidors(text: string): string[] {
  const fora: string[] = [];
  for (const part of text.split(/[,;]/)) {
    let resta = part.trim();
    for (;;) {
      const m = resta.match(/^(.*?\S)\s+i\s+(\S.*)$/);
      if (!m || m[2]!.trim().split(/\s+/).length < 2) break;
      fora.push(m[1]!.trim());
      resta = m[2]!.trim();
    }
    if (resta) fora.push(resta);
  }
  return fora
    .map((n) => n.replace(/[.\s]+$/, "").trim())
    .filter((n) => /^[A-ZÀ-ÚÇ]/.test(n) && n.split(/\s+/).length >= 2 && n.length <= 60);
}

/**
 * Crida nominal agrupada: **el patró que més vots falsos publicava de tot el
 * corpus.** Cornellà, Sant Joan Despí, el Prat i Banyoles escriuen
 *
 *   Vots a favor:
 *   Grup Municipal de CECP-C, senyors/a Claudio Carmona, Sergio Gómez i Maria Martin.
 *   Grup Municipal del PSC-CP, senyors/es Antonio Balmón, Emilia Briones, …
 *
 * i el partidor de llistes genèric ho trossejava per les comes: el primer grup
 * s'extreia bé i tota la resta de la llista —vint noms de persona— s'atribuïa al
 * mateix sentit de vot, amb el grup següent enganxat al final d'un nom
 * («Maria Victoria Martin Herreros. d'ERC-EUiA-AM»). El resultat era que
 * ERC-EUiA-AM constava votant en contra en una votació on s'havia abstingut.
 *
 * Aquí el nom del grup surt de l'introductor i el recompte, de quants regidors
 * s'enumeren. Els regidors no adscrits també hi entren, perquè són vots que
 * compten i sense ells la suma no quadraria amb el total que diu l'acta.
 */
export function grupsNominals(cua: string): { grup: string; vots: number | null }[] | null {
  const net = cua.replace(/\s+/g, " ").trim();
  INTRODUCTOR_DE_GRUP.lastIndex = 0;
  const marques: { obre: number; despres: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = INTRODUCTOR_DE_GRUP.exec(net)) !== null) {
    marques.push({ obre: m.index, despres: m.index + m[0].length });
  }
  if (marques.length === 0) return null;

  const files: { grup: string; vots: number | null }[] = [];
  let cobert = 0;
  for (const [i, marca] of marques.entries()) {
    const fi = marques[i + 1]?.obre ?? net.length;
    const tros = net.slice(marca.despres, fi);
    const partit = parteixGrupIRegidors(tros);
    if (!partit) continue;
    const regidors = nomsDeRegidors(partit.membres);
    if (regidors.length === 0) continue;
    // «Grup municipal PP (5), senyor Xavier Palau, …» (Lleida): quan l'acta diu
    // ella mateixa quants són, la seva xifra mana sobre la que hem comptat.
    const declarat = partit.nom.match(/\(\s*(\d+)\s*\)[\s.,;:•·]*$/);
    // Sense nom de grup l'introductor era «Regidor no adscrit»: el vot existeix
    // i compta per a la suma, però no s'atribueix a cap partit.
    const nom = netejaNomGrup(declarat ? partit.nom.slice(0, declarat.index) : partit.nom)
      || "Regidor no adscrit";
    if (nom !== "Regidor no adscrit" && !semblaGrup(nom)) continue;
    const quants = declarat ? Number.parseInt(declarat[1]!, 10) : regidors.length;
    cobert += fi - marca.obre;
    const ja = files.find((f) => f.grup === nom);
    if (ja) ja.vots = (ja.vots ?? 0) + quants;
    else files.push({ grup: nom, vots: quants });
  }
  // Si els blocs de grup no cobreixen la cua, el text és una altra cosa amb un
  // «grup municipal» a dins i val més deixar-ho al partidor genèric.
  if (files.length === 0 || cobert / net.length < 0.5) return null;
  return files;
}

/**
 * Crida nominal amb la sigla al costat de cada regidor, que és com escriu Vic:
 *
 *   VOTS A FAVOR, 13: Albert Castells (JxVIC), Bet Piella (JxVIC), … i Arnau Martí (VECP)
 *
 * El codi anterior en treia les sigles correctes però assignava **el total de la
 * votació al primer grup** («JxVIC, 16 vots») i deixava la resta sense xifra: un
 * número fals al costat d'un partit real. Aquí es compta quants regidors porta
 * cada sigla, que és el que diu l'acta.
 */
const REGIDOR_AMB_SIGLA =
  /([A-ZÀ-ÚÇ][A-Za-zÀ-úÇ.'’·]*(?:\s+[A-ZÀ-ÚÇ][A-Za-zÀ-úÇ.'’·]*)+)\s*\(\s*([^()]{1,25}?)\s*\)/g;

export function grupsPerRegidor(cua: string): { grup: string; vots: number | null }[] | null {
  const net = cua.replace(/\s+/g, " ").trim();
  REGIDOR_AMB_SIGLA.lastIndex = 0;
  const compte = new Map<string, number>();
  let cobert = 0;
  let trobats = 0;
  let m: RegExpExecArray | null;
  while ((m = REGIDOR_AMB_SIGLA.exec(net)) !== null) {
    const sigla = netejaNomGrup(m[2]!);
    // Una sigla només de xifres és un recompte, no un grup: «Sitges Grup
    // Independent (3)» és l'altra família de formats i no s'ha de comptar aquí.
    if (!/[A-Za-zÀ-úÇ]/.test(sigla) || !semblaGrup(sigla)) continue;
    trobats += 1;
    cobert += m[0].length;
    compte.set(sigla, (compte.get(sigla) ?? 0) + 1);
  }
  if (trobats < 3 || cobert / net.length < 0.5) return null;
  return [...compte].map(([grup, vots]) => ({ grup, vots }));
}

/**
 * El desglossament d'una cua de votació, amb la procedència del recompte.
 */
export type Desglossament = {
  files: { grup: string; vots: number | null }[];
  /**
   * Els vots no els diu l'acta: els hem comptat nosaltres (quants regidors
   * s'enumeren). Un número deduït s'ha de poder contrastar amb el total abans de
   * publicar-lo; un número transcrit, no.
   */
  deduit: boolean;
};

export function desglossaCua(cua: string): Desglossament {
  const nominals = grupsNominals(cua);
  if (nominals) return { files: nominals, deduit: true };
  const perRegidor = grupsPerRegidor(cua);
  if (perRegidor) return { files: perRegidor, deduit: true };
  return { files: llistaDeGrups(cua), deduit: false };
}

/**
 * Converteix la cua d'una etiqueta de votació en files (grup, vots).
 *
 * Ha de menjar-se totes aquestes formes, totes trobades a actes reals:
 *
 *   «(8 JUNTS, 3 ERC i 1 ACTIVEM)»            → Olot
 *   «6 NMC, 2 PSC, 2 PP, 2 VOX, 3 JxC (19)»   → Cambrils
 *   «PSC, ERC, JPB, PP, GRUP BLANES i la CUP» → Blanes (sense xifres)
 *   «JxCAT (7), ERC (4), PSC (3) i AGM (2)»   → Manlleu
 *   «7 de Sumem per Salou-PSC i 4 d'ERC-AM»   → Salou
 *   «Junts per les Franqueses (JxLF) (7)»     → les Franqueses
 */
export function separaGrups(cua: string): { grup: string; vots: number | null }[] {
  return desglossaCua(cua).files;
}

function llistaDeGrups(cua: string): { grup: string; vots: number | null }[] {
  let net = cua.replace(/\s+/g, " ").trim();
  // «GM Junts Banyoles-CM: Miquel Noguer, Jordi Congost…» — el grup és el que hi
  // ha abans dels dos punts i el recompte, quants noms hi ha després.
  const nominal = net.match(/^([^:]{2,50}):\s*(.+)$/);
  if (nominal && SEMBLA_PERSONA.test(nominal[2]!.slice(0, 30)) === false && /,| i /.test(nominal[2]!)) {
    const nom = netejaNomGrup(nominal[1]!);
    if (semblaGrup(nom)) {
      const quants = nominal[2]!.split(/,| i /).filter((x) => x.trim().length > 3).length;
      return [{ grup: nom, vots: quants > 0 ? quants : null }];
    }
  }

  for (const soroll of SOROLL_DE_GRUP) net = net.replace(soroll, " ");
  // «21 vots a favor [PSC i C’S]» (Santa Coloma): el claudàtor tanca la llista
  // sencera, no un grup, i si no s'obre abans de partir-la els dos partits es
  // desen com un de sol que es diria «PSC i C’S».
  net = net.replace(/\[([^[\]]{1,200})\]/g, "$1");
  net = net.replace(/\s{2,}/g, " ").trim();

  // Si tota la cua és un parèntesi, el parèntesi ÉS la llista de grups
  // («4 abstencions (1VOX, 1Primer El Vendrell, 1Fem Vendrell)»). Els claudàtors
  // fan el mateix paper a Santa Coloma: «21 vots a favor [PSC i C’S]».
  const embolcallat = net.match(/^[([](.+)[)\]][\s,.;]*$/s);
  if (embolcallat && !/[([]/.test(embolcallat[1]!)) net = embolcallat[1]!;
  const trossos = parteixLlista(net);

  const files: { grup: string; vots: number | null }[] = [];
  for (const tros of trossos) {
    // Recompte al davant: «8 JUNTS», «7 de Sumem per Salou-PSC», «tres d'ERC».
    // El Vendrell enganxa la xifra al nom, sense espai: «1VOX, 1Fem Vendrell».
    let vots: number | null = null;
    let nom = tros;
    const davant = tros.match(
      /^[([]?\s*(\d+|[a-zà-úï·]+)\s*[)\]]?\s+(?:de(?:l|ls)?\s+|d[’']\s*)?(.+)$/i,
    ) ?? tros.match(/^[([]?\s*(\d{1,2})([A-ZÀ-ÚÇ].+)$/);
    if (davant) {
      const n = aNombre(davant[1]!);
      if (n !== null) {
        vots = n;
        nom = davant[2]!;
      }
    }
    // Recompte al darrere: «JxCAT (7)», «Junts per les Franqueses (JxLF) (7)».
    // El punt final hi és perquè a Sitges la llista acaba amb «i Guanyem (1).».
    const darrere = nom.match(/^(.*?)\s*\(\s*(\d+)\s*\)[\s.,;:•·*\-–—]*$/);
    if (darrere) {
      const n = aNombre(darrere[2]!);
      if (n !== null) {
        vots = vots ?? n;
        nom = darrere[1]!;
      }
    }
    // «Junts per les Franqueses (JxLF)» → ens quedem amb la sigla, més estable.
    const sigla = nom.match(/^(.{4,50}?)\s*\(([A-ZÀ-Ú0-9][^)]{1,25})\)\s*$/);
    if (sigla) nom = sigla[2]!;

    nom = netejaNomGrup(nom);
    if (!semblaGrup(nom)) continue;
    files.push({ grup: nom, vots });
  }

  // Una llista llarga de cognoms solts és una crida nominal, no un
  // desglossament per grup: a Mollet «Dionisio, Broto, Pérez, Escribano…» són
  // vint-i-quatre regidors. Val més no publicar-ne res que publicar-ho malament.
  const solts = files.filter(
    (f) => /^[A-ZÀ-ÚÇ][a-zà-úç·'’]+$/.test(f.grup) && !VOCABULARI_DE_GRUP.test(f.grup),
  ).length;
  if (files.length >= 6 && solts / files.length >= 0.7) return [];

  return files;
}

/**
 * Etiquetes de votació ancorades a inici de línia o després d'un connector de
 * frase. Cobreix «Vots a favor: 11 (TSF i GS)», «A FAVOR: 6 NMC (19)»,
 * «Vots a favor (14)» i «VOTS A FAVOR, 18: JxVIC, ERC-AM».
 */
const BLOC_ETIQUETA =
  /(?:^|\n)[ \t]*[-•·*]?[ \t]*(vots?\s+(?:a\s+)?favor|a\s+favor|vots?\s+favorables?|vots?\s+en\s+contra|en\s+contra|vots?\s+contraris?|abstencions?|abstenci(?:ó|o)|s[’']absten(?:en|ci(?:ó|o))?|vots?\s+en\s+blanc|en\s+blanc|absents?)[ \t]*[,:]?[ \t]*(\(?[ \t]*\d+[ \t]*\)?)?[ \t]*[,:]?[ \t]*/gi;

/**
 * On s'acaba la llista de grups d'un sentit i comença la del següent. A Sant
 * Just Desvern l'acta ho encadena dins de la mateixa frase —«amb els vots a
 * favor de PSC, SJECP-C, ERC, PP i CUP-AMUNT, amb l'abstenció de la resta de
 * regidores i regidors dels grups municipals d'ENDAVANT SJ, JUNTSxCAT i VOX»—
 * i sense tallar-hi els tres grups que s'abstenien constaven votant a favor.
 */
const SENTIT_ENCADENAT =
  /,?\s+(?:i\s+)?(?:amb\s+(?:els?\s+)?)?(?:l[’']abstenci(?:ó|o)|les\s+abstenci|abstenci(?:ó|ons)|(?:els?\s+)?vots?\s+(?:en\s+contra|contraris?|a\s+favor|favorables?)|el\s+vot\s+contrari|en\s+contra)(?![a-zà-ÿ])/i;

/**
 * La cua d'una etiqueta no s'acaba a final de línia. A Sitges la llista de grups
 * ocupa tres línies i a Banyoles hi ha una línia en blanc entre l'etiqueta i els
 * noms; si tallem al primer salt de línia perdem el desglossament sencer. Talla
 * a l'etiqueta següent, a un buit de dues línies o als 600 caràcters.
 */
function cuaDEtiqueta(cru: string, limit: number): string {
  let cua = cru.slice(0, limit);
  // La llista s'acaba a la primera línia en blanc **si el que ve després no és
  // un altre grup**. Amb el tall incondicional es perdien els grups segon i
  // següents de Cornellà, que van separats per una línia buida; sense cap tall,
  // a Cambrils la cua es menjava el paràgraf següent i en treia «Compres» —de
  // «Comissió Informativa d'Hisenda, Compres i Contractació»— com si fos un
  // grup que s'havia abstingut.
  let pos = cua.match(/^\s*/)![0].length;
  for (;;) {
    const relatiu = cua.slice(pos).search(/\n[ \t]*\n/);
    if (relatiu < 0) break;
    const tall = pos + relatiu;
    const resta = cua.slice(tall).replace(/^\s+/, "");
    if (!/^(?:GM\b|Grups?\s+[Mm]unicipals?\b|GRUPS?\s+MUNICIPALS?\b|[Rr]egidor)/.test(resta)) {
      cua = cua.slice(0, tall);
      break;
    }
    pos = cua.length - resta.length;
  }
  // Les etiquetes no sempre comencen línia («…CUP-AMUNT) Vots en contra: 0»), i
  // si no hi tallem el sentit següent s'endú els grups del sentit anterior.
  const seguent = cua.search(ETIQUETA_ENMIG);
  // `>= 0` i no `> 0`: quan l'etiqueta següent comença just al principi de
  // la cua, no tallar-la feia que un bloc s'endugués el del costat.
  if (seguent >= 0) cua = cua.slice(0, seguent);
  const encadenat = cua.search(/\bi\s+(?:amb\s+)?\d+\s+(?:vots?|abstenci|en\s+blanc)/i);
  if (encadenat > 0) cua = cua.slice(0, encadenat);
  // El punt següent de l'ordre del dia comença just després del bloc de vot i
  // sense línia en blanc pel mig: «…Del grup del PP. 17.- Precs i preguntes». Si
  // no s'hi talla, «PP. 17.- Precs» acaba desat com si fos el nom d'un grup.
  const puntSeguent = cua.search(/\.\s*\d{1,2}\s*\.?\s*-\s*[A-ZÀ-ÚÇ]/);
  if (puntSeguent > 0) cua = cua.slice(0, puntSeguent);
  const altreSentit = cua.search(SENTIT_ENCADENAT);
  if (altreSentit > 0) cua = cua.slice(0, altreSentit);
  return cua;
}

/** La mateixa llista d'etiquetes, per tallar-hi la cua allà on aparegui. */
const ETIQUETA_ENMIG =
  /(?:vots?\s+(?:a\s+)?favor|vots?\s+favorables?|vots?\s+en\s+contra|vots?\s+contraris?|en\s+contra|abstencions?|abstenci(?:ó|o)|s[’']absten(?:en|ci(?:ó|o))?|vots?\s+en\s+blanc|absents?)\s*[,:]?\s*\d|(?:vots?\s+en\s+contra|abstencions?|s[’']abstenen|en\s+blanc)\s*[,:]/i;

/**
 * La taula de distribució de Barberà del Vallès, una fila per grup:
 *
 *   Nom del grup                      Vots i tipologia
 *   Grup Municipal PSC-CP             7 vots a favor
 *   Grup Municipal VOX                1 abstenció
 *
 * És el format més explícit del corpus —grup, xifra i sentit a la mateixa
 * línia— i el que pitjor sortia: les etiquetes soltes en treien «tipologia
 * PSC-CP» amb una abstenció, que barreja el títol de la columna amb el nom del
 * grup i li penja un sentit que no és el seu.
 */
const TAULA_DE_GRUPS =
  /(?:^|\n)[ \t]*(?:Grups?\s+[Mm]unicipals?|GRUPS?\s+MUNICIPALS?|GM)[ \t]+(\S[^\n]{1,60}?)[ \t]{2,}(\d+|[a-zà-úï·\-]+)[ \t]+(vots?\s+(?:a\s+)?favor|vots?\s+favorables?|vots?\s+en\s+contra|vots?\s+contraris?|abstenci(?:ó|ons)|vots?\s+en\s+blanc)[ \t]*(?=\n|$)/gi;

/**
 * Prosa: «s'aprova amb 13 vots a favor (8 JUNTS, 3 ERC…), 4 vots en contra (4
 * PSC) i 4 abstencions (4 CUP)». És la forma majoritària al tram de 20.000 a
 * 100.000 habitants.
 */
const PROSA_SENTIT =
  /(\d+|[a-zà-úï·\-]+)\s+(?:vots?\s+)?(a\s+favor|en\s+contra|favorables?|contraris?|abstencions?|abstenci(?:ó|o)|en\s+blanc)\b[ \t]*:?[ \t]*((?:\([^)]{0,300}\))|(?:\[[^\]]{0,300}\])|(?:\s*(?:de(?:l|ls)?|d[’'])\s+[^.;\n]{0,220}))?/gi;

/**
 * Blanes i altres escriuen només els grups, sense cap xifra: «amb els vots a
 * favor de PSC, ERC, JPB, PP i amb l'abstenció de BECP». És informació de vot de
 * ple dret, encara que no digui quants regidors són.
 */
const PROSA_SENSE_XIFRA =
  /(?:amb\s+)?(?:els?\s+)?(?:vots?\s+)?(a\s+favor|en\s+contra|l[’']abstenci(?:ó|o)|abstenci(?:ó|o)|el\s+vot\s+contrari)\s+(?:de(?:l|ls)?|d[’'])\s+([^.;]{2,220}?)(?=\s*(?:\.|;|\n[ \t]*\n|,?\s*(?:i\s+)?amb\b|$))/gi;

/**
 * El recompte agregat d'esPublico Gestiona, en una sola línia i amb els quatre
 * sentits: «A favor: 17, En contra: 2, Abstencions: 2, Absents: 0». Les
 * etiquetes soltes només n'enganxaven la primera, perquè les altres tres no
 * comencen línia; llegit sencer és el millor control de qualitat del corpus.
 */
const RECOMPTE_AGREGAT =
  /A\s*favor\s*:\s*(\d+)\s*,\s*En\s*contra\s*:\s*(\d+)\s*,\s*Abstencions?\s*:\s*(\d+)(?:\s*,\s*Absents?\s*:\s*(\d+))?/i;

const RESULTAT_APROVAT =
  /s[’']?apro(?:va|ven|vat|vada)|queda\s+aprova|és\s+aprovad|resta\s+aprovad|resulta\s+aprovad|ACORDA|acorda\b|s[’']?admet|es\s+ratifica|RATIFICA|\bFavorable\b/i;
const RESULTAT_REBUTJAT =
  /es\s+rebutja|queda\s+rebutjad|és\s+rebutjad|es\s+desestima|s[’']?ha\s+desestimat|no\s+s[’']?aprova|queda\s+desestimad|\bDesfavorable\b|no\s+prospera/i;
const EMPAT = /hi\s+ha\s+empat|es\s+produeix\s+un\s+empat|empat\s+a\s+vots/i;
/**
 * El lookahead negatiu no és cosmètic: «aprovat per unanimitat atès el resultat
 * de la votació» introdueix un desglossament que **no** és unànime, i sense ell
 * s'etiqueten com a unànimes votacions dividides.
 */
const UNANIMITAT = /per\s+unanimitat(?!\s*at[eè]s\s+el\s+resultat)|Unanimitat\/Assentiment|per\s+assentiment/i;

/**
 * On comença un bloc de votació. Aquesta llista és la peça que sosté tot el
 * fitxer: el títol d'un punt es reconeix malament i el vot es reconeix bé, així
 * que ancorem aquí i pugem cap enrere fins al títol, i no a l'inrevés.
 */
const ANCORES: ReadonlyArray<RegExp> = [
  /Tipus\s+de\s+votaci(?:ó|o)/i,
  /(?:sotmes|sotmès|sotmesa|sotmeses|posat|posada|posats)[^.\n]{0,120}?vota(?:ció|cio|r)/i,
  /(?:^|\n)[ \t]*VOTACI(?:Ó|O)\b/i,
  /Resultat\s+(?:de\s+la\s+)?votaci(?:ó|o)/i,
  /La\s+votaci(?:ó|o)\s+d(?:ó|o)na/i,
  /(?:^|\n)[ \t]*Votaci(?:ó|o)[ \t]*$/im,
  /vots?\s+a\s+favor/i,
  /per\s+unanimitat/i,
  /Unanimitat\/Assentiment/i,
];

const citaDe = (text: string): string => text.replace(/\s+/g, " ").trim().slice(0, 600);

/**
 * Troba la finestra de text on es decideix el punt. Ancorem al bloc de votació
 * —que és fiable— i no al títol, tal com recomana la mesura empírica.
 */
function finestraDeVotacio(segment: string): string | null {
  let millor = -1;
  for (const ancora of ANCORES) {
    const m = segment.match(ancora);
    if (m && m.index !== undefined && (millor === -1 || m.index < millor)) millor = m.index;
  }
  if (millor === -1) return null;
  return segment.slice(millor, millor + 2500);
}

function recompteBuit(): Record<SentitVot, number | null> {
  return { favor: null, contra: null, abstencio: null, blanc: null, absent: null };
}

function afegeix(
  perGrup: VotGrup[],
  sentit: SentitVot,
  files: { grup: string; vots: number | null }[],
): void {
  for (const fila of files) {
    // El mateix grup pot sortir dues vegades si l'acta repeteix el bloc.
    if (perGrup.some((v) => v.grup === fila.grup && v.sentit === sentit)) continue;
    perGrup.push({ grup: fila.grup, sentit, vots: fila.vots });
  }
}

/**
 * Extreu la votació d'un segment de punt. Prova tres lectures en ordre de
 * precisió decreixent i s'atura a la primera que dona vot per grup; si cap no en
 * dona, encara pot retornar el resultat global, que ja val per si sol.
 */
export function extreuVotacio(segment: string): Votacio | null {
  const zona = finestraDeVotacio(segment);
  if (zona === null) return null;

  const recompte = recompteBuit();
  const perGrup: VotGrup[] = [];
  let patro = "cap";

  // Vot nominal d'esPublico: el sentit va en una columna a la dreta i
  // `pdftotext -layout` l'intercala enmig dels noms («…Juan Antonio  A favor
  // Ramírez Rubio, …»). Del text pla no se'n pot treure qui vota què —a
  // Vila-seca publicava «Ramírez Rubio» votant a favor i «Moya» en contra, dos
  // cognoms partits pel mig— i **preferim no dir res**: el recompte agregat que
  // ve just abans sí que és fiable i es llegeix igualment.
  const nominalEnColumnes = /Tipus\s+de\s+votaci(?:ó|o)\s*:?\s*Nominal/i.test(zona);

  // ── Lectura 0: la taula de distribució. Diu grup, xifra i sentit a la mateixa
  // línia, així que quan hi és no cal endevinar res i mana sobre les altres
  // lectures, que d'aquesta disposició en columnes només en treuen soroll.
  TAULA_DE_GRUPS.lastIndex = 0;
  const perTaula: VotGrup[] = [];
  for (let t = TAULA_DE_GRUPS.exec(zona); t !== null; t = TAULA_DE_GRUPS.exec(zona)) {
    const sentit = sentitDEtiqueta(t[3]!) ?? sentitDEtiqueta(`vots ${t[3]!}`);
    const nom = netejaNomGrup(t[1]!);
    const quants = aNombre(t[2]!);
    if (!sentit || quants === null || !semblaGrup(nom)) continue;
    if (perTaula.some((v) => v.grup === nom && v.sentit === sentit)) continue;
    perTaula.push({ grup: nom, sentit, vots: quants });
  }
  const hiHaTaula = perTaula.length >= 1;
  if (hiHaTaula) {
    perGrup.push(...perTaula);
    patro = "taula";
    for (const sentit of ["favor", "contra", "abstencio", "blanc"] as const) {
      const files = perTaula.filter((v) => v.sentit === sentit);
      if (files.length > 0) recompte[sentit] = files.reduce((suma, v) => suma + (v.vots ?? 0), 0);
    }
  }

  // ── Lectura 1: blocs etiquetats. El format més net i el més freqüent.
  BLOC_ETIQUETA.lastIndex = 0;
  const marques: { sentit: SentitVot; xifra: number | null; enParentesi: boolean; fi: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = BLOC_ETIQUETA.exec(zona)) !== null) {
    const sentit = sentitDEtiqueta(m[1]!);
    if (!sentit) continue;
    marques.push({
      sentit,
      xifra: aNombre(m[2]?.replace(/[()]/g, "")),
      enParentesi: (m[2] ?? "").includes("("),
      fi: m.index + m[0].length,
    });
  }
  for (const [i, marca] of marques.entries()) {
    const limit = Math.min((marques[i + 1]?.fi ?? zona.length) - marca.fi, 600);
    let cua = cuaDEtiqueta(zona.slice(marca.fi), Math.max(0, limit));
    let n = marca.xifra;

    // «A FAVOR: 6 NMC, 2 PSC…» (Cambrils): el 6 no és el total de la votació,
    // és el recompte del primer grup. Es distingeix perquè just després hi ha
    // una sigla i no un signe de puntuació ni un parèntesi.
    let xifraDelPrimerGrup = false;
    // «9 (PSC-CP), 2 (ECP)…» (Rubí): el parèntesi seguit de coma vol dir que
    // som dins d'una llista i que la xifra és d'aquest grup; «11 (TSF i GS)»,
    // sense coma al darrere, és el total de la votació.
    // Sense excloure-hi la coma, «12 vots a favor (ERC-AM, JxS-CM i IPS-CUP), 4
    // vots en contra…» (Salt) es llegia com una llista de grups amb recompte i
    // els tres partits acabaven desats com un de sol.
    const llistaEntreParentesis = /^\(\s*[^),;]{1,40}\)\s*[,;]/.test(cua.trimStart());
    if (
      n !== null &&
      !marca.enParentesi &&
      (/^[A-ZÀ-ÚÇ]/.test(cua.trimStart()) || llistaEntreParentesis)
    ) {
      cua = `${n} ${cua.trimStart()}`;
      n = null;
      xifraDelPrimerGrup = true;
    }

    // «Vots a favor: 3. Dels grups VOX i PP.» — aquí sí que la xifra és el total.
    const xifraCua = cua.match(/^\s*(\d+|[a-zà-úï·]+)\s*(?:\(\s*\d+\s*\))?\s*[.:,-]?\s*([\s\S]*)$/i);
    if (n === null && xifraCua && !xifraDelPrimerGrup && !/^[A-ZÀ-ÚÇ]/.test(cua.trimStart())) {
      const provat = aNombre(xifraCua[1]!);
      if (provat !== null) {
        n = provat;
        cua = xifraCua[2] ?? "";
      }
    }
    if (n === null && /^\s*(?:cap|ningú|ninguna|cap\.)/i.test(cua)) n = 0;

    const desglossament = cua.trim() ? desglossaCua(cua) : { files: [], deduit: false };
    let files = desglossament.files;
    // El total pot venir al final («… 4 ERC-AM (19)») o no venir gens, i llavors
    // el calculem sumant els grups. Sense total no es pot validar la suma, i
    // sense validar la suma no es detecta una extracció truncada.
    if (n === null) {
      const cloenda = cua.match(/\(\s*(\d+)\s*\)\s*$/);
      if (cloenda) n = Number.parseInt(cloenda[1]!, 10);
      else if (files.length > 0 && files.every((f) => f.vots !== null)) {
        n = files.reduce((suma, f) => suma + (f.vots ?? 0), 0);
      }
    }
    // Quan els vots no els diu l'acta sinó que els hem comptat —quants regidors
    // s'enumeren— han de quadrar amb el total que sí que hi diu. Si no quadren
    // ens hem menjat o ens hem inventat un nom, i llavors publiquem el grup i el
    // sentit, que sabem segurs, però no la xifra.
    if (desglossament.deduit && n !== null) {
      const suma = files.reduce((total, f) => total + (f.vots ?? 0), 0);
      if (suma !== n) files = files.map((f) => ({ grup: f.grup, vots: null }));
    }
    // Zero vots vol dir zero grups. Sembla obvi i no ho era: darrere d'un
    // «Abstencions: 0» hi ha el text del punt següent, i el partidor n'agafava
    // el que li semblés («Intervenció», «Comptabilitat») i ho publicava com un
    // grup que s'hauria abstingut en una votació sense cap abstenció.
    if (n === 0) files = [];
    if (n !== null && recompte[marca.sentit] === null) recompte[marca.sentit] = n;
    if (files.length && !nominalEnColumnes && !hiHaTaula) afegeix(perGrup, marca.sentit, files);
  }
  const etiquetes = marques.length;
  if (perGrup.length > 0 && patro === "cap") patro = "etiquetes";

  const agregat = hiHaTaula ? null : zona.match(RECOMPTE_AGREGAT);
  if (agregat) {
    recompte.favor = Number.parseInt(agregat[1]!, 10);
    recompte.contra = Number.parseInt(agregat[2]!, 10);
    recompte.abstencio = Number.parseInt(agregat[3]!, 10);
    if (agregat[4] !== undefined) recompte.absent = Number.parseInt(agregat[4], 10);
  }

  // ── Lectura 2: prosa amb recompte i grups entre parèntesis.
  if (perGrup.length === 0 || etiquetes < 2) {
    PROSA_SENTIT.lastIndex = 0;
    while ((m = PROSA_SENTIT.exec(zona)) !== null) {
      const n = aNombre(m[1]!);
      if (n === null) continue;
      const sentit = sentitDEtiqueta(m[2]!) ?? sentitDEtiqueta(`vots ${m[2]!}`);
      if (!sentit) continue;
      if (recompte[sentit] === null) recompte[sentit] = n;
      let cua = (m[3] ?? "").replace(/^\s*[([]/, "").replace(/[)\]]\s*$/, "");
      // La prosa encadena sentits («…13 vots a favor del PSC i 1 abstenció de
      // VOX»): si no hi tallem, VOX queda registrat com a vot a favor.
      const talla = cua.search(ETIQUETA_ENMIG);
      if (talla > 0) cua = cua.slice(0, talla);
      const encadenat = cua.search(/\bi\s+(?:amb\s+)?\d+\s+(?:vots?|abstenci|en\s+blanc)/i);
      if (encadenat > 0) cua = cua.slice(0, encadenat);
      const altreSentit = cua.search(SENTIT_ENCADENAT);
      if (altreSentit > 0) cua = cua.slice(0, altreSentit);
      if (cua.trim() && !nominalEnColumnes && !hiHaTaula) afegeix(perGrup, sentit, separaGrups(cua));
    }
    if (perGrup.length > 0 && patro === "cap") patro = "prosa";
  }

  // ── Lectura 3: prosa sense xifres, només noms de grup. Serveix tant quan no
  // hi ha hagut sort com quan l'acta encadena els sentits en una sola frase i
  // les etiquetes només n'han enganxat el primer.
  if (perGrup.length === 0 || etiquetes < 2) {
    PROSA_SENSE_XIFRA.lastIndex = 0;
    while ((m = PROSA_SENSE_XIFRA.exec(zona)) !== null) {
      const brut = m[1]!.toLowerCase();
      const sentit: SentitVot = brut.includes("contra")
        ? "contra"
        : brut.includes("abstenci")
          ? "abstencio"
          : "favor";
      let llista = m[2]!;
      const encadenat = llista.search(SENTIT_ENCADENAT);
      if (encadenat > 0) llista = llista.slice(0, encadenat);
      // Un grup que ja consta amb un altre sentit no se sobreescriu: si les dues
      // lectures no diuen el mateix, la que ha vist la xifra mana i aquesta
      // calla. Val més quedar-nos curts que contradir-nos.
      const files = separaGrups(llista).filter(
        (f) => !perGrup.some((v) => v.grup === f.grup && v.sentit !== sentit),
      );
      if (!nominalEnColumnes && !hiHaTaula) afegeix(perGrup, sentit, files);
    }
    if (perGrup.length > 0) patro = "prosa-sense-xifra";
  }

  // `every` sobre una llista buida és cert, i el recompte no s'hi mirava: un
  // punt amb dotze vots a favor i nou en contra sortia com a unànime només
  // perquè la paraula «unanimitat» apareixia en algun lloc de la finestra.
  const unanimitat =
    UNANIMITAT.test(zona) &&
    !recompte.contra &&
    !recompte.abstencio &&
    !recompte.blanc &&
    !perGrup.some((v) => v.sentit !== "favor");
  let resultat: ResultatVotacio = "desconegut";
  if (EMPAT.test(zona)) resultat = "empat";
  else if (RESULTAT_REBUTJAT.test(zona)) resultat = "rebutjat";
  else if (RESULTAT_APROVAT.test(zona) || unanimitat) resultat = "aprovat";
  // Si el recompte desglossa i hi ha més contraris que favorables, el text
  // narratiu no mana: a Sant Julià un punt votat 3-1-0 tanca amb «per unanimitat».
  if (recompte.favor !== null && recompte.contra !== null && recompte.contra > recompte.favor) {
    resultat = "rebutjat";
  }

  const hiHaRecompte = Object.values(recompte).some((n) => n !== null);
  // Un recompte llegit ja és una votació encara que la narració no digui com
  // acaba: «Vots a favor: 21. Vots en contra: cap» és informació, i abans es
  // llençava sencera perquè el text no contenia cap fórmula d'aprovació.
  if (resultat === "desconegut" && perGrup.length === 0 && !unanimitat && !hiHaRecompte) return null;
  if (patro === "cap") patro = unanimitat ? "unanimitat" : "resultat-global";

  return { resultat, unanimitat, recompte, perGrup, cita: citaDe(zona.slice(0, 900)), patro };
}

// ─────────────────────────────────────────────────────────────────────────────
// Assistents
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sense assistents no s'interpreta cap unanimitat: «per unanimitat» vol dir «els
 * qui hi eren», i atribuir-ho a un grup absent seria inventar-se un vot. La
 * taula es construeix **per acta**, mai per municipi: una regidora pot canviar
 * de grup entre dos plens del mateix mandat.
 */
const ASSISTENT_COLUMNES =
  /(?:^|\n)[ \t]*(?:Sr\.?|Sra\.?|Sr\/a\.?)?[ \t]*([A-ZÀ-ÚÇ][^\n]{4,45}?)[ \t]{2,}\(?([A-ZÀ-ÚÇ][A-Za-zÀ-úÇ0-9·'’\-\s\.]{1,25})\)?[ \t]*$/gm;

const ASSISTENT_PROSA =
  /(?:^|\n)[ \t]*([A-ZÀ-ÚÇ][^\n,]{4,45}),\s*(?:regidor(?:a)?\s+)?(?:del\s+)?[Gg]rup\s+[Mm]unicipal\s+(?:de\s+|d[’']|del\s+)?([^\n.]{2,50})\./g;

export function extreuAssistents(text: string): Assistent[] {
  // El capçal: tot el que hi ha abans del primer punt de l'ordre del dia.
  const capcal = text.slice(0, 9000);
  const fora: Assistent[] = [];
  const vistos = new Set<string>();
  for (const re of [ASSISTENT_PROSA, ASSISTENT_COLUMNES]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(capcal)) !== null) {
      const nom = m[1]!.trim().replace(/\s{2,}/g, " ");
      const grup = m[2]!.trim().replace(/\s{2,}/g, " ");
      if (SEMBLA_PERSONA.test(grup) || nom.split(/\s+/).length < 2) continue;
      const clau = nom.toLowerCase();
      if (vistos.has(clau)) continue;
      vistos.add(clau);
      fora.push({ nom, grup: semblaGrup(grup) ? grup : null });
    }
    if (fora.length >= 3) break;
  }
  return fora;
}

// ─────────────────────────────────────────────────────────────────────────────
// El pipeline sencer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * On es vota. Fusionem els ancoratges que cauen a menys de 600 caràcters l'un de
 * l'altre perquè un mateix bloc els dispara tots alhora: «sotmesa a votació»,
 * «vots a favor» i «per unanimitat» són el mateix esdeveniment, no tres.
 */
export function esdevenimentsDeVotacio(text: string): number[] {
  const posicions: number[] = [];
  for (const ancora of ANCORES) {
    const re = new RegExp(ancora.source, ancora.flags.includes("g") ? ancora.flags : `${ancora.flags}g`);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      posicions.push(m.index);
      if (m.index === re.lastIndex) re.lastIndex += 1;
    }
  }
  posicions.sort((a, b) => a - b);
  const fusionats: number[] = [];
  for (const pos of posicions) {
    const ultim = fusionats[fusionats.length - 1];
    if (ultim === undefined || pos - ultim > 600) fusionats.push(pos);
  }
  return fusionats;
}

/**
 * De text cru d'una acta a punts amb votació. El text ha de venir de
 * `pdftotext -layout`; la neteja del marge la fa aquesta funció.
 *
 * **Qui mana és el bloc de votació, no la capçalera.** És la recomanació de la
 * mesura empírica i el canvi que ho va capgirar tot: amb l'ordre del dia com a
 * esquelet, actes com les de Vic o Sabadell donaven un sol punt amb vint
 * votacions a dins i se'n publicava una (recall del 51%); ancorant a la votació
 * i pujant cap enrere fins al títol, se'n recuperen el 96%.
 *
 * Els punts de l'ordre del dia on no es vota res —donar compte, precs— hi entren
 * igualment, perquè formen part del que va passar al ple.
 */
export function extreuActa(textCru: string): ActaExtreta {
  const avisos: string[] = [];
  const text = netejaMarge(textCru);
  const organ = detectaOrgan(text);
  if (organ === "desconegut") avisos.push("no s'ha pogut identificar l'òrgan al capçal");

  const segments = segmentaPunts(text);
  const candidats = candidatsCapcalera(text);
  const esdeveniments = esdevenimentsDeVotacio(text);
  if (segments.length === 0 && esdeveniments.length === 0) {
    avisos.push("ni ordre del dia ni cap bloc de votació");
  }

  type Tram = { pos: number; numero: string | null; titol: string; text: string };
  const trams: Tram[] = [];
  const capçaleresAlRevés = [...candidats].reverse();

  for (const [i, pos] of esdeveniments.entries()) {
    const anterior = i === 0 ? -1 : esdeveniments[i - 1]!;
    // El títol és l'última capçalera abans del bloc. Si no n'hi ha cap de nova
    // des de la votació anterior, és que el punt en té més d'una (una esmena,
    // una segona volta per empat) i el títol es repeteix a consciència.
    const propia = capçaleresAlRevés.find((c) => c.pos <= pos && c.pos > anterior);
    const heretada = propia ?? capçaleresAlRevés.find((c) => c.pos <= pos);
    const inici = propia ? propia.pos : Math.max(0, anterior === -1 ? pos - 2000 : anterior);
    const fi = Math.min(esdeveniments[i + 1] ?? text.length, pos + 3000);
    trams.push({
      pos: inici,
      numero: propia?.numero ?? null,
      titol: heretada?.titol ?? "(punt sense títol identificat)",
      text: text.slice(inici, fi),
    });
  }

  // Punts de l'ordre del dia on no s'hi vota: hi són perquè el ple els va
  // tractar, i «se'n va donar compte» també és informació.
  for (const [i, segment] of segments.entries()) {
    const fi = segments[i + 1]?.inici ?? text.length;
    if (esdeveniments.some((p) => p >= segment.inici && p < fi)) continue;
    trams.push({
      pos: segment.inici,
      numero: segment.numero,
      titol: segment.titol,
      text: segment.text,
    });
  }

  trams.sort((a, b) => a.pos - b.pos);

  const punts: PuntActa[] = trams.map((tram) => ({
    numero: tram.numero,
    titol: tram.titol,
    tipus: tipusDePunt(tram.titol),
    proposant: proposantDeTitol(tram.titol),
    votacio: extreuVotacio(tram.text),
  }));

  const assistents = extreuAssistents(text);
  if (assistents.length === 0) avisos.push("cap assistent detectat al capçal");

  return { organ, punts, assistents, avisos };
}
