import { capcalera, tipografia } from "./capcalera";
import { cercador } from "./cercador";
import { SITE } from "./config";
import { ARREL_OBSERVATORI, capSeo, filAriadna } from "./seo";
import { RADIOGRAFIA_CSS } from "./estil";
import type { DadesEns } from "./ens-tipus";
import { peu } from "./peu";
import { sigla } from "./sigla";

/**
 * L'índex de les comarques: les 43 en una taula, i l'Àrea Metropolitana al costat.
 *
 * Hi havia 43 pàgines penjant de `/observatori/c/<slug>/` i cap índex, de
 * manera que el peu i la portada enviaven al Barcelonès —«Les comarques» →
 * `c/barcelones/`— com si fos l'única, i a les altres 42 només s'hi arribava
 * pel cercador, des d'una fitxa o per la llista de veïnes al final de cada
 * comarca. El menú no hi podia tenir entrada perquè hauria estat un 404. Això
 * és el que arregla aquest fitxer, calcat de `partits-index.ts`.
 *
 * ## Per què una taula i no 43 targetes
 *
 * La pregunta que porta algú aquí és «la meva comarca, com queda respecte de
 * les altres»: quants pobles, quanta gent, qui hi mana més, on hi ha hagut
 * pactes. Són cinc xifres per fila i el que es fa és recórrer-les de dalt a
 * baix; en targetes serien 43 caixes i cinc pantalles de desplaçament per
 * comparar dues. En una taula hi caben totes en una, i en un telèfon la taula
 * llisca de costat dins del seu embolcall, que és el que ja fan les altres
 * taules del web.
 *
 * L'ordre és el dels 947: de més a menys habitants. No és alfabètic perquè per
 * trobar-ne una pel nom ja hi ha el cercador, i l'ordre per població diu una
 * cosa que l'alfabètic no diu: que el Barcelonès sol té més gent que les 30
 * comarques més petites juntes.
 *
 * ## La força que hi mana més
 *
 * És la primera de `forces` tal com les ordena `comarques.ts` (alcaldies, i a
 * igual nombre, habitants governats), saltant-se la que no és cap força: el
 * calaix «sense identificar» dels municipis on no s'ha pogut lligar l'alcaldia
 * amb cap llista. Si aquell calaix fos el més gran, la fila diria que a la
 * comarca hi mana «ningú», que no és cert: és que no ho sabem, i llavors es
 * diu així. Quan dues forces empaten a dalt de tot es diu també, perquè
 * ensenyar-ne una sola diria que guanya i no guanya.
 */

/** El mínim que li cal a una comarca per sortir en aquesta taula. */
export type ComarcaFila = {
  slug: string;
  name: string;
  municipis: number;
  habitants: number;
  /** Les forces amb alcaldia, de més a menys, tal com les ordena `comarques.ts`. */
  forces: readonly { brandId: string; label: string; color: string; alcaldies: number }[];
  /** Municipis on governa qui no va guanyar. */
  pacte: number;
  /** Municipis on l'alcaldia ha canviat a mig mandat. */
  canvisAlcaldia: number;
  /**
   * Habitants del municipi del mig de la comarca: la mediana que `comarques.ts`
   * ja calcula per a la seva portada («el del mig té 3.315 habitants»).
   *
   * És la xifra que fa comparables dues files: el Barcelonès i el Bages tenen
   * 30 i 5 municipis i no s'assemblen en res, i la mitjana no ho diria
   * —Barcelona sola la dispara. Opcional perquè qui fa les files (`publish.ts`)
   * la pot no passar; llavors la columna no es dibuixa, i no s'omple amb un
   * zero que semblaria una dada.
   */
  poblacioMediana?: number | null;
};

/** L'Àrea Metropolitana, quan s'ha pogut publicar: quants municipis i de quantes comarques. */
export type AmbResum = { municipis: number; comarques: number };

