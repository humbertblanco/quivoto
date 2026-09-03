import { BRANDS_BY_ID, siglesFamily } from "@quivoto/shared-schemas/brands";
import { MUNICIPALS, type CandidatLlistaOberta, type EleccioLlistaOberta, type LlistesObertesMetric } from "../jobs/j37-llistes-obertes";
import { normalizePersonName } from "../lib/text";
import { type Curiositat, type FilaCuriosa, type FilaCuriositat } from "./curiositats";
import { adrecesRegidors } from "./regidor";

/**
 * «Aquí es vota persones»: el bloc de la fitxa amb el vot nominal de les
 * llistes obertes, i les curiositats que en surten per als 947.
 *
 * Tres decisions de forma, heretades de la resta de la fitxa:
 *
 *   · **Només on hi ha dada.** El bloc no surt als 770 municipis de llistes
 *     tancades: allà no hi ha res a dir, i dir «aquí no» 770 vegades és
 *     soroll. Als que han votat en llista oberta alguna vegada hi és sempre,
 *     encara que avui ja votin llistes.
 *   · **La darrera elecció oberta, i les anteriors plegades.** La taula de
 *     l'última és el que la gent ve a mirar; les altres hi són per a qui
 *     vulgui seguir un nom, dins d'un `<details>` per elecció.
 *   · **El nom porta a la persona, si és al ple.** L'aparellament és el de
 *     tot el projecte —`normalizePersonName()`— i amb la mateixa cautela que
 *     les fotografies: un nom que lliga amb dues persones del ple no enllaça
 *     cap. Cap veredicte: qui va treure més vots no és millor regidor.
 *
 * Les classes van totes amb el prefix `llo-`: una classe nua com `.marca` o
 * `.xifres li` xoca amb el peu i amb les tessel·les.
 */

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const enter = (n: number): string => n.toLocaleString("ca-ES", { maximumFractionDigits: 0 });

/** El color de la família de la candidatura, o `null` si les sigles no en diuen cap. */
export function colorDeCandidatura(sigles: string): string | null {
  const familia = sigles === "" ? null : siglesFamily(sigles);
  return familia === null ? null : (BRANDS_BY_ID.get(familia)?.color ?? null);
}

/**
 * On és la fitxa de cada persona del ple, per la clau de nom: `regidor/<adreça>/`,
 * relatiu a `m/<slug>/`. Es calcula amb `adrecesRegidors()` sobre la mateixa
 * llista i en el mateix ordre que el generador de pàgines, que és el que fa
 * que l'enllaç existeixi. Un nom repetit al ple no enllaça enlloc.
 */
export function adrecesDelPle(ple: readonly { nom: string }[]): ReadonlyMap<string, string> {
  const adreces = adrecesRegidors(ple);
  const perClau = new Map<string, string | null>();
  for (const persona of ple) {
    const clau = normalizePersonName(persona.nom);
    if (!clau) continue;
    perClau.set(clau, perClau.has(clau) ? null : `regidor/${adreces.get(persona)!}/`);
  }
  return new Map([...perClau].filter((e): e is [string, string] => e[1] !== null));
}

/** «fins a quatre noms», «fins a dos noms», «un sol nom». */
function nomsEscrits(e: EleccioLlistaOberta): string {
  if (e.nomsPerPapereta === 1) return "un sol nom";
  if (e.nomsPerPapereta === 2) return "fins a dos noms";
  if (e.nomsPerPapereta === 4) return "fins a quatre noms";
  return "els noms que la llei permetia";
}

/** «3 regidories», «1 regidoria (l'alcaldia, en consell obert)». */
function regidoriesEscrites(e: EleccioLlistaOberta): string {
  if (e.regidors === 1) return "una sola persona, l'alcaldia: el municipi funciona en consell obert";
  return `${enter(e.regidors)} regidories`;
}

/**
 * La taula d'una elecció: candidat, candidatura amb el color de la família,
 * vots i si va sortir elegit. La fila de qui és avui al ple porta l'enllaç a
 * la seva pàgina; la resta, el nom i prou.
 */
