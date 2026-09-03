/**
 * «Captura emmarcada»: una captura real d'una pàgina del web dins d'un marc
 * de mòbil o de navegador, sobre fons de color, amb un títol a sobre («Així
 * es veu la fitxa del teu poble»). Les captures les fa `captures.ts` contra
 * el web publicat a `web/public/`, servit en local.
 */

import type { Captura } from "./captures";
import { escape, logo, peu, type Fons, type Mida } from "./estil";
import { OBS, SITE, type Dades, type Proposta } from "./propostes";

/** Les pàgines que es capturen; `nom` és la clau amb què arriben a `Dades.captures`. */
export const SLUGS_CAPTURA: Captura[] = [
  { nom: "fitxa-rajadell-mobil", cami: "/observatori/m/rajadell/", ample: 390, alt: 844, escala: 2, mobil: true },
  { nom: "fitxa-frontanya-mobil", cami: "/observatori/m/sant-jaume-de-frontanya/", ample: 390, alt: 844, escala: 2, mobil: true },
  { nom: "home-mobil", cami: "/", ample: 390, alt: 844, escala: 2, mobil: true },
  { nom: "fitxa-barcelona-escriptori", cami: "/observatori/m/barcelona/", ample: 1440, alt: 900, escala: 2, mobil: false },
  { nom: "ranquings-escriptori", cami: "/observatori/ranquings/", ample: 1440, alt: 900, escala: 2, mobil: false },
  { nom: "mapa-escriptori", cami: "/observatori/mapa/", ample: 1440, alt: 900, escala: 2, mobil: false },
];

type Marc = {
  nom: string; captura: string; titol: string; sota: string; url: string; enllac: string; tuit: string; tipus: "mobil" | "escriptori"; fons: Fons;
};

const MARCS: Marc[] = [
  { nom: "fitxa-rajadell-mobil", captura: "fitxa-rajadell-mobil", titol: "Així es veu la fitxa del teu poble", sota: "Qui governa, què ha passat aquest mandat, què paga cadascú. Una per municipi, 947.",
    url: "quivoto.cat/observatori/m/rajadell/", enllac: `${OBS}/m/rajadell/`, tipus: "mobil", fons: "menta",
    tuit: "Així es veu la fitxa del teu poble a l'Observatori municipal: qui governa, què ha passat aquest mandat i què paga cadascú, amb la font de cada dada. Busca el teu: quivoto.cat/observatori" },
  { nom: "fitxa-frontanya-mobil", captura: "fitxa-frontanya-mobil", titol: "Fins i tot el més petit té fitxa", sota: "Sant Jaume de Frontanyà, 25 habitants i 3 regidories, té la mateixa fitxa que Barcelona.",
    url: "quivoto.cat/observatori/m/sant-jaume-de-frontanya/", enllac: `${OBS}/m/sant-jaume-de-frontanya/`, tipus: "mobil", fons: "presec",
    tuit: "Sant Jaume de Frontanyà té 25 habitants i 3 regidories, i la mateixa fitxa que Barcelona: els 947 municipis hi són, amb les dades que hi ha i els buits on no n'hi ha." },
  { nom: "home-mobil", captura: "home-mobil", titol: "Escriu el teu poble", sota: "El cercador de la portada troba municipis i persones del ple.",
    url: "quivoto.cat", enllac: `${SITE}/`, tipus: "mobil", fons: "lavanda",
    tuit: "Escriu el nom del teu poble, o el d'algú del ple, i t'hi porta: el cercador de quivoto.cat busca entre 947 municipis i 4.807 electes." },
  { nom: "fitxa-barcelona-escriptori", captura: "fitxa-barcelona-escriptori", titol: "Així es veu la fitxa d'una ciutat", sota: "Barcelona: 41 regidories, 7 alcaldies des del 1979 i totes les dades del mandat en una sola pàgina.",
    url: "quivoto.cat/observatori/m/barcelona/", enllac: `${OBS}/m/barcelona/`, tipus: "escriptori", fons: "menta",
    tuit: "La fitxa de Barcelona a l'Observatori municipal: qui governa, com va anar el 2023, què s'ha fet i què paga cadascú. I la mateixa fitxa per als altres 946 municipis." },
  { nom: "ranquings-escriptori", captura: "ranquings-escriptori", titol: "Els 947, ordenats", sota: "Població, participació, renda, IBI, aigua, reciclatge, vehicles, cens i canvis de força; i les dades curioses.",
    url: "quivoto.cat/observatori/ranquings/", enllac: `${OBS}/ranquings/`, tipus: "escriptori", fons: "presec",
    tuit: "Els rànquings de l'Observatori: els 947 municipis ordenats per nou indicadors, amb la mediana del grup de mida al costat perquè es vegi contra què es compara cadascú. I les dades curioses." },
  { nom: "mapa-escriptori", captura: "mapa-escriptori", titol: "El mapa dels 947", sota: "Catalunya pintada per indicador: majories absolutes, canvis d'alcaldia, qui guanya des del 1979.",
    url: "quivoto.cat/observatori/mapa/", enllac: `${OBS}/mapa/`, tipus: "escriptori", fons: "lavanda",
    tuit: "El mapa dels 947 municipis, pintat per indicador: on hi ha majoria absoluta, on ha canviat l'alcaldia a mig mandat, on guanya la mateixa força des del 1979. Amb la mediana al peu de cada capa." },
];

