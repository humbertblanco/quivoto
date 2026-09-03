import { describe, expect, it } from "vitest";
import type { FitxaCuriositatsWikidata, PersonaNascuda } from "../jobs/j33-municipi-wikidata";
import {
  WIKIDATA_FITXA_CSS,
  anysDeVida,
  curiositatsWikidata,
  periodeAgermanament,
  renderAgermanaments,
  renderNascuts,
  retratDe,
  type FilaCuriositatWikidata,
} from "./wikidata-fitxa";

const persona = (extra: Partial<PersonaNascuda> & Pick<PersonaNascuda, "qid" | "nom">): PersonaNascuda => ({
  url: `https://www.wikidata.org/wiki/${extra.qid}`,
  viquipedia: null,
  naixement: null,
  defuncio: null,
  ocupacio: null,
  ocupacions: [],
  enllacos: 0,
  fitxer: null,
  imatge: null,
  ...extra,
});

/** Badalona segons J33 el 03-09-2026, retallada a tres persones. */
const BADALONA: FitxaCuriositatsWikidata = {
  font: "Wikidata (wikidata.org)",
  fontImatges: "Wikimedia Commons (commons.wikimedia.org)",
  llicenciaDades: "CC0 1.0",
  consultat: "2026-09-03",
  qidMunicipi: "Q15468",
  url: "https://www.wikidata.org/wiki/Q15468",
  ine5: "08015",
  agermanaments: [
    { qid: "Q33986", nom: "Valparaíso", url: "https://www.wikidata.org/wiki/Q33986", pais: "Xile", paisQid: "Q298", inici: null, fi: null },
    { qid: "Q741765", nom: "San Fernando", url: "https://www.wikidata.org/wiki/Q741765", pais: "Espanya", paisQid: "Q29", inici: "1985-01-01", fi: null },
    { qid: "Q987434", nom: "Alcanar", url: "https://www.wikidata.org/wiki/Q987434", pais: null, paisQid: null, inici: "1990-01-01", fi: "2005-01-01" },
  ],
  nascuts: {
    total: 560,
    persones: [
      persona({
        qid: "Q295416", nom: "Luis Javier García Sanz", enllacos: 42, naixement: "1978-06-24",
        viquipedia: "https://ca.wikipedia.org/wiki/Luis_Javier_Garc%C3%ADa_Sanz", ocupacio: "futbolista", ocupacions: ["futbolista", "polític"],
        fitxer: "File:Luis García Sanz.jpg",
        imatge: {
          fitxer: "File:Luis García Sanz.jpg", miniaturaUrl: "https://upload.wikimedia.org/x/120px-Luis.jpg",
          paginaFitxer: "https://commons.wikimedia.org/wiki/File:Luis_Garc%C3%ADa_Sanz.jpg", autor: "Ferran Cornellà",
          llicencia: { codi: "cc-by-sa-4.0", nom: "CC BY-SA 4.0", url: "https://creativecommons.org/licenses/by-sa/4.0/" },
        },
      }),
      persona({
        qid: "Q232218", nom: "Mireia Belmonte García", enllacos: 31, naixement: "1990-11-10",
        viquipedia: "https://ca.wikipedia.org/wiki/Mireia_Belmonte_i_Garc%C3%ADa", ocupacio: "nedador", ocupacions: ["nedador"],
        // Fotografia a Wikidata, però la llicència no permet publicar-la: inicials.
        fitxer: "File:Mireia Belmonte 2018.jpg",
      }),
      persona({ qid: "Q5593", nom: "Pau Pi <i>Pons</i>", enllacos: 2, naixement: "1881-10-25", defuncio: "1973-04-08" }),
    ],
  },
};

