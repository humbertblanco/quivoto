import {
  PREFIX_KIND_DINERS_GENERALITAT_ENS,
  type AnyFcl,
  type ConceptePendent,
  type DinersGeneralitat,
  type DinersGeneralitatBase,
  type DinersGeneralitatEnsDesat,
  type EstatDocument,
  type FontDiners,
  type ObraPuosc,
  type PendentsDesats,
  type TramesaAny,
  type TramesesDesades,
} from "../jobs/j41-diners-generalitat";
import { consultatEl, dataEscrita, delDia, elDia, elDiaAlPrincipi, isoDeData } from "../lib/text";

/**
 * El formatador de dates és el de la casa, a `lib/text.ts`. Vivia aquí i
 * escrivia «09/10/2024», com les pantalles de l'inventari; ara la fitxa diu
 * «9 d'octubre del 2024», com la resta de la web. Es reexporta perquè els
 * altres generadors que l'importaven d'aquí continuïn funcionant.
 */
export { dataEscrita };

/**
 * «Què rep de la Generalitat, i si li envia els comptes»: el bloc de la fitxa
 * municipal amb el que desa la J41, i el fragment equivalent per a les fitxes
 * dels consells comarcals, l'AMB i les diputacions.
 *
 * Quatre apartats, cadascun amb la seva font i la seva data:
 *
 *   · **Què li dona la Generalitat sense condicions.** El Fons de Cooperació
 *     Local any per any. Es diu ben clar que és un repartiment per fórmula i
 *     no un premi, i que els tres trams del fons no se sumen entre ells ni amb
 *     les subvencions de la diputació o del consell (J39), que són diners d'un
 *     altre pagador.
 *   · **Obres del PUOSC.** La llista d'obres, amb la subvenció i el pressupost.
 *     Les anualitats futures porten l'etiqueta «programada», i el text diu que
 *     la font no explica mai si una obra s'ha acabat.
 *   · **Envia els comptes?** L'estat oficial de cada tramesa, any per any:
 *     «Tramès el 9 d'octubre del 2024», «No tramès» o «no consta». Sense colors: un
 *     «No tramès» de l'any en curs pot ser que encara no toqui, i el text ho
 *     diu. L'adjectiu acumulat de l'inventari («Compleix») no es pinta.
 *   · **El que li deu la Generalitat.** La darrera instantània del que té
 *     reconegut i encara no ha pagat, presentada com el que és: un calendari
 *     de pagaments normal.
 *
 * Un buit sempre és un buit: un any sense fila és «no consta», mai un zero.
 * Les classes van totes amb el prefix `coop-`; les taules reutilitzen
 * `balanc` i `taula-envolta` de la resta de la fitxa.
 */

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const enter = (n: number): string => n.toLocaleString("ca-ES", { maximumFractionDigits: 0 });
const euros = (n: number): string => `${enter(n)}&nbsp;€`;
const eurosOBuit = (n: number | null): string => (n === null ? `<span class="coop-buit">no consta</span>` : euros(n));

/** Quants anys es veuen d'entrada a les taules llargues; la resta, plegats. */
const ANYS_VISIBLES = 6;

/** Qui rep els diners, per a les frases: «l'ajuntament», «el consell», «l'AMB», «la diputació». */
export type Subjecte = { article: string; nom: string };

const AJUNTAMENT: Subjecte = { article: "l'", nom: "ajuntament" };
const SUBJECTES_ENS: Record<DinersGeneralitatEnsDesat["tipus"], Subjecte> = {
  consell: { article: "el ", nom: "consell comarcal" },
  amb: { article: "l'", nom: "AMB" },
  diputacio: { article: "la ", nom: "diputació" },
};
const qui = (s: Subjecte): string => `${s.article}${s.nom}`;

/**
 * La preposició amb l'article, contracte quan toca: «a l'ajuntament», però
 * «al consell comarcal» i «per al consell comarcal», mai «a el».
 */
export function ambPreposicio(preposicio: "a" | "per a", s: Subjecte): string {
  if (s.article === "el ") return `${preposicio === "a" ? "al" : "per al"} ${s.nom}`;
  return `${preposicio} ${qui(s)}`;
}

