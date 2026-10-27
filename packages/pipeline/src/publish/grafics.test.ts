import { describe, expect, it } from "vitest";
import {
  ambSigne,
  anysVisibles,
  atributsEtiqueta,
  canviEscrit,
  percentRelatiu,
  GRAFICS_CSS,
  GRAFICS_JS,
  textEtiqueta,
  barresDivergents,
  distribucioGrup,
  escalaDivergent,
  marquesEix,
  pendent,
  eixDispersio,
  etiquetaTall,
  posicioEscala,
  regleDispersio,
  serieTemporal,
  tallsEscala,
  type BandaGrup,
  type FilaDivergent,
  type PuntSerie,
} from "./grafics";

const serie = (parells: readonly [number, number][]): PuntSerie[] =>
  parells.map(([any, valor]) => ({ any, valor }));

const euros = (v: number): string => `${Math.round(v).toLocaleString("ca-ES")} €`;

/**
 * De les sèries grans i mitjanes en surten dos dibuixos —l'ample i el de sota
 * 480 px— i el CSS n'ensenya un. Comptar elements sobre l'HTML sencer els
 * comptaria dos cops, i el que es vol saber és què hi ha a cada dibuix.
 */
const svgs = (html: string): string[] => html.match(/<svg[\s\S]*?<\/svg>/g) ?? [];
const ample = (html: string): string => svgs(html)[0] ?? "";
const estret = (html: string): string => svgs(html)[1] ?? "";
const quants = (text: string, patro: RegExp): number => (text.match(patro) ?? []).length;

/**
 * Cap dibuix no pot sortir del seu quadre.
 *
 * Un cercle amb el radi a la vora o una fletxa amb l'ala a −1 no peten res:
 * simplement es veuen escapçats, i només al navegador d'algú altre. Aquí es
 * caminen totes les formes de tots els SVG i es comprova que hi caben. Del
 * text només se'n mira l'ancoratge, que és l'únic que se sap sense una font
 * carregada.
 */
