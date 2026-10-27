import { describe, expect, it } from "vitest";
import { RADIOGRAFIA_CSS } from "./estil";

/**
 * Les decisions de marca del full compartit, escrites com a proves perquè no
 * tornin per la porta del darrere: el full el fan servir vint menes de pàgina,
 * i una regla nova copiada d'una de vella hi tornaria a posar el rètol en
 * majúscules espaiades, la targeta amb ombra o la pastilla que fa de botó.
 */

/**
 * Els cossos de totes les regles que comencen exactament amb aquest selector
 * (n'hi pot haver més d'una: la de base i les de dins d'un @media).
 */
function regles(selector: string): string[] {
  const cossos: string[] = [];
  let on = RADIOGRAFIA_CSS.indexOf(`${selector}{`);
  while (on !== -1) {
    // Que sigui el començament del selector, i no la cua d'un altre de més llarg.
    const abans = RADIOGRAFIA_CSS[on - 1];
    if (abans === undefined || /[\s}{,]/.test(abans)) {
      const inici = on + selector.length + 1;
      cossos.push(RADIOGRAFIA_CSS.slice(inici, RADIOGRAFIA_CSS.indexOf("}", inici)));
    }
    on = RADIOGRAFIA_CSS.indexOf(`${selector}{`, on + 1);
  }
  return cossos;
}

const totes = (selector: string): string => {
  const r = regles(selector);
  expect(r.length, selector).toBeGreaterThan(0);
  return r.join("\n");
};

describe("estil: res de rètols en majúscules espaiades", () => {
  /**
   * N'hi queda una i no és cap rètol: la primera lletra dels extrems de
   * l'escala, que vénen escrits en minúscula i així comencen com una frase.
   * L'etiqueta flotant dels gràfics (grafics.ts, que hi arriba incrustada)
   * també en portava, i ja no: ara és de les que es comproven com qualsevol.
   */
  it("cap regla del full no passa el text a majúscules, llevat d'una que es diu", () => {
    const amb = (RADIOGRAFIA_CSS.match(/[^{}]*\{[^{}]*text-transform:uppercase[^{}]*\}/g) ?? []).map(
      (r) => r.trim().split("{")[0]!,
    );
    expect(amb).toEqual([".comparat-llegenda span::first-letter"]);
  });

  it("les etiquetes que ho eren van en minúscula de frase, en Nunito 700 i sense espaiar", () => {
    for (const sel of [".micro", ".ullada .etq", ".balanc thead th", ".alcaldies thead th", ".tires .etq",
      ".paritat .etq", ".indicador .nom", ".rotul-serie", ".comparat-llegenda", ".euros-resultat thead th",
      ".cerca-fila .mena", ".cerca-tanca", ".etiqueta-grafic b"]) {
      const cos = totes(sel);
      expect(cos, sel).not.toMatch(/letter-spacing:\.\d/);
      expect(cos, sel).not.toContain("font-weight:800");
    }
  });

  /** El rètol fa de fil d'Ariadna: els enllaços que porta s'han de veure. */
  it("el rètol de sobre del títol continua enllaçat i subratllat", () => {
    expect(totes(".micro a")).toContain("text-decoration-color:var(--coral)");
  });
});

describe("estil: res de kits de targetes amb ombra", () => {
  it("les files de xifres i els destins no porten contorn, fons ni ombra", () => {
    for (const sel of [".destins > li > a", ".tires > li", ".gent > li,.origens > li,.preus > li",
      ".participacio li,.paritat li", ".indicador", "details.grup"]) {
      const cos = totes(sel);
      expect(cos, sel).not.toContain("box-shadow");
      expect(cos, sel).not.toContain("background");
      expect(cos, sel).not.toMatch(/border:2\.5px/);
    }
  });

  /**
   * «.grup» a seques casava amb el <span class="grup"> de la capçalera de la
   * taula del comparador i li posava farciment i franja de targeta.
   */
  it("el grup plegable va lligat al details i no agafa cap span", () => {
    expect(regles(".grup")).toEqual([]);
  });

  it("el semàfor de nivells, que pintava veredictes, ja no hi és", () => {
    expect(RADIOGRAFIA_CSS).not.toMatch(/\.nivell-(bo|avis|alerta)/);
  });
});

