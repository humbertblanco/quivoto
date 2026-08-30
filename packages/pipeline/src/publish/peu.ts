/**
 * El peu compartit: què és això, on és tota la resta i d'on surt cada xifra.
 *
 * Cap pàgina de l'Observatori en tenia. El que hi havia era una nota solta al
 * final de cada plantilla —«Generat el tal dia»— i prou: des d'una fitxa no es
 * podia arribar ni a les descàrregues, ni a la metodologia, ni a l'avís legal,
 * i el web sencer acabava en un cul-de-sac tantes vegades com pàgines té.
 *
 * El menú de dalt du als llocs on **es mira** una cosa i és curt a propòsit;
 * aquí hi va el que es busca quan ja se sap què es busca: les dades per
 * baixar-se-les, com estan fetes i qui les publica. Són dues feines diferents i
 * per això són dues peces diferents.
 *
 * ## Per què ja no són tres columnes de llista
 *
 * La primera versió eren tres capçaleres i nou enllaços en columna, que és el
 * peu de qualsevol web i no diu res de ningú. El problema no era la llargada:
 * era que la cosa de la qual el projecte està més orgullós —que no hi ha cap
 * model de llenguatge pel mig i que qualsevol pot repetir el càlcul— quedava
 * en un paràgraf de lletra petita al final, i que la feina feta (947 fitxes,
 * 4.807 electes, 2.626 candidatures, 1.897 fitxers per baixar) no es veia
 * enlloc.
 *
 * Ara són tres bandes que fan tres feines i prou: una targeta que diu qui som
 * i porta a les dades, una fila de pastilles per anar-se'n a mirar coses, i la
 * lletra petita amb les fonts i la llicència, que és una obligació legal i
 * alhora l'argument del projecte. Ocupa menys alt que les tres columnes.
 *
 * `base` és el mateix camí que fa servir `capcalera()`, i la taula de bases per
 * nivell és al capçal d'aquell fitxer. `arrel` en surt un nivell per sobre,
 * perquè les pàgines legals pengen del web i no de l'Observatori.
 */

import { catalunya } from "./mascota";

const escape = (t: string): string =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const arrel = (base: string): string => (base === "./" ? "../" : `${base}../`);

/** Milers amb punt, com s'escriuen en català i com ja surten a la portada. */
const xifra = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

