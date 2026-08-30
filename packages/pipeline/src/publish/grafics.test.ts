import { describe, expect, it } from "vitest";
import { anysVisibles, distribucioGrup, marquesEix, serieTemporal, type BandaGrup, type PuntSerie } from "./grafics";

const serie = (parells: readonly [number, number][]): PuntSerie[] =>
  parells.map(([any, valor]) => ({ any, valor }));

const euros = (v: number): string => `${Math.round(v).toLocaleString("ca-ES")} €`;

describe("marquesEix", () => {
  it("dona xifres rodones, no el rang partit en quatre", () => {
    // 0–988 partit en quatre serien 247, 494 i 741, que no els llegeix ningú.
    expect(marquesEix(0, 988)).toEqual([0, 200, 400, 600, 800]);
    expect(marquesEix(0, 100)).toEqual([0, 25, 50, 75, 100]);
    // I amb el pas «el primer més gran que el brut» aquest en donava tres.
    expect(marquesEix(0, 4200)).toEqual([0, 1000, 2000, 3000, 4000]);
    expect(marquesEix(0, 1.08)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });

  it("aguanta un rang que no es mou", () => {
    expect(marquesEix(500, 500)).toEqual([500]);
  });

  it("també va amb valors negatius", () => {
    expect(marquesEix(-40, 40)).toContain(0);
  });
});

describe("anysVisibles", () => {
  it("els escriu tots quan hi caben", () => {
    expect(anysVisibles([2019, 2020, 2021])).toEqual([2019, 2020, 2021]);
  });

  it("amb onze anys en tria uns quants i no perd mai l'últim", () => {
    const anys = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
    const tria = anysVisibles(anys);
    expect(tria[0]).toBe(2015);
    expect(tria[tria.length - 1]).toBe(2025);
    expect(tria.length).toBeLessThanOrEqual(8);
  });
});

describe("serieTemporal", () => {
  const punts = serie([
    [2015, 800], [2016, 760], [2017, 700], [2018, 640],
    [2019, 900], [2020, 1100], [2021, 1050], [2022, 980],
    [2023, 1204], [2024, 1150], [2025, 1100],
  ]);
  const banda: BandaGrup[] = punts.map((p) => ({ any: p.any, p25: 300, p50: 520, p75: 800 }));

  it("no dibuixa una tendència amb un sol punt", () => {
    expect(serieTemporal(serie([[2024, 500]]), { titol: "Deute", format: euros })).toBe("");
    expect(serieTemporal([], { titol: "Deute", format: euros })).toBe("");
  });

  it("posa els anys a la seva distància real, no en columnes iguals", () => {
    // Una sèrie amb un forat de sis anys no pot dibuixar-se com si els dos
    // punts fossin consecutius: és el defecte que tenien les columnes de CSS.
    const html = serieTemporal(serie([[2015, 100], [2016, 110], [2025, 400]]), {
      titol: "Deute per habitant", format: euros,
    });
    const xs = [...html.matchAll(/<circle class="nus" cx="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(xs).toHaveLength(3);
    const primerTram = xs[1]! - xs[0]!;
    const segonTram = xs[2]! - xs[1]!;
    expect(segonTram / primerTram).toBeGreaterThan(8);
  });

  it("dibuixa la banda del grup i la seva mediana amb formes diferents", () => {
    const html = serieTemporal(punts, {
      titol: "Deute per habitant", format: euros, banda, grup: "de més de 50.000 habitants",
    });
    expect(html).toContain('class="banda"');
    expect(html).toContain('class="mediana-grup"');
    expect(html).toContain("la meitat central dels municipis de més de 50.000 habitants");
  });

  it("sense banda no s'inventa cap comparació ni cap llegenda", () => {
    const html = serieTemporal(punts, { titol: "Deute per habitant", format: euros });
    expect(html).not.toContain('class="banda"');
    expect(html).not.toContain("clau-grafic");
  });

  it("l'eix comença a zero quan el zero vol dir alguna cosa", () => {
    const html = serieTemporal(serie([[2023, 1000], [2024, 1020], [2025, 1040]]), {
      titol: "Deute per habitant", format: euros,
    });
    // Amb un eix que comencés a 1.000, una pujada del 4 % sortiria com un
    // precipici. La marca del zero hi ha de ser.
    expect(html).toContain(">0 €</text>");
    expect(html).not.toContain("L'eix no comença a zero");
  });

  it("quan l'eix no comença a zero, ho diu", () => {
    const html = serieTemporal(serie([[2023, -4], [2024, 2], [2025, 6]]), {
      titol: "Estalvi net", format: (v) => `${v} %`, desDeZero: false,
    });
    expect(html).toContain("L'eix no comença a zero");
  });

  it("es pot llegir sense veure-hi: taula de debò, no un title", () => {
    const html = serieTemporal(punts, {
      titol: "Deute per habitant", format: euros, banda, grup: "de més de 50.000 habitants",
    });
    expect(html).toContain('<div class="nomes-lectors"><table>');
    expect(html).toContain("<th scope=\"row\">2015</th>");
    expect(html).toContain("1.204 €");
    expect(html).toContain("<th scope=\"col\">Mediana del grup</th>");
    // I el resum de l'SVG diu d'on a on va, que és el que es llegeix primer.
    expect(html).toContain('aria-label="Deute per habitant: de 800 € el 2015 a 1.100 € el 2025."');
    expect(html).not.toContain("<title>");
  });

  it("marca l'últim punt i els mandats que travessa", () => {
    const html = serieTemporal(punts, {
      titol: "Deute per habitant", format: euros,
      mandats: [
        { desDe: 2015, finsA: 2019, etiqueta: "Ramos" },
        { desDe: 2019, finsA: 2023, etiqueta: "Farrés" },
        { desDe: 2023, finsA: 2027, etiqueta: "Farrés" },
      ],
    });
    expect(html).toContain('class="nus ara"');
    // El primer mandat no porta ratlla: cauria damunt de l'eix vertical.
    expect(html.match(/class="tall-mandat"/g)).toHaveLength(2);
    // I el nom repetit s'escriu una vegada: la segona ratlla hi és igualment.
    expect(html.match(/class="etiqueta-mandat"/g)).toHaveLength(1);
    expect(html).toContain(">Farrés</text>");
  });

  it("escapa el que ve de la base de dades", () => {
    const html = serieTemporal(punts, {
      titol: "Deute", format: euros, banda, grup: 'de <script>alert("x")</script>',
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("distribucioGrup", () => {
  // Un grup atapeït i un de partit en dos amb la mateixa mediana i el mateix
  // percentil: és exactament el cas que el regle d'una sola marca no distingia.
  const atapeit = Array.from({ length: 60 }, (_, i) => 48 + (i % 5));
  const partit = Array.from({ length: 60 }, (_, i) => (i < 30 ? 20 + (i % 3) : 78 + (i % 3)));

  it("no dibuixa una distribució amb quatre valors", () => {
    expect(
      distribucioGrup([10, 20, 30, 40], 20, { format: (v) => `${v} %`, titol: "x", grup: "g", unitat: "" }),
    ).toBe("");
  });

  it("no dibuixa res quan tot el grup val el mateix", () => {
    expect(
      distribucioGrup(new Array(40).fill(50), 50, { format: (v) => `${v} %`, titol: "x", grup: "g", unitat: "" }),
    ).toBe("");
  });

  it("marca la casella del municipi i diu quants en tenen menys", () => {
    const html = distribucioGrup(atapeit, 52, {
      format: (v) => `${v} %`, titol: "Participació", grup: "de més de 50.000 habitants", unitat: "de participació",
    });
    expect(html).toContain('class="casella meva"');
    expect(html.match(/class="casella meva"/g)).toHaveLength(1);
    expect(html).toContain("dels 60 municipis de més de 50.000 habitants");
  });

  it("dos grups amb la mateixa mediana no es dibuixen igual", () => {
    const opcions = { format: (v: number) => `${v} %`, titol: "x", grup: "g", unitat: "" };
    const a = distribucioGrup(atapeit, 50, opcions);
    const b = distribucioGrup(partit, 50, opcions);
    const caselles = (html: string): number[] =>
      [...html.matchAll(/class="casella[^"]*"[^>]*height="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(caselles(a)).not.toEqual(caselles(b));
  });

  it("el municipi de fora del rang no se surt del dibuix", () => {
    const html = distribucioGrup(atapeit, 0, { format: (v) => `${v} %`, titol: "x", grup: "g", unitat: "" });
    const xs = [...html.matchAll(/class="fletxa-aqui" d="M([\d.-]+)/g)].map((m) => Number(m[1]));
    expect(xs[0]).toBeGreaterThanOrEqual(0);
    expect(xs[0]).toBeLessThanOrEqual(720);
  });

  it("es pot llegir sense veure-hi", () => {
    const html = distribucioGrup(atapeit, 52, {
      format: (v) => `${v} %`, titol: "Participació", grup: "de més de 50.000 habitants", unitat: "",
    });
    expect(html).toMatch(/aria-label="Participació: 52 %\. \d+ dels 60 municipis/);
    expect(html).toContain("la mediana del grup és");
  });
});
