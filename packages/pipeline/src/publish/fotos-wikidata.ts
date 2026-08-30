import { normalizePersonName } from "../lib/text";

/**
 * El retrat d'un exalcalde, de Wikimedia Commons, i el crèdit que la llicència
 * obliga a fer.
 *
 * J28 baixa les cares dels exalcaldes que Wikidata coneix —uns 230 dels 2.900,
 * i només els que tenen una llicència lliure— i les desa a
 * `web/public/observatori/fotos/wikimedia/<QID>.<format>`. Aquí només es
 * dibuixen, i es dibuixa **també l'atribució**, que no és cap adorn: la
 * majoria són CC BY-SA i publicar-les sense l'autor, la llicència i l'enllaç a
 * la pàgina del fitxer és incomplir-la. Amb dues-centes cares, oblidar-se'n un
 * cop és oblidar-se'n dues-centes.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ON VA EL CRÈDIT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Al costat de la cara, sempre visible i mai darrere d'un `title`: un crèdit
 * que només surt en passar-hi el ratolí no existeix per a qui llegeix en un
 * telèfon, que és la majoria. Dues formes, segons la densitat de la pàgina:
 *
 *   · **Una línia per retrat** (`creditRetrat`), per a les targetes de «Qui
 *     són», on cada persona ja porta el seu peu amb la font i hi cap una
 *     línia més.
 *   · **Una llista plegada** (`creditsRetrats`), per a la taula de les
 *     alcaldies de la fitxa municipal, on una línia per fila mataria la
 *     taula. Va sota la taula, i la llista és el `<details>` que la pàgina ja
 *     fa servir per a la lletra petita: plegada, no amagada.
 *
 * Quan Commons no declara autor **igualment se cita el fitxer i la llicència**:
 * la BY d'una CC BY-SA sense autor conegut es compleix identificant l'obra i
 * enllaçant-ne l'origen, no callant.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PER NOM, NOMÉS QUAN NO HI HA RES MÉS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * La taula de les alcaldies des del 1979 no té QID: només el nom que publica
 * la Generalitat. `retratsPerNom()` fa el pont amb la mateixa clau amb què tot
 * el projecte creua persones, `normalizePersonName()`, i amb la mateixa
 * cautela: **un nom que lliga amb dues cares no en rep cap**. Una cara a la
 * fila d'una altra persona és el pitjor error possible en una taula que porta
 * noms, i val més una fila sense retrat que el retrat d'algú altre.
 *
 * Els tipus es declaren aquí i no s'importen de la feina, com fa `escut.ts`:
 * la publicació ha de poder dibuixar el que li donin sense arrossegar-se la
 * ingesta, i si un dia el JSON desat canvia de forma, el compilador ho trobarà
 * on es carrega.
 */

/** El que cal d'una persona amb retrat, tal com ho desa J28 a `fotosExalcaldes`. */
export type Retrat = {
  nom: string;
  /** Camí públic: `/observatori/fotos/wikimedia/Q14320.jpg`. */
  cami: string;
  /** Títol a Commons, que identifica l'obra quan no hi ha autor. */
  fitxer?: string;
  /** Pàgina de descripció del fitxer: l'enllaç obligatori. */
  paginaFitxer: string;
  autor: string | null;
  llicencia: { nom: string; url: string | null };
  amplada?: number | null;
  alcada?: number | null;
};

/** La fitxa d'un municipi tal com la desa J28; només en cal la llista. */
export type FitxaRetrats = { persones?: Retrat[] | null } | null | undefined;

const escape = (t: string): string =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ─────────────────────────────────────────────────────────────────────────────
// La cara
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El retrat, quadrat i petit.
 *
 * Les miniatures de Commons no són quadrades —240 × 320 és el més habitual— i
 * la pàgina les ensenya en un quadrat de 48 o 56 px, retallat pel centre amb
 * `object-fit`. El `width` i l'`height` són els del quadrat i no els del
 * fitxer perquè el que el navegador ha de reservar és l'espai que ocuparà, no
 * el que fa la imatge.
 *
 * El text alternatiu és el nom: el retrat va sempre al costat del nom escrit,
 * i qui llegeix amb veu el sent dos cops, que és molest però cert. Un `alt`
 * buit diria que la cara no és res, i és una dada amb font i llicència.
 */