describe("estil: tres menes de pastilla", () => {
  it("un estat és pla: sense vora, cantons petits i en minúscula", () => {
    const cos = totes(".estat,.etiqueta,.marca-canvi,.marca-govern,.districte,.punt-tipus,.vot-unanim,.vot-grup");
    expect(cos).toContain("border:0");
    expect(cos).toContain("border-radius:5px");
    expect(cos).toContain("text-transform:none");
  });

  it("la navegació és text subratllat, sense vora de pastilla", () => {
    for (const sel of [".index a", ".pastilles-context a b", "a.prova-enllac", ".destins b", ".navega"]) {
      const cos = totes(sel);
      expect(cos, sel).toContain("text-decoration:underline");
      expect(cos, sel).not.toContain("var(--r-max)");
    }
  });

  it("la sigla del partit continua sent l'única pastilla plena i arrodonida", () => {
    const cos = totes(".sigla");
    expect(cos).toContain("background:var(--c,var(--coral))");
    expect(cos).toContain("border-radius:var(--r-max)");
  });

  /**
   * L'única fletxa que hi queda no és d'un enllaç: és l'«abans → ara» del
   * balanç plegat al mòbil, on la columna de la fletxa s'amaga i sense ella
   * les dues xifres es llegirien com una de sola.
   */
  it("cap enllaç no porta la fletxa «→» al final", () => {
    const fletxes = (RADIOGRAFIA_CSS.match(/[^{}]*\{[^{}]*content:"[^"]*→[^"]*"[^{}]*\}/g) ?? []).map((r) => r.trim());
    expect(fletxes).toEqual(['.balanc:has(td.fletxa) .abans::after{content:" →";color:var(--ink-suau)}']);
  });
});

