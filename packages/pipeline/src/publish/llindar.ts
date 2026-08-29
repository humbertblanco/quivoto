/**
 * El llindar de publicació d'un conjunt d'afirmacions.
 *
 * La lliçó de la primera mostra no és cap dels errors concrets que hi vam
 * trobar, sinó això: **set agents amb la metodologia escrita al davant no en
 * van complir els mínims**. Cap dels set conjunts no arribava a les cinc
 * afirmacions amb cita de programa i dos no arribaven a les vuit lligades a un
 * vot citable, i ningú se'n va adonar fins que un crític ho va comptar a mà.
 *
 * Un document no fa complir res. Això sí. Cap brúixola municipal no es publica
 * sense passar per aquí, i el que no passi es queda a la reserva amb el motiu
 * escrit.
 *
 * Els mínims surten de `docs/metodologia/01-afirmacions.md`.
 */

export type Afirmacio = {
  tema: string;
  text: string;
  context?: string;
  evidencia: string;
  url_evidencia?: string;
  /** On cau el govern actual: serveix per mesurar l'equilibri direccional. */
  posicio_govern: "acord" | "desacord" | "desconeguda" | string;
  discrimina?: string;
  /**
   * El districte que la decisió afecta, a les ciutats que en tenen.
   *
   * A Barcelona una superilla de l'Eixample o el tramvia per un tram de la
   * Diagonal no toquen igual algú de Sants que algú de Nou Barris. Les
   * afirmacions de ciutat no en porten, i les que en porten es poden ensenyar
   * primer a qui hi visqui. No canvia el càlcul: canvia l'ordre i el context.
   */
  districte?: string;
};

export type Conjunt = {
  municipi: string;
  afirmacions: Afirmacio[];
};

export type Incompliment = {
  regla: string;
  /**
   * `bloqueja` atura tota publicació · `nomes-bruixola` només atura la brúixola
   * electoral, que és la que compara programes · `avisa` no atura res.
   */
  gravetat: "bloqueja" | "nomes-bruixola" | "avisa";
  detall: string;
  /** Afirmacions concretes que el provoquen, si n'hi ha. */
  afectades?: string[];
};

export type Veredicte = {
  municipi: string;
  /**
   * Es pot publicar com a **brúixola electoral**: comparar el que una
   * candidatura diu al seu programa amb el que ha votat. Exigeix programes, i
   * per això cap conjunt no ho compleix encara.
   */
  publicable: boolean;
  /**
   * Es pot publicar com a **avaluació de mandat**: què s'ha votat aquests
   * quatre anys i on cau cada grup.
   *
   * Són dues coses diferents i durant mesos les vam confondre. Un programa fa
   * falta per dir «això és el que van prometre»; no en fa cap per dir «això és
   * el que van votar», que surt de l'acta i prou. Amb un sol veredicte, deu
   * conjunts sencers quedaven marcats de «no publicable» per una regla que no
   * els tocava, i el que hi havia a dins —vint-i-cinc votacions reals amb el
   * seu recompte— no es podia ensenyar.
   *
   * La brúixola de debò arriba quan les candidatures responguin, a partir de
   * finals d'abril del 2027. Fins llavors, això és el que es pot fer, i és molt.
   */
  avaluable: boolean;
  total: number;
  incompliments: Incompliment[];
  resum: {
    ambVotCitable: number;
    ambPrograma: number;
    acordAmbGovern: number;
    desconegudes: number;
    temes: Record<string, number>;
    paraulesMaxim: number;
  };
};

/** Mínims de la metodologia. Canviar-los aquí és canviar-los a tot arreu. */
/**
 * Dues condicions que el codi **no** pot comprovar i que qui escrigui un conjunt
 * ha de complir igualment. Es deixen escrites aquí perquè és on es miren les
 * regles, no en un document a part que no obre ningú.
 *
 * **1. La decisió ha de ser del ple.** Un tema pot ser divisiu i no ser
 * municipal. Una moció sobre immigració val si el que es vota és una cosa que
 * l'ajuntament pot fer —empadronament, ajuts, places d'acollida, un pla local—
 * i no val si és un posicionament sobre política estatal disfressat de moció.
 * El mateix amb la llengua: sí a la retolació, als cursos o als requisits d'un
 * contracte; no a una declaració sobre una llei que no depèn d'ells. Ja ens ha
 * passat: a l'Hospitalet se n'hi va colar una, i a més citada tallant-li la
 * part que la caracteritzava políticament.
 *
 * **2. Les afirmacions han de partir el ple de maneres diferents.** Si totes
 * separen el govern de tota l'oposició, el conjunt fa una sola pregunta escrita
 * vint-i-cinc vegades i qui el respongui veurà l'oposició empatada —no perquè
 * s'assemblin, sinó perquè no els hem preguntat res que els separi. La pàgina
 * de la demostració ho detecta i ho diu en veu alta; val més arreglar-ho abans.
 */