export function taulaEleccio(e: EleccioLlistaOberta, regidors: ReadonlyMap<string, string> = new Map()): string {
  const files = e.candidats
    .map((c) => {
      const href = regidors.get(c.clau);
      const nom = href ? `<a href="${escape(href)}">${escape(c.nom)}</a>` : escape(c.nom);
      const color = colorDeCandidatura(c.candidatura.sigles);
      const punt = color ? `<span class="llo-punt" style="background:${escape(color)}" aria-hidden="true"></span>` : "";
      const sigles = c.candidatura.sigles === "" ? "—" : escape(c.candidatura.sigles);
      const titol = c.candidatura.nom === "" ? "" : ` title="${escape(c.candidatura.nom)}"`;
      return `<tr class="${c.elegit ? "llo-elegit" : "llo-no"}">
      <th scope="row">${nom}${c.suplent ? ' <span class="llo-suplent">suplent</span>' : ""}</th>
      <td${titol}>${punt}${sigles}</td>
      <td class="llo-vots">${enter(c.vots)}</td>
      <td class="llo-si">${c.elegit ? "sí" : "no"}</td>
    </tr>`;
    })
    .join("");
  return `<div class="taula-envolta"><table class="balanc llo-taula">
  <thead><tr><th>Persona</th><th>Candidatura</th><th>Vots</th><th>Elegida</th></tr></thead>
  <tbody>${files}</tbody>
  </table></div>`;
}

/** «El 2023 s'elegien 3 regidories entre 6 persones; cada elector podia escriure fins a dos noms. Van votar 21 dels 26 electors.» */
function fraseEleccio(e: EleccioLlistaOberta): string {
  let frase = `El <b>${e.any}</b> s'${e.regidors === 1 ? "elegia" : "elegien"} ${regidoriesEscrites(e)} entre ${enter(e.candidats.length)} ${
    e.candidats.length === 1 ? "persona" : "persones"
  }; cada elector podia escriure ${nomsEscrits(e)}.`;
  if (e.votants !== null && e.electors !== null && e.electors > 0) {
    frase += ` Van votar ${enter(e.votants)} dels ${enter(e.electors)} electors`;
    const extres: string[] = [];
    if (e.blancs) extres.push(`${enter(e.blancs)} en blanc`);
    if (e.nuls) extres.push(`${enter(e.nuls)} ${e.nuls === 1 ? "nul" : "nuls"}`);
    frase += extres.length > 0 ? ` (${extres.join(", ")}).` : ".";
  }
  return frase;
}

/** L'explicació del sistema, curta i sense veredicte, que obre el bloc. */
export const EXPLICACIO =
  "Als municipis de fins a 250 habitants no es vota una llista sinó persones: cada elector escriu a la papereta " +
  "els noms que vol, de la candidatura que vulgui, i surten elegides les més votades (article 184 de la llei electoral). " +
  "Als que funcionen en consell obert s'elegeix directament només l'alcaldia, i la resta de decisions les pren l'assemblea de veïns.";

/**
 * El contingut del bloc, sense la secció que l'embolcalla: és el que va a la
 * llista de blocs de la fitxa (`id`, `titol`, `html`) de radiografia.ts.
 * Retorna cadena buida sense dada: el registre de seccions no la publica.
 */