describe("estil: la capçalera del mòbil", () => {
  it("fora del mòbil el botó «Menú» no es veu", () => {
    expect(RADIOGRAFIA_CSS).toContain(".obre-menu{display:none}");
  });

  it("al mòbil el menú es plega només si el guió ha posat el botó", () => {
    const mobil = RADIOGRAFIA_CSS.slice(RADIOGRAFIA_CSS.indexOf(".obre-menu{display:none}"));
    expect(mobil).toContain(".capcalera.amb-plec .menu{display:none}");
    expect(mobil).toContain(".capcalera.amb-plec.obert .menu{display:flex;flex-direction:column");
    // Cap regla no amaga «.capcalera .menu» sense «amb-plec»: sense guió, el
    // menú s'ha de quedar a la vista.
    expect(RADIOGRAFIA_CSS).not.toMatch(/\.capcalera \.menu\{display:none/);
  });

  it("el full és pla: filets i la ratlla de tinta, cap ombra", () => {
    const full = totes(".capcalera.amb-plec.obert .menu");
    expect(full).toContain("border-bottom:2.5px solid var(--ink)");
    expect(full).not.toContain("box-shadow");
  });

  it("els botons de la fila fan 44 px, l'objectiu de toc de la casa", () => {
    expect(totes(".capcalera .obre-menu")).toContain("min-height:44px");
    expect(totes(".capcalera.amb-plec .obre-cerca")).toContain("min-height:44px");
  });
});

/**
 * El cos sencer d'un `@media` (o de qualsevol bloc) que comença exactament
 * així, amb les claus aparellades: el `}` del primer selector de dins no és el
 * final del bloc. Si n'hi ha més d'un d'igual, els torna tots junts.
 */
function blocs(capcalera: string): string {
  const trossos: string[] = [];
  let on = RADIOGRAFIA_CSS.indexOf(`${capcalera}{`);
  while (on !== -1) {
    const inici = on + capcalera.length + 1;
    let fondaria = 1;
    let i = inici;
    while (fondaria > 0 && i < RADIOGRAFIA_CSS.length) {
      if (RADIOGRAFIA_CSS[i] === "{") fondaria += 1;
      if (RADIOGRAFIA_CSS[i] === "}") fondaria -= 1;
      i += 1;
    }
    trossos.push(RADIOGRAFIA_CSS.slice(inici, i - 1));
    on = RADIOGRAFIA_CSS.indexOf(`${capcalera}{`, i);
  }
  expect(trossos.length, capcalera).toBeGreaterThan(0);
  return trossos.join("\n");
}

describe("estil: el rail de l'índex, només on hi ha índex", () => {
  const ample = (): string => blocs("@media (min-width:1180px)");

  /**
   * Les pàgines sense índex (partits, comparador, rànquings, regidor, els 947)
   * quedaven amb una primera columna buida de 186 px. La regla que les en treu
   * demana «:has()», i per això la de base ha de continuar sent la d'abans: un
   * navegador que no entén «:has()» llença la regla sencera i es queda amb
   * aquella, no amb una pàgina sense columnes ni rail.
   */
  it("el <main> sense índex torna a una sola columna; amb índex, dues", () => {
    const css = ample();
    expect(css).toContain("main{display:grid;grid-template-columns:186px minmax(0,1fr)");
    expect(css).toContain("main:not(:has(> .index)){display:block;max-width:var(--ample-columna)}");
    // L'amplada de la columna de sempre és un token, i no un 900 escrit dues vegades.
    expect(RADIOGRAFIA_CSS).toContain("--ample-columna:900px; --ample:var(--ample-columna);");
  });

  /** Un «.index» de dins d'un bloc (les comarques dels 947) no és cap rail. */
  it("el rail és l'índex fill directe del <main>, i no qualsevol «.index»", () => {
    const css = ample();
    expect(css).toContain("main > .index{grid-column:1;grid-row:1 / span 99;position:sticky");
    // Cap selector del bloc no comença per «.index»: tots porten «main > » davant.
    expect(css).not.toMatch(/(^|[{}\n,])\s*\.index[\s{]/);
  });

  it("el rail també s'està quiet per a qui demana menys moviment", () => {
    expect(blocs("@media (min-width:1180px) and (prefers-reduced-motion:reduce)")).toContain(
      "main > .index a{transition:none}",
    );
  });
});

describe("estil: la ullada i la llegenda no inventen una barra per a un zero", () => {
  /**
   * La regla de la barra, feta servir com la faria el navegador: amb «--w» en
   * tant per cent i una barra de «ample» píxels. Escrita aquí per poder dir
   * què surt amb un zero, amb una part petita i amb una de gran, i comprovada
   * contra el CSS de debò a la prova del costat.
   */
  const amplada = (w: number, ample: number, minim: number): number =>
    Math.max((w / 100) * ample, Math.min(minim, ((w * 1000) / 100) * ample));

  it("un zero no pinta res; una part petita, el mínim; una de gran, la seva mida", () => {
    expect(amplada(0, 200, 4)).toBe(0);
    expect(amplada(0.2, 200, 4)).toBe(4);
    expect(amplada(50, 200, 4)).toBe(100);
  });

  it("és la fórmula del full, i el «min-width» que pintava el zero ja no hi és", () => {
    const ullada = totes(".ullada .on i");
    expect(ullada).toContain("width:max(var(--w),min(4px,var(--w) * 1000))");
    expect(ullada).not.toContain("min-width");
    const llegenda = totes(".llegenda:where(.hemicicle + *,.ens-composicio) .proporcio i");
    expect(llegenda).toContain("width:max(var(--w),min(3px,var(--w) * 1000))");
    expect(llegenda).not.toContain("min-width");
  });
});

describe("estil: la llegenda de l'hemicicle no s'escola a les altres llegendes", () => {
  /**
   * La clau del mapa dels 947 heretava la graella i el filet de «.llegenda li».
   * Ara totes les regles d'aquesta llegenda van lligades a l'hemicicle (o a la
   * composició dels ens), i cap no comença per «.llegenda» a seques.
   */
  it("cap regla no és de «.llegenda» a seques", () => {
    expect(RADIOGRAFIA_CSS).not.toMatch(/(^|[\s},])\.llegenda[\s{.]/);
    expect(totes(".llegenda:where(.hemicicle + *,.ens-composicio) > li")).toContain(
      "border-bottom:1px solid var(--vora)",
    );
  });
});

describe("estil: els espais entre la portada, la ullada i l'índex", () => {
  /** La figura del gràfic té una sola regla de marge, i és la que es veu. */
  it("cap regla «.grafic» no en contradiu el marge", () => {
    const ambMarge = regles(".grafic").filter((cos) => /(^|;)margin[:-]/.test(cos));
    expect(ambMarge).toEqual(["margin:var(--e2) 0 var(--e3);padding:0"]);
    expect(totes(".grafic:last-child")).toBe("margin-bottom:0");
  });

  /**
   * Entre la ullada i l'índex quedaven 40 de la portada i 40 de l'índex, un
   * damunt de l'altre. Quan el que hi ha al davant ja porta el seu farciment,
   * l'índex no n'hi afegeix.
   */
  it("l'índex no suma el seu marge al farciment de la portada ni d'un bloc", () => {
    expect(totes(".portada + .index,.partit-portada + .index,.cand-portada + .index,.bloc + .index")).toBe(
      "margin-top:0",
    );
    expect(totes(".index")).toContain("margin-top:var(--e4)");
  });
});

describe("estil: la papereta es queda al costat del títol", () => {
  /**
   * Per sota de 420 px la papereta saltava a una fila sola (120 px de pantalla
   * a cada pàgina). La regla va lligada a la papereta: la Catalunya de la
   * portada, de 150 px, no hi cap de costat i ha de continuar a sobre.
   */
  it("a 420 px el títol ocupa el que queda en lloc de saltar de línia", () => {
    const estret = blocs("@media (max-width:420px)");
    expect(estret).toContain(".presenta .papereta{width:64px;height:75px}");
    expect(estret).toContain(".presenta .papereta + div{flex-basis:0}");
    expect(estret).toContain("overflow-wrap:break-word");
    expect(estret).not.toContain(".presenta{flex-wrap:nowrap");
  });
});

describe("estil: una cara mai no és un cercle buit", () => {
  /**
   * Mentre el retrat carrega, el fons del <img> dibuixa una silueta amb el gris
   * dels filets. Va al fons del <img> i no a l'HTML perquè `cara()` torna un
   * <img> sol (vegeu cara.ts), i la fitxa del regidor, que hi apila les seves
   * inicials, el deixa transparent.
   */
  it("el retrat porta una silueta de fons fins que arriba", () => {
    const fons = totes("img.cara-alcaldia");
    expect(fons).toContain("var(--vora)");
    expect(fons).toContain("var(--paper-2)");
    // Parades enganxades: dues formes plenes, no cap esvaïment.
    expect(fons.match(/var\(--vora\) 97%,transparent 100%/g)).toHaveLength(2);
  });
});