/**
 * El calaix de `comarques.ts` per als municipis on no s'ha sabut de qui és
 * l'alcaldia. Es reescriu aquí i no s'importa perquè és privat allà, i perquè
 * si mai canvia de nom la prova d'aquest fitxer ho dirà.
 */
const SENSE_MARCA = "sense-identificar";

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const number = (n: number): string => n.toLocaleString("ca-ES");
const plural = (n: number, un: string, molts: string): string => (n === 1 ? un : molts);

/** El mateix ordre que els 947: de més a menys habitants, i el nom desempata. */
export function ordena(files: readonly ComarcaFila[]): ComarcaFila[] {
  return [...files].sort((a, b) => b.habitants - a.habitants || a.name.localeCompare(b.name, "ca"));
}

/**
 * La força amb més alcaldies d'una comarca, i amb qui empata si empata.
 * `null` quan no n'hi ha cap d'identificada.
 */
export function quiManaMes(
  forces: ComarcaFila["forces"],
): { primera: ComarcaFila["forces"][number]; empat: ComarcaFila["forces"][number] | null } | null {
  const reals = forces.filter((f) => f.brandId !== SENSE_MARCA && f.alcaldies > 0);
  const primera = reals[0];
  if (!primera) return null;
  const segona = reals[1];
  return { primera, empat: segona && segona.alcaldies === primera.alcaldies ? segona : null };
}

export const COMARQUES_INDEX_CSS = `
.cx-portada{padding:var(--e3) 0 var(--e4)}
.cx-portada h1{margin-bottom:var(--e2)}
/* L'entrada és una frase per llegir, no un titular: pes normal i el gris de
   les entrades de la resta de pàgines (la «.resum» de la casa és en negreta
   de titular, i aquí feia dos titulars seguits). */
.cx-resum{font-size:1.15rem;max-width:34em;color:var(--ink-suau);margin:0}
/* L'AMB i els ens no són cap comarca i no van a la taula. Van aquí, a la
   vista, com a frase amb enllaços: eren dos botons amb ombra, i un enllaç de
   navegació ja es diu amb el subratllat. */
.cx-salts{margin:var(--e2) 0 0;display:flex;flex-direction:column;gap:6px;font-size:1rem}
.cx-salts a{font-weight:800}
.cx-taula{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;font-size:.95rem}
.cx-taula th,.cx-taula td{padding:10px 12px;text-align:right;vertical-align:middle;
  border-bottom:2px solid var(--vora);white-space:nowrap}
.cx-taula th[scope="row"],.cx-taula .cx-mana{text-align:left}
.cx-taula thead th{font-size:.8rem;font-weight:800;color:var(--ink-suau);border-bottom:2.5px solid var(--ink);
  vertical-align:bottom;white-space:normal}
.cx-taula thead th:first-child,.cx-taula thead .cx-mana-cap{text-align:left}
.cx-taula th[scope="row"] a{font-family:var(--display);font-weight:900;font-size:1.05rem;
  letter-spacing:-.01em;text-decoration:none}
.cx-taula th[scope="row"] a:hover{text-decoration:underline;text-decoration-thickness:2.5px;text-underline-offset:4px}
.cx-taula tbody tr:hover{background:var(--paper-2)}
/* La fila de tot Catalunya: és el denominador de cada xifra de sobre, i per
   això va sota la taula i no en un paràgraf a part. */
.cx-taula tfoot th,.cx-taula tfoot td{border-top:2.5px solid var(--ink);border-bottom:0;font-weight:800}
.cx-taula tfoot th[scope="row"]{font-family:var(--display);font-weight:900;font-size:1.05rem}
.cx-mig{color:var(--ink-suau)}
.cx-mana{display:flex;align-items:center;gap:8px}
.cx-mana .sec{font-size:.78rem;color:var(--ink-suau);font-weight:700;white-space:nowrap}
.cx-nota{font-size:.86rem;color:var(--ink-suau);max-width:44em;margin-bottom:var(--e4)}
.cx-buit{background:var(--paper-2);border:2.5px dashed var(--ink);border-radius:var(--r-m);
  padding:var(--e3);font-weight:700}
`;

