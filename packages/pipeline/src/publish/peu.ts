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
 * ## Per què els enllaços van en tres grups i no en pastilles
 *
 * La versió anterior tenia una targeta amb ombra, deu pastilles seguides i un
 * paràgraf dens. Les pastilles es llegien bé quan eren set; a deu, en un mòbil
 * de 360 px, feien sis rengles que no deien res de què hi havia a cada lloc, i
 * el peu sencer passava del metre d'alt. Ara els enllaços van agrupats per la
 * pregunta que resolen —vull mirar coses, vull un lloc concret, vull saber com
 * està fet— i cada grup té el seu nom en minúscula, que es llegeix com una
 * frase i no com un rètol. En un mòbil els grups van de dos en dos.
 *
 * ## El veí que treu el cap
 *
 * La mascota ja hi era, dins de la targeta, i no es veia: era un dibuix més al
 * costat d'un text. Ara treu el cap per damunt de la ratlla del peu, com un veí
 * per sobre de la tanca. És l'únic gest del peu i per això n'hi ha només un: la
 * resta és tipografia i ratlles.
 *
 * ## Per què totes les classes porten «peu-»
 *
 * Les classes curtes d'abans (`.marca`, `.xifres`, `.cara`, `.crida`) les feien
 * servir també altres pàgines amb un altre sentit, i cada pàgina nova n'havia
 * de triar una altra o sufixar la seva (`.marca-extrem` al comparador,
 * `.xifres-947` a la taula dels 947). Amb el prefix el problema desapareix pels
 * dos costats: ni el peu rep estils de les pàgines ni les pàgines del peu.
 *
 * `base` és el mateix camí que fa servir `capcalera()`, i la taula de bases per
 * nivell és al capçal d'aquell fitxer. `arrel` en surt un nivell per sobre,
 * perquè les pàgines legals pengen del web i no de l'Observatori.
 *
 * La còpia en Python d'aquest peu és `footer_complet()` a
 * `tools/build_landing.py`, amb el CSS a `web/public/assets/styles.css`: si
 * aquí canvia un enllaç, un grup o una frase, allà també.
 */

import { dataCurta } from "../lib/text";
import { INDEXABLE } from "./config";
import { catalunya } from "./mascota";

const escape = (t: string): string =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const arrel = (base: string): string => (base === "./" ? "../" : `${base}../`);

/** Milers amb punt, com s'escriuen en català i com ja surten a la portada. */
const xifra = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/**
 * «el 3 de setembre del 2026» a partir del «2026-09-03» que passa el generador.
 *
 * El generador escriu la data en ISO perquè és el que serveix per ordenar i per
 * al sitemap; al peu la llegeix una persona, i «2026-09-03» és com escriu una
 * màquina. L'ISO no es perd: va a l'atribut `datetime`, que és on la llegeixen
 * els cercadors i les proves de cada pàgina que volen saber de quin dia és.
 * L'article queda fora de l'etiqueta («el», o «l'» el dia u) perquè `<time>`
 * ha de contenir la data i prou.
 *
 * Si el que arriba no és una data ISO (algunes proves hi posen «avui»), es
 * deixa tal com ve en comptes d'inventar-ne una.
 */
const quan = (generatedAt: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}/.test(generatedAt)) return `el ${escape(generatedAt)}`;
  const iso = generatedAt.slice(0, 10);
  const article = Number(iso.slice(8, 10)) === 1 ? "l'" : "el ";
  return `${article}<time datetime="${iso}">${escape(dataCurta(iso))}</time>`;
};

