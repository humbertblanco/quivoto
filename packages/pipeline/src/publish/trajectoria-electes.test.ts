import { describe, expect, it } from "vitest";
import {
  TRAJECTORIA_CSS,
  llistaDestins,
  barresFamilia,
  decades,
  fitxaPersona,
  graellaDeCent,
  inicials,
  mapaOrigen,
  ocupacions,
  percent,
  renderTrajectoriaElectes,
  type MunicipiTrajectoria,
  type SaltPersona,
  type TrajectoriaData,
} from "./trajectoria-electes";
import type { Retrat } from "./fotos-wikidata";

/**
 * Les xifres d'aquestes proves són les de l'extracció real del 30-08-2026:
 * 2.917 persones amb alcaldia catalana des del 1979 a Wikidata, 284 amb un
 * càrrec per sobre de l'ajuntament, 195 municipis dels 947. Són les mateixes
 * que la pàgina ha de saber escriure sempre amb el seu denominador al costat.
 */

const persona = (extra: Partial<SaltPersona> = {}): SaltPersona => ({
  qid: "Q76350582",
  url: "https://www.wikidata.org/wiki/Q76350582",
  nom: "Josep Pujadas i Maspons",
  viquipedia: "https://ca.wikipedia.org/wiki/Josep_Pujadas_i_Maspons",
  municipis: [{ nom: "Granollers", slug: "granollers" }],
  primerAny: 1986,
  ultimAny: 2004,
  families: ["parlament"],
  carrecs: [
    {
      nom: "diputat al Parlament de Catalunya",
      familia: "parlament",
      inici: "1995-10-01",
      fi: "1999-09-01",
    },
  ],
  ocupacions: ["advocat"],
  aparellat: true,
  fitxa: "../m/granollers/regidor/josep-pujadas-i-maspons/",
  foto: "/observatori/fotos/160/8096.webp",
  retrat: null,
  ...extra,
});

/** El retrat de Commons d'un exalcalde, tal com J28 el desa. */
const RETRAT: Retrat = {
  nom: "Josep Pujadas i Maspons",
  cami: "/observatori/fotos/wikimedia/Q76350582.jpg",
  fitxer: "File:Josep Pujadas.jpg",
  paginaFitxer: "https://commons.wikimedia.org/wiki/File:Josep_Pujadas.jpg",
  autor: "Davidpar",
  llicencia: { nom: "CC BY-SA 4.0", url: "https://creativecommons.org/licenses/by-sa/4.0" },
  amplada: 240,
  alcada: 320,
};

const municipi = (i: number, ambSalt: number): MunicipiTrajectoria => ({
  slug: `poble-${i}`,
  nom: `Poble ${i}`,
  lat: 41 + (i % 40) / 40,
  lon: 0.6 + (i % 50) / 25,
  alcaldes: 3,
  ambSalt,
});

const DADES: TrajectoriaData = {
  font: "Wikidata (wikidata.org)",
  fontUrl: "https://query.wikidata.org/sparql",
  llicencia: "CC0 1.0",
  descarregat: "2026-08-30",
  totalPersones: 2_917,
  aparellades: 1_900,
  alcaldesHistorial: 6_400,
  municipisAmbAlcalde: 947,
  municipisTotal: 947,
  ambSalt: 284,
  families: [
    { clau: "parlament", etiqueta: "Parlament de Catalunya", frase: "al Parlament de Catalunya", persones: 213 },
    { clau: "congres", etiqueta: "Congrés dels Diputats", frase: "al Congrés dels Diputats", persones: 46 },
    { clau: "senat", etiqueta: "Senat", frase: "al Senat", persones: 46 },
    { clau: "diputacio", etiqueta: "Presidència de diputació", frase: "a la presidència d'una diputació", persones: 29 },
    { clau: "govern", etiqueta: "Govern", frase: "al Govern", persones: 36 },
    { clau: "europeu", etiqueta: "Parlament Europeu", frase: "al Parlament Europeu", persones: 3 },
  ],
  decades: [
    { decada: 1970, alcaldes: 310, ambSalt: 29 },
    { decada: 1980, alcaldes: 309, ambSalt: 54 },
    { decada: 1990, alcaldes: 405, ambSalt: 68 },
    { decada: 2000, alcaldes: 512, ambSalt: 53 },
    { decada: 2010, alcaldes: 958, ambSalt: 65 },
    { decada: 2020, alcaldes: 423, ambSalt: 15 },
  ],
  ocupacions: [
    { nom: "empresari", quants: 68 },
    { nom: "professor", quants: 57 },
    { nom: "advocat", quants: 50 },
  ],
  ambOcupacio: 603,
  ambViquipedia: 613,
  ambViquipediaSalt: 272,
  ambViquipediaSenseSalt: 341,
  municipis: [
    ...Array.from({ length: 195 }, (_, i) => municipi(i, 1)),
    ...Array.from({ length: 752 }, (_, i) => municipi(195 + i, 0)),
  ],
  persones: [persona(), persona({ qid: "Q9999", nom: "Maria Roig", families: ["senat"], viquipedia: null, aparellat: false, primerAny: 2015, ultimAny: 2015, carrecs: [{ nom: "senador al Senat espanyol", familia: "senat", inici: "2019-05-21", fi: null }], ocupacions: [] })],
};

