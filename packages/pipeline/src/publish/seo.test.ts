import { describe, expect, it } from "vitest";
import { capSeo, descripcioNeta, filAriadna, scriptJsonLd, titolAmbMarca, DESCRIPCIO_MAXIMA, TITOL_MAXIM } from "./seo";

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

  it("escriu títol, descripció, canònica i noindex mentre no s'obri", () => {
    expect(cap).toContain("<title>Sabadell · quivoto</title>");
    expect(cap).toContain('<meta name="description" content="Qui mana a Sabadell, què s\'hi ha votat i com estan els comptes.">');
    expect(cap).toContain('<link rel="canonical" href="https://quivoto.cat/observatori/m/sabadell/">');
    expect(cap).toContain('<meta name="robots" content="noindex,nofollow">');
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