export const PEU_CSS = `
/* Va escrit «footer.peu» i no «.peu» a seques perquè aquest nom ja el feia
   servir el peu de cada pastilla de la graella de sis xifres: sense l'element
   al davant, aquelles sis notes rebien fons blanc i una vora de tinta a sobre,
   i la graella semblava sis targetes trencades.
   L'amplada, el marge i el farciment van escrits encara que semblin de
   sobres: el full de la fitxa (estil.ts) té una regla «.peu» del peu antic,
   de 900 px i amb farciment, que també casa amb aquest element. Sense
   desfer-la, el peu era una caixa blanca al mig de la pàgina i el veí que
   treu el cap quedava 24 px per sota de la ratlla. */
footer.peu{max-width:none;margin:var(--e5) 0 0;padding:0;border-top:2.5px solid var(--ink);
  background:var(--paper-2);color:var(--ink);font-size:1rem}
footer.peu > div{position:relative;max-width:var(--ample);margin:0 auto;padding:var(--e4) var(--e3) var(--e3)}
footer.peu a:focus-visible{outline:3px solid var(--coral-text);outline-offset:2px;border-radius:4px}

/* --- el veí que treu el cap --------------------------------------------------
   La caixa retalla el dibuix just per sota de la boca i s'asseu damunt de la
   ratlla del peu: el que es veu és el cap per sobre de la tanca. El marge de
   sota és el gruix de la ratlla, perquè el tall caigui damunt de la tinta i no
   a mitja ratlla. Hi ha lloc: el peu ja deixa 64 px de marge per dalt. */
footer.peu .peu-mascota{position:absolute;right:var(--e3);bottom:100%;margin-bottom:2.5px;
  width:84px;height:56px;overflow:hidden;pointer-events:none}
footer.peu .peu-mascota svg{display:block;width:84px;height:84px;transition:transform .25s ease}
/* Quan algú s'acosta al peu, el veí s'aixeca una mica per mirar. */
footer.peu:hover .peu-mascota svg,footer.peu:focus-within .peu-mascota svg{transform:translateY(-5px)}
/* Les parpelles del dibuix les tanca el CSS de la mascota, i el peu surt també
   a pàgines que no el carreguen (la fitxa municipal, el comparador, les
   comarques): sense aquesta línia, la Catalunya del peu hi sortiria amb dos
   cercles blancs tapant-li els ulls. Allà on sí que hi ha el CSS de la
   mascota, el parpelleig continua manant, que una animació guanya la
   declaració. */
footer.peu .catalunya .parpelles circle{transform-box:fill-box;transform-origin:center;transform:scaleY(0)}

/* --- qui som ------------------------------------------------------------------
   El nom, la frase i les tres xifres, sense caixa: el peu ja té fons propi i
   una targeta a dins era una caixa dins d'una caixa. */
footer.peu .peu-qui{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:var(--e2) var(--e4);align-items:end}
footer.peu .peu-marca{font-family:var(--display);font-weight:900;font-size:1.5rem;letter-spacing:-.05em;
  line-height:1;color:var(--ink);text-decoration:none;display:inline-block;margin-bottom:6px}
footer.peu .peu-lema{color:var(--ink-suau);font-size:.94rem;line-height:1.5;margin:0;max-width:54ch}
footer.peu .peu-lema b{color:var(--ink)}
/* Les xifres porten el nom en minúscula al costat: cap xifra no va sola, que
   és la regla dura de la casa, i cap rètol en majúscules espaiades. */
footer.peu .peu-xifres{display:flex;gap:var(--e3);list-style:none;margin:0;padding:0}
footer.peu .peu-xifres li{margin:0;padding:0;border:0;background:none}
footer.peu .peu-xifres b{display:block;font-family:var(--display);font-weight:900;font-size:1.5rem;
  letter-spacing:-.03em;line-height:1.05;font-variant-numeric:tabular-nums}
footer.peu .peu-xifres span{display:block;font-size:.8rem;font-weight:700;color:var(--ink-suau)}

/* --- on anar ----------------------------------------------------------------
   Grups en columnes que es reparteixen l'amplada: tres a l'ordinador, dos en
   un mòbil. Cada enllaç fa 44 px d'alt allà on es toca amb el dit i 32 on hi
   ha ratolí, que és on la llista d'enllaços es pot permetre ser compacta. */
footer.peu .peu-anar{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));
  gap:var(--e3) var(--e3);margin:var(--e3) 0 0;padding:var(--e3) 0;
  border-top:2px solid var(--vora);border-bottom:2px solid var(--vora)}
footer.peu .peu-grup h2{font-family:var(--display);font-weight:800;font-size:1.02rem;letter-spacing:-.01em;
  line-height:1.2;margin:0 0 4px;color:var(--ink)}
footer.peu .peu-grup ul{list-style:none;margin:0;padding:0}
footer.peu .peu-grup li{margin:0;padding:0}
footer.peu .peu-grup a{display:inline-flex;align-items:center;min-height:44px;font-size:.92rem;font-weight:700;
  color:var(--ink);text-decoration:none}
footer.peu .peu-grup a:hover{text-decoration:underline;text-decoration-color:var(--coral);
  text-decoration-thickness:3px;text-underline-offset:5px}
@media (pointer:fine){footer.peu .peu-grup a{min-height:32px}}

/* --- la lletra petita ---------------------------------------------------------
   Qui fa les dades, què en pots fer i on és el catàleg, en tres frases. La data
   va al final perquè és el que menys es busca i el que més envelleix. La ratlla
   de sobre és la de sota dels enllaços: el paràgraf no en porta, que va limitat
   a 74 caràcters i la ratlla hi quedava escapçada. */
footer.peu .peu-fonts{margin:var(--e2) 0 0;
  color:var(--ink-suau);font-size:.84rem;line-height:1.55;max-width:74ch}
footer.peu .peu-fonts b{color:var(--ink)}
footer.peu .peu-fonts a{color:var(--ink);font-weight:700}
/* Avís legal i crèdits a la mateixa ratlla discreta; en un mòbil cadascun a la
   seva, sense separador penjat al final de cap. */
footer.peu .peu-baix{display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px var(--e3);
  margin-top:var(--e2);color:var(--ink-suau);font-size:.8rem;line-height:1.5}
footer.peu .peu-baix p{margin:0}
footer.peu .peu-baix a{color:inherit;font-weight:700}
footer.peu .peu-baix a:hover{color:var(--ink)}

/* En un mòbil, menys aire entre blocs: el que fa alt el peu són els enllaços,
   que no es poden encongir per sota dels 44 px, i l'aire és el que sí que pot. */
@media (max-width:640px){
  footer.peu > div{padding:var(--e3) var(--e2)}
  footer.peu .peu-anar{gap:var(--e2) var(--e2);margin-top:var(--e2);padding:var(--e2) 0}
  footer.peu .peu-mascota{right:var(--e2)}
  footer.peu .peu-qui{grid-template-columns:1fr}
  footer.peu .peu-xifres{gap:var(--e2)}
  footer.peu .peu-xifres b{font-size:1.25rem}
}
@media (prefers-reduced-motion:reduce){
  footer.peu .peu-mascota svg{transition:none}
  footer.peu:hover .peu-mascota svg,footer.peu:focus-within .peu-mascota svg{transform:none}
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

/** Un grup d'enllaços del peu: el nom que en diu la feina i on porta cadascun. */
export type GrupPeu = { nom: string; enllacos: readonly EnllacPeu[] };

/**
 * Els deu llocs de l'Observatori que surten a totes les pàgines, agrupats per
 * la pregunta que resolen.
 *
 * - **Explora**: els llocs per mirar-se els 947 de cop, sense saber-ne cap nom.
 * - **Territori**: els ens que manen per sobre de l'ajuntament, de la comarca a
 *   la diputació. L'AMB hi va abans que les diputacions i els consells perquè té
 *   pàgina pròpia de fa més temps i la gent de l'àrea la busca pel nom.
 * - **Com està fet**: les preguntes de prova, les descàrregues i el catàleg de
 *   fonts. No es diu «Les dades» perquè és el nom d'un dels tres enllaços, i un
 *   grup que es diu igual que un dels seus fills no explica res.
 *
 * Va exportat perquè la còpia en Python del peu (`footer_complet()`) l'ha de
 * repetir igual, i la prova en comprova l'ordre.
 */
export function grupsPeu(base: string): readonly GrupPeu[] {
  return [
    {
      nom: "Explora",
      enllacos: [
        { text: "Els 947", on: `${base}els947.html` },
        { text: "El mapa", on: `${base}mapa/` },
        { text: "Rànquings", on: `${base}ranquings/` },
        { text: "El comparador", on: `${base}comparador/` },
      ],
    },
    {
      nom: "Territori",
      enllacos: [
        { text: "Les comarques", on: `${base}c/` },
        { text: "L'Àrea Metropolitana", on: `${base}amb/` },
        { text: "Diputacions i consells", on: `${base}ens/` },
      ],
    },
    {
      nom: "Com està fet",
      enllacos: [
        { text: "Les preguntes", on: `${base}preguntes/` },
        { text: "Les dades", on: `${base}dades/` },
        { text: "Totes les fonts", on: `${base}dades/#fonts` },
      ],
    },
  ];
}