function cos(m: Marc, d: Dades, _mida: Mida): string {
  const src = d.captures[m.captura];
  if (!src) throw new Error(`no hi ha la captura ${m.captura}`);
  const marc = m.tipus === "mobil"
    ? `<div class="telefon"><div class="pantalla"><img src="${src}" alt=""></div></div>`
    : `<div class="finestra"><div class="barra"><i></i><i></i><i></i><span class="url">${escape(m.url)}</span></div><div class="pantalla"><img src="${src}" alt=""></div></div>`;
  return `<div class="marca">${logo(3)}</div>
<p class="etiqueta">Captura del web</p>
<div class="principal escena ${m.tipus}">
  <div class="text">
    <h1 class="display titol">${escape(m.titol)}</h1>
    <p class="sota">${escape(m.sota)}</p>
    <p class="adreca-pag">${escape(m.url)}</p>
  </div>
  <div class="figura">${marc}</div>
</div>
${peu(`captura de l'Observatori publicat el ${d.generat}`)}`;
}

const CSS = `
/* La composició reparteix l'alçada entre el text i el marc; el marc mai no es
   mesura en rem absoluts perquè a 1600x900 no hi cabria i trepitjaria el peu:
   pren l'alçada que li queda i la proporció de la pantalla que imita. */
.escena{flex-direction:row;align-items:stretch;gap:4rem;min-height:0}
body.vertical .escena{flex-direction:column;align-items:stretch;gap:2rem;justify-content:flex-start}
.escena.mobil .text{flex:0 0 42%;display:flex;flex-direction:column;justify-content:center}
body.vertical .escena.mobil .text{flex:0 0 auto}
.escena.escriptori{flex-direction:column;align-items:stretch;gap:1.6rem;justify-content:flex-start}
.escena.escriptori .text{flex:0 0 auto}
body.vertical .escena.escriptori .text{display:block}
.figura{flex:1 1 auto;min-width:0;min-height:0;display:flex;justify-content:center;align-items:center}
.titol{font-size:4.2rem}
body.vertical .titol{font-size:4.6rem}
.escena.escriptori .titol{font-size:4.6rem}
.sota{font-size:1.85rem;font-weight:600;color:var(--suau);margin-top:1.2rem;line-height:1.3;max-width:56rem}
.adreca-pag{font-family:Gabarito,sans-serif;font-weight:900;font-size:1.6rem;margin-top:1.4rem;letter-spacing:-.02em}
.escena.escriptori .adreca-pag{display:none}
/* El mòbil: un rectangle arrodonit amb vora de tinta i ombra dura, la captura
   a dins retallada. L'alçada la mana la figura; l'amplada surt de la proporció.
   Es diu «telefon» i no «mobil» perquè l'escena ja porta la classe «mobil»: amb
   el mateix nom, el marc es pintava també al contenidor de tota la composició. */
.telefon{height:100%;aspect-ratio:390/844;max-width:100%;border:.35rem solid var(--ink,#1E1B2E);border-radius:3.2rem;
  box-shadow:1.1rem 1.1rem 0 var(--tinta);border-color:var(--tinta);overflow:hidden;background:#fff;padding:.5rem}
.telefon .pantalla{width:100%;height:100%;border-radius:2.4rem;overflow:hidden}
.telefon img{width:100%;height:auto;display:block}
/* La finestra de navegador: barra amb tres punts i l'adreça, la captura retallada per sota. */
.finestra{height:100%;aspect-ratio:1440/860;max-width:100%;border:.3rem solid var(--tinta);border-radius:1.6rem;
  box-shadow:1rem 1rem 0 var(--tinta);overflow:hidden;background:#fff}
.barra{height:3.2rem;background:#FFD8B8;border-bottom:.25rem solid #1E1B2E;display:flex;align-items:center;gap:.6rem;padding:0 1.4rem}
.barra i{width:1rem;height:1rem;border-radius:50%;border:.18rem solid #1E1B2E;background:#fff}
.barra .url{margin-left:1.2rem;font-weight:800;font-size:1.15rem;background:#fff;border:.18rem solid #1E1B2E;border-radius:999px;padding:.15rem 1.2rem;color:#1E1B2E}
.finestra .pantalla{overflow:hidden;height:calc(100% - 3.2rem)}
.finestra img{width:100%;height:auto;display:block}
`;

export function propostesCaptura(d: Dades): Proposta[] {
  return MARCS.filter((m) => d.captures[m.captura]).flatMap((m) => [
    { familia: "captura", nom: m.nom, variant: 1, fons: m.fons, mides: ["16x9", "4x5"] as Mida["nom"][],
      tuit: m.tuit, enllac: m.enllac, css: CSS, cos: (mida: Mida) => cos(m, d, mida) },
    { familia: "captura", nom: m.nom, variant: 2, fons: "tinta", mides: ["16x9"] as Mida["nom"][],
      tuit: m.tuit, enllac: m.enllac, css: CSS, cos: (mida: Mida) => cos(m, d, mida) },
  ]);
}
