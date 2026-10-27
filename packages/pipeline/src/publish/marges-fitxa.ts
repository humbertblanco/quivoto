import type { MargesEleccio, MargesMetric } from "../derive/marges";

/**
 * «L'últim regidor»: el bloc de la fitxa que diu per quants vots es va decidir
 * el ple.
 *
 * Tres decisions de forma, heretades de la resta de la fitxa:
 *
 *   · **Una frase primer, i la taula després.** El que es llegeix d'un cop
 *     d'ull és qui es va endur l'última regidoria i per quants vots; la taula
 *     de sota, llista per llista, és per a qui vulgui mirar la seva.
 *   · **Cap veredicte, i cap predicció.** Que a una llista li faltessin set
 *     vots no diu que «s'hagi d'esforçar» ni que el 2027 els tindrà: diu què
 *     hauria passat amb set vots més i tota la resta igual. La nota ho diu
 *     sempre, al costat de la xifra, i el bloc no fa servir cap color de
 *     guanyador ni de perdedor.
 *   · **La darrera elecció, i les anteriors plegades.** Només amb una frase
 *     cadascuna: la taula sencera d'eleccions passades és soroll.
 *
 * Les classes van totes amb el prefix `marges-`: una classe nua com `.marca`
 * o `.xifres` xoca amb el peu i amb les tessel·les. Les que no en porten
 * (`entrada-bloc`, `taula-envolta`, `balanc`) són les compartides de la fitxa,
 * definides a `RADIOGRAFIA_CSS`, i aquí només s'hi fan servir.
 */

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const enter = (n: number): string => n.toLocaleString("ca-ES", { maximumFractionDigits: 0 });
const percent = (n: number): string =>
  `${n.toLocaleString("ca-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;

/** «1 vot», «7 vots», «1.234 vots». */
export const vots = (n: number): string => `${enter(n)} ${n === 1 ? "vot" : "vots"}`;

/** «1 regidoria», «8 regidories». */
const regidories = (n: number): string => `${enter(n)} ${n === 1 ? "regidoria" : "regidories"}`;

/** La denominació, amb les sigles al costat quan no són el mateix text. */
function nomAmbSigla(nom: string, sigla: string): string {
  if (!sigla || nom === sigla) return `<b>${escape(nom)}</b>`;
  return `<b>${escape(nom)}</b> <span class="marges-sigla">(${escape(sigla)})</span>`;
}

/**
 * La frase de l'última regidoria d'una elecció, o `null` si no n'hi ha cap
 * en disputa (una sola llista, o ningú fora a les llistes obertes).
 *
 * A les llistes obertes l'última regidoria és d'una persona i no d'una llista,
 * i quan l'última elegida i la primera de fora tenien els mateixos vots ho va
 * decidir el sorteig: es diu així, que «per 1 vot» seria fals.
 */
export function fraseUltimEsco(e: MargesEleccio): string | null {
  const u = e.ultimEsco;
  if (!u) return null;
  if (e.sistema === "obertes" && u.votsGuanyador !== null && u.votsPerseguidor !== null) {
    const qui = `${escape(u.guanyador)}${u.siglaGuanyador ? ` <span class="marges-sigla">(${escape(u.siglaGuanyador)})</span>` : ""}`;
    const altre = `${escape(u.perseguidor)}${u.siglaPerseguidor ? ` <span class="marges-sigla">(${escape(u.siglaPerseguidor)})</span>` : ""}`;
    if (u.votsGuanyador === u.votsPerseguidor) {
      return `L'última regidoria del ${e.any} va ser per a <b>${qui}</b>, empatada a ${vots(u.votsGuanyador)}
  amb ${altre}: amb un empat, la llei ho decideix per sorteig.`;
    }
    return `L'última regidoria del ${e.any} va ser per a <b>${qui}</b>, amb ${vots(u.votsGuanyador)};
  ${altre} en va treure ${enter(u.votsPerseguidor)} i n'hi van faltar <b>${enter(u.votsQueFaltaven)}</b> per passar-la.`;
  }
  return `L'últim regidor del ${e.any} el va guanyar ${nomAmbSigla(u.guanyador, u.siglaGuanyador)}
  per <b>${vots(u.votsQueFaltaven)}</b>: és el que li faltava a ${nomAmbSigla(u.perseguidor, u.siglaPerseguidor)}
  per endur-se'l.`;
}

