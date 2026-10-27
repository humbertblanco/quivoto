import { describe, expect, it } from "vitest";
import {
  capSeo, descripcioNeta, filAriadna, portaNoIndex, scriptJsonLd, titolAmbMarca, DESCRIPCIO_MAXIMA, TITOL_MAXIM,
  empremtaPagina, entitatPrincipal, indexSitemapsXml, lastmodMesRecent, lastmodReal, llocWeb, ORGANITZACIO, urlsetXml,
} from "./seo";
import { preguntesLd } from "./seo-ld";

describe("el títol", () => {
  it("porta la marca al darrere quan hi cap", () => {
    expect(titolAmbMarca("Sabadell")).toBe("Sabadell · quivoto");
  });
  it("es queda sense marca abans que quedar tallat", () => {
    const llarg = "Comparador de municipis de Catalunya, de dos a quatre alhora";
    expect(titolAmbMarca(llarg)).toBe(llarg);
    expect(titolAmbMarca(llarg).length).toBeLessThanOrEqual(TITOL_MAXIM);
  });
  it("no repeteix la marca si el títol ja la diu", () => {
    expect(titolAmbMarca("Què és quivoto")).toBe("Què és quivoto");
  });
});

describe("la descripció", () => {
  it("treu etiquetes i espais dobles", () => {
    expect(descripcioNeta("Governa <b>PSC-CP</b>,   amb majoria.")).toBe("Governa PSC-CP, amb majoria.");
  });
  it("retalla a l'última paraula sencera i posa punts suspensius", () => {
    const text = Array.from({ length: 40 }, (_, i) => `paraula${i}`).join(" ");
    const curta = descripcioNeta(text);
    expect(curta.length).toBeLessThanOrEqual(DESCRIPCIO_MAXIMA);
    expect(curta.endsWith("…")).toBe(true);
    expect(curta).not.toMatch(/paraula\d*[a-z]?…$/.source.replace("[a-z]?", ""));
    expect(curta.slice(0, -1).trim().split(" ").every((p) => /^paraula\d+$/.test(p))).toBe(true);
  });
});

describe("el cap SEO", () => {
  const cap = capSeo({
    titol: "Sabadell",
    descripcio: "Qui mana a Sabadell, què s'hi ha votat i com estan els comptes.",
    url: "https://quivoto.cat/observatori/m/sabadell/",
    imatge: "https://quivoto.cat/observatori/og/sabadell.png",
    tipus: "article",
    jsonLd: [filAriadna([{ nom: "quivoto", url: "https://quivoto.cat/" }, { nom: "Sabadell", url: "https://quivoto.cat/observatori/m/sabadell/" }])],
  });

  it("escriu títol, descripció, canònica i, per defecte, deixa indexar", () => {
    expect(cap).toContain("<title>Sabadell · quivoto</title>");
    expect(cap).toContain('<meta name="description" content="Qui mana a Sabadell, què s\'hi ha votat i com estan els comptes.">');
    expect(cap).toContain('<link rel="canonical" href="https://quivoto.cat/observatori/m/sabadell/">');
    expect(cap).toContain('<meta name="robots" content="index,follow,max-image-preview:large">');
    expect(cap).not.toContain("noindex");
  });

  it("tanca una pàgina sola amb `noIndex: true`, i `portaNoIndex()` ho llegeix del HTML", () => {
    const tancada = capSeo({ titol: "Demostració", descripcio: "x", url: "https://quivoto.cat/observatori/preguntes/x/prova/", noIndex: true });
    expect(tancada).toContain('<meta name="robots" content="noindex,nofollow">');
    expect(portaNoIndex(tancada)).toBe(true);
    expect(portaNoIndex(cap)).toBe(false);
  });

  it("escriu l'Open Graph i la targeta de Twitter amb la imatge pròpia", () => {
    expect(cap).toContain('<meta property="og:type" content="article">');
    expect(cap).toContain('<meta property="og:image" content="https://quivoto.cat/observatori/og/sabadell.png">');
    expect(cap).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(cap).toContain('<meta property="og:locale" content="ca_ES">');
  });

  it("posa el JSON-LD amb el context i el fil d'Ariadna", () => {
    expect(cap).toContain('<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList"');
    expect(cap).toContain('"position":2,"name":"Sabadell"');
  });

  it("fa servir la imatge de reserva quan la pàgina no en té", () => {
    expect(capSeo({ titol: "Rànquings", descripcio: "x", url: "https://quivoto.cat/observatori/ranquings/" }))
      .toContain('content="https://quivoto.cat/assets/og.png"');
  });

  it("escapa el tancament d'script dins del JSON-LD", () => {
    expect(scriptJsonLd({ "@type": "Thing", name: "a</script><b>" })).toContain('a\\u003c/script>\\u003cb>');
  });
});

const M = "https://quivoto.cat/observatori/m/sabadell/";
const jsonLdDe = (html: string): Record<string, unknown>[] =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]!) as Record<string, unknown>);

