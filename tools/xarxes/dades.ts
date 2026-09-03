/**
 * D'on surten les xifres de les imatges: només de fitxers ja publicats a
 * `web/public/observatori/`. Cap base de dades i cap xifra escrita a mà: si
 * una dada no és en un d'aquests fitxers, la imatge no es fa.
 *
 *   - `catalunya.json`: una fila per municipi (els 947), els camps de `camps.json`.
 *   - `ranquings/index.html`: el JSON incrustat (`#dades-ranquings`) amb les
 *     nou mètriques ordenables, i l'HTML de les curiositats («dades frikis»),
 *     que no és en cap JSON i per això es llegeix de la pàgina mateixa.
 *   - `m/<slug>/index.html`: la participació de les tres darreres municipals.
 *
 * Les funcions que interpreten text (`parseCuriositats`, `parseParticipacio`,
 * `mediana`) són pures i tenen test al costat.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ARREL } from "./render";

export const OBSERVATORI = join(ARREL, "web/public/observatori");

export type Fila = Record<string, string | number | boolean | null> & {
  municipi: string; slug: string; comarca: string; poblacio: number;
};

export function llegeixCatalunya(): { generat: string; files: Fila[] } {
  const d = JSON.parse(readFileSync(join(OBSERVATORI, "dades/catalunya.json"), "utf8"));
  return { generat: d.generat, files: d.dades as Fila[] };
}

/** El JSON de la pàgina de rànquings: municipis com a tuples i mètriques com a `[índex, valor]`. */
export type Ranquings = {
  municipis: [slug: string, nom: string, comarca: string, grup: string, comarcaSlug: string][];
  grups: Record<string, string>;
  metriques: Record<string, { d: number; s: string; files: [number, number][] }>;
};

export function llegeixRanquingsHtml(): string {
  return readFileSync(join(OBSERVATORI, "ranquings/index.html"), "utf8");
}

export function parseRanquings(html: string): Ranquings {
  const m = html.match(/<script type="application\/json" id="dades-ranquings">([\s\S]*?)<\/script>/);
  if (!m) throw new Error("la pàgina de rànquings no porta el JSON #dades-ranquings");
  return JSON.parse(m[1]!) as Ranquings;
}

/** El títol i la línia de font de cada rànquing, tal com els publica la pàgina. */
export function parseTitolsRanquings(html: string): Record<string, { titol: string; font: string }> {
  const out: Record<string, { titol: string; font: string }> = {};
  for (const m of html.matchAll(/data-metrica="([a-z]+)"/g)) {
    const seg = html.slice(m.index!, m.index! + 2500);
    const titol = desetiqueta(seg.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/)?.[1] ?? "");
    const font = desetiqueta(seg.match(/class="micro"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? "");
    if (titol && !out[m[1]!]) out[m[1]!] = { titol, font };
  }
  return out;
}

export type ItemCurios = { pos: number; nom: string; sub: string; dada: string; href: string | null };
export type Curiositat = {
  id: string; font: string; titol: string; entrada: string;
  llistes: { cap: string; items: ItemCurios[] }[];
  cobertura: string; nota: string;
};

const desetiqueta = (s: string): string =>
  s.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();

/**
 * Llegeix les targetes de curiositats de la pàgina de rànquings. Cada
 * `<article class="curiositat">` porta la font (`.micro`), el títol, una o
 * dues llistes (`h4.cap` + `ol.llista-curiosa`), la cobertura i la nota.
 */
export function parseCuriositats(html: string): Curiositat[] {
  const articles = html.match(/<article class="curiositat" id="[^"]+">[\s\S]*?<\/article>/g) ?? [];
  return articles.map((a) => {
    const id = a.match(/id="([^"]+)"/)![1]!;
    const font = desetiqueta(a.match(/<p class="micro">([\s\S]*?)<\/p>/)?.[1] ?? "");
    const titol = desetiqueta(a.match(/<h3>([\s\S]*?)<\/h3>/)?.[1] ?? "");
    const entrada = desetiqueta(a.match(/<p class="entrada-bloc">([\s\S]*?)<\/p>/)?.[1] ?? "");
    const cobertura = desetiqueta(a.match(/<p class="cobertura">([\s\S]*?)<\/p>/)?.[1] ?? "");
    const nota = desetiqueta(a.match(/<p class="nota[^"]*">([\s\S]*?)<\/p>/)?.[1] ?? "");
    const llistes: Curiositat["llistes"] = [];
    const blocs = a.match(/<h4 class="cap">[\s\S]*?<\/ol>/g) ?? [];
    for (const b of blocs) {
      const cap = desetiqueta(b.match(/<h4 class="cap">([\s\S]*?)<\/h4>/)?.[1] ?? "");
      const items: ItemCurios[] = [];
      for (const li of b.match(/<li>[\s\S]*?<\/li>/g) ?? []) {
        const pos = Number(li.match(/<span class="pos">(\d+)<\/span>/)?.[1] ?? 0);
        const municipi = li.match(/<span class="municipi">([\s\S]*?)<\/span>/)?.[1] ?? "";
        const nom = desetiqueta(municipi.replace(/<small>[\s\S]*<\/small>/, ""));
        const sub = desetiqueta(municipi.match(/<small>([\s\S]*?)<\/small>/)?.[1] ?? "");
        const dada = desetiqueta(li.match(/<b class="dada">([\s\S]*?)<\/b>/)?.[1] ?? "");
        const href = municipi.match(/href="([^"]+)"/)?.[1] ?? null;
        items.push({ pos, nom, sub, dada, href });
      }
      llistes.push({ cap, items });
    }
    return { id, font, titol, entrada, llistes, cobertura, nota };
  });
}

export type Participacio = { any: number; pct: number; votants: number; cens: number };

/** La participació de les darreres municipals que ensenya una fitxa (`#participacio`). */
export function parseParticipacio(fitxaHtml: string): Participacio[] {
  const i = fitxaHtml.indexOf('id="participacio"');
  if (i < 0) return [];
  const text = desetiqueta(fitxaHtml.slice(i, i + 20_000));
  const re = /(\d{4}) (\d{1,3},\d) %.*? (\d[\d.]*) de (\d[\d.]*)/g;
  const out: Participacio[] = [];
  for (const m of text.matchAll(re)) {
    const num = (s: string): number => Number(s.replace(/\./g, "").replace(",", "."));
    out.push({ any: Number(m[1]), pct: num(m[2]!), votants: num(m[3]!), cens: num(m[4]!) });
    if (out.length === 3) break;
  }
  return out;
}

export function llegeixFitxa(slug: string): string {
  return readFileSync(join(OBSERVATORI, "m", slug, "index.html"), "utf8");
}

export function mediana(valors: readonly number[]): number {
  const v = [...valors].sort((a, b) => a - b);
  if (v.length === 0) return NaN;
  const mig = Math.floor(v.length / 2);
  return v.length % 2 ? v[mig]! : (v[mig - 1]! + v[mig]!) / 2;
}