describe("renderAgermanaments", () => {
  const html = renderAgermanaments(BADALONA);

  it("és un bloc amb una pastilla per ciutat: nom enllaçat a Wikidata, país en text i el període si en té", () => {
    expect(html).toContain('<section class="bloc" id="agermanaments">');
    expect(html).toContain("Les 3 ciutats amb què");
    expect(html).toContain('<a href="https://www.wikidata.org/wiki/Q33986" rel="noopener nofollow">Valparaíso</a><span class="pais">Xile</span>');
    expect(html).toContain("San Fernando</a><span class=\"pais\">Espanya</span><small>des del 1985</small>");
    expect(html).toContain('<li class="agermanament acabat"><a href="https://www.wikidata.org/wiki/Q987434" rel="noopener nofollow">Alcanar</a><small>1990-2005</small>');
    expect(html).not.toContain("<img");
  });

  it("diu «segons Wikidata» i la data de consulta al peu, amb l'enllaç a l'element", () => {
    expect(html).toContain("<b>segons Wikidata</b> (dades CC0 1.0), consultat el 3 de setembre del 2026");
    expect(html).toContain('<a href="https://www.wikidata.org/wiki/Q15468" rel="noopener nofollow">l\'element Q15468</a>');
  });

  it("sense agermanaments no hi ha bloc", () => {
    expect(renderAgermanaments({ ...BADALONA, agermanaments: [] })).toBe("");
    expect(renderAgermanaments(null)).toBe("");
    expect(renderAgermanaments(undefined)).toBe("");
  });

  it("escriu només la part del període que Wikidata dona", () => {
    expect(periodeAgermanament({ inici: null, fi: null })).toBe("");
    expect(periodeAgermanament({ inici: "1985-01-01", fi: null })).toBe("des del 1985");
    expect(periodeAgermanament({ inici: null, fi: "2005-06-01" })).toBe("fins al 2005");
    expect(periodeAgermanament({ inici: "1990-01-01", fi: "2005-01-01" })).toBe("1990-2005");
  });
});