describe("l'organització i el lloc", () => {
  it("l'organització diu qui l'ha fundat, qui n'és el titular i on són els principis", () => {
    expect(ORGANITZACIO["@id"]).toBe("https://quivoto.cat/#organitzacio");
    expect((ORGANITZACIO.founder as Record<string, unknown>).name).toBe("Humbert Blanco");
    expect(ORGANITZACIO.legalName).toBe("Damos en el Blanco, S.L.");
    expect(ORGANITZACIO.publishingPrinciples).toBe("https://quivoto.cat/premsa.html#com-treballem");
  });
  it("l'Observatori és part del lloc; el lloc arrel no és part de res", () => {
    expect(llocWeb("Obs", "https://quivoto.cat/observatori/", "x").isPartOf).toEqual({ "@id": "https://quivoto.cat/#lloc" });
    expect(llocWeb("quivoto", "https://quivoto.cat/", "x").isPartOf).toBeUndefined();
  });
  it("el fil d'Ariadna porta l'@id de la pàgina", () => {
    expect(filAriadna([{ nom: "a", url: "https://quivoto.cat/" }, { nom: "b", url: M }])["@id"]).toBe(`${M}#fil`);
  });
});

describe("el node de la pàgina", () => {
  const ciutat = { "@type": "City", "@id": `${M}#municipi`, name: "Sabadell" };
  const fil = filAriadna([{ nom: "quivoto", url: "https://quivoto.cat/" }, { nom: "Sabadell", url: M }]);

  it("surt l'últim, part de l'Observatori, amb el fil i la cosa de què parla", () => {
    const nodes = jsonLdDe(capSeo({ titol: "Sabadell", descripcio: "x", url: M, jsonLd: [fil, ciutat] }));
    expect(nodes[0]!["@type"]).toBe("BreadcrumbList");
    const pagina = nodes.at(-1)!;
    expect(pagina["@type"]).toBe("WebPage");
    expect(pagina["@id"]).toBe(`${M}#pagina`);
    expect(pagina.isPartOf).toEqual({ "@id": "https://quivoto.cat/observatori/#lloc" });
    expect(pagina.breadcrumb).toEqual({ "@id": `${M}#fil` });
    expect(pagina.mainEntity).toEqual({ "@id": `${M}#municipi`, "@type": "City", name: "Sabadell" });
    expect(pagina.publisher).toMatchObject({ "@id": "https://quivoto.cat/#organitzacio", name: "quivoto" });
    expect(JSON.stringify(pagina)).not.toContain("dateModified");
  });

  it("un node de pàgina que ja porti la plantilla no surt dues vegades: es completa", () => {
    const propi = { "@type": "AboutPage", "@id": `${M}#pagina`, name: "Nom propi" };
    const nodes = jsonLdDe(capSeo({ titol: "Sabadell", descripcio: "x", url: M, jsonLd: [fil, ciutat, propi] }));
    const pagines = nodes.filter((n) => n["@id"] === `${M}#pagina`);
    expect(pagines).toHaveLength(1);
    expect(pagines[0]!["@type"]).toBe("AboutPage");
    expect(pagines[0]!.name).toBe("Nom propi");
    expect(pagines[0]!.breadcrumb).toEqual({ "@id": `${M}#fil` });
  });

  it("una pàgina que només té el fil no porta cap node de pàgina", () => {
    const nodes = jsonLdDe(capSeo({ titol: "Mapa", descripcio: "x", url: "https://quivoto.cat/observatori/mapa/", jsonLd: [fil] }));
    expect(nodes.map((n) => n["@type"])).toEqual(["BreadcrumbList"]);
  });

  it("entitatPrincipal salta el marc i les coses d'altres pàgines", () => {
    expect(entitatPrincipal(M, [{ "@type": "WebSite", "@id": `${M}#lloc` }, { "@type": "Organization", "@id": "https://quivoto.cat/#organitzacio" }])).toBeNull();
    expect(entitatPrincipal(M, [fil, ciutat, { "@type": "GovernmentOrganization", "@id": `${M}#ajuntament` }])).toBe(`${M}#municipi`);
  });

  it("una persona és un ProfilePage només si la persona hi és amb el seu @id", () => {
    const url = `${M}regidor/x/`;
    const amb = jsonLdDe(capSeo({ titol: "X", descripcio: "x", url, tipus: "profile", jsonLd: [{ "@type": "Person", "@id": `${url}#persona`, name: "X" }] })).at(-1)!;
    expect(amb["@type"]).toBe("ProfilePage");
    expect(amb.mainEntity).toEqual({ "@id": `${url}#persona`, "@type": "Person", name: "X" });
    // Sense @id no hi ha res a lligar: ni ProfilePage (que Search Console donaria per erroni) ni WebPage.
    const sense = jsonLdDe(capSeo({ titol: "X", descripcio: "x", url, tipus: "profile", jsonLd: [{ "@type": "Person", name: "X" }] }));
    expect(sense.map((n) => n["@type"])).toEqual(["Person"]);
  });

  it("amb preguntes ràpides, un sol node FAQPage que parla del municipi", () => {
    const faq = preguntesLd([{ pregunta: "Qui?", resposta: "Ella.", font: null, quan: null }], M);
    const nodes = jsonLdDe(capSeo({ titol: "Sabadell", descripcio: "x", url: M, jsonLd: [fil, faq, ciutat] }));
    const pagines = nodes.filter((n) => n["@type"] === "FAQPage" || n["@type"] === "WebPage");
    expect(pagines).toHaveLength(1);
    expect(pagines[0]!["@type"]).toBe("FAQPage");
    expect(pagines[0]!.about).toEqual({ "@id": `${M}#municipi`, "@type": "City", name: "Sabadell" });
    expect((pagines[0]!.mainEntity as unknown[]).length).toBe(1);
    expect(pagines[0]!.isPartOf).toEqual({ "@id": "https://quivoto.cat/observatori/#lloc" });
  });

  it("la data de les dades va a dateModified i a article:modified_time; i la imatge porta text alternatiu", () => {
    const cap = capSeo({ titol: "Sabadell", descripcio: "x", url: M, tipus: "article", dataModificacio: "2026-10-20", imatge: "https://quivoto.cat/observatori/og/sabadell.png", fonts: ["https://a", "https://a"] });
    expect(cap).toContain('<meta property="article:modified_time" content="2026-10-20">');
    expect(cap).toContain('<meta property="og:image:alt" content="Sabadell · quivoto">');
    const pagina = jsonLdDe(cap).at(-1)!;
    expect(pagina.dateModified).toBe("2026-10-20");
    expect(pagina.isBasedOn).toEqual(["https://a"]);
    expect(pagina.primaryImageOfPage).toEqual({ "@type": "ImageObject", url: "https://quivoto.cat/observatori/og/sabadell.png", width: 1200, height: 630 });
  });
});

