import { createHash } from "node:crypto";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { capcalera, tipografia } from "./capcalera";
import { cercador } from "./cercador";
import { peu } from "./peu";
import { RADIOGRAFIA_CSS } from "./estil";
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

const CSS = `${RADIOGRAFIA_CSS}
.resum-fonts{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:var(--e2);list-style:none;padding:0;margin:var(--e3) 0}
.resum-fonts li{background:var(--menta);color:#1e1b2e;border:2.5px solid #1e1b2e;border-radius:var(--r-m);box-shadow:3px 3px 0 #1e1b2e;padding:var(--e2)}
.resum-fonts b{display:block;font-family:var(--display);font-size:1.8rem}.font{border-top:2px solid var(--vora);padding:var(--e3) 0}
.font{background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);box-shadow:3px 3px 0 var(--ink);margin:var(--e2) 0;padding:0;overflow:hidden}.font summary{list-style:none;cursor:pointer;padding:var(--e2) var(--e3);display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 20px;align-items:center}.font summary::-webkit-details-marker{display:none}.font summary::after{content:"+";font-family:var(--display);font-size:1.8rem;font-weight:900}.font[open] summary::after{content:"−"}.font[open] summary{border-bottom:2px solid var(--vora);background:var(--menta);color:#1e1b2e}.font h3{margin:0}.font-cos{padding:var(--e2) var(--e3) var(--e3)}.meta{display:flex;flex-wrap:wrap;gap:7px;margin:8px 0}.meta span{border:1.5px solid currentColor;border-radius:var(--r-max);padding:3px 10px;font-size:.72rem;font-weight:800}
.font dl{display:grid;grid-template-columns:minmax(110px,170px) 1fr;gap:8px 14px;margin:var(--e2) 0}.font dt{font-weight:900}.font dd{margin:0;color:var(--ink-suau)}
.font ul{margin:6px 0}.fitxers{display:flex;flex-wrap:wrap;gap:8px}.fitxers a{font-weight:800}
@media(max-width:560px){.font dl{grid-template-columns:1fr}.font dd{margin-bottom:7px}}
`;

export function renderSourcesIndex(generatedAt: string): string {
  const list = renderSourcesList();
  const published = Object.values(SOURCES).filter(s => s.estat === "publicat").length;
  return `<!doctype html><html lang="ca"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fonts · Observatori de quivoto</title><meta name="description" content="Registre complet de les fonts, transformacions, cobertura i límits de l'Observatori municipal.">${tipografia("../")}<style>${CSS}</style></head><body><a class="salta" href="#contingut">Ves al contingut</a>${capcalera("../", "cap", "fonts")}${cercador("../")}<main id="contingut"><p class="micro">Metodologia</p><h1>D'on surt cada dada</h1><p class="entrada">Una font no és només un enllaç: és qui publica, quin període cobreix, què hi transformem i què no permet afirmar. Aquest registre inclou també les fonts que només alimenten una fitxa o serveixen per contrastar.</p><ul class="resum-fonts"><li><b>${Object.keys(SOURCES).length}</b><span>fonts i famílies</span></li><li><b>${published}</b><span>als descarregables</span></li><li><b>J1–J30</b><span>feina traçable</span></li></ul><section class="bloc"><h2>Registre reutilitzable</h2><p>La pàgina i els fitxers es generen del mateix registre. El manifest dona la mida i el SHA-256 dels exports principals.</p><p class="fitxers"><a href="../dades/fonts.json">fonts.json</a><a href="../dades/camps.json">camps.json</a><a href="../dades/manifest.json">manifest.json</a><a href="../dades/ESQUEMA.md">ESQUEMA.md</a></p></section><section class="bloc"><h2>Totes les fonts</h2>${list}</section></main>${peu("../", generatedAt)}</body></html>`;
}

/** El mateix registre complet, reutilitzat també dins de /dades/. */
export function renderSourcesList(): string {
  const estatPublic = (estat: Source["estat"]): string => ({
    publicat: "Publicada",
    nomes_fitxa: "Només a les fitxes municipals",
    suport: "Font de context",
    experimental: "En preparació",
    retirat: "Ja no s'actualitza",
  })[estat];
  const periodePublic = (periode: string): string => periode
    .replace(/foto vigent sense exercici explícit/gi, "situació actual, sense any de referència publicat")
    .replace(/foto consultada en cada ingesta/gi, "consultat en cada actualització")
    .replace(/foto vigent/gi, "situació actual");
  return Object.entries(SOURCES).map(([key, raw]) => {
    const s: Source = raw;
    return `<details class="font" id="${esc(key)}"><summary><div><h3>${esc(s.titol)}</h3><div class="meta"><span>${esc(estatPublic(s.estat))}</span><span>${esc(periodePublic(s.periode))}</span></div></div></summary><div class="font-cos">
    <dl><dt>Productor</dt><dd>${esc(s.productor)}</dd><dt>Conjunt</dt><dd><a href="${esc(s.url)}">${esc(s.id)}</a> · ${esc(s.portal)}</dd><dt>Granularitat</dt><dd>${esc(s.granularitat)}</dd><dt>Univers</dt><dd>${esc(s.univers)}</dd><dt>Llicència</dt><dd>${esc(s.llicencia)}${s.atribucio ? ` · ${esc(s.atribucio)}` : ""}</dd></dl>
    <p><b>Què en fem:</b> ${s.transformacions.map(esc).join("; ")}.</p>${s.limitacions.length ? `<p><b>Límits:</b> ${s.limitacions.map(esc).join("; ")}.</p>` : ""}
  </div></details>`;
  }).join("\n");
}