/**
 * La taula, que al mòbil es desmunta en fitxes.
 *
 * A 390 px les set columnes no hi cabien i la taula lliscava de costat: qui la
 * mirava des del telèfon veia el nom i els habitants i havia d'endevinar que
 * qui hi mana era tres pantalles a la dreta. Al mòbil cada fila és una fitxa:
 * el nom, la pastilla de qui hi mana amb quantes de quantes, i una línia amb la
 * resta de xifres escrites amb les seves paraules (`.cx-mobil`, que a
 * l'escriptori no es veu i que les cel·les numèriques substitueixen).
 */
const TAULA_CSS = `
.cx-mobil{display:none}
@media (max-width:640px){
  .cx-taula,.cx-taula tbody,.cx-taula tfoot,.cx-taula tr,.cx-taula th,.cx-taula td{display:block}
  .cx-taula thead{display:none}
  .cx-taula tr{padding:12px 0;border-bottom:2px solid var(--vora)}
  .cx-taula tfoot tr{border-top:2.5px solid var(--ink);border-bottom:0}
  .cx-taula th,.cx-taula td,.cx-taula tfoot th,.cx-taula tfoot td{border:0;padding:0;text-align:left;white-space:normal}
  .cx-taula td:not(.cx-mana-cela){display:none}
  .cx-taula .cx-mana-cela{margin-top:6px}
  .cx-taula .cx-mana{flex-wrap:wrap}
  .cx-mobil{display:block;margin-top:4px;font-size:.88rem;color:var(--ink-suau);font-weight:400}
  .cx-taula tbody tr:hover{background:none}
}
`;

/**
 * La línia de xifres de la fitxa del mòbil: el mateix que diuen les cel·les
 * numèriques de la fila, però amb les seves paraules, perquè sense capçalera
 * «30 · 187.977 · 2 · 8» no es pot llegir.
 */
function resumMobil(
  c: Pick<ComarcaFila, "municipis" | "habitants" | "pacte" | "canvisAlcaldia" | "poblacioMediana">,
  ambMediana: boolean,
): string {
  const parts = [
    `${number(c.municipis)} ${plural(c.municipis, "municipi", "municipis")}`,
    `${number(c.habitants)} habitants`,
    ambMediana && typeof c.poblacioMediana === "number"
      ? `el del mig en té ${number(Math.round(c.poblacioMediana))}`
      : "",
    `${number(c.pacte)} ${plural(c.pacte, "pacte", "pactes")}`,
    `${number(c.canvisAlcaldia)} ${plural(c.canvisAlcaldia, "canvi", "canvis")} d'alcaldia`,
  ].filter(Boolean);
  return `<span class="cx-mobil">${parts.join(" · ")}</span>`;
}

/** La cel·la de qui mana més: la pastilla de la força i quantes de quantes. */
function celaMana(c: Pick<ComarcaFila, "forces" | "municipis">, base: string): string {
  const mana = quiManaMes(c.forces);
  if (!mana) return `<span class="cx-mana"><span class="sec">sense identificar</span></span>`;
  const { primera, empat } = mana;
  const xip = (f: ComarcaFila["forces"][number]): string =>
    sigla(f.label, { base, brandId: f.brandId, color: f.color });
  return `<span class="cx-mana">${xip(primera)}${empat ? ` ${xip(empat)}` : ""}<span class="sec">${
    empat ? "empat a " : ""
  }${number(primera.alcaldies)} de ${number(c.municipis)} alcaldies</span></span>`;
}

/**
 * @param comarques Les 43, en qualsevol ordre.
 * @param generatedAt Quan s'ha escrit la pàgina.
 * @param amb L'Àrea Metropolitana, si s'ha publicat; `null` si no (llavors no s'hi enllaça).
 * @param ens Les fitxes de diputacions i consells (`loadEns`). Sense, o buida,
 *   no s'enllaça l'índex d'ens: seria enviar a una pàgina que no s'ha escrit.
 */
