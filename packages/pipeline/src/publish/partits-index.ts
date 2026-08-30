import { capcalera, tipografia } from "./capcalera";
import { cercador } from "./cercador";
import { INDEXABLE, SITE } from "./config";
import { tintaSobre } from "./contrast";
import { RADIOGRAFIA_CSS } from "./estil";
import { peu } from "./peu";
import { quadres } from "./quadres";

/**
 * La portada de les marques: qui es reparteix els 947 ajuntaments.
 *
 * Hi ha quinze pàgines penjant de `/observatori/partit/<id>/` i no hi havia
 * cap índex, de manera que el menú de dalt no hi podia tenir entrada —hauria
 * estat un 404— i les quinze pàgines només existien per a qui les trobava pel
 * cercador o per la fitxa d'un municipi. Això és el que arregla aquest fitxer.
 *
 * ## Per què hi ha un dibuix i no només una taula
 *
 * La pregunta que porta algú aquí no és «quantes alcaldies té ERC», que ja la
 * respon la fitxa d'ERC: és **com es reparteixen els 947 pobles entre totes**,
 * i aquesta no es podia respondre enlloc del web. Quinze files ordenades no la
 * responen, perquè 330 i 329 al costat de 125 i de 22 són quatre números i no
 * una proporció. El repartiment és una àrea i per això es dibuixa amb
 * `quadres()`, que és el mateix «squarified treemap» dels pressupostos.
 *
 * ## El tros que no és de ningú, i per què és obligatori
 *
 * Les quinze marques **no sumen 947**. Comptat de les pàgines publicades a
 * `web/public/observatori/partit/` el 30-08-2026, en sumen 850, i les 97
 * restants són llistes locals i candidatures que no es presenten sota cap
 * partit. Si el
 * dibuix repartís només 850 i n'ocupés tot el quadrat, la pàgina estaria dient
 * que els partits es reparteixen tota Catalunya, i no és cert: un poble de cada
 * deu el governa una llista que no és de ningú. Per això el total del treemap
 * és 947 i no la suma de les marques, i el tros que sobra hi surt dibuixat, amb
 * el nom del que és. No se li dona pàgina pròpia perquè no és una marca: sota
 * aquella etiqueta hi ha centenars de candidatures que no tenen res a veure les
 * unes amb les altres.
 *
 * La xifra no s'escriu a mà enlloc: surt de restar les marques rebudes a les
 * 947 alcaldies, de manera que el dia que una marca nova tingui pàgina el
 * dibuix es reparteix sol.
 */

/** El mínim que li cal a una marca per sortir en aquesta llista. */
export type PartitFila = {
  id: string;
  sigles: string;
  nom: string;
  color: string;
  alcaldies: number;
  regidories: number;
  poblacioGovernada: number;
};

/**
 * Els municipis de Catalunya, que és el total del repartiment. És una constant
 * i no una dada que arribi de fora perquè és el número que dona nom a la resta
 * del web —«els 947»— i perquè el que ha de sortir dibuixat és justament el
 * tros que les marques no ocupen.
 */
const ALCALDIES_CATALUNYA = 947;

const ETIQUETA_RESTA = "Llistes locals i partits sense pàgina";

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const number = (n: number): string => n.toLocaleString("ca-ES");
const plural = (n: number, un: string, molts: string): string => (n === 1 ? un : molts);

/** Un percentatge amb un decimal i coma, com a la resta del web. */
const percent = (part: number, total: number): string =>
  total > 0 ? `${((100 * part) / total).toFixed(1).replace(".", ",")} %` : "—";

/**
 * El mateix guarda que a `partit.ts`: un color que arriba de la base de dades i
 * no és un hexadecimal de sis xifres es converteix en gris i no en un forat al
 * mig del dibuix.
 */