// ─────────────────────────────────────────────────────────────────────────────

describe("percent", () => {
  it("escriu el tant per cent a la catalana i sense decimals inútils", () => {
    expect(percent(284, 2_917)).toBe("9,7 %");
    expect(percent(272, 284)).toBe("96 %");
    expect(percent(0, 10)).toBe("0,0 %");
    expect(percent(1, 0)).toBe("—");
  });
});

describe("graellaDeCent", () => {
  it("pinta els quadrats que toquen sobre cent", () => {
    const svg = graellaDeCent(284, 2_917, "prova");
    expect((svg.match(/class="ple"/g) ?? []).length).toBe(10);
    expect((svg.match(/class="buit"/g) ?? []).length).toBe(90);
  });

  /**
   * Una proporció petita però real no pot sortir com una graella tota buida:
   * diria «cap», que és fals. I un total zero no pot sortir amb res pintat.
   */
  it("mai no diu «cap» quan n'hi ha, ni «algun» quan no n'hi ha", () => {
    expect((graellaDeCent(3, 2_917, "p").match(/class="ple"/g) ?? []).length).toBe(1);
    expect((graellaDeCent(0, 2_917, "p").match(/class="ple"/g) ?? []).length).toBe(0);
    expect(graellaDeCent(5, 0, "p")).toBe("");
  });

  it("porta el text equivalent a l'etiqueta, no només al dibuix", () => {
    expect(graellaDeCent(284, 2_917, "10 de cada 100")).toContain('aria-label="10 de cada 100"');
    expect(graellaDeCent(284, 2_917, "10 de cada 100")).toContain("<figcaption>10 de cada 100");
  });
});

describe("barresFamilia", () => {
  const svg = barresFamilia(DADES.families, DADES.totalPersones);

  it("totes les barres comparteixen escala: la més gran omple i la petita no", () => {
    expect(svg).toContain("width:100.0%");
    // 3 sobre 213 és un 1,4 %, i el mínim visible és 1,5: el Parlament Europeu
    // no pot desaparèixer, però tampoc pot semblar més gran del que és.
    expect(svg).toContain("width:1.5%");
  });

  it("cada xifra va amb el seu denominador", () => {
    expect(svg).toContain("<b>213</b> 7,3 %");
    expect(svg).toContain("sobre les 2.917 persones");
  });

  /**
   * 213 + 46 + 46 + 36 + 29 + 3 fa 373 i el total és 284: qui ha estat al
   * Parlament i després al Congrés compta a totes dues. Una suma que no quadra
   * i no s'explica fa desconfiar de tota la pàgina.
   */
  it("explica per què les barres no sumen el total", () => {
    expect(svg).toContain("<b>Les barres no sumen 2.917</b>");
  });

  it("no dibuixa les famílies buides ni peta sense cap", () => {
    const cap = barresFamilia(DADES.families.map((f) => ({ ...f, persones: 0 })), 2_917);
    expect(cap).toBe("");
  });
});

