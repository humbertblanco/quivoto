import { describe, expect, it } from "vitest";
import {
  ambSigne, extrems, medianaDe, nomsMarca, ordinal, PAS, posicioMarca, preparaRanquings, renderRanquings, respecteMediana,
  valorMarca, type RankingRow,
} from "./ranquings";

/**
 * Cent pobles amb totes les mètriques i el mateix any: el cas net. Les
 * poblacions van de 1.000 en amunt perquè `buildPeerGroups` hi trobi més d'un
 * tram i el desplegable d'àmbit tingui alguna cosa a triar.
 */
const files = (quants = 100): RankingRow[] =>
  Array.from({ length: quants }, (_, i) => ({
    s: `poble-${i}`, n: `Poble ${String(i).padStart(3, "0")}`, c: "Comarca", p: 1_000 + i * 600,
    pt: i, rm: 10_000 + i, rma: 2023, rs: i, rsa: 2024, pa: i / 10, paa: 2025,
    ibi: 300 + i, ibia: 2025, v: i % 5, q: 12,
  }));

const ids = (rows: RankingRow[]): string[] => preparaRanquings(rows).map((r) => r.metrica.id);

describe("preparaRanquings", () => {
  it("publica només les mètriques amb el 90 % i vint valors del mateix període", () => {
    const rows = files();
    for (let i = 0; i < 11; i++) rows[i]!.rs = null;
    expect(ids(rows)).not.toContain("selectiva");
    expect(ids(rows)).toEqual(["poblacio", "participacio", "renda", "aigua", "ibi", "alternances"]);
    expect(preparaRanquings(files(19))).toHaveLength(0);
  });

  it("tria el període més recent que arriba al llindar i no en barreja dos", () => {
    const rows = files();
    // Vuit pobles amb la renda del 2022: el 2023 encara cobreix el 92 % i mana.
    for (let i = 0; i < 8; i++) rows[i]!.rma = 2022;
    const renda = preparaRanquings(rows).find((r) => r.metrica.id === "renda")!;
    expect(renda.periode).toBe("2023");
    expect(renda.files).toHaveLength(92);
    expect(renda.observades).toBe(92);
    expect(renda.total).toBe(100);
  });

  it("un zero és una dada i un any diferent és una absència", () => {
    const rows = files();
    rows[0]!.pt = 0;
    rows[1]!.rma = 2022;
    const per = Object.fromEntries(preparaRanquings(rows).map((r) => [r.metrica.id, r]));
    expect(per["participacio"]!.files.some((x) => x.valor === 0)).toBe(true);
    expect(per["renda"]!.files).toHaveLength(99);
  });

  it("però un preu de l'aigua a zero no és un preu: queda fora del rànquing", () => {
    const rows = files();
    rows[0]!.pa = 0;
    const aigua = preparaRanquings(rows).find((r) => r.metrica.id === "aigua")!;
    expect(aigua.files).toHaveLength(99);
    expect(aigua.files.some((x) => x.fila.s === "poble-0")).toBe(false);
  });

  it("ordena de més a menys i, en cas d'empat, per nom", () => {
    const rows = files();
    rows[3]!.pt = rows[2]!.pt = 500;
    const participacio = preparaRanquings(rows).find((r) => r.metrica.id === "participacio")!;
    expect(participacio.files.slice(0, 2).map((x) => x.fila.n)).toEqual(["Poble 002", "Poble 003"]);
  });

  it("torna els dos extrems amb tots els empats", () => {
    const rows = files();
    rows[0]!.pt = rows[1]!.pt = -1;
    const participacio = preparaRanquings(rows).find((r) => r.metrica.id === "participacio")!;
    const e = extrems(participacio)!;
    expect(e.alt.files.map((f) => f.s)).toEqual(["poble-99"]);
    expect(e.baix.valor).toBe(-1);
    expect(e.baix.files.map((f) => f.s).sort()).toEqual(["poble-0", "poble-1"]);
  });
});