/** La taula de les llistes d'una elecció d'Hondt: vots, regidories i els dos marges. */
function taulaDHondt(e: MargesEleccio): string {
  const files = e.llistes
    .map((l) => `<tr${l.escons === 0 ? ' class="marges-sense"' : ""}>
      <th scope="row">${escape(l.sigla || l.nom)}</th>
      <td class="marges-n">${enter(l.vots)}</td>
      <td class="marges-n">${enter(l.escons)}</td>
      <td class="marges-n">${l.votsPerUnaMes === null ? "—" : enter(l.votsPerUnaMes)}</td>
      <td class="marges-n">${l.margeDePerdua === null ? "—" : enter(l.margeDePerdua)}</td>
    </tr>`)
    .join("");
  return `<div class="taula-envolta"><table class="balanc marges-taula">
    <caption class="marges-peu-taula">Vots que li faltaven per a una regidoria més, i vots que podia perdre sense perdre'n cap</caption>
    <thead><tr><th scope="col">Llista</th><th scope="col" class="marges-n">Vots</th><th scope="col" class="marges-n">Regidories</th>
      <th scope="col" class="marges-n">Per a una més</th><th scope="col" class="marges-n">Podia perdre</th></tr></thead>
    <tbody>${files}</tbody>
  </table></div>`;
}

/** La taula d'una elecció de llistes obertes: per candidatura, contra les persones de les altres. */
function taulaObertes(e: MargesEleccio): string {
  const files = e.llistes
    .map((l) => `<tr${l.escons === 0 ? ' class="marges-sense"' : ""}>
      <th scope="row">${escape(l.sigla || l.nom)}</th>
      <td class="marges-n">${enter(l.escons)}</td>
      <td class="marges-n">${l.votsPerUnaMes === null ? "—" : enter(l.votsPerUnaMes)}</td>
      <td class="marges-n">${l.margeDePerdua === null ? "—" : enter(l.margeDePerdua)}</td>
    </tr>`)
    .join("");
  return `<div class="taula-envolta"><table class="balanc marges-taula">
    <caption class="marges-peu-taula">Vots que li faltaven a la seva millor persona no elegida, i vots que podia perdre la seva elegida amb menys</caption>
    <thead><tr><th scope="col">Candidatura</th><th scope="col" class="marges-n">Elegides</th>
      <th scope="col" class="marges-n">Per a una més</th><th scope="col" class="marges-n">Podia perdre</th></tr></thead>
    <tbody>${files}</tbody>
  </table></div>`;
}

/**
 * Les llistes que es van quedar sota el 5 %, les tres més a prop, i la
 * distància de la més votada a la majoria absoluta. Buit si no hi ha res a dir.
 */
function llindarIMajoria(e: MargesEleccio): string {
  const linies: string[] = [];
  const properes = e.llindar.slice(0, 3);
  if (properes.length > 0) {
    const frases = properes.map(
      (l) => `${nomAmbSigla(l.nom, l.sigla)} (${percent(l.pct)}) en va quedar a ${vots(l.votsQueFaltaven)}`,
    );
    linies.push(`<li>Sota el 5 % dels vots vàlids, que és la barrera per entrar al repartiment: ${frases.join("; ")}.</li>`);
  }
  if (e.majoriaAbsoluta) {
    const m = e.majoriaAbsoluta;
    linies.push(`<li>${nomAmbSigla(m.llista, m.sigla)} va treure ${regidories(m.escons)} de ${enter(e.escons)}; per a la majoria
  absoluta, ${enter(m.calen)}, n'hi van faltar ${vots(m.votsQueFaltaven)}.</li>`);
  } else if (e.sistema === "dhondt") {
    const calen = Math.floor(e.escons / 2) + 1;
    const amb = e.llistes.find((l) => l.escons >= calen);
    if (amb) linies.push(`<li>${nomAmbSigla(amb.nom, amb.sigla)} va treure la majoria absoluta: ${regidories(amb.escons)} de ${enter(e.escons)}.</li>`);
  }
  return linies.length === 0 ? "" : `<ul class="marges-linies">${linies.join("\n  ")}</ul>`;
}