describe("renderNascuts", () => {
  const html = renderNascuts(BADALONA);

  it("és un bloc amb la cobertura al davant i una persona per fila", () => {
    expect(html).toContain('<section class="bloc" id="nascuts">');
    expect(html).toContain("Wikidata hi situa <b>560 persones</b> nascudes. Aquestes són les 3 amb més enllaços");
    // Una fila per persona; el <li> del crèdit plegat no hi compta.
    expect(html.match(/<li><(?:img|span) class="cara-alcaldia/g)).toHaveLength(3);
  });

  it("cara de Commons quan la llicència ho permet, inicials si no; nom enllaçat a la Viquipèdia si en té", () => {
    expect(html).toContain('<img class="cara-alcaldia petita" style="--mida:44px;" src="https://upload.wikimedia.org/x/120px-Luis.jpg"');
    expect(html).toContain('<b><a href="https://ca.wikipedia.org/wiki/Luis_Javier_Garc%C3%ADa_Sanz" rel="noopener nofollow">Luis Javier García Sanz</a></b>');
    expect(html).toContain('<small><span class="anys">1978</span> · futbolista</small>');
    // La Mireia té fotografia a Wikidata però no publicable: surt amb inicials.
    expect(html).toContain(">MB</span>");
    expect(html).not.toContain("120px-Mireia");
    // Sense article: el nom en text, escapat, i els anys de vida sencers.
    expect(html).toContain('<span class="sense-article">Pau Pi &lt;i&gt;Pons&lt;/i&gt;</span>');
    expect(html).toContain('<span class="anys">1881-1973</span>');
    expect(html).toContain('<a class="wd" href="https://www.wikidata.org/wiki/Q5593" rel="noopener nofollow">Q5593 a Wikidata</a>');
  });

  it("acredita les fotografies publicades, plegades sota la llista", () => {
    expect(html).toContain("<summary>D'on surt el retrat</summary>");
    expect(html).toContain("Foto: Ferran Cornellà, <a href=\"https://creativecommons.org/licenses/by-sa/4.0/\" rel=\"license noopener nofollow\">CC BY-SA 4.0</a>");
    expect(html).toContain('href="https://commons.wikimedia.org/wiki/File:Luis_Garc%C3%ADa_Sanz.jpg"');
  });

  it("diu «segons Wikidata», la data i quantes de quantes al peu", () => {
    expect(html).toContain("Lloc de naixement (P19), 3 de 560 <b>segons Wikidata</b> (dades CC0 1.0), consultat el 3 de setembre del 2026");
  });

  it("quan les desades són totes, no parla de retall", () => {
    const petit = renderNascuts({ ...BADALONA, nascuts: { total: 3, persones: BADALONA.nascuts.persones } });
    expect(petit).toContain("Wikidata hi situa <b>3 persones nascudes</b>, i són aquestes.");
    expect(petit).not.toContain("amb més enllaços");
    expect(petit).toContain("Lloc de naixement (P19) <b>segons Wikidata</b>");
    const una = renderNascuts({ ...BADALONA, nascuts: { total: 1, persones: BADALONA.nascuts.persones.slice(0, 1) } });
    expect(una).toContain("Wikidata hi situa <b>una persona nascuda</b>.");
  });

  it("sense ningú no hi ha bloc", () => {
    expect(renderNascuts({ ...BADALONA, nascuts: { total: 0, persones: [] } })).toBe("");
    expect(renderNascuts(null)).toBe("");
  });

  it("els anys de vida, només l'any i només el que hi ha", () => {
    expect(anysDeVida({ naixement: null, defuncio: null })).toBe("");
    expect(anysDeVida({ naixement: "1990-11-10", defuncio: null })).toBe("1990");
    expect(anysDeVida({ naixement: null, defuncio: "1973-04-08" })).toBe("† 1973");
    expect(retratDe(BADALONA.nascuts.persones[1]!)).toBeNull();
    expect(retratDe(BADALONA.nascuts.persones[0]!)).toMatchObject({ nom: "Luis Javier García Sanz", cami: "https://upload.wikimedia.org/x/120px-Luis.jpg", autor: "Ferran Cornellà" });
  });
});

describe("curiositatsWikidata", () => {
  const fila = (s: string, p: number, ag: number | null | undefined, nas: number | null | undefined): FilaCuriositatWikidata => ({
    s, n: s.toUpperCase(), c: "Barcelonès", p, ag, nas,
  });
  const files = [
    fila("barcelona", 1_700_000, 18, 14_442),
    fila("badalona", 225_000, 3, 560),
    fila("sabadell", 216_000, 0, 300),
    fila("terrassa", 224_000, 5, 0),
    fila("sense-dada", 1_000, null, undefined),
  ];
  const fets = curiositatsWikidata(files);

  it("dues curiositats: més agermanaments i més persones amb fitxa, amb la cobertura", () => {
    expect(fets.map((f) => f.id)).toEqual(["agermanaments", "nascuts-wikidata"]);
    const [ag, nas] = fets;
    expect(ag!.llistes[0]!.files.map((f) => `${f.municipi.n} ${f.valor}`)).toEqual(["BARCELONA 18 agermanaments", "TERRASSA 5 agermanaments", "BADALONA 3 agermanaments"]);
    expect(ag!.cobertura).toBe("S'ha mirat l'element de Wikidata de 4 municipis dels 5. En tenen algun 3.");
    expect(nas!.llistes[0]!.files.map((f) => `${f.municipi.n} ${f.valor} · ${f.detall}`)).toEqual([
      "BARCELONA 14.442 persones · 1.700.000 habitants", "BADALONA 560 persones · 225.000 habitants", "SABADELL 300 persones · 216.000 habitants",
    ]);
    expect(nas!.cobertura).toBe("S'ha mirat el lloc de naixement a Wikidata de 4 municipis dels 5. En total, Wikidata hi situa 15.302 persones, de les 3 municipis on n'hi situa alguna.");
    for (const f of fets) {
      expect(f.font).toBe("Wikidata (CC0)");
      expect(f.cautela).toBeTruthy();
      expect(f.metode).not.toMatch(/millor|pitjor/);
    }
  });

  it("sense cap dada, cap curiositat", () => {
    expect(curiositatsWikidata([])).toEqual([]);
    expect(curiositatsWikidata([fila("x", 1, 0, 0), fila("y", 1, null, null)])).toEqual([]);
  });

  it("l'estil és el de les pastilles i la llista amb cara, sense accents greus", () => {
    expect(WIKIDATA_FITXA_CSS).toContain(".agermanament{");
    expect(WIKIDATA_FITXA_CSS).toContain(".nascuts li{");
    expect(WIKIDATA_FITXA_CSS).not.toContain("`");
  });
});
