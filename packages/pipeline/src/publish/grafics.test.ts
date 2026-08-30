import { describe, expect, it } from "vitest";
import {
  anysVisibles,
  GRAFICS_CSS,
  distribucioGrup,
  marquesEix,
  pendent,
  serieTemporal,
  type BandaGrup,
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
    expect(html).not.toContain("<title>");
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