const colorSegur = (color: string): string => (/^#[0-9a-f]{6}$/i.test(color) ? color : "#8b8b8b");

/**
 * L'ordre de la pàgina: alcaldies primer, perquè el que es compara és qui mana.
 * Les regidories desempaten —Ciutadans i Vox tenen zero alcaldies i no la
 * mateixa presència— i les sigles desempaten l'empat de debò, per no dependre
 * de l'ordre en què arribin de la consulta.
 */
export function ordena(files: readonly PartitFila[]): PartitFila[] {
  return [...files].sort(
    (a, b) =>
      b.alcaldies - a.alcaldies ||
      b.regidories - a.regidories ||
      a.sigles.localeCompare(b.sigles, "ca"),
  );
}

export const PARTITS_INDEX_CSS = `
.px-portada{padding:var(--e3) 0 var(--e4)}
.px-portada h1{margin-bottom:var(--e2)}
.px-portada .resum{font-size:1.15rem;max-width:34em}

/* El dibuix del repartiment.
   L'alçada va lligada a l'amplada perquè el que es compara són àrees: si el
   quadrat es fes alt en un telèfon i pla en un ordinador, el mateix tros
   canviaria de forma i deixaria de ser comparable amb el del costat. A sota de
   560 px es torna quadrat, que és el que cap en un mòbil de 320 px sense
   deixar els requadres petits com una ratlla. */
.px-mapa{position:relative;width:100%;aspect-ratio:16/10;margin:var(--e2) 0 var(--e2);
  border:2.5px solid var(--ink);border-radius:var(--r-m);overflow:hidden;box-shadow:var(--ombra)}
@media (max-width:560px){ .px-mapa{aspect-ratio:1/1} }
.px-tros{position:absolute;left:var(--x);top:var(--y);width:var(--w);height:var(--h);
  border-right:2px solid var(--paper);border-bottom:2px solid var(--paper);
  padding:7px 9px;overflow:hidden;display:flex;flex-direction:column;gap:1px;
  background:var(--c);color:var(--t);line-height:1.15;text-decoration:none;
  container-type:size}
.px-tros:hover{filter:brightness(1.08)}

/* El tros que no és de cap marca no porta color de partit: porta el paper de la
   casa i unes ratlles, perquè no s'hi confongui amb una setzena marca. */
.px-tros.px-resta{background:var(--paper-2);color:var(--ink);
  background-image:repeating-linear-gradient(45deg,var(--vora) 0 6px,transparent 6px 12px)}

/* Qui decideix si el text hi cap és la mida real del requadre i no un tant per
   cent calculat en generar la pàgina: el mateix 2 % són 40 px en un ordinador i
   13 en un telèfon. El nom hi és sempre al «title» i a la taula de sota. */
.px-tros b,.px-tros i,.px-tros em{display:none}
@container (min-width:70px) and (min-height:32px){ .px-tros b{display:block} }
@container (min-width:92px) and (min-height:54px){ .px-tros i{display:block} }
@container (min-width:108px) and (min-height:76px){ .px-tros em{display:block} }
.px-tros b{font-size:.78rem;font-weight:800;letter-spacing:-.01em;overflow-wrap:anywhere}
.px-tros i{font-family:var(--display);font-weight:900;font-size:1.15rem;font-style:normal;
  letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.px-tros em{font-size:.7rem;font-style:normal;font-weight:800;opacity:.72}

.px-llegenda{font-size:.9rem;color:var(--ink-suau);margin:0 0 var(--e4);max-width:44em}

/* La llista de marques.
   El «min(280px,100%)» no és decoració: amb «minmax(280px,1fr)» a seques, un
   telèfon de 320 px deixa 272 px de contingut —24 px de coixí a cada banda— i
   la columna es planta igualment a 280, de manera que la pàgina se'n va vuit
   píxels cap a la dreta. Amb el min, la columna s'encongeix fins a l'amplada
   que hi ha. */
.px-llista{list-style:none;margin:0 0 var(--e3);padding:0;display:grid;gap:var(--e2);
  grid-template-columns:repeat(auto-fill,minmax(min(280px,100%),1fr))}
.px-llista a{display:block;text-decoration:none;height:100%;
  background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);
  padding:var(--e2);box-shadow:var(--ombra)}
.px-llista a:hover{transform:translate(-2px,-2px);box-shadow:5px 5px 0 var(--ink)}
.px-cap{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.px-mostra{width:18px;height:18px;flex:0 0 18px;border-radius:5px;border:2px solid var(--ink);
  background:var(--c)}
.px-sigles{font-family:var(--display);font-weight:900;font-size:1.3rem;letter-spacing:-.02em;
  overflow-wrap:anywhere}
.px-nom{display:block;font-size:.8rem;color:var(--ink-suau);margin-bottom:10px;line-height:1.3;
  overflow-wrap:anywhere}
.px-xifres{display:flex;flex-wrap:wrap;gap:var(--e2) var(--e3);margin:0;padding:0;
  list-style:none;font-variant-numeric:tabular-nums}
.px-xifres > li{display:flex;flex-direction:column}
.px-xifres .etq{font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em;
  color:var(--ink-suau)}
.px-xifres .val{font-family:var(--display);font-weight:900;font-size:1.35rem;letter-spacing:-.02em}
.px-xifres .sec{font-size:.72rem;color:var(--ink-suau);font-weight:700}
@media (max-width:400px){
  .px-sigles{font-size:1.15rem}
  .px-xifres{gap:var(--e1) var(--e2)}
  .px-xifres .val{font-size:1.15rem}
}
.px-nota{font-size:.86rem;color:var(--ink-suau);max-width:44em}
`;

/**
 * Un tros del dibuix. El text hi va sencer i el CSS decideix què se'n veu; el
 * «title» i la taula de sota són els que garanteixen que la xifra es pugui
 * llegir encara que el requadre sigui de dotze píxels.
 */
function tros(
  c: { etiqueta: string; valor: number; x: number; y: number; w: number; h: number; part: number },
  extra: { color: string; href: string | null },
): string {
  const estil = [
    `--x:${c.x.toFixed(2)}%`,
    `--y:${c.y.toFixed(2)}%`,
    `--w:${c.w.toFixed(2)}%`,
    `--h:${c.h.toFixed(2)}%`,
    `--c:${extra.color}`,
    `--t:${tintaSobre(extra.color)}`,
  ].join(";");
  const dins = `<b>${escape(c.etiqueta)}</b><i>${number(c.valor)}</i><em>${Math.round(c.part)} %</em>`;
  const títol = `${escape(c.etiqueta)}: ${number(c.valor)} ${plural(c.valor, "alcaldia", "alcaldies")} · ${Math.round(c.part)} %`;
  return extra.href
    ? `<a class="px-tros" style="${estil}" href="${escape(extra.href)}" title="${títol}">${dins}</a>`
    : `<span class="px-tros px-resta" style="${estil}" title="${títol}">${dins}</span>`;
}

export function renderPartitsIndex(
  files: readonly PartitFila[],
  poblacioCatalunya: number,
  generatedAt: string,
): string {
  const ordenades = ordena(files);
  const ambAlcaldia = ordenades.filter((p) => p.alcaldies > 0);
  const sumaAlcaldies = ordenades.reduce((a, p) => a + p.alcaldies, 0);
  // El tros de ningú. Es calcula i no s'escriu perquè creixi i minvi sol quan
  // una marca nova tingui pàgina; si mai les marques passessin de 947 —que
  // voldria dir que la dada d'entrada està trencada— el dibuix es queda sense
  // aquell tros i no en dibuixa cap de negatiu.
  const resta = Math.max(0, ALCALDIES_CATALUNYA - sumaAlcaldies);

  const caixes = quadres(
    [
      ...ambAlcaldia.map((p) => ({ etiqueta: p.sigles, valor: p.alcaldies })),
      { etiqueta: ETIQUETA_RESTA, valor: resta },
    ],
    ALCALDIES_CATALUNYA,
  );
  const perSigles = new Map(ordenades.map((p) => [p.sigles, p]));

  const title = "Els partits als ajuntaments — Observatori municipal de quivoto";
  const description = `Com es reparteixen les ${number(ALCALDIES_CATALUNYA)} alcaldies de Catalunya entre ${number(ordenades.length)} partits: quantes n'hi té cadascuna, quantes regidories i quanta població governa. Només amb dades obertes.`;
  const resum = `${number(ordenades.length)} partits amb pàgina pròpia es reparteixen ${number(sumaAlcaldies)} de les ${number(ALCALDIES_CATALUNYA)} alcaldies de Catalunya. Les altres ${number(resta)} són de llistes locals i de candidatures que no es presenten sota cap partit.`;

  const dibuix =
    caixes.length > 1
      ? `<div class="px-mapa" role="img"
    aria-label="Repartiment de les ${number(ALCALDIES_CATALUNYA)} alcaldies de Catalunya. ${caixes
      .map((c) => `${c.etiqueta}, ${number(c.valor)} ${plural(c.valor, "alcaldia", "alcaldies")}, ${Math.round(c.part)} %`)
      .join("; ")}.">${caixes
      .map((c) => {
        const partit = perSigles.get(c.etiqueta);
        return tros(c, {
          color: partit ? colorSegur(partit.color) : "#8b8b8b",
          href: partit ? `${encodeURIComponent(partit.id)}/` : null,
        });
      })
      .join("")}</div>`
      : "";

  const llista = ordenades
    .map((p) => {
      const color = colorSegur(p.color);
      return `<li><a href="${escape(encodeURIComponent(p.id))}/">
    <span class="px-cap"><span class="px-mostra" style="--c:${color}"></span>
      <span class="px-sigles">${escape(p.sigles)}</span></span>
    <span class="px-nom">${escape(p.nom)}</span>
    <ul class="px-xifres">
      <li><span class="etq">Alcaldies</span><span class="val">${number(p.alcaldies)}</span>
        <span class="sec">${
          p.alcaldies === 0
            ? "cap: tot oposició"
            : `${percent(p.alcaldies, ALCALDIES_CATALUNYA)} dels 947`
        }</span></li>
      <li><span class="etq">Regidories</span><span class="val">${number(p.regidories)}</span>
        <span class="sec">electes</span></li>
      <li><span class="etq">Població</span><span class="val">${number(p.poblacioGovernada)}</span>
        <span class="sec">${
          // El percentatge és el que fa comparable una marca amb l'altra: 125
          // alcaldies del PSC i 330 d'ERC no diuen qui governa més gent fins
          // que no se sap que les del PSC són les de l'àrea metropolitana.
          poblacioCatalunya > 0 ? `${percent(p.poblacioGovernada, poblacioCatalunya)} de Catalunya` : "habitants"
        }</span></li>
    </ul></a></li>`;
    })
    .join("");

  return `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${INDEXABLE ? "" : '<meta name="robots" content="noindex, nofollow">'}
<title>${escape(title)}</title>
<meta name="description" content="${escape(description)}">
<link rel="canonical" href="${SITE}/observatori/partit/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="quivoto">
<meta property="og:locale" content="ca_ES">
<meta property="og:title" content="Els partits als ajuntaments de Catalunya">
<meta property="og:description" content="${escape(resum)}">
<meta property="og:url" content="${SITE}/observatori/partit/">
<meta property="og:image" content="${SITE}/assets/og.png">
<meta name="twitter:card" content="summary_large_image">
${tipografia("../")}
<style>${RADIOGRAFIA_CSS}${PARTITS_INDEX_CSS}</style>
</head>
<body>
<a class="salta" href="#contingut">Ves al contingut</a>

${capcalera("../", "partits")}
${cercador("../")}

<main id="contingut">

<section class="px-portada">
  <h1>Els partits</h1>
  <p class="resum">${escape(resum)}</p>
</section>

<section>
  <h2>Qui es reparteix els 947 ajuntaments</h2>
  ${dibuix}
  <p class="px-llegenda">Cada requadre és una marca i la seva mida és el nombre d'alcaldies que
  té. El tros ratllat no és cap partit: són les llistes locals i les candidatures que no es
  presenten sota cap marca supramunicipal, i hi surt perquè sense ell el dibuix diria que els
  partits es reparteixen tota Catalunya. Les marques sense cap alcaldia no hi tenen requadre
  —una àrea de zero no es pot dibuixar— però són a la llista de sota.</p>
</section>

<section>
  <h2>${number(ordenades.length)} ${plural(ordenades.length, "partit", "partits")}, de més a menys alcaldies</h2>
  <ul class="px-llista">${llista}</ul>
  <p class="px-nota">No hi ha cap pàgina de «llistes locals», i no és un oblit: sota aquella
  etiqueta hi ha centenars de candidatures que no tenen res a veure les unes amb les altres, i
  ajuntar-les diria que existeix un partit que no existeix. Cadascuna té la seva pàgina al seu
  municipi.</p>
</section>

</main>

${
  // «D'on surten els que manen» no és al menú ni al peu de sempre: hi porten
  // la portada i les pàgines de partit, que és d'on ve qui es pregunta on
  // acaben els alcaldes d'una marca.
  peu("../", generatedAt, [{ text: "D'on surten els que manen", on: "../trajectoria/" }])
}
</body>
</html>`;
}