/**
 * @param base   Camí fins a `/observatori/`, amb la barra final.
 * @param generatedAt Quan s'ha escrit la pàgina (ISO), que és el que en diu si és fresca.
 * @param extres Enllaços propis d'aquesta pàgina, si en té cap que valgui la pena.
 *               Van en un grup a part, «Seguint el fil», el primer de tots.
 * @param xifres El que hi ha comptat avui; si no es diu, el que digui `fixaXifresPeu`.
 * @param indexable Si la publicació surt als cercadors. Per defecte, el que diu
 *               `config.ts`; les proves el passen per comprovar les dues frases.
 */
export function peu(
  base: string,
  generatedAt: string,
  extres: readonly EnllacPeu[] = [],
  xifres: XifresPeu = xifresActuals,
  indexable: boolean = INDEXABLE,
): string {
  const enllac = (e: EnllacPeu, propi: boolean): string =>
    `<li><a${propi ? ' class="propi"' : ""} href="${escape(e.on)}">${escape(e.text)}</a></li>`;
  const grup = (g: GrupPeu, propi = false): string => `<div class="peu-grup">
        <h2>${escape(g.nom)}</h2>
        <ul>${g.enllacos.map((e) => enllac(e, propi)).join("")}</ul>
      </div>`;
  const grups = [
    ...(extres.length > 0 ? [grup({ nom: "Seguint el fil", enllacos: extres }, true)] : []),
    ...grupsPeu(base).map((g) => grup(g)),
  ];
  const compte = (n: number, de: string): string => `<li><b>${xifra(n)}</b><span>${de}</span></li>`;
  // Només es diu que és un esborrany quan ho és: dir-ho a la publicació oberta
  // era fals i feia desconfiar de tota la resta de la lletra petita.
  const esborrany = indexable ? "" : " <b>Esborrany intern:</b> aquesta publicació no surt als cercadors.";
  return `<footer class="peu">
  <div>
    <div class="peu-mascota">${catalunya(84, "felic", null)}</div>
    <div class="peu-qui">
      <div>
        <a class="peu-marca" href="${escape(arrel(base))}">quivoto</a>
        <p class="peu-lema">Qui mana a cada un dels ${xifra(xifres.municipis)} municipis de Catalunya, què hi
        paga la gent i què s'hi va prometre. <b>Sense cap model de llenguatge pel mig</b>: fonts oficials i
        càlculs que qualsevol pot repetir.</p>
      </div>
      <ul class="peu-xifres">
        ${compte(xifres.municipis, "municipis")}
        ${compte(xifres.electes, "electes")}
        ${compte(xifres.candidatures, "candidatures")}
      </ul>
    </div>
    <nav class="peu-anar" aria-label="Més de l'Observatori">
      ${grups.join("\n      ")}
    </nav>
    <p class="peu-fonts">Les dades són de la Generalitat de Catalunya, el Consorci AOC, l'Idescat, el
    Ministeri d'Hisenda i el Síndic de Greuges. <b>Les pots reutilitzar citant-ne la font</b> (les del portal
    de la Seu-e són CC0). D'on surt cada xifra i com es calcula, al
    <a href="${escape(`${base}dades/#fonts`)}">catàleg de fonts</a>. Generat ${quan(generatedAt)}.${esborrany}</p>
    <div class="peu-baix">
      <p class="peu-legal"><a href="${escape(`${arrel(base)}avis-legal.html`)}">Avís legal</a> ·
      <a href="${escape(`${arrel(base)}privadesa.html`)}">Privadesa</a> ·
      <a href="${escape(`${arrel(base)}premsa.html`)}">Premsa</a></p>
      <p class="peu-credit">Un projecte d’<a href="https://x.com/humbertblanco">Humbert Blanco</a> gràcies a
      <a href="https://damosenelblanco.com/?utm_source=quivoto&amp;utm_medium=referral&amp;utm_campaign=credits">Damos en el Blanco</a> ·
      <a href="https://github.com/humbertblanco/quivoto">GitHub</a>.</p>
    </div>
  </div>
</footer>`;
}