export function renderComarquesIndex(
  comarques: readonly ComarcaFila[],
  generatedAt: string,
  amb: AmbResum | null = null,
  ens?: readonly DadesEns[],
): string {
  const base = "../";
  const ordenades = ordena(comarques);
  const total = {
    municipis: ordenades.reduce((a, c) => a + c.municipis, 0),
    habitants: ordenades.reduce((a, c) => a + c.habitants, 0),
    pacte: ordenades.reduce((a, c) => a + c.pacte, 0),
    canvisAlcaldia: ordenades.reduce((a, c) => a + c.canvisAlcaldia, 0),
  };
  // Qui mana més a tot el país: la suma de les 43, i no una xifra escrita a mà.
  const perForca = new Map<string, ComarcaFila["forces"][number]>();
  for (const c of ordenades) {
    for (const f of c.forces) {
      const acumulada = perForca.get(f.brandId);
      if (acumulada) acumulada.alcaldies += f.alcaldies;
      else perForca.set(f.brandId, { ...f });
    }
  }
  const forcesCatalunya = [...perForca.values()].sort(
    (a, b) => b.alcaldies - a.alcaldies || a.label.localeCompare(b.label, "ca"),
  );

  const resum =
    ordenades.length > 0
      ? `${number(ordenades.length)} comarques, ${number(total.municipis)} municipis i ${number(total.habitants)} habitants. A cada una, qui té més alcaldies, on governa qui no va guanyar i on ha canviat l'alcaldia des del 2023.`
      : "Encara no hi ha cap comarca publicada.";
  // El cap per al cercador, amb les mateixes sumes que el peu de la taula.
  const url = `${SITE}/observatori/c/`;
  const cap = capSeo({
    titol: `Les ${number(ordenades.length)} comarques de Catalunya: qui hi mana`,
    descripcio: `Les ${number(ordenades.length)} comarques: ${number(total.municipis)} municipis i ${number(total.habitants)} habitants. A cada una, qui té més alcaldies, on governa qui no va guanyar i on ha canviat l'alcaldia.`,
    url,
    jsonLd: [filAriadna([...ARREL_OBSERVATORI, { nom: "Les comarques", url }])],
  });

  // La columna del municipi del mig només hi és si alguna fila la porta: una
  // columna de guions no compararia res.
  const ambMediana = ordenades.some((c) => typeof c.poblacioMediana === "number");
  const celaMediana = (c: ComarcaFila): string =>
    ambMediana
      ? `<td class="cx-mig">${typeof c.poblacioMediana === "number" ? number(Math.round(c.poblacioMediana)) : "—"}</td>`
      : "";

  const files = ordenades
    .map(
      (c) => `<tr>
      <th scope="row"><a href="${escape(c.slug)}/">${escape(c.name)}</a></th>
      <td>${number(c.municipis)}</td>
      <td>${number(c.habitants)}</td>
      ${celaMediana(c)}
      <td class="cx-mana-cela">${celaMana(c, base)}${resumMobil(c, ambMediana)}</td>
      <td>${number(c.pacte)}</td>
      <td>${number(c.canvisAlcaldia)}</td>
    </tr>`,
    )
    .join("");

  const taula =
    ordenades.length === 0
      ? `<p class="cx-buit">Encara no hi ha cap comarca publicada: la taula es fa amb les pàgines de
  comarca, i sense elles no hi ha res a ensenyar.</p>`
      : `<div class="taula-envolta">
  <table class="cx-taula">
    <thead><tr>
      <th scope="col">Comarca</th>
      <th scope="col">Municipis</th>
      <th scope="col">Habitants</th>
      ${ambMediana ? '<th scope="col">El municipi del mig</th>' : ""}
      <th scope="col" class="cx-mana-cap">Qui hi mana més</th>
      <th scope="col">Pactes</th>
      <th scope="col">Canvis d'alcaldia</th>
    </tr></thead>
    <tbody>${files}</tbody>
    <tfoot><tr>
      <th scope="row">Catalunya</th>
      <td>${number(total.municipis)}</td>
      <td>${number(total.habitants)}</td>
      ${
        // La mediana dels 947 no es pot treure de 43 medianes: la cel·la queda
        // buida i no s'hi posa cap xifra que no s'hagi calculat.
        ambMediana ? '<td class="cx-mig"></td>' : ""
      }
      <td class="cx-mana-cela">${celaMana({ forces: forcesCatalunya, municipis: total.municipis }, base)}${resumMobil({ ...total, poblacioMediana: null }, false)}</td>
      <td>${number(total.pacte)}</td>
      <td>${number(total.canvisAlcaldia)}</td>
    </tr></tfoot>
  </table>
</div>`;

  return `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${cap}
${tipografia(base)}
<style>${RADIOGRAFIA_CSS}${COMARQUES_INDEX_CSS}${TAULA_CSS}</style>
</head>
<body>
<a class="salta" href="#contingut">Ves al contingut</a>

${capcalera(base, "comarques")}
${cercador(base)}

<main id="contingut">

<section class="cx-portada">
  <h1>Les ${number(ordenades.length)} comarques</h1>
  <p class="cx-resum">${escape(resum)}</p>
  ${(() => {
    const salts = [
      amb
        ? `<span>I l'<a href="${base}amb/">Àrea Metropolitana</a>, ${number(amb.municipis)} municipis de ${number(amb.comarques)} ${plural(amb.comarques, "comarca", "comarques")}.</span>`
        : "",
      // La comarca té un govern que no es vota —el consell comarcal— i la
      // província, un altre —la diputació—. Les seves fitxes viuen a l'índex
      // d'ens, i aquí només s'hi enllaça si s'han publicat.
      ens && ens.length > 0
        ? (() => {
            const consells = ens.filter((e) => e.tipus === "consell").length;
            const diputacions = ens.filter((e) => e.tipus === "diputacio").length;
            const quins = [
              consells > 0 ? (consells === 1 ? "el consell comarcal" : `els ${number(consells)} consells comarcals`) : "",
              diputacions > 0 ? (diputacions === 1 ? "la diputació" : `les ${number(diputacions)} diputacions`) : "",
            ].filter(Boolean).join(" i ");
            return quins ? `<span>Qui governa <a href="${base}ens/">${quins}</a>.</span>` : "";
          })()
        : "",
    ].filter(Boolean);
    return salts.length > 0 ? `<p class="cx-salts">${salts.join("")}</p>` : "";
  })()}