/** El context que la fitxa municipal sap i la J41 no. */
export type ContextDiners = {
  /** Els habitants del padró vigent, per dir el FCL per habitant; sense, no es diu. */
  habitants?: number | null;
  /** L'any del padró, per escriure'l al costat. */
  anyPadro?: number | null;
};

/** El peu d'un apartat: la font, la llicència i la data de consulta. */
function peuFont(font: FontDiners, extra = ""): string {
  return `<p class="peu-nota">Font: <a href="${escape(font.url)}" rel="noopener nofollow">${escape(font.organisme)}</a>,
  «${escape(font.titol)}» (${escape(font.llicencia)}), ${escape(consultatEl(font.consultat))}.${extra}</p>`;
}

/** Una taula de la casa, dins del contenidor que la fa lliscar a mòbil. */
function taula(classe: string, capcalera: readonly string[], files: readonly string[]): string {
  return `<div class="taula-envolta"><table class="balanc coop-taula ${classe}">
  <thead><tr>${capcalera.map((c) => `<th scope="col">${c}</th>`).join("")}</tr></thead>
  <tbody>${files.join("")}</tbody>
  </table></div>`;
}

/** Les files visibles i, si n'hi ha més, la resta plegades sota un «Del … al …». */
function ambPlegades(classe: string, capcalera: readonly string[], files: readonly { any: number; html: string }[]): string {
  const visibles = files.slice(0, ANYS_VISIBLES);
  const resta = files.slice(ANYS_VISIBLES);
  const plegat = resta.length
    ? `<details class="coop-detall"><summary>Els anys anteriors, del ${resta[resta.length - 1]!.any} al ${resta[0]!.any}</summary>
  ${taula(classe, capcalera, resta.map((f) => f.html))}</details>`
    : "";
  return `${taula(classe, capcalera, visibles.map((f) => f.html))}${plegat}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Què li dona la Generalitat sense condicions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Els anys del fons del més recent al més antic, amb els forats omplerts: un
 * any entre el primer i el darrer que la font no porta surt com a «no consta»,
 * no desapareix ni es fa zero.
 */
export function anysAmbForats(fcl: readonly AnyFcl[]): (AnyFcl & { buit: boolean })[] {
  if (fcl.length === 0) return [];
  const perAny = new Map(fcl.map((a) => [a.any, a]));
  const anys = fcl.map((a) => a.any);
  const [primer, darrer] = [Math.min(...anys), Math.max(...anys)];
  const sortida: (AnyFcl & { buit: boolean })[] = [];
  for (let any = darrer; any >= primer; any -= 1) {
    const a = perAny.get(any);
    sortida.push(a ? { ...a, buit: false } : { any, lliure: null, supramunicipal: null, extraordinari: null, buit: true });
  }
  return sortida;
}

/** «El 2025 la Generalitat li va assignar 99.337 € del Fons de Cooperació Local…» */
function fraseFcl(darrer: AnyFcl, s: Subjecte, context: ContextDiners): string {
  if (darrer.lliure === null) {
    return `El ${darrer.any} la font no porta l'import de lliure disposició del Fons de Cooperació Local ${ambPreposicio("per a", s)}.`;
  }
  let frase = `El ${darrer.any} la Generalitat va assignar ${ambPreposicio("a", s)} <b>${euros(darrer.lliure)}</b> del Fons de Cooperació Local, ` +
    `el tram que ${qui(s)} pot gastar en el que vulgui`;
  if (context.habitants && context.habitants > 0) {
    const perHabitant = darrer.lliure / context.habitants;
    frase += ` (${perHabitant.toLocaleString("ca-ES", { maximumFractionDigits: perHabitant < 10 ? 1 : 0 })}&nbsp;€ per habitant` +
      `${context.anyPadro ? `, amb el padró del ${context.anyPadro}` : ""})`;
  }
  const altres: string[] = [];
  if (darrer.supramunicipal !== null) altres.push(`${euros(darrer.supramunicipal)} per a serveis supramunicipals`);
  if (darrer.extraordinari !== null) altres.push(`${euros(darrer.extraordinari)} del fons extraordinari`);
  if (altres.length) frase += `. A part, i sense sumar-hi, ${altres.join(" i ")}`;
  return `${frase}.`;
}