export const LLINDARS = {
  total: 25,
  totalMinim: 20,
  ambVotCitable: 8,
  ambPrograma: 5,
  paraulesMaxim: 25,
  equilibriMin: 0.4,
  equilibriMax: 0.6,
  perTemaMaxim: 5,
  minimsPerTema: { fiscalitat: 3, habitatge: 3, mobilitat: 3 } as Record<string, number>,
} as const;

/**
 * Compta paraules com les compta una persona. Les elisions («l'Ajuntament»)
 * són una paraula: partir-les inflaria el recompte i faria caure afirmacions
 * que en realitat es llegeixen curtes.
 */
export function compta(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** L'evidència cita una votació del ple amb un recompte o un acord numerat. */
export function citaUnVot(a: Afirmacio): boolean {
  const e = `${a.evidencia} ${a.url_evidencia ?? ""}`.toLowerCase();
  const teAncora = /\bple\b|\bacord\b|\bsessi(ó|o)\b|\bmoci(ó|o)\b/.test(e);
  const teRecompte = /\b\d+\s*[-–]\s*\d+/.test(e) || /vots?\s+(a\s+)?favor/.test(e);
  return teAncora && teRecompte;
}

/** L'evidència cita literalment un programa electoral. */
export function citaUnPrograma(a: Afirmacio): boolean {
  return /programa\s+(electoral|del?\s*20\d\d)|programa\s+de\s+govern/i.test(
    `${a.evidencia} ${a.context ?? ""}`,
  );
}

/**
 * Paranys de redacció que la mostra va destapar i que es poden detectar sols.
 * No cobreixen tots els errors possibles —ningú detecta automàticament una
 * caricatura de la posició contrària— però sí els que es repetien més.
 */
const PARANYS: ReadonlyArray<{ nom: string; patro: RegExp; per_que: string }> = [
  {
    nom: "verb que premia l'statu quo",
    patro: /\b(continuar|mantenir|seguir)\b/i,
    per_que: "obliga a saber com estan les coses ara i regala el sí a qui mana",
  },
  {
    nom: "verb buit",
    patro: /\bha\s+de\s+(garantir|millorar|potenciar|impulsar|fomentar)\b/i,
    per_que: "ningú sensat pot estar-hi en contra: no és una afirmació, és una obvietat",
  },
  {
    nom: "finalitat dins de l'enunciat",
    patro: /\b(per\s+tal\s+de|encara\s+que|a\s+fi\s+de|per\s+accelerar|per\s+garantir)\b/i,
    per_que: "l'argument va al context, mai a l'afirmació",
  },
  {
    nom: "quantificador absolut",
    patro: /\b(tots?\s+els|totes?\s+les|cap\s+\w+\s+no\s+pot|sempre|mai)\b/i,
    per_que: "la versió maximalista fa que dir-hi que sí sembli irraonable",
  },
];

export function validaConjunt(conjunt: Conjunt): Veredicte {
  const a = conjunt.afirmacions;
  const incompliments: Incompliment[] = [];

  const ambVotCitable = a.filter(citaUnVot).length;
  const ambPrograma = a.filter(citaUnPrograma).length;
  const acordAmbGovern = a.filter((x) => x.posicio_govern === "acord").length;
  const desconegudes = a.filter((x) => x.posicio_govern === "desconeguda").length;

  const temes: Record<string, number> = {};
  for (const x of a) temes[x.tema] = (temes[x.tema] ?? 0) + 1;
  const paraules = a.map((x) => compta(x.text));
  const paraulesMaxim = paraules.length === 0 ? 0 : Math.max(...paraules);

  const bloqueja = (regla: string, detall: string, afectades?: string[]): void => {
    incompliments.push({ regla, gravetat: "bloqueja", detall, ...(afectades ? { afectades } : {}) });
  };
  const avisa = (regla: string, detall: string, afectades?: string[]): void => {
    incompliments.push({ regla, gravetat: "avisa", detall, ...(afectades ? { afectades } : {}) });
  };

  if (a.length < LLINDARS.totalMinim) {
    bloqueja("nombre d'afirmacions", `${a.length}, i el mínim són ${LLINDARS.totalMinim}`);
  }

  if (ambVotCitable < LLINDARS.ambVotCitable) {
    bloqueja(
      "afirmacions lligades a un vot del ple",
      `${ambVotCitable}, i el mínim són ${LLINDARS.ambVotCitable}. Sense vots citables les posicions són deduïdes i no es poden ensenyar.`,
    );
  }

  // Aquesta regla **només** afecta la brúixola electoral, no l'avaluació de
  // mandat: per dir què ha votat un grup no fa cap falta el seu programa.
  if (ambPrograma < LLINDARS.ambPrograma) {
    incompliments.push({
      regla: "afirmacions que citen un programa",
      detall: `${ambPrograma}, i el mínim són ${LLINDARS.ambPrograma}. Només fa falta per a la brúixola electoral: per avaluar el mandat n'hi ha prou amb les actes.`,
      gravetat: "nomes-bruixola",
    });
  }

  const massaLlargues = a.filter((x) => compta(x.text) > LLINDARS.paraulesMaxim);
  if (massaLlargues.length > 0) {
    bloqueja(
      "màxim de paraules",
      `${massaLlargues.length} passen de ${LLINDARS.paraulesMaxim} paraules`,
      massaLlargues.map((x) => x.text),
    );
  }

  const proporcio = a.length === 0 ? 0 : acordAmbGovern / a.length;
  if (proporcio < LLINDARS.equilibriMin || proporcio > LLINDARS.equilibriMax) {
    bloqueja(
      "equilibri direccional",
      `el govern cau del costat de l'«acord» en ${acordAmbGovern} de ${a.length} (${Math.round(100 * proporcio)} %), i ha d'estar entre el ${LLINDARS.equilibriMin * 100} i el ${LLINDARS.equilibriMax * 100} %`,
    );
  }

  for (const [tema, minim] of Object.entries(LLINDARS.minimsPerTema)) {
    const quantes = temes[tema] ?? 0;
    if (quantes < minim) bloqueja(`mínim de ${tema}`, `${quantes}, i el mínim són ${minim}`);
  }

  const massaDUnTema = Object.entries(temes).filter(([, n]) => n > LLINDARS.perTemaMaxim);
  for (const [tema, n] of massaDUnTema) {
    avisa("massa d'un sol tema", `${tema} en té ${n}, i el màxim recomanat és ${LLINDARS.perTemaMaxim}`);
  }

  if (desconegudes > 0) {
    bloqueja(
      "posicions del govern desconegudes",
      `${desconegudes} afirmacions no saben on cau el govern. La promesa del producte és ensenyar l'evidència; sense posició no hi ha res a ensenyar.`,
      a.filter((x) => x.posicio_govern === "desconeguda").map((x) => x.text),
    );
  }

  const sensEvidencia = a.filter((x) => !x.evidencia || x.evidencia.trim().length < 20);
  if (sensEvidencia.length > 0) {
    bloqueja("evidència buida", `${sensEvidencia.length} sense evidència`, sensEvidencia.map((x) => x.text));
  }

  for (const parany of PARANYS) {
    const cauen = a.filter((x) => parany.patro.test(x.text));
    if (cauen.length > 0) {
      avisa(parany.nom, `${cauen.length} afirmacions: ${parany.per_que}`, cauen.map((x) => x.text));
    }
  }

  return {
    municipi: conjunt.municipi,
    publicable: incompliments.every((i) => i.gravetat === "avisa"),
    avaluable: incompliments.every((i) => i.gravetat !== "bloqueja"),
    total: a.length,
    incompliments,
    resum: { ambVotCitable, ambPrograma, acordAmbGovern, desconegudes, temes, paraulesMaxim },
  };
}

/** Informe llegible d'un veredicte, per a la consola i per a la revisió editorial. */
export function informe(v: Veredicte): string {
  const cap =
    `${v.avaluable ? "AVALUACIÓ ✓" : "AVALUACIÓ ✗"}  ` +
    `${v.publicable ? "BRÚIXOLA ✓" : "BRÚIXOLA ✗"}  ` +
    `${v.municipi} · ${v.total} afirmacions`;
  const dades =
    `  vots citables ${v.resum.ambVotCitable} · programa ${v.resum.ambPrograma} · ` +
    `govern d'acord ${v.resum.acordAmbGovern} · màx. ${v.resum.paraulesMaxim} paraules`;
  const linies = v.incompliments.map(
    (i) => `  ${i.gravetat === "bloqueja" ? "✗" : "!"} ${i.regla}: ${i.detall}`,
  );
  return [cap, dades, ...linies].join("\n");
}
