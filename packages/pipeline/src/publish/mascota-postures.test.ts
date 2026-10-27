import { describe, expect, it } from "vitest";
import {
  PAPERETA_POSTURES_CSS,
  POSTURES,
  paperetaPostura,
  vinyetaPapereta,
} from "./mascota-postures";

/**
 * Un comprovador d'XML ben format, prou per a l'SVG que escrivim aquí.
 *
 * No hi ha cap analitzador XML a les dependències i no en val la pena afegir-ne
 * un per a això. Comprova el que trencaria el dibuix en un navegador: etiquetes
 * que no tanquen o tanquen malament, atributs sense cometes o repetits, i un
 * `<` o un `&` sense escapar dins del text.
 */
function errorsXml(xml: string): string[] {
  const errors: string[] = [];
  const pila: string[] = [];
  const peces = xml.split(/(<[^>]*>)/);
  for (const peca of peces) {
    if (!peca.startsWith("<")) {
      if (/[<>]/.test(peca)) errors.push(`text amb < o >: ${peca}`);
      if (/&(?!amp;|lt;|gt;|quot;|#\d+;)/.test(peca)) errors.push(`& sense escapar: ${peca}`);
      continue;
    }
    const tanca = /^<\/([a-zA-Z]+)\s*>$/.exec(peca);
    if (tanca) {
      const obert = pila.pop();
      if (obert !== tanca[1]) errors.push(`</${tanca[1]}> tanca <${obert}>`);
      continue;
    }
    const obre = /^<([a-zA-Z]+)((?:\s+[a-zA-Z:-]+="[^"<]*")*)\s*(\/?)>$/.exec(peca);
    if (!obre) {
      errors.push(`etiqueta mal formada: ${peca}`);
      continue;
    }
    const noms = [...obre[2]!.matchAll(/([a-zA-Z:-]+)="/g)].map((m) => m[1]!);
    if (new Set(noms).size !== noms.length) errors.push(`atribut repetit: ${peca}`);
    if (obre[3] !== "/") pila.push(obre[1]!);
  }
  if (pila.length) errors.push(`etiquetes sense tancar: ${pila.join(", ")}`);
  return errors;
}

/**
 * Els punts d'un camí, per comprovar que res no surt del viewBox. Només llegeix
 * les ordres que fem servir (M, L, H, V, Q i les relatives); els punts de
 * control de les corbes també hi compten, i està bé: si el control és a fora,
 * el traç gruixut hi va a prop.
 */
function puntsDelCami(d: string): Array<[number, number]> {
  const toks = d.match(/[MmLlHhVvQqZz]|-?[0-9]*\.?[0-9]+/g) ?? [];
  const punts: Array<[number, number]> = [];
  let x = 0, y = 0, sx = 0, sy = 0, cmd = "", i = 0;
  const num = (): number => Number(toks[i++]);
  while (i < toks.length) {
    if (/[A-Za-z]/.test(toks[i]!)) cmd = toks[i++]!;
    switch (cmd) {
      case "M": x = num(); y = num(); sx = x; sy = y; cmd = "L"; break;
      case "m": x += num(); y += num(); sx = x; sy = y; cmd = "l"; break;
      case "L": x = num(); y = num(); break;
      case "l": x += num(); y += num(); break;
      case "H": x = num(); break;
      case "h": x += num(); break;
      case "V": y = num(); break;
      case "v": y += num(); break;
      case "Q": punts.push([num(), num()]); x = num(); y = num(); break;
      case "q": { const cx = x + num(), cy = y + num(); punts.push([cx, cy]); x += num(); y += num(); break; }
      case "Z": case "z": x = sx; y = sy; break;
      default: throw new Error(`ordre no prevista al test: ${cmd}`);
    }
    punts.push([x, y]);
  }
  return punts;
}

/** Tots els extrems del dibuix, comptant-hi la meitat del gruix de cada traç. */
function extrems(svg: string): Array<[number, number]> {
  const punts: Array<[number, number]> = [];
  for (const m of svg.matchAll(/<(path|circle|rect)\b([^>]*)>/g)) {
    const at = (nom: string): number => Number(new RegExp(` ${nom}="([-0-9.]+)"`).exec(m[2]!)?.[1] ?? 0);
    const gruix = at("stroke-width") / 2;
    if (m[1] === "path") {
      const d = / d="([^"]+)"/.exec(m[2]!)![1]!;
      for (const [x, y] of puntsDelCami(d)) punts.push([x - gruix, y - gruix], [x + gruix, y + gruix]);
    } else if (m[1] === "circle") {
      const r = at("r") + gruix;
      punts.push([at("cx") - r, at("cy") - r], [at("cx") + r, at("cy") + r]);
    } else {
      punts.push([at("x") - gruix, at("y") - gruix], [at("x") + at("width") + gruix, at("y") + at("height") + gruix]);
    }
  }
  return punts;
}

describe("paperetaPostura", () => {
  it.each(POSTURES)("%s és un SVG ben format", (p) => {
    const svg = paperetaPostura(p);
    expect(svg.startsWith("<svg ")).toBe(true);
    expect(errorsXml(svg)).toEqual([]);
    expect(errorsXml(paperetaPostura(p, { titol: `«${p}» & cia <b>` }))).toEqual([]);
  });

  it.each(POSTURES)("%s no surt del viewBox, ni comptant el gruix del traç", (p) => {
    const svg = paperetaPostura(p);
    expect(svg).toContain('viewBox="0 0 120 140"');
    for (const [x, y] of extrems(svg)) {
      expect(x, `${p} x=${x}`).toBeGreaterThanOrEqual(0);
      expect(x, `${p} x=${x}`).toBeLessThanOrEqual(120);
      expect(y, `${p} y=${y}`).toBeGreaterThanOrEqual(0);
      expect(y, `${p} y=${y}`).toBeLessThanOrEqual(140);
    }
  });

  it("conserva el cos, la doblegada i els gruixos de la papereta de sempre", () => {
    for (const p of POSTURES) {
      const svg = paperetaPostura(p);
      expect(svg).toContain('<path d="M18 14 H80 L102 36 V126 H18 Z" fill="#FFFFFF" stroke="#1E1B2E" stroke-width="4"');
      expect(svg).toContain('<path d="M80 14 V36 H102 Z" fill="#FFD8B8" stroke="#1E1B2E" stroke-width="4"');
      // Els ulls, quan hi són, són els de radi 9 i traç 3.
      for (const ull of svg.matchAll(/<circle cx="(46|76)" cy="70" r="([0-9.]+)"[^>]*stroke-width="([0-9.]+)"/g)) {
        expect(ull[2]).toBe("9");
        expect(ull[3]).toBe("3");
      }
    }
  });

  it("fa 48 px per defecte i guarda el factor d'alçada 1,17", () => {
    expect(paperetaPostura("pregunta")).toMatch(/width="48" height="56"/);
    expect(paperetaPostura("pregunta", { mida: 96 })).toMatch(/width="96" height="112"/);
  });

  it("només fa servir els cinc colors de la mascota", () => {
    const permesos = new Set(["#1E1B2E", "#FFFFFF", "#E2735A", "#BFE8D2", "#FFD8B8", "none"]);
    for (const p of POSTURES) {
      for (const m of paperetaPostura(p).matchAll(/(?:fill|stroke)="([^"]+)"/g)) {
        expect(permesos.has(m[1]!), `${p}: ${m[1]}`).toBe(true);
      }
    }
  });

  it("no porta res de fora ni res que demani un id compartit", () => {
    for (const p of POSTURES) {
      const svg = paperetaPostura(p, { titol: "Hola" });
      expect(svg).not.toMatch(/href|url\(|<image|<script|<use|Gradient|<mask|<filter|<style/);
    }
  });

  it("amb títol és una imatge amb nom; sense, és decorativa", () => {
    const amb = paperetaPostura("noConsta", { titol: "La dada no consta" });
    expect(amb).toContain('role="img"');
    expect(amb).not.toContain("aria-hidden");
    const id = /aria-labelledby="([^"]+)"/.exec(amb)![1];
    // El <title> és el primer fill de l'SVG, que és on el busquen els lectors.
    expect(amb).toMatch(new RegExp(`^<svg [^>]*><title id="${id}">La dada no consta</title>`));

    const sense = paperetaPostura("noConsta");
    expect(sense).toContain('aria-hidden="true"');
    expect(sense).not.toContain("role=");
    expect(sense).not.toContain("<title");
    expect(sense).not.toContain("aria-labelledby");
    // Un títol en blanc no és un títol.
    expect(paperetaPostura("noConsta", { titol: "  " })).toContain('aria-hidden="true"');
  });

  it("escapa el títol", () => {
    const svg = paperetaPostura("empat", { titol: 'Empat "a dos" <3 & prou' });
    expect(svg).toContain("Empat &quot;a dos&quot; &lt;3 &amp; prou");
  });

  it("dues papeteres a la mateixa pàgina no comparteixen cap id", () => {
    const pagina = paperetaPostura("final", { titol: "Fi" }) + paperetaPostura("final", { titol: "Fi" })
      + vinyetaPapereta("empat", "Empat.");
    const ids = [...pagina.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) expect(pagina).toContain(`aria-labelledby="${id}"`);
  });

  it("respecta un id fix si qui crida en vol un", () => {
    expect(paperetaPostura("majoria", { titol: "Majoria", id: "maj-1" })).toContain('<title id="maj-1">');
  });

  it("no porta la classe «papereta», que la faria surar en bucle", () => {
    for (const p of POSTURES) {
      const svg = paperetaPostura(p, { animada: true });
      expect(svg).not.toMatch(/class="[^"]*\bpapereta\b/);
      for (const m of svg.matchAll(/class="([^"]+)"/g)) {
        for (const c of m[1]!.split(" ")) expect(c.startsWith("pap-"), c).toBe(true);
      }
    }
  });

  it("només «final» es pot animar, i només si es demana", () => {
    expect(paperetaPostura("final")).not.toContain("pap-mou");
    expect(paperetaPostura("final", { animada: true })).toContain("pap-mou");
    for (const p of POSTURES.filter((x) => x !== "final")) {
      expect(paperetaPostura(p, { animada: true })).not.toContain("pap-mou");
    }
  });

  it("cada postura diu el seu estat amb el dibuix", () => {
    // «No consta»: la papereta sense marcar, amb la casella buida.
    expect(paperetaPostura("noConsta")).not.toContain('d="M31 46 l7 8 l14 -16"');
    expect(paperetaPostura("noConsta")).toContain("stroke-dasharray");
    // «Empat»: les dues ratlles de baix fan igual.
    const empat = paperetaPostura("empat");
    const ratlles = [...empat.matchAll(/d="M32 (?:112|122) H([0-9]+)"/g)].map((m) => m[1]);
    expect(ratlles).toHaveLength(2);
    expect(ratlles[0]).toBe(ratlles[1]);
    // «Pregunta»: la boca de sempre de mascota.ts.
    expect(paperetaPostura("pregunta")).toContain('d="M48 94 q12 8 24 0"');
    // Cap parell de postures no és el mateix dibuix.
    const dibuixos = POSTURES.map((p) => paperetaPostura(p).replace(/class="[^"]*"/g, ""));
    expect(new Set(dibuixos).size).toBe(POSTURES.length);
  });
});

