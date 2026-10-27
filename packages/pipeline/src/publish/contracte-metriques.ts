/** Contracte mínim perquè una mètrica es pugui publicar i comparar. */
export type EstatMetrica =
  | { estat: "disponible"; valor: number }
  | { estat: "absent"; motiu: string };

export type FontMetrica = { nom: string; url: string };

export type CohortMetrica<T> = {
  periode: string;
  files: readonly { fila: T; valor: number }[];
  observades: number;
  total: number;
};

export const estatDe = (valor: number | null | undefined, motiu: string): EstatMetrica =>
  typeof valor === "number" && Number.isFinite(valor)
    ? { estat: "disponible", valor }
    : { estat: "absent", motiu };

/**
 * Tria una sola cohort temporal. Guanya l'any més recent que arriba al llindar;
 * mai no es barregen anys per fer créixer artificialment la cobertura.
 */
export function cohortHomogenia<T>(
  files: readonly T[],
  llegeix: (fila: T) => { valor: number | null | undefined; periode: number | string | null | undefined },
  coberturaMinima = 0.9,
  minim = 20,
): CohortMetrica<T> | null {
  const perPeriode = new Map<string, { fila: T; valor: number }[]>();
  for (const fila of files) {
    const dada = llegeix(fila);
    if (dada.periode === null || dada.periode === undefined) continue;
    const estat = estatDe(dada.valor, "sense valor publicat");
    if (estat.estat === "absent") continue;
    const periode = String(dada.periode);
    perPeriode.set(periode, [...(perPeriode.get(periode) ?? []), { fila, valor: estat.valor }]);
  }
  return [...perPeriode]
    .filter(([, cohort]) => cohort.length >= minim && cohort.length / files.length >= coberturaMinima)
    .sort(([a], [b]) => b.localeCompare(a, "ca", { numeric: true }))
    .map(([periode, cohort]) => ({ periode, files: cohort, observades: cohort.length, total: files.length }))[0] ?? null;
}

/** Torna tots els empats de l'extrem; zero continua sent un valor legítim. */
export function extremsEmpatats<T>(
  files: readonly { fila: T; valor: number }[],
  mena: "max" | "min",
): { valor: number; files: T[] } | null {
  if (files.length === 0) return null;
  const valor = mena === "max"
    ? Math.max(...files.map((f) => f.valor))
    : Math.min(...files.map((f) => f.valor));
  return { valor, files: files.filter((f) => f.valor === valor).map((f) => f.fila) };
}

// ------------------------------------------------------------------ lectors

/*
 * Els lectors: d'un document de `municipality_metrics`, tal com el desa el
 * job, a la xifra que es compara. Són aquí i no a cada generador perquè la
 * mateixa xifra surt a tres llocs —el rànquing, el mapa i el comparador— i
 * la regla que decideix quan una dada és comparable ha de ser una de sola. Si
 * el rànquing tracta un zero com a absència i el comparador el publica com a
 * preu, el lector veu dues xifres diferents per al mateix poble, que és el que
 * passava amb l'aigua.
 *
 * Tots reben `unknown` i llegeixen a la defensiva: una mètrica que no hi és,
 * que encara no s'ha calculat o que ha canviat de forma torna `null`, mai una
 * excepció ni un zero. Un zero que no ve de la font seria una dada inventada.
 */

type Objecte = Record<string, unknown>;
const objecte = (v: unknown): Objecte | null => (v !== null && typeof v === "object" ? (v as Objecte) : null);
const nombre = (v: unknown): number | null => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};
const llista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** L'any de les últimes municipals: el de totes les xifres electorals d'aquest bloc. */
export const ANY_MUNICIPALS = 2023;

/**
 * El preu de l'aigua que es pot comparar. Un zero no és un preu: és un
 * municipi que no publica cap tarifa de subministrament (dotze pobles del
 * Pirineu, el 2025). La fitxa el diu tal com ve; el rànquing, el mapa i el
 * comparador el tracten com a absència, per la decisió editorial de
 * l'1-09-2026 que ja aplicava el rànquing.
 */
export const preuAiguaComparable = (preu: unknown): number | null => {
  const v = nombre(preu);
  return v !== null && v > 0 ? v : null;
};

/**
 * Qui presta el subministrament d'aigua, en tres paraules: «directa» (el mateix
 * ajuntament o un ens seu), «indirecta» (una empresa per concessió o una
 * societat mixta) i «noPrestat». És la mateixa lectura que `modelDeGestio()`
 * de J19; aquí es repeteix en tres línies perquè el generador no hagi de
 * carregar el mòdul del job sencer per llegir una paraula.
 */
