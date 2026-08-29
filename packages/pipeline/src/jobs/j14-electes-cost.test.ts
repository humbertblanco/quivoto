import { describe, expect, it } from "vitest";
import { normalizePersonName } from "../lib/text";
import {
  campOmplert,
  creuaSegonsCarrecs,
  declaraAltresRetribucions,
  esAlcaldia,
  esAlcaldiaSegonsFitxa,
  estatRetribucio,
  importEnEuros,
  indexUnic,
  llegeixFitxaCarrec,
  MENSUALITATS_DIBA,
  nomsDeCella,
  parseRetribucionsDiba,
  perHabitant,
  perRegidoria,
  publicaDeclaracioBens,
  resumRetribucions,
  retribucioAnualDiba,
  slugsSupramunicipals,
  valorCamp,
  type EstatCarrec,
} from "./j14-electes-cost";

// ─────────────────────────────────────────────────────────────────────────────
// Els dos quocients que publica la fitxa
// ─────────────────────────────────────────────────────────────────────────────

describe("perHabitant", () => {
  it("arrodoneix a cèntims", () => {
    expect(perHabitant(815_729, 79_609)).toBe(10.25);
    expect(perHabitant(79_202_520, 7_900_000)).toBe(10.03);
  });

  /**
   * Sense padró no hi ha quocient. Dividir pel padró vigent i dir-ne «cost per
   * habitant del 2019» barrejaria dues bases sense que ho sabés ningú, i és
   * exactament el que ha de tornar `null` perquè la fitxa no ho ensenyi.
   */
  it("no s'inventa res quan no sabem quanta gent hi viu", () => {
    expect(perHabitant(100_000, null)).toBeNull();
    expect(perHabitant(100_000, 0)).toBeNull();
    expect(perHabitant(null, 5_000)).toBeNull();
  });

  it("un municipi que no paga res als seus càrrecs val zero, no null", () => {
    expect(perHabitant(0, 300)).toBe(0);
  });
});