describe("renderRanquings", () => {
  const html = renderRanquings(files(), "2026-09-01");

  it("obre amb els extrems de cada mètrica i cada targeta porta al seu rànquing", () => {
    expect(html).toContain('<section class="bloc" id="destaquen">');
    expect(html.match(/<li class="extrem">/g)).toHaveLength(7);
    expect(html).toContain('href="#participacio"');
    expect(html).toContain("El més alt");
    expect(html).toContain("El més baix");
  });

  it("escriu els empats sencers i en resumeix la cua a partir de cinc", () => {
    const rows = files();
    for (let i = 0; i < 7; i++) rows[i]!.pt = -1;
    const amb = renderRanquings(rows, "avui");
    expect(amb).toContain("<i>7 empatats:</i>");
    expect(amb).toContain('<a href="#participacio">i 3 més</a>');
  });

  it("escriu cada rànquing amb el període, la font, el mètode, el regle i la cautela", () => {
    expect(html.match(/<section class="bloc ranquing"/g)).toHaveLength(7);
    expect(html).toContain('<p class="micro">2023 · Generalitat de Catalunya · processos electorals</p>');
    expect(html).toContain("Votants sobre el cens a les eleccions municipals del 2023.");
    expect(html).toContain('<figure class="dispersio">');
    expect(html).toContain("La mida del municipi i la competència electoral pesen molt");
    expect(html).not.toContain("<table");
  });

  it("no repeteix la llista: cap top 10 a part, i el servidor només escriu les primeres files", () => {
    expect(html).not.toContain('class="top"');
    const participacio = html.slice(html.indexOf('id="participacio"'), html.indexOf('id="renda"'));
    expect(participacio.match(/<li [^>]*><span class="pos">/g)).toHaveLength(PAS);
    expect(participacio).toContain('<span class="pos">1</span>');
    expect(participacio).toContain("../m/poble-99/");
    expect(participacio).toContain('<a class="comarca" href="../c/comarca/">Comarca</a>');
    // Poble 000 és el darrer de participació: surt al regle com «el més baix»,
    // però no a les primeres files; el JSON amb què el navegador completa la
    // llista sí que el porta.
    const llista = participacio.slice(participacio.indexOf('<ol class="llista-ranquing"'), participacio.indexOf("</ol>"));
    expect(llista).not.toContain("../m/poble-0/");
    expect(html).toContain('<script type="application/json" id="dades-ranquings">');
    expect(html).toContain('"poble-0"');
  });

  it("porta l'àmbit, el cercador i el botó de continuar, i l'àmbit comença per tot Catalunya", () => {
    expect(html).toContain('<select data-ambit><option value="cat">Tot Catalunya</option><option value="t');
    expect(html).toContain("data-cerca");
    expect(html).toContain("data-mes hidden");
    expect(html).toContain("habitants</option>");
  });

  it("és una pàgina de l'Observatori: menú amb els rànquings marcats, cercador i peu", () => {
    expect(html).toContain('<span class="ara" aria-current="page">Rànquings</span>');
    expect(html).toContain('<footer class="peu"');
    expect(html).toContain("Com s'han triat");
  });

  it("cada marca del regle diu de qui és i quant, i la mediana diu que és la mediana", () => {
    const participacio = html.slice(html.indexOf('id="participacio"'), html.indexOf('id="renda"'));
    const regle = participacio.slice(participacio.indexOf('<div class="regle-dispersio"'), participacio.indexOf("</div>"));
    // Cent valors diferents, cent marques, i cadascuna amb el seu municipi.
    expect(regle.match(/<i class="marca"/g)).toHaveLength(100);
    // Cada marca diu la posició al rànquing i com de lluny és de la mediana
    // (49,50 %), als data-extres amb els separadors de grafics.ts (U+2016
    // entre línies, U+00A6 entre etiqueta i valor) i al title= en fila.
    expect(regle).toContain(
      '<i class="marca" style="--p:4.0%" data-nom="Poble 000" data-valor="0,00%" data-extres="posició\u00a6el 100è de 100\u2016respecte a la mediana\u00a6\u221249,50%" title="Poble 000: 0,00% · posició: el 100è de 100 · respecte a la mediana: \u221249,50%"></i>',
    );
    expect(regle).toContain('data-nom="Poble 099" data-valor="99,00%" data-extres="posició\u00a6el 1r de 100\u2016respecte a la mediana\u00a6+49,50%"');
    // La mediana diu de quants és i entre quins extrems.
    expect(regle).toContain(
      '<i class="mig" style="--p:50.0%" data-nom="La mediana" data-valor="49,50%" data-extres="municipis\u00a6100\u2016del més baix al més alt\u00a6de 0,00% a 99,00%" title="La mediana: 49,50% · municipis: 100 · del més baix al més alt: de 0,00% a 99,00%"></i>',
    );
  });

  it("cada fila de la llista porta l'etiqueta amb la comarca, la posició de quants i la distància a la mediana", () => {
    const participacio = html.slice(html.indexOf('id="participacio"'), html.indexOf('id="renda"'));
    expect(participacio).toContain(
      '<li data-nom="Poble 099" data-valor="99,00%" data-extres="comarca\u00a6Comarca\u2016posició de 100\u00a61r\u2016respecte a la mediana\u00a6+49,50%" title="Poble 099: 99,00% · comarca: Comarca · posició de 100: 1r · respecte a la mediana: +49,50%"><span class="pos">1</span>',
    );
    expect(participacio).toContain('data-extres="comarca\u00a6Comarca\u2016posició de 100\u00a640è\u2016respecte a la mediana\u00a6+10,50%"');
  });

  it("dues a la mateixa posició són una marca amb tots els noms, fins a tres i «i N més»", () => {
    const rows = files();
    for (let i = 0; i < 5; i++) rows[i]!.pt = -1;
    // Poble 007 ja val 7: amb aquests dos són tres empatats.
    rows[6]!.pt = rows[5]!.pt = 7;
    const amb = renderRanquings(rows, "avui");
    const participacio = amb.slice(amb.indexOf('id="participacio"'), amb.indexOf('id="renda"'));
    expect(participacio).toContain('data-nom="Poble 000, Poble 001, Poble 002 i 2 més" data-valor="-1,00%"');
    expect(participacio).toContain('data-nom="Poble 005, Poble 006 i Poble 007" data-valor="7,00%"');
    expect(participacio.match(/<i class="marca"/g)).toHaveLength(94);
    // Els cinc empatats són els cinc últims: la posició és un tram.
    expect(participacio).toContain('data-extres="posició\u00a6del 96è al 100è de 100\u2016respecte a la mediana');
    expect(participacio).toContain('data-extres="posició\u00a6del 93è al 95è de 100\u2016respecte a la mediana');
  });

  it("porta el script de l'etiqueta flotant una sola vegada, i el CSS que la pinta", () => {
    expect(html.match(/<script id="grafics-etiqueta">/g)).toHaveLength(1);
    expect(html).toContain(".etiqueta-grafic{");
    // El navegador refà les marques, la mediana i les files amb els mateixos
    // data-* quan canvia l'àmbit, amb els mateixos separadors dels extres.
    expect(html).toContain('e.etq + "\u00a6" + e.valor).join("\u2016")');
    expect(html).toContain('{ etq: "posició", valor: posicio(colla, files.length) }');
    expect(html).toContain('nom: "La mediana"');
    expect(html).toContain('{ etq: "posició de " + fmt(delAmbit.length, 0, ""), valor: ordinal(f.pos) }');
  });

  it("amb massa pocs municipis no publica res i ho diu", () => {
    const buit = renderRanquings(files(10), "avui");
    expect(buit).not.toContain('class="ranquing"');
    expect(buit).toContain("Cap indicador no arriba avui al llindar");
  });
});

