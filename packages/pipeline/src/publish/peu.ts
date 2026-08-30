/**
 * El peu compartit: on és tota la resta, i qui respon del que hi ha escrit.
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
 * `base` és el mateix camí que fa servir `capcalera()`, i la taula de bases per
 * nivell és al capçal d'aquell fitxer. `arrel` en surt un nivell per sobre,
 * perquè les pàgines legals pengen del web i no de l'Observatori.
 */

const escape = (t: string): string =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const arrel = (base: string): string => (base === "./" ? "../" : `${base}../`);

export const PEU_CSS = `
/* Va escrit «footer.peu» i no «.peu» a seques perquè aquest nom ja el feia
   servir el peu de cada pastilla de la graella de sis xifres: sense l'element
   al davant, aquelles sis notes rebien fons blanc i una vora de tinta a sobre,
   i la graella semblava sis targetes trencades. */
footer.peu{border-top:2.5px solid var(--ink);margin-top:var(--e5);background:var(--paper-2)}
footer.peu > div{max-width:var(--ample);margin:0 auto;padding:var(--e4) var(--e3)}
footer.peu .marca{font-family:var(--display);font-weight:900;font-size:1.3rem;letter-spacing:-.05em;
  text-decoration:none;display:inline-block;margin-bottom:6px}
footer.peu .lema{color:var(--ink-suau);font-size:.92rem;margin:0 0 var(--e3);max-width:46ch}
footer.peu .columnes{display:grid;gap:var(--e3);grid-template-columns:repeat(auto-fit,minmax(190px,1fr));
  margin-bottom:var(--e3)}
footer.peu h2{font-family:var(--text);font-size:.68rem;font-weight:800;letter-spacing:.14em;
  text-transform:uppercase;color:var(--ink-suau);margin:0 0 10px}
footer.peu ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
footer.peu li a{font-size:.92rem;font-weight:700;text-decoration:none;display:inline-flex;
  align-items:center;min-height:32px}
footer.peu li a:hover{text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:4px}
footer.peu .lletra{border-top:2px solid var(--vora);padding-top:var(--e2);color:var(--ink-suau);
  font-size:.8rem;line-height:1.5;margin:0}
footer.peu .lletra a{color:inherit}
`;

export type EnllacPeu = { text: string; on: string };

/**
 * @param base   Camí fins a `/observatori/`, amb la barra final.
 * @param extres Enllaços propis d'aquesta pàgina, si en té cap que valgui la pena.
 * @param generatedAt Quan s'ha escrit la pàgina, que és el que en diu si és fresca.
 */
export function peu(base: string, generatedAt: string, extres: readonly EnllacPeu[] = []): string {
  const a = (text: string, on: string): string =>
    `<li><a href="${escape(on)}">${escape(text)}</a></li>`;
  return `<footer class="peu">
  <div>
    <a class="marca" href="${escape(arrel(base))}">quivoto</a>
    <p class="lema">Els 947 municipis de Catalunya amb el que en diuen les dades obertes.
    Sense cap model de llenguatge pel mig: fonts oficials i càlculs que qualsevol pot repetir.</p>
    <div class="columnes">
      <div>
        <h2>Mirar</h2>
        <ul>
          ${a("Els 947 municipis", `${base}els947.html`)}
          ${a("El mapa", `${base}mapa/`)}
          ${a("El comparador", `${base}comparador/`)}
          ${a("Les comarques", `${base}c/barcelones/`)}
          ${a("L'Àrea Metropolitana", `${base}amb/`)}
        </ul>
      </div>
      <div>
        <h2>Baixar i comprovar</h2>
        <ul>
          ${a("Totes les dades, en CSV i JSON", `${base}dades/`)}
          ${a("Les preguntes de la brúixola", `${base}preguntes/`)}
        </ul>
      </div>
      <div>
        <h2>Qui ho fa</h2>
        <ul>
          ${a("Avís legal", `${arrel(base)}avis-legal.html`)}
          ${a("Privadesa", `${arrel(base)}privadesa.html`)}
        </ul>
      </div>
      ${
        extres.length === 0
          ? ""
          : `<div><h2>D'aquesta pàgina</h2><ul>${extres.map((e) => a(e.text, e.on)).join("")}</ul></div>`
      }
    </div>
    <p class="lletra">Generat el ${escape(generatedAt)}. Fonts: Generalitat de Catalunya, Consorci AOC,
    Idescat, Ministeri d'Hisenda i Síndic de Greuges, cadascuna citada a la pàgina on s'utilitza.
    Esborrany intern, encara no indexat.</p>
  </div>
</footer>`;
}