export function retratWikimedia(persona: Retrat, mida: number = 48): string {
  return `<img class="retrat retrat-wikimedia" src="${escape(persona.cami)}" alt="${escape(persona.nom)}" width="${mida}" height="${mida}" loading="lazy" decoding="async">`;
}

// ─────────────────────────────────────────────────────────────────────────────
// El crèdit
// ─────────────────────────────────────────────────────────────────────────────

/**
 * L'atribució d'un retrat, en una línia: «Foto: Davidpar, CC BY-SA 4.0 —
 * Wikimedia Commons». Hi ha, per aquest ordre, qui la va fer (si se sap), sota
 * quina llicència —enllaçada al text quan en té— i on és l'original, que és
 * l'enllaç que permet a qualsevol comprovar els altres dos.
 */
export function creditRetrat(persona: Retrat): string {
  const llicencia = persona.llicencia.url
    ? `<a href="${escape(persona.llicencia.url)}" rel="license noopener nofollow">${escape(persona.llicencia.nom)}</a>`
    : `<b>${escape(persona.llicencia.nom)}</b>`;
  const autor = persona.autor
    ? escape(persona.autor)
    : // Sense autor conegut l'obra s'identifica pel nom de fitxer, si en tenim.
      persona.fitxer
      ? `<i>${escape(persona.fitxer.replace(/^File:/, ""))}</i>, autoria no declarada`
      : "autoria no declarada a Commons";
  return `<span class="credit-retrat">Foto: ${autor}, ${llicencia} — <a href="${escape(persona.paginaFitxer)}" rel="noopener nofollow">Wikimedia Commons</a></span>`;
}

/**
 * Els crèdits de tots els retrats d'un bloc, plegats sota d'ell. Per a la
 * taula de les alcaldies, on no hi cap una línia per fila. Cadena buida si no
 * hi ha cap retrat: un `<details>` buit seria un botó que no obre res.
 */
export function creditsRetrats(persones: Iterable<Retrat>): string {
  const files = [...persones];
  if (files.length === 0) return "";
  const llista = files
    .map((p) => `<li><b>${escape(p.nom)}</b> · ${creditRetrat(p)}</li>`)
    .join("");
  return `<details class="credits-retrats"><summary>${
    files.length === 1 ? "D'on surt el retrat" : `D'on surten els ${files.length} retrats`
  }</summary><ul>${llista}</ul></details>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per nom
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Els retrats d'un municipi indexats pel nom normalitzat, per a qui només té
 * el nom. Dos retrats amb el mateix nom normalitzat s'anul·len tots dos.
 */
export function retratsPerNom(fitxa: FitxaRetrats): ReadonlyMap<string, Retrat> {
  const vistos = new Map<string, Retrat | null>();
  for (const persona of fitxa?.persones ?? []) {
    if (typeof persona?.nom !== "string" || typeof persona?.cami !== "string") continue;
    const clau = normalizePersonName(persona.nom);
    if (clau === "") continue;
    vistos.set(clau, vistos.has(clau) ? null : persona);
  }
  return new Map([...vistos].filter((e): e is [string, Retrat] => e[1] !== null));
}

// ─────────────────────────────────────────────────────────────────────────────
// L'estil
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Només el que és dels retrats de Commons. La mida i la vora les posa cada
 * pàgina amb la classe `retrat` que ja té; aquí hi ha el retall pel centre,
 * que és el que una miniatura no quadrada necessita per no sortir aixafada, i
 * el crèdit, a la mida i el gris de la resta d'atribucions de la casa.
 */
export const FOTOS_WIKIMEDIA_CSS = `
.retrat-wikimedia{object-fit:cover;object-position:center 20%}
.credit-retrat{font-size:.74rem;line-height:1.4;color:var(--ink-suau)}
.credit-retrat a{color:inherit;text-decoration:underline;text-decoration-thickness:1px}
.credit-retrat a:hover{color:var(--coral-text)}
.credits-retrats{margin:var(--e2) 0 0;font-size:.8rem;color:var(--ink-suau)}
.credits-retrats summary{cursor:pointer;font-weight:700;color:var(--ink)}
.credits-retrats ul{list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column;gap:4px}
.credits-retrats li b{color:var(--ink)}
`;