const foraDelQuadre = (html: string): string[] => {
  const problemes: string[] = [];
  for (const svg of svgs(html)) {
    const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
    if (!vb) {
      problemes.push("un SVG sense viewBox");
      continue;
    }
    const w = Number(vb[1]);
    const h = Number(vb[2]);
    const mira = (x: number, y: number, que: string): void => {
      if (!(x >= -0.01 && x <= w + 0.01 && y >= -0.01 && y <= h + 0.01)) {
        problemes.push(`${que} a ${x},${y} fora de ${w}×${h}`);
      }
    };
    const xifres = (tag: string, atribut: string): number => {
      const m = new RegExp(`${atribut}="([-\\d.]+)"`).exec(tag);
      return m ? Number(m[1]) : 0;
    };
    for (const [tag] of svg.matchAll(/<circle[^>]*>/g)) {
      const cx = xifres(tag, "cx");
      const cy = xifres(tag, "cy");
      const r = xifres(tag, "r");
      mira(cx - r, cy - r, "un cercle");
      mira(cx + r, cy + r, "un cercle");
    }
    for (const [tag] of svg.matchAll(/<line[^>]*>/g)) {
      mira(xifres(tag, "x1"), xifres(tag, "y1"), "una línia");
      mira(xifres(tag, "x2"), xifres(tag, "y2"), "una línia");
    }
    for (const [tag] of svg.matchAll(/<rect[^>]*>/g)) {
      mira(xifres(tag, "x"), xifres(tag, "y"), "una barra");
      mira(xifres(tag, "x") + xifres(tag, "width"), xifres(tag, "y") + xifres(tag, "height"), "una barra");
    }
    for (const [tag] of svg.matchAll(/<text[^>]*>/g)) {
      mira(xifres(tag, "x"), xifres(tag, "y"), "un text");
    }
    for (const traç of svg.matchAll(/ d="([^"]+)"/g)) {
      let cx = 0;
      let cy = 0;
      for (const ordres of (traç[1] ?? "").matchAll(/([A-Za-z])([^A-Za-z]*)/g)) {
        const ordre = ordres[1];
        const nums = (ordres[2] ?? "")
          .trim()
          .split(/[\s,]+/)
          .filter((t) => t !== "")
          .map(Number);
        if (ordre === "M" || ordre === "L") {
          for (let i = 0; i + 1 < nums.length; i += 2) {
            cx = nums[i]!;
            cy = nums[i + 1]!;
            mira(cx, cy, "un traç");
          }
        } else if (ordre === "l") {
          for (let i = 0; i + 1 < nums.length; i += 2) {
            cx += nums[i]!;
            cy += nums[i + 1]!;
            mira(cx, cy, "un traç");
          }
        } else if (ordre === "h") {
          for (const v of nums) {
            cx += v;
            mira(cx, cy, "un traç");
          }
        } else if (ordre === "v") {
          for (const v of nums) {
            cy += v;
            mira(cx, cy, "un traç");
          }
        }
      }
    }
  }
  return problemes;
};

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

  it("amb tres divisions en dona menys, que és el que demana una pantalla estreta", () => {
    expect(marquesEix(0, 1300, 3).length).toBeLessThan(marquesEix(0, 1300, 4).length);
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

  it("amb un màxim de quatre en surten quatre, i el darrer hi és", () => {
    const anys = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
    const tria = anysVisibles(anys, 4);
    expect(tria.length).toBeLessThanOrEqual(4);
    expect(tria[tria.length - 1]).toBe(2025);
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
    const xs = [...ample(html).matchAll(/<circle class="nus" cx="([\d.]+)"/g)].map((m) => Number(m[1]));
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
    // El <title> de cada punt hi és, però és el rètol del ratolí per a qui no
    // té script, no l'equivalent en text: aquest és la taula, i no depèn d'ell.
    expect(html.replace(/<title>[^<]*<\/title>/g, "")).toContain("<th scope=\"row\">2015</th>");
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
    expect(quants(ample(html), /class="tall-mandat"/g)).toBe(2);
    // I el nom repetit s'escriu una vegada: la segona ratlla hi és igualment.
    expect(quants(ample(html), /class="etiqueta-mandat"/g)).toBe(1);
    expect(html).toContain(">Farrés</text>");
  });

  it("escapa el que ve de la base de dades", () => {
    const html = serieTemporal(punts, {
      titol: "Deute", format: euros, banda, grup: 'de <script>alert("x")</script>',
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  describe("les tres mides", () => {
    it("la gran és la de sempre: 720×300, banda, mandats i llegenda", () => {
      const html = serieTemporal(punts, {
        titol: "Deute per habitant", format: euros, banda, grup: "de més de 50.000 habitants",
      });
      expect(ample(html)).toContain('viewBox="0 0 720 300"');
      expect(html).toContain("clau-grafic");
      expect(html).toContain('class="grafic serie serie-gran"');
    });

    it("la mitjana fa 180 d'alt, escriu menys anys i no repeteix la llegenda", () => {
      const gran = serieTemporal(punts, {
        titol: "Deute per habitant", format: euros, banda, grup: "de més de 50.000 habitants",
      });
      const html = serieTemporal(punts, {
        titol: "Deute per habitant", format: euros, banda, grup: "de més de 50.000 habitants",
        mida: "mitjana",
      });
      expect(ample(html)).toContain('viewBox="0 0 720 180"');
      // La banda hi és —és la comparació, no un adorn— i la llegenda no: en una
      // pàgina amb sis gràfiques mitjanes, sis vegades la mateixa clau és soroll.
      expect(html).toContain('class="banda"');
      expect(html).not.toContain("clau-grafic");
      const anysEscrits = (svg: string): number => quants(svg, /text-anchor="middle">20\d\d</g);
      expect(anysEscrits(ample(html))).toBeLessThanOrEqual(5);
      expect(anysEscrits(ample(html))).toBeLessThan(anysEscrits(ample(gran)));
      expect(quants(ample(html), /class="graella"/g)).toBeLessThan(quants(ample(gran), /class="graella"/g));
    });

    it("l'espurna és només la forma: ni eix, ni xifres, ni segona versió", () => {
      const html = serieTemporal(punts, { titol: "Deute per habitant", format: euros, banda, mida: "espurna" });
      expect(svgs(html)).toHaveLength(1);
      expect(html).toContain('viewBox="0 0 118 34"');
      expect(html).not.toContain('class="graella"');
      expect(html).not.toContain('class="eix"');
      expect(html).not.toContain('class="etiqueta-eix"');
      // Sense eix no hi ha cap zero per ensenyar, i per tant tampoc cap avís
      // sobre el zero: l'escala de l'espurna és la de la pròpia sèrie.
      expect(html).not.toContain("L'eix no comença a zero");
      // La banda del grup no hi cap: a 118 unitats taparia la línia.
      expect(html).not.toContain('class="banda"');
      // Però la dada sencera hi continua sent, que és la regla 1.
      expect(html).toContain('<div class="nomes-lectors"><table>');
      expect(html).toContain("1.204 €");
    });

    it("cada mida marca l'any d'ara", () => {
      for (const mida of ["gran", "mitjana", "espurna"] as const) {
        expect(serieTemporal(punts, { titol: "Deute", format: euros, mida })).toContain('class="nus ara"');
      }
    });
  });

  describe("sota 480 px", () => {
    const html = serieTemporal(punts, {
      titol: "Deute per habitant", format: euros, banda, grup: "de més de 50.000 habitants",
      mandats: [
        { desDe: 2015, finsA: 2019, etiqueta: "Ramos" },
        { desDe: 2019, finsA: 2023, etiqueta: "Farrés" },
        { desDe: 2023, finsA: 2027, etiqueta: "Bustos" },
      ],
    });

    it("en surt un segon dibuix, i el CSS només n'ensenya un", () => {
      expect(svgs(html)).toHaveLength(2);
      expect(ample(html)).toContain('class="dibuix ample"');
      expect(estret(html)).toContain('class="dibuix estret"');
      // I el full ha de portar l'intercanvi: dos dibuixos visibles alhora són
      // el mateix gràfic dues vegades, un damunt de l'altre.
      expect(GRAFICS_CSS).toContain(".grafic .estret{display:none}");
      expect(GRAFICS_CSS).toContain(".grafic .ample{display:none}");
    });

    it("el marge esquerre baixa de 62 a 40 i el dibuix guanya amplada", () => {
      expect(ample(html)).toContain('class="graella" x1="62"');
      expect(estret(html)).toContain('class="graella" x1="40"');
      const primerNus = (svg: string): number =>
        Number(/<circle class="nus" cx="([\d.]+)"/.exec(svg)?.[1] ?? "0");
      expect(primerNus(estret(html))).toBeLessThan(primerNus(ample(html)));
    });

    it("hi ha menys marques, menys anys escrits i un sol cognom", () => {
      expect(quants(estret(html), /class="graella"/g)).toBeLessThan(quants(ample(html), /class="graella"/g));
      expect(quants(estret(html), /text-anchor="middle">20\d\d</g)).toBeLessThanOrEqual(4);
      // Les ratlles de mandat hi són totes —marquen on comença cadascun— i el
      // cognom només al primer canvi: dos noms de nou lletres a 375 px se
      // sobreescriuen l'un damunt de l'altre.
      expect(quants(estret(html), /class="tall-mandat"/g)).toBe(quants(ample(html), /class="tall-mandat"/g));
      expect(quants(ample(html), /class="etiqueta-mandat"/g)).toBe(2);
      expect(quants(estret(html), /class="etiqueta-mandat"/g)).toBe(1);
      expect(estret(html)).toContain(">Farrés</text>");
      expect(estret(html)).not.toContain(">Bustos</text>");
    });

    it("les xifres de l'eix van damunt de la ratlla, que al marge de 40 no hi caben", () => {
      expect(ample(html)).toContain('class="etiqueta-eix" x="54"');
      expect(estret(html)).toContain('class="etiqueta-eix" x="0"');
    });

    it("l'espurna no en fa cap segona versió: no hi ha res a retallar", () => {
      const petita = serieTemporal(punts, { titol: "Deute", format: euros, mida: "espurna" });
      expect(petita).not.toContain('class="dibuix estret"');
    });
  });

  describe("els anys que la font no dona", () => {
    const amb = serieTemporal(serie([[2019, 500], [2020, 520], [2022, 600], [2023, 610]]), {
      titol: "Deute per habitant",
      format: euros,
      anysEsperats: [2019, 2020, 2021, 2022, 2023],
    });

    it("pinta el forat en comptes de saltar-se'l", () => {
      expect(quants(ample(amb), /class="forat"/g)).toBe(1);
      expect(quants(ample(amb), /class="buit"/g)).toBe(1);
    });

    it("no passa cap línia per damunt d'un any que no existeix", () => {
      // La línia es parteix: dues ordres «M» vol dir dos trams, i entremig no
      // hi ha cap traç que digui res del 2021.
      const d = /<path class="linia" d="([^"]+)"/.exec(ample(amb))?.[1] ?? "";
      expect(quants(d, /M/g)).toBe(2);
    });

    it("el forat també és a la taula i al text alternatiu", () => {
      expect(amb).toContain('<th scope="row">2021</th><td>sense dada</td>');
      expect(amb).toContain("De l'any 2021 no en consta cap xifra.");
      expect(amb).toContain("l'any que la font no publica");
    });

    it("un any esperat abans del primer que hi ha estira l'eix fins allà", () => {
      // Si la font havia de donar el 2017 i comença el 2019, els dos anys que
      // falten són part de la història: la línia no pot començar a la vora
      // esquerra com si la sèrie comencés allà.
      const html = serieTemporal(serie([[2019, 500], [2020, 520]]), {
        titol: "Deute", format: euros, anysEsperats: [2017, 2018, 2019, 2020],
      });
      expect(quants(ample(html), /class="forat"/g)).toBe(2);
      expect(html).toContain('<th scope="row">2017</th><td>sense dada</td>');
      const primerNus = Number(/<circle class="nus" cx="([\d.]+)"/.exec(ample(html))?.[1] ?? "0");
      expect(primerNus).toBeGreaterThan(300);
    });

    it("sense llista d'anys esperats no s'inventa cap forat", () => {
      const html = serieTemporal(serie([[2019, 500], [2022, 600]]), { titol: "Deute", format: euros });
      expect(html).not.toContain('class="forat"');
      expect(html).not.toContain("sense dada");
    });
  });

  it("cap dibuix no surt del seu quadre, a cap mida", () => {
    for (const mida of ["gran", "mitjana", "espurna"] as const) {
      const html = serieTemporal(punts, {
        titol: "Deute per habitant", format: euros, banda, grup: "de més de 50.000 habitants", mida,
        anysEsperats: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
        mandats: [
          { desDe: 2019, finsA: 2023, etiqueta: "Farrés" },
          { desDe: 2026, finsA: 2027, etiqueta: "Un cognom llarguíssim" },
        ],
      });
      expect(foraDelQuadre(html)).toEqual([]);
    }
  });
});

describe("pendent", () => {
  const salt = {
    titol: "Deute per habitant",
    format: euros,
    anys: { inici: 2015, final: 2025 },
    municipi: { inici: 800, final: 1204 },
    grup: { inici: 500, final: 560 },
    nomGrup: "de més de 50.000 habitants",
  };

  it("dibuixa el salt: cercle buit d'on venia, coral on és ara", () => {
    const html = pendent(salt);
    expect(html).toContain('viewBox="0 0 300 56"');
    expect(html).toContain('class="cap-inici"');
    expect(html).toContain('class="cap-final"');
    expect(html).toContain('class="salt"');
    const xi = Number(/<circle class="cap-inici" cx="([\d.]+)"/.exec(html)?.[1] ?? "0");
    const xf = Number(/<circle class="cap-final" cx="([\d.]+)"/.exec(html)?.[1] ?? "0");
    expect(xf).toBeGreaterThan(xi);
  });

  it("el grup va a sota, amb una traça que es distingeix per la forma", () => {
    const html = pendent(salt);
    expect(html).toContain('class="salt-grup"');
    const y = (patro: RegExp): number => Number(patro.exec(html)?.[1] ?? "0");
    expect(y(/<line class="salt"[^>]*y1="([\d.]+)"/)).toBeLessThan(y(/<line class="salt-grup"[^>]*y1="([\d.]+)"/));
  });

  it("sense grup no s'inventa cap comparació", () => {
    const html = pendent({ ...salt, grup: null, nomGrup: null });
    expect(html).not.toContain("salt-grup");
    expect(html).not.toContain("El seu grup");
  });

  it("amb una sola escala, dues files es poden comparar", () => {
    // És tot el sentit de la forma: si cada fila es fes la seva escala, un salt
    // de 100 a 200 i un de 200 a 400 es dibuixarien exactament igual, i el
    // segon és el doble de llarg.
    const escala = { min: 0, max: 400 };
    const a = pendent({ ...salt, grup: null, municipi: { inici: 100, final: 200 }, escala });
    const b = pendent({ ...salt, grup: null, municipi: { inici: 200, final: 400 }, escala });
    const cap = (html: string, quin: string): number =>
      Number(new RegExp(`<circle class="cap-${quin}" cx="([\\d.]+)"`).exec(html)?.[1] ?? "0");
    // On acaba el primer és on comença el segon, perquè el valor és el mateix.
    expect(cap(a, "final")).toBeCloseTo(cap(b, "inici"), 5);
    expect(cap(b, "final") - cap(b, "inici")).toBeCloseTo(2 * (cap(a, "final") - cap(a, "inici")), 5);
  });

  it("un valor fora de l'escala es queda a la vora i no fora del quadre", () => {
    const html = pendent({ ...salt, municipi: { inici: 800, final: 99999 }, escala: { min: 0, max: 1000 } });
    expect(foraDelQuadre(html)).toEqual([]);
    // I la xifra de debò continua sent a la taula, que és la que mana.
    expect(html).toContain("99.999 €");
  });

  it("amb un salt curt només escriu la xifra d'ara", () => {
    const llarg = pendent({ ...salt, municipi: { inici: 100, final: 1200 }, escala: { min: 0, max: 1200 } });
    const curt = pendent({ ...salt, municipi: { inici: 600, final: 620 }, escala: { min: 0, max: 1200 } });
    expect(quants(llarg, /class="xifra/g)).toBe(2);
    expect(quants(curt, /class="xifra/g)).toBe(1);
    expect(curt).toContain("620 €");
  });

  it("es pot llegir sense veure-hi, i la taula va dins del div que amaga", () => {
    const html = pendent({ ...salt, etiqueta: "Sabadell" });
    expect(html).toContain('<div class="nomes-lectors"><table>');
    expect(html).toContain('<th scope="row">2015</th><td>800 €</td>');
    expect(html).toContain('<th scope="row">2025</th><td>1.204 €</td>');
    expect(html).toContain("<th scope=\"col\">de més de 50.000 habitants</th>");
    expect(html).toContain(
      'aria-label="Sabadell, Deute per habitant: de 800 € el 2015 a 1.204 € el 2025.',
    );
    // El <title> de cada cap és el rètol del ratolí per a qui no té script;
    // l'equivalent en text és la taula, i hi és sense ell.
    expect(html.replace(/<title>[^<]*<\/title>/g, "")).toContain('<th scope="row">2015</th><td>800 €</td>');
  });

  it("escapa el que ve de la base de dades", () => {
    const html = pendent({ ...salt, etiqueta: '<script>alert("x")</script>' });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("no dibuixa res amb una xifra que no és una xifra", () => {
    expect(pendent({ ...salt, municipi: { inici: 800, final: Number.NaN } })).toBe("");
    expect(pendent({ ...salt, grup: { inici: 500, final: Number.POSITIVE_INFINITY } })).toBe("");
  });

  it("una fila que no s'ha mogut es dibuixa quieta, no plana", () => {
    const html = pendent({ ...salt, grup: null, municipi: { inici: 700, final: 700 } });
    const xi = Number(/<circle class="cap-inici" cx="([\d.]+)"/.exec(html)?.[1] ?? "0");
    const xf = Number(/<circle class="cap-final" cx="([\d.]+)"/.exec(html)?.[1] ?? "0");
    expect(xi).toBe(xf);
    expect(foraDelQuadre(html)).toEqual([]);
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
    // I l'ala de la fletxa tampoc: amb la punta a 4, la de l'esquerra queia a −1.
    expect(foraDelQuadre(html)).toEqual([]);
  });

  it("es pot llegir sense veure-hi", () => {
    const html = distribucioGrup(atapeit, 52, {
      format: (v) => `${v} %`, titol: "Participació", grup: "de més de 50.000 habitants", unitat: "",
    });
    expect(html).toMatch(/aria-label="Participació: 52 %\. \d+ dels 60 municipis/);
    expect(html).toContain("la mediana del grup és");
  });
});

describe("barresDivergents", () => {
  const files: FilaDivergent[] = [
    { etiqueta: "Escombraries i residus", valor: 13.7, grup: 8.1, enllac: "#escombraries" },
    { etiqueta: "Habitatge", valor: 5.2, grup: 0.9 },
    { etiqueta: "Aigua potable", valor: 0, grup: 0.4 },
    { etiqueta: "Pagar el deute", valor: -20, grup: -3.5 },
  ];
  const opcions = {
    titol: "Canvi de la despesa per habitant",
    format: (v: number) => v.toFixed(1).replace(".", ","),
    unitat: "€/hab",
    nomGrup: "de més de 50.000 habitants",
  };

  it("no dibuixa res sense files", () => {
    expect(barresDivergents([], opcions)).toBe("");
  });

  it("l'escala és el valor absolut més gran, grup inclòs, i el zero és al mig", () => {
    // El màxim absolut és −20: la fila de −20 omple la meitat esquerra
    // sencera (50 %) i la de +13,7 en fa 34,25 a la dreta.
    expect(escalaDivergent(files)).toBe(20);
    const html = barresDivergents(files, opcions);
    expect(html).toContain('class="negatiu"');
    expect(html).toContain("--w:50%");
    expect(html).toContain("--w:34.25%");
    // La marca del grup es col·loca a 50 + 50·g/escala: +8,1 sobre 20 és 70,25.
    expect(html).toContain("--m:70.25%");
    // I −3,5 sobre 20 cau a l'esquerra del zero: 41,25.
    expect(html).toContain("--m:41.25%");
  });

  it("un canvi de zero no dibuixa cap barra i s'escriu sense signe", () => {
    const html = barresDivergents(files, opcions);
    const zero = html.slice(html.indexOf('class="zero"'), html.indexOf("</li>", html.indexOf('class="zero"')));
    expect(zero).toContain("--w:0%");
    expect(zero).toContain("0,0 €/hab");
    expect(zero).not.toContain("+0,0");
    expect(zero).not.toContain("−0,0");
  });

  it("amb una escala compartida, dues llistes es dibuixen igual", () => {
    // Les vuit files més grans a la vista i la resta plegades: si cadascuna
    // es fes la seva escala, la fila de +5,2 de la segona llista sortiria
    // tan llarga com la de +13,7 de la primera.
    const escala = escalaDivergent(files);
    const primera = barresDivergents(files.slice(0, 2), { ...opcions, escala });
    const segona = barresDivergents(files.slice(2), { ...opcions, escala });
    expect(primera).toContain("--w:34.25%"); // 13,7 / 20
    expect(primera).toContain("--w:13%"); // 5,2 / 20
    expect(segona).toContain("--w:50%"); // 20 / 20
    // Sense l'escala, la segona llista faria el seu propi màxim.
    expect(barresDivergents(files.slice(0, 2), opcions)).toContain("--w:50%"); // 13,7 / 13,7
  });

  it("la xifra va sempre escrita al costat, amb el signe i la unitat", () => {
    const html = barresDivergents(files, opcions);
    // La xifra i el «seus» comparteixen cel·la: cada fila és una sola fila de
    // graella i totes les xifres queden alineades a la mateixa columna.
    expect(html).toContain('<span class="xifres"><b class="xifra">');
    expect(html).toContain("+13,7 €/hab");
    expect(html).toContain("−20,0 €/hab");
    expect(html).toContain("seus +8,1 €/hab");
    expect(html).toContain("seus −3,5 €/hab");
  });

  it("es pot llegir sense veure-hi: la taula va dins del div que amaga, amb els enllaços", () => {
    const html = barresDivergents(files, opcions);
    expect(html).toContain('<ul class="barres-divergents" aria-hidden="true">');
    expect(html).toContain('<div class="nomes-lectors"><table>');
    expect(html).toContain("<caption>Canvi de la despesa per habitant, amb el mateix canvi als municipis de més de 50.000 habitants</caption>");
    expect(html).toContain("<th scope=\"col\">Municipis de més de 50.000 habitants</th>");
    expect(html).toContain('<th scope="row"><a href="#escombraries">Escombraries i residus</a></th>');
    // Al dibuix l'enllaç hi és però no rep el focus: el que el rep és el de
    // la taula, que és el que pot llegir qui hi arriba amb teclat.
    expect(html).toContain('<a href="#escombraries" tabindex="-1">Escombraries i residus</a>');
    expect(html.match(/<td>/g)?.length).toBe(files.length * 2);
  });

  it("sense cap grup no s'inventa cap comparació", () => {
    const html = barresDivergents(
      files.map((f) => ({ ...f, grup: null })),
      { ...opcions, nomGrup: null },
    );
    expect(html).not.toContain("marca-grup");
    expect(html).not.toContain("seus ");
    expect(html).not.toContain("El seu grup");
    expect(html).not.toContain("mostra-tick");
  });

  it("escapa el que ve de la base de dades", () => {
    const html = barresDivergents([{ etiqueta: "Parcs <i> & jardins", valor: 1, grup: null }], opcions);
    expect(html).toContain("Parcs &lt;i&gt; &amp; jardins");
    expect(html).not.toContain("<i> &");
  });

  it("el CSS porta la regla del zero, de la barra i de la marca del grup", () => {
    expect(GRAFICS_CSS).toContain(".barres-divergents .zero .barra{display:none}");
    expect(GRAFICS_CSS).toContain(".barres-divergents .positiu .barra{left:50%}");
    expect(GRAFICS_CSS).toContain(".barres-divergents .negatiu .barra{right:50%}");
    // La marca del grup viu dins del canal, centrada, no muntada per sobre.
    expect(GRAFICS_CSS).toContain(".barres-divergents .marca-grup{position:absolute;top:2px;bottom:2px;left:var(--m)");
  });

  it("totes les files comparteixen una sola graella: cap canal d'una llargada diferent", () => {
    // Amb una graella per <li>, la columna de l'etiqueta s'amidava fila a fila
    // i el zero feia esses; amb els <li> com a «display:contents» totes les
    // files són a les mateixes tres columnes i el zero és una vertical recta.
    expect(GRAFICS_CSS).toContain(".barres-divergents li{display:contents}");
    expect(GRAFICS_CSS).toContain(".barres-divergents{list-style:none;margin:0;padding:0;display:grid;");
    expect(GRAFICS_CSS).toContain("@media (max-width:760px)");
  });
});

describe("regleDispersio", () => {
  const municipis = [
    { valor: 11_000, nom: "Poble 0", slug: "poble-0" },
    { valor: 14_000, nom: "Poble 1", slug: "poble-1" },
    { valor: 16_000, nom: "Poble 2", slug: "poble-2" },
    { valor: 24_000, nom: "Poble 3", slug: "poble-3" },
  ];
  const opcions = { format: euros, base: "../../", quants: "4 de 6 municipis amb dada" };

  it("no dibuixa una dispersió amb tres xifres ni quan totes són iguals", () => {
    expect(regleDispersio("Renda", municipis.slice(0, 3), opcions)).toBe("");
    expect(regleDispersio("Renda", municipis.map((m) => ({ ...m, valor: 9 })), opcions)).toBe("");
  });

  it("una marca per municipi, com a enllaç a la seva fitxa, del 4 % al 96 %", () => {
    const html = regleDispersio("Renda neta per persona", municipis, opcions);
    expect(html).toContain('class="marca" style="--p:4.00%" href="../../m/poble-0/"');
    expect(html).toContain("--p:96.00%");
    // La dada sencera hi és per a qui llegeix amb veu: qui i quant.
    expect(html).toContain("Poble 0, 11.000 €");
  });

  it("el més baix, la mediana i el més alt van sempre escrits a sota", () => {
    const html = regleDispersio("Renda neta per persona", municipis, opcions);
    expect(html).toContain("El més baix");
    expect(html).toContain("El més alt");
    // La mediana de quatre valors és la mitjana dels dos del mig: 15.000.
    expect(html).toContain("15.000 €");
    expect(html).toContain("4 de 6 municipis amb dada");
  });

  it("sense slug la marca no és cap enllaç: la fitxa no sap de qui és cada valor", () => {
    const punts = municipis.map(({ valor }) => ({ valor, nom: "" }));
    const html = regleDispersio("Participació", punts, { format: euros });
    expect(html).not.toContain("<a");
    expect(html).toContain('<i class="marca"');
  });

  it("la marca d'«aquest» es pinta a part i la mediana li cedeix el coral", () => {
    const punts = [
      { valor: 11_000, nom: "" },
      { valor: 14_000, nom: "" },
      { valor: 16_000, nom: "aquest municipi", aquest: true },
      { valor: 24_000, nom: "" },
    ];
    const html = regleDispersio("Participació", punts, { format: euros });
    expect(html).toContain('class="marca aquest"');
    expect(html).toContain('class="regle-dispersio amb-aquest"');
    // El coral és del «tu ets aquí»: la mediana passa a paper per no competir.
    expect(GRAFICS_CSS).toContain(".dispersio .amb-aquest .mig{background:var(--paper-2)}");
  });

  it("escapa el que ve de la base de dades", () => {
    const bruts = municipis.map((m, i) => (i === 0 ? { ...m, nom: '<script>alert("x")</script>' } : m));
    const html = regleDispersio("Renda", bruts, opcions);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("l'etiqueta de cada punt: la dada a l'abast del ratolí, del dit i del teclat", () => {
  const punts = serie([[2019, 500], [2020, 600], [2021, 420], [2022, 700]]);
  const banda: BandaGrup[] = punts.map((p) => ({ any: p.any, p25: 300, p50: 512, p75: 800 }));

  it("compon la frase en un sol ordre, que és el mateix que el del script", () => {
    expect(textEtiqueta({ nom: "Deute per habitant", any: 2021, valor: "420 €", mediana: "512 €" })).toBe(
      "Deute per habitant: 2021 · 420 € · mediana dels seus: 512 €",
    );
    expect(textEtiqueta({ nom: "Seguretat", valor: "+13,7 €/hab", grup: "+8,1 €/hab" })).toBe(
      "Seguretat: +13,7 €/hab · els seus: +8,1 €/hab",
    );
    expect(textEtiqueta({ valor: "1.204 €" })).toBe("1.204 €");
    expect(atributsEtiqueta({ nom: 'A "cometes"', any: 2021, valor: "420 €" })).toBe(
      ' data-nom="A &quot;cometes&quot;" data-any="2021" data-valor="420 €"',
    );
  });

  it("cada any de la sèrie porta els data-*, el <title> amb la mateixa frase i es pot tocar i tabular", () => {
    const html = serieTemporal(punts, { titol: "Deute per habitant", format: euros, banda, grup: "de més de 50.000 habitants" });
    const dibuix = ample(html);
    const grups = [...dibuix.matchAll(/<g class="punt"[^>]*>/g)].map((m) => m[0]);
    expect(grups).toHaveLength(4);
    expect(dibuix).toContain(
      '<g class="punt" tabindex="0" data-nom="Deute per habitant" data-any="2021" data-valor="420 €" data-mediana="512 €"' +
        ' data-extres="banda dels seus¦de 300 € a 800 €‖respecte a la mediana¦−92 € · −18 %‖respecte al 2020¦−180 € · −30 %">' +
        "<title>Deute per habitant: 2021 · 420 € · mediana dels seus: 512 € · banda dels seus: de 300 € a 800 €" +
        " · respecte a la mediana: −92 € · −18 % · respecte al 2020: −180 € · −30 %</title>",
    );
    // La banda de tacte és tan alta com el dibuix i més ampla que el cercle.
    for (const g of grups) expect(g).toContain('tabindex="0"');
    expect(quants(dibuix, /<rect class="toc"/g)).toBe(4);
    const banda1 = /<rect class="toc" x="[\d.]+" y="18" width="([\d.]+)" height="([\d.]+)"/.exec(dibuix);
    expect(Number(banda1?.[1])).toBeGreaterThan(16);
    expect(Number(banda1?.[2])).toBe(300 - 18 - 46);
    // El punt d'ara viu dins del grup del seu any, no per damunt de tots.
    expect(dibuix).toMatch(/data-any="2022"[^>]*>.*?<circle class="nus ara"[^>]*><\/g>/s);
    expect(quants(dibuix, /class="nus ara"/g)).toBe(1);
  });

  it("sense banda no hi ha mediana a l'etiqueta, i l'espurna només etiqueta el punt d'ara", () => {
    const sense = serieTemporal(punts, { titol: "Deute", format: euros });
    expect(sense).not.toContain("data-mediana");
    expect(sense).not.toContain("banda dels seus");
    expect(sense).toContain("<title>Deute: 2021 · 420 € · respecte al 2020: −180 € · −30 %</title>");
    // El primer any no té cap any anterior amb què comparar-se, i no s'inventa.
    expect(sense).toContain('data-any="2019" data-valor="500 €"><title>Deute: 2019 · 500 €</title>');
    const espurna = serieTemporal(punts, { titol: "Deute", format: euros, mida: "espurna" });
    expect(quants(espurna, /<g class="punt"/g)).toBe(1);
    expect(espurna).toContain('data-any="2022"');
  });

  it("les barres divergents porten la dada al canal, amb el canvi dels seus, i sense tabindex", () => {
    const files: FilaDivergent[] = [{ etiqueta: "Seguretat", valor: 13.7, grup: 8.1 }];
    const html = barresDivergents(files, { titol: "Canvi", format: (v) => v.toFixed(1).replace(".", ","), unitat: "€/hab" });
    expect(html).toContain(
      '<span class="canal" data-nom="Seguretat" data-valor="+13,7 €/hab" data-grup="+8,1 €/hab"' +
        ' data-extres="respecte als seus¦+5,6 €/hab" title="Seguretat: +13,7 €/hab · els seus: +8,1 €/hab · respecte als seus: +5,6 €/hab">',
    );
    expect(html).not.toContain('tabindex="0"');
  });

  it("cada marca del regle diu de qui és i quant; només l'enllaç i «aquest» reben el focus", () => {
    const valors = [
      { valor: 100, nom: "Poble A", slug: "poble-a" },
      { valor: 200, nom: "", aquest: true },
      { valor: 300, nom: "" },
      { valor: 400, nom: "Poble D", slug: "poble-d" },
    ];
    const html = regleDispersio("Deute", valors, { format: euros });
    expect(html).toContain(
      'href="../../m/poble-a/" data-nom="Poble A" data-valor="100 €"' +
        ' data-extres="posició¦1r més baix de 4‖respecte a la mediana¦−150 € · −60 %"' +
        ' title="Poble A: 100 € · posició: 1r més baix de 4 · respecte a la mediana: −150 € · −60 %"',
    );
    expect(html).toContain('<i class="marca aquest" style="--p:34.67%" tabindex="0" data-nom="Aquest municipi" data-valor="200 €"');
    expect(html).toContain(
      '<i class="marca" style="--p:65.33%" data-valor="300 €" data-extres="posició¦3r més baix de 4‖respecte a la mediana¦+50 € · +20 %"' +
        ' title="300 € · posició: 3r més baix de 4 · respecte a la mediana: +50 € · +20 %">',
    );
    expect(quants(html, /tabindex="0"/g)).toBe(1);
  });

  it("el salt entre dos anys etiqueta els dos caps amb l'any, la xifra i on era el grup", () => {
    const html = pendent({
      titol: "Deute per habitant", etiqueta: "Sabadell", format: euros,
      anys: { inici: 2019, final: 2023 }, municipi: { inici: 800, final: 1204 }, grup: { inici: 500, final: 520 },
    });
    expect(html).toContain(
      'data-nom="Sabadell" data-any="2019" data-valor="800 €" data-grup="500 €"' +
        ' data-extres="canvi 2019–2023¦+404 € · +51 %‖canvi dels seus¦+20 € · +4 %"',
    );
    expect(html).toContain(
      "<title>Sabadell: 2023 · 1.204 € · els seus: 520 € · canvi 2019–2023: +404 € · +51 % · canvi dels seus: +20 € · +4 %</title>",
    );
    expect(quants(html, /<circle class="toc"/g)).toBe(2);
    expect(foraDelQuadre(html)).toEqual([]);
  });

  it("la distribució diu de cada casella el tram i quants municipis hi cauen", () => {
    const valors = Array.from({ length: 40 }, (_, i) => 100 + i * 10);
    const html = distribucioGrup(valors, 250, { format: euros, titol: "Deute", grup: "de la seva mida", unitat: "€" });
    expect(html).toMatch(
      /<g class="punt-casella" data-nom="De [\d.]+ € a [\d.]+ €" data-valor="\d+ municipis, aquest entre ells" data-extres="part del grup¦\d+ % de 40">/,
    );
    expect(html).toContain("<title>De ");
    expect(html).toContain("5 municipis · part del grup: 13 % de 40</title>");
  });

  it("el CSS i el script van junts: una sola caixa per pàgina, banda de tacte pintada i focus visible", () => {
    expect(GRAFICS_CSS).toContain(".etiqueta-grafic{position:fixed");
    expect(GRAFICS_CSS).toContain(".grafic .toc{fill:transparent;stroke:none;pointer-events:all}");
    expect(GRAFICS_CSS).toContain(".grafic .punt:focus-visible .nus");
    expect(GRAFICS_JS).toMatch(/^<script id="grafics-etiqueta">/);
    expect(GRAFICS_JS).toContain("setAttribute('role', 'status')");
    expect(GRAFICS_JS).toContain("'mediana dels seus: '");
    expect(GRAFICS_JS).toContain("'els seus: '");
    // Llegible: cap línia minificada, i sense cap llibreria.
    expect(GRAFICS_JS.split("\n").every((l) => l.length < 140)).toBe(true);
    expect(GRAFICS_JS).not.toContain("<script src=");
  });
});

describe("el que l'etiqueta diu de més: banda, distàncies, canvis i mandat", () => {
  /** Els extres d'un punt, llegits de l'atribut tal com els llegiria el script. */
  const extresDe = (html: string, patro: RegExp): string[][] => {
    const punt = patro.exec(html)?.[0] ?? "";
    const atribut = / data-extres="([^"]*)"/.exec(punt)?.[1] ?? "";
    return atribut === "" ? [] : atribut.split("‖").map((linia) => linia.split("¦"));
  };

  it("les xifres amb signe i el tant per cent es formaten amb la funció del gràfic", () => {
    expect(ambSigne(euros, 42)).toBe("+42 €");
    expect(ambSigne(euros, -3)).toBe("−3 €");
    // −0,3 € escrit sense decimals és 0 €, i el zero no porta signe.
    expect(ambSigne(euros, -0.3)).toBe("0 €");
    expect(percentRelatiu(42, 470)).toBe("+8,9 %");
    expect(percentRelatiu(-180, 600)).toBe("−30 %");
    expect(percentRelatiu(0.01, 600)).toBe("0 %");
    // Sense base positiva no hi ha tant per cent que valgui.
    expect(percentRelatiu(6, 0)).toBeNull();
    expect(percentRelatiu(6, -4)).toBeNull();
    expect(canviEscrit(euros, 800, 1204)).toBe("+404 € · +51 %");
    // D'una sèrie que ja va en tant per cent només es diu la diferència.
    expect(canviEscrit((v) => `${v.toFixed(1).replace(".", ",")} %`, 38.5, 40.6)).toBe("+2,1 %");
  });

  describe("la sèrie temporal", () => {
    const punts = serie([[2018, 500], [2019, 600], [2021, 420], [2022, 700]]);
    const banda: BandaGrup[] = punts.map((p) => ({ any: p.any, p25: 300, p50: 512, p75: 800 }));
    const mandats = [
      { desDe: 2015, finsA: 2019, etiqueta: "Ramos" },
      { desDe: 2019, finsA: 2023, etiqueta: "Farrés" },
    ];
    const html = serieTemporal(punts, {
      titol: "Deute per habitant", format: euros, banda, grup: "de més de 50.000 habitants",
      mandats, anysEsperats: [2018, 2019, 2020, 2021, 2022], nota: "Ministeri d'Hisenda, consultat el 2026",
    });

    it("diu la banda, la distància a la mediana, el canvi des del punt anterior i el mandat, en aquest ordre", () => {
      expect(extresDe(ample(html), /<g class="punt"[^>]*data-any="2022"[^>]*>/)).toEqual([
        ["banda dels seus", "de 300 € a 800 €"],
        ["respecte a la mediana", "+188 € · +37 %"],
        ["respecte al 2021", "+280 € · +67 %"],
        ["mandat", "Farrés"],
      ]);
    });

    it("quan entremig hi ha un any sense dada, diu de quin any ve el canvi", () => {
      // El 2020 no hi és: el canvi del 2021 es diu respecte al 2019, no a «l'any anterior».
      const del2021 = extresDe(ample(html), /<g class="punt"[^>]*data-any="2021"[^>]*>/);
      expect(del2021.map((e) => e[0])).toContain("respecte al 2019");
      expect(del2021.map((e) => e[0])).not.toContain("respecte al 2020");
    });

    it("l'any que comença un mandat és del mandat que comença, i abans del primer tall no n'hi ha cap", () => {
      expect(extresDe(ample(html), /<g class="punt"[^>]*data-any="2019"[^>]*>/)).toContainEqual(["mandat", "Farrés"]);
      expect(extresDe(ample(html), /<g class="punt"[^>]*data-any="2018"[^>]*>/)).toContainEqual(["mandat", "Ramos"]);
      const abans = serieTemporal(serie([[2010, 100], [2011, 120]]), { titol: "Deute", format: euros, mandats });
      expect(abans).not.toContain("mandat¦");
    });

    it("la nota va a cada punt, i el <title> diu la mateixa frase sencera", () => {
      expect(quants(ample(html), /data-nota="Ministeri d'Hisenda, consultat el 2026"/g)).toBe(4);
      expect(ample(html)).toContain(
        "<title>Deute per habitant: 2022 · 700 € · mediana dels seus: 512 € · banda dels seus: de 300 € a 800 €" +
          " · respecte a la mediana: +188 € · +37 % · respecte al 2021: +280 € · +67 % · mandat: Farrés" +
          " (Ministeri d'Hisenda, consultat el 2026)</title>",
      );
      // Sense nota no s'inventa cap font.
      expect(serieTemporal(punts, { titol: "Deute", format: euros })).not.toContain("data-nota");
    });

    it("l'ample i l'estret diuen exactament el mateix de cada any", () => {
      const de = (svg: string): string[] => [...svg.matchAll(/ data-extres="[^"]*"/g)].map((m) => m[0]);
      expect(de(estret(html))).toEqual(de(ample(html)));
    });

    it("d'una sèrie en tant per cent no es fa cap tant per cent del tant per cent", () => {
      const pct = serieTemporal(serie([[2019, 38.5], [2023, 40.6]]), {
        titol: "Dones al ple", format: (v) => `${v.toFixed(1).replace(".", ",")} %`,
      });
      expect(pct).toContain('data-extres="respecte al 2019¦+2,1 %"');
    });

    it("escapa els extres: el cognom del mandat ve de la base de dades", () => {
      const brut = serieTemporal(serie([[2019, 1], [2020, 2]]), {
        titol: "Deute", format: euros, mandats: [{ desDe: 2019, finsA: 2023, etiqueta: 'A "B" <C>' }],
      });
      expect(brut).toContain("mandat¦A &quot;B&quot; &lt;C&gt;");
      expect(brut).not.toContain('"B" <C>');
    });
  });

  describe("el salt entre dos anys", () => {
    it("els dos caps diuen el canvi sencer i el dels seus; sense grup, només el propi", () => {
      const html = pendent({
        titol: "Deute per habitant", format: euros,
        anys: { inici: 2019, final: 2023 }, municipi: { inici: 800, final: 600 }, grup: { inici: 500, final: 520 },
      });
      expect(quants(html, /data-extres="canvi 2019–2023¦−200 € · −25 %‖canvi dels seus¦\+20 € · \+4 %"/g)).toBe(2);
      const sol = pendent({
        titol: "Deute per habitant", format: euros,
        anys: { inici: 2019, final: 2023 }, municipi: { inici: 800, final: 600 },
      });
      expect(sol).toContain('data-extres="canvi 2019–2023¦−200 € · −25 %"');
      expect(sol).not.toContain("canvi dels seus");
      expect(sol).toContain("<title>Deute per habitant: 2023 · 600 € · canvi 2019–2023: −200 € · −25 %</title>");
    });
  });

  describe("les barres divergents", () => {
    const format = (v: number): string => v.toFixed(1).replace(".", ",");

    it("amb un abans i un després, diu les dues xifres amb el seu any i la distància als seus", () => {
      const html = barresDivergents(
        [{ etiqueta: "Escombraries", valor: 13.7, grup: 8.1, abans: 71.3, despres: 85 }],
        { titol: "Canvi", format, unitat: "€/hab", anys: { inici: 2023, final: 2025 } },
      );
      expect(html).toContain('data-extres="2023¦71,3 €/hab‖2025¦85,0 €/hab‖respecte als seus¦+5,6 €/hab"');
      expect(html).toContain(
        'title="Escombraries: +13,7 €/hab · els seus: +8,1 €/hab · 2023: 71,3 €/hab · 2025: 85,0 €/hab · respecte als seus: +5,6 €/hab"',
      );
    });

    it("sense anys, l'abans i el després es diuen així; sense grup ni abans, no hi ha cap extra", () => {
      const html = barresDivergents([{ etiqueta: "Habitatge", valor: -2, grup: null, abans: 10, despres: 8 }], {
        titol: "Canvi", format, unitat: "€/hab",
      });
      expect(html).toContain('data-extres="abans¦10,0 €/hab‖després¦8,0 €/hab"');
      const res = barresDivergents([{ etiqueta: "Habitatge", valor: -2, grup: null }], { titol: "Canvi", format });
      expect(res).not.toContain("data-extres");
    });
  });

  describe("el regle de dispersió", () => {
    it("dos municipis amb la mateixa xifra tenen la mateixa posició", () => {
      const html = regleDispersio(
        "Deute",
        [
          { valor: 100, nom: "A" }, { valor: 200, nom: "B" }, { valor: 200, nom: "C" },
          { valor: 300, nom: "D" }, { valor: 400, nom: "E" },
        ],
        { format: euros },
      );
      expect(quants(html, /posició¦2n més baix de 5/g)).toBe(2);
      expect(html).toContain('data-nom="D" data-valor="300 €" data-extres="posició¦4t més baix de 5‖respecte a la mediana¦+100 € · +50 %"');
      expect(html).toContain('title="E: 400 € · posició: 5è més baix de 5 · respecte a la mediana: +200 € · +100 %"');
    });
  });

  describe("la distribució del grup", () => {
    it("diu quina part del grup cau a cada tram, amb un decimal quan és petita", () => {
      // Dotze valors, vuit caselles: cap casella no arriba al 10 % amb un sol municipi.
      const valors = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      const html = distribucioGrup(valors, 5, { format: euros, titol: "Deute", grup: "de la seva mida", unitat: "€" });
      expect(html).toContain('data-valor="1 municipi" data-extres="part del grup¦8,3 % de 12"');
      expect(html).toContain("<title>De 2 € a 4 €: 1 municipi · part del grup: 8,3 % de 12</title>");
    });
  });
});

// ───────────────────────────────────────────────────────────────────────────
// El regle de dispersió: fons pla, extrems etiquetats i escala logarítmica
// ───────────────────────────────────────────────────────────────────────────

/** Com al navegador: la funció sola, sense res del seu mòdul al voltant. */
const sola = <T>(fn: T): T => new Function("return (" + String(fn) + ")")() as T;

describe("el regle de dispersió, més llegible", () => {
  const poblacions = [40, 120, 300, 800, 1_500, 4_000, 12_000, 60_000, 1_600_000].map((valor, i) => ({
    valor, nom: `Poble ${i}`, slug: `poble-${i}`,
  }));
  const habitants = (v: number): string => v.toLocaleString("ca-ES");

  it("el fons és pla: cap degradat, que la marca prohibeix i que suggereix una escala de valor", () => {
    const regla = GRAFICS_CSS.slice(GRAFICS_CSS.indexOf(".dispersio .regle-dispersio{"), GRAFICS_CSS.indexOf("}", GRAFICS_CSS.indexOf(".dispersio .regle-dispersio{")));
    expect(regla).toContain("background:var(--paper-2)");
    expect(GRAFICS_CSS).not.toMatch(/\.dispersio[^{]*\{[^}]*gradient/);
  });

  it("els dos extrems van etiquetats a cada punta del regle, també en lineal", () => {
    const html = regleDispersio("Renda", poblacions.slice(0, 5), { format: euros });
    expect(html).toContain('<div class="regle-eix" aria-hidden="true"><span class="ini">40 €</span><span class="fi">1.500 €</span></div>');
    expect(html).not.toContain('class="tall"');
    expect(html).not.toContain('class="escala"');
  });

  it("en logarítmica, la població deixa d'amuntegar-se a l'esquerra", () => {
    const lineal = regleDispersio("Població", poblacions, { format: habitants });
    const log = regleDispersio("Població", poblacions, { format: habitants, escala: "log" });
    const pos = (html: string): number[] => [...html.matchAll(/class="marca" style="--p:([\d.]+)%"/g)].map((m) => Number(m[1]));
    // En lineal, vuit dels nou queden en el primer 4 % de barra; en logarítmica es reparteixen.
    expect(pos(lineal).filter((p) => p < 8).length).toBe(8);
    expect(pos(log).filter((p) => p < 8).length).toBe(1);
    expect(pos(log)[0]).toBe(4);
    expect(pos(log).at(-1)).toBe(96);
    expect(log).toContain("cada ratlla multiplica per deu");
    expect(log).toContain('<span class="tall" style="--p:');
    expect(log).toContain('<span class="ini">40</span>');
    expect(log).toContain('<span class="fi">1.600.000</span>');
  });

  it("l'etiqueta flotant continua llegint els mateixos data-*: el contracte amb GRAFICS_JS no canvia", () => {
    const log = regleDispersio("Població", poblacions, { format: habitants, escala: "log" });
    expect(log).toContain('data-nom="Poble 0" data-valor="40" data-extres="posició¦1r més baix de 9');
    // Les ratlles de l'eix no porten «data-valor»: l'etiqueta no s'hi encén.
    expect(log).toMatch(/<i class="tall" style="--p:[\d.]+%"><\/i>/);
    expect(GRAFICS_JS).toContain("closest('[data-valor]')");
  });

  it("si hi ha un zero, la logarítmica torna a lineal en lloc de posar una marca a l'infinit", () => {
    expect(posicioEscala(0, 0, 100, "log")).toBe(posicioEscala(0, 0, 100, "lineal"));
    expect(tallsEscala(0, 100, "log")).toEqual([]);
    expect(posicioEscala(-100, -100, 50, "log-creixement")).toBe(4);
  });

  it("el creixement s'escala sobre la proporció: perdre la meitat i doblar queden a la mateixa distància del zero", () => {
    const zero = posicioEscala(0, -50, 100, "log-creixement");
    expect(zero).toBeCloseTo(50, 6);
    expect(tallsEscala(-60, 1_000, "log-creixement")).toEqual([0, 900]);
    expect(tallsEscala(-60, 300, "log-creixement")).toEqual([-50, 0, 100]);
    expect(etiquetaTall(-50, "log-creixement")).toBe("\u221250 %");
    expect(etiquetaTall(900, "log-creixement")).toBe("+900 %");
  });

  it("les marques de l'eix són potències de deu, curtes, i no trepitgen els extrems", () => {
    expect(tallsEscala(4, 1_600_000, "log")).toEqual([10, 100, 1_000, 10_000, 100_000, 1_000_000]);
    expect(tallsEscala(1_000, 60_400, "log")).toEqual([2_000, 5_000, 10_000, 20_000, 50_000]);
    expect(etiquetaTall(10_000, "log")).toBe("10 mil");
    expect(etiquetaTall(1_000_000, "log")).toBe("1 M");
    expect(etiquetaTall(1_000, "log")).toBe("1.000");
    const { eix } = eixDispersio(4, 1_600_000, "log", "4", "1.600.000");
    for (const m of eix.matchAll(/<span class="tall" style="--p:([\d.]+)%">/g)) {
      expect(Number(m[1])).toBeGreaterThanOrEqual(24);
      expect(Number(m[1])).toBeLessThanOrEqual(76);
    }
  });

  it("les quatre funcions de l'escala viatgen al navegador i hi funcionen soles", () => {
    expect(sola(posicioEscala)(1_000, 10, 100_000, "log")).toBe(50);
    expect(sola(tallsEscala)(4, 1_600_000, "log")).toHaveLength(6);
    expect(sola(etiquetaTall)(100_000, "log")).toBe("100 mil");
    for (const fn of [posicioEscala, tallsEscala, etiquetaTall, eixDispersio]) {
      expect(String(fn)).not.toMatch(/\b__[A-Za-z0-9_$]+\s*\(/);
    }
  });
});

describe("al telèfon, la sèrie comença per l'any d'ara", () => {
  const punts = serie([[2015, 300], [2017, 380], [2019, 500], [2021, 420], [2023, 610]]);

  /**
   * Llisca el llenç dels dibuixos i no la figura: si llisqués la figura,
   * portar-la al final deixaria la clau i les notes tallades per l'esquerra.
   */
  it("els dibuixos van dins d'un llenç, i el que llisca a 520 px és el llenç", () => {
    const html = serieTemporal(punts, { titol: "Deute per habitant", format: euros });
    const llenc = html.match(/<div class="serie-llenc">([\s\S]*?<\/svg>)<\/div>/)?.[1] ?? "";
    expect(svgs(llenc).map((svg) => svg.match(/class="dibuix (\w+)"/)?.[1])).toEqual(["ample", "estret"]);
    // Dins del llenç només hi ha els dos dibuixos: la clau, les notes i la
    // taula per a lectors de pantalla queden fora, quietes.
    expect(llenc.replace(/<svg[\s\S]*?<\/svg>/g, "").trim()).toBe("");
    expect(html.indexOf('class="nomes-lectors"')).toBeGreaterThan(html.indexOf("</svg></div>"));
    const mobil = GRAFICS_CSS.slice(GRAFICS_CSS.indexOf("@media (max-width:520px)"));
    expect(mobil).toContain(".serie-llenc{max-width:100%;overflow-x:auto;overscroll-behavior-x:contain");
  });

  /**
   * Un DOM de mentida amb el mínim que fa servir el guió: dos llenços, un que
   * llisca (420 px de dibuix en una columna de 312) i un que no.
   */
  function executa(llencs: Array<{ scrollWidth: number; clientWidth: number; scrollLeft: number }>): void {
    const oient = (): void => undefined;
    const document = {
      querySelectorAll: (sel: string) => (sel === ".serie-llenc" ? llencs : []),
      addEventListener: oient,
      createElement: () => ({ setAttribute: oient }),
      body: { appendChild: oient },
    };
    const window = { addEventListener: oient, innerWidth: 360 };
    const cos = GRAFICS_JS.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, "");
    new Function("document", "window", cos)(document, window);
  }

  it("el guió porta al final el llenç que llisca, i no toca el que no", () => {
    const llisca = { scrollWidth: 420, clientWidth: 312, scrollLeft: 0 };
    const quiet = { scrollWidth: 680, clientWidth: 680, scrollLeft: 0 };
    executa([llisca, quiet]);
    expect(llisca.scrollLeft).toBe(108);
    expect(quiet.scrollLeft).toBe(0);
    // De cop i sense animació: res de «smooth» ni de «scrollTo» amb comportament.
    expect(GRAFICS_JS).not.toContain("smooth");
  });
});

describe("l'etiqueta flotant es llegeix al telèfon", () => {
  /** Totes les mides de lletra de les regles de l'etiqueta, en rem. */
  const mides = (): number[] =>
    [...GRAFICS_CSS.matchAll(/\.etiqueta-grafic[^{]*\{([^}]*)\}/g)].flatMap((m) =>
      [...m[1]!.matchAll(/font-size:([\d.]+)rem/g)].map((f) => Number(f[1])),
    );

  it("cap text de l'etiqueta no baixa de 14 px", () => {
    expect(mides().length).toBeGreaterThanOrEqual(4);
    for (const mida of mides()) expect(mida * 16).toBeGreaterThanOrEqual(14);
  });

  it("el nom va com està escrit, en Nunito 700 i sense espaiar", () => {
    const nom = GRAFICS_CSS.match(/\.etiqueta-grafic b\{([^}]*)\}/)![1]!;
    expect(nom).toContain("font-family:var(--text)");
    expect(nom).toContain("font-weight:700");
    expect(nom).toContain("letter-spacing:0");
    expect(nom).not.toContain("uppercase");
    expect(GRAFICS_CSS).not.toMatch(/\.etiqueta-grafic[^{]*\{[^}]*text-transform:uppercase/);
  });
});

describe("el regle de dispersió parla com el veí", () => {
  const municipis = [11_000, 14_000, 16_000, 24_000].map((valor, i) => ({ valor, nom: `Poble ${i}` }));

  it("la fila del mig és «El del mig», i la paraula tècnica es queda a l'etiqueta de la marca", () => {
    const html = regleDispersio("Renda", municipis, { format: euros });
    expect(html).toContain('<span class="cap">El del mig</span>');
    expect(html).toContain('<span class="secundari">la meitat queda per sota</span>');
    expect(html).not.toContain("La mediana d'aquí");
    // Al text de la fila no hi ha «mediana»; a l'etiqueta flotant, sí, per a qui la busqui.
    const extrems = html.slice(html.indexOf('<ul class="extrems">'));
    expect(extrems).not.toMatch(/mediana/i);
    expect(html).toContain("respecte a la mediana");
  });

  it("qui crida pot continuar triant com es diu", () => {
    const html = regleDispersio("Renda", municipis, {
      format: euros, etiquetaMediana: "El poble del mig", sotaMediana: "de la comarca",
    });
    expect(html).toContain('<span class="cap">El poble del mig</span>');
    expect(html).toContain('<span class="secundari">de la comarca</span>');
  });
});

describe("la figura del gràfic té un sol marge", () => {
  it("a dalt i a sota, i l'últim d'un bloc no en suma cap al farciment del bloc", () => {
    expect(GRAFICS_CSS).toContain(".grafic{margin:var(--e2) 0 var(--e3);padding:0}");
    expect(GRAFICS_CSS).toContain(".grafic:last-child{margin-bottom:0}");
    expect(GRAFICS_CSS.match(/(^|\n)\.grafic\{/g)).toHaveLength(1);
  });
});