export function renderLlistesObertesBloc(dades: LlistesObertesMetric | null | undefined, regidors: ReadonlyMap<string, string> = new Map()): string {
  if (!dades || dades.eleccions.length === 0) return "";
  const eleccions = [...dades.eleccions].sort((a, b) => b.any - a.any);
  const darrera = eleccions[0]!;
  const anteriors = eleccions.slice(1);
  // Sense la darrera municipal a les dades no es pot dir que «des de llavors
  // hi vota llistes»: pot ser que el Ministeri encara no l'hagi servida (el
  // 2023 va faltar durant setmanes). Un buit no és un zero: es diu el buit.
  const ultima = MUNICIPALS[MUNICIPALS.length - 1]!.any;
  const avui = darrera.any === ultima ? "" : ` La darrera elecció amb dades aquí és la del ${darrera.any}; les del ${ultima} encara no hi són.`;
  const peu = `<p class="peu-nota">Font: <a href="${escape(dades.font.url)}" rel="noopener nofollow">${escape(dades.font.organisme)}</a>, ` +
    `fitxers de candidats dels municipis de menys de 250 habitants de les municipals ${eleccions[eleccions.length - 1]!.any}-${darrera.any}, ` +
    `consultats el ${escape(dades.font.consultat)}. Els noms s'escriuen com els publica el Ministeri; ` +
    `l'enllaç porta a la fitxa de qui és avui al ple amb el mateix nom.</p>`;
  return `<p class="entrada-bloc">${escape(EXPLICACIO)}${avui}</p>
  <p class="llo-frase">${fraseEleccio(darrera)}</p>
  ${taulaEleccio(darrera, regidors)}
  ${anteriors.length > 0 ? `<div class="llo-anteriors">
  <h3 class="llo-titol">Les anteriors</h3>
  ${anteriors.map((e) => `<details class="llo-detall"><summary>${e.any} · ${enter(e.regidors)} ${e.regidors === 1 ? "regidoria" : "regidories"}, ${enter(e.candidats.length)} ${e.candidats.length === 1 ? "persona" : "persones"}</summary>
  <p class="llo-frase">${fraseEleccio(e)}</p>
  ${taulaEleccio(e, regidors)}</details>`).join("\n  ")}
  </div>` : ""}
  ${peu}`;
}

/** El bloc sencer com a secció de la fitxa, amb el títol; buit sense dada. */
export function renderLlistesObertes(dades: LlistesObertesMetric | null | undefined, regidors?: ReadonlyMap<string, string>): string {
  const cos = renderLlistesObertesBloc(dades, regidors);
  if (cos === "") return "";
  return `<section class="bloc" id="llistes-obertes">
  <h2>Aquí es vota persones</h2>
  ${cos}
</section>`;
}

export const LLISTES_OBERTES_CSS = `
.llo-frase{margin:var(--e1) 0}
.llo-taula td{font-variant-numeric:tabular-nums}
.llo-taula .llo-vots,.llo-taula .llo-si{text-align:right}
.llo-taula .llo-elegit th{font-weight:700}
.llo-taula .llo-elegit .llo-si{color:var(--coral-text);font-weight:700}
.llo-taula .llo-no th,.llo-taula .llo-no td{color:var(--ink-suau)}
.llo-punt{display:inline-block;width:.7em;height:.7em;border-radius:50%;border:1.5px solid var(--ink);margin-right:.35em;vertical-align:-.05em}
.llo-suplent{font-size:.8rem;font-weight:400;color:var(--ink-suau);background:var(--presec);border-radius:var(--r-max);padding:0 .5em;margin-left:.3em}
.llo-anteriors{margin:var(--e2) 0 0}
.llo-titol{font-family:var(--display);font-weight:900;font-size:.8rem;letter-spacing:.03em;text-transform:uppercase;color:var(--ink-suau);margin:0 0 4px}
.llo-detall{margin:var(--e1) 0 0;border-top:1px solid var(--vora);padding-top:var(--e1)}
.llo-detall summary{cursor:pointer;font-weight:700}
`;

// ------------------------------------------------------------ curiositats

/** Un nom d'una elecció oberta, i on és la seva fitxa (relativa a `m/<slug>/`) si és avui al ple. */
export type PersonaResum = { nom: string; vots: number; href: string | null };

/** El que els 947 necessiten de la darrera elecció oberta d'un municipi. */
export type ResumLlistesObertes = {
  any: number;
  regidors: number;
  persones: number;
  /** Quantes municipals ha votat en llista oberta des del 1979. */
  eleccions: number;
  /** Qui va sortir elegit amb menys vots, i qui en va treure més. */
  min: PersonaResum | null;
  max: PersonaResum | null;
  /** Vots de l'últim elegit menys els del primer no elegit; `null` si tothom va sortir. */
  marge: number | null;
};

