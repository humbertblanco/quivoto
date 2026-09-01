import { describe, expect, it } from "vitest";
import { extrems, PAS, preparaRanquings, renderRanquings, type RankingRow } from "./ranquings";

/**
 * Cent pobles amb totes les mètriques i el mateix any: el cas net. Les
 * poblacions van de 1.000 en amunt perquè `buildPeerGroups` hi trobi més d'un
 * tram i el desplegable d'àmbit tingui alguna cosa a triar.
 */
const files = (quants = 100): RankingRow[] =>
  Array.from({ length: quants }, (_, i) => ({
    s: `poble-${i}`, n: `Poble ${String(i).padStart(3, "0")}`, c: "Comarca", p: 1_000 + i * 600,
    pt: i, f: 20 + i / 2, rm: 10_000 + i, rma: 2023, rs: i, rsa: 2024, pa: i / 10, paa: 2025,
    ibi: 300 + i, ibia: 2025, v: i % 5, q: 12,
  }));

const ids = (rows: RankingRow[]): string[] => preparaRanquings(rows).map((r) => r.metrica.id);

describe("preparaRanquings", () => {
  it("publica només les mètriques amb el 90 % i vint valors del mateix període", () => {
    const rows = files();
    for (let i = 0; i < 11; i++) rows[i]!.rs = null;
    expect(ids(rows)).not.toContain("selectiva");
    expect(ids(rows)).toEqual(["poblacio", "participacio", "dones", "renda", "aigua", "ibi", "alternances"]);
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
    expect(html.match(/<li class="extrem">/g)).toHaveLength(8);
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
    expect(html.match(/<section class="bloc ranquing"/g)).toHaveLength(8);
    expect(html).toContain('<p class="micro">2023 · Generalitat de Catalunya · processos electorals</p>');
    expect(html).toContain("Votants sobre el cens a les eleccions municipals del 2023.");
    expect(html).toContain('<figure class="dispersio">');
    expect(html).toContain("La mida del municipi i la competència electoral pesen molt");
    expect(html).not.toContain("<table");
  });

  it("no repeteix la llista: cap top 10 a part, i el servidor només escriu les primeres files", () => {
    expect(html).not.toContain('class="top"');
    const participacio = html.slice(html.indexOf('id="participacio"'), html.indexOf('id="dones"'));
    expect(participacio.match(/<li><span class="pos">/g)).toHaveLength(PAS);
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

  it("amb massa pocs municipis no publica res i ho diu", () => {
    const buit = renderRanquings(files(10), "avui");
    expect(buit).not.toContain('class="ranquing"');
    expect(buit).toContain("Cap indicador no arriba avui al llindar");
  });
});