</section>

<section>
  <h2>De més a menys habitants</h2>
  ${taula}
  <p class="cx-nota">${
    ambMediana
      ? "<b>El municipi del mig</b> són els habitants del municipi que queda al mig de la comarca " +
        "ordenada per població: diu si és una comarca de pobles o de ciutats. "
      : ""
  }<b>Pactes</b> són els municipis on governa una llista que no va ser la més
  votada. <b>Canvis d'alcaldia</b>, els que n'han canviat des de les eleccions del 2023. La força
  de cada fila és la que hi té més alcaldies, comptant les llistes locals com una de sola; on
  n'hi ha dues d'empatades es diuen totes dues. Cada nom porta a la pàgina de la comarca, amb
  el detall municipi a municipi.</p>
</section>

<section class="bloc fonts">
  <h2>D'on surt tot això</h2>
  <ul>
    <li>Padró, comarca i alcaldia de cada ens: Generalitat de Catalunya, <code>6nei-4b44</code>.</li>
    <li>Vots i regidories del 2023, i les sigles de cada candidatura: <code>ntc4-rnwr</code>.</li>
  </ul>
  <p class="nota">Els límits són els del padró de la Generalitat, amb el Lluçanès i el Moianès
  com a comarques pròpies.</p>
</section>

</main>

${peu(base, generatedAt)}
</body>
</html>`;
}
