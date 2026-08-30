import { describe, expect, it } from "vitest";
import {
  TRAJECTORIA_CSS,
  llistaDestins,
  barresFamilia,
  decades,
  fitxaPersona,
  graellaDeCent,
  mapaOrigen,
  ocupacions,
  percent,
  renderTrajectoriaElectes,
  type MunicipiTrajectoria,
  type SaltPersona,
  type TrajectoriaData,
} from "./trajectoria-electes";

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
  ...extra,
});

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

  it("el full d'estil hi va sencer", () => {
    expect(html).toContain(TRAJECTORIA_CSS);
    expect(TRAJECTORIA_CSS.length).toBeGreaterThan(500);
    // La regla del projecte: cap accent greu dins d'un template string. Al
    // full que escriu aquest fitxer es pot comprovar; a la pàgina sencera no,
    // perquè el cercador hi serialitza funcions que no són d'aquí.
    expect(TRAJECTORIA_CSS).not.toContain("\u0060");
  });
});