/** L'explicació que va sempre amb el fons: què és, i què no és. */
export const NOTA_FCL =
  "No és un premi ni un càstig: és un repartiment per fórmula que fixa cada any la llei de pressupostos de la " +
  "Generalitat, sobretot segons la població, la superfície, els nuclis del terme i la capitalitat. Els trams del fons " +
  "(lliure disposició, serveis supramunicipals i extraordinari) es reparteixen per separat i aquí no se sumen. Tampoc " +
  "no se sumen amb les subvencions de la diputació o del consell comarcal, que són diners d'un altre pagador.";

export function seccioFcl(fcl: readonly AnyFcl[] | null, font: FontDiners, s: Subjecte = AJUNTAMENT, context: ContextDiners = {}): string {
  // Les diputacions no en són destinatàries: no és un buit, és que no els toca.
  if (fcl === null) return "";
  const titol = `<h3 class="coop-titol">Què li dona la Generalitat sense condicions</h3>`;
  if (fcl.length === 0) {
    return `<div class="coop-seccio">${titol}
  <p>La font del Fons de Cooperació Local no porta cap any ${ambPreposicio("per a", s)}: no consta, que no vol dir zero.</p>
  ${peuFont(font)}</div>`;
  }
  const anys = anysAmbForats(fcl);
  const darrer = anys.find((a) => !a.buit)!;
  const ambSupra = fcl.some((a) => a.supramunicipal !== null);
  const ambExtra = fcl.some((a) => a.extraordinari !== null);
  const capcalera = ["Any", "Lliure disposició", ...(ambSupra ? ["Serveis supramunicipals"] : []), ...(ambExtra ? ["Extraordinari"] : [])];
  const files = anys.map((a) => {
    if (a.buit) {
      return { any: a.any, html: `<tr><th scope="row">${a.any}</th><td class="coop-buit" colspan="${capcalera.length - 1}">no consta</td></tr>` };
    }
    // Un tram que la font no porta aquell any és un buit, no un zero: es
    // deixa la cel·la amb un guió, perquè en la majoria d'anys el tram no
    // existia.
    const cel = (n: number | null): string => `<td>${n === null ? "—" : euros(n)}</td>`;
    return {
      any: a.any,
      html: `<tr><th scope="row">${a.any}</th><td class="ara">${eurosOBuit(a.lliure)}</td>${ambSupra ? cel(a.supramunicipal) : ""}${ambExtra ? cel(a.extraordinari) : ""}</tr>`,
    };
  });
  const primer = anys[anys.length - 1]!.any;
  return `<div class="coop-seccio">${titol}
  <p class="coop-frase">${fraseFcl(darrer, s, context)}</p>
  ${ambPlegades("coop-fcl", capcalera, files)}
  <p class="nota">${escape(NOTA_FCL)}${ambSupra || ambExtra ? " Un guió vol dir que aquell any el tram no es va repartir o la font no el porta." : ""}</p>
  ${peuFont(font, ` Imports de ${primer} a ${darrer.any}, en euros de cada any.`)}</div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Obres del PUOSC
// ─────────────────────────────────────────────────────────────────────────────

/** El primer any de la convocatòria actual: abans, la font salta del 2012 al 2020. */
const PRIMER_ANY_ACTUAL = 2013;

const sumaSubvencions = (obres: readonly ObraPuosc[]): number | null => {
  const amb = obres.filter((o) => o.subvencio !== null);
  return amb.length ? amb.reduce((t, o) => t + o.subvencio!, 0) : null;
};

const obresEscrit = (n: number): string => `${enter(n)} ${n === 1 ? "obra" : "obres"}`;

/**
 * «Des del 2020 la Generalitat li ha assignat 4 obres del PUOSC, amb 312.000 €
 * de subvenció. N'hi ha 2 més de programades per al 2027-2028, amb 150.000 €.»
 * Les assignades i les programades es diuen per separat: unes ja tenen l'any
 * passat, les altres són una previsió.
 */
export function fraseObres(obres: readonly ObraPuosc[], s: Subjecte = AJUNTAMENT): string {
  const actuals = obres.filter((o) => o.any >= PRIMER_ANY_ACTUAL);
  const assignades = actuals.filter((o) => o.estat === "assignada");
  const programades = actuals.filter((o) => o.estat === "programada");
  const parts: string[] = [];
  if (assignades.length) {
    const primer = Math.min(...assignades.map((o) => o.any));
    const suma = sumaSubvencions(assignades);
    parts.push(`Des del ${primer} la Generalitat ha assignat ${ambPreposicio("a", s)} <b>${obresEscrit(assignades.length)}</b> del PUOSC` +
      `${suma !== null ? `, amb ${euros(suma)} de subvenció` : ""}.`);
  }
  if (programades.length) {
    const anys = programades.map((o) => o.any);
    const [a, b] = [Math.min(...anys), Math.max(...anys)];
    const suma = sumaSubvencions(programades);
    const quan = a === b ? `per al ${a}` : `per als anys ${a}-${b}`;
    const quantes = assignades.length
      ? programades.length === 1 ? `I n'hi ha una més de programada ${quan}` : `I n'hi ha ${enter(programades.length)} més de programades ${quan}`
      : programades.length === 1 ? `Hi ha una obra del PUOSC programada ${quan}` : `Hi ha ${enter(programades.length)} obres del PUOSC programades ${quan}`;
    parts.push(`${quantes}${suma !== null ? `, amb ${euros(suma)}` : ""}: són anualitats previstes, no obres fetes.`);
  }
  if (!parts.length) {
    const antigues = obres.filter((o) => o.any < PRIMER_ANY_ACTUAL);
    if (antigues.length) {
      const anys = antigues.map((o) => o.any);
      parts.push(`La font no porta cap obra del PUOSC ${ambPreposicio("per a", s)} des del 2020; entre el ${Math.min(...anys)} i el ${Math.max(...anys)} n'hi consten ${obresEscrit(antigues.length)}.`);
    }
  }
  return parts.join(" ");
}