describe("les peces de l'etiqueta: ordinal, posició, signe i mediana", () => {
  it("escriu els ordinals com en català: 1r, 2n, 3r, 4t i «è» de cinc en amunt", () => {
    expect([1, 2, 3, 4, 5, 11, 21, 947].map(ordinal)).toEqual(["1r", "2n", "3r", "4t", "5è", "11è", "21è", "947è"]);
  });

  it("diu la posició d'una marca: una sola o un tram, sempre de quants", () => {
    expect(posicioMarca([3], 24)).toBe("el 3r de 24");
    expect(posicioMarca([15, 12, 13], 947)).toBe("del 12è al 15è de 947");
    expect(posicioMarca([1000], 1000)).toBe("el 1.000è de 1.000");
  });

  it("escriu la diferència amb signe, amb el menys de debò, i «igual» quan no es veu", () => {
    const fmt = (v: number): string => `${v.toLocaleString("ca-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
    expect(ambSigne(3.2, fmt)).toBe("+3,20%");
    expect(ambSigne(-12, fmt)).toBe("\u221212,00%");
    expect(ambSigne(0.001, fmt)).toBe("igual");
    expect(respecteMediana([52], 49.5, fmt)).toBe("+2,50%");
    expect(respecteMediana([47, 48], 49.5, fmt)).toBe("de \u22122,50% a \u22121,50%");
  });

  it("la mediana és la del mig, o la mitjana dels dos del mig, vingui en l'ordre que vingui", () => {
    expect(medianaDe([5, 1, 3])).toBe(3);
    expect(medianaDe([4, 1, 3, 2])).toBe(2.5);
  });
});

describe("nomsMarca i valorMarca", () => {
  it("escriu els noms com una frase, per ordre alfabètic i amb la cua resumida", () => {
    expect(nomsMarca(["Vinaixa"])).toBe("Vinaixa");
    expect(nomsMarca(["Vinaixa", "Fulleda"])).toBe("Fulleda i Vinaixa");
    expect(nomsMarca(["Vinaixa", "Fulleda", "Sarroca"])).toBe("Fulleda, Sarroca i Vinaixa");
    expect(nomsMarca(["Vinaixa", "Fulleda", "Sarroca", "Alfés", "Bovera"])).toBe("Alfés, Bovera, Fulleda i 2 més");
  });

  it("dona la xifra si tots els valors són iguals i «de X a Y» si són veïns", () => {
    const fmt = (v: number) => `${v} €`;
    expect(valorMarca([3], fmt)).toBe("3 €");
    expect(valorMarca([3, 3], fmt)).toBe("3 €");
    expect(valorMarca([3.2, 3, 3.1], fmt)).toBe("de 3 € a 3.2 €");
  });
});
