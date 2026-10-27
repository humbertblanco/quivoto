import { describe, expect, it } from "vitest";
import { capcalera, tipografia } from "./capcalera";

describe("tipografia", () => {
  it("arriba a /assets/ des de qualsevol profunditat", () => {
    expect(tipografia("./")).toContain('href="../assets/fonts.css"');
    expect(tipografia("../../")).toContain('href="../../../assets/fonts.css"');
    expect(tipografia("../../../../")).toContain('href="../../../../../assets/fonts.css"');
  });

  it("pre-carrega el fitxer llatí de Gabarito amb crossorigin", () => {
    const html = tipografia("../");
    expect(html).toMatch(/<link rel="preload" as="font" type="font\/woff2" crossorigin href="\.\.\/\.\.\/assets\/fonts\/QGYtz_0dZAGKJJ4t3HtoW4XGnfBI\.woff2">/);
  });
});

describe("capcalera", () => {
  it("marca el destí actual i enllaça la resta", () => {
    const html = capcalera("../", "mapa");
    expect(html).toContain('<span class="ara" aria-current="page">Mapa</span>');
    expect(html).toContain('href="../comparador/"');
  });

  /**
   * Vuit destins, en aquest ordre, i cap més: el menú és curt a propòsit i el
   * que s'hi afegeix s'hi afegeix aquí, amb el seu perquè al capçal.
   */
  it("té vuit destins, amb els rànquings entre el mapa i les comarques i les trajectòries abans del comparador", () => {
    const html = capcalera("./", "cap");
    const textos = [...html.matchAll(/<a href="[^"]*">([^<]+)<\/a>/g)]
      .map((m) => m[1])
      .filter((t) => t !== "quivoto");
    expect(textos).toEqual(["Observatori", "Els 947", "Mapa", "Rànquings", "Comarques", "Partits", "Trajectòries", "Comparador"]);
  });

  it("marca Rànquings com a pàgina actual", () => {
    expect(capcalera("../", "ranquings")).toContain('<span class="ara" aria-current="page">Rànquings</span>');
  });

  it("porta les comarques al seu índex i no a una comarca qualsevol", () => {
    expect(capcalera("../../", "cap")).toContain('href="../../c/">Comarques</a>');
    expect(capcalera("../../", "comarques")).toContain('<span class="ara" aria-current="page">Comarques</span>');
  });

  it("la taula dels 947 es diu igual que al peu i a la portada", () => {
    const html = capcalera("./", "portada");
    expect(html).toContain('href="./els947.html">Els 947</a>');
    expect(html).not.toContain("La llista");
  });
});

describe("capcalera: trajectòries", () => {
  /**
   * «D'on surten els que manen» no s'hi arribava des d'enlloc: només des d'una
   * fitxa de regidor. L'usuari ho va demanar dues vegades; ara és al menú.
   */
  it("porta les trajectòries al menú, després dels partits", () => {
    const html = capcalera("../", "trajectoria");
    expect(html).toContain('<span class="ara" aria-current="page">Trajectòries</span>');
    expect(html.indexOf("Partits")).toBeLessThan(html.indexOf("Trajectòries"));
    expect(capcalera("./")).toContain('href="./trajectoria/">Trajectòries</a>');
  });
});

describe("capcalera: el botó «Menú» del mòbil", () => {
  /**
   * El botó no és a l'HTML: el crea el guió. Sense JavaScript, doncs, no hi ha
   * cap control que no faci res, i el menú hi és sencer i a la vista, sense
   * «hidden» ni «aria-hidden» que l'amagui a ningú.
   */
  it("sense guió, el menú hi és sencer i no hi ha cap botó mort", () => {
    const html = capcalera("../../", "cap");
    const nav = html.slice(html.indexOf("<nav"), html.indexOf("</nav>"));
    expect(html).not.toContain("<button");
    expect(nav).not.toMatch(/hidden/);
    expect([...nav.matchAll(/<a href=/g)]).toHaveLength(8);
  });

  /**
   * En línia i just després de la capçalera: s'ha d'executar abans que el
   * navegador pinti, o el menú es veuria obert un instant i la pàgina saltaria.
   * Porta «id» perquè les proves que busquen el <script> pelat d'una pàgina no
   * l'agafin per un altre.
   */
  it("el guió va enganxat a la capçalera, amb id, i el menú té l'id que el botó controla", () => {
    const html = capcalera("../", "mapa");
    expect(html).toContain('</header>\n<script id="capcalera-menu">');
    expect(html).toContain('<nav class="menu" id="menu-seccions" aria-label="Seccions de l\'Observatori">');
    expect(html).not.toContain("<script>");
  });

  it("l'etiqueta comença amb majúscula, com una frase", () => {
    expect(capcalera("../../../../", "cap", "càrrec electe")).toContain('<span class="etiqueta">Càrrec electe</span>');
    expect(capcalera("./")).toContain('<span class="etiqueta">Esborrany · dades obertes</span>');
  });
});

/**
 * Un DOM de mentida, el mínim que fa servir el guió: el repo no porta jsdom, i
 * sense provar-lo un error del codi del navegador només petaria a casa de qui
 * llegeix. Cada node sap els seus fills, els seus atributs, les seves classes i
 * qui l'escolta.
 */
class NodeFals {
  id = "";
  type = "";
  className = "";
  textContent = "";
  enfocat = false;
  readonly fills: NodeFals[] = [];
  readonly atributs: Record<string, string> = {};
  readonly oients: Record<string, Array<(e: unknown) => void>> = {};
  private readonly classes = new Set<string>();
  readonly classList = {
    contains: (c: string): boolean => this.classes.has(c),
    add: (c: string): void => void this.classes.add(c),
    toggle: (c: string, si: boolean): void => void (si ? this.classes.add(c) : this.classes.delete(c)),
  };
  constructor(classes: string[] = []) {
    for (const c of classes) this.classes.add(c);
  }
  setAttribute(k: string, v: string): void { this.atributs[k] = v; }
  getAttribute(k: string): string | null { return this.atributs[k] ?? null; }
  addEventListener(tipus: string, f: (e: unknown) => void): void { (this.oients[tipus] ??= []).push(f); }
  contains(altre: unknown): boolean { return altre === this || this.fills.some((f) => f.contains(altre)); }
  insertBefore(nou: NodeFals, abans: NodeFals): void { this.fills.splice(this.fills.indexOf(abans), 0, nou); }
  focus(): void { this.enfocat = true; }
  querySelector(sel: string): NodeFals | null {
    for (const f of this.fills) {
      if (sel === ".menu" && f.classList.contains("menu")) return f;
      const dins = f.querySelector(sel);
      if (dins) return dins;
    }
    return null;
  }
  dispara(tipus: string, e: object): void { for (const f of this.oients[tipus] ?? []) f(e); }
}

/** Munta la capçalera de mentida, hi executa el guió i torna les peces. */
function executaPlec() {
  const html = capcalera("../", "mapa");
  const inici = html.indexOf('<script id="capcalera-menu">') + '<script id="capcalera-menu">'.length;
  const guio = html.slice(inici, html.indexOf("</script>", inici));
  const cap = new NodeFals(["capcalera"]);
  const logo = new NodeFals();
  const menu = new NodeFals(["menu"]);
  menu.id = "menu-seccions";
  const enllac = new NodeFals();
  menu.fills.push(enllac);
  const cerca = new NodeFals();
  cap.fills.push(logo, menu, cerca);
  const document = new NodeFals() as NodeFals & Record<string, unknown>;
  document.currentScript = { previousElementSibling: cap };
  document.createElement = () => new NodeFals();
  new Function("document", guio)(document);
  const boto = cap.fills[1]!;
  return { cap, menu, enllac, cerca, boto, document };
}

describe("capcalera: el guió del plec", () => {
  it("posa el botó davant del menú, replegat i apuntant-hi", () => {
    const { cap, boto } = executaPlec();
    expect(cap.classList.contains("amb-plec")).toBe(true);
    expect(boto.className).toBe("obre-menu");
    expect(boto.type).toBe("button");
    expect(boto.textContent).toBe("Menú");
    expect(boto.getAttribute("aria-expanded")).toBe("false");
    expect(boto.getAttribute("aria-controls")).toBe("menu-seccions");
  });

  it("el botó obre i tanca el full", () => {
    const { cap, boto } = executaPlec();
    boto.dispara("click", { target: boto });
    expect(boto.getAttribute("aria-expanded")).toBe("true");
    expect(cap.classList.contains("obert")).toBe(true);
    boto.dispara("click", { target: boto });
    expect(boto.getAttribute("aria-expanded")).toBe("false");
    expect(cap.classList.contains("obert")).toBe(false);
  });

  it("l'Esc el tanca i torna el focus al botó", () => {
    const { boto, document } = executaPlec();
    boto.dispara("click", { target: boto });
    document.dispara("keydown", { key: "Escape" });
    expect(boto.getAttribute("aria-expanded")).toBe("false");
    expect(boto.enfocat).toBe(true);
  });

  it("un clic dins del menú no el tanca; un clic fora, sí", () => {
    const { boto, enllac, cerca, document } = executaPlec();
    boto.dispara("click", { target: boto });
    document.dispara("click", { target: enllac });
    expect(boto.getAttribute("aria-expanded")).toBe("true");
    document.dispara("click", { target: cerca });
    expect(boto.getAttribute("aria-expanded")).toBe("false");
  });

  it("un Tab que surt del full el tanca, però passar del botó als enllaços no", () => {
    const { cap, boto, enllac, cerca } = executaPlec();
    boto.dispara("click", { target: boto });
    cap.dispara("focusout", { relatedTarget: enllac });
    expect(boto.getAttribute("aria-expanded")).toBe("true");
    cap.dispara("focusout", { relatedTarget: cerca });
    expect(boto.getAttribute("aria-expanded")).toBe("false");
  });
});