/** El nom d'una obra: el títol si en té, si no el tipus, i si no res inventat. */
function nomObra(o: ObraPuosc): string {
  const nom = o.titol ?? o.tipologia;
  const sota = [o.titol && o.tipologia ? o.tipologia : null, o.linia === "municipis petits" ? "línia de municipis petits" : null].filter(Boolean);
  return `${nom ? escape(nom) : `<span class="coop-buit">sense títol a la font</span>`}` +
    `${sota.length ? `<span class="coop-sota">${escape(sota.join(" · "))}</span>` : ""}`;
}

function filaObra(o: ObraPuosc): string {
  const etiqueta = o.estat === "programada" ? ` <span class="coop-etiqueta">programada</span>` : "";
  return `<tr><th scope="row">${o.any}${etiqueta}</th><td class="coop-text">${nomObra(o)}</td>` +
    `<td class="ara">${eurosOBuit(o.subvencio)}</td><td>${eurosOBuit(o.pressupost)}</td></tr>`;
}

/** «L'obra del 2001», «Les 3 obres del 2001», «Les 12 obres del 1996 al 2012». */
function resumAntigues(n: number, primer: number, darrer: number): string {
  const anys = primer === darrer ? `del ${primer}` : `del ${primer} al ${darrer}`;
  return n === 1 ? `L'obra ${anys}` : `Les ${enter(n)} obres ${anys}`;
}

function filaObraAntiga(o: ObraPuosc): string {
  return `<tr><th scope="row">${o.any}</th><td class="coop-text">${o.tipologia ? escape(o.tipologia) : `<span class="coop-buit">no consta</span>`}</td>` +
    `<td class="ara">${eurosOBuit(o.subvencio)}</td></tr>`;
}

export const NOTA_PUOSC =
  "El PUOSC (Pla únic d'obres i serveis) és el programa amb què la Generalitat paga una part de les obres dels " +
  "ajuntaments. La font no diu si una obra s'ha acabat: «assignada» és el que la Generalitat s'ha compromès a pagar " +
  "aquell any, i «programada» una anualitat prevista per a l'any en curs o els vinents. Del 2013 al 2019 la font no " +
  "publica cap obra: és un buit de la font.";