const persona = (c: CandidatLlistaOberta, hrefs: ReadonlyMap<string, string>): PersonaResum =>
  ({ nom: c.nom, vots: c.vots, href: hrefs.get(c.clau) ?? null });

/** El resum de la darrera elecció oberta, o `null` sense cap. */
export function resumLlistesObertes(dades: LlistesObertesMetric | null | undefined, hrefs: ReadonlyMap<string, string> = new Map()): ResumLlistesObertes | null {
  if (!dades || dades.eleccions.length === 0) return null;
  const darrera = [...dades.eleccions].sort((a, b) => b.any - a.any)[0]!;
  const elegits = darrera.candidats.filter((c) => c.elegit);
  const noElegits = darrera.candidats.filter((c) => !c.elegit);
  const min = elegits.length > 0 ? elegits.reduce((a, b) => (b.vots < a.vots ? b : a)) : null;
  const max = darrera.candidats.length > 0 ? darrera.candidats.reduce((a, b) => (b.vots > a.vots ? b : a)) : null;
  const primerFora = noElegits.length > 0 ? noElegits.reduce((a, b) => (b.vots > a.vots ? b : a)) : null;
  return {
    any: darrera.any,
    regidors: darrera.regidors,
    persones: darrera.candidats.length,
    eleccions: dades.eleccions.length,
    min: min ? persona(min, hrefs) : null,
    max: max ? persona(max, hrefs) : null,
    marge: min && primerFora ? min.vots - primerFora.vots : null,
  };
}

/** La fila dels 947 amb el resum: el mateix nom `lo` que a `Els947Row`. */
export type FilaLlistesObertes = FilaCuriositat & { lo?: ResumLlistesObertes | null };

const n = (v: number): string => v.toLocaleString("ca-ES", { maximumFractionDigits: 0 });
const municipi = (f: FilaLlistesObertes): FilaCuriosa["municipi"] => ({ s: f.s, n: f.n, c: f.c });

/** Cap nom sense fitxa: si la persona no té pàgina, la fila diu només el municipi. */
const ambPersona = (f: FilaLlistesObertes, p: PersonaResum): Pick<FilaCuriosa, "persona"> =>
  p.href ? { persona: { nom: p.nom, href: `../m/${f.s}/${p.href}` } } : {};

/**
 * Les curiositats de les llistes obertes, sobre la darrera elecció oberta
 * més freqüent entre els que en tenen: quants municipis voten persones, qui
 * va entrar al ple amb menys vots, qui en va treure més, i on l'última
 * regidoria es va decidir per un vot o per empat.
 */