export const PEU_CSS = `
/* Va escrit «footer.peu» i no «.peu» a seques perquè aquest nom ja el feia
   servir el peu de cada pastilla de la graella de sis xifres: sense l'element
   al davant, aquelles sis notes rebien fons blanc i una vora de tinta a sobre,
   i la graella semblava sis targetes trencades. */
footer.peu{border-top:2.5px solid var(--ink);margin-top:var(--e5);background:var(--paper-2)}
footer.peu > div{max-width:var(--ample);margin:0 auto;padding:var(--e4) var(--e3)}

/* --- la targeta de la crida ------------------------------------------------
   El fons del peu ja és blanc, així que la targeta va de color paper: al revés
   del que fa la resta del web. És l'única manera que una caixa es vegi damunt
   d'un fons que ja és el més clar que tenim. */
footer.peu .crida{display:grid;grid-template-columns:auto 1fr auto;align-items:center;
  gap:var(--e2) var(--e3);background:var(--paper);border:2.5px solid var(--ink);
  border-radius:var(--r-l);box-shadow:var(--ombra);padding:var(--e3);margin-bottom:var(--e3)}
footer.peu .cara{width:88px;flex:none}
footer.peu .cara svg{width:100%;height:auto;display:block}
/* Les parpelles del dibuix les tanca el CSS de la mascota, i el peu surt també
   a pàgines que no el carreguen (la fitxa municipal, el comparador, les
   comarques): sense aquesta línia, la Catalunya del peu hi sortiria amb dos
   cercles blancs tapant-li els ulls. Allà on sí que hi ha el CSS de la
   mascota, el parpelleig continua manant, que una animació guanya la
   declaració. */
footer.peu .catalunya .parpelles circle{transform-box:fill-box;transform-origin:center;transform:scaleY(0)}
footer.peu .marca{font-family:var(--display);font-weight:900;font-size:1.35rem;letter-spacing:-.05em;
  text-decoration:none;display:inline-block;margin-bottom:4px}
footer.peu .lema{color:var(--ink-suau);font-size:.94rem;line-height:1.5;margin:0;max-width:52ch}
footer.peu .lema b{color:var(--ink)}
/* El presec amb tinta fosca escrita a mà: en fosc el fons es queda clar i el
   gris heretat hi cauria per sota del mínim. Mateix truc que «.etiqueta». */
footer.peu .baixa{display:inline-flex;align-items:center;gap:8px;white-space:nowrap;
  background:var(--presec);color:#1E1B2E;border:2.5px solid var(--ink);border-radius:var(--r-max);
  box-shadow:var(--ombra);padding:0 20px;min-height:48px;font-weight:800;font-size:.95rem;
  text-decoration:none;transition:transform .12s ease,box-shadow .12s ease}
footer.peu .baixa:hover{transform:translate(2px,2px);box-shadow:1px 1px 0 var(--ink)}
@media (prefers-reduced-motion:reduce){footer.peu .baixa{transition:none}}

/* Les quatre xifres vives: el que hi ha comptat, dins la mateixa targeta. Cap
   no va sola —cada una porta de què és— que és la regla dura de la casa. */
footer.peu .xifres{grid-column:1/-1;display:grid;grid-template-columns:repeat(4,1fr);
  gap:var(--e2);list-style:none;margin:0;padding:var(--e2) 0 0;border-top:2px solid var(--vora)}
footer.peu .xifres b{display:block;font-family:var(--display);font-weight:900;font-size:1.45rem;
  letter-spacing:-.03em;line-height:1.1}
footer.peu .xifres span{display:block;font-size:.72rem;font-weight:700;letter-spacing:.08em;
  text-transform:uppercase;color:var(--ink-suau)}

/* --- on anar ---------------------------------------------------------------
   Pastilles i no llista: set enllaços en fila es llegeixen d'un cop d'ull i no
   fan cara de mapa del web. 44px d'alt, que és la mida on un dit hi encerta. */
footer.peu .anar{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:var(--e3)}
footer.peu .anar a{display:inline-flex;align-items:center;min-height:44px;padding:0 16px;
  border:2px solid var(--vora);border-radius:var(--r-max);background:var(--paper);
  font-size:.9rem;font-weight:700;text-decoration:none;
  transition:background .12s ease,color .12s ease,border-color .12s ease}
footer.peu .anar a:hover{background:var(--ink);color:var(--paper);border-color:var(--ink)}
/* Els enllaços que només té aquesta pàgina van de menta perquè es distingeixin
   dels sis que hi ha a totes: si es veiessin igual, qui ja coneix el peu no els
   veuria mai. */
footer.peu .anar a.propi{background:var(--menta);color:#1E1B2E;border-color:var(--ink)}
@media (prefers-reduced-motion:reduce){footer.peu .anar a{transition:none}}

footer.peu .lletra{border-top:2px solid var(--vora);padding-top:var(--e2);color:var(--ink-suau);
  font-size:.8rem;line-height:1.55;margin:0;max-width:78ch}
footer.peu .lletra b{color:var(--ink)}
footer.peu .lletra a{color:inherit}
footer.peu .legal{margin:6px 0 0;color:var(--ink-suau);font-size:.8rem}
footer.peu .legal a{color:inherit;font-weight:700}

/* Sota de 760px el botó ja no cap al costat de la frase i baixa sencer, a
   l'esquerra, sota el dibuix i el text. */
@media (max-width:760px){
  footer.peu .crida{grid-template-columns:auto 1fr}
  footer.peu .baixa{grid-column:1/-1;justify-self:start}
}
@media (max-width:560px){
  footer.peu > div{padding:var(--e3) var(--e2)}
  footer.peu .crida{padding:var(--e2)}
  footer.peu .cara{width:64px}
  footer.peu .xifres{grid-template-columns:repeat(2,1fr)}
  /* Amb el farciment gran, «El mapa» i «El comparador» no cabien a la mateixa
     fila i la tira de pastilles es feia de cinc rengles. */
  footer.peu .anar{gap:8px}
  footer.peu .anar a{padding:0 13px;font-size:.86rem}
}
/* A 320px el dibuix es menja l'amplada de la frase i la deixa en columnes de
   quatre lletres: se'n va, que és decoració. */
@media (max-width:380px){
  footer.peu .cara{display:none}
  footer.peu .crida{grid-template-columns:1fr}
}
`;

export type EnllacPeu = { text: string; on: string };

/** Les quatre xifres del que hi ha comptat, per ensenyar-les al peu. */
export type XifresPeu = {
  municipis: number;
  electes: number;
  candidatures: number;
  fitxersDades: number;
};

/**
 * El que hi havia comptat el 30 d'agost del 2026, mesurat pel mateix generador
 * (`publish.ts` compta els fitxers de descàrrega; els altres tres surten de la
 * base). Va aquí perquè el peu funcioni sol a les proves i a les pàgines que
 * encara no li passen res, però la crida de debò ha de venir de `publish.ts`:
 * una xifra escrita a mà envelleix i aquesta pàgina en presumeix.
 */