describe("mapaOrigen", () => {
  const svg = mapaOrigen(DADES.municipis);

  it("pinta un punt per municipi i cada punt porta a la seva fitxa", () => {
    expect((svg.match(/<circle/g) ?? []).length).toBe(947);
    expect(svg).toContain('href="../m/poble-0/"');
  });

  /**
   * La regla dura de la pàgina, feta codi: si el radi creixés amb el padró,
   * Barcelona seria una taca i el mapa diria «les ciutats grans en fan més»,
   * que és mesurar el biaix de la font.
   */
  it("el punt no creix amb la població: només hi ha tres mides", () => {
    const radis = new Set([...svg.matchAll(/r="([\d.]+)"/g)].map((m) => m[1]));
    expect(radis.size).toBeLessThanOrEqual(3);
  });

  it("diu quants n'han donat i quants no", () => {
    expect(svg).toContain("N'ha donat algun (195)");
    expect(svg).toContain("Cap que consti (752)");
  });

  it("sense prou municipis situats no dibuixa res", () => {
    expect(mapaOrigen(DADES.municipis.slice(0, 5))).toBe("");
    expect(mapaOrigen(DADES.municipis.map((m) => ({ ...m, lat: null, lon: null })))).toBe("");
  });
});

describe("decades i ocupacions", () => {
  it("la sèrie porta les dues xifres, no només el percentatge", () => {
    const html = decades(DADES.decades);
    expect(html).toContain("<b>Anys 1980</b><span>54 de 309</span>");
    expect(html).toContain("<b>Anys 2010</b><span>65 de 958</span>");
  });

  it("una dècada sola no dona sèrie", () => {
    expect(decades([{ decada: 1980, alcaldes: 10, ambSalt: 2 }])).toBe("");
  });

  it("les ocupacions diuen de quants se'n sap i de quants no", () => {
    const html = ocupacions(DADES.ocupacions, DADES.ambOcupacio, DADES.totalPersones);
    expect(html).toContain("de les 603 persones que en declaren");
    expect(html).toContain("<b>De les altres 2.314 no en sabem res</b>");
  });
});

describe("fitxaPersona", () => {
  it("enllaça el municipi i l'ítem d'origen", () => {
    const html = fitxaPersona(persona());
    expect(html).toContain('href="../m/granollers/"');
    expect(html).toContain('href="https://www.wikidata.org/wiki/Q76350582"');
    expect(html).toContain("alcaldia a");
    expect(html).toContain("1986–2004");
    expect(html).toContain("Abans: advocat");
  });

  it("qui no lliga amb el nostre historial ho porta escrit", () => {
    expect(fitxaPersona(persona({ aparellat: false }))).toContain("no lliga amb el nostre historial");
    expect(fitxaPersona(persona({ aparellat: true }))).not.toContain("no lliga amb el nostre");
  });

  it("el nom porta a la fitxa de la persona quan en té, i el retrat hi surt", () => {
    const html = fitxaPersona(persona());
    expect(html).toContain('href="../m/granollers/regidor/josep-pujadas-i-maspons/"');
    expect(html).toContain('src="/observatori/fotos/160/8096.webp"');
    // La Viquipedia continua sent-hi, però al peu i com a font: el nom porta a
    // la nostra pàgina, que és la que respon qui és aquesta persona.
    expect(html).toContain("Viquipedia</a>");
  });

  it("qui no té fitxa pròpia porta a l'historial d'alcaldies del seu municipi", () => {
    const html = fitxaPersona(persona({ fitxa: "../m/granollers/#alcaldies", foto: null }));
    expect(html).toContain('href="../m/granollers/#alcaldies"');
    expect(html).not.toContain("<img");
  });

  it("un nom amb signes no es converteix en marques", () => {
    const html = fitxaPersona(persona({ nom: 'Anna <b>"Rius"</b> & Puig', viquipedia: null }));
    expect(html).toContain("Anna &lt;b&gt;&quot;Rius&quot;&lt;/b&gt; &amp; Puig");
  });

  /**
   * La política de fotografies, feta codi: primer el retrat oficial, després
   * el de Wikimedia Commons amb el crèdit a la vista, i si no, les inicials.
   */
  it("sense retrat oficial surt el de Commons, amb el crèdit al peu de la targeta", () => {
    const html = fitxaPersona(persona({ foto: null, retrat: RETRAT }));
    expect(html).toContain('src="/observatori/fotos/wikimedia/Q76350582.jpg"');
    expect(html).toContain('class="retrat retrat-wikimedia"');
    expect(html).toContain('width="56" height="56"');
    expect(html).toContain("Foto: Davidpar, ");
    expect(html).toContain('rel="license noopener nofollow">CC BY-SA 4.0</a>');
    expect(html).toContain('href="https://commons.wikimedia.org/wiki/File:Josep_Pujadas.jpg"');
    // El crèdit és text de la targeta, no un «title» que només surt amb el ratolí.
    expect(html).not.toContain('title="');
  });

  it("el retrat oficial mana sobre el de Commons, i llavors no hi ha crèdit de Commons", () => {
    const html = fitxaPersona(persona({ retrat: RETRAT }));
    expect(html).toContain('src="/observatori/fotos/160/8096.webp"');
    expect(html).not.toContain("wikimedia");
    expect(html).not.toContain("Foto:");
  });

  it("sense cap retrat hi van les inicials, amb la mateixa classe que la cara", () => {
    const html = fitxaPersona(persona({ foto: null, retrat: null }));
    expect(html).toContain('<span class="retrat inicials" aria-hidden="true">JP</span>');
    expect(html).not.toContain("<img");
    expect(inicials("Maria del Carme Roig")).toBe("MD");
    expect(inicials("  ")).toBe("?");
  });
});