describe("perRegidoria", () => {
  it("reparteix el total entre els escons del ple, en euros sencers", () => {
    expect(perRegidoria(815_729, 25)).toBe(32_629);
    expect(perRegidoria(6_030, 3)).toBe(2_010);
  });

  it("sense escons no hi ha repartiment", () => {
    expect(perRegidoria(50_000, null)).toBeNull();
    expect(perRegidoria(50_000, 0)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Els imports, que és on les fonts es contradiuen entre elles
// ─────────────────────────────────────────────────────────────────────────────

describe("importEnEuros", () => {
  it("llegeix el format de seu-e amb coma decimal", () => {
    expect(importEnEuros("17.027,7 €")).toBe(17_027.7);
    expect(importEnEuros("90.940,08 € (sou de la Diputació de Barcelona)")).toBe(90_940.08);
    expect(importEnEuros("1.060,26 € per assistència a cada sessió de Ple")).toBe(1_060.26);
  });

  /**
   * La Diputació de Lleida escriu «82.081.76 €»: punt de milers i punt decimal
   * a la mateixa xifra. Llegit com si el punt fos només de milers, el president
   * passaria a cobrar 8,2 milions d'euros.
   */
  it("desfà el punt doble de la Diputació de Lleida", () => {
    expect(importEnEuros("Retribució anual bruta: 82.081.76 €")).toBe(82_081.76);
  });

  it("llegeix la taula de la Diputació de Barcelona, que va en euros mensuals", () => {
    expect(importEnEuros("8.144,08 euros")).toBe(8_144.08);
    expect(importEnEuros("5.471,82 euros (75%)")).toBe(5_471.82);
  });

  it("un zero declarat és una xifra, no un silenci", () => {
    expect(importEnEuros("0,00 €")).toBe(0);
    expect(importEnEuros("0 €")).toBe(0);
  });

  /**
   * Sense «€» no es llegeix res. «Indemnitzacions anuals (Màxim): 0» pot ser un
   * nombre de sessions i no un import, i endevinar-ho aquí surt car.
   */
  it("no llegeix cap número que no vagi acompanyat d'euros", () => {
    expect(importEnEuros("No percep cap retribució per aquest càrrec")).toBeNull();
    expect(importEnEuros("Indemnitzacions anuals (Màxim): 0")).toBeNull();
    expect(importEnEuros("")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Els camps de la fitxa de seu-e: se'n compta la resposta, mai l'import
// ─────────────────────────────────────────────────────────────────────────────

/** Una fitxa `veureCarrec` retallada al que llegeix aquesta feina. */
function fitxa(parts: {
  retribucio?: string | null;
  altres?: string;
  dietes?: string;
  indemnitzacions?: string;
  bens?: boolean;
  alcalde?: boolean;
}): string {
  const p = (classe: string, etiqueta: string, valor: string | undefined): string =>
    valor === undefined
      ? ""
      : `<p class="${classe}"><strong>${etiqueta}:</strong><span>${valor}</span></p>`;
  return [
    `<p class="carrec-nom">Ana Maria Martínez Martínez</p>`,
    parts.alcalde ? `<span class="carrec-isAlcalde">Alcaldessa</span>` : "",
    parts.retribucio === null
      ? ""
      : p("carrec-retribucio", "Retribució anual bruta", parts.retribucio ?? "17.027,7 €"),
    p("carrec-altresRetribucions", "Altres retribucions fixes de caràcter públic", parts.altres),
    p("carrec-dietes", "Dietes", parts.dietes),
    p("carrec-indemnitzacionsAnuals", "Indemnitzacions anuals (Màxim)", parts.indemnitzacions),
    parts.bens ? `<a class="carrec-declaracio-activitats-bens" href="?p_p_id=x">Declaració activitats i béns</a>` : "",
  ].join("\n");
}

describe("valorCamp", () => {
  /**
   * L'etiqueta del camp hi és sempre, encara que l'ajuntament no hi hagi escrit
   * res. Llegint el paràgraf sencer, un camp buit semblaria omplert perquè el
   * títol hi surt, i el recompte de qui respon deixaria de mesurar res.
   */
  it("torna el valor sense l'etiqueta", () => {
    expect(valorCamp(fitxa({}), "carrec-retribucio")).toBe("17.027,7 €");
  });

  it("distingeix el camp que no hi és del camp que hi és buit", () => {
    expect(valorCamp(fitxa({ retribucio: null }), "carrec-retribucio")).toBeNull();
    expect(valorCamp(fitxa({ dietes: "" }), "carrec-dietes")).toBe("");
    expect(campOmplert(fitxa({ dietes: "" }), "carrec-dietes")).toBe(false);
    expect(campOmplert(fitxa({ dietes: "400 €" }), "carrec-dietes")).toBe(true);
  });
});

describe("estatRetribucio", () => {
  it("separa els tres casos: xifra, resposta sense xifra i cap resposta", () => {
    expect(estatRetribucio(fitxa({}))).toBe("xifra");
    expect(estatRetribucio(fitxa({ retribucio: "No percep cap retribució" }))).toBe("sense-xifra");
    expect(estatRetribucio(fitxa({ retribucio: null }))).toBe("cap");
  });

  it("declarar 0,00 € és haver respost", () => {
    expect(estatRetribucio(fitxa({ retribucio: "0,00 €" }))).toBe("xifra");
  });
});

describe("declaraAltresRetribucions", () => {
  /** És el camp que a Rubí destapa els 90.940,08 € que no paga l'ajuntament. */
  it("detecta qui declara cobrar d'una altra administració", () => {
    expect(declaraAltresRetribucions(fitxa({ altres: "90.940,08 € (sou de la Diputació)" }))).toBe(true);
    expect(declaraAltresRetribucions(fitxa({}))).toBe(false);
    expect(declaraAltresRetribucions(fitxa({ altres: "Cap" }))).toBe(false);
  });
});

describe("publicaDeclaracioBens", () => {
  /**
   * L'enllaç del document va per paràmetre `?p_p_id=`, que el robots.txt de
   * seu-e prohibeix: no es baixa mai. El que sí que es pot saber és si hi és.
   */
  it("diu si l'ajuntament la publica, sense tocar el document", () => {
    expect(publicaDeclaracioBens(fitxa({ bens: true }))).toBe(true);
    expect(publicaDeclaracioBens(fitxa({ bens: false }))).toBe(false);
  });
});

describe("esAlcaldiaSegonsFitxa", () => {
  it("llegeix la marca d'alcaldia de la fitxa", () => {
    expect(esAlcaldiaSegonsFitxa(fitxa({ alcalde: true }))).toBe(true);
    expect(esAlcaldiaSegonsFitxa(fitxa({}))).toBe(false);
  });
});

describe("llegeixFitxaCarrec", () => {
  /**
   * La garantia que aquesta feina no pot desar cap euro d'un ajuntament: el que
   * en surt són booleans i un estat, i cap número.
   */
  it("no torna cap import, per més que la fitxa n'estigui plena", () => {
    const html = fitxa({
      retribucio: "17.027,7 €",
      altres: "90.940,08 €",
      dietes: "400 €",
      indemnitzacions: "1.200 €",
      bens: true,
      alcalde: true,
    });
    const llegit = llegeixFitxaCarrec("Ana Maria Martínez Martínez", "https://seu-e.cat/x", html);
    expect(llegit).toEqual({
      nom: "Ana Maria Martínez Martínez",
      fitxa: "https://seu-e.cat/x",
      retribucio: "xifra",
      altresRetribucions: true,
      dietes: true,
      indemnitzacions: true,
      declaracioBens: true,
      alcaldia: true,
    });
    expect(JSON.stringify(llegit)).not.toContain("027");
    expect(JSON.stringify(llegit)).not.toContain("940");
  });
});

describe("resumRetribucions", () => {
  const carrec = (parts: Partial<EstatCarrec>): EstatCarrec => ({
    nom: "x",
    fitxa: null,
    retribucio: "xifra",
    altresRetribucions: false,
    dietes: false,
    indemnitzacions: false,
    declaracioBens: false,
    alcaldia: false,
    ...parts,
  });

  it("compta la resposta de cadascú i resumeix el consistori", () => {
    const resum = resumRetribucions([
      carrec({ declaracioBens: true }),
      carrec({ retribucio: "sense-xifra" }),
      carrec({ retribucio: "cap", dietes: true }),
      carrec({ retribucio: null }),
    ]);
    expect(resum.total).toBe(4);
    expect(resum.ambXifra).toBe(1);
    expect(resum.senseXifra).toBe(1);
    expect(resum.senseCamp).toBe(1);
    // La fitxa que no s'ha pogut llegir no compta com a «no publica».
    expect(resum.senseFitxa).toBe(1);
    expect(resum.ambDietes).toBe(1);
    expect(resum.ambDeclaracioBens).toBe(1);
    expect(resum.publica).toBe("alguns");
  });

  it("un consistori que no en publica cap i un que les publica totes", () => {
    expect(resumRetribucions([carrec({ retribucio: "cap" }), carrec({ retribucio: "cap" })]).publica).toBe("cap");
    expect(resumRetribucions([carrec({}), carrec({})]).publica).toBe("tots");
    expect(resumRetribucions([carrec({ declaracioBens: true }), carrec({ declaracioBens: true })]).publicaBens).toBe(
      "tots",
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// L'aparellament de noms, que és on una equivocació és difamatòria
// ─────────────────────────────────────────────────────────────────────────────

describe("indexUnic", () => {
  it("deixa fora el nom que porta a dues persones", () => {
    const { unics, ambigus } = indexUnic(
      [
        { nom: "MARIA GARCIA LOPEZ", on: "Girona" },
        { nom: "Maria García i López", on: "Reus" },
        { nom: "JOAN PUIG SOLER", on: "Vic" },
      ],
      (p) => normalizePersonName(p.nom),
    );
    expect([...unics.keys()]).toEqual(["joan puig soler"]);
    expect(ambigus.size).toBe(1);
  });
});

describe("creuaSegonsCarrecs", () => {
  const municipals = [
    { nom: "GEMMA TARAFA ORPINELL", ens: "Ajuntament de Barcelona" },
    { nom: "MARC SERRA SOLÉ", ens: "Ajuntament de Barcelona" },
    { nom: "ANA MARIA MARTÍNEZ MARTÍNEZ", ens: "Ajuntament de Rubí" },
    { nom: "MARIA GARCIA LOPEZ", ens: "Ajuntament de Girona" },
    { nom: "Maria Garcia i Lopez", ens: "Ajuntament de Reus" },
  ];

  it("lliga qui les dues fonts escriuen igual", () => {
    const { lligams } = creuaSegonsCarrecs(municipals, [
      { nom: "Gemma Tarafa i Orpinell", ens: "Diputació de Barcelona" },
    ]);
    expect(lligams).toHaveLength(1);
    expect(lligams[0]!.municipal.ens).toBe("Ajuntament de Barcelona");
  });

  /**
   * El cas que no es pot relaxar. «Marc Serra Soler» a la Diputació i «Marc
   * Serra Solé» a l'Ajuntament de Barcelona són gairebé segur la mateixa
   * persona, i no es lliguen: quan dues fonts oficials no coincideixen ni en el
   * cognom, qui s'ha d'equivocar no som nosaltres. El mateix amb «Ana M.»
   * contra «Ana Maria».
   */
  it("no lliga el que dues fonts oficials escriuen diferent", () => {
    const { lligams, senseParella } = creuaSegonsCarrecs(municipals, [
      { nom: "Marc Serra Soler", ens: "Diputació de Barcelona" },
      { nom: "Ana M. Martínez Martínez", ens: "Diputació de Barcelona" },
    ]);
    expect(lligams).toHaveLength(0);
    expect(senseParella).toHaveLength(2);
  });

  /** Un nom compartit per dues persones no lliga amb cap de les dues. */
  it("davant d'un nom ambigu no lliga res", () => {
    const { lligams, ambigusMunicipals } = creuaSegonsCarrecs(municipals, [
      { nom: "MARIA GARCIA LOPEZ", ens: "Consell Comarcal del Gironès" },
    ]);
    expect(lligams).toHaveLength(0);
    expect(ambigusMunicipals).toContain("maria garcia lopez");
  });

  it("i tampoc quan l'ambigüitat és a la banda supramunicipal", () => {
    const { lligams, ambigusSupramunicipals } = creuaSegonsCarrecs(
      [{ nom: "JOAN PUIG SOLER", ens: "Ajuntament de Vic" }],
      [
        { nom: "Joan Puig i Soler", ens: "Consell Comarcal d'Osona" },
        { nom: "JOAN PUIG SOLER", ens: "Diputació de Lleida" },
      ],
    );
    expect(lligams).toHaveLength(0);
    expect(ambigusSupramunicipals).toContain("joan puig soler");
  });
});

describe("esAlcaldia", () => {
  it("reconeix com escriu l'alcaldia el conjunt de plens", () => {
    expect(esAlcaldia("Alcalde President")).toBe(true);
    expect(esAlcaldia("Alcaldessa Presidenta")).toBe(true);
    expect(esAlcaldia("Regidora")).toBe(false);
    expect(esAlcaldia("2n Tinent d'Alcalde")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Els slugs dels ens que paguen el segon càrrec
// ─────────────────────────────────────────────────────────────────────────────

describe("slugsSupramunicipals", () => {
  it("genera l'abreviatura que fa servir seu-e", () => {
    expect(slugsSupramunicipals("Consell Comarcal del Baix Camp")[0]).toBe("ccbaixcamp");
    expect(slugsSupramunicipals("Consell Comarcal de l'Alt Empordà")[0]).toBe("ccaltemporda");
    expect(slugsSupramunicipals("Consell Comarcal del Pla d'Urgell")[0]).toBe("ccpladurgell");
    expect(slugsSupramunicipals("Diputació de Lleida")[0]).toBe("diputaciolleida");
  });

  it("sempre en dona més d'un, perquè la regla no és garantida", () => {
    expect(slugsSupramunicipals("Consell Comarcal del Moianès").length).toBeGreaterThan(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// La pàgina de la Diputació de Barcelona
// ─────────────────────────────────────────────────────────────────────────────

/** La pàgina de retribucions de la diba, retallada a la seva forma real. */
const HTML_DIBA = `
<p>Els membres electes que exerceixen el seu càrrec amb caràcter de dedicació exclusiva
perceben les següents retribucions, a raó de catorze mensualitats per any:</p>
<table>
 <thead><tr><th>Càrrec</th><th>Electes</th><th>Codi retributiu</th></tr></thead>
 <tbody>
  <tr><td>Presidenta</td><td>Lluïsa Moret Sabidó</td><td><p>A1</p></td></tr>
  <tr><td>Vicepresidències</td><td><p>Gemma Tarafa Orpinell<br> Alba Barnusell Ortuño</p></td><td>A2</td></tr>
  <tr><td>Presidències delegades d’àrea</td><td><p>Ana M. Martínez Martínez<br> Marc Serra Soler</p></td><td>A3</td></tr>
 </tbody>
</table>
<table>
 <thead><tr><th>Càrrec</th><th>Electes</th><th>Codi retributiu</th></tr></thead>
 <tbody>
  <tr><td>Vicepresidències, amb dedicació parcial</td><td><p>&nbsp;</p></td><td><p>A4</p></td></tr>
  <tr><td>Presidències delegades, amb dedicació parcial</td>
      <td><p>Antoni Vélez i Barajas (51%)<br> Eva Soler i Guallar (75%)</p></td><td><p>A5</p></td></tr>
 </tbody>
</table>
<table>
 <thead><tr><th>Càrrec</th><th>Electes</th></tr></thead>
 <tbody><tr><td>Diputats sense dedicació</td><td><p>Marc Almendro Campillo<br> Francina Vila i Valls</p></td></tr></tbody>
</table>
<p>Per assistència efectiva a les sessions del Ple: 973,92 €</p>
<p>Per assistència efectiva a les Comissions informatives i de Seguiment i a la Comissió Especial de Comptes: 446,86 €</p>
<p>El nombre de les assignacions ha de ser com a màxim de dues al mes.</p>
<p>Taula retributiva dels diputats de la Diputació de Barcelona - any 2024</p>
<table>
 <thead><tr><th>Codi retributiu</th><th>Retribució bruta mensual</th></tr></thead>
 <tbody>
  <tr><td>A1</td><td>8.144,08&nbsp;euros</td></tr>
  <tr><td>A2</td><td>7.295,75&nbsp;euros</td></tr>
  <tr><td>A3</td><td>6.495,72&nbsp;euros</td></tr>
  <tr><td>A5</td><td><p>4.871,79&nbsp;euros (75%)</p><p>3.312,82&nbsp;euros (51%)</p><p>1.623,93 euros (25%)</p></td></tr>
 </tbody>
</table>`;

describe("nomsDeCella", () => {
  it("separa els noms pel salt de línia, que és com els escriu la pàgina", () => {
    const noms = nomsDeCella("<p>Antoni Vélez i Barajas (51%)<br> Eva Soler i Guallar (75%)</p>");
    expect(noms).toEqual([
      { nom: "Antoni Vélez i Barajas", percentatge: 51 },
      { nom: "Eva Soler i Guallar", percentatge: 75 },
    ]);
  });

  it("una cel·la buida no dona cap nom", () => {
    expect(nomsDeCella("<p>&nbsp;</p>")).toEqual([]);
  });
});

describe("parseRetribucionsDiba", () => {
  const dades = parseRetribucionsDiba(HTML_DIBA);

  it("llegeix els electes amb codi retributiu i la taula que el converteix", () => {
    expect(dades.electes).toHaveLength(7);
    expect(dades.tarifes.get("A2")).toEqual([{ percentatge: null, mensual: 7_295.75 }]);
    expect(dades.tarifes.get("A5")).toHaveLength(3);
    expect(dades.anyTarifa).toBe(2024);
  });

  it("separa els que només cobren per assistència, que no tenen sou anual", () => {
    expect(dades.perAssistencia.map((p) => p.nom)).toEqual([
      "Marc Almendro Campillo",
      "Francina Vila i Valls",
    ]);
    expect(dades.assistencies).toEqual({ ple: 973.92, comissio: 446.86, maximComissionsMes: 2 });
  });

  it("marca la dedicació que diu la seva pàgina", () => {
    expect(dades.electes.find((e) => e.nom === "Lluïsa Moret Sabidó")!.dedicacio).toBe("exclusiva");
    expect(dades.electes.find((e) => e.nom === "Eva Soler i Guallar")!.dedicacio).toBe("parcial");
  });
});

describe("retribucioAnualDiba", () => {
  const { tarifes } = parseRetribucionsDiba(HTML_DIBA);

  /**
   * La comprovació que fa publicable tot aquest bloc: la conversió del codi
   * quadra a l'euro amb el que declara la fitxa de seu-e de qui cobra.
   * A3 = 6.495,72 × 14 = 90.940,08 €, que és exactament el que consta a la
   * fitxa de l'alcaldessa de Rubí com a sou de la Diputació de Barcelona.
   */
  it("converteix el codi en euros a l'any i quadra amb la font que el declara", () => {
    expect(retribucioAnualDiba({ codi: "A3", percentatge: null }, tarifes)).toBe(90_940.08);
    expect(retribucioAnualDiba({ codi: "A2", percentatge: null }, tarifes)).toBe(102_140.5);
    expect(retribucioAnualDiba({ codi: "A1", percentatge: null }, tarifes)).toBe(114_017.12);
    expect(MENSUALITATS_DIBA).toBe(14);
  });

  it("tria la tarifa del percentatge de dedicació", () => {
    expect(retribucioAnualDiba({ codi: "A5", percentatge: 75 }, tarifes)).toBe(68_205.06);
    expect(retribucioAnualDiba({ codi: "A5", percentatge: 51 }, tarifes)).toBe(46_379.48);
  });

  /** Val més no dir res que dir un sou aproximat de ningú. */
  it("no endevina quan la conversió no és inequívoca", () => {
    expect(retribucioAnualDiba({ codi: "A5", percentatge: null }, tarifes)).toBeNull();
    expect(retribucioAnualDiba({ codi: "A4", percentatge: 75 }, tarifes)).toBeNull();
    expect(retribucioAnualDiba({ codi: "", percentatge: null }, tarifes)).toBeNull();
  });
});