export type ModelAigua = "directa" | "indirecta" | "noPrestat";
export function modelGestioAigua(preuAigua: unknown): ModelAigua | null {
  const text = objecte(objecte(preuAigua)?.gestio)?.subministrament;
  if (typeof text !== "string") return null;
  const clau = text.trim().toLowerCase();
  if (clau.startsWith("directa")) return "directa";
  if (clau.startsWith("indirecta")) return "indirecta";
  if (clau.startsWith("no presta")) return "noPrestat";
  return null;
}

/** Índex de Laakso-Taagepera sobre els escons del ple del 2023 (mètrica «government»). */
export const partitsEfectius = (government: unknown): number | null =>
  nombre(objecte(government)?.effectiveParties);

/**
 * La volatilitat entre les dues últimes eleccions amb càlcul fiable (mètrica
 * «continuitat»). L'any és el de la segona elecció del parell: el rànquing
 * només compara els que acaben el 2023, i qui té l'últim tram fiable abans
 * queda fora en lloc de barrejar-s'hi.
 */
export function volatilitatUltima(continuitat: unknown): { index: number; any: number } | null {
  const ultima = objecte(objecte(objecte(continuitat)?.volatilitat)?.ultima);
  const index = nombre(ultima?.index);
  const any = nombre(ultima?.a);
  if (index === null || any === null || ultima?.fiable === false) return null;
  return { index, any };
}

/**
 * Quants anys fa que la mateixa força —i la mateixa persona— té l'alcaldia
 * (mètrica «continuitat»), comptats fins a l'any de referència del càlcul.
 */
export function ratxaAlcaldia(continuitat: unknown): {
  forcaAnys: number | null; forcaDesDe: number | null; personaAnys: number | null; referencia: number | null;
} | null {
  const c = objecte(continuitat);
  if (!c) return null;
  const partit = objecte(c.partit);
  const persona = objecte(c.persona);
  return {
    forcaAnys: nombre(partit?.anys),
    forcaDesDe: nombre(partit?.desDeAny),
    personaAnys: nombre(persona?.anys),
    referencia: nombre(c.anyReferencia),
  };
}

/**
 * El vot sense representació del 2023 (mètrica «votPerdut»): nuls, blancs i
 * vots a llistes sense escó, sobre els vots emesos. Només quan la font quadra
 * —`total` és nul quan no— i quan la darrera elecció és la del 2023.
 */
export function votPerdut2023(votPerdut: unknown): { pct: number; regidories: number | null } | null {
  const v = objecte(votPerdut);
  const darrera = v?.darrera;
  if (typeof darrera !== "string" || Number(darrera.slice(1, 5)) !== ANY_MUNICIPALS) return null;
  const pct = nombre(objecte(objecte(objecte(v?.eleccions)?.[darrera])?.total)?.pct);
  return pct === null ? null : { pct, regidories: nombre(v?.regidorsEquivalents) };
}

/** El cens electoral d'unes municipals concretes (mètrica «censElectoral», J36). */
export function censDeLesMunicipals(censElectoral: unknown, any = ANY_MUNICIPALS): number | null {
  const eleccio = llista(objecte(censElectoral)?.eleccions).map(objecte).find((e) => nombre(e?.any) === any);
  return nombre(eleccio?.cens);
}

/** Els habitants del padró d'un any (mètrica «poblacio», J18, indicador «padroHabitants»). */
export function padroDeLAny(poblacio: unknown, any = ANY_MUNICIPALS): number | null {
  const indicador = llista(objecte(poblacio)?.indicadors).map(objecte).find((i) => i?.clau === "padroHabitants");
  const punt = llista(indicador?.serie).map(objecte).find((p) => nombre(p?.any) === any);
  return nombre(punt?.valor);
}

/**
 * Quina part dels veïns del padró era al cens electoral de les municipals,
 * en percentatge amb un decimal.
 *
 * Hi voten les persones de nacionalitat espanyola i les de la UE —i d'uns
 * quants països amb conveni— que s'hi han inscrit; no hi voten els menors ni
 * la resta de residents estrangers. Per això la xifra descriu qui viu al
 * poble, no cap decisió de l'ajuntament. Pot passar del 100 %: el padró és a
 * 1 de gener i el cens es tanca uns mesos després, i als pobles molt petits
 * una dotzena d'altes basten per creuar la ratlla.
 */