describe("llistaDestins", () => {
  it("escriu els destins que de debò tenen algú, i cap més", () => {
    expect(llistaDestins(DADES.families)).toBe(
      "al Parlament de Catalunya, al Congrés dels Diputats, al Senat, " +
        "a la presidència d'una diputació, al Govern o al Parlament Europeu",
    );
  });

  it("una família buida no surt a la frase", () => {
    const sense = DADES.families.map((f) => (f.clau === "europeu" ? { ...f, persones: 0 } : f));
    expect(llistaDestins(sense)).not.toContain("Europeu");
    expect(llistaDestins(sense.map((f) => ({ ...f, persones: 0 })))).toBe("");
  });
});

describe("renderTrajectoriaElectes", () => {
  const html = renderTrajectoriaElectes(DADES, "30 d'agost del 2026");

  it("és una pàgina sencera amb la capçalera, la cerca i el peu compartits", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<html lang="ca">');
    expect(html).toContain('class="capcalera"');
    expect(html).toContain('class="cercador"');
    expect(html).toContain('<footer class="peu">');
    expect(html).toContain("Generat el 30 d&#039;agost del 2026".replace("&#039;", "'"));
    expect(html.trimEnd().endsWith("</html>")).toBe(true);
  });

  /**
   * La regla dura del projecte, comprovada a la pàgina i no només al capçal:
   * la xifra gran no pot sortir mai sola.
   */
  it("la xifra gran surt sempre amb el seu denominador", () => {
    expect(html).toContain("<b>284 de 2.917</b>");
    expect(html).not.toMatch(/<b>284<\/b>\s*alcaldes/);
  });

  it("el bloc de la cobertura va abans que cap altra xifra", () => {
    const cobertura = html.indexOf('id="cobertura"');
    expect(cobertura).toBeGreaterThan(0);
    expect(cobertura).toBeLessThan(html.indexOf('id="on"'));
    expect(cobertura).toBeLessThan(html.indexOf('id="mapa"'));
  });

  it("diu amb aquestes paraules què no es pot concloure", () => {
    expect(html).toContain("<b>no ho sabem</b>, no que no hi hagin arribat mai");
    expect(html).toContain("cobreix molt millor la gent famosa");
    expect(html).toContain(
      "estaria mesurant el biaix de la font i no la realitat",
    );
    // I la prova numèrica del biaix, no només l'afirmació.
    expect(html).toContain("96 % té article a la Viquipedia catalana");
    expect(html).toContain("només un 13 %");
  });

  it("avisa que la baixada de les últimes dècades no és cap troballa", () => {
    expect(html).toContain("no vol dir que ara les carreres siguin");
    expect(html).toContain("vol dir que encara no han passat");
  });

  it("cita la font, la llicència i la data d'extracció", () => {
    expect(html).toContain("Wikidata (wikidata.org)");
    expect(html).toContain("https://query.wikidata.org/sparql");
    expect(html).toContain("<b>CC0 1.0</b>");
    expect(html).toContain("el 30 d&#039;agost del 2026".replace("&#039;", "'"));
  });

  it("el filtre de la llista neix amagat i cada fitxa porta les seves famílies", () => {
    expect(html).toContain('<div class="filtra" hidden>');
    expect(html).toContain('data-familia="tots"');
    expect(html).toContain('data-families="parlament"');
    expect(html).toContain('data-families="senat"');
  });

  /**
   * El filtre no anava: «.gent > li» d'estil.ts posa display:flex a cada
   * targeta i guanya al [hidden] del navegador, de manera que el guió canviava
   * l'atribut i no s'amagava res. Aquesta prova lliga les tres peces —el guió,
   * els atributs de les targetes i la regla que fa valer el [hidden]— perquè
   * no es tornin a separar.
   */
  it("el guió del filtre toca exactament els atributs que porten les targetes i els botons", () => {
    const guio = html.slice(html.lastIndexOf("<script>"));
    expect(guio).toContain('querySelectorAll("button[data-familia]")');
    expect(guio).toContain('querySelectorAll(".persona[data-families]")');
    expect(guio).toContain('getAttribute("data-familia")');
    expect(guio).toContain('getAttribute("data-families")');
    expect(guio).toContain("li.hidden = amaga");
    expect(html).toContain('<li class="persona" data-families="parlament">');
    expect(html).toContain('<button type="button" data-familia="parlament" aria-pressed="false">');
    // «Tots» torna a ensenyar-ho tot: la clau és la mateixa al botó i al guió.
    expect(html).toContain('data-familia="tots" aria-pressed="true"');
    expect(guio).toContain('clau !== "tots"');
  });

  it("el [hidden] de les targetes i de la caixa val de debò, encara que estil.ts els posi display", () => {
    expect(TRAJECTORIA_CSS).toContain(".gent > .persona[hidden],.filtra[hidden]{display:none}");
    // Les famílies es comparen senceres: «senat» no es busca dins de cap altre text.
    expect(html).toContain('split(" ")');
    expect(html).toContain("families.indexOf(clau) === -1");
  });

  it("el compte de la llista neix amb totes i el guió el refà a cada clic", () => {
    expect(html).toContain('<p class="quants-gent" aria-live="polite">Es mostren les 2 persones.</p>');
    const guio = html.slice(html.lastIndexOf("<script>"));
    expect(guio).toContain('querySelector(".quants-gent")');
    expect(guio).toContain('"Es mostren " + visibles + " de " + targetes.length + " persones."');
    expect(guio).toContain('"Es mostren les " + visibles + " persones."');
  });

  it("el menú marca «Trajectòries» com la pàgina actual", () => {
    expect(html).toContain('<span class="ara" aria-current="page">Trajectòries</span>');
    expect(html).not.toContain('href="../trajectoria/">Trajectòries</a>');
  });

  it("diu quantes cares vénen de Commons, i no ho diu si cap", () => {
    expect(html).not.toContain("porten un retrat de");
    const ambRetrat = renderTrajectoriaElectes(
      { ...DADES, persones: [persona({ foto: null, retrat: RETRAT }), persona({ qid: "Q9999", foto: null })] },
      "30 d'agost del 2026",
    );
    expect(ambRetrat).toContain("1\n  porten un retrat de <b>Wikimedia Commons</b>");
    expect(ambRetrat).toContain("Foto: Davidpar");
  });

  it("enllaça les tipografies des d'un nivell avall, abans del full d'estil", () => {
    expect(html).toContain('href="../../assets/fonts.css"');
    expect(html.indexOf("fonts.css")).toBeLessThan(html.indexOf("<style>"));
  });

  it("el peu porta als partits, que és el que no hi ha a totes les pàgines", () => {
    expect(html).toContain('<a class="propi" href="../partit/">Els partits</a>');
    // El mapa ja hi és pel menú i pel peu de sempre: no cal repetir-lo com a propi.
    expect(html).not.toContain("El mapa dels 947");
    expect(html).not.toContain('class="propi" href="../mapa/"');
  });

  it("el full d'estil hi va sencer", () => {
    expect(html).toContain(TRAJECTORIA_CSS);
    expect(TRAJECTORIA_CSS.length).toBeGreaterThan(500);
    // La regla del projecte: cap accent greu dins d'un template string. Al
    // full que escriu aquest fitxer es pot comprovar; a la pàgina sencera no,
    // perquè el cercador hi serialitza funcions que no són d'aquí.
    expect(TRAJECTORIA_CSS).not.toContain("\u0060");
  });
});