export function seccioObres(obres: readonly ObraPuosc[], font: FontDiners, s: Subjecte = AJUNTAMENT): string {
  const titol = `<h3 class="coop-titol">Obres del PUOSC</h3>`;
  if (obres.length === 0) {
    return `<div class="coop-seccio">${titol}
  <p>La font del PUOSC no porta cap obra ${ambPreposicio("per a", s)} a les convocatòries 1996-2012 i 2020-2029. No consta, que no
  vol dir que no n'hi hagi hagut cap.</p>
  ${peuFont(font)}</div>`;
  }
  const actuals = obres.filter((o) => o.any >= PRIMER_ANY_ACTUAL);
  const antigues = obres.filter((o) => o.any < PRIMER_ANY_ACTUAL);
  const taulaActuals = actuals.length ? taula("coop-obres", ["Any", "Obra", "Subvenció", "Pressupost de l'obra"], actuals.map(filaObra)) : "";
  const anysAntics = antigues.map((o) => o.any);
  const plegat = antigues.length
    ? `<details class="coop-detall"><summary>${resumAntigues(antigues.length, Math.min(...anysAntics), Math.max(...anysAntics))}</summary>
  ${taula("coop-obres-antigues", ["Any", "Tipus d'obra", "Subvenció"], antigues.map(filaObraAntiga))}
  <p class="nota">Les convocatòries d'aquells anys no publiquen el títol de l'obra ni el pressupost, només el tipus i la subvenció.</p></details>`
    : "";
  return `<div class="coop-seccio">${titol}
  <p class="coop-frase">${fraseObres(obres, s)}</p>
  ${taulaActuals}${plegat}
  <p class="nota">${escape(NOTA_PUOSC)}</p>
  ${peuFont(font)}</div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Envia els comptes?
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El pressupost i la liquidació tenen dues trameses cadascun: les dades
 * economicofinanceres i la documentació administrativa. A la taula surten en
 * una sola cel·la:
 *
 *   · totes dues trameses → «Tramès el …» amb la data de la darrera;
 *   · cap de les dues → «No tramès»;
 *   · una sí i l'altra no → «Tramès en part», amb el detall;
 *   · si la font només en porta una, aquella; si no en porta cap, `null`.
 */
export function combinaTrameses(economic: EstatDocument | null, administratiu: EstatDocument | null): (EstatDocument & { enPart?: string }) | null {
  if (!economic && !administratiu) return null;
  if (!economic || !administratiu) return (economic ?? administratiu)!;
  const observacio = [...new Set([economic.observacio, administratiu.observacio].filter((o): o is string => o !== null))].join(" · ") || null;
  if (economic.trames && administratiu.trames) {
    const dates = [economic.data, administratiu.data].filter((d): d is string => d !== null).sort();
    return { trames: true, data: dates[dates.length - 1] ?? null, observacio };
  }
  if (!economic.trames && !administratiu.trames) return { trames: false, data: null, observacio };
  const enviat = economic.trames ? economic : administratiu;
  const enPart = `${economic.trames ? "les dades econòmiques" : "la documentació administrativa"}` +
    `${enviat.data && isoDeData(enviat.data) ? ` ${elDia(enviat.data)}` : ""}; ${economic.trames ? "la documentació administrativa" : "les dades econòmiques"}, no`;
  return { trames: true, data: enviat.data, observacio, enPart };
}

/** Una cel·la de l'inventari: «Tramès el 9 d'octubre del 2024», «No tramès» o «no consta». Sense colors. */
export function celDocument(estat: (EstatDocument & { enPart?: string }) | null): string {
  if (!estat) return `<td class="coop-text coop-buit">no consta</td>`;
  const obs = estat.observacio ? `<span class="coop-sota">${escape(estat.observacio)}</span>` : "";
  if (estat.enPart) return `<td class="coop-text">Tramès en part<span class="coop-sota">${escape(estat.enPart)}</span>${obs}</td>`;
  if (!estat.trames) return `<td class="coop-text">No tramès${obs}</td>`;
  const data = estat.data && isoDeData(estat.data) ? elDia(estat.data) : null;
  return `<td class="coop-text">${data ? `Tramès ${data}` : "Tramès"}${obs}</td>`;
}

function filaTramesa(t: TramesaAny): string {
  return `<tr><th scope="row">${t.any}</th>` +
    celDocument(combinaTrameses(t.pressupost.economic, t.pressupost.administratiu)) +
    celDocument(combinaTrameses(t.liquidacio.economic, t.liquidacio.administratiu)) +
    celDocument(t.deute) +
    celDocument(t.compteGeneral) +
    `</tr>`;
}

/** A qui ha d'enviar cada document l'ens, i el recordatori dels terminis. */
function introTrameses(s: Subjecte): string {
  return `Cada any ${qui(s)} ha d'enviar el pressupost i la liquidació a la Generalitat, l'estat del deute a final d'any ` +
    `al Departament d'Economia i el compte general a la Sindicatura de Comptes. Aquest és l'estat de cada tramesa ` +
    `segons l'inventari oficial de la Generalitat.`;
}