describe("els sitemaps", () => {
  it("sense priority ni changefreq, i l'índex amb el lastmod més recent", () => {
    const xml = urlsetXml([{ loc: `${M}?a&b`, lastmod: "2026-10-01" }]);
    expect(xml).toContain(`<url><loc>${M}?a&amp;b</loc><lastmod>2026-10-01</lastmod></url>`);
    expect(xml).not.toContain("priority");
    const index = indexSitemapsXml([{ loc: "https://quivoto.cat/observatori/sitemap-municipis.xml", lastmod: "2026-10-27" }]);
    expect(index).toContain("<sitemapindex");
    expect(lastmodMesRecent([{ loc: "a", lastmod: "2026-01-02" }, { loc: "b", lastmod: "2026-03-01" }], "x")).toBe("2026-03-01");
    expect(lastmodMesRecent([], "2026-10-27")).toBe("2026-10-27");
  });

  it("l'empremta no es mou per la data de generació, el peu, la capçalera, els estils ni els ?v=", () => {
    const pagina = (avui: string, cos: string, extra = "") =>
      `<html><head><title>X</title><style>.a{color:red}${extra}</style><link href="/s.css?v=${avui}"></head><body>
      <header class="capcalera">menú ${extra}</header><main>${cos}</main>
      <footer class="peu"><p>947 municipis${extra}. Generat el <time datetime="${avui}">x</time>.</p></footer>
      <script>gtag("${avui}")</script><script type="application/ld+json">{"dateModified":"${avui}"}</script></body></html>`;
    const a = empremtaPagina(pagina("2026-10-27", "Governa X"), "2026-10-27");
    const b = empremtaPagina(pagina("2026-10-28", "Governa X", " canvi"), "2026-10-28");
    expect(a).toBe(b);
    expect(empremtaPagina(pagina("2026-10-28", "Governa Y"), "2026-10-28")).not.toBe(a);
    // Una pàgina que una publicació parcial no ha reescrit porta la data d'un
    // altre dia al peu (també en la forma antiga, sense <time>): tampoc compta.
    expect(empremtaPagina("<main>Hola</main><p><b>Generat el 2026-09-03</b> · 2026-09-03</p>", "2026-10-27")).toBe(
      empremtaPagina("<main>Hola</main><p><b>Generat el 2026-10-27</b> · 2026-10-27</p>", "2026-10-27"),
    );
    // La forma llarga de la data («27 d'octubre del 2026») tampoc no compta.
    expect(empremtaPagina("<p>a 27 d'octubre del 2026</p>", "2026-10-27")).toBe(empremtaPagina("<p>a 28 d'octubre del 2026</p>", "2026-10-28"));
  });

  it("el lastmod es queda si el contingut no ha canviat", () => {
    expect(lastmodReal({ h: "abc", d: "2026-09-01", t: 1 }, "abc", "2026-10-27")).toBe("2026-09-01");
    expect(lastmodReal({ h: "abc", d: "2026-09-01", t: 1 }, "def", "2026-10-27")).toBe("2026-10-27");
    expect(lastmodReal(undefined, "abc", "2026-10-27")).toBe("2026-10-27");
  });
});