export function veinsQuePodenVotar(cens: number | null, padro: number | null): number | null {
  if (cens === null || padro === null || padro <= 0 || cens < 0) return null;
  return Math.round((1000 * cens) / padro) / 10;
}

/** A partir de quantes licitacions amb ofertes el percentatge vol dir alguna cosa: la de J10. */
export const LICITACIONS_MINIMES = 5;

/**
 * La part de les licitacions del mandat a què només es va presentar una
 * empresa (mètrica «contractacio», J10). Sobre tota la finestra i no any a
 * any, perquè un poble de mil habitants no fa cinc licitacions l'any; i només
 * amb cinc licitacions o més, que és el llindar del job: un 100 % sobre dues
 * licitacions no és un percentatge, és una anècdota.
 */
export function unaSolaOferta(contractacio: unknown): { pct: number; licitacions: number; periode: string | null } | null {
  const c = objecte(contractacio);
  const finestra = objecte(c?.finestra);
  const pct = nombre(finestra?.unaOfertaPct);
  const licitacions = nombre(finestra?.licitacionsAmbOfertes);
  if (pct === null || licitacions === null || licitacions < LICITACIONS_MINIMES) return null;
  const dates = objecte(c?.finestraDates);
  const de = typeof dates?.desDe === "string" ? dates.desDe.slice(0, 4) : null;
  const fins = typeof dates?.finsA === "string" ? dates.finsA.slice(0, 4) : null;
  return { pct, licitacions, periode: de && fins ? (de === fins ? de : `${de}-${fins}`) : null };
}

/** D'on surt la ràtio de pisos turístics: el registre viu (J46) o el recompte del 2024 (J40). */
export type FontPisosTuristics = "registre" | "urbanisme";

/**
 * Habitatges d'ús turístic per cada 100 habitants.
 *
 * Mana el registre: `establimentsTuristics` (J46) és una foto del Registre de
 * Turisme de Catalunya el dia de la consulta, i el període és l'any d'aquell
 * dia. Si el municipi no en té —o el padró no hi era i la ràtio és `null`—
 * es torna al recompte que publica l'Observatori del Territori dins de
 * `urbanismeHabitatge` (J40), que és del 2024. Mai no se'n barregen dos en
 * una mateixa xifra: la fila diu de quin any és i de quina font surt, i el
 * rànquing tria una sola cohort per any (`cohortHomogenia`).
 */
export function pisosTuristicsPer100(
  urbanisme: unknown,
  registre?: unknown,
): { valor: number; any: number; font: FontPisosTuristics } | null {
  const r = objecte(registre);
  const valorRegistre = nombre(r?.hutPer100Hab);
  const anyRegistre = typeof r?.dataConsulta === "string" && /^\d{4}/.test(r.dataConsulta)
    ? Number(r.dataConsulta.slice(0, 4))
    : null;
  if (valorRegistre !== null && anyRegistre !== null) return { valor: valorRegistre, any: anyRegistre, font: "registre" };
  const p = objecte(objecte(urbanisme)?.pisosTuristics);
  const valor = nombre(p?.hutsPer100);
  const any = nombre(p?.any);
  return valor === null || any === null ? null : { valor, any, font: "urbanisme" };
}

/**
 * Quants anys té el pla urbanístic general vigent, i quina figura és (J40).
 * Unes normes subsidiàries (NNSS) són la figura antiga, d'abans de la Llei
 * d'urbanisme del 2002; un POUM és la d'ara. L'antiguitat diu quan es va
 * aprovar, no si el pla és bo.
 */
export function antiguitatDelPla(urbanisme: unknown): { anys: number; sigla: string | null; any: number } | null {
  const p = objecte(objecte(urbanisme)?.planejament);
  const anys = nombre(p?.antiguitat);
  const any = nombre(p?.any);
  if (anys === null || any === null || anys < 0) return null;
  return { anys, sigla: typeof p?.sigla === "string" && p.sigla.trim() ? p.sigla.trim() : null, any };
}

/**
 * Habitatges protegits acabats des del 2023 fins al darrer any publicat, per
 * cada 1.000 habitants del padró vigent (J40, «protegit.desDe2023»). Un zero
 * és una dada: vol dir que la font no en compta cap d'acabat en aquells anys.
 */