/** Com es reparteix, en una línia, i la frase que impedeix llegir-ho com una predicció. */
function nota(e: MargesEleccio): string {
  const com =
    e.sistema === "dhondt"
      ? `La llei d'Hondt divideix els vots de cada llista per 1, 2, 3… i dona les regidories als quocients més
  alts, només entre les llistes que passen el 5 % dels vots vàlids (blancs inclosos).`
      : `En llista oberta cada elector escriu noms, no una llista, i surten elegides les persones més votades,
  siguin de la candidatura que siguin.`;
  return `<p class="marges-nota">${com} Les xifres són aritmètica amb tota la resta igual —una sola llista amb
  més o menys vots, vinguts de l'abstenció, i cap altra de canviada—, no una predicció.</p>`;
}

export type OpcionsMarges = {
  /** L'any de l'elecció principal; per defecte, la més recent que hi hagi. */
  any?: number;
};

/**
 * El cos del bloc per a la fitxa del municipi, o `""` si no hi ha mètrica:
 * la frase de l'última regidoria, la taula de la llista, la barrera i la
 * majoria, la nota, i les eleccions anteriors plegades en una frase.
 */
export function renderMargesBloc(m: MargesMetric | null | undefined, opts: OpcionsMarges = {}): string {
  if (!m || m.eleccions.length === 0) return "";
  const ordenades = [...m.eleccions].sort((a, b) => b.any - a.any);
  const principal = (opts.any !== undefined ? ordenades.find((e) => e.any === opts.any) : undefined) ?? ordenades[0]!;
  const anteriors = ordenades.filter((e) => e !== principal);

  const frase = fraseUltimEsco(principal);
  const titular = frase
    ? `<p class="entrada-bloc marges-titular">${frase}</p>`
    : `<p class="entrada-bloc marges-titular">El ${principal.any} totes les regidories van ser per a una sola
  llista: no n'hi va haver cap en disputa.</p>`;
  const taula = principal.sistema === "dhondt" ? taulaDHondt(principal) : taulaObertes(principal);
  const passades = anteriors
    .map((e) => fraseUltimEsco(e))
    .filter((f): f is string => f !== null)
    .map((f) => `<li>${f}</li>`);

  return `<div class="marges">
  ${titular}
  ${taula}
  ${llindarIMajoria(principal)}
  ${nota(principal)}
  ${passades.length > 0 ? `<details class="marges-anteriors"><summary>Les eleccions anteriors</summary>
  <ul class="marges-linies">${passades.join("\n  ")}</ul></details>` : ""}
</div>`;
}

/**
 * L'estil propi del bloc. Només classes `marges-`, i sense comentaris dins del
 * full: la fitxa del municipi l'enganxa tal qual.
 */
export const MARGES_CSS = `
.marges-titular b{font-weight:800}
.marges-sigla{color:var(--ink-suau);font-weight:600;white-space:nowrap}
.marges-taula td,.marges-taula th{font-variant-numeric:tabular-nums}
.marges-taula .marges-n{text-align:right}
.marges-taula .marges-sense th,.marges-taula .marges-sense td{color:var(--ink-suau)}
.marges-peu-taula{caption-side:bottom;text-align:left;font-size:.85rem;color:var(--ink-suau);padding-top:6px}
.marges-linies{margin:var(--e1) 0;padding-left:1.2em}
.marges-linies li{margin:4px 0}
.marges-nota{font-size:.9rem;color:var(--ink-suau);margin:var(--e1) 0}
.marges-anteriors{margin:var(--e1) 0 0;border-top:1px solid var(--vora);padding-top:var(--e1)}
.marges-anteriors summary{cursor:pointer;font-weight:700}
`;