export const XIFRES_PEU: XifresPeu = {
  municipis: 947,
  electes: 4807,
  candidatures: 2626,
  fitxersDades: 1897,
};

let xifresActuals: XifresPeu = XIFRES_PEU;

/**
 * Diu-li al peu què s'ha comptat en aquesta publicació, una sola vegada.
 *
 * És estat de mòdul, que normalment no ho volem, i aquí sí per una raó
 * concreta: el peu el criden dotze plantilles i el generador no els passa cap
 * comptador; per fer-lo arribar «com Déu mana» caldria un paràmetre nou a dotze
 * signatures i a totes les seves proves, per a una xifra que és la mateixa a
 * totes les pàgines d'una mateixa publicació. El generador és un procés que
 * s'executa un cop i escriu el web sencer, així que aquí no hi ha dos valors
 * que competeixin.
 *
 * La cautela: s'ha de cridar ABANS d'escriure cap pàgina. El que s'escrigui
 * abans es quedarà amb les xifres de l'última publicació, que és el pitjor que
 * pot passar i no és greu.
 */
export function fixaXifresPeu(x: XifresPeu): void {
  xifresActuals = x;
}

/**
 * @param base   Camí fins a `/observatori/`, amb la barra final.
 * @param extres Enllaços propis d'aquesta pàgina, si en té cap que valgui la pena.
 * @param generatedAt Quan s'ha escrit la pàgina, que és el que en diu si és fresca.
 * @param xifres El que hi ha comptat avui; si no es diu, el que digui `fixaXifresPeu`.
 */
export function peu(
  base: string,
  generatedAt: string,
  extres: readonly EnllacPeu[] = [],
  xifres: XifresPeu = xifresActuals,
): string {
  const pastilla = (text: string, on: string, propi = false): string =>
    `<a${propi ? ' class="propi"' : ""} href="${escape(on)}">${escape(text)}</a>`;
  const compte = (n: number, de: string): string =>
    `<li><b>${xifra(n)}</b><span>${de}</span></li>`;
  return `<footer class="peu">
  <div>
    <div class="crida">
      <div class="cara">${catalunya(88, "felic", null)}</div>
      <div class="diu">
        <a class="marca" href="${escape(arrel(base))}">quivoto</a>
        <p class="lema">Qui mana a cada un dels ${xifra(xifres.municipis)} municipis de Catalunya, què hi paga
        la gent i què s'hi va prometre. <b>Sense cap model de llenguatge pel mig</b>: fonts oficials,
        cada xifra amb la seva al costat, i càlculs que qualsevol pot repetir.</p>
      </div>
      <a class="baixa" href="${escape(`${base}dades/`)}">Baixa't les dades <span aria-hidden="true">&rarr;</span></a>
      <ul class="xifres">
        ${compte(xifres.municipis, "municipis")}
        ${compte(xifres.electes, "electes")}
        ${compte(xifres.candidatures, "candidatures")}
        ${compte(xifres.fitxersDades, "fitxers per baixar")}
      </ul>
    </div>
    <nav class="anar" aria-label="Més de l'Observatori">
      ${extres.map((e) => pastilla(e.text, e.on, true)).join("\n      ")}
      ${pastilla("Els 947 municipis", `${base}els947.html`)}
      ${pastilla("El mapa", `${base}mapa/`)}
      ${pastilla("El comparador", `${base}comparador/`)}
      ${pastilla("Les comarques", `${base}c/barcelones/`)}
      ${pastilla("L'Àrea Metropolitana", `${base}amb/`)}
      ${pastilla("Les preguntes", `${base}preguntes/`)}
    </nav>
    <p class="lletra"><b>Generat el ${escape(generatedAt)}</b> a partir de les dades obertes de la
    Generalitat de Catalunya, el Consorci AOC, l'Idescat, el Ministeri d'Hisenda i el Síndic de
    Greuges, cadascuna citada a la pàgina on s'utilitza. Reutilització lliure amb atribució, i els
    conjunts del portal de la Seu-e en CC0; <a href="${escape(`${base}dades/`)}">la taula de fonts</a>
    diu de quina és cada dada i amb quina llicència. Esborrany intern, encara no indexat.</p>
    <p class="legal"><a href="${escape(`${arrel(base)}avis-legal.html`)}">Avís legal</a> ·
    <a href="${escape(`${arrel(base)}privadesa.html`)}">Privadesa</a></p>
  </div>
</footer>`;
}
