/**
 * Normalització de noms. Les fonts escriuen les mateixes persones i municipis de
 * maneres diferents («MARTÍ RIERA ROVIRA», «Martí Riera i Rovira»), i sense
 * unificar-ho no es poden creuar els datasets.
 */

/** Minúscules, sense accents ni signes, amb els espais col·lapsats. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\u00b7'\u2019`]/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Nom de persona per aparellar entre fonts. Dues coses el trenquen si no s'hi fa res:
 *
 *   · El **motiu entre parèntesis** que porten les llistes electorals:
 *     «Concepción(conxi) Sierra Martín» al cens de candidats és la mateixa
 *     persona que «Concepción Sierra Martín» a la composició del ple. Sense
 *     treure'l, aquesta regidora sembla que hagi entrat a mig mandat.
 *   · La **«i» copulativa** dels cognoms catalans, que unes fonts posen i altres no.
 */
export function normalizePersonName(text: string): string {
  return normalize(text.replace(/\([^)]*\)/g, " "))
    .replace(/\bi\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugify(text: string): string {
  return normalize(text).replace(/\s+/g, "-").replace(/-+/g, "-");
}

/**
 * Els noms catalans porten l'article al davant al dataset («l'Hospitalet de
 * Llobregat», «la Seu d'Urgell») i la gent el busca sense. Guardem el nom tal
 * com és i generem el slug sense article.
 */
const LEADING_ARTICLE = /^(l|el|la|els|les|es|sa|s)\s+|^(l|s)['’]\s*/i;

export function slugifyMunicipality(name: string): string {
  return slugify(name.replace(LEADING_ARTICLE, ""));
}

/**
 * Treu el prefix «Ajuntament de…» del nom de l'ens. Cal recollir totes les
 * contraccions catalanes: «Ajuntament del Cogul», «Ajuntament dels Torms»,
 * «Ajuntament de les Llosses», «Ajuntament d'Abrera». Si se n'oblida alguna, el
 * municipi queda desat com a «del Cogul» i deixa de lligar amb la resta de fonts.
 */
export function municipalityName(nomComplert: string): string {
  const rest = nomComplert.replace(/^Ajuntament\s+/i, "").trim();
  for (const [prefix, article] of ARTICLE_CONTRACTIONS) {
    if (prefix.test(rest)) return rest.replace(prefix, article);
  }
  return rest.replace(/^(de\s+|d['’]\s*)/i, "").trim();
}

/**
 * «de» es contrau amb l'article del topònim: «Ajuntament **dels** Torms» vol dir
 * que el municipi es diu «**els** Torms». Desfem la contracció en comptes de
 * llençar l'article, perquè l'article forma part del nom oficial i sense ell el
 * municipi deixa de lligar amb les fonts que sí que l'escriuen.
 */
const ARTICLE_CONTRACTIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^dels\s+/i, "els "],
  [/^del\s+/i, "el "],
  [/^de\s+les\s+/i, "les "],
  [/^de\s+la\s+/i, "la "],
  [/^de\s+l['’]\s*/i, "l'"],
  [/^de\s+sa\s+/i, "sa "],
  [/^de\s+s['’]\s*/i, "s'"],
];

/**
 * Alguns datasets escriuen el nom amb l'article al final i en majúscules
 * («OMELLS DE NA GAIA, ELS»). Ho tornem a l'ordre normal per poder-lo aparellar
 * amb el padró, que l'escriu «els Omells de na Gaia».
 */
export function uninvertArticle(name: string): string {
  const match = name.match(/^(.*),\s*(l['’]|els?|les|la|sa|s['’])\s*\.?$/i);
  if (!match) return name.trim();
  const article = match[2]!.trim();
  const body = match[1]!.trim();
  return /['’]$/.test(article) ? `${article}${body}` : `${article} ${body}`;
}

/** Majúscules només a la primera lletra de cada mot; respecta les partícules. */
export function titleCase(text: string): string {
  const minor = new Set(["de", "del", "dels", "la", "les", "el", "els", "i", "d", "l", "da", "den"]);
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) => {
      if (index > 0 && minor.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

/** Converteix un valor de Socrata (sempre text) a enter, o `null`. */
export function toInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Un nom de persona escrit per llegir-lo, no per creuar-lo.
 *
 * L'historial d'alcaldies ve de fonts diferents i es nota a la taula: «Jaume
 * Collboni Cuadrado» al costat de «JORDI HEREU BOHER» i de «ADA COLAU
 * BALLANO», que a la mateixa columna semblen dues coses diferents quan són la
 * mateixa. Aquí només es toca el que ve tot en majúscules —si el nom ja porta
 * cap minúscula és que algú l'ha escrit bé i no el volem tocar— i s'hi respecta
 * la partícula catalana, que va en minúscula si no obre el nom: «Pasqual
 * Maragall i Mira», «Xavier Trias de Bes».
 */
const PARTICULES = new Set([
  "de", "del", "dels", "d", "i", "la", "les", "el", "els", "lo", "los", "y", "da", "das", "do", "dos",
  "van", "von", "der", "den", "af", "el-", "bin", "ibn",
]);

/**
 * La conjunció «i» dels cognoms catalans, escrita en majúscula per la font.
 *
 * «Jan Santaló I Lloret» i «Josep Sánchez I Camps» és com surten a la
 * composició del ple de **138 dels 947 municipis**, i aquella I no és cap
 * inicial: una inicial porta punt. Es veia a la fitxa del poble, a la de la
 * persona, a la de la comarca i a la del partit alhora.
 */
const conjuncioCatalana = (nom: string): string => nom.replace(/(\S)\s+I\s+(\S)/g, "$1 i $2");

export function nomLlegible(text: string): string {
  const nom = text.trim().replace(/\s+/g, " ");
  // El sufix entre parèntesis no compta per decidir si el nom ja està ben
  // escrit: «ARIÀ PÉREZ ISIDRO (Ind.)» porta minúscules només a l'abreviatura
  // d'«independent», i amb elles el nom es publicava tot en majúscules.
  if (!nom) return nom;
  // Un nom que ja porta minúscules no s'ha de tocar... llevat de la conjunció.
  if (/\p{Ll}/u.test(nom.replace(/\([^)]*\)/g, ""))) return conjuncioCatalana(nom);
  const capitalitza = (mot: string): string =>
    mot.charAt(0).toLocaleUpperCase("ca") + mot.slice(1).toLocaleLowerCase("ca");
  return nom
    .toLocaleLowerCase("ca")
    .split(" ")
    .map((mot, i) => {
      // Els guions i els apòstrofs parteixen el mot i cada tros mana el seu:
      // «GARCIA-MORENO» és «Garcia-Moreno» i «D'URGELL» és «d'Urgell».
      const trossos = mot.split(/([-'’])/);
      return trossos
        .map((tros, j) => {
          if (/^[-'’]$/.test(tros) || tros === "") return tros;
          const obreElNom = i === 0 && j === 0;
          if (!obreElNom && PARTICULES.has(tros)) return tros;
          return capitalitza(tros);
        })
        .join("");
    })
    .join(" ");
}

const MESOS = [
  "gener", "febrer", "març", "abril", "maig", "juny",
  "juliol", "agost", "setembre", "octubre", "novembre", "desembre",
] as const;

/**
 * Una data ISO escrita com es diu en català.
 *
 * Aquesta funció existia tres vegades —a `amb.ts`, a `comarques.ts` i a
 * `radiografia.ts`— i **només dues estaven bé**: la de la fitxa, que és la
 * pàgina que es publica 947 vegades, escrivia «19 de abril del 1979» a la taula
 * d'alcaldies de tots els municipis. Abril, agost i octubre comencen per vocal
 * i demanen apòstrof.
 */
export function dataCurta(iso: string | null): string {
  if (!iso) return "";
  const [any, mes, dia] = iso.slice(0, 10).split("-");
  const nom = MESOS[Number(mes) - 1];
  if (!nom) return `${any ?? ""}`;
  const de = /^[aeiou]/.test(nom) ? "d'" : "de ";
  return `${Number(dia)} ${de}${nom} del ${any}`;
}

/** «el 21 d'agost del 2026», i «l'1 de gener del 2025» quan cau en dia 1. */
export function elDia(iso: string | null): string {
  if (!iso) return "";
  return Number(iso.slice(8, 10)) === 1 ? `l'${dataCurta(iso)}` : `el ${dataCurta(iso)}`;
}

/** El mateix darrere d'un «de»: «de l'1 de gener», «del 21 d'agost». */
export function delDia(iso: string | null): string {
  if (!iso) return "";
  return Number(iso.slice(8, 10)) === 1 ? `de l'${dataCurta(iso)}` : `del ${dataCurta(iso)}`;
}

/**
 * «de» davant del nom d'un municipi, amb l'article contret.
 *
 * Els noms catalans porten l'article —«l'Hospitalet de Llobregat», «el Prat de
 * Llobregat», «els Omells de na Gaia»— i la preposició s'hi contrau. Sense
 * això la pàgina diu «la fitxa de Abrera» i «al ple de el Prat», que és com
 * escriu una màquina.
 *
 * Vivia a `candidatura.ts`, que és on va fer falta primer, i la fitxa de
 * regidor no la feia servir: publicava **«Alcalde de Esplugues»** a la pàgina
 * que porta el nom de la persona al títol. És el mateix cas que `dataCurta()`,
 * i per això va al mateix lloc: aquí, on qui escriu una frase nova la troba.
 */
export function de(nom: string): string {
  if (/^l['’]/i.test(nom)) return `de ${nom}`;
  if (/^els\s/i.test(nom)) return `dels ${nom.slice(4)}`;
  if (/^el\s/i.test(nom)) return `del ${nom.slice(3)}`;
  if (/^(la|les|sa|ses)\s/i.test(nom) || /^s['’]/i.test(nom)) return `de ${nom}`;
  if (/^[aeiouàèéíòóúüh]/i.test(nom)) return `d'${nom}`;
  return `de ${nom}`;
}
