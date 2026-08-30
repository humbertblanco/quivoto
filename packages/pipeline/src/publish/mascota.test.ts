import { describe, expect, it } from "vitest";
import { CARES, MASCOTA_CSS, catalunya, papereta } from "./mascota";

/**
 * Un lector de camins prou complet per als camins que dibuixem aquí, i no més.
 *
 * Serveix per a una sola cosa: comprovar que cap punt del dibuix no surt del
 * viewBox. Els punts de control d'una corba quadràtica hi entren encara que la
 * corba no hi passi, i està bé que hi entrin: si el control ja és a fora, la
 * corba hi va a prop i el traç gruixut se'n va igualment.
 */
function puntsDelCami(d: string): Array<[number, number]> {
  const toks = d.match(/[MmLlHhVvQqTtCcSsZz]|-?[0-9]*\.?[0-9]+/g) ?? [];
  const punts: Array<[number, number]> = [];
  let x = 0, y = 0, sx = 0, sy = 0, cmd = "";
  let i = 0;
  const num = (): number => Number(toks[i++]);
  const posa = (): void => { punts.push([x, y]); };
  while (i < toks.length) {
    if (/[A-Za-z]/.test(toks[i]!)) { cmd = toks[i]!; i++; }
    switch (cmd) {
      case "M": x = num(); y = num(); sx = x; sy = y; posa(); cmd = "L"; break;
      case "m": x += num(); y += num(); sx = x; sy = y; posa(); cmd = "l"; break;
      case "L": x = num(); y = num(); posa(); break;
      case "l": x += num(); y += num(); posa(); break;
      case "H": x = num(); posa(); break;
      case "h": x += num(); posa(); break;
      case "V": y = num(); posa(); break;
      case "v": y += num(); posa(); break;
      case "Q": { const cx = num(), cy = num(); punts.push([cx, cy]); x = num(); y = num(); posa(); break; }
      case "q": { const cx = x + num(), cy = y + num(); punts.push([cx, cy]); x += num(); y += num(); posa(); break; }
      case "Z": case "z": x = sx; y = sy; cmd = ""; i++; break;
      default: i++; break;
    }
  }
  return punts;
}

/** Tots els punts d'un SVG: els dels camins i els extrems de cada cercle. */
function puntsDelSvg(svg: string, marge: number): Array<[number, number]> {
  const punts: Array<[number, number]> = [];
  for (const m of svg.matchAll(/ d="([^"]+)"/g)) {
    for (const [x, y] of puntsDelCami(m[1]!)) {
      punts.push([x - marge, y - marge], [x + marge, y + marge]);
    }
  }
  for (const m of svg.matchAll(/<circle cx="([-0-9.]+)" cy="([-0-9.]+)" r="([-0-9.]+)"/g)) {
    const cx = Number(m[1]), cy = Number(m[2]), r = Number(m[3]) + marge;
    punts.push([cx - r, cy - r], [cx + r, cy + r]);
  }
  return punts;
}