export function protegitsAcabats(
  urbanisme: unknown,
  habitants: number | null,
): { perMil: number; acabats: number; periode: string } | null {
  const suma = objecte(objecte(objecte(urbanisme)?.protegit)?.desDe2023);
  const acabats = nombre(suma?.acabats);
  const des = nombre(suma?.des);
  const fins = nombre(suma?.fins);
  if (acabats === null || des === null || fins === null || !habitants || habitants <= 0) return null;
  return {
    perMil: Math.round((10_000 * acabats) / habitants) / 10,
    acabats,
    periode: des === fins ? String(des) : `${des}-${fins}`,
  };
}

/**
 * El preu mitjà del lloguer (mètrica «habitatge», J9) i com ha canviat des del
 * 2023, el primer any del mandat. La variació només hi és quan la sèrie té
 * tots dos punts; el període va amb ella perquè un «+12 %» sense dir de quan a
 * quan no es pot llegir.
 */
export function lloguerMitja(habitatge: unknown): {
  preu: number | null; any: number | null; variacio: { pct: number; periode: string } | null;
} | null {
  const h = objecte(habitatge);
  if (!h) return null;
  const preu = nombre(h.preu);
  const mandat = objecte(h.mandat);
  const pct = nombre(mandat?.percentual);
  const des = nombre(mandat?.desDe);
  const fins = nombre(mandat?.fins);
  return {
    preu,
    any: preu === null ? null : nombre(h.darrerAny),
    variacio: pct !== null && des !== null && fins !== null ? { pct, periode: `${des}-${fins}` } : null,
  };
}

/**
 * Per quants vots es va decidir l'última regidoria d'unes municipals (mètrica
 * «marges», `derive/marges.ts`): els que li faltaven a la llista —o, en llista
 * oberta, a la persona— que la tenia més a tocar. És aritmètica sobre els
 * resultats oficials amb tota la resta igual, no una predicció.
 *
 * Es llegeix a la defensiva: la mètrica és nova i, mentre la derivació no
 * s'hagi passat, no hi és enlloc; llavors torna `null` i el rànquing, el mapa
 * i la curiositat simplement no surten.
 */
export type MargeUltimEsco = {
  vots: number;
  sistema: "dhondt" | "obertes" | null;
  /** Les sigles de qui es va endur l'última regidoria i de qui la tenia més a tocar. */
  guanyador: string | null;
  perseguidor: string | null;
};
export function margeUltimEsco(marges: unknown, any = ANY_MUNICIPALS): MargeUltimEsco | null {
  const eleccio = llista(objecte(marges)?.eleccions).map(objecte).find((e) => nombre(e?.any) === any);
  const ultim = objecte(eleccio?.ultimEsco);
  const vots = nombre(ultim?.votsQueFaltaven);
  if (!ultim || vots === null || vots < 0) return null;
  const text = (...camps: unknown[]): string | null =>
    (camps.find((c) => typeof c === "string" && c.trim() !== "") as string | undefined)?.trim() ?? null;
  const sistema = eleccio?.sistema === "dhondt" || eleccio?.sistema === "obertes" ? eleccio.sistema : null;
  // En llista oberta l'última regidoria es juga entre persones, sovint de la
  // mateixa llista: «per a ACIEB; la tenia a tocar ACIEB» no diria res. Allà
  // va el nom de la persona, amb les sigles entre parèntesis.
  const qui = (persona: unknown, sigla: unknown): string | null => {
    const nom = text(persona);
    const sigles = text(sigla);
    return nom && sigles ? `${nom} (${sigles})` : nom ?? sigles;
  };
  return {
    vots,
    sistema,
    guanyador: sistema === "obertes" ? qui(ultim.guanyador, ultim.siglaGuanyador) : text(ultim.siglaGuanyador, ultim.guanyador),
    perseguidor: sistema === "obertes" ? qui(ultim.perseguidor, ultim.siglaPerseguidor) : text(ultim.siglaPerseguidor, ultim.perseguidor),
  };
}

// ------------------------------------------------- lectors de la descàrrega

/*
 * Les mètriques de J43 a J46 que fins ara només llegia la fitxa, i que la
 * descàrrega de dades (`dades.ts`) publica amb la font i l'any. Com la resta:
 * reben `unknown`, llegeixen a la defensiva i un buit torna `null`, mai un zero.
 */

/** L'any d'una data ISO («2026-10-27» → 2026), o `null` si no n'és. */
const anyDeLaData = (v: unknown): number | null =>
  typeof v === "string" && /^\d{4}/.test(v) ? Number(v.slice(0, 4)) : null;

