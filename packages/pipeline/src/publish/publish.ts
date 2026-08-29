import { mkdir, writeFile } from "node:fs/promises";
import { desc, isNotNull } from "drizzle-orm";
import { municipalities, type Db } from "@quivoto/db";
import { loadRadiografia, renderRadiografia } from "./radiografia";
import { loadEls947, renderEls947 } from "./els947";
import { INDEXABLE, SITE } from "./config";
import { loadComarques, renderComarca } from "./comarques";
import { loadComparador, renderComparador } from "./comparador";
import { renderDadesIndex, writeDownloads } from "./dades";
import { slugify } from "../lib/text";
import { withRun } from "../lib/run";

/**
 * Genera les radiografies com a fitxers estàtics. Van a `web/public/proves/`
 * i amb `noindex`: són esborranys per mirar-los i ensenyar-los, no la portada
 * pública de quivoto, que continua sent la pàgina de properament.
 */

const OUT_DIR = new URL("../../../../web/public/observatori/m/", import.meta.url).pathname;

/** Municipis del primer lot, si no se'n demana cap en concret. */
const DEFAULT_SLUGS = ["esplugues-de-llobregat", "sabadell", "girona", "reus", "barcelona", "rubi"];

export async function publish(db: Db, slugs: readonly string[] = []): Promise<void> {
  await withRun(db, "publica radiografies", async (run) => {
    // `publica tots` genera els 947. Són pàgines estàtiques i deterministes:
    // el cost és de segons i el resultat és el lliurable de desembre sencer.
    const all = slugs.includes("tots");
    const wanted = all
      ? (await db.select({ slug: municipalities.slug }).from(municipalities).orderBy(desc(municipalities.population))).map((r) => r.slug)
      : slugs.length > 0
        ? slugs
        : DEFAULT_SLUGS;
    const generatedAt = new Date().toISOString().slice(0, 10);
    const done: string[] = [];

    for (const slug of wanted) {
      const data = await loadRadiografia(db, slug, generatedAt);
      if (!data) {
        await run.issue({ kind: "unknown_slug", severity: "mitjana", entity: slug });
        continue;
      }
      const html = renderRadiografia(data);
      await mkdir(`${OUT_DIR}${slug}`, { recursive: true });
      await writeFile(`${OUT_DIR}${slug}/index.html`, html, "utf8");
      if (!all) run.say(`${data.municipality.name} → observatori/m/${slug}/ (${Math.round(html.length / 1024)} kB)`);
      done.push(slug);
      run.rowsOut += 1;
    }

    if (all) run.say(`${done.length} radiografies generades`);

    // Sitemap: es genera sempre, però només s'enllaça quan siguin indexables.
    const lastmod = generatedAt;
    const urls = [
      `${SITE}/observatori/`,
      `${SITE}/observatori/els947.html`,
      ...done.map((slug) => `${SITE}/observatori/m/${slug}/`),
    ];
    await writeFile(
      `${OUT_DIR}../sitemap.xml`,
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
        .map(
          (url, i) =>
            `  <url><loc>${url}</loc><lastmod>${lastmod}</lastmod><changefreq>monthly</changefreq><priority>${
              i < 2 ? "0.9" : "0.6"
            }</priority></url>`,
        )
        .join("\n")}\n</urlset>\n`,
      "utf8",
    );
    run.say(`sitemap amb ${urls.length} adreces · ${INDEXABLE ? "indexable" : "encara amb noindex"}`);

    // Pàgines de comarca: «qui mana a la meva comarca» no ho respon ningú.
    const comarques = await loadComarques(db);
    for (const comarca of comarques) {
      const slug = slugify((comarca as { name?: string; nom?: string }).name ?? (comarca as { nom?: string }).nom ?? "");
      if (!slug) continue;
      await mkdir(`${OUT_DIR}../c/${slug}`, { recursive: true });
      await writeFile(`${OUT_DIR}../c/${slug}/index.html`, renderComarca(comarca, generatedAt), "utf8");
    }
    run.say(`${comarques.length} pàgines de comarca`);

    // Comparador: triar municipis i veure'ls costat a costat.
    const comparador = await loadComparador(db);
    await mkdir(`${OUT_DIR}../comparador`, { recursive: true });
    await writeFile(`${OUT_DIR}../comparador/index.html`, renderComparador(comparador, generatedAt), "utf8");
    run.say(`comparador amb ${comparador.length} municipis`);

    // Descàrrega: perquè un periodista local ens pugui comprovar i reutilitzar.
    await mkdir(`${OUT_DIR}../dades`, { recursive: true });
    const downloads = await writeDownloads(db, `${OUT_DIR}../dades`);
    await writeFile(
      `${OUT_DIR}../dades/index.html`,
      renderDadesIndex(generatedAt, { municipis: done.length, camps: 0 }),
      "utf8",
    );
    run.say(`${downloads.files} fitxers de dades (${Math.round(downloads.bytes / 1024)} kB)`);

    // «Els 947»: l'índex de tot Catalunya, amb el que en sabem de cadascun.
    const index947 = await loadEls947(db);
    await writeFile(`${OUT_DIR}../els947.html`, renderEls947(index947, generatedAt, new Set(done)), "utf8");
    run.say(`els947.html amb ${index947.length} municipis`);

    // Portada de la secció.
    const rows = await db
      .select({ slug: municipalities.slug, name: municipalities.name, comarca: municipalities.comarca, population: municipalities.population })
      .from(municipalities)
      .where(isNotNull(municipalities.population))
      .orderBy(desc(municipalities.population));
    const byslug = new Map(rows.map((r) => [r.slug, r]));
    const items = done
      .map((slug) => byslug.get(slug))
      .filter(Boolean)
      .map((r) => `<li><a href="m/${r!.slug}/">${r!.name}</a> <span>${r!.comarca ?? ""} · ${(r!.population ?? 0).toLocaleString("ca-ES")} hab.</span></li>`)
      .join("\n");
    await writeFile(
      `${OUT_DIR}../index.html`,
      `<!doctype html><html lang="ca"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow">
<title>Observatori municipal · quivoto</title>
<meta name="description" content="Els 947 municipis de Catalunya amb dades obertes: qui governa, resultats des del 1979, comptes, impostos i transparència.">
<style>
:root{--paper:#FBF7EE;--paper-2:#FFF;--ink:#1E1B2E;--ink-suau:#6B6680;--coral:#E2735A;--menta:#BFE8D2;--presec:#FFD8B8;--vora:rgba(30,27,46,.12);--ombra:3px 3px 0 var(--ink)}
@media (prefers-color-scheme:dark){:root{--paper:#17141F;--paper-2:#211D2C;--ink:#F4F0E6;--ink-suau:#A9A3B8;--vora:rgba(244,240,230,.16)}}
*,*::before,*::after{box-sizing:border-box}
body{background:var(--paper);color:var(--ink);font-family:"Nunito Sans",system-ui,sans-serif;margin:0;padding:0;line-height:1.55}
main{max-width:760px;margin:0 auto;padding:24px 24px 64px}
.dalt{display:flex;justify-content:space-between;align-items:center;gap:16px;max-width:760px;margin:0 auto;padding:24px 24px 0}
.logo{font-family:"Gabarito",system-ui,sans-serif;font-weight:900;letter-spacing:-.05em;font-size:1.25rem;text-decoration:none;color:inherit}
.etiqueta{background:var(--presec);color:#1E1B2E;border-radius:999px;padding:5px 12px;font-size:.66rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em}
h1{font-family:"Gabarito",system-ui,sans-serif;font-weight:900;letter-spacing:-.04em;font-size:clamp(2.8rem,10vw,4.6rem);line-height:.98;margin:16px 0 8px}
.entradeta{color:var(--ink-suau);font-size:1.1rem;max-width:46ch}
.targetes{list-style:none;padding:0;margin:40px 0 0;display:grid;gap:16px}
.targetes a{display:block;background:var(--paper-2);border:2.5px solid var(--ink);border-radius:18px;box-shadow:var(--ombra);
  padding:20px;text-decoration:none;color:inherit;transition:transform .12s ease,box-shadow .12s ease}
.targetes a:hover{transform:translate(2px,2px);box-shadow:1px 1px 0 var(--ink)}
.targetes b{font-family:"Gabarito",system-ui,sans-serif;font-weight:900;font-size:1.4rem;letter-spacing:-.02em;display:block;margin-bottom:4px}
.targetes span{color:var(--ink-suau);font-size:.94rem}
.peu{border-top:2.5px solid var(--ink);margin-top:40px;padding-top:24px;font-size:.84rem;color:var(--ink-suau)}
@media (prefers-reduced-motion:reduce){.targetes a{transition:none}}
</style></head>
<body>
<div class="dalt"><a class="logo" href="/">quivoto</a><span class="etiqueta">esborrany · dades obertes</span></div>
<main>
<h1>Observatori municipal</h1>
<p class="entradeta">Els 947 municipis de Catalunya amb el que en diuen les dades obertes.
Sense cap model de llenguatge pel mig: tot són fonts oficials i càlculs que qualsevol pot repetir.</p>

<ul class="targetes">
  <li><a href="els947.html"><b>Els 947</b>
    <span>Tots els municipis en una llista, amb cercador i filtres: on va haver-hi pacte,
    on ha canviat l'alcaldia a mig mandat, on mana sempre la mateixa força, on no hi ha oposició.</span></a></li>
  <li><a href="m/esplugues-de-llobregat/"><b>La fitxa d'un municipi</b>
    <span>Qui mana, el ple, les dotze eleccions des del 1979, les alcaldies, els comptes,
    els impostos i què en sabem i què no. N'hi ha una per a cadascun dels 947.</span></a></li>
</ul>

<div class="peu">
  <p>Generat el ${generatedAt}. Fonts: Generalitat de Catalunya, Consorci AOC i Síndic de Greuges.
  Esborrany intern, no indexat.</p>
</div>
</main></body></html>`,
      "utf8",
    );

    return { generades: done.length, municipis: done };
  });
}