export const NOTA_TRAMESES =
  "La liquidació, l'estat del deute i el compte general d'un any es lliuren l'any següent: un «No tramès» dels " +
  "darrers anys pot voler dir que encara no ha vençut el termini. «No consta» vol dir que l'inventari no en diu res " +
  "per a aquell any i document.";

export function seccioTrameses(trameses: TramesesDesades, font: FontDiners, s: Subjecte = AJUNTAMENT): string {
  const titol = `<h3 class="coop-titol">Envia els comptes?</h3>`;
  if (trameses.anys.length === 0) {
    return `<div class="coop-seccio">${titol}
  <p>${qui(s).charAt(0).toUpperCase()}${qui(s).slice(1)} no surt a l'inventari de trameses de la Generalitat: no consta.</p>
  ${peuFont(font)}</div>`;
  }
  const anys = [...trameses.anys].sort((a, b) => b.any - a.any);
  const files = anys.map((t) => ({ any: t.any, html: filaTramesa(t) }));
  const actualitzat = trameses.actualitzat && isoDeData(trameses.actualitzat) ? elDia(trameses.actualitzat) : null;
  return `<div class="coop-seccio">${titol}
  <p class="coop-frase">${introTrameses(s)}</p>
  ${ambPlegades("coop-trameses", ["Any", "Pressupost", "Liquidació", "Deute", "Compte general"], files)}
  <p class="nota">${escape(NOTA_TRAMESES)}</p>
  ${peuFont(font, actualitzat ? ` Inventari actualitzat ${actualitzat}.` : "")}</div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// El que li deu la Generalitat
// ─────────────────────────────────────────────────────────────────────────────

/** Els noms llargs dels tipus d'ajut que la font abreuja. */
const CONCEPTES: Readonly<Record<string, string>> = {
  FCL: "Fons de Cooperació Local",
  PUOSC: "Obres del PUOSC",
};

const nomConcepte = (c: ConceptePendent): string => CONCEPTES[c.tipus] ?? c.tipus;

export const NOTA_PENDENTS =
  "És el calendari normal de pagaments: la Generalitat reconeix el que toca a cada ens i el paga per terminis al " +
  "llarg de l'any, i per això a cada relació mensual hi surten centenars d'ajuntaments. Un pagament " +
  "«retingut» és el que la Generalitat no fa fins que l'ens li enviï la documentació economicofinancera que li falta " +
  "(Decret 80/2023).";

export function seccioPendents(pendents: PendentsDesats | null, font: FontDiners, s: Subjecte = AJUNTAMENT): string {
  const titol = `<h3 class="coop-titol">El que li deu la Generalitat</h3>`;
  if (!pendents) {
    return `<div class="coop-seccio">${titol}
  <p>No s'ha pogut llegir la relació de pagaments pendents de la Generalitat ${ambPreposicio("a", s)}: no consta.</p>
  ${peuFont(font)}</div>`;
  }
  // «del 9 d'octubre…», «el 9 d'octubre…»; si la font no porta una data llegible, es diu tal com ve.
  const llegible = isoDeData(pendents.data) !== null;
  const delData = llegible ? delDia(pendents.data) : `del ${pendents.data}`;
  const ElData = llegible ? elDiaAlPrincipi(pendents.data) : `El ${pendents.data}`;
  if (pendents.conceptes.length === 0) {
    return `<div class="coop-seccio">${titol}
  <p>A la relació ${delData}, ${qui(s)} no hi surt: aquell dia la Generalitat no hi tenia cap pagament reconegut pendent.</p>
  ${peuFont(font)}</div>`;
  }
  // Una sola font i un sol pagador: aquí sí que es pot fer el total.
  const total = pendents.conceptes.reduce((t, c) => t + c.import, 0);
  const algunRetingut = pendents.conceptes.some((c) => c.retingut);
  const files = pendents.conceptes.map((c) =>
    `<tr><th scope="row">${escape(nomConcepte(c))}</th><td>${c.exercici ?? `<span class="coop-buit">no consta</span>`}</td>` +
      `<td class="ara">${euros(c.import)}</td>${algunRetingut ? `<td class="coop-text">${c.retingut ? "Retingut" : ""}</td>` : ""}</tr>`,
  );
  return `<div class="coop-seccio">${titol}
  <p class="coop-frase">${ElData} la Generalitat tenia reconeguts <b>${euros(total)}</b> ${ambPreposicio("a", s)} que encara no li havia pagat.</p>
  ${taula("coop-pendents", ["Concepte", "Exercici", "Pendent", ...(algunRetingut ? ["Estat"] : [])], files)}
  <p class="nota">${escape(NOTA_PENDENTS)}</p>
  ${peuFont(font, ` Relació ${delData}: és una fotografia d'aquell dia, no una sèrie.`)}</div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// El bloc de la fitxa municipal
// ─────────────────────────────────────────────────────────────────────────────

export const TITOL_DINERS_GENERALITAT = "Què rep de la Generalitat, i si li envia els comptes";
export const CURT_DINERS_GENERALITAT = "La Generalitat";

/**
 * El contingut del bloc, sense la secció que l'embolcalla: és el que va a la
 * llista de blocs de la fitxa (`id`, `titol`, `html`) de radiografia.ts. Mai
 * retorna cadena buida: sense J41 executada, diu que no consta.
 */
export function renderDinersGeneralitatBloc(dades: DinersGeneralitat | null | undefined, context: ContextDiners = {}): string {
  if (!dades) {
    return `<p class="entrada-bloc">Encara no hem llegit el que la Generalitat dona a aquest ajuntament ni si li envia els
  comptes. No consta, que no vol dir zero.</p>`;
  }
  return `<p class="entrada-bloc">Entre l'ajuntament i la Generalitat hi ha tres fils de diners: el Fons de Cooperació Local,
  que l'ajuntament gasta com vol; les obres del PUOSC, que la Generalitat paga en part; i el que encara li ha de pagar.
  Cada fil va per separat, i cap no se suma amb el que hi posen la diputació o el consell comarcal.</p>
  ${seccioFcl(dades.fcl, dades.fonts.fcl, AJUNTAMENT, context)}
  ${seccioObres(dades.obres, dades.fonts.puosc)}
  ${seccioTrameses(dades.trameses, dades.fonts.trameses)}
  ${seccioPendents(dades.pendents, dades.fonts.pendents)}`;
}

/** El bloc sencer com a secció de la fitxa, amb el títol. */
export function renderDinersGeneralitat(dades: DinersGeneralitat | null | undefined, context: ContextDiners = {}): string {
  return `<section class="bloc" id="diners-generalitat">
  <h2>${TITOL_DINERS_GENERALITAT}</h2>
  ${renderDinersGeneralitatBloc(dades, context)}
</section>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Les fitxes dels ens: adaptador i fragment
// ─────────────────────────────────────────────────────────────────────────────

const esObjecte = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Una mètrica desada amb prou forma per pintar-la: ni una fila d'una versió
 * antiga ni un JSON trencat no han de fer petar la fitxa. Torna `null` si no
 * hi és tot el que el render llegeix.
 */
export function llegeixDinersGeneralitat(data: unknown): DinersGeneralitat | null {
  if (!esObjecte(data) || typeof data.codiEns !== "string") return null;
  if (!(data.fcl === null || Array.isArray(data.fcl)) || !Array.isArray(data.obres)) return null;
  if (!esObjecte(data.trameses) || !Array.isArray(data.trameses.anys)) return null;
  if (!(data.pendents === null || (esObjecte(data.pendents) && Array.isArray(data.pendents.conceptes)))) return null;
  if (!esObjecte(data.fonts) || !["fcl", "puosc", "trameses", "pendents"].every((k) => esObjecte((data.fonts as Record<string, unknown>)[k]))) return null;
  return data as unknown as DinersGeneralitatBase;
}

/**
 * L'adaptador per al carregador de les fitxes d'ens (`ens-dades.ts`): de les
 * files de `municipality_metrics` amb kind `dinersGeneralitatEns:<codiEns>`,
 * un mapa per codi d'ens. Les files d'un altre kind o sense forma s'ignoren.
 */
export function indexaDinersGeneralitatEns(files: Iterable<{ kind: string; data: unknown }>): Map<string, DinersGeneralitatEnsDesat> {
  const perCodi = new Map<string, DinersGeneralitatEnsDesat>();
  for (const f of files) {
    if (!f.kind.startsWith(PREFIX_KIND_DINERS_GENERALITAT_ENS)) continue;
    const base = llegeixDinersGeneralitat(f.data);
    const d = f.data as Partial<DinersGeneralitatEnsDesat> | null;
    if (!base || !d || typeof d.nom !== "string" || !(d.tipus === "consell" || d.tipus === "diputacio" || d.tipus === "amb")) continue;
    perCodi.set(base.codiEns, { ...base, nom: d.nom, tipus: d.tipus });
  }
  return perCodi;
}

/** Les dades d'un ens concret, o `null` si la J41 no n'ha desat res. */
export function dinersGeneralitatEns(files: Iterable<{ kind: string; data: unknown }>, codiEns: string): DinersGeneralitatEnsDesat | null {
  return indexaDinersGeneralitatEns(files).get(codiEns) ?? null;
}

/**
 * El fragment per a la fitxa d'un ens, sense secció ni títol `h2` (el posa
 * `ens.ts`). Als consells i a l'AMB, el fons sense condicions i les obres; a
 * tots, si envien els comptes, i el que la Generalitat els deu si hi surten.
 * Les diputacions no reben el Fons de Cooperació Local, i el text ho diu en
 * comptes de deixar un forat. Sense dades torna cadena buida: la fitxa d'ens
 * decideix si ho diu.
 */
export function renderDinersGeneralitatEns(dades: DinersGeneralitatEnsDesat | null | undefined): string {
  if (!dades) return "";
  const s = SUBJECTES_ENS[dades.tipus];
  const fcl = dades.fcl === null
    ? `<p class="coop-frase">Les diputacions no reben el Fons de Cooperació Local de la Generalitat: la llei el reparteix
  entre els municipis, els consells comarcals, l'AMB i les entitats municipals descentralitzades.</p>`
    : seccioFcl(dades.fcl, dades.fonts.fcl, s);
  const obres = dades.obres.length > 0 ? seccioObres(dades.obres, dades.fonts.puosc, s) : "";
  const pendents = dades.pendents && dades.pendents.conceptes.length > 0 ? seccioPendents(dades.pendents, dades.fonts.pendents, s) : "";
  return `<div class="coop-ens">
  ${fcl}
  ${obres}
  ${seccioTrameses(dades.trameses, dades.fonts.trameses, s)}
  ${pendents}
</div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Estil
// ─────────────────────────────────────────────────────────────────────────────

/**
 * L'estil propi del bloc. Les taules són les `balanc` de la fitxa; aquí només
 * hi ha els títols d'apartat (en caixa normal, sense majúscules espaiades),
 * les cel·les de text, el «no consta» i l'etiqueta «programada», que és una
 * marca de dada en lavanda i no cap color de veredicte.
 */
export const COOPERACIO_CSS = `
.coop-seccio{margin:var(--e3) 0 0}
.coop-seccio + .coop-seccio{border-top:1px solid var(--vora);padding-top:var(--e2)}
.coop-titol{font-family:var(--display);font-weight:800;font-size:1.15rem;line-height:1.25;margin:0 0 var(--e1)}
.coop-frase{margin:var(--e1) 0}
.coop-taula td.coop-text{text-align:left;padding-left:12px}
.coop-taula .coop-buit,.coop-taula td.coop-buit{color:var(--ink-suau);font-style:italic}
.coop-sota{display:block;font-size:.8rem;font-weight:500;color:var(--ink-suau);line-height:1.3;margin-top:2px}
.coop-etiqueta{display:inline-block;font-size:.75rem;font-weight:700;background:var(--lavanda);color:var(--ink);
  border:1.5px solid var(--ink);border-radius:var(--r-max);padding:0 .5em;margin-left:.3em;white-space:nowrap;vertical-align:.1em}
.coop-detall{margin:var(--e1) 0 0;border-top:1px solid var(--vora);padding-top:var(--e1)}
.coop-detall summary{cursor:pointer;font-weight:700}
.coop-detall summary:focus-visible{outline:3px solid var(--coral);outline-offset:2px;border-radius:var(--r-s)}
@media (max-width:480px){.coop-taula{font-size:.86rem}.coop-taula td.coop-text{padding-left:8px}}
`;