/**
 * La participació d'unes eleccions que no són les municipals (mètrica
 * «altresEleccions», J43), per l'identificador de la convocatòria: «A20241»
 * el Parlament del 2024, «G20231» les generals del 2023, «E20241» les
 * europees del 2024. Votants sobre cens, en %, tal com la desa el job.
 */
export function participacioAltraEleccio(altresEleccions: unknown, id: string): { pct: number; any: number } | null {
  const eleccio = llista(objecte(altresEleccions)?.eleccions).map(objecte).find((e) => e?.id === id);
  const pct = nombre(eleccio?.participacio);
  const any = nombre(eleccio?.any);
  return pct === null || any === null ? null : { pct, any };
}

/**
 * L'atur registrat del darrer mes que publica el SEPE (mètrica «socioeconomia»,
 * J44), i quin mes és («2026-09»). Un mes que el SEPE dona com a «<5» no és
 * zero: torna `null`.
 */
export function aturDarrerMes(socioeconomia: unknown): { persones: number; mes: string; any: number } | null {
  const ara = objecte(objecte(objecte(socioeconomia)?.atur)?.ara);
  const persones = nombre(ara?.total);
  const mes = typeof ara?.mes === "string" ? ara.mes : null;
  const any = anyDeLaData(mes);
  return persones === null || mes === null || any === null ? null : { persones, mes, any };
}

/**
 * La taxa d'atur aproximada de J44: atur registrat sobre atur més afiliats
 * per residència, el mes dels afiliats. **No** és la taxa d'atur de l'EPA, i
 * qui la publiqui ho ha de dir.
 */
export function taxaAturAproximada(socioeconomia: unknown): { pct: number; mes: string; any: number } | null {
  const taxa = objecte(objecte(socioeconomia)?.taxa);
  const pct = nombre(taxa?.taxa);
  const mes = typeof taxa?.mes === "string" ? taxa.mes : null;
  const any = anyDeLaData(mes);
  return pct === null || mes === null || any === null ? null : { pct, mes, any };
}

/**
 * Un indicador de l'Idescat que desa J44 («ist», «irpfBase», «pensio»…), amb
 * l'any del període que declara l'API i si és provisional. Els que l'Idescat
 * no publica per al municipi no hi són.
 */
export function indicadorSocioeconomic(
  socioeconomia: unknown,
  clau: string,
): { valor: number; any: number | null; provisional: boolean; enllac: string | null } | null {
  const indicador = llista(objecte(socioeconomia)?.indicadors).map(objecte).find((i) => i?.clau === clau);
  const valor = nombre(indicador?.valor);
  if (valor === null) return null;
  const periode = objecte(indicador?.periode);
  const href = objecte(indicador?.enllac)?.href;
  return {
    valor,
    any: nombre(periode?.any),
    provisional: periode?.provisional === true,
    enllac: typeof href === "string" && href.trim() !== "" ? href : null,
  };
}

/**
 * Les reclamacions a la GAIP contra l'ajuntament aquest mandat (mètrica
 * «gaip», J45): quantes n'ha resolt la GAIP, quantes ha estimat del tot o en
 * part, i quants incompliments de resolucions consten al registre (de tots
 * els anys, que és com el publica la GAIP). Zero reclamacions és una dada.
 */
export function reclamacionsGaip(gaip: unknown): {
  reclamacions: number; estimades: number | null; incompliments: number; desDe: string | null;
} | null {
  const g = objecte(gaip);
  const mandat = objecte(g?.mandat);
  const reclamacions = nombre(mandat?.reclamacions);
  if (!g || reclamacions === null) return null;
  const sentit = objecte(mandat?.sentit);
  const del = nombre(sentit?.estimacio);
  const enPart = nombre(sentit?.estimacioParcial);
  return {
    reclamacions,
    estimades: del === null || enPart === null ? null : del + enPart,
    incompliments: llista(g.incompliments).length,
    desDe: typeof mandat?.des === "string" ? mandat.des : null,
  };
}

/**
 * Els habitatges d'ús turístic en alta al Registre de Turisme de Catalunya el
 * dia de la consulta (mètrica «establimentsTuristics», J46), i l'any d'aquell
 * dia. La ràtio per 100 habitants és `pisosTuristicsPer100()`.
 */
export function hutRegistrats(establimentsTuristics: unknown): { hut: number; any: number } | null {
  const r = objecte(establimentsTuristics);
  const hut = nombre(objecte(r?.hut)?.establiments);
  const any = anyDeLaData(r?.dataConsulta);
  return hut === null || any === null ? null : { hut, any };
}
