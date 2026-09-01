import { createHash } from "node:crypto";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { SOURCES, SOURCE_REGISTRY_VERSION, type Source, type SourceKey } from "./source-registry";

export type PublishedField = {
  clau: string;
  etiqueta: string;
  unitat: string;
  sourceIds: readonly SourceKey[];
  derivat: boolean;
  descripcio: string;
  abast: "municipi" | "municipi_i_catalunya";
};

const stableJson = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
const esc = (value: string): string => value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

async function fileRecord(path: string, relative: string) {
  const bytes = await readFile(path);
  return { path: relative, bytes: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") };
}

export async function writeSourceCatalogue(
  dataDir: string,
  generatedAt: string,
  fields: readonly PublishedField[],
): Promise<void> {
  const normalizedDataDir = dataDir.endsWith("/") ? dataDir.slice(0, -1) : dataDir;
  const sources = Object.entries(SOURCES).map(([key, value]) => ({ key, ...value }));
  await writeFile(join(normalizedDataDir, "fonts.json"), stableJson({ schema_version: SOURCE_REGISTRY_VERSION, generated_at: generatedAt, sources }), "utf8");
  await writeFile(join(normalizedDataDir, "camps.json"), stableJson({ schema_version: 1, generated_at: generatedAt, fields }), "utf8");

  const candidates = ["catalunya.csv", "catalunya.json", "ESQUEMA.md", "fonts.json", "camps.json"];
  const files = [];
  for (const name of candidates) {
    try { files.push(await fileRecord(join(normalizedDataDir, name), name)); } catch { /* encara no generat */ }
  }
  let municipalityFiles = 0;
  let municipalityBytes = 0;
  try {
    for (const name of await readdir(join(normalizedDataDir, "m"))) {
      if (!name.endsWith(".csv") && !name.endsWith(".json")) continue;
      municipalityFiles++;
      municipalityBytes += (await stat(join(normalizedDataDir, "m", name))).size;
    }
  } catch { /* cap export municipal en proves unitàries mínimes */ }
  const manifest = {
    schema_version: 1,
    generated_at: generatedAt,
    registry_version: SOURCE_REGISTRY_VERSION,
    counts: { sources: sources.length, fields: fields.length, municipality_files: municipalityFiles },
    aggregates: { municipality_bytes: municipalityBytes },
    files,
    hash: "sha256",
    note: "manifest.json s'exclou del seu propi hash; els fitxers municipals es compten i pesen agregadament",
  };
  await writeFile(join(normalizedDataDir, "manifest.json"), stableJson(manifest), "utf8");
}

/**
 * L'estil de la llista de fonts, que viu a `/dades/#fonts`. Files d'una llista
 * i no targetes: són més de trenta i cada una amb vora, ombra i coixí feia una
 * columna de caixes que no es podia escombrar amb la vista. Oberta, cada font
 * ensenya la seva fitxa; tancada, el títol i dues etiquetes.
 */
export const FONTS_CSS = `
.fonts-llista{margin:var(--e2) 0 0}
.fonts-llista h3{font-size:.8rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-suau);
  margin:var(--e3) 0 0;padding-bottom:6px;border-bottom:2.5px solid var(--ink)}
.font{border-bottom:2px solid var(--vora)}
.font summary{list-style:none;cursor:pointer;padding:13px 0;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 16px;align-items:center}
.font summary::-webkit-details-marker{display:none}
.font summary::after{content:"+";font-family:var(--display);font-size:1.5rem;font-weight:900;line-height:1;color:var(--ink-suau)}
.font[open] summary::after{content:"−"}
.font summary:hover h4,.font summary:focus-visible h4{color:var(--coral-text)}
.font summary:focus-visible{outline:3px solid var(--coral-text);outline-offset:2px;border-radius:6px}
.font h4{margin:0;font-family:var(--display);font-weight:900;font-size:1.02rem;letter-spacing:-.01em}
.font .meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:5px}
.font .meta span{border:1.5px solid var(--vora);border-radius:var(--r-max);padding:2px 9px;font-size:.7rem;font-weight:800;color:var(--ink-suau)}
.font .meta .publicat{background:var(--menta);border-color:#1E1B2E;color:#1E1B2E}
.font-cos{padding:2px 0 var(--e3);color:var(--ink-suau);font-size:.92rem;max-width:78ch}
.font-cos p{margin:6px 0 0}
.font dl{display:grid;grid-template-columns:minmax(100px,140px) 1fr;gap:5px 14px;margin:0 0 var(--e2)}
.font dt{font-weight:800;color:var(--ink)}
.font dd{margin:0;overflow-wrap:anywhere}
@media(max-width:560px){.font dl{grid-template-columns:1fr}.font dd{margin-bottom:6px}}
`;

/** El mateix registre complet, reutilitzat també dins de /dades/. */
export function renderSourcesList(): string {
  const estats: ReadonlyArray<{ estat: Source["estat"]; titol: string; etiqueta: string }> = [
    { estat: "publicat", titol: "Als fitxers descarregables", etiqueta: "Publicada" },
    { estat: "nomes_fitxa", titol: "Només a les fitxes municipals", etiqueta: "A les fitxes" },
    { estat: "suport", titol: "De context i comprovació", etiqueta: "Context" },
    { estat: "experimental", titol: "En preparació", etiqueta: "En preparació" },
    { estat: "retirat", titol: "Ja no s'actualitzen", etiqueta: "Retirada" },
  ];
  const periodePublic = (periode: string): string => periode
    .replace(/foto vigent sense exercici explícit/gi, "situació actual, sense any de referència publicat")
    .replace(/foto consultada en cada ingesta/gi, "consultat en cada actualització")
    .replace(/foto vigent/gi, "situació actual");
  const fitxa = (key: string, s: Source, etiqueta: string): string =>
    `<details class="font" id="${esc(key)}"><summary><div><h4>${esc(s.titol)}</h4><div class="meta"><span class="${esc(s.estat)}">${esc(etiqueta)}</span><span>${esc(periodePublic(s.periode))}</span></div></div></summary><div class="font-cos">
    <dl><dt>Productor</dt><dd>${esc(s.productor)}</dd><dt>Conjunt</dt><dd><a href="${esc(s.url)}">${esc(s.id)}</a> · ${esc(s.portal)}</dd><dt>Granularitat</dt><dd>${esc(s.granularitat)}</dd><dt>Univers</dt><dd>${esc(s.univers)}</dd><dt>Llicència</dt><dd>${esc(s.llicencia)}${s.atribucio ? ` · ${esc(s.atribucio)}` : ""}</dd></dl>
    <p><b>Què en fem:</b> ${s.transformacions.map(esc).join("; ")}.</p>${s.limitacions.length ? `<p><b>Límits:</b> ${s.limitacions.map(esc).join("; ")}.</p>` : ""}
  </div></details>`;
  const entrades = Object.entries(SOURCES) as [string, Source][];
  return `<div class="fonts-llista">${estats
    .map(({ estat, titol, etiqueta }) => {
      const del = entrades.filter(([, s]) => s.estat === estat);
      return del.length ? `<h3>${esc(titol)} · ${del.length}</h3>\n${del.map(([key, s]) => fitxa(key, s, etiqueta)).join("\n")}` : "";
    })
    .filter(Boolean)
    .join("\n")}</div>`;
}