export function curiositatsLlistesObertes(files: readonly FilaLlistesObertes[]): Curiositat[] {
  const ambDada = files.filter((f): f is FilaLlistesObertes & { lo: ResumLlistesObertes } => !!f.lo);
  if (ambDada.length === 0) return [];
  const compte = new Map<number, number>();
  for (const f of ambDada) compte.set(f.lo.any, (compte.get(f.lo.any) ?? 0) + 1);
  const any = [...compte.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]![0];
  const delAny = ambDada.filter((f) => f.lo.any === any);
  const font = "Ministeri de l'Interior · candidats dels municipis de menys de 250 habitants";
  const cobertura = `S'ha mirat la darrera elecció en llista oberta o consell obert de ${n(delAny.length)} municipis dels ${n(files.length)}: els que hi van votar el ${any}.`;
  const detall = (f: FilaLlistesObertes & { lo: ResumLlistesObertes }): string =>
    `${n(f.lo.persones)} ${f.lo.persones === 1 ? "persona" : "persones"} per ${n(f.lo.regidors)} ${f.lo.regidors === 1 ? "regidoria" : "regidories"} · ${n(f.p)} habitants`;
  const fets: Curiositat[] = [];

  // ---- quants voten persones ---------------------------------------------
  const mesPoblats = [...delAny].sort((a, b) => b.p - a.p || a.n.localeCompare(b.n, "ca")).slice(0, 5);
  fets.push({
    id: "voten-persones",
    titol: "On es vota persones i no llistes",
    metode: `Municipis que a les municipals del ${any} van votar en llista oberta (fins a 250 habitants) o en consell obert, segons els fitxers de candidats del Ministeri.`,
    periode: String(any),
    font,
    llistes: [{ cap: `Els cinc més poblats dels ${n(delAny.length)}`, files: mesPoblats.map((f) => ({ municipi: municipi(f), valor: `${n(f.lo.persones)} candidats`, detall: detall(f) })) }],
    cobertura,
    cautela: "Compta els municipis que hi surten al fitxer del Ministeri; el llindar és el cens de l'any de l'elecció, no el padró d'avui.",
  });

  // ---- l'elegit amb menys vots, i el més votat -----------------------------
  const ambMin = delAny.filter((f) => f.lo.min !== null);
  if (ambMin.length > 0) {
    const ordenats = [...ambMin].sort((a, b) => a.lo.min!.vots - b.lo.min!.vots || a.n.localeCompare(b.n, "ca")).slice(0, 10);
    fets.push({
      id: "elegit-menys-vots",
      titol: "Qui va entrar al ple amb menys vots",
      metode: `A cada municipi de llista oberta, la persona elegida amb menys vots a les municipals del ${any}.`,
      periode: String(any),
      font,
      llistes: [{ cap: "Les regidories amb menys vots de Catalunya", files: ordenats.map((f) => ({ municipi: municipi(f), ...ambPersona(f, f.lo.min!), valor: `${n(f.lo.min!.vots)} ${f.lo.min!.vots === 1 ? "vot" : "vots"}`, detall: detall(f) })) }],
      cobertura,
      cautela: "Als pobles de trenta electors, deu vots són un terç del cens: la xifra no diu res del suport si no es mira al costat de quants van votar.",
    });
  }
  const ambMax = delAny.filter((f) => f.lo.max !== null);
  if (ambMax.length > 0) {
    const ordenats = [...ambMax].sort((a, b) => b.lo.max!.vots - a.lo.max!.vots || a.n.localeCompare(b.n, "ca")).slice(0, 10);
    fets.push({
      id: "mes-votat-llista-oberta",
      titol: "Els noms més votats en llista oberta",
      metode: `A cada municipi de llista oberta, la persona amb més vots a les municipals del ${any}.`,
      periode: String(any),
      font,
      llistes: [{ cap: "Els que en van treure més", files: ordenats.map((f) => ({ municipi: municipi(f), ...ambPersona(f, f.lo.max!), valor: `${n(f.lo.max!.vots)} vots`, detall: detall(f) })) }],
      cobertura,
      cautela: "Cada elector pot escriure diversos noms: els vots d'una persona no sumen amb els de les altres, i el màxim depèn del cens del poble.",
    });
  }

  // ---- per un sol vot, o per empat -----------------------------------------
  const ajustats = delAny.filter((f) => f.lo.marge !== null && f.lo.marge <= 1);
  if (ajustats.length > 0) {
    const ordenats = [...ajustats].sort((a, b) => a.lo.marge! - b.lo.marge! || b.p - a.p || a.n.localeCompare(b.n, "ca")).slice(0, 10);
    fets.push({
      id: "regidoria-per-un-vot",
      titol: "On l'última regidoria es va decidir per un vot",
      metode: `Municipis on la persona elegida amb menys vots en va tenir només un més —o els mateixos— que la primera que va quedar fora, a les municipals del ${any}.`,
      periode: String(any),
      font,
      llistes: [{ cap: `${ajustats.length === 1 ? "L'únic" : `Els ${n(ajustats.length)}`} on va anar tan just`, files: ordenats.map((f) => ({ municipi: municipi(f), ...ambPersona(f, f.lo.min!), valor: f.lo.marge === 0 ? "empat" : "per un vot", detall: `${n(f.lo.min!.vots)} vots l'última regidoria · ${detall(f)}` })) }],
      cobertura,
      cautela: "Un empat el resol el sorteig de la junta electoral, i el fitxer diu qui va sortir, no com.",
    });
  }

  return fets;
}