describe("catalunya", () => {
  it("porta viewBox, que és el que la fa escalable a qualsevol mida", () => {
    expect(catalunya()).toContain('viewBox="0 0 120 120"');
  });

  it("es crida com la papereta: mida i variant", () => {
    const petita = catalunya(40);
    expect(petita).toContain('width="40"');
    expect(petita).toContain('height="40"');
    expect(catalunya(180, "neutre")).toContain("M42 70 h18");
    expect(catalunya(180, "pregunta")).toContain("M44 70 q8 -5 16 0");
    // Un humor que no existeix no ha de deixar la mascota sense boca.
    expect(catalunya(180, "inventat")).toContain('class="boca"');
  });

  it("és una imatge amb nom per defecte i decorativa si es demana", () => {
    const amb = catalunya();
    expect(amb).toContain('role="img"');
    expect(amb).toMatch(/aria-label="[^"]+"/);
    expect(amb).not.toContain("aria-hidden");

    const sense = catalunya(48, "felic", null);
    expect(sense).toContain('aria-hidden="true"');
    expect(sense).not.toContain("role=");
    expect(sense).not.toContain("aria-label");
  });

  it("no en surt res, del viewBox, ni comptant el gruix del traç", () => {
    for (const [x, y] of puntsDelSvg(catalunya(), 2)) {
      expect(x, `x=${x}`).toBeGreaterThanOrEqual(0);
      expect(x, `x=${x}`).toBeLessThanOrEqual(120);
      expect(y, `y=${y}`).toBeGreaterThanOrEqual(0);
      expect(y, `y=${y}`).toBeLessThanOrEqual(120);
    }
  });

  it("té cara: dos ulls, dues parpelles i una boca", () => {
    const svg = catalunya();
    expect(svg).toContain('class="pupilles"');
    expect(svg).toContain('class="parpelles"');
    expect(svg).toContain('class="boca"');
  });

  it("els punts de poble no són cap dada: en són set i cap no és un municipi", () => {
    // Si algun dia això falla perquè algú n'hi ha posat 947, el dibuix ha
    // deixat de ser un personatge i ha passat a ser un mapa dolent.
    const punts = [...catalunya().matchAll(/<circle cx="[^"]+" cy="[^"]+" r="2\.6"/g)];
    expect(punts).toHaveLength(7);
  });

  it("els pobles s'encenen escalonats amb el graó de 60 ms del sistema", () => {
    const retards = [...catalunya().matchAll(/--retard:([0-9.]+)s/g)].map((m) => Number(m[1]));
    expect(retards).toHaveLength(7);
    for (let i = 1; i < retards.length; i++) {
      expect(retards[i]! - retards[i - 1]!).toBeCloseTo(0.06, 3);
    }
    // El sostre d'escalonament de design/MOVIMENT.md són vuit elements.
    expect(retards.length).toBeLessThanOrEqual(8);
  });
});

describe("MASCOTA_CSS", () => {
  /** El bloc de prefers-reduced-motion, tal com queda escrit al full. */
  const reduit = MASCOTA_CSS.slice(MASCOTA_CSS.indexOf("@media (prefers-reduced-motion:reduce)"));

  it("anima la silueta amb els mateixos keyframes que la papereta", () => {
    expect(MASCOTA_CSS).toContain(".catalunya .terra{animation:sura");
    expect(MASCOTA_CSS).toContain("animation:parpelleig 6.5s infinite");
    expect(MASCOTA_CSS).toContain("@keyframes sura");
    expect(MASCOTA_CSS).toContain("@keyframes parpelleig");
    expect(MASCOTA_CSS).toContain("@keyframes reull");
  });

  it("els pobles s'encenen un sol cop i s'hi queden", () => {
    expect(MASCOTA_CSS).toContain("@keyframes poble{to{opacity:1;transform:scale(1)}}");
    expect(MASCOTA_CSS).toMatch(/\.catalunya \.pobles circle\{[^}]*opacity:0/);
    expect(MASCOTA_CSS).toMatch(/animation:poble 240ms[^;}]*forwards/);
    // Un bucle a la silueta seria moviment permanent fora de la cara.
    expect(MASCOTA_CSS).not.toMatch(/animation:poble[^;}]*infinite/);
  });

  it("amb prefers-reduced-motion la silueta queda quieta i sencera", () => {
    expect(reduit).toContain(".catalunya .terra");
    expect(reduit).toContain(".catalunya .pupilles");
    expect(reduit).toContain(".catalunya .parpelles circle");
    expect(reduit).toContain(".catalunya .pobles circle");
    expect(reduit).toContain("animation:none");
    // Res no es queda a mig camí: parpelles obertes i pobles encesos.
    expect(reduit).toContain(".catalunya .parpelles circle{transform:scaleY(0)}");
    expect(reduit).toContain(".catalunya .pobles circle{opacity:1;transform:none}");
  });

  it("l'única animació que no és de la cara no és cap bucle", () => {
    const bucles = [...MASCOTA_CSS.matchAll(/\.catalunya [^{]+\{[^}]*infinite[^}]*\}/g)];
    for (const b of bucles) {
      expect(b[0]).toMatch(/terra|pupilles|parpelles/);
    }
  });
});

describe("la papereta, que no s'ha de moure d'on era", () => {
  it("segueix portant viewBox i nom", () => {
    expect(papereta()).toContain('viewBox="0 0 120 140"');
    expect(papereta()).toContain('role="img"');
  });

  it("no en surt res, del viewBox", () => {
    for (const [x, y] of puntsDelSvg(papereta(), 3)) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(120);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(140);
    }
  });

  it("les cinc cares de l'escala són decoratives: el text del botó ja les diu", () => {
    expect(CARES).toHaveLength(5);
    for (const c of CARES) expect(c.svg).toContain('aria-hidden="true"');
  });
});
