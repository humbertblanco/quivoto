import { describe, expect, it } from "vitest";
import {
  FOTOS_WIKIMEDIA_CSS,
  creditRetrat,
  creditsRetrats,
  retratWikimedia,
  retratsPerNom,
  type Retrat,
} from "./fotos-wikidata";

/** El retrat de Ferran Roquer, tal com J28 el desa: CC BY-SA 4.0 amb autor. */
const ROQUER: Retrat = {
  nom: "Ferran Roquer i Padrosa",
  cami: "/observatori/fotos/wikimedia/Q14074303.jpg",
  fitxer: "File:Ferran Roquer Padrosa (2014).jpg",
  paginaFitxer: "https://commons.wikimedia.org/wiki/File:Ferran_Roquer_Padrosa_(2014).jpg",
  autor: "Ajuntament de Figueres",
  llicencia: { nom: "CC BY-SA 4.0", url: "https://creativecommons.org/licenses/by-sa/4.0" },
  amplada: 240,
  alcada: 320,
};

describe("retratWikimedia", () => {
  it("és una imatge quadrada, mandrosa i amb el nom com a text alternatiu", () => {
    const html = retratWikimedia(ROQUER);
    expect(html).toBe(
      '<img class="retrat retrat-wikimedia" src="/observatori/fotos/wikimedia/Q14074303.jpg" alt="Ferran Roquer i Padrosa" width="48" height="48" loading="lazy" decoding="async">',
    );
  });

  /** La mida és la del quadrat que la pàgina reserva, no la del fitxer. */
  it("la mida es pot triar i és la mateixa als dos costats", () => {
    expect(retratWikimedia(ROQUER, 32)).toContain('width="32" height="32"');
    expect(retratWikimedia(ROQUER, 56)).not.toContain("240");
  });

  it("un nom amb signes no es converteix en marques", () => {
    expect(retratWikimedia({ ...ROQUER, nom: 'Anna "Rius" <b>' })).toContain('alt="Anna &quot;Rius&quot; &lt;b&gt;"');
  });
});

describe("creditRetrat", () => {
  it("diu qui, sota quina llicència enllaçada i on és l'original", () => {
    expect(creditRetrat(ROQUER)).toBe(
      '<span class="credit-retrat">Foto: Ajuntament de Figueres, ' +
        '<a href="https://creativecommons.org/licenses/by-sa/4.0" rel="license noopener nofollow">CC BY-SA 4.0</a> — ' +
        '<a href="https://commons.wikimedia.org/wiki/File:Ferran_Roquer_Padrosa_(2014).jpg" rel="noopener nofollow">Wikimedia Commons</a></span>',
    );
  });

  /**
   * Sense autor, l'obra s'identifica pel nom del fitxer: la BY es compleix
   * identificant l'obra i enllaçant-ne l'origen, no callant.
   */
  it("sense autor cita el fitxer, i sense fitxer ho diu", () => {
    expect(creditRetrat({ ...ROQUER, autor: null })).toContain(
      "Foto: <i>Ferran Roquer Padrosa (2014).jpg</i>, autoria no declarada,",
    );
    expect(creditRetrat({ ...ROQUER, autor: null, fitxer: undefined })).toContain(
      "Foto: autoria no declarada a Commons,",
    );
  });

  it("una llicència sense enllaç va en negreta i no amb un enllaç inventat", () => {
    const html = creditRetrat({ ...ROQUER, llicencia: { nom: "Public domain", url: null } });
    expect(html).toContain("<b>Public domain</b>");
    expect(html).not.toContain('rel="license');
  });

  it("escapa el que ve de Commons, que és text lliure", () => {
    expect(creditRetrat({ ...ROQUER, autor: "<script>x</script>" })).toContain("&lt;script&gt;");
  });
});

describe("creditsRetrats", () => {
  it("una llista plegada amb un crèdit per retrat, i res si no n'hi ha", () => {
    const html = creditsRetrats([ROQUER, { ...ROQUER, nom: "Maria Roig", cami: "/observatori/fotos/wikimedia/Q2.jpg" }]);
    expect(html.startsWith('<details class="credits-retrats"><summary>D\'on surten els 2 retrats</summary>')).toBe(true);
    expect((html.match(/<li>/g) ?? []).length).toBe(2);
    expect(html).toContain("<b>Maria Roig</b> · <span class=\"credit-retrat\">");
    expect(creditsRetrats([ROQUER])).toContain("<summary>D'on surt el retrat</summary>");
    expect(creditsRetrats([])).toBe("");
  });
});

describe("retratsPerNom", () => {
  it("indexa amb la mateixa clau amb què el projecte creua persones", () => {
    const mapa = retratsPerNom({ persones: [ROQUER] });
    expect(mapa.get("ferran roquer padrosa")).toBe(ROQUER);
    // La «i» dels cognoms i les majúscules de la Generalitat no hi fan res.
    expect(mapa.has("ferran roquer padrosa")).toBe(true);
  });

  /** Dos retrats amb el mateix nom: cap dels dos, que és l'error prudent. */
  it("un nom que lliga amb dues cares no en rep cap", () => {
    const mapa = retratsPerNom({
      persones: [ROQUER, { ...ROQUER, cami: "/observatori/fotos/wikimedia/Q9.jpg" }, { ...ROQUER, nom: "Maria Roig" }],
    });
    expect(mapa.has("ferran roquer padrosa")).toBe(false);
    expect(mapa.has("maria roig")).toBe(true);
  });

  it("no s'ofega sense fitxa ni amb una fitxa a mig fer", () => {
    expect(retratsPerNom(null).size).toBe(0);
    expect(retratsPerNom(undefined).size).toBe(0);
    expect(retratsPerNom({ persones: null }).size).toBe(0);
    expect(retratsPerNom({ persones: [{ nom: "" } as unknown as Retrat] }).size).toBe(0);
  });
});

describe("FOTOS_WIKIMEDIA_CSS", () => {
  it("retalla pel centre i porta el crèdit; cap accent greu dins del full", () => {
    expect(FOTOS_WIKIMEDIA_CSS).toContain(".retrat-wikimedia{object-fit:cover");
    expect(FOTOS_WIKIMEDIA_CSS).toContain(".credit-retrat{");
    expect(FOTOS_WIKIMEDIA_CSS).not.toContain("`");
  });
});