describe("vinyetaPapereta", () => {
  it("és una nota amb la papereta decorativa i la frase escapada", () => {
    const v = vinyetaPapereta("noConsta", "L'ajuntament <no> ho publica & prou");
    expect(errorsXml(v)).toEqual([]);
    expect(v).toMatch(/^<div class="pap-vinyeta pap-v-noConsta" role="note">/);
    expect(v).toContain('aria-hidden="true"');
    expect(v).not.toContain("<aside");
    expect(v).toContain("L'ajuntament &lt;no&gt; ho publica &amp; prou");
  });

  it("afegeix l'enllaç a part i l'escapa", () => {
    const v = vinyetaPapereta("final", "Has arribat al final.", {
      enllac: { href: "/observatori/comparador/?a=1&b=2", text: "El comparem amb un altre poble?" },
    });
    expect(errorsXml(v)).toEqual([]);
    expect(v).toContain('<a href="/observatori/comparador/?a=1&amp;b=2">El comparem amb un altre poble?</a>');
    // Al final la papereta saluda (si qui mira no ha demanat menys moviment).
    expect(v).toContain("pap-mou");
  });
});

describe("PAPERETA_POSTURES_CSS", () => {
  it("totes les classes porten el prefix pap-", () => {
    const classes = [...PAPERETA_POSTURES_CSS.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]!);
    expect(classes.length).toBeGreaterThan(0);
    for (const c of classes) expect(c.startsWith("pap-"), c).toBe(true);
  });

  it("l'únic moviment viu dins de prefers-reduced-motion:no-preference i no es repeteix", () => {
    const inici = PAPERETA_POSTURES_CSS.indexOf("@media (prefers-reduced-motion:no-preference)");
    expect(inici).toBeGreaterThan(-1);
    expect(PAPERETA_POSTURES_CSS.slice(0, inici)).not.toMatch(/animation|@keyframes|transition/);
    expect(PAPERETA_POSTURES_CSS).not.toContain("infinite");
    expect(PAPERETA_POSTURES_CSS).toMatch(/animation:pap-saluda [^;]* 1 both/);
  });

  it("fa servir els tokens de la casa, amb el valor de recanvi", () => {
    expect(PAPERETA_POSTURES_CSS).toContain("var(--ink,#1E1B2E)");
    expect(PAPERETA_POSTURES_CSS).toContain("var(--paper-2,#FFFFFF)");
    expect(PAPERETA_POSTURES_CSS).not.toMatch(/gradient|box-shadow|backdrop-filter/);
  });
});
